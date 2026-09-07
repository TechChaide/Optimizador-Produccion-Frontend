'use client';

import React, { useState, useEffect, useMemo, useCallback, useRef, useImperativeHandle } from 'react';
import * as XLSX from 'xlsx';
import { serviciosService } from '@/services/servicios.service';
import { ecuadorHolidaysService } from '@/services/ecuador-holidays.service';
import { planGrupoService } from '@/services/plangrupo.service';
import { detalleTacticoService } from '@/services/detalletactico.service';
import { restriccionService } from '@/services/restriccion.service';
import { useAppContext } from '@/context/AppProvider';
import { Package, Loader2, Search, Clock, Calendar, CalendarDays, LayoutDashboard, History, PlayCircle, Settings2, CheckCircle2, Users, Percent, Wrench, Gauge, Boxes, TriangleAlert, ClipboardCheck, FileSpreadsheet, LayoutGrid, TimerOff, X, Plus, Layers, PackageSearch, Save, CalendarClock, Lightbulb, Building2, Copy, RefreshCw, RotateCcw, Circle, Download, BedDouble } from 'lucide-react';
import { Table, TableHeader, TableBody, TableFooter, TableRow, TableHead, TableCell } from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { Switch } from '@/components/ui/switch';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { AlertDialog, AlertDialogContent, AlertDialogHeader, AlertDialogTitle, AlertDialogDescription, AlertDialogFooter, AlertDialogAction } from '@/components/ui/alert-dialog';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Progress } from '@/components/ui/progress';
import { cn } from '@/lib/utils';
import type { Restriccion, Grupo, PlanGrupo, DetalleTactico } from '@/types/interfaces';

interface ProvisionalOrdersAlphaTabProps {
  restricciones: Restriccion[];
  tiemposData?: any[];
}

// Handle imperativo expuesto al padre (TacticalPlanMueblesSection) para que otras pestañas hermanas
// (ej. "Plan Grupo Recuperado", cuando ya no hay déficit de espuma) puedan disparar "Actualizar Datos"
// sin que este componente deje de ser dueño de su propio estado de planificación.
export interface ProvisionalOrdersAlphaTabHandle {
  refreshData: (forcePasoFinal?: boolean) => Promise<void>;
}

const ROWS_PER_PAGE_OPTIONS = [20, 50, 100, 500];

const normalizeMaterialCode = (code: string | number): string => {
  const codeStr = String(code).trim();
  return codeStr.slice(-8);
};

// Generar lista de mesas 1 a 14
const WORK_TABLES = Array.from({ length: 14 }, (_, i) => ({
  id: i + 1,
  name: `MESA DE TRABAJO ${i + 1}`
}));

type TableAssignments = Record<number, { person: string; percentage: string }>;

// Persistencia (localStorage, por Centro) de la última asignación de personal por mesa guardada
// exitosamente, para pre-cargarla por defecto en la siguiente planificación y evitar reasignar
// manualmente cada vez. El usuario siempre puede cambiar a la persona de cualquier mesa después.
const TABLE_ASSIGNMENTS_STORAGE_PREFIX = 'tacticalPlanMuebles_lastTableAssignments_';

const getTableAssignmentsStorageKey = (centro: string): string => `${TABLE_ASSIGNMENTS_STORAGE_PREFIX}Centro${centro}`;

const saveLastTableAssignments = (centro: string, assignments: TableAssignments): void => {
  try {
    localStorage.setItem(getTableAssignmentsStorageKey(centro), JSON.stringify(assignments));
  } catch (error) {
    console.error('[TableAssignments] Error guardando en localStorage:', error);
  }
};

const loadLastTableAssignments = (centro: string): TableAssignments => {
  try {
    const stored = localStorage.getItem(getTableAssignmentsStorageKey(centro));
    if (stored) return JSON.parse(stored) as TableAssignments;
  } catch (error) {
    console.error('[TableAssignments] Error leyendo de localStorage:', error);
  }
  return {};
};

// Factor de eficiencia: del tiempo del turno, la fracción realmente productiva de una persona.
const EFFICIENCY_FACTOR = 0.87;

// Horas productivas por persona en una mesa = horas del turno × factor de eficiencia
// (8 h → 6.96 · 9 h → 7.83 · 10 h → 8.7). Es el tiempo BASE de cada mesa, al que después se le
// aplican el porcentaje de la persona, su calificación, los mantenimientos preventivos y los
// descuentos generales de horas (ver mesaCapacityByTable).
const productiveHoursPerTable = (shiftHours: number) => Math.round(shiftHours * EFFICIENCY_FACTOR * 100) / 100;

// Horarios de trabajo disponibles para la planificación táctica.
// displayEndTime: hora de fin que se MUESTRA al usuario (menú de horario y línea de fin de turno del
// Diagrama de Gantt). Es puramente visual — endTime (usado en el cálculo de solapamiento con
// Mantenimientos Preventivos) y hoursPerTable (usado en el cálculo de capacidad) NO cambian.
const SHIFT_SCHEDULES = [
  { id: '8h', label: '8 horas / 07:00 - 15:45', shiftHours: 8, hoursPerTable: productiveHoursPerTable(8), startTime: '07:00', endTime: '16:45', displayEndTime: '15:45' },
  { id: '9h', label: '9 horas / 07:00 - 17:00', shiftHours: 9, hoursPerTable: productiveHoursPerTable(9), startTime: '07:00', endTime: '17:00', displayEndTime: '17:00' },
  { id: '10h', label: '10 horas / 07:00 a 18:00', shiftHours: 10, hoursPerTable: productiveHoursPerTable(10), startTime: '07:00', endTime: '18:00', displayEndTime: '18:00' },
] as const;

// Ecuador (America/Guayaquil) está en UTC-5 todo el año, sin horario de verano
const ECUADOR_UTC_OFFSET_HOURS = 5;

// Convierte una hora local de Ecuador ("HH:MM") en una fecha calendario dada, a un instante UTC
const shiftTimeToUTC = (baseDate: Date, timeStr: string): Date => {
    const [hours, minutes] = timeStr.split(':').map(Number);
    return new Date(Date.UTC(
        baseDate.getFullYear(),
        baseDate.getMonth(),
        baseDate.getDate(),
        hours + ECUADOR_UTC_OFFSET_HOURS,
        minutes
    ));
};

// Formatea un instante UTC como hora local de Ecuador ("HH:MM")
const formatEcuadorTime = (date: Date): string => {
    return date.toLocaleTimeString('es-EC', { hour: '2-digit', minute: '2-digit', hour12: false, timeZone: 'America/Guayaquil' });
};

// Cargos habilitados para operar una Mesa de Trabajo
const ALLOWED_ROLES = ['TAPICERO QUITO', 'ENSAMBLADOR DE MUEBLES', 'AUXILIAR DE PRODUCCION'];

interface PersonnelOption {
    nombre: string;
    rol: string;
    calificacion: number;
}

// Cantidad de días laborables hacia adelante que cubre el cálculo de capacidad
const WORKING_DAYS_TARGET = 3;
// Días calendario a explorar hacia adelante para encontrar los días laborables (buffer por feriados/fines de semana)
const PLANNING_LOOKAHEAD_DAYS = 21;

const DAY_NAMES_SHORT = ['DOM', 'LUN', 'MAR', 'MIÉ', 'JUE', 'VIE', 'SÁB'];

const toDateKey = (date: Date): string => {
    const y = date.getFullYear();
    const m = String(date.getMonth() + 1).padStart(2, '0');
    const d = String(date.getDate()).padStart(2, '0');
    return `${y}-${m}-${d}`;
};

// Suma N días laborables (omite sábado y domingo) a una fecha
const addBusinessDays = (date: Date, days: number): Date => {
    const result = new Date(date);
    let remaining = days;
    while (remaining > 0) {
        result.setDate(result.getDate() + 1);
        const dayOfWeek = result.getDay();
        if (dayOfWeek !== 0 && dayOfWeek !== 6) {
            remaining--;
        }
    }
    return result;
};

// Suma N días CALENDARIO (sin saltar fines de semana ni feriados) a una fecha. Usada para las fechas
// de archivo de "Primer Nivel"/"Segundo Nivel" de Muebles (hoy+2 / hoy+1), que el usuario definió como
// aritmética de calendario simple, no días laborables.
const addCalendarDays = (date: Date, days: number): Date => {
    const result = new Date(date);
    result.setHours(0, 0, 0, 0);
    result.setDate(result.getDate() + days);
    return result;
};

const formatFechaDDMMYYYY = (date: Date): string =>
    `${String(date.getDate()).padStart(2, '0')}.${String(date.getMonth() + 1).padStart(2, '0')}.${date.getFullYear()}`;

interface PlanningDay {
    date: Date;
    key: string;
    dayOfWeek: number;
    isWeekend: boolean;
    holidayName: string | null;
    isDefaultWorking: boolean;
    isActivated: boolean;
    included: boolean;
}

// Cantidad máxima de unidades MTS (Make To Stock) que se planifican en un mismo día; el resto se difiere
const MTS_SEGREGATION_LIMIT = 10;

// Mueble Equivalente: unidad de medida estándar del área (1 equivalente = 32.21 minutos de fabricación)
const MINUTOS_POR_MUEBLE_EQUIVALENTE = 32.21;

// Sectores de inventario relevantes para la clasificación de tamaño y la distribución por mesa
const SECTOR_CAMAS = '02 BASES-CABECERO-CAMA';
const SECTOR_MUEBLES = '03 MUEBLES FABRICACIÓN';

// Una orden cuyo material tiene, en el Cubo de Inventarios de SAP, un Sector explícito que NO es
// Camas ni Muebles (ej. Colchones, Telas) no pertenece a esta área, aunque su RespCtrlProd coincida
// por error/superposición con los códigos válidos de Muebles (ver restricción "RespCtrlProd"). Se
// excluye de plano de la planificación, sin reportarla como error de "Fecha de Entrega no encontrada".
// Si SAP no tiene Sector cargado (vacío), no se excluye aquí: se deja que resolveSectorReparacion
// intente deducirlo por descripción (materiales "MUEBLE DE REPARACIÓN").
const esSectorAjenoAMuebles = (sectorSAP: string | undefined): boolean =>
    !!sectorSAP && sectorSAP !== SECTOR_CAMAS && sectorSAP !== SECTOR_MUEBLES;

// Responsables de Control de Fabricación que definen las tablas "Primer Nivel"/"Segundo Nivel" de la
// Explosión de Materiales de Muebles (independiente de la descripción del componente).
const RESP_CTRL_PROD_PRIMER_NIVEL = ['026', '033'];
const RESP_CTRL_PROD_SEGUNDO_NIVEL = ['042', '037'];

// Dentro de "Primer Nivel", los semielaborados cuya descripción empieza con "FORRO FALSO COSIDO" o
// "FORRO COJIN INTER" se graban en su archivo descargable (txt/Excel) con hoy+1 en vez de hoy+2 (el
// resto de la tabla) — proceso más corto según el usuario.
const esExcepcionFechaCortaPrimerNivel = (descripcion: string): boolean => {
    const d = descripcion.trim().toUpperCase();
    return d.startsWith('FORRO FALSO COSIDO') || d.startsWith('FORRO COJIN INTER');
};

// "Segundo Nivel" excluye por completo (ni en pantalla ni en los archivos) los semielaborados cuya
// descripción contenga "PET", "MASCOTA" o "FUN" (líneas de producto ajenas a Muebles), o que empiecen
// con "TELA" (ej. "TELA DE APROVECHAMIENTO", código 30020937, RespCtrlProd '037' — el usuario no quiere
// telas en esta tabla bajo ninguna circunstancia).
const esExcluidoSegundoNivel = (descripcionUpper: string): boolean =>
    descripcionUpper.includes('PET') || descripcionUpper.includes('MASCOTA') || descripcionUpper.includes('FUN')
    || descripcionUpper.startsWith('TELA');

// "Primer Nivel" excluye por completo (ni en pantalla ni en los archivos):
// - Descripción que EMPIEZA con "COJIN CILINDRICO" o "FORRO COJIN CILINDRICO" (ej. código 30025771,
//   "FORRO COJIN CILINDRICO ELEMENTA ARENA"): material ficticio en SAP, se fabrica con un proveedor
//   externo. Sus componentes reales ("FORRO COJIN"/"COJIN INTER", sin "CILINDRICO") sí quedan en la
//   tabla, porque son entradas independientes del árbol de la explosión (no dependen de este filtro).
// - Descripción que CONTIENE "BASE" o "ENSAMBLE": materiales ficticios que se fabrican en otra área
//   productiva (confirmado por el usuario: comparación de texto simple por fila, sin recorrer el
//   árbol de componentes).
//   Excepción: "BASE DUO" (ej. códigos 30009791/30009792/otros, "ESTRUCTURA PEGADA BASE DUO 105/135/
//   160", RespCtrlProd '033', Categoria SAP "M-ES-DUO") NO es un material ficticio — es una línea de
//   estructuras reales cuyo nombre de producto incluye "BASE DUO"; se excluía por error junto con los
//   ficticios genuinos por la misma coincidencia de texto "BASE". Confirmado en vivo (2026-08-24) que
//   sí tiene órdenes Fert propias pendientes con RespCtrlProd '033'.
// - Descripción que CONTIENE "MASCOTA" o "PET": líneas de producto ajenas a Muebles.
const esExcluidoPrimerNivel = (descripcionUpper: string): boolean =>
    descripcionUpper.startsWith('COJIN CILINDRICO') ||
    descripcionUpper.startsWith('FORRO COJIN CILINDRICO') ||
    (descripcionUpper.includes('BASE') && !descripcionUpper.includes('BASE DUO')) ||
    descripcionUpper.includes('ENSAMBLE') ||
    descripcionUpper.includes('MASCOTA') ||
    descripcionUpper.includes('PET');

// Mesas de Línea 2 (Muebles) habilitadas como válvula de alivio para Camas: solo se usan cuando la
// Línea 1 (Línea de Camas) ya no tiene capacidad disponible en ninguna de sus mesas habituales.
const CAMAS_OVERFLOW_MESA_IDS = [12, 13];

// Umbrales de clasificación de tamaño por Sector (minutos del tiempo unitario de fabricación)
const SIZE_THRESHOLDS: Record<string, { pequeñoMax: number; medianoMax: number }> = {
    [SECTOR_CAMAS]: { pequeñoMax: 20, medianoMax: 94 },
    [SECTOR_MUEBLES]: { pequeñoMax: 36, medianoMax: 147 },
};

type MaterialSize = 'Pequeño' | 'Mediano' | 'Grande';

const classifyMaterialSize = (sector: string | null, minutos: number): MaterialSize | null => {
    if (!sector) return null;
    const thresholds = SIZE_THRESHOLDS[sector];
    if (!thresholds) return null;
    if (minutos <= thresholds.pequeñoMax) return 'Pequeño';
    if (minutos <= thresholds.medianoMax) return 'Mediano';
    return 'Grande';
};

// Los "MUEBLES DE REPARACIÓN" (Grupo de Artículos 2022, tipo HALB) vienen SIN Sector en el Cubo de
// Inventarios, por lo que quedaban sin clasificación de tamaño y ninguna mesa los aceptaba: aparecían
// en la alerta "material(es) sin mesa asignada" y no se planificaban. Mientras el maestro de SAP no
// tenga el Sector, este se deduce de la descripción: la parte que sigue a "MUEBLE DE REPARACIÓN"
// nombra el producto que se repara (CAMA 160, CABECERO, BASE = Línea de Camas; OTTOMAN, BENCH,
// VELADOR, RECLINABLE, MIRAGE, ... = Línea de Muebles).
const REPARACION_PREFIX_REGEX = /^MUEBLE\s+(DE\s+)?REPARACI[OÓ]N\s*/;

// Productos reparados que pertenecen al Sector de Camas. DUO va aquí porque el producto terminado
// "DUO" es la BASE DUO (Sector 02); en Muebles solo existe como FORRO BASE DUO (componente).
// Cualquier otro producto de reparación (modelos de mueble) se trata como Muebles.
const REPARACION_CAMAS_KEYWORDS = ['CAMA', 'CABECERO', 'BASE', 'DUO'];

// Sector deducido para un material de reparación; null si el material no es de reparación
const resolveSectorReparacion = (nombre: string): string | null => {
    const descripcion = nombre.toUpperCase().trim();
    if (!REPARACION_PREFIX_REGEX.test(descripcion)) return null;

    const producto = descripcion.replace(REPARACION_PREFIX_REGEX, '');
    const esCama = REPARACION_CAMAS_KEYWORDS.some(palabra => new RegExp(`\\b${palabra}\\b`).test(producto));
    return esCama ? SECTOR_CAMAS : SECTOR_MUEBLES;
};

// Reparaciones que NO se hacen en las mesas del plan de Muebles, sino en las mesas de Línea 2 – Muebles
// que quedan fuera de la planificación y sirven de apoyo a la Línea de Camas (las marcadas con
// "Habilitar para Camas"). Hoy aplica solo al plastificado ("MUEBLE DE REPARACIÓN PLAST.").
const REPARACION_APOYO_CAMAS_KEYWORDS = ['PLAST'];

const esReparacionApoyoCamas = (nombre: string): boolean => {
    const descripcion = nombre.toUpperCase().trim();
    if (!REPARACION_PREFIX_REGEX.test(descripcion)) return false;

    const producto = descripcion.replace(REPARACION_PREFIX_REGEX, '');
    return REPARACION_APOYO_CAMAS_KEYWORDS.some(palabra => producto.includes(palabra));
};

// Formatea una fecha a "DD-MM-YYYY" (mismo formato que el mapa de Fechas de Entrega construido desde getPendientesTotales)
const formatDDMMYYYY = (date: Date): string => {
    const d = String(date.getDate()).padStart(2, '0');
    const m = String(date.getMonth() + 1).padStart(2, '0');
    const y = date.getFullYear();
    return `${d}-${m}-${y}`;
};

// Parsea una fecha con formato "DD-MM-YYYY" a un objeto Date (medianoche local)
const parseDDMMYYYY = (value: string): Date | null => {
    const parts = value.split('-');
    if (parts.length !== 3) return null;
    const [d, m, y] = parts.map(Number);
    if (!d || !m || !y) return null;
    return new Date(y, m - 1, d);
};

// Parsea una fecha "YYYY-MM-DD" (tal como la devuelve el ERP) como medianoche LOCAL,
// evitando que `new Date("YYYY-MM-DD")` la interprete como medianoche UTC (lo que
// corre la fecha un día hacia atrás en zonas horarias negativas como Ecuador UTC-5).
const parseERPDateOnly = (value: string): Date | null => {
    const parts = String(value).trim().split('-');
    if (parts.length !== 3) return null;
    const [y, m, d] = parts.map(Number);
    if (!y || !m || !d) return null;
    return new Date(y, m - 1, d);
};

interface UnifiedOrder {
    source: 'Previsional' | 'Fert';
    id: string;
    material: string;
    nombre: string;
    centro: string;
    pedido: string;
    // Posición del pedido (POSICIONPEDIDO en Previsionales, POSICION en Fert), para el detalle de impresión
    posicion: string;
    cantidadTotal: number;
    cantidadPlanificada: number;
    cantidadDiferida: number;
    tipo: 'MTO' | 'MTS';
    sector: string | null;
    tamano: MaterialSize | null;
    tiempoUnitMin: number;
    horas: number;
    fechaEntrega: string;
    fechaEntregaDate: Date;
    // Fecha propia de la orden en el ERP (FECHAINICIO en Previsionales, FECHA en Fert).
    // Se usa para excluir de la planificación las órdenes Fert ya programadas/en proceso.
    fechaPropia: Date | null;
    // Fecha de creación de la orden en el ERP (FECHAORDEN en Fert; no existe para Previsionales).
    // Se usa como sustituto de "Fecha de Liberación Real" (no disponible en la API) para sugerir en
    // "Órdenes que se Pueden Mover" las órdenes Fert MTS recién creadas hoy.
    fechaOrden: Date | null;
    isPTBO: boolean;
}

// Orden MTO (con PEDIDO) cuya fecha de entrega no pudo resolverse: el pedido no existe en Pendientes Totales
interface OrderMissingDeliveryDate {
    source: 'Previsional' | 'Fert';
    id: string;
    pedido: string;
    material: string;
    nombre: string;
}

// Insumo (Tela, Casco u otra materia prima) que el usuario marcó como "no disponible todavía" — ver
// "Materiales en Espera de Insumo". Persistido como Restriccion.
interface MaterialEnEspera {
    codigoRestriccion: number;
    insumoCodigo: string;
    descripcion: string;
    fechaDisponible: Date;
}

// Un insumo en espera concreto que bloquea a un material padre (ese insumo aparece en su explosión)
interface InsumoBloqueante {
    insumoCodigo: string;
    insumoDescripcion: string;
    fechaDisponible: Date;
}

// Orden excluida de la planificación porque su material padre necesita, en algún nivel de su explosión,
// un insumo que todavía no llega (ver "Materiales en Espera de Insumo")
interface OrderBlockedByInsumo {
    order: UnifiedOrder;
    insumos: InsumoBloqueante[];
}

// Recomendación de aumento de capacidad para una línea, cuando hay órdenes diferidas por falta de capacidad
interface MesaCapacityRecommendation {
    linea: string;
    horasFaltantes: number;
    ordenesAfectadas: number;
    mesasInactivasSugeridas: number[];
}

interface PlanningResult {
    targetDate: Date;
    immediateOrders: UnifiedOrder[];
    extraOrders: UnifiedOrder[];
    totalHoursRequired: number;
    totalCapacityAvailable: number;
    ptboAlerts: UnifiedOrder[];
    missingDeliveryDate: OrderMissingDeliveryDate[];
    excludedByFechaPropia: OrderMissingDeliveryDate[];
    // Órdenes excluidas por completo porque su material padre necesita un insumo que todavía no llega
    // (ver "Materiales en Espera de Insumo"), salvo las que el usuario forzó manualmente a incluir.
    blockedByInsumo: OrderBlockedByInsumo[];
    // Órdenes dentro de la ventana de prioridad que no cupieron en la capacidad disponible
    // (se difieren empezando por las fechas de entrega más lejanas)
    deferredByCapacity: UnifiedOrder[];
    capacityRecommendations: MesaCapacityRecommendation[];
    // Órdenes MTO planificadas para la fecha objetivo pero con fecha de entrega posterior a la
    // ventana de prioridad: candidatas a mover a un día posterior para liberar capacidad.
    movableOrders: UnifiedOrder[];
    // Pedidos MTO con más de 10 unidades en una sola línea: usualmente cadenas comerciales grandes
    // cuya fabricación debe distribuirse en varios días (3 a 5), no producirse toda de una vez.
    largeOrders: LargeOrderAlert[];
    // Qué paso del flujo (1/2/3) generó este resultado. Paso 2 y 3 ya incluyen las movibles/diferidas
    // tal cual están en SAP (el usuario ya decidió qué mover); Paso 3 (Final, tras ajustar por la
    // capacidad real de espuma en "Plan Grupo Recuperado") además hace que "Guardar Plan Táctico" se
    // comporte como "Guardar Plan Final" (genera el PlanGrupo PFSM con el Detalle de Planificación
    // Ejecutada, sin volver a guardar P1.3/P1.5/P2).
    planningStepResult: 1 | 2 | 3;
}

// Pedido de gran volumen (más de MTS_SEGREGATION_LIMIT unidades en una sola línea de un cliente/pedido)
interface LargeOrderAlert {
    source: 'Previsional' | 'Fert';
    id: string;
    pedido: string;
    cliente: string;
    material: string;
    nombre: string;
    cantidad: number;
    fechaEntrega: string;
}

// Escala fija del eje X del Diagrama de Gantt de capacidad (en horas)
const GANTT_HOURS_SCALE = 12;

// "HH:MM" -> minutos totales desde medianoche
const parseHHMM = (time: string): number => {
    const [h, m] = time.split(':').map(Number);
    return h * 60 + m;
};

// Hora real de reloj (formato "HH:MM") correspondiente a un offset en horas desde el inicio del
// turno seleccionado, usada para etiquetar el eje X del Diagrama de Gantt con horas reales en vez
// de un conteo genérico "0h, 2h, ...".
const formatShiftClockLabel = (shiftStartTime: string, offsetHours: number): string => {
    const totalMinutes = parseHHMM(shiftStartTime) + Math.round(offsetHours * 60);
    const hh = Math.floor(totalMinutes / 60);
    const mm = totalMinutes % 60;
    return `${String(hh).padStart(2, '0')}:${String(mm).padStart(2, '0')}`;
};

interface MesaScheduleItem {
    order: UnifiedOrder;
    startHour: number;
    endHour: number;
    overflow: boolean;
}

interface MesaDistributionEntry {
    tableId: number;
    linea: 'Línea 1 – Línea de Camas' | 'Línea 2 – Línea de Muebles';
    capacityHours: number;
    usedHours: number;
    items: MesaScheduleItem[];
}

// Snapshot histórico de una Distribución de Mesas ya ejecutada (o modulada) para una fecha objetivo
// concreta — persistido como Restriccion (ver PLAN_DIARIO_PREFIJO) para que la pestaña "PLAN" pueda
// mostrar el horario/mesas/personal/Gantt REALES de días anteriores, en vez de recalcularlos con
// supuestos genéricos. Un ítem por material asignado, ya con todo lo necesario para redibujar el Gantt
// sin volver a consultar SAP ni el maestro de Habilidades.
interface PlanDiarioSnapshotItem {
    material: string;
    nombre: string;
    source: 'Previsional' | 'Fert';
    id: string;
    cantidad: number;
    tamano: MaterialSize | null;
    startHour: number;
    endHour: number;
    overflow: boolean;
}

interface PlanDiarioSnapshotMesa {
    tableId: number;
    tableName: string;
    linea: MesaDistributionEntry['linea'];
    capacityHours: number;
    usedHours: number;
    person: string;
    percentage: string;
    calificacion: number | null;
    items: PlanDiarioSnapshotItem[];
}

interface PlanDiarioSnapshot {
    fecha: string; // YYYY-MM-DD
    shiftId: string;
    shiftLabel: string;
    shiftStartTime: string;
    shiftDisplayEndTime: string;
    mesas: PlanDiarioSnapshotMesa[];
}

// Material padre (de la Distribución de Mesas) del que proviene la necesidad de un componente, y las
// órdenes de producción concretas que lo generan
interface ComponentOrigen {
    materialPadre: string;
    ordenes: string[];
}

// Mismo criterio de normalización ya usado en handleMaterialExplosion para distinguir "LAMINA
// CILINDRICA" (con o sin tilde en la Í) del resto de semielaborados de espuma.
function esDescripcionLaminaCilindrica(descripcion: string): boolean {
    return descripcion.toUpperCase().normalize('NFD').replace(/[̀-ͯ]/g, '').startsWith('LAMINA CILINDRICA');
}

// Semielaborado de espuma (Lamina/Espuma) requerido, obtenido de la Explosión de Materiales
interface FoamComponentNeed {
    componente: string;
    descripcion: string;
    unidad: string;
    // Cantidad bruta necesaria solo para las órdenes de la fecha objetivo que se está planificando
    totalNecesario: number;
    // Stock Actual del componente (mismo campo StockActual de getCuboInventarios)
    stockActual: number | null;
    // Cantidad de este mismo componente que van a consumir órdenes de días ANTERIORES a la fecha
    // objetivo que todavía están pendientes (Fert con CANTPENDIENTE > 0, Previsionales previos)
    consumoOrdenesPasadas: number;
    // Órdenes Fert de FABRICACIÓN del componente MISMO (no de sus consumidores), de días ANTERIORES a
    // la fecha objetivo y todavía pendientes (CANTPENDIENTE > 0): producción propia ya en curso que
    // sumará como disponible. No aplica para Telas/Cascos (siempre 0 ahí).
    produccionPropiaPendiente: number;
    // Kardex: Stock Actual - Consumo de Órdenes Pasadas Pendientes + Producción Propia Pendiente (lo que
    // realmente queda/quedará disponible para la planificación de hoy)
    disponibleReal: number | null;
    // Cantidad Neta Requerida = max(0, totalNecesario - disponibleReal). Si no hay dato de
    // stock, se asume el caso conservador: se necesita todo el bruto.
    cantidadNetaAConseguir: number;
    // Material(es) padre y orden(es) de producción de la fecha objetivo de donde proviene esta necesidad
    origenes: ComponentOrigen[];
}

// Tela (empieza con "TELA MUEBLES"), con la Alerta de Stock (mismo criterio de la pestaña "Telas": StockActual < 300 = "CRÍTICO")
interface TelaComponentNeed extends FoamComponentNeed {
    alertaStock: boolean;
    // Stock Actual - Cantidad Total Necesaria: lo que queda (o, si es negativo, lo que realmente falta)
    // de esta tela crítica luego de cubrir la necesidad de hoy. Se usa en la Alerta de Stock en vez de
    // cantidadNetaAConseguir, que da 0 cuando el stock alcanza aunque esté por debajo del umbral CRÍTICO.
    stockRestante: number;
}

// Casco (empieza con "CASCO"): sin stock suficiente cuando la Cantidad Neta Requerida es mayor a cero
interface CascoComponentNeed extends FoamComponentNeed {
    sinStock: boolean;
}

// Determina si una mesa puede recibir un material según su Sector y clasificación de tamaño
const mesaAcceptsMaterial = (mesaId: number, sector: string | null, tamano: MaterialSize | null): boolean => {
    if (!sector || !tamano) return false;
    if (mesaId >= 1 && mesaId <= 7) {
        return sector === SECTOR_CAMAS;
    }
    if (mesaId >= 8 && mesaId <= 14) {
        if (mesaId === 10) {
            if (sector === SECTOR_CAMAS) return true;
            if (sector === SECTOR_MUEBLES) return tamano !== 'Grande';
            return false;
        }
        return sector === SECTOR_MUEBLES;
    }
    return false;
};

const getMesaLinea = (mesaId: number): MesaDistributionEntry['linea'] => {
    return mesaId <= 7 ? 'Línea 1 – Línea de Camas' : 'Línea 2 – Línea de Muebles';
};

// Una fila por cada fuente de datos que fetchAllData descarga en secuencia, para la ventana de progreso
// de "Actualizar Datos"/"Sincronizar Datos".
interface LoadStage {
    key: string;
    label: string;
    current: number;
    total: number;
    status: 'pending' | 'loading' | 'done';
}

const LOAD_STAGE_DEFS: Array<Pick<LoadStage, 'key' | 'label'>> = [
    { key: 'pendientes', label: 'Fechas de Entrega (Pendientes Totales)' },
    { key: 'inventario', label: 'Inventario' },
    { key: 'tiempos', label: 'Tiempos de Ensamblado' },
    { key: 'fert', label: 'Órdenes Fert' },
    { key: 'alpha', label: 'Órdenes Previsionales Alpha' },
];

