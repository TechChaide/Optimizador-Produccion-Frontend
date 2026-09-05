

import { 
    SalesDataRow, AppConstraints, ProductionPlan, ProductionPlanItem, 
    ProductProcessInfo, WorkCenter, ProductionLine, LaborCostSettings, InventorySetting, Holiday,
    MonthlyInventoryState, ProcessType, WorkstationDefinition,
    SupplyInfo, MonthlyProductionPlanItem, NotificationMessage, LineMonthlySummary, 
    TacticalRequest, TacticalPlanResult, TacticalOrderItem, ProvisionalOrder, Employee, EmployeeSkill, MaintenanceEvent, AbsenteeismEvent, AssignedPersonnel, ShiftParameters,
    Machine, Qualification, TiempoEnsambleItem, DetailedProductionPlan, PlanningGroupMonthlyDetail, MonthlyNeed, MonthlyAssignment, PresupuestoItem,
    PlanningProgress, WeeklyPlanItem, DemandAnalysisResult, CuboInventariosItem, ShiftConfigRow
} from '@/types/types';
import { MONTH_NAMES, PROCESS_TYPE_OPTIONS, HOLIDAY_APPLIES_TO_OPTIONS, HOLIDAY_DAY_TYPE_OPTIONS } from '@/constants/constants'; 
import { queryApi } from '@/hooks/useApiData';
import { logger } from './LogService';

declare var XLSX: any; 

const normalizeMaterialCode = (code: string | number): string => {
    const codeStr = String(code);
    // Ensure it's padded to 8 digits for internal consistency if needed, though slicing seems to be the main logic.
    return codeStr.slice(-8);
};

export const analyzeSalesDemand = async (
    salesData: SalesDataRow[],
    cuboInventariosData: CuboInventariosItem[],
    constraints: AppConstraints,
    inventoryFilters: { centros: string[]; sectores: string[] }
): Promise<DemandAnalysisResult> => {
    const auditLog: string[] = [];
    auditLog.push(`[${new Date().toLocaleTimeString()}] Iniciando análisis de demanda con ${salesData.length} registros de venta y ${cuboInventariosData.length} registros de CuboInventarios.`);
    
    // --- UNIVERSAL SETUP ---
    const allProductCenterPairs = new Set<string>();
    const initialInventoryState = new Map<string, number>();
    const safetyStockState = new Map<string, number>();

    // 1. Populate inventory and safety stock from CuboInventarios
    cuboInventariosData.forEach(item => {
        if(item.Material && item.Centro) {
            const stock = Number(item.StockActual) || 0;
            const safety = Number(item.StockSeguridad) || 0;
            const productId = normalizeMaterialCode(item.Material);
            const centerId = String(item.Centro).trim();
            const key = `${productId}---${centerId}`;

            allProductCenterPairs.add(key);
            if (stock > 0) {
                initialInventoryState.set(key, (initialInventoryState.get(key) || 0) + stock);
            }
            if (safety > 0) {
                safetyStockState.set(key, (safetyStockState.get(key) || 0) + safety);
            }
        }
    });

    // 2. Populate demand from salesData
    const firstMonthKey = salesData.length > 0 ? `${salesData[0].año}-${String(salesData[0].mes).padStart(2, '0')}` : null;
    if (!firstMonthKey) {
        return { totalDemand: 0, demandByGroup: [], unclassifiedMaterials: [], auditLog: ['No sales data found'], transfers: [], productionNeedsFirstMonth: [] };
    }
    
    const salesInFirstMonth = salesData.filter(s => `${s.año}-${String(s.mes).padStart(2, '0')}` === firstMonthKey);
    const demandFirstMonth = new Map<string, number>();
    salesInFirstMonth.forEach(row => {
        const key = `${normalizeMaterialCode(row.código)}---${String(row.centro).trim()}`;
        demandFirstMonth.set(key, (demandFirstMonth.get(key) || 0) + row.unidadesProyectado);
        allProductCenterPairs.add(key);
    });

    // Pre-index cuboInventariosData y salesInFirstMonth para eliminar .find() en loops
    const cuboByKey = new Map<string, CuboInventariosItem>();
    const cuboBy1000 = new Map<string, CuboInventariosItem>();
    cuboInventariosData.forEach(item => {
        if (item.Material && item.Centro) {
            const pId = normalizeMaterialCode(item.Material);
            const cId = String(item.Centro).trim();
            const k = `${pId}---${cId}`;
            if (!cuboByKey.has(k)) cuboByKey.set(k, item);
            if (cId === '1000' && !cuboBy1000.has(pId)) cuboBy1000.set(pId, item);
        }
    });
    const salesFirstMonthByKey = new Map<string, SalesDataRow>();
    const salesFirstMonthByProductId = new Map<string, SalesDataRow>();
    salesInFirstMonth.forEach(s => {
        const k = `${normalizeMaterialCode(s.código)}---${s.centro.trim()}`;
        if (!salesFirstMonthByKey.has(k)) salesFirstMonthByKey.set(k, s);
        if (!salesFirstMonthByProductId.has(normalizeMaterialCode(s.código))) salesFirstMonthByProductId.set(normalizeMaterialCode(s.código), s);
    });
    const ppiByProductIdDemand = new Map(constraints.productProcessInfos.map(p => [p.productId, p]));

    // --- STEP 1: DEMANDA BRUTA (Para tabla del Paso 1) ---
    const demandByGroupMap = new Map<string, {
        claseAprovisionamiento: 'E' | 'X' | 'F' | 'N/A';
        centro: string;
        sector: string;
        totalUnidades: number;
        producingCenter: string;
    }>();
    const unclassifiedMaterials: DemandAnalysisResult['unclassifiedMaterials'] = [];

    demandFirstMonth.forEach((totalUnidades, key) => {
        const [productId, centerId] = key.split('---');
        const saleRow = salesFirstMonthByKey.get(key)!;
        const sector = saleRow?.sector || 'Sin Sector';

        let claseAprovisionamiento: 'E' | 'X' | 'F' | 'N/A' = 'N/A';
        const primaryEntry = cuboByKey.get(key);
        const fallbackEntry = cuboBy1000.get(productId);

        if (primaryEntry && primaryEntry.ClaseAprovisionam) {
            claseAprovisionamiento = primaryEntry.ClaseAprovisionam;
        } else if (centerId !== '1000' && fallbackEntry && fallbackEntry.ClaseAprovisionam === 'F') {
            claseAprovisionamiento = 'F';
        } else if (String(saleRow.código).startsWith('3') || String(saleRow.código).startsWith('4')) {
             unclassifiedMaterials.push({
                productId: saleRow.código,
                productName: saleRow.descripciónMaterial,
                centerId: centerId,
                sector: sector,
                demand: totalUnidades
            });
        }
        
        if (claseAprovisionamiento !== 'N/A') {
            const producingCenter = claseAprovisionamiento === 'F' ? '1000' : centerId;
            const groupKey = `${claseAprovisionamiento}-${centerId}-${sector}-${producingCenter}`;
            if (!demandByGroupMap.has(groupKey)) {
                demandByGroupMap.set(groupKey, { claseAprovisionamiento, centro: centerId, sector, totalUnidades: 0, producingCenter });
            }
            demandByGroupMap.get(groupKey)!.totalUnidades += totalUnidades;
        }
    });
    
    const demandByGroup = Array.from(demandByGroupMap.values())
        .sort((a, b) => a.producingCenter.localeCompare(b.producingCenter) || a.sector.localeCompare(b.sector));

    // --- STEP 2: NECESIDAD NETA DE PRODUCCIÓN (Para tabla del Paso 2) ---
    const productionNeedsFirstMonth: DemandAnalysisResult['productionNeedsFirstMonth'] = [];

    allProductCenterPairs.forEach(key => {
        const [productId, demandCenterId] = key.split('---');
        const demand = demandFirstMonth.get(key) || 0;
        const initialStock = initialInventoryState.get(key) || 0;
        const safetyStock = safetyStockState.get(key) || 0;

        const netNeed = Math.max(0, demand + safetyStock - initialStock);

        if (netNeed > 0) {
            const saleRow = salesFirstMonthByProductId.get(productId);
            const sector = saleRow?.sector || 'Sin Sector';
            const primaryEntry = cuboByKey.get(key);
            const fallbackEntry = cuboBy1000.get(productId);

            let claseAprovisionamiento: 'E' | 'X' | 'F' | 'N/A' = 'N/A';
            if (primaryEntry && primaryEntry.ClaseAprovisionam) {
                claseAprovisionamiento = primaryEntry.ClaseAprovisionam;
            } else if (demandCenterId !== '1000' && fallbackEntry && fallbackEntry.ClaseAprovisionam === 'F') {
                claseAprovisionamiento = 'F';
            }

            if (claseAprovisionamiento !== 'N/A') {
                 const ppi = ppiByProductIdDemand.get(productId);
                 const requiredHours = (ppi?.totalManufacturingTimeHours || 0) * netNeed;
                 
                 productionNeedsFirstMonth.push({
                    producingCenterId: claseAprovisionamiento === 'F' ? '1000' : demandCenterId,
                    sector,
                    claseAprovisionamiento,
                    totalUnits: netNeed,
                    requiredHours: requiredHours,
                 });
            }
        }
    });
    
    // Agrupar las necesidades de producción para la vista del Paso 2
    const finalProductionNeeds = Array.from(
        productionNeedsFirstMonth.reduce((map, item) => {
            const groupKey = `${item.producingCenterId}-${item.sector}-${item.claseAprovisionamiento}`;
            const existing = map.get(groupKey);
            if(existing) {
                existing.totalUnits += item.totalUnits;
                existing.requiredHours += item.requiredHours;
            } else {
                map.set(groupKey, { ...item });
            }
            return map;
        }, new Map<string, any>()).values()
    ).sort((a, b) => a.producingCenterId.localeCompare(b.producingCenterId) || a.sector.localeCompare(b.sector));
    
    auditLog.push(`[${new Date().toLocaleTimeString()}] Análisis de demanda completado.`);
    
    return {
        totalDemand: salesInFirstMonth.reduce((sum, row) => sum + row.unidadesProyectado, 0),
        demandByGroup,
        unclassifiedMaterials,
        auditLog,
        transfers: [], // Lógica de transfers se maneja en el planificador principal
        productionNeedsFirstMonth: finalProductionNeeds
    };
};

