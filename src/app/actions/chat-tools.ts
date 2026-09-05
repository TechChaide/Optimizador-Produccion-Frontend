
// src/app/actions/chat-tools.ts
import { ai } from '@/ai/genkit';
import { z } from 'genkit';
import { getRequestContext } from '@/lib/request-context';
import { runtimeInspector } from '@/services/RuntimeInspector';
import { dataStore } from '@/services/DataStore';

/**
 * Herramientas de análisis para el Production Assistant
 * Implementadas con Genkit defineTool y AsyncLocalStorage para contexto
 */

// Helper para obtener el número de semana
function getWeekNumber(date: Date): number {
  const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
  const dayNum = d.getUTCDay() || 7;
  d.setUTCDate(d.getUTCDate() + 4 - dayNum);
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
  return Math.ceil((((d.getTime() - yearStart.getTime()) / 86400000) + 1) / 7);
}

// Helper para agrupar ventas
function groupSalesBy(sales: any[], groupBy: string) {
  const groups: Record<string, any> = {};
  
  sales.forEach(sale => {
    let key: string;
    
    // Extraer y validar la fecha
    const dateValue = sale.fecha || sale.date;
    let saleDate: Date;
    
    try {
      if (!dateValue) {
        // Si no hay fecha, usar fecha actual como fallback
        saleDate = new Date();
      } else if (typeof dateValue === 'string') {
        // Intenta parsear como ISO string o YYYY-MM-DD
        saleDate = new Date(dateValue);
        if (isNaN(saleDate.getTime())) {
          // Si falla, intenta parsear como DD/MM/YYYY o MM-DD-YYYY
          const parts = dateValue.split(/[-\/]/);
          if (parts.length === 3) {
            // Intenta múltiples formatos
            const [p1, p2, p3] = parts;
            saleDate = new Date(`${p3}-${p1}-${p2}`); // Asume YYYY-MM-DD
            if (isNaN(saleDate.getTime())) {
              saleDate = new Date(`${p3}-${p2}-${p1}`); // Intenta YYYY-DD-MM
            }
          }
          if (isNaN(saleDate.getTime())) {
            saleDate = new Date(); // Fallback a fecha actual
          }
        }
      } else if (dateValue instanceof Date) {
        saleDate = dateValue;
      } else if (typeof dateValue === 'number') {
        saleDate = new Date(dateValue);
      } else {
        saleDate = new Date();
      }
    } catch (e) {
      saleDate = new Date(); // Fallback a fecha actual en caso de error
    }
    
    switch (groupBy) {
      case 'day':
        key = saleDate.toISOString().split('T')[0];
        break;
      case 'week':
        const week = getWeekNumber(saleDate);
        key = `Week ${week}`;
        break;
      case 'month':
        key = saleDate.toISOString().slice(0, 7); // YYYY-MM
        break;
      case 'product':
        key = sale.productId || sale.producto || 'Unknown';
        break;
      default:
        key = 'All';
    }
    
    if (!groups[key]) {
      groups[key] = { count: 0, revenue: 0 };
    }
    
    groups[key].count++;
    groups[key].revenue += sale.total || sale.amount || 0;
  });
  
  return groups;
}

