'use client';

import React, { useState, useEffect, useMemo } from 'react';
import * as XLSX from 'xlsx';
import { serviciosService } from '@/services/servicios.service';
import { planGrupoService } from '@/services/plangrupo.service';
import { detalleTacticoService } from '@/services/detalletactico.service';
import { ecuadorHolidaysService } from '@/services/ecuador-holidays.service';
import { useAppContext } from '@/context/AppProvider';
import { Layers, Loader2, PlayCircle, LayoutGrid, PackageSearch, Clock, Gauge, Sun, Moon, RefreshCw, Stethoscope, Plus, X, CheckSquare, FileSpreadsheet, Save, TriangleAlert, MinusCircle, PlusCircle, Lightbulb, RotateCcw, CheckCircle2, Circle } from 'lucide-react';
import { Table, TableHeader, TableBody, TableFooter, TableRow, TableHead, TableCell } from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { Checkbox } from '@/components/ui/checkbox';
import { AlertDialog, AlertDialogContent, AlertDialogHeader, AlertDialogTitle, AlertDialogDescription, AlertDialogFooter, AlertDialogAction } from '@/components/ui/alert-dialog';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Progress } from '@/components/ui/progress';
import { cn } from '@/lib/utils';
import type { Restriccion, Grupo, PlanGrupo, DetalleTactico } from '@/types/interfaces';

const normalizeMaterialCode = (code: string | number): string => {
    const codeStr = String(code).trim();
    return codeStr.slice(-8);
};

// 5 Mesas de Pegado físicas, sobre las que se distribuye equitativamente la producción
const WORK_STATIONS_PM = Array.from({ length: 5 }, (_, i) => ({
    id: i + 1,
    name: `MESA DE PEGADO ${i + 1}`,
}));

// Personas asumidas por mesa, usado para prorratear las horas de una cita médica entre las mesas
// activas del turno correspondiente
const PERSONAS_POR_MESA = 2;

type TurnoId = 'dia' | 'noche';

// Turno Día (inicia 07:00) y Turno Noche (inicia 21:00): dos turnos simultáneos e independientes,
// cada uno con su propia selección de mesas y duración. La mayoría de los días solo se usa el Turno Día.
const TURNOS_PM: { id: TurnoId; label: string; startTime: string; icon: typeof Sun }[] = [
    { id: 'dia', label: 'Turno Día', startTime: '07:00', icon: Sun },
    { id: 'noche', label: 'Turno Noche', startTime: '21:00', icon: Moon },
];

interface ShiftDurationOptionPM {
    id: string;
    label: string;
    hours: number; // Horas usadas en TODOS los cálculos de capacidad
    startTime?: string; // Solo Noche: la hora de inicio cambia según la duración elegida (Día siempre inicia a turno.startTime)
    displayHours?: number; // Solo Noche: horas de reloj reales (hours + 1h de receso) para pintar la hora de salida
}

// Turno Día: duraciones de jornada posibles, siempre inicia a las 07:00 (la de 11.7h es para demanda
// alta / sobretiempo)
const SHIFT_DURATIONS_PM_DIA: ShiftDurationOptionPM[] = [
    { id: '8.7h', label: '8.7 horas / 07:00 a 15:45', hours: 8.7 },
    { id: '9.7h', label: '9.7 horas / 07:00 a 17:00', hours: 9.7 },
    { id: '10.7h', label: '10.7 horas / 07:00 a 18:00', hours: 10.7 },
    { id: '11.7h', label: '11.7 horas / 07:00 a 19:00 (Demanda Alta)', hours: 11.7 },
];

// Turno Noche: a diferencia del Turno Día, la HORA DE INICIO cambia según la duración elegida (las 3
// opciones terminan siempre a las 05:30 del día siguiente). "hours" (el valor usado en el cálculo de
// capacidad) descuenta 1h de receso frente a las horas de reloj reales transcurridas ("displayHours").
const SHIFT_DURATIONS_PM_NOCHE: ShiftDurationOptionPM[] = [
    { id: 'noche_8h', label: '8 horas / 21:00 a 05:30', startTime: '21:00', hours: 7.5, displayHours: 8.5 },
    { id: 'noche_9h', label: '9 horas / 20:00 a 05:30', startTime: '20:00', hours: 8.5, displayHours: 9.5 },
    { id: 'noche_10h', label: '10 horas / 19:00 a 05:30', startTime: '19:00', hours: 9.5, displayHours: 10.5 },
];

// Devuelve las duraciones de jornada válidas para un turno — Día y Noche tienen listas independientes.
const getShiftDurationsPara = (turnoId: TurnoId): ShiftDurationOptionPM[] =>
    turnoId === 'noche' ? SHIFT_DURATIONS_PM_NOCHE : SHIFT_DURATIONS_PM_DIA;

// Rango de utilización de capacidad considerado eficiente (ni mucho déficit ni mucho desperdicio). Fuera
// de este rango se evalúa la Propuesta de Ajuste de Capacidad (turno o mesas).
const UTILIZACION_EFICIENTE_MIN = 85;
const UTILIZACION_EFICIENTE_MAX = 105;

// Suma horas a una hora "HH:MM" y devuelve la hora final, dando la vuelta al día siguiente si aplica (turno noche)
const addHoursToTime = (startTime: string, hours: number): string => {
    const [h, m] = startTime.split(':').map(Number);
    const totalMinutes = Math.round((h * 60 + m + hours * 60) % (24 * 60));
    const endH = Math.floor(totalMinutes / 60);
    const endM = totalMinutes % 60;
    return `${String(endH).padStart(2, '0')}:${String(endM).padStart(2, '0')}`;
};

// Centro de fabricación de Planchas Mixtas para la Planificación (Quito)
const CENTRO_PLANIFICACION_PM = '1000';

// Una fila por cada fuente de datos que fetchAllData descarga en secuencia, para la ventana de progreso
// de "Actualizar Datos" (mismo patrón que "Planificación Táctica Muebles")
interface LoadStage {
    key: string;
    label: string;
    current: number;
    total: number;
    status: 'pending' | 'loading' | 'done';
}

const LOAD_STAGE_DEFS: Array<Pick<LoadStage, 'key' | 'label'>> = [
    { key: 'previsionales', label: 'Órdenes Previsionales' },
    { key: 'fert', label: 'Órdenes Fert' },
    { key: 'tiempos', label: 'Tiempos de Ensamblado' },
    { key: 'inventario', label: 'Inventario' },
];

// Plancha Mixta Equivalente: unidad de medida estándar del área (1 equivalente = 5.38 minutos de fabricación)
const MINUTOS_POR_PLANCHA_EQUIVALENTE = 5.38;