export function processAndValidateAssemblyData(
    apiData: TiempoEnsambleItem[],
    currentConstraints: AppConstraints,
): {
    newConstraints: AppConstraints,
    validationErrors: string[],
    dataCompletenessErrors: string[]
} {
    const timestamp = new Date().toLocaleTimeString();
    logger.log(`[${timestamp}] --- INICIANDO PROCESAMIENTO Y VALIDACIÓN DE DATOS DE ENSAMBLE --- (Datos recibidos: ${apiData.length})`, 'info');
    const validationErrors: string[] = [];
    const dataCompletenessErrors: string[] = [];
    
    apiData.forEach((row, index) => {
        if (!row.CodMaterial) dataCompletenessErrors.push(`Fila API ${index + 1}: Falta 'CodMaterial'.`);
        if (!row.Centro) dataCompletenessErrors.push(`Fila API ${index + 1} (Mat: ${row.CodMaterial}): Falta 'Centro'.`);
        if (!row.Linea) dataCompletenessErrors.push(`Fila API ${index + 1} (Mat: ${row.CodMaterial}): Falta 'Linea'.`);
        if (!row.PuestoTrabajo) dataCompletenessErrors.push(`Fila API ${index + 1} (Mat: ${row.CodMaterial}): Falta 'PuestoTrabajo'.`);
        if (row.Tiempo === null || row.Tiempo === undefined) dataCompletenessErrors.push(`Fila API ${index + 1} (Mat: ${row.CodMaterial}): Falta 'Tiempo'.`);
        if (row.ClaseAprovisionamiento === null || row.ClaseAprovisionamiento === undefined) {
          // No es un error fatal, pero se puede loguear si se desea
          // logger.log(`Fila API ${index+1} (Mat: ${row.CodMaterial}) no tiene ClaseAprovisionamiento.`, 'warning');
        }
    });

    if (dataCompletenessErrors.length > 0) {
        logger.log(`[${timestamp}] [VALIDATION ERRORS] Errores de completitud de datos: ${dataCompletenessErrors.join(', ')}`, 'error');
        return { newConstraints: currentConstraints, validationErrors, dataCompletenessErrors };
    }

    // Pre-index apiData para eliminar búsquedas O(n) en loops anidados
    const apiByLineKey = new Map<string, TiempoEnsambleItem[]>();
    const apiByProductCenter = new Map<string, TiempoEnsambleItem[]>();
    const apiByCompositeKey = new Map<string, TiempoEnsambleItem>();
    apiData.forEach(row => {
        const centerId = String(row.Centro).trim();
        const lineName = String(row.Linea).trim();
        const productId = normalizeMaterialCode(row.CodMaterial);
        const wsName = String(row.PuestoTrabajo).trim();
        const lineKey = `${centerId}---${lineName}`;
        if (!apiByLineKey.has(lineKey)) apiByLineKey.set(lineKey, []);
        apiByLineKey.get(lineKey)!.push(row);
        const pcKey = `${productId}---${centerId}`;
        if (!apiByProductCenter.has(pcKey)) apiByProductCenter.set(pcKey, []);
        apiByProductCenter.get(pcKey)!.push(row);
        apiByCompositeKey.set(`${centerId}---${lineName}---${productId}---${wsName}`, row);
    });

    const discoveredWorkCenters = new Map<string, WorkCenter>();
    const discoveredLines = new Map<string, ProductionLine>();
    const discoveredWorkstations = new Map<string, WorkstationDefinition>();
    const productProcessInfos: ProductProcessInfo[] = [];

    apiData.forEach(row => {
        const centerId = String(row.Centro).trim();
        if (!discoveredWorkCenters.has(centerId)) {
            discoveredWorkCenters.set(centerId, { id: centerId, name: `Planta ${centerId}`, productionLineIds: [], isActive: true });
        }

        const workstationName = String(row.PuestoTrabajo).trim();
        const workstationId = `wd---${centerId}---${workstationName}`;
        if (!discoveredWorkstations.has(workstationId)) {
            discoveredWorkstations.set(workstationId, { id: workstationId, name: workstationName, employeesPerWorkstation: 1, machineCode: null, isActive: true });
        }

        const lineName = String(row.Linea).trim();
        const lineId = `pl---${centerId}---${lineName}`;
        if (!discoveredLines.has(lineId)) {
             const userEditedLine = currentConstraints.productionLines.find(l => l.id === lineId);
            discoveredLines.set(lineId, {
                id: lineId, name: lineName, workCenterId: centerId,
                processType: userEditedLine?.processType || 'Colchones',
                assignedWorkstations: [], capacity: { maxUnitsPerHour: 0, normalUnitsPerHour: 0, minUnitsPerHour: 0 },
                materialsHandled: [], isActive: true
            });
            const center = discoveredWorkCenters.get(centerId);
            if (center && !center.productionLineIds.includes(lineId)) center.productionLineIds.push(lineId);
        }
    });
    
    discoveredLines.forEach(line => {
        const workstationIdsForLine = new Set<string>();
        const lineRows = apiByLineKey.get(`${line.workCenterId}---${line.name}`) || [];
        lineRows.forEach(row => {
            const workstationName = String(row.PuestoTrabajo).trim();
            const workstationId = `wd---${line.workCenterId}---${workstationName}`;
            workstationIdsForLine.add(workstationId);
        });
        
        line.assignedWorkstations = Array.from(workstationIdsForLine).map(wsId => ({
            definitionId: wsId,
            quantity: 1 
        }));
    });
    
    discoveredLines.forEach(line => {
        const predefinedQuantities = getPredefinedQuantities(line.workCenterId, line.name);
        const userEditedLine = currentConstraints.productionLines.find(l => l.id === line.id);
        
        line.assignedWorkstations.forEach(as => {
            const predefined = predefinedQuantities.find(p => p.definitionId === as.definitionId);
            const userDefined = userEditedLine?.assignedWorkstations.find(u => u.definitionId === as.definitionId);
            
            if (userDefined) {
                as.quantity = userDefined.quantity;
            } else if (predefined) {
                as.quantity = predefined.quantity;
            } else {
                as.quantity = 1;
            }
        });
    });
    
    const uniqueProductLinePairs = new Set<string>();
    apiData.forEach(row => {
        const productId = normalizeMaterialCode(row.CodMaterial);
        const centerId = String(row.Centro).trim();
        const lineName = String(row.Linea).trim();
        const lineId = `pl---${centerId}---${lineName}`;
        uniqueProductLinePairs.add(`${productId}---${lineId}`);
    });
    
    uniqueProductLinePairs.forEach(pairKey => {
        const [productId, lineId] = pairKey.split('---');
        const line = discoveredLines.get(lineId);
        if (!line) return;

        const workstationTimes: { workstationDefinitionId: string; timeHours: number }[] = [];
        let totalManufacturingTimeHours = 0;
        
        const workstationDefsForLine = line.assignedWorkstations.map(as => discoveredWorkstations.get(as.definitionId)).filter(Boolean) as WorkstationDefinition[];

        for (const workstationDef of workstationDefsForLine) {
            const apiRow = apiByCompositeKey.get(
                `${line.workCenterId}---${line.name}---${productId}---${workstationDef.name}`
            );

            if (apiRow && apiRow.Tiempo > 0) {
                const assignedWs = line.assignedWorkstations.find(as => as.definitionId === workstationDef.id);
                const quantity = assignedWs?.quantity || 1;
                const timePerPost = apiRow.Tiempo / (quantity > 0 ? quantity : 1);
                workstationTimes.push({ workstationDefinitionId: workstationDef.id, timeHours: timePerPost / 60 });
            }
        }
        
        if (workstationTimes.length > 0) {
            totalManufacturingTimeHours = Math.max(...workstationTimes.map(wt => wt.timeHours));
        }

        const representativeRow = apiByProductCenter.get(`${productId}---${line.workCenterId}`)?.[0];

        productProcessInfos.push({
            id: `${productId}---${lineId}`,
            productId: productId,
            productName: representativeRow?.Material,
            productionLineId: lineId,
            workstationTimes: workstationTimes,
            totalManufacturingTimeHours: totalManufacturingTimeHours,
            ClaseAprovisionamiento: representativeRow?.ClaseAprovisionamiento || undefined
        });
    });


    const finalLines = Array.from(discoveredLines.values());
    const inventorySettings: InventorySetting[] = [];
    const uniqueProductCenterPairsForInv = new Set(apiData.map(row => `${normalizeMaterialCode(row.CodMaterial)}---${String(row.Centro).trim()}`));
    
    uniqueProductCenterPairsForInv.forEach(pairKey => {
        const [productId, centerId] = pairKey.split('---');
        const rowsForPair = apiByProductCenter.get(pairKey) || [];
        
        const inventoryDataSource = rowsForPair.find(r => r.StockSeguridad || r.StockMaximo) || rowsForPair[0];
        if (inventoryDataSource) {
             inventorySettings.push({
                id: pairKey, itemId: productId, itemName: productId, centerId: centerId, isRawMaterial: false,
                minStock: parseInt(String(inventoryDataSource.StockSeguridad || 0), 10),
                maxStock: parseInt(String(inventoryDataSource.StockMaximo || 0), 10),
                currentStock: 0, 
                lotMin: parseInt(String(inventoryDataSource.TamLoteMin || 1), 10) || 1,
                lotMax: inventoryDataSource.TamLoteMax ? parseInt(String(inventoryDataSource.TamLoteMax), 10) : null,
            });
        }

        rowsForPair.forEach(row => {
            const lineName = String(row.Linea).trim();
            const lineId = `pl---${centerId}---${lineName}`;
            const line = finalLines.find(l => l.id === lineId);
            if (line && !line.materialsHandled.includes(productId)) {
                line.materialsHandled.push(productId);
            }
        });
    });

    if (discoveredWorkCenters.size === 0 || discoveredLines.size === 0) {
        const structuralError = "Error Crítico: No se pudo descubrir ninguna estructura de producción (Centros o Líneas) a partir de los datos. Revise la fuente de datos 'TiemposEnsamblado'.";
        validationErrors.push(structuralError);
        logger.log(`[${timestamp}] [STRUCTURE ERROR] ${structuralError}`, 'error');
        return { newConstraints: currentConstraints, validationErrors, dataCompletenessErrors };
    }

    const newConstraints: AppConstraints = {
        ...currentConstraints,
        workCenters: Array.from(discoveredWorkCenters.values()),
        productionLines: finalLines,
        workstationDefinitions: Array.from(discoveredWorkstations.values()),
        productProcessInfos: productProcessInfos, 
        inventorySettings: inventorySettings, 
    };
    logger.log(`[${timestamp}] Procesamiento y validación completados. Centros: ${discoveredWorkCenters.size}, Líneas: ${discoveredLines.size}, Puestos: ${discoveredWorkstations.size}, Inventario: ${inventorySettings.length}`, 'success');
    return { newConstraints, validationErrors: [], dataCompletenessErrors: [] };
}