export const analyzeSalesTool = ai.defineTool({
  name: 'analyzeSales',
  description: 'Analyzes sales data with optional filters for date range, product, and grouping. Returns total sales, revenue, and grouped statistics.',
  inputSchema: z.object({
    startDate: z.string().optional().describe('Start date in YYYY-MM-DD format'),
    endDate: z.string().optional().describe('End date in YYYY-MM-DD format'),
    productId: z.string().optional().describe('Specific Product ID (exact match)'),
    productName: z.string().optional().describe('Product Name or Description (partial match) - Use this when user gives a name like "SÁBANA SUNSET"'),
    groupBy: z.enum(['day', 'week', 'month', 'product']).optional().describe('How to group the results')
  }),
}, async (params) => {
  const contextData = getRequestContext() || {};
  try {
    const keys = Object.keys(contextData || {});
    const sample = (contextData.salesDataSample && contextData.salesDataSample[0]) || (contextData.salesDataFull && contextData.salesDataFull[0]);
    const sampleKeys = sample ? Object.keys(sample).join(',') : 'no-sample';
    console.debug('[Tool analyzeSales] context keys=', keys.join(','), 'salesSample=', (contextData.salesDataSample || []).length, 'salesFull=', (contextData.salesDataFull || []).length, 'sampleKeys=', sampleKeys);
  } catch (e) {
    console.debug('[Tool analyzeSales] failed to log context info', e);
  }
  const sales = contextData.salesDataFull || contextData.salesDataSample || [];
  
  // Filtrar por fechas si se proveen
  let filtered = sales;
  if (params.startDate || params.endDate) {
    filtered = sales.filter((sale: any) => {
      try {
        const dateValue = sale.fecha || sale.date;
        let saleDate: Date;
        
        if (!dateValue) return true; // Si no hay fecha, incluir
        
        if (typeof dateValue === 'string') {
          saleDate = new Date(dateValue);
          if (isNaN(saleDate.getTime())) {
            const parts = dateValue.split(/[-\/]/);
            if (parts.length === 3) {
              const [p1, p2, p3] = parts;
              saleDate = new Date(`${p3}-${p1}-${p2}`);
              if (isNaN(saleDate.getTime())) {
                saleDate = new Date(`${p3}-${p2}-${p1}`);
              }
            }
          }
        } else if (dateValue instanceof Date) {
          saleDate = dateValue;
        } else if (typeof dateValue === 'number') {
          saleDate = new Date(dateValue);
        } else {
          return true; // Si no puedo parsear, incluir
        }
        
        if (isNaN(saleDate.getTime())) return true; // Fallback
        
        if (params.startDate && saleDate < new Date(params.startDate)) return false;
        if (params.endDate && saleDate > new Date(params.endDate)) return false;
        return true;
      } catch (e) {
        return true; // En caso de error, incluir el registro
      }
    });
  }
  
  // Filtrar por ID de producto (Exacto)
  if (params.productId) {
    filtered = filtered.filter((sale: any) => 
      String(sale.productId || sale.producto || sale.codigo || sale.code) === String(params.productId)
    );
  }

  // Filtrar por Nombre de producto (Parcial / Flexible)
  if (params.productName) {
    const searchTerm = params.productName.toLowerCase();
    filtered = filtered.filter((sale: any) => {
      // Buscar en varios campos posibles de descripción
      const descriptionParts = [
        sale.description,
        sale.descripcion,
        sale.materialDescription,
        sale.descripcionMaterial,
        sale.etiqueta,
        sale.label,
        sale.nombre,
        sale.name,
        sale.producto,
        sale.labelDescription
      ].filter(Boolean).map((s: any) => String(s).toLowerCase());

      let description = descriptionParts.join(' ');
      // Si no encontramos campos conocidos, intentar buscar en cualquier campo string
      if (!description) {
        description = Object.values(sale).filter(v => typeof v === 'string').join(' ').toLowerCase();
      }
      return description.includes(searchTerm);
    });
  }
  
  // Calcular estadísticas
  const totalSales = filtered.length;
  // Sumar unidades si existen, o contar registros
  const totalUnits = filtered.reduce((sum: number, sale: any) => 
    sum + (Number(sale.units) || Number(sale.unidades) || Number(sale.quantity) || Number(sale.cantidad) || 1), 0
  );
  
  const totalRevenue = filtered.reduce((sum: number, sale: any) => 
    sum + (Number(sale.total) || Number(sale.amount) || Number(sale.monto) || 0), 0
  );
  
  const avgSaleValue = totalSales > 0 ? totalRevenue / totalSales : 0;
  
  // Agrupar si se solicita
  let groupedData = null;
  if (params.groupBy) {
    groupedData = groupSalesBy(filtered, params.groupBy);
  }
  
  return {
    totalRecords: totalSales,
    totalUnits,
    totalRevenue,
    avgSaleValue,
    period: { start: params.startDate, end: params.endDate },
    filtersApplied: {
      productId: params.productId,
      productName: params.productName
    },
    groupedData
  };
});


