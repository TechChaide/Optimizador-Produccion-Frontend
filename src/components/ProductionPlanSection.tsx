

import React, { useState, useMemo, useEffect, useCallback, useRef } from 'react';
import { logger } from '@/services/LogService';
import { useRuntimeInspector } from '@/services/RuntimeInspector';
import {
    ProductionPlan, AppConstraints, WorkCenter, ProductionLine,
    PlanningGroupMonthlyDetail, MonthlyNeed, MonthlyAssignment, DetailedProductionPlan, SalesDataRow, ProductionPlanItem, ProcessType, WeeklyPlanItem, MonthlyProductionPlanItem, DemandAnalysisResult, Holiday
} from '@/types/types';
import { Grupo, PlanGrupo, DetalleTactico } from '@/types/interfaces';
import { grupoService } from '@/services/grupo.service';
import { planGrupoService } from '@/services/plangrupo.service';
import { detalleTacticoService } from '@/services/detalletactico.service';
import { serviciosService } from '@/services/servicios.service';
import { ecuadorHolidaysService } from '@/services/ecuador-holidays.service';
import { PlanIcon, DataImportIcon, MONTH_NAMES, PROCESS_TYPE_OPTIONS } from '@/constants/constants';
import { exportDailyPlanToExcel, exportMonthlyPlanToExcel, analyzeSalesDemand, getLineCapacity, exportDailyPlanByLineToExcel } from '@/services/OptimizationService';
import { Button } from '@/components/ui/button';
import { useAppContext } from '@/context/AppProvider';
import { Loader2, Check, ChevronsUpDown, ChevronLeft, ChevronDown, ChevronRight, Download, Users2, RefreshCw, Calendar as CalendarIcon, X } from 'lucide-react';
import { Calendar } from '@/components/ui/calendar';
import * as XLSX from 'xlsx';
import { Progress } from "@/components/ui/progress";
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem } from '@/components/ui/command';
import { cn } from '@/lib/utils';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
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

const CENTRO_LABELS: Record<string, string> = {
  '1000': 'Quito',
  '2000': 'Guayaquil',
};

const CENTRO_BADGE_STYLES: Record<string, string> = {
  '1000': 'bg-blue-50 text-blue-700 hover:bg-blue-50',
  '2000': 'bg-emerald-50 text-emerald-700 hover:bg-emerald-50',
};
const CENTRO_BADGE_FALLBACK = 'bg-gray-100 text-gray-600 hover:bg-gray-100';

// --- Extrae el identificador del plan: todo lo que va después de "Centro XXXX".
// "Plan Táctico - Centro 1000 - PFD" -> "PFD"; "Plan Táctico - Centro 1000 - PFM - N1" -> "PFM - N1" ---
const getPlanIdParts = (valor: string | null | undefined): string[] => {
  if (!valor) return [];
  return valor.split(' - ').map(p => p.trim()).filter(Boolean).slice(2);
};

const getPlanSuffix = (valor: string | null | undefined): string => {
  const parts = getPlanIdParts(valor);
  return parts.length > 0 ? parts.join(' - ') : (valor || '');
};

// --- Solo se quieren Planes de Fabricación Final (identificador que empieza con "PF"),
// ya no los planes "P" + número (P1, P2, P3...) que se usaban antes. ---
const esPlanDeFabricacionFinal = (valor: string | null | undefined): boolean => {
  const [primeraParte] = getPlanIdParts(valor);
  return /^PF/i.test(primeraParte || '');
};