function getPredefinedQuantities(centerId: string, lineName: string): Array<{ definitionId: string; quantity: number }> {
    const quantities: { [key: string]: { [key: string]: { [key: string]: number } } } = {
        '1000': { 
            'LINEA 1': { 'Armado': 12, 'Cerrado L1': 6 },
            'LINEA 2': { 'Armado': 6, 'Pegado1 L2': 2, 'Pegado2 L2': 2, 'Cerrado1 L2': 4, 'Cerrado2 L2': 4 },
            'LINEA 3': { 'Armado': 2 },
            'LINEA 5': { 'Armado': 2 }
        },
        '2000': {
            'LINEA 1': { 'Armado': 8, 'Cerrado L1': 6 },
            'LINEA 2': { 'Armado': 4, 'Pegado1 L2': 2, 'Cerrado1 L2': 2, 'Cerrado2 L2': 2 },
            'LINEA 5': { 'Armado': 3 }
        }
    };

    const centerConfig = quantities[centerId];
    if (centerConfig && centerConfig[lineName]) {
        return Object.entries(centerConfig[lineName]).map(([wsName, qty]) => ({
            definitionId: `wd---${centerId}---${wsName}`,
            quantity: qty
        }));
    }
    return [];
}

export const getMonthlyCapacityDetails = (year: number, month: number, constraints: AppConstraints) => {
    const daysInMonth = new Date(year, month, 0).getDate();
    let workingWeekdays = 0;
    let workingSaturdays = 0;

    const holidayByDate = new Map(constraints.holidays.map(h => [h.date, h]));

    for (let day = 1; day <= daysInMonth; day++) {
        const date = new Date(year, month - 1, day);
        const dayOfWeek = date.getDay();
        const yy = date.getFullYear();
        const mm = String(date.getMonth() + 1).padStart(2, '0');
        const dd = String(date.getDate()).padStart(2, '0');
        const holiday = holidayByDate.get(`${yy}-${mm}-${dd}`);

        if (holiday && holiday.dayType === 'asueto') continue;

        if (dayOfWeek >= 1 && dayOfWeek <= 5) {
             if (!holiday || holiday.isProductionAllowed) workingWeekdays++;
        } else if (dayOfWeek === 6) {
            if (!holiday || holiday.isProductionAllowed) workingSaturdays++;
        }
    }
    return { workingWeekdays, workingSaturdays };
};