export const analyzeProductionCapacityTool = ai.defineTool({
  name: 'analyzeProductionCapacity',
  description: 'Calculates production capacity for work centers, considering maintenance and current utilization.',
  inputSchema: z.object({
    workCenterId: z.string().optional().describe('Specific work center ID (optional, analyzes all if not provided)'),
    startDate: z.string().describe('Start date in YYYY-MM-DD format'),
    endDate: z.string().describe('End date in YYYY-MM-DD format')
  }),
}, async (params) => {
  const contextData = getRequestContext() || {};
  try {
    console.debug('[Tool analyzeProductionCapacity] context keys=', Object.keys(contextData || {}).join(','));
  } catch (e) { /* ignore */ }
  const plan = contextData.productionPlanFull || contextData.productionPlanSample || [];
  const maintenance = contextData.maintenanceFull || contextData.maintenanceSample || [];
  const constraints = contextData.constraintsSummary || {};
  
  // Calcular capacidad teórica
  const workCenter = params.workCenterId 
    ? constraints.workCenters?.find((wc: any) => wc.id === params.workCenterId)
    : null;
  
  const theoreticalCapacity = workCenter?.capacity || 'Unknown';
  
  // Calcular capacidad utilizada
  const utilizationInPeriod = plan.filter((item: any) => {
    const itemDate = new Date(item.fecha || item.date);
    return itemDate >= new Date(params.startDate) && 
           itemDate <= new Date(params.endDate);
  });
  
  const usedCapacity = utilizationInPeriod.reduce((sum: number, item: any) => 
    sum + (item.quantity || 0), 0
  );
  
  // Considerar mantenimiento
  const maintenanceInPeriod = maintenance.filter((m: any) => {
    const mDate = new Date(m.fecha || m.date);
    return mDate >= new Date(params.startDate) && 
           mDate <= new Date(params.endDate) &&
           (!params.workCenterId || m.workCenterId === params.workCenterId);
  });
  
  return {
    workCenterId: params.workCenterId || 'all',
    period: { start: params.startDate, end: params.endDate },
    theoreticalCapacity,
    usedCapacity,
    availableCapacity: typeof theoreticalCapacity === 'number' 
      ? theoreticalCapacity - usedCapacity 
      : 'Unknown',
    utilizationPercent: typeof theoreticalCapacity === 'number'
      ? (usedCapacity / theoreticalCapacity * 100).toFixed(2)
      : 'N/A',
    maintenanceEvents: maintenanceInPeriod.length,
    maintenanceImpact: maintenanceInPeriod.reduce((sum: number, m: any) => 
      sum + (m.downtime || 0), 0
    )
  };
});

export const analyzeEmployeeAvailabilityTool = ai.defineTool({
  name: 'analyzeEmployeeAvailability',
  description: 'Checks employee availability considering absences and shifts for a specific date.',
  inputSchema: z.object({
    date: z.string().optional().describe('Date in YYYY-MM-DD format (defaults to today)'),
    departmentId: z.string().optional().describe('Department ID to filter by')
  }),
}, async (params) => {
  const contextData = getRequestContext() || {};
  try {
    console.debug('[Tool analyzeEmployeeAvailability] context keys=', Object.keys(contextData || {}).join(','));
  } catch (e) { /* ignore */ }
  const employees = contextData.employeesFull || contextData.employeesSample || [];
  const absenteeism = contextData.absenteeismFull || contextData.absenteeismSample || [];
  const shifts = contextData.workShiftsFull || contextData.workShiftSample || [];
  
  const targetDate = params.date || new Date().toISOString().split('T')[0];
  
  // Filtrar ausencias para la fecha
  const absencesOnDate = absenteeism.filter((a: any) => {
    const absenceDate = new Date(a.fecha || a.date).toISOString().split('T')[0];
    return absenceDate === targetDate;
  });
  
  const absentEmployeeIds = absencesOnDate.map((a: any) => a.employeeId || a.empleadoId);
  
  // Calcular disponibles
  const availableEmployees = employees.filter((e: any) => 
    !absentEmployeeIds.includes(e.id || e.employeeId)
  );
  
  // Si hay departamento específico
  let departmentStats = null;
  if (params.departmentId) {
    const deptEmployees = availableEmployees.filter((e: any) => 
      e.departmentId === params.departmentId || e.department === params.departmentId
    );
    departmentStats = {
      departmentId: params.departmentId,
      available: deptEmployees.length,
      total: employees.filter((e: any) => 
        e.departmentId === params.departmentId || e.department === params.departmentId
      ).length
    };
  }
  
  return {
    date: targetDate,
    totalEmployees: employees.length,
    availableEmployees: availableEmployees.length,
    absentEmployees: absentEmployeeIds.length,
    availabilityPercent: ((availableEmployees.length / employees.length) * 100).toFixed(2),
    absenceReasons: absencesOnDate.map((a: any) => a.reason || a.tipo),
    departmentStats,
    shiftsScheduled: shifts.filter((s: any) => {
      const shiftDate = new Date(s.fecha || s.date).toISOString().split('T')[0];
      return shiftDate === targetDate;
    }).length
  };
});

