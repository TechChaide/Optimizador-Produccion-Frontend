

import React, { useState, useMemo, useEffect } from 'react';
import { logger } from '@/services/LogService';
import { operationTracker } from '@/services/OperationTracker';
import { useRuntimeInspector } from '@/services/RuntimeInspector';
import { 
    ProductionPlan, AppConstraints, WorkCenter, ProductionLine, 
    PlanningGroupMonthlyDetail, MonthlyNeed, MonthlyAssignment, DetailedProductionPlan, SalesDataRow, ProductionPlanItem, ProcessType, WeeklyPlanItem, MonthlyProductionPlanItem, DemandAnalysisResult, Holiday 
} from '@/types/types';
import { PlanIcon, DataImportIcon, MONTH_NAMES, PROCESS_TYPE_OPTIONS } from '@/constants/constants';
import { exportDailyPlanToExcel, exportMonthlyPlanToExcel, analyzeSalesDemand, getLineCapacity, exportDailyPlanByLineToExcel } from '@/services/OptimizationService';
import { Button } from '@/components/ui/button';
import { useAppContext } from '@/context/AppProvider';
import { Loader2, Check, ChevronsUpDown, Download } from 'lucide-react';
import { Progress } from "@/components/ui/progress";
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem } from '@/components/ui/command';
import { cn } from '@/lib/utils';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"


// --- Reusable MultiSelect Component ---
const MultiSelect: React.FC<{
  label: string;
  options: { value: string; label: string }[];
  selected: string[];
  onChange: (selected: string[]) => void;
  className?: string;
  placeholder?: string;
}> = ({ label, options, selected, onChange, className, placeholder }) => {
  const [open, setOpen] = useState(false);

  const handleSelect = (value: string) => {
    const newSelected = selected.includes(value)
      ? selected.filter((item) => item !== value)
      : [...selected, value];
    onChange(newSelected);
  };

  return (
    <div className={className}>
      <label className="block text-xs font-medium text-gray-500 mb-1">{label}</label>
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <Button
            variant="outline"
            role="combobox"
            aria-expanded={open}
            className="w-full justify-between h-9 font-normal text-xs"
          >
            <span className="truncate">
              {selected.length === 0
                ? (placeholder || `Seleccionar ${label}...`)
                : selected.length === 1
                ? options.find(opt => opt.value === selected[0])?.label
                : `${selected.length} seleccionados`}
            </span>
            <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-full p-0">
          <Command>
            <CommandInput placeholder={`Buscar ${label}...`} />
            <CommandEmpty>No hay resultados.</CommandEmpty>
            <CommandGroup className="max-h-60 overflow-y-auto">
              {options.map((option) => (
                <CommandItem
                  key={option.value}
                  value={option.value}
                  onSelect={(currentValue) => {
                    if (option.value.toLowerCase() === currentValue.toLowerCase()) {
                       handleSelect(option.value);
                     }
                  }}
                >
                  <Check
                    className={cn(
                      'mr-2 h-4 w-4',
                      selected.includes(option.value) ? 'opacity-100' : 'opacity-0'
                    )}
                  />
                  {option.label}
                </CommandItem>
              ))}
            </CommandGroup>
          </Command>
        </PopoverContent>
      </Popover>
      <div className="pt-1 min-h-[18px]">
        {selected.map(value => {
            const label = options.find(opt => opt.value === value)?.label;
            return (
                <Badge key={value} variant="secondary" className="mr-1 mb-1 text-xs">
                {label}
                </Badge>
            );
        })}
      </div>
    </div>
  );
};