export const getLineCapacity = (line: ProductionLine, year: number, month: number, constraints: AppConstraints): number => {
    const { workingWeekdays, workingSaturdays } = getMonthlyCapacityDetails(year, month, constraints);
    const { regularHoursPerDay, extraHoursPerDay, saturdayAndHolidayHours } = constraints.shiftParameters;
    const totalHours = (workingWeekdays * (regularHoursPerDay + extraHoursPerDay)) + (workingSaturdays * saturdayAndHolidayHours);
    return totalHours * 0.87; // Assuming 87% efficiency
};


export const generateProductionPlan = async (
    planningYear: number, 
    constraints: AppConstraints, 
    apiData: TiempoEnsambleItem[], 
    cuboInventariosData: CuboInventariosItem[],
    salesData: SalesDataRow[],
    prorateCurrentMonth: boolean,
    onProgress: (progress: PlanningProgress | null) => void
): Promise<ProductionPlan> => {
    
    const auditLog: string[] = [];
    const finalProrateCurrentMonth = false; 
    logger.log(`--- INICIANDO GENERACIÓN DE PLAN DE PRODUCCIÓN (Prorrateo forzado a: ${finalProrateCurrentMonth}) ---`, 'info');
    auditLog.push(`[${new Date().toLocaleTimeString()}] INICIO: Generación de plan (Prorrateo mes actual forzado a: ${finalProrateCurrentMonth}).`);

    const { holidays, productionLines, workstationDefinitions, shiftParameters, laborCostFactors, globalBaseCostPerHour } = constraints;

    if (salesData.length === 0) {
        auditLog.push(`Error: No hay datos de ventas para planificar.`);
        return { dailyPlan: [], monthlyPlan: [], weeklyPlan: [], auditLog };
    }
     if (!laborCostFactors || !globalBaseCostPerHour || !shiftParameters) {
        auditLog.push(`Error: No se han definido los parámetros de costo laboral o turnos.`);
        return { dailyPlan: [], monthlyPlan: [], weeklyPlan: [], auditLog };
    }

    const initialInventoryState = new Map<string, number>(); 
    
    if (cuboInventariosData) {
        cuboInventariosData.forEach((inv: any) => {
            if(inv.Material && inv.Centro && inv.StockActual) {
                const stock = Number(inv.StockActual);
                if (stock > 0) {
                    const productId = normalizeMaterialCode(inv.Material);
                    const centerId = String(inv.Centro).trim();
                    const key = `${productId}---${centerId}`;
                    initialInventoryState.set(key, (initialInventoryState.get(key) || 0) + stock);
                }
            }
        });
        const logMsg = `Inventario inicial cargado desde CuboInventarios. Se encontraron ${initialInventoryState.size} pares producto-centro con stock.`;
        auditLog.push(`[${new Date().toLocaleTimeString()}] INFO: ${logMsg}`);
    }

    let inventoryState = new Map(initialInventoryState);
    const monthlyPlanItems: MonthlyProductionPlanItem[] = [];
    
    const plannableMaterialCodes = new Set(apiData.map(item => normalizeMaterialCode(item.CodMaterial)));
    const filteredSalesData = salesData.filter(sale => plannableMaterialCodes.has(normalizeMaterialCode(sale.código)));
    const allMonthKeys = new Set<string>();
    filteredSalesData.forEach(s => allMonthKeys.add(`${s.año}-${String(s.mes).padStart(2, '0')}`));
    const planningMonths = Array.from(allMonthKeys).sort();
    
    const horizonMsg = `Horizonte de planificación: ${planningMonths.length > 0 ? `${planningMonths[0]} a ${planningMonths[planningMonths.length-1]}` : 'Ninguno'}`;
    auditLog.push(`[${new Date().toLocaleTimeString()}] INFO: ${horizonMsg}`);

    // Pre-index para lookups O(1) en loops internos
    const ppiByProductId = new Map(constraints.productProcessInfos.map(p => [p.productId, p]));
    const ppiByKey = new Map(constraints.productProcessInfos.map(p => [`${p.productId}---${p.productionLineId}`, p]));
    const salesByProductId = new Map<string, SalesDataRow>();
    salesData.forEach(s => salesByProductId.set(normalizeMaterialCode(s.código), s));
    const productsByLine = new Map<string, Set<string>>();
    constraints.productProcessInfos.forEach(ppi => {
        if (!productsByLine.has(ppi.productionLineId)) productsByLine.set(ppi.productionLineId, new Set());
        productsByLine.get(ppi.productionLineId)!.add(ppi.productId);
    });
    const salesByMonth = new Map<string, SalesDataRow[]>();
    filteredSalesData.forEach(s => {
        const key = `${s.año}-${String(s.mes).padStart(2, '0')}`;
        if (!salesByMonth.has(key)) salesByMonth.set(key, []);
        salesByMonth.get(key)!.push(s);
    });
    const inventorySettingsById = new Map(constraints.inventorySettings.map(s => [s.id, s]));

    for (let i = 0; i < planningMonths.length; i++) {
        const monthKey = planningMonths[i];
        const [year, monthNum] = monthKey.split('-').map(Number);

        onProgress({ message: `Planificando mes ${monthNum}...`, step: 'monthly', current: i + 1, total: planningMonths.length });
        auditLog.push(`\n[${new Date().toLocaleTimeString()}] --- Planificando Mes ${monthNum}/${year} ---`);

        const salesThisMonth = salesByMonth.get(monthKey) || [];

        const salesThisMonthByKey = new Map<string, number>();
        const salesDescByProductId = new Map<string, string>();
        salesThisMonth.forEach(s => {
            const key = `${normalizeMaterialCode(s.código)}---${s.centro.trim()}`;
            salesThisMonthByKey.set(key, (salesThisMonthByKey.get(key) || 0) + s.unidadesProyectado);
            if (s.descripciónMaterial) salesDescByProductId.set(normalizeMaterialCode(s.código), s.descripciónMaterial);
        });

        const productionNeedsByCenter = new Map<string, { needs: { productId: string; demandCenterId: string; units: number }[], totalHoursNeeded: number }>();
        const allProductDemandPairsThisMonth = new Set(salesThisMonth.map(s => `${normalizeMaterialCode(s.código)}---${s.centro.trim()}`));

        allProductDemandPairsThisMonth.forEach(pairKey => {
            const [productId, demandCenterId] = pairKey.split('---');
            const totalDemand = salesThisMonthByKey.get(pairKey) || 0;

            const currentStock = inventoryState.get(pairKey) || 0;
            const safetyStock = inventorySettingsById.get(pairKey)?.minStock || 0;
            const netNeed = Math.max(0, totalDemand + safetyStock - currentStock);

            if (netNeed > 0) {
                const ppi = ppiByProductId.get(productId);
                const prodClass = ppi?.ClaseAprovisionamiento;
                const producingCenterId = prodClass === 'F' ? '1000' : demandCenterId;

                if (!productionNeedsByCenter.has(producingCenterId)) {
                    productionNeedsByCenter.set(producingCenterId, { needs: [], totalHoursNeeded: 0 });
                }
                const centerNeeds = productionNeedsByCenter.get(producingCenterId)!;
                centerNeeds.needs.push({ productId, demandCenterId, units: netNeed });
                const timePerUnit = ppi?.totalManufacturingTimeHours || 0;
                centerNeeds.totalHoursNeeded += timePerUnit * netNeed;
            }
        });

        const finalProductionPlan = new Map<string, number>(); 
        let allBacklog: { productId: string, centerId: string, units: number }[] = [];

        productionNeedsByCenter.forEach((data, producingCenterId) => {
            const availableCapacity = constraints.productionLines
                .filter(l => l.workCenterId === producingCenterId && l.isActive)
                .reduce((sum, line) => sum + getLineCapacity(line, year, monthNum, constraints), 0);

            if (data.totalHoursNeeded <= availableCapacity) {
                data.needs.forEach(need => {
                    const key = `${need.productId}---${producingCenterId}`;
                    finalProductionPlan.set(key, (finalProductionPlan.get(key) || 0) + need.units);
                });
            } else {
                const deficitHours = data.totalHoursNeeded - availableCapacity;
                const totalUnitsInCenter = data.needs.reduce((sum, n) => sum + n.units, 0);
                
                data.needs.forEach(need => {
                    const ppi = ppiByProductId.get(need.productId);
                    const timePerUnit = ppi?.totalManufacturingTimeHours || 0;
                    
                    const participation = totalUnitsInCenter > 0 ? need.units / totalUnitsInCenter : 0;
                    const hoursDeficitForNeed = deficitHours * participation;
                    const unitsToCut = timePerUnit > 0 ? Math.floor(hoursDeficitForNeed / timePerUnit) : need.units;
                    
                    const adjustedProduction = Math.max(0, need.units - unitsToCut);
                    const backlogUnits = need.units - adjustedProduction;

                    if (adjustedProduction > 0) {
                        const key = `${need.productId}---${producingCenterId}`;
                        finalProductionPlan.set(key, (finalProductionPlan.get(key) || 0) + adjustedProduction);
                    }
                    if (backlogUnits > 0) {
                        allBacklog.push({ productId: need.productId, centerId: need.demandCenterId, units: backlogUnits });
                    }
                });
            }
        });

        const monthlyMovements = new Map<string, { production: number; salesDemand: number; transfersIn: number; transfersOut: number; initialStock: number; finalStock: number; dispatches: number; backlog: number }>();
        const allRelevantPairs = new Set([...inventoryState.keys(), ...salesThisMonthByKey.keys()]);
        
        allRelevantPairs.forEach(key => monthlyMovements.set(key, { production: 0, salesDemand: 0, transfersIn: 0, transfersOut: 0, initialStock: inventoryState.get(key) || 0, finalStock: 0, dispatches: 0, backlog: 0 }));
        
        salesThisMonth.forEach(s => {
            const key = `${normalizeMaterialCode(s.código)}---${s.centro.trim()}`;
            monthlyMovements.get(key)!.salesDemand += s.unidadesProyectado;
        });

        finalProductionPlan.forEach((units, key) => {
            monthlyMovements.get(key)!.production += units;
        });

        productionNeedsByCenter.forEach((data, producingCenterId) => {
            data.needs.forEach(need => {
                if (need.demandCenterId !== producingCenterId) {
                    const planKey = `${need.productId}---${producingCenterId}`;
                    const demandKey = `${need.productId}---${need.demandCenterId}`;
                    const producedForTransfer = finalProductionPlan.get(planKey) || 0;
                    const transferAmount = Math.min(producedForTransfer, need.units);
                    
                    if (transferAmount > 0) {
                         monthlyMovements.get(planKey)!.transfersOut += transferAmount;
                         monthlyMovements.get(demandKey)!.transfersIn += transferAmount;
                    }
                }
            });
        });

        const newInventoryState = new Map(inventoryState);
        allRelevantPairs.forEach(key => {
            const mov = monthlyMovements.get(key)!;
            const availableForSale = mov.initialStock + mov.production + mov.transfersIn;
            const dispatches = Math.min(availableForSale, mov.salesDemand);
            const finalStock = availableForSale - dispatches - mov.transfersOut;
            const backlog = Math.max(0, mov.salesDemand - dispatches);

            mov.dispatches = dispatches;
            mov.finalStock = finalStock;
            mov.backlog = backlog;
            newInventoryState.set(key, finalStock);
            
            const [productId, centerId] = key.split('---');
            const ppi = ppiByProductId.get(productId);
            const prodClass = ppi?.ClaseAprovisionamiento;
            const producingCenterId = prodClass === 'F' ? '1000' : centerId;

            monthlyPlanItems.push({
                id: `${monthKey}---${key}`, year, month: monthNum, productId, centerId, producingCenterId,
                productName: salesDescByProductId.get(productId) || productId,
                totalQuantityToProduce: mov.production,
                totalDemand: mov.salesDemand,
                dispatches: mov.dispatches,
                netTransfers: mov.transfersIn - mov.transfersOut,
                initialStock: mov.initialStock,
                finalStock: mov.finalStock,
                backlogVentas: backlog,
                backlogTrasladosF: 0, 
                backlogTrasladosX: 0,
                totalHoursWorked: 0,
                totalEstimatedLaborCost: 0,
                assignedLineId: ppi?.productionLineId,
            });
        });
        inventoryState = newInventoryState;
    }
    
    auditLog.push(`[${new Date().toLocaleTimeString()}] FIN: Plan mensual completado.`);
    logger.log(`[${new Date().toLocaleTimeString()}] Plan mensual completado.`, 'success');
    
    // --- Daily Plan Generation ---
    const dailyPlan: ProductionPlanItem[] = [];
    if (monthlyPlanItems.length > 0) {
        // Pre-agrupar plan mensual por mes para evitar filtrar toda la lista cada mes
        const monthlyPlanByKey = new Map<string, MonthlyProductionPlanItem[]>();
        monthlyPlanItems.forEach(p => {
            if (p.totalQuantityToProduce > 0) {
                const key = `${p.year}-${String(p.month).padStart(2, '0')}`;
                if (!monthlyPlanByKey.has(key)) monthlyPlanByKey.set(key, []);
                monthlyPlanByKey.get(key)!.push(p);
            }
        });

        onProgress({ message: 'Generando plan diario...', step: 'daily', current: 0, total: planningMonths.length });
        for (let i = 0; i < planningMonths.length; i++) {
            const monthKey = planningMonths[i];
            const [year, monthNum] = monthKey.split('-').map(Number);

            const monthlyProductionByCenter: { [centerId: string]: { productId: string, units: number }[] } = {};
            (monthlyPlanByKey.get(monthKey) || [])
                .forEach(p => {
                    if (!monthlyProductionByCenter[p.producingCenterId]) {
                        monthlyProductionByCenter[p.producingCenterId] = [];
                    }
                    monthlyProductionByCenter[p.producingCenterId].push({ productId: p.productId, units: p.totalQuantityToProduce });
                });

            const daysInMonth = new Date(year, monthNum, 0).getDate();

            const linesByCenter = new Map<string, ProductionLine[]>();
            for (const centerId in monthlyProductionByCenter) {
                linesByCenter.set(centerId, constraints.productionLines.filter(l => l.workCenterId === centerId && l.isActive));
            }

            // Pre-ordenar needs por urgencia una sola vez por mes (inventoryState no cambia dentro del mes)
            const sortedNeedsPerLine = new Map<string, { productId: string; units: number }[]>();
            for (const centerId in monthlyProductionByCenter) {
                for (const line of (linesByCenter.get(centerId) || [])) {
                    const lineProducts = productsByLine.get(line.id) || new Set<string>();
                    const needs = monthlyProductionByCenter[centerId]
                        .filter(need => lineProducts.has(need.productId))
                        .sort((a, b) =>
                            (inventoryState.get(`${a.productId}---${centerId}`) || 0) -
                            (inventoryState.get(`${b.productId}---${centerId}`) || 0)
                        );
                    sortedNeedsPerLine.set(`${centerId}---${line.id}`, needs);
                }
            }

            // Pre-calcular día de semana y horas para cada día del mes
            const dayHours: number[] = new Array(daysInMonth + 1);
            for (let d = 1; d <= daysInMonth; d++) {
                const dow = new Date(year, monthNum - 1, d).getDay();
                dayHours[d] = dow === 0 ? 0 : dow === 6 ? shiftParameters.saturdayAndHolidayHours : shiftParameters.regularHoursPerDay;
            }

            for (let day = 1; day <= daysInMonth; day++) {
                 onProgress({ message: `Generando plan diario...`, step: 'daily', current: day, total: daysInMonth });

                const hoursToday = dayHours[day];

                for (const centerId in monthlyProductionByCenter) {
                    const linesForCenter = linesByCenter.get(centerId) || [];

                    for (const line of linesForCenter) {
                        let lineCapacityToday = (line.capacity.normalUnitsPerHour || 1) * hoursToday * 0.87;

                        for (const need of (sortedNeedsPerLine.get(`${centerId}---${line.id}`) || [])) {
                            if (need.units <= 0) continue;
                            if (lineCapacityToday <= 0) break;

                            const ppi = ppiByKey.get(`${need.productId}---${line.id}`);
                            if (!ppi) continue;

                            const timePerUnit = ppi.totalManufacturingTimeHours;
                            const unitsInHours = timePerUnit > 0 ? (lineCapacityToday / timePerUnit) : need.units;
                            const unitsToProduce = Math.min(need.units, unitsInHours);

                            if (unitsToProduce > 0) {
                                const sale = salesByProductId.get(need.productId);
                                dailyPlan.push({
                                    id: `${year}-${monthNum}-${day}-${need.productId}-${line.id}`,
                                    productId: need.productId,
                                    productName: sale?.descripciónMaterial || need.productId,
                                    year, month: monthNum, day,
                                    week: Math.ceil(day / 7),
                                    quantityToProduce: unitsToProduce,
                                    demandOnDay: 0, initialStockOnDay: 0, finalStockOnDay: 0,
                                    assignedLineId: line.id,
                                    producingCenterId: centerId,
                                    demandCenterId: centerId, // Simplified for now
                                    hoursWorked: unitsToProduce * timePerUnit,
                                    estimatedLaborCost: unitsToProduce * timePerUnit * (globalBaseCostPerHour || 8),
                                    status: 'Planificado'
                                });
                                need.units -= unitsToProduce;
                                lineCapacityToday -= unitsToProduce * timePerUnit;
                            }
                        }
                    }
                }
            }
        }
        auditLog.push(`[${new Date().toLocaleTimeString()}] FIN: Plan diario completado con ${dailyPlan.length} registros.`);
    }

    onProgress(null);
    return { dailyPlan, monthlyPlan: monthlyPlanItems, weeklyPlan: [], auditLog, initialInventory: initialInventoryState };
};