export const analyzeBottlenecksTool = ai.defineTool({
  name: 'analyzeBottlenecks',
  description: 'Identifies production bottlenecks by analyzing work center utilization.',
  inputSchema: z.object({}),
}, async () => {
  const contextData = getRequestContext() || {};
  try {
    console.debug('[Tool analyzeBottlenecks] context keys=', Object.keys(contextData || {}).join(','));
  } catch (e) { /* ignore */ }
  const plan = contextData.productionPlanFull || contextData.productionPlanSample || [];
  const constraints = contextData.constraintsSummary || {};
  
  // Agrupar producción por centro de trabajo
  const utilizationByWorkCenter: Record<string, number> = {};
  
  plan.forEach((item: any) => {
    const wcId = item.workCenterId || item.centroTrabajo || 'unknown';
    utilizationByWorkCenter[wcId] = (utilizationByWorkCenter[wcId] || 0) + (item.quantity || 1);
  });
  
  // Identificar los más cargados
  const bottlenecks = Object.entries(utilizationByWorkCenter)
    .map(([wcId, load]) => ({ workCenterId: wcId, load }))
    .sort((a, b) => b.load - a.load)
    .slice(0, 5);
  
  return {
    topBottlenecks: bottlenecks,
    workCentersAnalyzed: Object.keys(utilizationByWorkCenter).length,
    totalWorkCenters: constraints.workCenters || 'Unknown',
    recommendation: bottlenecks.length > 0 
      ? `El centro de trabajo ${bottlenecks[0].workCenterId} tiene la mayor carga con ${bottlenecks[0].load} unidades.`
      : 'No se detectaron cuellos de botella significativos.'
  };
});

export const getSummaryStatsTool = ai.defineTool({
  name: 'getSummaryStats',
  description: 'Gets overall system statistics including sales, production, employees, maintenance counts and status.',
  inputSchema: z.object({}),
}, async () => {
  const contextData = getRequestContext() || {};
  try {
    console.debug('[Tool getSummaryStats] context keys=', Object.keys(contextData || {}).join(','));
  } catch (e) { /* ignore */ }
  return {
    sales: {
      total: contextData.salesDataSample?.length || 0,
      hasFullData: !!contextData.salesDataFull
    },
    production: {
      plannedItems: contextData.productionPlanSample?.length || 0,
      hasFullData: !!contextData.productionPlanFull
    },
    employees: {
      total: contextData.employeesSample?.length || 0,
      hasFullData: !!contextData.employeesFull
    },
    maintenance: {
      scheduledEvents: contextData.maintenanceSample?.length || 0,
      hasFullData: !!contextData.maintenanceFull
    },
    system: {
      syncStatus: contextData.syncStatus,
      planningProgress: contextData.planningProgress
    },
    constraints: contextData.constraintsSummary
  };
});

export const getOperationsSummaryTool = ai.defineTool({
  name: 'getOperationsSummary',
  description: 'Gets a detailed summary of all operations happening in the system including active, completed, and failed operations. Use this when the user asks "what are you doing?", "what\'s happening?", or wants to know about system operations.',
  inputSchema: z.object({
    section: z.string().optional().describe('Filter operations by section (e.g., DataImport, ProductionPlan, Constraints)')
  }),
}, async (params) => {
  const contextData = getRequestContext() || {};
  
  let operations = contextData.recentOperations || [];
  if (params.section) {
    operations = operations.filter((op: any) => op.section === params.section);
  }
  
  const activeOps = (contextData.activeOperations || []).map((op: any) => ({
    section: op.section,
    type: op.type,
    description: op.description,
    status: op.status,
    startTime: op.timestamp
  }));
  
  const summary = contextData.operationsSummary || {
    total: 0,
    active: 0,
    completed: 0,
    failed: 0,
    bySection: {}
  };
  
  return {
    summary,
    activeOperations: activeOps,
    recentOperations: operations.slice(-10).map((op: any) => ({
      section: op.section,
      type: op.type,
      description: op.description,
      status: op.status,
      duration: op.duration,
      error: op.error,
      timestamp: op.timestamp
    }))
  };
});

