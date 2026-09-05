'use client';

import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { 
  CalendarClock, 
  Loader2, 
  Users, 
  Clock,
  Cpu,
  Layers,
  Settings2,
  LayoutGrid,
  ClipboardList,
  UserPlus,
  BarChart3,
  Sun,
  Moon,
  PackageSearch,
  SearchCode,
  Database,
  Filter,
  ListTree,
  Calendar as CalendarIcon,
  Monitor,
  MapPin,
  Boxes,
  Table as TableIcon,
  Search,
  X,
  GitMerge,
  ChevronLeft,
  ChevronRight,
  ChevronsLeft,
  ChevronsRight,
  CheckCircle2,
  AlertTriangle,
  Lock,
  Pencil
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogAction,
  AlertDialogCancel,
} from '@/components/ui/alert-dialog';
import { Progress } from "@/components/ui/progress";
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Calendar as DatePickerCalendar } from '@/components/ui/calendar';
import { 
  Select, 
  SelectContent, 
  SelectItem, 
  SelectTrigger, 
  SelectValue 
} from "@/components/ui/select";
import { grupoService } from '@/services/grupo.service';
import { restriccionService } from '@/services/restriccion.service';
import { serviciosService } from '@/services/servicios.service';
import { planGrupoService } from '@/services/plangrupo.service';
import { detalleTacticoService } from '@/services/detalletactico.service';
import type { Grupo, Restriccion, PlanGrupo, DetalleTactico } from '@/types/interfaces';
import { cn } from '@/lib/utils';
import { useAppContext } from '@/context/AppProvider';

// Constantes de configuración de jornada
const DIURNA_OPTIONS = [
  { value: "8.75", label: "7:00 - 15:45 (8.75 h)" },
  { value: "10", label: "7:00 - 17:00 (10h)" },
  { value: "11", label: "7:00 - 18:00 (11h)" },
];

const NOCTURNA_OPTIONS = [
  { value: "0", label: "Sin jornada" },
  { value: "8.5", label: "21:00 - 5:30 (8.5h)" },
  { value: "10.5", label: "19:00 - 5:30 (10.5h)" },
];

// Grupos de estaciones para la pestaña de Personal & Turnos
const workstationGroups = [
  {
    title: "Acolchado y Tapas",
    items: [
      "ACOLCHADORA02", "COSEDORA-ACH02",
      "ACOLCHADORA06", "COSEDORA-ACH06",
      "ACOLCHADORA07", "COSEDORA-ACH07",
      "ACOLCHADORA08", "COSEDORA-ACH08",
      "ACOLCHADORA09", "COSEDORA-ACH09",
      "ACOLCHADORA10", "COSEDORA-ACH10",
      "ACOLCHADORA13", "COSEDORA-ACH13",
      "ACH02", "ACH06", "ACH07", "ACH08", "ACH09", "ACH10", "ACH13",
      "PEGADORA-ACH02", "PEGADORA-ACH06", "PEGADORA-ACH07", "PEGADORA-ACH08", "PEGADORA-ACH09", "PEGADORA-ACH10", "PEGADORA-ACH13",
      "PEF02", "PEF06", "PEF07", "PEF08", "PEF09", "PEF10", "PEF13"
    ]
  },
  {
    title: "Procesos de Bandas y Bordado",
    items: [
      "ACOLCHADORA11", "ACOLCHADORA12", "ACH11", "ACH12", 
      "BORDADORA-BANDA01", "BO01", "RMTB-01", "RMTB-02", "RMTB-M", "RMTB01", "RMTB02", "RMTBM",
      "COS3D", "COSEDORA-BANDA3D", "ENCINTADOBD", "COSEDORA-ENCINTADOBD"
    ]
  },
  {
    title: "Interiores, Bases y Corte",
    items: [
      "INTP-PR", "INTP-PT", "INTP-F", "INTPF", "INTPF1", "INTPF2", 
      "COSEDORA-INTPF", "COSEDORA-INTPF1", "COSEDORA-INTPF2",
      "COSEDORA-INTPR", "COSEDORA-INTPT",
      "MTBS1", "MTBS", "COSEDORA-BSC-CC", "COSEDORA-BSCTP", "COSEDORA-MTBS1",
      "CT-BAN", "CT-BSC", "CT-CHN", "CT-INT", "TTCF", "TTSUP", "TELAS", "FUNDAS",
      "COSEDORA-TTCHN", "COSEDORA-TTSUP-CHN", "CORTE-ESPUMA", "CORTELA10"
    ]
  },
  {
    title: "Ensamble de Forros",
    items: ["FORRO-COLCHONES", "FBASE-01", "FBASE-02", "FORRO-BASE-BCAMAS"]
  }
];

interface WorkstationConfig {
  machine: string;
  isDayActive: boolean;
  isNightActive: boolean;
  people: number;
  machines: number;
}

const MachineCard = React.memo(({
  puestoName,
  small = false,
  orders,
  calculateProductionTime,
  config,
  horasNetasDiurnas,
  horasNetasNocturnas,
  mapToHojaRuta,
  normalizeMaterialCode,
  isConsolidated = false,
  adjustedInOrders = [],
  excludeOrderKeys,
  excessOrderKeys,
  splitRemainderOrders = [],
}: {
  puestoName: string;
  small?: boolean;
  orders: any[];
  calculateProductionTime: (material: string, quantity: number, order: any) => number;
  config: WorkstationConfig;
  horasNetasDiurnas: number;
  horasNetasNocturnas: number;
  mapToHojaRuta: (name: string) => string;
  normalizeMaterialCode: (code: string | number) => string;
  isConsolidated?: boolean;
  adjustedInOrders?: any[];
  excludeOrderKeys?: Set<string>;
  excessOrderKeys?: Set<string>;
  splitRemainderOrders?: any[];
}) => {
  const hrCode = mapToHojaRuta(puestoName).trim().toUpperCase();
  
  const { filteredOrders, totalTimeHours, utilization, capacityHours } = useMemo(() => {
    const makeKey = (o: any) => `${o['ORDEN'] || ''}|${String(o['MATERIAL'] || o['CodMaterial'] || '')}|${String(o['CANTIDAD'] || o['CANTPROGRAMADA'] || '')}`;

    let filtered = orders.filter(o => {
      const orderHR = String(o['MAQUINA'] || o['Maquina'] || '').trim().toUpperCase();
      const matchesHR = hrCode.includes(' / ')
        ? hrCode.split(' / ').map(c => c.trim().toUpperCase()).includes(orderHR)
        : orderHR === hrCode;
      if (!matchesHR) return false;
      if (excludeOrderKeys?.has(makeKey(o))) return false;
      return true;
    });

    const adjustedTagged = adjustedInOrders.map(o => ({ ...o, _isAdjusted: true }));
    const remainderTagged = splitRemainderOrders.map(o => ({ ...o, _isSplitRemainder: true }));

    if (isConsolidated) {
      const grouped = new Map<string, any>();
      filtered.forEach(o => {
        const materialCode = normalizeMaterialCode(o['MATERIAL'] || o['CodMaterial'] || '');
        const qty = Number(o['CANTIDAD'] || o['CANTPROGRAMADA'] || 0);
        if (grouped.has(materialCode)) {
          const existing = grouped.get(materialCode);
          existing._totalQty += qty;
        } else {
          grouped.set(materialCode, {
            ...o,
            _isConsolidated: true,
            _totalQty: qty
          });
        }
      });
      filtered = Array.from(grouped.values());
    }

    const allOrders = [...filtered, ...adjustedTagged, ...remainderTagged];

    const totalSeconds = allOrders.reduce((sum, o) => {
      const qty = isConsolidated && o._isConsolidated ? o._totalQty : Number(o['CANTIDAD'] || o['CANTPROGRAMADA'] || 0);
      return sum + calculateProductionTime(o['MATERIAL'] || o['CodMaterial'] || '', qty, o);
    }, 0);

    const totalHours = totalSeconds / 3600;
    const numMachines = config.machines || 1;
    const capacity = ((config.isDayActive ? horasNetasDiurnas : 0) + (config.isNightActive ? horasNetasNocturnas : 0)) * numMachines;
    const util = capacity > 0 ? (totalHours / capacity) * 100 : 0;

    return {
      filteredOrders: allOrders,
      totalTimeHours: totalHours,
      utilization: util,
      capacityHours: capacity
    };
  }, [orders, hrCode, calculateProductionTime, config, horasNetasDiurnas, horasNetasNocturnas, isConsolidated, normalizeMaterialCode, adjustedInOrders, excludeOrderKeys, splitRemainderOrders]);

  return (
    <div className={cn(
      "flex border border-slate-200 rounded-[2rem] overflow-hidden shadow-sm bg-white transition-all hover:shadow-lg",
      small ? "h-[400px]" : "h-[460px]"
    )}>
      <div className={cn(
        "bg-slate-50/50 p-6 text-slate-900 flex flex-col border-r border-slate-100",
        small ? "w-[45%]" : "w-[40%]"
      )}>
        <div className="mb-4 relative">
          <Badge className="bg-indigo-600 text-white font-black text-[9px] uppercase tracking-widest px-2.5 py-0.5 rounded-lg border-none shadow-sm mb-2 inline-block">
            {hrCode || 'S/HR'}
          </Badge>
          <h3 className="text-xl font-black uppercase tracking-tighter text-indigo-950 flex items-center gap-2 break-words leading-tight pr-14">
            <Cpu className="w-5 h-5 text-indigo-600 shrink-0" />
            <span>{puestoName}</span>
          </h3>

          <div className="absolute top-0 right-0 flex flex-col gap-1.5">
            <div className="flex flex-col items-center justify-center bg-white border-2 border-dashed border-sky-300 w-12 h-12 rounded-xl shadow-sm">
              <span className="text-lg font-black text-sky-700 leading-none">{config.machines || 1}</span>
              <span className="text-[6px] font-black uppercase text-sky-400 mt-0.5 tracking-tighter">Máquinas</span>
            </div>
            <div className="flex flex-col items-center justify-center bg-white border-2 border-dashed border-indigo-300 w-12 h-12 rounded-xl shadow-sm">
              <span className="text-lg font-black text-indigo-700 leading-none">{config.people || 0}</span>
              <span className="text-[6px] font-black uppercase text-indigo-400 mt-0.5 tracking-tighter">Personas</span>
            </div>
          </div>
        </div>

        <div className="flex-1 space-y-4">
          <div className="bg-white p-3.5 rounded-2xl border border-slate-100 shadow-sm">
            <div className="flex justify-between items-center text-[9px] text-slate-400 uppercase font-black tracking-widest mb-2">Turnos Activos</div>
            <div className="grid grid-cols-2 gap-2">
              <div className={cn("rounded-xl p-2 border flex flex-col items-center", config.isDayActive ? "bg-amber-50 border-amber-200" : "bg-slate-50 border-slate-100 opacity-40")}>
                <Sun className={cn("w-3.5 h-3.5 mb-0.5", config.isDayActive ? "text-amber-500" : "text-slate-400")} />
                <span className={cn("text-[8px] font-black uppercase", config.isDayActive ? "text-amber-700" : "text-slate-400")}>Día</span>
              </div>
              <div className={cn("rounded-xl p-2 border flex flex-col items-center", config.isNightActive ? "bg-indigo-50 border-indigo-200" : "bg-slate-50 border-slate-100 opacity-40")}>
                <Moon className={cn("w-3.5 h-3.5 mb-0.5", config.isNightActive ? "text-indigo-500" : "text-slate-400")} />
                <span className={cn("text-[8px] font-black uppercase", config.isNightActive ? "text-indigo-700" : "text-slate-400")}>Noche</span>
              </div>
            </div>
          </div>

          <div className="bg-white p-4 rounded-2xl border border-slate-100 shadow-sm">
            <div className="flex items-center justify-between mb-2">
              <p className="text-[10px] font-black uppercase text-slate-500">Ocupación</p>
              <Badge className={cn(
                "text-[8px] font-black px-1.5 py-0.5 rounded-md border-none", 
                utilization > 100 ? "bg-red-100 text-red-700" : 
                utilization >= 90 ? "bg-green-100 text-green-700" : 
                "bg-yellow-100 text-yellow-700"
              )}>
                {utilization > 100 ? "Sobrecapacidad" : utilization >= 90 ? "Estable" : "Baja"}
              </Badge>
            </div>
            <div className="flex items-baseline gap-1 mb-2">
              <span className={cn(
                "text-4xl font-black font-mono tracking-tighter", 
                utilization > 100 ? "text-red-600" : 
                utilization >= 90 ? "text-green-600" : 
                "text-yellow-600"
              )}>
                {utilization.toFixed(0)}
              </span>
              <span className="text-[10px] font-black text-slate-400">%</span>
            </div>
            <div className="relative h-2 bg-slate-100 rounded-full overflow-hidden shadow-inner border border-slate-200 mb-2">
               <div 
                 className={cn(
                   "h-full transition-all duration-700 ease-out", 
                   utilization > 100 ? "bg-red-500" : 
                   utilization >= 90 ? "bg-green-500" : 
                   "bg-yellow-400"
                 )} 
                 style={{ width: `${Math.min(utilization, 100)}%` }} 
               />
            </div>
            
            <div className="mt-3 text-center h-4">
              {utilization > 100 ? (
                <span className="text-[9px] font-black uppercase text-red-600 tracking-tighter animate-pulse">Sobrecapacidad</span>
              ) : utilization >= 90 ? (
                <span className="text-[9px] font-black uppercase text-green-600 tracking-tighter">Estable</span>
              ) : (
                <span className="text-[9px] font-black uppercase text-yellow-600 tracking-tighter animate-pulse">Debajo de capacidad</span>
              )}
            </div>
          </div>
        </div>
      </div>
      
      <div className="flex-1 p-6 flex flex-col bg-slate-50/20">
        <div className="flex items-center justify-between mb-4">
          <h4 className="text-[10px] font-black text-slate-800 uppercase tracking-[0.2em] flex items-center gap-2">
            <ClipboardList className="w-4 h-4 text-indigo-600" /> {isConsolidated ? 'Carga Consolidada' : 'Plan Operativo'}
          </h4>
          <Badge className="bg-white text-slate-900 border-slate-200 font-mono font-black text-[10px] px-3 py-0.5 rounded-full shadow-sm">
            {filteredOrders.length} {isConsolidated ? 'MATERIALES' : 'ÓRDENES'}
          </Badge>
        </div>
        <div className={cn(
          "flex-1 min-h-0 overflow-y-auto rounded-2xl border border-slate-200 bg-white shadow-inner text-[10px]",
          small ? "max-h-[300px]" : "max-h-[360px]"
        )}>
          <table className="w-full min-w-full border-collapse">
            <thead className="bg-slate-100/80 sticky top-0 z-10 text-slate-500 font-black uppercase tracking-widest text-left">
              <tr>
                <th className="px-4 py-3 border-b border-slate-200">MATERIAL</th>
                <th className="px-4 py-3 border-b border-slate-200 min-w-[150px]">NOMBRE</th>
                <th className="px-4 py-3 border-b border-slate-200 text-right">CANT</th>
                <th className="px-4 py-3 border-b border-slate-200 text-center text-indigo-700 bg-indigo-50/30">H</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filteredOrders.length > 0 ? filteredOrders.map((o, i) => {
                const makeKey = (ord: any) => `${ord['ORDEN'] || ''}|${String(ord['MATERIAL'] || ord['CodMaterial'] || '')}|${String(ord['CANTIDAD'] || ord['CANTPROGRAMADA'] || '')}`;
                const isAdjusted = !!o._isAdjusted;
                const isSplitRemainder = !!o._isSplitRemainder;
                const isSplitPart = !!o._isSplit;
                const isExcess = !isAdjusted && !isSplitRemainder && !!excessOrderKeys?.has(makeKey(o));
                const qty = isConsolidated && o._isConsolidated ? o._totalQty : Number(o['CANTIDAD'] || o['CANTPROGRAMADA'] || 0);
                const tSeconds = calculateProductionTime(o['MATERIAL'] || o['CodMaterial'] || '', qty, o);
                const tHours = tSeconds / 3600;
                const materialCode = o['CodMaterial'] || normalizeMaterialCode(o['MATERIAL'] || '');
                const materialName = o['NOMBRE'] || o['TEXTOMATERIAL'] || o['Material'] || '—';

                const textColor = isAdjusted ? 'text-red-600' : isSplitRemainder ? 'text-violet-600' : isExcess ? 'text-amber-700' : 'text-slate-700';
                return (
                  <tr key={i} className={cn('hover:bg-indigo-50/30 transition-colors', isAdjusted && 'bg-red-50/50', isSplitRemainder && 'bg-violet-50/50', isExcess && 'bg-amber-50/60')}>
                    <td className={cn('px-4 py-3 font-mono font-bold whitespace-nowrap', textColor)}>
                      {isSplitPart && <span className="mr-1 text-violet-500" title="Orden dividida">✂</span>}
                      {isExcess && <span className="mr-1 text-amber-500">⚠</span>}
                      {materialCode}
                    </td>
                    <td className={cn('px-4 py-3 font-medium whitespace-normal break-words leading-tight', isAdjusted ? 'text-red-600' : isSplitRemainder ? 'text-violet-600' : isExcess ? 'text-amber-700' : 'text-slate-600')}>
                      {materialName}
                      {isSplitPart && (
                        <span className="ml-1.5 inline-block text-[8px] font-black uppercase tracking-wider text-violet-500 align-middle">
                          {isAdjusted ? `· Dividida (${qty.toLocaleString()}/${Number(o._originalCantidad || 0).toLocaleString()})` : `· Remanente (${qty.toLocaleString()}/${Number(o._originalCantidad || 0).toLocaleString()})`}
                        </span>
                      )}
                    </td>
                    <td className={cn('px-4 py-3 text-right font-mono font-black', isAdjusted ? 'text-red-600' : isSplitRemainder ? 'text-violet-600' : isExcess ? 'text-amber-700' : 'text-slate-800')}>{qty.toLocaleString()}</td>
                    <td className={cn('px-4 py-3 text-right font-mono font-black bg-indigo-50/10', isAdjusted ? 'text-red-600' : isSplitRemainder ? 'text-violet-600' : isExcess ? 'text-amber-700' : 'text-indigo-600')}>{tHours.toFixed(2)}</td>
                  </tr>
                );
              }) : (
                <tr>
                  <td colSpan={4} className="py-16 text-center text-slate-400 uppercase font-black tracking-widest text-[9px] opacity-30">Sin carga programada</td>
                </tr>
              )}
            </tbody>
            {filteredOrders.length > 0 && (
              <tfoot className="bg-slate-50 border-t-2 border-slate-200 sticky bottom-0">
                <tr>
                  <td colSpan={2} className="px-4 py-2 text-[9px] font-black uppercase text-slate-400 tracking-widest">
                    {filteredOrders.length} {isConsolidated ? 'materiales' : 'órdenes'} · total
                  </td>
                  <td className="px-4 py-2 text-right font-mono font-black text-slate-900">
                    {filteredOrders.reduce((sum, o) => {
                      const qty = isConsolidated && o._isConsolidated ? o._totalQty : Number(o['CANTIDAD'] || o['CANTPROGRAMADA'] || 0);
                      return sum + qty;
                    }, 0).toLocaleString()}
                  </td>
                  <td className="px-4 py-2 text-right font-mono font-black text-indigo-700 bg-indigo-50/30">
                    {totalTimeHours.toFixed(2)}
                  </td>
                </tr>
              </tfoot>
            )}
          </table>
        </div>
      </div>
    </div>
  );
}, (prevProps, nextProps) => {
  return prevProps.puestoName === nextProps.puestoName &&
    prevProps.small === nextProps.small &&
    prevProps.isConsolidated === nextProps.isConsolidated &&
    prevProps.config.machines === nextProps.config.machines &&
    prevProps.config.isDayActive === nextProps.config.isDayActive &&
    prevProps.config.isNightActive === nextProps.config.isNightActive &&
    prevProps.config.people === nextProps.config.people &&
    prevProps.horasNetasDiurnas === nextProps.horasNetasDiurnas &&
    prevProps.horasNetasNocturnas === nextProps.horasNetasNocturnas &&
    prevProps.orders === nextProps.orders &&
    prevProps.adjustedInOrders === nextProps.adjustedInOrders &&
    prevProps.excludeOrderKeys === nextProps.excludeOrderKeys &&
    prevProps.excessOrderKeys === nextProps.excessOrderKeys &&
    prevProps.splitRemainderOrders === nextProps.splitRemainderOrders;
});

// Registros del plan táctico cuyo "valor" corresponde a Centro 1000/2000
// (ej: "Plan Táctico - Centro 1000", "Plan Táctico - Centro 2000 - P2" — el sufijo "-P#" es opcional
// porque en datos reales no siempre aparece)
const PLAN_GRUPO_VALOR_REGEX = /plan\s*t[aá]ctico\s*-\s*centro\s*(1000|2000)(\s*-\s*p\d+)?/i;

// Quita tildes y pasa a mayúsculas, para comparar nombres de componentes sin depender de acentos (ej: LÁMINA vs LAMINA)
const DIACRITICS_REGEX = /[̀-ͯ]/g;
const normalizeText = (s: string) => s.normalize('NFD').replace(DIACRITICS_REGEX, '').toUpperCase();

const NIVEL_RESUMEN_PAGE_SIZE = 10;

// Tabla de resumen (código, descripción, cantidad total necesaria) con paginación propia,
// reutilizada en las tablas de los Niveles 1-4 del árbol de explosión de componentes.
const NivelResumenTable: React.FC<{
  rows: { material: string; nombre: string; cantidadTotal: number }[];
  codigoLabel: string;
  tituloBar?: string;
  tituloBarBg?: string;
  referenciaSufijo?: string;
  sinDatosLabel?: string;
}> = ({ rows, codigoLabel, tituloBar, tituloBarBg = 'bg-slate-900', referenciaSufijo = '', sinDatosLabel = 'Sin componentes en esta categoría' }) => {
  const [page, setPage] = useState(1);
  const totalPages = Math.max(1, Math.ceil(rows.length / NIVEL_RESUMEN_PAGE_SIZE));
  const pageSafe = Math.min(page, totalPages);

  useEffect(() => { setPage(1); }, [rows]);

  const pageRows = useMemo(() => {
    const start = (pageSafe - 1) * NIVEL_RESUMEN_PAGE_SIZE;
    return rows.slice(start, start + NIVEL_RESUMEN_PAGE_SIZE);
  }, [rows, pageSafe]);

  if (rows.length === 0) {
    return (
      <div>
        {tituloBar && <div className={cn('px-6 py-3 text-white font-black text-[10px] uppercase tracking-widest', tituloBarBg)}>{tituloBar}</div>}
        <div className="py-16 text-center text-slate-400 uppercase font-black tracking-widest text-[10px] opacity-40">{sinDatosLabel}</div>
      </div>
    );
  }

  return (
    <div className="overflow-x-auto">
      {tituloBar && <div className={cn('px-6 py-3 text-white font-black text-[10px] uppercase tracking-widest', tituloBarBg)}>{tituloBar}</div>}
      <table className="w-full text-[11px] border-collapse">
        <thead className={cn(tituloBar ? 'bg-slate-50 text-slate-500 border-b border-slate-200' : 'bg-slate-900 sticky top-0 z-10 text-white', 'text-left uppercase tracking-widest font-black')}>
          <tr>
            <th className="px-6 py-4 text-[10px]">{codigoLabel}</th>
            <th className="px-6 py-4 text-[10px]">Descripción</th>
            <th className="px-6 py-4 text-[10px] text-right">Cantidad Total Necesaria</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-100">
          {pageRows.map((row, i) => (
            <tr key={i} className="hover:bg-slate-50 transition-colors text-[10px]">
              <td className="px-6 py-4 font-mono font-bold text-slate-600">{row.material}</td>
              <td className="px-6 py-4 font-black text-slate-800 uppercase">{row.nombre}</td>
              <td className="px-6 py-4 text-right font-mono font-black text-indigo-700">{Math.round(row.cantidadTotal).toLocaleString()}</td>
            </tr>
          ))}
        </tbody>
      </table>
      <div className="flex items-center justify-between px-6 py-3 border-t border-slate-200 bg-slate-50/50">
        <div className="text-[9px] font-black uppercase tracking-widest text-slate-400">
          {rows.length} referencia{rows.length === 1 ? '' : 's'}{referenciaSufijo}
        </div>
        <div className="flex items-center gap-1">
          <Button variant="outline" size="icon" onClick={() => setPage(1)} disabled={pageSafe === 1} className="h-7 w-7"><ChevronsLeft className="h-3.5 w-3.5" /></Button>
          <Button variant="outline" size="icon" onClick={() => setPage(p => p - 1)} disabled={pageSafe === 1} className="h-7 w-7"><ChevronLeft className="h-3.5 w-3.5" /></Button>
          <div className="px-3 text-[10px] font-bold text-gray-700 min-w-[90px] text-center border-x py-1 bg-white rounded">Pág. {pageSafe} de {totalPages}</div>
          <Button variant="outline" size="icon" onClick={() => setPage(p => p + 1)} disabled={pageSafe === totalPages} className="h-7 w-7"><ChevronRight className="h-3.5 w-3.5" /></Button>
          <Button variant="outline" size="icon" onClick={() => setPage(totalPages)} disabled={pageSafe === totalPages} className="h-7 w-7"><ChevronsRight className="h-3.5 w-3.5" /></Button>
        </div>
      </div>
    </div>
  );
};

const renderDateFilterHeader = (techStartDate: string, setTechStartDate: (d: string) => void, techEndDate: string, setTechEndDate: (d: string) => void) => (
  <div className="flex items-center justify-between p-6 bg-white border border-slate-200 rounded-[2rem] shadow-sm mb-6">
    <div className="flex items-center gap-3">
      <div className="bg-indigo-600 p-2 rounded-xl text-white shadow-lg shadow-indigo-100">
        <CalendarIcon className="w-4 h-4" />
      </div>
      <div>
        <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-0.5">Rango de Carga Técnica</p>
        <p className="text-xs font-black text-indigo-900">Filtrado por Fecha de Inicio de Órdenes</p>
      </div>
    </div>
    
    <div className="flex items-center gap-4">
      <div className="flex items-center gap-2">
        <span className="text-[9px] font-black text-slate-400 uppercase">Desde:</span>
        <input 
          type="date" 
          value={techStartDate} 
          onChange={(e) => setTechStartDate(e.target.value)}
          className="text-xs font-bold text-slate-700 bg-slate-50 border border-slate-200 rounded-lg px-3 py-1.5 focus:ring-indigo-500 outline-none"
        />
      </div>
      <div className="flex items-center gap-2">
        <span className="text-[9px] font-black text-slate-400 uppercase">Hasta:</span>
        <input 
          type="date" 
          value={techEndDate} 
          onChange={(e) => setTechEndDate(e.target.value)}
          className="text-xs font-bold text-slate-700 bg-slate-50 border border-slate-200 rounded-lg px-3 py-1.5 focus:ring-indigo-500 outline-none"
        />
      </div>
    </div>
  </div>
);

export const TacticalPlanForrosSection: React.FC = () => {
  const { addNotification, apiCuboInventariosData } = useAppContext();
  const [isMounted, setIsMounted] = useState(false);
  const [grupos, setGrupos] = useState<Grupo[]>([]);
  const [restricciones, setRestricciones] = useState<Restriccion[]>([]);
  const [tiemposProduccion, setTiemposProduccion] = useState<any[]>([]);
  const [ordenesFert, setOrdenesFert] = useState<any[]>([]);
  const [kpiMaestroData, setKpiMaestroData] = useState<any[]>([]);
  const [ordenesPrevisionalesData, setOrdenesPrevisionalesData] = useState<any[]>([]);
  const [listaMaterialesData, setListaMaterialesData] = useState<any[]>([]);
  const [explodedComponentsData, setExplodedComponentsData] = useState<any[]>([]);
  const [explodedForrosData, setExplodedForrosData] = useState<{ material: string; nombre: string; centro: string; cantidadUnitaria: number; cantidadTotal: number; fertParent: string }[]>([]);
  const [isAchConsolidated, setIsAchConsolidated] = useState(false);
  const [achBandAdjustedOrders, setAchBandAdjustedOrders] = useState<any[]>([]);
  const [isBandAdjustActive, setIsBandAdjustActive] = useState(false);
  const [isBandAdjustAccepted, setIsBandAdjustAccepted] = useState(false);
  const [isBordBandAdjustActive, setIsBordBandAdjustActive] = useState(false);
  const [bordBandAcceptedMachines, setBordBandAcceptedMachines] = useState<Set<string>>(new Set());
  const [isRmtbAdjustActive, setIsRmtbAdjustActive] = useState(false);
  const [rmtbAcceptedMachines, setRmtbAcceptedMachines] = useState<Set<string>>(new Set());
  const [rmtbMovedOrders, setRmtbMovedOrders] = useState<{ order: any; fromHR: string; toHR: string }[]>([]);
  const [rmtbmBandaLiberada, setRmtbmBandaLiberada] = useState<{ material: string; nombre: string; cantidad: number; causedByMat: string }[]>([]);
  const [isLoadingRmtbmBOM, setIsLoadingRmtbmBOM] = useState(false);
  const [isCorteAdjustActive, setIsCorteAdjustActive] = useState(false);
  const [corteAcceptedMachines, setCorteAcceptedMachines] = useState<Set<string>>(new Set());
  const [corteMovedOrders, setCorteMovedOrders] = useState<{ order: any; fromHR: string; toHR: string }[]>([]);
  const [isBscAdjustActive, setIsBscAdjustActive] = useState(false);
  const [bscAcceptedMachines, setBscAcceptedMachines] = useState<Set<string>>(new Set());
  const [bscMovedOrders, setBscMovedOrders] = useState<{ order: any; fromHR: string; toHR: string }[]>([]);
  const [isIntpfAdjustActive, setIsIntpfAdjustActive] = useState(false);
  const [intpfAcceptedMachines, setIntpfAcceptedMachines] = useState<Set<string>>(new Set());
  const [intpfMovedOrders, setIntpfMovedOrders] = useState<{ order: any; fromHR: string; toHR: string }[]>([]);
  const [isTtchnAdjustActive, setIsTtchnAdjustActive] = useState(false);
  const [ttchnAcceptedMachines, setTtchnAcceptedMachines] = useState<Set<string>>(new Set());
  const [ttchnMovedOrders, setTtchnMovedOrders] = useState<{ order: any; fromHR: string; toHR: string }[]>([]);
  const [bordBandExcessKeys, setBordBandExcessKeys] = useState<Set<string>>(new Set());
  const [planFinalOrders, setPlanFinalOrders] = useState<any[]>([]);

  const [isLoading, setIsLoading] = useState(true);
  const [isLoadingFert, setIsLoadingFert] = useState(false);
  const [isLoadingKPI, setIsLoadingKPI] = useState(false);
  const [isLoadingPrevisionales, setIsLoadingPrevisionales] = useState(false);
  const [searchQueryPrevisionales, setSearchQueryPrevisionales] = useState('');
  const [isLoadingListaMateriales, setIsLoadingListaMateriales] = useState(false);
  const [isLoadingTiempos, setIsLoadingTiempos] = useState(false);
  const [isLoadingExplosion, setIsLoadingExplosion] = useState(false);
  const [bomDownloadProgress, setBomDownloadProgress] = useState(0);
  const [explosionProgress, setExplosionProgress] = useState(0);
  
  const [loadedTabs, setLoadedTabs] = useState<Set<string>>(new Set(['acolchado-tapas']));
  const [activeMainTab, setActiveMainTab] = useState('acolchado-tapas');
  const hojaRutaCacheRef = React.useRef<Record<string, string>>({});
  const kpiIndexRef = React.useRef<Record<string, any>>({});
  const tiemposIndexRef = React.useRef<Record<string, any>>({});
  const [dataReady, setDataReady] = useState(false);
  
  const [jornadaDiurnaSel, setJornadaDiurnaSel] = useState("8.75");
  const [jornadaNocturnaSel, setJornadaNocturnaSel] = useState("0");
  const [workstationConfigs, setWorkstationConfigs] = useState<Record<string, WorkstationConfig>>({});

  const [targetDate1000, setTargetDate1000] = useState<string>("");
  const [targetDate2000, setTargetDate2000] = useState<string>("");
  
  const [techStartDate, setTechStartDate] = useState<string>("");
  const [techEndDate, setTechEndDate] = useState<string>("");

  const [planGrupoFecha, setPlanGrupoFecha] = useState<string>("");
  const [planGrupoDetalleData, setPlanGrupoDetalleData] = useState<any[]>([]);
  const [isLoadingPlanGrupo, setIsLoadingPlanGrupo] = useState(false);
  const [hasFetchedPlanGrupo, setHasFetchedPlanGrupo] = useState(false);
  const [planGrupoPage, setPlanGrupoPage] = useState(1);
  const PLAN_GRUPO_PAGE_SIZE = 10;

  const [isPlanGrupoCalendarOpen, setIsPlanGrupoCalendarOpen] = useState(false);

  // Fechas (yyyy-MM-dd) que tienen al menos un plan_grupo activo recuperable, para sombrear el calendario
  const [fechasConPlanRecuperable, setFechasConPlanRecuperable] = useState<Set<string>>(new Set());

  // Explosión de componentes por niveles (COMPONENTES_CAPACIDAD_ENS: ACOLCHADO&FORRO&LÁMINA&TAPA)
  // Orden real de la cadena BOM: Nivel 1 FORRO → Nivel 2 TAPA → Nivel 3 ACOLCHADO → Nivel 4 LÁMINA
  const [nivelExplosionData, setNivelExplosionData] = useState<any[]>([]);
  const [isLoadingNivelExplosion, setIsLoadingNivelExplosion] = useState(false);
  const [hasFetchedNivelExplosion, setHasFetchedNivelExplosion] = useState(false);
  const [nivelExplosionProgress, setNivelExplosionProgress] = useState(0);

  const [nivel2ExplosionData, setNivel2ExplosionData] = useState<any[]>([]);
  const [isLoadingNivel2, setIsLoadingNivel2] = useState(false);
  const [hasFetchedNivel2, setHasFetchedNivel2] = useState(false);
  const [nivel2Progress, setNivel2Progress] = useState(0);

  const [nivel3ExplosionData, setNivel3ExplosionData] = useState<any[]>([]);
  const [isLoadingNivel3, setIsLoadingNivel3] = useState(false);
  const [hasFetchedNivel3, setHasFetchedNivel3] = useState(false);
  const [nivel3Progress, setNivel3Progress] = useState(0);

  // Cadena automática Nivel 1 → 2 → 3 disparada por un único botón (0 = inactiva, 1/2/3 = esperando a que termine ese nivel)
  const [autoChainStep, setAutoChainStep] = useState<0 | 1 | 2 | 3>(0);

  const [nivel4ExplosionData, setNivel4ExplosionData] = useState<any[]>([]);
  const [isLoadingNivel4, setIsLoadingNivel4] = useState(false);
  const [hasFetchedNivel4, setHasFetchedNivel4] = useState(false);
  const [nivel4Progress, setNivel4Progress] = useState(0);

  // Modo visualización del Plan Táctico de Grupos (P2 - Forros): al guardar, el flujo de
  // explosión/cuadre queda bloqueado y solo se libera si el usuario confirma desactivar el
  // plan guardado o generar uno nuevo (ver handleGuardarPlanNivel4 más abajo).
  const [planP2Guardado, setPlanP2Guardado] = useState(false);
  const [planP2GuardadoInfo, setPlanP2GuardadoInfo] = useState<{
    planes: { codigo_plan_grupo: number; nombre_grupo: string }[];
    detalles: number[];
  } | null>(null);
  const [editarPlanP2ConfirmOpen, setEditarPlanP2ConfirmOpen] = useState(false);
  const [isDesactivandoPlanP2, setIsDesactivandoPlanP2] = useState(false);

  const addBusinessDays = useCallback((startDate: Date, days: number): string => {
    const date = new Date(startDate);
    let count = 0;
    while (count < days) {
      date.setDate(date.getDate() + 1);
      const day = date.getDay();
      if (day !== 0 && day !== 6) count++;
    }
    return date.toISOString().split('T')[0];
  }, []);

  const [planningDate, setPlanningDate] = useState<string | null>(null);

  useEffect(() => {
    setIsMounted(true);
    const nextWorkDay = addBusinessDays(new Date(), 1);
    setPlanningDate(nextWorkDay);
  }, [addBusinessDays]);

  const planningDateFormatted = useMemo(() => {
    if (!planningDate) return '';
    const date = new Date(planningDate + 'T00:00:00');
    return date.toLocaleDateString('es-ES', { 
      weekday: 'long', 
      day: 'numeric', 
      month: 'long', 
      year: 'numeric' 
    });
  }, [planningDate]);

  useEffect(() => {
    if (kpiMaestroData.length > 0) {
      const newIndex: Record<string, any> = {};
      kpiMaestroData.forEach(kpi => {
        const key = `${String(kpi.CodigoMaterial || '').trim()}|${String(kpi.HRUTA || '').toUpperCase().trim()}`;
        newIndex[key] = kpi;
      });
      kpiIndexRef.current = newIndex;
    }
  }, [kpiMaestroData]);
  
  useEffect(() => {
    if (tiemposProduccion.length > 0) {
      const newIndex: Record<string, any> = {};
      tiemposProduccion.forEach(t => {
        const key = String(t.CodMaterial || t.Material || '').trim();
        if (!newIndex[key]) newIndex[key] = [];
        newIndex[key].push(t);
      });
      tiemposIndexRef.current = newIndex;
    }
  }, [tiemposProduccion]);

  const normalizeMaterialCode = useCallback((code: string | number): string => {
    if (!code) return '';
    const codeStr = String(code).trim();
    return codeStr.replace(/^0+/, '').slice(-8);
  }, []);

  const mapToHojaRuta = useCallback((puestoName: string): string => {
    const pn = String(puestoName || '').toUpperCase().trim();
    if (!pn || pn === '—' || pn === 'NULL') return '';
    if (hojaRutaCacheRef.current[pn]) return hojaRutaCacheRef.current[pn];
    
    if (pn === 'CORTE-ESPUMA') {
      const res = 'HR-CTESP';
      hojaRutaCacheRef.current[pn] = res;
      return res;
    }

    if (pn === 'CORTELA10') {
      const res = 'HR-CTBSC / HR-CTCHN / HR-CTINT / HR-CTBAN';
      hojaRutaCacheRef.current[pn] = res;
      return res;
    }

    if (pn === 'COSEDORA-TTCHN' || pn === 'TTCF') {
      const res = 'HR-TTCF';
      hojaRutaCacheRef.current[pn] = res;
      return res;
    }

    if (pn === 'COSEDORA-INTPF' || pn === 'COSEDORA-INTPF1' || pn === 'COSEDORA-INTPF2' || pn === 'INTPF' || pn === 'INTP-F') {
      const res = 'HR-INTPF';
      hojaRutaCacheRef.current[pn] = res;
      return res;
    }

    const kpiMatch = kpiMaestroData.find(k => String(k.Categoria || '').toUpperCase().trim() === pn);
    if (kpiMatch && kpiMatch.HRUTA) {
      const result = String(kpiMatch.HRUTA).trim().toUpperCase();
      hojaRutaCacheRef.current[pn] = result;
      return result;
    }
    
    let result = '';
    if (pn === 'ACOLCHADORA09') result = 'HR-ACH09';
    else if (pn === 'COSEDORA-ACH02') result = 'HR-PEF02';
    else if (pn === 'COSEDORA-ACH08') result = 'HR-PEF08';
    else if (pn === 'BORDADORA-BANDA01') result = 'HR-BO01';
    else if (pn.includes('FORRO-COLCHONES')) result = 'HR-FORRO';
    
    if (!result && tiemposIndexRef.current[pn]) {
      const tiemposList = tiemposIndexRef.current[pn];
      if (Array.isArray(tiemposList) && tiemposList.length > 0) {
        const hr = String(tiemposList[0].HojaRuta || tiemposList[0]['HOJA DE RUTA'] || '').trim();
        if (hr && hr.startsWith('HR-')) result = hr;
      }
    }
    
    if (!result) {
      const numMatch = pn.match(/\d+/);
      const num = numMatch ? numMatch[0].padStart(2, '0') : '';
      if (pn.includes('COSEDORA') || pn.includes('PEGADORA') || pn.includes('PEF')) result = `HR-PEF${num}`;
      else if (pn.includes('ACOLCHADORA') || pn.includes('ACH')) result = `HR-ACH${num}`;
      else result = pn.startsWith('HR-') ? pn : `HR-${pn}`;
    }
    
    hojaRutaCacheRef.current[pn] = result;
    return result;
  }, [kpiMaestroData]);

  useEffect(() => {
    if (isMounted) {
      const today = new Date();
      if (!targetDate1000) setTargetDate1000(addBusinessDays(today, 3));
      if (!targetDate2000) setTargetDate2000(addBusinessDays(today, 2));
      if (!techStartDate) setTechStartDate(today.toISOString().split('T')[0]);
      if (!techEndDate) setTechEndDate(addBusinessDays(today, 1));
    }
  }, [isMounted, targetDate1000, targetDate2000, techStartDate, techEndDate, addBusinessDays]);

  const fetchBaseData = useCallback(async () => {
    try {
      setIsLoading(true);
      const [gRes, rRes] = await Promise.all([
        grupoService.getAll(),
        restriccionService.getAll()
      ]);
      setGrupos(gRes.data || []);
      setRestricciones(rRes.data || []);
    } catch (error) {
      console.error('Error fetching base data:', error);
    } finally {
      setIsLoading(false);
    }
  }, []);

  const fetchOrdenesFert = useCallback(async () => {
    setIsLoadingFert(true);
    try {
      const response = await serviciosService.getOrdenesFert(1, 10000);
      setOrdenesFert(response.data || []);
    } catch (error: any) {
      console.error('Error fetching Fert orders:', error);
      addNotification('error', `Error al cargar órdenes FERT: ${error.message}`);
    } finally {
      setIsLoadingFert(false);
    }
  }, [addNotification]);

  const fetchKPIMaestro = useCallback(async () => {
    setIsLoadingKPI(true);
    try {
      const response = await serviciosService.getKPIMaestroForros();
      setKpiMaestroData(response.data || []);
    } catch (error: any) {
      console.error('Error fetching KPI Maestro:', error);
      addNotification('error', `Error al cargar KPI Maestro: ${error.message}`);
    } finally {
      setIsLoadingKPI(false);
    }
  }, [addNotification]);

  const fetchOrdenesPrevisionales = useCallback(async () => {
    setIsLoadingPrevisionales(true);
    try {
      const response = await serviciosService.OrdenesProvisionalesPaginados(1, 5000);
      setOrdenesPrevisionalesData(response.data || []);
    } catch (error: any) {
      console.error('Error fetching Provisional orders:', error);
      addNotification('error', `Error al cargar órdenes previsionales: ${error.message}`);
    } finally {
      setIsLoadingPrevisionales(false);
    }
  }, [addNotification]);

  const fetchListaMateriales = useCallback(async () => {
    setIsLoadingListaMateriales(true);
    setBomDownloadProgress(0);
    try {
      const rowsPerPage = 5000;
      const firstResponse = await serviciosService.ReporteExplosionMateriales(1, rowsPerPage);
      const firstData = firstResponse.data || [];
      const total = firstResponse.totalRegistros || firstResponse.totalRecords || firstResponse.totalRows || 0;
      let allData = [...firstData];
      const totalPages = Math.ceil(total / rowsPerPage);
      if (totalPages > 1) {
        for (let p = 2; p <= totalPages; p++) {
          setBomDownloadProgress(Math.round(((p - 1) / totalPages) * 100));
          const nextResponse = await serviciosService.ReporteExplosionMateriales(p, rowsPerPage);
          if (nextResponse.data) allData = [...allData, ...nextResponse.data];
        }
      }
      setListaMaterialesData(allData);
      setBomDownloadProgress(100);
    } catch (error: any) {
      console.error('Error fetching BOM list:', error);
      addNotification('error', `Error al cargar Lista de Materiales: ${error.message}`);
    } finally {
      setIsLoadingListaMateriales(false);
    }
  }, [addNotification]);

useEffect(() => {
    if (isMounted) {
      fetchBaseData();
      fetchKPIMaestro();
      fetchOrdenesPrevisionales();
    }
  }, [isMounted, fetchBaseData, fetchKPIMaestro, fetchOrdenesPrevisionales]);
  
  useEffect(() => {
    if (tiemposProduccion.length > 0 && kpiMaestroData.length > 0 && ordenesPrevisionalesData.length > 0) {
      setDataReady(true);
    }
  }, [tiemposProduccion, kpiMaestroData, ordenesPrevisionalesData]);

  const forrosGruposList = useMemo(() => {
    return grupos.filter(g => {
      const name = (g.nombre_grupo || '').toUpperCase();
      return name.includes('FORRO') || name.includes('CHN') || name.includes('BASE') || name.includes('BANDA') || name.includes('ACOLCHADO') || name.includes('TAPAS') || name.includes('MODULAR') || name.includes('TAPA');
    });
  }, [grupos]);

  const allowedRespCodes = useMemo(() => {
    const codes = new Set<string>();
    const forroGroupCodes = new Set(forrosGruposList.map(g => g.codigo_grupo));
    restricciones.forEach(r => {
      if (forroGroupCodes.has(r.codigo_grupo)) {
        const normName = r.nombre_restriccion.toUpperCase().trim();
        if (normName === 'RESP_CTRL_PROD' || normName === 'RESPCTRLPROD') {
          const values = r.valor_restriccion.split('&');
          values.forEach(v => {
            const clean = v.trim().replace(/^0+/, '');
            if (clean) codes.add(clean);
          });
        }
      }
    });
    return Array.from(codes);
  }, [restricciones, forrosGruposList]);

  const allowedComponentsCHN = useMemo(() => {
    const keywords = new Set<string>();
    const forroGroupCodes = new Set(forrosGruposList.map(g => g.codigo_grupo));
    restricciones.forEach(r => {
      if (forroGroupCodes.has(r.codigo_grupo)) {
        const normName = r.nombre_restriccion.toUpperCase().trim();
        if (normName === 'COMPONENTES_CHN') {
          const values = r.valor_restriccion.split('&');
          values.forEach(v => {
            const clean = v.trim().toUpperCase();
            if (clean) keywords.add(clean);
          });
        }
      }
    });
    return Array.from(keywords);
  }, [restricciones, forrosGruposList]);

  const { fert1000, fert2000, summary1000, summary2000 } = useMemo(() => {
    const filter1000 = ordenesFert.filter(order => {
      const centro = String(order['Centro'] || order['CENTRO'] || '').trim();
      const resp = String(order['RESPCTRLPROD'] || order['RESP_CTRL_PROD'] || '').trim().replace(/^0+/, '');
      const date = String(order['FECHA'] || order['FECHA_INICIO'] || order['FECHAINICIO'] || '').split('T')[0];
      return centro === '1000' && (resp === '3' || resp === '4') && date === targetDate1000;
    });

    const filter2000 = ordenesFert.filter(order => {
      const centro = String(order['Centro'] || order['CENTRO'] || '').trim();
      const resp = String(order['RESPCTRLPROD'] || order['RESP_CTRL_PROD'] || '').trim().replace(/^0+/, '');
      const date = String(order['FECHA'] || order['FECHA_INICIO'] || order['FECHAINICIO'] || '').split('T')[0];
      return centro === '2000' && (resp === '3' || resp === '6') && date === targetDate2000;
    });

    const getSummary = (orders: any[]) => {
      const map = new Map<string, number>();
      orders.forEach(o => {
        const resp = String(o['RESPCTRLPROD'] || o['RESP_CTRL_PROD'] || 'S/R').trim().replace(/^0+/, '');
        const qty = Number(o['CANTIDAD'] || o['CANTPROGRAMADA'] || 0);
        map.set(resp, (map.get(resp) || 0) + qty);
      });
      return Array.from(map.entries()).map(([resp, total]) => ({ resp, total }));
    };

    return { 
      fert1000: filter1000, 
      fert2000: filter2000,
      summary1000: getSummary(filter1000),
      summary2000: getSummary(filter2000)
    };
  }, [ordenesFert, targetDate1000, targetDate2000]);

  const gruposCoincidentes = useMemo(() => {
    const valoresDepto = restricciones
      .filter(r => r.nombre_restriccion.toUpperCase().trim() === 'DEPARTAMENTO_PLAN_INICIAL')
      .map(r => r.valor_restriccion.toLowerCase().trim());
    return grupos.filter(g => valoresDepto.includes(g.nombre_grupo.toLowerCase().trim()));
  }, [grupos, restricciones]);

  useEffect(() => {
    if (gruposCoincidentes.length === 0) {
      setFechasConPlanRecuperable(new Set());
      return;
    }
    let cancelled = false;
    (async () => {
      try {
        const codigosGrupo = new Set(gruposCoincidentes.map(g => g.codigo_grupo));
        const response = await planGrupoService.getAll();
        const fechas = new Set<string>();
        (response.data || []).forEach((pg: PlanGrupo) => {
          if (
            codigosGrupo.has(pg.codigo_grupo) &&
            pg.estado === 'A' &&
            pg.fecha_inicio_plan &&
            PLAN_GRUPO_VALOR_REGEX.test(String(pg.valor || ''))
          ) {
            fechas.add(new Date(pg.fecha_inicio_plan).toISOString().split('T')[0]);
          }
        });
        if (!cancelled) setFechasConPlanRecuperable(fechas);
      } catch (error: any) {
        if (!cancelled) addNotification('error', `Error al consultar planes existentes: ${error.message}`);
      }
    })();
    return () => { cancelled = true; };
  }, [gruposCoincidentes, addNotification]);

  const fetchPlanGrupoDetalle = useCallback(async (fechaOverride?: string) => {
    const fecha = fechaOverride ?? planGrupoFecha;
    if (!fecha || gruposCoincidentes.length === 0) return;
    setIsLoadingPlanGrupo(true);
    setHasFetchedPlanGrupo(true);
    setPlanGrupoPage(1);
    try {
      const gruposParam = gruposCoincidentes.map(g => g.codigo_grupo).join('&');
      const response = await serviciosService.detallePlanTacticoPorGrupos(gruposParam, fecha);
      const data = response.data || [];
      setPlanGrupoDetalleData(data);
    } catch (error: any) {
      addNotification('error', `Error al consultar el plan táctico por grupos: ${error.message}`);
      setPlanGrupoDetalleData([]);
    } finally {
      setIsLoadingPlanGrupo(false);
    }
  }, [planGrupoFecha, gruposCoincidentes, addNotification]);

  const planGrupoDetalleFiltrada = useMemo(() => {
    return planGrupoDetalleData.filter(item => PLAN_GRUPO_VALOR_REGEX.test(String(item.valor || '')));
  }, [planGrupoDetalleData]);

  const resumenLineaProduccion = useMemo(() => {
    const map = new Map<string, number>();
    planGrupoDetalleFiltrada.forEach(item => {
      const linea = String(item.linea_produccion || 'Sin línea').trim() || 'Sin línea';
      map.set(linea, (map.get(linea) || 0) + Number(item.cantidad_produccion_neta || 0));
    });
    return Array.from(map.entries())
      .map(([linea_produccion, totalCantidadProdNeta]) => ({ linea_produccion, totalCantidadProdNeta }))
      .sort((a, b) => b.totalCantidadProdNeta - a.totalCantidadProdNeta);
  }, [planGrupoDetalleFiltrada]);

  const planGrupoTotalPages = Math.max(1, Math.ceil(planGrupoDetalleFiltrada.length / PLAN_GRUPO_PAGE_SIZE));

  const paginatedPlanGrupoDetalle = useMemo(() => {
    const start = (planGrupoPage - 1) * PLAN_GRUPO_PAGE_SIZE;
    return planGrupoDetalleFiltrada.slice(start, start + PLAN_GRUPO_PAGE_SIZE);
  }, [planGrupoDetalleFiltrada, planGrupoPage]);

  // Palabras clave de la restricción global COMPONENTES_CAPACIDAD_ENS (ej: ACOLCHADO, FORRO, LÁMINA)
  const componentesCapacidadEnsKeywords = useMemo(() => {
    const keywords: string[] = [];
    restricciones
      .filter(r => r.nombre_restriccion.toUpperCase().trim() === 'COMPONENTES_CAPACIDAD_ENS')
      .forEach(r => {
        r.valor_restriccion.split('&').forEach(v => {
          const clean = v.trim().toUpperCase();
          if (clean && !keywords.includes(clean)) keywords.push(clean);
        });
      });
    return keywords;
  }, [restricciones]);

  // Misma lista, sin tildes, para comparar contra descripciones de componentes que pueden venir sin acentos
  const componentesCapacidadEnsKeywordsNorm = useMemo(
    () => componentesCapacidadEnsKeywords.map(normalizeText),
    [componentesCapacidadEnsKeywords]
  );

  // Materiales FERT (colchones) únicos del Plan Táctico de Grupos, con su cantidad neta a producir
  const fertMaterialesColchones = useMemo(() => {
    const map = new Map<string, { material: string; cantidadNeta: number }>();
    planGrupoDetalleFiltrada.forEach(item => {
      const material = String(item.codigo_material || '').trim();
      if (!material) return;
      const qty = Number(item.cantidad_produccion_neta || 0);
      const existing = map.get(material);
      if (existing) existing.cantidadNeta += qty;
      else map.set(material, { material, cantidadNeta: qty });
    });
    return Array.from(map.values());
  }, [planGrupoDetalleFiltrada]);

  const fetchNivelExplosionComponentes = useCallback(async () => {
    if (fertMaterialesColchones.length === 0) {
      addNotification('warning', 'No hay materiales del Plan Táctico de Grupos para explosionar.');
      return;
    }
    setIsLoadingNivelExplosion(true);
    setHasFetchedNivelExplosion(true);
    setNivelExplosionProgress(0);
    const allComponents: any[] = [];
    try {
      for (let i = 0; i < fertMaterialesColchones.length; i++) {
        const { material, cantidadNeta } = fertMaterialesColchones[i];
        setNivelExplosionProgress(Math.round((i / fertMaterialesColchones.length) * 100));
        const response = await serviciosService.getMaestroMaterialesExplosion('1000', material, 1, 5000);
        const components = response.data || [];
        components.forEach((comp: any) => {
          allComponents.push({ ...comp, fertParent: material, fertCantidadNeta: cantidadNeta });
        });
      }
      setNivelExplosionData(allComponents);
      setNivelExplosionProgress(100);
      addNotification('success', `Explosión completada para ${fertMaterialesColchones.length} material${fertMaterialesColchones.length === 1 ? '' : 'es'} FERT.`);
    } catch (error: any) {
      addNotification('error', `Error en la explosión de componentes: ${error.message}`);
    } finally {
      setIsLoadingNivelExplosion(false);
    }
  }, [fertMaterialesColchones, addNotification]);

  // Nivel 1: componentes de primer nivel del árbol (respecto al FERT/colchón) cuyo nombre coincide con "FORRO"
  const nivel1ForroComponentes = useMemo(() => {
    if (!componentesCapacidadEnsKeywordsNorm.includes('FORRO')) return [];
    return nivelExplosionData.filter(comp =>
      Number(comp.NIVEL) === 1 &&
      normalizeText(String(comp.DESCRIPCION_COMPONENTE || comp.NOMBRE_COMPONENTE || '')).includes('FORRO')
    );
  }, [nivelExplosionData, componentesCapacidadEnsKeywordsNorm]);

  const nivel1ForroResumen = useMemo(() => {
    const map = new Map<string, { material: string; nombre: string; cantidadTotal: number }>();
    nivel1ForroComponentes.forEach(comp => {
      const material = String(comp.COMPONENTE || '').trim();
      const nombre = String(comp.DESCRIPCION_COMPONENTE || comp.NOMBRE_COMPONENTE || '').trim();
      const cantidadUnitaria = Number(comp.CANTIDAD_UNITARIA || comp.Cantidad || 0);
      const necesidad = cantidadUnitaria * Number(comp.fertCantidadNeta || 0);
      const existing = map.get(material);
      if (existing) existing.cantidadTotal += necesidad;
      else map.set(material, { material, nombre, cantidadTotal: necesidad });
    });
    return Array.from(map.values()).sort((a, b) => b.cantidadTotal - a.cantidadTotal);
  }, [nivel1ForroComponentes]);

  // Mismo resumen del Nivel 1, dividido por FORRO BASE (bases) y FORRO CHN (colchones),
  // según si el nombre del componente incluye "BASE" o no.
  const nivel1ForroResumenPorTipo = useMemo(() => {
    const baseMap = new Map<string, { material: string; nombre: string; cantidadTotal: number }>();
    const chnMap = new Map<string, { material: string; nombre: string; cantidadTotal: number }>();
    nivel1ForroComponentes.forEach(comp => {
      const material = String(comp.COMPONENTE || '').trim();
      const nombre = String(comp.DESCRIPCION_COMPONENTE || comp.NOMBRE_COMPONENTE || '').trim();
      const cantidadUnitaria = Number(comp.CANTIDAD_UNITARIA || comp.Cantidad || 0);
      const necesidad = cantidadUnitaria * Number(comp.fertCantidadNeta || 0);
      const isBase = normalizeText(nombre).includes('BASE');
      const map = isBase ? baseMap : chnMap;
      const existing = map.get(material);
      if (existing) existing.cantidadTotal += necesidad;
      else map.set(material, { material, nombre, cantidadTotal: necesidad });
    });
    return {
      base: Array.from(baseMap.values()).sort((a, b) => b.cantidadTotal - a.cantidadTotal),
      chn: Array.from(chnMap.values()).sort((a, b) => b.cantidadTotal - a.cantidadTotal),
    };
  }, [nivel1ForroComponentes]);

  // Nivel 2: toma como referencia el resumen del Nivel 1 (FORRO) — por cada FORRO único,
  // se vuelve a llamar getMaestroMaterialesExplosion usándolo como Fert, y se filtra NIVEL===1 con nombre "TAPA".
  const fetchNivel2TapaComponentes = useCallback(async () => {
    if (nivel1ForroResumen.length === 0) {
      addNotification('warning', 'No hay componentes de Nivel 1 (FORRO) para explosionar.');
      return;
    }
    setIsLoadingNivel2(true);
    setHasFetchedNivel2(true);
    setNivel2Progress(0);
    const baseForroMaterials = new Set(nivel1ForroResumenPorTipo.base.map(r => r.material));
    const allComponents: any[] = [];
    try {
      for (let i = 0; i < nivel1ForroResumen.length; i++) {
        const { material, cantidadTotal } = nivel1ForroResumen[i];
        setNivel2Progress(Math.round((i / nivel1ForroResumen.length) * 100));
        const response = await serviciosService.getMaestroMaterialesExplosion('1000', material, 1, 5000);
        const components = response.data || [];
        const parentTipo = baseForroMaterials.has(material) ? 'base' : 'chn';
        components.forEach((comp: any) => {
          allComponents.push({ ...comp, parentMaterial: material, parentCantidadTotal: cantidadTotal, parentTipo });
        });
      }
      setNivel2ExplosionData(allComponents);
      setNivel2Progress(100);
      addNotification('success', `Explosión de Nivel 2 completada para ${nivel1ForroResumen.length} material${nivel1ForroResumen.length === 1 ? '' : 'es'} FORRO.`);
    } catch (error: any) {
      addNotification('error', `Error en la explosión de Nivel 2: ${error.message}`);
    } finally {
      setIsLoadingNivel2(false);
    }
  }, [nivel1ForroResumen, nivel1ForroResumenPorTipo, addNotification]);

  const nivel2TapaComponentes = useMemo(() => {
    if (!componentesCapacidadEnsKeywordsNorm.includes('TAPA')) return [];
    return nivel2ExplosionData.filter(comp =>
      Number(comp.NIVEL) === 1 &&
      normalizeText(String(comp.DESCRIPCION_COMPONENTE || comp.NOMBRE_COMPONENTE || '')).includes('TAPA')
    );
  }, [nivel2ExplosionData, componentesCapacidadEnsKeywordsNorm]);

  const nivel2TapaResumen = useMemo(() => {
    const map = new Map<string, { material: string; nombre: string; cantidadTotal: number }>();
    nivel2TapaComponentes.forEach(comp => {
      const material = String(comp.COMPONENTE || '').trim();
      const nombre = String(comp.DESCRIPCION_COMPONENTE || comp.NOMBRE_COMPONENTE || '').trim();
      const cantidadUnitaria = Number(comp.CANTIDAD_UNITARIA || comp.Cantidad || 0);
      const necesidad = cantidadUnitaria * Number(comp.parentCantidadTotal || 0);
      const existing = map.get(material);
      if (existing) existing.cantidadTotal += necesidad;
      else map.set(material, { material, nombre, cantidadTotal: necesidad });
    });
    return Array.from(map.values()).sort((a, b) => b.cantidadTotal - a.cantidadTotal);
  }, [nivel2TapaComponentes]);

  // Mismo resumen del Nivel 2, dividido por TAPA de FORRO CHN (colchones) y TAPA de FORRO BASE (bases),
  // heredando la categoría del FORRO padre del que provino cada TAPA (Nivel 1).
  const nivel2TapaResumenPorTipo = useMemo(() => {
    const baseMap = new Map<string, { material: string; nombre: string; cantidadTotal: number }>();
    const chnMap = new Map<string, { material: string; nombre: string; cantidadTotal: number }>();
    nivel2TapaComponentes.forEach(comp => {
      const material = String(comp.COMPONENTE || '').trim();
      const nombre = String(comp.DESCRIPCION_COMPONENTE || comp.NOMBRE_COMPONENTE || '').trim();
      const cantidadUnitaria = Number(comp.CANTIDAD_UNITARIA || comp.Cantidad || 0);
      const necesidad = cantidadUnitaria * Number(comp.parentCantidadTotal || 0);
      const map = comp.parentTipo === 'base' ? baseMap : chnMap;
      const existing = map.get(material);
      if (existing) existing.cantidadTotal += necesidad;
      else map.set(material, { material, nombre, cantidadTotal: necesidad });
    });
    return {
      base: Array.from(baseMap.values()).sort((a, b) => b.cantidadTotal - a.cantidadTotal),
      chn: Array.from(chnMap.values()).sort((a, b) => b.cantidadTotal - a.cantidadTotal),
    };
  }, [nivel2TapaComponentes]);

  // Nivel 3: toma como referencia el resumen del Nivel 2 (TAPA) — misma lógica, filtrando NIVEL===1 con nombre "ACOLCHADO".
  const fetchNivel3AcolchadoComponentes = useCallback(async () => {
    if (nivel2TapaResumen.length === 0) {
      addNotification('warning', 'No hay componentes de Nivel 2 (TAPA) para explosionar.');
      return;
    }
    setIsLoadingNivel3(true);
    setHasFetchedNivel3(true);
    setNivel3Progress(0);
    const baseTapaMaterials = new Set(nivel2TapaResumenPorTipo.base.map(r => r.material));
    const allComponents: any[] = [];
    try {
      for (let i = 0; i < nivel2TapaResumen.length; i++) {
        const { material, cantidadTotal } = nivel2TapaResumen[i];
        setNivel3Progress(Math.round((i / nivel2TapaResumen.length) * 100));
        const response = await serviciosService.getMaestroMaterialesExplosion('1000', material, 1, 5000);
        const components = response.data || [];
        const parentTipo = baseTapaMaterials.has(material) ? 'base' : 'chn';
        components.forEach((comp: any) => {
          allComponents.push({ ...comp, parentMaterial: material, parentCantidadTotal: cantidadTotal, parentTipo });
        });
      }
      setNivel3ExplosionData(allComponents);
      setNivel3Progress(100);
      addNotification('success', `Explosión de Nivel 3 completada para ${nivel2TapaResumen.length} material${nivel2TapaResumen.length === 1 ? '' : 'es'} TAPA.`);
    } catch (error: any) {
      addNotification('error', `Error en la explosión de Nivel 3: ${error.message}`);
    } finally {
      setIsLoadingNivel3(false);
    }
  }, [nivel2TapaResumen, nivel2TapaResumenPorTipo, addNotification]);

  // Botón único: dispara el Nivel 1 y encadena automáticamente el Nivel 2 y el Nivel 3
  // (el Nivel 4 conserva su propio botón manual, ver fetchNivel4LaminaComponentes)
  const handleExplosionarNiveles1a3 = useCallback(() => {
    if (fertMaterialesColchones.length === 0) {
      addNotification('warning', 'No hay materiales del Plan Táctico de Grupos para explosionar.');
      return;
    }
    setAutoChainStep(1);
    fetchNivelExplosionComponentes();
  }, [fertMaterialesColchones, addNotification, fetchNivelExplosionComponentes]);

  useEffect(() => {
    if (autoChainStep === 1 && hasFetchedNivelExplosion && !isLoadingNivelExplosion) {
      setAutoChainStep(2);
      fetchNivel2TapaComponentes();
    }
  }, [autoChainStep, hasFetchedNivelExplosion, isLoadingNivelExplosion, fetchNivel2TapaComponentes]);

  useEffect(() => {
    if (autoChainStep === 2 && hasFetchedNivel2 && !isLoadingNivel2) {
      setAutoChainStep(3);
      fetchNivel3AcolchadoComponentes();
    }
  }, [autoChainStep, hasFetchedNivel2, isLoadingNivel2, fetchNivel3AcolchadoComponentes]);

  useEffect(() => {
    if (autoChainStep === 3 && hasFetchedNivel3 && !isLoadingNivel3) {
      setAutoChainStep(0);
    }
  }, [autoChainStep, hasFetchedNivel3, isLoadingNivel3]);

  const nivel3AcolchadoComponentes = useMemo(() => {
    if (!componentesCapacidadEnsKeywordsNorm.includes('ACOLCHADO')) return [];
    return nivel3ExplosionData.filter(comp =>
      Number(comp.NIVEL) === 1 &&
      normalizeText(String(comp.DESCRIPCION_COMPONENTE || comp.NOMBRE_COMPONENTE || '')).includes('ACOLCHADO')
    );
  }, [nivel3ExplosionData, componentesCapacidadEnsKeywordsNorm]);

  const nivel3AcolchadoResumen = useMemo(() => {
    const map = new Map<string, { material: string; nombre: string; cantidadTotal: number }>();
    nivel3AcolchadoComponentes.forEach(comp => {
      const material = String(comp.COMPONENTE || '').trim();
      const nombre = String(comp.DESCRIPCION_COMPONENTE || comp.NOMBRE_COMPONENTE || '').trim();
      const cantidadUnitaria = Number(comp.CANTIDAD_UNITARIA || comp.Cantidad || 0);
      const necesidad = cantidadUnitaria * Number(comp.parentCantidadTotal || 0);
      const existing = map.get(material);
      if (existing) existing.cantidadTotal += necesidad;
      else map.set(material, { material, nombre, cantidadTotal: necesidad });
    });
    return Array.from(map.values()).sort((a, b) => b.cantidadTotal - a.cantidadTotal);
  }, [nivel3AcolchadoComponentes]);

  // Mismo resumen del Nivel 3, dividido por ACOLCHADO de FORRO CHN (colchones) y ACOLCHADO de FORRO BASE (bases),
  // heredando la categoría del FORRO/TAPA padre. Se usa solo para la recomendación de priorización del chequeo de factibilidad.
  const nivel3AcolchadoResumenPorTipo = useMemo(() => {
    const baseMap = new Map<string, { material: string; nombre: string; cantidadTotal: number }>();
    const chnMap = new Map<string, { material: string; nombre: string; cantidadTotal: number }>();
    nivel3AcolchadoComponentes.forEach(comp => {
      const material = String(comp.COMPONENTE || '').trim();
      const nombre = String(comp.DESCRIPCION_COMPONENTE || comp.NOMBRE_COMPONENTE || '').trim();
      const cantidadUnitaria = Number(comp.CANTIDAD_UNITARIA || comp.Cantidad || 0);
      const necesidad = cantidadUnitaria * Number(comp.parentCantidadTotal || 0);
      const map = comp.parentTipo === 'base' ? baseMap : chnMap;
      const existing = map.get(material);
      if (existing) existing.cantidadTotal += necesidad;
      else map.set(material, { material, nombre, cantidadTotal: necesidad });
    });
    return {
      base: Array.from(baseMap.values()).sort((a, b) => b.cantidadTotal - a.cantidadTotal),
      chn: Array.from(chnMap.values()).sort((a, b) => b.cantidadTotal - a.cantidadTotal),
    };
  }, [nivel3AcolchadoComponentes]);

  // Nivel 4: toma como referencia el resumen del Nivel 3 (ACOLCHADO) — misma lógica, filtrando NIVEL===1 con nombre "LÁMINA".
  const fetchNivel4LaminaComponentes = useCallback(async () => {
    if (nivel3AcolchadoResumen.length === 0) {
      addNotification('warning', 'No hay componentes de Nivel 3 (ACOLCHADO) para explosionar.');
      return;
    }
    setIsLoadingNivel4(true);
    setHasFetchedNivel4(true);
    setNivel4Progress(0);
    const allComponents: any[] = [];
    try {
      for (let i = 0; i < nivel3AcolchadoResumen.length; i++) {
        const { material, cantidadTotal } = nivel3AcolchadoResumen[i];
        setNivel4Progress(Math.round((i / nivel3AcolchadoResumen.length) * 100));
        const response = await serviciosService.getMaestroMaterialesExplosion('1000', material, 1, 5000);
        const components = response.data || [];
        components.forEach((comp: any) => {
          allComponents.push({ ...comp, parentMaterial: material, parentCantidadTotal: cantidadTotal });
        });
      }
      setNivel4ExplosionData(allComponents);
      setNivel4Progress(100);
      addNotification('success', `Explosión de Nivel 4 completada para ${nivel3AcolchadoResumen.length} material${nivel3AcolchadoResumen.length === 1 ? '' : 'es'} ACOLCHADO.`);
    } catch (error: any) {
      addNotification('error', `Error en la explosión de Nivel 4: ${error.message}`);
    } finally {
      setIsLoadingNivel4(false);
    }
  }, [nivel3AcolchadoResumen, addNotification]);

  const nivel4LaminaComponentes = useMemo(() => {
    if (!componentesCapacidadEnsKeywordsNorm.includes('LAMINA')) return [];
    return nivel4ExplosionData.filter(comp =>
      Number(comp.NIVEL) === 1 &&
      normalizeText(String(comp.DESCRIPCION_COMPONENTE || comp.NOMBRE_COMPONENTE || '')).includes('LAMINA')
    );
  }, [nivel4ExplosionData, componentesCapacidadEnsKeywordsNorm]);

  const nivel4LaminaResumen = useMemo(() => {
    const map = new Map<string, { material: string; nombre: string; cantidadTotal: number }>();
    nivel4LaminaComponentes.forEach(comp => {
      const material = String(comp.COMPONENTE || '').trim();
      const nombre = String(comp.DESCRIPCION_COMPONENTE || comp.NOMBRE_COMPONENTE || '').trim();
      const cantidadUnitaria = Number(comp.CANTIDAD_UNITARIA || comp.Cantidad || 0);
      const necesidad = cantidadUnitaria * Number(comp.parentCantidadTotal || 0);
      const existing = map.get(material);
      if (existing) existing.cantidadTotal += necesidad;
      else map.set(material, { material, nombre, cantidadTotal: necesidad });
    });
    return Array.from(map.values()).sort((a, b) => b.cantidadTotal - a.cantidadTotal);
  }, [nivel4LaminaComponentes]);

  const [isSavingPlanNivel4, setIsSavingPlanNivel4] = useState(false);

  const handleGuardarPlanNivel4 = useCallback(async () => {
    if (nivel4LaminaResumen.length === 0) {
      addNotification('warning', 'No hay componentes de Nivel 4 (LÁMINA) para guardar.');
      return;
    }
    if (planGrupoDetalleFiltrada.length === 0) {
      addNotification('warning', 'Consulta primero el "Plan Táctico de Grupos" para heredar el código de plan.');
      return;
    }
    if (!planGrupoFecha) {
      addNotification('warning', 'Selecciona la fecha del plan antes de guardar.');
      return;
    }
    if (forrosGruposList.length === 0) {
      addNotification('warning', 'No se encontró el grupo asociado para guardar el plan.');
      return;
    }

    setIsSavingPlanNivel4(true);
    try {
      const planGrupoRef = await planGrupoService.getById(planGrupoDetalleFiltrada[0].codigo_plan_grupo);
      const codigoPlan = planGrupoRef.data?.codigo_plan;
      if (!codigoPlan) {
        throw new Error('No se pudo recuperar el código de plan de referencia.');
      }

      const planesGuardados: { codigo_plan_grupo: number; nombre_grupo: string }[] = [];
      const detallesGuardados: number[] = [];

      for (const grupo of forrosGruposList) {
        const nuevoPlanGrupo: PlanGrupo = {
          codigo_plan_grupo: 0,
          codigo_plan: codigoPlan,
          codigo_grupo: grupo.codigo_grupo,
          codigo_familia_grupo: 0,
          valor: `Plan Táctico - Centro ${grupo.centro} - P2`,
          fecha_inicio_plan: new Date(planGrupoFecha),
          fecha_fin_plan: new Date(planGrupoFecha),
          estado: 'A',
          fecha_creacion: new Date(),
          usuario_creacion: 'admin',
        };
        const planGrupoGuardado = await planGrupoService.save(nuevoPlanGrupo);
        const codigoPlanGrupoNuevo = planGrupoGuardado.data?.codigo_plan_grupo;
        if (!codigoPlanGrupoNuevo) {
          throw new Error(`No se recibió codigo_plan_grupo al guardar el grupo ${grupo.nombre_grupo}.`);
        }
        planesGuardados.push({ codigo_plan_grupo: codigoPlanGrupoNuevo, nombre_grupo: grupo.nombre_grupo });

        for (const row of nivel4LaminaResumen) {
          const nuevoDetalle: DetalleTactico = {
            codigo_detalle_tactico: 0,
            codigo_plan_grupo: codigoPlanGrupoNuevo,
            codigo_material: Number(row.material),
            cantidad_produccion_neta: String(Math.round(row.cantidadTotal)),
            resp_ctrl_prod: '',
            clase_aprovisionamiento: '',
            cantidad_aprovisionamiento: '0',
            estado: 'A',
            usuario_modificacion: '',
          } as DetalleTactico;
          const detalleGuardado = await detalleTacticoService.save(nuevoDetalle);
          if (detalleGuardado.data?.codigo_detalle_tactico) {
            detallesGuardados.push(detalleGuardado.data.codigo_detalle_tactico);
          }
        }
      }

      setPlanP2GuardadoInfo({ planes: planesGuardados, detalles: detallesGuardados });
      setPlanP2Guardado(true);
      addNotification('success', 'Se ha guardado el plan del Paso 2.');
    } catch (error: any) {
      addNotification('error', `Error al guardar el plan: ${error.message}`);
    } finally {
      setIsSavingPlanNivel4(false);
    }
  }, [nivel4LaminaResumen, planGrupoDetalleFiltrada, planGrupoFecha, forrosGruposList, addNotification]);

  const resetExplosionPlanP2 = useCallback(() => {
    setNivelExplosionData([]);
    setHasFetchedNivelExplosion(false);
    setNivelExplosionProgress(0);
    setNivel2ExplosionData([]);
    setHasFetchedNivel2(false);
    setNivel2Progress(0);
    setNivel3ExplosionData([]);
    setHasFetchedNivel3(false);
    setNivel3Progress(0);
    setNivel4ExplosionData([]);
    setHasFetchedNivel4(false);
    setNivel4Progress(0);
    setAutoChainStep(0);
    setAcolchadoCuadreDesactivado(false);
    setMaterialesAcolchadoSinVersion([]);
  }, []);

  const handleGenerarNuevoPlanP2 = useCallback(() => {
    setEditarPlanP2ConfirmOpen(false);
    setPlanP2Guardado(false);
    setPlanP2GuardadoInfo(null);
    resetExplosionPlanP2();
  }, [resetExplosionPlanP2]);

  const handleDesactivarPlanP2Guardado = useCallback(async () => {
    if (!planP2GuardadoInfo) {
      setEditarPlanP2ConfirmOpen(false);
      return;
    }
    setIsDesactivandoPlanP2(true);
    try {
      for (const plan of planP2GuardadoInfo.planes) {
        const ref = await planGrupoService.getById(plan.codigo_plan_grupo);
        if (ref.data) {
          await planGrupoService.save({ ...ref.data, estado: 'I' });
        }
      }
      for (const codigoDetalle of planP2GuardadoInfo.detalles) {
        const ref = await detalleTacticoService.getById(codigoDetalle);
        if (ref.data) {
          await detalleTacticoService.save({ ...ref.data, estado: 'I' });
        }
      }
      addNotification('success', 'Se desactivó el plan guardado del Paso 2.');
      setEditarPlanP2ConfirmOpen(false);
      setPlanP2Guardado(false);
      setPlanP2GuardadoInfo(null);
      resetExplosionPlanP2();
    } catch (error: any) {
      addNotification('error', `Error al desactivar el plan guardado: ${error.message}`);
    } finally {
      setIsDesactivandoPlanP2(false);
    }
  }, [planP2GuardadoInfo, addNotification, resetExplosionPlanP2]);

  const filteredOrdenesPrevisionales = useMemo(() => {
    let filtered = ordenesPrevisionalesData.filter(order => {
      const centroVal = String(order['Centro'] || '').trim();
      return centroVal === '1000';
    });

    if (allowedRespCodes.length > 0) {
      filtered = filtered.filter(order => {
        const respField = Object.keys(order).find(k => {
          const uk = k.toUpperCase();
          return uk === 'RESPCONTROLPROD' || uk === 'RESP_CTRL_PROD' || uk === 'RESPONSABLE' || uk === 'RESP';
        });
        if (!respField) return true;
        const orderResp = String(order[respField] || '').trim().replace(/^0+/, '');
        return allowedRespCodes.includes(orderResp);
      });
    }

    return filtered;
  }, [ordenesPrevisionalesData, allowedRespCodes]);

  const displayedOrdenesPrevisionales = useMemo(() => {
    if (!searchQueryPrevisionales.trim()) return filteredOrdenesPrevisionales;
    const q = searchQueryPrevisionales.toLowerCase();
    return filteredOrdenesPrevisionales.filter(order =>
      Object.values(order).some(val => String(val ?? '').toLowerCase().includes(q))
    );
  }, [filteredOrdenesPrevisionales, searchQueryPrevisionales]);

  const techFilteredOrdenes = useMemo(() => {
    return filteredOrdenesPrevisionales.filter(order => {
      const dateVal = String(order['FECHAINICIO'] || order['FECHA'] || '').split('T')[0];
      if (!dateVal || dateVal === '—') return false;
      return dateVal >= techStartDate && dateVal <= techEndDate;
    });
  }, [filteredOrdenesPrevisionales, techStartDate, techEndDate]);

  const fetchTiemposProduccion = useCallback(async () => {
    if (forrosGruposList.length === 0) return;
    setIsLoadingTiempos(true);
    try {
      const promises = forrosGruposList.map(g => 
        serviciosService.getTiemposEnsambladobyCentroyCodigoGrupo(g.centro, g.codigo_grupo)
      );
      const responses = await Promise.all(promises);
      let allData = responses.flatMap(res => res.data || []);
      setTiemposProduccion(allData);
    } catch (error) {
      console.error('Error al cargar tiempos:', error);
    } finally {
      setIsLoading(false);
    }
  }, [forrosGruposList]);

  useEffect(() => {
    if (isMounted && forrosGruposList.length > 0) {
      fetchTiemposProduccion();
    }
  }, [isMounted, forrosGruposList, fetchTiemposProduccion]);

  const getResolvedPuesto = useCallback((order: any) => {
    const orderFields = ['PuestoTrabajo', 'MAQUINA', 'Maquina'];
    for (const k of orderFields) {
      const val = order[k];
      if (val && String(val).trim() !== '' && String(val).toLowerCase() !== 'null') {
        return String(val).trim().toUpperCase();
      }
    }
    const material = normalizeMaterialCode(order['MATERIAL'] || order['CodMaterial'] || '');
    const match = tiemposProduccion.find(t => normalizeMaterialCode(t.CodMaterial || t.Material || '') === material);
    return match ? String(match.PuestoTrabajo || match.nombre_estacion || match.Maquina || '').trim().toUpperCase() : '';
  }, [tiemposProduccion, normalizeMaterialCode]);

  const uniquePuestos = useMemo(() => {
    const pSet = new Set<string>();
    kpiMaestroData.forEach(kpi => {
      const p = String(kpi.Categoria || '').trim().toUpperCase();
      if (p && p !== 'NULL' && p !== '-' && p !== '—') pSet.add(p);
    });
    return Array.from(pSet).sort();
  }, [kpiMaestroData]);

  useEffect(() => {
    if (dataReady && uniquePuestos.length > 0) {
      setWorkstationConfigs(prev => {
        if (Object.keys(prev).length > 0) return prev;
        const initial: Record<string, WorkstationConfig> = {};
        uniquePuestos.forEach(p => {
          initial[p] = { machine: p, isDayActive: true, isNightActive: false, people: 0, machines: 1 };
        });
        return initial;
      });
    }
  }, [dataReady, uniquePuestos]);

  useEffect(() => {
    if (restricciones.length > 0 && uniquePuestos.length > 0) {
      setWorkstationConfigs(prev => {
        const next = { ...prev };
        let updated = false;

        uniquePuestos.forEach(p => {
          const normP = p.toUpperCase().trim();
          const relevantRestrictions = restricciones.filter(r => 
            r.nombre_restriccion.toUpperCase().trim().includes('PERSONAL') &&
            r.nombre_restriccion.toUpperCase().trim().includes(normP)
          );

          if (relevantRestrictions.length > 0) {
            let isDay = false;
            let isNight = false;
            let peopleCount = 0;

            relevantRestrictions.forEach(r => {
              const valor = r.valor_restriccion.toUpperCase();
              if (valor.includes('DIURNO') || valor.includes('DÍA') || valor.includes('DIA')) isDay = true;
              if (valor.includes('NOCTURNO') || valor.includes('NOCHE')) isNight = true;
              
              const numMatch = valor.match(/\d+/);
              if (numMatch) {
                peopleCount = Math.max(peopleCount, parseInt(numMatch[0]));
              } else if (!isNaN(Number(valor)) && Number(valor) > 0) {
                peopleCount = Math.max(peopleCount, Number(valor));
              }
            });

            if (!isDay && !isNight && relevantRestrictions.length > 0) isDay = true;
            const current = next[p] || { machine: p, isDayActive: true, isNightActive: false, people: 0, machines: 1 };
            if (current.isDayActive !== isDay || current.isNightActive !== isNight || current.people !== peopleCount) {
              next[p] = { ...current, isDayActive: isDay, isNightActive: isNight, people: peopleCount };
              updated = true;
            }
          }
        });
        return updated ? next : prev;
      });
    }
  }, [restricciones, uniquePuestos]);

  const getKPITimeSecondsForOrder = useCallback((order: any) => {
    const materialCode = normalizeMaterialCode(order['MATERIAL'] || order['CodMaterial'] || '');
    const puestoName = getResolvedPuesto(order);
    const hojaRuta = mapToHojaRuta(puestoName);
    if (!materialCode || !hojaRuta) return null;
    
    if (hojaRuta.includes(' / ')) {
      const codes = hojaRuta.split(' / ').map(c => c.trim().toUpperCase());
      const orderHR = String(order['MAQUINA'] || order['Maquina'] || '').trim().toUpperCase();
      if (codes.includes(orderHR)) {
        const key = `${materialCode}|${orderHR}`;
        const match = kpiIndexRef.current[key];
        return match ? Number(match.TPromedio) : null;
      }
    }

    const key = `${materialCode}|${hojaRuta.toUpperCase().trim()}`;
    const match = kpiIndexRef.current[key];
    return match ? Number(match.TPromedio) : null;
  }, [normalizeMaterialCode, getResolvedPuesto, mapToHojaRuta]);

  const calculateProductionTime = useCallback((material: string, quantity: number, order: any) => {
    if (!material) return 0;
    const kpiSec = getKPITimeSecondsForOrder(order);
    if (kpiSec !== null) return (kpiSec * quantity);
    const normMaterial = normalizeMaterialCode(material);
    const timesList = tiemposIndexRef.current[normMaterial];
    if (timesList && Array.isArray(timesList)) {
      const puesto = getResolvedPuesto(order);
      const match = timesList.find(t => {
        const tPuesto = String(t.PuestoTrabajo || t.nombre_estacion || t.Maquina || '').trim().toUpperCase();
        return tPuesto === puesto;
      }) || timesList[0];
      return match ? (Number(match.Tiempo || match.Tiempo_Min || 0) * 60 * quantity) : 0;
    }
    return 0;
  }, [normalizeMaterialCode, getResolvedPuesto, getKPITimeSecondsForOrder]);

  const handleExplodeFerts = async () => {
    const allFerts = [...fert1000.map(o => ({...o, centroOriginal: '1000'})), ...fert2000.map(o => ({...o, centroOriginal: '2000'}))];
    if (allFerts.length === 0) {
      addNotification('warning', 'No hay órdenes FERT para explosionar.');
      return;
    }

    const uniqueMaterials = Array.from(new Set(allFerts.map(o => {
      const rawCode = String(o['CodMaterial'] || o['MATERIAL'] || o['Material'] || '').trim();
      return rawCode.slice(-8); 
    }))).filter(m => m !== '');

    setIsLoadingExplosion(true);
    setExplosionProgress(0);
    const allComponents: any[] = [];
    const allForros: typeof explodedForrosData = [];

    try {
      for (let i = 0; i < uniqueMaterials.length; i++) {
        const fertCode = uniqueMaterials[i];
        setExplosionProgress(Math.round((i / uniqueMaterials.length) * 100));

        const ordersForMaterial = allFerts.filter(o => {
          const raw = String(o['CodMaterial'] || o['MATERIAL'] || o['Material'] || '').trim();
          return raw.slice(-8) === fertCode;
        });

        const response = await serviciosService.getMaestroMaterialesExplosion('1000', fertCode, 1, 5000);
        const components = response.data || [];

        // ── CHN insumos (lógica existente) ──
        const filteredComponents = components.filter((comp: any) => {
          const compName = String(comp.NOMBRE_COMPONENTE || comp.Descripcion || '').toUpperCase();
          if (allowedComponentsCHN.length === 0) return true;
          return allowedComponentsCHN.some(keyword => {
            const k = keyword.toUpperCase().trim();
            return compName.includes(k);
          });
        });

        filteredComponents.forEach((comp: any) => {
          ordersForMaterial.forEach(order => {
            const resp = String(order['RESPCTRLPROD'] || order['RESP_CTRL_PROD'] || 'S/R').trim().replace(/^0+/, '');
            const orderQty = Number(order['CANTIDAD'] || order['CANTPROGRAMADA'] || 0);
            const centro = order.centroOriginal;
            allComponents.push({
              ...comp,
              fertParent: fertCode,
              orderQuantity: orderQty,
              responsable: resp,
              centro: centro,
              totalNeeded: (Number(comp.CANTIDAD_UNITARIA || comp.Cantidad || 0)) * orderQty
            });
          });
        });

        // ── FORROS: nivel 1 cuya descripción contenga "FORRO" ──
        const forroComps = components.filter((comp: any) =>
          Number(comp.NIVEL) === 1 &&
          String(comp.DESCRIPCION_COMPONENTE || '').toUpperCase().includes('FORRO')
        );

        forroComps.forEach((comp: any) => {
          const compMat = String(comp.COMPONENTE || '').trim();
          const compNombre = String(comp.DESCRIPCION_COMPONENTE || '').trim();
          const cantUnitaria = Number(comp.CANTIDAD_UNITARIA || 0);
          ordersForMaterial.forEach(order => {
            const orderQty = Number(order['CANTIDAD'] || order['CANTPROGRAMADA'] || 0);
            const centro = order.centroOriginal;
            allForros.push({
              material: compMat,
              nombre: compNombre,
              centro,
              cantidadUnitaria: cantUnitaria,
              cantidadTotal: cantUnitaria * orderQty,
              fertParent: fertCode,
            });
          });
        });
      }

      setExplodedComponentsData(allComponents);
      setExplodedForrosData(allForros);
      setExplosionProgress(100);

      const forrosUnicos = new Set(allForros.map(f => f.material)).size;
      addNotification('success', `Explosión completada. ${allComponents.length} insumos CHN · ${forrosUnicos} referencia${forrosUnicos !== 1 ? 's' : ''} de FORRO identificada${forrosUnicos !== 1 ? 's' : ''}.`);
    } catch (error: any) {
      addNotification('error', `Error en explosión: ${error.message}`);
    } finally {
      setIsLoadingExplosion(false);
    }
  };

  const achBandAdjustedKeys = useMemo(() => {
    const keys = new Set<string>();
    achBandAdjustedOrders.forEach(o => {
      if (o._isSplit && o._originalKey) {
        keys.add(o._originalKey);
      } else {
        keys.add(`${o['ORDEN'] || ''}|${String(o['MATERIAL'] || o['CodMaterial'] || '')}|${String(o['CANTIDAD'] || o['CANTPROGRAMADA'] || '')}`);
      }
    });
    return keys;
  }, [achBandAdjustedOrders]);

  const achBandSplitRemainders = useMemo(() => {
    return achBandAdjustedOrders
      .filter(o => o._isSplit)
      .map(o => {
        const movedQty = Number(o['CANTIDAD'] || o['CANTPROGRAMADA'] || 0);
        const remainderQty = Math.max(0, Number(o._originalCantidad || 0) - movedQty);
        return { ...o, CANTIDAD: remainderQty, CANTPROGRAMADA: remainderQty };
      });
  }, [achBandAdjustedOrders]);

  const handleConsolidateAcolchado = () => {
    setIsAchConsolidated(prev => !prev);
    addNotification('info', isAchConsolidated ? 'Vista detallada de acolchado activada.' : 'Vista consolidada de acolchado activada.');
  };

  const { consolidatedInsumos, resumenPorResponsableExplosion, resumenPorCentroResp } = useMemo(() => {
    const materialMap = new Map<string, { code: string, name: string, total: number, unit: string }>();
    const respMap = new Map<string, { resp: string, totalForros: number, totalInsumos: number, centro?: string }>();
    const centroRespMap = new Map<string, { centro: string, resp: string, totalForros: number, totalInsumos: number }>();

    explodedComponentsData.forEach(item => {
      const code = String(item.COMPONENTE || item.Componente || item.Material || '').trim();
      const name = String(item.NOMBRE_COMPONENTE || item.Descripcion || '').trim();
      const total = Number(item.totalNeeded || 0);
      const unit = String(item.UNIDAD || item.Unidad || 'ST').trim();

      if (!materialMap.has(code)) {
        materialMap.set(code, { code, name, total: 0, unit });
      }
      materialMap.get(code)!.total += total;

      const resp = item.responsable;
      if (!respMap.has(resp)) {
        respMap.set(resp, { resp, totalForros: 0, totalInsumos: 0, centro: item.centro });
      }
      respMap.get(resp)!.totalInsumos += total;

      const crKey = `${item.centro}|${resp}`;
      if (!centroRespMap.has(crKey)) {
        centroRespMap.set(crKey, { centro: item.centro, resp, totalForros: 0, totalInsumos: 0 });
      }
      centroRespMap.get(crKey)!.totalInsumos += total;
    });

    const uniqueForrosPerResp = new Map<string, number>();
    const processedForros = new Set<string>();
    const uniqueForrosPerCentroResp = new Map<string, number>();
    const processedForrosCR = new Set<string>();

    explodedComponentsData.forEach(item => {
      const key = `${item.responsable}|${item.fertParent}`;
      if (!processedForros.has(key)) {
        processedForros.add(key);
        uniqueForrosPerResp.set(item.responsable, (uniqueForrosPerResp.get(item.responsable) || 0) + Number(item.orderQuantity));
      }

      const crFertKey = `${item.centro}|${item.responsable}|${item.fertParent}`;
      if (!processedForrosCR.has(crFertKey)) {
        processedForrosCR.add(crFertKey);
        const crKey = `${item.centro}|${item.responsable}`;
        uniqueForrosPerCentroResp.set(crKey, (uniqueForrosPerCentroResp.get(crKey) || 0) + Number(item.orderQuantity));
      }
    });

    uniqueForrosPerResp.forEach((total, resp) => {
      if (respMap.has(resp)) {
        respMap.get(resp)!.totalForros = total;
      }
    });

    uniqueForrosPerCentroResp.forEach((total, crKey) => {
      if (centroRespMap.has(crKey)) {
        centroRespMap.get(crKey)!.totalForros = total;
      }
    });

    return {
      consolidatedInsumos: Array.from(materialMap.values()).sort((a, b) => a.code.localeCompare(b.code)),
      resumenPorResponsableExplosion: Array.from(respMap.values()).sort((a, b) => a.resp.localeCompare(b.resp)),
      resumenPorCentroResp: Array.from(centroRespMap.values()).sort((a, b) => a.centro.localeCompare(b.centro) || a.resp.localeCompare(b.resp))
    };
  }, [explodedComponentsData]);

  // Resumen de necesidades de FORRO por referencia y centro
  const resumenForros = useMemo(() => {
    if (explodedForrosData.length === 0) return [];
    const map = new Map<string, { material: string; nombre: string; total1000: number; total2000: number }>();
    explodedForrosData.forEach(f => {
      const entry = map.get(f.material) || { material: f.material, nombre: f.nombre, total1000: 0, total2000: 0 };
      if (f.centro === '1000') entry.total1000 += f.cantidadTotal;
      else if (f.centro === '2000') entry.total2000 += f.cantidadTotal;
      map.set(f.material, entry);
    });
    return Array.from(map.values()).sort((a, b) => a.material.localeCompare(b.material));
  }, [explodedForrosData]);

  const toggleWorkstationShift = (p: string, shift: 'day' | 'night') => {
    setWorkstationConfigs(prev => {
      const current = prev[p] || { machine: p, isDayActive: true, isNightActive: false, people: 0, machines: 1 };
      return {
        ...prev,
        [p]: {
          ...current,
          [shift === 'day' ? 'isDayActive' : 'isNightActive']: !current[shift === 'day' ? 'isDayActive' : 'isNightActive']
        }
      };
    });
  };

  const mapToHojaRutaInternal = useCallback((puestoName: string): string => mapToHojaRuta(puestoName), [mapToHojaRuta]);
  const horasNetasDiurnasVal = parseFloat(jornadaDiurnaSel || "0") * 0.84;
  const horasNetasNocturnasVal = parseFloat(jornadaNocturnaSel || "0") * 0.84;

  // ── Factibilidad ACOLCHADO (cuello de botella): horas requeridas vs. capacidad disponible por puesto ──
  type CandidatoAcolchado = { puesto: string; tiempoSegPorUnidad: number; capacidad: number; cfg: WorkstationConfig };
  type MaterialAcolchado = { material: string; nombre: string; cantidadTotal: number; qtyChn: number; qtyBase: number; candidatos: CandidatoAcolchado[] };

  // Por material: candidatos reales (puestos con tiempo estándar/KPI registrado) + su capacidad actual.
  // Se conserva el detalle por material (no solo el agregado por puesto) para poder "cuadrar" la producción.
  const acolchadoMateriales = useMemo<MaterialAcolchado[]>(() => {
    if (nivel3AcolchadoResumen.length === 0) return [];

    const getCapacidad = (puesto: string) => {
      const cfg = workstationConfigs[puesto] || { machine: puesto, isDayActive: true, isNightActive: false, people: 0, machines: 1 };
      const capacidad = ((cfg.isDayActive ? horasNetasDiurnasVal : 0) + (cfg.isNightActive ? horasNetasNocturnasVal : 0)) * (cfg.machines || 1);
      return { cfg, capacidad };
    };

    const chnQtyByMaterial = new Map(nivel3AcolchadoResumenPorTipo.chn.map(r => [r.material, r.cantidadTotal]));
    const baseQtyByMaterial = new Map(nivel3AcolchadoResumenPorTipo.base.map(r => [r.material, r.cantidadTotal]));

    const out: MaterialAcolchado[] = [];
    nivel3AcolchadoResumen.forEach(row => {
      const normMat = normalizeMaterialCode(row.material);
      const timesList: any[] = tiemposIndexRef.current[normMat] || [];

      // Un material puede tener tiempo estándar en más de un puesto (ej: ACOLCHADORA02/08/09).
      const candidatos = timesList
        .map(t => ({
          puesto: String(t.PuestoTrabajo || t.nombre_estacion || t.Maquina || '').trim().toUpperCase(),
          tiempoSegPorUnidad: Number(t.Tiempo || t.Tiempo_Min || 0) * 60,
        }))
        .filter(c => c.puesto && c.tiempoSegPorUnidad > 0);

      if (candidatos.length === 0) return;

      out.push({
        material: row.material,
        nombre: row.nombre,
        cantidadTotal: row.cantidadTotal,
        qtyChn: chnQtyByMaterial.get(row.material) || 0,
        qtyBase: baseQtyByMaterial.get(row.material) || 0,
        candidatos: candidatos.map(c => ({ ...c, ...getCapacidad(c.puesto) })),
      });
    });
    return out;
  }, [nivel3AcolchadoResumen, nivel3AcolchadoResumenPorTipo, workstationConfigs, horasNetasDiurnasVal, horasNetasNocturnasVal, normalizeMaterialCode]);

  const sinTiempoEstandarAcolchado = useMemo(() => {
    if (nivel3AcolchadoResumen.length === 0) return [];
    const conTiempo = new Set(acolchadoMateriales.map(m => m.material));
    return nivel3AcolchadoResumen.filter(r => !conTiempo.has(r.material)).map(r => ({ material: r.material, nombre: r.nombre }));
  }, [nivel3AcolchadoResumen, acolchadoMateriales]);

  // Versión de Fabricación por material de ACOLCHADO (Centro fijo '1000'): material -> (hoja de ruta sin prefijo "HR-" -> N° de versión).
  // Se consulta versionsFabricacionPorCentroYCodigoMaterial por cada material único de acolchadoMateriales (lista acotada al plan actual).
  const [versionPorMaterialAcolchado, setVersionPorMaterialAcolchado] = useState<Map<string, Map<string, number>>>(new Map());
  const [materialesAcolchadoSinVersion, setMaterialesAcolchadoSinVersion] = useState<string[]>([]);

  useEffect(() => {
    if (acolchadoMateriales.length === 0) {
      setVersionPorMaterialAcolchado(new Map());
      setMaterialesAcolchadoSinVersion([]);
      return;
    }
    let cancelled = false;
    (async () => {
      try {
        const materiales = acolchadoMateriales.map(m => m.material);
        const respuestas = await Promise.allSettled(
          materiales.map(material => serviciosService.versionsFabricacionPorCentroYCodigoMaterial('1000', material))
        );
        const resultado = new Map<string, Map<string, number>>();
        const sinVersion: string[] = [];
        respuestas.forEach((r, idx) => {
          const material = materiales[idx];
          const porHoja = new Map<string, number>();
          if (r.status === 'fulfilled') {
            (r.value.data || []).forEach((v: any) => {
              const hoja = String(v.GRUPOHOJARUTA || '').trim().toUpperCase().replace(/^HR-/, '');
              const version = parseInt(String(v.VERSION || '').trim(), 10);
              if (hoja && !isNaN(version)) porHoja.set(hoja, version);
            });
          }
          if (porHoja.size === 0) sinVersion.push(material);
          resultado.set(material, porHoja);
        });
        if (!cancelled) {
          setVersionPorMaterialAcolchado(resultado);
          setMaterialesAcolchadoSinVersion(sinVersion);
          if (sinVersion.length > 0) {
            addNotification('warning', `${sinVersion.length} material${sinVersion.length === 1 ? '' : 'es'} de ACOLCHADO sin Versión de Fabricación registrada en SAP (Centro 1000): ${sinVersion.join(', ')}. Se usará el tiempo más rápido como respaldo para esa(s) referencia(s).`);
          }
        }
      } catch (error: any) {
        if (!cancelled) addNotification('error', `Error al consultar Versión de Fabricación de ACOLCHADO: ${error.message}`);
      }
    })();
    return () => { cancelled = true; };
  }, [acolchadoMateriales, addNotification]);

  // Reparto por defecto: se asigna el 100% del material al candidato con MENOR número de Versión de
  // Fabricación (versión 1 = máquina preferida en SAP). Si el material no tiene versión registrada en
  // ninguna máquina candidata (falla de datos maestros), se usa el tiempo más rápido como respaldo
  // — ya se alertó del caso en el efecto que consulta las versiones.
  const repartoAutomatico = useCallback((m: MaterialAcolchado) => {
    const reparto = new Map<string, number>();
    const versionesMaterial = versionPorMaterialAcolchado.get(m.material);
    const getVersion = (puesto: string): number | undefined => {
      const hoja = mapToHojaRutaInternal(puesto).trim().toUpperCase().replace(/^HR-/, '');
      return versionesMaterial?.get(hoja);
    };
    const conVersion = m.candidatos.filter(c => getVersion(c.puesto) !== undefined);
    const elegido = conVersion.length > 0
      ? conVersion.reduce((min, c) => (getVersion(c.puesto)! < getVersion(min.puesto)! ? c : min), conVersion[0])
      : m.candidatos.reduce((min, c) => (c.tiempoSegPorUnidad < min.tiempoSegPorUnidad ? c : min), m.candidatos[0]);
    m.candidatos.forEach(c => reparto.set(c.puesto, c.puesto === elegido.puesto ? m.cantidadTotal : 0));
    return reparto;
  }, [versionPorMaterialAcolchado, mapToHojaRutaInternal]);

  const buildCargaPorPuesto = useCallback((materiales: MaterialAcolchado[], overrides: Record<string, Record<string, number>> | null) => {
    const cargaPorPuesto = new Map<string, { puesto: string; horasRequeridas: number; horasRequeridasChn: number; horasRequeridasBase: number; capacidad: number; cfg: WorkstationConfig }>();

    materiales.forEach(m => {
      const auto = repartoAutomatico(m);
      const override = overrides?.[m.material];
      const totalQty = m.qtyChn + m.qtyBase || m.cantidadTotal || 1;

      m.candidatos.forEach(c => {
        const qtyAsignada = override ? (override[c.puesto] || 0) : (auto.get(c.puesto) || 0);
        const horas = (c.tiempoSegPorUnidad * qtyAsignada) / 3600;
        const horasChn = horas * (m.qtyChn / totalQty);
        const horasBase = horas * (m.qtyBase / totalQty);

        const existing = cargaPorPuesto.get(c.puesto);
        if (existing) {
          existing.horasRequeridas += horas;
          existing.horasRequeridasChn += horasChn;
          existing.horasRequeridasBase += horasBase;
        } else {
          cargaPorPuesto.set(c.puesto, {
            puesto: c.puesto,
            horasRequeridas: horas,
            horasRequeridasChn: horasChn,
            horasRequeridasBase: horasBase,
            capacidad: c.capacidad,
            cfg: c.cfg,
          });
        }
      });
    });

    const puestos = Array.from(cargaPorPuesto.values())
      .map(p => ({
        ...p,
        utilizacion: p.capacidad > 0 ? (p.horasRequeridas / p.capacidad) * 100 : (p.horasRequeridas > 0 ? Infinity : 0),
        deficitHoras: Math.max(0, p.horasRequeridas - p.capacidad),
      }))
      .sort((a, b) => b.utilizacion - a.utilizacion);

    const puestosDeficit = puestos.filter(p => p.utilizacion > 100);
    const esFactible = puestos.length > 0 && puestosDeficit.length === 0;

    return { puestos, puestosDeficit, esFactible };
  }, [repartoAutomatico]);

  const acolchadoFactibilidadAuto = useMemo(() => {
    if (acolchadoMateriales.length === 0) return null;
    return { ...buildCargaPorPuesto(acolchadoMateriales, null), sinTiempoEstandar: sinTiempoEstandarAcolchado };
  }, [acolchadoMateriales, sinTiempoEstandarAcolchado, buildCargaPorPuesto]);

  // Cuadre automático: por material, cuántas unidades quedan asignadas a cada puesto candidato.
  // Se recalcula solo (useMemo) cada vez que cambian los materiales, las versiones de fabricación o
  // los turnos/máquinas configurados en Personal & Turnos — nunca queda una "foto" desactualizada.
  const [acolchadoCuadreDesactivado, setAcolchadoCuadreDesactivado] = useState(false);

  const acolchadoCuadreResultado = useMemo(() => {
    if (acolchadoMateriales.length === 0) return null;

    // assign: material -> puesto -> cantidad. Arranca desde el reparto automático (100% a la máquina
    // preferida por Versión de Fabricación) y se va moviendo el excedente hacia máquinas con holgura.
    const assign = new Map<string, Map<string, number>>();
    const tiempoPorMaterialPuesto = new Map<string, Map<string, number>>();
    const capacidadPorPuesto = new Map<string, number>();
    const horasPorPuesto = new Map<string, number>();

    acolchadoMateriales.forEach(m => {
      const auto = repartoAutomatico(m);
      const matTiempos = new Map<string, number>();
      m.candidatos.forEach(c => {
        matTiempos.set(c.puesto, c.tiempoSegPorUnidad);
        capacidadPorPuesto.set(c.puesto, c.capacidad);
        const qty = auto.get(c.puesto) || 0;
        const horas = (c.tiempoSegPorUnidad * qty) / 3600;
        horasPorPuesto.set(c.puesto, (horasPorPuesto.get(c.puesto) || 0) + horas);
      });
      assign.set(m.material, auto);
      tiempoPorMaterialPuesto.set(m.material, matTiempos);
    });

    const getUtil = (puesto: string) => {
      const cap = capacidadPorPuesto.get(puesto) || 0;
      const horas = horasPorPuesto.get(puesto) || 0;
      return cap > 0 ? horas / cap : (horas > 0 ? Infinity : 0);
    };

    let movimientosTotales = 0;
    let salvaguarda = 0;

    // Recorre TODAS las máquinas en cada pasada, de mayor a menor utilización, y solo termina
    // cuando una pasada completa no logra ningún movimiento. Ya NO se limita a corregir déficit
    // (utilización > 100%): si dos máquinas comparten un material y una está más cargada que la
    // otra (ej. 100% vs 75%), se mueve cantidad de la más cargada a la menos cargada hasta
    // EQUILIBRAR su utilización entre sí (no solo hasta que la de origen deje de estar en déficit).
    // Esto evita dejar una máquina con holgura sin usar mientras otra candidata para el mismo
    // material está más apretada, aunque ninguna de las dos esté técnicamente sobrecargada.
    while (salvaguarda < 5000) {
      salvaguarda++;

      const puestosOrdenados = [...capacidadPorPuesto.keys()]
        .map(p => ({ puesto: p, util: getUtil(p) }))
        .sort((a, b) => b.util - a.util);

      if (puestosOrdenados.length < 2) break;

      let movioEnEstaPasada = false;

      for (const { puesto: origen } of puestosOrdenados) {
        const materialesEnOrigen = acolchadoMateriales
          .filter(m => (assign.get(m.material)?.get(origen) || 0) > 0.01)
          .map(m => {
            const qty = assign.get(m.material)!.get(origen) || 0;
            const tiempo = tiempoPorMaterialPuesto.get(m.material)!.get(origen) || 0;
            return { material: m, horas: (qty * tiempo) / 3600 };
          })
          .sort((a, b) => b.horas - a.horas);

        for (const { material } of materialesEnOrigen) {
          const capOrigen = capacidadPorPuesto.get(origen) || 0;
          const horasOrigen = horasPorPuesto.get(origen) || 0;
          const utilOrigen = capOrigen > 0 ? horasOrigen / capOrigen : (horasOrigen > 0 ? Infinity : 0);

          const tiempoOrigen = tiempoPorMaterialPuesto.get(material.material)!.get(origen) || 0;
          if (tiempoOrigen <= 0) continue;

          // Candidatas destino: solo las que comparten este material con MENOR utilización que el
          // origen (mover hacia una máquina igual o más cargada no aporta nada al equilibrio).
          const candidatosDestino = material.candidatos
            .filter(c => c.puesto !== origen)
            .map(c => {
              const tiempo = tiempoPorMaterialPuesto.get(material.material)!.get(c.puesto) || 0;
              const capacidad = capacidadPorPuesto.get(c.puesto) || 0;
              const horas = horasPorPuesto.get(c.puesto) || 0;
              const util = capacidad > 0 ? horas / capacidad : (horas > 0 ? Infinity : 0);
              return { puesto: c.puesto, tiempo, capacidad, horas, util };
            })
            .filter(c => c.tiempo > 0 && c.capacidad > 0 && c.util < utilOrigen - 0.0005);

          // Prioridad de destino por Versión de Fabricación (versión 1 = preferida en SAP); entre
          // candidatas con la misma versión (o sin versión registrada), desempata por menor utilización.
          const versionesDestMaterial = versionPorMaterialAcolchado.get(material.material);
          const getVersionDestino = (puesto: string): number | undefined => {
            const hoja = mapToHojaRutaInternal(puesto).trim().toUpperCase().replace(/^HR-/, '');
            return versionesDestMaterial?.get(hoja);
          };
          candidatosDestino.sort((a, b) => {
            const va = getVersionDestino(a.puesto);
            const vb = getVersionDestino(b.puesto);
            if (va !== undefined && vb === undefined) return -1;
            if (va === undefined && vb !== undefined) return 1;
            if (va !== undefined && vb !== undefined && va !== vb) return va - vb;
            return a.util - b.util;
          });

          if (candidatosDestino.length === 0) continue;
          const destino = candidatosDestino[0];

          // Cantidad que EQUILIBRA la utilización entre origen y destino (deja a ambas con el mismo
          // % de capacidad usada), acotada por la holgura real del destino y la cantidad disponible
          // en el origen — nunca se "pasa" del punto de equilibrio ni excede lo que hay para mover.
          const to = tiempoOrigen / 3600;
          const td = destino.tiempo / 3600;
          const denom = td * capOrigen + to * destino.capacidad;
          const unidadesParaEqualizar = denom > 0.000001
            ? (horasOrigen * destino.capacidad - destino.horas * capOrigen) / denom
            : Infinity;
          const holguraDestinoHoras = Math.max(0, destino.capacidad - destino.horas);
          const unidadesPorHolguraDestino = (holguraDestinoHoras * 3600) / destino.tiempo;
          const unidadesDisponiblesOrigen = assign.get(material.material)!.get(origen) || 0;
          const unidadesAMover = Math.min(unidadesParaEqualizar, unidadesPorHolguraDestino, unidadesDisponiblesOrigen);
          if (!(unidadesAMover > 0.001)) continue;

          const matAssign = assign.get(material.material)!;
          matAssign.set(origen, (matAssign.get(origen) || 0) - unidadesAMover);
          matAssign.set(destino.puesto, (matAssign.get(destino.puesto) || 0) + unidadesAMover);

          const horasLiberadasOrigen = (unidadesAMover * tiempoOrigen) / 3600;
          const horasConsumidasDestino = (unidadesAMover * destino.tiempo) / 3600;
          horasPorPuesto.set(origen, (horasPorPuesto.get(origen) || 0) - horasLiberadasOrigen);
          horasPorPuesto.set(destino.puesto, (horasPorPuesto.get(destino.puesto) || 0) + horasConsumidasDestino);

          movimientosTotales++;
          movioEnEstaPasada = true;
        }
      }

      if (!movioEnEstaPasada) break;
    }

    const split: Record<string, Record<string, number>> = {};
    assign.forEach((matAssign, material) => {
      split[material] = Object.fromEntries(matAssign.entries());
    });

    return { split, movimientos: movimientosTotales };
  }, [acolchadoMateriales, repartoAutomatico, versionPorMaterialAcolchado, mapToHojaRutaInternal]);

  const acolchadoManualSplit = acolchadoCuadreDesactivado ? null : (acolchadoCuadreResultado?.split ?? null);

  const handleDeshacerCuadreAcolchado = useCallback(() => {
    setAcolchadoCuadreDesactivado(true);
    addNotification('info', 'Cuadre desactivado — se muestra el reparto automático sin balancear (100% por Versión de Fabricación).');
  }, [addNotification]);

  const handleAplicarCuadreAcolchado = useCallback(() => {
    setAcolchadoCuadreDesactivado(false);
    addNotification('success', 'Cuadre automático reactivado.');
  }, [addNotification]);

  // Acceso directo desde "Planes Grupo Ensamblado" hacia Personal y Turnos → Acolchado y Tapas,
  // para ajustar turnos/máquinas/personas sin perder el contexto de la factibilidad calculada.
  const handleIrAPersonalTurnosAcolchado = useCallback(() => {
    setActiveMainTab('personal-turnos');
    if (!loadedTabs.has('personal-turnos')) {
      setLoadedTabs(prev => new Set([...prev, 'personal-turnos']));
    }
    requestAnimationFrame(() => window.scrollTo({ top: 0, behavior: 'smooth' }));
  }, [loadedTabs]);

  const acolchadoFactibilidadAjustada = useMemo(() => {
    if (!acolchadoManualSplit || acolchadoMateriales.length === 0) return null;
    return { ...buildCargaPorPuesto(acolchadoMateriales, acolchadoManualSplit), sinTiempoEstandar: sinTiempoEstandarAcolchado };
  }, [acolchadoManualSplit, acolchadoMateriales, sinTiempoEstandarAcolchado, buildCargaPorPuesto]);

  // Referencias (materiales) asignadas a cada puesto con el reparto vigente (automático o cuadrado).
  // Como el reparto automático ahora asigna el 100% de cada material a un único puesto "natural"
  // (el de menor Versión de Fabricación en SAP), cualquier otra aparición del material es un movimiento.
  const acolchadoAsignacionPorPuesto = useMemo(() => {
    const map = new Map<string, { material: string; nombre: string; cantidad: number; horas: number; movidoDesde: string | null }[]>();
    acolchadoMateriales.forEach(m => {
      const auto = repartoAutomatico(m);
      const puestoNatural = m.candidatos.find(c => (auto.get(c.puesto) || 0) > 0.01)?.puesto || null;
      const override = acolchadoManualSplit?.[m.material];
      m.candidatos.forEach(c => {
        const cantidad = override ? (override[c.puesto] || 0) : (auto.get(c.puesto) || 0);
        if (cantidad <= 0.01) return;
        const horas = (c.tiempoSegPorUnidad * cantidad) / 3600;
        const movidoDesde = override && c.puesto !== puestoNatural ? puestoNatural : null;
        if (!map.has(c.puesto)) map.set(c.puesto, []);
        map.get(c.puesto)!.push({ material: m.material, nombre: m.nombre, cantidad, horas, movidoDesde });
      });
    });
    map.forEach(list => list.sort((a, b) => b.horas - a.horas));
    return map;
  }, [acolchadoMateriales, acolchadoManualSplit, repartoAutomatico]);

  const acolchadoTotalMovidos = useMemo(() => {
    let total = 0;
    acolchadoAsignacionPorPuesto.forEach(list => { total += list.filter(r => r.movidoDesde).length; });
    return total;
  }, [acolchadoAsignacionPorPuesto]);

  const acolchadoFactibilidad = acolchadoFactibilidadAjustada || acolchadoFactibilidadAuto;

  // Requerimiento de cada TAPA (Nivel 2) por su código, para conocer cuánto necesita en total.
  const nivel2TapaPorMaterial = useMemo(() => {
    const map = new Map<string, { nombre: string; cantidadTotal: number }>();
    nivel2TapaResumen.forEach(r => map.set(r.material, { nombre: r.nombre, cantidadTotal: r.cantidadTotal }));
    return map;
  }, [nivel2TapaResumen]);

  // Por cada material de ACOLCHADO, qué TAPAS lo requieren y cuánto necesitan por unidad (de la hoja de ruta Nivel2→Nivel3).
  const acolchadoTapasPorMaterial = useMemo(() => {
    const map = new Map<string, Map<string, number>>();
    nivel3AcolchadoComponentes.forEach(comp => {
      const materialAcolchado = String(comp.COMPONENTE || '').trim();
      const tapaMaterial = String(comp.parentMaterial || '').trim();
      const cantidadUnitaria = Number(comp.CANTIDAD_UNITARIA || comp.Cantidad || 0);
      if (!materialAcolchado || !tapaMaterial || cantidadUnitaria <= 0) return;
      if (!map.has(materialAcolchado)) map.set(materialAcolchado, new Map());
      const inner = map.get(materialAcolchado)!;
      inner.set(tapaMaterial, Math.max(inner.get(tapaMaterial) || 0, cantidadUnitaria));
    });
    return map;
  }, [nivel3AcolchadoComponentes]);

  // Cuántas TAPAS por referencia se pueden completar con el ACOLCHADO asignado (post-cuadre), tanto en
  // total como desglosado por máquina (acolchadora). Es una conversión puramente de CANTIDAD por BOM —
  // el tiempo/capacidad es un cálculo exclusivo del ACOLCHADO (su propia tabla de factibilidad) y no se
  // vuelve a aplicar aquí. Por cada material de acolchado: 1) se junta TODO lo asignado en TODAS sus
  // máquinas en un solo total (el cuadre reparte por capacidad/horas, algo ajeno a qué TAPA lo necesita,
  // así que no debe limitar por separado a cada máquina) y se reparte entre las TAPAS que lo usan con
  // relleno tipo "mejor ajuste" (mezclando referencias si hace falta, sin exceder lo que cada una
  // realmente necesita); el detalle por máquina se arma después, solo para el reporte, 2) cada TAPA
  // queda limitada por el componente de acolchado que menos le alcance (mínimo entre todos sus componentes).
  const acolchadoTapasResultado = useMemo(() => {
    const vacio = { porTapa: [] as { material: string; nombre: string; cantidadRequerida: number; cantidadProducible: number; cobertura: number; componenteLimitante: string }[], porPuesto: new Map<string, { tapaMaterial: string; tapaNombre: string; materialAcolchado: string; materialNombre: string; unidades: number; cantidadConsumida: number }[]>(), desperdicioPorPuesto: new Map<string, number>() };
    if (acolchadoMateriales.length === 0 || !acolchadoFactibilidad) return vacio;

    // Las TAPAS se distribuyen únicamente en función de la cantidad de ACOLCHADO asignada a cada
    // puesto (conversión por BOM) — el cálculo de horas/capacidad es exclusivo del ACOLCHADO y ya se
    // refleja en su propia tabla de factibilidad; no se vuelve a aplicar aquí como un segundo déficit.
    const ordenPuestos = acolchadoFactibilidad.puestos.map(p => p.puesto);

    const tapasPorMaterialLimitante = new Map<string, { producible: number; material: string }>();
    const porPuesto = new Map<string, { tapaMaterial: string; tapaNombre: string; materialAcolchado: string; materialNombre: string; unidades: number; cantidadConsumida: number }[]>();
    const desperdicioPorPuesto = new Map<string, number>();

    acolchadoMateriales.forEach(m => {
      const tapasDeEsteMaterial = acolchadoTapasPorMaterial.get(m.material);
      if (!tapasDeEsteMaterial || tapasDeEsteMaterial.size === 0) return;

      const asignaciones = acolchadoAsignacionPorPuesto;
      const puestosDelMaterial = ordenPuestos.filter(p => (asignaciones.get(p) || []).some(r => r.material === m.material));
      if (puestosDelMaterial.length === 0) return;

      // El material puede estar repartido en 2+ máquinas por el CUADRE de capacidad/horas — una razón
      // que no tiene nada que ver con qué TAPA lo necesita. Si se convirtiera a TAPAS máquina por
      // máquina por separado, una tapa podría quedar corta solo porque "le tocó" la máquina con menos
      // cantidad, aunque el total repartido entre todas las máquinas sí le alcance exacto. Por eso se
      // junta TODO el presupuesto de este material (todas sus máquinas) en un solo total antes de
      // repartir entre TAPAS; el reparto por máquina (para el detalle informativo) se hace DESPUÉS,
      // sobre las cantidades ya decididas, y no afecta cuánto puede producirse de cada TAPA.
      const presupuestoPorPuesto = new Map<string, number>();
      let presupuestoTotal = 0;
      puestosDelMaterial.forEach(puesto => {
        const asignado = (asignaciones.get(puesto) || []).find(r => r.material === m.material);
        const cantidad = asignado?.cantidad || 0;
        presupuestoPorPuesto.set(puesto, cantidad);
        presupuestoTotal += cantidad;
      });

      const demandaRestante = new Map<string, number>();
      const producidoPorTapa = new Map<string, number>();
      const consumidoPorTapa = new Map<string, number>();
      tapasDeEsteMaterial.forEach((_, tapaMaterial) => {
        demandaRestante.set(tapaMaterial, nivel2TapaPorMaterial.get(tapaMaterial)?.cantidadTotal || 0);
        producidoPorTapa.set(tapaMaterial, 0);
        consumidoPorTapa.set(tapaMaterial, 0);
      });

      // Relleno tipo "mejor ajuste" sobre el TOTAL combinado: tapas con demanda pendiente, de mayor a
      // menor cantidad por unidad, así se llenan primero los bloques grandes y las referencias más
      // chicas rellenan el sobrante.
      let presupuesto = presupuestoTotal;
      const candidatos = [...tapasDeEsteMaterial.entries()].sort((a, b) => b[1] - a[1]);
      for (const [tapaMaterial, cantidadUnitaria] of candidatos) {
        if (presupuesto <= 0.01) break;
        const pendiente = demandaRestante.get(tapaMaterial) || 0;
        if (pendiente <= 0.01) continue;
        const unidades = Math.min(pendiente, Math.floor(presupuesto / cantidadUnitaria));
        if (unidades <= 0) continue;
        const cantidadConsumida = unidades * cantidadUnitaria;
        presupuesto -= cantidadConsumida;
        demandaRestante.set(tapaMaterial, pendiente - unidades);
        producidoPorTapa.set(tapaMaterial, unidades);
        consumidoPorTapa.set(tapaMaterial, cantidadConsumida);
      }

      // Corrección por redondeo: con lo que sobró del mejor-ajuste, intentar dar UNA unidad más a la
      // tapa con menor cantidad por unidad que aún tenga demanda pendiente y quepa en el remanente.
      let progreso = true;
      while (progreso && presupuesto > 0.01) {
        progreso = false;
        const candidatoTapa = [...tapasDeEsteMaterial.entries()]
          .filter(([tapaMaterial, cantidadUnitaria]) => (demandaRestante.get(tapaMaterial) || 0) > 0.01 && cantidadUnitaria <= presupuesto + 0.01)
          .sort((a, b) => a[1] - b[1])[0];
        if (!candidatoTapa) break;
        const [tapaMaterial, cantidadUnitaria] = candidatoTapa;
        presupuesto -= cantidadUnitaria;
        demandaRestante.set(tapaMaterial, (demandaRestante.get(tapaMaterial) || 0) - 1);
        producidoPorTapa.set(tapaMaterial, (producidoPorTapa.get(tapaMaterial) || 0) + 1);
        consumidoPorTapa.set(tapaMaterial, (consumidoPorTapa.get(tapaMaterial) || 0) + cantidadUnitaria);
        progreso = true;
      }

      // Reparto informativo por máquina: las cantidades de cada TAPA ya quedaron decididas arriba;
      // aquí solo se reparte ese consumo entre las máquinas reales de este material (para el detalle
      // "Tapas Producibles por Máquina"), drenando cada máquina en el orden de mayor utilización.
      const restantePorPuesto = new Map(presupuestoPorPuesto);
      tapasDeEsteMaterial.forEach((_, tapaMaterial) => {
        let porRepartir = consumidoPorTapa.get(tapaMaterial) || 0;
        if (porRepartir <= 0.01) return;
        for (const puesto of puestosDelMaterial) {
          if (porRepartir <= 0.01) break;
          const disponible = restantePorPuesto.get(puesto) || 0;
          if (disponible <= 0.01) continue;
          const cantidadUnitaria = tapasDeEsteMaterial.get(tapaMaterial) || 1;
          const usar = Math.min(disponible, porRepartir);
          restantePorPuesto.set(puesto, disponible - usar);
          porRepartir -= usar;

          if (!porPuesto.has(puesto)) porPuesto.set(puesto, []);
          porPuesto.get(puesto)!.push({
            tapaMaterial,
            tapaNombre: nivel2TapaPorMaterial.get(tapaMaterial)?.nombre || '',
            materialAcolchado: m.material,
            materialNombre: m.nombre,
            unidades: usar / cantidadUnitaria,
            cantidadConsumida: usar,
          });
        }
      });

      restantePorPuesto.forEach((sobrante, puesto) => {
        if (sobrante > 0.01) {
          desperdicioPorPuesto.set(puesto, (desperdicioPorPuesto.get(puesto) || 0) + sobrante);
        }
      });

      producidoPorTapa.forEach((unidades, tapaMaterial) => {
        const actual = tapasPorMaterialLimitante.get(tapaMaterial);
        if (!actual || unidades < actual.producible) {
          tapasPorMaterialLimitante.set(tapaMaterial, { producible: unidades, material: m.material });
        }
      });
    });

    porPuesto.forEach(list => list.sort((a, b) => b.cantidadConsumida - a.cantidadConsumida));

    const porTapa = Array.from(tapasPorMaterialLimitante.entries())
      .map(([tapaMaterial, info]) => {
        const tapaInfo = nivel2TapaPorMaterial.get(tapaMaterial);
        const cantidadRequerida = tapaInfo?.cantidadTotal || 0;
        return {
          material: tapaMaterial,
          nombre: tapaInfo?.nombre || '',
          cantidadRequerida,
          cantidadProducible: info.producible,
          cobertura: cantidadRequerida > 0 ? (info.producible / cantidadRequerida) * 100 : 0,
          componenteLimitante: info.material,
        };
      })
      .sort((a, b) => a.cobertura - b.cobertura);

    return { porTapa, porPuesto, desperdicioPorPuesto };
  }, [acolchadoMateriales, acolchadoTapasPorMaterial, nivel2TapaPorMaterial, acolchadoAsignacionPorPuesto, acolchadoFactibilidad]);

  const acolchadoTapasProducibles = acolchadoTapasResultado.porTapa;

  const [acolchadoTapasPage, setAcolchadoTapasPage] = useState(1);
  const ACOLCHADO_TAPAS_PAGE_SIZE = 10;
  const acolchadoTapasTotalPages = Math.max(1, Math.ceil(acolchadoTapasProducibles.length / ACOLCHADO_TAPAS_PAGE_SIZE));
  const paginatedAcolchadoTapasProducibles = useMemo(() => {
    const start = (acolchadoTapasPage - 1) * ACOLCHADO_TAPAS_PAGE_SIZE;
    return acolchadoTapasProducibles.slice(start, start + ACOLCHADO_TAPAS_PAGE_SIZE);
  }, [acolchadoTapasProducibles, acolchadoTapasPage]);

  useEffect(() => {
    setAcolchadoTapasPage(1);
  }, [acolchadoTapasProducibles]);

  const acolchadoRecomendaciones = useMemo(() => {
    if (!acolchadoFactibilidad) return [];
    return acolchadoFactibilidad.puestosDeficit.map(p => {
      const recs: string[] = [];
      if (!p.cfg.isNightActive) {
        recs.push(`Activar turno nocturno en ${p.puesto} (sumaría ${horasNetasNocturnasVal.toFixed(2)} h × ${p.cfg.machines || 1} máquina${(p.cfg.machines || 1) === 1 ? '' : 's'} de capacidad).`);
      } else {
        recs.push(`Turno nocturno ya activo en ${p.puesto} — evaluar extender la jornada diurna (actualmente ${jornadaDiurnaSel} h) o sumar máquinas.`);
      }
      if ((p.cfg.people || 0) === 0) {
        recs.push(`${p.puesto} tiene turno(s) activo(s) pero 0 personas asignadas registradas — validar dotación real antes de confiar en esta capacidad.`);
      }
      if (p.horasRequeridasChn > 0 && p.horasRequeridasBase > 0) {
        recs.push(`Si no se cierra la brecha, priorizar colchones: ${p.horasRequeridasChn.toFixed(1)} h son para FORRO CHN (colchones) vs ${p.horasRequeridasBase.toFixed(1)} h para FORRO BASE (bases).`);
      }
      return { puesto: p.puesto, utilizacion: p.utilizacion, deficitHoras: p.deficitHoras, recs };
    });
  }, [acolchadoFactibilidad, horasNetasNocturnasVal, jornadaDiurnaSel]);

  // Recomendación INFORMATIVA de reducción de turnos — SOLO por máquina individual, nunca moviendo
  // carga entre máquinas. No se puede asumir que el trabajo de una máquina es transferible a otra: eso
  // requeriría verificar, material por material, que la máquina destino tenga tiempo estándar propio
  // registrado (la misma regla que ya rige el cuadre). Por eso esta recomendación solo compara las
  // horas YA REQUERIDAS de cada puesto (post-cuadre) contra la capacidad de un solo turno: si un solo
  // turno (día o noche) ya le alcanza, se recomienda apagar el otro — nunca se recomienda apagar ambos
  // turnos salvo que el puesto realmente no tenga horas requeridas (0).
  const acolchadoConsolidacionTurnos = useMemo(() => {
    if (!acolchadoFactibilidad || acolchadoFactibilidad.puestos.length === 0) return [];

    return acolchadoFactibilidad.puestos
      .map(p => {
        const machines = p.cfg.machines || 1;
        const capDia = horasNetasDiurnasVal * machines;
        const capNoche = horasNetasNocturnasVal * machines;
        const horasRequeridas = p.horasRequeridas;

        let recomendadoDia: boolean;
        let recomendadoNoche: boolean;
        if (horasRequeridas <= 0.01) {
          // Sin horas requeridas: sí se puede apagar por completo.
          recomendadoDia = false;
          recomendadoNoche = false;
        } else if (capDia > 0 && horasRequeridas <= capDia + 0.01) {
          // Cabe en un solo turno: se prioriza el diurno (más fácil de dotar) y se apaga el nocturno.
          recomendadoDia = true;
          recomendadoNoche = false;
        } else if (capNoche > 0 && horasRequeridas <= capNoche + 0.01) {
          recomendadoDia = false;
          recomendadoNoche = true;
        } else {
          // No cabe en un solo turno con la jornada actual: se necesitan ambos, no hay ahorro posible
          // sin ampliar la jornada o sumar máquinas — nunca se recomienda apagar ninguno en este caso.
          recomendadoDia = capDia > 0;
          recomendadoNoche = capNoche > 0;
        }

        const turnosActuales = (p.cfg.isDayActive ? 1 : 0) + (p.cfg.isNightActive ? 1 : 0);
        const turnosRecomendados = (recomendadoDia ? 1 : 0) + (recomendadoNoche ? 1 : 0);

        return {
          puesto: p.puesto,
          horasRequeridas,
          utilizacionActual: p.utilizacion,
          actualDia: p.cfg.isDayActive,
          actualNoche: p.cfg.isNightActive,
          recomendadoDia,
          recomendadoNoche,
          turnosActuales,
          turnosRecomendados,
          ahorroTurnos: turnosActuales - turnosRecomendados,
        };
      })
      .filter(r => r.ahorroTurnos > 0)
      .sort((a, b) => b.ahorroTurnos - a.ahorroTurnos);
  }, [acolchadoFactibilidad, horasNetasDiurnasVal, horasNetasNocturnasVal]);

  const renderDateFilterHeaderInternal = () => renderDateFilterHeader(techStartDate, setTechStartDate, techEndDate, setTechEndDate);

  const handleAcolchadoraBandAdjust = useCallback(() => {
    if (isBandAdjustActive) {
      setPlanFinalOrders(prev => prev.filter(o => o._source !== 'ach-bandas'));
      setAchBandAdjustedOrders([]);
      setIsBandAdjustActive(false);
      setIsBandAdjustAccepted(false);
      return;
    }

    const ach11Name = uniquePuestos.find(p => p.includes('ACOLCHADORA11') || (p.includes('ACH11') && !p.includes('COSEDORA')));
    const ach12Name = uniquePuestos.find(p => p.includes('ACOLCHADORA12') || (p.includes('ACH12') && !p.includes('COSEDORA')));

    if (!ach11Name || !ach12Name) {
      setIsBandAdjustActive(true);
      return;
    }

    const hr11 = mapToHojaRutaInternal(ach11Name).trim().toUpperCase();
    const hr12 = mapToHojaRutaInternal(ach12Name).trim().toUpperCase();

    const cfg11 = workstationConfigs[ach11Name] || { isDayActive: true, isNightActive: false, machines: 1 };
    const cfg12 = workstationConfigs[ach12Name] || { isDayActive: true, isNightActive: false, machines: 1 };

    const cap11 = ((cfg11.isDayActive ? horasNetasDiurnasVal : 0) + (cfg11.isNightActive ? horasNetasNocturnasVal : 0)) * (cfg11.machines || 1);
    const cap12 = ((cfg12.isDayActive ? horasNetasDiurnasVal : 0) + (cfg12.isNightActive ? horasNetasNocturnasVal : 0)) * (cfg12.machines || 1);

    if (cap11 === 0 || cap12 === 0) {
      setIsBandAdjustActive(true);
      return;
    }

    const getHours = (o: any) => calculateProductionTime(o['MATERIAL'] || o['CodMaterial'] || '', Number(o['CANTIDAD'] || o['CANTPROGRAMADA'] || 0), o) / 3600;

    const orders11 = techFilteredOrdenes.filter(o => String(o['MAQUINA'] || o['Maquina'] || '').trim().toUpperCase() === hr11);
    const orders12 = techFilteredOrdenes.filter(o => String(o['MAQUINA'] || o['Maquina'] || '').trim().toUpperCase() === hr12);

    let cur11 = orders11.reduce((s, o) => s + getHours(o), 0);
    let cur12 = orders12.reduce((s, o) => s + getHours(o), 0);

    const sorted12 = [...orders12].sort((a, b) => getHours(a) - getHours(b));
    const moved: any[] = [];
    let splitCandidate: any = null;

    for (const order of sorted12) {
      const h = getHours(order);
      const newUtil11 = ((cur11 + h) / cap11) * 100;
      const newUtil12 = ((cur12 - h) / cap12) * 100;
      if (newUtil12 < newUtil11) { splitCandidate = order; break; }
      moved.push(order);
      cur11 += h;
      cur12 -= h;
    }

    // Si mover la siguiente orden completa desbalancearía la carga, se evalúa dividirla
    // en dos (la parte necesaria para nivelar ambas máquinas y el remanente que se queda).
    if (splitCandidate) {
      const h = getHours(splitCandidate);
      const idealHoursToMove = ((cur12 / cap12) - (cur11 / cap11)) / (1 / cap11 + 1 / cap12);

      if (idealHoursToMove > 0 && idealHoursToMove < h) {
        const originalQty = Number(splitCandidate['CANTIDAD'] || splitCandidate['CANTPROGRAMADA'] || 0);
        let movedQty = Math.round(originalQty * (idealHoursToMove / h));
        movedQty = Math.min(Math.max(movedQty, 1), originalQty - 1);

        if (originalQty >= 2 && movedQty >= 1 && originalQty - movedQty >= 1) {
          const movedHours = getHours({ ...splitCandidate, CANTIDAD: movedQty, CANTPROGRAMADA: movedQty });
          const originalKey = `${splitCandidate['ORDEN'] || ''}|${String(splitCandidate['MATERIAL'] || splitCandidate['CodMaterial'] || '')}|${String(originalQty)}`;

          moved.push({
            ...splitCandidate,
            CANTIDAD: movedQty,
            CANTPROGRAMADA: movedQty,
            _isSplit: true,
            _originalCantidad: originalQty,
            _originalKey: originalKey,
          });
          cur11 += movedHours;
          cur12 -= movedHours;
        }
      }
    }

    setAchBandAdjustedOrders(moved);
    setIsBandAdjustActive(true);
  }, [isBandAdjustActive, uniquePuestos, mapToHojaRutaInternal, workstationConfigs, horasNetasDiurnasVal, horasNetasNocturnasVal, techFilteredOrdenes, calculateProductionTime]);

  const bandAdjustSummary = useMemo(() => {
    if (!isBandAdjustActive) return null;

    const ach11Name = uniquePuestos.find(p => p.includes('ACOLCHADORA11') || (p.includes('ACH11') && !p.includes('COSEDORA')));
    const ach12Name = uniquePuestos.find(p => p.includes('ACOLCHADORA12') || (p.includes('ACH12') && !p.includes('COSEDORA')));
    if (!ach11Name || !ach12Name) return null;

    const hr11 = mapToHojaRutaInternal(ach11Name).trim().toUpperCase();
    const hr12 = mapToHojaRutaInternal(ach12Name).trim().toUpperCase();

    const cfg11 = workstationConfigs[ach11Name] || { isDayActive: true, isNightActive: false, machines: 1 };
    const cfg12 = workstationConfigs[ach12Name] || { isDayActive: true, isNightActive: false, machines: 1 };

    const cap11 = ((cfg11.isDayActive ? horasNetasDiurnasVal : 0) + (cfg11.isNightActive ? horasNetasNocturnasVal : 0)) * (cfg11.machines || 1);
    const cap12 = ((cfg12.isDayActive ? horasNetasDiurnasVal : 0) + (cfg12.isNightActive ? horasNetasNocturnasVal : 0)) * (cfg12.machines || 1);

    const getHours = (o: any) => calculateProductionTime(o['MATERIAL'] || o['CodMaterial'] || '', Number(o['CANTIDAD'] || o['CANTPROGRAMADA'] || 0), o) / 3600;

    const orders11 = techFilteredOrdenes.filter(o => String(o['MAQUINA'] || o['Maquina'] || '').trim().toUpperCase() === hr11);
    const orders12 = techFilteredOrdenes.filter(o => String(o['MAQUINA'] || o['Maquina'] || '').trim().toUpperCase() === hr12);

    const origHours11 = orders11.reduce((s, o) => s + getHours(o), 0);
    const origHours12 = orders12.reduce((s, o) => s + getHours(o), 0);
    const movedHours = achBandAdjustedOrders.reduce((s, o) => s + getHours(o), 0);

    const splitCount = achBandAdjustedOrders.filter(o => o._isSplit).length;

    return {
      ach11Name,
      ach12Name,
      movedCount: achBandAdjustedOrders.length,
      movedHours,
      splitCount,
      origUtil11: cap11 > 0 ? (origHours11 / cap11) * 100 : 0,
      origUtil12: cap12 > 0 ? (origHours12 / cap12) * 100 : 0,
      newUtil11: cap11 > 0 ? ((origHours11 + movedHours) / cap11) * 100 : 0,
      newUtil12: cap12 > 0 ? ((origHours12 - movedHours) / cap12) * 100 : 0,
    };
  }, [isBandAdjustActive, achBandAdjustedOrders, uniquePuestos, mapToHojaRutaInternal, workstationConfigs, horasNetasDiurnasVal, horasNetasNocturnasVal, techFilteredOrdenes, calculateProductionTime]);

  const handleAcceptAdjust = useCallback(() => {
    if (!bandAdjustSummary || isBandAdjustAccepted) return;
    const hr11 = mapToHojaRutaInternal(bandAdjustSummary.ach11Name).trim().toUpperCase();
    const hr12 = mapToHojaRutaInternal(bandAdjustSummary.ach12Name).trim().toUpperCase();

    const splitByOriginalKey = new Map<string, any>();
    achBandAdjustedOrders.forEach(o => {
      if (o._isSplit && o._originalKey) splitByOriginalKey.set(o._originalKey, o);
    });

    const sectionOrders: any[] = [];
    techFilteredOrdenes
      .filter(o => {
        const maquina = String(o['MAQUINA'] || o['Maquina'] || '').trim().toUpperCase();
        return maquina === hr11 || maquina === hr12;
      })
      .forEach(o => {
        const key = `${o['ORDEN'] || ''}|${String(o['MATERIAL'] || o['CodMaterial'] || '')}|${String(o['CANTIDAD'] || o['CANTPROGRAMADA'] || '')}`;
        const splitEntry = splitByOriginalKey.get(key);

        if (splitEntry) {
          const movedQty = Number(splitEntry['CANTIDAD'] || splitEntry['CANTPROGRAMADA'] || 0);
          const remainderQty = Math.max(0, Number(splitEntry._originalCantidad || 0) - movedQty);
          sectionOrders.push({ ...o, CANTIDAD: movedQty, CANTPROGRAMADA: movedQty, _finalHR: hr11, _wasAdjusted: true, _isSplit: true, _source: 'ach-bandas' });
          sectionOrders.push({ ...o, CANTIDAD: remainderQty, CANTPROGRAMADA: remainderQty, _finalHR: hr12, _wasAdjusted: false, _isSplit: true, _source: 'ach-bandas' });
          return;
        }

        const wasAdjusted = achBandAdjustedKeys.has(key);
        sectionOrders.push({
          ...o,
          _finalHR: wasAdjusted ? hr11 : String(o['MAQUINA'] || o['Maquina'] || '').trim().toUpperCase(),
          _wasAdjusted: wasAdjusted,
          _source: 'ach-bandas',
        });
      });

    setPlanFinalOrders(prev => [
      ...prev.filter(o => o._source !== 'ach-bandas'),
      ...sectionOrders,
    ]);
    setIsBandAdjustAccepted(true);
    const wholeCount = bandAdjustSummary.movedCount - bandAdjustSummary.splitCount;
    const splitText = bandAdjustSummary.splitCount > 0 ? ` (incluyendo ${bandAdjustSummary.splitCount} orden${bandAdjustSummary.splitCount === 1 ? '' : 'es'} dividida${bandAdjustSummary.splitCount === 1 ? '' : 's'})` : '';
    addNotification('success', `Ajuste aceptado: ${wholeCount + bandAdjustSummary.splitCount} órdenes reasignadas de ${bandAdjustSummary.ach12Name} a ${bandAdjustSummary.ach11Name}${splitText}. Ver pestaña Plan Final.`);
  }, [bandAdjustSummary, isBandAdjustAccepted, mapToHojaRutaInternal, techFilteredOrdenes, achBandAdjustedKeys, achBandAdjustedOrders, addNotification]);

  const BORD_BAND_PUESTOS_FILTER = useCallback((p: string) =>
    p.includes('BO01') || p.includes('BORDADORA-BANDA01') ||
    p.includes('COS3D') || p.includes('BANDA3D') || p.includes('COSEDORA-BANDA3D') ||
    p.includes('ENCINTADOBD') || p.includes('COSEDORA-ENCINTADOBD'),
  []);

  const handleBordadoraBandAdjust = useCallback(() => {
    if (isBordBandAdjustActive) {
      setBordBandExcessKeys(new Set());
      setIsBordBandAdjustActive(false);
      setBordBandAcceptedMachines(new Set());
      setPlanFinalOrders(prev => prev.filter(o => !String(o._source || '').startsWith('bord-bandas-')));
      return;
    }

    const makeKey = (o: any) => `${o['ORDEN'] || ''}|${String(o['MATERIAL'] || o['CodMaterial'] || '')}|${String(o['CANTIDAD'] || o['CANTPROGRAMADA'] || '')}`;
    const getHours = (o: any) => calculateProductionTime(o['MATERIAL'] || o['CodMaterial'] || '', Number(o['CANTIDAD'] || o['CANTPROGRAMADA'] || 0), o) / 3600;

    const excessKeys = new Set<string>();
    uniquePuestos.filter(BORD_BAND_PUESTOS_FILTER).forEach(pName => {
      const hr = mapToHojaRutaInternal(pName).trim().toUpperCase();
      const cfg = workstationConfigs[pName] || { isDayActive: true, isNightActive: false, machines: 1 };
      const cap = ((cfg.isDayActive ? horasNetasDiurnasVal : 0) + (cfg.isNightActive ? horasNetasNocturnasVal : 0)) * (cfg.machines || 1);
      if (cap === 0) return;
      const machineOrders = techFilteredOrdenes.filter(o => String(o['MAQUINA'] || o['Maquina'] || '').trim().toUpperCase() === hr);
      let cumHours = 0;
      for (const order of machineOrders) {
        const h = getHours(order);
        cumHours += h;
        if (cumHours > cap) excessKeys.add(makeKey(order));
      }
    });

    setBordBandExcessKeys(excessKeys);
    setIsBordBandAdjustActive(true);
  }, [isBordBandAdjustActive, uniquePuestos, BORD_BAND_PUESTOS_FILTER, mapToHojaRutaInternal, workstationConfigs, horasNetasDiurnasVal, horasNetasNocturnasVal, techFilteredOrdenes, calculateProductionTime]);

  const bordBandAdjustSummary = useMemo(() => {
    if (!isBordBandAdjustActive) return null;
    const makeKey = (o: any) => `${o['ORDEN'] || ''}|${String(o['MATERIAL'] || o['CodMaterial'] || '')}|${String(o['CANTIDAD'] || o['CANTPROGRAMADA'] || '')}`;
    const getHours = (o: any) => calculateProductionTime(o['MATERIAL'] || o['CodMaterial'] || '', Number(o['CANTIDAD'] || o['CANTPROGRAMADA'] || 0), o) / 3600;

    const machines = uniquePuestos.filter(BORD_BAND_PUESTOS_FILTER).map(pName => {
      const hr = mapToHojaRutaInternal(pName).trim().toUpperCase();
      const cfg = workstationConfigs[pName] || { isDayActive: true, isNightActive: false, machines: 1 };
      const cap = ((cfg.isDayActive ? horasNetasDiurnasVal : 0) + (cfg.isNightActive ? horasNetasNocturnasVal : 0)) * (cfg.machines || 1);
      const machineOrders = techFilteredOrdenes.filter(o => String(o['MAQUINA'] || o['Maquina'] || '').trim().toUpperCase() === hr);
      const totalHours = machineOrders.reduce((s, o) => s + getHours(o), 0);
      const excessOrders = machineOrders.filter(o => bordBandExcessKeys.has(makeKey(o)));
      const excessHours = excessOrders.reduce((s, o) => s + getHours(o), 0);
      return {
        name: pName,
        hrCode: hr,
        capacityHours: cap,
        totalHours,
        utilization: cap > 0 ? (totalHours / cap) * 100 : 0,
        excessOrders,
        excessHours,
      };
    });

    return { machines, totalExcessOrders: machines.reduce((s, m) => s + m.excessOrders.length, 0) };
  }, [isBordBandAdjustActive, uniquePuestos, BORD_BAND_PUESTOS_FILTER, mapToHojaRutaInternal, workstationConfigs, horasNetasDiurnasVal, horasNetasNocturnasVal, techFilteredOrdenes, calculateProductionTime, bordBandExcessKeys]);

  const handleAcceptBordAdjustForMachine = useCallback((hrCode: string, machineName: string, excessCount: number) => {
    if (!bordBandAdjustSummary || bordBandAcceptedMachines.has(hrCode)) return;
    const makeKey = (o: any) => `${o['ORDEN'] || ''}|${String(o['MATERIAL'] || o['CodMaterial'] || '')}|${String(o['CANTIDAD'] || o['CANTPROGRAMADA'] || '')}`;
    const machineOrders = techFilteredOrdenes
      .filter(o => {
        const hr = String(o['MAQUINA'] || o['Maquina'] || '').trim().toUpperCase();
        return hr === hrCode && !bordBandExcessKeys.has(makeKey(o));
      })
      .map(o => ({
        ...o,
        _finalHR: hrCode,
        _wasAdjusted: false,
        _source: `bord-bandas-${hrCode}`,
      }));
    setPlanFinalOrders(prev => [
      ...prev.filter(o => o._source !== `bord-bandas-${hrCode}`),
      ...machineOrders,
    ]);
    setBordBandAcceptedMachines(prev => new Set([...prev, hrCode]));
    addNotification('success', `Ajuste aceptado para ${machineName}: ${excessCount} ${excessCount === 1 ? 'orden marcada' : 'órdenes marcadas'} como no producible. Ver pestaña Plan Final.`);
  }, [bordBandAdjustSummary, bordBandAcceptedMachines, techFilteredOrdenes, bordBandExcessKeys, addNotification]);

  const handleRmtbAdjust = useCallback(() => {
    if (isRmtbAdjustActive) {
      setIsRmtbAdjustActive(false);
      setRmtbAcceptedMachines(new Set());
      setRmtbMovedOrders([]);
      setPlanFinalOrders(prev => prev.filter(o => !String(o._source || '').startsWith('rmtb-')));
      return;
    }

    const isRmtb1 = (p: string) => { const u = p.toUpperCase(); return (u.includes('RMTB1') || u.includes('RMTB-1') || u.includes('RMTB01')) && !u.includes('RMTBM') && !u.includes('RMTB-M'); };
    const isRmtb2 = (p: string) => { const u = p.toUpperCase(); return (u.includes('RMTB2') || u.includes('RMTB-2') || u.includes('RMTB02')) && !u.includes('RMTBM') && !u.includes('RMTB-M'); };
    const isRmtb3 = (p: string) => { const u = p.toUpperCase(); return (u.includes('RMTB3') || u.includes('RMTB-3') || u.includes('RMTB03')) && !u.includes('RMTBM') && !u.includes('RMTB-M'); };

    const rmtb1 = uniquePuestos.find(isRmtb1);
    const rmtb2 = uniquePuestos.find(isRmtb2);
    const rmtb3 = uniquePuestos.find(isRmtb3);

    const activeMachines = [rmtb1, rmtb2, rmtb3].filter(Boolean) as string[];
    if (activeMachines.length < 2) { setIsRmtbAdjustActive(true); return; }

    const getHR = (p: string) => mapToHojaRutaInternal(p).trim().toUpperCase();
    const getCap = (p: string) => {
      const cfg = workstationConfigs[p] || { isDayActive: true, isNightActive: false, machines: 1 };
      return ((cfg.isDayActive ? horasNetasDiurnasVal : 0) + (cfg.isNightActive ? horasNetasNocturnasVal : 0)) * (cfg.machines || 1);
    };
    const getHours = (o: any) => calculateProductionTime(o['MATERIAL'] || o['CodMaterial'] || '', Number(o['CANTIDAD'] || o['CANTPROGRAMADA'] || 0), o) / 3600;

    const machineHRs = activeMachines.map(getHR);
    const machineCaps = activeMachines.map(getCap);

    const allOrders = techFilteredOrdenes
      .filter(o => machineHRs.includes(String(o['MAQUINA'] || o['Maquina'] || '').trim().toUpperCase()))
      .map(o => ({ ...o, _origHR: String(o['MAQUINA'] || o['Maquina'] || '').trim().toUpperCase() }));

    allOrders.sort((a, b) => getHours(b) - getHours(a));

    const assignedHours = machineCaps.map(() => 0);
    const assignedHR: string[] = [];

    for (const order of allOrders) {
      const utils = assignedHours.map((h, i) => machineCaps[i] > 0 ? h / machineCaps[i] : Infinity);
      const minIdx = utils.indexOf(Math.min(...utils));
      assignedHR.push(machineHRs[minIdx]);
      assignedHours[minIdx] += getHours(order);
    }

    const moved: { order: any; fromHR: string; toHR: string }[] = [];
    allOrders.forEach((order, idx) => {
      if (order._origHR !== assignedHR[idx]) {
        moved.push({ order, fromHR: order._origHR, toHR: assignedHR[idx] });
      }
    });

    setRmtbMovedOrders(moved);
    setIsRmtbAdjustActive(true);
  }, [isRmtbAdjustActive, uniquePuestos, mapToHojaRutaInternal, workstationConfigs, horasNetasDiurnasVal, horasNetasNocturnasVal, techFilteredOrdenes, calculateProductionTime]);

  const rmtbAdjustSummary = useMemo(() => {
    if (!isRmtbAdjustActive) return null;

    const isRmtb1 = (p: string) => { const u = p.toUpperCase(); return (u.includes('RMTB1') || u.includes('RMTB-1') || u.includes('RMTB01')) && !u.includes('RMTBM') && !u.includes('RMTB-M'); };
    const isRmtb2 = (p: string) => { const u = p.toUpperCase(); return (u.includes('RMTB2') || u.includes('RMTB-2') || u.includes('RMTB02')) && !u.includes('RMTBM') && !u.includes('RMTB-M'); };
    const isRmtb3 = (p: string) => { const u = p.toUpperCase(); return (u.includes('RMTB3') || u.includes('RMTB-3') || u.includes('RMTB03')) && !u.includes('RMTBM') && !u.includes('RMTB-M'); };
    const isRmtbM = (p: string) => { const u = p.toUpperCase(); return u.includes('RMTBM') || u.includes('RMTB-M'); };

    const rmtb1 = uniquePuestos.find(isRmtb1);
    const rmtb2 = uniquePuestos.find(isRmtb2);
    const rmtb3 = uniquePuestos.find(isRmtb3);
    const rmtbM = uniquePuestos.find(isRmtbM);

    const makeKey = (o: any) => `${o['ORDEN'] || ''}|${String(o['MATERIAL'] || o['CodMaterial'] || '')}|${String(o['CANTIDAD'] || o['CANTPROGRAMADA'] || '')}`;
    const getHours = (o: any) => calculateProductionTime(o['MATERIAL'] || o['CodMaterial'] || '', Number(o['CANTIDAD'] || o['CANTPROGRAMADA'] || 0), o) / 3600;
    const getHR = (p: string) => mapToHojaRutaInternal(p).trim().toUpperCase();
    const getCap = (p: string) => {
      const cfg = workstationConfigs[p] || { isDayActive: true, isNightActive: false, machines: 1 };
      return ((cfg.isDayActive ? horasNetasDiurnasVal : 0) + (cfg.isNightActive ? horasNetasNocturnasVal : 0)) * (cfg.machines || 1);
    };

    const movedOutKeys = new Map<string, Set<string>>();
    const movedIn = new Map<string, any[]>();
    rmtbMovedOrders.forEach(({ order, fromHR, toHR }) => {
      if (!movedOutKeys.has(fromHR)) movedOutKeys.set(fromHR, new Set());
      movedOutKeys.get(fromHR)!.add(makeKey(order));
      if (!movedIn.has(toHR)) movedIn.set(toHR, []);
      movedIn.get(toHR)!.push(order);
    });

    const buildMachine = (pName: string | undefined) => {
      if (!pName) return null;
      const hr = getHR(pName);
      const cap = getCap(pName);
      const origOrders = techFilteredOrdenes.filter(o => String(o['MAQUINA'] || o['Maquina'] || '').trim().toUpperCase() === hr);
      const outKeys = movedOutKeys.get(hr) || new Set();
      const inOrders = movedIn.get(hr) || [];
      const finalOrders = [...origOrders.filter(o => !outKeys.has(makeKey(o))), ...inOrders];
      const origHours = origOrders.reduce((s, o) => s + getHours(o), 0);
      const finalHours = finalOrders.reduce((s, o) => s + getHours(o), 0);
      let cumHours = 0;
      const excessOrders: any[] = [];
      for (const o of finalOrders) {
        const h = getHours(o);
        cumHours += h;
        if (cumHours > cap) excessOrders.push(o);
      }
      const excessOrderHours = excessOrders.reduce((s, o) => s + getHours(o), 0);
      const producibleHours = finalHours - excessOrderHours;
      return {
        name: pName, hrCode: hr, cap,
        origHours, finalHours, producibleHours,
        origUtil: cap > 0 ? (origHours / cap) * 100 : 0,
        finalUtil: cap > 0 ? (finalHours / cap) * 100 : 0,
        realUtil: cap > 0 ? (producibleHours / cap) * 100 : 0,
        movedIn: inOrders.length,
        movedOut: outKeys.size,
        excessOrders,
        excessHours: Math.max(0, finalHours - cap),
      };
    };

    const rmtb3HR = rmtb3 ? getHR(rmtb3) : '';
    const rmtb3Materials = new Set(
      techFilteredOrdenes
        .filter(o => String(o['MAQUINA'] || o['Maquina'] || '').trim().toUpperCase() === rmtb3HR)
        .map(o => normalizeMaterialCode(o['MATERIAL'] || o['CodMaterial'] || ''))
    );

    const rmtbMHR = rmtbM ? getHR(rmtbM) : '';
    const rmtbMOrders = rmtbM ? techFilteredOrdenes.filter(o => String(o['MAQUINA'] || o['Maquina'] || '').trim().toUpperCase() === rmtbMHR) : [];

    const rmtbMObligatory = rmtbMOrders.filter(ord => {
      const matCode = normalizeMaterialCode(ord['MATERIAL'] || ord['CodMaterial'] || '');
      const components = listaMaterialesData
        .filter(item => normalizeMaterialCode(String(item['MATERIAL'] || item['Material'] || item['PADRE'] || '')) === matCode)
        .map(item => normalizeMaterialCode(String(item['COMPONENTE'] || item['Componente'] || item['HIJO'] || '')));
      return components.some(comp => comp && rmtb3Materials.has(comp));
    });

    const rmtbMMachine = rmtbM ? buildMachine(rmtbM) : null;

    return {
      machines: [rmtb1, rmtb2, rmtb3].map(buildMachine).filter(Boolean),
      rmtbM: rmtbMMachine ? { ...rmtbMMachine, obligatoryRmtb3: rmtbMObligatory } : null,
      totalMoved: rmtbMovedOrders.length,
    };
  }, [isRmtbAdjustActive, rmtbMovedOrders, uniquePuestos, mapToHojaRutaInternal, workstationConfigs, horasNetasDiurnasVal, horasNetasNocturnasVal, techFilteredOrdenes, calculateProductionTime, normalizeMaterialCode, listaMaterialesData]);

  const handleAcceptRmtbAdjustForMachine = useCallback((hrCode: string, machineName: string) => {
    if (!rmtbAdjustSummary || rmtbAcceptedMachines.has(hrCode)) return;
    const makeKey = (o: any) => `${o['ORDEN'] || ''}|${String(o['MATERIAL'] || o['CodMaterial'] || '')}|${String(o['CANTIDAD'] || o['CANTPROGRAMADA'] || '')}`;
    const machineSummary = rmtbAdjustSummary.machines.find(m => m?.hrCode === hrCode);
    const excessKeys = new Set((machineSummary?.excessOrders || []).map(makeKey));

    // Si es RMTB3, excluir también los materiales liberados por la cascada inversa de RMTBM
    const liberadaMats = new Set(rmtbmBandaLiberada.map(item => item.material));
    const isLiberada = (o: any) => liberadaMats.has(String(o['MATERIAL'] || o['CodMaterial'] || '').trim());

    const movedOutKeys = new Set(rmtbMovedOrders.filter(m => m.fromHR === hrCode).map(m => makeKey(m.order)));
    const movedInOrders = rmtbMovedOrders.filter(m => m.toHR === hrCode).map(m => m.order);
    const machineOrders = [
      ...techFilteredOrdenes
        .filter(o => String(o['MAQUINA'] || o['Maquina'] || '').trim().toUpperCase() === hrCode && !movedOutKeys.has(makeKey(o)) && !excessKeys.has(makeKey(o)) && !isLiberada(o))
        .map(o => ({ ...o, _finalHR: hrCode, _wasAdjusted: false, _source: `rmtb-${hrCode}` })),
      ...movedInOrders.filter(o => !excessKeys.has(makeKey(o)) && !isLiberada(o)).map(o => ({ ...o, _finalHR: hrCode, _wasAdjusted: true, _source: `rmtb-${hrCode}` })),
    ];
    setPlanFinalOrders(prev => [...prev.filter(o => o._source !== `rmtb-${hrCode}`), ...machineOrders]);
    setRmtbAcceptedMachines(prev => new Set([...prev, hrCode]));
    const totalMoves = rmtbMovedOrders.filter(m => m.toHR === hrCode || m.fromHR === hrCode).length;
    const liberadasCount = rmtbmBandaLiberada.length > 0 ? ` · ${rmtbmBandaLiberada.length} BANDA${rmtbmBandaLiberada.length !== 1 ? 's' : ''} excluida${rmtbmBandaLiberada.length !== 1 ? 's' : ''} por cascada RMTBM` : '';
    addNotification('success', `Ajuste aceptado para ${machineName}: ${totalMoves} ${totalMoves === 1 ? 'orden redistribuida' : 'órdenes redistribuidas'}${liberadasCount}. Ver pestaña Plan Final.`);
  }, [rmtbAdjustSummary, rmtbAcceptedMachines, rmtbMovedOrders, rmtbmBandaLiberada, techFilteredOrdenes, addNotification]);

  // Cascada inversa RMTBM → RMTB3: llama getMaestroMaterialesExplosion para cada
  // material en exceso de RMTBM y cruza los componentes devueltos con las órdenes reales de RMTB3.
  useEffect(() => {
    if (!isRmtbAdjustActive || !rmtbAdjustSummary?.rmtbM) {
      setRmtbmBandaLiberada([]);
      return;
    }
    const excessOrders: any[] = (rmtbAdjustSummary.rmtbM as any).excessOrders || [];
    if (excessOrders.length === 0) { setRmtbmBandaLiberada([]); return; }

    const uniqueMaterials = [...new Set(
      excessOrders.map((o: any) => String(o['MATERIAL'] || o['CodMaterial'] || '').trim())
    )].filter(Boolean) as string[];
    if (uniqueMaterials.length === 0) { setRmtbmBandaLiberada([]); return; }

    const isRmtb3p = (p: string) => { const u = p.toUpperCase(); return (u.includes('RMTB3') || u.includes('RMTB-3') || u.includes('RMTB03')) && !u.includes('RMTBM') && !u.includes('RMTB-M'); };
    const rmtb3Puesto = uniquePuestos.find(isRmtb3p);
    const rmtb3HR = rmtb3Puesto ? mapToHojaRutaInternal(rmtb3Puesto).trim().toUpperCase() : '';
    const rmtb3MatIndex = new Map<string, any>(
      techFilteredOrdenes
        .filter(o => String(o['MAQUINA'] || o['Maquina'] || '').trim().toUpperCase() === rmtb3HR)
        .map(o => [String(o['MATERIAL'] || o['CodMaterial'] || '').trim(), o])
    );

    let cancelled = false;
    setIsLoadingRmtbmBOM(true);

    Promise.all(
      uniqueMaterials.map(mat =>
        serviciosService.getMaestroMaterialesExplosion('1000', mat, 1, 5000)
          .then((r: any) => ({ mat, data: r.data || [] }))
          .catch(() => ({ mat, data: [] }))
      )
    ).then((results: { mat: string; data: any[] }[]) => {
      if (cancelled) return;
      const liberated: { material: string; nombre: string; cantidad: number; causedByMat: string }[] = [];
      const addedMats = new Set<string>();

      results.forEach(({ mat, data }) => {
        // Solo componentes de nivel 1 cuya descripción contenga "BANDA"
        const bandaNivel1 = data.filter((comp: any) =>
          Number(comp.NIVEL) === 1 &&
          String(comp.DESCRIPCION_COMPONENTE || '').toUpperCase().includes('BANDA')
        );
        bandaNivel1.forEach((comp: any) => {
          const compMat = String(comp.COMPONENTE || '').trim();
          if (!compMat || addedMats.has(compMat)) return;
          const rmtb3Order = rmtb3MatIndex.get(compMat);
          if (rmtb3Order) {
            liberated.push({
              material: compMat,
              nombre: String(rmtb3Order['NOMBRE'] || rmtb3Order['TEXTOMATERIAL'] || comp.DESCRIPCION_COMPONENTE || ''),
              cantidad: Number(rmtb3Order['CANTIDAD'] || rmtb3Order['CANTPROGRAMADA'] || 0),
              causedByMat: mat,
            });
            addedMats.add(compMat);
          }
        });
      });
      setRmtbmBandaLiberada(liberated);
    }).finally(() => { if (!cancelled) setIsLoadingRmtbmBOM(false); });

    return () => { cancelled = true; };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isRmtbAdjustActive, rmtbAdjustSummary]);

  const handleCorteAdjust = useCallback(() => {
    if (isCorteAdjustActive) {
      setIsCorteAdjustActive(false);
      setCorteAcceptedMachines(new Set());
      setCorteMovedOrders([]);
      setPlanFinalOrders(prev => prev.filter(o => !String(o._source || '').startsWith('corte-')));
      return;
    }

    const cortela10 = uniquePuestos.find(p => p.toUpperCase().includes('CORTELA10'));
    const corteEspuma = uniquePuestos.find(p => p.toUpperCase() === 'CORTE-ESPUMA');
    const activeMachines = [cortela10, corteEspuma].filter(Boolean) as string[];
    if (activeMachines.length < 2) { setIsCorteAdjustActive(true); return; }

    const getFullHR = (p: string) => mapToHojaRutaInternal(p).trim().toUpperCase();
    const getHRList = (fullHR: string) => fullHR.split('/').map(c => c.trim()).filter(Boolean);
    const getCap = (p: string) => {
      const cfg = workstationConfigs[p] || { isDayActive: true, isNightActive: false, machines: 1 };
      return ((cfg.isDayActive ? horasNetasDiurnasVal : 0) + (cfg.isNightActive ? horasNetasNocturnasVal : 0)) * (cfg.machines || 1);
    };
    const getHours = (o: any) => calculateProductionTime(o['MATERIAL'] || o['CodMaterial'] || '', Number(o['CANTIDAD'] || o['CANTPROGRAMADA'] || 0), o) / 3600;

    const machineFullHRs = activeMachines.map(getFullHR);
    const machineHRLists = machineFullHRs.map(getHRList);
    const machineCaps = activeMachines.map(getCap);

    const allHRs = machineHRLists.flat();
    const allOrders = techFilteredOrdenes
      .filter(o => allHRs.includes(String(o['MAQUINA'] || o['Maquina'] || '').trim().toUpperCase()))
      .map(o => ({ ...o, _origFullHR: machineFullHRs[machineHRLists.findIndex(list => list.includes(String(o['MAQUINA'] || o['Maquina'] || '').trim().toUpperCase()))] }));

    allOrders.sort((a, b) => getHours(b) - getHours(a));

    const assignedHours = machineCaps.map(() => 0);
    const assignedFullHR: string[] = [];

    for (const order of allOrders) {
      const utils = assignedHours.map((h, i) => machineCaps[i] > 0 ? h / machineCaps[i] : Infinity);
      const minIdx = utils.indexOf(Math.min(...utils));
      assignedFullHR.push(machineFullHRs[minIdx]);
      assignedHours[minIdx] += getHours(order);
    }

    const moved: { order: any; fromHR: string; toHR: string }[] = [];
    allOrders.forEach((order, idx) => {
      if (order._origFullHR !== assignedFullHR[idx]) {
        moved.push({ order, fromHR: order._origFullHR, toHR: assignedFullHR[idx] });
      }
    });

    setCorteMovedOrders(moved);
    setIsCorteAdjustActive(true);
  }, [isCorteAdjustActive, uniquePuestos, mapToHojaRutaInternal, workstationConfigs, horasNetasDiurnasVal, horasNetasNocturnasVal, techFilteredOrdenes, calculateProductionTime]);

  const corteAdjustSummary = useMemo(() => {
    if (!isCorteAdjustActive) return null;

    const cortela10 = uniquePuestos.find(p => p.toUpperCase().includes('CORTELA10'));
    const corteEspuma = uniquePuestos.find(p => p.toUpperCase() === 'CORTE-ESPUMA');

    const makeKey = (o: any) => `${o['ORDEN'] || ''}|${String(o['MATERIAL'] || o['CodMaterial'] || '')}|${String(o['CANTIDAD'] || o['CANTPROGRAMADA'] || '')}`;
    const getHours = (o: any) => calculateProductionTime(o['MATERIAL'] || o['CodMaterial'] || '', Number(o['CANTIDAD'] || o['CANTPROGRAMADA'] || 0), o) / 3600;
    const getFullHR = (p: string) => mapToHojaRutaInternal(p).trim().toUpperCase();
    const getCap = (p: string) => {
      const cfg = workstationConfigs[p] || { isDayActive: true, isNightActive: false, machines: 1 };
      return ((cfg.isDayActive ? horasNetasDiurnasVal : 0) + (cfg.isNightActive ? horasNetasNocturnasVal : 0)) * (cfg.machines || 1);
    };

    const movedOutKeys = new Map<string, Set<string>>();
    const movedIn = new Map<string, any[]>();
    corteMovedOrders.forEach(({ order, fromHR, toHR }) => {
      if (!movedOutKeys.has(fromHR)) movedOutKeys.set(fromHR, new Set());
      movedOutKeys.get(fromHR)!.add(makeKey(order));
      if (!movedIn.has(toHR)) movedIn.set(toHR, []);
      movedIn.get(toHR)!.push(order);
    });

    const buildMachine = (pName: string | undefined) => {
      if (!pName) return null;
      const fullHR = getFullHR(pName);
      const hrList = fullHR.split('/').map(c => c.trim()).filter(Boolean);
      const cap = getCap(pName);
      const origOrders = techFilteredOrdenes.filter(o => hrList.includes(String(o['MAQUINA'] || o['Maquina'] || '').trim().toUpperCase()));
      const outKeys = movedOutKeys.get(fullHR) || new Set();
      const inOrders = movedIn.get(fullHR) || [];
      const finalOrders = [...origOrders.filter(o => !outKeys.has(makeKey(o))), ...inOrders];
      const origHours = origOrders.reduce((s, o) => s + getHours(o), 0);
      const finalHours = finalOrders.reduce((s, o) => s + getHours(o), 0);
      let cumHours = 0;
      const excessOrders: any[] = [];
      for (const o of finalOrders) {
        const h = getHours(o);
        cumHours += h;
        if (cumHours > cap) excessOrders.push(o);
      }
      const excessOrderHours = excessOrders.reduce((s, o) => s + getHours(o), 0);
      const producibleHours = finalHours - excessOrderHours;
      return {
        name: pName, hrCode: fullHR, cap,
        origHours, finalHours, producibleHours,
        origUtil: cap > 0 ? (origHours / cap) * 100 : 0,
        finalUtil: cap > 0 ? (finalHours / cap) * 100 : 0,
        realUtil: cap > 0 ? (producibleHours / cap) * 100 : 0,
        movedIn: inOrders.length, movedOut: outKeys.size,
        excessOrders, excessHours: Math.max(0, finalHours - cap),
      };
    };

    return {
      machines: [cortela10, corteEspuma].map(buildMachine).filter((m): m is NonNullable<typeof m> => m !== null),
      totalMoved: corteMovedOrders.length,
    };
  }, [isCorteAdjustActive, corteMovedOrders, uniquePuestos, mapToHojaRutaInternal, workstationConfigs, horasNetasDiurnasVal, horasNetasNocturnasVal, techFilteredOrdenes, calculateProductionTime]);

  const handleAcceptCorteAdjustForMachine = useCallback((machineFullHR: string, machineName: string) => {
    if (!corteAdjustSummary || corteAcceptedMachines.has(machineFullHR)) return;
    const makeKey = (o: any) => `${o['ORDEN'] || ''}|${String(o['MATERIAL'] || o['CodMaterial'] || '')}|${String(o['CANTIDAD'] || o['CANTPROGRAMADA'] || '')}`;
    const machineSummary = corteAdjustSummary.machines.find(m => m?.hrCode === machineFullHR);
    const excessKeys = new Set((machineSummary?.excessOrders || []).map(makeKey));
    const movedOutKeys = new Set(corteMovedOrders.filter(m => m.fromHR === machineFullHR).map(m => makeKey(m.order)));
    const movedInOrders = corteMovedOrders.filter(m => m.toHR === machineFullHR).map(m => m.order);
    const hrList = machineFullHR.includes('/') ? machineFullHR.split('/').map(c => c.trim()) : [machineFullHR];
    const machineOrders = [
      ...techFilteredOrdenes
        .filter(o => hrList.includes(String(o['MAQUINA'] || o['Maquina'] || '').trim().toUpperCase()) && !movedOutKeys.has(makeKey(o)) && !excessKeys.has(makeKey(o)))
        .map(o => ({ ...o, _finalHR: machineFullHR, _wasAdjusted: false, _source: `corte-${machineFullHR}` })),
      ...movedInOrders.filter(o => !excessKeys.has(makeKey(o))).map(o => ({ ...o, _finalHR: machineFullHR, _wasAdjusted: true, _source: `corte-${machineFullHR}` })),
    ];
    setPlanFinalOrders(prev => [...prev.filter(o => o._source !== `corte-${machineFullHR}`), ...machineOrders]);
    setCorteAcceptedMachines(prev => new Set([...prev, machineFullHR]));
    const totalMoves = corteMovedOrders.filter(m => m.toHR === machineFullHR || m.fromHR === machineFullHR).length;
    addNotification('success', `Ajuste aceptado para ${machineName}: ${totalMoves} ${totalMoves === 1 ? 'orden redistribuida' : 'órdenes redistribuidas'}. Ver pestaña Plan Final.`);
  }, [corteAdjustSummary, corteAcceptedMachines, corteMovedOrders, techFilteredOrdenes, addNotification]);

  // ─── Utilidad compartida: bin-packing genérico ────────────────────────────
  const binPackGroup = useCallback((groupPuestos: string[]): { order: any; fromHR: string; toHR: string }[] => {
    if (groupPuestos.length < 2) return [];
    const getFullHR = (p: string) => mapToHojaRutaInternal(p).trim().toUpperCase();
    const getHRList = (hr: string) => hr.split('/').map(c => c.trim()).filter(Boolean);
    const getCap = (p: string) => { const cfg = workstationConfigs[p] || { isDayActive: true, isNightActive: false, machines: 1 }; return ((cfg.isDayActive ? horasNetasDiurnasVal : 0) + (cfg.isNightActive ? horasNetasNocturnasVal : 0)) * (cfg.machines || 1); };
    const getH = (o: any) => calculateProductionTime(o['MATERIAL'] || o['CodMaterial'] || '', Number(o['CANTIDAD'] || o['CANTPROGRAMADA'] || 0), o) / 3600;
    const machineHRs = groupPuestos.map(getFullHR);
    const machineHRLists = machineHRs.map(getHRList);
    const caps = groupPuestos.map(getCap);
    const allHRs = machineHRLists.flat();
    const orders = techFilteredOrdenes
      .filter(o => allHRs.includes(String(o['MAQUINA'] || o['Maquina'] || '').trim().toUpperCase()))
      .map(o => { const i = machineHRLists.findIndex(l => l.includes(String(o['MAQUINA'] || o['Maquina'] || '').trim().toUpperCase())); return { ...o, _origFullHR: machineHRs[i] ?? '' }; });
    orders.sort((a, b) => getH(b) - getH(a));
    const assignedH = caps.map(() => 0);
    const assignedHR: string[] = [];
    for (const o of orders) {
      const utils = assignedH.map((h, i) => caps[i] > 0 ? h / caps[i] : Infinity);
      const mi = utils.indexOf(Math.min(...utils));
      assignedHR.push(machineHRs[mi]);
      assignedH[mi] += getH(o);
    }
    const moved: { order: any; fromHR: string; toHR: string }[] = [];
    orders.forEach((o, i) => { if (o._origFullHR !== assignedHR[i]) moved.push({ order: o, fromHR: o._origFullHR, toHR: assignedHR[i] }); });
    return moved;
  }, [mapToHojaRutaInternal, workstationConfigs, horasNetasDiurnasVal, horasNetasNocturnasVal, techFilteredOrdenes, calculateProductionTime]);

  // ─── Utilidad compartida: resumen de capacidad genérico ──────────────────
  const buildGroupCapSummary = useCallback((groupPuestos: string[], movedOrders: { order: any; fromHR: string; toHR: string }[]) => {
    const getFullHR = (p: string) => mapToHojaRutaInternal(p).trim().toUpperCase();
    const getCap = (p: string) => { const cfg = workstationConfigs[p] || { isDayActive: true, isNightActive: false, machines: 1 }; return ((cfg.isDayActive ? horasNetasDiurnasVal : 0) + (cfg.isNightActive ? horasNetasNocturnasVal : 0)) * (cfg.machines || 1); };
    const getH = (o: any) => calculateProductionTime(o['MATERIAL'] || o['CodMaterial'] || '', Number(o['CANTIDAD'] || o['CANTPROGRAMADA'] || 0), o) / 3600;
    const mk = (o: any) => `${o['ORDEN'] || ''}|${String(o['MATERIAL'] || o['CodMaterial'] || '')}|${String(o['CANTIDAD'] || o['CANTPROGRAMADA'] || '')}`;
    const outMap = new Map<string, Set<string>>();
    const inMap = new Map<string, any[]>();
    movedOrders.forEach(({ order, fromHR, toHR }) => {
      if (!outMap.has(fromHR)) outMap.set(fromHR, new Set());
      outMap.get(fromHR)!.add(mk(order));
      if (!inMap.has(toHR)) inMap.set(toHR, []);
      inMap.get(toHR)!.push(order);
    });
    const buildM = (pName: string) => {
      const fullHR = getFullHR(pName);
      const hrList = fullHR.split('/').map(c => c.trim()).filter(Boolean);
      const cap = getCap(pName);
      const orig = techFilteredOrdenes.filter(o => hrList.includes(String(o['MAQUINA'] || o['Maquina'] || '').trim().toUpperCase()));
      const outKeys = outMap.get(fullHR) || new Set();
      const inOrds = inMap.get(fullHR) || [];
      const final = [...orig.filter(o => !outKeys.has(mk(o))), ...inOrds];
      const origH = orig.reduce((s, o) => s + getH(o), 0);
      const finalH = final.reduce((s, o) => s + getH(o), 0);
      let cum = 0; const excess: any[] = [];
      for (const o of final) { const h = getH(o); cum += h; if (cum > cap) excess.push(o); }
      const excessH = excess.reduce((s, o) => s + getH(o), 0);
      const prodH = finalH - excessH;
      return { name: pName, hrCode: fullHR, cap, origHours: origH, finalHours: finalH, producibleHours: prodH, origUtil: cap > 0 ? (origH / cap) * 100 : 0, finalUtil: cap > 0 ? (finalH / cap) * 100 : 0, realUtil: cap > 0 ? (prodH / cap) * 100 : 0, movedIn: inOrds.length, movedOut: outKeys.size, excessOrders: excess, excessHours: Math.max(0, finalH - cap) };
    };
    return { machines: groupPuestos.map(buildM), totalMoved: movedOrders.length };
  }, [mapToHojaRutaInternal, workstationConfigs, horasNetasDiurnasVal, horasNetasNocturnasVal, techFilteredOrdenes, calculateProductionTime]);

  // ─── Utilidad compartida: aceptar ajuste por máquina ────────────────────
  const acceptGroupAdjust = useCallback((
    machineFullHR: string, machineName: string, sourcePrefix: string,
    summary: ReturnType<typeof buildGroupCapSummary> | null,
    acceptedSet: Set<string>, setAccepted: (fn: (prev: Set<string>) => Set<string>) => void,
    movedOrds: { order: any; fromHR: string; toHR: string }[]
  ) => {
    if (!summary || acceptedSet.has(machineFullHR)) return;
    const mk = (o: any) => `${o['ORDEN'] || ''}|${String(o['MATERIAL'] || o['CodMaterial'] || '')}|${String(o['CANTIDAD'] || o['CANTPROGRAMADA'] || '')}`;
    const mSum = summary.machines.find(m => m.hrCode === machineFullHR);
    const excessKeys = new Set((mSum?.excessOrders || []).map(mk));
    const outKeys = new Set(movedOrds.filter(m => m.fromHR === machineFullHR).map(m => mk(m.order)));
    const inOrds = movedOrds.filter(m => m.toHR === machineFullHR).map(m => m.order);
    const hrList = machineFullHR.includes('/') ? machineFullHR.split('/').map(c => c.trim()) : [machineFullHR];
    const finalOrds = [
      ...techFilteredOrdenes.filter(o => hrList.includes(String(o['MAQUINA'] || o['Maquina'] || '').trim().toUpperCase()) && !outKeys.has(mk(o)) && !excessKeys.has(mk(o))).map(o => ({ ...o, _finalHR: machineFullHR, _wasAdjusted: false, _source: `${sourcePrefix}-${machineFullHR}` })),
      ...inOrds.filter(o => !excessKeys.has(mk(o))).map(o => ({ ...o, _finalHR: machineFullHR, _wasAdjusted: true, _source: `${sourcePrefix}-${machineFullHR}` })),
    ];
    setPlanFinalOrders(prev => [...prev.filter(o => o._source !== `${sourcePrefix}-${machineFullHR}`), ...finalOrds]);
    setAccepted(prev => new Set([...prev, machineFullHR]));
    const moves = movedOrds.filter(m => m.toHR === machineFullHR || m.fromHR === machineFullHR).length;
    addNotification('success', `Ajuste aceptado para ${machineName}: ${moves} ${moves === 1 ? 'orden redistribuida' : 'órdenes redistribuidas'}. Ver pestaña Plan Final.`);
  }, [techFilteredOrdenes, addNotification]);

  // ─── PROCESO DE BASES (COSEDORA-BSC-CC + COSEDORA-BSCTP) ────────────────
  // Procesos independientes — sin redistribución entre máquinas
  const handleBscAdjust = useCallback(() => {
    if (isBscAdjustActive) { setIsBscAdjustActive(false); setBscAcceptedMachines(new Set()); setBscMovedOrders([]); setPlanFinalOrders(prev => prev.filter(o => !String(o._source || '').startsWith('bsc-'))); return; }
    setBscMovedOrders([]);
    setIsBscAdjustActive(true);
  }, [isBscAdjustActive]);

  const bscAdjustSummary = useMemo(() => {
    if (!isBscAdjustActive) return null;
    const puestos = uniquePuestos.filter(p => p.toUpperCase() === 'COSEDORA-BSC-CC' || p.toUpperCase() === 'COSEDORA-BSCTP');
    return buildGroupCapSummary(puestos, bscMovedOrders);
  }, [isBscAdjustActive, bscMovedOrders, uniquePuestos, buildGroupCapSummary]);

  const handleAcceptBscForMachine = useCallback((hr: string, name: string) =>
    acceptGroupAdjust(hr, name, 'bsc', bscAdjustSummary, bscAcceptedMachines, setBscAcceptedMachines, bscMovedOrders),
  [acceptGroupAdjust, bscAdjustSummary, bscAcceptedMachines, bscMovedOrders]);

  // ─── PROCESO DE INTERIORES (COSEDORA-INTPF + INTPR + INTPT) ─────────────
  // Procesos independientes — sin redistribución. INTPF es prerequisito de INTPR e INTPT.
  const handleIntpfAdjust = useCallback(() => {
    if (isIntpfAdjustActive) { setIsIntpfAdjustActive(false); setIntpfAcceptedMachines(new Set()); setIntpfMovedOrders([]); setPlanFinalOrders(prev => prev.filter(o => !String(o._source || '').startsWith('intpf-'))); return; }
    setIntpfMovedOrders([]);
    setIsIntpfAdjustActive(true);
  }, [isIntpfAdjustActive]);

  const intpfAdjustSummary = useMemo(() => {
    if (!isIntpfAdjustActive) return null;
    const puestos = uniquePuestos.filter(p => p.toUpperCase() === 'COSEDORA-INTPF' || p.toUpperCase() === 'COSEDORA-INTPR' || p.toUpperCase() === 'COSEDORA-INTPT');
    return buildGroupCapSummary(puestos, intpfMovedOrders);
  }, [isIntpfAdjustActive, intpfMovedOrders, uniquePuestos, buildGroupCapSummary]);

  // Análisis de dependencias bidireccional INTPF ↔ INTPR / INTPT
  const intpfDependencyData = useMemo(() => {
    if (!isIntpfAdjustActive) return null;

    const intpfPuesto = uniquePuestos.find(p => p.toUpperCase() === 'COSEDORA-INTPF');
    const intprPuesto = uniquePuestos.find(p => p.toUpperCase() === 'COSEDORA-INTPR');
    const intptPuesto = uniquePuestos.find(p => p.toUpperCase() === 'COSEDORA-INTPT');
    if (!intpfPuesto) return null;

    const getHR = (p: string) => mapToHojaRutaInternal(p).trim().toUpperCase();
    const intpfHR = getHR(intpfPuesto);
    const intprHR = intprPuesto ? getHR(intprPuesto) : '';
    const intptHR = intptPuesto ? getHR(intptPuesto) : '';

    // Órdenes de cada puesto
    const intpfOrders = techFilteredOrdenes.filter(o => String(o['MAQUINA'] || o['Maquina'] || '').trim().toUpperCase() === intpfHR);
    const intprOrders = intprHR ? techFilteredOrdenes.filter(o => String(o['MAQUINA'] || o['Maquina'] || '').trim().toUpperCase() === intprHR) : [];
    const intptOrders = intptHR ? techFilteredOrdenes.filter(o => String(o['MAQUINA'] || o['Maquina'] || '').trim().toUpperCase() === intptHR) : [];

    // Materiales de INTPF indexados por código normalizado
    const intpfMaterials = new Set(intpfOrders.map(o => normalizeMaterialCode(o['MATERIAL'] || o['CodMaterial'] || '')));
    const intpfOrdersByMat = new Map<string, any>();
    intpfOrders.forEach(o => intpfOrdersByMat.set(normalizeMaterialCode(o['MATERIAL'] || o['CodMaterial'] || ''), o));

    // Obtener componentes de un material desde listaMateriales
    const getComponents = (matCode: string): string[] =>
      listaMaterialesData
        .filter(item => normalizeMaterialCode(String(item['MATERIAL'] || item['Material'] || item['PADRE'] || '')) === matCode)
        .map(item => normalizeMaterialCode(String(item['COMPONENTE'] || item['Componente'] || item['HIJO'] || '')));

    // ── DIRECCIÓN HACIA ADELANTE: INTPR/INTPT que NECESITAN paso en INTPF ──
    const checkNeedsIntpf = (ord: any) => {
      const matCode = normalizeMaterialCode(ord['MATERIAL'] || ord['CodMaterial'] || '');
      return getComponents(matCode).some(comp => comp && intpfMaterials.has(comp));
    };
    const obligatoryIntpr = intprOrders.filter(checkNeedsIntpf);
    const obligatoryIntpt = intptOrders.filter(checkNeedsIntpf);

    // ── DIRECCIÓN INVERSA: órdenes de INTPF que NO hace falta producir
    //    porque su producto aguas abajo está en exceso (no se va a fabricar) ──
    const excessIntprKeys = new Set((intpfAdjustSummary?.machines.find(m => m.hrCode === intprHR)?.excessOrders || [])
      .map((o: any) => normalizeMaterialCode(o['MATERIAL'] || o['CodMaterial'] || '')));
    const excessIntptKeys = new Set((intpfAdjustSummary?.machines.find(m => m.hrCode === intptHR)?.excessOrders || [])
      .map((o: any) => normalizeMaterialCode(o['MATERIAL'] || o['CodMaterial'] || '')));

    // Para cada orden en exceso de INTPR/INTPT, buscar qué componente de INTPF quedó sin destino
    const unnecessaryIntpfOrders: { intpfOrder: any; causedByMat: string; causedByPuesto: string }[] = [];
    const addedIntpfMats = new Set<string>();

    const checkExcessDownstream = (excessMat: string, puesto: string) => {
      getComponents(excessMat).forEach(comp => {
        if (comp && intpfMaterials.has(comp) && !addedIntpfMats.has(comp)) {
          const intpfOrd = intpfOrdersByMat.get(comp);
          if (intpfOrd) {
            unnecessaryIntpfOrders.push({ intpfOrder: intpfOrd, causedByMat: excessMat, causedByPuesto: puesto });
            addedIntpfMats.add(comp);
          }
        }
      });
    };

    excessIntprKeys.forEach(mat => checkExcessDownstream(mat, 'COSEDORA-INTPR'));
    excessIntptKeys.forEach(mat => checkExcessDownstream(mat, 'COSEDORA-INTPT'));

    return {
      listaCargada: listaMaterialesData.length > 0,
      obligatoryIntpr,
      obligatoryIntpt,
      totalObligatory: obligatoryIntpr.length + obligatoryIntpt.length,
      unnecessaryIntpfOrders,
    };
  }, [isIntpfAdjustActive, intpfAdjustSummary, uniquePuestos, mapToHojaRutaInternal, techFilteredOrdenes, normalizeMaterialCode, listaMaterialesData]);

  const handleAcceptIntpfForMachine = useCallback((hr: string, name: string) =>
    acceptGroupAdjust(hr, name, 'intpf', intpfAdjustSummary, intpfAcceptedMachines, setIntpfAcceptedMachines, intpfMovedOrders),
  [acceptGroupAdjust, intpfAdjustSummary, intpfAcceptedMachines, intpfMovedOrders]);

  // ─── PROCESO TAPA SUPERIOR CHN (COSEDORA-TTCHN + COSEDORA-TTSUP-CHN — independientes) ───
  const handleTtchnAdjust = useCallback(() => {
    if (isTtchnAdjustActive) { setIsTtchnAdjustActive(false); setTtchnAcceptedMachines(new Set()); setTtchnMovedOrders([]); setPlanFinalOrders(prev => prev.filter(o => !String(o._source || '').startsWith('ttchn-'))); return; }
    setTtchnMovedOrders([]);
    setIsTtchnAdjustActive(true);
  }, [isTtchnAdjustActive]);

  const ttchnAdjustSummary = useMemo(() => {
    if (!isTtchnAdjustActive) return null;
    const puestos = uniquePuestos.filter(p => p.toUpperCase() === 'COSEDORA-TTCHN' || p.toUpperCase() === 'COSEDORA-TTSUP-CHN');
    return buildGroupCapSummary(puestos, ttchnMovedOrders);
  }, [isTtchnAdjustActive, ttchnMovedOrders, uniquePuestos, buildGroupCapSummary]);

  const handleAcceptTtchnForMachine = useCallback((hr: string, name: string) =>
    acceptGroupAdjust(hr, name, 'ttchn', ttchnAdjustSummary, ttchnAcceptedMachines, setTtchnAcceptedMachines, ttchnMovedOrders),
  [acceptGroupAdjust, ttchnAdjustSummary, ttchnAcceptedMachines, ttchnMovedOrders]);

  const renderGenericGroupPanel = (
    summary: ReturnType<typeof buildGroupCapSummary>,
    acceptedMachines: Set<string>,
    onAccept: (hr: string, name: string) => void,
    title: string,
    borderCls: string,
    bgCls: string,
    iconBgCls: string
  ) => {
    const allExcess = summary.machines.flatMap(m => m?.excessOrders || []);
    return (
      <div className={cn('border bg-white rounded-[2rem] p-8 shadow-md space-y-5', borderCls)}>
        <div className="flex items-center gap-3">
          <div className={cn('p-2.5 rounded-xl text-white shadow-md shrink-0', iconBgCls)}>
            <ClipboardList className="w-4 h-4" />
          </div>
          <h4 className="font-black text-slate-900 uppercase tracking-tight text-sm">Análisis de Capacidad — {title}</h4>
        </div>
        <div className={cn('border rounded-2xl p-5 text-[11px] space-y-4', bgCls)}>
          <div className="space-y-2">
            {summary.totalMoved > 0
              ? <p className="text-slate-700 leading-relaxed"><span className="font-black text-slate-800">↔ Se redistribuyeron {summary.totalMoved} {summary.totalMoved === 1 ? 'orden' : 'órdenes'}</span> entre las máquinas del grupo para equilibrar la carga operativa.</p>
              : <p className="text-slate-700 leading-relaxed"><span className="font-black text-slate-700">— Sin redistribución necesaria.</span> La carga está equilibrada entre las máquinas del grupo.</p>
            }
            {summary.machines.some(m => m && m.finalUtil > 100) && (
              <p className="text-slate-700 leading-relaxed">
                <span className="font-black text-red-600">⚠ {summary.machines.filter(m => m && m.finalUtil > 100).length} {summary.machines.filter(m => m && m.finalUtil > 100).length === 1 ? 'máquina supera' : 'máquinas superan'} la capacidad:</span>{' '}
                {allExcess.length} {allExcess.length === 1 ? 'orden no puede producirse' : 'órdenes no pueden producirse'} en el período. Se recomienda diferir al siguiente ciclo.
              </p>
            )}
            {summary.machines.some(m => m && m.finalUtil < 95 && m.finalUtil <= 100) && (
              <p className="text-slate-700 leading-relaxed">
                <span className="font-black text-amber-700">▲ {summary.machines.filter(m => m && m.finalUtil < 95).length} {summary.machines.filter(m => m && m.finalUtil < 95).length === 1 ? 'máquina está' : 'máquinas están'} debajo del objetivo (95%):</span> Tienen capacidad disponible sin utilizar.
              </p>
            )}
            {!summary.machines.some(m => m && m.finalUtil > 100) && !summary.machines.some(m => m && m.finalUtil < 95) && (
              <p className="text-slate-700 leading-relaxed"><span className="font-black text-green-700">✓ Todas las máquinas del grupo están en rango óptimo (95–100%) tras la redistribución.</span></p>
            )}
          </div>

          <div className="grid grid-cols-1 gap-3">
            {summary.machines.map(m => {
              if (!m) return null;
              const isAccepted = acceptedMachines.has(m.hrCode);
              return (
                <div key={m.hrCode} className="bg-white rounded-2xl p-4 border border-slate-100 shadow-sm space-y-2">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-[9px] font-black uppercase text-slate-400 tracking-widest">{m.name}</p>
                      <p className="text-[8px] font-mono text-slate-300">{m.hrCode}</p>
                    </div>
                    <div className="flex items-center gap-3">
                      <div className="text-right">
                        <div className="flex items-baseline gap-1">
                          <span className="text-slate-400 font-mono text-xs line-through">{m.origUtil.toFixed(0)}%</span>
                          <span className="mx-1 text-slate-300 text-xs">→</span>
                          <span className={cn('font-black text-2xl font-mono', m.realUtil > 100 ? 'text-red-600' : m.realUtil >= 95 ? 'text-green-600' : 'text-amber-600')}>{m.realUtil.toFixed(0)}%</span>
                        </div>
                        <p className="text-[8px] text-slate-400 font-black uppercase tracking-wider">ocupación real</p>
                      </div>
                      <Button
                        onClick={() => onAccept(m.hrCode, m.name)}
                        disabled={isAccepted}
                        className={cn('font-black uppercase tracking-widest text-[9px] px-4 py-2 rounded-xl shadow-sm shrink-0', isAccepted ? 'bg-green-100 text-green-700 border border-green-300 cursor-default' : 'bg-green-600 hover:bg-green-700 text-white')}
                      >
                        {isAccepted ? 'Aceptado ✓' : 'Aceptar Ajuste'}
                      </Button>
                    </div>
                  </div>
                  <div className="h-1.5 bg-slate-100 rounded-full overflow-hidden">
                    <div className={cn('h-full rounded-full', m.realUtil > 100 ? 'bg-red-500' : m.realUtil >= 95 ? 'bg-green-500' : 'bg-amber-400')} style={{ width: `${Math.min(m.realUtil, 100)}%` }} />
                  </div>
                  <div className="flex justify-between text-[9px] text-slate-400 font-mono">
                    <span>Cap: {m.cap.toFixed(1)} h</span>
                    <span>Producible: {m.producibleHours.toFixed(1)} h</span>
                    {m.excessHours > 0 && <span className="text-red-600 font-black">Exceso: {m.excessHours.toFixed(1)} h · {m.excessOrders.length} órd.</span>}
                    {m.movedIn > 0 && <span className="text-sky-600 font-black">+{m.movedIn} ingresaron</span>}
                    {m.movedOut > 0 && <span className="text-amber-600 font-black">-{m.movedOut} salieron</span>}
                  </div>
                  {m.excessOrders.length > 0 && (
                    <div className="mt-2 rounded-xl border border-red-200 bg-red-50/60 px-3 py-2 space-y-1">
                      <p className="text-[8px] font-black uppercase text-red-600 tracking-widest mb-1">Órdenes que no pueden producirse:</p>
                      {m.excessOrders.map((o: any, oi: number) => (
                        <div key={oi} className="flex justify-between text-[9px] font-mono text-red-800">
                          <span className="shrink-0">{o['MATERIAL'] || o['CodMaterial'] || '—'}</span>
                          <span className="truncate mx-2">{o['NOMBRE'] || o['TEXTOMATERIAL'] || '—'}</span>
                          <span className="font-black shrink-0">{Number(o['CANTIDAD'] || o['CANTPROGRAMADA'] || 0).toLocaleString()} uds</span>
                        </div>
                      ))}
                    </div>
                  )}
                  {/* Recomendaciones de turno y personal */}
                  {(() => {
                    const cfg = workstationConfigs[m.name] || { isDayActive: true, isNightActive: false, people: 0, machines: 1 };
                    const mc = cfg.machines || 1;
                    const dayH = horasNetasDiurnasVal * mc;
                    const nightH = horasNetasNocturnasVal * mc;
                    const shortage = m.finalHours - m.cap;
                    const free = m.cap - m.finalHours;
                    const personas = cfg.people || 0;
                    const turno = cfg.isNightActive ? 'diurno + nocturno' : 'diurno';

                    if (m.realUtil > 100) {
                      if (!cfg.isNightActive && nightH > 0) {
                        const newCap = m.cap + nightH;
                        const wouldFit = m.finalHours <= newCap;
                        const newUtil = ((m.finalHours / newCap) * 100).toFixed(0);
                        return (
                          <div className="rounded-xl bg-blue-50 border border-blue-200 px-3 py-2 space-y-1">
                            <p className="text-[8px] font-black uppercase text-blue-700 tracking-widest">Recomendación de turno</p>
                            <p className="text-[9px] text-blue-800 leading-relaxed">
                              💡 Activar <span className="font-black">turno nocturno</span> añade {nightH.toFixed(1)} h.{' '}
                              {wouldFit ? `Todas las órdenes cabrían — ocupación ${newUtil}%.` : `Ocupación bajaría a ${newUtil}% pero aún quedarían órdenes en exceso.`}
                            </p>
                            {personas > 0 && <p className="text-[9px] text-blue-600">Personal actual: <span className="font-black">{personas} operador{personas !== 1 ? 'es' : ''}</span>. Se necesitan para cubrir el turno nocturno.</p>}
                          </div>
                        );
                      }
                      if (cfg.isNightActive) {
                        const extraPeople = dayH > 0 ? Math.ceil(shortage / dayH) : 1;
                        return (
                          <div className="rounded-xl bg-orange-50 border border-orange-200 px-3 py-2 space-y-1">
                            <p className="text-[8px] font-black uppercase text-orange-700 tracking-widest">Recomendación de personal</p>
                            <p className="text-[9px] text-orange-800 leading-relaxed">
                              ⚠ Ambos turnos activos · <span className="font-black">{personas} operador{personas !== 1 ? 'es' : ''}</span>. Faltan <span className="font-black">{shortage.toFixed(1)} h</span>.{' '}
                              Añadir <span className="font-black">{extraPeople} operador{extraPeople !== 1 ? 'es' : ''} adicional{extraPeople !== 1 ? 'es' : ''}</span> cubriría el déficit, o diferir {m.excessOrders.length} orden{m.excessOrders.length !== 1 ? 'es' : ''} al siguiente ciclo.
                            </p>
                          </div>
                        );
                      }
                    }

                    if (m.realUtil >= 95 && m.realUtil <= 100) {
                      return (
                        <div className="rounded-xl bg-green-50 border border-green-200 px-3 py-2">
                          <p className="text-[9px] text-green-700 leading-relaxed">
                            ✓ Turno <span className="font-black">{turno}</span>{personas > 0 ? ` · ${personas} operador${personas !== 1 ? 'es' : ''}` : ''} — configuración óptima para este período.
                          </p>
                        </div>
                      );
                    }

                    if (m.realUtil < 95 && m.realUtil > 0) {
                      if (cfg.isNightActive && dayH > 0 && m.finalHours <= dayH) {
                        return (
                          <div className="rounded-xl bg-slate-50 border border-slate-200 px-3 py-2 space-y-1">
                            <p className="text-[8px] font-black uppercase text-slate-500 tracking-widest">Recomendación de turno</p>
                            <p className="text-[9px] text-slate-600 leading-relaxed">
                              💡 Las órdenes caben en <span className="font-black">solo turno diurno</span> ({(m.finalHours / dayH * 100).toFixed(0)}% del día).{' '}
                              Considera desactivar el turno nocturno{personas > 0 ? ` y liberar ${personas} operador${personas !== 1 ? 'es' : ''} para otras áreas` : ''}.
                            </p>
                          </div>
                        );
                      }
                      return (
                        <div className="rounded-xl bg-slate-50 border border-slate-200 px-3 py-2 space-y-1">
                          <p className="text-[8px] font-black uppercase text-slate-500 tracking-widest">Capacidad libre</p>
                          <p className="text-[9px] text-slate-600 leading-relaxed">
                            ▲ Sin usar: <span className="font-black">{free.toFixed(1)} h</span> · Turno {turno}{personas > 0 ? ` · ${personas} operador${personas !== 1 ? 'es' : ''}` : ''}.{' '}
                            Se puede asignar más producción o reducir la jornada.
                          </p>
                        </div>
                      );
                    }

                    return null;
                  })()}
                </div>
              );
            })}
          </div>

          {allExcess.length > 0 && (
            <div className="rounded-2xl border border-indigo-200 bg-indigo-50/40 px-4 py-3 space-y-2">
              <p className="text-[9px] font-black uppercase text-indigo-700 tracking-widest">Recomendación — Órdenes a no fabricar en este período</p>
              <p className="text-[10px] text-slate-600 leading-relaxed">
                Las siguientes {allExcess.length} {allExcess.length === 1 ? 'orden excede' : 'órdenes exceden'} la capacidad disponible incluso tras redistribuir.
                Se recomienda <span className="font-black text-indigo-700">diferir al siguiente ciclo</span> las de mayor cantidad primero.
              </p>
              <div className="space-y-1 mt-1">
                {[...allExcess].sort((a, b) => Number(b['CANTIDAD'] || b['CANTPROGRAMADA'] || 0) - Number(a['CANTIDAD'] || a['CANTPROGRAMADA'] || 0)).map((o: any, idx: number) => (
                  <div key={idx} className="flex justify-between text-[9px] font-mono px-2 py-1 rounded-lg text-slate-700">
                    <span className="shrink-0 font-black">{idx + 1}.</span>
                    <span className="shrink-0 mx-1">{o['MATERIAL'] || o['CodMaterial'] || '—'}</span>
                    <span className="truncate mx-2 flex-1">{o['NOMBRE'] || o['TEXTOMATERIAL'] || '—'}</span>
                    <span className="font-black shrink-0">{Number(o['CANTIDAD'] || o['CANTPROGRAMADA'] || 0).toLocaleString()} uds</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    );
  };

  const renderFertTableInternal = (orders: any[], summary: any[], title: string, date: string, setDate: (d: string) => void, color: string) => {
    const fertCols = [
      { id: 'CENTRO', key: 'Centro' },
      { id: 'ORDEN', key: 'ORDEN' },
      { id: 'MATERIAL', key: 'CodMaterial' },
      { id: 'NOMBRE', key: 'Material' },
      { id: 'CANTPROGRAMADA', key: 'CANTIDAD' },
      { id: 'FECHA', key: 'FECHA' },
      { id: 'RESPCTRLPROD', key: 'RESPCTRLPROD' }
    ];

    return (
      <Card className="rounded-[2.5rem] bg-white ring-1 ring-slate-100 overflow-hidden shadow-sm border-none">
        <CardHeader className={cn("text-white p-8", color)}>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <div className="bg-white/10 p-3 rounded-2xl text-white backdrop-blur-sm border border-white/10">
                <PackageSearch className="w-6 h-6" />
              </div>
              <div>
                <CardTitle className="text-2xl font-black uppercase tracking-tight">{title}</CardTitle>
                <CardDescription className="text-white/60 font-bold uppercase text-[10px] tracking-widest mt-1">
                  Carga Operativa FERT
                </CardDescription>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <div className="flex items-center bg-white/10 border border-white/20 rounded-lg px-3 py-1 gap-2">
                <CalendarIcon className="w-3.5 h-3.5 text-white" />
                <input 
                  type="date" 
                  value={date} 
                  onChange={(e) => setDate(e.target.value)}
                  className="bg-transparent border-none text-white text-[10px] font-bold focus:ring-0 outline-none p-0 cursor-pointer"
                />
              </div>
              <Badge className="bg-white text-slate-900 border-none font-mono font-black text-sm px-4 py-1.5 rounded-xl">{orders.length} REG</Badge>
            </div>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          <div className="overflow-x-auto max-h-[50vh]">
            {orders.length > 0 ? (
              <table className="w-full text-[11px] border-collapse">
                <thead className="bg-slate-100 sticky top-0 z-10 text-slate-600 text-left uppercase tracking-widest font-black">
                  <tr>
                    {fertCols.map((col) => (
                      <th key={col.id} className="px-6 py-4 whitespace-nowrap text-[10px] uppercase font-bold">{col.id}</th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {orders.map((order, i) => (
                    <tr key={i} className="hover:bg-indigo-50 transition-colors">
                      {fertCols.map((col) => {
                        let val = order[col.key] || order[col.id] || order[col.id.toLowerCase()];
                        if (col.id === 'MATERIAL' && val) {
                          val = normalizeMaterialCode(val); 
                        }
                        if (col.id === 'FECHA' && val) val = String(val).split('T')[0];
                        if (col.id === 'CANTPROGRAMADA' && val) val = Math.round(Number(val)).toLocaleString();
                        return (
                          <td key={col.id} className={cn(
                            "px-6 py-4 font-medium text-slate-600 whitespace-nowrap",
                            col.id === 'MATERIAL' && "font-mono font-bold",
                            col.id === 'CANTPROGRAMADA' && "text-right font-black text-slate-900",
                            col.id === 'NOMBRE' && "whitespace-normal break-words min-w-[250px]"
                          )}>{val ?? '—'}</td>
                        );
                      })}
                    </tr>
                    ))}
                </tbody>
              </table>
            ) : (
              <div className="py-20 text-center text-slate-400 uppercase font-black tracking-widest text-xs opacity-40">No hay registros para este centro</div>
            )}
          </div>
        </CardContent>
      </Card>
    );
  };

  if (!isMounted) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-slate-50">
        <Loader2 className="w-12 h-12 animate-spin text-indigo-600" />
      </div>
    );
  }

  return (
    <div className="p-6 md:p-8 space-y-6 bg-slate-50/40 min-h-screen font-body">
      <div className="flex flex-col gap-4 bg-white p-5 rounded-[2.5rem] border border-slate-100 shadow-xl max-w-7xl mx-auto overflow-hidden">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <div className="bg-slate-950 p-4 rounded-[1.5rem] text-white shadow-2xl ring-4 ring-slate-50 shrink-0">
              <CalendarClock className="w-6 h-6 text-sky-400" />
            </div>
            <div className="flex-1">
              <div className="flex items-center gap-3 mb-0.5">
                <h1 className="text-xl font-black text-slate-900 uppercase tracking-tighter leading-none text-nowrap">Programación Táctica</h1>
                <Badge className="bg-indigo-600 text-white font-black px-3 py-1 rounded-lg text-[9px] uppercase tracking-widest border-none shadow-md">Forros</Badge>
              </div>
              <div className="flex items-center gap-2 text-[9px] font-black text-slate-400 uppercase tracking-[0.25em]">
                <Users className="w-3 h-3 text-indigo-500" /> Eficiencia Operativa: 84%
              </div>
            </div>
          </div>

          <div className="flex gap-4">
            <div className="bg-slate-50 border border-slate-200/60 rounded-[1.5rem] p-3 flex items-center gap-3 shadow-sm hover:shadow-md transition-all">
              <div className="bg-indigo-600 p-2 rounded-xl text-white shadow-lg shadow-indigo-100 shrink-0">
                <CalendarIcon className="w-3.5 h-3.5" />
              </div>
              <div>
                <p className="text-[8px] font-black text-slate-400 uppercase tracking-widest mb-0.5">Planificación para</p>
                <p className="text-xs font-black text-indigo-900 capitalize leading-tight">
                  {planningDateFormatted}
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>

      <Tabs
        value={activeMainTab}
        className="w-full"
        onValueChange={(tabValue) => {
          setActiveMainTab(tabValue);
          if (!loadedTabs.has(tabValue)) {
            const newLoaded = new Set(loadedTabs);
            newLoaded.add(tabValue);
            setLoadedTabs(newLoaded);
            if ((tabValue === 'ordenes-fert' || tabValue === 'forros') && ordenesFert.length === 0) fetchOrdenesFert();
            else if (tabValue === 'lista-materiales' && listaMaterialesData.length === 0) fetchListaMateriales();
          }
        }}
      >
        <TabsList className="flex w-full h-auto bg-white border border-slate-200 p-2 rounded-[2rem] mb-10 shadow-sm overflow-x-auto justify-start">
          <TabsTrigger value="planes-grupo-ensamblado" className="px-6 py-3 data-[state=active]:bg-slate-950 data-[state=active]:text-white rounded-2xl transition-all text-[10px] font-black uppercase tracking-widest text-slate-500">
            <Boxes className="w-4 h-4 mr-2" /> PLANES GRUPO ENSAMBLADO
          </TabsTrigger>
          <TabsTrigger value="personal-turnos" className="px-6 py-3 data-[state=active]:bg-slate-950 data-[state=active]:text-white rounded-2xl transition-all text-[10px] font-black uppercase tracking-widest text-slate-500">
            <UserPlus className="w-4 h-4 mr-2" /> Personal & Turnos
          </TabsTrigger>
          <TabsTrigger value="resumen-produccion" className="px-6 py-3 data-[state=active]:bg-slate-950 data-[state=active]:text-white rounded-2xl transition-all text-[10px] font-black uppercase tracking-widest text-slate-500">
            <BarChart3 className="w-4 h-4 mr-2" /> Resumen
          </TabsTrigger>
          <TabsTrigger value="acolchado-tapas" className="px-6 py-3 data-[state=active]:bg-slate-950 data-[state=active]:text-white rounded-2xl transition-all text-[10px] font-black uppercase tracking-widest text-slate-500">
            <Cpu className="w-4 h-4 mr-2" /> 1. Acolchado & Tapas
          </TabsTrigger>
          <TabsTrigger value="bandas" className="px-6 py-3 data-[state=active]:bg-slate-950 data-[state=active]:text-white rounded-2xl transition-all text-[10px] font-black uppercase tracking-widest text-slate-500">
            <Layers className="w-4 h-4 mr-2" /> 2. Proceso Bandas
          </TabsTrigger>
          <TabsTrigger value="interiores-corte" className="px-6 py-3 data-[state=active]:bg-slate-950 data-[state=active]:text-white rounded-2xl transition-all text-[10px] font-black uppercase tracking-widest text-slate-500">
            <Settings2 className="w-4 h-4 mr-2" /> 3. Interiores & Corte
          </TabsTrigger>
          <TabsTrigger value="forros" className="px-6 py-3 data-[state=active]:bg-slate-950 data-[state=active]:text-white rounded-2xl transition-all text-[10px] font-black uppercase tracking-widest text-slate-500">
            <LayoutGrid className="w-4 h-4 mr-2" /> 4. Forros Finales
          </TabsTrigger>
          <TabsTrigger value="plan-final" className="px-6 py-3 data-[state=active]:bg-slate-950 data-[state=active]:text-white rounded-2xl transition-all text-[10px] font-black uppercase tracking-widest text-slate-500">
            <TableIcon className="w-4 h-4 mr-2" /> Plan Final
          </TabsTrigger>
          <TabsTrigger value="ordenes-fert" className="px-6 py-3 data-[state=active]:bg-slate-950 data-[state=active]:text-white rounded-2xl transition-all text-[10px] font-black uppercase tracking-widest text-slate-500">
            <PackageSearch className="w-4 h-4 mr-2" /> Órdenes FERT
          </TabsTrigger>
          <TabsTrigger value="ordenes-previsionales" className="px-6 py-3 data-[state=active]:bg-slate-950 data-[state=active]:text-white rounded-2xl transition-all text-[10px] font-black uppercase tracking-widest text-slate-500">
            <SearchCode className="w-4 h-4 mr-2" /> Órdenes Previsionales
          </TabsTrigger>
          <TabsTrigger value="lista-materiales" className="px-6 py-3 data-[state=active]:bg-slate-950 data-[state=active]:text-white rounded-2xl transition-all text-[10px] font-black uppercase tracking-widest text-slate-500">
            <ListTree className="w-4 h-4 mr-2" /> LISTA DE MATERIALES
          </TabsTrigger>
          <TabsTrigger value="kpi-tiempos" className="px-6 py-3 data-[state=active]:bg-slate-950 data-[state=active]:text-white rounded-2xl transition-all text-[10px] font-black uppercase tracking-widest text-slate-500">
            <ClipboardList className="w-4 h-4 mr-2" /> KPI TIEMPOS
          </TabsTrigger>
        </TabsList>

        <TabsContent value="resumen-produccion">
          {renderDateFilterHeaderInternal()}

          <Card className="rounded-[2.5rem] bg-white ring-1 ring-slate-100 overflow-hidden shadow-sm">
            <CardHeader className="bg-slate-50/50 border-b border-slate-200 p-10">
              <CardTitle className="text-2xl font-black text-slate-900 uppercase">Salud de Planta (Órdenes Previsionales)</CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              <div className="overflow-x-auto">
                <table className="w-full text-[12px] border-collapse">
                  <thead className="bg-slate-900 text-white text-left uppercase tracking-widest font-black">
                    <tr>
                      <th className="px-8 py-5">Puesto de Trabajo</th>
                      <th className="px-8 py-5 text-sky-400">HOJA DE RUTA</th>
                      <th className="px-8 py-5 text-right">Cant. Total</th>
                      <th className="px-8 py-5 text-right bg-indigo-950/20">T. Requerido (h)</th>
                      <th className="px-8 py-5 text-right">Capacidad (h)</th>
                      <th className="px-8 py-5 text-center min-w-[200px]">% Ocupación</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {(() => {
                      const hrGroups = new Map<string, { name: string, puestos: string[] }>();
                      uniquePuestos.forEach(p => {
                        const hr = mapToHojaRutaInternal(p) || 'S/HR';
                        if (!hrGroups.has(hr)) {
                          hrGroups.set(hr, { name: p, puestos: [] });
                        }
                        hrGroups.get(hr)!.puestos.push(p);
                      });

                      return Array.from(hrGroups.entries()).map(([hrCodeFromMaestro, groupInfo], idx) => {
                        const orders = techFilteredOrdenes.filter(o => {
                          const orderHR = String(o['MAQUINA'] || o['Maquina'] || '').trim().toUpperCase();
                          if (hrCodeFromMaestro.includes(' / ')) {
                            const codes = hrCodeFromMaestro.split(' / ').map(c => c.trim().toUpperCase());
                            return codes.includes(orderHR);
                          }
                          return orderHR === hrCodeFromMaestro;
                        });

                        const totalUnits = orders.reduce((sum, o) => sum + Number(o['CANTIDAD'] || o['CANTPROGRAMADA'] || 0), 0);
                        const totalTimeHours = orders.reduce((sum, o) => sum + calculateProductionTime(o['MATERIAL'] || o['CodMaterial'] || '', Number(o['CANTIDAD'] || o['CANTPROGRAMADA'] || 0), o), 0) / 3600;
                        
                        let totalCapacityHours = 0;
                        groupInfo.puestos.forEach(p => {
                          const config = workstationConfigs[p] || { machine: p, isDayActive: true, isNightActive: false, people: 0, machines: 1 };
                          const stationHours = (config.isDayActive ? horasNetasDiurnasVal : 0) + (config.isNightActive ? horasNetasNocturnasVal : 0);
                          totalCapacityHours += stationHours * (config.machines || 1);
                        });

                        const utilization = totalCapacityHours > 0 ? (totalTimeHours / totalCapacityHours) * 100 : 0;
                        const isUnified = groupInfo.puestos.length > 1;
                        const displayName = isUnified ? `${groupInfo.name} (POOL)` : groupInfo.name;
                        
                        return (
                          <tr key={idx} className="hover:bg-slate-50 transition-all">
                            <td className="px-8 py-5 font-black text-slate-900 uppercase whitespace-nowrap">{displayName}</td>
                            <td className="px-8 py-5 font-mono font-black text-indigo-700 uppercase whitespace-nowrap">
                              <Badge className="bg-indigo-50 text-indigo-700 border-indigo-200 font-bold px-3 py-1 rounded-lg">
                                {hrCodeFromMaestro}
                              </Badge>
                            </td>
                            <td className="px-8 py-5 text-right font-mono font-black text-slate-800">{totalUnits.toLocaleString()}</td>
                            <td className="px-8 py-5 text-right font-mono font-black text-indigo-700 bg-indigo-50/40">{totalTimeHours.toFixed(2)}h</td>
                            <td className="px-8 py-5 text-right font-mono font-bold text-slate-900">{totalCapacityHours.toFixed(2)}h</td>
                            <td className="px-8 py-5 text-center">
                               <div className="flex flex-col items-center justify-center gap-1">
                                 <div className="flex items-center justify-center gap-3 w-full">
                                   <div className="flex-1 bg-slate-100 h-2.5 rounded-full overflow-hidden border border-slate-200 shadow-inner">
                                     <div 
                                       className={cn(
                                         "h-full transition-all duration-500", 
                                         utilization > 100 ? "bg-red-500 shadow-[0_0_8px_rgba(239,68,68,0.3)]" : 
                                         utilization >= 90 ? "bg-green-500" : 
                                         "bg-yellow-400"
                                       )} 
                                       style={{ width: `${Math.min(utilization, 100)}%` }} 
                                     />
                                   </div>
                                   <span className={cn(
                                     "font-mono font-black text-[10px] min-w-[35px] text-right", 
                                     utilization > 100 ? "text-red-600" : 
                                     utilization >= 90 ? "text-green-700" : 
                                     "text-yellow-600"
                                   )}>
                                     {utilization.toFixed(0)}%
                                   </span>
                                 </div>
                               </div>
                            </td>
                          </tr>
                        );
                      });
                    })()}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="acolchado-tapas" className="space-y-6 pb-20">
          {renderDateFilterHeaderInternal()}

          {/* Botón de Consolidación ACH */}
          <div className="flex justify-end mb-6">
            <Button 
              onClick={handleConsolidateAcolchado}
              className={cn(
                "font-black uppercase tracking-widest text-[10px] px-8 py-6 rounded-3xl shadow-xl border-2 flex items-center gap-3 transition-all",
                isAchConsolidated 
                  ? "bg-indigo-600 text-white border-indigo-700" 
                  : "bg-indigo-900 hover:bg-slate-900 text-sky-400 border-indigo-500/30"
              )}
            >
              <Layers className="w-5 h-5" />
              {isAchConsolidated ? 'Ver Detalle Acolchado' : 'Consolidar Carga de Acolchado'}
            </Button>
          </div>

          {['02', '06', '07', '08', '09', '10', '13'].map(suffix => {
            const achNames = uniquePuestos.filter(p => p.includes(`ACH${suffix}`) || p.includes(`ACOLCHADORA${suffix}`));
            const pefNames = uniquePuestos.filter(p => p.includes(`PEF${suffix}`) || p.includes(`COSEDORA-ACH${suffix}`) || p.includes(`PEGADORA${suffix}`));
            if (achNames.length === 0 && pefNames.length === 0) return null;
            return (
              <div key={suffix} className="space-y-6">
                <div className="flex items-center gap-4 px-7 py-2.5 bg-slate-900 rounded-full w-fit shadow-xl">
                  <div className="w-2 h-2 rounded-full bg-sky-400 animate-pulse" />
                  <span className="text-white font-black text-xs uppercase tracking-[0.3em]">Célula Twin {suffix}</span>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-10">
                  {achNames.length > 0 && (
                    <MachineCard 
                      puestoName={achNames[0]} 
                      orders={techFilteredOrdenes}
                      calculateProductionTime={calculateProductionTime}
                      config={workstationConfigs[achNames[0]] || { machine: achNames[0], isDayActive: true, isNightActive: false, people: 0, machines: 1 }}
                      horasNetasDiurnas={horasNetasDiurnasVal}
                      horasNetasNocturnas={horasNetasNocturnasVal}
                      mapToHojaRuta={mapToHojaRutaInternal}
                      normalizeMaterialCode={normalizeMaterialCode}
                      isConsolidated={isAchConsolidated}
                    />
                  )}
                  {pefNames.length > 0 && (
                    <MachineCard 
                      puestoName={pefNames[0]} 
                      orders={techFilteredOrdenes}
                      calculateProductionTime={calculateProductionTime}
                      config={workstationConfigs[pefNames[0]] || { machine: pefNames[0], isDayActive: true, isNightActive: false, people: 0, machines: 1 }}
                      horasNetasDiurnas={horasNetasDiurnasVal}
                      horasNetasNocturnas={horasNetasNocturnasVal}
                      mapToHojaRuta={mapToHojaRutaInternal}
                      normalizeMaterialCode={normalizeMaterialCode}
                    />
                  )}
                </div>
              </div>
            );
          })}

          {uniquePuestos.filter(p => p.includes('COSEDORA-ACH11') || p.includes('COSEDORA-ACH12')).length > 0 && (
            <div className="space-y-6">
              <div className="flex items-center gap-4 px-7 py-2.5 bg-slate-900 rounded-full w-fit shadow-xl">
                <div className="w-2 h-2 rounded-full bg-sky-400 animate-pulse" />
                <span className="text-white font-black text-xs uppercase tracking-[0.3em]">Cosedoras Adicionales</span>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-10">
                {uniquePuestos.filter(p => p.includes('COSEDORA-ACH11') || p.includes('COSEDORA-ACH12')).map((pName) => (
                  <MachineCard
                    key={pName}
                    puestoName={pName}
                    orders={techFilteredOrdenes}
                    calculateProductionTime={calculateProductionTime}
                    config={workstationConfigs[pName] || { machine: pName, isDayActive: true, isNightActive: false, people: 0, machines: 1 }}
                    horasNetasDiurnas={horasNetasDiurnasVal}
                    horasNetasNocturnas={horasNetasNocturnasVal}
                    mapToHojaRuta={mapToHojaRutaInternal}
                    normalizeMaterialCode={normalizeMaterialCode}
                  />
                ))}
              </div>
            </div>
          )}
        </TabsContent>

        <TabsContent value="bandas" className="space-y-6 pb-20">
          {renderDateFilterHeaderInternal()}

          {/* Sección: Acolchadora de Bandas */}
          <div className="flex items-center justify-between px-7 py-3 bg-slate-900 rounded-full shadow-xl">
            <div className="flex items-center gap-4">
              <div className="w-2 h-2 rounded-full bg-sky-400 animate-pulse" />
              <span className="text-white font-black text-xs uppercase tracking-[0.3em]">Acolchadora de Bandas</span>
            </div>
            <Button
              onClick={handleAcolchadoraBandAdjust}
              className={cn(
                'font-black uppercase tracking-widest text-[10px] px-5 py-2 rounded-2xl shadow-lg flex items-center gap-2',
                isBandAdjustActive
                  ? 'bg-red-600 hover:bg-red-700 text-white'
                  : 'bg-indigo-600 hover:bg-indigo-700 text-white'
              )}
            >
              <Layers className="w-4 h-4" /> {isBandAdjustActive ? 'Revertir Ajuste' : 'Ajuste de Producción'}
            </Button>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-10">
            {uniquePuestos.filter(p =>
              p.includes('ACOLCHADORA11') ||
              p.includes('ACOLCHADORA12') ||
              (p.includes('ACH11') && !p.includes('COSEDORA')) ||
              (p.includes('ACH12') && !p.includes('COSEDORA'))
            ).map((pName) => {
              const isACH11 = pName.includes('11');
              const isACH12 = pName.includes('12');
              return (
                <MachineCard
                  key={pName}
                  puestoName={pName}
                  small
                  orders={techFilteredOrdenes}
                  calculateProductionTime={calculateProductionTime}
                  config={workstationConfigs[pName] || { machine: pName, isDayActive: true, isNightActive: false, people: 0, machines: 1 }}
                  horasNetasDiurnas={horasNetasDiurnasVal}
                  horasNetasNocturnas={horasNetasNocturnasVal}
                  mapToHojaRuta={mapToHojaRutaInternal}
                  normalizeMaterialCode={normalizeMaterialCode}
                  adjustedInOrders={isACH11 && isBandAdjustActive ? achBandAdjustedOrders : undefined}
                  excludeOrderKeys={isACH12 && isBandAdjustActive ? achBandAdjustedKeys : undefined}
                  splitRemainderOrders={isACH12 && isBandAdjustActive ? achBandSplitRemainders : undefined}
                />
              );
            })}
          </div>

          {/* Panel de observaciones del ajuste */}
          {isBandAdjustActive && bandAdjustSummary && (
            <div className="border border-amber-200 bg-white rounded-[2rem] p-8 shadow-md space-y-5">
              <div className="flex items-center gap-3">
                <div className="bg-amber-500 p-2.5 rounded-xl text-white shadow-md shrink-0">
                  <ClipboardList className="w-4 h-4" />
                </div>
                <h4 className="font-black text-slate-900 uppercase tracking-tight text-sm">Resumen del Ajuste de Producción</h4>
              </div>

              <div className="bg-amber-50 border border-amber-100 rounded-2xl p-5 text-[11px] space-y-4">
                {bandAdjustSummary.movedCount > 0 ? (
                  <p className="text-slate-700 leading-relaxed">
                    Se trasladaron{' '}
                    <span className="font-black text-red-600">{bandAdjustSummary.movedCount} {bandAdjustSummary.movedCount === 1 ? 'orden' : 'órdenes'}</span>
                    {' '}({bandAdjustSummary.movedHours.toFixed(2)} h) desde{' '}
                    <span className="font-mono font-black text-slate-800">{bandAdjustSummary.ach12Name}</span> hacia{' '}
                    <span className="font-mono font-black text-slate-800">{bandAdjustSummary.ach11Name}</span>{' '}
                    para equilibrar la carga operativa al nivel más cercano al 95%.
                    {bandAdjustSummary.splitCount > 0 && (
                      <>
                        {' '}Se incluye{' '}
                        <span className="font-black text-violet-600">{bandAdjustSummary.splitCount} orden{bandAdjustSummary.splitCount === 1 ? '' : 'es'} dividida{bandAdjustSummary.splitCount === 1 ? '' : 's'} (✂)</span>
                        {': '}al ser demasiado grande para moverse completa, solo una parte se reasigna y el remanente permanece en {bandAdjustSummary.ach12Name}.
                      </>
                    )}
                  </p>
                ) : (
                  <p className="text-slate-700 leading-relaxed">
                    <span className="font-black text-amber-700">No fue posible reasignar órdenes automáticamente.</span>{' '}
                    Las órdenes de{' '}
                    <span className="font-mono font-black text-slate-800">{bandAdjustSummary.ach12Name}</span>{' '}
                    son individualmente demasiado grandes — moverlas cruzaría el equilibrio entre ambas máquinas.
                    Se muestra el estado actual de ocupación para revisión manual.
                  </p>
                )}

                <div className="grid grid-cols-2 gap-4">
                  {[
                    { name: bandAdjustSummary.ach11Name, orig: bandAdjustSummary.origUtil11, next: bandAdjustSummary.newUtil11 },
                    { name: bandAdjustSummary.ach12Name, orig: bandAdjustSummary.origUtil12, next: bandAdjustSummary.newUtil12 },
                  ].map(({ name, orig, next }) => (
                    <div key={name} className="bg-white rounded-2xl p-4 border border-slate-100 shadow-sm">
                      <p className="text-[9px] font-black uppercase text-slate-400 tracking-widest mb-2">{name}</p>
                      <div className="flex items-center gap-3">
                        <span className="text-slate-400 line-through font-mono text-sm">{orig.toFixed(0)}%</span>
                        <span className="text-slate-400">→</span>
                        <span className={cn(
                          'font-black text-2xl font-mono',
                          next > 100 ? 'text-red-600' : next >= 95 ? 'text-green-600' : 'text-amber-600'
                        )}>{next.toFixed(0)}%</span>
                      </div>
                      <div className="mt-2 h-1.5 bg-slate-100 rounded-full overflow-hidden">
                        <div
                          className={cn('h-full rounded-full', next > 100 ? 'bg-red-500' : next >= 95 ? 'bg-green-500' : 'bg-amber-400')}
                          style={{ width: `${Math.min(next, 100)}%` }}
                        />
                      </div>
                    </div>
                  ))}
                </div>

                <div className="space-y-2 pt-1">
                  <p className="text-[9px] font-black uppercase text-slate-500 tracking-widest">Recomendaciones</p>
                  {[
                    { name: bandAdjustSummary.ach11Name, next: bandAdjustSummary.newUtil11 },
                    { name: bandAdjustSummary.ach12Name, next: bandAdjustSummary.newUtil12 },
                  ].map(({ name, next }) => {
                    const isLow = next < 95;
                    const isOver = next > 100;
                    return (
                      <div key={name} className={cn(
                        'rounded-xl px-4 py-3 border flex items-start gap-2.5 text-[10px] leading-relaxed',
                        isLow  ? 'bg-amber-100 border-amber-300 text-amber-900' :
                        isOver ? 'bg-red-50 border-red-200 text-red-900' :
                                 'bg-green-50 border-green-200 text-green-900'
                      )}>
                        <span className="font-black text-xs shrink-0 mt-0.5">
                          {isLow ? '▲' : isOver ? '▼' : '✓'}
                        </span>
                        <div>
                          <span className="font-black uppercase tracking-wide">{name}: </span>
                          {isLow && (
                            <span>
                              Ocupación <strong>{next.toFixed(0)}%</strong> — <strong>{(95 - next).toFixed(0)} p.p.</strong> por debajo del objetivo (95%).
                              Incrementar horas de turno reduciría aún más este porcentaje (mayor capacidad, misma carga).
                              Se recomienda <strong>asignar más órdenes</strong> a esta máquina o, si no hay carga disponible, <strong>reducir la jornada</strong> para ajustar la capacidad al trabajo real.
                            </span>
                          )}
                          {!isLow && !isOver && (
                            <span>
                              Ocupación <strong>{next.toFixed(0)}%</strong> — dentro del rango óptimo (95–100%). No se requieren ajustes de horario ni de carga.
                            </span>
                          )}
                          {isOver && (
                            <span>
                              Ocupación <strong>{next.toFixed(0)}%</strong> — <strong>{(next - 100).toFixed(0)} p.p.</strong> sobre la capacidad disponible.
                              Se recomienda <strong>incrementar la jornada diurna</strong> (extender a 10h u 11h) o <strong>activar turno nocturno</strong> para aumentar la capacidad y absorber la carga excedente.
                            </span>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              <div className="flex justify-end gap-3 pt-1">
                <Button
                  onClick={handleAcolchadoraBandAdjust}
                  className="bg-white hover:bg-red-50 text-red-600 border border-red-200 font-black uppercase tracking-widest text-[10px] px-6 py-3 rounded-2xl shadow-sm"
                >
                  Rechazar Ajuste
                </Button>
                <Button
                  onClick={handleAcceptAdjust}
                  disabled={isBandAdjustAccepted}
                  className={cn(
                    'font-black uppercase tracking-widest text-[10px] px-6 py-3 rounded-2xl shadow-lg',
                    isBandAdjustAccepted
                      ? 'bg-green-100 text-green-700 border border-green-300 cursor-default'
                      : 'bg-green-600 hover:bg-green-700 text-white'
                  )}
                >
                  {isBandAdjustAccepted ? 'Ajuste Aceptado ✓' : 'Aceptar Ajuste'}
                </Button>
              </div>
            </div>
          )}

          {/* Sección: Bordadora y Cosedoras de Banda */}
          <div className="flex items-center justify-between px-7 py-3 bg-slate-900 rounded-full shadow-xl">
            <div className="flex items-center gap-4">
              <div className="w-2 h-2 rounded-full bg-sky-400 animate-pulse" />
              <span className="text-white font-black text-xs uppercase tracking-[0.3em]">Bordadora y Cosedoras de Banda</span>
            </div>
            <Button
              onClick={handleBordadoraBandAdjust}
              className={cn(
                'font-black uppercase tracking-widest text-[10px] px-5 py-2 rounded-2xl shadow-lg flex items-center gap-2',
                isBordBandAdjustActive
                  ? 'bg-red-600 hover:bg-red-700 text-white'
                  : 'bg-indigo-600 hover:bg-indigo-700 text-white'
              )}
            >
              <Layers className="w-4 h-4" /> {isBordBandAdjustActive ? 'Revertir Ajuste' : 'Ajuste de Producción'}
            </Button>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-10">
            {uniquePuestos.filter(BORD_BAND_PUESTOS_FILTER).map((pName) => (
              <MachineCard
                key={pName}
                puestoName={pName}
                small
                orders={techFilteredOrdenes}
                calculateProductionTime={calculateProductionTime}
                config={workstationConfigs[pName] || { machine: pName, isDayActive: true, isNightActive: false, people: 0, machines: 1 }}
                horasNetasDiurnas={horasNetasDiurnasVal}
                horasNetasNocturnas={horasNetasNocturnasVal}
                mapToHojaRuta={mapToHojaRutaInternal}
                normalizeMaterialCode={normalizeMaterialCode}
                excessOrderKeys={isBordBandAdjustActive ? bordBandExcessKeys : undefined}
              />
            ))}
          </div>

          {/* Panel de observaciones Bordadora y Cosedoras de Banda */}
          {isBordBandAdjustActive && bordBandAdjustSummary && (
            <div className="border border-amber-200 bg-white rounded-[2rem] p-8 shadow-md space-y-5">
              <div className="flex items-center gap-3">
                <div className="bg-amber-500 p-2.5 rounded-xl text-white shadow-md shrink-0">
                  <ClipboardList className="w-4 h-4" />
                </div>
                <h4 className="font-black text-slate-900 uppercase tracking-tight text-sm">Análisis de Capacidad — Bordadora y Cosedoras de Banda</h4>
              </div>

              <div className="bg-amber-50 border border-amber-100 rounded-2xl p-5 text-[11px] space-y-4">
                {(() => {
                  const overMachines = bordBandAdjustSummary.machines.filter(m => m.utilization > 100);
                  const underMachines = bordBandAdjustSummary.machines.filter(m => m.utilization < 95);
                  const optimalMachines = bordBandAdjustSummary.machines.filter(m => m.utilization >= 95 && m.utilization <= 100);
                  return (
                    <div className="space-y-2">
                      {overMachines.length > 0 && (
                        <p className="text-slate-700 leading-relaxed">
                          <span className="font-black text-red-600">⚠ {overMachines.length} {overMachines.length === 1 ? 'máquina supera' : 'máquinas superan'} la capacidad:</span>{' '}
                          {bordBandAdjustSummary.totalExcessOrders} {bordBandAdjustSummary.totalExcessOrders === 1 ? 'orden' : 'órdenes'} no pueden producirse en el período. Se recomienda reprogramar o reasignar manualmente.
                        </p>
                      )}
                      {underMachines.length > 0 && (
                        <p className="text-slate-700 leading-relaxed">
                          <span className="font-black text-amber-700">▲ {underMachines.length} {underMachines.length === 1 ? 'máquina está' : 'máquinas están'} debajo del objetivo (95%):</span>{' '}
                          Tienen capacidad disponible sin utilizar. Se puede asignar más carga o reducir la jornada.
                        </p>
                      )}
                      {overMachines.length === 0 && underMachines.length === 0 && (
                        <p className="text-slate-700 leading-relaxed">
                          <span className="font-black text-green-700">✓ {optimalMachines.length === bordBandAdjustSummary.machines.length ? 'Todas las máquinas están en rango óptimo (95–100%).' : 'Sin alertas críticas.'}</span>
                        </p>
                      )}
                    </div>
                  );
                })()}

                <div className="grid grid-cols-1 gap-3">
                  {bordBandAdjustSummary.machines.map(m => {
                    const isAccepted = bordBandAcceptedMachines.has(m.hrCode);
                    return (
                      <div key={m.name} className="bg-white rounded-2xl p-4 border border-slate-100 shadow-sm space-y-2">
                        <div className="flex items-center justify-between">
                          <div>
                            <p className="text-[9px] font-black uppercase text-slate-400 tracking-widest">{m.name}</p>
                            <p className="text-[8px] font-mono text-slate-300">{m.hrCode}</p>
                          </div>
                          <div className="flex items-center gap-3">
                            <div className="text-right">
                              <span className={cn(
                                'font-black text-2xl font-mono',
                                m.utilization > 100 ? 'text-red-600' : m.utilization >= 95 ? 'text-green-600' : 'text-amber-600'
                              )}>{m.utilization.toFixed(0)}%</span>
                              <p className="text-[8px] text-slate-400 font-black uppercase tracking-wider">ocupación</p>
                            </div>
                            <Button
                              onClick={() => handleAcceptBordAdjustForMachine(m.hrCode, m.name, m.excessOrders.length)}
                              disabled={isAccepted}
                              className={cn(
                                'font-black uppercase tracking-widest text-[9px] px-4 py-2 rounded-xl shadow-sm shrink-0',
                                isAccepted
                                  ? 'bg-green-100 text-green-700 border border-green-300 cursor-default'
                                  : 'bg-green-600 hover:bg-green-700 text-white'
                              )}
                            >
                              {isAccepted ? 'Aceptado ✓' : 'Aceptar Ajuste'}
                            </Button>
                          </div>
                        </div>
                        <div className="h-1.5 bg-slate-100 rounded-full overflow-hidden">
                          <div
                            className={cn('h-full rounded-full', m.utilization > 100 ? 'bg-red-500' : m.utilization >= 95 ? 'bg-green-500' : 'bg-amber-400')}
                            style={{ width: `${Math.min(m.utilization, 100)}%` }}
                          />
                        </div>
                        <div className="flex justify-between text-[9px] text-slate-400 font-mono">
                          <span>Cap: {m.capacityHours.toFixed(1)} h</span>
                          <span>Total: {m.totalHours.toFixed(1)} h</span>
                          {m.excessHours > 0 && <span className="text-amber-600 font-black">Exceso: {m.excessHours.toFixed(1)} h · {m.excessOrders.length} órd.</span>}
                        </div>
                        {m.excessOrders.length > 0 && (
                          <div className="mt-2 rounded-xl border border-amber-200 bg-amber-50/60 px-3 py-2 space-y-1">
                            <p className="text-[8px] font-black uppercase text-amber-600 tracking-widest mb-1">Órdenes que no pueden producirse:</p>
                            {m.excessOrders.map((o, oi) => (
                              <div key={oi} className="flex justify-between text-[9px] font-mono text-amber-800">
                                <span>{o['MATERIAL'] || o['CodMaterial'] || '—'}</span>
                                <span>{o['NOMBRE'] || o['TEXTOMATERIAL'] || '—'}</span>
                                <span className="font-black">{Number(o['CANTIDAD'] || o['CANTPROGRAMADA'] || 0).toLocaleString()} uds</span>
                              </div>
                            ))}
                          </div>
                        )}
                        {(() => {
                          const cfg = workstationConfigs[m.name] || { isDayActive: true, isNightActive: false, people: 0, machines: 1 };
                          const mc = cfg.machines || 1;
                          const dayH = horasNetasDiurnasVal * mc;
                          const nightH = horasNetasNocturnasVal * mc;
                          const personas = cfg.people || 0;
                          const turno = cfg.isNightActive ? 'diurno + nocturno' : 'diurno';
                          const shortage = m.totalHours - m.capacityHours;
                          const free = m.capacityHours - m.totalHours;

                          if (m.utilization > 100) {
                            if (!cfg.isNightActive && nightH > 0) {
                              const newCap = m.capacityHours + nightH;
                              const wouldFit = m.totalHours <= newCap;
                              return (
                                <div className="rounded-xl bg-blue-50 border border-blue-200 px-3 py-2 space-y-1">
                                  <p className="text-[8px] font-black uppercase text-blue-700 tracking-widest">Recomendación de turno</p>
                                  <p className="text-[9px] text-blue-800 leading-relaxed">
                                    💡 Activar <span className="font-black">turno nocturno</span> añade {nightH.toFixed(1)} h.{' '}
                                    {wouldFit ? `Todas las órdenes cabrían — ocupación ${((m.totalHours / newCap) * 100).toFixed(0)}%.` : `Ocupación bajaría a ${((m.totalHours / newCap) * 100).toFixed(0)}% pero aún quedarían órdenes en exceso.`}
                                  </p>
                                  {personas > 0 && <p className="text-[9px] text-blue-600">Personal actual: <span className="font-black">{personas} operador{personas !== 1 ? 'es' : ''}</span>. Se necesitan para cubrir el turno nocturno.</p>}
                                </div>
                              );
                            }
                            if (cfg.isNightActive) {
                              const extraPeople = dayH > 0 ? Math.ceil(shortage / dayH) : 1;
                              return (
                                <div className="rounded-xl bg-orange-50 border border-orange-200 px-3 py-2 space-y-1">
                                  <p className="text-[8px] font-black uppercase text-orange-700 tracking-widest">Recomendación de personal</p>
                                  <p className="text-[9px] text-orange-800 leading-relaxed">
                                    ⚠ Ambos turnos activos · <span className="font-black">{personas} operador{personas !== 1 ? 'es' : ''}</span>. Faltan <span className="font-black">{shortage.toFixed(1)} h</span>.{' '}
                                    Añadir <span className="font-black">{extraPeople} operador{extraPeople !== 1 ? 'es' : ''} adicional{extraPeople !== 1 ? 'es' : ''}</span> o diferir {m.excessOrders.length} orden{m.excessOrders.length !== 1 ? 'es' : ''} al siguiente ciclo.
                                  </p>
                                </div>
                              );
                            }
                          }
                          if (m.utilization >= 95 && m.utilization <= 100) {
                            return (
                              <div className="rounded-xl bg-green-50 border border-green-200 px-3 py-2">
                                <p className="text-[9px] text-green-700 leading-relaxed">✓ Turno <span className="font-black">{turno}</span>{personas > 0 ? ` · ${personas} operador${personas !== 1 ? 'es' : ''}` : ''} — configuración óptima para este período.</p>
                              </div>
                            );
                          }
                          if (m.utilization < 95 && m.utilization > 0) {
                            if (cfg.isNightActive && dayH > 0 && m.totalHours <= dayH) {
                              return (
                                <div className="rounded-xl bg-slate-50 border border-slate-200 px-3 py-2 space-y-1">
                                  <p className="text-[8px] font-black uppercase text-slate-500 tracking-widest">Recomendación de turno</p>
                                  <p className="text-[9px] text-slate-600 leading-relaxed">
                                    💡 Las órdenes caben en <span className="font-black">solo turno diurno</span> ({(m.totalHours / dayH * 100).toFixed(0)}% del día).{' '}
                                    Considera desactivar el turno nocturno{personas > 0 ? ` y liberar ${personas} operador${personas !== 1 ? 'es' : ''} para otras áreas` : ''}.
                                  </p>
                                </div>
                              );
                            }
                            return (
                              <div className="rounded-xl bg-slate-50 border border-slate-200 px-3 py-2">
                                <p className="text-[9px] text-slate-600 leading-relaxed">
                                  ▲ Sin usar: <span className="font-black">{free.toFixed(1)} h</span> · Turno {turno}{personas > 0 ? ` · ${personas} operador${personas !== 1 ? 'es' : ''}` : ''}.{' '}
                                  Se puede asignar más producción o reducir la jornada.
                                </p>
                              </div>
                            );
                          }
                          return null;
                        })()}
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          )}

          {/* Sección: Cosedoras RMTB */}
          <div className="flex items-center justify-between px-7 py-3 bg-slate-900 rounded-full shadow-xl">
            <div className="flex items-center gap-4">
              <div className="w-2 h-2 rounded-full bg-sky-400 animate-pulse" />
              <span className="text-white font-black text-xs uppercase tracking-[0.3em]">Cosedoras RMTB</span>
            </div>
            <Button
              onClick={handleRmtbAdjust}
              className={cn(
                'font-black uppercase tracking-widest text-[10px] px-5 py-2 rounded-2xl shadow-lg flex items-center gap-2',
                isRmtbAdjustActive ? 'bg-red-600 hover:bg-red-700 text-white' : 'bg-indigo-600 hover:bg-indigo-700 text-white'
              )}
            >
              <Layers className="w-4 h-4" /> {isRmtbAdjustActive ? 'Revertir Ajuste' : 'Ajuste de Producción'}
            </Button>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-10">
            {uniquePuestos.filter(p => p.includes('RMTB')).map((pName) => {
              const hrCode = mapToHojaRutaInternal(pName).trim().toUpperCase();
              const isM = pName.toUpperCase().includes('RMTBM') || pName.toUpperCase().includes('RMTB-M');
              const makeKey = (o: any) => `${o['ORDEN'] || ''}|${String(o['MATERIAL'] || o['CodMaterial'] || '')}|${String(o['CANTIDAD'] || o['CANTPROGRAMADA'] || '')}`;
              const movedInOrders = isRmtbAdjustActive && !isM ? rmtbMovedOrders.filter(m => m.toHR === hrCode).map(m => m.order) : [];
              const excludeKeys = isRmtbAdjustActive && !isM ? new Set(rmtbMovedOrders.filter(m => m.fromHR === hrCode).map(m => makeKey(m.order))) : undefined;
              return (
                <MachineCard
                  key={pName}
                  puestoName={pName}
                  small
                  orders={techFilteredOrdenes}
                  calculateProductionTime={calculateProductionTime}
                  config={workstationConfigs[pName] || { machine: pName, isDayActive: true, isNightActive: false, people: 0, machines: 1 }}
                  horasNetasDiurnas={horasNetasDiurnasVal}
                  horasNetasNocturnas={horasNetasNocturnasVal}
                  mapToHojaRuta={mapToHojaRutaInternal}
                  normalizeMaterialCode={normalizeMaterialCode}
                  adjustedInOrders={movedInOrders}
                  excludeOrderKeys={excludeKeys}
                />
              );
            })}
          </div>

          {isRmtbAdjustActive && rmtbAdjustSummary && (
            <div className="border border-sky-200 bg-white rounded-[2rem] p-8 shadow-md space-y-5">
              <div className="flex items-center gap-3">
                <div className="bg-sky-600 p-2.5 rounded-xl text-white shadow-md shrink-0">
                  <ClipboardList className="w-4 h-4" />
                </div>
                <h4 className="font-black text-slate-900 uppercase tracking-tight text-sm">Análisis de Capacidad — Cosedoras RMTB</h4>
              </div>

              <div className="bg-sky-50 border border-sky-100 rounded-2xl p-5 text-[11px] space-y-4">
                {(() => {
                  const overMachines = rmtbAdjustSummary.machines.filter(m => m && m.finalUtil > 100);
                  const underMachines = rmtbAdjustSummary.machines.filter(m => m && m.finalUtil < 95);
                  const totalExcess = rmtbAdjustSummary.machines.reduce((s, m) => s + (m?.excessOrders.length || 0), 0);
                  return (
                    <div className="space-y-2">
                      {rmtbAdjustSummary.totalMoved > 0 && (
                        <p className="text-slate-700 leading-relaxed">
                          <span className="font-black text-sky-700">↔ Se redistribuyeron {rmtbAdjustSummary.totalMoved} {rmtbAdjustSummary.totalMoved === 1 ? 'orden' : 'órdenes'}</span>{' '}
                          entre COSEDORA-RMTB1, RMTB2 y RMTB3 para equilibrar la carga operativa.
                        </p>
                      )}
                      {overMachines.length > 0 && (
                        <p className="text-slate-700 leading-relaxed">
                          <span className="font-black text-red-600">⚠ {overMachines.length} {overMachines.length === 1 ? 'máquina supera' : 'máquinas superan'} la capacidad:</span>{' '}
                          {totalExcess} {totalExcess === 1 ? 'orden no puede producirse' : 'órdenes no pueden producirse'} en el período. Se recomienda reprogramar o dejar pendiente para el siguiente ciclo.
                        </p>
                      )}
                      {underMachines.length > 0 && (
                        <p className="text-slate-700 leading-relaxed">
                          <span className="font-black text-amber-700">▲ {underMachines.length} {underMachines.length === 1 ? 'máquina está' : 'máquinas están'} debajo del objetivo (95%):</span>{' '}
                          Tienen capacidad disponible sin utilizar. Se puede asignar más carga o reducir la jornada.
                        </p>
                      )}
                      {overMachines.length === 0 && underMachines.length === 0 && (
                        <p className="text-slate-700 leading-relaxed">
                          <span className="font-black text-green-700">✓ Todas las cosedoras RMTB están en rango óptimo (95–100%) tras la redistribución.</span>
                        </p>
                      )}
                    </div>
                  );
                })()}

                <div className="grid grid-cols-1 gap-3">
                  {rmtbAdjustSummary.machines.map(m => {
                    if (!m) return null;
                    const isAccepted = rmtbAcceptedMachines.has(m.hrCode);
                    return (
                      <div key={m.hrCode} className="bg-white rounded-2xl p-4 border border-slate-100 shadow-sm space-y-2">
                        <div className="flex items-center justify-between">
                          <div>
                            <p className="text-[9px] font-black uppercase text-slate-400 tracking-widest">{m.name}</p>
                            <p className="text-[8px] font-mono text-slate-300">{m.hrCode}</p>
                          </div>
                          <div className="flex items-center gap-3">
                            <div className="text-right">
                              <div className="flex items-baseline gap-1">
                                <span className="text-slate-400 font-mono text-xs line-through">{m.origUtil.toFixed(0)}%</span>
                                <span className="mx-1 text-slate-300 text-xs">→</span>
                                <span className={cn('font-black text-2xl font-mono', m.realUtil > 100 ? 'text-red-600' : m.realUtil >= 95 ? 'text-green-600' : 'text-amber-600')}>
                                  {m.realUtil.toFixed(0)}%
                                </span>
                              </div>
                              <p className="text-[8px] text-slate-400 font-black uppercase tracking-wider">ocupación real</p>
                            </div>
                            <Button
                              onClick={() => handleAcceptRmtbAdjustForMachine(m.hrCode, m.name)}
                              disabled={isAccepted}
                              className={cn(
                                'font-black uppercase tracking-widest text-[9px] px-4 py-2 rounded-xl shadow-sm shrink-0',
                                isAccepted
                                  ? 'bg-green-100 text-green-700 border border-green-300 cursor-default'
                                  : 'bg-green-600 hover:bg-green-700 text-white'
                              )}
                            >
                              {isAccepted ? 'Aceptado ✓' : 'Aceptar Ajuste'}
                            </Button>
                          </div>
                        </div>
                        <div className="h-1.5 bg-slate-100 rounded-full overflow-hidden">
                          <div
                            className={cn('h-full rounded-full', m.realUtil > 100 ? 'bg-red-500' : m.realUtil >= 95 ? 'bg-green-500' : 'bg-amber-400')}
                            style={{ width: `${Math.min(m.realUtil, 100)}%` }}
                          />
                        </div>
                        <div className="flex justify-between text-[9px] text-slate-400 font-mono">
                          <span>Cap: {m.cap.toFixed(1)} h</span>
                          <span>Producible: {m.producibleHours.toFixed(1)} h</span>
                          {m.excessHours > 0 && <span className="text-red-600 font-black">Exceso: {m.excessHours.toFixed(1)} h · {m.excessOrders.length} órd.</span>}
                          {m.movedIn > 0 && <span className="text-sky-600 font-black">+{m.movedIn} ingresaron</span>}
                          {m.movedOut > 0 && <span className="text-amber-600 font-black">-{m.movedOut} salieron</span>}
                        </div>
                        {m.excessOrders.length > 0 && (
                          <div className="mt-2 rounded-xl border border-red-200 bg-red-50/60 px-3 py-2 space-y-1">
                            <p className="text-[8px] font-black uppercase text-red-600 tracking-widest mb-1">Órdenes que no pueden producirse:</p>
                            {m.excessOrders.map((o: any, oi: number) => (
                              <div key={oi} className="flex justify-between text-[9px] font-mono text-red-800">
                                <span className="shrink-0">{o['MATERIAL'] || o['CodMaterial'] || '—'}</span>
                                <span className="truncate mx-2">{o['NOMBRE'] || o['TEXTOMATERIAL'] || '—'}</span>
                                <span className="font-black shrink-0">{Number(o['CANTIDAD'] || o['CANTPROGRAMADA'] || 0).toLocaleString()} uds</span>
                              </div>
                            ))}
                          </div>
                        )}
                        {(() => {
                          const cfg = workstationConfigs[m.name] || { isDayActive: true, isNightActive: false, people: 0, machines: 1 };
                          const mc = cfg.machines || 1;
                          const dayH = horasNetasDiurnasVal * mc;
                          const nightH = horasNetasNocturnasVal * mc;
                          const personas = cfg.people || 0;
                          const turno = cfg.isNightActive ? 'diurno + nocturno' : 'diurno';
                          const shortage = m.finalHours - m.cap;
                          const free = m.cap - m.finalHours;

                          if (m.realUtil > 100) {
                            if (!cfg.isNightActive && nightH > 0) {
                              const newCap = m.cap + nightH;
                              const wouldFit = m.finalHours <= newCap;
                              return (
                                <div className="rounded-xl bg-blue-50 border border-blue-200 px-3 py-2 space-y-1">
                                  <p className="text-[8px] font-black uppercase text-blue-700 tracking-widest">Recomendación de turno</p>
                                  <p className="text-[9px] text-blue-800 leading-relaxed">
                                    💡 Activar <span className="font-black">turno nocturno</span> añade {nightH.toFixed(1)} h.{' '}
                                    {wouldFit ? `Todas las órdenes cabrían — ocupación ${((m.finalHours / newCap) * 100).toFixed(0)}%.` : `Ocupación bajaría a ${((m.finalHours / newCap) * 100).toFixed(0)}% pero aún quedarían órdenes en exceso.`}
                                  </p>
                                  {personas > 0 && <p className="text-[9px] text-blue-600">Personal actual: <span className="font-black">{personas} operador{personas !== 1 ? 'es' : ''}</span>. Se necesitan para cubrir el turno nocturno.</p>}
                                </div>
                              );
                            }
                            if (cfg.isNightActive) {
                              const extraPeople = dayH > 0 ? Math.ceil(shortage / dayH) : 1;
                              return (
                                <div className="rounded-xl bg-orange-50 border border-orange-200 px-3 py-2 space-y-1">
                                  <p className="text-[8px] font-black uppercase text-orange-700 tracking-widest">Recomendación de personal</p>
                                  <p className="text-[9px] text-orange-800 leading-relaxed">
                                    ⚠ Ambos turnos activos · <span className="font-black">{personas} operador{personas !== 1 ? 'es' : ''}</span>. Faltan <span className="font-black">{shortage.toFixed(1)} h</span>.{' '}
                                    Añadir <span className="font-black">{extraPeople} operador{extraPeople !== 1 ? 'es' : ''} adicional{extraPeople !== 1 ? 'es' : ''}</span> o diferir {m.excessOrders.length} orden{m.excessOrders.length !== 1 ? 'es' : ''} al siguiente ciclo.
                                  </p>
                                </div>
                              );
                            }
                          }
                          if (m.realUtil >= 95 && m.realUtil <= 100) {
                            return (
                              <div className="rounded-xl bg-green-50 border border-green-200 px-3 py-2">
                                <p className="text-[9px] text-green-700 leading-relaxed">✓ Turno <span className="font-black">{turno}</span>{personas > 0 ? ` · ${personas} operador${personas !== 1 ? 'es' : ''}` : ''} — configuración óptima para este período.</p>
                              </div>
                            );
                          }
                          if (m.realUtil < 95 && m.realUtil > 0) {
                            if (cfg.isNightActive && dayH > 0 && m.finalHours <= dayH) {
                              return (
                                <div className="rounded-xl bg-slate-50 border border-slate-200 px-3 py-2 space-y-1">
                                  <p className="text-[8px] font-black uppercase text-slate-500 tracking-widest">Recomendación de turno</p>
                                  <p className="text-[9px] text-slate-600 leading-relaxed">
                                    💡 Las órdenes caben en <span className="font-black">solo turno diurno</span> ({(m.finalHours / dayH * 100).toFixed(0)}% del día).{' '}
                                    Considera desactivar el turno nocturno{personas > 0 ? ` y liberar ${personas} operador${personas !== 1 ? 'es' : ''} para otras áreas` : ''}.
                                  </p>
                                </div>
                              );
                            }
                            return (
                              <div className="rounded-xl bg-slate-50 border border-slate-200 px-3 py-2">
                                <p className="text-[9px] text-slate-600 leading-relaxed">
                                  ▲ Sin usar: <span className="font-black">{free.toFixed(1)} h</span> · Turno {turno}{personas > 0 ? ` · ${personas} operador${personas !== 1 ? 'es' : ''}` : ''}.{' '}
                                  Se puede asignar más producción o reducir la jornada.
                                </p>
                              </div>
                            );
                          }
                          return null;
                        })()}
                      </div>
                    );
                  })}
                </div>

                {/* Sección RMTBM */}
                {rmtbAdjustSummary.rmtbM && (() => {
                  const m = rmtbAdjustSummary.rmtbM as any;
                  const util = m.cap > 0 ? Math.min((m.finalHours / m.cap) * 100, 100) : 0;
                  const isOver = m.finalHours > m.cap;
                  return (
                    <div className="border border-slate-200 rounded-2xl p-4 space-y-3 bg-white">
                      {/* Encabezado */}
                      <div className="flex items-center justify-between">
                        <p className="text-[9px] font-black uppercase text-slate-500 tracking-widest">
                          {m.name} — Standalone (sin redistribución)
                        </p>
                        <span className={cn('text-[10px] font-black px-2 py-0.5 rounded-full', isOver ? 'bg-red-100 text-red-700' : 'bg-emerald-100 text-emerald-700')}>
                          {isOver ? '⚠ Excedida' : '✓ En capacidad'}
                        </span>
                      </div>

                      {/* Barra de capacidad */}
                      <div className="space-y-1">
                        <div className="flex justify-between text-[9px] font-mono text-slate-500">
                          <span>{m.finalHours.toFixed(2)} h carga</span>
                          <span className="font-black">{util.toFixed(0)}%</span>
                          <span>{m.cap.toFixed(2)} h cap.</span>
                        </div>
                        <div className="h-2 rounded-full bg-slate-100 overflow-hidden">
                          <div className={cn('h-full rounded-full transition-all', isOver ? 'bg-red-500' : 'bg-sky-500')} style={{ width: `${Math.min(util, 100)}%` }} />
                        </div>
                        {isOver && (
                          <p className="text-[9px] text-red-600 font-black">
                            +{(m.finalHours - m.cap).toFixed(2)} h en exceso · {m.excessOrders.length} {m.excessOrders.length === 1 ? 'orden' : 'órdenes'} no producible{m.excessOrders.length !== 1 ? 's' : ''}
                          </p>
                        )}
                      </div>

                      {/* Dependencias hacia adelante: RMTBM → RMTB3 obligatorio */}
                      {m.obligatoryRmtb3.length > 0 && (
                        <div className="rounded-xl border border-amber-200 bg-amber-50/60 px-3 py-2 space-y-1">
                          <p className="text-[8px] font-black uppercase text-amber-700 tracking-widest mb-1">
                            RMTB3 OBLIGATORIO · {m.obligatoryRmtb3.length} orden{m.obligatoryRmtb3.length !== 1 ? 'es' : ''}
                          </p>
                          {m.obligatoryRmtb3.map((o: any, idx: number) => (
                            <div key={idx} className="flex justify-between text-[9px] font-mono text-amber-800">
                              <span className="shrink-0 font-black">{o['MATERIAL'] || o['CodMaterial'] || '—'}</span>
                              <span className="truncate mx-2 flex-1">{o['NOMBRE'] || o['TEXTOMATERIAL'] || '—'}</span>
                              <span className="font-black shrink-0">{Number(o['CANTIDAD'] || o['CANTPROGRAMADA'] || 0).toLocaleString()} uds</span>
                            </div>
                          ))}
                        </div>
                      )}

                      {/* Cascada inversa: BANDA en RMTB3 liberada por exceso en RMTBM */}
                      {isOver && (
                        <div className="rounded-xl border border-rose-300 bg-rose-50/70 px-3 py-2 space-y-1">
                          <p className="text-[8px] font-black uppercase text-rose-700 tracking-widest mb-1">
                            BANDA EN RMTB3 LIBERADA POR EXCESO
                          </p>
                          {isLoadingRmtbmBOM ? (
                            <p className="text-[9px] text-rose-500 animate-pulse">Consultando lista de materiales…</p>
                          ) : rmtbmBandaLiberada.length > 0 ? (
                            <>
                              <p className="text-[8px] text-rose-600 mb-1 leading-snug">
                                El material terminado en exceso no se fabricará. <span className="font-black">Su BANDA componente tampoco necesita producirse en RMTB3.</span>
                              </p>
                              {rmtbmBandaLiberada.map((item, idx) => (
                                <div key={idx} className="flex flex-col gap-0.5 border-b border-rose-200 last:border-0 pb-1 last:pb-0">
                                  <div className="flex justify-between text-[9px] font-mono text-rose-900">
                                    <span className="shrink-0 font-black line-through opacity-60">{item.material}</span>
                                    <span className="truncate mx-2 flex-1 opacity-60">{item.nombre}</span>
                                    <span className="font-black shrink-0 opacity-60">{item.cantidad.toLocaleString()} uds</span>
                                  </div>
                                  <p className="text-[8px] text-rose-500 pl-1">
                                    ↳ exceso en RMTBM · mat: <span className="font-mono">{item.causedByMat}</span>
                                  </p>
                                </div>
                              ))}
                            </>
                          ) : (
                            <p className="text-[9px] text-rose-400">Sin componentes BANDA identificados en RMTB3 para los materiales en exceso.</p>
                          )}
                        </div>
                      )}
                    </div>
                  );
                })()}

                {/* Recomendación */}
                {(() => {
                  const allExcess = rmtbAdjustSummary.machines.flatMap(m => m?.excessOrders || []);
                  if (allExcess.length === 0) return null;
                  const rmtb3Obligatory = new Set(
                    rmtbAdjustSummary.rmtbM?.obligatoryRmtb3.map((o: any) => o['MATERIAL'] || o['CodMaterial'] || '') || []
                  );
                  const sortedExcess = [...allExcess].sort((a, b) =>
                    Number(b['CANTIDAD'] || b['CANTPROGRAMADA'] || 0) - Number(a['CANTIDAD'] || a['CANTPROGRAMADA'] || 0)
                  );
                  return (
                    <div className="rounded-2xl border border-indigo-200 bg-indigo-50/40 px-4 py-3 space-y-2">
                      <p className="text-[9px] font-black uppercase text-indigo-700 tracking-widest">Recomendación — Órdenes a no fabricar en este período</p>
                      <p className="text-[10px] text-slate-600 leading-relaxed">
                        Las siguientes {allExcess.length} {allExcess.length === 1 ? 'orden excede' : 'órdenes exceden'} la capacidad disponible incluso tras redistribuir.
                        Se recomienda <span className="font-black text-indigo-700">diferir al siguiente ciclo</span> las de mayor cantidad primero, priorizando liberar capacidad para las que tienen proceso obligatorio en RMTB3.
                      </p>
                      <div className="space-y-1 mt-1">
                        {sortedExcess.map((o: any, idx: number) => {
                          const matCode = o['MATERIAL'] || o['CodMaterial'] || '—';
                          const isObligatory = rmtb3Obligatory.has(matCode);
                          return (
                            <div key={idx} className={cn(
                              'flex justify-between text-[9px] font-mono px-2 py-1 rounded-lg',
                              isObligatory ? 'bg-amber-100 text-amber-900' : 'text-slate-700'
                            )}>
                              <span className="shrink-0 font-black">{idx + 1}.</span>
                              <span className="shrink-0 mx-1">{matCode}</span>
                              <span className="truncate mx-2 flex-1">{o['NOMBRE'] || o['TEXTOMATERIAL'] || '—'}</span>
                              <span className="font-black shrink-0">{Number(o['CANTIDAD'] || o['CANTPROGRAMADA'] || 0).toLocaleString()} uds</span>
                              {isObligatory && <span className="ml-2 text-amber-700 font-black shrink-0">⚠ RMTB3</span>}
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  );
                })()}
              </div>
            </div>
          )}
        </TabsContent>

        <TabsContent value="interiores-corte" className="space-y-6 pb-20">
          {renderDateFilterHeaderInternal()}

          {/* Otras máquinas de interiores (sin grupos de ajuste) */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-10">
            {uniquePuestos.filter(p =>
              (p.includes('INTP') ||
              p.includes('MTBS') ||
              p.includes('CT') ||
              p.includes('TTCF') ||
              p.includes('TTSUP') ||
              p.includes('TELAS') ||
              p.includes('FUNDAS') ||
              p.includes('BSC-CC') ||
              p.includes('BSCTP') ||
              p.includes('COSEDORA-INTPF') ||
              p.includes('COSEDORA-BSC-CC') ||
              p.includes('COSEDORA-INTPR') ||
              p.includes('COSEDORA-INTPT') ||
              p.includes('COSEDORA-TTSUP-CHN') ||
              p.includes('COSEDORA-TTCHN')) &&
              !p.toUpperCase().includes('CORTELA10') &&
              !p.toUpperCase().includes('CORTE-ESPUMA') &&
              !p.toUpperCase().includes('COSEDORA-BSC-CC') &&
              !p.toUpperCase().includes('COSEDORA-BSCTP') &&
              !p.toUpperCase().includes('COSEDORA-INTPF') &&
              !p.toUpperCase().includes('COSEDORA-INTPR') &&
              !p.toUpperCase().includes('COSEDORA-INTPT') &&
              !p.toUpperCase().includes('COSEDORA-TTCHN') &&
              !p.toUpperCase().includes('COSEDORA-TTSUP-CHN')
            ).map((pName) => (
              <MachineCard
                key={pName}
                puestoName={pName}
                small
                orders={techFilteredOrdenes}
                calculateProductionTime={calculateProductionTime}
                config={workstationConfigs[pName] || { machine: pName, isDayActive: true, isNightActive: false, people: 0, machines: 1 }}
                horasNetasDiurnas={horasNetasDiurnasVal}
                horasNetasNocturnas={horasNetasNocturnasVal}
                mapToHojaRuta={mapToHojaRutaInternal}
                normalizeMaterialCode={normalizeMaterialCode}
              />
            ))}
          </div>

          {/* Sección agrupada: Máquinas de Corte */}
          <div className="flex items-center justify-between px-7 py-3 bg-slate-900 rounded-full shadow-xl">
            <div className="flex items-center gap-4">
              <div className="w-2 h-2 rounded-full bg-amber-400 animate-pulse" />
              <span className="text-white font-black text-xs uppercase tracking-[0.3em]">Máquinas de Corte</span>
            </div>
            <Button
              onClick={handleCorteAdjust}
              className={cn(
                'font-black uppercase tracking-widest text-[10px] px-5 py-2 rounded-2xl shadow-lg flex items-center gap-2',
                isCorteAdjustActive ? 'bg-red-600 hover:bg-red-700 text-white' : 'bg-amber-600 hover:bg-amber-700 text-white'
              )}
            >
              <Layers className="w-4 h-4" /> {isCorteAdjustActive ? 'Revertir Ajuste' : 'Ajuste de Producción'}
            </Button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-10">
            {uniquePuestos.filter(p => p.toUpperCase().includes('CORTELA10') || p.toUpperCase() === 'CORTE-ESPUMA').map((pName) => {
              const hrCode = mapToHojaRutaInternal(pName).trim().toUpperCase();
              const makeKey = (o: any) => `${o['ORDEN'] || ''}|${String(o['MATERIAL'] || o['CodMaterial'] || '')}|${String(o['CANTIDAD'] || o['CANTPROGRAMADA'] || '')}`;
              const movedInOrders = isCorteAdjustActive ? corteMovedOrders.filter(m => m.toHR === hrCode).map(m => m.order) : [];
              const excludeKeys = isCorteAdjustActive ? new Set(corteMovedOrders.filter(m => m.fromHR === hrCode).map(m => makeKey(m.order))) : undefined;
              return (
                <MachineCard
                  key={pName}
                  puestoName={pName}
                  small
                  orders={techFilteredOrdenes}
                  calculateProductionTime={calculateProductionTime}
                  config={workstationConfigs[pName] || { machine: pName, isDayActive: true, isNightActive: false, people: 0, machines: 1 }}
                  horasNetasDiurnas={horasNetasDiurnasVal}
                  horasNetasNocturnas={horasNetasNocturnasVal}
                  mapToHojaRuta={mapToHojaRutaInternal}
                  normalizeMaterialCode={normalizeMaterialCode}
                  adjustedInOrders={movedInOrders}
                  excludeOrderKeys={excludeKeys}
                />
              );
            })}
          </div>

          {isCorteAdjustActive && corteAdjustSummary && renderGenericGroupPanel(corteAdjustSummary, corteAcceptedMachines, handleAcceptCorteAdjustForMachine, 'Máquinas de Corte', 'border-amber-200', 'bg-amber-50 border-amber-100', 'bg-amber-600')}

          {/* PROCESO DE BASES */}
          <div className="flex items-center justify-between px-7 py-3 bg-slate-900 rounded-full shadow-xl">
            <div className="flex items-center gap-4">
              <div className="w-2 h-2 rounded-full bg-teal-400 animate-pulse" />
              <span className="text-white font-black text-xs uppercase tracking-[0.3em]">Proceso de Bases</span>
            </div>
            <Button onClick={handleBscAdjust} className={cn('font-black uppercase tracking-widest text-[10px] px-5 py-2 rounded-2xl shadow-lg flex items-center gap-2', isBscAdjustActive ? 'bg-red-600 hover:bg-red-700 text-white' : 'bg-teal-600 hover:bg-teal-700 text-white')}>
              <Layers className="w-4 h-4" /> {isBscAdjustActive ? 'Revertir Ajuste' : 'Ajuste de Producción'}
            </Button>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-10">
            {uniquePuestos.filter(p => p.toUpperCase() === 'COSEDORA-BSC-CC' || p.toUpperCase() === 'COSEDORA-BSCTP').map((pName) => {
              const hrCode = mapToHojaRutaInternal(pName).trim().toUpperCase();
              const mk = (o: any) => `${o['ORDEN'] || ''}|${String(o['MATERIAL'] || o['CodMaterial'] || '')}|${String(o['CANTIDAD'] || o['CANTPROGRAMADA'] || '')}`;
              return (
                <MachineCard key={pName} puestoName={pName} small orders={techFilteredOrdenes} calculateProductionTime={calculateProductionTime}
                  config={workstationConfigs[pName] || { machine: pName, isDayActive: true, isNightActive: false, people: 0, machines: 1 }}
                  horasNetasDiurnas={horasNetasDiurnasVal} horasNetasNocturnas={horasNetasNocturnasVal}
                  mapToHojaRuta={mapToHojaRutaInternal} normalizeMaterialCode={normalizeMaterialCode}
                  adjustedInOrders={isBscAdjustActive ? bscMovedOrders.filter(m => m.toHR === hrCode).map(m => m.order) : []}
                  excludeOrderKeys={isBscAdjustActive ? new Set(bscMovedOrders.filter(m => m.fromHR === hrCode).map(m => mk(m.order))) : undefined}
                />
              );
            })}
          </div>
          {isBscAdjustActive && bscAdjustSummary && renderGenericGroupPanel(bscAdjustSummary, bscAcceptedMachines, handleAcceptBscForMachine, 'Proceso de Bases', 'border-teal-200', 'bg-teal-50 border-teal-100', 'bg-teal-600')}

          {/* PROCESO DE INTERIORES */}
          <div className="flex items-center justify-between px-7 py-3 bg-slate-900 rounded-full shadow-xl">
            <div className="flex items-center gap-4">
              <div className="w-2 h-2 rounded-full bg-violet-400 animate-pulse" />
              <span className="text-white font-black text-xs uppercase tracking-[0.3em]">Proceso de Interiores</span>
            </div>
            <Button onClick={handleIntpfAdjust} className={cn('font-black uppercase tracking-widest text-[10px] px-5 py-2 rounded-2xl shadow-lg flex items-center gap-2', isIntpfAdjustActive ? 'bg-red-600 hover:bg-red-700 text-white' : 'bg-violet-600 hover:bg-violet-700 text-white')}>
              <Layers className="w-4 h-4" /> {isIntpfAdjustActive ? 'Revertir Ajuste' : 'Ajuste de Producción'}
            </Button>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-10">
            {uniquePuestos.filter(p => p.toUpperCase() === 'COSEDORA-INTPF' || p.toUpperCase() === 'COSEDORA-INTPR' || p.toUpperCase() === 'COSEDORA-INTPT').map((pName) => {
              const hrCode = mapToHojaRutaInternal(pName).trim().toUpperCase();
              const mk = (o: any) => `${o['ORDEN'] || ''}|${String(o['MATERIAL'] || o['CodMaterial'] || '')}|${String(o['CANTIDAD'] || o['CANTPROGRAMADA'] || '')}`;
              return (
                <MachineCard key={pName} puestoName={pName} small orders={techFilteredOrdenes} calculateProductionTime={calculateProductionTime}
                  config={workstationConfigs[pName] || { machine: pName, isDayActive: true, isNightActive: false, people: 0, machines: 1 }}
                  horasNetasDiurnas={horasNetasDiurnasVal} horasNetasNocturnas={horasNetasNocturnasVal}
                  mapToHojaRuta={mapToHojaRutaInternal} normalizeMaterialCode={normalizeMaterialCode}
                  adjustedInOrders={isIntpfAdjustActive ? intpfMovedOrders.filter(m => m.toHR === hrCode).map(m => m.order) : []}
                  excludeOrderKeys={isIntpfAdjustActive ? new Set(intpfMovedOrders.filter(m => m.fromHR === hrCode).map(m => mk(m.order))) : undefined}
                />
              );
            })}
          </div>
          {isIntpfAdjustActive && intpfAdjustSummary && renderGenericGroupPanel(intpfAdjustSummary, intpfAcceptedMachines, handleAcceptIntpfForMachine, 'Proceso de Interiores', 'border-violet-200', 'bg-violet-50 border-violet-100', 'bg-violet-600')}

          {isIntpfAdjustActive && intpfDependencyData && (
            <div className="border border-violet-200 bg-white rounded-[2rem] p-8 shadow-md space-y-4">
              <div className="flex items-center gap-3">
                <div className="bg-violet-600 p-2.5 rounded-xl text-white shadow-md shrink-0">
                  <GitMerge className="w-4 h-4" />
                </div>
                <h4 className="font-black text-slate-900 uppercase tracking-tight text-sm">Dependencias — COSEDORA-INTPF</h4>
              </div>

              <div className="bg-violet-50 border border-violet-100 rounded-2xl p-5 text-[11px] space-y-4">
                <p className="text-slate-700 leading-relaxed">
                  <span className="font-black text-violet-700">COSEDORA-INTPF es un proceso previo obligatorio</span> para referencias que también pasan por COSEDORA-INTPR o COSEDORA-INTPT.
                  {!intpfDependencyData.listaCargada && (
                    <span className="ml-1 text-amber-600 font-black"> ⚠ Lista de Materiales no cargada — consulta la lista para activar este análisis.</span>
                  )}
                </p>

                {intpfDependencyData.listaCargada && (
                  <>
                    {intpfDependencyData.totalObligatory > 0 ? (
                      <div className="space-y-3">
                        <p className="text-[10px] font-black text-violet-700 uppercase tracking-widest">
                          {intpfDependencyData.totalObligatory} {intpfDependencyData.totalObligatory === 1 ? 'orden requiere' : 'órdenes requieren'} paso previo en INTPF
                        </p>

                        {intpfDependencyData.obligatoryIntpr.length > 0 && (
                          <div className="rounded-xl border border-violet-200 bg-violet-50/60 px-3 py-2 space-y-1">
                            <p className="text-[8px] font-black uppercase text-violet-600 tracking-widest mb-1">
                              COSEDORA-INTPR → depende de INTPF · {intpfDependencyData.obligatoryIntpr.length} orden{intpfDependencyData.obligatoryIntpr.length !== 1 ? 'es' : ''}
                            </p>
                            {intpfDependencyData.obligatoryIntpr.map((o: any, idx: number) => (
                              <div key={idx} className="flex justify-between text-[9px] font-mono text-violet-900">
                                <span className="shrink-0 font-black">{o['MATERIAL'] || o['CodMaterial'] || '—'}</span>
                                <span className="truncate mx-2 flex-1">{o['NOMBRE'] || o['TEXTOMATERIAL'] || '—'}</span>
                                <span className="font-black shrink-0">{Number(o['CANTIDAD'] || o['CANTPROGRAMADA'] || 0).toLocaleString()} uds</span>
                              </div>
                            ))}
                          </div>
                        )}

                        {intpfDependencyData.obligatoryIntpt.length > 0 && (
                          <div className="rounded-xl border border-violet-200 bg-violet-50/60 px-3 py-2 space-y-1">
                            <p className="text-[8px] font-black uppercase text-violet-600 tracking-widest mb-1">
                              COSEDORA-INTPT → depende de INTPF · {intpfDependencyData.obligatoryIntpt.length} orden{intpfDependencyData.obligatoryIntpt.length !== 1 ? 'es' : ''}
                            </p>
                            {intpfDependencyData.obligatoryIntpt.map((o: any, idx: number) => (
                              <div key={idx} className="flex justify-between text-[9px] font-mono text-violet-900">
                                <span className="shrink-0 font-black">{o['MATERIAL'] || o['CodMaterial'] || '—'}</span>
                                <span className="truncate mx-2 flex-1">{o['NOMBRE'] || o['TEXTOMATERIAL'] || '—'}</span>
                                <span className="font-black shrink-0">{Number(o['CANTIDAD'] || o['CANTPROGRAMADA'] || 0).toLocaleString()} uds</span>
                              </div>
                            ))}
                          </div>
                        )}

                        {/* ── CASCADA INVERSA: INTPF liberable por exceso aguas abajo ── */}
                        {intpfDependencyData.unnecessaryIntpfOrders.length > 0 && (
                          <div className="rounded-xl border border-rose-300 bg-rose-50/70 px-3 py-2 space-y-1">
                            <p className="text-[8px] font-black uppercase text-rose-700 tracking-widest mb-1">
                              INTPF LIBERADO POR EXCESO AGUAS ABAJO · {intpfDependencyData.unnecessaryIntpfOrders.length} orden{intpfDependencyData.unnecessaryIntpfOrders.length !== 1 ? 'es' : ''}
                            </p>
                            <p className="text-[8px] text-rose-600 mb-2 leading-snug">
                              El producto final que consume estos semielaborados no puede fabricarse (exceso en INTPR/INTPT). <span className="font-black">No es necesario producirlos en INTPF.</span>
                            </p>
                            {intpfDependencyData.unnecessaryIntpfOrders.map((item: { intpfOrder: any; causedByMat: string; causedByPuesto: string }, idx: number) => (
                              <div key={idx} className="flex flex-col gap-0.5 border-b border-rose-200 last:border-0 pb-1 last:pb-0">
                                <div className="flex justify-between text-[9px] font-mono text-rose-900">
                                  <span className="shrink-0 font-black line-through opacity-60">
                                    {item.intpfOrder['MATERIAL'] || item.intpfOrder['CodMaterial'] || '—'}
                                  </span>
                                  <span className="truncate mx-2 flex-1 opacity-60">
                                    {item.intpfOrder['NOMBRE'] || item.intpfOrder['TEXTOMATERIAL'] || '—'}
                                  </span>
                                  <span className="font-black shrink-0 opacity-60">
                                    {Number(item.intpfOrder['CANTIDAD'] || item.intpfOrder['CANTPROGRAMADA'] || 0).toLocaleString()} uds
                                  </span>
                                </div>
                                <p className="text-[8px] text-rose-500 pl-1">
                                  ↳ exceso en <span className="font-black">{item.causedByPuesto}</span> · mat: <span className="font-mono">{item.causedByMat}</span>
                                </p>
                              </div>
                            ))}
                          </div>
                        )}

                        <div className="rounded-xl border border-amber-200 bg-amber-50/50 px-3 py-2">
                          <p className="text-[9px] text-amber-800 leading-relaxed">
                            ⚠ Si COSEDORA-INTPF no tiene capacidad suficiente para estas <span className="font-black">{intpfDependencyData.totalObligatory} orden{intpfDependencyData.totalObligatory !== 1 ? 'es' : ''}</span>, las órdenes correspondientes en INTPR e INTPT quedarán bloqueadas. Prioriza la capacidad de INTPF antes de aceptar el ajuste de las máquinas dependientes.
                          </p>
                        </div>
                      </div>
                    ) : (
                      <p className="text-[10px] text-slate-500">
                        Sin dependencias obligatorias detectadas entre COSEDORA-INTPR / COSEDORA-INTPT y COSEDORA-INTPF para las referencias del período actual.
                      </p>
                    )}
                  </>
                )}
              </div>
            </div>
          )}

          {/* PROCESO TAPA SUPERIOR CHN */}
          <div className="flex items-center justify-between px-7 py-3 bg-slate-900 rounded-full shadow-xl">
            <div className="flex items-center gap-4">
              <div className="w-2 h-2 rounded-full bg-rose-400 animate-pulse" />
              <span className="text-white font-black text-xs uppercase tracking-[0.3em]">Proceso Tapa Superior CHN</span>
            </div>
            <Button onClick={handleTtchnAdjust} className={cn('font-black uppercase tracking-widest text-[10px] px-5 py-2 rounded-2xl shadow-lg flex items-center gap-2', isTtchnAdjustActive ? 'bg-red-600 hover:bg-red-700 text-white' : 'bg-rose-600 hover:bg-rose-700 text-white')}>
              <Layers className="w-4 h-4" /> {isTtchnAdjustActive ? 'Revertir Ajuste' : 'Ajuste de Producción'}
            </Button>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-10">
            {uniquePuestos.filter(p => p.toUpperCase() === 'COSEDORA-TTCHN' || p.toUpperCase() === 'COSEDORA-TTSUP-CHN').map((pName) => {
              const hrCode = mapToHojaRutaInternal(pName).trim().toUpperCase();
              const mk = (o: any) => `${o['ORDEN'] || ''}|${String(o['MATERIAL'] || o['CodMaterial'] || '')}|${String(o['CANTIDAD'] || o['CANTPROGRAMADA'] || '')}`;
              return (
                <MachineCard key={pName} puestoName={pName} small orders={techFilteredOrdenes} calculateProductionTime={calculateProductionTime}
                  config={workstationConfigs[pName] || { machine: pName, isDayActive: true, isNightActive: false, people: 0, machines: 1 }}
                  horasNetasDiurnas={horasNetasDiurnasVal} horasNetasNocturnas={horasNetasNocturnasVal}
                  mapToHojaRuta={mapToHojaRutaInternal} normalizeMaterialCode={normalizeMaterialCode}
                  adjustedInOrders={isTtchnAdjustActive ? ttchnMovedOrders.filter(m => m.toHR === hrCode).map(m => m.order) : []}
                  excludeOrderKeys={isTtchnAdjustActive ? new Set(ttchnMovedOrders.filter(m => m.fromHR === hrCode).map(m => mk(m.order))) : undefined}
                />
              );
            })}
          </div>
          {isTtchnAdjustActive && ttchnAdjustSummary && renderGenericGroupPanel(ttchnAdjustSummary, ttchnAcceptedMachines, handleAcceptTtchnForMachine, 'Proceso Tapa Superior CHN', 'border-rose-200', 'bg-rose-50 border-rose-100', 'bg-rose-600')}
        </TabsContent>

        <TabsContent value="forros" className="space-y-6 pb-20">
          {renderDateFilterHeaderInternal()}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-10">
            {uniquePuestos.filter(p => p.includes('FORRO') || p.includes('FBASE')).map((pName) => (
              <MachineCard 
                key={pName} 
                puestoName={pName} 
                small 
                orders={techFilteredOrdenes}
                calculateProductionTime={calculateProductionTime}
                config={workstationConfigs[pName] || { machine: pName, isDayActive: true, isNightActive: false, people: 0, machines: 1 }}
                horasNetasDiurnas={horasNetasDiurnasVal}
                horasNetasNocturnas={horasNetasNocturnasVal}
                mapToHojaRuta={mapToHojaRutaInternal}
                normalizeMaterialCode={normalizeMaterialCode}
              />
            ))}
          </div>
        </TabsContent>

        <TabsContent value="plan-final" className="space-y-6 pb-20">
          <Card className="rounded-[2.5rem] bg-white ring-1 ring-slate-100 overflow-hidden shadow-sm border-none">
            <div className="px-8 py-5 bg-slate-900 text-white flex items-center justify-between">
              <div className="flex items-center gap-4">
                <div className="bg-white/10 p-2.5 rounded-xl border border-white/10">
                  <TableIcon className="w-5 h-5 text-sky-400" />
                </div>
                <div>
                  <h2 className="font-black text-lg uppercase tracking-tight leading-none">Plan Final de Producción</h2>
                  <p className="text-white/50 text-[10px] font-black uppercase tracking-widest mt-0.5">Órdenes con ajuste aplicado</p>
                </div>
              </div>
              <Badge className="bg-white text-slate-900 font-mono font-black text-sm px-4 py-1.5 rounded-xl border-none">
                {planFinalOrders.length} ÓRDENES
              </Badge>
            </div>

            <CardContent className="p-0">
              {planFinalOrders.length === 0 ? (
                <div className="py-24 text-center space-y-3">
                  <TableIcon className="w-10 h-10 text-slate-200 mx-auto" />
                  <p className="text-slate-400 font-black uppercase tracking-widest text-[10px]">
                    Sin plan aceptado aún
                  </p>
                  <p className="text-slate-300 text-xs">
                    Aplica y acepta un ajuste en la pestaña <strong>2. Proceso Bandas</strong> para ver el plan aquí.
                  </p>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-[11px] border-collapse">
                    <thead className="bg-slate-900 text-white sticky top-0 z-10">
                      <tr>
                        <th className="px-6 py-4 text-left font-black uppercase tracking-widest text-[10px] text-sky-400">Hoja de Ruta</th>
                        <th className="px-6 py-4 text-left font-black uppercase tracking-widest text-[10px]">Material</th>
                        <th className="px-6 py-4 text-left font-black uppercase tracking-widest text-[10px]">Nombre</th>
                        <th className="px-6 py-4 text-right font-black uppercase tracking-widest text-[10px]">Cantidad</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {planFinalOrders
                        .slice()
                        .sort((a, b) => String(a._finalHR || '').localeCompare(String(b._finalHR || '')))
                        .map((o, i) => {
                          const wasAdjusted = !!o._wasAdjusted;
                          const hojaRuta = String(o._finalHR || o['MAQUINA'] || o['Maquina'] || '—');
                          const material = normalizeMaterialCode(o['MATERIAL'] || o['CodMaterial'] || '');
                          const nombre = o['NOMBRE'] || o['TEXTOMATERIAL'] || o['Material'] || '—';
                          const cantidad = Number(o['CANTIDAD'] || o['CANTPROGRAMADA'] || 0);
                          const textMain = wasAdjusted ? 'text-red-600' : 'text-slate-700';
                          return (
                            <tr key={i} className={cn('transition-colors', wasAdjusted ? 'bg-red-50/40 hover:bg-red-50/70' : 'hover:bg-slate-50')}>
                              <td className="px-6 py-3 whitespace-nowrap">
                                <Badge className={cn(
                                  'font-mono font-black text-[9px] px-2.5 py-0.5 rounded-lg border-none',
                                  wasAdjusted ? 'bg-red-100 text-red-700' : 'bg-indigo-50 text-indigo-700'
                                )}>
                                  {hojaRuta}
                                </Badge>
                              </td>
                              <td className={cn('px-6 py-3 font-mono font-bold whitespace-nowrap', textMain)}>
                                {material}
                              </td>
                              <td className={cn('px-6 py-3 font-medium break-words max-w-xs', wasAdjusted ? 'text-red-600' : 'text-slate-600')}>
                                {nombre}
                              </td>
                              <td className={cn('px-6 py-3 text-right font-mono font-black', textMain)}>
                                {cantidad.toLocaleString()}
                              </td>
                            </tr>
                          );
                        })}
                    </tbody>
                    <tfoot className="bg-slate-50 border-t-2 border-slate-200 sticky bottom-0">
                      <tr>
                        <td colSpan={3} className="px-6 py-3 text-[9px] font-black uppercase text-slate-400 tracking-widest">
                          {planFinalOrders.filter(o => o._wasAdjusted).length} reasignadas (en rojo) · {planFinalOrders.length} total
                        </td>
                        <td className="px-6 py-3 text-right font-mono font-black text-slate-900">
                          {planFinalOrders.reduce((s, o) => s + Number(o['CANTIDAD'] || o['CANTPROGRAMADA'] || 0), 0).toLocaleString()}
                        </td>
                      </tr>
                    </tfoot>
                  </table>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="ordenes-fert" className="space-y-12 pb-20">
          {isLoadingFert ? (
            <div className="flex items-center justify-center py-20 bg-white rounded-3xl border border-slate-200">
              <Loader2 className="w-10 h-10 animate-spin text-indigo-600" />
              <span className="ml-4 text-slate-500 font-black uppercase tracking-widest text-xs">Cargando órdenes FERT...</span>
            </div>
          ) : (
            <div className="space-y-8">
              {/* Botón y Resumen de Forros CHN */}
              <div className="flex flex-col space-y-6">
                <div className="flex justify-end">
                  <Button
                    onClick={handleExplodeFerts}
                    disabled={isLoadingExplosion || (fert1000.length === 0 && fert2000.length === 0)}
                    className="bg-indigo-600 hover:bg-indigo-700 text-white font-black uppercase tracking-widest text-xs px-8 py-4 rounded-2xl shadow-lg flex items-center gap-3"
                  >
                    {isLoadingExplosion ? (
                      <><Loader2 className="w-4 h-4 animate-spin" /> Consultando Lista de Materiales {explosionProgress}%</>
                    ) : (
                      <><Database className="w-4 h-4" /> Consultar Lista de Materiales y Generar Resumen</>
                    )}
                  </Button>
                </div>

                {/* RESUMEN FORROS — necesidades por referencia y centro */}
                <Card className="rounded-3xl border-none shadow-sm ring-1 ring-slate-100 overflow-hidden bg-white">
                  <div className="px-6 py-3 bg-emerald-800 text-white font-black text-[10px] uppercase tracking-widest flex items-center gap-2">
                    <Boxes className="w-4 h-4" /> Resumen Forros — Necesidades por Referencia
                  </div>
                  <CardContent className="p-0">
                    {resumenForros.length > 0 ? (
                      <table className="w-full text-[11px] border-collapse">
                        <thead className="bg-slate-50 text-slate-500 uppercase font-black tracking-widest border-b sticky top-0">
                          <tr>
                            <th className="px-6 py-4 text-left">CÓDIGO FORRO</th>
                            <th className="px-6 py-4 text-left">DESCRIPCIÓN</th>
                            <th className="px-6 py-4 text-right">CENTRO 1000 (UIO)</th>
                            <th className="px-6 py-4 text-right">CENTRO 2000 (GYE)</th>
                            <th className="px-6 py-4 text-right">TOTAL</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                          {resumenForros.map((row, i) => (
                            <tr key={i} className="hover:bg-emerald-50/30 transition-colors">
                              <td className="px-6 py-3 font-mono font-black text-slate-800">{row.material}</td>
                              <td className="px-6 py-3 text-slate-600">{row.nombre}</td>
                              <td className="px-6 py-3 text-right font-mono font-black text-slate-700">
                                {row.total1000 > 0 ? Math.round(row.total1000).toLocaleString() : '—'}
                              </td>
                              <td className="px-6 py-3 text-right font-mono font-black text-indigo-700">
                                {row.total2000 > 0 ? Math.round(row.total2000).toLocaleString() : '—'}
                              </td>
                              <td className="px-6 py-3 text-right font-mono font-black text-emerald-700 bg-emerald-50/40">
                                {Math.round(row.total1000 + row.total2000).toLocaleString()}
                              </td>
                            </tr>
                          ))}
                          <tr className="bg-slate-50 border-t-2 border-slate-200">
                            <td colSpan={2} className="px-6 py-4 font-black text-slate-600 uppercase text-[10px] tracking-widest">Total General</td>
                            <td className="px-6 py-4 text-right font-mono font-black text-slate-800">
                              {Math.round(resumenForros.reduce((s, r) => s + r.total1000, 0)).toLocaleString()}
                            </td>
                            <td className="px-6 py-4 text-right font-mono font-black text-indigo-800">
                              {Math.round(resumenForros.reduce((s, r) => s + r.total2000, 0)).toLocaleString()}
                            </td>
                            <td className="px-6 py-4 text-right font-mono font-black text-emerald-800 bg-emerald-50/40">
                              {Math.round(resumenForros.reduce((s, r) => s + r.total1000 + r.total2000, 0)).toLocaleString()}
                            </td>
                          </tr>
                        </tbody>
                      </table>
                    ) : (
                      <div className="py-12 text-center">
                        {isLoadingExplosion ? (
                          <div className="flex flex-col items-center gap-3">
                            <Loader2 className="w-8 h-8 animate-spin text-emerald-600" />
                            <span className="text-[11px] font-black uppercase text-slate-400 tracking-widest">Consultando lista de materiales {explosionProgress}%...</span>
                          </div>
                        ) : (
                          <span className="text-slate-400 uppercase font-black tracking-widest text-[10px] opacity-50">
                            Presiona &quot;Consultar Lista de Materiales&quot; para calcular las necesidades de FORROS
                          </span>
                        )}
                      </div>
                    )}
                  </CardContent>
                </Card>

                {/* Resumen de Forros CHN por Centro y RESPCTRLPROD */}
                <Card className="rounded-3xl border-none shadow-sm ring-1 ring-slate-100 overflow-hidden bg-white">
                  <div className="px-6 py-3 bg-slate-900 text-white font-black text-[10px] uppercase tracking-widest flex items-center gap-2">
                    <Boxes className="w-4 h-4" /> Resumen de Forros (Insumos CHN) por Centro y Responsable
                  </div>
                  <CardContent className="p-0">
                    {resumenPorCentroResp.length > 0 ? (
                      <table className="w-full text-[11px] border-collapse">
                        <thead className="bg-slate-50 text-slate-500 uppercase font-black tracking-widest border-b sticky top-0">
                          <tr>
                            <th className="px-6 py-4 text-left">CENTRO</th>
                            <th className="px-6 py-4 text-left">RESPCTRLPROD</th>
                            <th className="px-6 py-4 text-right">CANT. ÓRDENES FERT</th>
                            <th className="px-6 py-4 text-right">INSUMOS CHN (M/UN)</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                          {resumenPorCentroResp.map((row, i) => {
                            const centroLabel = row.centro === '1000' ? 'UIO 1000' : row.centro === '2000' ? 'GYE 2000' : row.centro;
                            const isNewCentro = i === 0 || resumenPorCentroResp[i - 1].centro !== row.centro;
                            return (
                              <tr key={i} className={cn("hover:bg-indigo-50/30 transition-colors", isNewCentro && i > 0 && "border-t-2 border-slate-200")}>
                                <td className="px-6 py-4">
                                  {isNewCentro ? (
                                    <Badge className={cn(
                                      "font-black text-[10px] px-3 py-1 rounded-lg border-none",
                                      row.centro === '1000' ? "bg-slate-900 text-sky-400" : "bg-indigo-700 text-white"
                                    )}>
                                      {centroLabel}
                                    </Badge>
                                  ) : null}
                                </td>
                                <td className="px-6 py-4 font-bold text-slate-700">
                                  Responsable {row.resp}
                                </td>
                                <td className="px-6 py-4 text-right font-mono font-black text-indigo-600">
                                  {Math.round(row.totalForros).toLocaleString()}
                                </td>
                                <td className="px-6 py-4 text-right font-mono font-black text-emerald-700 bg-emerald-50/30">
                                  {row.totalInsumos.toLocaleString(undefined, { minimumFractionDigits: 1, maximumFractionDigits: 1 })}
                                </td>
                              </tr>
                            );
                          })}
                          <tr className="bg-slate-50 border-t-2 border-slate-200">
                            <td colSpan={2} className="px-6 py-4 font-black text-slate-600 uppercase text-[10px] tracking-widest">Total General</td>
                            <td className="px-6 py-4 text-right font-mono font-black text-indigo-800">
                              {Math.round(resumenPorCentroResp.reduce((s, r) => s + r.totalForros, 0)).toLocaleString()}
                            </td>
                            <td className="px-6 py-4 text-right font-mono font-black text-emerald-800 bg-emerald-50/30">
                              {resumenPorCentroResp.reduce((s, r) => s + r.totalInsumos, 0).toLocaleString(undefined, { minimumFractionDigits: 1, maximumFractionDigits: 1 })}
                            </td>
                          </tr>
                        </tbody>
                      </table>
                    ) : (
                      <div className="py-20 text-center">
                        {isLoadingExplosion ? (
                          <div className="flex flex-col items-center gap-3">
                            <Loader2 className="w-8 h-8 animate-spin text-indigo-600" />
                            <span className="text-[11px] font-black uppercase text-slate-400 tracking-widest">Consultando lista de materiales {explosionProgress}%...</span>
                          </div>
                        ) : (
                          <span className="text-slate-400 uppercase font-black tracking-widest text-[10px] opacity-50">
                            Presiona &quot;Consultar Lista de Materiales&quot; para generar el resumen
                          </span>
                        )}
                      </div>
                    )}
                  </CardContent>
                </Card>
              </div>

              {/* Fert Tables */}
              {renderFertTableInternal(fert1000, summary1000, "Órdenes FERT - Centro 1000 (UIO)", targetDate1000, setTargetDate1000, "bg-slate-900")}
              {renderFertTableInternal(fert2000, summary2000, "Órdenes FERT - Centro 2000 (GYE)", targetDate2000, setTargetDate2000, "bg-indigo-700")}
            </div>
          )}
        </TabsContent>

        <TabsContent value="ordenes-previsionales">
          <Card className="rounded-[2.5rem] bg-white ring-1 ring-slate-100 overflow-hidden shadow-sm">
            <CardHeader className="bg-slate-50/50 border-b border-slate-200 p-10">
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="text-2xl font-black text-slate-900 uppercase">Órdenes Previsionales</CardTitle>
                  <CardDescription className="text-slate-400 font-bold uppercase text-[10px] tracking-widest mt-1">Filtrado por Centro 1000 y RespCtrlProd de Forros</CardDescription>
                </div>
                <div className="bg-sky-600 p-3 rounded-2xl text-white shadow-lg shadow-sky-500/20">
                  <SearchCode className="w-6 h-6" />
                </div>
              </div>
              
              <div className="mt-6 flex flex-wrap items-center gap-3 p-4 bg-white border border-slate-200 rounded-2xl shadow-sm">
                <div className="flex items-center gap-2 text-xs font-black text-slate-400 uppercase tracking-widest">
                  <Filter className="w-4 h-4 text-indigo-600" /> Filtros Activos:
                </div>
                <Badge className="bg-slate-950 text-white border-none font-mono text-[10px] font-black py-1 px-3 rounded-lg shadow-sm">CENTRO: 1000</Badge>
                {allowedRespCodes.length > 0 ? (
                  <>
                    <div className="text-[10px] font-black text-slate-300">|</div>
                    {allowedRespCodes.map(code => (
                      <Badge key={code} className="bg-indigo-50 text-indigo-700 border-indigo-200 font-mono text-[10px] font-black py-1 px-3 rounded-lg">RESP: {code}</Badge>
                    ))}
                  </>
                ) : (
                  <Badge variant="outline" className="text-slate-400 font-bold uppercase text-[9px] px-3 py-1 rounded-lg">Sin restricción RESP</Badge>
                )}
                <div className="ml-auto text-[10px] font-black text-slate-400 uppercase tracking-widest">
                  Registros: <span className="text-indigo-600">{displayedOrdenesPrevisionales.length}</span>
                  {searchQueryPrevisionales.trim() && (
                    <span className="text-slate-400"> / {filteredOrdenesPrevisionales.length}</span>
                  )}
                </div>
              </div>

              <div className="mt-4 relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none" />
                <Input
                  type="text"
                  placeholder="Buscar en cualquier columna..."
                  value={searchQueryPrevisionales}
                  onChange={e => setSearchQueryPrevisionales(e.target.value)}
                  className="pl-9 pr-9 h-10 text-xs font-medium border-slate-200 rounded-xl focus-visible:ring-indigo-500"
                />
                {searchQueryPrevisionales && (
                  <button
                    onClick={() => setSearchQueryPrevisionales('')}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                  >
                    <X className="w-4 h-4" />
                  </button>
                )}
              </div>
            </CardHeader>
            <CardContent className="p-0">
              <div className="overflow-x-auto max-h-[70vh] relative">
                {isLoadingPrevisionales ? (
                  <div className="flex items-center justify-center py-24">
                    <Loader2 className="w-10 h-10 animate-spin text-indigo-50" />
                  </div>
                ) : (
                  <table className="w-full text-[11px] border-collapse">
                    <thead className="bg-slate-900 sticky top-0 z-10 text-white text-left uppercase tracking-widest font-black">
                      <tr>
                        {filteredOrdenesPrevisionales.length > 0 && Object.keys(filteredOrdenesPrevisionales[0]).map((key) => {
                          const normKey = key.toUpperCase().trim();
                          const isTechnical = normKey === 'MAQUINA' || normKey === 'PUESTOTRABAJO' || normKey === 'PUESTO_TRABAJO';
                          return (
                            <React.Fragment key={key}>
                              <th className="px-6 py-4 whitespace-nowrap text-[10px] uppercase font-bold text-slate-300">{key}</th>
                              {isTechnical && (
                                <th className="px-6 py-4 text-[10px] uppercase font-bold text-sky-400 bg-slate-800 shadow-inner whitespace-nowrap">Tiempo producción (s)</th>
                              )}
                            </React.Fragment>
                          );
                        })}
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {displayedOrdenesPrevisionales.length === 0 && searchQueryPrevisionales.trim() ? (
                        <tr>
                          <td colSpan={999} className="px-6 py-16 text-center text-xs font-black text-slate-400 uppercase tracking-widest">
                            No se encontraron resultados para "{searchQueryPrevisionales}"
                          </td>
                        </tr>
                      ) : displayedOrdenesPrevisionales.map((item, i) => (
                        <tr key={i} className="hover:bg-slate-50 transition-colors text-[10px]">
                          {Object.keys(item).map((key) => {
                            const val = item[key];
                            const normKey = key.toUpperCase().trim();
                            const isTechnical = normKey === 'MAQUINA' || normKey === 'PUESTOTRABAJO' || normKey === 'PUESTO_TRABAJO';
                            const kpiTimeSec = getKPITimeSecondsForOrder(item);
                            return (
                              <React.Fragment key={key}>
                                <td className="px-6 py-4 font-medium text-slate-600 whitespace-normal break-words leading-tight min-w-[150px]">{val ?? '—'}</td>
                                {isTechnical && (
                                  <td className="px-6 py-4 font-mono font-black text-indigo-600 bg-indigo-50/30 text-center border-x border-slate-100 min-w-[120px]">
                                    {kpiTimeSec !== null ? kpiTimeSec.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : '—'}
                                  </td>
                                )}
                              </React.Fragment>
                            );
                          })}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="lista-materiales">
          <Card className="rounded-[2.5rem] bg-white ring-1 ring-slate-100 overflow-hidden shadow-sm border-none">
            <CardHeader className="bg-slate-50/50 border-b border-slate-200 p-10">
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="text-2xl font-black text-slate-900 uppercase">LISTA DE MATERIALES</CardTitle>
                  <CardDescription className="text-slate-400 font-bold uppercase text-[10px] tracking-widest mt-1">Explosión de Materiales (BOM) - ReporteExplosionMateriales</CardDescription>
                </div>
                <div className="bg-emerald-600 p-3 rounded-2xl text-white shadow-lg shadow-emerald-500/20">
                  <ListTree className="w-6 h-6" />
                </div>
              </div>
              {isLoadingListaMateriales && (
                <div className="mt-6 space-y-2">
                  <div className="flex justify-between text-xs font-black text-emerald-700 uppercase tracking-widest">
                    <span>Descargando explosión de materiales (secuencial)...</span>
                    <span>{bomDownloadProgress}%</span>
                  </div>
                  <Progress value={bomDownloadProgress} className="h-2 bg-emerald-100 [&>div]:bg-emerald-600" />
                </div>
              )}
            </CardHeader>
            <CardContent className="p-0">
              <div className="overflow-x-auto max-h-[70vh] relative">
                {isLoadingListaMateriales && listaMaterialesData.length === 0 ? (
                  <div className="flex flex-col items-center justify-center py-32 space-y-4">
                    <Loader2 className="w-12 h-12 animate-spin text-emerald-600" />
                    <span className="text-slate-500 font-black uppercase tracking-widest text-xs">Procesando bloques de datos...</span>
                  </div>
                ) : listaMaterialesData.length > 0 ? (
                  <table className="w-full text-[11px] border-collapse">
                    <thead className="bg-slate-900 sticky top-0 z-10 text-white text-left uppercase tracking-widest font-black">
                      <tr>
                        {Object.keys(listaMaterialesData[0]).map((key) => (
                          <th key={key} className="px-6 py-4 whitespace-nowrap text-[10px] uppercase font-bold text-slate-300">{key}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {listaMaterialesData.map((row, i) => (
                        <tr key={i} className="hover:bg-slate-50 transition-colors text-[10px]">
                          {Object.entries(row).map(([key, val]: [string, any], j) => (
                            <td key={j} className={cn(
                              "px-6 py-4 font-medium text-slate-600",
                              (key === 'COMPONENTE' || key === 'FERT_PRINCIPAL') && "font-mono font-bold text-indigo-700",
                              (key === 'CANTIDAD_UNITARIA' || key === 'CANTIDAD_ACUMULADA') && "text-right font-mono font-black"
                            )}>
                              {typeof val === 'number' ? val.toLocaleString(undefined, { minimumFractionDigits: 3 }) : (val ?? '—')}
                            </td>
                          ))}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                ) : (
                  <div className="py-20 text-center text-slate-400 uppercase font-black tracking-widest text-xs opacity-40">No hay datos de explosión disponibles</div>
                )}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="personal-turnos" className="pb-24">
          <div className="flex flex-col xl:flex-row gap-10">
            <Card className="xl:w-[350px] shrink-0 rounded-[2.5rem] bg-white border-none shadow-sm ring-1 ring-slate-100">
               <CardHeader className="bg-slate-950 text-white p-8 rounded-t-[2.5rem]">
                 <CardTitle className="text-xl font-black uppercase">Jornada Global</CardTitle>
                 <div className="mt-3 flex items-center gap-2 text-[10px] font-black text-sky-400 uppercase tracking-[0.25em]">
                   <Users className="w-3.5 h-3.5" /> Eficiencia Operativa: 84%
                 </div>
               </CardHeader>
               <CardContent className="p-10 space-y-10">
                 <div className="space-y-5">
                    <label className="text-[11px] font-black text-slate-400 uppercase tracking-[0.3em] flex items-center gap-2"><Sun className="w-4 h-4 text-amber-500" /> Jornada Diurna</label>
                    <Select value={jornadaDiurnaSel} onValueChange={setJornadaDiurnaSel}>
                      <SelectTrigger className="h-14 border-2 rounded-2xl font-black text-slate-800">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {DIURNA_OPTIONS.map(opt => <SelectItem key={opt.value} value={opt.value} className="font-black py-3">{opt.label}</SelectItem>)}
                      </SelectContent>
                    </Select>
                 </div>
                 <div className="space-y-5">
                    <label className="text-[11px] font-black text-slate-400 uppercase tracking-[0.3em] flex items-center gap-2"><Moon className="w-4 h-4 text-indigo-500" /> Jornada Nocturna</label>
                    <Select value={jornadaNocturnaSel} onValueChange={setJornadaNocturnaSel}>
                      <SelectTrigger className="h-14 border-2 rounded-2xl font-black text-slate-800">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {NOCTURNA_OPTIONS.map(opt => <SelectItem key={opt.value} value={opt.value} className="font-black py-3">{opt.label}</SelectItem>)}
                      </SelectContent>
                    </Select>
                 </div>
               </CardContent>
            </Card>

            <div className="flex-1 space-y-12">
              {workstationGroups.map((group, gIdx) => {
                const availableItems = group.items.filter(item => uniquePuestos.includes(item));
                if (availableItems.length === 0) return null;
                return (
                  <div key={gIdx} className="space-y-6">
                    <div className="flex items-center gap-4">
                      <div className="h-8 w-2 bg-indigo-600 rounded-full" />
                      <h3 className="text-xl font-black text-indigo-950 uppercase tracking-tighter">{group.title}</h3>
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-8">
                      {availableItems.map(p => {
                        const config = workstationConfigs[p] || { machine: p, isDayActive: true, isNightActive: false, people: 0, machines: 1 };
                        const capPuestoBase = (config.isDayActive ? horasNetasDiurnasVal : 0) + (config.isNightActive ? horasNetasNocturnasVal : 0);
                        const capPuestoTotal = capPuestoBase * (config.machines || 1);
                        const hrCode = mapToHojaRutaInternal(p);

                        return (
                          <div key={p} className="flex flex-col p-8 border border-slate-200 rounded-[2.5rem] bg-white hover:border-indigo-300 transition-all shadow-sm relative group min-h-[420px]">
                            <div className="mb-6 relative">
                              <Badge className="bg-indigo-600 text-white border-none font-mono text-[10px] uppercase font-bold tracking-widest px-3 py-1 rounded-lg shadow-sm mb-3">
                                {hrCode || 'S/HR'}
                              </Badge>
                              <h4 className="font-black text-indigo-950 uppercase text-2xl leading-tight break-words pr-20">{p}</h4>

                              {/* Badges interactivos: Máquinas (editable) + Personas */}
                              <div className="absolute top-0 right-0 flex flex-col gap-2">
                                {/* Máquinas — control +/− */}
                                <div className="flex flex-col items-center bg-sky-50 border-2 border-sky-300 w-16 rounded-2xl shadow-inner overflow-hidden group-hover:border-sky-400 transition-colors">
                                  <button
                                    onClick={() => setWorkstationConfigs(prev => ({ ...prev, [p]: { ...config, machines: (config.machines || 1) + 1 } }))}
                                    className="w-full py-0.5 hover:bg-sky-200 text-sky-600 font-black text-sm leading-none transition-colors"
                                  >+</button>
                                  <span className="text-2xl font-black text-sky-700 leading-none py-1">{config.machines || 1}</span>
                                  <span className="text-[7px] font-black uppercase text-sky-400 tracking-tighter pb-0.5">Máquinas</span>
                                  <button
                                    onClick={() => setWorkstationConfigs(prev => ({ ...prev, [p]: { ...config, machines: Math.max(1, (config.machines || 1) - 1) } }))}
                                    className="w-full py-0.5 hover:bg-sky-200 text-sky-600 font-black text-sm leading-none transition-colors"
                                  >−</button>
                                </div>
                                {/* Personas — solo display */}
                                <div className="flex flex-col items-center justify-center bg-indigo-50 border-2 border-dashed border-indigo-300 w-16 h-16 rounded-2xl shadow-inner">
                                  <span className="text-2xl font-black text-indigo-700 leading-none">{config.people || 0}</span>
                                  <span className="text-[7px] font-black uppercase text-indigo-400 mt-0.5 tracking-tighter">Personas</span>
                                </div>
                              </div>
                            </div>

                            <div className="space-y-6 mt-auto">
                              <div className="bg-slate-50 p-4 rounded-3xl border border-slate-100">
                                <div className="flex justify-between items-center text-[10px] text-slate-400 uppercase font-black tracking-widest mb-3">Turnos Activos</div>
                                <div className="flex gap-3">
                                  <button
                                    onClick={() => toggleWorkstationShift(p, 'day')}
                                    className={cn(
                                      "flex-1 h-14 rounded-2xl flex flex-col items-center justify-center gap-1 transition-all shadow-sm border-2",
                                      config.isDayActive ? "bg-amber-500 text-white border-amber-600" : "bg-white text-slate-300 border-slate-100"
                                    )}
                                  >
                                    <Sun className="w-5 h-5" />
                                    <span className="text-[9px] font-black uppercase tracking-widest">Día</span>
                                  </button>
                                  <button
                                    onClick={() => toggleWorkstationShift(p, 'night')}
                                    className={cn(
                                      "flex-1 h-14 rounded-2xl flex flex-col items-center justify-center gap-1 transition-all shadow-sm border-2",
                                      config.isNightActive ? "bg-indigo-700 text-white border-indigo-800" : "bg-white text-slate-300 border-slate-100"
                                    )}
                                  >
                                    <Moon className="w-5 h-5" />
                                    <span className="text-[9px] font-black uppercase tracking-widest">Noche</span>
                                  </button>
                                </div>
                              </div>

                              {/* Capacidad neta con fórmula visible */}
                              <div className="flex flex-col items-center gap-1 px-4 py-3 bg-emerald-50 rounded-3xl border border-emerald-100">
                                <div className="flex items-center gap-2">
                                  <Clock className="w-3.5 h-3.5 text-emerald-600" />
                                  <span className="font-mono text-[13px] font-black text-emerald-700 tracking-wider">
                                    {capPuestoTotal.toFixed(2)} H Disponibles
                                  </span>
                                </div>
                                {(config.machines || 1) > 1 && (
                                  <span className="text-[9px] text-emerald-500 font-black font-mono">
                                    {capPuestoBase.toFixed(2)}h × {config.machines} máq.
                                  </span>
                                )}
                              </div>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </TabsContent>

        <TabsContent value="kpi-tiempos" className="space-y-8 pb-20">
          <Card className="rounded-[2.5rem] bg-white ring-1 ring-slate-100 overflow-hidden shadow-sm border-none">
            <CardHeader className="bg-slate-950 p-8 border-b border-slate-800">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-4">
                  <div className="bg-indigo-600 p-3 rounded-2xl text-white shadow-lg shadow-indigo-500/20">
                    <Database className="w-6 h-6" />
                  </div>
                  <div>
                    <CardTitle className="text-2xl font-black text-white uppercase tracking-tight">KPI Maestro de Forros</CardTitle>
                    <CardDescription className="text-slate-400 font-bold uppercase text-[10px] tracking-widest mt-1">Auditoría técnica de tiempos promedio por material</CardDescription>
                  </div>
                </div>
              </div>
            </CardHeader>
            <CardContent className="p-0">
              <div className="overflow-auto max-h-[70vh] relative">
                {isLoadingKPI ? (
                  <div className="flex items-center justify-center py-24">
                    <Loader2 className="w-10 h-10 animate-spin text-indigo-50" />
                  </div>
                ) : (
                  <table className="w-full text-[11px] border-collapse">
                    <thead className="bg-slate-900 sticky top-0 z-10 text-white text-left uppercase tracking-widest font-black">
                      <tr>
                        <th className="px-6 py-4">Código Material</th>
                        <th className="px-6 py-4">HOJA DE RUTA</th>
                        <th className="px-6 py-4 text-right bg-indigo-950/20">T. Promedio (seg)</th>
                        <th className="px-6 py-4">Categoría / Puesto</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {kpiMaestroData.map((t, i) => (
                        <tr key={i} className="hover:bg-slate-50 transition-colors">
                          <td className="px-6 py-4 font-mono font-bold text-slate-600">{t.CodigoMaterial}</td>
                          <td className="px-6 py-4 font-mono font-black text-indigo-700 uppercase">{t.HRUTA}</td>
                          <td className="px-6 py-4 text-right font-mono font-black text-indigo-600 bg-indigo-50/30">
                            {Number(t.TPromedio || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                          </td>
                          <td className="px-6 py-4 font-black text-slate-800 uppercase whitespace-normal break-words leading-tight min-w-[250px]">{t.Categoria}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="planes-grupo-ensamblado" className="space-y-8 pb-20">
          <Card className="rounded-[2.5rem] bg-white ring-1 ring-slate-100 overflow-hidden shadow-sm border-none">
            <CardHeader className="bg-slate-50/50 border-b border-slate-200 p-10">
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="text-2xl font-black text-slate-900 uppercase">Planes Grupo Ensamblado</CardTitle>
                  <CardDescription className="text-slate-400 font-bold uppercase text-[10px] tracking-widest mt-1">Grupos recuperados por restricción DEPARTAMENTO_PLAN_INICIAL</CardDescription>
                </div>
                <div className="bg-slate-950 p-3 rounded-2xl text-white shadow-lg">
                  <Boxes className="w-6 h-6" />
                </div>
              </div>
            </CardHeader>
            <CardContent className="p-0">
              {gruposCoincidentes.length > 0 ? (
                <table className="w-full text-[11px] border-collapse">
                  <thead className="bg-slate-900 sticky top-0 z-10 text-white text-left uppercase tracking-widest font-black">
                    <tr>
                      <th className="px-6 py-4 text-[10px]">Código Grupo</th>
                      <th className="px-6 py-4 text-[10px]">Nombre Grupo</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {gruposCoincidentes.map((g) => (
                      <tr key={g.codigo_grupo} className="hover:bg-slate-50 transition-colors text-[10px]">
                        <td className="px-6 py-4 font-mono font-bold text-slate-600">{g.codigo_grupo}</td>
                        <td className="px-6 py-4 font-black text-slate-800 uppercase">{g.nombre_grupo}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              ) : (
                <div className="py-20 text-center text-slate-400 uppercase font-black tracking-widest text-xs opacity-40">
                  No hay grupos que coincidan con la restricción DEPARTAMENTO_PLAN_INICIAL
                </div>
              )}
            </CardContent>
          </Card>

          <Card className="rounded-[2.5rem] bg-white ring-1 ring-slate-100 overflow-hidden shadow-sm border-none">
            <CardHeader className="bg-slate-50/50 border-b border-slate-200 p-10">
              <div className="flex items-center justify-between flex-wrap gap-4">
                <div>
                  <CardTitle className="text-2xl font-black text-slate-900 uppercase">Plan Táctico de Grupos</CardTitle>
                  <CardDescription className="text-slate-400 font-bold uppercase text-[10px] tracking-widest mt-1">
                    Detalle del plan táctico para los grupos filtrados, en la fecha seleccionada
                  </CardDescription>
                </div>
                <div className="flex items-center gap-3">
                  <div className="flex items-center gap-2">
                    <span className="text-[9px] font-black text-slate-400 uppercase">Fecha del Plan:</span>
                    <Popover open={isPlanGrupoCalendarOpen} onOpenChange={setIsPlanGrupoCalendarOpen}>
                      <PopoverTrigger asChild>
                        <button
                          type="button"
                          className="flex items-center gap-2 text-xs font-bold text-slate-700 bg-slate-50 border border-slate-200 rounded-lg px-3 py-1.5 focus:ring-indigo-500 outline-none"
                        >
                          <CalendarIcon className="w-3.5 h-3.5 text-slate-400" />
                          {planGrupoFecha || 'Selecciona una fecha'}
                        </button>
                      </PopoverTrigger>
                      <PopoverContent className="w-auto p-0" align="start">
                        <DatePickerCalendar
                          mode="single"
                          selected={planGrupoFecha ? new Date(`${planGrupoFecha}T00:00:00`) : undefined}
                          onSelect={(date) => {
                            if (!date) return;
                            const value = date.toISOString().split('T')[0];
                            setPlanGrupoFecha(value);
                            setIsPlanGrupoCalendarOpen(false);
                            fetchPlanGrupoDetalle(value);
                          }}
                          modifiers={{ conPlan: (date) => fechasConPlanRecuperable.has(date.toISOString().split('T')[0]) }}
                          modifiersClassNames={{ conPlan: 'font-black text-indigo-700 shadow-[inset_0_0_0_9999px_rgba(99,102,241,0.18)] rounded-md' }}
                        />
                        {fechasConPlanRecuperable.size > 0 && (
                          <div className="flex items-center gap-2 px-4 pb-3 text-[9px] font-bold text-slate-400 uppercase tracking-wider">
                            <span className="inline-block w-3 h-3 rounded bg-indigo-200" /> Fecha con plan recuperable
                          </div>
                        )}
                      </PopoverContent>
                    </Popover>
                  </div>
                  <Button
                    onClick={() => fetchPlanGrupoDetalle()}
                    disabled={!planGrupoFecha || gruposCoincidentes.length === 0 || isLoadingPlanGrupo}
                    className="bg-indigo-600 hover:bg-indigo-700 text-white font-black uppercase tracking-widest text-[9px] px-5 py-2 rounded-xl disabled:opacity-40"
                  >
                    {isLoadingPlanGrupo ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : 'Consultar Plan'}
                  </Button>
                </div>
              </div>
            </CardHeader>
            <CardContent className="p-0">
              {isLoadingPlanGrupo ? (
                <div className="py-20 text-center text-slate-400 uppercase font-black tracking-widest text-xs flex items-center justify-center gap-2">
                  <Loader2 className="w-4 h-4 animate-spin" /> Cargando plan táctico...
                </div>
              ) : !hasFetchedPlanGrupo ? (
                <div className="py-20 text-center text-slate-400 uppercase font-black tracking-widest text-xs opacity-40">
                  Selecciona una fecha y consulta el plan táctico de los grupos filtrados
                </div>
              ) : planGrupoDetalleFiltrada.length > 0 ? (
                <>
                  <div className="overflow-x-auto">
                    <table className="w-full text-[11px] border-collapse">
                      <thead className="bg-slate-900 sticky top-0 z-10 text-white text-left uppercase tracking-widest font-black">
                        <tr>
                          <th className="px-6 py-4 text-[10px]">Grupo</th>
                          <th className="px-6 py-4 text-[10px]">Línea Producción</th>
                          <th className="px-6 py-4 text-[10px]">Material</th>
                          <th className="px-6 py-4 text-[10px] text-right">Cant. Prod. Neta</th>
                          <th className="px-6 py-4 text-[10px]">Clase Aprov.</th>
                          <th className="px-6 py-4 text-[10px] text-right">Cant. Aprov.</th>
                          <th className="px-6 py-4 text-[10px]">Resp. Ctrl. Prod.</th>
                          <th className="px-6 py-4 text-[10px] text-center">Estado</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {paginatedPlanGrupoDetalle.map((item, i) => (
                          <tr key={item.codigo_detalle_tactico ?? i} className="hover:bg-slate-50 transition-colors text-[10px]">
                            <td className="px-6 py-4 font-mono font-bold text-slate-600">{item.codigo_plan_grupo}</td>
                            <td className="px-6 py-4 font-black text-slate-800 uppercase">{item.linea_produccion || '—'}</td>
                            <td className="px-6 py-4 font-mono font-bold text-indigo-700">{item.codigo_material}</td>
                            <td className="px-6 py-4 text-right font-mono font-black text-slate-800">{Number(item.cantidad_produccion_neta || 0).toLocaleString()}</td>
                            <td className="px-6 py-4 font-bold text-slate-600">{item.clase_aprovisionamiento || '—'}</td>
                            <td className="px-6 py-4 text-right font-mono font-bold text-slate-600">{Number(item.cantidad_aprovisionamiento || 0).toLocaleString()}</td>
                            <td className="px-6 py-4 font-bold text-slate-600">{item.resp_ctrl_prod || '—'}</td>
                            <td className="px-6 py-4 text-center">
                              <Badge className={cn(
                                'font-black text-[9px] px-2 py-0.5 rounded-md border-none',
                                item.estado === 'A' ? 'bg-green-100 text-green-700' : 'bg-slate-100 text-slate-600'
                              )}>
                                {item.estado || '—'}
                              </Badge>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>

                  <div className="flex items-center justify-between px-6 py-4 border-t border-slate-200 bg-slate-50/50">
                    <div className="text-[10px] font-black uppercase tracking-widest text-slate-400">
                      {planGrupoDetalleFiltrada.length} registro{planGrupoDetalleFiltrada.length === 1 ? '' : 's'}
                    </div>
                    <div className="flex items-center gap-1">
                      <Button variant="outline" size="icon" onClick={() => setPlanGrupoPage(1)} disabled={planGrupoPage === 1} className="h-8 w-8"><ChevronsLeft className="h-4 w-4" /></Button>
                      <Button variant="outline" size="icon" onClick={() => setPlanGrupoPage(p => p - 1)} disabled={planGrupoPage === 1} className="h-8 w-8"><ChevronLeft className="h-4 w-4" /></Button>
                      <div className="px-4 text-[11px] font-bold text-gray-700 min-w-[120px] text-center border-x py-1 bg-white rounded">Página {planGrupoPage} de {planGrupoTotalPages}</div>
                      <Button variant="outline" size="icon" onClick={() => setPlanGrupoPage(p => p + 1)} disabled={planGrupoPage === planGrupoTotalPages} className="h-8 w-8"><ChevronRight className="h-4 w-4" /></Button>
                      <Button variant="outline" size="icon" onClick={() => setPlanGrupoPage(planGrupoTotalPages)} disabled={planGrupoPage === planGrupoTotalPages} className="h-8 w-8"><ChevronsRight className="h-4 w-4" /></Button>
                    </div>
                  </div>
                </>
              ) : (
                <div className="py-20 text-center text-slate-400 uppercase font-black tracking-widest text-xs opacity-40">
                  Sin resultados para la fecha seleccionada
                </div>
              )}
            </CardContent>
          </Card>

          {planGrupoDetalleFiltrada.length > 0 && (
            <Card className="rounded-2xl bg-white ring-1 ring-slate-100 overflow-hidden shadow-sm border-none w-full max-w-xs">
              <CardHeader className="bg-slate-50/50 border-b border-slate-200 p-4">
                <CardTitle className="text-xs font-black text-slate-900 uppercase tracking-widest">Resumen por Línea</CardTitle>
                <CardDescription className="text-slate-400 font-bold uppercase text-[8px] tracking-widest mt-0.5">
                  Cant. Prod. Neta
                </CardDescription>
              </CardHeader>
              <CardContent className="p-0">
                <ul className="divide-y divide-slate-100">
                  {resumenLineaProduccion.map(row => (
                    <li key={row.linea_produccion} className="flex items-center justify-between gap-3 px-4 py-2 text-[10px] hover:bg-slate-50 transition-colors">
                      <span className="font-black text-slate-700 uppercase truncate">{row.linea_produccion}</span>
                      <span className="font-mono font-black text-slate-800 shrink-0">{Math.round(row.totalCantidadProdNeta).toLocaleString()}</span>
                    </li>
                  ))}
                </ul>
              </CardContent>
            </Card>
          )}

          {planP2Guardado ? (
            <Card className="rounded-[2.5rem] bg-white ring-1 ring-slate-100 overflow-hidden shadow-sm border-none">
              <CardHeader className="bg-slate-50/50 border-b border-slate-200 p-10">
                <div className="flex items-center justify-between flex-wrap gap-4">
                  <div className="flex items-center gap-4">
                    <div className="bg-emerald-600 p-3 rounded-2xl text-white shadow-lg shrink-0">
                      <Lock className="w-6 h-6" />
                    </div>
                    <div>
                      <div className="flex items-center gap-2 flex-wrap">
                        <CardTitle className="text-2xl font-black text-slate-900 uppercase">Plan del Paso 2 Guardado</CardTitle>
                        <Badge className="bg-emerald-100 text-emerald-700 font-black text-[9px] px-2 py-0.5 rounded-md border-none">Modo Visualización</Badge>
                      </div>
                      <CardDescription className="text-slate-400 font-bold uppercase text-[10px] tracking-widest mt-1">
                        {(planP2GuardadoInfo?.planes.map(p => p.nombre_grupo) ?? forrosGruposList.map(g => g.nombre_grupo)).join(' · ')}
                        {planGrupoFecha && ` — ${planGrupoFecha}`}
                      </CardDescription>
                    </div>
                  </div>
                  <Button
                    onClick={() => setEditarPlanP2ConfirmOpen(true)}
                    variant="outline"
                    className="border-indigo-300 text-indigo-700 font-black uppercase tracking-widest text-[9px] px-5 py-2 rounded-xl flex items-center gap-2"
                  >
                    <Pencil className="w-3.5 h-3.5" /> Editar Plan
                  </Button>
                </div>
              </CardHeader>
              <CardContent className="p-0">
                {nivel4LaminaResumen.length > 0 ? (
                  <NivelResumenTable rows={nivel4LaminaResumen} codigoLabel="Código Lámina" referenciaSufijo=" de LÁMINA" />
                ) : (
                  <div className="py-20 text-center text-slate-400 uppercase font-black tracking-widest text-xs opacity-40">
                    Sin componentes de Nivel 4 (LÁMINA) para mostrar
                  </div>
                )}
              </CardContent>
            </Card>
          ) : (
            <>
          <Card className="rounded-[2.5rem] bg-white ring-1 ring-slate-100 overflow-hidden shadow-sm border-none">
            <CardHeader className="bg-slate-50/50 border-b border-slate-200 p-10">
              <div className="flex items-center justify-between flex-wrap gap-4">
                <div>
                  <CardTitle className="text-2xl font-black text-slate-900 uppercase">Nivel 1 · Componentes FORRO</CardTitle>
                  <CardDescription className="text-slate-400 font-bold uppercase text-[10px] tracking-widest mt-1">
                    Explosión por material FERT del Plan Táctico de Grupos, filtrada por la restricción COMPONENTES_CAPACIDAD_ENS
                    {componentesCapacidadEnsKeywords.length > 0 && ` (${componentesCapacidadEnsKeywords.join(' · ')})`}
                  </CardDescription>
                </div>
                <Button
                  onClick={handleExplosionarNiveles1a3}
                  disabled={isLoadingNivelExplosion || isLoadingNivel2 || isLoadingNivel3 || autoChainStep > 0 || fertMaterialesColchones.length === 0}
                  className="bg-indigo-600 hover:bg-indigo-700 text-white font-black uppercase tracking-widest text-[9px] px-5 py-2 rounded-xl disabled:opacity-40 flex items-center gap-2"
                >
                  {isLoadingNivelExplosion ? (
                    <><Loader2 className="w-3.5 h-3.5 animate-spin" /> Explosionando Nivel 1 · {nivelExplosionProgress}%</>
                  ) : isLoadingNivel2 ? (
                    <><Loader2 className="w-3.5 h-3.5 animate-spin" /> Explosionando Nivel 2 · {nivel2Progress}%</>
                  ) : isLoadingNivel3 ? (
                    <><Loader2 className="w-3.5 h-3.5 animate-spin" /> Explosionando Nivel 3 · {nivel3Progress}%</>
                  ) : (
                    <><Database className="w-3.5 h-3.5" /> Explosionar Componentes</>
                  )}
                </Button>
              </div>
            </CardHeader>
            <CardContent className="p-0">
              {isLoadingNivelExplosion ? (
                <div className="py-20 text-center text-slate-400 uppercase font-black tracking-widest text-xs flex items-center justify-center gap-2">
                  <Loader2 className="w-4 h-4 animate-spin" /> Consultando maestro de materiales ({nivelExplosionProgress}%)...
                </div>
              ) : !hasFetchedNivelExplosion ? (
                <div className="py-20 text-center text-slate-400 uppercase font-black tracking-widest text-xs opacity-40">
                  {fertMaterialesColchones.length === 0
                    ? 'Consulta primero el Plan Táctico de Grupos para obtener los materiales FERT a explosionar'
                    : `Presiona "Explosionar Componentes" para calcular automáticamente los Niveles 1, 2 y 3 sobre ${fertMaterialesColchones.length} material${fertMaterialesColchones.length === 1 ? '' : 'es'} FERT`}
                </div>
              ) : nivel1ForroResumen.length > 0 ? (
                <div className="grid grid-cols-1 lg:grid-cols-2 divide-y lg:divide-y-0 lg:divide-x divide-slate-100">
                  <NivelResumenTable rows={nivel1ForroResumenPorTipo.chn} codigoLabel="Código Forro" tituloBar="FORRO CHN · Colchones" tituloBarBg="bg-slate-900" />
                  <NivelResumenTable rows={nivel1ForroResumenPorTipo.base} codigoLabel="Código Forro" tituloBar="FORRO BASE · Bases" tituloBarBg="bg-emerald-800" />
                </div>
              ) : (
                <div className="py-20 text-center text-slate-400 uppercase font-black tracking-widest text-xs opacity-40">
                  No se encontraron componentes de Nivel 1 que coincidan con "FORRO"
                </div>
              )}
            </CardContent>
          </Card>

          <Card className="rounded-[2.5rem] bg-white ring-1 ring-slate-100 overflow-hidden shadow-sm border-none">
            <CardHeader className="bg-slate-50/50 border-b border-slate-200 p-10">
              <div className="flex items-center justify-between flex-wrap gap-4">
                <div>
                  <CardTitle className="text-2xl font-black text-slate-900 uppercase">Nivel 2 · Componentes TAPA</CardTitle>
                  <CardDescription className="text-slate-400 font-bold uppercase text-[10px] tracking-widest mt-1">
                    Explosión de cada FORRO del Nivel 1, filtrada por la restricción COMPONENTES_CAPACIDAD_ENS
                  </CardDescription>
                </div>
              </div>
            </CardHeader>
            <CardContent className="p-0">
              {isLoadingNivel2 ? (
                <div className="py-20 text-center text-slate-400 uppercase font-black tracking-widest text-xs flex items-center justify-center gap-2">
                  <Loader2 className="w-4 h-4 animate-spin" /> Consultando maestro de materiales ({nivel2Progress}%)...
                </div>
              ) : !hasFetchedNivel2 ? (
                <div className="py-20 text-center text-slate-400 uppercase font-black tracking-widest text-xs opacity-40">
                  {nivel1ForroResumen.length === 0
                    ? 'Explosiona primero el Nivel 1 (FORRO) con el botón "Explosionar Componentes"; el Nivel 2 se calcula automáticamente a continuación'
                    : 'Este nivel se calcula automáticamente al presionar "Explosionar Componentes" en el Nivel 1'}
                </div>
              ) : nivel2TapaResumen.length > 0 ? (
                <div className="grid grid-cols-1 lg:grid-cols-2 divide-y lg:divide-y-0 lg:divide-x divide-slate-100">
                  <NivelResumenTable rows={nivel2TapaResumenPorTipo.chn} codigoLabel="Código Tapa" tituloBar="TAPA CHN · Colchones" tituloBarBg="bg-slate-900" />
                  <NivelResumenTable rows={nivel2TapaResumenPorTipo.base} codigoLabel="Código Tapa" tituloBar="TAPA BASE · Bases" tituloBarBg="bg-emerald-800" />
                </div>
              ) : (
                <div className="py-20 text-center text-slate-400 uppercase font-black tracking-widest text-xs opacity-40">
                  No se encontraron componentes de Nivel 2 que coincidan con "TAPA"
                </div>
              )}
            </CardContent>
          </Card>

          <Card className="rounded-[2.5rem] bg-white ring-1 ring-slate-100 overflow-hidden shadow-sm border-none">
            <CardHeader className="bg-slate-50/50 border-b border-slate-200 p-10">
              <div className="flex items-center justify-between flex-wrap gap-4">
                <div>
                  <CardTitle className="text-2xl font-black text-slate-900 uppercase">Nivel 3 · Componentes ACOLCHADO</CardTitle>
                  <CardDescription className="text-slate-400 font-bold uppercase text-[10px] tracking-widest mt-1">
                    Explosión de cada TAPA del Nivel 2, filtrada por la restricción COMPONENTES_CAPACIDAD_ENS
                  </CardDescription>
                </div>
              </div>
            </CardHeader>
            <CardContent className="p-0">
              {isLoadingNivel3 ? (
                <div className="py-20 text-center text-slate-400 uppercase font-black tracking-widest text-xs flex items-center justify-center gap-2">
                  <Loader2 className="w-4 h-4 animate-spin" /> Consultando maestro de materiales ({nivel3Progress}%)...
                </div>
              ) : !hasFetchedNivel3 ? (
                <div className="py-20 text-center text-slate-400 uppercase font-black tracking-widest text-xs opacity-40">
                  {nivel2TapaResumen.length === 0
                    ? 'Explosiona primero el Nivel 1 (FORRO) con el botón "Explosionar Componentes"; el Nivel 3 se calcula automáticamente a continuación'
                    : 'Este nivel se calcula automáticamente al presionar "Explosionar Componentes" en el Nivel 1'}
                </div>
              ) : nivel3AcolchadoResumen.length > 0 ? (
                <NivelResumenTable rows={nivel3AcolchadoResumen} codigoLabel="Código Acolchado" referenciaSufijo=" de ACOLCHADO" />
              ) : (
                <div className="py-20 text-center text-slate-400 uppercase font-black tracking-widest text-xs opacity-40">
                  No se encontraron componentes de Nivel 3 que coincidan con "ACOLCHADO"
                </div>
              )}
            </CardContent>
          </Card>

          <Card className="rounded-[2.5rem] bg-white ring-1 ring-slate-100 overflow-hidden shadow-sm border-none">
            <CardHeader className="bg-slate-50/50 border-b border-slate-200 p-10">
              <div className="flex items-center justify-between flex-wrap gap-4">
                <div>
                  <CardTitle className="text-2xl font-black text-slate-900 uppercase">Factibilidad · Acolchado (Cuello de Botella)</CardTitle>
                  <CardDescription className="text-slate-400 font-bold uppercase text-[10px] tracking-widest mt-1">
                    Horas requeridas (Nivel 3) vs. capacidad disponible por puesto, según tiempos estándar
                    {acolchadoManualSplit && acolchadoTotalMovidos > 0 && (
                      <span className="ml-2 text-emerald-600">
                        · Cuadre automático aplicado ({acolchadoTotalMovidos} referencia{acolchadoTotalMovidos === 1 ? '' : 's'} movida{acolchadoTotalMovidos === 1 ? '' : 's'})
                      </span>
                    )}
                    {acolchadoCuadreDesactivado && (
                      <span className="ml-2 text-amber-600">
                        · Cuadre desactivado — viendo reparto original sin balancear
                      </span>
                    )}
                  </CardDescription>
                </div>
                <div className="flex items-center gap-3">
                  <div className="rounded-2xl bg-slate-50 ring-1 ring-slate-200 px-4 py-2.5 flex items-center gap-4">
                    <div className="flex items-center gap-1.5">
                      <Sun className="w-3.5 h-3.5 text-amber-500 shrink-0" />
                      <Select value={jornadaDiurnaSel} onValueChange={setJornadaDiurnaSel}>
                        <SelectTrigger className="h-8 w-[170px] text-[10px] font-black border-slate-200 rounded-lg">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {DIURNA_OPTIONS.map(opt => <SelectItem key={opt.value} value={opt.value} className="font-black text-[11px] py-2">{opt.label}</SelectItem>)}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <Moon className="w-3.5 h-3.5 text-indigo-500 shrink-0" />
                      <Select value={jornadaNocturnaSel} onValueChange={setJornadaNocturnaSel}>
                        <SelectTrigger className="h-8 w-[170px] text-[10px] font-black border-slate-200 rounded-lg">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {NOCTURNA_OPTIONS.map(opt => <SelectItem key={opt.value} value={opt.value} className="font-black text-[11px] py-2">{opt.label}</SelectItem>)}
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                  <Button
                    onClick={handleIrAPersonalTurnosAcolchado}
                    variant="outline"
                    className="border-indigo-300 text-indigo-700 font-black uppercase tracking-widest text-[9px] px-5 py-2 rounded-xl flex items-center gap-2"
                  >
                    <Users className="w-3.5 h-3.5" /> Ajustar Personal y Turnos
                  </Button>
                  {acolchadoCuadreDesactivado ? (
                    <Button
                      onClick={handleAplicarCuadreAcolchado}
                      disabled={acolchadoMateriales.length === 0}
                      className="bg-emerald-600 hover:bg-emerald-700 text-white font-black uppercase tracking-widest text-[9px] px-5 py-2 rounded-xl disabled:opacity-40 flex items-center gap-2"
                    >
                      <GitMerge className="w-3.5 h-3.5" /> Cuadrar Producción
                    </Button>
                  ) : (
                    <Button
                      onClick={handleDeshacerCuadreAcolchado}
                      variant="outline"
                      className="border-slate-300 text-slate-600 font-black uppercase tracking-widest text-[9px] px-5 py-2 rounded-xl"
                    >
                      Ver Sin Cuadre
                    </Button>
                  )}
                </div>
              </div>
            </CardHeader>
            <CardContent className="p-10">
              {!acolchadoFactibilidad ? (
                <div className="py-10 text-center text-slate-400 uppercase font-black tracking-widest text-xs opacity-40">
                  Explosiona primero el Nivel 3 (ACOLCHADO) para calcular la factibilidad
                </div>
              ) : (
                <div className="space-y-6">
                  <div className={cn(
                    'rounded-2xl p-6 flex items-center gap-4 border',
                    acolchadoFactibilidad.esFactible ? 'bg-green-50 border-green-200' : 'bg-red-50 border-red-200'
                  )}>
                    <div className={cn(
                      'p-3 rounded-xl text-white shadow-lg shrink-0',
                      acolchadoFactibilidad.esFactible ? 'bg-green-600' : 'bg-red-600'
                    )}>
                      {acolchadoFactibilidad.esFactible ? <CheckCircle2 className="w-6 h-6" /> : <AlertTriangle className="w-6 h-6" />}
                    </div>
                    <div>
                      <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">Veredicto</p>
                      <p className={cn('text-xl font-black uppercase', acolchadoFactibilidad.esFactible ? 'text-green-700' : 'text-red-700')}>
                        {acolchadoFactibilidad.esFactible ? 'Se puede fabricar' : 'No se puede fabricar'}
                      </p>
                      {acolchadoFactibilidad.puestosDeficit.length > 0 && (
                        <p className="text-[11px] text-red-600 font-bold mt-1">
                          Cuello de botella en: {acolchadoFactibilidad.puestosDeficit.map(p => p.puesto).join(', ')}
                        </p>
                      )}
                    </div>
                  </div>

                  <div className="overflow-x-auto rounded-2xl border border-slate-200">
                    <table className="w-full text-[11px] border-collapse">
                      <thead className="bg-slate-900 text-white text-left uppercase tracking-widest font-black">
                        <tr>
                          <th className="px-6 py-4 text-[10px]">Puesto</th>
                          <th className="px-6 py-4 text-[10px] text-right">Horas Requeridas</th>
                          <th className="px-6 py-4 text-[10px] text-right">Capacidad (h)</th>
                          <th className="px-6 py-4 text-[10px] text-right">% Utilización</th>
                          <th className="px-6 py-4 text-[10px] text-right">Déficit (h)</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {acolchadoFactibilidad.puestos.map((p) => (
                          <tr key={p.puesto} className={cn('text-[10px]', p.utilizacion > 100 ? 'bg-red-50/50' : 'hover:bg-slate-50')}>
                            <td className="px-6 py-4 font-black text-slate-800 uppercase">{p.puesto}</td>
                            <td className="px-6 py-4 text-right font-mono font-bold text-slate-700">{p.horasRequeridas.toFixed(2)}</td>
                            <td className="px-6 py-4 text-right font-mono font-bold text-slate-700">{p.capacidad.toFixed(2)}</td>
                            <td className={cn('px-6 py-4 text-right font-mono font-black', p.utilizacion > 100 ? 'text-red-600' : p.utilizacion >= 90 ? 'text-green-700' : 'text-yellow-600')}>
                              {Number.isFinite(p.utilizacion) ? `${p.utilizacion.toFixed(0)}%` : '—'}
                            </td>
                            <td className="px-6 py-4 text-right font-mono font-black text-red-600">
                              {p.deficitHoras > 0 ? p.deficitHoras.toFixed(2) : '—'}
                            </td>
                          </tr>
                        ))}
                        {acolchadoFactibilidad.puestos.length === 0 && (
                          <tr>
                            <td colSpan={5} className="py-10 text-center text-slate-400 uppercase font-black tracking-widest text-[10px] opacity-40">
                              No se identificó ningún puesto con tiempo estándar registrado
                            </td>
                          </tr>
                        )}
                      </tbody>
                    </table>
                  </div>

                  {acolchadoFactibilidad.puestos.length > 0 && (
                    <div className="overflow-x-auto rounded-2xl border border-slate-200">
                      <div className="px-6 py-3 bg-slate-900 text-white font-black text-[10px] uppercase tracking-widest">
                        Horarios Elegidos (Personal &amp; Turnos)
                      </div>
                      <table className="w-full text-[11px] border-collapse">
                        <thead className="bg-slate-50 text-slate-500 border-b border-slate-200 text-left uppercase tracking-widest font-black">
                          <tr>
                            <th className="px-6 py-3 text-[10px]">Puesto</th>
                            <th className="px-6 py-3 text-[10px]">Turno Día</th>
                            <th className="px-6 py-3 text-[10px]">Turno Noche</th>
                            <th className="px-6 py-3 text-[10px] text-right">Máquinas</th>
                            <th className="px-6 py-3 text-[10px] text-right">Personas</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                          {acolchadoFactibilidad.puestos.map((p) => (
                            <tr key={p.puesto} className="text-[10px] hover:bg-slate-50">
                              <td className="px-6 py-3 font-black text-slate-800 uppercase">{p.puesto}</td>
                              <td className="px-6 py-3 font-bold text-slate-600">
                                {p.cfg.isDayActive
                                  ? (DIURNA_OPTIONS.find(o => o.value === jornadaDiurnaSel)?.label || `${jornadaDiurnaSel} h`)
                                  : '—'}
                              </td>
                              <td className="px-6 py-3 font-bold text-slate-600">
                                {p.cfg.isNightActive
                                  ? (NOCTURNA_OPTIONS.find(o => o.value === jornadaNocturnaSel)?.label || `${jornadaNocturnaSel} h`)
                                  : '—'}
                              </td>
                              <td className="px-6 py-3 text-right font-mono font-bold text-slate-700">{p.cfg.machines || 1}</td>
                              <td className="px-6 py-3 text-right font-mono font-bold text-slate-700">{p.cfg.people || 0}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}

                  {acolchadoConsolidacionTurnos.length > 0 && (
                    <div className="rounded-2xl border border-amber-200 bg-amber-50/40 overflow-hidden">
                      <div className="px-6 py-3 bg-amber-600 text-white text-[10px] font-black uppercase tracking-widest flex items-center justify-between gap-4">
                        <span>Recomendación · Reducir Turnos (por máquina, no cambia el reparto real)</span>
                        <span className="font-mono normal-case">Ahorro total: {acolchadoConsolidacionTurnos.reduce((s, r) => s + r.ahorroTurnos, 0)} turno(s)</span>
                      </div>
                      <table className="w-full text-[11px] border-collapse">
                        <thead className="bg-slate-50 text-slate-500 border-b border-slate-200 text-left uppercase tracking-widest font-black">
                          <tr>
                            <th className="px-6 py-3 text-[10px]">Puesto</th>
                            <th className="px-6 py-3 text-[10px] text-right">Horas Requeridas</th>
                            <th className="px-6 py-3 text-[10px] text-right">Utilización Actual</th>
                            <th className="px-6 py-3 text-[10px]">Turno Día</th>
                            <th className="px-6 py-3 text-[10px]">Turno Noche</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                          {acolchadoConsolidacionTurnos.map(r => {
                            const cambioDia = r.actualDia !== r.recomendadoDia;
                            const cambioNoche = r.actualNoche !== r.recomendadoNoche;
                            return (
                              <tr key={r.puesto} className="text-[10px] hover:bg-white/60">
                                <td className="px-6 py-3 font-black text-slate-800 uppercase">{r.puesto}</td>
                                <td className="px-6 py-3 text-right font-mono font-bold text-slate-700">{r.horasRequeridas.toFixed(2)}</td>
                                <td className="px-6 py-3 text-right font-mono font-bold text-slate-700">{Number.isFinite(r.utilizacionActual) ? r.utilizacionActual.toFixed(0) : '—'}%</td>
                                <td className={cn('px-6 py-3 font-bold', cambioDia ? (r.recomendadoDia ? 'text-emerald-700' : 'text-red-600') : 'text-slate-500')}>
                                  {r.recomendadoDia ? 'Mantener activo' : 'Apagar'}
                                  {cambioDia && <span className="ml-1 opacity-60">(hoy: {r.actualDia ? 'activo' : 'apagado'})</span>}
                                </td>
                                <td className={cn('px-6 py-3 font-bold', cambioNoche ? (r.recomendadoNoche ? 'text-emerald-700' : 'text-red-600') : 'text-slate-500')}>
                                  {r.recomendadoNoche ? 'Mantener activo' : 'Apagar'}
                                  {cambioNoche && <span className="ml-1 opacity-60">(hoy: {r.actualNoche ? 'activo' : 'apagado'})</span>}
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                  )}

                  {acolchadoFactibilidad.puestos.length > 0 && (
                    <div className="space-y-3">
                      <p className="text-[9px] font-black uppercase text-slate-500 tracking-widest">Referencias Asignadas por Máquina</p>
                      {acolchadoFactibilidad.puestos.map(p => {
                        const refs = acolchadoAsignacionPorPuesto.get(p.puesto) || [];
                        return (
                          <details key={p.puesto} className="rounded-2xl border border-slate-200 bg-white overflow-hidden group" open={p.utilizacion > 100}>
                            <summary className={cn(
                              'cursor-pointer select-none px-6 py-4 flex items-center justify-between gap-4 text-[11px] font-black uppercase tracking-widest',
                              p.utilizacion > 100 ? 'bg-red-50 text-red-700' : 'bg-slate-50 text-slate-700'
                            )}>
                              <span>{p.puesto} — {refs.length} referencia{refs.length === 1 ? '' : 's'}</span>
                              <span className="font-mono">{p.horasRequeridas.toFixed(2)} h / {p.capacidad.toFixed(2)} h ({Number.isFinite(p.utilizacion) ? p.utilizacion.toFixed(0) : '—'}%)</span>
                            </summary>
                            <table className="w-full text-[11px] border-collapse">
                              <thead className="bg-slate-900 text-white text-left uppercase tracking-widest font-black">
                                <tr>
                                  <th className="px-6 py-3 text-[10px]">Material</th>
                                  <th className="px-6 py-3 text-[10px]">Descripción</th>
                                  <th className="px-6 py-3 text-[10px] text-right">Cantidad Asignada</th>
                                  <th className="px-6 py-3 text-[10px] text-right">Horas</th>
                                </tr>
                              </thead>
                              <tbody className="divide-y divide-slate-100">
                                {refs.map((r, i) => (
                                  <tr key={i} className="text-[10px] hover:bg-slate-50">
                                    <td className="px-6 py-3 font-mono font-bold text-slate-600">{r.material}</td>
                                    <td className="px-6 py-3 font-black text-slate-800 uppercase">
                                      {r.nombre}
                                      {r.movidoDesde && (
                                        <span className="ml-2 inline-flex items-center gap-1 bg-emerald-100 text-emerald-700 text-[9px] font-black uppercase tracking-widest px-2 py-0.5 rounded-full normal-case">
                                          <GitMerge className="w-3 h-3" /> Movido desde {r.movidoDesde}
                                        </span>
                                      )}
                                    </td>
                                    <td className="px-6 py-3 text-right font-mono font-bold text-slate-700">{Math.round(r.cantidad).toLocaleString()}</td>
                                    <td className="px-6 py-3 text-right font-mono font-bold text-slate-700">{r.horas.toFixed(2)}</td>
                                  </tr>
                                ))}
                                {refs.length === 0 && (
                                  <tr>
                                    <td colSpan={4} className="py-6 text-center text-slate-400 uppercase font-black tracking-widest text-[10px] opacity-40">
                                      Sin referencias asignadas
                                    </td>
                                  </tr>
                                )}
                              </tbody>
                            </table>
                          </details>
                        );
                      })}
                    </div>
                  )}

                  {acolchadoTapasProducibles.length > 0 && (
                    <div className="overflow-x-auto rounded-2xl border border-slate-200">
                      <div className="px-6 py-3 bg-slate-900 text-white font-black text-[10px] uppercase tracking-widest flex items-center justify-between">
                        <span>Tapas Producibles (según Cuadre de Acolchado)</span>
                        <span className="text-slate-300 font-mono normal-case tracking-normal">
                          {acolchadoTapasProducibles.filter(t => t.cobertura >= 100).length} / {acolchadoTapasProducibles.length} referencias al 100%
                        </span>
                      </div>
                      <table className="w-full text-[11px] border-collapse">
                        <thead className="bg-slate-50 text-slate-500 border-b border-slate-200 text-left uppercase tracking-widest font-black">
                          <tr>
                            <th className="px-6 py-3 text-[10px]">Código Tapa</th>
                            <th className="px-6 py-3 text-[10px]">Descripción</th>
                            <th className="px-6 py-3 text-[10px] text-right">Cantidad Requerida</th>
                            <th className="px-6 py-3 text-[10px] text-right">Cantidad Producible</th>
                            <th className="px-6 py-3 text-[10px] text-right">% Cobertura</th>
                            <th className="px-6 py-3 text-[10px]">Componente Limitante</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                          {paginatedAcolchadoTapasProducibles.map(t => (
                            <tr key={t.material} className={cn('text-[10px]', t.cobertura < 100 ? 'bg-red-50/50' : 'hover:bg-slate-50')}>
                              <td className="px-6 py-3 font-mono font-bold text-slate-600">{t.material}</td>
                              <td className="px-6 py-3 font-black text-slate-800 uppercase">{t.nombre}</td>
                              <td className="px-6 py-3 text-right font-mono font-bold text-slate-700">{Math.round(t.cantidadRequerida).toLocaleString()}</td>
                              <td className="px-6 py-3 text-right font-mono font-bold text-slate-700">{Math.round(t.cantidadProducible).toLocaleString()}</td>
                              <td className={cn('px-6 py-3 text-right font-mono font-black', t.cobertura < 100 ? 'text-red-600' : 'text-green-700')}>
                                {t.cobertura.toFixed(0)}%
                              </td>
                              <td className="px-6 py-3 font-mono font-bold text-slate-500">{t.componenteLimitante}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                      <div className="flex items-center justify-between px-6 py-4 border-t border-slate-200 bg-slate-50/50">
                        <div className="text-[10px] font-black uppercase tracking-widest text-slate-400">
                          {acolchadoTapasProducibles.length} referencia{acolchadoTapasProducibles.length === 1 ? '' : 's'}
                        </div>
                        <div className="flex items-center gap-1">
                          <Button variant="outline" size="icon" onClick={() => setAcolchadoTapasPage(1)} disabled={acolchadoTapasPage === 1} className="h-8 w-8"><ChevronsLeft className="h-4 w-4" /></Button>
                          <Button variant="outline" size="icon" onClick={() => setAcolchadoTapasPage(p => p - 1)} disabled={acolchadoTapasPage === 1} className="h-8 w-8"><ChevronLeft className="h-4 w-4" /></Button>
                          <div className="px-4 text-[11px] font-bold text-gray-700 min-w-[120px] text-center border-x py-1 bg-white rounded">Página {acolchadoTapasPage} de {acolchadoTapasTotalPages}</div>
                          <Button variant="outline" size="icon" onClick={() => setAcolchadoTapasPage(p => p + 1)} disabled={acolchadoTapasPage === acolchadoTapasTotalPages} className="h-8 w-8"><ChevronRight className="h-4 w-4" /></Button>
                          <Button variant="outline" size="icon" onClick={() => setAcolchadoTapasPage(acolchadoTapasTotalPages)} disabled={acolchadoTapasPage === acolchadoTapasTotalPages} className="h-8 w-8"><ChevronsRight className="h-4 w-4" /></Button>
                        </div>
                      </div>
                    </div>
                  )}

                  {acolchadoTapasResultado.porPuesto.size > 0 && (
                    <div className="space-y-3">
                      <p className="text-[9px] font-black uppercase text-slate-500 tracking-widest">Tapas Producibles por Máquina</p>
                      {acolchadoFactibilidad.puestos
                        .filter(p => (acolchadoTapasResultado.porPuesto.get(p.puesto) || []).length > 0)
                        .map(p => {
                          const filas = acolchadoTapasResultado.porPuesto.get(p.puesto) || [];
                          const desperdicio = acolchadoTapasResultado.desperdicioPorPuesto.get(p.puesto) || 0;
                          const totalUnidades = filas.reduce((s, f) => s + f.unidades, 0);
                          return (
                            <details key={p.puesto} className="rounded-2xl border border-slate-200 bg-white overflow-hidden group">
                              <summary className="cursor-pointer select-none px-6 py-4 flex items-center justify-between gap-4 text-[11px] font-black uppercase tracking-widest bg-slate-50 text-slate-700">
                                <span>{p.puesto} — {filas.length} referencia{filas.length === 1 ? '' : 's'} de tapa · {Math.round(totalUnidades).toLocaleString()} unidades</span>
                                {desperdicio > 0.01 && (
                                  <span className="font-mono text-amber-600">Sobrante sin usar: {desperdicio.toFixed(2)}</span>
                                )}
                              </summary>
                              <table className="w-full text-[11px] border-collapse">
                                <thead className="bg-slate-900 text-white text-left uppercase tracking-widest font-black">
                                  <tr>
                                    <th className="px-6 py-3 text-[10px]">Código Tapa</th>
                                    <th className="px-6 py-3 text-[10px]">Descripción</th>
                                    <th className="px-6 py-3 text-[10px]">Componente Acolchado</th>
                                    <th className="px-6 py-3 text-[10px] text-right">Unidades Producidas</th>
                                    <th className="px-6 py-3 text-[10px] text-right">Acolchado Consumido</th>
                                  </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-100">
                                  {filas.map((f, i) => (
                                    <tr key={i} className="text-[10px] hover:bg-slate-50">
                                      <td className="px-6 py-3 font-mono font-bold text-slate-600">{f.tapaMaterial}</td>
                                      <td className="px-6 py-3 font-black text-slate-800 uppercase">{f.tapaNombre}</td>
                                      <td className="px-6 py-3 font-mono font-bold text-slate-500">{f.materialAcolchado} — {f.materialNombre}</td>
                                      <td className="px-6 py-3 text-right font-mono font-bold text-slate-700">{Math.round(f.unidades).toLocaleString()}</td>
                                      <td className="px-6 py-3 text-right font-mono font-bold text-slate-700">{f.cantidadConsumida.toFixed(2)}</td>
                                    </tr>
                                  ))}
                                </tbody>
                              </table>
                            </details>
                          );
                        })}
                    </div>
                  )}

                  {acolchadoFactibilidad.sinTiempoEstandar.length > 0 && (
                    <div className="rounded-2xl border border-amber-200 bg-amber-50 p-5">
                      <p className="text-[10px] font-black uppercase tracking-widest text-amber-700 mb-2 flex items-center gap-2">
                        <AlertTriangle className="w-4 h-4" /> Materiales sin tiempo estándar ({acolchadoFactibilidad.sinTiempoEstandar.length})
                      </p>
                      <p className="text-[11px] text-amber-800">
                        No se pudo calcular su carga — no cuentan como déficit de capacidad, pero faltan datos para confirmar factibilidad total:{' '}
                        {acolchadoFactibilidad.sinTiempoEstandar.map(m => m.material).join(', ')}
                      </p>
                    </div>
                  )}

                  {materialesAcolchadoSinVersion.length > 0 && (
                    <div className="rounded-2xl border border-red-200 bg-red-50 p-5">
                      <p className="text-[10px] font-black uppercase tracking-widest text-red-700 mb-2 flex items-center gap-2">
                        <AlertTriangle className="w-4 h-4" /> Materiales sin Versión de Fabricación en SAP ({materialesAcolchadoSinVersion.length})
                      </p>
                      <p className="text-[11px] text-red-800">
                        No tienen Versión de Fabricación registrada para ninguna máquina candidata (Centro 1000) — se usó el tiempo más rápido como respaldo para asignar la máquina. Revisar en SAP:{' '}
                        {materialesAcolchadoSinVersion.join(', ')}
                      </p>
                    </div>
                  )}

                  {acolchadoRecomendaciones.length > 0 && (
                    <div className="space-y-3">
                      <p className="text-[9px] font-black uppercase text-slate-500 tracking-widest">Recomendaciones</p>
                      {acolchadoRecomendaciones.map(r => (
                        <div key={r.puesto} className="rounded-2xl border border-amber-200 bg-white p-5 shadow-sm">
                          <p className="text-xs font-black uppercase text-slate-900 mb-2">
                            {r.puesto} — déficit {r.deficitHoras.toFixed(2)} h ({Number.isFinite(r.utilizacion) ? r.utilizacion.toFixed(0) : '—'}%)
                          </p>
                          <ul className="space-y-1.5">
                            {r.recs.map((rec, i) => (
                              <li key={i} className="text-[11px] text-slate-600 leading-relaxed flex items-start gap-2">
                                <span className="text-amber-500 font-black shrink-0">▸</span>
                                <span>{rec}</span>
                              </li>
                            ))}
                          </ul>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </CardContent>
          </Card>

          <Card className="rounded-[2.5rem] bg-white ring-1 ring-slate-100 overflow-hidden shadow-sm border-none">
            <CardHeader className="bg-slate-50/50 border-b border-slate-200 p-10">
              <div className="flex items-center justify-between flex-wrap gap-4">
                <div>
                  <CardTitle className="text-2xl font-black text-slate-900 uppercase">Nivel 4 · Componentes LÁMINA</CardTitle>
                  <CardDescription className="text-slate-400 font-bold uppercase text-[10px] tracking-widest mt-1">
                    Explosión de cada ACOLCHADO del Nivel 3, filtrada por la restricción COMPONENTES_CAPACIDAD_ENS
                  </CardDescription>
                </div>
                <Button
                  onClick={fetchNivel4LaminaComponentes}
                  disabled={isLoadingNivel4 || nivel3AcolchadoResumen.length === 0}
                  className="bg-indigo-600 hover:bg-indigo-700 text-white font-black uppercase tracking-widest text-[9px] px-5 py-2 rounded-xl disabled:opacity-40 flex items-center gap-2"
                >
                  {isLoadingNivel4 ? (
                    <><Loader2 className="w-3.5 h-3.5 animate-spin" /> Explosionando {nivel4Progress}%</>
                  ) : (
                    <><Database className="w-3.5 h-3.5" /> Explosionar Componentes</>
                  )}
                </Button>
              </div>
            </CardHeader>
            <CardContent className="p-0">
              {isLoadingNivel4 ? (
                <div className="py-20 text-center text-slate-400 uppercase font-black tracking-widest text-xs flex items-center justify-center gap-2">
                  <Loader2 className="w-4 h-4 animate-spin" /> Consultando maestro de materiales ({nivel4Progress}%)...
                </div>
              ) : !hasFetchedNivel4 ? (
                <div className="py-20 text-center text-slate-400 uppercase font-black tracking-widest text-xs opacity-40">
                  {nivel3AcolchadoResumen.length === 0
                    ? 'Explosiona primero el Nivel 3 (ACOLCHADO) para obtener los materiales a explosionar'
                    : `Presiona "Explosionar Componentes" para calcular el Nivel 4 (LÁMINA) sobre ${nivel3AcolchadoResumen.length} material${nivel3AcolchadoResumen.length === 1 ? '' : 'es'} ACOLCHADO`}
                </div>
              ) : nivel4LaminaResumen.length > 0 ? (
                <>
                  <NivelResumenTable rows={nivel4LaminaResumen} codigoLabel="Código Lámina" referenciaSufijo=" de LÁMINA" />
                  <div className="flex items-center justify-end px-6 py-6 border-t border-slate-200 bg-slate-50/50">
                    <Button
                      onClick={handleGuardarPlanNivel4}
                      disabled={isSavingPlanNivel4 || planGrupoDetalleFiltrada.length === 0}
                      className="bg-emerald-600 hover:bg-emerald-700 text-white font-black uppercase tracking-widest text-[9px] px-5 py-2 rounded-xl disabled:opacity-40 flex items-center gap-2"
                    >
                      {isSavingPlanNivel4 ? (
                        <><Loader2 className="w-3.5 h-3.5 animate-spin" /> Guardando Plan...</>
                      ) : (
                        <><CheckCircle2 className="w-3.5 h-3.5" /> Guardar Plan</>
                      )}
                    </Button>
                  </div>
                </>
              ) : (
                <div className="py-20 text-center text-slate-400 uppercase font-black tracking-widest text-xs opacity-40">
                  No se encontraron componentes de Nivel 4 que coincidan con "LÁMINA"
                </div>
              )}
            </CardContent>
          </Card>
            </>
          )}

          <AlertDialog open={editarPlanP2ConfirmOpen} onOpenChange={(open) => { if (!open && !isDesactivandoPlanP2) setEditarPlanP2ConfirmOpen(false); }}>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>¿Cómo deseas continuar?</AlertDialogTitle>
                <AlertDialogDescription>
                  Ya existe un plan del Paso 2 guardado en esta sesión. Puedes desactivarlo (quedará en estado inactivo) para
                  empezar de cero, o generar uno nuevo dejando el plan actual activo tal como está — si guardas de nuevo, ambos
                  quedarán activos.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel disabled={isDesactivandoPlanP2}>Cancelar</AlertDialogCancel>
                <Button
                  variant="outline"
                  onClick={handleGenerarNuevoPlanP2}
                  disabled={isDesactivandoPlanP2}
                  className="border-indigo-300 text-indigo-700 font-black uppercase tracking-widest text-[9px] px-5 py-2 rounded-xl"
                >
                  Generar Uno Nuevo
                </Button>
                <AlertDialogAction
                  disabled={isDesactivandoPlanP2}
                  onClick={(e) => { e.preventDefault(); handleDesactivarPlanP2Guardado(); }}
                >
                  {isDesactivandoPlanP2 ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : 'Desactivar Plan Actual'}
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </TabsContent>
      </Tabs>
    </div>
  );
};