export const exportDailyPlanToExcel = (plan: ProductionPlanItem[], constraints: AppConstraints): void => {
  if (!plan || plan.length === 0) return;
  const dailyDataToExport = plan.map(item => ({
    'Año': item.year, 'Mes': MONTH_NAMES[item.month - 1], 'Día': item.day, 'Producto (Cód)': item.productId,
    'Nombre Producto': item.productName, 'Stock Inicial': Math.round(item.initialStockOnDay),
    'Producción': item.isTransfer ? 0 : Math.round(item.quantityToProduce),
    'T. Entrante': item.isTransfer && item.transferDestinationCenterId === item.demandCenterId ? Math.round(item.quantityToProduce) : 0,
    'T. Saliente': item.isTransfer && item.transferSourceCenterId === item.demandCenterId ? Math.round(item.quantityToProduce) : 0,
    'Demanda Diaria': Math.round(item.demandOnDay),
    'Stock Final': Math.round(item.finalStockOnDay), 'Centro Prod.': item.producingCenterId,
    'Centro Demanda': item.demandCenterId,
    'Línea': constraints.productionLines.find(l => l.id === item.assignedLineId)?.name || item.assignedLineId,
    'Horas fabricación': parseFloat(item.hoursWorked.toFixed(2)),
    'Costo Labor Est.': parseFloat(item.estimatedLaborCost.toFixed(2)), 'Estado': item.status, 'Notas': item.notes || ''
  }));
  const dailyWorksheet = XLSX.utils.json_to_sheet(dailyDataToExport);
  dailyWorksheet['!cols'] = [ { wch: 6 }, { wch: 10 }, { wch: 5 }, { wch: 15 }, { wch: 30 }, { wch: 12 }, { wch: 12 }, { wch: 12 }, { wch: 15 }, { wch: 12 }, { wch: 12 }, { wch: 12 }, { wch: 15 }, { wch: 20 }, { wch: 15 }, { wch: 15 }, { wch: 20 }, { wch: 50 }, ];
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, dailyWorksheet, 'Plan de Producción Diario');
  XLSX.writeFile(workbook, 'Plan_Produccion_Diario.xlsx');
};

