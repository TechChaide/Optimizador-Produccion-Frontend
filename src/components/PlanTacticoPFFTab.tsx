'use client';

import React, { useState, useEffect, useMemo } from 'react';
import * as XLSX from 'xlsx';
import { serviciosService } from '@/services/servicios.service';
import { planGrupoService } from '@/services/plangrupo.service';
import { detalleTacticoService } from '@/services/detalletactico.service';
import { useAppContext } from '@/context/AppProvider';
import { Layers, Loader2, PlayCircle, LayoutGrid, PackageSearch, Clock, Gauge, Sun, Moon, RefreshCw, Stethoscope, Plus, X, FileSpreadsheet, Save, TriangleAlert, MinusCircle, PlusCircle, Lightbulb, RotateCcw, CheckCircle2, Circle } from 'lucide-react';
import { Table, TableHeader, TableBody, TableFooter, TableRow, TableHead, TableCell } from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { AlertDialog, AlertDialogContent, AlertDialogHeader, AlertDialogTitle, AlertDialogDescription, AlertDialogFooter, AlertDialogAction } from '@/components/ui/alert-dialog';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Progress } from '@/components/ui/progress';
import { cn } from '@/lib/utils';
import type { Restriccion, Grupo, PlanGrupo, DetalleTactico } from '@/types/interfaces';
import type { ComponentePlanchaAccum } from './PlanGrupoEnsambladoPFFTab';

const normalizeMaterialCode = (code: string | number): string => {
    const codeStr = String(code).trim();
    return codeStr.slice(-8);
};

// 5 Mesas de Pegado físicas, sobre las que se distribuye equitativamente la producción — mismo recurso
// físico que usa "Plan Táctico" (ProvisionalOrdersPlanchasMixtasTab)
const WORK_STATIONS_PM = Array.from({ length: 5 }, (_, i) => ({
    id: i + 1,
    name: `MESA DE PEGADO ${i + 1}`,
}));

// Personas asumidas por mesa, usado para prorratear las horas de una cita médica entre las mesas
// activas del turno correspondiente
const PERSONAS_POR_MESA = 2;

type TurnoId = 'dia' | 'noche';

const TURNOS_PM: { id: TurnoId; label: string; startTime: string; icon: typeof Sun }[] = [
    { id: 'dia', label: 'Turno Día', startTime: '07:00', icon: Sun },
    { id: 'noche', label: 'Turno Noche', startTime: '21:00', icon: Moon },
];

const SHIFT_DURATIONS_PM = [
    { id: '8.7h', label: '8.7 horas / 07:00 a 15:45', hours: 8.7 },
    { id: '9.7h', label: '9.7 horas / 07:00 a 17:00', hours: 9.7 },
    { id: '10.7h', label: '10.7 horas / 07:00 a 18:00', hours: 10.7 },
    { id: '11.7h', label: '11.7 horas / 07:00 a 19:00 (Demanda Alta)', hours: 11.7 },
] as const;

// Rango de utilización de capacidad considerado eficiente (ni mucho déficit ni mucho desperdicio)
const UTILIZACION_EFICIENTE_MIN = 85;
const UTILIZACION_EFICIENTE_MAX = 105;

const addHoursToTime = (startTime: string, hours: number): string => {
    const [h, m] = startTime.split(':').map(Number);
    const totalMinutes = Math.round((h * 60 + m + hours * 60) % (24 * 60));
    const endH = Math.floor(totalMinutes / 60);
    const endM = totalMinutes % 60;
    return `${String(endH).padStart(2, '0')}:${String(endM).padStart(2, '0')}`;
};

const CENTRO_PLANIFICACION_PM = '1000';

interface LoadStage {
    key: string;
    label: string;
    current: number;
    total: number;
    status: 'pending' | 'loading' | 'done';
}

// A diferencia de "Plan Táctico" (que descarga Previsionales/Fert/Tiempos/Inventario porque construye sus
// propias órdenes desde SAP), aquí las "órdenes" YA vienen calculadas (componentesPlancha, con su Tiempo
// Requerido ya incluido) desde "Plan Grupo Ensamblado (PFF)". Solo se necesita descargar Fert (para la
// Producción Propia Pendiente del kardex) e Inventario (Stock Actual y RespCtrlProd de cada componente).
const LOAD_STAGE_DEFS: Array<Pick<LoadStage, 'key' | 'label'>> = [
    { key: 'fert', label: 'Órdenes Fert (Producción Propia Pendiente)' },
    { key: 'inventario', label: 'Inventario' },
];

// Plancha Mixta Equivalente: unidad de medida estándar del área (1 equivalente = 5.38 minutos de fabricación)
const MINUTOS_POR_PLANCHA_EQUIVALENTE = 5.38;