export const ProvisionalOrdersAlphaTab = React.forwardRef<ProvisionalOrdersAlphaTabHandle, ProvisionalOrdersAlphaTabProps>(({ restricciones, tiemposData = [] }, ref) => {
    const { addNotification } = useAppContext();
    const [allRawData, setAllRawData] = useState<any[]>([]); 
    const [inventoryMap, setInventoryMap] = useState<Map<string, number>>(new Map());
    const [isLoading, setIsLoading] = useState(false);
    const [searchTerm, setSearchTerm] = useState('');
    const [currentPage, setCurrentPage] = useState(1);
    const [rowsPerPage, setRowsPerPage] = useState(100); 
    const [downloadProgress, setDownloadProgress] = useState({ current: 0, total: 0 });
    // Estado de la ventana de progreso de "Actualizar Datos"/"Sincronizar Datos": una fila por cada fuente
    // que fetchAllData descarga en secuencia, para mostrar en tiempo real cuál está en curso y su avance.
    const [loadStages, setLoadStages] = useState<LoadStage[]>(() => LOAD_STAGE_DEFS.map(d => ({ ...d, current: 0, total: 0, status: 'pending' as const })));
    const [deliveryDatesMap, setDeliveryDatesMap] = useState<Map<string, string>>(new Map());
    // Fecha de entrega por PEDIDO + POSICION (un mismo pedido puede tener líneas con fechas distintas)
    const [deliveryDatesByPositionMap, setDeliveryDatesByPositionMap] = useState<Map<string, string>>(new Map());
    // Centro de ENTREGA (destino: Quito 1000 / Guayaquil 2000) por PEDIDO + POSICION, desde Pendientes
    // Totales. Es distinto del Centro de fabricación (siempre 1000, la planta de Quito), y es el que
    // determina la regla de +1/+2 días laborables de la ventana de prioridad.
    const [deliveryCentroByPositionMap, setDeliveryCentroByPositionMap] = useState<Map<string, string>>(new Map());
    const [deliveryCentroMap, setDeliveryCentroMap] = useState<Map<string, string>>(new Map());
    // Cliente (DESTINATARIO_MERCADERIA) por PEDIDO, para identificar pedidos grandes de cadenas comerciales
    const [pedidoDestinatarioMap, setPedidoDestinatarioMap] = useState<Map<string, string>>(new Map());
    
    // Estado para la Ventana de Fabricación (días laborables hacia adelante)
    const [holidaysMap, setHolidaysMap] = useState<Map<string, string>>(new Map());
    const [activatedSpecialDays, setActivatedSpecialDays] = useState<Set<string>>(new Set());

    // Estado para Mesas de Trabajo Habilitadas
    const [activeTables, setActiveTables] = useState<Set<number>>(new Set(WORK_TABLES.map(t => t.id)));

    // Mesas de Línea 2 (Muebles) habilitadas como válvula de alivio para Camas (antes hardcodeado en
    // CAMAS_OVERFLOW_MESA_IDS = [12, 13]). Configurable por el usuario con el botón "Habilitar para
    // Camas" junto a cada mesa de Línea 2, en vez de estar fijo en el código.
    const [camasOverflowMesaIds, setCamasOverflowMesaIds] = useState<Set<number>>(new Set(CAMAS_OVERFLOW_MESA_IDS));

    // Estado para Horario de Trabajo seleccionado
    const [selectedShift, setSelectedShift] = useState<string>(SHIFT_SCHEDULES[0].id);

    // Estado para las Mesas escogidas (confirmadas) para asignación de personal
    const [chosenTables, setChosenTables] = useState<number[] | null>(null);

    // Estado para el personal disponible (Habilidades) y las asignaciones por mesa
    const [personnelRaw, setPersonnelRaw] = useState<any[]>([]);
    const [tableAssignments, setTableAssignments] = useState<TableAssignments>({});

    // Estado para los Mantenimientos Preventivos Programados (verificación de disponibilidad de mesas)
    const [maintenanceRaw, setMaintenanceRaw] = useState<any[]>([]);

    // Estado para Órdenes Fert, Tiempos de Ensamblado (global) y Sectores de Inventario, usados en la Ejecución de Planificación
    const [fertRawData, setFertRawData] = useState<any[]>([]);
    const [globalTiemposMap, setGlobalTiemposMap] = useState<Map<string, number>>(new Map());
    const [materialSectorMap, setMaterialSectorMap] = useState<Map<string, string>>(new Map());
    // Responsable de Control de Producción (RespCtrlProd) por Material, usado para clasificar semielaborados (ej. Forros)
    const [materialRespCtrlProdMap, setMaterialRespCtrlProdMap] = useState<Map<string, string>>(new Map());
    // Stock Actual (bruto) por Material, sumado a través de todos los Centros — mismo campo que muestran
    // las pestañas "Telas" y "Cascos", usado para comparar contra la Explosión de Materiales
    const [materialStockActualMap, setMaterialStockActualMap] = useState<Map<string, number>>(new Map());
    // Descripción por Material (maestro completo de Inventarios), usada solo para el buscador de
    // "Materiales en Espera de Insumo" (ver más abajo)
    const [materialDescripcionMap, setMaterialDescripcionMap] = useState<Map<string, string>>(new Map());
    // Material padre (código normalizado) -> insumo(s) en espera que aparecen en su explosión de
    // materiales, calculado automáticamente (ver useEffect más abajo) cada vez que cambian los
    // Materiales en Espera guardados o se refrescan los datos de SAP.
    const [materialesBloqueadosMap, setMaterialesBloqueadosMap] = useState<Map<string, InsumoBloqueante[]>>(new Map());
    const [isCheckingMaterialesEnEspera, setIsCheckingMaterialesEnEspera] = useState(false);
    // Órdenes bloqueadas que el usuario decidió forzar a incluir en la planificación de todos modos
    // (checkbox "Forzar Inclusión" en la tabla "Bloqueadas por Insumo"), por clave `${source}-${id}-${material}`
    const [forcedIncludedBlockedIds, setForcedIncludedBlockedIds] = useState<Set<string>>(new Set());
    // Estado del diálogo "Materiales en Espera de Insumo"
    const [isEsperaDialogOpen, setIsEsperaDialogOpen] = useState(false);
    const [esperaSearchTerm, setEsperaSearchTerm] = useState('');
    const [esperaSelectedMaterial, setEsperaSelectedMaterial] = useState<{ codigo: string; descripcion: string } | null>(null);
    const [esperaFechaDisponible, setEsperaFechaDisponible] = useState('');
    const [esperaNota, setEsperaNota] = useState('');
    const [isSavingEspera, setIsSavingEspera] = useState(false);
    const [planningResult, setPlanningResult] = useState<PlanningResult | null>(null);
    // Se activa cuando se actualizan los datos de SAP después de una planificación previa (p. ej. tras
    // mover manualmente algunas órdenes de "Órdenes que se Pueden Mover"), para distinguir el recálculo
    // ajustado ("Paso 2") de la primera ejecución de la planificación, y del paso final ("Paso 3")
    // tras ajustar por la capacidad real de espuma en la pestaña "Plan Grupo Recuperado".
    const [planningStep, setPlanningStep] = useState<1 | 2 | 3>(1);

    // "Órdenes que se Pueden Mover": por defecto se asume que TODAS se producen hoy (checkbox marcado),
    // simulando que ocupan la capacidad sobrante. Al desmarcar una orden (se decide moverla a otro día),
    // sus horas se restan en vivo de "Horas Requeridas"/"Déficit de Capacidad" en "Detalle de Planificación
    // Ejecutada", sin necesidad de volver a ejecutar la planificación. Guarda las claves DESmarcadas
    // (`${source}-${id}-${material}`) — así el default (todo marcado) es un Set vacío.
    const [uncheckedMovableIds, setUncheckedMovableIds] = useState<Set<string>>(new Set());

    const toggleMovableOrderChecked = (key: string) => {
        setUncheckedMovableIds(prev => {
            const next = new Set(prev);
            if (next.has(key)) next.delete(key);
            else next.add(key);
            return next;
        });
    };

    // "Bloqueadas por Insumo": marca/desmarca una orden para forzar su inclusión pese a que su material
    // padre necesite un insumo que todavía no llega. No recalcula sola — el usuario debe presionar
    // "Forzar Inclusión y Recalcular" para que handleRunPlanning vuelva a correr con el nuevo criterio.
    const toggleForcedIncludedBlocked = (key: string) => {
        setForcedIncludedBlockedIds(prev => {
            const next = new Set(prev);
            if (next.has(key)) next.delete(key);
            else next.add(key);
            return next;
        });
    };

    // Simulación en vivo de "Órdenes que se Pueden Mover": arranca asumiendo que TODAS se producen hoy
    // (ocupando la capacidad sobrante) y resta las que el usuario desmarca, para ver en vivo cómo mejora
    // (o empeora) el Déficit/Sobrante de Capacidad sin tener que re-ejecutar la planificación completa.
    const liveCapacityInfo = useMemo(() => {
        if (!planningResult) return null;
        const movableOrderKey = (o: UnifiedOrder) => `${o.source}-${o.id}-${o.material}`;
        const isRecalcLogicNow = planningResult.planningStepResult >= 2;
        // Horas de "movableOrders" que YA están incluidas en planningResult.totalHoursRequired: en Paso
        // 2/3, handleRunPlanning las fusiona todas en immediateOrders (todas tienen fecha propia = fecha
        // objetivo). Hay que restarlas de la base para no contarlas dos veces al recomponer el total en
        // vivo a partir del estado de los checkboxes.
        const movableBaseHoras = isRecalcLogicNow
            ? planningResult.movableOrders.reduce((sum, o) => sum + o.horas, 0)
            : 0;
        const requiredBaseline = planningResult.totalHoursRequired - movableBaseHoras;
        const checkedHoras = planningResult.movableOrders.reduce((sum, o) => {
            return uncheckedMovableIds.has(movableOrderKey(o)) ? sum : sum + o.horas;
        }, 0);
        const liveTotalHoursRequired = requiredBaseline + checkedHoras;
        return {
            liveTotalHoursRequired,
            liveDeficit: planningResult.totalCapacityAvailable - liveTotalHoursRequired,
        };
    }, [planningResult, uncheckedMovableIds]);

    // Estado para la Distribución de Mesas (Diagrama de Gantt de capacidad)
    const [mesaDistribution, setMesaDistribution] = useState<Map<number, MesaDistributionEntry> | null>(null);
    const [unassignedDistributionOrders, setUnassignedDistributionOrders] = useState<UnifiedOrder[]>([]);

    // Estado para la Explosión de Materiales (semielaborados de espuma: Lamina/Espuma)
    const [foamExplosionResults, setFoamExplosionResults] = useState<FoamComponentNeed[]>([]);
    // La tabla de Espuma se muestra dividida en dos secciones (misma tabla, mismo orden por cantidad
    // dentro de cada una): "LAMINA CILINDRICA" aparte del resto de espumas. El guardado en P2 sigue
    // usando foamExplosionResults completo, sin dividir.
    const foamExplosionLaminaCilindrica = useMemo(
        () => foamExplosionResults.filter(c => esDescripcionLaminaCilindrica(c.descripcion)),
        [foamExplosionResults]
    );
    const foamExplosionOtrasEspumas = useMemo(
        () => foamExplosionResults.filter(c => !esDescripcionLaminaCilindrica(c.descripcion)),
        [foamExplosionResults]
    );
    // Estado para la Explosión de Materiales (Semielaborados de Primer Nivel: RESPCTRLPROD '026' o '033')
    const [primerNivelExplosionResults, setPrimerNivelExplosionResults] = useState<FoamComponentNeed[]>([]);
    // Estado para la Explosión de Materiales (Semielaborados de Segundo Nivel: RESPCTRLPROD '042' o '037',
    // excluyendo descripciones con "PET"/"MASCOTA"/"FUN")
    const [segundoNivelExplosionResults, setSegundoNivelExplosionResults] = useState<FoamComponentNeed[]>([]);
    // Estado para la Explosión de Materiales (telas: "TELA MUEBLES"), comparadas contra Stock Actual
    const [telaExplosionResults, setTelaExplosionResults] = useState<TelaComponentNeed[]>([]);
    // Estado para la Explosión de Materiales (cascos: "CASCO"), comparados contra Stock Actual
    const [cascoExplosionResults, setCascoExplosionResults] = useState<CascoComponentNeed[]>([]);
    const [isExplodingMaterials, setIsExplodingMaterials] = useState(false);

    // Aviso emergente de alertas de stock (Telas en estado CRÍTICO / Cascos sin stock suficiente)
    // detectadas en la última Explosión de Materiales
    const [stockAlertDialogOpen, setStockAlertDialogOpen] = useState(false);
    const [stockAlertData, setStockAlertData] = useState<{ telas: TelaComponentNeed[]; cascos: CascoComponentNeed[] }>({ telas: [], cascos: [] });

    // Estado para el guardado del Plan Táctico (PlanGrupo) y sus Detalles (DetalleTactico)
    const [isSavingPlan, setIsSavingPlan] = useState(false);

    // Verificación de Plan Táctico ya guardado para la fecha objetivo, al presionar "ESCOGER MESAS"
    const [planCheckModal, setPlanCheckModal] = useState<
        | { type: 'not-found' }
        | { type: 'found'; planGrupo: PlanGrupo }
        | { type: 'vista'; planGrupo: PlanGrupo; detalles: DetalleTactico[] }
        | null
    >(null);
    const [isPlanCheckBusy, setIsPlanCheckBusy] = useState(false);

    // Confirmación antes de reiniciar toda la planificación en curso ("Planificación Nueva")
    const [showNuevaPlanificacionConfirm, setShowNuevaPlanificacionConfirm] = useState(false);

    // Refs para el sistema de scrollbar doble
    const topScrollRef = useRef<HTMLDivElement>(null);
    const tableScrollRef = useRef<HTMLDivElement>(null);
    const tableRef = useRef<HTMLTableElement>(null);
    const [tableWidth, setTableWidth] = useState(0);
    const lastScrolledRef = useRef<'top' | 'table' | null>(null);

    // Grupo (Muebles) asociado a las restricciones recibidas, usado para el Plan Táctico (PlanGrupo)
    const mueblesGrupo = useMemo<Grupo | undefined>(() => {
        const conGrupo = restricciones as (Restriccion & { grupo?: Grupo })[];
        return conGrupo.find(r => r.grupo)?.grupo;
    }, [restricciones]);

    // 1. Obtención de responsables de las restricciones
    const validRespCodes = useMemo(() => {
        const respRestriccion = restricciones.find(r => r.nombre_restriccion === 'RespCtrlProd');
        if (!respRestriccion || !respRestriccion.valor_restriccion) return [];
        
        return respRestriccion.valor_restriccion
            .split(/[&,]/)
            .map(code => String(code).trim())
            .filter(Boolean);
    }, [restricciones]);

    // 2. Obtención de exclusiones HRNP
    const forbiddenMachinesMap = useMemo(() => {
        const hrnpRestriccion = restricciones.find(r => r.nombre_restriccion === 'HRNP');
        if (!hrnpRestriccion || !hrnpRestriccion.valor_restriccion) return new Map<string, string[]>();
        
        const map = new Map<string, string[]>();
        const regex = /\[([^:]+):\{([^}]+)\}\]/g;
        let match;
        
        const rawValue = hrnpRestriccion.valor_restriccion;
        while ((match = regex.exec(rawValue)) !== null) {
            const respCode = match[1].trim();
            const machines = match[2].split(',').map(m => m.trim()).filter(Boolean);
            map.set(respCode, machines);
        }
        return map;
    }, [restricciones]);

    // 3. Mapa de Tiempos
    const tiemposMap = useMemo(() => {
        const map = new Map<string, number>();
        tiemposData.forEach(item => {
            const materialCode = normalizeMaterialCode(item.CodMaterial ?? item.MATERIAL ?? item.Material ?? '');
            const tiempo = Number(item.Tiempo_Min ?? item.Tiempo ?? 0);
            if (materialCode && tiempo > 0) {
                if (!map.has(materialCode)) {
                    map.set(materialCode, tiempo);
                }
            }
        });
        return map;
    }, [tiemposData]);

    // Órdenes Previsionales filtradas por restricciones de Muebles (sin aplicar el buscador de la tabla)
    const mueblesProvisionalOrders = useMemo(() => {
        if (!allRawData || allRawData.length === 0) return [];
        return allRawData.filter(row => {
            const rowResp = String(row.RESPCONTROLPROD || '').trim();
            if (validRespCodes.length > 0 && !validRespCodes.includes(rowResp)) return false;
            if (forbiddenMachinesMap.has(rowResp)) {
                const rowMachine = String(row.MAQUINA || row.Maquina || '').trim();
                if (forbiddenMachinesMap.get(rowResp)?.includes(rowMachine)) return false;
            }
            return true;
        });
    }, [allRawData, validRespCodes, forbiddenMachinesMap]);

    // Órdenes Fert filtradas por restricciones de Muebles
    const mueblesFertOrders = useMemo(() => {
        if (!fertRawData || fertRawData.length === 0) return [];
        return fertRawData.filter(row => {
            const rowResp = String(row.RESPCTRLPROD || '').trim();
            if (validRespCodes.length > 0 && !validRespCodes.includes(rowResp)) return false;
            if (forbiddenMachinesMap.has(rowResp)) {
                const rowMachine = String(row.MAQUINA || '').trim();
                if (forbiddenMachinesMap.get(rowResp)?.includes(rowMachine)) return false;
            }
            return true;
        });
    }, [fertRawData, validRespCodes, forbiddenMachinesMap]);

    // Verificación de transición: mientras SAP siga liberando órdenes Fert para Muebles, se confía
    // en su fecha propia (FECHA) como la fecha "firme" de fabricación, tal como hasta ahora. El día
    // que ya no se generen más órdenes Fert (proceso de conversión Previsional -> Fert descontinuado),
    // esta bandera pasa a false automáticamente y el motor de planificación trata la fecha propia de
    // las Previsionales (FECHAINICIO) como firme en su lugar, para que nada deje de aparecer.
    // Se evalúa contra el dataset ya filtrado por restricciones de Muebles, no fertRawData completo,
    // para no dar falsos negativos por Fert de otras áreas (Camas, etc.) que sí sigan existiendo.
    const hayOrdenesFertMuebles = mueblesFertOrders.length > 0;

    // "Materiales en Espera de Insumo": el usuario indica un insumo (Tela, Casco u otra materia prima)
    // que todavía no llega y la fecha en la que sí estará disponible. Se persiste como Restriccion (una
    // fila por insumo, bajo el mismo Grupo de Muebles) para no requerir cambios de backend:
    // nombre_restriccion = "EsperaInsumo:<código del insumo>", valor_restriccion = fecha disponible
    // (YYYY-MM-DD), descripcion = texto libre (nombre del insumo + nota opcional del usuario).
    // Se carga con una consulta propia (como ya hace TacticalPlanTallerCorteSection para sus overrides
    // de tiempo) en vez de derivarse de la prop `restricciones` — esa prop es de solo lectura desde el
    // padre y no se puede reescribir localmente tras agregar/eliminar un insumo.
    const ESPERA_INSUMO_PREFIJO = 'EsperaInsumo:';
    const parseMaterialEnEspera = (r: Restriccion): MaterialEnEspera | null => {
        const fecha = parseERPDateOnly(r.valor_restriccion);
        if (!fecha) return null;
        return {
            codigoRestriccion: r.codigo_restriccion,
            insumoCodigo: normalizeMaterialCode(r.nombre_restriccion.slice(ESPERA_INSUMO_PREFIJO.length)),
            descripcion: r.descripcion || '',
            fechaDisponible: fecha,
        };
    };
    const [materialesEnEspera, setMaterialesEnEspera] = useState<MaterialEnEspera[]>([]);
    useEffect(() => {
        if (!mueblesGrupo) return;
        const cargarMaterialesEnEspera = async () => {
            try {
                const res = await restriccionService.getAll();
                const parsed = (res.data || [])
                    .filter(r => r.codigo_grupo === mueblesGrupo.codigo_grupo && r.nombre_restriccion?.startsWith(ESPERA_INSUMO_PREFIJO))
                    .map(parseMaterialEnEspera)
                    .filter((m): m is MaterialEnEspera => m !== null);
                setMaterialesEnEspera(parsed);
            } catch (error) {
                addNotification('error', `Error al cargar Materiales en Espera de Insumo: ${(error as Error).message}`);
            }
        };
        cargarMaterialesEnEspera();
    }, [mueblesGrupo, addNotification]);

    // "PLAN" (OrdenesFertTabSection, displayMode="plan") necesita un resumen histórico de lo realmente
    // planificado en días anteriores — horario, mesas, personal asignado y el Gantt — pero nada de eso
    // se guardaba antes en ningún lado (solo vivía en el estado de React mientras esta pestaña seguía
    // montada, más una copia de "última asignación de personal" sin fecha en localStorage). Se persiste
    // igual que "Materiales en Espera de Insumo": una fila Restriccion por fecha objetivo, bajo el mismo
    // Grupo de Muebles — nombre_restriccion = "PlanDiarioConfig:<YYYY-MM-DD>", valor_restriccion = id del
    // horario (solo para lectura rápida), descripcion = JSON con el detalle completo (PlanDiarioSnapshot).
    const PLAN_DIARIO_PREFIJO = 'PlanDiarioConfig:';
    const [planDiarioSnapshotIds, setPlanDiarioSnapshotIds] = useState<Map<string, number>>(new Map());
    useEffect(() => {
        if (!mueblesGrupo) return;
        const cargarPlanDiarioSnapshotIds = async () => {
            try {
                const res = await restriccionService.getAll();
                const map = new Map<string, number>();
                (res.data || [])
                    .filter(r => r.codigo_grupo === mueblesGrupo.codigo_grupo && r.nombre_restriccion?.startsWith(PLAN_DIARIO_PREFIJO))
                    .forEach(r => map.set(r.nombre_restriccion.slice(PLAN_DIARIO_PREFIJO.length), r.codigo_restriccion));
                setPlanDiarioSnapshotIds(map);
            } catch (error) {
                console.error('Error al cargar los snapshots de Plan Diario existentes:', error);
            }
        };
        cargarPlanDiarioSnapshotIds();
    }, [mueblesGrupo]);

    // Guarda (o actualiza, si ya existía uno para la misma fecha objetivo) el snapshot de Plan Diario
    // que consume "PLAN" — se llama al final de "EJECUTAR DISTRIBUCIÓN DE MESAS" y de "Modular
    // Distribución de Mesas", con la distribución recién calculada, para que siempre quede la versión
    // más reciente de esa fecha (no se acumulan snapshots viejos de la misma fecha, se sobrescriben).
    const savePlanDiarioSnapshot = async (distribution: Map<number, MesaDistributionEntry>) => {
        if (!mueblesGrupo || !planningTargetDate) return;
        try {
            const fecha = toDateKey(planningTargetDate);
            const mesas: PlanDiarioSnapshotMesa[] = Array.from(distribution.values())
                .sort((a, b) => a.tableId - b.tableId)
                .map(entry => {
                    const assignment = tableAssignments[entry.tableId];
                    const calificacion = assignment?.person ? (personnelCalificacionMap.get(assignment.person) ?? null) : null;
                    return {
                        tableId: entry.tableId,
                        tableName: WORK_TABLES.find(t => t.id === entry.tableId)?.name ?? `MESA ${entry.tableId}`,
                        linea: entry.linea,
                        capacityHours: entry.capacityHours,
                        usedHours: entry.usedHours,
                        person: assignment?.person ?? '',
                        percentage: assignment?.percentage ?? '',
                        calificacion,
                        items: entry.items.map(it => ({
                            material: it.order.material,
                            nombre: it.order.nombre,
                            source: it.order.source,
                            id: it.order.id,
                            cantidad: it.order.cantidadPlanificada,
                            tamano: it.order.tamano,
                            startHour: it.startHour,
                            endHour: it.endHour,
                            overflow: it.overflow,
                        })),
                    };
                });

            const snapshot: PlanDiarioSnapshot = {
                fecha,
                shiftId: selectedShiftConfig.id,
                shiftLabel: selectedShiftConfig.label,
                shiftStartTime: selectedShiftConfig.startTime,
                shiftDisplayEndTime: selectedShiftConfig.displayEndTime,
                mesas,
            };

            const existente = planDiarioSnapshotIds.get(fecha);
            const payload: any = {
                codigo_grupo: mueblesGrupo.codigo_grupo,
                nombre_restriccion: `${PLAN_DIARIO_PREFIJO}${fecha}`,
                valor_restriccion: selectedShiftConfig.id,
                descripcion: JSON.stringify(snapshot),
                estado: 'A',
                usuario_modificacion: 'Admin',
            };
            if (existente) payload.codigo_restriccion = existente;

            const saved = await restriccionService.save(payload);
            const codigoRestriccion = saved.data?.codigo_restriccion ?? existente;
            if (codigoRestriccion) {
                setPlanDiarioSnapshotIds(prev => new Map(prev).set(fecha, codigoRestriccion));
            }
        } catch (error) {
            console.error('Error al guardar el snapshot de Plan Diario para "PLAN":', error);
            addNotification('error', `No se pudo guardar el resumen para la pestaña "PLAN": ${(error as Error).message}`);
        }
    };

    // Resuelve la Fecha de Entrega cruzando PEDIDO + POSICION (Previsional: PEDIDOVENTAS + POSICIONPEDIDO;
    // Fert: PEDIDO + POSICION) contra getPendientesTotales, ya que un mismo pedido puede tener líneas
    // con fechas de entrega distintas; solo se usa el pedido sin posición cuando es inequívoco.
    const resolveFechaEntregaPorPosicion = (pedido: string, posicion: string): string | null => {
        if (!pedido) return null;
        const posicionNum = Number(posicion);
        if (!Number.isNaN(posicionNum)) {
            const byPosition = deliveryDatesByPositionMap.get(`${pedido}|${posicionNum}`)
                || deliveryDatesByPositionMap.get(`${pedido.replace(/^0+/, '')}|${posicionNum}`);
            if (byPosition) return byPosition;
        }
        return deliveryDatesMap.get(pedido) || deliveryDatesMap.get(pedido.replace(/^0+/, '')) || null;
    };

    // Resuelve el Centro de ENTREGA (destino: Quito 1000 / Guayaquil 2000) cruzando PEDIDO + POSICION
    // contra getPendientesTotales. Es el centro relevante para la regla de +1/+2 días laborables de la
    // ventana de prioridad, distinto del Centro de fabricación (siempre 1000, la planta de Quito) que
    // viene en la propia orden Previsional/Fert.
    const resolveCentroEntregaPorPosicion = (pedido: string, posicion: string): string | null => {
        if (!pedido) return null;
        const posicionNum = Number(posicion);
        if (!Number.isNaN(posicionNum)) {
            const byPosition = deliveryCentroByPositionMap.get(`${pedido}|${posicionNum}`)
                || deliveryCentroByPositionMap.get(`${pedido.replace(/^0+/, '')}|${posicionNum}`);
            if (byPosition) return byPosition;
        }
        return deliveryCentroMap.get(pedido) || deliveryCentroMap.get(pedido.replace(/^0+/, '')) || null;
    };

    // Unifica Previsionales + Fert en una sola estructura, clasificando MTO/MTS, tamaño y alertas PTBO
    const unifiedOrdersResult = useMemo<{ orders: UnifiedOrder[]; sinFechaEntrega: OrderMissingDeliveryDate[] }>(() => {
        const result: UnifiedOrder[] = [];
        const sinFechaEntrega: OrderMissingDeliveryDate[] = [];

        mueblesProvisionalOrders.forEach((row: any) => {
            const cantidadTotal = Number(row.CANTIDAD) || 0;
            if (cantidadTotal <= 0) return;

            const material = normalizeMaterialCode(row.MATERIAL);
            const nombre = String(row.NOMBRE || '').trim();
            const centroProduccion = String(row.Centro || '').trim();
            const pedido = String(row.PEDIDOVENTAS || '').trim();
            const posicionPedido = String(row.POSICIONPEDIDO || '').trim();
            const tipo: 'MTO' | 'MTS' = pedido ? 'MTO' : 'MTS';
            const sectorSAP = materialSectorMap.get(material);
            if (esSectorAjenoAMuebles(sectorSAP)) return;
            const sector = sectorSAP ?? resolveSectorReparacion(nombre);
            const tiempoUnitMin = globalTiemposMap.get(material) ?? 0;

            // El Centro de ENTREGA (destino Quito/Guayaquil) es el que rige la ventana de prioridad,
            // no el Centro de fabricación (siempre 1000); si no hay pedido (MTS) o no se encuentra en
            // Pendientes Totales, se usa el Centro de fabricación como respaldo.
            const centro = (pedido && resolveCentroEntregaPorPosicion(pedido, posicionPedido)) || centroProduccion;

            const fechaEntregaStr = pedido
                ? resolveFechaEntregaPorPosicion(pedido, posicionPedido)
                : null;
            const fechaEntregaDate = fechaEntregaStr ? parseDDMMYYYY(fechaEntregaStr) : null;
            const fechaInicioPropia = row.FECHAINICIO ? parseERPDateOnly(row.FECHAINICIO) : null;
            // Para MTS (sin pedido), se usa FECHAINICIO del ERP como referencia de antigüedad de la orden
            const fechaAntiguedad = fechaEntregaDate ?? fechaInicioPropia ?? new Date(8640000000000000);

            if (tipo === 'MTO' && (!fechaEntregaStr || !fechaEntregaDate)) {
                // MTO sin fecha de entrega válida (no existe en Pendientes Totales): no se puede evaluar, se reporta aparte
                sinFechaEntrega.push({ source: 'Previsional', id: String(row.ORDENPREVISIONAL || ''), pedido, material, nombre });
                return;
            }

            result.push({
                source: 'Previsional',
                id: String(row.ORDENPREVISIONAL || ''),
                material,
                nombre,
                centro,
                pedido,
                posicion: posicionPedido,
                cantidadTotal,
                cantidadPlanificada: tipo === 'MTS' ? Math.min(cantidadTotal, MTS_SEGREGATION_LIMIT) : cantidadTotal,
                cantidadDiferida: tipo === 'MTS' ? Math.max(0, cantidadTotal - MTS_SEGREGATION_LIMIT) : 0,
                tipo,
                sector,
                tamano: classifyMaterialSize(sector, tiempoUnitMin),
                tiempoUnitMin,
                horas: 0, // se recalcula abajo con la cantidad planificada
                fechaEntrega: fechaEntregaStr ?? formatDDMMYYYY(fechaAntiguedad),
                fechaEntregaDate: fechaEntregaDate ?? fechaAntiguedad,
                fechaPropia: fechaInicioPropia,
                fechaOrden: null,
                isPTBO: nombre.toUpperCase().includes('PTBO'),
            });
        });

        mueblesFertOrders.forEach((row: any) => {
            const cantidadTotal = Number(row.CANTPENDIENTE) || 0;
            if (cantidadTotal <= 0) return;

            const material = normalizeMaterialCode(row.MATERIAL);
            const nombre = String(row.NOMBRE || '').trim();
            const centroProduccion = String(row.CENTRO || '').trim();
            const pedido = String(row.PEDIDO || '').trim();
            const tipo: 'MTO' | 'MTS' = pedido ? 'MTO' : 'MTS';
            const sectorSAP = materialSectorMap.get(material);
            if (esSectorAjenoAMuebles(sectorSAP)) return;
            const sector = sectorSAP ?? resolveSectorReparacion(nombre);
            const tiempoUnitMin = globalTiemposMap.get(material) ?? 0;

            const posicionFert = String(row.POSICION || '').trim();
            // El Centro de ENTREGA (destino Quito/Guayaquil) es el que rige la ventana de prioridad,
            // no el Centro de fabricación de la orden Fert (siempre 1000, planta de Quito); si no hay
            // pedido (MTS) o no se encuentra en Pendientes Totales, se usa el Centro de fabricación.
            const centro = (pedido && resolveCentroEntregaPorPosicion(pedido, posicionFert)) || centroProduccion;
            const fechaEntregaStr = pedido
                ? resolveFechaEntregaPorPosicion(pedido, posicionFert)
                : null;
            const fechaEntregaDate = fechaEntregaStr ? parseDDMMYYYY(fechaEntregaStr) : null;
            const fechaPropiaFert = row.FECHA ? parseERPDateOnly(row.FECHA) : null;
            // Fecha de creación de la orden (FECHAORDEN), sustituto de "Fecha de Liberación Real" (no
            // disponible en la API) para sugerir en "Órdenes que se Pueden Mover" las MTS creadas hoy.
            const fechaOrdenFert = row.FECHAORDEN ? parseERPDateOnly(row.FECHAORDEN) : null;
            const fechaAntiguedad = fechaEntregaDate ?? fechaPropiaFert ?? new Date(8640000000000000);

            // Para Fert, la fecha de entrega del cliente (Pendientes Totales) no es obligatoria:
            // si no se puede resolver pero sí existe la fecha propia (FECHA) del ERP, la orden se
            // planifica igual usando esa fecha (para que la regla "sin excepción" por FECHA aplique).
            // Solo se excluye si NO hay ningún dato de fecha disponible.
            if (tipo === 'MTO' && !fechaEntregaDate && !fechaPropiaFert) {
                sinFechaEntrega.push({ source: 'Fert', id: String(row.ORDEN || ''), pedido, material, nombre });
                return;
            }

            result.push({
                source: 'Fert',
                id: String(row.ORDEN || ''),
                material,
                nombre,
                centro,
                pedido,
                posicion: posicionFert,
                cantidadTotal,
                cantidadPlanificada: tipo === 'MTS' ? Math.min(cantidadTotal, MTS_SEGREGATION_LIMIT) : cantidadTotal,
                cantidadDiferida: tipo === 'MTS' ? Math.max(0, cantidadTotal - MTS_SEGREGATION_LIMIT) : 0,
                tipo,
                sector,
                tamano: classifyMaterialSize(sector, tiempoUnitMin),
                tiempoUnitMin,
                horas: 0,
                fechaEntrega: fechaEntregaStr ?? formatDDMMYYYY(fechaAntiguedad),
                fechaEntregaDate: fechaEntregaDate ?? fechaAntiguedad,
                fechaPropia: fechaPropiaFert,
                fechaOrden: fechaOrdenFert,
                isPTBO: nombre.toUpperCase().includes('PTBO'),
            });
        });

        // Calcula las horas finales usando la cantidad efectivamente planificada (con segregación MTS aplicada)
        result.forEach(o => {
            o.horas = (o.tiempoUnitMin * o.cantidadPlanificada) / 60;
        });

        return { orders: result, sinFechaEntrega };
    }, [mueblesProvisionalOrders, mueblesFertOrders, materialSectorMap, globalTiemposMap, deliveryDatesMap, deliveryDatesByPositionMap, deliveryCentroMap, deliveryCentroByPositionMap]);

    const unifiedOrders = unifiedOrdersResult.orders;
    const ordersMissingDeliveryDate = unifiedOrdersResult.sinFechaEntrega;

    // 4. Carga de Feriados (Ecuador) para el cálculo de la ventana de días laborables
    useEffect(() => {
        const fetchHolidays = async () => {
            try {
                const start = new Date();
                start.setHours(0, 0, 0, 0);
                start.setDate(start.getDate() + 1);
                const end = new Date(start);
                end.setDate(end.getDate() + PLANNING_LOOKAHEAD_DAYS);
                const holidays = await ecuadorHolidaysService.getHolidaysForRange(start, end);
                const map = new Map<string, string>();
                holidays.forEach(h => map.set(h.date, h.name));
                setHolidaysMap(map);
            } catch (error) {
                console.error('Error al cargar feriados para la ventana de fabricación:', error);
            }
        };
        fetchHolidays();
    }, []);

    const planningDays = useMemo<PlanningDay[]>(() => {
        const days: PlanningDay[] = [];
        const cursor = new Date();
        cursor.setHours(0, 0, 0, 0);
        cursor.setDate(cursor.getDate() + 1); // La planificación inicia el día siguiente (mañana), no hoy

        for (let i = 0; i < PLANNING_LOOKAHEAD_DAYS; i++) {
            const date = new Date(cursor);
            date.setDate(cursor.getDate() + i);
            const key = toDateKey(date);
            const dayOfWeek = date.getDay();
            const isWeekend = dayOfWeek === 0 || dayOfWeek === 6;
            const holidayName = holidaysMap.get(key) ?? null;
            const isDefaultWorking = !isWeekend && !holidayName;
            const isActivated = activatedSpecialDays.has(key);
            days.push({
                date,
                key,
                dayOfWeek,
                isWeekend,
                holidayName,
                isDefaultWorking,
                isActivated,
                included: isDefaultWorking || isActivated,
            });
        }
        return days;
    }, [holidaysMap, activatedSpecialDays]);

    const workingWindow = useMemo(() => {
        return planningDays.filter(d => d.included).slice(0, WORKING_DAYS_TARGET);
    }, [planningDays]);

    const visiblePlanningDays = useMemo(() => {
        if (workingWindow.length < WORKING_DAYS_TARGET) return planningDays;
        const lastKey = workingWindow[workingWindow.length - 1].key;
        const lastIndex = planningDays.findIndex(d => d.key === lastKey);
        return planningDays.slice(0, lastIndex + 1);
    }, [planningDays, workingWindow]);

    const toggleSpecialDay = (key: string) => {
        setActivatedSpecialDays(prev => {
            const next = new Set(prev);
            if (next.has(key)) next.delete(key);
            else next.add(key);
            return next;
        });
    };

    // 5. Carga de Personal habilitado (Habilidades) para asignación en Mesas
    useEffect(() => {
        const fetchPersonnel = async () => {
            try {
                const res = await serviciosService.getCuboHabilidadesOP();
                if (res && res.data) {
                    const dataArray = Array.isArray(res.data) ? res.data : [res.data];
                    setPersonnelRaw(dataArray);
                }
            } catch (error) {
                addNotification('error', `Error al cargar el personal de Habilidades: ${(error as Error).message}`);
            }
        };
        fetchPersonnel();
    }, [addNotification]);

    const personnelOptions = useMemo<PersonnelOption[]>(() => {
        // Si una persona califica para más de un rol habilitado, se conserva la calificación más alta
        // (evita que el resultado dependa arbitrariamente del orden de llegada de las filas del API).
        const byName = new Map<string, PersonnelOption>();
        personnelRaw.forEach((p: any) => {
            const rol = String(p.Rol ?? p.ROL ?? p.rol ?? '').trim().toUpperCase();
            if (!ALLOWED_ROLES.includes(rol)) return;

            const nombre = String(p.NombreOperador ?? p.NOMBRE ?? p.Nombre ?? '').trim();
            if (!nombre) return;

            const calificacion = Number(p.Calificacion ?? p.CALIFICACION ?? p.calificacion ?? 100) || 0;
            const existing = byName.get(nombre);
            if (!existing || calificacion > existing.calificacion) {
                byName.set(nombre, { nombre, rol, calificacion });
            }
        });
        return Array.from(byName.values()).sort((a, b) => a.nombre.localeCompare(b.nombre));
    }, [personnelRaw]);

    const personnelCalificacionMap = useMemo(() => {
        const map = new Map<string, number>();
        personnelOptions.forEach(p => map.set(p.nombre, p.calificacion));
        return map;
    }, [personnelOptions]);

    const selectedShiftConfig = useMemo(() => {
        return SHIFT_SCHEDULES.find(s => s.id === selectedShift) ?? SHIFT_SCHEDULES[0];
    }, [selectedShift]);

    const selectedShiftHours = selectedShiftConfig.hoursPerTable;

    // Fecha de programación: el último (3er) día laborable de la Ventana de Fabricación
    const planningTargetDate = useMemo(() => {
        return workingWindow.length > 0 ? workingWindow[workingWindow.length - 1].date : null;
    }, [workingWindow]);

    // Verifica automáticamente, cada vez que cambian los Materiales en Espera guardados o se refrescan
    // los datos de SAP, qué materiales padre (de Muebles) necesitan en algún nivel de su explosión un
    // insumo que todavía no llega — para que la tabla "Bloqueadas por Insumo" y el motor de planificación
    // ya tengan la respuesta lista ANTES de que el usuario presione "Ejecutar Planificación", sin que ese
    // botón tenga que esperar la explosión de materiales. Solo cuenta un insumo cuya fecha disponible sea
    // POSTERIOR a la fecha objetivo (si ya llegó o llega justo ese día, no bloquea nada). Si no hay
    // ningún insumo en espera activo, no se hace ninguna llamada (caso común, costo cero).
    useEffect(() => {
        let cancelled = false;
        const verificarBloqueos = async () => {
            if (!planningTargetDate) {
                setMaterialesBloqueadosMap(new Map());
                return;
            }
            const insumosActivos = materialesEnEspera.filter(m => m.fechaDisponible.getTime() > planningTargetDate.getTime());
            if (insumosActivos.length === 0) {
                setMaterialesBloqueadosMap(new Map());
                return;
            }

            const materialesPadre = Array.from(new Set([
                ...mueblesProvisionalOrders.map((row: any) => normalizeMaterialCode(row.MATERIAL)),
                ...mueblesFertOrders.map((row: any) => normalizeMaterialCode(row.MATERIAL)),
            ])).filter(Boolean);

            if (materialesPadre.length === 0) {
                setMaterialesBloqueadosMap(new Map());
                return;
            }

            setIsCheckingMaterialesEnEspera(true);
            try {
                const bloqueos = new Map<string, InsumoBloqueante[]>();
                await Promise.all(materialesPadre.map(async (material) => {
                    try {
                        const res = await serviciosService.getMaestroMaterialesExplosion('1000', material, 1, 5000);
                        const components = res && res.data ? (Array.isArray(res.data) ? res.data : [res.data]) : [];
                        const codigosComponentes = new Set(
                            components.map((c: any) => normalizeMaterialCode(c.COMPONENTE || ''))
                        );
                        const insumosQueBloquean = insumosActivos.filter(ins => codigosComponentes.has(ins.insumoCodigo));
                        if (insumosQueBloquean.length > 0) {
                            bloqueos.set(material, insumosQueBloquean.map(ins => ({
                                insumoCodigo: ins.insumoCodigo,
                                insumoDescripcion: ins.descripcion,
                                fechaDisponible: ins.fechaDisponible,
                            })));
                        }
                    } catch (error) {
                        console.error(`Error al verificar Materiales en Espera para ${material}:`, error);
                    }
                }));
                if (!cancelled) setMaterialesBloqueadosMap(bloqueos);
            } finally {
                if (!cancelled) setIsCheckingMaterialesEnEspera(false);
            }
        };
        verificarBloqueos();
        return () => { cancelled = true; };
    }, [materialesEnEspera, mueblesProvisionalOrders, mueblesFertOrders, planningTargetDate]);

    // 6. Carga de Mantenimientos Preventivos Programados (verificación de disponibilidad de Mesas)
    useEffect(() => {
        const fetchMaintenance = async () => {
            try {
                const res = await serviciosService.ListarMantenimientoPreventivosProgramados();
                if (res && res.data) {
                    const dataArray = Array.isArray(res.data) ? res.data : [res.data];
                    setMaintenanceRaw(dataArray);
                }
            } catch (error) {
                addNotification('error', `Error al cargar Mantenimientos Preventivos Programados: ${(error as Error).message}`);
            }
        };
        fetchMaintenance();
    }, [addNotification]);

    // Mapa de conflictos de mantenimiento por Mesa, para la fecha de programación y el horario seleccionado
    const mesaMaintenanceMap = useMemo(() => {
        const map = new Map<number, { maquina: string; inicio: Date; fin: Date; overlapHours: number }[]>();
        if (!planningTargetDate) return map;

        const shiftStartUTC = shiftTimeToUTC(planningTargetDate, selectedShiftConfig.startTime);
        const shiftEndUTC = shiftTimeToUTC(planningTargetDate, selectedShiftConfig.endTime);

        WORK_TABLES.forEach(table => {
            const puestoTrabajoLinea = `MESA DE ARMADO ${table.id}`;
            const conflicts: { maquina: string; inicio: Date; fin: Date; overlapHours: number }[] = [];

            maintenanceRaw.forEach((row: any) => {
                const rowLinea = String(row.PuestoTrabajoLinea ?? '').trim().toUpperCase();
                if (rowLinea !== puestoTrabajoLinea) return;

                const inicio = new Date(row.FECHA_OT_PRG_INI);
                const fin = new Date(row.FECHA_OT_PRG_FIN);
                if (Number.isNaN(inicio.getTime()) || Number.isNaN(fin.getTime())) return;

                // Se solapa con el horario laboral de la fecha de programación
                const overlapMs = Math.min(fin.getTime(), shiftEndUTC.getTime()) - Math.max(inicio.getTime(), shiftStartUTC.getTime());
                if (overlapMs > 0) {
                    conflicts.push({
                        maquina: String(row.MAQUINA ?? row.ID_MAQUINA ?? '').trim(),
                        inicio,
                        fin,
                        overlapHours: overlapMs / (1000 * 60 * 60),
                    });
                }
            });

            if (conflicts.length > 0) {
                map.set(table.id, conflicts);
            }
        });

        return map;
    }, [maintenanceRaw, planningTargetDate, selectedShiftConfig]);

    // Decisión del usuario ante un mantenimiento en horario laboral: 'accepted' = se mantiene en el día y se descuenta el tiempo; 'denied' = se reprograma al turno de la noche y no afecta la capacidad
    const [maintenanceDecisions, setMaintenanceDecisions] = useState<Record<number, 'accepted' | 'denied'>>({});

    const setMaintenanceDecision = (tableId: number, decision: 'accepted' | 'denied') => {
        setMaintenanceDecisions(prev => ({
            ...prev,
            [tableId]: prev[tableId] === decision ? (undefined as any) : decision,
        }));
    };

    // Descuentos de horas que afectan a TODAS las mesas (ej. inventario mensual, evento social, salida anticipada)
    const [hourDiscounts, setHourDiscounts] = useState<{ id: string; motivo: string; horas: number }[]>([]);
    const [newDiscountMotivo, setNewDiscountMotivo] = useState('');
    const [newDiscountHoras, setNewDiscountHoras] = useState('');

    const addHourDiscount = () => {
        const motivo = newDiscountMotivo.trim();
        const horas = Number(newDiscountHoras);
        if (!motivo) {
            addNotification('warning', 'Debe indicar el motivo del descuento de horas.');
            return;
        }
        if (!horas || horas <= 0) {
            addNotification('warning', 'Debe indicar una cantidad de horas válida (mayor a 0).');
            return;
        }
        setHourDiscounts(prev => [...prev, { id: `${Date.now()}`, motivo, horas }]);
        setNewDiscountMotivo('');
        setNewDiscountHoras('');
    };

    const removeHourDiscount = (id: string) => {
        setHourDiscounts(prev => prev.filter(d => d.id !== id));
    };

    const totalDiscountHours = useMemo(() => {
        return hourDiscounts.reduce((sum, d) => sum + d.horas, 0);
    }, [hourDiscounts]);

    // Cálculo de capacidad por Mesa (compartido entre la tabla de asignación y el resumen de capacidad)
    const mesaCapacityByTable = useMemo(() => {
        const map = new Map<number, {
            pct: number | null;
            calificacion: number | null;
            availableHours: number | null;
            hasMaintenance: boolean;
            maintenanceDecision: 'accepted' | 'denied' | undefined;
            maintenanceOverlapHours: number;
            finalAvailableHours: number | null;
        }>();

        (chosenTables ?? []).forEach(tableId => {
            const assignment = tableAssignments[tableId];
            const pctRaw = assignment?.percentage;
            const pct = pctRaw !== undefined && pctRaw !== '' ? Number(pctRaw) : null;
            const calificacion = assignment?.person ? (personnelCalificacionMap.get(assignment.person) ?? 100) : null;
            const availableHours = pct !== null && !Number.isNaN(pct) && calificacion !== null
                ? (selectedShiftHours * (pct / 100)) * (calificacion / 100)
                : null;

            const maintenanceConflicts = mesaMaintenanceMap.get(tableId);
            const hasMaintenance = !!maintenanceConflicts && maintenanceConflicts.length > 0;
            const maintenanceDecision = maintenanceDecisions[tableId];
            const maintenanceOverlapHours = hasMaintenance
                ? maintenanceConflicts!.reduce((sum, c) => sum + c.overlapHours, 0)
                : 0;
            // Por seguridad, mientras no se deniegue explícitamente (reprogramar a turno noche),
            // se descuenta el solape de mantenimiento del tiempo disponible: solo "Denegar" restaura la capacidad completa.
            const afterMaintenance = availableHours !== null && hasMaintenance && maintenanceDecision !== 'denied'
                ? Math.max(0, availableHours - maintenanceOverlapHours)
                : availableHours;

            // Descuentos generales de horas (inventario mensual, evento social, etc.) afectan a todas las mesas por igual
            const finalAvailableHours = afterMaintenance !== null
                ? Math.max(0, afterMaintenance - totalDiscountHours)
                : afterMaintenance;

            map.set(tableId, { pct, calificacion, availableHours, hasMaintenance, maintenanceDecision, maintenanceOverlapHours, finalAvailableHours });
        });

        return map;
    }, [chosenTables, tableAssignments, personnelCalificacionMap, selectedShiftHours, mesaMaintenanceMap, maintenanceDecisions, totalDiscountHours]);

    // Resumen de Capacidad Disponible: suma total de horas + unidades equivalentes fabricables
    const EQUIVALENT_UNIT_MINUTES = 32.21;

    const capacitySummary = useMemo(() => {
        let totalHours = 0;
        let mesasConDatos = 0;

        mesaCapacityByTable.forEach(row => {
            if (row.finalAvailableHours !== null) {
                totalHours += row.finalAvailableHours;
                mesasConDatos++;
            }
        });

        const equivalentUnits = (totalHours * 60) / EQUIVALENT_UNIT_MINUTES;

        return { totalHours, mesasConDatos, equivalentUnits };
    }, [mesaCapacityByTable]);

    // Sugerencia para cubrir el Déficit de Capacidad de "Horas Requeridas (Compromisos Inmediatos)":
    // evalúa dos palancas independientes (subir el horario de trabajo vs. activar más mesas) y estima
    // cuál de las dos cubre el déficit con el menor cambio. Es una estimación orientativa (asume que la
    // capacidad escala proporcionalmente a las horas del turno y que las mesas nuevas rendirían el
    // promedio de las ya asignadas), no un recálculo exacto de mantenimientos/descuentos por mesa.
    const capacityShortageSuggestion = useMemo(() => {
        if (!planningResult || !liveCapacityInfo) return null;
        const deficit = -liveCapacityInfo.liveDeficit;
        if (deficit <= 0.01) return null;

        const totalCapacityActual = planningResult.totalCapacityAvailable;
        const objetivoHoras = liveCapacityInfo.liveTotalHoursRequired;

        // Opción A: subir el horario de trabajo (afecta a todas las mesas asignadas por igual)
        const horasPorMesaBase = selectedShiftConfig.hoursPerTable > 0
            ? totalCapacityActual / selectedShiftConfig.hoursPerTable
            : 0;
        let sugerenciaHorario: { label: string; horasEstimadas: number } | null = null;
        for (const opcion of SHIFT_SCHEDULES) {
            if (opcion.hoursPerTable <= selectedShiftConfig.hoursPerTable) continue;
            const horasEstimadas = horasPorMesaBase * opcion.hoursPerTable;
            if (horasEstimadas >= objetivoHoras) {
                sugerenciaHorario = { label: opcion.label, horasEstimadas };
                break;
            }
        }

        // Opción B: activar mesas adicionales, usando el promedio de horas de las mesas ya asignadas
        const avgHorasPorMesa = capacitySummary.mesasConDatos > 0
            ? capacitySummary.totalHours / capacitySummary.mesasConDatos
            : 0;
        const mesasNecesarias = avgHorasPorMesa > 0 ? Math.ceil(deficit / avgHorasPorMesa) : null;
        const mesasDisponibles = WORK_TABLES.length - (chosenTables?.length ?? 0);
        const mesaFactible = mesasNecesarias !== null && mesasNecesarias <= mesasDisponibles;

        // "Más conveniente": si con pocas mesas adicionales (≤2) alcanza y hay disponibles, se prioriza
        // esa opción (cambio puntual, sin afectar el horario de todo el equipo); en otro caso, se
        // prioriza subir el horario si con eso alcanza; si ninguna alcanza sola, se muestran ambas.
        const recomendada: 'horario' | 'mesas' =
            mesaFactible && (mesasNecesarias as number) <= 2 ? 'mesas'
                : sugerenciaHorario ? 'horario'
                    : 'mesas';

        return { deficit, sugerenciaHorario, avgHorasPorMesa, mesasNecesarias, mesasDisponibles, mesaFactible, recomendada };
    }, [planningResult, liveCapacityInfo, capacitySummary, selectedShiftConfig, chosenTables]);

    const updatePersonAssignment = (tableId: number, person: string) => {
        const duplicateTableId = person
            ? (chosenTables ?? []).find(id => id !== tableId && tableAssignments[id]?.person === person)
            : undefined;

        if (duplicateTableId !== undefined) {
            const duplicateMesaName = WORK_TABLES.find(t => t.id === duplicateTableId)?.name ?? `MESA DE TRABAJO ${duplicateTableId}`;
            addNotification('warning', `"${person}" ya está asignado(a) a ${duplicateMesaName}. Debe asignar una persona diferente por mesa.`);
        }

        setTableAssignments(prev => ({
            ...prev,
            [tableId]: { person, percentage: prev[tableId]?.percentage ?? '100' }
        }));
    };

    // Mesas cuyo colaborador asignado se repite en otra mesa (posible error de digitación)
    const duplicatePersonTables = useMemo(() => {
        const byPerson = new Map<string, number[]>();
        (chosenTables ?? []).forEach(tableId => {
            const person = tableAssignments[tableId]?.person;
            if (!person) return;
            if (!byPerson.has(person)) byPerson.set(person, []);
            byPerson.get(person)!.push(tableId);
        });

        const duplicates = new Map<number, string>();
        byPerson.forEach((tableIds, person) => {
            if (tableIds.length > 1) {
                tableIds.forEach(tableId => {
                    const otherMesas = tableIds
                        .filter(id => id !== tableId)
                        .map(id => WORK_TABLES.find(t => t.id === id)?.name ?? `MESA DE TRABAJO ${id}`)
                        .join(', ');
                    duplicates.set(tableId, otherMesas);
                });
            }
        });
        return duplicates;
    }, [chosenTables, tableAssignments]);

    const updatePercentageAssignment = (tableId: number, percentage: string) => {
        setTableAssignments(prev => ({
            ...prev,
            [tableId]: { person: prev[tableId]?.person ?? '', percentage }
        }));
    };

    const updateLoadStage = (key: string, patch: Partial<LoadStage>) => {
        setLoadStages(prev => prev.map(s => (s.key === key ? { ...s, ...patch } : s)));
    };

    const fetchAllData = async () => {
        setIsLoading(true);
        setDownloadProgress({ current: 0, total: 0 });
        setLoadStages(LOAD_STAGE_DEFS.map(d => ({ ...d, current: 0, total: 0, status: 'pending' as const })));
        try {
            // Cargar Fechas de Entrega (paginado completo: un solo pedido puede tener miles de líneas con distinta fecha)
            updateLoadStage('pendientes', { status: 'loading' });
            const pendExplore = await serviciosService.getPendientesTotales(1, 1);
            const totalPend = pendExplore.totalRegistros || 0;
            updateLoadStage('pendientes', { total: totalPend });
            if (totalPend > 0) {
              const BATCH_PEND = 20000;
              const pagesPend = Math.ceil(totalPend / BATCH_PEND);
              let combinedPend: any[] = [];
              for (let i = 1; i <= pagesPend; i++) {
                const res = await serviciosService.getPendientesTotales(i, BATCH_PEND);
                if (res.data) {
                  const items = Array.isArray(res.data) ? res.data : [res.data];
                  combinedPend = combinedPend.concat(items);
                }
                updateLoadStage('pendientes', { current: combinedPend.length });
              }

              // Primero se agrupa por PEDIDO para saber si todas sus líneas comparten la misma fecha
              const datesByPedido = new Map<string, Set<string>>();
              const positionMap = new Map<string, string>();
              const destinatarioMap = new Map<string, string>();
              // Centro de ENTREGA (destino) por PEDIDO, análogo a datesByPedido, y por PEDIDO+POSICION
              const centrosByPedido = new Map<string, Set<string>>();
              const centroPositionMap = new Map<string, string>();

              combinedPend.forEach((item: any) => {
                const pedido = String(item.PEDIDO || '').trim();
                if (!pedido) return;

                const destinatario = String(item.DESTINATARIO_MERCADERIA || item.NOMBRE || '').trim();
                if (destinatario && !destinatarioMap.has(pedido)) {
                  destinatarioMap.set(pedido, destinatario);
                  destinatarioMap.set(pedido.replace(/^0+/, ''), destinatario);
                }

                const centroEntrega = String(item.CENTRO || '').trim();
                const posicionNum = Number(item.POSICION);
                if (centroEntrega) {
                  if (!centrosByPedido.has(pedido)) centrosByPedido.set(pedido, new Set());
                  centrosByPedido.get(pedido)!.add(centroEntrega);

                  if (!Number.isNaN(posicionNum)) {
                    centroPositionMap.set(`${pedido}|${posicionNum}`, centroEntrega);
                    centroPositionMap.set(`${pedido.replace(/^0+/, '')}|${posicionNum}`, centroEntrega);
                  }
                }

                const dia = String(item.DIAENTREGA || '').padStart(2, '0');
                const mes = String(item.MESENTREGA || '').padStart(2, '0');
                const anio = String(item.ANIOENTREGA || '');
                if (dia === '00' || mes === '00' || !anio) return;

                const formatted = `${dia}-${mes}-${anio}`;

                if (!datesByPedido.has(pedido)) datesByPedido.set(pedido, new Set());
                datesByPedido.get(pedido)!.add(formatted);

                if (!Number.isNaN(posicionNum)) {
                  positionMap.set(`${pedido}|${posicionNum}`, formatted);
                  positionMap.set(`${pedido.replace(/^0+/, '')}|${posicionNum}`, formatted);
                }
              });

              setPedidoDestinatarioMap(destinatarioMap);

              // Mapa por PEDIDO solo, únicamente para los pedidos donde TODAS las líneas comparten la misma fecha
              // (evita devolver una fecha arbitraria/incorrecta cuando un pedido tiene líneas con fechas distintas)
              const dateMap = new Map<string, string>();
              datesByPedido.forEach((dates, pedido) => {
                if (dates.size === 1) {
                  const formatted = Array.from(dates)[0];
                  dateMap.set(pedido, formatted);
                  dateMap.set(pedido.replace(/^0+/, ''), formatted);
                }
              });

              // Mapa de Centro de Entrega por PEDIDO solo, únicamente cuando todas sus líneas comparten el mismo centro
              const centroMap = new Map<string, string>();
              centrosByPedido.forEach((centros, pedido) => {
                if (centros.size === 1) {
                  const centroUnico = Array.from(centros)[0];
                  centroMap.set(pedido, centroUnico);
                  centroMap.set(pedido.replace(/^0+/, ''), centroUnico);
                }
              });

              setDeliveryDatesMap(dateMap);
              setDeliveryDatesByPositionMap(positionMap);
              setDeliveryCentroMap(centroMap);
              setDeliveryCentroByPositionMap(centroPositionMap);
            }
            updateLoadStage('pendientes', { status: 'done', current: totalPend });

            // Cargar Inventario para disponibilidad (STOCKACTUAL - STOCKSEGURIDAD) y Sector (clasificación de tamaño)
            updateLoadStage('inventario', { status: 'loading' });
            const invExplore = await serviciosService.getCuboInventarios(1, 1);
            const totalInv = invExplore.totalRegistros || 0;
            updateLoadStage('inventario', { total: totalInv });
            if (totalInv > 0) {
              const BATCH_INV = 20000;
              const pagesInv = Math.ceil(totalInv / BATCH_INV);
              const iMap = new Map<string, number>();
              const sectorMap = new Map<string, string>();
              const respCtrlProdMap = new Map<string, string>();
              // Stock Actual (bruto, sin descontar seguridad) sumado por Material a través de todos los
              // Centros — mismo campo/criterio que muestran las pestañas "Telas" y "Cascos" (StockActual)
              const stockActualMap = new Map<string, number>();
              // Descripción por Material (maestro completo), usada solo para el buscador de "Materiales
              // en Espera de Insumo" — no se pedía antes, se captura de la misma descarga sin costo extra.
              const descripcionMap = new Map<string, string>();
              let processedInv = 0;
              for (let i = 1; i <= pagesInv; i++) {
                const res = await serviciosService.getCuboInventarios(i, BATCH_INV);
                if (res.data) {
                  const items = Array.isArray(res.data) ? res.data : [res.data];
                  items.forEach((item: any) => {
                    const material = normalizeMaterialCode(item.Material || '');
                    const centro = String(item.Centro || '').trim();
                    const actual = Number(item.StockActual) || 0;
                    const seguridad = Number(item.StockSeguridad) || 0;
                    iMap.set(`${material}|${centro}`, actual - seguridad);

                    const sector = String(item.Sector || '').trim();
                    if (sector && !sectorMap.has(material)) {
                      sectorMap.set(material, sector);
                    }

                    const respCtrlProd = String(item.RespCtrlProd || '').trim();
                    if (respCtrlProd && !respCtrlProdMap.has(material)) {
                      respCtrlProdMap.set(material, respCtrlProd);
                    }

                    const descripcion = String(item.Descripcion || '').trim();
                    if (descripcion && !descripcionMap.has(material)) {
                      descripcionMap.set(material, descripcion);
                    }

                    stockActualMap.set(material, (stockActualMap.get(material) || 0) + actual);
                  });
                  processedInv += items.length;
                  updateLoadStage('inventario', { current: processedInv });
                }
              }
              setInventoryMap(iMap);
              setMaterialSectorMap(sectorMap);
              setMaterialRespCtrlProdMap(respCtrlProdMap);
              setMaterialStockActualMap(stockActualMap);
              setMaterialDescripcionMap(descripcionMap);
            }
            updateLoadStage('inventario', { status: 'done', current: totalInv });

            // Cargar Tiempos de Ensamblado (global, sin discriminar Previsional/Fert)
            updateLoadStage('tiempos', { status: 'loading' });
            const tiemposExplore = await serviciosService.getTiemposEnsamblado(1, 1);
            const totalTiempos = tiemposExplore.totalRegistros || 0;
            updateLoadStage('tiempos', { total: totalTiempos });
            if (totalTiempos > 0) {
              const BATCH_TIEMPOS = 20000;
              const pagesTiempos = Math.ceil(totalTiempos / BATCH_TIEMPOS);
              const tMap = new Map<string, number>();
              let processedTiempos = 0;
              for (let i = 1; i <= pagesTiempos; i++) {
                const res = await serviciosService.getTiemposEnsamblado(i, BATCH_TIEMPOS);
                if (res.data) {
                  const items = Array.isArray(res.data) ? res.data : [res.data];
                  items.forEach((item: any) => {
                    const material = normalizeMaterialCode(item.CodMaterial ?? item.MATERIAL ?? item.Material ?? '');
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

            // Cargar Órdenes Fert
            updateLoadStage('fert', { status: 'loading' });
            const fertExplore = await serviciosService.getOrdenesFert(1, 1);
            const totalFert = fertExplore.totalRegistros || 0;
            updateLoadStage('fert', { total: totalFert });
            if (totalFert > 0) {
              const BATCH_FERT = 20000;
              const pagesFert = Math.ceil(totalFert / BATCH_FERT);
              let combinedFert: any[] = [];
              for (let i = 1; i <= pagesFert; i++) {
                const res = await serviciosService.getOrdenesFert(i, BATCH_FERT);
                if (res.data) {
                  const items = Array.isArray(res.data) ? res.data : [res.data];
                  combinedFert = combinedFert.concat(items);
                }
                updateLoadStage('fert', { current: combinedFert.length });
              }
              setFertRawData(combinedFert);
            }
            updateLoadStage('fert', { status: 'done', current: totalFert });

            // Cargar Órdenes Alpha
            updateLoadStage('alpha', { status: 'loading' });
            const exploreRes = await serviciosService.getOrdenesProvisionalesAlphaPaginados(1, 1);
            const total = exploreRes.totalRegistros || 0;
            updateLoadStage('alpha', { total });

            if (total === 0) {
                updateLoadStage('alpha', { status: 'done' });
                setAllRawData([]);
                setIsLoading(false);
                return;
            }

            setDownloadProgress({ current: 0, total });

            const BATCH_SIZE = 20000;
            const totalPages = Math.ceil(total / BATCH_SIZE);
            let combinedData: any[] = [];

            for (let i = 1; i <= totalPages; i++) {
                const res = await serviciosService.getOrdenesProvisionalesAlphaPaginados(i, BATCH_SIZE);
                if (res && res.data) {
                    const batch = Array.isArray(res.data) ? res.data : [res.data];
                    combinedData = combinedData.concat(batch);
                    setDownloadProgress({ current: combinedData.length, total });
                    updateLoadStage('alpha', { current: combinedData.length });
                }
            }

            setAllRawData(combinedData);
            updateLoadStage('alpha', { status: 'done', current: combinedData.length });
            addNotification('success', `Carga completada: ${combinedData.length} órdenes y disponibilidad de inventario sincronizada.`);
        } catch (error) {
            console.error('Error al cargar datos alpha:', error);
            addNotification('error', 'Error crítico al descargar el set de datos Alpha.');
        } finally {
            setIsLoading(false);
        }
    };

    useEffect(() => {
        fetchAllData();
    }, []);

    // Vuelve a descargar todo desde SAP (Fert, Previsionales, Pendientes, Inventario) y descarta los
    // resultados ya calculados, que quedarían desactualizados frente a cambios hechos externamente en
    // SAP (por ejemplo, mover manualmente una orden de la tabla "Órdenes que se Pueden Mover"). Las mesas
    // escogidas y el personal asignado NO se reinician, ya que son configuración del usuario, no datos de SAP.
    const handleRefreshData = async (forcePasoFinal: boolean = false) => {
        // Determina el siguiente paso a partir del paso que produjo la última planificación ejecutada:
        // sin plan previo -> Paso 1; tras Paso 1 -> Paso 2; tras Paso 2 o Paso 3 -> Paso 3 (Final), ya que
        // el Paso 3 se repite hasta que la capacidad de espuma quede resuelta (no hay Paso 4).
        // Excepción: si "Plan Grupo Recuperado" ya determinó que no hay déficit de espuma, se salta
        // directo al Paso 3 (forcePasoFinal) sin pasar por el Paso 2, aunque el último paso ejecutado
        // haya sido el Paso 1.
        const lastStep = planningResult?.planningStepResult ?? 0;
        await fetchAllData();
        setPlanningResult(null);
        setMesaDistribution(null);
        setUnassignedDistributionOrders([]);
        setFoamExplosionResults([]);
        setPrimerNivelExplosionResults([]);
        setSegundoNivelExplosionResults([]);
        setTelaExplosionResults([]);
        setCascoExplosionResults([]);
        const nextStep: 1 | 2 | 3 = forcePasoFinal ? 3 : lastStep === 0 ? 1 : lastStep === 1 ? 2 : 3;
        setPlanningStep(nextStep);
        addNotification('info',
            nextStep === 3
                ? 'Datos actualizados desde SAP. Presione "PASO 3 PLANIFICACIÓN FINAL" para recalcular con las órdenes movidas tras revisar "Plan Grupo Recuperado".'
                : nextStep === 2
                    ? 'Datos actualizados desde SAP. Presione "PASO 2: RECALCULAR PLANIFICACIÓN AJUSTADA" para recalcular la capacidad con las órdenes que movió.'
                    : 'Datos actualizados desde SAP. Vuelva a presionar "EJECUTAR PLANIFICACIÓN" para recalcular la capacidad con la información más reciente.');
    };

    // Permite a un padre (TacticalPlanMueblesSection) disparar "Actualizar Datos" por control remoto,
    // ej. desde el botón "Ir a Paso 3" de la pestaña "Plan Grupo Recuperado" cuando ya no hay déficit.
    useImperativeHandle(ref, () => ({ refreshData: handleRefreshData }));

    // Progreso general de la ventana de estado de "Actualizar Datos"/"Sincronizar Datos": promedio simple
    // del avance de cada una de las 5 etapas (cada una pesa lo mismo, sin importar cuántos registros tenga).
    const overallLoadPercent = useMemo(() => {
        if (loadStages.length === 0) return 0;
        const sum = loadStages.reduce((acc, s) => {
            if (s.status === 'done') return acc + 100;
            if (s.status === 'loading' && s.total > 0) return acc + Math.min(100, (s.current / s.total) * 100);
            return acc;
        }, 0);
        return Math.round(sum / loadStages.length);
    }, [loadStages]);

    const filteredData = useMemo(() => {
        if (!allRawData || allRawData.length === 0) return [];
        
        return allRawData.filter(row => {
            const rowResp = String(row.RESPCONTROLPROD || '').trim();

            if (validRespCodes.length > 0) {
                if (!validRespCodes.includes(rowResp)) return false;
            }

            if (forbiddenMachinesMap.has(rowResp)) {
                const rowMachine = String(row.MAQUINA || row.Maquina || '').trim();
                const forbiddenOnes = forbiddenMachinesMap.get(rowResp);
                if (forbiddenOnes?.includes(rowMachine)) {
                    return false;
                }
            }

            if (!searchTerm.trim()) return true;
            const term = searchTerm.toLowerCase();
            return Object.values(row).some(val => 
                String(val).toLowerCase().includes(term)
            );
        });
    }, [allRawData, searchTerm, validRespCodes, forbiddenMachinesMap]);

    const summaryTotals = useMemo(() => {
        let totalQty = 0;
        let totalTimeMin = 0;
        
        filteredData.forEach(row => {
            const cant = Number(row.CANTIDAD) || 0;
            totalQty += cant;
            
            const material = normalizeMaterialCode(row.MATERIAL);
            const tUnit = tiemposMap.get(material) || 0;
            totalTimeMin += (tUnit * cant);
        });

        return {
            totalQty,
            totalHours: totalTimeMin / 60,
            numOrders: filteredData.length
        };
    }, [filteredData, tiemposMap]);

    const totalFilteredRecords = filteredData.length;
    const totalPages = Math.max(1, Math.ceil(totalFilteredRecords / rowsPerPage));
    
    const paginatedData = useMemo(() => {
        const start = (currentPage - 1) * rowsPerPage;
        return filteredData.slice(start, start + rowsPerPage);
    }, [filteredData, currentPage, rowsPerPage]);

    const displayColumns = useMemo(() => {
      if (allRawData.length === 0) return [];
      
      const rawCols = Object.keys(allRawData[0]);
      
      const startCols = [
          'ORDENPREVISIONAL', 
          'PEDIDOVENTAS', 
          'POSICIONPEDIDO', 
          'MATERIAL', 
          'NOMBRE', 
          'CANTIDAD', 
          'CANT DISPONIBLE 1000',
          'CANT DISPONIBLE 2000',
          'FECHA DE ENTREGA', 
          'TIEMPOS',
          'FECHAINICIO'
      ];
      
      const endCols = ['CATEGORIA', 'UNIDAD', 'Maquina'];
      
      const middleCols = rawCols.filter(c => !startCols.includes(c) && !endCols.includes(c) && c !== 'FECHAINICIO' && c !== 'Maquina');
      
      return [...startCols, ...middleCols, ...endCols];
    }, [allRawData]);

    useEffect(() => {
        const calculateWidth = () => {
            if (tableRef.current) setTableWidth(tableRef.current.offsetWidth);
        };
        calculateWidth();
        window.addEventListener('resize', calculateWidth);
        const resizeObserver = new ResizeObserver(calculateWidth);
        if (tableRef.current) resizeObserver.observe(tableRef.current);
        return () => {
            window.removeEventListener('resize', calculateWidth);
            if (tableRef.current) resizeObserver.unobserve(tableRef.current);
        };
    }, [paginatedData]);

    const handleTopScroll = (e: React.UIEvent<HTMLDivElement>) => {
        if (lastScrolledRef.current === 'table') { lastScrolledRef.current = null; return; }
        if (tableScrollRef.current) {
            lastScrolledRef.current = 'top';
            tableScrollRef.current.scrollLeft = e.currentTarget.scrollLeft;
        }
    };

    const handleTableScroll = (e: React.UIEvent<HTMLDivElement>) => {
        if (lastScrolledRef.current === 'top') { lastScrolledRef.current = null; return; }
        if (topScrollRef.current) {
            lastScrolledRef.current = 'table';
            topScrollRef.current.scrollLeft = e.currentTarget.scrollLeft;
        }
    };

    const toggleTableSelection = (id: number) => {
        setActiveTables(prev => {
            const next = new Set(prev);
            if (next.has(id)) next.delete(id);
            else next.add(id);
            return next;
        });
    };

    const toggleCamasOverflow = (id: number) => {
        setCamasOverflowMesaIds(prev => {
            const next = new Set(prev);
            if (next.has(id)) next.delete(id);
            else next.add(id);
            return next;
        });
    };

    // P2 (Espuma) se guarda con una fecha distinta a planningTargetDate (ver comentario en
    // handleSavePlanAndDetails): el próximo día laborable, no el 3er día laborable de la ventana.
    // Se centraliza aquí para que la verificación/desactivación de planes existentes (que deben
    // comparar cada sufijo contra SU propia fecha, no todos contra planningTargetDate) y el guardado
    // usen siempre el mismo cálculo.
    const computeFechaP2 = useCallback((): Date => {
        if (workingWindow.length > 0) return workingWindow[0].date;
        const fallback = new Date();
        fallback.setHours(0, 0, 0, 0);
        fallback.setDate(fallback.getDate() + 1);
        return fallback;
    }, [workingWindow]);

    // Determina la fecha esperada de un PlanGrupo existente según su sufijo (P1.3/P1.5/PFSM usan
    // planningTargetDate; P2 usa computeFechaP2), para poder comparar cada plan contra la fecha que
    // realmente le corresponde en vez de comparar todos contra una sola fecha.
    const expectedDateKeyFor = useCallback((valor: string): string | null => {
        if (/P2\s*$/i.test(valor.trim())) return toDateKey(computeFechaP2());
        if (!planningTargetDate) return null;
        return toDateKey(planningTargetDate);
    }, [computeFechaP2, planningTargetDate]);

    // Antes de confirmar la fecha objetivo (escoger mesas), se verifica si ya existe un Plan Táctico
    // guardado (PlanGrupo de Muebles, patrón "... - P1.3"/"... - P1.5"/"... - P2") para esa misma fecha,
    // para evitar duplicar o pisar sin darse cuenta un plan que ya se guardó. Se aceptan los 3 sufijos
    // porque no todos los días se generan los 3 planes (p. ej. si no hay necesidad de Espuma, no hay P2).
    const handleChooseTables = async () => {
        if (activeTables.size === 0) {
            addNotification('warning', 'Debe seleccionar al menos una mesa de trabajo.');
            return;
        }
        if (!planningTargetDate) {
            addNotification('warning', 'No se pudo determinar la fecha de programación de la Ventana de Fabricación.');
            return;
        }
        if (!mueblesGrupo) {
            addNotification('error', 'No se pudo determinar el Grupo/Centro asociado para verificar planes guardados.');
            return;
        }

        setIsPlanCheckBusy(true);
        try {
            const res = await planGrupoService.getAll();
            const existing = (res.data || []).find(p => {
                if (p.codigo_grupo !== mueblesGrupo.codigo_grupo) return false;
                if (p.estado !== 'A') return false;
                const valor = String(p.valor || '').trim();
                if (!/P1\.3\s*$|P1\.5\s*$|P2\s*$|PFSM\s*$/i.test(valor)) return false;
                const expectedKey = expectedDateKeyFor(valor);
                if (!expectedKey) return false;
                return toDateKey(new Date(p.fecha_inicio_plan)) === expectedKey;
            });

            setPlanCheckModal(existing ? { type: 'found', planGrupo: existing } : { type: 'not-found' });
        } catch (error) {
            addNotification('error', `Error al verificar planes guardados: ${(error as Error).message}`);
        } finally {
            setIsPlanCheckBusy(false);
        }
    };

    // "PROCEDER" (no existía plan) o "Borrar y disponer del espacio" (sí existía): confirma la selección
    // de mesas y continúa con el flujo normal de planificación.
    const confirmChooseTables = () => {
        const tables = Array.from(activeTables).sort((a, b) => a - b);
        setChosenTables(tables);

        // Pre-carga la asignación de personal por mesa de la última planificación guardada
        // exitosamente para este Centro, para no tener que reasignar cada vez. El usuario
        // puede cambiar la persona de cualquier mesa normalmente después.
        if (mueblesGrupo?.centro) {
            const lastAssignments = loadLastTableAssignments(mueblesGrupo.centro);
            setTableAssignments(prev => {
                const next = { ...prev };
                tables.forEach(tableId => {
                    if (!next[tableId] && lastAssignments[tableId]) {
                        next[tableId] = lastAssignments[tableId];
                    }
                });
                return next;
            });
        }

        setPlanCheckModal(null);
    };

    const handleActivateVistaMode = async () => {
        if (!planCheckModal || planCheckModal.type !== 'found') return;
        const { planGrupo } = planCheckModal;

        setIsPlanCheckBusy(true);
        try {
            const res = await detalleTacticoService.getAll();
            const detalles = (res.data || []).filter(d => d.codigo_plan_grupo === planGrupo.codigo_plan_grupo);
            setPlanCheckModal({ type: 'vista', planGrupo, detalles });
        } catch (error) {
            addNotification('error', `Error al cargar el detalle del plan guardado: ${(error as Error).message}`);
        } finally {
            setIsPlanCheckBusy(false);
        }
    };

    const handleDeleteExistingPlan = async () => {
        if (!planCheckModal || planCheckModal.type !== 'found') return;
        const { planGrupo } = planCheckModal;
        if (!mueblesGrupo || !planningTargetDate) return;

        setIsPlanCheckBusy(true);
        try {
            // No se borra físicamente: se pasa de estado 'A' (activo) a 'I' (inactivo) para
            // conservar el historial y que el administrador de planes sepa cuál usar si se
            // repite la misma fecha objetivo. Se marcan TODOS los PlanGrupo hermanos de esa
            // fecha (P1.3/P1.5/P2/PFSM), no solo el que disparó el modal, con el mismo filtro
            // usado en handleChooseTables.
            const res = await planGrupoService.getAll();
            const planesADesactivar = (res.data || []).filter(p => {
                if (p.codigo_grupo !== mueblesGrupo.codigo_grupo) return false;
                if (p.estado !== 'A') return false;
                const valor = String(p.valor || '').trim();
                if (!/P1\.3\s*$|P1\.5\s*$|P2\s*$|PFSM\s*$/i.test(valor)) return false;
                const expectedKey = expectedDateKeyFor(valor);
                if (!expectedKey) return false;
                return toDateKey(new Date(p.fecha_inicio_plan)) === expectedKey;
            });

            await Promise.all(planesADesactivar.map(p => planGrupoService.save({ ...p, estado: 'I' })));

            addNotification('success', `Plan Táctico anterior (${planGrupo.valor}) marcado como inactivo. Puede continuar con la nueva planificación.`);
            confirmChooseTables();
        } catch (error) {
            addNotification('error', `Error al desactivar el plan guardado: ${(error as Error).message}`);
        } finally {
            setIsPlanCheckBusy(false);
        }
    };

    // Resultados de búsqueda del diálogo "Materiales en Espera de Insumo" (busca por código o por
    // descripción sobre el maestro completo de Inventarios ya descargado). Limitado a 30 resultados.
    const esperaSearchResults = useMemo(() => {
        const term = esperaSearchTerm.trim().toUpperCase();
        if (term.length < 2) return [];
        const results: { codigo: string; descripcion: string }[] = [];
        for (const [codigo, descripcion] of materialDescripcionMap.entries()) {
            if (codigo.includes(term) || descripcion.toUpperCase().includes(term)) {
                results.push({ codigo, descripcion });
                if (results.length >= 30) break;
            }
        }
        return results;
    }, [esperaSearchTerm, materialDescripcionMap]);

    const handleAgregarMaterialEnEspera = async () => {
        if (!esperaSelectedMaterial) {
            addNotification('warning', 'Debe seleccionar un insumo de la lista de búsqueda.');
            return;
        }
        if (!esperaFechaDisponible) {
            addNotification('warning', 'Debe indicar la fecha en la que el insumo estará disponible.');
            return;
        }
        if (!mueblesGrupo) {
            addNotification('error', 'No se pudo determinar el Grupo de Muebles para guardar el insumo en espera.');
            return;
        }

        setIsSavingEspera(true);
        try {
            const insumoCodigoNorm = normalizeMaterialCode(esperaSelectedMaterial.codigo);
            const existente = materialesEnEspera.find(m => m.insumoCodigo === insumoCodigoNorm);
            const descripcionGuardada = esperaNota.trim()
                ? `${esperaSelectedMaterial.descripcion} — Nota: ${esperaNota.trim()}`
                : esperaSelectedMaterial.descripcion;
            const payload: any = {
                codigo_grupo: mueblesGrupo.codigo_grupo,
                nombre_restriccion: `${ESPERA_INSUMO_PREFIJO}${insumoCodigoNorm}`,
                valor_restriccion: esperaFechaDisponible,
                descripcion: descripcionGuardada,
                estado: 'A',
                usuario_modificacion: 'Admin',
            };
            if (existente) payload.codigo_restriccion = existente.codigoRestriccion;

            const saved = await restriccionService.save(payload);
            const codigoRestriccion = saved.data?.codigo_restriccion ?? existente?.codigoRestriccion;
            if (!codigoRestriccion) throw new Error('El servidor no devolvió el código de la restricción guardada.');

            const nuevoRegistro: MaterialEnEspera = {
                codigoRestriccion,
                insumoCodigo: insumoCodigoNorm,
                descripcion: descripcionGuardada,
                fechaDisponible: parseERPDateOnly(esperaFechaDisponible) as Date,
            };
            setMaterialesEnEspera(prev => [...prev.filter(m => m.insumoCodigo !== insumoCodigoNorm), nuevoRegistro]);

            addNotification('success', `"${esperaSelectedMaterial.descripcion}" agregado a Materiales en Espera (disponible desde ${formatDDMMYYYY(nuevoRegistro.fechaDisponible)}).`);
            setEsperaSearchTerm('');
            setEsperaSelectedMaterial(null);
            setEsperaFechaDisponible('');
            setEsperaNota('');
        } catch (error) {
            addNotification('error', `Error al guardar el Material en Espera: ${(error as Error).message}`);
        } finally {
            setIsSavingEspera(false);
        }
    };

    const handleEliminarMaterialEnEspera = async (codigoRestriccion: number) => {
        try {
            await restriccionService.delete(codigoRestriccion);
            setMaterialesEnEspera(prev => prev.filter(m => m.codigoRestriccion !== codigoRestriccion));
            addNotification('success', 'Material en Espera eliminado.');
        } catch (error) {
            addNotification('error', `Error al eliminar el Material en Espera: ${(error as Error).message}`);
        }
    };

    const handleRunPlanning = () => {
        if (activeTables.size === 0) {
            addNotification('warning', 'Debe seleccionar al menos una mesa de trabajo para ejecutar la planificación.');
            return;
        }
        if (!chosenTables || chosenTables.length === 0) {
            addNotification('warning', 'Debe presionar "ESCOGER MESAS" y asignar personal antes de ejecutar la planificación.');
            return;
        }
        if (!planningTargetDate) {
            addNotification('warning', 'No se pudo determinar la fecha de programación de la Ventana de Fabricación.');
            return;
        }

        // +1 día laborable (Quito/Centro 1000) y +2 días laborables (Guayaquil/Centro 2000), omitiendo
        // fines de semana: si la fecha objetivo cae en viernes, +1 salta al lunes y +2 al martes.
        const targetPlus1 = addBusinessDays(planningTargetDate, 1);
        const targetPlus2 = addBusinessDays(planningTargetDate, 2);
        const targetPlus14 = new Date(planningTargetDate);
        targetPlus14.setDate(targetPlus14.getDate() + 14);

        // Fuente que se toma como "fecha propia firme": mientras existan órdenes Fert de Muebles, solo
        // Fert (comportamiento histórico). Si SAP ya no genera Fert para Muebles (hayOrdenesFertMuebles
        // === false), las Previsionales toman su lugar y su FECHAINICIO se trata como fecha firme, para
        // que las órdenes que se van a transformar sigan apareciendo desde la primera "Actualizar Datos".
        const esFuenteFirme = (o: UnifiedOrder) => o.source === 'Fert' || (!hayOrdenesFertMuebles && o.source === 'Previsional');

        // Materiales en Espera de Insumo (ver useEffect que llena materialesBloqueadosMap): cualquier
        // orden cuyo material padre necesite, en algún nivel de su explosión, un insumo que todavía no
        // llega, se excluye de la planificación — salvo que el usuario la haya forzado manualmente desde
        // la tabla "Bloqueadas por Insumo". Se calcula ANTES del filtro por fecha propia para que quede
        // completamente fuera (no compite por capacidad ni aparece como "movible"/"diferida").
        const orderKey = (o: UnifiedOrder) => `${o.source}-${o.id}-${o.material}`;
        const blockedByInsumo: OrderBlockedByInsumo[] = [];
        const ordersDisponibles = unifiedOrders.filter(o => {
            const insumosBloqueantes = materialesBloqueadosMap.get(normalizeMaterialCode(o.material));
            if (insumosBloqueantes && insumosBloqueantes.length > 0 && !forcedIncludedBlockedIds.has(orderKey(o))) {
                blockedByInsumo.push({ order: o, insumos: insumosBloqueantes });
                return false;
            }
            return true;
        });

        // Las órdenes de fuente firme cuya fecha propia esté fuera del rango [fecha objetivo, fecha
        // objetivo + 2 semanas] se excluyen: las anteriores ya se planificaron en días previos, y
        // las posteriores no deben fabricarse con tanta anticipación (pueden cancelarse por temas comerciales).
        const excluidasPorFechaPropia: OrderMissingDeliveryDate[] = [];
        const eligibleOrders = ordersDisponibles.filter(o => {
            if (esFuenteFirme(o) && o.fechaPropia) {
                const dentroDelRango = o.fechaPropia.getTime() >= planningTargetDate.getTime()
                    && o.fechaPropia.getTime() <= targetPlus14.getTime();
                if (!dentroDelRango) {
                    excluidasPorFechaPropia.push({ source: o.source, id: o.id, pedido: o.pedido, material: o.material, nombre: o.nombre });
                }
                return dentroDelRango;
            }
            return true;
        });

        const mtoOrders = eligibleOrders.filter(o => o.tipo === 'MTO');
        const mtsOrders = eligibleOrders.filter(o => o.tipo === 'MTS');

        // Una orden de fuente firme cuya fecha propia ya fue reprogramada por el ERP para un día
        // posterior a la fecha objetivo NO debe tomarse como prioritaria hoy, aunque su fecha de
        // entrega caiga dentro de la ventana: el ERP ya decidió fabricarla en su propio día.
        const isFertRescheduledLater = (o: UnifiedOrder) =>
            esFuenteFirme(o) && !!o.fechaPropia && o.fechaPropia.getTime() > planningTargetDate.getTime();

        // Una orden cuya fecha de entrega ya cae fuera de la ventana de prioridad (Centro 1000: +1 día,
        // Centro 2000: +2 días) no es urgente todavía, sin importar qué tan comprometida esté en el ERP.
        const isBeyondPriorityWindow = (o: UnifiedOrder) => {
            if (o.centro === '1000') return o.fechaEntregaDate.getTime() > targetPlus1.getTime();
            if (o.centro === '2000') return o.fechaEntregaDate.getTime() > targetPlus2.getTime();
            return false;
        };

        // 1 y 2: Órdenes MTO cuya fecha de entrega cae dentro o antes de la ventana inmediata
        // (Centro 1000: hasta +1 día, Centro 2000: hasta +2 días). Incluye también las ya vencidas,
        // para que no desaparezcan silenciosamente de la planificación. Se ordenan por fecha de
        // entrega ascendente para poder priorizarlas si no alcanza la capacidad.
        const immediateByDelivery = mtoOrders
            .filter(o => {
                if (isFertRescheduledLater(o)) return false;
                if (o.centro === '1000') return o.fechaEntregaDate.getTime() <= targetPlus1.getTime();
                if (o.centro === '2000') return o.fechaEntregaDate.getTime() <= targetPlus2.getTime();
                return false;
            })
            .sort((a, b) => a.fechaEntregaDate.getTime() - b.fechaEntregaDate.getTime());

        // Toda orden de fuente firme (MTO o MTS) cuya fecha propia coincida EXACTAMENTE con la fecha
        // objetivo se incluye sin excepción, sin importar la capacidad disponible (ya está comprometida
        // en el ERP). Excepción: si su fecha de entrega ya está fuera de la ventana de prioridad, no es
        // urgente y se deja como candidata "movible" en vez de forzarla a fabricarse hoy.
        const mandatoryByFechaPropia = eligibleOrders.filter(o =>
            esFuenteFirme(o) && o.fechaPropia && toDateKey(o.fechaPropia) === toDateKey(planningTargetDate) && !isBeyondPriorityWindow(o)
        );
        const mandatoryIds = new Set(mandatoryByFechaPropia.map(o => `${o.source}-${o.id}-${o.material}`));

        // Demanda real de la ventana de prioridad (para el indicador de Déficit/Sobrante),
        // antes de diferir nada por falta de capacidad.
        const priorityCandidates = immediateByDelivery.filter(o => !mandatoryIds.has(`${o.source}-${o.id}-${o.material}`));
        let totalHoursRequired = mandatoryByFechaPropia.reduce((s, o) => s + o.horas, 0)
            + priorityCandidates.reduce((s, o) => s + o.horas, 0);
        const totalCapacityAvailable = capacitySummary.totalHours;

        // Se prioriza por fecha de entrega (más próxima primero); lo que no quepa en la capacidad
        // disponible se difiere (empezando por las fechas de entrega más lejanas) a una tabla aparte.
        let committedHours = mandatoryByFechaPropia.reduce((s, o) => s + o.horas, 0);
        const keptPriority: UnifiedOrder[] = [];
        const deferredByCapacity: UnifiedOrder[] = [];
        let capacityExceeded = false;
        for (const o of priorityCandidates) {
            if (!capacityExceeded && committedHours + o.horas <= totalCapacityAvailable) {
                keptPriority.push(o);
                committedHours += o.horas;
            } else {
                capacityExceeded = true;
                deferredByCapacity.push(o);
            }
        }

        const immediateMap = new Map<string, UnifiedOrder>();
        [...mandatoryByFechaPropia, ...keptPriority].forEach(o => {
            immediateMap.set(`${o.source}-${o.id}-${o.material}`, o);
        });
        let immediateOrders = Array.from(immediateMap.values());
        let immediateIds = new Set(immediateMap.keys());
        const deferredIds = new Set(deferredByCapacity.map(o => `${o.source}-${o.id}-${o.material}`));

        // Órdenes Fert MTS cuya fecha de creación (FECHAORDEN) es hoy: SAP recién las liberó y su fecha
        // propia (FECHA) cae en un día posterior, así que no se absorben en el relleno de capacidad
        // (mtsSorted/extraOrders más abajo) — se fabricarán en su propio día.
        const isCreatedToday = (o: UnifiedOrder) =>
            o.source === 'Fert' && o.tipo === 'MTS' && !!o.fechaOrden && toDateKey(o.fechaOrden) === toDateKey(new Date());

        // Órdenes MTO que YA están planificadas para la fecha objetivo (fecha propia = fecha objetivo) pero
        // cuya fecha de entrega cae fuera de la ventana de prioridad (no diferidas por capacidad, simplemente
        // no son urgentes todavía): se pueden mover a un día posterior sin riesgo de incumplir al cliente.
        // No consumen la capacidad disponible ni se fabrican hoy.
        //
        // Solo pueden aparecer aquí órdenes cuya fecha propia sea EXACTAMENTE la fecha objetivo: mover una
        // orden que el ERP ya programó para otro día (anterior o posterior) no libera capacidad del día que
        // se está planificando. Antes también se sumaban las Fert MTS recién creadas (FECHAORDEN = hoy) sin
        // mirar su FECHA propia, y sobre unifiedOrders en vez de eligibleOrders, así que se listaban órdenes
        // de días posteriores e incluso anteriores a la fecha objetivo.
        const movableOrders = mtoOrders
            .filter(o => {
                const key = `${o.source}-${o.id}-${o.material}`;
                if (immediateIds.has(key) || deferredIds.has(key)) return false;
                if (!o.fechaPropia || toDateKey(o.fechaPropia) !== toDateKey(planningTargetDate)) return false;
                return isBeyondPriorityWindow(o);
            })
            .sort((a, b) => a.fechaEntregaDate.getTime() - b.fechaEntregaDate.getTime());

        let finalDeferredByCapacity: UnifiedOrder[] = deferredByCapacity;

        // PASO 2 (recálculo ajustado tras mover órdenes manualmente en SAP): ya no se excluye nada por
        // ventana de prioridad ni por capacidad — el usuario ya decidió en SAP qué mover, así que lo que
        // queda con fecha de planificación de hoy se toma tal cual para la distribución de mesas y la
        // explosión de materiales, y el total debe coincidir con lo que realmente hay en SAP. "Movibles"
        // se sigue calculando y mostrando (sin excluirla del cálculo real) para que el usuario pueda
        // seguir ajustando la capacidad en rondas sucesivas hasta llegar a lo óptimo.
        //
        // "movableOrders" se fusiona completo porque, por construcción, todas sus órdenes tienen fecha
        // propia = fecha objetivo; así el total de horas nunca se infla con órdenes de otros días.
        // Paso 2 y Paso 3 (Final) comparten esta lógica de "tomar tal cual lo que hay en SAP": el Paso 3
        // se ejecuta después de que el usuario movió en SAP las órdenes sugeridas en "Plan Grupo Recuperado"
        // para ajustar por la capacidad real de espuma, así que debe reflejar igual de fielmente lo que
        // realmente hay en SAP para la fecha objetivo.
        const isRecalcLogic = planningStep >= 2;
        if (isRecalcLogic) {
            immediateOrders = [...immediateOrders, ...deferredByCapacity, ...movableOrders];
            immediateIds = new Set(immediateOrders.map(o => `${o.source}-${o.id}-${o.material}`));
            finalDeferredByCapacity = [];
            totalHoursRequired = immediateOrders.reduce((s, o) => s + o.horas, 0);
        }

        // Órdenes MTS, ordenadas por antigüedad, solo se incluyen si sobra capacidad (ya excluye las que
        // quedaron como inmediatas por fecha propia, y las creadas hoy que ya se sugieren como movibles)
        const mtsSorted = mtsOrders
            .filter(o => !immediateIds.has(`${o.source}-${o.id}-${o.material}`) && !isCreatedToday(o))
            .sort((a, b) => a.fechaEntregaDate.getTime() - b.fechaEntregaDate.getTime());

        const extraOrders: UnifiedOrder[] = [];
        let cumulativeHours = isRecalcLogic
            ? immediateOrders.reduce((s, o) => s + o.horas, 0)
            : committedHours;

        // Relleno de capacidad sobrante solo con MTS (stock, sin fecha de entrega de cliente que
        // las haga urgentes); no se detiene ante la primera que no cabe, para aprovechar el espacio
        // restante con órdenes más pequeñas que sí quepan más adelante en la lista.
        for (const o of mtsSorted) {
            if (cumulativeHours + o.horas > totalCapacityAvailable) continue;
            extraOrders.push(o);
            cumulativeHours += o.horas;
        }

        const allIncluded = [...immediateOrders, ...extraOrders];
        const ptboAlerts = allIncluded.filter(o => o.isPTBO);

        // Pedidos MTO de gran volumen (> 10 unidades en una sola línea): usualmente cadenas comerciales
        // grandes, cuya fabricación debe distribuirse en varios días (3 a 5) en vez de un solo día.
        const largeOrders: LargeOrderAlert[] = allIncluded
            .filter(o => o.tipo === 'MTO' && o.cantidadTotal > MTS_SEGREGATION_LIMIT)
            .map(o => ({
                source: o.source,
                id: o.id,
                pedido: o.pedido,
                cliente: pedidoDestinatarioMap.get(o.pedido) || pedidoDestinatarioMap.get(o.pedido.replace(/^0+/, '')) || 'Cliente no identificado',
                material: o.material,
                nombre: o.nombre,
                cantidad: o.cantidadTotal,
                fechaEntrega: o.fechaEntrega,
            }));

        // Recomendación de qué línea/mesas aumentar, en base al Sector de las órdenes diferidas por capacidad
        const chosenSet = new Set(chosenTables ?? []);
        const horasFaltantesPorLinea = new Map<string, { horas: number; cantidad: number }>();
        finalDeferredByCapacity.forEach(o => {
            const linea = o.sector === SECTOR_CAMAS ? 'Línea 1 – Línea de Camas'
                : o.sector === SECTOR_MUEBLES ? 'Línea 2 – Línea de Muebles'
                : 'Sin clasificar (Sector desconocido)';
            const acc = horasFaltantesPorLinea.get(linea) ?? { horas: 0, cantidad: 0 };
            acc.horas += o.horas;
            acc.cantidad += 1;
            horasFaltantesPorLinea.set(linea, acc);
        });

        const capacityRecommendations: MesaCapacityRecommendation[] = [];
        horasFaltantesPorLinea.forEach((info, linea) => {
            const mesaIds = linea.startsWith('Línea 1') ? [1, 2, 3, 4, 5, 6, 7] : linea.startsWith('Línea 2') ? [8, 9, 10, 11, 12, 13, 14] : [];
            const mesasInactivasSugeridas = mesaIds.filter(id => !chosenSet.has(id));
            capacityRecommendations.push({
                linea,
                horasFaltantes: info.horas,
                ordenesAfectadas: info.cantidad,
                mesasInactivasSugeridas,
            });
        });
        capacityRecommendations.sort((a, b) => b.horasFaltantes - a.horasFaltantes);

        setPlanningResult({
            targetDate: planningTargetDate,
            immediateOrders,
            extraOrders,
            totalHoursRequired,
            totalCapacityAvailable,
            ptboAlerts,
            missingDeliveryDate: ordersMissingDeliveryDate,
            excludedByFechaPropia: excluidasPorFechaPropia,
            blockedByInsumo,
            deferredByCapacity: finalDeferredByCapacity,
            capacityRecommendations,
            largeOrders,
            movableOrders,
            planningStepResult: planningStep,
        });
        // Una nueva planificación invalida cualquier distribución de mesas previa
        setMesaDistribution(null);
        setUnassignedDistributionOrders([]);
        // Reinicia la simulación de "Órdenes que se Pueden Mover" (todo vuelve a quedar marcado)
        setUncheckedMovableIds(new Set());

        if (ptboAlerts.length > 0) {
            addNotification('warning', `Atención: ${ptboAlerts.length} material(es) con la sigla "PTBO" en su nombre requieren revisión.`);
        }

        if (largeOrders.length > 0) {
            addNotification('warning', `${largeOrders.length} línea(s) de pedido con más de ${MTS_SEGREGATION_LIMIT} unidades: usualmente son cadenas comerciales grandes y su fabricación debe distribuirse en varios días. Revise el detalle.`);
        }

        if (ordersMissingDeliveryDate.length > 0) {
            addNotification('warning', `${ordersMissingDeliveryDate.length} orden(es) con PEDIDO no se pudieron planificar: no existe fecha de entrega en Pendientes Totales para ese pedido. Revise el detalle debajo.`);
        }

        if (blockedByInsumo.length > 0) {
            addNotification('warning', `${blockedByInsumo.length} orden(es) excluida(s) por falta de insumo (Tela, Casco u otro). Revise la tabla "Bloqueadas por Insumo".`);
        }

        if (movableOrders.length > 0) {
            addNotification('info', `${movableOrders.length} orden(es) planificada(s) para hoy pero con fecha de entrega posterior a la ventana de prioridad. Revise la tabla "Órdenes que se Pueden Mover".`);
        }

        if (finalDeferredByCapacity.length > 0) {
            addNotification('warning', `Déficit de capacidad: ${finalDeferredByCapacity.length} orden(es) con fecha de entrega más lejana se difirieron a una tabla aparte para que las revise. Vea la recomendación de mesas a aumentar.`);
        } else if (totalCapacityAvailable < totalHoursRequired) {
            addNotification('warning', `Déficit de capacidad: se requieren ${totalHoursRequired.toFixed(2)} h y solo hay ${totalCapacityAvailable.toFixed(2)} h disponibles.`);
        } else {
            addNotification('success', `Planificación ejecutada: ${allIncluded.length} órdenes incluidas (${cumulativeHours.toFixed(2)} h de ${totalCapacityAvailable.toFixed(2)} h disponibles).`);
        }
    };

    // Copia texto al portapapeles usando la Clipboard API, con respaldo vía textarea+execCommand
    // para navegadores/contextos donde navigator.clipboard no está disponible o es rechazada.
    const copyTextToClipboard = async (text: string): Promise<boolean> => {
        if (navigator.clipboard && window.isSecureContext) {
            try {
                await navigator.clipboard.writeText(text);
                return true;
            } catch (error) {
                console.error('navigator.clipboard.writeText falló, intentando respaldo:', error);
            }
        }
        try {
            const textarea = document.createElement('textarea');
            textarea.value = text;
            textarea.style.position = 'fixed';
            textarea.style.left = '-9999px';
            textarea.style.top = '0';
            document.body.appendChild(textarea);
            textarea.focus();
            textarea.select();
            const successful = document.execCommand('copy');
            document.body.removeChild(textarea);
            return successful;
        } catch (error) {
            console.error('Respaldo de copiado (execCommand) también falló:', error);
            return false;
        }
    };

    // Copia como texto simple SOLO la lista de N° Orden de una tabla (Diferidas / No Prioritarias)
    const copyOrdersAsText = async (orders: UnifiedOrder[], titulo: string) => {
        if (orders.length === 0) return;
        const lines = orders.map(o => o.id).filter(Boolean);
        const ok = await copyTextToClipboard(lines.join('\n'));
        if (ok) {
            addNotification('success', `${lines.length} N° de orden de "${titulo}" copiado(s) al portapapeles.`);
        } else {
            addNotification('error', 'No se pudo copiar al portapapeles. Intente seleccionar y copiar manualmente.');
        }
    };

    // Copia como texto simple SOLO la lista de N° Orden de las órdenes con recomendación de priorización
    const copyRecommendationsAsText = async () => {
        if (!planningResult || planningResult.deferredByCapacity.length === 0) return;
        const lines = planningResult.deferredByCapacity.map(o => o.id).filter(Boolean);
        const ok = await copyTextToClipboard(lines.join('\n'));
        if (ok) {
            addNotification('success', `${lines.length} N° de orden copiado(s) al portapapeles.`);
        } else {
            addNotification('error', 'No se pudo copiar al portapapeles. Intente seleccionar y copiar manualmente.');
        }
    };

    const handleExportPlanningExcel = () => {
        if (!planningResult) return;

        const rows = [...planningResult.immediateOrders, ...planningResult.extraOrders].map((o, idx) => ({
            'Origen': o.source,
            'Prioridad': idx < planningResult.immediateOrders.length ? 'Inmediato' : 'Relleno',
            'N° Orden': o.id,
            'Pedido': o.pedido || '',
            'Material': o.material,
            'Nombre': o.nombre,
            'Centro': o.centro,
            'Tipo': o.tipo,
            'Tamaño': o.tamano ?? '',
            'Cant. Planificada': o.cantidadPlanificada,
            'Cant. Diferida': o.cantidadDiferida,
            'Fecha Entrega': o.fechaEntrega,
            'Horas': Number(o.horas.toFixed(2)),
            'PTBO': o.isPTBO ? 'SÍ' : '',
        }));

        const worksheet = XLSX.utils.json_to_sheet(rows);
        const workbook = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(workbook, worksheet, 'Detalle Planificación');

        const fechaArchivo = planningResult.targetDate.toISOString().slice(0, 10);
        XLSX.writeFile(workbook, `Detalle_Planificacion_Tactica_${fechaArchivo}.xlsx`);
    };

    // Exporta a Excel una tabla de Explosión de Materiales (Espuma/Primer Nivel/Segundo Nivel), con el
    // Kardex (Stock Actual, Consumo de Órdenes Pasadas Pendientes, Disponible Real y Cantidad Neta
    // Requerida). Si se pasa getFecha, se agrega una columna "Fecha" (DD.MM.AAAA) calculada por fila —
    // usada por Primer Nivel (hoy+2, hoy+1 en la excepción "FORRO FALSO COSIDO"/"FORRO COJIN INTER") y
    // Segundo Nivel (hoy+1). Espuma no la usa (se deja sin columna de Fecha, sin cambios).
    const exportComponentNeedsToExcel = (
        data: FoamComponentNeed[],
        sheetName: string,
        fileLabel: string,
        getFecha?: (c: FoamComponentNeed) => Date,
    ) => {
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
            ...(getFecha ? { 'Fecha': formatFechaDDMMYYYY(getFecha(c)) } : {}),
        }));

        const worksheet = XLSX.utils.json_to_sheet(rows);
        const workbook = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(workbook, worksheet, sheetName);

        const fechaArchivo = new Date().toISOString().slice(0, 10);
        XLSX.writeFile(workbook, `${fileLabel}_${fechaArchivo}.xlsx`);
    };

    // Genera el archivo .txt para carga en el LSMW de SAP a partir de una tabla de Explosión de
    // Materiales (Primer Nivel/Segundo Nivel). Formato por línea (campos separados por TAB):
    // Componente <TAB> 1000 <TAB> ZMOQ <TAB> Cantidad Neta Requerida (entero) <TAB> Fecha(DD.MM.AAAA) <TAB> 1 <TAB> 0000
    // Se excluyen los componentes cuya Cantidad Neta Requerida redondeada sea 0. getFecha calcula la
    // fecha POR FILA (Primer Nivel mezcla hoy+2 con hoy+1 según la excepción de descripción).
    const exportComponentNeedsToLSMW = (
        data: FoamComponentNeed[],
        fileLabel: string,
        getFecha: (c: FoamComponentNeed) => Date,
    ) => {
        if (data.length === 0) return;

        const lines = data
            .map(c => ({ ...c, cantidadRedondeada: Math.round(c.cantidadNetaAConseguir) }))
            .filter(c => c.cantidadRedondeada > 0)
            .map(c => `${c.componente}\t1000\tZMOQ\t${c.cantidadRedondeada}\t${formatFechaDDMMYYYY(getFecha(c))}\t1\t0000`);

        if (lines.length === 0) return;

        const blob = new Blob([lines.join('\r\n') + '\r\n'], { type: 'text/plain;charset=utf-8' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        const fechaArchivo = new Date().toISOString().slice(0, 10);
        link.href = url;
        link.download = `${fileLabel}_LSMW_${fechaArchivo}.txt`;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(url);
    };

    // Primer Nivel: hoy+2 días calendario, EXCEPTO los semielaborados cuya descripción empieza con
    // "FORRO FALSO COSIDO" o "FORRO COJIN INTER" (hoy+1) — ver esExcepcionFechaCortaPrimerNivel.
    const fechaPrimerNivelPara = useCallback((c: FoamComponentNeed): Date =>
        addCalendarDays(new Date(), esExcepcionFechaCortaPrimerNivel(c.descripcion) ? 1 : 2), []);

    // Segundo Nivel: hoy+1 día calendario para todos los componentes de la tabla.
    const fechaSegundoNivelPara = useCallback((_c: FoamComponentNeed): Date => addCalendarDays(new Date(), 1), []);

    const handleExportTelasExcel = () => {
        if (telaExplosionResults.length === 0) return;

        const rows = telaExplosionResults.map(c => ({
            'Componente': c.componente,
            'Descripción': c.descripcion,
            'Unidad': c.unidad,
            'Cantidad Total Necesaria': Number(c.totalNecesario.toFixed(2)),
            'Stock Actual': c.stockActual ?? '',
            'Consumo Órdenes Pasadas': Number(c.consumoOrdenesPasadas.toFixed(2)),
            'Disponible Real': c.disponibleReal ?? '',
            'Cantidad Neta Requerida': Number(c.cantidadNetaAConseguir.toFixed(2)),
            'Alerta de Stock': c.alertaStock ? 'CRÍTICO' : 'Suficiente',
        }));

        const worksheet = XLSX.utils.json_to_sheet(rows);
        const workbook = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(workbook, worksheet, 'Telas');

        const fechaArchivo = new Date().toISOString().slice(0, 10);
        XLSX.writeFile(workbook, `Explosion_Materiales_Telas_${fechaArchivo}.xlsx`);
    };

    const handleExportCascosExcel = () => {
        if (cascoExplosionResults.length === 0) return;

        const rows = cascoExplosionResults.map(c => ({
            'Componente': c.componente,
            'Descripción': c.descripcion,
            'Unidad': c.unidad,
            'Cantidad Total Necesaria': Number(c.totalNecesario.toFixed(2)),
            'Stock Actual': c.stockActual ?? '',
            'Consumo Órdenes Pasadas': Number(c.consumoOrdenesPasadas.toFixed(2)),
            'Disponible Real': c.disponibleReal ?? '',
            'Cantidad Neta Requerida': Number(c.cantidadNetaAConseguir.toFixed(2)),
            'Estado': c.sinStock ? 'SIN STOCK' : 'Suficiente',
        }));

        const worksheet = XLSX.utils.json_to_sheet(rows);
        const workbook = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(workbook, worksheet, 'Cascos');

        const fechaArchivo = new Date().toISOString().slice(0, 10);
        XLSX.writeFile(workbook, `Explosion_Materiales_Cascos_${fechaArchivo}.xlsx`);
    };

    const handleExecuteDistribution = () => {
        if (!planningResult) {
            addNotification('warning', 'Debe presionar "EJECUTAR PLANIFICACIÓN" antes de distribuir las mesas.');
            return;
        }
        if (!chosenTables || chosenTables.length === 0) {
            addNotification('warning', 'Debe presionar "ESCOGER MESAS" antes de distribuir.');
            return;
        }

        // Solo mesas escogidas con capacidad calculada (persona + % asignados)
        const eligibleMesaIds = chosenTables.filter(id => (mesaCapacityByTable.get(id)?.finalAvailableHours ?? null) !== null);

        if (eligibleMesaIds.length === 0) {
            addNotification('warning', 'Ninguna mesa escogida tiene capacidad calculada (asigne personal y % de tiempo).');
            return;
        }

        const remaining = new Map<number, number>();
        const items = new Map<number, MesaScheduleItem[]>();
        eligibleMesaIds.forEach(id => {
            remaining.set(id, mesaCapacityByTable.get(id)?.finalAvailableHours ?? 0);
            items.set(id, []);
        });

        const unassigned: UnifiedOrder[] = [];

        // Se procesa de "Grande" a "Pequeño" (best-fit-decreasing) para acomodar primero lo más
        // difícil de ubicar, y usar los materiales pequeños para rellenar los espacios restantes.
        const tierRank: Record<MaterialSize, number> = { Grande: 0, Mediano: 1, Pequeño: 2 };
        const allOrders = [...planningResult.immediateOrders, ...planningResult.extraOrders];
        const sortedOrders = [...allOrders].sort((a, b) => {
            const ta = a.tamano ? tierRank[a.tamano] : 99;
            const tb = b.tamano ? tierRank[b.tamano] : 99;
            return ta - tb;
        });

        sortedOrders.forEach(order => {
            let candidates = eligibleMesaIds.filter(id => mesaAcceptsMaterial(id, order.sector, order.tamano));

            // Las reparaciones de plastificado se hacen en las mesas de Muebles de apoyo a la Línea de
            // Camas, no en las mesas del plan de Muebles. Si en esta distribución no hay ninguna mesa de
            // apoyo escogida, se dejan las demás mesas de Muebles para que no queden sin asignar.
            if (esReparacionApoyoCamas(order.nombre)) {
                const mesasApoyo = candidates.filter(id => camasOverflowMesaIds.has(id));
                if (mesasApoyo.length > 0) candidates = mesasApoyo;
            }

            // Válvula de alivio: si la Línea 1 (Línea de Camas) ya no tiene capacidad disponible en
            // ninguna de sus mesas habituales, se habilitan las mesas de Línea 2 – Muebles marcadas con
            // el botón "Habilitar para Camas" (camasOverflowMesaIds) como mesas adicionales para colocar
            // el excedente de camas.
            if (order.sector === SECTOR_CAMAS) {
                const sinEspacioEnLinea1 = candidates.every(id => (remaining.get(id) ?? 0) <= 0);
                if (sinEspacioEnLinea1) {
                    camasOverflowMesaIds.forEach(mesaOverflowId => {
                        if (eligibleMesaIds.includes(mesaOverflowId) && !candidates.includes(mesaOverflowId)) {
                            candidates = [...candidates, mesaOverflowId];
                        }
                    });
                }
            }

            if (candidates.length === 0) {
                unassigned.push(order);
                return;
            }

            // Se prioriza una mesa candidata donde el material quepa completo; si ninguna tiene
            // espacio suficiente, se usa la que tenga más capacidad restante (para regular la carga).
            const fitting = candidates.filter(id => (remaining.get(id) ?? 0) >= order.horas);
            const pool = fitting.length > 0 ? fitting : candidates;
            const chosen = pool.reduce((best, id) => ((remaining.get(id) ?? 0) > (remaining.get(best) ?? 0) ? id : best), pool[0]);

            const mesaItems = items.get(chosen)!;
            const startHour = mesaItems.reduce((sum, it) => sum + (it.endHour - it.startHour), 0);
            const overflow = order.horas > (remaining.get(chosen) ?? 0);

            mesaItems.push({
                order,
                startHour,
                endHour: startHour + order.horas,
                overflow,
            });
            remaining.set(chosen, (remaining.get(chosen) ?? 0) - order.horas);
        });

        const distribution = new Map<number, MesaDistributionEntry>();
        eligibleMesaIds
            .sort((a, b) => a - b)
            .forEach(id => {
                const mesaItems = items.get(id) ?? [];
                distribution.set(id, {
                    tableId: id,
                    linea: getMesaLinea(id),
                    capacityHours: mesaCapacityByTable.get(id)?.finalAvailableHours ?? 0,
                    usedHours: mesaItems.reduce((sum, it) => sum + (it.endHour - it.startHour), 0),
                    items: mesaItems,
                });
            });

        setMesaDistribution(distribution);
        setUnassignedDistributionOrders(unassigned);
        // Una nueva distribución invalida cualquier explosión de materiales previa
        setFoamExplosionResults([]);
        setPrimerNivelExplosionResults([]);
        setSegundoNivelExplosionResults([]);
        setTelaExplosionResults([]);
        setCascoExplosionResults([]);
        // Guarda el snapshot para "PLAN" (horario/mesas/personal/Gantt de esta fecha objetivo)
        savePlanDiarioSnapshot(distribution);

        if (unassigned.length > 0) {
            addNotification('warning', `${unassigned.length} material(es) no se pudieron asignar a ninguna mesa (Sector no clasificado o sin mesa disponible para ese Sector/Tamaño).`);
        }
        addNotification('success', 'Distribución de mesas ejecutada. Revise el Diagrama de Gantt de capacidad.');
    };

    // Mesas adicionales que, además de lo que ya acepta mesaAcceptsMaterial, se consideran compatibles
    // SOLO para efectos de "modular" (rebalancear) la distribución ya ejecutada. Las mesas de Línea 2 –
    // Muebles marcadas con "Habilitar para Camas" (camasOverflowMesaIds) se habilitan también como
    // destino de excedentes de Camas, igual que la válvula de alivio que ya existe en handleExecuteDistribution.
    const mesaCompatibleParaModular = (mesaId: number, order: UnifiedOrder): boolean => {
        // Las reparaciones de plastificado no salen de las mesas de apoyo a la Línea de Camas
        if (esReparacionApoyoCamas(order.nombre)) return camasOverflowMesaIds.has(mesaId);
        if (mesaAcceptsMaterial(mesaId, order.sector, order.tamano)) return true;
        return order.sector === SECTOR_CAMAS && camasOverflowMesaIds.has(mesaId);
    };

    // "MODULAR DISTRIBUCIÓN DE MESAS": rebalancea la distribución ya ejecutada, moviendo materiales de
    // mesas sobrecargadas (uso > capacidad) hacia mesas compatibles con capacidad libre, sin necesidad de
    // volver a ejecutar toda la distribución desde cero. En cada mesa sobrecargada se prioriza mover
    // primero él/los material(es) marcados como "EXCEDE CAPACIDAD" (los que provocaron el excedente); si
    // ninguno de esos cabe en otra mesa compatible, se intenta con el resto de materiales de la mesa (del
    // más grande al más pequeño). El material se envía siempre a la mesa compatible con MENOR
    // utilización relativa que tenga espacio suficiente para recibirlo sin sobrecargarse.
    const handleModularDistribution = () => {
        if (!mesaDistribution || mesaDistribution.size === 0) {
            addNotification('warning', 'Debe ejecutar la Distribución de Mesas antes de modularla.');
            return;
        }

        const mesaIds = Array.from(mesaDistribution.keys());
        const capacityById = new Map(mesaIds.map(id => [id, mesaDistribution.get(id)!.capacityHours]));
        const workingItems = new Map<number, MesaScheduleItem[]>(
            mesaIds.map(id => [id, mesaDistribution.get(id)!.items.map(it => ({ ...it }))])
        );

        const usedHoursOf = (id: number) => workingItems.get(id)!.reduce((s, it) => s + (it.endHour - it.startHour), 0);
        const utilizationOf = (id: number) => {
            const cap = capacityById.get(id) ?? 0;
            return cap > 0 ? usedHoursOf(id) / cap : Infinity;
        };

        let materialesMovidos = 0;
        const MAX_ITERATIONS = 200;

        for (let iter = 0; iter < MAX_ITERATIONS; iter++) {
            const overloaded = mesaIds
                .filter(id => usedHoursOf(id) > (capacityById.get(id) ?? 0))
                .sort((a, b) => (usedHoursOf(b) - (capacityById.get(b) ?? 0)) - (usedHoursOf(a) - (capacityById.get(a) ?? 0)));
            if (overloaded.length === 0) break;

            let movedThisRound = false;

            for (const sourceId of overloaded) {
                const sourceItems = workingItems.get(sourceId)!;
                // Primero los que provocan el excedente (overflow), luego el resto de mayor a menor duración
                const candidateItems = [
                    ...sourceItems.filter(it => it.overflow),
                    ...sourceItems.filter(it => !it.overflow).sort((a, b) => (b.endHour - b.startHour) - (a.endHour - a.startHour)),
                ];

                for (const item of candidateItems) {
                    const duracion = item.endHour - item.startHour;
                    const destinos = mesaIds
                        .filter(id => id !== sourceId)
                        .filter(id => mesaCompatibleParaModular(id, item.order))
                        .filter(id => usedHoursOf(id) + duracion <= (capacityById.get(id) ?? 0))
                        .sort((a, b) => utilizationOf(a) - utilizationOf(b));

                    if (destinos.length > 0) {
                        const destId = destinos[0];
                        workingItems.set(sourceId, workingItems.get(sourceId)!.filter(it => it !== item));
                        workingItems.get(destId)!.push({ ...item });
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
            addNotification('info', 'No se encontró ninguna mesa compatible con capacidad libre para reubicar materiales. La distribución no cambió.');
            return;
        }

        // Recalcula startHour/endHour de forma secuencial dentro de cada mesa (igual que en la asignación
        // original) y el flag "overflow" según si el material, en su nueva posición, excede la capacidad.
        const newDistribution = new Map<number, MesaDistributionEntry>();
        mesaIds
            .sort((a, b) => a - b)
            .forEach(id => {
                const capacityHours = capacityById.get(id) ?? 0;
                let cursor = 0;
                const recalculatedItems: MesaScheduleItem[] = workingItems.get(id)!.map(it => {
                    const duracion = it.endHour - it.startHour;
                    const startHour = cursor;
                    const endHour = cursor + duracion;
                    cursor = endHour;
                    return { order: it.order, startHour, endHour, overflow: endHour > capacityHours };
                });
                newDistribution.set(id, {
                    tableId: id,
                    linea: getMesaLinea(id),
                    capacityHours,
                    usedHours: recalculatedItems.reduce((s, it) => s + (it.endHour - it.startHour), 0),
                    items: recalculatedItems,
                });
            });

        setMesaDistribution(newDistribution);
        // Una redistribución invalida cualquier explosión de materiales previa (misma regla que al ejecutar la distribución)
        setFoamExplosionResults([]);
        setPrimerNivelExplosionResults([]);
        setSegundoNivelExplosionResults([]);
        setTelaExplosionResults([]);
        setCascoExplosionResults([]);
        // Actualiza el snapshot de "PLAN" con la distribución ya modulada de esta fecha objetivo
        savePlanDiarioSnapshot(newDistribution);

        addNotification('success', `Distribución modulada: ${materialesMovidos} material(es) reubicado(s) para equilibrar la carga entre mesas. Puede continuar con la Explosión de Materiales.`);
    };

    // Exporta a Excel la planificación confirmada por mesa (Diagrama de Gantt), con el Puesto de Trabajo
    // (TAP-ARxx) y la hora de inicio/final real de cada material, calculadas igual que en el Gantt:
    // relativas al inicio del horario de trabajo seleccionado (selectedShiftConfig.startTime).
    const handleExportMesaDistributionExcel = () => {
        if (!mesaDistribution || mesaDistribution.size === 0 || !planningTargetDate) return;

        const shiftStartUTC = shiftTimeToUTC(planningTargetDate, selectedShiftConfig.startTime);

        const rows: Record<string, string | number>[] = [];
        Array.from(mesaDistribution.values())
            .sort((a, b) => a.tableId - b.tableId)
            .forEach(mesa => {
                const puestoTrabajo = `TAP-AR${String(mesa.tableId).padStart(2, '0')}`;
                mesa.items.forEach(item => {
                    const horaInicio = new Date(shiftStartUTC.getTime() + item.startHour * 60 * 60 * 1000);
                    const horaFinal = new Date(shiftStartUTC.getTime() + item.endHour * 60 * 60 * 1000);
                    rows.push({
                        'N° Orden': item.order.id,
                        'Pedido': item.order.pedido || '',
                        'Posición': item.order.posicion || '',
                        'Material': item.order.material,
                        'Nombre': item.order.nombre,
                        'Cantidad': item.order.cantidadPlanificada,
                        'Puesto de Trabajo': puestoTrabajo,
                        'Hora Inicio': formatEcuadorTime(horaInicio),
                        'Hora Final': formatEcuadorTime(horaFinal),
                    });
                });
            });

        const worksheet = XLSX.utils.json_to_sheet(rows);
        const workbook = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(workbook, worksheet, 'Planificación Confirmada');

        const fechaArchivo = planningTargetDate.toISOString().slice(0, 10);
        XLSX.writeFile(workbook, `Planificacion_Confirmada_Mesas_${fechaArchivo}.xlsx`);
    };

    // Genera el archivo .txt de "Detalle de Planificación Ejecutada" para carga en SAP (formato LSMW ZCSQ,
    // 15 columnas separadas por TAB, pedido explícito del usuario 2026-09-04):
    // "003" | correlativo (001, 002... orden en que se listan los ítems en este archivo) | "ZCSQ" | "1000"
    // | Material | Cant. Planificada | "001" | Puesto de Trabajo | Fecha Planificación (hoy+3 días hábiles)
    // | Hora Inicio | Fecha Planificación (repetida) | Hora Final | Pedido (sin ceros a la izquierda, vacío
    // si es MTS) | Posición de Pedido (sin ceros a la izquierda, vacío si es MTS) | "001"
    // Puesto de Trabajo/Hora Inicio/Hora Final se calculan igual que en "Imprimir Planificación Confirmada"
    // (requiere haber ejecutado la Distribución de Mesas).
    const exportPlanningDetailToLSMW = () => {
        if (!planningResult) return;
        if (!mesaDistribution || mesaDistribution.size === 0 || !planningTargetDate) {
            addNotification('warning', 'Debe presionar "EJECUTAR DISTRIBUCIÓN DE MESAS" antes de descargar el .txt (se necesita la Hora Inicio/Final y el Puesto de Trabajo).');
            return;
        }

        const fechaPlanificacion = addBusinessDays(planningResult.targetDate, 3);
        const fechaTexto = `${String(fechaPlanificacion.getDate()).padStart(2, '0')}.${String(fechaPlanificacion.getMonth() + 1).padStart(2, '0')}.${fechaPlanificacion.getFullYear()}`;

        const shiftStartUTC = shiftTimeToUTC(planningTargetDate, selectedShiftConfig.startTime);
        const sinCerosIniciales = (valor: string) => valor.replace(/^0+/, '');

        const lines: string[] = [];
        let correlativo = 0;
        Array.from(mesaDistribution.values())
            .sort((a, b) => a.tableId - b.tableId)
            .forEach(mesa => {
                const puestoTrabajo = `TAP-AR${String(mesa.tableId).padStart(2, '0')}`;
                mesa.items.forEach(item => {
                    correlativo += 1;
                    const horaInicio = new Date(shiftStartUTC.getTime() + item.startHour * 60 * 60 * 1000);
                    const horaFinal = new Date(shiftStartUTC.getTime() + item.endHour * 60 * 60 * 1000);
                    const pedido = sinCerosIniciales(item.order.pedido || '');
                    const posicion = sinCerosIniciales(item.order.posicion || '');
                    lines.push([
                        '003',
                        String(correlativo).padStart(3, '0'),
                        'ZCSQ',
                        '1000',
                        item.order.material,
                        item.order.cantidadPlanificada,
                        '001',
                        puestoTrabajo,
                        fechaTexto,
                        formatEcuadorTime(horaInicio),
                        fechaTexto,
                        formatEcuadorTime(horaFinal),
                        pedido,
                        posicion,
                        '001',
                    ].join('\t'));
                });
            });

        if (lines.length === 0) return;

        const blob = new Blob([lines.join('\r\n') + '\r\n'], { type: 'text/plain;charset=utf-8' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        const fechaArchivo = planningTargetDate.toISOString().slice(0, 10);
        link.href = url;
        link.download = `Detalle_Planificacion_Ejecutada_${fechaArchivo}.txt`;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(url);
    };

    const handleMaterialExplosion = async () => {
        if (!mesaDistribution || mesaDistribution.size === 0) {
            addNotification('warning', 'Debe presionar "EJECUTAR DISTRIBUCIÓN DE MESAS" antes de calcular la explosión de materiales.');
            return;
        }

        // Demanda por Material (CENTRO 1000), sumando la cantidad planificada de Previsionales y Fert que comparten el mismo material
        const materialDemandMap = new Map<string, number>();
        // Órdenes de producción (de la fecha objetivo) que corresponden a cada Material padre, para poder
        // mostrar el origen (material padre + N° Orden) de cada componente en la alerta de stock
        const materialToOrders = new Map<string, { id: string; pedido: string; nombre: string }[]>();
        mesaDistribution.forEach(mesa => {
            mesa.items.forEach(item => {
                const material = item.order.material;
                materialDemandMap.set(material, (materialDemandMap.get(material) || 0) + item.order.cantidadPlanificada);
                if (!materialToOrders.has(material)) materialToOrders.set(material, []);
                materialToOrders.get(material)!.push({ id: item.order.id, pedido: item.order.pedido, nombre: item.order.nombre });
            });
        });

        const uniqueMaterials = Array.from(materialDemandMap.keys()).filter(Boolean);
        if (uniqueMaterials.length === 0) {
            addNotification('warning', 'No hay materiales distribuidos en mesas para explosionar.');
            return;
        }

        // Kardex: demanda de las mismas órdenes (Fert/Previsionales de Muebles) de días ANTERIORES a la
        // fecha objetivo que todavía están pendientes — Fert con CANTPENDIENTE > 0, Previsionales previas
        // (sin seguimiento de pendiente propio, se toma su CANTIDAD completa). Estas van a consumir stock
        // ANTES que la planificación de hoy, así que se descuentan del Stock Actual.
        const pastDemandMap = new Map<string, number>();
        if (planningTargetDate) {
            mueblesFertOrders.forEach((row: any) => {
                const fecha = row.FECHA ? parseERPDateOnly(row.FECHA) : null;
                const pendiente = Number(row.CANTPENDIENTE) || 0;
                if (fecha && pendiente > 0 && fecha.getTime() < planningTargetDate.getTime()) {
                    const material = normalizeMaterialCode(row.MATERIAL);
                    pastDemandMap.set(material, (pastDemandMap.get(material) || 0) + pendiente);
                }
            });
            mueblesProvisionalOrders.forEach((row: any) => {
                const fechaInicio = row.FECHAINICIO ? parseERPDateOnly(row.FECHAINICIO) : null;
                const cantidad = Number(row.CANTIDAD) || 0;
                if (fechaInicio && cantidad > 0 && fechaInicio.getTime() < planningTargetDate.getTime()) {
                    const material = normalizeMaterialCode(row.MATERIAL);
                    pastDemandMap.set(material, (pastDemandMap.get(material) || 0) + cantidad);
                }
            });
        }
        const pastUniqueMaterials = Array.from(pastDemandMap.keys()).filter(Boolean);

        // Producción propia pendiente de cada COMPONENTE (Espuma/Forros/Estructuras, no Telas/Cascos):
        // órdenes Fert que fabrican ese mismo material (sin importar su RESPCTRLPROD, por eso se usa el
        // dataset completo fertRawData y no mueblesFertOrders), de días anteriores a la fecha objetivo y
        // todavía pendientes (CANTPENDIENTE > 0). Es producción ya en curso que sumará como disponible.
        // Solo Fert (no Previsionales) para no duplicar el mismo lote convertido de Previsional a Fert
        // — mientras existan órdenes Fert de Muebles (hayOrdenesFertMuebles === true). Si SAP ya no
        // genera Fert, no hay lote "convertido" que duplicar: se usa el dataset completo de Previsionales
        // (allRawData, análogo a fertRawData) con FECHAINICIO/CANTIDAD en su lugar, para que la
        // producción propia pendiente siga contando.
        const componentOwnFertPendingMap = new Map<string, number>();
        if (planningTargetDate) {
            if (hayOrdenesFertMuebles) {
                fertRawData.forEach((row: any) => {
                    const fecha = row.FECHA ? parseERPDateOnly(row.FECHA) : null;
                    const pendiente = Number(row.CANTPENDIENTE) || 0;
                    if (fecha && pendiente > 0 && fecha.getTime() < planningTargetDate.getTime()) {
                        const material = normalizeMaterialCode(row.MATERIAL);
                        componentOwnFertPendingMap.set(material, (componentOwnFertPendingMap.get(material) || 0) + pendiente);
                    }
                });
            } else {
                allRawData.forEach((row: any) => {
                    const fecha = row.FECHAINICIO ? parseERPDateOnly(row.FECHAINICIO) : null;
                    const cantidad = Number(row.CANTIDAD) || 0;
                    if (fecha && cantidad > 0 && fecha.getTime() < planningTargetDate.getTime()) {
                        const material = normalizeMaterialCode(row.MATERIAL);
                        componentOwnFertPendingMap.set(material, (componentOwnFertPendingMap.get(material) || 0) + cantidad);
                    }
                });
            }
        }

        // Se explosionan juntos los materiales de hoy y los de días pasados pendientes, en un solo lote
        // paralelo, evitando pedir dos veces la explosión de un mismo material si aparece en ambos.
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

            type RawComponentAccum = {
                componente: string;
                descripcion: string;
                unidad: string;
                totalNecesario: number;
                // Material padre -> Set de "N° Orden (Pedido)" que generan la necesidad de este componente
                origenesMap: Map<string, Set<string>>;
            };
            const grouped = new Map<string, RawComponentAccum>();
            const groupedPrimerNivel = new Map<string, RawComponentAccum>();
            const groupedSegundoNivel = new Map<string, RawComponentAccum>();
            const groupedTelas = new Map<string, RawComponentAccum>();
            const groupedCascos = new Map<string, RawComponentAccum>();
            // Kardex: consumo de cada componente por parte de las órdenes de días pasados pendientes,
            // sin filtrar por categoría (se aplica luego a cualquiera de las 5 tablas)
            const pastConsumptionMap = new Map<string, number>();

            const ensure = (map: Map<string, RawComponentAccum>, componente: string, descripcion: string, unidad: string) => {
                if (!map.has(componente)) {
                    map.set(componente, { componente, descripcion, unidad, totalNecesario: 0, origenesMap: new Map() });
                }
                return map.get(componente)!;
            };

            // Registra, para un componente, de qué Material padre y qué Órdenes de producción (de la
            // fecha objetivo) proviene su necesidad — para mostrarlo en la alerta de stock de Telas/Cascos.
            const recordOrigin = (accum: RawComponentAccum, materialPadre: string) => {
                if (!accum.origenesMap.has(materialPadre)) accum.origenesMap.set(materialPadre, new Set());
                const ordenes = materialToOrders.get(materialPadre) || [];
                ordenes.forEach(o => {
                    const label = o.pedido ? `${o.id || '(MTS)'} (Pedido ${o.pedido})` : (o.id || '(MTS sin N° Orden)');
                    accum.origenesMap.get(materialPadre)!.add(label);
                });
            };

            // Devuelve los códigos que cuelgan (a cualquier profundidad) de un "FORRO BASE" dentro de la
            // explosión de un material padre. La explosión trae MATERIAL_PADRE por fila, así que se arma
            // el árbol y se desciende desde cada "FORRO BASE" marcando toda su rama.
            const getCodigosBajoForroBase = (components: any[]): Set<string> => {
                const hijosPorPadre = new Map<string, any[]>();
                const raices: string[] = [];
                components.forEach((comp: any) => {
                    const padre = String(comp.MATERIAL_PADRE || '').trim();
                    const codigo = String(comp.COMPONENTE || '').trim();
                    if (padre) {
                        if (!hijosPorPadre.has(padre)) hijosPorPadre.set(padre, []);
                        hijosPorPadre.get(padre)!.push(comp);
                    }
                    const desc = String(comp.DESCRIPCION_COMPONENTE || '').trim().toUpperCase();
                    if (codigo && desc.startsWith('FORRO BASE')) raices.push(codigo);
                });
                const bajoForroBase = new Set<string>(raices);
                const pendientes = [...raices];
                while (pendientes.length > 0) {
                    const actual = pendientes.pop()!;
                    (hijosPorPadre.get(actual) || []).forEach((hijo: any) => {
                        const codigoHijo = String(hijo.COMPONENTE || '').trim();
                        if (codigoHijo && !bajoForroBase.has(codigoHijo)) {
                            bajoForroBase.add(codigoHijo);
                            pendientes.push(codigoHijo);
                        }
                    });
                }
                return bajoForroBase;
            };

            // Devuelve los códigos que cuelgan (a cualquier profundidad) de "TELA DE APROVECHAMIENTO"
            // (código 30020937) dentro de la explosión de un material padre. Este material es un "cajón
            // de sastre" que en SAP lista como sus propios "componentes" una muestra fija de ~10 telas de
            // colores/productos completamente distintos (todas con cantidad placeholder 0.25/1, sin
            // relación con lo que el pedido realmente usa) — NO es consumo real. Confirmado en vivo
            // (2026-08-26): la explosión de "SOFÁ FOAM 105 ELEMENTA BRUMA" (20014132) incluye, colgando de
            // 30020937, "TELA MUEBLES ASTRA BEIGE WESTVIEW STUCCO" (40003011) y "TELA MUEBLES EPIC BRUMA
            // FLEMMINGS STORM" (40002771) — ninguna de las dos es la tela real del pedido (esa es
            // "TELA MUEBLES ELEMENTA BRUMA WD24036A C21", 40003358, en otra rama del árbol) — causaba
            // falsos positivos en la Alerta de Stock de Telas. Ya existía este mismo hallazgo en
            // "Segundo Nivel" (esExcluidoSegundoNivel excluye "TELA DE APROVECHAMIENTO" en sí), pero no
            // sus hijos aquí. Mismo patrón que getCodigosBajoForroBase.
            const getCodigosBajoTelaAprovechamiento = (components: any[]): Set<string> => {
                const hijosPorPadre = new Map<string, any[]>();
                const raices: string[] = [];
                components.forEach((comp: any) => {
                    const padre = String(comp.MATERIAL_PADRE || '').trim();
                    const codigo = String(comp.COMPONENTE || '').trim();
                    if (padre) {
                        if (!hijosPorPadre.has(padre)) hijosPorPadre.set(padre, []);
                        hijosPorPadre.get(padre)!.push(comp);
                    }
                    const desc = String(comp.DESCRIPCION_COMPONENTE || '').trim().toUpperCase();
                    if (codigo && (desc.startsWith('TELA DE APROVECHAMIENTO') || normalizeMaterialCode(codigo) === '30020937')) {
                        raices.push(codigo);
                    }
                });
                const bajoAprovechamiento = new Set<string>(raices);
                const pendientes = [...raices];
                while (pendientes.length > 0) {
                    const actual = pendientes.pop()!;
                    (hijosPorPadre.get(actual) || []).forEach((hijo: any) => {
                        const codigoHijo = String(hijo.COMPONENTE || '').trim();
                        if (codigoHijo && !bajoAprovechamiento.has(codigoHijo)) {
                            bajoAprovechamiento.add(codigoHijo);
                            pendientes.push(codigoHijo);
                        }
                    });
                }
                return bajoAprovechamiento;
            };

            responses.forEach((components, idx) => {
                const material = allUniqueMaterials[idx];
                const parentDemand = materialDemandMap.get(material) || 0;
                const parentPastDemand = pastDemandMap.get(material) || 0;
                if (parentDemand === 0 && parentPastDemand === 0) return;

                const codigosBajoForroBase = getCodigosBajoForroBase(components);
                const codigosBajoAprovechamiento = getCodigosBajoTelaAprovechamiento(components);

                components.forEach((comp: any) => {
                    const descripcion = String(comp.DESCRIPCION_COMPONENTE || '').trim();
                    const descripcionUpper = descripcion.toUpperCase();
                    // Versión sin tildes, solo para el chequeo de "LAMINA CILINDRICA" más abajo (la fuente
                    // puede o no traer el acento en la Í según el material).
                    const descripcionSinAcentos = descripcionUpper.normalize('NFD').replace(/[̀-ͯ]/g, '');
                    const componente = String(comp.COMPONENTE || '').trim();
                    if (!componente) return;

                    const cantBase = Number(comp.CANTIDAD_ACUMULADA ?? comp.CANTIDAD_UNITARIA ?? 0);
                    const necesario = cantBase * parentDemand;
                    const consumoPasado = cantBase * parentPastDemand;
                    const unidad = String(comp.UNIDAD || 'UN');

                    // Se excluye lo que cuelga de "TELA DE APROVECHAMIENTO" también aquí (no solo en el
                    // bloque de Telas más abajo): este mapa alimenta "Consumo Órdenes Pasadas" del kardex
                    // de CUALQUIER tabla (Espuma/PrimerNivel/SegundoNivel/Telas/Cascos) para ese código de
                    // componente — dejar pasar el dato contaminado aquí inflaría el consumo pasado si ese
                    // mismo código llega a tener una aparición legítima en otro pedido.
                    if (consumoPasado > 0 && !codigosBajoAprovechamiento.has(componente)) {
                        pastConsumptionMap.set(componente, (pastConsumptionMap.get(componente) || 0) + consumoPasado);
                    }
                    if (necesario <= 0) return;

                    const respCtrlProdComponente = materialRespCtrlProdMap.get(normalizeMaterialCode(componente));

                    // Semielaborados de espuma para muebles: la descripción inicia con "LAMINA" o "ESPUMA".
                    // Excepción 1: "LAMINA CILINDRICA" en particular también aparece como semielaborado del
                    // "FORRO BASE" (no es espuma suelta de muebles) — el usuario confirmó que de esas solo
                    // deben devolverse las que tienen RespCtrlProd '014' (espuma genuina de muebles); el
                    // resto pertenece al proceso de Forros y no debe aparecer en esta tabla.
                    // Excepción 2: toda espuma que descienda de un "FORRO BASE" (p. ej. las LAMINA
                    // CILINDRICA que cuelgan de las BANDAS/ACOLCHADOS de un "FORRO BASE DUO", varios
                    // niveles más abajo) se consume dentro del proceso de Forros, no en el de Espuma.
                    if (descripcionUpper.startsWith('LAMINA') || descripcionUpper.startsWith('ESPUMA')) {
                        const esLaminaCilindrica = descripcionSinAcentos.startsWith('LAMINA CILINDRICA');
                        const excluidaPorFiltroCilindrica = esLaminaCilindrica
                            && materialRespCtrlProdMap.get(normalizeMaterialCode(componente)) !== '014';
                        const excluidaPorForroBase = codigosBajoForroBase.has(String(comp.MATERIAL_PADRE || '').trim());
                        if (!excluidaPorFiltroCilindrica && !excluidaPorForroBase) {
                            const accum = ensure(grouped, componente, descripcion, unidad);
                            accum.totalNecesario += necesario;
                            recordOrigin(accum, material);
                        }
                    }

                    // Semielaborados de Primer Nivel para Muebles: cualquier componente cuyo RESPCTRLPROD (Cubo
                    // de Inventarios) sea '026' o '033' — ya no se filtra por prefijo de descripción ("FORRO"/
                    // "ESTRUCTURA"), el criterio pasó a ser puramente el responsable de control de fabricación,
                    // excluyendo los materiales ficticios (COJIN CILINDRICO/BASE/ENSAMBLE) y las líneas de
                    // producto ajenas a Muebles (MASCOTA/PET) — ver esExcluidoPrimerNivel.
                    if (respCtrlProdComponente && RESP_CTRL_PROD_PRIMER_NIVEL.includes(respCtrlProdComponente) && !esExcluidoPrimerNivel(descripcionUpper)) {
                        const accum = ensure(groupedPrimerNivel, componente, descripcion, unidad);
                        accum.totalNecesario += necesario;
                        recordOrigin(accum, material);
                    }

                    // Semielaborados de Segundo Nivel para Muebles: RESPCTRLPROD '042' o '037', excluyendo las
                    // líneas de producto ajenas a Muebles (descripción con "PET"/"MASCOTA"/"FUN").
                    if (respCtrlProdComponente && RESP_CTRL_PROD_SEGUNDO_NIVEL.includes(respCtrlProdComponente) && !esExcluidoSegundoNivel(descripcionUpper)) {
                        const accum = ensure(groupedSegundoNivel, componente, descripcion, unidad);
                        accum.totalNecesario += necesario;
                        recordOrigin(accum, material);
                    }

                    // Telas para muebles: la descripción inicia con "TELA MUEBLES". La unidad se fuerza a
                    // "M" (metros): todas las telas se miden en metros y el Maestro de Materiales a veces
                    // no trae la UNIDAD, cayendo en el default genérico "UN" que no aplica aquí.
                    // Excluye las que cuelgan de "TELA DE APROVECHAMIENTO" (30020937) — no son consumo
                    // real, son una muestra fija de colores ajenos al pedido (ver getCodigosBajoTelaAprovechamiento).
                    if (descripcionUpper.startsWith('TELA MUEBLES') && !codigosBajoAprovechamiento.has(componente)) {
                        const accum = ensure(groupedTelas, componente, descripcion, 'M');
                        accum.totalNecesario += necesario;
                        recordOrigin(accum, material);
                    }

                    // Cascos para muebles: la descripción inicia con "CASCO" — misma exclusión por
                    // consistencia, aunque no se ha detectado un caso real de contaminación en Cascos.
                    if (descripcionUpper.startsWith('CASCO') && !codigosBajoAprovechamiento.has(componente)) {
                        const accum = ensure(groupedCascos, componente, descripcion, unidad);
                        accum.totalNecesario += necesario;
                        recordOrigin(accum, material);
                    }
                });
            });

            // Kardex: Stock Actual - Consumo de Órdenes Pasadas Pendientes + Producción Propia Pendiente
            // (esta última solo para Espuma/Forros/Estructuras, no para Telas/Cascos) = lo que realmente
            // queda disponible; Cantidad Neta Requerida = max(0, Necesario de hoy - Disponible Real).
            const withKardex = (includeOwnProduction: boolean) => (c: RawComponentAccum): FoamComponentNeed => {
                const stockActual = materialStockActualMap.get(normalizeMaterialCode(c.componente)) ?? null;
                const consumoOrdenesPasadas = pastConsumptionMap.get(c.componente) || 0;
                const produccionPropiaPendiente = includeOwnProduction
                    ? (componentOwnFertPendingMap.get(normalizeMaterialCode(c.componente)) || 0)
                    : 0;
                const disponibleReal = (stockActual !== null || produccionPropiaPendiente > 0)
                    ? (stockActual ?? 0) - consumoOrdenesPasadas + produccionPropiaPendiente
                    : null;
                const cantidadNetaAConseguir = disponibleReal !== null ? Math.max(0, c.totalNecesario - disponibleReal) : c.totalNecesario;
                const origenes: ComponentOrigen[] = Array.from(c.origenesMap.entries()).map(([materialPadre, ordenesSet]) => ({
                    materialPadre,
                    ordenes: Array.from(ordenesSet),
                }));
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
                    origenes,
                };
            };

            // Espuma/Primer Nivel/Segundo Nivel NO muestran (ni exportan) componentes cuya Cantidad Neta
            // Requerida sea <= 0 (ya cubierto por el kardex: el stock disponible ya alcanza lo necesario).
            const sorted = Array.from(grouped.values()).map(withKardex(true)).filter(c => c.cantidadNetaAConseguir > 0).sort((a, b) => b.cantidadNetaAConseguir - a.cantidadNetaAConseguir);
            setFoamExplosionResults(sorted);

            // Primer Nivel/Segundo Nivel se muestran y exportan (Excel/txt) en orden alfabético por
            // descripción, a diferencia de las demás tablas de esta explosión (que ordenan por cantidad).
            const sortedPrimerNivel = Array.from(groupedPrimerNivel.values()).map(withKardex(true)).filter(c => c.cantidadNetaAConseguir > 0).sort((a, b) => a.descripcion.localeCompare(b.descripcion, 'es'));
            setPrimerNivelExplosionResults(sortedPrimerNivel);

            const sortedSegundoNivel = Array.from(groupedSegundoNivel.values()).map(withKardex(true)).filter(c => c.cantidadNetaAConseguir > 0).sort((a, b) => a.descripcion.localeCompare(b.descripcion, 'es'));
            setSegundoNivelExplosionResults(sortedSegundoNivel);

            // Telas: Alerta de Stock con el mismo criterio de la pestaña "Telas" (StockActual bruto < 300 = "CRÍTICO")
            const sortedTelas: TelaComponentNeed[] = Array.from(groupedTelas.values())
                .map(withKardex(false))
                .map(c => ({
                    ...c,
                    alertaStock: c.stockActual !== null && c.stockActual < 300,
                    stockRestante: (c.stockActual ?? 0) - c.totalNecesario,
                }))
                .sort((a, b) => b.cantidadNetaAConseguir - a.cantidadNetaAConseguir);
            setTelaExplosionResults(sortedTelas);

            // Cascos: sin stock suficiente cuando, después del kardex, todavía hace falta conseguir/producir
            const sortedCascos: CascoComponentNeed[] = Array.from(groupedCascos.values())
                .map(withKardex(false))
                .map(c => ({ ...c, sinStock: c.cantidadNetaAConseguir > 0 }))
                .sort((a, b) => b.cantidadNetaAConseguir - a.cantidadNetaAConseguir);
            setCascoExplosionResults(sortedCascos);

            const telasConAlerta = sortedTelas.filter(t => t.alertaStock);
            const cascosSinStock = sortedCascos.filter(c => c.sinStock);
            if (telasConAlerta.length > 0 || cascosSinStock.length > 0) {
                setStockAlertData({ telas: telasConAlerta, cascos: cascosSinStock });
                setStockAlertDialogOpen(true);
            }

            if (sorted.length > 0 || sortedPrimerNivel.length > 0 || sortedSegundoNivel.length > 0 || sortedTelas.length > 0 || sortedCascos.length > 0) {
                addNotification('success', `Explosión completada: ${sorted.length} semielaborado(s) de espuma, ${sortedPrimerNivel.length} de primer nivel, ${sortedSegundoNivel.length} de segundo nivel, ${sortedTelas.length} de tela y ${sortedCascos.length} de casco identificado(s).`);
            } else {
                addNotification('warning', 'No se encontraron semielaborados de espuma, primer nivel, segundo nivel, tela ni casco en la explosión de estos materiales.');
            }
        } catch (error) {
            console.error('Error en la explosión de materiales:', error);
            addNotification('error', 'Error al procesar la explosión de materiales.');
        } finally {
            setIsExplodingMaterials(false);
        }
    };

    const handleSavePlanAndDetails = async () => {
        const executedOrders = planningResult ? [...planningResult.immediateOrders, ...planningResult.extraOrders] : [];
        const hayP13 = executedOrders.length > 0;
        const hayP15 = primerNivelExplosionResults.length > 0 || segundoNivelExplosionResults.length > 0;
        const hayP2 = foamExplosionResults.length > 0;
        // Paso 3 (Final): "Guardar Plan Táctico Final" NO vuelve a guardar P1.3/P1.5/P2 (ya se guardaron
        // en Paso 1/2) — únicamente guarda un Plan de Grupo "PFSM" (Plan Final de Semielaborados de
        // Muebles) con el Detalle de Planificación Ejecutada (mismo contenido que P1.3: cada orden de
        // planningResult.immediateOrders + extraOrders), que es lo que el administrador necesita ver.
        const esPasoFinal = planningResult?.planningStepResult === 3;
        const hayPFSM = esPasoFinal && hayP13;

        if (esPasoFinal) {
            if (!hayPFSM) {
                addNotification('warning', 'No hay detalles de Planificación Ejecutada para guardar en el Plan Final.');
                return;
            }
        } else if (!hayP13 && !hayP15 && !hayP2) {
            addNotification('warning', 'No hay detalles de "Planificación Ejecutada" ni "Explosión de Materiales" para guardar. Ejecute primero la planificación y la explosión.');
            return;
        }
        if (!planningTargetDate) {
            addNotification('warning', 'No se pudo determinar la fecha de programación de la Ventana de Fabricación.');
            return;
        }
        if (!mueblesGrupo) {
            addNotification('error', 'No se pudo determinar el Grupo/Centro asociado para guardar el plan.');
            return;
        }

        setIsSavingPlan(true);
        try {
            // Crea un Plan de Grupo con el sufijo indicado (P1.3 / P1.5 / P2) y devuelve su código.
            // codigo_plan y codigo_familia_grupo se envían como null (no 0) para evitar un error de
            // integridad referencial contra tablas que aún no tienen ese registro relacionado.
            // fechaPlan por defecto es planningTargetDate (el 3er día laborable de la Ventana de
            // Fabricación de Muebles); P2 (Espuma) es la excepción — se guarda con hoy + 1 día calendario,
            // porque el área de espuma programa con un horizonte distinto al de Muebles.
            const savePlanGrupo = async (sufijo: string, fechaPlan: Date | null = planningTargetDate): Promise<number> => {
                const planPayload = {
                    codigo_plan_grupo: 0,
                    codigo_plan: null,
                    codigo_grupo: mueblesGrupo.codigo_grupo,
                    codigo_familia_grupo: null,
                    valor: `Plan Táctico - Centro ${mueblesGrupo.centro} - ${sufijo}`,
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

            // Paso 3 (Final): "Guardar Plan Táctico Final" NO vuelve a guardar P1.3/P1.5/P2 — esos ya se
            // guardaron en Paso 1/2. Solo se guarda el PFSM (bloque más abajo).
            if (!esPasoFinal) {
                // 1. P1.3 — Detalle de Planificación Ejecutada: cada orden inmediata + de relleno de capacidad
                // que se calculó en "EJECUTAR PLANIFICACIÓN" / "PASO 2: RECALCULAR..."
                if (hayP13) {
                    const codigoPlanGrupoP13 = await savePlanGrupo('P1.3');
                    for (const o of executedOrders) {
                        await saveDetalle(codigoPlanGrupoP13, Number(o.material) || 0, o.cantidadPlanificada, '');
                    }
                }

                // 2. P1.5 — Explosión de Materiales: Semielaborados de Primer Nivel (026/033) + Segundo
                // Nivel (042/037). El resp_ctrl_prod real de cada componente se toma del Cubo de
                // Inventarios (materialRespCtrlProdMap), ya que ambas tablas ya no son mono-código.
                if (hayP15) {
                    const codigoPlanGrupoP15 = await savePlanGrupo('P1.5');
                    for (const comp of primerNivelExplosionResults) {
                        const respCtrlProd = materialRespCtrlProdMap.get(normalizeMaterialCode(comp.componente)) || '';
                        await saveDetalle(codigoPlanGrupoP15, Number(comp.componente) || 0, comp.cantidadNetaAConseguir, respCtrlProd);
                    }
                    for (const comp of segundoNivelExplosionResults) {
                        const respCtrlProd = materialRespCtrlProdMap.get(normalizeMaterialCode(comp.componente)) || '';
                        await saveDetalle(codigoPlanGrupoP15, Number(comp.componente) || 0, comp.cantidadNetaAConseguir, respCtrlProd);
                    }
                }

                // 3. P2 — Explosión de Materiales: Semielaborados de Espuma. Fecha objetivo = el próximo
                // día LABORABLE (no planningTargetDate, que es el 3er día laborable de la ventana — el
                // área de espuma programa con horizonte propio, pero igual debe caer en día laborable,
                // saltando fines de semana y feriados de Ecuador vía workingWindow/holidaysMap).
                if (hayP2) {
                    const codigoPlanGrupoP2 = await savePlanGrupo('P2', computeFechaP2());
                    for (const comp of foamExplosionResults) {
                        await saveDetalle(codigoPlanGrupoP2, Number(comp.componente) || 0, comp.cantidadNetaAConseguir, '');
                    }
                }
            }

            // 4. PFSM (Plan Final de Semielaborados de Muebles) — solo en Paso 3 (Final), y es lo ÚNICO que
            // se guarda en ese paso: Detalle de Planificación Ejecutada (mismo contenido que P1.3).
            if (hayPFSM) {
                const codigoPlanGrupoPFSM = await savePlanGrupo('PFSM');
                for (const o of executedOrders) {
                    await saveDetalle(codigoPlanGrupoPFSM, Number(o.material) || 0, o.cantidadPlanificada, '');
                }
            }

            const partes = esPasoFinal
                ? [`PFSM (${executedOrders.length} orden(es))`]
                : [
                    hayP13 ? `P1.3 (${executedOrders.length} orden(es))` : null,
                    hayP15 ? `P1.5 (${primerNivelExplosionResults.length + segundoNivelExplosionResults.length} detalle(s))` : null,
                    hayP2 ? `P2 (${foamExplosionResults.length} detalle(s))` : null,
                ].filter(Boolean);
            addNotification('success', `${esPasoFinal ? 'Plan Táctico Final guardado' : 'Plan Táctico guardado'}: ${partes.join(', ')}.`);

            // Guarda la asignación de personal por mesa de esta planificación para pre-cargarla
            // por defecto en la próxima (ver confirmChooseTables).
            if (mueblesGrupo?.centro) {
                saveLastTableAssignments(mueblesGrupo.centro, tableAssignments);
            }
        } catch (error) {
            console.error('Error al guardar el Plan Táctico:', error);
            addNotification('error', `Error al guardar el Plan Táctico: ${(error as Error).message}`);
        } finally {
            setIsSavingPlan(false);
        }
    };

    // Reinicia todo el progreso de la planificación en curso (mesas, personal, planificación calculada,
    // distribución, explosión de materiales) para empezar una nueva desde cero. Los datos ya descargados
    // de SAP (órdenes, tiempos, inventario) NO se vuelven a descargar — para eso está "Actualizar Datos".
    const handleNuevaPlanificacion = () => {
        setActiveTables(new Set(WORK_TABLES.map(t => t.id)));
        setCamasOverflowMesaIds(new Set(CAMAS_OVERFLOW_MESA_IDS));
        setUncheckedMovableIds(new Set());
        setSelectedShift(SHIFT_SCHEDULES[0].id);
        setChosenTables(null);
        setTableAssignments({});
        setMaintenanceDecisions({});
        setHourDiscounts([]);
        setNewDiscountMotivo('');
        setNewDiscountHoras('');
        setPlanningResult(null);
        setPlanningStep(1);
        setMesaDistribution(null);
        setUnassignedDistributionOrders([]);
        setFoamExplosionResults([]);
        setPrimerNivelExplosionResults([]);
        setSegundoNivelExplosionResults([]);
        setTelaExplosionResults([]);
        setCascoExplosionResults([]);
        setStockAlertDialogOpen(false);
        setStockAlertData({ telas: [], cascos: [] });
        setPlanCheckModal(null);
        setIsPlanCheckBusy(false);
        setIsExplodingMaterials(false);
        setIsSavingPlan(false);
        setShowNuevaPlanificacionConfirm(false);
        addNotification('info', 'Planificación reiniciada. Puede comenzar una nueva desde cero.');
    };

    return (
        <div className="space-y-4">
            <div className="flex flex-col space-y-6">

                {/* SECCIÓN DE VENTANA DE FABRICACIÓN (DÍAS LABORABLES) */}
                <div className="bg-white border border-gray-200 rounded-xl p-6 shadow-sm">
                    <div className="flex items-center justify-between mb-4">
                        <div className="flex items-center gap-2">
                            <CalendarDays className="w-5 h-5 text-indigo-600" />
                            <h3 className="text-sm font-bold text-gray-800 uppercase tracking-tight">Ventana de Fabricación ({WORKING_DAYS_TARGET} Días Laborables)</h3>
                        </div>
                        <div className="flex items-center gap-3">
                            <p className="text-[11px] text-gray-400 max-w-md text-right">
                                Por defecto no se consideran fines de semana ni feriados. Actívelos si la fábrica va a operar ese día.
                            </p>
                            <Button
                                onClick={() => setShowNuevaPlanificacionConfirm(true)}
                                variant="outline"
                                size="sm"
                                title="Reinicia mesas, personal, planificación, distribución y explosión de materiales para empezar de cero."
                                className="h-8 border-amber-300 text-amber-700 hover:bg-amber-50 gap-1.5 text-xs shrink-0"
                            >
                                <RotateCcw className="w-3.5 h-3.5" />
                                Planificación Nueva
                            </Button>
                            <Button
                                onClick={() => handleRefreshData()}
                                disabled={isLoading}
                                size="sm"
                                title="Vuelve a descargar los datos de SAP (Fert, Previsionales, Pendientes, Inventario). Úselo después de mover órdenes manualmente en SAP."
                                className="h-8 bg-indigo-600 hover:bg-indigo-700 text-white gap-1.5 text-xs shrink-0"
                            >
                                {isLoading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <RefreshCw className="w-3.5 h-3.5" />}
                                Actualizar Datos
                            </Button>
                        </div>
                    </div>

                    <div className="flex flex-wrap gap-3">
                        {visiblePlanningDays.map(day => {
                            const isSpecial = !day.isDefaultWorking;
                            const isIncludedInWindow = workingWindow.some(w => w.key === day.key);
                            const windowPosition = workingWindow.findIndex(w => w.key === day.key);

                            return (
                                <div
                                    key={day.key}
                                    className={cn(
                                        "relative w-32 rounded-lg border-2 p-3 flex flex-col items-center gap-1 transition-colors",
                                        isIncludedInWindow
                                            ? "border-indigo-500 bg-indigo-50"
                                            : isSpecial
                                                ? "border-dashed border-gray-300 bg-gray-50"
                                                : "border-gray-200 bg-white"
                                    )}
                                >
                                    {isIncludedInWindow && (
                                        <span className="absolute -top-2 -right-2 w-5 h-5 rounded-full bg-indigo-600 text-white text-[10px] font-bold flex items-center justify-center shadow">
                                            {windowPosition + 1}
                                        </span>
                                    )}
                                    <span className="text-[10px] font-bold text-gray-500 uppercase">{DAY_NAMES_SHORT[day.dayOfWeek]}</span>
                                    <span className="text-sm font-black text-gray-800">
                                        {day.date.toLocaleDateString('es-EC', { day: '2-digit', month: '2-digit' })}
                                    </span>

                                    {day.holidayName && (
                                        <div className="flex flex-col items-center gap-0.5" title={day.holidayName}>
                                            <Badge className="text-[9px] bg-amber-100 text-amber-800 hover:bg-amber-100 gap-1 px-1.5 py-0.5 h-auto border border-amber-300 animate-pulse">
                                                <TriangleAlert className="w-2.5 h-2.5 shrink-0" />
                                                FERIADO
                                            </Badge>
                                            <span className="text-[9px] text-amber-700 font-semibold text-center leading-tight">
                                                {day.holidayName}
                                            </span>
                                        </div>
                                    )}
                                    {!day.holidayName && day.isWeekend && (
                                        <span className="text-[9px] text-gray-400 font-semibold uppercase">Fin de Semana</span>
                                    )}
                                    {!isSpecial && (
                                        <Badge className="text-[9px] bg-emerald-100 text-emerald-700 hover:bg-emerald-100">Laborable</Badge>
                                    )}

                                    {isSpecial && (
                                        <div className="flex items-center gap-2 mt-1">
                                            <Switch
                                                checked={day.isActivated}
                                                onCheckedChange={() => toggleSpecialDay(day.key)}
                                                className="scale-90"
                                            />
                                            <span className="text-[9px] font-bold text-gray-500 uppercase">Activar</span>
                                        </div>
                                    )}
                                </div>
                            );
                        })}
                    </div>

                    {workingWindow.length > 0 && (
                        <div className="mt-4 pt-4 border-t border-dashed border-gray-200 flex items-center gap-2 text-xs text-gray-600">
                            <span className="font-bold text-gray-700">Ventana de fabricación:</span>
                            {workingWindow.map((d, idx) => (
                                <span key={d.key} className="font-mono font-semibold text-indigo-700">
                                    {d.date.toLocaleDateString('es-EC', { day: '2-digit', month: '2-digit', year: 'numeric' })}{idx < workingWindow.length - 1 ? ' •' : ''}
                                </span>
                            ))}
                        </div>
                    )}
                </div>

                {/* SECCIÓN DE CONFIGURACIÓN DE CAPACIDAD (MESAS) */}
                <div className="bg-white border border-gray-200 rounded-xl p-6 shadow-sm">
                    <div className="flex items-center gap-2 mb-4">
                        <Settings2 className="w-5 h-5 text-indigo-600" />
                        <h3 className="text-sm font-bold text-gray-800 uppercase tracking-tight">Configuración de Mesas de Trabajo Disponibles</h3>
                    </div>
                    
                    <div className="grid grid-cols-1 lg:grid-cols-4 gap-8">
                        <div className="lg:col-span-3">
                            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-x-6 gap-y-3">
                                {WORK_TABLES.map(table => {
                                    const isLinea2 = table.id > 7;
                                    const isCamasEnabled = camasOverflowMesaIds.has(table.id);
                                    return (
                                        <div key={table.id} className="flex flex-col gap-1 p-1 hover:bg-gray-50 rounded transition-colors group">
                                            <div className="flex items-center space-x-3">
                                                <Checkbox
                                                    id={`table-${table.id}`}
                                                    checked={activeTables.has(table.id)}
                                                    onCheckedChange={() => toggleTableSelection(table.id)}
                                                    className="data-[state=checked]:bg-indigo-600 border-gray-300"
                                                />
                                                <label
                                                    htmlFor={`table-${table.id}`}
                                                    className="text-xs font-semibold text-gray-700 cursor-pointer select-none group-hover:text-indigo-600"
                                                >
                                                    {table.name}
                                                </label>
                                            </div>
                                            {isLinea2 && (
                                                <button
                                                    type="button"
                                                    onClick={() => toggleCamasOverflow(table.id)}
                                                    title="Habilita esta mesa de Línea 2 (Muebles) como válvula de alivio para fabricar excedentes de Línea 1 (Camas) cuando esa línea ya no tenga capacidad disponible."
                                                    className={cn(
                                                        "ml-7 w-fit inline-flex items-center gap-1 text-[9px] font-bold uppercase px-1.5 py-0.5 rounded-full border transition-colors",
                                                        isCamasEnabled
                                                            ? "bg-sky-100 border-sky-300 text-sky-700 hover:bg-sky-200"
                                                            : "bg-gray-50 border-gray-200 text-gray-400 hover:bg-gray-100"
                                                    )}
                                                >
                                                    <BedDouble className="w-3 h-3" />
                                                    {isCamasEnabled ? 'Habilitada p/ Camas' : 'Habilitar p/ Camas'}
                                                </button>
                                            )}
                                        </div>
                                    );
                                })}
                            </div>
                        </div>

                        <div className="flex flex-col justify-center gap-4 border-l pl-8 border-gray-100">
                            <div className="text-center">
                                <p className="text-[10px] font-bold text-gray-400 uppercase">Capacidad Habilitada</p>
                                <p className="text-2xl font-black text-indigo-700">{activeTables.size} <span className="text-xs font-medium text-gray-500">Mesas</span></p>
                            </div>
                            <div className="flex flex-col gap-1">
                                <label className="text-[10px] font-bold text-gray-400 uppercase text-center">Horario de Trabajo</label>
                                <Select value={selectedShift} onValueChange={setSelectedShift}>
                                    <SelectTrigger className="h-9 text-xs font-semibold">
                                        <SelectValue placeholder="Seleccione horario" />
                                    </SelectTrigger>
                                    <SelectContent>
                                        {SHIFT_SCHEDULES.map(shift => (
                                            <SelectItem key={shift.id} value={shift.id} className="text-xs">
                                                {shift.label}
                                            </SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                            </div>
                            <Button
                                onClick={() => setIsEsperaDialogOpen(true)}
                                variant="outline"
                                className="w-full border-amber-200 text-amber-700 hover:bg-amber-50 font-bold gap-2"
                            >
                                {isCheckingMaterialesEnEspera ? <Loader2 className="w-4 h-4 animate-spin" /> : <TimerOff className="w-4 h-4" />}
                                MATERIALES EN ESPERA{materialesEnEspera.length > 0 ? ` (${materialesEnEspera.length})` : ''}
                            </Button>
                            <Button
                                onClick={handleChooseTables}
                                variant="outline"
                                className="w-full border-indigo-200 text-indigo-700 hover:bg-indigo-50 font-bold gap-2"
                                disabled={activeTables.size === 0 || isPlanCheckBusy}
                            >
                                {isPlanCheckBusy ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCircle2 className="w-4 h-4" />}
                                ESCOGER MESAS
                            </Button>
                            <Button
                                onClick={handleRunPlanning}
                                className={cn(
                                    "w-full h-auto min-h-10 text-white font-bold gap-2 py-3 shadow-lg whitespace-normal text-center leading-tight break-words",
                                    planningStep >= 2 ? "bg-amber-600 hover:bg-amber-700 shadow-amber-200" : "bg-indigo-600 hover:bg-indigo-700 shadow-indigo-200"
                                )}
                                disabled={isLoading || allRawData.length === 0}
                            >
                                <PlayCircle className="w-5 h-5 shrink-0" />
                                <span>{planningStep === 3 ? 'PASO 3 PLANIFICACIÓN FINAL' : planningStep === 2 ? 'PASO 2: RECALCULAR PLANIFICACIÓN AJUSTADA' : 'EJECUTAR PLANIFICACIÓN'}</span>
                            </Button>
                            <Button
                                onClick={handleExecuteDistribution}
                                className="w-full h-auto min-h-10 bg-purple-700 hover:bg-purple-800 text-white font-bold gap-2 py-3 shadow-purple-200 shadow-lg whitespace-normal text-center leading-tight break-words"
                                disabled={!planningResult}
                            >
                                <LayoutGrid className="w-5 h-5 shrink-0" />
                                <span>EJECUTAR DISTRIBUCIÓN DE MESAS</span>
                            </Button>
                        </div>
                    </div>
                </div>

                {chosenTables && chosenTables.length > 0 && (
                    <div className="bg-white border border-gray-200 rounded-xl shadow-md overflow-hidden">
                        <div className="flex items-center gap-2 px-6 py-4 bg-gradient-to-r from-emerald-700 to-teal-700">
                            <Gauge className="w-5 h-5 text-emerald-100" />
                            <h3 className="text-sm font-bold text-white uppercase tracking-wide">Capacidad Disponible Escogida</h3>
                        </div>
                        <div className="p-6 grid grid-cols-1 md:grid-cols-3 gap-4">
                            <div className="bg-gray-50 border border-gray-200 rounded-lg p-4 flex items-center gap-4">
                                <div className="bg-indigo-100 p-2 rounded-lg">
                                    <CheckCircle2 className="w-6 h-6 text-indigo-600" />
                                </div>
                                <div>
                                    <p className="text-[10px] font-bold text-gray-400 uppercase">Mesas con Capacidad Calculada</p>
                                    <p className="text-2xl font-black text-gray-800">{capacitySummary.mesasConDatos} <span className="text-xs font-medium text-gray-500">de {chosenTables.length}</span></p>
                                </div>
                            </div>

                            <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 flex items-center gap-4">
                                <div className="bg-blue-100 p-2 rounded-lg">
                                    <Clock className="w-6 h-6 text-blue-700" />
                                </div>
                                <div>
                                    <p className="text-[10px] font-bold text-blue-500 uppercase">Capacidad Total Disponible</p>
                                    <p className="text-2xl font-black text-blue-800">{capacitySummary.totalHours.toFixed(2)} <span className="text-xs font-medium text-blue-500">Horas</span></p>
                                </div>
                            </div>

                            <div className="bg-emerald-50 border border-emerald-200 rounded-lg p-4 flex items-center gap-4">
                                <div className="bg-emerald-100 p-2 rounded-lg">
                                    <Boxes className="w-6 h-6 text-emerald-700" />
                                </div>
                                <div>
                                    <p className="text-[10px] font-bold text-emerald-500 uppercase">Unidades Equivalentes Fabricables</p>
                                    <p className="text-2xl font-black text-emerald-800">
                                        {capacitySummary.equivalentUnits.toLocaleString(undefined, { minimumFractionDigits: 1, maximumFractionDigits: 1 })}
                                        <span className="text-xs font-medium text-emerald-500 ml-1">unid.</span>
                                    </p>
                                    <p className="text-[9px] text-emerald-500 mt-0.5">1 unidad equivalente = 32.21 min</p>
                                </div>
                            </div>
                        </div>

                        <div className="px-6 pb-6">
                            <div className="border-t border-dashed border-gray-200 pt-4">
                                <div className="flex items-center gap-2 mb-3">
                                    <TimerOff className="w-4 h-4 text-amber-600" />
                                    <h4 className="text-xs font-bold text-gray-700 uppercase tracking-wide">Descuentos de Horas (afectan a todas las mesas)</h4>
                                </div>

                                <div className="flex flex-col md:flex-row gap-2 mb-3">
                                    <Input
                                        placeholder="Motivo (ej. Inventario mensual, evento social...)"
                                        value={newDiscountMotivo}
                                        onChange={(e) => setNewDiscountMotivo(e.target.value)}
                                        className="h-9 text-xs flex-1"
                                    />
                                    <Input
                                        type="number"
                                        min={0}
                                        step={0.25}
                                        placeholder="Horas"
                                        value={newDiscountHoras}
                                        onChange={(e) => setNewDiscountHoras(e.target.value)}
                                        className="h-9 text-xs w-full md:w-28"
                                    />
                                    <Button
                                        onClick={addHourDiscount}
                                        size="sm"
                                        className="h-9 bg-amber-600 hover:bg-amber-700 text-white gap-1.5 text-xs shrink-0"
                                    >
                                        <Plus className="w-3.5 h-3.5" />
                                        Agregar Descuento
                                    </Button>
                                </div>

                                {hourDiscounts.length > 0 ? (
                                    <div className="space-y-1.5">
                                        {hourDiscounts.map(d => (
                                            <div key={d.id} className="flex items-center justify-between bg-amber-50 border border-amber-200 rounded-md px-3 py-1.5">
                                                <span className="text-xs text-amber-800">
                                                    <span className="font-semibold">{d.motivo}</span> — {d.horas.toFixed(2)} h
                                                </span>
                                                <button
                                                    type="button"
                                                    onClick={() => removeHourDiscount(d.id)}
                                                    className="text-amber-500 hover:text-amber-700"
                                                    title="Quitar descuento"
                                                >
                                                    <X className="w-3.5 h-3.5" />
                                                </button>
                                            </div>
                                        ))}
                                        <p className="text-[10px] text-amber-600 font-bold pt-1">
                                            Descuento total aplicado a cada mesa: -{totalDiscountHours.toFixed(2)} h (ya reflejado en la Capacidad Total Disponible)
                                        </p>
                                    </div>
                                ) : (
                                    <p className="text-[10px] text-gray-400">Sin descuentos registrados.</p>
                                )}
                            </div>
                        </div>
                    </div>
                )}

                {planningResult && (
                    <div className="bg-white border border-gray-200 rounded-xl shadow-md overflow-hidden">
                        <div className="flex items-center justify-between px-6 py-4 bg-gradient-to-r from-purple-900 to-indigo-900">
                            <div className="flex items-center gap-2">
                                <ClipboardCheck className="w-5 h-5 text-purple-200" />
                                <h3 className="text-sm font-bold text-white uppercase tracking-wide">Detalle de Planificación Ejecutada</h3>
                            </div>
                            <div className="flex items-center gap-4">
                                <p className="text-[11px] text-purple-200 font-medium">
                                    Fecha objetivo: <span className="font-bold text-white">{planningResult.targetDate.toLocaleDateString('es-EC', { weekday: 'long', day: '2-digit', month: '2-digit', year: 'numeric' })}</span>
                                </p>
                                <Button
                                    onClick={exportPlanningDetailToLSMW}
                                    size="sm"
                                    className="h-8 bg-white/10 hover:bg-white/20 text-white gap-1.5 text-xs"
                                >
                                    <Download className="w-3.5 h-3.5" />
                                    Descargar .txt LSMW
                                </Button>
                                <Button
                                    onClick={handleExportPlanningExcel}
                                    size="sm"
                                    className="h-8 bg-emerald-600 hover:bg-emerald-700 text-white gap-1.5 text-xs"
                                >
                                    <FileSpreadsheet className="w-3.5 h-3.5" />
                                    Exportar a Excel
                                </Button>
                            </div>
                        </div>

                        <div className="p-6 space-y-4">
                            <div className="grid grid-cols-1 md:grid-cols-3 xl:grid-cols-6 gap-4">
                                <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                                    <p className="text-[10px] font-bold text-blue-500 uppercase">Horas Requeridas (Compromisos Inmediatos)</p>
                                    <p className="text-xl font-black text-blue-800">{(liveCapacityInfo?.liveTotalHoursRequired ?? planningResult.totalHoursRequired).toFixed(2)} h</p>
                                    <p className="text-[10px] text-blue-400">
                                        {planningResult.immediateOrders.length} órdenes (entrega +1/+2 días o Fert en fecha objetivo)
                                        {planningResult.movableOrders.length > 0 && ' · incluye simulación de "Órdenes que se Pueden Mover"'}
                                    </p>
                                </div>
                                <div className="bg-emerald-50 border border-emerald-200 rounded-lg p-4">
                                    <p className="text-[10px] font-bold text-emerald-500 uppercase">Capacidad Disponible</p>
                                    <p className="text-xl font-black text-emerald-800">{planningResult.totalCapacityAvailable.toFixed(2)} h</p>
                                </div>
                                <div className={cn(
                                    "border rounded-lg p-4",
                                    (liveCapacityInfo?.liveDeficit ?? 0) >= 0
                                        ? "bg-emerald-50 border-emerald-200"
                                        : "bg-red-50 border-red-200"
                                )}>
                                    <p className={cn(
                                        "text-[10px] font-bold uppercase",
                                        (liveCapacityInfo?.liveDeficit ?? 0) >= 0 ? "text-emerald-500" : "text-red-500"
                                    )}>
                                        {(liveCapacityInfo?.liveDeficit ?? 0) >= 0 ? 'Capacidad Sobrante' : 'Déficit de Capacidad'}
                                    </p>
                                    <p className={cn(
                                        "text-xl font-black",
                                        (liveCapacityInfo?.liveDeficit ?? 0) >= 0 ? "text-emerald-800" : "text-red-800"
                                    )}>
                                        {Math.abs(liveCapacityInfo?.liveDeficit ?? 0).toFixed(2)} h
                                    </p>
                                </div>
                                <div className="bg-purple-50 border border-purple-200 rounded-lg p-4">
                                    <p className="text-[10px] font-bold text-purple-500 uppercase">Órdenes MTS Adicionales (Relleno de Capacidad)</p>
                                    <p className="text-xl font-black text-purple-800">{planningResult.extraOrders.length}</p>
                                    <p className="text-[10px] text-purple-400">{planningResult.extraOrders.reduce((s, o) => s + o.horas, 0).toFixed(2)} h agregadas</p>
                                </div>
                                <div className="bg-indigo-50 border border-indigo-200 rounded-lg p-4">
                                    <p className="text-[10px] font-bold text-indigo-500 uppercase">Unidades Físicas Planificadas</p>
                                    <p className="text-xl font-black text-indigo-800">
                                        {[...planningResult.immediateOrders, ...planningResult.extraOrders].reduce((s, o) => s + o.cantidadPlanificada, 0).toLocaleString()}
                                    </p>
                                    <p className="text-[10px] text-indigo-400">{planningResult.immediateOrders.length + planningResult.extraOrders.length} órdenes en total</p>
                                    {(planningResult.deferredByCapacity.length > 0 || planningResult.movableOrders.length > 0) && (
                                        <p className="text-[9px] text-indigo-300 mt-1 pt-1 border-t border-indigo-100">
                                            Ya excluye {planningResult.deferredByCapacity.length} diferida(s) y {planningResult.movableOrders.length} movible(s)
                                        </p>
                                    )}
                                </div>
                                <div className="bg-cyan-50 border border-cyan-200 rounded-lg p-4">
                                    <p className="text-[10px] font-bold text-cyan-500 uppercase">Unidades Equivalentes Planificadas</p>
                                    <p className="text-xl font-black text-cyan-800">
                                        {([...planningResult.immediateOrders, ...planningResult.extraOrders].reduce((s, o) => s + o.horas, 0) * 60 / MINUTOS_POR_MUEBLE_EQUIVALENTE)
                                            .toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                    </p>
                                    <p className="text-[10px] text-cyan-400">1 equivalente = {MINUTOS_POR_MUEBLE_EQUIVALENTE} min</p>
                                </div>
                            </div>

                            {capacityShortageSuggestion && (
                                <div className="bg-yellow-50 border border-yellow-300 rounded-lg p-3 flex items-start gap-2">
                                    <Lightbulb className="w-4 h-4 text-yellow-600 mt-0.5 shrink-0" />
                                    <div className="text-xs text-yellow-900">
                                        <p className="font-bold mb-1">
                                            Faltan {capacityShortageSuggestion.deficit.toFixed(2)} h para cubrir las Horas Requeridas (Compromisos Inmediatos). Para alcanzarlas, considere:
                                        </p>
                                        <ul className="space-y-0.5 list-disc list-inside">
                                            <li className={cn(capacityShortageSuggestion.recomendada === 'horario' && 'font-bold')}>
                                                {capacityShortageSuggestion.sugerenciaHorario
                                                    ? <>Subir el horario de trabajo a <span className="font-bold">{capacityShortageSuggestion.sugerenciaHorario.label}</span> (alcanzaría ~{capacityShortageSuggestion.sugerenciaHorario.horasEstimadas.toFixed(2)} h de capacidad).</>
                                                    : <>Subir el horario de trabajo no alcanza por sí solo con las opciones disponibles (máximo {SHIFT_SCHEDULES[SHIFT_SCHEDULES.length - 1].label}).</>
                                                }
                                                {capacityShortageSuggestion.recomendada === 'horario' && ' — Recomendado'}
                                            </li>
                                            <li className={cn(capacityShortageSuggestion.recomendada === 'mesas' && 'font-bold')}>
                                                {capacityShortageSuggestion.mesasNecesarias !== null
                                                    ? <>Aumentar {capacityShortageSuggestion.mesasNecesarias} mesa(s) de trabajo adicional(es) (de {capacityShortageSuggestion.mesasDisponibles} disponible(s) sin asignar), a ~{capacityShortageSuggestion.avgHorasPorMesa.toFixed(2)} h c/u.</>
                                                    : <>No hay suficientes datos de mesas asignadas para estimar cuántas mesas adicionales harían falta.</>
                                                }
                                                {capacityShortageSuggestion.mesasNecesarias !== null && !capacityShortageSuggestion.mesaFactible && ' (no alcanzan las mesas disponibles)'}
                                                {capacityShortageSuggestion.recomendada === 'mesas' && ' — Recomendado'}
                                            </li>
                                        </ul>
                                    </div>
                                </div>
                            )}

                            {planningResult.ptboAlerts.length > 0 && (
                                <div className="bg-amber-50 border border-amber-300 rounded-lg p-3 flex items-start gap-2">
                                    <TriangleAlert className="w-4 h-4 text-amber-600 mt-0.5 shrink-0" />
                                    <p className="text-xs text-amber-800">
                                        <span className="font-bold">{planningResult.ptboAlerts.length} material(es) con "PTBO"</span> en el nombre requieren revisión: {planningResult.ptboAlerts.map(o => o.nombre).join(', ')}
                                    </p>
                                </div>
                            )}

                            {planningResult.largeOrders.length > 0 && (
                                <div className="bg-sky-50 border border-sky-300 rounded-lg p-3">
                                    <div className="flex items-start gap-2 mb-2">
                                        <Building2 className="w-4 h-4 text-sky-600 mt-0.5 shrink-0" />
                                        <p className="text-xs text-sky-800">
                                            <span className="font-bold">{planningResult.largeOrders.length} línea(s) de pedido con más de {MTS_SEGREGATION_LIMIT} unidades</span> — usualmente cadenas comerciales grandes; se recomienda distribuir su fabricación en varios días (3 a 5) en vez de un solo día.
                                        </p>
                                    </div>
                                    <div className="border border-sky-200 rounded-md overflow-auto max-h-[30vh] bg-white">
                                        <Table>
                                            <TableHeader>
                                                <TableRow className="bg-sky-100 hover:bg-sky-100 border-b border-sky-200 sticky top-0">
                                                    <TableHead className="text-[10px] font-extrabold text-sky-700 uppercase border-r border-sky-200">Pedido</TableHead>
                                                    <TableHead className="text-[10px] font-extrabold text-sky-700 uppercase border-r border-sky-200">Cliente (Destinatario)</TableHead>
                                                    <TableHead className="text-[10px] font-extrabold text-sky-700 uppercase border-r border-sky-200">Material / Nombre</TableHead>
                                                    <TableHead className="text-[10px] font-extrabold text-sky-700 uppercase text-center border-r border-sky-200">Fecha Entrega</TableHead>
                                                    <TableHead className="text-[10px] font-extrabold text-sky-700 uppercase text-center">Cantidad</TableHead>
                                                </TableRow>
                                            </TableHeader>
                                            <TableBody>
                                                {planningResult.largeOrders.map((o, idx) => (
                                                    <TableRow key={`${o.source}-${o.id}-${o.material}-${idx}`} className={cn("border-b border-sky-100", idx % 2 === 1 && "bg-sky-50/50")}>
                                                        <TableCell className="text-[11px] border-r border-sky-100 font-mono">{o.pedido}</TableCell>
                                                        <TableCell className="text-[11px] border-r border-sky-100 font-semibold text-sky-900">{o.cliente}</TableCell>
                                                        <TableCell className="text-[11px] border-r border-sky-100">
                                                            <span className="font-semibold text-gray-800">{o.material}</span>
                                                            <span className="block text-gray-500">{o.nombre}</span>
                                                        </TableCell>
                                                        <TableCell className="text-[11px] text-center border-r border-sky-100 font-mono">{o.fechaEntrega}</TableCell>
                                                        <TableCell className="text-[11px] text-center font-mono font-bold text-sky-700">{o.cantidad}</TableCell>
                                                    </TableRow>
                                                ))}
                                            </TableBody>
                                        </Table>
                                    </div>
                                </div>
                            )}

                            {planningResult.missingDeliveryDate.length > 0 && (
                                <div className="bg-red-50 border border-red-300 rounded-lg p-3 flex items-start gap-2">
                                    <TriangleAlert className="w-4 h-4 text-red-600 mt-0.5 shrink-0" />
                                    <div className="text-xs text-red-800">
                                        <p className="font-bold mb-1">
                                            {planningResult.missingDeliveryDate.length} orden(es) con PEDIDO NO planificada(s): el pedido no existe en Pendientes Totales, por lo que no se pudo determinar su Fecha de Entrega.
                                        </p>
                                        <p className="text-red-700">
                                            {planningResult.missingDeliveryDate.map(o => `${o.source} ${o.id} — Pedido ${o.pedido} — ${o.material} (${o.nombre})`).join(' · ')}
                                        </p>
                                    </div>
                                </div>
                            )}

                            <div className="border border-gray-300 rounded-lg overflow-auto max-h-[50vh]">
                                <Table>
                                    <TableHeader>
                                        <TableRow className="bg-gray-100 hover:bg-gray-100 border-b-2 border-gray-300 sticky top-0">
                                            <TableHead className="text-[10px] font-extrabold text-gray-600 uppercase text-center border-r border-gray-200">Origen</TableHead>
                                            <TableHead className="text-[10px] font-extrabold text-gray-600 uppercase text-center border-r border-gray-200">Prioridad</TableHead>
                                            <TableHead className="text-[10px] font-extrabold text-gray-600 uppercase border-r border-gray-200">N° Orden</TableHead>
                                            <TableHead className="text-[10px] font-extrabold text-gray-600 uppercase border-r border-gray-200">Pedido</TableHead>
                                            <TableHead className="text-[10px] font-extrabold text-gray-600 uppercase border-r border-gray-200">Material / Nombre</TableHead>
                                            <TableHead className="text-[10px] font-extrabold text-gray-600 uppercase text-center border-r border-gray-200">Centro</TableHead>
                                            <TableHead className="text-[10px] font-extrabold text-gray-600 uppercase text-center border-r border-gray-200">Tipo</TableHead>
                                            <TableHead className="text-[10px] font-extrabold text-gray-600 uppercase text-center border-r border-gray-200">Tamaño</TableHead>
                                            <TableHead className="text-[10px] font-extrabold text-gray-600 uppercase text-center border-r border-gray-200">Cant. Planificada</TableHead>
                                            <TableHead className="text-[10px] font-extrabold text-gray-600 uppercase text-center border-r border-gray-200">Fecha Entrega</TableHead>
                                            <TableHead className="text-[10px] font-extrabold text-gray-600 uppercase text-center border-r border-gray-200">Stock Disp. Quito (1000)</TableHead>
                                            <TableHead className="text-[10px] font-extrabold text-gray-600 uppercase text-center border-r border-gray-200">Stock Disp. Guayaquil (2000)</TableHead>
                                            <TableHead className="text-[10px] font-extrabold text-gray-600 uppercase text-center">Horas</TableHead>
                                        </TableRow>
                                    </TableHeader>
                                    <TableBody>
                                        {[...planningResult.immediateOrders, ...planningResult.extraOrders].map((o, idx) => {
                                            const stock1000 = inventoryMap.get(`${o.material}|1000`) ?? null;
                                            const stock2000 = inventoryMap.get(`${o.material}|2000`) ?? null;
                                            const isImmediate = idx < planningResult.immediateOrders.length;
                                            return (
                                                <TableRow key={`${o.source}-${o.id}-${o.material}-${idx}`} className={cn("border-b border-gray-200", idx % 2 === 1 && "bg-gray-50/70")}>
                                                    <TableCell className="text-[11px] text-center border-r border-gray-200 font-semibold text-gray-600">{o.source}</TableCell>
                                                    <TableCell className="text-center border-r border-gray-200">
                                                        <Badge className={cn("text-[9px]", isImmediate ? "bg-indigo-100 text-indigo-700 hover:bg-indigo-100" : "bg-purple-100 text-purple-700 hover:bg-purple-100")}>
                                                            {isImmediate ? 'Inmediato' : 'Relleno'}
                                                        </Badge>
                                                    </TableCell>
                                                    <TableCell className="text-[11px] border-r border-gray-200 font-mono text-gray-700">{o.id || '—'}</TableCell>
                                                    <TableCell className="text-[11px] border-r border-gray-200 font-mono">{o.pedido || '—'}</TableCell>
                                                    <TableCell className="text-[11px] border-r border-gray-200">
                                                        <span className="font-semibold text-gray-800">{o.material}</span>
                                                        <span className="block text-gray-500">
                                                            {o.nombre}
                                                            {o.isPTBO && <Badge className="ml-1 text-[8px] bg-amber-100 text-amber-700 hover:bg-amber-100">PTBO</Badge>}
                                                        </span>
                                                    </TableCell>
                                                    <TableCell className="text-[11px] text-center border-r border-gray-200">{o.centro}</TableCell>
                                                    <TableCell className="text-center border-r border-gray-200">
                                                        <Badge className={cn("text-[9px]", o.tipo === 'MTO' ? "bg-blue-100 text-blue-700 hover:bg-blue-100" : "bg-gray-200 text-gray-700 hover:bg-gray-200")}>
                                                            {o.tipo}
                                                        </Badge>
                                                    </TableCell>
                                                    <TableCell className="text-[11px] text-center border-r border-gray-200 text-gray-600">{o.tamano ?? '—'}</TableCell>
                                                    <TableCell className="text-[11px] text-center border-r border-gray-200 font-semibold">
                                                        {o.cantidadPlanificada}
                                                        {o.cantidadDiferida > 0 && (
                                                            <span className="block text-[9px] text-amber-600">+{o.cantidadDiferida} diferido</span>
                                                        )}
                                                    </TableCell>
                                                    <TableCell className="text-[11px] text-center border-r border-gray-200 font-mono">{o.fechaEntrega}</TableCell>
                                                    <TableCell className={cn(
                                                        "text-[11px] text-center border-r border-gray-200 font-mono font-bold",
                                                        stock1000 !== null && stock1000 > 0 ? "text-green-600 bg-green-50/20" : stock1000 !== null && stock1000 < 0 ? "text-red-600 bg-red-50/20" : "text-gray-400"
                                                    )}>
                                                        {stock1000 !== null ? stock1000.toLocaleString() : '-'}
                                                    </TableCell>
                                                    <TableCell className={cn(
                                                        "text-[11px] text-center border-r border-gray-200 font-mono font-bold",
                                                        stock2000 !== null && stock2000 > 0 ? "text-green-600 bg-green-50/20" : stock2000 !== null && stock2000 < 0 ? "text-red-600 bg-red-50/20" : "text-gray-400"
                                                    )}>
                                                        {stock2000 !== null ? stock2000.toLocaleString() : '-'}
                                                    </TableCell>
                                                    <TableCell className="text-[11px] text-center font-mono font-bold text-blue-700">{o.horas.toFixed(2)}</TableCell>
                                                </TableRow>
                                            );
                                        })}
                                        {planningResult.immediateOrders.length === 0 && planningResult.extraOrders.length === 0 && (
                                            <TableRow>
                                                <TableCell colSpan={13} className="text-center py-6 text-gray-400 text-xs">
                                                    No se encontraron órdenes para la fecha objetivo calculada.
                                                </TableCell>
                                            </TableRow>
                                        )}
                                    </TableBody>
                                </Table>
                            </div>
                        </div>
                    </div>
                )}

                {planningResult && planningResult.deferredByCapacity.length > 0 && (
                    <div className="bg-white border border-gray-200 rounded-xl shadow-md overflow-hidden">
                        <div className="flex items-center justify-between gap-2 px-6 py-4 bg-gradient-to-r from-red-900 to-orange-800">
                            <div className="flex items-center gap-2">
                                <CalendarClock className="w-5 h-5 text-orange-200" />
                                <h3 className="text-sm font-bold text-white uppercase tracking-wide">Órdenes Diferidas por Capacidad (Fecha de Entrega más Lejana)</h3>
                            </div>
                            <Button
                                onClick={() => copyOrdersAsText(planningResult.deferredByCapacity, 'Órdenes Diferidas por Capacidad')}
                                size="sm"
                                className="h-8 bg-white/10 hover:bg-white/20 text-white gap-1.5 text-xs shrink-0"
                            >
                                <Copy className="w-3.5 h-3.5" />
                                Copiar
                            </Button>
                        </div>
                        <div className="p-6 space-y-3">
                            <p className="text-xs text-gray-600">
                                Estas órdenes están dentro de la ventana de prioridad, pero no cupieron en la capacidad disponible.
                                Se difirieron empezando por las fechas de entrega más lejanas, para priorizar las más urgentes.
                            </p>
                            <div className="border border-gray-300 rounded-lg overflow-auto max-h-[40vh]">
                                <Table>
                                    <TableHeader>
                                        <TableRow className="bg-red-50 hover:bg-red-50 border-b-2 border-red-200 sticky top-0">
                                            <TableHead className="text-[10px] font-extrabold text-gray-600 uppercase text-center border-r border-gray-200">Origen</TableHead>
                                            <TableHead className="text-[10px] font-extrabold text-gray-600 uppercase border-r border-gray-200">N° Orden</TableHead>
                                            <TableHead className="text-[10px] font-extrabold text-gray-600 uppercase border-r border-gray-200">Pedido</TableHead>
                                            <TableHead className="text-[10px] font-extrabold text-gray-600 uppercase border-r border-gray-200">Material / Nombre</TableHead>
                                            <TableHead className="text-[10px] font-extrabold text-gray-600 uppercase text-center border-r border-gray-200">Centro</TableHead>
                                            <TableHead className="text-[10px] font-extrabold text-gray-600 uppercase text-center border-r border-gray-200">Fecha Entrega</TableHead>
                                            <TableHead className="text-[10px] font-extrabold text-gray-600 uppercase text-center">Horas</TableHead>
                                        </TableRow>
                                    </TableHeader>
                                    <TableBody>
                                        {planningResult.deferredByCapacity.map((o, idx) => (
                                            <TableRow key={`${o.source}-${o.id}-${o.material}-${idx}`} className={cn("border-b border-gray-200", idx % 2 === 1 && "bg-gray-50/70")}>
                                                <TableCell className="text-[11px] text-center border-r border-gray-200 font-semibold text-gray-600">{o.source}</TableCell>
                                                <TableCell className="text-[11px] border-r border-gray-200 font-mono text-gray-700">{o.id || '—'}</TableCell>
                                                <TableCell className="text-[11px] border-r border-gray-200 font-mono">{o.pedido || '—'}</TableCell>
                                                <TableCell className="text-[11px] border-r border-gray-200">
                                                    <span className="font-semibold text-gray-800">{o.material}</span>
                                                    <span className="block text-gray-500">{o.nombre}</span>
                                                </TableCell>
                                                <TableCell className="text-[11px] text-center border-r border-gray-200">{o.centro}</TableCell>
                                                <TableCell className="text-[11px] text-center border-r border-gray-200 font-mono text-red-700 font-bold">{o.fechaEntrega}</TableCell>
                                                <TableCell className="text-[11px] text-center font-mono font-bold text-blue-700">{o.horas.toFixed(2)}</TableCell>
                                            </TableRow>
                                        ))}
                                    </TableBody>
                                </Table>
                            </div>
                        </div>
                    </div>
                )}

                {planningResult && planningResult.deferredByCapacity.length > 0 && (
                    <div className="bg-white border border-indigo-300 rounded-xl shadow-md overflow-hidden">
                        <div className="flex items-center justify-between gap-2 px-6 py-4 bg-gradient-to-r from-indigo-700 to-blue-600">
                            <div className="flex items-center gap-2">
                                <Lightbulb className="w-5 h-5 text-indigo-100" />
                                <h3 className="text-sm font-bold text-white uppercase tracking-wide">Recomendación: Priorizar Fabricación para Cumplir Entregas</h3>
                            </div>
                            <Button
                                onClick={copyRecommendationsAsText}
                                size="sm"
                                className="h-8 bg-white/10 hover:bg-white/20 text-white gap-1.5 text-xs shrink-0"
                            >
                                <Copy className="w-3.5 h-3.5" />
                                Copiar
                            </Button>
                        </div>
                        <div className="p-6 space-y-3">
                            <p className="text-xs text-gray-600">
                                Estas órdenes se difirieron por falta de capacidad, pero su fecha de entrega ya está dentro
                                de la ventana de prioridad — si no se fabrican hoy, se corre el riesgo de no cumplir la entrega a tiempo.
                            </p>
                            <div className="border border-indigo-200 rounded-lg overflow-auto max-h-[40vh]">
                                <Table>
                                    <TableHeader>
                                        <TableRow className="bg-indigo-50 hover:bg-indigo-50 border-b-2 border-indigo-200 sticky top-0">
                                            <TableHead className="text-[10px] font-extrabold text-gray-600 uppercase border-r border-indigo-100">Pedido</TableHead>
                                            <TableHead className="text-[10px] font-extrabold text-gray-600 uppercase border-r border-indigo-100">Material / Nombre</TableHead>
                                            <TableHead className="text-[10px] font-extrabold text-gray-600 uppercase text-center border-r border-indigo-100">Centro</TableHead>
                                            <TableHead className="text-[10px] font-extrabold text-gray-600 uppercase">Recomendación</TableHead>
                                        </TableRow>
                                    </TableHeader>
                                    <TableBody>
                                        {planningResult.deferredByCapacity.map((o, idx) => (
                                            <TableRow key={`${o.source}-${o.id}-${o.material}-${idx}`} className={cn("border-b border-indigo-100", idx % 2 === 1 && "bg-indigo-50/40")}>
                                                <TableCell className="text-[11px] border-r border-indigo-100 font-mono">{o.pedido || '—'}</TableCell>
                                                <TableCell className="text-[11px] border-r border-indigo-100">
                                                    <span className="font-semibold text-gray-800">{o.material}</span>
                                                    <span className="block text-gray-500">{o.nombre}</span>
                                                </TableCell>
                                                <TableCell className="text-[11px] text-center border-r border-indigo-100">{o.centro}</TableCell>
                                                <TableCell className="text-[11px] text-indigo-800">
                                                    Debe fabricarse el <span className="font-bold">{planningResult.targetDate.toLocaleDateString('es-EC', { day: '2-digit', month: '2-digit', year: 'numeric' })}</span> para
                                                    cumplir la entrega del <span className="font-bold">{o.fechaEntrega}</span> sin contratiempos.
                                                </TableCell>
                                            </TableRow>
                                        ))}
                                    </TableBody>
                                </Table>
                            </div>
                        </div>
                    </div>
                )}

                {planningResult && planningResult.blockedByInsumo.length > 0 && (
                    <div className="bg-white border border-amber-300 rounded-xl shadow-md overflow-hidden">
                        <div className="flex items-center justify-between gap-2 px-6 py-4 bg-gradient-to-r from-amber-600 to-yellow-600">
                            <div className="flex items-center gap-2">
                                <TimerOff className="w-5 h-5 text-amber-100" />
                                <h3 className="text-sm font-bold text-white uppercase tracking-wide">Bloqueadas por Insumo</h3>
                            </div>
                            <Button
                                onClick={handleRunPlanning}
                                size="sm"
                                className="h-8 bg-white/10 hover:bg-white/20 text-white gap-1.5 text-xs shrink-0"
                            >
                                <RefreshCw className="w-3.5 h-3.5" />
                                Forzar Inclusión y Recalcular
                            </Button>
                        </div>
                        <div className="p-6 space-y-3">
                            <p className="text-xs text-gray-600">
                                Estas órdenes se excluyeron de la planificación porque su material padre necesita, en algún nivel de
                                su explosión de materiales, un insumo marcado como "en espera" (ver botón "MATERIALES EN ESPERA", arriba).
                                Si necesita fabricar alguna de todos modos, marque su checkbox y presione "Forzar Inclusión y Recalcular".
                            </p>
                            <div className="border border-gray-300 rounded-lg overflow-auto max-h-[40vh]">
                                <Table>
                                    <TableHeader>
                                        <TableRow className="bg-amber-50 hover:bg-amber-50 border-b-2 border-amber-200 sticky top-0">
                                            <TableHead className="text-[10px] font-extrabold text-gray-600 uppercase text-center border-r border-gray-200 w-16">Forzar</TableHead>
                                            <TableHead className="text-[10px] font-extrabold text-gray-600 uppercase text-center border-r border-gray-200">Origen</TableHead>
                                            <TableHead className="text-[10px] font-extrabold text-gray-600 uppercase border-r border-gray-200">N° Orden</TableHead>
                                            <TableHead className="text-[10px] font-extrabold text-gray-600 uppercase border-r border-gray-200">Pedido</TableHead>
                                            <TableHead className="text-[10px] font-extrabold text-gray-600 uppercase border-r border-gray-200">Material / Nombre</TableHead>
                                            <TableHead className="text-[10px] font-extrabold text-gray-600 uppercase border-r border-gray-200">Insumo Faltante</TableHead>
                                            <TableHead className="text-[10px] font-extrabold text-gray-600 uppercase text-center">Disponible Desde</TableHead>
                                        </TableRow>
                                    </TableHeader>
                                    <TableBody>
                                        {planningResult.blockedByInsumo.map((b, idx) => {
                                            const o = b.order;
                                            const key = `${o.source}-${o.id}-${o.material}`;
                                            const isForced = forcedIncludedBlockedIds.has(key);
                                            return (
                                                <TableRow key={`${key}-${idx}`} className={cn("border-b border-gray-200", idx % 2 === 1 && "bg-gray-50/70")}>
                                                    <TableCell className="text-center border-r border-gray-200">
                                                        <Checkbox
                                                            checked={isForced}
                                                            onCheckedChange={() => toggleForcedIncludedBlocked(key)}
                                                            className="data-[state=checked]:bg-amber-600 border-gray-300"
                                                        />
                                                    </TableCell>
                                                    <TableCell className="text-[11px] text-center border-r border-gray-200 font-semibold text-gray-600">{o.source}</TableCell>
                                                    <TableCell className="text-[11px] border-r border-gray-200 font-mono text-gray-700">{o.id || '—'}</TableCell>
                                                    <TableCell className="text-[11px] border-r border-gray-200 font-mono">{o.pedido || '—'}</TableCell>
                                                    <TableCell className="text-[11px] border-r border-gray-200">
                                                        <span className="font-semibold text-gray-800">{o.material}</span>
                                                        <span className="block text-gray-500">{o.nombre}</span>
                                                    </TableCell>
                                                    <TableCell className="text-[11px] border-r border-gray-200">
                                                        {b.insumos.map(ins => (
                                                            <div key={ins.insumoCodigo}>
                                                                <span className="font-mono font-semibold">{ins.insumoCodigo}</span> — {ins.insumoDescripcion}
                                                            </div>
                                                        ))}
                                                    </TableCell>
                                                    <TableCell className="text-[11px] text-center font-semibold text-amber-700">
                                                        {b.insumos.map(ins => (
                                                            <div key={ins.insumoCodigo}>{formatDDMMYYYY(ins.fechaDisponible)}</div>
                                                        ))}
                                                    </TableCell>
                                                </TableRow>
                                            );
                                        })}
                                    </TableBody>
                                </Table>
                            </div>
                        </div>
                    </div>
                )}

                {planningResult && planningResult.movableOrders.length > 0 && (
                    <div className="bg-white border border-gray-200 rounded-xl shadow-md overflow-hidden">
                        <div className="flex items-center justify-between gap-2 px-6 py-4 bg-gradient-to-r from-slate-700 to-slate-500">
                            <div className="flex items-center gap-2">
                                <CalendarClock className="w-5 h-5 text-slate-200" />
                                <h3 className="text-sm font-bold text-white uppercase tracking-wide">Órdenes que se Pueden Mover</h3>
                            </div>
                            <Button
                                onClick={() => copyOrdersAsText(planningResult.movableOrders, 'Órdenes que se Pueden Mover')}
                                size="sm"
                                className="h-8 bg-white/10 hover:bg-white/20 text-white gap-1.5 text-xs shrink-0"
                            >
                                <Copy className="w-3.5 h-3.5" />
                                Copiar
                            </Button>
                        </div>
                        <div className="p-6 space-y-3">
                            <p className="text-xs text-gray-600">
                                Solo incluye órdenes MTO cuya fecha de planificación en el ERP es exactamente la fecha
                                objetivo ({toDateKey(planningResult.targetDate)}) y cuya fecha de entrega cae fuera de la ventana de prioridad
                                (Quito {toDateKey(addBusinessDays(planningResult.targetDate, 1))} · Guayaquil {toDateKey(addBusinessDays(planningResult.targetDate, 2))}):
                                se pueden mover hacia adelante sin riesgo de incumplir una entrega. Las órdenes programadas
                                por el ERP para otro día (anterior o posterior) nunca aparecen aquí, porque moverlas no libera
                                capacidad de la fecha que se está planificando.
                                {planningResult.planningStepResult >= 2
                                    ? ' Ya están incluidas en el cálculo de capacidad, distribución de mesas y explosión de materiales de este Paso 2 (reflejan lo que hay hoy en SAP); si quiere seguir optimizando, muévalas también en SAP y presione "Actualizar Datos" de nuevo.'
                                    : ' No se incluyeron en el cálculo de capacidad de hoy; revíselas para decidir si conviene adelantar alguna.'}
                                {' '}Use el checkbox de cada fila para simular en vivo: por defecto todas cuentan como producidas
                                hoy (ocupando la capacidad sobrante); al desmarcar una, sus horas se restan al instante de
                                "Horas Requeridas" y "Déficit de Capacidad" en "Detalle de Planificación Ejecutada", arriba.
                            </p>
                            <div className="border border-gray-300 rounded-lg overflow-auto max-h-[40vh]">
                                <Table>
                                    <TableHeader>
                                        <TableRow className="bg-slate-50 hover:bg-slate-50 border-b-2 border-slate-200 sticky top-0">
                                            <TableHead className="text-[10px] font-extrabold text-gray-600 uppercase text-center border-r border-gray-200 w-10">Incl.</TableHead>
                                            <TableHead className="text-[10px] font-extrabold text-gray-600 uppercase text-center border-r border-gray-200">Origen</TableHead>
                                            <TableHead className="text-[10px] font-extrabold text-gray-600 uppercase border-r border-gray-200">N° Orden</TableHead>
                                            <TableHead className="text-[10px] font-extrabold text-gray-600 uppercase border-r border-gray-200">Pedido</TableHead>
                                            <TableHead className="text-[10px] font-extrabold text-gray-600 uppercase border-r border-gray-200">Material / Nombre</TableHead>
                                            <TableHead className="text-[10px] font-extrabold text-gray-600 uppercase text-center border-r border-gray-200">Centro</TableHead>
                                            <TableHead className="text-[10px] font-extrabold text-gray-600 uppercase text-center border-r border-gray-200">Fecha Entrega</TableHead>
                                            <TableHead className="text-[10px] font-extrabold text-gray-600 uppercase text-center">Horas</TableHead>
                                        </TableRow>
                                    </TableHeader>
                                    <TableBody>
                                        {planningResult.movableOrders.map((o, idx) => {
                                            const key = `${o.source}-${o.id}-${o.material}`;
                                            const isChecked = !uncheckedMovableIds.has(key);
                                            return (
                                                <TableRow key={`${key}-${idx}`} className={cn("border-b border-gray-200", idx % 2 === 1 && "bg-gray-50/70", !isChecked && "opacity-50")}>
                                                    <TableCell className="text-center border-r border-gray-200">
                                                        <Checkbox
                                                            checked={isChecked}
                                                            onCheckedChange={() => toggleMovableOrderChecked(key)}
                                                            className="data-[state=checked]:bg-indigo-600 border-gray-300"
                                                        />
                                                    </TableCell>
                                                    <TableCell className="text-[11px] text-center border-r border-gray-200 font-semibold text-gray-600">{o.source}</TableCell>
                                                    <TableCell className="text-[11px] border-r border-gray-200 font-mono text-gray-700">{o.id || '—'}</TableCell>
                                                    <TableCell className="text-[11px] border-r border-gray-200 font-mono">{o.pedido || '—'}</TableCell>
                                                    <TableCell className="text-[11px] border-r border-gray-200">
                                                        <span className="font-semibold text-gray-800">{o.material}</span>
                                                        <span className="block text-gray-500">{o.nombre}</span>
                                                    </TableCell>
                                                    <TableCell className="text-[11px] text-center border-r border-gray-200">{o.centro}</TableCell>
                                                    <TableCell className="text-[11px] text-center border-r border-gray-200 font-mono text-slate-700 font-bold">{o.fechaEntrega}</TableCell>
                                                    <TableCell className="text-[11px] text-center font-mono font-bold text-blue-700">{o.horas.toFixed(2)}</TableCell>
                                                </TableRow>
                                            );
                                        })}
                                    </TableBody>
                                </Table>
                            </div>
                        </div>
                    </div>
                )}

                {planningResult && planningResult.capacityRecommendations.length > 0 && (
                    <div className="bg-white border border-amber-300 rounded-xl shadow-md overflow-hidden">
                        <div className="flex items-center gap-2 px-6 py-4 bg-gradient-to-r from-amber-600 to-yellow-600">
                            <Lightbulb className="w-5 h-5 text-amber-100" />
                            <h3 className="text-sm font-bold text-white uppercase tracking-wide">Recomendación: Mesas a Aumentar</h3>
                        </div>
                        <div className="p-6 space-y-3">
                            {planningResult.capacityRecommendations.map(rec => (
                                <div key={rec.linea} className="bg-amber-50 border border-amber-200 rounded-lg p-4">
                                    <p className="text-sm font-bold text-amber-900">{rec.linea}</p>
                                    <p className="text-xs text-amber-700 mt-0.5">
                                        Faltan <span className="font-bold">{rec.horasFaltantes.toFixed(2)} h</span> de capacidad para cubrir {rec.ordenesAfectadas} orden(es) diferida(s).
                                    </p>
                                    {rec.mesasInactivasSugeridas.length > 0 ? (
                                        <p className="text-xs text-amber-800 mt-1">
                                            Mesas disponibles para activar: {rec.mesasInactivasSugeridas.map(id => `MESA DE TRABAJO ${id}`).join(', ')}.
                                        </p>
                                    ) : (
                                        <p className="text-xs text-amber-800 mt-1">
                                            Todas las mesas de esta línea ya están activas — considere aumentar el horario de trabajo, el % de tiempo por mesa, o el personal asignado.
                                        </p>
                                    )}
                                </div>
                            ))}
                        </div>
                    </div>
                )}

                {mesaDistribution && mesaDistribution.size > 0 && (
                    <div className="bg-white border border-gray-200 rounded-xl shadow-md overflow-hidden">
                        <div className="flex items-center justify-between px-6 py-4 bg-gradient-to-r from-slate-900 to-purple-900">
                            <div className="flex items-center gap-2">
                                <LayoutGrid className="w-5 h-5 text-purple-200" />
                                <h3 className="text-sm font-bold text-white uppercase tracking-wide">Diagrama de Gantt de Capacidad — Distribución de Mesas</h3>
                            </div>
                            <div className="flex items-center gap-2">
                                <Button
                                    onClick={handleModularDistribution}
                                    size="sm"
                                    className="h-8 bg-fuchsia-600 hover:bg-fuchsia-700 text-white gap-1.5 text-xs"
                                >
                                    <RefreshCw className="w-3.5 h-3.5" />
                                    Modular Distribución de Mesas
                                </Button>
                                <Button
                                    onClick={handleExportMesaDistributionExcel}
                                    size="sm"
                                    className="h-8 bg-emerald-600 hover:bg-emerald-700 text-white gap-1.5 text-xs"
                                >
                                    <FileSpreadsheet className="w-3.5 h-3.5" />
                                    Imprimir Planificación Confirmada
                                </Button>
                                <Button
                                    onClick={handleMaterialExplosion}
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
                            <div className="flex flex-wrap items-center gap-4 text-[11px] text-gray-600">
                                <span className="inline-flex items-center gap-1.5"><span className="w-3 h-3 rounded-sm bg-red-200 border border-red-300 inline-block" /> Grande</span>
                                <span className="inline-flex items-center gap-1.5"><span className="w-3 h-3 rounded-sm bg-emerald-200 border border-emerald-300 inline-block" /> Mediano</span>
                                <span className="inline-flex items-center gap-1.5"><span className="w-3 h-3 rounded-sm bg-blue-200 border border-blue-300 inline-block" /> Pequeño</span>
                                <span className="inline-flex items-center gap-1.5 text-gray-600">
                                    <span className="w-3 border-t-[3px] border-dashed border-slate-600 inline-block" /> Límite de capacidad de la mesa
                                </span>
                                <span className="inline-flex items-center gap-1.5 text-gray-600">
                                    <span className="w-3 border-t-4 border-slate-900 inline-block" /> Fin de turno ({selectedShiftConfig.displayEndTime})
                                </span>
                            </div>

                            {(() => {
                                const shiftDurationHours = (parseHHMM(selectedShiftConfig.displayEndTime) - parseHHMM(selectedShiftConfig.startTime)) / 60;
                                const endShiftLeftPct = shiftDurationHours > 0 && shiftDurationHours <= GANTT_HOURS_SCALE
                                    ? (shiftDurationHours / GANTT_HOURS_SCALE) * 100
                                    : null;

                                return (
                                    <div className="relative">
                                        {endShiftLeftPct !== null && (
                                            <div
                                                className="pointer-events-none absolute top-0 bottom-0 z-30 border-r-4 border-slate-900"
                                                style={{ left: `calc(11.75rem + (100% - 16rem) * ${endShiftLeftPct / 100})` }}
                                                title={`Fin de turno: ${selectedShiftConfig.displayEndTime}`}
                                            />
                                        )}

                                        <div className="space-y-6">
                                            {(['Línea 1 – Línea de Camas', 'Línea 2 – Línea de Muebles'] as const).map(linea => {
                                                const mesasLinea = Array.from(mesaDistribution.values()).filter(m => m.linea === linea);
                                                if (mesasLinea.length === 0) return null;

                                                return (
                                                    <div key={linea} className="space-y-3">
                                                        <h4 className="text-xs font-extrabold text-gray-700 uppercase tracking-wide border-b border-dashed border-gray-300 pb-1">{linea}</h4>
                                                        {mesasLinea.map(mesa => {
                                                            const utilizacionPct = mesa.capacityHours > 0 ? (mesa.usedHours / mesa.capacityHours) * 100 : 0;
                                                            return (
                                                                <div key={mesa.tableId} className="flex items-stretch gap-3">
                                                                    <div className="w-44 shrink-0 flex flex-col justify-center">
                                                                        <p className="text-xs font-bold text-gray-800">{WORK_TABLES.find(t => t.id === mesa.tableId)?.name ?? `MESA ${mesa.tableId}`}</p>
                                                                        <p className="text-sm font-extrabold text-gray-900 font-mono">{mesa.usedHours.toFixed(2)} / {mesa.capacityHours.toFixed(2)} h</p>
                                                                    </div>
                                                                    <div className="flex-1">
                                                                        <div className="relative h-10 bg-gray-50 border border-gray-200 rounded-md overflow-hidden">
                                                                            {mesa.capacityHours > 0 && mesa.capacityHours <= GANTT_HOURS_SCALE && (
                                                                                <div
                                                                                    className="absolute top-0 bottom-0 border-l-[3px] border-dashed border-slate-600 z-20"
                                                                                    style={{ left: `${(mesa.capacityHours / GANTT_HOURS_SCALE) * 100}%` }}
                                                                                    title={`Límite de capacidad: ${mesa.capacityHours.toFixed(2)} h`}
                                                                                />
                                                                            )}
                                                                            {mesa.items.map((item, idx) => {
                                                                                const left = (item.startHour / GANTT_HOURS_SCALE) * 100;
                                                                                const width = ((item.endHour - item.startHour) / GANTT_HOURS_SCALE) * 100;
                                                                                const colorClass = item.order.tamano === 'Grande'
                                                                                    ? 'bg-red-200 border-red-300 text-red-800'
                                                                                    : item.order.tamano === 'Mediano'
                                                                                        ? 'bg-emerald-200 border-emerald-300 text-emerald-800'
                                                                                        : 'bg-blue-200 border-blue-300 text-blue-800';
                                                                                return (
                                                                                    <div
                                                                                        key={`${item.order.source}-${item.order.id}-${item.order.material}-${idx}`}
                                                                                        className={cn(
                                                                                            "absolute top-0.5 bottom-0.5 border rounded-sm px-1 flex items-center overflow-hidden",
                                                                                            colorClass,
                                                                                            item.overflow && "ring-2 ring-red-600"
                                                                                        )}
                                                                                        style={{ left: `${left}%`, width: `${Math.max(width, 0.5)}%` }}
                                                                                        title={`${item.order.nombre} (${item.order.material}) — ${item.order.tamano} — ${(item.endHour - item.startHour).toFixed(2)} h${item.overflow ? ' — EXCEDE CAPACIDAD' : ''}`}
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
                                                                            title="Utilización: capacidad calculada vs. utilizada"
                                                                        >
                                                                            {utilizacionPct.toFixed(0)}%
                                                                        </span>
                                                                    </div>
                                                                </div>
                                                            );
                                                        })}
                                                    </div>
                                                );
                                            })}

                                            <div className="flex items-stretch gap-3">
                                                <div className="w-44 shrink-0" />
                                                <div className="flex-1 flex justify-between text-[9px] text-gray-400 font-mono px-0.5">
                                                    {Array.from({ length: GANTT_HOURS_SCALE + 1 }, (_, h) => h).filter(h => h % 2 === 0).map(h => (
                                                        <span key={h}>{formatShiftClockLabel(selectedShiftConfig.startTime, h)}</span>
                                                    ))}
                                                </div>
                                                <div className="w-14 shrink-0" />
                                            </div>
                                        </div>
                                    </div>
                                );
                            })()}

                            {unassignedDistributionOrders.length > 0 && (
                                <div className="bg-amber-50 border border-amber-300 rounded-lg p-3">
                                    <p className="text-xs font-bold text-amber-800 mb-1">{unassignedDistributionOrders.length} material(es) sin mesa asignada:</p>
                                    <p className="text-[11px] text-amber-700">{unassignedDistributionOrders.map(o => `${o.material} (${o.nombre})`).join(', ')}</p>
                                </div>
                            )}
                        </div>
                    </div>
                )}

                {foamExplosionResults.length > 0 && (
                    <div className="bg-white border border-gray-200 rounded-xl shadow-md overflow-hidden">
                        <div className="flex items-center justify-between gap-2 px-6 py-4 bg-gradient-to-r from-orange-700 to-amber-700">
                            <div className="flex items-center gap-2">
                                <Layers className="w-5 h-5 text-orange-100" />
                                <h3 className="text-sm font-bold text-white uppercase tracking-wide">Explosión de Materiales — Semielaborados de Espuma para Muebles</h3>
                            </div>
                            <Button
                                onClick={() => exportComponentNeedsToExcel(foamExplosionResults, 'Espuma', 'Explosion_Materiales_Espuma')}
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
                                        {([
                                            { label: 'LAMINA CILINDRICA', items: foamExplosionLaminaCilindrica },
                                            { label: 'OTRAS ESPUMAS', items: foamExplosionOtrasEspumas },
                                        ] as const).map(section => section.items.length === 0 ? null : (
                                            <React.Fragment key={section.label}>
                                                <TableRow className="bg-orange-100 hover:bg-orange-100 border-b border-orange-200">
                                                    <TableCell colSpan={9} className="text-[10px] font-extrabold text-orange-900 uppercase tracking-wide py-1.5">
                                                        {section.label}
                                                    </TableCell>
                                                </TableRow>
                                                {section.items.map((comp, idx) => (
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
                                            </React.Fragment>
                                        ))}
                                    </TableBody>
                                    <TableFooter className="sticky bottom-0">
                                        <TableRow className="bg-orange-50 hover:bg-orange-50 border-t-2 border-orange-300">
                                            <TableCell colSpan={8} className="text-[11px] font-extrabold text-orange-900 uppercase text-right border-r border-orange-200">Total General (Neto Requerido)</TableCell>
                                            <TableCell className="text-[11px] text-center font-mono font-extrabold text-orange-900">
                                                {foamExplosionResults.reduce((s, c) => s + c.cantidadNetaAConseguir, 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                            </TableCell>
                                        </TableRow>
                                    </TableFooter>
                                </Table>
                            </div>
                        </div>
                    </div>
                )}

                {primerNivelExplosionResults.length > 0 && (
                    <div className="bg-white border border-gray-200 rounded-xl shadow-md overflow-hidden">
                        <div className="flex items-center justify-between gap-2 px-6 py-4 bg-gradient-to-r from-teal-700 to-cyan-700">
                            <div className="flex items-center gap-2">
                                <Layers className="w-5 h-5 text-teal-100" />
                                <h3 className="text-sm font-bold text-white uppercase tracking-wide">Explosión de Materiales - Semielaborados de Primer Nivel de Muebles</h3>
                            </div>
                            <div className="flex items-center gap-2 shrink-0">
                                <Button
                                    onClick={() => exportComponentNeedsToLSMW(primerNivelExplosionResults, 'PrimerNivel', fechaPrimerNivelPara)}
                                    size="sm"
                                    className="h-8 bg-white/10 hover:bg-white/20 text-white gap-1.5 text-xs"
                                >
                                    <Download className="w-3.5 h-3.5" />
                                    Descargar .txt LSMW
                                </Button>
                                <Button
                                    onClick={() => exportComponentNeedsToExcel(primerNivelExplosionResults, 'PrimerNivel', 'Explosion_Materiales_PrimerNivel', fechaPrimerNivelPara)}
                                    size="sm"
                                    className="h-8 bg-white/10 hover:bg-white/20 text-white gap-1.5 text-xs"
                                >
                                    <FileSpreadsheet className="w-3.5 h-3.5" />
                                    Exportar a Excel
                                </Button>
                            </div>
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
                                        {primerNivelExplosionResults.map((comp, idx) => (
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
                                                {primerNivelExplosionResults.reduce((s, c) => s + c.cantidadNetaAConseguir, 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                            </TableCell>
                                        </TableRow>
                                    </TableFooter>
                                </Table>
                            </div>
                        </div>
                    </div>
                )}

                {segundoNivelExplosionResults.length > 0 && (
                    <div className="bg-white border border-gray-200 rounded-xl shadow-md overflow-hidden">
                        <div className="flex items-center justify-between gap-2 px-6 py-4 bg-gradient-to-r from-slate-700 to-zinc-700">
                            <div className="flex items-center gap-2">
                                <Layers className="w-5 h-5 text-slate-100" />
                                <h3 className="text-sm font-bold text-white uppercase tracking-wide">Explosión de Materiales - Semielaborados de Segundo Nivel de Muebles</h3>
                            </div>
                            <div className="flex items-center gap-2 shrink-0">
                                <Button
                                    onClick={() => exportComponentNeedsToLSMW(segundoNivelExplosionResults, 'SegundoNivel', fechaSegundoNivelPara)}
                                    size="sm"
                                    className="h-8 bg-white/10 hover:bg-white/20 text-white gap-1.5 text-xs"
                                >
                                    <Download className="w-3.5 h-3.5" />
                                    Descargar .txt LSMW
                                </Button>
                                <Button
                                    onClick={() => exportComponentNeedsToExcel(segundoNivelExplosionResults, 'SegundoNivel', 'Explosion_Materiales_SegundoNivel', fechaSegundoNivelPara)}
                                    size="sm"
                                    className="h-8 bg-white/10 hover:bg-white/20 text-white gap-1.5 text-xs"
                                >
                                    <FileSpreadsheet className="w-3.5 h-3.5" />
                                    Exportar a Excel
                                </Button>
                            </div>
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
                                        {segundoNivelExplosionResults.map((comp, idx) => (
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
                                                <TableCell className="text-[11px] text-center font-mono font-bold text-slate-700">
                                                    {comp.cantidadNetaAConseguir.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                                </TableCell>
                                            </TableRow>
                                        ))}
                                    </TableBody>
                                    <TableFooter className="sticky bottom-0">
                                        <TableRow className="bg-slate-50 hover:bg-slate-50 border-t-2 border-slate-300">
                                            <TableCell colSpan={8} className="text-[11px] font-extrabold text-slate-900 uppercase text-right border-r border-slate-200">Total General (Neto Requerido)</TableCell>
                                            <TableCell className="text-[11px] text-center font-mono font-extrabold text-slate-900">
                                                {segundoNivelExplosionResults.reduce((s, c) => s + c.cantidadNetaAConseguir, 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                            </TableCell>
                                        </TableRow>
                                    </TableFooter>
                                </Table>
                            </div>
                        </div>
                    </div>
                )}

                {telaExplosionResults.length > 0 && (
                    <div className="bg-white border border-gray-200 rounded-xl shadow-md overflow-hidden">
                        <div className="flex items-center justify-between gap-2 px-6 py-4 bg-gradient-to-r from-rose-700 to-pink-700">
                            <div className="flex items-center gap-2">
                                <Layers className="w-5 h-5 text-rose-100" />
                                <h3 className="text-sm font-bold text-white uppercase tracking-wide">Explosión de Materiales — Telas para Muebles</h3>
                            </div>
                            <Button
                                onClick={handleExportTelasExcel}
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
                                            <TableHead className="text-[10px] font-extrabold text-gray-600 uppercase text-center border-r border-gray-200">Disponible Real</TableHead>
                                            <TableHead className="text-[10px] font-extrabold text-gray-600 uppercase text-center border-r border-gray-200">Cantidad Neta Requerida</TableHead>
                                            <TableHead className="text-[10px] font-extrabold text-gray-600 uppercase text-center">Alerta de Stock</TableHead>
                                        </TableRow>
                                    </TableHeader>
                                    <TableBody>
                                        {telaExplosionResults.map((comp, idx) => (
                                            <TableRow key={comp.componente} className={cn("border-b border-gray-200", idx % 2 === 1 && "bg-gray-50/70", comp.alertaStock && "bg-red-50/40")}>
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
                                                    {comp.disponibleReal !== null ? comp.disponibleReal.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : '—'}
                                                </TableCell>
                                                <TableCell className="text-[11px] text-center font-mono font-bold text-rose-700 border-r border-gray-200">
                                                    {comp.cantidadNetaAConseguir.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                                </TableCell>
                                                <TableCell className="text-center">
                                                    {comp.alertaStock ? (
                                                        <Badge variant="destructive" className="animate-pulse gap-1 text-[9px] px-2 py-0.5 h-auto whitespace-nowrap leading-none">
                                                            <TriangleAlert className="h-3 w-3 shrink-0" />
                                                            <span>CRÍTICO</span>
                                                        </Badge>
                                                    ) : (
                                                        <Badge variant="outline" className="text-emerald-600 border-emerald-200 bg-emerald-50 text-[9px] h-auto px-2 py-0.5 whitespace-nowrap leading-none">
                                                            Suficiente
                                                        </Badge>
                                                    )}
                                                </TableCell>
                                            </TableRow>
                                        ))}
                                    </TableBody>
                                    <TableFooter className="sticky bottom-0">
                                        <TableRow className="bg-rose-50 hover:bg-rose-50 border-t-2 border-rose-300">
                                            <TableCell colSpan={7} className="text-[11px] font-extrabold text-rose-900 uppercase text-right border-r border-rose-200">Total General (Neto Requerido)</TableCell>
                                            <TableCell className="text-[11px] text-center font-mono font-extrabold text-rose-900 border-r border-rose-200">
                                                {telaExplosionResults.reduce((s, c) => s + c.cantidadNetaAConseguir, 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                            </TableCell>
                                            <TableCell />
                                        </TableRow>
                                    </TableFooter>
                                </Table>
                            </div>
                        </div>
                    </div>
                )}

                {cascoExplosionResults.length > 0 && (
                    <div className="bg-white border border-gray-200 rounded-xl shadow-md overflow-hidden">
                        <div className="flex items-center justify-between gap-2 px-6 py-4 bg-gradient-to-r from-violet-700 to-purple-700">
                            <div className="flex items-center gap-2">
                                <Layers className="w-5 h-5 text-violet-100" />
                                <h3 className="text-sm font-bold text-white uppercase tracking-wide">Explosión de Materiales — Cascos para Muebles</h3>
                            </div>
                            <Button
                                onClick={handleExportCascosExcel}
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
                                            <TableHead className="text-[10px] font-extrabold text-gray-600 uppercase text-center border-r border-gray-200">Disponible Real</TableHead>
                                            <TableHead className="text-[10px] font-extrabold text-gray-600 uppercase text-center border-r border-gray-200">Cantidad Neta Requerida</TableHead>
                                            <TableHead className="text-[10px] font-extrabold text-gray-600 uppercase text-center">Estado</TableHead>
                                        </TableRow>
                                    </TableHeader>
                                    <TableBody>
                                        {cascoExplosionResults.map((comp, idx) => (
                                            <TableRow key={comp.componente} className={cn("border-b border-gray-200", idx % 2 === 1 && "bg-gray-50/70", comp.sinStock && "bg-red-50/40")}>
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
                                                    {comp.disponibleReal !== null ? comp.disponibleReal.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : '—'}
                                                </TableCell>
                                                <TableCell className="text-[11px] text-center font-mono font-bold text-violet-700 border-r border-gray-200">
                                                    {comp.cantidadNetaAConseguir.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                                </TableCell>
                                                <TableCell className="text-center">
                                                    {comp.sinStock ? (
                                                        <Badge variant="destructive" className="animate-pulse gap-1 text-[9px] px-2 py-0.5 h-auto whitespace-nowrap leading-none">
                                                            <TriangleAlert className="h-3 w-3 shrink-0" />
                                                            <span>SIN STOCK</span>
                                                        </Badge>
                                                    ) : (
                                                        <Badge variant="outline" className="text-emerald-600 border-emerald-200 bg-emerald-50 text-[9px] h-auto px-2 py-0.5 whitespace-nowrap leading-none">
                                                            Suficiente
                                                        </Badge>
                                                    )}
                                                </TableCell>
                                            </TableRow>
                                        ))}
                                    </TableBody>
                                    <TableFooter className="sticky bottom-0">
                                        <TableRow className="bg-violet-50 hover:bg-violet-50 border-t-2 border-violet-300">
                                            <TableCell colSpan={7} className="text-[11px] font-extrabold text-violet-900 uppercase text-right border-r border-violet-200">Total General (Neto Requerido)</TableCell>
                                            <TableCell className="text-[11px] text-center font-mono font-extrabold text-violet-900 border-r border-violet-200">
                                                {cascoExplosionResults.reduce((s, c) => s + c.cantidadNetaAConseguir, 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                            </TableCell>
                                            <TableCell />
                                        </TableRow>
                                    </TableFooter>
                                </Table>
                            </div>
                        </div>
                    </div>
                )}

                {chosenTables && chosenTables.length > 0 && (
                    <div className="bg-white border border-gray-200 rounded-xl shadow-md overflow-hidden">
                        <div className="flex items-center justify-between px-6 py-4 bg-gradient-to-r from-gray-900 to-indigo-900">
                            <div className="flex items-center gap-2">
                                <Users className="w-5 h-5 text-indigo-300" />
                                <h3 className="text-sm font-bold text-white uppercase tracking-wide">Asignación de Personal por Mesa de Trabajo</h3>
                            </div>
                            {planningTargetDate && (
                                <p className="text-[11px] text-indigo-200 font-medium">
                                    Verificación de mantenimiento para: <span className="font-bold text-white">{planningTargetDate.toLocaleDateString('es-EC', { weekday: 'long', day: '2-digit', month: '2-digit', year: 'numeric' })}</span> · {selectedShiftConfig.label}
                                </p>
                            )}
                        </div>
                        <div className="p-6">
                            <div className="border border-gray-300 rounded-lg overflow-hidden">
                                <Table>
                                    <TableHeader>
                                        <TableRow className="bg-gray-100 hover:bg-gray-100 border-b-2 border-gray-300">
                                            <TableHead className="text-[11px] font-extrabold text-gray-600 uppercase tracking-wider text-center border-r border-gray-200 w-14">#</TableHead>
                                            <TableHead className="text-[11px] font-extrabold text-gray-600 uppercase tracking-wider border-r border-gray-200">Mesa de Trabajo</TableHead>
                                            <TableHead className="text-[11px] font-extrabold text-gray-600 uppercase tracking-wider border-r border-gray-200">
                                                <span className="inline-flex items-center gap-1"><Users className="w-3.5 h-3.5" /> Persona Asignada</span>
                                            </TableHead>
                                            <TableHead className="text-[11px] font-extrabold text-gray-600 uppercase tracking-wider text-center w-40">
                                                <span className="inline-flex items-center gap-1 justify-center"><Percent className="w-3.5 h-3.5" /> % Tiempo en Mesa</span>
                                            </TableHead>
                                            <TableHead className="text-[11px] font-extrabold text-gray-600 uppercase tracking-wider text-center w-44 border-l border-gray-200">
                                                <span className="inline-flex items-center gap-1 justify-center"><Wrench className="w-3.5 h-3.5" /> Mantenimiento Programado</span>
                                            </TableHead>
                                            <TableHead className="text-[11px] font-extrabold text-gray-600 uppercase tracking-wider text-center w-36 border-l border-gray-200">
                                                <span className="inline-flex items-center gap-1 justify-center"><Clock className="w-3.5 h-3.5" /> Tiempo Disponible</span>
                                            </TableHead>
                                        </TableRow>
                                    </TableHeader>
                                    <TableBody>
                                        {chosenTables.map((tableId, index) => {
                                            const assignment = tableAssignments[tableId];
                                            const maintenanceConflicts = mesaMaintenanceMap.get(tableId);
                                            const capacity = mesaCapacityByTable.get(tableId);
                                            const availableHours = capacity?.availableHours ?? null;
                                            const hasMaintenance = capacity?.hasMaintenance ?? false;
                                            const maintenanceDecision = capacity?.maintenanceDecision;
                                            const maintenanceOverlapHours = capacity?.maintenanceOverlapHours ?? 0;
                                            const finalAvailableHours = capacity?.finalAvailableHours ?? null;
                                            const duplicateWithMesas = duplicatePersonTables.get(tableId);
                                            return (
                                                <TableRow
                                                    key={tableId}
                                                    className={cn(
                                                        "border-b border-gray-200 last:border-b-0",
                                                        index % 2 === 1 && "bg-gray-50/70"
                                                    )}
                                                >
                                                    <TableCell className="text-xs text-gray-500 text-center border-r border-gray-200 font-semibold">{index + 1}</TableCell>
                                                    <TableCell className="text-xs font-bold text-gray-800 border-r border-gray-200">
                                                        {WORK_TABLES.find(t => t.id === tableId)?.name ?? `MESA DE TRABAJO ${tableId}`}
                                                    </TableCell>
                                                    <TableCell className="border-r border-gray-200 py-2">
                                                        <Select
                                                            value={assignment?.person ?? ''}
                                                            onValueChange={(value) => updatePersonAssignment(tableId, value)}
                                                        >
                                                            <SelectTrigger className={cn(
                                                                "h-9 text-xs font-medium bg-white",
                                                                duplicateWithMesas && "border-red-500 ring-1 ring-red-500 text-red-700"
                                                            )}>
                                                                <SelectValue placeholder="Seleccione colaborador" />
                                                            </SelectTrigger>
                                                            <SelectContent>
                                                                {personnelOptions.length > 0 ? personnelOptions.map(p => (
                                                                    <SelectItem key={p.nombre} value={p.nombre} className="text-xs">
                                                                        {p.nombre} <span className="text-gray-400">— {p.rol} ({p.calificacion}%)</span>
                                                                    </SelectItem>
                                                                )) : (
                                                                    <div className="px-2 py-3 text-xs text-gray-400 text-center">Sin personal disponible</div>
                                                                )}
                                                            </SelectContent>
                                                        </Select>
                                                        {duplicateWithMesas && (
                                                            <p className="text-[10px] text-red-600 font-semibold mt-1">
                                                                ⚠ Ya asignado(a) en {duplicateWithMesas}
                                                            </p>
                                                        )}
                                                    </TableCell>
                                                    <TableCell className="py-2">
                                                        <div className="relative">
                                                            <Input
                                                                type="number"
                                                                min={0}
                                                                max={100}
                                                                step={1}
                                                                placeholder="100"
                                                                value={assignment?.percentage ?? ''}
                                                                onChange={(e) => updatePercentageAssignment(tableId, e.target.value)}
                                                                className="h-9 text-xs font-bold text-center bg-white pr-6"
                                                            />
                                                            <span className="absolute right-2 top-1/2 -translate-y-1/2 text-[10px] text-gray-400 font-bold">%</span>
                                                        </div>
                                                    </TableCell>
                                                    <TableCell className="text-center border-l border-gray-200 py-2">
                                                        {hasMaintenance ? (
                                                            <div className="flex flex-col items-center gap-1" title={maintenanceConflicts!.map(c => `${c.maquina} (${formatEcuadorTime(c.inicio)} - ${formatEcuadorTime(c.fin)})`).join(' / ')}>
                                                                <Badge className="text-[9px] bg-red-100 text-red-700 hover:bg-red-100 gap-1">
                                                                    <Wrench className="w-3 h-3" /> EN MANTENIMIENTO
                                                                </Badge>
                                                                <span className="text-[9px] font-mono text-red-600 font-semibold">
                                                                    {formatEcuadorTime(maintenanceConflicts![0].inicio)} - {formatEcuadorTime(maintenanceConflicts![0].fin)}
                                                                </span>
                                                                <div className="flex items-center gap-1 mt-0.5">
                                                                    <button
                                                                        type="button"
                                                                        onClick={() => setMaintenanceDecision(tableId, 'accepted')}
                                                                        className={cn(
                                                                            "px-1.5 py-0.5 rounded text-[9px] font-bold uppercase border transition-colors",
                                                                            maintenanceDecision === 'accepted'
                                                                                ? "bg-red-600 border-red-600 text-white"
                                                                                : "bg-white border-gray-300 text-gray-500 hover:border-red-400 hover:text-red-600"
                                                                        )}
                                                                        title="Se mantiene en horario laboral: se descuenta del tiempo disponible"
                                                                    >
                                                                        Aceptar
                                                                    </button>
                                                                    <button
                                                                        type="button"
                                                                        onClick={() => setMaintenanceDecision(tableId, 'denied')}
                                                                        className={cn(
                                                                            "px-1.5 py-0.5 rounded text-[9px] font-bold uppercase border transition-colors",
                                                                            maintenanceDecision === 'denied'
                                                                                ? "bg-emerald-600 border-emerald-600 text-white"
                                                                                : "bg-white border-gray-300 text-gray-500 hover:border-emerald-400 hover:text-emerald-600"
                                                                        )}
                                                                        title="Se reprograma al turno de la noche: no afecta el tiempo disponible"
                                                                    >
                                                                        Denegar
                                                                    </button>
                                                                </div>
                                                                {!maintenanceDecision && (
                                                                    <span className="text-[8px] text-amber-600 font-bold uppercase">Requiere decisión (se descuenta por defecto)</span>
                                                                )}
                                                                {maintenanceDecision === 'denied' && (
                                                                    <span className="text-[8px] text-emerald-600 font-semibold">Reprogramado a turno noche</span>
                                                                )}
                                                            </div>
                                                        ) : (
                                                            <Badge className="text-[9px] bg-emerald-100 text-emerald-700 hover:bg-emerald-100">Disponible</Badge>
                                                        )}
                                                    </TableCell>
                                                    <TableCell className="text-center border-l border-gray-200 py-2">
                                                        <span className={cn(
                                                            "font-mono font-extrabold text-sm",
                                                            finalAvailableHours !== null ? "text-blue-700" : "text-gray-300"
                                                        )}>
                                                            {finalAvailableHours !== null ? `${finalAvailableHours.toFixed(2)} h` : '-'}
                                                        </span>
                                                        {hasMaintenance && maintenanceDecision !== 'denied' && availableHours !== null && (
                                                            <p className="text-[9px] text-red-500 font-semibold mt-0.5">
                                                                -{maintenanceOverlapHours.toFixed(2)} h mantenimiento
                                                            </p>
                                                        )}
                                                        {totalDiscountHours > 0 && availableHours !== null && (
                                                            <p className="text-[9px] text-amber-600 font-semibold mt-0.5">
                                                                -{totalDiscountHours.toFixed(2)} h descuento general
                                                            </p>
                                                        )}
                                                    </TableCell>
                                                </TableRow>
                                            );
                                        })}
                                    </TableBody>
                                </Table>
                            </div>
                        </div>
                    </div>
                )}

                <div className="flex flex-col md:flex-row gap-4 items-center justify-between">
                    <div className="flex flex-col gap-2 flex-1">
                        <div className="relative w-full md:w-96">
                            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                            <Input 
                                placeholder="Buscar en todo el set de datos..." 
                                className="pl-10 h-9"
                                value={searchTerm}
                                onChange={(e) => { setSearchTerm(e.target.value); setCurrentPage(1); }}
                            />
                        </div>
                    </div>
                    <Button 
                        variant="outline" 
                        size="sm" 
                        onClick={fetchAllData} 
                        disabled={isLoading}
                        className="text-[10px] h-8 bg-white"
                    >
                        {isLoading ? <Loader2 className="w-3 h-3 animate-spin mr-2" /> : null}
                        Sincronizar Datos
                    </Button>
                </div>

                {!isLoading && allRawData.length > 0 && (
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                        <div className="bg-indigo-600 text-white rounded-lg p-4 shadow-md flex items-center gap-4">
                            <div className="bg-indigo-500 p-2 rounded-lg">
                                <LayoutDashboard className="w-6 h-6" />
                            </div>
                            <div>
                                <p className="text-[10px] font-bold uppercase opacity-80">Cantidad de Órdenes</p>
                                <p className="text-2xl font-bold">{summaryTotals.numOrders.toLocaleString()}</p>
                            </div>
                        </div>

                        <div className="bg-emerald-600 text-white rounded-lg p-4 shadow-md flex items-center gap-4">
                            <div className="bg-emerald-500 p-2 rounded-lg">
                                <Package className="w-6 h-6" />
                            </div>
                            <div>
                                <p className="text-[10px] font-bold uppercase opacity-80">Sumatoria Unidades (CANTIDAD)</p>
                                <p className="text-2xl font-bold">{summaryTotals.totalQty.toLocaleString()}</p>
                            </div>
                        </div>

                        <div className="bg-blue-700 text-white rounded-lg p-4 shadow-md flex items-center gap-4">
                            <div className="bg-blue-600 p-2 rounded-lg">
                                <Clock className="w-6 h-6" />
                            </div>
                            <div>
                                <p className="text-[10px] font-bold uppercase opacity-80">Tiempo Total Requerido</p>
                                <p className="text-2xl font-bold">{summaryTotals.totalHours.toLocaleString(undefined, { minimumFractionDigits: 1, maximumFractionDigits: 1 })} <span className="text-sm font-normal opacity-80">Horas</span></p>
                            </div>
                        </div>
                    </div>
                )}
            </div>

            {isLoading ? (
                <div className="flex flex-col items-center justify-center py-20 bg-gray-50 rounded-xl border-2 border-dashed gap-4">
                    <Loader2 className="w-12 h-12 animate-spin text-indigo-600" />
                    <div className="text-center">
                        <p className="text-sm font-bold text-gray-700">Descargando datos y cruzando inventarios...</p>
                        <p className="text-xs text-gray-500 mt-1">
                            Procesados {downloadProgress.current.toLocaleString()} de {downloadProgress.total.toLocaleString()} registros
                        </p>
                    </div>
                </div>
            ) : allRawData.length > 0 ? (
                <>
                    <div ref={topScrollRef} onScroll={handleTopScroll} className="overflow-x-auto overflow-y-hidden h-[18px]">
                        <div style={{ width: `${tableWidth}px`, height: '1px' }}></div>
                    </div>

                    <div ref={tableScrollRef} onScroll={handleTableScroll} className="border rounded-lg overflow-auto max-h-[55vh] bg-white shadow-sm">
                        <table ref={tableRef} className="min-w-full text-[11px] border-collapse">
                            <thead className="bg-gray-100 sticky top-0 z-10 shadow-sm">
                                <tr className="border-b-2 border-gray-300">
                                    {displayColumns.map(col => (
                                        <TableHead key={col} className="text-center font-bold text-gray-700 uppercase tracking-wider px-4 py-2 border-r border-dashed border-gray-300 last:border-r-0 whitespace-nowrap">
                                            {col.replace(/_/g, ' ')}
                                        </TableHead>
                                    ))}
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-100">
                                {paginatedData.map((row, idx) => (
                                    <tr key={idx} className="hover:bg-indigo-50/30 transition-colors">
                                        {displayColumns.map((col, cIdx) => {
                                          if (col === 'FECHA DE ENTREGA') {
                                            const pedido = String(row.PEDIDOVENTAS || '').trim();
                                            const posicionPedido = String(row.POSICIONPEDIDO || '').trim();
                                            const entrega = resolveFechaEntregaPorPosicion(pedido, posicionPedido) || '-';
                                            return (
                                              <TableCell key={`${idx}-${cIdx}`} className="px-4 py-2 text-center border-r border-dashed border-gray-200 whitespace-nowrap text-emerald-700 font-semibold">
                                                {entrega}
                                              </TableCell>
                                            );
                                          }

                                          if (col === 'TIEMPOS') {
                                            const material = normalizeMaterialCode(row.MATERIAL);
                                            const tUnit = tiemposMap.get(material) || 0;
                                            const cant = Number(row.CANTIDAD) || 0;
                                            const tTotal = tUnit * cant;
                                            return (
                                              <TableCell key={`${idx}-${cIdx}`} className="px-4 py-2 text-center border-r border-dashed border-gray-200 whitespace-nowrap text-blue-700 font-bold font-mono">
                                                {tTotal > 0 ? tTotal.toFixed(2) : '-'}
                                              </TableCell>
                                            );
                                          }

                                          if (col === 'CANT DISPONIBLE 1000' || col === 'CANT DISPONIBLE 2000') {
                                            const material = normalizeMaterialCode(row.MATERIAL);
                                            const centro = col.includes('1000') ? '1000' : '2000';
                                            const val = inventoryMap.get(`${material}|${centro}`) ?? null;
                                            return (
                                              <TableCell key={`${idx}-${cIdx}`} className={cn(
                                                "px-4 py-2 text-center border-r border-dashed border-gray-200 whitespace-nowrap font-bold",
                                                val !== null && val > 0 ? "text-green-600 bg-green-50/20" : val !== null && val < 0 ? "text-red-600 bg-red-50/20" : "text-gray-400"
                                              )}>
                                                {val !== null ? val.toLocaleString() : '-'}
                                              </TableCell>
                                            );
                                          }

                                          let displayValue = row[col] ?? '-';
                                          
                                          if (col === 'MATERIAL' && typeof displayValue === 'string' && displayValue.startsWith('0000000000')) {
                                            displayValue = displayValue.substring(10);
                                          }

                                          return (
                                            <TableCell key={`${idx}-${cIdx}`} className={cn(
                                              "px-4 py-2 text-center border-r border-dashed border-gray-200 last:border-r-0 whitespace-nowrap text-gray-600",
                                              col === 'CANTIDAD' && "font-bold text-gray-900"
                                            )}>
                                                {displayValue}
                                            </TableCell>
                                          );
                                        })}
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>

                    <div className="flex items-center justify-between mt-4 bg-white p-3 rounded-lg border shadow-sm text-gray-600 font-medium">
                        <div className="flex items-center space-x-3">
                            <span className="text-xs">Filas por página:</span>
                            <select
                                value={rowsPerPage}
                                onChange={(e) => {
                                    setRowsPerPage(Number(e.target.value));
                                    setCurrentPage(1);
                                }}
                                className="px-2 py-1 border rounded-md text-xs bg-white focus:ring-indigo-500"
                            >
                                {ROWS_PER_PAGE_OPTIONS.map(size => <option key={size} value={size}>{size}</option>)}
                            </select>
                        </div>
                        <div className="flex items-center space-x-2">
                            <span className="text-xs">
                                Mostrando <strong>{((currentPage - 1) * rowsPerPage) + 1}</strong> - <strong>{Math.min(currentPage * rowsPerPage, totalFilteredRecords)}</strong> de <strong>{totalFilteredRecords.toLocaleString()}</strong> registros
                            </span>
                            <div className="flex gap-1 ml-4">
                                <Button variant="outline" size="sm" className="h-8" onClick={() => setCurrentPage(1)} disabled={currentPage === 1}>Primera</Button>
                                <Button variant="outline" size="sm" className="h-8" onClick={() => setCurrentPage(p => Math.max(1, p - 1))} disabled={currentPage === 1}>Ant.</Button>
                                <Button variant="outline" size="sm" className="h-8" onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))} disabled={currentPage >= totalPages}>Sig.</Button>
                                <Button variant="outline" size="sm" className="h-8" onClick={() => setCurrentPage(totalPages)} disabled={currentPage >= totalPages}>Última</Button>
                            </div>
                        </div>
                    </div>
                </>
            ) : (
                <div className="flex flex-col items-center justify-center py-20 bg-gray-50 rounded-xl border-2 border-dashed">
                    <Package className="w-12 h-12 text-gray-300 mb-4" />
                    <p className="text-gray-500 font-medium">No se encontraron datos.</p>
                </div>
            )}

            {(foamExplosionResults.length > 0 || primerNivelExplosionResults.length > 0 || segundoNivelExplosionResults.length > 0
                || (planningResult !== null && (planningResult.immediateOrders.length > 0 || planningResult.extraOrders.length > 0))) && (
                <button
                    type="button"
                    onClick={handleSavePlanAndDetails}
                    disabled={isSavingPlan}
                    title={planningResult?.planningStepResult === 3 ? 'Guardar Plan Final (PFSM): Detalle de Planificación Ejecutada' : 'Guardar Plan Táctico y sus Detalles'}
                    className="fixed bottom-6 right-6 z-50 flex items-center gap-2 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-60 disabled:cursor-not-allowed text-white font-bold text-sm px-5 py-3.5 rounded-full shadow-xl shadow-emerald-900/30 transition-colors"
                >
                    {isSavingPlan ? <Loader2 className="w-5 h-5 animate-spin" /> : <Save className="w-5 h-5" />}
                    {isSavingPlan
                        ? (planningResult?.planningStepResult === 3 ? 'Guardando Plan Final...' : 'Guardando Plan...')
                        : (planningResult?.planningStepResult === 3 ? 'GUARDAR PLAN TÁCTICO FINAL' : 'Guardar Plan Táctico')}
                </button>
            )}

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

            <AlertDialog open={stockAlertDialogOpen} onOpenChange={setStockAlertDialogOpen}>
                <AlertDialogContent className="max-w-2xl">
                    <AlertDialogHeader>
                        <AlertDialogTitle className="flex items-center gap-2 text-red-700">
                            <TriangleAlert className="w-5 h-5" />
                            Alerta de Stock — Explosión de Materiales
                        </AlertDialogTitle>
                        <AlertDialogDescription asChild>
                            <div className="space-y-3 text-left max-h-[50vh] overflow-auto">
                                {stockAlertData.telas.length > 0 && (
                                    <div>
                                        <p className="text-sm font-bold text-gray-800 mb-1">
                                            {stockAlertData.telas.length} tela(s) con Alerta de Stock (CRÍTICO, StockActual &lt; 300) —
                                            {(() => {
                                                const totalRestante = stockAlertData.telas.reduce((s, t) => s + t.stockRestante, 0);
                                                const label = totalRestante < 0 ? 'faltan' : 'quedan';
                                                return (
                                                    <> {label} <span className="text-red-700 font-extrabold">{Math.abs(totalRestante).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span> en total:</>
                                                );
                                            })()}
                                        </p>
                                        <ul className="text-xs text-gray-600 list-disc pl-5 space-y-0.5">
                                            {stockAlertData.telas.map(t => (
                                                <li key={t.componente}>
                                                    <span className="font-mono font-semibold">{t.componente}</span> — {t.descripcion} (necesario: {t.totalNecesario.toFixed(2)}, stock: {t.stockActual ?? 0}, <span className="text-red-700 font-bold">{t.stockRestante < 0 ? 'faltan' : 'quedan'}: {Math.abs(t.stockRestante).toFixed(2)} {t.unidad}</span>)
                                                    {t.origenes.length > 0 && (
                                                        <ul className="list-[circle] pl-4 mt-0.5 text-gray-500">
                                                            {t.origenes.map(o => (
                                                                <li key={o.materialPadre}>
                                                                    Material padre <span className="font-mono">{o.materialPadre}</span> — Orden(es): {o.ordenes.join(', ')}
                                                                </li>
                                                            ))}
                                                        </ul>
                                                    )}
                                                </li>
                                            ))}
                                        </ul>
                                    </div>
                                )}
                                {stockAlertData.cascos.length > 0 && (
                                    <div>
                                        <p className="text-sm font-bold text-gray-800 mb-1">
                                            {stockAlertData.cascos.length} casco(s) sin stock suficiente —
                                            faltan <span className="text-red-700 font-extrabold">{stockAlertData.cascos.reduce((s, c) => s + c.cantidadNetaAConseguir, 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span> en total:
                                        </p>
                                        <ul className="text-xs text-gray-600 list-disc pl-5 space-y-0.5">
                                            {stockAlertData.cascos.map(c => (
                                                <li key={c.componente}>
                                                    <span className="font-mono font-semibold">{c.componente}</span> — {c.descripcion} (necesario: {c.totalNecesario.toFixed(2)}, stock: {c.stockActual ?? 0}, <span className="text-red-700 font-bold">faltan: {c.cantidadNetaAConseguir.toFixed(2)} {c.unidad}</span>)
                                                    {c.origenes.length > 0 && (
                                                        <ul className="list-[circle] pl-4 mt-0.5 text-gray-500">
                                                            {c.origenes.map(o => (
                                                                <li key={o.materialPadre}>
                                                                    Material padre <span className="font-mono">{o.materialPadre}</span> — Orden(es): {o.ordenes.join(', ')}
                                                                </li>
                                                            ))}
                                                        </ul>
                                                    )}
                                                </li>
                                            ))}
                                        </ul>
                                    </div>
                                )}
                            </div>
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                        <AlertDialogAction onClick={() => setStockAlertDialogOpen(false)}>Entendido</AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>

            {/* No existe un Plan Táctico guardado para la fecha objetivo: confirmar antes de proceder */}
            <AlertDialog open={planCheckModal?.type === 'not-found'} onOpenChange={(open) => !open && setPlanCheckModal(null)}>
                <AlertDialogContent>
                    <AlertDialogHeader>
                        <AlertDialogTitle>Verificación de Plan Táctico</AlertDialogTitle>
                        <AlertDialogDescription>
                            No existe Plan Táctico Guardado con fecha objetivo{' '}
                            <span className="font-bold text-gray-800">
                                {planningTargetDate?.toLocaleDateString('es-EC', { day: '2-digit', month: '2-digit', year: 'numeric' })}
                            </span>.
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                        <Button variant="outline" onClick={() => setPlanCheckModal(null)}>CANCELAR</Button>
                        <AlertDialogAction onClick={confirmChooseTables}>PROCEDER</AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>

            {/* Ya existe un Plan Táctico guardado para la fecha objetivo: Vista o Borrar */}
            <AlertDialog open={planCheckModal?.type === 'found'} onOpenChange={(open) => !open && setPlanCheckModal(null)}>
                <AlertDialogContent>
                    <AlertDialogHeader>
                        <AlertDialogTitle className="flex items-center gap-2 text-amber-700">
                            <TriangleAlert className="w-5 h-5" />
                            Ya existe un Plan Táctico guardado
                        </AlertDialogTitle>
                        <AlertDialogDescription>
                            Ya existe un Plan Táctico Guardado con fecha objetivo{' '}
                            <span className="font-bold text-gray-800">
                                {planningTargetDate?.toLocaleDateString('es-EC', { day: '2-digit', month: '2-digit', year: 'numeric' })}
                            </span>{' '}
                            ({planCheckModal?.type === 'found' ? planCheckModal.planGrupo.valor : ''}). Escoja qué desea hacer:
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
                                Borrar Plan Guardado
                            </Button>
                            <AlertDialogAction onClick={handleActivateVistaMode} disabled={isPlanCheckBusy}>
                                {isPlanCheckBusy ? <Loader2 className="w-4 h-4 animate-spin mr-1.5" /> : null}
                                Activar Modo Vista
                            </AlertDialogAction>
                        </div>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>

            {/* Modo Vista: detalle de materiales realmente guardado para el Plan Táctico encontrado */}
            <Dialog open={planCheckModal?.type === 'vista'} onOpenChange={(open) => !open && setPlanCheckModal(null)}>
                <DialogContent className="max-w-3xl">
                    <DialogHeader>
                        <DialogTitle>Modo Vista — Plan Táctico Guardado</DialogTitle>
                        <DialogDescription>
                            {planCheckModal?.type === 'vista' ? planCheckModal.planGrupo.valor : ''} — solo se muestra el detalle de
                            materiales que realmente quedó guardado (Componente, Cantidad, Resp. Ctrl. Prod.). No se guardaron las
                            órdenes, el Diagrama de Gantt, la capacidad ni las asignaciones de personal de ese momento.
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
                                        <TableHead className="text-[10px] font-extrabold text-gray-600 uppercase text-center">Clasificación</TableHead>
                                    </TableRow>
                                </TableHeader>
                                <TableBody>
                                    {planCheckModal.detalles.map((d, idx) => (
                                        <TableRow key={d.codigo_detalle_tactico} className={cn("border-b border-gray-200", idx % 2 === 1 && "bg-gray-50/70")}>
                                            <TableCell className="text-[11px] font-mono font-semibold text-gray-800 border-r border-gray-200">{d.codigo_material}</TableCell>
                                            <TableCell className="text-[11px] text-center font-mono font-bold text-indigo-700 border-r border-gray-200">{d.cantidad_produccion_neta}</TableCell>
                                            <TableCell className="text-[11px] text-center border-r border-gray-200">{d.resp_ctrl_prod || '—'}</TableCell>
                                            <TableCell className="text-[11px] text-center">
                                                {RESP_CTRL_PROD_PRIMER_NIVEL.includes(d.resp_ctrl_prod || '') ? 'Primer Nivel'
                                                    : RESP_CTRL_PROD_SEGUNDO_NIVEL.includes(d.resp_ctrl_prod || '') ? 'Segundo Nivel'
                                                    : /P1\.3\s*$|PFSM\s*$/i.test(planCheckModal.planGrupo.valor) ? 'Planificación Ejecutada'
                                                    : 'Espuma'}
                                            </TableCell>
                                        </TableRow>
                                    ))}
                                    {planCheckModal.detalles.length === 0 && (
                                        <TableRow>
                                            <TableCell colSpan={4} className="text-center py-6 text-gray-400 text-xs">
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

            {/* Materiales en Espera de Insumo: el usuario indica un insumo (Tela, Casco u otra materia
                prima) que todavía no llega y desde cuándo sí estará disponible; cualquier material padre
                que lo necesite en su explosión queda excluido de la planificación hasta esa fecha. */}
            <Dialog open={isEsperaDialogOpen} onOpenChange={setIsEsperaDialogOpen}>
                <DialogContent className="max-w-2xl">
                    <DialogHeader>
                        <DialogTitle>Materiales en Espera de Insumo</DialogTitle>
                        <DialogDescription>
                            Indique el insumo (Tela, Casco u otra materia prima) que todavía no llega y la fecha en la que sí estará
                            disponible. Mientras esa fecha no llegue, cualquier material padre que lo necesite (en cualquier nivel de
                            su explosión de materiales) se excluirá automáticamente de la planificación.
                        </DialogDescription>
                    </DialogHeader>

                    <div className="space-y-3 border border-dashed border-amber-300 bg-amber-50/50 rounded-lg p-4">
                        <div className="relative">
                            <label className="text-[10px] font-bold text-gray-500 uppercase">Buscar Insumo (código o nombre)</label>
                            <Input
                                value={esperaSelectedMaterial ? `${esperaSelectedMaterial.codigo} — ${esperaSelectedMaterial.descripcion}` : esperaSearchTerm}
                                onChange={(e) => { setEsperaSearchTerm(e.target.value); setEsperaSelectedMaterial(null); }}
                                placeholder="Ej. TELA MUEBLES OSLO, o el código SAP"
                                className="text-xs mt-1"
                            />
                            {!esperaSelectedMaterial && esperaSearchResults.length > 0 && (
                                <div className="absolute z-10 mt-1 w-full max-h-48 overflow-auto bg-white border border-gray-300 rounded-md shadow-lg">
                                    {esperaSearchResults.map(r => (
                                        <button
                                            key={r.codigo}
                                            type="button"
                                            onClick={() => { setEsperaSelectedMaterial(r); setEsperaSearchTerm(''); }}
                                            className="w-full text-left px-3 py-1.5 text-[11px] hover:bg-amber-100 border-b border-gray-100 last:border-0"
                                        >
                                            <span className="font-mono font-semibold">{r.codigo}</span> — {r.descripcion}
                                        </button>
                                    ))}
                                </div>
                            )}
                            {!esperaSelectedMaterial && esperaSearchTerm.trim().length >= 2 && esperaSearchResults.length === 0 && (
                                <p className="text-[10px] text-gray-400 mt-1">Sin coincidencias en el maestro de materiales.</p>
                            )}
                        </div>
                        <div className="grid grid-cols-2 gap-3">
                            <div>
                                <label className="text-[10px] font-bold text-gray-500 uppercase">Disponible Desde</label>
                                <input
                                    type="date"
                                    value={esperaFechaDisponible}
                                    onChange={(e) => setEsperaFechaDisponible(e.target.value)}
                                    className="w-full mt-1 h-9 rounded-md border border-input bg-transparent px-3 text-xs"
                                />
                            </div>
                            <div>
                                <label className="text-[10px] font-bold text-gray-500 uppercase">Nota (opcional)</label>
                                <Input
                                    value={esperaNota}
                                    onChange={(e) => setEsperaNota(e.target.value)}
                                    placeholder="Ej. Confirmado por proveedor X"
                                    className="text-xs mt-1"
                                />
                            </div>
                        </div>
                        <Button
                            onClick={handleAgregarMaterialEnEspera}
                            disabled={isSavingEspera || !esperaSelectedMaterial || !esperaFechaDisponible}
                            className="w-full bg-amber-600 hover:bg-amber-700 text-white font-bold gap-2"
                        >
                            {isSavingEspera ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
                            AGREGAR
                        </Button>
                    </div>

                    <div className="border border-gray-200 rounded-lg overflow-auto max-h-[35vh]">
                        <Table>
                            <TableHeader>
                                <TableRow className="bg-gray-100 hover:bg-gray-100 border-b-2 border-gray-300 sticky top-0">
                                    <TableHead className="text-[10px] font-extrabold text-gray-600 uppercase border-r border-gray-200">Insumo</TableHead>
                                    <TableHead className="text-[10px] font-extrabold text-gray-600 uppercase text-center border-r border-gray-200">Disponible Desde</TableHead>
                                    <TableHead className="text-[10px] font-extrabold text-gray-600 uppercase text-center w-16">Quitar</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {materialesEnEspera.map(m => (
                                    <TableRow key={m.codigoRestriccion} className="border-b border-gray-200">
                                        <TableCell className="text-[11px]">
                                            <span className="font-mono font-semibold">{m.insumoCodigo}</span> — {m.descripcion}
                                        </TableCell>
                                        <TableCell className="text-[11px] text-center font-semibold text-amber-700">
                                            {formatDDMMYYYY(m.fechaDisponible)}
                                        </TableCell>
                                        <TableCell className="text-center">
                                            <Button
                                                size="icon"
                                                variant="ghost"
                                                onClick={() => handleEliminarMaterialEnEspera(m.codigoRestriccion)}
                                                className="h-7 w-7 text-gray-400 hover:text-red-600"
                                            >
                                                <X className="w-4 h-4" />
                                            </Button>
                                        </TableCell>
                                    </TableRow>
                                ))}
                                {materialesEnEspera.length === 0 && (
                                    <TableRow>
                                        <TableCell colSpan={3} className="text-center py-6 text-gray-400 text-xs">
                                            No hay insumos en espera registrados.
                                        </TableCell>
                                    </TableRow>
                                )}
                            </TableBody>
                        </Table>
                    </div>
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
                            Esto reinicia las mesas escogidas, el personal asignado, la planificación calculada, la distribución de
                            mesas y la explosión de materiales de esta sesión. No se borra nada de lo ya guardado en SAP ni en Plan
                            Táctico — solo el progreso que no ha guardado todavía.
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
});
ProvisionalOrdersAlphaTab.displayName = 'ProvisionalOrdersAlphaTab';
