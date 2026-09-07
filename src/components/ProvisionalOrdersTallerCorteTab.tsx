'use client';

import React, { useState, useEffect, useMemo, useCallback } from 'react';
import * as XLSX from 'xlsx';
import { serviciosService } from '@/services/servicios.service';
import { ecuadorHolidaysService } from '@/services/ecuador-holidays.service';
import { useAppContext } from '@/context/AppProvider';
import { Loader2, PlayCircle, LayoutGrid, Gauge, Clock, Sun, Moon, RefreshCw, TriangleAlert, Scissors, FileSpreadsheet, Download, BedDouble } from 'lucide-react';
import { Table, TableHeader, TableBody, TableFooter, TableRow, TableHead, TableCell } from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { cn } from '@/lib/utils';

const normalizeMaterialCode = (code: string | number): string => String(code).trim().slice(-8);

// Centro de fabricación del Taller de Corte para la Planificación (Quito)
const CENTRO_TC = '1000';

// Responsable de Control de Fabricación de los forros de Muebles que se planifican en este módulo —
// SOLAMENTE '026' (no '033' Estructuras, que es otra área/tabla — ver Planificación Táctica Muebles).
const RESP_CTRL_PROD_FORROS = '026';

// Originalmente copiado de "Explosión de Materiales - Semielaborados de Primer Nivel de Muebles"
// (ProvisionalOrdersAlphaTab.tsx: esExcluidoPrimerNivel), pero ese filtro opera sobre nodos de un árbol
// de explosión BOM, donde "BASE"/"ENSAMBLE" son materiales padre ficticios de agrupación. Aquí se
// filtran directamente Órdenes Previsionales/Fert de RespCtrlProd 026 — verificado contra el maestro de
// materiales real (Cubo de Inventarios) que, en ese universo, NINGÚN material está nombrado "BASE" o
// contiene "ENSAMBLE" como material ficticio; en cambio "BASE" aparece en decenas de forros reales
// ("FORRO BASE AJUST BARÚ...", "FORRO BASE GRAND...", "TAPA T. FALSO NEGRO BASE GRAND 174", etc.) que sí
// deben coserse — por eso esas 2 condiciones se retiraron (2026-08-19, material 30021493 fue el caso
// reportado que expuso el falso positivo). "COJIN CILINDRICO"/"MASCOTA"/"PET" sí tienen matches reales de
// materiales ajenos a este taller (proveedor externo / línea de producto Mascotas) y se mantienen:
// - Empieza con "COJIN CILINDRICO" o "FORRO COJIN CILINDRICO": material ficticio en SAP, se fabrica con
//   un proveedor externo.
// - Contiene "MASCOTA" o "PET": líneas de producto ajenas a Muebles.
const esExcluidoTallerCorte = (descripcionUpper: string): boolean =>
    descripcionUpper.startsWith('COJIN CILINDRICO') ||
    descripcionUpper.startsWith('FORRO COJIN CILINDRICO') ||
    descripcionUpper.includes('MASCOTA') ||
    descripcionUpper.includes('PET');

// Materiales que sí se distribuyen y se ven en el Gantt en pantalla, pero que el usuario pidió excluir
// de los archivos de exportación (Excel/.txt) del Diagrama de Gantt de Distribución de Máquinas de Coser
// (2026-08-26): 30024667 "FORRO COJIN FOAM BOX" y 30024666 "FORRO COJIN MUNICH BOX".
const MATERIALES_EXCLUIDOS_EXPORT_GANTT = new Set(['30024667', '30024666']);

// "TAPA T. FALSO ..." (cualquier variante/color, no solo NEGRO) y los forros de proceso corto ya
// conocidos ("FORRO FALSO COSIDO"/"FORRO COJIN INTER"), además de "ANTIFAZ" (2026-08-24, pedido
// explícito del usuario), se fabrican en un puesto de trabajo dedicado aparte ("TC-USN01") — no en
// ninguna de las 10 cosedoras TC-COS01..TC-COS10.
const esExcepcionUSN = (descripcionUpper: string): boolean =>
    descripcionUpper.startsWith('TAPA T. FALSO') ||
    descripcionUpper.startsWith('FORRO FALSO COSIDO') ||
    descripcionUpper.startsWith('FORRO COJIN INTER') ||
    descripcionUpper.startsWith('ANTIFAZ');

// Forros de cama (descripción empieza con "FORRO CAMA") y forros de cabecero (empieza con "FORRO CAB",
// ej. "FORRO CAB CAPRI ...") comparten el mismo pool de máquinas dedicadas — por defecto solo TC-COS04,
// pero el usuario puede habilitar otras cosedoras adicionales (camasMachineIds) cuando por temas
// operacionales haga falta más capacidad para camas/cabeceros (2026-09-02, pedido explícito del usuario).
const esForroCamaOCabecero = (descripcionUpper: string): boolean =>
    descripcionUpper.startsWith('FORRO CAMA') || descripcionUpper.startsWith('FORRO CAB');

const MACHINE_IDS = ['TC-COS01', 'TC-COS02', 'TC-COS03', 'TC-COS04', 'TC-COS05', 'TC-COS06', 'TC-COS07', 'TC-COS08', 'TC-COS09', 'TC-COS10', 'TC-USN01'] as const;
type MachineId = typeof MACHINE_IDS[number];

// TC-COS04 siempre fabrica forros de cama/cabecero — es la única cosedora dedicada por defecto y no se
// puede deshabilitar desde la UI (ver camasMachineIds/toggleCamasMachine más abajo).
const MACHINE_CAMAS_DEFAULT: MachineId = 'TC-COS04';

// Especialización de cada cosedora (evaluada en orden de prioridad):
// 1. TC-USN01: ÚNICA que acepta "TAPA T. FALSO NEGRO"/forros de proceso corto (esExcepcionUSN) — no
//    recibe nada más.
// 2. Forros de cama/cabecero (esForroCamaOCabecero): SOLO las cosedoras en `camasMachineIds` (por
//    defecto únicamente TC-COS04, ampliable por el usuario) — el resto de cosedoras no las recibe.
// 3. TC-COS04: fuera de camas/cabecero, sigue sin recibir nada más (dedicada), incluso si el usuario
//    amplió `camasMachineIds` con otras cosedoras — esas otras SÍ siguen recibiendo su carga normal del
//    pool general además de camas/cabecero.
// 4. TC-COS01..TC-COS10 (salvo TC-COS04): pool general, sin distinción entre ellas (pedido explícito del
//    usuario, 2026-08-25) — el algoritmo de distribución (best-fit-decreasing, ordena de mayor a menor
//    horas) ya prioriza los forros "grandes" hacia las máquinas con más capacidad libre, que al iniciar
//    todas en cero uso son TC-COS01/02/03 (primeras del pool por orden de MACHINE_IDS); cuando no hay
//    suficientes forros grandes para llenarlas, el resto de forros (medianos/pequeños) también puede
//    caer ahí, regularizando la carga entre las 10 mesas para que terminen en un horario similar.
const machineAcceptsMaterial = (machineId: MachineId, descripcionUpper: string, camasMachineIds: Set<MachineId>): boolean => {
    if (esExcepcionUSN(descripcionUpper)) return machineId === 'TC-USN01';
    if (machineId === 'TC-USN01') return false;
    if (esForroCamaOCabecero(descripcionUpper)) return camasMachineIds.has(machineId);
    if (machineId === 'TC-COS04') return false;
    return true;
};