export const inspectVariablesTool = ai.defineTool({
  name: 'inspectVariables',
  description: 'Inspects runtime variables and their values in a specific section or across the entire system. Use this when the user asks "what is the value of X?", "show me the variables", "what data do you have?", or wants to debug specific variables.',
  inputSchema: z.object({
    section: z.string().optional().describe('Filter variables by section (e.g., DataImport, ProductionPlan)'),
    variableName: z.string().optional().describe('Search for specific variable by name (partial match)'),
    limit: z.number().optional().describe('Limit number of results (default 20)')
  }),
}, async (params) => {
  const limit = params.limit || 20;
  
  let variables;
  if (params.variableName) {
    variables = runtimeInspector.searchVariables(params.variableName, params.section);
  } else {
    variables = runtimeInspector.getVariables(params.section, limit);
  }
  
  return {
    totalFound: variables.length,
    variables: variables.slice(-limit).map(v => ({
      section: v.section,
      scope: v.scope,
      name: v.name,
      value: v.value,
      type: v.type,
      timestamp: v.timestamp,
      metadata: v.metadata
    }))
  };
});

export const inspectExecutionContextTool = ai.defineTool({
  name: 'inspectExecutionContext',
  description: 'Inspects the execution context of operations including inputs, outputs, and stack traces. Use this when the user asks "what happened?", "why did this fail?", "show me the execution details", or wants to debug operations.',
  inputSchema: z.object({
    section: z.string().optional().describe('Filter by section'),
    limit: z.number().optional().describe('Limit number of results (default 10)')
  }),
}, async (params) => {
  const limit = params.limit || 10;
  const contexts = runtimeInspector.getContexts(params.section, limit);
  const activeContexts = runtimeInspector.getActiveContexts();
  
  return {
    activeContexts: activeContexts.map(ctx => ({
      section: ctx.section,
      action: ctx.action,
      status: ctx.status,
      inputs: ctx.inputs,
      startTime: ctx.timestamp,
      duration: ctx.duration
    })),
    recentContexts: contexts.map(ctx => ({
      section: ctx.section,
      action: ctx.action,
      status: ctx.status,
      inputs: ctx.inputs,
      outputs: ctx.outputs,
      error: ctx.error,
      stackTrace: ctx.stackTrace,
      duration: ctx.duration,
      timestamp: ctx.timestamp
    }))
  };
});

export const inspectStateTool = ai.defineTool({
  name: 'inspectState',
  description: 'Inspects the current state of components including their props and computed values. Use this when the user asks "what is the current state?", "show me the component state", or wants to see the full application state.',
  inputSchema: z.object({
    section: z.string().optional().describe('Specific section to inspect (optional, shows all if not provided)')
  }),
}, async (params) => {
  if (params.section) {
    const state = runtimeInspector.getState(params.section);
    if (!state) {
      return {
        found: false,
        message: `No state found for section: ${params.section}`
      };
    }
    return {
      found: true,
      section: params.section,
      timestamp: state.timestamp,
      state: state.state,
      props: state.props,
      computed: state.computed
    };
  }
  
  // Obtener todos los estados
  const allStates = runtimeInspector.getAllStates();
  const summary = runtimeInspector.getSummary();
  
  return {
    found: true,
    sections: Object.keys(allStates),
    totalVariables: summary.totalVariables,
    totalContexts: summary.totalContexts,
    activeContexts: summary.activeContexts,
    states: Object.entries(allStates).map(([section, state]) => ({
      section,
      timestamp: state.timestamp,
      stateKeys: Object.keys(state.state || {}),
      propsKeys: Object.keys(state.props || {}),
      computedKeys: Object.keys(state.computed || {})
    })),
    recentActivity: summary.recentActivity
  };
});