export const exportDailyPlanByLineToExcel = (
    planByLine: Array<{ lineName: string; dailyData: Record<number, { units: number; hours: number }> }>,
    days: number[],
    constraints: AppConstraints
): void => {
    if (!planByLine || planByLine.length === 0) return;

    const dataToExport = planByLine.map(lineData => {
        const row: Record<string, any> = { 'Línea de Producción': lineData.lineName };
        let totalUnits = 0;
        days.forEach(day => {
            const dayData = lineData.dailyData[day];
            row[`Día ${day} (Unidades)`] = dayData ? Math.round(dayData.units) : 0;
            row[`Día ${day} (Horas)`] = dayData ? parseFloat(dayData.hours.toFixed(2)) : 0;
            totalUnits += dayData ? dayData.units : 0;
        });
        row['Total Unidades Mes'] = Math.round(totalUnits);
        return row;
    });

    const worksheet = XLSX.utils.json_to_sheet(dataToExport);
    // You might want to adjust column widths for better readability
    const cols = [{ wch: 30 }]; // Line Name
    days.forEach(day => {
        cols.push({ wch: 15 }); // Units
        cols.push({ wch: 15 }); // Hours
    });
    cols.push({ wch: 20 }); // Total
    worksheet['!cols'] = cols;

    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, 'Detalle Diario por Línea');
    XLSX.writeFile(workbook, 'Plan_Diario_Por_Linea.xlsx');
};