const getDateKeyOffset = (offsetDays: number): string => {
    const d = new Date();
    d.setDate(d.getDate() + offsetDays);
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${y}-${m}-${day}`;
};

interface PMOrder {
    id: string;
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
// de Materiales de los Componentes de Plancha. Kardex: Stock Actual + Producción Propia Pendiente =
// Disponible Real; Cantidad Neta Requerida = max(0, Necesario - Disponible Real). A diferencia de "Plan
// Táctico", aquí no existe un "Consumo de Órdenes Pasadas Pendientes" que descontar, ya que la demanda de
// origen (Explosión PFF) no tiene ese concepto de días anteriores pendientes.
interface PMComponentNeed {
    componente: string;
    descripcion: string;
    unidad: string;
    totalNecesario: number;
    stockActual: number | null;
    produccionPropiaPendiente: number;
    disponibleReal: number | null;
    cantidadNetaAConseguir: number;
}

interface MedicalAppointment {
    id: string;
    nombre: string;
    horas: number;
    turno: TurnoId;
}

interface CapacityDiscount {
    id: string;
    razon: string;
    horas: number;
    turno: TurnoId;
}

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

// Sufijos de PlanGrupo exclusivos de este flujo (PFF), distintos de "PFSP"/"P2" que usa "Plan Táctico",
// para que ninguno de los dos módulos detecte por error un plan guardado por el otro como duplicado
const SUFIJO_PFSP_PFF = 'PFSP-PFF';
const SUFIJO_P2_PFF = 'P2-PFF';

interface PlanTacticoPFFTabProps {
    restricciones: Restriccion[];
    componentesPlancha: ComponentePlanchaAccum[];
    fechaObjetivo: string | null;
}

export const PlanTacticoPFFTab: React.FC<PlanTacticoPFFTabProps> = ({ restricciones, componentesPlancha, fechaObjetivo }) => {
    const { addNotification } = useAppContext();

    // Grupo Prensado (codigo_grupo=9): las Mesas de Pegado son un recurso físico de este grupo, sin
    // importar que la demanda de esta pestaña provenga de la Explosión PFF de Ensamblado
    const prensadoGrupo = useMemo<Grupo | undefined>(() => {
        const conGrupo = restricciones as (Restriccion & { grupo?: Grupo })[];
        return conGrupo.find(r => r.grupo)?.grupo;
    }, [restricciones]);

    const [allFertRaw, setAllFertRaw] = useState<any[]>([]);
    const [materialRespCtrlProdMap, setMaterialRespCtrlProdMap] = useState<Map<string, string>>(new Map());
    const [materialStockActualMap, setMaterialStockActualMap] = useState<Map<string, number>>(new Map());
    const [isLoading, setIsLoading] = useState(false);
    const [loadStages, setLoadStages] = useState<LoadStage[]>(() => LOAD_STAGE_DEFS.map(d => ({ ...d, current: 0, total: 0, status: 'pending' as const })));

    // Configuración de los dos turnos: habilitado, duración de jornada y mesas asignadas a cada uno.
    const [turnoEnabled, setTurnoEnabled] = useState<Record<TurnoId, boolean>>({ dia: true, noche: false });
    const [turnoDuration, setTurnoDuration] = useState<Record<TurnoId, string>>({ dia: SHIFT_DURATIONS_PM[0].id, noche: SHIFT_DURATIONS_PM[0].id });
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

    const [medicalAppointments, setMedicalAppointments] = useState<MedicalAppointment[]>([]);
    const [showMedicalForm, setShowMedicalForm] = useState(false);
    const [medicalNombre, setMedicalNombre] = useState('');
    const [medicalHoras, setMedicalHoras] = useState('');
    const [medicalTurno, setMedicalTurno] = useState<TurnoId>('dia');

    const [capacityDiscounts, setCapacityDiscounts] = useState<CapacityDiscount[]>([]);
    const [showDiscountForm, setShowDiscountForm] = useState(false);
    const [discountRazon, setDiscountRazon] = useState('');
    const [discountHoras, setDiscountHoras] = useState('');
    const [discountTurno, setDiscountTurno] = useState<TurnoId>('dia');

    const [hasPlanned, setHasPlanned] = useState(false);
    const [pmDistribution, setPmDistribution] = useState<Map<string, PMStationEntry> | null>(null);
    const [isExplodingMaterials, setIsExplodingMaterials] = useState(false);
    const [laminaEspumaResults, setLaminaEspumaResults] = useState<PMComponentNeed[]>([]);
    const [laminaPrensadaResults, setLaminaPrensadaResults] = useState<PMComponentNeed[]>([]);
    const [isRecalculatingPlan, setIsRecalculatingPlan] = useState(false);

    const [isSavingPlan, setIsSavingPlan] = useState(false);

    const [planCheckModal, setPlanCheckModal] = useState<
        | { type: 'not-found' }
        | { type: 'found'; planesGrupo: PlanGrupo[] }
        | { type: 'vista'; planesGrupo: PlanGrupo[]; detalles: DetalleTactico[] }
        | null
    >(null);
    const [isPlanCheckBusy, setIsPlanCheckBusy] = useState(false);

    const [showNuevaPlanificacionConfirm, setShowNuevaPlanificacionConfirm] = useState(false);
    const [selectedProposalId, setSelectedProposalId] = useState<string | null>(null);

    const updateLoadStage = (key: string, patch: Partial<LoadStage>) => {
        setLoadStages(prev => prev.map(s => (s.key === key ? { ...s, ...patch } : s)));
    };

    const fetchAllData = async () => {
        setIsLoading(true);
        setLoadStages(LOAD_STAGE_DEFS.map(d => ({ ...d, current: 0, total: 0, status: 'pending' as const })));
        try {
            // Órdenes Fert (todo el dataset, sin filtrar por RespCtrlProd): producción propia YA en curso de
            // cada componente (Espuma/Prensada), usada más abajo en el kardex de la Explosión de Materiales
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

            // Cubo de Inventarios: RespCtrlProd de cada componente (013 Espuma / 017 Prensada) y Stock
            // Actual (bruto, sumado por Material a través de todos los Centros) para el kardex
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

            addNotification('success', 'Datos de Plan Táctico PFF cargados correctamente.');
        } catch (error) {
            addNotification('error', `Error al cargar datos de Plan Táctico PFF: ${(error as Error).message}`);
        } finally {
            setIsLoading(false);
        }
    };

    useEffect(() => {
        fetchAllData();
    }, []);

    const overallLoadPercent = useMemo(() => {
        if (loadStages.length === 0) return 0;
        const sum = loadStages.reduce((acc, s) => {
            if (s.status === 'done') return acc + 100;
            if (s.status === 'loading' && s.total > 0) return acc + Math.min(100, (s.current / s.total) * 100);
            return acc;
        }, 0);
        return Math.round(sum / loadStages.length);
    }, [loadStages]);

    const handleRefreshData = async () => {
        const eraRecalculo = hasPlanned;
        await fetchAllData();
        setHasPlanned(false);
        setPmDistribution(null);
        setLaminaEspumaResults([]);
        setLaminaPrensadaResults([]);
        setSelectedProposalId(null);
        setIsRecalculatingPlan(eraRecalculo);
        addNotification('info', eraRecalculo
            ? 'Datos actualizados desde SAP. Presione "PASO 2: RECALCULAR PLANIFICACIÓN AJUSTADA" para recalcular con la información más reciente.'
            : 'Datos actualizados desde SAP. Vuelva a presionar "EJECUTAR PLANIFICACIÓN" para recalcular.');
    };

    // Reinicia toda la configuración y el progreso de la planificación en curso. Los Componentes de
    // Plancha (prop) NO se recalculan aquí — para eso hay que volver a ejecutar la "Explosión de
    // Materiales" en "Plan Grupo Ensamblado (PFF)".
    const handleNuevaPlanificacion = () => {
        setTurnoEnabled({ dia: true, noche: false });
        setTurnoDuration({ dia: SHIFT_DURATIONS_PM[0].id, noche: SHIFT_DURATIONS_PM[0].id });
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

    // Cada Componente de Plancha de la Explosión PFF (ya con su Tiempo Requerido calculado) se convierte en
    // una "orden" a repartir entre las Mesas de Pegado — mismo rol que las órdenes Previsional/Fert en
    // "Plan Táctico", pero la fuente aquí es la tabla "Explosión de Materiales — Componentes de Plancha"
    const pmOrders = useMemo<PMOrder[]>(() => {
        return componentesPlancha
            .map(c => {
                const cantidad = Math.round(c.cantidadTotal);
                return {
                    id: c.componente,
                    material: c.componente,
                    nombre: c.descripcion,
                    cantidad,
                    tiempoUnitMin: cantidad > 0 ? (c.horasRequeridas * 60) / cantidad : 0,
                    horas: c.horasRequeridas,
                    fecha: fechaObjetivo ?? '',
                };
            })
            .filter(o => o.cantidad > 0 && o.horas > 0);
    }, [componentesPlancha, fechaObjetivo]);

    const totalHorasRequeridas = useMemo(() => pmOrders.reduce((s, o) => s + o.horas, 0), [pmOrders]);
    const totalCantidadRequerida = useMemo(() => pmOrders.reduce((s, o) => s + o.cantidad, 0), [pmOrders]);
    // Plancha Mixta Equivalente: unidad de medida estándar del área, donde 1 equivalente = 5.38 min
    const totalPlanchasEquivalentes = useMemo(() => (totalHorasRequeridas * 60) / MINUTOS_POR_PLANCHA_EQUIVALENTE, [totalHorasRequeridas]);

    // Slots de capacidad activos: una combinación Turno + Mesa por cada mesa habilitada en cada turno activo
    const activeSlots = useMemo<PMSlot[]>(() => {
        const slots: PMSlot[] = [];
        TURNOS_PM.forEach(turno => {
            if (!turnoEnabled[turno.id]) return;
            const durationHours = SHIFT_DURATIONS_PM.find(d => d.id === turnoDuration[turno.id])?.hours ?? 0;
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

    // Descuento de capacidad por motivos generales: se descuentan COMPLETAS de CADA mesa activa del turno
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

    // Ejecuta realmente la planificación (llamado directamente si no había plan guardado para la fecha
    // objetivo, o tras "PROCEDER"/"Borrar Plan(es) Guardado(s)" en el chequeo de plan duplicado)
    const confirmRunPlanning = () => {
        setHasPlanned(true);
        setPmDistribution(null);
        setLaminaEspumaResults([]);
        setLaminaPrensadaResults([]);
        setSelectedProposalId(null);
        setIsRecalculatingPlan(false);
        setPlanCheckModal(null);
        addNotification('success', `Planificación calculada: ${pmOrders.length} componente(s), ${totalHorasRequeridas.toFixed(2)} h requeridas.`);
    };

    // Antes de ejecutar la planificación, se verifica si ya existe un Plan Táctico PFF guardado (PlanGrupo
    // del Grupo Prensado, patrón "...-PFSP-PFF"/"...-P2-PFF") para la fecha objetivo de la Explosión PFF
    const handleRunPlanning = async () => {
        if (pmOrders.length === 0) {
            addNotification('warning', 'No hay Componentes de Plancha (Explosión PFF) para planificar. Ejecute primero "Explosión de Materiales" en "Plan Grupo Ensamblado (PFF)" y presione "Ir a Plan Táctico PFF".');
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
            const fechaObjetivoKey = fechaObjetivo ?? getDateKeyOffset(0);
            const sufijoPattern = new RegExp(`${SUFIJO_PFSP_PFF}\\s*$|${SUFIJO_P2_PFF}\\s*$`, 'i');
            const existentes = (res.data || []).filter(p => {
                if (p.codigo_grupo !== prensadoGrupo.codigo_grupo) return false;
                if (!sufijoPattern.test(String(p.valor || '').trim())) return false;
                return String(p.fecha_inicio_plan).slice(0, 10) === fechaObjetivoKey;
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

            addNotification('success', `Plan(es) Táctico(s) PFF anterior(es) (${planesGrupo.map(p => p.valor).join(', ')}) eliminado(s). Puede continuar con la nueva planificación.`);
            confirmRunPlanning();
        } catch (error) {
            addNotification('error', `Error al eliminar el plan guardado: ${(error as Error).message}`);
        } finally {
            setIsPlanCheckBusy(false);
        }
    };

    // Distribuye CADA Componente de Plancha en partes exactamente iguales entre todos los slots de
    // capacidad activos (Turno + Mesa) — mismo algoritmo de "Plan Táctico": residuo repartido rotando
    // qué mesas lo reciben en cada orden, para que ninguna mesa quede sistemáticamente con más carga.
    const handleDistributePM = () => {
        if (pmOrders.length === 0 || activeSlots.length === 0) return;

        const n = activeSlots.length;
        const slotHours = new Map<string, number>(activeSlots.map(s => [slotKey(s.turno, s.stationId), 0]));
        const slotItems = new Map<string, PMOrder[]>(activeSlots.map(s => [slotKey(s.turno, s.stationId), []]));

        pmOrders.forEach((order, orderIdx) => {
            const baseQty = Math.floor(order.cantidad / n);
            const remainder = order.cantidad % n;

            activeSlots.forEach((slot, slotIdx) => {
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
        addNotification('success', `Distribución ejecutada: cada componente se repartió en partes iguales entre las ${n} mesa(s)-turno activas.`);
    };

    const horasPorMesa = useMemo(
        () => (activeSlots.length > 0 ? totalHorasRequeridas / activeSlots.length : 0),
        [totalHorasRequeridas, activeSlots]
    );

    // % de utilización de la capacidad: Horas Requeridas / Capacidad Disponible ajustada
    const utilizacionActualPct = useMemo(
        () => (capacidadDisponibleAjustada > 0 ? (totalHorasRequeridas / capacidadDisponibleAjustada) * 100 : Infinity),
        [totalHorasRequeridas, capacidadDisponibleAjustada]
    );

    // Propuesta de Ajuste de Capacidad: mismo criterio que "Plan Táctico" — si la utilización está fuera
    // del rango eficiente, evalúa cambiar jornada (prioridad) o mesas activas (segunda opción)
    const capacityProposal = useMemo<CapacityProposalOption[]>(() => {
        if (!hasPlanned || totalHorasRequeridas <= 0) return [];
        if (utilizacionActualPct >= UTILIZACION_EFICIENTE_MIN && utilizacionActualPct <= UTILIZACION_EFICIENTE_MAX) return [];

        const distanciaAEficiente = (pct: number): number => {
            if (pct < UTILIZACION_EFICIENTE_MIN) return UTILIZACION_EFICIENTE_MIN - pct;
            if (pct > UTILIZACION_EFICIENTE_MAX) return pct - UTILIZACION_EFICIENTE_MAX;
            return 0;
        };
        const distanciaActual = distanciaAEficiente(utilizacionActualPct);

        const deduccionesFijas = totalMedicalDeduction + totalCapacityDiscount - totalAdicionalCapacidad;
        const opciones: CapacityProposalOption[] = [];

        TURNOS_PM.forEach(turno => {
            if (!turnoEnabled[turno.id]) return;
            const mesasActuales = turnoStations[turno.id].size;
            if (mesasActuales === 0) return;
            const duracionActualId = turnoDuration[turno.id];
            const duracionActualHoras = SHIFT_DURATIONS_PM.find(d => d.id === duracionActualId)?.hours ?? 0;
            const capacidadOtrosSlots = capacidadDisponible - (mesasActuales * duracionActualHoras);

            SHIFT_DURATIONS_PM.forEach(d => {
                if (d.id === duracionActualId) return;
                const capacidadResultante = Math.max(0, capacidadOtrosSlots + (mesasActuales * d.hours) - deduccionesFijas);
                if (capacidadResultante <= 0) return;
                opciones.push({
                    id: `turno-${turno.id}-${d.id}`,
                    turno: turno.id,
                    tipo: 'turno',
                    nuevaDuracionId: d.id,
                    descripcion: `${turno.label}: cambiar jornada de ${SHIFT_DURATIONS_PM.find(x => x.id === duracionActualId)?.label} a ${d.label}`,
                    capacidadResultante,
                    utilizacionPct: (totalHorasRequeridas / capacidadResultante) * 100,
                });
            });

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

        const mejores = opciones
            .filter(o => distanciaAEficiente(o.utilizacionPct) < distanciaActual)
            .sort((a, b) => {
                if (a.tipo !== b.tipo) return a.tipo === 'turno' ? -1 : 1;
                return distanciaAEficiente(a.utilizacionPct) - distanciaAEficiente(b.utilizacionPct);
            });

        const mejorTurno = mejores.find(o => o.tipo === 'turno');
        const mejorMesas = mejores.find(o => o.tipo === 'mesas');
        return [mejorTurno, mejorMesas].filter((o): o is CapacityProposalOption => !!o);
    }, [hasPlanned, totalHorasRequeridas, utilizacionActualPct, capacidadDisponible, turnoEnabled, turnoStations, turnoDuration, totalMedicalDeduction, totalCapacityDiscount, totalAdicionalCapacidad]);

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

    // Exporta a Excel la tabla "Planificación Calculada — Plan Táctico PFF" (pmOrders)
    const handleExportPlanningPMExcel = () => {
        if (pmOrders.length === 0) return;

        const rows = pmOrders.map(o => ({
            'Componente': o.material,
            'Descripción': o.nombre,
            'Fecha Objetivo': o.fecha,
            'Cantidad': o.cantidad,
            'Horas': Number(o.horas.toFixed(2)),
        }));

        const worksheet = XLSX.utils.json_to_sheet(rows);
        const workbook = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(workbook, worksheet, 'Planificación Calculada PFF');

        const fechaArchivo = getDateKeyOffset(0);
        XLSX.writeFile(workbook, `Planificacion_Calculada_PFF_${fechaArchivo}.xlsx`);
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

    // Guarda el Plan Táctico PFF en el Grupo Prensado (codigo_grupo=9), separado en 2 PlanGrupo — mismo
    // patrón que "Plan Táctico" pero con sufijos exclusivos (PFSP-PFF/P2-PFF) y fecha_inicio_plan = fecha
    // objetivo de la Explosión PFF (no "hoy"), ya que ese es el día que realmente se está planificando.
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
            const fechaPlan = fechaObjetivo ? new Date(`${fechaObjetivo}T00:00:00`) : new Date();

            const savePlanGrupo = async (sufijo: string): Promise<number> => {
                const planPayload = {
                    codigo_plan_grupo: 0,
                    codigo_plan: null,
                    codigo_grupo: prensadoGrupo.codigo_grupo,
                    codigo_familia_grupo: null,
                    valor: `Plan Táctico PFF - Centro ${prensadoGrupo.centro} - ${sufijo}`,
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

            if (hayPFSP) {
                const codigoPlanGrupoPFSP = await savePlanGrupo(SUFIJO_PFSP_PFF);
                for (const comp of laminaPrensadaResults) {
                    await saveDetalle(codigoPlanGrupoPFSP, Number(comp.componente) || 0, comp.cantidadNetaAConseguir, '017');
                }
            }

            if (hayP2) {
                const codigoPlanGrupoP2 = await savePlanGrupo(SUFIJO_P2_PFF);
                for (const comp of laminaEspumaResults) {
                    await saveDetalle(codigoPlanGrupoP2, Number(comp.componente) || 0, comp.cantidadNetaAConseguir, '013');
                }
            }

            const partes = [
                hayPFSP ? `${SUFIJO_PFSP_PFF} (${laminaPrensadaResults.length} detalle(s))` : null,
                hayP2 ? `${SUFIJO_P2_PFF} (${laminaEspumaResults.length} detalle(s))` : null,
            ].filter(Boolean).join(', ');
            addNotification('success', `Plan Táctico PFF guardado: ${partes}.`);
        } catch (error) {
            console.error('Error al guardar el Plan Táctico PFF:', error);
            addNotification('error', `Error al guardar el Plan Táctico PFF: ${(error as Error).message}`);
        } finally {
            setIsSavingPlan(false);
        }
    };

    // Explosiona los Componentes de Plancha ya distribuidos en mesas para identificar, dentro de ellos, sus
    // propios sub-componentes de Lámina de Espuma (013)/Prensada (017) — mismo mecanismo que "Plan Táctico".
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

        // Producción propia pendiente de cada COMPONENTE (Espuma/Prensada): órdenes Fert que fabrican ese
        // mismo material, con fecha anterior a la fecha objetivo y todavía pendientes — producción que ya
        // estará disponible para cuando se necesite.
        const cutoffKey = fechaObjetivo ?? getDateKeyOffset(0);
        const componentOwnFertPendingMap = new Map<string, number>();
        allFertRaw.forEach((row: any) => {
            const fechaKey = String(row.FECHA || '').trim().slice(0, 10);
            const pendiente = Number(row.CANTPENDIENTE) || 0;
            if (fechaKey && pendiente > 0 && fechaKey < cutoffKey) {
                const material = normalizeMaterialCode(row.MATERIAL || '');
                componentOwnFertPendingMap.set(material, (componentOwnFertPendingMap.get(material) || 0) + pendiente);
            }
        });

        setIsExplodingMaterials(true);
        addNotification('info', `Iniciando explosión de ${uniqueMaterials.length} material(es) único(s)...`);

        try {
            const responses = await Promise.all(uniqueMaterials.map(async (material) => {
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

            const ensure = (map: Map<string, RawComponentAccum>, componente: string, descripcion: string, unidad: string) => {
                if (!map.has(componente)) {
                    map.set(componente, { componente, descripcion, unidad, totalNecesario: 0 });
                }
                return map.get(componente)!;
            };

            responses.forEach((components, idx) => {
                const material = uniqueMaterials[idx];
                const parentDemand = materialDemandMap.get(material) || 0;
                if (parentDemand === 0) return;

                components.forEach((comp: any) => {
                    const descripcion = String(comp.DESCRIPCION_COMPONENTE || '').trim();
                    const componente = String(comp.COMPONENTE || '').trim();
                    if (!componente) return;

                    const cantBase = Number(comp.CANTIDAD_ACUMULADA ?? comp.CANTIDAD_UNITARIA ?? 0);
                    const necesario = cantBase * parentDemand;
                    const unidad = String(comp.UNIDAD || 'UN');
                    const respCtrlProd = materialRespCtrlProdMap.get(normalizeMaterialCode(componente));

                    if (necesario <= 0) return;

                    if (respCtrlProd === '013') {
                        ensure(groupedEspuma, componente, descripcion, unidad).totalNecesario += necesario;
                    }
                    if (respCtrlProd === '017') {
                        ensure(groupedPrensada, componente, descripcion, unidad).totalNecesario += necesario;
                    }
                });
            });

            // Kardex: Stock Actual + Producción Propia Pendiente = Disponible Real; Cantidad Neta Requerida =
            // max(0, Necesario - Disponible Real)
            const withKardex = (c: RawComponentAccum): PMComponentNeed => {
                const stockActual = materialStockActualMap.get(normalizeMaterialCode(c.componente)) ?? null;
                const produccionPropiaPendiente = componentOwnFertPendingMap.get(normalizeMaterialCode(c.componente)) || 0;
                const disponibleReal = (stockActual !== null || produccionPropiaPendiente > 0)
                    ? (stockActual ?? 0) + produccionPropiaPendiente
                    : null;
                const cantidadNetaAConseguir = disponibleReal !== null ? Math.max(0, c.totalNecesario - disponibleReal) : c.totalNecesario;
                return {
                    componente: c.componente,
                    descripcion: c.descripcion,
                    unidad: c.unidad,
                    totalNecesario: c.totalNecesario,
                    stockActual,
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

    if (isLoading && allFertRaw.length === 0) {
        return (
            <div className="flex flex-col items-center justify-center py-20 bg-gray-50 rounded-xl border-2 border-dashed gap-4">
                <Loader2 className="w-12 h-12 animate-spin text-indigo-600" />
                <p className="text-sm font-bold text-gray-700">Descargando datos de Plan Táctico PFF...</p>
            </div>
        );
    }

    return (
        <div className="space-y-6">
            <div className="bg-white border border-gray-200 rounded-xl p-4 shadow-sm">
                <p className="text-[11px] text-gray-500">
                    Fuente: <span className="font-bold text-gray-700">Explosión de Materiales — Componentes de Plancha</span> de
                    "Plan Grupo Ensamblado (PFF)" — Fecha objetivo:{' '}
                    <span className="font-bold text-gray-700">{fechaObjetivo || '—'}</span> —{' '}
                    <span className="font-bold text-gray-700">{componentesPlancha.length}</span> componente(s) recibido(s).
                    {componentesPlancha.length === 0 && (
                        <span className="text-amber-600 font-semibold"> Vaya a "Plan Grupo Ensamblado (PFF)", ejecute "Explosión de Materiales" y presione "Ir a Plan Táctico PFF".</span>
                    )}
                </p>
            </div>

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
                    Planificando <span className="font-bold">{pmOrders.length} componente(s) de Plancha</span> del{' '}
                    <span className="font-bold">Centro {CENTRO_PLANIFICACION_PM} (Quito)</span> — fecha objetivo{' '}
                    <span className="font-bold">{fechaObjetivo || '—'}</span>.
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
                        const durationHours = SHIFT_DURATIONS_PM.find(d => d.id === turnoDuration[turno.id])?.hours ?? 0;
                        const endTime = addHoursToTime(turno.startTime, durationHours);
                        return (
                            <div key={turno.id} className={cn("border rounded-lg p-4 space-y-3", enabled ? "border-indigo-200 bg-indigo-50/30" : "border-gray-200 bg-gray-50/50")}>
                                <div className="flex items-center justify-between">
                                    <div className="flex items-center gap-2">
                                        <Icon className={cn("w-4 h-4", enabled ? "text-indigo-600" : "text-gray-400")} />
                                        <span className={cn("text-xs font-bold uppercase", enabled ? "text-gray-800" : "text-gray-400")}>{turno.label}</span>
                                        <span className="text-[10px] font-mono text-gray-400">({turno.startTime} - {endTime})</span>
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
                                                {SHIFT_DURATIONS_PM.map(d => (
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
                            <h3 className="text-sm font-bold text-white uppercase tracking-wide">Planificación Calculada — Plan Táctico PFF</h3>
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
                                <p className="text-[10px] font-bold text-blue-500 uppercase">Horas Requeridas</p>
                                <p className="text-xl font-black text-blue-800">{totalHorasRequeridas.toFixed(2)} h</p>
                                <p className="text-[10px] text-blue-400">{pmOrders.length} componente(s) de Plancha (Explosión PFF)</p>
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
                                capacidadDisponibleAjustada >= totalHorasRequeridas ? "bg-emerald-50 border-emerald-200" : "bg-red-50 border-red-200"
                            )}>
                                <p className={cn("text-[10px] font-bold uppercase", capacidadDisponibleAjustada >= totalHorasRequeridas ? "text-emerald-500" : "text-red-500")}>
                                    {capacidadDisponibleAjustada >= totalHorasRequeridas ? 'Capacidad Sobrante' : 'Déficit de Capacidad'}
                                </p>
                                <p className={cn("text-xl font-black", capacidadDisponibleAjustada >= totalHorasRequeridas ? "text-emerald-800" : "text-red-800")}>
                                    {Math.abs(capacidadDisponibleAjustada - totalHorasRequeridas).toFixed(2)} h
                                </p>
                            </div>
                            <div className="bg-indigo-50 border border-indigo-200 rounded-lg p-4">
                                <p className="text-[10px] font-bold text-indigo-500 uppercase">Total Cantidad Física</p>
                                <p className="text-xl font-black text-indigo-800">{totalCantidadRequerida.toLocaleString()}</p>
                                <p className="text-[10px] text-indigo-400">unidades de Componentes de Plancha a fabricar</p>
                            </div>
                        </div>

                        <div className="bg-fuchsia-50 border border-fuchsia-200 rounded-lg p-4 flex items-center justify-between gap-4 flex-wrap">
                            <div>
                                <p className="text-[10px] font-bold text-fuchsia-500 uppercase">Horas Requeridas por Mesa</p>
                                <p className="text-[10px] text-fuchsia-400">
                                    {totalHorasRequeridas.toFixed(2)} h ÷ {activeSlots.length} mesa(s)-turno escogida(s)
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
                                        <TableHead className="text-[10px] font-extrabold text-gray-600 uppercase border-r border-gray-200">Componente</TableHead>
                                        <TableHead className="text-[10px] font-extrabold text-gray-600 uppercase border-r border-gray-200">Descripción</TableHead>
                                        <TableHead className="text-[10px] font-extrabold text-gray-600 uppercase text-center border-r border-gray-200">Fecha Objetivo</TableHead>
                                        <TableHead className="text-[10px] font-extrabold text-gray-600 uppercase text-center border-r border-gray-200">Cantidad</TableHead>
                                        <TableHead className="text-[10px] font-extrabold text-gray-600 uppercase text-center">Horas</TableHead>
                                    </TableRow>
                                </TableHeader>
                                <TableBody>
                                    {pmOrders.map((o, idx) => (
                                        <TableRow key={`${o.id}-${idx}`} className={cn("border-b border-gray-200", idx % 2 === 1 && "bg-gray-50/70")}>
                                            <TableCell className="text-[11px] border-r border-gray-200 font-mono font-semibold text-gray-800">{o.material}</TableCell>
                                            <TableCell className="text-[11px] border-r border-gray-200 text-gray-600">{o.nombre}</TableCell>
                                            <TableCell className="text-[11px] text-center border-r border-gray-200 font-mono">{o.fecha || '—'}</TableCell>
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
                            <span className="font-semibold">mesas</span> es una segunda opción.
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
                                            name="capacity-proposal-pff"
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

            {pmDistribution && pmDistribution.size > 0 && (
                <div className="bg-white border border-gray-200 rounded-xl shadow-md overflow-hidden">
                    <div className="flex items-center justify-between px-6 py-4 bg-gradient-to-r from-slate-900 to-purple-900">
                        <div className="flex items-center gap-2">
                            <LayoutGrid className="w-5 h-5 text-purple-200" />
                            <h3 className="text-sm font-bold text-white uppercase tracking-wide">Distribución Equitativa — Mesas de Pegado</h3>
                        </div>
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
                            <h3 className="text-sm font-bold text-white uppercase tracking-wide">Explosión de Materiales — Semielaborados de Espuma (Plan Táctico PFF)</h3>
                        </div>
                        <Button
                            onClick={() => exportComponentNeedsToExcelPM(laminaEspumaResults, 'Laminas Espuma PFF', 'Explosion_Materiales_Laminas_Espuma_PFF')}
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
                                        <TableCell colSpan={7} className="text-[11px] font-extrabold text-orange-900 uppercase text-right border-r border-orange-200">Total General (Neto Requerido)</TableCell>
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
                            <h3 className="text-sm font-bold text-white uppercase tracking-wide">Explosión de Materiales — Semielaborados Prensados (Plan Táctico PFF)</h3>
                        </div>
                        <Button
                            onClick={() => exportComponentNeedsToExcelPM(laminaPrensadaResults, 'Laminas Prensadas PFF', 'Explosion_Materiales_Laminas_Prensadas_PFF')}
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
                                        <TableCell colSpan={7} className="text-[11px] font-extrabold text-teal-900 uppercase text-right border-r border-teal-200">Total General (Neto Requerido)</TableCell>
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
                    title="Guardar Plan Táctico PFF y sus Detalles"
                    className="fixed bottom-6 right-6 z-50 flex items-center gap-2 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-60 disabled:cursor-not-allowed text-white font-bold text-sm px-5 py-3.5 rounded-full shadow-xl shadow-emerald-900/30 transition-colors"
                >
                    {isSavingPlan ? <Loader2 className="w-5 h-5 animate-spin" /> : <Save className="w-5 h-5" />}
                    {isSavingPlan ? 'Guardando Plan...' : 'Guardar Plan Táctico PFF'}
                </button>
            )}

            {/* Ventana de progreso de "Actualizar Datos" */}
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

            {/* No existe un Plan Táctico PFF guardado para la fecha objetivo: confirmar antes de proceder */}
            <AlertDialog open={planCheckModal?.type === 'not-found'} onOpenChange={(open) => !open && setPlanCheckModal(null)}>
                <AlertDialogContent>
                    <AlertDialogHeader>
                        <AlertDialogTitle>Verificación de Plan Táctico PFF</AlertDialogTitle>
                        <AlertDialogDescription>
                            No existe Plan Táctico PFF guardado del Grupo Prensado con fecha objetivo{' '}
                            <span className="font-bold text-gray-800">{fechaObjetivo || getDateKeyOffset(0)}</span>.
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                        <Button variant="outline" onClick={() => setPlanCheckModal(null)}>CANCELAR</Button>
                        <AlertDialogAction onClick={confirmRunPlanning}>PROCEDER</AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>

            {/* Ya existe(n) Plan(es) Táctico(s) PFF guardado(s) para la fecha objetivo: Vista o Borrar */}
            <AlertDialog open={planCheckModal?.type === 'found'} onOpenChange={(open) => !open && setPlanCheckModal(null)}>
                <AlertDialogContent>
                    <AlertDialogHeader>
                        <AlertDialogTitle className="flex items-center gap-2 text-amber-700">
                            <TriangleAlert className="w-5 h-5" />
                            Ya existe un Plan Táctico PFF guardado
                        </AlertDialogTitle>
                        <AlertDialogDescription>
                            Ya existe Plan Táctico PFF guardado del Grupo Prensado con fecha objetivo{' '}
                            <span className="font-bold text-gray-800">{fechaObjetivo || getDateKeyOffset(0)}</span>{' '}
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

            {/* Modo Vista: detalle de materiales realmente guardado para el/los Plan(es) Táctico(s) PFF encontrado(s) */}
            <Dialog open={planCheckModal?.type === 'vista'} onOpenChange={(open) => !open && setPlanCheckModal(null)}>
                <DialogContent className="max-w-3xl">
                    <DialogHeader>
                        <DialogTitle>Modo Vista — Plan Táctico PFF Guardado</DialogTitle>
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
                                                Este Plan Táctico PFF no tiene Detalles Tácticos asociados.
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
                            nada de lo ya guardado en SAP ni en Plan Táctico PFF — solo el progreso que no ha guardado todavía.
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