const ActiveGroupsCards: React.FC<{ onSelectGroup: (group: Grupo) => void; selectedGroupId?: number }> = ({ onSelectGroup, selectedGroupId }) => {
  const [groups, setGroups] = useState<Grupo[]>([]);
  const [isLoadingGroups, setIsLoadingGroups] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let isMounted = true;
    grupoService.getAll()
      .then(response => {
        if (!isMounted) return;
        const activeGroups = (response.data || []).filter(g => g.estado === 'A');
        setGroups(activeGroups);
      })
      .catch(err => {
        if (isMounted) setError((err as Error).message);
      })
      .finally(() => {
        if (isMounted) setIsLoadingGroups(false);
      });
    return () => { isMounted = false; };
  }, []);

  const groupsByCentro = useMemo(() => {
    const map = new Map<string, Grupo[]>();
    groups.forEach(group => {
      const list = map.get(group.centro) || [];
      list.push(group);
      map.set(group.centro, list);
    });
    return Array.from(map.entries()).sort(([a], [b]) => a.localeCompare(b));
  }, [groups]);

  if (isLoadingGroups) {
    return (
      <div className="flex items-center justify-center py-8 text-gray-500">
        <Loader2 className="w-5 h-5 animate-spin mr-2" /> Cargando grupos activos...
      </div>
    );
  }

  if (error) {
    return (
      <div className="text-sm text-red-600 bg-red-50 p-3 rounded-md">
        Error al cargar los grupos: {error}
      </div>
    );
  }

  if (groups.length === 0) {
    return (
      <div className="text-center py-8 text-gray-500 text-sm">
        No hay grupos activos registrados.
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {groupsByCentro.map(([centro, centroGroups]) => (
        <div key={centro} className="space-y-3">
          <h4 className="text-xs font-bold uppercase tracking-wide text-gray-500">
            Centro {centro}{CENTRO_LABELS[centro] ? ` · ${CENTRO_LABELS[centro]}` : ''}
          </h4>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
            {centroGroups.map(group => (
              <Card
                key={group.codigo_grupo}
                onClick={() => onSelectGroup(group)}
                className={cn(
                  "cursor-pointer transition-all hover:border-indigo-400 hover:shadow-md",
                  selectedGroupId === group.codigo_grupo ? "border-indigo-500 ring-1 ring-indigo-500" : ""
                )}
              >
                <CardHeader className="p-4 pb-2 flex-row items-start justify-between space-y-0">
                  <p className="font-semibold text-gray-800 leading-tight">{group.nombre_grupo}</p>
                  <Badge variant="secondary" className={cn('shrink-0', CENTRO_BADGE_STYLES[group.centro] || CENTRO_BADGE_FALLBACK)}>
                    {CENTRO_LABELS[group.centro] || `Centro ${group.centro}`}
                  </Badge>
                </CardHeader>
              </Card>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
};

// --- Formatea fechas "YYYY-MM-DD" (o "YYYY-MM-DDTHH:mm:ss...") de SAP sin pasar por el
// parser UTC de `new Date(string)`. Ecuador está en UTC-5: `new Date("2026-08-03")` se
// interpreta como 2026-08-03T00:00:00Z, que al mostrarse en hora local (toLocaleDateString)
// cae en 2026-08-02 19:00 — un día antes de la fecha real. Se arma la fecha con el
// constructor de 3 argumentos (año, mes, día), que sí crea la fecha en hora LOCAL.
const formatFechaSimple = (fecha: string | null | undefined): string => {
  if (!fecha) return '—';
  const [y, m, d] = fecha.slice(0, 10).split('-').map(Number);
  if (!y || !m || !d) return '—';
  return new Date(y, m - 1, d).toLocaleDateString();
};

// --- Conversión "YYYY-MM-DD" <-> Date en hora LOCAL (para el calendario de navegación), mismo
// motivo que formatFechaSimple: evitar el corrimiento de un día que da `new Date(string)`.
const parseFechaLocal = (fechaISO: string): Date => {
  const [y, m, d] = fechaISO.split('-').map(Number);
  return new Date(y, m - 1, d);
};
const toFechaISO = (date: Date): string => {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
};

// --- Ventana de planificación por grupo (pedido por producción). Hoy = día 0. Cada grupo tiene
// un horizonte en días HÁBILES y un modo de presentación:
// - 'diaFijo': se muestra SOLO el día exacto que está a `horizonte` días hábiles de hoy (ej.
//   Ensamblado día 3 = el 4° día hábil contando hoy como el primero). No es un rango, es un
//   único día — pedido explícitamente para Ensamblado y Forros.
// - 'rango': se muestra TODO el rango desde hoy hasta el día `horizonte` (ambos incluidos) —
//   pedido explícitamente para Corte y Laminado y Venta Externa.
// Grupos no mencionados explícitamente por producción (Muebles, Prensado, Taller de Corte,
// Paneles, Formulación) conservan el comportamiento previo (rango) con su horizonte anterior,
// hasta que se confirme una regla puntual para cada uno.
type ModoVentana = 'rango' | 'diaFijo';
const GRUPO_HORIZONTE_CONFIG: Record<string, { horizonte: number; modo: ModoVentana }> = {
  'ensamblado': { horizonte: 3, modo: 'diaFijo' },
  'forros': { horizonte: 2, modo: 'diaFijo' },
  'corte y laminado': { horizonte: 2, modo: 'rango' },
  'venta externa': { horizonte: 2, modo: 'rango' },
  'muebles': { horizonte: 2, modo: 'rango' },
};
const getHorizonteConfig = (nombreGrupoNorm: string): { horizonte: number; modo: ModoVentana } =>
  GRUPO_HORIZONTE_CONFIG[nombreGrupoNorm] || { horizonte: 4, modo: 'rango' };

const esFinDeSemana = (fechaISO: string): boolean => {
  const dow = new Date(`${fechaISO}T00:00:00Z`).getUTCDay();
  return dow === 0 || dow === 6;
};

// Calcula la fecha (YYYY-MM-DD) que está a `diasHabiles` días hábiles de `hoy` (hoy = día 0,
// siempre incluido sin importar si cae en fin de semana o feriado). Un día NO cuenta como hábil
// si es fin de semana (salvo que el grupo sí trabaje fines de semana, ver `trabajaFinDeSemana`
// más abajo) o si es feriado (ver `ecuadorHolidaysService`, ya usado en Restricciones/Feriados
// de este mismo proyecto — es un dato real, no una lista inventada aquí).
const calcularFechaFinVentana = (
  hoy: string,
  diasHabiles: number,
  trabajaFinDeSemana: boolean,
  feriados: Set<string>
): string => {
  let cursor = hoy;
  let contados = 0;
  while (contados < diasHabiles) {
    const [y, m, d] = cursor.split('-').map(Number);
    cursor = new Date(Date.UTC(y, m - 1, d + 1)).toISOString().slice(0, 10);
    const esNoLaborable = (esFinDeSemana(cursor) && !trabajaFinDeSemana) || feriados.has(cursor);
    if (!esNoLaborable) contados++;
  }
  return cursor;
};

// --- Traduce códigos de unidad SAP a etiquetas legibles para personal operativo ---
const formatUnidadOperativa = (unidad: string | null | undefined): string => {
  if (!unidad) return '';
  const code = unidad.toUpperCase().trim();
  if (code === 'ST') return 'UN';
  return code;
};

// --- Tarjeta de KPI reutilizable para resúmenes de plan ---
const StatCard: React.FC<{ label: string; value: string; accent?: string; hint?: string; hintAccent?: string }> = ({ label, value, accent, hint, hintAccent }) => (
  <div className="bg-gray-50 border rounded-lg p-4">
    <p className="text-xs font-medium text-gray-500 uppercase tracking-wide">{label}</p>
    <p className={cn("text-2xl font-bold mt-1", accent || "text-gray-800")}>{value}</p>
    {hint && <p className={cn("text-[11px] mt-1", hintAccent || "text-gray-400")}>{hint}</p>}
  </div>
);

// --- Stepper (Grupo -> Plan de Grupo -> Detalle Táctico) ---
const DRILLDOWN_STEPS = ['Grupo', 'Plan de Grupo', 'Detalle Táctico'];

const Stepper: React.FC<{ currentStep: number }> = ({ currentStep }) => (
  <div className="flex items-center">
    {DRILLDOWN_STEPS.map((label, idx) => {
      const stepNum = idx + 1;
      const isDone = stepNum < currentStep;
      const isActive = stepNum === currentStep;
      return (
        <React.Fragment key={label}>
          <div className="flex items-center space-x-2">
            <div className={cn(
              "w-7 h-7 shrink-0 rounded-full flex items-center justify-center text-xs font-semibold border-2",
              isDone ? "bg-indigo-600 border-indigo-600 text-white" :
              isActive ? "border-indigo-600 text-indigo-600 bg-white" :
              "border-gray-300 text-gray-400 bg-white"
            )}>
              {isDone ? <Check className="w-3.5 h-3.5" /> : stepNum}
            </div>
            <span className={cn(
              "text-sm font-medium whitespace-nowrap",
              isActive ? "text-indigo-700" : isDone ? "text-gray-700" : "text-gray-400"
            )}>{label}</span>
          </div>
          {stepNum < DRILLDOWN_STEPS.length && (
            <div className={cn("flex-1 h-0.5 mx-3", isDone ? "bg-indigo-600" : "bg-gray-200")} />
          )}
        </React.Fragment>
      );
    })}
  </div>
);

// --- Paso 2: Planes de Grupo activos (cards dentro de un panel expandible) ---
const GroupPlansPanel: React.FC<{ group: Grupo; onSelectPlan: (plan: PlanGrupo) => void }> = ({ group, onSelectPlan }) => {
  const [plans, setPlans] = useState<PlanGrupo[]>([]);
  const [isLoadingPlans, setIsLoadingPlans] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let isMounted = true;
    setIsLoadingPlans(true);
    setError(null);
    planGrupoService.getAll()
      .then(response => {
        if (!isMounted) return;
        const activePlans = (response.data || []).filter(
          p => p.codigo_grupo === group.codigo_grupo && p.estado === 'A' && esPlanDeFabricacionFinal(p.valor)
        );
        setPlans(activePlans);
      })
      .catch(err => {
        if (isMounted) setError((err as Error).message);
      })
      .finally(() => {
        if (isMounted) setIsLoadingPlans(false);
      });
    return () => { isMounted = false; };
  }, [group.codigo_grupo]);

  const sortedPlans = useMemo(() => {
    return [...plans].sort((a, b) => new Date(a.fecha_inicio_plan).getTime() - new Date(b.fecha_inicio_plan).getTime());
  }, [plans]);

  return (
    <Accordion type="single" collapsible defaultValue="planes" className="w-full">
      <AccordionItem value="planes" className="border rounded-lg px-4">
        <AccordionTrigger className="text-sm font-semibold text-gray-800 hover:no-underline">
          Planes de Fabricación Final (PF) Activos — {group.nombre_grupo}
        </AccordionTrigger>
        <AccordionContent>
          {isLoadingPlans ? (
            <div className="flex items-center justify-center py-6 text-gray-500">
              <Loader2 className="w-5 h-5 animate-spin mr-2" /> Cargando planes de grupo...
            </div>
          ) : error ? (
            <div className="text-sm text-red-600 bg-red-50 p-3 rounded-md">
              Error al cargar los planes de grupo: {error}
            </div>
          ) : sortedPlans.length === 0 ? (
            <div className="text-center py-6 text-gray-500 text-sm">
              Este grupo no tiene Planes de Fabricación Final (PF) activos por el momento.
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 pb-2">
              {sortedPlans.map(plan => (
                <Card
                  key={plan.codigo_plan_grupo}
                  onClick={() => onSelectPlan(plan)}
                  className="cursor-pointer transition-all hover:border-indigo-400 hover:shadow-md"
                >
                  <CardHeader className="p-4 pb-2 flex-row items-start justify-between space-y-0">
                    <p className="font-semibold text-gray-800 leading-tight">{getPlanSuffix(plan.valor) || plan.valor || `Plan ${plan.codigo_plan}`}</p>
                    <Badge variant="secondary" className={cn('shrink-0', CENTRO_BADGE_STYLES[group.centro] || CENTRO_BADGE_FALLBACK)}>
                      {CENTRO_LABELS[group.centro] || `Centro ${group.centro}`}
                    </Badge>
                  </CardHeader>
                  <CardContent className="p-4 pt-0 text-xs text-gray-500">
                    {new Date(plan.fecha_inicio_plan).toLocaleDateString()} — {new Date(plan.fecha_fin_plan).toLocaleDateString()}
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </AccordionContent>
      </AccordionItem>
    </Accordion>
  );
};

// --- Orden de fabricación real (SAP), tal como la devuelve OrdenesFertPaginadas ---
interface OrdenFert {
  CENTRO: string;
  ORDEN: string;
  MATERIAL: string;
  NOMBRE: string;
  CATEGORIA: string;
  CANTPROGRAMADA: number;
  CANTENTREGADA: number;
  CANTNOTIFICADA: number;
  CANTRECHAZO: number;
  CANTPENDIENTE: number;
  UNIDAD: string;
  FECHA: string;
  FECHAORDEN: string;
  RESPCTRLPROD: string;
  MAQUINA: string;
  PUESTOTRABAJO: string;
  PEDIDO: string;
  CANTPROGPESONETO: number;
  [key: string]: any;
}

// --- Tiempo estándar de fabricación por material + puesto de trabajo (TiemposEnsamblado) ---
interface TiempoEnsamblePorGrupo {
  CodMaterial: string;
  PuestoTrabajo: string;
  Linea: string;
  Tiempo_Min: number;
  [key: string]: any;
}

// --- Maestro Looper: tiempo y peso estándar POR ROLLO para materiales de Corte y Laminado ---
interface KPILooperItem {
  Material: string;
  Descripcion: string;
  PesoUN: number;
  TiempoRolloMin: number;
  [key: string]: any;
}

// --- Maestro de Forros: tiempo promedio estándar por material (KPIMaestroForros) ---
interface KPIForrosItem {
  CodigoMaterial: string;
  HRUTA: string;
  TPromedio: number;
  Categoria: string;
  [key: string]: any;
}

// Procesos donde el peso en KG no es un dato relevante para el planificador (piden ocultarlo)
const PROCESOS_SIN_TARJETA_PESO = new Set(['ensamblado', 'forros', 'muebles']);

const formatDuracionMin = (min: number): string => {
  if (min >= 60) return `${(min / 60).toLocaleString(undefined, { maximumFractionDigits: 1 })} h`;
  return `${min.toLocaleString(undefined, { maximumFractionDigits: 1 })} min`;
};

// --- Paso 3: Órdenes de fabricación (SAP) abiertas para los materiales del plan seleccionado ---
const PlanTacticalDetailsTable: React.FC<{ plan: PlanGrupo; grupo: Grupo }> = ({ plan, grupo }) => {
  const centro = grupo.centro;
  const nombreGrupoNorm = (grupo.nombre_grupo || '').toLowerCase().trim();
  const isEnsamblado = nombreGrupoNorm === 'ensamblado';
  const isForros = nombreGrupoNorm === 'forros';
  const isMuebles = nombreGrupoNorm === 'muebles';
  const isCorteLaminado = nombreGrupoNorm === 'corte y laminado';
  const ocultarTarjetaPeso = PROCESOS_SIN_TARJETA_PESO.has(nombreGrupoNorm);
  // Ensamblado y Muebles se agrupan en bloques por Puesto de Trabajo (PUESTOTRABAJO); Forros
  // por Máquina/Hoja de Ruta (MAQUINA). En los tres casos el puesto ya queda implícito en el
  // bloque seleccionado, así que no hace falta repetirlo como columna.
  const showBlockSelector = isEnsamblado || isForros || isMuebles;
  const blockField: 'PUESTOTRABAJO' | 'MAQUINA' = isForros ? 'MAQUINA' : 'PUESTOTRABAJO';
  const blockLabel = isEnsamblado ? 'Línea' : isMuebles ? 'Puesto de Trabajo' : 'Máquina / Hoja de Ruta';
  // Corte y Laminado: a pedido explícito, se simplifica la tabla y el detalle quitando columnas
  // y campos que no aportan a ese proceso (Resp. Ctrl. Prod., Puesto de Trabajo, Categoría,
  // Pedido de Ventas, Cant. Entregada, Cant. Rechazada, Peso Real Notificado y Tiempo STD
  // Planificado de la orden) — el resto de grupos no cambia.
  const showPuestoColumn = !showBlockSelector && !isCorteLaminado;
  const showRespCtrlProdColumn = !isCorteLaminado;

  const [scopeDetails, setScopeDetails] = useState<DetalleTactico[]>([]);
  const [ordenes, setOrdenes] = useState<OrdenFert[]>([]);
  const [tiempos, setTiempos] = useState<TiempoEnsamblePorGrupo[]>([]);
  const [looper, setLooper] = useState<KPILooperItem[]>([]);
  const [kpiForros, setKpiForros] = useState<KPIForrosItem[]>([]);
  const [isLoadingScope, setIsLoadingScope] = useState(true);
  const [isLoadingOrdenes, setIsLoadingOrdenes] = useState(true);
  const [isLoadingTiempos, setIsLoadingTiempos] = useState(true);
  const [isLoadingTiemposFallback, setIsLoadingTiemposFallback] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [expandedRows, setExpandedRows] = useState<Set<string>>(new Set());
  const [rollosFabricados, setRollosFabricados] = useState<Record<string, string>>({});
  const [selectedLinea, setSelectedLinea] = useState<string | null>(null);
  const [feriados, setFeriados] = useState<Set<string>>(new Set());
  const [fechaSeleccionada, setFechaSeleccionada] = useState<string | null>(null);
  const [isCalendarOpen, setIsCalendarOpen] = useState(false);
  // A pedido explícito: al entrar a Detalle Táctico no se muestra nada hasta que el usuario
  // elija una fecha (a mano en el calendario, o aceptando la sugerida). Empieza en `false` y se
  // reinicia cada vez que cambia el plan/grupo seleccionado (ver el useEffect más abajo), para
  // que la pantalla vuelva a pedir la fecha en cada entrada.
  const [vistaConfirmada, setVistaConfirmada] = useState(false);
  const [planesDelGrupo, setPlanesDelGrupo] = useState<PlanGrupo[]>([]);

  const toggleRow = (id: string) => {
    setExpandedRows(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };

  const isMountedRef = useRef(true);
  useEffect(() => {
    isMountedRef.current = true;
    return () => { isMountedRef.current = false; };
  }, []);

  // Define el alcance: qué materiales pertenecen a este Plan de Grupo. La planificación
  // interna (DetalleTactico) sigue siendo la fuente de "qué se planificó" y de datos que
  // solo existen a nivel de plan (Clase Aprov.). Nota: se verificó contra datos reales que
  // `resp_ctrl_prod` y `linea_produccion` vienen vacíos en DetalleTactico para casi todos los
  // grupos, por eso el planificador (RESPCTRLPROD) y el puesto/línea se toman de la orden
  // FERT real, no de este origen.
  const fetchScope = useCallback(() => {
    setIsLoadingScope(true);
    setError(null);
    return detalleTacticoService.getAll()
      .then(response => {
        if (!isMountedRef.current) return;
        const planDetails = (response.data || []).filter(
          d => d.codigo_plan_grupo === plan.codigo_plan_grupo && d.estado === 'A'
        );
        setScopeDetails(planDetails);
      })
      .catch(err => {
        if (isMountedRef.current) setError((err as Error).message);
      })
      .finally(() => {
        if (isMountedRef.current) setIsLoadingScope(false);
      });
  }, [plan.codigo_plan_grupo]);

  // Trae las órdenes de fabricación reales (SAP). El propio servicio ya excluye las
  // órdenes que producción ya notificó por completo (confirmado: 100% de lo que devuelve
  // tiene CANTPENDIENTE > 0), así que llamar esto de nuevo es todo lo que hace falta para
  // que una orden recién notificada desaparezca de la lista.
  // rowsPerPage=10000: se verificó que el sistema tiene ~5013 órdenes abiertas en total;
  // con 5000 se truncaban ~13 órdenes silenciosamente.
  const fetchOrdenes = useCallback((isManualRefresh: boolean) => {
    if (isManualRefresh) setIsRefreshing(true); else setIsLoadingOrdenes(true);
    return serviciosService.getOrdenesFert(1, 10000)
      .then(response => {
        if (!isMountedRef.current) return;
        setOrdenes((response.data || []) as OrdenFert[]);
      })
      .catch(err => {
        if (isMountedRef.current) setError((err as Error).message);
      })
      .finally(() => {
        if (!isMountedRef.current) return;
        if (isManualRefresh) setIsRefreshing(false); else setIsLoadingOrdenes(false);
      });
  }, []);

  // Tiempo estándar de fabricación por material+puesto para este grupo/centro. Solo se usa
  // para procesos SIN maestro dedicado (ej. Ensamblado, que no tiene un KPIMaestro propio —
  // se verificó explícitamente, ver nota más abajo). No bloquea la carga principal: si falla
  // o tarda, la tarjeta de Tiempo STD simplemente no aparece.
  const fetchTiempos = useCallback(() => {
    if (isCorteLaminado || isForros) {
      setTiempos([]);
      setIsLoadingTiempos(false);
      return Promise.resolve();
    }
    setIsLoadingTiempos(true);
    return serviciosService.getTiemposEnsambladobyCentroyCodigoGrupo(centro, grupo.codigo_grupo)
      .then(response => {
        if (!isMountedRef.current) return;
        setTiempos((response.data || []) as TiempoEnsamblePorGrupo[]);
      })
      .catch(() => {
        if (isMountedRef.current) setTiempos([]);
      })
      .finally(() => {
        if (isMountedRef.current) setIsLoadingTiempos(false);
      });
  }, [centro, grupo.codigo_grupo, isCorteLaminado, isForros]);

  // Maestro Looper (Corte y Laminado): peso y tiempo estándar POR ROLLO. Las cantidades
  // pendientes de las órdenes vienen en KG, así que rollos = Cant. Pendiente / PesoUN.
  // Reutiliza isLoadingTiempos (mismo rol que fetchTiempos, pero para este proceso).
  const fetchLooper = useCallback(() => {
    if (!isCorteLaminado) {
      setLooper([]);
      return Promise.resolve();
    }
    setIsLoadingTiempos(true);
    return serviciosService.getKPIMaestroLooper()
      .then(response => {
        if (!isMountedRef.current) return;
        setLooper((response.data || []) as KPILooperItem[]);
      })
      .catch(() => {
        if (isMountedRef.current) setLooper([]);
      })
      .finally(() => {
        if (isMountedRef.current) setIsLoadingTiempos(false);
      });
  }, [isCorteLaminado]);

  // Maestro de Forros (KPIMaestroForros): tiempo promedio estándar por material — verificado
  // en vivo (428/438 órdenes vigentes con dato, ~98% cobertura), es la fuente correcta para
  // este proceso en lugar del TiemposEnsamblado genérico.
  const fetchKpiForros = useCallback(() => {
    if (!isForros) {
      setKpiForros([]);
      return Promise.resolve();
    }
    setIsLoadingTiempos(true);
    return serviciosService.getKPIMaestroForros()
      .then(response => {
        if (!isMountedRef.current) return;
        setKpiForros((response.data || []) as KPIForrosItem[]);
      })
      .catch(() => {
        if (isMountedRef.current) setKpiForros([]);
      })
      .finally(() => {
        if (isMountedRef.current) setIsLoadingTiempos(false);
      });
  }, [isForros]);

  const handleRefresh = () => {
    fetchScope();
    fetchOrdenes(true);
  };

  useEffect(() => { fetchScope(); }, [fetchScope]);
  useEffect(() => { fetchOrdenes(false); }, [fetchOrdenes]);
  useEffect(() => { fetchTiempos(); }, [fetchTiempos]);
  useEffect(() => { fetchLooper(); }, [fetchLooper]);
  useEffect(() => { fetchKpiForros(); }, [fetchKpiForros]);

  // Feriados de Ecuador reales (mismo servicio que ya usa la pantalla de Restricciones), para
  // no contar como "día hábil" un feriado dentro de la ventana de planificación. Se pide un
  // rango con margen (21 días corridos) para no quedarse corto si hay varios feriados seguidos.
  useEffect(() => {
    let isMounted = true;
    const hoyDate = new Date();
    const limiteDate = new Date(hoyDate.getTime() + 21 * 86400000);
    ecuadorHolidaysService.getHolidaysForRange(hoyDate, limiteDate)
      .then(lista => { if (isMounted) setFeriados(new Set(lista.map(h => h.date))); })
      .catch(() => { if (isMounted) setFeriados(new Set()); });
    return () => { isMounted = false; };
  }, []);

  // Todos los Planes de Grupo (cualquier estado/fecha visible) de este mismo grupo, usados
  // únicamente para detectar si el grupo trabaja fines de semana: si alguna vez se ha
  // planificado un sábado o domingo para este codigo_grupo, se asume que sí trabaja fin de
  // semana. Es una señal real tomada de la data, no una lista fija por grupo.
  useEffect(() => {
    let isMounted = true;
    planGrupoService.getAll()
      .then(response => {
        if (!isMounted) return;
        setPlanesDelGrupo((response.data || []).filter(p => p.codigo_grupo === grupo.codigo_grupo));
      })
      .catch(() => { if (isMounted) setPlanesDelGrupo([]); });
    return () => { isMounted = false; };
  }, [grupo.codigo_grupo]);

  // Rollos Fabricados (Corte y Laminado): registro que llenan planta/asistentes. Hoy no
  // existe un endpoint en el backend para esto, así que se guarda localmente en el
  // navegador por plan — se deja explícito en la UI que aún no sincroniza con SAP.
  const rollosStorageKey = `chaide_rollos_fabricados_plan_${plan.codigo_plan_grupo}`;
  useEffect(() => {
    if (!isCorteLaminado || typeof window === 'undefined') return;
    try {
      const raw = window.localStorage.getItem(rollosStorageKey);
      if (raw) setRollosFabricados(JSON.parse(raw));
    } catch {
      // ignorar registros locales corruptos
    }
  }, [rollosStorageKey, isCorteLaminado]);

  const handleRollosChange = (orden: string, value: string) => {
    setRollosFabricados(prev => {
      const next = { ...prev, [orden]: value };
      try {
        window.localStorage.setItem(rollosStorageKey, JSON.stringify(next));
      } catch {
        // almacenamiento local no disponible; el valor sigue visible en memoria
      }
      return next;
    });
  };

  // Mapa material (normalizado) -> datos de planificación del plan, para heredar
  // Clase Aprov. en cada orden real que haga match.
  const scopeByMaterial = useMemo(() => {
    const map = new Map<string, DetalleTactico>();
    scopeDetails.forEach(d => map.set(normalizeMaterialCode(d.codigo_material), d));
    return map;
  }, [scopeDetails]);

  // Tiempo estándar por material: primero intenta material+puesto exacto de la orden;
  // si no hay coincidencia, cae al primer tiempo registrado para ese material.
  const tiempoPorMaterialPuesto = useMemo(() => {
    const map = new Map<string, number>();
    tiempos.forEach(t => {
      const key = `${normalizeMaterialCode(t.CodMaterial)}|${t.PuestoTrabajo}`;
      if (!map.has(key)) map.set(key, Number(t.Tiempo_Min) || 0);
    });
    return map;
  }, [tiempos]);

  const tiempoPorMaterial = useMemo(() => {
    const map = new Map<string, number>();
    tiempos.forEach(t => {
      const key = normalizeMaterialCode(t.CodMaterial);
      if (!map.has(key)) map.set(key, Number(t.Tiempo_Min) || 0);
    });
    return map;
  }, [tiempos]);

  const getTiempoMinPorUnidad = useCallback((o: OrdenFert): number | null => {
    const materialKey = normalizeMaterialCode(o.MATERIAL);
    const conPuesto = tiempoPorMaterialPuesto.get(`${materialKey}|${o.PUESTOTRABAJO}`);
    if (conPuesto !== undefined) return conPuesto;
    const soloMaterial = tiempoPorMaterial.get(materialKey);
    return soloMaterial !== undefined ? soloMaterial : null;
  }, [tiempoPorMaterialPuesto, tiempoPorMaterial]);

  // Maestro Looper por material (Corte y Laminado): peso y tiempo estándar por rollo.
  const looperPorMaterial = useMemo(() => {
    const map = new Map<string, KPILooperItem>();
    looper.forEach(l => {
      const key = normalizeMaterialCode(l.Material);
      if (!map.has(key)) map.set(key, l);
    });
    return map;
  }, [looper]);

  // Rollos planificados de una orden = Cant. Programada (en KG) / Peso por Rollo (KG/rollo).
  // Se usa Cant. Programada (no Pendiente) a pedido explícito: el tiempo/rollos STD debe
  // reflejar el plan completo, no solo lo que falta por notificar.
  const getRollosPlanificados = useCallback((o: OrdenFert): number | null => {
    const info = looperPorMaterial.get(normalizeMaterialCode(o.MATERIAL));
    const pesoUn = Number(info?.PesoUN) || 0;
    if (!info || pesoUn <= 0) return null;
    return (Number(o.CANTPROGRAMADA) || 0) / pesoUn;
  }, [looperPorMaterial]);

  // Maestro de Forros: TPromedio (segundos/unidad) por Material+Máquina (HRUTA), con respaldo
  // solo-por-material. IMPORTANTE (verificado con datos reales): 1717 de 4389 materiales
  // (39%) tienen VARIOS registros — uno por cada máquina/HRUTA donde ese material puede
  // fabricarse — con TPromedio muy distinto entre sí (hasta 2.5x de diferencia). Tomar el
  // primero sin más (como hacía antes) afecta al 37% de las órdenes abiertas de Forros. Por
  // eso se cruza primero por Material+Máquina exacto (igual que TacticalPlanForrosSection.tsx,
  // la pantalla de referencia que ya usa este maestro), y solo si no hay esa combinación
  // exacta, se cae al primer registro del material como respaldo.
  const kpiForrosPorMaterialMaquina = useMemo(() => {
    const map = new Map<string, KPIForrosItem>();
    kpiForros.forEach(k => {
      const key = `${normalizeMaterialCode(k.CodigoMaterial)}|${String(k.HRUTA || '').toUpperCase().trim()}`;
      if (!map.has(key)) map.set(key, k);
    });
    return map;
  }, [kpiForros]);

  const kpiForrosPorMaterial = useMemo(() => {
    const map = new Map<string, KPIForrosItem>();
    kpiForros.forEach(k => {
      const key = normalizeMaterialCode(k.CodigoMaterial);
      if (!map.has(key)) map.set(key, k);
    });
    return map;
  }, [kpiForros]);

  // Tiempo estándar por unidad para Forros, en minutos (TPromedio viene en SEGUNDOS — se
  // confirmó revisando TacticalPlanForrosSection.tsx, cuya función se llama literalmente
  // `getKPITimeSecondsForOrder` y convierte otras fuentes con `* 60` para calzar con
  // TPromedio; usarlo directo como minutos infla el tiempo ~60x). Se verificó también que la
  // pantalla de referencia NO restringe por unidad de la orden (ST/M/KG) — TPromedio es una
  // tasa por la cantidad que sea, así que aquí tampoco se restringe.
  const getTiempoForrosMinPorUnidad = useCallback((o: OrdenFert): number | null => {
    const materialKey = normalizeMaterialCode(o.MATERIAL);
    const maquinaKey = String(o.MAQUINA || '').toUpperCase().trim();
    const info = kpiForrosPorMaterialMaquina.get(`${materialKey}|${maquinaKey}`) || kpiForrosPorMaterial.get(materialKey);
    if (!info) return null;
    return (Number(info.TPromedio) || 0) / 60;
  }, [kpiForrosPorMaterialMaquina, kpiForrosPorMaterial]);

  // Tiempo STD planificado de una orden, en minutos. Usa Cant. Programada (no Pendiente) a
  // pedido explícito: la idea es reflejar el tiempo del plan completo tal como se definió,
  // no un número que baja a medida que se notifica (lo cual generaba dudas al presentarlo).
  // - Corte y Laminado: maestro Looper (rollos planificados x minutos por rollo).
  // - Forros: maestro KPIMaestroForros, ver getTiempoForrosMinPorUnidad.
  // - Resto de procesos: tiempo estándar por unidad de TiemposEnsamblado (o su respaldo) x
  //   Cant. Programada. (Se verificó que no existe un KPIMaestro dedicado para Ensamblado.)
  const getTiempoPlanificadoMin = useCallback((o: OrdenFert): number | null => {
    if (isCorteLaminado) {
      const info = looperPorMaterial.get(normalizeMaterialCode(o.MATERIAL));
      const rollos = getRollosPlanificados(o);
      if (!info || rollos === null) return null;
      return rollos * (Number(info.TiempoRolloMin) || 0);
    }
    if (isForros) {
      const tiempoMinPorUnidad = getTiempoForrosMinPorUnidad(o);
      if (tiempoMinPorUnidad === null) return null;
      return tiempoMinPorUnidad * (Number(o.CANTPROGRAMADA) || 0);
    }
    const tiempoMin = getTiempoMinPorUnidad(o);
    if (tiempoMin === null) return null;
    return tiempoMin * (Number(o.CANTPROGRAMADA) || 0);
  }, [isCorteLaminado, isForros, looperPorMaterial, getRollosPlanificados, getTiempoForrosMinPorUnidad, getTiempoMinPorUnidad]);

  const today = new Date().toISOString().slice(0, 10);

  // Vigencia propia del Plan de Grupo seleccionado (fecha_inicio_plan/fecha_fin_plan) — se
  // conserva solo como referencia informativa (qué "día" representa este PF puntual), ya NO
  // se usa para acotar qué órdenes se muestran (ver `ventanaFechaFin` más abajo).
  const planFechaInicio = new Date(plan.fecha_inicio_plan).toISOString().slice(0, 10);
  const planFechaFin = new Date(plan.fecha_fin_plan).toISOString().slice(0, 10);

  // ¿Este grupo trabaja fines de semana? Señal real: si algún Plan de Grupo de este mismo
  // codigo_grupo (cualquiera, no solo el seleccionado) tuvo vigencia en sábado o domingo, se
  // asume que sí trabaja fin de semana. No es una lista fija por grupo — se recalcula con la
  // data real cada vez.
  const trabajaFinDeSemana = useMemo(() => {
    return planesDelGrupo.some(p => {
      const inicio = new Date(p.fecha_inicio_plan).toISOString().slice(0, 10);
      const fin = new Date(p.fecha_fin_plan).toISOString().slice(0, 10);
      return esFinDeSemana(inicio) || esFinDeSemana(fin);
    });
  }, [planesDelGrupo]);

  // Horizonte y modo de este grupo (ver GRUPO_HORIZONTE_CONFIG): 'diaFijo' (Ensamblado, Forros)
  // muestra un único día puntual; 'rango' (Corte y Laminado, Venta Externa, y el resto por
  // defecto) muestra todo el tramo desde hoy hasta ese día. Ambos casos usan la misma fórmula de
  // días hábiles (fin de semana + feriados reales de Ecuador vía ecuadorHolidaysService).
  const { horizonte: horizonteDiasHabiles, modo: modoVentana } = getHorizonteConfig(nombreGrupoNorm);
  const fechaObjetivo = useMemo(
    () => calcularFechaFinVentana(today, horizonteDiasHabiles, trabajaFinDeSemana, feriados),
    [today, horizonteDiasHabiles, trabajaFinDeSemana, feriados]
  );
  // En modo 'diaFijo' el límite inferior también es la fecha objetivo (un solo día); en 'rango'
  // el límite inferior es hoy.
  const ventanaFechaInicio = modoVentana === 'diaFijo' ? fechaObjetivo : today;
  const ventanaFechaFin = fechaObjetivo;

  // Cruce real: solo órdenes FERT del centro de este grupo, para un material planificado en
  // este plan, con fecha dentro de la ventana de planificación del grupo (ver arriba). Antes
  // esto se acotaba a la vigencia puntual del Plan de Grupo (casi siempre un solo día) — se
  // amplió a pedido explícito de producción. Los planificadores pidieron no ver vencidas: se
  // encontraron órdenes "pendientes" en SAP con FECHA de hasta 15 años de antigüedad, que solo
  // generaban ruido en esta vista. (Se verificó también que no hay materiales ambiguos entre
  // grupos de un mismo centro, así que cruzar por Centro + Material es seguro.)
  const matchedOrdenes = useMemo(() => {
    if (scopeByMaterial.size === 0) return [];
    return ordenes
      .filter(o =>
        String(o.CENTRO) === String(centro) &&
        scopeByMaterial.has(normalizeMaterialCode(o.MATERIAL)) &&
        o.FECHA >= ventanaFechaInicio &&
        o.FECHA <= ventanaFechaFin
      )
      .sort((a, b) => {
        if (a.FECHA !== b.FECHA) return a.FECHA.localeCompare(b.FECHA);
        return a.ORDEN.localeCompare(b.ORDEN);
      });
  }, [ordenes, scopeByMaterial, centro, ventanaFechaInicio, ventanaFechaFin]);

  // Todas las fechas (sin acotar a la ventana de N días hábiles) donde hay órdenes vigentes
  // para el alcance de este plan — alimenta el calendario de navegación: deja "llevar el
  // control" de fechas con planificación aunque estén más allá de la ventana automática.
  const fechasConOrdenes = useMemo(() => {
    const set = new Set<string>();
    if (scopeByMaterial.size === 0) return set;
    ordenes.forEach(o => {
      if (String(o.CENTRO) === String(centro) && o.FECHA >= today && scopeByMaterial.has(normalizeMaterialCode(o.MATERIAL))) {
        set.add(o.FECHA);
      }
    });
    return set;
  }, [ordenes, scopeByMaterial, centro, today]);

  // Órdenes que se muestran realmente: si el usuario eligió una fecha puntual en el calendario,
  // se muestra solo ese día (aunque esté fuera de la ventana automática); si no, se muestra la
  // ventana completa (`matchedOrdenes`).
  const ordenesVisibles = useMemo(() => {
    if (!fechaSeleccionada) return matchedOrdenes;
    return ordenes
      .filter(o =>
        String(o.CENTRO) === String(centro) &&
        scopeByMaterial.has(normalizeMaterialCode(o.MATERIAL)) &&
        o.FECHA === fechaSeleccionada
      )
      .sort((a, b) => a.ORDEN.localeCompare(b.ORDEN));
  }, [fechaSeleccionada, matchedOrdenes, ordenes, centro, scopeByMaterial]);

  // Peso planificado (mismo criterio que Tiempo STD: se usa el plan completo, no lo
  // pendiente, para que el número no cambie según cuánto se ha notificado y sea consistente
  // al presentar a gerencia).
  // - Corte y Laminado: Rollos Planificados x Peso por Rollo (maestro Looper) — misma fuente
  //   que ya se usa para el tiempo, evitando que peso y tiempo salgan de dos maestros
  //   distintos que podrían no coincidir.
  // - Resto de procesos: CANTPROGPESONETO de la propia orden FERT (ya es el peso neto de la
  //   cantidad programada, no requiere prorrateo).
  const pesoStats = useMemo(() => {
    let total = 0;
    let ordenesConPeso = 0;
    let ordenesSinPeso = 0;

    ordenesVisibles.forEach(o => {
      let pesoOrden: number | null = null;
      if (isCorteLaminado) {
        const info = looperPorMaterial.get(normalizeMaterialCode(o.MATERIAL));
        const rollos = getRollosPlanificados(o);
        if (info && rollos !== null) pesoOrden = rollos * (Number(info.PesoUN) || 0);
      } else {
        const pesoProgramado = Number(o.CANTPROGPESONETO) || 0;
        if (pesoProgramado > 0) pesoOrden = pesoProgramado;
      }

      if (pesoOrden !== null && pesoOrden > 0) {
        total += pesoOrden;
        ordenesConPeso += 1;
      } else {
        ordenesSinPeso += 1;
      }
    });

    return { total, ordenesConPeso, ordenesSinPeso };
  }, [ordenesVisibles, isCorteLaminado, looperPorMaterial, getRollosPlanificados]);

  // Estadística de tiempo STD (planificado, ver getTiempoPlanificadoMin). Ya no se muestra
  // como tarjeta agregada del plan completo (se quitó a pedido explícito: el número total
  // no generaba confianza para presentar a gerencia). Se conserva el cálculo porque sigue
  // usándose por bloque (línea/máquina) y por orden en el detalle.
  const tiempoStats = useMemo(() => {
    let totalMin = 0;
    let ordenesConTiempo = 0;
    let ordenesSinTiempo = 0;

    matchedOrdenes.forEach(o => {
      const tiempoOrdenMin = getTiempoPlanificadoMin(o);
      if (tiempoOrdenMin !== null && tiempoOrdenMin > 0) {
        totalMin += tiempoOrdenMin;
        ordenesConTiempo += 1;
      } else {
        ordenesSinTiempo += 1;
      }
    });

    return { totalMin, ordenesConTiempo, ordenesSinTiempo };
  }, [matchedOrdenes, getTiempoPlanificadoMin]);

  // Respaldo: se verificó contra datos reales que el filtro por grupo de
  // TiemposEnsambladoPorCentroYCodigoGrupo no cubre todos los grupos por igual (0% para
  // Corte y Laminado, ~100% para Ensamblado/Forros — parece ser una clasificación de SAP
  // que no coincide 1 a 1 con nuestros grupos). Si el resultado inicial no cubre ninguna
  // orden vigente, se reintenta una sola vez contra el maestro completo de tiempos
  // (sin filtrar por grupo) y se filtra en el cliente solo a los materiales que hacen falta.
  const fallbackTiemposTriedRef = useRef(false);
  useEffect(() => {
    fallbackTiemposTriedRef.current = false;
  }, [plan.codigo_plan_grupo, grupo.codigo_grupo]);

  useEffect(() => {
    if (isCorteLaminado || isForros) return; // usan su propio maestro (Looper / KPIMaestroForros), no este respaldo
    if (isLoadingScope || isLoadingOrdenes || isLoadingTiempos) return;
    if (fallbackTiemposTriedRef.current) return;
    if (matchedOrdenes.length === 0 || tiempoStats.ordenesConTiempo > 0) return;

    fallbackTiemposTriedRef.current = true;
    setIsLoadingTiemposFallback(true);
    const materialesNecesarios = new Set(matchedOrdenes.map(o => normalizeMaterialCode(o.MATERIAL)));

    serviciosService.getTiemposEnsamblado(1, 30000)
      .then(response => {
        if (!isMountedRef.current) return;
        const relevantes = ((response.data || []) as TiempoEnsamblePorGrupo[])
          .filter(t => String(t.Centro) === String(centro) && materialesNecesarios.has(normalizeMaterialCode(t.CodMaterial)));
        if (relevantes.length > 0) setTiempos(prev => [...prev, ...relevantes]);
      })
      .catch(() => {
        // sin respaldo disponible; la tarjeta de Tiempo STD simplemente no aparece
      })
      .finally(() => {
        if (isMountedRef.current) setIsLoadingTiemposFallback(false);
      });
  }, [isCorteLaminado, isForros, isLoadingScope, isLoadingOrdenes, isLoadingTiempos, matchedOrdenes, tiempoStats.ordenesConTiempo, centro]);

  // Ensamblado: agrupa por LÍNEA FÍSICA REAL, derivada de la máquina (MAQUINA), no de
  // PUESTOTRABAJO. Se verificó con datos reales que "ARMAD-01", "ARMAD-02" y las órdenes sin
  // PUESTOTRABAJO asignado usan exactamente la misma máquina (HR-ARM01, HR-ARM02, HR-ARM03)
  // que CHN.L01, CHN.L02 y CHN.L03 respectivamente — no son líneas aparte, son la misma línea
  // con el campo PUESTOTRABAJO inconsistente en un subconjunto de órdenes de SAP.
  // IMPORTANTE (aclarado por el planificador): en Centro 2000 (Guayaquil) SAP nombra las
  // máquinas HR-ARM21/22/25 en vez de HR-ARM01/02/05 — se verificó contra TODO el histórico
  // de órdenes (ambos centros, todas las fechas) que Centro 1000 usa exclusivamente ARM01-05 y
  // Centro 2000 exclusivamente ARM21/22/25, sin solapamiento. El "2" inicial es el centro
  // (Guayaquil), no una línea nueva: son las mismas 5 líneas físicas replicadas en la otra
  // planta. Sin este ajuste la pantalla mostraba "Línea 21/22/25" en Guayaquil, lo cual no
  // coincide con cómo el planificador nombra sus líneas (Línea 1, 2, 5) y generaba confusión.
  const getEnsambladoLineaKey = useCallback((o: OrdenFert): string => {
    const match = String(o.MAQUINA || '').toUpperCase().match(/ARM[-_]?(\d+)/);
    if (match) {
      const lineaFisica = parseInt(match[1], 10) % 10;
      return `Línea ${String(lineaFisica).padStart(2, '0')}`;
    }
    return o.PUESTOTRABAJO || o.MAQUINA || 'Sin línea asignada';
  }, []);

  // Forros: agrupa por Máquina/Hoja de Ruta (ej. HR-FORRO, HR-PEF09), pedido explícitamente
  // como ayuda visual para el asistente de producción. Muebles: agrupa por Puesto de Trabajo.
  // Cada bloque se muestra como una tarjeta seleccionable; su planificación se abre al hacer clic.
  const bloques = useMemo(() => {
    if (!showBlockSelector) return null;
    const map = new Map<string, OrdenFert[]>();
    ordenesVisibles.forEach(o => {
      const clave = isEnsamblado ? getEnsambladoLineaKey(o) : (o[blockField] || 'Sin asignar');
      const list = map.get(clave) || [];
      list.push(o);
      map.set(clave, list);
    });
    return Array.from(map.entries())
      .map(([nombre, ordenesBloque]) => {
        const tiempoTotalMin = ordenesBloque.reduce((sum, o) => sum + (getTiempoPlanificadoMin(o) || 0), 0);
        const materialesDistintos = new Set(ordenesBloque.map(o => normalizeMaterialCode(o.MATERIAL))).size;
        // Unidades planificadas por línea (Ensamblado): mismo criterio que la tarjeta "Unidades a
        // Fabricar" del grupo completo (Cant. Programada), solo que aquí es por línea. Se valida
        // que todas las órdenes del bloque compartan unidad, igual que la tarjeta general.
        let unidadesTotal: number | null = null;
        let unidadLabel = '';
        if (isEnsamblado) {
          const unidadesDistintas = new Set(ordenesBloque.map(o => o.UNIDAD));
          if (unidadesDistintas.size === 1) {
            unidadesTotal = ordenesBloque.reduce((sum, o) => sum + (Number(o.CANTPROGRAMADA) || 0), 0);
            unidadLabel = formatUnidadOperativa(ordenesBloque[0].UNIDAD);
          }
        }
        return { nombre, ordenes: ordenesBloque, tiempoTotalMin, materialesDistintos, unidadesTotal, unidadLabel };
      })
      .sort((a, b) => a.nombre.localeCompare(b.nombre));
  }, [ordenesVisibles, showBlockSelector, isEnsamblado, blockField, getEnsambladoLineaKey, getTiempoPlanificadoMin]);

  useEffect(() => {
    setSelectedLinea(null);
  }, [plan.codigo_plan_grupo]);

  useEffect(() => {
    setFechaSeleccionada(null);
    setVistaConfirmada(false);
  }, [plan.codigo_plan_grupo]);

  const isLoading = isLoadingScope || isLoadingOrdenes;

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-8 text-gray-500">
        <Loader2 className="w-5 h-5 animate-spin mr-2" /> Cargando órdenes de fabricación...
      </div>
    );
  }

  if (error) {
    return (
      <div className="text-sm text-red-600 bg-red-50 p-3 rounded-md">
        Error al cargar las órdenes de fabricación: {error}
      </div>
    );
  }

  if (scopeDetails.length === 0) {
    return (
      <div className="text-center py-8 text-gray-500 text-sm">
        Este plan no tiene detalles tácticos activos.
      </div>
    );
  }

  // Calendario de navegación (arriba a la derecha): deja saltar a cualquier fecha con
  // planificación real, aunque esté fuera de la ventana automática de días hábiles. Solo se
  // pueden elegir días marcados (con órdenes); el resto queda deshabilitado para no llevar al
  // usuario a una fecha vacía por error.
  const calendarPicker = (
    <Popover open={isCalendarOpen} onOpenChange={setIsCalendarOpen}>
      <PopoverTrigger asChild>
        <Button variant="outline" size="sm">
          <CalendarIcon className="w-4 h-4 mr-1.5" />
          {fechaSeleccionada ? formatFechaSimple(fechaSeleccionada) : 'Ver fechas'}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-auto p-0" align="end">
        <Calendar
          mode="single"
          selected={fechaSeleccionada ? parseFechaLocal(fechaSeleccionada) : undefined}
          onSelect={(date) => {
            if (!date) return;
            setFechaSeleccionada(toFechaISO(date));
            setIsCalendarOpen(false);
          }}
          disabled={(date) => !fechasConOrdenes.has(toFechaISO(date))}
          modifiers={{ conPlan: (date) => fechasConOrdenes.has(toFechaISO(date)) }}
          modifiersClassNames={{ conPlan: 'bg-indigo-100 text-indigo-700 font-semibold hover:bg-indigo-200' }}
        />
        <div className="flex items-center justify-between gap-2 px-3 py-2 border-t text-[11px]">
          <span className="flex items-center gap-1.5 text-gray-500">
            <span className="w-2.5 h-2.5 rounded-sm bg-indigo-100 border border-indigo-300 inline-block" /> Con planificación
          </span>
          {fechaSeleccionada && (
            <button
              type="button"
              onClick={() => { setFechaSeleccionada(null); setVistaConfirmada(true); setIsCalendarOpen(false); }}
              className="font-medium text-indigo-600 hover:text-indigo-800 flex items-center gap-1"
            >
              <X className="w-3 h-3" /> Ver vista sugerida
            </button>
          )}
        </div>
      </PopoverContent>
    </Popover>
  );

  // Texto que explica qué ventana se está mostrando — mismo texto para el mensaje inicial (banner
  // arriba de la tabla) y para el estado vacío, así el usuario siempre sabe qué fecha(s) está viendo.
  const descripcionVentana = modoVentana === 'diaFijo'
    ? `el ${formatFechaSimple(fechaObjetivo)} (día ${horizonteDiasHabiles} hábil desde hoy)`
    : `hoy (${formatFechaSimple(today)}) y el ${formatFechaSimple(fechaObjetivo)} (día ${horizonteDiasHabiles} hábil, ventana de ${horizonteDiasHabiles + 1} días)`;

  // A pedido explícito: no se muestra ninguna información (ni tarjetas, ni tabla) hasta que el
  // usuario elija una fecha — a mano en el calendario, o aceptando la sugerida por el horizonte
  // del grupo. Se repite cada vez que se entra a un Plan de Grupo distinto (ver el useEffect que
  // resetea `vistaConfirmada` al cambiar `plan.codigo_plan_grupo`).
  if (!fechaSeleccionada && !vistaConfirmada) {
    return (
      <div className="text-center py-12 px-6 space-y-4 border border-dashed border-indigo-200 rounded-lg bg-indigo-50/40">
        <CalendarIcon className="w-8 h-8 text-indigo-400 mx-auto" />
        <div>
          <p className="text-sm font-semibold text-gray-800">Selecciona una fecha para ver la planificación</p>
          <p className="text-xs text-gray-500 mt-1 max-w-md mx-auto">
            Elige un día marcado en el calendario, o acepta la fecha sugerida para {grupo.nombre_grupo} ({descripcionVentana}).
          </p>
        </div>
        <div className="flex items-center justify-center gap-2 flex-wrap">
          <Button size="sm" onClick={() => setVistaConfirmada(true)}>
            <CalendarIcon className="w-4 h-4 mr-1.5" />
            Ver fecha sugerida
          </Button>
          {calendarPicker}
        </div>
      </div>
    );
  }

  if (ordenesVisibles.length === 0) {
    return (
      <div className="text-center py-8 text-gray-500 text-sm space-y-3">
        <p>
          {fechaSeleccionada
            ? `No hay órdenes de fabricación para el ${formatFechaSimple(fechaSeleccionada)}.`
            : `No hay órdenes de fabricación abiertas para los materiales de este plan para ${descripcionVentana}.`}
        </p>
        {fechasConOrdenes.size > 0 && (
          <div className="flex flex-col items-center gap-1.5">
            <p className="text-xs text-gray-400">Sí hay planificación en otras fechas — elige una en el calendario:</p>
            <div className="flex justify-center">{calendarPicker}</div>
          </div>
        )}
      </div>
    );
  }

  const distinctMaterialCount = new Set(ordenesVisibles.map(o => normalizeMaterialCode(o.MATERIAL))).size;
  const showPesoCard = !ocultarTarjetaPeso && pesoStats.ordenesConPeso > 0;

  // Avance de Rollos (Corte y Laminado): compara lo que planta ya registró en "Rollos
  // Fabricados" contra lo planificado. Las órdenes sin registro cuentan como 0 fabricados
  // (no se excluyen), porque lo que se quiere ver es el avance real del plan completo.
  let rollosAvanceStats: { totalPlanificado: number; totalFabricado: number; pct: number } | null = null;
  if (isCorteLaminado) {
    let totalPlanificado = 0;
    let totalFabricado = 0;
    ordenesVisibles.forEach(o => {
      totalPlanificado += getRollosPlanificados(o) || 0;
      totalFabricado += Number(rollosFabricados[o.ORDEN]) || 0;
    });
    rollosAvanceStats = {
      totalPlanificado,
      totalFabricado,
      pct: totalPlanificado > 0 ? (totalFabricado / totalPlanificado) * 100 : 0,
    };
  }
  const showAvanceCard = isCorteLaminado && !!rollosAvanceStats && rollosAvanceStats.totalPlanificado > 0;

  // Unidades a Fabricar (Ensamblado): total de unidades programadas de todo el grupo/plan,
  // pedido por producción para dimensionar la carga total sin sumar línea por línea. Usa Cant.
  // Programada (no Pendiente), mismo criterio que el resto de tarjetas de este plan. Solo se
  // muestra si todas las órdenes comparten la misma unidad de medida (en la práctica siempre ha
  // sido "ST"/UN en Ensamblado, pero se valida para no sumar cantidades de unidades distintas
  // por error si algún día aparece un material con otra unidad).
  let unidadesEnsambladoStats: { total: number; unidad: string } | null = null;
  if (isEnsamblado) {
    const unidadesDistintas = new Set(ordenesVisibles.map(o => o.UNIDAD));
    if (unidadesDistintas.size === 1) {
      const total = ordenesVisibles.reduce((sum, o) => sum + (Number(o.CANTPROGRAMADA) || 0), 0);
      unidadesEnsambladoStats = { total, unidad: formatUnidadOperativa(ordenesVisibles[0].UNIDAD) };
    }
  }
  const showUnidadesCard = isEnsamblado && !!unidadesEnsambladoStats;

  const kpiCount = 2 + (showPesoCard ? 1 : 0) + (showAvanceCard ? 1 : 0) + (showUnidadesCard ? 1 : 0);
  const kpiGridClass = kpiCount >= 4 ? 'sm:grid-cols-4' : kpiCount === 3 ? 'sm:grid-cols-3' : 'sm:grid-cols-2';
  const columnCount = 7 + (showRespCtrlProdColumn ? 1 : 0) + (showPuestoColumn ? 1 : 0) + (isCorteLaminado ? 1 : 0);

  const handleExportDetails = () => {
    const dataToExport = ordenesVisibles.map(o => {
      const scope = scopeByMaterial.get(normalizeMaterialCode(o.MATERIAL));
      const unidad = formatUnidadOperativa(o.UNIDAD);
      const tiempoOrdenMin = getTiempoPlanificadoMin(o);
      const row: Record<string, any> = {
        'N° Orden de Fabricación': o.ORDEN,
        'Fecha': o.FECHA,
        'Material': normalizeMaterialCode(o.MATERIAL),
        'Descripción': o.NOMBRE,
        'Categoría': o.CATEGORIA,
        'Puesto de Trabajo': o.PUESTOTRABAJO || '',
        'Cant. Pendiente': Number(o.CANTPENDIENTE),
        'Cant. Programada': Number(o.CANTPROGRAMADA),
        'Unidad': unidad,
        'Clase Aprov.': scope?.clase_aprovisionamiento || '',
        'Máquina': o.MAQUINA || '',
        'Resp. Ctrl. Prod.': o.RESPCTRLPROD || scope?.resp_ctrl_prod || '',
        'Tiempo STD Planificado (min)': tiempoOrdenMin !== null ? Math.round(tiempoOrdenMin * 100) / 100 : '',
      };
      if (isCorteLaminado) {
        const rollosPlan = getRollosPlanificados(o);
        const rollosFab = Number(rollosFabricados[o.ORDEN]) || 0;
        const looperInfoExport = looperPorMaterial.get(normalizeMaterialCode(o.MATERIAL));
        const pesoNotificado = Number(o.CANTNOTIFICADA) || 0;
        const pesoRealPorRollo = rollosFab > 0 && pesoNotificado > 0 ? pesoNotificado / rollosFab : null;
        const pesoEstandarPorRollo = looperInfoExport ? Number(looperInfoExport.PesoUN) || 0 : 0;
        const desfasePct = pesoRealPorRollo !== null && pesoEstandarPorRollo > 0
          ? ((pesoRealPorRollo - pesoEstandarPorRollo) / pesoEstandarPorRollo) * 100
          : null;
        row['Rollos Planificados'] = rollosPlan !== null ? Math.round(rollosPlan * 100) / 100 : '';
        row['Rollos Fabricados'] = rollosFabricados[o.ORDEN] || '';
        row['% Avance'] = rollosPlan !== null && rollosPlan > 0 ? Math.round((rollosFab / rollosPlan) * 10000) / 100 : '';
        row['Peso Real Notificado (kg)'] = pesoNotificado > 0 ? pesoNotificado : '';
        row['Peso Real / Rollo (kg)'] = pesoRealPorRollo !== null ? Math.round(pesoRealPorRollo * 100) / 100 : '';
        row['Desfase Enrollado (%)'] = desfasePct !== null ? Math.round(desfasePct * 100) / 100 : '';
      }
      return row;
    });
    const worksheet = XLSX.utils.json_to_sheet(dataToExport);
    worksheet['!cols'] = [
      { wch: 20 }, { wch: 12 }, { wch: 12 }, { wch: 35 }, { wch: 20 }, { wch: 14 },
      { wch: 12 }, { wch: 14 }, { wch: 8 }, { wch: 10 }, { wch: 12 }, { wch: 14 }, { wch: 16 }, { wch: 14 }, { wch: 14 }, { wch: 10 },
      { wch: 18 }, { wch: 16 }, { wch: 16 },
    ];
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, 'Ordenes Fabricacion');
    const nombreGrupoArchivo = (grupo.nombre_grupo || 'Grupo').trim().replace(/\s+/g, '_');
    const sufijoFechas = fechaSeleccionada
      ? fechaSeleccionada
      : (ventanaFechaInicio === ventanaFechaFin ? ventanaFechaFin : `${ventanaFechaInicio}_a_${ventanaFechaFin}`);
    XLSX.writeFile(workbook, `Ordenes_Fabricacion_${nombreGrupoArchivo}_${sufijoFechas}.xlsx`);
  };

  const renderOrderRows = (lista: OrdenFert[]) => lista.map(o => {
    const scope = scopeByMaterial.get(normalizeMaterialCode(o.MATERIAL));
    const unidad = formatUnidadOperativa(o.UNIDAD);
    const isExpanded = expandedRows.has(o.ORDEN);
    const isCentralizada = scope?.clase_aprovisionamiento === 'F';
    const parcial = Number(o.CANTNOTIFICADA) > 0 || Number(o.CANTENTREGADA) > 0;
    const looperInfo = looperPorMaterial.get(normalizeMaterialCode(o.MATERIAL));
    const rollosPlanificados = getRollosPlanificados(o);
    const tiempoOrdenMin = getTiempoPlanificadoMin(o);

    const row = (
      <tr
        key={o.ORDEN}
        className={cn(
          'hover:bg-blue-100/60',
          isCentralizada ? 'bg-blue-50 hover:bg-blue-100/60' : 'hover:bg-gray-50'
        )}
      >
        <td className="px-3 py-2">
          <button
            onClick={() => toggleRow(o.ORDEN)}
            className="text-gray-400 hover:text-gray-700"
            aria-label="Ver más detalles"
          >
            {isExpanded ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
          </button>
        </td>
        <td className="px-3 py-2 font-mono font-semibold text-gray-800">{o.ORDEN}</td>
        <td className="px-3 py-2 whitespace-nowrap">
          {formatFechaSimple(o.FECHA)}
        </td>
        <td className="px-3 py-2 font-mono">{normalizeMaterialCode(o.MATERIAL)}</td>
        <td className="px-3 py-2">{o.NOMBRE || '—'}</td>
        <td className="px-3 py-2 text-right font-mono text-base font-bold text-gray-800">
          {Number(o.CANTPENDIENTE).toLocaleString()}{unidad ? ` ${unidad}` : ''}
          {parcial && (
            <div className="text-[10px] font-normal text-gray-400">de {Number(o.CANTPROGRAMADA).toLocaleString()} programadas</div>
          )}
        </td>
        <td className={`px-3 py-2 font-mono ${isCentralizada ? 'text-blue-700 font-bold' : ''}`}>
          {scope?.clase_aprovisionamiento || '—'}
        </td>
        {showRespCtrlProdColumn && (
          <td className="px-3 py-2 text-xs text-gray-400">{o.RESPCTRLPROD || scope?.resp_ctrl_prod || '—'}</td>
        )}
        {showPuestoColumn && (
          <td className="px-3 py-2">
            {o.PUESTOTRABAJO ? (
              <span className="inline-block bg-slate-100 text-slate-700 border border-slate-200 rounded-md px-2 py-0.5 text-[11px] font-medium whitespace-nowrap">
                {o.PUESTOTRABAJO}
              </span>
            ) : <span className="text-gray-300">—</span>}
          </td>
        )}
        {isCorteLaminado && (() => {
          const fabricado = Number(rollosFabricados[o.ORDEN]) || 0;
          const avancePct = rollosPlanificados !== null && rollosPlanificados > 0
            ? (fabricado / rollosPlanificados) * 100
            : null;
          const avanceClass = avancePct === null
            ? ''
            : avancePct >= 100
              ? 'bg-green-100 text-green-700'
              : avancePct > 0
                ? 'bg-amber-100 text-amber-700'
                : 'bg-gray-100 text-gray-500';

          // Eficiencia de enrollado (pedido por el Planificador de Corte y Laminado): compara
          // el peso real que SAP ya notificó para esta orden (CANTNOTIFICADA) contra lo que
          // "deberían pesar" los rollos que el operador registró, según el peso estándar por
          // rollo (Looper). Solo se puede calcular cuando hay rollos registrados Y SAP ya
          // notificó algo — si SAP todavía no notifica, no es un desfase de proceso, es que
          // aún no hay con qué comparar.
          const pesoNotificado = Number(o.CANTNOTIFICADA) || 0;
          const pesoEstandarPorRollo = looperInfo ? Number(looperInfo.PesoUN) || 0 : 0;
          const pesoRealPorRollo = fabricado > 0 && pesoNotificado > 0 ? pesoNotificado / fabricado : null;
          const desfasePct = pesoRealPorRollo !== null && pesoEstandarPorRollo > 0
            ? ((pesoRealPorRollo - pesoEstandarPorRollo) / pesoEstandarPorRollo) * 100
            : null;
          const desfaseAbs = desfasePct !== null ? Math.abs(desfasePct) : null;
          const desfaseClass = desfaseAbs === null
            ? ''
            : desfaseAbs <= 5
              ? 'bg-green-100 text-green-700'
              : desfaseAbs <= 15
                ? 'bg-amber-100 text-amber-700'
                : 'bg-red-100 text-red-700';

          return (
            <td className="px-3 py-2">
              <div className="flex items-center gap-1.5">
                <input
                  type="number"
                  min={0}
                  inputMode="numeric"
                  placeholder="0"
                  value={rollosFabricados[o.ORDEN] || ''}
                  onChange={e => handleRollosChange(o.ORDEN, e.target.value)}
                  onClick={e => e.stopPropagation()}
                  title="Registro local en este navegador — aún no sincroniza con SAP"
                  className="w-20 text-sm border border-gray-300 rounded-md px-2 py-1 focus:ring-1 focus:ring-indigo-500 outline-none"
                />
                {avancePct !== null && (
                  <span className={cn('text-[10px] font-semibold px-1.5 py-0.5 rounded-md whitespace-nowrap', avanceClass)}>
                    {avancePct.toLocaleString(undefined, { maximumFractionDigits: 0 })}%
                  </span>
                )}
              </div>
              {rollosPlanificados !== null && (
                <div className="text-[10px] text-gray-400 mt-0.5">de ~{rollosPlanificados.toLocaleString(undefined, { maximumFractionDigits: 1 })} planificados</div>
              )}
              {desfasePct !== null && (
                <div
                  className={cn('inline-block text-[10px] font-semibold px-1.5 py-0.5 rounded-md mt-1 whitespace-nowrap', desfaseClass)}
                  title={`Peso real: ${pesoRealPorRollo!.toLocaleString(undefined, { maximumFractionDigits: 1 })} kg/rollo vs. estándar ${pesoEstandarPorRollo} kg/rollo (según SAP ya notificó ${pesoNotificado.toLocaleString()} kg para ${fabricado} rollos registrados)`}
                >
                  Δ enrollado {desfasePct > 0 ? '+' : ''}{desfasePct.toLocaleString(undefined, { maximumFractionDigits: 1 })}%
                </div>
              )}
            </td>
          );
        })()}
      </tr>
    );

    const detailRow = isExpanded && (
      <tr key={`${o.ORDEN}-detail`} className="bg-indigo-50/40">
        <td></td>
        <td colSpan={columnCount - 1} className="px-3 py-3 text-xs text-gray-600">
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            {!isCorteLaminado && (
              <div>
                <p className="text-[10px] uppercase font-semibold text-gray-400">Categoría</p>
                <p className="font-medium text-gray-700">{o.CATEGORIA || '—'}</p>
              </div>
            )}
            <div>
              <p className="text-[10px] uppercase font-semibold text-gray-400">Máquina / Hoja de Ruta</p>
              <p className="font-medium text-gray-700">{o.MAQUINA || '—'}</p>
            </div>
            <div>
              <p className="text-[10px] uppercase font-semibold text-gray-400">Puesto de Trabajo</p>
              <p className="font-medium text-gray-700">{o.PUESTOTRABAJO || '—'}</p>
            </div>
            {!isCorteLaminado && (
              <div>
                <p className="text-[10px] uppercase font-semibold text-gray-400">Pedido de Ventas</p>
                <p className="font-medium text-gray-700">{o.PEDIDO || '—'}</p>
              </div>
            )}
            <div>
              <p className="text-[10px] uppercase font-semibold text-gray-400">Fecha de Creación de la Orden</p>
              <p className="font-medium text-gray-700">{formatFechaSimple(o.FECHAORDEN)}</p>
            </div>
            <div>
              <p className="text-[10px] uppercase font-semibold text-gray-400">Cant. Programada</p>
              <p className="font-medium text-gray-700">{Number(o.CANTPROGRAMADA).toLocaleString()} {formatUnidadOperativa(o.UNIDAD)}</p>
            </div>
            <div>
              <p className="text-[10px] uppercase font-semibold text-gray-400">Cant. Notificada</p>
              <p className="font-medium text-gray-700">{Number(o.CANTNOTIFICADA).toLocaleString()} {formatUnidadOperativa(o.UNIDAD)}</p>
            </div>
            {!isCorteLaminado && (
              <div>
                <p className="text-[10px] uppercase font-semibold text-gray-400">Cant. Entregada</p>
                <p className="font-medium text-gray-700">{Number(o.CANTENTREGADA).toLocaleString()} {formatUnidadOperativa(o.UNIDAD)}</p>
              </div>
            )}
            {!isCorteLaminado && (
              <div>
                <p className="text-[10px] uppercase font-semibold text-gray-400">Cant. Rechazada</p>
                <p className="font-medium text-gray-700">{Number(o.CANTRECHAZO).toLocaleString()} {formatUnidadOperativa(o.UNIDAD)}</p>
              </div>
            )}
            {isCorteLaminado ? (
              <>
                <div>
                  <p className="text-[10px] uppercase font-semibold text-gray-400">Peso por Rollo</p>
                  <p className="font-medium text-gray-700">{looperInfo ? `${looperInfo.PesoUN} kg` : 'No registrado'}</p>
                </div>
                <div>
                  <p className="text-[10px] uppercase font-semibold text-gray-400">Tiempo por Rollo</p>
                  <p className="font-medium text-gray-700">{looperInfo ? formatDuracionMin(looperInfo.TiempoRolloMin) : 'No registrado'}</p>
                </div>
                <div>
                  <p className="text-[10px] uppercase font-semibold text-gray-400">Rollos Planificados</p>
                  <p className="font-medium text-gray-700">{rollosPlanificados !== null ? rollosPlanificados.toLocaleString(undefined, { maximumFractionDigits: 1 }) : 'No registrado'}</p>
                </div>
                {(() => {
                  const fabricado = Number(rollosFabricados[o.ORDEN]) || 0;
                  const pesoNotificado = Number(o.CANTNOTIFICADA) || 0;
                  const pesoRealPorRollo = fabricado > 0 && pesoNotificado > 0 ? pesoNotificado / fabricado : null;
                  const pesoEstandarPorRollo = looperInfo ? Number(looperInfo.PesoUN) || 0 : 0;
                  const desfasePct = pesoRealPorRollo !== null && pesoEstandarPorRollo > 0
                    ? ((pesoRealPorRollo - pesoEstandarPorRollo) / pesoEstandarPorRollo) * 100
                    : null;
                  return (
                    <>
                      <div>
                        <p className="text-[10px] uppercase font-semibold text-gray-400">Peso Real Promedio / Rollo</p>
                        <p className="font-medium text-gray-700">
                          {pesoRealPorRollo !== null
                            ? `${pesoRealPorRollo.toLocaleString(undefined, { maximumFractionDigits: 1 })} kg`
                            : (fabricado === 0 ? 'Sin rollos registrados' : 'SAP aún sin notificar')}
                        </p>
                      </div>
                      <div>
                        <p className="text-[10px] uppercase font-semibold text-gray-400">Desfase vs. Estándar (Eficiencia de Enrollado)</p>
                        <p className={cn('font-medium', desfasePct === null ? 'text-gray-700' : Math.abs(desfasePct) <= 5 ? 'text-green-700' : Math.abs(desfasePct) <= 15 ? 'text-amber-700' : 'text-red-700')}>
                          {desfasePct !== null ? `${desfasePct > 0 ? '+' : ''}${desfasePct.toLocaleString(undefined, { maximumFractionDigits: 1 })}%` : 'No disponible aún'}
                        </p>
                      </div>
                    </>
                  );
                })()}
              </>
            ) : (
              <div>
                <p className="text-[10px] uppercase font-semibold text-gray-400">Tiempo STD de este material</p>
                <p className="font-medium text-gray-700">{(() => {
                  const t = isForros ? getTiempoForrosMinPorUnidad(o) : getTiempoMinPorUnidad(o);
                  return t !== null ? `${formatDuracionMin(t)} / unidad` : 'No registrado';
                })()}</p>
              </div>
            )}
            {!isCorteLaminado && (
              <div>
                <p className="text-[10px] uppercase font-semibold text-gray-400">Tiempo STD Planificado de esta orden</p>
                <p className="font-medium text-gray-700">{tiempoOrdenMin !== null ? formatDuracionMin(tiempoOrdenMin) : 'No registrado'}</p>
              </div>
            )}
          </div>
        </td>
      </tr>
    );

    return [row, detailRow].filter(Boolean);
  }).flat();

  return (
    <div className="space-y-3">
      <div className="flex items-start justify-between gap-3 bg-indigo-50 border border-indigo-100 rounded-lg px-4 py-3">
        <div className="text-xs text-indigo-900 space-y-1">
          <p className="font-semibold flex items-center gap-1.5">
            <CalendarIcon className="w-3.5 h-3.5" />
            {fechaSeleccionada ? (
              <>Estás viendo el <span className="underline">{formatFechaSimple(fechaSeleccionada)}</span> (fecha elegida a mano en el calendario)</>
            ) : modoVentana === 'diaFijo' ? (
              <>Estás viendo el <span className="underline">{formatFechaSimple(fechaObjetivo)}</span> — día {horizonteDiasHabiles} hábil desde hoy</>
            ) : (
              <>Estás viendo del <span className="underline">{formatFechaSimple(today)}</span> al <span className="underline">{formatFechaSimple(fechaObjetivo)}</span> — hoy + {horizonteDiasHabiles} días hábiles</>
            )}
          </p>
          <p className="text-indigo-700">
            Selecciona una fecha distinta en el calendario (arriba a la derecha) para ver otro día de planificación.
            {trabajaFinDeSemana && ' Este grupo sí trabaja fines de semana.'}
          </p>
          <p className="text-indigo-400">
            Plan seleccionado: {getPlanSuffix(plan.valor)} (vigencia propia: {formatFechaSimple(planFechaInicio)} — {formatFechaSimple(planFechaFin)})
          </p>
        </div>
        <div className="shrink-0">{calendarPicker}</div>
      </div>

      <div className="flex items-center justify-between gap-3">
        <div className={cn("grid grid-cols-1 gap-3 flex-1", kpiGridClass)}>
          <StatCard label="Órdenes Abiertas" value={ordenesVisibles.length.toLocaleString()} />
          <StatCard label="Materiales Distintos" value={distinctMaterialCount.toLocaleString()} />
          {showUnidadesCard && unidadesEnsambladoStats && (
            <StatCard
              label="Unidades a Fabricar"
              value={`${unidadesEnsambladoStats.total.toLocaleString(undefined, { maximumFractionDigits: 0 })} ${unidadesEnsambladoStats.unidad}`}
              accent="text-indigo-700"
              hint="Total del grupo (todas las líneas), sobre la cantidad programada del plan"
              hintAccent="text-gray-400"
            />
          )}
          {showPesoCard && (
            <StatCard
              label="Peso Planificado (aprox.)"
              value={`${pesoStats.total.toLocaleString(undefined, { maximumFractionDigits: 1 })} kg`}
              accent="text-indigo-700"
              hint={
                pesoStats.ordenesSinPeso > 0
                  ? `${pesoStats.ordenesConPeso}/${ordenesVisibles.length} órdenes con peso registrado — total parcial`
                  : 'Calculado sobre la cantidad programada del plan'
              }
              hintAccent={pesoStats.ordenesSinPeso > 0 ? 'text-amber-600' : 'text-gray-400'}
            />
          )}
          {showAvanceCard && rollosAvanceStats && (
            <StatCard
              label="Avance de Rollos"
              value={`${rollosAvanceStats.pct.toLocaleString(undefined, { maximumFractionDigits: 0 })}%`}
              accent={rollosAvanceStats.pct >= 100 ? 'text-green-700' : 'text-indigo-700'}
              hint={`${rollosAvanceStats.totalFabricado.toLocaleString(undefined, { maximumFractionDigits: 1 })} / ${rollosAvanceStats.totalPlanificado.toLocaleString(undefined, { maximumFractionDigits: 1 })} rollos registrados como fabricados`}
              hintAccent="text-gray-400"
            />
          )}
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <Button variant="outline" size="sm" onClick={handleRefresh} disabled={isRefreshing}>
            {isRefreshing ? <Loader2 className="w-4 h-4 mr-1.5 animate-spin" /> : <RefreshCw className="w-4 h-4 mr-1.5" />}
            Actualizar
          </Button>
          <Button variant="outline" size="sm" onClick={handleExportDetails}>
            <Download className="w-4 h-4 mr-1.5" /> Exportar
          </Button>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <div className="flex items-center gap-1.5 text-[11px] text-blue-700 bg-blue-50 border border-blue-100 rounded-md px-3 py-1.5 w-fit">
          <span className="w-2.5 h-2.5 rounded-sm bg-blue-100 border border-blue-300 inline-block"></span>
          Filas resaltadas = Clase Aprov. <strong>F</strong> (Fabricación Centralizada): se produce en Centro 1000 (Quito) y llega por transferencia, no se fabrica en este centro.
        </div>
        {isCorteLaminado && (
          <div className="flex items-center gap-1.5 text-[11px] text-amber-700 bg-amber-50 border border-amber-100 rounded-md px-3 py-1.5 w-fit">
            "Rollos Fabricados" se guarda solo en este navegador — todavía no se sincroniza con SAP. El badge "Δ enrollado" compara ese registro contra lo que SAP ya notificó: si SAP aún no ha notificado esta orden, el desfase que se vea puede ser solo por el tiempo, no un problema real de enrollado.
          </div>
        )}
      </div>

      {showBlockSelector && bloques ? (
        <div className="space-y-3">
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
            {bloques.map(({ nombre, ordenes: ordenesBloque, tiempoTotalMin, materialesDistintos, unidadesTotal, unidadLabel }) => {
              const isSelected = selectedLinea === nombre;
              return (
                <button
                  key={nombre}
                  type="button"
                  onClick={() => setSelectedLinea(isSelected ? null : nombre)}
                  className={cn(
                    "text-left bg-white border rounded-lg p-4 transition-all hover:border-indigo-400 hover:shadow-md",
                    isSelected ? "border-indigo-500 ring-1 ring-indigo-500 bg-indigo-50/50" : "border-gray-200"
                  )}
                >
                  <p className="font-semibold text-gray-800 leading-tight">{nombre}</p>
                  <p className="text-xs text-gray-500 mt-1">{ordenesBloque.length} orden{ordenesBloque.length === 1 ? '' : 'es'} · {materialesDistintos} material{materialesDistintos === 1 ? '' : 'es'}</p>
                  {unidadesTotal !== null && (
                    <p className="text-xs font-medium text-gray-700 mt-1">{unidadesTotal.toLocaleString(undefined, { maximumFractionDigits: 0 })} {unidadLabel} planificadas</p>
                  )}
                  {tiempoTotalMin > 0 && (
                    <p className="text-xs font-medium text-indigo-700 mt-1">{formatDuracionMin(tiempoTotalMin)} STD</p>
                  )}
                </button>
              );
            })}
          </div>

          {selectedLinea ? (
            (() => {
              const bloqueSeleccionado = bloques.find(b => b.nombre === selectedLinea);
              if (!bloqueSeleccionado) return null;
              return (
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <h4 className="text-sm font-semibold text-gray-800">
                      Planificación — {isEnsamblado ? selectedLinea : `${blockLabel}: ${selectedLinea}`}
                    </h4>
                    <button
                      onClick={() => setSelectedLinea(null)}
                      className="text-xs font-medium text-indigo-600 hover:text-indigo-800"
                    >
                      Cerrar
                    </button>
                  </div>
                  <div className="overflow-auto max-h-[60vh] border rounded-lg">
                    <table className="min-w-full text-sm divide-y divide-gray-200">
                      <thead className="bg-gray-100 sticky top-0 z-10">
                        <tr>
                          <th className="px-3 py-2 text-left font-semibold text-gray-600 w-8"></th>
                          <th className="px-3 py-2 text-left font-semibold text-gray-600">N° Orden de Fabricación</th>
                          <th className="px-3 py-2 text-left font-semibold text-gray-600">Fecha</th>
                          <th className="px-3 py-2 text-left font-semibold text-gray-600">Material</th>
                          <th className="px-3 py-2 text-left font-semibold text-gray-600">Descripción</th>
                          <th className="px-3 py-2 text-right font-semibold text-gray-600">Cant. Pendiente</th>
                          <th className="px-3 py-2 text-left font-semibold text-gray-600">Clase Aprov.</th>
                          <th className="px-3 py-2 text-left font-semibold text-gray-500 text-xs">Resp. Ctrl. Prod.</th>
                        </tr>
                      </thead>
                      <tbody className="bg-white divide-y divide-gray-200">
                        {renderOrderRows(bloqueSeleccionado.ordenes)}
                      </tbody>
                    </table>
                  </div>
                </div>
              );
            })()
          ) : (
            <div className="text-center py-6 text-gray-400 text-sm border border-dashed rounded-lg">
              Selecciona un bloque arriba ({blockLabel.toLowerCase()}) para ver su planificación.
            </div>
          )}
        </div>
      ) : (
        <div className="overflow-auto max-h-[60vh] border rounded-lg">
          <table className="min-w-full text-sm divide-y divide-gray-200">
            <thead className="bg-gray-100 sticky top-0 z-10">
              <tr>
                <th className="px-3 py-2 text-left font-semibold text-gray-600 w-8"></th>
                <th className="px-3 py-2 text-left font-semibold text-gray-600">N° Orden de Fabricación</th>
                <th className="px-3 py-2 text-left font-semibold text-gray-600">Fecha</th>
                <th className="px-3 py-2 text-left font-semibold text-gray-600">Material</th>
                <th className="px-3 py-2 text-left font-semibold text-gray-600">Descripción</th>
                <th className="px-3 py-2 text-right font-semibold text-gray-600">Cant. Pendiente</th>
                <th className="px-3 py-2 text-left font-semibold text-gray-600">Clase Aprov.</th>
                {showRespCtrlProdColumn && <th className="px-3 py-2 text-left font-semibold text-gray-500 text-xs">Resp. Ctrl. Prod.</th>}
                {showPuestoColumn && <th className="px-3 py-2 text-left font-semibold text-gray-600">Puesto de Trabajo</th>}
                {isCorteLaminado && <th className="px-3 py-2 text-left font-semibold text-gray-600">Rollos Fabricados</th>}
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {renderOrderRows(ordenesVisibles)}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
};

// --- Orquestador del flujo Grupo -> Plan de Grupo -> Detalle Táctico ---
const GroupPlanDrilldown: React.FC = () => {
  const [selectedGroup, setSelectedGroup] = useState<Grupo | null>(null);
  const [selectedPlan, setSelectedPlan] = useState<PlanGrupo | null>(null);

  const currentStep = selectedPlan ? 3 : selectedGroup ? 2 : 1;

  return (
    <div className="space-y-4">
      <Stepper currentStep={currentStep} />

      {currentStep === 1 && (
        <ActiveGroupsCards onSelectGroup={(group) => { setSelectedGroup(group); setSelectedPlan(null); }} />
      )}

      {currentStep === 2 && selectedGroup && (
        <div className="space-y-3">
          <button
            onClick={() => setSelectedGroup(null)}
            className="flex items-center text-xs font-medium text-indigo-600 hover:text-indigo-800"
          >
            <ChevronLeft className="w-3.5 h-3.5 mr-1" /> Volver a Grupos
          </button>
          <GroupPlansPanel group={selectedGroup} onSelectPlan={setSelectedPlan} />
        </div>
      )}

      {currentStep === 3 && selectedGroup && selectedPlan && (
        <div className="space-y-3">
          <button
            onClick={() => setSelectedPlan(null)}
            className="flex items-center text-xs font-medium text-indigo-600 hover:text-indigo-800"
          >
            <ChevronLeft className="w-3.5 h-3.5 mr-1" /> Volver a Planes de {selectedGroup.nombre_grupo}
          </button>
          <h4 className="text-sm font-semibold text-gray-800">
            Detalles Tácticos — Plan #{selectedPlan.codigo_plan_grupo}
          </h4>
          <PlanTacticalDetailsTable plan={selectedPlan} grupo={selectedGroup} />
        </div>
      )}
    </div>
  );
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
  const [, setInventoryFilterOptions] = useState<{ centros: string[], sectores: string[] }>({ centros: [], sectores: [] });
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
  
  const { monthlyPlan = [] } = productionPlan || { monthlyPlan: [] };

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
    
    const filteredItems = dailyPlanFirstMonth.filter(item => {
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

  const monthlyKpis = useMemo(() => {
    const totalProduction = filteredMonthlyPlan.reduce((sum, item) => sum + item.totalQuantityToProduce, 0);
    const totalDemand = filteredMonthlyPlan.reduce((sum, item) => sum + item.totalDemand, 0);
    const totalDispatches = filteredMonthlyPlan.reduce((sum, item) => sum + item.dispatches, 0);
    const coverage = totalDemand > 0 ? (totalDispatches / totalDemand) * 100 : 0;
    return { totalProduction, totalDemand, coverage };
  }, [filteredMonthlyPlan]);

  const dailyKpis = useMemo(() => {
    let totalHours = 0;
    let busiestLine: { lineName: string; units: number } | null = null;

    filteredDailyPlanByLine.forEach(line => {
      let lineUnits = 0;
      Object.values(line.dailyData).forEach(day => {
        totalHours += day.hours;
        lineUnits += day.units;
      });
      if (!busiestLine || lineUnits > busiestLine.units) {
        busiestLine = { lineName: line.lineName, units: lineUnits };
      }
    });

    const busiestShare = busiestLine && totalFilteredUnits > 0
      ? (busiestLine.units / totalFilteredUnits) * 100
      : 0;

    return { totalHours, busiestLine, busiestShare };
  }, [filteredDailyPlanByLine, totalFilteredUnits]);

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
                <tfoot className="bg-indigo-50 text-indigo-900 sticky bottom-0 border-t-2 border-indigo-200">
                    <tr>
                        <th colSpan={4} className="px-3 py-2 text-right font-bold uppercase">Total Demanda Centro 1000</th>
                        <th className="px-3 py-2 text-right font-bold uppercase">{Math.round(totalNecesidadCentro1000).toLocaleString()}</th>
                    </tr>
                    <tr>
                        <th colSpan={4} className="px-3 py-2 text-right font-bold uppercase">Total Demanda Centro 2000</th>
                        <th className="px-3 py-2 text-right font-bold uppercase">{Math.round(totalNecesidadCentro2000).toLocaleString()}</th>
                    </tr>
                    <tr className="bg-indigo-100">
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
                    Los siguientes materiales (código inicia con &apos;3&apos; o &apos;4&apos;) no tienen una regla de aprovisionamiento (&apos;E&apos;, &apos;F&apos;, &apos;X&apos;) definida en `CuboInventarios` y no podrán ser planificados. Esto puede indicar un error en los datos maestros. Los productos comprados (que no inician con 3 o 4) son omitidos correctamente.
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
                            {productionNeedsFirstMonth.map((item) => (
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
                    Esta tabla muestra el plan de producción mensual final después de balancear la carga y respetar las restricciones de capacidad. Compare la columna &quot;Producción&quot; con la &quot;Demanda&quot; para ver los ajustes realizados por el motor.
                </p>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                    <StatCard label="Total a Producir (Primer Mes)" value={`${Math.round(monthlyKpis.totalProduction).toLocaleString()} u`} accent="text-indigo-700" />
                    <StatCard label="Demanda Total" value={`${Math.round(monthlyKpis.totalDemand).toLocaleString()} u`} />
                    <StatCard
                        label="Cobertura de Demanda"
                        value={`${monthlyKpis.coverage.toFixed(1)}%`}
                        accent={monthlyKpis.coverage >= 100 ? "text-green-600" : "text-yellow-600"}
                    />
                </div>

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

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <StatCard label="Total a Fabricar (Primer Mes)" value={`${Math.round(totalFilteredUnits).toLocaleString()} u`} accent="text-indigo-700" />
                <StatCard label="Horas Totales de Producción" value={`${Math.round(dailyKpis.totalHours).toLocaleString()} h`} />
                <StatCard
                    label="Línea Más Cargada"
                    value={dailyKpis.busiestLine ? `${dailyKpis.busiestLine.lineName} (${dailyKpis.busiestShare.toFixed(0)}%)` : 'N/A'}
                    accent="text-gray-800"
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
                                <td className="px-2 py-2 text-left sticky left-0 bg-gray-200">TOTAL</td>
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

      {!isDataSynced && (
          <p className="text-sm text-yellow-600 bg-yellow-50 p-3 rounded-md">
             ⚠️ Atención: Los datos de configuración y tiempos no están sincronizados. Vaya a la sección de <span className="font-bold">Definir Restricciones</span> y presione el botón de sincronización antes de generar un plan.
          </p>
      )}
      {isDataSynced && salesData.length === 0 && (
          <p className="text-sm text-yellow-600 bg-yellow-50 p-3 rounded-md">
             ⚠️ Atención: No se han cargado datos de ventas. Por favor, vaya a la sección de <span className="font-bold">Importar Ventas</span>.
          </p>
      )}

      {isLoading ? (
        <div className="bg-white p-6 rounded-xl shadow-lg min-h-[60vh]">
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
        </div>
      ) : planningStep === 0 ? (
        <div className="bg-white p-6 rounded-xl shadow-lg space-y-4">
          <div className="flex items-center space-x-2">
            <Users2 className="w-5 h-5 text-gray-500" />
            <h3 className="text-lg font-semibold text-gray-800">Grupos de Producción</h3>
          </div>
          <GroupPlanDrilldown />
        </div>
      ) : (
        <div className="bg-white p-6 rounded-xl shadow-lg min-h-[60vh]">
            {renderPlanWizard()}
        </div>
      )}
    </div>
  );
};