export const exportMonthlyPlanToExcel = (plan: MonthlyProductionPlanItem[], centers: string[], constraints: AppConstraints): void => {
    if (!plan || plan.length === 0) return;

    const getLineName = (lineId: string | undefined): string => {
        if (!lineId) return 'N/A';
        const line = constraints.productionLines.find(l => l.id === lineId);
        return line ? line.name : (lineId || 'unassigned');
    };
    
    // Filter for production in the selected centers and aggregate
    const aggregatedProduction = new Map<string, { 
        quantity: number; 
        item: MonthlyProductionPlanItem; 
    }>();

    plan.filter(item => centers.includes(item.producingCenterId) && item.totalQuantityToProduce > 0).forEach(item => {
        const key = `${item.month}-${item.producingCenterId}-${item.productId}-${item.assignedLineId || 'unassigned'}`;
        const existing = aggregatedProduction.get(key);
        if (existing) {
            existing.quantity += item.totalQuantityToProduce;
        } else {
            aggregatedProduction.set(key, { 
                quantity: item.totalQuantityToProduce, 
                item: item 
            });
        }
    });
    
    const dataToExport = Array.from(aggregatedProduction.values()).map(({ quantity, item }) => {
        return {
            'Mes': MONTH_NAMES[item.month - 1],
            'Centro': item.producingCenterId,
            'Linea de Produccion': getLineName(item.assignedLineId),
            'Codigo Material': item.productId,
            'Nombre Producto': item.productName,
            'Cantidad a Fabricar': Math.round(quantity),
        };
    });

    const worksheet = XLSX.utils.json_to_sheet(dataToExport);
    worksheet['!cols'] = [ { wch: 15 }, { wch: 10 }, { wch: 25 }, { wch: 20 }, { wch: 40 }, { wch: 20 } ];
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, 'Plan Mensual Fabricacion');
    XLSX.writeFile(workbook, 'Resumen_Inventario_Mensual.xlsx');
};

export const exportMaestroSectorSummaryToExcel = (summaryData: { 'Sector': string; 'Cantidad de Materiales': number; 'Suma de Precios': number }[]): void => {
    if (!summaryData || summaryData.length === 0) return;
  
    const worksheet = XLSX.utils.json_to_sheet(summaryData);
    worksheet['!cols'] = [ { wch: 15 }, { wch: 25 }, { wch: 20 } ];
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, 'Resumen por Sector');
    XLSX.writeFile(workbook, 'Resumen_Maestro_Por_Sector.xlsx');
};

export const exportShiftsAndCostsTemplateToExcel = (workCenters: WorkCenter[]): void => {
    // Hoja única: Configuracion_Turnos
    const turnosData = workCenters.map(wc => ({
        'Centro': wc.id,
        'Año': new Date().getFullYear(),
        'Mes': new Date().getMonth() + 1,
        'RespCtrlProd': '',
        'NombRespControlProd': '',
        'Horas Normales': 9,
        'H.E. 50% (Diurnas)': 2,
        'H.E. 100% (Sab-Dom/Fer)': 5,
        '# Turnos': 1,
        'Costo Horas Normales': 8,
        'Costo H.E. 50% (Diurnas)': 50,
        'Costo Recargo Jornada Nocturna (%)': 25,
        'Costo H.E. 100% (Sab-Dom/Fer)': 100,
    }));
    
    const ws_turnos = XLSX.utils.json_to_sheet(turnosData);
    ws_turnos['!cols'] = [ 
        { wch: 10 }, { wch: 8 }, { wch: 8 }, { wch: 15 }, { wch: 25 }, 
        { wch: 15 }, { wch: 20 }, { wch: 25 }, { wch: 10 },
        { wch: 20 }, { wch: 25 }, { wch: 35 }, { wch: 30 }
    ];

    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, ws_turnos, 'Configuracion_Turnos');
    XLSX.writeFile(workbook, 'Plantilla_Costos_y_Turnos.xlsx');
};