// Fecha "hoy + offsetDays" (días CALENDARIO corridos) en formato "YYYY-MM-DD". Solo debe usarse con
// offsetDays = 0 (hoy); para "mañana"/"pasado mañana" usar getBusinessDateKeyOffset en su lugar, ya que
// esos sí deben saltar sábado y domingo (mismo criterio que "Planificación Táctica Muebles").
const getDateKeyOffset = (offsetDays: number): string => {
    const d = new Date();
    d.setDate(d.getDate() + offsetDays);
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${y}-${m}-${day}`;
};

const toDateKey = (date: Date): string => {
    const y = date.getFullYear();
    const m = String(date.getMonth() + 1).padStart(2, '0');
    const d = String(date.getDate()).padStart(2, '0');
    return `${y}-${m}-${d}`;
};

// Suma N días laborables (omite sábado, domingo y feriados de Ecuador) a una fecha — mismo criterio que
// "Planificación Táctica Muebles" (ver addBusinessDays/holidaysMap en ProvisionalOrdersAlphaTab.tsx)
const addBusinessDays = (date: Date, days: number, holidaysSet: Set<string>): Date => {
    const result = new Date(date);
    let remaining = days;
    while (remaining > 0) {
        result.setDate(result.getDate() + 1);
        const dayOfWeek = result.getDay();
        const isHoliday = holidaysSet.has(toDateKey(result));
        if (dayOfWeek !== 0 && dayOfWeek !== 6 && !isHoliday) {
            remaining--;
        }
    }
    return result;
};

// Fecha "hoy + businessDays días LABORABLES" (omite sábado, domingo y feriados) en formato "YYYY-MM-DD".
// Es lo que realmente significa "mañana"/"pasado mañana" para este módulo: si hoy es viernes y el lunes
// siguiente es feriado, "mañana" (+1 día laborable) es el martes, no el lunes.
const getBusinessDateKeyOffset = (businessDays: number, holidaysSet: Set<string>): string => {
    const d = addBusinessDays(new Date(), businessDays, holidaysSet);
    return toDateKey(d);
};

interface PMOrder {
    id: string;
    source: 'Previsional' | 'Fert';
    tipo: 'MTO' | 'MTS';
    material: string;
    nombre: string;
    cantidad: number;
    tiempoUnitMin: number;
    horas: number;
    fecha: string;
}

// Un "slot" de capacidad es una combinación Turno + Mesa habilitada, con su propia capacidad de horas
interface PMSlot {
    turno: TurnoId;
    stationId: number;
    capacityHours: number;
}

interface PMStationEntry extends PMSlot {
    usedHours: number;
    items: PMOrder[];
}

// Semielaborado (Lámina de Espuma RESPCTRLPROD '013' o Lámina Prensada '017') requerido, desde la Explosión
// de Materiales, con el mismo kardex de "Planificación Táctica Muebles": Stock Actual - Consumo de Órdenes
// Pasadas Pendientes + Producción Propia Pendiente = Disponible Real; Cantidad Neta Requerida = max(0,
// Necesario - Disponible Real)
interface PMComponentNeed {
    componente: string;
    descripcion: string;
    unidad: string;
    totalNecesario: number;
    stockActual: number | null;
    consumoOrdenesPasadas: number;
    produccionPropiaPendiente: number;
    disponibleReal: number | null;
    cantidadNetaAConseguir: number;
}

// Cita médica de una persona: sus horas de ausencia afectan a toda la mesa/turno, prorrateadas entre
// las mesas activas de ESE turno
interface MedicalAppointment {
    id: string;
    nombre: string;
    horas: number;
    turno: TurnoId;
}

// Descuento de capacidad por un motivo general (ej. reunión de personal): a diferencia de la cita médica,
// las horas NO se prorratean — se descuentan completas de CADA mesa activa del turno seleccionado
interface CapacityDiscount {
    id: string;
    razon: string;
    horas: number;
    turno: TurnoId;
}

// Opción de la Propuesta de Ajuste de Capacidad: cambiar la jornada (prioridad) o la cantidad de mesas
// activas (segunda opción) de un turno, con la utilización de capacidad resultante
interface CapacityProposalOption {
    id: string;
    turno: TurnoId;
    tipo: 'turno' | 'mesas';
    nuevaDuracionId?: string;
    nuevasMesas?: number;
    descripcion: string;
    capacidadResultante: number;
    utilizacionPct: number;
}

const slotKey = (turno: TurnoId, stationId: number) => `${turno}-${stationId}`;

interface ProvisionalOrdersPlanchasMixtasTabProps {
    restricciones: Restriccion[];
}

export const ProvisionalOrdersPlanchasMixtasTab: React.FC<ProvisionalOrdersPlanchasMixtasTabProps> = ({ restricciones }) => {
    const { addNotification } = useAppContext();

    // Responsables de Control de Producción que identifican Planchas Mixtas (semielaborado de colchones),
    // tomados de la restricción "RespCtrlProd" del Grupo Prensado (ej. "015&016"), igual que en Muebles
    const validRespCodes = useMemo(() => {
        const respRestriccion = restricciones.find(r => r.nombre_restriccion === 'RespCtrlProd');
        if (!respRestriccion || !respRestriccion.valor_restriccion) return [];

        return respRestriccion.valor_restriccion
            .split(/[&,]/)
            .map(code => String(code).trim())
            .filter(Boolean);
    }, [restricciones]);

    // Grupo Prensado (codigo_grupo=9), tomado del "grupo" anidado en cualquiera de las restricciones
    // recibidas — igual patrón que "mueblesGrupo" en Planificación Táctica Muebles
    const prensadoGrupo = useMemo<Grupo | undefined>(() => {
        const conGrupo = restricciones as (Restriccion & { grupo?: Grupo })[];
        return conGrupo.find(r => r.grupo)?.grupo;
    }, [restricciones]);

    const [allPrevisionalRaw, setAllPrevisionalRaw] = useState<any[]>([]);
    const [allFertRaw, setAllFertRaw] = useState<any[]>([]);
    const [globalTiemposMap, setGlobalTiemposMap] = useState<Map<string, number>>(new Map());
    const [materialRespCtrlProdMap, setMaterialRespCtrlProdMap] = useState<Map<string, string>>(new Map());
    // Stock Actual (bruto) por Material, sumado a través de todos los Centros, usado para el kardex de la
    // Explosión de Materiales (mismo criterio que "Planificación Táctica Muebles")
    const [materialStockActualMap, setMaterialStockActualMap] = useState<Map<string, number>>(new Map());
    const [isLoading, setIsLoading] = useState(false);
    const [downloadProgress, setDownloadProgress] = useState({ current: 0, total: 0 });
    // Estado de la ventana de progreso de "Actualizar Datos": una fila por cada fuente que fetchAllData
    // descarga en secuencia, para mostrar en tiempo real cuál está en curso y su avance.
    const [loadStages, setLoadStages] = useState<LoadStage[]>(() => LOAD_STAGE_DEFS.map(d => ({ ...d, current: 0, total: 0, status: 'pending' as const })));

    // Configuración de los dos turnos: habilitado, duración de jornada y mesas asignadas a cada uno.
    // Por defecto solo el Turno Día está habilitado (con las 5 mesas), ya que es lo usual.
    const [turnoEnabled, setTurnoEnabled] = useState<Record<TurnoId, boolean>>({ dia: true, noche: false });
    const [turnoDuration, setTurnoDuration] = useState<Record<TurnoId, string>>({ dia: SHIFT_DURATIONS_PM_DIA[0].id, noche: SHIFT_DURATIONS_PM_NOCHE[0].id });
    const [turnoStations, setTurnoStations] = useState<Record<TurnoId, Set<number>>>({
        dia: new Set(WORK_STATIONS_PM.map(s => s.id)),
        noche: new Set(),
    });

    const toggleTurnoStation = (turno: TurnoId, stationId: number) => {
        setTurnoStations(prev => {
            const next = new Set(prev[turno]);
            if (next.has(stationId)) next.delete(stationId);
            else next.add(stationId);
            return { ...prev, [turno]: next };
        });
    };

    // "Adicionar al Cálculo": efecto contrario al Descuento de Capacidad — en vez de horario/jornada, se
    // escoge directamente la cantidad de horas a sumar por cada mesa marcada (ej. mesas que se quedan
    // haciendo sobretiempo, o personal de otra área que se suma ese día). No tiene turno asociado: es un
    // bloque de horas adicional que se suma tal cual a la capacidad total disponible.
    const [adicionalEnabled, setAdicionalEnabled] = useState(false);
    const [adicionalHoras, setAdicionalHoras] = useState('');
    const [adicionalStations, setAdicionalStations] = useState<Set<number>>(new Set());

    const toggleAdicionalStation = (stationId: number) => {
        setAdicionalStations(prev => {
            const next = new Set(prev);
            if (next.has(stationId)) next.delete(stationId);
            else next.add(stationId);
            return next;
        });
    };

    // Citas médicas registradas (nombre, horas, turno). Cada una descuenta horas/mesas-del-turno del
    // total de capacidad disponible de ese turno.
    const [medicalAppointments, setMedicalAppointments] = useState<MedicalAppointment[]>([]);
    const [showMedicalForm, setShowMedicalForm] = useState(false);
    const [medicalNombre, setMedicalNombre] = useState('');
    const [medicalHoras, setMedicalHoras] = useState('');
    const [medicalTurno, setMedicalTurno] = useState<TurnoId>('dia');

    // Descuentos de capacidad registrados (razón, horas, turno). Cada uno descuenta horas COMPLETAS (sin
    // prorratear) de CADA mesa activa del turno seleccionado.
    const [capacityDiscounts, setCapacityDiscounts] = useState<CapacityDiscount[]>([]);
    const [showDiscountForm, setShowDiscountForm] = useState(false);
    const [discountRazon, setDiscountRazon] = useState('');
    const [discountHoras, setDiscountHoras] = useState('');
    const [discountTurno, setDiscountTurno] = useState<TurnoId>('dia');

    // Propuesta de relleno de capacidad: órdenes previsionales de días posteriores que el usuario puede
    // aceptar (por defecto todas) o desmarcar individualmente para excluirlas
    const [rejectedFillIds, setRejectedFillIds] = useState<Set<string>>(new Set());

    const [hasPlanned, setHasPlanned] = useState(false);
    const [pmDistribution, setPmDistribution] = useState<Map<string, PMStationEntry> | null>(null);
    const [isExplodingMaterials, setIsExplodingMaterials] = useState(false);
    const [laminaEspumaResults, setLaminaEspumaResults] = useState<PMComponentNeed[]>([]);
    const [laminaPrensadaResults, setLaminaPrensadaResults] = useState<PMComponentNeed[]>([]);
    // Se activa cuando se actualizan los datos de SAP después de una planificación previa, para distinguir
    // el recálculo ajustado ("Paso 2") de la primera ejecución de la planificación.
    const [isRecalculatingPlan, setIsRecalculatingPlan] = useState(false);

    // Estado para el guardado del Plan Táctico (PlanGrupo) y sus Detalles (DetalleTactico)
    const [isSavingPlan, setIsSavingPlan] = useState(false);

    // Verificación de Plan Táctico ya guardado para el día de hoy, al presionar "EJECUTAR PLANIFICACIÓN"
    const [planCheckModal, setPlanCheckModal] = useState<
        | { type: 'not-found' }
        | { type: 'found'; planesGrupo: PlanGrupo[] }
        | { type: 'vista'; planesGrupo: PlanGrupo[]; detalles: DetalleTactico[] }
        | null
    >(null);
    const [isPlanCheckBusy, setIsPlanCheckBusy] = useState(false);

    // Confirmación antes de reiniciar toda la configuración y el progreso de la planificación en curso
    const [showNuevaPlanificacionConfirm, setShowNuevaPlanificacionConfirm] = useState(false);

    const updateLoadStage = (key: string, patch: Partial<LoadStage>) => {
        setLoadStages(prev => prev.map(s => (s.key === key ? { ...s, ...patch } : s)));
    };

    const fetchAllData = async () => {
        setIsLoading(true);
        setDownloadProgress({ current: 0, total: 0 });
        setLoadStages(LOAD_STAGE_DEFS.map(d => ({ ...d, current: 0, total: 0, status: 'pending' as const })));
        try {
            // Órdenes Previsionales (todo el dataset; se filtra por RESPCONTROLPROD según "validRespCodes" en el cliente)
            updateLoadStage('previsionales', { status: 'loading' });
            const provExplore = await serviciosService.getOrdenesProvisionalesAlphaPaginados(1, 1);
            const totalProv = provExplore.totalRegistros || 0;
            updateLoadStage('previsionales', { total: totalProv });
            let combinedProv: any[] = [];
            if (totalProv > 0) {
                const BATCH = 20000;
                const pages = Math.ceil(totalProv / BATCH);
                for (let i = 1; i <= pages; i++) {
                    const res = await serviciosService.getOrdenesProvisionalesAlphaPaginados(i, BATCH);
                    if (res.data) {
                        combinedProv = combinedProv.concat(Array.isArray(res.data) ? res.data : [res.data]);
                        setDownloadProgress({ current: combinedProv.length, total: totalProv });
                        updateLoadStage('previsionales', { current: combinedProv.length });
                    }
                }
            }
            setAllPrevisionalRaw(combinedProv);
            updateLoadStage('previsionales', { status: 'done', current: totalProv });

            // Órdenes Fert (todo el dataset; se filtra por RESPCTRLPROD según "validRespCodes" en el cliente). Necesarias
            // porque algunas órdenes de Planchas Mixtas se liberan con fecha de mañana por el horizonte
            // de planificación, y deben tomarse en cuenta igual que las Previsionales.
            updateLoadStage('fert', { status: 'loading' });
            const fertExplore = await serviciosService.getOrdenesFert(1, 1);
            const totalFert = fertExplore.totalRegistros || 0;
            updateLoadStage('fert', { total: totalFert });
            let combinedFert: any[] = [];
            if (totalFert > 0) {
                const BATCH = 20000;
                const pages = Math.ceil(totalFert / BATCH);
                for (let i = 1; i <= pages; i++) {
                    const res = await serviciosService.getOrdenesFert(i, BATCH);
                    if (res.data) {
                        combinedFert = combinedFert.concat(Array.isArray(res.data) ? res.data : [res.data]);
                        updateLoadStage('fert', { current: combinedFert.length });
                    }
                }
            }
            setAllFertRaw(combinedFert);
            updateLoadStage('fert', { status: 'done', current: totalFert });

            // Tiempos de Ensamblado (global), usados para calcular horas requeridas por material
            updateLoadStage('tiempos', { status: 'loading' });
            const tiemposExplore = await serviciosService.getTiemposEnsamblado(1, 1);
            const totalTiempos = tiemposExplore.totalRegistros || 0;
            updateLoadStage('tiempos', { total: totalTiempos });
            if (totalTiempos > 0) {
                const BATCH = 20000;
                const pages = Math.ceil(totalTiempos / BATCH);
                const tMap = new Map<string, number>();
                let processedTiempos = 0;
                for (let i = 1; i <= pages; i++) {
                    const res = await serviciosService.getTiemposEnsamblado(i, BATCH);
                    if (res.data) {
                        const items = Array.isArray(res.data) ? res.data : [res.data];
                        items.forEach((item: any) => {
                            const material = normalizeMaterialCode(item.CodMaterial || item.Material || '');
                            const tiempo = Number(item.Tiempo_Min ?? item.Tiempo ?? 0);
                            if (material && tiempo > 0 && !tMap.has(material)) {
                                tMap.set(material, tiempo);
                            }
                        });
                        processedTiempos += items.length;
                        updateLoadStage('tiempos', { current: processedTiempos });
                    }
                }
                setGlobalTiemposMap(tMap);
            }
            updateLoadStage('tiempos', { status: 'done', current: totalTiempos });

            // Cubo de Inventarios: RespCtrlProd de cada componente (Explosión de Materiales: Láminas de
            // Espuma '013' / Láminas Prensadas '017') y Stock Actual (bruto, sumado por Material a través
            // de todos los Centros — mismo campo/criterio que usa el kardex de Muebles) para el kardex
            updateLoadStage('inventario', { status: 'loading' });
            const invExplore = await serviciosService.getCuboInventarios(1, 1);
            const totalInv = invExplore.totalRegistros || 0;
            updateLoadStage('inventario', { total: totalInv });
            if (totalInv > 0) {
                const BATCH = 20000;
                const pages = Math.ceil(totalInv / BATCH);
                const respMap = new Map<string, string>();
                const stockMap = new Map<string, number>();
                let processedInv = 0;
                for (let i = 1; i <= pages; i++) {
                    const res = await serviciosService.getCuboInventarios(i, BATCH);
                    if (res.data) {
                        const items = Array.isArray(res.data) ? res.data : [res.data];
                        items.forEach((item: any) => {
                            const material = normalizeMaterialCode(item.Material || '');
                            const resp = String(item.RespCtrlProd || '').trim();
                            if (resp && !respMap.has(material)) {
                                respMap.set(material, resp);
                            }
                            const actual = Number(item.StockActual) || 0;
                            stockMap.set(material, (stockMap.get(material) || 0) + actual);
                        });
                        processedInv += items.length;
                        updateLoadStage('inventario', { current: processedInv });
                    }
                }
                setMaterialRespCtrlProdMap(respMap);
                setMaterialStockActualMap(stockMap);
            }
            updateLoadStage('inventario', { status: 'done', current: totalInv });

            addNotification('success', 'Datos de Planchas Mixtas cargados correctamente.');
        } catch (error) {
            addNotification('error', `Error al cargar datos de Planchas Mixtas: ${(error as Error).message}`);
        } finally {
            setIsLoading(false);
        }
    };

    useEffect(() => {
        fetchAllData();
    }, []);

    // Feriados de Ecuador para el cálculo de "mañana"/"pasado mañana" (getBusinessDateKeyOffset): sin esto,
    // esas fechas solo saltaban fines de semana y podían caer en un feriado (ej. 10/8, Independencia de
    // Guayaquil), haciendo que no se encuentren las órdenes que en SAP sí están fechadas para el siguiente
    // día realmente laborable.
    const [holidaysSet, setHolidaysSet] = useState<Set<string>>(new Set());
    useEffect(() => {
        const fetchHolidays = async () => {
            try {
                const start = new Date();
                const end = new Date(start);
                end.setDate(end.getDate() + 14);
                const holidays = await ecuadorHolidaysService.getHolidaysForRange(start, end);
                setHolidaysSet(new Set(holidays.map(h => h.date)));
            } catch (error) {
                console.error('Error al cargar feriados para Planchas Mixtas:', error);
            }
        };
        fetchHolidays();
    }, []);

    // Progreso general de la ventana de estado de "Actualizar Datos": promedio simple del avance de
    // cada una de las 4 etapas (cada una pesa lo mismo, sin importar cuántos registros tenga)
    const overallLoadPercent = useMemo(() => {
        if (loadStages.length === 0) return 0;
        const sum = loadStages.reduce((acc, s) => {
            if (s.status === 'done') return acc + 100;
            if (s.status === 'loading' && s.total > 0) return acc + Math.min(100, (s.current / s.total) * 100);
            return acc;
        }, 0);
        return Math.round(sum / loadStages.length);
    }, [loadStages]);

    // Vuelve a descargar las órdenes previsionales/Fert (y tiempos/inventario) desde SAP, y descarta los
    // resultados ya calculados para que se recalculen con la información fresca. Si ya existía una
    // planificación previa, esta actualización se marca como recálculo ajustado (Paso 2).
    const handleRefreshData = async () => {
        const eraRecalculo = hasPlanned;
        await fetchAllData();
        setHasPlanned(false);
        setPmDistribution(null);
        setLaminaEspumaResults([]);
        setLaminaPrensadaResults([]);
        setRejectedFillIds(new Set());
        setSelectedProposalId(null);
        setIsRecalculatingPlan(eraRecalculo);
        addNotification('info', eraRecalculo
            ? 'Datos actualizados desde SAP. Presione "PASO 2: RECALCULAR PLANIFICACIÓN AJUSTADA" para recalcular con la información más reciente.'
            : 'Datos actualizados desde SAP. Vuelva a presionar "EJECUTAR PLANIFICACIÓN" para recalcular.');
    };

    // Reinicia toda la configuración y el progreso de la planificación en curso (turnos, mesas, citas
    // médicas, descuentos de capacidad, planificación calculada, distribución y explosión de materiales)
    // para empezar una nueva desde cero. Los datos ya descargados de SAP NO se vuelven a descargar — para
    // eso está "Actualizar Datos". Mismo patrón que "Planificación Nueva" en Planificación Táctica Muebles.
    const handleNuevaPlanificacion = () => {
        setTurnoEnabled({ dia: true, noche: false });
        setTurnoDuration({ dia: SHIFT_DURATIONS_PM_DIA[0].id, noche: SHIFT_DURATIONS_PM_NOCHE[0].id });
        setTurnoStations({ dia: new Set(WORK_STATIONS_PM.map(s => s.id)), noche: new Set() });
        setMedicalAppointments([]);
        setShowMedicalForm(false);
        setMedicalNombre('');
        setMedicalHoras('');
        setMedicalTurno('dia');
        setCapacityDiscounts([]);
        setShowDiscountForm(false);
        setDiscountRazon('');
        setDiscountHoras('');
        setDiscountTurno('dia');
        setAdicionalEnabled(false);
        setAdicionalHoras('');
        setAdicionalStations(new Set());
        setRejectedFillIds(new Set());
        setHasPlanned(false);
        setPmDistribution(null);
        setIsExplodingMaterials(false);
        setLaminaEspumaResults([]);
        setLaminaPrensadaResults([]);
        setIsRecalculatingPlan(false);
        setIsSavingPlan(false);
        setPlanCheckModal(null);
        setIsPlanCheckBusy(false);
        setSelectedProposalId(null);
        setShowNuevaPlanificacionConfirm(false);
        addNotification('info', 'Planificación reiniciada. Puede comenzar una nueva desde cero.');
    };

    // Órdenes de Planchas Mixtas (RESPCTRLPROD/RESPCONTROLPROD según la restricción "RespCtrlProd" del
    // Grupo Prensado — ver "validRespCodes", ej. 015/016 —, Centro 1000) que se deben tomar
    // en cuenta HOY:
    // - Previsionales MTS (sin PEDIDOVENTAS): FECHAINICIO = hoy o mañana.
    // - Previsionales MTO "Medidas Especiales" (con PEDIDOVENTAS): FECHAINICIO = mañana o pasado mañana
    //   (NO hoy), ya que estas siempre aparecen fechadas 1 o 2 días después de hoy.
    // - Fert (MTO o MTS): FECHA = ÚNICAMENTE mañana (no hoy) y CANTPENDIENTE > 0, ya que por el horizonte
    //   de planificación estas órdenes siempre se liberan con fecha de un día después.
    const pmOrders = useMemo<PMOrder[]>(() => {
        const todayKey = getDateKeyOffset(0);
        const tomorrowKey = getBusinessDateKeyOffset(1, holidaysSet);
        const dayAfterTomorrowKey = getBusinessDateKeyOffset(2, holidaysSet);
        const result: PMOrder[] = [];

        allPrevisionalRaw.forEach((row: any) => {
            if (!validRespCodes.includes(String(row.RESPCONTROLPROD || '').trim())) return;
            if (String(row.Centro || '').trim() !== CENTRO_PLANIFICACION_PM) return;

            const fechaKey = String(row.FECHAINICIO || '').trim().slice(0, 10);
            const esMTO = !!String(row.PEDIDOVENTAS || '').trim();
            const fechaValida = esMTO
                ? (fechaKey === tomorrowKey || fechaKey === dayAfterTomorrowKey)
                : (fechaKey === todayKey || fechaKey === tomorrowKey);
            if (!fechaValida) return;

            const cantidad = Number(row.CANTIDAD) || 0;
            if (cantidad <= 0) return;

            const material = normalizeMaterialCode(row.MATERIAL || row.CodMaterial || '');
            const tiempoUnitMin = globalTiemposMap.get(material) ?? 0;
            result.push({
                id: String(row.ORDENPREVISIONAL || ''),
                source: 'Previsional',
                tipo: esMTO ? 'MTO' : 'MTS',
                material,
                nombre: String(row.NOMBRE || '').trim(),
                cantidad,
                tiempoUnitMin,
                horas: (tiempoUnitMin * cantidad) / 60,
                fecha: fechaKey,
            });
        });

        allFertRaw.forEach((row: any) => {
            if (!validRespCodes.includes(String(row.RESPCTRLPROD || '').trim())) return;
            if (String(row.CENTRO || '').trim() !== CENTRO_PLANIFICACION_PM) return;

            const fechaKey = String(row.FECHA || '').trim().slice(0, 10);
            if (fechaKey !== tomorrowKey) return;

            const cantidad = Number(row.CANTPENDIENTE) || 0;
            if (cantidad <= 0) return;

            const esMTO = !!String(row.PEDIDO || '').trim();
            const material = normalizeMaterialCode(row.MATERIAL || '');
            const tiempoUnitMin = globalTiemposMap.get(material) ?? 0;
            result.push({
                id: String(row.ORDEN || ''),
                source: 'Fert',
                tipo: esMTO ? 'MTO' : 'MTS',
                material,
                nombre: String(row.NOMBRE || '').trim(),
                cantidad,
                tiempoUnitMin,
                horas: (tiempoUnitMin * cantidad) / 60,
                fecha: fechaKey,
            });
        });

        return result;
    }, [allPrevisionalRaw, allFertRaw, globalTiemposMap, validRespCodes, holidaysSet]);

    // Candidatas para la Propuesta de Relleno de Capacidad: Previsionales de Planchas Mixtas cuya
    // FECHAINICIO todavía NO forma parte de lo obligatorio de "pmOrders" — MTS con fecha posterior a
    // mañana, MTO con fecha posterior a pasado mañana (ya que MTO ya cubre hasta pasado mañana como
    // obligatorio). Evita duplicar una misma orden entre "obligatorias" y "candidatas a relleno".
    const futurePmOrders = useMemo<PMOrder[]>(() => {
        const tomorrowKey = getBusinessDateKeyOffset(1, holidaysSet);
        const dayAfterTomorrowKey = getBusinessDateKeyOffset(2, holidaysSet);
        return allPrevisionalRaw
            .filter((row: any) => validRespCodes.includes(String(row.RESPCONTROLPROD || '').trim()))
            .filter((row: any) => String(row.Centro || '').trim() === CENTRO_PLANIFICACION_PM)
            .filter((row: any) => {
                const fechaKey = String(row.FECHAINICIO || '').trim().slice(0, 10);
                const esMTO = !!String(row.PEDIDOVENTAS || '').trim();
                return esMTO ? fechaKey > dayAfterTomorrowKey : fechaKey > tomorrowKey;
            })
            .map((row: any) => {
                const material = normalizeMaterialCode(row.MATERIAL || row.CodMaterial || '');
                const cantidad = Number(row.CANTIDAD) || 0;
                const tiempoUnitMin = globalTiemposMap.get(material) ?? 0;
                const esMTO = !!String(row.PEDIDOVENTAS || '').trim();
                const fecha = String(row.FECHAINICIO || '').trim().slice(0, 10);
                return {
                    id: String(row.ORDENPREVISIONAL || ''),
                    source: 'Previsional' as const,
                    tipo: (esMTO ? 'MTO' : 'MTS') as 'MTO' | 'MTS',
                    material,
                    nombre: String(row.NOMBRE || '').trim(),
                    cantidad,
                    tiempoUnitMin,
                    horas: (tiempoUnitMin * cantidad) / 60,
                    fecha,
                };
            })
            .filter(o => o.cantidad > 0 && o.horas > 0)
            .sort((a, b) => a.fecha.localeCompare(b.fecha));
    }, [allPrevisionalRaw, globalTiemposMap, validRespCodes, holidaysSet]);

    const totalHorasRequeridas = useMemo(() => pmOrders.reduce((s, o) => s + o.horas, 0), [pmOrders]);

    // Slots de capacidad activos: una combinación Turno + Mesa por cada mesa habilitada en cada turno activo
    const activeSlots = useMemo<PMSlot[]>(() => {
        const slots: PMSlot[] = [];
        TURNOS_PM.forEach(turno => {
            if (!turnoEnabled[turno.id]) return;
            const durationHours = getShiftDurationsPara(turno.id).find(d => d.id === turnoDuration[turno.id])?.hours ?? 0;
            turnoStations[turno.id].forEach(stationId => {
                slots.push({ turno: turno.id, stationId, capacityHours: durationHours });
            });
        });
        return slots;
    }, [turnoEnabled, turnoDuration, turnoStations]);

    const capacidadDisponible = useMemo(() => activeSlots.reduce((s, slot) => s + slot.capacityHours, 0), [activeSlots]);

    // Descuento de capacidad por citas médicas: las horas de la persona se dividen entre las mesas
    // ACTIVAS del turno al que pertenece, y ese resultado se resta de la capacidad de ese turno.
    const medicalDeductionByTurno = useMemo(() => {
        const deduction: Record<TurnoId, number> = { dia: 0, noche: 0 };
        medicalAppointments.forEach(m => {
            const mesasEnTurno = turnoStations[m.turno].size;
            if (mesasEnTurno > 0) {
                deduction[m.turno] += m.horas / mesasEnTurno;
            }
        });
        return deduction;
    }, [medicalAppointments, turnoStations]);

    const totalMedicalDeduction = medicalDeductionByTurno.dia + medicalDeductionByTurno.noche;

    // Descuento de capacidad por motivos generales (ej. reunión de personal): a diferencia de las citas
    // médicas, estas horas NO se prorratean entre mesas — se descuentan COMPLETAS de CADA mesa activa del
    // turno seleccionado (ej. 1 hora de reunión con 5 mesas activas = 5 horas de capacidad perdidas).
    const capacityDiscountByTurno = useMemo(() => {
        const deduction: Record<TurnoId, number> = { dia: 0, noche: 0 };
        capacityDiscounts.forEach(d => {
            const mesasEnTurno = turnoStations[d.turno].size;
            deduction[d.turno] += d.horas * mesasEnTurno;
        });
        return deduction;
    }, [capacityDiscounts, turnoStations]);

    const totalCapacityDiscount = capacityDiscountByTurno.dia + capacityDiscountByTurno.noche;

    // Adición de capacidad por "Adicionar al Cálculo": horas COMPLETAS (sin prorratear) sumadas por CADA
    // mesa marcada — mismo cálculo que un Descuento de Capacidad, pero en sentido contrario.
    const totalAdicionalCapacidad = useMemo(() => {
        if (!adicionalEnabled) return 0;
        const horas = Number(adicionalHoras) || 0;
        return horas * adicionalStations.size;
    }, [adicionalEnabled, adicionalHoras, adicionalStations]);

    const capacidadDisponibleAjustada = useMemo(
        () => Math.max(0, capacidadDisponible - totalMedicalDeduction - totalCapacityDiscount + totalAdicionalCapacidad),
        [capacidadDisponible, totalMedicalDeduction, totalCapacityDiscount, totalAdicionalCapacidad]
    );

    const handleAddMedicalAppointment = () => {
        const horas = Number(medicalHoras);
        if (!medicalNombre.trim() || !horas || horas <= 0) {
            addNotification('warning', 'Ingrese el nombre de la persona y una cantidad de horas válida.');
            return;
        }
        const mesasEnTurno = turnoStations[medicalTurno].size;
        setMedicalAppointments(prev => [...prev, {
            id: `med-${Date.now()}-${Math.random().toString(36).slice(2)}`,
            nombre: medicalNombre.trim(),
            horas,
            turno: medicalTurno,
        }]);
        addNotification('success', mesasEnTurno > 0
            ? `Cita médica registrada: ${medicalNombre.trim()} — ${horas} h (${medicalTurno === 'dia' ? 'Turno Día' : 'Turno Noche'}). Se descontarán ${(horas / mesasEnTurno).toFixed(2)} h de la capacidad de ese turno.`
            : `Cita médica registrada: ${medicalNombre.trim()} — ${horas} h. El turno seleccionado no tiene mesas activas, no se pudo prorratear.`);
        setMedicalNombre('');
        setMedicalHoras('');
        setShowMedicalForm(false);
    };

    const handleRemoveMedicalAppointment = (id: string) => {
        setMedicalAppointments(prev => prev.filter(m => m.id !== id));
    };

    const handleAddCapacityDiscount = () => {
        const horas = Number(discountHoras);
        if (!discountRazon.trim() || !horas || horas <= 0) {
            addNotification('warning', 'Ingrese la razón del descuento y una cantidad de horas válida.');
            return;
        }
        const mesasEnTurno = turnoStations[discountTurno].size;
        setCapacityDiscounts(prev => [...prev, {
            id: `desc-${Date.now()}-${Math.random().toString(36).slice(2)}`,
            razon: discountRazon.trim(),
            horas,
            turno: discountTurno,
        }]);
        addNotification('success', mesasEnTurno > 0
            ? `Descuento de capacidad registrado: ${discountRazon.trim()} — ${horas} h (${discountTurno === 'dia' ? 'Turno Día' : 'Turno Noche'}). Se descontarán ${(horas * mesasEnTurno).toFixed(2)} h en total (${horas} h × ${mesasEnTurno} mesa(s)).`
            : `Descuento de capacidad registrado: ${discountRazon.trim()} — ${horas} h. El turno seleccionado no tiene mesas activas, no se descontó capacidad.`);
        setDiscountRazon('');
        setDiscountHoras('');
        setShowDiscountForm(false);
    };

    const handleRemoveCapacityDiscount = (id: string) => {
        setCapacityDiscounts(prev => prev.filter(d => d.id !== id));
    };

    // Propuesta de relleno de capacidad: si sobra capacidad después de las órdenes obligatorias de hoy,
    // se proponen (en orden de fecha más próxima) órdenes previsionales de días posteriores hasta llenar
    // esa capacidad sobrante. El usuario puede desmarcar individualmente las que no quiera aceptar.
    const proposedFillOrders = useMemo<PMOrder[]>(() => {
        const spare = capacidadDisponibleAjustada - totalHorasRequeridas;
        if (spare <= 0) return [];
        const proposal: PMOrder[] = [];
        let used = 0;
        for (const o of futurePmOrders) {
            if (used + o.horas > spare) continue;
            proposal.push(o);
            used += o.horas;
        }
        return proposal;
    }, [futurePmOrders, capacidadDisponibleAjustada, totalHorasRequeridas]);

    const toggleFillOrderAccepted = (id: string) => {
        setRejectedFillIds(prev => {
            const next = new Set(prev);
            if (next.has(id)) next.delete(id);
            else next.add(id);
            return next;
        });
    };

    const acceptedFillOrders = useMemo(
        () => proposedFillOrders.filter(o => !rejectedFillIds.has(o.id)),
        [proposedFillOrders, rejectedFillIds]
    );
    const horasPropuestaAceptada = useMemo(() => acceptedFillOrders.reduce((s, o) => s + o.horas, 0), [acceptedFillOrders]);

    // Lista efectiva a planificar: lo obligatorio de hoy/mañana + lo aceptado de la propuesta de relleno
    const effectivePmOrders = useMemo(() => [...pmOrders, ...acceptedFillOrders], [pmOrders, acceptedFillOrders]);

    const totalHorasEfectivas = useMemo(() => effectivePmOrders.reduce((s, o) => s + o.horas, 0), [effectivePmOrders]);
    const totalCantidadRequerida = useMemo(() => effectivePmOrders.reduce((s, o) => s + o.cantidad, 0), [effectivePmOrders]);
    // Plancha Mixta Equivalente: unidad de medida estándar del área, donde 1 equivalente = 3.87 min
    const totalPlanchasEquivalentes = useMemo(() => (totalHorasEfectivas * 60) / MINUTOS_POR_PLANCHA_EQUIVALENTE, [totalHorasEfectivas]);

    // Ejecuta realmente la planificación (llamado directamente si no había plan guardado para hoy, o tras
    // "PROCEDER"/"Borrar Plan(es) Guardado(s)" en el chequeo de plan duplicado)
    const confirmRunPlanning = () => {
        setHasPlanned(true);
        // Una nueva planificación invalida cualquier distribución/explosión previa y reinicia la propuesta
        setPmDistribution(null);
        setLaminaEspumaResults([]);
        setLaminaPrensadaResults([]);
        setRejectedFillIds(new Set());
        setSelectedProposalId(null);
        // El recálculo ajustado (Paso 2) ya se ejecutó; el botón vuelve a su estado normal
        setIsRecalculatingPlan(false);
        setPlanCheckModal(null);
        addNotification('success', `Planificación calculada: ${pmOrders.length} orden(es), ${totalHorasRequeridas.toFixed(2)} h requeridas.`);
    };

    // Fecha objetivo real de esta planificación: el "mañana" laborable (salta fines de semana y feriados)
    // usado para las órdenes Fert/Previsionales MTS — NO necesariamente hoy. El Plan Táctico (PFSP/P2) que
    // se guarda representa la producción de ESE día, así que tanto la verificación de duplicados como el
    // guardado deben usar esta fecha, no la fecha del día en que se presiona el botón.
    const fechaObjetivoPM = useMemo(() => getBusinessDateKeyOffset(1, holidaysSet), [holidaysSet]);

    // Antes de ejecutar la planificación, se verifica si ya existe un Plan Táctico guardado (PlanGrupo del
    // Grupo Prensado, patrón "... - PFSP"/"... - P2") para la fecha objetivo, para evitar duplicar o pisar
    // sin darse cuenta un plan que ya se guardó. Mismo chequeo que "Planificación Táctica Muebles".
    const handleRunPlanning = async () => {
        if (validRespCodes.length === 0) {
            addNotification('warning', 'No se encontró la restricción "RespCtrlProd" del Grupo Prensado. No se puede determinar qué Responsables de Control de Producción planificar.');
            return;
        }
        if (pmOrders.length === 0) {
            addNotification('warning', `No hay órdenes previsionales ni Fert de Planchas Mixtas (RESPCTRLPROD ${validRespCodes.join('/')}) para planificar hoy.`);
            return;
        }
        if (activeSlots.length === 0) {
            addNotification('warning', 'Debe habilitar al menos un turno y escoger al menos una mesa antes de ejecutar la planificación.');
            return;
        }
        if (!prensadoGrupo) {
            addNotification('error', 'No se pudo determinar el Grupo Prensado asociado para verificar planes guardados.');
            return;
        }

        setIsPlanCheckBusy(true);
        try {
            const res = await planGrupoService.getAll();
            const existentes = (res.data || []).filter(p => {
                if (p.codigo_grupo !== prensadoGrupo.codigo_grupo) return false;
                if (!/PFSP\s*$|P2\s*$/i.test(String(p.valor || '').trim())) return false;
                return String(p.fecha_inicio_plan).slice(0, 10) === fechaObjetivoPM;
            });

            setPlanCheckModal(existentes.length > 0 ? { type: 'found', planesGrupo: existentes } : { type: 'not-found' });
        } catch (error) {
            addNotification('error', `Error al verificar planes guardados: ${(error as Error).message}`);
        } finally {
            setIsPlanCheckBusy(false);
        }
    };

    const handleActivateVistaMode = async () => {
        if (!planCheckModal || planCheckModal.type !== 'found') return;
        const { planesGrupo } = planCheckModal;

        setIsPlanCheckBusy(true);
        try {
            const res = await detalleTacticoService.getAll();
            const planesIds = new Set(planesGrupo.map(p => p.codigo_plan_grupo));
            const detalles = (res.data || []).filter(d => planesIds.has(d.codigo_plan_grupo));
            setPlanCheckModal({ type: 'vista', planesGrupo, detalles });
        } catch (error) {
            addNotification('error', `Error al cargar el detalle del plan guardado: ${(error as Error).message}`);
        } finally {
            setIsPlanCheckBusy(false);
        }
    };

    const handleDeleteExistingPlan = async () => {
        if (!planCheckModal || planCheckModal.type !== 'found') return;
        const { planesGrupo } = planCheckModal;

        setIsPlanCheckBusy(true);
        try {
            const detallesRes = await detalleTacticoService.getAll();
            const planesIds = new Set(planesGrupo.map(p => p.codigo_plan_grupo));
            const detalles = (detallesRes.data || []).filter(d => planesIds.has(d.codigo_plan_grupo));
            await Promise.all(detalles.map(d => detalleTacticoService.delete(d.codigo_detalle_tactico)));
            await Promise.all(planesGrupo.map(p => planGrupoService.delete(p.codigo_plan_grupo)));

            addNotification('success', `Plan(es) Táctico(s) anterior(es) (${planesGrupo.map(p => p.valor).join(', ')}) eliminado(s). Puede continuar con la nueva planificación.`);
            confirmRunPlanning();
        } catch (error) {
            addNotification('error', `Error al eliminar el plan guardado: ${(error as Error).message}`);
        } finally {
            setIsPlanCheckBusy(false);
        }
    };

    // Distribuye CADA orden (obligatorias + propuesta de relleno aceptada) en partes exactamente iguales
    // entre todos los slots de capacidad activos (Turno + Mesa): así se fabrica realmente en planta — por
    // ejemplo, 28 unidades del mismo material con 4 mesas activas se reparten en 7 unidades por mesa. Si
    // la cantidad no es divisible exactamente, el residuo (las unidades "de más") se reparte una por una
    // entre las mesas, rotando cuáles la reciben en cada orden para que ninguna mesa quede sistemáticamente
    // con más carga que las demás.
    const handleDistributePM = () => {
        if (effectivePmOrders.length === 0 || activeSlots.length === 0) return;

        const n = activeSlots.length;
        const slotHours = new Map<string, number>(activeSlots.map(s => [slotKey(s.turno, s.stationId), 0]));
        const slotItems = new Map<string, PMOrder[]>(activeSlots.map(s => [slotKey(s.turno, s.stationId), []]));

        effectivePmOrders.forEach((order, orderIdx) => {
            const baseQty = Math.floor(order.cantidad / n);
            const remainder = order.cantidad % n;

            activeSlots.forEach((slot, slotIdx) => {
                // Rota qué mesas reciben la unidad "extra" del residuo, orden a orden
                const rotatedIdx = (slotIdx - (orderIdx % n) + n) % n;
                const assignedQty = baseQty + (rotatedIdx < remainder ? 1 : 0);
                if (assignedQty <= 0) return;

                const key = slotKey(slot.turno, slot.stationId);
                const assignedHoras = (order.tiempoUnitMin * assignedQty) / 60;
                slotItems.get(key)!.push({ ...order, cantidad: assignedQty, horas: assignedHoras });
                slotHours.set(key, slotHours.get(key)! + assignedHoras);
            });
        });

        const distribution = new Map<string, PMStationEntry>();
        activeSlots.forEach(s => {
            const key = slotKey(s.turno, s.stationId);
            distribution.set(key, {
                ...s,
                usedHours: slotHours.get(key) ?? 0,
                items: slotItems.get(key) ?? [],
            });
        });

        setPmDistribution(distribution);
        setLaminaEspumaResults([]);
        setLaminaPrensadaResults([]);
        addNotification('success', `Distribución ejecutada: cada material se repartió en partes iguales entre las ${n} mesa(s)-turno activas.`);
    };

    // Horas Requeridas (Obligatorias) repartidas entre la cantidad de mesas-turno escogidas (activeSlots)
    const horasPorMesa = useMemo(
        () => (activeSlots.length > 0 ? totalHorasRequeridas / activeSlots.length : 0),
        [totalHorasRequeridas, activeSlots]
    );

    // % de utilización de la capacidad: Horas Requeridas (Obligatorias) / Capacidad Disponible ajustada.
    // 100% = capacidad exactamente usada; >100% = déficit; <100% = capacidad sobrante.
    const utilizacionActualPct = useMemo(
        () => (capacidadDisponibleAjustada > 0 ? (totalHorasRequeridas / capacidadDisponibleAjustada) * 100 : Infinity),
        [totalHorasRequeridas, capacidadDisponibleAjustada]
    );

    // Selección de la propuesta de ajuste de capacidad actualmente aplicada (para resaltarla en la UI)
    const [selectedProposalId, setSelectedProposalId] = useState<string | null>(null);

    // Propuesta de Ajuste de Capacidad: si la utilización actual está fuera de un rango eficiente
    // (85%-105%), se evalúa si cambiar la duración de jornada de algún turno activo (prioridad, ya que
    // las mesas se definen semanalmente según vacaciones del personal de Prensado) o la cantidad de mesas
    // activas de ese turno acercaría la utilización a ese rango. Solo se muestra si SÍ existe una mejora.
    const capacityProposal = useMemo<CapacityProposalOption[]>(() => {
        if (!hasPlanned || totalHorasRequeridas <= 0) return [];
        if (utilizacionActualPct >= UTILIZACION_EFICIENTE_MIN && utilizacionActualPct <= UTILIZACION_EFICIENTE_MAX) return [];

        // Distancia (en puntos porcentuales) de una utilización al rango eficiente; 0 si ya está dentro
        const distanciaAEficiente = (pct: number): number => {
            if (pct < UTILIZACION_EFICIENTE_MIN) return UTILIZACION_EFICIENTE_MIN - pct;
            if (pct > UTILIZACION_EFICIENTE_MAX) return pct - UTILIZACION_EFICIENTE_MAX;
            return 0;
        };
        const distanciaActual = distanciaAEficiente(utilizacionActualPct);

        // Deducciones fijas netas (citas médicas + descuentos de capacidad − adición al cálculo) que no
        // cambian con la propuesta
        const deduccionesFijas = totalMedicalDeduction + totalCapacityDiscount - totalAdicionalCapacidad;
        const opciones: CapacityProposalOption[] = [];

        TURNOS_PM.forEach(turno => {
            if (!turnoEnabled[turno.id]) return;
            const mesasActuales = turnoStations[turno.id].size;
            if (mesasActuales === 0) return;
            const duracionActualId = turnoDuration[turno.id];
            const duracionesTurno = getShiftDurationsPara(turno.id);
            const duracionActualHoras = duracionesTurno.find(d => d.id === duracionActualId)?.hours ?? 0;
            // Capacidad de TODOS los demás slots (otros turnos, o este mismo turno sin contar sus propias mesas)
            const capacidadOtrosSlots = capacidadDisponible - (mesasActuales * duracionActualHoras);

            // Opción prioritaria: cambiar la duración de jornada de este turno (subir o bajar el turno)
            duracionesTurno.forEach(d => {
                if (d.id === duracionActualId) return;
                const capacidadResultante = Math.max(0, capacidadOtrosSlots + (mesasActuales * d.hours) - deduccionesFijas);
                if (capacidadResultante <= 0) return;
                opciones.push({
                    id: `turno-${turno.id}-${d.id}`,
                    turno: turno.id,
                    tipo: 'turno',
                    nuevaDuracionId: d.id,
                    descripcion: `${turno.label}: cambiar jornada de ${duracionesTurno.find(x => x.id === duracionActualId)?.label} a ${d.label}`,
                    capacidadResultante,
                    utilizacionPct: (totalHorasRequeridas / capacidadResultante) * 100,
                });
            });

            // Opción secundaria: aumentar o disminuir la cantidad de mesas activas de este turno (misma jornada)
            for (let m = 1; m <= WORK_STATIONS_PM.length; m++) {
                if (m === mesasActuales) continue;
                const capacidadResultante = Math.max(0, capacidadOtrosSlots + (m * duracionActualHoras) - deduccionesFijas);
                if (capacidadResultante <= 0) continue;
                opciones.push({
                    id: `mesas-${turno.id}-${m}`,
                    turno: turno.id,
                    tipo: 'mesas',
                    nuevasMesas: m,
                    descripcion: `${turno.label}: cambiar de ${mesasActuales} a ${m} mesa(s) activa(s)`,
                    capacidadResultante,
                    utilizacionPct: (totalHorasRequeridas / capacidadResultante) * 100,
                });
            }
        });

        // Solo se conservan las opciones que realmente mejoran la utilización actual (más cerca del rango
        // eficiente que el estado actual); se prioriza turno sobre mesas, y dentro de cada tipo, la mejor
        const mejores = opciones
            .filter(o => distanciaAEficiente(o.utilizacionPct) < distanciaActual)
            .sort((a, b) => {
                if (a.tipo !== b.tipo) return a.tipo === 'turno' ? -1 : 1;
                return distanciaAEficiente(a.utilizacionPct) - distanciaAEficiente(b.utilizacionPct);
            });

        // Se muestra como máximo 1 opción de turno (prioritaria) + 1 de mesas (segunda opción)
        const mejorTurno = mejores.find(o => o.tipo === 'turno');
        const mejorMesas = mejores.find(o => o.tipo === 'mesas');
        return [mejorTurno, mejorMesas].filter((o): o is CapacityProposalOption => !!o);
    }, [hasPlanned, totalHorasRequeridas, utilizacionActualPct, capacidadDisponible, turnoEnabled, turnoStations, turnoDuration, totalMedicalDeduction, totalCapacityDiscount, totalAdicionalCapacidad]);

    // Aplica la opción de propuesta escogida: cambia la jornada o la cantidad de mesas activas del turno
    // correspondiente, e invalida la distribución/explosión previas (quedaron calculadas con la config anterior)
    const handleApplyCapacityProposal = (option: CapacityProposalOption) => {
        if (option.tipo === 'turno' && option.nuevaDuracionId) {
            setTurnoDuration(prev => ({ ...prev, [option.turno]: option.nuevaDuracionId! }));
        } else if (option.tipo === 'mesas' && option.nuevasMesas !== undefined) {
            setTurnoStations(prev => {
                const current = Array.from(prev[option.turno]).sort((a, b) => a - b);
                const target = option.nuevasMesas!;
                let next: number[];
                if (target > current.length) {
                    const faltantes = WORK_STATIONS_PM.map(s => s.id).filter(id => !current.includes(id));
                    next = [...current, ...faltantes.slice(0, target - current.length)];
                } else {
                    next = current.slice(0, target);
                }
                return { ...prev, [option.turno]: new Set(next) };
            });
        }
        setSelectedProposalId(option.id);
        setPmDistribution(null);
        setLaminaEspumaResults([]);
        setLaminaPrensadaResults([]);
        addNotification('success', `Propuesta aplicada: ${option.descripcion}. Presione "DISTRIBUIR EN MESAS DE PEGADO" nuevamente para recalcular con este ajuste.`);
    };

    // Exporta a Excel la tabla "Planificación Calculada — Planchas Mixtas" (pmOrders)
    const handleExportPlanningPMExcel = () => {
        if (pmOrders.length === 0) return;

        const rows = pmOrders.map(o => ({
            'Origen': o.source,
            'N° Orden': o.id,
            'Material': o.material,
            'Nombre': o.nombre,
            'Tipo': o.tipo,
            'Fecha': o.fecha,
            'Cantidad': o.cantidad,
            'Horas': Number(o.horas.toFixed(2)),
        }));

        const worksheet = XLSX.utils.json_to_sheet(rows);
        const workbook = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(workbook, worksheet, 'Planificación Calculada');

        const fechaArchivo = getDateKeyOffset(0);
        XLSX.writeFile(workbook, `Planificacion_Calculada_Planchas_Mixtas_${fechaArchivo}.xlsx`);
    };

    // Exporta a Excel la producción por cada Mesa de Pegado ("Distribución Equitativa — Mesas de Pegado"):
    // una fila por orden asignada, agrupadas por Turno y Mesa
    const handleExportDistribucionMesasExcel = () => {
        if (!pmDistribution || pmDistribution.size === 0) return;

        const rows: Record<string, string | number>[] = [];
        Array.from(pmDistribution.values())
            .sort((a, b) => a.turno.localeCompare(b.turno) || a.stationId - b.stationId)
            .forEach(station => {
                const turnoLabel = TURNOS_PM.find(t => t.id === station.turno)?.label ?? station.turno;
                const mesaNombre = WORK_STATIONS_PM.find(s => s.id === station.stationId)?.name ?? `MESA ${station.stationId}`;
                station.items.forEach(item => {
                    rows.push({
                        'Turno': turnoLabel,
                        'Mesa': mesaNombre,
                        'Origen': item.source,
                        'N° Orden': item.id,
                        'Material': item.material,
                        'Nombre': item.nombre,
                        'Tipo': item.tipo,
                        'Fecha': item.fecha,
                        'Cantidad': item.cantidad,
                        'Horas': Number(item.horas.toFixed(2)),
                    });
                });
            });
        if (rows.length === 0) return;

        const worksheet = XLSX.utils.json_to_sheet(rows);
        const workbook = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(workbook, worksheet, 'Distribución Mesas de Pegado');

        const fechaArchivo = getDateKeyOffset(0);
        XLSX.writeFile(workbook, `Distribucion_Mesas_Pegado_${fechaArchivo}.xlsx`);
    };

    // Exporta a Excel una tabla de Explosión de Materiales (Láminas de Espuma/Prensadas) con el Kardex
    const exportComponentNeedsToExcelPM = (data: PMComponentNeed[], sheetName: string, fileLabel: string) => {
        if (data.length === 0) return;

        const rows = data.map(c => ({
            'Componente': c.componente,
            'Descripción': c.descripcion,
            'Unidad': c.unidad,
            'Cantidad Total Necesaria': Number(c.totalNecesario.toFixed(2)),
            'Stock Actual': c.stockActual ?? '',
            'Consumo Órdenes Pasadas': Number(c.consumoOrdenesPasadas.toFixed(2)),
            'Producción Propia Pendiente': Number(c.produccionPropiaPendiente.toFixed(2)),
            'Disponible Real': c.disponibleReal ?? '',
            'Cantidad Neta Requerida': Number(c.cantidadNetaAConseguir.toFixed(2)),
        }));

        const worksheet = XLSX.utils.json_to_sheet(rows);
        const workbook = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(workbook, worksheet, sheetName);

        const fechaArchivo = getDateKeyOffset(0);
        XLSX.writeFile(workbook, `${fileLabel}_${fechaArchivo}.xlsx`);
    };

    // Guarda el Plan Táctico de Planchas Mixtas en el Grupo Prensado (codigo_grupo=9), separado en 2
    // PlanGrupo — mismo patrón de "Planificación Táctica Muebles" (ver P1.3/P1.5/P2/PFSM de ese módulo):
    // - PFSP: Explosión de Materiales — Láminas Prensadas (RESPCTRLPROD 017)
    // - P2: Explosión de Materiales — Láminas de Espuma (RESPCTRLPROD 013)
    const handleSavePlanTacticoPM = async () => {
        const hayPFSP = laminaPrensadaResults.length > 0;
        const hayP2 = laminaEspumaResults.length > 0;

        if (!hayPFSP && !hayP2) {
            addNotification('warning', 'No hay detalles de "Explosión de Materiales" para guardar. Ejecute primero esa explosión.');
            return;
        }
        if (!prensadoGrupo) {
            addNotification('error', 'No se pudo determinar el Grupo Prensado asociado para guardar el plan.');
            return;
        }

        setIsSavingPlan(true);
        try {
            // La fecha del Plan Táctico es la fecha OBJETIVO (mañana laborable), no la fecha en que se
            // guarda — mismo criterio que la verificación de duplicados en handleRunPlanning.
            const fechaPlan = new Date(`${fechaObjetivoPM}T00:00:00`);

            // Crea un Plan de Grupo con el sufijo indicado (PFSP / P2) y devuelve su código. codigo_plan y
            // codigo_familia_grupo se envían como null (no 0) para evitar un error de integridad
            // referencial contra tablas que aún no tienen ese registro relacionado.
            const savePlanGrupo = async (sufijo: string): Promise<number> => {
                const planPayload = {
                    codigo_plan_grupo: 0,
                    codigo_plan: null,
                    codigo_grupo: prensadoGrupo.codigo_grupo,
                    codigo_familia_grupo: null,
                    valor: `Plan Táctico - Centro ${prensadoGrupo.centro} - ${sufijo}`,
                    fecha_inicio_plan: fechaPlan,
                    fecha_fin_plan: fechaPlan,
                    estado: 'A',
                    fecha_creacion: new Date(),
                    usuario_creacion: 'Admin',
                } as unknown as PlanGrupo;

                const savedPlan = await planGrupoService.save(planPayload);
                const codigoPlanGrupo = savedPlan?.data?.codigo_plan_grupo;
                if (!codigoPlanGrupo) {
                    throw new Error(`El backend no devolvió un código de Plan de Grupo válido para ${sufijo}.`);
                }
                return codigoPlanGrupo;
            };

            const saveDetalle = (codigoPlanGrupo: number, codigoMaterial: number, cantidadProduccionNeta: number, respCtrlProd: string) => {
                const detallePayload: DetalleTactico = {
                    codigo_detalle_tactico: 0,
                    codigo_plan_grupo: codigoPlanGrupo,
                    codigo_material: codigoMaterial,
                    cantidad_produccion_neta: cantidadProduccionNeta.toFixed(2),
                    resp_ctrl_prod: respCtrlProd,
                    clase_aprovisionamiento: 'E',
                    cantidad_aprovisionamiento: '0',
                    estado: 'A',
                    fecha_modificacion: new Date(),
                    usuario_modificacion: 'Admin',
                };
                return detalleTacticoService.save(detallePayload);
            };

            // 1. PFSP — Explosión de Materiales: Láminas Prensadas (RESPCTRLPROD 017)
            if (hayPFSP) {
                const codigoPlanGrupoPFSP = await savePlanGrupo('PFSP');
                for (const comp of laminaPrensadaResults) {
                    await saveDetalle(codigoPlanGrupoPFSP, Number(comp.componente) || 0, comp.cantidadNetaAConseguir, '017');
                }
            }

            // 2. P2 — Explosión de Materiales: Láminas de Espuma (RESPCTRLPROD 013)
            if (hayP2) {
                const codigoPlanGrupoP2 = await savePlanGrupo('P2');
                for (const comp of laminaEspumaResults) {
                    await saveDetalle(codigoPlanGrupoP2, Number(comp.componente) || 0, comp.cantidadNetaAConseguir, '013');
                }
            }

            const partes = [
                hayPFSP ? `PFSP (${laminaPrensadaResults.length} detalle(s))` : null,
                hayP2 ? `P2 (${laminaEspumaResults.length} detalle(s))` : null,
            ].filter(Boolean).join(', ');
            addNotification('success', `Plan Táctico de Planchas Mixtas guardado: ${partes}.`);
        } catch (error) {
            console.error('Error al guardar el Plan Táctico de Planchas Mixtas:', error);
            addNotification('error', `Error al guardar el Plan Táctico: ${(error as Error).message}`);
        } finally {
            setIsSavingPlan(false);
        }
    };

    const handleMaterialExplosionPM = async () => {
        if (!pmDistribution || pmDistribution.size === 0) {
            addNotification('warning', 'Debe presionar "DISTRIBUIR EN MESAS DE PEGADO" antes de calcular la explosión de materiales.');
            return;
        }

        const materialDemandMap = new Map<string, number>();
        pmDistribution.forEach(slot => {
            slot.items.forEach(o => {
                materialDemandMap.set(o.material, (materialDemandMap.get(o.material) || 0) + o.cantidad);
            });
        });

        const uniqueMaterials = Array.from(materialDemandMap.keys()).filter(Boolean);
        if (uniqueMaterials.length === 0) {
            addNotification('warning', 'No hay materiales distribuidos en mesas para explosionar.');
            return;
        }

        // Kardex: demanda de las mismas órdenes (Fert/Previsionales de Planchas Mixtas) de días ANTERIORES
        // a hoy que todavía están pendientes — Fert con CANTPENDIENTE > 0, Previsionales previas (se toma
        // su CANTIDAD completa). Van a consumir stock ANTES que la planificación de hoy, así que se
        // descuentan del Stock Actual. Mismo patrón que "Planificación Táctica Muebles".
        const todayKey = getDateKeyOffset(0);
        const pastDemandMap = new Map<string, number>();
        allPrevisionalRaw.forEach((row: any) => {
            if (!validRespCodes.includes(String(row.RESPCONTROLPROD || '').trim())) return;
            if (String(row.Centro || '').trim() !== CENTRO_PLANIFICACION_PM) return;
            const fechaKey = String(row.FECHAINICIO || '').trim().slice(0, 10);
            const cantidad = Number(row.CANTIDAD) || 0;
            if (fechaKey && cantidad > 0 && fechaKey < todayKey) {
                const material = normalizeMaterialCode(row.MATERIAL || row.CodMaterial || '');
                pastDemandMap.set(material, (pastDemandMap.get(material) || 0) + cantidad);
            }
        });
        allFertRaw.forEach((row: any) => {
            if (!validRespCodes.includes(String(row.RESPCTRLPROD || '').trim())) return;
            if (String(row.CENTRO || '').trim() !== CENTRO_PLANIFICACION_PM) return;
            const fechaKey = String(row.FECHA || '').trim().slice(0, 10);
            const pendiente = Number(row.CANTPENDIENTE) || 0;
            if (fechaKey && pendiente > 0 && fechaKey < todayKey) {
                const material = normalizeMaterialCode(row.MATERIAL || '');
                pastDemandMap.set(material, (pastDemandMap.get(material) || 0) + pendiente);
            }
        });
        const pastUniqueMaterials = Array.from(pastDemandMap.keys()).filter(Boolean);

        // Producción propia pendiente de cada COMPONENTE (Espuma/Prensada): órdenes Fert que fabrican ese
        // mismo material (sin importar su RESPCTRLPROD, por eso se usa el dataset completo allFertRaw), de
        // días anteriores a hoy y todavía pendientes. Es producción ya en curso que sumará como disponible.
        const componentOwnFertPendingMap = new Map<string, number>();
        allFertRaw.forEach((row: any) => {
            const fechaKey = String(row.FECHA || '').trim().slice(0, 10);
            const pendiente = Number(row.CANTPENDIENTE) || 0;
            if (fechaKey && pendiente > 0 && fechaKey < todayKey) {
                const material = normalizeMaterialCode(row.MATERIAL || '');
                componentOwnFertPendingMap.set(material, (componentOwnFertPendingMap.get(material) || 0) + pendiente);
            }
        });

        // Se explosionan juntos los materiales de hoy y los de días pasados pendientes, en un solo lote.
        const allUniqueMaterials = Array.from(new Set([...uniqueMaterials, ...pastUniqueMaterials]));

        setIsExplodingMaterials(true);
        addNotification('info', `Iniciando explosión de ${allUniqueMaterials.length} material(es) único(s) (${uniqueMaterials.length} de hoy, ${pastUniqueMaterials.length} de días pasados pendientes)...`);

        try {
            const responses = await Promise.all(allUniqueMaterials.map(async (material) => {
                try {
                    const res = await serviciosService.getMaestroMaterialesExplosion('1000', material, 1, 5000);
                    if (res && res.data) {
                        return Array.isArray(res.data) ? res.data : [res.data];
                    }
                } catch (error) {
                    console.error(`Error en explosión del material ${material}:`, error);
                }
                return [] as any[];
            }));

            type RawComponentAccum = { componente: string; descripcion: string; unidad: string; totalNecesario: number };
            const groupedEspuma = new Map<string, RawComponentAccum>();
            const groupedPrensada = new Map<string, RawComponentAccum>();
            // Kardex: consumo de cada componente por parte de las órdenes de días pasados pendientes
            const pastConsumptionMap = new Map<string, number>();

            const ensure = (map: Map<string, RawComponentAccum>, componente: string, descripcion: string, unidad: string) => {
                if (!map.has(componente)) {
                    map.set(componente, { componente, descripcion, unidad, totalNecesario: 0 });
                }
                return map.get(componente)!;
            };

            responses.forEach((components, idx) => {
                const material = allUniqueMaterials[idx];
                const parentDemand = materialDemandMap.get(material) || 0;
                const parentPastDemand = pastDemandMap.get(material) || 0;
                if (parentDemand === 0 && parentPastDemand === 0) return;

                components.forEach((comp: any) => {
                    const descripcion = String(comp.DESCRIPCION_COMPONENTE || '').trim();
                    const componente = String(comp.COMPONENTE || '').trim();
                    if (!componente) return;

                    const cantBase = Number(comp.CANTIDAD_ACUMULADA ?? comp.CANTIDAD_UNITARIA ?? 0);
                    const necesario = cantBase * parentDemand;
                    const consumoPasado = cantBase * parentPastDemand;
                    const unidad = String(comp.UNIDAD || 'UN');
                    const respCtrlProd = materialRespCtrlProdMap.get(normalizeMaterialCode(componente));

                    if (consumoPasado > 0) {
                        pastConsumptionMap.set(componente, (pastConsumptionMap.get(componente) || 0) + consumoPasado);
                    }
                    if (necesario <= 0) return;

                    // Semielaborados de Láminas de Espuma: RESPCTRLPROD '013'
                    if (respCtrlProd === '013') {
                        ensure(groupedEspuma, componente, descripcion, unidad).totalNecesario += necesario;
                    }

                    // Semielaborados de Láminas Prensadas: RESPCTRLPROD '017'
                    if (respCtrlProd === '017') {
                        ensure(groupedPrensada, componente, descripcion, unidad).totalNecesario += necesario;
                    }
                });
            });

            // Kardex: Stock Actual - Consumo de Órdenes Pasadas Pendientes + Producción Propia Pendiente =
            // Disponible Real; Cantidad Neta Requerida = max(0, Necesario de hoy - Disponible Real).
            const withKardex = (c: RawComponentAccum): PMComponentNeed => {
                const stockActual = materialStockActualMap.get(normalizeMaterialCode(c.componente)) ?? null;
                const consumoOrdenesPasadas = pastConsumptionMap.get(c.componente) || 0;
                const produccionPropiaPendiente = componentOwnFertPendingMap.get(normalizeMaterialCode(c.componente)) || 0;
                const disponibleReal = (stockActual !== null || produccionPropiaPendiente > 0)
                    ? (stockActual ?? 0) - consumoOrdenesPasadas + produccionPropiaPendiente
                    : null;
                const cantidadNetaAConseguir = disponibleReal !== null ? Math.max(0, c.totalNecesario - disponibleReal) : c.totalNecesario;
                return {
                    componente: c.componente,
                    descripcion: c.descripcion,
                    unidad: c.unidad,
                    totalNecesario: c.totalNecesario,
                    stockActual,
                    consumoOrdenesPasadas,
                    produccionPropiaPendiente,
                    disponibleReal,
                    cantidadNetaAConseguir,
                };
            };

            const sortedEspuma = Array.from(groupedEspuma.values()).map(withKardex).sort((a, b) => b.cantidadNetaAConseguir - a.cantidadNetaAConseguir);
            setLaminaEspumaResults(sortedEspuma);

            const sortedPrensada = Array.from(groupedPrensada.values()).map(withKardex).sort((a, b) => b.cantidadNetaAConseguir - a.cantidadNetaAConseguir);
            setLaminaPrensadaResults(sortedPrensada);

            if (sortedEspuma.length > 0 || sortedPrensada.length > 0) {
                addNotification('success', `Explosión completada: ${sortedEspuma.length} lámina(s) de espuma y ${sortedPrensada.length} lámina(s) prensada(s) identificada(s).`);
            } else {
                addNotification('warning', 'No se encontraron láminas de espuma (013) ni prensadas (017) en la explosión de estos materiales.');
            }
        } catch (error) {
            console.error('Error en la explosión de materiales:', error);
            addNotification('error', 'Error al procesar la explosión de materiales.');
        } finally {
            setIsExplodingMaterials(false);
        }
    };

    if (isLoading && allPrevisionalRaw.length === 0) {
        return (
            <div className="flex flex-col items-center justify-center py-20 bg-gray-50 rounded-xl border-2 border-dashed gap-4">
                <Loader2 className="w-12 h-12 animate-spin text-indigo-600" />
                <div className="text-center">
                    <p className="text-sm font-bold text-gray-700">Descargando datos de Planchas Mixtas...</p>
                    <p className="text-xs text-gray-500 mt-1">
                        Procesados {downloadProgress.current.toLocaleString()} de {downloadProgress.total.toLocaleString()} registros
                    </p>
                </div>
            </div>
        );
    }

    return (
        <div className="space-y-6">
            {/* SECCIÓN DE TURNOS DE TRABAJO (DÍA Y NOCHE, SIMULTÁNEOS E INDEPENDIENTES) */}
            <div className="bg-white border border-gray-200 rounded-xl p-6 shadow-sm space-y-4">
                <div className="flex items-center justify-between gap-4 flex-wrap">
                    <div className="flex items-center gap-2">
                        <Clock className="w-5 h-5 text-indigo-600" />
                        <h3 className="text-sm font-bold text-gray-800 uppercase tracking-tight">Turnos de Trabajo</h3>
                    </div>
                    <div className="flex items-center gap-2">
                        <Button
                            onClick={() => setShowNuevaPlanificacionConfirm(true)}
                            variant="outline"
                            title="Reinicia turnos, mesas, citas médicas, descuentos, planificación, distribución y explosión de materiales para empezar de cero."
                            className="border-amber-300 text-amber-700 hover:bg-amber-50 font-bold gap-2"
                        >
                            <RotateCcw className="w-4 h-4" />
                            Planificación Nueva
                        </Button>
                        <Button
                            onClick={() => setShowMedicalForm(v => !v)}
                            variant="outline"
                            className="border-amber-300 text-amber-700 hover:bg-amber-50 font-bold gap-2"
                        >
                            <Stethoscope className="w-4 h-4" />
                            Cita Médica
                        </Button>
                        <Button
                            onClick={() => setShowDiscountForm(v => !v)}
                            variant="outline"
                            className="border-rose-300 text-rose-700 hover:bg-rose-50 font-bold gap-2"
                        >
                            <MinusCircle className="w-4 h-4" />
                            Descuentos de Capacidad
                        </Button>
                        <Button
                            onClick={handleRefreshData}
                            disabled={isLoading}
                            className="bg-white hover:bg-gray-50 text-gray-700 border border-gray-300 font-bold gap-2"
                        >
                            {isLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <RefreshCw className="w-4 h-4" />}
                            Actualizar Datos
                        </Button>
                        <Button
                            onClick={handleRunPlanning}
                            className={cn(
                                "text-white font-bold gap-2",
                                isRecalculatingPlan ? "bg-amber-600 hover:bg-amber-700" : "bg-indigo-600 hover:bg-indigo-700"
                            )}
                            disabled={isLoading || isPlanCheckBusy || pmOrders.length === 0}
                        >
                            {isPlanCheckBusy ? <Loader2 className="w-4 h-4 animate-spin" /> : <PlayCircle className="w-4 h-4" />}
                            {isRecalculatingPlan ? 'PASO 2: RECALCULAR PLANIFICACIÓN AJUSTADA' : 'EJECUTAR PLANIFICACIÓN'}
                        </Button>
                    </div>
                </div>
                <p className="text-[11px] text-gray-500">
                    Planificando con órdenes del <span className="font-bold">Centro 1000 (Quito)</span>, RespCtrlProd{' '}
                    <span className="font-bold">{validRespCodes.length > 0 ? validRespCodes.join('/') : '(sin restricción configurada)'}</span>:
                    Previsionales MTS (hoy {getDateKeyOffset(0)} o mañana {getBusinessDateKeyOffset(1, holidaysSet)}), Previsionales MTO "Medidas
                    Especiales" (mañana {getBusinessDateKeyOffset(1, holidaysSet)} o pasado mañana {getBusinessDateKeyOffset(2, holidaysSet)}) y Fert (únicamente mañana,{' '}
                    {getBusinessDateKeyOffset(1, holidaysSet)}) —{' '}
                    {pmOrders.length} orden(es) encontrada(s).
                </p>

                {showMedicalForm && (
                    <div className="border border-amber-300 bg-amber-50/50 rounded-lg p-4 space-y-3">
                        <p className="text-xs font-bold text-amber-800 uppercase">Registrar Cita Médica</p>
                        <p className="text-[10px] text-amber-700">
                            Se asumen {PERSONAS_POR_MESA} personas por mesa. Las horas de ausencia se dividen entre las mesas
                            activas del turno seleccionado y se descuentan de la capacidad disponible de ese turno.
                        </p>
                        <div className="grid grid-cols-1 md:grid-cols-4 gap-2">
                            <Input
                                placeholder="Nombre de la persona"
                                value={medicalNombre}
                                onChange={(e) => setMedicalNombre(e.target.value)}
                                className="h-9 text-xs md:col-span-2"
                            />
                            <Input
                                type="number"
                                min="0"
                                step="0.5"
                                placeholder="Horas"
                                value={medicalHoras}
                                onChange={(e) => setMedicalHoras(e.target.value)}
                                className="h-9 text-xs"
                            />
                            <Select value={medicalTurno} onValueChange={(v) => setMedicalTurno(v as TurnoId)}>
                                <SelectTrigger className="h-9 text-xs">
                                    <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                    {TURNOS_PM.map(t => (
                                        <SelectItem key={t.id} value={t.id} className="text-xs">{t.label}</SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>
                        <div className="flex justify-end gap-2">
                            <Button variant="outline" size="sm" onClick={() => setShowMedicalForm(false)}>Cancelar</Button>
                            <Button size="sm" onClick={handleAddMedicalAppointment} className="bg-amber-600 hover:bg-amber-700 text-white gap-1.5">
                                <Plus className="w-3.5 h-3.5" />
                                Agregar
                            </Button>
                        </div>
                    </div>
                )}

                {medicalAppointments.length > 0 && (
                    <div className="border border-amber-200 rounded-lg overflow-hidden">
                        <div className="bg-amber-50 px-3 py-1.5">
                            <p className="text-[10px] font-bold text-amber-800 uppercase">
                                Citas Médicas Registradas — Descuento total: {totalMedicalDeduction.toFixed(2)} h
                                (Día: -{medicalDeductionByTurno.dia.toFixed(2)} h · Noche: -{medicalDeductionByTurno.noche.toFixed(2)} h)
                            </p>
                        </div>
                        <ul className="divide-y divide-gray-100">
                            {medicalAppointments.map(m => (
                                <li key={m.id} className="flex items-center justify-between px-3 py-1.5 text-xs">
                                    <span>
                                        <span className="font-semibold text-gray-800">{m.nombre}</span> — {m.horas} h
                                        ({TURNOS_PM.find(t => t.id === m.turno)?.label}) → descuenta{' '}
                                        <span className="font-bold text-amber-700">
                                            {turnoStations[m.turno].size > 0 ? (m.horas / turnoStations[m.turno].size).toFixed(2) : '0.00'} h
                                        </span>
                                    </span>
                                    <button type="button" onClick={() => handleRemoveMedicalAppointment(m.id)} className="text-gray-400 hover:text-red-600">
                                        <X className="w-3.5 h-3.5" />
                                    </button>
                                </li>
                            ))}
                        </ul>
                    </div>
                )}

                {showDiscountForm && (
                    <div className="border border-rose-300 bg-rose-50/50 rounded-lg p-4 space-y-3">
                        <p className="text-xs font-bold text-rose-800 uppercase">Registrar Descuento de Capacidad</p>
                        <p className="text-[10px] text-rose-700">
                            Estas horas se descuentan COMPLETAS de cada mesa activa del turno seleccionado (no se prorratean entre
                            mesas). Ej.: 1 hora de reunión de personal con 5 mesas activas = 5 horas de capacidad descontadas.
                        </p>
                        <div className="grid grid-cols-1 md:grid-cols-4 gap-2">
                            <Input
                                placeholder="Razón del descuento"
                                value={discountRazon}
                                onChange={(e) => setDiscountRazon(e.target.value)}
                                className="h-9 text-xs md:col-span-2"
                            />
                            <Input
                                type="number"
                                min="0"
                                step="0.5"
                                placeholder="Horas"
                                value={discountHoras}
                                onChange={(e) => setDiscountHoras(e.target.value)}
                                className="h-9 text-xs"
                            />
                            <Select value={discountTurno} onValueChange={(v) => setDiscountTurno(v as TurnoId)}>
                                <SelectTrigger className="h-9 text-xs">
                                    <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                    {TURNOS_PM.map(t => (
                                        <SelectItem key={t.id} value={t.id} className="text-xs">{t.label}</SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>
                        <div className="flex justify-end gap-2">
                            <Button variant="outline" size="sm" onClick={() => setShowDiscountForm(false)}>Cancelar</Button>
                            <Button size="sm" onClick={handleAddCapacityDiscount} className="bg-rose-600 hover:bg-rose-700 text-white gap-1.5">
                                <Plus className="w-3.5 h-3.5" />
                                Agregar
                            </Button>
                        </div>
                    </div>
                )}

                {capacityDiscounts.length > 0 && (
                    <div className="border border-rose-200 rounded-lg overflow-hidden">
                        <div className="bg-rose-50 px-3 py-1.5">
                            <p className="text-[10px] font-bold text-rose-800 uppercase">
                                Descuentos de Capacidad Registrados — Descuento total: {totalCapacityDiscount.toFixed(2)} h
                                (Día: -{capacityDiscountByTurno.dia.toFixed(2)} h · Noche: -{capacityDiscountByTurno.noche.toFixed(2)} h)
                            </p>
                        </div>
                        <ul className="divide-y divide-gray-100">
                            {capacityDiscounts.map(d => (
                                <li key={d.id} className="flex items-center justify-between px-3 py-1.5 text-xs">
                                    <span>
                                        <span className="font-semibold text-gray-800">{d.razon}</span> — {d.horas} h/mesa
                                        ({TURNOS_PM.find(t => t.id === d.turno)?.label}) → descuenta{' '}
                                        <span className="font-bold text-rose-700">
                                            {(d.horas * turnoStations[d.turno].size).toFixed(2)} h
                                        </span>{' '}
                                        ({d.horas} h × {turnoStations[d.turno].size} mesa(s))
                                    </span>
                                    <button type="button" onClick={() => handleRemoveCapacityDiscount(d.id)} className="text-gray-400 hover:text-red-600">
                                        <X className="w-3.5 h-3.5" />
                                    </button>
                                </li>
                            ))}
                        </ul>
                    </div>
                )}

                <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
                    {TURNOS_PM.map(turno => {
                        const Icon = turno.icon;
                        const enabled = turnoEnabled[turno.id];
                        const duracionesTurno = getShiftDurationsPara(turno.id);
                        const selectedDuration = duracionesTurno.find(d => d.id === turnoDuration[turno.id]);
                        const durationHours = selectedDuration?.hours ?? 0;
                        // Turno Noche: la hora de inicio real cambia según la duración elegida, y la hora de
                        // salida se calcula con las horas de reloj (displayHours), no con las de cálculo de
                        // capacidad (hours, que ya tienen descontado 1h de receso) — ver SHIFT_DURATIONS_PM_NOCHE.
                        const effectiveStartTime = selectedDuration?.startTime ?? turno.startTime;
                        const endTime = addHoursToTime(effectiveStartTime, selectedDuration?.displayHours ?? durationHours);
                        return (
                            <div key={turno.id} className={cn("border rounded-lg p-4 space-y-3", enabled ? "border-indigo-200 bg-indigo-50/30" : "border-gray-200 bg-gray-50/50")}>
                                <div className="flex items-center justify-between">
                                    <div className="flex items-center gap-2">
                                        <Icon className={cn("w-4 h-4", enabled ? "text-indigo-600" : "text-gray-400")} />
                                        <span className={cn("text-xs font-bold uppercase", enabled ? "text-gray-800" : "text-gray-400")}>{turno.label}</span>
                                        <span className="text-[10px] font-mono text-gray-400">({effectiveStartTime} - {endTime})</span>
                                    </div>
                                    <Switch
                                        checked={enabled}
                                        onCheckedChange={(checked) => setTurnoEnabled(prev => ({ ...prev, [turno.id]: checked }))}
                                    />
                                </div>

                                {enabled && (
                                    <>
                                        <Select value={turnoDuration[turno.id]} onValueChange={(val) => setTurnoDuration(prev => ({ ...prev, [turno.id]: val }))}>
                                            <SelectTrigger className="h-8 text-xs font-semibold">
                                                <SelectValue placeholder="Duración de jornada" />
                                            </SelectTrigger>
                                            <SelectContent>
                                                {duracionesTurno.map(d => (
                                                    <SelectItem key={d.id} value={d.id} className="text-xs">{d.label}</SelectItem>
                                                ))}
                                            </SelectContent>
                                        </Select>

                                        <div className="flex flex-wrap gap-1.5">
                                            {WORK_STATIONS_PM.map(station => {
                                                const active = turnoStations[turno.id].has(station.id);
                                                return (
                                                    <button
                                                        key={station.id}
                                                        type="button"
                                                        onClick={() => toggleTurnoStation(turno.id, station.id)}
                                                        className={cn(
                                                            "px-2.5 py-1 rounded-md text-[10px] font-bold border transition-colors",
                                                            active
                                                                ? "bg-indigo-600 border-indigo-600 text-white"
                                                                : "bg-white border-gray-300 text-gray-500 hover:border-indigo-300"
                                                        )}
                                                    >
                                                        Mesa {station.id}
                                                    </button>
                                                );
                                            })}
                                        </div>
                                        <p className="text-[10px] text-gray-400">
                                            {turnoStations[turno.id].size} mesa(s) × {durationHours} h = {(turnoStations[turno.id].size * durationHours).toFixed(2)} h de capacidad
                                            {medicalDeductionByTurno[turno.id] > 0 && (
                                                <span className="text-amber-600 font-semibold"> (−{medicalDeductionByTurno[turno.id].toFixed(2)} h por citas médicas)</span>
                                            )}
                                            {capacityDiscountByTurno[turno.id] > 0 && (
                                                <span className="text-rose-600 font-semibold"> (−{capacityDiscountByTurno[turno.id].toFixed(2)} h por descuentos de capacidad)</span>
                                            )}
                                        </p>
                                    </>
                                )}
                            </div>
                        );
                    })}

                    <div className={cn("border rounded-lg p-4 space-y-3", adicionalEnabled ? "border-emerald-200 bg-emerald-50/30" : "border-gray-200 bg-gray-50/50")}>
                        <div className="flex items-center justify-between">
                            <div className="flex items-center gap-2">
                                <PlusCircle className={cn("w-4 h-4", adicionalEnabled ? "text-emerald-600" : "text-gray-400")} />
                                <span className={cn("text-xs font-bold uppercase", adicionalEnabled ? "text-gray-800" : "text-gray-400")}>Adicionar al Cálculo</span>
                            </div>
                            <Switch
                                checked={adicionalEnabled}
                                onCheckedChange={setAdicionalEnabled}
                            />
                        </div>

                        {adicionalEnabled && (
                            <>
                                <Input
                                    type="number"
                                    min="0"
                                    step="0.5"
                                    placeholder="Horas a adicionar por mesa"
                                    value={adicionalHoras}
                                    onChange={(e) => setAdicionalHoras(e.target.value)}
                                    className="h-8 text-xs font-semibold"
                                />

                                <div className="flex flex-wrap gap-1.5">
                                    {WORK_STATIONS_PM.map(station => {
                                        const active = adicionalStations.has(station.id);
                                        return (
                                            <button
                                                key={station.id}
                                                type="button"
                                                onClick={() => toggleAdicionalStation(station.id)}
                                                className={cn(
                                                    "px-2.5 py-1 rounded-md text-[10px] font-bold border transition-colors",
                                                    active
                                                        ? "bg-emerald-600 border-emerald-600 text-white"
                                                        : "bg-white border-gray-300 text-gray-500 hover:border-emerald-300"
                                                )}
                                            >
                                                Mesa {station.id}
                                            </button>
                                        );
                                    })}
                                </div>
                                <p className="text-[10px] text-gray-400">
                                    {adicionalStations.size} mesa(s) × {(Number(adicionalHoras) || 0).toFixed(2)} h ={' '}
                                    <span className="text-emerald-600 font-semibold">+{totalAdicionalCapacidad.toFixed(2)} h de capacidad</span>
                                </p>
                            </>
                        )}
                    </div>
                </div>
            </div>

            {hasPlanned && (
                <div className="bg-white border border-gray-200 rounded-xl shadow-md overflow-hidden">
                    <div className="flex items-center justify-between px-6 py-4 bg-gradient-to-r from-purple-900 to-indigo-900">
                        <div className="flex items-center gap-2">
                            <Gauge className="w-5 h-5 text-purple-200" />
                            <h3 className="text-sm font-bold text-white uppercase tracking-wide">Planificación Calculada — Planchas Mixtas</h3>
                        </div>
                        <div className="flex items-center gap-2">
                            <Button
                                onClick={handleExportPlanningPMExcel}
                                size="sm"
                                className="h-8 bg-white/10 hover:bg-white/20 text-white gap-1.5 text-xs"
                            >
                                <FileSpreadsheet className="w-3.5 h-3.5" />
                                Exportar a Excel
                            </Button>
                            <Button
                                onClick={handleDistributePM}
                                size="sm"
                                className="h-8 bg-purple-700 hover:bg-purple-800 text-white gap-1.5 text-xs"
                            >
                                <LayoutGrid className="w-3.5 h-3.5" />
                                DISTRIBUIR EN MESAS DE PEGADO
                            </Button>
                        </div>
                    </div>
                    <div className="p-6 space-y-4">
                        <div className="grid grid-cols-1 md:grid-cols-3 xl:grid-cols-5 gap-4">
                            <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                                <p className="text-[10px] font-bold text-blue-500 uppercase">Horas Requeridas (Obligatorias)</p>
                                <p className="text-xl font-black text-blue-800">{totalHorasRequeridas.toFixed(2)} h</p>
                                <p className="text-[10px] text-blue-400">{pmOrders.length} órdenes (Previsional + Fert, {validRespCodes.join('/')})</p>
                            </div>
                            <div className="bg-cyan-50 border border-cyan-200 rounded-lg p-4">
                                <p className="text-[10px] font-bold text-cyan-500 uppercase">Total Planchas Equivalentes</p>
                                <p className="text-xl font-black text-cyan-800">
                                    {totalPlanchasEquivalentes.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                </p>
                                <p className="text-[10px] text-cyan-400">1 equivalente = {MINUTOS_POR_PLANCHA_EQUIVALENTE} min</p>
                            </div>
                            <div className="bg-emerald-50 border border-emerald-200 rounded-lg p-4">
                                <p className="text-[10px] font-bold text-emerald-500 uppercase">Capacidad Disponible</p>
                                <p className="text-xl font-black text-emerald-800">{capacidadDisponibleAjustada.toFixed(2)} h</p>
                                <p className="text-[10px] text-emerald-400">
                                    {activeSlots.length} mesa(s)-turno activas
                                    {totalMedicalDeduction > 0 && ` · ya descuenta ${totalMedicalDeduction.toFixed(2)} h de citas médicas`}
                                    {totalCapacityDiscount > 0 && ` · ya descuenta ${totalCapacityDiscount.toFixed(2)} h de descuentos de capacidad`}
                                    {totalAdicionalCapacidad > 0 && ` · ya suma ${totalAdicionalCapacidad.toFixed(2)} h de adición al cálculo`}
                                </p>
                            </div>
                            <div className={cn(
                                "border rounded-lg p-4",
                                capacidadDisponibleAjustada >= totalHorasEfectivas ? "bg-emerald-50 border-emerald-200" : "bg-red-50 border-red-200"
                            )}>
                                <p className={cn("text-[10px] font-bold uppercase", capacidadDisponibleAjustada >= totalHorasEfectivas ? "text-emerald-500" : "text-red-500")}>
                                    {capacidadDisponibleAjustada >= totalHorasEfectivas ? 'Capacidad Sobrante' : 'Déficit de Capacidad'}
                                </p>
                                <p className={cn("text-xl font-black", capacidadDisponibleAjustada >= totalHorasEfectivas ? "text-emerald-800" : "text-red-800")}>
                                    {Math.abs(capacidadDisponibleAjustada - totalHorasEfectivas).toFixed(2)} h
                                </p>
                                {horasPropuestaAceptada > 0 && (
                                    <p className="text-[10px] text-gray-500">incluye {horasPropuestaAceptada.toFixed(2)} h de propuesta aceptada</p>
                                )}
                            </div>
                            <div className="bg-indigo-50 border border-indigo-200 rounded-lg p-4">
                                <p className="text-[10px] font-bold text-indigo-500 uppercase">Total Planchas Físicas</p>
                                <p className="text-xl font-black text-indigo-800">{totalCantidadRequerida.toLocaleString()}</p>
                                <p className="text-[10px] text-indigo-400">planchas a fabricar (obligatorias + propuesta aceptada)</p>
                            </div>
                        </div>

                        <div className="bg-fuchsia-50 border border-fuchsia-200 rounded-lg p-4 flex items-center justify-between gap-4 flex-wrap">
                            <div>
                                <p className="text-[10px] font-bold text-fuchsia-500 uppercase">Horas Requeridas por Mesa</p>
                                <p className="text-[10px] text-fuchsia-400">
                                    {totalHorasRequeridas.toFixed(2)} h (Obligatorias) ÷ {activeSlots.length} mesa(s)-turno escogida(s)
                                </p>
                            </div>
                            <p className="text-2xl font-black text-fuchsia-800">
                                {activeSlots.length > 0 ? `${horasPorMesa.toFixed(2)} h` : '— (sin mesas escogidas)'}
                            </p>
                        </div>

                        <div className="border border-gray-300 rounded-lg overflow-auto max-h-[40vh]">
                            <Table>
                                <TableHeader>
                                    <TableRow className="bg-gray-100 hover:bg-gray-100 border-b-2 border-gray-300 sticky top-0 z-10">
                                        <TableHead className="text-[10px] font-extrabold text-gray-600 uppercase border-r border-gray-200">Origen</TableHead>
                                        <TableHead className="text-[10px] font-extrabold text-gray-600 uppercase border-r border-gray-200">N° Orden</TableHead>
                                        <TableHead className="text-[10px] font-extrabold text-gray-600 uppercase border-r border-gray-200">Material / Nombre</TableHead>
                                        <TableHead className="text-[10px] font-extrabold text-gray-600 uppercase text-center border-r border-gray-200">Tipo</TableHead>
                                        <TableHead className="text-[10px] font-extrabold text-gray-600 uppercase text-center border-r border-gray-200">Fecha</TableHead>
                                        <TableHead className="text-[10px] font-extrabold text-gray-600 uppercase text-center border-r border-gray-200">Cantidad</TableHead>
                                        <TableHead className="text-[10px] font-extrabold text-gray-600 uppercase text-center">Horas</TableHead>
                                    </TableRow>
                                </TableHeader>
                                <TableBody>
                                    {pmOrders.map((o, idx) => (
                                        <TableRow key={`${o.source}-${o.id}-${o.material}-${idx}`} className={cn("border-b border-gray-200", idx % 2 === 1 && "bg-gray-50/70")}>
                                            <TableCell className="text-[11px] text-center border-r border-gray-200 font-semibold text-gray-600">{o.source}</TableCell>
                                            <TableCell className="text-[11px] border-r border-gray-200 font-mono text-gray-700">{o.id || '—'}</TableCell>
                                            <TableCell className="text-[11px] border-r border-gray-200">
                                                <span className="font-semibold text-gray-800">{o.material}</span>
                                                <span className="block text-gray-500">{o.nombre}</span>
                                            </TableCell>
                                            <TableCell className="text-[11px] text-center border-r border-gray-200">{o.tipo}</TableCell>
                                            <TableCell className="text-[11px] text-center border-r border-gray-200 font-mono">{o.fecha}</TableCell>
                                            <TableCell className="text-[11px] text-center border-r border-gray-200 font-semibold">{o.cantidad}</TableCell>
                                            <TableCell className="text-[11px] text-center font-mono font-bold text-blue-700">{o.horas.toFixed(2)}</TableCell>
                                        </TableRow>
                                    ))}
                                </TableBody>
                            </Table>
                        </div>
                    </div>
                </div>
            )}

            {hasPlanned && capacityProposal.length > 0 && (
                <div className="bg-white border border-orange-200 rounded-xl shadow-md overflow-hidden">
                    <div className="flex items-center gap-2 px-6 py-4 bg-gradient-to-r from-orange-600 to-amber-600">
                        <Lightbulb className="w-5 h-5 text-orange-100" />
                        <h3 className="text-sm font-bold text-white uppercase tracking-wide">Propuesta de Ajuste de Capacidad</h3>
                    </div>
                    <div className="p-6 space-y-3">
                        <p className="text-xs text-gray-600">
                            La utilización actual de la capacidad es{' '}
                            <span className={cn("font-bold", utilizacionActualPct > 100 ? "text-red-600" : "text-amber-600")}>
                                {Number.isFinite(utilizacionActualPct) ? `${utilizacionActualPct.toFixed(1)}%` : '—'}
                            </span>{' '}
                            ({utilizacionActualPct > 100 ? 'déficit de capacidad' : 'capacidad sobrante/desperdiciada'}). Estas opciones
                            acercarían la utilización a un rango más eficiente ({UTILIZACION_EFICIENTE_MIN}%-{UTILIZACION_EFICIENTE_MAX}%).
                            Ajustar el <span className="font-semibold">turno</span> tiene prioridad; ajustar{' '}
                            <span className="font-semibold">mesas</span> es una segunda opción, ya que las mesas activas se definen
                            semanalmente según las vacaciones del personal de Prensado.
                        </p>
                        <div className="space-y-2">
                            {capacityProposal.map(option => (
                                <label
                                    key={option.id}
                                    className={cn(
                                        "flex items-center justify-between gap-4 border rounded-lg p-3 cursor-pointer transition-colors",
                                        selectedProposalId === option.id ? "border-orange-400 bg-orange-50" : "border-gray-200 hover:border-orange-200"
                                    )}
                                >
                                    <div className="flex items-center gap-3">
                                        <input
                                            type="radio"
                                            name="capacity-proposal"
                                            checked={selectedProposalId === option.id}
                                            onChange={() => handleApplyCapacityProposal(option)}
                                            className="accent-orange-600 w-4 h-4"
                                        />
                                        <div>
                                            <p className="text-xs font-semibold text-gray-800">
                                                {option.tipo === 'turno' ? 'Ajustar Turno (prioridad)' : 'Ajustar Mesas (2da opción)'}
                                            </p>
                                            <p className="text-[11px] text-gray-500">{option.descripcion}</p>
                                        </div>
                                    </div>
                                    <div className="text-right shrink-0">
                                        <p className={cn(
                                            "text-sm font-black",
                                            option.utilizacionPct > UTILIZACION_EFICIENTE_MAX ? "text-red-600"
                                                : option.utilizacionPct < UTILIZACION_EFICIENTE_MIN ? "text-amber-600"
                                                : "text-emerald-600"
                                        )}>
                                            {option.utilizacionPct.toFixed(1)}%
                                        </p>
                                        <p className="text-[9px] text-gray-400">utilización</p>
                                    </div>
                                </label>
                            ))}
                        </div>
                    </div>
                </div>
            )}

            {hasPlanned && proposedFillOrders.length > 0 && (
                <div className="bg-white border border-purple-200 rounded-xl shadow-md overflow-hidden">
                    <div className="flex items-center gap-2 px-6 py-4 bg-gradient-to-r from-purple-700 to-fuchsia-700">
                        <CheckSquare className="w-5 h-5 text-purple-100" />
                        <h3 className="text-sm font-bold text-white uppercase tracking-wide">Propuesta de Relleno de Capacidad</h3>
                    </div>
                    <div className="p-6 space-y-3">
                        <p className="text-xs text-gray-600">
                            Hay capacidad sobrante hoy. Se proponen estas órdenes previsionales de días posteriores (las más próximas
                            primero) para completarla. Todas están aceptadas por defecto — desmarque las que no quiera incluir.
                            Horas aceptadas: <span className="font-bold text-purple-700">{horasPropuestaAceptada.toFixed(2)} h</span> de{' '}
                            {proposedFillOrders.reduce((s, o) => s + o.horas, 0).toFixed(2)} h propuestas.
                        </p>
                        <div className="border border-gray-300 rounded-lg overflow-auto max-h-[40vh]">
                            <Table>
                                <TableHeader>
                                    <TableRow className="bg-gray-100 hover:bg-gray-100 border-b-2 border-gray-300 sticky top-0 z-10">
                                        <TableHead className="text-[10px] font-extrabold text-gray-600 uppercase text-center border-r border-gray-200 w-10">Aceptar</TableHead>
                                        <TableHead className="text-[10px] font-extrabold text-gray-600 uppercase border-r border-gray-200">N° Orden</TableHead>
                                        <TableHead className="text-[10px] font-extrabold text-gray-600 uppercase border-r border-gray-200">Material / Nombre</TableHead>
                                        <TableHead className="text-[10px] font-extrabold text-gray-600 uppercase text-center border-r border-gray-200">Fecha Original</TableHead>
                                        <TableHead className="text-[10px] font-extrabold text-gray-600 uppercase text-center border-r border-gray-200">Cantidad</TableHead>
                                        <TableHead className="text-[10px] font-extrabold text-gray-600 uppercase text-center">Horas</TableHead>
                                    </TableRow>
                                </TableHeader>
                                <TableBody>
                                    {proposedFillOrders.map((o, idx) => {
                                        const accepted = !rejectedFillIds.has(o.id);
                                        return (
                                            <TableRow key={`${o.id}-${o.material}-${idx}`} className={cn("border-b border-gray-200", idx % 2 === 1 && "bg-gray-50/70", !accepted && "opacity-50")}>
                                                <TableCell className="text-center border-r border-gray-200">
                                                    <Checkbox checked={accepted} onCheckedChange={() => toggleFillOrderAccepted(o.id)} />
                                                </TableCell>
                                                <TableCell className="text-[11px] border-r border-gray-200 font-mono text-gray-700">{o.id || '—'}</TableCell>
                                                <TableCell className="text-[11px] border-r border-gray-200">
                                                    <span className="font-semibold text-gray-800">{o.material}</span>
                                                    <span className="block text-gray-500">{o.nombre}</span>
                                                </TableCell>
                                                <TableCell className="text-[11px] text-center border-r border-gray-200 font-mono">{o.fecha}</TableCell>
                                                <TableCell className="text-[11px] text-center border-r border-gray-200 font-semibold">{o.cantidad}</TableCell>
                                                <TableCell className="text-[11px] text-center font-mono font-bold text-purple-700">{o.horas.toFixed(2)}</TableCell>
                                            </TableRow>
                                        );
                                    })}
                                </TableBody>
                            </Table>
                        </div>
                    </div>
                </div>
            )}

            {pmDistribution && pmDistribution.size > 0 && (
                <div className="bg-white border border-gray-200 rounded-xl shadow-md overflow-hidden">
                    <div className="flex items-center justify-between px-6 py-4 bg-gradient-to-r from-slate-900 to-purple-900">
                        <div className="flex items-center gap-2">
                            <LayoutGrid className="w-5 h-5 text-purple-200" />
                            <h3 className="text-sm font-bold text-white uppercase tracking-wide">Distribución Equitativa — Mesas de Pegado</h3>
                        </div>
                        <div className="flex items-center gap-2">
                            <Button
                                onClick={handleExportDistribucionMesasExcel}
                                size="sm"
                                className="h-8 bg-emerald-600 hover:bg-emerald-700 text-white gap-1.5 text-xs"
                            >
                                <FileSpreadsheet className="w-3.5 h-3.5" />
                                Descargar Excel
                            </Button>
                            <Button
                                onClick={handleMaterialExplosionPM}
                                disabled={isExplodingMaterials}
                                size="sm"
                                className="h-8 bg-orange-600 hover:bg-orange-700 text-white gap-1.5 text-xs"
                            >
                                {isExplodingMaterials ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <PackageSearch className="w-3.5 h-3.5" />}
                                Explosión de Materiales
                            </Button>
                        </div>
                    </div>
                    <div className="p-6 space-y-6">
                        {TURNOS_PM.filter(turno => turnoEnabled[turno.id]).map(turno => {
                            const Icon = turno.icon;
                            const slots = Array.from(pmDistribution.values()).filter(s => s.turno === turno.id);
                            if (slots.length === 0) return null;
                            return (
                                <div key={turno.id} className="space-y-3">
                                    <h4 className="text-xs font-extrabold text-gray-700 uppercase tracking-wide border-b border-dashed border-gray-300 pb-1 flex items-center gap-1.5">
                                        <Icon className="w-3.5 h-3.5" />
                                        {turno.label}
                                    </h4>
                                    <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-5 gap-4">
                                        {slots.map(station => {
                                            const pctReal = station.capacityHours > 0 ? (station.usedHours / station.capacityHours) * 100 : 0;
                                            const pct = Math.min(100, pctReal);
                                            const overflow = station.usedHours > station.capacityHours;
                                            return (
                                                <div key={slotKey(station.turno, station.stationId)} className="border border-gray-200 rounded-lg p-3 space-y-2">
                                                    <div className="flex items-center justify-between">
                                                        <p className="text-xs font-bold text-gray-800">{WORK_STATIONS_PM.find(s => s.id === station.stationId)?.name}</p>
                                                        <span className="text-[10px] font-mono text-gray-500">{station.items.length} ord.</span>
                                                    </div>
                                                    <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
                                                        <div
                                                            className={cn("h-full rounded-full", overflow ? "bg-red-500" : "bg-purple-600")}
                                                            style={{ width: `${pct}%` }}
                                                        />
                                                    </div>
                                                    <div className="flex items-center justify-between">
                                                        <p className={cn("text-[10px] font-mono", overflow ? "text-red-600 font-bold" : "text-gray-500")}>
                                                            {station.usedHours.toFixed(2)} / {station.capacityHours.toFixed(2)} h
                                                        </p>
                                                        <p className={cn("text-[10px] font-mono font-bold", overflow ? "text-red-600" : "text-gray-500")}>
                                                            {pctReal.toFixed(2)}%
                                                        </p>
                                                    </div>
                                                    <div className="max-h-32 overflow-auto space-y-1 pt-1 border-t border-dashed border-gray-200">
                                                        {station.items.map((item, idx) => (
                                                            <p key={`${item.id}-${idx}`} className="text-[9px] text-gray-600 truncate" title={`${item.material} — ${item.nombre} (${item.horas.toFixed(2)} h)`}>
                                                                <span className="font-mono font-semibold">{item.material}</span> — {item.cantidad} ud. ({item.horas.toFixed(2)} h)
                                                            </p>
                                                        ))}
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
            )}

            {laminaEspumaResults.length > 0 && (
                <div className="bg-white border border-gray-200 rounded-xl shadow-md overflow-hidden">
                    <div className="flex items-center justify-between gap-2 px-6 py-4 bg-gradient-to-r from-orange-700 to-amber-700">
                        <div className="flex items-center gap-2">
                            <Layers className="w-5 h-5 text-orange-100" />
                            <h3 className="text-sm font-bold text-white uppercase tracking-wide">Explosión de Materiales — Láminas de Espuma (RESPCTRLPROD 013)</h3>
                        </div>
                        <Button
                            onClick={() => exportComponentNeedsToExcelPM(laminaEspumaResults, 'Laminas Espuma', 'Explosion_Materiales_Laminas_Espuma')}
                            size="sm"
                            className="h-8 bg-white/10 hover:bg-white/20 text-white gap-1.5 text-xs shrink-0"
                        >
                            <FileSpreadsheet className="w-3.5 h-3.5" />
                            Exportar a Excel
                        </Button>
                    </div>
                    <div className="p-6">
                        <div className="border border-gray-300 rounded-lg overflow-auto max-h-[50vh]">
                            <Table>
                                <TableHeader>
                                    <TableRow className="bg-gray-100 hover:bg-gray-100 border-b-2 border-gray-300 sticky top-0 z-10">
                                        <TableHead className="text-[10px] font-extrabold text-gray-600 uppercase border-r border-gray-200">Componente</TableHead>
                                        <TableHead className="text-[10px] font-extrabold text-gray-600 uppercase border-r border-gray-200">Descripción</TableHead>
                                        <TableHead className="text-[10px] font-extrabold text-gray-600 uppercase text-center border-r border-gray-200">Unidad</TableHead>
                                        <TableHead className="text-[10px] font-extrabold text-gray-600 uppercase text-center border-r border-gray-200">Cantidad Total Necesaria</TableHead>
                                        <TableHead className="text-[10px] font-extrabold text-gray-600 uppercase text-center border-r border-gray-200">Stock Actual</TableHead>
                                        <TableHead className="text-[10px] font-extrabold text-gray-600 uppercase text-center border-r border-gray-200">Consumo Órdenes Pasadas</TableHead>
                                        <TableHead className="text-[10px] font-extrabold text-gray-600 uppercase text-center border-r border-gray-200">Producción Propia Pendiente</TableHead>
                                        <TableHead className="text-[10px] font-extrabold text-gray-600 uppercase text-center border-r border-gray-200">Disponible Real</TableHead>
                                        <TableHead className="text-[10px] font-extrabold text-gray-600 uppercase text-center">Cantidad Neta Requerida</TableHead>
                                    </TableRow>
                                </TableHeader>
                                <TableBody>
                                    {laminaEspumaResults.map((comp, idx) => (
                                        <TableRow key={comp.componente} className={cn("border-b border-gray-200", idx % 2 === 1 && "bg-gray-50/70")}>
                                            <TableCell className="text-[11px] font-mono font-semibold text-gray-800 border-r border-gray-200">{comp.componente}</TableCell>
                                            <TableCell className="text-[11px] text-gray-700 border-r border-gray-200">{comp.descripcion}</TableCell>
                                            <TableCell className="text-[11px] text-center text-gray-600 border-r border-gray-200">{comp.unidad}</TableCell>
                                            <TableCell className="text-[11px] text-center font-mono text-gray-700 border-r border-gray-200">
                                                {comp.totalNecesario.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                            </TableCell>
                                            <TableCell className="text-[11px] text-center font-mono text-gray-600 border-r border-gray-200">
                                                {comp.stockActual !== null ? comp.stockActual.toLocaleString() : '—'}
                                            </TableCell>
                                            <TableCell className="text-[11px] text-center font-mono text-gray-600 border-r border-gray-200">
                                                {comp.consumoOrdenesPasadas.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                            </TableCell>
                                            <TableCell className="text-[11px] text-center font-mono text-gray-600 border-r border-gray-200">
                                                {comp.produccionPropiaPendiente.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                            </TableCell>
                                            <TableCell className="text-[11px] text-center font-mono text-gray-600 border-r border-gray-200">
                                                {comp.disponibleReal !== null ? comp.disponibleReal.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : '—'}
                                            </TableCell>
                                            <TableCell className="text-[11px] text-center font-mono font-bold text-orange-700">
                                                {comp.cantidadNetaAConseguir.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                            </TableCell>
                                        </TableRow>
                                    ))}
                                </TableBody>
                                <TableFooter className="sticky bottom-0">
                                    <TableRow className="bg-orange-50 hover:bg-orange-50 border-t-2 border-orange-300">
                                        <TableCell colSpan={8} className="text-[11px] font-extrabold text-orange-900 uppercase text-right border-r border-orange-200">Total General (Neto Requerido)</TableCell>
                                        <TableCell className="text-[11px] text-center font-mono font-extrabold text-orange-900">
                                            {laminaEspumaResults.reduce((s, c) => s + c.cantidadNetaAConseguir, 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                        </TableCell>
                                    </TableRow>
                                </TableFooter>
                            </Table>
                        </div>
                    </div>
                </div>
            )}

            {laminaPrensadaResults.length > 0 && (
                <div className="bg-white border border-gray-200 rounded-xl shadow-md overflow-hidden">
                    <div className="flex items-center justify-between gap-2 px-6 py-4 bg-gradient-to-r from-teal-700 to-cyan-700">
                        <div className="flex items-center gap-2">
                            <Layers className="w-5 h-5 text-teal-100" />
                            <h3 className="text-sm font-bold text-white uppercase tracking-wide">Explosión de Materiales — Láminas Prensadas (RESPCTRLPROD 017)</h3>
                        </div>
                        <Button
                            onClick={() => exportComponentNeedsToExcelPM(laminaPrensadaResults, 'Laminas Prensadas', 'Explosion_Materiales_Laminas_Prensadas')}
                            size="sm"
                            className="h-8 bg-white/10 hover:bg-white/20 text-white gap-1.5 text-xs shrink-0"
                        >
                            <FileSpreadsheet className="w-3.5 h-3.5" />
                            Exportar a Excel
                        </Button>
                    </div>
                    <div className="p-6">
                        <div className="border border-gray-300 rounded-lg overflow-auto max-h-[50vh]">
                            <Table>
                                <TableHeader>
                                    <TableRow className="bg-gray-100 hover:bg-gray-100 border-b-2 border-gray-300 sticky top-0 z-10">
                                        <TableHead className="text-[10px] font-extrabold text-gray-600 uppercase border-r border-gray-200">Componente</TableHead>
                                        <TableHead className="text-[10px] font-extrabold text-gray-600 uppercase border-r border-gray-200">Descripción</TableHead>
                                        <TableHead className="text-[10px] font-extrabold text-gray-600 uppercase text-center border-r border-gray-200">Unidad</TableHead>
                                        <TableHead className="text-[10px] font-extrabold text-gray-600 uppercase text-center border-r border-gray-200">Cantidad Total Necesaria</TableHead>
                                        <TableHead className="text-[10px] font-extrabold text-gray-600 uppercase text-center border-r border-gray-200">Stock Actual</TableHead>
                                        <TableHead className="text-[10px] font-extrabold text-gray-600 uppercase text-center border-r border-gray-200">Consumo Órdenes Pasadas</TableHead>
                                        <TableHead className="text-[10px] font-extrabold text-gray-600 uppercase text-center border-r border-gray-200">Producción Propia Pendiente</TableHead>
                                        <TableHead className="text-[10px] font-extrabold text-gray-600 uppercase text-center border-r border-gray-200">Disponible Real</TableHead>
                                        <TableHead className="text-[10px] font-extrabold text-gray-600 uppercase text-center">Cantidad Neta Requerida</TableHead>
                                    </TableRow>
                                </TableHeader>
                                <TableBody>
                                    {laminaPrensadaResults.map((comp, idx) => (
                                        <TableRow key={comp.componente} className={cn("border-b border-gray-200", idx % 2 === 1 && "bg-gray-50/70")}>
                                            <TableCell className="text-[11px] font-mono font-semibold text-gray-800 border-r border-gray-200">{comp.componente}</TableCell>
                                            <TableCell className="text-[11px] text-gray-700 border-r border-gray-200">{comp.descripcion}</TableCell>
                                            <TableCell className="text-[11px] text-center text-gray-600 border-r border-gray-200">{comp.unidad}</TableCell>
                                            <TableCell className="text-[11px] text-center font-mono text-gray-700 border-r border-gray-200">
                                                {comp.totalNecesario.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                            </TableCell>
                                            <TableCell className="text-[11px] text-center font-mono text-gray-600 border-r border-gray-200">
                                                {comp.stockActual !== null ? comp.stockActual.toLocaleString() : '—'}
                                            </TableCell>
                                            <TableCell className="text-[11px] text-center font-mono text-gray-600 border-r border-gray-200">
                                                {comp.consumoOrdenesPasadas.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                            </TableCell>
                                            <TableCell className="text-[11px] text-center font-mono text-gray-600 border-r border-gray-200">
                                                {comp.produccionPropiaPendiente.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                            </TableCell>
                                            <TableCell className="text-[11px] text-center font-mono text-gray-600 border-r border-gray-200">
                                                {comp.disponibleReal !== null ? comp.disponibleReal.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : '—'}
                                            </TableCell>
                                            <TableCell className="text-[11px] text-center font-mono font-bold text-teal-700">
                                                {comp.cantidadNetaAConseguir.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                            </TableCell>
                                        </TableRow>
                                    ))}
                                </TableBody>
                                <TableFooter className="sticky bottom-0">
                                    <TableRow className="bg-teal-50 hover:bg-teal-50 border-t-2 border-teal-300">
                                        <TableCell colSpan={8} className="text-[11px] font-extrabold text-teal-900 uppercase text-right border-r border-teal-200">Total General (Neto Requerido)</TableCell>
                                        <TableCell className="text-[11px] text-center font-mono font-extrabold text-teal-900">
                                            {laminaPrensadaResults.reduce((s, c) => s + c.cantidadNetaAConseguir, 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                        </TableCell>
                                    </TableRow>
                                </TableFooter>
                            </Table>
                        </div>
                    </div>
                </div>
            )}

            {(laminaPrensadaResults.length > 0 || laminaEspumaResults.length > 0) && (
                <button
                    type="button"
                    onClick={handleSavePlanTacticoPM}
                    disabled={isSavingPlan}
                    title="Guardar Plan Táctico y sus Detalles"
                    className="fixed bottom-6 right-6 z-50 flex items-center gap-2 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-60 disabled:cursor-not-allowed text-white font-bold text-sm px-5 py-3.5 rounded-full shadow-xl shadow-emerald-900/30 transition-colors"
                >
                    {isSavingPlan ? <Loader2 className="w-5 h-5 animate-spin" /> : <Save className="w-5 h-5" />}
                    {isSavingPlan ? 'Guardando Plan...' : 'Guardar Plan Táctico'}
                </button>
            )}

            {/* Ventana de progreso de "Actualizar Datos" (misma que "Planificación Táctica Muebles") */}
            <Dialog open={isLoading}>
                <DialogContent
                    className="max-w-md"
                    hideCloseButton
                    onInteractOutside={(e) => e.preventDefault()}
                    onEscapeKeyDown={(e) => e.preventDefault()}
                >
                    <DialogHeader>
                        <DialogTitle className="flex items-center gap-2">
                            <Loader2 className="w-5 h-5 animate-spin text-indigo-600" />
                            Actualizando datos desde SAP...
                        </DialogTitle>
                        <DialogDescription>
                            No cierre ni recargue la página mientras se descargan y cruzan los datos.
                        </DialogDescription>
                    </DialogHeader>

                    <div className="space-y-4 py-2">
                        <div>
                            <div className="flex justify-between text-xs font-bold text-gray-600 mb-1">
                                <span>Progreso general</span>
                                <span>{overallLoadPercent}%</span>
                            </div>
                            <Progress value={overallLoadPercent} />
                        </div>

                        <ul className="space-y-2.5">
                            {loadStages.map(stage => (
                                <li key={stage.key} className="flex items-center gap-2.5 text-xs">
                                    {stage.status === 'done' ? (
                                        <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                                    ) : stage.status === 'loading' ? (
                                        <Loader2 className="w-4 h-4 animate-spin text-indigo-600 shrink-0" />
                                    ) : (
                                        <Circle className="w-4 h-4 text-gray-300 shrink-0" />
                                    )}
                                    <span className={cn(
                                        'flex-1',
                                        stage.status === 'done' ? 'text-gray-500' : stage.status === 'loading' ? 'font-bold text-gray-800' : 'text-gray-400'
                                    )}>
                                        {stage.label}
                                    </span>
                                    {stage.status !== 'pending' && (
                                        <span className="text-gray-400 tabular-nums">
                                            {stage.current.toLocaleString()}{stage.total > 0 ? ` / ${stage.total.toLocaleString()}` : ''}
                                        </span>
                                    )}
                                </li>
                            ))}
                        </ul>
                    </div>
                </DialogContent>
            </Dialog>

            {/* No existe un Plan Táctico guardado para la fecha objetivo: confirmar antes de proceder */}
            <AlertDialog open={planCheckModal?.type === 'not-found'} onOpenChange={(open) => !open && setPlanCheckModal(null)}>
                <AlertDialogContent>
                    <AlertDialogHeader>
                        <AlertDialogTitle>Verificación de Plan Táctico</AlertDialogTitle>
                        <AlertDialogDescription>
                            No existe Plan Táctico Guardado del Grupo Prensado con fecha objetivo{' '}
                            <span className="font-bold text-gray-800">{fechaObjetivoPM}</span>.
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                        <Button variant="outline" onClick={() => setPlanCheckModal(null)}>CANCELAR</Button>
                        <AlertDialogAction onClick={confirmRunPlanning}>PROCEDER</AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>

            {/* Ya existe(n) Plan(es) Táctico(s) guardado(s) para la fecha objetivo: Vista o Borrar */}
            <AlertDialog open={planCheckModal?.type === 'found'} onOpenChange={(open) => !open && setPlanCheckModal(null)}>
                <AlertDialogContent>
                    <AlertDialogHeader>
                        <AlertDialogTitle className="flex items-center gap-2 text-amber-700">
                            <TriangleAlert className="w-5 h-5" />
                            Ya existe un Plan Táctico guardado
                        </AlertDialogTitle>
                        <AlertDialogDescription>
                            Ya existe Plan Táctico Guardado del Grupo Prensado con fecha objetivo{' '}
                            <span className="font-bold text-gray-800">{fechaObjetivoPM}</span>{' '}
                            ({planCheckModal?.type === 'found' ? planCheckModal.planesGrupo.map(p => p.valor).join(', ') : ''}). Escoja qué desea hacer:
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter className="sm:justify-between">
                        <Button variant="outline" onClick={() => setPlanCheckModal(null)} disabled={isPlanCheckBusy}>CANCELAR</Button>
                        <div className="flex flex-col-reverse sm:flex-row gap-2">
                            <Button
                                variant="outline"
                                className="border-red-300 text-red-700 hover:bg-red-50"
                                onClick={handleDeleteExistingPlan}
                                disabled={isPlanCheckBusy}
                            >
                                {isPlanCheckBusy ? <Loader2 className="w-4 h-4 animate-spin mr-1.5" /> : null}
                                Borrar Plan(es) Guardado(s)
                            </Button>
                            <AlertDialogAction onClick={handleActivateVistaMode} disabled={isPlanCheckBusy}>
                                {isPlanCheckBusy ? <Loader2 className="w-4 h-4 animate-spin mr-1.5" /> : null}
                                Activar Modo Vista
                            </AlertDialogAction>
                        </div>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>

            {/* Modo Vista: detalle de materiales realmente guardado para el/los Plan(es) Táctico(s) encontrado(s) */}
            <Dialog open={planCheckModal?.type === 'vista'} onOpenChange={(open) => !open && setPlanCheckModal(null)}>
                <DialogContent className="max-w-3xl">
                    <DialogHeader>
                        <DialogTitle>Modo Vista — Plan Táctico Guardado</DialogTitle>
                        <DialogDescription>
                            {planCheckModal?.type === 'vista' ? planCheckModal.planesGrupo.map(p => p.valor).join(', ') : ''} — solo se
                            muestra el detalle de materiales que realmente quedó guardado (Componente, Cantidad, Resp. Ctrl. Prod.). No
                            se guardaron las órdenes, la distribución en mesas ni la configuración de turnos de ese momento.
                        </DialogDescription>
                    </DialogHeader>
                    {planCheckModal?.type === 'vista' && (
                        <div className="border border-gray-300 rounded-lg overflow-auto max-h-[55vh]">
                            <Table>
                                <TableHeader>
                                    <TableRow className="bg-gray-100 hover:bg-gray-100 border-b-2 border-gray-300 sticky top-0">
                                        <TableHead className="text-[10px] font-extrabold text-gray-600 uppercase border-r border-gray-200">Material</TableHead>
                                        <TableHead className="text-[10px] font-extrabold text-gray-600 uppercase text-center border-r border-gray-200">Cantidad Producción Neta</TableHead>
                                        <TableHead className="text-[10px] font-extrabold text-gray-600 uppercase text-center border-r border-gray-200">Resp. Ctrl. Prod.</TableHead>
                                        <TableHead className="text-[10px] font-extrabold text-gray-600 uppercase text-center border-r border-gray-200">Clasificación</TableHead>
                                        <TableHead className="text-[10px] font-extrabold text-gray-600 uppercase">Plan</TableHead>
                                    </TableRow>
                                </TableHeader>
                                <TableBody>
                                    {planCheckModal.detalles.map((d, idx) => {
                                        const plan = planCheckModal.planesGrupo.find(p => p.codigo_plan_grupo === d.codigo_plan_grupo);
                                        return (
                                            <TableRow key={d.codigo_detalle_tactico} className={cn("border-b border-gray-200", idx % 2 === 1 && "bg-gray-50/70")}>
                                                <TableCell className="text-[11px] font-mono font-semibold text-gray-800 border-r border-gray-200">{d.codigo_material}</TableCell>
                                                <TableCell className="text-[11px] text-center font-mono font-bold text-indigo-700 border-r border-gray-200">{d.cantidad_produccion_neta}</TableCell>
                                                <TableCell className="text-[11px] text-center border-r border-gray-200">{d.resp_ctrl_prod || '—'}</TableCell>
                                                <TableCell className="text-[11px] text-center border-r border-gray-200">
                                                    {d.resp_ctrl_prod === '017' ? 'Láminas Prensadas' : d.resp_ctrl_prod === '013' ? 'Láminas de Espuma' : '—'}
                                                </TableCell>
                                                <TableCell className="text-[11px]">{plan?.valor || `#${d.codigo_plan_grupo}`}</TableCell>
                                            </TableRow>
                                        );
                                    })}
                                    {planCheckModal.detalles.length === 0 && (
                                        <TableRow>
                                            <TableCell colSpan={5} className="text-center py-6 text-gray-400 text-xs">
                                                Este Plan Táctico no tiene Detalles Tácticos asociados.
                                            </TableCell>
                                        </TableRow>
                                    )}
                                </TableBody>
                            </Table>
                        </div>
                    )}
                </DialogContent>
            </Dialog>

            {/* Confirmación antes de reiniciar toda la planificación en curso */}
            <AlertDialog open={showNuevaPlanificacionConfirm} onOpenChange={setShowNuevaPlanificacionConfirm}>
                <AlertDialogContent>
                    <AlertDialogHeader>
                        <AlertDialogTitle className="flex items-center gap-2 text-amber-700">
                            <RotateCcw className="w-5 h-5" />
                            ¿Iniciar una Planificación Nueva?
                        </AlertDialogTitle>
                        <AlertDialogDescription>
                            Esto reinicia los turnos habilitados, las mesas escogidas, las citas médicas, los descuentos de capacidad, la
                            planificación calculada, la distribución de mesas y la explosión de materiales de esta sesión. No se borra
                            nada de lo ya guardado en SAP ni en Plan Táctico — solo el progreso que no ha guardado todavía.
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                        <Button variant="outline" onClick={() => setShowNuevaPlanificacionConfirm(false)}>CANCELAR</Button>
                        <AlertDialogAction onClick={handleNuevaPlanificacion}>SÍ, EMPEZAR DE NUEVO</AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>
        </div>
    );
};
