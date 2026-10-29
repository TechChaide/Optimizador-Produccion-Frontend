'use client';

import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { useSearchParams } from 'next/navigation';
import { ShoppingCart, Package, Loader2, LayoutDashboard, Calendar as CalendarIcon, ChevronLeft, ChevronRight, Filter, X, Layers, Wand2, Save, ClipboardCheck, RefreshCw, Clock, Search, Mail, AlertCircle, FileText, Wrench, CheckCircle2 } from 'lucide-react';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from '@/components/ui/button';
import { grupoService } from '@/services/grupo.service';
import { restriccionService } from '@/services/restriccion.service';
import { porcentajeRestriccion, RESTRICCION_CAPACIDAD, jornadaDesdeRestricciones, opcionesConHorarios, claveDeHorario, intervaloDeHorario, horasSolapadas } from '@/lib/restriccionesCapacidad';
import { ejecucionPlanHtml, fechaHoraEjecucion, mttoEnVentana } from '@/lib/ventana-plan';
import { serviciosService } from '@/services/servicios.service';
import { sapCompartido, refrescarDatosSap, detallesDePlanes, refrescarAlSincronizar } from '@/lib/datos-sap-compartidos';
import { DatosSapEstado } from '@/components/DatosSapEstado';
import { planGrupoService } from '@/services/plangrupo.service';
import { detalleTacticoService } from '@/services/detalletactico.service';
import { useAppContext } from '@/context/AppProvider';
import type { Grupo, Restriccion, PlanGrupo, DetalleTactico } from '@/types/interfaces';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import { useReportePlanTxt, ReportePlanTxtAcciones, ReportePlanTxtVistaPrevia, type OrigenEstadoPlan } from '@/components/ReportePlanTxtFlujo';
import { useEstadoDelDia } from '@/components/EstadoDelDia';
import { hitosDePlanes } from '@/lib/estado-dia';
import { PanelProgreso, usePanelProgreso } from '@/components/PanelProgreso';
import { nextBusinessDay as nextBusinessDayCal, addBusinessDays as addBusinessDaysCal, esDiaNoLaborable, cargarDiasNoLaborables, laborablesHorizonte, fechaLocalEcuador, fechaLocalPlana, ecuadorMidnightISO, ecuadorNowNaiveISO, fechaHoraCreacionPlanGrupo, type DiasNoLaborables } from '@/lib/dias-laborables';
import { guardarEnCache, leerDeCache, actualizarEnCache } from '@/lib/cache-modulos';
import { format, startOfMonth, endOfMonth, eachDayOfInterval, getDay, parseISO, addMonths, subMonths, addDays } from 'date-fns';
import { es } from 'date-fns/locale';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Accordion, AccordionItem, AccordionTrigger, AccordionContent } from "@/components/ui/accordion";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Progress } from "@/components/ui/progress";

// Respaldo SOLO para cuando el material no tiene tiempo estándar real en el catálogo SAP (ver
// calculateSummary/matchTiempoEstandar) — antes era el único cálculo usado, sobreestimando el
// tiempo real hasta ~22x en casos verificados (ver comentario en calculateSummary).
const PACKING_TIME_PER_UNIT_SECONDS = 15;
// Personal de cuboHabilidadesOP (código, nombre y línea de proceso), sin repetidos. El código puede
// venir como 'CodigoOperador ' (con espacio, igual que lo lee Corte Espuma).
interface OperadorHabilidad { codigo: string; nombre: string; linea: string }
const reducirHabilidades = (filas: Record<string, unknown>[]): OperadorHabilidad[] => {
  const val = (f: Record<string, unknown>, keys: string[]) => String(keys.map(k => f[k]).find(v => v !== undefined && v !== null && String(v).trim() !== '') ?? '').trim();
  const vistos = new Map<string, OperadorHabilidad>();
  filas.forEach(f => {
    const codigo = val(f, ['CodigoOperador ', 'CodigoOperador', 'CODIGO_OPERADOR']);
    const linea = val(f, ['LineaProceso', 'LINEA_PROCESO']).toUpperCase();
    if (!codigo) return;
    const k = `${codigo}|${linea}`;
    if (!vistos.has(k)) vistos.set(k, { codigo, nombre: val(f, ['NombreOperador', 'NOMBRE_OPERADOR']) || codigo, linea });
  });
  return [...vistos.values()].sort((a, b) => a.nombre.localeCompare(b.nombre));
};
// Línea de proceso de Empaque en cuboHabilidadesOP (usuario 2026-10-09: "saldría de empaque";
// confirmar con el dato real — si nadie coincide, el Resumen muestra las líneas que trae el servicio).
const LINEA_PROCESO_EMPAQUE = 'EMPAQUE';

// KPIMaestroCarruseles solo de los centros de Venta Externa y con los 3 campos que se usan (respaldo
// del tiempo de empaque, ver conRespaldoCarruseles) — para no inflar la caché del módulo.
const reducirCarruseles = (filas: Record<string, unknown>[]) => filas
  .filter(c => ['1000', '2000'].includes(String(c.Centro ?? '').trim()))
  .map(c => ({ Material: c.Material, Centro: String(c.Centro).trim(), TiempoCorte: c.TiempoCorte }));
// Paquetes de planchas (usuario 2026-10-08): se apilan hasta 60 cm de altura nominal. Unidades por
// paquete = ⌊60 / espesor (cm)⌋; paquetes = ⌈unidades del material / unidades por paquete⌉ (se arman
// por material). Las C-PLANCHA siguen el mismo proceso y además se ENROLLA el paquete.
const ALTURA_PAQUETE_CM = 60;
const ES_PLANCHA = /PLANCHA/i;
const ES_C_PLANCHA = /\bC\s*-?\s*PLANCHA/i;
const paquetesPlancha = (unidades: number, espesorCm: string): number => {
  const esp = Number(espesorCm);
  if (!(esp > 0) || !(unidades > 0)) return 0;
  return Math.ceil(unidades / Math.max(1, Math.floor(ALTURA_PAQUETE_CM / esp)));
};

// Discriminador de tipo de componente en la explosión BOM (mismo criterio que usa
// Corte y Laminado para identificar la "lámina" que consume como materia prima).
const DESCRIPCION_ROLLO = 'LAMINA CILINDRICA';
// Variante CONV de un rollo (mismo criterio que isConvDescripcion en Corte y Laminado).
const esRolloConv = (desc: string): boolean => desc.includes('CONV') || desc.includes('CV');

const TIPO_TAG: Record<'ESPUMAS' | 'ROLLOS', string> = { ESPUMAS: 'Espumas', ROLLOS: 'Rollos' };

// --- Capacidad Operativa · Empaque (máquina empacadora + operadores) ---
// Mismo patrón de config editable que ya usa Corte Espuma (PlantaConfig/MachineShiftConfig,
// TacticalPlanEspumasSection) para Carruseles/CNC/Verticales: turnos Día/Noche/Sábado elegidos de un
// catálogo de horarios fijo, % de paro editable, operadores por turno (informativo — no multiplica la
// capacidad, mismo criterio que ya aplica ese módulo) y mantenimiento preventivo real, restado de la
// capacidad. Config solo en memoria (useState, no persiste al backend), igual que uioConfig/gyeConfig
// en Corte Espuma.
interface EmpaqueShiftConfig {
  day: string;
  night: string;
  saturday: string;
  paroDay: number;
  paroNight: number;
  paroSaturday: number;
  operadoresDay: number;
  operadoresNight: number;
  operadoresSaturday: number;
  // Operadores asignados por turno (códigos de cuboHabilidadesOP, usuario 2026-10-09); tantos
  // puestos como operadores<Turno>. Opcional: planes guardados antes no lo traen.
  asignadosDay?: string[];
  asignadosNight?: string[];
  asignadosSaturday?: string[];
  mttoPreventivoHoras: number;
  // true = el planificador escribió el mantenimiento a mano; false = se usa lo que trae SAP para la
  // ventana del plan (máquinas de la restricción MANTENIMIENTO, ver mttoSAPEmpaque).
  mttoManual: boolean;
  // Rendimiento de la máquina (%), precargado desde la restricción Rendimiento_<máquina> del grupo.
  rendimiento: number;
  activa: boolean;
}

// Solo Centro 1000 (Quito) tiene una empacadora registrada hoy — se agrega aquí la de Guayaquil el
// día que exista, sin tocar el resto del cálculo (ya está escrito por centro).
// restriccionRendimiento: nombre de la restricción del grupo con el % de rendimiento de esa máquina.
const EMPAQUE_MACHINES_BY_CENTRO: Record<'1000' | '2000', { id: string; nombre: string; restriccionRendimiento: string }[]> = {
  '1000': [{ id: 'EMPACADORA_ELECTROTECKS', nombre: 'Empacadora Electrotecks', restriccionRendimiento: 'Rendimiento_Electrotecks' }],
  '2000': [],
};

interface NecesidadMaterial {
  material: string;
  descripcion: string;
  cantidad: number;
}

interface DataAprobadaRow {
  material: string;
  descripcion: string;
  cantidad: number;
  // Cantidad confirmada por el consumidor (= cantidad del P2 si respondió este ciclo, 0 si no).
  respuestaCant: number;
  // Desglose de la respuesta: lo que el P3 manda a fabricar y lo cubierto con stock/provisional.
  aProducir?: number;
  cubiertoStock?: number;
  planGrupo: string;
  fechasOk: boolean | null;
}

// Misma regla que ya usaba el JSX de "Data Aprobada" inline, subida a función compartida para que
// "PFD - VENTA" (generarPfdVentaPreview) no la duplique.
const estadoDataAprobada = (row: DataAprobadaRow): 'pendiente' | 'parcial' | 'completo' =>
  row.respuestaCant <= 0 ? 'pendiente' : row.respuestaCant >= row.cantidad ? 'completo' : 'parcial';

// Una fila por material FERT/PT — exactamente lo que "Guardar PFD-VENTA" va a grabar en
// DetalleTactico (cantidad), más 2 columnas informativas (categoria/tiempoHoras) para dar contexto
// sin necesitar una vista agrupada aparte (ver generarPfdVentaPreview).
interface PfdVentaLinea {
  material: string;
  descripcion: string;
  categoria: string;
  cantidad: number;
  tiempoHoras: number;
}
interface PfdVentaPreview {
  lineas: PfdVentaLinea[];
  sinTrazabilidad: DataAprobadaRow[];
  ptCubiertos: Set<string>;
  // Solo para el correo de Empaque (no se graba): FERT/PT de Rollos y # de rollos por categoría.
  rollos?: { lineas: PfdVentaLinea[]; rollosPorCategoria: Record<string, number> };
}

// Cantidad viene como texto desde DetalleTactico (p.ej. "120.5000"); mismo criterio de limpieza
// que usan Corte Espuma / Corte y Laminado en sus resúmenes.
const parseQty = (val: unknown): number => {
  const n = Number(String(val ?? '').replace(/[^0-9.-]/g, ''));
  return isNaN(n) ? 0 : n;
};

// Normaliza fecha_inicio_plan/fecha_fin_plan (siempre de plan_grupo, escritos por esta misma app) a
// 'yyyy-MM-dd'. Delega en fechaLocalPlana (@/lib/dias-laborables), NO en fechaLocalEcuador: desde
// 2026-09-10 estos campos se graban con la convención "naive Ecuador" (hora literal, sin instante UTC
// real — ver ecuadorMidnightISO). fecha_modificacion NO usa este helper: lo genera el backend en cada
// UPDATE, sigue siendo UTC real, y se lee con fechaLocalEcuador directo (ver sus 2 usos más abajo).
const soloFecha = (v: unknown): string => {
  const s = String(v ?? '').trim();
  if (!s || s === 'null' || s === 'undefined') return '';
  return fechaLocalPlana(s);
};
// fecha_creacion vuelve de la API +5h (ver fechaHoraCreacionPlanGrupo): con soloFecha un P2 creado
// después de las 19:00 quedaba fechado al día siguiente.
const fechaCreacion = (v: unknown): string => fechaHoraCreacionPlanGrupo(v).fecha;
// Desactiva un PlanGrupo mandando SOLO código + estado (el backend actualiza únicamente los campos que
// llegan). Antes se reenviaba el objeto completo leído de la API, con fecha_creacion/fecha_inicio_plan
// ya corridas +5h: así ningún UPDATE de desactivación puede regrabar las fechas corridas en BD.
const desactivarPlanGrupo = (pg: PlanGrupo) =>
  planGrupoService.save({ codigo_plan_grupo: pg.codigo_plan_grupo, estado: 'I' } as unknown as PlanGrupo);

// Solo el plan "P3" es una respuesta real contra el P2 (desde 2026-10-03 = faltante a fabricar, sin
// líneas en 0; ver el emparejamiento en fetchDataAprobada) — "PFD" es una
// variante de salida para otro proceso (deja constancia de qué material quedó sin planificar,
// forzando a 0 los que no tienen corrida) y no debe contarse como material efectivamente recibido.
const esPlanP3 = (valor: unknown): boolean => /\bp3\b/i.test(String(valor || ''));

// Día hábil: lunes a viernes MENOS los feriados / días no trabajados del calendario configurado
// (Configuraciones → Calendario Área) — ver @/lib/dias-laborables. Dentro del componente se usa el
// wrapper siguienteDiaHabil, que ya lleva ese calendario cargado. El día que se adopte sábado como
// laborable, eso se resuelve ahí y aplica a todos los módulos a la vez.

// Tab "Pendientes": solo Espumas (Corte Espuma consume esta demanda) — el resto de sectores del
// mismo endpoint (Colchones, Muebles, etc.) no aplica a este módulo.
const SECTOR_ESPUMAS = '09 ESPUMAS';

// Cod.Buscar: clave de cruce entre "Pendientes Totales" y "Órdenes FERT", igual a la fórmula ya
// usada en el archivo Excel de origen: [@POSICION]*1 & [@PEDIDO]*1 & [@MATERIAL]*1 — el "*1" fuerza
// cada valor a número (elimina ceros a la izquierda) antes de concatenarlos como texto.
const buildCodBuscar = (posicion: unknown, pedido: unknown, material: unknown): string => {
  const num = (v: unknown) => String(parseQty(v));
  return `${num(posicion)}${num(pedido)}${num(material)}`;
};

// Clasificación MTO/MTS de una orden Provisional por su ClaseOrden — confirmado con datos reales
// (verificado que KD siempre trae PEDIDOVENTAS real y LA siempre lo trae vacío/"000000"): KD = MTO
// (bajo pedido, con cliente), LA = MTS (sin cliente). Es solo una ETIQUETA informativa — no excluye
// filas del listado, eso se controla por RESPCTRLPROD (ver filterData), no por ClaseOrden.
const clasificarClaseOrden = (claseOrden: unknown): string => {
  const c = String(claseOrden || '').trim().toUpperCase();
  if (c === 'KD') return 'MTO';
  if (c === 'LA') return 'MTS';
  return c || '—';
};

// A diferencia de `String(v || '')`, no descarta 0/"" legítimos (ej. CANT_PEND_ENTREGA: 0) —
// solo cae a '' cuando el campo realmente no vino (null/undefined).
const numOrEmpty = (v: unknown): string => (v === null || v === undefined || v === '') ? '' : String(v);

interface PendienteRow {
  pedido: string;
  posicion: string;
  codBuscar: string;
  cantPedida: string;
  centro: string;
  fechaPedido: string;
  fechaEntrega: string;
  ciudadDestino: string;
  volPend: string;
  // Cruce contra Órdenes FERT por Cod.Buscar (POSICION+PEDIDO+MATERIAL) — fecha de entrega de la
  // Orden FERT que ya cubre este pedido/posición/material, si existe.
  fechaEntregaFert: string;
}

// Snapshot de lo que este módulo tiene cargado. Se guarda al sincronizar y se restaura al volver de
// otro módulo, para no perder el trabajo en curso solo por navegar — mismo patrón que Corte Espuma
// (ver @/lib/cache-modulos y [[persistencia_datos_modulos]]).
const CACHE_VENTA_EXTERNA = 'tactica-venta-externa';
interface SnapshotVentaExterna {
  grupos: Grupo[];
  restricciones: Restriccion[];
  ordenes: Record<string, unknown>[];
  ordenesFert: Record<string, unknown>[];
  tiemposEnsamblado: Record<string, unknown>[];
  mantenimientosSAP?: Record<string, unknown>[];
  // KPIMaestroCarruseles reducido (Material/Centro/TiempoCorte) — respaldo del tiempo de empaque.
  kpiCarruseles?: Record<string, unknown>[];
  // Personal de cuboHabilidadesOP reducido (código, nombre, línea de proceso) — asignación en Empaque.
  habilidadesOP?: OperadorHabilidad[];
  diasNoLaborables: string[];
  diasLaborablesExtra: string[];
  // Resultado YA CALCULADO del tab "Data Aprobada" (ver fetchDataAprobada) — a diferencia del resto
  // de este snapshot (datos crudos), esto es el resultado de un cálculo disparado por el botón
  // "Actualizar" de ese tab; sin cachearlo aparte, volvía a quedar vacío al navegar a otro módulo y
  // volver, igual que pasaba con el resumen de Corte y Laminado (ver
  // [[laminado_prioridad_consumo_interno_sobre_venta_externa]] y la verificación de persistencia de
  // esta sesión). Se sincroniza con actualizarEnCache directo en fetchDataAprobada, sin overrides
  // manuales de por medio (es un recálculo puro, no editable).
  dataAprobada: Record<string, DataAprobadaRow[]>;
  // Resultado YA CALCULADO de "Generar Necesidades - BOM FERT" (ver handleCalcularNecesidadRollos) -
  // mismo problema que dataAprobada: sin cachearlo aparte, el usuario perdia la necesidad recien
  // explotada del BOM al navegar a otro modulo y volver, aunque los datos crudos (ordenes/ordenesFert)
  // si sobrevivieran. Se sincroniza con actualizarEnCache al final de handleCalcularNecesidadRollos.
  necesidadEspumas1000: NecesidadMaterial[];
  necesidadEspumas2000: NecesidadMaterial[];
  necesidadRollos1000: NecesidadMaterial[];
  necesidadRollos2000: NecesidadMaterial[];
}

// Respaldo de lo planificado guardado junto al TXT ({fecha}.estado.json) para volver a mostrar el
// Resumen desde "Recuperar y revisar". Mismo modelo que Laminado (decisión del usuario 2026-10-02):
// se guarda el RESULTADO ya calculado (Carga Operativa ejecutada, bloque Rollos de Empaque con sus
// horas, PFD-VENTA, Data Aprobada, configuración de Empaque) — no las órdenes SAP (v1 las guardaba).
// Al cargar no se consulta SAP ni se reprocesa; es solo consulta: generar P2 / PFD-VENTA queda
// bloqueado hasta Sincronizar. Cambiar su forma exige subir `version`.
interface BloqueRollosEmpaque {
  filas: { categoria: string; materiales: number; cantidad: number; rollos: number; horas: number }[];
  totalCantidad: number;
  totalHoras: number;
}
interface ResultadoResumenVentaExterna {
  // "Hoy" del día en que se guardó: fija la ventana de Empaque (PT) que se ve al cargar.
  hoy: string;
  // Filas de "Carga Operativa ejecutada" (calculateSummary), ya con sus horas de empaque.
  summaryData: Record<'1000' | '2000', unknown[]>;
  bloqueRollos1000: BloqueRollosEmpaque | null;
}
interface EstadoPlanVentaExterna {
  tipo: 'venta-externa';
  version: 2;
  grupos: Grupo[];
  restricciones: Restriccion[];
  // Solo los MTTO de la empacadora (MEE01) — horas de mantenimiento en la ventana de Empaque.
  mantenimientosEmpaque: Record<string, unknown>[];
  selectedDates: string[];
  selectedDatesResumen: string[];
  empaqueConfig: Record<string, EmpaqueShiftConfig>;
  dataAprobada: Record<string, DataAprobadaRow[]>;
  necesidadEspumas1000: NecesidadMaterial[];
  necesidadEspumas2000: NecesidadMaterial[];
  necesidadRollos1000: NecesidadMaterial[];
  necesidadRollos2000: NecesidadMaterial[];
  pfdVentaPreview: Record<string, PfdVentaPreview>;
  resultado: ResultadoResumenVentaExterna;
}

export const TacticalPlanVentaExternaSection: React.FC = () => {
  const { addNotification } = useAppContext();

  const [mounted, setMounted] = useState(false);
  // Abre en Resumen (paso 3), donde se carga el último plan guardado (useAutoCargaPlanVigente) — mismo
  // criterio que los otros módulos (usuario 2026-10-08; antes abría en Plan P2).
  const [activeTab, setActiveTab] = useState('resumen');
  // El módulo YA NO sincroniza solo al abrirse — ver handleSincronizarYGenerar. Este flag distingue
  // "todavía no se pidió nada" del estado vacío real, para mostrar el aviso correcto.
  const [datosCargados, setDatosCargados] = useState(false);
  // Reporte guardado del que viene lo que se ve (ver restaurarEstadoPlan); null = datos de la sesión.
  const [planCargadoDe, setPlanCargadoDe] = useState<OrigenEstadoPlan | null>(null);
  // Resultado del Resumen cargado desde un reporte guardado (ver EstadoPlanVentaExterna): mientras no
  // sea null, el Resumen lee esto en vez de procesar órdenes SAP. Se limpia al sincronizar.
  const [resultadoRestaurado, setResultadoRestaurado] = useState<ResultadoResumenVentaExterna | null>(null);
  // "Sincronizar" dispara además "Generar Necesidades · BOM FERT" automáticamente (antes 2 clics) —
  // SOLO si ya hay una "Ventana de Producción" (selectedDates) elegida, igual que la validación
  // manual del botón; si no, se deja para que el usuario elija fecha y lo dispare a mano (el botón
  // sigue disponible aparte, a diferencia de Laminado/Espuma — acá el paso intermedio de elegir fecha
  // es obligatorio, no opcional). Mismo patrón general que [[modulos_tacticos_sincronizar_y_generar_combinado]].
  const [autoGenerarPendiente, setAutoGenerarPendiente] = useState(false);
  // Tercera fase de Sincronizar: generar el P2 cuando aún no hay P2 de hoy (2026-10-16). Entre 12-10 y
  // 16-10 era solo manual, porque generarlo en cada sincronización de la tarde pisaba el P2 que
  // Laminado/Corte Espuma ya habían respondido; ahora se genera solo la primera vez del día.
  const [autoGenerarP2Pendiente, setAutoGenerarP2Pendiente] = useState(false);
  // Cambia tras cada acción que graba (P2, PFD-VENTA) para que el estado del día (✓ de las
  // pestañas-paso) se vuelva a consultar.
  const [recargaEstadoDia, setRecargaEstadoDia] = useState(0);
  const estadoDia = useEstadoDelDia(recargaEstadoDia);
  const [syncStep, setSyncStep] = useState<'idle' | 'sincronizando' | 'generando'>('idle');
  // Panel flotante de progreso de "Sincronizar" (ver handleSincronizarYGenerar y sus fases).
  const panelProgreso = usePanelProgreso();
  const [grupos, setGrupos] = useState<Grupo[]>([]);
  const [restricciones, setRestricciones] = useState<Restriccion[]>([]);
  const [ordenes, setOrders] = useState<Record<string, unknown>[]>([]);
  const [ordenesFert, setOrdersFert] = useState<Record<string, unknown>[]>([]);
  const [tiemposEnsamblado, setTiemposEnsamblado] = useState<Record<string, unknown>[]>([]);
  // Mantenimiento preventivo programado en SAP (ListarMantenimientoPreventivosProgramados), solo para
  // las máquinas de Empaque (ver mttoSAPEmpaque).
  const [mantenimientosSAP, setMantenimientosSAP] = useState<Record<string, unknown>[]>([]);
  const [kpiCarruseles, setKpiCarruseles] = useState<Record<string, unknown>[]>([]);
  const [habilidadesOP, setHabilidadesOP] = useState<OperadorHabilidad[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  // Días NO laborables (feriados + días que la planta decide no trabajar) del calendario configurado.
  // Vacío = solo se saltan fines de semana. Se carga en el init de abajo.
  const [diasNoLaborables, setDiasNoLaborables] = useState<DiasNoLaborables>(new Set<string>());
  // Excepciones "Jornada" del mismo calendario: días que SÍ se trabajan aunque caigan en fin de
  // semana — el sábado habilitado puntualmente para cubrir excedente de capacidad (mismo criterio
  // que Corte y Laminado/Corte Espuma, ver [[sabado_dia_habil_condicional]]).
  const [diasLaborablesExtra, setDiasLaborablesExtra] = useState<DiasNoLaborables>(new Set<string>());
  // Horizonte (sin Jornadas de fin de semana mientras SAP solo genere órdenes L-V, ver laborablesHorizonte).
  const siguienteDiaHabil = useCallback((d: Date) => nextBusinessDayCal(d, diasNoLaborables, laborablesHorizonte(diasLaborablesExtra)), [diasNoLaborables, diasLaborablesExtra]);
  // Fechas del P2 de Venta Externa (regla del usuario 2026-10-02, "horizonte 2 días"): se planifica
  // HOY; Corte Espuma / Laminado recuperan y producen hoy+1 hábil; el PT se produce (y se empaca)
  // hoy+2 hábiles. El P2 graba fecha_inicio_plan = recuperación y fecha_fin_plan = PT.
  const fechasHorizonteDe = (noLaborables: DiasNoLaborables, laborablesExtra: DiasNoLaborables, hoy?: string) => {
    const extra = laborablesHorizonte(laborablesExtra);
    const base = hoy ? parseISO(hoy) : new Date();
    return {
      recuperacion: format(addBusinessDaysCal(base, 1, noLaborables, extra), 'yyyy-MM-dd'),
      pt: format(addBusinessDaysCal(base, 2, noLaborables, extra), 'yyyy-MM-dd'),
    };
  };
  // Con un plan cargado, el horizonte es el del día en que se guardó (ventana de Empaque tal cual).
  const fechasHorizonte = fechasHorizonteDe(diasNoLaborables, diasLaborablesExtra, resultadoRestaurado?.hoy);
  // Recuperación (día de Corte/Laminado) de un PT dado: el día hábil anterior del horizonte.
  const recuperacionDePT = (pt: string) => format(addBusinessDaysCal(parseISO(pt), -1, diasNoLaborables, laborablesHorizonte(diasLaborablesExtra)), 'yyyy-MM-dd');
  // Materiales DIFERIDOS (decisión del usuario 2026-10-02): "Diferir →" en Corte Espuma (candidatos a
  // diferir: Corte sin capacidad + material con holgura en sus pedidos) aplaza SOLO ese material —
  // antes se regeneraba todo el P2 con otra fecha. Al generar el P2 de Espumas, estos materiales salen
  // del P2 normal y van a un P2 "… - ESPUMAS - DIFERIDO" con recuperación hoy+2 / PT hoy+3, que Corte
  // Espuma recupera al día siguiente con su regla de siempre (fecha_inicio_plan = hoy+1).
  // Se acumulan en sessionStorage por día para poder diferir varios desde Corte Espuma, uno tras otro.
  const claveDiferidos = `ve-diferidos-${format(new Date(), 'yyyy-MM-dd')}`;
  const [materialesDiferidos, setMaterialesDiferidos] = useState<Record<'1000' | '2000', string[]>>({ '1000': [], '2000': [] });
  // Se lee en un efecto (no en el estado inicial) para no desfasar el render del servidor; va ANTES
  // del efecto que agrega el material de la URL, así ese se suma sobre lo ya guardado.
  useEffect(() => {
    try {
      const guardado = JSON.parse(sessionStorage.getItem(claveDiferidos) || 'null');
      if (guardado && Array.isArray(guardado['1000']) && Array.isArray(guardado['2000'])) setMaterialesDiferidos(guardado);
    } catch { /* sin storage: arranca vacío */ }
  }, []); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => {
    try { sessionStorage.setItem(claveDiferidos, JSON.stringify(materialesDiferidos)); } catch { /* opcional */ }
  }, [materialesDiferidos, claveDiferidos]);
  const normMaterial = (m: unknown) => String(Number(m));
  const quitarDiferido = (centro: '1000' | '2000', material: string) =>
    setMaterialesDiferidos(prev => ({ ...prev, [centro]: prev[centro].filter(m => m !== material) }));
  const [selectedDates, setSelectedDates] = useState<string[]>([]);
  const [viewDate, setViewDate] = useState(new Date());
  // Fecha(s) de "Resumen Necesidades" — selector PROPIO de este tab, deliberadamente separado de
  // `selectedDates` ("Ventana de Producción", usada por Provisionales/generar P2). Multi-select
  // EXACTO (no acumulado "hasta"): una fecha muestra solo lo de ESE día; varias fechas suman solo esos
  // días entre sí — no todo lo anterior. Corregido a pedido del usuario (la primera versión sumaba
  // "hasta" la fecha elegida, arrastrando días previos sin que el usuario lo esperara). Default: hoy.
  const [selectedDatesResumen, setSelectedDatesResumen] = useState<string[]>(() => [format(new Date(), 'yyyy-MM-dd')]);
  const [viewDateResumen, setViewDateResumen] = useState(new Date());
  const [expandedCategorias1000, setExpandedCategorias1000] = useState<string[]>([]);
  const [expandedCategorias2000, setExpandedCategorias2000] = useState<string[]>([]);

  // Llegada desde el botón "Diferir" de Corte Espuma (panel "sobre-ocupado — candidatos a diferir",
  // ver renderDashboard en TacticalPlanEspumasSection.tsx): ese panel es puramente informativo ahí
  // (no mueve ninguna fecha por sí solo), así que en vez de escribir el plan P2 desde otro módulo, se
  // trae al planificador AQUÍ, al tab Plan P2, con la fecha sugerida ya preseleccionada en "Ventana
  // de Producción" — la decisión final (confirmar esa fecha u otra, y regenerar) la sigue tomando el
  // planificador en su propio flujo, igual que cualquier otra generación de P2. Solo se aplica UNA
  // vez al montar (no en cada cambio de searchParams) para no pisar una selección manual posterior.
  const searchParams = useSearchParams();
  useEffect(() => {
    const tab = searchParams.get('tab');
    const fecha = searchParams.get('fecha');
    const material = searchParams.get('material');
    const materiales = searchParams.get('materiales');
    if (tab === 'p2') setActiveTab('planP2');
    const centroParam = searchParams.get('centro');
    if (material && (centroParam === '1000' || centroParam === '2000')) {
      const m = normMaterial(material);
      setMaterialesDiferidos(prev => (prev[centroParam].includes(m) ? prev : { ...prev, [centroParam]: [...prev[centroParam], m] }));
      addNotification('info', `Material ${material} diferido (Centro ${centroParam}): al generar el P2 de Espumas sale del plan de hoy y va al P2 DIFERIDO (PT un día hábil después). Puedes quitarlo en Plan P2.`);
    } else if (material || fecha) {
      addNotification('warning', 'El enlace de Corte Espuma no trae el centro; vuelve a usar "Diferir →".');
    }
    // Vienes de Corte y Laminado ("Exportar TXT" bloqueado, ver handleExportTxt allá): esos
    // materiales necesitan una Respuesta P3 activa que aparezca acá como "completo" antes de que
    // Laminado pueda reintentar la exportación.
    if (tab === 'dataAprobada') {
      setActiveTab('dataAprobada');
      if (materiales) {
        addNotification('info', `Vienes de Corte y Laminado: ${materiales.split(',').length} material(es) sin Respuesta P3 aprobada — ${materiales.split(',').join(', ')}. Revisa su estado acá antes de reintentar el "Exportar TXT".`);
      }
    }
  }, []);

  // Tab "Pendientes": pedidos aún no entregados (getPendientesTotales), con filtro por texto
  // (Pedido/Material) y por rango de Fecha de Entrega, agrupados por Material. Se carga de forma
  // perezosa (solo al abrir el tab por primera vez) por el volumen de registros (+20K).
  const [pendientesTotales, setPendientesTotales] = useState<Record<string, unknown>[]>([]);
  const [isLoadingPendientes, setIsLoadingPendientes] = useState(false);
  const [pendientesCargados, setPendientesCargados] = useState(false);
  const [pendientesSearch, setPendientesSearch] = useState('');
  const [pendientesFechaDesde, setPendientesFechaDesde] = useState('');
  const [pendientesFechaHasta, setPendientesFechaHasta] = useState('');
  const [expandedPendientesMateriales, setExpandedPendientesMateriales] = useState<string[]>([]);

  // Necesidad P2 (Plan de Grupo origen para Laminado/Espumas) — ambas se calculan explotando la
  // lista de materiales de las Órdenes FERT (Provisionales NO aplica para este paso).
  const [necesidadEspumas1000, setNecesidadEspumas1000] = useState<NecesidadMaterial[]>([]);
  const [necesidadEspumas2000, setNecesidadEspumas2000] = useState<NecesidadMaterial[]>([]);
  const [necesidadRollos1000, setNecesidadRollos1000] = useState<NecesidadMaterial[]>([]);
  const [necesidadRollos2000, setNecesidadRollos2000] = useState<NecesidadMaterial[]>([]);
  const [isExplodingBom, setIsExplodingBom] = useState(false);
  const [bomProgress, setBomProgress] = useState({ current: 0, total: 0 });
  // Diagnóstico de la última corrida de "Calcular Necesidad": qué FERT llegaron a explotarse
  // (ya pasaron centro + restricciones + fecha) pero no aportaron ninguna línea de Espuma/Rollo, y
  // cuáles fallaron al consultar el Maestro de Materiales — ver explodeNecesidadesFert.
  const [bomDiagnostico, setBomDiagnostico] = useState<{ sinMatch: string[]; conError: string[] }>({ sinMatch: [], conError: [] });
  const [savingPlanP2, setSavingPlanP2] = useState<Record<string, boolean>>({});
  const [planP2Generado, setPlanP2Generado] = useState<Record<string, number>>({});
  const [isSavingAllPlanP2, setIsSavingAllPlanP2] = useState(false);
  // "PFD - VENTA": vista previa (generarPfdVentaPreview, en memoria, no se cachea entre navegaciones —
  // se recalcula desde cero cada vez que se pulsa "Generar PFD-VENTA", con su propia explosión BOM
  // fresca, ver sección al final del tab "Data Aprobada") y estado de guardado por centro. No depende
  // de haber corrido "Generar Necesidades · BOM FERT" antes — antes sí dependía de un estado
  // (`trazabilidadPT1000/2000`) que solo se llenaba ahí, y si el usuario ya estaba viendo Data
  // Aprobada actualizada sin haber vuelto a pasar por ese botón en la misma sesión, PFD-VENTA no
  // encontraba trazabilidad para nada (reportado por el usuario con datos reales) — ver
  // generarPfdVentaPreview.
  const [pfdVentaPreview, setPfdVentaPreview] = useState<Record<string, PfdVentaPreview>>({});
  // Último preview generado: capturarEstadoPlan corre en el mismo cierre que construirHtml y el
  // estado todavía no refleja el preview recién calculado.
  const ultimoPfdVentaPreview = useRef<Record<string, PfdVentaPreview>>({});
  const [isGeneratingPfdVenta, setIsGeneratingPfdVenta] = useState<Record<string, boolean>>({});
  const [pfdVentaBomProgress, setPfdVentaBomProgress] = useState<Record<string, { current: number; total: number }>>({});
  const [savingPfdVenta, setSavingPfdVenta] = useState<Record<string, boolean>>({});
  const [pfdVentaGenerado, setPfdVentaGenerado] = useState<Record<string, number>>({});
  // Acción única "Generar y Guardar PFD-VENTA" (ver handleGenerarYGuardarPfdVenta): reemplaza los 2
  // clics manuales (Generar PFD-VENTA + Guardar PFD-VENTA) por centro — corre la secuencia completa
  // para Centro 1000 y luego Centro 2000, saltando el que no tenga materiales en Data Aprobada con
  // estado Parcial o Completo.
  const [isRunningPfdVentaSecuencia, setIsRunningPfdVentaSecuencia] = useState(false);

  // Data Aprobada (P3): recupera, por cada P2 propio activo, la respuesta del plan consumidor
  // (P3) — sus DetalleTactico cuyo codigo_plan_grupo_padre apunta a nuestro P2.
  const [dataAprobada, setDataAprobada] = useState<Record<string, DataAprobadaRow[]>>({});
  const [isLoadingDataAprobada, setIsLoadingDataAprobada] = useState(false);
  // Sello de hora del último "Actualizar" exitoso EN ESTA SESIÓN (ver fetchDataAprobada) — a
  // propósito null al restaurar desde caché (leerDeCache, ver el efecto de montaje) y al cargar el
  // módulo por primera vez: "PFD-VENTA" lee de `dataAprobada` en memoria, así que si el usuario nunca
  // pulsó "Actualizar" en esta sesión (o solo tiene lo que quedó cacheado de una visita anterior),
  // ese PFD-VENTA puede estar generándose contra una respuesta de Corte Espuma/Laminado ya vieja sin
  // que se note. Solo alimenta el aviso visible en la sección "PFD-VENTA" (ver más abajo) — no
  // bloquea el botón, decisión explícita del usuario (2026-09-22): "un aviso o warning visible", no
  // una restricción dura.
  const [dataAprobadaFetchedAt, setDataAprobadaFetchedAt] = useState<Date | null>(null);

  // Reporte por correo "Gestión de tiempos y capacidad de Empaque Venta Externa / Muebles" — mismo
  // patrón ya aprobado en Corte Espuma/Corte y Laminado (ver construirReporteHtmlEspuma /
  // construirReporteHtml), pero la fuente es Data Aprobada (respuesta YA VERIFICADA de Corte
  // Espuma/Laminado, estado Parcial/Completo), NO el PFD-VENTA: se puede enviar sin esperar a que se
  // genere/guarde el PFD (confirmado por el usuario — Data Aprobada y PFD-VENTA son pasos
  // independientes, "es indistinto" el orden).
  const [destinatariosReporteEmpaque, setDestinatariosReporteEmpaque] = useState('');

  // Destinatarios del "Enviar Reporte" (Empaque): se precargan desde la restricción
  // Grupo_correos_VentaExterna (mismo patrón que Grupo_correos_Laminado en Corte Espuma/Corte y
  // Laminado) — se espera una fila por centro (codigo_grupo 18=Centro 1000, 19=Centro 2000, ambas ya
  // vienen en `restricciones`, que se carga filtrada a los grupos de este módulo, ver
  // fetchRestricciones). Sigue editable en pantalla — solo autocompleta si el usuario no escribió nada.
  useEffect(() => {
    const correosGrupo = restricciones
      .filter(r => r.nombre_restriccion === 'Grupo_correos_VentaExterna')
      .flatMap(r => String(r.valor_restriccion || '').split(/[,&]/).map(v => v.trim()))
      .filter(Boolean);
    const unicos = Array.from(new Set(correosGrupo));
    if (unicos.length > 0) {
      setDestinatariosReporteEmpaque(prev => prev.trim() ? prev : unicos.join(', '));
    }
  }, [restricciones]);

  // Jornada laboral de Empaque por centro, desde las restricciones HORAS_TRABAJO_DÍA / _NOCHE /
  // _FINDESEMANA, NUM_TURNOS y Paros _Planificados del grupo Venta Externa de ese centro (ver
  // restriccionesCapacidad.ts). Sin restricción: jornada estándar (Día 07:00-15:45, Noche
  // 21:00-05:30, Sábado manual 07:00-13:00).
  const codigoGrupoVentaExternaDe = useCallback(
    // Si el centro tiene varios grupos de Venta Externa, el que tiene más restricciones activas (el
    // que de verdad se configura). Antes se tomaba el primero y, si las restricciones estaban en otro,
    // salían Rendimiento 100%, jornada estándar y "Sin restricción MANTENIMIENTO" (usuario 2026-10-09).
    (centro: '1000' | '2000') => {
      const delCentro = grupos.filter(g => String(g.centro).trim() === centro);
      const activas = (codigo: number) => restricciones.filter(r => r.codigo_grupo === codigo && r.estado === 'A').length;
      return [...delCentro].sort((a, b) => activas(b.codigo_grupo) - activas(a.codigo_grupo))[0]?.codigo_grupo ?? -1;
    },
    [grupos, restricciones]
  );
  const jornadaEmpaquePorCentro = useMemo(() => ({
    '1000': jornadaDesdeRestricciones(restricciones, codigoGrupoVentaExternaDe('1000')),
    '2000': jornadaDesdeRestricciones(restricciones, codigoGrupoVentaExternaDe('2000')),
  }), [restricciones, codigoGrupoVentaExternaDe]);

  // Catálogo de horarios de Empaque (mismos valores que Corte Espuma) + los de la restricción,
  // ordenados de VACÍO a la jornada más larga.
  const shiftOptionsEmpaque = useMemo(() => opcionesConHorarios([
    { v: 'EMPTY', l: 'VACÍO', h: 0 },
    { v: 'H1', l: '07:00 - 15:45', h: 8.75 },
    { v: 'H2', l: '07:00 - 17:00', h: 10 },
    { v: 'H3', l: '07:00 - 18:00', h: 11 },
    { v: 'H4', l: '07:00 - 19:00', h: 12 },
    { v: 'H5', l: '07:00 - 13:00', h: 6 },
  ], [jornadaEmpaquePorCentro['1000'].dia, jornadaEmpaquePorCentro['2000'].dia, jornadaEmpaquePorCentro['1000'].finDeSemana, jornadaEmpaquePorCentro['2000'].finDeSemana, ...jornadaEmpaquePorCentro['1000'].catalogo.dia, ...jornadaEmpaquePorCentro['2000'].catalogo.dia, ...jornadaEmpaquePorCentro['1000'].catalogo.finDeSemana, ...jornadaEmpaquePorCentro['2000'].catalogo.finDeSemana]), [jornadaEmpaquePorCentro]);
  const nightShiftOptionsEmpaque = useMemo(() => opcionesConHorarios([
    { v: 'EMPTY', l: 'VACÍO', h: 0 },
    { v: 'A19', l: '19:00 - 05:30', h: 10.5 },
    { v: 'B21', l: '21:00 - 05:30', h: 8.5 },
  ], [jornadaEmpaquePorCentro['1000'].noche, jornadaEmpaquePorCentro['2000'].noche, ...jornadaEmpaquePorCentro['1000'].catalogo.noche, ...jornadaEmpaquePorCentro['2000'].catalogo.noche]), [jornadaEmpaquePorCentro]);

  // Valores de respaldo: la precarga de abajo los reemplaza al montar con la jornada del grupo.
  const [empaqueConfig, setEmpaqueConfig] = useState<Record<string, EmpaqueShiftConfig>>({
    EMPACADORA_ELECTROTECKS: {
      day: 'H1', night: 'B21', saturday: 'EMPTY',
      paroDay: 0, paroNight: 0, paroSaturday: 0,
      operadoresDay: 4, operadoresNight: 4, operadoresSaturday: 4,
      mttoPreventivoHoras: 0,
      mttoManual: false,
      rendimiento: 100,
      activa: true,
    },
  });

  // Precarga de turnos y paros por máquina de empaque: Día con su horario, Noche solo si
  // NUM_TURNOS ≥ 2, Sábado en VACÍO (manual), paro de los 3 turnos = Paros _Planificados (si existe).
  // Solo se reaplica cuando cambia el valor de la restricción (firma): un ajuste manual no se pisa.
  const firmaJornadaEmpaque = useRef<Record<'1000' | '2000', string>>({ '1000': '', '2000': '' });
  // Config de Empaque cargada desde un reporte guardado (ver restaurarEstadoPlan): al restaurar
  // también cambian las restricciones, y esta precarga la pisaría con la jornada por defecto. Si hay
  // una pendiente, se registra la firma nueva y se vuelve a aplicar la restaurada.
  const empaqueConfigRestaurada = useRef<Record<string, EmpaqueShiftConfig> | null>(null);
  useEffect(() => {
    const restaurada = empaqueConfigRestaurada.current;
    (['1000', '2000'] as const).forEach(centro => {
      if (restaurada) {
        const jornada = jornadaEmpaquePorCentro[centro];
        const paro = porcentajeRestriccion(restricciones, codigoGrupoVentaExternaDe(centro), RESTRICCION_CAPACIDAD.parosPlanificados);
        const rendimientos = EMPAQUE_MACHINES_BY_CENTRO[centro].map(m => porcentajeRestriccion(restricciones, codigoGrupoVentaExternaDe(centro), m.restriccionRendimiento));
        firmaJornadaEmpaque.current[centro] = JSON.stringify([jornada, paro, rendimientos]);
        return;
      }
      const jornada = jornadaEmpaquePorCentro[centro];
      const paro = porcentajeRestriccion(restricciones, codigoGrupoVentaExternaDe(centro), RESTRICCION_CAPACIDAD.parosPlanificados);
      const rendimientos = EMPAQUE_MACHINES_BY_CENTRO[centro].map(m => porcentajeRestriccion(restricciones, codigoGrupoVentaExternaDe(centro), m.restriccionRendimiento));
      const firma = JSON.stringify([jornada, paro, rendimientos]);
      if (firma === firmaJornadaEmpaque.current[centro]) return;
      firmaJornadaEmpaque.current[centro] = firma;
      const day = claveDeHorario(shiftOptionsEmpaque, jornada.dia);
      const night = jornada.numTurnos >= 2 ? claveDeHorario(nightShiftOptionsEmpaque, jornada.noche) : 'EMPTY';
      setEmpaqueConfig(prev => {
        const next = { ...prev };
        EMPAQUE_MACHINES_BY_CENTRO[centro].forEach((m, i) => {
          if (!next[m.id]) return;
          next[m.id] = {
            ...next[m.id],
            day, night, saturday: 'EMPTY',
            ...(paro !== null ? { paroDay: paro, paroNight: paro, paroSaturday: paro } : {}),
            ...(rendimientos[i] !== null ? { rendimiento: rendimientos[i]! } : {}),
          };
        });
        return next;
      });
    });
    if (restaurada) {
      empaqueConfigRestaurada.current = null;
      setEmpaqueConfig(restaurada);
    }
  }, [jornadaEmpaquePorCentro, restricciones, codigoGrupoVentaExternaDe, shiftOptionsEmpaque, nightShiftOptionsEmpaque]);

  // Calendario "abierto": sin tope de rango entre la fecha más antigua y la más nueva seleccionada
  // (antes limitado a 3 días). El usuario confirmó liberar esta restricción a propósito — el filtro
  // también sirve para seleccionar una fecha fuera de la ventana operativa normal, para evaluación de
  // tiempo/what-if, no solo para el rango real hoy+1..hoy+3.
  const toggleSelectedDate = (dateStr: string) => {
    setSelectedDates(prev => (
      prev.includes(dateStr) ? prev.filter(d => d !== dateStr) : [...prev, dateStr]
    ));
  };

  const toggleSelectedDateResumen = (dateStr: string) => {
    setSelectedDatesResumen(prev => (
      prev.includes(dateStr) ? prev.filter(d => d !== dateStr) : [...prev, dateStr]
    ));
  };

  useEffect(() => { setMounted(true); }, []);

  const fetchGrupos = async () => {
    try {
      const res = await grupoService.getAll();
      const filtered = (res.data || []).filter(g => 
        g.nombre_grupo && (g.nombre_grupo.toLowerCase().includes('venta externa') || g.nombre_grupo.toLowerCase().includes('ventaexterna'))
      );
      setGrupos(filtered);
      return filtered;
    } catch (error) {
      console.error('Error cargando grupos:', error);
      return [];
    }
  };

  const fetchRestricciones = async (gruposIds: number[]) => {
    try {
      const res = await restriccionService.getAll();
      const filtered = (res.data || []).filter(r => gruposIds.includes(r.codigo_grupo));
      setRestricciones(filtered);
      return filtered;
    } catch (error) {
      console.error('Error cargando restricciones:', error);
      return [];
    }
  };

  const fetchOrdenes = async (onConsulta?: (nombre: string, ok: boolean) => void) => {
    try {
      const pProv = sapCompartido.ordenesProvisionales().then(
        r => { onConsulta?.('Órdenes provisionales', true); return r; },
        () => { onConsulta?.('Órdenes provisionales', false); return { data: [] }; }
      );
      const pFert = sapCompartido.ordenesFert().then(
        r => { onConsulta?.('Órdenes FERT', true); return r; },
        () => { onConsulta?.('Órdenes FERT', false); return { data: [] }; }
      );
      
      const [resProv, resFert] = await Promise.all([pProv, pFert]);
      
      setOrders(resProv.data || []);
      setOrdersFert(resFert.data || []);
      return { ordenes: resProv.data || [], ordenesFert: resFert.data || [] };
    } catch (error) {
      console.error('Error cargando órdenes:', error);
      return { ordenes: [], ordenesFert: [] };
    }
  };

  const fetchTiemposEnsamblado = async (filteredGroups: Grupo[]) => {
    try {
      // Grupos en paralelo (antes uno tras otro) y por la caché compartida (sapCompartido).
      const porGrupo = await Promise.all(filteredGroups.filter(g => g.centro).map(async g => {
        try {
          const res = await sapCompartido.tiemposEnsambladoPR2(String(g.centro), g.codigo_grupo);
          const actualData = res.data?.data || res.data || [];
          // Centro del grupo pedido si la fila no lo trae (tiemposPorCentro filtra por él).
          return Array.isArray(actualData) ? actualData.map((t: Record<string, unknown>) => (t.CENTRO || t.Centro || t.centro ? t : { ...t, Centro: String(g.centro) })) : [];
        } catch {
          console.warn(`Error cargando tiempos para grupo ${g.codigo_grupo}`);
          return [];
        }
      }));
      const allTiempos: Record<string, unknown>[] = porGrupo.flat();
      setTiemposEnsamblado(allTiempos);
      return allTiempos;
    } catch (error) {
      console.error('Error cargando tiempos:', error);
      return [];
    }
  };

  // Sincronización manual: se dispara con el botón "Sincronizar" del encabezado, no al abrir el
  // módulo — mismo criterio que Corte Espuma (ver [[carga_manual_modulos_tacticos]]). Entrar a mirar
  // no debe costar 4 llamadas pesadas a SAP (Provisionales/FERT ~20K filas cada una) cada vez.
  // Antes de tocar SAP, el panel pide la "Ventana de Producción" (desde/hasta) — que acá ya era un
  // paso obligatorio para generar — y muestra para qué fecha se graba cada P2. Luego: Ventana →
  // Datos (x/5) → Necesidad BOM → Generar P2 (x/3); las dos últimas corren en sus efectos.
  // Pestañas-paso (usuario 2026-10-12, ver [[flujo-dos-etapas]]): Sincronizar ya NO graba el P2 —
  // termina en Necesidad BOM y el panel ofrece "1 · Generar P2" o, si el P2 de hoy ya existe,
  // continuar en Data Aprobada (antes generaba el P2 solo, y al volver en la tarde a cerrar el ciclo
  // lo regeneraba encima del que Laminado/Corte Espuma ya habían respondido).
  const ejecutarSincronizacion = useCallback(async (desde: string, hasta: string, noLaborables: DiasNoLaborables, laborablesExtra: DiasNoLaborables) => {
    refrescarAlSincronizar(); // FERT y provisionales siempre frescas; cubo (día) y MTTO (semana) se reusan
    setIsLoading(true);
    setSyncStep('sincronizando');
    const fechas = eachDayOfInterval({ start: parseISO(desde), end: parseISO(hasta) }).map(d => format(d, 'yyyy-MM-dd'));
    setSelectedDates(fechas);
    setPlanCargadoDe(null);
    setResultadoRestaurado(null);
    empaqueConfigRestaurada.current = null;
    setViewDate(parseISO(desde));
    const corta = (f: string) => format(parseISO(f), 'EEE dd/MM', { locale: es });
    panelProgreso.iniciar('Venta Externa — Sincronizar', [
      { id: 'fecha', etiqueta: desde === hasta ? `PT (producción y empaque): ${corta(desde)}` : `PT: ${corta(desde)} → ${corta(hasta)}` },
      { id: 'datos', etiqueta: 'Sincronizando datos' },
      { id: 'bom', etiqueta: 'Necesidad BOM (FERT)' },
      { id: 'p2', etiqueta: 'P2 Espumas / Rollos' },
    ]);
    panelProgreso.actualizar('fecha', { estado: 'ok' });
    const TOTAL_CONSULTAS = 8;
    let hechas = 0;
    const fallidas: string[] = [];
    const contar = (nombre: string, ok: boolean) => {
      hechas += 1;
      if (!ok) fallidas.push(nombre);
      panelProgreso.actualizar('datos', { progreso: { actual: hechas, total: TOTAL_CONSULTAS } });
    };
    panelProgreso.actualizar('datos', { estado: 'en_curso', progreso: { actual: 0, total: TOTAL_CONSULTAS } });
    try {
      const groups = await fetchGrupos();
      contar('Grupos', groups.length > 0);
      const ids = groups.map(g => g.codigo_grupo);
      const [restrs, ordenesRes, tiempos, mttos, carruseles, habilidades] = await Promise.all([
        fetchRestricciones(ids).then(r => { contar('Restricciones', true); return r; }),
        fetchOrdenes(contar),
        fetchTiemposEnsamblado(groups).then(r => { contar('Tiempos de ensamblado', true); return r; }),
        sapCompartido.mantenimientosPreventivos().then(
          r => { contar('Mantenimientos', true); return (Array.isArray(r.data) ? r.data : r.data?.data || []) as Record<string, unknown>[]; },
          () => { contar('Mantenimientos', false); return [] as Record<string, unknown>[]; }
        ),
        // Respaldo del tiempo de empaque (usuario 2026-10-09, ver tiempoLookup): misma descarga
        // compartida que Corte Espuma; solo se guarda Material/Centro/TiempoCorte de 1000/2000.
        sapCompartido.kpiMaestroCarruseles().then(
          r => { contar('KPI Carruseles', true); return reducirCarruseles((Array.isArray(r.data) ? r.data : r.data?.data || []) as Record<string, unknown>[]); },
          () => { contar('KPI Carruseles', false); return [] as Record<string, unknown>[]; }
        ),
        // Personal por habilidades para asignar operadores de Empaque (misma descarga compartida
        // que Corte Espuma y Laminado).
        sapCompartido.cuboHabilidadesOP().then(
          r => { contar('Habilidades de operadores', true); return reducirHabilidades((Array.isArray(r.data) ? r.data : r.data?.data || []) as Record<string, unknown>[]); },
          () => { contar('Habilidades de operadores', false); return [] as OperadorHabilidad[]; }
        ),
      ]);
      setMantenimientosSAP(mttos);
      setKpiCarruseles(carruseles);
      setHabilidadesOP(habilidades);
      panelProgreso.actualizar('datos', {
        estado: fallidas.length > 0 ? 'aviso' : 'ok',
        detalle: fallidas.length > 0 ? `Sin respuesta: ${fallidas.join(', ')} — se siguió con datos vacíos.` : undefined,
      });
      setDiasNoLaborables(noLaborables);
      setDiasLaborablesExtra(laborablesExtra);
      setDatosCargados(true);
      guardarEnCache<SnapshotVentaExterna>(CACHE_VENTA_EXTERNA, {
        grupos: groups,
        restricciones: restrs,
        ordenes: ordenesRes.ordenes,
        ordenesFert: ordenesRes.ordenesFert,
        tiemposEnsamblado: tiempos,
        mantenimientosSAP: mttos,
        kpiCarruseles: carruseles,
        habilidadesOP: habilidades,
        diasNoLaborables: [...noLaborables],
        diasLaborablesExtra: [...laborablesExtra],
        // Data Aprobada y la Necesidad BOM se sincronizan aparte (ver fetchDataAprobada y
        // handleCalcularNecesidadRollos) — acá se preserva lo que ya hubiera, en vez de resetearlo,
        // por si el usuario vuelve a sincronizar sin haber navegado fuera del módulo.
        dataAprobada,
        necesidadEspumas1000,
        necesidadEspumas2000,
        necesidadRollos1000,
        necesidadRollos2000,
      });
      // No se llama handleCalcularNecesidadRollos() directo acá: leería fertC1000ParaP2/
      // fertC2000ParaP2 (useMemo derivados del estado que se acaba de actualizar arriba) por closure
      // vieja. Se dispara desde el efecto de más abajo, que ve la versión fresca una vez que el
      // siguiente render ya ocurrió (mismo criterio que Corte y Laminado/Corte Espuma).
      setAutoGenerarPendiente(true);
    } catch (e) {
      panelProgreso.actualizar('datos', { estado: 'error', detalle: (e as Error).message });
      panelProgreso.actualizar('bom', { estado: 'omitido' });
      panelProgreso.actualizar('p2', { estado: 'omitido' });
      panelProgreso.concluir(`Error al sincronizar: ${(e as Error).message}`);
      setSyncStep('idle');
    } finally {
      setIsLoading(false);
    }
  }, [dataAprobada, necesidadEspumas1000, necesidadEspumas2000, necesidadRollos1000, necesidadRollos2000, panelProgreso]);

  // Cuadro previo a Sincronizar: el PT es FIJO (hoy+2 hábiles, decisión del usuario 2026-10-02 —
  // antes se elegía un rango libre y el P2 quedaba con la fecha que se marcara). Se muestra para
  // confirmar, igual que Corte Espuma. Única excepción: el PT diferido que llega desde Corte Espuma.
  const preparacionVentana = useCallback((noLaborables: DiasNoLaborables, laborablesExtra: DiasNoLaborables) => {
    const { pt } = fechasHorizonteDe(noLaborables, laborablesExtra);
    const ptPlan = pt;
    const extra = laborablesHorizonte(laborablesExtra);
    const larga = (f: string) => format(parseISO(f), 'EEE dd/MM/yyyy', { locale: es });
    return {
      fechaInicial: ptPlan,
      fija: true,
      detalle: () => [
        { etiqueta: 'Se planifica', valor: larga(format(new Date(), 'yyyy-MM-dd')) },
        { etiqueta: 'Recuperación Corte / Laminado (P2)', valor: larga(format(addBusinessDaysCal(parseISO(ptPlan), -1, noLaborables, extra), 'yyyy-MM-dd')) },
        { etiqueta: 'Producción PT · Órdenes FERT del', valor: larga(ptPlan) },
        { etiqueta: 'Empaque (reporte)', valor: larga(pt) },
      ],
      aviso: () => esDiaNoLaborable(parseISO(ptPlan), noLaborables, laborablesExtra) ? 'El PT cae en día no laborable; puede no haber órdenes.' : null,
    };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const handleSincronizarYGenerar = useCallback(async () => {
    let noLaborables: DiasNoLaborables;
    let laborablesExtra: DiasNoLaborables;
    try {
      ({ noLaborables, laborablesExtra } = await cargarDiasNoLaborables());
    } catch (e) {
      addNotification('error', `No se pudo cargar el calendario laboral: ${(e as Error).message}`);
      return;
    }
    panelProgreso.pedirFecha({
      titulo: 'Venta Externa — Sincronizar',
      ...preparacionVentana(noLaborables, laborablesExtra),
      onConfirmar: (pt) => {
        if (pt) void ejecutarSincronizacion(pt, pt, noLaborables, laborablesExtra);
      },
    });
  }, [preparacionVentana, panelProgreso, ejecutarSincronizacion, addNotification]);


  // Rehidratación: si ya se había sincronizado en esta sesión, se recupera lo trabajado en vez de
  // dejar el módulo vacío al volver de otro módulo (ver @/lib/cache-modulos). Incluye Data Aprobada
  // (ver fetchDataAprobada) — antes solo se restauraban los datos crudos, así que ese tab volvía
  // vacío tras navegar a otro módulo hasta pulsar "Actualizar" de nuevo.
  useEffect(() => {
    if (!mounted) return;
    const snap = leerDeCache<SnapshotVentaExterna>(CACHE_VENTA_EXTERNA);
    if (snap) {
      setGrupos(snap.grupos);
      setRestricciones(snap.restricciones);
      setOrders(snap.ordenes);
      setOrdersFert(snap.ordenesFert);
      setTiemposEnsamblado(snap.tiemposEnsamblado);
      setMantenimientosSAP(snap.mantenimientosSAP || []);
      setKpiCarruseles(snap.kpiCarruseles || []);
      setHabilidadesOP(snap.habilidadesOP || []);
      setDiasNoLaborables(new Set(snap.diasNoLaborables));
      setDiasLaborablesExtra(new Set(snap.diasLaborablesExtra || []));
      setDataAprobada(snap.dataAprobada || {});
      setNecesidadEspumas1000(snap.necesidadEspumas1000 || []);
      setNecesidadEspumas2000(snap.necesidadEspumas2000 || []);
      setNecesidadRollos1000(snap.necesidadRollos1000 || []);
      setNecesidadRollos2000(snap.necesidadRollos2000 || []);
      setDatosCargados(true);
    }
  }, [mounted]);

  const fetchPendientesTotales = useCallback(async () => {
    setIsLoadingPendientes(true);
    try {
      const res = await sapCompartido.pendientesTotales();
      setPendientesTotales(res.data || []);
    } catch (error) {
      console.error('Error cargando pendientes:', error);
    } finally {
      setIsLoadingPendientes(false);
      setPendientesCargados(true);
    }
  }, []);

  // Carga perezosa: solo trae los +20K registros de Pendientes la primera vez que se abre el tab, y
  // solo si ya se sincronizó lo base — abrir el tab sin datos no debe disparar esta consulta sola.
  useEffect(() => {
    if (datosCargados && activeTab === 'pendientes' && !pendientesCargados && !isLoadingPendientes) {
      fetchPendientesTotales();
    }
  }, [datosCargados, activeTab, pendientesCargados, isLoadingPendientes, fetchPendientesTotales]);

  // Días con datos para el punto/resalte del calendario "Fecha" — compartido entre los tabs
  // Provisionales y FERT, así que debe incluir fechas de AMBAS fuentes (antes solo miraba
  // ordenesFert: un día con órdenes Provisionales pero sin FERT aparecía apagado, como si no tuviera
  // datos, cuando trabajabas en el tab de Provisionales).
  const datesWithOrders = useMemo(() => {
    const dates = new Set<string>();
    [...ordenesFert, ...ordenes].forEach(o => {
      // Mismo criterio que filterData: FECHAFIN si existe (Provisionales), si no FECHA/FECHAINICIO
      // (FERT) — el punto del calendario debe marcar el mismo día que realmente hace match al filtrar.
      const d = String(o.FECHAFIN || o.FECHA || o.FECHAINICIO || '').trim();
      if (d && d !== 'null' && d !== 'undefined') {
        const normalized = d.includes('T') ? d.split('T')[0] : d;
        dates.add(normalized);
      }
    });
    return dates;
  }, [ordenesFert, ordenes]);

  const calendarDays = useMemo(() => {
    const start = startOfMonth(viewDate);
    const end = endOfMonth(viewDate);
    const days = eachDayOfInterval({ start, end });
    const startDay = getDay(start);
    const padding = startDay === 0 ? 6 : startDay - 1;
    return [...Array(padding).fill(null), ...days];
  }, [viewDate]);

  // Mismo cálculo que calendarDays, pero para el selector propio de "Resumen Necesidades"
  // (selectedDatesResumen) — mes de navegación independiente del de "Ventana de Producción".
  const calendarDaysResumen = useMemo(() => {
    const start = startOfMonth(viewDateResumen);
    const end = endOfMonth(viewDateResumen);
    const days = eachDayOfInterval({ start, end });
    const startDay = getDay(start);
    const padding = startDay === 0 ? 6 : startDay - 1;
    return [...Array(padding).fill(null), ...days];
  }, [viewDateResumen]);

  const extractMaterialInfo = (item: Record<string, unknown>) => {
    const matStr = String(item.MATERIAL || item.Material || item.CodMaterial || '').trim();
    const nameStr = String(item.NOMBRE || item.NombreMaterial || item.Descripcion || '').trim();
    const catStr = String(item.CATEGORIA || item.Categoria || '').trim();
    
    const match = matStr.match(/^(\d+)/);
    const code = match ? match[1].slice(-8) : matStr.slice(-8);
    const desc = nameStr || matStr.replace(/^\d+\s*/, '') || '—';

    const dimensions: { dens: string; ancho: string; largo: string; esp: string; tipo: string } = { dens: '—', ancho: '—', largo: '—', esp: '—', tipo: '—' };
    
    const techPatternMatch = catStr.match(/D(\d+)([a-zA-Z]+)/i);
    if (techPatternMatch) {
      dimensions.dens = techPatternMatch[1]; 
      dimensions.tipo = techPatternMatch[2].toUpperCase(); 
    } else {
      const densMatch = desc.match(/D-?(\d+)/i);
      if (densMatch) dimensions.dens = densMatch[1];
      const tipoMatch = desc.match(/D-?\d+([a-zA-Z]+)/i);
      if (tipoMatch) dimensions.tipo = tipoMatch[1].toUpperCase();
    }

    const dimMatch = desc.match(/(\d+(?:\.\d+)?)\s*[xX*]\s*(\d+(?:\.\d+)?)(?:\s*[xX*]\s*(\d+(?:\.\d+)?))?/);
    if (dimMatch) {
      dimensions.ancho = dimMatch[1];
      dimensions.largo = dimMatch[2];
      if (dimMatch[3]) dimensions.esp = dimMatch[3];
    }
    
    return { code, desc, ...dimensions };
  };

  const filterData = (data: Record<string, unknown>[], centro: string, applyDateFilter: boolean = true, dateOverride?: string[]) => {
    const relevantGroups = grupos.filter(g => String(g.centro).trim() === centro);
    if (relevantGroups.length === 0) return [];
    
    const groupIds = relevantGroups.map(g => g.codigo_grupo);
    const groupRest = restricciones.filter(r => groupIds.includes(r.codigo_grupo));

    // Comparación insensible a mayúsculas/minúsculas: verificado con datos reales que la restricción
    // de Venta Externa Centro 1000 se guardó como nombre_restriccion="RespCtrlProd" (no "RESPCTRLPROD"
    // exacto) — con comparación exacta, respCodes quedaba vacío y el filtro de responsable no
    // aplicaba nada, dejando pasar cualquier responsable sin que nadie lo notara.
    const nombreRestriccion = (r: Restriccion) => String(r.nombre_restriccion || '').trim().toUpperCase();

    const respCodes = groupRest
      .filter(r => nombreRestriccion(r) === 'RESPCTRLPROD')
      .flatMap(r => r.valor_restriccion.split(/[,&]/).map(v => v.trim()))
      .filter(v => v !== '');

    const almCodes = groupRest
      .filter(r => nombreRestriccion(r) === 'ALMACEN')
      .flatMap(r => r.valor_restriccion.split(/[,&]/).map(v => v.trim()))
      .filter(v => v !== '');

    const sectorCodes = groupRest
      .filter(r => nombreRestriccion(r) === 'SECTOR')
      .flatMap(r => r.valor_restriccion.split(/[,&]/).map(v => v.trim()))
      .filter(v => v !== '');

    return data.filter(o => {
      const itemCentro = String(o.CENTRO || o.Centro || o.centro || '').trim();
      if (itemCentro !== centro) return false;
      
      const itemResp = String(o.RESPCTRLPROD || o.RESPCONTROLPROD || o.RespCtrlProd || o.RespControlProd || '').trim();
      const matchResp = respCodes.length === 0 || respCodes.some(code => itemResp === code || itemResp.includes(code));
      
      const itemAlmValue = String(o.ALMACEN || o.Almacen || o.almacen || '').trim();
      const matchAlm = almCodes.length === 0 || itemAlmValue === '' || almCodes.includes(itemAlmValue);
      
      const itemSectorValue = String(o.SECTORDESC || o.Sector || o.SECTOR || '').trim();
      const matchSector = sectorCodes.length === 0 || itemSectorValue === '' || sectorCodes.some(code => itemSectorValue.includes(code));


      if (applyDateFilter) {
        const fechas = dateOverride ?? selectedDates;
        const soloFechaStr = (v: unknown) => {
          const s = String(v ?? '').trim();
          return s.includes('T') ? s.split('T')[0] : s;
        };
        const itemInicio = soloFechaStr(o.FECHA || o.FECHAINICIO);
        const itemFin = soloFechaStr(o.FECHAFIN);
        // Provisionales trae FECHAINICIO (constante en el dato real — no diferencia por orden, no
        // sirve para filtrar) y FECHAFIN (sí varía por orden, es la fecha real de vencimiento). Se
        // probó FECHAFIN >= fecha seleccionada (mostrar la cola completa hacia adelante), pero el
        // usuario lo rechazó explícitamente: necesita que sea rastreable 1:1 con la selección — si
        // eliges el 12 de agosto, ves SOLO lo que vence exactamente el 12, nada antes ni después. Si
        // la orden no trae FECHAFIN (caso FERT), se mantiene la misma coincidencia exacta contra
        // FECHA/FECHAINICIO de siempre.
        const matchDate = fechas.length === 0
          ? true
          : itemFin
            ? fechas.includes(itemFin)
            : fechas.includes(itemInicio);
        return matchResp && matchAlm && matchSector && matchDate;
      }

      return matchResp && matchAlm && matchSector;
    });
  };

  const provC1000 = useMemo(() => filterData(ordenes, '1000'), [ordenes, grupos, restricciones, selectedDates]);
  const provC2000 = useMemo(() => filterData(ordenes, '2000'), [ordenes, grupos, restricciones, selectedDates]);

  // Fuente de datos para GENERAR el P2 (cambio de fondo pedido por el usuario, revierte el criterio
  // anterior "P2 sale de Provisionales, FERT queda fuera"): ahora el P2 se explota desde Órdenes FERT
  // en vez de Provisionales — mismo `filterData` (centro + RESPCTRLPROD/ALMACEN/SECTOR + fecha), que
  // ya sabía manejar la forma de FERT (sin FECHAFIN, cae a coincidencia exacta contra FECHA — ver el
  // comentario dentro de filterData). SECTOR, que en Provisionales no filtraba nada porque el campo no
  // existe ahí, en FERT SÍ tiene datos reales — verificar que no repita el bug de mayúsculas de
  // RESPCTRLPROD si aparecen materiales excluidos sin explicación. `provC1000`/`provC2000` NO se
  // tocan: siguen alimentando el tab "Provisionales", que ahora es solo de referencia (igual que FERT
  // lo era antes de este cambio).
  const fertC1000ParaP2 = useMemo(() => filterData(ordenesFert, '1000'), [ordenesFert, grupos, restricciones, selectedDates]);
  const fertC2000ParaP2 = useMemo(() => filterData(ordenesFert, '2000'), [ordenesFert, grupos, restricciones, selectedDates]);

  // TEMPORAL — diagnóstico para confirmar si la restricción RESPCTRLPROD/ALMACEN realmente excluye
  // algo en Provisionales Centro 1000, o si simplemente TODA la data ya comparte el mismo valor (y
  // por eso "parece" que no filtra nada). Compara el total de Centro 1000 (sin restricción) contra
  // el total ya filtrado (provC1000) y lista los valores distintos de RESPCONTROLPROD/ALMACEN vistos.
  useEffect(() => {
    if (ordenes.length === 0) return;
    const soloCentro1000 = ordenes.filter(o => String(o.CENTRO || o.Centro || o.centro || '').trim() === '1000');
    const respsDistintos = new Set(soloCentro1000.map(o => String(o.RESPCTRLPROD || o.RESPCONTROLPROD || o.RespCtrlProd || o.RespControlProd || '').trim()));
    const almsDistintos = new Set(soloCentro1000.map(o => String(o.ALMACEN || o.Almacen || o.almacen || '').trim()));
    console.log('[DEBUG Provisionales] Centro 1000 sin restricción:', soloCentro1000.length, '| con restricción (provC1000):', provC1000.length);
    console.log('[DEBUG Provisionales] Valores RESPCTRLPROD distintos en Centro 1000:', Array.from(respsDistintos));
    console.log('[DEBUG Provisionales] Valores ALMACEN distintos en Centro 1000:', Array.from(almsDistintos));
  }, [ordenes, provC1000]);
  // (Se eliminaron fertC1000/fertC2000, las FERT filtradas por el selector "Fecha": eran las únicas
  //  consumidoras del selector en el lado FERT y alimentaban "Resumen Necesidades", que ahora usa su
  //  propio selector — ver fertC1000Resumen más abajo. El selector "Fecha" quedó como exclusivo de
  //  Provisionales, que es lo que se había decidido.)

  // Tab "Órdenes FERT": ya NO se filtra por el selector "Fecha" (a diferencia de fertC1000/fertC2000
  // de arriba, que siguen date-filtradas porque alimentan las tarjetas de "Resumen Necesidades",
  // summaryData1000/2000 — eso no se tocó). El selector "Fecha" ahora es específico de Provisionales;
  // FERT queda como tab de referencia/comparación, solo con las restricciones de Venta Externa
  // (RESPCTRLPROD/ALMACEN/SECTOR) aplicadas, mostrando todas las fechas a la vez.
  const fertC1000SinFecha = useMemo(() => filterData(ordenesFert, '1000', false), [ordenesFert, grupos, restricciones]);
  const fertC2000SinFecha = useMemo(() => filterData(ordenesFert, '2000', false), [ordenesFert, grupos, restricciones]);

  // "Resumen Necesidades": Órdenes FERT fechadas EXACTO en alguna de las fechas elegidas — vista de
  // "lo ya ejecutado/comprometido" (carga operativa, no necesidad futura), sin cambios por el giro a
  // FERT en la generación del P2 (ver fertC1000ParaP2 más arriba): ese cálculo usa FERT de la fecha
  // SELECCIONADA en "Ventana de Producción" (pasada o futura), mientras que ESTE resumen usa
  // `selectedDatesResumen` (su propio selector, ver más abajo) — son dos ventanas de fecha distintas
  // sobre la misma fuente (FERT), no hay que confundirlas. Match EXACTO por fecha, no acumulado: una
  // fecha = solo ese día; varias fechas = la suma de esos días entre sí, nunca arrastra días previos
  // no elegidos (corregido a pedido del usuario, la primera versión sí acumulaba "hasta" la fecha).
  const soloFertFechasResumen = (data: Record<string, unknown>[]) => data.filter(o => {
    const fecha = String(o.FECHA || o.Fecha || '').split('T')[0];
    return fecha && selectedDatesResumen.includes(fecha);
  });
  const fertC1000Resumen = useMemo(() => soloFertFechasResumen(filterData(ordenesFert, '1000', false)), [ordenesFert, grupos, restricciones, selectedDatesResumen]);
  const fertC2000Resumen = useMemo(() => soloFertFechasResumen(filterData(ordenesFert, '2000', false)), [ordenesFert, grupos, restricciones, selectedDatesResumen]);

  // Ventana informativa de selección (Espumas/Rollos): resume selectedDates en {inicio, fin, fechas}
  // para mostrar en la UI ("Ventana de Producción") y en el mensaje de resultado — ya no se usa para
  // filtrar Provisionales (provC1000/provC2000 filtran directo por FECHAFIN vía filterData, ver ahí).
  // Sin tope de amplitud (antes MAX_DIAS_SELECCION limitaba a 3 días) — el calendario quedó "abierto"
  // a propósito, para poder seleccionar una fecha fuera de la ventana operativa normal como evaluación
  // de tiempo/what-if, no solo el rango real hoy+1..hoy+3.
  const ventanaP2 = useMemo(() => {
    if (selectedDates.length === 0) return { inicio: '', fin: '', fechas: [] as string[] };
    const ordenadas = [...selectedDates].sort();
    const inicio = ordenadas[0];
    const fin = ordenadas[ordenadas.length - 1];
    const fechas = eachDayOfInterval({ start: parseISO(inicio), end: parseISO(fin) }).map(d => format(d, 'yyyy-MM-dd'));
    return { inicio, fin, fechas };
  }, [selectedDates]);
  // Tiempos de ensamblado: SOLO por centro (2026-10-08). Antes pasaban por filterData, que además
  // filtra por responsable/almacén/sector de las ÓRDENES: las filas de tiempos no traen responsable,
  // así que desde que la restricción RespCtrlProd se lee sin distinguir mayúsculas se descartaban
  // todas y cada material caía en PACKING_TIME_PER_UNIT_SECONDS (15 s/und) — caso del usuario:
  // 20003095 D17 100X200X2, 300 und = 1.25 h, cuando lo reportado es 360 und = 0.127 h. Ya vienen
  // pedidos por los grupos de Venta Externa (fetchTiemposEnsamblado), no hace falta otro filtro.
  const tiemposPorCentro = (centro: string) => tiemposEnsamblado.filter(t => String(t.CENTRO || t.Centro || t.centro || '').trim() === centro);
  const tiemposC1000 = useMemo(() => tiemposPorCentro('1000'), [tiemposEnsamblado]); // eslint-disable-line react-hooks/exhaustive-deps
  const tiemposC2000 = useMemo(() => tiemposPorCentro('2000'), [tiemposEnsamblado]); // eslint-disable-line react-hooks/exhaustive-deps

  // Lookup de tiempos estándar por material+centro para match en Provisionales/FERT
  const buildTiempoLookup = (tiempos: Record<string, unknown>[]) => {
    const map = new Map<string, Record<string, unknown>[]>();
    tiempos.forEach(t => {
      const info = extractMaterialInfo(t);
      if (!map.has(info.code)) map.set(info.code, []);
      map.get(info.code)!.push(t);
    });
    return map;
  };
  // Respaldo (usuario 2026-10-09): el PR2 de los grupos de Venta Externa no trae los PT de Empaque
  // (20003095 caía en 15 s/und). El dato real está en KPIMaestroCarruseles: TiempoCorte en SEGUNDOS
  // por unidad (20003095 = 1.27 s → 300 und = 0.106 h). Solo para materiales sin fila en el PR2; se
  // agrega como fila Tiempo_Min = TiempoCorte / 60, así matchTiempoEstandar no cambia.
  const conRespaldoCarruseles = (lookup: Map<string, Record<string, unknown>[]>, centro: string) => {
    kpiCarruseles.forEach(c => {
      if (String(c.Centro ?? '').trim() !== centro) return;
      const code = extractMaterialInfo(c).code;
      const seg = Number(String(c.TiempoCorte ?? '').replace(',', '.')) || 0;
      if (!code || seg <= 0 || lookup.has(code)) return;
      lookup.set(code, [{ CodMaterial: code, Centro: centro, Tiempo_Min: seg / 60, Fuente: 'KPIMaestroCarruseles' }]);
    });
    return lookup;
  };
  const tiempoLookup1000 = useMemo(() => conRespaldoCarruseles(buildTiempoLookup(tiemposC1000), '1000'), [tiemposC1000, kpiCarruseles]); // eslint-disable-line react-hooks/exhaustive-deps
  const tiempoLookup2000 = useMemo(() => conRespaldoCarruseles(buildTiempoLookup(tiemposC2000), '2000'), [tiemposC2000, kpiCarruseles]); // eslint-disable-line react-hooks/exhaustive-deps

  const matchTiempoEstandar = (materialCode: string, maquina: string, lookup: Map<string, Record<string, unknown>[]>) => {
    const candidates = lookup.get(materialCode);
    if (!candidates || candidates.length === 0) return null;
    // Minutos por unidad de una fila: Tiempo_Min / Tiempo; si la fila trae el tiempo reportado en
    // HORAS para una cantidad (TiempoPlastificado + Cantidad, ej. 360 und = 0.127 h), se divide.
    // Acepta texto con coma decimal ("0,0212"): Number() lo daba NaN y caía en 15 s/und.
    const num = (v: unknown) => Number(String(v ?? '').trim().replace(',', '.')) || 0;
    const minPorUnidad = (t: Record<string, unknown>): number | null => {
      const min = num(t.Tiempo_Min) || num(t.Tiempo);
      if (min > 0) return min;
      const horas = num(t.TiempoPlastificado);
      const cant = num(t.Cantidad);
      return horas > 0 && cant > 0 ? (horas * 60) / cant : null;
    };
    const maq = String(maquina).trim().toUpperCase();
    // Filas de tiemposEnsambladoByGrupoYCentroPR2: CodMaterial, PuestoTrabajo, PuestoTrabajoLinea, Tiempo_Min.
    const byMaquina = maq ? candidates.find(t => minPorUnidad(t) !== null
      && [t.Linea, t.PuestoTrabajoLinea, t.PuestoTrabajo, t.Maquina].some(v => String(v || '').trim().toUpperCase() === maq)) : undefined;
    const match = byMaquina || candidates.find(t => minPorUnidad(t) !== null);
    return match ? minPorUnidad(match) : null;
  };

  // Línea de producción real (ej. "Carruseles - LINEA 1") para poblar linea_produccion al grabar
  // DetalleTactico — mismo lookup que matchTiempoEstandar, sin filtrar por máquina (un material
  // puede repetirse en varios puestos; se toma el primero).
  const matchLineaProduccion = (materialCode: string, lookup: Map<string, Record<string, unknown>[]>) => {
    const candidates = lookup.get(materialCode);
    if (!candidates || candidates.length === 0) return '';
    return String(candidates[0].PuestoTrabajoLinea || candidates[0].Linea || '').trim();
  };

  // --- Necesidad P2 (origen para Corte Espuma / Corte y Laminado) ---
  // Ambas necesidades salen de explotar la lista de materiales (BOM) de las Órdenes FERT
  // (fertC1000ParaP2/fertC2000ParaP2, ya filtradas por centro/RESPCTRLPROD/ALMACEN/SECTOR y por la
  // fecha seleccionada — ver filterData). Cambio de fondo (2026-08-14): antes se usaban Provisionales
  // y FERT quedaba como tab de solo referencia; ahora es al revés — Provisionales sigue existiendo
  // como tab de referencia, sin alimentar el P2.

  // Idéntico al cleanCode de Corte y Laminado (mismo criterio de limpieza de código SAP).
  const cleanCode = (v: unknown) => String(v || '').replace(/^0+/, '').trim();

  const DESCRIPCION_ESPUMA = 'ESPUMA';

  // Fallback de nomenclatura para cuando el componente no tiene responsable conocido (mismo esquema
  // que ES_LAMINA_CORTADA en Corte Espuma, pero con el patrón de nombres real de Venta Externa: aquí
  // las láminas se llaman "LAMINA ESPUMA D…" o "LAMINA CILINDRICA D…", no "LAMINA D…" a secas).
  // Verificado contra los 84 materiales reales: los 81 componentes legítimos EMPIEZAN por "LAMINA";
  // los 3 químicos de formulación que se colaban antes (40000849/50/51, "FLEXPUR VISC…ESPUMA VISC",
  // hijos de 30014085 "BLOQUE FORMULADO D40 VISCO", responsable 005 = Formulación) empiezan por
  // "FLEXPUR" — el patrón los excluye solo, sin necesitar un tope de nivel inventado en el código.
  const ES_LAMINA_VENTA_EXTERNA = (desc: string): boolean => /^LAMINA\b/.test(String(desc || '').trim().toUpperCase());

  // Responsable de Control de Producción por material, armado con las órdenes que este módulo ya
  // carga (Provisionales + FERT completas, sin filtrar). Verificado: resuelve 81 de 81 componentes
  // HALB reales sin necesitar el inventario, y deja sin responsable exactamente a los 3 químicos.
  const responsableDeMaterial = useMemo(() => {
    const map = new Map<string, string>();
    const registrar = (filas: Record<string, unknown>[], campos: string[]) => {
      filas.forEach(o => {
        const code = cleanCode(o.MATERIAL || o.CodMaterial);
        if (!code || map.has(code)) return;
        for (const c of campos) {
          const r = String(o[c] || '').trim();
          if (r) { map.set(code, r); return; }
        }
      });
    };
    registrar(ordenes, ['RESPCONTROLPROD', 'RESPCTRLPROD']);
    registrar(ordenesFert, ['RESPCTRLPROD', 'RESPCONTROLPROD']);
    return map;
  }, [ordenes, ordenesFert]);

  // Responsables que fabrican el HALB (el componente a producir), por centro — restricción
  // `Hojas_Rutas_Materiales` del grupo de Venta Externa. Mismo patrón que ya usa Corte Espuma con
  // RespCtrlProd_Verticales: el criterio lo mantiene el negocio en las restricciones, no una lista de
  // nombres en el código.
  //
  // Los dos niveles del flujo quedan así, cada uno con su propia restricción:
  //   RESPCTRLPROD           → quién es dueño del FERT/PT que se vende (018&045 c1000 · 018 c2000)
  //   Hojas_Rutas_Materiales → quién fabrica el HALB del nivel inferior (038&014 c1000 · 038 c2000)
  //
  // Los valores coinciden exactamente con lo que muestran los datos reales: de los 81 componentes
  // HALB de los materiales de Venta Externa, 74 son del responsable 038 (Corte Espuma) y 1 del 014
  // (30017862, LAMINA CILINDRICA). El lookup se acota a los grupos de Venta Externa (`grupos` en este
  // módulo ya viene filtrado a 18/19) — la misma restricción existe en el grupo 8 con otro
  // significado y no debe mezclarse.
  //
  // Si la restricción no existiera, se acepta cualquier componente con responsable conocido: ya
  // alcanza para dejar fuera los químicos de formulación, que no tienen ninguno.
  const responsablesHalbPorCentro = useMemo(() => {
    const porCentro: Record<string, { lista: string[]; definida: boolean }> = {};
    (['1000', '2000'] as const).forEach(centro => {
      const idsGrupo = grupos.filter(g => String(g.centro).trim() === centro).map(g => g.codigo_grupo);
      const restr = restricciones.find(r =>
        idsGrupo.includes(r.codigo_grupo) &&
        r.estado === 'A' &&
        String(r.nombre_restriccion || '').trim().toUpperCase() === 'HOJAS_RUTAS_MATERIALES'
      );
      porCentro[centro] = restr
        ? { lista: String(restr.valor_restriccion || '').split(/[,&]/).map(v => v.trim()).filter(Boolean), definida: true }
        : { lista: [], definida: false };
    });
    return porCentro;
  }, [grupos, restricciones]);

  // Explota la lista de materiales de cada orden Provisional única del centro: se toma CUALQUIER fila
  // del árbol de BOM cuya descripción coincida con "ESPUMA" o "LAMINA CILINDRICA", sin importar en qué
  // NIVEL aparezca — mismo criterio que ya usa Corte y Laminado para su propia explosión de láminas
  // (ver laminaRows en TacticalPlanCorteLaminadoSection). Este es el filtro real de relevancia: un
  // material Provisional real (con RESP/ClaseOrden correctos) puede seguir sin pertenecer a la
  // Necesidad de Espuma/Rollo si su BOM no contiene ninguno de esos componentes — verificado con datos
  // reales (material 20013403 "BASE RESIFLEX...": su BOM son químicos crudos — TDI, POLYOL, aminas —
  // y partes no-espuma, sin ningún componente ESPUMA/LAMINA CILINDRICA; queda correctamente en
  // sinMatch, no en la Necesidad, aunque la orden en sí sea legítima).
  const explodeNecesidadesFert = async (centro: string, fertOrders: Record<string, unknown>[], onStep: () => void): Promise<{ espumas: NecesidadMaterial[]; rollos: NecesidadMaterial[]; sinMatch: string[]; conError: string[]; trazabilidad: Record<string, string[]> }> => {
    const materialQty = new Map<string, number>();
    fertOrders.forEach(o => {
      const info = extractMaterialInfo(o);
      if (!info.code) return;
      const qty = Number(o.CANTPROGRAMADA || o.CANTIDAD || 0);
      materialQty.set(info.code, (materialQty.get(info.code) || 0) + qty);
    });

    const espumasMap = new Map<string, NecesidadMaterial>();
    const rollosMap = new Map<string, NecesidadMaterial>();
    // Trazabilidad inversa (componente -> FERT/PT que lo necesitan), para "PFD - VENTA": side-output
    // del MISMO BOM walk forward de acá abajo, sin llamadas SAP nuevas. Se usa para, desde un
    // componente YA RESPONDIDO por Corte Espuma/Laminado (Data Aprobada), subir de nivel hacia el
    // FERT/PT que depende de él — dirección opuesta a la de esta función (que baja de FERT a
    // componente) — ver generarPfdVentaPreview.
    const trazabilidadMap = new Map<string, Set<string>>();
    // Diagnóstico: distingue, para cada Provisional que SÍ llegó hasta acá (ya pasó centro +
    // restricciones + fecha), entre "la consulta BOM falló" (conError) y "la consulta respondió pero
    // ninguna fila coincidió con ESPUMA/LAMINA CILINDRICA" (sinMatch) — antes ambos casos
    // desaparecían en silencio, sin dejar rastro de por qué un material con pedido real no
    // terminaba en la tabla de Necesidad.
    const sinMatch: string[] = [];
    const conError: string[] = [];
    for (const [matCode, qty] of materialQty.entries()) {
      const fullCode = matCode.padStart(18, '0');
      let encontroMatch = false;
      try {
        const response = await serviciosService.getMaestroMaterialesExplosion(centro, fullCode, 1, 500);
        const rawData = response?.data?.data || response?.data || [];
        if (Array.isArray(rawData)) {
          // Relevancia por RESPONSABLE — mismo esquema que usa el PFF de Corte Espuma, sin límite
          // de nivel: se recorre TODO el árbol y se decide por quién fabrica el componente, no por
          // dónde aparece. La restricción `Hojas_Rutas_Materiales` del grupo (018/19) es el
          // criterio autoritativo; el patrón de nombres es solo el respaldo cuando no hay
          // responsable que consultar (componente sin ninguna orden abierta ahora mismo — caso
          // real: 30005709/30005761, láminas legítimas sin demanda activa en este momento).
          const reglaHalb = responsablesHalbPorCentro[centro];
          const esDeVentaExternaComp = (compCode: string, desc: string): boolean => {
            const respComp = responsableDeMaterial.get(compCode);
            return respComp ? (!reglaHalb?.definida || reglaHalb.lista.includes(respComp)) : ES_LAMINA_VENTA_EXTERNA(desc);
          };
          // Rollo CONV (responsable 031, HR-CONVT, en Hojas_Rutas_Materiales desde 2026-10-13): es el
          // subproceso que sale como PT, así que la venta se pide en el CONV y no en la lámina base que
          // cuelga de él (caso CONV 30006694 ← base 30006693). Laminado baja esa necesidad a la base
          // para sus corridas. Si el CONV no pasa la restricción, la base se sigue pidiendo como antes.
          const rollosConv = new Set(rawData
            .filter((r: Record<string, unknown>) => {
              const d = String(r.DESCRIPCION_COMPONENTE || '').toUpperCase();
              return d.includes(DESCRIPCION_ROLLO) && esRolloConv(d) && esDeVentaExternaComp(cleanCode(r.COMPONENTE), d);
            })
            .map((r: Record<string, unknown>) => cleanCode(r.COMPONENTE)));
          rawData.forEach((row: Record<string, unknown>) => {
            const desc = String(row.DESCRIPCION_COMPONENTE || '').toUpperCase();
            // Candidato: la descripción tiene que mencionar espuma o rollo en algún punto. Esto NO
            // decide la relevancia todavía, solo acota qué filas vale la pena evaluar — igual que
            // TIENE_COMPONENTE_ESPUMA en Corte Espuma.
            const esEspuma = desc.includes(DESCRIPCION_ESPUMA);
            const esRollo = desc.includes(DESCRIPCION_ROLLO);
            if (!esEspuma && !esRollo) return;

            const compCode = cleanCode(row.COMPONENTE);
            if (!compCode) return;

            if (esRollo && !esRolloConv(desc) && rollosConv.has(cleanCode(row.MATERIAL_PADRE))) return;
            if (!esDeVentaExternaComp(compCode, desc)) return;

            encontroMatch = true;
            const cantAcum = Number(row.CANTIDAD_ACUMULADA || row.CANTIDAD_UNITARIA || 0);
            const target = esRollo ? rollosMap : espumasMap;
            if (!target.has(compCode)) {
              target.set(compCode, { material: compCode, descripcion: desc, cantidad: 0 });
            }
            target.get(compCode)!.cantidad += qty * cantAcum;
            // Trazabilidad (para "PFD - VENTA", ver arriba): a diferencia de la Necesidad P2 (que
            // acepta un match a CUALQUIER nivel del árbol), acá SÍ importa el nivel — el componente
            // que realmente responde Corte Espuma/Laminado (y que Data Aprobada rastrea) es el hijo
            // DIRECTO del FERT/PT (NIVEL 1 en el árbol de SAP). Un match más profundo (nivel 2, 3...)
            // no es el mismo componente que se está respondiendo — verificado observando el flujo:
            // aceptar cualquier nivel devolvía relaciones incorrectas. Un componente sin match en
            // nivel 1 simplemente no obtiene entrada en `trazabilidadMap` y cae en "Sin trazabilidad"
            // en generarPfdVentaPreview, en vez de generar una relación falsa.
            const nivel = Number(row.NIVEL ?? row.Nivel);
            if (nivel === 1) {
              if (!trazabilidadMap.has(compCode)) trazabilidadMap.set(compCode, new Set());
              trazabilidadMap.get(compCode)!.add(matCode);
            }
          });
        }
        if (!encontroMatch) sinMatch.push(matCode);
      } catch (error) {
        console.warn(`Error explotando BOM para material ${matCode} (centro ${centro}):`, (error as Error).message);
        conError.push(matCode);
      }
      onStep();
    }
    const trazabilidad: Record<string, string[]> = {};
    trazabilidadMap.forEach((fertCodes, compCode) => { trazabilidad[compCode] = Array.from(fertCodes); });
    return {
      espumas: Array.from(espumasMap.values()).sort((a, b) => a.material.localeCompare(b.material)),
      rollos: Array.from(rollosMap.values()).sort((a, b) => a.material.localeCompare(b.material)),
      sinMatch,
      conError,
      trazabilidad,
    };
  };

  // silencioso: desde el panel de progreso (Sincronizar) el resultado se muestra en el panel, sin
  // toast aparte que lo tape; desde el botón manual "Generar Necesidades · BOM FERT" sigue el toast.
  const handleCalcularNecesidadRollos = useCallback(async (silencioso = false): Promise<{ estado: 'ok' | 'aviso' | 'error'; mensaje: string; progreso?: { actual: number; total: number } }> => {
    if (selectedDates.length === 0) {
      const mensaje = 'Elige la Ventana de Producción ("Cambiar" en Plan P2) antes de calcular la necesidad.';
      if (!silencioso) addNotification('warning', mensaje);
      return { estado: 'aviso', mensaje };
    }
    setIsExplodingBom(true);
    setBomDiagnostico({ sinMatch: [], conError: [] });
    try {
      const uniqueMaterialCount = (orders: Record<string, unknown>[]) => new Set(orders.map(o => extractMaterialInfo(o).code).filter(Boolean)).size;
      const total = uniqueMaterialCount(fertC1000ParaP2) + uniqueMaterialCount(fertC2000ParaP2);
      let current = 0;
      setBomProgress({ current: 0, total });
      const onStep = () => setBomProgress({ current: ++current, total });

      const [n1000, n2000] = [
        await explodeNecesidadesFert('1000', fertC1000ParaP2, onStep),
        await explodeNecesidadesFert('2000', fertC2000ParaP2, onStep),
      ];
      setNecesidadEspumas1000(n1000.espumas);
      setNecesidadEspumas2000(n2000.espumas);
      setNecesidadRollos1000(n1000.rollos);
      setNecesidadRollos2000(n2000.rollos);
      // Mantiene el snapshot en sync — si el usuario navega a otro modulo y vuelve, esta tabla ya no
      // aparece vacia (ver SnapshotVentaExterna). No-op si todavia no se sincronizo ningun dato base.
      actualizarEnCache<SnapshotVentaExterna>(CACHE_VENTA_EXTERNA, {
        necesidadEspumas1000: n1000.espumas,
        necesidadEspumas2000: n2000.espumas,
        necesidadRollos1000: n1000.rollos,
        necesidadRollos2000: n2000.rollos,
      });

      const sinMatch = [...n1000.sinMatch, ...n2000.sinMatch];
      const conError = [...n1000.conError, ...n2000.conError];
      setBomDiagnostico({ sinMatch, conError });

      const incidencias = [
        sinMatch.length > 0 ? `${sinMatch.length} FERT sin Espuma/Rollo detectado en su BOM` : null,
        conError.length > 0 ? `${conError.length} FERT con error al consultar el BOM` : null,
      ].filter(Boolean).join(' · ');
      const nivel = sinMatch.length + conError.length > 0 ? 'warning' : 'success';
      const resumen = `Centro 1000: ${n1000.espumas.length} espumas / ${n1000.rollos.length} rollos. Centro 2000: ${n2000.espumas.length} espumas / ${n2000.rollos.length} rollos.${incidencias ? ` (${incidencias})` : ''}`;
      if (!silencioso) addNotification(nivel, `Necesidad calculada (ventana ${ventanaP2.inicio} → ${ventanaP2.fin}) — ${resumen}`);
      return { estado: nivel === 'warning' ? 'aviso' : 'ok', mensaje: resumen, progreso: { actual: current, total } };
    } catch (error) {
      if (!silencioso) addNotification('error', `Error al calcular la necesidad: ${(error as Error).message}`);
      return { estado: 'error', mensaje: (error as Error).message };
    } finally {
      setIsExplodingBom(false);
    }
  }, [fertC1000ParaP2, fertC2000ParaP2, ventanaP2, selectedDates, addNotification]);

  // Segunda fase de "Sincronizar" (ver handleSincronizarYGenerar): dispara handleCalcularNecesidadRollos
  // automáticamente SOLO si ya hay una Ventana de Producción elegida (selectedDates) — si no, se deja
  // callado para que el usuario la elija y lo dispare a mano con el botón "Generar Necesidades · BOM
  // FERT", que sigue disponible aparte (a diferencia de Laminado/Espuma, acá elegir fecha es un paso
  // obligatorio intermedio, no opcional). Declarado después de handleCalcularNecesidadRollos para que
  // la referencia ya sea la versión fresca (sus dependencias, fertC1000ParaP2/fertC2000ParaP2, ya se
  // recalcularon con los datos recién sincronizados).
  useEffect(() => {
    if (!autoGenerarPendiente) return;
    setAutoGenerarPendiente(false);
    if (selectedDates.length === 0) {
      // Sin Ventana de Producción elegida no se calculó necesidad fresca — encadenar la generación de
      // P2 acá usaría necesidad vieja (o vacía) para decidir qué desactivar, así que se deja tal como
      // antes: el usuario elige fecha y dispara "Generar Todos los P2" a mano.
      panelProgreso.actualizar('bom', { estado: 'omitido', detalle: 'Sin Ventana de Producción elegida.' });
      panelProgreso.actualizar('p2', { estado: 'omitido' });
      panelProgreso.concluir();
      setSyncStep('idle');
      return;
    }
    setSyncStep('generando');
    panelProgreso.actualizar('bom', { estado: 'en_curso' });
    handleCalcularNecesidadRollos(true).then(r => {
      // Conteo final en r.progreso: el último setBomProgress cae en el mismo render que syncStep
      // vuelve a 'idle' y el efecto de avance no lo alcanza (quedaba 76/77).
      panelProgreso.actualizar('bom', { estado: r.estado, detalle: r.mensaje, ...(r.progreso ? { progreso: r.progreso } : {}) });
      if (r.estado === 'error') {
        // Sin necesidad fresca no se genera el P2: decidiría qué desactivar con datos viejos.
        panelProgreso.actualizar('p2', { estado: 'omitido' });
        panelProgreso.concluir();
        setSyncStep('idle');
        return;
      }
      // 2026-10-16: el P2 vuelve a generarse solo al sincronizar, pero SOLO si todavía no hay P2 de
      // hoy (consultado en vivo, no del estado del día de la apertura). Si ya existe, no se pisa: Laminado /
      // Corte Espuma pueden haberlo respondido ya (el motivo por el que se quitó el 12-10); queda
      // "Regenerar P2" como acción manual. Se genera desde autoGenerarP2Pendiente (efecto declarado
      // después de handleGenerarTodosPlanesP2), no acá: leería necesidadEspumas/Rollos por closure vieja.
      void sapCompartido.planGrupos()
        .then(res => hitosDePlanes(res.data || [], format(new Date(), 'yyyy-MM-dd')).find(h => h.id === 've-p2'))
        .then(hito => {
          if (hito && hito.estado === 'pendiente') {
            setAutoGenerarP2Pendiente(true);
            return;
          }
          panelProgreso.actualizar('p2', { estado: 'omitido', detalle: `Ya existe el P2 de hoy${hito?.detalle ? ` (${hito.detalle})` : ''}; no se regenera.` });
          setSyncStep('idle');
          panelProgreso.concluir('Datos al día. El P2 de hoy ya está generado: sigue en 2 · Data Aprobada.', [
            { etiqueta: 'Ir a 2 · Data Aprobada', onClick: () => setActiveTab('dataAprobada') },
            { etiqueta: 'Regenerar P2', onClick: () => { void handleGenerarP2ConPanel(); } },
          ]);
        }, e => {
          // Sin poder confirmar si ya hay P2 de hoy, no se genera solo (podría pisar uno respondido).
          panelProgreso.actualizar('p2', { estado: 'omitido', detalle: `No se pudo consultar Plan Grupo: ${(e as Error).message}` });
          setSyncStep('idle');
          panelProgreso.concluir('Datos al día. Genera el P2 a mano si aún no existe.', [
            { etiqueta: '1 · Generar P2', onClick: () => { void handleGenerarP2ConPanel(); } },
          ]);
        });
    });
  }, [autoGenerarPendiente, handleCalcularNecesidadRollos, selectedDates, panelProgreso]); // eslint-disable-line react-hooks/exhaustive-deps


  // Avance de la explosión BOM (materiales explotados / total) reflejado en el panel mientras corre.
  useEffect(() => {
    if (syncStep !== 'generando' || bomProgress.total === 0) return;
    panelProgreso.actualizar('bom', { progreso: { actual: bomProgress.current, total: bomProgress.total } });
  }, [syncStep, bomProgress, panelProgreso.actualizar]); // eslint-disable-line react-hooks/exhaustive-deps

  // Consulta inversa: antes de (re)generar un P2, revisa si ya existe uno activo para ese centro+tipo
  // y, de existir, si algún plan P3 (u otro consumidor) ya ejecutó contra él — un DetalleTactico
  // activo cuyo codigo_plan_grupo_padre apunte a ese P2 pero cuyo codigo_plan_grupo sea otro plan.
  // Si ya fue consumido, no se debe reemplazar en silencio (rompería la trazabilidad del P3 activo);
  // si no fue consumido, se desactiva (estado 'I') y se libera el paso para crear el nuevo.
  // Lectura de Plan Grupo / Detalle Táctico hecha UNA vez al inicio de "Generar P2" (ver
  // handleGenerarTodosPlanesP2). Sin ella, cada guardado invalidaba la caché y el siguiente
  // centro/tipo volvía a bajar la tabla completa: 12-10 la tercera descarga (Espumas 2000) cortó con
  // "NetworkError". Cada centro+tipo solo mira sus propios planes, así que lo que grabó el anterior
  // no cambia lo que este necesita.
  const lecturaP2Ref = useRef<{ planes: Promise<{ data?: PlanGrupo[] }>; detalles: Promise<{ data?: DetalleTactico[] }> } | null>(null);
  const leerPlanesP2 = () => lecturaP2Ref.current?.planes ?? sapCompartido.planGrupos();
  const leerDetallesP2 = () => lecturaP2Ref.current?.detalles ?? sapCompartido.detallesTacticos();

  const verificarPlanP2Activo = async (centro: '1000' | '2000', tipo: 'ESPUMAS' | 'ROLLOS') => {
    const grupoCentro = grupos.find(g => String(g.centro).trim() === centro);
    if (!grupoCentro) return { grupoCentro: null as Grupo | null, planActivo: null as PlanGrupo | null, planesActivos: [] as PlanGrupo[], planesP3: [] as PlanGrupo[], detallesPlanActivo: [] as DetalleTactico[] };

    const valorRegex = new RegExp(`plan\\s*t[aá]ctico.*centro.*${centro}.*p2.*${tipo}`, 'i');
    const planesRes = await leerPlanesP2();
    const todosLosPlanes = planesRes.data || [];

    // TODOS los P2 activos de este centro+tipo, no solo el primero que aparezca. Antes esto era un
    // .find(): si por cualquier motivo quedaban dos o más activos (corridas previas, un plan mal
    // fechado que no se apagó), solo se desactivaba uno y el resto quedaba vivo para siempre,
    // conviviendo con el plan nuevo. Se ordenan por fecha y código descendente para que `planActivo`
    // sea el MÁS RECIENTE — es el único candidato razonable a reconciliar.
    const planesActivos = todosLosPlanes
      // Los P2 "DIFERIDO" viven aparte (ver guardarP2Diferido): tienen su propio ciclo de fechas.
      .filter(pg => pg.estado === 'A' && pg.codigo_grupo === grupoCentro.codigo_grupo && valorRegex.test(String(pg.valor || '')) && !/diferido/i.test(String(pg.valor || '')))
      .sort((a, b) => {
        const porFecha = soloFecha(b.fecha_inicio_plan).localeCompare(soloFecha(a.fecha_inicio_plan));
        return porFecha !== 0 ? porFecha : b.codigo_plan_grupo - a.codigo_plan_grupo;
      });
    const planActivo = planesActivos[0] || null;

    if (!planActivo) return { grupoCentro, planActivo: null, planesActivos, planesP3: [], detallesPlanActivo: [] as DetalleTactico[] };

    const detallesRes = await leerDetallesP2();
    const todosLosDetalles = detallesRes.data || [];
    const planPorCodigo = new Map(todosLosPlanes.map(pg => [pg.codigo_plan_grupo, pg]));
    const codigosP3 = new Set(
      todosLosDetalles
        .filter(d => d.estado === 'A' && d.codigo_plan_grupo_padre === planActivo.codigo_plan_grupo && d.codigo_plan_grupo !== planActivo.codigo_plan_grupo)
        .map(d => d.codigo_plan_grupo)
    );
    const planesP3 = Array.from(codigosP3)
      .map(c => planPorCodigo.get(c))
      .filter((p): p is PlanGrupo => !!p && p.estado === 'A');

    const detallesPlanActivo = todosLosDetalles.filter(d => d.estado === 'A' && d.codigo_plan_grupo === planActivo.codigo_plan_grupo);

    return { grupoCentro, planActivo, planesActivos, planesP3, detallesPlanActivo };
  };

  type ResultadoGeneracionP2 = {
    centro: '1000' | '2000';
    tipo: 'ESPUMAS' | 'ROLLOS';
    status: 'ok' | 'sin-datos' | 'bloqueado' | 'error' | 'confirmar-reemplazo';
    mensaje: string;
    codigoPlan?: number;
  };

  // Vista previa de lo que hará generarPlanP2Base con un centro+tipo, SIN escribir nada (misma lectura
  // y mismas reglas): qué plan se crea o se reconcilia y qué P2 activos quedan desactivados. Alimenta
  // la ventana "Confirmar P2" (usuario 2026-10-28: mismo flujo que la confirmación de Laminado, antes
  // los planes anteriores se apagaban sin aviso).
  type PreviaP2 = {
    centro: '1000' | '2000';
    tipo: 'ESPUMAS' | 'ROLLOS';
    accion: 'crear' | 'actualizar' | 'solo-desactivar' | 'sin-cambios';
    materiales: number;
    diferidos: number;
    fechaInicio: string;
    fechaPT: string;
    conservar: PlanGrupo | null;
    desactivar: PlanGrupo[];
    respondidoPorP3: number[];
  };
  const previsualizarP2 = useCallback(async (centro: '1000' | '2000', tipo: 'ESPUMAS' | 'ROLLOS'): Promise<PreviaP2> => {
    const diferidos = tipo === 'ESPUMAS' ? new Set(materialesDiferidos[centro]) : new Set<string>();
    const lineas = (tipo === 'ESPUMAS'
      ? (centro === '1000' ? necesidadEspumas1000 : necesidadEspumas2000)
      : (centro === '1000' ? necesidadRollos1000 : necesidadRollos2000)
    ).filter(l => l.cantidad > 0 && !diferidos.has(String(Number(l.material))));
    const fechaPT = fechasHorizonte.pt;
    const fechaInicio = recuperacionDePT(fechaPT);
    const { planActivo, planesActivos, planesP3 } = await verificarPlanP2Activo(centro, tipo);
    const base = { centro, tipo, materiales: lineas.length, diferidos: diferidos.size, fechaInicio, fechaPT, respondidoPorP3: planesP3.map(p => p.codigo_plan_grupo) };
    if (lineas.length === 0) {
      return { ...base, accion: planesActivos.length > 0 ? 'solo-desactivar' : 'sin-cambios', conservar: null, desactivar: planesActivos };
    }
    const conservar = planActivo && soloFecha(planActivo.fecha_inicio_plan) === fechaInicio ? planActivo : null;
    return {
      ...base,
      accion: conservar ? 'actualizar' : 'crear',
      conservar,
      desactivar: planesActivos.filter(p => p.codigo_plan_grupo !== conservar?.codigo_plan_grupo),
    };
  // verificarPlanP2Activo / recuperacionDePT: funciones del render, mismo criterio que generarPlanP2Base.
  }, [grupos, necesidadEspumas1000, necesidadEspumas2000, necesidadRollos1000, necesidadRollos2000, materialesDiferidos, fechasHorizonte.pt, siguienteDiaHabil]);

  // La ventana se resuelve con una promesa para que el mismo flujo (botón o panel de Sincronizar)
  // espere la decisión antes de escribir.
  const [confirmacionP2, setConfirmacionP2] = useState<PreviaP2[] | null>(null);
  const resolverConfirmacionP2 = useRef<((ok: boolean) => void) | null>(null);
  const pedirConfirmacionP2 = useCallback((previas: PreviaP2[]) => new Promise<boolean>(resolve => {
    resolverConfirmacionP2.current = resolve;
    setConfirmacionP2(previas);
  }), []);
  const responderConfirmacionP2 = useCallback((ok: boolean) => {
    resolverConfirmacionP2.current?.(ok);
    resolverConfirmacionP2.current = null;
    setConfirmacionP2(null);
  }, []);

  // Núcleo sin notificaciones: genera el PlanGrupo "origen" (P2) de un centro para UN tipo de
  // necesidad (Espumas o Rollos — son dos planes independientes, no uno combinado) y devuelve un
  // resultado estructurado por subgrupo (centro+tipo). Al ser el origen de la cadena (Venta Externa
  // no consume de nadie más), codigo_plan_grupo_padre se auto-referencia al propio plan recién creado.
  // Se reutiliza tanto para el botón individual como para "Generar Todos", que la llama 4 veces
  // (una por cada combinación centro×tipo) y consolida los 4 resultados en un solo resumen.
  //
  // `forzar`: solo aplica a ESPUMAS (ver más abajo) — confirma que se acepta reemplazar un P2 activo
  // que está fechado para OTRO día distinto al que se está por grabar (ver status 'confirmar-reemplazo').
  const generarPlanP2Base = useCallback(async (centro: '1000' | '2000', tipo: 'ESPUMAS' | 'ROLLOS', forzar = false): Promise<ResultadoGeneracionP2> => {
    const key = `${centro}-${tipo}`;
    const diferidos = tipo === 'ESPUMAS' ? new Set(materialesDiferidos[centro]) : new Set<string>();
    const lineas = (tipo === 'ESPUMAS'
      ? (centro === '1000' ? necesidadEspumas1000 : necesidadEspumas2000)
      : (centro === '1000' ? necesidadRollos1000 : necesidadRollos2000)
    ).filter(l => l.cantidad > 0 && !diferidos.has(String(Number(l.material))));

    if (lineas.length === 0) {
      // Antes esto cortaba sin tocar nada: un P2 real de un día anterior se quedaba en 'A' para
      // siempre si la necesidad bajaba a 0 al día siguiente (ya resuelto por su propia respuesta
      // P3/PFD). No rompía la necesidad recuperada por fecha exacta (fetchNecesidadesPlanta filtra
      // por fecha_inicio_plan == hoy+1, así que un plan viejo deja de aparecer ahí solo por su fecha)
      // pero SÍ distorsionaba cualquier otro chequeo que buscara "el plan activo" de este centro+tipo
      // sin filtrar por fecha (ver verificarPlanP2Activo) — reportado por el usuario (2026-09-09):
      // encontrar un plan activo desactualizado seguía "recuperándose" y generaba resultados
      // distorsionados. Ahora se desactivan explícitamente los P2 activos de este centro+tipo cuando
      // la necesidad calculada hoy es 0 — mismo criterio y patrón (`estado -> 'I'`, sin tocar
      // DetalleTactico) que el resto del flujo.
      setSavingPlanP2(prev => ({ ...prev, [key]: true }));
      try {
        const { planesActivos } = await verificarPlanP2Activo(centro, tipo);
        const planesDesactivados: number[] = [];
        for (const pg of planesActivos) {
          await desactivarPlanGrupo(pg);
          planesDesactivados.push(pg.codigo_plan_grupo);
        }
        const sufijo = planesDesactivados.length > 0
          ? ` Plan(es) anterior(es) #${planesDesactivados.join(', #')} desactivado(s) por falta de necesidad vigente.`
          : '';
        return { centro, tipo, status: 'sin-datos', mensaje: `No hay necesidad de ${TIPO_TAG[tipo]} calculada para el Centro ${centro}.${sufijo}` };
      } catch (error) {
        return { centro, tipo, status: 'error', mensaje: `${TIPO_TAG[tipo]} Centro ${centro}: sin necesidad hoy, pero falló al desactivar plan(es) anterior(es) — ${(error as Error).message}` };
      } finally {
        setSavingPlanP2(prev => ({ ...prev, [key]: false }));
      }
    }

    setSavingPlanP2(prev => ({ ...prev, [key]: true }));
    try {
      const { grupoCentro, planActivo, planesActivos, planesP3, detallesPlanActivo } = await verificarPlanP2Activo(centro, tipo);
      if (!grupoCentro) {
        return { centro, tipo, status: 'error', mensaje: `No se encontró el grupo de Venta Externa para el Centro ${centro}.` };
      }

      const user = typeof window !== 'undefined' ? JSON.parse(localStorage.getItem('user') || '{}') : {};
      const usuario = user?.name || 'admin';

      // Fechas del P2 (regla del usuario 2026-10-02, ver fechasHorizonteDe): fecha_inicio_plan =
      // recuperación de Corte/Laminado (hoy+1 hábil) y fecha_fin_plan = PT (hoy+2), Espumas y Rollos.
      // Lo diferido no mueve este plan: va aparte (ver guardarP2Diferido).
      const fechaPT = fechasHorizonte.pt;
      const fechaPlanP2 = recuperacionDePT(fechaPT);

      // Salvaguarda: "Ventana de Producción" se dejó a propósito sin tope, para evaluar fechas fuera
      // de la ventana operativa normal ("qué pasaría si") — ver su comentario. Con ESPUMAS ahora
      // grabando esa fecha, generar con una fecha de prueba reemplazaría en silencio el plan activo
      // real (con otra fecha), descuadrando la necesidad que ve Corte Espuma sin ningún aviso. Si hay
      // un plan activo fechado para OTRO día que el que se va a grabar y todavía no se confirmó
      // (forzar=false), se corta ANTES de escribir nada — el caller decide si confirma y reintenta
      // con forzar=true.
      if (tipo === 'ESPUMAS' && planActivo && !forzar && soloFecha(planActivo.fecha_inicio_plan) !== fechaPlanP2) {
        return {
          centro, tipo, status: 'confirmar-reemplazo',
          mensaje: `${TIPO_TAG[tipo]} Centro ${centro}: ya existe un Plan #${planActivo.codigo_plan_grupo} activo fechado ${soloFecha(planActivo.fecha_inicio_plan)} — generar con recuperación ${fechaPlanP2} / PT ${fechaPT} lo desactivará. ¿Continuar?`,
        };
      }

      // La generación es diaria, pero acotada al MISMO día hábil (antes se reconciliaba el mismo
      // Plan Grupo indefinidamente, sin importar cuántos días hubieran pasado — un plan de hace 3
      // días terminaba representando la necesidad de hoy, con su propia fecha_inicio_plan sin
      // actualizar). Si el plan activo ya es de hoy (mismo fechaPlanP2), se reconcilia por material
      // sobre el mismo codigo_plan_grupo (actualiza cantidad si el material ya tenía línea, agrega
      // línea nueva si es un material que apareció recién) — evita duplicar planes si se corre varias
      // veces el mismo día. Si el plan activo es de un día ANTERIOR, se crea un plan NUEVO con la
      // fecha de hoy y el anterior se desactiva (estado -> 'I') con el mismo criterio ya probado en
      // Corte y Laminado (ver desactivarPlanGrupo ahí): solo se apaga el PlanGrupo, sus
      // DetalleTactico NO cambian de estado — evita el bug de filas huérfanas que causó
      // planGrupoService.save() sobre un plan existente la vez anterior.
      const planActivoEsDeHoy = planActivo && soloFecha(planActivo.fecha_inicio_plan) === fechaPlanP2;

      // La advertencia solo aplica si se intenta REGENERAR EL MISMO CICLO que un P3 ya respondió —
      // cambiar en silencio las cantidades de un P2 que Corte Espuma/Laminado ya usó para fechar SU
      // respuesta sí rompería esa trazabilidad. Un P2 de un ciclo distinto (de un día anterior, como
      // #122/#123 fechados hoy mientras se genera el ciclo de mañana) no advierte aunque tenga P3
      // encima — su P3 respondió a ESE ciclo, ya cerrado desde la perspectiva del ciclo que se está
      // generando ahora; no hace falta "coordinar" nada, se desactiva y se sigue (ver rama de abajo).
      // Antes se comparaba la fecha del P3 contra "hoy" (planesP3Abiertos), pero eso bloqueaba igual
      // un P3 fechado exactamente hoy — que es precisamente el caso normal al generar el ciclo de
      // mañana.
      //
      // Antes esto era un bloqueo SIN salida ('bloqueado', sin forzar posible) — el usuario no tenía
      // forma de regenerar el P2 salvo desactivando el plan a mano fuera de la app. Se cambió al mismo
      // patrón de confirmación que ya usa el reemplazo por fecha distinta (status 'confirmar-reemplazo'
      // + forzar=true): informa la consecuencia real (el P3 #438/#439 va a quedar huérfano de su
      // origen) y deja que el usuario decida con conocimiento, en vez de dejarlo sin poder avanzar.
      if (planActivoEsDeHoy && planActivo && planesP3.length > 0 && !forzar) {
        return {
          centro, tipo, status: 'confirmar-reemplazo',
          mensaje: `${TIPO_TAG[tipo]} Centro ${centro}: el Plan #${planActivo.codigo_plan_grupo} (mismo ciclo que se está generando) ya fue ejecutado por el/los Plan(es) P3 #${planesP3.map(p => p.codigo_plan_grupo).join(', #')}. Si regeneras, ese P3 queda sin el P2 que lo originó (huérfano) y Corte Espuma/Laminado tendría que volver a responder. ¿Continuar de todas formas?`,
        };
      }

      let codigoPlanGrupo: number;
      let esActualizacion = false;
      const planesDesactivados: number[] = [];

      // Apaga TODOS los P2 activos de este centro+tipo salvo el que se indique conservar. Un plan P2
      // vigente por centro+tipo y nada más: si se crea uno nuevo (o se ajusta uno existente), los
      // anteriores dejan de representar la necesidad y deben quedar en 'I'. Solo se apaga el
      // PlanGrupo — sus DetalleTactico NO cambian de estado, para no dejar filas huérfanas (mismo
      // criterio ya probado en Corte y Laminado, ver desactivarPlanGrupo ahí).
      const desactivarOtrosPlanes = async (conservar: number | null) => {
        for (const pg of planesActivos) {
          if (pg.codigo_plan_grupo === conservar) continue;
          await desactivarPlanGrupo(pg);
          planesDesactivados.push(pg.codigo_plan_grupo);
        }
      };

      if (planActivoEsDeHoy && planActivo) {
        codigoPlanGrupo = planActivo.codigo_plan_grupo;
        esActualizacion = true;
        // Se reconcilia el del día, pero cualquier otro que siguiera activo igual se apaga.
        await desactivarOtrosPlanes(codigoPlanGrupo);
      } else {
        await desactivarOtrosPlanes(null);
        const planPayload = {
          codigo_plan_grupo: 0,
          codigo_grupo: grupoCentro.codigo_grupo,
          codigo_familia_grupo: null,
          codigo_plan: null,
          valor: `Plan Táctico - Centro ${centro} - P2 - Venta - ${TIPO_TAG[tipo]}`,
          fecha_inicio_plan: ecuadorMidnightISO(fechaPlanP2),
          fecha_fin_plan: ecuadorMidnightISO(fechaPT),
          estado: 'A',
          usuario_creacion: usuario,
          // Faltaba en el payload — la columna quedaba NULL en BD (verificado con datos reales,
          // ver [[plan_grupo_fecha_creacion_faltante]]). ecuadorNowNaiveISO (no new Date()):
          // convención "naive Ecuador", ver ecuadorMidnightISO.
          fecha_creacion: ecuadorNowNaiveISO(),
        };
        const planResponse = await planGrupoService.save(planPayload as unknown as PlanGrupo);
        codigoPlanGrupo = planResponse.data.codigo_plan_grupo;
      }

      // Solo hay líneas "ya existentes" para reconciliar cuando seguimos sobre el plan de hoy — un
      // plan recién creado (o recién reemplazado) empieza sin detalle previo.
      const existentePorMaterial = esActualizacion
        ? new Map(detallesPlanActivo.map(d => [String(Number(d.codigo_material)), d]))
        : new Map<string, DetalleTactico>();

      let actualizados = 0;
      let agregados = 0;
      let fallidos = 0;
      for (const linea of lineas) {
        try {
          const existente = existentePorMaterial.get(String(Number(linea.material)));
          const detallePayload = {
            codigo_detalle_tactico: existente ? existente.codigo_detalle_tactico : 0,
            codigo_material: Number(linea.material),
            cantidad_produccion_neta: Math.round(linea.cantidad).toFixed(0),
            resp_ctrl_prod: '',
            clase_aprovisionamiento: 'E',
            cantidad_aprovisionamiento: 0,
            estado: 'A',
            codigo_plan_grupo: codigoPlanGrupo,
            // Sin auto-referencia: verificado contra datos reales (plan #36 "Forros" y 317/375
            // filas de detalle_tactico en producción) que codigo_plan_grupo_padre se deja vacío en
            // el plan ORIGEN — solo se llena en las líneas del plan CONSUMIDOR (P3) cuando de verdad
            // hereda de un origen rastreable.
            codigo_plan_grupo_padre: null,
            usuario_modificacion: usuario,
            linea_produccion: matchLineaProduccion(linea.material, centro === '1000' ? tiempoLookup1000 : tiempoLookup2000),
          };
          await detalleTacticoService.save(detallePayload as unknown as DetalleTactico);
          if (existente) actualizados++; else agregados++;
        } catch (error) {
          console.warn(`[Plan P2 ${tipo}] Falló material ${linea.material}:`, (error as Error).message);
          fallidos++;
        }
      }

      setPlanP2Generado(prev => ({ ...prev, [key]: codigoPlanGrupo }));
      const sufijoP3Cerrados = planesDesactivados.length > 0 && planesP3.length > 0
        ? ` (ya cerrado por Plan(es) P3 #${planesP3.map(p => p.codigo_plan_grupo).join(', #')})`
        : '';
      const sufijoDesactivado = planesDesactivados.length > 0
        ? ` Plan(es) anterior(es) #${planesDesactivados.join(', #')}${sufijoP3Cerrados} desactivado(s).`
        : '';
      // El sufijo de desactivación va en ambos caminos: reconciliar el plan del día también puede
      // haber apagado otros planes que seguían activos.
      const accion = esActualizacion
        ? `actualizado (${agregados} agregados, ${actualizados} refrescados).${sufijoDesactivado}`
        : `creado (${agregados} materiales) para ${fechaPlanP2}.${sufijoDesactivado}`;
      if (fallidos === 0) {
        return { centro, tipo, status: 'ok', codigoPlan: codigoPlanGrupo, mensaje: `${TIPO_TAG[tipo]} Centro ${centro}: Plan #${codigoPlanGrupo} ${accion}.` };
      }
      return { centro, tipo, status: 'ok', codigoPlan: codigoPlanGrupo, mensaje: `${TIPO_TAG[tipo]} Centro ${centro}: Plan #${codigoPlanGrupo} ${accion}, ${fallidos} fallidos.` };
    } catch (error) {
      return { centro, tipo, status: 'error', mensaje: `${TIPO_TAG[tipo]} Centro ${centro}: error al guardar — ${(error as Error).message}` };
    } finally {
      setSavingPlanP2(prev => ({ ...prev, [key]: false }));
    }
  // recuperacionDePT usa el mismo calendario que siguienteDiaHabil (ya en dependencias).
  }, [grupos, necesidadEspumas1000, necesidadEspumas2000, necesidadRollos1000, necesidadRollos2000, ventanaP2, siguienteDiaHabil, fechasHorizonte.pt, tiempoLookup1000, tiempoLookup2000, materialesDiferidos]);

  // P2 DIFERIDO (ver materialesDiferidos): un plan aparte por centro con los materiales aplazados —
  // fecha_inicio_plan = recuperación diferida (= PT de hoy, hoy+2) y fecha_fin_plan = PT diferido
  // (hoy+3). Así Corte Espuma lo recupera mañana con su regla exacta de siempre, y sus FERT (que
  // siguen fechadas al PT original) no se suman al P2 normal de mañana: no se pierde ni se duplica.
  // Mismo ciclo = se reemplaza; ciclos ya vencidos (recuperación anterior a hoy+1) se apagan.
  const guardarP2Diferido = useCallback(async (centro: '1000' | '2000'): Promise<string> => {
    const codigos = new Set(materialesDiferidos[centro]);
    const fuente = centro === '1000' ? necesidadEspumas1000 : necesidadEspumas2000;
    const lineas = fuente.filter(l => l.cantidad > 0 && codigos.has(String(Number(l.material))));
    const grupoCentro = grupos.find(g => String(g.centro).trim() === centro);
    if (!grupoCentro) return '';
    const recuperacion = fechasHorizonte.pt;
    const ptDiferido = format(addBusinessDaysCal(parseISO(fechasHorizonte.pt), 1, diasNoLaborables, laborablesHorizonte(diasLaborablesExtra)), 'yyyy-MM-dd');
    const valor = `Plan Táctico - Centro ${centro} - P2 - Venta - ${TIPO_TAG.ESPUMAS} - DIFERIDO`;
    const regex = new RegExp(`plan\\s*t[aá]ctico.*centro.*${centro}.*p2.*espumas.*diferido`, 'i');
    const todos = (await leerPlanesP2()).data || [];
    const apagados: number[] = [];
    for (const pg of todos) {
      if (pg.estado !== 'A' || pg.codigo_grupo !== grupoCentro.codigo_grupo || !regex.test(String(pg.valor || ''))) continue;
      const inicio = soloFecha(pg.fecha_inicio_plan);
      if (inicio === recuperacion || inicio < fechasHorizonte.recuperacion) {
        await desactivarPlanGrupo(pg);
        apagados.push(pg.codigo_plan_grupo);
      }
    }
    const sufijoApagados = apagados.length > 0 ? ` (reemplaza #${apagados.join(', #')})` : '';
    if (lineas.length === 0) {
      return apagados.length > 0 ? ` P2 DIFERIDO sin materiales con necesidad hoy; #${apagados.join(', #')} desactivado(s).` : '';
    }
    const user = typeof window !== 'undefined' ? JSON.parse(localStorage.getItem('user') || '{}') : {};
    const usuario = user?.name || 'admin';
    const plan = await planGrupoService.save({
      codigo_plan_grupo: 0,
      codigo_grupo: grupoCentro.codigo_grupo,
      codigo_familia_grupo: null,
      codigo_plan: null,
      valor,
      fecha_inicio_plan: ecuadorMidnightISO(recuperacion),
      fecha_fin_plan: ecuadorMidnightISO(ptDiferido),
      estado: 'A',
      usuario_creacion: usuario,
      fecha_creacion: ecuadorNowNaiveISO(),
    } as unknown as PlanGrupo);
    const codigoPlanGrupo = plan.data.codigo_plan_grupo;
    let fallidos = 0;
    for (const linea of lineas) {
      try {
        await detalleTacticoService.save({
          codigo_detalle_tactico: 0,
          codigo_material: Number(linea.material),
          cantidad_produccion_neta: Math.round(linea.cantidad).toFixed(0),
          resp_ctrl_prod: '',
          clase_aprovisionamiento: 'E',
          cantidad_aprovisionamiento: 0,
          estado: 'A',
          codigo_plan_grupo: codigoPlanGrupo,
          codigo_plan_grupo_padre: null,
          usuario_modificacion: usuario,
          linea_produccion: matchLineaProduccion(linea.material, centro === '1000' ? tiempoLookup1000 : tiempoLookup2000),
        } as unknown as DetalleTactico);
      } catch (error) {
        console.warn(`[Plan P2 DIFERIDO] Falló material ${linea.material}:`, (error as Error).message);
        fallidos++;
      }
    }
    return ` P2 DIFERIDO #${codigoPlanGrupo}: ${lineas.length - fallidos} material(es), recuperación ${recuperacion} / PT ${ptDiferido}${sufijoApagados}${fallidos > 0 ? `, ${fallidos} fallidos` : ''}.`;
  }, [materialesDiferidos, necesidadEspumas1000, necesidadEspumas2000, grupos, fechasHorizonte.pt, fechasHorizonte.recuperacion, diasNoLaborables, diasLaborablesExtra, tiempoLookup1000, tiempoLookup2000]);

  // P2 + (solo Espumas, si hay materiales diferidos) su P2 DIFERIDO. Si el P2 normal pide
  // confirmación o falla, el diferido no se toca hasta resolverlo.
  const generarPlanP2Core = useCallback(async (centro: '1000' | '2000', tipo: 'ESPUMAS' | 'ROLLOS', forzar = false): Promise<ResultadoGeneracionP2> => {
    if (resultadoRestaurado) return { centro, tipo, status: 'error', mensaje: 'Plan cargado de un reporte guardado (solo consulta): sincroniza para generar P2 o PFD-VENTA con datos vigentes.' };
    const r = await generarPlanP2Base(centro, tipo, forzar);
    if (tipo !== 'ESPUMAS' || (r.status !== 'ok' && r.status !== 'sin-datos')) return r;
    if (materialesDiferidos[centro].length === 0) return r;
    try {
      return { ...r, status: r.status === 'sin-datos' ? 'ok' : r.status, mensaje: r.mensaje + (await guardarP2Diferido(centro)) };
    } catch (error) {
      return { ...r, mensaje: `${r.mensaje} No se pudo grabar el P2 DIFERIDO: ${(error as Error).message}` };
    }
  }, [generarPlanP2Base, guardarP2Diferido, materialesDiferidos, resultadoRestaurado]);

  // "PFD - VENTA": mismo grupo (18/19) y patrón de guardado que el P2 (generarPlanP2Core arriba), pero
  // el valor lleva el token compuesto "PFD-VENTA" (no "PFD" suelto, para no chocar con el /pfd/i que ya
  // usa Corte y Laminado bajo SU propio codigo_grupo=8 — acá vive en el codigo_grupo de Venta Externa,
  // así que el riesgo real es bajo, pero se evita igual) y cada línea de DetalleTactico graba
  // codigo_plan_grupo_padre = el P2 activo del que se deriva (a diferencia del P2, que no se
  // auto-referencia — ver el comentario en generarPlanP2Core). Requiere haber generado la vista previa
  // primero (pfdVentaPreview, ver generarPfdVentaPreview) — solo Espumas, un plan por centro.
  // lineasOverride: usado por handleGenerarYGuardarPfdVenta para encadenar el guardado justo detrás
  // de generarPfdVentaPreview en la misma corrida, con las líneas recién calculadas — sin depender de
  // pfdVentaPreview del estado, que todavía no refleja el setState de ese mismo ciclo.
  const guardarPfdVentaCore = useCallback(async (centro: '1000' | '2000', lineasOverride?: PfdVentaLinea[]): Promise<ResultadoGeneracionP2> => {
    const tipo = 'ESPUMAS' as const;
    if (resultadoRestaurado) return { centro, tipo, status: 'error', mensaje: 'Plan cargado de un reporte guardado (solo consulta): sincroniza para generar P2 o PFD-VENTA con datos vigentes.' };
    const key = `PFD-${centro}`;
    const lineas = lineasOverride ?? (pfdVentaPreview[centro]?.lineas || []);
    if (lineas.length === 0) {
      return { centro, tipo, status: 'sin-datos', mensaje: `No hay materiales PFD-VENTA generados para el Centro ${centro} — pulsa "Generar PFD-VENTA" primero.` };
    }

    setSavingPfdVenta(prev => ({ ...prev, [key]: true }));
    try {
      const { grupoCentro: grupoP2, planActivo: p2Activo } = await verificarPlanP2Activo(centro, tipo);
      if (!grupoP2 || !p2Activo) {
        return { centro, tipo, status: 'error', mensaje: `No hay un P2 activo de Espumas para el Centro ${centro} — PFD-VENTA necesita un P2 vigente del que derivar.` };
      }

      const user = typeof window !== 'undefined' ? JSON.parse(localStorage.getItem('user') || '{}') : {};
      const usuario = user?.name || 'admin';

      // Búsqueda propia del PFD-VENTA activo (mismo patrón que verificarPlanP2Activo, con su propia
      // regex — no se reutiliza esa función porque busca por "...p2...", no por "...pfd-venta...").
      const valorRegexPfd = new RegExp(`plan\\s*t[aá]ctico.*centro.*${centro}.*pfd-venta.*${tipo}`, 'i');
      const planesRes = await sapCompartido.planGrupos();
      const todosLosPlanes = planesRes.data || [];
      const planesActivosPfd = todosLosPlanes.filter(pg =>
        pg.estado === 'A' && pg.codigo_grupo === grupoP2.codigo_grupo && valorRegexPfd.test(String(pg.valor || ''))
      );
      for (const pg of planesActivosPfd) {
        await desactivarPlanGrupo(pg);
      }

      const planPayload = {
        codigo_plan_grupo: 0,
        codigo_grupo: grupoP2.codigo_grupo,
        codigo_familia_grupo: null,
        codigo_plan: null,
        valor: `Plan Táctico - Centro ${centro} - PFD-VENTA - ${TIPO_TAG[tipo]}`,
        // Misma ventana que el P2 del que deriva — PFD-VENTA no tiene fecha propia, hereda la del
        // ciclo que lo originó.
        fecha_inicio_plan: ecuadorMidnightISO(soloFecha(p2Activo.fecha_inicio_plan) || format(siguienteDiaHabil(new Date()), 'yyyy-MM-dd')),
        fecha_fin_plan: ecuadorMidnightISO(soloFecha(p2Activo.fecha_fin_plan) || format(siguienteDiaHabil(new Date()), 'yyyy-MM-dd')),
        estado: 'A',
        usuario_creacion: usuario,
        fecha_creacion: ecuadorNowNaiveISO(),
      };
      const planResponse = await planGrupoService.save(planPayload as unknown as PlanGrupo);
      const codigoPlanGrupo = planResponse.data.codigo_plan_grupo;

      let agregados = 0;
      let fallidos = 0;
      for (const linea of lineas) {
        try {
          const detallePayload = {
            codigo_detalle_tactico: 0,
            codigo_material: Number(linea.material),
            cantidad_produccion_neta: Math.round(linea.cantidad).toFixed(0),
            resp_ctrl_prod: '',
            clase_aprovisionamiento: 'E',
            cantidad_aprovisionamiento: 0,
            estado: 'A',
            codigo_plan_grupo: codigoPlanGrupo,
            codigo_plan_grupo_padre: p2Activo.codigo_plan_grupo,
            usuario_modificacion: usuario,
            linea_produccion: matchLineaProduccion(linea.material, centro === '1000' ? tiempoLookup1000 : tiempoLookup2000),
          };
          await detalleTacticoService.save(detallePayload as unknown as DetalleTactico);
          agregados++;
        } catch (error) {
          console.warn(`[PFD-VENTA] Falló material ${linea.material}:`, (error as Error).message);
          fallidos++;
        }
      }

      setPfdVentaGenerado(prev => ({ ...prev, [key]: codigoPlanGrupo }));
      const sufijo = planesActivosPfd.length > 0
        ? ` Plan(es) anterior(es) #${planesActivosPfd.map(p => p.codigo_plan_grupo).join(', #')} desactivado(s).`
        : '';
      if (fallidos === 0) {
        return { centro, tipo, status: 'ok', codigoPlan: codigoPlanGrupo, mensaje: `PFD-VENTA Centro ${centro}: Plan #${codigoPlanGrupo} creado (${agregados} materiales), derivado del P2 #${p2Activo.codigo_plan_grupo}.${sufijo}` };
      }
      return { centro, tipo, status: 'ok', codigoPlan: codigoPlanGrupo, mensaje: `PFD-VENTA Centro ${centro}: Plan #${codigoPlanGrupo} creado (${agregados} materiales), ${fallidos} fallidos.${sufijo}` };
    } catch (error) {
      return { centro, tipo, status: 'error', mensaje: `PFD-VENTA Centro ${centro}: error al guardar — ${(error as Error).message}` };
    } finally {
      setSavingPfdVenta(prev => ({ ...prev, [key]: false }));
    }
  }, [pfdVentaPreview, siguienteDiaHabil, tiempoLookup1000, tiempoLookup2000, resultadoRestaurado]);

  // Una sola lectura de Plan Grupo / Detalle Táctico para la vista previa y los guardados (ver
  // lecturaP2Ref). Se consumen con .catch para no dejar una promesa rechazada sin manejar si ningún
  // combo llega a leerla.
  const iniciarLecturaP2 = () => {
    const planes = sapCompartido.planGrupos();
    // Solo los detalles que usa verificarPlanP2Activo (2026-10-12, endpoint por plan_grupo): los P2 de
    // VE activos y los P3 activos creados desde el P2 más viejo (sus respuestas). Antes, tabla completa.
    const detalles = planes.then(async r => {
      const todos = r.data || [];
      const p2 = todos.filter(pg => pg.estado === 'A' && /p2\s*-\s*venta/i.test(String(pg.valor || '')));
      const desde = p2.map(pg => fechaCreacion(pg.fecha_creacion) || soloFecha(pg.fecha_inicio_plan)).filter(Boolean).sort()[0] || '';
      const p3 = todos.filter(pg => pg.estado === 'A' && esPlanP3(pg.valor) && (!desde || (fechaCreacion(pg.fecha_creacion) || soloFecha(pg.fecha_inicio_plan)) >= desde));
      return { data: await detallesDePlanes([...p2, ...p3].map(pg => pg.codigo_plan_grupo)) };
    });
    planes.catch(() => {}); detalles.catch(() => {});
    lecturaP2Ref.current = { planes, detalles };
  };

  // Ventana "Confirmar P2" antes de escribir (usuario 2026-10-28): muestra qué se crea/actualiza y qué
  // P2 anteriores se desactivan. Aceptarla equivale a forzar=true (reemplaza el antiguo window.confirm
  // de 'confirmar-reemplazo'). Si no hay nada que grabar ni apagar, no se pregunta.
  const confirmarP2 = useCallback(async (combos: Array<{ centro: '1000' | '2000'; tipo: 'ESPUMAS' | 'ROLLOS' }>): Promise<boolean> => {
    if (resultadoRestaurado) return true; // generarPlanP2Core ya corta con su propio mensaje
    const previas = await Promise.all(combos.map(c => previsualizarP2(c.centro, c.tipo)));
    if (previas.every(p => p.accion === 'sin-cambios')) return true;
    return pedirConfirmacionP2(previas);
  }, [resultadoRestaurado, previsualizarP2, pedirConfirmacionP2]);

  // Botón individual por bloque: genera un solo subgrupo y notifica su resultado puntual.
  const handleGenerarPlanP2 = useCallback(async (centro: '1000' | '2000', tipo: 'ESPUMAS' | 'ROLLOS') => {
    iniciarLecturaP2();
    try {
      if (!(await confirmarP2([{ centro, tipo }]))) {
        addNotification('warning', `P2 ${TIPO_TAG[tipo]} Centro ${centro}: cancelado por el usuario, no se hizo ningún cambio.`);
        return;
      }
      const resultado = await generarPlanP2Core(centro, tipo, true);
      const nivel = resultado.status === 'ok' ? 'success' : resultado.status === 'sin-datos' ? 'warning' : 'error';
      addNotification(nivel, resultado.mensaje);
    } catch (e) {
      addNotification('error', `Error al generar el P2: ${(e as Error).message}`);
    } finally {
      lecturaP2Ref.current = null;
    }
  }, [confirmarP2, generarPlanP2Core, addNotification]);

  // Botón único "Generar Todos los P2": recorre los 3 subgrupos vigentes SECUENCIALMENTE (cada uno
  // hace su propia verificación P3 + guardado/actualización; correrlos en paralelo arriesgaría
  // condiciones de carrera sobre el mismo PlanGrupo activo), y consolida los resultados en un único
  // resumen — no dispara notificaciones sueltas. Rollos - Centro 2000 no aplica: no hay actividad de
  // Corte y Laminado en ese centro.
  // silencioso / onAvance: desde el panel de progreso (Sincronizar) el resumen y el avance (x/3) se
  // muestran en el panel; desde el botón manual sigue el toast de siempre.
  const handleGenerarTodosPlanesP2 = useCallback(async (silencioso = false, onAvance?: (hechos: number, total: number) => void): Promise<{ estado: 'ok' | 'aviso' | 'error'; mensaje: string }> => {
    setIsSavingAllPlanP2(true);
    iniciarLecturaP2();
    try {
      const combos: Array<{ centro: '1000' | '2000'; tipo: 'ESPUMAS' | 'ROLLOS' }> = [
        { centro: '1000', tipo: 'ESPUMAS' },
        { centro: '1000', tipo: 'ROLLOS' },
        { centro: '2000', tipo: 'ESPUMAS' },
      ];

      // Una sola ventana para los 3 subgrupos; cancelar no escribe nada.
      if (!(await confirmarP2(combos))) {
        const mensaje = 'Generación de P2 cancelada por el usuario: no se hizo ningún cambio.';
        if (!silencioso) addNotification('warning', mensaje);
        return { estado: 'aviso', mensaje };
      }

      const resultados: ResultadoGeneracionP2[] = [];
      for (const combo of combos) {
        const resultado = await generarPlanP2Core(combo.centro, combo.tipo, true);
        resultados.push(resultado);
        onAvance?.(resultados.length, combos.length);
      }

      const ok = resultados.filter(r => r.status === 'ok');
      const bloqueados = resultados.filter(r => r.status === 'bloqueado');
      const sinDatos = resultados.filter(r => r.status === 'sin-datos');
      const errores = resultados.filter(r => r.status === 'error');

      const resumen = resultados.map(r => `[${r.status.toUpperCase()}] ${r.mensaje}`).join(' | ');
      if (errores.length === 0 && bloqueados.length === 0) {
        const mensaje = `${ok.length} plan(es) guardado(s), ${sinDatos.length} sin datos.`;
        if (!silencioso) addNotification('success', `Generación completa: ${mensaje} ${resumen}`);
        return { estado: 'ok', mensaje };
      }
      const mensaje = `${ok.length} ok, ${bloqueados.length} bloqueado(s), ${sinDatos.length} sin datos, ${errores.length} error(es). ${resumen}`;
      if (!silencioso) addNotification('warning', `Generación con incidencias: ${mensaje}`);
      return { estado: errores.length > 0 ? 'error' : 'aviso', mensaje };
    } catch (e) {
      if (!silencioso) addNotification('error', `Error al generar los P2: ${(e as Error).message}`);
      return { estado: 'error', mensaje: (e as Error).message };
    } finally {
      lecturaP2Ref.current = null;
      setIsSavingAllPlanP2(false);
    }
  }, [confirmarP2, generarPlanP2Core, addNotification]);

  // Tercera fase de "Sincronizar" (ver el efecto de handleCalcularNecesidadRollos más arriba, y el
  // comentario de autoGenerarP2Pendiente en su declaración): dispara "Generar Todos los P2"
  // automáticamente en cuanto la necesidad recién calculada ya se reflejó en el estado — así un plan
  // vencido (nadie lo regeneró para hoy) queda desactivado solo, en vez de depender exclusivamente de
  // que alguien pulse el botón manual. Declarado después de handleGenerarTodosPlanesP2 para que la
  // referencia ya sea la versión fresca (sus dependencias, necesidadEspumas/Rollos 1000/2000, ya se
  // recalcularon con handleCalcularNecesidadRollos) — mismo patrón que la fase anterior.
  // Paso 1 · P2 (pestañas-paso, 2026-10-12): el P2 se genera a pedido — botón de la pestaña 1 o acción
  // del panel tras Sincronizar —, ya no automáticamente al sincronizar.
  const handleGenerarP2ConPanel = useCallback(async () => {
    panelProgreso.iniciar('Venta Externa — 1 · Generar P2', [{ id: 'p2gen', etiqueta: 'Generando P2 (Espumas / Rollos)' }]);
    panelProgreso.actualizar('p2gen', { estado: 'en_curso', progreso: { actual: 0, total: 3 } });
    const r = await handleGenerarTodosPlanesP2(true, (hechos, total) => panelProgreso.actualizar('p2gen', { progreso: { actual: hechos, total } }));
    panelProgreso.actualizar('p2gen', { estado: r.estado, detalle: r.mensaje });
    setRecargaEstadoDia(n => n + 1);
    panelProgreso.concluir(
      r.estado !== 'ok' ? undefined : 'P2 guardado. Cuando Laminado y Corte Espuma respondan su P3, sigue en 2 · Data Aprobada.',
      r.estado !== 'ok' ? undefined : [{ etiqueta: 'Ir a 2 · Data Aprobada', onClick: () => setActiveTab('dataAprobada') }],
    );
  }, [handleGenerarTodosPlanesP2, panelProgreso]);

  // Fase P2 de Sincronizar (ver autoGenerarP2Pendiente): acá handleGenerarTodosPlanesP2 ya ve la
  // necesidad recién calculada. Corre en el mismo panel de la sincronización.
  useEffect(() => {
    if (!autoGenerarP2Pendiente) return;
    setAutoGenerarP2Pendiente(false);
    panelProgreso.actualizar('p2', { estado: 'en_curso', progreso: { actual: 0, total: 3 } });
    handleGenerarTodosPlanesP2(true, (hechos, total) => panelProgreso.actualizar('p2', { progreso: { actual: hechos, total } }))
      .then(
        r => {
          panelProgreso.actualizar('p2', { estado: r.estado, detalle: r.mensaje });
          panelProgreso.concluir(
            r.estado !== 'ok' ? undefined : 'P2 guardado. Cuando Laminado y Corte Espuma respondan su P3, sigue en 2 · Data Aprobada.',
            r.estado !== 'ok' ? undefined : [{ etiqueta: 'Ir a 2 · Data Aprobada', onClick: () => setActiveTab('dataAprobada') }],
          );
        },
        e => {
          panelProgreso.actualizar('p2', { estado: 'error', detalle: (e as Error).message });
          panelProgreso.concluir();
        },
      )
      .finally(() => {
        setRecargaEstadoDia(n => n + 1);
        setSyncStep('idle');
      });
  }, [autoGenerarP2Pendiente, handleGenerarTodosPlanesP2, panelProgreso]);

  // "Data Aprobada": por cada P2 propio activo (Espumas/Rollos por centro), recupera qué respondió
  // el plan consumidor "P3" (nunca "PFD" — ver esPlanP3) — un DetalleTactico con
  // codigo_plan_grupo_padre = nuestro plan y el mismo codigo_material, pero perteneciente a OTRO
  // codigo_plan_grupo (el del P3). Si un material tiene más de una respuesta (varios P3), se suman
  // las cantidades y se listan los planes separados por coma. Se recalcula siempre contra la API (no
  // depende de haber corrido "Calcular Necesidad" en la misma sesión), así sigue funcionando después
  // de recargar la página.
  // silencioso (consulta automática al entrar a la pestaña): sin toast.
  const fetchDataAprobada = useCallback(async (silencioso = false): Promise<{ estado: 'ok' | 'aviso' | 'error'; mensaje: string }> => {
    setIsLoadingDataAprobada(true);
    try {
      const planes = (await sapCompartido.planGrupos()).data || [];
      const planPorCodigo = new Map(planes.map(pg => [pg.codigo_plan_grupo, pg]));
      // Solo los detalles que se usan (2026-10-12, endpoint por plan_grupo): nuestros P2 activos y los
      // P3 activos creados desde el P2 más viejo — las respuestas viven en esos P3 (padre = nuestro
      // P2). Antes se bajaba detalle_tactico completo (~80 MB).
      const p2Propios = planes.filter(pg => pg.estado === 'A' && /p2\s*-\s*venta/i.test(String(pg.valor || '')) && !/diferido/i.test(String(pg.valor || '')));
      const desdeP2 = p2Propios.map(pg => fechaCreacion(pg.fecha_creacion) || soloFecha(pg.fecha_inicio_plan)).filter(Boolean).sort()[0] || '';
      const p3Candidatos = planes.filter(pg => pg.estado === 'A' && esPlanP3(pg.valor) &&
        (!desdeP2 || (fechaCreacion(pg.fecha_creacion) || soloFecha(pg.fecha_inicio_plan)) >= desdeP2));
      const detalles = await detallesDePlanes([...p2Propios, ...p3Candidatos].map(pg => pg.codigo_plan_grupo));

      const descripcionPorMaterial = new Map<string, string>();
      [...necesidadEspumas1000, ...necesidadEspumas2000, ...necesidadRollos1000, ...necesidadRollos2000]
        .forEach(n => descripcionPorMaterial.set(n.material, n.descripcion));

      const combos: Array<{ centro: '1000' | '2000'; tipo: 'ESPUMAS' | 'ROLLOS' }> = [
        { centro: '1000', tipo: 'ESPUMAS' },
        { centro: '1000', tipo: 'ROLLOS' },
        { centro: '2000', tipo: 'ESPUMAS' },
      ];

      const resultado: Record<string, DataAprobadaRow[]> = {};

      for (const combo of combos) {
        const key = `${combo.centro}-${combo.tipo}`;
        const grupoCentro = grupos.find(g => String(g.centro).trim() === combo.centro);
        if (!grupoCentro) { resultado[key] = []; continue; }

        const valorRegex = new RegExp(`plan\\s*t[aá]ctico.*centro.*${combo.centro}.*p2.*${combo.tipo}`, 'i');
        const planPropio = planes.find(pg =>
          pg.estado === 'A' && pg.codigo_grupo === grupoCentro.codigo_grupo && valorRegex.test(String(pg.valor || '')) &&
          !/diferido/i.test(String(pg.valor || ''))
        );
        if (!planPropio) { resultado[key] = []; continue; }

        // Emparejamiento P2 vs P3 (regla del usuario 2026-10-03): el P3 de Corte Espuma / Laminado
        // graba SOLO el faltante a fabricar, sin líneas en 0. Un material del P2 sin línea en el P3
        // está cubierto por stock/provisional — pero solo si el consumidor respondió ESTE ciclo: un P3
        // activo del mismo centro y canal, creado el día del P2 o después y fechado (recuperación)
        // antes o el mismo día del PT del P2. Sin ese P3, nada se da por cubierto (pendiente).
        const fechaCreacionP2 = fechaCreacion(planPropio.fecha_creacion);
        const ptP2 = soloFecha(planPropio.fecha_fin_plan) || soloFecha(planPropio.fecha_inicio_plan);
        const canalP3 = combo.tipo === 'ESPUMAS' ? 'espuma' : 'rollo';
        const p3DelCiclo = planes.filter(pg => {
          const valor = String(pg.valor || '');
          if (pg.estado !== 'A' || !esPlanP3(valor) || !new RegExp(`centro\\s*${combo.centro}`, 'i').test(valor) || !new RegExp(canalP3, 'i').test(valor)) return false;
          const fechaP3 = soloFecha(pg.fecha_inicio_plan);
          return fechaCreacion(pg.fecha_creacion) >= fechaCreacionP2 && fechaP3 >= fechaCreacionP2 && fechaP3 <= ptP2;
        }).sort((a, b) => b.codigo_plan_grupo - a.codigo_plan_grupo)[0];

        const misLineas = detalles.filter(d => d.estado === 'A' && d.codigo_plan_grupo === planPropio.codigo_plan_grupo);
        resultado[key] = misLineas.map(linea => {
          const respuestas = detalles.filter(d =>
            d.estado === 'A' &&
            d.codigo_plan_grupo_padre === planPropio.codigo_plan_grupo &&
            d.codigo_material === linea.codigo_material &&
            d.codigo_plan_grupo !== planPropio.codigo_plan_grupo &&
            esPlanP3(planPorCodigo.get(d.codigo_plan_grupo)?.valor)
          );
          const cantidad = parseQty(linea.cantidad_produccion_neta);
          const aProducir = respuestas.reduce((s, r) => s + parseQty(r.cantidad_produccion_neta), 0);
          // Espumas: el P3 de Corte Espuma graba solo lo que fabrica (faltante + provisional), así que
          // respondido = la entrega completa (lo que no está en el P3 lo cubren stock/FERT).
          // Rollos (usuario 2026-10-03): el P3 de Laminado graba stock + corridas — ESA suma es la
          // respuesta real; sin línea = pendiente (sin corrida ni stock) y menos que el P2 = parcial.
          const esRollos = combo.tipo === 'ROLLOS';
          const respondido = esRollos ? respuestas.length > 0 : respuestas.length > 0 || !!p3DelCiclo;
          const respuestaCant = esRollos ? aProducir : respondido ? cantidad : 0;
          const codigosPlanesRespuesta = Array.from(new Set(respuestas.map(r => r.codigo_plan_grupo)));
          const planGrupo = codigosPlanesRespuesta.length > 0
            ? codigosPlanesRespuesta.map(c => String(c).padStart(3, '0')).join(', ')
            : p3DelCiclo && !esRollos ? String(p3DelCiclo.codigo_plan_grupo).padStart(3, '0') : '—';

          // Contraste de fechas: se compara por LÍNEA (fecha_modificacion de DetalleTactico, que fija
          // el backend al guardar — no lo controla el cliente), no por rango de PlanGrupo. Laminado
          // ahora fuerza fecha_inicio_plan/fecha_fin_plan del P3 siempre a "hoy+1" al guardar (dejó de
          // representar un período de producción), así que ya no es comparable contra el rango del P2.
          // Regla de negocio: "revisión hoy, devolución mañana" — la respuesta debe haberse guardado
          // EXACTAMENTE un día después de la última vez que se guardó/refrescó nuestra línea del P2.
          let fechasOk: boolean | null = null;
          // fechaLocalEcuador directo (NO soloFecha, que ahora es naive para fecha_inicio/fin_plan):
          // fecha_modificacion la genera el backend, sigue siendo un instante UTC real.
          const fechaLineaP2 = fechaLocalEcuador(linea.fecha_modificacion);
          if (respuestas.length > 0) {
            fechasOk = !!fechaLineaP2 && respuestas.every(r => {
              const fechaLineaP3 = fechaLocalEcuador(r.fecha_modificacion);
              if (!fechaLineaP3) return false;
              const fechaEsperada = format(addDays(parseISO(fechaLineaP2), 1), 'yyyy-MM-dd');
              return fechaLineaP3 === fechaEsperada;
            });
          }

          return {
            material: String(linea.codigo_material),
            descripcion: descripcionPorMaterial.get(String(linea.codigo_material)) || '—',
            cantidad,
            respuestaCant,
            aProducir,
            // Rollos: la línea del P3 ya incluye el stock (no se puede separar), va todo en "A producir".
            cubiertoStock: respondido && !esRollos ? Math.max(0, cantidad - aProducir) : 0,
            planGrupo,
            fechasOk,
          };
        }).sort((a, b) => a.material.localeCompare(b.material));
      }

      setDataAprobada(resultado);
      setDataAprobadaFetchedAt(new Date());
      // Mantiene el snapshot en sync — si el usuario navega a otro módulo y vuelve, este tab ya no
      // aparece vacío (ver SnapshotVentaExterna.dataAprobada). No-op si todavía no se sincronizó
      // ningún dato base (actualizarEnCache no escribe sobre un snapshot inexistente).
      actualizarEnCache<SnapshotVentaExterna>(CACHE_VENTA_EXTERNA, { dataAprobada: resultado });
      // Resumen para el panel de la etapa 2: cuántas líneas ya tienen respuesta por bloque.
      const partes = Object.entries(resultado).map(([k, rows]) => {
        const respondidas = rows.filter(r => r.respuestaCant > 0 || r.planGrupo !== '—').length;
        return `${k.replace('-', ' ')}: ${respondidas}/${rows.length}`;
      });
      const sinRespuesta = Object.values(resultado).some(rows => rows.some(r => r.planGrupo === '—'));
      return {
        estado: sinRespuesta ? 'aviso' : 'ok',
        mensaje: `${partes.join(' · ')}${sinRespuesta ? ' — hay materiales sin respuesta P3 (revisa que Laminado/Corte Espuma terminaron su etapa 1).' : ''}`,
      };
    } catch (error) {
      if (!silencioso) addNotification('error', `Error al recuperar Data Aprobada: ${(error as Error).message}`);
      return { estado: 'error', mensaje: (error as Error).message };
    } finally {
      setIsLoadingDataAprobada(false);
    }
  }, [grupos, necesidadEspumas1000, necesidadEspumas2000, necesidadRollos1000, necesidadRollos2000, addNotification]);

  // Paso 2 · Data Aprobada (2026-10-12): se consulta sola al entrar a la pestaña — no hay fecha que
  // elegir, son las respuestas al P2 activo de hoy. Se repite si la última consulta tiene más de 5 min
  // (el usuario vuelve después de que Laminado/Corte Espuma respondieron).
  useEffect(() => {
    if (activeTab !== 'dataAprobada' || !datosCargados || resultadoRestaurado || isLoadingDataAprobada) return;
    if (dataAprobadaFetchedAt && Date.now() - dataAprobadaFetchedAt.getTime() < 5 * 60_000) return;
    void fetchDataAprobada(true);
  }, [activeTab, datosCargados]); // eslint-disable-line react-hooks/exhaustive-deps

  // Capacidad de Empaque en horas, por centro — suma de sus máquinas activas (Día+Noche+Sábado según
  // config, menos % de paro y mantenimiento preventivo real). Operadores por turno son informativos
  // (no multiplican la capacidad), mismo criterio que Corte Espuma ya aplica a su propio campo de
  // operador (ver comentario "el campo ni se muestra ni ocupa espacio" en ese módulo).
  // Ventana del plan de Empaque (mismo concepto que Corte Espuma / Laminado, pedido del usuario
  // 2026-10-02): el plan es del siguiente día hábil y se ejecuta desde la NOCHE del último día hábil
  // L-V anterior, pasando por el sábado (solo si su turno está activo), hasta el fin del turno DÍA
  // del plan. Ej. hoy vie 02/10 → plan lun 05/10: Noche vie 02/10 → (Sábado 03/10) → Día lun 05/10.
  const ventanaEmpaque = useMemo(() => {
    // Empaque trabaja el día del PT (hoy+2 hábiles, decisión del usuario 2026-10-02).
    const diaPlan = parseISO(fechasHorizonte.pt);
    let noche = addBusinessDaysCal(diaPlan, -1, diasNoLaborables, diasLaborablesExtra);
    while (getDay(noche) === 6 || getDay(noche) === 0) noche = addBusinessDaysCal(noche, -1, diasNoLaborables, diasLaborablesExtra);
    const sabados: Date[] = [];
    for (let d = addDays(noche, 1); d < diaPlan; d = addDays(d, 1)) if (getDay(d) === 6) sabados.push(d);
    const etiqueta = (opciones: { v: string; l: string }[], v: string) => (v === 'EMPTY' ? null : opciones.find(o => o.v === v)?.l ?? null);
    const turnosDe = (machineId: string) => {
      const c = empaqueConfig[machineId];
      if (!c || !c.activa) return [];
      const turnos: { turno: 'Noche' | 'Sábado' | 'Día'; ini: Date; fin: Date }[] = [];
      const agregar = (turno: 'Noche' | 'Sábado' | 'Día', dia: Date, l: string | null) => {
        const iv = l ? intervaloDeHorario(dia, l) : null;
        if (iv) turnos.push({ turno, ...iv });
      };
      agregar('Noche', noche, etiqueta(nightShiftOptionsEmpaque, c.night));
      sabados.forEach(d => agregar('Sábado', d, etiqueta(shiftOptionsEmpaque, c.saturday)));
      agregar('Día', diaPlan, etiqueta(shiftOptionsEmpaque, c.day));
      return turnos;
    };
    const porCentro = (centro: '1000' | '2000') => {
      const turnos = EMPAQUE_MACHINES_BY_CENTRO[centro].flatMap(m => turnosDe(m.id));
      if (turnos.length === 0) return null;
      return {
        inicio: new Date(Math.min(...turnos.map(t => t.ini.getTime()))),
        fin: new Date(Math.max(...turnos.map(t => t.fin.getTime()))),
      };
    };
    return { diaPlan, noche, sabados, sabadoCuenta: sabados.length > 0, turnosDe, '1000': porCentro('1000'), '2000': porCentro('2000') };
  }, [fechasHorizonte.pt, diasNoLaborables, diasLaborablesExtra, empaqueConfig, shiftOptionsEmpaque, nightShiftOptionsEmpaque]);

  // Mantenimiento de Empaque desde SAP: la restricción MANTENIMIENTO del grupo de cada centro dice qué
  // máquina(s) SAP son las de empaque (ej. "MEE01", o varias separadas por "&"); de sus órdenes de
  // mantenimiento programado se cuentan solo las horas que caen DENTRO de los turnos de la ventana
  // del plan (mismo criterio que Corte Espuma / Laminado). SAP sugiere; el planificador puede ajustar
  // (mttoManual), igual que la corrida pendiente de Laminado.
  const mttoSAPEmpaque = useMemo(() => {
    const norm = (v: unknown) => String(v ?? '').trim().toUpperCase();
    // Primer campo con valor (los endpoints de SAP varían mayúsculas/nombres entre versiones).
    const getProp = (row: Record<string, unknown>, keys: string[]) => {
      for (const k of keys) if (row[k] !== undefined && row[k] !== null && row[k] !== '') return row[k];
      return '';
    };
    const resultado: Record<string, { horas: number; maquinas: string[]; ordenes: { maquina: string; inicio: string; horas: number }[] }> = {};
    (['1000', '2000'] as const).forEach(centro => {
      // Todos los grupos de Venta Externa del centro (usuario 2026-10-09: la restricción MANTENIMIENTO
      // MEE01 existía, pero en un grupo distinto del primero y salía "Sin restricción").
      const gruposCentro = grupos.filter(g => String(g.centro).trim() === centro).map(g => g.codigo_grupo);
      const maquinasSAP = [...new Set(restricciones
        .filter(r => gruposCentro.includes(r.codigo_grupo) && r.estado === 'A' && norm(r.nombre_restriccion) === 'MANTENIMIENTO')
        .flatMap(r => String(r.valor_restriccion || '').split(/[&,;]/).map(norm))
        .filter(Boolean))];
      EMPAQUE_MACHINES_BY_CENTRO[centro].forEach(m => {
        const turnos = ventanaEmpaque.turnosDe(m.id);
        const ordenes = maquinasSAP.length === 0 ? [] : mantenimientosSAP.flatMap(row => {
          // 2026-10-28 (nueva captura del SP): AREA = Corte y Laminado y máquina por MaquinaSismac
          // (MEE01 = Empacadora Elektroteks), mismo criterio que Corte Espuma y Laminado.
          if (!/^corte\s+y\s+laminado$/i.test(String(getProp(row, ['AREA'])).trim())) return [];
          const maquina = norm(getProp(row, ['MaquinaSismac']) || getProp(row, ['ID_MAQUINA', 'MAQUINA']));
          if (!maquinasSAP.includes(maquina)) return [];
          // Regla única de los 3 módulos (ver mttoEnVentana): con hora real, el turno donde cae
          // (también la Noche); solo con fecha (SISMAC, 0:00), completo en el turno Día de ese día.
          const iniStr = String(getProp(row, ['FECHA_OT_PRG_INI']) || getProp(row, ['FECHA_PRO']));
          const ini = new Date(iniStr);
          const fin = new Date(String(getProp(row, ['FECHA_OT_PRG_FIN'])));
          const durMin = Number(getProp(row, ['Duracion_Minutos'])) || Number(getProp(row, ['TIEMPO'])) || 0;
          const duracionH = durMin > 0 ? durMin / 60 : (!isNaN(ini.getTime()) && !isNaN(fin.getTime()) && fin > ini ? (fin.getTime() - ini.getTime()) / 3600000 : 0);
          const r = mttoEnVentana({ inicio: iniStr, fin: getProp(row, ['FECHA_OT_PRG_FIN']), fecha: getProp(row, ['FECHA_PRO']) || iniStr, duracionH }, turnos);
          if (!r || r.horas <= 0) return [];
          return [{ maquina, inicio: format(r.conHora ? ini : r.turno.ini, 'EEE dd/MM HH:mm', { locale: es }), horas: r.horas }];
        });
        resultado[m.id] = { horas: ordenes.reduce((acc, o) => acc + o.horas, 0), maquinas: maquinasSAP, ordenes };
      });
    });
    return resultado;
  }, [restricciones, grupos, mantenimientosSAP, ventanaEmpaque]);
  // Mantenimiento que se descuenta: el ajustado a mano, o el que trae SAP para la ventana.
  const mttoEmpaqueDe = useCallback((id: string) => {
    const c = empaqueConfig[id];
    if (!c) return 0;
    return c.mttoManual ? c.mttoPreventivoHoras : (mttoSAPEmpaque[id]?.horas ?? 0);
  }, [empaqueConfig, mttoSAPEmpaque]);

  // Horas de UNA máquina de empaque: bruto (Día+Noche+Sábado, sin paros ni rendimiento — "Tiempo
  // Máquina" de la columna, como Corte Espuma) y neto (con paros y rendimiento, menos mantenimiento).
  const horasMaquinaEmpaque = useCallback((id: string) => {
    const c = empaqueConfig[id];
    if (!c || !c.activa) return { bruto: 0, neto: 0 };
    const hDay = shiftOptionsEmpaque.find(o => o.v === c.day)?.h || 0;
    const hNight = nightShiftOptionsEmpaque.find(o => o.v === c.night)?.h || 0;
    // El Turno Sábado solo suma si un sábado cae dentro de la ventana del plan (ver ventanaEmpaque).
    const hSat = ventanaEmpaque.sabadoCuenta ? (shiftOptionsEmpaque.find(o => o.v === c.saturday)?.h || 0) : 0;
    // Rendimiento de la máquina (Rendimiento_<máquina>, ej. Electrotecks 56%) sobre las horas netas
    // de paros; luego se descuenta el mantenimiento — mismo orden que Corte Espuma.
    const neto = (hDay * (1 - c.paroDay / 100) + hNight * (1 - c.paroNight / 100) + hSat * (1 - c.paroSaturday / 100)) * (c.rendimiento / 100);
    return { bruto: hDay + hNight + hSat, neto: Math.max(0, neto - mttoEmpaqueDe(id)) };
  }, [empaqueConfig, shiftOptionsEmpaque, nightShiftOptionsEmpaque, ventanaEmpaque.sabadoCuenta, mttoEmpaqueDe]);

  // Personal que se puede asignar en Empaque (línea de proceso EMPAQUE de cuboHabilidadesOP) y, si
  // no hay nadie, las líneas que sí trae el servicio para identificar la correcta.
  // Una vez por persona: el mismo operador puede tener varias líneas que contienen "EMPAQUE" y se
  // repetía en el selector (aviso de React por clave duplicada, ej. 2073).
  const operadoresEmpaque = useMemo(() => {
    const porCodigo = new Map<string, OperadorHabilidad>();
    habilidadesOP.forEach(o => { if (o.linea.includes(LINEA_PROCESO_EMPAQUE) && !porCodigo.has(o.codigo)) porCodigo.set(o.codigo, o); });
    return [...porCodigo.values()];
  }, [habilidadesOP]);
  const lineasProcesoDisponibles = useMemo(() => [...new Set(habilidadesOP.map(o => o.linea).filter(Boolean))].sort(), [habilidadesOP]);

  const capacidadEmpaquePorCentro = useMemo(() => {
    const calcular = (centro: '1000' | '2000') => EMPAQUE_MACHINES_BY_CENTRO[centro].reduce((total, m) => total + horasMaquinaEmpaque(m.id).neto, 0);
    return { '1000': calcular('1000'), '2000': calcular('2000') };
  }, [horasMaquinaEmpaque]);

  // Bloque Espumas del resumen de Empaque: nivel FERT/PT (producto TERMINADO que de verdad se empaca),
  // no el componente/semi-elaborado — sube desde Data Aprobada "completo" hasta su FERT/PT padre
  // (misma trazabilidad de generarPfdVentaPreview/pfdVentaPreview, reutilizada tal cual en vez de
  // duplicarla). Agrupado por categoría (no por material individual) para que el correo no salga muy
  // extenso — mismo criterio que ya usa "Resumen Necesidades" (calculateSummary) para su propia tabla
  // compacta por categoría/densidad.
  const bloqueEspumasEmpaque = (preview: PfdVentaPreview | undefined | null) => {
    if (!preview || preview.lineas.length === 0) return null;
    const map = new Map<string, { categoria: string; materiales: number; cantidad: number; horas: number; paquetes: number; paquetesEnrollar: number }>();
    // Paquetes de planchas por material (ver paquetesPlancha), igual que la Salida de Datos.
    const planchas = new Map<string, { cat: string; qty: number; esp: string; enrollar: boolean }>();
    preview.lineas.forEach(l => {
      const cat = l.categoria || '—';
      if (!map.has(cat)) map.set(cat, { categoria: cat, materiales: 0, cantidad: 0, horas: 0, paquetes: 0, paquetesEnrollar: 0 });
      const e = map.get(cat)!;
      e.materiales += 1;
      e.cantidad += l.cantidad;
      e.horas += l.tiempoHoras;
      if (ES_PLANCHA.test(l.descripcion)) {
        const k = `${cat}|${l.material}`;
        const p = planchas.get(k) || { cat, qty: 0, esp: extractMaterialInfo({ NOMBRE: l.descripcion }).esp, enrollar: ES_C_PLANCHA.test(l.descripcion) };
        p.qty += l.cantidad;
        planchas.set(k, p);
      }
    });
    planchas.forEach(p => {
      const e = map.get(p.cat)!;
      const n = paquetesPlancha(p.qty, p.esp);
      e.paquetes += n;
      if (p.enrollar) e.paquetesEnrollar += n;
    });
    const filas = Array.from(map.values()).sort((a, b) => b.horas - a.horas);
    return { filas, totalCantidad: filas.reduce((s, f) => s + f.cantidad, 0), totalHoras: filas.reduce((s, f) => s + f.horas, 0) };
  };

  // Bloque Rollos: nivel FERT/PT por categoría, igual que Espumas (usuario 2026-10-09) — ver
  // preview.rollos en generarPfdVentaPreview (tiempo del servicio por FERT/PT, # Rollos por PesoUN
  // del Maestro Looper). Solo Centro 1000.
  const bloqueRollosEmpaque = (centro: '1000' | '2000', preview: PfdVentaPreview | undefined | null): BloqueRollosEmpaque | null => {
    if (centro !== '1000') return null;
    if (resultadoRestaurado) {
      const b = resultadoRestaurado.bloqueRollos1000;
      // Planes guardados antes del 2026-10-09: filas por componente (material/respuestaCant).
      const filasViejas = b?.filas as unknown as { categoria?: string; material?: string; respuestaCant?: number; horas: number }[] | undefined;
      if (b && filasViejas?.some(f => f.categoria === undefined)) {
        return { ...b, filas: filasViejas.map(f => ({ categoria: f.material ?? '—', materiales: 1, cantidad: f.respuestaCant ?? 0, rollos: 0, horas: f.horas })) };
      }
      return b;
    }
    const r = preview?.rollos;
    if (!r || r.lineas.length === 0) return null;
    const map = new Map<string, BloqueRollosEmpaque['filas'][number]>();
    r.lineas.forEach(l => {
      if (!map.has(l.categoria)) map.set(l.categoria, { categoria: l.categoria, materiales: 0, cantidad: 0, rollos: r.rollosPorCategoria[l.categoria] || 0, horas: 0 });
      const e = map.get(l.categoria)!;
      e.materiales += 1;
      e.cantidad += l.cantidad;
      e.horas += l.tiempoHoras;
    });
    const filas = Array.from(map.values()).sort((a, b) => b.horas - a.horas);
    return { filas, totalCantidad: filas.reduce((s, f) => s + f.cantidad, 0), totalHoras: filas.reduce((s, f) => s + f.horas, 0) };
  };

  // Resumen reactivo para el DASHBOARD en pantalla — usa lo que ya haya en `pfdVentaPreview` (última
  // vez que se generó, en esta sesión o antes); no dispara la explosión BOM en cada render, eso solo
  // ocurre al pulsar "Generar" o "Enviar Reporte" (ver reporteFlujoEmpaque, que al guardar refresca la
  // trazabilidad justo antes de armar el correo para no depender de un preview desactualizado).
  const resumenEmpaquePorCentro = useMemo(() => {
    const calcularCentro = (centro: '1000' | '2000') => {
      const espumas = bloqueEspumasEmpaque(pfdVentaPreview[centro]);
      const rollos = bloqueRollosEmpaque(centro, pfdVentaPreview[centro]);
      const totalHoras = (espumas?.totalHoras || 0) + (rollos?.totalHoras || 0);
      const capacidadHoras = capacidadEmpaquePorCentro[centro];
      const ocupacionPct = capacidadHoras > 0 ? (totalHoras / capacidadHoras) * 100 : null;
      return { espumas, rollos, totalHoras, capacidadHoras, ocupacionPct };
    };
    return { '1000': calcularCentro('1000'), '2000': calcularCentro('2000') };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pfdVentaPreview, dataAprobada, tiempoLookup1000, tiempoLookup2000, capacidadEmpaquePorCentro, resultadoRestaurado]);

  // Cuerpo del correo — mismo formato ya aprobado en Corte Espuma/Corte y Laminado (banner CHAIDE Y
  // CHAIDE, tarjetas de totales, tabla de detalle, nota final). `previewEspumas` se recibe como
  // parámetro (no se lee de `pfdVentaPreview`/resumenEmpaquePorCentro acá dentro) porque
  // reporteFlujoEmpaque1000/2000 (construirHtml) ya lo refrescó con `await generarPfdVentaPreview(centro)` en la MISMA
  // corrida — leer el estado en vez del valor devuelto vería la versión vieja por el cierre del
  // render anterior (mismo problema ya documentado en generarPfdVentaPreview).
  const construirReporteHtmlEmpaque = (centro: '1000' | '2000', previewEspumas: PfdVentaPreview | null) => {
    const fechaLabel = format(new Date(), "EEEE d 'de' MMMM 'de' yyyy", { locale: es });
    const espumas = bloqueEspumasEmpaque(previewEspumas);
    const rollos = bloqueRollosEmpaque(centro, previewEspumas);
    const totalHoras = (espumas?.totalHoras || 0) + (rollos?.totalHoras || 0);
    const capacidadHoras = capacidadEmpaquePorCentro[centro];
    const ocupacionPct = capacidadHoras > 0 ? (totalHoras / capacidadHoras) * 100 : null;
    const ocupacionColor = ocupacionPct !== null && ocupacionPct > 100 ? '#b91c1c' : '#047857';

    // Misma tabla para Espumas (# de Paquetes) y Rollos (# Rollos), usuario 2026-10-09.
    const bloqueCategoriaHtml = (titulo: string, b: { filas: { categoria: string; materiales: number; cantidad: number; horas: number; paquetes?: number; paquetesEnrollar?: number; rollos?: number }[]; totalHoras: number } | null, columna: 'paquetes' | 'rollos' = 'paquetes') => !b ? '' : `
  <tr>
    <td style="padding:18px 28px 4px;">
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin-bottom:8px;">
        <tr>
          <td style="font-size:10px;font-weight:700;letter-spacing:0.1em;text-transform:uppercase;color:#6b7280;">${titulo}</td>
          <td align="right" style="font-size:10px;font-weight:700;color:#b45309;">${b.totalHoras.toFixed(2)} h</td>
        </tr>
      </table>
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border:1px solid #e5e7eb;border-radius:10px;overflow:hidden;">
        <tr style="background:#f9fafb;">
          <td style="padding:8px 10px;font-size:9px;font-weight:700;letter-spacing:0.05em;text-transform:uppercase;color:#6b7280;border-bottom:1px solid #e5e7eb;">Categoría</td>
          <td align="right" style="padding:8px 10px;font-size:9px;font-weight:700;letter-spacing:0.05em;text-transform:uppercase;color:#6b7280;border-bottom:1px solid #e5e7eb;">Materiales</td>
          <td align="right" style="padding:8px 10px;font-size:9px;font-weight:700;letter-spacing:0.05em;text-transform:uppercase;color:#6b7280;border-bottom:1px solid #e5e7eb;">Cantidad</td>
          <td align="right" style="padding:8px 10px;font-size:9px;font-weight:700;letter-spacing:0.05em;text-transform:uppercase;color:#0f766e;border-bottom:1px solid #e5e7eb;">${columna === 'rollos' ? '# Rollos' : '# de Paquetes'}</td>
          <td align="right" style="padding:8px 10px;font-size:9px;font-weight:700;letter-spacing:0.05em;text-transform:uppercase;color:#6b7280;border-bottom:1px solid #e5e7eb;">Horas Empaque</td>
        </tr>${b.filas.map((f, i) => `
        <tr style="background:${i % 2 === 0 ? '#ffffff' : '#fafafa'};">
          <td style="padding:7px 10px;font-size:11px;font-weight:600;color:#111827;border-bottom:1px solid #f3f4f6;">${f.categoria}</td>
          <td align="right" style="padding:7px 10px;font-size:11px;color:#374151;border-bottom:1px solid #f3f4f6;font-variant-numeric:tabular-nums;">${f.materiales}</td>
          <td align="right" style="padding:7px 10px;font-size:11px;color:#374151;border-bottom:1px solid #f3f4f6;font-variant-numeric:tabular-nums;">${f.cantidad.toLocaleString()}</td>
          <td align="right" style="padding:7px 10px;font-size:11px;font-weight:700;color:#0f766e;border-bottom:1px solid #f3f4f6;font-variant-numeric:tabular-nums;">${columna === 'rollos' ? (f.rollos ? f.rollos : '—') : f.paquetes ? `${f.paquetes}${f.paquetesEnrollar ? ` <span style="font-size:9px;color:#7e22ce;">(${f.paquetesEnrollar} enrollar)</span>` : ''}` : '—'}</td>
          <td align="right" style="padding:7px 10px;font-size:11px;font-weight:700;color:#b45309;border-bottom:1px solid #f3f4f6;font-variant-numeric:tabular-nums;">${f.horas.toFixed(2)}</td>
        </tr>`).join('')}
      </table>
    </td>
  </tr>`;

    const bloqueRollosHtml = bloqueCategoriaHtml('Detalle por material — Rollos (FERT/PT)', rollos, 'rollos');

    // Turnos/operadores de Empaque — mismo esquema ya aprobado (imagen compartida): Día/Noche/Sábado,
    // operadores por turno (informativo) y mantenimiento preventivo real.
    // Detalle de la máquina — misma estructura que Corte Espuma / Laminado (pedido del usuario
    // 2026-10-02): Turno | Fecha | Horario | horas brutas | paros | horas efectivas | operadores, en el
    // orden en que se ejecuta el plan (Noche → Sábado si aplica → Día), luego Mantenimiento y el total
    // de la máquina. Rendimiento = restricción Rendimiento_<máquina>; los operadores son informativos.
    const fechaCorta = (d: Date) => format(d, 'EEE dd/MM', { locale: es });
    const th = (t: string, align: 'left' | 'right' | 'center' = 'left') => `<td${align !== 'left' ? ` align="${align}"` : ''} style="padding:7px 10px;font-size:9px;font-weight:700;letter-spacing:0.03em;text-transform:uppercase;color:#6b7280;border-bottom:1px solid #d1d5db;">${t}</td>`;
    const tdBase = 'padding:7px 10px;font-size:11px;border-bottom:1px solid #d1d5db;font-variant-numeric:tabular-nums;';
    const turnosHtml = EMPAQUE_MACHINES_BY_CENTRO[centro].map(m => {
      const c = empaqueConfig[m.id];
      if (!c) return '';
      const filaTurno = (label: string, fecha: string, horarioLabel: string, bruta: number, paroPct: number, operadores: number, fondo: string, color: string) => {
        const neta = bruta * (1 - paroPct / 100) * (c.rendimiento / 100);
        return `
        <tr style="background:${fondo};">
          <td style="${tdBase}font-weight:700;color:${color};">${label}</td>
          <td style="${tdBase}color:#374151;text-transform:capitalize;white-space:nowrap;">${fecha || '—'}</td>
          <td style="${tdBase}color:#374151;white-space:nowrap;">${horarioLabel.replace(' - ', ' a ')}</td>
          <td align="right" style="${tdBase}color:#374151;">${bruta.toFixed(2)}</td>
          <td align="right" style="${tdBase}color:#374151;">${bruta > 0 ? `${paroPct.toFixed(0)}%` : ''}</td>
          <td align="right" style="${tdBase}color:#374151;">${bruta > 0 ? `${c.rendimiento.toFixed(0)}%` : ''}</td>
          <td align="right" style="${tdBase}font-weight:700;color:${color};">${neta.toFixed(2)}</td>
          <td align="center" style="${tdBase}color:#374151;">${bruta > 0 ? operadores : ''}</td>
        </tr>`;
      };
      const hDay = c.activa ? shiftOptionsEmpaque.find(o => o.v === c.day)?.h || 0 : 0;
      const hNight = c.activa ? nightShiftOptionsEmpaque.find(o => o.v === c.night)?.h || 0 : 0;
      const hSat = c.activa && ventanaEmpaque.sabadoCuenta ? shiftOptionsEmpaque.find(o => o.v === c.saturday)?.h || 0 : 0;
      const mtto = mttoEmpaqueDe(m.id);
      const total = Math.max(0, (hDay * (1 - c.paroDay / 100) + hNight * (1 - c.paroNight / 100) + hSat * (1 - c.paroSaturday / 100)) * (c.rendimiento / 100) - mtto);
      return `
  <tr>
    <td style="padding:18px 28px 4px;">
      <p style="margin:0 0 10px;font-size:10px;font-weight:700;letter-spacing:0.1em;text-transform:uppercase;color:#6b7280;">Detalle por máquina — empaque</p>
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border:2px solid #111827;border-radius:10px;overflow:hidden;">
        <tr style="background:#f9fafb;">
          ${th('Turno')}${th('Fecha')}${th('Horario')}${th('Tiempo Máquina<br/>(Horas brutas)', 'right')}${th('Paros<br/>Planificados (%)', 'right')}${th('Rendimiento<br/>Máquina (%)', 'right')}${th('Tiempo Máquina<br/>(Horas Efectivas)', 'right')}${th('Operadores', 'center')}
        </tr>${filaTurno('Noche', fechaCorta(ventanaEmpaque.noche), nightShiftOptionsEmpaque.find(o => o.v === c.night)?.l || '—', hNight, c.paroNight, c.operadoresNight, '#eef2ff', '#4338ca')}${hSat > 0 ? filaTurno('Sábado', ventanaEmpaque.sabados.map(fechaCorta).join(', '), shiftOptionsEmpaque.find(o => o.v === c.saturday)?.l || '—', hSat, c.paroSaturday, c.operadoresSaturday, '#fffbeb', '#b45309') : ''}${filaTurno('Día', fechaCorta(ventanaEmpaque.diaPlan), shiftOptionsEmpaque.find(o => o.v === c.day)?.l || '—', hDay, c.paroDay, c.operadoresDay, '#ecfdf5', '#047857')}
        <tr style="background:#fffbeb;"><td colspan="7" style="padding:7px 10px;font-size:11px;font-weight:700;color:#b45309;border-bottom:1px solid #d1d5db;">Mantenimiento Programado</td><td align="center" style="padding:7px 10px;font-size:11px;font-weight:700;color:#b45309;border-bottom:1px solid #d1d5db;font-variant-numeric:tabular-nums;">${mtto > 0 ? `${mtto.toFixed(2)} h` : '–'}</td></tr>
        <tr style="background:#ecfdf5;"><td colspan="7" style="padding:8px 10px;font-size:11px;font-weight:800;color:#111827;text-transform:uppercase;">${m.nombre}${c.activa ? '' : ' (fuera de servicio)'}</td><td align="center" style="padding:8px 10px;font-size:11px;font-weight:800;color:#111827;font-variant-numeric:tabular-nums;">${total.toFixed(2)} h</td></tr>
      </table>
    </td>
  </tr>`;
    }).join('');
    const ventanaCentro = ventanaEmpaque[centro];
    const ventanaHtml = ventanaCentro ? ejecucionPlanHtml(ventanaCentro.inicio, ventanaCentro.fin) : '';

    return `
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:600px;margin:0 auto;background:#ffffff;font-family:-apple-system,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;">
  <tr>
    <td style="background:#0891b2;padding:22px 28px;">
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
        <tr>
          <td style="font-size:15px;font-weight:700;color:#ffffff;letter-spacing:0.02em;">CHAIDE Y CHAIDE</td>
          <td align="right" style="font-size:11px;font-weight:600;letter-spacing:0.06em;text-transform:uppercase;color:#a5f3fc;">Planificación de Producción</td>
        </tr>
      </table>
    </td>
  </tr>
  <tr>
    <td style="padding:26px 28px 6px;">
      <p style="margin:0;font-size:10px;font-weight:700;letter-spacing:0.1em;text-transform:uppercase;color:#6b7280;">Venta Externa / Muebles · Centro ${centro} · Producto Terminado de Empaque</p>
      <h1 style="margin:4px 0 0;font-size:20px;font-weight:700;color:#111827;">Gestión de tiempos y capacidad de Empaque Venta Externa / Muebles</h1>
      <p style="margin:6px 0 0;font-size:12px;color:#6b7280;text-transform:capitalize;">${fechaLabel} · Correo automático, no responder</p>${ventanaHtml}
    </td>
  </tr>${/* Orden pedido por el usuario 2026-10-08: máquina arriba, luego materiales, al final los recuadros de capacidad. */ ''}${turnosHtml}${bloqueCategoriaHtml('Detalle por categoría — Espumas (FERT/PT)', espumas)}${bloqueRollosHtml}
  ${!espumas && !rollos ? `
  <tr>
    <td style="padding:10px 28px 4px;">
      <p style="margin:0;font-size:11px;color:#b45309;">Sin materiales verificados en Data Aprobada para este centro todavía.</p>
    </td>
  </tr>` : ''}
  <tr>
    <td style="padding:18px 28px 4px;">
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
        <tr>
          <td width="25%" style="padding-right:6px;">
            <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#111827;border-radius:10px;">
              <tr><td style="padding:14px 12px;">
                <p style="margin:0;font-size:9px;font-weight:700;letter-spacing:0.08em;text-transform:uppercase;color:#9ca3af;">Horas necesarias</p>
                <p style="margin:4px 0 0;font-size:20px;font-weight:700;color:#ffffff;font-variant-numeric:tabular-nums;">${totalHoras.toFixed(2)}</p>
              </td></tr>
            </table>
          </td>
          <td width="25%" style="padding:0 6px;">
            <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#111827;border-radius:10px;">
              <tr><td style="padding:14px 12px;">
                <p style="margin:0;font-size:9px;font-weight:700;letter-spacing:0.08em;text-transform:uppercase;color:#9ca3af;">Capacidad disponible</p>
                <p style="margin:4px 0 0;font-size:20px;font-weight:700;color:#ffffff;font-variant-numeric:tabular-nums;">${capacidadHoras.toFixed(2)}</p>
              </td></tr>
            </table>
          </td>
          <td width="25%" style="padding:0 6px;">
            <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:${ocupacionColor};border-radius:10px;">
              <tr><td style="padding:14px 12px;">
                <p style="margin:0;font-size:9px;font-weight:700;letter-spacing:0.08em;text-transform:uppercase;color:#fecaca;">% Ocupación</p>
                <p style="margin:4px 0 0;font-size:20px;font-weight:700;color:#ffffff;font-variant-numeric:tabular-nums;">${ocupacionPct !== null ? ocupacionPct.toFixed(0) + '%' : '—'}</p>
              </td></tr>
            </table>
          </td>
          <td width="25%" style="padding-left:6px;">
            <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#ecfeff;border:1px solid #e5e7eb;border-radius:10px;">
              <tr><td style="padding:14px 12px;">
                <p style="margin:0;font-size:9px;font-weight:700;letter-spacing:0.08em;text-transform:uppercase;color:#6b7280;">Materiales</p>
                <p style="margin:4px 0 0;font-size:20px;font-weight:700;color:#0891b2;font-variant-numeric:tabular-nums;">${(espumas?.filas.reduce((s, f) => s + f.materiales, 0) || 0) + (rollos?.filas.length || 0)}</p>
              </td></tr>
            </table>
          </td>
        </tr>
      </table>
    </td>
  </tr>
  <tr>
    <td style="padding:0 28px 28px;">
      <p style="margin:16px 0 0;font-size:11px;line-height:1.6;color:#9ca3af;border-top:1px solid #e5e7eb;padding-top:16px;">
        Este correo fue generado automáticamente por el Optimizador de Producción, favor no responder.
        Para dudas sobre estos datos, contacta a Planificación Táctica.
      </p>
    </td>
  </tr>
</table>`;
  };

  const asuntoReporteEmpaque = (centro: '1000' | '2000') =>
    `Reporte de producción — Empaque Venta Externa / Muebles [Centro ${centro}]`;

  // "Enviar Reporte" en 3 pasos (Guardar -> Recuperar/vista previa -> Enviar, ver
  // ReportePlanTxtFlujo.tsx): el correo sale de la foto guardada, no se recalcula después de exportar
  // a SAP. Fecha objetivo = día hábil siguiente: Data Aprobada son respuestas P3 que siempre se
  // fechan a hoy+1 hábil (ver guardado del P3).
  //
  // Al GUARDAR se refresca la trazabilidad FERT/PT de Espumas antes de armar el reporte — no depende
  // de que el usuario ya haya visitado "PFD-VENTA" en esta sesión (Data Aprobada/FERT-PT y PFD-VENTA
  // son pasos independientes, confirmado por el usuario). Si no hay P2/FERT activos,
  // generarPfdVentaPreview ya notifica el motivo puntual y el reporte sigue con lo que haya en
  // Rollos. Se usa el valor DEVUELTO, no el estado `pfdVentaPreview` (que por el cierre de este
  // render seguiría viendo la versión vieja hasta el próximo render).
  const fechaObjetivoEmpaque = fechasHorizonte.pt;
  // Respaldo del módulo completo (ambos centros); lo guarda el reporte de cada centro, como en Corte Espuma.
  const capturarEstadoPlan = (): EstadoPlanVentaExterna => {
    const maquinasMtto = new Set(Object.values(mttoSAPEmpaque).flatMap(x => x.maquinas));
    return {
      tipo: 'venta-externa',
      version: 2,
      grupos,
      restricciones,
      mantenimientosEmpaque: mantenimientosSAP.filter(m => maquinasMtto.has(String(m.ID_MAQUINA ?? m.MAQUINA ?? '').trim().toUpperCase())),
      selectedDates,
      selectedDatesResumen,
      empaqueConfig,
      dataAprobada,
      necesidadEspumas1000, necesidadEspumas2000, necesidadRollos1000, necesidadRollos2000,
      pfdVentaPreview: { ...pfdVentaPreview, ...ultimoPfdVentaPreview.current },
      resultado: {
        hoy: resultadoRestaurado?.hoy ?? format(new Date(), 'yyyy-MM-dd'),
        summaryData: { '1000': summaryData1000, '2000': summaryData2000 },
        bloqueRollos1000: bloqueRollosEmpaque('1000', ultimoPfdVentaPreview.current['1000'] ?? pfdVentaPreview['1000']),
      },
    };
  };
  const restaurarEstadoPlan = (crudo: unknown, origen: OrigenEstadoPlan): boolean => {
    const e = crudo as Partial<EstadoPlanVentaExterna> | null;
    if (!e || e.tipo !== 'venta-externa' || e.version !== 2 || !e.resultado) return false;
    if (e.empaqueConfig) {
      empaqueConfigRestaurada.current = e.empaqueConfig;
      setEmpaqueConfig(e.empaqueConfig);
    }
    setGrupos(e.grupos ?? []);
    setRestricciones(e.restricciones ?? []);
    // Sin órdenes SAP de la sesión: lo que se ve sale solo del resultado guardado.
    setOrders([]);
    setOrdersFert([]);
    setTiemposEnsamblado([]);
    setMantenimientosSAP(e.mantenimientosEmpaque ?? []);
    setSelectedDates(e.selectedDates ?? []);
    if (e.selectedDates?.[0]) setViewDate(parseISO([...e.selectedDates].sort()[0]));
    setSelectedDatesResumen(e.selectedDatesResumen ?? []);
    setDataAprobada(e.dataAprobada ?? {});
    setNecesidadEspumas1000(e.necesidadEspumas1000 ?? []);
    setNecesidadEspumas2000(e.necesidadEspumas2000 ?? []);
    setNecesidadRollos1000(e.necesidadRollos1000 ?? []);
    setNecesidadRollos2000(e.necesidadRollos2000 ?? []);
    setPfdVentaPreview(e.pfdVentaPreview ?? {});
    ultimoPfdVentaPreview.current = e.pfdVentaPreview ?? {};
    setResultadoRestaurado(e.resultado);
    setDatosCargados(true);
    setPlanCargadoDe(origen);
    setActiveTab('resumen');
    return true;
  };

  const reporteFlujoEmpaque1000 = useReportePlanTxt({
    modulo: 'venta-espuma',
    centro: '1000',
    fechaObjetivo: fechaObjetivoEmpaque,
    asunto: asuntoReporteEmpaque('1000'),
    construirHtml: async () => construirReporteHtmlEmpaque('1000', await generarPfdVentaPreview('1000')),
    etiqueta: 'Centro 1000',
    capturarEstado: capturarEstadoPlan,
    restaurarEstado: restaurarEstadoPlan,
  });
  const reporteFlujoEmpaque2000 = useReportePlanTxt({
    modulo: 'venta-espuma',
    centro: '2000',
    fechaObjetivo: fechaObjetivoEmpaque,
    asunto: asuntoReporteEmpaque('2000'),
    construirHtml: async () => construirReporteHtmlEmpaque('2000', await generarPfdVentaPreview('2000')),
    etiqueta: 'Centro 2000',
    capturarEstado: capturarEstadoPlan,
    restaurarEstado: restaurarEstadoPlan,
  });
  // Un reporte por centro, como Laminado (usuario 2026-10-08): cada uno con su Guardar / Vista previa /
  // Enviar. Hoy se trabaja con el 1000; el 2000 sigue el mismo esquema y se envía cuando esté formal.
  const reporteFlujoEmpaque = { '1000': reporteFlujoEmpaque1000, '2000': reporteFlujoEmpaque2000 } as const;
  // Al abrir ya NO se carga solo el último reporte (2026-10-12: dejaba Data Aprobada de otro ciclo en
  // pantalla). Un reporte guardado se recupera desde "Enviar Reporte" de cada centro en 4 · Resumen.

  const calculateSummary = (data: Record<string, unknown>[], centroId: string) => {
    const lookup = centroId === '1000' ? tiempoLookup1000 : tiempoLookup2000;
    const map = new Map<string, { centro: string; maquina: string; categoria: string; densidad: string; espesor: string; tipo: string; totalOrdenes: number; totalCantidad: number; totalTiempoEmpaque: number; paquetes: number; paquetesEnrollar: number }>();
    // Diagnóstico (2026-10-08): materiales que no encuentran tiempo en el servicio y usan 15 s/und.
    const sinTiempo = new Set<string>();
    // Unidades de PLANCHA por material dentro de cada fila (los paquetes se arman por material).
    const planchasPorFila = new Map<string, Map<string, { qty: number; enrollar: boolean; esp: string }>>();
    data.forEach(o => {
      const categoria = String(o.CATEGORIA || o.Categoria || o.categoria || '').trim();
      if (!categoria || categoria === 'N/A') return;

      const maquina = String(o.MAQUINA || o.Maquina || o.maquina || o.RECURSO || 'SIN MÁQUINA').trim();
      const info = extractMaterialInfo(o);
      const espesor = info.esp || '—';
      const tipo = info.tipo || '—';
      const densidad = info.dens || '—';
      const key = `${maquina}|${categoria}|${espesor}|${tipo}`;

      const qty = Number(o.CANTPROGRAMADA || o.CANTIDAD || 0);
      // Tiempo real de SAP (mismo cruce material+máquina que ya usa "T. Estándar (Min)" en las
      // tablas Provisionales/FERT — ver matchTiempoEstandar): verificado con dato real (material
      // 20006172, PLANCHA ESPUMA D12, HojaRuta HR-LAMR1, Tiempo_Min=0.0113) que el placeholder fijo
      // de 15seg/unidad sobreestimaba ~22x (7.00h mostradas vs ~0.32h reales). Si el material no
      // tiene tiempo estándar en el catálogo (caso no verificado hoy), se usa el placeholder como
      // respaldo en vez de mostrar 0h, que sería más engañoso todavía.
      const tiempoEstandarMin = matchTiempoEstandar(info.code, maquina, lookup);
      const empaqueHours = tiempoEstandarMin !== null ? (qty * tiempoEstandarMin) / 60 : (qty * PACKING_TIME_PER_UNIT_SECONDS) / 3600;
      if (tiempoEstandarMin === null) sinTiempo.add(info.code);

      if (!map.has(key)) {
        map.set(key, { centro: centroId, maquina, categoria, densidad, espesor, tipo, totalOrdenes: 0, totalCantidad: 0, totalTiempoEmpaque: 0, paquetes: 0, paquetesEnrollar: 0 });
      }
      const entry = map.get(key)!;
      entry.totalOrdenes += 1;
      entry.totalCantidad += qty;
      entry.totalTiempoEmpaque += empaqueHours;
      if (ES_PLANCHA.test(info.desc)) {
        if (!planchasPorFila.has(key)) planchasPorFila.set(key, new Map());
        const porMaterial = planchasPorFila.get(key)!;
        const m = porMaterial.get(info.code) || { qty: 0, enrollar: ES_C_PLANCHA.test(info.desc), esp: info.esp };
        m.qty += qty;
        porMaterial.set(info.code, m);
      }
    });
    planchasPorFila.forEach((porMaterial, key) => {
      const entry = map.get(key)!;
      porMaterial.forEach(m => {
        const p = paquetesPlancha(m.qty, m.esp);
        entry.paquetes += p;
        if (m.enrollar) entry.paquetesEnrollar += p;
      });
    });
    // Muestreo C-PLANCHA vs PLANCHA de la misma densidad y medidas (usuario 2026-10-09: el enrollado
    // está en medición; se espera que el tiempo del servicio de la C-PLANCHA ya sea mayor).
    if (data.length > 0) {
      const minDe = (filas: Record<string, unknown>[]) => matchTiempoEstandar(extractMaterialInfo(filas[0]).code, '', new Map([[extractMaterialInfo(filas[0]).code, filas]]));
      const planchas = new Map<string, { code: string; min: number | null }>();
      const cPlanchas: { code: string; clave: string; min: number | null }[] = [];
      lookup.forEach(filas => {
        const i = extractMaterialInfo(filas[0]);
        if (!ES_PLANCHA.test(i.desc)) return;
        const clave = `D${i.dens} ${i.ancho}X${i.largo}X${i.esp}`;
        if (ES_C_PLANCHA.test(i.desc)) cPlanchas.push({ code: i.code, clave, min: minDe(filas) });
        else if (!planchas.has(clave)) planchas.set(clave, { code: i.code, min: minDe(filas) });
      });
      const pares = cPlanchas.map(c => ({ 'C-PLANCHA': c.code, medida: c.clave, 'min/und C': c.min, PLANCHA: planchas.get(c.clave)?.code ?? '—', 'min/und P': planchas.get(c.clave)?.min ?? null }));
      if (pares.length > 0) { console.info(`[Empaque ${centroId}] C-PLANCHA vs PLANCHA (tiempo del servicio, min/und):`); console.table(pares); }
    }
    if (data.length > 0) console.info(`[Empaque ${centroId}] tiempos del servicio:${lookup.size} materiales; sin tiempo (15 s/und): ${sinTiempo.size}${sinTiempo.size ? ` — ${[...sinTiempo].slice(0, 15).join(', ')}` : ''}`);
    return Array.from(map.values()).sort((a, b) =>
      a.maquina.localeCompare(b.maquina) || a.categoria.localeCompare(b.categoria) || a.espesor.localeCompare(b.espesor)
    );
  };

  type FilaResumenEjecutado = ReturnType<typeof calculateSummary>[number];
  // Depende también del lookup de tiempos (2026-10-26): las FERT llegan antes que los tiempos y sin él
  // la carga quedaba toda en 15 s/und (3677 und = 15.3 h) sin recalcular al llegar el servicio.
  const summaryData1000 = useMemo(() => (resultadoRestaurado?.summaryData['1000'] as FilaResumenEjecutado[] | undefined) ?? calculateSummary(fertC1000Resumen, '1000'), [fertC1000Resumen, tiempoLookup1000, resultadoRestaurado]); // eslint-disable-line react-hooks/exhaustive-deps
  const summaryData2000 = useMemo(() => (resultadoRestaurado?.summaryData['2000'] as FilaResumenEjecutado[] | undefined) ?? calculateSummary(fertC2000Resumen, '2000'), [fertC2000Resumen, tiempoLookup2000, resultadoRestaurado]); // eslint-disable-line react-hooks/exhaustive-deps

  // Agrupación por Categoría Técnica (la categoría ya embebe la densidad, p.ej. D40ESP)
  const groupByCategoria = (data: typeof summaryData1000) => {
    const map = new Map<string, { categoria: string; densidad: string; tipo: string; rows: typeof summaryData1000; totalOrdenes: number; totalCantidad: number; totalTiempoEmpaque: number; paquetes: number; paquetesEnrollar: number }>();
    data.forEach(row => {
      if (!map.has(row.categoria)) {
        map.set(row.categoria, { categoria: row.categoria, densidad: row.densidad, tipo: row.tipo, rows: [], totalOrdenes: 0, totalCantidad: 0, totalTiempoEmpaque: 0, paquetes: 0, paquetesEnrollar: 0 });
      }
      const group = map.get(row.categoria)!;
      group.rows.push(row);
      group.totalOrdenes += row.totalOrdenes;
      group.totalCantidad += row.totalCantidad;
      group.totalTiempoEmpaque += row.totalTiempoEmpaque;
      // Un plan guardado antes del 2026-10-08 no trae paquetes: cuenta 0.
      group.paquetes += row.paquetes ?? 0;
      group.paquetesEnrollar += row.paquetesEnrollar ?? 0;
    });
    return Array.from(map.values()).sort((a, b) => a.categoria.localeCompare(b.categoria));
  };

  const groupedSummary1000 = useMemo(() => groupByCategoria(summaryData1000), [summaryData1000]);
  const groupedSummary2000 = useMemo(() => groupByCategoria(summaryData2000), [summaryData2000]);

  // "PFD - VENTA": dirección OPUESTA a explodeNecesidadesFert — en vez de bajar de FERT/PT a
  // componente, sube desde el componente YA RESPONDIDO (Data Aprobada, estado 'completo') hacia su(s)
  // FERT/PT padre. La trazabilidad (componente -> FERT/PT) se calcula FRESCA acá mismo, en cada clic
  // de "Generar PFD-VENTA" (mismo BOM que ya generó el P2 — sin datos nuevos, solo se vuelve a
  // recorrer) — antes se guardaba en un estado aparte (trazabilidadPT1000/2000) que solo se llenaba al
  // pulsar "Generar Necesidades · BOM FERT" en otro punto del módulo: si Data Aprobada ya estaba
  // actualizada sin haber vuelto a pasar por ese botón en la misma sesión, PFD-VENTA no encontraba
  // trazabilidad para NADA (reportado por el usuario con datos reales) — recalcularla acá elimina esa
  // dependencia oculta.
  //
  // El universo de FERT NO sale de fertC1000ParaP2/fertC2000ParaP2 directo — esos dependen de
  // `selectedDates` (la "Ventana de Producción" que se ve ahora mismo en el calendario), que puede
  // haber quedado en una selección más ancha (varias fechas) que la fecha REAL con la que se guardó el
  // P2 activo. Caso real que lo destapó: material 20003094 mostraba 1.708 unidades en PFD-VENTA — la
  // suma de 5 órdenes reales con Liberación 31-ago/01-sep(x2)/02-sep/07-sep — cuando el P2 activo
  // (#524) está fechado exacto 01-sep; solo las 2 órdenes de esa fecha (300 unidades) responden a ESE
  // ciclo. Se relee el P2 activo (verificarPlanP2Activo) y se filtra FERT por SU fecha real
  // (`filterData(..., [fechaP2])`, con dateOverride) — misma fecha con la que se explotó el BOM que
  // originó este P2, no lo que el calendario muestre en este instante.
  // Solo Espumas: Rollos no tiene Data Aprobada con datos reales hoy (las corridas se aplazan a
  // propósito hasta resolver stock, ver captura real de esta sesión).
  // Devuelve el preview recién generado (o null si no se pudo) — necesario para encadenarlo
  // directamente con guardarPfdVentaCore (ver handleGenerarYGuardarPfdVenta) sin depender de leer
  // pfdVentaPreview del estado justo después de setearlo: dentro de la misma función async, ese
  // closure sigue viendo el valor de ANTES del render, no el que se acaba de guardar.
  // onAviso (opcional): el panel de progreso recibe el motivo en vez de un toast (fase 2).
  const generarPfdVentaPreview = async (centro: '1000' | '2000', onAviso?: (mensaje: string) => void): Promise<PfdVentaPreview | null> => {
    const avisar = (tipo: 'warning' | 'error', mensaje: string) => (onAviso ? onAviso(mensaje) : addNotification(tipo, mensaje));
    const rows = dataAprobada[`${centro}-ESPUMAS`] || [];

    const { planActivo: p2Activo } = await verificarPlanP2Activo(centro, 'ESPUMAS');
    if (!p2Activo) {
      avisar('warning', `No hay un P2 activo de Espumas para el Centro ${centro} — genera el P2 primero.`);
      return null;
    }
    // FERT del PT (fecha_fin_plan); planes anteriores al 2026-10-02 tenían inicio = fin.
    const fechaP2 = soloFecha(p2Activo.fecha_fin_plan) || soloFecha(p2Activo.fecha_inicio_plan);
    const fertOrigen = filterData(ordenesFert, centro, true, [fechaP2]);
    if (fertOrigen.length === 0) {
      avisar('warning', `No hay Órdenes FERT fechadas exacto ${fechaP2} (PT del P2 #${p2Activo.codigo_plan_grupo}) para el Centro ${centro}.`);
      return null;
    }

    setIsGeneratingPfdVenta(prev => ({ ...prev, [centro]: true }));
    const uniqueMaterialCount = new Set(fertOrigen.map(o => extractMaterialInfo(o).code).filter(Boolean)).size;
    setPfdVentaBomProgress(prev => ({ ...prev, [centro]: { current: 0, total: uniqueMaterialCount } }));
    let current = 0;
    const onStep = () => setPfdVentaBomProgress(prev => ({ ...prev, [centro]: { current: ++current, total: uniqueMaterialCount } }));

    try {
      const { trazabilidad } = await explodeNecesidadesFert(centro, fertOrigen, onStep);

      const ptCubiertos = new Set<string>();
      const sinTrazabilidad: DataAprobadaRow[] = [];

      rows.filter(r => estadoDataAprobada(r) === 'completo').forEach(r => {
        const padres = trazabilidad[r.material];
        if (!padres || padres.length === 0) { sinTrazabilidad.push(r); return; }
        padres.forEach(pt => ptCubiertos.add(pt));
      });

      // "si existe varios FERT con el mismo HALB, es simple la suma" -> se suma por material más
      // abajo, igual que ya hace calculateSummary para la agrupación de "Resumen Necesidades".
      const fertCubierto = fertOrigen.filter(o => ptCubiertos.has(cleanCode(o.MATERIAL)));

      // Una fila por material — lo que de verdad se va a grabar (cantidad), más categoría/tiempo
      // como columnas informativas (mismo cruce matchTiempoEstandar que ya usa "Resumen Necesidades",
      // con el mismo respaldo de placeholder cuando el material no tiene tiempo estándar real).
      const lookup = centro === '1000' ? tiempoLookup1000 : tiempoLookup2000;
      // Diagnóstico (usuario 2026-10-09: 20003095 salía en 15 s/und): qué trae el servicio de tiempos.
      const sinTiempoPt = [...new Set(fertCubierto.map(o => extractMaterialInfo(o).code))].filter(c => c && matchTiempoEstandar(c, '', lookup) === null);
      console.info(`[PFD-VENTA ${centro}] servicio de tiempos: ${lookup.size} materiales (grupos ${grupos.map(g => g.codigo_grupo).join(', ')}); PT sin tiempo (15 s/und): ${sinTiempoPt.length}${sinTiempoPt.length ? ` — ${sinTiempoPt.slice(0, 15).join(', ')}` : ''}`);
      const ejemplo = fertCubierto.map(o => lookup.get(extractMaterialInfo(o).code)).find(Boolean) ?? [...lookup.values()][0];
      if (ejemplo) console.info(`[PFD-VENTA ${centro}] fila de ejemplo del servicio:`, ejemplo[0]);
      const porMaterial = new Map<string, PfdVentaLinea>();
      fertCubierto.forEach(o => {
        const info = extractMaterialInfo(o);
        if (!info.code) return;
        const qty = Number(o.CANTPROGRAMADA || o.CANTIDAD || 0);
        const categoria = String(o.CATEGORIA || o.Categoria || o.categoria || '—').trim() || '—';
        const maquina = String(o.MAQUINA || o.Maquina || o.RECURSO || '').trim();
        const tiempoEstandarMin = matchTiempoEstandar(info.code, maquina, lookup);
        const tiempoHoras = tiempoEstandarMin !== null ? (qty * tiempoEstandarMin) / 60 : (qty * PACKING_TIME_PER_UNIT_SECONDS) / 3600;
        if (!porMaterial.has(info.code)) {
          porMaterial.set(info.code, { material: info.code, descripcion: info.desc, categoria, cantidad: 0, tiempoHoras: 0 });
        }
        const entry = porMaterial.get(info.code)!;
        entry.cantidad += qty;
        entry.tiempoHoras += tiempoHoras;
      });

      // Rollos a nivel FERT/PT para el correo de Empaque (usuario 2026-10-09), con el mismo BOM: el
      // tiempo sale del servicio por el material FERT/PT (el componente LAMINA CILINDRICA no tiene
      // tiempo de empaque y caía en 15 s/und). # Rollos = peso verificado del componente (kg) ÷
      // PesoUN del Maestro Looper, redondeado hacia arriba, sumado a la categoría de su FERT/PT.
      const rollosAprobados = (dataAprobada[`${centro}-ROLLOS`] || []).filter(r => estadoDataAprobada(r) !== 'pendiente');
      let rollos: PfdVentaPreview['rollos'];
      if (rollosAprobados.length > 0) {
        const pesoRollo = new Map<string, number>();
        try {
          const res = await sapCompartido.kpiMaestroLooper();
          const filas = (Array.isArray(res.data) ? res.data : res.data?.data || []) as Record<string, unknown>[];
          filas.forEach(f => { const peso = Number(f.PesoUN) || 0; if (peso > 0) pesoRollo.set(cleanCode(f.Material), peso); });
        } catch (error) {
          console.warn('[Empaque] Maestro Looper sin respuesta — # Rollos queda en 0:', (error as Error).message);
        }
        const ptRollo = new Set<string>();
        const rollosPorCategoria: Record<string, number> = {};
        const sinPeso: string[] = [];
        rollosAprobados.forEach(r => {
          const padres = trazabilidad[r.material] || [];
          padres.forEach(pt => ptRollo.add(pt));
          const fertPadre = fertOrigen.find(o => padres.includes(cleanCode(o.MATERIAL)));
          if (!fertPadre) return;
          const categoria = String(fertPadre.CATEGORIA || fertPadre.Categoria || fertPadre.categoria || '—').trim() || '—';
          const peso = pesoRollo.get(r.material) ?? pesoRollo.get(cleanCode(fertPadre.MATERIAL));
          if (!peso) { sinPeso.push(r.material); return; }
          rollosPorCategoria[categoria] = (rollosPorCategoria[categoria] || 0) + Math.ceil(r.respuestaCant / peso);
        });
        if (sinPeso.length > 0) console.info(`[Empaque ${centro}] Rollos sin PesoUN en Maestro Looper: ${sinPeso.join(', ')}`);
        const porMaterialRollo = new Map<string, PfdVentaLinea>();
        fertOrigen.filter(o => ptRollo.has(cleanCode(o.MATERIAL))).forEach(o => {
          const info = extractMaterialInfo(o);
          if (!info.code) return;
          const qty = Number(o.CANTPROGRAMADA || o.CANTIDAD || 0);
          const categoria = String(o.CATEGORIA || o.Categoria || o.categoria || '—').trim() || '—';
          const maquina = String(o.MAQUINA || o.Maquina || o.RECURSO || '').trim();
          const tiempoEstandarMin = matchTiempoEstandar(info.code, maquina, lookup);
          const tiempoHoras = tiempoEstandarMin !== null ? (qty * tiempoEstandarMin) / 60 : (qty * PACKING_TIME_PER_UNIT_SECONDS) / 3600;
          if (!porMaterialRollo.has(info.code)) porMaterialRollo.set(info.code, { material: info.code, descripcion: info.desc, categoria, cantidad: 0, tiempoHoras: 0 });
          const entry = porMaterialRollo.get(info.code)!;
          entry.cantidad += qty;
          entry.tiempoHoras += tiempoHoras;
        });
        if (porMaterialRollo.size > 0) rollos = { lineas: Array.from(porMaterialRollo.values()), rollosPorCategoria };
      }

      const preview: PfdVentaPreview = {
        sinTrazabilidad,
        ptCubiertos,
        lineas: Array.from(porMaterial.values()).sort((a, b) => a.material.localeCompare(b.material)),
        rollos,
      };
      ultimoPfdVentaPreview.current = { ...ultimoPfdVentaPreview.current, [centro]: preview };
      setPfdVentaPreview(prev => ({ ...prev, [centro]: preview }));
      return preview;
    } catch (error) {
      avisar('error', `Error al generar PFD-VENTA Centro ${centro}: ${(error as Error).message}`);
      return null;
    } finally {
      setIsGeneratingPfdVenta(prev => ({ ...prev, [centro]: false }));
    }
  };

  // Gate para habilitar la secuencia automática (ver handleGenerarYGuardarPfdVenta): solo tiene
  // sentido generar/guardar PFD-VENTA de un centro si Data Aprobada (arriba) ya tiene, para ese
  // centro, al menos un material en 'parcial' o 'completo' — 'pendiente' (respuestaCant <= 0) no
  // aporta nada todavía. No cambia qué se GRABA (generarPfdVentaPreview sigue tomando solo
  // 'completo' para la trazabilidad real hacia FERT/PT) — es solo la condición para intentarlo.
  const centroConDataAprobadaLista = (centro: '1000' | '2000'): boolean =>
    (dataAprobada[`${centro}-ESPUMAS`] || []).some(r => estadoDataAprobada(r) !== 'pendiente');

  // Reemplaza los 2 clics manuales por centro (Generar PFD-VENTA, luego Guardar PFD-VENTA) por una
  // sola acción: recorre Centro 1000 y 2000 en secuencia, y para cada uno que tenga data aprobada
  // (parcial o completa) genera el preview y, si trajo materiales, guarda el plan de inmediato —
  // usando las líneas recién calculadas (lineasOverride), no el estado pfdVentaPreview, que todavía
  // no reflejaría el setState de este mismo ciclo. Un centro sin data aprobada, o cuyo preview salga
  // vacío, se omite con una notificación informativa y el loop sigue con el siguiente centro.
  // Fase 2 del panel (igual que Corte Espuma / Laminado): cada centro es un paso del panel (sin
  // toasts) y al final se guarda el reporte de Empaque (efecto reportePorGuardar, junto a
  // reporteFlujoEmpaque, uno por centro) para cerrar con "Ver reporte Centro …". El envío sigue manual.
  const [reportePorGuardar, setReportePorGuardar] = useState(false);
  const handleGenerarYGuardarPfdVenta = async () => {
    setIsRunningPfdVentaSecuencia(true);
    panelProgreso.iniciar('Venta Externa — PFD-VENTA y reporte', [
      { id: 'pfd-1000', etiqueta: 'PFD-VENTA · Centro 1000' },
      { id: 'pfd-2000', etiqueta: 'PFD-VENTA · Centro 2000' },
      { id: 'rep-1000', etiqueta: 'Guardando reporte de Empaque · Centro 1000' },
      { id: 'rep-2000', etiqueta: 'Guardando reporte de Empaque · Centro 2000' },
    ]);
    try {
      for (const centro of ['1000', '2000'] as const) {
        const id = `pfd-${centro}`;
        if (!centroConDataAprobadaLista(centro)) {
          panelProgreso.actualizar(id, { estado: 'omitido', detalle: 'Sin materiales en estado Parcial/Completo en Data Aprobada.' });
          continue;
        }
        panelProgreso.actualizar(id, { estado: 'en_curso' });
        let motivo = '';
        const preview = await generarPfdVentaPreview(centro, m => { motivo = m; });
        if (!preview) {
          panelProgreso.actualizar(id, { estado: 'aviso', detalle: motivo || 'No se pudo generar el PFD-VENTA.' });
          continue;
        }
        if (preview.lineas.length === 0) {
          panelProgreso.actualizar(id, { estado: 'aviso', detalle: 'Sin materiales FERT/PT cubiertos — no se guarda ningún plan.' });
          continue;
        }
        const resultado = await guardarPfdVentaCore(centro, preview.lineas);
        panelProgreso.actualizar(id, { estado: resultado.status === 'ok' ? 'ok' : resultado.status === 'sin-datos' ? 'aviso' : 'error', detalle: resultado.mensaje });
      }
      // El reporte de Empaque no depende de que el PFD-VENTA haya salido: se guarda igual.
      setReportePorGuardar(true);
    } catch (e) {
      panelProgreso.actualizar('rep-1000', { estado: 'omitido' });
      panelProgreso.actualizar('rep-2000', { estado: 'omitido' });
      panelProgreso.concluir(`Error en PFD-VENTA: ${(e as Error).message}`);
    } finally {
      setIsRunningPfdVentaSecuencia(false);
    }
  };

  useEffect(() => {
    if (!reportePorGuardar) return;
    setReportePorGuardar(false);
    void (async () => {
      // Un reporte por centro (ver reporteFlujoEmpaque). Secuencial: construirHtml refresca el preview
      // FERT/PT de cada centro.
      const guardados: ('1000' | '2000')[] = [];
      for (const centro of ['1000', '2000'] as const) {
        panelProgreso.actualizar(`rep-${centro}`, { estado: 'en_curso' });
        const ok = await reporteFlujoEmpaque[centro].guardar({ sinConfirmar: true, silencioso: true });
        if (ok) guardados.push(centro);
        panelProgreso.actualizar(`rep-${centro}`, ok
          ? { estado: 'ok', detalle: `Reporte del ${fechaObjetivoEmpaque} guardado en la carpeta compartida — todavía no se envió.` }
          : { estado: 'error', detalle: 'No se pudo guardar; reintenta desde "Enviar Reporte" del centro.' });
      }
      setRecargaEstadoDia(k => k + 1);
      panelProgreso.concluir(
        guardados.length > 0 ? 'PFD-VENTA y reporte guardados. Revisa y envía el reporte de cada centro.' : undefined,
        guardados.map(centro => ({
          etiqueta: `Ver reporte Centro ${centro}`,
          onClick: () => { setActiveTab('resumen'); void reporteFlujoEmpaque[centro].recuperar(); },
        })),
      );
    })();
  }, [reportePorGuardar]); // eslint-disable-line react-hooks/exhaustive-deps

  // Totales de la carga operativa POR CENTRO (2026-10-12: antes eran globales y mezclaban 1000 y 2000).
  const statsPorCentro = useMemo(() => {
    const totales = (rows: typeof summaryData1000) => ({
      ordenes: rows.reduce((sum, r) => sum + r.totalOrdenes, 0),
      unidades: rows.reduce((sum, r) => sum + r.totalCantidad, 0),
      horasEmpaque: rows.reduce((sum, r) => sum + r.totalTiempoEmpaque, 0),
    });
    return { '1000': totales(summaryData1000), '2000': totales(summaryData2000) };
  }, [summaryData1000, summaryData2000]);

  // La fecha de la carga operativa arranca en el PT del ciclo (hoy + 2 hábiles), no en hoy: es el día
  // que se empaca y el mismo del reporte. Si el PT cambia (al sincronizar con el calendario laboral),
  // se vuelve a fijar; el usuario puede elegir otras fechas para consultar.
  useEffect(() => {
    setSelectedDatesResumen([fechasHorizonte.pt]);
  }, [fechasHorizonte.pt]);

  // Mapa Cod.Buscar → Fecha de Órdenes FERT (mismo cruce que Pendientes, ver buildCodBuscar): usa
  // TODAS las FERT cargadas (sin el filtro de centro/responsable/fecha que aplican fertC1000/
  // fertC2000), porque Pendientes no está acotado a esos mismos criterios.
  // Verificado contra la respuesta real de OrdenesFertPaginadas: NO existe un campo propio de
  // "fecha entrega" ahí — se usa "FECHA" (fecha planificada/ejecución de la orden FERT), que es la
  // misma que ya se muestra como columna "Fecha" en la tabla de ese tab.
  const fertFechaEntregaPorCodBuscar = useMemo(() => {
    const map = new Map<string, string>();
    ordenesFert.forEach(o => {
      const cod = buildCodBuscar(o.POSICION, o.PEDIDO, o.MATERIAL);
      const fecha = String(o.FECHA || '').split('T')[0];
      if (cod && fecha) map.set(cod, fecha);
    });
    return map;
  }, [ordenesFert]);

  // Tab "Pendientes": fijo a SECTOR "09 ESPUMAS" (único sector que consume este módulo), filtra por
  // texto (Pedido o Material) y por rango de Fecha de Entrega, luego agrupa por Material (Accordion)
  // para no listar +20K filas planas.
  const pendientesFiltrados = useMemo(() => {
    const search = pendientesSearch.trim().toLowerCase();
    const desde = pendientesFechaDesde ? parseISO(pendientesFechaDesde) : null;
    const hasta = pendientesFechaHasta ? parseISO(pendientesFechaHasta) : null;
    return pendientesTotales.filter((p) => {
      const sector = String(p.SECTOR || '').trim().toUpperCase();
      if (sector !== SECTOR_ESPUMAS) return false;
      const pedido = String(p.PEDIDO || '').trim();
      const material = String(p.MATERIAL || '').trim();
      const descripcion = String(p.DESCRIPCION_MATERIAL || '').trim();
      if (search && !pedido.toLowerCase().includes(search) && !material.toLowerCase().includes(search) && !descripcion.toLowerCase().includes(search)) {
        return false;
      }
      // fechaLocalEcuador: FECHA_ENTREGA es un timestamp UTC real (confirmado, ej.
      // "2026-01-07T05:00:00.000Z") — mismo bug de zona horaria que en Corte Espuma.
      const fechaStr = fechaLocalEcuador(p.FECHA_ENTREGA);
      if ((desde || hasta) && !fechaStr) return false;
      if (desde || hasta) {
        const fecha = parseISO(fechaStr);
        if (desde && fecha < desde) return false;
        if (hasta && fecha > hasta) return false;
      }
      return true;
    });
  }, [pendientesTotales, pendientesSearch, pendientesFechaDesde, pendientesFechaHasta]);

  // Separado por CENTRO (1000/2000) — antes un mismo material mezclaba pedidos de ambas plantas bajo
  // el mismo grupo, sin distinguir de dónde sale cada uno.
  const pendientesAgrupadosPorCentro = useMemo(() => {
    const maps: Record<'1000' | '2000', Map<string, { material: string; descripcion: string; pedidos: PendienteRow[] }>> = {
      '1000': new Map(),
      '2000': new Map(),
    };
    pendientesFiltrados.forEach((p) => {
      const centro = String(p.CENTRO || '').trim();
      if (centro !== '1000' && centro !== '2000') return;
      const material = String(p.MATERIAL || '').trim();
      const codBuscar = buildCodBuscar(p.POSICION, p.PEDIDO, p.MATERIAL);
      const map = maps[centro];
      if (!map.has(material)) {
        map.set(material, { material, descripcion: String(p.DESCRIPCION_MATERIAL || '').trim(), pedidos: [] });
      }
      map.get(material)!.pedidos.push({
        pedido: String(p.PEDIDO || '').trim(),
        posicion: String(p.POSICION || '').trim(),
        codBuscar,
        cantPedida: numOrEmpty(p.CANT_PEDIDA),
        centro,
        // El endpoint no trae "FECHA_PEDIDO": la fecha del pedido viene en "FECHA". fechaLocalEcuador
        // por el mismo motivo que arriba: son timestamps UTC reales, no fechas planas.
        fechaPedido: fechaLocalEcuador(p.FECHA),
        fechaEntrega: fechaLocalEcuador(p.FECHA_ENTREGA),
        ciudadDestino: String(p.CIUDAD_DESTINO || '').trim(),
        // El endpoint no trae "VOL_PEND": el volumen pendiente de entrega viene en "VOLUMENPENDIENTEENTREGA".
        volPend: numOrEmpty(p.VOLUMENPENDIENTEENTREGA),
        fechaEntregaFert: fertFechaEntregaPorCodBuscar.get(codBuscar) || '',
      });
    });
    return {
      '1000': Array.from(maps['1000'].values()).sort((a, b) => b.pedidos.length - a.pedidos.length),
      '2000': Array.from(maps['2000'].values()).sort((a, b) => b.pedidos.length - a.pedidos.length),
    };
  }, [pendientesFiltrados, fertFechaEntregaPorCodBuscar]);

  // Popover del filtro "Fecha" ("Ventana de Producción") — queda solo en Provisionales (tab oculto, de consulta);
  // en Plan P2 la ventana se cambia con el cuadro del panel (handleCambiarVentana). "Resumen" tiene su
  // PROPIO selector aparte (fechaResumenPopover, más abajo) — no comparte esta selección a propósito.
  const fechaPopover = (
    <Popover>
      <PopoverTrigger asChild>
        <Button variant="outline" size="sm" className="h-10 px-6 rounded-2xl border-gray-200 hover:bg-white hover:border-primary/50 gap-2 font-bold text-xs uppercase transition-all shadow-sm">
          <Filter className="w-4 h-4" /> Fecha{selectedDates.length > 0 ? ` (${selectedDates.length})` : ''}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-64 p-0 border-none shadow-2xl rounded-2xl overflow-hidden mt-2" align="end">
        <div className="bg-white p-4 font-sans">
          <div className="flex items-center justify-between mb-4 text-left">
            <h3 className="text-xs font-bold text-gray-800 capitalize">{format(viewDate, 'MMMM yyyy', { locale: es })}</h3>
            <div className="flex gap-1 bg-gray-50 rounded-xl p-1">
              <Button variant="ghost" size="icon" onClick={() => setViewDate(subMonths(viewDate, 1))} className="h-7 w-7 hover:bg-white hover:shadow-sm"><ChevronLeft className="w-4 h-4" /></Button>
              <Button variant="ghost" size="icon" onClick={() => setViewDate(addMonths(viewDate, 1))} className="h-7 w-7 hover:bg-white hover:shadow-sm"><ChevronRight className="w-4 h-4" /></Button>
            </div>
          </div>
          <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-2">Toca varias fechas para combinarlas</p>
          <div className="grid grid-cols-7 gap-y-1 text-center mb-3">
            {['LU', 'MA', 'MI', 'JU', 'VI', 'SA', 'DO'].map((day, idx) => <div key={`cal-head-${idx}`} className="text-[10px] font-bold text-gray-400 uppercase py-1">{day}</div>)}
            {calendarDays.map((day, idx) => {
              if (!day) return <div key={`cal-pad-${idx}`} className="p-1" />;
              const dateStr = format(day, 'yyyy-MM-dd');
              const isSelected = selectedDates.includes(dateStr);
              return (
                <button key={dateStr} onClick={() => toggleSelectedDate(dateStr)} className={cn("relative h-8 w-8 mx-auto rounded-xl flex items-center justify-center transition-all", isSelected ? "bg-primary text-white shadow-md" : "hover:bg-gray-100")}>
                  <span className={cn("text-xs font-bold", !datesWithOrders.has(dateStr) && !isSelected ? "text-gray-200" : "")}>{format(day, 'd')}</span>
                  {datesWithOrders.has(dateStr) && !isSelected && <div className="absolute bottom-1.5 w-1 h-1 bg-primary/40 rounded-full" />}
                </button>
              );
            })}
          </div>
          <Button variant="ghost" size="sm" className="w-full text-[10px] font-black uppercase text-primary h-8 mt-1 rounded-xl hover:bg-primary/5 tracking-widest" onClick={() => setSelectedDates([])}>Ver Todo</Button>
        </div>
      </PopoverContent>
    </Popover>
  );

  // Popover del selector de fecha PROPIO de "Resumen Necesidades" (selectedDatesResumen) —
  // multi-select EXACTO (toggle, igual patrón que fechaPopover/selectedDates): varias fechas SUMAN
  // solo esos días entre sí, no arrastran nada anterior no elegido.
  const fechaResumenPopover = (
    <Popover>
      <PopoverTrigger asChild>
        <Button variant="outline" size="sm" className="h-9 px-4 rounded-xl border-gray-200 hover:bg-white hover:border-primary/50 gap-2 font-bold text-[10px] uppercase transition-all shadow-sm">
          <CalendarIcon className="w-3.5 h-3.5" />
          {selectedDatesResumen.length === 1
            ? format(parseISO(selectedDatesResumen[0]), 'd MMM yyyy', { locale: es })
            : `${selectedDatesResumen.length} fechas`}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-64 p-0 border-none shadow-2xl rounded-2xl overflow-hidden mt-2" align="start">
        <div className="bg-white p-4 font-sans">
          <div className="flex items-center justify-between mb-4 text-left">
            <h3 className="text-xs font-bold text-gray-800 capitalize">{format(viewDateResumen, 'MMMM yyyy', { locale: es })}</h3>
            <div className="flex gap-1 bg-gray-50 rounded-xl p-1">
              <Button variant="ghost" size="icon" onClick={() => setViewDateResumen(subMonths(viewDateResumen, 1))} className="h-7 w-7 hover:bg-white hover:shadow-sm"><ChevronLeft className="w-4 h-4" /></Button>
              <Button variant="ghost" size="icon" onClick={() => setViewDateResumen(addMonths(viewDateResumen, 1))} className="h-7 w-7 hover:bg-white hover:shadow-sm"><ChevronRight className="w-4 h-4" /></Button>
            </div>
          </div>
          <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-2">Toca varias fechas para sumarlas</p>
          <div className="grid grid-cols-7 gap-y-1 text-center mb-3">
            {['LU', 'MA', 'MI', 'JU', 'VI', 'SA', 'DO'].map((day, idx) => <div key={`cal-res-head-${idx}`} className="text-[10px] font-bold text-gray-400 uppercase py-1">{day}</div>)}
            {calendarDaysResumen.map((day, idx) => {
              if (!day) return <div key={`cal-res-pad-${idx}`} className="p-1" />;
              const dateStr = format(day, 'yyyy-MM-dd');
              const isSelected = selectedDatesResumen.includes(dateStr);
              return (
                <button key={dateStr} onClick={() => toggleSelectedDateResumen(dateStr)} className={cn("relative h-8 w-8 mx-auto rounded-xl flex items-center justify-center transition-all", isSelected ? "bg-primary text-white shadow-md" : "hover:bg-gray-100")}>
                  <span className="text-xs font-bold">{format(day, 'd')}</span>
                </button>
              );
            })}
          </div>
          <Button variant="ghost" size="sm" className="w-full text-[10px] font-black uppercase text-primary h-8 mt-1 rounded-xl hover:bg-primary/5 tracking-widest" onClick={() => setSelectedDatesResumen([format(new Date(), 'yyyy-MM-dd')])}>Solo hoy</Button>
        </div>
      </PopoverContent>
    </Popover>
  );

  // Carga operativa ejecutada (FERT) de UN centro, dentro del bloque de ese centro en "4 · Resumen y
  // reporte" (usuario 2026-10-12: antes iba todo mezclado debajo de las capacidades de ambos centros).
  const renderCargaCentro = (centroId: '1000' | '2000') => {
    const center = centroId === '1000'
      ? { t: 'Carga operativa (FERT) · Centro 1000', d: groupedSummary1000, c: 'text-green-700', b: 'bg-green-600', expanded: expandedCategorias1000, setExpanded: setExpandedCategorias1000 }
      : { t: 'Carga operativa (FERT) · Centro 2000', d: groupedSummary2000, c: 'text-indigo-700', b: 'bg-indigo-600', expanded: expandedCategorias2000, setExpanded: setExpandedCategorias2000 };
    const idx = centroId === '1000' ? 0 : 1;
    return (
        <div key={idx} className="space-y-4">
          <div className="flex items-center justify-between px-1">
            <h3 className={cn("text-[11px] font-black uppercase flex items-center gap-2 tracking-widest", center.c)}>
              <div className={cn("w-2.5 h-2.5 rounded-full", center.b)} /> {center.t}
            </h3>
            <div className="flex items-center gap-2 text-[10px] font-bold">
              <span className="rounded-lg bg-blue-50 text-blue-700 px-2 py-1">{statsPorCentro[centroId].ordenes} órdenes</span>
              <span className="rounded-lg bg-green-50 text-green-700 px-2 py-1">{statsPorCentro[centroId].unidades.toLocaleString()} unid.</span>
              <span className="rounded-lg bg-amber-50 text-amber-700 px-2 py-1">{statsPorCentro[centroId].horasEmpaque.toFixed(1)} h empaque</span>
              <Badge variant="outline" className="text-[10px] font-bold border-gray-200 text-gray-500">{center.d.length} categorías</Badge>
            </div>
          </div>
          <Card className="rounded-2xl border border-gray-100 shadow-sm overflow-hidden bg-white">
            {center.d.length === 0 ? (
              <div className="py-16 text-center text-gray-500 font-bold uppercase tracking-widest opacity-30">Sin operaciones programadas</div>
            ) : (
              <div className="max-h-[600px] overflow-y-auto px-4">
                <Accordion type="multiple" value={center.expanded} onValueChange={center.setExpanded} className="divide-y divide-gray-50">
                  {center.d.map(group => (
                    <AccordionItem key={group.categoria} value={group.categoria} className="border-b-0">
                      <AccordionTrigger className="hover:no-underline py-3 px-2">
                        <div className="flex items-center justify-between w-full pr-4 text-left">
                          <div className="flex items-center gap-3">
                            <Badge className="bg-blue-50 text-blue-800 font-bold text-[10px] uppercase border-blue-200">D{group.densidad}</Badge>
                            <div>
                              <p className="text-xs font-black text-gray-700 uppercase">{group.categoria}</p>
                              <p className="text-[10px] font-bold text-gray-500 uppercase">{group.tipo} · {group.rows.length} variante(s)</p>
                            </div>
                          </div>
                          <div className="flex items-center gap-6 text-right">
                            <div>
                              <p className="text-[9px] font-black uppercase text-gray-500 tracking-wider">Órdenes</p>
                              <p className="text-xs font-mono font-bold text-gray-600">{group.totalOrdenes}</p>
                            </div>
                            <div>
                              <p className="text-[9px] font-black uppercase text-gray-500 tracking-wider">Unidades</p>
                              <p className="text-xs font-mono font-black text-gray-900">{group.totalCantidad.toLocaleString()}</p>
                            </div>
                            {/* Paquetes de 60 cm (solo planchas); "enrollar" = C-PLANCHA (ver paquetesPlancha). */}
                            <div title={`Paquetes de planchas de ${ALTURA_PAQUETE_CM} cm (unidades ÷ ⌊${ALTURA_PAQUETE_CM}/espesor⌋, por material). C-PLANCHA: además se enrolla el paquete.`}>
                              <p className="text-[9px] font-black uppercase text-teal-700 tracking-wider">Paquetes</p>
                              <p className="text-xs font-mono font-black text-teal-700">
                                {group.paquetes > 0 ? group.paquetes : '—'}
                                {group.paquetesEnrollar > 0 && <span className="ml-1 text-[10px] text-purple-700">({group.paquetesEnrollar} enrollar)</span>}
                              </p>
                            </div>
                            <div>
                              <p className="text-[9px] font-black uppercase text-amber-500 tracking-wider">Tiempo Planchas (H)</p>
                              <p className="text-xs font-mono font-black text-amber-600">{group.totalTiempoEmpaque.toFixed(2)}</p>
                            </div>
                          </div>
                        </div>
                      </AccordionTrigger>
                      <AccordionContent>
                        <table className="w-full border-collapse text-center font-sans bg-gray-50/40 rounded-xl overflow-hidden">
                          <thead className="bg-gray-50 text-[10px] font-black uppercase text-gray-500 border-b border-gray-100">
                            <tr>
                              <th className="px-4 py-2 border-r border-gray-100 text-left">Máquina / Recurso</th>
                              <th className="px-3 py-2 border-r border-gray-100 text-primary">Tipo</th>
                              <th className="px-3 py-2 border-r border-gray-100 bg-blue-50/50 text-blue-800">Espesor</th>
                              <th className="px-3 py-2 border-r border-gray-100">Órdenes</th>
                              <th className="px-3 py-2 border-r border-gray-100 font-black">Unidades</th>
                              <th className="px-3 py-2 border-r border-gray-100 text-teal-700">Paquetes ({ALTURA_PAQUETE_CM} cm)</th>
                              <th className="px-3 py-2 border-r border-gray-100 text-purple-700">Enrollar (C-Plancha)</th>
                              <th className="px-4 py-2 text-center text-amber-700 bg-amber-50/30">Tiempo Planchas (H)</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-gray-50 text-[11px]">
                            {group.rows.map((row, i) => (
                              <tr key={i} className="hover:bg-gray-50/50 transition-colors">
                                <td className="px-4 py-2 font-black text-gray-700 border-r border-gray-100 uppercase text-left">{row.maquina}</td>
                                <td className="px-3 py-2 font-black text-primary border-r border-gray-100 uppercase">{row.tipo}</td>
                                <td className="px-3 py-2 font-black text-blue-700 border-r border-gray-100 bg-blue-50/5">{row.espesor}</td>
                                <td className="px-3 py-2 font-mono border-r border-gray-100 text-gray-500">{row.totalOrdenes}</td>
                                <td className="px-3 py-2 font-mono font-black text-gray-900 border-r border-gray-100">{row.totalCantidad.toLocaleString()}</td>
                                <td className="px-3 py-2 font-mono font-black text-teal-700 border-r border-gray-100">{row.paquetes ? row.paquetes : '—'}</td>
                                <td className="px-3 py-2 font-mono font-black text-purple-700 border-r border-gray-100">{row.paquetesEnrollar ? row.paquetesEnrollar : '—'}</td>
                                <td className="px-4 py-2 font-mono font-black text-amber-600 text-center bg-amber-50/5">{row.totalTiempoEmpaque.toFixed(2)}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </AccordionContent>
                    </AccordionItem>
                  ))}
                </Accordion>
              </div>
            )}
            {center.d.length > 0 && (
              <div className="bg-gray-100 text-gray-800 font-black text-[10px] uppercase border-t-2 border-gray-200 px-6 py-3 flex items-center justify-between">
                <span className="tracking-widest">Total {center.t}</span>
                <div className="flex items-center gap-8 font-mono">
                  <span>{center.d.reduce((s, r) => s + r.totalOrdenes, 0)} órdenes</span>
                  <span className="text-green-600">{center.d.reduce((s, r) => s + r.totalCantidad, 0).toLocaleString()} unid.</span>
                  <span className="text-teal-700">
                    {center.d.reduce((s, r) => s + r.paquetes, 0)} paquetes
                    {center.d.some(r => r.paquetesEnrollar > 0) && ` (${center.d.reduce((s, r) => s + r.paquetesEnrollar, 0)} a enrollar)`}
                  </span>
                  <span className="text-amber-600">{center.d.reduce((s, r) => s + r.totalTiempoEmpaque, 0).toFixed(1)}h empaque</span>
                </div>
              </div>
            )}
          </Card>
        </div>
    );
  };

  if (!mounted) return null;

  return (
    <div className="p-4 md:p-6 space-y-6 bg-white min-h-screen rounded-xl border border-gray-100 shadow-sm font-sans text-left">
      <div className="flex items-center justify-between pb-4 border-b border-gray-100">
        <div className="flex items-center space-x-3 text-left">
          <div className="p-2 bg-green-600/10 rounded-xl"><ShoppingCart className="w-6 h-6 text-green-600" /></div>
          <div>
            <h2 className="text-xl font-bold text-gray-800 uppercase tracking-tight">Plan Táctico Venta Externa</h2>
            <p className="text-xs text-gray-500 font-medium">Control de Órdenes FERT y Programación Técnica</p>
          </div>
        </div>
        {/* "Sincronizar": trae datos crudos de SAP y, si ya hay una Ventana de Producción elegida,
            calcula la Necesidad BOM automáticamente al terminar y, si aún no hay P2 de hoy, lo genera
            (ver handleSincronizarYGenerar y autoGenerarP2Pendiente) —
            mismo color/forma en los 4 módulos tácticos (azul), distinto de la familia "Generar
            Necesidades"/"Generar Respuestas" (índigo/sólido, ver más abajo en el tab Plan P2). El
            botón "Generar Necesidades · BOM FERT" sigue disponible aparte para recalcular tras
            cambiar la fecha, sin re-sincronizar todo. */}
        {/* Pestañas-paso (usuario 2026-10-12, ver [[flujo-dos-etapas]]): un solo Sincronizar (datos +
            Necesidad BOM, NO graba) y cada pestaña con su acción. Las fechas no se eligen: todo el
            ciclo cuelga del PT fijo (hoy + 2 hábiles), visible acá. */}
        <div className="flex items-center gap-2">
          {datosCargados && !resultadoRestaurado && (
            <span className="rounded-xl border border-slate-200 bg-slate-50 px-3 h-10 flex items-center text-[11px] font-bold text-slate-700 whitespace-nowrap" title="Fechas del ciclo de hoy: P2 y Data Aprobada se graban/consultan para este PT; Empaque y el reporte son de este día.">
              PT {format(parseISO(fechasHorizonte.pt), 'EEE dd/MM', { locale: es })} · Recup. {format(parseISO(recuperacionDePT(fechasHorizonte.pt)), 'EEE dd/MM', { locale: es })}
            </span>
          )}
          <Button onClick={handleSincronizarYGenerar} disabled={syncStep !== 'idle'} variant={datosCargados ? 'outline' : 'default'} className={cn(
            "rounded-xl h-10 px-6 gap-2 font-bold text-xs uppercase",
            datosCargados ? "border-blue-200 text-blue-700 hover:bg-blue-50" : "bg-blue-600 text-white hover:bg-blue-700 shadow-lg"
          )} title="Trae los datos de SAP y calcula la Necesidad BOM. No graba nada: el P2 se genera en la pestaña 1.">
            {syncStep !== 'idle' ? <Loader2 className="w-4 h-4 animate-spin" /> : <RefreshCw className="w-4 h-4" />} Sincronizar
          </Button>
          <DatosSapEstado onActualizar={() => { void handleSincronizarYGenerar(); }} disabled={syncStep !== 'idle'} />
        </div>
      </div>

      {/* Barra de progreso SOLO de la fase "sincronizando" (sin indicador propio). La fase
          "generando" (si ya había fecha elegida) ya tiene su propia barra junto al botón "Generar
          Necesidades · BOM FERT" (isExplodingBom/bomProgress, "X/Y materiales explotados") —
          mostrar esta también ahí duplicaba el aviso (mismo problema reportado por el usuario con
          una captura real en Corte y Laminado). */}
      {syncStep === 'sincronizando' && (
        <div className="flex items-center gap-3 rounded-xl border border-blue-100 bg-blue-50/40 px-4 py-2.5 mt-4">
          <div className="flex-1 h-1.5 bg-blue-100 rounded-full overflow-hidden">
            <div className="h-full bg-blue-600 w-1/2 transition-all duration-700 ease-out" />
          </div>
          <span className="text-[10px] font-black uppercase tracking-widest text-blue-700 shrink-0 flex items-center gap-1.5">
            <Loader2 className="w-3.5 h-3.5 animate-spin" />
            Sincronizando SAP...
          </span>
        </div>
      )}

      {/* Estado vacío inicial: el módulo no consulta SAP al abrirse. Mismo criterio y misma
          redacción compacta que Corte Espuma (ver [[carga_manual_modulos_tacticos]]). */}
      {planCargadoDe && (
        <div
          className="flex items-center gap-2.5 rounded-xl border border-emerald-200 bg-emerald-50/50 px-4 py-2.5 text-left"
          title="Resumen recuperado del respaldo guardado junto al reporte: se muestra el resultado de ese momento, sin consultar SAP ni recalcular. Las acciones que graban (P2/P3/PFD/SAP) quedan bloqueadas hasta Sincronizar."
        >
          <FileText className="w-4 h-4 text-emerald-700 shrink-0" />
          <p className="text-[11px] font-bold text-slate-600">
            Plan cargado del reporte del <span className="font-black text-emerald-700">{format(parseISO(planCargadoDe.fechaObjetivo), 'EEE dd/MM/yyyy', { locale: es })}</span>
            {' '}(guardado {format(new Date(planCargadoDe.guardadoEn), 'dd/MM HH:mm')}) — <span className="font-black text-emerald-700">solo consulta</span>, tal cual se guardó; <span className="font-black text-blue-700">Sincronizar</span> trae datos vigentes y habilita generar y enviar.
          </p>
        </div>
      )}
      {!datosCargados && !isLoading && !planCargadoDe && (
        <div
          className="flex items-center gap-2.5 rounded-xl border border-dashed border-blue-200 bg-blue-50/40 px-4 py-2.5 text-left"
          title="Este módulo no consulta SAP al abrirse. Sincronizar trae Grupos, Restricciones, Provisionales, FERT y Tiempos de Ensamblado."
        >
          <RefreshCw className="w-4 h-4 text-blue-600 shrink-0" />
          <p className="text-[11px] font-bold text-slate-600">
            Sin datos cargados — pulsa <span className="font-black text-blue-700">Sincronizar</span> y sigue las pestañas 1 → 5.
          </p>
        </div>
      )}

      <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
        <TabsList className="grid grid-cols-5 h-10 bg-gray-50/80 p-1 rounded-xl border border-gray-100 mb-6">
          {/* Pestañas-paso (usuario 2026-10-12, ver [[flujo-dos-etapas]]): una pestaña por paso del
              día, cada una con su acción principal y ✓ cuando ya se hizo hoy (estado del día en vivo).
              Pendientes queda al final como consulta. Provisionales y FERT siguen OCULTAS (solo
              consulta): sus TabsContent y datos se conservan porque alimentan cálculos. */}
          {[
            { v: 'planP2', l: '1 · P2', i: Layers, hecho: estadoDia.hecho('ve-p2') },
            { v: 'dataAprobada', l: '2 · Data Aprobada', i: ClipboardCheck, hecho: !!dataAprobadaFetchedAt },
            { v: 'pfdVenta', l: '3 · PFD-VENTA', i: Package, hecho: estadoDia.hecho('ve-pfd') },
            { v: 'resumen', l: '4 · Resumen y reporte', i: LayoutDashboard, hecho: estadoDia.hecho('ve-rep-1000') },
            { v: 'pendientes', l: 'Pendientes', i: Clock, hecho: false },
          ].map(tab => (
            <TabsTrigger key={tab.v} value={tab.v} className="gap-1.5 text-[9px] font-bold uppercase transition-all data-[state=active]:bg-white data-[state=active]:shadow-sm">
              <tab.i className="w-3.5 h-3.5" /> {tab.l}
              {tab.hecho && <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" aria-label="hecho hoy" />}
            </TabsTrigger>
          ))}
        </TabsList>

        <TabsContent value="resumen" className="space-y-6 animate-in fade-in duration-300">
          {/* Fecha de producción (PT = hoy + 2 hábiles, mismo horizonte de todos los módulos; usuario
              2026-10-12): una sola vez arriba. Capacidad, ventana y reporte de Empaque son del PT; la
              carga operativa (FERT) de cada centro muestra las fechas elegidas acá (por defecto el PT). */}
          <div className="flex justify-between items-center bg-gray-50/50 p-4 rounded-2xl border border-gray-100">
            <div className="flex items-center gap-4 text-left">
              <div className="p-2 bg-primary/10 rounded-xl"><CalendarIcon className="w-5 h-5 text-primary" /></div>
              <div>
                <p className="text-[10px] font-bold uppercase text-gray-500 tracking-wider">Fecha de producción (PT)</p>
                <h3 className="text-sm font-black text-gray-700 uppercase">
                  {format(parseISO(fechasHorizonte.pt), "EEEE d 'de' MMMM", { locale: es })}
                </h3>
                <p className="text-[10px] text-gray-500 mt-0.5">
                  {selectedDatesResumen.length === 1 && selectedDatesResumen[0] === fechasHorizonte.pt
                    ? 'Capacidad, carga operativa (FERT) y reporte de cada centro para este día.'
                    : `Carga operativa (FERT) de: ${selectedDatesResumen.map(d => format(parseISO(d), 'dd/MM')).join(', ')} — la capacidad y el reporte siguen siendo del PT.`}
                </p>
              </div>
            </div>
            {fechaResumenPopover}
          </div>

          {/* Capacidad Operativa · Empaque: máquina(s) de empaque con turnos/operadores editables (mismo
              patrón que Capacidad Operativa en Corte Espuma), capacidad en horas y % Ocupación contra
              las horas necesarias (Espumas a nivel FERT/PT + Rollos a nivel componente, ver
              resumenEmpaquePorCentro). Config solo en memoria — no persiste al recargar.
              Reestilizado 2026-09-22 para calzar con el lenguaje visual "industrial/ejecutivo" que ya
              usa Corte Espuma (ver renderMachineCol en TacticalPlanEspumasSection): cabecera
              slate-50/70 con el nombre del centro grande + "Gestión de Tiempos", métricas en chips con
              borde en vez de texto suelto, botón de encendido/apagado de máquina (no checkbox) y
              turnos en tarjetas con select coloreado (ámbar Día/Sábado, morado Noche) — mismos colores
              que usa esa función. Sin cambios de lógica/cálculo, solo de piel. */}
          <div className="space-y-4">
            <div className="flex flex-col md:flex-row md:items-start md:justify-between gap-4">
              <div className="text-left">
                <p className="text-[10px] font-bold uppercase text-cyan-500 tracking-wider">Capacidad vs. Necesidad</p>
                <h3 className="text-sm font-black text-gray-700 uppercase">Capacidad Operativa · Empaque</h3>
                <p className="text-[10px] text-gray-500 mt-1">Turnos, operadores y mantenimiento de cada máquina de empaque — junto con las horas necesarias (mismo dato que sale en el correo), da el % de ocupación.</p>
              </div>
            </div>
            {(['1000', '2000'] as const).map(centro => {
              // Mismo esquema que Capacidad Operativa de Corte Espuma (usuario 2026-10-09): cabecera,
              // ejecución del plan, turnos de la planta (aplican a todas las máquinas), barra del grupo
              // con el rendimiento, una columna por máquina (renderMachineCol) y abajo el agregado
              // Capacidad Total / % Ocupación. Mismo cálculo de antes (horasMaquinaEmpaque).
              const r = resumenEmpaquePorCentro[centro];
              const maquinas = EMPAQUE_MACHINES_BY_CENTRO[centro];
              const sobreCapacidad = r.ocupacionPct !== null && r.ocupacionPct > 100;
              const activas = maquinas.filter(m => empaqueConfig[m.id]?.activa);
              const mttoCentro = maquinas.reduce((s, m) => s + (empaqueConfig[m.id]?.activa ? mttoEmpaqueDe(m.id) : 0), 0);
              const setMaquina = (id: string, patch: Partial<EmpaqueShiftConfig>) => setEmpaqueConfig(prev => ({ ...prev, [id]: { ...prev[id], ...patch } }));
              const setPlanta = (patch: Partial<EmpaqueShiftConfig>) => setEmpaqueConfig(prev => {
                const next = { ...prev };
                maquinas.forEach(m => { if (next[m.id]) next[m.id] = { ...next[m.id], ...patch }; });
                return next;
              });
              // Valor común de un campo entre las máquinas del centro ('' = Mixto).
              const comun = <K extends keyof EmpaqueShiftConfig>(k: K): EmpaqueShiftConfig[K] | '' => {
                const valores = new Set(maquinas.map(m => empaqueConfig[m.id]?.[k]));
                return valores.size === 1 ? [...valores][0] as EmpaqueShiftConfig[K] : '';
              };
              const turnosPlanta = [
                { campo: 'day' as const, paro: 'paroDay' as const, op: 'operadoresDay' as const, asig: 'asignadosDay' as const, etiqueta: 'Día', opciones: shiftOptionsEmpaque, color: 'text-amber-700' },
                { campo: 'night' as const, paro: 'paroNight' as const, op: 'operadoresNight' as const, asig: 'asignadosNight' as const, etiqueta: 'Noche', opciones: nightShiftOptionsEmpaque, color: 'text-purple-700' },
                { campo: 'saturday' as const, paro: 'paroSaturday' as const, op: 'operadoresSaturday' as const, asig: 'asignadosSaturday' as const, etiqueta: 'Sábado', opciones: shiftOptionsEmpaque, color: 'text-amber-700' },
              ];
              const turnosSinHorario = activas.flatMap(m => [
                empaqueConfig[m.id]?.day === 'EMPTY' ? `${m.id} día` : null,
                empaqueConfig[m.id]?.night === 'EMPTY' ? `${m.id} noche` : null,
              ].filter(Boolean) as string[]);
              return (
                <div key={centro} className="space-y-4">
                <div className="rounded-2xl border border-gray-100 shadow-sm overflow-hidden bg-white text-left font-sans">
                  <div className="px-8 py-4 bg-slate-50/70 border-b border-gray-100 flex flex-wrap items-center justify-between gap-3">
                    <div className="flex items-baseline gap-3">
                      <h4 className="text-xl font-black tracking-tighter text-gray-800">CENTRO {centro}</h4>
                      <p className="text-[10px] font-black uppercase text-slate-500 tracking-widest">Gestión de Tiempos · Empaque</p>
                    </div>
                    <div className="flex items-center gap-2">
                      {/* Reporte propio de este centro (mismo esquema que Laminado, usuario 2026-10-08). */}
                      <Popover>
                        <PopoverTrigger asChild>
                          <button
                            type="button"
                            className="flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-2 text-[10px] font-black uppercase tracking-widest text-slate-600 hover:bg-slate-50"
                          >
                            <Mail className="w-3.5 h-3.5" /> Enviar Reporte
                          </button>
                        </PopoverTrigger>
                        <PopoverContent className="w-80 p-4 space-y-3" align="end">
                          <div>
                            <p className="text-xs font-black uppercase tracking-widest text-slate-700">Empaque · Centro {centro}</p>
                            <p className="text-[10px] text-slate-500 mt-1">Venta Externa / Muebles — gestión de tiempos y capacidad de este centro, con datos de Data Aprobada (respuesta ya verificada), no del PFD-VENTA.</p>
                          </div>
                          <ReportePlanTxtAcciones flujo={reporteFlujoEmpaque[centro]} />
                          <p className="text-[10px] text-slate-500">Destinatarios precargados desde Grupo_correos_VentaExterna — editables en la vista previa.</p>
                        </PopoverContent>
                      </Popover>
                      <ReportePlanTxtVistaPrevia
                        flujo={reporteFlujoEmpaque[centro]}
                        titulo={`Empaque Venta Externa / Muebles — Centro ${centro}`}
                        destinatarios={destinatariosReporteEmpaque}
                        onDestinatariosChange={setDestinatariosReporteEmpaque}
                      />
                    </div>
                  </div>

                  {ventanaEmpaque[centro] && (
                    <div
                      className="mx-8 mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 bg-blue-50/50 border border-blue-100 rounded-lg px-3 py-1.5"
                      title="Desde la noche del día hábil anterior hasta el fin del turno día del plan (siguiente día hábil). El MTTO solo resta si cae dentro de los turnos. El Turno Sábado solo suma si un sábado cae dentro."
                    >
                      <span className="text-[9px] font-black uppercase tracking-widest text-blue-700">Ejecución del plan de producción</span>
                      <span className="text-[11px] font-black text-slate-700 tabular-nums">
                        INICIO: <span className="text-blue-700">{fechaHoraEjecucion(ventanaEmpaque[centro]!.inicio)}</span> ⇒ FIN: <span className="text-blue-700">{fechaHoraEjecucion(ventanaEmpaque[centro]!.fin)}</span>
                      </span>
                      {maquinas.some(m => (empaqueConfig[m.id]?.saturday ?? 'EMPTY') !== 'EMPTY') && (
                        ventanaEmpaque.sabadoCuenta
                          ? <span className="text-[10px] font-black text-emerald-700">Turno Sábado incluido</span>
                          : <span className="text-[10px] font-black text-amber-700">Turno Sábado activo, pero no cae en esta ventana: no suma horas</span>
                      )}
                    </div>
                  )}

                  {maquinas.length === 0 ? (
                    <p className="text-[10px] text-gray-400 font-bold uppercase tracking-widest text-center py-6">Sin máquina de empaque registrada en este centro</p>
                  ) : (
                    <>
                      {/* Turnos de la planta: aplican a todas las máquinas del centro (como Corte Espuma);
                          cada columna permite el ajuste puntual. */}
                      <div className="px-8 py-3 bg-white border-b border-gray-100 flex flex-col gap-1.5">
                        {turnosPlanta.map(t => {
                          const valor = comun(t.campo);
                          const paro = comun(t.paro);
                          const horasBase = t.opciones.find(o => o.v === valor)?.h || 0;
                          return (
                            <div key={t.campo} className="flex flex-wrap items-center gap-x-3 gap-y-1">
                              <span className="text-[10px] font-black text-slate-500 uppercase w-14">{t.etiqueta}</span>
                              <select
                                value={valor}
                                onChange={(e) => setPlanta({ [t.campo]: e.target.value } as Partial<EmpaqueShiftConfig>)}
                                className={cn("bg-white border border-slate-200 rounded-md px-2 py-1 text-[10px] font-black outline-none appearance-none cursor-pointer w-[160px]", t.color)}
                                title={`Aplica este horario a las ${maquinas.length} máquina(s) de empaque del centro ${centro}.`}
                              >
                                {valor === '' && <option value="">— Mixto —</option>}
                                {t.opciones.map(o => <option key={o.v} value={o.v}>{o.l}</option>)}
                              </select>
                              <span className={cn("text-[10px] font-black whitespace-nowrap tabular-nums w-10", t.color)}>{horasBase}h</span>
                              <span className="text-[9px] font-bold text-slate-500 uppercase">Paro</span>
                              <input
                                type="number" min={0} max={100} value={paro === '' ? '' : paro}
                                placeholder="Mixto"
                                onChange={(e) => setPlanta({ [t.paro]: Number(e.target.value) || 0 } as Partial<EmpaqueShiftConfig>)}
                                className="w-12 bg-white border border-slate-200 rounded px-1 py-0.5 text-[10px] font-black text-slate-700 outline-none text-right"
                              />
                              <span className="text-[10px] font-black text-slate-500">%</span>
                              {/* Operadores por turno (no multiplican la capacidad) y su asignación por
                                  habilidades (cuboHabilidadesOP, línea de proceso EMPAQUE, usuario
                                  2026-10-09): un selector por puesto. Solo en pantalla, no va al correo. */}
                              <span className="ml-2 text-[9px] font-bold text-slate-500 uppercase">Operadores</span>
                              <input
                                type="number" min={0} max={12} value={comun(t.op) === '' ? '' : comun(t.op) as number}
                                placeholder="Mixto"
                                onChange={(e) => setPlanta({ [t.op]: Math.min(12, Math.max(0, Number(e.target.value) || 0)) } as Partial<EmpaqueShiftConfig>)}
                                className="w-12 bg-white border border-slate-200 rounded px-1 py-0.5 text-[10px] font-black text-slate-700 outline-none text-right"
                              />
                              {(() => {
                                const base = empaqueConfig[maquinas[0].id];
                                const puestos = Math.min(12, Number(comun(t.op) === '' ? base?.[t.op] ?? 0 : comun(t.op)) || 0);
                                const asignados = base?.[t.asig] ?? [];
                                if (puestos === 0 || operadoresEmpaque.length === 0) return null;
                                return Array.from({ length: puestos }, (_, i) => {
                                  const actual = asignados[i] ?? '';
                                  const ocupados = new Set(asignados.filter((c, j) => j !== i && c));
                                  const conocido = !actual || operadoresEmpaque.some(o => o.codigo === actual);
                                  return (
                                    <select
                                      key={i}
                                      value={actual}
                                      onChange={(e) => {
                                        const next = Array.from({ length: puestos }, (_, j) => asignados[j] ?? '');
                                        next[i] = e.target.value;
                                        setPlanta({ [t.asig]: next } as Partial<EmpaqueShiftConfig>);
                                      }}
                                      className={cn("bg-white border rounded px-1.5 py-0.5 text-[10px] outline-none max-w-[150px]", actual ? "border-slate-200 text-slate-700 font-bold" : "border-dashed border-slate-300 text-slate-400")}
                                      title={`${t.etiqueta} · operador ${i + 1}`}
                                    >
                                      <option value="">— OP{i + 1} —</option>
                                      {!conocido && <option value={actual}>{actual}</option>}
                                      {operadoresEmpaque.map(o => (
                                        <option key={o.codigo} value={o.codigo} disabled={ocupados.has(o.codigo)}>{o.nombre}</option>
                                      ))}
                                    </select>
                                  );
                                });
                              })()}
                            </div>
                          );
                        })}
                        {habilidadesOP.length > 0 && operadoresEmpaque.length === 0 && (
                          <p className="text-[10px] text-amber-600">
                            Sin personal con línea de proceso &quot;{LINEA_PROCESO_EMPAQUE}&quot; en el cubo de habilidades. Líneas disponibles: {lineasProcesoDisponibles.join(' · ') || '—'}.
                          </p>
                        )}
                      </div>

                      {/* Barra del grupo. El rendimiento se edita solo en el recuadro de cada máquina
                          (usuario 2026-10-09: no duplicarlo). */}
                      <div className="flex items-center justify-center gap-2 py-1.5 border-b-2 border-teal-300 bg-teal-50/50">
                        <span className="text-[10px] font-black uppercase tracking-widest text-teal-700">Empaque ({maquinas.length})</span>
                      </div>

                      <div className="grid" style={{ gridTemplateColumns: `repeat(${maquinas.length}, minmax(0, 1fr))` }}>
                        {maquinas.map(m => {
                          const c = empaqueConfig[m.id];
                          if (!c) return null;
                          const sap = mttoSAPEmpaque[m.id];
                          const h = horasMaquinaEmpaque(m.id);
                          // La necesidad de Empaque no viene por máquina: con una sola máquina activa es
                          // toda suya; con varias solo se muestra el agregado de abajo.
                          const tiempoProceso = c.activa && activas.length === 1 ? r.totalHoras : null;
                          const pct = tiempoProceso !== null && h.neto > 0 ? (tiempoProceso / h.neto) * 100 : null;
                          return (
                            <div key={m.id} className={cn("col-span-1 border-r border-gray-100 last:border-r-0 flex flex-col", !c.activa && "bg-slate-50/80")}>
                              <div className="p-3 border-b border-gray-100 text-center">
                                <p className={cn("text-xs font-black uppercase tracking-tight", c.activa ? "text-slate-800" : "text-slate-500 line-through")}>{m.nombre}</p>
                                <p className="text-[10px] font-bold uppercase truncate text-slate-500">{m.id}</p>
                                <button
                                  type="button"
                                  onClick={() => setMaquina(m.id, { activa: !c.activa })}
                                  className={cn(
                                    "mt-1.5 w-full max-w-xs rounded-md px-2 py-1 text-[10px] font-black uppercase tracking-wider transition-colors border",
                                    c.activa
                                      ? "bg-emerald-50 text-emerald-700 border-emerald-200 hover:bg-emerald-100"
                                      : "bg-slate-100 text-slate-500 border-slate-200 hover:bg-slate-200"
                                  )}
                                  title={c.activa ? 'Máquina en servicio: sus horas suman a la capacidad. Click para apagarla.' : 'Máquina fuera de servicio: no aporta capacidad. Click para encenderla.'}
                                >
                                  {c.activa ? 'En servicio' : 'Fuera de servicio'}
                                </button>
                              </div>
                              {/* Con una sola máquina los turnos se fijan solo arriba (usuario 2026-10-09: no
                                  duplicar la selección); con varias, cada columna permite el ajuste puntual. */}
                              <div className={cn("p-3 grid grid-cols-1 gap-3", maquinas.length > 1 ? "md:grid-cols-3" : "")}>
                                <div className={cn("gap-3", maquinas.length > 1 ? "space-y-3" : "grid grid-cols-1 md:grid-cols-2 items-start")}>
                                  <div className="space-y-1">
                                    <p className="text-[10px] font-black text-slate-500 uppercase tracking-wide">
                                      Mtto Preventivo{c.mttoManual ? ' (ajustado)' : sap && sap.maquinas.length > 0 ? ` · SAP ${sap.maquinas.join(', ')}` : ''}
                                    </p>
                                    <div className="flex items-center justify-center gap-1 bg-indigo-50 border border-indigo-200 rounded p-1.5">
                                      <input
                                        type="number" min={0} step={0.25} value={Number(mttoEmpaqueDe(m.id).toFixed(2))}
                                        onChange={(e) => setMaquina(m.id, { mttoPreventivoHoras: Number(e.target.value) || 0, mttoManual: true })}
                                        className="w-14 bg-transparent text-[10px] font-black text-indigo-700 outline-none text-right"
                                      />
                                      <span className="text-[10px] font-black text-indigo-700">H</span>
                                    </div>
                                    {sap && sap.ordenes.length > 0 && (
                                      <p className="text-[9px] text-slate-500">SAP en la ventana: {sap.ordenes.map(o => `${o.maquina} ${o.inicio} (${o.horas.toFixed(2)} h)`).join(' · ')}</p>
                                    )}
                                    {sap && sap.maquinas.length > 0 && sap.ordenes.length === 0 && !c.mttoManual && (
                                      <p className="text-[9px] text-slate-500">SAP {sap.maquinas.join(', ')}: sin mantenimiento dentro de la ventana.</p>
                                    )}
                                    {sap && sap.maquinas.length === 0 && (
                                      <p className="text-[9px] text-amber-600">Sin restricción MANTENIMIENTO en los grupos de Venta Externa del centro: se escribe a mano.</p>
                                    )}
                                    {c.mttoManual && sap && sap.maquinas.length > 0 && (
                                      <button type="button" onClick={() => setMaquina(m.id, { mttoManual: false })} className="text-[9px] font-black uppercase text-indigo-700 hover:underline">
                                        Volver a lo de SAP ({sap.horas.toFixed(2)} h)
                                      </button>
                                    )}
                                  </div>
                                  <div className="border border-gray-200 rounded-lg p-2 space-y-1.5 bg-slate-50/40">
                                    <p className="text-[10px] font-black text-slate-600 uppercase tracking-wide">Empaque · {m.id}</p>
                                    <div className="flex items-center justify-between gap-2">
                                      <span className="text-[9px] font-bold text-slate-500 uppercase tracking-wide">Rendim. (%)</span>
                                      <input
                                        type="number" min={0} max={100} value={c.rendimiento}
                                        onChange={(e) => setMaquina(m.id, { rendimiento: Math.min(100, Math.max(0, Number(e.target.value) || 0)) })}
                                        className="w-12 bg-white border border-gray-200 rounded px-1 py-0.5 text-[10px] font-black text-slate-700 outline-none text-right"
                                      />
                                    </div>
                                    <div className="flex items-center justify-between gap-2" title="Horas de empaque que necesita el plan (mismo dato que sale en el correo).">
                                      <span className="text-[9px] font-bold text-slate-500 uppercase tracking-wide">Tiempo Proceso</span>
                                      <span className="text-[10px] font-black text-slate-700">{tiempoProceso !== null ? `${tiempoProceso.toFixed(1)}h` : '—'}</span>
                                    </div>
                                    <div className="flex items-center justify-between gap-2" title="Horas programadas (Día+Noche+Sábado) de este recurso, sin descontar paros ni rendimiento.">
                                      <span className="text-[9px] font-bold text-slate-500 uppercase tracking-wide">Tiempo Máquina</span>
                                      <span className="text-[10px] font-black text-slate-700">{h.bruto.toFixed(1)}h</span>
                                    </div>
                                    <div
                                      className={cn("flex items-center justify-between gap-2 rounded p-1 -mx-1", pct !== null && pct > 100 ? "bg-red-50" : "bg-emerald-50")}
                                      title={`Ocupación Recurso = Tiempo Proceso / capacidad neta (${h.neto.toFixed(2)}h con paros, rendimiento y MTTO).`}
                                    >
                                      <span className={cn("text-[9px] font-bold uppercase tracking-wide", pct !== null && pct > 100 ? "text-red-700" : "text-emerald-700")}>Ocupación Recurso</span>
                                      <span className={cn("text-[10px] font-black", pct !== null && pct > 100 ? "text-red-700" : "text-emerald-700")}>{pct !== null ? `${pct.toFixed(0)}%` : '—'}</span>
                                    </div>
                                  </div>
                                </div>
                                {maquinas.length > 1 && <div className="md:col-span-2 grid grid-cols-1 sm:grid-cols-3 gap-3">
                                  {turnosPlanta.map(t => (
                                    <div key={t.campo} className="space-y-2">
                                      <p className="text-[10px] font-black text-slate-500 uppercase tracking-wide">Turno {t.etiqueta}</p>
                                      <select
                                        value={c[t.campo]}
                                        onChange={(e) => setMaquina(m.id, { [t.campo]: e.target.value } as Partial<EmpaqueShiftConfig>)}
                                        className={cn("w-full bg-white font-black text-[11px] rounded px-2 py-1.5 outline-none border border-gray-200", t.color)}
                                      >
                                        {t.opciones.map(o => <option key={o.v} value={o.v}>{o.l}</option>)}
                                      </select>
                                      <div className="flex items-center justify-between gap-2">
                                        <span className="text-[9px] font-bold text-slate-500 uppercase tracking-wide">Operadores</span>
                                        <input
                                          type="number" min={0} value={c[t.op]}
                                          onChange={(e) => setMaquina(m.id, { [t.op]: Number(e.target.value) || 0 } as Partial<EmpaqueShiftConfig>)}
                                          className="w-12 bg-white border border-gray-200 rounded px-1 py-0.5 text-[10px] font-bold text-slate-700 outline-none text-right"
                                        />
                                      </div>
                                    </div>
                                  ))}
                                </div>}
                              </div>
                            </div>
                          );
                        })}
                      </div>

                      {/* Agregado del grupo (renderProcesoConfig de Corte Espuma): Capacidad Total y % Ocupación. */}
                      <div className="flex justify-center p-3 border-t-2 bg-teal-50/30 border-teal-200">
                        <div className="w-full max-w-sm space-y-1.5">
                          <div className="flex items-center justify-between gap-2">
                            <span className="text-[10px] font-black uppercase tracking-widest text-teal-700">Capacidad Total Empaque ({activas.length})</span>
                            <div className="flex items-baseline gap-1">
                              <span className="text-base font-black text-blue-700 tracking-tighter">{r.capacidadHoras.toFixed(1)}h</span>
                              {turnosSinHorario.length > 0 && (
                                <span className="inline-flex cursor-help shrink-0" title={`Turnos sin horario: ${turnosSinHorario.join(', ')}. Sus horas no entran en la capacidad.`}>
                                  <AlertCircle className="w-3.5 h-3.5 text-amber-600" />
                                </span>
                              )}
                              {mttoCentro > 0 && (
                                <span className="inline-flex cursor-help shrink-0" title={`Mantenimiento en la ventana del plan: −${mttoCentro.toFixed(2)}h, ya descontado de esta capacidad.`}>
                                  <Wrench className="w-3.5 h-3.5 text-indigo-600" />
                                </span>
                              )}
                            </div>
                          </div>
                          <div className="flex items-center justify-between gap-2" title="Espumas (FERT/PT) + Rollos — mismo dato que sale en el correo.">
                            <span className="text-[10px] font-black text-slate-600 uppercase tracking-widest">Horas Necesarias</span>
                            <span className="text-sm font-black text-slate-800 tabular-nums">{r.totalHoras.toFixed(2)}h</span>
                          </div>
                          <div className="flex items-center justify-between gap-2">
                            <span className="text-[10px] font-black text-slate-600 uppercase tracking-widest">% Ocupación</span>
                            <span
                              className={cn("text-base font-black tracking-tighter", sobreCapacidad ? "text-red-600" : "text-emerald-700")}
                              title={`${r.totalHoras.toFixed(1)}h de ${r.capacidadHoras.toFixed(1)}h de capacidad`}
                            >
                              {r.ocupacionPct !== null ? `${r.ocupacionPct.toFixed(0)}%` : '—'}
                            </span>
                          </div>
                        </div>
                      </div>
                    </>
                  )}
                </div>
                {renderCargaCentro(centro)}
                </div>
              );
            })}
          </div>

        </TabsContent>

        <TabsContent value="ordenes" className="space-y-8 animate-in fade-in duration-300">
          {/* El selector "Fecha" ahora filtra específicamente este tab (ver filterData/provC1000) —
              antes solo era visible en "Resumen Necesidades", así que aquí no había forma de ver ni
              cambiar qué fechas estaban acotando la tabla. Mismo patrón que el header de Resumen. */}
          <div className="flex justify-between items-center bg-gray-50/50 p-4 rounded-2xl border border-gray-100">
            <div className="flex items-center gap-4 text-left flex-1 min-w-0">
              <div className="p-2 bg-primary/10 rounded-xl"><CalendarIcon className="w-5 h-5 text-primary" /></div>
              <div className="min-w-0">
                <p className="text-[10px] font-bold uppercase text-gray-500 tracking-wider">Filtro de Provisionales</p>
                <h3 className="text-sm font-black text-gray-700 uppercase">
                  {selectedDates.length === 0
                    ? 'TODAS LAS FECHAS'
                    : selectedDates.length === 1
                      ? format(parseISO(selectedDates[0]), 'EEEE, d MMMM yyyy', { locale: es })
                      : `${selectedDates.length} FECHAS SELECCIONADAS`}
                </h3>
                {selectedDates.length > 1 && (
                  <div className="flex flex-wrap gap-1 mt-1.5">
                    {[...selectedDates].sort().map(d => (
                      <Badge key={d} variant="outline" className="text-[10px] font-mono gap-1 pr-1 border-primary/20 text-primary bg-primary/5">
                        {format(parseISO(d), 'd MMM', { locale: es })}
                        <button onClick={() => toggleSelectedDate(d)} className="hover:bg-primary/10 rounded-full p-0.5"><X className="w-2.5 h-2.5" /></button>
                      </Badge>
                    ))}
                  </div>
                )}
              </div>
            </div>
            {fechaPopover}
          </div>

          {[
            { t: 'Quito 1000 - Órdenes Provisionales', d: provC1000, b: 'bg-green-600', c: 'text-green-700', lookup: tiempoLookup1000 },
            { t: 'Guayaquil 2000 - Órdenes Provisionales', d: provC2000, b: 'bg-indigo-600', c: 'text-indigo-700', lookup: tiempoLookup2000 }
          ].map((center, idx) => (
            <div key={idx} className="space-y-4">
              <h3 className={cn("text-[11px] font-bold uppercase flex items-center gap-2 px-1", center.c)}>
                <div className={cn("w-2 h-2 rounded-full", center.b)} /> {center.t} ({center.d.length} registros)
              </h3>
              <Card className="rounded-2xl border border-gray-100 shadow-sm overflow-hidden bg-white">
                <div className="overflow-x-auto max-h-[450px]">
                  <table className="w-full border-collapse text-center">
                    <thead className="bg-gray-50 sticky top-0 z-10 text-[10px] font-bold uppercase text-gray-500 border-b border-gray-100">
                      <tr>
                        <th className="px-3 py-4 border-r border-gray-100">Orden</th>
                        {/* Pedido/Posición/Cod.Buscar — mismas columnas que ya tiene la tabla de Órdenes FERT
                            (ver TabsContent "ordenesFert" más abajo), agregadas acá para poder cruzar
                            Provisionales contra "Pendientes" por el mismo codBuscar (POSICION+PEDIDO+MATERIAL).
                            Si la orden provisional no trae POSICION/PEDIDO en la API, se verá "—" en toda la
                            columna — eso confirma que el dato no existe ahí y hay que buscarlo en otro lado. */}
                        <th className="px-3 py-4 border-r border-gray-100">Pedido</th>
                        <th className="px-3 py-4 border-r border-gray-100">Posición</th>
                        <th className="px-3 py-4 border-r border-gray-100">Fecha</th>
                        <th className="px-3 py-4 border-r border-gray-100">Material</th>
                        <th className="px-3 py-4 border-r border-gray-100 text-left">Descripción</th>
                        <th className="px-3 py-4 border-r border-gray-100 bg-blue-50/20 text-blue-900">Categoría</th>
                        <th className="px-2 py-4 border-r border-gray-100">DENS.</th>
                        <th className="px-2 py-4 border-r border-gray-100">ANCHO</th>
                        <th className="px-2 py-4 border-r border-gray-100">LARGO</th>
                        <th className="px-2 py-4 border-r border-gray-100">ESP.</th>
                        <th className="px-3 py-4 border-r border-gray-100">Cant.</th>
                        <th className="px-3 py-4 border-r border-gray-100 text-teal-700 bg-teal-50/20 font-black">T. Estándar (Min)</th>
                        <th className="px-3 py-4 border-r border-gray-100 text-amber-700 bg-amber-50/20 font-black">T. Empaque (H)</th>
                        <th className="px-3 py-4 border-r border-gray-100 font-bold">Máquina</th>
                        <th className="px-3 py-4 border-r border-gray-100">ALM.</th>
                        {/* Visible para poder auditar en la propia tabla que el filtro de restricción
                            (filterData, RESPCTRLPROD 018/045) realmente está acotando — antes no se podía
                            verificar esto sin cruzar contra un export aparte de SAP. */}
                        <th className="px-3 py-4 border-r border-gray-100 bg-slate-50 text-slate-700 font-black">Resp.</th>
                        {/* ClaseOrden traducida a MTO (KD, con cliente) / MTS (LA, sin cliente) — confirmado
                            con datos reales. Solo informativo, no filtra filas de la lista. */}
                        <th className="px-3 py-4 border-r border-gray-100 bg-purple-50/20 text-purple-900 font-black">Tipo (MTO/MTS)</th>
                        <th className="px-3 py-4 font-mono text-gray-500">Cod.Buscar</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-50 text-[10px]">
                      {center.d.map((o, i) => {
                        const info = extractMaterialInfo(o);
                        const qty = Number(o.CANTPROGRAMADA || o.CANTIDAD || 0);
                        const maquina = String(o.MAQUINA || o.Maquina || o.RECURSO || '—');
                        const tiempoEstandar = matchTiempoEstandar(info.code, maquina, center.lookup);
                        // Mismo tiempo que el resto del módulo (PR2 → KPIMaestroCarruseles → 15 s/und).
                        const empaqueHours = tiempoEstandar !== null ? (qty * tiempoEstandar) / 60 : (qty * PACKING_TIME_PER_UNIT_SECONDS) / 3600;
                        // Confirmado con datos reales (export de OrdenesProvisionalesPaginados): el campo NO
                        // se llama PEDIDO/POSICION como en FERT — se llama PEDIDOVENTAS/POSICIONPEDIDO. Por
                        // eso salían vacíos antes. buildCodBuscar trata ausentes como 0 (parseQty), no como
                        // vacío — sin esta guarda, una orden sin pedido mostraba igual un Cod.Buscar "armado"
                        // con ceros, que parece un código real pero no lo es.
                        // "000000" es el placeholder de las órdenes LA (sin cliente) — es un string no
                        // vacío (truthy en JS), así que hay que descartarlo explícitamente además de
                        // vacío/undefined; si no, seguía calculando un Cod.Buscar falso con ceros.
                        const esValorAusente = (v: unknown) => !v || /^0+$/.test(String(v).trim());
                        const tienePedidoOPosicion = !esValorAusente(o.POSICIONPEDIDO) || !esValorAusente(o.PEDIDOVENTAS);
                        const codBuscar = tienePedidoOPosicion ? buildCodBuscar(o.POSICIONPEDIDO, o.PEDIDOVENTAS, o.MATERIAL) : '—';
                        // El filtro "Fecha" ahora compara contra FECHAFIN cuando existe (ver filterData) —
                        // se muestra esa como fecha principal, con FECHAINICIO como referencia secundaria,
                        // para que la tabla coincida con lo que realmente se está filtrando.
                        const fechaInicioDisplay = String(o.FECHA || o.FECHAINICIO || '—');
                        const fechaFinDisplay = o.FECHAFIN ? String(o.FECHAFIN) : '';
                        const claseOrden = clasificarClaseOrden(o.ClaseOrden);

                        return (
                          <tr key={i} className="hover:bg-gray-50/50 transition-colors">
                            <td className="px-3 py-2 font-medium text-gray-900 border-r border-gray-100">{String(o.ORDENPREVISIONAL || o.ORDEN || '—')}</td>
                            <td className="px-3 py-2 font-mono text-gray-700 border-r border-gray-100">{String(o.PEDIDOVENTAS || '—')}</td>
                            <td className="px-3 py-2 font-mono text-gray-700 border-r border-gray-100">{String(o.POSICIONPEDIDO || '—')}</td>
                            <td className="px-3 py-2 border-r border-gray-100 font-mono text-[10px]">
                              {fechaFinDisplay
                                ? <span className="text-gray-700 font-bold">{fechaFinDisplay}</span>
                                : <span className="text-gray-500">{fechaInicioDisplay}</span>}
                              {fechaFinDisplay && <span className="block text-gray-400">inicio {fechaInicioDisplay}</span>}
                            </td>
                            <td className="px-3 py-2 font-mono font-bold text-primary border-r border-gray-100 tracking-tighter">{info.code}</td>
                            <td className="px-3 py-2 text-left border-r border-gray-50 truncate max-w-[180px] text-gray-500 uppercase">{info.desc}</td>
                            <td className="px-3 py-2 text-blue-800 border-r border-gray-100 bg-blue-50/5 uppercase font-bold">{String(o.CATEGORIA || '—')}</td>
                            <td className="px-2 py-2 font-mono border-r border-gray-50">{info.dens}</td>
                            <td className="px-2 py-2 font-mono border-r border-gray-50">{info.ancho}</td>
                            <td className="px-2 py-2 font-mono border-r border-gray-50">{info.largo}</td>
                            <td className="px-2 py-2 font-mono border-r border-gray-50">{info.esp}</td>
                            <td className="px-3 py-2 font-bold text-gray-900 border-r border-gray-100 font-mono">{qty}</td>
                            <td className="px-3 py-2 font-mono font-bold text-teal-600 border-r border-gray-100 bg-teal-50/10">{tiempoEstandar !== null ? tiempoEstandar.toFixed(4) : '—'}</td>
                            <td className="px-3 py-2 font-mono font-bold text-amber-600 border-r border-gray-100 bg-amber-50/10">{empaqueHours.toFixed(2)}</td>
                            <td className="px-3 py-2 font-bold text-gray-700 border-r border-gray-100 uppercase">{maquina}</td>
                            <td className="px-3 py-2 font-medium text-gray-500 border-r border-gray-100">{String(o.Almacen || o.ALMACEN || '—')}</td>
                            <td className="px-3 py-2 font-mono font-bold text-slate-700 bg-slate-50/50 border-r border-gray-100">{String(o.RESPCTRLPROD || o.RESPCONTROLPROD || o.RespCtrlProd || o.RespControlProd || '—')}</td>
                            <td className="px-3 py-2 font-mono font-bold text-purple-700 bg-purple-50/10 border-r border-gray-100">{claseOrden}</td>
                            <td className="px-3 py-2 font-mono text-gray-500">{codBuscar}</td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </Card>
            </div>
          ))}
        </TabsContent>

        <TabsContent value="ordenesFert" className="space-y-8 animate-in fade-in duration-300">
          <p className="text-[10px] text-gray-500 font-bold uppercase tracking-widest -mt-2">
            Vista de referencia — no depende del filtro &quot;Fecha&quot; (ese selector ahora solo filtra el tab Provisionales). Muestra todas las Órdenes FERT con las restricciones de Venta Externa aplicadas.
          </p>
          {[
            { t: 'Quito 1000 - Órdenes FERT', d: fertC1000SinFecha, b: 'bg-green-600', c: 'text-green-700', lookup: tiempoLookup1000 },
            { t: 'Guayaquil 2000 - Órdenes FERT', d: fertC2000SinFecha, b: 'bg-indigo-600', c: 'text-indigo-700', lookup: tiempoLookup2000 }
          ].map((center, idx) => (
            <div key={idx} className="space-y-4">
              <h3 className={cn("text-[11px] font-bold uppercase flex items-center gap-2 px-1", center.c)}>
                <div className={cn("w-2 h-2 rounded-full", center.b)} /> {center.t} ({center.d.length} registros)
              </h3>
              <Card className="rounded-2xl border border-gray-100 shadow-sm overflow-hidden bg-white">
                <div className="overflow-x-auto max-h-[450px]">
                  <table className="w-full border-collapse text-center font-sans">
                    <thead className="bg-gray-50 sticky top-0 z-10 text-[10px] font-bold uppercase text-gray-500 border-b border-gray-100">
                      <tr>
                        <th className="px-3 py-4 border-r border-gray-100">Orden</th>
                        <th className="px-3 py-4 border-r border-gray-100">Pedido</th>
                        <th className="px-3 py-4 border-r border-gray-100">Posición</th>
                        <th className="px-3 py-4 border-r border-gray-100">Fecha</th>
                        <th className="px-3 py-4 border-r border-gray-100">Material</th>
                        <th className="px-3 py-4 border-r border-gray-100 text-left">Descripción</th>
                        <th className="px-3 py-4 border-r border-gray-100 bg-blue-50/20 text-blue-900 font-black">Categoría</th>
                        <th className="px-2 py-4 border-r border-gray-100">DENS.</th>
                        <th className="px-2 py-4 border-r border-gray-100">ANCHO</th>
                        <th className="px-2 py-4 border-r border-gray-100">LARGO</th>
                        <th className="px-2 py-4 border-r border-gray-100">ESP.</th>
                        <th className="px-3 py-4 border-r border-gray-100">Cant.</th>
                        <th className="px-3 py-4 border-r border-gray-100 text-teal-700 bg-teal-50/20 font-black">T. Estándar (Min)</th>
                        <th className="px-3 py-4 border-r border-gray-100 text-amber-700 bg-amber-50/20 font-black">T. Empaque (H)</th>
                        <th className="px-3 py-4 border-r border-gray-100 font-bold">Máquina</th>
                        <th className="px-3 py-4 border-r border-gray-100">ALM.</th>
                        <th className="px-3 py-4 font-mono text-gray-500">Cod.Buscar</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-50 text-[10px]">
                      {center.d.map((o, i) => {
                        const info = extractMaterialInfo(o);
                        const qty = Number(o.CANTPROGRAMADA || o.CANTIDAD || 0);
                        const maquina = String(o.MAQUINA || o.RECURSO || '—');
                        const tiempoEstandar = matchTiempoEstandar(info.code, maquina, center.lookup);
                        // Mismo tiempo que el resto del módulo (PR2 → KPIMaestroCarruseles → 15 s/und).
                        const empaqueHours = tiempoEstandar !== null ? (qty * tiempoEstandar) / 60 : (qty * PACKING_TIME_PER_UNIT_SECONDS) / 3600;
                        const codBuscar = buildCodBuscar(o.POSICION, o.PEDIDO, o.MATERIAL);

                        return (
                          <tr key={i} className="hover:bg-gray-50/50 transition-colors">
                            <td className="px-3 py-2 font-medium text-gray-900 border-r border-gray-100">{String(o.ORDEN || '—')}</td>
                            <td className="px-3 py-2 font-mono text-gray-700 border-r border-gray-100">{String(o.PEDIDO || '—')}</td>
                            <td className="px-3 py-2 font-mono text-gray-700 border-r border-gray-100">{String(o.POSICION || '—')}</td>
                            <td className="px-3 py-2 border-r border-gray-100 font-mono text-[10px] text-gray-500">{String(o.FECHA || '—')}</td>
                            <td className="px-3 py-2 font-mono font-bold text-primary border-r border-gray-100 tracking-tighter">{info.code}</td>
                            <td className="px-3 py-2 text-left border-r border-gray-50 truncate max-w-[180px] text-gray-500 uppercase">{info.desc}</td>
                            <td className="px-3 py-2 text-blue-800 border-r border-gray-100 bg-blue-50/5 uppercase font-black">{String(o.CATEGORIA || '—')}</td>
                            <td className="px-2 py-2 font-mono border-r border-gray-50">{info.dens}</td>
                            <td className="px-2 py-2 font-mono border-r border-gray-50">{info.ancho}</td>
                            <td className="px-2 py-2 font-mono border-r border-gray-50">{info.largo}</td>
                            <td className="px-2 py-2 font-mono border-r border-gray-50">{info.esp}</td>
                            <td className="px-3 py-2 font-bold text-gray-900 border-r border-gray-100 font-mono">{qty}</td>
                            <td className="px-3 py-2 font-mono font-bold text-teal-600 border-r border-gray-100 bg-teal-50/10">{tiempoEstandar !== null ? tiempoEstandar.toFixed(4) : '—'}</td>
                            <td className="px-3 py-2 font-mono font-bold text-amber-600 border-r border-gray-100 bg-amber-50/10">{empaqueHours.toFixed(2)}</td>
                            <td className="px-3 py-2 font-bold text-gray-700 border-r border-gray-50 uppercase">{maquina}</td>
                            <td className="px-3 py-2 font-medium text-gray-500 border-r border-gray-100">{String(o.ALMACEN || '—')}</td>
                            <td className="px-3 py-2 font-mono text-gray-500">{codBuscar}</td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </Card>
            </div>
          ))}
        </TabsContent>

        <TabsContent value="planP2" className="space-y-6 animate-in fade-in duration-300">
          <div className="flex flex-col gap-4 bg-gray-50/50 p-4 rounded-2xl border border-gray-100">
            <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
              <div className="text-left">
                <p className="text-[10px] font-bold uppercase text-gray-500 tracking-wider">Necesidad Origen (P2)</p>
                <h3 className="text-sm font-black text-gray-700 uppercase">Espumas + Rollos (BOM de Órdenes FERT)</h3>
                <p className="text-[10px] text-gray-500 mt-1">Ambas necesidades se calculan explotando la lista de materiales de las Órdenes FERT (Provisionales queda como tab de referencia, ya no alimenta este cálculo): componentes &quot;ESPUMA&quot; → Corte Espuma, &quot;LAMINA CILINDRICA&quot; → Corte y Laminado.</p>
                {/* Fechas del P2 (regla del usuario 2026-10-02): ya no se eligen — PT = hoy+2 hábiles,
                    recuperación de Corte/Laminado = hoy+1. Debajo, los materiales diferidos desde
                    Corte Espuma (ver materialesDiferidos / guardarP2Diferido). */}
                {(() => {
                  const pt = fechasHorizonte.pt;
                  const ptDiferido = format(addBusinessDaysCal(parseISO(pt), 1, diasNoLaborables, laborablesHorizonte(diasLaborablesExtra)), 'yyyy-MM-dd');
                  const corta = (f: string) => format(parseISO(f), 'EEE d MMM', { locale: es });
                  const hayDiferidos = materialesDiferidos['1000'].length + materialesDiferidos['2000'].length > 0;
                  return (
                    <>
                      <div className="flex items-center gap-1.5 mt-2 flex-wrap">
                        <Badge className="bg-primary/10 text-primary border-primary/20 text-[10px] font-black uppercase gap-1.5">
                          <CalendarIcon className="w-3 h-3" /> Planificado {corta(format(new Date(), 'yyyy-MM-dd'))} · Recuperación {corta(fechasHorizonte.recuperacion)} · PT {corta(pt)}
                        </Badge>
                        <span className="text-[10px] text-gray-500 font-bold uppercase">Horizonte 2 días hábiles · FERT del día PT</span>
                      </div>
                      {hayDiferidos && (
                        <div className="mt-2 rounded-xl border border-amber-200 bg-amber-50/60 px-3 py-2 space-y-1.5">
                          <p className="text-[10px] font-black uppercase tracking-wider text-amber-800">
                            Diferidos desde Corte Espuma → P2 DIFERIDO · Recuperación {corta(pt)} · PT {corta(ptDiferido)}
                          </p>
                          {(['1000', '2000'] as const).filter(c => materialesDiferidos[c].length > 0).map(c => {
                            const necesidad = c === '1000' ? necesidadEspumas1000 : necesidadEspumas2000;
                            return (
                              <div key={c} className="flex items-center gap-1.5 flex-wrap">
                                <span className="text-[10px] font-black text-amber-700">C{c}:</span>
                                {materialesDiferidos[c].map(m => {
                                  const fila = necesidad.find(l => String(Number(l.material)) === m);
                                  return (
                                    <span
                                      key={m}
                                      title={fila ? `${fila.descripcion} — ${Math.round(fila.cantidad)} en la necesidad de hoy` : 'Sin necesidad calculada hoy para este material'}
                                      className={cn("inline-flex items-center gap-1 rounded-full border bg-white px-2 py-0.5 text-[10px] font-mono font-bold", fila ? "border-amber-300 text-amber-800" : "border-gray-200 text-gray-500")}
                                    >
                                      {m}{fila ? ` · ${Math.round(fila.cantidad)}` : ''}
                                      <button type="button" onClick={() => quitarDiferido(c, m)} className="hover:text-red-600" aria-label={`Quitar ${m} de diferidos`}>
                                        <X className="w-3 h-3" />
                                      </button>
                                    </span>
                                  );
                                })}
                              </div>
                            );
                          })}
                          <p className="text-[10px] text-amber-700/80">Al generar el P2 de Espumas estos materiales salen del plan de hoy y se graban en el P2 DIFERIDO; Corte Espuma los recupera el día siguiente.</p>
                        </div>
                      )}
                    </>
                  );
                })()}
              </div>
              <div className="flex items-center gap-2 shrink-0">
                {/* Familia "Generar Necesidades": trae/calcula datos (sync o explosión BOM) sin
                    escribir nada — outline, tono índigo. "Generar Respuestas" (escribe Plan Grupo/
                    Detalle Táctico real) es sólido/primario. Mismos 2 niveles en los 4 módulos tácticos. */}
                <Button onClick={() => handleCalcularNecesidadRollos()} disabled={isExplodingBom || selectedDates.length === 0} variant="outline" className="h-10 px-6 rounded-2xl gap-2 font-bold text-xs uppercase border-indigo-200 text-indigo-700 hover:bg-indigo-50">
                  {isExplodingBom ? <Loader2 className="w-4 h-4 animate-spin" /> : <Wand2 className="w-4 h-4" />}
                  {isExplodingBom ? `Explotando BOM ${bomProgress.current}/${bomProgress.total}` : 'Generar Necesidades · BOM FERT'}
                </Button>
                <Button
                  onClick={() => { void handleGenerarP2ConPanel(); }}
                  disabled={isSavingAllPlanP2 || isExplodingBom || (necesidadEspumas1000.length === 0 && necesidadEspumas2000.length === 0 && necesidadRollos1000.length === 0)}
                  className="h-10 px-6 rounded-2xl gap-2 font-bold text-xs uppercase bg-slate-900 hover:bg-slate-800 text-white"
                >
                  {isSavingAllPlanP2 ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                  Generar Respuestas · Todos P2
                </Button>
              </div>
            </div>
            {isExplodingBom && (
              <div className="space-y-1.5">
                <Progress value={bomProgress.total > 0 ? (bomProgress.current / bomProgress.total) * 100 : 0} className="h-2" />
                <p className="text-[10px] font-bold uppercase text-gray-500 tracking-widest text-right">{bomProgress.current} / {bomProgress.total} materiales explotados</p>
              </div>
            )}
            {!isExplodingBom && (bomDiagnostico.sinMatch.length > 0 || bomDiagnostico.conError.length > 0) && (
              <div className="space-y-1.5 bg-amber-50/60 border border-amber-200 rounded-xl px-3 py-2">
                {bomDiagnostico.sinMatch.length > 0 && (
                  <p className="text-[10px] text-amber-800">
                    <span className="font-black uppercase tracking-wider">{bomDiagnostico.sinMatch.length} FERT sin Espuma/Rollo en su BOM</span> — se consultó su explosión de materiales pero ninguna fila (de cualquier nivel) coincidió con &quot;ESPUMA&quot;/&quot;LAMINA CILINDRICA&quot;: <span className="font-mono">{bomDiagnostico.sinMatch.join(', ')}</span>
                  </p>
                )}
                {bomDiagnostico.conError.length > 0 && (
                  <p className="text-[10px] text-red-700">
                    <span className="font-black uppercase tracking-wider">{bomDiagnostico.conError.length} FERT con error al consultar el BOM</span> — revisa la consola del navegador para el detalle: <span className="font-mono">{bomDiagnostico.conError.join(', ')}</span>
                  </p>
                )}
              </div>
            )}
          </div>

          {[
            { t: 'Centro 1000 - Quito', centro: '1000' as const, c: 'text-green-700', b: 'bg-green-600' },
            { t: 'Centro 2000 - Guayaquil', centro: '2000' as const, c: 'text-indigo-700', b: 'bg-indigo-600' }
          ].map((center) => (
            <div key={center.centro} className="space-y-4">
              <h3 className={cn("text-[11px] font-black uppercase flex items-center gap-2 tracking-widest px-1", center.c)}>
                <div className={cn("w-2.5 h-2.5 rounded-full", center.b)} /> {center.t}
              </h3>

              <div className={cn("grid grid-cols-1 gap-4", center.centro === '1000' && "lg:grid-cols-2")}>
                {[
                  { tipo: 'ESPUMAS' as const, label: 'Necesidad Espumas Venta Externa', rows: center.centro === '1000' ? necesidadEspumas1000 : necesidadEspumas2000, accent: 'text-teal-600', bg: 'bg-teal-50/30' },
                  // Rollos (Corte y Laminado) solo existe en Centro 1000 — no hay actividad/pedidos
                  // de ese material en Centro 2000, por eso se suprime ese espacio.
                  ...(center.centro === '1000' ? [{ tipo: 'ROLLOS' as const, label: 'Necesidad Rollos Venta Externa', rows: necesidadRollos1000, accent: 'text-amber-600', bg: 'bg-amber-50/30' }] : [])
                ].map((block, bIdx) => {
                  const key = `${center.centro}-${block.tipo}`;
                  return (
                    <Card key={bIdx} className="rounded-2xl border border-gray-100 shadow-sm overflow-hidden bg-white flex flex-col">
                      <div className={cn("px-4 py-2.5 flex items-center justify-between gap-2 border-b border-gray-100", block.bg)}>
                        <span className="text-[10px] font-black uppercase tracking-widest text-gray-500">{block.label} ({block.rows.length})</span>
                        <div className="flex items-center gap-2 shrink-0">
                          {planP2Generado[key] && (
                            <Badge className="bg-emerald-50 text-emerald-700 border-emerald-200 text-[9px] font-bold uppercase">Plan #{planP2Generado[key]}</Badge>
                          )}
                          <Button
                            size="sm"
                            onClick={() => handleGenerarPlanP2(center.centro, block.tipo)}
                            disabled={block.rows.length === 0 || !!savingPlanP2[key]}
                            className="h-7 px-3 rounded-lg gap-1.5 font-bold text-[10px] uppercase bg-slate-900 hover:bg-slate-800 text-white"
                          >
                            {savingPlanP2[key] ? <Loader2 className="w-3 h-3 animate-spin" /> : <Save className="w-3 h-3" />}
                            Generar Respuestas · P2
                          </Button>
                        </div>
                      </div>
                      <div className="overflow-x-auto max-h-[350px]">
                        <table className="w-full border-collapse text-center">
                          <thead className="bg-gray-50 sticky top-0 text-[10px] font-bold uppercase text-gray-500">
                            <tr>
                              <th className="px-3 py-3 border-r border-gray-100">Material</th>
                              <th className="px-3 py-3 border-r border-gray-100 text-left">Descripción</th>
                              <th className="px-3 py-3">Cantidad</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-gray-50 text-[10px]">
                            {block.rows.length === 0 ? (
                              <tr><td colSpan={3} className="py-10 text-center text-gray-400 font-bold uppercase tracking-widest">Sin datos</td></tr>
                            ) : (
                              block.rows.map((row, i) => (
                                <tr key={i} className="hover:bg-gray-50/50">
                                  <td className="px-3 py-2 font-mono font-bold text-primary border-r border-gray-50">{row.material}</td>
                                  <td className="px-3 py-2 text-left border-r border-gray-50 text-gray-500 uppercase truncate max-w-[220px]">{row.descripcion}</td>
                                  <td className={cn("px-3 py-2 font-mono font-black", block.accent)}>{row.cantidad.toLocaleString(undefined, { maximumFractionDigits: 2 })}</td>
                                </tr>
                              ))
                            )}
                          </tbody>
                        </table>
                      </div>
                    </Card>
                  );
                })}
              </div>
            </div>
          ))}
        </TabsContent>

        <TabsContent value="dataAprobada" className="space-y-6 animate-in fade-in duration-300">
          <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 bg-gray-50/50 p-4 rounded-2xl border border-gray-100">
            <div className="text-left">
              <p className="text-[10px] font-bold uppercase text-gray-500 tracking-wider">Recepción de Datos (P3)</p>
              <h3 className="text-sm font-black text-gray-700 uppercase">Respuesta del Plan Consumidor</h3>
              <p className="text-[10px] text-gray-500 mt-1">Por cada material que enviamos en nuestro P2, busca si algún Plan P3 (consumidor real, no PFD) ya respondió — un DetalleTactico cuyo <span className="font-mono">codigo_plan_grupo_padre</span> apunta a nuestro plan. La columna &quot;Fechas&quot; avisa si esa respuesta NO se guardó exactamente un día después de nuestra línea (regla &quot;revisión hoy, devolución mañana&quot;).</p>
            </div>
            <div className="flex items-center gap-2 shrink-0">
              {/* De cuándo es lo que se ve (2026-10-12): antes podía quedar Data Aprobada de un reporte
                  anterior sin ningún aviso. */}
              <span className={cn("text-[10px] font-bold text-right max-w-[280px]", dataAprobadaFetchedAt ? "text-emerald-700" : "text-amber-700")}>
                {dataAprobadaFetchedAt
                  ? `Respuestas${estadoDia.hitos?.find(h => h.id === 've-p2')?.detalle ? ` al P2 ${estadoDia.hitos.find(h => h.id === 've-p2')!.detalle}` : ''} · consultadas ${dataAprobadaFetchedAt.toLocaleTimeString('es-EC', { hour: '2-digit', minute: '2-digit' })}`
                  : planCargadoDe
                    ? `Datos del reporte del ${format(parseISO(planCargadoDe.fechaObjetivo), 'dd/MM')} (no de hoy) — Sincroniza para ver las de hoy`
                    : 'Sin consultar — Sincroniza o pulsa Actualizar'}
              </span>
              <Button onClick={() => { void fetchDataAprobada(); }} disabled={isLoadingDataAprobada} variant="outline" className="h-10 px-6 rounded-2xl gap-2 font-bold text-xs uppercase shrink-0 border-indigo-200 text-indigo-700 hover:bg-indigo-50">
                {isLoadingDataAprobada ? <Loader2 className="w-4 h-4 animate-spin" /> : <RefreshCw className="w-4 h-4" />}
                Actualizar
              </Button>
            </div>
          </div>

          {[
            { key: '1000-ESPUMAS', t: 'Centro 1000 · P2 Espumas', c: 'text-teal-700', b: 'bg-teal-600' },
            { key: '1000-ROLLOS', t: 'Centro 1000 · P2 Rollos', c: 'text-amber-700', b: 'bg-amber-600' },
            { key: '2000-ESPUMAS', t: 'Centro 2000 · P2 Espumas', c: 'text-teal-700', b: 'bg-teal-600' }
          ].map((block) => {
            const rows = dataAprobada[block.key] || [];
            return (
              <div key={block.key} className="space-y-3">
                <h3 className={cn("text-[11px] font-black uppercase flex items-center gap-2 tracking-widest px-1", block.c)}>
                  <div className={cn("w-2.5 h-2.5 rounded-full", block.b)} /> {block.t} ({rows.length})
                </h3>
                <Card className="rounded-2xl border border-gray-100 shadow-sm overflow-hidden bg-white">
                  <div className="overflow-x-auto max-h-[400px]">
                    <table className="w-full border-collapse text-center">
                      <thead className="bg-gray-50 sticky top-0 text-[10px] font-bold uppercase text-gray-500">
                        <tr>
                          <th className="px-3 py-3 border-r border-gray-100">Material</th>
                          <th className="px-3 py-3 border-r border-gray-100 text-left">Descripción</th>
                          <th className="px-3 py-3 border-r border-gray-100">Cantidad</th>
                          <th className="px-3 py-3 border-r border-gray-100">Respuesta Cant.</th>
                          <th className="px-3 py-3 border-r border-gray-100" title="Cubierto con stock / provisional (no viene en el P3)">Stock / Prov.</th>
                          <th className="px-3 py-3 border-r border-gray-100" title="Faltante que el P3 manda a fabricar">A producir (P3)</th>
                          <th className="px-3 py-3 border-r border-gray-100">Plan Grupo</th>
                          <th className="px-3 py-3 border-r border-gray-100">Fechas</th>
                          <th className="px-3 py-3">Estado</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-50 text-[10px]">
                        {rows.length === 0 ? (
                          <tr><td colSpan={9} className="py-10 text-center text-gray-400 font-bold uppercase tracking-widest">Sin plan P2 activo o sin materiales</td></tr>
                        ) : (
                          rows.map((row, i) => {
                            const estado = estadoDataAprobada(row);
                            return (
                              <tr key={i} className="hover:bg-gray-50/50">
                                <td className="px-3 py-2 font-mono font-bold text-primary border-r border-gray-50">{row.material}</td>
                                <td className="px-3 py-2 text-left border-r border-gray-50 text-gray-500 uppercase truncate max-w-[220px]">{row.descripcion}</td>
                                <td className="px-3 py-2 font-mono font-black text-gray-900 border-r border-gray-50">{row.cantidad.toLocaleString()}</td>
                                <td className="px-3 py-2 font-mono font-black text-indigo-700 border-r border-gray-50">{row.respuestaCant.toLocaleString()}</td>
                                <td className="px-3 py-2 font-mono text-emerald-700 border-r border-gray-50">{row.cubiertoStock ? row.cubiertoStock.toLocaleString() : '—'}</td>
                                <td className="px-3 py-2 font-mono text-orange-700 border-r border-gray-50">{row.aProducir ? row.aProducir.toLocaleString() : '—'}</td>
                                <td className="px-3 py-2 font-mono text-gray-500 border-r border-gray-50">{row.planGrupo}</td>
                                <td className="px-3 py-2 border-r border-gray-50">
                                  {row.fechasOk === null ? (
                                    <span className="text-gray-400">—</span>
                                  ) : (
                                    <Badge className={cn(
                                      "text-[9px] font-bold uppercase border",
                                      row.fechasOk ? "bg-emerald-50 text-emerald-700 border-emerald-200" : "bg-red-50 text-red-700 border-red-200"
                                    )}>
                                      {row.fechasOk ? 'Coinciden' : 'Distintas'}
                                    </Badge>
                                  )}
                                </td>
                                <td className="px-3 py-2">
                                  <Badge className={cn(
                                    "text-[9px] font-bold uppercase border",
                                    estado === 'completo' && "bg-emerald-50 text-emerald-700 border-emerald-200",
                                    estado === 'parcial' && "bg-amber-50 text-amber-700 border-amber-200",
                                    estado === 'pendiente' && "bg-gray-50 text-gray-500 border-gray-200"
                                  )}>
                                    {estado}
                                  </Badge>
                                </td>
                              </tr>
                            );
                          })
                        )}
                      </tbody>
                    </table>
                  </div>
                </Card>
              </div>
            );
          })}

          <div className="flex justify-end">
            <Button onClick={() => setActiveTab('pfdVenta')} variant="outline" className="h-9 px-5 rounded-xl gap-2 font-bold text-[10px] uppercase border-indigo-200 text-indigo-700 hover:bg-indigo-50">
              Continuar: 3 · PFD-VENTA <ChevronRight className="w-4 h-4" />
            </Button>
          </div>
        </TabsContent>

        {/* Paso 3 · PFD-VENTA (pestaña propia desde 2026-10-12; antes vivía al pie de Data Aprobada).
            "PFD - VENTA": sube desde el componente YA RESPONDIDO (estado "completo" en Data Aprobada)
            hacia su FERT/PT padre — dirección opuesta a como se explota el BOM para generar la Necesidad
            P2 (ver generarPfdVentaPreview). Solo Espumas: Rollos no tiene Data Aprobada con datos reales hoy. */}
        <TabsContent value="pfdVenta" className="space-y-6 animate-in fade-in duration-300">
          <div className="space-y-6">
            <div className="bg-indigo-50/40 p-4 rounded-2xl border border-indigo-100 text-left flex flex-col md:flex-row md:items-center md:justify-between gap-4">
              <div>
                <p className="text-[10px] font-bold uppercase text-indigo-400 tracking-wider">Paso 3</p>
                <h3 className="text-sm font-black text-gray-700 uppercase">PFD - Venta (FERT/PT listos)</h3>
                <p className="text-[10px] text-gray-500 mt-1">Por cada componente en estado &quot;completo&quot; arriba, sube al FERT/PT que depende de él (mismo BOM de la Necesidad P2, en sentido inverso) y agrupa por categoría — igual que &quot;Resumen Necesidades&quot;, con el tiempo real de plastificado.</p>
              </div>
              <Button
                onClick={handleGenerarYGuardarPfdVenta}
                disabled={isRunningPfdVentaSecuencia || (!centroConDataAprobadaLista('1000') && !centroConDataAprobadaLista('2000'))}
                title="Genera y guarda el plan PFD-VENTA en secuencia: primero Centro 1000, luego Centro 2000 — se omite el centro que no tenga materiales en estado Parcial o Completo en Data Aprobada."
                className="h-11 px-6 rounded-2xl gap-2 font-bold text-[11px] uppercase bg-indigo-600 text-white hover:bg-indigo-700 shrink-0"
              >
                {isRunningPfdVentaSecuencia ? <Loader2 className="w-4 h-4 animate-spin" /> : <ClipboardCheck className="w-4 h-4" />}
                {isRunningPfdVentaSecuencia ? 'Generando y guardando…' : 'Generar y Guardar PFD-VENTA (1000 y 2000)'}
              </Button>
            </div>

            {/* Aviso de Data Aprobada desactualizada — PFD-VENTA lee `dataAprobada` en memoria, no
                vuelve a consultarla por su cuenta (ver dataAprobadaFetchedAt). No bloquea el botón de
                arriba a propósito (pedido explícito del usuario: "un aviso o warning visible", no una
                restricción dura) — solo hace explícito el riesgo de generar contra una respuesta de
                Corte Espuma/Laminado que ya no es la más reciente. */}
            {!dataAprobadaFetchedAt ? (
              <div className="flex items-center gap-2.5 rounded-xl border border-amber-200 bg-amber-50 px-4 py-2.5 text-left">
                <AlertCircle className="w-4 h-4 text-amber-600 shrink-0" />
                <p className="text-[11px] font-bold text-amber-700">
                  Todavía no actualizaste Data Aprobada en esta sesión — el PFD-VENTA podría generarse con una respuesta desactualizada. Abre la pestaña 2 · Data Aprobada (se consulta sola) antes de continuar.
                </p>
              </div>
            ) : (
              <p className="text-[10px] text-gray-500 px-1">
                Data Aprobada actualizada por última vez hoy a las {dataAprobadaFetchedAt.toLocaleTimeString('es-EC', { hour: '2-digit', minute: '2-digit' })}.
              </p>
            )}

            {(['1000', '2000'] as const).map(centro => {
              const preview = pfdVentaPreview[centro];
              const keySave = `PFD-${centro}`;
              return (
                <div key={centro} className="space-y-3">
                  <div className="flex items-center justify-between px-1">
                    <h3 className="text-[11px] font-black uppercase flex items-center gap-2 tracking-widest text-indigo-700">
                      <div className="w-2.5 h-2.5 rounded-full bg-indigo-600" /> PFD-VENTA · Centro {centro}
                      {pfdVentaGenerado[keySave] && (
                        <Badge className="bg-emerald-50 text-emerald-700 border-emerald-200 text-[9px] font-bold uppercase">Plan #{pfdVentaGenerado[keySave]}</Badge>
                      )}
                      {savingPfdVenta[keySave] && (
                        <Badge className="bg-indigo-50 text-indigo-700 border-indigo-200 text-[9px] font-bold uppercase gap-1"><Loader2 className="w-2.5 h-2.5 animate-spin" /> Guardando plan…</Badge>
                      )}
                      {!preview && !isGeneratingPfdVenta[centro] && !centroConDataAprobadaLista(centro) && (
                        <Badge className="bg-gray-50 text-gray-500 border-gray-200 text-[9px] font-bold uppercase">Sin data aprobada (Parcial/Completo)</Badge>
                      )}
                    </h3>
                  </div>

                  {isGeneratingPfdVenta[centro] && (
                    <div className="flex items-center gap-3 rounded-xl border border-indigo-100 bg-indigo-50/40 px-4 py-2.5">
                      <div className="flex-1 h-1.5 bg-indigo-100 rounded-full overflow-hidden">
                        <div
                          className="h-full bg-indigo-600 transition-all duration-300 ease-out"
                          style={{ width: `${(pfdVentaBomProgress[centro]?.total ?? 0) > 0 ? ((pfdVentaBomProgress[centro]?.current ?? 0) / (pfdVentaBomProgress[centro]!.total)) * 100 : 0}%` }}
                        />
                      </div>
                      <span className="text-[10px] font-black uppercase tracking-widest text-indigo-700 shrink-0">
                        Explotando BOM {pfdVentaBomProgress[centro]?.current ?? 0} / {pfdVentaBomProgress[centro]?.total ?? 0} materiales
                      </span>
                    </div>
                  )}

                  {!preview ? (
                    <Card className="rounded-2xl border border-dashed border-gray-200 py-10 text-center text-gray-400 font-bold uppercase tracking-widest text-xs">
                      {isGeneratingPfdVenta[centro] ? 'Explotando BOM...' : <>Pulsa &quot;Generar y Guardar PFD-VENTA&quot; arriba para generar y guardar este centro.</>}
                    </Card>
                  ) : (
                    <>
                      <Card className="rounded-2xl border border-gray-100 shadow-sm overflow-hidden bg-white">
                        {preview.lineas.length === 0 ? (
                          <div className="py-16 text-center text-gray-500 font-bold uppercase tracking-widest opacity-30">Ningún FERT/PT cubierto todavía</div>
                        ) : (
                          <div className="overflow-x-auto max-h-[500px] overflow-y-auto">
                            <table className="w-full border-collapse text-center font-sans">
                              <thead className="bg-gray-50 sticky top-0 text-[10px] font-black uppercase text-gray-500 border-b border-gray-100">
                                <tr>
                                  <th className="px-4 py-3 border-r border-gray-100 text-left">Material</th>
                                  <th className="px-4 py-3 border-r border-gray-100 text-left">Descripción</th>
                                  <th className="px-4 py-3 border-r border-gray-100 text-left">Categoría</th>
                                  <th className="px-4 py-3 border-r border-gray-100 font-black bg-indigo-50/30 text-indigo-700">Unidades (se graba)</th>
                                  <th className="px-4 py-3 text-amber-700 bg-amber-50/30">Tiempo Planchas (H)</th>
                                </tr>
                              </thead>
                              <tbody className="divide-y divide-gray-50 text-[11px]">
                                {preview.lineas.map((linea, i) => (
                                  <tr key={i} className="hover:bg-gray-50/50 transition-colors">
                                    <td className="px-4 py-2 font-mono font-bold text-indigo-600 border-r border-gray-50 text-left">{linea.material}</td>
                                    <td className="px-4 py-2 text-left font-sans normal-case text-gray-600 border-r border-gray-50 truncate max-w-[220px]">{linea.descripcion}</td>
                                    <td className="px-4 py-2 text-left font-mono text-gray-500 border-r border-gray-50">{linea.categoria}</td>
                                    <td className="px-4 py-2 font-mono font-black text-indigo-700 bg-indigo-50/10 border-r border-gray-50">{linea.cantidad.toLocaleString()}</td>
                                    <td className="px-4 py-2 font-mono font-black text-amber-600 bg-amber-50/5">{linea.tiempoHoras.toFixed(2)}</td>
                                  </tr>
                                ))}
                              </tbody>
                            </table>
                          </div>
                        )}
                      </Card>

                      {preview.sinTrazabilidad.length > 0 && (
                        <Card className="rounded-2xl border border-dashed border-amber-200 bg-amber-50/30 p-4">
                          <p className="text-[10px] font-black uppercase text-amber-700 tracking-widest mb-2">Sin trazabilidad ({preview.sinTrazabilidad.length})</p>
                          <p className="text-[10px] text-amber-600/80 mb-3">Estos componentes ya están &quot;completo&quot; pero no se encontró su FERT/PT padre en la Necesidad P2 (BOM sin match, o el componente ya no pertenece al P2 activo) — no cuentan como cubiertos, revísalos aparte.</p>
                          <div className="space-y-1">
                            {preview.sinTrazabilidad.map(r => (
                              <div key={r.material} className="flex items-center justify-between text-[10px] font-mono text-amber-700 bg-white/60 rounded-lg px-3 py-1.5">
                                <span>{r.material} — {r.descripcion}</span>
                                <span>{r.cantidad.toLocaleString()}</span>
                              </div>
                            ))}
                          </div>
                        </Card>
                      )}
                    </>
                  )}
                </div>
              );
            })}
          </div>
          <div className="flex justify-end">
            <Button onClick={() => setActiveTab('resumen')} variant="outline" className="h-9 px-5 rounded-xl gap-2 font-bold text-[10px] uppercase border-indigo-200 text-indigo-700 hover:bg-indigo-50">
              Continuar: 4 · Resumen y reporte <ChevronRight className="w-4 h-4" />
            </Button>
          </div>
        </TabsContent>

        <TabsContent value="pendientes" className="space-y-6 animate-in fade-in duration-300">
          <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 bg-gray-50/50 p-4 rounded-2xl border border-gray-100">
            <div className="text-left">
              <p className="text-[10px] font-bold uppercase text-gray-500 tracking-wider">Pedidos sin entregar</p>
              <h3 className="text-sm font-black text-gray-700 uppercase">Pendientes Totales</h3>
            </div>
            <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
              <div className="relative">
                <Search className="w-3.5 h-3.5 text-gray-500 absolute left-3 top-1/2 -translate-y-1/2" />
                <Input
                  value={pendientesSearch}
                  onChange={(e) => setPendientesSearch(e.target.value)}
                  placeholder="Buscar Pedido, Material o Descripción..."
                  className="h-10 pl-9 rounded-2xl border-gray-200 text-xs w-full sm:w-72"
                />
              </div>
              <div className="flex items-center gap-2">
                <Input
                  type="date"
                  value={pendientesFechaDesde}
                  onChange={(e) => setPendientesFechaDesde(e.target.value)}
                  className="h-10 rounded-2xl border-gray-200 text-xs"
                />
                <span className="text-[10px] font-bold text-gray-500 uppercase">a</span>
                <Input
                  type="date"
                  value={pendientesFechaHasta}
                  onChange={(e) => setPendientesFechaHasta(e.target.value)}
                  className="h-10 rounded-2xl border-gray-200 text-xs"
                />
              </div>
              <Button
                variant="outline"
                size="sm"
                onClick={fetchPendientesTotales}
                disabled={isLoadingPendientes}
                className="h-10 px-4 rounded-2xl gap-2 font-bold text-[10px] uppercase border-indigo-200 text-indigo-700 hover:bg-indigo-50"
              >
                <RefreshCw className={cn("w-3.5 h-3.5", isLoadingPendientes && "animate-spin")} /> Actualizar
              </Button>
            </div>
          </div>

          {(['1000', '2000'] as const).map(centro => {
            const grupos = pendientesAgrupadosPorCentro[centro];
            const totalPedidos = grupos.reduce((s, g) => s + g.pedidos.length, 0);
            const nombrePlanta = centro === '1000' ? 'UIO' : 'GYE';
            return (
              <div key={centro} className="space-y-3">
                <div className="flex items-center justify-between px-1">
                  <h3 className="text-[11px] font-black uppercase flex items-center gap-2 tracking-widest text-amber-700">
                    <div className="w-2.5 h-2.5 rounded-full bg-amber-600" /> Pedidos Pendientes — Centro {centro} ({nombrePlanta})
                  </h3>
                  <Badge variant="outline" className="text-[10px] font-bold border-gray-200 text-gray-500">
                    {totalPedidos.toLocaleString()} pedidos · {grupos.length.toLocaleString()} materiales
                  </Badge>
                </div>

                <Card className="rounded-2xl border border-gray-100 shadow-sm overflow-hidden bg-white">
                  {isLoadingPendientes ? (
                    <div className="py-16 flex flex-col items-center justify-center gap-3 text-gray-500">
                      <Loader2 className="w-6 h-6 animate-spin" />
                      <p className="text-[10px] font-bold uppercase tracking-widest">Cargando pendientes...</p>
                    </div>
                  ) : grupos.length === 0 ? (
                    <div className="py-16 text-center text-gray-500 font-bold uppercase tracking-widest opacity-30">Sin pedidos pendientes</div>
                  ) : (
                    <div className="max-h-[600px] overflow-y-auto px-4">
                      <Accordion type="multiple" value={expandedPendientesMateriales} onValueChange={setExpandedPendientesMateriales} className="divide-y divide-gray-50">
                        {grupos.map(group => (
                          <AccordionItem key={group.material} value={`${centro}::${group.material}`} className="border-b-0">
                            <AccordionTrigger className="hover:no-underline py-3 px-2">
                              <div className="flex items-center justify-between w-full pr-4 text-left">
                                <div className="flex items-center gap-3">
                                  <Badge className="bg-amber-50 text-amber-800 font-mono font-bold text-[10px] border-amber-200">{group.material}</Badge>
                                  <p className="text-xs font-black text-gray-700 uppercase truncate max-w-[360px]">{group.descripcion || 'Sin descripción'}</p>
                                </div>
                                <div>
                                  <p className="text-[9px] font-black uppercase text-gray-500 tracking-wider">Pedidos</p>
                                  <p className="text-xs font-mono font-bold text-amber-600 text-right">{group.pedidos.length}</p>
                                </div>
                              </div>
                            </AccordionTrigger>
                            <AccordionContent>
                              <div className="overflow-x-auto">
                              <table className="w-full border-collapse text-center font-sans bg-gray-50/40 rounded-xl overflow-hidden">
                                <thead className="bg-gray-50 text-[10px] font-black uppercase text-gray-500 border-b border-gray-100">
                                  <tr>
                                    <th className="px-4 py-2 border-r border-gray-100 text-left">Pedido</th>
                                    <th className="px-3 py-2 border-r border-gray-100">Posición</th>
                                    <th className="px-3 py-2 border-r border-gray-100">Cant. Pedida</th>
                                    <th className="px-3 py-2 border-r border-gray-100">Vol. Pend.</th>
                                    <th className="px-3 py-2 border-r border-gray-100">Fecha Pedido</th>
                                    <th className="px-3 py-2 border-r border-gray-100">Fecha Entrega</th>
                                    <th className="px-3 py-2 border-r border-gray-100 text-left">Ciudad Destino</th>
                                    <th className="px-3 py-2 border-r border-gray-100 font-mono text-gray-500">Cod.Buscar</th>
                                    <th className="px-4 py-2 bg-teal-50/40 text-teal-700">FERT · Fecha Entrega</th>
                                  </tr>
                                </thead>
                                <tbody className="divide-y divide-gray-50 text-[11px]">
                                  {group.pedidos.map((p, i) => (
                                    <tr key={i} className="hover:bg-gray-50/50 transition-colors">
                                      <td className="px-4 py-2 font-mono font-bold text-gray-700 border-r border-gray-100 text-left">{p.pedido}</td>
                                      <td className="px-3 py-2 font-mono text-gray-500 border-r border-gray-100">{p.posicion || '—'}</td>
                                      <td className="px-3 py-2 font-mono text-gray-700 border-r border-gray-100">{p.cantPedida || '—'}</td>
                                      <td className="px-3 py-2 font-mono text-gray-700 border-r border-gray-100">{p.volPend || '—'}</td>
                                      <td className="px-3 py-2 font-mono text-gray-500 border-r border-gray-100">{p.fechaPedido || '—'}</td>
                                      <td className="px-3 py-2 font-mono text-gray-500 border-r border-gray-100">{p.fechaEntrega || '—'}</td>
                                      <td className="px-3 py-2 text-left text-gray-500 uppercase border-r border-gray-100">{p.ciudadDestino || '—'}</td>
                                      <td className="px-3 py-2 font-mono text-gray-500 border-r border-gray-100">{p.codBuscar}</td>
                                      <td className="px-4 py-2 font-mono font-bold bg-teal-50/10 text-teal-700">{p.fechaEntregaFert || '—'}</td>
                                    </tr>
                                  ))}
                                </tbody>
                              </table>
                              </div>
                            </AccordionContent>
                          </AccordionItem>
                        ))}
                      </Accordion>
                    </div>
                  )}
                </Card>
              </div>
            );
          })}
        </TabsContent>
      </Tabs>

      {/* Fuera de los <TabsContent>: se abre también desde el panel de Sincronizar, en cualquier
          pestaña. Mismo esquema que "Confirmar Respuesta P3" / "Confirmar desactivación" de Laminado. */}
      <Dialog open={confirmacionP2 !== null} onOpenChange={(open) => { if (!open) responderConfirmacionP2(false); }}>
        <DialogContent className="max-w-3xl max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Confirmar P2 — Venta Externa</DialogTitle>
            <DialogDescription>
              Revisa lo que se va a grabar antes de continuar. Por cada centro y tipo queda UN P2 vigente: los P2 activos
              anteriores se marcan como inactivos (estado &apos;I&apos;); sus detalles no se tocan. Esta acción escribe en producción.
            </DialogDescription>
          </DialogHeader>
          {confirmacionP2 && (
            <div className="space-y-5 text-left text-sm">
              {confirmacionP2.map(p => (
                <div key={`${p.centro}-${p.tipo}`} className="space-y-2">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="inline-block text-[10px] font-black uppercase tracking-wider bg-slate-100 text-slate-600 rounded-full px-3 py-1">Centro {p.centro} · {TIPO_TAG[p.tipo]}</span>
                    <span className={cn("text-[11px] font-bold",
                      p.accion === 'crear' ? 'text-emerald-700' : p.accion === 'actualizar' ? 'text-indigo-700' : p.accion === 'solo-desactivar' ? 'text-amber-700' : 'text-gray-500')}>
                      {p.accion === 'crear' && `Plan nuevo · ${p.materiales} material(es) · Recup. ${p.fechaInicio} → PT ${p.fechaPT}`}
                      {p.accion === 'actualizar' && `Actualiza el Plan #${p.conservar?.codigo_plan_grupo} del mismo ciclo · ${p.materiales} material(es)`}
                      {p.accion === 'solo-desactivar' && 'Sin necesidad hoy: no se crea plan, solo se desactivan los anteriores'}
                      {p.accion === 'sin-cambios' && 'Sin necesidad y sin P2 activo: no se hace nada'}
                      {p.tipo === 'ESPUMAS' && p.diferidos > 0 && p.accion !== 'sin-cambios' && ` · +P2 DIFERIDO (${p.diferidos})`}
                    </span>
                  </div>
                  {/* Solo el mismo ciclo: un P2 de un ciclo anterior ya quedó cerrado por su P3 (ver generarPlanP2Base). */}
                  {p.accion === 'actualizar' && p.respondidoPorP3.length > 0 && (
                    <p className="text-[11px] font-bold text-amber-700 bg-amber-50 border border-amber-100 rounded-lg px-3 py-2">
                      El Plan #{p.conservar?.codigo_plan_grupo} ya fue respondido por el/los P3 #{p.respondidoPorP3.join(', #')}: si continúas, Laminado / Corte Espuma tendrían que volver a responder.
                    </p>
                  )}
                  {p.desactivar.length > 0 ? (
                    <div className="border border-slate-100 rounded-xl overflow-hidden">
                      <table className="w-full text-[11px] border-collapse">
                        <thead className="bg-gray-50 text-gray-500 uppercase font-bold">
                          <tr>
                            <th className="px-3 py-2 text-left">Se desactiva</th>
                            <th className="px-3 py-2 text-left">Valor</th>
                            <th className="px-3 py-2 text-left">Rango</th>
                            <th className="px-3 py-2 text-left">Creado</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-50">
                          {p.desactivar.map(plan => {
                            const creado = fechaHoraCreacionPlanGrupo(plan.fecha_creacion);
                            return (
                              <tr key={plan.codigo_plan_grupo}>
                                <td className="px-3 py-2 font-mono">#{plan.codigo_plan_grupo}</td>
                                <td className="px-3 py-2">{plan.valor}</td>
                                <td className="px-3 py-2 font-mono">{soloFecha(plan.fecha_inicio_plan)} → {soloFecha(plan.fecha_fin_plan)}</td>
                                <td className="px-3 py-2 font-mono">{`${creado.fecha} ${creado.hora}`.trim() || '—'}</td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                  ) : p.accion !== 'sin-cambios' && (
                    <p className="text-[11px] text-gray-500">No hay P2 anteriores activos que desactivar.</p>
                  )}
                </div>
              ))}
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => responderConfirmacionP2(false)}>Cancelar</Button>
            <Button onClick={() => responderConfirmacionP2(true)} className="bg-emerald-600 hover:bg-emerald-700 text-white">Confirmar y Guardar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <PanelProgreso panel={panelProgreso} />
    </div>
  );
};