type TurnoId = 'dia' | 'noche';

const TURNOS_TC: { id: TurnoId; label: string; startTime: string; icon: typeof Sun }[] = [
    { id: 'dia', label: 'Turno Día', startTime: '07:00', icon: Sun },
    { id: 'noche', label: 'Turno Noche', startTime: '21:00', icon: Moon },
];

interface ShiftDurationOptionTC {
    id: string;
    label: string;
    hours: number; // Horas usadas en el cálculo de capacidad
    startTime?: string; // Solo Noche: la hora de inicio cambia según la duración elegida
    displayHours?: number; // Solo Noche: horas de reloj reales (hours + 1h de receso) para pintar la hora de salida
}

// Turno Día: mismas 3 duraciones (y misma hora de inicio 07:00) que "Planificación Táctica Muebles",
// sin el factor de eficiencia/mantenimiento preventivo de ese módulo (no solicitado aquí).
const SHIFT_DURATIONS_TC_DIA: ShiftDurationOptionTC[] = [
    { id: 'dia_8h', label: '8 horas / 07:00 - 15:45', hours: 8 },
    { id: 'dia_9h', label: '9 horas / 07:00 - 17:00', hours: 9 },
    { id: 'dia_10h', label: '10 horas / 07:00 a 18:00', hours: 10 },
];

// Turno Noche: mismo patrón ya implementado para "Planificación Táctica Planchas Mixtas"
// (SHIFT_DURATIONS_PM_NOCHE) — la hora de inicio cambia según la duración elegida, las 3 terminan a las
// 05:30 del día siguiente; "hours" (cálculo de capacidad) trae descontada 1h de receso frente a
// "displayHours" (horas de reloj reales, solo para pintar la hora de salida).
const SHIFT_DURATIONS_TC_NOCHE: ShiftDurationOptionTC[] = [
    { id: 'noche_8h', label: '8 horas / 21:00 a 05:30', startTime: '21:00', hours: 7.5, displayHours: 8.5 },
    { id: 'noche_9h', label: '9 horas / 20:00 a 05:30', startTime: '20:00', hours: 8.5, displayHours: 9.5 },
    { id: 'noche_10h', label: '10 horas / 19:00 a 05:30', startTime: '19:00', hours: 9.5, displayHours: 10.5 },
];

const getShiftDurationsParaTC = (turnoId: TurnoId): ShiftDurationOptionTC[] =>
    turnoId === 'noche' ? SHIFT_DURATIONS_TC_NOCHE : SHIFT_DURATIONS_TC_DIA;

// Suma horas a una hora "HH:MM" y devuelve la hora final, dando la vuelta al día siguiente si aplica
const addHoursToTime = (startTime: string, hours: number): string => {
    const [h, m] = startTime.split(':').map(Number);
    const totalMinutes = Math.round((h * 60 + m + hours * 60) % (24 * 60));
    const endH = Math.floor(totalMinutes / 60);
    const endM = totalMinutes % 60;
    return `${String(endH).padStart(2, '0')}:${String(endM).padStart(2, '0')}`;
};

// Igual que addHoursToTime, pero además devuelve la FECHA resultante (clave "YYYY-MM-DD") — necesario
// porque el Turno Noche empieza 19:00/20:00/21:00 y termina 05:30, cruzando la medianoche: una tarea
// puede iniciar un día calendario y terminar al siguiente, o incluso iniciar Y terminar ya en el día
// siguiente si le tocó tarde en la cola de la máquina. `fechaKeyBase` es la fecha propia de la orden
// (Turno Día, sin cruce) usada como punto de partida antes de sumar las horas transcurridas del turno.
const addHoursWithDate = (fechaKeyBase: string, startTime: string, offsetHours: number): { hora: string; fechaKey: string } => {
    const [h, m] = startTime.split(':').map(Number);
    const totalMinutes = Math.round(h * 60 + m + offsetHours * 60);
    const diasAdelante = Math.floor(totalMinutes / (24 * 60));
    const minutosDelDia = totalMinutes % (24 * 60);
    const hora = `${String(Math.floor(minutosDelDia / 60)).padStart(2, '0')}:${String(minutosDelDia % 60).padStart(2, '0')}`;

    let fechaKey = fechaKeyBase;
    if (diasAdelante > 0) {
        const [y, mo, d] = fechaKeyBase.split('-').map(Number);
        const fecha = new Date(y, mo - 1, d);
        fecha.setDate(fecha.getDate() + diasAdelante);
        fechaKey = toDateKey(fecha);
    }
    return { hora, fechaKey };
};

// Fecha "hoy + offsetDays" (días CALENDARIO) en formato "YYYY-MM-DD"
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

// Suma N días laborables (omite sábado, domingo y feriados de Ecuador) — mismo criterio que
// "Planificación Táctica Planchas Mixtas"/"Planificación Táctica Muebles"
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

const getBusinessDateKeyOffset = (businessDays: number, holidaysSet: Set<string>): string =>
    toDateKey(addBusinessDays(new Date(), businessDays, holidaysSet));

// Fecha fija de impresión (Excel/.txt LSMW) de la Distribución de Máquinas de Coser — pedido explícito
// del usuario (2026-08-25): NO se usa la fecha propia de cada orden, sino un offset fijo en días
// hábiles desde hoy según el puesto de trabajo. TC-USN01 (proceso corto, mismo criterio que "FORRO
// FALSO COSIDO"/"FORRO COJIN INTER" en Muebles) imprime a hoy + 1 día hábil; el resto de cosedoras
// (TC-COS01..TC-COS10, forros normales/grandes) imprime a hoy + 2 días hábiles.
const getFixedExportDateKey = (machineId: MachineId, holidaysSet: Set<string>): string =>
    machineId === 'TC-USN01' ? getBusinessDateKeyOffset(1, holidaysSet) : getBusinessDateKeyOffset(2, holidaysSet);

// Convierte una fecha clave "YYYY-MM-DD" (la propia de cada TCOrder) al formato "DD.MM.AAAA" pedido
// para el archivo .txt de carga a SAP
const formatFechaKeyToDDMMYYYY = (fechaKey: string): string => {
    const [y, m, d] = fechaKey.split('-');
    return `${d}.${m}.${y}`;
};

// Escala fija del eje X del Diagrama de Gantt (en horas) — igual patrón que Muebles/Planchas Mixtas
const GANTT_HOURS_SCALE = 12;

const parseHHMM = (time: string): number => {
    const [h, m] = time.split(':').map(Number);
    return h * 60 + m;
};

// Hora real de reloj (formato "HH:MM") correspondiente a un offset en horas desde el inicio del turno
// (por eso "efectivo": Turno Noche cambia de hora de inicio según la duración de jornada elegida) —
// usada para etiquetar el eje X del Diagrama de Gantt con horas reales en vez de un conteo genérico.
const formatShiftClockLabel = (shiftStartTime: string, offsetHours: number): string => {
    const totalMinutes = parseHHMM(shiftStartTime) + Math.round(offsetHours * 60);
    const hh = Math.floor(totalMinutes / 60) % 24;
    const mm = totalMinutes % 60;
    return `${String(hh).padStart(2, '0')}:${String(mm).padStart(2, '0')}`;
};