export const getDataFromStoreTool = ai.defineTool({
  name: 'getDataFromStore',
  description: `Access data from the centralized DataStore. Use this to retrieve:
- salesData: Budget/sales data with products, quantities, amounts
- constraints: Production constraints including productionLines (with workCenter info), workstationDefinitions, holidays
- productionPlan: Generated production plans (monthly, weekly, daily)
- employees: Employee list
- employeeSkills: Employee skills and qualifications
- maintenanceEvents: Maintenance schedules
- absenteeismEvents: Employee absence records
- workShifts: Work shift schedules

When user asks about "lines", "production lines", "work centers", use key='constraints' and access the productionLines array.`,
  inputSchema: z.object({
    key: z.string().optional().describe('Specific data key to retrieve (salesData, constraints, productionPlan, employees, employeeSkills, maintenanceEvents, absenteeismEvents, workShifts). If omitted, returns summary of all available data.'),
    limit: z.number().optional().describe('Limit number of records returned (default 10, max 100)'),
    filter: z.string().optional().describe('Optional filter criteria (e.g., "workCenterId=1000" to filter production lines by center)')
  }),
}, async (params) => {
  const limit = Math.min(params.limit || 10, 100);
  
  if (params.key) {
    // Obtener datos específicos
    const snapshot = dataStore.getData(params.key);
    
    if (!snapshot) {
      return {
        found: false,
        message: `No data found for key: ${params.key}. Available keys: ${dataStore.getSummary().availableKeys.join(', ')}`
      };
    }
    
    let dataToReturn = snapshot.data;
    
    // Aplicar filtros especiales para constraints.productionLines
    if (params.key === 'constraints' && params.filter && dataToReturn.productionLines) {
      const filterMatch = params.filter.match(/workCenterId=(\w+)/);
      if (filterMatch) {
        const centerId = filterMatch[1];
        const filteredLines = dataToReturn.productionLines.filter((line: any) => line.workCenterId === centerId);
        return {
          found: true,
          key: params.key,
          timestamp: snapshot.timestamp,
          source: snapshot.source,
          filtered: true,
          filterCriteria: params.filter,
          data: {
            productionLines: filteredLines,
            totalLines: filteredLines.length,
            workCenterId: centerId,
            lineNames: filteredLines.map((l: any) => l.name),
            lineIds: filteredLines.map((l: any) => l.id)
          }
        };
      }
    }
    
    // Si es constraints, proporcionar estructura útil
    if (params.key === 'constraints' && dataToReturn.productionLines) {
      const lines = dataToReturn.productionLines;
      return {
        found: true,
        key: params.key,
        timestamp: snapshot.timestamp,
        source: snapshot.source,
        data: {
          productionLines: lines.slice(0, limit),
          totalProductionLines: lines.length,
          workstationDefinitions: dataToReturn.workstationDefinitions?.length || 0,
          workCenters: dataToReturn.workCenters?.length || 0,
          linesByCenter: lines.reduce((acc: any, line: any) => {
            const center = line.workCenterId || 'unknown';
            if (!acc[center]) acc[center] = [];
            acc[center].push({ id: line.id, name: line.name, processType: line.processType });
            return acc;
          }, {}),
          sampleLines: lines.slice(0, 5).map((l: any) => ({
            id: l.id,
            name: l.name,
            workCenterId: l.workCenterId,
            processType: l.processType,
            isActive: l.isActive
          }))
        }
      };
    }
    
    // Limitar si es array
    if (Array.isArray(dataToReturn) && dataToReturn.length > limit) {
      dataToReturn = {
        totalRecords: dataToReturn.length,
        showing: limit,
        sample: dataToReturn.slice(0, limit),
        note: `Showing ${limit} of ${dataToReturn.length} records`
      };
    }
    
    return {
      found: true,
      key: params.key,
      timestamp: snapshot.timestamp,
      source: snapshot.source,
      metadata: snapshot.metadata,
      data: dataToReturn
    };
  }
  
  // Retornar resumen de todos los datos
  const summary = dataStore.getSummary();
  
  return {
    found: true,
    summary: {
      availableKeys: summary.availableKeys,
      totalDatasets: summary.availableKeys.length,
      datasets: summary.dataByKey
    },
    message: `Available datasets: ${summary.availableKeys.join(', ')}. Use this tool again with a specific key to get the data.`
  };
});

// Export all tools as an array for easy usage
export const analysisTools = [
  analyzeSalesTool,
  analyzeProductionCapacityTool,
  analyzeEmployeeAvailabilityTool,
  analyzeBottlenecksTool,
  getSummaryStatsTool,
  getOperationsSummaryTool,
  inspectVariablesTool,
  inspectExecutionContextTool,
  inspectStateTool,
  getDataFromStoreTool  // Nueva herramienta principal para acceder a datos
];