export const parseShiftsAndCostsExcel = (file: File): Promise<{
    shiftConfigs: ShiftConfigRow[],
    shiftParameters: ShiftParameters,
    laborCostFactors: LaborCostSettings,
    globalBaseCostPerHour: number,
}> => {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = (event) => {
            try {
                const data = event.target?.result;
                const workbook = XLSX.read(data, { type: 'binary' });

                // --- Process Turnos Sheet (única hoja) ---
                const turnosSheetName = 'Configuracion_Turnos';
                const turnosWorksheet = workbook.Sheets[turnosSheetName];
                if (!turnosWorksheet) {
                    throw new Error(`La hoja "${turnosSheetName}" no fue encontrada en el archivo.`);
                }
                const turnosData: any[] = XLSX.utils.sheet_to_json(turnosWorksheet);
                
                if (turnosData.length === 0) {
                     throw new Error(`La hoja "${turnosSheetName}" no tiene datos.`);
                }
                
                const shiftConfigs: ShiftConfigRow[] = turnosData.map(row => ({
                    'Centro': String(row['Centro'] || ''),
                    'Año': Number(row['Año']),
                    'Mes': Number(row['Mes']),
                    'RespCtrlProd': String(row['RespCtrlProd'] || ''),
                    'NombRespControlProd': String(row['NombRespControlProd'] || ''),
                    'Horas Normales': Number(row['Horas Normales']),
                    'H.E. 50% (Diurnas)': Number(row['H.E. 50% (Diurnas)']),
                    'H.E. 100% (Sab-Dom/Fer)': Number(row['H.E. 100% (Sab-Dom/Fer)']),
                    '# Turnos': Number(row['# Turnos']),
                    'Costo Horas Normales': Number(row['Costo Horas Normales']),
                    'Costo H.E. 50% (Diurnas)': Number(row['Costo H.E. 50% (Diurnas)']),
                    'Costo Recargo Jornada Nocturna (%)': Number(row['Costo Recargo Jornada Nocturna (%)']),
                    'Costo H.E. 100% (Sab-Dom/Fer)': Number(row['Costo H.E. 100% (Sab-Dom/Fer)']),
                }));
                
                // Assume the first row of the first center contains the global parameters
                const firstConfig = shiftConfigs.length > 0 ? shiftConfigs[0] : null;

                const shiftParameters: ShiftParameters = {
                    regularHoursPerDay: firstConfig ? firstConfig['Horas Normales'] : 9,
                    extraHoursPerDay: firstConfig ? firstConfig['H.E. 50% (Diurnas)'] : 2,
                    saturdayAndHolidayHours: firstConfig ? firstConfig['H.E. 100% (Sab-Dom/Fer)'] : 5,
                };

                const globalBaseCostPerHour = firstConfig ? firstConfig['Costo Horas Normales'] : 8;

                const laborCostFactors: LaborCostSettings = {
                    factorAdicionalDiurno: firstConfig ? firstConfig['Costo H.E. 50% (Diurnas)'] : 50,
                    factorRecargoNocturno: firstConfig ? firstConfig['Costo Recargo Jornada Nocturna (%)'] : 25,
                    factorFinSemanaFeriado: firstConfig ? firstConfig['Costo H.E. 100% (Sab-Dom/Fer)'] : 100,
                };

                resolve({
                    shiftConfigs,
                    shiftParameters,
                    laborCostFactors,
                    globalBaseCostPerHour,
                });

            } catch (error) {
                reject(error as Error);
            }
        };
        reader.onerror = (error) => reject(error);
        reader.readAsBinaryString(file);
    });
};


export const parseTacticalOrdersExcel = (file: File): Promise<ProvisionalOrder[]> => { return Promise.resolve([]); };

export const generateTacticalPlan = ( request: TacticalRequest, context: any ): TacticalPlanResult => { return { plan: [], alerts: [] }; };

export const exportSkillsToExcel = ( employees: Employee[], skills: EmployeeSkill[], machines: Machine[], constraints: AppConstraints ): void => {};

export const parseHolidaysExcel = (file: File): Promise<Holiday[]> => {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = (event) => {
            try {
                const data = event.target?.result;
                const workbook = XLSX.read(data, { type: 'binary', cellDates: true });
                const sheetName = 'Feriados';
                const worksheet = workbook.Sheets[sheetName];
                if (!worksheet) {
                    throw new Error(`La hoja "${sheetName}" no fue encontrada en el archivo.`);
                }
                const jsonData: any[] = XLSX.utils.sheet_to_json(worksheet);

                const holidays: Holiday[] = jsonData.map((row, index) => {
                    const holidayName = row['Nombre del Feriado'];
                    const restDay = row['Día de Descanso (Puente)'];
                    const appliesTo = row['Procesos Aplica'];

                    if (!holidayName || restDay === undefined || restDay === null || !appliesTo) {
                        throw new Error(`Fila ${index + 2}: Faltan datos requeridos (Nombre del Feriado, Día de Descanso (Puente), Procesos Aplica).`);
                    }
                    
                    let dateString: string;

                    const formatDate = (d: Date): string => {
                        const year = d.getUTCFullYear();
                        const month = String(d.getUTCMonth() + 1).padStart(2, '0');
                        const day = String(d.getUTCDate()).padStart(2, '0');
                        return `${year}-${month}-${day}`;
                    };
                    
                    let finalDate: Date | null = null;

                    if (restDay instanceof Date) {
                        finalDate = restDay;
                    } else if (typeof restDay === 'number') {
                        // This formula is for dates from 1900 epoch on Windows. It's generally safe.
                        // The number represents days since 1899-12-30.
                        finalDate = new Date(Date.UTC(1900, 0, restDay - 1));
                    } else if (typeof restDay === 'string') {
                        const trimmed = restDay.trim();
                        // Try YYYY-MM-DD
                        if (/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) {
                           finalDate = new Date(`${trimmed}T00:00:00Z`); // Treat as UTC
                        } 
                        // Try DD/MM/YYYY or DD-MM-YYYY
                        else if (/^(\d{1,2})[\/-](\d{1,2})[\/-](\d{4})$/.test(trimmed)) {
                           const parts = trimmed.split(/[\/-]/);
                           finalDate = new Date(Date.UTC(parseInt(parts[2]), parseInt(parts[1]) - 1, parseInt(parts[0])));
                        }
                    }

                    if (finalDate && !isNaN(finalDate.getTime())) {
                        dateString = formatDate(finalDate);
                    } else {
                        throw new Error(`Fila ${index + 2}: Formato de fecha inválido para 'Día de Descanso (Puente)'. Se recibió '${restDay}'. Use formato YYYY-MM-DD, DD/MM/YYYY o un número de fecha de Excel.`);
                    }

                    return {
                        id: `holiday-${index}-${Date.now()}`,
                        name: String(holidayName),
                        date: dateString,
                        appliesTo: String(appliesTo),
                        dayType: 'asueto',
                        isProductionAllowed: false,
                    };
                });
                resolve(holidays);
            } catch (error) {
                reject(error as Error);
            }
        };
        reader.onerror = (error) => reject(error);
        reader.readAsBinaryString(file);
    });
};