interface TCOrder {
    id: string;
    source: 'Previsional';
    material: string;
    nombre: string;
    cantidad: number;
    tiempoUnitMin: number | null;
    horas: number | null;
    fecha: string;
}

interface MachineScheduleItem {
    order: TCOrder;
    startHour: number;
    endHour: number;
    overflow: boolean;
}

interface MachineDistributionEntry {
    turno: TurnoId;
    machineId: MachineId;
    capacityHours: number;
    usedHours: number;
    items: MachineScheduleItem[];
}

interface CapacitySummary {
    capacidadDisponible: number;
    tiempoRequerido: number;
    utilizacionPct: number;
    materialesSinTiempo: number;
}

interface ProvisionalOrdersTallerCorteTabProps {
    // Tiempo unitario manual (minutos) por código de material, ya normalizado — persistido en la
    // pestaña "Tiempos" (ver TacticalPlanTallerCorteSection).
    tiemposManualMap: Map<string, number>;
    // Reporta hacia arriba (TacticalPlanTallerCorteSection) los materiales de forro detectados en la
    // tabla inicial, para que la pestaña "Tiempos" sepa qué materiales necesitan tiempo unitario.
    onMaterialesDetectados: (materiales: { codigo: string; descripcion: string }[]) => void;
}

export const ProvisionalOrdersTallerCorteTab: React.FC<ProvisionalOrdersTallerCorteTabProps> = ({ tiemposManualMap, onMaterialesDetectados }) => {
    const { addNotification } = useAppContext();
    const [isLoading, setIsLoading] = useState(false);
    const [downloadProgress, setDownloadProgress] = useState({ current: 0, total: 0 });
    const [allPrevisionalRaw, setAllPrevisionalRaw] = useState<any[]>([]);
    const [holidaysSet, setHolidaysSet] = useState<Set<string>>(new Set());

    const [turnoEnabled, setTurnoEnabled] = useState<Record<TurnoId, boolean>>({ dia: true, noche: false });
    const [turnoDuration, setTurnoDuration] = useState<Record<TurnoId, string>>({ dia: SHIFT_DURATIONS_TC_DIA[0].id, noche: SHIFT_DURATIONS_TC_NOCHE[0].id });
    const [turnoMachines, setTurnoMachines] = useState<Record<TurnoId, Set<MachineId>>>({ dia: new Set(MACHINE_IDS), noche: new Set() });

    // Cosedoras habilitadas para fabricar forros de cama/cabecero, además de TC-COS04 (siempre incluida,
    // no removible desde la UI). Configurable por el usuario con el botón "Habilitar p/ Camas y Cabecero"
    // junto a cada cosedora, mismo patrón que camasOverflowMesaIds en "Planificación Táctica Muebles".
    const [camasMachineIds, setCamasMachineIds] = useState<Set<MachineId>>(new Set([MACHINE_CAMAS_DEFAULT]));

    const [capacitySummary, setCapacitySummary] = useState<CapacitySummary | null>(null);
    const [machineDistribution, setMachineDistribution] = useState<Map<string, MachineDistributionEntry> | null>(null);
    const [unassignedOrders, setUnassignedOrders] = useState<TCOrder[]>([]);

    const toggleCamasMachine = (machineId: MachineId) => {
        if (machineId === MACHINE_CAMAS_DEFAULT) return;
        setCamasMachineIds(prev => {
            const next = new Set(prev);
            if (next.has(machineId)) next.delete(machineId);
            else next.add(machineId);
            return next;
        });
    };

    const toggleTurnoMachine = (turno: TurnoId, machineId: MachineId) => {
        setTurnoMachines(prev => {
            const next = new Set(prev[turno]);
            if (next.has(machineId)) next.delete(machineId);
            else next.add(machineId);
            return { ...prev, [turno]: next };
        });
    };

    useEffect(() => {
        const fetchHolidays = async () => {
            try {
                const start = new Date();
                const end = new Date(start);
                end.setDate(end.getDate() + 14);
                const holidays = await ecuadorHolidaysService.getHolidaysForRange(start, end);
                setHolidaysSet(new Set(holidays.map(h => h.date)));
            } catch (error) {
                console.error('Error al cargar feriados para Taller de Corte:', error);
            }
        };
        fetchHolidays();
    }, []);

    const fetchAllData = useCallback(async () => {
        setIsLoading(true);
        setDownloadProgress({ current: 0, total: 0 });
        try {
            const provExplore = await serviciosService.getOrdenesProvisionalesAlphaPaginados(1, 1);
            const totalProv = provExplore.totalRegistros || 0;
            let combinedProv: any[] = [];
            if (totalProv > 0) {
                const BATCH = 20000;
                const pages = Math.ceil(totalProv / BATCH);
                for (let i = 1; i <= pages; i++) {
                    const res = await serviciosService.getOrdenesProvisionalesAlphaPaginados(i, BATCH);
                    if (res.data) {
                        combinedProv = combinedProv.concat(Array.isArray(res.data) ? res.data : [res.data]);
                        setDownloadProgress({ current: combinedProv.length, total: totalProv });
                    }
                }
            }
            setAllPrevisionalRaw(combinedProv);
        } catch (error) {
            console.error('Error al descargar datos del Taller de Corte:', error);
        } finally {
            setIsLoading(false);
        }
    }, []);

    useEffect(() => {
        fetchAllData();
    }, [fetchAllData]);

    // Tabla inicial: SOLO Órdenes Previsionales de forros (RespCtrlProd '026'), Centro 1000, excluyendo
    // materiales ficticios/ajenos — misma ventana de fechas que "Planificación Táctica Planchas Mixtas":
    // Previsional MTS (sin PEDIDOVENTAS): hoy o mañana. Previsional MTO (con PEDIDOVENTAS): mañana o
    // pasado mañana. No incluye Fert: solo las Previsionales se distribuyen en el Diagrama de Gantt.
    const tcOrders = useMemo<TCOrder[]>(() => {
        const todayKey = getDateKeyOffset(0);
        const tomorrowKey = getBusinessDateKeyOffset(1, holidaysSet);
        const dayAfterTomorrowKey = getBusinessDateKeyOffset(2, holidaysSet);
        const result: TCOrder[] = [];

        allPrevisionalRaw.forEach((row: any) => {
            if (String(row.RESPCONTROLPROD || '').trim() !== RESP_CTRL_PROD_FORROS) return;
            if (String(row.Centro || '').trim() !== CENTRO_TC) return;
            const nombre = String(row.NOMBRE || '').trim();
            if (esExcluidoTallerCorte(nombre.toUpperCase())) return;

            const fechaKey = String(row.FECHAINICIO || '').trim().slice(0, 10);
            const esMTO = !!String(row.PEDIDOVENTAS || '').trim();
            const fechaValida = esMTO
                ? (fechaKey === tomorrowKey || fechaKey === dayAfterTomorrowKey)
                : (fechaKey === todayKey || fechaKey === tomorrowKey);
            if (!fechaValida) return;

            const cantidad = Number(row.CANTIDAD) || 0;
            if (cantidad <= 0) return;

            const material = normalizeMaterialCode(row.MATERIAL || row.CodMaterial || '');
            const tiempoUnitMin = tiemposManualMap.get(material) ?? null;
            result.push({
                id: String(row.ORDENPREVISIONAL || ''),
                source: 'Previsional',
                material,
                nombre,
                cantidad,
                tiempoUnitMin,
                horas: tiempoUnitMin !== null ? (tiempoUnitMin * cantidad) / 60 : null,
                fecha: fechaKey,
            });
        });

        return result.sort((a, b) => a.nombre.localeCompare(b.nombre, 'es'));
    }, [allPrevisionalRaw, holidaysSet, tiemposManualMap]);

    // Reporta hacia arriba los materiales distintos detectados, para la pestaña "Tiempos"
    useEffect(() => {
        const map = new Map<string, string>();
        tcOrders.forEach(o => {
            if (!map.has(o.material)) map.set(o.material, o.nombre);
        });
        const materiales = Array.from(map.entries())
            .map(([codigo, descripcion]) => ({ codigo, descripcion }))
            .sort((a, b) => a.descripcion.localeCompare(b.descripcion, 'es'));
        onMaterialesDetectados(materiales);
    }, [tcOrders, onMaterialesDetectados]);

    const totalHorasRequeridas = useMemo(
        () => tcOrders.reduce((s, o) => s + (o.horas ?? 0), 0),
        [tcOrders]
    );
    const totalCantidad = useMemo(
        () => tcOrders.reduce((s, o) => s + o.cantidad, 0),
        [tcOrders]
    );
    const totalTiempoUnitMin = useMemo(
        () => tcOrders.reduce((s, o) => s + (o.tiempoUnitMin ?? 0), 0),
        [tcOrders]
    );
    const materialesSinTiempoCount = useMemo(
        () => new Set(tcOrders.filter(o => o.tiempoUnitMin === null).map(o => o.material)).size,
        [tcOrders]
    );

    // Slots de capacidad activos: una combinación Turno + Máquina por cada cosedora habilitada en cada
    // turno activo — mismo patrón que "Planificación Táctica Planchas Mixtas" (activeSlots)
    const activeSlots = useMemo(() => {
        const slots: { turno: TurnoId; machineId: MachineId; capacityHours: number }[] = [];
        TURNOS_TC.forEach(turno => {
            if (!turnoEnabled[turno.id]) return;
            const durationHours = getShiftDurationsParaTC(turno.id).find(d => d.id === turnoDuration[turno.id])?.hours ?? 0;
            turnoMachines[turno.id].forEach(machineId => {
                slots.push({ turno: turno.id, machineId, capacityHours: durationHours });
            });
        });
        return slots;
    }, [turnoEnabled, turnoDuration, turnoMachines]);

    const capacidadDisponibleActual = useMemo(() => activeSlots.reduce((s, slot) => s + slot.capacityHours, 0), [activeSlots]);

    const handleCalcularPlanificacion = () => {
        if (activeSlots.length === 0) {
            setCapacitySummary(null);
            return;
        }
        const utilizacionPct = capacidadDisponibleActual > 0 ? (totalHorasRequeridas / capacidadDisponibleActual) * 100 : 0;
        setCapacitySummary({
            capacidadDisponible: capacidadDisponibleActual,
            tiempoRequerido: totalHorasRequeridas,
            utilizacionPct,
            materialesSinTiempo: materialesSinTiempoCount,
        });
        // Un nuevo cálculo invalida cualquier distribución previa
        setMachineDistribution(null);
        setUnassignedOrders([]);
    };

    // "DISTRIBUCIÓN DE MÁQUINAS DE COSER": bin-packing best-fit-decreasing (mismo algoritmo que
    // handleExecuteDistribution de "Planificación Táctica Muebles") restringido por
    // machineAcceptsMaterial en vez de mesaAcceptsMaterial.
    const handleDistribuirMaquinas = () => {
        if (activeSlots.length === 0) return;

        const remaining = new Map<string, number>();
        const items = new Map<string, MachineScheduleItem[]>();
        activeSlots.forEach(slot => {
            const key = `${slot.turno}-${slot.machineId}`;
            remaining.set(key, slot.capacityHours);
            items.set(key, []);
        });

        const ordersConTiempo = tcOrders.filter(o => o.horas !== null && o.horas > 0);
        const sortedOrders = [...ordersConTiempo].sort((a, b) => (b.horas ?? 0) - (a.horas ?? 0));
        const unassigned: TCOrder[] = [];

        sortedOrders.forEach(order => {
            const descUpper = order.nombre.toUpperCase();
            const candidates = activeSlots.filter(slot => machineAcceptsMaterial(slot.machineId, descUpper, camasMachineIds));
            if (candidates.length === 0) {
                unassigned.push(order);
                return;
            }

            const keys = candidates.map(slot => `${slot.turno}-${slot.machineId}`);
            const fitting = keys.filter(k => (remaining.get(k) ?? 0) >= (order.horas ?? 0));
            const pool = fitting.length > 0 ? fitting : keys;
            const chosen = pool.reduce((best, k) => ((remaining.get(k) ?? 0) > (remaining.get(best) ?? 0) ? k : best), pool[0]);

            const arr = items.get(chosen)!;
            const startHour = arr.reduce((s, it) => s + (it.endHour - it.startHour), 0);
            const overflow = (order.horas ?? 0) > (remaining.get(chosen) ?? 0);
            arr.push({ order, startHour, endHour: startHour + (order.horas ?? 0), overflow });
            remaining.set(chosen, (remaining.get(chosen) ?? 0) - (order.horas ?? 0));
        });

        const distribution = new Map<string, MachineDistributionEntry>();
        activeSlots.forEach(slot => {
            const key = `${slot.turno}-${slot.machineId}`;
            const slotItems = items.get(key) ?? [];
            distribution.set(key, {
                turno: slot.turno,
                machineId: slot.machineId,
                capacityHours: slot.capacityHours,
                usedHours: slotItems.reduce((s, it) => s + (it.endHour - it.startHour), 0),
                items: slotItems,
            });
        });

        setMachineDistribution(distribution);
        const sinTiempo = tcOrders.filter(o => o.horas === null || o.horas <= 0);
        setUnassignedOrders([...unassigned, ...sinTiempo]);
    };

    // "MODULAR DISTRIBUCIÓN DE MÁQUINAS DE COSER": mismo algoritmo que handleModularDistribution de
    // "Planificación Táctica Muebles" — rebalancea la distribución ya ejecutada moviendo materiales de
    // máquinas sobrecargadas (uso > capacidad) hacia máquinas compatibles (machineAcceptsMaterial) con
    // capacidad libre, sin volver a ejecutar la distribución completa desde cero. Puede mover materiales
    // entre Turno Día y Turno Noche (igual libertad que ya tiene handleDistribuirMaquinas al armar
    // candidates desde TODOS los activeSlots, sin restringir por turno).
    const handleModularDistribucionMaquinas = () => {
        if (!machineDistribution || machineDistribution.size === 0) {
            addNotification('warning', 'Debe ejecutar la Distribución de Máquinas de Coser antes de modularla.');
            return;
        }

        const machineKeys = Array.from(machineDistribution.keys());
        const capacityById = new Map(machineKeys.map(key => [key, machineDistribution.get(key)!.capacityHours]));
        const machineIdById = new Map(machineKeys.map(key => [key, machineDistribution.get(key)!.machineId]));
        const workingItems = new Map<string, MachineScheduleItem[]>(
            machineKeys.map(key => [key, machineDistribution.get(key)!.items.map(it => ({ ...it }))])
        );

        const usedHoursOf = (key: string) => workingItems.get(key)!.reduce((s, it) => s + (it.endHour - it.startHour), 0);
        const utilizationOf = (key: string) => {
            const cap = capacityById.get(key) ?? 0;
            return cap > 0 ? usedHoursOf(key) / cap : Infinity;
        };

        let materialesMovidos = 0;
        const MAX_ITERATIONS = 200;

        for (let iter = 0; iter < MAX_ITERATIONS; iter++) {
            const overloaded = machineKeys
                .filter(key => usedHoursOf(key) > (capacityById.get(key) ?? 0))
                .sort((a, b) => (usedHoursOf(b) - (capacityById.get(b) ?? 0)) - (usedHoursOf(a) - (capacityById.get(a) ?? 0)));
            if (overloaded.length === 0) break;

            let movedThisRound = false;

            for (const sourceKey of overloaded) {
                const sourceItems = workingItems.get(sourceKey)!;
                // Primero los que provocan el excedente (overflow), luego el resto de mayor a menor duración
                const candidateItems = [
                    ...sourceItems.filter(it => it.overflow),
                    ...sourceItems.filter(it => !it.overflow).sort((a, b) => (b.endHour - b.startHour) - (a.endHour - a.startHour)),
                ];

                for (const item of candidateItems) {
                    const duracion = item.endHour - item.startHour;
                    const descUpper = item.order.nombre.toUpperCase();
                    const destinos = machineKeys
                        .filter(key => key !== sourceKey)
                        .filter(key => machineAcceptsMaterial(machineIdById.get(key)!, descUpper, camasMachineIds))
                        .filter(key => usedHoursOf(key) + duracion <= (capacityById.get(key) ?? 0))
                        .sort((a, b) => utilizationOf(a) - utilizationOf(b));

                    if (destinos.length > 0) {
                        const destKey = destinos[0];
                        workingItems.set(sourceKey, workingItems.get(sourceKey)!.filter(it => it !== item));
                        workingItems.get(destKey)!.push({ ...item });
                        materialesMovidos++;
                        movedThisRound = true;
                        break;
                    }
                }

                if (movedThisRound) break;
            }

            if (!movedThisRound) break;
        }

        if (materialesMovidos === 0) {
            addNotification('info', 'No se encontró ninguna máquina compatible con capacidad libre para reubicar materiales. La distribución no cambió.');
            return;
        }

        // Recalcula startHour/endHour de forma secuencial dentro de cada máquina (igual que en la
        // asignación original) y el flag "overflow" según si el material, en su nueva posición, excede
        // la capacidad.
        const newDistribution = new Map<string, MachineDistributionEntry>();
        machineKeys.forEach(key => {
            const capacityHours = capacityById.get(key) ?? 0;
            const turno = machineDistribution.get(key)!.turno;
            const machineId = machineIdById.get(key)!;
            let cursor = 0;
            const recalculatedItems: MachineScheduleItem[] = workingItems.get(key)!.map(it => {
                const duracion = it.endHour - it.startHour;
                const startHour = cursor;
                const endHour = cursor + duracion;
                cursor = endHour;
                return { order: it.order, startHour, endHour, overflow: endHour > capacityHours };
            });
            newDistribution.set(key, {
                turno,
                machineId,
                capacityHours,
                usedHours: recalculatedItems.reduce((s, it) => s + (it.endHour - it.startHour), 0),
                items: recalculatedItems,
            });
        });

        setMachineDistribution(newDistribution);
        addNotification('success', `Distribución modulada: ${materialesMovidos} material(es) reubicado(s) para equilibrar la carga entre máquinas.`);
    };

    // Hora de inicio efectiva de un turno (según la duración de jornada elegida) — mismo cálculo que
    // el usado para pintar la hora de inicio/fin en la sección "Turnos de Trabajo — Cosedoras"
    const getEffectiveStartTimeParaTurno = (turnoId: TurnoId): string => {
        const duracionesTurno = getShiftDurationsParaTC(turnoId);
        const selectedDuration = duracionesTurno.find(d => d.id === turnoDuration[turnoId]);
        return selectedDuration?.startTime ?? TURNOS_TC.find(t => t.id === turnoId)!.startTime;
    };

    // Exporta a Excel la Distribución de Máquinas de Coser (Diagrama de Gantt), mismo orden y contenido
    // que el .txt (exportGanttToTxt): Material, Cantidad, Fecha Inicio, Fecha Fin (ambas DD.MM.AAAA),
    // Hora Inicio, Hora Final y Puesto de Trabajo. Fecha Inicio/Fin parten de una fecha FIJA por puesto
    // de trabajo (getFixedExportDateKey, no la fecha propia de la orden — pedido explícito del usuario,
    // 2026-08-25) y pueden diferir entre sí en el Turno Noche (cruza medianoche, ver addHoursWithDate).
    const handleExportGanttExcel = () => {
        if (!machineDistribution || machineDistribution.size === 0) return;

        const rows: Record<string, string | number>[] = [];
        Array.from(machineDistribution.values()).forEach(machine => {
            const effectiveStartTime = getEffectiveStartTimeParaTurno(machine.turno);
            const fechaBase = getFixedExportDateKey(machine.machineId, holidaysSet);
            machine.items.forEach(item => {
                if (MATERIALES_EXCLUIDOS_EXPORT_GANTT.has(normalizeMaterialCode(item.order.material))) return;
                const inicio = addHoursWithDate(fechaBase, effectiveStartTime, item.startHour);
                const fin = addHoursWithDate(fechaBase, effectiveStartTime, item.endHour);
                rows.push({
                    'Material': item.order.material,
                    'Cantidad': item.order.cantidad,
                    'Fecha Inicio': formatFechaKeyToDDMMYYYY(inicio.fechaKey),
                    'Fecha Fin': formatFechaKeyToDDMMYYYY(fin.fechaKey),
                    'Hora Inicio': inicio.hora,
                    'Hora Fin': fin.hora,
                    'Puesto de Trabajo': machine.machineId,
                });
            });
        });
        if (rows.length === 0) return;

        const worksheet = XLSX.utils.json_to_sheet(rows);
        const workbook = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(workbook, worksheet, 'Distribución Cosedoras');

        const fechaArchivo = getDateKeyOffset(0);
        XLSX.writeFile(workbook, `Distribucion_Taller_Corte_${fechaArchivo}.xlsx`);
    };

    // Genera el archivo .txt de la Distribución de Máquinas de Coser para carga en SAP. Formato por
    // línea (separado por TAB): Material, Cantidad, Fecha de Inicio (DD.MM.AAAA), Fecha Fin (DD.MM.AAAA),
    // Hora Inicio, Hora Final (ambas calculadas igual que en el Gantt: hora de inicio del turno + horas
    // acumuladas de la máquina) y Puesto de Trabajo (TC-COS01, etc.). Fecha Inicio/Fin parten de
    // getFixedExportDateKey (hoy + 2 días hábiles para TC-COS01..10, hoy + 1 para TC-USN01 — pedido
    // explícito del usuario, 2026-08-25, no la fecha propia de la orden) y usan addHoursWithDate porque
    // el Turno Noche cruza medianoche (empieza 19:00/20:00/21:00, termina 05:30) — una tarea puede
    // iniciar un día y terminar al siguiente, o iniciar y terminar ya en el día siguiente si le tocó
    // tarde en la cola de la máquina.
    const exportGanttToTxt = () => {
        if (!machineDistribution || machineDistribution.size === 0) return;

        const lines: string[] = [];
        Array.from(machineDistribution.values()).forEach(machine => {
            const effectiveStartTime = getEffectiveStartTimeParaTurno(machine.turno);
            const fechaBase = getFixedExportDateKey(machine.machineId, holidaysSet);
            machine.items.forEach(item => {
                if (MATERIALES_EXCLUIDOS_EXPORT_GANTT.has(normalizeMaterialCode(item.order.material))) return;
                const inicio = addHoursWithDate(fechaBase, effectiveStartTime, item.startHour);
                const fin = addHoursWithDate(fechaBase, effectiveStartTime, item.endHour);
                lines.push([
                    item.order.material,
                    item.order.cantidad,
                    formatFechaKeyToDDMMYYYY(inicio.fechaKey),
                    formatFechaKeyToDDMMYYYY(fin.fechaKey),
                    inicio.hora,
                    fin.hora,
                    machine.machineId,
                ].join('\t'));
            });
        });
        if (lines.length === 0) return;

        const blob = new Blob([lines.join('\r\n') + '\r\n'], { type: 'text/plain;charset=utf-8' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        const fechaArchivo = getDateKeyOffset(0);
        link.href = url;
        link.download = `Distribucion_Taller_Corte_${fechaArchivo}.txt`;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(url);
    };

    if (isLoading && allPrevisionalRaw.length === 0) {
        return (
            <div className="flex flex-col items-center justify-center py-20 bg-gray-50 rounded-xl border-2 border-dashed gap-4">
                <Loader2 className="w-12 h-12 animate-spin text-indigo-600" />
                <div className="text-center">
                    <p className="text-sm font-bold text-gray-700">Descargando datos del Taller de Corte...</p>
                    <p className="text-xs text-gray-500 mt-1">
                        Procesados {downloadProgress.current.toLocaleString()} de {downloadProgress.total.toLocaleString()} registros
                    </p>
                </div>
            </div>
        );
    }

    return (
        <div className="space-y-6">
            {/* CONFIGURACIÓN DE COSEDORAS DISPONIBLES (POR TURNO) — primero que se ve tras las pestañas */}
            <div className="bg-white border border-gray-200 rounded-xl p-6 shadow-sm space-y-4">
                <div className="flex items-center gap-2">
                    <Clock className="w-5 h-5 text-indigo-600" />
                    <h3 className="text-sm font-bold text-gray-800 uppercase tracking-tight">Turnos de Trabajo — Cosedoras</h3>
                </div>
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                    {TURNOS_TC.map(turno => {
                        const Icon = turno.icon;
                        const enabled = turnoEnabled[turno.id];
                        const duracionesTurno = getShiftDurationsParaTC(turno.id);
                        const selectedDuration = duracionesTurno.find(d => d.id === turnoDuration[turno.id]);
                        const durationHours = selectedDuration?.hours ?? 0;
                        const effectiveStartTime = selectedDuration?.startTime ?? turno.startTime;
                        const endTime = addHoursToTime(effectiveStartTime, selectedDuration?.displayHours ?? durationHours);
                        const machinesActivas = turnoMachines[turno.id].size;
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
                                        <div className="flex items-center justify-between gap-4">
                                            <Select value={turnoDuration[turno.id]} onValueChange={(val) => setTurnoDuration(prev => ({ ...prev, [turno.id]: val }))}>
                                                <SelectTrigger className="h-8 text-xs font-semibold flex-1">
                                                    <SelectValue placeholder="Duración de jornada" />
                                                </SelectTrigger>
                                                <SelectContent>
                                                    {duracionesTurno.map(d => (
                                                        <SelectItem key={d.id} value={d.id} className="text-xs">{d.label}</SelectItem>
                                                    ))}
                                                </SelectContent>
                                            </Select>
                                            <div className="text-right shrink-0">
                                                <p className="text-[9px] font-bold text-gray-400 uppercase tracking-wide">Capacidad Habilitada</p>
                                                <p className="text-lg font-extrabold text-indigo-700 leading-none">{machinesActivas} <span className="text-[10px] font-semibold text-gray-500">Máquinas</span></p>
                                            </div>
                                        </div>

                                        <div className="flex flex-wrap gap-1.5">
                                            {MACHINE_IDS.map(machineId => {
                                                const active = turnoMachines[turno.id].has(machineId);
                                                return (
                                                    <button
                                                        key={machineId}
                                                        type="button"
                                                        onClick={() => toggleTurnoMachine(turno.id, machineId)}
                                                        className={cn(
                                                            "px-2.5 py-1 rounded-md text-[10px] font-bold border transition-colors",
                                                            active
                                                                ? "bg-indigo-600 border-indigo-600 text-white"
                                                                : "bg-white border-gray-300 text-gray-500 hover:border-indigo-300"
                                                        )}
                                                    >
                                                        {machineId}
                                                    </button>
                                                );
                                            })}
                                        </div>
                                    </>
                                )}
                            </div>
                        );
                    })}
                </div>

                <div className="flex items-center justify-end gap-2 pt-2 border-t border-dashed border-gray-200">
                    <Button
                        onClick={handleCalcularPlanificacion}
                        disabled={activeSlots.length === 0}
                        className="bg-indigo-600 hover:bg-indigo-700 text-white font-bold gap-2"
                    >
                        <PlayCircle className="w-4 h-4" />
                        Calcular Planificación
                    </Button>
                    <Button
                        onClick={handleDistribuirMaquinas}
                        disabled={activeSlots.length === 0}
                        className="bg-orange-600 hover:bg-orange-700 text-white font-bold gap-2"
                    >
                        <LayoutGrid className="w-4 h-4" />
                        Distribución de Máquinas de Coser
                    </Button>
                </div>
            </div>

            {/* CONFIGURACIÓN DE COSEDORAS PARA FORROS DE CAMA Y CABECERO */}
            <div className="bg-white border border-gray-200 rounded-xl p-6 shadow-sm space-y-3">
                <div className="flex items-center gap-2">
                    <BedDouble className="w-5 h-5 text-indigo-600" />
                    <h3 className="text-sm font-bold text-gray-800 uppercase tracking-tight">Cosedoras para Forros de Cama y Cabecero</h3>
                </div>
                <p className="text-xs text-gray-500">
                    TC-COS04 fabrica siempre los forros de cama y de cabecero (materiales que empiezan con &quot;FORRO CAMA&quot; o &quot;FORRO CAB&quot;). Habilita otras cosedoras aquí cuando por temas operacionales haga falta repartir esa carga en más máquinas — esas cosedoras seguirán recibiendo también su carga normal del pool general.
                </p>
                <div className="flex flex-wrap gap-1.5">
                    {MACHINE_IDS.filter(machineId => machineId !== 'TC-USN01').map(machineId => {
                        const isDefault = machineId === MACHINE_CAMAS_DEFAULT;
                        const active = camasMachineIds.has(machineId);
                        return (
                            <button
                                key={machineId}
                                type="button"
                                onClick={() => toggleCamasMachine(machineId)}
                                disabled={isDefault}
                                title={isDefault ? 'TC-COS04 siempre fabrica forros de cama/cabecero' : 'Habilita esta cosedora para fabricar también forros de cama/cabecero'}
                                className={cn(
                                    "px-2.5 py-1 rounded-md text-[10px] font-bold border transition-colors inline-flex items-center gap-1",
                                    active
                                        ? "bg-sky-600 border-sky-600 text-white"
                                        : "bg-white border-gray-300 text-gray-500 hover:border-sky-300",
                                    isDefault && "cursor-default opacity-90"
                                )}
                            >
                                <BedDouble className="w-3 h-3" />
                                {machineId}{isDefault ? ' (siempre)' : ''}
                            </button>
                        );
                    })}
                </div>
            </div>

            {/* RESUMEN DE CAPACIDAD */}
            {capacitySummary && (
                <div className="bg-white border border-gray-200 rounded-xl p-6 shadow-sm space-y-3">
                    <div className="flex items-center gap-2">
                        <Gauge className="w-5 h-5 text-indigo-600" />
                        <h3 className="text-sm font-bold text-gray-800 uppercase tracking-tight">Capacidad vs. Tiempo Requerido</h3>
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
                        <div className="border border-gray-200 rounded-lg p-3">
                            <p className="text-[10px] font-bold text-gray-400 uppercase">Capacidad Disponible</p>
                            <p className="text-xl font-extrabold text-gray-800">{capacitySummary.capacidadDisponible.toFixed(2)} h</p>
                        </div>
                        <div className="border border-gray-200 rounded-lg p-3">
                            <p className="text-[10px] font-bold text-gray-400 uppercase">Tiempo Requerido</p>
                            <p className="text-xl font-extrabold text-gray-800">{capacitySummary.tiempoRequerido.toFixed(2)} h</p>
                        </div>
                        <div className="border border-gray-200 rounded-lg p-3">
                            <p className="text-[10px] font-bold text-gray-400 uppercase">Utilización</p>
                            <p className={cn(
                                "text-xl font-extrabold",
                                capacitySummary.utilizacionPct > 100 ? 'text-red-600' : capacitySummary.utilizacionPct >= 85 ? 'text-emerald-700' : 'text-gray-800'
                            )}>
                                {capacitySummary.utilizacionPct.toFixed(0)}%
                            </p>
                        </div>
                        <div className="border border-gray-200 rounded-lg p-3">
                            <p className="text-[10px] font-bold text-gray-400 uppercase">Materiales sin Tiempo</p>
                            <p className={cn("text-xl font-extrabold", capacitySummary.materialesSinTiempo > 0 ? 'text-amber-600' : 'text-gray-800')}>
                                {capacitySummary.materialesSinTiempo}
                            </p>
                        </div>
                    </div>
                    {capacitySummary.materialesSinTiempo > 0 && (
                        <p className="text-[11px] text-amber-700 flex items-center gap-1.5">
                            <TriangleAlert className="w-3.5 h-3.5" />
                            Hay {capacitySummary.materialesSinTiempo} material(es) sin tiempo unitario cargado en la pestaña "Tiempos" — no se incluyen en el tiempo requerido ni en la distribución.
                        </p>
                    )}
                </div>
            )}

            {/* TABLA INICIAL: NECESIDADES DE FORRO (026) */}
            <div className="bg-white border border-gray-200 rounded-xl shadow-sm overflow-hidden">
                <div className="flex items-center justify-between px-6 py-4 bg-gradient-to-r from-slate-900 to-indigo-900">
                    <div className="flex items-center gap-2">
                        <Scissors className="w-5 h-5 text-indigo-200" />
                        <h3 className="text-sm font-bold text-white uppercase tracking-wide">Necesidades de Forro (Taller de Corte)</h3>
                    </div>
                    <Button
                        onClick={fetchAllData}
                        disabled={isLoading}
                        size="sm"
                        className="h-8 bg-white hover:bg-gray-50 text-gray-700 border border-gray-300 font-bold gap-2"
                    >
                        {isLoading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <RefreshCw className="w-3.5 h-3.5" />}
                        Actualizar Datos
                    </Button>
                </div>
                <div className="p-4">
                    <p className="text-[11px] text-gray-500 mb-3">
                        Solo Órdenes Previsionales — RespCtrlProd <span className="font-bold">{RESP_CTRL_PROD_FORROS}</span>, Centro <span className="font-bold">{CENTRO_TC}</span>:
                        MTS (hoy {getDateKeyOffset(0)} o mañana {getBusinessDateKeyOffset(1, holidaysSet)}), MTO
                        (mañana {getBusinessDateKeyOffset(1, holidaysSet)} o pasado mañana {getBusinessDateKeyOffset(2, holidaysSet)})
                        — {tcOrders.length} línea(s) encontrada(s).
                    </p>
                    <div className="border rounded-lg overflow-auto max-h-[50vh]">
                        <Table>
                            <TableHeader>
                                <TableRow>
                                    <TableHead className="text-center border-r border-dashed border-gray-300">Origen</TableHead>
                                    <TableHead className="text-center border-r border-dashed border-gray-300">Material</TableHead>
                                    <TableHead className="text-left border-r border-dashed border-gray-300">Descripción</TableHead>
                                    <TableHead className="text-center border-r border-dashed border-gray-300">Fecha</TableHead>
                                    <TableHead className="text-center border-r border-dashed border-gray-300">Cantidad</TableHead>
                                    <TableHead className="text-center border-r border-dashed border-gray-300">Tiempo Unit. (min)</TableHead>
                                    <TableHead className="text-center">Horas</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {tcOrders.map((o, idx) => (
                                    <TableRow key={`${o.source}-${o.id}-${o.material}-${idx}`}>
                                        <TableCell className="text-center border-r border-dashed border-gray-300">{o.source}</TableCell>
                                        <TableCell className="text-center border-r border-dashed border-gray-300 font-mono">{o.material}</TableCell>
                                        <TableCell className="text-left border-r border-dashed border-gray-300">{o.nombre}</TableCell>
                                        <TableCell className="text-center border-r border-dashed border-gray-300">{o.fecha}</TableCell>
                                        <TableCell className="text-center border-r border-dashed border-gray-300">{o.cantidad.toLocaleString()}</TableCell>
                                        <TableCell className="text-center border-r border-dashed border-gray-300">
                                            {o.tiempoUnitMin !== null ? o.tiempoUnitMin.toFixed(2) : (
                                                <span className="inline-flex items-center gap-1 text-amber-600 font-semibold text-[11px]">
                                                    <TriangleAlert className="w-3.5 h-3.5" /> Falta tiempo unitario
                                                </span>
                                            )}
                                        </TableCell>
                                        <TableCell className="text-center">{o.horas !== null ? o.horas.toFixed(2) : '—'}</TableCell>
                                    </TableRow>
                                ))}
                                {tcOrders.length === 0 && (
                                    <TableRow>
                                        <TableCell colSpan={7} className="text-center py-6 text-gray-400 text-xs">
                                            No se encontraron necesidades de forro para la ventana de fechas vigente.
                                        </TableCell>
                                    </TableRow>
                                )}
                            </TableBody>
                            {tcOrders.length > 0 && (
                                <TableFooter>
                                    <TableRow>
                                        <TableCell colSpan={4} className="text-right font-bold border-r border-dashed border-gray-300">Totales</TableCell>
                                        <TableCell className="text-center font-bold border-r border-dashed border-gray-300">{totalCantidad.toLocaleString()}</TableCell>
                                        <TableCell className="text-center font-bold border-r border-dashed border-gray-300">{totalTiempoUnitMin.toFixed(2)}</TableCell>
                                        <TableCell className="text-center font-bold">{totalHorasRequeridas.toFixed(2)}</TableCell>
                                    </TableRow>
                                </TableFooter>
                            )}
                        </Table>
                    </div>
                </div>
            </div>

            {/* DIAGRAMA DE GANTT — DISTRIBUCIÓN DE MÁQUINAS DE COSER */}
            {machineDistribution && machineDistribution.size > 0 && (
                <div className="bg-white border border-gray-200 rounded-xl shadow-md overflow-hidden">
                    <div className="flex items-center justify-between px-6 py-4 bg-gradient-to-r from-slate-900 to-purple-900">
                        <div className="flex items-center gap-2">
                            <LayoutGrid className="w-5 h-5 text-purple-200" />
                            <h3 className="text-sm font-bold text-white uppercase tracking-wide">Diagrama de Gantt — Distribución de Máquinas de Coser</h3>
                        </div>
                        <div className="flex items-center gap-2">
                            <Button
                                onClick={handleModularDistribucionMaquinas}
                                size="sm"
                                className="h-8 bg-fuchsia-600 hover:bg-fuchsia-700 text-white gap-1.5 text-xs"
                            >
                                <RefreshCw className="w-3.5 h-3.5" />
                                Modular Distribución de Máquinas
                            </Button>
                            <Button
                                onClick={exportGanttToTxt}
                                size="sm"
                                className="h-8 bg-white/10 hover:bg-white/20 text-white gap-1.5 text-xs"
                            >
                                <Download className="w-3.5 h-3.5" />
                                Descargar .txt
                            </Button>
                            <Button
                                onClick={handleExportGanttExcel}
                                size="sm"
                                className="h-8 bg-emerald-600 hover:bg-emerald-700 text-white gap-1.5 text-xs"
                            >
                                <FileSpreadsheet className="w-3.5 h-3.5" />
                                Descargar Excel
                            </Button>
                        </div>
                    </div>
                    <div className="p-6 space-y-6">
                        {unassignedOrders.length > 0 && (
                            <div className="bg-amber-50 border border-amber-200 rounded-lg p-3">
                                <p className="text-xs font-bold text-amber-800">{unassignedOrders.length} material(es) no asignado(s)</p>
                                <p className="text-[11px] text-amber-700 mt-0.5">
                                    Sin máquina elegible activa, o sin tiempo unitario cargado en la pestaña "Tiempos".
                                </p>
                            </div>
                        )}

                        {TURNOS_TC.filter(turno => turnoEnabled[turno.id]).map(turno => {
                            const machinesTurno = Array.from(machineDistribution.values()).filter(m => m.turno === turno.id);
                            if (machinesTurno.length === 0) return null;
                            return (
                                <div key={turno.id} className="space-y-3">
                                    <h4 className="text-xs font-extrabold text-gray-700 uppercase tracking-wide border-b border-dashed border-gray-300 pb-1">{turno.label}</h4>
                                    {machinesTurno.map(machine => {
                                        const utilizacionPct = machine.capacityHours > 0 ? (machine.usedHours / machine.capacityHours) * 100 : 0;
                                        return (
                                            <div key={`${machine.turno}-${machine.machineId}`} className="flex items-stretch gap-3">
                                                <div className="w-32 shrink-0 flex flex-col justify-center">
                                                    <p className="text-xs font-bold text-gray-800">{machine.machineId}</p>
                                                    <p className="text-sm font-extrabold text-gray-900 font-mono">{machine.usedHours.toFixed(2)} / {machine.capacityHours.toFixed(2)} h</p>
                                                </div>
                                                <div className="flex-1">
                                                    <div className="relative h-10 bg-gray-50 border border-gray-200 rounded-md overflow-hidden">
                                                        {machine.capacityHours > 0 && machine.capacityHours <= GANTT_HOURS_SCALE && (
                                                            <div
                                                                className="absolute top-0 bottom-0 border-l-[3px] border-dashed border-slate-600 z-20"
                                                                style={{ left: `${(machine.capacityHours / GANTT_HOURS_SCALE) * 100}%` }}
                                                                title={`Límite de capacidad: ${machine.capacityHours.toFixed(2)} h`}
                                                            />
                                                        )}
                                                        {machine.items.map((item, idx) => {
                                                            const left = (item.startHour / GANTT_HOURS_SCALE) * 100;
                                                            const width = ((item.endHour - item.startHour) / GANTT_HOURS_SCALE) * 100;
                                                            return (
                                                                <div
                                                                    key={`${item.order.source}-${item.order.id}-${item.order.material}-${idx}`}
                                                                    className={cn(
                                                                        "absolute top-0.5 bottom-0.5 border rounded-sm px-1 flex items-center overflow-hidden bg-indigo-200 border-indigo-300 text-indigo-900",
                                                                        item.overflow && "ring-2 ring-red-600"
                                                                    )}
                                                                    style={{ left: `${left}%`, width: `${Math.max(width, 0.5)}%` }}
                                                                    title={`${item.order.nombre} (${item.order.material}) — ${(item.endHour - item.startHour).toFixed(2)} h${item.overflow ? ' — EXCEDE CAPACIDAD' : ''}`}
                                                                >
                                                                    <span className="text-[9px] font-semibold truncate">{item.order.material}</span>
                                                                </div>
                                                            );
                                                        })}
                                                    </div>
                                                </div>
                                                <div className="w-14 shrink-0 flex items-center justify-end">
                                                    <span
                                                        className={cn(
                                                            "text-xs font-extrabold",
                                                            utilizacionPct > 100 ? 'text-red-600' : utilizacionPct >= 90 ? 'text-emerald-700' : 'text-gray-600'
                                                        )}
                                                    >
                                                        {utilizacionPct.toFixed(0)}%
                                                    </span>
                                                </div>
                                            </div>
                                        );
                                    })}
                                    <div className="flex items-stretch gap-3">
                                        <div className="w-32 shrink-0" />
                                        <div className="flex-1 flex justify-between text-[9px] text-gray-400 font-mono px-0.5">
                                            {Array.from({ length: GANTT_HOURS_SCALE + 1 }, (_, h) => h).filter(h => h % 2 === 0).map(h => (
                                                <span key={h}>{formatShiftClockLabel(getEffectiveStartTimeParaTurno(turno.id), h)}</span>
                                            ))}
                                        </div>
                                        <div className="w-14 shrink-0" />
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                </div>
            )}
        </div>
    );
};
