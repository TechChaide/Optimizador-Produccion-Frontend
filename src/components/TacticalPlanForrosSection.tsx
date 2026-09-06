'use client';

import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import * as XLSX from 'xlsx';
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
  Unlock,
  Pencil,
  History,
  TrendingUp,
  TrendingDown,
  Lightbulb,
  Wrench,
  Download,
  RefreshCw,
  Gauge,
  Mail
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
import { maestroMaterialCentroService } from '@/services/MaestroMaterialCentro.service';
import { materialesBalanceoService } from '@/services/materialesBalanceo.service';
import { ecuadorHolidaysService } from '@/services/ecuador-holidays.service';
import { toFechaEcuador } from '@/lib/fecha-ecuador';
import type { Grupo, Restriccion, PlanGrupo, DetalleTactico, MaterialesBalanceo } from '@/types/interfaces';
import type { MaestroMaterialCentro } from '@/types/types';
import { cn } from '@/lib/utils';
import { useAppContext } from '@/context/AppProvider';
import { calcularTiempoMantenimiento } from '@/components/MantenimientoProgramadoSection';

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

// "Sin jornada" es el default: el fin de semana se habilita explícitamente en Jornada Global, y
// solo entonces se pueden marcar puestos de sábado y asignarles Personas Fin de Semana.
const FIN_DE_SEMANA_OPTIONS = [
  { value: "0", label: "Sin jornada" },
  { value: "6", label: "7:00 - 13:00 (6h)" },
  { value: "8.75", label: "7:00 - 15:45 (8.75h)" },
];

// Jornada de un día FERIADO: en feriado la planta o no trabaja, o trabaja con jornada reducida
// (recargo del 100%). Es un modo del día que se planifica, no un turno extra por puesto — por eso
// reemplaza las horas de la jornada diurna mientras está activo (ver `horasNetasDiurnasVal`).
const FERIADO_OPTIONS = [
  { value: "0", label: "No se trabaja (0h)" },
  { value: "6", label: "7:00 - 13:00 (6h)" },
  { value: "8.75", label: "7:00 - 15:45 (8.75h)" },
];

// Intentos por material en las explosiones de niveles. Una sola llamada fallida no puede tumbar
// toda la explosión (antes el catch envolvía el bucle completo y se perdía TODO lo acumulado).
const EXPLOSION_MAX_INTENTOS = 3;

// Tamaño de página al cargar el maestro de materiales (~85.000 filas totales). Pedirlo completo en
// una sola llamada pesa ~58 MB y tarda ~17 s — demasiado frágil ante cualquier corte de red.
const MAESTRO_MATERIALES_PAGE_SIZE = 10000;

// Tamaño de página al cargar los tiempos de ensamblado globales (~21.000 filas totales, ver
// fetchTiemposProduccion) — mismo criterio que el maestro de materiales.
const TIEMPOS_ENSAMBLADO_PAGE_SIZE = 10000;

// Duración mínima (horas) de un fragmento cuando el motor se ve OBLIGADO a partir una orden entre
// dos máquinas. Un pedazo más corto que su propio montaje no rinde en planta: es preferible dejar
// ese hueco de capacidad libre. Candidato natural a moverse a una restricción en base si el umbral
// llega a variar por proceso.
const FRAGMENTO_MINIMO_HORAS = 0.5;

// Clave de localStorage usada para que el plan de Personal y Turnos (Jornada Global + configuración
// por puesto) quede fijo durante TODA LA SEMANA en que se establece (definido el lunes, editable
// el resto de la semana sin perderse), y se reinicie automáticamente al detectar que ya es una
// semana distinta (ver `getLunesDeSemanaActual`).
const PERSONAL_TURNOS_STORAGE_KEY = 'optimizador_personal_turnos_v1';

// `toFechaEcuador` vive en @/lib/fecha-ecuador (helper único para toda la app): fecha calendario
// en hora de Ecuador, nunca UTC. Ver ahí el detalle del desfase que evita.
const getFechaLocalHoy = (): string => toFechaEcuador(new Date());

// Lunes (YYYY-MM-DD) de la semana que contiene hoy — base de la persistencia SEMANAL de Personal y
// Turnos: lo que se define el lunes rige toda la semana; si se edita a mitad de semana, el cambio
// se guarda bajo esta MISMA clave (no se pierde al día siguiente) y recién se reinicia al detectar
// un lunes distinto.
const getLunesDeSemanaActual = (): string => {
  const [y, m, d] = getFechaLocalHoy().split('-').map(Number);
  const fecha = new Date(y, m - 1, d);
  const diaSemana = fecha.getDay(); // 0=domingo, 1=lunes, ..., 6=sábado
  fecha.setDate(fecha.getDate() - (diaSemana === 0 ? 6 : diaSemana - 1));
  return `${fecha.getFullYear()}-${String(fecha.getMonth() + 1).padStart(2, '0')}-${String(fecha.getDate()).padStart(2, '0')}`;
};

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
      // COSEDORA-ACH13 se quitó a pedido del usuario: no se configura personal ni turnos para ella.
      "ACOLCHADORA13",
      "ACH02", "ACH06", "ACH07", "ACH08", "ACH09", "ACH10", "ACH13",
      "PEGADORA-ACH02", "PEGADORA-ACH06", "PEGADORA-ACH07", "PEGADORA-ACH08", "PEGADORA-ACH09", "PEGADORA-ACH10", "PEGADORA-ACH13",
      "PEF02", "PEF06", "PEF07", "PEF08", "PEF09", "PEF10", "PEF13"
    ]
  },
  {
    title: "Procesos de Bandas y Bordado",
    items: [
      "ACOLCHADORA11", "ACOLCHADORA12", "ACH11", "ACH12",
      "BORDADORA-BANDA01", "BO01",
      "COSEDORA-RMTB1", "COSEDORA-RMTB2", "COSEDORA-RMTB3", "COSEDORA-RMTBM",
      "COS3D", "COSEDORA-BANDA3D", "ENCINTADOBD", "COSEDORA-ENCINTADOBD"
    ]
  },
  {
    title: "Interiores, Bases y Corte",
    items: [
      "INTP-PR", "INTP-PT", "INTP-F", "INTPF",
      "COSEDORA-INTPF",
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

// Puestos de "Interiores, Bases y Corte": la capacidad se calcula por PERSONAS asignadas, no por
// máquinas (el dato de máquinas ahí es solo informativo) — a diferencia de Acolchado, Bordadora,
// Encintado y el resto de categorías, que siguen calculando su capacidad por número de máquinas.
const PUESTOS_CAPACIDAD_POR_PERSONAS = new Set(
  workstationGroups.find(g => g.title === 'Interiores, Bases y Corte')?.items ?? []
);
// Factor "por turno" — para puestos de personas, la cantidad de gente puede ser distinta en el
// turno diurno y en el nocturno (ej. 3 personas de día, 1 de noche); para puestos por máquinas,
// el número de máquinas es el mismo sin importar el turno. Se mantiene por compatibilidad con los
// usos que solo necesitan "el factor", no la capacidad completa (ver capacidadPuesto más abajo).
// El turno "sábado" tiene su PROPIO número de personas (`peopleWeekend`): el fin de semana no
// suele trabajar la misma dotación que un día normal. Solo aplica si ese puesto participa de la
// jornada de fin de semana (`isSaturdayActive`) y si esa jornada está habilitada en Jornada Global.
const factorCapacidadPuestoPorTurno = (
  puesto: string,
  cfg: { peopleDay?: number; peopleNight?: number; peopleWeekend?: number; machines?: number },
  turno: 'dia' | 'noche' | 'sabado',
): number => (
  PUESTOS_CAPACIDAD_POR_PERSONAS.has(puesto)
    ? (turno === 'noche' ? (cfg.peopleNight || 0) : turno === 'sabado' ? (cfg.peopleWeekend || 0) : (cfg.peopleDay || 0))
    : (cfg.machines || 1)
);

// Capacidad total de un puesto en horas: para puestos por personas, el turno diurno usa
// `peopleDay` y el nocturno usa `peopleNight` (cada uno su propio número, ya no uno compartido);
// para puestos por máquinas, el número de máquinas es el mismo en ambos turnos (sin cambios).
// El sábado es un tercer turno opcional por puesto (`isSaturdayActive`), con sus propias horas
// (Jornada Fin de Semana, global) — se suma solo si el puesto lo tiene activado.
// Horas que se pierden por CAPACITACIÓN en un puesto: se resta de la capacidad dentro de
// `capacidadPuesto`, o sea en un solo lugar — así el descuento llega igual a Personal & Turnos, a
// las tarjetas de Ajuste de Producción y a los motores de asignación, sin que ninguno pueda quedar
// calculando con horas que en realidad no existen.
//
// Aplica a CUALQUIER puesto, pero el cálculo cambia según cómo se mida su capacidad:
// - Puestos por PERSONAS (Interiores, Bases y Corte): personas × horas — cuantas más personas se
//   capacitan a la vez, más horas-persona se pierden.
// - Puestos por MÁQUINAS (Acolchadoras, Cosedoras, Bandas, RMTB, Forros): solo las horas — la
//   máquina queda detenida ese tiempo sin importar cuánta gente participe de la capacitación.
const horasCapacitacionPuesto = (
  puesto: string,
  cfg: { capacitacionPersonas?: number; capacitacionHoras?: number },
): number => (
  PUESTOS_CAPACIDAD_POR_PERSONAS.has(puesto)
    ? Math.max(0, (cfg.capacitacionPersonas || 0) * (cfg.capacitacionHoras || 0))
    : Math.max(0, cfg.capacitacionHoras || 0)
);

// Horas netas entre dos horas "HH:MM" de un turno personalizado, con la misma eficiencia operativa
// (84%) que el resto de la app. Soporta turnos que cruzan medianoche (ej. 21:00 a 05:30).
const horasNetasTurnoPersonalizado = (horaInicio: string, horaFin: string): number => {
  const toMinutos = (h: string) => {
    const [hh, mm] = String(h || '0:0').split(':').map(Number);
    return (hh || 0) * 60 + (mm || 0);
  };
  const inicio = toMinutos(horaInicio);
  let fin = toMinutos(horaFin);
  if (fin <= inicio) fin += 24 * 60;
  return ((fin - inicio) / 60) * 0.84;
};

interface TurnoPersonalizado {
  horaInicio: string;
  horaFin: string;
  personas: number;
}

// Capacidad de un puesto que reemplazó sus 3 turnos fijos (Día/Noche/Sábado, Jornada Global) por su
// propia lista de turnos con horario libre — mismo caso de la Jornada Global apagada/prendida por
// turno, pero aquí es "un turno más o uno menos", no fijo a 3.
const capacidadTurnosPersonalizados = (
  puesto: string,
  cfg: { machines?: number; turnosPersonalizados?: TurnoPersonalizado[] },
): number => (cfg.turnosPersonalizados || []).reduce((sum, t) => {
  const factor = PUESTOS_CAPACIDAD_POR_PERSONAS.has(puesto) ? (t.personas || 0) : (cfg.machines || 1);
  return sum + horasNetasTurnoPersonalizado(t.horaInicio, t.horaFin) * factor;
}, 0);

// Disponibilidad (OEE) del puesto: fracción 0-1 que llega de la restricción `DISPONIBILIDAD_
// <PUESTO>` (grupo Forros, ver `disponibilidadPorPuesto` más abajo) y se sincroniza dentro de
// `workstationConfigs[puesto].disponibilidad` — mismo patrón que Capacitación (un campo más del
// WorkstationConfig, sin necesidad de tocar ninguno de los ~16 lugares que llaman a
// `capacidadPuesto`). Si el puesto no tiene restricción cargada, `?? 1` = 100%, sin reducir nada.
const capacidadPuesto = (
  puesto: string,
  cfg: {
    peopleDay?: number; peopleNight?: number; peopleWeekend?: number; machines?: number;
    isDayActive?: boolean; isNightActive?: boolean; isSaturdayActive?: boolean;
    capacitacionPersonas?: number; capacitacionHoras?: number;
    horarioPersonalizadoActivo?: boolean; turnosPersonalizados?: TurnoPersonalizado[];
    disponibilidad?: number;
  },
  horasNetasDiurnas: number,
  horasNetasNocturnas: number,
  horasNetasFinSemana: number = 0,
): number => Math.max(0,
  ((cfg.horarioPersonalizadoActivo && (cfg.turnosPersonalizados || []).length > 0
    ? capacidadTurnosPersonalizados(puesto, cfg)
    : (cfg.isDayActive ? horasNetasDiurnas * factorCapacidadPuestoPorTurno(puesto, cfg, 'dia') : 0) +
      (cfg.isNightActive ? horasNetasNocturnas * factorCapacidadPuestoPorTurno(puesto, cfg, 'noche') : 0) +
      (cfg.isSaturdayActive ? horasNetasFinSemana * factorCapacidadPuestoPorTurno(puesto, cfg, 'sabado') : 0))
  - horasCapacitacionPuesto(puesto, cfg)) * (cfg.disponibilidad ?? 1)
);

interface WorkstationConfig {
  machine: string;
  isDayActive: boolean;
  isNightActive: boolean;
  isSaturdayActive: boolean;
  peopleDay: number;
  peopleNight: number;
  peopleWeekend: number;
  machines: number;
  // Capacitación del día (opcionales: los ~23 literales de configuración por defecto no los fijan).
  // Universal para cualquier puesto — ver `horasCapacitacionPuesto` para cómo cambia el cálculo
  // entre puestos por personas (personas × horas) y por máquinas (solo horas).
  capacitacionPersonas?: number;
  capacitacionHoras?: number;
  capacitacionMotivo?: string;
  // Disponibilidad (OEE) mensual, fracción 0-1 — viene de la restricción `DISPONIBILIDAD_<PUESTO>`
  // (grupo Forros), NUNCA se edita a mano aquí (se sincroniza sola, ver el efecto correspondiente).
  disponibilidad?: number;
  // Horario Personalizado: reemplaza los 3 turnos fijos (Jornada Global) por una lista propia de
  // turnos con horario libre, solo para este puesto puntual.
  horarioPersonalizadoActivo?: boolean;
  turnosPersonalizados?: TurnoPersonalizado[];
}

const MachineCard = React.memo(({
  puestoName,
  small = false,
  orders,
  calculateProductionTime,
  config,
  horasNetasDiurnas,
  horasNetasNocturnas,
  horasNetasFinSemana = 0,
  mapToHojaRuta,
  normalizeMaterialCode,
  isConsolidated = false,
  adjustedInOrders = [],
  excludeOrderKeys,
  excessOrderKeys,
  splitRemainderOrders = [],
  blockedOrderKeys,
  onToggleBlock,
  qtyOverrideByKey,
}: {
  puestoName: string;
  small?: boolean;
  orders: any[];
  calculateProductionTime: (material: string, quantity: number, order: any) => number;
  config: WorkstationConfig;
  horasNetasDiurnas: number;
  horasNetasNocturnas: number;
  horasNetasFinSemana?: number;
  mapToHojaRuta: (name: string) => string;
  normalizeMaterialCode: (code: string | number) => string;
  isConsolidated?: boolean;
  adjustedInOrders?: any[];
  excludeOrderKeys?: Set<string>;
  excessOrderKeys?: Set<string>;
  splitRemainderOrders?: any[];
  blockedOrderKeys?: Set<string>;
  onToggleBlock?: (order: any) => void;
  // Cantidad efectiva por orden (key -> cantidad), cuando algo externo reduce lo que hay que
  // fabricar sin que la orden desaparezca — hoy: Acolchado descontado porque su Tapa fue
  // bloqueada. Se aplica al mostrar Y al calcular horas, así el % de ocupación de la barra de
  // capacidad refleja el descuento. No se toca la CANTIDAD original de la orden a propósito:
  // las keys de bloqueo se construyen con ella y dejarían de coincidir si se mutara.
  qtyOverrideByKey?: Map<string, number>;
}) => {
  const hrCode = mapToHojaRuta(puestoName).trim().toUpperCase();
  // El sábado aporta capacidad solo si el puesto lo tiene marcado Y la Jornada Fin de Semana está
  // habilitada en Jornada Global (si está en "Sin jornada", horasNetasFinSemana llega en 0).
  const sabadoAporta = !!config.isSaturdayActive && horasNetasFinSemana > 0;

  const { filteredOrders, totalTimeHours, utilization, capacityHours, utilizationSinDescuento, horasDescontadas, horasSinUbicar, horasLibres } = useMemo(() => {
    const makeKey = (o: any) => `${o['ORDEN'] || o['ORDENPREVISIONAL'] || ''}|${String(o['MATERIAL'] || o['CodMaterial'] || '')}|${String(o['CANTIDAD'] || o['CANTPROGRAMADA'] || '')}`;

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
        const qtyOriginal = Number(o['CANTIDAD'] || o['CANTPROGRAMADA'] || 0);
        // La cantidad que se consolida es la EFECTIVA (ya descontada por Tapa bloqueada). Antes se
        // sumaba la original, así que en vista consolidada el descuento no llegaba ni a las horas ni
        // al % de ocupación — la barra mostraba una carga mayor a la que realmente se va a fabricar.
        const qty = qtyOverrideByKey?.get(makeKey(o)) ?? qtyOriginal;
        if (grouped.has(materialCode)) {
          const existing = grouped.get(materialCode);
          existing._totalQty += qty;
          existing._totalQtyOriginal += qtyOriginal;
        } else {
          grouped.set(materialCode, {
            ...o,
            _isConsolidated: true,
            _totalQty: qty,
            _totalQtyOriginal: qtyOriginal
          });
        }
      });
      filtered = Array.from(grouped.values());
    }

    const allOrders = [...filtered, ...adjustedTagged, ...remainderTagged];

    // Las órdenes en exceso (no caben en la capacidad tras el ajuste) se siguen listando en la
    // tabla, pero NO cuentan para el % de Ocupación mostrado — ese % debe reflejar solo lo
    // realmente producible, nunca un número crudo por encima de 100% sin contexto.
    const totalSeconds = allOrders.reduce((sum, o) => {
      if (excessOrderKeys?.has(makeKey(o))) return sum;
      if (blockedOrderKeys?.has(makeKey(o))) return sum;
      const qty = isConsolidated && o._isConsolidated
        ? o._totalQty
        : (qtyOverrideByKey?.get(makeKey(o)) ?? Number(o['CANTIDAD'] || o['CANTPROGRAMADA'] || 0));
      return sum + calculateProductionTime(o['MATERIAL'] || o['CodMaterial'] || '', qty, o);
    }, 0);

    // Horas de las órdenes que el motor NO pudo ubicar en ninguna máquina (exceso). No cuentan en
    // el % —ese refleja solo lo producible— pero deben mostrarse: si no, una máquina con órdenes
    // sin ubicar se ve con "capacidad libre" y parece que ahí cabe algo más, cuando en realidad
    // hay trabajo pendiente que no entró.
    const horasSinUbicar = allOrders.reduce((sum, o) => {
      if (!excessOrderKeys?.has(makeKey(o))) return sum;
      if (blockedOrderKeys?.has(makeKey(o))) return sum;
      const qty = isConsolidated && o._isConsolidated
        ? Number(o._totalQty ?? 0)
        : (qtyOverrideByKey?.get(makeKey(o)) ?? Number(o['CANTIDAD'] || o['CANTPROGRAMADA'] || 0));
      return sum + calculateProductionTime(o['MATERIAL'] || o['CodMaterial'] || '', qty, o);
    }, 0) / 3600;

    // Misma suma pero SIN aplicar los descuentos por Tapa bloqueada: sirve para mostrar el punto de
    // partida ("iba en 128%, con los bloqueos va en 98%") y saber cuánto se ha ganado.
    const totalSecondsSinDescuento = allOrders.reduce((sum, o) => {
      if (excessOrderKeys?.has(makeKey(o))) return sum;
      if (blockedOrderKeys?.has(makeKey(o))) return sum;
      const qty = isConsolidated && o._isConsolidated
        ? Number(o._totalQtyOriginal ?? o._totalQty ?? 0)
        : Number(o['CANTIDAD'] || o['CANTPROGRAMADA'] || 0);
      return sum + calculateProductionTime(o['MATERIAL'] || o['CodMaterial'] || '', qty, o);
    }, 0);

    const totalHours = totalSeconds / 3600;
    // Se usa el MISMO `capacidadPuesto` que el resto de la app (motores de ajuste, Personal &
    // Turnos): incluye el turno de SÁBADO (`isSaturdayActive` × Jornada Fin de Semana), que antes
    // esta tarjeta ignoraba, y respeta que los puestos de "Interiores, Bases y Corte" midan su
    // capacidad por PERSONAS y no por máquinas. Antes la tarjeta calculaba a mano solo día+noche
    // × máquinas, así que su % de ocupación no coincidía con la capacidad que asume el motor.
    const capacity = capacidadPuesto(puestoName, config, horasNetasDiurnas, horasNetasNocturnas, horasNetasFinSemana);
    const util = capacity > 0 ? (totalHours / capacity) * 100 : 0;
    const horasSinDescuento = totalSecondsSinDescuento / 3600;
    const utilSinDescuento = capacity > 0 ? (horasSinDescuento / capacity) * 100 : 0;

    return {
      filteredOrders: allOrders,
      totalTimeHours: totalHours,
      utilization: util,
      capacityHours: capacity,
      utilizationSinDescuento: utilSinDescuento,
      horasDescontadas: horasSinDescuento - totalHours,
      horasSinUbicar,
      horasLibres: Math.max(0, capacity - totalHours),
    };
  }, [orders, hrCode, puestoName, calculateProductionTime, config, horasNetasDiurnas, horasNetasNocturnas, horasNetasFinSemana, isConsolidated, normalizeMaterialCode, adjustedInOrders, excludeOrderKeys, splitRemainderOrders, excessOrderKeys, blockedOrderKeys, qtyOverrideByKey]);

  // Hay descuento visible cuando la carga efectiva bajó respecto de la original (Tapas bloqueadas).
  const hayDescuento = horasDescontadas > 0.01;

  return (
    <div className="flex flex-col border border-slate-200 rounded-[2rem] overflow-hidden shadow-sm bg-white transition-all hover:shadow-lg">
      <div className="bg-slate-50/50 p-6 text-slate-900 flex flex-col border-b border-slate-100">
        <div className="mb-4">
          <Badge className="bg-indigo-600 text-white font-black text-[9px] uppercase tracking-widest px-2.5 py-0.5 rounded-lg border-none shadow-sm mb-2 inline-block">
            {hrCode || 'S/HR'}
          </Badge>
          <h3 className="text-xl font-black uppercase tracking-tighter text-indigo-950 flex items-center gap-2 break-words leading-tight">
            <Cpu className="w-5 h-5 text-indigo-600 shrink-0" />
            <span>{puestoName}</span>
          </h3>

          <div className="flex items-center gap-2 mt-3">
            <div className="flex flex-col items-center justify-center bg-white border-2 border-dashed border-sky-300 w-12 h-12 rounded-xl shadow-sm shrink-0">
              <span className="text-lg font-black text-sky-700 leading-none">{config.machines || 1}</span>
              <span className="text-[6px] font-black uppercase text-sky-400 mt-0.5 tracking-tighter">Máquinas</span>
            </div>
            <div className="flex flex-col items-center justify-center bg-white border-2 border-dashed border-indigo-300 w-12 h-12 rounded-xl shadow-sm shrink-0">
              <span className="text-lg font-black text-indigo-700 leading-none">{(config.peopleDay || 0) + (config.peopleNight || 0)}</span>
              <span className="text-[6px] font-black uppercase text-indigo-400 mt-0.5 tracking-tighter">Personas</span>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-4 items-stretch">
          <div className="bg-white p-3.5 rounded-2xl border border-slate-100 shadow-sm flex flex-col">
            <div className="flex justify-between items-center text-[9px] text-slate-400 uppercase font-black tracking-widest mb-2">Turnos Activos</div>
            {/* El sábado solo se muestra si aporta horas de verdad (puesto marcado + Jornada Fin de
                Semana habilitada en Jornada Global) — así se ve de un vistazo si está entrando al
                cálculo de la capacidad, en vez de tener que deducirlo del %. Cada turno muestra sus
                propias horas netas (no solo si está activo), para no tener que ir a Personal y
                Turnos a ver cuánto aporta cada uno. */}
            <div className={cn("grid gap-2", sabadoAporta ? "grid-cols-3" : "grid-cols-2")}>
              <div className={cn("rounded-xl p-2 border flex flex-col items-center", config.isDayActive ? "bg-amber-50 border-amber-200" : "bg-slate-50 border-slate-100 opacity-40")}>
                <Sun className={cn("w-3.5 h-3.5 mb-0.5", config.isDayActive ? "text-amber-500" : "text-slate-400")} />
                <span className={cn("text-[8px] font-black uppercase", config.isDayActive ? "text-amber-700" : "text-slate-400")}>Día</span>
                {config.isDayActive && <span className="text-[7px] font-mono font-bold text-amber-500 mt-0.5">{horasNetasDiurnas.toFixed(2)}h</span>}
              </div>
              <div className={cn("rounded-xl p-2 border flex flex-col items-center", config.isNightActive ? "bg-indigo-50 border-indigo-200" : "bg-slate-50 border-slate-100 opacity-40")}>
                <Moon className={cn("w-3.5 h-3.5 mb-0.5", config.isNightActive ? "text-indigo-500" : "text-slate-400")} />
                <span className={cn("text-[8px] font-black uppercase", config.isNightActive ? "text-indigo-700" : "text-slate-400")}>Noche</span>
                {config.isNightActive && <span className="text-[7px] font-mono font-bold text-indigo-500 mt-0.5">{horasNetasNocturnas.toFixed(2)}h</span>}
              </div>
              {sabadoAporta && (
                <div className="rounded-xl p-2 border flex flex-col items-center bg-emerald-50 border-emerald-200">
                  <CalendarIcon className="w-3.5 h-3.5 mb-0.5 text-emerald-500" />
                  <span className="text-[8px] font-black uppercase text-emerald-700">Sábado</span>
                  <span className="text-[7px] font-mono font-bold text-emerald-500 mt-0.5">{horasNetasFinSemana.toFixed(2)}h</span>
                </div>
              )}
            </div>
            {/* Disponibilidad (OEE) y Capacitación — solo si aplican, para no ensuciar la tarjeta de
                puestos que no las tienen cargadas. Mismos datos que Personal y Turnos, aquí a la vista
                sin tener que salir de Ajuste de Producción. */}
            {((config.disponibilidad !== undefined && config.disponibilidad < 1) || horasCapacitacionPuesto(puestoName, config) > 0) && (
              <div className="flex items-center justify-center gap-2 mt-2 flex-wrap">
                {config.disponibilidad !== undefined && config.disponibilidad < 1 && (
                  <span className="inline-flex items-center gap-1 text-[7px] font-black uppercase text-cyan-600 bg-cyan-50 border border-cyan-200 rounded-md px-1.5 py-0.5">
                    <Gauge className="w-2.5 h-2.5" /> {(config.disponibilidad * 100).toFixed(0)}% disp.
                  </span>
                )}
                {horasCapacitacionPuesto(puestoName, config) > 0 && (
                  <span className="text-[7px] font-black uppercase text-violet-600 bg-violet-50 border border-violet-200 rounded-md px-1.5 py-0.5">
                    − {horasCapacitacionPuesto(puestoName, config).toFixed(1)}h capac.
                  </span>
                )}
              </div>
            )}
            <p className="mt-2 text-[8px] font-black uppercase tracking-tighter text-slate-400 text-center">
              Capacidad {capacityHours.toFixed(2)} h
            </p>
          </div>

          <div className="bg-white p-4 rounded-2xl border border-slate-100 shadow-sm">
            <div className="flex items-center justify-between mb-2">
              <p className="text-[10px] font-black uppercase text-slate-500">Ocupación</p>
              <Badge className={cn(
                "text-[8px] font-black px-1.5 py-0.5 rounded-md border-none inline-flex items-center gap-1",
                utilization > 100 ? "bg-red-100 text-red-700" :
                utilization >= 90 ? "bg-green-100 text-green-700" :
                "bg-yellow-100 text-yellow-700"
              )}>
                {utilization > 100 ? <AlertTriangle className="w-2.5 h-2.5" /> : utilization >= 90 ? <CheckCircle2 className="w-2.5 h-2.5" /> : <TrendingDown className="w-2.5 h-2.5" />}
                {utilization > 100 ? "Sobrecapacidad" : utilization >= 90 ? "Estable" : "Baja"}
              </Badge>
            </div>
            <div className="flex items-baseline gap-1 mb-2">
              {/* Con descuentos aplicados se muestra el punto de partida tachado: "128% → 98%", para
                  ver de un vistazo cuánto bajó la carga por las Tapas bloqueadas y decidir si hace
                  falta bloquear más o si ya se llegó a capacidad. */}
              {hayDescuento && (
                <span className="text-sm font-black font-mono tracking-tighter text-slate-300 line-through mr-0.5">
                  {utilizationSinDescuento.toFixed(0)}%
                </span>
              )}
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
               {/* Franja tenue con la ocupación ANTES de los descuentos, detrás de la barra real. */}
               {hayDescuento && (
                 <div
                   className="absolute inset-y-0 left-0 bg-orange-200/70"
                   style={{ width: `${Math.min(utilizationSinDescuento, 100)}%` }}
                 />
               )}
               <div
                 className={cn(
                   "relative h-full transition-all duration-700 ease-out",
                   utilization > 100 ? "bg-red-500" :
                   utilization >= 90 ? "bg-green-500" :
                   "bg-yellow-400"
                 )}
                 style={{ width: `${Math.min(utilization, 100)}%` }}
               />
            </div>
            {hayDescuento && (
              <p className="text-[8px] font-black uppercase tracking-tighter text-orange-600 text-center leading-tight">
                −{horasDescontadas.toFixed(2)} h por Tapas bloqueadas
                {utilizationSinDescuento > 100 && utilization <= 100 && ' · ya entra en capacidad'}
              </p>
            )}
            {/* El hueco libre y lo que quedó sin ubicar, explícitos: sin esto, una máquina con
                órdenes que no entraron se ve con "capacidad libre" y parece que ahí cabe más.
                El hueco puede ser deliberado — no se rellena si el precio es partir una orden. */}
            {(horasSinUbicar > 0.01 || horasLibres > 0.01) && (
              <p className="text-[8px] font-black uppercase tracking-tighter text-center leading-tight">
                {horasLibres > 0.01 && (
                  <span className="text-slate-400">Libre {horasLibres.toFixed(2)} h</span>
                )}
                {horasSinUbicar > 0.01 && (
                  <span className="text-red-600">
                    {horasLibres > 0.01 ? ' · ' : ''}{horasSinUbicar.toFixed(2)} h sin ubicar
                  </span>
                )}
              </p>
            )}

            <div className="mt-3 flex items-center justify-center gap-1 h-4">
              {utilization > 100 ? (
                <span className="inline-flex items-center gap-1 text-[9px] font-black uppercase text-red-600 tracking-tighter animate-pulse">
                  <AlertTriangle className="w-3 h-3" /> Sobrecapacidad
                </span>
              ) : utilization >= 90 ? (
                <span className="inline-flex items-center gap-1 text-[9px] font-black uppercase text-green-600 tracking-tighter">
                  <CheckCircle2 className="w-3 h-3" /> Estable
                </span>
              ) : (
                <span className="inline-flex items-center gap-1 text-[9px] font-black uppercase text-yellow-600 tracking-tighter animate-pulse">
                  <TrendingDown className="w-3 h-3" /> Debajo de capacidad
                </span>
              )}
            </div>
          </div>
        </div>
      </div>
      
      <div className="p-6 flex flex-col bg-slate-50/20">
        <div className="flex items-center justify-between mb-4">
          <h4 className="text-[10px] font-black text-slate-800 uppercase tracking-[0.2em] flex items-center gap-2">
            <ClipboardList className="w-4 h-4 text-indigo-600" /> {isConsolidated ? 'Carga Consolidada' : 'Plan Operativo'}
          </h4>
          <Badge className="bg-white text-slate-900 border-slate-200 font-mono font-black text-[10px] px-3 py-0.5 rounded-full shadow-sm">
            {filteredOrders.length} {isConsolidated ? 'MATERIALES' : 'ÓRDENES'}
          </Badge>
        </div>
        <div className={cn(
          "overflow-y-auto rounded-2xl border border-slate-200 bg-white shadow-inner text-[10px]",
          small ? "h-[220px]" : "h-[260px]"
        )}>
          <table className="w-full min-w-full border-collapse">
            <thead className="bg-slate-100/80 sticky top-0 z-10 text-slate-500 font-black uppercase tracking-widest text-left">
              <tr>
                <th className="px-4 py-3 border-b border-slate-200">MATERIAL</th>
                <th className="px-4 py-3 border-b border-slate-200 min-w-[150px]">NOMBRE</th>
                <th className="px-4 py-3 border-b border-slate-200 text-right">CANT</th>
                <th className="px-4 py-3 border-b border-slate-200 text-center text-indigo-700 bg-indigo-50/30">H</th>
                {onToggleBlock && <th className="px-4 py-3 border-b border-slate-200 text-center">BLOQUEO</th>}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filteredOrders.length > 0 ? filteredOrders.map((o, i) => {
                const makeKey = (ord: any) => `${ord['ORDEN'] || ord['ORDENPREVISIONAL'] || ''}|${String(ord['MATERIAL'] || ord['CodMaterial'] || '')}|${String(ord['CANTIDAD'] || ord['CANTPROGRAMADA'] || '')}`;
                const isAdjusted = !!o._isAdjusted;
                const isSplitRemainder = !!o._isSplitRemainder;
                const isSplitPart = !!o._isSplit;
                const isExcess = !isAdjusted && !isSplitRemainder && !!excessOrderKeys?.has(makeKey(o));
                const isBlocked = !!blockedOrderKeys?.has(makeKey(o));
                // En vista consolidada la comparación es contra el total ORIGINAL del material
                // (`_totalQtyOriginal`), no contra la cantidad de una sola de sus órdenes — si no,
                // la etiqueta mostraba un descuento parcial que no cuadraba con la fila.
                const esFilaConsolidada = isConsolidated && o._isConsolidated;
                const qtyOriginal = esFilaConsolidada
                  ? Number(o._totalQtyOriginal || 0)
                  : Number(o['CANTIDAD'] || o['CANTPROGRAMADA'] || 0);
                const qtyEfectiva = esFilaConsolidada
                  ? Number(o._totalQty || 0)
                  : (qtyOverrideByKey?.get(makeKey(o)) ?? qtyOriginal);
                const isDescontada = qtyEfectiva < qtyOriginal - 0.001;
                const qty = qtyEfectiva;
                const tSeconds = calculateProductionTime(o['MATERIAL'] || o['CodMaterial'] || '', qty, o);
                const tHours = tSeconds / 3600;
                const materialCode = o['CodMaterial'] || normalizeMaterialCode(o['MATERIAL'] || '');
                const materialName = o['NOMBRE'] || o['TEXTOMATERIAL'] || o['Material'] || '—';

                const textColor = isBlocked ? 'text-slate-400 line-through' : isAdjusted ? 'text-red-600' : isSplitRemainder ? 'text-violet-600' : isExcess ? 'text-amber-700' : 'text-slate-700';
                return (
                  <tr key={i} className={cn('hover:bg-indigo-50/30 transition-colors', isBlocked ? 'bg-slate-100/70 opacity-60' : isAdjusted ? 'bg-red-50/50' : isSplitRemainder ? 'bg-violet-50/50' : isExcess && 'bg-amber-50/60')}>
                    <td className={cn('px-4 py-3 font-mono font-bold whitespace-nowrap', textColor)}>
                      {isSplitPart && <span className="mr-1 text-violet-500" title="Orden dividida">✂</span>}
                      {isExcess && !isBlocked && <span className="mr-1 text-amber-500">⚠</span>}
                      {materialCode}
                    </td>
                    <td className={cn('px-4 py-3 font-medium whitespace-normal break-words leading-tight', isBlocked ? 'text-slate-400 line-through' : isAdjusted ? 'text-red-600' : isSplitRemainder ? 'text-violet-600' : isExcess ? 'text-amber-700' : 'text-slate-600')}>
                      {materialName}
                      {isBlocked && (
                        <span className="ml-1.5 inline-block text-[8px] font-black uppercase tracking-wider text-slate-400 align-middle no-underline">
                          · Bloqueada (no se fabrica)
                        </span>
                      )}
                      {!isBlocked && isSplitPart && (
                        <span className="ml-1.5 inline-block text-[8px] font-black uppercase tracking-wider text-violet-500 align-middle">
                          {isAdjusted ? `· Dividida (${qty.toLocaleString()}/${Number(o._originalCantidad || 0).toLocaleString()})` : `· Remanente (${qty.toLocaleString()}/${Number(o._originalCantidad || 0).toLocaleString()})`}
                        </span>
                      )}
                      {!isBlocked && isAdjusted && !isSplitPart && (
                        <span className="ml-1.5 inline-block text-[8px] font-black uppercase tracking-wider text-red-500 align-middle">
                          · Movida desde otra máquina
                        </span>
                      )}
                      {!isBlocked && isDescontada && (
                        <span className="ml-1.5 inline-block text-[8px] font-black uppercase tracking-wider text-orange-500 align-middle">
                          · Descontado por Tapa bloqueada (−{Math.round(qtyOriginal - qty).toLocaleString()} de {Math.round(qtyOriginal).toLocaleString()})
                        </span>
                      )}
                    </td>
                    <td className={cn('px-4 py-3 text-right font-mono font-black', textColor)}>{qty.toLocaleString()}</td>
                    <td className={cn('px-4 py-3 text-right font-mono font-black bg-indigo-50/10', isBlocked ? 'text-slate-400 line-through' : isAdjusted ? 'text-red-600' : isSplitRemainder ? 'text-violet-600' : isExcess ? 'text-amber-700' : 'text-indigo-600')}>{tHours.toFixed(2)}</td>
                    {onToggleBlock && (
                      <td className="px-4 py-3 text-center">
                        <button
                          type="button"
                          onClick={() => onToggleBlock(o)}
                          title={isBlocked ? 'Volver a incluir esta orden' : 'Bloquear: no se puede fabricar (verificado en SAP)'}
                          className={cn(
                            'inline-flex items-center justify-center w-6 h-6 rounded-lg border transition-colors',
                            isBlocked ? 'bg-slate-200 border-slate-300 text-slate-600 hover:bg-slate-300' : 'bg-white border-slate-200 text-slate-400 hover:border-red-300 hover:text-red-600'
                          )}
                        >
                          {isBlocked ? <Unlock className="w-3.5 h-3.5" /> : <Lock className="w-3.5 h-3.5" />}
                        </button>
                      </td>
                    )}
                  </tr>
                );
              }) : (
                <tr>
                  <td colSpan={onToggleBlock ? 5 : 4} className="py-16 text-center text-slate-400 uppercase font-black tracking-widest text-[9px] opacity-30">Sin carga programada</td>
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
                      const k = `${o['ORDEN'] || o['ORDENPREVISIONAL'] || ''}|${String(o['MATERIAL'] || o['CodMaterial'] || '')}|${String(o['CANTIDAD'] || o['CANTPROGRAMADA'] || '')}`;
                      const qty = isConsolidated && o._isConsolidated
                        ? o._totalQty
                        : (qtyOverrideByKey?.get(k) ?? Number(o['CANTIDAD'] || o['CANTPROGRAMADA'] || 0));
                      return sum + qty;
                    }, 0).toLocaleString()}
                  </td>
                  <td className="px-4 py-2 text-right font-mono font-black text-indigo-700 bg-indigo-50/30">
                    {totalTimeHours.toFixed(2)}
                  </td>
                  {onToggleBlock && <td className="px-4 py-2" />}
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
    prevProps.config.isSaturdayActive === nextProps.config.isSaturdayActive &&
    prevProps.config.peopleDay === nextProps.config.peopleDay &&
    prevProps.config.peopleNight === nextProps.config.peopleNight &&
    prevProps.horasNetasDiurnas === nextProps.horasNetasDiurnas &&
    prevProps.horasNetasNocturnas === nextProps.horasNetasNocturnas &&
    prevProps.horasNetasFinSemana === nextProps.horasNetasFinSemana &&
    prevProps.orders === nextProps.orders &&
    prevProps.adjustedInOrders === nextProps.adjustedInOrders &&
    prevProps.excludeOrderKeys === nextProps.excludeOrderKeys &&
    prevProps.excessOrderKeys === nextProps.excessOrderKeys &&
    prevProps.splitRemainderOrders === nextProps.splitRemainderOrders &&
    prevProps.blockedOrderKeys === nextProps.blockedOrderKeys &&
    prevProps.qtyOverrideByKey === nextProps.qtyOverrideByKey &&
    prevProps.onToggleBlock === nextProps.onToggleBlock;
});

// Registros del plan táctico cuyo "valor" corresponde a Centro 1000/2000
// (ej: "Plan Táctico - Centro 1000", "Plan Táctico - Centro 2000 - P2" — el sufijo "-P#" es opcional
// porque en datos reales no siempre aparece)
const PLAN_GRUPO_VALOR_REGEX = /plan\s*t[aá]ctico\s*-\s*centro\s*(1000|2000)(\s*-\s*p\d+)?/i;

// Variantes que exigen el sufijo de paso exacto, usadas por la pestaña "Recuperación pasos P1.5-P3"
// para distinguir cada paso (P1, P1.5, P2, P3) al recuperar planes guardados.
// El lookahead negativo en P1 evita que matchee "...- P1.5" (que ya tiene su propio regex).
const PLAN_GRUPO_VALOR_REGEX_P1 = /plan\s*t[aá]ctico\s*-\s*centro\s*(1000|2000)\s*-\s*p1(?!\.5)\b/i;
const PLAN_GRUPO_VALOR_REGEX_P1_5 = /plan\s*t[aá]ctico\s*-\s*centro\s*(1000|2000)\s*-\s*p1\.5\b/i;
const PLAN_GRUPO_VALOR_REGEX_P2 = /plan\s*t[aá]ctico\s*-\s*centro\s*(1000|2000)\s*-\s*p2\b/i;
const PLAN_GRUPO_VALOR_REGEX_P3 = /plan\s*t[aá]ctico\s*-\s*centro\s*(1000|2000)\s*-\s*p3\b/i;
// P1 y P1.5 se renombran a "PFF"/"PFM" en cuanto se ajustan (con o sin recorte) — ver
// handleAplicarAjustePlanP1/handleGuardarPFFSinAjuste y handleRegenerarPlanP15Ajustado/
// handleGuardarPFMSinAjuste. Para "Recuperación Pasos P1-P3" (que debe encontrar el plan vigente
// de cada paso sin importar si ya fue ajustado o no) se necesita esta variante ampliada; las
// PLAN_GRUPO_VALOR_REGEX_P1/_P1_5 estrictas se mantienen tal cual para el resto de flujos, que sí
// necesitan distinguir el crudo del ya renombrado (ej. para no volver a clonar un PFF como si
// fuera el P1 original).
const PLAN_GRUPO_VALOR_REGEX_P1_O_PFF = /plan\s*t[aá]ctico\s*-\s*centro\s*(1000|2000)\s*-\s*(p1(?!\.5)|pff)\b/i;
const PLAN_GRUPO_VALOR_REGEX_P1_5_O_PFM = /plan\s*t[aá]ctico\s*-\s*centro\s*(1000|2000)\s*-\s*(p1\.5|pfm)\b/i;
// El plan consolidado de "Plan Final de Producción" (Acolchado & Tapas + Bandas + Interiores &
// Corte + Forros Finales) se guarda con este nombre — ver handleGuardarPlanFinal.
const PLAN_GRUPO_VALOR_REGEX_PFM_FINAL = /plan\s*t[aá]ctico\s*-\s*centro\s*(1000|2000)\s*-\s*pfm\s*-\s*final\b/i;

// Quita tildes y pasa a mayúsculas, para comparar nombres de componentes sin depender de acentos (ej: LÁMINA vs LAMINA)
const DIACRITICS_REGEX = /[̀-ͯ]/g;
const normalizeText = (s: string) => s.normalize('NFD').replace(DIACRITICS_REGEX, '').toUpperCase();

// Reparte una reducción total entre varias filas que comparten un mismo material (ej. el
// mismo Forro repartido entre los P1.5 de centro 1000 y 2000, o el mismo CHN repartido entre
// los grupos de Ensamblado 1 y 6), en proporción a la cantidad original de cada fila — nunca
// una reducción pareja. La última fila (según el orden recibido) absorbe el residuo de
// redondeo para que la suma de reducciones cierre exacto contra `recorte`. Ninguna fila se
// reduce por debajo de 0.
function repartirProporcional<K>(recorte: number, filas: { key: K; cantidad: number }[]): Map<K, number> {
  const reducciones = new Map<K, number>();
  const total = filas.reduce((acc, f) => acc + f.cantidad, 0);
  if (total <= 0 || recorte <= 0) return reducciones;
  let acumulado = 0;
  filas.forEach((f, idx) => {
    let reduccion = idx === filas.length - 1
      ? recorte - acumulado
      : Math.round(recorte * (f.cantidad / total));
    reduccion = Math.max(0, Math.min(reduccion, f.cantidad));
    acumulado += reduccion;
    reducciones.set(f.key, reduccion);
  });
  return reducciones;
}

// Suma `dias` días hábiles (sin sábados, domingos ni feriados) a una fecha 'YYYY-MM-DD'.
// Usada por la restricción FECHA_P2: la fecha con la que se guarda el plan P2 no es la
// fecha de generación, sino esa fecha + N días hábiles (N = valor de la restricción).
//
// OJO: acá el uso de UTC es CORRECTO y no debe cambiarse a hora local. `new Date('YYYY-MM-DD')`
// parsea como medianoche UTC, y toda la función avanza y lee en UTC (setUTCDate/getUTCDay/
// toISOString), así que nunca mezcla husos y la fecha calendario se conserva exacta. Si se
// cambiara a getters locales, esa medianoche UTC se leería como las 19:00 del día ANTERIOR en
// Ecuador y el resultado se correría un día.
function sumarDiasHabiles(fechaBase: string, dias: number, feriados: Set<string>): string {
  const fecha = new Date(fechaBase);
  let restantes = dias;
  while (restantes > 0) {
    fecha.setUTCDate(fecha.getUTCDate() + 1);
    const diaSemana = fecha.getUTCDay();
    const iso = fecha.toISOString().split('T')[0];
    if (diaSemana === 0 || diaSemana === 6 || feriados.has(iso)) continue;
    restantes--;
  }
  return fecha.toISOString().split('T')[0];
}

// Tabla pivote: filas = línea de producción, columnas = centro (1000/2000) del que proviene
// el plan_grupo, celda = Cant. Prod. Neta. Incluye columna y fila de totales. Reemplaza la
// lista lateral simple por una vista más visual donde se compara de un vistazo cuánto
// produce cada centro por línea.
const ResumenGrupoLineaTable: React.FC<{
  rows: any[];
  centroPorPlanGrupo: Map<number, string>;
}> = ({ rows, centroPorPlanGrupo }) => {
  const pivote = useMemo(() => {
    const centrosSet = new Set<string>();
    const porLinea = new Map<string, Map<string, number>>();
    rows.forEach(item => {
      const centro = String(centroPorPlanGrupo.get(Number(item.codigo_plan_grupo)) ?? 'Sin centro');
      const linea = String(item.linea_produccion || 'Sin línea').trim() || 'Sin línea';
      centrosSet.add(centro);
      if (!porLinea.has(linea)) porLinea.set(linea, new Map());
      const mapaLinea = porLinea.get(linea)!;
      mapaLinea.set(centro, (mapaLinea.get(centro) || 0) + Number(item.cantidad_produccion_neta || 0));
    });
    const centros = Array.from(centrosSet).sort((a, b) => a.localeCompare(b, undefined, { numeric: true }));
    const filas = Array.from(porLinea.entries())
      .map(([linea, porCentro]) => {
        const valores: Record<string, number> = {};
        let total = 0;
        centros.forEach(c => {
          const v = porCentro.get(c) || 0;
          valores[c] = v;
          total += v;
        });
        return { linea, valores, total };
      })
      .sort((a, b) => b.total - a.total);
    const totalesPorCentro: Record<string, number> = {};
    centros.forEach(c => { totalesPorCentro[c] = filas.reduce((acc, f) => acc + f.valores[c], 0); });
    const totalGeneral = filas.reduce((acc, f) => acc + f.total, 0);
    return { centros, filas, totalesPorCentro, totalGeneral };
  }, [rows, centroPorPlanGrupo]);

  if (pivote.filas.length === 0) return null;

  return (
    <Card className="rounded-[2rem] bg-white ring-1 ring-slate-100 overflow-hidden shadow-sm border-none">
      <CardHeader className="bg-slate-50/50 border-b border-slate-200 p-6">
        <CardTitle className="text-sm font-black text-slate-900 uppercase tracking-widest">Resumen por Centro y Línea</CardTitle>
        <CardDescription className="text-slate-400 font-bold uppercase text-[9px] tracking-widest mt-0.5">
          Cant. Prod. Neta — centros en columnas
        </CardDescription>
      </CardHeader>
      <CardContent className="p-0">
        <div className="overflow-x-auto">
          <table className="w-full text-[11px] border-collapse">
            <thead className="bg-slate-50 text-slate-500 border-b border-slate-200 text-left uppercase tracking-widest font-black">
              <tr>
                <th className="px-6 py-3 text-[10px] sticky left-0 bg-slate-50">Línea Producción</th>
                {pivote.centros.map(c => (
                  <th key={c} className="px-6 py-3 text-[10px] text-right">Centro {c}</th>
                ))}
                <th className="px-6 py-3 text-[10px] text-right bg-indigo-700">Total</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {pivote.filas.map(fila => (
                <tr key={fila.linea} className="hover:bg-slate-50 transition-colors">
                  <td className="px-6 py-3 font-black text-slate-800 uppercase sticky left-0 bg-white">{fila.linea}</td>
                  {pivote.centros.map(c => (
                    <td key={c} className="px-6 py-3 text-right font-mono font-bold text-slate-600">
                      {fila.valores[c] > 0 ? Math.round(fila.valores[c]).toLocaleString() : '—'}
                    </td>
                  ))}
                  <td className="px-6 py-3 text-right font-mono font-black text-indigo-700 bg-indigo-50/50">
                    {Math.round(fila.total).toLocaleString()}
                  </td>
                </tr>
              ))}
            </tbody>
            <tfoot className="bg-slate-100 font-black text-slate-800">
              <tr>
                <td className="px-6 py-3 uppercase text-[10px] sticky left-0 bg-slate-100">Total</td>
                {pivote.centros.map(c => (
                  <td key={c} className="px-6 py-3 text-right font-mono">{Math.round(pivote.totalesPorCentro[c]).toLocaleString()}</td>
                ))}
                <td className="px-6 py-3 text-right font-mono text-indigo-700">{Math.round(pivote.totalGeneral).toLocaleString()}</td>
              </tr>
            </tfoot>
          </table>
        </div>
      </CardContent>
    </Card>
  );
};

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
}> = ({ rows, codigoLabel, tituloBar, tituloBarBg = 'bg-slate-50 text-slate-700 border-b border-slate-200', referenciaSufijo = '', sinDatosLabel = 'Sin componentes en esta categoría' }) => {
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
        {tituloBar && <div className={cn('px-6 py-3 font-black text-[10px] uppercase tracking-widest', tituloBarBg)}>{tituloBar}</div>}
        <div className="py-16 text-center text-slate-400 uppercase font-black tracking-widest text-[10px] opacity-40">{sinDatosLabel}</div>
      </div>
    );
  }

  return (
    <div className="overflow-x-auto">
      {tituloBar && <div className={cn('px-6 py-3 font-black text-[10px] uppercase tracking-widest', tituloBarBg)}>{tituloBar}</div>}
      <table className="w-full text-[11px] border-collapse">
        <thead className={cn(tituloBar ? 'bg-slate-50 text-slate-500 border-b border-slate-200' : 'bg-slate-50 text-slate-500 border-b border-slate-200 sticky top-0 z-10', 'text-left uppercase tracking-widest font-black')}>
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

const RECUPERACION_PASO_PAGE_SIZE = 10;

// Tabla de un nivel (Forro/Tapa/Acolchado/Otros) dentro del panel de recuperación de un paso,
// con su propia paginación. Muestra la columna "Nombre Material" resuelta contra el maestro
// de materiales (materialNombrePorCodigo), ya que el detalle guardado solo trae el código.
const RecuperacionPasoNivelTable: React.FC<{
  titulo: string;
  rows: any[];
  materialNombrePorCodigo: Map<string, string>;
  normalizeMaterialCode: (code: string | number) => string;
  centroPorPlanGrupo: Map<number, string>;
}> = ({ titulo, rows, materialNombrePorCodigo, normalizeMaterialCode, centroPorPlanGrupo }) => {
  const [page, setPage] = useState(1);
  const totalPages = Math.max(1, Math.ceil(rows.length / RECUPERACION_PASO_PAGE_SIZE));
  const pageSafe = Math.min(page, totalPages);

  useEffect(() => { setPage(1); }, [rows]);

  const pageRows = useMemo(() => {
    const start = (pageSafe - 1) * RECUPERACION_PASO_PAGE_SIZE;
    return rows.slice(start, start + RECUPERACION_PASO_PAGE_SIZE);
  }, [rows, pageSafe]);

  return (
    <div>
      <div className="px-6 py-3 text-slate-700 font-black text-[10px] uppercase tracking-widest bg-slate-50 border-b border-slate-200 flex items-center justify-between">
        <span>{titulo}</span>
        <span className="text-slate-400 font-bold normal-case">{rows.length} registro{rows.length === 1 ? '' : 's'}</span>
      </div>
      {rows.length === 0 ? (
        <div className="py-12 text-center text-slate-400 uppercase font-black tracking-widest text-[10px] opacity-40">
          Sin componentes en este nivel
        </div>
      ) : (
        <>
          <div className="overflow-x-auto">
            <table className="w-full text-[11px] border-collapse">
              <thead className="bg-slate-50 text-slate-500 border-b border-slate-200 text-left uppercase tracking-widest font-black">
                <tr>
                  <th className="px-6 py-4 text-[10px]">Centro</th>
                  <th className="px-6 py-4 text-[10px]">Línea Producción</th>
                  <th className="px-6 py-4 text-[10px]">Material</th>
                  <th className="px-6 py-4 text-[10px]">Nombre Material</th>
                  <th className="px-6 py-4 text-[10px] text-right">Cant. Prod. Neta</th>
                  <th className="px-6 py-4 text-[10px]">Clase Aprov.</th>
                  <th className="px-6 py-4 text-[10px] text-right">Cant. Aprov.</th>
                  <th className="px-6 py-4 text-[10px]">Resp. Ctrl. Prod.</th>
                  <th className="px-6 py-4 text-[10px] text-center">Estado</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {pageRows.map((item, i) => (
                  <tr key={item.codigo_detalle_tactico ?? i} className="hover:bg-slate-50 transition-colors text-[10px]">
                    <td className="px-6 py-4 font-mono font-bold text-slate-600">{centroPorPlanGrupo.get(Number(item.codigo_plan_grupo)) ?? '—'}</td>
                    <td className="px-6 py-4 font-black text-slate-800 uppercase">{item.linea_produccion || '—'}</td>
                    <td className="px-6 py-4 font-mono font-bold text-indigo-700">{item.codigo_material}</td>
                    <td className="px-6 py-4 font-bold text-slate-700 uppercase">
                      {materialNombrePorCodigo.get(normalizeMaterialCode(item.codigo_material)) || '—'}
                    </td>
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
          <div className="flex items-center justify-between px-6 py-3 border-t border-slate-200 bg-slate-50/50">
            <div className="text-[9px] font-black uppercase tracking-widest text-slate-400">
              Página {pageSafe} de {totalPages}
            </div>
            <div className="flex items-center gap-1">
              <Button variant="outline" size="icon" onClick={() => setPage(1)} disabled={pageSafe === 1} className="h-7 w-7"><ChevronsLeft className="h-3.5 w-3.5" /></Button>
              <Button variant="outline" size="icon" onClick={() => setPage(p => p - 1)} disabled={pageSafe === 1} className="h-7 w-7"><ChevronLeft className="h-3.5 w-3.5" /></Button>
              <div className="px-3 text-[10px] font-bold text-gray-700 min-w-[90px] text-center border-x py-1 bg-white rounded">Pág. {pageSafe} de {totalPages}</div>
              <Button variant="outline" size="icon" onClick={() => setPage(p => p + 1)} disabled={pageSafe === totalPages} className="h-7 w-7"><ChevronRight className="h-3.5 w-3.5" /></Button>
              <Button variant="outline" size="icon" onClick={() => setPage(totalPages)} disabled={pageSafe === totalPages} className="h-7 w-7"><ChevronsRight className="h-3.5 w-3.5" /></Button>
            </div>
          </div>
        </>
      )}
    </div>
  );
};

// Panel de recuperación de un plan táctico guardado para un paso específico (P1.5 o P3):
// resalta en el calendario las fechas con plan activo para ese paso, permite consultarlo
// y muestra el detalle + resumen por línea. Réplica del patrón de "Planes Grupo Ensamblado"
// (fetchPlanGrupoDetalle) pero acotado al sufijo de paso exacto vía `regex`. Cuando
// `agruparPorNivel` es true (P1.5, materiales de Forros) el detalle se agrupa en 4 niveles
// según el nombre del material (Nivel 1 Forro / Nivel 2 Tapa / Nivel 3 Acolchado / Otros);
// cuando es false (P3, materiales de Corte y Laminado) se muestra una sola tabla sin agrupar.
const RecuperacionPasoPanel: React.FC<{
  paso: string;
  regex: RegExp;
  gruposCoincidentes: Grupo[];
  addNotification: (type: 'success' | 'error' | 'warning' | 'info', message: string) => void;
  materialNombrePorCodigo: Map<string, string>;
  normalizeMaterialCode: (code: string | number) => string;
  agruparPorNivel?: boolean;
  // Cuando se define, solo se muestran las filas de detalle cuyo plan_grupo padre
  // (`codigo_plan_grupo_padre`) pertenece a este codigo_grupo — ej: en P3 (Corte y
  // Laminado) se usa para quedarse solo con lo que proviene de un plan padre de Forros
  // (codigo_grupo 2), descartando lo que viene de otros orígenes (Venta Externa, etc.)
  filtrarPadreCodigoGrupo?: number;
  // Fecha(s) a las que se guarda el plan de este paso, derivadas del card principal de la
  // pestaña aplicando la misma lógica de sumarDiasHabiles usada al guardar (fecha de
  // generación + N días hábiles según la restricción de cada paso — ver
  // handleGuardarPlanNivel4). P1 no tiene restricción propia y se busca sin desplazar; P1.5
  // reparte Nivel 1 (Forro) y Nivel 2+3 (Tapa/Acolchado) en fechas distintas, por eso acepta
  // un array. Al cambiar dispara automáticamente la consulta de este paso.
  fecha: string | string[];
  // Reporta al card principal las fechas con plan recuperable de este paso, para que se
  // combinen entre los 4 pasos y se resalten juntas en el único calendario compartido.
  onFechasConPlan?: (fechas: Set<string>) => void;
}> = ({ paso, regex, gruposCoincidentes, addNotification, materialNombrePorCodigo, normalizeMaterialCode, agruparPorNivel = true, filtrarPadreCodigoGrupo, fecha, onFechasConPlan }) => {
  const [detalleData, setDetalleData] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [hasFetched, setHasFetched] = useState(false);
  const [codigoGrupoPorPlanGrupo, setCodigoGrupoPorPlanGrupo] = useState<Map<number, number>>(new Map());
  const fechasArray = useMemo(
    () => Array.from(new Set((Array.isArray(fecha) ? fecha : [fecha]).filter(Boolean))),
    [fecha]
  );
  const onFechasConPlanRef = useRef(onFechasConPlan);
  onFechasConPlanRef.current = onFechasConPlan;

  useEffect(() => {
    if (gruposCoincidentes.length === 0) {
      onFechasConPlanRef.current?.(new Set());
      return;
    }
    let cancelled = false;
    (async () => {
      try {
        const codigosGrupo = new Set(gruposCoincidentes.map(g => g.codigo_grupo));
        const response = await planGrupoService.getAll();
        const fechas = new Set<string>();
        const mapaGrupoPorPlan = new Map<number, number>();
        (response.data || []).forEach((pg: PlanGrupo) => {
          mapaGrupoPorPlan.set(pg.codigo_plan_grupo, pg.codigo_grupo);
          if (
            codigosGrupo.has(pg.codigo_grupo) &&
            pg.estado === 'A' &&
            pg.fecha_inicio_plan &&
            regex.test(String(pg.valor || ''))
          ) {
            // Fecha LOCAL (no toISOString/UTC): fecha_inicio_plan no siempre llega en medianoche
            // UTC exacta y compararlo en UTC puede correrse un día respecto a la fecha real.
            const d = new Date(pg.fecha_inicio_plan);
            fechas.add(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`);
          }
        });
        if (!cancelled) {
          onFechasConPlanRef.current?.(fechas);
          setCodigoGrupoPorPlanGrupo(mapaGrupoPorPlan);
        }
      } catch (error: any) {
        if (!cancelled) addNotification('error', `Error al consultar planes ${paso} existentes: ${error.message}`);
      }
    })();
    return () => { cancelled = true; };
  }, [gruposCoincidentes, regex, addNotification, paso]);

  // codigo_plan_grupo -> centro (1000/2000), para mostrar el centro de origen en vez del
  // codigo_grupo/codigo_plan_grupo crudo en las tablas de detalle y el resumen.
  const centroPorPlanGrupo = useMemo(() => {
    const centroPorCodigoGrupo = new Map(gruposCoincidentes.map(g => [g.codigo_grupo, g.centro]));
    const mapa = new Map<number, string>();
    codigoGrupoPorPlanGrupo.forEach((codigoGrupo, planGrupo) => {
      const centro = centroPorCodigoGrupo.get(codigoGrupo);
      if (centro) mapa.set(planGrupo, centro);
    });
    return mapa;
  }, [codigoGrupoPorPlanGrupo, gruposCoincidentes]);

  const fetchDetalle = useCallback(async () => {
    if (fechasArray.length === 0 || gruposCoincidentes.length === 0) return;
    setIsLoading(true);
    setHasFetched(true);
    try {
      const gruposParam = gruposCoincidentes.map(g => g.codigo_grupo).join('&');
      const responses = await Promise.all(
        fechasArray.map(f => serviciosService.detallePlanTacticoPorGrupos(gruposParam, f))
      );
      setDetalleData(responses.flatMap(r => r.data || []));
    } catch (error: any) {
      addNotification('error', `Error al consultar el plan táctico ${paso}: ${error.message}`);
      setDetalleData([]);
    } finally {
      setIsLoading(false);
    }
  }, [fechasArray, gruposCoincidentes, addNotification, paso]);

  // Consulta automáticamente este paso en cuanto el card principal cambia la fecha
  // compartida (o cuando los grupos filtrados quedan listos con una fecha ya elegida).
  useEffect(() => {
    if (fechasArray.length > 0 && gruposCoincidentes.length > 0) fetchDetalle();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fechasArray, gruposCoincidentes]);

  const detalleFiltrada = useMemo(
    () => detalleData.filter(item => {
      if (!regex.test(String(item.valor || ''))) return false;
      if (filtrarPadreCodigoGrupo === undefined) return true;
      return codigoGrupoPorPlanGrupo.get(Number(item.codigo_plan_grupo_padre)) === filtrarPadreCodigoGrupo;
    }),
    [detalleData, regex, filtrarPadreCodigoGrupo, codigoGrupoPorPlanGrupo]
  );

  // Agrupa el detalle por nivel según el nombre del material (maestro de materiales):
  // Nivel 1 = nombre empieza con FORRO, Nivel 2 = empieza con TAPA, Nivel 3 = empieza con
  // ACOLCHADO, y lo que no cae en ninguno de los tres queda en "Otros / Sin Nivel".
  const detallePorNivel = useMemo(() => {
    const nivel1: any[] = [];
    const nivel2: any[] = [];
    const nivel3: any[] = [];
    const otros: any[] = [];
    detalleFiltrada.forEach(item => {
      const nombreMaterial = materialNombrePorCodigo.get(normalizeMaterialCode(item.codigo_material)) || '';
      const nombreNorm = normalizeText(nombreMaterial);
      if (nombreNorm.startsWith('FORRO')) nivel1.push(item);
      else if (nombreNorm.startsWith('TAPA')) nivel2.push(item);
      else if (nombreNorm.startsWith('ACOLCHADO')) nivel3.push(item);
      else otros.push(item);
    });
    return { nivel1, nivel2, nivel3, otros };
  }, [detalleFiltrada, materialNombrePorCodigo, normalizeMaterialCode]);

  return (
    <div className="space-y-8">
      <Card className="rounded-[2.5rem] bg-white ring-1 ring-slate-100 overflow-hidden shadow-sm border-none">
        <CardHeader className="bg-slate-50/50 border-b border-slate-200 p-10">
          <div className="flex items-center justify-between flex-wrap gap-4">
            <div>
              <CardTitle className="text-2xl font-black text-slate-900 uppercase">Plan Táctico — Paso {paso}</CardTitle>
              <CardDescription className="text-slate-400 font-bold uppercase text-[10px] tracking-widest mt-1">
                Detalle del plan {paso} guardado para los grupos filtrados, en la fecha seleccionada
              </CardDescription>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-[9px] font-black text-slate-400 uppercase">Fecha del Plan:</span>
              <span className="flex items-center gap-2 text-xs font-bold text-slate-700 bg-slate-50 border border-slate-200 rounded-lg px-3 py-1.5">
                <CalendarIcon className="w-3.5 h-3.5 text-slate-400" />
                {fechasArray.length > 0 ? fechasArray.join(' / ') : 'Sin fecha seleccionada'}
              </span>
              {isLoading && <Loader2 className="w-3.5 h-3.5 animate-spin text-indigo-600" />}
            </div>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          {isLoading ? (
            <div className="py-20 text-center text-slate-400 uppercase font-black tracking-widest text-xs flex items-center justify-center gap-2">
              <Loader2 className="w-4 h-4 animate-spin" /> Cargando plan táctico {paso}...
            </div>
          ) : !hasFetched ? (
            <div className="py-20 text-center text-slate-400 uppercase font-black tracking-widest text-xs opacity-40">
              Selecciona una fecha en el encabezado de la pestaña para consultar el plan táctico {paso} de los grupos filtrados
            </div>
          ) : detalleFiltrada.length > 0 ? (
            agruparPorNivel ? (
              <div className="divide-y divide-slate-200">
                <RecuperacionPasoNivelTable
                  titulo="Nivel 1 — Forro"
                  rows={detallePorNivel.nivel1}
                  materialNombrePorCodigo={materialNombrePorCodigo}
                  normalizeMaterialCode={normalizeMaterialCode}
                  centroPorPlanGrupo={centroPorPlanGrupo}
                />
                <RecuperacionPasoNivelTable
                  titulo="Nivel 2 — Tapa"
                  rows={detallePorNivel.nivel2}
                  materialNombrePorCodigo={materialNombrePorCodigo}
                  normalizeMaterialCode={normalizeMaterialCode}
                  centroPorPlanGrupo={centroPorPlanGrupo}
                />
                <RecuperacionPasoNivelTable
                  titulo="Nivel 3 — Acolchado"
                  rows={detallePorNivel.nivel3}
                  materialNombrePorCodigo={materialNombrePorCodigo}
                  normalizeMaterialCode={normalizeMaterialCode}
                  centroPorPlanGrupo={centroPorPlanGrupo}
                />
                <RecuperacionPasoNivelTable
                  titulo="Otros / Sin Nivel"
                  rows={detallePorNivel.otros}
                  materialNombrePorCodigo={materialNombrePorCodigo}
                  normalizeMaterialCode={normalizeMaterialCode}
                  centroPorPlanGrupo={centroPorPlanGrupo}
                />
              </div>
            ) : (
              <RecuperacionPasoNivelTable
                titulo={`Detalle del Plan ${paso}`}
                rows={detalleFiltrada}
                materialNombrePorCodigo={materialNombrePorCodigo}
                normalizeMaterialCode={normalizeMaterialCode}
                centroPorPlanGrupo={centroPorPlanGrupo}
              />
            )
          ) : (
            <div className="py-20 text-center text-slate-400 uppercase font-black tracking-widest text-xs opacity-40">
              Sin plan {paso} guardado para la fecha seleccionada
            </div>
          )}
        </CardContent>
      </Card>

      <ResumenGrupoLineaTable rows={detalleFiltrada} centroPorPlanGrupo={centroPorPlanGrupo} />
    </div>
  );
};

const CAPACIDAD_PAGE_SIZE = 10;

// Materiales con nombre "LAMINA..." que en realidad son ROLLOS CORTADOS (ej. "LAMINA CILINDRICA
// D 19 PL 200X1.0 H23/H26", Unidad KG, HojaRuta HR-CTESP — Corte de Espuma, no la ruta de
// laminado real). Confirmado por el usuario que no deben considerarse EN NINGÚN LADO: ni en la
// tabla de comparación P2 vs P3, ni en lo que se GUARDA como necesidad de Nivel 4 (P2), aunque su
// nombre matchee el filtro "LAMINA" de la explosión y figuren con déficit. A nivel de módulo (no
// dentro de un solo componente) porque dos componentes de este archivo la necesitan: el panel de
// comparación y el guardado de Nivel 4/P2.
const MATERIALES_ROLLOS_CORTADOS_EXCLUIDOS = new Set(['30026039', '30026042']);

// Compara, por material y para una misma fecha, la Cant. Prod. Neta planificada en el plan
// final de Forros (P2) contra la del plan de Corte y Laminado (P3). Es solo de consulta:
// no escribe ni modifica ningún plan, solo trae y junta la información ya guardada.
const CapacidadComparacionPanel: React.FC<{
  forrosGruposList: Grupo[];
  corteLaminadoGruposList: Grupo[];
  // Grupos del Paso 1 (Ensamblado, centros 1000/2000) — solo se usan aquí para el ajuste
  // proporcional del plan P1, nunca para activar/desactivar planes P1 (eso sigue prohibido).
  gruposCoincidentes: Grupo[];
  addNotification: (type: 'success' | 'error' | 'warning' | 'info', message: string) => void;
  materialNombrePorCodigo: Map<string, string>;
  normalizeMaterialCode: (code: string | number) => string;
  materialesBalanceoData: MaterialesBalanceo[];
  fetchMaterialesBalanceo: () => Promise<void>;
  // Las 4 fechas se derivan automáticamente de la fecha del P1 elegida en el card principal
  // de la pestaña de Recuperación (ver recuperacionFechasCalculadas) — Capacidad ya no tiene
  // su propio selector. No comparten fecha porque cada paso tiene su propio horizonte desde
  // el día de generación del plan: fechaP1 es la fecha del P1 tal cual (se usa solo para
  // leer/clonar P1, el PFF siempre se guarda con esta fecha); fechaN1 es generación + días de
  // FECHA_N1 (Forro del P1.5); fechaN2N3 es generación + días de FECHA_N2N3 (Tapa/Acolchado/
  // Otros del P1.5); fechaP2P3 es generación + días de FECHA_P2 (= FECHA_P3), la fecha en la
  // que P2 y P3 deben coincidir para poder compararse.
  fechaP1: string;
  fechaN1: string;
  fechaN2N3: string;
  fechaP2P3: string;
  // Bubbling hacia el padre de cuál de los procesos de guardado de este panel está en curso
  // (o null si ninguno), para la ventana flotante bloqueante global.
  onProcessChange?: (process: { label: string; progress: number | null } | null) => void;
}> = ({ forrosGruposList, corteLaminadoGruposList, gruposCoincidentes, addNotification, materialNombrePorCodigo, normalizeMaterialCode, materialesBalanceoData, fetchMaterialesBalanceo, fechaP1, fechaN1, fechaN2N3, fechaP2P3, onProcessChange }) => {
  const [isLoading, setIsLoading] = useState(false);
  const [hasFetched, setHasFetched] = useState(false);
  const [page, setPage] = useState(1);
  const [comparacion, setComparacion] = useState<{ codigo_material: string; cantidadP2: number; cantidadP3: number }[]>([]);
  const [p15ForroPorMaterial, setP15ForroPorMaterial] = useState<Map<string, number>>(new Map());
  // Materiales Balanceo guarda el código del CHN (semielaborado, ej. "CHN ZAFIRO 135X190X029"),
  // no el del Forro terminado que realmente aparece en el plan P1.5 (ej. "FORRO CHN. ZAFIRO
  // 135X190X029") — son dos materiales distintos de la BOM. Para poder cruzarlos hay que
  // explotar el CHN (NIVEL=1 de su despiece) y quedarse con el único componente cuya
  // descripción contiene "FORRO". Este mapa cachea codigo CHN -> {codigo, nombre} del Forro.
  const [chnAForroMap, setChnAForroMap] = useState<Map<string, { codigo: string; nombre: string }>>(new Map());
  const chnResueltosRef = useRef<Set<string>>(new Set());

  useEffect(() => {
    const codigosChn = Array.from(new Set(materialesBalanceoData.map(mb => normalizeMaterialCode(mb.codigo_material)).filter(Boolean)));
    const pendientes = codigosChn.filter(c => !chnResueltosRef.current.has(c));
    if (pendientes.length === 0) return;
    let cancelled = false;
    (async () => {
      const encontrados = new Map<string, { codigo: string; nombre: string }>();
      for (const chn of pendientes) {
        chnResueltosRef.current.add(chn);
        try {
          for (const centro of ['1000', '2000']) {
            const response = await serviciosService.getMaestroMaterialesExplosion(centro, chn, 1, 5000);
            const comp = (response.data || []).find((c: any) =>
              Number(c.NIVEL) === 1 && String(c.DESCRIPCION_COMPONENTE || '').toUpperCase().includes('FORRO')
            );
            if (comp) {
              encontrados.set(chn, { codigo: normalizeMaterialCode(comp.COMPONENTE), nombre: String(comp.DESCRIPCION_COMPONENTE || '').trim() });
              break;
            }
          }
        } catch (error: any) {
          addNotification('error', `Error al explotar el material ${chn} de Materiales Balanceo: ${error.message}`);
        }
      }
      if (!cancelled && encontrados.size > 0) {
        setChnAForroMap(prev => {
          const next = new Map(prev);
          encontrados.forEach((value, key) => next.set(key, value));
          return next;
        });
      }
    })();
    return () => { cancelled = true; };
  }, [materialesBalanceoData, normalizeMaterialCode, addNotification]);

  const fetchComparacion = useCallback(async (fechaOverride?: string) => {
    const f = fechaOverride ?? fechaP2P3;
    if (!f || !fechaN1 || forrosGruposList.length === 0 || corteLaminadoGruposList.length === 0) return;
    setIsLoading(true);
    setHasFetched(true);
    try {
      const gruposP2 = forrosGruposList.map(g => g.codigo_grupo).join('&');
      const gruposP3 = corteLaminadoGruposList.map(g => g.codigo_grupo).join('&');
      const [respP2, respP3, respN1, respPlanGrupo] = await Promise.all([
        serviciosService.detallePlanTacticoPorGrupos(gruposP2, f),
        serviciosService.detallePlanTacticoPorGrupos(gruposP3, f),
        serviciosService.detallePlanTacticoPorGrupos(gruposP2, fechaN1),
        planGrupoService.getAll(),
        materialesBalanceoData.length === 0 ? fetchMaterialesBalanceo() : Promise.resolve(),
      ]);
      const codigoGrupoPorPlanGrupo = new Map<number, number>();
      (respPlanGrupo.data || []).forEach((pg: PlanGrupo) => codigoGrupoPorPlanGrupo.set(pg.codigo_plan_grupo, pg.codigo_grupo));

      const dataP2 = (respP2.data || []).filter((item: any) => PLAN_GRUPO_VALOR_REGEX_P2.test(String(item.valor || '')));
      // El P3 solo cuenta lo que proviene de un plan padre de Forros (grupo 2) — igual que en
      // la pestaña de Recuperación P3, para no mezclar material que llegó al plan de Corte y
      // Laminado por otro origen (ej. Venta Externa) o que se agregó directo al propio P3.
      const dataP3 = (respP3.data || []).filter((item: any) =>
        PLAN_GRUPO_VALOR_REGEX_P3.test(String(item.valor || '')) &&
        codigoGrupoPorPlanGrupo.get(Number(item.codigo_plan_grupo_padre)) === 2
      );
      // El P1.5 (Forros, Nivel 1) vive en su propia fecha (generación + FECHA_N1), distinta de
      // la de P2 (generación + FECHA_P2) — por eso se consulta aparte, en fechaN1, y no se
      // asume que comparte respuesta con P2. Se usa para la simulación de ajuste.
      const dataP15Forro = (respN1.data || []).filter((item: any) => {
        // Acepta también PFM (el P1.5 ya renombrado tras ajustarse) — si no, esta referencia
        // se queda vacía en cuanto el P1.5 de Forros se ajuste, igual que pasaba con el P1/PFF.
        if (!PLAN_GRUPO_VALOR_REGEX_P1_5_O_PFM.test(String(item.valor || ''))) return false;
        const nombreMaterial = materialNombrePorCodigo.get(normalizeMaterialCode(item.codigo_material)) || '';
        return normalizeText(nombreMaterial).startsWith('FORRO');
      });

      const mapP2 = new Map<string, number>();
      dataP2.forEach((item: any) => {
        const codigo = normalizeMaterialCode(item.codigo_material);
        mapP2.set(codigo, (mapP2.get(codigo) || 0) + Number(item.cantidad_produccion_neta || 0));
      });
      const mapP3 = new Map<string, number>();
      dataP3.forEach((item: any) => {
        const codigo = normalizeMaterialCode(item.codigo_material);
        mapP3.set(codigo, (mapP3.get(codigo) || 0) + Number(item.cantidad_produccion_neta || 0));
      });
      const mapP15Forro = new Map<string, number>();
      dataP15Forro.forEach((item: any) => {
        const codigo = normalizeMaterialCode(item.codigo_material);
        mapP15Forro.set(codigo, (mapP15Forro.get(codigo) || 0) + Number(item.cantidad_produccion_neta || 0));
      });

      const codigosMaterial = new Set([...mapP2.keys(), ...mapP3.keys()]);
      const filas = Array.from(codigosMaterial)
        .map(codigo_material => ({
          codigo_material,
          cantidadP2: mapP2.get(codigo_material) || 0,
          cantidadP3: mapP3.get(codigo_material) || 0,
        }))
        .sort((a, b) => (materialNombrePorCodigo.get(a.codigo_material) || a.codigo_material)
          .localeCompare(materialNombrePorCodigo.get(b.codigo_material) || b.codigo_material));

      setComparacion(filas);
      setP15ForroPorMaterial(mapP15Forro);
    } catch (error: any) {
      addNotification('error', `Error al comparar capacidad P2 vs P3: ${error.message}`);
      setComparacion([]);
      setP15ForroPorMaterial(new Map());
    } finally {
      setIsLoading(false);
    }
  }, [fechaP2P3, fechaN1, forrosGruposList, corteLaminadoGruposList, addNotification, normalizeMaterialCode, materialNombrePorCodigo, materialesBalanceoData, fetchMaterialesBalanceo]);

  // Consulta automáticamente en cuanto el card principal de la pestaña cambia la fecha
  // del P1 (de la que se derivan fechaN1/fechaN2N3/fechaP2P3).
  useEffect(() => {
    if (fechaP2P3 && fechaN1 && forrosGruposList.length > 0 && corteLaminadoGruposList.length > 0) fetchComparacion();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fechaP2P3, fechaN1, forrosGruposList, corteLaminadoGruposList]);

  // Materiales que aparecen en la comparación P2 vs P3 con nombre "LAMINA..." pero que en
  // realidad son ROLLOS CORTADOS (ej. "LAMINA CILINDRICA D 19 PL 200X1.0 H23/H26", Unidad KG,
  // HojaRuta HR-CTESP — Corte de Espuma, no la ruta de laminado real) — confirmado por el
  // usuario que no deben considerarse EN NINGÚN LADO de esta comparación (ni en la tabla, ni en
  // el ajuste), aunque figuren con déficit. Definido a nivel de módulo (ver arriba de este
  // componente) porque el guardado de Nivel 4/P2 en el componente principal también lo necesita.

  // Comparación visible: la cruda (`comparacion`) menos los rollos cortados excluidos — se filtra
  // UNA sola vez aquí y se usa en todos lados (tabla, paginación y simulación de ajuste) para que
  // nunca vuelvan a aparecer en ningún punto de esta pantalla.
  const comparacionVisible = useMemo(() => (
    comparacion.filter(row => !MATERIALES_ROLLOS_CORTADOS_EXCLUIDOS.has(normalizeMaterialCode(row.codigo_material)))
  ), [comparacion, normalizeMaterialCode, MATERIALES_ROLLOS_CORTADOS_EXCLUIDOS]);

  useEffect(() => { setPage(1); }, [comparacionVisible]);
  const totalPages = Math.max(1, Math.ceil(comparacionVisible.length / CAPACIDAD_PAGE_SIZE));
  const pageSafe = Math.min(page, totalPages);
  const pageRows = useMemo(() => {
    const start = (pageSafe - 1) * CAPACIDAD_PAGE_SIZE;
    return comparacionVisible.slice(start, start + CAPACIDAD_PAGE_SIZE);
  }, [comparacionVisible, pageSafe]);

  // Códigos de Lámina (Nivel 4) que SÍ están en déficit (P3 < P2), con su faltante — la unidad
  // real de "qué falta", en vez del número agregado que mezclaba materiales sin relación.
  const laminasDeficitarias = useMemo(() => {
    const map = new Map<string, number>();
    comparacionVisible.forEach(row => {
      const diferencia = row.cantidadP3 - row.cantidadP2;
      if (diferencia < 0) map.set(row.codigo_material, Math.abs(diferencia));
    });
    return map;
  }, [comparacionVisible]);

  // Qué Lámina(s) deficitaria(s) consume cada Forro candidato, y cuánto por unidad — se explota
  // el Forro directamente (una sola llamada trae TODO su árbol restante, con CANTIDAD_ACUMULADA ya
  // compuesta sin importar cuántos saltos de BOM tome, sea por la rama Tapa→Acolchado o por la
  // rama Banda→Banda en Metros) y se cruza contra los códigos deficitarios. Así el recorte de la
  // simulación solo toca Forros que de verdad dependen de la lámina faltante — nunca uno que no
  // la usa (confirmado: Zafiro se estaba recortando sin usar la D22 BL que estaba en déficit).
  const [forroALaminasMap, setForroALaminasMap] = useState<Map<string, Map<string, number>>>(new Map());
  const forroLaminasResueltosRef = useRef<Set<string>>(new Set());

  useEffect(() => {
    if (laminasDeficitarias.size === 0 || chnAForroMap.size === 0) return;
    const forrosCandidatos = Array.from(new Set(Array.from(chnAForroMap.values()).map(f => f.codigo)));
    const pendientes = forrosCandidatos.filter(f => !forroLaminasResueltosRef.current.has(f));
    if (pendientes.length === 0) return;
    let cancelled = false;
    (async () => {
      const encontrados = new Map<string, Map<string, number>>();
      for (const forro of pendientes) {
        forroLaminasResueltosRef.current.add(forro);
        try {
          for (const centro of ['1000', '2000']) {
            const response = await serviciosService.getMaestroMaterialesExplosion(centro, forro, 1, 5000);
            const componentes: any[] = response.data || [];
            const porLamina = new Map<string, number>();
            componentes.forEach((comp: any) => {
              const compMat = normalizeMaterialCode(comp.COMPONENTE || '');
              if (!compMat || !laminasDeficitarias.has(compMat)) return;
              const cant = Number(comp.CANTIDAD_ACUMULADA || comp.CANTIDAD_UNITARIA || 0);
              porLamina.set(compMat, Math.max(porLamina.get(compMat) || 0, cant));
            });
            if (porLamina.size > 0) { encontrados.set(forro, porLamina); break; }
          }
        } catch (error: any) {
          addNotification('error', `Error al explotar el Forro ${forro} para cruzar con Lámina en déficit: ${error.message}`);
        }
      }
      if (!cancelled && encontrados.size > 0) {
        setForroALaminasMap(prev => {
          const next = new Map(prev);
          encontrados.forEach((value, key) => next.set(key, value));
          return next;
        });
      }
    })();
    return () => { cancelled = true; };
  }, [laminasDeficitarias, chnAForroMap, normalizeMaterialCode, addNotification]);

  // Simulación de ajuste: cierra el déficit LÁMINA POR LÁMINA (no un número agregado sin
  // relación) recortando cantidades del Nivel 1 (Forro) del plan P1.5 — nunca P3 — recorriendo
  // los materiales con registro en MaterialesBalanceo por prioridad descendente (4 primero), pero
  // SOLO si ese Forro realmente consume alguna Lámina en déficit (`forroALaminasMap`); si no la
  // consume, no se toca sin importar su prioridad. Por cada material candidato que sí aplica se
  // recorta entre su porc_minimo_balanceo y porc_maximo_balanceo (lo mínimo necesario para cerrar
  // la lámina más exigente que consuma, acotado por ese rango); si al llegar al máximo el déficit
  // de esa lámina sigue abierto, se pasa al siguiente material candidato. Es solo simulación: no
  // se guarda ningún cambio.
  // El codigo_material de MaterialesBalanceo es el del CHN, no el del Forro terminado del
  // plan P1.5 — por eso se usa `chnAForroMap` (explosión BOM) para ubicar el Forro real de
  // cada CHN antes de buscar su cantidad producida ese día.
  const simulacionAjuste = useMemo(() => {
    const deficitTotalInicial = Array.from(laminasDeficitarias.values()).reduce((a, b) => a + b, 0);
    const deficitRestantePorLamina = new Map(laminasDeficitarias);

    const filas = [...materialesBalanceoData]
      .sort((a, b) => b.prioridad - a.prioridad)
      .map((mb) => {
        const codigoChn = normalizeMaterialCode(mb.codigo_material);
        const forro = chnAForroMap.get(codigoChn);
        const cantidadActual = forro ? (p15ForroPorMaterial.get(forro.codigo) || 0) : 0;
        return { mb, codigoChn, forro, cantidadActual };
      })
      .filter(({ cantidadActual, forro }) => cantidadActual > 0 && !!forro)
      .map(({ mb, codigoChn, forro, cantidadActual }) => {
        const porcMinimo = Number(mb.porc_minimo_balanceo) || 0;
        const porcMaximo = Number(mb.porc_maximo_balanceo) || 0;
        const minCut = cantidadActual * porcMinimo / 100;
        const maxCut = cantidadActual * porcMaximo / 100;

        const laminasQueConsume = forroALaminasMap.get(forro!.codigo);
        let recorteAplicado = 0;
        let estado: 'sin-ajuste' | 'ajustado' | 'al-maximo' = 'sin-ajuste';

        if (laminasQueConsume && laminasQueConsume.size > 0 && maxCut > 0) {
          // Unidades de Forro necesarias para cerrar CADA lámina deficitaria que este Forro
          // toca; se corta lo que pida la más exigente — esa misma acción ya alivia a las demás
          // que también consuma, no hace falta repetir el recorte por cada una.
          let recorteNecesario = 0;
          laminasQueConsume.forEach((cantidadUnitaria, laminaCodigo) => {
            const restante = deficitRestantePorLamina.get(laminaCodigo) || 0;
            if (restante <= 0 || cantidadUnitaria <= 0) return;
            recorteNecesario = Math.max(recorteNecesario, restante / cantidadUnitaria);
          });

          if (recorteNecesario > 0) {
            recorteAplicado = Math.min(maxCut, Math.max(minCut, recorteNecesario));
            estado = recorteAplicado >= maxCut ? 'al-maximo' : 'ajustado';
            laminasQueConsume.forEach((cantidadUnitaria, laminaCodigo) => {
              const restante = deficitRestantePorLamina.get(laminaCodigo);
              if (restante === undefined) return;
              deficitRestantePorLamina.set(laminaCodigo, Math.max(0, restante - recorteAplicado * cantidadUnitaria));
            });
          }
        }

        return {
          codigo_material_balanceo: mb.codigo_material_balanceo,
          codigo_material_chn: codigoChn,
          codigo_material: forro!.codigo,
          prioridad: mb.prioridad,
          cantidadActual,
          porcMinimo,
          porcMaximo,
          recorteAplicado,
          cantidadAjustada: cantidadActual - recorteAplicado,
          estado,
        };
      })
      .sort((a, b) => b.prioridad - a.prioridad);

    const deficitRestante = Array.from(deficitRestantePorLamina.values()).reduce((a, b) => a + b, 0);
    return { deficitTotalInicial, deficitRestante, filas };
  }, [laminasDeficitarias, forroALaminasMap, p15ForroPorMaterial, materialesBalanceoData, normalizeMaterialCode, chnAForroMap]);

  // Paginación de "Simulación de Ajuste — Forro P1.5" (mismo criterio que la tabla de comparación
  // de arriba, con su propia página porque son dos tablas independientes).
  const [simulacionPage, setSimulacionPage] = useState(1);
  useEffect(() => { setSimulacionPage(1); }, [simulacionAjuste.filas]);
  const simulacionTotalPages = Math.max(1, Math.ceil(simulacionAjuste.filas.length / CAPACIDAD_PAGE_SIZE));
  const simulacionPageSafe = Math.min(simulacionPage, simulacionTotalPages);
  const simulacionPageRows = useMemo(() => {
    const start = (simulacionPageSafe - 1) * CAPACIDAD_PAGE_SIZE;
    return simulacionAjuste.filas.slice(start, start + CAPACIDAD_PAGE_SIZE);
  }, [simulacionAjuste.filas, simulacionPageSafe]);

  // Aplicar el ajuste de verdad: regenerar el plan P1.5 con las cantidades de Forro ya
  // recortadas (re-explotando hacia Tapa/Acolchado), y/o repartir ese mismo recorte
  // proporcionalmente sobre el plan P1 (Ensamblado) del CHN 1:1 correspondiente.
  const [isRegenerandoP15, setIsRegenerandoP15] = useState(false);
  const [confirmRegenerarP15Open, setConfirmRegenerarP15Open] = useState(false);
  const [isAplicandoP1, setIsAplicandoP1] = useState(false);
  const [confirmAplicarP1Open, setConfirmAplicarP1Open] = useState(false);
  const [previewAjustePlanP1, setPreviewAjustePlanP1] = useState<{
    codigo_material_chn: string; nombre: string; codigo_grupo: number; cantidadOriginal: number; reduccion: number; cantidadNueva: number;
  }[] | null>(null);
  const [isCalculandoPreviewP1, setIsCalculandoPreviewP1] = useState(false);

  // Botones 3 y 4 (solo cuando NO se requiere ajuste, deficitTotalInicial === 0): clonan el
  // plan P1.5 y el plan P1 activos de esta fecha tal cual están, sin recortar nada,
  // renombrando el plan_grupo resultante de P1.5 a PFM y el de P1 a PFF — mismo patrón de
  // baja+alta que handleRegenerarPlanP15Ajustado/handleAplicarAjustePlanP1, pero sin
  // simulación de recorte porque no hay déficit que cerrar.
  const [isGuardandoPFMSinAjuste, setIsGuardandoPFMSinAjuste] = useState(false);
  const [confirmPFMSinAjusteOpen, setConfirmPFMSinAjusteOpen] = useState(false);
  const [isGuardandoPFFSinAjuste, setIsGuardandoPFFSinAjuste] = useState(false);
  const [confirmPFFSinAjusteOpen, setConfirmPFFSinAjusteOpen] = useState(false);

  useEffect(() => {
    if (!onProcessChange) return;
    if (isRegenerandoP15) onProcessChange({ label: 'Regenerando Plan P1.5 con ajuste', progress: null });
    else if (isAplicandoP1) onProcessChange({ label: 'Aplicando ajuste al Plan P1', progress: null });
    else if (isGuardandoPFMSinAjuste) onProcessChange({ label: 'Guardando PFM sin ajuste', progress: null });
    else if (isGuardandoPFFSinAjuste) onProcessChange({ label: 'Guardando PFF sin ajuste', progress: null });
    else onProcessChange(null);
  }, [isRegenerandoP15, isAplicandoP1, isGuardandoPFMSinAjuste, isGuardandoPFFSinAjuste, onProcessChange]);

  const construirDetalleParaGuardar = (base: Omit<Partial<DetalleTactico>, 'codigo_material'> & { codigo_plan_grupo: number; codigo_material: number | string }, cantidad: number, estado: string): DetalleTactico => ({
    codigo_detalle_tactico: 0,
    codigo_plan_grupo: base.codigo_plan_grupo,
    codigo_material: Number(base.codigo_material),
    linea_produccion: base.linea_produccion ?? '',
    cantidad_produccion_neta: String(Math.round(cantidad)),
    resp_ctrl_prod: '',
    clase_aprovisionamiento: '',
    cantidad_aprovisionamiento: 0,
    estado,
    fecha_modificacion: new Date(),
    usuario_modificacion: '',
  });

  // Vuelve a correr la explosión Forro→Tapa→Acolchado (misma fórmula de
  // fetchNivel2TapaComponentes/fetchNivel3AcolchadoComponentes) a partir de una lista de
  // {material, cantidad} de Forro ya ajustada, para un único centro/plan_grupo.
  const explotarNivel1a3 = async (nivel1: { material: string; cantidad: number }[]) => {
    const nivel1Filtrado = nivel1.filter(n => n.cantidad > 0);

    const nivel2Map = new Map<string, number>();
    for (const { material, cantidad } of nivel1Filtrado) {
      const response = await serviciosService.getMaestroMaterialesExplosion('1000', material, 1, 5000);
      (response.data || [])
        .filter((c: any) => Number(c.NIVEL) === 1 && String(c.DESCRIPCION_COMPONENTE || '').toUpperCase().includes('TAPA'))
        .forEach((c: any) => {
          const mat = String(c.COMPONENTE || '').trim();
          const necesidad = Number(c.CANTIDAD_UNITARIA || 0) * cantidad;
          nivel2Map.set(mat, (nivel2Map.get(mat) || 0) + necesidad);
        });
    }
    const nivel2 = Array.from(nivel2Map.entries()).map(([material, cantidad]) => ({ material, cantidad }));

    const nivel3Map = new Map<string, number>();
    for (const { material, cantidad } of nivel2.filter(n => n.cantidad > 0)) {
      const response = await serviciosService.getMaestroMaterialesExplosion('1000', material, 1, 5000);
      (response.data || [])
        .filter((c: any) => Number(c.NIVEL) === 1 && String(c.DESCRIPCION_COMPONENTE || '').toUpperCase().includes('ACOLCHADO'))
        .forEach((c: any) => {
          const mat = String(c.COMPONENTE || '').trim();
          const necesidad = Number(c.CANTIDAD_UNITARIA || 0) * cantidad;
          nivel3Map.set(mat, (nivel3Map.get(mat) || 0) + necesidad);
        });
    }
    const nivel3 = Array.from(nivel3Map.entries()).map(([material, cantidad]) => ({ material, cantidad }));

    return { nivel1: nivel1Filtrado, nivel2, nivel3 };
  };

  const clasificarNivelP15 = (item: any): 'forro' | 'tapa' | 'acolchado' | 'otros' => {
    const nombreMaterial = materialNombrePorCodigo.get(normalizeMaterialCode(item.codigo_material)) || '';
    const n = normalizeText(nombreMaterial);
    if (n.startsWith('FORRO')) return 'forro';
    if (n.startsWith('TAPA')) return 'tapa';
    if (n.startsWith('ACOLCHADO')) return 'acolchado';
    return 'otros';
  };

  // Botón 1: da de baja el plan P1.5 activo de esta fecha (todos sus niveles) y crea uno
  // nuevo, por cada centro que ya existía, con el Forro (Nivel 1) recortado según
  // `simulacionAjuste` y el Tapa/Acolchado (Nivel 2/3) re-explotados a partir de ese Forro
  // ajustado. Nunca toca P2 (Nivel 4 / Lámina).
  const handleRegenerarPlanP15Ajustado = useCallback(async () => {
    if (!fechaN1 || !fechaN2N3 || forrosGruposList.length === 0) return;
    const recortesPorMaterial = new Map<string, number>();
    simulacionAjuste.filas.forEach(f => {
      if (f.recorteAplicado > 0) recortesPorMaterial.set(f.codigo_material, (recortesPorMaterial.get(f.codigo_material) || 0) + f.recorteAplicado);
    });
    if (recortesPorMaterial.size === 0) {
      addNotification('warning', 'No hay ningún recorte aplicado en la simulación para regenerar el plan P1.5.');
      return;
    }

    setIsRegenerandoP15(true);
    try {
      const gruposP2 = forrosGruposList.map(g => g.codigo_grupo).join('&');
      // El Forro (Nivel 1) vive en fechaN1 y el Tapa/Acolchado/Otros (Nivel 2+3) en
      // fechaN2N3 — son plan_grupo distintos aunque coincidan de fecha, por eso se consultan
      // ambas fechas y se deduplica por codigo_detalle_tactico antes de agrupar por plan_grupo.
      const fechasP15 = Array.from(new Set([fechaN1, fechaN2N3].filter(Boolean)));
      const respsP15 = await Promise.all(fechasP15.map(f => serviciosService.detallePlanTacticoPorGrupos(gruposP2, f)));
      const vistosP15 = new Set<number>();
      // Acepta también PFM (ya renombrado): permite volver a ajustar un plan que ya fue
      // regenerado antes, no solo la primera vez que el P1.5 sigue crudo.
      const filasP15 = respsP15.flatMap(r => r.data || []).filter((item: any) => {
        if (!PLAN_GRUPO_VALOR_REGEX_P1_5_O_PFM.test(String(item.valor || ''))) return false;
        const id = Number(item.codigo_detalle_tactico);
        if (vistosP15.has(id)) return false;
        vistosP15.add(id);
        return true;
      });

      if (filasP15.length === 0) {
        addNotification('warning', 'No hay un plan P1.5 activo para esta fecha.');
        return;
      }

      const porPlanGrupo = new Map<number, any[]>();
      filasP15.forEach((item: any) => {
        const key = Number(item.codigo_plan_grupo);
        if (!porPlanGrupo.has(key)) porPlanGrupo.set(key, []);
        porPlanGrupo.get(key)!.push(item);
      });

      // Reparte el recorte de cada material Forro proporcionalmente entre sus filas
      // (una por cada centro/plan_grupo donde ese Forro tiene cantidad planificada).
      const forroRowsPorMaterial = new Map<string, any[]>();
      filasP15.forEach((item: any) => {
        if (clasificarNivelP15(item) !== 'forro') return;
        const mat = normalizeMaterialCode(item.codigo_material);
        if (!forroRowsPorMaterial.has(mat)) forroRowsPorMaterial.set(mat, []);
        forroRowsPorMaterial.get(mat)!.push(item);
      });

      const cantidadAjustadaPorDetalle = new Map<number, number>();
      forroRowsPorMaterial.forEach((filas, material) => {
        const recorte = recortesPorMaterial.get(material) || 0;
        const filasKeyed = filas.map((item: any) => ({ key: Number(item.codigo_detalle_tactico), cantidad: Number(item.cantidad_produccion_neta || 0) }));
        const reducciones = recorte > 0 ? repartirProporcional(recorte, filasKeyed) : new Map<number, number>();
        filas.forEach((item: any) => {
          const cantidadOriginal = Number(item.cantidad_produccion_neta || 0);
          const reduccion = reducciones.get(Number(item.codigo_detalle_tactico)) || 0;
          cantidadAjustadaPorDetalle.set(Number(item.codigo_detalle_tactico), Math.max(0, cantidadOriginal - reduccion));
        });
      });

      let plansCreados = 0;
      let detallesCreados = 0;
      let plansDesactivados = 0;
      let detallesDesactivados = 0;

      // Se agrupa por CENTRO/GRUPO (codigo_grupo), no por plan_grupo individual: el Forro
      // (N1) y el Tapa/Acolchado/Otros (N2N3) viven en DOS plan_grupo separados del mismo
      // grupo, y hace falta juntar el Forro de ambos para poder re-explotar Nivel 1 -> 2 -> 3.
      // Procesarlos por separado (como se hacía antes) dejaba al plan_grupo N2N3 sin ningún
      // Forro con qué explotar, y terminaba sin generar nada para ese plan.
      const porCodigoGrupo = new Map<number, { planesViejos: PlanGrupo[]; itemsForro: any[]; itemsOtrosNivel: any[] }>();
      for (const [codigoPlanGrupoViejo, itemsDelPlan] of porPlanGrupo.entries()) {
        const planGrupoRef = await planGrupoService.getById(codigoPlanGrupoViejo);
        if (!planGrupoRef.data) continue;
        const codigoGrupo = planGrupoRef.data.codigo_grupo;
        if (!porCodigoGrupo.has(codigoGrupo)) porCodigoGrupo.set(codigoGrupo, { planesViejos: [], itemsForro: [], itemsOtrosNivel: [] });
        const entry = porCodigoGrupo.get(codigoGrupo)!;
        entry.planesViejos.push(planGrupoRef.data);
        itemsDelPlan.forEach((item: any) => {
          if (clasificarNivelP15(item) === 'forro') entry.itemsForro.push(item);
          else entry.itemsOtrosNivel.push(item);
        });
      }

      for (const [codigoGrupo, entry] of porCodigoGrupo.entries()) {
        // Nivel 1 (Forro) ajustado, agregado por material — de TODO el grupo (N1 + N2N3).
        const nivel1Map = new Map<string, number>();
        entry.itemsForro.forEach((item: any) => {
          const mat = normalizeMaterialCode(item.codigo_material);
          const cantidad = cantidadAjustadaPorDetalle.get(Number(item.codigo_detalle_tactico)) ?? Number(item.cantidad_produccion_neta || 0);
          nivel1Map.set(mat, (nivel1Map.get(mat) || 0) + cantidad);
        });
        const nivel1 = Array.from(nivel1Map.entries()).map(([material, cantidad]) => ({ material, cantidad }));

        const { nivel1: nivel1Final, nivel2, nivel3 } = await explotarNivel1a3(nivel1);
        const otros = entry.itemsOtrosNivel.filter((item: any) => clasificarNivelP15(item) === 'otros');

        // Soft delete de TODOS los plan_grupo viejos de este grupo (N1 y N2N3) y su detalle.
        for (const planGrupoViejo of entry.planesViejos) {
          await planGrupoService.save({ ...planGrupoViejo, estado: 'I' });
          plansDesactivados++;
        }
        for (const item of [...entry.itemsForro, ...entry.itemsOtrosNivel]) {
          await detalleTacticoService.save(construirDetalleParaGuardar(item, Number(item.cantidad_produccion_neta || 0), 'I'));
          detallesDesactivados++;
        }

        const centro = forrosGruposList.find(g => g.codigo_grupo === codigoGrupo)?.centro
          ?? entry.planesViejos[0].valor.match(/centro\s*(1000|2000)/i)?.[1]
          ?? '';
        const codigoPlan = entry.planesViejos[0].codigo_plan;
        const codigoFamiliaGrupo = entry.planesViejos[0].codigo_familia_grupo;

        // Nuevo plan_grupo PFM - N1 (Forro).
        if (nivel1Final.length > 0) {
          const nuevoPlanN1: PlanGrupo = {
            codigo_plan_grupo: 0,
            codigo_plan: codigoPlan,
            codigo_grupo: codigoGrupo,
            codigo_familia_grupo: codigoFamiliaGrupo,
            valor: `Plan Táctico - Centro ${centro} - PFM - N1`,
            fecha_inicio_plan: new Date(fechaN1),
            fecha_fin_plan: new Date(fechaN1),
            estado: 'A',
            fecha_creacion: new Date(),
            usuario_creacion: 'admin',
          };
          const nuevoPlanN1Guardado = await planGrupoService.save(nuevoPlanN1);
          const codigoPlanN1Nuevo = nuevoPlanN1Guardado.data?.codigo_plan_grupo;
          if (!codigoPlanN1Nuevo) throw new Error(`No se recibió codigo_plan_grupo al crear el nuevo PFM - N1 (centro ${centro}).`);
          plansCreados++;
          for (const r of nivel1Final) {
            if (r.cantidad <= 0) continue;
            await detalleTacticoService.save(construirDetalleParaGuardar({ codigo_plan_grupo: codigoPlanN1Nuevo, codigo_material: r.material }, r.cantidad, 'A'));
            detallesCreados++;
          }
        }

        // Nuevo plan_grupo PFM - N2N3 (Tapa + Acolchado + Otros).
        const filasN2N3 = [
          ...nivel2.map(r => ({ codigo_material: r.material, cantidad: r.cantidad })),
          ...nivel3.map(r => ({ codigo_material: r.material, cantidad: r.cantidad })),
          ...otros.map((item: any) => ({ codigo_material: normalizeMaterialCode(item.codigo_material), cantidad: Number(item.cantidad_produccion_neta || 0) })),
        ];
        if (filasN2N3.length > 0) {
          const nuevoPlanN2N3: PlanGrupo = {
            codigo_plan_grupo: 0,
            codigo_plan: codigoPlan,
            codigo_grupo: codigoGrupo,
            codigo_familia_grupo: codigoFamiliaGrupo,
            valor: `Plan Táctico - Centro ${centro} - PFM - N2N3`,
            fecha_inicio_plan: new Date(fechaN2N3),
            fecha_fin_plan: new Date(fechaN2N3),
            estado: 'A',
            fecha_creacion: new Date(),
            usuario_creacion: 'admin',
          };
          const nuevoPlanN2N3Guardado = await planGrupoService.save(nuevoPlanN2N3);
          const codigoPlanN2N3Nuevo = nuevoPlanN2N3Guardado.data?.codigo_plan_grupo;
          if (!codigoPlanN2N3Nuevo) throw new Error(`No se recibió codigo_plan_grupo al crear el nuevo PFM - N2N3 (centro ${centro}).`);
          plansCreados++;
          for (const fila of filasN2N3) {
            if (fila.cantidad <= 0) continue;
            await detalleTacticoService.save(construirDetalleParaGuardar({ codigo_plan_grupo: codigoPlanN2N3Nuevo, codigo_material: fila.codigo_material }, fila.cantidad, 'A'));
            detallesCreados++;
          }
        }
      }

      addNotification('success', `Plan PFM regenerado con ajuste: ${plansDesactivados} plan(es) desactivado(s) (${detallesDesactivados} filas), ${plansCreados} plan(es) nuevo(s) creado(s) (${detallesCreados} filas).`);
      setConfirmRegenerarP15Open(false);
      fetchComparacion();
    } catch (error: any) {
      addNotification('error', `Error al regenerar el plan P1.5: ${error.message}`);
    } finally {
      setIsRegenerandoP15(false);
    }
  }, [fechaN1, fechaN2N3, forrosGruposList, simulacionAjuste, materialNombrePorCodigo, normalizeMaterialCode, addNotification, fetchComparacion]);

  // Botón 2: reparte el mismo recorte (ya aplicado sobre el Forro) sobre el CHN 1:1
  // correspondiente en el plan P1 (Ensamblado, grupos de `gruposCoincidentes`),
  // proporcionalmente entre los grupos/centros donde ese CHN ya tenía cantidad
  // planificada. Da de baja el plan_grupo P1 afectado (todo su detalle) y crea uno
  // nuevo con las cantidades ya ajustadas — igual que el patrón de baja+alta de P1.5.
  // No puede haber dos plan_grupo P1 activos simultáneos para el mismo centro/fecha
  // (confirmado explícitamente por el usuario 2026-07-24, ver [[feedback-p1-solo-consulta-p2-escribible]]).
  const calcularAjustePlanP1 = useCallback(async () => {
    if (!fechaP1 || gruposCoincidentes.length === 0) return null;
    const recortesPorChn = new Map<string, number>();
    simulacionAjuste.filas.forEach(f => {
      if (f.recorteAplicado > 0) recortesPorChn.set(f.codigo_material_chn, (recortesPorChn.get(f.codigo_material_chn) || 0) + f.recorteAplicado);
    });
    if (recortesPorChn.size === 0) return { filas: [], sinBase: [] as string[], itemsPorPlanGrupo: new Map<number, any[]>() };

    const gruposParam = gruposCoincidentes.map(g => g.codigo_grupo).join('&');
    const [respDetalle, respPlanGrupo] = await Promise.all([
      serviciosService.detallePlanTacticoPorGrupos(gruposParam, fechaP1),
      planGrupoService.getAll(),
    ]);
    const codigoGrupoPorPlanGrupo = new Map<number, number>();
    (respPlanGrupo.data || []).forEach((pg: PlanGrupo) => codigoGrupoPorPlanGrupo.set(pg.codigo_plan_grupo, pg.codigo_grupo));
    // Acepta tanto P1 crudo como PFF (ya ajustado): si ya existe un PFF activo para esta fecha,
    // este botón debe poder volver a ajustarlo (desactivándolo y creando el nuevo), no solo
    // funcionar la primera vez que el P1 todavía no se había ajustado.
    const filasP1 = (respDetalle.data || []).filter((item: any) => PLAN_GRUPO_VALOR_REGEX_P1_O_PFF.test(String(item.valor || '')));

    // Todas las filas P1 de la fecha, agrupadas por plan_grupo — se necesitan completas
    // (no solo las afectadas por el recorte) para poder migrar el plan_grupo entero al
    // darlo de baja y recrearlo.
    const itemsPorPlanGrupo = new Map<number, any[]>();
    filasP1.forEach((item: any) => {
      const key = Number(item.codigo_plan_grupo);
      if (!itemsPorPlanGrupo.has(key)) itemsPorPlanGrupo.set(key, []);
      itemsPorPlanGrupo.get(key)!.push(item);
    });

    const filasPorMaterial = new Map<string, any[]>();
    filasP1.forEach((item: any) => {
      const mat = normalizeMaterialCode(item.codigo_material);
      if (!filasPorMaterial.has(mat)) filasPorMaterial.set(mat, []);
      filasPorMaterial.get(mat)!.push(item);
    });

    const filasResultado: { item: any; codigo_material_chn: string; codigo_grupo: number; cantidadOriginal: number; reduccion: number; cantidadNueva: number }[] = [];
    const sinBase: string[] = [];

    recortesPorChn.forEach((recorte, codigoChn) => {
      const filas = filasPorMaterial.get(codigoChn) || [];
      if (filas.length === 0) {
        sinBase.push(codigoChn);
        return;
      }
      const filasKeyed = filas.map((item: any) => ({ key: Number(item.codigo_detalle_tactico), cantidad: Number(item.cantidad_produccion_neta || 0) }));
      const reducciones = repartirProporcional(recorte, filasKeyed);
      filas.forEach((item: any) => {
        const cantidadOriginal = Number(item.cantidad_produccion_neta || 0);
        const reduccion = reducciones.get(Number(item.codigo_detalle_tactico)) || 0;
        if (reduccion <= 0) return;
        filasResultado.push({
          item,
          codigo_material_chn: codigoChn,
          codigo_grupo: codigoGrupoPorPlanGrupo.get(Number(item.codigo_plan_grupo)) ?? 0,
          cantidadOriginal,
          reduccion,
          cantidadNueva: Math.max(0, cantidadOriginal - reduccion),
        });
      });
    });

    return { filas: filasResultado, sinBase, itemsPorPlanGrupo };
  }, [fechaP1, gruposCoincidentes, simulacionAjuste, normalizeMaterialCode]);

  const handleAbrirPreviewAjusteP1 = useCallback(async () => {
    setIsCalculandoPreviewP1(true);
    try {
      const resultado = await calcularAjustePlanP1();
      if (!resultado || resultado.filas.length === 0) {
        if (!resultado) {
          addNotification('warning', 'No hay ningún recorte aplicado en la simulación para llevar al plan P1.');
          return;
        }
        if (resultado.sinBase.length > 0) {
          addNotification('warning', `Ningún material en déficit tiene base en el plan P1 para esta fecha (${resultado.sinBase.join(', ')}).`);
          return;
        }
        // No hay ningún recorte que aplicar en este momento — de todas formas se ofrece crear un
        // PFF nuevo (clon sin cambios), desactivando el que ya esté activo, en vez de no hacer
        // nada: este botón debe poder regenerar el PFF aunque ahora mismo no haya déficit.
        setConfirmPFFSinAjusteOpen(true);
        return;
      }
      if (resultado.sinBase.length > 0) {
        addNotification('warning', `Se omiten del ajuste de P1 (sin base en el plan de esta fecha): ${resultado.sinBase.join(', ')}.`);
      }
      setPreviewAjustePlanP1(resultado.filas.map(f => ({
        codigo_material_chn: f.codigo_material_chn,
        nombre: materialNombrePorCodigo.get(f.codigo_material_chn) || '—',
        codigo_grupo: f.codigo_grupo,
        cantidadOriginal: f.cantidadOriginal,
        reduccion: f.reduccion,
        cantidadNueva: f.cantidadNueva,
      })));
      setConfirmAplicarP1Open(true);
    } catch (error: any) {
      addNotification('error', `Error al calcular el ajuste del plan P1: ${error.message}`);
    } finally {
      setIsCalculandoPreviewP1(false);
    }
  }, [calcularAjustePlanP1, addNotification, materialNombrePorCodigo]);

  // Clona el plan P1.5 (Forro/Tapa/Acolchado/Otros) activo de esta fecha tal cual, sin
  // recortar nada, renombrando el plan_grupo resultante de "P1.5" a "PFM". Se usa cuando
  // simulacionAjuste.deficitTotalInicial === 0 (no hay nada que ajustar) pero igual hace
  // falta dejar un PFM guardado para los pasos siguientes.
  const handleGuardarPFMSinAjuste = useCallback(async () => {
    if (!fechaN1 || !fechaN2N3 || forrosGruposList.length === 0) return;
    setIsGuardandoPFMSinAjuste(true);
    try {
      const gruposP2 = forrosGruposList.map(g => g.codigo_grupo).join('&');
      // Forro vive en fechaN1, Tapa/Acolchado/Otros en fechaN2N3 — mismo criterio que
      // handleRegenerarPlanP15Ajustado (son plan_grupo distintos aunque coincidan de fecha).
      const fechasP15 = Array.from(new Set([fechaN1, fechaN2N3].filter(Boolean)));
      const respsP15 = await Promise.all(fechasP15.map(f => serviciosService.detallePlanTacticoPorGrupos(gruposP2, f)));
      const vistosP15 = new Set<number>();
      // Acepta también PFM (ya renombrado): si ya existe uno activo, este botón lo desactiva y
      // clona uno nuevo, en vez de solo funcionar mientras el P1.5 sigue crudo.
      const filasP15 = respsP15.flatMap(r => r.data || []).filter((item: any) => {
        if (!PLAN_GRUPO_VALOR_REGEX_P1_5_O_PFM.test(String(item.valor || ''))) return false;
        const id = Number(item.codigo_detalle_tactico);
        if (vistosP15.has(id)) return false;
        vistosP15.add(id);
        return true;
      });
      if (filasP15.length === 0) {
        addNotification('warning', 'No hay un plan P1.5 activo para esta fecha.');
        return;
      }

      const porPlanGrupo = new Map<number, any[]>();
      filasP15.forEach((item: any) => {
        const key = Number(item.codigo_plan_grupo);
        if (!porPlanGrupo.has(key)) porPlanGrupo.set(key, []);
        porPlanGrupo.get(key)!.push(item);
      });

      let plansCreados = 0;
      let detallesCreados = 0;
      let plansDesactivados = 0;
      let detallesDesactivados = 0;

      for (const [codigoPlanGrupoViejo, itemsDelPlan] of porPlanGrupo.entries()) {
        const planGrupoRef = await planGrupoService.getById(codigoPlanGrupoViejo);
        if (!planGrupoRef.data) continue;

        await planGrupoService.save({ ...planGrupoRef.data, estado: 'I' });
        plansDesactivados++;
        for (const item of itemsDelPlan) {
          await detalleTacticoService.save({
            codigo_detalle_tactico: item.codigo_detalle_tactico,
            codigo_plan_grupo: item.codigo_plan_grupo,
            codigo_material: Number(item.codigo_material),
            cantidad_produccion_neta: String(item.cantidad_produccion_neta ?? '0'),
            resp_ctrl_prod: item.resp_ctrl_prod || '',
            clase_aprovisionamiento: item.clase_aprovisionamiento || '',
            cantidad_aprovisionamiento: Number(item.cantidad_aprovisionamiento ?? 0),
            linea_produccion: item.linea_produccion || '',
            estado: 'I',
            usuario_modificacion: 'admin',
            fecha_modificacion: new Date(),
          } as DetalleTactico);
          detallesDesactivados++;
        }

        const valorPFM = planGrupoRef.data.valor.replace(/p1\.5/i, 'PFM');
        const nuevoPlanGrupo: PlanGrupo = {
          codigo_plan_grupo: 0,
          codigo_plan: planGrupoRef.data.codigo_plan,
          codigo_grupo: planGrupoRef.data.codigo_grupo,
          codigo_familia_grupo: planGrupoRef.data.codigo_familia_grupo,
          valor: valorPFM,
          fecha_inicio_plan: planGrupoRef.data.fecha_inicio_plan,
          fecha_fin_plan: planGrupoRef.data.fecha_fin_plan,
          estado: 'A',
          fecha_creacion: new Date(),
          usuario_creacion: 'admin',
        };
        const nuevoPlanGuardado = await planGrupoService.save(nuevoPlanGrupo);
        const codigoPlanGrupoNuevo = nuevoPlanGuardado.data?.codigo_plan_grupo;
        if (!codigoPlanGrupoNuevo) throw new Error(`No se recibió codigo_plan_grupo al crear el nuevo PFM (${valorPFM}).`);
        plansCreados++;

        for (const item of itemsDelPlan) {
          const cantidad = Number(item.cantidad_produccion_neta || 0);
          if (cantidad <= 0) continue;
          await detalleTacticoService.save({
            codigo_detalle_tactico: 0,
            codigo_plan_grupo: codigoPlanGrupoNuevo,
            codigo_material: Number(item.codigo_material),
            cantidad_produccion_neta: String(Math.round(cantidad)),
            resp_ctrl_prod: item.resp_ctrl_prod || '',
            clase_aprovisionamiento: item.clase_aprovisionamiento || '',
            cantidad_aprovisionamiento: Number(item.cantidad_aprovisionamiento ?? 0),
            linea_produccion: item.linea_produccion || '',
            estado: 'A',
            usuario_modificacion: '',
          } as DetalleTactico);
          detallesCreados++;
        }
      }

      addNotification('success', `PFM guardado sin ajuste: ${plansDesactivados} plan(es) desactivado(s) (${detallesDesactivados} filas), ${plansCreados} plan(es) nuevo(s) creado(s) (${detallesCreados} filas).`);
      setConfirmPFMSinAjusteOpen(false);
      fetchComparacion();
    } catch (error: any) {
      addNotification('error', `Error al guardar el PFM sin ajuste: ${error.message}`);
    } finally {
      setIsGuardandoPFMSinAjuste(false);
    }
  }, [fechaN1, fechaN2N3, forrosGruposList, addNotification, fetchComparacion]);

  // Clona el plan P1 (Ensamblado) activo de esta fecha tal cual, sin recortar nada,
  // renombrando el plan_grupo resultante de "P1" a "PFF". Mismo caso de uso que
  // handleGuardarPFMSinAjuste: solo aplica cuando no hay déficit que ajustar.
  const handleGuardarPFFSinAjuste = useCallback(async () => {
    if (!fechaP1 || gruposCoincidentes.length === 0) return;
    setIsGuardandoPFFSinAjuste(true);
    try {
      const gruposParam = gruposCoincidentes.map(g => g.codigo_grupo).join('&');
      const respDetalle = await serviciosService.detallePlanTacticoPorGrupos(gruposParam, fechaP1);
      // Acepta también PFF (ya renombrado) — si ya existe uno activo, este botón lo desactiva y
      // clona uno nuevo, en vez de solo funcionar mientras el P1 sigue crudo.
      const filasP1 = (respDetalle.data || []).filter((item: any) => PLAN_GRUPO_VALOR_REGEX_P1_O_PFF.test(String(item.valor || '')));
      if (filasP1.length === 0) {
        addNotification('warning', 'No hay un plan P1 activo para esta fecha.');
        return;
      }

      const porPlanGrupo = new Map<number, any[]>();
      filasP1.forEach((item: any) => {
        const key = Number(item.codigo_plan_grupo);
        if (!porPlanGrupo.has(key)) porPlanGrupo.set(key, []);
        porPlanGrupo.get(key)!.push(item);
      });

      let plansCreados = 0;
      let detallesCreados = 0;
      let plansDesactivados = 0;
      let detallesDesactivados = 0;

      for (const [codigoPlanGrupoViejo, itemsDelPlan] of porPlanGrupo.entries()) {
        const planGrupoRef = await planGrupoService.getById(codigoPlanGrupoViejo);
        if (!planGrupoRef.data) continue;

        await planGrupoService.save({ ...planGrupoRef.data, estado: 'I' });
        plansDesactivados++;
        for (const item of itemsDelPlan) {
          await detalleTacticoService.save({
            codigo_detalle_tactico: item.codigo_detalle_tactico,
            codigo_plan_grupo: item.codigo_plan_grupo,
            codigo_material: Number(item.codigo_material),
            cantidad_produccion_neta: String(item.cantidad_produccion_neta ?? '0'),
            resp_ctrl_prod: item.resp_ctrl_prod || '',
            clase_aprovisionamiento: item.clase_aprovisionamiento || '',
            cantidad_aprovisionamiento: Number(item.cantidad_aprovisionamiento ?? 0),
            linea_produccion: item.linea_produccion || '',
            estado: 'I',
            usuario_modificacion: 'admin',
            fecha_modificacion: new Date(),
          } as DetalleTactico);
          detallesDesactivados++;
        }

        const valorPFF = planGrupoRef.data.valor.replace(/p1\b(?!\.5)/i, 'PFF');
        const nuevoPlanGrupo: PlanGrupo = {
          codigo_plan_grupo: 0,
          codigo_plan: planGrupoRef.data.codigo_plan,
          codigo_grupo: planGrupoRef.data.codigo_grupo,
          codigo_familia_grupo: planGrupoRef.data.codigo_familia_grupo,
          valor: valorPFF,
          fecha_inicio_plan: planGrupoRef.data.fecha_inicio_plan,
          fecha_fin_plan: planGrupoRef.data.fecha_fin_plan,
          estado: 'A',
          fecha_creacion: new Date(),
          usuario_creacion: 'admin',
        };
        const nuevoPlanGuardado = await planGrupoService.save(nuevoPlanGrupo);
        const codigoPlanGrupoNuevo = nuevoPlanGuardado.data?.codigo_plan_grupo;
        if (!codigoPlanGrupoNuevo) throw new Error(`No se recibió codigo_plan_grupo al crear el nuevo PFF (${valorPFF}).`);
        plansCreados++;

        for (const item of itemsDelPlan) {
          const cantidad = Number(item.cantidad_produccion_neta || 0);
          if (cantidad <= 0) continue;
          await detalleTacticoService.save({
            codigo_detalle_tactico: 0,
            codigo_plan_grupo: codigoPlanGrupoNuevo,
            codigo_material: Number(item.codigo_material),
            cantidad_produccion_neta: String(Math.round(cantidad)),
            resp_ctrl_prod: item.resp_ctrl_prod || '',
            clase_aprovisionamiento: item.clase_aprovisionamiento || '',
            cantidad_aprovisionamiento: Number(item.cantidad_aprovisionamiento ?? 0),
            linea_produccion: item.linea_produccion || '',
            estado: 'A',
            usuario_modificacion: '',
          } as DetalleTactico);
          detallesCreados++;
        }
      }

      addNotification('success', `PFF guardado sin ajuste: ${plansDesactivados} plan(es) desactivado(s) (${detallesDesactivados} filas), ${plansCreados} plan(es) nuevo(s) creado(s) (${detallesCreados} filas).`);
      setConfirmPFFSinAjusteOpen(false);
      fetchComparacion();
    } catch (error: any) {
      addNotification('error', `Error al guardar el PFF sin ajuste: ${error.message}`);
    } finally {
      setIsGuardandoPFFSinAjuste(false);
    }
  }, [fechaP1, gruposCoincidentes, addNotification, fetchComparacion]);

  const handleAplicarAjustePlanP1 = useCallback(async () => {
    setIsAplicandoP1(true);
    try {
      const resultado = await calcularAjustePlanP1();
      if (!resultado || resultado.filas.length === 0) {
        addNotification('warning', 'No hay ningún ajuste pendiente para aplicar al plan P1.');
        return;
      }
      // Mapa codigo_detalle_tactico -> cantidad ya ajustada, y el set de plan_grupo P1
      // que tienen al menos una fila afectada (los que no tienen recorte quedan intactos).
      const cantidadAjustadaPorDetalle = new Map<number, number>();
      const planGruposAfectados = new Set<number>();
      resultado.filas.forEach(f => {
        cantidadAjustadaPorDetalle.set(Number(f.item.codigo_detalle_tactico), f.cantidadNueva);
        planGruposAfectados.add(Number(f.item.codigo_plan_grupo));
      });

      let plansCreados = 0;
      let detallesCreados = 0;
      let plansDesactivados = 0;
      let detallesDesactivados = 0;

      for (const codigoPlanGrupoViejo of planGruposAfectados) {
        const itemsDelPlan = resultado.itemsPorPlanGrupo.get(codigoPlanGrupoViejo) || [];
        if (itemsDelPlan.length === 0) continue;

        const planGrupoRef = await planGrupoService.getById(codigoPlanGrupoViejo);
        if (!planGrupoRef.data) continue;

        // Da de baja el plan_grupo viejo y todo su detalle (con rastro de quién y cuándo
        // lo modificó) — no puede haber dos plan_grupo P1 activos simultáneos para el
        // mismo centro/fecha.
        await planGrupoService.save({ ...planGrupoRef.data, estado: 'I' });
        plansDesactivados++;
        for (const item of itemsDelPlan) {
          await detalleTacticoService.save({
            codigo_detalle_tactico: item.codigo_detalle_tactico,
            codigo_plan_grupo: item.codigo_plan_grupo,
            codigo_material: Number(item.codigo_material),
            cantidad_produccion_neta: String(item.cantidad_produccion_neta ?? '0'),
            resp_ctrl_prod: item.resp_ctrl_prod || '',
            clase_aprovisionamiento: item.clase_aprovisionamiento || '',
            cantidad_aprovisionamiento: Number(item.cantidad_aprovisionamiento ?? 0),
            linea_produccion: item.linea_produccion || '',
            estado: 'I',
            usuario_modificacion: 'admin',
            fecha_modificacion: new Date(),
          } as DetalleTactico);
          detallesDesactivados++;
        }

        // Nuevo plan_grupo del ajuste (mismo fecha/centro/codigo_plan que el anterior,
        // pero ya no se llama P1 sino PFF).
        const valorPFF = planGrupoRef.data.valor.replace(/p1\b(?!\.5)/i, 'PFF');
        const nuevoPlanGrupo: PlanGrupo = {
          codigo_plan_grupo: 0,
          codigo_plan: planGrupoRef.data.codigo_plan,
          codigo_grupo: planGrupoRef.data.codigo_grupo,
          codigo_familia_grupo: planGrupoRef.data.codigo_familia_grupo,
          valor: valorPFF,
          fecha_inicio_plan: planGrupoRef.data.fecha_inicio_plan,
          fecha_fin_plan: planGrupoRef.data.fecha_fin_plan,
          estado: 'A',
          fecha_creacion: new Date(),
          usuario_creacion: 'admin',
        };
        const nuevoPlanGuardado = await planGrupoService.save(nuevoPlanGrupo);
        const codigoPlanGrupoNuevo = nuevoPlanGuardado.data?.codigo_plan_grupo;
        if (!codigoPlanGrupoNuevo) throw new Error(`No se recibió codigo_plan_grupo al crear el nuevo PFF (${valorPFF}).`);
        plansCreados++;

        // Recrea todas las filas del plan (las afectadas con su cantidad ya ajustada,
        // el resto con la cantidad original) bajo el nuevo plan_grupo.
        for (const item of itemsDelPlan) {
          const cantidad = cantidadAjustadaPorDetalle.get(Number(item.codigo_detalle_tactico)) ?? Number(item.cantidad_produccion_neta || 0);
          if (cantidad <= 0) continue;
          await detalleTacticoService.save({
            codigo_detalle_tactico: 0,
            codigo_plan_grupo: codigoPlanGrupoNuevo,
            codigo_material: Number(item.codigo_material),
            cantidad_produccion_neta: String(Math.round(cantidad)),
            resp_ctrl_prod: item.resp_ctrl_prod || '',
            clase_aprovisionamiento: item.clase_aprovisionamiento || '',
            cantidad_aprovisionamiento: Number(item.cantidad_aprovisionamiento ?? 0),
            linea_produccion: item.linea_produccion || '',
            estado: 'A',
            usuario_modificacion: '',
          } as DetalleTactico);
          detallesCreados++;
        }
      }

      addNotification('success', `Plan P1 actualizado: ${plansDesactivados} plan(es) desactivado(s) (${detallesDesactivados} filas), ${plansCreados} plan(es) nuevo(s) creado(s) (${detallesCreados} filas).`);
      setConfirmAplicarP1Open(false);
      setPreviewAjustePlanP1(null);
    } catch (error: any) {
      addNotification('error', `Error al aplicar el ajuste al plan P1: ${error.message}`);
    } finally {
      setIsAplicandoP1(false);
    }
  }, [calcularAjustePlanP1, addNotification]);

  return (
    <div className="space-y-8">
      <Card className="rounded-[2.5rem] bg-white ring-1 ring-slate-100 overflow-hidden shadow-sm border-none">
        <CardHeader className="bg-slate-50/50 border-b border-slate-200 p-10">
          <div className="flex items-center justify-between flex-wrap gap-4">
            <div>
              <CardTitle className="text-2xl font-black text-slate-900 uppercase">Capacidad — P2 vs P3 por Material</CardTitle>
              <CardDescription className="text-slate-400 font-bold uppercase text-[10px] tracking-widest mt-1">
                Cant. Prod. Neta de Forros (P2) frente a Corte y Laminado (P3), por material, en la fecha seleccionada
              </CardDescription>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-[9px] font-black text-slate-400 uppercase">Fecha P2/P3:</span>
              <span className="flex items-center gap-2 text-xs font-bold text-slate-700 bg-slate-50 border border-slate-200 rounded-lg px-3 py-1.5">
                <CalendarIcon className="w-3.5 h-3.5 text-slate-400" />
                {fechaP2P3 || 'Sin fecha seleccionada'}
              </span>
              {isLoading && <Loader2 className="w-3.5 h-3.5 animate-spin text-indigo-600" />}
            </div>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          {isLoading ? (
            <div className="py-20 text-center text-slate-400 uppercase font-black tracking-widest text-xs flex items-center justify-center gap-2">
              <Loader2 className="w-4 h-4 animate-spin" /> Comparando planes P2 y P3...
            </div>
          ) : !hasFetched ? (
            <div className="py-20 text-center text-slate-400 uppercase font-black tracking-widest text-xs opacity-40">
              Selecciona una fecha en el encabezado de la pestaña para comparar los planes P2 y P3 por material
            </div>
          ) : comparacionVisible.length > 0 ? (
            <>
              <div className="overflow-x-auto">
                <table className="w-full text-[11px] border-collapse">
                  <thead className="bg-slate-50 text-slate-500 border-b border-slate-200 text-left uppercase tracking-widest font-black">
                    <tr>
                      <th className="px-6 py-4 text-[10px]">Material</th>
                      <th className="px-6 py-4 text-[10px]">Nombre Material</th>
                      <th className="px-6 py-4 text-[10px] text-right">Cant. Prod. Neta P2</th>
                      <th className="px-6 py-4 text-[10px] text-right">Cant. Prod. Neta P3</th>
                      <th className="px-6 py-4 text-[10px] text-right">Diferencia (P3 - P2)</th>
                      <th className="px-6 py-4 text-[10px] text-center">Estado</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {pageRows.map(row => {
                      const diferencia = row.cantidadP3 - row.cantidadP2;
                      const seFabrica = diferencia >= 0;
                      return (
                        <tr key={row.codigo_material} className="hover:bg-slate-50 transition-colors text-[10px]">
                          <td className="px-6 py-4 font-mono font-bold text-indigo-700">{row.codigo_material}</td>
                          <td className="px-6 py-4 font-bold text-slate-700 uppercase">
                            {materialNombrePorCodigo.get(row.codigo_material) || '—'}
                          </td>
                          <td className="px-6 py-4 text-right font-mono font-black text-slate-800">{Math.round(row.cantidadP2).toLocaleString()}</td>
                          <td className="px-6 py-4 text-right font-mono font-black text-slate-800">{Math.round(row.cantidadP3).toLocaleString()}</td>
                          <td className={cn(
                            'px-6 py-4 text-right font-mono font-black',
                            seFabrica ? 'text-green-600' : 'text-red-600'
                          )}>
                            {diferencia > 0 ? '+' : ''}{Math.round(diferencia).toLocaleString()}
                          </td>
                          <td className="px-6 py-4 text-center">
                            <Badge className={cn(
                              'font-black text-[9px] px-2 py-0.5 rounded-md border-none',
                              seFabrica ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'
                            )}>
                              {seFabrica ? 'SE PUEDE FABRICAR' : 'NO SE PUEDE FABRICAR'}
                            </Badge>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
              <div className="flex items-center justify-between px-6 py-3 border-t border-slate-200 bg-slate-50/50">
                <div className="text-[9px] font-black uppercase tracking-widest text-slate-400">
                  Página {pageSafe} de {totalPages}
                </div>
                <div className="flex items-center gap-1">
                  <Button variant="outline" size="icon" onClick={() => setPage(1)} disabled={pageSafe === 1} className="h-7 w-7"><ChevronsLeft className="h-3.5 w-3.5" /></Button>
                  <Button variant="outline" size="icon" onClick={() => setPage(p => p - 1)} disabled={pageSafe === 1} className="h-7 w-7"><ChevronLeft className="h-3.5 w-3.5" /></Button>
                  <div className="px-3 text-[10px] font-bold text-gray-700 min-w-[90px] text-center border-x py-1 bg-white rounded">Pág. {pageSafe} de {totalPages}</div>
                  <Button variant="outline" size="icon" onClick={() => setPage(p => p + 1)} disabled={pageSafe === totalPages} className="h-7 w-7"><ChevronRight className="h-3.5 w-3.5" /></Button>
                  <Button variant="outline" size="icon" onClick={() => setPage(totalPages)} disabled={pageSafe === totalPages} className="h-7 w-7"><ChevronsRight className="h-3.5 w-3.5" /></Button>
                </div>
              </div>
            </>
          ) : (
            <div className="py-20 text-center text-slate-400 uppercase font-black tracking-widest text-xs opacity-40">
              Sin datos de P2 o P3 para la fecha seleccionada
            </div>
          )}
        </CardContent>
      </Card>

      {hasFetched && comparacionVisible.length > 0 && (
        <Card className="rounded-[2.5rem] bg-white ring-1 ring-slate-100 overflow-hidden shadow-sm border-none">
          <CardHeader className="bg-slate-50/50 p-8 border-b border-slate-200">
            <div className="flex items-center justify-between flex-wrap gap-6">
              <div>
                <CardTitle className="text-2xl font-black text-slate-900 uppercase">Simulación de Ajuste — Forro P1.5</CardTitle>
                <CardDescription className="text-slate-400 font-bold uppercase text-[10px] tracking-widest mt-1">
                  Recorte sugerido por material (Nivel 1 — Forro) para cerrar el déficit total, por prioridad de Materiales Balanceo. No guarda ningún cambio.
                </CardDescription>
              </div>
              <div className="flex items-center gap-6">
                <div className="text-right">
                  <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Déficit Total</p>
                  <p className="text-lg font-black text-indigo-700 font-mono">{Math.round(simulacionAjuste.deficitTotalInicial).toLocaleString()}</p>
                </div>
                <div className="text-right">
                  <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Cubierto</p>
                  <p className="text-lg font-black text-emerald-600 font-mono">
                    {Math.round(simulacionAjuste.deficitTotalInicial - simulacionAjuste.deficitRestante).toLocaleString()}
                  </p>
                </div>
                <div className="text-right">
                  <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Restante</p>
                  <p className={cn('text-lg font-black font-mono', simulacionAjuste.deficitRestante > 0 ? 'text-red-600' : 'text-emerald-600')}>
                    {Math.round(simulacionAjuste.deficitRestante).toLocaleString()}
                  </p>
                </div>
              </div>
            </div>
          </CardHeader>
          <CardContent className="p-0">
            {simulacionAjuste.deficitTotalInicial === 0 ? (
              <div className="py-16 text-center text-slate-400 uppercase font-black tracking-widest text-xs opacity-40">
                No hay déficit para esta fecha — no se requiere ajuste
              </div>
            ) : simulacionAjuste.filas.length === 0 ? (
              <div className="py-16 text-center text-slate-400 uppercase font-black tracking-widest text-xs opacity-40">
                Ningún material con registro en Materiales Balanceo tiene cantidad de Forro en el plan P1.5 de esta fecha
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-[11px] border-collapse">
                  <thead className="bg-slate-50 text-slate-500 border-b border-slate-200 text-left uppercase tracking-widest font-black">
                    <tr>
                      <th className="px-6 py-4 text-[10px] text-right">Prioridad</th>
                      <th className="px-6 py-4 text-[10px]">CHN (Balanceo)</th>
                      <th className="px-6 py-4 text-[10px]">Material (Forro P1.5)</th>
                      <th className="px-6 py-4 text-[10px]">Nombre Material</th>
                      <th className="px-6 py-4 text-[10px] text-right">Cant. Forro P1.5 Actual</th>
                      <th className="px-6 py-4 text-[10px] text-right">% Mín</th>
                      <th className="px-6 py-4 text-[10px] text-right">% Máx</th>
                      <th className="px-6 py-4 text-[10px] text-right">Recorte Aplicado</th>
                      <th className="px-6 py-4 text-[10px] text-right">Cant. Forro P1.5 Ajustada</th>
                      <th className="px-6 py-4 text-[10px] text-center">Estado</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {simulacionPageRows.map(fila => (
                      <tr key={fila.codigo_material_balanceo} className="hover:bg-slate-50 transition-colors text-[10px]">
                        <td className="px-6 py-4 text-right font-mono font-black text-slate-600">{fila.prioridad}</td>
                        <td className="px-6 py-4 font-mono font-bold text-slate-500">{fila.codigo_material_chn}</td>
                        <td className="px-6 py-4 font-mono font-bold text-indigo-700">{fila.codigo_material}</td>
                        <td className="px-6 py-4 font-bold text-slate-700 uppercase">
                          {materialNombrePorCodigo.get(fila.codigo_material) || '—'}
                        </td>
                        <td className="px-6 py-4 text-right font-mono font-black text-slate-800">{Math.round(fila.cantidadActual).toLocaleString()}</td>
                        <td className="px-6 py-4 text-right font-mono font-bold text-slate-600">{fila.porcMinimo}%</td>
                        <td className="px-6 py-4 text-right font-mono font-bold text-slate-600">{fila.porcMaximo}%</td>
                        <td className="px-6 py-4 text-right font-mono font-black text-amber-600">
                          {fila.recorteAplicado > 0 ? `-${Math.round(fila.recorteAplicado).toLocaleString()}` : '—'}
                        </td>
                        <td className="px-6 py-4 text-right font-mono font-black text-slate-800">{Math.round(fila.cantidadAjustada).toLocaleString()}</td>
                        <td className="px-6 py-4 text-center">
                          <Badge className={cn(
                            'font-black text-[9px] px-2 py-0.5 rounded-md border-none',
                            fila.estado === 'ajustado' ? 'bg-emerald-100 text-emerald-700' :
                            fila.estado === 'al-maximo' ? 'bg-amber-100 text-amber-700' :
                            'bg-slate-100 text-slate-500'
                          )}>
                            {fila.estado === 'ajustado' ? 'AJUSTADO' : fila.estado === 'al-maximo' ? 'AL MÁXIMO' : 'SIN AJUSTE'}
                          </Badge>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </CardContent>
          {simulacionAjuste.filas.length > CAPACIDAD_PAGE_SIZE && (
            <div className="flex items-center justify-between px-6 py-3 border-t border-slate-200 bg-slate-50/50">
              <div className="text-[9px] font-black uppercase tracking-widest text-slate-400">
                Página {simulacionPageSafe} de {simulacionTotalPages}
              </div>
              <div className="flex items-center gap-1">
                <Button variant="outline" size="icon" onClick={() => setSimulacionPage(1)} disabled={simulacionPageSafe === 1} className="h-7 w-7"><ChevronsLeft className="h-3.5 w-3.5" /></Button>
                <Button variant="outline" size="icon" onClick={() => setSimulacionPage(p => p - 1)} disabled={simulacionPageSafe === 1} className="h-7 w-7"><ChevronLeft className="h-3.5 w-3.5" /></Button>
                <div className="px-3 text-[10px] font-bold text-gray-700 min-w-[90px] text-center border-x py-1 bg-white rounded">Pág. {simulacionPageSafe} de {simulacionTotalPages}</div>
                <Button variant="outline" size="icon" onClick={() => setSimulacionPage(p => p + 1)} disabled={simulacionPageSafe === simulacionTotalPages} className="h-7 w-7"><ChevronRight className="h-3.5 w-3.5" /></Button>
                <Button variant="outline" size="icon" onClick={() => setSimulacionPage(simulacionTotalPages)} disabled={simulacionPageSafe === simulacionTotalPages} className="h-7 w-7"><ChevronsRight className="h-3.5 w-3.5" /></Button>
              </div>
            </div>
          )}
        </Card>
      )}

      {hasFetched && simulacionAjuste.filas.some(f => f.recorteAplicado > 0) && (
        <Card className="rounded-[2.5rem] bg-white ring-1 ring-slate-100 overflow-hidden shadow-sm border-none">
          <CardHeader className="bg-slate-50/50 border-b border-slate-200 p-8">
            <CardTitle className="text-lg font-black text-slate-900 uppercase">Aplicar Ajuste</CardTitle>
            <CardDescription className="text-slate-400 font-bold uppercase text-[10px] tracking-widest mt-1">
              Lleva el recorte simulado arriba a los planes reales. Cada acción pide confirmación por separado y no depende de la otra.
            </CardDescription>
          </CardHeader>
          <CardContent className="p-8 flex flex-wrap gap-4">
            <Button
              onClick={() => setConfirmRegenerarP15Open(true)}
              disabled={isRegenerandoP15}
              className="bg-indigo-600 hover:bg-indigo-700 text-white font-black uppercase tracking-widest text-[9px] px-5 py-3 rounded-xl disabled:opacity-40"
            >
              {isRegenerandoP15 ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : 'Regenerar Plan PFM con Ajuste'}
            </Button>

            <Button
              onClick={handleAbrirPreviewAjusteP1}
              disabled={isCalculandoPreviewP1 || isAplicandoP1}
              variant="outline"
              className="border-slate-300 text-slate-700 font-black uppercase tracking-widest text-[9px] px-5 py-3 rounded-xl disabled:opacity-40"
            >
              {isCalculandoPreviewP1 ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : 'Aplicar Ajuste al Plan P1 (Ensamblado)'}
            </Button>
          </CardContent>
        </Card>
      )}

      {hasFetched && comparacionVisible.length > 0 && simulacionAjuste.deficitTotalInicial === 0 && (
        <Card className="rounded-[2.5rem] bg-white ring-1 ring-slate-100 overflow-hidden shadow-sm border-none">
          <CardHeader className="bg-slate-50/50 border-b border-slate-200 p-8">
            <CardTitle className="text-lg font-black text-slate-900 uppercase">Guardar sin Ajuste</CardTitle>
            <CardDescription className="text-slate-400 font-bold uppercase text-[10px] tracking-widest mt-1">
              No hay déficit para esta fecha, pero igual hace falta dejar guardados el PFM y el PFF a partir del plan actual, sin recortar nada.
            </CardDescription>
          </CardHeader>
          <CardContent className="p-8 flex flex-wrap gap-4">
            <Button
              onClick={() => setConfirmPFMSinAjusteOpen(true)}
              disabled={isGuardandoPFMSinAjuste}
              className="bg-indigo-600 hover:bg-indigo-700 text-white font-black uppercase tracking-widest text-[9px] px-5 py-3 rounded-xl disabled:opacity-40"
            >
              {isGuardandoPFMSinAjuste ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : 'Guardar Plan P1.5 sin Ajuste (PFM)'}
            </Button>

            <Button
              onClick={() => setConfirmPFFSinAjusteOpen(true)}
              disabled={isGuardandoPFFSinAjuste}
              variant="outline"
              className="border-slate-300 text-slate-700 font-black uppercase tracking-widest text-[9px] px-5 py-3 rounded-xl disabled:opacity-40"
            >
              {isGuardandoPFFSinAjuste ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : 'Guardar Plan P1 sin Ajuste (PFF)'}
            </Button>
          </CardContent>
        </Card>
      )}

      <AlertDialog open={confirmPFMSinAjusteOpen} onOpenChange={(open) => { if (!open && !isGuardandoPFMSinAjuste) setConfirmPFMSinAjusteOpen(false); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>¿Guardar el plan P1.5 sin ajuste (PFM)?</AlertDialogTitle>
            <AlertDialogDescription asChild>
              <div>
                <p>
                  Esto desactiva (soft delete) el plan P1.5 activo de esta fecha — Forro, Tapa y Acolchado — y crea uno nuevo
                  (PFM) con las mismas cantidades, sin ningún recorte, ya que no hay déficit para esta fecha.
                </p>
                <p className="mt-2 font-bold text-slate-700">
                  Se guardará con fecha Forro: {fechaN1 || '—'} · Tapa/Acolchado/Otros: {fechaN2N3 || '—'}
                </p>
              </div>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isGuardandoPFMSinAjuste}>Cancelar</AlertDialogCancel>
            <AlertDialogAction disabled={isGuardandoPFMSinAjuste} onClick={(e) => { e.preventDefault(); handleGuardarPFMSinAjuste(); }}>
              {isGuardandoPFMSinAjuste ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : 'Guardar PFM'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={confirmPFFSinAjusteOpen} onOpenChange={(open) => { if (!open && !isGuardandoPFFSinAjuste) setConfirmPFFSinAjusteOpen(false); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>¿Guardar el plan P1 sin ajuste (PFF)?</AlertDialogTitle>
            <AlertDialogDescription asChild>
              <div>
                <p>
                  Esto desactiva (soft delete) el plan_grupo P1 activo de esta fecha junto con todo su detalle, y crea uno nuevo
                  (PFF) con las mismas cantidades, sin ningún recorte, ya que no hay déficit para esta fecha. No puede haber dos
                  plan_grupo P1 activos simultáneos para el mismo centro/fecha.
                </p>
                <p className="mt-2 font-bold text-slate-700">
                  Se guardará con la fecha del plan P1: {fechaP1 || '—'}
                </p>
              </div>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isGuardandoPFFSinAjuste}>Cancelar</AlertDialogCancel>
            <AlertDialogAction disabled={isGuardandoPFFSinAjuste} onClick={(e) => { e.preventDefault(); handleGuardarPFFSinAjuste(); }}>
              {isGuardandoPFFSinAjuste ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : 'Guardar PFF'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={confirmRegenerarP15Open} onOpenChange={(open) => { if (!open && !isRegenerandoP15) setConfirmRegenerarP15Open(false); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>¿Regenerar el plan PFM con el ajuste?</AlertDialogTitle>
            <AlertDialogDescription asChild>
              <div>
                <p>
                  Esto desactiva (soft delete) el plan P1.5/PFM activo de esta fecha — Forro, Tapa y Acolchado — y crea uno nuevo
                  (renombrado a PFM) con el Forro recortado según la simulación de arriba, re-explotando Tapa y Acolchado a partir
                  de esas cantidades ya ajustadas. No modifica el plan P2 (Nivel 4 / Lámina).
                </p>
                <p className="mt-2 font-bold text-slate-700">
                  Se guardará con fecha Forro: {fechaN1 || '—'} · Tapa/Acolchado/Otros: {fechaN2N3 || '—'}
                </p>
              </div>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isRegenerandoP15}>Cancelar</AlertDialogCancel>
            <AlertDialogAction disabled={isRegenerandoP15} onClick={(e) => { e.preventDefault(); handleRegenerarPlanP15Ajustado(); }}>
              {isRegenerandoP15 ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : 'Regenerar PFM'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={confirmAplicarP1Open} onOpenChange={(open) => { if (!open && !isAplicandoP1) { setConfirmAplicarP1Open(false); setPreviewAjustePlanP1(null); } }}>
        <AlertDialogContent className="max-w-2xl">
          <AlertDialogHeader>
            <AlertDialogTitle>¿Aplicar el ajuste al plan P1 (Ensamblado)?</AlertDialogTitle>
            <AlertDialogDescription asChild>
              <div>
                <p className="mb-1">
                  Se desactiva el plan_grupo P1 afectado junto con todo su detalle (queda con usuario y fecha de modificación) y
                  se crea un plan_grupo P1 nuevo con las cantidades ya ajustadas, repartiendo el recorte proporcionalmente entre
                  los grupos donde el CHN ya tenía cantidad planificada:
                </p>
                <p className="mb-3 font-bold text-slate-700">
                  Se guardará con la fecha del plan P1: {fechaP1 || '—'}
                </p>
                {previewAjustePlanP1 && previewAjustePlanP1.length > 0 && (
                  <div className="max-h-64 overflow-y-auto border border-slate-200 rounded-lg">
                    <table className="w-full text-[10px] border-collapse">
                      <thead className="bg-slate-50 text-slate-500 uppercase text-[9px] font-black sticky top-0">
                        <tr>
                          <th className="px-3 py-2 text-left">CHN</th>
                          <th className="px-3 py-2 text-left">Nombre</th>
                          <th className="px-3 py-2 text-right">Grupo</th>
                          <th className="px-3 py-2 text-right">Antes</th>
                          <th className="px-3 py-2 text-right">Reducción</th>
                          <th className="px-3 py-2 text-right">Después</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {previewAjustePlanP1.map((f, idx) => (
                          <tr key={idx}>
                            <td className="px-3 py-2 font-mono">{f.codigo_material_chn}</td>
                            <td className="px-3 py-2 uppercase">{f.nombre}</td>
                            <td className="px-3 py-2 text-right font-mono">{f.codigo_grupo}</td>
                            <td className="px-3 py-2 text-right font-mono">{Math.round(f.cantidadOriginal).toLocaleString()}</td>
                            <td className="px-3 py-2 text-right font-mono text-amber-600">-{Math.round(f.reduccion).toLocaleString()}</td>
                            <td className="px-3 py-2 text-right font-mono font-black">{Math.round(f.cantidadNueva).toLocaleString()}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isAplicandoP1} onClick={() => setPreviewAjustePlanP1(null)}>Cancelar</AlertDialogCancel>
            <AlertDialogAction disabled={isAplicandoP1} onClick={(e) => { e.preventDefault(); handleAplicarAjustePlanP1(); }}>
              {isAplicandoP1 ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : 'Aplicar a P1'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
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
  // Proceso activo dentro de CapacidadComparacionPanel (Aplicar Ajuste al Plan P1 / Regenerar
  // Plan P1.5), reportado vía onProcessChange — ese estado vive en el subcomponente, no acá.
  const [subPanelProcess, setSubPanelProcess] = useState<{ label: string; progress: number | null } | null>(null);
  const [grupos, setGrupos] = useState<Grupo[]>([]);
  const [restricciones, setRestricciones] = useState<Restriccion[]>([]);
  const [materialNombrePorCodigo, setMaterialNombrePorCodigo] = useState<Map<string, string>>(new Map());
  const [tiemposProduccion, setTiemposProduccion] = useState<any[]>([]);
  const [ordenesFert, setOrdenesFert] = useState<any[]>([]);
  const [kpiMaestroData, setKpiMaestroData] = useState<any[]>([]);
  const [mantenimientosData, setMantenimientosData] = useState<any[]>([]);
  const [isLoadingMantenimientos, setIsLoadingMantenimientos] = useState(false);
  const [hasFetchedMantenimientos, setHasFetchedMantenimientos] = useState(false);
  const mantenimientosForrosData = useMemo(
    () => mantenimientosData.filter(m => String(m.AREA || '').toUpperCase().trim() === 'FORROS'),
    [mantenimientosData]
  );
  const [ordenesPrevisionalesData, setOrdenesPrevisionalesData] = useState<any[]>([]);
  const [listaMaterialesData, setListaMaterialesData] = useState<any[]>([]);
  const [materialesBalanceoData, setMaterialesBalanceoData] = useState<MaterialesBalanceo[]>([]);
  // Fecha única compartida entre los pasos P1, P1.5, P2 y P3 de la pestaña de Recuperación,
  // seleccionada una sola vez en el card principal de la pestaña.
  const [recuperacionPasoFecha, setRecuperacionPasoFecha] = useState('');
  const [isRecuperacionPasoCalendarOpen, setIsRecuperacionPasoCalendarOpen] = useState(false);
  // Fechas con plan recuperable reportadas por cada paso (P1, P1.5, P2, P3), combinadas
  // para resaltarlas juntas en el único calendario compartido del card principal.
  const [recuperacionPasoFechasPorPaso, setRecuperacionPasoFechasPorPaso] = useState<Record<string, Set<string>>>({});
  const recuperacionPasoFechasConPlan = useMemo(() => {
    const union = new Set<string>();
    Object.values(recuperacionPasoFechasPorPaso).forEach(set => set.forEach(f => union.add(f)));
    return union;
  }, [recuperacionPasoFechasPorPaso]);
  const [isLoadingMaterialesBalanceo, setIsLoadingMaterialesBalanceo] = useState(false);
  const [explodedComponentsData, setExplodedComponentsData] = useState<any[]>([]);
  const [explodedForrosData, setExplodedForrosData] = useState<{ material: string; nombre: string; centro: string; cantidadUnitaria: number; cantidadTotal: number; fertParent: string }[]>([]);
  const [isAchConsolidated, setIsAchConsolidated] = useState(false);
  const [isBordBandAdjustActive, setIsBordBandAdjustActive] = useState(false);
  const [bordBandAcceptedMachines, setBordBandAcceptedMachines] = useState<Set<string>>(new Set());
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
  // "Otras máquinas de interiores (sin grupos de ajuste)": máquinas de un solo puesto por hoja de
  // ruta (no hay con quién redistribuir), que hasta ahora no tenían NINGÚN botón de aceptación —
  // sus órdenes nunca llegaban a Plan Final desde esta pestaña. Mismo patrón simple que Forros
  // Finales (`handleAceptarPlanForros`): se acepta tal cual viene de SAP, respetando solo el candado.
  const [otrosInterioresAceptadoPuestos, setOtrosInterioresAceptadoPuestos] = useState<Set<string>>(new Set());
  const [planFinalOrders, setPlanFinalOrders] = useState<any[]>([]);

  // ─── Aviso de actualización de Plan Final (Opción A + aviso) ───────────────────────────────
  // Los resync automáticos (bloqueos, capacidad, turnos) ya actualizan `planFinalOrders` solos —
  // esto solo AGREGA visibilidad: guarda cuándo cambió de verdad el contenido de cada `_source`
  // (no solo la referencia) y avisa con una notificación, sin pedir confirmación ni bloquear nada.
  const [planFinalUltimaActualizacion, setPlanFinalUltimaActualizacion] = useState<Record<string, number>>({});
  const planFinalOrdersAnteriorRef = useRef<any[]>([]);
  const planFinalPrimeraCargaRef = useRef(true);
  useEffect(() => {
    const anterior = planFinalOrdersAnteriorRef.current;
    planFinalOrdersAnteriorRef.current = planFinalOrders;
    // No avisar en el primer render (aún no hay "antes" con qué comparar) — cada aceptación ya
    // tiene su propia notificación de éxito al presionar "Aceptar Plan".
    if (planFinalPrimeraCargaRef.current) { planFinalPrimeraCargaRef.current = false; return; }

    const mk = (o: any) => `${o['ORDEN'] || o['ORDENPREVISIONAL'] || ''}|${String(o['MATERIAL'] || o['CodMaterial'] || '')}|${String(o['CANTIDAD'] || o['CANTPROGRAMADA'] || '')}`;
    const agruparPorSource = (arr: any[]) => {
      const map = new Map<string, any[]>();
      arr.forEach(o => {
        const src = String(o._source || 'sin-fuente');
        if (!map.has(src)) map.set(src, []);
        map.get(src)!.push(o);
      });
      return map;
    };
    const firmaGrupo = (rows: any[]) => rows.map(mk).sort().join(';');

    const anteriorPorSource = agruparPorSource(anterior);
    const actualPorSource = agruparPorSource(planFinalOrders);
    const cambiados: string[] = [];
    actualPorSource.forEach((rows, source) => {
      // Solo avisa si ESE source ya existía antes con contenido distinto — un source nuevo
      // (recién aceptado) no cuenta como "actualización", ya tiene su propio aviso de aceptación.
      if (!anteriorPorSource.has(source)) return;
      if (firmaGrupo(rows) !== firmaGrupo(anteriorPorSource.get(source)!)) cambiados.push(source);
    });

    if (cambiados.length > 0) {
      const ahora = Date.now();
      setPlanFinalUltimaActualizacion(prev => {
        const next = { ...prev };
        cambiados.forEach(s => { next[s] = ahora; });
        return next;
      });
      addNotification('info', `Plan Final se actualizó solo: ${cambiados.length} puesto${cambiados.length === 1 ? '' : 's'} con cambios (bloqueos, capacidad, turnos, etc.).`);
    }
  }, [planFinalOrders, addNotification]);

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
  
  const [loadedTabs, setLoadedTabs] = useState<Set<string>>(new Set(['ajuste-produccion']));
  const [activeMainTab, setActiveMainTab] = useState('ajuste-produccion');
  const hojaRutaCacheRef = React.useRef<Record<string, string>>({});
  const kpiIndexRef = React.useRef<Record<string, any>>({});
  const tiemposIndexRef = React.useRef<Record<string, any>>({});
  const [dataReady, setDataReady] = useState(false);
  
  const [jornadaDiurnaSel, setJornadaDiurnaSel] = useState("8.75");
  const [jornadaNocturnaSel, setJornadaNocturnaSel] = useState("0");
  // Arranca en "Sin jornada": el fin de semana se habilita a mano en Jornada Global, y recién ahí
  // se pueden marcar puestos de sábado y cargarles Personas Fin de Semana.
  const [jornadaFinSemanaSel, setJornadaFinSemanaSel] = useState("0");
  // Modo "día feriado": cuando la fecha que se está planificando cae en feriado, la jornada diurna
  // se reemplaza por la jornada de feriado (0h = no se trabaja). Se detecta solo con el calendario
  // de feriados de Ecuador (ver `feriadoDeFechaPlan`), pero se activa/desactiva manualmente: hay
  // feriados en los que igual se produce.
  const [esDiaFeriado, setEsDiaFeriado] = useState(false);
  const [jornadaFeriadoSel, setJornadaFeriadoSel] = useState("0");
  const [workstationConfigs, setWorkstationConfigs] = useState<Record<string, WorkstationConfig>>({});
  // Bloquea los controles de Máquinas/Personas/Turnos de todas las tarjetas de Personal & Turnos
  // una vez que el usuario confirma su plan. Se guarda en localStorage junto con la semana (lunes)
  // en que se estableció (ver efecto de hidratación/persistencia más abajo): queda fijo TODA esa
  // semana y se reinicia solo al detectar que ya es una semana distinta.
  const [isPlanPersonalEstablecido, setIsPlanPersonalEstablecido] = useState(false);
  // Igual, pero para la Jornada Global (Diurna/Nocturna/Fin de Semana) — se bloquea por separado.
  const [isJornadaEstablecida, setIsJornadaEstablecida] = useState(false);

  // ─── Persistencia SEMANAL del plan de Personal y Turnos ──────────────────
  // Todo lo de esta pestaña (Jornada Global + configuración por puesto) se define el LUNES y rige
  // toda la semana — incluso si se recarga la página. Un cambio a mitad de semana (ej. ajustar una
  // máquina el miércoles) se guarda y se mantiene el resto de esa semana; recién se reinicia a
  // defaults al detectar que empezó una semana distinta (comparando el lunes de la semana actual,
  // no la fecha exacta de hoy como antes). Se persiste en localStorage, no en el backend.
  const personalTurnosHidratadoRef = React.useRef(false);
  useEffect(() => {
    if (personalTurnosHidratadoRef.current) return;
    personalTurnosHidratadoRef.current = true;
    try {
      const raw = localStorage.getItem(PERSONAL_TURNOS_STORAGE_KEY);
      if (!raw) return;
      const saved = JSON.parse(raw);
      if (saved?.semana !== getLunesDeSemanaActual()) {
        localStorage.removeItem(PERSONAL_TURNOS_STORAGE_KEY);
        return;
      }
      if (saved.jornadaDiurnaSel) setJornadaDiurnaSel(saved.jornadaDiurnaSel);
      if (saved.jornadaNocturnaSel) setJornadaNocturnaSel(saved.jornadaNocturnaSel);
      if (saved.jornadaFinSemanaSel) setJornadaFinSemanaSel(saved.jornadaFinSemanaSel);
      if (typeof saved.esDiaFeriado === 'boolean') setEsDiaFeriado(saved.esDiaFeriado);
      if (saved.jornadaFeriadoSel) setJornadaFeriadoSel(saved.jornadaFeriadoSel);
      if (typeof saved.isJornadaEstablecida === 'boolean') setIsJornadaEstablecida(saved.isJornadaEstablecida);
      if (typeof saved.isPlanPersonalEstablecido === 'boolean') setIsPlanPersonalEstablecido(saved.isPlanPersonalEstablecido);
      if (saved.workstationConfigs) setWorkstationConfigs(saved.workstationConfigs);
    } catch {
      // localStorage no disponible o dato corrupto: se ignora, la pestaña queda con los defaults.
    }
  }, []);

  useEffect(() => {
    try {
      localStorage.setItem(PERSONAL_TURNOS_STORAGE_KEY, JSON.stringify({
        semana: getLunesDeSemanaActual(),
        jornadaDiurnaSel, jornadaNocturnaSel, jornadaFinSemanaSel,
        esDiaFeriado, jornadaFeriadoSel,
        isJornadaEstablecida, isPlanPersonalEstablecido, workstationConfigs,
      }));
    } catch {
      // localStorage no disponible: la sesión sigue funcionando solo en memoria.
    }
  }, [jornadaDiurnaSel, jornadaNocturnaSel, jornadaFinSemanaSel, esDiaFeriado, jornadaFeriadoSel, isJornadaEstablecida, isPlanPersonalEstablecido, workstationConfigs]);

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
  // codigo_plan_grupo -> codigo_grupo (1 = Ensamblado centro 1000, 6 = centro 2000), para el
  // Resumen por Grupo y Línea — el id de plan_grupo no identifica el centro por sí solo.
  const [codigoGrupoPorPlanGrupoP1, setCodigoGrupoPorPlanGrupoP1] = useState<Map<number, number>>(new Map());

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

  // Rama BANDA (paralela a TAPA/ACOLCHADO): Nivel 2 BANDA se deriva de nivel2ExplosionData (ya
  // explotado para TAPA, mismo dato, otro filtro), pero Nivel 3 BANDA EN METROS sí necesita su
  // propia explosión — la profundidad hasta el material que corre en ACOLCHADORA11/12 varía por
  // producto (1 a varios saltos de BOM, confirmado con datos reales), así que no basta un filtro
  // NIVEL===1 fijo como en las demás ramas.
  const [nivel3BandaExplosionData, setNivel3BandaExplosionData] = useState<any[]>([]);
  const [isLoadingNivel3Banda, setIsLoadingNivel3Banda] = useState(false);
  const [hasFetchedNivel3Banda, setHasFetchedNivel3Banda] = useState(false);
  const [nivel3BandaProgress, setNivel3BandaProgress] = useState(0);
  const [materialesBandaSinACH, setMaterialesBandaSinACH] = useState<{ material: string; nombre: string }[]>([]);

  // Cadena automática Nivel 1 → 2 → 3 disparada por un único botón (0 = inactiva, 1/2/3 = esperando a que termine ese nivel)
  const [autoChainStep, setAutoChainStep] = useState<0 | 1 | 2 | 3>(0);

  const [nivel4ExplosionData, setNivel4ExplosionData] = useState<any[]>([]);
  const [isLoadingNivel4, setIsLoadingNivel4] = useState(false);
  const [hasFetchedNivel4, setHasFetchedNivel4] = useState(false);
  const [nivel4Progress, setNivel4Progress] = useState(0);

  // Laminado desde la rama BANDA (misma idea que Nivel 4 desde ACOLCHADO, pero partiendo de
  // Nivel 3 BANDA EN METROS) — botón manual combinado con "Explosionar Componentes" del Nivel 4.
  const [nivel4BandaExplosionData, setNivel4BandaExplosionData] = useState<any[]>([]);
  const [isLoadingNivel4Banda, setIsLoadingNivel4Banda] = useState(false);

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

  // Verificación PREVIA contra la base (no solo el estado de esta sesión) al presionar "Guardar
  // Plan": no puede haber dos plan_grupo activos iguales (mismo grupo + tipo + fecha) para P1.5
  // (N1/N2N3) ni para P2. Si ya existe alguno, se detiene el guardado y se pide confirmar en un
  // solo diálogo antes de desactivar los existentes y crear los nuevos.
  const [confirmGuardarPlanNivel4Open, setConfirmGuardarPlanNivel4Open] = useState(false);
  const [planesExistentesNivel4, setPlanesExistentesNivel4] = useState<{ n1: PlanGrupo[]; n2n3: PlanGrupo[]; p2: PlanGrupo[] } | null>(null);
  const [pendingGuardarNivel4Ctx, setPendingGuardarNivel4Ctx] = useState<{ codigoPlan: number; fechaP2: string; fechaN1: string; fechaN2N3: string } | null>(null);

  const addBusinessDays = useCallback((startDate: Date, days: number): string => {
    const date = new Date(startDate);
    let count = 0;
    while (count < days) {
      date.setDate(date.getDate() + 1);
      const day = date.getDay();
      if (day !== 0 && day !== 6) count++;
    }
    // Fecha LOCAL (no toISOString/UTC): el bucle avanza el día con setDate/getDay en hora local,
    // así que el resultado debe formatearse también en local — convertir a UTC acá podía correr
    // la fecha un día y aterrizar en fin de semana (el mismo tipo de desfase ya visto y corregido
    // en fecha_creacion/fecha_inicio_plan).
    return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
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

  // Horas de mantenimiento preventivo agendadas por hoja de ruta, filtradas a la fecha de
  // planificación mostrada en el encabezado ("Planificación para"). La columna "Puesto de
  // Trabajo" de sp_Get_MantenimientosPreventivosAgendados en realidad trae el código de hoja
  // de ruta (p.ej. "HR-ACH09"), no el nombre descriptivo del puesto, así que el cruce con las
  // tarjetas de Personal & Turnos se hace vía mapToHojaRuta(p) en el render, no por nombre.
  const mantenimientoHorasPorPuesto = useMemo(() => {
    const map: Record<string, number> = {};
    if (!planningDate) return map;
    mantenimientosForrosData.forEach(m => {
      const rawFecha = m.FECHA_OT_PRG_INI || m.FECHA_PRO;
      if (!rawFecha) return;
      const d = new Date(rawFecha);
      const fechaStr = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
      if (fechaStr !== planningDate) return;
      const hrCode = String(m.PuestoTrabajo || '').trim().toUpperCase();
      if (!hrCode) return;
      // Mismo respaldo que la tabla de Mantenimientos Preventivos: SISMAC hoy manda
      // `Duracion_Minutos` vacío en todas las OT, y con `Number('' || 0)` el descuento quedaba
      // siempre en 0 h — o sea, el mantenimiento existía pero no restaba capacidad.
      map[hrCode] = (map[hrCode] || 0) + calcularTiempoMantenimiento(m).minutos / 60;
    });
    return map;
  }, [mantenimientosForrosData, planningDate]);

  const mantenimientoHorasTotal = useMemo(
    () => Object.values(mantenimientoHorasPorPuesto).reduce((sum, h) => sum + h, 0),
    [mantenimientoHorasPorPuesto]
  );


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

  // Carga única del maestro de materiales (código -> descripción), usada para mostrar el
  // nombre del material en las tablas de recuperación de planes (Pasos P1.5 y P3).
  //
  // El maestro tiene ~85.000 materiales: pedirlo completo en una sola llamada (`page=1,
  // rowsPerPage=total`) pesa ~58 MB y tarda ~17 s — cualquier corte de red a mitad de esa descarga
  // (VPN, WiFi, el propio servidor de desarrollo recompilando) tira "Failed to fetch" y obliga a
  // repetir TODO desde cero. Se pagina en bloques de MAESTRO_MATERIALES_PAGE_SIZE, cada uno con su
  // propio reintento (mismo criterio que `explotarMaterialConReintentos`): un fallo puntual solo
  // repite ese bloque, no la carga entera.
  const fetchMaestroMateriales = useCallback(async () => {
    try {
      const totalRes = await maestroMaterialCentroService.getTotalMateriales();
      const total = totalRes?.data?.[0];
      if (!total) return;
      const map = new Map<string, string>();
      const totalPaginas = Math.ceil(total / MAESTRO_MATERIALES_PAGE_SIZE);
      for (let pagina = 1; pagina <= totalPaginas; pagina++) {
        let ultimoError: any = null;
        let ok = false;
        for (let intento = 1; intento <= EXPLOSION_MAX_INTENTOS && !ok; intento++) {
          try {
            const res = await maestroMaterialCentroService.getMaterialesPaginados(pagina, MAESTRO_MATERIALES_PAGE_SIZE);
            (res.data || []).forEach((m: MaestroMaterialCentro) => {
              const key = normalizeMaterialCode(m.MATERIAL);
              if (key && !map.has(key)) map.set(key, (m.DESCRIPCION || '').trim());
            });
            ok = true;
          } catch (error) {
            ultimoError = error;
            if (intento < EXPLOSION_MAX_INTENTOS) await new Promise(r => setTimeout(r, 400 * intento));
          }
        }
        if (!ok) throw ultimoError;
      }
      setMaterialNombrePorCodigo(map);
    } catch (error: any) {
      console.error('Error fetching maestro de materiales:', error);
      addNotification('error', `No se pudo cargar el maestro de materiales tras varios intentos: ${error.message}. Los nombres de material pueden faltar hasta recargar.`);
    }
  }, [normalizeMaterialCode, addNotification]);

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
      // Fecha de HOY en hora de Ecuador. Con `toISOString()` (UTC) el rango arrancaba en el día
      // siguiente para cualquiera que abriera la app desde las 19:00 — justo el turno nocturno.
      if (!techStartDate) setTechStartDate(toFechaEcuador(today));
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

  const fetchMantenimientos = useCallback(async () => {
    setIsLoadingMantenimientos(true);
    setHasFetchedMantenimientos(true);
    try {
      const response = await serviciosService.ListarMantenimientoPreventivosProgramados();
      setMantenimientosData(response.data || []);
    } catch (error: any) {
      console.error('Error fetching Mantenimientos Preventivos:', error);
      addNotification('error', `Error al cargar Mantenimientos Preventivos: ${error.message}`);
      setMantenimientosData([]);
    } finally {
      setIsLoadingMantenimientos(false);
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

  const fetchMaterialesBalanceo = useCallback(async () => {
    setIsLoadingMaterialesBalanceo(true);
    try {
      const response = await materialesBalanceoService.getAll();
      const ordenado = [...(response.data || [])].sort((a, b) => Number(b.prioridad || 0) - Number(a.prioridad || 0));
      setMaterialesBalanceoData(ordenado);
    } catch (error: any) {
      addNotification('error', `Error al cargar Materiales de Balanceo: ${error.message}`);
      setMaterialesBalanceoData([]);
    } finally {
      setIsLoadingMaterialesBalanceo(false);
    }
  }, [addNotification]);

useEffect(() => {
    if (isMounted) {
      fetchBaseData();
      fetchKPIMaestro();
      fetchOrdenesPrevisionales();
      fetchMaestroMateriales();
    }
  }, [isMounted, fetchBaseData, fetchKPIMaestro, fetchOrdenesPrevisionales, fetchMaestroMateriales]);
  
  useEffect(() => {
    if (tiemposProduccion.length > 0 && kpiMaestroData.length > 0 && ordenesPrevisionalesData.length > 0) {
      setDataReady(true);
    }
  }, [tiemposProduccion, kpiMaestroData, ordenesPrevisionalesData]);

  // El nombre debe coincidir EXACTO con "FORROS" — verificado contra los 14 grupos reales de la
  // base: el grupo 20 ("Taller de Corte - Forros Muebles", un departamento de MUEBLES sin ninguna
  // relación con esta pestaña) también contiene la palabra "FORRO" en su nombre, así que el filtro
  // anterior (`.includes('FORRO')`, más las otras palabras sueltas que no matcheaban ningún grupo
  // real) lo arrastraba también — esta pestaña le estaba guardando planes P1.5/PFM/P2 de Forros al
  // taller de corte de Muebles. Solo el grupo 2 (centro 1000) se llama exactamente "Forros".
  const forrosGruposList = useMemo(() => {
    return grupos.filter(g => (g.nombre_grupo || '').trim().toUpperCase() === 'FORROS');
  }, [grupos]);

  // El plan del Paso 3 se guarda contra el grupo "Corte y Laminado" (no Forros): es un
  // departamento distinto que alimenta a Forros, con su propio codigo_grupo por centro.
  const corteLaminadoGruposList = useMemo(() => {
    return grupos.filter(g => (g.nombre_grupo || '').toUpperCase().includes('CORTE Y LAMINADO'));
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
        const mapaGrupoPorPlan = new Map<number, number>();
        (response.data || []).forEach((pg: PlanGrupo) => {
          mapaGrupoPorPlan.set(pg.codigo_plan_grupo, pg.codigo_grupo);
          if (
            codigosGrupo.has(pg.codigo_grupo) &&
            pg.estado === 'A' &&
            pg.fecha_inicio_plan &&
            PLAN_GRUPO_VALOR_REGEX.test(String(pg.valor || ''))
          ) {
            // Fecha LOCAL (no toISOString/UTC) — mismo motivo que en RecuperacionPasoPanel.
            const d = new Date(pg.fecha_inicio_plan);
            fechas.add(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`);
          }
        });
        if (!cancelled) {
          setFechasConPlanRecuperable(fechas);
          setCodigoGrupoPorPlanGrupoP1(mapaGrupoPorPlan);
        }
      } catch (error: any) {
        if (!cancelled) addNotification('error', `Error al consultar planes existentes: ${error.message}`);
      }
    })();
    return () => { cancelled = true; };
  }, [gruposCoincidentes, addNotification]);

  // Fechas de búsqueda para cada paso de "Recuperación Pasos P1-P3". El ancla NO es la fecha
  // seleccionada (que es la fecha objetivo/fecha_inicio_plan del P1, ej. 3/8) sino el día real
  // en que ese P1 fue generado (su fecha_creacion) — P1 es "solo consulta" y su
  // fecha_inicio_plan puede ser muy distinta de cuándo se generó el plan. Por eso primero se
  // busca el/los plan_grupo P1 de la fecha seleccionada para leer su fecha_creacion, y recién
  // desde ahí se aplican los días hábiles de cada restricción (misma lógica que
  // handleGuardarPlanNivel4). Verificado con datos reales: un P1 con fecha_inicio_plan 3/8
  // tenía fecha_creacion 29/7 — el plan se generó 5 días antes de la fecha para la que es.
  const [recuperacionFechasCalculadas, setRecuperacionFechasCalculadas] = useState<{ n1: string; n2n3: string; p2: string; p3: string } | null>(null);
  useEffect(() => {
    if (!recuperacionPasoFecha || gruposCoincidentes.length === 0 || forrosGruposList.length === 0) {
      setRecuperacionFechasCalculadas(null);
      return;
    }
    let cancelled = false;
    (async () => {
      try {
        const codigosGrupoP1 = new Set(gruposCoincidentes.map(g => g.codigo_grupo));
        const response = await planGrupoService.getAll();
        // fecha_inicio_plan no siempre llega en medianoche UTC exacta (se han visto valores como
        // "...T03:00:00.000Z"), así que compararlo con toISOString() (UTC) puede correrse un día
        // respecto a la fecha local (Ecuador, UTC-5) que el usuario realmente seleccionó — mismo
        // tipo de desfase ya conocido en fecha_creacion. Se compara por fecha LOCAL, no UTC.
        const fechaLocal = (fecha: Date | string) => {
          const d = new Date(fecha);
          return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
        };
        const planesP1 = (response.data || []).filter((pg: PlanGrupo) =>
          codigosGrupoP1.has(pg.codigo_grupo) &&
          pg.estado === 'A' &&
          pg.fecha_inicio_plan &&
          PLAN_GRUPO_VALOR_REGEX_P1_O_PFF.test(String(pg.valor || '')) &&
          fechaLocal(pg.fecha_inicio_plan) === recuperacionPasoFecha
        );
        if (planesP1.length === 0 || !planesP1[0].fecha_creacion) {
          if (!cancelled) setRecuperacionFechasCalculadas(null);
          return;
        }

        const generacion = new Date(planesP1[0].fecha_creacion);
        const fechaGeneracion = `${generacion.getFullYear()}-${String(generacion.getMonth() + 1).padStart(2, '0')}-${String(generacion.getDate()).padStart(2, '0')}`;

        const forroGroupCodes = new Set(forrosGruposList.map(g => g.codigo_grupo));
        const buscarRestriccion = (nombre: string) => restricciones.find(r =>
          forroGroupCodes.has(r.codigo_grupo) && r.nombre_restriccion.toUpperCase().trim() === nombre
        );
        const diasFechaN1 = Math.max(1, parseInt(buscarRestriccion('FECHA_N1')?.valor_restriccion || '2', 10) || 2);
        const diasFechaN2N3 = Math.max(1, parseInt(buscarRestriccion('FECHA_N2N3')?.valor_restriccion || '1', 10) || 1);
        const diasFechaP2 = Math.max(1, parseInt(buscarRestriccion('FECHA_P2')?.valor_restriccion || '1', 10) || 1);
        const diasFechaP3 = Math.max(1, parseInt(buscarRestriccion('FECHA_P3')?.valor_restriccion || '1', 10) || 1);
        const maxDias = Math.max(diasFechaN1, diasFechaN2N3, diasFechaP2, diasFechaP3);
        const inicioRango = new Date(fechaGeneracion);
        const finRango = new Date(fechaGeneracion);
        finRango.setUTCDate(finRango.getUTCDate() + maxDias + 14);
        const feriados = await ecuadorHolidaysService.getHolidaysForRange(inicioRango, finRango);
        if (cancelled) return;
        const feriadosSet = new Set(feriados.map(f => f.date));
        setRecuperacionFechasCalculadas({
          n1: sumarDiasHabiles(fechaGeneracion, diasFechaN1, feriadosSet),
          n2n3: sumarDiasHabiles(fechaGeneracion, diasFechaN2N3, feriadosSet),
          p2: sumarDiasHabiles(fechaGeneracion, diasFechaP2, feriadosSet),
          p3: sumarDiasHabiles(fechaGeneracion, diasFechaP3, feriadosSet),
        });
      } catch (error: any) {
        if (!cancelled) {
          setRecuperacionFechasCalculadas(null);
          addNotification('error', `Error al calcular las fechas de recuperación: ${error.message}`);
        }
      }
    })();
    return () => { cancelled = true; };
  }, [recuperacionPasoFecha, gruposCoincidentes, forrosGruposList, restricciones, addNotification]);

  // codigo_plan_grupo -> centro (1000/2000) de los grupos P1 (Ensamblado), para el Resumen
  // por Centro y Línea del plan P1 — mismo criterio que centroPorPlanGrupo en RecuperacionPasoPanel.
  const centroPorPlanGrupoP1 = useMemo(() => {
    const centroPorCodigoGrupo = new Map(gruposCoincidentes.map(g => [g.codigo_grupo, g.centro]));
    const mapa = new Map<number, string>();
    codigoGrupoPorPlanGrupoP1.forEach((codigoGrupo, planGrupo) => {
      const centro = centroPorCodigoGrupo.get(codigoGrupo);
      if (centro) mapa.set(planGrupo, centro);
    });
    return mapa;
  }, [codigoGrupoPorPlanGrupoP1, gruposCoincidentes]);

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

  // Destinatarios del correo de Resumen — restricción "CORREOS_PLAN" (grupo Forros, mismo patrón
  // que COMPONENTES_CAPACIDAD_ENS/DISPONIBILIDAD_*). Se acepta "&" o "," como separador para no
  // depender de un solo formato al crearla en Parámetros → Grupos → Restricciones.
  const correosPlanDestinatarios = useMemo(() => {
    const codigoGrupoForros = forrosGruposList[0]?.codigo_grupo;
    if (codigoGrupoForros === undefined) return [];
    const destinatarios: string[] = [];
    restricciones
      .filter(r => r.codigo_grupo === codigoGrupoForros && r.nombre_restriccion.toUpperCase().trim() === 'CORREOS_PLAN')
      .forEach(r => {
        r.valor_restriccion.split(/[&,]/).forEach(v => {
          const clean = v.trim();
          if (clean && !destinatarios.includes(clean)) destinatarios.push(clean);
        });
      });
    return destinatarios;
  }, [restricciones, forrosGruposList]);

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

  // Explota UN material, reintentando ante fallos transitorios (red/timeout/5xx). Devuelve
  // `ok:false` en vez de lanzar, para que la explosión de un nivel completo nunca se caiga por un
  // solo material: el que falla se reporta por nombre y la cadena sigue con los demás.
  const explotarMaterialConReintentos = useCallback(async (material: string): Promise<{ ok: boolean; components: any[] }> => {
    let ultimoError: any = null;
    for (let intento = 1; intento <= EXPLOSION_MAX_INTENTOS; intento++) {
      try {
        const response = await serviciosService.getMaestroMaterialesExplosion('1000', material, 1, 5000);
        return { ok: true, components: response.data || [] };
      } catch (error: any) {
        ultimoError = error;
        if (intento < EXPLOSION_MAX_INTENTOS) await new Promise(r => setTimeout(r, 400 * intento));
      }
    }
    console.error(`Explosión fallida para ${material} tras ${EXPLOSION_MAX_INTENTOS} intentos:`, ultimoError);
    return { ok: false, components: [] };
  }, []);

  const fetchNivelExplosionComponentes = useCallback(async () => {
    if (fertMaterialesColchones.length === 0) {
      addNotification('warning', 'No hay materiales del Plan Táctico de Grupos para explosionar.');
      return;
    }
    setIsLoadingNivelExplosion(true);
    setHasFetchedNivelExplosion(true);
    setNivelExplosionProgress(0);
    const allComponents: any[] = [];
    const fallidos: string[] = [];
    try {
      for (let i = 0; i < fertMaterialesColchones.length; i++) {
        const { material, cantidadNeta } = fertMaterialesColchones[i];
        setNivelExplosionProgress(Math.round((i / fertMaterialesColchones.length) * 100));
        const { ok, components } = await explotarMaterialConReintentos(material);
        if (!ok) { fallidos.push(material); continue; }
        components.forEach((comp: any) => {
          allComponents.push({ ...comp, fertParent: material, fertCantidadNeta: cantidadNeta });
        });
      }
      if (fallidos.length > 0) {
        addNotification('warning', `Explosión FERT: ${fallidos.length} material(es) no se pudieron explosionar tras ${EXPLOSION_MAX_INTENTOS} intentos y quedaron FUERA del cálculo: ${fallidos.join(', ')}. Los ${fertMaterialesColchones.length - fallidos.length} restantes sí se procesaron.`);
      } else {
        addNotification('success', `Explosión completada para ${fertMaterialesColchones.length} material${fertMaterialesColchones.length === 1 ? '' : 'es'} FERT.`);
      }
    } catch (error: any) {
      addNotification('error', `Error inesperado en la explosión de componentes: ${error.message}`);
    } finally {
      // Se publica SIEMPRE lo acumulado: un fallo parcial no puede borrar lo que sí se explosionó.
      setNivelExplosionData(allComponents);
      setNivelExplosionProgress(100);
      setIsLoadingNivelExplosion(false);
    }
  }, [fertMaterialesColchones, addNotification, explotarMaterialConReintentos]);

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
    const fallidos: string[] = [];
    try {
      for (let i = 0; i < nivel1ForroResumen.length; i++) {
        const { material, cantidadTotal } = nivel1ForroResumen[i];
        setNivel2Progress(Math.round((i / nivel1ForroResumen.length) * 100));
        const { ok, components } = await explotarMaterialConReintentos(material);
        if (!ok) { fallidos.push(material); continue; }
        const parentTipo = baseForroMaterials.has(material) ? 'base' : 'chn';
        components.forEach((comp: any) => {
          allComponents.push({ ...comp, parentMaterial: material, parentCantidadTotal: cantidadTotal, parentTipo });
        });
      }
      if (fallidos.length > 0) {
        addNotification('warning', `Nivel 2 (TAPA): ${fallidos.length} FORRO(s) no se pudieron explosionar tras ${EXPLOSION_MAX_INTENTOS} intentos y sus TAPAS quedaron FUERA: ${fallidos.join(', ')}. Los ${nivel1ForroResumen.length - fallidos.length} restantes sí se procesaron.`);
      } else {
        addNotification('success', `Explosión de Nivel 2 completada para ${nivel1ForroResumen.length} material${nivel1ForroResumen.length === 1 ? '' : 'es'} FORRO.`);
      }
    } catch (error: any) {
      addNotification('error', `Error inesperado en la explosión de Nivel 2: ${error.message}`);
    } finally {
      setNivel2ExplosionData(allComponents);
      setNivel2Progress(100);
      setIsLoadingNivel2(false);
    }
  }, [nivel1ForroResumen, nivel1ForroResumenPorTipo, addNotification, explotarMaterialConReintentos]);

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

  // ─── Rama BANDA — Nivel 2 (bruto) ─────────────────────────────────────────
  // Mismo dato ya explotado para TAPA (nivel2ExplosionData: cada FORRO de Nivel 1 explotado una
  // vez), solo que filtrando por "BANDA" en vez de "TAPA" — confirmado con datos reales que FORRO
  // tiene ambas como hijas directas (a veces se llama "BANDA RMT...", a veces "BANDA CHN...": el
  // nombre exacto no es fijo, solo el hecho de contener "BANDA"). No requiere una explosión nueva.
  const nivel2BandaComponentes = useMemo(() => {
    if (!componentesCapacidadEnsKeywordsNorm.includes('BANDA')) return [];
    return nivel2ExplosionData.filter(comp =>
      Number(comp.NIVEL) === 1 &&
      normalizeText(String(comp.DESCRIPCION_COMPONENTE || comp.NOMBRE_COMPONENTE || '')).includes('BANDA')
    );
  }, [nivel2ExplosionData, componentesCapacidadEnsKeywordsNorm]);

  const nivel2BandaResumen = useMemo(() => {
    const map = new Map<string, { material: string; nombre: string; cantidadTotal: number }>();
    nivel2BandaComponentes.forEach(comp => {
      const material = String(comp.COMPONENTE || '').trim();
      const nombre = String(comp.DESCRIPCION_COMPONENTE || comp.NOMBRE_COMPONENTE || '').trim();
      const cantidadUnitaria = Number(comp.CANTIDAD_UNITARIA || comp.Cantidad || 0);
      const necesidad = cantidadUnitaria * Number(comp.parentCantidadTotal || 0);
      const existing = map.get(material);
      if (existing) existing.cantidadTotal += necesidad;
      else map.set(material, { material, nombre, cantidadTotal: necesidad });
    });
    return Array.from(map.values()).sort((a, b) => b.cantidadTotal - a.cantidadTotal);
  }, [nivel2BandaComponentes]);

  // Mismo resumen del Nivel 2 BANDA, dividido por BANDA de FORRO CHN (colchones) y BANDA de FORRO
  // BASE (bases) — heredando la categoría del FORRO padre, igual que TAPA.
  const nivel2BandaResumenPorTipo = useMemo(() => {
    const baseMap = new Map<string, { material: string; nombre: string; cantidadTotal: number }>();
    const chnMap = new Map<string, { material: string; nombre: string; cantidadTotal: number }>();
    nivel2BandaComponentes.forEach(comp => {
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
  }, [nivel2BandaComponentes]);

  // Identifica si un puesto corresponde a la Acolchadora de Bandas (ACH11/ACH12) — versión local
  // mínima porque `esPuestoBandasAcolchado` (Ajuste de Producción) se declara más abajo en este
  // mismo archivo y no se puede referenciar aquí por orden de declaración (mismo criterio, solo
  // duplicado para poder usarlo en esta explosión, que corre antes en el componente).
  const esPuestoBandaMetrosLocal = useCallback((puesto: string) => {
    const u = puesto.toUpperCase();
    return u.includes('ACOLCHADORA11') || u.includes('ACOLCHADORA12') || ((u.includes('ACH11') || u.includes('ACH12')) && !u.includes('COSEDORA'));
  }, []);

  // ─── Rama BANDA — Nivel 3 (BANDA EN METROS) ───────────────────────────────
  // No es "un salto fijo bajo Nivel 2": la profundidad hasta el componente que corre en
  // ACOLCHADORA11/12 varía por producto (confirmado con datos reales: 1 salto en algunos
  // colchones, 3 en otros). Además, la Banda no siempre es hermana de la Tapa bajo el Forro — en
  // algunos productos de BASE (confirmado con datos reales, ej. material 30010524) la Banda está
  // ANIDADA DENTRO de la Tapa, ocupando el lugar donde normalmente iría el Acolchado (esa Tapa no
  // tiene Acolchado en absoluto). Por eso se buscan DOS orígenes posibles y ambos resultados caen
  // en la MISMA tabla "Nivel 3 BANDA EN METROS", al mismo nivel lógico que ACOLCHADO:
  //  1) Cada material de Nivel 2 BANDA (hermana de Tapa) — siempre debería resolver a un
  //     componente en ACOLCHADORA11/12; si no lo encuentra, se avisa (caso inesperado).
  //  2) Cada material de Nivel 2 TAPA — la mayoría (colchones) trae Acolchado y no Banda ahí
  //     adentro, así que NO encontrar nada es el caso normal y no se avisa.
  // En ambos casos se explota el material UNA vez — la respuesta ya trae todo su árbol restante,
  // con NIVEL relativo a él — y se recorre completo buscando el componente de MENOR nivel cuyo
  // tiempo estándar esté registrado en ACOLCHADORA11/12 (vía tiemposIndexRef, ya cargado).
  const fetchNivel3BandaMetrosComponentes = useCallback(async () => {
    if (nivel2BandaResumen.length === 0 && nivel2TapaResumen.length === 0) {
      setNivel3BandaExplosionData([]);
      setMaterialesBandaSinACH([]);
      setHasFetchedNivel3Banda(true);
      return;
    }
    setIsLoadingNivel3Banda(true);
    setHasFetchedNivel3Banda(true);
    setNivel3BandaProgress(0);
    const baseBandaMaterials = new Set(nivel2BandaResumenPorTipo.base.map(r => r.material));
    const baseTapaMaterials = new Set(nivel2TapaResumenPorTipo.base.map(r => r.material));
    const encontrados: any[] = [];
    const sinACH: { material: string; nombre: string }[] = [];
    const totalPasos = nivel2BandaResumen.length + nivel2TapaResumen.length;

    const buscarEnSubarbol = async (material: string, cantidadTotal: number, parentTipo: 'chn' | 'base'): Promise<boolean> => {
      const response = await serviciosService.getMaestroMaterialesExplosion('1000', material, 1, 5000);
      const components: any[] = response.data || [];
      let mejor: any = null;
      for (const comp of components) {
        const compMat = normalizeMaterialCode(comp.COMPONENTE || '');
        if (!compMat) continue;
        const timesList: any[] = tiemposIndexRef.current[compMat] || [];
        const esACH = timesList.some((t: any) => esPuestoBandaMetrosLocal(String(t.PuestoTrabajo || t.nombre_estacion || t.Maquina || '').trim().toUpperCase()));
        if (!esACH) continue;
        if (!mejor || Number(comp.NIVEL) < Number(mejor.NIVEL)) mejor = comp;
      }
      if (!mejor) return false;
      // CANTIDAD_ACUMULADA ya trae el factor compuesto desde el material de origen hasta este
      // componente (sin importar cuántos saltos tomó) — se usa como si fuera su "cantidad
      // unitaria" para que el resto del cálculo (× parentCantidadTotal) funcione igual que en
      // las demás ramas de un solo salto.
      encontrados.push({
        ...mejor,
        CANTIDAD_UNITARIA: Number(mejor.CANTIDAD_ACUMULADA || mejor.CANTIDAD_UNITARIA || 0),
        parentMaterial: material,
        parentCantidadTotal: cantidadTotal,
        parentTipo,
      });
      return true;
    };

    try {
      // Origen 1: Banda hermana de la Tapa (colchones) — se espera que SIEMPRE resuelva.
      for (let i = 0; i < nivel2BandaResumen.length; i++) {
        const { material, cantidadTotal, nombre: nombreOrigen } = nivel2BandaResumen[i];
        setNivel3BandaProgress(Math.round((i / totalPasos) * 100));
        const parentTipo = baseBandaMaterials.has(material) ? 'base' : 'chn';
        const encontrado = await buscarEnSubarbol(material, cantidadTotal, parentTipo);
        if (!encontrado) sinACH.push({ material, nombre: nombreOrigen });
      }

      // Origen 2: Banda anidada dentro de la Tapa (algunas bases) — no encontrar nada es normal
      // (esa Tapa trae Acolchado en su lugar), así que no se avisa.
      for (let i = 0; i < nivel2TapaResumen.length; i++) {
        const { material, cantidadTotal } = nivel2TapaResumen[i];
        setNivel3BandaProgress(Math.round(((nivel2BandaResumen.length + i) / totalPasos) * 100));
        const parentTipo = baseTapaMaterials.has(material) ? 'base' : 'chn';
        await buscarEnSubarbol(material, cantidadTotal, parentTipo);
      }

      setNivel3BandaExplosionData(encontrados);
      setMaterialesBandaSinACH(sinACH);
      setNivel3BandaProgress(100);
      addNotification('success', `Explosión de Nivel 3 (BANDA EN METROS) completada (${nivel2BandaResumen.length} material${nivel2BandaResumen.length === 1 ? '' : 'es'} BANDA + ${nivel2TapaResumen.length} material${nivel2TapaResumen.length === 1 ? '' : 'es'} TAPA revisado${nivel2TapaResumen.length === 1 ? '' : 's'}).`);
      if (sinACH.length > 0) {
        addNotification('warning', `${sinACH.length} material${sinACH.length === 1 ? '' : 'es'} BANDA sin componente identificado en ACOLCHADORA11/12: ${sinACH.map(s => s.material).join(', ')}.`);
      }
    } catch (error: any) {
      addNotification('error', `Error en la explosión de Nivel 3 (BANDA EN METROS): ${error.message}`);
    } finally {
      setIsLoadingNivel3Banda(false);
    }
  }, [nivel2BandaResumen, nivel2BandaResumenPorTipo, nivel2TapaResumen, nivel2TapaResumenPorTipo, normalizeMaterialCode, esPuestoBandaMetrosLocal, addNotification]);

  const nivel3BandaMetrosResumen = useMemo(() => {
    const map = new Map<string, { material: string; nombre: string; cantidadTotal: number }>();
    nivel3BandaExplosionData.forEach(comp => {
      const material = String(comp.COMPONENTE || '').trim();
      const nombre = String(comp.DESCRIPCION_COMPONENTE || comp.NOMBRE_COMPONENTE || '').trim();
      const cantidadUnitaria = Number(comp.CANTIDAD_UNITARIA || 0);
      const necesidad = cantidadUnitaria * Number(comp.parentCantidadTotal || 0);
      const existing = map.get(material);
      if (existing) existing.cantidadTotal += necesidad;
      else map.set(material, { material, nombre, cantidadTotal: necesidad });
    });
    return Array.from(map.values()).sort((a, b) => b.cantidadTotal - a.cantidadTotal);
  }, [nivel3BandaExplosionData]);

  // Mismo resumen del Nivel 3 BANDA EN METROS, dividido por CHN (colchones) y BASE (bases),
  // heredando la categoría del FORRO/BANDA padre — igual criterio que ACOLCHADO.
  const nivel3BandaMetrosResumenPorTipo = useMemo(() => {
    const baseMap = new Map<string, { material: string; nombre: string; cantidadTotal: number }>();
    const chnMap = new Map<string, { material: string; nombre: string; cantidadTotal: number }>();
    nivel3BandaExplosionData.forEach(comp => {
      const material = String(comp.COMPONENTE || '').trim();
      const nombre = String(comp.DESCRIPCION_COMPONENTE || comp.NOMBRE_COMPONENTE || '').trim();
      const cantidadUnitaria = Number(comp.CANTIDAD_UNITARIA || 0);
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
  }, [nivel3BandaExplosionData]);

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
    const fallidos: string[] = [];
    const tapasSinAcolchado: string[] = [];
    try {
      for (let i = 0; i < nivel2TapaResumen.length; i++) {
        const { material, cantidadTotal } = nivel2TapaResumen[i];
        setNivel3Progress(Math.round((i / nivel2TapaResumen.length) * 100));
        const { ok, components } = await explotarMaterialConReintentos(material);
        if (!ok) { fallidos.push(material); continue; }
        const parentTipo = baseTapaMaterials.has(material) ? 'base' : 'chn';
        components.forEach((comp: any) => {
          allComponents.push({ ...comp, parentMaterial: material, parentCantidadTotal: cantidadTotal, parentTipo });
        });
        // Diagnóstico por tapa: si su BOM no trae un componente ACOLCHADO en Nivel 1, esa tapa no
        // aportará carga de acolchado. Antes esto pasaba en silencio y el panel de Factibilidad
        // simplemente aparecía vacío, sin decir por qué.
        const tieneAcolchado = components.some((comp: any) =>
          Number(comp.NIVEL) === 1 &&
          normalizeText(String(comp.DESCRIPCION_COMPONENTE || comp.NOMBRE_COMPONENTE || '')).includes('ACOLCHADO')
        );
        if (!tieneAcolchado) tapasSinAcolchado.push(material);
      }
      const conAcolchado = nivel2TapaResumen.length - fallidos.length - tapasSinAcolchado.length;
      if (fallidos.length > 0) {
        addNotification('warning', `Nivel 3 (ACOLCHADO): ${fallidos.length} TAPA(s) no se pudieron explosionar tras ${EXPLOSION_MAX_INTENTOS} intentos y su ACOLCHADO quedó FUERA del cálculo: ${fallidos.join(', ')}. Vuelve a explosionar para recuperarlas.`);
      }
      if (conAcolchado === 0) {
        addNotification('warning', `Nivel 3 (ACOLCHADO): ninguna de las ${nivel2TapaResumen.length} TAPA(s) del plan tiene un componente ACOLCHADO en su lista de materiales, por eso la Factibilidad de Acolchado queda vacía.${tapasSinAcolchado.length > 0 ? ` Tapas sin acolchado: ${tapasSinAcolchado.slice(0, 15).join(', ')}${tapasSinAcolchado.length > 15 ? ` y ${tapasSinAcolchado.length - 15} más` : ''}.` : ''}`);
      } else {
        addNotification('success', `Explosión de Nivel 3 completada: ${conAcolchado} de ${nivel2TapaResumen.length} TAPA(s) aportan ACOLCHADO${tapasSinAcolchado.length > 0 ? ` (${tapasSinAcolchado.length} sin acolchado en su BOM)` : ''}.`);
      }
    } catch (error: any) {
      addNotification('error', `Error inesperado en la explosión de Nivel 3: ${error.message}`);
    } finally {
      setNivel3ExplosionData(allComponents);
      setNivel3Progress(100);
      setIsLoadingNivel3(false);
    }
  }, [nivel2TapaResumen, nivel2TapaResumenPorTipo, addNotification, explotarMaterialConReintentos]);

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
      // Rama BANDA corre en paralelo a ACOLCHADO, disparada por el mismo paso — no compite ni
      // depende de ella (hojas de ruta y materiales completamente distintos).
      fetchNivel3BandaMetrosComponentes();
    }
  }, [autoChainStep, hasFetchedNivel2, isLoadingNivel2, fetchNivel3AcolchadoComponentes, fetchNivel3BandaMetrosComponentes]);

  useEffect(() => {
    if (autoChainStep === 3 && hasFetchedNivel3 && !isLoadingNivel3 && hasFetchedNivel3Banda && !isLoadingNivel3Banda) {
      setAutoChainStep(0);
    }
  }, [autoChainStep, hasFetchedNivel3, isLoadingNivel3, hasFetchedNivel3Banda, isLoadingNivel3Banda]);

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

  // Laminado desde la rama BANDA: misma idea que Nivel 4 desde ACOLCHADO, pero partiendo de
  // Nivel 3 BANDA EN METROS — se dispara junto con el botón manual "Explosionar Componentes" del
  // Nivel 4 (ver handleExplosionarNivel4 más abajo), no con la cadena automática 1→2→3.
  const fetchNivel4LaminaDesdeBandaComponentes = useCallback(async () => {
    if (nivel3BandaMetrosResumen.length === 0) {
      setNivel4BandaExplosionData([]);
      return;
    }
    setIsLoadingNivel4Banda(true);
    const allComponents: any[] = [];
    try {
      for (const { material, cantidadTotal } of nivel3BandaMetrosResumen) {
        const response = await serviciosService.getMaestroMaterialesExplosion('1000', material, 1, 5000);
        const components = response.data || [];
        components.forEach((comp: any) => {
          allComponents.push({ ...comp, parentMaterial: material, parentCantidadTotal: cantidadTotal });
        });
      }
      setNivel4BandaExplosionData(allComponents);
      addNotification('success', `Explosión de Nivel 4 (Laminado desde BANDA) completada para ${nivel3BandaMetrosResumen.length} material${nivel3BandaMetrosResumen.length === 1 ? '' : 'es'} BANDA EN METROS.`);
    } catch (error: any) {
      addNotification('error', `Error en la explosión de Nivel 4 desde BANDA EN METROS: ${error.message}`);
    } finally {
      setIsLoadingNivel4Banda(false);
    }
  }, [nivel3BandaMetrosResumen, addNotification]);

  const nivel4LaminaDesdeBandaComponentes = useMemo(() => {
    if (!componentesCapacidadEnsKeywordsNorm.includes('LAMINA')) return [];
    return nivel4BandaExplosionData.filter(comp =>
      Number(comp.NIVEL) === 1 &&
      normalizeText(String(comp.DESCRIPCION_COMPONENTE || comp.NOMBRE_COMPONENTE || '')).includes('LAMINA')
    );
  }, [nivel4BandaExplosionData, componentesCapacidadEnsKeywordsNorm]);

  // Botón único combinado: explosiona el Laminado desde ACOLCHADO y desde BANDA EN METROS a la vez
  // (mismo nivel lógico, mismo paso de UI) — nivel4LaminaResumen (más abajo) ya suma ambas fuentes.
  const handleExplosionarNivel4 = useCallback(() => {
    fetchNivel4LaminaComponentes();
    fetchNivel4LaminaDesdeBandaComponentes();
  }, [fetchNivel4LaminaComponentes, fetchNivel4LaminaDesdeBandaComponentes]);

  // Necesidad de Laminado combinada: suma lo que viene de ACOLCHADO y de BANDA EN METROS —
  // ambas ramas quedan al mismo nivel lógico (Nivel 3 en paralelo) y de ambas se saca la misma
  // necesidad de laminado, así que se combinan en un solo resumen (mismo material puede repetirse
  // en ambas ramas y debe sumarse, no duplicarse como filas separadas).
  const nivel4LaminaResumen = useMemo(() => {
    const map = new Map<string, { material: string; nombre: string; cantidadTotal: number }>();
    [...nivel4LaminaComponentes, ...nivel4LaminaDesdeBandaComponentes].forEach(comp => {
      const material = String(comp.COMPONENTE || '').trim();
      // Rollos cortados que llevan "LAMINA" en el nombre (ej. 30026039/30026042 — Corte de
      // Espuma, no laminado real) coincidían con el filtro de esta explosión y terminaban
      // guardándose como necesidad de P2, aunque ya estaban excluidos de la tabla de
      // comparación P2 vs P3. Se excluyen acá también: este es el único lugar que se guarda.
      if (MATERIALES_ROLLOS_CORTADOS_EXCLUIDOS.has(normalizeMaterialCode(material))) return;
      const nombre = String(comp.DESCRIPCION_COMPONENTE || comp.NOMBRE_COMPONENTE || '').trim();
      const cantidadUnitaria = Number(comp.CANTIDAD_UNITARIA || comp.Cantidad || 0);
      const necesidad = cantidadUnitaria * Number(comp.parentCantidadTotal || 0);
      const existing = map.get(material);
      if (existing) existing.cantidadTotal += necesidad;
      else map.set(material, { material, nombre, cantidadTotal: necesidad });
    });
    return Array.from(map.values()).sort((a, b) => b.cantidadTotal - a.cantidadTotal);
  }, [nivel4LaminaComponentes, nivel4LaminaDesdeBandaComponentes, normalizeMaterialCode]);

  // Listas temporales en memoria con los materiales de las explosiones de Niveles 1, 2 y 3
  // (FORRO + TAPA + ACOLCHADO), acumuladas mientras se corren esas explosiones y consumidas
  // al presionar "Guardar Plan" (Nivel 4) para guardar el plan intermedio P1.5. Se guardan en
  // dos plan_grupo separados (distintivo N1 / N2N3) porque cada uno lleva su propia fecha
  // (restricciones FECHA_N1 y FECHA_N2N3).
  const listaNivel1 = useMemo(() => (
    nivel1ForroResumen.map(row => ({
      codigo_material: Number(row.material),
      cantidad: Math.round(row.cantidadTotal),
    }))
  ), [nivel1ForroResumen]);

  // Incluye también la rama BANDA (Nivel 2 bruto + Nivel 3 en metros) — mismo "N2N3" que
  // Tapa/Acolchado, ya que ambas ramas alimentan igual el plan intermedio P1.5.
  const listaNivel2y3 = useMemo(() => (
    [...nivel2TapaResumen, ...nivel3AcolchadoResumen, ...nivel2BandaResumen, ...nivel3BandaMetrosResumen].map(row => ({
      codigo_material: Number(row.material),
      cantidad: Math.round(row.cantidadTotal),
    }))
  ), [nivel2TapaResumen, nivel3AcolchadoResumen, nivel2BandaResumen, nivel3BandaMetrosResumen]);

  const [isSavingPlanNivel4, setIsSavingPlanNivel4] = useState(false);

  // Inserta los nuevos plan_grupo (P1.5 N1/N2N3 y P2) — antes, si se le pasan planes existentes
  // (detectados por handleGuardarPlanNivel4), los desactiva junto con todo su detalle para no
  // dejar dos plan_grupo activos iguales (mismo grupo + tipo + fecha).
  const ejecutarGuardadoPlanNivel4 = useCallback(async (
    codigoPlan: number,
    fechaP2: string,
    fechaN1: string,
    fechaN2N3: string,
    planesADesactivar: { n1: PlanGrupo[]; n2n3: PlanGrupo[]; p2: PlanGrupo[] }
  ) => {
    const gruposParam = forrosGruposList.map(g => g.codigo_grupo).join('&');

    const desactivarPlanes = async (planes: PlanGrupo[], fecha: string) => {
      if (planes.length === 0) return;
      const resp = await serviciosService.detallePlanTacticoPorGrupos(gruposParam, fecha);
      const ids = new Set(planes.map(p => p.codigo_plan_grupo));
      const detalles = (resp.data || []).filter((item: any) => ids.has(Number(item.codigo_plan_grupo)));
      for (const plan of planes) {
        await planGrupoService.save({ ...plan, estado: 'I' });
      }
      for (const item of detalles) {
        await detalleTacticoService.save({
          codigo_detalle_tactico: item.codigo_detalle_tactico,
          codigo_plan_grupo: item.codigo_plan_grupo,
          codigo_material: Number(item.codigo_material),
          cantidad_produccion_neta: String(item.cantidad_produccion_neta ?? '0'),
          resp_ctrl_prod: item.resp_ctrl_prod || '',
          clase_aprovisionamiento: item.clase_aprovisionamiento || '',
          cantidad_aprovisionamiento: Number(item.cantidad_aprovisionamiento ?? 0),
          linea_produccion: item.linea_produccion || '',
          estado: 'I',
          usuario_modificacion: 'admin',
          fecha_modificacion: new Date(),
        } as DetalleTactico);
      }
    };

    await desactivarPlanes(planesADesactivar.n1, fechaN1);
    await desactivarPlanes(planesADesactivar.n2n3, fechaN2N3);
    await desactivarPlanes(planesADesactivar.p2, fechaP2);

    const planesGuardados: { codigo_plan_grupo: number; nombre_grupo: string }[] = [];
    const detallesGuardados: number[] = [];

    // P1.5 se guarda en dos plan_grupo separados (distintivo N1 / N2N3) porque cada nivel
    // tiene su propia fecha (FECHA_N1 / FECHA_N2N3). El sufijo "P1.5" se conserva para que
    // PLAN_GRUPO_VALOR_REGEX_P1_5 siga matcheando ambos.
    const bloquesP15 = [
      { distintivo: 'N1', fecha: fechaN1, items: listaNivel1 },
      { distintivo: 'N2N3', fecha: fechaN2N3, items: listaNivel2y3 },
    ];

    for (const grupo of forrosGruposList) {
      for (const bloque of bloquesP15) {
        if (bloque.items.length === 0) continue;

        const nuevoPlanGrupoP15: PlanGrupo = {
          codigo_plan_grupo: 0,
          codigo_plan: codigoPlan,
          codigo_grupo: grupo.codigo_grupo,
          codigo_familia_grupo: 0,
          valor: `Plan Táctico - Centro ${grupo.centro} - P1.5 - ${bloque.distintivo}`,
          fecha_inicio_plan: new Date(bloque.fecha),
          fecha_fin_plan: new Date(bloque.fecha),
          estado: 'A',
          fecha_creacion: new Date(),
          usuario_creacion: 'admin',
        };
        const planGrupoP15Guardado = await planGrupoService.save(nuevoPlanGrupoP15);
        const codigoPlanGrupoP15 = planGrupoP15Guardado.data?.codigo_plan_grupo;
        if (!codigoPlanGrupoP15) {
          throw new Error(`No se recibió codigo_plan_grupo al guardar el plan P1.5 (${bloque.distintivo}) del grupo ${grupo.nombre_grupo}.`);
        }
        planesGuardados.push({ codigo_plan_grupo: codigoPlanGrupoP15, nombre_grupo: grupo.nombre_grupo });

        for (const item of bloque.items) {
          const nuevoDetalleP15: DetalleTactico = {
            codigo_detalle_tactico: 0,
            codigo_plan_grupo: codigoPlanGrupoP15,
            codigo_material: item.codigo_material,
            linea_produccion: '',
            cantidad_produccion_neta: String(item.cantidad),
            resp_ctrl_prod: '',
            clase_aprovisionamiento: '',
            cantidad_aprovisionamiento: 0,
            estado: 'A',
            usuario_modificacion: '',
            fecha_modificacion: new Date(),
          };
          const detalleP15Guardado = await detalleTacticoService.save(nuevoDetalleP15);
          if (detalleP15Guardado.data?.codigo_detalle_tactico) {
            detallesGuardados.push(detalleP15Guardado.data.codigo_detalle_tactico);
          }
        }
      }

      const nuevoPlanGrupo: PlanGrupo = {
        codigo_plan_grupo: 0,
        codigo_plan: codigoPlan,
        codigo_grupo: grupo.codigo_grupo,
        codigo_familia_grupo: 0,
        valor: `Plan Táctico - Centro ${grupo.centro} - P2`,
        fecha_inicio_plan: new Date(fechaP2),
        fecha_fin_plan: new Date(fechaP2),
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
          linea_produccion: '',
          cantidad_produccion_neta: String(Math.round(row.cantidadTotal)),
          resp_ctrl_prod: '',
          clase_aprovisionamiento: '',
          cantidad_aprovisionamiento: 0,
          estado: 'A',
          usuario_modificacion: '',
          fecha_modificacion: new Date(),
        };
        const detalleGuardado = await detalleTacticoService.save(nuevoDetalle);
        if (detalleGuardado.data?.codigo_detalle_tactico) {
          detallesGuardados.push(detalleGuardado.data.codigo_detalle_tactico);
        }
      }
    }

    setPlanP2GuardadoInfo({ planes: planesGuardados, detalles: detallesGuardados });
    setPlanP2Guardado(true);
    addNotification('success', 'Se ha guardado el plan del Paso 2.');
  }, [forrosGruposList, listaNivel1, listaNivel2y3, nivel4LaminaResumen, addNotification]);

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

      // FECHA_P2 / FECHA_N1 / FECHA_N2N3: la fecha con la que se guarda cada plan_grupo no
      // es la fecha del P1 (planGrupoFecha, el día de producción objetivo) sino la fecha en
      // que se genera/guarda este plan (hoy) + N días hábiles, saltando fin de semana y
      // feriados (calendario del proyecto vía ecuadorHolidaysService). N sale del valor de
      // la restricción correspondiente sobre el grupo Forros (P1.5 se parte en dos plan_grupo
      // — Nivel 1 y Nivel 2+3 — porque cada uno tiene su propio N y por proceso deben
      // prepararse con anticipación desde el día de generación, no desde la fecha del P1).
      const forroGroupCodes = new Set(forrosGruposList.map(g => g.codigo_grupo));
      const buscarRestriccion = (nombre: string) => restricciones.find(r =>
        forroGroupCodes.has(r.codigo_grupo) && r.nombre_restriccion.toUpperCase().trim() === nombre
      );
      const diasFechaP2 = Math.max(1, parseInt(buscarRestriccion('FECHA_P2')?.valor_restriccion || '1', 10) || 1);
      const diasFechaN1 = Math.max(1, parseInt(buscarRestriccion('FECHA_N1')?.valor_restriccion || '2', 10) || 2);
      const diasFechaN2N3 = Math.max(1, parseInt(buscarRestriccion('FECHA_N2N3')?.valor_restriccion || '1', 10) || 1);
      const maxDias = Math.max(diasFechaP2, diasFechaN1, diasFechaN2N3);
      const hoy = new Date();
      const fechaGeneracion = `${hoy.getFullYear()}-${String(hoy.getMonth() + 1).padStart(2, '0')}-${String(hoy.getDate()).padStart(2, '0')}`;
      const inicioRango = new Date(fechaGeneracion);
      const finRango = new Date(fechaGeneracion);
      finRango.setUTCDate(finRango.getUTCDate() + maxDias + 14);
      const feriados = await ecuadorHolidaysService.getHolidaysForRange(inicioRango, finRango);
      const feriadosSet = new Set(feriados.map(f => f.date));
      const fechaP2 = sumarDiasHabiles(fechaGeneracion, diasFechaP2, feriadosSet);
      const fechaN1 = sumarDiasHabiles(fechaGeneracion, diasFechaN1, feriadosSet);
      const fechaN2N3 = sumarDiasHabiles(fechaGeneracion, diasFechaN2N3, feriadosSet);

      // Verificación PREVIA contra la base: no puede haber dos plan_grupo activos iguales (mismo
      // grupo + tipo + fecha). Si ya existe alguno para P1.5 (N1/N2N3) o P2, se detiene aquí y se
      // pide confirmar (un solo diálogo) antes de desactivar los existentes y crear los nuevos.
      const todosPlanesResp = await planGrupoService.getAll();
      const todosPlanes = todosPlanesResp.data || [];
      // Fecha LOCAL (no toISOString/UTC): fecha_inicio_plan no siempre llega en medianoche UTC
      // exacta, así que compararla en UTC puede correrse un día y dejar pasar un duplicado real.
      const coincideFecha = (pg: PlanGrupo, fecha: string) => {
        if (!pg.fecha_inicio_plan) return false;
        const d = new Date(pg.fecha_inicio_plan);
        return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}` === fecha;
      };

      const existentesN1: PlanGrupo[] = [];
      const existentesN2N3: PlanGrupo[] = [];
      const existentesP2: PlanGrupo[] = [];
      forrosGruposList.forEach(grupo => {
        if (listaNivel1.length > 0) {
          existentesN1.push(...todosPlanes.filter((pg: PlanGrupo) =>
            pg.codigo_grupo === grupo.codigo_grupo && pg.estado === 'A' &&
            PLAN_GRUPO_VALOR_REGEX_P1_5.test(String(pg.valor || '')) && /-\s*N1\s*$/i.test(String(pg.valor || '').trim()) &&
            coincideFecha(pg, fechaN1)
          ));
        }
        if (listaNivel2y3.length > 0) {
          existentesN2N3.push(...todosPlanes.filter((pg: PlanGrupo) =>
            pg.codigo_grupo === grupo.codigo_grupo && pg.estado === 'A' &&
            PLAN_GRUPO_VALOR_REGEX_P1_5.test(String(pg.valor || '')) && /-\s*N2N3\s*$/i.test(String(pg.valor || '').trim()) &&
            coincideFecha(pg, fechaN2N3)
          ));
        }
        existentesP2.push(...todosPlanes.filter((pg: PlanGrupo) =>
          pg.codigo_grupo === grupo.codigo_grupo && pg.estado === 'A' &&
          PLAN_GRUPO_VALOR_REGEX_P2.test(String(pg.valor || '')) &&
          coincideFecha(pg, fechaP2)
        ));
      });

      if (existentesN1.length + existentesN2N3.length + existentesP2.length > 0) {
        setPlanesExistentesNivel4({ n1: existentesN1, n2n3: existentesN2N3, p2: existentesP2 });
        setPendingGuardarNivel4Ctx({ codigoPlan, fechaP2, fechaN1, fechaN2N3 });
        setConfirmGuardarPlanNivel4Open(true);
        return;
      }

      await ejecutarGuardadoPlanNivel4(codigoPlan, fechaP2, fechaN1, fechaN2N3, { n1: [], n2n3: [], p2: [] });
    } catch (error: any) {
      addNotification('error', `Error al guardar el plan: ${error.message}`);
    } finally {
      setIsSavingPlanNivel4(false);
    }
  }, [nivel4LaminaResumen, listaNivel1, listaNivel2y3, planGrupoDetalleFiltrada, planGrupoFecha, forrosGruposList, restricciones, addNotification, ejecutarGuardadoPlanNivel4]);

  const handleConfirmarGuardarPlanNivel4 = useCallback(async () => {
    if (!pendingGuardarNivel4Ctx || !planesExistentesNivel4) return;
    setIsSavingPlanNivel4(true);
    try {
      const { codigoPlan, fechaP2, fechaN1, fechaN2N3 } = pendingGuardarNivel4Ctx;
      await ejecutarGuardadoPlanNivel4(codigoPlan, fechaP2, fechaN1, fechaN2N3, planesExistentesNivel4);
      setConfirmGuardarPlanNivel4Open(false);
      setPlanesExistentesNivel4(null);
      setPendingGuardarNivel4Ctx(null);
    } catch (error: any) {
      addNotification('error', `Error al guardar el plan: ${error.message}`);
    } finally {
      setIsSavingPlanNivel4(false);
    }
  }, [pendingGuardarNivel4Ctx, planesExistentesNivel4, ejecutarGuardadoPlanNivel4, addNotification]);

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

  // `TiemposEnsambladoPorCentroYCodigoGrupo` (filtrado por Centro+CodigoGrupo) devuelve 0
  // registros para el grupo de Forros (verificado directo contra el backend) — esa tabla filtrada
  // por grupo está vacía/rota para ese grupo puntual, aunque el dato SÍ existe: el endpoint
  // global `tiemposEnsamblado` (sin filtro de grupo) trae ACOLCHADORA11/12 y el resto de puestos
  // de Forros con normalidad. El tiempo estándar de un material en un puesto no depende de
  // "grupo" (una categoría de planificación), así que traer todo y filtrar por Centro aquí es
  // más confiable que depender del filtrado roto del backend. Se pagina (misma idea que
  // `fetchMaestroMateriales`) con reintento por página.

  // Mismo problema de saturar la conexión con Promise.all, pero para Versión de Fabricación: pedir la
  // de TODOS los materiales en paralelo de una sola vez saturaba la conexión y algunas peticiones
  // fallaban/expiraban — como se trataban con Promise.allSettled sin reintento, una petición
  // fallida se reportaba igual que "material sin versión", aunque SAP sí la tuviera (verificado
  // con datos reales: los materiales que salían "sin versión" sí tenían versión registrada). Se
  // piden con reintentos, en lotes pequeños en paralelo (no todo de una vez, no uno por uno) para
  // no perder ni la resiliencia ni la velocidad.
  const fetchVersionConReintentos = useCallback(async (material: string, intentos = 3): Promise<any[]> => {
    for (let intento = 1; intento <= intentos; intento++) {
      try {
        const response = await serviciosService.versionsFabricacionPorCentroYCodigoMaterial('1000', material);
        return response.data || [];
      } catch (error) {
        if (intento === intentos) throw error;
        await new Promise(resolve => setTimeout(resolve, 500 * intento));
      }
    }
    return [];
  }, []);

  const fetchVersionesPorMaterial = useCallback(async (materiales: string[]): Promise<Map<string, any[]>> => {
    const resultado = new Map<string, any[]>();
    const CHUNK_SIZE = 5;
    for (let i = 0; i < materiales.length; i += CHUNK_SIZE) {
      const lote = materiales.slice(i, i + CHUNK_SIZE);
      const respuestas = await Promise.allSettled(lote.map(m => fetchVersionConReintentos(m)));
      respuestas.forEach((r, idx) => {
        resultado.set(lote[idx], r.status === 'fulfilled' ? r.value : []);
      });
    }
    return resultado;
  }, [fetchVersionConReintentos]);

  const fetchTiemposProduccion = useCallback(async () => {
    if (forrosGruposList.length === 0) return;
    setIsLoadingTiempos(true);
    try {
      const centrosForros = new Set(forrosGruposList.map(g => String(g.centro || '').trim()));
      const allData: any[] = [];
      let totalRegistros = Infinity;
      let pagina = 1;
      while ((pagina - 1) * TIEMPOS_ENSAMBLADO_PAGE_SIZE < totalRegistros) {
        let ultimoError: any = null;
        let ok = false;
        for (let intento = 1; intento <= EXPLOSION_MAX_INTENTOS && !ok; intento++) {
          try {
            const res = await serviciosService.getTiemposEnsamblado(pagina, TIEMPOS_ENSAMBLADO_PAGE_SIZE);
            totalRegistros = Number(res.totalRegistros || 0);
            (res.data || []).forEach((t: any) => {
              if (centrosForros.has(String(t.Centro || '').trim())) allData.push(t);
            });
            ok = true;
          } catch (error) {
            ultimoError = error;
            if (intento < EXPLOSION_MAX_INTENTOS) await new Promise(r => setTimeout(r, 400 * intento));
          }
        }
        if (!ok) throw ultimoError;
        pagina++;
      }
      setTiemposProduccion(allData);
      if (allData.length === 0) {
        addNotification('warning', 'No se encontraron tiempos estándar para el centro de Forros. Los cálculos de capacidad pueden salir vacíos.');
      }
    } catch (error: any) {
      console.error('Error al cargar tiempos de producción:', error);
      addNotification('error', `No se pudieron cargar los tiempos de producción tras varios intentos: ${error.message}. Los cálculos de capacidad pueden salir incompletos.`);
    } finally {
      setIsLoadingTiempos(false);
      setIsLoading(false);
    }
  }, [forrosGruposList, addNotification]);

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

  // Resumen de dotación por turno para la tarjeta lateral de Personal & Turnos: suma las personas
  // configuradas SOLO en los puestos que realmente tienen ese turno activo (un puesto con 3
  // personas de noche pero el turno nocturno apagado no aporta a la cuenta), y solo sobre los
  // puestos que existen de verdad en los datos y tienen tarjeta visible en esta pestaña.
  const personasPorTurnoResumen = useMemo(() => {
    const puestosVisibles = workstationGroups
      .flatMap(g => g.items)
      .filter(item => uniquePuestos.includes(item));
    let dia = 0, noche = 0, finSemana = 0;
    let puestosDia = 0, puestosNoche = 0, puestosFinSemana = 0;
    puestosVisibles.forEach(p => {
      const cfg = workstationConfigs[p];
      if (!cfg) return;
      if (cfg.isDayActive && (cfg.peopleDay || 0) > 0) { dia += cfg.peopleDay || 0; puestosDia++; }
      if (cfg.isNightActive && (cfg.peopleNight || 0) > 0) { noche += cfg.peopleNight || 0; puestosNoche++; }
      if (cfg.isSaturdayActive && (cfg.peopleWeekend || 0) > 0) { finSemana += cfg.peopleWeekend || 0; puestosFinSemana++; }
    });
    return { dia, noche, finSemana, total: dia + noche + finSemana, puestosDia, puestosNoche, puestosFinSemana };
  }, [uniquePuestos, workstationConfigs]);

  // Resumen de capacitación del día: horas totales perdidas (personas × horas) y en cuántos puestos.
  const capacitacionResumen = useMemo(() => {
    const puestosVisibles = workstationGroups.flatMap(g => g.items).filter(item => uniquePuestos.includes(item));
    let horas = 0, personas = 0, puestos = 0;
    puestosVisibles.forEach(p => {
      const cfg = workstationConfigs[p];
      if (!cfg) return;
      const h = horasCapacitacionPuesto(p, cfg);
      if (h <= 0) return;
      horas += h;
      personas += cfg.capacitacionPersonas || 0;
      puestos++;
    });
    return { horas, personas, puestos };
  }, [uniquePuestos, workstationConfigs]);

  useEffect(() => {
    if (dataReady && uniquePuestos.length > 0) {
      setWorkstationConfigs(prev => {
        if (Object.keys(prev).length > 0) return prev;
        const initial: Record<string, WorkstationConfig> = {};
        uniquePuestos.forEach(p => {
          initial[p] = { machine: p, isDayActive: true, isNightActive: false, isSaturdayActive: false, peopleDay: 0, peopleNight: 0, peopleWeekend: 0, machines: 1 };
        });
        return initial;
      });
    }
  }, [dataReady, uniquePuestos]);

  // Disponibilidad (OEE) por puesto — restricciones "DISPONIBILIDAD_<PUESTO>" del grupo Forros,
  // valor mensual en FRACCIÓN (0-1, ej. "0.85" = 85%). Si un puesto no tiene su restricción
  // creada, no aparece aquí y `capacidadPuesto` usa 100% por defecto (`?? 1`), sin reducir nada.
  const disponibilidadPorPuesto = useMemo(() => {
    const map = new Map<string, number>();
    const codigoGrupoForros = forrosGruposList[0]?.codigo_grupo;
    if (codigoGrupoForros === undefined) return map;
    restricciones
      .filter(r => r.codigo_grupo === codigoGrupoForros && r.nombre_restriccion.toUpperCase().trim().startsWith('DISPONIBILIDAD_'))
      .forEach(r => {
        const puesto = r.nombre_restriccion.trim().toUpperCase().replace('DISPONIBILIDAD_', '');
        const valor = parseFloat(r.valor_restriccion);
        if (puesto && !Number.isNaN(valor)) map.set(puesto, Math.min(1, Math.max(0, valor)));
      });
    return map;
  }, [restricciones, forrosGruposList]);

  // Sincroniza `disponibilidadPorPuesto` DENTRO de `workstationConfigs[puesto].disponibilidad` —
  // mismo patrón que Capacitación: un campo más del config que `capacidadPuesto` ya sabe leer, sin
  // tener que tocar ninguno de los ~16 lugares que llaman a esa función. Nunca lo edita el usuario
  // a mano aquí (solo se crea/edita la restricción en Parámetros → Grupos → Restricciones); este
  // efecto se limita a mantenerlo espejado, incluso si el plan de la semana ya quedó "establecido".
  useEffect(() => {
    setWorkstationConfigs(prev => {
      let cambio = false;
      const next = { ...prev };
      Object.keys(next).forEach(p => {
        const nuevaDisponibilidad = disponibilidadPorPuesto.get(p);
        if (next[p].disponibilidad !== nuevaDisponibilidad) {
          next[p] = { ...next[p], disponibilidad: nuevaDisponibilidad };
          cambio = true;
        }
      });
      return cambio ? next : prev;
    });
  }, [disponibilidadPorPuesto]);

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
            let peopleDayCount = 0;
            let peopleNightCount = 0;

            // Cada restricción se clasifica por SU PROPIO turno (no un flag global) para poder
            // asignar su número al contador de día o de noche que corresponda — antes se mezclaban
            // en un solo `peopleCount` compartido entre ambos turnos.
            relevantRestrictions.forEach(r => {
              const valor = r.valor_restriccion.toUpperCase();
              const esDia = valor.includes('DIURNO') || valor.includes('DÍA') || valor.includes('DIA');
              const esNoche = valor.includes('NOCTURNO') || valor.includes('NOCHE');
              if (esDia) isDay = true;
              if (esNoche) isNight = true;

              const numMatch = valor.match(/\d+/);
              const numero = numMatch ? parseInt(numMatch[0], 10) : (!isNaN(Number(valor)) && Number(valor) > 0 ? Number(valor) : 0);
              if (numero > 0) {
                if (esDia) peopleDayCount = Math.max(peopleDayCount, numero);
                if (esNoche) peopleNightCount = Math.max(peopleNightCount, numero);
                if (!esDia && !esNoche) peopleDayCount = Math.max(peopleDayCount, numero);
              }
            });

            if (!isDay && !isNight && relevantRestrictions.length > 0) isDay = true;
            const current = next[p] || { machine: p, isDayActive: true, isNightActive: false, isSaturdayActive: false, peopleDay: 0, peopleNight: 0, peopleWeekend: 0, machines: 1 };
            if (current.isDayActive !== isDay || current.isNightActive !== isNight || current.peopleDay !== peopleDayCount || current.peopleNight !== peopleNightCount) {
              next[p] = { ...current, isDayActive: isDay, isNightActive: isNight, peopleDay: peopleDayCount, peopleNight: peopleNightCount };
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

  const toggleWorkstationShift = (p: string, shift: 'day' | 'night' | 'saturday') => {
    const field = shift === 'day' ? 'isDayActive' : shift === 'night' ? 'isNightActive' : 'isSaturdayActive';
    setWorkstationConfigs(prev => {
      const current = prev[p] || { machine: p, isDayActive: true, isNightActive: false, isSaturdayActive: false, peopleDay: 0, peopleNight: 0, peopleWeekend: 0, machines: 1 };
      return {
        ...prev,
        [p]: { ...current, [field]: !current[field] }
      };
    });
  };

  const mapToHojaRutaInternal = useCallback((puestoName: string): string => mapToHojaRuta(puestoName), [mapToHojaRuta]);

  // ─── Calendario de feriados (Ecuador) para la fecha que se está planificando ─────────────
  // Mismo servicio que ya usan las fechas P2/P3 (`sumarDiasHabiles`), pero acá para AVISAR en
  // Personal & Turnos: si la fecha del plan cae en feriado — o si hay uno cerca — se muestra el
  // aviso con el nombre del feriado y el botón para activar el modo "Día Feriado".
  const [feriadosPorFecha, setFeriadosPorFecha] = useState<Map<string, string>>(new Map());
  useEffect(() => {
    const anio = techStartDate ? parseInt(techStartDate.slice(0, 4), 10) : new Date().getFullYear();
    if (!anio || isNaN(anio)) return;
    let cancelled = false;
    (async () => {
      try {
        // Año en curso + el siguiente: el calendario del bloque "Día Feriado" se puede navegar a
        // meses posteriores, y sin el año siguiente esos feriados quedarían sin sombrear.
        const [esteAnio, proximoAnio] = await Promise.all([
          ecuadorHolidaysService.getHolidaysForYear(anio),
          ecuadorHolidaysService.getHolidaysForYear(anio + 1).catch(() => []),
        ]);
        if (!cancelled) setFeriadosPorFecha(new Map([...esteAnio, ...proximoAnio].map(f => [f.date, f.name])));
      } catch {
        // Sin calendario de feriados la pestaña sigue funcionando: solo no se muestra el aviso.
      }
    })();
    return () => { cancelled = true; };
  }, [techStartDate]);

  // Feriado que cae EXACTAMENTE en la fecha del plan (si lo hay).
  const feriadoDeFechaPlan = useMemo(() => {
    if (!techStartDate) return null;
    const nombre = feriadosPorFecha.get(techStartDate);
    return nombre ? { fecha: techStartDate, nombre } : null;
  }, [techStartDate, feriadosPorFecha]);

  // Próximo feriado dentro de los siguientes 14 días (aunque no sea la fecha del plan): sirve para
  // avisar con anticipación — ej. planificando un viernes, que el lunes hay feriado.
  const proximoFeriado = useMemo(() => {
    const base = techStartDate || getFechaLocalHoy();
    const limite = new Date(`${base}T00:00:00`);
    limite.setDate(limite.getDate() + 14);
    const limiteIso = `${limite.getFullYear()}-${String(limite.getMonth() + 1).padStart(2, '0')}-${String(limite.getDate()).padStart(2, '0')}`;
    const candidatos = Array.from(feriadosPorFecha.entries())
      .filter(([fecha]) => fecha > base && fecha <= limiteIso)
      .sort(([a], [b]) => a.localeCompare(b));
    if (candidatos.length === 0) return null;
    const [fecha, nombre] = candidatos[0];
    const dias = Math.round((new Date(`${fecha}T00:00:00`).getTime() - new Date(`${base}T00:00:00`).getTime()) / 86400000);
    return { fecha, nombre, dias };
  }, [techStartDate, feriadosPorFecha]);

  const formatFechaLarga = useCallback((iso: string): string => {
    const d = new Date(`${iso}T00:00:00`);
    return d.toLocaleDateString('es-EC', { weekday: 'long', day: 'numeric', month: 'long' });
  }, []);

  // Guarda el rango de fechas previo para poder volver atrás si se desmarca el feriado.
  const [fechaAntesFeriado, setFechaAntesFeriado] = useState<{ inicio: string; fin: string } | null>(null);

  // Fecha elegida a mano en el calendario del bloque "Día Feriado". Manda sobre la detección
  // automática: el usuario puede marcar como no laborable un día que no es feriado nacional
  // (paro, mantenimiento mayor, cierre de planta), o elegir otro feriado distinto al más próximo.
  const [feriadoFechaManual, setFeriadoFechaManual] = useState<string | null>(null);
  const [isFeriadoCalendarOpen, setIsFeriadoCalendarOpen] = useState(false);

  // Fecha en hora de Ecuador (ver `toFechaEcuador`): nunca UTC, o el día se corre.
  const toIsoLocal = useCallback((d: Date): string => toFechaEcuador(d), []);

  // Fecha del feriado que motiva el salto: la elegida a mano si la hay; si no, el que cae en la
  // fecha del plan o, si el plan se arma antes (ej. viernes 7 para el lunes 10), el próximo detectado.
  const feriadoVigente = useMemo(() => {
    if (feriadoFechaManual) {
      return { fecha: feriadoFechaManual, nombre: feriadosPorFecha.get(feriadoFechaManual) || 'Día no laborable (marcado manualmente)' };
    }
    if (feriadoDeFechaPlan) return feriadoDeFechaPlan;
    return proximoFeriado ? { fecha: proximoFeriado.fecha, nombre: proximoFeriado.nombre } : null;
  }, [feriadoFechaManual, feriadosPorFecha, feriadoDeFechaPlan, proximoFeriado]);

  // Mueve la planificación al primer día hábil DESPUÉS del feriado (salta sábados, domingos y
  // otros feriados encadenados). Se ancla en la fecha del FERIADO, no en la fecha actual del plan:
  // planificando el viernes 7 con feriado el lunes 10, la planificación pasa al martes 11.
  // `fechaFeriado` explícita para poder llamarlo justo al elegir un día en el calendario, sin
  // esperar a que el estado se actualice en el siguiente render.
  // `rangoOriginal` explícito: al cambiar de fecha de feriado hay que guardar el rango de ANTES de
  // cualquier salto previo, no el ya desplazado — si no, desmarcar el feriado restauraría una fecha
  // que también era producto de un salto.
  type RangoPlan = { inicio: string; fin: string };
  const moverPlanASiguienteDiaProduccion = useCallback((fechaFeriado?: string, rangoOriginal?: RangoPlan) => {
    const base = fechaFeriado || feriadoVigente?.fecha;
    if (!base) return null;
    if (feriadosPorFecha.size === 0) {
      addNotification('warning', 'Aún no se cargó el calendario de feriados. Intenta de nuevo en unos segundos.');
      return null;
    }
    const siguiente = sumarDiasHabiles(base, 1, new Set(feriadosPorFecha.keys()));
    const original = rangoOriginal ?? { inicio: techStartDate, fin: techEndDate };
    // Sin `rangoOriginal`, `prev ?? ...` conserva el rango de la primera vez que se movió.
    setFechaAntesFeriado(prev => rangoOriginal ?? prev ?? original);
    setTechStartDate(siguiente);
    if (!original.fin || original.fin <= siguiente) setTechEndDate(siguiente);
    addNotification('info', `Feriado ${formatFechaLarga(base)}: la planificación pasa al ${formatFechaLarga(siguiente)}.`);
    return siguiente;
  }, [feriadoVigente, feriadosPorFecha, techStartDate, techEndDate, addNotification, formatFechaLarga]);

  // Caso contrario: sí se trabaja el feriado con jornada reducida — entonces la planificación es
  // la del feriado mismo, no la del día siguiente.
  const moverPlanAlFeriado = useCallback((fechaFeriado?: string, rangoOriginal?: RangoPlan) => {
    const base = fechaFeriado || feriadoVigente?.fecha;
    if (!base) return;
    const original = rangoOriginal ?? { inicio: techStartDate, fin: techEndDate };
    setFechaAntesFeriado(prev => rangoOriginal ?? prev ?? original);
    setTechStartDate(base);
    if (!original.fin || original.fin <= base) setTechEndDate(base);
    addNotification('info', `Se trabaja el feriado ${formatFechaLarga(base)}: la planificación queda en esa fecha con jornada reducida.`);
  }, [feriadoVigente, techStartDate, techEndDate, addNotification, formatFechaLarga]);

  const restaurarFechaAntesFeriado = useCallback(() => {
    if (!fechaAntesFeriado) return;
    setTechStartDate(fechaAntesFeriado.inicio);
    setTechEndDate(fechaAntesFeriado.fin);
    setFechaAntesFeriado(null);
  }, [fechaAntesFeriado]);

  // Marcar feriado con "No se trabaja" NO deja el día en 0 h: salta directo al siguiente día de
  // producción (ej. feriado lunes 10 → el plan pasa al martes 11). Solo si se elige trabajar el
  // feriado con jornada reducida el plan se queda en esa fecha, con esas horas.
  const handleToggleDiaFeriado = useCallback(() => {
    if (esDiaFeriado) {
      setEsDiaFeriado(false);
      setFeriadoFechaManual(null);
      restaurarFechaAntesFeriado();
      return;
    }
    setEsDiaFeriado(true);
    if (jornadaFeriadoSel === '0') moverPlanASiguienteDiaProduccion();
    else moverPlanAlFeriado();
  }, [esDiaFeriado, jornadaFeriadoSel, moverPlanASiguienteDiaProduccion, moverPlanAlFeriado, restaurarFechaAntesFeriado]);

  // Elegir un día en el calendario: queda marcado como feriado/no laborable y se aplica de una vez
  // la regla vigente de la Jornada Feriado (saltar al siguiente día hábil, o quedarse a trabajarlo).
  const handleSeleccionarFechaFeriado = useCallback((fecha: string) => {
    setFeriadoFechaManual(fecha);
    setEsDiaFeriado(true);
    setIsFeriadoCalendarOpen(false);
    // El rango a preservar es el de ANTES de cualquier salto previo: si ya se había movido el plan
    // por otro feriado, elegir otra fecha no debe encadenar saltos sobre una fecha ya desplazada.
    const rangoOriginal = fechaAntesFeriado ?? { inicio: techStartDate, fin: techEndDate };
    if (jornadaFeriadoSel === '0') moverPlanASiguienteDiaProduccion(fecha, rangoOriginal);
    else moverPlanAlFeriado(fecha, rangoOriginal);
  }, [jornadaFeriadoSel, fechaAntesFeriado, techStartDate, techEndDate, moverPlanASiguienteDiaProduccion, moverPlanAlFeriado]);

  // Cambiar la jornada con el modo ya activo también mueve la fecha, según corresponda.
  const handleChangeJornadaFeriado = useCallback((valor: string) => {
    setJornadaFeriadoSel(valor);
    if (!esDiaFeriado) return;
    if (valor === '0') moverPlanASiguienteDiaProduccion();
    else moverPlanAlFeriado();
  }, [esDiaFeriado, moverPlanASiguienteDiaProduccion, moverPlanAlFeriado]);

  const horasNetasFeriadoVal = parseFloat(jornadaFeriadoSel || "0") * 0.84;
  // Solo se aplica la jornada de feriado cuando se decide TRABAJAR el feriado (jornada reducida):
  // ahí reemplaza a la diurna y no hay turno nocturno. Con "No se trabaja" el plan ya saltó al
  // siguiente día de producción, que es un día normal — sus horas son las de la jornada normal.
  const trabajaEnFeriado = esDiaFeriado && jornadaFeriadoSel !== "0";
  const horasNetasDiurnasVal = trabajaEnFeriado ? horasNetasFeriadoVal : parseFloat(jornadaDiurnaSel || "0") * 0.84;
  const horasNetasNocturnasVal = trabajaEnFeriado ? 0 : parseFloat(jornadaNocturnaSel || "0") * 0.84;
  const horasNetasFinSemanaVal = parseFloat(jornadaFinSemanaSel || "0") * 0.84;

  // ── Factibilidad ACOLCHADO (cuello de botella): horas requeridas vs. capacidad disponible por puesto ──
  type CandidatoAcolchado = { puesto: string; tiempoSegPorUnidad: number; capacidad: number; cfg: WorkstationConfig };
  type MaterialAcolchado = { material: string; nombre: string; cantidadTotal: number; qtyChn: number; qtyBase: number; candidatos: CandidatoAcolchado[] };
  // SAP devuelve VERSION a veces como "1" y a veces como "01" (mismo valor, distinto formato) según
  // la hoja de ruta — `numero` es SOLO para comparar cuál es la versión preferida (menor = mejor);
  // `texto` es el string exacto que devolvió SAP, y es el que debe llegar a PROD_VERS en Plan Final
  // (para no perder el cero a la izquierda si el método de carga a SAP lo necesita tal cual).
  type VersionInfo = { numero: number; texto: string };

  // Por material: candidatos reales (puestos con tiempo estándar/KPI registrado) + su capacidad actual.
  // Se conserva el detalle por material (no solo el agregado por puesto) para poder "cuadrar" la producción.
  const acolchadoMateriales = useMemo<MaterialAcolchado[]>(() => {
    if (nivel3AcolchadoResumen.length === 0) return [];

    const getCapacidad = (puesto: string) => {
      const cfg = workstationConfigs[puesto] || { machine: puesto, isDayActive: true, isNightActive: false, isSaturdayActive: false, peopleDay: 0, peopleNight: 0, peopleWeekend: 0, machines: 1 };
      const capacidad = capacidadPuesto(puesto, cfg, horasNetasDiurnasVal, horasNetasNocturnasVal, horasNetasFinSemanaVal);
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
  }, [nivel3AcolchadoResumen, nivel3AcolchadoResumenPorTipo, workstationConfigs, horasNetasDiurnasVal, horasNetasNocturnasVal, horasNetasFinSemanaVal, normalizeMaterialCode]);

  const sinTiempoEstandarAcolchado = useMemo(() => {
    if (nivel3AcolchadoResumen.length === 0) return [];
    const conTiempo = new Set(acolchadoMateriales.map(m => m.material));
    return nivel3AcolchadoResumen.filter(r => !conTiempo.has(r.material)).map(r => ({ material: r.material, nombre: r.nombre }));
  }, [nivel3AcolchadoResumen, acolchadoMateriales]);

  // Versión de Fabricación por material de ACOLCHADO (Centro fijo '1000'): material -> (hoja de ruta sin prefijo "HR-" -> N° de versión).
  // Se consulta versionsFabricacionPorCentroYCodigoMaterial por cada material único de acolchadoMateriales (lista acotada al plan actual).
  const [versionPorMaterialAcolchado, setVersionPorMaterialAcolchado] = useState<Map<string, Map<string, VersionInfo>>>(new Map());
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
        const datosPorMaterial = await fetchVersionesPorMaterial(materiales);
        const resultado = new Map<string, Map<string, VersionInfo>>();
        const sinVersion: string[] = [];
        materiales.forEach(material => {
          const porHoja = new Map<string, VersionInfo>();
          (datosPorMaterial.get(material) || []).forEach((v: any) => {
            const hoja = String(v.GRUPOHOJARUTA || '').trim().toUpperCase().replace(/^HR-/, '');
            // Se conserva el texto EXACTO de SAP (puede venir "1" o "01") para Plan Final/PROD_VERS;
            // `numero` es solo para decidir cuál candidato es la versión preferida (menor = mejor).
            const textoVersion = String(v.VERSION || '').trim();
            const numero = parseInt(textoVersion, 10);
            if (hoja && textoVersion && !isNaN(numero)) porHoja.set(hoja, { numero, texto: textoVersion });
          });
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
  }, [acolchadoMateriales, addNotification, fetchVersionesPorMaterial]);

  // Reparto por defecto: se asigna el 100% del material al candidato con MENOR número de Versión de
  // Fabricación (versión 1 = máquina preferida en SAP). Si el material no tiene versión registrada en
  // ninguna máquina candidata (falla de datos maestros), se usa el tiempo más rápido como respaldo
  // — ya se alertó del caso en el efecto que consulta las versiones.
  // Parametrizado por el mapa de versiones (en vez de cerrar directo sobre versionPorMaterialAcolchado)
  // para poder reutilizar el MISMO criterio de asignación en "Ajuste de Producción → Acolchado & Tapas"
  // (ver repartoAutomaticoAjusteAcolchado más abajo), que consulta Versión de Fabricación para un
  // universo de materiales distinto (el de las órdenes previsionales, no el de la explosión en vivo).
  const repartoAutomaticoConVersion = useCallback((m: MaterialAcolchado, versionPorMaterial: Map<string, Map<string, VersionInfo>>) => {
    const reparto = new Map<string, number>();
    const versionesMaterial = versionPorMaterial.get(m.material);
    const getVersion = (puesto: string): number | undefined => {
      const hoja = mapToHojaRutaInternal(puesto).trim().toUpperCase().replace(/^HR-/, '');
      return versionesMaterial?.get(hoja)?.numero;
    };
    const conVersion = m.candidatos.filter(c => getVersion(c.puesto) !== undefined);
    const elegido = conVersion.length > 0
      ? conVersion.reduce((min, c) => (getVersion(c.puesto)! < getVersion(min.puesto)! ? c : min), conVersion[0])
      : m.candidatos.reduce((min, c) => (c.tiempoSegPorUnidad < min.tiempoSegPorUnidad ? c : min), m.candidatos[0]);
    m.candidatos.forEach(c => reparto.set(c.puesto, c.puesto === elegido.puesto ? m.cantidadTotal : 0));
    return reparto;
  }, [mapToHojaRutaInternal]);

  const repartoAutomatico = useCallback((m: MaterialAcolchado) => (
    repartoAutomaticoConVersion(m, versionPorMaterialAcolchado)
  ), [repartoAutomaticoConVersion, versionPorMaterialAcolchado]);

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

  // Usado por el panel "Resumen Nivel 3/4" (factibilidad de la explosión, no el de "Ajuste de
  // Producción" — ese usa el motor nuevo `asignarOptimoPorVersion`, ver más abajo).
  const cuadrarAcolchado = useCallback((materiales: MaterialAcolchado[], versionPorMaterial: Map<string, Map<string, VersionInfo>>) => {
    if (materiales.length === 0) return null;

    // assign: material -> puesto -> cantidad. Arranca desde el reparto automático (100% a la máquina
    // preferida por Versión de Fabricación) y se va moviendo el excedente hacia máquinas con holgura.
    const assign = new Map<string, Map<string, number>>();
    const tiempoPorMaterialPuesto = new Map<string, Map<string, number>>();
    const capacidadPorPuesto = new Map<string, number>();
    const horasPorPuesto = new Map<string, number>();

    materiales.forEach(m => {
      const auto = repartoAutomaticoConVersion(m, versionPorMaterial);
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
        const materialesEnOrigen = materiales
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
          const versionesDestMaterial = versionPorMaterial.get(material.material);
          const getVersionDestino = (puesto: string): number | undefined => {
            const hoja = mapToHojaRutaInternal(puesto).trim().toUpperCase().replace(/^HR-/, '');
            return versionesDestMaterial?.get(hoja)?.numero;
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
  }, [repartoAutomaticoConVersion, mapToHojaRutaInternal]);

  // ─── Motor único de asignación ÓPTIMA por Versión de Fabricación ─────────
  // Reemplaza, para "Ajuste de Producción" (Acolchado & Tapas, Bandas, RMTB), el viejo esquema de
  // 3 etapas (reparto natural → cuadre fraccionario por material → traducción a órdenes discretas
  // → detección de exceso), que podía quedar inconsistente entre etapas (un puesto mostraba % bajo
  // en el cálculo fraccionario mientras el cálculo discreto por orden igual reportaba "no
  // producible" — la contradicción "máquina al 65% pero no puedo fabricar" que se detectó).
  //
  // Ahora es UNA sola pasada, a nivel de ORDEN (no de material fraccionado), tipo "first-fit
  // decreasing" multi-máquina:
  //  1) Cada orden se ordena de mayor a menor duración (las grandes se acomodan primero).
  //  2) Por cada orden, se recorre la lista de candidatos de SU material (ordenada según `modo`) y
  //     se coloca tanta cantidad como quepa en la capacidad restante de cada candidato, en ese
  //     orden — si no cabe completa, se divide y el remanente sigue probando con el SIGUIENTE
  //     candidato (nunca se abandona mientras quede algún candidato con espacio).
  //  3) Solo si una porción no cupo en NINGÚN candidato (se agotó la lista) se reporta como
  //     "exceso" (no producible) — con el detalle de material/nombre/cantidad exacta.
  // Esto garantiza que nunca se declare "no producible" habiendo capacidad libre en alguna máquina
  // elegible, y que cada máquina quede lo más cerca posible de 100% antes de spillear a la
  // siguiente (el "plan óptimo" pedido), en vez de repartir parejo sin llenar ninguna.
  //
  // `modo`: 'optimo' prioriza la Versión de Fabricación (SAP) como orden de candidatos — llena
  // primero la máquina preferida por SAP. 'equilibrado' prioriza la máquina con MÁS holgura
  // relativa en cada momento — reparte la carga de forma más pareja entre todas las candidatas.
  // Ambos modos son "alternativas" que el usuario puede alternar si el primer resultado no le
  // convence, sin tener que aceptar uno solo fijo.
  type PiezaAsignada = {
    material: string; order: any; puestoNatural: string; puestoFinal: string;
    cantidad: number; isSplit: boolean; originalCantidad: number; originalKey: string;
  };
  type ResultadoAsignacionOptima = {
    piezas: PiezaAsignada[];
    exceso: { material: string; nombre: string; order: any; cantidad: number; puestoNatural: string; originalKey: string }[];
    capacidadPorPuesto: Map<string, number>;
    capacidadRestantePorPuesto: Map<string, number>;
  };

  const asignarOptimoPorVersion = useCallback((
    materiales: MaterialAcolchado[],
    versionPorMaterial: Map<string, Map<string, VersionInfo>>,
    ordenesOrigen: any[],
    modo: 'optimo' | 'equilibrado',
    permitirSplit: boolean = true,
    // Regla de proceso opcional: decide si una pieza puede pasar de `origen` a `destino`. Solo la
    // usa Acolchado (restricción ACH09 → ACH08, por familia en el NOMBRE) y RMTB (bandas atadas a
    // la RMTBM, por CÓDIGO de material). Bandas/Corte la omiten y no cambian.
    puedeMover?: (nombreMaterial: string, origen: string, destino: string, materialCode: string) => boolean,
    // Redondeo opcional del tamaño de un FRAGMENTO al partir una orden. Solo lo usa Acolchado, para
    // cortar en múltiplos enteros de la Tapa que consume ese Acolchado: si se parte en un punto
    // arbitrario (el que llena la última fracción de hora), aguas abajo aparecen fracciones de Tapa,
    // que no existen en planta. Se sacrifica algo de relleno de capacidad a cambio de que la
    // cantidad de Acolchado y la de Tapa coincidan en cada máquina.
    cuantizarFragmento?: (material: string, cantidad: number, order: any) => number,
  ): ResultadoAsignacionOptima => {
    const EPS = 0.001;
    if (materiales.length === 0) return { piezas: [], exceso: [], capacidadPorPuesto: new Map(), capacidadRestantePorPuesto: new Map() };

    const getVersion = (material: string, puesto: string): number | undefined => {
      const hoja = mapToHojaRutaInternal(puesto).trim().toUpperCase().replace(/^HR-/, '');
      return versionPorMaterial.get(material)?.get(hoja)?.numero;
    };

    const capacidadPorPuesto = new Map<string, number>();
    const capacidadRestantePorPuesto = new Map<string, number>();
    materiales.forEach(m => m.candidatos.forEach(c => {
      if (!capacidadPorPuesto.has(c.puesto)) {
        capacidadPorPuesto.set(c.puesto, c.capacidad);
        capacidadRestantePorPuesto.set(c.puesto, c.capacidad);
      }
    }));

    // Orden de candidatos de un material, según el modo — se recalcula en cada uso porque en modo
    // 'equilibrado' depende de la holgura ACTUAL (cambia a medida que se van colocando piezas).
    const candidatosOrdenados = (m: MaterialAcolchado): CandidatoAcolchado[] => {
      const conVersion = m.candidatos.filter(c => getVersion(m.material, c.puesto) !== undefined);
      const base = conVersion.length > 0 ? conVersion : m.candidatos;
      const resto = conVersion.length > 0 ? m.candidatos.filter(c => !base.includes(c)) : [];
      const ordenBase = modo === 'optimo'
        ? [...base].sort((a, b) => {
            const va = getVersion(m.material, a.puesto);
            const vb = getVersion(m.material, b.puesto);
            if (va !== undefined && vb !== undefined && va !== vb) return va - vb;
            return a.tiempoSegPorUnidad - b.tiempoSegPorUnidad;
          })
        : [...base].sort((a, b) => {
            const restA = capacidadRestantePorPuesto.get(a.puesto) ?? a.capacidad;
            const restB = capacidadRestantePorPuesto.get(b.puesto) ?? b.capacidad;
            const utilA = a.capacidad > 0 ? 1 - restA / a.capacidad : 1;
            const utilB = b.capacidad > 0 ? 1 - restB / b.capacidad : 1;
            return utilA - utilB;
          });
      return [...ordenBase, ...resto.sort((a, b) => a.tiempoSegPorUnidad - b.tiempoSegPorUnidad)];
    };

    // El puesto NATURAL de una orden es donde SAP ya la tiene asignada HOY (su propio `MAQUINA`),
    // no el candidato "preferido por Versión" — así una célula que ya le alcanza para lo suyo
    // nunca se toca, sin importar Versión de Fabricación. Solo si no hay match real (defensivo,
    // no debería pasar con datos previsionales normales) se usa el mejor candidato como respaldo.
    const getPuestoNatural = (m: MaterialAcolchado, order: any): CandidatoAcolchado | undefined => {
      const hrOrden = String(order['MAQUINA'] || order['Maquina'] || '').trim().toUpperCase();
      const match = m.candidatos.find(c => mapToHojaRutaInternal(c.puesto).trim().toUpperCase() === hrOrden);
      return match || candidatosOrdenados(m)[0];
    };

    type Chunk = { material: MaterialAcolchado; order: any; cantidad: number; puestoNatural: string };
    const chunks: Chunk[] = [];
    materiales.forEach(m => {
      ordenesOrigen
        .filter(o => normalizeMaterialCode(o['MATERIAL'] || o['CodMaterial'] || '') === m.material)
        .forEach(order => {
          const cantidad = Number(order['CANTIDAD'] || order['CANTPROGRAMADA'] || 0);
          const natural = getPuestoNatural(m, order);
          if (cantidad > 0 && natural) chunks.push({ material: m, order, cantidad, puestoNatural: natural.puesto });
        });
    });

    const piezas: PiezaAsignada[] = [];
    const exceso: { material: string; nombre: string; order: any; cantidad: number; puestoNatural: string; originalKey: string }[] = [];

    // ─── Fase 1: reservar cada máquina para SU PROPIA producción natural ──────────────────
    // Se agrupa por puesto natural y cada grupo se procesa AISLADO — nunca compite por la
    // capacidad de otro puesto. Una máquina que ya le alcanza para lo suyo queda exactamente
    // igual (sin ningún movimiento de entrada ni salida). Lo que no quepa aquí (máquina apagada o
    // genuinamente sobrecargada) pasa a la Fase 2 como excedente.
    const pendientesFase2: { material: MaterialAcolchado; order: any; cantidad: number; puestoNatural: string; originalCantidad: number; originalKey: string }[] = [];
    const chunksPorPuestoNatural = new Map<string, Chunk[]>();
    chunks.forEach(c => {
      if (!chunksPorPuestoNatural.has(c.puestoNatural)) chunksPorPuestoNatural.set(c.puestoNatural, []);
      chunksPorPuestoNatural.get(c.puestoNatural)!.push(c);
    });

    chunksPorPuestoNatural.forEach((grupo, puestoNatural) => {
      const getDuracion = (c: Chunk) => {
        const cand = c.material.candidatos.find(cc => cc.puesto === puestoNatural);
        return cand ? (cand.tiempoSegPorUnidad * c.cantidad) / 3600 : 0;
      };
      [...grupo].sort((a, b) => getDuracion(b) - getDuracion(a)).forEach(({ material: m, order, cantidad: cantidadOriginal }) => {
        const cand = m.candidatos.find(cc => cc.puesto === puestoNatural);
        const originalKey = `${order['ORDEN'] || order['ORDENPREVISIONAL'] || ''}|${String(order['MATERIAL'] || order['CodMaterial'] || '')}|${String(cantidadOriginal)}`;
        if (!cand || cand.tiempoSegPorUnidad <= 0) {
          pendientesFase2.push({ material: m, order, cantidad: cantidadOriginal, puestoNatural, originalCantidad: cantidadOriginal, originalKey });
          return;
        }
        const capRest = capacidadRestantePorPuesto.get(puestoNatural) ?? cand.capacidad;
        const duracionCompleta = (cand.tiempoSegPorUnidad * cantidadOriginal) / 3600;
        const cabeCompleta = duracionCompleta <= capRest + EPS;
        // La Fase 1 no parte: si no cabe entera en su propia máquina, la orden pasa COMPLETA a la
        // Fase 2. Eso NO significa que se deje sin ubicar — la Fase 2 primero busca colocarla
        // entera en otra máquina y, si ninguna puede, la parte para llenar capacidad, incluyendo
        // el hueco que quedó libre aquí. El único cambio respecto de antes es el ORDEN: primero se
        // agota la opción de moverla entera y recién después se parte, en vez de partir de entrada
        // para tapar un hueco (ej. 110 uds de una orden de 762 por 54 min) y recién ahí evaluar.
        const cantidadQueCabe = cabeCompleta ? cantidadOriginal : 0;
        if (cantidadQueCabe > EPS) {
          capacidadRestantePorPuesto.set(puestoNatural, capRest - (cand.tiempoSegPorUnidad * cantidadQueCabe) / 3600);
          piezas.push({
            material: m.material, order, puestoNatural, puestoFinal: puestoNatural,
            cantidad: cantidadQueCabe, isSplit: !cabeCompleta, originalCantidad: cantidadOriginal, originalKey,
          });
        }
        const restante = cantidadOriginal - cantidadQueCabe;
        if (restante > EPS) {
          pendientesFase2.push({ material: m, order, cantidad: restante, puestoNatural, originalCantidad: cantidadOriginal, originalKey });
        }
      });
    });

    // ─── Fase 2: cascada del excedente hacia OTRAS máquinas con espacio libre ─────────────
    // Solo compite por la capacidad que sobró tras la Fase 1 — nunca le quita nada a una máquina
    // que ya reservó lo suyo. Se prueban TODOS los demás candidatos del material (en el orden del
    // modo elegido) antes de declarar exceso — nunca se deja Acolchado sin producir si hay
    // capacidad libre en cualquier otra célula, aunque eso sature a la Cosedora pareja de esa
    // célula (que sí puede quedar en exceso, a diferencia del Acolchado).
    const getDuracionEnPuesto = (m: MaterialAcolchado, puesto: string, cantidad: number) => {
      const c = m.candidatos.find(cc => cc.puesto === puesto);
      return c ? (c.tiempoSegPorUnidad * cantidad) / 3600 : 0;
    };
    [...pendientesFase2]
      .sort((a, b) => getDuracionEnPuesto(b.material, b.puestoNatural, b.cantidad) - getDuracionEnPuesto(a.material, a.puestoNatural, a.cantidad))
      .forEach(({ material: m, order, cantidad: cantidadPendiente, puestoNatural, originalCantidad, originalKey }) => {
        let restante = cantidadPendiente;
        const piezasDeEsteExcedente: PiezaAsignada[] = [];
        // Se descartan de entrada los destinos que la regla de proceso no permite (ej. desde la
        // ACH09 solo ciertas familias pueden pasar, y únicamente a la ACH08). Lo que no puede
        // moverse termina reportado como exceso en su propia máquina, para resolverlo a mano.
        const otrosCandidatos = candidatosOrdenados(m)
          .filter(c => c.puesto !== puestoNatural)
          .filter(c => !puedeMover || puedeMover(m.nombre, puestoNatural, c.puesto, m.material));

        // Si lo pendiente es MENOS que la orden original, ya venía partido de la Fase 1 (una parte
        // se quedó en su máquina natural); esa marca se conserva aunque el resto se coloque entero.
        const vieneDeSplit = cantidadPendiente < originalCantidad - EPS;

        // PRIORIDAD 1: colocar la orden ENTERA en algún candidato. Se recorren en el orden del modo
        // elegido y se toma el primero donde quepa completa. Dividir es el ÚLTIMO recurso: antes se
        // llenaba el primer candidato con espacio y se partía ahí, generando divisiones evitables
        // (y órdenes marcadas como "dividida" que en realidad iban completas).
        const candidatoEntero = otrosCandidatos.find(c => {
          const capRest = capacidadRestantePorPuesto.get(c.puesto) ?? c.capacidad;
          return c.tiempoSegPorUnidad > 0 && capRest > EPS && (c.tiempoSegPorUnidad * restante) / 3600 <= capRest + EPS;
        });

        if (candidatoEntero) {
          const capRest = capacidadRestantePorPuesto.get(candidatoEntero.puesto) ?? candidatoEntero.capacidad;
          capacidadRestantePorPuesto.set(candidatoEntero.puesto, capRest - (candidatoEntero.tiempoSegPorUnidad * restante) / 3600);
          piezasDeEsteExcedente.push({
            material: m.material, order, puestoNatural, puestoFinal: candidatoEntero.puesto,
            cantidad: restante, isSplit: vieneDeSplit, originalCantidad, originalKey,
          });
          restante = 0;
        } else if (permitirSplit) {
          // PRIORIDAD 2 (último recurso): no cabe entera en ninguna, así que SÍ se parte —
          // nada debe quedar sin ubicar si hay capacidad libre en algún lado. Se incluye también
          // la MÁQUINA NATURAL: su hueco sobrante es capacidad válida y es donde la orden ya
          // estaba, así que se usa igual que cualquier otro candidato. El orden lo sigue mandando
          // la Versión de Fabricación (`candidatosOrdenados`), para llenar primero la máquina que
          // SAP prefiere para ese material.
          const candidatosParaPartir = [
            ...otrosCandidatos,
            ...candidatosOrdenados(m).filter(c => c.puesto === puestoNatural),
          ];

          // 1ª pasada: respetando el fragmento mínimo (no crear pedazos que no rinden en planta).
          // 2ª pasada: si aún queda pendiente, se coloca sin ese límite — antes de dejarlo sin
          // ubicar, es preferible un fragmento chico.
          for (const respetarMinimo of [true, false]) {
            for (let i = 0; i < candidatosParaPartir.length && restante > EPS; i++) {
              const cand = candidatosParaPartir[i];
              const capRest = capacidadRestantePorPuesto.get(cand.puesto) ?? cand.capacidad;
              if (capRest <= EPS || cand.tiempoSegPorUnidad <= 0) continue;
              const cabeTodoLoPendiente = (cand.tiempoSegPorUnidad * restante) / 3600 <= capRest + EPS;
              let cantidadAubicar = Math.min(restante, (capRest * 3600) / cand.tiempoSegPorUnidad);
              // Solo se recorta cuando REALMENTE es un pedazo: si acá entra todo lo que queda, va
              // completo tal cual (ese último tramo arrastra el residuo propio de la orden y
              // achicarlo dejaría cantidad sin ubicar sin ninguna ganancia).
              if (!cabeTodoLoPendiente && cuantizarFragmento) {
                cantidadAubicar = cuantizarFragmento(m.material, cantidadAubicar, order);
              }
              if (cantidadAubicar <= EPS) continue;
              const duracionFragmento = (cand.tiempoSegPorUnidad * cantidadAubicar) / 3600;
              const esFragmento = cantidadAubicar < restante - EPS;
              if (respetarMinimo && esFragmento && duracionFragmento < FRAGMENTO_MINIMO_HORAS - EPS) continue;
              capacidadRestantePorPuesto.set(cand.puesto, capRest - (cand.tiempoSegPorUnidad * cantidadAubicar) / 3600);
              piezasDeEsteExcedente.push({
                material: m.material, order, puestoNatural, puestoFinal: cand.puesto,
                cantidad: cantidadAubicar, isSplit: true, originalCantidad, originalKey,
              });
              restante -= cantidadAubicar;
            }
            if (restante <= EPS) break;
          }
        }
        piezas.push(...piezasDeEsteExcedente);
        if (restante > EPS) exceso.push({ material: m.material, nombre: m.nombre, order, cantidad: restante, puestoNatural, originalKey });
      });

    return { piezas, exceso, capacidadPorPuesto, capacidadRestantePorPuesto };
  }, [mapToHojaRutaInternal, normalizeMaterialCode]);

  // A partir del resultado de asignarOptimoPorVersion: arma los mapas por-puesto que consumen
  // MachineCard y los handlers de "Aceptar" — mismo shape que usaban antes (excludeKeys/adjustedIn/
  // splitRemainders), para no tener que tocar el render. Una pieza "no movida" (se queda completa
  // en su máquina natural, sin dividir) no requiere ningún bookkeeping: es idéntica a la orden cruda.
  const derivarMapasDesdeAsignacion = useCallback((resultado: ResultadoAsignacionOptima, getProdVersion: (material: string, puesto: string) => string | undefined) => {
    const excludeKeysPorPuesto = new Map<string, Set<string>>();
    const adjustedInPorPuesto = new Map<string, any[]>();
    const splitRemaindersPorPuesto = new Map<string, any[]>();

    resultado.piezas.forEach(p => {
      const noMovida = !p.isSplit && p.puestoFinal === p.puestoNatural;
      if (noMovida) return;

      if (!excludeKeysPorPuesto.has(p.puestoNatural)) excludeKeysPorPuesto.set(p.puestoNatural, new Set());
      excludeKeysPorPuesto.get(p.puestoNatural)!.add(p.originalKey);

      const piezaComoOrden = {
        ...p.order,
        CANTIDAD: p.cantidad,
        CANTPROGRAMADA: p.cantidad,
        _isSplit: p.isSplit,
        _originalCantidad: p.originalCantidad,
        _originalKey: p.originalKey,
        _prodVersion: getProdVersion(p.material, p.puestoFinal),
        _fromPuesto: p.puestoNatural,
        _toPuesto: p.puestoFinal,
      };

      if (p.puestoFinal === p.puestoNatural) {
        if (!splitRemaindersPorPuesto.has(p.puestoNatural)) splitRemaindersPorPuesto.set(p.puestoNatural, []);
        splitRemaindersPorPuesto.get(p.puestoNatural)!.push(piezaComoOrden);
      } else {
        if (!adjustedInPorPuesto.has(p.puestoFinal)) adjustedInPorPuesto.set(p.puestoFinal, []);
        adjustedInPorPuesto.get(p.puestoFinal)!.push(piezaComoOrden);
      }
    });

    // El exceso (lo que no cupo en NINGÚN candidato) también debe salir de la lista cruda del
    // puesto natural — si no se excluye aquí, la orden sigue contando de lleno en la ocupación
    // de MachineCard (la barra) Y ADEMÁS aparece en el panel rojo de "no producible", inflando
    // el % por encima de 100% (confirmado: son las órdenes que nunca se movieron ni dividieron,
    // así que el bucle de arriba —que solo recorre `piezas`— nunca las tocaba).
    resultado.exceso.forEach(e => {
      if (!excludeKeysPorPuesto.has(e.puestoNatural)) excludeKeysPorPuesto.set(e.puestoNatural, new Set());
      excludeKeysPorPuesto.get(e.puestoNatural)!.add(e.originalKey);
    });

    return { excludeKeysPorPuesto, adjustedInPorPuesto, splitRemaindersPorPuesto };
  }, []);

  const acolchadoCuadreResultado = useMemo(
    () => cuadrarAcolchado(acolchadoMateriales, versionPorMaterialAcolchado),
    [cuadrarAcolchado, acolchadoMateriales, versionPorMaterialAcolchado]
  );

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
    if (!hasFetchedMantenimientos) fetchMantenimientos();
    requestAnimationFrame(() => window.scrollTo({ top: 0, behavior: 'smooth' }));
  }, [loadedTabs, hasFetchedMantenimientos, fetchMantenimientos]);

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

  // Versión normalizada de `acolchadoTapasPorMaterial` (que usa códigos SIN normalizar, tal cual
  // vienen de la explosión de Nivel 3) — para poder cruzarlo con los materiales normalizados de
  // `ajusteAcolchadoMateriales`, las órdenes previsionales reales, y (más abajo) para descontar del
  // Acolchado la porción correspondiente a una Tapa bloqueada manualmente. Se declara aquí (antes de
  // `ajustePrevisionalAcolchadoData`, que ya la necesita) para evitar referenciarla antes de tiempo.
  const acolchadoTapasPorMaterialNorm = useMemo(() => {
    const map = new Map<string, Map<string, number>>();
    acolchadoTapasPorMaterial.forEach((tapas, materialAcolchadoRaw) => {
      const matNorm = normalizeMaterialCode(materialAcolchadoRaw);
      if (!matNorm) return;
      if (!map.has(matNorm)) map.set(matNorm, new Map());
      const inner = map.get(matNorm)!;
      tapas.forEach((cantidadUnitaria, tapaMaterialRaw) => {
        const tapaNorm = normalizeMaterialCode(tapaMaterialRaw);
        if (!tapaNorm) return;
        inner.set(tapaNorm, Math.max(inner.get(tapaNorm) || 0, cantidadUnitaria));
      });
    });
    return map;
  }, [acolchadoTapasPorMaterial, normalizeMaterialCode]);

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
      if (((p.cfg.peopleDay || 0) + (p.cfg.peopleNight || 0)) === 0) {
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

  // ─── AJUSTE DE PRODUCCIÓN → ACOLCHADO & TAPAS ────────────────────────────
  // Mismo criterio de asignación que "Planes Grupo Ensamblado" (Versión de Fabricación + cuadre
  // por utilización entre máquinas candidatas), pero aplicado sobre el TOTAL de las órdenes
  // previsionales de SAP: esas órdenes llegan siempre asignadas por defecto a la máquina de la
  // Versión de Fabricación 1 (el ruteo estándar de SAP), sin considerar el cuadre que ya hicimos
  // en Ensamblado, así que hay que reaplicar la misma lógica sobre el total. A diferencia de
  // Bandas/Interiores/Corte (que redistribuyen por simple balanceo de utilización entre
  // cualquier máquina del grupo), acá el destino de cada orden se decide por Versión de
  // Fabricación, igual que en Ensamblado. El resultado se ve directo en los MachineCard ya
  // existentes (mismo patrón visual que Bandas: adjustedInOrders/excludeOrderKeys/
  // splitRemainderOrders), con un botón "Aceptar Ajuste" propio por célula. Las Tapas NO se
  // recalculan aquí — siguen a su Acolchado gemelo (célula ACH0x/PEF0x) tal como ya funciona hoy.

  // Demanda total previsional por material de ACOLCHADO (SAP), sin importar la máquina que traiga
  // asignada la orden (todas llegan por defecto en la de Versión 1). Se identifica que un material
  // es de Acolchado por tener tiempo estándar registrado en alguna acolchadora real (excluye las
  // COSEDORA-ACH*, que son máquinas de Tapas, no de Acolchado).
  const esPuestoAcolchado = useCallback((puesto: string) => (
    (puesto.includes('ACOLCHADORA') || puesto.includes('ACH')) &&
    !puesto.startsWith('COSEDORA') &&
    !puesto.includes('11') && !puesto.includes('12') // ACH11/ACH12 son de Bandas, no de Acolchado & Tapas
  ), []);

  // Bloqueo manual de órdenes de Acolchado (ej. protectores en HR-ACH07): igual mecánica que el
  // bloqueo de Tapa/Cosedora — la orden sigue visible en la tabla (marcada) pero se excluye del
  // cálculo. A diferencia de Tapa (que solo libera capacidad de OTRA máquina), bloquear una orden
  // de Acolchado quita esa cantidad de la demanda total del material (`ajustePrevisionalAcolchadoData`)
  // y de las órdenes que entran al motor de asignación (`asignarOptimoPorVersion`), para que no
  // termine reasignándose a otra célula — son órdenes opcionales que no se van a fabricar en NINGÚN lado.
  const [acolchadoOrdenesBloqueadasPorPuesto, setAcolchadoOrdenesBloqueadasPorPuesto] = useState<Map<string, Set<string>>>(new Map());
  const handleToggleBloqueoOrdenAcolchado = useCallback((puesto: string, order: any) => {
    const mk = (o: any) => `${o['ORDEN'] || o['ORDENPREVISIONAL'] || ''}|${String(o['MATERIAL'] || o['CodMaterial'] || '')}|${String(o['CANTIDAD'] || o['CANTPROGRAMADA'] || '')}`;
    const key = mk(order);
    setAcolchadoOrdenesBloqueadasPorPuesto(prev => {
      const next = new Map(prev);
      const set = new Set(next.get(puesto) || []);
      if (set.has(key)) set.delete(key); else set.add(key);
      next.set(puesto, set);
      return next;
    });
  }, []);
  const acolchadoBloqueadasKeysGlobal = useMemo(() => {
    const s = new Set<string>();
    acolchadoOrdenesBloqueadasPorPuesto.forEach(set => set.forEach(k => s.add(k)));
    return s;
  }, [acolchadoOrdenesBloqueadasPorPuesto]);

  // Bloqueo manual de órdenes para el RESTO de puestos de Ajuste de Producción (Bandas, Bordadora
  // y Cosedoras de Banda, RMTB, Corte, Bases, Interiores, Tapa Superior CHN y Forros Finales).
  // Acolchado y Tapa conservan sus propios estados porque además alimentan el motor de asignación
  // y el descuento por BOM; acá el bloqueo es lo que se pidió: sacar la orden del cálculo de carga
  // de esa máquina sin perderla de vista (queda tachada y se puede desbloquear).
  const [ordenesBloqueadasPorPuesto, setOrdenesBloqueadasPorPuesto] = useState<Map<string, Set<string>>>(new Map());
  const handleToggleBloqueoOrden = useCallback((puesto: string, order: any) => {
    const mk = (o: any) => `${o['ORDEN'] || o['ORDENPREVISIONAL'] || ''}|${String(o['MATERIAL'] || o['CodMaterial'] || '')}|${String(o['CANTIDAD'] || o['CANTPROGRAMADA'] || '')}`;
    const key = mk(order);
    setOrdenesBloqueadasPorPuesto(prev => {
      const next = new Map(prev);
      const set = new Set(next.get(puesto) || []);
      if (set.has(key)) set.delete(key); else set.add(key);
      next.set(puesto, set);
      return next;
    });
  }, []);

  // Bloqueo manual de órdenes de Tapa/Cosedora — declarado aquí (antes de que
  // `ajustePrevisionalAcolchadoData` lo necesite) para evitar referenciarlo antes de tiempo. El
  // handler (`handleToggleBloqueoOrdenTapa`) y su uso en `MachineCard` están más abajo, junto al
  // resto del código de Tapa/Cosedora.
  const [tapaOrdenesBloqueadasPorPuesto, setTapaOrdenesBloqueadasPorPuesto] = useState<Map<string, Set<string>>>(new Map());

  // ─── Razón Tapa → Acolchado resuelta BAJO DEMANDA desde SAP ────────────────────────────────
  // Ajuste de Producción trabaja con órdenes previsionales de SAP y debe ser autosuficiente: NO
  // puede depender de que el usuario haya corrido antes la explosión de Nivel 3 en la pestaña
  // "Resumen Nivel 3/4" (otro selector de fecha, otro flujo, y ese resultado vive solo en memoria).
  // Por eso, al bloquear una Tapa se explota ESE material contra SAP y se lee su componente
  // ACOLCHADO de Nivel 1 con su CANTIDAD_UNITARIA. Se cachea por material: desbloquear y volver a
  // bloquear no vuelve a consultar.
  const [tapaAcolchadoRatiosSAP, setTapaAcolchadoRatiosSAP] = useState<Map<string, Map<string, number>>>(new Map());
  const [tapasResolviendoRatio, setTapasResolviendoRatio] = useState<Set<string>>(new Set());
  const tapasSinAcolchadoEnBomRef = React.useRef<Set<string>>(new Set());

  const resolverRatioTapaAcolchado = useCallback(async (tapaMaterialRaw: string) => {
    const tapaMat = normalizeMaterialCode(tapaMaterialRaw);
    if (!tapaMat) return;
    // Ya resuelto (con o sin acolchado) o en curso: no se vuelve a consultar.
    if (tapaAcolchadoRatiosSAP.has(tapaMat) || tapasSinAcolchadoEnBomRef.current.has(tapaMat)) return;
    setTapasResolviendoRatio(prev => new Set(prev).add(tapaMat));
    try {
      const { ok, components } = await explotarMaterialConReintentos(tapaMaterialRaw);
      if (!ok) {
        addNotification('warning', `No se pudo consultar la lista de materiales de la Tapa ${tapaMat} en SAP; su Acolchado no se descontó. Vuelve a bloquearla para reintentar.`);
        return;
      }
      const acolchados = new Map<string, number>();
      components.forEach((comp: any) => {
        if (Number(comp.NIVEL) !== 1) return;
        const desc = normalizeText(String(comp.DESCRIPCION_COMPONENTE || comp.NOMBRE_COMPONENTE || ''));
        if (!desc.startsWith('ACOLCHADO')) return;
        const compMat = normalizeMaterialCode(comp.COMPONENTE || '');
        const cantidadUnitaria = Number(comp.CANTIDAD_UNITARIA || comp.Cantidad || 0);
        if (!compMat || cantidadUnitaria <= 0) return;
        acolchados.set(compMat, Math.max(acolchados.get(compMat) || 0, cantidadUnitaria));
      });
      if (acolchados.size === 0) {
        // Caso real y frecuente: hay Tapas cuyo BOM va directo a LÁMINA + TELAS, sin un
        // semielaborado ACOLCHADO. Bloquearlas no descuenta nada, y hay que decirlo.
        tapasSinAcolchadoEnBomRef.current.add(tapaMat);
        addNotification('info', `La Tapa ${tapaMat} no tiene un componente ACOLCHADO en su lista de materiales (va directo a lámina/telas): bloquearla no descuenta Acolchado.`);
        return;
      }
      setTapaAcolchadoRatiosSAP(prev => new Map(prev).set(tapaMat, acolchados));
    } finally {
      setTapasResolviendoRatio(prev => { const next = new Set(prev); next.delete(tapaMat); return next; });
    }
  }, [tapaAcolchadoRatiosSAP, normalizeMaterialCode, explotarMaterialConReintentos, addNotification]);

  // Índice ACOLCHADO → Tapa(s) que lo consumen, combinando las dos fuentes. La cascada de Tapa
  // (mover la Tapa a donde se fue su Acolchado) necesita este sentido, y antes dependía SOLO de la
  // explosión de Nivel 3 de otra pestaña: sin ella no cascadeaba nada, en silencio. Ahora también
  // se alimenta de lo resuelto contra SAP en esta misma pestaña (invirtiendo `tapaAcolchadoRatiosSAP`),
  // así el ajuste es autosuficiente.
  const acolchadoTapasIndexCombinado = useMemo(() => {
    const map = new Map<string, Map<string, number>>();
    acolchadoTapasPorMaterialNorm.forEach((tapas, acolchadoMat) => {
      map.set(acolchadoMat, new Map(tapas));
    });
    tapaAcolchadoRatiosSAP.forEach((acolchados, tapaMat) => {
      acolchados.forEach((cantidadUnitaria, acolchadoMat) => {
        if (!map.has(acolchadoMat)) map.set(acolchadoMat, new Map());
        map.get(acolchadoMat)!.set(tapaMat, cantidadUnitaria);
      });
    });
    return map;
  }, [acolchadoTapasPorMaterialNorm, tapaAcolchadoRatiosSAP]);

  // Índice Tapa → Acolchado(s) usado para descontar. Se combinan dos fuentes: lo resuelto contra
  // SAP bajo demanda (fuente principal, siempre disponible en esta pestaña) y, como respaldo, la
  // explosión de Nivel 3 si el usuario la corrió — así una Tapa ya conocida descuenta al instante,
  // sin esperar la consulta.
  const tapaAcolchadoPorMaterialNorm = useMemo(() => {
    const map = new Map<string, Map<string, number>>();
    acolchadoTapasPorMaterialNorm.forEach((tapas, acolchadoMat) => {
      tapas.forEach((cantidadUnitaria, tapaMat) => {
        if (!map.has(tapaMat)) map.set(tapaMat, new Map());
        map.get(tapaMat)!.set(acolchadoMat, cantidadUnitaria);
      });
    });
    // Lo consultado a SAP manda sobre lo derivado de la explosión (mismo dato, fuente directa).
    tapaAcolchadoRatiosSAP.forEach((acolchados, tapaMat) => {
      const inner = new Map(map.get(tapaMat) || []);
      acolchados.forEach((cantidadUnitaria, acolchadoMat) => inner.set(acolchadoMat, cantidadUnitaria));
      map.set(tapaMat, inner);
    });
    return map;
  }, [acolchadoTapasPorMaterialNorm, tapaAcolchadoRatiosSAP]);

  // Cuánto Acolchado ya no se necesita porque su Tapa fue bloqueada manualmente — si no se va a
  // coser la Tapa, tampoco hace falta el Acolchado que le correspondía (vía BOM). El MATERIAL y la
  // CANTIDAD de la orden bloqueada se leen directo de su propia key (`ORDEN|MATERIAL|CANTIDAD`), sin
  // necesidad de volver a buscarla en `techFilteredOrdenes`.
  const acolchadoDemandaReducidaPorTapaBloqueada = useMemo(() => {
    const reduccion = new Map<string, number>();
    if (tapaAcolchadoPorMaterialNorm.size === 0) return reduccion;
    tapaOrdenesBloqueadasPorPuesto.forEach(keys => {
      keys.forEach(key => {
        const partes = key.split('|');
        const tapaMatRaw = partes[1] || '';
        const cantidad = Number(partes[2] || 0);
        if (!tapaMatRaw || cantidad <= 0) return;
        const tapaMat = normalizeMaterialCode(tapaMatRaw);
        const acolchados = tapaAcolchadoPorMaterialNorm.get(tapaMat);
        if (!acolchados) return;
        acolchados.forEach((cantidadUnitaria, acolchadoMat) => {
          reduccion.set(acolchadoMat, (reduccion.get(acolchadoMat) || 0) + cantidad * cantidadUnitaria);
        });
      });
    });
    return reduccion;
  }, [tapaOrdenesBloqueadasPorPuesto, tapaAcolchadoPorMaterialNorm, normalizeMaterialCode]);

  // Sufijo de célula (02/06/07/...) a partir de un nombre de puesto o de una hoja de ruta. Declarado
  // aquí porque el recorte por célula (más abajo) ya lo necesita; el par Acolchadora/Cosedora es fijo.
  const CELULA_TWIN_SUFIJOS = ['02', '06', '07', '08', '09', '10', '13'];
  const getSuffixCelula = useCallback((puesto: string): string | undefined => {
    const u = puesto.toUpperCase();
    return CELULA_TWIN_SUFIJOS.find(s => u.includes(`ACH${s}`) || u.includes(`ACOLCHADORA${s}`));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Movida aquí (antes vivía junto a `handleToggleBloqueoOrdenTapa`, más abajo) porque
  // `acolchadoTapaDemandaPorCelula` — el objetivo de Acolchado derivado de la Tapa real, ver más
  // abajo — ya la necesita antes de calcular `ajusteAcolchadoMateriales`.
  const getPefDeCelula = useCallback((suffix: string): string | undefined => (
    uniquePuestos.find(p => p.includes(`PEF${suffix}`) || p.includes(`COSEDORA-ACH${suffix}`) || p.includes(`PEGADORA${suffix}`))
  ), [uniquePuestos]);

  // ─── Objetivo de Acolchado DERIVADO de la Tapa real (no de la orden de Acolchado de SAP) ──────
  // Confirmado con el usuario con un caso real: si en la ACH06 hay 100 Tapas (orden real de su
  // Cosedora pareja, siempre entera) que consumen 1.06 de este Acolchado por unidad, la orden de
  // Acolchado en ACH06 DEBE ser 106 — sin importar qué diga la orden de Acolchado de SAP para esa
  // misma máquina (puede traer decimales o no coincidir exacto). Esto es una VERIFICACIÓN/corrección
  // de lo que decide la repartición por capacidad, no la reemplaza: el motor sigue eligiendo en qué
  // célula(s) producir según capacidad y Versión de Fabricación (hasta una 3ª/4ª máquina si hace
  // falta); esto solo garantiza que la CANTIDAD que ve para cada célula ya es un múltiplo exacto de
  // Tapa real. Se aplica por separado a cada célula por si el mismo material tiene Tapas en más de
  // una (ej. 100 en ACH06 + 50 en ACH10, cada una con su propio objetivo).
  // Guarda el detalle POR TAPA (no un solo total sumado): si dos Tapas distintas comparten el mismo
  // Acolchado con ratios DIFERENTES (ej. 1.06 y 0.80), sumarlas en un solo número antes de partir
  // entre máquinas hacía que el corte (`cuantizarAcolchadoATapaEntera`, que asume un único ratio)
  // dejara de coincidir con NINGUNA de las dos Tapas reales — exactamente el "el acolchado no
  // coincide con las tapas" que reportó el usuario desde planta. Manteniendo cada Tapa como su
  // propia fila (más abajo, en `techFilteredOrdenesParaAcolchado`), cada una se corta SIEMPRE con
  // su propio ratio, nunca con el de otra Tapa.
  const acolchadoTapaDemandaPorCelula = useMemo(() => {
    const objetivo = new Map<string, Map<string, { tapaMat: string; ratio: number; cantidad: number }[]>>(); // acolchadoMatNorm -> (suffix -> [{tapa, ratio, cantidad}])
    const mk = (o: any) => `${o['ORDEN'] || o['ORDENPREVISIONAL'] || ''}|${String(o['MATERIAL'] || o['CodMaterial'] || '')}|${String(o['CANTIDAD'] || o['CANTPROGRAMADA'] || '')}`;
    CELULA_TWIN_SUFIJOS.forEach(suffix => {
      const pefPuesto = getPefDeCelula(suffix);
      if (!pefPuesto) return;
      const hr = mapToHojaRutaInternal(pefPuesto).trim().toUpperCase();
      const bloqueadas = tapaOrdenesBloqueadasPorPuesto.get(pefPuesto) || new Set<string>();
      // Dos cosas distintas: qué Tapas EXISTEN en esta célula (para saber que sí hay una relación
      // real que corregir) y cuánta cantidad EFECTIVA queda de cada una tras el candado. Antes se
      // filtraban las bloqueadas ANTES de registrar el material — si una Tapa quedaba 100%
      // bloqueada, desaparecía del todo de este mapa, el objetivo nunca se generaba para ella, y
      // `techFilteredOrdenesParaAcolchado` caía de vuelta a la orden CRUDA de SAP (sin ningún
      // descuento) en vez de a 0 — la orden de Acolchado dejaba de ser exacta justo después de
      // bloquear. Ahora toda Tapa presente se registra siempre, con cantidad EFECTIVA 0 si está
      // 100% bloqueada, para que sí se aplique la corrección (a 0, no al total original).
      const tapaMaterialesPresentes = new Set<string>();
      const tapaQtyPorMaterial = new Map<string, number>();
      techFilteredOrdenes.forEach(o => {
        if (String(o['MAQUINA'] || o['Maquina'] || '').trim().toUpperCase() !== hr) return;
        const mat = normalizeMaterialCode(o['MATERIAL'] || o['CodMaterial'] || '');
        const qty = Number(o['CANTIDAD'] || o['CANTPROGRAMADA'] || 0);
        if (!mat || qty <= 0) return;
        tapaMaterialesPresentes.add(mat);
        if (bloqueadas.has(mk(o))) return;
        tapaQtyPorMaterial.set(mat, (tapaQtyPorMaterial.get(mat) || 0) + qty);
      });
      tapaMaterialesPresentes.forEach(tapaMat => {
        const tapaQty = tapaQtyPorMaterial.get(tapaMat) || 0; // 0 si está 100% bloqueada
        // Ratio aún no resuelto contra SAP para esta Tapa: se ignora hasta que llegue (ver el
        // efecto de abajo), en vez de asumir 0 y descuadrar el objetivo por una carrera de datos.
        const acolchados = tapaAcolchadoPorMaterialNorm.get(tapaMat);
        if (!acolchados) return;
        acolchados.forEach((ratio, acolchadoMat) => {
          if (!(ratio > 0)) return;
          if (!objetivo.has(acolchadoMat)) objetivo.set(acolchadoMat, new Map());
          const porCelula = objetivo.get(acolchadoMat)!;
          if (!porCelula.has(suffix)) porCelula.set(suffix, []);
          // `cantidad` puede ser 0 (Tapa 100% bloqueada) — se conserva la entrada igual, para que
          // el consumidor sepa "sí hay corrección, y es 0" en vez de "no hay corrección".
          porCelula.get(suffix)!.push({ tapaMat, ratio, cantidad: tapaQty * ratio });
        });
      });
    });
    return objetivo;
  }, [getPefDeCelula, mapToHojaRutaInternal, techFilteredOrdenes, tapaOrdenesBloqueadasPorPuesto, normalizeMaterialCode, tapaAcolchadoPorMaterialNorm]);

  // Resuelve contra SAP el ratio Tapa→Acolchado de TODAS las Tapas reales de cada Cosedora pareja
  // (no solo las bloqueadas, a diferencia del efecto de la cascada) — `acolchadoTapaDemandaPorCelula`
  // necesita esto disponible desde el primer render, sin esperar a que el usuario bloquee algo.
  // `resolverRatioTapaAcolchado` ya cachea por material: no vuelve a consultar lo ya resuelto.
  useEffect(() => {
    const materialesTapa = new Set<string>();
    CELULA_TWIN_SUFIJOS.forEach(suffix => {
      const pefPuesto = getPefDeCelula(suffix);
      if (!pefPuesto) return;
      const hr = mapToHojaRutaInternal(pefPuesto).trim().toUpperCase();
      techFilteredOrdenes.forEach(o => {
        if (String(o['MAQUINA'] || o['Maquina'] || '').trim().toUpperCase() !== hr) return;
        const mat = String(o['MATERIAL'] || o['CodMaterial'] || '').trim();
        if (mat) materialesTapa.add(mat);
      });
    });
    materialesTapa.forEach(mat => { void resolverRatioTapaAcolchado(mat); });
  }, [getPefDeCelula, mapToHojaRutaInternal, techFilteredOrdenes, resolverRatioTapaAcolchado]);

  // ─── Restricción de movimiento ACOLCHADORA09 → ACOLCHADORA08 ───────────────────────────────
  // Por proceso, desde la ACH09 solo se pueden reasignar ciertas familias de acolchado; el resto
  // se queda fijo en su máquina aunque no quepa (el exceso se resuelve a mano, verificando en SAP).
  // Las familias salen de una restricción en base para poder cambiarlas sin tocar código: se busca
  // la que nombre explícitamente a la ACH09 (ej. `MATERIALES_MOVIBLES_ACH09`), separada por "&".
  const familiasMoviblesAch09 = useMemo(() => {
    const forroGroupCodes = new Set(forrosGruposList.map(g => g.codigo_grupo));
    const restr = restricciones.find(r => {
      const nombre = r.nombre_restriccion.toUpperCase().trim();
      return forroGroupCodes.has(r.codigo_grupo) && nombre.includes('ACH09') && (nombre.includes('MOVIBLE') || nombre.includes('MATERIAL'));
    });
    if (!restr) return null; // sin restricción configurada: no se aplica ningún filtro (se avisa en pantalla)
    const familias = restr.valor_restriccion.split('&').map(v => normalizeText(v.trim())).filter(Boolean);
    return familias.length > 0 ? { nombre: restr.nombre_restriccion, familias } : null;
  }, [restricciones, forrosGruposList]);

  // Filtro que recibe el motor: decide si una pieza puede moverse de `origen` a `destino`.
  // Rige la pareja ACH09 ↔ ACH08 en sus dos sentidos:
  //  · Lo que SALE de la ACH09 solo puede ir a la ACH08, y solo si es de las familias permitidas.
  //  · Lo que ENTRA a la ACH08 debe ser de esas familias SIEMPRE, venga de la célula que venga —
  //    también cuando la que se ajusta es la propia ACH08.
  // Las demás células no se ven afectadas.
  const puedeMoverAcolchado = useCallback((nombreMaterial: string, origen: string, destino: string): boolean => {
    const esCelula = (puesto: string, suf: string) => {
      const u = puesto.toUpperCase();
      return u.includes(`ACH${suf}`) || u.includes(`ACOLCHADORA${suf}`);
    };
    const esFamiliaPermitida = () => {
      if (!familiasMoviblesAch09) return true; // sin restricción configurada no se filtra (se avisa en pantalla)
      const nombre = normalizeText(nombreMaterial || '');
      return familiasMoviblesAch09.familias.some(f => nombre.includes(f));
    };
    // Desde la ACH09: único destino permitido la ACH08, y solo familias permitidas.
    if (esCelula(origen, '09')) return esCelula(destino, '08') && esFamiliaPermitida();
    // Hacia la ACH08: solo familias permitidas, sin importar el origen.
    if (esCelula(destino, '08')) return esFamiliaPermitida();
    return true;
  }, [familiasMoviblesAch09]);

  // Misma reducción, pero sabiendo de QUÉ célula vino la Tapa bloqueada. El recorte debe aplicarse
  // primero a las órdenes de Acolchado de esa misma célula (la pareja física Acolchadora/Cosedora):
  // si bloqueas una Tapa en COSEDORA-ACH07 esperas ver bajar la ACOLCHADORA07, no otra que produzca
  // el mismo material. Sin esto el descuento caía en la primera orden del arreglo, que podía estar
  // en otra máquina, y la barra que estabas mirando no se movía.
  const acolchadoReduccionCelulaPreferida = useMemo(() => {
    const porMaterial = new Map<string, Map<string, number>>();
    if (tapaAcolchadoPorMaterialNorm.size === 0) return porMaterial;
    tapaOrdenesBloqueadasPorPuesto.forEach((keys, puestoTapa) => {
      const suffix = getSuffixCelula(puestoTapa);
      if (!suffix) return;
      keys.forEach(key => {
        const partes = key.split('|');
        const tapaMatRaw = partes[1] || '';
        const cantidad = Number(partes[2] || 0);
        if (!tapaMatRaw || cantidad <= 0) return;
        const acolchados = tapaAcolchadoPorMaterialNorm.get(normalizeMaterialCode(tapaMatRaw));
        if (!acolchados) return;
        acolchados.forEach((cantidadUnitaria, acolchadoMat) => {
          if (!porMaterial.has(acolchadoMat)) porMaterial.set(acolchadoMat, new Map());
          const porCelula = porMaterial.get(acolchadoMat)!;
          porCelula.set(suffix, (porCelula.get(suffix) || 0) + cantidad * cantidadUnitaria);
        });
      });
    });
    return porMaterial;
  }, [tapaOrdenesBloqueadasPorPuesto, tapaAcolchadoPorMaterialNorm, normalizeMaterialCode, getSuffixCelula]);

  // Ordena las órdenes candidatas al recorte poniendo primero las de la célula de donde salió la
  // Tapa bloqueada. Se usa igual en el recorte que alimenta al motor y en el override de la vista,
  // para que ambos descuenten exactamente las mismas órdenes.
  const ordenarCandidatasParaRecorte = useCallback((ordenes: any[], acolchadoMat: string) => {
    const porCelula = acolchadoReduccionCelulaPreferida.get(acolchadoMat);
    if (!porCelula || porCelula.size === 0) return ordenes;
    const prioridad = (o: any) => {
      const suffix = getSuffixCelula(String(o['MAQUINA'] || o['Maquina'] || ''));
      return suffix && porCelula.has(suffix) ? 0 : 1;
    };
    return [...ordenes].sort((a, b) => prioridad(a) - prioridad(b));
  }, [acolchadoReduccionCelulaPreferida, getSuffixCelula]);

  // No basta con que el material tenga tiempo registrado en una ACOLCHADORA: materiales de TAPA
  // (ej. "TAPA CF GRAND PALAIS...") y de BANDA también tienen tiempo registrado ahí (verificado
  // con datos reales de SAP) y se mezclaban incorrectamente. Se exige además que el nombre real
  // del material empiece con "ACOLCHADO" — mismo criterio que clasificarNivelP15/nivel3AcolchadoResumen.
  const ajustePrevisionalAcolchadoData = useMemo(() => {
    const map = new Map<string, number>();
    const mk = (o: any) => `${o['ORDEN'] || o['ORDENPREVISIONAL'] || ''}|${String(o['MATERIAL'] || o['CodMaterial'] || '')}|${String(o['CANTIDAD'] || o['CANTPROGRAMADA'] || '')}`;
    techFilteredOrdenes.forEach(o => {
      if (acolchadoBloqueadasKeysGlobal.has(mk(o))) return;
      const matRaw = o['MATERIAL'] || o['CodMaterial'] || '';
      if (!matRaw) return;
      const mat = normalizeMaterialCode(matRaw);
      const nombreMaterial = materialNombrePorCodigo.get(mat) || '';
      if (!normalizeText(nombreMaterial).startsWith('ACOLCHADO')) return;
      const timesList: any[] = tiemposIndexRef.current[mat] || [];
      const esAcolchado = timesList.some((t: any) => esPuestoAcolchado(String(t.PuestoTrabajo || t.nombre_estacion || t.Maquina || '').trim().toUpperCase()));
      if (!esAcolchado) return;
      const qty = Number(o['CANTIDAD'] || o['CANTPROGRAMADA'] || 0);
      map.set(mat, (map.get(mat) || 0) + qty);
    });
    // Descuenta lo que ya no se necesita porque su Tapa fue bloqueada manualmente (ver
    // `acolchadoDemandaReducidaPorTapaBloqueada`) — nunca por debajo de 0.
    acolchadoDemandaReducidaPorTapaBloqueada.forEach((cantidad, mat) => {
      const actual = map.get(mat);
      if (actual === undefined) return;
      map.set(mat, Math.max(0, actual - cantidad));
    });
    return map;
  }, [techFilteredOrdenes, normalizeMaterialCode, esPuestoAcolchado, materialNombrePorCodigo, acolchadoBloqueadasKeysGlobal, acolchadoDemandaReducidaPorTapaBloqueada]);

  const ajusteAcolchadoMateriales = useMemo<MaterialAcolchado[]>(() => {
    if (ajustePrevisionalAcolchadoData.size === 0) return [];
    const getCapacidad = (puesto: string) => {
      const cfg = workstationConfigs[puesto] || { machine: puesto, isDayActive: true, isNightActive: false, isSaturdayActive: false, peopleDay: 0, peopleNight: 0, peopleWeekend: 0, machines: 1 };
      const capacidad = capacidadPuesto(puesto, cfg, horasNetasDiurnasVal, horasNetasNocturnasVal, horasNetasFinSemanaVal);
      return { cfg, capacidad };
    };
    const out: MaterialAcolchado[] = [];
    ajustePrevisionalAcolchadoData.forEach((cantidadTotal, mat) => {
      if (cantidadTotal <= 0) return;
      const timesList: any[] = tiemposIndexRef.current[mat] || [];
      const candidatos = timesList
        .map(t => ({
          puesto: String(t.PuestoTrabajo || t.nombre_estacion || t.Maquina || '').trim().toUpperCase(),
          tiempoSegPorUnidad: Number(t.Tiempo || t.Tiempo_Min || 0) * 60,
        }))
        .filter(c => c.puesto && esPuestoAcolchado(c.puesto) && c.tiempoSegPorUnidad > 0);
      if (candidatos.length === 0) return;
      out.push({
        material: mat,
        nombre: materialNombrePorCodigo.get(mat) || mat,
        cantidadTotal,
        qtyChn: cantidadTotal,
        qtyBase: 0,
        candidatos: candidatos.map(c => ({ ...c, ...getCapacidad(c.puesto) })),
      });
    });
    return out;
  }, [ajustePrevisionalAcolchadoData, workstationConfigs, horasNetasDiurnasVal, horasNetasNocturnasVal, horasNetasFinSemanaVal, materialNombrePorCodigo, esPuestoAcolchado]);

  // Versión de Fabricación propia para este universo de materiales (el de las órdenes previsionales,
  // que puede incluir referencias fuera de la explosión en vivo de Ensamblado — ej. reparaciones de
  // materiales que no se estaban planificando este ciclo).
  const [versionPorMaterialAjusteAcolchado, setVersionPorMaterialAjusteAcolchado] = useState<Map<string, Map<string, VersionInfo>>>(new Map());

  useEffect(() => {
    if (ajusteAcolchadoMateriales.length === 0) {
      setVersionPorMaterialAjusteAcolchado(new Map());
      return;
    }
    let cancelled = false;
    (async () => {
      try {
        const materiales = ajusteAcolchadoMateriales.map(m => m.material);
        const datosPorMaterial = await fetchVersionesPorMaterial(materiales);
        const resultado = new Map<string, Map<string, VersionInfo>>();
        const sinVersion: string[] = [];
        materiales.forEach(material => {
          const porHoja = new Map<string, VersionInfo>();
          (datosPorMaterial.get(material) || []).forEach((v: any) => {
            const hoja = String(v.GRUPOHOJARUTA || '').trim().toUpperCase().replace(/^HR-/, '');
            // Se conserva el texto EXACTO de SAP (puede venir "1" o "01") para Plan Final/PROD_VERS;
            // `numero` es solo para decidir cuál candidato es la versión preferida (menor = mejor).
            const textoVersion = String(v.VERSION || '').trim();
            const numero = parseInt(textoVersion, 10);
            if (hoja && textoVersion && !isNaN(numero)) porHoja.set(hoja, { numero, texto: textoVersion });
          });
          if (porHoja.size === 0) sinVersion.push(material);
          resultado.set(material, porHoja);
        });
        if (!cancelled) {
          setVersionPorMaterialAjusteAcolchado(resultado);
          if (sinVersion.length > 0) {
            addNotification('warning', `${sinVersion.length} material${sinVersion.length === 1 ? '' : 'es'} de ACOLCHADO en órdenes previsionales sin Versión de Fabricación registrada en SAP (Centro 1000): ${sinVersion.join(', ')}. Se usará el tiempo más rápido como respaldo para esa(s) referencia(s).`);
          }
        }
      } catch (error: any) {
        if (!cancelled) addNotification('error', `Error al consultar Versión de Fabricación (Ajuste de Producción): ${error.message}`);
      }
    })();
    return () => { cancelled = true; };
  }, [ajusteAcolchadoMateriales, addNotification, fetchVersionesPorMaterial]);

  // Célula (Acolchado + Tapa) como par físico fijo: si el Acolchado de un material se reasigna a
  // OTRA célula por Versión de Fabricación, su Tapa se cascada a coser en la Cosedora/PEF pareja de
  // ESA MISMA célula destino (ver `tapaCascadaDesdeAcolchado` más abajo). A diferencia de un diseño
  // anterior, aquí NO hay compuerta de capacidad que bloquee la reasignación de Acolchado según la
  // Tapa: el Acolchado NUNCA debe quedar en exceso si hay capacidad libre en cualquier otra célula,
  // aunque eso sature a la Cosedora pareja de esa célula destino — la Cosedora SÍ puede terminar con
  // exceso de producción (confirmado con el usuario), el Acolchado no.
  // (`getPefDeCelula` se movió arriba, junto a `getSuffixCelula`.)

  // Bloqueo manual de órdenes de Tapa/Cosedora (COSEDORA-ACHXX): el usuario verifica contra SAP y,
  // si una orden no se puede fabricar, la bloquea aquí en vez de eliminarla — sigue visible en la
  // tabla (marcada) pero deja de contar en la carga/ocupación de esa Cosedora. Ya no alimenta
  // ninguna compuerta de capacidad hacia Acolchado (esa compuerta se eliminó), pero SÍ descuenta del
  // Acolchado la porción que esa Tapa necesitaba (vía BOM, ver `acolchadoDemandaReducidaPorTapaBloqueada`
  // más arriba) — si no vas a coser la Tapa, tampoco necesitas el Acolchado que le correspondía.
  // `tapaOrdenesBloqueadasPorPuesto` se declara más arriba (antes de `ajustePrevisionalAcolchadoData`,
  // que ya lo necesita). Reversible: volver a presionar desbloquea.
  const handleToggleBloqueoOrdenTapa = useCallback((puesto: string, order: any) => {
    const mk = (o: any) => `${o['ORDEN'] || o['ORDENPREVISIONAL'] || ''}|${String(o['MATERIAL'] || o['CodMaterial'] || '')}|${String(o['CANTIDAD'] || o['CANTPROGRAMADA'] || '')}`;
    const key = mk(order);
    const estabaBloqueada = (tapaOrdenesBloqueadasPorPuesto.get(puesto) || new Set<string>()).has(key);
    setTapaOrdenesBloqueadasPorPuesto(prev => {
      const next = new Map(prev);
      const set = new Set(next.get(puesto) || []);
      if (set.has(key)) set.delete(key); else set.add(key);
      next.set(puesto, set);
      return next;
    });
    // Al BLOQUEAR se resuelve contra SAP la razón Tapa→Acolchado de ese material (si no está en
    // caché). Es asíncrono: el bloqueo se ve al instante y el descuento del Acolchado aparece en
    // cuanto responde la consulta — la cadena de useMemo se recalcula sola.
    if (!estabaBloqueada) {
      void resolverRatioTapaAcolchado(String(order['MATERIAL'] || order['CodMaterial'] || ''));
    }
  }, [tapaOrdenesBloqueadasPorPuesto, resolverRatioTapaAcolchado]);

  // Alternativas: 'optimo' llena primero la máquina preferida por SAP (Versión); 'equilibrado'
  // reparte hacia la que tenga más holgura relativa en cada momento. Si una no convence, el usuario
  // puede alternar a la otra antes de aceptar cualquiera — nunca un único resultado fijo.
  const [modoAjusteAcolchado, setModoAjusteAcolchado] = useState<'optimo' | 'equilibrado'>('optimo');

  // Corrección MANUAL, por (célula, material): el usuario la activa con el botón "Corregir" cuando
  // ve que la orden de Acolchado de SAP no coincide con lo que calculan sus Tapas (ver
  // `acolchadoValidacionPorCelula` más abajo) — nunca se aplica sola. Mientras una combinación no
  // esté aquí, la orden de Acolchado sigue siendo la de SAP (consolidada + descontada por Tapa
  // bloqueada, el mecanismo viejo que ya existía) — el cálculo por Tapa queda solo como
  // comparación/alerta hasta que el usuario decide corregir.
  const [acolchadoCorreccionesAplicadas, setAcolchadoCorreccionesAplicadas] = useState<Set<string>>(new Set());
  const handleToggleCorreccionAcolchado = useCallback((suffix: string, matNorm: string) => {
    const key = `${suffix}|${matNorm}`;
    setAcolchadoCorreccionesAplicadas(prev => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key); else next.add(key);
      return next;
    });
  }, []);

  // Las órdenes de Acolchado bloqueadas manualmente (ver `acolchadoOrdenesBloqueadasPorPuesto`) se
  // excluyen ANTES de entrar al motor — así no se reasignan a otra célula, se tratan como si esa
  // cantidad simplemente no existiera para efectos de producción.
  const techFilteredOrdenesParaAcolchado = useMemo(() => {
    const mk = (o: any) => `${o['ORDEN'] || o['ORDENPREVISIONAL'] || ''}|${String(o['MATERIAL'] || o['CodMaterial'] || '')}|${String(o['CANTIDAD'] || o['CANTPROGRAMADA'] || '')}`;
    let resultado = acolchadoBloqueadasKeysGlobal.size > 0
      ? techFilteredOrdenes.filter(o => !acolchadoBloqueadasKeysGlobal.has(mk(o)))
      : techFilteredOrdenes;

    if (acolchadoDemandaReducidaPorTapaBloqueada.size > 0) {
      // Recorta la cantidad de las propias órdenes de Acolchado (por código de material, de mayor a
      // menor pendiente) para reflejar lo que ya no se necesita porque su Tapa fue bloqueada
      // manualmente — así el motor de asignación nunca ve esa porción, en vez de solo restarla del
      // total informativo (`ajustePrevisionalAcolchadoData`), que no alimenta al motor por sí solo.
      // El recorte se calcula sobre las órdenes ordenadas por prioridad de célula (las de la célula
      // cuya Tapa se bloqueó, primero) y se guarda por key; después se aplica respetando el orden
      // original del arreglo, para no alterar la secuencia que consume el motor.
      const reduccionRestante = new Map(acolchadoDemandaReducidaPorTapaBloqueada);
      const recortePorKey = new Map<string, number>();
      const porMaterial = new Map<string, any[]>();
      resultado.forEach(o => {
        const mat = normalizeMaterialCode(o['MATERIAL'] || o['CodMaterial'] || '');
        if (!reduccionRestante.has(mat)) return;
        if (!porMaterial.has(mat)) porMaterial.set(mat, []);
        porMaterial.get(mat)!.push(o);
      });
      porMaterial.forEach((ordenes, mat) => {
        ordenarCandidatasParaRecorte(ordenes, mat).forEach(o => {
          const pendiente = reduccionRestante.get(mat) || 0;
          if (pendiente <= 0.001) return;
          const qty = Number(o['CANTIDAD'] || o['CANTPROGRAMADA'] || 0);
          if (qty <= 0) return;
          const recorte = Math.min(qty, pendiente);
          reduccionRestante.set(mat, pendiente - recorte);
          recortePorKey.set(mk(o), qty - recorte);
        });
      });

      resultado = resultado.map(o => {
        const nueva = recortePorKey.get(mk(o));
        return nueva === undefined ? o : { ...o, CANTIDAD: nueva, CANTPROGRAMADA: nueva };
      }).filter(o => Number(o['CANTIDAD'] || o['CANTPROGRAMADA'] || 0) > 0.001);
    }

    // El cálculo de Acolchado-desde-Tapa (`acolchadoTapaDemandaPorCelula`) ya NO reemplaza en
    // silencio la orden de SAP para todos los casos — confirmado con el usuario: es un modelo de
    // VALIDACIÓN (comparar SAP vs. lo que calculan las Tapas y alertar si no coincide), no de
    // reemplazo automático. Solo se aplica de verdad para las combinaciones (célula, material) que
    // el usuario corrigió a mano con el botón "Corregir" (`acolchadoCorreccionesAplicadas`). Las
    // órdenes reales de esa combinación se CONSOLIDAN en filas sintéticas (una por Tapa, para que el
    // motor corte con el ratio correcto si tiene que partir entre máquinas); el resto de células
    // sigue con la orden de SAP tal cual (consolidada + descontada por Tapa bloqueada, el mecanismo
    // viejo que ya existía).
    if (acolchadoTapaDemandaPorCelula.size > 0 && acolchadoCorreccionesAplicadas.size > 0) {
      const porCelulaMaterial = new Map<string, any[]>();
      const sinCorregir: any[] = [];
      resultado.forEach(o => {
        const suffix = getSuffixCelula(String(o['MAQUINA'] || o['Maquina'] || ''));
        const matNorm = normalizeMaterialCode(o['MATERIAL'] || o['CodMaterial'] || '');
        const objetivo = suffix ? acolchadoTapaDemandaPorCelula.get(matNorm)?.get(suffix) : undefined;
        const key = suffix ? `${suffix}|${matNorm}` : '';
        if (suffix && objetivo !== undefined && objetivo.length > 0 && acolchadoCorreccionesAplicadas.has(key)) {
          if (!porCelulaMaterial.has(key)) porCelulaMaterial.set(key, []);
          porCelulaMaterial.get(key)!.push(o);
        } else {
          sinCorregir.push(o);
        }
      });
      const consolidadas: any[] = [];
      porCelulaMaterial.forEach((filas, key) => {
        const [suffix, matNorm] = key.split('|');
        const porTapa = acolchadoTapaDemandaPorCelula.get(matNorm)!.get(suffix)!;
        // Una fila sintética POR TAPA (no una suma) — cada una se corta con SU PROPIO ratio si el
        // motor la tiene que partir entre máquinas (ver `_ratioTapaEspecifico` en
        // `cuantizarAcolchadoATapaEntera`). Sumarlas en un solo número antes de partir era
        // exactamente el bug: el corte terminaba usando el ratio de la Tapa equivocada.
        porTapa.forEach(({ tapaMat, ratio, cantidad }) => {
          if (cantidad <= 0.001) return;
          consolidadas.push({
            ...filas[0],
            ORDEN: `SINTETICO-ACOLCHADO-${key}-${tapaMat}`,
            ORDENPREVISIONAL: `SINTETICO-ACOLCHADO-${key}-${tapaMat}`,
            CANTIDAD: cantidad,
            CANTPROGRAMADA: cantidad,
            _derivadoDeTapa: true,
            _ratioTapaEspecifico: ratio,
            _tapaMaterialEspecifico: tapaMat,
          });
        });
      });
      resultado = [...sinCorregir, ...consolidadas];
      // El bloqueo individual de una orden (candado) se vuelve a aplicar aquí: si el usuario
      // bloqueó la fila sintética consolidada (la que ahora ve la tarjeta), su key ya no existe en
      // las órdenes crudas de más arriba — sin este segundo filtro el candado dejaría de surtir
      // efecto en cuanto un material pasa a mostrarse consolidado.
      if (acolchadoBloqueadasKeysGlobal.size > 0) {
        resultado = resultado.filter(o => !acolchadoBloqueadasKeysGlobal.has(mk(o)));
      }
    }

    return resultado;
  }, [techFilteredOrdenes, acolchadoBloqueadasKeysGlobal, acolchadoDemandaReducidaPorTapaBloqueada, normalizeMaterialCode, ordenarCandidatasParaRecorte, acolchadoTapaDemandaPorCelula, getSuffixCelula, acolchadoCorreccionesAplicadas]);

  // Cantidad de Acolchado que manda HOY la orden de SAP por (célula, material) — la orden real,
  // consolidada (sumadas sus líneas), SIN la corrección por Tapa. Es el número contra el que se
  // compara la necesidad calculada (`acolchadoTapaDemandaPorCelula`) para la validación/alerta.
  const acolchadoCantidadSapPorCelula = useMemo(() => {
    const map = new Map<string, Map<string, number>>(); // matNorm -> suffix -> cantidad
    const mk = (o: any) => `${o['ORDEN'] || o['ORDENPREVISIONAL'] || ''}|${String(o['MATERIAL'] || o['CodMaterial'] || '')}|${String(o['CANTIDAD'] || o['CANTPROGRAMADA'] || '')}`;
    techFilteredOrdenes.forEach(o => {
      if (acolchadoBloqueadasKeysGlobal.has(mk(o))) return;
      const suffix = getSuffixCelula(String(o['MAQUINA'] || o['Maquina'] || ''));
      if (!suffix) return;
      const matNorm = normalizeMaterialCode(o['MATERIAL'] || o['CodMaterial'] || '');
      const qty = Number(o['CANTIDAD'] || o['CANTPROGRAMADA'] || 0);
      if (!matNorm || qty <= 0) return;
      if (!map.has(matNorm)) map.set(matNorm, new Map());
      const inner = map.get(matNorm)!;
      inner.set(suffix, (inner.get(suffix) || 0) + qty);
    });
    return map;
  }, [techFilteredOrdenes, acolchadoBloqueadasKeysGlobal, getSuffixCelula, normalizeMaterialCode]);

  // ─── Validación Acolchado vs. Tapas (modelo de vista pedido por el usuario) ────────────────────
  // Por cada (célula, material) con Tapas reales conocidas: compara la orden de SAP CONSOLIDADA
  // contra la NECESIDAD calculada desde las Tapas (unidades reales × ratio, ya descontando
  // bloqueadas). Si no coinciden, se marca para mostrar la alerta + botón "Corregir" — nunca se
  // reemplaza sola. `porTapa` trae también las unidades reales (cantidad / ratio) para la fila hija
  // de cada Tapa en la tarjeta.
  const acolchadoValidacionPorCelula = useMemo(() => {
    const resultado = new Map<string, {
      suffix: string; matNorm: string; cantidadSAP: number; necesidadTapas: number; coincide: boolean; corregido: boolean;
      porTapa: { tapaMat: string; ratio: number; unidades: number; cantidadAcolchado: number }[];
    }>();
    acolchadoTapaDemandaPorCelula.forEach((porCelula, matNorm) => {
      porCelula.forEach((porTapaRaw, suffix) => {
        const necesidadTapas = porTapaRaw.reduce((s, t) => s + t.cantidad, 0);
        const cantidadSAP = acolchadoCantidadSapPorCelula.get(matNorm)?.get(suffix) || 0;
        const key = `${suffix}|${matNorm}`;
        resultado.set(key, {
          suffix, matNorm, cantidadSAP, necesidadTapas,
          // Tolerancia de 0.5 (mismo criterio que el resto de la app usa para "cabe justo") — nunca
          // alertar por ruido de punto flotante o un residuo menor a media unidad.
          coincide: Math.abs(cantidadSAP - necesidadTapas) < 0.5,
          corregido: acolchadoCorreccionesAplicadas.has(key),
          porTapa: porTapaRaw.map(t => ({ tapaMat: t.tapaMat, ratio: t.ratio, unidades: t.ratio > 0 ? t.cantidad / t.ratio : 0, cantidadAcolchado: t.cantidad })),
        });
      });
    });
    return resultado;
  }, [acolchadoTapaDemandaPorCelula, acolchadoCantidadSapPorCelula, acolchadoCorreccionesAplicadas]);

  // Misma reducción que aplica `techFilteredOrdenesParaAcolchado` al motor, pero expresada como
  // "cantidad efectiva por orden" para la VISTA de la tarjeta de Acolchadora: así la fila se ve
  // descontada y —sobre todo— el % de la barra de capacidad baja de verdad cuando se bloquea una
  // Tapa. No se muta la CANTIDAD de la orden: las keys de bloqueo se arman con ella.
  const acolchadoQtyOverridePorOrden = useMemo(() => {
    const override = new Map<string, number>();
    if (acolchadoDemandaReducidaPorTapaBloqueada.size === 0) return override;
    const mk = (o: any) => `${o['ORDEN'] || o['ORDENPREVISIONAL'] || ''}|${String(o['MATERIAL'] || o['CodMaterial'] || '')}|${String(o['CANTIDAD'] || o['CANTPROGRAMADA'] || '')}`;
    // MISMO orden de prioridad que usa el recorte que alimenta al motor: primero las órdenes de la
    // célula cuya Tapa se bloqueó. Si ambos no coincidieran, la barra mostraría un descuento en una
    // máquina y el motor lo aplicaría en otra.
    const reduccionRestante = new Map(acolchadoDemandaReducidaPorTapaBloqueada);
    const porMaterial = new Map<string, any[]>();
    techFilteredOrdenes.forEach(o => {
      // Las bloqueadas ya no se fabrican: no consumen reducción ni se muestran descontadas.
      if (acolchadoBloqueadasKeysGlobal.has(mk(o))) return;
      const mat = normalizeMaterialCode(o['MATERIAL'] || o['CodMaterial'] || '');
      if (!reduccionRestante.has(mat)) return;
      if (!porMaterial.has(mat)) porMaterial.set(mat, []);
      porMaterial.get(mat)!.push(o);
    });
    porMaterial.forEach((ordenes, mat) => {
      ordenarCandidatasParaRecorte(ordenes, mat).forEach(o => {
        const pendiente = reduccionRestante.get(mat) || 0;
        if (pendiente <= 0.001) return;
        const qty = Number(o['CANTIDAD'] || o['CANTPROGRAMADA'] || 0);
        if (qty <= 0) return;
        const recorte = Math.min(qty, pendiente);
        reduccionRestante.set(mat, pendiente - recorte);
        override.set(mk(o), qty - recorte);
      });
    });
    return override;
  }, [techFilteredOrdenes, acolchadoDemandaReducidaPorTapaBloqueada, acolchadoBloqueadasKeysGlobal, normalizeMaterialCode, ordenarCandidatasParaRecorte]);

  // Corta la cantidad de Acolchado al múltiplo entero de TAPA inmediatamente anterior. Confirmado
  // con el usuario: prefiere perder un poco de aprovechamiento de capacidad antes que quedarse con
  // fracciones — "tiene que coincidir la cantidad de acolchado con tapas en cada máquina". Sin
  // esto, el motor partía el Acolchado en el punto exacto que llenaba la última fracción de hora
  // (ej. 214,7 m²) y aguas abajo la Cosedora recibía 2,439 tapas.
  const cuantizarAcolchadoATapaEntera = useCallback((material: string, cantidad: number, order?: any) => {
    // Cada fila sintética "derivada de Tapa" (ver `acolchadoTapaDemandaPorCelula`) ya sabe con
    // exactitud a qué Tapa pertenece y trae SU PROPIO ratio (`_ratioTapaEspecifico`). Usar ese
    // ratio puntual es obligatorio cuando existe: si dos Tapas comparten el mismo Acolchado con
    // ratios distintos (ej. 1.06 y 0.80) y se corta con un ratio "promedio"/máximo, el fragmento
    // deja de coincidir con CUALQUIERA de las dos Tapas reales — la causa real del desajuste
    // reportado desde planta. Solo cuando la fila NO trae ratio propio (una orden cruda de SAP que
    // el cruce con Tapa todavía no corrigió) se recurre al máximo como respaldo genérico.
    const ratioEspecifico = order?._ratioTapaEspecifico;
    if (ratioEspecifico > 0) {
      const cortado = Math.floor((cantidad + 1e-6) / ratioEspecifico) * ratioEspecifico;
      return cortado > 1e-6 ? cortado : 0;
    }
    const tapas = acolchadoTapasIndexCombinado.get(material);
    if (!tapas || tapas.size === 0) return cantidad; // BOM aún no resuelto: no se toca la cantidad
    const ratio = Math.max(...Array.from(tapas.values()));
    if (!(ratio > 0)) return cantidad;
    const cortado = Math.floor((cantidad + 1e-6) / ratio) * ratio;
    // Si no alcanza ni para una Tapa completa, no se coloca nada acá: el fragmento se buscará en
    // la siguiente máquina candidata en vez de dejar un pedazo infabricable.
    return cortado > 1e-6 ? cortado : 0;
  }, [acolchadoTapasIndexCombinado]);

  const acolchadoAsignacionOptima = useMemo(
    () => asignarOptimoPorVersion(ajusteAcolchadoMateriales, versionPorMaterialAjusteAcolchado, techFilteredOrdenesParaAcolchado, modoAjusteAcolchado, true, puedeMoverAcolchado, cuantizarAcolchadoATapaEntera),
    [asignarOptimoPorVersion, ajusteAcolchadoMateriales, versionPorMaterialAjusteAcolchado, techFilteredOrdenesParaAcolchado, modoAjusteAcolchado, puedeMoverAcolchado, cuantizarAcolchadoATapaEntera]
  );

  const getProdVersionAcolchado = useCallback((material: string, puesto: string) => {
    const hoja = mapToHojaRutaInternal(puesto).trim().toUpperCase().replace(/^HR-/, '');
    return versionPorMaterialAjusteAcolchado.get(material)?.get(hoja)?.texto;
  }, [mapToHojaRutaInternal, versionPorMaterialAjusteAcolchado]);

  const acolchadoMapasAsignacion = useMemo(
    () => derivarMapasDesdeAsignacion(acolchadoAsignacionOptima, getProdVersionAcolchado),
    [derivarMapasDesdeAsignacion, acolchadoAsignacionOptima, getProdVersionAcolchado]
  );
  const acolchadoExcludeKeysPorPuesto = acolchadoMapasAsignacion.excludeKeysPorPuesto;
  const acolchadoAdjustedInPorPuesto = acolchadoMapasAsignacion.adjustedInPorPuesto;
  const acolchadoSplitRemaindersPorPuesto = acolchadoMapasAsignacion.splitRemaindersPorPuesto;

  // Toggle de ajuste POR CÉLULA (un botón "Ajustar" independiente por acolchadora, ver render) en
  // vez de un único interruptor para las 7 a la vez — así se puede activar solo la célula que
  // interesa sin mover de paso la producción de las demás. El motor (`acolchadoAsignacionOptima`)
  // siempre se calcula completo para las 7; este set solo controla cuáles se MUESTRAN ajustadas.
  // Declarado aquí, antes de sus primeros consumidores (`acolchadoAdjustedInVisiblePorPuesto` y
  // `tapaCascadaDesdeAcolchado`), para no referenciarlo antes de su inicialización.
  const [acolchadoCelulasAjusteActivas, setAcolchadoCelulasAjusteActivas] = useState<Set<string>>(new Set());

  // Órdenes ENTRANTES visibles por puesto: una célula muestra lo que recibe aunque ella no esté
  // ajustada, siempre que la célula de ORIGEN sí lo esté. Así, ajustar la ACH09 hace que la ACH08
  // reciba y recalcule su ocupación sola. Se memoiza (y se conserva la identidad de los arreglos
  // cuando no cambia nada) para no romper el React.memo de MachineCard en cada render.
  const acolchadoAdjustedInVisiblePorPuesto = useMemo(() => {
    const map = new Map<string, any[]>();
    acolchadoAdjustedInPorPuesto.forEach((ordenes, puesto) => {
      if (acolchadoCelulasAjusteActivas.has(puesto)) { map.set(puesto, ordenes); return; }
      const visibles = ordenes.filter(o => o._fromPuesto && acolchadoCelulasAjusteActivas.has(o._fromPuesto));
      if (visibles.length > 0) map.set(puesto, visibles);
    });
    return map;
  }, [acolchadoAdjustedInPorPuesto, acolchadoCelulasAjusteActivas]);

  // Lista plana de piezas movidas/divididas (compatibilidad con el panel de resumen y "Aceptar").
  const acolchadoMovedOrders = useMemo(() => (
    acolchadoAsignacionOptima.piezas
      .filter(p => p.isSplit || p.puestoFinal !== p.puestoNatural)
      .map(p => ({
        ...p.order,
        CANTIDAD: p.cantidad,
        CANTPROGRAMADA: p.cantidad,
        _fromPuesto: p.puestoNatural,
        _toPuesto: p.puestoFinal,
        _isSplit: p.isSplit,
        _originalCantidad: p.originalCantidad,
        _originalKey: p.originalKey,
      }))
  ), [acolchadoAsignacionOptima]);

  // Cuánto de cada Acolchado quedó REALMENTE colocado (no en exceso) tras el motor de asignación —
  // este es el presupuesto real disponible para convertir en Tapas, no la demanda original.
  const acolchadoProducidoPorMaterial = useMemo(() => {
    const map = new Map<string, number>();
    acolchadoAsignacionOptima.piezas.forEach(p => map.set(p.material, (map.get(p.material) || 0) + p.cantidad));
    return map;
  }, [acolchadoAsignacionOptima]);

  // Puesto "natural" de cada material de Acolchado (para agrupar el aviso de Tapas afectadas en la
  // célula correcta) — se toma directo del motor, no se recalcula la regla de preferencia dos veces.
  const acolchadoMaterialPuestoNatural = useMemo(() => {
    const map = new Map<string, string>();
    acolchadoAsignacionOptima.piezas.forEach(p => { if (!map.has(p.material)) map.set(p.material, p.puestoNatural); });
    acolchadoAsignacionOptima.exceso.forEach(e => { if (!map.has(e.material)) map.set(e.material, e.puestoNatural); });
    return map;
  }, [acolchadoAsignacionOptima]);

  // Por Tapa: cuántas unidades son producibles con el Acolchado disponible (repartido "mejor
  // ajuste" cuando un mismo Acolchado alimenta varias Tapas, igual criterio que el panel Nivel 3/4)
  // y, a nivel de ORDEN real de SAP, cuáles quedan sin poder fabricarse por falta de Acolchado.
  const tapasAjustadasPorAcolchado = useMemo(() => {
    const resultado = new Map<string, { producible: number; demandaTotal: number; ordenesFinal: any[]; ordenesExceso: any[] }>();
    if (acolchadoTapasPorMaterialNorm.size === 0) return resultado;

    ajusteAcolchadoMateriales.forEach(m => {
      const tapasDeEsteMaterial = acolchadoTapasPorMaterialNorm.get(m.material);
      if (!tapasDeEsteMaterial || tapasDeEsteMaterial.size === 0) return;

      let presupuesto = acolchadoProducidoPorMaterial.get(m.material) || 0;
      const demandaPorTapa = new Map<string, number>();
      tapasDeEsteMaterial.forEach((_, tapaMaterial) => {
        const demanda = techFilteredOrdenes
          .filter(o => normalizeMaterialCode(o['MATERIAL'] || o['CodMaterial'] || '') === tapaMaterial)
          .reduce((s, o) => s + Number(o['CANTIDAD'] || o['CANTPROGRAMADA'] || 0), 0);
        demandaPorTapa.set(tapaMaterial, demanda);
      });

      const candidatos = [...tapasDeEsteMaterial.entries()].sort((a, b) => b[1] - a[1]);
      const producidoPorTapa = new Map<string, number>();
      candidatos.forEach(([tapaMaterial, cantidadUnitaria]) => {
        if (presupuesto <= 0.01 || cantidadUnitaria <= 0) return;
        const demanda = demandaPorTapa.get(tapaMaterial) || 0;
        const unidades = Math.min(demanda, Math.floor(presupuesto / cantidadUnitaria));
        if (unidades <= 0) return;
        presupuesto -= unidades * cantidadUnitaria;
        producidoPorTapa.set(tapaMaterial, unidades);
      });
      // Corrección por redondeo: con lo que sobró, una unidad más a la Tapa más chica que aún quepa.
      let progreso = true;
      while (progreso && presupuesto > 0.01) {
        progreso = false;
        const cand = candidatos
          .filter(([tapaMaterial, cantidadUnitaria]) => cantidadUnitaria <= presupuesto + 0.01 && (producidoPorTapa.get(tapaMaterial) || 0) < (demandaPorTapa.get(tapaMaterial) || 0))
          .sort((a, b) => a[1] - b[1])[0];
        if (!cand) break;
        const [tapaMaterial, cantidadUnitaria] = cand;
        presupuesto -= cantidadUnitaria;
        producidoPorTapa.set(tapaMaterial, (producidoPorTapa.get(tapaMaterial) || 0) + 1);
        progreso = true;
      }

      tapasDeEsteMaterial.forEach((_, tapaMaterial) => {
        const producible = producidoPorTapa.get(tapaMaterial) || 0;
        const demandaTotal = demandaPorTapa.get(tapaMaterial) || 0;

        // Traduce el cupo producible a órdenes REALES discretas de SAP (mismo criterio de la app:
        // de mayor a menor cantidad, dividiendo la última que no quepa completa).
        const ordenes = techFilteredOrdenes
          .filter(o => normalizeMaterialCode(o['MATERIAL'] || o['CodMaterial'] || '') === tapaMaterial)
          .sort((a, b) => Number(b['CANTIDAD'] || b['CANTPROGRAMADA'] || 0) - Number(a['CANTIDAD'] || a['CANTPROGRAMADA'] || 0));
        let restante = producible;
        const ordenesFinal: any[] = [];
        const ordenesExceso: any[] = [];
        ordenes.forEach(o => {
          const qty = Number(o['CANTIDAD'] || o['CANTPROGRAMADA'] || 0);
          if (qty <= 0) return;
          if (restante <= 0.01) { ordenesExceso.push(o); return; }
          if (qty <= restante + 0.5) { ordenesFinal.push(o); restante -= qty; }
          else {
            ordenesFinal.push({ ...o, CANTIDAD: restante, CANTPROGRAMADA: restante, _isSplit: true, _originalCantidad: qty });
            ordenesExceso.push({ ...o, CANTIDAD: qty - restante, CANTPROGRAMADA: qty - restante, _isSplit: true, _originalCantidad: qty });
            restante = 0;
          }
        });

        // Si una Tapa se alimenta de varios Acolchados, el limitante real es el MÍNIMO producible
        // entre todos ellos (igual criterio que acolchadoTapasResultado en el panel Nivel 3/4).
        const existente = resultado.get(tapaMaterial);
        if (!existente || producible < existente.producible) {
          resultado.set(tapaMaterial, { producible, demandaTotal, ordenesFinal, ordenesExceso });
        }
      });
    });

    return resultado;
  }, [acolchadoTapasPorMaterialNorm, ajusteAcolchadoMateriales, acolchadoProducidoPorMaterial, techFilteredOrdenes, normalizeMaterialCode]);

  // Agrupa las Tapas afectadas (con exceso > 0) por la célula (puesto natural de Acolchado) que las
  // limita, para mostrarlas junto al panel de exceso de Acolchado de esa misma célula.
  const tapasAfectadasPorCelula = useMemo(() => {
    const map = new Map<string, { tapaMaterial: string; nombre: string; producible: number; demandaTotal: number; ordenesExceso: any[] }[]>();
    ajusteAcolchadoMateriales.forEach(m => {
      const puestoNatural = acolchadoMaterialPuestoNatural.get(m.material);
      if (!puestoNatural) return;
      const tapasDeEsteMaterial = acolchadoTapasPorMaterialNorm.get(m.material);
      if (!tapasDeEsteMaterial) return;
      tapasDeEsteMaterial.forEach((_, tapaMaterial) => {
        const info = tapasAjustadasPorAcolchado.get(tapaMaterial);
        if (!info || info.ordenesExceso.length === 0) return;
        if (!map.has(puestoNatural)) map.set(puestoNatural, []);
        const yaAgregada = map.get(puestoNatural)!.some(t => t.tapaMaterial === tapaMaterial);
        if (yaAgregada) return;
        map.get(puestoNatural)!.push({
          tapaMaterial,
          nombre: materialNombrePorCodigo.get(tapaMaterial) || '',
          producible: info.producible,
          demandaTotal: info.demandaTotal,
          ordenesExceso: info.ordenesExceso,
        });
      });
    });
    return map;
  }, [ajusteAcolchadoMateriales, acolchadoMaterialPuestoNatural, acolchadoTapasPorMaterialNorm, tapasAjustadasPorAcolchado, materialNombrePorCodigo]);

  // ─── Cascada de Tapa hacia la Cosedora de destino, siguiendo a su Acolchado ──────────────
  // Confirmado con el usuario: si el Acolchado de un material se reasigna de una célula a otra
  // (por versión), la Tapa que ese Acolchado alimenta debe coserse en la MISMA célula destino, no
  // quedarse sin producir en la Cosedora de origen — el par Acolchado/Tapa es físico y fijo. Solo se
  // cascada lo que el motor YA decidió mover entre células (piezas con puestoFinal !== puestoNatural,
  // en una célula distinta) — nunca se toca una Tapa cuyo Acolchado se quedó en su célula natural
  // (ya está bien ubicada; moverla solo generaría más trabajo sin necesidad). Se gatea por el toggle
  // de la célula de ORIGEN (`acolchadoCelulasAjusteActivas`): la cascada solo aplica para las
  // células que el usuario ya activó, igual criterio que el resto del ajuste por célula.
  const tapaCascadaDesdeAcolchado = useMemo(() => {
    const excludeKeysPorPuesto = new Map<string, Set<string>>();
    const adjustedInPorPuesto = new Map<string, any[]>();
    // Parte de una orden de Tapa que NO viaja y se queda en la Cosedora de ORIGEN. Es obligatorio:
    // al partir una orden se excluye del origen por su key (la key lleva la CANTIDAD original, así
    // que no se puede "achicar" la fila), y sin este remanente las unidades no transferidas
    // desaparecían del plan — una orden de 88 se convertía en 2 y se perdían 86.
    const splitRemaindersPorPuesto = new Map<string, any[]>();
    // Células cuyo Acolchado se movió pero cuya Tapa NO se pudo cascadear, con el motivo. Se
    // reporta en pantalla: si no, la Tapa simplemente no se movía y no había forma de saber por qué.
    const sinCascada: { origen: string; destino: string; material: string; motivo: string }[] = [];
    if (acolchadoTapasIndexCombinado.size === 0) return { excludeKeysPorPuesto, adjustedInPorPuesto, splitRemaindersPorPuesto, sinCascada };

    const mk = (o: any) => `${o['ORDEN'] || o['ORDENPREVISIONAL'] || ''}|${String(o['MATERIAL'] || o['CodMaterial'] || '')}|${String(o['CANTIDAD'] || o['CANTPROGRAMADA'] || '')}`;

    // Se agrupa por (material, origen, destino, TAPA ESPECÍFICA) — nunca solo por material. Antes
    // se sumaba TODO el Acolchado movido de un material en un solo número y, si ese material
    // alimentaba más de una Tapa (ratios distintos), la cascada recorría cada Tapa dividiendo ese
    // MISMO total por su propio ratio — moviendo de más (o con el ratio equivocado) para cada una.
    // Esa mezcla era la causa real de "el acolchado no coincide con las tapas" en planta. Las piezas
    // que ya vienen de una fila sintética "derivada de Tapa" (ver `acolchadoTapaDemandaPorCelula`)
    // traen su propia `_tapaMaterialEspecifico` y nunca se agrupan con las de otra Tapa; solo las
    // piezas crudas (sin ese dato, transición mientras se resuelve el BOM) usan `(SIN-TAPA-ESPECIFICA)`
    // como comodín y conservan el comportamiento anterior (recorrer todas las Tapas del material).
    type MovGrupo = { material: string; origenSuffix: string; destinoSuffix: string; cantidad: number; tapaEspecifica: string | null };
    const movimientos = new Map<string, MovGrupo>();
    acolchadoAsignacionOptima.piezas.forEach(p => {
      if (p.puestoFinal === p.puestoNatural) return;
      const origenSuffix = getSuffixCelula(p.puestoNatural);
      const destinoSuffix = getSuffixCelula(p.puestoFinal);
      if (!origenSuffix || !destinoSuffix || origenSuffix === destinoSuffix) return;
      // Basta con que esté activa la célula de ORIGEN **o** la de DESTINO — el mismo criterio con el
      // que se muestra el Acolchado movido. Antes solo miraba el origen: si activabas la célula
      // DESTINO (ej. ajustas la ACH02 y recibe Acolchado de la ACH06), veías llegar el Acolchado
      // pero su Tapa se quedaba en la Cosedora de origen (PEF06), rompiendo la regla de que la Tapa
      // siempre acompaña a su Acolchado.
      if (!acolchadoCelulasAjusteActivas.has(p.puestoNatural) && !acolchadoCelulasAjusteActivas.has(p.puestoFinal)) return;
      const tapaEspecifica: string | null = p.order?._tapaMaterialEspecifico ?? null;
      const key = `${p.material}|${origenSuffix}|${destinoSuffix}|${tapaEspecifica ?? '(SIN-TAPA-ESPECIFICA)'}`;
      const existente = movimientos.get(key);
      if (existente) existente.cantidad += p.cantidad;
      else movimientos.set(key, { material: p.material, origenSuffix, destinoSuffix, cantidad: p.cantidad, tapaEspecifica });
    });

    movimientos.forEach(({ material, origenSuffix, destinoSuffix, cantidad, tapaEspecifica }) => {
      const tapasDeEsteMaterialCompleto = acolchadoTapasIndexCombinado.get(material);
      if (!tapasDeEsteMaterialCompleto || tapasDeEsteMaterialCompleto.size === 0) {
        sinCascada.push({ origen: origenSuffix, destino: destinoSuffix, material, motivo: 'aún no se resuelve en SAP qué Tapa consume este Acolchado' });
        return;
      }
      // Si la pieza ya sabe de qué Tapa viene, se cascadea SOLO esa — nunca todas las del material.
      const tapasDeEsteMaterial = tapaEspecifica
        ? new Map([[tapaEspecifica, tapasDeEsteMaterialCompleto.get(tapaEspecifica) || 0]])
        : tapasDeEsteMaterialCompleto;
      const pefOrigen = getPefDeCelula(origenSuffix);
      const pefDestino = getPefDeCelula(destinoSuffix);
      // Caso real y conocido: la célula 07 no tiene Cosedora pareja con hoja de ruta HR-PEF07 (su
      // COSEDORA-ACH07 no está mapeada) ni órdenes de Tapa propias. Ahí no hay nada que cascadear:
      // se reporta en vez de no hacer nada en silencio.
      if (!pefOrigen || !pefDestino) {
        sinCascada.push({
          origen: origenSuffix, destino: destinoSuffix, material,
          motivo: !pefOrigen ? `la célula ${origenSuffix} no tiene Cosedora de Tapa asociada` : `la célula ${destinoSuffix} no tiene Cosedora de Tapa asociada`,
        });
        return;
      }
      const hrOrigen = mapToHojaRutaInternal(pefOrigen).trim().toUpperCase();

      tapasDeEsteMaterial.forEach((cantidadUnitaria, tapaMaterial) => {
        if (cantidadUnitaria <= 0) return;
        // Cuando la pieza trae su propia Tapa (`tapaEspecifica`), esta cantidad YA es esa Tapa × su
        // ratio exacto (viene de `acolchadoTapaDemandaPorCelula`) — la división da exacta. El
        // redondeo queda como red de seguridad solo para el caso sin Tapa específica (pieza cruda).
        const unidadesAMover = Math.round(cantidad / cantidadUnitaria);
        if (unidadesAMover < 1) return;

        // Órdenes reales de esta Tapa en la Cosedora de ORIGEN, de mayor a menor cantidad (mismo
        // criterio "first-fit decreasing" que el resto de la app): se toman completas hasta cubrir
        // lo necesario, dividiendo la última si hace falta.
        // Una Tapa BLOQUEADA no se fabrica en ningún lado: no puede ser candidata a moverse, o la
        // cascada la repondría en la Cosedora destino y volvería a Plan Final por la puerta de atrás.
        const bloqueadasOrigen = tapaOrdenesBloqueadasPorPuesto.get(pefOrigen) || new Set<string>();
        // Una orden ya tomada por otro movimiento (otro Acolchado que alimenta la misma Tapa) no
        // puede volver a tomarse: se duplicaría en el destino y se partiría dos veces.
        const yaTomadasOrigen = excludeKeysPorPuesto.get(pefOrigen);
        const ordenesTapaOrigen = techFilteredOrdenes
          .filter(o => String(o['MAQUINA'] || o['Maquina'] || '').trim().toUpperCase() === hrOrigen && normalizeMaterialCode(o['MATERIAL'] || o['CodMaterial'] || '') === tapaMaterial)
          .filter(o => !bloqueadasOrigen.has(mk(o)) && !yaTomadasOrigen?.has(mk(o)))
          .sort((a, b) => Number(b['CANTIDAD'] || b['CANTPROGRAMADA'] || 0) - Number(a['CANTIDAD'] || a['CANTPROGRAMADA'] || 0));

        let restante = unidadesAMover;
        ordenesTapaOrigen.forEach(o => {
          if (restante < 1) return;
          const qty = Number(o['CANTIDAD'] || o['CANTPROGRAMADA'] || 0);
          if (qty <= 0) return;
          if (!excludeKeysPorPuesto.has(pefOrigen)) excludeKeysPorPuesto.set(pefOrigen, new Set());
          if (!adjustedInPorPuesto.has(pefDestino)) adjustedInPorPuesto.set(pefDestino, []);
          if (qty <= restante) {
            excludeKeysPorPuesto.get(pefOrigen)!.add(mk(o));
            adjustedInPorPuesto.get(pefDestino)!.push({ ...o, _fromPuesto: pefOrigen, _toPuesto: pefDestino });
            restante -= qty;
          } else {
            // Solo se parte en unidades enteras de Tapa. Si lo que falta por mover no llega a una
            // tapa completa, la orden se queda entera en su Cosedora: partirla por una fracción es
            // ineficiente en planta y produce cantidades que no se pueden fabricar.
            const fragmento = Math.floor(restante);
            restante = 0;
            if (fragmento < 1) return;
            excludeKeysPorPuesto.get(pefOrigen)!.add(mk(o));
            adjustedInPorPuesto.get(pefDestino)!.push({ ...o, CANTIDAD: fragmento, CANTPROGRAMADA: fragmento, _isSplit: true, _originalCantidad: qty, _fromPuesto: pefOrigen, _toPuesto: pefDestino });
            // Lo que no viaja se queda en la Cosedora de origen; si no, se perdería del plan.
            if (!splitRemaindersPorPuesto.has(pefOrigen)) splitRemaindersPorPuesto.set(pefOrigen, []);
            splitRemaindersPorPuesto.get(pefOrigen)!.push({ ...o, CANTIDAD: qty - fragmento, CANTPROGRAMADA: qty - fragmento, _isSplit: true, _originalCantidad: qty });
          }
        });
      });
    });

    return { excludeKeysPorPuesto, adjustedInPorPuesto, splitRemaindersPorPuesto, sinCascada };
  }, [acolchadoAsignacionOptima, acolchadoTapasIndexCombinado, acolchadoCelulasAjusteActivas, getSuffixCelula, getPefDeCelula, mapToHojaRutaInternal, techFilteredOrdenes, normalizeMaterialCode, tapaOrdenesBloqueadasPorPuesto]);

  // Resuelve contra SAP las Tapas de las células cuyo Acolchado se movió, para que la cascada NO
  // dependa de la explosión de Nivel 3 de otra pestaña. Se explotan solo las Tapas de la Cosedora
  // de ORIGEN (un puñado, no el catálogo entero) y el resultado queda cacheado por material.
  useEffect(() => {
    const origenes = new Set<string>();
    acolchadoAsignacionOptima.piezas.forEach(p => {
      if (p.puestoFinal === p.puestoNatural) return;
      // Mismo criterio que la cascada: origen O destino activos.
      if (!acolchadoCelulasAjusteActivas.has(p.puestoNatural) && !acolchadoCelulasAjusteActivas.has(p.puestoFinal)) return;
      const suffix = getSuffixCelula(p.puestoNatural);
      const pef = suffix ? getPefDeCelula(suffix) : undefined;
      if (pef) origenes.add(pef);
    });
    if (origenes.size === 0) return;
    const materialesTapa = new Set<string>();
    origenes.forEach(pef => {
      const hr = mapToHojaRutaInternal(pef).trim().toUpperCase();
      techFilteredOrdenes.forEach(o => {
        if (String(o['MAQUINA'] || o['Maquina'] || '').trim().toUpperCase() !== hr) return;
        const mat = String(o['MATERIAL'] || o['CodMaterial'] || '').trim();
        if (mat) materialesTapa.add(mat);
      });
    });
    materialesTapa.forEach(mat => { void resolverRatioTapaAcolchado(mat); });
  }, [acolchadoAsignacionOptima, acolchadoCelulasAjusteActivas, getSuffixCelula, getPefDeCelula, mapToHojaRutaInternal, techFilteredOrdenes, resolverRatioTapaAcolchado]);

  // Por puesto candidato de Acolchado & Tapas: qué órdenes NO caben en NINGUNA máquina elegible tras
  // el motor de asignación óptima (nunca basta con el % — el usuario debe ver material/nombre/
  // cantidad exacta de lo que no se fabricará). A diferencia del viejo cálculo por puesto aislado,
  // el exceso aquí ya viene garantizado como "agotó todos los candidatos elegibles", no solo "no
  // cupo en esta máquina en particular habiendo espacio en otra".
  const acolchadoExcesoPorPuesto = useMemo(() => {
    const map = new Map<string, { excessOrders: any[]; excessHours: number; utilizacionReal: number; cap: number }>();
    const puestos = new Set<string>();
    ajusteAcolchadoMateriales.forEach(m => m.candidatos.forEach(c => puestos.add(c.puesto)));

    const excesoPorPuesto = new Map<string, any[]>();
    acolchadoAsignacionOptima.exceso.forEach(e => {
      if (!excesoPorPuesto.has(e.puestoNatural)) excesoPorPuesto.set(e.puestoNatural, []);
      excesoPorPuesto.get(e.puestoNatural)!.push({ ...e.order, CANTIDAD: e.cantidad, CANTPROGRAMADA: e.cantidad, NOMBRE: e.nombre });
    });

    puestos.forEach(puesto => {
      const cap = acolchadoAsignacionOptima.capacidadPorPuesto.get(puesto) ?? 0;
      const restante = acolchadoAsignacionOptima.capacidadRestantePorPuesto.get(puesto) ?? cap;
      const excessOrders = excesoPorPuesto.get(puesto) || [];
      const excessHours = excessOrders.reduce((s, o) => s + calculateProductionTime(o['MATERIAL'] || o['CodMaterial'] || '', Number(o['CANTIDAD'] || 0), o) / 3600, 0);
      const utilizacionReal = cap > 0 ? ((cap - restante) / cap) * 100 : 0;
      map.set(puesto, { excessOrders, excessHours, utilizacionReal, cap });
    });
    return map;
  }, [ajusteAcolchadoMateriales, acolchadoAsignacionOptima, calculateProductionTime]);

  const [acolchadoAceptadoPuestos, setAcolchadoAceptadoPuestos] = useState<Set<string>>(new Set());

  // Igual patrón que Corte/Bordadora (isCorteAdjustActive/isBordBandAdjustActive): por defecto se
  // ven las órdenes ORIGINALES, sin ningún movimiento — el motor por versión solo se aplica/muestra
  // cuando el usuario lo activa. A diferencia de Corte/Bordadora, acá es POR CÉLULA (un botón
  // "Ajustar" independiente por acolchadora, ver render) y no un único interruptor para las 7 a la
  // vez — así se puede activar solo la célula que interesa (ej. una máquina apagada) sin mover de
  // paso la producción de las demás. El motor (`acolchadoAsignacionOptima`) siempre se calcula
  // completo para las 7 células; este set solo controla cuáles se MUESTRAN ya ajustadas.
  const handleToggleAjusteAcolchadoCelula = useCallback((achPuesto: string) => {
    setAcolchadoCelulasAjusteActivas(prev => {
      const next = new Set(prev);
      if (next.has(achPuesto)) {
        next.delete(achPuesto);
        setAcolchadoAceptadoPuestos(p => { const s = new Set(p); s.delete(achPuesto); return s; });
        setPlanFinalOrders(prevOrders => prevOrders.filter(o => o._source !== `acolchado-${achPuesto}`));
        const suffix = getSuffixCelula(achPuesto);
        const pefPuesto = suffix ? getPefDeCelula(suffix) : undefined;
        if (pefPuesto) {
          setTapaAceptadoPuestos(p => { const s = new Set(p); s.delete(pefPuesto); return s; });
          setPlanFinalOrders(prevOrders => prevOrders.filter(o => o._source !== `tapa-${pefPuesto}`));
        }
      } else {
        next.add(achPuesto);
      }
      return next;
    });
  }, [getSuffixCelula, getPefDeCelula]);

  // Aceptar por célula (mismo patrón que acceptGroupAdjust): arma la lista final de órdenes de
  // ESE puesto (originales menos las movidas fuera, más remanentes de split, más las que entraron)
  // y la envía a Plan Final bajo su propio `_source`, sin tocar las demás células.
  const handleAceptarAjusteAcolchadoPuesto = useCallback((puesto: string) => {
    setAcolchadoAceptadoPuestos(prev => new Set([...prev, puesto]));
    // El mensaje debe decir exactamente lo que se guardó: si esta célula no tiene el ajuste
    // activo, no se redistribuyó nada — va el plan original tal cual.
    if (!acolchadoCelulasAjusteActivas.has(puesto)) {
      addNotification('success', `Plan ORIGINAL de ${puesto} aceptado sin ajuste (tal como está hoy en SAP). Ver pestaña Plan Final.`);
      return;
    }
    const excludeKeys = acolchadoExcludeKeysPorPuesto.get(puesto) || new Set<string>();
    const adjustedIn = acolchadoAdjustedInPorPuesto.get(puesto) || [];
    const movimientos = adjustedIn.length + excludeKeys.size;
    addNotification('success', `Ajuste aceptado para ${puesto}: ${movimientos} orden(es) redistribuida(s). Ver pestaña Plan Final.`);
  }, [acolchadoCelulasAjusteActivas, acolchadoExcludeKeysPorPuesto, acolchadoAdjustedInPorPuesto, addNotification]);

  // Mantiene el Plan Final de cada célula ya aceptada SINCRONIZADO con el estado vigente del
  // ajuste (incluye bloqueos manuales de Tapa, que cambian la compuerta de capacidad y por lo
  // tanto pueden mover qué se le asigna a esta célula) — si el usuario bloquea/desbloquea una
  // orden de Tapa DESPUÉS de haber aceptado, este efecto reconstruye y reemplaza las filas de esa
  // célula en Plan Final automáticamente, sin necesitar volver a presionar "Aceptar".
  useEffect(() => {
    if (acolchadoAceptadoPuestos.size === 0) return;
    const mk = (o: any) => `${o['ORDEN'] || o['ORDENPREVISIONAL'] || ''}|${String(o['MATERIAL'] || o['CodMaterial'] || '')}|${String(o['CANTIDAD'] || o['CANTPROGRAMADA'] || '')}`;
    // Retiro automático de "aceptado": el motor SIEMPRE calcula qué se mueve de una célula a otra
    // (haya o no ajuste activo aquí, ver comentario más abajo). Si una célula YA aceptada queda con
    // producción movida hacia otra (ej. se apagó la máquina en Personal y Turnos DESPUÉS de haber
    // aceptado) pero su propio "Ajustar por Versión" sigue apagado, Plan Final le mandaría la
    // producción ORIGINAL completa — duplicada con la porción que la célula destino ya recibió y
    // aceptó por su cuenta. Se retira sola de "aceptado" (nunca queda un plan peligroso vigente en
    // Plan Final) y se avisa para que el usuario active el ajuste y vuelva a aceptar a propósito.
    const puestosRiesgoDuplicado: string[] = [];
    acolchadoAceptadoPuestos.forEach(puesto => {
      const ajusteActivo = acolchadoCelulasAjusteActivas.has(puesto);
      const excludeSiempre = acolchadoExcludeKeysPorPuesto.get(puesto);
      if (!ajusteActivo && excludeSiempre && excludeSiempre.size > 0) puestosRiesgoDuplicado.push(puesto);
    });
    if (puestosRiesgoDuplicado.length > 0) {
      setAcolchadoAceptadoPuestos(prev => {
        const next = new Set(prev);
        puestosRiesgoDuplicado.forEach(p => next.delete(p));
        return next;
      });
      addNotification('error', `Se retiró de Plan Final el plan de ${puestosRiesgoDuplicado.join(', ')}: el motor movió su producción a otra célula pero su "Ajustar por Versión" seguía apagado. Actívalo y vuelve a aceptar para no duplicar producción.`);
    }
    setPlanFinalOrders(prev => {
      let next = prev;
      acolchadoAceptadoPuestos.forEach(puesto => {
        const source = `acolchado-${puesto}`;
        if (puestosRiesgoDuplicado.includes(puesto)) {
          next = next.filter(o => o._source !== source);
          return;
        }
        const hr = mapToHojaRutaInternal(puesto).trim().toUpperCase();
        const hojaSinPrefijo = hr.replace(/^HR-/, '');
        // El motor calcula SIEMPRE las 7 células, pero solo debe aplicarse a las que el usuario
        // activó con "Ajustar por Versión". Si esta célula NO está ajustada, a Plan Final van sus
        // órdenes ORIGINALES tal cual: sin exclusiones, sin órdenes entrantes de otra célula y sin
        // remanentes de split. Antes se usaban los mapas del motor aunque el ajuste estuviera
        // apagado, así que aceptar "sin ajuste" mandaba un plan redistribuido y descuadraba.
        const ajusteActivo = acolchadoCelulasAjusteActivas.has(puesto);
        const excludeKeys = ajusteActivo ? (acolchadoExcludeKeysPorPuesto.get(puesto) || new Set<string>()) : new Set<string>();
        const adjustedIn = ajusteActivo ? (acolchadoAdjustedInPorPuesto.get(puesto) || []) : [];
        const splitRemainders = ajusteActivo ? (acolchadoSplitRemaindersPorPuesto.get(puesto) || []) : [];
        // Versión de Fabricación para Plan Final (columna PROD_VERS): la del material en ESTA
        // máquina (todas las filas de este puesto terminan asignadas aquí, se movieran o no).
        const getVersion = (o: any) => {
          const mat = normalizeMaterialCode(o['MATERIAL'] || o['CodMaterial'] || '');
          return versionPorMaterialAjusteAcolchado.get(mat)?.get(hojaSinPrefijo)?.texto;
        };
        // `techFilteredOrdenesParaAcolchado` (no la cruda) — ya trae la cantidad de Acolchado
        // GARANTIZADA como múltiplo exacto de Tapa real cuando aplica (ver `acolchadoTapaDemandaPorCelula`);
        // usar la cruda aquí volvería a sumar el original de SAP sin corregir junto al corregido.
        const orig = techFilteredOrdenesParaAcolchado.filter(o => String(o['MAQUINA'] || o['Maquina'] || '').trim().toUpperCase() === hr);
        // La cantidad que va a Plan Final debe ser la MISMA que muestra la tarjeta: si una Tapa fue
        // bloqueada, su Acolchado ya aparece descontado en pantalla (`acolchadoQtyOverridePorOrden`)
        // y ese descuento tiene que viajar al plan, o se exporta más de lo que se va a fabricar.
        const aplicarDescuento = (o: any) => {
          const nueva = acolchadoQtyOverridePorOrden.get(mk(o));
          return nueva === undefined ? o : { ...o, CANTIDAD: nueva, CANTPROGRAMADA: nueva };
        };
        const finalOrdsRaw = [
          ...orig
            .filter(o => !excludeKeys.has(mk(o)) && !acolchadoBloqueadasKeysGlobal.has(mk(o)))
            .map(aplicarDescuento)
            .filter(o => Number(o['CANTIDAD'] || o['CANTPROGRAMADA'] || 0) > 0.001)
            .map(o => ({ ...o, _finalHR: hr, _wasAdjusted: false, _source: source, _prodVersion: getVersion(o) })),
          ...splitRemainders.map(o => ({ ...o, _finalHR: hr, _wasAdjusted: false, _isSplit: true, _source: source, _prodVersion: getVersion(o) })),
          ...adjustedIn.map(o => ({ ...o, _finalHR: hr, _wasAdjusted: true, _source: source, _prodVersion: getVersion(o) })),
        ];
        // Si el usuario activó "Consolidar Carga de Acolchado" (isAchConsolidated), la vista ya
        // muestra una sola fila por material — Plan Final debe reflejar exactamente eso: una sola
        // orden consolidada por material para este puesto, no las órdenes crudas individuales.
        const finalOrds = isAchConsolidated
          ? Array.from(
              finalOrdsRaw.reduce((map, o) => {
                const mat = normalizeMaterialCode(o['MATERIAL'] || o['CodMaterial'] || '');
                const qty = Number(o['CANTIDAD'] || o['CANTPROGRAMADA'] || 0);
                const existing = map.get(mat);
                if (existing) {
                  existing['CANTIDAD'] = Number(existing['CANTIDAD'] || 0) + qty;
                  existing._wasAdjusted = existing._wasAdjusted || o._wasAdjusted;
                } else {
                  map.set(mat, { ...o, CANTIDAD: qty, _isConsolidated: true });
                }
                return map;
              }, new Map<string, any>()).values()
            )
          : finalOrdsRaw;
        next = [...next.filter(o => o._source !== source), ...finalOrds];
      });
      return next;
    });
  }, [acolchadoAceptadoPuestos, acolchadoCelulasAjusteActivas, acolchadoExcludeKeysPorPuesto, acolchadoAdjustedInPorPuesto, acolchadoSplitRemaindersPorPuesto, mapToHojaRutaInternal, techFilteredOrdenesParaAcolchado, normalizeMaterialCode, versionPorMaterialAjusteAcolchado, acolchadoBloqueadasKeysGlobal, acolchadoQtyOverridePorOrden, isAchConsolidated, addNotification]);

  // ─── Aceptar Plan de Tapa/Cosedora (COSEDORA-ACHXX) — igual patrón que Acolchado ───────
  // Antes, la Tapa/Cosedora nunca tenía forma de llegar a Plan Final (solo Acolchado la tenía).
  // Aquí también se acepta SIEMPRE (haya o no cascada de Acolchado), para que el plan natural de
  // esa Cosedora también pueda mandarse a Plan Final.
  const [tapaAceptadoPuestos, setTapaAceptadoPuestos] = useState<Set<string>>(new Set());
  const handleAceptarPlanTapaPuesto = useCallback((puesto: string) => {
    setTapaAceptadoPuestos(prev => new Set([...prev, puesto]));
    addNotification('success', `Plan aceptado para ${puesto}. Ver pestaña Plan Final.`);
  }, [addNotification]);

  // Igual que el efecto de Acolchado: mantiene sincronizadas las Cosedoras ya aceptadas con el
  // estado vigente (cascada de Acolchado + bloqueos manuales), sin necesitar volver a "Aceptar".
  useEffect(() => {
    if (tapaAceptadoPuestos.size === 0) return;
    const mk = (o: any) => `${o['ORDEN'] || o['ORDENPREVISIONAL'] || ''}|${String(o['MATERIAL'] || o['CodMaterial'] || '')}|${String(o['CANTIDAD'] || o['CANTPROGRAMADA'] || '')}`;
    setPlanFinalOrders(prev => {
      let next = prev;
      tapaAceptadoPuestos.forEach(puesto => {
        const hr = mapToHojaRutaInternal(puesto).trim().toUpperCase();
        const excludeKeys = tapaCascadaDesdeAcolchado.excludeKeysPorPuesto.get(puesto) || new Set<string>();
        const adjustedIn = tapaCascadaDesdeAcolchado.adjustedInPorPuesto.get(puesto) || [];
        // Parte de una orden partida que se queda acá: sin esto, esas unidades no llegan a Plan
        // Final (la orden entera fue excluida del origen y solo viajó el fragmento).
        const splitRemainders = tapaCascadaDesdeAcolchado.splitRemaindersPorPuesto.get(puesto) || [];
        const bloqueadas = tapaOrdenesBloqueadasPorPuesto.get(puesto) || new Set<string>();
        const source = `tapa-${puesto}`;
        const orig = techFilteredOrdenes.filter(o => String(o['MAQUINA'] || o['Maquina'] || '').trim().toUpperCase() === hr);
        // También se filtran las `adjustedIn`: una orden que llegó por cascada se muestra en esta
        // Cosedora con su candado, así que si el usuario la bloquea acá tampoco debe exportarse.
        const finalOrds = [
          ...orig.filter(o => !excludeKeys.has(mk(o)) && !bloqueadas.has(mk(o))).map(o => ({ ...o, _finalHR: hr, _wasAdjusted: false, _source: source })),
          ...splitRemainders.filter(o => !bloqueadas.has(mk(o))).map(o => ({ ...o, _finalHR: hr, _wasAdjusted: false, _isSplit: true, _source: source })),
          ...adjustedIn.filter(o => !bloqueadas.has(mk(o))).map(o => ({ ...o, _finalHR: hr, _wasAdjusted: true, _source: source })),
        ];
        next = [...next.filter(o => o._source !== source), ...finalOrds];
      });
      return next;
    });
  }, [tapaAceptadoPuestos, tapaCascadaDesdeAcolchado, tapaOrdenesBloqueadasPorPuesto, mapToHojaRutaInternal, techFilteredOrdenes]);

  // ─── Aceptar Plan de Forros Finales (FORRO / FBASE) ───────────────────────
  // Esta pestaña no tiene motor de ajuste (cada puesto produce lo suyo, no hay redistribución),
  // pero igual necesita poder mandar su plan a Plan Final — antes era la única que no tenía forma
  // de hacerlo. Se acepta por máquina y se respetan las órdenes bloqueadas con el candado.
  const [forrosAceptadoPuestos, setForrosAceptadoPuestos] = useState<Set<string>>(new Set());
  const handleAceptarPlanForros = useCallback((puesto: string) => {
    const yaAceptado = forrosAceptadoPuestos.has(puesto);
    setForrosAceptadoPuestos(prev => {
      const next = new Set(prev);
      if (yaAceptado) next.delete(puesto); else next.add(puesto);
      return next;
    });
    if (yaAceptado) {
      setPlanFinalOrders(prevOrders => prevOrders.filter(o => o._source !== `forros-${puesto}`));
      addNotification('info', `Plan de ${puesto} retirado de Plan Final.`);
    } else {
      addNotification('success', `Plan aceptado para ${puesto}. Ver pestaña Plan Final.`);
    }
  }, [forrosAceptadoPuestos, addNotification]);

  useEffect(() => {
    if (forrosAceptadoPuestos.size === 0) return;
    const mk = (o: any) => `${o['ORDEN'] || o['ORDENPREVISIONAL'] || ''}|${String(o['MATERIAL'] || o['CodMaterial'] || '')}|${String(o['CANTIDAD'] || o['CANTPROGRAMADA'] || '')}`;
    setPlanFinalOrders(prev => {
      let next = prev;
      forrosAceptadoPuestos.forEach(puesto => {
        const hr = mapToHojaRutaInternal(puesto).trim().toUpperCase();
        // Mismo criterio de match que MachineCard: una hoja de ruta puede venir combinada ("A / B").
        const codigos = hr.includes(' / ') ? hr.split(' / ').map(c => c.trim().toUpperCase()) : [hr];
        const bloqueadas = ordenesBloqueadasPorPuesto.get(puesto) || new Set<string>();
        const source = `forros-${puesto}`;
        const finalOrds = techFilteredOrdenes
          .filter(o => codigos.includes(String(o['MAQUINA'] || o['Maquina'] || '').trim().toUpperCase()))
          .filter(o => !bloqueadas.has(mk(o)))
          .map(o => ({ ...o, _finalHR: hr, _wasAdjusted: false, _source: source }));
        next = [...next.filter(o => o._source !== source), ...finalOrds];
      });
      return next;
    });
  }, [forrosAceptadoPuestos, ordenesBloqueadasPorPuesto, mapToHojaRutaInternal, techFilteredOrdenes]);

  const renderDateFilterHeaderInternal = () => renderDateFilterHeader(techStartDate, setTechStartDate, techEndDate, setTechEndDate);

  // ─── PLAN FINAL: exportación a Excel/TXT en formato SAP ──────────────────
  // CENTRO (WERKS) y TIPO DE ORDEN (AUART) son fijos para todo Plan Final: se determinan por
  // el grupo Forros (codigo_grupo 2) — el centro del propio grupo y la restricción TIPO_ORDEN ya
  // creada para ese grupo, que aplica igual a todas las órdenes exportadas.
  const planFinalCentro = useMemo(() => (
    forrosGruposList.find(g => g.codigo_grupo === 2)?.centro || '1000'
  ), [forrosGruposList]);

  const planFinalTipoOrden = useMemo(() => (
    restricciones.find(r => r.nombre_restriccion.toUpperCase().trim() === 'TIPO_ORDEN' && r.codigo_grupo === 2)?.valor_restriccion || ''
  ), [restricciones]);

  // MANDT (mandante SAP) es un valor fijo institucional, no algo que varíe por orden — se administra
  // como restricción (mismo patrón que TIPO_ORDEN) para no hardcodearlo ni construir una UI nueva.
  const planFinalMandt = useMemo(() => (
    restricciones.find(r => r.nombre_restriccion.toUpperCase().trim() === 'VALOR_MANDT' && r.codigo_grupo === 2)?.valor_restriccion || ''
  ), [restricciones]);

  // Fecha para la que se está planificando (la misma para FECHA INICIO y FECHA FIN en todas las
  // filas), en formato SAP DD.MM.YYYY.
  const formatFechaSAP = useCallback((fechaISO: string) => {
    if (!fechaISO) return '';
    const [y, m, d] = fechaISO.split('-');
    if (!y || !m || !d) return '';
    return `${d}.${m}.${y}`;
  }, []);

  // Respaldo de Versión de Fabricación para Plan Final: los grupos con ajuste por versión
  // (Acolchado & Tapas, Bandas, RMTB) ya etiquetan cada orden con `_prodVersion` al aceptar. Los
  // grupos que NO pasan por ese ajuste (Interiores & Corte, Bordadora/Cosedoras de Banda, etc.)
  // nunca la calculan — sin esto, esas filas salían con PROD_VERS vacío y SAP rechaza la carga.
  // Se consulta 1 sola vez por material faltante (SIEMPRE el centro 1000, igual que el resto del
  // ajuste por versión) y se cruza por `_finalHR` (la máquina donde la orden queda finalmente).
  const [versionPorMaterialPlanFinal, setVersionPorMaterialPlanFinal] = useState<Map<string, Map<string, VersionInfo>>>(new Map());

  useEffect(() => {
    const faltantes = planFinalOrders.filter(o => o._prodVersion === undefined || o._prodVersion === null || o._prodVersion === '');
    const materiales = Array.from(new Set(faltantes.map(o => normalizeMaterialCode(o['MATERIAL'] || o['CodMaterial'] || '')))).filter(Boolean);
    if (materiales.length === 0) {
      setVersionPorMaterialPlanFinal(new Map());
      return;
    }
    let cancelled = false;
    (async () => {
      try {
        const datosPorMaterial = await fetchVersionesPorMaterial(materiales);
        const resultado = new Map<string, Map<string, VersionInfo>>();
        const sinVersion: string[] = [];
        materiales.forEach(material => {
          const porHoja = new Map<string, VersionInfo>();
          (datosPorMaterial.get(material) || []).forEach((v: any) => {
            const hoja = String(v.GRUPOHOJARUTA || '').trim().toUpperCase().replace(/^HR-/, '');
            // Se conserva el texto EXACTO de SAP (puede venir "1" o "01") para Plan Final/PROD_VERS;
            // `numero` es solo para decidir cuál candidato es la versión preferida (menor = mejor).
            const textoVersion = String(v.VERSION || '').trim();
            const numero = parseInt(textoVersion, 10);
            if (hoja && textoVersion && !isNaN(numero)) porHoja.set(hoja, { numero, texto: textoVersion });
          });
          if (porHoja.size === 0) sinVersion.push(material);
          resultado.set(material, porHoja);
        });
        if (!cancelled) {
          setVersionPorMaterialPlanFinal(resultado);
          if (sinVersion.length > 0) {
            addNotification('warning', `${sinVersion.length} material${sinVersion.length === 1 ? '' : 'es'} en Plan Final sin Versión de Fabricación registrada en SAP (Centro 1000): ${sinVersion.join(', ')}. Revisar antes de cargar a SAP.`);
          }
        }
      } catch (error: any) {
        if (!cancelled) addNotification('error', `Error al consultar Versión de Fabricación para Plan Final: ${error.message}`);
      }
    })();
    return () => { cancelled = true; };
  }, [planFinalOrders, normalizeMaterialCode, fetchVersionesPorMaterial, addNotification]);

  const getProdVersionPlanFinal = useCallback((o: any): string | undefined => {
    if (o._prodVersion !== undefined && o._prodVersion !== null && o._prodVersion !== '') return o._prodVersion;
    const mat = normalizeMaterialCode(o['MATERIAL'] || o['CodMaterial'] || '');
    const hoja = String(o._finalHR || o['MAQUINA'] || o['Maquina'] || '').trim().toUpperCase().replace(/^HR-/, '');
    return versionPorMaterialPlanFinal.get(mat)?.get(hoja)?.texto;
  }, [normalizeMaterialCode, versionPorMaterialPlanFinal]);

  // Cuando el motor de Acolchado (`asignarOptimoPorVersion`) parte una orden entre varias máquinas,
  // cada pieza queda con una cantidad fraccionaria (kg/m², no unidades enteras) y cada fila de Plan
  // Final se redondea por separado al exportar/guardar. Redondear cada pieza de forma independiente
  // puede hacer que la SUMA de las piezas ya NO coincida con la cantidad original de la orden en SAP
  // — ej. una orden de 88 partida en 61.5 + 26.5 redondea a 62 + 27 = 89, o 61 + 26 = 87, nunca
  // exactamente 88. Esa es la diferencia contra SAP que reportó el usuario. Se corrige agrupando las
  // piezas por `_originalKey` (todas vienen de UNA misma orden) y aplicando redondeo por "mayor
  // residuo": se redondea cada pieza hacia abajo y la unidad faltante para llegar al total original
  // redondeado se reparte a las piezas con mayor parte decimal perdida — así la suma de las piezas
  // SIEMPRE cuadra exacto con la orden original de SAP. Las filas que no vienen de un split (sin
  // `_originalKey`, o solas en su grupo) no se tocan: su cantidad ya es la real de SAP.
  // Los materiales de un puesto se identifican por `_source`: cuáles son de unidad CONTINUA
  // (necesitan el decimal exacto) se centralizan en `esUnidadContinua`, para no repetir la lista en
  // dos sitios y quedar desincronizados otra vez (ver el bug de ACH11/ACH12 más abajo).
  // Verificado contra las órdenes previsionales reales: el campo UNIDAD solo trae tres valores —
  // 'ST' (Stück/unidad, discreta: tapas, RMTB, paneles...), 'M' (metros) y 'KG' (kilogramos). Antes
  // se adivinaba por `_source` (¿viene del grupo Acolchado o Bandas?), y eso fallaba en los dos
  // sentidos: ACH07 es Acolchado pero su unidad real es 'ST' (se redondeaba a decimales sin
  // necesitarlo), y quedaban afuera COS3D/ENCINTADOBD/BO01 (Bordadora y Cosedoras de Banda) y la
  // porción CTBAN de Corte y CORTE-ESPUMA, que también son 'M'/'KG' y SÍ necesitan decimales. La
  // unidad real de SAP (no el grupo de la pestaña) es la única fuente confiable de esto.
  const esUnidadContinua = useCallback((o: any): boolean => {
    const unidad = String(o['UNIDAD'] || o['Unidad'] || '').trim().toUpperCase();
    return unidad === 'M' || unidad === 'KG';
  }, []);

  // Redondeo a ENTERO por "mayor residuo" — solo tiene sentido para materiales de unidad discreta
  // (UNIDAD = 'ST': tapas, RMTB, paneles... nunca "1.5 tapas"). Los de unidad continua ('M'/'KG' —
  // ver `esUnidadContinua`) se excluyen de este mapa: necesitan el valor EXACTO con decimales,
  // redondearlo a entero le quita precisión real que SAP sí necesita.
  const planFinalCantidadCorregidaPorFila = useMemo(() => {
    const map = new Map<any, number>();
    const porOriginalKey = new Map<string, any[]>();
    planFinalOrders.forEach(o => {
      if (esUnidadContinua(o)) return;
      const key = o._originalKey;
      if (!key) return;
      if (!porOriginalKey.has(key)) porOriginalKey.set(key, []);
      porOriginalKey.get(key)!.push(o);
    });
    porOriginalKey.forEach(filas => {
      if (filas.length < 2) return;
      const totalOriginal = Number(filas[0]._originalCantidad ?? NaN);
      if (!(totalOriginal > 0)) return;
      const objetivo = Math.round(totalOriginal);
      const cantidades = filas.map(o => Number(o['CANTIDAD'] || o['CANTPROGRAMADA'] || 0));
      const pisos = cantidades.map(q => Math.floor(q));
      const restos = cantidades.map((q, i) => q - pisos[i]);
      let faltante = objetivo - pisos.reduce((a, b) => a + b, 0);
      const ordenPorResiduo = filas.map((_, i) => i).sort((a, b) => restos[b] - restos[a]);
      const ajustadas = [...pisos];
      for (let i = 0; i < ordenPorResiduo.length && faltante > 0; i++) { ajustadas[ordenPorResiduo[i]] += 1; faltante--; }
      filas.forEach((o, i) => map.set(o, ajustadas[i]));
    });
    return map;
  }, [planFinalOrders, esUnidadContinua]);

  const getCantidadFinalCorregida = useCallback((o: any): number => {
    // Unidad continua (Acolchado, Bandas): NUNCA se redondea a entero — se exporta el valor exacto
    // con decimales (limpiando solo el ruido de punto flotante propio de la cuantización, ej.
    // 55.999999999998 → 56.0, o 45.7 se queda en 45.7, no en 46).
    if (esUnidadContinua(o)) {
      const raw = Number(o['CANTIDAD'] || o['CANTPROGRAMADA'] || 0);
      return Math.round(raw * 1000) / 1000;
    }
    const corregida = planFinalCantidadCorregidaPorFila.get(o);
    return corregida !== undefined ? corregida : Math.round(Number(o['CANTIDAD'] || o['CANTPROGRAMADA'] || 0));
  }, [planFinalCantidadCorregidaPorFila, esUnidadContinua]);

  // Estructura fija de la interfaz Z de SAP para Plan Final (23 campos). Los últimos 8
  // (OBSERVACION..USUARIO) los llena el proceso de carga en SAP, no esta app — se exportan en
  // blanco como columnas de la interfaz, nunca se omiten (SAP espera la posición fija).
  const PLAN_FINAL_EXPORT_COLUMNS = [
    'MANDT', 'COD_ORDEN', 'AUART', 'WERKS', 'PLNBEZ', 'GAMNG', 'VERID', 'ARBPL',
    'GSTRS', 'GSUZS', 'GLTRS', 'GLUZS', 'KDAUF', 'KDPOS', 'ESTATUS_REG_ORD',
    'OBSERVACION', 'FECHA_CARGA', 'HORA_CARGA', 'ESTATUS_CARGA', 'AUFNR',
    'FECHA_PROCESO', 'HORA_PROCESO', 'USUARIO',
  ] as const;

  // Fecha del DÍA PARA EL QUE SE PLANIFICA, no la de hoy. Es la misma que ya usa el guardado en
  // base del Plan Final (`recuperacionFechasCalculadas.n2n3` = generación del P1 + FECHA_N2N3 días
  // hábiles, saltando fin de semana y feriados). Antes la exportación usaba `techStartDate`, que
  // por defecto arranca en HOY, así que el Excel/TXT salía con la fecha de generación y no con la
  // de producción — y encima quedaba distinto de lo guardado en base. `techStartDate` queda solo
  // como respaldo si todavía no se eligió la fecha del P1 en "Recuperación Pasos P1-P3".
  const planFinalFechaPlanificada = recuperacionFechasCalculadas?.n2n3 || techStartDate;

  // HORA INICIO/FIN (GSUZS/GLUZS) van fijas en "00:00" para todas las filas (confirmado por el
  // usuario) — Forros no planifica a nivel de hora, solo de día. KDAUF/KDPOS (pedido comercial)
  // van en blanco: Forros es make-to-stock, no contra pedido. ESTATUS_REG_ORD siempre "1".
  const planFinalExportRows = useMemo(() => {
    const fecha = formatFechaSAP(planFinalFechaPlanificada);
    return planFinalOrders.map((o, idx) => ({
      MANDT: planFinalMandt,
      COD_ORDEN: String(idx + 1),
      AUART: planFinalTipoOrden,
      WERKS: planFinalCentro,
      PLNBEZ: normalizeMaterialCode(o['MATERIAL'] || o['CodMaterial'] || ''),
      GAMNG: getCantidadFinalCorregida(o),
      VERID: getProdVersionPlanFinal(o) ?? '',
      ARBPL: String(o._finalHR || o['MAQUINA'] || o['Maquina'] || ''),
      GSTRS: fecha,
      GSUZS: '00:00',
      GLTRS: fecha,
      GLUZS: '00:00',
      KDAUF: '',
      KDPOS: '',
      ESTATUS_REG_ORD: '1',
      OBSERVACION: '',
      FECHA_CARGA: '',
      HORA_CARGA: '',
      ESTATUS_CARGA: '',
      AUFNR: '',
      FECHA_PROCESO: '',
      HORA_PROCESO: '',
      USUARIO: '',
    }));
  }, [planFinalOrders, planFinalMandt, planFinalCentro, planFinalTipoOrden, planFinalFechaPlanificada, formatFechaSAP, normalizeMaterialCode, getProdVersionPlanFinal, getCantidadFinalCorregida]);

  const handleDescargarPlanFinalExcel = useCallback(() => {
    if (planFinalExportRows.length === 0) return;
    // Igual que handleGuardarPlanFinal: sin recuperacionFechasCalculadas.n2n3 no se exporta con
    // el respaldo `techStartDate` (hoy) — eso fue exactamente el bug reportado (Excel/TXT salían
    // con la fecha de hoy en vez de la fecha de planificación cuando esta aún no se había resuelto).
    if (!recuperacionFechasCalculadas?.n2n3) {
      addNotification('warning', 'No se pudo determinar la fecha del plan — selecciona la fecha del P1 en la pestaña "Recuperación Pasos P1-P3".');
      return;
    }
    const worksheet = XLSX.utils.json_to_sheet(planFinalExportRows, { header: PLAN_FINAL_EXPORT_COLUMNS as unknown as string[] });
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, 'PlanFinal');
    XLSX.writeFile(workbook, `PlanFinal_${planFinalFechaPlanificada}.xlsx`);
  }, [planFinalExportRows, planFinalFechaPlanificada, recuperacionFechasCalculadas, addNotification]);

  const handleDescargarPlanFinalTxt = useCallback(() => {
    if (planFinalExportRows.length === 0) return;
    if (!recuperacionFechasCalculadas?.n2n3) {
      addNotification('warning', 'No se pudo determinar la fecha del plan — selecciona la fecha del P1 en la pestaña "Recuperación Pasos P1-P3".');
      return;
    }
    const lineas = [
      PLAN_FINAL_EXPORT_COLUMNS.join('\t'),
      ...planFinalExportRows.map(r => PLAN_FINAL_EXPORT_COLUMNS.map(col => String(r[col] ?? '')).join('\t')),
    ];
    const blob = new Blob([lineas.join('\r\n')], { type: 'text/plain;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `PlanFinal_${planFinalFechaPlanificada}.txt`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }, [planFinalExportRows, planFinalFechaPlanificada, recuperacionFechasCalculadas, addNotification]);

  // ─── PLAN FINAL: guardar en base como "PFM - FINAL" ──────────────────────
  // Guarda TODAS las órdenes de Plan Final (Acolchado & Tapas + Bandas + Interiores & Corte +
  // Forros Finales) como un único plan_grupo del grupo Forros (codigo_grupo 2, centro 1000 —
  // no existen órdenes de centro 2000 para este flujo). A diferencia de los demás planes, acá
  // se guarda una fila de detalle POR ORDEN (no agregado por material) para no perder el
  // desglose de las 165 órdenes, y se usa el campo `linea_produccion` (ya soportado por el
  // backend, ver otros usos de item.linea_produccion en este archivo) para conservar la máquina
  // asignada a cada una — el Excel/TXT de exportación siguen tomando los datos en vivo de la
  // sesión (planFinalExportRows), sin cambios, así que su formato no se ve afectado por esto.
  // Fecha: generación del P1 + 1 día hábil (misma fecha que ya usa Acolchado & Tapas — fechaN2N3
  // / recuperacionFechasCalculadas.n2n3), no un rango.
  const [isGuardandoPlanFinal, setIsGuardandoPlanFinal] = useState(false);
  const [confirmGuardarPlanFinalOpen, setConfirmGuardarPlanFinalOpen] = useState(false);
  const [planFinalExistente, setPlanFinalExistente] = useState<PlanGrupo[] | null>(null);
  const [planFinalGuardado, setPlanFinalGuardado] = useState(false);

  const ejecutarGuardadoPlanFinal = useCallback(async (planesADesactivar: PlanGrupo[]) => {
    const fecha = recuperacionFechasCalculadas?.n2n3;
    if (!fecha) return;

    for (const plan of planesADesactivar) {
      await planGrupoService.save({ ...plan, estado: 'I' });
    }

    const todosPlanesResp = await planGrupoService.getAll();
    const referenciaGrupo2 = (todosPlanesResp.data || []).find((pg: PlanGrupo) => pg.codigo_grupo === 2 && pg.estado === 'A');
    const codigoPlan = referenciaGrupo2?.codigo_plan;
    if (!codigoPlan) {
      addNotification('warning', 'No se encontró un plan de referencia activo para el grupo Forros (centro 1000) — no se pudo determinar codigo_plan.');
      return;
    }

    const nuevoPlanGrupo: PlanGrupo = {
      codigo_plan_grupo: 0,
      codigo_plan: codigoPlan,
      codigo_grupo: 2,
      codigo_familia_grupo: 0,
      valor: `Plan Táctico - Centro ${planFinalCentro} - PFM - FINAL`,
      fecha_inicio_plan: new Date(fecha),
      fecha_fin_plan: new Date(fecha),
      estado: 'A',
      fecha_creacion: new Date(),
      usuario_creacion: 'admin',
    };
    const nuevoPlanGuardado = await planGrupoService.save(nuevoPlanGrupo);
    const codigoPlanGrupoNuevo = nuevoPlanGuardado.data?.codigo_plan_grupo;
    if (!codigoPlanGrupoNuevo) throw new Error('No se recibió codigo_plan_grupo al crear el Plan Final.');

    let detallesCreados = 0;
    for (const o of planFinalOrders) {
      // Cantidad ya compensada entre las piezas de una misma orden partida (ver
      // `planFinalCantidadCorregidaPorFila`), para que la suma cuadre exacto con SAP.
      const cantidad = getCantidadFinalCorregida(o);
      if (cantidad <= 0) continue;
      await detalleTacticoService.save({
        codigo_detalle_tactico: 0,
        codigo_plan_grupo: codigoPlanGrupoNuevo,
        codigo_material: Number(normalizeMaterialCode(o['MATERIAL'] || o['CodMaterial'] || '')),
        cantidad_produccion_neta: String(cantidad),
        resp_ctrl_prod: '',
        clase_aprovisionamiento: '',
        cantidad_aprovisionamiento: 0,
        estado: 'A',
        usuario_modificacion: '',
        linea_produccion: String(o._finalHR || o['MAQUINA'] || o['Maquina'] || ''),
        fecha_modificacion: new Date(),
      });
      detallesCreados++;
    }

    setPlanFinalGuardado(true);
    addNotification('success', `Plan Final guardado (PFM - FINAL): ${planesADesactivar.length} plan(es) anterior(es) desactivado(s), ${detallesCreados} orden(es) guardada(s).`);
  }, [recuperacionFechasCalculadas, planFinalCentro, planFinalOrders, addNotification, normalizeMaterialCode, getCantidadFinalCorregida]);

  const handleGuardarPlanFinal = useCallback(async () => {
    if (planFinalOrders.length === 0) {
      addNotification('warning', 'No hay órdenes en Plan Final para guardar.');
      return;
    }
    const fecha = recuperacionFechasCalculadas?.n2n3;
    if (!fecha) {
      addNotification('warning', 'No se pudo determinar la fecha del plan — selecciona la fecha del P1 en la pestaña "Recuperación Pasos P1-P3".');
      return;
    }
    setIsGuardandoPlanFinal(true);
    try {
      const todosPlanesResp = await planGrupoService.getAll();
      const todosPlanes = todosPlanesResp.data || [];
      const fechaLocal = (f: Date | string) => {
        const d = new Date(f);
        return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
      };
      const existentes = todosPlanes.filter((pg: PlanGrupo) =>
        pg.codigo_grupo === 2 &&
        pg.estado === 'A' &&
        PLAN_GRUPO_VALOR_REGEX_PFM_FINAL.test(String(pg.valor || '')) &&
        pg.fecha_inicio_plan && fechaLocal(pg.fecha_inicio_plan) === fecha
      );
      if (existentes.length > 0) {
        setPlanFinalExistente(existentes);
        setConfirmGuardarPlanFinalOpen(true);
        return;
      }
      await ejecutarGuardadoPlanFinal([]);
    } catch (error: any) {
      addNotification('error', `Error al guardar el Plan Final: ${error.message}`);
    } finally {
      setIsGuardandoPlanFinal(false);
    }
  }, [planFinalOrders, recuperacionFechasCalculadas, addNotification, ejecutarGuardadoPlanFinal]);

  const handleConfirmarGuardarPlanFinal = useCallback(async () => {
    if (!planFinalExistente) return;
    setIsGuardandoPlanFinal(true);
    try {
      await ejecutarGuardadoPlanFinal(planFinalExistente);
      setConfirmGuardarPlanFinalOpen(false);
      setPlanFinalExistente(null);
    } catch (error: any) {
      addNotification('error', `Error al guardar el Plan Final: ${error.message}`);
    } finally {
      setIsGuardandoPlanFinal(false);
    }
  }, [planFinalExistente, ejecutarGuardadoPlanFinal, addNotification]);

  // ─── ACOLCHADORA DE BANDAS (ACH11/ACH12): ajuste por Versión de Fabricación ──
  // Mismo criterio que Acolchado & Tapas — ya no se balancea por simple utilización. Materiales
  // "BANDA..." (no ACOLCHADO ni TAPA, aunque compartan máquina) con tiempo estándar registrado
  // en ACOLCHADORA11/12. Un solo botón para todo el grupo (no uno por máquina).
  const esPuestoBandasAcolchado = useCallback((puesto: string) => {
    const u = puesto.toUpperCase();
    return u.includes('ACOLCHADORA11') || u.includes('ACOLCHADORA12') || ((u.includes('ACH11') || u.includes('ACH12')) && !u.includes('COSEDORA'));
  }, []);

  const ajustePrevisionalBandasData = useMemo(() => {
    const map = new Map<string, number>();
    techFilteredOrdenes.forEach(o => {
      const matRaw = o['MATERIAL'] || o['CodMaterial'] || '';
      if (!matRaw) return;
      const mat = normalizeMaterialCode(matRaw);
      const nombreMaterial = materialNombrePorCodigo.get(mat) || '';
      if (!normalizeText(nombreMaterial).startsWith('BANDA')) return;
      const timesList: any[] = tiemposIndexRef.current[mat] || [];
      const esBandas = timesList.some((t: any) => esPuestoBandasAcolchado(String(t.PuestoTrabajo || t.nombre_estacion || t.Maquina || '').trim().toUpperCase()));
      if (!esBandas) return;
      const qty = Number(o['CANTIDAD'] || o['CANTPROGRAMADA'] || 0);
      map.set(mat, (map.get(mat) || 0) + qty);
    });
    return map;
  }, [techFilteredOrdenes, normalizeMaterialCode, esPuestoBandasAcolchado, materialNombrePorCodigo]);

  const ajusteBandasMateriales = useMemo<MaterialAcolchado[]>(() => {
    if (ajustePrevisionalBandasData.size === 0) return [];
    const getCapacidad = (puesto: string) => {
      const cfg = workstationConfigs[puesto] || { machine: puesto, isDayActive: true, isNightActive: false, isSaturdayActive: false, peopleDay: 0, peopleNight: 0, peopleWeekend: 0, machines: 1 };
      const capacidad = capacidadPuesto(puesto, cfg, horasNetasDiurnasVal, horasNetasNocturnasVal, horasNetasFinSemanaVal);
      return { cfg, capacidad };
    };
    const out: MaterialAcolchado[] = [];
    ajustePrevisionalBandasData.forEach((cantidadTotal, mat) => {
      if (cantidadTotal <= 0) return;
      const timesList: any[] = tiemposIndexRef.current[mat] || [];
      const candidatos = timesList
        .map(t => ({
          puesto: String(t.PuestoTrabajo || t.nombre_estacion || t.Maquina || '').trim().toUpperCase(),
          tiempoSegPorUnidad: Number(t.Tiempo || t.Tiempo_Min || 0) * 60,
        }))
        .filter(c => c.puesto && esPuestoBandasAcolchado(c.puesto) && c.tiempoSegPorUnidad > 0);
      if (candidatos.length === 0) return;
      out.push({
        material: mat,
        nombre: materialNombrePorCodigo.get(mat) || mat,
        cantidadTotal,
        qtyChn: cantidadTotal,
        qtyBase: 0,
        candidatos: candidatos.map(c => ({ ...c, ...getCapacidad(c.puesto) })),
      });
    });
    return out;
  }, [ajustePrevisionalBandasData, workstationConfigs, horasNetasDiurnasVal, horasNetasNocturnasVal, horasNetasFinSemanaVal, materialNombrePorCodigo, esPuestoBandasAcolchado]);

  const [versionPorMaterialAjusteBandas, setVersionPorMaterialAjusteBandas] = useState<Map<string, Map<string, VersionInfo>>>(new Map());

  useEffect(() => {
    if (ajusteBandasMateriales.length === 0) {
      setVersionPorMaterialAjusteBandas(new Map());
      return;
    }
    let cancelled = false;
    (async () => {
      try {
        const materiales = ajusteBandasMateriales.map(m => m.material);
        const datosPorMaterial = await fetchVersionesPorMaterial(materiales);
        const resultado = new Map<string, Map<string, VersionInfo>>();
        const sinVersion: string[] = [];
        materiales.forEach(material => {
          const porHoja = new Map<string, VersionInfo>();
          (datosPorMaterial.get(material) || []).forEach((v: any) => {
            const hoja = String(v.GRUPOHOJARUTA || '').trim().toUpperCase().replace(/^HR-/, '');
            // Se conserva el texto EXACTO de SAP (puede venir "1" o "01") para Plan Final/PROD_VERS;
            // `numero` es solo para decidir cuál candidato es la versión preferida (menor = mejor).
            const textoVersion = String(v.VERSION || '').trim();
            const numero = parseInt(textoVersion, 10);
            if (hoja && textoVersion && !isNaN(numero)) porHoja.set(hoja, { numero, texto: textoVersion });
          });
          if (porHoja.size === 0) sinVersion.push(material);
          resultado.set(material, porHoja);
        });
        if (!cancelled) {
          setVersionPorMaterialAjusteBandas(resultado);
          if (sinVersion.length > 0) {
            addNotification('warning', `${sinVersion.length} material${sinVersion.length === 1 ? '' : 'es'} de BANDA (Acolchadora 11/12) sin Versión de Fabricación registrada en SAP: ${sinVersion.join(', ')}.`);
          }
        }
      } catch (error: any) {
        if (!cancelled) addNotification('error', `Error al consultar Versión de Fabricación (Bandas): ${error.message}`);
      }
    })();
    return () => { cancelled = true; };
  }, [ajusteBandasMateriales, addNotification, fetchVersionesPorMaterial]);

  // Alternativas de ajuste (igual concepto que Acolchado & Tapas): 'optimo' llena primero la máquina
  // preferida por SAP, 'equilibrado' reparte hacia la que tenga más holgura relativa.
  const [modoAjusteBandas, setModoAjusteBandas] = useState<'optimo' | 'equilibrado'>('optimo');

  // Sin split: el usuario pidió no dividir órdenes entre ACOLCHADORA11/12 (estaba causando
  // problemas en planta) — una orden se mueve completa a un candidato o se queda como exceso,
  // nunca se fragmenta entre dos máquinas.
  const bandasAsignacionOptima = useMemo(
    () => asignarOptimoPorVersion(ajusteBandasMateriales, versionPorMaterialAjusteBandas, techFilteredOrdenes, modoAjusteBandas, false),
    [asignarOptimoPorVersion, ajusteBandasMateriales, versionPorMaterialAjusteBandas, techFilteredOrdenes, modoAjusteBandas]
  );

  const getProdVersionBandas = useCallback((material: string, puesto: string) => {
    const hoja = mapToHojaRutaInternal(puesto).trim().toUpperCase().replace(/^HR-/, '');
    return versionPorMaterialAjusteBandas.get(material)?.get(hoja)?.texto;
  }, [mapToHojaRutaInternal, versionPorMaterialAjusteBandas]);

  const bandasMapasAsignacion = useMemo(
    () => derivarMapasDesdeAsignacion(bandasAsignacionOptima, getProdVersionBandas),
    [derivarMapasDesdeAsignacion, bandasAsignacionOptima, getProdVersionBandas]
  );
  const bandasExcludeKeysPorPuesto = bandasMapasAsignacion.excludeKeysPorPuesto;
  const bandasAdjustedInPorPuesto = bandasMapasAsignacion.adjustedInPorPuesto;
  const bandasSplitRemaindersPorPuesto = bandasMapasAsignacion.splitRemaindersPorPuesto;

  const bandasMovedOrders = useMemo(() => (
    bandasAsignacionOptima.piezas
      .filter(p => p.isSplit || p.puestoFinal !== p.puestoNatural)
      .map(p => ({
        ...p.order,
        CANTIDAD: p.cantidad,
        CANTPROGRAMADA: p.cantidad,
        _fromPuesto: p.puestoNatural,
        _toPuesto: p.puestoFinal,
        _isSplit: p.isSplit,
        _originalCantidad: p.originalCantidad,
        _originalKey: p.originalKey,
      }))
  ), [bandasAsignacionOptima]);

  // Qué órdenes NO caben en NINGUNA candidata elegible (ACOLCHADORA11/12) tras el motor de
  // asignación óptima — igual criterio que Acolchado & Tapas.
  const bandasExcesoPorPuesto = useMemo(() => {
    const map = new Map<string, { excessOrders: any[]; excessHours: number; utilizacionReal: number; cap: number }>();
    const puestos = new Set<string>();
    ajusteBandasMateriales.forEach(m => m.candidatos.forEach(c => puestos.add(c.puesto)));

    const excesoPorPuesto = new Map<string, any[]>();
    bandasAsignacionOptima.exceso.forEach(e => {
      if (!excesoPorPuesto.has(e.puestoNatural)) excesoPorPuesto.set(e.puestoNatural, []);
      excesoPorPuesto.get(e.puestoNatural)!.push({ ...e.order, CANTIDAD: e.cantidad, CANTPROGRAMADA: e.cantidad, NOMBRE: e.nombre });
    });

    puestos.forEach(puesto => {
      const cap = bandasAsignacionOptima.capacidadPorPuesto.get(puesto) ?? 0;
      const restante = bandasAsignacionOptima.capacidadRestantePorPuesto.get(puesto) ?? cap;
      const excessOrders = excesoPorPuesto.get(puesto) || [];
      const excessHours = excessOrders.reduce((s, o) => s + calculateProductionTime(o['MATERIAL'] || o['CodMaterial'] || '', Number(o['CANTIDAD'] || 0), o) / 3600, 0);
      const utilizacionReal = cap > 0 ? ((cap - restante) / cap) * 100 : 0;
      map.set(puesto, { excessOrders, excessHours, utilizacionReal, cap });
    });
    return map;
  }, [ajusteBandasMateriales, bandasAsignacionOptima, calculateProductionTime]);

  const [isAceptandoAjusteBandas, setIsAceptandoAjusteBandas] = useState(false);
  const [ajusteBandasAceptado, setAjusteBandasAceptado] = useState(false);

  // Igual patrón que Acolchado & Tapas / Corte / Bordadora: por defecto se ven las órdenes
  // ORIGINALES; el ajuste por versión solo se muestra tras presionar "Ajustar por Versión de
  // Fabricación".
  const [isBandasAjusteActivo, setIsBandasAjusteActivo] = useState(false);
  const handleToggleAjusteBandas = useCallback(() => {
    if (isBandasAjusteActivo) {
      setIsBandasAjusteActivo(false);
      setAjusteBandasAceptado(false);
      setPlanFinalOrders(prev => prev.filter(o => o._source !== 'bandas-version'));
      return;
    }
    setIsBandasAjusteActivo(true);
  }, [isBandasAjusteActivo]);

  // Un solo botón para todo el grupo (ACH11 + ACH12 juntos), no uno por máquina.
  const handleAceptarAjusteBandas = useCallback(() => {
    setIsAceptandoAjusteBandas(true);
    try {
      const ach11Name = uniquePuestos.find(p => p.includes('ACOLCHADORA11') || (p.includes('ACH11') && !p.includes('COSEDORA')));
      const ach12Name = uniquePuestos.find(p => p.includes('ACOLCHADORA12') || (p.includes('ACH12') && !p.includes('COSEDORA')));
      const puestos = [ach11Name, ach12Name].filter(Boolean) as string[];
      const mk = (o: any) => `${o['ORDEN'] || o['ORDENPREVISIONAL'] || ''}|${String(o['MATERIAL'] || o['CodMaterial'] || '')}|${String(o['CANTIDAD'] || o['CANTPROGRAMADA'] || '')}`;
      const finalOrds: any[] = [];
      puestos.forEach(puesto => {
        const hr = mapToHojaRutaInternal(puesto).trim().toUpperCase();
        const hojaSinPrefijo = hr.replace(/^HR-/, '');
        // Versión de Fabricación para Plan Final (columna PROD_VERS): la del material en ESTA máquina.
        const getVersion = (o: any) => {
          const mat = normalizeMaterialCode(o['MATERIAL'] || o['CodMaterial'] || '');
          return versionPorMaterialAjusteBandas.get(mat)?.get(hojaSinPrefijo)?.texto;
        };
        // Con el ajuste APAGADO se acepta el plan ORIGINAL tal cual: los mapas del motor se
        // calculan siempre (aunque no se muestren), así que sin este chequeo el botón mandaría a
        // Plan Final un plan ajustado distinto al que está viendo el usuario en pantalla.
        const excludeKeys = isBandasAjusteActivo ? (bandasExcludeKeysPorPuesto.get(puesto) || new Set<string>()) : new Set<string>();
        const adjustedIn = isBandasAjusteActivo ? (bandasAdjustedInPorPuesto.get(puesto) || []) : [];
        const splitRemainders = isBandasAjusteActivo ? (bandasSplitRemaindersPorPuesto.get(puesto) || []) : [];
        // Faltaba excluir las órdenes bloqueadas con el candado — se colaban a Plan Final igual.
        const bloqueadas = ordenesBloqueadasPorPuesto.get(puesto) || new Set<string>();
        const orig = techFilteredOrdenes.filter(o => String(o['MAQUINA'] || o['Maquina'] || '').trim().toUpperCase() === hr);
        finalOrds.push(
          ...orig.filter(o => !excludeKeys.has(mk(o)) && !bloqueadas.has(mk(o))).map(o => ({ ...o, _finalHR: hr, _wasAdjusted: false, _source: 'bandas-version', _prodVersion: getVersion(o) })),
          ...splitRemainders.filter(o => !bloqueadas.has(mk(o))).map(o => ({ ...o, _finalHR: hr, _wasAdjusted: false, _isSplit: true, _source: 'bandas-version', _prodVersion: getVersion(o) })),
          ...adjustedIn.filter(o => !bloqueadas.has(mk(o))).map(o => ({ ...o, _finalHR: hr, _wasAdjusted: true, _source: 'bandas-version', _prodVersion: getVersion(o) })),
        );
      });
      setPlanFinalOrders(prev => [...prev.filter(o => o._source !== 'bandas-version'), ...finalOrds]);
      setAjusteBandasAceptado(true);
      addNotification('success', isBandasAjusteActivo
        ? `Ajuste de Acolchadora de Bandas (por Versión de Fabricación) aceptado: ${bandasMovedOrders.length} orden(es) redistribuida(s) entre ACOLCHADORA11/12. Ver pestaña Plan Final.`
        : `Plan ORIGINAL de Acolchadora de Bandas aceptado sin ajuste (${finalOrds.length} orden(es), tal como están hoy en SAP). Ver pestaña Plan Final.`);
    } finally {
      setIsAceptandoAjusteBandas(false);
    }
  }, [uniquePuestos, mapToHojaRutaInternal, isBandasAjusteActivo, bandasExcludeKeysPorPuesto, bandasAdjustedInPorPuesto, bandasSplitRemaindersPorPuesto, techFilteredOrdenes, bandasMovedOrders, addNotification, versionPorMaterialAjusteBandas, normalizeMaterialCode, ordenesBloqueadasPorPuesto]);

  // Mantiene sincronizado el Plan Final de Bandas ya aceptado con el estado vigente del candado —
  // igual que Acolchado/Tapa/Forros. Sin esto, bloquear un material DESPUÉS de haber presionado
  // "Aceptar Plan" no descartaba nada: la fila ya exportada quedaba congelada con lo de antes del
  // bloqueo, y había que acordarse de volver a presionar "Reaceptar Plan" a mano (el usuario
  // reportó estar hciendo el bloqueo dos veces — en la app y de nuevo en SAP — por esto).
  useEffect(() => {
    if (!ajusteBandasAceptado) return;
    const ach11Name = uniquePuestos.find(p => p.includes('ACOLCHADORA11') || (p.includes('ACH11') && !p.includes('COSEDORA')));
    const ach12Name = uniquePuestos.find(p => p.includes('ACOLCHADORA12') || (p.includes('ACH12') && !p.includes('COSEDORA')));
    const puestos = [ach11Name, ach12Name].filter(Boolean) as string[];
    const mk = (o: any) => `${o['ORDEN'] || o['ORDENPREVISIONAL'] || ''}|${String(o['MATERIAL'] || o['CodMaterial'] || '')}|${String(o['CANTIDAD'] || o['CANTPROGRAMADA'] || '')}`;
    const finalOrds: any[] = [];
    puestos.forEach(puesto => {
      const hr = mapToHojaRutaInternal(puesto).trim().toUpperCase();
      const hojaSinPrefijo = hr.replace(/^HR-/, '');
      const getVersion = (o: any) => {
        const mat = normalizeMaterialCode(o['MATERIAL'] || o['CodMaterial'] || '');
        return versionPorMaterialAjusteBandas.get(mat)?.get(hojaSinPrefijo)?.texto;
      };
      const excludeKeys = isBandasAjusteActivo ? (bandasExcludeKeysPorPuesto.get(puesto) || new Set<string>()) : new Set<string>();
      const adjustedIn = isBandasAjusteActivo ? (bandasAdjustedInPorPuesto.get(puesto) || []) : [];
      const splitRemainders = isBandasAjusteActivo ? (bandasSplitRemaindersPorPuesto.get(puesto) || []) : [];
      const bloqueadas = ordenesBloqueadasPorPuesto.get(puesto) || new Set<string>();
      const orig = techFilteredOrdenes.filter(o => String(o['MAQUINA'] || o['Maquina'] || '').trim().toUpperCase() === hr);
      finalOrds.push(
        ...orig.filter(o => !excludeKeys.has(mk(o)) && !bloqueadas.has(mk(o))).map(o => ({ ...o, _finalHR: hr, _wasAdjusted: false, _source: 'bandas-version', _prodVersion: getVersion(o) })),
        ...splitRemainders.filter(o => !bloqueadas.has(mk(o))).map(o => ({ ...o, _finalHR: hr, _wasAdjusted: false, _isSplit: true, _source: 'bandas-version', _prodVersion: getVersion(o) })),
        ...adjustedIn.filter(o => !bloqueadas.has(mk(o))).map(o => ({ ...o, _finalHR: hr, _wasAdjusted: true, _source: 'bandas-version', _prodVersion: getVersion(o) })),
      );
    });
    setPlanFinalOrders(prev => [...prev.filter(o => o._source !== 'bandas-version'), ...finalOrds]);
  }, [ajusteBandasAceptado, uniquePuestos, mapToHojaRutaInternal, isBandasAjusteActivo, bandasExcludeKeysPorPuesto, bandasAdjustedInPorPuesto, bandasSplitRemaindersPorPuesto, techFilteredOrdenes, versionPorMaterialAjusteBandas, normalizeMaterialCode, ordenesBloqueadasPorPuesto]);

  const BORD_BAND_PUESTOS_FILTER = useCallback((p: string) =>
    p.includes('BO01') || p.includes('BORDADORA-BANDA01') ||
    p.includes('COS3D') || p.includes('BANDA3D') || p.includes('COSEDORA-BANDA3D') ||
    p.includes('ENCINTADOBD') || p.includes('COSEDORA-ENCINTADOBD'),
  []);

  // "Otras máquinas de interiores (sin grupos de ajuste)": máquinas de un solo puesto por hoja de
  // ruta (INTP-PR/PT/F crudos, MTBS, CT-*, TTCF, TTSUP, TELAS, FUNDAS) — nunca compiten por
  // capacidad con otra, así que no necesitan redistribución, pero sí necesitan poder llegar a Plan
  // Final. Misma lista que filtra la grilla de tarjetas de este grupo, para que "lo que se ve" sea
  // exactamente "lo que se acepta".
  const OTROS_INTERIORES_PUESTOS_FILTER = useCallback((p: string) => (
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
  ), []);

  // Aceptar Plan para "Otras máquinas de interiores" — mismo patrón simple que Forros Finales
  // (`handleAceptarPlanForros`): no hay redistribución posible (una sola máquina por hoja de ruta),
  // así que se acepta tal cual viene de SAP, respetando solo el candado de bloqueo.
  const handleAceptarPlanOtrosInteriores = useCallback((puesto: string) => {
    const yaAceptado = otrosInterioresAceptadoPuestos.has(puesto);
    setOtrosInterioresAceptadoPuestos(prev => {
      const next = new Set(prev);
      if (yaAceptado) next.delete(puesto); else next.add(puesto);
      return next;
    });
    if (yaAceptado) {
      setPlanFinalOrders(prevOrders => prevOrders.filter(o => o._source !== `otros-interiores-${puesto}`));
      addNotification('info', `Plan de ${puesto} retirado de Plan Final.`);
    } else {
      addNotification('success', `Plan aceptado para ${puesto}. Ver pestaña Plan Final.`);
    }
  }, [otrosInterioresAceptadoPuestos, addNotification]);

  useEffect(() => {
    if (otrosInterioresAceptadoPuestos.size === 0) return;
    const mk = (o: any) => `${o['ORDEN'] || o['ORDENPREVISIONAL'] || ''}|${String(o['MATERIAL'] || o['CodMaterial'] || '')}|${String(o['CANTIDAD'] || o['CANTPROGRAMADA'] || '')}`;
    setPlanFinalOrders(prev => {
      let next = prev;
      otrosInterioresAceptadoPuestos.forEach(puesto => {
        const hr = mapToHojaRutaInternal(puesto).trim().toUpperCase();
        const codigos = hr.includes(' / ') ? hr.split(' / ').map(c => c.trim().toUpperCase()) : [hr];
        const bloqueadas = ordenesBloqueadasPorPuesto.get(puesto) || new Set<string>();
        const source = `otros-interiores-${puesto}`;
        const finalOrds = techFilteredOrdenes
          .filter(o => codigos.includes(String(o['MAQUINA'] || o['Maquina'] || '').trim().toUpperCase()))
          .filter(o => !bloqueadas.has(mk(o)))
          .map(o => ({ ...o, _finalHR: hr, _wasAdjusted: false, _source: source }));
        next = [...next.filter(o => o._source !== source), ...finalOrds];
      });
      return next;
    });
  }, [otrosInterioresAceptadoPuestos, ordenesBloqueadasPorPuesto, mapToHojaRutaInternal, techFilteredOrdenes]);

  const handleBordadoraBandAdjust = useCallback(() => {
    if (isBordBandAdjustActive) {
      setBordBandExcessKeys(new Set());
      setIsBordBandAdjustActive(false);
      setBordBandAcceptedMachines(new Set());
      setPlanFinalOrders(prev => prev.filter(o => !String(o._source || '').startsWith('bord-bandas-')));
      return;
    }

    const makeKey = (o: any) => `${o['ORDEN'] || o['ORDENPREVISIONAL'] || ''}|${String(o['MATERIAL'] || o['CodMaterial'] || '')}|${String(o['CANTIDAD'] || o['CANTPROGRAMADA'] || '')}`;
    const getHours = (o: any) => calculateProductionTime(o['MATERIAL'] || o['CodMaterial'] || '', Number(o['CANTIDAD'] || o['CANTPROGRAMADA'] || 0), o) / 3600;

    const excessKeys = new Set<string>();
    uniquePuestos.filter(BORD_BAND_PUESTOS_FILTER).forEach(pName => {
      const hr = mapToHojaRutaInternal(pName).trim().toUpperCase();
      const cfg = workstationConfigs[pName] || { isDayActive: true, isNightActive: false, machines: 1 };
      const cap = capacidadPuesto(pName, cfg, horasNetasDiurnasVal, horasNetasNocturnasVal, horasNetasFinSemanaVal);
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
  }, [isBordBandAdjustActive, uniquePuestos, BORD_BAND_PUESTOS_FILTER, mapToHojaRutaInternal, workstationConfigs, horasNetasDiurnasVal, horasNetasNocturnasVal, horasNetasFinSemanaVal, techFilteredOrdenes, calculateProductionTime]);

  // Exceso NATURAL de cada máquina (capacidad vs lo que ya tiene en SAP), calculado SIEMPRE — antes
  // dependía de `bordBandExcessKeys`, que solo se llenaba al activar el toggle, así que sin el
  // ajuste el botón "Aceptar Plan" no existía y estas máquinas nunca llegaban a Plan Final desde
  // esta pestaña. Ahora el cálculo vive aquí, independiente del toggle.
  const bordBandAdjustSummary = useMemo(() => {
    const getHours = (o: any) => calculateProductionTime(o['MATERIAL'] || o['CodMaterial'] || '', Number(o['CANTIDAD'] || o['CANTPROGRAMADA'] || 0), o) / 3600;

    const machines = uniquePuestos.filter(BORD_BAND_PUESTOS_FILTER).map(pName => {
      const hr = mapToHojaRutaInternal(pName).trim().toUpperCase();
      const cfg = workstationConfigs[pName] || { isDayActive: true, isNightActive: false, machines: 1 };
      const cap = capacidadPuesto(pName, cfg, horasNetasDiurnasVal, horasNetasNocturnasVal, horasNetasFinSemanaVal);
      const machineOrders = techFilteredOrdenes.filter(o => String(o['MAQUINA'] || o['Maquina'] || '').trim().toUpperCase() === hr);
      const totalHours = machineOrders.reduce((s, o) => s + getHours(o), 0);
      let cumHours = 0;
      const excessOrders: any[] = [];
      for (const o of machineOrders) { const h = getHours(o); cumHours += h; if (cumHours > cap) excessOrders.push(o); }
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
  }, [uniquePuestos, BORD_BAND_PUESTOS_FILTER, mapToHojaRutaInternal, workstationConfigs, horasNetasDiurnasVal, horasNetasNocturnasVal, horasNetasFinSemanaVal, techFilteredOrdenes, calculateProductionTime]);

  const handleAcceptBordAdjustForMachine = useCallback((hrCode: string, machineName: string, excessCount: number) => {
    if (!bordBandAdjustSummary || bordBandAcceptedMachines.has(hrCode)) return;
    const makeKey = (o: any) => `${o['ORDEN'] || o['ORDENPREVISIONAL'] || ''}|${String(o['MATERIAL'] || o['CodMaterial'] || '')}|${String(o['CANTIDAD'] || o['CANTPROGRAMADA'] || '')}`;
    // Sin el ajuste activo se acepta el plan ORIGINAL tal cual, sin excluir el exceso — mismo
    // criterio que el resto del ajuste: el resumen se calcula siempre, pero solo se aplica si el
    // usuario encendió "Ajuste de Producción".
    const mSum = bordBandAdjustSummary.machines.find(m => m.hrCode === hrCode);
    const excessKeys = isBordBandAdjustActive ? new Set((mSum?.excessOrders || []).map(makeKey)) : new Set<string>();
    // `machineName` es el nombre del puesto — mismo valor con el que el candado de bloqueo
    // (`ordenesBloqueadasPorPuesto`) guarda las órdenes de esta tarjeta. Faltaba este filtro.
    const bloqueadas = ordenesBloqueadasPorPuesto.get(machineName) || new Set<string>();
    const machineOrders = techFilteredOrdenes
      .filter(o => {
        const hr = String(o['MAQUINA'] || o['Maquina'] || '').trim().toUpperCase();
        return hr === hrCode && !excessKeys.has(makeKey(o)) && !bloqueadas.has(makeKey(o));
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
    addNotification('success', isBordBandAdjustActive
      ? `Ajuste aceptado para ${machineName}: ${excessCount} ${excessCount === 1 ? 'orden marcada' : 'órdenes marcadas'} como no producible. Ver pestaña Plan Final.`
      : `Plan ORIGINAL de ${machineName} aceptado sin ajuste (${machineOrders.length} orden(es), tal como está hoy en SAP). Ver pestaña Plan Final.`);
  }, [bordBandAdjustSummary, bordBandAcceptedMachines, techFilteredOrdenes, addNotification, isBordBandAdjustActive, ordenesBloqueadasPorPuesto]);

  // Mantiene sincronizadas las máquinas de Bordadora/Cosedoras de Banda YA aceptadas con el estado
  // vigente del candado — sin esto, bloquear un material DESPUÉS de aceptar dejaba la fila ya
  // exportada congelada con lo de antes del bloqueo.
  useEffect(() => {
    if (!bordBandAdjustSummary || bordBandAcceptedMachines.size === 0) return;
    const makeKey = (o: any) => `${o['ORDEN'] || o['ORDENPREVISIONAL'] || ''}|${String(o['MATERIAL'] || o['CodMaterial'] || '')}|${String(o['CANTIDAD'] || o['CANTPROGRAMADA'] || '')}`;
    setPlanFinalOrders(prev => {
      let next = prev;
      bordBandAcceptedMachines.forEach(hrCode => {
        const mSum = bordBandAdjustSummary.machines.find(m => m.hrCode === hrCode);
        const machineName = mSum?.name ?? hrCode;
        const excessKeys = isBordBandAdjustActive ? new Set((mSum?.excessOrders || []).map(makeKey)) : new Set<string>();
        const bloqueadas = ordenesBloqueadasPorPuesto.get(machineName) || new Set<string>();
        const source = `bord-bandas-${hrCode}`;
        const machineOrders = techFilteredOrdenes
          .filter(o => {
            const hr = String(o['MAQUINA'] || o['Maquina'] || '').trim().toUpperCase();
            return hr === hrCode && !excessKeys.has(makeKey(o)) && !bloqueadas.has(makeKey(o));
          })
          .map(o => ({ ...o, _finalHR: hrCode, _wasAdjusted: false, _source: source }));
        next = [...next.filter(o => o._source !== source), ...machineOrders];
      });
      return next;
    });
  }, [bordBandAdjustSummary, bordBandAcceptedMachines, techFilteredOrdenes, isBordBandAdjustActive, ordenesBloqueadasPorPuesto]);

  // ─── RMTB1/2/3: ajuste por Versión de Fabricación ────────────────────────
  // Mismo criterio que Acolchado & Tapas y Bandas — ya no se balancea por simple utilización.
  // RMTBM se mantiene aparte, calculado por tiempo/capacidad (no entra al ajuste por versión),
  // pero su cruce con "qué hay en RMTB3" (obligatoriedad hacia adelante y cascada inversa) se
  // actualiza para usar la asignación FINAL de RMTB3 ya reasignada por versión, no las órdenes
  // crudas de antes del ajuste.
  const esPuestoRmtb123 = useCallback((puesto: string) => {
    const u = puesto.toUpperCase();
    const esRmtbM = u.includes('RMTBM') || u.includes('RMTB-M');
    if (esRmtbM) return false;
    return (u.includes('RMTB1') || u.includes('RMTB-1') || u.includes('RMTB01')) ||
      (u.includes('RMTB2') || u.includes('RMTB-2') || u.includes('RMTB02')) ||
      (u.includes('RMTB3') || u.includes('RMTB-3') || u.includes('RMTB03'));
  }, []);

  const rmtb123PuestosActivos = useMemo(() => ({
    rmtb1: uniquePuestos.find(p => { const u = p.toUpperCase(); return (u.includes('RMTB1') || u.includes('RMTB-1') || u.includes('RMTB01')) && !u.includes('RMTBM') && !u.includes('RMTB-M'); }),
    rmtb2: uniquePuestos.find(p => { const u = p.toUpperCase(); return (u.includes('RMTB2') || u.includes('RMTB-2') || u.includes('RMTB02')) && !u.includes('RMTBM') && !u.includes('RMTB-M'); }),
    rmtb3: uniquePuestos.find(p => { const u = p.toUpperCase(); return (u.includes('RMTB3') || u.includes('RMTB-3') || u.includes('RMTB03')) && !u.includes('RMTBM') && !u.includes('RMTB-M'); }),
  }), [uniquePuestos]);

  const ajustePrevisionalRmtbData = useMemo(() => {
    const map = new Map<string, number>();
    techFilteredOrdenes.forEach(o => {
      const matRaw = o['MATERIAL'] || o['CodMaterial'] || '';
      if (!matRaw) return;
      const mat = normalizeMaterialCode(matRaw);
      const nombreMaterial = materialNombrePorCodigo.get(mat) || '';
      if (!normalizeText(nombreMaterial).startsWith('BANDA')) return;
      const timesList: any[] = tiemposIndexRef.current[mat] || [];
      const esRmtb = timesList.some((t: any) => esPuestoRmtb123(String(t.PuestoTrabajo || t.nombre_estacion || t.Maquina || '').trim().toUpperCase()));
      if (!esRmtb) return;
      const qty = Number(o['CANTIDAD'] || o['CANTPROGRAMADA'] || 0);
      map.set(mat, (map.get(mat) || 0) + qty);
    });
    return map;
  }, [techFilteredOrdenes, normalizeMaterialCode, esPuestoRmtb123, materialNombrePorCodigo]);

  const ajusteRmtbMateriales = useMemo<MaterialAcolchado[]>(() => {
    if (ajustePrevisionalRmtbData.size === 0) return [];
    const getCapacidad = (puesto: string) => {
      const cfg = workstationConfigs[puesto] || { machine: puesto, isDayActive: true, isNightActive: false, isSaturdayActive: false, peopleDay: 0, peopleNight: 0, peopleWeekend: 0, machines: 1 };
      const capacidad = capacidadPuesto(puesto, cfg, horasNetasDiurnasVal, horasNetasNocturnasVal, horasNetasFinSemanaVal);
      return { cfg, capacidad };
    };
    const out: MaterialAcolchado[] = [];
    ajustePrevisionalRmtbData.forEach((cantidadTotal, mat) => {
      if (cantidadTotal <= 0) return;
      const timesList: any[] = tiemposIndexRef.current[mat] || [];
      const candidatos = timesList
        .map(t => ({
          puesto: String(t.PuestoTrabajo || t.nombre_estacion || t.Maquina || '').trim().toUpperCase(),
          tiempoSegPorUnidad: Number(t.Tiempo || t.Tiempo_Min || 0) * 60,
        }))
        .filter(c => c.puesto && esPuestoRmtb123(c.puesto) && c.tiempoSegPorUnidad > 0);
      if (candidatos.length === 0) return;
      out.push({
        material: mat,
        nombre: materialNombrePorCodigo.get(mat) || mat,
        cantidadTotal,
        qtyChn: cantidadTotal,
        qtyBase: 0,
        candidatos: candidatos.map(c => ({ ...c, ...getCapacidad(c.puesto) })),
      });
    });
    return out;
  }, [ajustePrevisionalRmtbData, workstationConfigs, horasNetasDiurnasVal, horasNetasNocturnasVal, horasNetasFinSemanaVal, materialNombrePorCodigo, esPuestoRmtb123]);

  const [versionPorMaterialAjusteRmtb, setVersionPorMaterialAjusteRmtb] = useState<Map<string, Map<string, VersionInfo>>>(new Map());

  useEffect(() => {
    if (ajusteRmtbMateriales.length === 0) {
      setVersionPorMaterialAjusteRmtb(new Map());
      return;
    }
    let cancelled = false;
    (async () => {
      try {
        const materiales = ajusteRmtbMateriales.map(m => m.material);
        const datosPorMaterial = await fetchVersionesPorMaterial(materiales);
        const resultado = new Map<string, Map<string, VersionInfo>>();
        const sinVersion: string[] = [];
        materiales.forEach(material => {
          const porHoja = new Map<string, VersionInfo>();
          (datosPorMaterial.get(material) || []).forEach((v: any) => {
            const hoja = String(v.GRUPOHOJARUTA || '').trim().toUpperCase().replace(/^HR-/, '');
            // Se conserva el texto EXACTO de SAP (puede venir "1" o "01") para Plan Final/PROD_VERS;
            // `numero` es solo para decidir cuál candidato es la versión preferida (menor = mejor).
            const textoVersion = String(v.VERSION || '').trim();
            const numero = parseInt(textoVersion, 10);
            if (hoja && textoVersion && !isNaN(numero)) porHoja.set(hoja, { numero, texto: textoVersion });
          });
          if (porHoja.size === 0) sinVersion.push(material);
          resultado.set(material, porHoja);
        });
        if (!cancelled) {
          setVersionPorMaterialAjusteRmtb(resultado);
          if (sinVersion.length > 0) {
            addNotification('warning', `${sinVersion.length} material${sinVersion.length === 1 ? '' : 'es'} de BANDA (RMTB) sin Versión de Fabricación registrada en SAP: ${sinVersion.join(', ')}.`);
          }
        }
      } catch (error: any) {
        if (!cancelled) addNotification('error', `Error al consultar Versión de Fabricación (RMTB): ${error.message}`);
      }
    })();
    return () => { cancelled = true; };
  }, [ajusteRmtbMateriales, addNotification, fetchVersionesPorMaterial]);

  // Alternativas de ajuste (igual concepto que Acolchado & Tapas / Bandas).
  const [modoAjusteRmtb, setModoAjusteRmtb] = useState<'optimo' | 'equilibrado'>('optimo');

  // Antes RMTB iba SIN split, porque partir generaba fracciones imposibles de fabricar (ej. 49,5
  // unidades). Ahora sí se parte, pero SOLO en unidades enteras: así se llena la capacidad libre de
  // RMTB1/2/3 en vez de mandar al exceso una orden que sí cabía repartida, y sin producir fracciones.
  // La Fase 1 del motor sigue intacta: lo que ya cuadra en su propia máquina no se mueve nunca.
  const cuantizarRmtbAUnidadEntera = useCallback((_material: string, cantidad: number) => {
    return Math.floor(cantidad + 1e-6);
  }, []);

  // BANDAS que la RMTBM consume (componentes de sus órdenes según la lista de materiales). Se
  // calcula desde las órdenes CRUDAS de SAP, no desde el resultado del motor: si dependiera de la
  // asignación, la asignación dependería de sí misma.
  const materialesRmtb3LigadosARmtbM = useMemo(() => {
    const set = new Set<string>();
    const rmtbM = uniquePuestos.find(p => { const u = p.toUpperCase(); return u.includes('RMTBM') || u.includes('RMTB-M'); });
    if (!rmtbM) return set;
    const hrM = mapToHojaRutaInternal(rmtbM).trim().toUpperCase();
    techFilteredOrdenes.forEach(o => {
      if (String(o['MAQUINA'] || o['Maquina'] || '').trim().toUpperCase() !== hrM) return;
      const matCode = normalizeMaterialCode(o['MATERIAL'] || o['CodMaterial'] || '');
      listaMaterialesData.forEach(item => {
        if (normalizeMaterialCode(String(item['MATERIAL'] || item['Material'] || item['PADRE'] || '')) !== matCode) return;
        const comp = normalizeMaterialCode(String(item['COMPONENTE'] || item['Componente'] || item['HIJO'] || ''));
        if (comp) set.add(comp);
      });
    });
    return set;
  }, [uniquePuestos, mapToHojaRutaInternal, techFilteredOrdenes, normalizeMaterialCode, listaMaterialesData]);

  // Una BANDA que alimenta a la RMTBM tiene que coserse en RMTB3: esa es la ruta que le entrega el
  // componente. Si el ajuste la mueve a RMTB1/RMTB2 para llenar capacidad, la RMTBM se queda sin
  // su componente. Se bloquea el movimiento y esa orden queda anclada en RMTB3.
  const puedeMoverRmtb = useCallback((_nombre: string, origen: string, _destino: string, materialCode: string) => {
    const u = origen.toUpperCase();
    const esRmtb3 = u.includes('RMTB3') || u.includes('RMTB-3') || u.includes('RMTB03');
    if (!esRmtb3) return true;
    return !materialesRmtb3LigadosARmtbM.has(materialCode);
  }, [materialesRmtb3LigadosARmtbM]);

  // Carga natural de cada RMTB1/2/3: lo que SAP tiene HOY en esa máquina contra su capacidad, con
  // la misma función de tiempo que usa la tarjeta (para que el % que decide coincida con el que ve
  // el usuario). Es la condición para que el ajuste haga algo: si ninguna se pasa, mover carga de
  // una máquina al 80% a otra al 45% no arregla nada — solo descuadra un plan que ya estaba bien.
  const rmtbCargaNatural = useMemo(() => {
    const { rmtb1, rmtb2, rmtb3 } = rmtb123PuestosActivos;
    const puestos = [rmtb1, rmtb2, rmtb3].filter(Boolean) as string[];
    const detalle = puestos.map(puesto => {
      const hr = mapToHojaRutaInternal(puesto).trim().toUpperCase();
      const cfg = workstationConfigs[puesto] || { machine: puesto, isDayActive: true, isNightActive: false, isSaturdayActive: false, peopleDay: 0, peopleNight: 0, peopleWeekend: 0, machines: 1 };
      const cap = capacidadPuesto(puesto, cfg, horasNetasDiurnasVal, horasNetasNocturnasVal, horasNetasFinSemanaVal);
      const horas = techFilteredOrdenes
        .filter(o => String(o['MAQUINA'] || o['Maquina'] || '').trim().toUpperCase() === hr)
        .reduce((s, o) => s + calculateProductionTime(o['MATERIAL'] || o['CodMaterial'] || '', Number(o['CANTIDAD'] || o['CANTPROGRAMADA'] || 0), o) / 3600, 0);
      return { puesto, horas, cap, util: cap > 0 ? (horas / cap) * 100 : 0 };
    });
    return { detalle, haySobrecarga: detalle.some(d => d.horas > d.cap + 0.001) };
  }, [rmtb123PuestosActivos, mapToHojaRutaInternal, workstationConfigs, horasNetasDiurnasVal, horasNetasNocturnasVal, horasNetasFinSemanaVal, techFilteredOrdenes, calculateProductionTime]);

  const rmtbAsignacionOptima = useMemo(
    () => asignarOptimoPorVersion(ajusteRmtbMateriales, versionPorMaterialAjusteRmtb, techFilteredOrdenes, modoAjusteRmtb, true, puedeMoverRmtb, cuantizarRmtbAUnidadEntera),
    [asignarOptimoPorVersion, ajusteRmtbMateriales, versionPorMaterialAjusteRmtb, techFilteredOrdenes, modoAjusteRmtb, puedeMoverRmtb, cuantizarRmtbAUnidadEntera]
  );

  const rmtbFactibilidad = useMemo(() => {
    if (ajusteRmtbMateriales.length === 0) return null;
    const puestos = Array.from(rmtbAsignacionOptima.capacidadPorPuesto.entries())
      .map(([puesto, capacidad]) => {
        const restante = rmtbAsignacionOptima.capacidadRestantePorPuesto.get(puesto) ?? capacidad;
        const horasRequeridas = Math.max(0, capacidad - restante);
        return { puesto, horasRequeridas, capacidad, utilizacion: capacidad > 0 ? (horasRequeridas / capacidad) * 100 : 0, deficitHoras: 0 };
      })
      .sort((a, b) => b.utilizacion - a.utilizacion);
    return { puestos, puestosDeficit: [] as typeof puestos, esFactible: true };
  }, [ajusteRmtbMateriales, rmtbAsignacionOptima]);

  const getProdVersionRmtb = useCallback((material: string, puesto: string) => {
    const hoja = mapToHojaRutaInternal(puesto).trim().toUpperCase().replace(/^HR-/, '');
    return versionPorMaterialAjusteRmtb.get(material)?.get(hoja)?.texto;
  }, [mapToHojaRutaInternal, versionPorMaterialAjusteRmtb]);

  const rmtbMapasAsignacion = useMemo(
    () => derivarMapasDesdeAsignacion(rmtbAsignacionOptima, getProdVersionRmtb),
    [derivarMapasDesdeAsignacion, rmtbAsignacionOptima, getProdVersionRmtb]
  );
  const rmtbExcludeKeysPorPuesto = rmtbMapasAsignacion.excludeKeysPorPuesto;
  const rmtbAdjustedInPorPuesto = rmtbMapasAsignacion.adjustedInPorPuesto;
  const rmtbSplitRemaindersPorPuesto = rmtbMapasAsignacion.splitRemaindersPorPuesto;

  const rmtbVersionMovedOrders = useMemo(() => (
    rmtbAsignacionOptima.piezas
      .filter(p => p.isSplit || p.puestoFinal !== p.puestoNatural)
      .map(p => ({
        ...p.order,
        CANTIDAD: p.cantidad,
        CANTPROGRAMADA: p.cantidad,
        _fromPuesto: p.puestoNatural,
        _toPuesto: p.puestoFinal,
        _isSplit: p.isSplit,
        _originalCantidad: p.originalCantidad,
        _originalKey: p.originalKey,
      }))
  ), [rmtbAsignacionOptima]);

  // Materiales realmente asignados a RMTB3 tras el ajuste por versión — usado para el cruce con
  // RMTBM (obligatoriedad hacia adelante y cascada inversa), para que "qué hay en RMTB3" siempre
  // refleje el ajuste vigente y no las órdenes crudas de antes de reasignar.
  const rmtb3FinalOrders = useMemo(() => {
    const rmtb3 = rmtb123PuestosActivos.rmtb3;
    if (!rmtb3) return [];
    const hr = mapToHojaRutaInternal(rmtb3).trim().toUpperCase();
    const mk = (o: any) => `${o['ORDEN'] || o['ORDENPREVISIONAL'] || ''}|${String(o['MATERIAL'] || o['CodMaterial'] || '')}|${String(o['CANTIDAD'] || o['CANTPROGRAMADA'] || '')}`;
    const excludeKeys = rmtbExcludeKeysPorPuesto.get(rmtb3) || new Set<string>();
    const adjustedIn = rmtbAdjustedInPorPuesto.get(rmtb3) || [];
    const splitRemainders = rmtbSplitRemaindersPorPuesto.get(rmtb3) || [];
    const orig = techFilteredOrdenes.filter(o => String(o['MAQUINA'] || o['Maquina'] || '').trim().toUpperCase() === hr);
    return [...orig.filter(o => !excludeKeys.has(mk(o))), ...splitRemainders, ...adjustedIn];
  }, [rmtb123PuestosActivos, mapToHojaRutaInternal, rmtbExcludeKeysPorPuesto, rmtbAdjustedInPorPuesto, rmtbSplitRemaindersPorPuesto, techFilteredOrdenes]);

  // ─── Cruce de BOM INTPF ↔ INTPR/INTPT, SIEMPRE calculado (no depende de isIntpfAdjustActive) ──
  // Confirmado con el usuario: INTPF es un paso previo obligatorio que INTPR e INTPT consumen como
  // componente — el uno depende del otro en ambos sentidos, así que bloquear cualquiera de los dos
  // lados debe bloquear también al otro (a diferencia de RMTB3/RMTBM, que es de una sola vía en
  // garantía). Debe funcionar aunque el usuario nunca active "Ajuste de Producción" para Interiores.
  const intpfCruceBOM = useMemo(() => {
    const intpfPuesto = uniquePuestos.find(p => p.toUpperCase() === 'COSEDORA-INTPF');
    const intprPuesto = uniquePuestos.find(p => p.toUpperCase() === 'COSEDORA-INTPR');
    const intptPuesto = uniquePuestos.find(p => p.toUpperCase() === 'COSEDORA-INTPT');
    // matNorm (INTPR o INTPT) -> matNorm INTPF del que depende
    const aIntpf = new Map<string, string>();
    // matNorm INTPF -> lista de { puesto, material } de INTPR/INTPT que lo necesitan
    const desdeIntpf = new Map<string, { puesto: string; material: string }[]>();
    if (!intpfPuesto || listaMaterialesData.length === 0) return { intpfPuesto, intprPuesto, intptPuesto, aIntpf, desdeIntpf };

    const getHR = (p: string) => mapToHojaRutaInternal(p).trim().toUpperCase();
    const intpfHR = getHR(intpfPuesto);
    const intpfMaterials = new Set(
      techFilteredOrdenes
        .filter(o => String(o['MAQUINA'] || o['Maquina'] || '').trim().toUpperCase() === intpfHR)
        .map(o => normalizeMaterialCode(o['MATERIAL'] || o['CodMaterial'] || ''))
    );
    const getComponents = (matCode: string): string[] =>
      listaMaterialesData
        .filter(item => normalizeMaterialCode(String(item['MATERIAL'] || item['Material'] || item['PADRE'] || '')) === matCode)
        .map(item => normalizeMaterialCode(String(item['COMPONENTE'] || item['Componente'] || item['HIJO'] || '')));

    [intprPuesto, intptPuesto].filter((p): p is string => !!p).forEach(puesto => {
      const hr = getHR(puesto);
      const materialesVistos = new Set<string>();
      techFilteredOrdenes.forEach(o => {
        if (String(o['MAQUINA'] || o['Maquina'] || '').trim().toUpperCase() !== hr) return;
        const mat = normalizeMaterialCode(o['MATERIAL'] || o['CodMaterial'] || '');
        if (!mat || materialesVistos.has(mat)) return;
        materialesVistos.add(mat);
        const intpfMat = getComponents(mat).find(c => intpfMaterials.has(c));
        if (!intpfMat) return;
        aIntpf.set(mat, intpfMat);
        if (!desdeIntpf.has(intpfMat)) desdeIntpf.set(intpfMat, []);
        desdeIntpf.get(intpfMat)!.push({ puesto, material: mat });
      });
    });
    return { intpfPuesto, intprPuesto, intptPuesto, aIntpf, desdeIntpf };
  }, [uniquePuestos, mapToHojaRutaInternal, techFilteredOrdenes, normalizeMaterialCode, listaMaterialesData]);

  // ─── Cruce de BOM RMTB3 ↔ RMTBM, SIEMPRE calculado ─────────────────────────────────────────
  // Confirmado con el usuario: todo material de RMTBM tiene SIEMPRE una BANDA correspondiente en
  // RMTB3 (garantizado), pero no toda BANDA de RMTB3 tiene un material en RMTBM (hay bandas propias
  // de RMTB3 sin relación) — de una sola vía en garantía, pero el bloqueo cascadea en las DOS
  // direcciones cuando la relación sí existe: bloquear RMTBM bloquea su banda en RMTB3 siempre;
  // bloquear una banda de RMTB3 bloquea RMTBM solo si esa banda específica tiene un material
  // relacionado ahí (se verifica contra la lista de materiales, no se asume).
  const rmtbCruceBOM = useMemo(() => {
    const rmtbM = uniquePuestos.find(p => { const u = p.toUpperCase(); return u.includes('RMTBM') || u.includes('RMTB-M'); });
    const aRmtb3 = new Map<string, string>(); // matNorm RMTBM -> matNorm banda RMTB3
    const desdeRmtb3 = new Map<string, string[]>(); // matNorm banda RMTB3 -> matNorm(es) RMTBM
    if (!rmtbM || listaMaterialesData.length === 0) return { rmtbM, aRmtb3, desdeRmtb3 };

    const hrM = mapToHojaRutaInternal(rmtbM).trim().toUpperCase();
    const rmtb3Materiales = new Set(rmtb3FinalOrders.map(o => normalizeMaterialCode(o['MATERIAL'] || o['CodMaterial'] || '')));
    const getComponents = (matCode: string): string[] =>
      listaMaterialesData
        .filter(item => normalizeMaterialCode(String(item['MATERIAL'] || item['Material'] || item['PADRE'] || '')) === matCode)
        .map(item => normalizeMaterialCode(String(item['COMPONENTE'] || item['Componente'] || item['HIJO'] || '')));

    const materialesVistos = new Set<string>();
    techFilteredOrdenes.forEach(o => {
      if (String(o['MAQUINA'] || o['Maquina'] || '').trim().toUpperCase() !== hrM) return;
      const mat = normalizeMaterialCode(o['MATERIAL'] || o['CodMaterial'] || '');
      if (!mat || materialesVistos.has(mat)) return;
      materialesVistos.add(mat);
      const bandaMat = getComponents(mat).find(c => rmtb3Materiales.has(c));
      if (!bandaMat) return;
      aRmtb3.set(mat, bandaMat);
      if (!desdeRmtb3.has(bandaMat)) desdeRmtb3.set(bandaMat, []);
      desdeRmtb3.get(bandaMat)!.push(mat);
    });
    return { rmtbM, aRmtb3, desdeRmtb3 };
  }, [uniquePuestos, mapToHojaRutaInternal, techFilteredOrdenes, normalizeMaterialCode, listaMaterialesData, rmtb3FinalOrders]);

  // Materiales (no keys de orden puntuales) manualmente bloqueados en cada puesto — necesario para
  // cascadear el bloqueo por MATERIAL hacia el puesto relacionado, no por una orden puntual (puede
  // haber varias líneas de SAP para el mismo material en el puesto de destino).
  const materialesBloqueadosPorPuesto = useMemo(() => {
    const map = new Map<string, Set<string>>();
    ordenesBloqueadasPorPuesto.forEach((keys, puesto) => {
      if (keys.size === 0) return;
      const hr = mapToHojaRutaInternal(puesto).trim().toUpperCase();
      const mk = (o: any) => `${o['ORDEN'] || o['ORDENPREVISIONAL'] || ''}|${String(o['MATERIAL'] || o['CodMaterial'] || '')}|${String(o['CANTIDAD'] || o['CANTPROGRAMADA'] || '')}`;
      const mats = new Set<string>();
      techFilteredOrdenes.forEach(o => {
        if (String(o['MAQUINA'] || o['Maquina'] || '').trim().toUpperCase() !== hr) return;
        if (keys.has(mk(o))) mats.add(normalizeMaterialCode(o['MATERIAL'] || o['CodMaterial'] || ''));
      });
      if (mats.size > 0) map.set(puesto, mats);
    });
    return map;
  }, [ordenesBloqueadasPorPuesto, mapToHojaRutaInternal, techFilteredOrdenes, normalizeMaterialCode]);

  // ─── Bloqueo EFECTIVO por puesto: manual + cascada INTPF↔INTPR/INTPT y RMTBM↔RMTB3 ──────────
  // Esta es la fuente de verdad para TODO lo demás (tarjeta/barra de capacidad, Plan Final): el
  // bloqueo manual (`ordenesBloqueadasPorPuesto`) más lo que cae en cascada por relación de BOM. Al
  // ser derivado (no se guarda como bloqueo manual), desbloquear el material que originó la cascada
  // también levanta automáticamente el bloqueo cascadeado — no queda un bloqueo "fantasma".
  const bloqueoEfectivoPorPuesto = useMemo(() => {
    const resultado = new Map<string, Set<string>>();
    ordenesBloqueadasPorPuesto.forEach((keys, puesto) => resultado.set(puesto, new Set(keys)));

    const mk = (o: any) => `${o['ORDEN'] || o['ORDENPREVISIONAL'] || ''}|${String(o['MATERIAL'] || o['CodMaterial'] || '')}|${String(o['CANTIDAD'] || o['CANTPROGRAMADA'] || '')}`;
    const cascadearMaterial = (puestoDestino: string | undefined, matDestino: string) => {
      if (!puestoDestino) return;
      const hr = mapToHojaRutaInternal(puestoDestino).trim().toUpperCase();
      techFilteredOrdenes.forEach(o => {
        if (String(o['MAQUINA'] || o['Maquina'] || '').trim().toUpperCase() !== hr) return;
        if (normalizeMaterialCode(o['MATERIAL'] || o['CodMaterial'] || '') !== matDestino) return;
        if (!resultado.has(puestoDestino)) resultado.set(puestoDestino, new Set());
        resultado.get(puestoDestino)!.add(mk(o));
      });
    };

    // INTPR/INTPT bloqueado → cascadea a INTPF.
    [intpfCruceBOM.intprPuesto, intpfCruceBOM.intptPuesto].filter((p): p is string => !!p).forEach(puesto => {
      (materialesBloqueadosPorPuesto.get(puesto) || new Set<string>()).forEach(mat => {
        const intpfMat = intpfCruceBOM.aIntpf.get(mat);
        if (intpfMat) cascadearMaterial(intpfCruceBOM.intpfPuesto, intpfMat);
      });
    });
    // INTPF bloqueado → cascadea a TODOS los INTPR/INTPT que dependen de él.
    (materialesBloqueadosPorPuesto.get(intpfCruceBOM.intpfPuesto || '') || new Set<string>()).forEach(mat => {
      (intpfCruceBOM.desdeIntpf.get(mat) || []).forEach(({ puesto, material }) => cascadearMaterial(puesto, material));
    });

    // RMTBM bloqueado → SIEMPRE cascadea a su banda en RMTB3.
    (materialesBloqueadosPorPuesto.get(rmtbCruceBOM.rmtbM || '') || new Set<string>()).forEach(mat => {
      const bandaMat = rmtbCruceBOM.aRmtb3.get(mat);
      if (bandaMat) cascadearMaterial(rmtb123PuestosActivos.rmtb3, bandaMat);
    });
    // RMTB3 bloqueado → cascadea a RMTBM SOLO si existe relación para ese material puntual.
    (materialesBloqueadosPorPuesto.get(rmtb123PuestosActivos.rmtb3 || '') || new Set<string>()).forEach(mat => {
      (rmtbCruceBOM.desdeRmtb3.get(mat) || []).forEach(matRmtbm => cascadearMaterial(rmtbCruceBOM.rmtbM, matRmtbm));
    });

    return resultado;
  }, [ordenesBloqueadasPorPuesto, mapToHojaRutaInternal, techFilteredOrdenes, normalizeMaterialCode, intpfCruceBOM, rmtbCruceBOM, materialesBloqueadosPorPuesto, rmtb123PuestosActivos]);

  // Qué órdenes NO caben en NINGUNA candidata elegible (RMTB1/2/3) tras el motor de asignación óptima.
  const rmtbExcesoPorPuesto = useMemo(() => {
    const map = new Map<string, { excessOrders: any[]; excessHours: number; utilizacionReal: number; cap: number }>();
    const puestos = new Set<string>();
    ajusteRmtbMateriales.forEach(m => m.candidatos.forEach(c => puestos.add(c.puesto)));

    const excesoPorPuesto = new Map<string, any[]>();
    rmtbAsignacionOptima.exceso.forEach(e => {
      if (!excesoPorPuesto.has(e.puestoNatural)) excesoPorPuesto.set(e.puestoNatural, []);
      excesoPorPuesto.get(e.puestoNatural)!.push({ ...e.order, CANTIDAD: e.cantidad, CANTPROGRAMADA: e.cantidad, NOMBRE: e.nombre });
    });

    puestos.forEach(puesto => {
      const cap = rmtbAsignacionOptima.capacidadPorPuesto.get(puesto) ?? 0;
      const restante = rmtbAsignacionOptima.capacidadRestantePorPuesto.get(puesto) ?? cap;
      const excessOrders = excesoPorPuesto.get(puesto) || [];
      const excessHours = excessOrders.reduce((s, o) => s + calculateProductionTime(o['MATERIAL'] || o['CodMaterial'] || '', Number(o['CANTIDAD'] || 0), o) / 3600, 0);
      const utilizacionReal = cap > 0 ? ((cap - restante) / cap) * 100 : 0;
      map.set(puesto, { excessOrders, excessHours, utilizacionReal, cap });
    });
    return map;
  }, [ajusteRmtbMateriales, rmtbAsignacionOptima, calculateProductionTime]);

  // RMTBM se mantiene por tiempo/capacidad (no entra al ajuste por versión) — se calcula siempre,
  // sin depender de ningún toggle, igual que el resto de esta lógica ya no usa activar/desactivar.
  const rmtbmInfo = useMemo(() => {
    const rmtbM = uniquePuestos.find(p => { const u = p.toUpperCase(); return u.includes('RMTBM') || u.includes('RMTB-M'); });
    if (!rmtbM) return null;
    const hr = mapToHojaRutaInternal(rmtbM).trim().toUpperCase();
    const cfg = workstationConfigs[rmtbM] || { isDayActive: true, isNightActive: false, machines: 1 };
    const cap = capacidadPuesto(rmtbM, cfg, horasNetasDiurnasVal, horasNetasNocturnasVal, horasNetasFinSemanaVal);
    const getHours = (o: any) => calculateProductionTime(o['MATERIAL'] || o['CodMaterial'] || '', Number(o['CANTIDAD'] || o['CANTPROGRAMADA'] || 0), o) / 3600;
    const orders = techFilteredOrdenes.filter(o => String(o['MAQUINA'] || o['Maquina'] || '').trim().toUpperCase() === hr);
    const finalHours = orders.reduce((s, o) => s + getHours(o), 0);
    // Best-fit: se ordena de mayor a menor duración y se acumula solo lo que efectivamente cabe en
    // la capacidad restante — nunca se abandona apenas una orden grande no encaja, se sigue
    // probando con las más chicas (evita declarar "no producible" habiendo espacio real libre).
    let restanteCap = cap;
    const excessOrders: any[] = [];
    [...orders].sort((a, b) => getHours(b) - getHours(a)).forEach(o => {
      const h = getHours(o);
      if (h <= restanteCap + 0.001) restanteCap -= h;
      else excessOrders.push(o);
    });

    const rmtb3MaterialesFinal = new Set(rmtb3FinalOrders.map(o => normalizeMaterialCode(o['MATERIAL'] || o['CodMaterial'] || '')));
    const obligatoryRmtb3 = orders.filter(ord => {
      const matCode = normalizeMaterialCode(ord['MATERIAL'] || ord['CodMaterial'] || '');
      const components = listaMaterialesData
        .filter(item => normalizeMaterialCode(String(item['MATERIAL'] || item['Material'] || item['PADRE'] || '')) === matCode)
        .map(item => normalizeMaterialCode(String(item['COMPONENTE'] || item['Componente'] || item['HIJO'] || '')));
      return components.some(comp => comp && rmtb3MaterialesFinal.has(comp));
    });

    const mk = (o: any) => `${o['ORDEN'] || o['ORDENPREVISIONAL'] || ''}|${String(o['MATERIAL'] || o['CodMaterial'] || '')}|${String(o['CANTIDAD'] || o['CANTPROGRAMADA'] || '')}`;
    const excessOrderKeys = new Set(excessOrders.map(mk));

    return { name: rmtbM, hrCode: hr, cap, finalHours, excessOrders, excessOrderKeys, obligatoryRmtb3 };
  }, [uniquePuestos, mapToHojaRutaInternal, workstationConfigs, horasNetasDiurnasVal, horasNetasNocturnasVal, horasNetasFinSemanaVal, techFilteredOrdenes, calculateProductionTime, rmtb3FinalOrders, normalizeMaterialCode, listaMaterialesData]);

  const [isAceptandoAjusteRmtb, setIsAceptandoAjusteRmtb] = useState(false);
  const [ajusteRmtbAceptado, setAjusteRmtbAceptado] = useState(false);

  // Igual patrón que Acolchado & Tapas / Bandas / Corte / Bordadora: por defecto se ven las
  // órdenes ORIGINALES; el ajuste por versión (RMTB1/2/3) solo se muestra tras presionar "Ajustar
  // por Versión de Fabricación". RMTBM no entra aquí — se mantiene por tiempo/capacidad, siempre visible.
  const [isRmtbAjusteActivo, setIsRmtbAjusteActivo] = useState(false);
  const handleToggleAjusteRmtb = useCallback(() => {
    if (isRmtbAjusteActivo) {
      setIsRmtbAjusteActivo(false);
      setAjusteRmtbAceptado(false);
      setPlanFinalOrders(prev => prev.filter(o => o._source !== 'rmtb-version'));
      return;
    }
    // El ajuste solo redistribuye EXCESO. Si ninguna RMTB se pasa de su capacidad no hay nada que
    // reubicar: bajar la RMTB1 del 80% al 50% porque la RMTB2 está al 45% no resuelve ningún
    // problema y descuadra un plan que ya estaba bien. Ahí la salida es reducir carga o revisar
    // horarios, no mover órdenes entre máquinas.
    if (!rmtbCargaNatural.haySobrecarga) {
      const resumen = rmtbCargaNatural.detalle.map(d => `${d.puesto} ${d.util.toFixed(0)}%`).join(' · ');
      addNotification('info', `No hay nada que ajustar: ninguna RMTB supera su capacidad (${resumen}). Para bajar la carga hay que reducir órdenes o revisar horarios en Personal y Turnos.`);
      return;
    }
    setIsRmtbAjusteActivo(true);
  }, [isRmtbAjusteActivo, rmtbCargaNatural, addNotification]);

  // Un solo botón para todo el grupo: RMTB1 + RMTB2 + RMTB3 **y también RMTBM**. RMTBM no entra al
  // ajuste por versión (se mantiene por tiempo/capacidad), pero sí debe llegar a Plan Final: se
  // envía TAL CUAL, sin ningún ajuste ni redistribución.
  const handleAceptarAjusteRmtb = useCallback(() => {
    setIsAceptandoAjusteRmtb(true);
    try {
      const { rmtb1, rmtb2, rmtb3 } = rmtb123PuestosActivos;
      const puestos = [rmtb1, rmtb2, rmtb3].filter(Boolean) as string[];
      const mk = (o: any) => `${o['ORDEN'] || o['ORDENPREVISIONAL'] || ''}|${String(o['MATERIAL'] || o['CodMaterial'] || '')}|${String(o['CANTIDAD'] || o['CANTPROGRAMADA'] || '')}`;
      // Órdenes bloqueadas con el candado: nunca deben llegar a Plan Final, se acepte con ajuste o sin él.
      // `bloqueoEfectivoPorPuesto` incluye también lo bloqueado en cascada por relación de BOM con
      // RMTBM/RMTB3 (ver esa constante) — no solo el candado manual crudo.
      const estaBloqueada = (puesto: string, o: any) => (bloqueoEfectivoPorPuesto.get(puesto) || new Set<string>()).has(mk(o));
      // Regla de negocio existente: excluir de RMTB1/2/3 los materiales liberados por la cascada
      // inversa RMTBM → RMTB3 (no producir dos veces la misma BANDA por dos rutas). Solo aplica con
      // el ajuste ACTIVO: sin ajuste se acepta el plan original de SAP tal cual, sin exclusiones.
      const liberadaMats = new Set(isRmtbAjusteActivo ? rmtbmBandaLiberada.map(item => item.material) : []);
      const isLiberada = (o: any) => liberadaMats.has(String(o['MATERIAL'] || o['CodMaterial'] || '').trim());
      const finalOrds: any[] = [];
      puestos.forEach(puesto => {
        const hr = mapToHojaRutaInternal(puesto).trim().toUpperCase();
        const hojaSinPrefijo = hr.replace(/^HR-/, '');
        // Versión de Fabricación para Plan Final (columna PROD_VERS): la del material en ESTA máquina.
        const getVersion = (o: any) => {
          const mat = normalizeMaterialCode(o['MATERIAL'] || o['CodMaterial'] || '');
          return versionPorMaterialAjusteRmtb.get(mat)?.get(hojaSinPrefijo)?.texto;
        };
        // Igual que en Bandas: con el ajuste apagado se acepta el plan ORIGINAL, no el del motor.
        const excludeKeys = isRmtbAjusteActivo ? (rmtbExcludeKeysPorPuesto.get(puesto) || new Set<string>()) : new Set<string>();
        const adjustedIn = isRmtbAjusteActivo ? (rmtbAdjustedInPorPuesto.get(puesto) || []) : [];
        const splitRemainders = isRmtbAjusteActivo ? (rmtbSplitRemaindersPorPuesto.get(puesto) || []) : [];
        const orig = techFilteredOrdenes.filter(o => String(o['MAQUINA'] || o['Maquina'] || '').trim().toUpperCase() === hr);
        finalOrds.push(
          ...orig.filter(o => !excludeKeys.has(mk(o)) && !isLiberada(o) && !estaBloqueada(puesto, o)).map(o => ({ ...o, _finalHR: hr, _wasAdjusted: false, _source: 'rmtb-version', _prodVersion: getVersion(o) })),
          ...splitRemainders.filter(o => !isLiberada(o)).map(o => ({ ...o, _finalHR: hr, _wasAdjusted: false, _isSplit: true, _source: 'rmtb-version', _prodVersion: getVersion(o) })),
          ...adjustedIn.filter(o => !isLiberada(o)).map(o => ({ ...o, _finalHR: hr, _wasAdjusted: true, _source: 'rmtb-version', _prodVersion: getVersion(o) })),
        );
      });

      // RMTBM: se agrega SIEMPRE y sin ningún ajuste — sus órdenes tal como están hoy en SAP, solo
      // descontando las que se hayan bloqueado con el candado. No se redistribuye ni se recorta por
      // capacidad: si hay exceso, se sigue reportando aparte en su propia tarjeta.
      const rmtbM = uniquePuestos.find(p => { const u = p.toUpperCase(); return u.includes('RMTBM') || u.includes('RMTB-M'); });
      let ordenesRmtbM = 0;
      if (rmtbM) {
        const hrM = mapToHojaRutaInternal(rmtbM).trim().toUpperCase();
        const hojaSinPrefijoM = hrM.replace(/^HR-/, '');
        const ordsM = techFilteredOrdenes
          .filter(o => String(o['MAQUINA'] || o['Maquina'] || '').trim().toUpperCase() === hrM)
          .filter(o => !estaBloqueada(rmtbM, o))
          .map(o => ({
            ...o,
            _finalHR: hrM,
            _wasAdjusted: false,
            _source: 'rmtb-version',
            _prodVersion: versionPorMaterialAjusteRmtb.get(normalizeMaterialCode(o['MATERIAL'] || o['CodMaterial'] || ''))?.get(hojaSinPrefijoM)?.texto,
          }));
        ordenesRmtbM = ordsM.length;
        finalOrds.push(...ordsM);
      }

      setPlanFinalOrders(prev => [...prev.filter(o => o._source !== 'rmtb-version'), ...finalOrds]);
      setAjusteRmtbAceptado(true);
      const liberadasCount = liberadaMats.size > 0 ? ` · ${liberadaMats.size} BANDA${liberadaMats.size !== 1 ? 's' : ''} excluida${liberadaMats.size !== 1 ? 's' : ''} por cascada RMTBM` : '';
      const detalleM = ordenesRmtbM > 0 ? ` · RMTBM incluida sin ajuste (${ordenesRmtbM} orden(es))` : '';
      addNotification('success', isRmtbAjusteActivo
        ? `Ajuste de RMTB aceptado: ${rmtbVersionMovedOrders.length} orden(es) redistribuida(s) entre RMTB1/2/3${liberadasCount}${detalleM}. Ver pestaña Plan Final.`
        : `Plan ORIGINAL de RMTB1/2/3 + RMTBM aceptado sin ajuste (${finalOrds.length} orden(es), tal como están hoy en SAP). Ver pestaña Plan Final.`);
    } finally {
      setIsAceptandoAjusteRmtb(false);
    }
  }, [rmtb123PuestosActivos, uniquePuestos, mapToHojaRutaInternal, isRmtbAjusteActivo, rmtbExcludeKeysPorPuesto, rmtbAdjustedInPorPuesto, rmtbSplitRemaindersPorPuesto, techFilteredOrdenes, rmtbmBandaLiberada, rmtbVersionMovedOrders, bloqueoEfectivoPorPuesto, addNotification, versionPorMaterialAjusteRmtb, normalizeMaterialCode]);

  // Mantiene sincronizado el Plan Final de RMTB (RMTB1/2/3 + RMTBM) ya aceptado con el estado
  // vigente del candado — sin esto, bloquear un material DESPUÉS de aceptar dejaba la fila ya
  // exportada congelada con lo de antes del bloqueo.
  useEffect(() => {
    if (!ajusteRmtbAceptado) return;
    const { rmtb1, rmtb2, rmtb3 } = rmtb123PuestosActivos;
    const puestos = [rmtb1, rmtb2, rmtb3].filter(Boolean) as string[];
    const mk = (o: any) => `${o['ORDEN'] || o['ORDENPREVISIONAL'] || ''}|${String(o['MATERIAL'] || o['CodMaterial'] || '')}|${String(o['CANTIDAD'] || o['CANTPROGRAMADA'] || '')}`;
    const estaBloqueada = (puesto: string, o: any) => (ordenesBloqueadasPorPuesto.get(puesto) || new Set<string>()).has(mk(o));
    const liberadaMats = new Set(isRmtbAjusteActivo ? rmtbmBandaLiberada.map(item => item.material) : []);
    const isLiberada = (o: any) => liberadaMats.has(String(o['MATERIAL'] || o['CodMaterial'] || '').trim());
    const finalOrds: any[] = [];
    puestos.forEach(puesto => {
      const hr = mapToHojaRutaInternal(puesto).trim().toUpperCase();
      const hojaSinPrefijo = hr.replace(/^HR-/, '');
      const getVersion = (o: any) => {
        const mat = normalizeMaterialCode(o['MATERIAL'] || o['CodMaterial'] || '');
        return versionPorMaterialAjusteRmtb.get(mat)?.get(hojaSinPrefijo)?.texto;
      };
      const excludeKeys = isRmtbAjusteActivo ? (rmtbExcludeKeysPorPuesto.get(puesto) || new Set<string>()) : new Set<string>();
      const adjustedIn = isRmtbAjusteActivo ? (rmtbAdjustedInPorPuesto.get(puesto) || []) : [];
      const splitRemainders = isRmtbAjusteActivo ? (rmtbSplitRemaindersPorPuesto.get(puesto) || []) : [];
      const orig = techFilteredOrdenes.filter(o => String(o['MAQUINA'] || o['Maquina'] || '').trim().toUpperCase() === hr);
      finalOrds.push(
        ...orig.filter(o => !excludeKeys.has(mk(o)) && !isLiberada(o) && !estaBloqueada(puesto, o)).map(o => ({ ...o, _finalHR: hr, _wasAdjusted: false, _source: 'rmtb-version', _prodVersion: getVersion(o) })),
        ...splitRemainders.filter(o => !isLiberada(o)).map(o => ({ ...o, _finalHR: hr, _wasAdjusted: false, _isSplit: true, _source: 'rmtb-version', _prodVersion: getVersion(o) })),
        ...adjustedIn.filter(o => !isLiberada(o)).map(o => ({ ...o, _finalHR: hr, _wasAdjusted: true, _source: 'rmtb-version', _prodVersion: getVersion(o) })),
      );
    });
    const rmtbM = uniquePuestos.find(p => { const u = p.toUpperCase(); return u.includes('RMTBM') || u.includes('RMTB-M'); });
    if (rmtbM) {
      const hrM = mapToHojaRutaInternal(rmtbM).trim().toUpperCase();
      const hojaSinPrefijoM = hrM.replace(/^HR-/, '');
      finalOrds.push(
        ...techFilteredOrdenes
          .filter(o => String(o['MAQUINA'] || o['Maquina'] || '').trim().toUpperCase() === hrM)
          .filter(o => !estaBloqueada(rmtbM, o))
          .map(o => ({
            ...o,
            _finalHR: hrM,
            _wasAdjusted: false,
            _source: 'rmtb-version',
            _prodVersion: versionPorMaterialAjusteRmtb.get(normalizeMaterialCode(o['MATERIAL'] || o['CodMaterial'] || ''))?.get(hojaSinPrefijoM)?.texto,
          }))
      );
    }
    setPlanFinalOrders(prev => [...prev.filter(o => o._source !== 'rmtb-version'), ...finalOrds]);
  }, [ajusteRmtbAceptado, rmtb123PuestosActivos, uniquePuestos, mapToHojaRutaInternal, isRmtbAjusteActivo, rmtbExcludeKeysPorPuesto, rmtbAdjustedInPorPuesto, rmtbSplitRemaindersPorPuesto, techFilteredOrdenes, rmtbmBandaLiberada, bloqueoEfectivoPorPuesto, versionPorMaterialAjusteRmtb, normalizeMaterialCode]);

  // Cascada inversa RMTBM → RMTB3 (regla de negocio ya existente, sin cambios): llama
  // getMaestroMaterialesExplosion para cada material en exceso de RMTBM y cruza los componentes
  // devueltos con la asignación FINAL de RMTB3 (ya reasignada por versión).
  useEffect(() => {
    if (!rmtbmInfo || rmtbmInfo.excessOrders.length === 0) {
      setRmtbmBandaLiberada([]);
      return;
    }
    const excessOrders: any[] = rmtbmInfo.excessOrders;

    const uniqueMaterials = [...new Set(
      excessOrders.map((o: any) => String(o['MATERIAL'] || o['CodMaterial'] || '').trim())
    )].filter(Boolean) as string[];
    if (uniqueMaterials.length === 0) { setRmtbmBandaLiberada([]); return; }

    const rmtb3MatIndex = new Map<string, any>(
      rmtb3FinalOrders.map(o => [String(o['MATERIAL'] || o['CodMaterial'] || '').trim(), o])
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
  }, [rmtbmInfo, rmtb3FinalOrders]);

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
      return capacidadPuesto(p, cfg, horasNetasDiurnasVal, horasNetasNocturnasVal, horasNetasFinSemanaVal);
    };
    const getHours = (o: any) => calculateProductionTime(o['MATERIAL'] || o['CodMaterial'] || '', Number(o['CANTIDAD'] || o['CANTPROGRAMADA'] || 0), o) / 3600;

    // Una orden solo puede moverse a otra máquina si ESA máquina tiene tiempo estándar registrado
    // para su material. CORTELA10 (tela: 274 materiales en HR-CTBSC/CTCHN/CTINT/CTBAN) y
    // CORTE-ESPUMA (espuma: solo los rollos 30026039/30026042 en HR-CTESP) no comparten producción
    // real — verificado contra los tiempos de SAP. Sin este chequeo la cascada podía mandarle a
    // CORTE-ESPUMA una orden de tela que esa máquina no puede cortar. Mismo criterio que usa
    // `asignarOptimoPorVersion`, donde los candidatos SIEMPRE salen de los tiempos estándar.
    const puedeFabricar = (order: any, puesto: string) => {
      const mat = normalizeMaterialCode(order['MATERIAL'] || order['CodMaterial'] || '');
      const timesList: any[] = tiemposIndexRef.current[mat] || [];
      const objetivo = puesto.trim().toUpperCase();
      return timesList.some((t: any) =>
        String(t.PuestoTrabajo || t.nombre_estacion || t.Maquina || '').trim().toUpperCase() === objetivo
      );
    };

    const machineFullHRs = activeMachines.map(getFullHR);
    const machineHRLists = machineFullHRs.map(getHRList);
    const machineCaps = activeMachines.map(getCap);
    const EPS = 0.001;

    // Fase 1: cada máquina reserva SU PROPIA producción natural — lo que ya le cabe hoy no se
    // toca, sin importar la utilización de la otra máquina (nunca "equilibrar por parejo" algo
    // que ya cabía bien). Solo lo que no cupo en su propia máquina pasa a la Fase 2 como excedente.
    const capacidadRestante = [...machineCaps];
    const pendientes: { order: any; origIdx: number }[] = [];
    activeMachines.forEach((_, idx) => {
      const ordersDeEstaMaquina = techFilteredOrdenes
        .filter(o => machineHRLists[idx].includes(String(o['MAQUINA'] || o['Maquina'] || '').trim().toUpperCase()))
        .sort((a, b) => getHours(b) - getHours(a));
      ordersDeEstaMaquina.forEach(order => {
        const h = getHours(order);
        if (h <= capacidadRestante[idx] + EPS) {
          capacidadRestante[idx] -= h;
        } else {
          pendientes.push({ order, origIdx: idx });
        }
      });
    });

    // Fase 2: cascada del excedente hacia la OTRA máquina con espacio libre (tras haber reservado
    // lo de cada una en la Fase 1) — de mayor a menor duración, para minimizar lo que quede sin ubicar.
    const moved: { order: any; fromHR: string; toHR: string }[] = [];
    pendientes
      .sort((a, b) => getHours(b.order) - getHours(a.order))
      .forEach(({ order, origIdx }) => {
        const h = getHours(order);
        for (let j = 0; j < activeMachines.length; j++) {
          if (j === origIdx) continue;
          if (!puedeFabricar(order, activeMachines[j])) continue;
          if (h <= capacidadRestante[j] + EPS) {
            capacidadRestante[j] -= h;
            moved.push({ order, fromHR: machineFullHRs[origIdx], toHR: machineFullHRs[j] });
            break;
          }
        }
        // Si no cabe en ninguna otra máquina, se queda en su origen y aparece como exceso genuino
        // (no se fuerza el movimiento — mismo criterio que Acolchado: nunca mover sin necesidad).
      });

    setCorteMovedOrders(moved);
    setIsCorteAdjustActive(true);
  }, [isCorteAdjustActive, uniquePuestos, mapToHojaRutaInternal, workstationConfigs, horasNetasDiurnasVal, horasNetasNocturnasVal, horasNetasFinSemanaVal, techFilteredOrdenes, calculateProductionTime, normalizeMaterialCode]);

  // Se calcula SIEMPRE (no solo con el ajuste activo) para poder ofrecer "Aceptar Plan" sin ajuste:
  // sin él, corteMovedOrders ya viene vacío (se resetea al apagar el toggle), así que el resumen
  // simplemente refleja la carga natural de cada máquina, sin ninguna redistribución.
  const corteAdjustSummary = useMemo(() => {
    const cortela10 = uniquePuestos.find(p => p.toUpperCase().includes('CORTELA10'));
    const corteEspuma = uniquePuestos.find(p => p.toUpperCase() === 'CORTE-ESPUMA');

    const makeKey = (o: any) => `${o['ORDEN'] || o['ORDENPREVISIONAL'] || ''}|${String(o['MATERIAL'] || o['CodMaterial'] || '')}|${String(o['CANTIDAD'] || o['CANTPROGRAMADA'] || '')}`;
    const getHours = (o: any) => calculateProductionTime(o['MATERIAL'] || o['CodMaterial'] || '', Number(o['CANTIDAD'] || o['CANTPROGRAMADA'] || 0), o) / 3600;
    const getFullHR = (p: string) => mapToHojaRutaInternal(p).trim().toUpperCase();
    const getCap = (p: string) => {
      const cfg = workstationConfigs[p] || { isDayActive: true, isNightActive: false, machines: 1 };
      return capacidadPuesto(p, cfg, horasNetasDiurnasVal, horasNetasNocturnasVal, horasNetasFinSemanaVal);
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
  }, [corteMovedOrders, uniquePuestos, mapToHojaRutaInternal, workstationConfigs, horasNetasDiurnasVal, horasNetasNocturnasVal, horasNetasFinSemanaVal, techFilteredOrdenes, calculateProductionTime]);

  const handleAcceptCorteAdjustForMachine = useCallback((machineFullHR: string, machineName: string) => {
    if (!corteAdjustSummary || corteAcceptedMachines.has(machineFullHR)) return;
    const makeKey = (o: any) => `${o['ORDEN'] || o['ORDENPREVISIONAL'] || ''}|${String(o['MATERIAL'] || o['CodMaterial'] || '')}|${String(o['CANTIDAD'] || o['CANTPROGRAMADA'] || '')}`;
    const machineSummary = corteAdjustSummary.machines.find(m => m?.hrCode === machineFullHR);
    // Sin el ajuste activo se acepta el plan ORIGINAL tal cual (nada se excluye ni se redistribuye):
    // el resumen ahora se calcula siempre, pero solo se APLICA si el usuario encendió "Ajuste de
    // Producción" para Corte — mismo criterio que Acolchado/Bandas/RMTB.
    const excessKeys = isCorteAdjustActive ? new Set((machineSummary?.excessOrders || []).map(makeKey)) : new Set<string>();
    const movedOutKeys = isCorteAdjustActive ? new Set(corteMovedOrders.filter(m => m.fromHR === machineFullHR).map(m => makeKey(m.order))) : new Set<string>();
    const movedInOrders = isCorteAdjustActive ? corteMovedOrders.filter(m => m.toHR === machineFullHR).map(m => m.order) : [];
    // `machineName` es el nombre del puesto — mismo valor con el que el candado de bloqueo
    // (`ordenesBloqueadasPorPuesto`) guarda las órdenes de esta tarjeta. Faltaba este filtro.
    const bloqueadas = ordenesBloqueadasPorPuesto.get(machineName) || new Set<string>();
    const hrList = machineFullHR.includes('/') ? machineFullHR.split('/').map(c => c.trim()) : [machineFullHR];
    const machineOrders = [
      ...techFilteredOrdenes
        .filter(o => hrList.includes(String(o['MAQUINA'] || o['Maquina'] || '').trim().toUpperCase()) && !movedOutKeys.has(makeKey(o)) && !excessKeys.has(makeKey(o)) && !bloqueadas.has(makeKey(o)))
        .map(o => ({ ...o, _finalHR: machineFullHR, _wasAdjusted: false, _source: `corte-${machineFullHR}` })),
      ...movedInOrders.filter(o => !excessKeys.has(makeKey(o)) && !bloqueadas.has(makeKey(o))).map(o => ({ ...o, _finalHR: machineFullHR, _wasAdjusted: true, _source: `corte-${machineFullHR}` })),
    ];
    setPlanFinalOrders(prev => [...prev.filter(o => o._source !== `corte-${machineFullHR}`), ...machineOrders]);
    setCorteAcceptedMachines(prev => new Set([...prev, machineFullHR]));
    const totalMoves = isCorteAdjustActive ? corteMovedOrders.filter(m => m.toHR === machineFullHR || m.fromHR === machineFullHR).length : 0;
    addNotification('success', isCorteAdjustActive
      ? `Ajuste aceptado para ${machineName}: ${totalMoves} ${totalMoves === 1 ? 'orden redistribuida' : 'órdenes redistribuidas'}. Ver pestaña Plan Final.`
      : `Plan ORIGINAL de ${machineName} aceptado sin ajuste (${machineOrders.length} orden(es), tal como está hoy en SAP). Ver pestaña Plan Final.`);
  }, [corteAdjustSummary, corteAcceptedMachines, corteMovedOrders, techFilteredOrdenes, addNotification, isCorteAdjustActive, ordenesBloqueadasPorPuesto]);

  // Mantiene sincronizadas las máquinas de Corte YA aceptadas con el estado vigente del candado —
  // sin esto, bloquear un material DESPUÉS de aceptar dejaba la fila ya exportada congelada con lo
  // de antes del bloqueo (el usuario reportó tener que bloquear dos veces: en la app y en SAP).
  useEffect(() => {
    if (!corteAdjustSummary || corteAcceptedMachines.size === 0) return;
    const makeKey = (o: any) => `${o['ORDEN'] || o['ORDENPREVISIONAL'] || ''}|${String(o['MATERIAL'] || o['CodMaterial'] || '')}|${String(o['CANTIDAD'] || o['CANTPROGRAMADA'] || '')}`;
    setPlanFinalOrders(prev => {
      let next = prev;
      corteAcceptedMachines.forEach(machineFullHR => {
        const machineSummary = corteAdjustSummary.machines.find(m => m?.hrCode === machineFullHR);
        const machineName = machineSummary?.name ?? machineFullHR;
        const excessKeys = isCorteAdjustActive ? new Set((machineSummary?.excessOrders || []).map(makeKey)) : new Set<string>();
        const movedOutKeys = isCorteAdjustActive ? new Set(corteMovedOrders.filter(m => m.fromHR === machineFullHR).map(m => makeKey(m.order))) : new Set<string>();
        const movedInOrders = isCorteAdjustActive ? corteMovedOrders.filter(m => m.toHR === machineFullHR).map(m => m.order) : [];
        const bloqueadas = ordenesBloqueadasPorPuesto.get(machineName) || new Set<string>();
        const hrList = machineFullHR.includes('/') ? machineFullHR.split('/').map(c => c.trim()) : [machineFullHR];
        const source = `corte-${machineFullHR}`;
        const machineOrders = [
          ...techFilteredOrdenes
            .filter(o => hrList.includes(String(o['MAQUINA'] || o['Maquina'] || '').trim().toUpperCase()) && !movedOutKeys.has(makeKey(o)) && !excessKeys.has(makeKey(o)) && !bloqueadas.has(makeKey(o)))
            .map(o => ({ ...o, _finalHR: machineFullHR, _wasAdjusted: false, _source: source })),
          ...movedInOrders.filter(o => !excessKeys.has(makeKey(o)) && !bloqueadas.has(makeKey(o))).map(o => ({ ...o, _finalHR: machineFullHR, _wasAdjusted: true, _source: source })),
        ];
        next = [...next.filter(o => o._source !== source), ...machineOrders];
      });
      return next;
    });
  }, [corteAdjustSummary, corteAcceptedMachines, corteMovedOrders, techFilteredOrdenes, isCorteAdjustActive, ordenesBloqueadasPorPuesto]);

  // ─── Utilidad compartida: bin-packing genérico ────────────────────────────
  const binPackGroup = useCallback((groupPuestos: string[]): { order: any; fromHR: string; toHR: string }[] => {
    if (groupPuestos.length < 2) return [];
    const getFullHR = (p: string) => mapToHojaRutaInternal(p).trim().toUpperCase();
    const getHRList = (hr: string) => hr.split('/').map(c => c.trim()).filter(Boolean);
    const getCap = (p: string) => { const cfg = workstationConfigs[p] || { isDayActive: true, isNightActive: false, machines: 1 }; return capacidadPuesto(p, cfg, horasNetasDiurnasVal, horasNetasNocturnasVal, horasNetasFinSemanaVal); };
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
  }, [mapToHojaRutaInternal, workstationConfigs, horasNetasDiurnasVal, horasNetasNocturnasVal, horasNetasFinSemanaVal, techFilteredOrdenes, calculateProductionTime]);

  // ─── Utilidad compartida: resumen de capacidad genérico ──────────────────
  const buildGroupCapSummary = useCallback((groupPuestos: string[], movedOrders: { order: any; fromHR: string; toHR: string }[]) => {
    const getFullHR = (p: string) => mapToHojaRutaInternal(p).trim().toUpperCase();
    const getCap = (p: string) => { const cfg = workstationConfigs[p] || { isDayActive: true, isNightActive: false, machines: 1 }; return capacidadPuesto(p, cfg, horasNetasDiurnasVal, horasNetasNocturnasVal, horasNetasFinSemanaVal); };
    const getH = (o: any) => calculateProductionTime(o['MATERIAL'] || o['CodMaterial'] || '', Number(o['CANTIDAD'] || o['CANTPROGRAMADA'] || 0), o) / 3600;
    const mk = (o: any) => `${o['ORDEN'] || o['ORDENPREVISIONAL'] || ''}|${String(o['MATERIAL'] || o['CodMaterial'] || '')}|${String(o['CANTIDAD'] || o['CANTPROGRAMADA'] || '')}`;
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
  }, [mapToHojaRutaInternal, workstationConfigs, horasNetasDiurnasVal, horasNetasNocturnasVal, horasNetasFinSemanaVal, techFilteredOrdenes, calculateProductionTime]);

  // ─── Utilidad compartida: aceptar ajuste por máquina ────────────────────
  // `isActive` es el toggle "Ajuste de Producción" del grupo (BSC/INTPF/TTCHN). El resumen
  // (`summary`) ahora se calcula SIEMPRE (para poder mostrar el botón "Aceptar Plan" aunque el
  // ajuste esté apagado), así que la exclusión de excedente y de órdenes movidas solo debe
  // aplicarse cuando el ajuste está realmente activo — si no, se acepta el plan ORIGINAL tal cual
  // está hoy en SAP, sin recortar nada (mismo criterio que Acolchado/Bandas/RMTB).
  // Cálculo puro (sin notificar ni marcar como aceptado) de las filas de Plan Final para UNA
  // máquina del grupo — lo usan tanto el click de "Aceptar" (`acceptGroupAdjust`, primera vez) como
  // el efecto de resincronización (re-ejecuta esto para lo que YA estaba aceptado, cada vez que
  // cambia algo relevante, incluido el candado — ver comentario en `acceptGroupAdjust`).
  const computeFinalOrdsGrupo = useCallback((
    machineFullHR: string, machineName: string,
    summary: ReturnType<typeof buildGroupCapSummary> | null,
    movedOrds: { order: any; fromHR: string; toHR: string }[],
    isActive: boolean
  ) => {
    const mk = (o: any) => `${o['ORDEN'] || o['ORDENPREVISIONAL'] || ''}|${String(o['MATERIAL'] || o['CodMaterial'] || '')}|${String(o['CANTIDAD'] || o['CANTPROGRAMADA'] || '')}`;
    const mSum = summary?.machines.find(m => m.hrCode === machineFullHR);
    const excessKeys = isActive ? new Set((mSum?.excessOrders || []).map(mk)) : new Set<string>();
    const outKeys = isActive ? new Set(movedOrds.filter(m => m.fromHR === machineFullHR).map(m => mk(m.order))) : new Set<string>();
    const inOrds = isActive ? movedOrds.filter(m => m.toHR === machineFullHR).map(m => m.order) : [];
    // `bloqueoEfectivoPorPuesto` (no el mapa manual crudo): incluye también lo bloqueado en cascada
    // por relación de BOM con el puesto pareja (ej. INTPF ↔ INTPR/INTPT) — ver esa constante.
    const bloqueadas = bloqueoEfectivoPorPuesto.get(machineName) || new Set<string>();
    const hrList = machineFullHR.includes('/') ? machineFullHR.split('/').map(c => c.trim()) : [machineFullHR];
    return [
      ...techFilteredOrdenes.filter(o => hrList.includes(String(o['MAQUINA'] || o['Maquina'] || '').trim().toUpperCase()) && !outKeys.has(mk(o)) && !excessKeys.has(mk(o)) && !bloqueadas.has(mk(o))).map(o => ({ ...o, _finalHR: machineFullHR, _wasAdjusted: false, _source: '' })),
      ...inOrds.filter(o => !excessKeys.has(mk(o)) && !bloqueadas.has(mk(o))).map(o => ({ ...o, _finalHR: machineFullHR, _wasAdjusted: true, _source: '' })),
    ];
  }, [techFilteredOrdenes, bloqueoEfectivoPorPuesto]);

  const acceptGroupAdjust = useCallback((
    machineFullHR: string, machineName: string, sourcePrefix: string,
    summary: ReturnType<typeof buildGroupCapSummary> | null,
    acceptedSet: Set<string>, setAccepted: (fn: (prev: Set<string>) => Set<string>) => void,
    movedOrds: { order: any; fromHR: string; toHR: string }[],
    isActive: boolean
  ) => {
    if (!summary || acceptedSet.has(machineFullHR)) return;
    const source = `${sourcePrefix}-${machineFullHR}`;
    const finalOrds = computeFinalOrdsGrupo(machineFullHR, machineName, summary, movedOrds, isActive).map(o => ({ ...o, _source: source }));
    setPlanFinalOrders(prev => [...prev.filter(o => o._source !== source), ...finalOrds]);
    setAccepted(prev => new Set([...prev, machineFullHR]));
    const moves = isActive ? movedOrds.filter(m => m.toHR === machineFullHR || m.fromHR === machineFullHR).length : 0;
    addNotification('success', isActive
      ? `Ajuste aceptado para ${machineName}: ${moves} ${moves === 1 ? 'orden redistribuida' : 'órdenes redistribuidas'}. Ver pestaña Plan Final.`
      : `Plan ORIGINAL de ${machineName} aceptado sin ajuste (${finalOrds.length} orden(es), tal como está hoy en SAP). Ver pestaña Plan Final.`);
  }, [computeFinalOrdsGrupo, addNotification]);

  // Mantiene sincronizadas las máquinas YA aceptadas de un grupo (BSC/INTPF/TTCHN) con el estado
  // vigente del candado — sin esto, bloquear un material DESPUÉS de aceptar dejaba la fila ya
  // exportada congelada con lo de antes del bloqueo (había que acordarse de reaceptar a mano).
  const resyncGrupoAceptado = useCallback((
    sourcePrefix: string,
    acceptedSet: Set<string>,
    summary: ReturnType<typeof buildGroupCapSummary>,
    movedOrds: { order: any; fromHR: string; toHR: string }[],
    isActive: boolean
  ) => {
    if (acceptedSet.size === 0) return;
    setPlanFinalOrders(prev => {
      let next = prev;
      acceptedSet.forEach(machineFullHR => {
        const machineName = summary.machines.find(m => m?.hrCode === machineFullHR)?.name ?? machineFullHR;
        const source = `${sourcePrefix}-${machineFullHR}`;
        const finalOrds = computeFinalOrdsGrupo(machineFullHR, machineName, summary, movedOrds, isActive).map(o => ({ ...o, _source: source }));
        next = [...next.filter(o => o._source !== source), ...finalOrds];
      });
      return next;
    });
  }, [computeFinalOrdsGrupo]);

  // ─── PROCESO DE BASES (COSEDORA-BSC-CC + COSEDORA-BSCTP) ────────────────
  // Procesos independientes — sin redistribución entre máquinas
  const handleBscAdjust = useCallback(() => {
    if (isBscAdjustActive) { setIsBscAdjustActive(false); setBscAcceptedMachines(new Set()); setBscMovedOrders([]); setPlanFinalOrders(prev => prev.filter(o => !String(o._source || '').startsWith('bsc-'))); return; }
    setBscMovedOrders([]);
    setIsBscAdjustActive(true);
  }, [isBscAdjustActive]);

  // Se calcula SIEMPRE (no solo con el ajuste activo) para poder ofrecer "Aceptar Plan" sin ajuste:
  // sin él, bscMovedOrders ya viene vacío (se resetea al apagar el toggle), así que el resumen
  // simplemente refleja la carga natural de cada máquina, sin ninguna redistribución.
  const bscAdjustSummary = useMemo(() => {
    const puestos = uniquePuestos.filter(p => p.toUpperCase() === 'COSEDORA-BSC-CC' || p.toUpperCase() === 'COSEDORA-BSCTP');
    return buildGroupCapSummary(puestos, bscMovedOrders);
  }, [bscMovedOrders, uniquePuestos, buildGroupCapSummary]);

  const handleAcceptBscForMachine = useCallback((hr: string, name: string) =>
    acceptGroupAdjust(hr, name, 'bsc', bscAdjustSummary, bscAcceptedMachines, setBscAcceptedMachines, bscMovedOrders, isBscAdjustActive),
  [acceptGroupAdjust, bscAdjustSummary, bscAcceptedMachines, bscMovedOrders, isBscAdjustActive]);

  useEffect(() => {
    resyncGrupoAceptado('bsc', bscAcceptedMachines, bscAdjustSummary, bscMovedOrders, isBscAdjustActive);
  }, [resyncGrupoAceptado, bscAcceptedMachines, bscAdjustSummary, bscMovedOrders, isBscAdjustActive]);

  // ─── PROCESO DE INTERIORES (COSEDORA-INTPF + INTPR + INTPT) ─────────────
  // Procesos independientes — sin redistribución. INTPF es prerequisito de INTPR e INTPT.
  const handleIntpfAdjust = useCallback(() => {
    if (isIntpfAdjustActive) { setIsIntpfAdjustActive(false); setIntpfAcceptedMachines(new Set()); setIntpfMovedOrders([]); setPlanFinalOrders(prev => prev.filter(o => !String(o._source || '').startsWith('intpf-'))); return; }
    setIntpfMovedOrders([]);
    setIsIntpfAdjustActive(true);
  }, [isIntpfAdjustActive]);

  // Se calcula SIEMPRE (ver comentario equivalente en bscAdjustSummary).
  const intpfAdjustSummary = useMemo(() => {
    const puestos = uniquePuestos.filter(p => p.toUpperCase() === 'COSEDORA-INTPF' || p.toUpperCase() === 'COSEDORA-INTPR' || p.toUpperCase() === 'COSEDORA-INTPT');
    return buildGroupCapSummary(puestos, intpfMovedOrders);
  }, [intpfMovedOrders, uniquePuestos, buildGroupCapSummary]);

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
    acceptGroupAdjust(hr, name, 'intpf', intpfAdjustSummary, intpfAcceptedMachines, setIntpfAcceptedMachines, intpfMovedOrders, isIntpfAdjustActive),
  [acceptGroupAdjust, intpfAdjustSummary, intpfAcceptedMachines, intpfMovedOrders, isIntpfAdjustActive]);

  useEffect(() => {
    resyncGrupoAceptado('intpf', intpfAcceptedMachines, intpfAdjustSummary, intpfMovedOrders, isIntpfAdjustActive);
  }, [resyncGrupoAceptado, intpfAcceptedMachines, intpfAdjustSummary, intpfMovedOrders, isIntpfAdjustActive]);

  // ─── PROCESO TAPA SUPERIOR CHN (COSEDORA-TTCHN + COSEDORA-TTSUP-CHN — independientes) ───
  const handleTtchnAdjust = useCallback(() => {
    if (isTtchnAdjustActive) { setIsTtchnAdjustActive(false); setTtchnAcceptedMachines(new Set()); setTtchnMovedOrders([]); setPlanFinalOrders(prev => prev.filter(o => !String(o._source || '').startsWith('ttchn-'))); return; }
    setTtchnMovedOrders([]);
    setIsTtchnAdjustActive(true);
  }, [isTtchnAdjustActive]);

  // Se calcula SIEMPRE (ver comentario equivalente en bscAdjustSummary).
  const ttchnAdjustSummary = useMemo(() => {
    const puestos = uniquePuestos.filter(p => p.toUpperCase() === 'COSEDORA-TTCHN' || p.toUpperCase() === 'COSEDORA-TTSUP-CHN');
    return buildGroupCapSummary(puestos, ttchnMovedOrders);
  }, [ttchnMovedOrders, uniquePuestos, buildGroupCapSummary]);

  const handleAcceptTtchnForMachine = useCallback((hr: string, name: string) =>
    acceptGroupAdjust(hr, name, 'ttchn', ttchnAdjustSummary, ttchnAcceptedMachines, setTtchnAcceptedMachines, ttchnMovedOrders, isTtchnAdjustActive),
  [acceptGroupAdjust, ttchnAdjustSummary, ttchnAcceptedMachines, ttchnMovedOrders, isTtchnAdjustActive]);

  useEffect(() => {
    resyncGrupoAceptado('ttchn', ttchnAcceptedMachines, ttchnAdjustSummary, ttchnMovedOrders, isTtchnAdjustActive);
  }, [resyncGrupoAceptado, ttchnAcceptedMachines, ttchnAdjustSummary, ttchnMovedOrders, isTtchnAdjustActive]);

  // `isActive` es el toggle "Ajuste de Producción" del grupo. Antes el botón decía "Aceptar
  // Ajuste" SIEMPRE, aunque el ajuste estuviera apagado y la función ya aceptara el plan ORIGINAL
  // sin tocar nada — el texto hacía pensar que era obligatorio activar el ajuste para poder
  // aceptar, y el usuario nunca llegaba a probar el botón con el toggle apagado.
  const renderGenericGroupPanel = (
    summary: ReturnType<typeof buildGroupCapSummary>,
    acceptedMachines: Set<string>,
    onAccept: (hr: string, name: string) => void,
    title: string,
    borderCls: string,
    bgCls: string,
    iconBgCls: string,
    isActive: boolean
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
            {!isActive && (
              <p className="text-slate-700 leading-relaxed"><span className="font-black text-slate-800">— Ajuste no activado.</span> Se puede "Aceptar Plan" tal como está hoy en SAP, o presionar "Ajuste de Producción" arriba para redistribuir entre las máquinas del grupo primero.</p>
            )}
            {isActive && (summary.totalMoved > 0
              ? <p className="text-slate-700 leading-relaxed"><span className="font-black text-slate-800">↔ Se redistribuyeron {summary.totalMoved} {summary.totalMoved === 1 ? 'orden' : 'órdenes'}</span> entre las máquinas del grupo para equilibrar la carga operativa.</p>
              : <p className="text-slate-700 leading-relaxed"><span className="font-black text-slate-700">— Sin redistribución necesaria.</span> La carga está equilibrada entre las máquinas del grupo.</p>
            )}
            {summary.machines.some(m => m && m.finalUtil > 100) && (
              <p className="text-slate-700 leading-relaxed">
                <span className="font-black text-red-600 inline-flex items-center gap-1"><AlertTriangle className="w-3 h-3 shrink-0" /> {summary.machines.filter(m => m && m.finalUtil > 100).length} {summary.machines.filter(m => m && m.finalUtil > 100).length === 1 ? 'máquina supera' : 'máquinas superan'} la capacidad:</span>{' '}
                {allExcess.length} {allExcess.length === 1 ? 'orden no puede producirse' : 'órdenes no pueden producirse'} en el período. Se recomienda diferir al siguiente ciclo.
              </p>
            )}
            {summary.machines.some(m => m && m.finalUtil < 95 && m.finalUtil <= 100) && (
              <p className="text-slate-700 leading-relaxed">
                <span className="font-black text-amber-700 inline-flex items-center gap-1"><TrendingUp className="w-3 h-3 shrink-0" /> {summary.machines.filter(m => m && m.finalUtil < 95).length} {summary.machines.filter(m => m && m.finalUtil < 95).length === 1 ? 'máquina está' : 'máquinas están'} debajo del objetivo (95%):</span> Tienen capacidad disponible sin utilizar.
              </p>
            )}
            {!summary.machines.some(m => m && m.finalUtil > 100) && !summary.machines.some(m => m && m.finalUtil < 95) && (
              <p className="text-slate-700 leading-relaxed"><span className="font-black text-green-700 inline-flex items-center gap-1"><CheckCircle2 className="w-3 h-3 shrink-0" /> Todas las máquinas del grupo están en rango óptimo (95–100%) tras la redistribución.</span></p>
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
                        {isAccepted ? 'Aceptado ✓' : isActive ? 'Aceptar Ajuste' : 'Aceptar Plan'}
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
                    const cfg = workstationConfigs[m.name] || { isDayActive: true, isNightActive: false, isSaturdayActive: false, peopleDay: 0, peopleNight: 0, peopleWeekend: 0, machines: 1 };
                    const mc = cfg.machines || 1;
                    const dayH = horasNetasDiurnasVal * mc;
                    const nightH = horasNetasNocturnasVal * mc;
                    const shortage = m.finalHours - m.cap;
                    const free = m.cap - m.finalHours;
                    const personas = (cfg.peopleDay || 0) + (cfg.peopleNight || 0);
                    const turno = cfg.isNightActive ? 'diurno + nocturno' : 'diurno';

                    if (m.realUtil > 100) {
                      if (!cfg.isNightActive && nightH > 0) {
                        const newCap = m.cap + nightH;
                        const wouldFit = m.finalHours <= newCap;
                        const newUtil = ((m.finalHours / newCap) * 100).toFixed(0);
                        return (
                          <div className="rounded-xl bg-blue-50 border border-blue-200 px-3 py-2 space-y-1">
                            <p className="text-[8px] font-black uppercase text-blue-700 tracking-widest">Recomendación de turno</p>
                            <p className="text-[9px] text-blue-800 leading-relaxed flex items-start gap-1">
                              <Lightbulb className="w-3 h-3 shrink-0 mt-0.5" />
                              <span>Activar <span className="font-black">turno nocturno</span> añade {nightH.toFixed(1)} h.{' '}
                              {wouldFit ? `Todas las órdenes cabrían — ocupación ${newUtil}%.` : `Ocupación bajaría a ${newUtil}% pero aún quedarían órdenes en exceso.`}</span>
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
                            <p className="text-[9px] text-orange-800 leading-relaxed flex items-start gap-1">
                              <AlertTriangle className="w-3 h-3 shrink-0 mt-0.5" />
                              <span>Ambos turnos activos · <span className="font-black">{personas} operador{personas !== 1 ? 'es' : ''}</span>. Faltan <span className="font-black">{shortage.toFixed(1)} h</span>.{' '}
                              Añadir <span className="font-black">{extraPeople} operador{extraPeople !== 1 ? 'es' : ''} adicional{extraPeople !== 1 ? 'es' : ''}</span> cubriría el déficit, o diferir {m.excessOrders.length} orden{m.excessOrders.length !== 1 ? 'es' : ''} al siguiente ciclo.</span>
                            </p>
                          </div>
                        );
                      }
                    }

                    if (m.realUtil >= 95 && m.realUtil <= 100) {
                      return (
                        <div className="rounded-xl bg-green-50 border border-green-200 px-3 py-2">
                          <p className="text-[9px] text-green-700 leading-relaxed flex items-start gap-1">
                            <CheckCircle2 className="w-3 h-3 shrink-0 mt-0.5" />
                            <span>Turno <span className="font-black">{turno}</span>{personas > 0 ? ` · ${personas} operador${personas !== 1 ? 'es' : ''}` : ''} — configuración óptima para este período.</span>
                          </p>
                        </div>
                      );
                    }

                    if (m.realUtil < 95 && m.realUtil > 0) {
                      if (cfg.isNightActive && dayH > 0 && m.finalHours <= dayH) {
                        return (
                          <div className="rounded-xl bg-slate-50 border border-slate-200 px-3 py-2 space-y-1">
                            <p className="text-[8px] font-black uppercase text-slate-500 tracking-widest">Recomendación de turno</p>
                            <p className="text-[9px] text-slate-600 leading-relaxed flex items-start gap-1">
                              <Lightbulb className="w-3 h-3 shrink-0 mt-0.5" />
                              <span>Las órdenes caben en <span className="font-black">solo turno diurno</span> ({(m.finalHours / dayH * 100).toFixed(0)}% del día).{' '}
                              Considera desactivar el turno nocturno{personas > 0 ? ` y liberar ${personas} operador${personas !== 1 ? 'es' : ''} para otras áreas` : ''}.</span>
                            </p>
                          </div>
                        );
                      }
                      return (
                        <div className="rounded-xl bg-slate-50 border border-slate-200 px-3 py-2 space-y-1">
                          <p className="text-[8px] font-black uppercase text-slate-500 tracking-widest">Capacidad libre</p>
                          <p className="text-[9px] text-slate-600 leading-relaxed flex items-start gap-1">
                            <TrendingUp className="w-3 h-3 shrink-0 mt-0.5" />
                            <span>Sin usar: <span className="font-black">{free.toFixed(1)} h</span> · Turno {turno}{personas > 0 ? ` · ${personas} operador${personas !== 1 ? 'es' : ''}` : ''}.{' '}
                            Se puede asignar más producción o reducir la jornada.</span>
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

  // Ventana flotante bloqueante para procesos de explosión de componentes y de guardado de
  // planes: mientras cualquiera de estos está en curso, se cubre toda la pantalla (sin
  // pointer-events-none, así que nada debajo es clickeable) mostrando en qué proceso está y,
  // si aplica, el % de avance ya trackeado por cada handler. isAplicandoP1/isRegenerandoP15
  // viven dentro de CapacidadComparacionPanel (no en este componente), así que llegan acá
  // vía el callback onProcessChange → subPanelProcess.
  const activeProcess = useMemo(() => {
    if (isLoadingNivelExplosion) return { label: 'Explosionando Nivel 1 — Forro', progress: nivelExplosionProgress };
    if (isLoadingNivel2) return { label: 'Explosionando Nivel 2 — Tapa', progress: nivel2Progress };
    if (isLoadingNivel3) return { label: 'Explosionando Nivel 3 — Acolchado', progress: nivel3Progress };
    if (isLoadingNivel3Banda) return { label: 'Explosionando Nivel 3 — Banda en Metros', progress: nivel3BandaProgress };
    if (isLoadingNivel4) return { label: 'Explosionando Nivel 4 — Lámina', progress: nivel4Progress };
    if (isLoadingNivel4Banda) return { label: 'Explosionando Nivel 4 — Lámina desde Banda', progress: null as number | null };
    if (isLoadingExplosion) return { label: 'Consultando Lista de Materiales (Órdenes FERT)', progress: explosionProgress };
    if (isLoadingListaMateriales) return { label: 'Descargando Lista de Materiales', progress: bomDownloadProgress };
    if (isSavingPlanNivel4) return { label: 'Guardando Plan Táctico (P1.5 / P2)', progress: null as number | null };
    if (subPanelProcess) return subPanelProcess;
    return null;
  }, [
    isLoadingNivelExplosion, nivelExplosionProgress,
    isLoadingNivel2, nivel2Progress,
    isLoadingNivel3, nivel3Progress,
    isLoadingNivel3Banda, nivel3BandaProgress,
    isLoadingNivel4, nivel4Progress,
    isLoadingNivel4Banda,
    isLoadingExplosion, explosionProgress,
    isLoadingListaMateriales, bomDownloadProgress,
    isSavingPlanNivel4, subPanelProcess,
  ]);

  // Ocupación por Hoja de Ruta (misma fórmula que "Salud de Planta"): puestos que comparten HR se
  // agrupan como un solo POOL — tiempo requerido y capacidad se suman entre todos antes de sacar el
  // %, nunca por puesto aislado (si no, un pool de 2 máquinas mostraría el doble de ocupación de la
  // que realmente tiene). Se extrae a un solo memo para que "Salud de Planta" y el dashboard de
  // "Horarios y Turnos" muestren SIEMPRE el mismo número para el mismo puesto.
  const ocupacionPorHR = useMemo(() => {
    const hrGroups = new Map<string, { name: string; puestos: string[] }>();
    uniquePuestos.forEach(p => {
      const hr = mapToHojaRutaInternal(p) || 'S/HR';
      if (!hrGroups.has(hr)) hrGroups.set(hr, { name: p, puestos: [] });
      hrGroups.get(hr)!.puestos.push(p);
    });
    const resultado = new Map<string, { hrCode: string; puestos: string[]; totalUnits: number; totalTimeHours: number; totalCapacityHours: number; utilization: number; yaAceptado: boolean }>();
    hrGroups.forEach((groupInfo, hrCodeFromMaestro) => {
      const coincideHR = (valor: string) => {
        const v = String(valor || '').trim().toUpperCase();
        if (hrCodeFromMaestro.includes(' / ')) {
          const codes = hrCodeFromMaestro.split(' / ').map(c => c.trim().toUpperCase());
          return codes.includes(v);
        }
        return v === hrCodeFromMaestro;
      };
      const ordenesCrudas = techFilteredOrdenes.filter(o => coincideHR(String(o['MAQUINA'] || o['Maquina'] || '')));
      const ordenesPlanFinal = planFinalOrders.filter(o => coincideHR(String(o._finalHR || '')));
      const yaAceptado = ordenesPlanFinal.length > 0;
      const orders = yaAceptado ? ordenesPlanFinal : ordenesCrudas;
      const totalUnits = orders.reduce((sum, o) => sum + Number(o['CANTIDAD'] || o['CANTPROGRAMADA'] || 0), 0);
      const totalTimeHours = orders.reduce((sum, o) => sum + calculateProductionTime(o['MATERIAL'] || o['CodMaterial'] || '', Number(o['CANTIDAD'] || o['CANTPROGRAMADA'] || 0), o), 0) / 3600;
      let totalCapacityHours = 0;
      groupInfo.puestos.forEach(p => {
        const config = workstationConfigs[p] || { machine: p, isDayActive: true, isNightActive: false, isSaturdayActive: false, peopleDay: 0, peopleNight: 0, peopleWeekend: 0, machines: 1 };
        totalCapacityHours += capacidadPuesto(p, config, horasNetasDiurnasVal, horasNetasNocturnasVal, horasNetasFinSemanaVal);
      });
      const utilization = totalCapacityHours > 0 ? (totalTimeHours / totalCapacityHours) * 100 : 0;
      const entry = { hrCode: hrCodeFromMaestro, puestos: groupInfo.puestos, totalUnits, totalTimeHours, totalCapacityHours, utilization, yaAceptado };
      groupInfo.puestos.forEach(p => resultado.set(p, entry));
    });
    return resultado;
  }, [uniquePuestos, mapToHojaRutaInternal, techFilteredOrdenes, planFinalOrders, calculateProductionTime, workstationConfigs, horasNetasDiurnasVal, horasNetasNocturnasVal, horasNetasFinSemanaVal]);

  // Correo de "Salud de Planta" (pestaña Resumen) — POST /api/servicios/enviarCorreo. Destinatarios
  // vienen de la restricción "CORREOS_PLAN" (grupo Forros, Parámetros → Grupos → Restricciones),
  // igual patrón que DISPONIBILIDAD_<PUESTO>: no hay UI de captura nueva, se crea/edita allá.
  const [isEnviandoCorreoResumen, setIsEnviandoCorreoResumen] = useState(false);
  const handleEnviarCorreoResumen = useCallback(async () => {
    if (correosPlanDestinatarios.length === 0) {
      addNotification('warning', 'No hay destinatarios configurados. Crea la restricción "CORREOS_PLAN" (grupo Forros) en Parámetros → Grupos → Restricciones, con los correos separados por "&" o ",".');
      return;
    }
    setIsEnviandoCorreoResumen(true);
    try {
      const filas = Array.from(new Set(ocupacionPorHR.values()))
        .sort((a, b) => b.utilization - a.utilization)
        .map(g => `
          <tr>
            <td style="padding:6px 10px;border:1px solid #ddd;">${g.puestos[0]}${g.puestos.length > 1 ? ' (POOL)' : ''}</td>
            <td style="padding:6px 10px;border:1px solid #ddd;font-family:monospace;">${g.hrCode}</td>
            <td style="padding:6px 10px;border:1px solid #ddd;text-align:right;">${g.totalTimeHours.toFixed(2)} h</td>
            <td style="padding:6px 10px;border:1px solid #ddd;text-align:right;">${g.totalCapacityHours.toFixed(2)} h</td>
            <td style="padding:6px 10px;border:1px solid #ddd;text-align:right;font-weight:bold;color:${g.utilization > 100 ? '#dc2626' : g.utilization >= 90 ? '#16a34a' : '#ca8a04'};">${g.utilization.toFixed(0)}%</td>
          </tr>`).join('');
      const cuerpo = `
        <h2>Salud de Planta &mdash; Resumen de Producci&oacute;n</h2>
        <p>Fecha: ${formatFechaLarga(techStartDate)}</p>
        <table style="border-collapse:collapse;width:100%;font-family:Arial,sans-serif;font-size:12px;">
          <thead>
            <tr style="background:#f1f5f9;">
              <th style="padding:6px 10px;border:1px solid #ddd;text-align:left;">Puesto</th>
              <th style="padding:6px 10px;border:1px solid #ddd;text-align:left;">Hoja de Ruta</th>
              <th style="padding:6px 10px;border:1px solid #ddd;text-align:right;">T. Requerido</th>
              <th style="padding:6px 10px;border:1px solid #ddd;text-align:right;">Capacidad</th>
              <th style="padding:6px 10px;border:1px solid #ddd;text-align:right;">% Ocupaci&oacute;n</th>
            </tr>
          </thead>
          <tbody>${filas}</tbody>
        </table>`;
      const res = await serviciosService.enviarCorreo({
        destino: correosPlanDestinatarios.join(','),
        asunto: `Reporte de Producción — Salud de Planta (${formatFechaLarga(techStartDate)})`,
        cuerpo,
        nota: 'Este correo fue generado automáticamente, favor no responder.'
      });
      addNotification('success', `Correo enviado a: ${res.destinatarios.join(', ')}`);
    } catch (error: any) {
      addNotification('error', `Error al enviar el correo: ${error.message}`);
    } finally {
      setIsEnviandoCorreoResumen(false);
    }
  }, [correosPlanDestinatarios, ocupacionPorHR, addNotification, techStartDate]);

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
            <div className="bg-indigo-600 p-4 rounded-[1.5rem] text-white shadow-2xl ring-4 ring-slate-50 shrink-0">
              <CalendarClock className="w-6 h-6 text-sky-200" />
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
            if (tabValue === 'ordenes-fert' && ordenesFert.length === 0) fetchOrdenesFert();
            else if (tabValue === 'lista-materiales' && listaMaterialesData.length === 0) fetchListaMateriales();
            else if ((tabValue === 'mantenimientos-preventivos' || tabValue === 'personal-turnos') && !hasFetchedMantenimientos) fetchMantenimientos();
          }
        }}
      >
        <TabsList className="flex w-full h-auto bg-white border border-slate-200 p-2 rounded-[2rem] mb-10 shadow-sm overflow-x-auto justify-start">
          <TabsTrigger value="personal-turnos" className="px-6 py-3 data-[state=active]:bg-indigo-600 data-[state=active]:text-white rounded-2xl transition-all text-[10px] font-black uppercase tracking-widest text-slate-500">
            <UserPlus className="w-4 h-4 mr-2" /> Personal & Turnos
          </TabsTrigger>
          <TabsTrigger value="planes-grupo-ensamblado" className="px-6 py-3 data-[state=active]:bg-indigo-600 data-[state=active]:text-white rounded-2xl transition-all text-[10px] font-black uppercase tracking-widest text-slate-500">
            <Boxes className="w-4 h-4 mr-2" /> PLANES GRUPO ENSAMBLADO
          </TabsTrigger>
          <TabsTrigger value="recuperacion-p15-p3" className="px-6 py-3 data-[state=active]:bg-indigo-600 data-[state=active]:text-white rounded-2xl transition-all text-[10px] font-black uppercase tracking-widest text-slate-500">
            <History className="w-4 h-4 mr-2" /> Recuperación pasos P1-P3
          </TabsTrigger>
          <TabsTrigger value="ajuste-produccion" className="px-6 py-3 data-[state=active]:bg-indigo-600 data-[state=active]:text-white rounded-2xl transition-all text-[10px] font-black uppercase tracking-widest text-slate-500">
            <Settings2 className="w-4 h-4 mr-2" /> Ajuste de Producción
          </TabsTrigger>
          <TabsTrigger value="ordenes-fert" className="px-6 py-3 data-[state=active]:bg-indigo-600 data-[state=active]:text-white rounded-2xl transition-all text-[10px] font-black uppercase tracking-widest text-slate-500">
            <PackageSearch className="w-4 h-4 mr-2" /> Órdenes FERT
          </TabsTrigger>
          <TabsTrigger value="ordenes-previsionales" className="px-6 py-3 data-[state=active]:bg-indigo-600 data-[state=active]:text-white rounded-2xl transition-all text-[10px] font-black uppercase tracking-widest text-slate-500">
            <SearchCode className="w-4 h-4 mr-2" /> Órdenes Previsionales
          </TabsTrigger>
          <TabsTrigger value="lista-materiales" className="px-6 py-3 data-[state=active]:bg-indigo-600 data-[state=active]:text-white rounded-2xl transition-all text-[10px] font-black uppercase tracking-widest text-slate-500">
            <ListTree className="w-4 h-4 mr-2" /> LISTA DE MATERIALES
          </TabsTrigger>
          <TabsTrigger value="kpi-tiempos" className="px-6 py-3 data-[state=active]:bg-indigo-600 data-[state=active]:text-white rounded-2xl transition-all text-[10px] font-black uppercase tracking-widest text-slate-500">
            <ClipboardList className="w-4 h-4 mr-2" /> KPI TIEMPOS
          </TabsTrigger>
          <TabsTrigger value="mantenimientos-preventivos" className="px-6 py-3 data-[state=active]:bg-indigo-600 data-[state=active]:text-white rounded-2xl transition-all text-[10px] font-black uppercase tracking-widest text-slate-500">
            <Wrench className="w-4 h-4 mr-2" /> Mantenimientos Preventivos
          </TabsTrigger>
        </TabsList>

        <TabsContent value="ajuste-produccion" className="space-y-6 pb-20">
          <Card className="rounded-[2.5rem] bg-white ring-1 ring-slate-100 overflow-hidden shadow-sm border-none">
            <CardHeader className="bg-slate-50/50 border-b border-slate-200 p-8">
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="text-2xl font-black text-slate-900 uppercase">Ajuste de Producción</CardTitle>
                  <CardDescription className="text-slate-400 font-bold uppercase text-[10px] tracking-widest mt-1">
                    Factibilidad y ajuste por etapa: Acolchado & Tapas, Proceso Bandas, Interiores & Corte, Forros Finales
                  </CardDescription>
                </div>
                <div className="bg-indigo-600 p-3 rounded-2xl text-white shadow-lg">
                  <Settings2 className="w-6 h-6" />
                </div>
              </div>
            </CardHeader>
          </Card>

          {renderDateFilterHeaderInternal()}

          <Tabs
            defaultValue="acolchado-tapas"
            className="w-full"
            onValueChange={(tabValue) => {
              if (!loadedTabs.has(tabValue)) {
                setLoadedTabs(prev => new Set([...prev, tabValue]));
                if (tabValue === 'forros' && ordenesFert.length === 0) fetchOrdenesFert();
              }
            }}
          >
            <TabsList className="flex w-full h-auto bg-white border border-slate-200 p-2 rounded-[2rem] mb-8 shadow-sm overflow-x-auto justify-start">
              <TabsTrigger value="acolchado-tapas" className="px-6 py-3 data-[state=active]:bg-indigo-600 data-[state=active]:text-white rounded-2xl transition-all text-[10px] font-black uppercase tracking-widest text-slate-500">
                <Cpu className="w-4 h-4 mr-2" /> 1. Acolchado & Tapas
              </TabsTrigger>
              <TabsTrigger value="bandas" className="px-6 py-3 data-[state=active]:bg-indigo-600 data-[state=active]:text-white rounded-2xl transition-all text-[10px] font-black uppercase tracking-widest text-slate-500">
                <Layers className="w-4 h-4 mr-2" /> 2. Proceso Bandas
              </TabsTrigger>
              <TabsTrigger value="interiores-corte" className="px-6 py-3 data-[state=active]:bg-indigo-600 data-[state=active]:text-white rounded-2xl transition-all text-[10px] font-black uppercase tracking-widest text-slate-500">
                <Settings2 className="w-4 h-4 mr-2" /> 3. Interiores & Corte
              </TabsTrigger>
              <TabsTrigger value="forros" className="px-6 py-3 data-[state=active]:bg-indigo-600 data-[state=active]:text-white rounded-2xl transition-all text-[10px] font-black uppercase tracking-widest text-slate-500">
                <LayoutGrid className="w-4 h-4 mr-2" /> 4. Forros Finales
              </TabsTrigger>
              <TabsTrigger value="resumen-produccion" className="px-6 py-3 data-[state=active]:bg-indigo-600 data-[state=active]:text-white rounded-2xl transition-all text-[10px] font-black uppercase tracking-widest text-slate-500">
                <BarChart3 className="w-4 h-4 mr-2" /> Resumen
              </TabsTrigger>
              <TabsTrigger value="plan-final" className="px-6 py-3 data-[state=active]:bg-indigo-600 data-[state=active]:text-white rounded-2xl transition-all text-[10px] font-black uppercase tracking-widest text-slate-500">
                <TableIcon className="w-4 h-4 mr-2" /> Plan Final
              </TabsTrigger>
            </TabsList>

        <TabsContent value="acolchado-tapas" className="space-y-6 pb-20">
          <Card className="rounded-[2rem] bg-white ring-1 ring-slate-100 overflow-hidden shadow-sm border-none">
            <CardHeader className="bg-slate-50/50 border-b border-slate-200 p-6">
              <div className="flex items-center justify-between flex-wrap gap-4">
                <div className="flex items-center gap-3">
                  <div className="bg-indigo-600 p-2.5 rounded-xl text-white shadow-lg shrink-0">
                    <Cpu className="w-5 h-5" />
                  </div>
                  <div>
                    <CardTitle className="text-lg font-black text-slate-900 uppercase">1. Acolchado & Tapas</CardTitle>
                    <CardDescription className="text-slate-400 font-bold uppercase text-[9px] tracking-widest mt-0.5">
                      Células de acolchado y sus cosedoras/pegadoras asociadas
                    </CardDescription>
                  </div>
                </div>
              </div>
            </CardHeader>
          </Card>

          {/* Botón de Consolidación ACH */}
          <div className="flex justify-end mb-6">
            <Button
              onClick={handleConsolidateAcolchado}
              className={cn(
                "font-black uppercase tracking-widest text-[10px] px-8 py-6 rounded-3xl shadow-xl border-2 flex items-center gap-3 transition-all",
                isAchConsolidated 
                  ? "bg-indigo-600 text-white border-indigo-700" 
                  : "bg-indigo-900 hover:bg-indigo-800 text-sky-400 border-indigo-500/30"
              )}
            >
              <Layers className="w-5 h-5" />
              {isAchConsolidated ? 'Ver Detalle Acolchado' : 'Consolidar Carga de Acolchado'}
            </Button>
          </div>

          {/* Por defecto se ven las órdenes ORIGINALES de cada célula, sin ningún movimiento — el
              ajuste por versión ahora se activa POR CÉLULA (botón "Ajustar" en cada una, más abajo),
              no con un único interruptor para las 7 a la vez, para poder revisar/activar solo la que
              interesa (ej. una máquina apagada) sin mover de paso la producción de las demás. */}
          <div className="flex items-center gap-3 px-6 py-4 bg-white border border-slate-200 rounded-2xl shadow-sm mb-6">
            <div className="flex items-center gap-2 text-[10px] font-black uppercase tracking-widest text-slate-500">
              <Layers className="w-4 h-4 text-indigo-500" /> Cada célula tiene su propio botón "Ajustar por Versión" — {acolchadoCelulasAjusteActivas.size} de 7 con ajuste activo
            </div>
          </div>

          {/* Alternativas de ajuste: si el resultado no convence, se puede alternar la estrategia
              antes de aceptar — nunca un único resultado fijo. Es una sola estrategia compartida
              por todas las células (afecta al motor completo), por eso se muestra en cuanto
              cualquier célula tenga el ajuste activo. */}
          {acolchadoCelulasAjusteActivas.size > 0 && (
            <div className="flex items-center justify-between gap-3 px-6 py-4 bg-white border border-slate-200 rounded-2xl shadow-sm mb-6">
              <div className="flex items-center gap-2 text-[10px] font-black uppercase tracking-widest text-slate-500">
                <Layers className="w-4 h-4 text-indigo-500" /> Estrategia de ajuste
              </div>
              <div className="flex gap-2">
                <Button
                  onClick={() => setModoAjusteAcolchado('optimo')}
                  className={cn('text-[9px] font-black uppercase tracking-widest px-4 py-2 rounded-xl', modoAjusteAcolchado === 'optimo' ? 'bg-indigo-600 text-white' : 'bg-slate-100 text-slate-500 hover:bg-slate-200')}
                >
                  Óptimo (Versión SAP)
                </Button>
                <Button
                  onClick={() => setModoAjusteAcolchado('equilibrado')}
                  className={cn('text-[9px] font-black uppercase tracking-widest px-4 py-2 rounded-xl', modoAjusteAcolchado === 'equilibrado' ? 'bg-indigo-600 text-white' : 'bg-slate-100 text-slate-500 hover:bg-slate-200')}
                >
                  Equilibrado (más holgura)
                </Button>
              </div>
            </div>
          )}

          {['02', '06', '07', '08', '09', '10', '13'].map(suffix => {
            // `.includes('ACH13')` también hace match con "COSEDORA-ACH13" (contiene "ACH13" como
            // substring tras el guion) — se excluye explícitamente, si no, cuando ACOLCHADORA13 no
            // tiene órdenes en el período pero COSEDORA-ACH13 sí, `achPuesto` terminaba resolviendo
            // a la Cosedora por error (mismo síntoma que "aparece COSEDORA-ACH13 en Acolchado y Tapas").
            const achNames = uniquePuestos.filter(p => !p.includes('COSEDORA') && (p.includes(`ACH${suffix}`) || p.includes(`ACOLCHADORA${suffix}`)));
            // COSEDORA-ACH13 no tiene configuración en SAP y no se le asigna producción — sin
            // tarjeta ni botón de aceptación (a diferencia del resto de células, que sí tienen su
            // Cosedora pareja real).
            const pefNames = suffix === '13' ? [] : uniquePuestos.filter(p => p.includes(`PEF${suffix}`) || p.includes(`COSEDORA-ACH${suffix}`) || p.includes(`PEGADORA${suffix}`));
            if (achNames.length === 0 && pefNames.length === 0) return null;
            const achPuesto = achNames[0];
            const pefPuesto = pefNames[0];
            const achAjusteActivo = !!achPuesto && acolchadoCelulasAjusteActivas.has(achPuesto);
            const achExcludeKeys = achAjusteActivo && achPuesto ? acolchadoExcludeKeysPorPuesto.get(achPuesto) : undefined;
            // El motor SIEMPRE calcula qué se mueve de esta célula a otra, tenga o no el ajuste
            // activo (ver comentario de más abajo sobre `techFilteredOrdenesParaAcolchado`). Si hay
            // algo que mover pero el ajuste de ESTA célula está apagado, "Aceptar Plan" mandaría a
            // Plan Final la producción ORIGINAL completa (sin descontar lo que se fue) — y si la
            // célula destino también acepta con su ajuste activo, esa porción queda duplicada.
            const achExcludeKeysSiempre = achPuesto ? acolchadoExcludeKeysPorPuesto.get(achPuesto) : undefined;
            const achRiesgoDuplicado = !achAjusteActivo && !!achExcludeKeysSiempre && achExcludeKeysSiempre.size > 0;
            // Las órdenes que ENTRAN se muestran aunque esta célula no esté ajustada: basta con que
            // lo esté la de ORIGEN (ver `acolchadoAdjustedInVisiblePorPuesto`).
            const achAdjustedIn = achPuesto ? acolchadoAdjustedInVisiblePorPuesto.get(achPuesto) : undefined;
            const achSplitRemainders = achAjusteActivo && achPuesto ? acolchadoSplitRemaindersPorPuesto.get(achPuesto) : undefined;
            const achExceso = achAjusteActivo && achPuesto ? acolchadoExcesoPorPuesto.get(achPuesto) : undefined;
            const achTapasAfectadas = achAjusteActivo && achPuesto ? tapasAfectadasPorCelula.get(achPuesto) : undefined;
            return (
              <div key={suffix} className="space-y-6">
                <div className="flex items-center justify-between flex-wrap gap-3">
                  <div className="flex items-center gap-4 px-7 py-2.5 bg-indigo-50 border border-indigo-200 rounded-full w-fit shadow-sm">
                    <div className="w-2 h-2 rounded-full bg-sky-500 animate-pulse" />
                    <span className="text-indigo-900 font-black text-xs uppercase tracking-[0.3em]">Célula Twin {suffix}</span>
                  </div>
                  <div className="flex items-center gap-2 flex-wrap">
                    {achPuesto && (
                      <Button
                        onClick={() => handleToggleAjusteAcolchadoCelula(achPuesto)}
                        className={cn(
                          'font-black uppercase tracking-widest text-[9px] px-5 py-2 rounded-2xl shadow-lg flex items-center gap-2',
                          achAjusteActivo ? 'bg-red-600 hover:bg-red-700 text-white' : 'bg-amber-600 hover:bg-amber-700 text-white'
                        )}
                      >
                        <Layers className="w-3.5 h-3.5" /> {achAjusteActivo ? 'Revertir Ajuste' : 'Ajustar por Versión'}
                      </Button>
                    )}
                    {/* Botón de aceptación SIEMPRE visible, aunque no haya movimientos — el plan
                        natural (sin ajustar) también debe poder mandarse a Plan Final. Se bloquea
                        SOLO si hay producción movida hacia otra célula y el ajuste de ESTA sigue
                        apagado (ver `achRiesgoDuplicado`) — evita duplicar producción en Plan Final. */}
                    {achPuesto && (
                      <Button
                        onClick={() => {
                          if (achRiesgoDuplicado) {
                            addNotification('error', `${achPuesto} tiene producción que el motor movió a otra célula, pero su "Ajustar por Versión" está apagado. Actívalo antes de aceptar, o esa producción quedaría duplicada en Plan Final (completa aquí y también en la célula que la recibió).`);
                            return;
                          }
                          handleAceptarAjusteAcolchadoPuesto(achPuesto);
                        }}
                        disabled={achRiesgoDuplicado}
                        className={cn(
                          'font-black uppercase tracking-widest text-[9px] px-5 py-2 rounded-2xl shadow-lg flex items-center gap-2',
                          achRiesgoDuplicado
                            ? 'bg-slate-300 text-slate-500 cursor-not-allowed'
                            : acolchadoAceptadoPuestos.has(achPuesto) ? 'bg-emerald-600 hover:bg-emerald-700 text-white' : 'bg-indigo-600 hover:bg-indigo-700 text-white'
                        )}
                      >
                        <CheckCircle2 className="w-3.5 h-3.5" />
                        {achRiesgoDuplicado ? 'Activa el Ajuste primero' : acolchadoAceptadoPuestos.has(achPuesto) ? 'Reaceptar Plan' : 'Aceptar Plan'}
                      </Button>
                    )}
                    {/* Tapa/Cosedora antes nunca llegaba a Plan Final — ahora tiene su propio botón,
                        también visible aunque no haya cascada de Acolchado que la mueva. */}
                    {pefPuesto && (
                      <Button
                        onClick={() => handleAceptarPlanTapaPuesto(pefPuesto)}
                        className={cn(
                          'font-black uppercase tracking-widest text-[9px] px-5 py-2 rounded-2xl shadow-lg flex items-center gap-2',
                          tapaAceptadoPuestos.has(pefPuesto) ? 'bg-emerald-600 hover:bg-emerald-700 text-white' : 'bg-violet-600 hover:bg-violet-700 text-white'
                        )}
                      >
                        <CheckCircle2 className="w-3.5 h-3.5" />
                        {tapaAceptadoPuestos.has(pefPuesto) ? 'Reaceptar Plan Tapa' : 'Aceptar Plan Tapa'}
                      </Button>
                    )}
                  </div>
                </div>
                {/* La razón Tapa→Acolchado se consulta a SAP al bloquear (esta pestaña no depende de
                    la explosión de otra pestaña). Mientras responde, el descuento todavía no se ve
                    en la barra de ocupación — se avisa para que no parezca que el bloqueo no hizo nada. */}
                {/* La regla ACH09 → ACH08 depende de una restricción en base; si no existe, el
                    filtro por familias no se aplica y hay que decirlo (si no, parecería que la
                    regla está funcionando cuando en realidad se mueve todo). `restricciones` se trae
                    UNA sola vez al montar la pestaña (fetchBaseData): si el usuario crea o edita la
                    restricción en Configuración de Restricciones sin recargar la página, este panel
                    se queda mostrando el estado viejo — de ahí el botón para refrescarla sin recargar
                    todo. Confirmado con datos reales: la restricción "MAT_MOVIBLE_ACH09" sí existe en
                    base (codigo_restriccion 519, grupo Forros), el problema era que esta pestaña
                    todavía no la había vuelto a consultar. */}
                {(suffix === '09' || suffix === '08') && (
                  <div className={cn('rounded-2xl border px-5 py-3 flex items-start gap-2',
                    familiasMoviblesAch09 ? 'border-slate-200 bg-slate-50' : 'border-amber-200 bg-amber-50')}>
                    <AlertTriangle className={cn('w-3.5 h-3.5 mt-0.5 shrink-0', familiasMoviblesAch09 ? 'text-slate-400' : 'text-amber-500')} />
                    <div className="flex-1 min-w-0 flex items-start justify-between gap-3">
                      <p className={cn('text-[10px] font-bold leading-tight', familiasMoviblesAch09 ? 'text-slate-600' : 'text-amber-800')}>
                        {familiasMoviblesAch09
                          ? <>Pareja ACH09 ↔ ACH08 restringida a: <span className="font-black">{familiasMoviblesAch09.familias.join(' · ')}</span> (restricción <span className="font-mono">{familiasMoviblesAch09.nombre}</span>). Lo que sale de la ACH09 solo puede ir a la ACH08, y la ACH08 solo acepta esas familias venga de donde venga. El resto se queda fijo y su exceso se resuelve a mano contra SAP.</>
                          : <>No se encuentra la restricción de materiales movibles de la ACH09 (se busca una del grupo Forros cuyo nombre contenga <span className="font-mono">ACH09</span> y <span className="font-mono">MOVIBLE</span>). Si acabas de crearla o editarla en Configuración de Restricciones, dale a "Recargar" — esta pestaña la trae solo una vez, al entrar. Mientras no se detecte no se filtra por familia: la ACH09 solo puede mandar a la ACH08, pero la ACH08 acepta cualquier material.</>}
                      </p>
                      <button
                        type="button"
                        onClick={() => fetchBaseData()}
                        disabled={isLoading}
                        title="Volver a consultar las restricciones (por si se creó o editó una sin recargar la página)"
                        className={cn('shrink-0 inline-flex items-center gap-1 text-[9px] font-black uppercase tracking-widest px-2.5 py-1 rounded-lg border',
                          familiasMoviblesAch09 ? 'border-slate-300 text-slate-500 hover:bg-slate-100' : 'border-amber-300 text-amber-700 hover:bg-amber-100',
                          isLoading && 'opacity-50 cursor-not-allowed')}
                      >
                        {isLoading ? <Loader2 className="w-3 h-3 animate-spin" /> : <RefreshCw className="w-3 h-3" />}
                        Recargar
                      </button>
                    </div>
                  </div>
                )}
                {/* Movimientos de Acolchado cuya Tapa NO pudo seguirlo, con el motivo. El caso
                    conocido es la célula 07: no tiene Cosedora de Tapa asociada (su COSEDORA-ACH07
                    no está mapeada a HR-PEF07 ni tiene órdenes de Tapa propias). */}
                {(() => {
                  const pendientes = tapaCascadaDesdeAcolchado.sinCascada.filter(s => s.origen === suffix || s.destino === suffix);
                  if (pendientes.length === 0) return null;
                  const motivos = Array.from(new Set(pendientes.map(s => s.motivo)));
                  return (
                    <div className="rounded-2xl border border-amber-200 bg-amber-50 px-5 py-3 flex items-start gap-2">
                      <AlertTriangle className="w-3.5 h-3.5 text-amber-500 shrink-0 mt-0.5" />
                      <div className="min-w-0">
                        <p className="text-[10px] font-black uppercase text-amber-700 tracking-widest leading-tight">
                          Tapa sin cascadear ({pendientes.length} movimiento{pendientes.length === 1 ? '' : 's'})
                        </p>
                        <p className="text-[10px] font-bold text-amber-800 leading-tight mt-0.5">
                          El Acolchado se movió pero su Tapa se queda donde está: {motivos.join(' · ')}.
                        </p>
                      </div>
                    </div>
                  );
                })()}
                {tapasResolviendoRatio.size > 0 && (
                  <div className="rounded-2xl border border-sky-200 bg-sky-50 px-5 py-3 flex items-center gap-2">
                    <Loader2 className="w-3.5 h-3.5 animate-spin text-sky-600 shrink-0" />
                    <p className="text-[10px] font-bold text-sky-800 leading-tight">
                      Consultando en SAP la lista de materiales de {tapasResolviendoRatio.size} Tapa(s) bloqueada(s) para descontar su Acolchado…
                    </p>
                  </div>
                )}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-10">
                  {achNames.length > 0 && (
                    <MachineCard
                      puestoName={achNames[0]}
                      orders={techFilteredOrdenesParaAcolchado}
                      calculateProductionTime={calculateProductionTime}
                      config={workstationConfigs[achNames[0]] || { machine: achNames[0], isDayActive: true, isNightActive: false, isSaturdayActive: false, peopleDay: 0, peopleNight: 0, peopleWeekend: 0, machines: 1 }}
                      horasNetasDiurnas={horasNetasDiurnasVal}
                      horasNetasNocturnas={horasNetasNocturnasVal} horasNetasFinSemana={horasNetasFinSemanaVal}
                      mapToHojaRuta={mapToHojaRutaInternal}
                      normalizeMaterialCode={normalizeMaterialCode}
                      isConsolidated={isAchConsolidated}
                      adjustedInOrders={achAdjustedIn}
                      excludeOrderKeys={achExcludeKeys}
                      splitRemainderOrders={achSplitRemainders}
                      blockedOrderKeys={acolchadoOrdenesBloqueadasPorPuesto.get(achNames[0])}
                      onToggleBlock={(o) => handleToggleBloqueoOrdenAcolchado(achNames[0], o)}
                      qtyOverrideByKey={acolchadoQtyOverridePorOrden}
                    />
                  )}
                  {pefNames.length > 0 && (
                    <MachineCard
                      puestoName={pefNames[0]}
                      orders={techFilteredOrdenes}
                      calculateProductionTime={calculateProductionTime}
                      config={workstationConfigs[pefNames[0]] || { machine: pefNames[0], isDayActive: true, isNightActive: false, isSaturdayActive: false, peopleDay: 0, peopleNight: 0, peopleWeekend: 0, machines: 1 }}
                      horasNetasDiurnas={horasNetasDiurnasVal}
                      horasNetasNocturnas={horasNetasNocturnasVal} horasNetasFinSemana={horasNetasFinSemanaVal}
                      mapToHojaRuta={mapToHojaRutaInternal}
                      normalizeMaterialCode={normalizeMaterialCode}
                      excludeOrderKeys={tapaCascadaDesdeAcolchado.excludeKeysPorPuesto.get(pefNames[0])}
                      adjustedInOrders={tapaCascadaDesdeAcolchado.adjustedInPorPuesto.get(pefNames[0])}
                      splitRemainderOrders={tapaCascadaDesdeAcolchado.splitRemaindersPorPuesto.get(pefNames[0])}
                      blockedOrderKeys={tapaOrdenesBloqueadasPorPuesto.get(pefNames[0])}
                      onToggleBlock={(o) => handleToggleBloqueoOrdenTapa(pefNames[0], o)}
                    />
                  )}
                </div>
                {/* Confirmación visible de que bloquear una Tapa sí descontó Acolchado — la fila
                    cruda de la tabla no se achica sola (viene de `techFilteredOrdenes` sin tocar),
                    así que sin este panel el descuento sería invisible aunque ya esté aplicado. */}
                {achPuesto && (() => {
                  const reducciones = [...acolchadoDemandaReducidaPorTapaBloqueada.entries()]
                    .filter(([mat, cantidad]) => cantidad > 0.01 && acolchadoMaterialPuestoNatural.get(mat) === achPuesto);
                  if (reducciones.length === 0) return null;
                  return (
                    <div className="rounded-2xl border border-emerald-200 bg-emerald-50/70 px-5 py-4 space-y-1.5">
                      <p className="text-[9px] font-black uppercase text-emerald-700 tracking-widest">Acolchado descontado en {achPuesto} por Tapas bloqueadas:</p>
                      {reducciones.map(([mat, cantidad]) => (
                        <p key={mat} className="text-[10px] font-mono text-emerald-800">
                          <span className="font-black">{mat}</span> — {materialNombrePorCodigo.get(mat) || '—'}: <span className="font-black">−{cantidad.toLocaleString(undefined, { maximumFractionDigits: 2 })}</span> uds
                        </p>
                      ))}
                    </div>
                  );
                })()}
                {/* Validación Acolchado vs. Tapas — muestra la orden de SAP consolidada junto a la
                    necesidad calculada desde las Tapas reales; si no coinciden, alerta + botón
                    "Corregir" (acción manual, nunca automática). Cada Tapa dependiente aparece como
                    fila hija con su propio ratio, unidades y equivalente en Acolchado. */}
                {achPuesto && [...acolchadoValidacionPorCelula.values()].filter(v => v.suffix === suffix).map(v => (
                  <div key={v.matNorm} className={cn('rounded-2xl border px-5 py-4 space-y-3', v.coincide ? 'border-slate-200 bg-white' : 'border-amber-300 bg-amber-50/60')}>
                    <div className="flex items-center justify-between flex-wrap gap-2">
                      <div>
                        <p className="text-[9px] font-black uppercase text-slate-400 tracking-widest">Validación Acolchado</p>
                        <p className="text-[11px] font-mono font-black text-slate-800">
                          {v.matNorm} — {materialNombrePorCodigo.get(v.matNorm) || '—'}
                        </p>
                      </div>
                      <div className="flex items-center gap-4">
                        <div className="text-right">
                          <p className="text-[8px] font-black uppercase text-slate-400 tracking-widest">Consolidado (SAP)</p>
                          <p className="text-[13px] font-mono font-black text-slate-800">{v.cantidadSAP.toLocaleString(undefined, { maximumFractionDigits: 2 })}</p>
                        </div>
                        <div className="text-right">
                          <p className="text-[8px] font-black uppercase text-slate-400 tracking-widest">Necesidad Tapas</p>
                          <p className="text-[13px] font-mono font-black text-indigo-700">{v.necesidadTapas.toLocaleString(undefined, { maximumFractionDigits: 2 })}</p>
                        </div>
                        <Badge className={cn('font-black text-[9px] px-2 py-0.5 rounded-md border-none inline-flex items-center gap-1', v.coincide ? 'bg-emerald-100 text-emerald-700' : 'bg-amber-100 text-amber-700')}>
                          {v.coincide ? <CheckCircle2 className="w-3 h-3" /> : <AlertTriangle className="w-3 h-3" />}
                          {v.coincide ? 'OK' : `NO COINCIDE (${(v.necesidadTapas - v.cantidadSAP) > 0 ? '+' : ''}${(v.necesidadTapas - v.cantidadSAP).toLocaleString(undefined, { maximumFractionDigits: 2 })})`}
                        </Badge>
                        {!v.coincide && (
                          <Button
                            onClick={() => handleToggleCorreccionAcolchado(v.suffix, v.matNorm)}
                            className={cn('font-black uppercase tracking-widest text-[9px] px-4 py-2 rounded-xl', v.corregido ? 'bg-slate-200 text-slate-600 hover:bg-slate-300' : 'bg-amber-600 hover:bg-amber-700 text-white')}
                          >
                            {v.corregido ? 'Revertir corrección' : 'Corregir'}
                          </Button>
                        )}
                        {v.coincide && v.corregido && (
                          <Button
                            onClick={() => handleToggleCorreccionAcolchado(v.suffix, v.matNorm)}
                            variant="outline"
                            className="font-black uppercase tracking-widest text-[9px] px-4 py-2 rounded-xl border-slate-300 text-slate-500"
                          >
                            Revertir corrección
                          </Button>
                        )}
                      </div>
                    </div>
                    <div className="divide-y divide-slate-100 border-t border-slate-100 pt-2">
                      {v.porTapa.map(t => (
                        <div key={t.tapaMat} className="grid grid-cols-5 gap-2 py-1.5 text-[10px] items-center">
                          <span className="font-mono font-bold text-slate-600 col-span-2">
                            {t.tapaMat} — {materialNombrePorCodigo.get(t.tapaMat) || '—'}
                          </span>
                          <span className="font-mono text-slate-500 text-right">{Math.round(t.unidades).toLocaleString()} UN</span>
                          <span className="font-mono text-slate-500 text-right">ratio {t.ratio.toLocaleString(undefined, { maximumFractionDigits: 2 })}</span>
                          <span className="font-mono font-black text-indigo-700 text-right">{t.cantidadAcolchado.toLocaleString(undefined, { maximumFractionDigits: 2 })} equiv.</span>
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
                {/* Nunca dejar una tarjeta vacía sin explicar a dónde se fue su producción — mismo
                    principio que "nunca mostrar solo un % sin el detalle de órdenes". */}
                {achAjusteActivo && achPuesto && (() => {
                  const movidas = acolchadoMovedOrders.filter(o => o._fromPuesto === achPuesto && o._toPuesto && o._toPuesto !== achPuesto);
                  if (movidas.length === 0) return null;
                  const porDestino = new Map<string, number>();
                  movidas.forEach(o => {
                    const destino = String(o._toPuesto);
                    porDestino.set(destino, (porDestino.get(destino) || 0) + Number(o['CANTIDAD'] || o['CANTPROGRAMADA'] || 0));
                  });
                  return (
                    <div className="rounded-2xl border border-indigo-200 bg-indigo-50/70 px-5 py-4 space-y-1.5">
                      <p className="text-[9px] font-black uppercase text-indigo-700 tracking-widest">Acolchado de {achPuesto} movido a:</p>
                      {[...porDestino.entries()].map(([destino, cantidad]) => (
                        <p key={destino} className="text-[10px] font-mono text-indigo-800">
                          → <span className="font-black">{cantidad.toLocaleString()}</span> uds a <span className="font-black">{destino}</span>
                        </p>
                      ))}
                    </div>
                  );
                })()}
                {achExceso && achExceso.excessOrders.length > 0 && (
                  <div className="rounded-2xl border border-red-300 bg-red-50/70 px-5 py-4 space-y-2">
                    <p className="text-[9px] font-black uppercase text-red-700 tracking-widest">
                      Órdenes que NO se podrán fabricar en {achPuesto} · {achExceso.excessOrders.length} orden{achExceso.excessOrders.length !== 1 ? 'es' : ''} · +{achExceso.excessHours.toFixed(2)} h en exceso ({achExceso.utilizacionReal.toFixed(0)}% producible)
                    </p>
                    {achExceso.excessOrders.map((o: any, idx: number) => (
                      <div key={idx} className="flex justify-between text-[10px] font-mono text-red-800 border-b border-red-200 last:border-0 pb-1 last:pb-0">
                        <span className="shrink-0 font-black">{o['MATERIAL'] || o['CodMaterial'] || '—'}</span>
                        <span className="truncate mx-2 flex-1">{o['NOMBRE'] || o['TEXTOMATERIAL'] || '—'}</span>
                        <span className="font-black shrink-0">{Number(o['CANTIDAD'] || o['CANTPROGRAMADA'] || 0).toLocaleString()} uds</span>
                      </div>
                    ))}
                  </div>
                )}
                {achTapasAfectadas && achTapasAfectadas.length > 0 && (
                  <div className="rounded-2xl border border-amber-300 bg-amber-50/70 px-5 py-4 space-y-3">
                    <p className="text-[9px] font-black uppercase text-amber-700 tracking-widest">
                      Tapas que NO se podrán coser por falta de Acolchado en {achPuesto}
                    </p>
                    {achTapasAfectadas.map(t => (
                      <div key={t.tapaMaterial} className="space-y-1.5">
                        <p className="text-[10px] font-mono text-amber-800">
                          <span className="font-black">{t.tapaMaterial}</span> — {t.nombre || '—'} · producible {t.producible.toLocaleString()} de {t.demandaTotal.toLocaleString()} uds
                        </p>
                        {t.ordenesExceso.map((o: any, idx: number) => (
                          <div key={idx} className="flex justify-between text-[10px] font-mono text-amber-900 pl-3 border-b border-amber-200 last:border-0 pb-1 last:pb-0">
                            <span className="shrink-0 font-black">{o['MATERIAL'] || o['CodMaterial'] || '—'}</span>
                            <span className="truncate mx-2 flex-1">{o['NOMBRE'] || o['TEXTOMATERIAL'] || '—'}</span>
                            <span className="font-black shrink-0">{Number(o['CANTIDAD'] || o['CANTPROGRAMADA'] || 0).toLocaleString()} uds</span>
                          </div>
                        ))}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            );
          })}

          {ajusteAcolchadoMateriales.length > 0 && acolchadoTapasPorMaterialNorm.size === 0 && (
            <div className="rounded-2xl border border-slate-200 bg-slate-50 px-5 py-3 text-[10px] text-slate-500">
              El ajuste de Tapas según el metraje de Acolchado disponible requiere la Explosión de Componentes
              (pestaña "Resumen Nivel 3/4") — hasta que se ejecute, las Tapas se muestran sin recorte por Acolchado.
            </div>
          )}

        </TabsContent>

        <TabsContent value="bandas" className="space-y-6 pb-20">
          <Card className="rounded-[2rem] bg-white ring-1 ring-slate-100 overflow-hidden shadow-sm border-none">
            <CardHeader className="bg-slate-50/50 border-b border-slate-200 p-6">
              <div className="flex items-center gap-3">
                <div className="bg-indigo-600 p-2.5 rounded-xl text-white shadow-lg shrink-0">
                  <Layers className="w-5 h-5" />
                </div>
                <div>
                  <CardTitle className="text-lg font-black text-slate-900 uppercase">2. Proceso Bandas</CardTitle>
                  <CardDescription className="text-slate-400 font-bold uppercase text-[9px] tracking-widest mt-0.5">
                    Acolchadora, bordadora/cosedoras y RMTB de bandas
                  </CardDescription>
                </div>
              </div>
            </CardHeader>
          </Card>

          {/* Sección: Acolchadora de Bandas — ajuste por Versión de Fabricación */}
          <div className="flex items-center justify-between px-7 py-3 bg-indigo-50 border border-indigo-200 rounded-full shadow-sm">
            <div className="flex items-center gap-4">
              <div className="w-2 h-2 rounded-full bg-sky-500 animate-pulse" />
              <span className="text-indigo-900 font-black text-xs uppercase tracking-[0.3em]">Acolchadora de Bandas</span>
              <span className="text-indigo-400 font-bold text-[9px] uppercase tracking-widest">
                {isBandasAjusteActivo ? '· ajuste activo' : '· mostrando órdenes originales'}
              </span>
            </div>
            <div className="flex items-center gap-2">
              <Button
                onClick={handleToggleAjusteBandas}
                className={cn('font-black uppercase tracking-widest text-[9px] px-5 py-2 rounded-2xl shadow-lg flex items-center gap-2', isBandasAjusteActivo ? 'bg-red-600 hover:bg-red-700 text-white' : 'bg-amber-600 hover:bg-amber-700 text-white')}
              >
                <Layers className="w-3.5 h-3.5" /> {isBandasAjusteActivo ? 'Revertir Ajuste' : 'Ajustar por Versión de Fabricación'}
              </Button>
              {/* El "Aceptar Plan" se movió directo bajo cada tarjeta (ver más abajo) — se quita de
                  aquí para no duplicar el mismo botón dos veces en la misma pantalla. */}
            </div>
          </div>
          {isBandasAjusteActivo && (
            <div className="flex items-center justify-between gap-3 px-6 py-3 bg-white border border-slate-200 rounded-2xl shadow-sm mb-2">
              <div className="flex items-center gap-2 text-[10px] font-black uppercase tracking-widest text-slate-500">
                <Layers className="w-4 h-4 text-indigo-500" /> Estrategia de ajuste
              </div>
              <div className="flex gap-2">
                <Button
                  onClick={() => setModoAjusteBandas('optimo')}
                  className={cn('text-[9px] font-black uppercase tracking-widest px-4 py-2 rounded-xl', modoAjusteBandas === 'optimo' ? 'bg-indigo-600 text-white' : 'bg-slate-100 text-slate-500 hover:bg-slate-200')}
                >
                  Óptimo (Versión SAP)
                </Button>
                <Button
                  onClick={() => setModoAjusteBandas('equilibrado')}
                  className={cn('text-[9px] font-black uppercase tracking-widest px-4 py-2 rounded-xl', modoAjusteBandas === 'equilibrado' ? 'bg-indigo-600 text-white' : 'bg-slate-100 text-slate-500 hover:bg-slate-200')}
                >
                  Equilibrado (más holgura)
                </Button>
              </div>
            </div>
          )}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-10">
            {uniquePuestos.filter(p =>
              p.includes('ACOLCHADORA11') ||
              p.includes('ACOLCHADORA12') ||
              (p.includes('ACH11') && !p.includes('COSEDORA')) ||
              (p.includes('ACH12') && !p.includes('COSEDORA'))
            ).map((pName) => (
              <div key={pName} className="flex flex-col gap-3">
                <MachineCard
                  puestoName={pName}
                  small
                  orders={techFilteredOrdenes}
                  calculateProductionTime={calculateProductionTime}
                  config={workstationConfigs[pName] || { machine: pName, isDayActive: true, isNightActive: false, isSaturdayActive: false, peopleDay: 0, peopleNight: 0, peopleWeekend: 0, machines: 1 }}
                  horasNetasDiurnas={horasNetasDiurnasVal}
                  horasNetasNocturnas={horasNetasNocturnasVal} horasNetasFinSemana={horasNetasFinSemanaVal}
                  mapToHojaRuta={mapToHojaRutaInternal}
                  normalizeMaterialCode={normalizeMaterialCode}
                  adjustedInOrders={isBandasAjusteActivo ? bandasAdjustedInPorPuesto.get(pName) : undefined}
                  excludeOrderKeys={isBandasAjusteActivo ? bandasExcludeKeysPorPuesto.get(pName) : undefined}
                  splitRemainderOrders={isBandasAjusteActivo ? bandasSplitRemaindersPorPuesto.get(pName) : undefined}
                  blockedOrderKeys={ordenesBloqueadasPorPuesto.get(pName)}
                  onToggleBlock={(o) => handleToggleBloqueoOrden(pName, o)}
                />
                {/* Mismo botón que el del encabezado — duplicado aquí para que quede a la vista
                    justo bajo la tarjeta, igual criterio que el resto de secciones de esta pestaña
                    (Corte, Bases, Interiores, Tapa Superior CHN, Bordadora/Cosedoras de Banda). Es
                    un botón de GRUPO (ACH11+ACH12 juntas), no por máquina individual. */}
                <Button
                  onClick={handleAceptarAjusteBandas}
                  disabled={isAceptandoAjusteBandas}
                  className={cn(
                    'w-full font-black uppercase tracking-widest text-[9px] px-5 py-2.5 rounded-2xl shadow-lg flex items-center justify-center gap-2',
                    ajusteBandasAceptado ? 'bg-emerald-600 hover:bg-emerald-700 text-white' : 'bg-indigo-600 hover:bg-indigo-700 text-white'
                  )}
                >
                  <CheckCircle2 className="w-3.5 h-3.5" />
                  {ajusteBandasAceptado ? 'Reaceptar Plan' : 'Aceptar Plan'}
                </Button>
              </div>
            ))}
          </div>

          {isBandasAjusteActivo && bandasMovedOrders.length > 0 && (
            <div className="border border-amber-200 bg-white rounded-[2rem] p-8 shadow-md space-y-4">
              <div className="flex items-center gap-3">
                <div className="bg-amber-500 p-2.5 rounded-xl text-white shadow-md shrink-0">
                  <ClipboardList className="w-4 h-4" />
                </div>
                <h4 className="font-black text-slate-900 uppercase tracking-tight text-sm">Ajuste por Versión de Fabricación</h4>
              </div>
              <div className="bg-amber-50 border border-amber-100 rounded-2xl p-5 text-[11px]">
                <p className="text-slate-700 leading-relaxed">
                  <span className="font-black text-red-600">{bandasMovedOrders.length} {bandasMovedOrders.length === 1 ? 'orden' : 'órdenes'}</span>
                  {' '}se reasignan entre ACOLCHADORA11/12 según la Versión de Fabricación registrada en SAP para cada material (materiales "BANDA...").
                  {bandasMovedOrders.some(o => o._isSplit) && (
                    <> Incluye <span className="font-black text-violet-600">{bandasMovedOrders.filter(o => o._isSplit).length} orden{bandasMovedOrders.filter(o => o._isSplit).length === 1 ? '' : 'es'} dividida{bandasMovedOrders.filter(o => o._isSplit).length === 1 ? '' : 's'} (✂)</span>.</>
                  )}
                </p>
              </div>
              {Array.from(bandasExcesoPorPuesto.entries()).filter(([, info]) => info.excessOrders.length > 0).map(([puesto, info]) => (
                <div key={puesto} className="rounded-2xl border border-red-300 bg-red-50/70 px-5 py-4 space-y-2">
                  <p className="text-[9px] font-black uppercase text-red-700 tracking-widest">
                    Órdenes que NO se podrán fabricar en {puesto} · {info.excessOrders.length} orden{info.excessOrders.length !== 1 ? 'es' : ''} · +{info.excessHours.toFixed(2)} h en exceso ({info.utilizacionReal.toFixed(0)}% producible)
                  </p>
                  {info.excessOrders.map((o: any, idx: number) => (
                    <div key={idx} className="flex justify-between text-[10px] font-mono text-red-800 border-b border-red-200 last:border-0 pb-1 last:pb-0">
                      <span className="shrink-0 font-black">{o['MATERIAL'] || o['CodMaterial'] || '—'}</span>
                      <span className="truncate mx-2 flex-1">{o['NOMBRE'] || o['TEXTOMATERIAL'] || '—'}</span>
                      <span className="font-black shrink-0">{Number(o['CANTIDAD'] || o['CANTPROGRAMADA'] || 0).toLocaleString()} uds</span>
                    </div>
                  ))}
                </div>
              ))}
            </div>
          )}

          {/* Sección: Bordadora y Cosedoras de Banda */}
          <div className="flex items-center justify-between px-7 py-3 bg-indigo-50 border border-indigo-200 rounded-full shadow-sm">
            <div className="flex items-center gap-4">
              <div className="w-2 h-2 rounded-full bg-sky-500 animate-pulse" />
              <span className="text-indigo-900 font-black text-xs uppercase tracking-[0.3em]">Bordadora y Cosedoras de Banda</span>
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
            {uniquePuestos.filter(BORD_BAND_PUESTOS_FILTER).map((pName) => {
              const mSum = bordBandAdjustSummary.machines.find(m => m.name === pName);
              const isAccepted = !!mSum && bordBandAcceptedMachines.has(mSum.hrCode);
              return (
                <div key={pName} className="flex flex-col gap-3">
                  <MachineCard
                    puestoName={pName}
                    small
                    orders={techFilteredOrdenes}
                    calculateProductionTime={calculateProductionTime}
                    config={workstationConfigs[pName] || { machine: pName, isDayActive: true, isNightActive: false, isSaturdayActive: false, peopleDay: 0, peopleNight: 0, peopleWeekend: 0, machines: 1 }}
                    horasNetasDiurnas={horasNetasDiurnasVal}
                    horasNetasNocturnas={horasNetasNocturnasVal} horasNetasFinSemana={horasNetasFinSemanaVal}
                    mapToHojaRuta={mapToHojaRutaInternal}
                    normalizeMaterialCode={normalizeMaterialCode}
                    excessOrderKeys={isBordBandAdjustActive ? bordBandExcessKeys : undefined}
                    blockedOrderKeys={ordenesBloqueadasPorPuesto.get(pName)}
                    onToggleBlock={(o) => handleToggleBloqueoOrden(pName, o)}
                  />
                  {/* Botón directo bajo la tarjeta — antes solo estaba dentro del panel de
                      "Análisis de Capacidad" más abajo, desconectado visualmente de su máquina. */}
                  {mSum && (
                    <Button
                      onClick={() => handleAcceptBordAdjustForMachine(mSum.hrCode, mSum.name, mSum.excessOrders.length)}
                      disabled={isAccepted}
                      className={cn(
                        'w-full font-black uppercase tracking-widest text-[9px] px-5 py-2.5 rounded-2xl shadow-lg flex items-center justify-center gap-2',
                        isAccepted ? 'bg-emerald-600 hover:bg-emerald-700 text-white' : 'bg-indigo-600 hover:bg-indigo-700 text-white'
                      )}
                    >
                      <CheckCircle2 className="w-3.5 h-3.5" />
                      {isAccepted ? 'Aceptado ✓' : isBordBandAdjustActive ? 'Aceptar Ajuste' : 'Aceptar Plan'}
                    </Button>
                  )}
                </div>
              );
            })}
          </div>

          {/* Panel de observaciones Bordadora y Cosedoras de Banda */}
          {bordBandAdjustSummary.machines.length > 0 && (
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
                      {!isBordBandAdjustActive && (
                        <p className="text-slate-700 leading-relaxed"><span className="font-black text-slate-800">— Ajuste no activado.</span> Se puede "Aceptar Plan" tal como está hoy en SAP, o presionar "Ajuste de Producción" arriba para marcar el exceso primero.</p>
                      )}
                      {overMachines.length > 0 && (
                        <p className="text-slate-700 leading-relaxed">
                          <span className="font-black text-red-600 inline-flex items-center gap-1"><AlertTriangle className="w-3 h-3 shrink-0" /> {overMachines.length} {overMachines.length === 1 ? 'máquina supera' : 'máquinas superan'} la capacidad:</span>{' '}
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
                              {isAccepted ? 'Aceptado ✓' : isBordBandAdjustActive ? 'Aceptar Ajuste' : 'Aceptar Plan'}
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
                          const cfg = workstationConfigs[m.name] || { isDayActive: true, isNightActive: false, isSaturdayActive: false, peopleDay: 0, peopleNight: 0, peopleWeekend: 0, machines: 1 };
                          const mc = cfg.machines || 1;
                          const dayH = horasNetasDiurnasVal * mc;
                          const nightH = horasNetasNocturnasVal * mc;
                          const personas = (cfg.peopleDay || 0) + (cfg.peopleNight || 0);
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
                                  <p className="text-[9px] text-blue-800 leading-relaxed flex items-start gap-1">
                                    <Lightbulb className="w-3 h-3 shrink-0 mt-0.5" />
                                    <span>Activar <span className="font-black">turno nocturno</span> añade {nightH.toFixed(1)} h.{' '}
                                    {wouldFit ? `Todas las órdenes cabrían — ocupación ${((m.totalHours / newCap) * 100).toFixed(0)}%.` : `Ocupación bajaría a ${((m.totalHours / newCap) * 100).toFixed(0)}% pero aún quedarían órdenes en exceso.`}</span>
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
                                  <p className="text-[9px] text-orange-800 leading-relaxed flex items-start gap-1">
                                    <AlertTriangle className="w-3 h-3 shrink-0 mt-0.5" />
                                    <span>Ambos turnos activos · <span className="font-black">{personas} operador{personas !== 1 ? 'es' : ''}</span>. Faltan <span className="font-black">{shortage.toFixed(1)} h</span>.{' '}
                                    Añadir <span className="font-black">{extraPeople} operador{extraPeople !== 1 ? 'es' : ''} adicional{extraPeople !== 1 ? 'es' : ''}</span> o diferir {m.excessOrders.length} orden{m.excessOrders.length !== 1 ? 'es' : ''} al siguiente ciclo.</span>
                                  </p>
                                </div>
                              );
                            }
                          }
                          if (m.utilization >= 95 && m.utilization <= 100) {
                            return (
                              <div className="rounded-xl bg-green-50 border border-green-200 px-3 py-2">
                                <p className="text-[9px] text-green-700 leading-relaxed flex items-start gap-1">
                                  <CheckCircle2 className="w-3 h-3 shrink-0 mt-0.5" />
                                  <span>Turno <span className="font-black">{turno}</span>{personas > 0 ? ` · ${personas} operador${personas !== 1 ? 'es' : ''}` : ''} — configuración óptima para este período.</span>
                                </p>
                              </div>
                            );
                          }
                          if (m.utilization < 95 && m.utilization > 0) {
                            if (cfg.isNightActive && dayH > 0 && m.totalHours <= dayH) {
                              return (
                                <div className="rounded-xl bg-slate-50 border border-slate-200 px-3 py-2 space-y-1">
                                  <p className="text-[8px] font-black uppercase text-slate-500 tracking-widest">Recomendación de turno</p>
                                  <p className="text-[9px] text-slate-600 leading-relaxed flex items-start gap-1">
                                    <Lightbulb className="w-3 h-3 shrink-0 mt-0.5" />
                                    <span>Las órdenes caben en <span className="font-black">solo turno diurno</span> ({(m.totalHours / dayH * 100).toFixed(0)}% del día).{' '}
                                    Considera desactivar el turno nocturno{personas > 0 ? ` y liberar ${personas} operador${personas !== 1 ? 'es' : ''} para otras áreas` : ''}.</span>
                                  </p>
                                </div>
                              );
                            }
                            return (
                              <div className="rounded-xl bg-slate-50 border border-slate-200 px-3 py-2">
                                <p className="text-[9px] text-slate-600 leading-relaxed flex items-start gap-1">
                                  <TrendingUp className="w-3 h-3 shrink-0 mt-0.5" />
                                  <span>Sin usar: <span className="font-black">{free.toFixed(1)} h</span> · Turno {turno}{personas > 0 ? ` · ${personas} operador${personas !== 1 ? 'es' : ''}` : ''}.{' '}
                                  Se puede asignar más producción o reducir la jornada.</span>
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

          {/* Sección: Cosedoras RMTB — ajuste por Versión de Fabricación (RMTB1/2/3). RMTBM se
              mantiene aparte, por tiempo/capacidad (ver rmtbmInfo más abajo). */}
          <div className="flex items-center justify-between px-7 py-3 bg-indigo-50 border border-indigo-200 rounded-full shadow-sm">
            <div className="flex items-center gap-4">
              <div className="w-2 h-2 rounded-full bg-sky-500 animate-pulse" />
              <span className="text-indigo-900 font-black text-xs uppercase tracking-[0.3em]">Cosedoras RMTB</span>
              <span className="text-indigo-400 font-bold text-[9px] uppercase tracking-widest">
                {isRmtbAjusteActivo
                  ? '· ajuste RMTB1/2/3 activo · RMTBM sin ajuste'
                  : '· mostrando órdenes originales (RMTB1/2/3 + RMTBM)'}
              </span>
            </div>
            <div className="flex items-center gap-2">
              <Button
                onClick={handleToggleAjusteRmtb}
                className={cn('font-black uppercase tracking-widest text-[9px] px-5 py-2 rounded-2xl shadow-lg flex items-center gap-2', isRmtbAjusteActivo ? 'bg-red-600 hover:bg-red-700 text-white' : 'bg-amber-600 hover:bg-amber-700 text-white')}
              >
                <Layers className="w-3.5 h-3.5" /> {isRmtbAjusteActivo ? 'Revertir Ajuste' : 'Ajustar por Versión de Fabricación'}
              </Button>
              {/* El "Aceptar Plan" se movió directo bajo cada tarjeta (ver más abajo) — se quita de
                  aquí para no duplicar el mismo botón dos veces en la misma pantalla. */}
            </div>
          </div>
          {isRmtbAjusteActivo && (
            <div className="flex items-center justify-between gap-3 px-6 py-3 bg-white border border-slate-200 rounded-2xl shadow-sm mb-2">
              <div className="flex items-center gap-2 text-[10px] font-black uppercase tracking-widest text-slate-500">
                <Layers className="w-4 h-4 text-indigo-500" /> Estrategia de ajuste (RMTB1/2/3)
              </div>
              <div className="flex gap-2">
                <Button
                  onClick={() => setModoAjusteRmtb('optimo')}
                  className={cn('text-[9px] font-black uppercase tracking-widest px-4 py-2 rounded-xl', modoAjusteRmtb === 'optimo' ? 'bg-indigo-600 text-white' : 'bg-slate-100 text-slate-500 hover:bg-slate-200')}
                >
                  Óptimo (Versión SAP)
                </Button>
                <Button
                  onClick={() => setModoAjusteRmtb('equilibrado')}
                  className={cn('text-[9px] font-black uppercase tracking-widest px-4 py-2 rounded-xl', modoAjusteRmtb === 'equilibrado' ? 'bg-indigo-600 text-white' : 'bg-slate-100 text-slate-500 hover:bg-slate-200')}
                >
                  Equilibrado (más holgura)
                </Button>
              </div>
            </div>
          )}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-10">
            {uniquePuestos.filter(p => p.includes('RMTB')).map((pName) => {
              const isM = pName.toUpperCase().includes('RMTBM') || pName.toUpperCase().includes('RMTB-M');
              return (
                <div key={pName} className="flex flex-col gap-3">
                  <MachineCard
                    puestoName={pName}
                    small
                    orders={techFilteredOrdenes}
                    calculateProductionTime={calculateProductionTime}
                    config={workstationConfigs[pName] || { machine: pName, isDayActive: true, isNightActive: false, isSaturdayActive: false, peopleDay: 0, peopleNight: 0, peopleWeekend: 0, machines: 1 }}
                    horasNetasDiurnas={horasNetasDiurnasVal}
                    horasNetasNocturnas={horasNetasNocturnasVal} horasNetasFinSemana={horasNetasFinSemanaVal}
                    mapToHojaRuta={mapToHojaRutaInternal}
                    normalizeMaterialCode={normalizeMaterialCode}
                    adjustedInOrders={isM || !isRmtbAjusteActivo ? undefined : rmtbAdjustedInPorPuesto.get(pName)}
                    excludeOrderKeys={isM || !isRmtbAjusteActivo ? undefined : rmtbExcludeKeysPorPuesto.get(pName)}
                    splitRemainderOrders={isM || !isRmtbAjusteActivo ? undefined : rmtbSplitRemaindersPorPuesto.get(pName)}
                    excessOrderKeys={isM ? rmtbmInfo?.excessOrderKeys : undefined}
                    blockedOrderKeys={bloqueoEfectivoPorPuesto.get(pName)}
                    onToggleBlock={(o) => handleToggleBloqueoOrden(pName, o)}
                  />
                  {/* Mismo botón que el del encabezado — acepta RMTB1/2/3+RMTBM como grupo (no hay
                      aceptación por máquina individual aquí), duplicado bajo cada tarjeta para que
                      quede a la vista, igual criterio que el resto de la pestaña. */}
                  <Button
                    onClick={handleAceptarAjusteRmtb}
                    disabled={isAceptandoAjusteRmtb}
                    className={cn(
                      'w-full font-black uppercase tracking-widest text-[9px] px-5 py-2.5 rounded-2xl shadow-lg flex items-center justify-center gap-2',
                      ajusteRmtbAceptado ? 'bg-emerald-600 hover:bg-emerald-700 text-white' : 'bg-indigo-600 hover:bg-indigo-700 text-white'
                    )}
                  >
                    <CheckCircle2 className="w-3.5 h-3.5" />
                    {ajusteRmtbAceptado ? 'Reaceptar Plan' : 'Aceptar Plan'}
                  </Button>
                </div>
              );
            })}
          </div>

          {((isRmtbAjusteActivo && rmtbVersionMovedOrders.length > 0) || rmtbmInfo) && (
            <div className="border border-sky-200 bg-white rounded-[2rem] p-8 shadow-md space-y-5">
              <div className="flex items-center gap-3">
                <div className="bg-sky-600 p-2.5 rounded-xl text-white shadow-md shrink-0">
                  <ClipboardList className="w-4 h-4" />
                </div>
                <h4 className="font-black text-slate-900 uppercase tracking-tight text-sm">Ajuste por Versión de Fabricación — RMTB</h4>
              </div>

              <div className="bg-sky-50 border border-sky-100 rounded-2xl p-5 text-[11px] space-y-4">
                {isRmtbAjusteActivo && rmtbVersionMovedOrders.length > 0 && (
                  <p className="text-slate-700 leading-relaxed">
                    <span className="font-black text-sky-700">↔ {rmtbVersionMovedOrders.length} {rmtbVersionMovedOrders.length === 1 ? 'orden' : 'órdenes'}</span>
                    {' '}se reasignan entre RMTB1, RMTB2 y RMTB3 según la Versión de Fabricación registrada en SAP para cada material "BANDA...".
                    {rmtbVersionMovedOrders.some(o => o._isSplit) && (
                      <> Incluye <span className="font-black text-violet-600">{rmtbVersionMovedOrders.filter(o => o._isSplit).length} orden{rmtbVersionMovedOrders.filter(o => o._isSplit).length === 1 ? '' : 'es'} dividida{rmtbVersionMovedOrders.filter(o => o._isSplit).length === 1 ? '' : 's'} (✂)</span>.</>
                    )}
                  </p>
                )}

                {isRmtbAjusteActivo && rmtbFactibilidad && rmtbFactibilidad.puestos.length > 0 && (
                  <div className="grid grid-cols-1 gap-3">
                    {rmtbFactibilidad.puestos.map(p => {
                      const excesoP = rmtbExcesoPorPuesto.get(p.puesto);
                      return (
                      <div key={p.puesto} className="bg-white rounded-2xl p-4 border border-slate-100 shadow-sm space-y-2">
                        <div className="flex items-center justify-between">
                          <p className="text-[9px] font-black uppercase text-slate-400 tracking-widest">{p.puesto}</p>
                          <span className={cn('font-black text-xl font-mono', p.utilizacion > 100 ? 'text-red-600' : p.utilizacion >= 95 ? 'text-green-600' : 'text-amber-600')}>
                            {p.utilizacion.toFixed(0)}%
                          </span>
                        </div>
                        <div className="h-1.5 bg-slate-100 rounded-full overflow-hidden">
                          <div
                            className={cn('h-full rounded-full', p.utilizacion > 100 ? 'bg-red-500' : p.utilizacion >= 95 ? 'bg-green-500' : 'bg-amber-400')}
                            style={{ width: `${Math.min(p.utilizacion, 100)}%` }}
                          />
                        </div>
                        <div className="flex justify-between text-[9px] text-slate-400 font-mono">
                          <span>Cap: {p.capacidad.toFixed(1)} h</span>
                          <span>Requeridas: {p.horasRequeridas.toFixed(1)} h</span>
                          {p.deficitHoras > 0 && <span className="text-red-600 font-black">Déficit: {p.deficitHoras.toFixed(1)} h</span>}
                        </div>
                        {excesoP && excesoP.excessOrders.length > 0 && (
                          <div className="rounded-xl border border-red-300 bg-red-50/70 px-3 py-2 space-y-1">
                            <p className="text-[8px] font-black uppercase text-red-700 tracking-widest mb-1">
                              Órdenes que NO se podrán fabricar · {excesoP.excessOrders.length} orden{excesoP.excessOrders.length !== 1 ? 'es' : ''} · +{excesoP.excessHours.toFixed(2)} h en exceso
                            </p>
                            {excesoP.excessOrders.map((o: any, idx: number) => (
                              <div key={idx} className="flex justify-between text-[9px] font-mono text-red-800">
                                <span className="shrink-0 font-black">{o['MATERIAL'] || o['CodMaterial'] || '—'}</span>
                                <span className="truncate mx-2 flex-1">{o['NOMBRE'] || o['TEXTOMATERIAL'] || '—'}</span>
                                <span className="font-black shrink-0">{Number(o['CANTIDAD'] || o['CANTPROGRAMADA'] || 0).toLocaleString()} uds</span>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                      );
                    })}
                  </div>
                )}

                {/* Sección RMTBM — se mantiene por tiempo/capacidad, sin redistribución */}
                {rmtbmInfo && (() => {
                  const m = rmtbmInfo;
                  const util = m.cap > 0 ? Math.min((m.finalHours / m.cap) * 100, 100) : 0;
                  const isOver = m.finalHours > m.cap;
                  return (
                    <div className="border border-slate-200 rounded-2xl p-4 space-y-3 bg-white">
                      {/* Encabezado */}
                      <div className="flex items-center justify-between">
                        <p className="text-[9px] font-black uppercase text-slate-500 tracking-widest">
                          {m.name} — Standalone (sin redistribución)
                        </p>
                        <Badge className={cn('font-black text-[9px] px-2 py-0.5 rounded-md border-none inline-flex items-center gap-1', isOver ? 'bg-red-100 text-red-700' : 'bg-emerald-100 text-emerald-700')}>
                          {isOver ? <AlertTriangle className="w-3 h-3" /> : <CheckCircle2 className="w-3 h-3" />}
                          {isOver ? 'EXCEDIDA' : 'EN CAPACIDAD'}
                        </Badge>
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
              </div>
            </div>
          )}
        </TabsContent>

        <TabsContent value="interiores-corte" className="space-y-6 pb-20">
          <Card className="rounded-[2rem] bg-white ring-1 ring-slate-100 overflow-hidden shadow-sm border-none">
            <CardHeader className="bg-slate-50/50 border-b border-slate-200 p-6">
              <div className="flex items-center gap-3">
                <div className="bg-indigo-600 p-2.5 rounded-xl text-white shadow-lg shrink-0">
                  <Settings2 className="w-5 h-5" />
                </div>
                <div>
                  <CardTitle className="text-lg font-black text-slate-900 uppercase">3. Interiores & Corte</CardTitle>
                  <CardDescription className="text-slate-400 font-bold uppercase text-[9px] tracking-widest mt-0.5">
                    Corte, bases, interiores y tapa superior CHN
                  </CardDescription>
                </div>
              </div>
            </CardHeader>
          </Card>

          {/* Otras máquinas de interiores (sin grupos de ajuste) — una sola máquina por hoja de
              ruta, nunca compiten por capacidad con otra, así que no hay nada que redistribuir;
              el botón "Aceptar Plan" está siempre disponible, igual criterio que Forros Finales. */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-10">
            {uniquePuestos.filter(OTROS_INTERIORES_PUESTOS_FILTER).map((pName) => (
              <div key={pName} className="flex flex-col gap-3">
                <MachineCard
                  puestoName={pName}
                  small
                  orders={techFilteredOrdenes}
                  calculateProductionTime={calculateProductionTime}
                  config={workstationConfigs[pName] || { machine: pName, isDayActive: true, isNightActive: false, isSaturdayActive: false, peopleDay: 0, peopleNight: 0, peopleWeekend: 0, machines: 1 }}
                  horasNetasDiurnas={horasNetasDiurnasVal}
                  horasNetasNocturnas={horasNetasNocturnasVal} horasNetasFinSemana={horasNetasFinSemanaVal}
                  mapToHojaRuta={mapToHojaRutaInternal}
                  normalizeMaterialCode={normalizeMaterialCode}
                  blockedOrderKeys={ordenesBloqueadasPorPuesto.get(pName)}
                  onToggleBlock={(o) => handleToggleBloqueoOrden(pName, o)}
                />
                <Button
                  onClick={() => handleAceptarPlanOtrosInteriores(pName)}
                  className={cn(
                    'w-full font-black uppercase tracking-widest text-[9px] px-5 py-2.5 rounded-2xl shadow-lg flex items-center justify-center gap-2',
                    otrosInterioresAceptadoPuestos.has(pName) ? 'bg-emerald-600 hover:bg-emerald-700 text-white' : 'bg-indigo-600 hover:bg-indigo-700 text-white'
                  )}
                >
                  <CheckCircle2 className="w-3.5 h-3.5" />
                  {otrosInterioresAceptadoPuestos.has(pName) ? 'Plan Aceptado · Quitar de Plan Final' : 'Aceptar Plan'}
                </Button>
              </div>
            ))}
          </div>

          {/* Sección agrupada: Máquinas de Corte */}
          <div className="flex items-center justify-between px-7 py-3 bg-indigo-50 border border-indigo-200 rounded-full shadow-sm">
            <div className="flex items-center gap-4">
              <div className="w-2 h-2 rounded-full bg-amber-500 animate-pulse" />
              <span className="text-indigo-900 font-black text-xs uppercase tracking-[0.3em]">Máquinas de Corte</span>
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
              const makeKey = (o: any) => `${o['ORDEN'] || o['ORDENPREVISIONAL'] || ''}|${String(o['MATERIAL'] || o['CodMaterial'] || '')}|${String(o['CANTIDAD'] || o['CANTPROGRAMADA'] || '')}`;
              const movedInOrders = isCorteAdjustActive ? corteMovedOrders.filter(m => m.toHR === hrCode).map(m => m.order) : [];
              const excludeKeys = isCorteAdjustActive ? new Set(corteMovedOrders.filter(m => m.fromHR === hrCode).map(m => makeKey(m.order))) : undefined;
              const yaAceptadaCorte = corteAcceptedMachines.has(hrCode);
              return (
                <div key={pName} className="flex flex-col gap-3">
                  <MachineCard
                    puestoName={pName}
                    small
                    orders={techFilteredOrdenes}
                    calculateProductionTime={calculateProductionTime}
                    config={workstationConfigs[pName] || { machine: pName, isDayActive: true, isNightActive: false, isSaturdayActive: false, peopleDay: 0, peopleNight: 0, peopleWeekend: 0, machines: 1 }}
                    horasNetasDiurnas={horasNetasDiurnasVal}
                    horasNetasNocturnas={horasNetasNocturnasVal} horasNetasFinSemana={horasNetasFinSemanaVal}
                    mapToHojaRuta={mapToHojaRutaInternal}
                    normalizeMaterialCode={normalizeMaterialCode}
                    adjustedInOrders={movedInOrders}
                    excludeOrderKeys={excludeKeys}
                    blockedOrderKeys={ordenesBloqueadasPorPuesto.get(pName)}
                    onToggleBlock={(o) => handleToggleBloqueoOrden(pName, o)}
                  />
                  {/* Antes solo el candado vivía junto a la tarjeta — el botón de aceptar (con o sin
                      ajuste) estaba solo en el panel "Análisis de Capacidad" más abajo, desconectado
                      visualmente. Se agrega aquí también, igual criterio que Forros Finales/Otras
                      Interiores, para que no parezca que la única opción disponible es el bloqueo. */}
                  <Button
                    onClick={() => handleAcceptCorteAdjustForMachine(hrCode, pName)}
                    disabled={yaAceptadaCorte}
                    className={cn(
                      'w-full font-black uppercase tracking-widest text-[9px] px-5 py-2.5 rounded-2xl shadow-lg flex items-center justify-center gap-2',
                      yaAceptadaCorte ? 'bg-emerald-600 hover:bg-emerald-700 text-white cursor-default' : 'bg-indigo-600 hover:bg-indigo-700 text-white'
                    )}
                  >
                    <CheckCircle2 className="w-3.5 h-3.5" />
                    {yaAceptadaCorte ? 'Aceptado ✓' : isCorteAdjustActive ? 'Aceptar Ajuste' : 'Aceptar Plan'}
                  </Button>
                </div>
              );
            })}
          </div>

          {corteAdjustSummary && corteAdjustSummary.machines.length > 0 && renderGenericGroupPanel(corteAdjustSummary, corteAcceptedMachines, handleAcceptCorteAdjustForMachine, 'Máquinas de Corte', 'border-amber-200', 'bg-amber-50 border-amber-100', 'bg-amber-600', isCorteAdjustActive)}

          {/* PROCESO DE BASES */}
          <div className="flex items-center justify-between px-7 py-3 bg-indigo-50 border border-indigo-200 rounded-full shadow-sm">
            <div className="flex items-center gap-4">
              <div className="w-2 h-2 rounded-full bg-teal-500 animate-pulse" />
              <span className="text-indigo-900 font-black text-xs uppercase tracking-[0.3em]">Proceso de Bases</span>
            </div>
            <Button onClick={handleBscAdjust} className={cn('font-black uppercase tracking-widest text-[10px] px-5 py-2 rounded-2xl shadow-lg flex items-center gap-2', isBscAdjustActive ? 'bg-red-600 hover:bg-red-700 text-white' : 'bg-teal-600 hover:bg-teal-700 text-white')}>
              <Layers className="w-4 h-4" /> {isBscAdjustActive ? 'Revertir Ajuste' : 'Ajuste de Producción'}
            </Button>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-10">
            {uniquePuestos.filter(p => p.toUpperCase() === 'COSEDORA-BSC-CC' || p.toUpperCase() === 'COSEDORA-BSCTP').map((pName) => {
              const hrCode = mapToHojaRutaInternal(pName).trim().toUpperCase();
              const mk = (o: any) => `${o['ORDEN'] || o['ORDENPREVISIONAL'] || ''}|${String(o['MATERIAL'] || o['CodMaterial'] || '')}|${String(o['CANTIDAD'] || o['CANTPROGRAMADA'] || '')}`;
              const yaAceptadaBsc = bscAcceptedMachines.has(hrCode);
              return (
                <div key={pName} className="flex flex-col gap-3">
                  <MachineCard puestoName={pName} small orders={techFilteredOrdenes} calculateProductionTime={calculateProductionTime}
                    config={workstationConfigs[pName] || { machine: pName, isDayActive: true, isNightActive: false, isSaturdayActive: false, peopleDay: 0, peopleNight: 0, peopleWeekend: 0, machines: 1 }}
                    horasNetasDiurnas={horasNetasDiurnasVal} horasNetasNocturnas={horasNetasNocturnasVal} horasNetasFinSemana={horasNetasFinSemanaVal}
                    mapToHojaRuta={mapToHojaRutaInternal} normalizeMaterialCode={normalizeMaterialCode}
                    adjustedInOrders={isBscAdjustActive ? bscMovedOrders.filter(m => m.toHR === hrCode).map(m => m.order) : []}
                    excludeOrderKeys={isBscAdjustActive ? new Set(bscMovedOrders.filter(m => m.fromHR === hrCode).map(m => mk(m.order))) : undefined}
                    blockedOrderKeys={ordenesBloqueadasPorPuesto.get(pName)}
                    onToggleBlock={(o) => handleToggleBloqueoOrden(pName, o)}
                  />
                  <Button
                    onClick={() => handleAcceptBscForMachine(hrCode, pName)}
                    disabled={yaAceptadaBsc}
                    className={cn(
                      'w-full font-black uppercase tracking-widest text-[9px] px-5 py-2.5 rounded-2xl shadow-lg flex items-center justify-center gap-2',
                      yaAceptadaBsc ? 'bg-emerald-600 hover:bg-emerald-700 text-white cursor-default' : 'bg-indigo-600 hover:bg-indigo-700 text-white'
                    )}
                  >
                    <CheckCircle2 className="w-3.5 h-3.5" />
                    {yaAceptadaBsc ? 'Aceptado ✓' : isBscAdjustActive ? 'Aceptar Ajuste' : 'Aceptar Plan'}
                  </Button>
                </div>
              );
            })}
          </div>
          {bscAdjustSummary.machines.length > 0 && renderGenericGroupPanel(bscAdjustSummary, bscAcceptedMachines, handleAcceptBscForMachine, 'Proceso de Bases', 'border-teal-200', 'bg-teal-50 border-teal-100', 'bg-teal-600', isBscAdjustActive)}

          {/* PROCESO DE INTERIORES */}
          <div className="flex items-center justify-between px-7 py-3 bg-indigo-50 border border-indigo-200 rounded-full shadow-sm">
            <div className="flex items-center gap-4">
              <div className="w-2 h-2 rounded-full bg-violet-500 animate-pulse" />
              <span className="text-indigo-900 font-black text-xs uppercase tracking-[0.3em]">Proceso de Interiores</span>
            </div>
            <Button onClick={handleIntpfAdjust} className={cn('font-black uppercase tracking-widest text-[10px] px-5 py-2 rounded-2xl shadow-lg flex items-center gap-2', isIntpfAdjustActive ? 'bg-red-600 hover:bg-red-700 text-white' : 'bg-violet-600 hover:bg-violet-700 text-white')}>
              <Layers className="w-4 h-4" /> {isIntpfAdjustActive ? 'Revertir Ajuste' : 'Ajuste de Producción'}
            </Button>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-10">
            {uniquePuestos.filter(p => p.toUpperCase() === 'COSEDORA-INTPF' || p.toUpperCase() === 'COSEDORA-INTPR' || p.toUpperCase() === 'COSEDORA-INTPT').map((pName) => {
              const hrCode = mapToHojaRutaInternal(pName).trim().toUpperCase();
              const mk = (o: any) => `${o['ORDEN'] || o['ORDENPREVISIONAL'] || ''}|${String(o['MATERIAL'] || o['CodMaterial'] || '')}|${String(o['CANTIDAD'] || o['CANTPROGRAMADA'] || '')}`;
              const yaAceptadaIntpf = intpfAcceptedMachines.has(hrCode);
              return (
                <div key={pName} className="flex flex-col gap-3">
                  <MachineCard puestoName={pName} small orders={techFilteredOrdenes} calculateProductionTime={calculateProductionTime}
                    config={workstationConfigs[pName] || { machine: pName, isDayActive: true, isNightActive: false, isSaturdayActive: false, peopleDay: 0, peopleNight: 0, peopleWeekend: 0, machines: 1 }}
                    horasNetasDiurnas={horasNetasDiurnasVal} horasNetasNocturnas={horasNetasNocturnasVal} horasNetasFinSemana={horasNetasFinSemanaVal}
                    mapToHojaRuta={mapToHojaRutaInternal} normalizeMaterialCode={normalizeMaterialCode}
                    adjustedInOrders={isIntpfAdjustActive ? intpfMovedOrders.filter(m => m.toHR === hrCode).map(m => m.order) : []}
                    excludeOrderKeys={isIntpfAdjustActive ? new Set(intpfMovedOrders.filter(m => m.fromHR === hrCode).map(m => mk(m.order))) : undefined}
                    blockedOrderKeys={bloqueoEfectivoPorPuesto.get(pName)}
                    onToggleBlock={(o) => handleToggleBloqueoOrden(pName, o)}
                  />
                  <Button
                    onClick={() => handleAcceptIntpfForMachine(hrCode, pName)}
                    disabled={yaAceptadaIntpf}
                    className={cn(
                      'w-full font-black uppercase tracking-widest text-[9px] px-5 py-2.5 rounded-2xl shadow-lg flex items-center justify-center gap-2',
                      yaAceptadaIntpf ? 'bg-emerald-600 hover:bg-emerald-700 text-white cursor-default' : 'bg-indigo-600 hover:bg-indigo-700 text-white'
                    )}
                  >
                    <CheckCircle2 className="w-3.5 h-3.5" />
                    {yaAceptadaIntpf ? 'Aceptado ✓' : isIntpfAdjustActive ? 'Aceptar Ajuste' : 'Aceptar Plan'}
                  </Button>
                </div>
              );
            })}
          </div>
          {intpfAdjustSummary.machines.length > 0 && renderGenericGroupPanel(intpfAdjustSummary, intpfAcceptedMachines, handleAcceptIntpfForMachine, 'Proceso de Interiores', 'border-violet-200', 'bg-violet-50 border-violet-100', 'bg-violet-600', isIntpfAdjustActive)}

          {isIntpfAdjustActive && intpfDependencyData && (
            <div className="border border-violet-200 bg-white rounded-[2rem] p-8 shadow-md space-y-4">
              <div className="flex items-center gap-3 flex-wrap">
                <div className="bg-violet-600 p-2.5 rounded-xl text-white shadow-md shrink-0">
                  <GitMerge className="w-4 h-4" />
                </div>
                <h4 className="font-black text-slate-900 uppercase tracking-tight text-sm">Dependencias — COSEDORA-INTPF</h4>
                {intpfDependencyData.listaCargada && (
                  <Badge className={cn(
                    'font-black text-[9px] px-2 py-0.5 rounded-md border-none',
                    intpfDependencyData.totalObligatory > 0 ? 'bg-violet-100 text-violet-700' : 'bg-emerald-100 text-emerald-700'
                  )}>
                    {intpfDependencyData.totalObligatory} DEPENDIENTE{intpfDependencyData.totalObligatory !== 1 ? 'S' : ''}
                  </Badge>
                )}
              </div>

              <div className="bg-violet-50 border border-violet-100 rounded-2xl p-5 text-[11px] space-y-4">
                <p className="text-slate-700 leading-relaxed">
                  <span className="font-black text-violet-700">COSEDORA-INTPF es un proceso previo obligatorio</span> para referencias que también pasan por COSEDORA-INTPR o COSEDORA-INTPT.
                  {!intpfDependencyData.listaCargada && (
                    <span className="ml-1 text-amber-600 font-black inline-flex items-center gap-1">
                      <AlertTriangle className="w-3 h-3" /> Lista de Materiales no cargada — consulta la lista para activar este análisis.
                    </span>
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
                            <div className="flex items-center justify-between mb-1">
                              <p className="text-[8px] font-black uppercase text-violet-600 tracking-widest">
                                COSEDORA-INTPR → depende de INTPF
                              </p>
                              <Badge className="font-black text-[8px] px-1.5 py-0 rounded-md border-none bg-violet-200 text-violet-800">
                                {intpfDependencyData.obligatoryIntpr.length} orden{intpfDependencyData.obligatoryIntpr.length !== 1 ? 'es' : ''}
                              </Badge>
                            </div>
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
                            <div className="flex items-center justify-between mb-1">
                              <p className="text-[8px] font-black uppercase text-violet-600 tracking-widest">
                                COSEDORA-INTPT → depende de INTPF
                              </p>
                              <Badge className="font-black text-[8px] px-1.5 py-0 rounded-md border-none bg-violet-200 text-violet-800">
                                {intpfDependencyData.obligatoryIntpt.length} orden{intpfDependencyData.obligatoryIntpt.length !== 1 ? 'es' : ''}
                              </Badge>
                            </div>
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
                            <div className="flex items-center justify-between mb-1">
                              <p className="text-[8px] font-black uppercase text-rose-700 tracking-widest">
                                INTPF liberado por exceso aguas abajo
                              </p>
                              <Badge className="font-black text-[8px] px-1.5 py-0 rounded-md border-none bg-rose-200 text-rose-800">
                                {intpfDependencyData.unnecessaryIntpfOrders.length} orden{intpfDependencyData.unnecessaryIntpfOrders.length !== 1 ? 'es' : ''}
                              </Badge>
                            </div>
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

                        <div className="rounded-xl border border-amber-200 bg-amber-50/50 px-3 py-2 flex items-start gap-2">
                          <AlertTriangle className="w-3.5 h-3.5 text-amber-600 shrink-0 mt-0.5" />
                          <p className="text-[9px] text-amber-800 leading-relaxed">
                            Si COSEDORA-INTPF no tiene capacidad suficiente para estas <span className="font-black">{intpfDependencyData.totalObligatory} orden{intpfDependencyData.totalObligatory !== 1 ? 'es' : ''}</span>, las órdenes correspondientes en INTPR e INTPT quedarán bloqueadas. Prioriza la capacidad de INTPF antes de aceptar el ajuste de las máquinas dependientes.
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
          <div className="flex items-center justify-between px-7 py-3 bg-indigo-50 border border-indigo-200 rounded-full shadow-sm">
            <div className="flex items-center gap-4">
              <div className="w-2 h-2 rounded-full bg-rose-500 animate-pulse" />
              <span className="text-indigo-900 font-black text-xs uppercase tracking-[0.3em]">Proceso Tapa Superior CHN</span>
            </div>
            <Button onClick={handleTtchnAdjust} className={cn('font-black uppercase tracking-widest text-[10px] px-5 py-2 rounded-2xl shadow-lg flex items-center gap-2', isTtchnAdjustActive ? 'bg-red-600 hover:bg-red-700 text-white' : 'bg-rose-600 hover:bg-rose-700 text-white')}>
              <Layers className="w-4 h-4" /> {isTtchnAdjustActive ? 'Revertir Ajuste' : 'Ajuste de Producción'}
            </Button>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-10">
            {uniquePuestos.filter(p => p.toUpperCase() === 'COSEDORA-TTCHN' || p.toUpperCase() === 'COSEDORA-TTSUP-CHN').map((pName) => {
              const hrCode = mapToHojaRutaInternal(pName).trim().toUpperCase();
              const mk = (o: any) => `${o['ORDEN'] || o['ORDENPREVISIONAL'] || ''}|${String(o['MATERIAL'] || o['CodMaterial'] || '')}|${String(o['CANTIDAD'] || o['CANTPROGRAMADA'] || '')}`;
              const yaAceptadaTtchn = ttchnAcceptedMachines.has(hrCode);
              return (
                <div key={pName} className="flex flex-col gap-3">
                  <MachineCard puestoName={pName} small orders={techFilteredOrdenes} calculateProductionTime={calculateProductionTime}
                    config={workstationConfigs[pName] || { machine: pName, isDayActive: true, isNightActive: false, isSaturdayActive: false, peopleDay: 0, peopleNight: 0, peopleWeekend: 0, machines: 1 }}
                    horasNetasDiurnas={horasNetasDiurnasVal} horasNetasNocturnas={horasNetasNocturnasVal} horasNetasFinSemana={horasNetasFinSemanaVal}
                    mapToHojaRuta={mapToHojaRutaInternal} normalizeMaterialCode={normalizeMaterialCode}
                    adjustedInOrders={isTtchnAdjustActive ? ttchnMovedOrders.filter(m => m.toHR === hrCode).map(m => m.order) : []}
                    excludeOrderKeys={isTtchnAdjustActive ? new Set(ttchnMovedOrders.filter(m => m.fromHR === hrCode).map(m => mk(m.order))) : undefined}
                    blockedOrderKeys={ordenesBloqueadasPorPuesto.get(pName)}
                    onToggleBlock={(o) => handleToggleBloqueoOrden(pName, o)}
                  />
                  <Button
                    onClick={() => handleAcceptTtchnForMachine(hrCode, pName)}
                    disabled={yaAceptadaTtchn}
                    className={cn(
                      'w-full font-black uppercase tracking-widest text-[9px] px-5 py-2.5 rounded-2xl shadow-lg flex items-center justify-center gap-2',
                      yaAceptadaTtchn ? 'bg-emerald-600 hover:bg-emerald-700 text-white cursor-default' : 'bg-indigo-600 hover:bg-indigo-700 text-white'
                    )}
                  >
                    <CheckCircle2 className="w-3.5 h-3.5" />
                    {yaAceptadaTtchn ? 'Aceptado ✓' : isTtchnAdjustActive ? 'Aceptar Ajuste' : 'Aceptar Plan'}
                  </Button>
                </div>
              );
            })}
          </div>
          {ttchnAdjustSummary.machines.length > 0 && renderGenericGroupPanel(ttchnAdjustSummary, ttchnAcceptedMachines, handleAcceptTtchnForMachine, 'Proceso Tapa Superior CHN', 'border-rose-200', 'bg-rose-50 border-rose-100', 'bg-rose-600', isTtchnAdjustActive)}
        </TabsContent>

        <TabsContent value="forros" className="space-y-6 pb-20">
          <Card className="rounded-[2rem] bg-white ring-1 ring-slate-100 overflow-hidden shadow-sm border-none">
            <CardHeader className="bg-slate-50/50 border-b border-slate-200 p-6">
              <div className="flex items-center gap-3">
                <div className="bg-indigo-600 p-2.5 rounded-xl text-white shadow-lg shrink-0">
                  <LayoutGrid className="w-5 h-5" />
                </div>
                <div>
                  <CardTitle className="text-lg font-black text-slate-900 uppercase">4. Forros Finales</CardTitle>
                  <CardDescription className="text-slate-400 font-bold uppercase text-[9px] tracking-widest mt-0.5">
                    Puestos de forro y forro base
                  </CardDescription>
                </div>
              </div>
            </CardHeader>
          </Card>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-10">
            {uniquePuestos.filter(p => p.includes('FORRO') || p.includes('FBASE')).map((pName) => (
              <div key={pName} className="flex flex-col gap-3">
                <MachineCard
                  puestoName={pName}
                  small
                  orders={techFilteredOrdenes}
                  calculateProductionTime={calculateProductionTime}
                  config={workstationConfigs[pName] || { machine: pName, isDayActive: true, isNightActive: false, isSaturdayActive: false, peopleDay: 0, peopleNight: 0, peopleWeekend: 0, machines: 1 }}
                  horasNetasDiurnas={horasNetasDiurnasVal}
                  horasNetasNocturnas={horasNetasNocturnasVal} horasNetasFinSemana={horasNetasFinSemanaVal}
                  mapToHojaRuta={mapToHojaRutaInternal}
                  normalizeMaterialCode={normalizeMaterialCode}
                  blockedOrderKeys={ordenesBloqueadasPorPuesto.get(pName)}
                  onToggleBlock={(o) => handleToggleBloqueoOrden(pName, o)}
                />
                {/* Aceptar por máquina — esta pestaña no redistribuye nada, así que el botón está
                    siempre disponible: acepta el plan tal cual, menos lo bloqueado con el candado. */}
                <Button
                  onClick={() => handleAceptarPlanForros(pName)}
                  className={cn(
                    'w-full font-black uppercase tracking-widest text-[9px] px-5 py-2.5 rounded-2xl shadow-lg flex items-center justify-center gap-2',
                    forrosAceptadoPuestos.has(pName) ? 'bg-emerald-600 hover:bg-emerald-700 text-white' : 'bg-indigo-600 hover:bg-indigo-700 text-white'
                  )}
                >
                  <CheckCircle2 className="w-3.5 h-3.5" />
                  {forrosAceptadoPuestos.has(pName) ? 'Plan Aceptado · Quitar de Plan Final' : 'Aceptar Plan'}
                </Button>
              </div>
            ))}
          </div>
        </TabsContent>

        <TabsContent value="resumen-produccion">
          {renderDateFilterHeaderInternal()}

          {/* Dashboard de Horarios y Turnos: resumen de solo lectura de lo configurado en "Personal
              y Turnos" — para verlo de un vistazo sin tener que entrar a esa pestaña. */}
          <Card className="rounded-[2.5rem] bg-white ring-1 ring-slate-100 overflow-hidden shadow-sm mb-8">
            <CardHeader className="bg-slate-50/50 border-b border-slate-200 p-10">
              <CardTitle className="text-2xl font-black text-slate-900 uppercase">Horarios y Turnos</CardTitle>
              <CardDescription className="text-[11px] font-bold text-slate-400 uppercase tracking-widest mt-1">
                Jornadas elegidas hoy y turnos activos por puesto de trabajo
              </CardDescription>
            </CardHeader>
            <CardContent className="p-10 space-y-8">
              <div className="flex flex-wrap gap-4">
                <div className="rounded-2xl bg-amber-50 border border-amber-200 px-5 py-3 flex items-center gap-3">
                  <Sun className="w-4 h-4 text-amber-500 shrink-0" />
                  <div>
                    <p className="text-[8px] font-black text-amber-600 uppercase tracking-[0.15em]">Jornada Diurna</p>
                    <p className="text-xs font-black text-slate-800">
                      {trabajaEnFeriado
                        ? `${FERIADO_OPTIONS.find(o => o.value === jornadaFeriadoSel)?.label || `${jornadaFeriadoSel} h`} (feriado)`
                        : (DIURNA_OPTIONS.find(o => o.value === jornadaDiurnaSel)?.label || `${jornadaDiurnaSel} h`)}
                    </p>
                  </div>
                </div>
                <div className="rounded-2xl bg-indigo-50 border border-indigo-200 px-5 py-3 flex items-center gap-3">
                  <Moon className="w-4 h-4 text-indigo-500 shrink-0" />
                  <div>
                    <p className="text-[8px] font-black text-indigo-600 uppercase tracking-[0.15em]">Jornada Nocturna</p>
                    <p className="text-xs font-black text-slate-800">
                      {trabajaEnFeriado ? 'Sin jornada (feriado)' : (NOCTURNA_OPTIONS.find(o => o.value === jornadaNocturnaSel)?.label || `${jornadaNocturnaSel} h`)}
                    </p>
                  </div>
                </div>
                <div className="rounded-2xl bg-emerald-50 border border-emerald-200 px-5 py-3 flex items-center gap-3">
                  <CalendarIcon className="w-4 h-4 text-emerald-500 shrink-0" />
                  <div>
                    <p className="text-[8px] font-black text-emerald-600 uppercase tracking-[0.15em]">Jornada Fin de Semana</p>
                    <p className="text-xs font-black text-slate-800">
                      {FIN_DE_SEMANA_OPTIONS.find(o => o.value === jornadaFinSemanaSel)?.label || `${jornadaFinSemanaSel} h`}
                    </p>
                  </div>
                </div>
                {esDiaFeriado && (
                  <div className="rounded-2xl bg-rose-50 border border-rose-200 px-5 py-3 flex items-center gap-3">
                    <AlertTriangle className="w-4 h-4 text-rose-500 shrink-0" />
                    <div>
                      <p className="text-[8px] font-black text-rose-600 uppercase tracking-[0.15em]">Día Feriado</p>
                      <p className="text-xs font-black text-slate-800">{feriadoVigente?.nombre || 'Marcado manualmente'}</p>
                    </div>
                  </div>
                )}
              </div>

              <div className="space-y-6">
                {workstationGroups.map((group, gIdx) => {
                  const items = group.items.filter(p => uniquePuestos.includes(p));
                  if (items.length === 0) return null;
                  return (
                    <div key={gIdx} className="space-y-3">
                      <div className="flex items-center gap-3">
                        <div className="h-5 w-1 bg-indigo-600 rounded-full" />
                        <h3 className="text-sm font-black text-indigo-950 uppercase tracking-tight">{group.title}</h3>
                      </div>
                      <div className="overflow-x-auto rounded-2xl border border-slate-200">
                        <table className="w-full text-[11px] border-collapse">
                          <thead className="bg-slate-50 text-slate-500 border-b border-slate-200 text-left uppercase tracking-widest font-black">
                            <tr>
                              <th className="px-5 py-3">Puesto</th>
                              <th className="px-5 py-3 text-sky-400">HR</th>
                              <th className="px-5 py-3 text-center">Día</th>
                              <th className="px-5 py-3 text-center">Noche</th>
                              <th className="px-5 py-3 text-center">Sábado</th>
                              <th className="px-5 py-3 text-center">Máquinas</th>
                              <th className="px-5 py-3 text-right">Capacidad (h)</th>
                              <th className="px-5 py-3 text-center min-w-[160px]">% Ocupación</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-slate-100">
                            {items.map(p => {
                              const config = workstationConfigs[p] || { machine: p, isDayActive: true, isNightActive: false, isSaturdayActive: false, peopleDay: 0, peopleNight: 0, peopleWeekend: 0, machines: 1 };
                              const capacidadTotal = capacidadPuesto(p, config, horasNetasDiurnasVal, horasNetasNocturnasVal, horasNetasFinSemanaVal);
                              // Mismo % que "Salud de Planta": si este puesto comparte Hoja de Ruta
                              // con otro (pool), el % es del grupo completo, no de este puesto solo.
                              const ocupacion = ocupacionPorHR.get(p);
                              const utilization = ocupacion?.utilization ?? 0;
                              const turnoBadge = (activo: boolean, personas: number, colorActivo: string) => (
                                <Badge className={cn(
                                  'font-black text-[9px] uppercase tracking-wider px-2 py-1 rounded-lg border',
                                  activo ? colorActivo : 'bg-slate-50 text-slate-400 border-slate-200'
                                )}>
                                  {activo ? `${personas} pers.` : 'Inactivo'}
                                </Badge>
                              );
                              return (
                                <tr key={p} className="hover:bg-slate-50 transition-all">
                                  <td className="px-5 py-3 font-black text-slate-900 uppercase whitespace-nowrap">{p}</td>
                                  <td className="px-5 py-3 font-mono font-bold text-indigo-700 uppercase whitespace-nowrap">{mapToHojaRutaInternal(p) || 'S/HR'}</td>
                                  <td className="px-5 py-3 text-center">{turnoBadge(config.isDayActive, config.peopleDay || 0, 'bg-amber-50 text-amber-700 border-amber-200')}</td>
                                  <td className="px-5 py-3 text-center">{turnoBadge(config.isNightActive, config.peopleNight || 0, 'bg-indigo-50 text-indigo-700 border-indigo-200')}</td>
                                  <td className="px-5 py-3 text-center">{turnoBadge(config.isSaturdayActive, config.peopleWeekend || 0, 'bg-emerald-50 text-emerald-700 border-emerald-200')}</td>
                                  <td className="px-5 py-3 text-center font-mono font-bold text-slate-700">{config.machines || 1}</td>
                                  <td className="px-5 py-3 text-right font-mono font-black text-slate-900">{capacidadTotal.toFixed(2)}h</td>
                                  <td className="px-5 py-3 text-center">
                                    <div className="flex items-center justify-center gap-2 w-full">
                                      <div className="flex-1 bg-slate-100 h-2 rounded-full overflow-hidden border border-slate-200 shadow-inner max-w-[80px]">
                                        <div
                                          className={cn(
                                            "h-full transition-all duration-500",
                                            utilization > 100 ? "bg-red-500" : utilization >= 90 ? "bg-green-500" : "bg-yellow-400"
                                          )}
                                          style={{ width: `${Math.min(utilization, 100)}%` }}
                                        />
                                      </div>
                                      <span className={cn(
                                        "font-mono font-black text-[10px] min-w-[32px] text-right",
                                        utilization > 100 ? "text-red-600" : utilization >= 90 ? "text-green-700" : "text-yellow-600"
                                      )}>
                                        {utilization.toFixed(0)}%
                                      </span>
                                    </div>
                                  </td>
                                </tr>
                              );
                            })}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  );
                })}
              </div>
            </CardContent>
          </Card>

          <Card className="rounded-[2.5rem] bg-white ring-1 ring-slate-100 overflow-hidden shadow-sm">
            <CardHeader className="bg-slate-50/50 border-b border-slate-200 p-10 flex flex-row items-center justify-between gap-4">
              <CardTitle className="text-2xl font-black text-slate-900 uppercase">Salud de Planta (Órdenes Previsionales)</CardTitle>
              {/* Destinatarios en la restricción "CORREOS_PLAN" (grupo Forros) — sin UI de captura
                  nueva, se crea/edita en Parámetros → Grupos → Restricciones. */}
              <Button
                onClick={handleEnviarCorreoResumen}
                disabled={isEnviandoCorreoResumen}
                title={correosPlanDestinatarios.length > 0 ? `Destinatarios: ${correosPlanDestinatarios.join(', ')}` : 'Sin destinatarios — crea la restricción CORREOS_PLAN'}
                className="bg-indigo-600 hover:bg-indigo-700 text-white font-black uppercase tracking-widest text-[10px] px-5 py-2.5 rounded-xl shadow-lg flex items-center gap-2 disabled:opacity-50 shrink-0"
              >
                {isEnviandoCorreoResumen ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Mail className="w-3.5 h-3.5" />}
                Enviar Correo
              </Button>
            </CardHeader>
            <CardContent className="p-0">
              <div className="overflow-x-auto">
                <table className="w-full text-[12px] border-collapse">
                  <thead className="bg-slate-50 text-slate-500 border-b border-slate-200 text-left uppercase tracking-widest font-black">
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
                    {Array.from(new Set(ocupacionPorHR.values())).map((grupo, idx) => {
                      const isUnified = grupo.puestos.length > 1;
                      const displayName = isUnified ? `${grupo.puestos[0]} (POOL)` : grupo.puestos[0];
                      return (
                        <tr key={idx} className="hover:bg-slate-50 transition-all">
                          <td className="px-8 py-5 font-black text-slate-900 uppercase whitespace-nowrap">
                            {displayName}
                            {grupo.yaAceptado && (
                              <span className="ml-2 inline-block text-[8px] font-black uppercase tracking-wider text-emerald-600 align-middle">
                                · Ajustado (Plan Final)
                              </span>
                            )}
                          </td>
                          <td className="px-8 py-5 font-mono font-black text-indigo-700 uppercase whitespace-nowrap">
                            <Badge className="bg-indigo-50 text-indigo-700 border-indigo-200 font-bold px-3 py-1 rounded-lg">
                              {grupo.hrCode}
                            </Badge>
                          </td>
                          <td className="px-8 py-5 text-right font-mono font-black text-slate-800">{grupo.totalUnits.toLocaleString()}</td>
                          <td className="px-8 py-5 text-right font-mono font-black text-indigo-700 bg-indigo-50/40">{grupo.totalTimeHours.toFixed(2)}h</td>
                          <td className="px-8 py-5 text-right font-mono font-bold text-slate-900">{grupo.totalCapacityHours.toFixed(2)}h</td>
                          <td className="px-8 py-5 text-center">
                             <div className="flex flex-col items-center justify-center gap-1">
                               <div className="flex items-center justify-center gap-3 w-full">
                                 <div className="flex-1 bg-slate-100 h-2.5 rounded-full overflow-hidden border border-slate-200 shadow-inner">
                                   <div
                                     className={cn(
                                       "h-full transition-all duration-500",
                                       grupo.utilization > 100 ? "bg-red-500 shadow-[0_0_8px_rgba(239,68,68,0.3)]" :
                                       grupo.utilization >= 90 ? "bg-green-500" :
                                       "bg-yellow-400"
                                     )}
                                     style={{ width: `${Math.min(grupo.utilization, 100)}%` }}
                                   />
                                 </div>
                                 <span className={cn(
                                   "font-mono font-black text-[10px] min-w-[35px] text-right",
                                   grupo.utilization > 100 ? "text-red-600" :
                                   grupo.utilization >= 90 ? "text-green-700" :
                                   "text-yellow-600"
                                 )}>
                                   {grupo.utilization.toFixed(0)}%
                                 </span>
                               </div>
                             </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="plan-final" className="space-y-6 pb-20">
          <Card className="rounded-[2.5rem] bg-white ring-1 ring-slate-100 overflow-hidden shadow-sm border-none">
            <div className="px-8 py-5 bg-slate-50/50 border-b border-slate-200 text-slate-900 flex items-center justify-between">
              <div className="flex items-center gap-4">
                <div className="bg-indigo-600 p-2.5 rounded-xl text-white shadow-lg">
                  <TableIcon className="w-5 h-5" />
                </div>
                <div>
                  <h2 className="font-black text-lg uppercase tracking-tight leading-none text-slate-900">Plan Final de Producción</h2>
                  {/* La fecha que sale en GSTRS/GLTRS es la del día PLANIFICADO, no la de hoy —
                      se muestra acá para que sea evidente antes de exportar a SAP. */}
                  <p className="text-slate-400 text-[10px] font-black uppercase tracking-widest mt-0.5">
                    Órdenes con ajuste aplicado
                    {planFinalFechaPlanificada && (
                      <span className={cn('ml-2', recuperacionFechasCalculadas?.n2n3 ? 'text-indigo-600' : 'text-amber-600')}>
                        · Fecha de producción: {formatFechaSAP(planFinalFechaPlanificada)}
                        {!recuperacionFechasCalculadas?.n2n3 && ' (provisional — elige la fecha del P1 en "Recuperación Pasos P1-P3")'}
                      </span>
                    )}
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-3">
                <Badge className="bg-indigo-600 text-white font-mono font-black text-sm px-4 py-1.5 rounded-xl border-none">
                  {planFinalOrders.length} ÓRDENES
                </Badge>
                <Button
                  onClick={handleGuardarPlanFinal}
                  disabled={planFinalOrders.length === 0 || isGuardandoPlanFinal}
                  className={cn(
                    'font-black uppercase tracking-widest text-[9px] px-4 py-2 rounded-xl disabled:opacity-40 flex items-center gap-2',
                    planFinalGuardado ? 'bg-emerald-700 hover:bg-emerald-800 text-white' : 'bg-indigo-600 hover:bg-indigo-700 text-white'
                  )}
                >
                  {isGuardandoPlanFinal ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <CheckCircle2 className="w-3.5 h-3.5" />}
                  {planFinalGuardado ? 'Guardado' : 'Guardar Plan'}
                </Button>
                <Button
                  onClick={handleDescargarPlanFinalExcel}
                  disabled={planFinalOrders.length === 0 || !recuperacionFechasCalculadas?.n2n3}
                  className="bg-emerald-600 hover:bg-emerald-700 text-white font-black uppercase tracking-widest text-[9px] px-4 py-2 rounded-xl disabled:opacity-40 flex items-center gap-2"
                >
                  <Download className="w-3.5 h-3.5" /> Excel
                </Button>
                <Button
                  onClick={handleDescargarPlanFinalTxt}
                  disabled={planFinalOrders.length === 0 || !recuperacionFechasCalculadas?.n2n3}
                  variant="outline"
                  className="border-slate-300 text-slate-700 font-black uppercase tracking-widest text-[9px] px-4 py-2 rounded-xl disabled:opacity-40 flex items-center gap-2"
                >
                  <Download className="w-3.5 h-3.5" /> TXT
                </Button>
              </div>
            </div>

            {/* Frescura por puesto (Opción A + aviso): el resync sigue actuando solo, esto solo
                muestra CUÁNDO se actualizó de verdad el contenido de cada fuente por última vez. */}
            {Object.keys(planFinalUltimaActualizacion).length > 0 && (
              <div className="px-8 py-3 bg-slate-50/70 border-b border-slate-200 flex flex-wrap items-center gap-2">
                {Array.from(new Set(planFinalOrders.map(o => String(o._source || 'sin-fuente'))))
                  .filter(source => planFinalUltimaActualizacion[source])
                  .sort((a, b) => planFinalUltimaActualizacion[b] - planFinalUltimaActualizacion[a])
                  .map(source => {
                    const ms = Date.now() - planFinalUltimaActualizacion[source];
                    const texto = ms < 60000 ? 'hace instantes' : ms < 3600000 ? `hace ${Math.floor(ms / 60000)} min` : `hace ${Math.floor(ms / 3600000)} h`;
                    return (
                      <span key={source} className="inline-flex items-center gap-1.5 text-[9px] font-black uppercase tracking-wider text-slate-500 bg-white border border-slate-200 rounded-lg px-2.5 py-1">
                        <RefreshCw className="w-2.5 h-2.5 text-indigo-400" /> {source.replace(/^(acolchado|tapa|bandas|rmtb|corte|bsc|intpf|ttchn|bord-bandas|forros|otros-interiores|cosedoras-adicionales)-/, '')}
                        <span className="text-indigo-500">· {texto}</span>
                      </span>
                    );
                  })}
              </div>
            )}

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
                    <thead className="bg-slate-50 text-slate-500 border-b border-slate-200 sticky top-0 z-10">
                      <tr>
                        <th className="px-6 py-4 text-left font-black uppercase tracking-widest text-[10px]">Cod. Orden</th>
                        <th className="px-6 py-4 text-left font-black uppercase tracking-widest text-[10px] text-indigo-700">Material</th>
                        <th className="px-6 py-4 text-left font-black uppercase tracking-widest text-[10px]">Centro</th>
                        <th className="px-6 py-4 text-left font-black uppercase tracking-widest text-[10px]">Tipo de Orden</th>
                        <th className="px-6 py-4 text-left font-black uppercase tracking-widest text-[10px]">Puesto</th>
                        <th className="px-6 py-4 text-left font-black uppercase tracking-widest text-[10px]">Fecha Inicio</th>
                        <th className="px-6 py-4 text-right font-black uppercase tracking-widest text-[10px]">Cantidad</th>
                        <th className="px-6 py-4 text-left font-black uppercase tracking-widest text-[10px]">Fecha Fin</th>
                        <th className="px-6 py-4 text-left font-black uppercase tracking-widest text-[10px]">Versión de Fabricación</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {planFinalOrders
                        .map((o, i) => ({ o, i }))
                        .sort((a, b) => String(a.o._finalHR || '').localeCompare(String(b.o._finalHR || '')))
                        .map(({ o, i }) => {
                          const wasAdjusted = !!o._wasAdjusted;
                          const row = planFinalExportRows[i];
                          const textMain = wasAdjusted ? 'text-red-600' : 'text-slate-700';
                          return (
                            <tr key={i} className={cn('transition-colors', wasAdjusted ? 'bg-red-50/40 hover:bg-red-50/70' : 'hover:bg-slate-50')}>
                              <td className="px-6 py-3 whitespace-nowrap text-slate-500 font-mono">{row.COD_ORDEN}</td>
                              <td className={cn('px-6 py-3 font-mono font-bold whitespace-nowrap', textMain)}>{row.PLNBEZ}</td>
                              <td className="px-6 py-3 whitespace-nowrap text-slate-600">{row.WERKS}</td>
                              <td className="px-6 py-3 whitespace-nowrap text-slate-600">{row.AUART || '—'}</td>
                              <td className="px-6 py-3 whitespace-nowrap text-slate-600">{row.ARBPL || '—'}</td>
                              <td className="px-6 py-3 whitespace-nowrap text-slate-600">{row.GSTRS || '—'}</td>
                              <td className={cn('px-6 py-3 text-right font-mono font-black', textMain)}>{row.GAMNG.toLocaleString()}</td>
                              <td className="px-6 py-3 whitespace-nowrap text-slate-600">{row.GLTRS || '—'}</td>
                              <td className="px-6 py-3 whitespace-nowrap text-slate-600">{row.VERID || '—'}</td>
                            </tr>
                          );
                        })}
                    </tbody>
                    <tfoot className="bg-slate-50 border-t-2 border-slate-200 sticky bottom-0">
                      <tr>
                        <td colSpan={6} className="px-6 py-3 text-[9px] font-black uppercase text-slate-400 tracking-widest">
                          {planFinalOrders.filter(o => o._wasAdjusted).length} reasignadas (en rojo) · {planFinalOrders.length} total
                        </td>
                        <td className="px-6 py-3 text-right font-mono font-black text-slate-900">
                          {planFinalOrders.reduce((s, o) => s + Number(o['CANTIDAD'] || o['CANTPROGRAMADA'] || 0), 0).toLocaleString()}
                        </td>
                        <td colSpan={2} />
                      </tr>
                    </tfoot>
                  </table>
                </div>
              )}
            </CardContent>
          </Card>

          <AlertDialog
            open={confirmGuardarPlanFinalOpen}
            onOpenChange={(open) => {
              if (!open && !isGuardandoPlanFinal) {
                setConfirmGuardarPlanFinalOpen(false);
                setPlanFinalExistente(null);
              }
            }}
          >
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Ya existe un Plan Final activo para esta fecha</AlertDialogTitle>
                <AlertDialogDescription>
                  No puede haber dos planes activos iguales en la base. Ya existe un plan_grupo activo
                  "PFM - FINAL" ({planFinalExistente?.length ?? 0} plan(es)) para esta fecha. ¿Deseas crear el nuevo
                  y desactivar el existente?
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel
                  disabled={isGuardandoPlanFinal}
                  onClick={() => setPlanFinalExistente(null)}
                >
                  Cancelar
                </AlertDialogCancel>
                <AlertDialogAction
                  disabled={isGuardandoPlanFinal}
                  onClick={(e) => { e.preventDefault(); handleConfirmarGuardarPlanFinal(); }}
                >
                  {isGuardandoPlanFinal ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : 'Crear Nuevo y Desactivar Existente'}
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </TabsContent>
          </Tabs>
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
                  <div className="px-6 py-3 bg-slate-50 border-b border-slate-200 text-slate-700 font-black text-[10px] uppercase tracking-widest flex items-center gap-2">
                    <Boxes className="w-4 h-4 text-indigo-600" /> Resumen de Forros (Insumos CHN) por Centro y Responsable
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
                                      row.centro === '1000' ? "bg-sky-50 text-sky-700 border border-sky-200" : "bg-indigo-700 text-white"
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
              {renderFertTableInternal(fert1000, summary1000, "Órdenes FERT - Centro 1000 (UIO)", targetDate1000, setTargetDate1000, "bg-sky-600")}
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
                <Badge className="bg-indigo-50 text-indigo-700 border-indigo-200 font-mono text-[10px] font-black py-1 px-3 rounded-lg">CENTRO: 1000</Badge>
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
                    <thead className="bg-slate-50 text-slate-500 border-b border-slate-200 sticky top-0 z-10 text-left uppercase tracking-widest font-black">
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
                    <thead className="bg-slate-50 text-slate-500 border-b border-slate-200 sticky top-0 z-10 text-left uppercase tracking-widest font-black">
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
            <div className="w-full max-w-xs xl:max-w-none xl:w-[220px] shrink-0 space-y-4">
              <Card className="rounded-[1.5rem] bg-white border-none shadow-sm ring-1 ring-slate-100 overflow-hidden">
                 <CardHeader className="bg-slate-50/50 border-b border-slate-200 text-slate-900 p-3.5 rounded-t-[1.5rem]">
                   <CardTitle className="text-xs font-black uppercase text-slate-900">Jornada Global</CardTitle>
                   <div className="mt-1.5 flex items-center gap-1.5 text-[8px] font-black text-indigo-600 uppercase tracking-[0.2em]">
                     <Users className="w-2.5 h-2.5" /> Eficiencia Operativa: 84%
                   </div>
                 </CardHeader>
                 <CardContent className="p-3.5 space-y-3">
                   <div className="space-y-1.5">
                      <label className="text-[8px] font-black text-slate-400 uppercase tracking-[0.15em] flex items-center gap-1"><Sun className="w-3 h-3 text-amber-500" /> Jornada Diurna</label>
                      <Select value={jornadaDiurnaSel} onValueChange={setJornadaDiurnaSel} disabled={isJornadaEstablecida}>
                        <SelectTrigger className="h-8 border-2 rounded-lg font-black text-slate-800 text-xs disabled:opacity-50 disabled:cursor-not-allowed">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {DIURNA_OPTIONS.map(opt => <SelectItem key={opt.value} value={opt.value} className="font-black py-2 text-xs">{opt.label}</SelectItem>)}
                        </SelectContent>
                      </Select>
                   </div>
                   <div className="space-y-1.5">
                      <label className="text-[8px] font-black text-slate-400 uppercase tracking-[0.15em] flex items-center gap-1"><Moon className="w-3 h-3 text-indigo-500" /> Jornada Nocturna</label>
                      <Select value={jornadaNocturnaSel} onValueChange={setJornadaNocturnaSel} disabled={isJornadaEstablecida}>
                        <SelectTrigger className="h-8 border-2 rounded-lg font-black text-slate-800 text-xs disabled:opacity-50 disabled:cursor-not-allowed">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {NOCTURNA_OPTIONS.map(opt => <SelectItem key={opt.value} value={opt.value} className="font-black py-2 text-xs">{opt.label}</SelectItem>)}
                        </SelectContent>
                      </Select>
                   </div>
                   <div className="space-y-1.5">
                      <label className="text-[8px] font-black text-slate-400 uppercase tracking-[0.15em] flex items-center gap-1"><CalendarIcon className="w-3 h-3 text-emerald-500" /> Jornada Fin de Semana</label>
                      <Select value={jornadaFinSemanaSel} onValueChange={setJornadaFinSemanaSel} disabled={isJornadaEstablecida}>
                        <SelectTrigger className="h-8 border-2 rounded-lg font-black text-slate-800 text-xs disabled:opacity-50 disabled:cursor-not-allowed">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {FIN_DE_SEMANA_OPTIONS.map(opt => <SelectItem key={opt.value} value={opt.value} className="font-black py-2 text-xs">{opt.label}</SelectItem>)}
                        </SelectContent>
                      </Select>
                   </div>

                   {/* ── Día Feriado ─────────────────────────────────────────────────────────
                       Aviso automático con el calendario de feriados de Ecuador (el mismo que ya
                       usan las fechas P2/P3) + interruptor manual: hay feriados en los que igual
                       se produce, así que la detección solo avisa, no decide. Con el modo activo
                       la jornada de feriado reemplaza a la diurna (0h = la planta no produce). */}
                   {(feriadoDeFechaPlan || proximoFeriado) && (
                     <div className={cn(
                       'rounded-lg p-2.5 border',
                       feriadoDeFechaPlan ? 'bg-rose-50 border-rose-200' : 'bg-amber-50 border-amber-200'
                     )}>
                       <div className="flex items-start gap-1.5">
                         <AlertTriangle className={cn('w-3 h-3 mt-0.5 shrink-0', feriadoDeFechaPlan ? 'text-rose-500' : 'text-amber-500')} />
                         <div className="min-w-0">
                           <p className={cn('text-[8px] font-black uppercase tracking-[0.15em] leading-tight', feriadoDeFechaPlan ? 'text-rose-600' : 'text-amber-600')}>
                             {feriadoDeFechaPlan ? 'La fecha del plan es feriado' : `Feriado en ${proximoFeriado!.dias} día(s)`}
                           </p>
                           <p className="text-[9px] font-bold text-slate-700 leading-tight mt-0.5 capitalize">
                             {formatFechaLarga((feriadoDeFechaPlan || proximoFeriado!).fecha)}
                           </p>
                           <p className="text-[9px] font-black text-slate-900 leading-tight">
                             {(feriadoDeFechaPlan || proximoFeriado!).nombre}
                           </p>
                         </div>
                       </div>
                     </div>
                   )}

                   <div className="space-y-1.5">
                     {/* Calendario para elegir el día: los feriados nacionales de Ecuador van
                         sombreados en rosa, pero se puede marcar CUALQUIER día como no laborable
                         (paro, cierre de planta, mantenimiento mayor), no solo los oficiales. */}
                     <Popover open={isFeriadoCalendarOpen} onOpenChange={setIsFeriadoCalendarOpen}>
                       <PopoverTrigger asChild>
                         <Button
                           disabled={isJornadaEstablecida}
                           className={cn(
                             'w-full font-black uppercase tracking-widest text-[9px] px-3 py-2 rounded-lg shadow-sm flex items-center justify-center gap-1.5 disabled:opacity-50 disabled:cursor-not-allowed',
                             esDiaFeriado ? 'bg-rose-600 hover:bg-rose-700 text-white' : 'bg-white hover:bg-slate-50 text-slate-500 border border-slate-200'
                           )}
                         >
                           <CalendarIcon className="w-3 h-3" />
                           {esDiaFeriado && feriadoVigente
                             ? new Date(`${feriadoVigente.fecha}T00:00:00`).toLocaleDateString('es-EC', { day: '2-digit', month: 'short' })
                             : 'Marcar Día Feriado'}
                         </Button>
                       </PopoverTrigger>
                       <PopoverContent className="w-auto p-0" align="start">
                         <DatePickerCalendar
                           mode="single"
                           selected={esDiaFeriado && feriadoVigente ? new Date(`${feriadoVigente.fecha}T00:00:00`) : undefined}
                           onSelect={(date) => { if (date) handleSeleccionarFechaFeriado(toIsoLocal(date)); }}
                           modifiers={{ feriadoNacional: (date) => feriadosPorFecha.has(toIsoLocal(date)) }}
                           modifiersClassNames={{ feriadoNacional: 'font-black text-rose-700 shadow-[inset_0_0_0_9999px_rgba(244,63,94,0.16)] rounded-md' }}
                         />
                         <div className="px-4 pb-3 space-y-1">
                           <div className="flex items-center gap-2 text-[9px] font-bold text-slate-400 uppercase tracking-wider">
                             <span className="inline-block w-3 h-3 rounded bg-rose-200" /> Feriado nacional (Ecuador)
                           </div>
                           {feriadoVigente && (
                             <p className="text-[9px] font-black text-slate-700 capitalize leading-tight">
                               {formatFechaLarga(feriadoVigente.fecha)} · <span className="font-bold text-slate-500">{feriadoVigente.nombre}</span>
                             </p>
                           )}
                         </div>
                       </PopoverContent>
                     </Popover>
                     {esDiaFeriado && (
                       <Button
                         onClick={handleToggleDiaFeriado}
                         disabled={isJornadaEstablecida}
                         className="w-full font-black uppercase tracking-widest text-[8px] px-3 py-1.5 rounded-lg bg-white hover:bg-red-50 text-red-600 border border-red-200 shadow-none disabled:opacity-50 disabled:cursor-not-allowed"
                       >
                         Quitar día feriado
                       </Button>
                     )}
                     {esDiaFeriado && (
                       <>
                         <label className="text-[8px] font-black text-rose-500 uppercase tracking-[0.15em] flex items-center gap-1">
                           <CalendarIcon className="w-3 h-3" /> Jornada Feriado
                           {feriadoVigente && <span className="font-bold text-slate-400 normal-case tracking-normal truncate">· {feriadoVigente.nombre}</span>}
                         </label>
                         <Select value={jornadaFeriadoSel} onValueChange={handleChangeJornadaFeriado} disabled={isJornadaEstablecida}>
                           <SelectTrigger className="h-8 border-2 border-rose-200 rounded-lg font-black text-slate-800 text-xs disabled:opacity-50 disabled:cursor-not-allowed">
                             <SelectValue />
                           </SelectTrigger>
                           <SelectContent>
                             {FERIADO_OPTIONS.map(opt => <SelectItem key={opt.value} value={opt.value} className="font-black py-2 text-xs">{opt.label}</SelectItem>)}
                           </SelectContent>
                         </Select>
                         <p className="text-[8px] font-bold text-slate-400 leading-tight">
                           {jornadaFeriadoSel === '0'
                             ? `No se produce el feriado: la planificación es para el ${formatFechaLarga(techStartDate)}, con jornada normal.`
                             : `Se trabaja el feriado ${formatFechaLarga(techStartDate)}: ${(parseFloat(jornadaFeriadoSel) * 0.84).toFixed(2)} h netas diurnas por puesto, sin turno nocturno.`}
                         </p>
                         {fechaAntesFeriado && (
                           <p className="text-[8px] font-bold text-slate-300 leading-tight">
                             Fecha original: {formatFechaLarga(fechaAntesFeriado.inicio)} (se restaura al desmarcar).
                           </p>
                         )}
                       </>
                     )}
                   </div>

                   <Button
                     onClick={() => setIsJornadaEstablecida(prev => !prev)}
                     className={cn(
                       'w-full font-black uppercase tracking-widest text-[9px] px-3 py-2.5 rounded-lg shadow-sm flex items-center justify-center gap-1.5',
                       isJornadaEstablecida ? 'bg-white hover:bg-red-50 text-red-600 border border-red-200' : 'bg-indigo-600 hover:bg-indigo-700 text-white'
                     )}
                   >
                     {isJornadaEstablecida ? <><Lock className="w-3 h-3" /> Editar Jornada</> : <><CheckCircle2 className="w-3 h-3" /> Establecer Horario</>}
                   </Button>
                 </CardContent>
              </Card>

              {/* Resumen de Mantenimiento Preventivo Total — suma de horas agendadas para la fecha de planificación, junto a Jornada Global */}
              <Card className="rounded-[1.5rem] bg-white border-none shadow-sm ring-1 ring-orange-100 overflow-hidden">
                <CardContent className="p-3.5 flex items-center gap-3 bg-orange-50">
                  <div className="bg-orange-500 p-2 rounded-xl text-white shadow-md shadow-orange-200 shrink-0">
                    <Wrench className="w-4 h-4" />
                  </div>
                  <div className="min-w-0">
                    <p className="text-[8px] font-black uppercase text-orange-500 tracking-[0.15em] leading-tight">Mant. Preventivo Total</p>
                    <p className="font-black text-orange-700 leading-none mt-1">
                      <span className="text-xl">{mantenimientoHorasTotal.toFixed(1)}</span>
                      <span className="text-[10px] ml-1">h</span>
                    </p>
                  </div>
                </CardContent>
              </Card>

              {/* Capacitación total del día — horas ya descontadas de la capacidad de cada puesto. */}
              <Card className="rounded-[1.5rem] bg-white border-none shadow-sm ring-1 ring-violet-100 overflow-hidden">
                <CardContent className="p-3.5 flex items-center gap-3 bg-violet-50">
                  <div className="bg-violet-500 p-2 rounded-xl text-white shadow-md shadow-violet-200 shrink-0">
                    <Users className="w-4 h-4" />
                  </div>
                  <div className="min-w-0">
                    <p className="text-[8px] font-black uppercase text-violet-500 tracking-[0.15em] leading-tight">Capacitación Total</p>
                    <p className="font-black text-violet-700 leading-none mt-1">
                      <span className="text-xl">{capacitacionResumen.horas.toFixed(1)}</span>
                      <span className="text-[10px] ml-1">h</span>
                    </p>
                    <p className="text-[7px] font-bold uppercase text-violet-400 tracking-tighter mt-0.5 leading-none">
                      {capacitacionResumen.horas > 0
                        ? `${capacitacionResumen.personas} pers. en ${capacitacionResumen.puestos} puesto(s)`
                        : 'Sin capacitaciones registradas'}
                    </p>
                  </div>
                </CardContent>
              </Card>

              {/* Resumen de dotación por turno — cuenta solo las personas de puestos con ESE turno
                  activo, así el número refleja quién trabaja de verdad y no lo que quedó cargado en
                  un turno apagado. El de fin de semana solo aparece si la jornada está habilitada. */}
              <Card className="rounded-[1.5rem] bg-white border-none shadow-sm ring-1 ring-slate-100 overflow-hidden">
                <CardHeader className="bg-slate-50/50 border-b border-slate-200 p-3 rounded-t-[1.5rem]">
                  <CardTitle className="text-[10px] font-black uppercase text-slate-900 flex items-center gap-1.5">
                    <Users className="w-3 h-3 text-indigo-600" /> Personas por Turno
                  </CardTitle>
                </CardHeader>
                <CardContent className="p-3 space-y-2">
                  <div className="flex items-center justify-between gap-2 rounded-xl bg-amber-50 border border-amber-100 px-2.5 py-2">
                    <span className="flex items-center gap-1.5 text-[9px] font-black uppercase text-amber-600 tracking-wider">
                      <Sun className="w-3 h-3" /> Día
                    </span>
                    <span className="text-right leading-none">
                      <span className="text-lg font-black text-amber-700">{personasPorTurnoResumen.dia}</span>
                      <span className="block text-[7px] font-bold uppercase text-amber-400 tracking-tighter mt-0.5">{personasPorTurnoResumen.puestosDia} puesto(s)</span>
                    </span>
                  </div>
                  <div className="flex items-center justify-between gap-2 rounded-xl bg-indigo-50 border border-indigo-100 px-2.5 py-2">
                    <span className="flex items-center gap-1.5 text-[9px] font-black uppercase text-indigo-600 tracking-wider">
                      <Moon className="w-3 h-3" /> Noche
                    </span>
                    <span className="text-right leading-none">
                      <span className="text-lg font-black text-indigo-700">{personasPorTurnoResumen.noche}</span>
                      <span className="block text-[7px] font-bold uppercase text-indigo-400 tracking-tighter mt-0.5">{personasPorTurnoResumen.puestosNoche} puesto(s)</span>
                    </span>
                  </div>
                  {horasNetasFinSemanaVal > 0 && (
                    <div className="flex items-center justify-between gap-2 rounded-xl bg-emerald-50 border border-emerald-100 px-2.5 py-2">
                      <span className="flex items-center gap-1.5 text-[9px] font-black uppercase text-emerald-600 tracking-wider">
                        <CalendarIcon className="w-3 h-3" /> Fin de Semana
                      </span>
                      <span className="text-right leading-none">
                        <span className="text-lg font-black text-emerald-700">{personasPorTurnoResumen.finSemana}</span>
                        <span className="block text-[7px] font-bold uppercase text-emerald-400 tracking-tighter mt-0.5">{personasPorTurnoResumen.puestosFinSemana} puesto(s)</span>
                      </span>
                    </div>
                  )}
                  <div className="flex items-center justify-between gap-2 border-t border-slate-100 pt-2">
                    <span className="text-[9px] font-black uppercase text-slate-400 tracking-wider">Total asignado</span>
                    <span className="text-lg font-black text-slate-900 leading-none">{personasPorTurnoResumen.total}</span>
                  </div>
                  {personasPorTurnoResumen.total === 0 && (
                    <p className="text-[8px] font-bold text-slate-400 leading-tight">
                      Sin personas asignadas todavía: cárgalas con los contadores +/− de cada tarjeta.
                    </p>
                  )}
                </CardContent>
              </Card>
            </div>

            <div className="flex-1 space-y-8">
              <div className="flex items-center justify-between gap-4 p-5 bg-white border border-slate-200 rounded-[1.5rem] shadow-sm">
                <div>
                  <p className="text-sm font-black text-slate-900 uppercase tracking-tight">
                    {isPlanPersonalEstablecido ? 'Plan de Personal y Turnos Establecido' : 'Configura Máquinas, Personas y Turnos'}
                  </p>
                  <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mt-0.5">
                    {isPlanPersonalEstablecido ? 'Los controles quedaron bloqueados por esta semana — se reinician automáticamente el próximo lunes' : 'Cuando termines de ajustar, establece el plan para bloquearlo'}
                  </p>
                </div>
                <Button
                  onClick={() => setIsPlanPersonalEstablecido(prev => !prev)}
                  className={cn(
                    'font-black uppercase tracking-widest text-[10px] px-5 py-3 rounded-2xl shadow-lg flex items-center gap-2 shrink-0',
                    isPlanPersonalEstablecido ? 'bg-white hover:bg-red-50 text-red-600 border border-red-200' : 'bg-indigo-600 hover:bg-indigo-700 text-white'
                  )}
                >
                  {isPlanPersonalEstablecido ? <><Lock className="w-4 h-4" /> Editar de Nuevo</> : <><CheckCircle2 className="w-4 h-4" /> Establecer Plan</>}
                </Button>
              </div>

              {workstationGroups.map((group, gIdx) => {
                const availableItems = group.items.filter(item => uniquePuestos.includes(item));
                if (availableItems.length === 0) return null;
                return (
                  <div key={gIdx} className="space-y-4">
                    <div className="flex items-center gap-3">
                      <div className="h-6 w-1.5 bg-indigo-600 rounded-full" />
                      <h3 className="text-base font-black text-indigo-950 uppercase tracking-tighter">{group.title}</h3>
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-5">
                      {availableItems.map(p => {
                        const config = workstationConfigs[p] || { machine: p, isDayActive: true, isNightActive: false, isSaturdayActive: false, peopleDay: 0, peopleNight: 0, peopleWeekend: 0, machines: 1 };
                        const hrCode = mapToHojaRutaInternal(p);
                        const mantenimientoHoras = hrCode
                          ? hrCode.split(' / ').reduce((sum, code) => sum + (mantenimientoHorasPorPuesto[code.trim().toUpperCase()] || 0), 0)
                          : 0;
                        const esPuestoPersonas = PUESTOS_CAPACIDAD_POR_PERSONAS.has(p);
                        const tieneHorarioPersonalizado = !!config.horarioPersonalizadoActivo;
                        // Horas disponibles netas: se calculan por turno (día usa peopleDay/máquinas, noche
                        // usa peopleNight/máquinas — ver capacidadPuesto), restando el mantenimiento
                        // preventivo agendado para el puesto ese día. Solo se usan para el desglose visual
                        // cuando el puesto sigue con los 3 turnos fijos de Jornada Global.
                        const capPuestoDia = config.isDayActive ? horasNetasDiurnasVal * factorCapacidadPuestoPorTurno(p, config, 'dia') : 0;
                        const capPuestoNoche = config.isNightActive ? horasNetasNocturnasVal * factorCapacidadPuestoPorTurno(p, config, 'noche') : 0;
                        const capPuestoSabado = config.isSaturdayActive ? horasNetasFinSemanaVal * factorCapacidadPuestoPorTurno(p, config, 'sabado') : 0;
                        // Capacitación ya la descuenta `capacidadPuesto` (misma fórmula que usan Ajuste de
                        // Producción y el resto de la app) — el mantenimiento se resta solo aquí, es la
                        // única fuente que no pasa por `capacidadPuesto`.
                        const capacitacionHorasPuesto = horasCapacitacionPuesto(p, config);
                        const capPuestoTotal = Math.max(0, capacidadPuesto(p, config, horasNetasDiurnasVal, horasNetasNocturnasVal, horasNetasFinSemanaVal) - mantenimientoHoras);

                        return (
                          <div key={p} className="flex flex-col p-5 border border-slate-200 rounded-[1.75rem] bg-white hover:border-indigo-300 transition-all shadow-sm relative group">
                            <div className="mb-4">
                              <Badge className="bg-indigo-600 text-white border-none font-mono text-[9px] uppercase font-bold tracking-widest px-2 py-0.5 rounded-lg shadow-sm mb-2">
                                {hrCode || 'S/HR'}
                              </Badge>
                              <h4 className="font-black text-indigo-950 uppercase text-lg leading-tight break-words">{p}</h4>

                              {/* ── RECURSOS: lo que SUMA capacidad ──────────────────────────────
                                  En los puestos que miden por máquinas, las personas se muestran
                                  atenuadas: son informativas y NO entran al cálculo (ver
                                  factorCapacidadPuestoPorTurno). Se muestran igual, a pedido del
                                  usuario, para saber cuánta gente hay asignada. */}
                              <p className="mt-3 mb-1.5 text-[7px] font-black uppercase text-slate-400 tracking-[0.2em] flex items-center gap-1">
                                <span className="inline-block w-1 h-1 rounded-full bg-sky-400" /> Recursos · suman capacidad
                              </p>
                              <div className="flex items-center gap-2 flex-wrap">
                                {/* Máquinas — control +/− */}
                                <div
                                  title={esPuestoPersonas
                                    ? 'Número de máquinas del puesto. En esta categoría la capacidad se mide por PERSONAS, así que este dato es informativo.'
                                    : `Número de máquinas. La capacidad es horas de jornada × ${config.machines || 1} máquina(s).`}
                                  className={cn('flex flex-col items-center bg-sky-50 border-2 border-sky-300 w-12 rounded-xl shadow-inner overflow-hidden group-hover:border-sky-400 transition-colors shrink-0', esPuestoPersonas && 'opacity-50')}
                                >
                                  <button
                                    disabled={isPlanPersonalEstablecido}
                                    onClick={() => setWorkstationConfigs(prev => ({ ...prev, [p]: { ...config, machines: (config.machines || 1) + 1 } }))}
                                    className="w-full py-0.5 hover:bg-sky-200 text-sky-600 font-black text-xs leading-none transition-colors disabled:opacity-30 disabled:hover:bg-transparent disabled:cursor-not-allowed"
                                  >+</button>
                                  <span className="text-lg font-black text-sky-700 leading-none py-0.5">{config.machines || 1}</span>
                                  <span className="text-[6px] font-black uppercase text-sky-400 tracking-tighter pb-0.5 text-center leading-none">Máquinas</span>
                                  <button
                                    disabled={isPlanPersonalEstablecido}
                                    onClick={() => setWorkstationConfigs(prev => ({ ...prev, [p]: { ...config, machines: Math.max(1, (config.machines || 1) - 1) } }))}
                                    className="w-full py-0.5 hover:bg-sky-200 text-sky-600 font-black text-xs leading-none transition-colors disabled:opacity-30 disabled:hover:bg-transparent disabled:cursor-not-allowed"
                                  >−</button>
                                </div>
                                {/* Disponibilidad (OEE) — SOLO LECTURA: viene de la restricción
                                    DISPONIBILIDAD_<PUESTO> del grupo Forros (Parámetros → Grupos →
                                    Restricciones), valor mensual. Si no hay restricción cargada para
                                    este puesto se muestra 100% atenuado (sin reducir la capacidad). */}
                                <div
                                  title={config.disponibilidad !== undefined
                                    ? `Disponibilidad (OEE) mensual: ${(config.disponibilidad * 100).toFixed(0)}%. Viene de la restricción DISPONIBILIDAD_${p} (Parámetros → Grupos → Restricciones), no se edita aquí.`
                                    : `Sin restricción DISPONIBILIDAD_${p} cargada — la capacidad no se reduce (100%). Créala en Parámetros → Grupos → Restricciones si quieres aplicar el OEE de este puesto.`}
                                  className={cn(
                                    'flex flex-col items-center justify-center bg-cyan-50 border-2 border-dashed border-cyan-300 w-16 rounded-xl shadow-inner shrink-0 py-1.5',
                                    config.disponibilidad === undefined && 'opacity-50'
                                  )}
                                >
                                  <div className="flex items-center gap-0.5">
                                    <Gauge className="w-3 h-3 text-cyan-500" />
                                    <Lock className="w-2 h-2 text-cyan-300" />
                                  </div>
                                  <span className="text-lg font-black text-cyan-700 leading-none py-0.5">
                                    {((config.disponibilidad ?? 1) * 100).toFixed(0)}%
                                  </span>
                                  <span className="text-[6px] font-black uppercase text-cyan-400 tracking-tighter text-center leading-none">Disponibilidad</span>
                                </div>
                                {/* Un bloque POR TURNO: horario y personas juntos, que es como se
                                    planifica en la práctica ("el turno de día son 9.24 h con 2
                                    personas"). Las horas vienen de Jornada Global (solo lectura); las
                                    personas se editan aquí. Turno apagado = bloque atenuado. */}
                                {([
                                  { key: 'dia', label: 'Día', horas: horasNetasDiurnasVal, activo: !!config.isDayActive, personas: config.peopleDay || 0, campo: 'peopleDay', clase: 'amber' },
                                  { key: 'noche', label: 'Noche', horas: horasNetasNocturnasVal, activo: !!config.isNightActive, personas: config.peopleNight || 0, campo: 'peopleNight', clase: 'indigo' },
                                  { key: 'fs', label: 'Sábado', horas: horasNetasFinSemanaVal, activo: !!config.isSaturdayActive && horasNetasFinSemanaVal > 0, personas: config.peopleWeekend || 0, campo: 'peopleWeekend', clase: 'emerald' },
                                ]).map(t => (
                                  <div
                                    key={t.key}
                                    title={esPuestoPersonas
                                      ? `Turno de ${t.label.toLowerCase()}: ${t.activo ? t.horas.toFixed(2) + ' h' : 'inactivo'}. La capacidad se calcula como horas × personas.`
                                      : `Turno de ${t.label.toLowerCase()}: ${t.activo ? t.horas.toFixed(2) + ' h' : 'inactivo'}. La capacidad va por máquinas; las personas son para el conteo de personal del área.`}
                                    className={cn(
                                      'flex items-center gap-2 rounded-xl border-2 border-dashed shadow-inner shrink-0 pl-2.5 pr-1.5 py-1.5',
                                      t.clase === 'amber' && 'bg-amber-50 border-amber-300',
                                      t.clase === 'indigo' && 'bg-indigo-50 border-indigo-300',
                                      t.clase === 'emerald' && 'bg-emerald-50 border-emerald-300',
                                      !t.activo && 'opacity-40'
                                    )}
                                  >
                                    <div className="flex flex-col items-start">
                                      <span className={cn('flex items-center gap-1 text-[7px] font-black uppercase tracking-tighter leading-none',
                                        t.clase === 'amber' && 'text-amber-500',
                                        t.clase === 'indigo' && 'text-indigo-400',
                                        t.clase === 'emerald' && 'text-emerald-500')}>
                                        {t.key === 'dia' && <Sun className="w-2.5 h-2.5" />}
                                        {t.key === 'noche' && <Moon className="w-2.5 h-2.5" />}
                                        {t.key === 'fs' && <CalendarIcon className="w-2.5 h-2.5" />}
                                        {t.label}
                                      </span>
                                      <span className={cn('font-mono text-sm font-black leading-none mt-1',
                                        t.clase === 'amber' && 'text-amber-700',
                                        t.clase === 'indigo' && 'text-indigo-700',
                                        t.clase === 'emerald' && 'text-emerald-700')}>
                                        {t.activo ? `${t.horas.toFixed(2)} h` : '— h'}
                                      </span>
                                    </div>
                                    <div className={cn('flex flex-col items-center pl-2 border-l',
                                      t.clase === 'amber' && 'border-amber-200',
                                      t.clase === 'indigo' && 'border-indigo-200',
                                      t.clase === 'emerald' && 'border-emerald-200')}>
                                      <button
                                        disabled={isPlanPersonalEstablecido}
                                        onClick={() => setWorkstationConfigs(prev => ({ ...prev, [p]: { ...config, [t.campo]: t.personas + 1 } }))}
                                        className={cn('px-1 font-black text-[10px] leading-none rounded transition-colors disabled:opacity-30 disabled:cursor-not-allowed',
                                          t.clase === 'amber' && 'text-amber-700 hover:bg-amber-200',
                                          t.clase === 'indigo' && 'text-indigo-600 hover:bg-indigo-200',
                                          t.clase === 'emerald' && 'text-emerald-700 hover:bg-emerald-200')}
                                      >+</button>
                                      <span className={cn('text-base font-black leading-none py-0.5',
                                        t.clase === 'amber' && 'text-amber-700',
                                        t.clase === 'indigo' && 'text-indigo-700',
                                        t.clase === 'emerald' && 'text-emerald-700')}>{t.personas}</span>
                                      <button
                                        disabled={isPlanPersonalEstablecido}
                                        onClick={() => setWorkstationConfigs(prev => ({ ...prev, [p]: { ...config, [t.campo]: Math.max(0, t.personas - 1) } }))}
                                        className={cn('px-1 font-black text-[10px] leading-none rounded transition-colors disabled:opacity-30 disabled:cursor-not-allowed',
                                          t.clase === 'amber' && 'text-amber-700 hover:bg-amber-200',
                                          t.clase === 'indigo' && 'text-indigo-600 hover:bg-indigo-200',
                                          t.clase === 'emerald' && 'text-emerald-700 hover:bg-emerald-200')}
                                      >−</button>
                                      <span className={cn('text-[6px] font-black uppercase tracking-tighter leading-none',
                                        t.clase === 'amber' && 'text-amber-500',
                                        t.clase === 'indigo' && 'text-indigo-400',
                                        t.clase === 'emerald' && 'text-emerald-500')}>pers</span>
                                    </div>
                                  </div>
                                ))}
                              </div>

                              {/* ── DESCUENTOS: lo que RESTA horas disponibles ───────────────── */}
                              <p className="mt-3 mb-1.5 text-[7px] font-black uppercase text-slate-400 tracking-[0.2em] flex items-center gap-1">
                                <span className="inline-block w-1 h-1 rounded-full bg-violet-400" /> Descuentos · restan horas
                              </p>
                              <div className="flex items-stretch gap-2 flex-wrap">
                                {/* Capacitación — visible en CUALQUIER puesto (unificado: antes existía
                                    también un "Paros Planeados" aparte, se fusionó en uno solo). En los
                                    puestos por PERSONAS se registra Personas × Horas (más gente capacitada
                                    a la vez = más horas-persona perdidas); en los puestos por MÁQUINAS solo
                                    se pide Horas — la máquina para ese tiempo sin importar cuánta gente
                                    participe, así que no tiene sentido multiplicar por personas ahí. El
                                    Motivo queda siempre visible. */}
                                <div
                                  title="Capacitación del día. Afecta también a Ajuste de Producción."
                                  className="flex flex-col gap-1.5 bg-violet-50 border-2 border-dashed border-violet-300 rounded-xl shadow-inner px-2 py-1.5 shrink-0"
                                >
                                  <div className="flex items-center gap-2">
                                    {esPuestoPersonas && (
                                      <>
                                        <div className="flex flex-col items-center">
                                          <button
                                            disabled={isPlanPersonalEstablecido}
                                            onClick={() => setWorkstationConfigs(prev => ({ ...prev, [p]: { ...config, capacitacionPersonas: (config.capacitacionPersonas || 0) + 1 } }))}
                                            className="px-1.5 hover:bg-violet-200 text-violet-700 font-black text-xs leading-none rounded transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
                                          >+</button>
                                          <span className="text-base font-black text-violet-700 leading-none py-0.5">{config.capacitacionPersonas || 0}</span>
                                          <button
                                            disabled={isPlanPersonalEstablecido}
                                            onClick={() => setWorkstationConfigs(prev => ({ ...prev, [p]: { ...config, capacitacionPersonas: Math.max(0, (config.capacitacionPersonas || 0) - 1) } }))}
                                            className="px-1.5 hover:bg-violet-200 text-violet-700 font-black text-xs leading-none rounded transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
                                          >−</button>
                                        </div>
                                        <span className="text-[8px] font-black text-violet-400">pers ×</span>
                                      </>
                                    )}
                                    <div className="flex flex-col items-center">
                                      <button
                                        disabled={isPlanPersonalEstablecido}
                                        onClick={() => setWorkstationConfigs(prev => ({ ...prev, [p]: { ...config, capacitacionHoras: Number(((config.capacitacionHoras || 0) + 0.5).toFixed(1)) } }))}
                                        className="px-1.5 hover:bg-violet-200 text-violet-700 font-black text-xs leading-none rounded transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
                                      >+</button>
                                      <span className="text-base font-black text-violet-700 leading-none py-0.5">{(config.capacitacionHoras || 0).toFixed(1)}</span>
                                      <button
                                        disabled={isPlanPersonalEstablecido}
                                        onClick={() => setWorkstationConfigs(prev => ({ ...prev, [p]: { ...config, capacitacionHoras: Math.max(0, Number(((config.capacitacionHoras || 0) - 0.5).toFixed(1))) } }))}
                                        className="px-1.5 hover:bg-violet-200 text-violet-700 font-black text-xs leading-none rounded transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
                                      >−</button>
                                    </div>
                                    <div className="flex flex-col items-start justify-center pl-1 border-l border-violet-200">
                                      <span className="text-[6px] font-black uppercase text-violet-500 tracking-tighter leading-none">Capacitación</span>
                                      <span className="text-sm font-black text-violet-700 leading-none mt-0.5">= {capacitacionHorasPuesto.toFixed(1)} h</span>
                                    </div>
                                  </div>
                                  <input
                                    type="text"
                                    disabled={isPlanPersonalEstablecido}
                                    value={config.capacitacionMotivo || ''}
                                    onChange={(e) => setWorkstationConfigs(prev => ({ ...prev, [p]: { ...config, capacitacionMotivo: e.target.value } }))}
                                    placeholder="Motivo de la capacitación"
                                    className="w-full text-[9px] font-bold text-violet-700 bg-violet-50 border border-violet-200 rounded-lg px-2 py-1 outline-none focus:ring-1 focus:ring-violet-400 disabled:opacity-50 disabled:cursor-not-allowed placeholder:text-violet-300 placeholder:font-normal"
                                  />
                                </div>
                                {/* Mantenimiento Preventivo — SOLO LECTURA: viene agendado desde SISMAC. */}
                                <div
                                  title="Mantenimiento preventivo agendado para esta fecha (viene de SISMAC, no se edita aquí)."
                                  className="flex flex-col items-center justify-center bg-orange-50 border-2 border-dashed border-orange-300 w-16 rounded-xl shadow-inner shrink-0 py-1.5"
                                >
                                  <div className="flex items-center gap-0.5">
                                    <Wrench className="w-3 h-3 text-orange-500" />
                                    <Lock className="w-2 h-2 text-orange-300" />
                                  </div>
                                  <span className="text-lg font-black text-orange-700 leading-none py-0.5">
                                    {mantenimientoHoras.toFixed(1)}
                                  </span>
                                  <span className="text-[6px] font-black uppercase text-orange-400 tracking-tighter text-center leading-none">Mantenimiento</span>
                                </div>
                              </div>

                            </div>

                            <div className="space-y-4 mt-auto">
                              <div className="bg-slate-50 p-3 rounded-2xl border border-slate-100">
                                <div className="flex justify-between items-center text-[9px] text-slate-400 uppercase font-black tracking-widest mb-2">
                                  <span>{tieneHorarioPersonalizado ? 'Turnos Personalizados' : 'Turnos Activos'}</span>
                                  {/* Horario Personalizado: reemplaza los 3 turnos fijos de Jornada Global
                                      por una lista propia de turnos con horario libre, solo para este
                                      puesto — pensado para el caso de una máquina con horario distinto al
                                      resto de la planta (turno diferente, paro parcial, etc.). */}
                                  <button
                                    disabled={isPlanPersonalEstablecido}
                                    onClick={() => setWorkstationConfigs(prev => ({
                                      ...prev,
                                      [p]: {
                                        ...config,
                                        horarioPersonalizadoActivo: !tieneHorarioPersonalizado,
                                        turnosPersonalizados: !tieneHorarioPersonalizado && (config.turnosPersonalizados || []).length === 0
                                          ? [{ horaInicio: '07:00', horaFin: '15:45', personas: 0 }]
                                          : config.turnosPersonalizados,
                                      },
                                    }))}
                                    className={cn(
                                      'font-black uppercase tracking-[0.1em] text-[7px] px-2 py-1 rounded-lg border transition-colors disabled:opacity-40 disabled:cursor-not-allowed',
                                      tieneHorarioPersonalizado ? 'bg-fuchsia-600 text-white border-fuchsia-700' : 'bg-white text-slate-400 border-slate-200 hover:border-fuchsia-300'
                                    )}
                                  >
                                    {tieneHorarioPersonalizado ? 'Volver a Jornada Global' : 'Horario Personalizado'}
                                  </button>
                                </div>
                                {tieneHorarioPersonalizado ? (
                                  <div className="space-y-2">
                                    {(config.turnosPersonalizados || []).map((turno, tIdx) => (
                                      <div key={tIdx} className="flex items-center gap-1.5 bg-white rounded-xl border border-fuchsia-200 p-2 shadow-sm">
                                        <input
                                          type="time"
                                          disabled={isPlanPersonalEstablecido}
                                          value={turno.horaInicio}
                                          onChange={(e) => setWorkstationConfigs(prev => {
                                            const turnos = [...(config.turnosPersonalizados || [])];
                                            turnos[tIdx] = { ...turnos[tIdx], horaInicio: e.target.value };
                                            return { ...prev, [p]: { ...config, turnosPersonalizados: turnos } };
                                          })}
                                          className="text-[10px] font-black text-fuchsia-700 bg-fuchsia-50 border border-fuchsia-200 rounded-lg px-1 py-1 outline-none focus:ring-1 focus:ring-fuchsia-400 disabled:opacity-50 w-[72px]"
                                        />
                                        <span className="text-[8px] font-black text-fuchsia-300">a</span>
                                        <input
                                          type="time"
                                          disabled={isPlanPersonalEstablecido}
                                          value={turno.horaFin}
                                          onChange={(e) => setWorkstationConfigs(prev => {
                                            const turnos = [...(config.turnosPersonalizados || [])];
                                            turnos[tIdx] = { ...turnos[tIdx], horaFin: e.target.value };
                                            return { ...prev, [p]: { ...config, turnosPersonalizados: turnos } };
                                          })}
                                          className="text-[10px] font-black text-fuchsia-700 bg-fuchsia-50 border border-fuchsia-200 rounded-lg px-1 py-1 outline-none focus:ring-1 focus:ring-fuchsia-400 disabled:opacity-50 w-[72px]"
                                        />
                                        <span className="text-[8px] font-black text-fuchsia-400 shrink-0">
                                          {horasNetasTurnoPersonalizado(turno.horaInicio, turno.horaFin).toFixed(2)}h
                                        </span>
                                        <div className="flex items-center gap-0.5 ml-auto shrink-0">
                                          <button
                                            disabled={isPlanPersonalEstablecido}
                                            onClick={() => setWorkstationConfigs(prev => {
                                              const turnos = [...(config.turnosPersonalizados || [])];
                                              turnos[tIdx] = { ...turnos[tIdx], personas: Math.max(0, (turnos[tIdx].personas || 0) - 1) };
                                              return { ...prev, [p]: { ...config, turnosPersonalizados: turnos } };
                                            })}
                                            className="px-1 hover:bg-fuchsia-100 text-fuchsia-700 font-black text-[10px] leading-none rounded transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
                                          >−</button>
                                          <span className="text-[10px] font-black text-fuchsia-700 w-4 text-center">{turno.personas || 0}</span>
                                          <button
                                            disabled={isPlanPersonalEstablecido}
                                            onClick={() => setWorkstationConfigs(prev => {
                                              const turnos = [...(config.turnosPersonalizados || [])];
                                              turnos[tIdx] = { ...turnos[tIdx], personas: (turnos[tIdx].personas || 0) + 1 };
                                              return { ...prev, [p]: { ...config, turnosPersonalizados: turnos } };
                                            })}
                                            className="px-1 hover:bg-fuchsia-100 text-fuchsia-700 font-black text-[10px] leading-none rounded transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
                                          >+</button>
                                          <span className="text-[6px] font-black uppercase text-fuchsia-400">pers</span>
                                        </div>
                                        <button
                                          disabled={isPlanPersonalEstablecido || (config.turnosPersonalizados || []).length <= 1}
                                          title={(config.turnosPersonalizados || []).length <= 1 ? 'Debe quedar al menos un turno' : 'Quitar este turno'}
                                          onClick={() => setWorkstationConfigs(prev => ({
                                            ...prev,
                                            [p]: { ...config, turnosPersonalizados: (config.turnosPersonalizados || []).filter((_, i) => i !== tIdx) },
                                          }))}
                                          className="text-rose-400 hover:text-rose-600 disabled:opacity-20 disabled:cursor-not-allowed shrink-0"
                                        >
                                          <X className="w-3.5 h-3.5" />
                                        </button>
                                      </div>
                                    ))}
                                    <button
                                      disabled={isPlanPersonalEstablecido}
                                      onClick={() => setWorkstationConfigs(prev => ({
                                        ...prev,
                                        [p]: { ...config, turnosPersonalizados: [...(config.turnosPersonalizados || []), { horaInicio: '07:00', horaFin: '15:45', personas: 0 }] },
                                      }))}
                                      className="w-full text-[8px] font-black uppercase tracking-widest text-fuchsia-600 border border-dashed border-fuchsia-300 rounded-xl py-1.5 hover:bg-fuchsia-50 disabled:opacity-40 disabled:cursor-not-allowed"
                                    >
                                      + Turno
                                    </button>
                                  </div>
                                ) : (
                                <div className="flex gap-2">
                                  <button
                                    disabled={isPlanPersonalEstablecido}
                                    onClick={() => toggleWorkstationShift(p, 'day')}
                                    className={cn(
                                      "flex-1 h-11 rounded-xl flex flex-col items-center justify-center gap-0.5 transition-all shadow-sm border-2 disabled:opacity-50 disabled:cursor-not-allowed",
                                      config.isDayActive ? "bg-amber-500 text-white border-amber-600" : "bg-white text-slate-300 border-slate-100"
                                    )}
                                  >
                                    <Sun className="w-4 h-4" />
                                    <span className="text-[8px] font-black uppercase tracking-widest">Día</span>
                                  </button>
                                  <button
                                    disabled={isPlanPersonalEstablecido}
                                    onClick={() => toggleWorkstationShift(p, 'night')}
                                    className={cn(
                                      "flex-1 h-11 rounded-xl flex flex-col items-center justify-center gap-0.5 transition-all shadow-sm border-2 disabled:opacity-50 disabled:cursor-not-allowed",
                                      config.isNightActive ? "bg-indigo-700 text-white border-indigo-800" : "bg-white text-slate-300 border-slate-100"
                                    )}
                                  >
                                    <Moon className="w-4 h-4" />
                                    <span className="text-[8px] font-black uppercase tracking-widest">Noche</span>
                                  </button>
                                  {/* Sábado: solo se puede activar si la Jornada Fin de Semana está
                                      habilitada en Jornada Global — si no, no hay horas que sumar. */}
                                  <button
                                    disabled={isPlanPersonalEstablecido || horasNetasFinSemanaVal <= 0}
                                    title={horasNetasFinSemanaVal <= 0 ? 'Habilita la Jornada Fin de Semana en Jornada Global para activar el sábado' : undefined}
                                    onClick={() => toggleWorkstationShift(p, 'saturday')}
                                    className={cn(
                                      "flex-1 h-11 rounded-xl flex flex-col items-center justify-center gap-0.5 transition-all shadow-sm border-2 disabled:opacity-50 disabled:cursor-not-allowed",
                                      config.isSaturdayActive && horasNetasFinSemanaVal > 0 ? "bg-emerald-600 text-white border-emerald-700" : "bg-white text-slate-300 border-slate-100"
                                    )}
                                  >
                                    <CalendarIcon className="w-4 h-4" />
                                    <span className="text-[8px] font-black uppercase tracking-widest">Sábado</span>
                                  </button>
                                </div>
                                )}
                              </div>

                              {/* Capacidad neta con fórmula visible */}
                              <div className="flex flex-col items-center gap-1 px-3 py-2 bg-emerald-50 rounded-2xl border border-emerald-100">
                                <div className="flex items-center gap-1.5">
                                  <Clock className="w-3 h-3 text-emerald-600" />
                                  <span className="font-mono text-[11px] font-black text-emerald-700 tracking-wider">
                                    {capPuestoTotal.toFixed(2)} H Disponibles
                                  </span>
                                </div>
                                {tieneHorarioPersonalizado ? (
                                  <span className="text-[8px] text-emerald-500 font-black font-mono text-center leading-tight">
                                    {(config.turnosPersonalizados || [])
                                      .map(t => `${horasNetasTurnoPersonalizado(t.horaInicio, t.horaFin).toFixed(2)}h×${esPuestoPersonas ? (t.personas || 0) : (config.machines || 1)}${esPuestoPersonas ? 'pers' : 'máq'}`)
                                      .join(' + ')}
                                    {capacitacionHorasPuesto > 0 ? ` − ${esPuestoPersonas ? `${(config.capacitacionPersonas || 0)}×${(config.capacitacionHoras || 0).toFixed(1)}` : (config.capacitacionHoras || 0).toFixed(1)}h capac.` : ''}
                                    {config.disponibilidad !== undefined && config.disponibilidad < 1 ? ` × ${(config.disponibilidad * 100).toFixed(0)}% disp.` : ''}
                                    {mantenimientoHoras > 0 ? ` − ${mantenimientoHoras.toFixed(2)}h mant.` : ''}
                                  </span>
                                ) : (factorCapacidadPuestoPorTurno(p, config, 'dia') !== 1 || factorCapacidadPuestoPorTurno(p, config, 'noche') !== 1 || mantenimientoHoras > 0 || capacitacionHorasPuesto > 0 || (config.disponibilidad !== undefined && config.disponibilidad < 1)) && (
                                  <span className="text-[8px] text-emerald-500 font-black font-mono text-center leading-tight">
                                    {config.isDayActive && `${horasNetasDiurnasVal.toFixed(2)}h×${factorCapacidadPuestoPorTurno(p, config, 'dia')}${esPuestoPersonas ? 'pers' : 'máq'}(día)`}
                                    {config.isDayActive && (config.isNightActive || config.isSaturdayActive) ? ' + ' : ''}
                                    {config.isNightActive && `${horasNetasNocturnasVal.toFixed(2)}h×${factorCapacidadPuestoPorTurno(p, config, 'noche')}${esPuestoPersonas ? 'pers' : 'máq'}(noche)`}
                                    {config.isNightActive && config.isSaturdayActive ? ' + ' : ''}
                                    {config.isSaturdayActive && `${horasNetasFinSemanaVal.toFixed(2)}h×${factorCapacidadPuestoPorTurno(p, config, 'sabado')}${esPuestoPersonas ? 'pers' : 'máq'}(sábado)`}
                                    {capacitacionHorasPuesto > 0 ? ` − ${esPuestoPersonas ? `${(config.capacitacionPersonas || 0)}×${(config.capacitacionHoras || 0).toFixed(1)}` : (config.capacitacionHoras || 0).toFixed(1)}h capac.` : ''}
                                    {config.disponibilidad !== undefined && config.disponibilidad < 1 ? ` × ${(config.disponibilidad * 100).toFixed(0)}% disp.` : ''}
                                    {mantenimientoHoras > 0 ? ` − ${mantenimientoHoras.toFixed(2)}h mant.` : ''}
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
            <CardHeader className="bg-slate-50/50 p-8 border-b border-slate-200">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-4">
                  <div className="bg-indigo-600 p-3 rounded-2xl text-white shadow-lg shadow-indigo-500/20">
                    <Database className="w-6 h-6" />
                  </div>
                  <div>
                    <CardTitle className="text-2xl font-black text-slate-900 uppercase tracking-tight">KPI Maestro de Forros</CardTitle>
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
                    <thead className="bg-slate-50 text-slate-500 border-b border-slate-200 sticky top-0 z-10 text-left uppercase tracking-widest font-black">
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

        <TabsContent value="mantenimientos-preventivos" className="space-y-8 pb-20">
          <Card className="rounded-[2.5rem] bg-white ring-1 ring-slate-100 overflow-hidden shadow-sm border-none">
            <CardHeader className="bg-slate-50/50 p-8 border-b border-slate-200">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-4">
                  <div className="bg-indigo-600 p-3 rounded-2xl text-white shadow-lg shadow-indigo-500/20">
                    <Wrench className="w-6 h-6" />
                  </div>
                  <div>
                    <CardTitle className="text-2xl font-black text-slate-900 uppercase tracking-tight">Mantenimientos Preventivos Programados</CardTitle>
                    <CardDescription className="text-slate-400 font-bold uppercase text-[10px] tracking-widest mt-1">sp_Get_MantenimientosPreventivosAgendados — órdenes de mantenimiento agendadas por máquina</CardDescription>
                  </div>
                </div>
                <Button
                  onClick={fetchMantenimientos}
                  disabled={isLoadingMantenimientos}
                  className="bg-indigo-600 hover:bg-indigo-700 text-white font-black uppercase tracking-widest text-[10px] px-5 py-3 rounded-2xl shadow-lg flex items-center gap-2"
                >
                  {isLoadingMantenimientos ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Wrench className="w-3.5 h-3.5" />} Actualizar
                </Button>
              </div>
            </CardHeader>
            <CardContent className="p-0">
              <div className="overflow-auto max-h-[70vh] relative">
                {isLoadingMantenimientos ? (
                  <div className="flex items-center justify-center py-24">
                    <Loader2 className="w-10 h-10 animate-spin text-indigo-600" />
                  </div>
                ) : !hasFetchedMantenimientos ? (
                  <div className="py-20 text-center text-slate-400 uppercase font-black tracking-widest text-xs opacity-40">
                    Abre esta pestaña para consultar los mantenimientos preventivos agendados
                  </div>
                ) : mantenimientosForrosData.length === 0 ? (
                  <div className="py-20 text-center text-slate-400 uppercase font-black tracking-widest text-xs opacity-40">
                    Sin mantenimientos preventivos agendados para el área Forros
                  </div>
                ) : (
                  <table className="w-full text-[11px] border-collapse">
                    <thead className="bg-slate-50 text-slate-500 border-b border-slate-200 sticky top-0 z-10 text-left uppercase tracking-widest font-black">
                      <tr>
                        <th className="px-6 py-4">Área</th>
                        <th className="px-6 py-4">Máquina</th>
                        <th className="px-6 py-4">Línea / Proceso</th>
                        <th className="px-6 py-4">Puesto de Trabajo</th>
                        <th className="px-6 py-4 text-center">Centro</th>
                        <th className="px-6 py-4">Fecha Programada</th>
                        <th className="px-6 py-4">Inicio</th>
                        <th className="px-6 py-4">Fin</th>
                        <th className="px-6 py-4 text-right bg-indigo-950/20">Duración (min)</th>
                        <th className="px-6 py-4">Responsable</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {mantenimientosForrosData
                        .slice()
                        .sort((a, b) => new Date(a.FECHA_OT_PRG_INI || a.FECHA_PRO || 0).getTime() - new Date(b.FECHA_OT_PRG_INI || b.FECHA_PRO || 0).getTime())
                        .map((m, i) => (
                          <tr key={i} className="hover:bg-slate-50 transition-colors">
                            <td className="px-6 py-4 font-black text-slate-800 uppercase">{m.AREA || '—'}</td>
                            <td className="px-6 py-4 font-bold text-slate-700 uppercase whitespace-normal break-words min-w-[220px]">{m.MAQUINA || '—'}</td>
                            <td className="px-6 py-4 font-bold text-slate-600 uppercase whitespace-normal break-words min-w-[200px]">{m.LineaProceso || '—'}</td>
                            <td className="px-6 py-4 font-mono font-bold text-indigo-700">{m.PuestoTrabajo || '—'}</td>
                            <td className="px-6 py-4 text-center font-mono font-bold text-slate-600">{m.Centro || '—'}</td>
                            <td className="px-6 py-4 font-mono text-slate-600 whitespace-nowrap">
                              {m.FECHA_PRO ? new Date(m.FECHA_PRO).toLocaleDateString('es-EC') : '—'}
                            </td>
                            <td className="px-6 py-4 font-mono text-slate-600 whitespace-nowrap">
                              {m.FECHA_OT_PRG_INI ? new Date(m.FECHA_OT_PRG_INI).toLocaleString('es-EC', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' }) : '—'}
                            </td>
                            <td className="px-6 py-4 font-mono text-slate-600 whitespace-nowrap">
                              {m.FECHA_OT_PRG_FIN ? new Date(m.FECHA_OT_PRG_FIN).toLocaleString('es-EC', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' }) : '—'}
                            </td>
                            <td className="px-6 py-4 text-right font-mono font-black text-indigo-700 bg-indigo-50/30">
                              {Number(m.Duracion_Minutos || 0).toLocaleString()}
                            </td>
                            <td className="px-6 py-4 font-bold text-slate-600 whitespace-normal break-words min-w-[200px]">{m.NombRespControlProd || '—'}</td>
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
                <div className="bg-indigo-600 p-3 rounded-2xl text-white shadow-lg">
                  <Boxes className="w-6 h-6" />
                </div>
              </div>
            </CardHeader>
            <CardContent className="p-0">
              {gruposCoincidentes.length > 0 ? (
                <table className="w-full text-[11px] border-collapse">
                  <thead className="bg-slate-50 text-slate-500 border-b border-slate-200 sticky top-0 z-10 text-left uppercase tracking-widest font-black">
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
                            const value = toFechaEcuador(date);
                            setPlanGrupoFecha(value);
                            setIsPlanGrupoCalendarOpen(false);
                            fetchPlanGrupoDetalle(value);
                          }}
                          modifiers={{ conPlan: (date) => fechasConPlanRecuperable.has(toFechaEcuador(date)) }}
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
                      <thead className="bg-slate-50 text-slate-500 border-b border-slate-200 sticky top-0 z-10 text-left uppercase tracking-widest font-black">
                        <tr>
                          <th className="px-6 py-4 text-[10px]">Centro</th>
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
                            <td className="px-6 py-4 font-mono font-bold text-slate-600">{centroPorPlanGrupoP1.get(Number(item.codigo_plan_grupo)) ?? '—'}</td>
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

          <ResumenGrupoLineaTable rows={planGrupoDetalleFiltrada} centroPorPlanGrupo={centroPorPlanGrupoP1} />

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
                  disabled={isLoadingNivelExplosion || isLoadingNivel2 || isLoadingNivel3 || isLoadingNivel3Banda || autoChainStep > 0 || fertMaterialesColchones.length === 0}
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
                  <NivelResumenTable rows={nivel1ForroResumenPorTipo.chn} codigoLabel="Código Forro" tituloBar="FORRO CHN · Colchones" tituloBarBg="bg-sky-50 text-sky-700 border-b border-sky-200" />
                  <NivelResumenTable rows={nivel1ForroResumenPorTipo.base} codigoLabel="Código Forro" tituloBar="FORRO BASE · Bases" tituloBarBg="bg-emerald-800 text-white" />
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
                  <NivelResumenTable rows={nivel2TapaResumenPorTipo.chn} codigoLabel="Código Tapa" tituloBar="TAPA CHN · Colchones" tituloBarBg="bg-sky-50 text-sky-700 border-b border-sky-200" />
                  <NivelResumenTable rows={nivel2TapaResumenPorTipo.base} codigoLabel="Código Tapa" tituloBar="TAPA BASE · Bases" tituloBarBg="bg-emerald-800 text-white" />
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
                  <CardTitle className="text-2xl font-black text-slate-900 uppercase">Nivel 2 · Componentes BANDA</CardTitle>
                  <CardDescription className="text-slate-400 font-bold uppercase text-[10px] tracking-widest mt-1">
                    Explosión de cada FORRO del Nivel 1 (mismo dato que TAPA, otro filtro) — rama paralela que alimenta RMTBM/RMTB1-3
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
                  Este nivel se calcula automáticamente al presionar "Explosionar Componentes" en el Nivel 1
                </div>
              ) : nivel2BandaResumen.length > 0 ? (
                <div className="grid grid-cols-1 lg:grid-cols-2 divide-y lg:divide-y-0 lg:divide-x divide-slate-100">
                  <NivelResumenTable rows={nivel2BandaResumenPorTipo.chn} codigoLabel="Código Banda" tituloBar="BANDA CHN · Colchones" tituloBarBg="bg-sky-50 text-sky-700 border-b border-sky-200" />
                  <NivelResumenTable rows={nivel2BandaResumenPorTipo.base} codigoLabel="Código Banda" tituloBar="BANDA BASE · Bases" tituloBarBg="bg-emerald-800 text-white" />
                </div>
              ) : (
                <div className="py-20 text-center text-slate-400 uppercase font-black tracking-widest text-xs opacity-40">
                  No se encontraron componentes de Nivel 2 que coincidan con "BANDA"
                  {!componentesCapacidadEnsKeywordsNorm.includes('BANDA') && ' (falta agregar "BANDA" a la restricción COMPONENTES_CAPACIDAD_ENS)'}
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
                  <CardTitle className="text-2xl font-black text-slate-900 uppercase">Nivel 3 · Componentes BANDA EN METROS</CardTitle>
                  <CardDescription className="text-slate-400 font-bold uppercase text-[10px] tracking-widest mt-1">
                    Recorre la cadena BANDA del Nivel 2 (1 o más saltos, según el producto) hasta el componente registrado en ACOLCHADORA11/12 — mismo nivel lógico que ACOLCHADO
                  </CardDescription>
                </div>
              </div>
            </CardHeader>
            <CardContent className="p-0">
              {isLoadingNivel3Banda ? (
                <div className="py-20 text-center text-slate-400 uppercase font-black tracking-widest text-xs flex items-center justify-center gap-2">
                  <Loader2 className="w-4 h-4 animate-spin" /> Consultando maestro de materiales ({nivel3BandaProgress}%)...
                </div>
              ) : !hasFetchedNivel3Banda ? (
                <div className="py-20 text-center text-slate-400 uppercase font-black tracking-widest text-xs opacity-40">
                  Este nivel se calcula automáticamente al presionar "Explosionar Componentes" en el Nivel 1
                </div>
              ) : nivel3BandaMetrosResumen.length > 0 ? (
                <>
                  <div className="grid grid-cols-1 lg:grid-cols-2 divide-y lg:divide-y-0 lg:divide-x divide-slate-100">
                    <NivelResumenTable rows={nivel3BandaMetrosResumenPorTipo.chn} codigoLabel="Código Banda" tituloBar="BANDA EN METROS CHN · Colchones" tituloBarBg="bg-sky-50 text-sky-700 border-b border-sky-200" />
                    <NivelResumenTable rows={nivel3BandaMetrosResumenPorTipo.base} codigoLabel="Código Banda" tituloBar="BANDA EN METROS BASE · Bases" tituloBarBg="bg-emerald-800 text-white" />
                  </div>
                  {materialesBandaSinACH.length > 0 && (
                    <div className="mx-6 mb-6 rounded-2xl border border-amber-300 bg-amber-50/70 px-5 py-4">
                      <p className="text-[9px] font-black uppercase text-amber-700 tracking-widest mb-2 flex items-center gap-2">
                        <AlertTriangle className="w-3.5 h-3.5" /> {materialesBandaSinACH.length} material{materialesBandaSinACH.length !== 1 ? 'es' : ''} BANDA sin componente identificado en ACOLCHADORA11/12
                      </p>
                      {materialesBandaSinACH.map(m => (
                        <p key={m.material} className="text-[10px] font-mono text-amber-800">{m.material} — {m.nombre}</p>
                      ))}
                    </div>
                  )}
                </>
              ) : (
                <div className="py-20 text-center text-slate-400 uppercase font-black tracking-widest text-xs opacity-40">
                  No se encontró ningún componente BANDA registrado en ACOLCHADORA11/12
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
                    {/* La capacidad ya sumaba el sábado (`capacidadPuesto` incluye horasNetasFinSemanaVal
                        para cada puesto con isSaturdayActive), pero esta tarjeta solo mostraba Diurna y
                        Nocturna — sin este selector no había forma de ver ni cambiar la Jornada Fin de
                        Semana sin salir a Personal y Turnos, así que parecía que el sábado no se consideraba. */}
                    <div className="flex items-center gap-1.5">
                      <CalendarIcon className="w-3.5 h-3.5 text-emerald-500 shrink-0" />
                      <Select value={jornadaFinSemanaSel} onValueChange={setJornadaFinSemanaSel}>
                        <SelectTrigger className="h-8 w-[170px] text-[10px] font-black border-slate-200 rounded-lg">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {FIN_DE_SEMANA_OPTIONS.map(opt => <SelectItem key={opt.value} value={opt.value} className="font-black text-[11px] py-2">{opt.label}</SelectItem>)}
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
                      <thead className="bg-slate-50 text-slate-500 border-b border-slate-200 text-left uppercase tracking-widest font-black">
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
                      <div className="px-6 py-3 bg-slate-50 border-b border-slate-200 text-slate-700 font-black text-[10px] uppercase tracking-widest">
                        Horarios Elegidos (Personal &amp; Turnos)
                      </div>
                      <table className="w-full text-[11px] border-collapse">
                        <thead className="bg-slate-50 text-slate-500 border-b border-slate-200 text-left uppercase tracking-widest font-black">
                          <tr>
                            <th className="px-6 py-3 text-[10px]">Puesto</th>
                            <th className="px-6 py-3 text-[10px]">Turno Día</th>
                            <th className="px-6 py-3 text-[10px]">Turno Noche</th>
                            <th className="px-6 py-3 text-[10px] text-right">Máquinas</th>
                            <th className="px-6 py-3 text-[10px] text-right">Personas Día</th>
                            <th className="px-6 py-3 text-[10px] text-right">Personas Noche</th>
                            {horasNetasFinSemanaVal > 0 && <th className="px-6 py-3 text-[10px] text-right">Personas F/S</th>}
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
                              <td className="px-6 py-3 text-right font-mono font-bold text-slate-700">{p.cfg.peopleDay || 0}</td>
                              <td className="px-6 py-3 text-right font-mono font-bold text-slate-700">{p.cfg.peopleNight || 0}</td>
                              {horasNetasFinSemanaVal > 0 && (
                                <td className="px-6 py-3 text-right font-mono font-bold text-emerald-700">{p.cfg.isSaturdayActive ? (p.cfg.peopleWeekend || 0) : '—'}</td>
                              )}
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
                              <thead className="bg-slate-50 text-slate-500 border-b border-slate-200 text-left uppercase tracking-widest font-black">
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
                      <div className="px-6 py-3 bg-slate-50 border-b border-slate-200 text-slate-700 font-black text-[10px] uppercase tracking-widest flex items-center justify-between">
                        <span>Tapas Producibles (según Cuadre de Acolchado)</span>
                        <span className="text-slate-400 font-mono normal-case tracking-normal">
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
                                <thead className="bg-slate-50 text-slate-500 border-b border-slate-200 text-left uppercase tracking-widest font-black">
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
                  onClick={handleExplosionarNivel4}
                  disabled={isLoadingNivel4 || isLoadingNivel4Banda || (nivel3AcolchadoResumen.length === 0 && nivel3BandaMetrosResumen.length === 0)}
                  className="bg-indigo-600 hover:bg-indigo-700 text-white font-black uppercase tracking-widest text-[9px] px-5 py-2 rounded-xl disabled:opacity-40 flex items-center gap-2"
                >
                  {isLoadingNivel4 ? (
                    <><Loader2 className="w-3.5 h-3.5 animate-spin" /> Explosionando ACOLCHADO {nivel4Progress}%</>
                  ) : isLoadingNivel4Banda ? (
                    <><Loader2 className="w-3.5 h-3.5 animate-spin" /> Explosionando BANDA EN METROS...</>
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
                  Ya existe un plan del Paso 2 guardado en esta sesión. Puedes desactivarlo ahora (quedará en estado inactivo)
                  para empezar de cero, o volver a calcular y guardar más tarde — al presionar "Guardar Plan" de nuevo, si el
                  plan actual sigue activo se te pedirá confirmar su desactivación antes de crear el nuevo, para que nunca
                  queden dos planes iguales activos a la vez.
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

          <AlertDialog
            open={confirmGuardarPlanNivel4Open}
            onOpenChange={(open) => {
              if (!open && !isSavingPlanNivel4) {
                setConfirmGuardarPlanNivel4Open(false);
                setPlanesExistentesNivel4(null);
                setPendingGuardarNivel4Ctx(null);
              }
            }}
          >
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Ya existe un plan activo para esta fecha</AlertDialogTitle>
                <AlertDialogDescription asChild>
                  <div>
                    <p>
                      No puede haber dos planes activos iguales en la base. Ya existe un plan_grupo activo para:
                    </p>
                    <ul className="mt-2 mb-2 list-disc list-inside space-y-0.5">
                      {planesExistentesNivel4 && planesExistentesNivel4.n1.length > 0 && (
                        <li>P1.5 — Nivel 1 (Forro): {planesExistentesNivel4.n1.length} plan(es)</li>
                      )}
                      {planesExistentesNivel4 && planesExistentesNivel4.n2n3.length > 0 && (
                        <li>P1.5 — Nivel 2+3 (Tapa/Acolchado): {planesExistentesNivel4.n2n3.length} plan(es)</li>
                      )}
                      {planesExistentesNivel4 && planesExistentesNivel4.p2.length > 0 && (
                        <li>P2: {planesExistentesNivel4.p2.length} plan(es)</li>
                      )}
                    </ul>
                    <p>
                      ¿Deseas crear los planes nuevos y desactivar los existentes?
                    </p>
                  </div>
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel
                  disabled={isSavingPlanNivel4}
                  onClick={() => { setPlanesExistentesNivel4(null); setPendingGuardarNivel4Ctx(null); }}
                >
                  Cancelar
                </AlertDialogCancel>
                <AlertDialogAction
                  disabled={isSavingPlanNivel4}
                  onClick={(e) => { e.preventDefault(); handleConfirmarGuardarPlanNivel4(); }}
                >
                  {isSavingPlanNivel4 ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : 'Crear Nuevo y Desactivar Existente'}
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </TabsContent>

        <TabsContent value="recuperacion-p15-p3" className="space-y-8 pb-20">
          <Card className="rounded-[2.5rem] bg-white ring-1 ring-slate-100 overflow-hidden shadow-sm border-none">
            <CardHeader className="bg-slate-50/50 border-b border-slate-200 p-10">
              <div className="flex items-center justify-between flex-wrap gap-4">
                <div>
                  <CardTitle className="text-2xl font-black text-slate-900 uppercase">Recuperación Pasos P1 - P3</CardTitle>
                  <CardDescription className="text-slate-400 font-bold uppercase text-[10px] tracking-widest mt-1">
                    Consulta los planes tácticos guardados por Ensamblado (P1), paso intermedio de Forros (P1.5), plan final de Forros (P2) y Paso 3 (P3)
                  </CardDescription>
                </div>
                <div className="flex items-center gap-4">
                  <div className="flex items-center gap-2">
                    <span className="text-[9px] font-black text-slate-400 uppercase">Fecha del Plan (todos los pasos):</span>
                    <Popover open={isRecuperacionPasoCalendarOpen} onOpenChange={setIsRecuperacionPasoCalendarOpen}>
                      <PopoverTrigger asChild>
                        <button
                          type="button"
                          className="flex items-center gap-2 text-xs font-bold text-slate-700 bg-slate-50 border border-slate-200 rounded-lg px-3 py-1.5 focus:ring-indigo-500 outline-none"
                        >
                          <CalendarIcon className="w-3.5 h-3.5 text-slate-400" />
                          {recuperacionPasoFecha || 'Selecciona una fecha'}
                        </button>
                      </PopoverTrigger>
                      <PopoverContent className="w-auto p-0" align="end">
                        <DatePickerCalendar
                          mode="single"
                          selected={recuperacionPasoFecha ? new Date(`${recuperacionPasoFecha}T00:00:00`) : undefined}
                          onSelect={(date) => {
                            if (!date) return;
                            setRecuperacionPasoFecha(toFechaEcuador(date));
                            setIsRecuperacionPasoCalendarOpen(false);
                          }}
                          modifiers={{ conPlan: (date) => recuperacionPasoFechasConPlan.has(toFechaEcuador(date)) }}
                          modifiersClassNames={{ conPlan: 'font-black text-indigo-700 shadow-[inset_0_0_0_9999px_rgba(99,102,241,0.18)] rounded-md' }}
                        />
                        {recuperacionPasoFechasConPlan.size > 0 && (
                          <div className="flex items-center gap-2 px-4 pb-3 text-[9px] font-bold text-slate-400 uppercase tracking-wider">
                            <span className="inline-block w-3 h-3 rounded bg-indigo-200" /> Fecha con plan recuperable en algún paso
                          </div>
                        )}
                      </PopoverContent>
                    </Popover>
                  </div>
                  <div className="bg-indigo-600 p-3 rounded-2xl text-white shadow-lg">
                    <History className="w-6 h-6" />
                  </div>
                </div>
              </div>
            </CardHeader>
          </Card>

          <Tabs
            defaultValue="paso-p1"
            className="w-full"
            onValueChange={(tabValue) => {
              if (tabValue === 'materiales-balanceo' && materialesBalanceoData.length === 0) fetchMaterialesBalanceo();
            }}
          >
            <TabsList className="flex w-full h-auto bg-white border border-slate-200 p-2 rounded-[2rem] mb-8 shadow-sm overflow-x-auto justify-start">
              <TabsTrigger value="paso-p1" className="px-6 py-3 data-[state=active]:bg-indigo-600 data-[state=active]:text-white rounded-2xl transition-all text-[10px] font-black uppercase tracking-widest text-slate-500">
                <History className="w-4 h-4 mr-2" /> P1
              </TabsTrigger>
              <TabsTrigger value="paso-p1-5" className="px-6 py-3 data-[state=active]:bg-indigo-600 data-[state=active]:text-white rounded-2xl transition-all text-[10px] font-black uppercase tracking-widest text-slate-500">
                <History className="w-4 h-4 mr-2" /> P1.5
              </TabsTrigger>
              <TabsTrigger value="paso-p2" className="px-6 py-3 data-[state=active]:bg-indigo-600 data-[state=active]:text-white rounded-2xl transition-all text-[10px] font-black uppercase tracking-widest text-slate-500">
                <History className="w-4 h-4 mr-2" /> P2
              </TabsTrigger>
              <TabsTrigger value="paso-p3" className="px-6 py-3 data-[state=active]:bg-indigo-600 data-[state=active]:text-white rounded-2xl transition-all text-[10px] font-black uppercase tracking-widest text-slate-500">
                <History className="w-4 h-4 mr-2" /> P3
              </TabsTrigger>
              <TabsTrigger value="capacidad" className="px-6 py-3 data-[state=active]:bg-indigo-600 data-[state=active]:text-white rounded-2xl transition-all text-[10px] font-black uppercase tracking-widest text-slate-500">
                <BarChart3 className="w-4 h-4 mr-2" /> Capacidad
              </TabsTrigger>
              <TabsTrigger value="materiales-balanceo" className="px-6 py-3 data-[state=active]:bg-indigo-600 data-[state=active]:text-white rounded-2xl transition-all text-[10px] font-black uppercase tracking-widest text-slate-500">
                <Filter className="w-4 h-4 mr-2" /> Materiales Balanceo
              </TabsTrigger>
            </TabsList>

            <TabsContent value="paso-p1">
              <RecuperacionPasoPanel
                paso="P1"
                regex={PLAN_GRUPO_VALOR_REGEX_P1_O_PFF}
                gruposCoincidentes={gruposCoincidentes}
                addNotification={addNotification}
                materialNombrePorCodigo={materialNombrePorCodigo}
                normalizeMaterialCode={normalizeMaterialCode}
                agruparPorNivel={false}
                fecha={recuperacionPasoFecha}
                onFechasConPlan={(fechas) => setRecuperacionPasoFechasPorPaso(prev => ({ ...prev, P1: fechas }))}
              />
            </TabsContent>

            <TabsContent value="paso-p1-5">
              <RecuperacionPasoPanel
                paso="P1.5"
                regex={PLAN_GRUPO_VALOR_REGEX_P1_5_O_PFM}
                gruposCoincidentes={forrosGruposList}
                addNotification={addNotification}
                materialNombrePorCodigo={materialNombrePorCodigo}
                normalizeMaterialCode={normalizeMaterialCode}
                fecha={recuperacionFechasCalculadas ? [recuperacionFechasCalculadas.n1, recuperacionFechasCalculadas.n2n3] : []}
                onFechasConPlan={(fechas) => setRecuperacionPasoFechasPorPaso(prev => ({ ...prev, 'P1.5': fechas }))}
              />
            </TabsContent>

            <TabsContent value="paso-p2">
              <RecuperacionPasoPanel
                paso="P2"
                regex={PLAN_GRUPO_VALOR_REGEX_P2}
                gruposCoincidentes={forrosGruposList}
                addNotification={addNotification}
                materialNombrePorCodigo={materialNombrePorCodigo}
                normalizeMaterialCode={normalizeMaterialCode}
                agruparPorNivel={false}
                fecha={recuperacionFechasCalculadas?.p2 || ''}
                onFechasConPlan={(fechas) => setRecuperacionPasoFechasPorPaso(prev => ({ ...prev, P2: fechas }))}
              />
            </TabsContent>

            <TabsContent value="paso-p3">
              <RecuperacionPasoPanel
                paso="P3"
                regex={PLAN_GRUPO_VALOR_REGEX_P3}
                gruposCoincidentes={corteLaminadoGruposList}
                addNotification={addNotification}
                materialNombrePorCodigo={materialNombrePorCodigo}
                normalizeMaterialCode={normalizeMaterialCode}
                agruparPorNivel={false}
                filtrarPadreCodigoGrupo={2}
                fecha={recuperacionFechasCalculadas?.p3 || ''}
                onFechasConPlan={(fechas) => setRecuperacionPasoFechasPorPaso(prev => ({ ...prev, P3: fechas }))}
              />
            </TabsContent>

            <TabsContent value="capacidad">
              <CapacidadComparacionPanel
                forrosGruposList={forrosGruposList}
                corteLaminadoGruposList={corteLaminadoGruposList}
                gruposCoincidentes={gruposCoincidentes}
                addNotification={addNotification}
                materialNombrePorCodigo={materialNombrePorCodigo}
                normalizeMaterialCode={normalizeMaterialCode}
                materialesBalanceoData={materialesBalanceoData}
                fetchMaterialesBalanceo={fetchMaterialesBalanceo}
                fechaP1={recuperacionPasoFecha}
                fechaN1={recuperacionFechasCalculadas?.n1 || ''}
                fechaN2N3={recuperacionFechasCalculadas?.n2n3 || ''}
                fechaP2P3={recuperacionFechasCalculadas?.p2 || ''}
                onProcessChange={setSubPanelProcess}
              />
            </TabsContent>

            <TabsContent value="materiales-balanceo" className="space-y-8 pb-20">
              <Card className="rounded-[2.5rem] bg-white ring-1 ring-slate-100 overflow-hidden shadow-sm border-none">
                <CardHeader className="bg-slate-50/50 border-b border-slate-200 p-10">
                  <div className="flex items-center justify-between">
                    <div>
                      <CardTitle className="text-2xl font-black text-slate-900 uppercase">Materiales Balanceo</CardTitle>
                      <CardDescription className="text-slate-400 font-bold uppercase text-[10px] tracking-widest mt-1">
                        Maestro de porcentajes de balanceo por material, ordenado por Prioridad (mayor a menor) — materialesBalanceoService
                      </CardDescription>
                    </div>
                    <div className="flex items-center gap-3">
                      <Button
                        onClick={() => fetchMaterialesBalanceo()}
                        disabled={isLoadingMaterialesBalanceo}
                        className="bg-indigo-600 hover:bg-indigo-700 text-white font-black uppercase tracking-widest text-[9px] px-5 py-2 rounded-xl disabled:opacity-40"
                      >
                        {isLoadingMaterialesBalanceo ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : 'Recargar'}
                      </Button>
                      <div className="bg-indigo-600 p-3 rounded-2xl text-white shadow-lg">
                        <Filter className="w-6 h-6" />
                      </div>
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="p-0">
                  <div className="overflow-x-auto max-h-[70vh] relative">
                    {isLoadingMaterialesBalanceo && materialesBalanceoData.length === 0 ? (
                      <div className="flex flex-col items-center justify-center py-32 space-y-4">
                        <Loader2 className="w-10 h-10 animate-spin text-indigo-600" />
                        <span className="text-slate-500 font-black uppercase tracking-widest text-xs">Cargando materiales de balanceo...</span>
                      </div>
                    ) : materialesBalanceoData.length > 0 ? (
                      <table className="w-full text-[11px] border-collapse">
                        <thead className="bg-slate-50 text-slate-500 border-b border-slate-200 sticky top-0 z-10 text-left uppercase tracking-widest font-black">
                          <tr>
                            <th className="px-6 py-4 text-[10px]">Código Balanceo</th>
                            <th className="px-6 py-4 text-[10px]">Material</th>
                            <th className="px-6 py-4 text-[10px]">Nombre Material</th>
                            <th className="px-6 py-4 text-[10px] text-right">% Mínimo</th>
                            <th className="px-6 py-4 text-[10px] text-right">% Máximo</th>
                            <th className="px-6 py-4 text-[10px] text-right">Prioridad</th>
                            <th className="px-6 py-4 text-[10px] text-center">Estado</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                          {materialesBalanceoData.map((row) => (
                            <tr key={row.codigo_material_balanceo} className="hover:bg-slate-50 transition-colors text-[10px]">
                              <td className="px-6 py-4 font-mono font-bold text-slate-600">{row.codigo_material_balanceo}</td>
                              <td className="px-6 py-4 font-mono font-bold text-indigo-700">{row.codigo_material}</td>
                              <td className="px-6 py-4 font-bold text-slate-700 uppercase">
                                {materialNombrePorCodigo.get(normalizeMaterialCode(row.codigo_material)) || '—'}
                              </td>
                              <td className="px-6 py-4 text-right font-mono font-black text-slate-800">{Number(row.porc_minimo_balanceo || 0).toLocaleString()}</td>
                              <td className="px-6 py-4 text-right font-mono font-black text-slate-800">{Number(row.porc_maximo_balanceo || 0).toLocaleString()}</td>
                              <td className="px-6 py-4 text-right font-mono font-bold text-slate-600">{row.prioridad}</td>
                              <td className="px-6 py-4 text-center">
                                <Badge className={cn(
                                  'font-black text-[9px] px-2 py-0.5 rounded-md border-none',
                                  row.estado === 'A' ? 'bg-green-100 text-green-700' : 'bg-slate-100 text-slate-600'
                                )}>
                                  {row.estado || '—'}
                                </Badge>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    ) : (
                      <div className="py-20 text-center text-slate-400 uppercase font-black tracking-widest text-xs opacity-40">
                        Sin materiales de balanceo registrados
                      </div>
                    )}
                  </div>
                </CardContent>
              </Card>
            </TabsContent>
          </Tabs>
        </TabsContent>
      </Tabs>

      {activeProcess && (
        <div className="fixed inset-0 z-[200] bg-slate-950/70 backdrop-blur-sm flex items-center justify-center p-6">
          <div className="bg-white rounded-[2rem] shadow-2xl p-10 w-full max-w-md text-center space-y-5">
            <Loader2 className="w-12 h-12 animate-spin text-indigo-600 mx-auto" />
            <div>
              <p className="text-slate-900 font-black uppercase tracking-widest text-sm">{activeProcess.label}</p>
              <p className="text-slate-400 font-bold uppercase text-[10px] tracking-widest mt-1">No cierres ni cambies de pestaña mientras se procesa</p>
            </div>
            {activeProcess.progress !== null && (
              <div className="space-y-2">
                <Progress value={activeProcess.progress} className="h-2.5 bg-slate-100 [&>div]:bg-indigo-600" />
                <p className="text-indigo-700 font-mono font-black text-lg">{activeProcess.progress}%</p>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};