const MonthlySummaryTable: React.FC<{ 
  planItems: MonthlyProductionPlanItem[], 
  title: string,
  selectedCenters: string[],
  planningMonths: { year: number, month: number }[] 
}> = ({ planItems, title, selectedCenters, planningMonths }) => {

  const dataByCenter = useMemo(() => {
    const centersData: Record<string, {
      byMonth: Record<string, {
        initialStock: number;
        production: number;
        transfersIn: number;
        transfersOut: number;
        dispatches: number;
        finalStock: number;
      }>
    }> = {};

    selectedCenters.forEach(centerId => {
      centersData[centerId] = { byMonth: {} };
      planningMonths.forEach(({ year, month }) => {
        const monthKey = `${year}-${String(month).padStart(2, '0')}`;
        centersData[centerId].byMonth[monthKey] = {
          initialStock: 0, production: 0, dispatches: 0, transfersIn: 0, transfersOut: 0, finalStock: 0
        };
      });
    });

    planItems.forEach(item => {
        const monthKey = `${item.year}-${String(item.month).padStart(2, '0')}`;

        // Flujo para el CENTRO DE DEMANDA (donde se vende)
        if (centersData[item.centerId] && centersData[item.centerId].byMonth[monthKey]) {
            const demandCenterData = centersData[item.centerId].byMonth[monthKey];
            demandCenterData.initialStock += item.initialStock; // Esta suma es conceptual, podría necesitar refinarse
            demandCenterData.dispatches += item.dispatches;
            demandCenterData.finalStock += item.finalStock; // También conceptual
            if (item.netTransfers > 0) demandCenterData.transfersIn += item.netTransfers;
        }

        // Flujo para el CENTRO DE PRODUCCIÓN (donde se fabrica)
        if (centersData[item.producingCenterId] && centersData[item.producingCenterId].byMonth[monthKey]) {
            const producingCenterData = centersData[item.producingCenterId].byMonth[monthKey];
            producingCenterData.production += item.totalQuantityToProduce;
            if (item.netTransfers < 0) producingCenterData.transfersOut += Math.abs(item.netTransfers);
        }
    });

    return centersData;
  }, [planItems, selectedCenters, planningMonths]);

  if (selectedCenters.length === 0) {
      return (
          <div className="text-center py-8 text-gray-500">
              Seleccione al menos un centro para ver el resumen.
          </div>
      )
  }

  return (
    <div className="space-y-4">
      <h3 className="text-lg font-semibold text-gray-800">{title}</h3>
      <div className="relative max-h-[70vh] overflow-y-auto border rounded-lg shadow-inner">
        <table className="min-w-full text-xs divide-y divide-gray-200">
          <thead className="bg-gray-100 sticky top-0 z-10">
            <tr>
              <th className="px-3 py-2 text-left font-semibold text-gray-600 uppercase tracking-wider bg-gray-100 sticky left-0 z-20">Flujo de Inventario</th>
              {planningMonths.map(({year, month}) => (
                <th key={`${year}-${month}`} className="px-3 py-2 text-right font-semibold text-gray-600 uppercase tracking-wider">
                  {MONTH_NAMES[month-1].substring(0,3)} {year}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-200">
            {Object.entries(dataByCenter).map(([centerId, centerData]) => (
                <React.Fragment key={centerId}>
                    <tr className="bg-gray-200 font-bold"><td colSpan={planningMonths.length + 1} className="px-3 py-2 text-indigo-700">Centro: {centerId}</td></tr>
                    {[
                        { label: 'Saldo Inicial', key: 'initialStock' },
                        { label: '(+) Producción', key: 'production' },
                        { label: '(+) Traslados Entrantes', key: 'transfersIn' },
                        { label: '(-) Despachos', key: 'dispatches' },
                        { label: '(-) Traslados Salientes', key: 'transfersOut' },
                        { label: 'Saldo Final', key: 'finalStock' },
                    ].map(flow => (
                      <tr key={flow.key} className="hover:bg-gray-50 group">
                        <td className={`px-3 py-2 whitespace-nowrap sticky left-0 bg-white group-hover:bg-gray-50 ${flow.key === 'finalStock' ? 'font-bold': ''}`}>{flow.label}</td>
                        {planningMonths.map(({year, month}) => {
                          const monthKey = `${year}-${String(month).padStart(2, '0')}`;
                          const val = centerData.byMonth[monthKey]?.[flow.key as keyof typeof centerData.byMonth[typeof monthKey]] || 0;
                          
                          return (
                            <td key={monthKey} className="px-3 py-2 text-right text-gray-600 font-mono">
                               {Math.round(val).toLocaleString()}
                            </td>
                          );
                        })}
                      </tr>
                    ))}
                </React.Fragment>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};



const normalizeMaterialCode = (code: string | number): string => {
    const codeStr = String(code);
    return codeStr.slice(-8);
};

export const ProductionPlanSection: React.FC = () => {
  const inspector = useRuntimeInspector('ProductionPlan');
  
  useEffect(() => {
    logger.log(`[ProductionPlanSection] Montado.`);
  }, []);
  
  const { 
    productionPlan, 
    handleGenerateFullPlan, 
    isLoading, 
    constraints, 
    syncStatus,
    salesData,
    planningProgress,
    planningStep,
    dispatch,
    demandAnalysis,
    apiCuboInventariosData,
    handleContinueToStep2,
    handleContinueToStep3,
    handleContinueToStep4,
  } = useAppContext();

  const isDataSynced = syncStatus?.isSynced || false;
  
  // State for inventory filters
  const [inventoryFilterOptions, setInventoryFilterOptions] = useState<{ centros: string[], sectores: string[] }>({ centros: [], sectores: [] });
  const [selectedInventoryCentros, setSelectedInventoryCentros] = useState<string[]>([]);
  const [selectedInventorySectores, setSelectedInventorySectores] = useState<string[]>([]);


  useEffect(() => {
    if (apiCuboInventariosData.length > 0) {
      const centros = [...new Set(apiCuboInventariosData.map(item => String(item.Centro).trim()))].sort();
      const sectores = [...new Set(apiCuboInventariosData.map(item => item.Sector || 'Sin Sector'))].sort();
      setInventoryFilterOptions({ centros, sectores });
      setSelectedInventoryCentros(centros);
      setSelectedInventorySectores(sectores);
    }
  }, [apiCuboInventariosData]);


  useEffect(() => {
    inspector.captureState({
      isDataSynced,
      isLoading,
      planningStep,
      hasPlan: !!(productionPlan.monthlyPlan.length || productionPlan.weeklyPlan.length || productionPlan.dailyPlan.length),
      salesDataCount: salesData.length,
      demandAnalysisPresent: !!demandAnalysis
    });
  }, [isDataSynced, isLoading, planningStep, productionPlan, salesData, demandAnalysis, inspector]);
  
  const { monthlyPlan = [], dailyPlan = [] } = productionPlan || { monthlyPlan: [], dailyPlan: [] };

  // ----- BEGIN: State and Logic for Results Filtering -----
  const [resultsFilterOptions, setResultsFilterOptions] = useState<{
    centros: { value: string; label: string }[];
    sectores: { value: string; label: string }[];
    lineas: { value: string; label: string }[];
  }>({ centros: [], sectores: [], lineas: [] });

  const [selectedResultsFilters, setSelectedResultsFilters] = useState<{
    centros: string[];
    sectores: string[];
    lineas: string[];
  }>({ centros: [], sectores: [], lineas: [] });

  // Populate filter options when plan is generated
  useEffect(() => {
    if (planningStep >= 3 && productionPlan.monthlyPlan.length > 0) {
      const uniqueCentros = [...new Set(productionPlan.monthlyPlan.map(item => item.centerId))];
      const uniqueSectores = [...new Set(salesData.map(item => item.sector || 'Sin Sector'))];
      const uniqueLineas = [...new Set(productionPlan.dailyPlan.map(item => item.assignedLineId).filter(Boolean) as string[])];
      
      const linesById = new Map(constraints.productionLines.map(l => [l.id, l]));
      const lineDetails = uniqueLineas.map(lineId => {
        const line = linesById.get(lineId);
        return { value: lineId, label: line ? `${line.name} (${line.workCenterId})` : lineId };
      });

      setResultsFilterOptions({
        centros: uniqueCentros.map(c => ({ value: c, label: c })).sort((a,b) => a.label.localeCompare(b.label)),
        sectores: uniqueSectores.map(s => ({ value: s, label: s })).sort((a,b) => a.label.localeCompare(b.label)),
        lineas: lineDetails.sort((a,b) => a.label.localeCompare(b.label)),
      });
      
      // Select all by default
      setSelectedResultsFilters({
        centros: uniqueCentros,
        sectores: [], // Default to no sector filter for clarity
        lineas: [], // Default to no line filter
      });
    }
  }, [planningStep, productionPlan, salesData, constraints.productionLines]);

  const filteredMonthlyPlan = useMemo(() => {
    if (planningStep < 3) return [];

    return productionPlan.monthlyPlan.filter(item => {
      const centroMatch = selectedResultsFilters.centros.length === 0 || 
                          selectedResultsFilters.centros.includes(item.centerId) ||
                          selectedResultsFilters.centros.includes(item.producingCenterId);
      
      const sale = salesData.find(s => normalizeMaterialCode(s.código) === normalizeMaterialCode(item.productId));
      const sector = sale?.sector || 'Sin Sector';
      const sectorMatch = selectedResultsFilters.sectores.length === 0 || selectedResultsFilters.sectores.includes(sector);
      
      return centroMatch && sectorMatch;
    });
  }, [productionPlan.monthlyPlan, selectedResultsFilters, salesData, planningStep]);
  
    const planningMonths = useMemo(() => {
     if (salesData.length === 0) return [];
     const monthSet = new Set<string>();
     salesData.forEach(d => monthSet.add(`${d.año}-${d.mes}`));
     return Array.from(monthSet).sort().map(m => {
       const [year, month] = m.split('-').map(Number);
       return { year, month };
     });
  }, [salesData]);

  const { filteredDailyPlanByLine, dailyPlanDays, totalFilteredUnits } = useMemo(() => {
    if (planningStep < 4 || !productionPlan.dailyPlan) {
      return { filteredDailyPlanByLine: [], dailyPlanDays: [], totalFilteredUnits: 0 };
    }

    let dailyPlanFirstMonth = productionPlan.dailyPlan;
    const firstMonth = planningMonths[0];
    if(firstMonth) {
        dailyPlanFirstMonth = productionPlan.dailyPlan.filter(item => item.year === firstMonth.year && item.month === firstMonth.month);
    }
    
    let filteredItems = dailyPlanFirstMonth.filter(item => {
      const centroMatch = selectedResultsFilters.centros.length === 0 || 
                          selectedResultsFilters.centros.includes(item.producingCenterId || '');
      const lineaMatch = selectedResultsFilters.lineas.length === 0 || 
                         (item.assignedLineId && selectedResultsFilters.lineas.includes(item.assignedLineId));
      return centroMatch && lineaMatch;
    });

    const dailyPlanDays = [...new Set(filteredItems.map(d => d.day))].sort((a,b)=> a-b);

    const dataByLine = filteredItems.reduce((acc, item) => {
        const lineId = item.assignedLineId || 'unassigned';
        if (!acc[lineId]) {
            const line = constraints.productionLines.find(l => l.id === lineId);
            acc[lineId] = {
                lineName: line ? `${line.name} (${line.workCenterId})` : 'Sin Asignar',
                workCenterId: line?.workCenterId || '',
                dailyData: {}
            };
        }
        if (!acc[lineId].dailyData[item.day]) {
            acc[lineId].dailyData[item.day] = { units: 0, hours: 0 };
        }
        acc[lineId].dailyData[item.day].units += item.quantityToProduce;
        acc[lineId].dailyData[item.day].hours += item.hoursWorked;
        return acc;
    }, {} as Record<string, { lineName: string; workCenterId: string; dailyData: Record<number, { units: number; hours: number }> }>);
    
    const totalFilteredUnits = Object.values(dataByLine).reduce((total, lineData) => {
        return total + Object.values(lineData.dailyData).reduce((lineTotal, dayData) => lineTotal + dayData.units, 0);
    }, 0);

    return { filteredDailyPlanByLine: Object.values(dataByLine).sort((a, b) => a.lineName.localeCompare(b.lineName)), dailyPlanDays, totalFilteredUnits };
}, [planningStep, productionPlan.dailyPlan, selectedResultsFilters, planningMonths, constraints.productionLines]);

  const handleExportMonthly = () => {
    if (filteredMonthlyPlan.length > 0) {
      exportMonthlyPlanToExcel(filteredMonthlyPlan, selectedResultsFilters.centros, constraints);
    }
  };
  
   const handleExportDaily = () => {
    if (productionPlan.dailyPlan.length > 0) {
        exportDailyPlanByLineToExcel(filteredDailyPlanByLine, dailyPlanDays, constraints);
    }
  };

  const handleStartPlanning = async () => {
      if (!isDataSynced) {
        logger.log("Error: Datos de ensamble no sincronizados.", 'error');
        return;
      }
      if (salesData.length === 0) {
        logger.log("Error: No hay datos de ventas.", 'error');
        return;
      }
      if (apiCuboInventariosData.length === 0) {
        logger.log("Error: Los datos de la API de CuboInventarios no están cargados en el contexto.", 'error');
        return;
      }
      dispatch({ type: 'SET_IS_LOADING', payload: true });
      try {
        const inventoryFilters = {
          centros: selectedInventoryCentros,
          sectores: selectedInventorySectores
        };
        const analysisResult = await analyzeSalesDemand(salesData, apiCuboInventariosData, constraints, inventoryFilters);
        dispatch({ type: 'SET_DEMAND_ANALYSIS', payload: analysisResult });
        dispatch({ type: 'SET_PLANNING_STEP', payload: 1 });
      } catch (error) {
        logger.log(`Error en análisis de demanda: ${(error as Error).message}`, 'error');
      } finally {
        dispatch({ type: 'SET_IS_LOADING', payload: false });
      }
  };

  const handleGeneratePlanClick = async () => {
    if (demandAnalysis) {
        dispatch({ type: 'SET_IS_LOADING', payload: true });
        const success = await handleGenerateFullPlan({ centros: selectedInventoryCentros, sectores: selectedInventorySectores });
        dispatch({ type: 'SET_IS_LOADING', payload: false });
        if (success) {
            handleContinueToStep3();
        }
    }
  };

  const resetPlanning = () => {
    dispatch({ type: 'RESET_PLANNING' });
  };
  

  const renderPlanWizard = () => {
    if (planningStep === 0) {
      return (
        <div className="text-center py-10">
          <h3 className="text-lg font-medium text-gray-900">Listo para Planificar</h3>
          <p className="mt-1 text-sm text-gray-500">
            El proceso se realizará en varios pasos para validar los datos agregados.
          </p>
           {!isDataSynced && (
              <p className="mt-4 text-sm text-yellow-600 bg-yellow-50 p-3 rounded-md">
                 ⚠️ Atención: Los datos de configuración y tiempos no están sincronizados. Vaya a la sección de <span className="font-bold">Definir Restricciones</span> y presione el botón de sincronización antes de generar un plan.
              </p>
           )}
           {isDataSynced && salesData.length === 0 && (
              <p className="mt-4 text-sm text-yellow-600 bg-yellow-50 p-3 rounded-md">
                 ⚠️ Atención: No se han cargado datos de ventas. Por favor, vaya a la sección de <span className="font-bold">Importar Ventas</span>.
              </p>
           )}
        </div>
      );
    }

    if (planningStep === 1 && demandAnalysis) {
        const { demandByGroup, unclassifiedMaterials } = demandAnalysis;
        
        const totalNecesidadCentro1000 = demandByGroup.filter(d => d.producingCenter === '1000').reduce((sum, item) => sum + item.totalUnidades, 0);
        const totalNecesidadCentro2000 = demandByGroup.filter(d => d.producingCenter === '2000').reduce((sum, item) => sum + item.totalUnidades, 0);
        const totalGeneral = totalNecesidadCentro1000 + totalNecesidadCentro2000;


      return (
        <div className="space-y-6">
          <div>
            <h3 className="text-lg font-semibold text-gray-800">Paso 1: Validación de Demanda Bruta (Primer Mes)</h3>
            <p className="text-sm text-gray-600 mb-4">
              Esta tabla muestra la demanda de ventas bruta para el primer mes del horizonte de planificación, agrupada por centro de producción. Verifique que los totales coincidan con sus expectativas antes de continuar.
            </p>

            <div className="overflow-auto max-h-[50vh] border rounded-lg mt-4">
              <table className="min-w-full text-sm divide-y divide-gray-200">
                <thead className="bg-gray-100 sticky top-0 z-10">
                  <tr>
                    <th className="px-3 py-2 text-left font-semibold text-gray-600">Clase Aprov.</th>
                    <th className="px-3 py-2 text-left font-semibold text-gray-600">Centro Demanda</th>
                    <th className="px-3 py-2 text-left font-semibold text-gray-600">Centro Producción</th>
                    <th className="px-3 py-2 text-left font-semibold text-gray-600">Sector</th>
                    <th className="px-3 py-2 text-right font-semibold text-gray-600">Total Unidades</th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                   {demandByGroup.map(item => (
                        <tr key={`${item.claseAprovisionamiento}-${item.centro}-${item.sector}`} className="hover:bg-gray-50">
                            <td className={`px-3 py-2 font-mono ${item.claseAprovisionamiento === 'F' ? 'text-blue-600 font-bold' : ''}`}>
                                {item.claseAprovisionamiento}
                            </td>
                            <td className="px-3 py-2">{item.centro}</td>
                            <td className="px-3 py-2 font-semibold">{item.producingCenter}</td>
                            <td className="px-3 py-2">{item.sector}</td>
                            <td className="px-3 py-2 text-right font-semibold">{Math.round(item.totalUnidades).toLocaleString()}</td>
                        </tr>
                    ))}
                </tbody>
                <tfoot className="bg-gray-800 text-white sticky bottom-0">
                    <tr>
                        <th colSpan={4} className="px-3 py-2 text-right font-bold uppercase">Total Demanda Centro 1000</th>
                        <th className="px-3 py-2 text-right font-bold uppercase">{Math.round(totalNecesidadCentro1000).toLocaleString()}</th>
                    </tr>
                    <tr>
                        <th colSpan={4} className="px-3 py-2 text-right font-bold uppercase">Total Demanda Centro 2000</th>
                        <th className="px-3 py-2 text-right font-bold uppercase">{Math.round(totalNecesidadCentro2000).toLocaleString()}</th>
                    </tr>
                    <tr className="bg-gray-900">
                        <th colSpan={4} className="px-3 py-2 text-right font-bold uppercase">Total General Demanda (Planificable)</th>
                        <th className="px-3 py-2 text-right font-bold uppercase">{Math.round(totalGeneral).toLocaleString()}</th>
                    </tr>
                </tfoot>
              </table>
            </div>
          </div>

          {unclassifiedMaterials.length > 0 && (
            <div className="p-4 border border-yellow-300 bg-yellow-50 rounded-lg">
                <h4 className="text-md font-semibold text-yellow-800">⚠️ Alerta: Materiales Fabricables sin Clase de Aprovisionamiento</h4>
                <p className="text-xs text-yellow-700 mt-1 mb-3">
                    Los siguientes materiales (código inicia con '3' o '4') no tienen una regla de aprovisionamiento ('E', 'F', 'X') definida en `CuboInventarios` y no podrán ser planificados. Esto puede indicar un error en los datos maestros. Los productos comprados (que no inician con 3 o 4) son omitidos correctamente.
                </p>
                <div className="overflow-auto max-h-48 border rounded-md bg-white">
                    <table className="min-w-full text-xs divide-y divide-gray-200">
                        <thead className="bg-gray-100 sticky top-0">
                            <tr>
                                <th className="px-2 py-1 text-left font-semibold text-gray-600">Material</th>
                                <th className="px-2 py-1 text-left font-semibold text-gray-600">Centro</th>
                                <th className="px-2 py-1 text-left font-semibold text-gray-600">Sector</th>
                                <th className="px-2 py-1 text-right font-semibold text-gray-600">Unidades</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-200">
                            {unclassifiedMaterials.map((item) => (
                                <tr key={`${item.productId}-${item.centerId}`} className="hover:bg-yellow-100">
                                    <td className="px-2 py-1">
                                        <div className="font-mono text-gray-800">{item.productId}</div>
                                        <div className="text-gray-500">{item.productName}</div>
                                    </td>
                                    <td className="px-2 py-1">{item.centerId}</td>
                                    <td className="px-2 py-1">{item.sector}</td>
                                    <td className="px-2 py-1 text-right font-mono">{Math.round(item.demand).toLocaleString()}</td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </div>
          )}

          <div className="flex justify-end space-x-4 pt-4">
            <Button variant="outline" onClick={resetPlanning}>Cancelar y Reiniciar</Button>
            <Button onClick={handleContinueToStep2}>Aceptar y Continuar al Paso 2</Button>
          </div>
        </div>
      );
    }
    
    if (planningStep === 2 && demandAnalysis) {
        const { productionNeedsFirstMonth } = demandAnalysis;
        
        const capacityByCenter = constraints.workCenters.reduce((acc, wc) => {
            const centerLines = constraints.productionLines.filter(l => l.workCenterId === wc.id && l.isActive);
            const totalCapacity = centerLines.reduce((sum, line) => sum + getLineCapacity(line, planningMonths[0].year, planningMonths[0].month, constraints), 0);
            acc[wc.id] = totalCapacity;
            return acc;
        }, {} as Record<string, number>);

        const needsByCenter = productionNeedsFirstMonth.reduce((acc, need) => {
            if (!acc[need.producingCenterId]) {
                acc[need.producingCenterId] = { totalUnits: 0, totalHours: 0 };
            }
            acc[need.producingCenterId].totalUnits += need.totalUnits;
            acc[need.producingCenterId].totalHours += need.requiredHours;
            return acc;
        }, {} as Record<string, {totalUnits: number, totalHours: number}>);


        return (
            <div className="space-y-6">
                <h3 className="text-lg font-semibold text-gray-800">Paso 2: Validación de Necesidad Neta y Capacidad (Primer Mes)</h3>
                <p className="text-sm text-gray-600">
                    Esta tabla muestra la necesidad de producción neta (Demanda + Cobertura de Stock) en unidades y horas, comparada con la capacidad disponible. Verifique la carga de capacidad antes de generar el plan final.
                </p>
                <div className="overflow-auto max-h-[60vh] border rounded-lg">
                    <table className="min-w-full text-sm divide-y divide-gray-200">
                        <thead className="bg-gray-100 sticky top-0 z-10">
                            <tr>
                                <th className="px-3 py-2 text-left font-semibold text-gray-600">Centro de Producción</th>
                                <th className="px-3 py-2 text-left font-semibold text-gray-600">Sector</th>
                                <th className="px-3 py-2 text-left font-semibold text-gray-600">Clase Aprov.</th>
                                <th className="px-3 py-2 text-right font-semibold text-gray-600">Unidades Requeridas</th>
                                <th className="px-3 py-2 text-right font-semibold text-gray-600">Horas Requeridas</th>
                            </tr>
                        </thead>
                        <tbody className="bg-white divide-y divide-gray-200">
                            {productionNeedsFirstMonth.map((item, index) => (
                                <tr key={`need-${item.producingCenterId}-${item.sector}-${item.claseAprovisionamiento}`} className="hover:bg-gray-50">
                                    <td className="px-3 py-2">{item.producingCenterId}</td>
                                    <td className="px-3 py-2">{item.sector}</td>
                                    <td className={`px-3 py-2 font-mono ${item.claseAprovisionamiento === 'F' ? 'text-blue-600 font-bold' : ''}`}>
                                        {item.claseAprovisionamiento}
                                    </td>
                                    <td className="px-3 py-2 text-right font-mono">{Math.round(item.totalUnits).toLocaleString()}</td>
                                    <td className="px-3 py-2 text-right font-mono">{Math.round(item.requiredHours).toLocaleString()}</td>
                                </tr>
                            ))}
                        </tbody>
                         <tfoot className="bg-gray-200 sticky bottom-0 z-10">
                            {Object.entries(needsByCenter).map(([centerId, data]) => {
                                const capacity = capacityByCenter[centerId] || 0;
                                const loadPercentage = capacity > 0 ? (data.totalHours / capacity) * 100 : 0;
                                return (
                                    <tr key={`summary-${centerId}`}>
                                        <th colSpan={3} className="px-3 py-2 text-left font-bold text-gray-700">Resumen Centro {centerId}</th>
                                        <th className="px-3 py-2 text-right font-bold text-gray-700">{Math.round(data.totalUnits).toLocaleString()}</th>
                                        <th className="px-3 py-2 text-right font-bold text-gray-700">
                                            {Math.round(data.totalHours).toLocaleString()} / {Math.round(capacity).toLocaleString()}h
                                            <span className={`ml-2 font-semibold ${loadPercentage > 100 ? 'text-red-500' : 'text-green-600'}`}>
                                                ({loadPercentage.toFixed(1)}%)
                                            </span>
                                        </th>
                                    </tr>
                                );
                            })}
                        </tfoot>
                    </table>
                </div>
                 <div className="flex justify-end space-x-4 pt-4">
                    <Button variant="outline" onClick={() => dispatch({type: 'SET_PLANNING_STEP', payload: 1})}>Volver al Paso 1</Button>
                    <Button onClick={handleGeneratePlanClick}>Aceptar y Generar Plan de Producción</Button>
                </div>
            </div>
        );
    }
    
    // Step 3 (NEW): Show monthly plan results
    if (planningStep === 3 && monthlyPlan.length > 0) {
        return (
            <div className="space-y-6">
                <h3 className="text-lg font-semibold text-gray-800">Paso 3: Plan de Producción Mensual (Factible)</h3>
                <p className="text-sm text-gray-600">
                    Esta tabla muestra el plan de producción mensual final después de balancear la carga y respetar las restricciones de capacidad. Compare la columna "Producción" con la "Demanda" para ver los ajustes realizados por el motor.
                </p>

                <div className="bg-white p-6 rounded-xl shadow-lg mt-4">
                    <MonthlySummaryTable 
                        planItems={productionPlan.monthlyPlan} 
                        title="Flujo de Inventario Mensual Planificado" 
                        selectedCenters={resultsFilterOptions.centros.map(c => c.value)}
                        planningMonths={planningMonths}
                    />
                </div>
                <div className="flex justify-end space-x-4 pt-4">
                    <Button variant="outline" onClick={() => dispatch({type: 'SET_PLANNING_STEP', payload: 2})}>Volver al Paso 2</Button>
                    <Button onClick={handleContinueToStep4}>Continuar al Detalle Diario</Button>
                </div>
            </div>
        );
    }

    // Step 4 is the final results view with daily details
    if (planningStep === 4 && monthlyPlan.length > 0) {
        
        return (
             <div className="p-6 md:p-8 space-y-6">
              <div className="flex flex-col md:flex-row justify-between items-start md:items-center">
                <div className="flex items-center space-x-3">
                    <PlanIcon />
                    <h2 className="text-2xl font-semibold text-gray-700">Paso 4: Resultados del Plan de Producción</h2>
                </div>
                <div className="flex items-center space-x-4 mt-4 md:mt-0">
                    <Button onClick={handleExportMonthly} variant="outline" disabled={filteredMonthlyPlan.length === 0}>
                      <Download className="mr-2 h-4 w-4" /> Exportar Resumen
                    </Button>
                     <Button onClick={handleExportDaily} variant="outline" disabled={filteredDailyPlanByLine.length === 0}>
                      <Download className="mr-2 h-4 w-4" /> Exportar Detalle Diario
                    </Button>
                    <Button onClick={resetPlanning} variant="destructive">
                      Iniciar Nueva Planificación
                    </Button>
                </div>
              </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 items-start p-4 border rounded-lg bg-gray-50">
              <MultiSelect
                label="Centros"
                options={resultsFilterOptions.centros}
                selected={selectedResultsFilters.centros}
                onChange={value => setSelectedResultsFilters(prev => ({ ...prev, centros: value }))}
              />
              <MultiSelect
                label="Sectores"
                options={resultsFilterOptions.sectores}
                selected={selectedResultsFilters.sectores}
                onChange={value => setSelectedResultsFilters(prev => ({ ...prev, sectores: value }))}
              />
              <MultiSelect
                label="Líneas de Producción"
                options={resultsFilterOptions.lineas}
                selected={selectedResultsFilters.lineas}
                onChange={value => setSelectedResultsFilters(prev => ({ ...prev, lineas: value }))}
              />
            </div>
            
            <div className="bg-white p-6 rounded-xl shadow-lg mt-4">
                <h3 className="text-lg font-semibold text-gray-800 mb-4">Detalle Diario por Línea (Primer Mes)</h3>
                    <div className="max-h-[70vh] overflow-x-auto border rounded-lg">
                    <table className="min-w-full text-xs divide-y divide-gray-200">
                        <thead className="bg-gray-100 sticky top-0 z-10">
                            <tr>
                                <th className="px-2 py-2 text-left font-semibold text-gray-600 sticky left-0 bg-gray-100 z-20">Línea de Producción</th>
                                {dailyPlanDays.map(day => (
                                    <th key={day} className="px-2 py-2 text-center font-semibold text-gray-600 border-l">
                                        Día {day}
                                    </th>
                                ))}
                                <th className="px-2 py-2 text-right font-bold text-gray-700 sticky right-0 bg-gray-100 z-20 border-l">Total Mes</th>
                            </tr>
                        </thead>
                        <tbody className="bg-white divide-y divide-gray-200">
                        {filteredDailyPlanByLine.length > 0 ? (
                            filteredDailyPlanByLine.map((lineData) => {
                                const totalUnits = Object.values(lineData.dailyData).reduce((sum, day) => sum + day.units, 0);
                                return (
                                    <tr key={lineData.lineName} className="hover:bg-gray-50 group">
                                        <td className="px-2 py-2 font-medium text-gray-800 sticky left-0 bg-white group-hover:bg-gray-50">{lineData.lineName}</td>
                                        {dailyPlanDays.map(day => (
                                            <td key={day} className="px-1 py-1 text-center border-l">
                                                {lineData.dailyData[day] ? (
                                                    <div className="font-mono bg-indigo-50 rounded p-1">
                                                        <div className="text-indigo-800 font-bold">{Math.round(lineData.dailyData[day].units).toLocaleString()}</div>
                                                        <div className="text-gray-500 text-[10px]">{lineData.dailyData[day].hours.toFixed(1)}h</div>
                                                    </div>
                                                ) : (
                                                    <div className="text-gray-300">-</div>
                                                )}
                                            </td>
                                        ))}
                                        <td className="px-2 py-2 text-right font-bold text-indigo-800 sticky right-0 bg-white group-hover:bg-gray-50 border-l">
                                            {Math.round(totalUnits).toLocaleString()}
                                        </td>
                                    </tr>
                                );
                            })
                        ) : (
                            <tr>
                                <td colSpan={dailyPlanDays.length + 2} className="text-center py-8 text-gray-500">
                                    No hay datos para mostrar con los filtros seleccionados.
                                </td>
                            </tr>
                        )}
                        </tbody>
                        <tfoot className="bg-gray-200 sticky bottom-0 font-bold">
                            <tr>
                                <td className="px-2 py-2 text-right sticky left-0 bg-gray-200">TOTAL</td>
                                {dailyPlanDays.map(day => {
                                    const dayTotal = filteredDailyPlanByLine.reduce((sum, line) => sum + (line.dailyData[day]?.units || 0), 0);
                                    return (
                                        <td key={`total-${day}`} className="px-2 py-2 text-center border-l text-gray-700">
                                            {Math.round(dayTotal).toLocaleString()}
                                        </td>
                                    )
                                })}
                                <td className="px-2 py-2 text-right text-indigo-700 sticky right-0 bg-gray-200 border-l">
                                    {Math.round(totalFilteredUnits).toLocaleString()}
                                </td>
                            </tr>
                        </tfoot>
                    </table>
                </div>
            </div>

            <div className="flex justify-end space-x-4 pt-4">
                <Button variant="outline" onClick={() => dispatch({type: 'SET_PLANNING_STEP', payload: 3})}>Volver al Plan Mensual</Button>
            </div>
            </div>
        )
    }

    return null;
  }
  
  // Render main view
  if ((planningStep > 0 && planningStep <= 4) && !isLoading) {
    return (
         <div className="p-6 md:p-8 space-y-6">
             <div className="flex items-center space-x-3">
                <PlanIcon />
                <h2 className="text-2xl font-semibold text-gray-700">Asistente de Planificación a Mediano Plazo</h2>
            </div>
            <div className="bg-white p-6 rounded-xl shadow-lg min-h-[60vh]">
                {renderPlanWizard()}
            </div>
        </div>
    );
  }

  return (
    <div className="p-6 md:p-8 space-y-6">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center">
        <div className="flex items-center space-x-3">
            <PlanIcon />
            <h2 className="text-2xl font-semibold text-gray-700">Asistente de Planificación a Mediano Plazo</h2>
        </div>
        <div className="flex items-center space-x-4 mt-4 md:mt-0">
            <Button
                onClick={handleStartPlanning}
                disabled={isLoading || !isDataSynced || salesData.length === 0}
                title={!isDataSynced ? 'Debe sincronizar los datos de ensamble primero' : (salesData.length === 0 ? 'Debe importar datos de ventas primero' : 'Iniciar el asistente de planificación')}
            >
                {isLoading ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Analizando...</> : 'Paso 1: Analizar Demanda'}
            </Button>
        </div>
      </div>

      <div className="bg-white p-6 rounded-xl shadow-lg min-h-[60vh]">
         {isLoading ? (
             <div className="text-center py-10 flex flex-col items-center justify-center h-full">
                <Loader2 className="w-12 h-12 text-indigo-600 animate-spin mb-4" />
                <h3 className="text-lg font-medium text-gray-900">{planningProgress ? planningProgress.message : 'Analizando...'}</h3>
                 {planningProgress && (
                    <div className="w-full max-w-sm mt-4">
                        <Progress value={(planningProgress.current / planningProgress.total) * 100} />
                        <p className="text-sm text-gray-500 mt-2">{planningProgress.current} de {planningProgress.total}</p>
                    </div>
                )}
            </div>
         ) : renderPlanWizard()}
      </div>
    </div>
  );
};
