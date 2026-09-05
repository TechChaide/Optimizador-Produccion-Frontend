
'use client';

import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import {
  Scissors,
  Loader2,
  LayoutDashboard,
  RefreshCw,
  Database,
  ChevronLeft,
  ChevronRight,
  Plus,
  Minus,
  Info,
  ShoppingCart,
  ChevronsLeft,
  ChevronsRight,
  Filter,
  AlertCircle,
  ClipboardList,
  Download,
  Boxes,
  Pencil,
  Trash2,
  CheckCircle2,
  Mail
} from 'lucide-react';
import { Card } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { grupoService } from '@/services/grupo.service';
import { restriccionService } from '@/services/restriccion.service';
import { planGrupoService } from '@/services/plangrupo.service';
import { detalleTacticoService } from '@/services/detalletactico.service';
import { serviciosService } from '@/services/servicios.service';
import { useAppContext } from '@/context/AppProvider';
import type { Grupo, Restriccion, PlanGrupo, DetalleTactico } from '@/types/interfaces';
import { cn } from '@/lib/utils';
import { nextBusinessDay as nextBusinessDayCal, cargarDiasNoLaborables, fechaLocalEcuador, type DiasNoLaborables } from '@/lib/dias-laborables';
import { guardarEnCache, leerDeCache, actualizarEnCache } from '@/lib/cache-modulos';
import { format, startOfMonth, endOfMonth, eachDayOfInterval, getDay, addMonths, subMonths, isValid, parseISO } from 'date-fns';
import { es } from 'date-fns/locale';

// --- CONSTANTES TÉCNICAS PLANTA ---
// codigo_grupo real (tabla grupo) para "Corte y Laminado (Centro 1000)" — verificado contra
// GET /api/grupo. Es el único PlanGrupo/DetalleTactico que este módulo crea y edita.
const CODIGO_GRUPO_LAMINADO = 8;
const BLOCK_SIZE = 40;
const SETUP_TIME_PER_RUN = 95; // 95 min por corrida física: traslado/ingreso de bloques + pegado (adhesivo) + limpieza (ajustado desde 55 min, validado con el negocio incluyendo el tiempo de traslado)
// Proceso "lámina convoluted": 1 lámina base pasada por el proceso alterno (otra máquina) devuelve
// 2 láminas CONV de menor espesor del mismo recorrido. La necesidad/plan de la variante CONV se
// deriva multiplicando por este factor la de su lámina base, en vez de calcularse por participación propia.
const CONV_SPLIT_FACTOR = 2;

// Materiales que, aunque su descripción contiene "LAMINA CILINDRICA", no deben generar corrida ni
// sumar necesidad propia: son semielaborados que dependen de otra lámina (ej. 30026039 consume
// 30004185 según su propio BOM) pero cuyo consumo real ya se cubre con el stock de esa lámina base
// en otra área, sin afectar el cálculo de necesidades de esta sección.
const EXCLUDED_LAMINA_MATERIALS = new Set(['30026039']);

// Responsables de Control de Producción cuyas órdenes FERT ya cuentan como producción REALIZADA el
// mismo día (no participan en la necesidad OF_HALB, que sigue pendiente de producir): "014" (HR-LAMIN,
// la lámina base) y "031" (HR-CONVT, el proceso convoluted que parte esa base en 2 láminas de menor
// espesor). Verificado con datos reales: material 30006694 (CONV) tiene su propia orden FERT bajo
// responsable 031/ruta HR-CONVT, que antes quedaba excluida de "Producción Diaria" por filtrar solo
// "014" — su columna mostraba "—" pese a tener producción real ese día, y esa producción tampoco se
// sumaba al stock disponible (totalStockKg/UN en handleProcessResumen).
const RESP_PRODUCCION_DIARIA = ['014', '031'];

const isConvDescripcion = (desc: string): boolean => {
  const u = desc.toUpperCase();
  return u.includes('CONV') || u.includes('CV');
};

interface UnifiedNeedRow {
  material: string;
  descripcion: string;
  densidad: string;
  altura: number;
  espesor: number;
  distancia: number;
  peso: number;
  consumoKg: number;
  consumoUn: number;
  nroRollos: number;
  consumoKgHalb: number;
  nroRollosHalb: number;
  totalConsumoKg: number; 
  totalNroRollos: number; 
  stock1006: number;
  stock1008: number;
  stock1015: number;
  stockUN1006: number;
  stockUN1008: number;
  stockUN1015: number;
  totalStockKg: number; // Bodegas (1006/1008/1015) + Producción Diaria del responsable "014" (solo FERT)
  totalStockUN: number; // Bodegas (1006/1008/1015) + Producción Diaria del responsable "014" (solo FERT)
  prodDiariaKg: number;
  prodDiariaUn: number;
  looperPesoUN: number;
  looperDensidad: string;
  looperEspesor: number;
  looperTRolloMin: number;
  apertura: string;
  porcentajeNecesidad: number;
  planUn: number;
  planKg: number;
  tProceso: number; 
  hasDeficit: boolean;
  unidades: number;
  bomParentMaterial?: string; // Solo en variantes CONV: código de la lámina base (BOM) de la que se producen; permite anidarlas y agruparlas en el mismo bloque de corridas
  runsRecomendado: number; // Corridas que calculó el algoritmo automático de déficit para este bloque, SIN aplicar corridasManualOverrides — referencia para la UI cuando el usuario decide un número distinto
  necVentaExternaKg: number; // Porción de consumoKg cuyo origen (P2) es el grupo "Venta Externa" — prioridad menor a Forros/Muebles, no participa del reparto proporcional del bloque (ver groupMap.forEach en handleProcessResumen)
  necVentaExternaUn: number; // necVentaExternaKg redondeado hacia arriba al rollo completo — igual criterio que deficitRealUN
}

// Déficit real de un material (necesidad − stock ya cubierto), SIEMPRE redondeado hacia ARRIBA al
// rollo completo. totalNroRollos/totalStockUN salen de dividir Kg entre el peso de un rollo, por lo
// que su diferencia normalmente cae en un número fraccionario (ej. 0.8123 rollos) — un proceso físico
// no puede cortar/producir una fracción de rollo, así que cualquier residuo, por mínimo que sea,
// obliga a cubrir al menos 1 rollo completo. El -0.001 solo evita que ruido de punto flotante (ej.
// 11.0000000001) redondee de más un déficit que en realidad ya es un entero exacto.
const deficitRealUN = (r: Pick<UnifiedNeedRow, 'totalNroRollos' | 'totalStockUN'>): number => {
  const raw = r.totalNroRollos - r.totalStockUN;
  return raw > 0.001 ? Math.ceil(raw - 0.001) : 0;
};

// Déficit real de la porción EXCLUSIVA de Venta Externa (su necesidad menos el stock ya disponible)
// — mismo criterio de redondeo que deficitRealUN. Consumo interno (Forros/Muebles) tiene prioridad:
// Venta Externa recibe lo que queda de la bolsa del bloque DESPUÉS de cubrir el déficit de Forros/
// Muebles (ver TIER 1/2/3 en handleProcessResumen) — puede quedar corta y aplazarse sin bloquear la
// aprobación ni la corrida (decisión del usuario: prioridad al consumo interno).
const deficitVentaExternaUN = (r: Pick<UnifiedNeedRow, 'necVentaExternaUn' | 'totalStockUN'>): number => {
  const raw = r.necVentaExternaUn - r.totalStockUN;
  return raw > 0.001 ? Math.ceil(raw - 0.001) : 0;
};

// Déficit real de Forros/Muebles: el déficit total del material (deficitRealUN, mezclado) menos lo
// que ya se atribuye a la necesidad de Venta Externa — así ambos tramos siguen sumando el mismo
// déficit total de antes, sin doble conteo del mismo stock disponible. Es la porción con PRIORIDAD:
// se sirve primero de la bolsa del bloque (ver TIER 1 en handleProcessResumen).
const deficitForrosMueblesUN = (r: Pick<UnifiedNeedRow, 'totalNroRollos' | 'totalStockUN' | 'necVentaExternaUn'>): number => {
  return Math.max(0, deficitRealUN(r) - deficitVentaExternaUN(r));
};

// Fila cruda proveniente de endpoints SAP/servicios internos: los nombres de columna varían de
// mayúsculas/minúsculas y de endpoint a endpoint, por eso se accede siempre vía getProp/cleanCode/safeNum.
type RawApiRow = Record<string, unknown>;

// Fila cruda del árbol de explosión de materiales (getMaestroMaterialesExplosion)
interface MaterialExplosionRow {
  NIVEL?: string | number;
  CENTRO?: string;
  FERT_PRINCIPAL?: string;
  DESCRIPCION_FERT?: string;
  MATERIAL_PADRE?: string;
  COMPONENTE?: string;
  DESCRIPCION_COMPONENTE?: string;
  CANTIDAD_UNITARIA?: number | string;
  CANTIDAD_ACUMULADA?: number | string;
}

interface InventarioSapRow {
  MATERIAL?: string | number;
  NOMBRE?: string;
  DESCRIPCION?: string;
  CENTRO?: string | number;
  ALMACEN?: string | number;
  LIBREUTILIZACION?: number | string;
  ENTRASLADO?: number | string;
  INSPECCCALIDAD?: number | string;
  BLOQUEADO?: number | string;
  PUNTOPEDIDO?: number | string;
  TIPO_MATERIAL?: string;
}

interface CorridaOutputRow {
  corridaId: string;
  fecha: string;
  corrida: string;
  material: string;
  descripcion: string;
  planUn: number;
  planKg: number;
  prioridad: number;
  isConvNested: boolean;
}

// Simulación "Paso 3 — Salida de Datos por Respuesta": por cada material referenciado en
// "Necesidades Planta" (match contra el Resumen Necesidades), responde con la cantidad planificada
// en corrida si existe, o con el stock disponible (bodegas + Producción Diaria) si no hay corrida.
interface RespuestaSalidaRow {
  material: string;
  descripcion: string;
  tieneCorrida: boolean;
  cantidadKg: number;
  cantidadUn: number;
  origenes: string;
}

const safeNum = (val: unknown): number => {
  const n = Number(val);
  return isNaN(n) ? 0 : n;
};

const cleanCode = (code: unknown): string => {
  return String(code || '').replace(/^0+/, '').trim();
};

const getProp = (obj: Record<string, unknown> | null | undefined, keys: string[]): string => {
  if (!obj) return '';
  const rowKeys = Object.keys(obj);
  for (const k of keys) {
    const found = rowKeys.find(rk => rk.toLowerCase().trim() === k.toLowerCase().trim());
    if (found) return String(obj[found]).trim();
  }
  return '';
};

const parseDimensionsEnhanced = (desc: string) => {
  const d = desc.toUpperCase();
  const densMatch = d.match(/D-?\s*(\d+(?:\.\d+)?(?:\s*[A-Z]+)*)/);
  const densidad = densMatch ? densMatch[1].trim() : '—';

  const dimMatch = d.match(/(\d+(?:\.\d+)?)\s*[xX*]\s*(\d+(?:\.\d+)?)(?:\s*[xX*]\s*(\d+(?:\.\d+)?))?/);
  const alturaOriginal = dimMatch ? parseFloat(dimMatch[1]) : 0;
  const espesor = dimMatch ? parseFloat(dimMatch[2]) : 0;
  
  let alturaFinal = alturaOriginal;
  if (alturaOriginal === 204 && espesor <= 1.2) {
    alturaFinal = 206;
  }
  
  let distancia = 100; 
  if (espesor === 1.0) distancia = 110;
  else if (espesor === 3.5) distancia = 60;
  else if (espesor === 1.2) distancia = 100;
  
  return { densidad, distancia, altura: alturaFinal, espesor };
};

const extractAperture = (desc: string): string => {
  const d = String(desc || '').toUpperCase();
  const match = d.match(/(194\.5|200|206|214|219|228|244)/);
  if (match) return match[0];
  return '—';
};

const getDensityColor = (dens: string) => {
  const d = dens.toLowerCase();
  if (d.includes('15')) return 'border-l-blue-600 bg-blue-50 text-blue-900';
  if (d.includes('18')) return 'border-l-emerald-600 bg-emerald-50 text-emerald-900';
  if (d.includes('20')) return 'border-l-purple-600 bg-purple-50 text-purple-900';
  if (d.includes('22') || d.includes('23')) return 'border-l-amber-600 bg-amber-50 text-amber-900';
  if (d.includes('25')) return 'border-l-pink-600 bg-pink-50 text-pink-900';
  if (d.includes('26')) return 'border-l-teal-600 bg-teal-50 text-teal-900';
  if (d.includes('30')) return 'border-l-orange-600 bg-orange-50 text-orange-900';
  return 'border-l-slate-400 bg-slate-50 text-slate-900';
};

const formatNum = (val: unknown, decimals: number = 2): string => {
  const n = safeNum(val);
  return n.toLocaleString(undefined, {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals
  });
};

interface PlanGrupoPreview {
  codigo_grupo: number;
  nombreGrupo: string;
  valor: string;
  fechaInicio: string;
  fechaFin: string;
  rows: RespuestaSalidaRow[];
}

interface EditableDetalleRow {
  codigo_detalle_tactico: number;
  material: string;
  descripcion: string;
  cantidad: number;
  marcadoEliminar: boolean;
  esNuevo: boolean;
  codigo_plan_grupo_padre: number; // Plan_grupo ORIGEN de la necesidad (otra área), no el propio plan de Laminado
}

interface EditPlanPreview {
  codigo_plan_grupo: number;
  valor: string;
  fechaInicio: string;
  fechaFin: string;
  rows: EditableDetalleRow[];
  // PlanGrupo tal cual vino de getAll() — necesario para poder resguardar fecha_inicio_plan/
  // fecha_fin_plan al confirmar (ver handleConfirmEditarPlan): el servicio no tiene PATCH parcial,
  // hay que reenviar el objeto completo.
  planOriginal: PlanGrupo;
}

interface NecesidadPlantaRow {
  codigo_material: number;
  cantidad_produccion_neta: string;
  fecha_inicio: string;
  codigo_plan_grupo: number;
}

// Cantidad viene como texto desde DetalleTactico (p.ej. "120.5000"); se limpia igual que en
// el tab homólogo de Corte Espuma para poder sumarla de forma segura en el resumen consolidado.
const parseQty = (val: unknown): number => {
  const n = Number(String(val || '').replace(/[^0-9.-]/g, ''));
  return isNaN(n) ? 0 : n;
};

// Misma lógica que el useMemo de respuestaSalidaRows, en función pura: permite invocarla desde
// handleProcessResumen con el finalArray recién calculado (aún no reflejado en el estado
// unifiedNeeds), evitando depender de un re-render para reconciliar el plan automáticamente.
const computeRespuestaSalidaRows = (
  needs: UnifiedNeedRow[],
  necesidadesPlantaMap: Map<string, number>,
  origenesPlantaMap: Map<string, Map<number, number>>
): RespuestaSalidaRow[] => {
  return needs
    .filter(u => necesidadesPlantaMap.has(String(Number(u.material))))
    .map((u): RespuestaSalidaRow => {
      const tieneCorrida = u.planUn > 0;
      const origenesMap = origenesPlantaMap.get(String(Number(u.material)));
      const origenes = origenesMap && origenesMap.size > 0 ? Array.from(origenesMap.keys()).join(', ') : '—';
      return {
        material: u.material,
        descripcion: u.descripcion,
        tieneCorrida,
        // Con corrida: la corrida planificada NO reemplaza el stock ya disponible, se suma — lo que
        // realmente va a estar disponible es planKg (lo que se va a cortar) + totalStockKg (lo que ya
        // hay). Sin corrida, la respuesta sigue siendo solo el stock (no hay nada más que ofrecer).
        cantidadKg: u.totalStockKg + (tieneCorrida ? u.planKg : 0),
        cantidadUn: u.totalStockUN + (tieneCorrida ? u.planUn : 0),
        origenes,
      };
    })
    .sort((a, b) => Number(a.tieneCorrida) - Number(b.tieneCorrida));
};

// Normaliza fecha_inicio_plan/fecha_fin_plan al mismo formato 'yyyy-MM-dd' que usa selectedDates.
// Delega en fechaLocalEcuador (@/lib/dias-laborables): el sufijo horario NO siempre es "T00:00:00"
// como asumía el comentario original — un plan grabado a las 17:00 o 22:00 hora Ecuador llega en UTC
// con esa hora real, y recortar el ISO a lo bruto podía devolver el día calendario SIGUIENTE (ver
// el mismo bug documentado en explotarPFFParaCentro de Corte Espuma). fechaLocalEcuador convierte
// correctamente a hora de Ecuador, y deja intactas las fechas planas sin hora (Provisionales/FERT).
const soloFecha = (v: unknown): string => {
  const s = String(v ?? '').trim();
  if (!s || s === 'null' || s === 'undefined') return '';
  return fechaLocalEcuador(s);
};

// Solo el plan "P3" es una respuesta real contra un P2 — "PFD" es una variante de salida que no debe
// contarse como respuesta efectiva. Mismo criterio que usa Venta Externa (ver esPlanP3 en
// TacticalPlanVentaExternaSection) para su propia validación "Data Aprobada".
const esPlanP3 = (valor: unknown): boolean => /\bp3\b/i.test(String(valor || ''));

// Los días hábiles viven en @/lib/dias-laborables y contemplan feriados / días no trabajados del
// calendario configurado (Configuraciones → Calendario Área). Dentro del componente se usa el wrapper
// siguienteDiaHabil, que ya lleva ese calendario cargado. Antes esto era un salto fijo (viernes +3,
// sábado +2, resto +1) que ignoraba feriados: la Respuesta P3/PFD podía quedar fechada en un día que
// la planta no trabaja, y esa fecha es la de FABRICACIÓN.

// Un PlanGrupo "cubre" la selección si alguna fecha seleccionada cae dentro de su rango
// [fecha_inicio_plan, fecha_fin_plan] (comparación lexicográfica, válida en formato yyyy-MM-dd). Si
// al plan le falta alguna de las dos fechas no se puede evaluar con confianza: se excluye explícito
// en vez de asumir que cubre todo o nada.
const planCubreAlgunaFecha = (plan: PlanGrupo, fechasSeleccionadas: string[]): boolean => {
  const inicio = soloFecha(plan.fecha_inicio_plan);
  const fin = soloFecha(plan.fecha_fin_plan);
  if (!inicio || !fin) {
    console.warn(`[Modificar Plan Activo] Plan Grupo #${plan.codigo_plan_grupo} sin rango de fechas válido, se excluye de la evaluación.`);
    return false;
  }
  return fechasSeleccionadas.some(f => f >= inicio && f <= fin);
};

// Planes propios de Laminado candidatos a la modificación/desactivación automática: activos, "P3"
// (nunca "PFD", que es solo la variante de visualización), cuyo rango cubre alguna fecha
// seleccionada, y creados en un día ANTERIOR a hoy. Un plan creado hoy mismo queda excluido a
// propósito: el negocio necesita poder seguir reconciliándolo/editándolo el mismo día sin que la
// auditoría automática lo desactive por debajo mientras sigue vigente; solo los "P3" que quedaron
// de días previos cubriendo una fecha ya vencida/de hoy se consideran obsoletos.
const filtrarPlanesP3ActivosQueCubren = (planes: PlanGrupo[], fechasSeleccionadas: string[], todayStr: string): PlanGrupo[] => {
  return planes.filter(p =>
    p.codigo_grupo === CODIGO_GRUPO_LAMINADO &&
    p.estado === 'A' &&
    // "Rollos": codigo_grupo=8 es compartido con la Respuesta P3/PFD de Corte Espuma — sin este
    // filtro, un P3 de Espuma podía colarse como candidato a la modificación/desactivación automática
    // de Laminado.
    /rollo/i.test(String(p.valor || '')) &&
    /p3/i.test(String(p.valor || '')) && !/pfd/i.test(String(p.valor || '')) &&
    soloFecha(p.fecha_creacion) !== todayStr &&
    planCubreAlgunaFecha(p, fechasSeleccionadas)
  );
};

interface AlmacenBreakdown {
  nombre: string;
  codigosPlanGrupo: string;
  cantidad: number;
  nroLineas: number;
  porcentaje: number;
}

interface MaterialSummaryRow {
  codigo_material: number;
  cantidadTotal: number;
  nroLineas: number;
  almacenes: AlmacenBreakdown[];
}

// Resumen consolidado: en la tabla cruda un mismo código de material aparece repetido en
// varias líneas (una por cada PlanGrupo/fecha) con cantidades distintas. Este bloque agrupa
// por material y suma la cantidad de producción neta para dar una sola cifra por material.
// El desglose por almacén (área ALMACEN_CONSUMO) se calcula aparte y sólo se muestra al expandir.
const MaterialSummaryTable: React.FC<{ data: Record<string, NecesidadPlantaRow[]> }> = ({ data }) => {
  const [page, setPage] = useState(1);
  const pageSize = 10;
  const [expandedMaterials, setExpandedMaterials] = useState<Set<number>>(new Set());

  const summary = useMemo(() => {
    const map = new Map<number, { codigo_material: number; cantidadTotal: number; nroLineas: number; almacenes: Map<string, { cantidad: number; nroLineas: number; codigosPlanGrupo: Set<number> }> }>();
    Object.entries(data).forEach(([almacen, rows]) => {
      rows.forEach(row => {
        const cod = row.codigo_material;
        if (!map.has(cod)) map.set(cod, { codigo_material: cod, cantidadTotal: 0, nroLineas: 0, almacenes: new Map() });
        const entry = map.get(cod)!;
        const qty = parseQty(row.cantidad_produccion_neta);
        entry.cantidadTotal += qty;
        entry.nroLineas += 1;
        if (!entry.almacenes.has(almacen)) entry.almacenes.set(almacen, { cantidad: 0, nroLineas: 0, codigosPlanGrupo: new Set() });
        const almEntry = entry.almacenes.get(almacen)!;
        almEntry.cantidad += qty;
        almEntry.nroLineas += 1;
        almEntry.codigosPlanGrupo.add(row.codigo_plan_grupo);
      });
    });
    return Array.from(map.values())
      .map((entry): MaterialSummaryRow => ({
        codigo_material: entry.codigo_material,
        cantidadTotal: entry.cantidadTotal,
        nroLineas: entry.nroLineas,
        // % de participación por almacén = cantidad consumida por ese almacén / cantidad total del material.
        // (No se usa el conteo de líneas: un almacén con 1 línea de 962 y otro con 1 línea de 0.32
        // no participan por igual, aunque ambos tengan el mismo número de ítems).
        almacenes: Array.from(entry.almacenes.entries())
          .map(([nombre, v]) => ({
            nombre,
            codigosPlanGrupo: Array.from(v.codigosPlanGrupo).join(', '),
            cantidad: v.cantidad,
            nroLineas: v.nroLineas,
            porcentaje: entry.cantidadTotal > 0 ? (v.cantidad / entry.cantidadTotal) * 100 : 0
          }))
          .sort((a, b) => b.cantidad - a.cantidad)
      }))
      .sort((a, b) => b.cantidadTotal - a.cantidadTotal);
  }, [data]);

  useEffect(() => { setPage(1); }, [summary]);

  const totalPages = Math.max(1, Math.ceil(summary.length / pageSize));
  const paginated = useMemo(() => summary.slice((page - 1) * pageSize, page * pageSize), [summary, page]);

  const toggleMaterial = (cod: number) => {
    setExpandedMaterials(prev => {
      const next = new Set(prev);
      if (next.has(cod)) { next.delete(cod); } else { next.add(cod); }
      return next;
    });
  };

  return (
    <div className="space-y-4 text-left">
      <h3 className="text-xs font-black uppercase text-slate-800 tracking-widest flex items-center gap-2">
        <div className="w-2.5 h-2.5 rounded-full bg-emerald-600" /> Resumen Consolidado por Material ({summary.length})
      </h3>
      <div className="rounded-2xl border border-gray-100 shadow-sm overflow-hidden bg-white">
        <div className="overflow-x-auto max-h-[500px]">
          <table className="w-full text-center border-collapse text-[10px]">
            <thead className="bg-gray-50 sticky top-0 z-20 text-[9px] font-bold uppercase text-gray-400">
              <tr>
                <th className="px-6 py-4 border-r border-gray-100 text-left">Código Material</th>
                <th className="px-6 py-4 border-r border-gray-100 font-black bg-amber-50 text-amber-700">Cantidad Total Consumo</th>
                <th className="px-6 py-4 border-r border-gray-100">Nro. Líneas</th>
                <th className="px-6 py-4 text-left">Almacenes</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50 font-bold text-slate-700">
              {paginated.length === 0 ? (
                <tr><td colSpan={4} className="py-16 text-slate-300 uppercase font-black tracking-widest italic opacity-50 text-center">Sin registros</td></tr>
              ) : paginated.map((row) => {
                const isExp = expandedMaterials.has(row.codigo_material);
                const almacenNames = row.almacenes.map(a => a.nombre).join(', ');
                return (
                  <React.Fragment key={row.codigo_material}>
                    <tr onClick={() => toggleMaterial(row.codigo_material)} className="hover:bg-gray-50/50 transition-colors font-mono text-[10px] cursor-pointer">
                      <td className="px-6 py-3 border-r border-slate-50 text-left text-indigo-600 font-black">
                        <span className="inline-flex items-center gap-2">
                          {isExp ? <Minus className="w-3 h-3 text-red-500 shrink-0" /> : <Plus className="w-3 h-3 text-indigo-500 shrink-0" />}
                          {row.codigo_material}
                        </span>
                      </td>
                      <td className="px-6 py-3 border-r border-slate-50 text-slate-900 font-black bg-amber-50">{row.cantidadTotal.toLocaleString(undefined, { maximumFractionDigits: 2 })}</td>
                      <td className="px-6 py-3 border-r border-slate-50 text-slate-500">{row.nroLineas}</td>
                      <td className="px-6 py-3 text-left text-slate-400 truncate max-w-[280px]" title={almacenNames}>{almacenNames}</td>
                    </tr>
                    {isExp && (
                      <tr>
                        <td colSpan={4} className="p-0 bg-slate-50/60 border-b border-slate-100">
                          <div className="px-6 py-4">
                            <table className="w-full text-center border-collapse text-[9px]">
                              <thead>
                                <tr className="bg-gray-50 text-gray-400 uppercase font-bold tracking-tighter">
                                  <th className="px-4 py-2 border-r border-gray-100 text-left">Almacén</th>
                                  <th className="px-4 py-2 border-r border-gray-100 text-left">Código Plan Grupo</th>
                                  <th className="px-4 py-2 border-r border-gray-100">Cantidad</th>
                                  <th className="px-4 py-2 border-r border-gray-100">Nro. Ítems</th>
                                  <th className="px-4 py-2">% Participación</th>
                                </tr>
                              </thead>
                              <tbody className="divide-y divide-gray-50 font-bold text-slate-700 bg-white">
                                {row.almacenes.map(alm => (
                                  <tr key={alm.nombre}>
                                    <td className="px-4 py-2 border-r border-slate-100 text-left uppercase">{alm.nombre}</td>
                                    <td className="px-4 py-2 border-r border-slate-100 text-left font-mono text-indigo-600" title={alm.codigosPlanGrupo}>{alm.codigosPlanGrupo}</td>
                                    <td className="px-4 py-2 border-r border-slate-100 font-mono">{alm.cantidad.toLocaleString(undefined, { maximumFractionDigits: 2 })}</td>
                                    <td className="px-4 py-2 border-r border-slate-100 font-mono">{alm.nroLineas}</td>
                                    <td className="px-4 py-2 font-mono">
                                      <div className="flex items-center gap-2">
                                        <div className="flex-1 h-1.5 bg-slate-200 rounded-full overflow-hidden"><div className="h-full bg-emerald-500" style={{ width: `${Math.min(alm.porcentaje, 100)}%` }} /></div>
                                        <span className="w-12 text-right">{alm.porcentaje.toFixed(1)}%</span>
                                      </div>
                                    </td>
                                  </tr>
                                ))}
                              </tbody>
                            </table>
                          </div>
                        </td>
                      </tr>
                    )}
                  </React.Fragment>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
      {totalPages > 1 && (
        <div className="flex items-center justify-center gap-1 pt-2">
          <button onClick={() => setPage(1)} disabled={page === 1} className="p-2 rounded-md text-gray-500 hover:bg-gray-100 disabled:opacity-30 disabled:cursor-not-allowed transition-colors" title="Primera página"><ChevronsLeft className="w-4 h-4" /></button>
          <button onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page === 1} className="p-2 rounded-md text-gray-500 hover:bg-gray-100 disabled:opacity-30 disabled:cursor-not-allowed transition-colors" title="Página anterior"><ChevronLeft className="w-4 h-4" /></button>
          <span className="min-w-[90px] text-center text-[10px] font-black uppercase text-slate-500">Página {page} / {totalPages}</span>
          <button onClick={() => setPage(p => Math.min(totalPages, p + 1))} disabled={page === totalPages} className="p-2 rounded-md text-gray-500 hover:bg-gray-100 disabled:opacity-30 disabled:cursor-not-allowed transition-colors" title="Página siguiente"><ChevronRight className="w-4 h-4" /></button>
          <button onClick={() => setPage(totalPages)} disabled={page === totalPages} className="p-2 rounded-md text-gray-500 hover:bg-gray-100 disabled:opacity-30 disabled:cursor-not-allowed transition-colors" title="Última página"><ChevronsRight className="w-4 h-4" /></button>
        </div>
      )}
    </div>
  );
};

// Snapshot de lo que este módulo tiene cargado. Se guarda al sincronizar y se restaura al volver de
// otro módulo, para no perder el trabajo en curso solo por navegar — mismo patrón que Corte Espuma y
// Venta Externa (ver @/lib/cache-modulos y [[persistencia_datos_modulos]]).
const CACHE_CORTE_LAMINADO = 'tactica-corte-laminado';
interface SnapshotCorteLaminado {
  grupos: Grupo[];
  restriccionesArray: Restriccion[];
  ordenes: RawApiRow[];
  ordenesFert: RawApiRow[];
  kpiLooperData: RawApiRow[];
  tiemposEnsambladoData: RawApiRow[];
  inventarioSAP: InventarioSapRow[];
  operadoresLaminado: RawApiRow[];
  mantenimientosSAP: RawApiRow[];
  diasNoLaborables: string[];
  necesidadesPlantaData: Record<string, NecesidadPlantaRow[]>;
  // Resumen YA PROCESADO (ver handleProcessResumen) — a diferencia del resto de este snapshot (datos
  // crudos de SAP, se pueden volver a pedir), esto es trabajo del usuario (overrides manuales
  // incluidos) que se perdía en silencio al navegar a otro módulo y volver: el tab "Resumen" quedaba
  // vacío hasta hacer clic en "Generar Necesidades" de nuevo. Se sincroniza aparte (ver el useEffect
  // de más abajo), no en cada guardarEnCache de handleSincronizarYGenerar, porque cambia con cada
  // edición manual, no solo al sincronizar.
  unifiedNeeds: UnifiedNeedRow[];
  planManualOverrides: Record<string, number>;
  corridasManualOverrides: Record<string, number>;
  approvedDeficitRows: string[];
}

export const TacticalPlanCorteLaminadoSection: React.FC = () => {
  const { addNotification } = useAppContext();

  const [mounted, setMounted] = useState(false);
  const [activeTab, setActiveTab] = useState('resumen');
  const [grupos, setGrupos] = useState<Grupo[]>([]);
  const [restriccionesArray, setRestriccionesArray] = useState<Restriccion[]>([]);
  const [ordenes, setOrders] = useState<RawApiRow[]>([]);
  const [ordenesFert, setOrdersFert] = useState<RawApiRow[]>([]);
  const [kpiLooperData, setKpiLooperData] = useState<RawApiRow[]>([]);
  // Tiempos de ensamblado (mismo endpoint que ya usan Venta Externa/Corte Espuma) — aquí solo se usa
  // para recuperar PuestoTrabajoLinea (ej. "Carruseles - LINEA 1") y grabarlo en linea_produccion del
  // DetalleTactico; el tiempo de proceso de Laminado sigue viniendo de kpiLooperData (TiempoRolloMin),
  // un catálogo propio y distinto, ya real y aplicado en tProceso.
  const [tiemposEnsambladoData, setTiemposEnsambladoData] = useState<RawApiRow[]>([]);
  const [inventarioSAP, setInventarioSAP] = useState<InventarioSapRow[]>([]);
  const [operadoresLaminado, setOperadoresLaminado] = useState<RawApiRow[]>([]);
  const [mantenimientosSAP, setMantenimientosSAP] = useState<RawApiRow[]>([]);
  // El módulo YA NO sincroniza solo al abrirse — ver handleSincronizarYGenerar. `isLoading` cubre
  // toda la duración de "Sincronizar y Generar Necesidades" (ambas fases); el botón del encabezado
  // usa `syncStep` para el disabled/spinner (mismo patrón que los otros 3 módulos tácticos), pero
  // el estado vacío inicial (más abajo, `!datosCargados && !isLoading`) sigue leyendo este flag.
  const [isLoading, setIsLoading] = useState(false);
  const [datosCargados, setDatosCargados] = useState(false);
  const [necesidadesPlantaData, setNecesidadesPlantaData] = useState<Record<string, NecesidadPlantaRow[]>>({});
  const [necesidadesPlantaLoading, setNecesidadesPlantaLoading] = useState(false);

  const [selectedDates, setSelectedDates] = useState<Set<string>>(new Set());
  const [viewDate, setViewDate] = useState<Date>(new Date());

  // "Enviar Reporte" (Gestión de Tiempos → correo): destinatarios editables en pantalla, no fijos en
  // código (decisión del usuario) — se guardan tal cual se escriben, sin validar formato acá, el
  // backend es quien reparte por coma. isSendingReporte cubre solo la llamada real a
  // serviciosService.enviarCorreo, no el resto del módulo.
  const [destinatariosReporte, setDestinatariosReporte] = useState('');
  const [isSendingReporte, setIsSendingReporte] = useState(false);
  
  const [unifiedNeeds, setUnifiedNeeds] = useState<UnifiedNeedRow[]>([]);
  const [isProcessingResumen, setIsProcessingResumen] = useState(false);
  const [isSavingPlan, setIsSavingPlan] = useState(false);
  const [isValidandoExportTxt, setIsValidandoExportTxt] = useState(false);
  const [planPreview, setPlanPreview] = useState<PlanGrupoPreview | null>(null);
  const [isSavingPlanPFD, setIsSavingPlanPFD] = useState(false);
  const [planPreviewPFD, setPlanPreviewPFD] = useState<PlanGrupoPreview | null>(null);
  const [editPlanPreview, setEditPlanPreview] = useState<EditPlanPreview | null>(null);
  const [isLoadingEditPlan, setIsLoadingEditPlan] = useState(false);
  const [planesGrupoDisponibles, setPlanesGrupoDisponibles] = useState<PlanGrupo[] | null>(null);
  const [planGrupoSeleccionado, setPlanGrupoSeleccionado] = useState<number | null>(null);
  const [isSavingEditPlan, setIsSavingEditPlan] = useState(false);
  const [resumenProgress, setResumenProgress] = useState({ current: 0, total: 0 });
  const [expandedGroups, setExpandedGroups] = useState<Set<string>>(new Set());

  const [planManualOverrides, setPlanOverrides] = useState<Record<string, number>>({});
  // Override manual del NÚMERO DE CORRIDAS de un bloque (apertura|densidad), independiente del
  // override por material (planManualOverrides). Cuando el usuario decide agregar o quitar una
  // corrida completa a un bloque (por encima/debajo de la recomendación automática por déficit),
  // se guarda aquí y handleProcessResumen la respeta como bolsa total del bloque a redistribuir.
  const [corridasManualOverrides, setCorridasOverrides] = useState<Record<string, number>>({});
  // Aprobación visual del semáforo "% Nec." cuando un material queda en rojo (hasDeficit) pero YA
  // tiene corridas asignadas (planUn > 0): no cambia hasDeficit (el stock real sigue bajo), solo
  // reconoce que el planificador revisó y decidió proseguir con la corrida ya asignada. Vive solo en
  // memoria de sesión (no se persiste ni bloquea "Guardar Plan"): se resetea al recalcular el Resumen
  // Necesidades o recargar la página.
  const [approvedDeficitRows, setApprovedDeficitRows] = useState<Set<string>>(new Set());
  // Toast no bloqueante: una edición individual de PLAN(UN) cambió la cantidad de un material que
  // comparte bloque con otros — se ofrece redistribuir la diferencia entre los DEMÁS materiales, sin
  // tocar el valor recién editado. No bloquea: la edición ya se aplicó, esto solo ofrece ajustarla.
  // Solo un toast a la vez — uno nuevo reemplaza al anterior en vez de acumularse.
  const [redistribuirToast, setRedistribuirToast] = useState<{
    material: string; apertura: string; densidad: string; editedValue: number;
    techoActual: number; techoNuevo: number;
  } | null>(null);

  const [corridaFechas, setCorridaFechas] = useState<Record<string, string>>({});

  // Texto en edición de los inputs "Corridas" (por bloque) y "PLAN (UN)" (por material): mientras el
  // usuario escribe, solo se guarda aquí el texto crudo — el recálculo real (handleUpdateCorridasBloque
  // / handleUpdatePlanUn), y cualquier mensaje/diálogo de corrección que dispare, se aplica recién al
  // confirmar (blur o Enter). Antes se recalculaba en cada tecla: escribir "40" disparaba el mensaje ya
  // con el primer "4". La clave se borra al confirmar, así el input vuelve a reflejar el valor calculado.
  const [corridasDraft, setCorridasDraft] = useState<Record<string, string>>({});
  const [planUnDraft, setPlanUnDraft] = useState<Record<string, string>>({});

  const commitCorridasDraft = (apertura: string, densidad: string) => {
    const groupKey = `${apertura}|${densidad}`;
    const raw = corridasDraft[groupKey];
    if (raw === undefined) return;
    handleUpdateCorridasBloque(apertura, densidad, parseInt(raw) || 0);
    setCorridasDraft(prev => {
      const next = { ...prev };
      delete next[groupKey];
      return next;
    });
  };

  const commitPlanUnDraft = (material: string, apertura: string, densidad: string) => {
    const key = `${material}|${apertura}|${densidad}`;
    const raw = planUnDraft[key];
    if (raw === undefined) return;
    handleUpdatePlanUn(material, apertura, densidad, parseInt(raw) || 0);
    setPlanUnDraft(prev => {
      const next = { ...prev };
      delete next[key];
      return next;
    });
  };

  const commitDraftOnEnter = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') e.currentTarget.blur();
  };

  const [assignedPersonnel, setAssignedPersonnel] = useState({
    diaOp1: '',
    diaOp2: '',
    nocheOp1: '',
    nocheOp2: ''
  });

  const handleAssignOperator = useCallback((slot: keyof typeof assignedPersonnel, value: string) => {
    setAssignedPersonnel(prev => {
      if (value && Object.entries(prev).some(([k, v]) => k !== slot && v === value)) {
        addNotification('warning', 'Este operador ya fue asignado en otro turno/posición. Escoja otro operador.');
        return prev;
      }
      return { ...prev, [slot]: value };
    });
  }, [addNotification]);

  const isOperatorTakenElsewhere = useCallback((slot: keyof typeof assignedPersonnel, code: string) => {
    if (!code) return false;
    return (Object.entries(assignedPersonnel) as [keyof typeof assignedPersonnel, string][])
      .some(([s, v]) => s !== slot && v === code);
  }, [assignedPersonnel]);

  const parseCalificacionOperador = useCallback((op: RawApiRow): number => {
    const raw = getProp(op, ['Calificacion', 'CALIFICACION']).replace('%', '').trim();
    const n = parseFloat(raw);
    return Number.isNaN(n) ? 0 : n;
  }, []);

  // Ambos turnos arrancan en "VACÍO" (antes Día arrancaba en H1) — obliga a escoger horario a
  // propósito en vez de asumir uno por defecto; ver validación en handleProcessResumen y
  // handleAutoAssignPersonnel.
  // Días NO laborables (feriados + días que la planta decide no trabajar) del calendario configurado.
  // Vacío = solo se saltan fines de semana. Se carga en initData.
  const [diasNoLaborables, setDiasNoLaborables] = useState<DiasNoLaborables>(new Set<string>());
  const siguienteDiaHabil = useCallback((d: Date) => nextBusinessDayCal(d, diasNoLaborables), [diasNoLaborables]);

  const [selectedDiaShift, setSelectedDiaShift] = useState('EMPTY');
  const [selectedNocheShift, setSelectedNocheShift] = useState('EMPTY');
  // Turno Sábado: independiente de Turno Día (mismas opciones, ver diaShiftOptions) -- antes elegir
  // el horario corto de sábado en el MISMO selector de Turno Día "tapaba" el turno día normal (el
  // lunes quedaba sin considerar en Disponibilidad Total, confirmado por el usuario con un caso
  // real). Ahora Día sigue representando el turno día normal (lunes a viernes) y Sábado se suma
  // aparte -- así una sola selección de fechas (viernes+sábado+lunes) puede evaluar la ventana
  // completa sin las "2 pasadas" que exigía el diseño anterior.
  const [selectedSabadoShift, setSelectedSabadoShift] = useState('EMPTY');

  const diaShiftOptions = [
    { v: 'EMPTY', l: 'VACÍO', h: 0 },
    { v: 'H1', l: '07:00 - 15:45', h: 8.75 },
    { v: 'H2', l: '07:00 - 17:00', h: 10 },
    { v: 'H3', l: '07:00 - 18:00', h: 11 },
    { v: 'H4', l: '07:00 - 19:00', h: 12 },
    // Turno corto para sábado, cuando se necesita capacidad extra (activación manual, no automática
    // -- el sábado no se trata como laborable por defecto, se elige este horario solo ese día puntual).
    // El turno noche del viernes (21:00-05:30, H1 de nocheShiftOptions) ya cubre la madrugada del
    // sábado sin necesitar una opción nueva; el lunes vuelve al horario normal (H1, 07:00-15:45).
    { v: 'H5', l: '07:00 - 13:00', h: 6 }
  ];

  const nocheShiftOptions = [
    { v: 'EMPTY', l: 'VACÍO', h: 0 },
    { v: 'H1', l: '21:00 - 05:30', h: 8.5 },
    { v: 'H2', l: '19:00 - 05:30', h: 10.5 }
  ];

  // Auto-asignar Personal — Laminado Cilíndrico: exige haber escogido al menos un horario (Día y/o
  // Noche) antes de asignar, y respeta cuáles turnos están realmente activos — antes asignaba
  // siempre los 4 puestos (Día+Noche) sin importar si algún turno estaba en "VACÍO". Regla: turno
  // "VACÍO" no recibe personal; si ambos tienen horario, se asignan los 4 puestos.
  const handleAutoAssignPersonnel = useCallback(() => {
    const diaActivo = selectedDiaShift !== 'EMPTY';
    const nocheActivo = selectedNocheShift !== 'EMPTY';
    if (!diaActivo && !nocheActivo) {
      addNotification('warning', 'Escoja un horario de Turno Día y/o Turno Noche antes de asignar personal.');
      return;
    }
    if (operadoresLaminado.length === 0) {
      addNotification('warning', 'No hay operadores con habilidades de Laminado Cilíndrico disponibles.');
      return;
    }

    const candidatos = operadoresLaminado
      .map(op => ({ code: getProp(op, ['CodigoOperador ', 'CODIGO_OPERADOR']), calificacion: parseCalificacionOperador(op) }))
      .filter(o => o.code)
      .sort((a, b) => b.calificacion - a.calificacion);

    // >50% (75% u 100%) se considera Operador "A"; <=50% se considera Ayudante "B"
    const principales = candidatos.filter(o => o.calificacion > 50);
    const ayudantes = candidatos.filter(o => o.calificacion <= 50);

    const used = new Set<string>();
    const takeNext = (pool: typeof candidatos) => {
      const found = pool.find(o => !used.has(o.code));
      if (found) used.add(found.code);
      return found?.code || '';
    };

    const diaOp1 = diaActivo ? takeNext(principales) : '';
    const diaOp2 = diaActivo ? (takeNext(ayudantes) || takeNext(principales)) : '';
    const nocheOp1 = nocheActivo ? takeNext(principales) : '';
    const nocheOp2 = nocheActivo ? (takeNext(ayudantes) || takeNext(principales)) : '';

    setAssignedPersonnel({ diaOp1, diaOp2, nocheOp1, nocheOp2 });

    const posicionesEsperadas = (diaActivo ? 2 : 0) + (nocheActivo ? 2 : 0);
    const asignados = [diaOp1, diaOp2, nocheOp1, nocheOp2].filter(Boolean).length;
    const alcanceTexto = diaActivo && nocheActivo ? '' : diaActivo ? ' — solo Turno Día (Noche vacío)' : ' — solo Turno Noche (Día vacío)';
    if (asignados < posicionesEsperadas) {
      addNotification('warning', `Asignación automática parcial: se completaron ${asignados} de ${posicionesEsperadas} posiciones por falta de operadores calificados disponibles${alcanceTexto}.`);
    } else {
      addNotification('success', `Personal asignado automáticamente según calificación (Operador A: >50%, Ayudante B: ≤50%)${alcanceTexto}.`);
    }
  }, [operadoresLaminado, addNotification, parseCalificacionOperador, selectedDiaShift, selectedNocheShift]);

  useEffect(() => {
    setMounted(true);
    const today = new Date();
    setViewDate(today);
    setSelectedDates(new Set([format(today, 'yyyy-MM-dd')]));
  }, []);

  const calendarDaysList = useMemo(() => {
    if (!mounted) return [];
    const start = startOfMonth(viewDate);
    const end = endOfMonth(viewDate);
    const days = eachDayOfInterval({ start, end });
    const startDay = getDay(start);
    const padding = startDay === 0 ? 6 : startDay - 1;
    return [...Array(padding).fill(null), ...days];
  }, [viewDate, mounted]);

  const datesWithOrders = useMemo(() => {
    if (!mounted) return new Set<string>();
    const dates = new Set<string>();
    const allOrders = [...ordenes, ...ordenesFert];
    allOrders.forEach(o => {
      const d = getProp(o, ['FECHAINICIO', 'FECHA', 'fecha_inicio']).trim();
      if (d && d !== 'null') {
        const normalized = d.includes('T') ? d.split('T')[0] : d;
        dates.add(normalized);
      }
    });
    return dates;
  }, [ordenes, ordenesFert, mounted]);

  const extractMaterialInfo = useCallback((item: RawApiRow) => {
    const matStr = getProp(item, ['MATERIAL', 'Material', 'CodMaterial', 'MATERIAL_ID', 'CODIGO']);
    const nameStr = getProp(item, ['NOMBRE', 'NombreMaterial', 'Descripcion', 'NomMaterial', 'DESCRIPCION']);
    
    const match = matStr.match(/^(\d+)/);
    const code = match ? match[1].slice(-8) : matStr.slice(-8);
    const desc = nameStr || matStr.replace(/^\d+\s*/, '') || '—';

    return { code, desc };
  }, []);

  // Línea de producción real (ej. "Carruseles - LINEA 1") por material, para poblar
  // linea_produccion al grabar DetalleTactico — antes salía vacía porque este módulo nunca había
  // consultado el endpoint de tiempos de ensamblado (solo usaba kpiLooperData, que no trae esa
  // columna). Un material puede repetirse en varios PuestoTrabajo; se toma la primera línea no vacía.
  const puestoTrabajoLineaPorMaterial = useMemo(() => {
    const map = new Map<string, string>();
    tiemposEnsambladoData.forEach((t) => {
      const code = cleanCode(getProp(t, ['CodMaterial', 'MATERIAL', 'Material']));
      const linea = getProp(t, ['PuestoTrabajoLinea']);
      if (code && linea && !map.has(code)) map.set(code, linea);
    });
    return map;
  }, [tiemposEnsambladoData]);

  const initData = useCallback(async () => {
    try {
      const groupsRes = await grupoService.getAll();
      const filteredGroups = (groupsRes.data || []).filter(g => {
        const name = (g.nombre_grupo || '').toLowerCase();
        return (name.includes('corte y laminado') || name.includes('laminado'));
      });
      setGrupos(filteredGroups);
      const ids = filteredGroups.map(g => g.codigo_grupo);

      const [restrs, provs, kpiLooper, invSAP, ferts, skills, maint, tiempos] = await Promise.all([
        restriccionService.getAll(),
        serviciosService.OrdenesProvisionalesPaginados(1, 20000).catch(() => ({ data: [] })),
        serviciosService.getKPIMAestroLooper().catch(() => ({ data: [] })),
        serviciosService.getInventarioAñoActual().catch(() => ({ data: [] })),
        serviciosService.getOrdenesFert(1, 20000).catch(() => ({ data: [] })),
        serviciosService.getCuboHabilidadesOP().catch(() => ({ data: [] })),
        serviciosService.ListarMantenimientoPreventivosProgramados().catch(() => ({ data: [] })),
        serviciosService.getTiemposEnsambladobyCentroyCodigoGrupo('1000', CODIGO_GRUPO_LAMINADO).catch(() => ({ data: [] }))
      ]);

      const restriccionesFiltradas = (restrs.data || []).filter((r) => ids.includes(r.codigo_grupo));
      const provOrdenes = provs.data?.data || provs.data || [];
      const fertOrdenes = ferts.data?.data || ferts.data || [];
      const kpiLooperRows = kpiLooper?.data || [];
      const tiemposRows = tiempos?.data?.data || tiempos?.data || [];
      const inventario = Array.isArray(invSAP?.data) ? invSAP.data : (invSAP?.data?.data || []);
      const mantenimientos = Array.isArray(maint?.data) ? maint.data : (maint?.data?.data || []);
      const skillRows: RawApiRow[] = Array.isArray(skills.data) ? skills.data : [];
      const laminadoOps = skillRows.filter((s) =>
        String(getProp(s, ['LineaProceso', 'LINEA_PROCESO'])).toUpperCase().includes('LAMINADO CILINDRICO')
      );

      setRestriccionesArray(restriccionesFiltradas);
      setOrders(provOrdenes);
      setOrdersFert(fertOrdenes);
      setKpiLooperData(kpiLooperRows);
      setTiemposEnsambladoData(tiemposRows);
      setInventarioSAP(inventario);
      setMantenimientosSAP(mantenimientos);
      setOperadoresLaminado(laminadoOps);

      return {
        grupos: filteredGroups,
        restriccionesArray: restriccionesFiltradas,
        ordenes: provOrdenes,
        ordenesFert: fertOrdenes,
        kpiLooperData: kpiLooperRows,
        tiemposEnsambladoData: tiemposRows,
        inventarioSAP: inventario,
        operadoresLaminado: laminadoOps,
        mantenimientosSAP: mantenimientos,
      };
    } catch (e) {
      console.error('Error init TacticalPlanLaminado:', e);
      return null;
    }
  }, []);

  // Mismo criterio del tab "Necesidades Planta" de Corte Espuma: filtra los grupos referenciados
  // por la restricción ALMACEN_CONSUMO, ubica sus PlanGrupo activos de "Plan Táctico - Centro <centro> - P2"
  // y trae el DetalleTactico asociado, agrupado por área (nombre de grupo).
  const fetchNecesidadesPlanta = useCallback(async (diasOverride?: DiasNoLaborables): Promise<Record<string, NecesidadPlantaRow[]>> => {
    setNecesidadesPlantaLoading(true);
    try {
      const [restrsRes, gruposRes] = await Promise.all([
        restriccionService.getAll(),
        grupoService.getAll()
      ]);

      const normalizeName = (s: string) => String(s || '')
        .normalize('NFD').replace(/[̀-ͯ]/g, '')
        .replace(/\s+/g, '')
        .toLowerCase();

      // Restricción ALMACEN_CONSUMO propia de Laminado (codigo_grupo = CODIGO_GRUPO_LAMINADO): se
      // filtra por su propio codigo_grupo (no cualquier fila con ese nombre) para no compartir
      // configuración con la de Corte Espuma (codigo_grupo 7, "Taller de Corte"), que tiene su
      // propia fila y no debe considerar "Forros" (eso sí es demanda de Laminado).
      const almacenConsumoNames = (restrsRes.data || [])
        .filter((r) => r.nombre_restriccion === 'ALMACEN_CONSUMO' && r.codigo_grupo === CODIGO_GRUPO_LAMINADO)
        .flatMap((r) => String(r.valor_restriccion || '').split(/[,&]/).map((v: string) => normalizeName(v)))
        .filter((v: string) => v !== '');

      const gruposFiltrados = (gruposRes.data || []).filter((g) => g.estado === 'A' && almacenConsumoNames.includes(normalizeName(g.nombre_grupo)));
      const gruposCodigos = gruposFiltrados.map((g) => g.codigo_grupo);
      const grupoPorCodigo = new Map(gruposFiltrados.map((g) => [g.codigo_grupo, g]));

      if (gruposCodigos.length === 0) {
        setNecesidadesPlantaData({});
        return {};
      }

      // "Venta Externa" alimenta necesidad tanto de Laminado como de Espuma (planes "...P2 - Rollos"
      // y "...P2 - Espumas" respectivamente) — aquí solo cuenta la variante "Rollos".
      //
      // Además del estado, se exige que fecha_inicio_plan sea EXACTO hoy + 1 día hábil — así se graba
      // el P2 en origen (generarPlanP2Core en Venta Externa fija fecha_inicio_plan = nextBusinessDay(hoy)
      // directo, sin pasos intermedios). Sin esto, un P2 que quedó "A" por olvido del área origen
      // (nunca desactivado al generar el siguiente ciclo) seguía apareciendo como necesidad vigente
      // indefinidamente, sin importar qué tan vieja fuera su fecha — mismo criterio que Corte Espuma.
      // diasOverride: al inicializar, el calendario de feriados se acaba de cargar y el estado
      //  todavía no se refleja en este closure — se recibe el Set directo para no
      // calcular la fecha objetivo con feriados vacíos (ver el useEffect de arranque).
      const fechaObjetivoP2 = format(nextBusinessDayCal(new Date(), diasOverride ?? diasNoLaborables), 'yyyy-MM-dd');

      const planGruposRes = await planGrupoService.getAll();
      const planesActivosCrudo = (planGruposRes.data || []).filter((pg) => {
        const valor = String(pg.valor || '').trim();
        if (pg.estado !== 'A' || !gruposCodigos.includes(pg.codigo_grupo)) return false;
        if (!/plan\s*t[aá]ctico.*centro.*p2/i.test(valor)) return false;
        const esVentaExterna = /venta\s*externa/i.test(grupoPorCodigo.get(pg.codigo_grupo)?.nombre_grupo || '');
        if (esVentaExterna && !/rollo/i.test(valor)) return false;
        if (soloFecha(pg.fecha_inicio_plan) !== fechaObjetivoP2) return false;
        return true;
      });

      // Solo el plan MÁS RECIENTE por grupo — red de seguridad para el caso (menos común ahora que
      // planesActivosCrudo ya exige fecha de recuperación = hoy) de que el origen genere dos P2 "A"
      // del mismo grupo en el mismo ciclo. Verificado con datos reales (grupo "Forros": #121 del
      // 03/08 y #146 del 04/08, ambos activos a la vez) que el módulo origen del P2 no siempre
      // desactiva el plan del ciclo anterior al generar uno nuevo (mismo bug que ya corregimos en la
      // generación de Venta Externa). Sin este filtro, Laminado sumaba ambos y duplicaba la
      // necesidad.
      const masRecientePorGrupo = new Map<number, PlanGrupo>();
      planesActivosCrudo.forEach((pg) => {
        const actual = masRecientePorGrupo.get(pg.codigo_grupo);
        if (!actual || soloFecha(pg.fecha_inicio_plan) > soloFecha(actual.fecha_inicio_plan)) {
          masRecientePorGrupo.set(pg.codigo_grupo, pg);
        }
      });
      const planesActivos = Array.from(masRecientePorGrupo.values());

      const planGrupoCodigos = planesActivos.map((pg) => pg.codigo_plan_grupo);
      const planPorCodigo = new Map(planesActivos.map((pg) => [pg.codigo_plan_grupo, pg]));

      if (planGrupoCodigos.length === 0) {
        setNecesidadesPlantaData({});
        return {};
      }

      const detallesRes = await detalleTacticoService.getAll();
      const detalles = (detallesRes.data || []).filter((d) => planGrupoCodigos.includes(d.codigo_plan_grupo));

      const grouped: Record<string, NecesidadPlantaRow[]> = {};
      detalles.forEach((d) => {
        const plan = planPorCodigo.get(d.codigo_plan_grupo);
        const grupo = plan ? grupoPorCodigo.get(plan.codigo_grupo) : undefined;
        const area = grupo?.nombre_grupo || 'Sin Área Asignada';
        if (!grouped[area]) grouped[area] = [];
        grouped[area].push({
          codigo_material: d.codigo_material,
          cantidad_produccion_neta: d.cantidad_produccion_neta,
          fecha_inicio: plan?.fecha_inicio_plan ? fechaLocalEcuador(plan.fecha_inicio_plan) : '—',
          codigo_plan_grupo: d.codigo_plan_grupo
        });
      });

      setNecesidadesPlantaData(grouped);
      return grouped;
    } catch (e) {
      console.error('Error al recuperar necesidades de planta', e);
      setNecesidadesPlantaData({});
      return {};
    } finally {
      setNecesidadesPlantaLoading(false);
    }
  }, [diasNoLaborables]);

  // Sincronización manual: se dispara con el botón "Sincronizar" del encabezado, no al abrir el
  // módulo — mismo criterio que Corte Espuma y Venta Externa (ver [[carga_manual_modulos_tacticos]]).
  // Entrar a mirar no debe costar 7 llamadas pesadas a SAP (Provisionales/FERT ~20K filas cada una).
  //
  // El calendario de feriados se carga PRIMERO y su Set se pasa explícito a fetchNecesidadesPlanta:
  // si corrieran en paralelo, la recuperación del P2 usaría el set todavía vacío (setState no
  // actualiza el closure de forma síncrona) y buscaría el plan un día antes del que el origen
  // realmente grabó. Al ser un callback disparado por click (no un useEffect con estas funciones en
  // sus dependencias), no reaparece el bucle infinito que obligó a leer por ref en la versión
  // anterior de este arranque — ver [[dias_no_laborables_p2]] para el porqué de ese bug.
  // Antes eran 2 clics separados (Sincronizar, después Generar Necesidades) — para un usuario que
  // interactúa a diario, resultaba repetitivo (decisión del usuario, no un ajuste de UI porque sí).
  // Se combinan en un solo botón: sincroniza y, en cuanto los datos crudos ya se reflejan en el
  // render, dispara el cálculo automáticamente (ver autoGenerarPendiente/syncStep más abajo).
  const [autoGenerarPendiente, setAutoGenerarPendiente] = useState(false);
  const [syncStep, setSyncStep] = useState<'idle' | 'sincronizando' | 'generando'>('idle');

  const handleSincronizarYGenerar = useCallback(async () => {
    setIsLoading(true);
    setSyncStep('sincronizando');
    try {
      const dias = await cargarDiasNoLaborables();
      setDiasNoLaborables(dias);
      const [snapshotInit, necesidadesPlanta] = await Promise.all([initData(), fetchNecesidadesPlanta(dias)]);
      setDatosCargados(true);
      if (snapshotInit) {
        guardarEnCache<SnapshotCorteLaminado>(CACHE_CORTE_LAMINADO, {
          ...snapshotInit,
          diasNoLaborables: [...dias],
          necesidadesPlantaData: necesidadesPlanta,
          // El resumen procesado se sincroniza aparte (ver el useEffect de más abajo) — acá solo se
          // preserva lo que ya hubiera, en vez de resetearlo, para no perder trabajo si el usuario
          // vuelve a pulsar "Sincronizar" sin haber navegado fuera del módulo.
          unifiedNeeds,
          planManualOverrides,
          corridasManualOverrides,
          approvedDeficitRows: Array.from(approvedDeficitRows),
        });
      }
      // No se llama handleProcessResumen() directo acá: leería filteredOrders/filteredFertOrders/etc.
      // (useMemo derivados del estado que se acaba de actualizar arriba) por closure vieja, antes de
      // que el siguiente render los recalcule. Se dispara desde el efecto de abajo, que sí ve la
      // versión fresca de handleProcessResumen una vez que ese render ya ocurrió.
      setAutoGenerarPendiente(true);
    } catch (e) {
      addNotification('error', `Error al sincronizar: ${(e as Error).message}`);
      setIsLoading(false);
      setSyncStep('idle');
    }
  }, [initData, fetchNecesidadesPlanta, unifiedNeeds, planManualOverrides, corridasManualOverrides, approvedDeficitRows, addNotification]);

  // Rehidratación: si ya se había sincronizado en esta sesión, se recupera lo trabajado en vez de
  // dejar el módulo vacío al volver de otro módulo (ver @/lib/cache-modulos). Incluye el resumen ya
  // PROCESADO (unifiedNeeds) y los overrides manuales — antes solo se restauraban los datos crudos,
  // así que el tab "Resumen" volvía vacío tras navegar a otro módulo hasta pulsar "Generar
  // Necesidades" de nuevo (reportado por el usuario con datos reales).
  // `rehidratado` (estado, no ref) marca que la restauración YA corrió al menos una vez con
  // `mounted===true` — reemplaza a un `useRef` "primera ejecución" que en desarrollo (React
  // StrictMode, activo por defecto en Next.js App Router) se rompía: StrictMode invoca los efectos
  // de montaje DOS VECES seguidas: la 1ra invocación del efecto de sync-a-caché (más abajo) marcaba
  // el ref en falso y se saltaba a sí misma (correcto); la 2da invocación YA veía el ref en falso y
  // SÍ escribía — pero en ese instante unifiedNeeds todavía era el valor inicial ([]), porque la
  // rehidratación (este efecto) recién estaba por aplicar lo restaurado. Resultado: el caché se
  // pisaba con un resumen vacío apenas se montaba el módulo, y al volver más tarde aparecía en 0 —
  // no pasaba en producción (sin StrictMode), por eso "ya se había resuelto" en sesiones anteriores
  // probadas contra el deploy real, y recién se notó probando en localhost. Con un estado (no un
  // ref), `setUnifiedNeeds(...)` y `setRehidratado(true)` quedan en el MISMO commit — el efecto de
  // abajo nunca puede ver `rehidratado=true` con `unifiedNeeds` todavía en su valor inicial.
  const [rehidratado, setRehidratado] = useState(false);
  useEffect(() => {
    if (!mounted) return;
    const snap = leerDeCache<SnapshotCorteLaminado>(CACHE_CORTE_LAMINADO);
    if (snap) {
      setGrupos(snap.grupos);
      setRestriccionesArray(snap.restriccionesArray);
      setOrders(snap.ordenes);
      setOrdersFert(snap.ordenesFert);
      setKpiLooperData(snap.kpiLooperData);
      setTiemposEnsambladoData(snap.tiemposEnsambladoData || []);
      setInventarioSAP(snap.inventarioSAP);
      setOperadoresLaminado(snap.operadoresLaminado);
      setMantenimientosSAP(snap.mantenimientosSAP);
      setDiasNoLaborables(new Set(snap.diasNoLaborables));
      setNecesidadesPlantaData(snap.necesidadesPlantaData);
      setUnifiedNeeds(snap.unifiedNeeds || []);
      setPlanOverrides(snap.planManualOverrides || {});
      setCorridasOverrides(snap.corridasManualOverrides || {});
      setApprovedDeficitRows(new Set(snap.approvedDeficitRows || []));
      setDatosCargados(true);
    }
    setRehidratado(true);
  }, [mounted]);

  // Mantiene el snapshot en sync con el resumen ya procesado y sus overrides manuales — a diferencia
  // de los datos crudos (solo cambian al Sincronizar), esto cambia con cada edición del usuario
  // (handleUpdatePlanUn, handleUpdateCorridasBloque, aprobar déficit, etc.), así que se sincroniza vía
  // efecto en vez de tener que acordarse de llamar actualizarEnCache en cada handler por separado. Se
  // salta hasta que `rehidratado` sea true (ver comentario arriba) — antes de eso, escribir pisaría
  // el snapshot bueno con un resumen vacío sin que el usuario haya hecho nada todavía.
  useEffect(() => {
    if (!rehidratado) return;
    actualizarEnCache<SnapshotCorteLaminado>(CACHE_CORTE_LAMINADO, {
      unifiedNeeds,
      planManualOverrides,
      corridasManualOverrides,
      approvedDeficitRows: Array.from(approvedDeficitRows),
    });
  }, [rehidratado, unifiedNeeds, planManualOverrides, corridasManualOverrides, approvedDeficitRows]);

  // Kg totales por material desde el resumen consolidado del tab "Necesidades Planta"
  // (mismo cálculo que MaterialSummaryTable), usado sólo para las columnas informativas
  // NEC. PLANTA [Kg]/[Un] del tab "Resumen Necesidades" — no alimenta ningún otro cálculo.
  const materialNecesidadesPlantaMap = useMemo(() => {
    const map = new Map<string, number>();
    Object.values(necesidadesPlantaData).flat().forEach(row => {
      const key = String(Number(row.codigo_material));
      map.set(key, (map.get(key) || 0) + parseQty(row.cantidad_produccion_neta));
    });
    return map;
  }, [necesidadesPlantaData]);

  // Igual que materialNecesidadesPlantaMap, pero solo la porción cuya área de origen es "Venta
  // Externa" (mismo criterio /venta\s*externa/i que ya filtra el plan "Rollos" en fetchNecesidadesPlanta,
  // ver más arriba) — necesidadesPlantaData ya viene agrupado por área (nombre_grupo), así que no hace
  // falta otra consulta. Alimenta necVentaExternaKg/Un en finalArray: Venta Externa se cubre exacto
  // pero DESPUÉS de Forros/Muebles (prioridad al consumo interno, puede aplazarse), que sigue en el
  // reparto proporcional (porcentajeNecesidad).
  const materialNecesidadVentaExternaMap = useMemo(() => {
    const map = new Map<string, number>();
    Object.entries(necesidadesPlantaData).forEach(([area, rows]) => {
      if (!/venta\s*externa/i.test(area)) return;
      rows.forEach(row => {
        const key = String(Number(row.codigo_material));
        map.set(key, (map.get(key) || 0) + parseQty(row.cantidad_produccion_neta));
      });
    });
    return map;
  }, [necesidadesPlantaData]);

  // Necesidad de cada material desglosada por plan_grupo ORIGEN (la otra área cuyo plan generó la
  // demanda) — a diferencia de materialNecesidadesPlantaMap (que solo suma el total), este mapa
  // conserva el desglose por origen para prorratear el planKg de Laminado entre ellos al guardar o
  // editar el plan: codigo_plan_grupo_padre debe ser ese origen real, no el propio plan de Laminado.
  const materialOrigenesPlantaMap = useMemo(() => {
    const map = new Map<string, Map<number, number>>();
    Object.values(necesidadesPlantaData).flat().forEach(row => {
      const matKey = String(Number(row.codigo_material));
      if (!map.has(matKey)) map.set(matKey, new Map());
      const porOrigen = map.get(matKey)!;
      const qty = parseQty(row.cantidad_produccion_neta);
      porOrigen.set(row.codigo_plan_grupo, (porOrigen.get(row.codigo_plan_grupo) || 0) + qty);
    });
    return map;
  }, [necesidadesPlantaData]);

  // codigo_plan_grupo de los orígenes cuya área es "Venta Externa" — necesidadesPlantaData ya viene
  // agrupado por área (nombre_grupo), así que basta con recorrer las claves. Usado en
  // getOrigenesProrrateo para distinguir, entre los orígenes de un material, cuál es Venta Externa
  // (se cubre exacto con su propia necesidad) de cuáles son internos (Forros/Muebles, reciben el
  // remanente) — ver conversación: el reparto proporcional por % participación solo es un problema
  // real cuando Venta Externa comparte material con un origen interno, no entre orígenes internos
  // entre sí (ese caso se resuelve con stock, sin cambios).
  const planGruposVentaExternaSet = useMemo(() => {
    const set = new Set<number>();
    Object.entries(necesidadesPlantaData).forEach(([area, rows]) => {
      if (!/venta\s*externa/i.test(area)) return;
      rows.forEach(row => set.add(row.codigo_plan_grupo));
    });
    return set;
  }, [necesidadesPlantaData]);

  // Colector de faltantes de cobertura interna (ver getOrigenesProrrateo) acumulados durante un guardado
  // de plan (puede llamarse decenas de veces, una por material, dentro de un mismo forEach/for): se
  // limpia al inicio de cada flujo de guardado y se vacía en un solo aviso consolidado al final —
  // mismo criterio que el aviso agregado "N material(es) PFF sin lámina cortada" de Corte Espuma, en
  // vez de un toast por material.
  const faltanteInternoRef = useRef<{ material: string; rollosFaltantes: number }[]>([]);
  const flushFaltanteInternoNotification = useCallback(() => {
    const items = faltanteInternoRef.current;
    faltanteInternoRef.current = [];
    if (items.length === 0) return;
    const detalle = items.map(i => `${i.material} (faltan ${i.rollosFaltantes} rollo${i.rollosFaltantes === 1 ? '' : 's'})`).join(', ');
    addNotification('warning', `El consumo interno (Forros/Muebles) no se cubrió completo pese a tener prioridad — falta capacidad real de corrida para ${items.length} material(es): ${detalle}. Verifique si hace falta una corrida adicional.`);
  }, [addNotification]);

  // El proceso de Corte y Laminado no puede cortar/despachar fracciones de rollo: cada cantidad se
  // redondea HACIA ARRIBA al múltiplo entero del peso de un rollo completo (unifiedNeeds.peso) que
  // alcance a cubrir la necesidad — nunca al múltiplo inferior, para no dejar desabastecido al origen
  // que la pidió (si la necesidad es menor a un rollo, se entrega 1 rollo completo; si es mayor, 2, 3,
  // 4... rollos hasta cubrirla). Una necesidad de 0 (p.ej. "No — stock" del plan PFD) queda en 0.
  const redondearARollo = useCallback((material: string, kg: number): number => {
    if (kg <= 0) return kg;
    const pesoRollo = unifiedNeeds.find(u => u.material === material)?.peso || 0;
    if (pesoRollo <= 0) return kg;
    return Math.ceil(kg / pesoRollo) * pesoRollo;
  }, [unifiedNeeds]);

  // Reparte cantidadKg de un material entre sus planes origen, proporcional a la necesidad que cada
  // uno aportó en "Necesidades Planta". Redondear cada origen hacia arriba por separado (ver
  // redondearARollo) puede sumar más rollos de los que el material tiene realmente planificados
  // (ej. 87.9%/12.1% de 40 rollos redondea a 36+5=41 rollos): por eso el reparto respeta un TECHO
  // = los rollos ya planificados para este material (cantidadKg/peso, redondeado). El origen de
  // MAYOR necesidad se redondea primero a su propio prorrateo (topado al techo restante); el de
  // MENOR necesidad recibe lo que quede del techo, nunca su propio redondeo independiente — así el
  // total nunca excede lo planificado. Si el techo no alcanza para cubrir el mínimo real de algún
  // origen, esto NO alerta aquí — P3 solo reparte lo ya decidido; esa alerta debe vivir en la
  // planificación de la corrida (deficitRealUN, TIER 1/2/3 de handleProcessResumen), no en este
  // prorrateo. Si no
  // hay origen registrado en absoluto (la necesidad vino directo de OF_PROV/OF_HALB y no de otra
  // área), se referencia el propio plan de Laminado como fallback.
  const getOrigenesProrrateo = useCallback((material: string, cantidadKg: number, fallbackCodigoPlanGrupo: number) => {
    const origenes = materialOrigenesPlantaMap.get(String(Number(material)));
    // BUG corregido: un origen SÍ registrado pero con necesidad 0 (el área pidió el material con
    // cantidad 0) es un origen real — antes "totalOrigen <= 0" lo trataba igual que "sin origen" y
    // terminaba auto-referenciando el P3 recién creado como codigo_plan_grupo_padre, perdiendo la
    // trazabilidad hacia el P2 real (ej. Muebles #73 con 1 ítem en 0 quedaba huérfano de su origen).
    // El fallback a sí mismo ahora SOLO aplica cuando no hay ninguna entrada de origen.
    if (!origenes || origenes.size === 0) {
      return [{ codigoPadre: fallbackCodigoPlanGrupo, cantidadKg: redondearARollo(material, cantidadKg) }];
    }

    const entradas = Array.from(origenes.entries()).sort((a, b) => b[1] - a[1]); // mayor necesidad primero
    const totalOrigen = entradas.reduce((s, [, v]) => s + v, 0);
    const pesoRollo = unifiedNeeds.find(u => u.material === material)?.peso || 0;

    if (cantidadKg <= 0) {
      return entradas.map(([codigoPadre]) => ({ codigoPadre, cantidadKg: 0 }));
    }
    // Todos los orígenes registrados pidieron 0 (no hay peso real entre ellos para prorratear
    // proporcionalmente): se asigna completo al primero — ninguno tiene más prioridad que otro — en
    // vez de auto-referenciar el P3 recién creado.
    if (totalOrigen <= 0) {
      return entradas.map(([codigoPadre], i) => ({
        codigoPadre,
        cantidadKg: i === 0 ? redondearARollo(material, cantidadKg) : 0
      }));
    }

    const entradasVE = entradas.filter(([codigoPadre]) => planGruposVentaExternaSet.has(codigoPadre));
    const entradasInternas = entradas.filter(([codigoPadre]) => !planGruposVentaExternaSet.has(codigoPadre));

    // Venta Externa comparte material con un origen interno (Forros/Muebles): consumo interno tiene
    // PRIORIDAD (decisión del usuario — Venta Externa se puede aplazar sin problema). El o los
    // orígenes internos se cubren EXACTO con su propia necesidad (nunca más) y el remanente completo
    // va a Venta Externa — no un % fijo. El caso sin mezcla (solo VE, o solo orígenes internos entre
    // sí) sigue el reparto proporcional de siempre más abajo, sin cambios: ahí no hay problema real, se
    // resuelve con stock. Ya no hay piso de corte no negociable para VE (ver TIER 1/2/3 en
    // handleProcessResumen): si el material no alcanza ni para el consumo interno, ESO sí es una
    // alerta real (ver faltanteInternoRef más abajo); si solo VE queda corta, es el aplazamiento
    // esperado y no se alerta aparte (queda visible en el badge "VE: N UN" de la tabla).
    if (entradasVE.length > 0 && entradasInternas.length > 0) {
      const necesidadVEKg = entradasVE.reduce((s, [, v]) => s + v, 0);
      const necesidadInternaKg = entradasInternas.reduce((s, [, v]) => s + v, 0);

      if (pesoRollo <= 0) {
        const internaKgAsignado = Math.min(necesidadInternaKg, cantidadKg);
        const restoKg = Math.max(0, cantidadKg - internaKgAsignado);
        if (internaKgAsignado < necesidadInternaKg - 0.001) {
          faltanteInternoRef.current.push({ material, rollosFaltantes: 0 });
        }
        const filasInternas = entradasInternas.map(([codigoPadre, cantidad]) => ({
          codigoPadre,
          cantidadKg: internaKgAsignado * (cantidad / (necesidadInternaKg || 1))
        }));
        const filasVE = entradasVE.map(([codigoPadre, cantidad]) => ({
          codigoPadre,
          cantidadKg: restoKg * (cantidad / (necesidadVEKg || 1))
        }));
        return [...filasInternas, ...filasVE];
      }

      const techoRollos = Math.round(cantidadKg / pesoRollo);

      // TIER 1 — origen(es) interno(s): se cubren exacto con su propia necesidad (redondeada hacia
      // arriba al rollo), topados al techo real cortado. Si son 2+ (Forros y Muebles a la vez), se
      // reparten proporcional entre ellos con el criterio "mayor primero, último se lleva el
      // remanente" usado abajo, para no pasarse del cupo reservado.
      const necesidadInternaRollos = entradasInternas.reduce((s, [, v]) => s + (v > 0 ? Math.ceil(v / pesoRollo - 0.001) : 0), 0);
      const internaRollosAsignados = Math.min(necesidadInternaRollos, techoRollos);
      let remanenteInterno = internaRollosAsignados;
      const filasInternas = entradasInternas.map(([codigoPadre, cantidad], i) => {
        const esUltimo = i === entradasInternas.length - 1;
        const rollos = esUltimo
          ? Math.max(0, remanenteInterno)
          : Math.min(Math.ceil(internaRollosAsignados * (cantidad / necesidadInternaKg)), Math.max(0, remanenteInterno));
        remanenteInterno -= rollos;
        return { codigoPadre, cantidadKg: rollos * pesoRollo };
      });

      // TIER 2 — Venta Externa: recibe TODO el remanente de rollos tras cubrir el consumo interno (no
      // un % fijo del total). Si hay 2+ orígenes VE (caso raro), se reparten proporcional entre ellos.
      // Puede quedar corta — es el aplazamiento esperado, no un error.
      const remanenteVERollos = Math.max(0, techoRollos - internaRollosAsignados);
      let remanenteVE = remanenteVERollos;
      const filasVE = entradasVE.map(([codigoPadre, cantidad], i) => {
        const esUltimo = i === entradasVE.length - 1;
        const rollos = esUltimo
          ? Math.max(0, remanenteVE)
          : Math.min(Math.ceil(remanenteVERollos * (cantidad / necesidadVEKg)), Math.max(0, remanenteVE));
        remanenteVE -= rollos;
        return { codigoPadre, cantidadKg: rollos * pesoRollo };
      });

      // Alerta: el remanente para el/los origen(es) interno(s) no alcanza a cubrir su propia necesidad
      // real — escasez real de material para la corrida (incluso con prioridad, no se reparte "a la
      // baja" en silencio).
      if (internaRollosAsignados < necesidadInternaRollos) {
        faltanteInternoRef.current.push({ material, rollosFaltantes: necesidadInternaRollos - internaRollosAsignados });
      }

      return [...filasInternas, ...filasVE];
    }

    if (pesoRollo <= 0 || entradas.length <= 1) {
      return entradas.map(([codigoPadre, cantidad]) => ({
        codigoPadre,
        cantidadKg: redondearARollo(material, cantidadKg * (cantidad / totalOrigen))
      }));
    }

    const techoRollos = Math.round(cantidadKg / pesoRollo);
    let remanenteRollos = techoRollos;
    return entradas.map(([codigoPadre, cantidad], i) => {
      const esUltimo = i === entradas.length - 1;
      const rollos = esUltimo
        ? Math.max(0, remanenteRollos)
        : Math.min(Math.ceil(techoRollos * (cantidad / totalOrigen)), Math.max(0, remanenteRollos));
      remanenteRollos -= rollos;
      return { codigoPadre, cantidadKg: rollos * pesoRollo };
    });
  }, [materialOrigenesPlantaMap, planGruposVentaExternaSet, redondearARollo, unifiedNeeds]);

  const filteredOrders = useMemo(() => {
    const relevantGroups = grupos.map(g => g.codigo_grupo);
    const allowedResps = restriccionesArray
      .filter(r => (r.nombre_restriccion === 'RESPCTRLPROD' || r.nombre_restriccion === 'Hojas_Rutas_Materiales') && relevantGroups.includes(r.codigo_grupo))
      .flatMap(r => r.valor_restriccion.split(/[,&]/).map(v => v.trim()))
      .filter(v => v !== '');

    return ordenes.filter(o => {
      const centro = getProp(o, ['CENTRO', 'Centro', 'centro']).trim();
      if (centro === '2000') return false; 
      const responsable = getProp(o, ['RESPCONTROLPROD', 'RESPCTRLPROD', 'RespControlProd', 'RESP_CONTROL_PROD', 'RESPONSABLE']).trim();
      if (allowedResps.length > 0 && !allowedResps.includes(responsable)) return false;
      
      if (selectedDates.size > 0) {
        const dateRaw = getProp(o, ['FECHAINICIO', 'FECHA']).trim();
        const date = dateRaw.includes('T') ? dateRaw.split('T')[0] : dateRaw;
        if (!selectedDates.has(date)) return false;
      }
      return true;
    });
  }, [ordenes, selectedDates, grupos, restriccionesArray]);

  const filteredFertOrders = useMemo(() => {
    const relevantGroups = grupos.map(g => g.codigo_grupo);
    const allowedResps = restriccionesArray
      .filter(r => (r.nombre_restriccion === 'RESPCTRLPROD' || r.nombre_restriccion === 'Hojas_Rutas_Materiales') && relevantGroups.includes(r.codigo_grupo))
      .flatMap(r => r.valor_restriccion.split(/[,&]/).map(v => v.trim()))
      .filter(v => v !== '');

    return ordenesFert.filter(o => {
      const centro = getProp(o, ['CENTRO', 'Centro', 'centro']).trim();
      if (centro === '2000') return false;
      const responsable = getProp(o, ['RESPCTRLPROD', 'RESP_CONTROL_PROD', 'RESPCONTROLPROD', 'RespControlProd', 'RESPONSABLE']).trim();
      if (allowedResps.length > 0 && !allowedResps.includes(responsable)) return false;

      if (selectedDates.size > 0) {
        const dateRaw = getProp(o, ['FECHA', 'FECHAINICIO', 'FECHA_INICIO']).trim();
        const date = dateRaw.includes('T') ? dateRaw.split('T')[0] : dateRaw;
        if (!selectedDates.has(date)) return false;
      }
      return true;
    });
  }, [ordenesFert, selectedDates, grupos, restriccionesArray]);

  // RESP_PRODUCCION_DIARIA (014/031): no participa en las necesidades OF_HALB (se excluye en
  // handleProcessResumen). El MATERIAL de sus órdenes ya viene al mismo nivel que las filas del
  // resumen (la lámina/componente, no el FERT/HALB padre), por eso NO se explota por BOM: se hace
  // match directo por código de material, igual que NEC. PLANTA (materialNecesidadesPlantaMap).
  const filteredFertOrdersProd014 = useMemo(() => {
    return ordenesFert.filter(o => {
      const centro = getProp(o, ['CENTRO', 'Centro', 'centro']).trim();
      if (centro === '2000') return false;
      const responsable = getProp(o, ['RESPCTRLPROD', 'RESP_CONTROL_PROD', 'RESPCONTROLPROD', 'RespControlProd', 'RESPONSABLE']).trim();
      if (!RESP_PRODUCCION_DIARIA.includes(responsable)) return false;

      if (selectedDates.size > 0) {
        const dateRaw = getProp(o, ['FECHA', 'FECHAINICIO', 'FECHA_INICIO']).trim();
        const date = dateRaw.includes('T') ? dateRaw.split('T')[0] : dateRaw;
        if (!selectedDates.has(date)) return false;
      }
      return true;
    });
  }, [ordenesFert, selectedDates]);


  // Cantidad (Kg) por material del responsable "014" en el tab ÓRDENES FERT, ya al nivel de la
  // lámina/componente del resumen (match directo por código, sin explosión BOM), igual que
  // materialNecesidadesPlantaMap. Esta SÍ es producción ya realizada/comprometida: alimenta la
  // columna "Producción Diaria" y se suma al stock disponible (ver handleProcessResumen).
  //
  // El tab ÓRDENES FERT maneja CANTPENDIENTE en la unidad que indique cada línea (campo UNIDAD): la
  // mayoría son "ST" (unidades/rollos), pero ciertas referencias vienen directo en "KG" — verificado
  // contra datos reales (UNIDAD: ST/M/KG conviven en el mismo endpoint). Sumar CANTPENDIENTE tal cual
  // como si siempre fuera Kg inflaba brutalmente el stock/Producción Diaria de cualquier material en
  // ST (ej. "6" unidades se contaban como "6 Kg"). Ahora: si UNIDAD=KG se usa tal cual; en cualquier
  // otro caso se trata como UN y se convierte a Kg con el peso del rollo (kpiLooperData.PesoUN) —
  // mismo peso que usa el resto del módulo para todas las conversiones UN↔Kg.
  const materialProd014FertMap = useMemo(() => {
    const map = new Map<string, number>();
    filteredFertOrdersProd014.forEach(order => {
      const key = String(Number(getProp(order, ['MATERIAL', 'CodMaterial'])));
      if (!key || key === 'NaN') return;
      const qty = safeNum(getProp(order, ['CANTPENDIENTE', 'CANTPROGRAMADA', 'CANTIDAD']));
      const unidad = getProp(order, ['UNIDAD', 'Unidad', 'UNIDAD_MEDIDA']).trim().toUpperCase();
      let qtyKg = 0;
      if (unidad === 'KG') {
        qtyKg = qty;
      } else {
        const looperMatch = kpiLooperData.find(k => cleanCode(k.Material) === key);
        const pesoUN = looperMatch ? safeNum(looperMatch.PesoUN) : 0;
        qtyKg = pesoUN > 0 ? qty * pesoUN : 0;
      }
      map.set(key, (map.get(key) || 0) + qtyKg);
    });
    return map;
  }, [filteredFertOrdersProd014, kpiLooperData]);

  // Reconciliación reutilizable de un PlanGrupo contra la necesidad actual (misma lógica que ya
  // usaba "Editar Plan" manual): trae los DetalleTactico vigentes del plan, los cruza por clave
  // material|codigo_plan_grupo_padre con la salida fresca (salidaBase) para reutilizar
  // codigo_detalle_tactico en vez de duplicar, y marca para eliminar lo que ya no aparece. La usan
  // tanto el flujo manual (handleConfirmarSeleccionPlan) como el automático confirmado por el
  // usuario (handleConfirmarModificacionAutomaticaPlanActivo).
  const reconciliarDetallesParaPlan = useCallback(async (
    plan: PlanGrupo,
    salidaBase: RespuestaSalidaRow[],
    needsParaDescripcion: UnifiedNeedRow[]
  ): Promise<EditableDetalleRow[]> => {
    const detallesRes = await detalleTacticoService.getAll();
    const detallesPlan = (detallesRes.data || []).filter(d =>
      d.codigo_plan_grupo === plan.codigo_plan_grupo && d.estado === 'A'
    );
    const claveMaterial = (m: string | number) => String(Number(m));
    const existentesPorClave = new Map<string, DetalleTactico>();
    detallesPlan.forEach(d => {
      existentesPorClave.set(`${claveMaterial(d.codigo_material)}|${d.codigo_plan_grupo_padre}`, d);
    });

    const esPFD = /pfd/i.test(plan.valor);
    const salidaFresca = esPFD
      ? salidaBase.map(row => row.tieneCorrida ? row : { ...row, cantidadKg: 0, cantidadUn: 0 })
      : salidaBase.filter(row => row.cantidadKg > 0);

    const clavesUsadas = new Set<string>();
    const rows: EditableDetalleRow[] = [];
    faltanteInternoRef.current = [];
    salidaFresca.forEach(row => {
      const splits = getOrigenesProrrateo(row.material, row.cantidadKg, plan.codigo_plan_grupo);
      splits.forEach(split => {
        if (!esPFD && split.cantidadKg <= 0) return;
        const key = `${claveMaterial(row.material)}|${split.codigoPadre}`;
        clavesUsadas.add(key);
        const existente = existentesPorClave.get(key);
        rows.push({
          codigo_detalle_tactico: existente?.codigo_detalle_tactico ?? 0,
          material: row.material,
          descripcion: row.descripcion,
          cantidad: split.cantidadKg,
          marcadoEliminar: false,
          esNuevo: !existente,
          codigo_plan_grupo_padre: split.codigoPadre,
        });
      });
    });

    detallesPlan.forEach(d => {
      const key = `${claveMaterial(d.codigo_material)}|${d.codigo_plan_grupo_padre}`;
      if (clavesUsadas.has(key)) return;
      const materialCode = cleanCode(d.codigo_material);
      const needRow = needsParaDescripcion.find(u => u.material === materialCode);
      rows.push({
        codigo_detalle_tactico: d.codigo_detalle_tactico,
        material: materialCode,
        descripcion: needRow?.descripcion || '—',
        cantidad: parseQty(d.cantidad_produccion_neta),
        marcadoEliminar: true,
        esNuevo: false,
        codigo_plan_grupo_padre: d.codigo_plan_grupo_padre,
      });
    });

    flushFaltanteInternoNotification();
    return rows;
  }, [getOrigenesProrrateo, flushFaltanteInternoNotification]);

  // Persistencia reutilizable de filas reconciliadas (upsert de las vigentes, delete de las
  // marcadas) — misma lógica que ya usaba "Editar Plan" manual (handleConfirmEditarPlan).
  const persistirFilasEditables = useCallback(async (
    codigoPlanGrupo: number,
    rows: EditableDetalleRow[],
    usuario: string
  ) => {
    let actualizados = 0;
    let agregados = 0;
    let eliminados = 0;
    let fallidos = 0;

    for (const row of rows) {
      try {
        if (row.marcadoEliminar) {
          await detalleTacticoService.delete(row.codigo_detalle_tactico);
          eliminados++;
          continue;
        }

        const detallePayload = {
          codigo_detalle_tactico: row.esNuevo ? 0 : row.codigo_detalle_tactico,
          codigo_material: Number(row.material),
          cantidad_produccion_neta: Math.round(row.cantidad).toFixed(0),
          resp_ctrl_prod: '',
          clase_aprovisionamiento: 'E',
          cantidad_aprovisionamiento: 0,
          estado: 'A',
          codigo_plan_grupo: codigoPlanGrupo,
          codigo_plan_grupo_padre: row.codigo_plan_grupo_padre,
          usuario_modificacion: usuario,
          linea_produccion: puestoTrabajoLineaPorMaterial.get(cleanCode(row.material)) || '',
        };
        await detalleTacticoService.save(detallePayload as unknown as DetalleTactico);
        if (row.esNuevo) agregados++; else actualizados++;
      } catch (e) {
        console.warn(`[Plan Táctico Laminado] Falló material ${row.material} (padre ${row.codigo_plan_grupo_padre}):`, (e as Error).message);
        fallidos++;
      }
    }

    return { actualizados, agregados, eliminados, fallidos };
  }, [puestoTrabajoLineaPorMaterial]);

  // Desactiva un PlanGrupo (estado -> 'I'). El servicio no tiene PATCH parcial: se reenvía el
  // objeto completo tal cual vino de getAll(), solo sobreescribiendo estado. Los DetalleTactico
  // hijos NO cambian de estado (quedan 'A'), por decisión de negocio explícita.
  const desactivarPlanGrupo = useCallback(async (plan: PlanGrupo) => {
    await planGrupoService.save({ ...plan, estado: 'I' } as PlanGrupo);
  }, []);

  // Al confirmar un nuevo P3 o PFD, cualquier otro PlanGrupo de Laminado del MISMO canal (P3 con P3,
  // PFD con PFD — ver esPFD) que siga activo y cuya fecha_inicio_plan sea del MISMO día o de un día
  // ANTERIOR al del plan recién creado queda superado — se desactiva automáticamente, sin diálogo de
  // confirmación aparte (a diferencia de "Modificar Plan Activo", que sí lo pide porque además
  // reconcilia sus detalles; aquí el plan viejo ya quedó completamente reemplazado por uno nuevo, no
  // hace falta tocar nada de él salvo apagarlo). El propio plan nuevo se excluye por codigo_plan_grupo.
  //
  // P3 y PFD son canales INDEPENDIENTES, no intercambiables — verificado con un bug real: antes se
  // trataban como "la misma respuesta vigente" y un PFD nuevo desactivaba el P3 activo del mismo día,
  // lo que rompía la validación de "Exportar TXT" (exige un P3 activo con fecha correcta, ver
  // validarAprobacionVentaExterna) justo después de generar un PFD. El propio PFD ya se documenta en
  // otro lado como "no reemplaza ni modifica el P3 normal: es un PlanGrupo aparte" — la desactivación
  // debía respetar eso.
  const desactivarPlanesLaminadoSuperados = useCallback(async (codigoGrupo: number, fechaNuevoPlan: string, codigoPlanGrupoNuevo: number, esPFD: boolean): Promise<number> => {
    try {
      const planesRes = await planGrupoService.getAll();
      const superados = (planesRes.data || []).filter(p => {
        if (p.codigo_grupo !== codigoGrupo || p.estado !== 'A' || p.codigo_plan_grupo === codigoPlanGrupoNuevo) return false;
        // codigo_grupo=8 es compartido con la Respuesta P3/PFD de Corte Espuma (responden como el
        // mismo grupo SAP, ver conversación) — sin este filtro por "Rollos" en el valor, un P3/PFD
        // nuevo de Laminado desactivaba por error los P3/PFD que Corte Espuma generó el mismo día,
        // porque ambos comparten codigo_grupo y esta función no distinguía de quién era cada uno.
        if (!/rollo/i.test(String(p.valor || ''))) return false;
        if (/pfd/i.test(String(p.valor || '')) !== esPFD) return false;
        const inicio = soloFecha(p.fecha_inicio_plan);
        return inicio !== '' && inicio <= fechaNuevoPlan;
      });
      for (const plan of superados) {
        try {
          await desactivarPlanGrupo(plan);
        } catch (e) {
          console.warn(`[Guardar Plan] No se pudo desactivar el Plan Grupo #${plan.codigo_plan_grupo} superado:`, (e as Error).message);
        }
      }
      return superados.length;
    } catch (e) {
      console.warn('[Guardar Plan] No se pudo evaluar planes superados para desactivar:', (e as Error).message);
      return 0;
    }
  }, [desactivarPlanGrupo]);

  const [planActivoPendienteConfirmacion, setPlanActivoPendienteConfirmacion] = useState<{ planes: PlanGrupo[]; needsFrescos: UnifiedNeedRow[] } | null>(null);
  const [isEjecutandoModificacionAutomatica, setIsEjecutandoModificacionAutomatica] = useState(false);

  // Caso A — "Modificar Plan Activo": evaluado automáticamente desde handleProcessResumen cuando
  // el usuario audita fechas ya vencidas/de hoy. Si hay PlanGrupo P3 activos (creados en un día
  // anterior a hoy) cuyo rango cubre alguna fecha seleccionada, NO se ejecuta directo: se deja en
  // planActivoPendienteConfirmacion para que el usuario confirme explícitamente en el diálogo antes
  // de reconciliar y desactivar (ver handleConfirmarModificacionAutomaticaPlanActivo).
  const evaluarModificacionAutomaticaPlanActivo = useCallback(async (needsFrescos: UnifiedNeedRow[]) => {
    if (selectedDates.size < 1) return;
    try {
      const fechasSeleccionadas = Array.from(selectedDates);
      const todayStr = format(new Date(), 'yyyy-MM-dd');
      const planesRes = await planGrupoService.getAll();
      const planesCandidatos = filtrarPlanesP3ActivosQueCubren(planesRes.data || [], fechasSeleccionadas, todayStr);

      // No-op silencioso: si ya se desactivó en un click previo, no vuelve a aparecer aquí.
      if (planesCandidatos.length === 0) return;

      setPlanActivoPendienteConfirmacion({ planes: planesCandidatos, needsFrescos });
    } catch (e) {
      addNotification('error', `No se pudo evaluar la modificación automática del plan activo: ${(e as Error).message}. La auditoría de necesidades sí se actualizó.`);
    }
  }, [selectedDates, addNotification]);

  // Ejecuta la reconciliación + desactivación de los PlanGrupo que el usuario confirmó en el
  // diálogo (ver evaluarModificacionAutomaticaPlanActivo). Reconcilia y guarda EN SITIO (mismo
  // codigo_plan_grupo) cada plan y lo marca inactivo. No crea un plan nuevo ni toca
  // Provisionales/FERT.
  const handleConfirmarModificacionAutomaticaPlanActivo = useCallback(async () => {
    if (!planActivoPendienteConfirmacion) return;
    const { planes: planesCandidatos, needsFrescos } = planActivoPendienteConfirmacion;
    setIsEjecutandoModificacionAutomatica(true);
    try {
      const user = typeof window !== 'undefined' ? JSON.parse(localStorage.getItem('user') || '{}') : {};
      const usuario = user?.name || 'admin';
      const salidaBase = computeRespuestaSalidaRows(needsFrescos, materialNecesidadesPlantaMap, materialOrigenesPlantaMap);

      let tActualizados = 0, tAgregados = 0, tEliminados = 0, tFallidos = 0;
      const codigosOk: number[] = [];

      for (const plan of planesCandidatos) {
        try {
          const rows = await reconciliarDetallesParaPlan(plan, salidaBase, needsFrescos);
          const r = await persistirFilasEditables(plan.codigo_plan_grupo, rows, usuario);
          tActualizados += r.actualizados;
          tAgregados += r.agregados;
          tEliminados += r.eliminados;
          tFallidos += r.fallidos;
          await desactivarPlanGrupo(plan);
          codigosOk.push(plan.codigo_plan_grupo);
        } catch (e) {
          tFallidos++;
          console.warn(`[Modificar Plan Activo] Falló Plan Grupo #${plan.codigo_plan_grupo}:`, (e as Error).message);
        }
      }

      if (codigosOk.length > 0) {
        await fetchNecesidadesPlanta();
        const detalleTxt = `${tActualizados} modificados, ${tAgregados} agregados, ${tEliminados} eliminados`;
        const plural = codigosOk.length > 1;
        if (tFallidos === 0) {
          addNotification('success', `Modificación automática de plan activo: Plan${plural ? 'es' : ''} Grupo #${codigosOk.join(', #')} desactivado${plural ? 's' : ''} (fecha vencida/hoy). Detalle: ${detalleTxt}.`);
        } else {
          addNotification('warning', `Modificación automática con errores: ${detalleTxt}, ${tFallidos} fallidos. Plan${plural ? 'es' : ''} #${codigosOk.join(', #')} desactivado${plural ? 's' : ''}.`);
        }
      }
    } catch (e) {
      addNotification('error', `No se pudo completar la modificación automática del plan activo: ${(e as Error).message}. La auditoría de necesidades sí se actualizó.`);
    } finally {
      setIsEjecutandoModificacionAutomatica(false);
      setPlanActivoPendienteConfirmacion(null);
    }
  }, [planActivoPendienteConfirmacion, materialNecesidadesPlantaMap, materialOrigenesPlantaMap, reconciliarDetallesParaPlan, persistirFilasEditables, desactivarPlanGrupo, fetchNecesidadesPlanta, addNotification]);

  const handleProcessResumen = useCallback(async () => {
    // Ambos turnos en "VACÍO" (default desde ahora) significa que todavía no se definió capacidad
    // operativa para ningún horario — bloquea y pide escoger antes de generar (Gestión de Tiempos).
    if (selectedDiaShift === 'EMPTY' && selectedNocheShift === 'EMPTY') {
      addNotification('warning', 'Escoja un horario de Turno Día y/o Turno Noche (Gestión de Tiempos) antes de generar necesidades.');
      return;
    }
    if (filteredOrders.length === 0 && filteredFertOrders.length === 0) {
      setUnifiedNeeds([]);
      return;
    }

    setIsProcessingResumen(true);
    // Órdenes Provisionales (Provisionales + 014-Provisional) ya no participan en absoluto en este
    // cálculo: su cantidad nunca alimenta necesidad (NEC. PLANTA [Kg] / P2 la reemplazó por completo)
    // y su rol de "descubrir" materiales quedó cubierto por p2OnlyCodes (más abajo), que no depende de
    // que exista o no una orden Provisional. El tab "Provisionales" sigue existiendo solo como
    // auditoría manual de la data cruda SAP, desconectado de este flujo.
    const materialGroupsHalb = new Map<string, number>();
    filteredFertOrders.forEach(order => {
      // Los responsables de RESP_PRODUCCION_DIARIA (014/031) no aportan a la necesidad OF_HALB: sus
      // corridas ya se reflejan aparte en las columnas informativas "Producción Diaria" (ver
      // materialGroupsProd014) — contarlas también acá las duplicaría.
      const responsable = getProp(order, ['RESPCTRLPROD', 'RESP_CONTROL_PROD', 'RESPCONTROLPROD', 'RespControlProd', 'RESPONSABLE']).trim();
      if (RESP_PRODUCCION_DIARIA.includes(responsable)) return;
      const matRaw = getProp(order, ['MATERIAL', 'CodMaterial']).trim();
      const match = matRaw.match(/^(\d+)/);
      const matCode = match ? match[1] : matRaw;
      if (!matCode) return;
      const orderQty = safeNum(getProp(order, ['CANTPENDIENTE', 'CANTPROGRAMADA', 'CANTIDAD']));
      materialGroupsHalb.set(matCode, (materialGroupsHalb.get(matCode) || 0) + orderQty);
    });

    // allMaterials (universo a explotar por BOM) solo viene de OF_HALB (Fert): es la única necesidad
    // real, aparte de P2, que sigue requiriendo explosión BOM completa para descubrir sus componentes.
    const allMaterials = Array.from(new Set([...materialGroupsHalb.keys()]));
    // Descripción por código de material (desde inventario SAP) — única fuente disponible de
    // descripción para materiales P2-only, ya que DetalleTactico (P2) no trae descripción propia.
    // Se necesita ANTES de armar p2OnlyCodes: sirve para filtrar solo materiales "LAMINA CILINDRICA"
    // (rollos laminados) — este módulo es exclusivo de Corte y Laminado, y P2 (materialNecesidadesPlantaMap)
    // trae la necesidad de TODA la demanda de Forros/Venta Externa/Muebles hacia este grupo, no solo la
    // de rollos laminados. Sin este filtro, materiales de otra naturaleza que esas áreas piden a
    // Laminado (ninguno debería, pero el dato de P2 no lo garantiza) se colarían como filas del resumen.
    const materialDescByCode = new Map<string, string>();
    inventarioSAP.forEach(inv => {
      const code = cleanCode(inv.MATERIAL);
      if (code && !materialDescByCode.has(code)) {
        materialDescByCode.set(code, String(inv.NOMBRE || inv.DESCRIPCION || '').toUpperCase());
      }
    });
    // Materiales con necesidad P2 (NEC. PLANTA) real, de tipo LAMINA CILINDRICA, que no aparecen como
    // componente de ninguna orden FERT: sin este camino, su necesidad P2 se calculaba pero nunca
    // llegaba a generar fila en el resumen (quedaba fuera de toda corrida/plan en silencio). Se
    // auto-explotan por su propio código para ubicar su BLOQUE FORMULADO/densidad/peso.
    const p2OnlyCodes = Array.from(materialNecesidadesPlantaMap.keys())
      .filter(code => (materialNecesidadesPlantaMap.get(code) || 0) > 0)
      .filter(code => !allMaterials.includes(code))
      .filter(code => (materialDescByCode.get(code) || '').includes('LAMINA CILINDRICA'));
    const totalToProcess = allMaterials.length + p2OnlyCodes.length;
    setResumenProgress({ current: 0, total: totalToProcess });
    const consolidatedMap = new Map<string, UnifiedNeedRow>();

    // Cache de explosiones por material propio (Fert=el material en sí, no un padre que lo consume).
    // Necesario porque BLOQUE FORMULADO (densidad/apertura reales) de un componente SOLO aparece en
    // LA EXPLOSIÓN DE SU PROPIO CÓDIGO -- la respuesta del servicio para un Fert dado trae únicamente
    // hijos DIRECTOS de ese Fert, nunca nietos. Antes se buscaba dentro del rawData del padre/orden
    // FERT que descubrió el componente (que estructuralmente NUNCA podía contener esa relación), así
    // que la apertura resultante dependía de qué material lo descubriera primero cada día -- a veces
    // vía P2-only (que sí auto-explota el propio código y encuentra el bloque real), a veces vía una
    // orden FERT real (que no) -- dando resultados inestables día a día para el MISMO material físico
    // (caso real reportado: "D19 PL AF"/"D22 BL"/"D15 AM AF" apareciendo divididos en dos corridas
    // -- "—" y un valor real -- de un día para otro sin que cambiara ningún criterio de agrupación).
    const explosionCache = new Map<string, MaterialExplosionRow[]>();
    const getExplosion = async (code: string): Promise<MaterialExplosionRow[]> => {
      if (explosionCache.has(code)) return explosionCache.get(code)!;
      let rows: MaterialExplosionRow[] = [];
      try {
        const response = await serviciosService.getMaestroMaterialesExplosion("1000", code.padStart(18, '0'), 1, 500);
        const data: MaterialExplosionRow[] = response?.data?.data || response?.data || [];
        rows = Array.isArray(data) ? data : [];
      } catch (e) {
        console.warn(`Error explotando material propio ${code}:`, (e as Error).message);
      }
      explosionCache.set(code, rows);
      return rows;
    };

    // Construye/mergea la fila de un componente (compCode) en consolidatedMap. Se usa tanto para
    // los componentes "LAMINA CILINDRICA" normales (hijos de un FERT explotado) como para materiales
    // P2 auto-explotados, donde compCode/desc corresponden al material mismo.
    const addComponentRow = async (
      compCode: string,
      desc: string,
      qtyHalb: number,
      cantUnitaria: number
    ) => {
      const kgHalb = qtyHalb * cantUnitaria;

      if (consolidatedMap.has(compCode)) {
        const existingRow = consolidatedMap.get(compCode)!;
        existingRow.consumoKgHalb += kgHalb;
        existingRow.totalConsumoKg = existingRow.consumoKg + existingRow.consumoKgHalb;
        // FERT units contribution also needed for total rollos calculation
        const rollosContributionHalb = existingRow.peso > 0 ? kgHalb / existingRow.peso : 0;
        existingRow.nroRollosHalb += rollosContributionHalb;
        return;
      }

      const isConvRow = desc.includes('CONV') || desc.includes('CV');

      // Las variantes CONV no se cortan directo de un BLOQUE FORMULADO: se producen consumiendo
      // la lámina base (otra máquina, nivel posterior). Por eso, para heredar la MISMA apertura/
      // densidad/distancia que su lámina base (y así caer en el mismo bloque de corridas), se ubica
      // primero esa lámina base en la explosión DEL PROPIO CONV: la fila donde MATERIAL_PADRE =
      // código CONV y el componente es otra "LAMINA CILINDRICA" (no CONV).
      let baseLaminaRow: MaterialExplosionRow | null | undefined = null;
      if (isConvRow) {
        const ownExplosion = await getExplosion(compCode);
        baseLaminaRow = ownExplosion.find(r => {
          const rDesc = (r.DESCRIPCION_COMPONENTE || '').toUpperCase();
          return cleanCode(r.MATERIAL_PADRE) === compCode &&
            rDesc.includes('LAMINA CILINDRICA') &&
            !rDesc.includes('CONV') && !rDesc.includes('CV');
        });
      }

      const dimsSourceCode = baseLaminaRow ? cleanCode(baseLaminaRow.COMPONENTE) : compCode;
      const dimsSourceDesc = baseLaminaRow ? String(baseLaminaRow.DESCRIPCION_COMPONENTE || '').toUpperCase() : desc;

      // El "nivel superior" del CONV (su lámina base) puede no tener necesidad propia este ciclo --
      // sin FERT ni P2 propios, nunca se descubriría por ninguna de las 2 vías normales y quedaría
      // invisible en el resumen, aunque el CONV sí dependa físicamente de ella (confirmado por el
      // usuario con un caso real: 30004574 desaparecía del grupo "D22 BL-219" mientras su CONV
      // 30004576 sí aparecía). Se fuerza su fila con necesidad 0 -- solo para que quede visible como
      // referencia del material compartido, sin inventar ninguna cantidad.
      if (baseLaminaRow && !consolidatedMap.has(dimsSourceCode)) {
        await addComponentRow(dimsSourceCode, dimsSourceDesc, 0, 0);
      }

      const blockExplosion = await getExplosion(dimsSourceCode);
      const blockComp = blockExplosion.find(r =>
        cleanCode(r.MATERIAL_PADRE) === dimsSourceCode &&
        (r.DESCRIPCION_COMPONENTE || '').toUpperCase().includes('BLOQUE FORMULADO')
      );

      const blockDesc = blockComp ? String(blockComp.DESCRIPCION_COMPONENTE).toUpperCase() : '';
      const dims = parseDimensionsEnhanced(desc);
      const dimsSource = baseLaminaRow ? parseDimensionsEnhanced(dimsSourceDesc) : dims;
      const blockDims = blockDesc ? parseDimensionsEnhanced(blockDesc) : null;
      const finalDens = blockDims && blockDims.densidad !== '—' ? blockDims.densidad : dimsSource.densidad;
      const finalAperture = blockDesc ? extractAperture(blockDesc) : extractAperture(dimsSourceDesc);
      const finalDistancia = blockDims && blockDims.distancia > 0 ? blockDims.distancia : dimsSource.distancia;

      {
        const pesoTeorico = (finalDistancia * dims.altura * dims.espesor * safeNum(finalDens)) / 10000;
        const looperMatch = kpiLooperData.find(k => cleanCode(k.Material) === compCode);
        const finalPeso = looperMatch ? safeNum(looperMatch.PesoUN) : pesoTeorico;

        const getStockKg = (alm: string) => {
          return inventarioSAP
            .filter(inv => cleanCode(inv.MATERIAL) === compCode && String(inv.ALMACEN).trim() === alm)
            .reduce((sum, item) => sum + safeNum(item.LIBREUTILIZACION), 0);
        };

        const s1006 = getStockKg('1006');
        const s1008 = getStockKg('1008');
        const s1015 = getStockKg('1015');
        const tStockKg = s1006 + s1008 + s1015;
        const tStockUN = finalPeso > 0 ? tStockKg / finalPeso : 0;

        consolidatedMap.set(compCode, {
          material: compCode,
          descripcion: desc,
          densidad: finalDens,
          altura: dims.altura,
          espesor: dims.espesor,
          distancia: finalDistancia,
          peso: finalPeso,
          consumoKg: 0,
          consumoUn: 0,
          nroRollos: 0,
          consumoKgHalb: kgHalb,
          nroRollosHalb: 0,
          totalConsumoKg: kgHalb,
          totalNroRollos: 0,
          stock1006: s1006,
          stock1008: s1008,
          stock1015: s1015,
          stockUN1006: finalPeso > 0 ? s1006 / finalPeso : 0,
          stockUN1008: finalPeso > 0 ? s1008 / finalPeso : 0,
          stockUN1015: finalPeso > 0 ? s1015 / finalPeso : 0,
          totalStockKg: tStockKg,
          totalStockUN: tStockUN,
          prodDiariaKg: 0,
          prodDiariaUn: 0,
          looperPesoUN: looperMatch ? safeNum(looperMatch.PesoUN) : 0,
          looperDensidad: looperMatch ? String(looperMatch.Densidad) : '—',
          looperEspesor: looperMatch ? safeNum(looperMatch.Espesor) : 0,
          looperTRolloMin: looperMatch ? safeNum(looperMatch.TiempoRolloMin) : 0,
          apertura: finalAperture,
          porcentajeNecesidad: 0,
          planUn: 0,
          planKg: 0,
          tProceso: 0,
          hasDeficit: false,
          unidades: 0, // Ya no hay fuente PROV; ver tile "PROV:"/"HALB:" (línea ~2400) a revisar aparte
          bomParentMaterial: baseLaminaRow ? dimsSourceCode : undefined,
          runsRecomendado: 0,
          necVentaExternaKg: 0,
          necVentaExternaUn: 0
        });
      }
    };

    for (let i = 0; i < allMaterials.length; i++) {
      const matCode = allMaterials[i];
      const qtyHalb = materialGroupsHalb.get(matCode) || 0;

      try {
        const rawData = await getExplosion(matCode);
        // El servicio de explosión, para un material INTERMEDIO (ej. un acolchado usado en varios
        // colchones), devuelve una fila DUPLICADA por cada producto final (FERT_PRINCIPAL) que lo
        // consume en algún punto de su árbol -- no una sola relación matCode->componente. Verificado
        // en vivo: MATERIAL_PADRE siempre es matCode (relación directa de 1 nivel) y CANTIDAD_UNITARIA
        // es CONSTANTE entre esas filas duplicadas; CANTIDAD_ACUMULADA en cambio varía porque acarrea
        // el acumulado desde CADA producto final distinto, ajeno al pedido real de matCode. Sumar
        // CANTIDAD_ACUMULADA de cada duplicado (como se hacía antes) multiplicaba la necesidad real
        // por la cantidad de productos finales que comparten el componente (caso real: 30004186
        // pasó de 101.572 Kg a ~980 Kg, un material compartido por 64 variantes de colchón).
        const laminaRowsByComponente = new Map<string, MaterialExplosionRow>();
        rawData.forEach(row => {
          if (!(row.DESCRIPCION_COMPONENTE || '').toUpperCase().includes('LAMINA CILINDRICA')) return;
          const compCode = cleanCode(row.COMPONENTE);
          if (EXCLUDED_LAMINA_MATERIALS.has(compCode)) return;
          if (!laminaRowsByComponente.has(compCode)) laminaRowsByComponente.set(compCode, row);
        });

        for (const comp of laminaRowsByComponente.values()) {
          const compCode = cleanCode(comp.COMPONENTE);
          const desc = String(comp.DESCRIPCION_COMPONENTE || '').toUpperCase();
          const cantUnitaria = safeNum(comp.CANTIDAD_UNITARIA || comp.CANTIDAD_ACUMULADA || 0);
          await addComponentRow(compCode, desc, qtyHalb, cantUnitaria);
        }
      } catch (e) {
        console.warn(`Error material ${matCode}:`, (e as Error).message);
      }
      setResumenProgress({ current: i + 1, total: totalToProcess });
    }

    // Materiales con necesidad P2 sin ningún pedido FERT que los explote como componente: se
    // auto-explotan por su propio código (fullCode = su propio material) para ubicar su BLOQUE
    // FORMULADO/densidad/apertura/peso. La cantidad (NEC. PLANTA [Kg]) se inyecta después, en
    // finalArray, vía materialNecesidadesPlantaMap — aquí solo se garantiza que la fila exista.
    for (let k = 0; k < p2OnlyCodes.length; k++) {
      const matCode = p2OnlyCodes[k];
      if (!consolidatedMap.has(matCode)) {
        const desc = (materialDescByCode.get(matCode) || '').toUpperCase();
        try {
          await addComponentRow(matCode, desc, 0, 1);
        } catch (e) {
          console.warn(`Error material P2 ${matCode}:`, (e as Error).message);
        }
      }
      setResumenProgress({ current: allMaterials.length + k + 1, total: totalToProcess });
    }

    const finalArray = Array.from(consolidatedMap.values()).map(row => {
      // Órdenes Provisionales (incl. 014) YA NO participan en este cálculo ni en el descubrimiento de
      // filas (ver comentario al inicio de handleProcessResumen): el nivel superior "018" que las
      // generaba está migrado por completo a P2 (Venta Externa - Rollos) — verificado con datos reales
      // (material 30012660 tenía 570 Kg en P2 y 1920 Kg adicionales en OF_PROV-014 del mismo origen,
      // que hoy ya no se suman). NEC. PLANTA [Kg] (materialNecesidadesPlantaMap, el P2 real del área de
      // origen — Forros/Venta Externa/Muebles) es la única fuente de necesidad. Un material sin P2
      // activo de su área queda
      // en 0 aquí hasta que esa área genere el suyo — transición esperada mientras las 3 áreas migran,
      // no un bug. row.consumoKg (la explosión BOM original) se sigue calculando arriba solo para
      // descubrir QUÉ materiales existen (dims, bloque, peso) — no se usa como cantidad de necesidad.
      const necPlantaKg = materialNecesidadesPlantaMap.get(String(Number(row.material))) || 0;
      const consumoKg = necPlantaKg;
      const cUn = row.peso > 0 ? consumoKg / row.peso : 0;
      const cUnHalb = row.peso > 0 ? row.consumoKgHalb / row.peso : 0;
      // Un proceso físico no puede cortar una fracción de rollo: la necesidad total del ítem se
      // redondea hacia arriba al rollo completo (mismo criterio y epsilon que deficitRealUN) ANTES de
      // sumarla por bloque/apertura — de lo contrario, sumar las fracciones crudas y redondear una sola
      // vez al final subestima el total real (ej. 3 + 47 + 19 rollos completos por ítem = 69, pero
      // sumar los Kg fraccionarios y redondear al final da 68.2 → 68).
      const totalNecRollosRaw = cUn + cUnHalb;
      const totalNecRollos = totalNecRollosRaw > 0.001 ? Math.ceil(totalNecRollosRaw - 0.001) : 0;
      // Piso obligatorio de Venta Externa: porción de consumoKg cuyo origen es ese grupo (subconjunto
      // de necPlantaKg, ver materialNecesidadVentaExternaMap). Se redondea hacia arriba al rollo
      // completo con el mismo criterio que deficitRealUN — es el que se cubre exacto en el bloque.
      const necVentaExternaKg = materialNecesidadVentaExternaMap.get(String(Number(row.material))) || 0;
      const necVentaExternaUnRaw = row.peso > 0 ? necVentaExternaKg / row.peso : 0;
      const necVentaExternaUn = necVentaExternaUnRaw > 0.001 ? Math.ceil(necVentaExternaUnRaw - 0.001) : 0;
      // Producción Diaria (responsable "014" en FERT): match directo por código de material contra
      // el resumen (mismo nivel lámina/componente, sin explosión BOM), igual que NEC. PLANTA. Esta
      // SÍ se trata como producción ya realizada/comprometida, por eso suma a stock y no a necesidad.
      // La cantidad de la orden ya viene en Kg. Por rendimiento, si esa cantidad no alcanza el
      // peso real de un rollo completo (item.peso) no se considera producción real: queda en 0
      // (ej. 19.7 Kg contra un rollo real de 27.6 Kg no completa ni una unidad, se descarta).
      const rawProdDiariaKg = materialProd014FertMap.get(String(Number(row.material))) || 0;
      const prodDiariaKg = (row.peso > 0 && rawProdDiariaKg >= row.peso) ? rawProdDiariaKg : 0;
      const prodDiariaUn = row.peso > 0 ? prodDiariaKg / row.peso : 0;
      // T. ROLLOS BODEGAS [Kg]/[Un] = stock de bodegas (1006/1008/1015) + Producción Diaria ya filtrada.
      const totalStockKg = row.totalStockKg + prodDiariaKg;
      const totalStockUN = row.totalStockUN + prodDiariaUn;
      return {
        ...row,
        consumoKg,
        consumoUn: cUn,
        nroRollos: cUn,
        nroRollosHalb: cUnHalb,
        totalConsumoKg: consumoKg + row.consumoKgHalb,
        totalNroRollos: totalNecRollos,
        hasDeficit: totalNecRollos > totalStockUN,
        prodDiariaUn,
        prodDiariaKg,
        totalStockKg,
        totalStockUN,
        necVentaExternaKg,
        necVentaExternaUn
      };
    });
    
    const groupMap = new Map<string, UnifiedNeedRow[]>();
    finalArray.forEach(row => {
      const k = `${row.apertura}|${row.densidad}`;
      if(!groupMap.has(k)) groupMap.set(k, []);
      groupMap.get(k)!.push(row);
    });
    
    groupMap.forEach(items => {
      const standardItems = items.filter(it => !isConvDescripcion(it.descripcion));
      const convItems = items.filter(it => isConvDescripcion(it.descripcion));

      // La participación (porcentajeNecesidad) que reparte el plan/corridas del bloque se calcula
      // solo entre las láminas estándar, y SOLO sobre la porción Forros/Muebles de su necesidad — el
      // piso de Venta Externa (necVentaExternaKg) se cubre exacto y aparte (ver más abajo), no debe
      // diluir ni ser diluido por el % de participación. Las variantes CONV no aportan al total ni
      // reciben participación propia: su necesidad viene del nivel superior (ver más abajo).
      const totalKgGroupFM = standardItems.reduce((s, r) => s + Math.max(0, r.totalConsumoKg - r.necVentaExternaKg), 0);
      standardItems.forEach(row => {
        const kgFM = Math.max(0, row.totalConsumoKg - row.necVentaExternaKg);
        row.porcentajeNecesidad = totalKgGroupFM > 0 ? (kgFM / totalKgGroupFM) : 0;
      });
      convItems.forEach(row => { row.porcentajeNecesidad = 0; });

      // El número de corridas recomendado sale del DÉFICIT REAL agregado del bloque (necesidad − stock
      // ya cubierto, sumado entre todos los materiales — Venta Externa + Forros/Muebles combinados,
      // igual que antes de la separación por origen: cuántas corridas hacen falta no cambia, solo
      // CÓMO se reparte esa bolsa entre los dos tramos, ver más abajo), no de exigir que cada material
      // reciba su % fijo de participación aunque ya tenga stock de sobra. Un material con déficit
      // chico y baja participación ya no "fuerza" corridas completas de más: su déficit real (pocas
      // unidades) cabe dentro de la capacidad de una corrida junto con el de los demás.
      const totalDeficitReal = standardItems.reduce((s, r) => s + deficitRealUN(r), 0);
      const runsNeeded = totalDeficitReal > 0 ? Math.ceil(totalDeficitReal / BLOCK_SIZE) : 0;

      // runsNeeded es la RECOMENDACIÓN automática (impulsada por el déficit real del bloque). El
      // usuario puede decidir un número de corridas distinto para el bloque (corridasManualOverrides):
      // eso NO cambia la recomendación (se conserva en runsRecomendado para referencia en la UI), solo
      // la bolsa efectiva a repartir.
      const blockKey = items[0] ? `${items[0].apertura}|${items[0].densidad}` : '';
      const runsEfectivo = corridasManualOverrides[blockKey] !== undefined ? corridasManualOverrides[blockKey] : runsNeeded;
      items.forEach(row => { row.runsRecomendado = runsNeeded; });

      const totalUnitsInPlan = runsEfectivo * BLOCK_SIZE;

      // TIER 1 — Forros/Muebles (consumo interno): prioridad — se reserva primero y completo de la
      // bolsa del bloque, pero solo lo que el stock NO alcanza a cubrir (deficitForrosMueblesUN). Si
      // la bolsa no alcanza para cubrir todo el déficit F/M del bloque (escasez real), se reparte
      // proporcional al tamaño de cada déficit en vez de repartir "a la baja" en silencio.
      const totalFMBlock = standardItems.reduce((s, r) => s + deficitForrosMueblesUN(r), 0);
      const fmBagDisponible = Math.min(totalFMBlock, totalUnitsInPlan);
      const fmDeficitAlloc = totalFMBlock > 0 && fmBagDisponible >= totalFMBlock
        ? new Map(standardItems.map(r => [r.material, deficitForrosMueblesUN(r)]))
        : redistribuirBolsaBloque(standardItems, fmBagDisponible, deficitForrosMueblesUN);

      // TIER 2 — Venta Externa: ya NO es un piso obligatorio — recibe lo que queda de la bolsa tras
      // cubrir el consumo interno, hasta su propio déficit (deficitVentaExternaUN). Puede quedar corta
      // y aplazarse sin bloquear la corrida ni la aprobación (decisión: prioridad al consumo interno,
      // ver deficitVentaExternaUN/deficitForrosMueblesUN). Mismo criterio de reparto proporcional que
      // TIER 1 si el remanente no alcanza para todos los déficits VE del bloque.
      const totalVEBlock = standardItems.reduce((s, r) => s + deficitVentaExternaUN(r), 0);
      const bolsaRestanteVE = Math.max(0, totalUnitsInPlan - totalFMBlock);
      const veBagDisponible = Math.min(totalVEBlock, bolsaRestanteVE);
      const veAlloc = totalVEBlock > 0 && veBagDisponible >= totalVEBlock
        ? new Map(standardItems.map(r => [r.material, deficitVentaExternaUN(r)]))
        : redistribuirBolsaBloque(standardItems, veBagDisponible, r => deficitVentaExternaUN(r));

      // TIER 3 — sobrante: si la bolsa alcanza para más que ambos déficits combinados (redondeo de
      // BLOCK_SIZE, o un override manual de corridas al alza), el remanente se reparte por
      // participación (porcentajeNecesidad, FM-only) — Venta Externa nunca recibe de más, solo su
      // déficit exacto (no compite por el %, ver comentario de porcentajeNecesidad arriba).
      const sobranteBloque = Math.max(0, bolsaRestanteVE - totalVEBlock);
      const sobranteAlloc = sobranteBloque > 0 ? redistribuirBolsaBloque(standardItems, sobranteBloque) : new Map<string, number>();

      const distribucion = new Map<string, number>(
        standardItems.map(r => [r.material, (fmDeficitAlloc.get(r.material) ?? 0) + (veAlloc.get(r.material) ?? 0) + (sobranteAlloc.get(r.material) ?? 0)])
      );
      standardItems.forEach(row => {
        const key = `${row.material}|${row.apertura}|${row.densidad}`;
        const planUn = planManualOverrides[key] !== undefined ? planManualOverrides[key] : (distribucion.get(row.material) ?? 0);

        row.planUn = planUn;
        row.planKg = planUn * row.peso;
      });

      // El tiempo de preparación (45 min por corrida física: ingreso de bloques + colocar adhesivo,
      // medido en prueba en vivo) se reparte entre los materiales del bloque según su participación
      // REAL en unidades planificadas (PLAN(UN)/total del bloque), no según porcentajeNecesidad (que
      // es en Kg y queda congelado/desalineado si hubo overrides manuales). Así el total de setup del
      // bloque (45 × corridas) sigue cerrando exacto, y queda correcto tras cualquier redistribución manual.
      const totalPlanUnGroup = standardItems.reduce((s, r) => s + r.planUn, 0);
      const corridasBloque = totalPlanUnGroup > 0 ? Math.ceil(totalPlanUnGroup / BLOCK_SIZE) : 0;
      standardItems.forEach(row => {
        const shareUn = totalPlanUnGroup > 0 ? (row.planUn / totalPlanUnGroup) : 0;
        const setupContribution = (corridasBloque > 0) ? (SETUP_TIME_PER_RUN * corridasBloque * shareUn) : 0;
        row.tProceso = ((row.looperTRolloMin || 0) * row.planUn + setupContribution) / 60;
      });

      // Las variantes CONV no corren corrida propia: su necesidad/plan se deriva de la lámina base
      // (proceso "lámina convoluted": 1 lámina base -> 2 láminas CONV del mismo recorrido), no de una
      // participación propia dentro del bloque.
      convItems.forEach(row => {
        const key = `${row.material}|${row.apertura}|${row.densidad}`;
        const parent = row.bomParentMaterial ? standardItems.find(p => p.material === row.bomParentMaterial) : undefined;
        const derivedPlanUn = parent ? Math.round(parent.planUn * CONV_SPLIT_FACTOR) : 0;
        const planUn = planManualOverrides[key] !== undefined ? planManualOverrides[key] : derivedPlanUn;

        row.planUn = planUn;
        row.planKg = planUn * row.peso;
        row.tProceso = ((row.looperTRolloMin || 0) * planUn) / 60;
      });
    });

    // "Modificar Plan Activo": se evalúa con cualquier cantidad de fechas seleccionadas (mínimo 1).
    // Si alguna de ellas ya venció (o es hoy), se evalúan candidatos y se pide confirmación antes de
    // reconciliar/desactivar el Plan Grupo P3 vigente que la cubre (ver
    // evaluarModificacionAutomaticaPlanActivo). Se usa finalArray (variable local, ya completo) en
    // vez de esperar a que unifiedNeeds se refleje en el próximo render. Si son 0 fechas (Plan
    // Maestro) no se evalúa: no hay una fecha puntual contra la cual auditar vencimiento.
    if (selectedDates.size >= 1) {
      const todayStr = format(new Date(), 'yyyy-MM-dd');
      const hayFechaPasadaOHoy = Array.from(selectedDates).some(d => d <= todayStr);
      if (hayFechaPasadaOHoy) {
        await evaluarModificacionAutomaticaPlanActivo(finalArray);
      }
    }

    setUnifiedNeeds(finalArray);
    setIsProcessingResumen(false);
  }, [filteredOrders, filteredFertOrders, materialProd014FertMap, materialNecesidadesPlantaMap, materialNecesidadVentaExternaMap, kpiLooperData, inventarioSAP, extractMaterialInfo, planManualOverrides, corridasManualOverrides, selectedDates, evaluarModificacionAutomaticaPlanActivo, addNotification, selectedDiaShift, selectedNocheShift]);

  // Segunda fase de "Sincronizar y Generar Necesidades" (ver handleSincronizarYGenerar): corre
  // handleProcessResumen automáticamente en cuanto el render que refleja los datos recién
  // sincronizados ya ocurrió — acá arriba, handleProcessResumen ya es la versión fresca (sus
  // dependencias, filteredOrders/filteredFertOrders/etc., ya se recalcularon), a diferencia del punto
  // donde se dispara autoGenerarPendiente, donde llamarlo directo habría leído datos viejos.
  useEffect(() => {
    if (!autoGenerarPendiente) return;
    setAutoGenerarPendiente(false);
    setSyncStep('generando');
    handleProcessResumen().finally(() => {
      setSyncStep('idle');
      setIsLoading(false);
    });
  }, [autoGenerarPendiente, handleProcessResumen]);

  // Recalcula planKg/tProceso de una fila para un planUn dado (misma fórmula usada en handleProcessResumen).
  // setupContribution ya viene calculado por el caller (participación viva en unidades del bloque,
  // no el porcentajeNecesidad congelado — ver comentario en handleUpdatePlanUn); 0 para variantes CONV,
  // que no ocupan cupo de corrida propio.
  const recomputeRowForPlanUn = (row: UnifiedNeedRow, planUn: number, setupContribution: number = 0): UnifiedNeedRow => {
    const planKg = planUn * row.peso;
    const tProceso = ((row.looperTRolloMin || 0) * planUn + setupContribution) / 60;
    return { ...row, planUn, planKg, tProceso };
  };

  // Reparte targetTotal entre items según su peso relativo entre sí (por defecto porcentajeNecesidad,
  // pero puede pesarse por cualquier otra métrica vía weightOf, ej. deficitForrosMueblesUN/
  // deficitVentaExternaUN en TIER 1/2 de handleProcessResumen), cerrando exacto vía redondeo por mayor
  // resto. Usada por la edición manual de corridas por bloque, el reparto automático por prioridad
  // (TIER 1/2/3), y cualquier otro reparto proporcional de una bolsa de unidades.
  const redistribuirBolsaBloque = (
    items: UnifiedNeedRow[],
    targetTotal: number,
    weightOf: (r: UnifiedNeedRow) => number = (r) => r.porcentajeNecesidad
  ): Map<string, number> => {
    const sumWeight = items.reduce((s, r) => s + weightOf(r), 0);
    const raw = items.map(r => {
      const weight = sumWeight > 0 ? (weightOf(r) / sumWeight) : (1 / (items.length || 1));
      return { material: r.material, raw: targetTotal * weight };
    });

    const final = new Map<string, number>();
    raw.forEach(o => final.set(o.material, Math.floor(o.raw)));
    const flooredSum = raw.reduce((s, o) => s + Math.floor(o.raw), 0);
    let remainder = Math.round(targetTotal - flooredSum);
    const byRemDesc = [...raw].sort((a, b) => (b.raw - Math.floor(b.raw)) - (a.raw - Math.floor(a.raw)));
    for (let i = 0; i < byRemDesc.length && remainder > 0; i++) {
      const m = byRemDesc[i].material;
      final.set(m, (final.get(m) || 0) + 1);
      remainder--;
    }
    const byRemAsc = [...byRemDesc].reverse();
    for (let i = 0; i < byRemAsc.length && remainder < 0; i++) {
      const m = byRemAsc[i].material;
      const current = final.get(m) || 0;
      if (current > 0) {
        final.set(m, current - 1);
        remainder++;
      }
    }
    return final;
  };

  // Alterna la aprobación visual del semáforo en rojo con plan ya asignado (ver approvedDeficitRows).
  const toggleAprobarDeficit = (material: string, apertura: string, densidad: string) => {
    const key = `${material}|${apertura}|${densidad}`;
    setApprovedDeficitRows(prev => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key); else next.add(key);
      return next;
    });
  };

  // PLAN (UN) por material es editable libremente e independiente de los demás materiales del bloque
  // (no reparte ninguna "bolsa" fija ni tiene tope contra el total automático): permite corregir a mano
  // incluso un bloque que el cálculo automático dejó en 0 corridas. El total de setup (128 min/corrida)
  // sí se recalcula para TODO el bloque tras la edición, según la participación en unidades vigente
  // (planUn/total del bloque), para que siga cerrando exacto. El número de corridas del bloque
  // (Subtotal/corridas) se ajusta a este único material vía el control de "Corridas" del bloque.
  const handleUpdatePlanUn = (material: string, apertura: string, densidad: string, rawValue: number) => {
    const inGroup = (r: UnifiedNeedRow) => r.apertura === apertura && r.densidad === densidad;
    const editedRowNow = unifiedNeeds.find(r => inGroup(r) && r.material === material);
    const isConvEdit = editedRowNow ? isConvDescripcion(editedRowNow.descripcion) : false;

    const newValue = Math.max(0, Math.round(rawValue) || 0); // nunca negativo
    // Venta Externa ya NO es un piso obligatorio (decisión: prioridad al consumo interno, Venta
    // Externa se puede aplazar) — bajar el PLAN(UN) por debajo del déficit de Venta Externa ya no se
    // corrige ni se bloquea, solo se avisa para que quede claro el trade-off (el déficit sigue visible
    // en el badge "VE: N UN" de la tabla).
    const minimoVE = editedRowNow ? deficitVentaExternaUN(editedRowNow) : 0;
    if (!isConvEdit && editedRowNow && newValue < minimoVE) {
      addNotification('info', `Material ${material}: queda con ${minimoVE - newValue} UN de déficit en Venta Externa — se aplaza, no bloquea la corrida ni la aprobación.`);
    }
    const key = `${material}|${apertura}|${densidad}`;
    setPlanOverrides(prevOv => ({ ...prevOv, [key]: newValue }));

    setUnifiedNeeds(prev => {
      const editedRow = prev.find(r => inGroup(r) && r.material === material);
      if (!editedRow) return prev;

      // Variantes CONV: no ocupan cupo de corrida propio del bloque (se producen en otra máquina a
      // partir de la lámina base ya cortada), por eso su edición es totalmente independiente — no
      // afecta el total/corridas del bloque ni a los demás materiales, y viceversa. Permite, por
      // ejemplo, subir/bajar manualmente su cantidad aunque no tenga corrida propia planificada,
      // apoyándose en stock disponible de la lámina base.
      if (isConvDescripcion(editedRow.descripcion)) {
        return prev.map(row => (row === editedRow) ? recomputeRowForPlanUn(row, newValue, 0) : row);
      }

      const standardGroup = prev.filter(r => inGroup(r) && !isConvDescripcion(r.descripcion));
      const newGroupTotal = standardGroup.reduce((s, r) => s + (r.material === material ? newValue : r.planUn), 0);
      const corridasBloque = newGroupTotal > 0 ? Math.ceil(newGroupTotal / BLOCK_SIZE) : 0;
      const setupFor = (planUn: number) => (corridasBloque > 0 && newGroupTotal > 0)
        ? SETUP_TIME_PER_RUN * corridasBloque * (planUn / newGroupTotal)
        : 0;

      return prev.map(row => {
        if (!inGroup(row)) return row;
        if (row.material === material && !isConvDescripcion(row.descripcion)) {
          return recomputeRowForPlanUn(row, newValue, setupFor(newValue));
        }
        if (!isConvDescripcion(row.descripcion)) {
          return recomputeRowForPlanUn(row, row.planUn, setupFor(row.planUn));
        }
        // La variante CONV hereda automáticamente el plan de su lámina base (proceso alterno: x2),
        // salvo que ella misma tenga una anulación manual propia. No ocupa cupo de corrida propio,
        // por eso no recibe setupContribution (queda en 0, el default).
        if (row.bomParentMaterial === material) {
          const convKey = `${row.material}|${row.apertura}|${row.densidad}`;
          if (planManualOverrides[convKey] === undefined) {
            return recomputeRowForPlanUn(row, Math.round(newValue * CONV_SPLIT_FACTOR));
          }
        }
        return row;
      });
    });

    // Se ofrece redistribuir siempre que la cantidad realmente cambie y haya otros materiales en el
    // bloque con quién redistribuir — cubre tanto "no tenía plan de corrida y se le asigna uno" como
    // "ya tenía plan y se le suma/resta". Nunca automático: requiere acción explícita del usuario
    // sobre el toast (ver redistribuirToast / handleConfirmarCompletarTecho); el toast no bloquea, la
    // edición ya quedó aplicada — si se ignora, el bloque simplemente ajusta sus corridas al nuevo total.
    if (!isConvEdit && editedRowNow && newValue !== editedRowNow.planUn) {
      const standardGroupNow = unifiedNeeds.filter(r => inGroup(r) && !isConvDescripcion(r.descripcion));
      if (standardGroupNow.length > 1) {
        const currentTotal = standardGroupNow.reduce((s, r) => s + r.planUn, 0);
        const othersSum = standardGroupNow.reduce((s, r) => s + (r.material === material ? 0 : r.planUn), 0);
        const techoActual = currentTotal > 0 ? Math.ceil(currentTotal / BLOCK_SIZE) * BLOCK_SIZE : 0;
        const techoNuevo = (othersSum + newValue) > 0 ? Math.ceil((othersSum + newValue) / BLOCK_SIZE) * BLOCK_SIZE : 0;
        setRedistribuirToast({ material, apertura, densidad, editedValue: newValue, techoActual, techoNuevo });
      }
    }
  };

  // Aplica la redistribución que el usuario confirmó desde redistribuirToast: reparte SOLO entre los
  // demás materiales estándar del bloque (proporcional a su participación entre sí), dejando intacto
  // el valor que el usuario acaba de escribir para el material editado.
  const handleConfirmarCompletarTecho = () => {
    const pending = redistribuirToast;
    if (!pending) return;
    const { material, apertura, densidad, editedValue, techoNuevo } = pending;

    setUnifiedNeeds(prev => {
      const inGroup = (r: UnifiedNeedRow) => r.apertura === apertura && r.densidad === densidad;
      const standardGroup = prev.filter(r => inGroup(r) && !isConvDescripcion(r.descripcion));
      const others = standardGroup.filter(r => r.material !== material);
      if (others.length === 0) return prev;

      const targetOthersTotal = Math.max(0, techoNuevo - editedValue);
      // Reparto proporcional simple entre "others" — Venta Externa ya no tiene un piso obligatorio que
      // proteger aquí (puede quedar corta y aplazarse, ver deficitVentaExternaUN).
      const distribution = redistribuirBolsaBloque(others, targetOthersTotal);

      setPlanOverrides(prevOv => {
        const next = { ...prevOv };
        others.forEach(r => {
          next[`${r.material}|${r.apertura}|${r.densidad}`] = distribution.get(r.material) ?? r.planUn;
        });
        return next;
      });

      const actualOthersTotal = others.reduce((s, r) => s + (distribution.get(r.material) ?? 0), 0);
      const newGroupTotal = editedValue + actualOthersTotal;
      const corridasBloque = newGroupTotal > 0 ? Math.ceil(newGroupTotal / BLOCK_SIZE) : 0;
      const setupFor = (planUn: number) => (corridasBloque > 0 && newGroupTotal > 0)
        ? SETUP_TIME_PER_RUN * corridasBloque * (planUn / newGroupTotal)
        : 0;

      return prev.map(row => {
        if (!inGroup(row)) return row;
        if (row.material === material && !isConvDescripcion(row.descripcion)) {
          return recomputeRowForPlanUn(row, editedValue, setupFor(editedValue));
        }
        if (!isConvDescripcion(row.descripcion)) {
          const v = distribution.get(row.material) ?? row.planUn;
          return recomputeRowForPlanUn(row, v, setupFor(v));
        }
        if (row.bomParentMaterial) {
          const parentValue = row.bomParentMaterial === material ? editedValue : distribution.get(row.bomParentMaterial);
          const convKey = `${row.material}|${row.apertura}|${row.densidad}`;
          if (parentValue !== undefined && planManualOverrides[convKey] === undefined) {
            return recomputeRowForPlanUn(row, Math.round(parentValue * CONV_SPLIT_FACTOR));
          }
        }
        return row;
      });
    });

    addNotification('success', `Bloque ${apertura}/${densidad}: corrida completada a ${techoNuevo.toLocaleString()} UN, capacidad redistribuida entre los demás materiales.`);
    setRedistribuirToast(null);
  };

  const handleDescartarCompletarTecho = () => setRedistribuirToast(null);

  // Auto-descarte del toast de redistribución tras 8s si el usuario no interactúa — no bloquea el
  // flujo, y evita que se acumule si el usuario sigue editando otros materiales.
  useEffect(() => {
    if (!redistribuirToast) return;
    const timer = setTimeout(() => setRedistribuirToast(null), 8000);
    return () => clearTimeout(timer);
  }, [redistribuirToast]);

  // Control de "Corridas" a nivel de bloque (independiente de PLAN(UN) por material): el usuario
  // decide un número de corridas distinto al recomendado por el algoritmo de déficit (runsRecomendado)
  // — por ejemplo, bajar de 3 a 1 corrida, o subir de 1 a 2 — y el sistema redistribuye
  // proporcionalmente (según porcentajeNecesidad) las cantidades entre los materiales estándar del
  // bloque para que sumen exactamente corridas × BLOCK_SIZE. Si el usuario vuelve a poner el valor
  // recomendado, se limpia el override y el bloque vuelve a modo 100% automático.
  const handleUpdateCorridasBloque = (apertura: string, densidad: string, rawCorridas: number) => {
    const newCorridas = Math.max(0, Math.round(rawCorridas) || 0);
    const blockKey = `${apertura}|${densidad}`;

    setUnifiedNeeds(prev => {
      const inGroup = (r: UnifiedNeedRow) => r.apertura === apertura && r.densidad === densidad;
      const standardGroup = prev.filter(r => inGroup(r) && !isConvDescripcion(r.descripcion));
      if (standardGroup.length === 0) return prev;

      const isBackToAuto = newCorridas === standardGroup[0].runsRecomendado;
      const newTotal = newCorridas * BLOCK_SIZE;
      // Reparto proporcional simple — Venta Externa ya no tiene un piso obligatorio que proteger aquí
      // (puede quedar corta y aplazarse). El feedback inmediato aquí es proporcional por participación;
      // handleProcessResumen sigue siendo la fuente de verdad (TIER 1/2/3) al reprocesar.
      const distribution = redistribuirBolsaBloque(standardGroup, newTotal);

      setPlanOverrides(prevOv => {
        const next = { ...prevOv };
        standardGroup.forEach(r => {
          const k = `${r.material}|${r.apertura}|${r.densidad}`;
          if (isBackToAuto) {
            delete next[k];
          } else {
            next[k] = distribution.get(r.material) ?? r.planUn;
          }
        });
        return next;
      });

      setCorridasOverrides(prevOv => {
        const next = { ...prevOv };
        if (isBackToAuto) {
          delete next[blockKey];
        } else {
          next[blockKey] = newCorridas;
        }
        return next;
      });

      const actualTotal = standardGroup.reduce((s, r) => s + (distribution.get(r.material) ?? 0), 0);
      const corridasBloque = actualTotal > 0 ? Math.ceil(actualTotal / BLOCK_SIZE) : 0;
      const setupFor = (planUn: number) => (corridasBloque > 0 && actualTotal > 0)
        ? SETUP_TIME_PER_RUN * corridasBloque * (planUn / actualTotal)
        : 0;

      return prev.map(row => {
        if (!inGroup(row)) return row;
        if (!isConvDescripcion(row.descripcion)) {
          const v = distribution.get(row.material) ?? row.planUn;
          return recomputeRowForPlanUn(row, v, setupFor(v));
        }
        if (row.bomParentMaterial) {
          const parentNewPlan = distribution.get(row.bomParentMaterial);
          const convKey = `${row.material}|${row.apertura}|${row.densidad}`;
          if (parentNewPlan !== undefined && planManualOverrides[convKey] === undefined) {
            return recomputeRowForPlanUn(row, Math.round(parentNewPlan * CONV_SPLIT_FACTOR));
          }
        }
        return row;
      });
    });

    addNotification('info', `Bloque ${apertura}/${densidad}: corridas ajustadas a ${newCorridas} — cantidades redistribuidas automáticamente entre los materiales del bloque.`);
  };

  // Sección dos del tab Resumen — "Simulación Salida de Datos por Respuesta": toma como universo
  // los materiales que "Necesidades Planta" referencia (match por código contra Resumen Necesidades
  // — materialNecesidadesPlantaMap), y responde por cada uno con lo que YA está planificado en
  // corrida (planKg/planUn) MÁS el stock disponible (totalStockKg/totalStockUN, que ya incluye
  // bodegas + Producción Diaria) — la corrida no reemplaza el stock ya existente, se suma a él,
  // porque ambos van a estar físicamente disponibles. Sin corrida prevista, la respuesta es solo el
  // stock (mismo criterio de computeRespuestaSalidaRows, la versión en función pura de este cálculo).
  const respuestaSalidaRows = useMemo((): RespuestaSalidaRow[] => {
    return unifiedNeeds
      .filter(u => materialNecesidadesPlantaMap.has(String(Number(u.material))))
      .map((u): RespuestaSalidaRow => {
        const tieneCorrida = u.planUn > 0;
        const origenesMap = materialOrigenesPlantaMap.get(String(Number(u.material)));
        const origenes = origenesMap && origenesMap.size > 0 ? Array.from(origenesMap.keys()).join(', ') : '—';
        return {
          material: u.material,
          descripcion: u.descripcion,
          tieneCorrida,
          cantidadKg: u.totalStockKg + (tieneCorrida ? u.planKg : 0),
          cantidadUn: u.totalStockUN + (tieneCorrida ? u.planUn : 0),
          origenes,
        };
      })
      .sort((a, b) => Number(a.tieneCorrida) - Number(b.tieneCorrida));
  }, [unifiedNeeds, materialNecesidadesPlantaMap, materialOrigenesPlantaMap]);

  // Paso 1: arma la vista previa de lo que se va a grabar (PlanGrupo + materiales) y abre el
  // diálogo de confirmación. No llama a ningún servicio todavía. Los materiales a guardar salen de
  // la sección dos del tab Resumen — "Simulación Salida de Datos por Respuesta" (respuestaSalidaRows):
  // con corrida = cantidad planificada, sin corrida = stock disponible.
  const handleOpenGuardarPlan = useCallback(() => {
    const rowsToSave = respuestaSalidaRows.filter(row => row.cantidadKg > 0);
    if (rowsToSave.length === 0) {
      addNotification('warning', 'No hay materiales con cantidad (plan o stock) para guardar.');
      return;
    }

    // El P3 es la RESPUESTA del día siguiente HÁBIL a la revisión: sin importar qué fechas estén
    // marcadas en el calendario del módulo (esas son el rango de producción, no la fecha de la
    // respuesta), su fecha_inicio_plan/fecha_fin_plan se fuerza siempre al próximo día laborable (no
    // simplemente hoy+1 calendario, que caía en sábado/domingo si hoy era viernes/sábado).
    const fechaRespuesta = format(siguienteDiaHabil(new Date()), 'yyyy-MM-dd');

    setPlanPreview({
      codigo_grupo: CODIGO_GRUPO_LAMINADO,
      nombreGrupo: 'Corte y Laminado (Centro 1000)',
      // Sufijo "Rollos" — igual que el P2 ya distingue "P2 - Rollos" de "P2 - Espumas", y necesario
      // porque codigo_grupo=8 ahora es compartido con la Respuesta P3/PFD de Corte Espuma (ambos
      // responden como el mismo grupo SAP, ver conversación). Sin el sufijo, un P3 de Laminado y uno
      // de Espuma para el mismo centro/fecha son indistinguibles por el valor — y desactivarPlanesLaminadoSuperados
      // depende de este sufijo para no tocar los planes de Espuma (ver ahí).
      valor: 'Plan Táctico - Centro 1000 - P3 - Rollos',
      fechaInicio: fechaRespuesta,
      fechaFin: fechaRespuesta,
      rows: rowsToSave,
    });
  }, [respuestaSalidaRows, addNotification, siguienteDiaHabil]);

  // Paso 2: el usuario confirmó en el diálogo. Crea un único PlanGrupo (grupo 8 = Corte y Laminado
  // Centro 1000) y, por cada material con plan asignado, uno o más DetalleTactico: codigo_plan_grupo
  // es siempre el nuevo plan de Laminado (dueño del registro), pero codigo_plan_grupo_padre es el
  // plan ORIGEN de la necesidad (la otra área que la generó, según "Necesidades Planta"). Si un
  // material tiene necesidad de varias áreas, el planKg se prorratea entre esos orígenes y se
  // genera una fila por cada uno (ver getOrigenesProrrateo).
  const handleConfirmGuardarPlan = useCallback(async () => {
    if (!planPreview) return;
    setIsSavingPlan(true);
    try {
      const user = typeof window !== 'undefined' ? JSON.parse(localStorage.getItem('user') || '{}') : {};
      const usuario = user?.name || 'admin';

      const planPayload = {
        codigo_plan_grupo: 0,
        codigo_grupo: planPreview.codigo_grupo,
        // No existe ninguna FamiliaProductos para el grupo 8 (Corte y Laminado) en la tabla
        // familia_productos, así que no hay un codigo_familia_producto real que asignar. Se envía
        // null explícito (a diferencia de undefined, que JSON.stringify omite del payload) para
        // probar si la columna es nullable en el backend.
        codigo_familia_grupo: null,
        // Se envía vacío a pedido explícito de negocio (2026-07-15): antes se fijó codigo_plan: 2
        // ("PMP-V-1", único PlanGlobal activo) porque codigo_plan: 3 era una FK inválida y causaba
        // "Foreign key constraint violation" al crear el PlanGrupo. Si el backend todavía exige esa
        // FK sobre plan_global, este guardado volverá a fallar con el mismo error.
        codigo_plan: null,
        valor: planPreview.valor,
        fecha_inicio_plan: planPreview.fechaInicio,
        fecha_fin_plan: planPreview.fechaFin,
        estado: 'A',
        usuario_creacion: usuario,
        // Faltaba en el payload — la columna quedaba NULL en BD (verificado con datos reales).
        fecha_creacion: new Date(),
      };

      const planResponse = await planGrupoService.save(planPayload as unknown as PlanGrupo);
      const nuevoCodigoPlanGrupo = planResponse.data.codigo_plan_grupo;

      let exitosos = 0;
      let fallidos = 0;

      faltanteInternoRef.current = [];
      for (const row of planPreview.rows) {
        const splits = getOrigenesProrrateo(row.material, row.cantidadKg, nuevoCodigoPlanGrupo);
        for (const split of splits) {
          if (split.cantidadKg <= 0) continue;
          try {
            const detallePayload = {
              codigo_detalle_tactico: 0,
              codigo_material: Number(row.material),
              cantidad_produccion_neta: Math.round(split.cantidadKg).toFixed(0),
              resp_ctrl_prod: '',
              clase_aprovisionamiento: 'E',
              cantidad_aprovisionamiento: 0,
              estado: 'A',
              codigo_plan_grupo: nuevoCodigoPlanGrupo,
              codigo_plan_grupo_padre: split.codigoPadre,
              usuario_modificacion: usuario,
              linea_produccion: puestoTrabajoLineaPorMaterial.get(cleanCode(row.material)) || '',
            };
            await detalleTacticoService.save(detallePayload as unknown as DetalleTactico);
            exitosos++;
          } catch (e) {
            console.warn(`[Guardar Plan] Falló material ${row.material} (padre ${split.codigoPadre}):`, (e as Error).message);
            fallidos++;
          }
        }
      }
      flushFaltanteInternoNotification();

      const superados = await desactivarPlanesLaminadoSuperados(CODIGO_GRUPO_LAMINADO, planPreview.fechaInicio, nuevoCodigoPlanGrupo, false);
      const sufijoSuperados = superados > 0 ? ` ${superados} Plan Grupo previo(s) del mismo día o anterior fueron desactivados.` : '';

      if (fallidos === 0) {
        addNotification('success', `Plan guardado: ${exitosos} materiales registrados en el Plan Grupo #${nuevoCodigoPlanGrupo}.${sufijoSuperados}`);
      } else {
        addNotification('warning', `Plan Grupo #${nuevoCodigoPlanGrupo} creado. ${exitosos} materiales guardados, ${fallidos} fallaron.${sufijoSuperados}`);
      }
      fetchNecesidadesPlanta();
      setPlanPreview(null);
    } catch (e) {
      addNotification('error', `Error al guardar el plan: ${(e as Error).message}`);
    } finally {
      setIsSavingPlan(false);
    }
  }, [planPreview, addNotification, fetchNecesidadesPlanta, getOrigenesProrrateo, flushFaltanteInternoNotification, desactivarPlanesLaminadoSuperados, puestoTrabajoLineaPorMaterial]);

  // Variante "PFD" del Paso 1: mismo universo de materiales que "Guardar Plan" (P3), pero los
  // materiales sin corrida ("No — stock", tieneCorrida === false) se fuerzan a cantidad 0 en vez de
  // usar el stock disponible como fallback. Es un PlanGrupo independiente (valor "...- PFD"), no
  // reemplaza ni modifica el plan P3; sirve solo para dejar constancia de qué material quedó sin
  // planificar. A diferencia de "Guardar Plan" no se filtran los materiales en 0: todos entran a la
  // vista previa porque el objetivo es persistirlos igual.
  const handleOpenGuardarPlanPFD = useCallback(() => {
    const rowsToSave = respuestaSalidaRows.map(row => row.tieneCorrida ? row : { ...row, cantidadKg: 0, cantidadUn: 0 });
    if (rowsToSave.length === 0) {
      addNotification('warning', 'No hay materiales para guardar en el Plan PFD.');
      return;
    }

    // Igual que "Guardar Plan" (P3, ver handleOpenGuardarPlan): el PFD es la respuesta del día
    // siguiente HÁBIL a la revisión, no el rango de producción marcado en el calendario del módulo
    // (selectedDates). Antes caía en hoy (o en el rango seleccionado) en vez de hoy+1 día hábil.
    const fechaRespuesta = format(siguienteDiaHabil(new Date()), 'yyyy-MM-dd');

    setPlanPreviewPFD({
      codigo_grupo: CODIGO_GRUPO_LAMINADO,
      nombreGrupo: 'Corte y Laminado (Centro 1000)',
      // Mismo sufijo "Rollos" que el P3 (ver handleOpenGuardarPlan) — necesario para no confundirse
      // con el PFD de Corte Espuma, que ahora comparte codigo_grupo=8.
      valor: 'Plan Táctico - Centro 1000 - PFD - Rollos',
      fechaInicio: fechaRespuesta,
      fechaFin: fechaRespuesta,
      rows: rowsToSave,
    });
  }, [respuestaSalidaRows, addNotification, siguienteDiaHabil]);

  // Paso 2 del plan PFD: mismo PlanGrupo + DetalleTactico que "Guardar Plan", incluyendo el mismo
  // codigo_plan_grupo_padre (origen real vía getOrigenesProrrateo) que usa el flujo P3 — los
  // materiales "No — stock" solo difieren en que su cantidad ya viene forzada a 0 desde
  // handleOpenGuardarPlanPFD, pero el padre reportado debe ser el origen real, no el propio plan PFD
  // (auto-referenciarlo rompía la trazabilidad contra la necesidad que lo generó). A diferencia del
  // guardado normal, aquí SÍ se guarda el registro aunque la cantidad sea 0, ya que el propósito es
  // que el material aparezca en la salida de datos para visualización.
  const handleConfirmGuardarPlanPFD = useCallback(async () => {
    if (!planPreviewPFD) return;
    setIsSavingPlanPFD(true);
    try {
      const user = typeof window !== 'undefined' ? JSON.parse(localStorage.getItem('user') || '{}') : {};
      const usuario = user?.name || 'admin';

      const planPayload = {
        codigo_plan_grupo: 0,
        codigo_grupo: planPreviewPFD.codigo_grupo,
        codigo_familia_grupo: null,
        codigo_plan: null,
        valor: planPreviewPFD.valor,
        fecha_inicio_plan: planPreviewPFD.fechaInicio,
        fecha_fin_plan: planPreviewPFD.fechaFin,
        estado: 'A',
        usuario_creacion: usuario,
        // Faltaba en el payload — la columna quedaba NULL en BD (verificado con datos reales).
        fecha_creacion: new Date(),
      };

      const planResponse = await planGrupoService.save(planPayload as unknown as PlanGrupo);
      const nuevoCodigoPlanGrupo = planResponse.data.codigo_plan_grupo;

      let exitosos = 0;
      let fallidos = 0;

      faltanteInternoRef.current = [];
      for (const row of planPreviewPFD.rows) {
        const splits = getOrigenesProrrateo(row.material, row.cantidadKg, nuevoCodigoPlanGrupo);
        for (const split of splits) {
          if (row.tieneCorrida && split.cantidadKg <= 0) continue;
          try {
            const detallePayload = {
              codigo_detalle_tactico: 0,
              codigo_material: Number(row.material),
              cantidad_produccion_neta: Math.round(split.cantidadKg).toFixed(0),
              resp_ctrl_prod: '',
              clase_aprovisionamiento: 'E',
              cantidad_aprovisionamiento: 0,
              estado: 'A',
              codigo_plan_grupo: nuevoCodigoPlanGrupo,
              codigo_plan_grupo_padre: split.codigoPadre,
              usuario_modificacion: usuario,
              linea_produccion: puestoTrabajoLineaPorMaterial.get(cleanCode(row.material)) || '',
            };
            await detalleTacticoService.save(detallePayload as unknown as DetalleTactico);
            exitosos++;
          } catch (e) {
            console.warn(`[Guardar Plan PFD] Falló material ${row.material} (padre ${split.codigoPadre}):`, (e as Error).message);
            fallidos++;
          }
        }
      }
      flushFaltanteInternoNotification();

      const superados = await desactivarPlanesLaminadoSuperados(CODIGO_GRUPO_LAMINADO, planPreviewPFD.fechaInicio, nuevoCodigoPlanGrupo, true);
      const sufijoSuperados = superados > 0 ? ` ${superados} Plan Grupo previo(s) del mismo día o anterior fueron desactivados.` : '';

      if (fallidos === 0) {
        addNotification('success', `Plan PFD guardado: ${exitosos} materiales registrados en el Plan Grupo #${nuevoCodigoPlanGrupo}.${sufijoSuperados}`);
      } else {
        addNotification('warning', `Plan Grupo PFD #${nuevoCodigoPlanGrupo} creado. ${exitosos} materiales guardados, ${fallidos} fallaron.${sufijoSuperados}`);
      }
      fetchNecesidadesPlanta();
      setPlanPreviewPFD(null);
    } catch (e) {
      addNotification('error', `Error al guardar el plan PFD: ${(e as Error).message}`);
    } finally {
      setIsSavingPlanPFD(false);
    }
  }, [planPreviewPFD, addNotification, fetchNecesidadesPlanta, getOrigenesProrrateo, flushFaltanteInternoNotification, desactivarPlanesLaminadoSuperados, puestoTrabajoLineaPorMaterial]);

  // Paso 1 de edición: busca los PlanGrupo activos de Corte y Laminado directo por codigo_grupo
  // (CODIGO_GRUPO_LAMINADO) en planGrupoService.getAll(), NO a través de "Necesidades Planta"
  // (necesidadesPlantaData solo indexa planes con valor "...P2" de OTRAS áreas — este módulo nunca
  // crea un "P2" propio, solo "P3"/"PFD" al guardar, así que esos planes jamás aparecían ahí). Como
  // ahora pueden convivir varios PlanGrupo activos para el mismo grupo (P3 real y PFD de
  // visualización, o varios guardados en el tiempo), ya NO se auto-selecciona el más reciente: se
  // listan todos ordenados por codigo_plan_grupo descendente y el usuario elige cuál editar (el
  // último guardado queda preseleccionado por defecto, ver handleConfirmarSeleccionPlan).
  const handleOpenEditarPlan = useCallback(async () => {
    setIsLoadingEditPlan(true);
    try {
      const planesRes = await planGrupoService.getAll();
      const planesGrupo = (planesRes.data || [])
        // "Rollos" filtra los planes propios de Laminado — codigo_grupo=8 es compartido con la
        // Respuesta P3/PFD de Corte Espuma, sin este filtro aparecerían acá para editar por error.
        .filter(p => p.codigo_grupo === CODIGO_GRUPO_LAMINADO && p.estado === 'A' && /rollo/i.test(String(p.valor || '')))
        .sort((a, b) => b.codigo_plan_grupo - a.codigo_plan_grupo);

      if (planesGrupo.length === 0) {
        addNotification('warning', 'No hay ningún Plan Grupo activo guardado para Corte y Laminado (Centro 1000).');
        return;
      }

      setPlanesGrupoDisponibles(planesGrupo);
      setPlanGrupoSeleccionado(planesGrupo[0].codigo_plan_grupo);
    } catch (e) {
      addNotification('error', `Error al cargar los planes: ${(e as Error).message}`);
    } finally {
      setIsLoadingEditPlan(false);
    }
  }, [addNotification]);

  // Paso 2 de edición: ya elegido el PlanGrupo en la grilla, en vez de repetir los valores ya
  // guardados, recalcula la salida de datos ACTUAL (misma fuente que al crear el plan —
  // respuestaSalidaRows) y la usa como base editable, aplicando la misma variante con la que se creó
  // ese plan: "PFD" fuerza cantidad 0 en materiales sin corrida, cualquier otro valor (P3) usa el
  // fallback a stock igual que "Guardar Plan". Se reconcilia contra los DetalleTactico ya persistidos
  // (por material + codigo_plan_grupo_padre) para reutilizar el mismo codigo_detalle_tactico y que se
  // actualice en el mismo registro en vez de duplicar; lo que ya no aparece en el cálculo actual
  // queda premarcado para eliminar (el usuario puede desmarcarlo antes de confirmar).
  const handleConfirmarSeleccionPlan = useCallback(async () => {
    if (!planGrupoSeleccionado || !planesGrupoDisponibles) return;
    const planVigente = planesGrupoDisponibles.find(p => p.codigo_plan_grupo === planGrupoSeleccionado);
    if (!planVigente) return;

    setIsLoadingEditPlan(true);
    try {
      const rows = await reconciliarDetallesParaPlan(planVigente, respuestaSalidaRows, unifiedNeeds);

      // La fecha se RECALCULA al editar, no se conserva la que traía el plan — el mismo bug que se
      // corrigió al crear el plan (hoy+1 calendario en vez de próximo día laborable) también dejaba
      // planes editados con una fecha vieja/vencida, porque "Guardar Cambios" solo tocaba los
      // DetalleTactico y nunca volvía a grabar fecha_inicio_plan/fecha_fin_plan del propio PlanGrupo.
      // P3 (la respuesta automática): se recalcula al próximo día laborable desde HOY, igual que al
      // crear uno nuevo. PFD (la variante ligada al calendario de producción del módulo): se
      // recalcula desde la selección de fechas VIGENTE (selectedDates), igual que al crearlo; si no
      // hay fechas seleccionadas en este momento, se conserva la que ya tenía el plan.
      const esPFD = /pfd/i.test(planVigente.valor || '');
      let fechaInicio: string;
      let fechaFin: string;
      if (esPFD) {
        const dates = Array.from(selectedDates).sort();
        if (dates.length > 0) {
          fechaInicio = dates[0];
          fechaFin = dates[dates.length - 1];
        } else {
          fechaInicio = planVigente.fecha_inicio_plan ? fechaLocalEcuador(planVigente.fecha_inicio_plan) : format(new Date(), 'yyyy-MM-dd');
          fechaFin = planVigente.fecha_fin_plan ? fechaLocalEcuador(planVigente.fecha_fin_plan) : fechaInicio;
        }
      } else {
        fechaInicio = format(siguienteDiaHabil(new Date()), 'yyyy-MM-dd');
        fechaFin = fechaInicio;
      }

      setEditPlanPreview({
        codigo_plan_grupo: planVigente.codigo_plan_grupo,
        valor: planVigente.valor,
        fechaInicio,
        fechaFin,
        rows,
        planOriginal: planVigente,
      });
      setPlanesGrupoDisponibles(null);
      setPlanGrupoSeleccionado(null);
    } catch (e) {
      addNotification('error', `Error al cargar el plan: ${(e as Error).message}`);
    } finally {
      setIsLoadingEditPlan(false);
    }
  }, [planGrupoSeleccionado, planesGrupoDisponibles, addNotification, unifiedNeeds, respuestaSalidaRows, reconciliarDetallesParaPlan, selectedDates, siguienteDiaHabil]);

  // Materiales del Resumen actual que todavía no están en el plan cargado, disponibles para agregar.
  const materialesDisponiblesParaAgregar = useMemo(() => {
    if (!editPlanPreview) return [];
    const yaIncluidos = new Set(editPlanPreview.rows.map(r => r.material));
    return unifiedNeeds.filter(u => u.planUn > 0 && !yaIncluidos.has(u.material));
  }, [editPlanPreview, unifiedNeeds]);

  const handleAddMaterialToEditPlan = (material: string) => {
    const needRow = unifiedNeeds.find(u => u.material === material);
    if (!needRow || !editPlanPreview) return;
    // Igual que al crear el plan: si la necesidad del material viene de varias áreas, se prorratea
    // y se agrega una fila por cada origen (codigo_plan_grupo_padre = ese origen real). Se calcula
    // fuera del updater de setEditPlanPreview porque getOrigenesProrrateo tiene el efecto secundario
    // de encolar faltantes en faltanteInternoRef — un updater de React puede invocarse más de una vez
    // (StrictMode) y duplicaría el aviso.
    faltanteInternoRef.current = [];
    const splits = getOrigenesProrrateo(needRow.material, needRow.planKg, editPlanPreview.codigo_plan_grupo);
    flushFaltanteInternoNotification();
    const nuevasFilas: EditableDetalleRow[] = splits
      .filter(split => split.cantidadKg > 0)
      .map(split => ({
        codigo_detalle_tactico: 0,
        material: needRow.material,
        descripcion: needRow.descripcion,
        cantidad: split.cantidadKg,
        marcadoEliminar: false,
        esNuevo: true,
        codigo_plan_grupo_padre: split.codigoPadre,
      }));
    setEditPlanPreview(prev => {
      if (!prev) return prev;
      return { ...prev, rows: [...prev.rows, ...nuevasFilas] };
    });
  };

  // En filas nuevas (aún no guardadas) "quitar" simplemente las descarta de la lista; en filas
  // existentes se marcan para eliminar (DELETE real al confirmar), permitiendo deshacer antes de guardar.
  const handleRemoveEditRow = (index: number) => {
    setEditPlanPreview(prev => {
      if (!prev) return prev;
      const row = prev.rows[index];
      if (row.esNuevo) {
        return { ...prev, rows: prev.rows.filter((_, i) => i !== index) };
      }
      return { ...prev, rows: prev.rows.map((r, i) => (i === index ? { ...r, marcadoEliminar: !r.marcadoEliminar } : r)) };
    });
  };

  const handleUpdateEditRowCantidad = (index: number, value: number) => {
    setEditPlanPreview(prev => {
      if (!prev) return prev;
      const rows = prev.rows.map((r, i) => (i === index ? { ...r, cantidad: value } : r));
      return { ...prev, rows };
    });
  };

  const handleConfirmEditarPlan = useCallback(async () => {
    if (!editPlanPreview) return;
    setIsSavingEditPlan(true);
    try {
      const user = typeof window !== 'undefined' ? JSON.parse(localStorage.getItem('user') || '{}') : {};
      const usuario = user?.name || 'admin';

      // A diferencia de antes, "Guardar Cambios" también regraba fecha_inicio_plan/fecha_fin_plan
      // del propio PlanGrupo (recalculadas en handleConfirmarSeleccionPlan) — antes solo se
      // actualizaban los DetalleTactico y el plan se quedaba con la fecha vieja para siempre.
      await planGrupoService.save({
        ...editPlanPreview.planOriginal,
        fecha_inicio_plan: editPlanPreview.fechaInicio,
        fecha_fin_plan: editPlanPreview.fechaFin,
      } as unknown as PlanGrupo);

      const { actualizados, agregados, eliminados, fallidos } =
        await persistirFilasEditables(editPlanPreview.codigo_plan_grupo, editPlanPreview.rows, usuario);

      const superados = await desactivarPlanesLaminadoSuperados(CODIGO_GRUPO_LAMINADO, editPlanPreview.fechaInicio, editPlanPreview.codigo_plan_grupo, /pfd/i.test(editPlanPreview.valor));
      const sufijoSuperados = superados > 0 ? ` ${superados} Plan Grupo previo(s) del mismo día o anterior fueron desactivados.` : '';

      if (fallidos === 0) {
        addNotification('success', `Plan Grupo #${editPlanPreview.codigo_plan_grupo} actualizado (vigencia ${editPlanPreview.fechaInicio} a ${editPlanPreview.fechaFin}): ${actualizados} modificados, ${agregados} agregados, ${eliminados} eliminados.${sufijoSuperados}`);
      } else {
        addNotification('warning', `Plan Grupo #${editPlanPreview.codigo_plan_grupo} actualizado con errores: ${actualizados} modificados, ${agregados} agregados, ${eliminados} eliminados, ${fallidos} fallidos.${sufijoSuperados}`);
      }
      fetchNecesidadesPlanta();
      setEditPlanPreview(null);
    } catch (e) {
      addNotification('error', `Error al actualizar el plan: ${(e as Error).message}`);
    } finally {
      setIsSavingEditPlan(false);
    }
  }, [editPlanPreview, addNotification, fetchNecesidadesPlanta, persistirFilasEditables, desactivarPlanesLaminadoSuperados]);

  const toggleGroup = (key: string) => {
    const next = new Set(expandedGroups);
    if (next.has(key)) next.delete(key);
    else next.add(key);
    setExpandedGroups(next);
  };

  // Anida las variantes "CONV" (se procesan en otra máquina y por eso no generan corrida propia,
  // pero sí se contabilizan como necesidad) bajo la lámina base de la que provienen según el árbol
  // BOM real (comp.MATERIAL_PADRE), en vez de mostrarlas como filas sueltas del bloque.
  const buildDisplayOrder = (items: UnifiedNeedRow[]): { item: UnifiedNeedRow; nested: boolean }[] => {
    const standardItems = items.filter(it => !isConvDescripcion(it.descripcion));
    const convItems = items.filter(it => isConvDescripcion(it.descripcion));
    const childrenByParent = new Map<string, UnifiedNeedRow[]>();
    const orphanConv: UnifiedNeedRow[] = [];

    convItems.forEach(conv => {
      // conv.bomParentMaterial ya trae el código de la lámina base de la que se produce
      // (resuelto en handleProcessResumen recorriendo el árbol BOM de la explosión SAP).
      const parentCode = conv.bomParentMaterial;
      const parent = parentCode ? standardItems.find(p => p.material === parentCode) : undefined;
      if (parent) {
        if (!childrenByParent.has(parent.material)) childrenByParent.set(parent.material, []);
        childrenByParent.get(parent.material)!.push(conv);
      } else {
        orphanConv.push(conv);
      }
    });

    const ordered: { item: UnifiedNeedRow; nested: boolean }[] = [];
    standardItems.forEach(item => {
      ordered.push({ item, nested: false });
      (childrenByParent.get(item.material) || []).forEach(child => ordered.push({ item: child, nested: true }));
    });
    orphanConv.forEach(item => ordered.push({ item, nested: false }));
    return ordered;
  };

  const groupedNeeds = useMemo(() => {
    const map = new Map<string, { 
      densidad: string; apertura: string; items: UnifiedNeedRow[]; totalKg: number; totalUn: number;
      total1006: number; total1008: number; total1015: number; totalPlanUn: number; totalPlanKg: number;
      totalUN1006: number; totalUN1008: number; totalUN1015: number; totalTProceso: number;
      totalRollos: number; totalKgHalb: number; totalRollosHalb: number; totalConsumoKg: number; totalNroRollos: number;
      totalStockKg: number; totalStockUN: number; hasGroupDeficit: boolean; runs: number;
    }>();

    unifiedNeeds.forEach(item => {
      const key = `${item.apertura}|${item.densidad}`;
      if (!map.has(key)) {
        map.set(key, {
          densidad: item.densidad, apertura: item.apertura, items: [], totalKg: 0, totalUn: 0,
          total1006: 0, total1008: 0, total1015: 0, totalPlanUn: 0, totalPlanKg: 0,
          totalUN1006: 0, totalUN1008: 0, totalUN1015: 0, totalTProceso: 0, totalRollos: 0,
          totalKgHalb: 0, totalRollosHalb: 0, totalConsumoKg: 0, totalNroRollos: 0,
          totalStockKg: 0, totalStockUN: 0, hasGroupDeficit: false, runs: 0
        });
      }
      const group = map.get(key)!;
      group.items.push(item);
      group.totalKg += item.consumoKg;
      group.totalKgHalb += item.consumoKgHalb;
      group.totalConsumoKg += item.totalConsumoKg;
      group.totalUn += item.unidades; // Suma unidades originales PROV
      group.totalRollos += item.nroRollos;
      group.totalRollosHalb += item.nroRollosHalb;
      group.totalNroRollos += item.totalNroRollos;
      group.total1006 += item.stock1006;
      group.total1008 += item.stock1008;
      group.total1015 += item.stock1015;
      group.totalUN1006 += item.stockUN1006;
      group.totalUN1008 += item.stockUN1008;
      group.totalUN1015 += item.stockUN1015;
      group.totalStockKg += item.totalStockKg;
      group.totalStockUN += item.totalStockUN;
      // El total de la corrida (PLAN UN/KG y T.PROCESO del bloque) excluye las variantes CONV:
      // no ocupan cupo de corrida propio, su valor ya se refleja en su propia fila anidada.
      if (!isConvDescripcion(item.descripcion)) {
        group.totalPlanUn += item.planUn;
        group.totalPlanKg += item.planKg;
        group.totalTProceso += item.tProceso;
      }
      if (item.hasDeficit) group.hasGroupDeficit = true;
    });

    map.forEach(group => {
      group.runs = Math.ceil(group.totalPlanUn / BLOCK_SIZE);
    });

    return Array.from(map.values()).sort((a, b) => {
        const apA = parseFloat(a.apertura) || 0;
        const apB = parseFloat(b.apertura) || 0;
        if (apA !== apB) return apA - apB;
        const dEA = parseFloat(a.densidad) || 0;
        const dEB = parseFloat(b.densidad) || 0;
        return dEA - dEB;
    });
  }, [unifiedNeeds]);

  const totalsUnified = useMemo(() => {
    const base = unifiedNeeds.reduce((acc, row) => ({
      kg: acc.kg + row.consumoKg,
      kgHalb: acc.kgHalb + row.consumoKgHalb,
      totalKg: acc.totalKg + row.totalConsumoKg,
      un: acc.un + row.unidades, // Fix: Sumar unidades base
      rollos: acc.rollos + row.nroRollos,
      rollosHalb: acc.rollosHalb + row.nroRollosHalb,
      totalRollos: acc.totalRollos + row.totalNroRollos,
      planUn: acc.planUn + row.planUn,
      planKg: acc.planKg + row.planKg,
      stock1006: acc.stock1006 + row.stock1006,
      stock1008: acc.stock1008 + row.stock1008,
      stock1015: acc.stock1015 + row.stock1015,
      stockUN1006: acc.stockUN1006 + row.stockUN1006,
      stockUN1008: acc.stockUN1008 + row.stockUN1008,
      stockUN1015: acc.stockUN1015 + row.stockUN1015,
      totalStockKg: acc.totalStockKg + row.totalStockKg,
      totalStockUN: acc.totalStockUN + row.totalStockUN,
      // Las variantes CONV se procesan en otra máquina (no ocupan cupo de corrida del Looper, ver
      // groupedNeeds/group.totalTProceso), por eso su tProceso no debe sumar al tiempo operativo
      // total ni a la ocupación real del Looper (ver TIEMPO OPERATIVO (H) / OCUPACIÓN REAL (%)).
      tProceso: acc.tProceso + (isConvDescripcion(row.descripcion) ? 0 : row.tProceso)
    }), { kg: 0, kgHalb: 0, totalKg: 0, un: 0, rollos: 0, rollosHalb: 0, totalRollos: 0, planUn: 0, planKg: 0, stock1006: 0, stock1008: 0, stock1015: 0, stockUN1006: 0, stockUN1008: 0, stockUN1015: 0, totalStockKg: 0, totalStockUN: 0, tProceso: 0 });

    const totalRuns = groupedNeeds.reduce((acc, group) => {
      const hasOnlyConv = group.items.every(it => it.descripcion.toUpperCase().includes('CONV') || it.descripcion.toUpperCase().includes('CV'));
      if (hasOnlyConv) return acc;
      return acc + group.runs;
    }, 0);

    return { ...base, totalRuns };
  }, [unifiedNeeds, groupedNeeds]);

  // Operación Adicional: agrupa las tareas de MTTO preventivo de la Laminadora Looper Fecken
  // y el Transportador de ingreso a Looper (ambas contienen "LOOPER" en la maestra SAP)
  const mttoPreventivoTasks = useMemo(() => {
    return mantenimientosSAP
      .filter(m => String(getProp(m, ['MAQUINA'])).toUpperCase().includes('LOOPER'))
      .filter(m => {
        if (selectedDates.size === 0) return true;
        // fechaLocalEcuador, no split('T')[0]: FECHA_OT_PRG_INI es UTC real, selectedDates son
        // fechas locales del calendario — mismo bug de zona horaria que en Corte Espuma.
        return selectedDates.has(fechaLocalEcuador(getProp(m, ['FECHA_OT_PRG_INI'])));
      })
      .map(m => {
        const iniStr = getProp(m, ['FECHA_OT_PRG_INI']).trim();
        const finStr = getProp(m, ['FECHA_OT_PRG_FIN']).trim();
        const ini = new Date(iniStr);
        const fin = new Date(finStr);
        const horas = safeNum(getProp(m, ['T_MTTO_PLANIFICADO', 't_mtto_planificado']))
          || (isValid(ini) && isValid(fin) ? (fin.getTime() - ini.getTime()) / 3600000 : 0);
        return {
          maquina: getProp(m, ['MAQUINA']),
          fecha: fechaLocalEcuador(iniStr),
          horas
        };
      });
  }, [mantenimientosSAP, selectedDates]);

  const mttoPreventivoHoras = useMemo(
    () => mttoPreventivoTasks.reduce((sum, t) => sum + t.horas, 0),
    [mttoPreventivoTasks]
  );

  // Disponibilidad neta OEE calculada de forma independiente por turno (cada turno descuenta
  // su propio 13% de pérdidas estándar) para poder evaluar la disponibilidad real de cada turno
  // por separado. El MTTO Preventivo se sigue descontando una sola vez sobre la suma de ambos turnos.
  const diaDisponibleOEE = useMemo(() => {
    const diaH = diaShiftOptions.find(o => o.v === selectedDiaShift)?.h || 0;
    return diaH * 0.87;
  }, [selectedDiaShift]);

  const nocheDisponibleOEE = useMemo(() => {
    const nocheH = nocheShiftOptions.find(o => o.v === selectedNocheShift)?.h || 0;
    return nocheH * 0.87;
  }, [selectedNocheShift]);

  const sabadoDisponibleOEE = useMemo(() => {
    const sabadoH = diaShiftOptions.find(o => o.v === selectedSabadoShift)?.h || 0;
    return sabadoH * 0.87;
  }, [selectedSabadoShift]);

  const tDisponible = useMemo(() => {
    return Math.max(0, (diaDisponibleOEE + nocheDisponibleOEE + sabadoDisponibleOEE) - mttoPreventivoHoras); // + descuento del MTTO Preventivo (Operación Adicional)
  }, [diaDisponibleOEE, nocheDisponibleOEE, sabadoDisponibleOEE, mttoPreventivoHoras]);

  const ocupacionPorc = useMemo(() => {
    if (tDisponible <= 0) return 0;
    return (totalsUnified.tProceso / tDisponible) * 100;
  }, [tDisponible, totalsUnified.tProceso]);

  // Cuerpo del correo "Enviar Reporte" (Gestión de Tiempos) — HTML tabla, estilos inline (sin <style>,
  // sin fuentes externas: los clientes de correo los ignoran o los rompen). Formato ya evaluado con el
  // usuario vía vista previa antes de conectar el envío real. Mismos umbrales/colores que ya usa este
  // panel en pantalla (rojo cuando ocupacionPorc > 100, ver isSaturated más abajo).
  const construirReporteHtml = () => {
    const fechaHoy = format(new Date(), "EEEE d 'de' MMMM 'de' yyyy", { locale: es });
    const diaLabel = diaShiftOptions.find(o => o.v === selectedDiaShift)?.l || '—';
    const nocheLabel = nocheShiftOptions.find(o => o.v === selectedNocheShift)?.l || '—';
    const critico = ocupacionPorc > 100;
    const ocupacionColor = critico ? '#7f1d1d' : '#065f46';
    // Plan de Salida — detalle completo por material (no resumen): el operador necesita saber
    // exactamente qué cortar en cada corrida, no solo un total. La fecha (ya corregida a
    // siguienteDiaHabil, ver outputPlanRows) se muestra solo en la primera fila de cada corrida,
    // igual que en la tabla real de "Salida de Datos".
    const fechaEjecucion = outputPlanRows[0]?.fecha
      ? format(parseISO(outputPlanRows[0].fecha), "EEEE d 'de' MMMM", { locale: es })
      : '—';
    const planSalidaFilas = outputPlanRows.map((row, i) => {
      const esPrimeraDeCorrida = i === 0 || outputPlanRows[i - 1].corridaId !== row.corridaId;
      const bg = i % 2 === 0 ? '#ffffff' : '#fafafa';
      return `
        <tr style="background:${bg};">
          <td style="padding:7px 10px;font-size:10px;color:${esPrimeraDeCorrida ? '#9ca3af' : '#d1d5db'};border-bottom:1px solid #f3f4f6;font-variant-numeric:tabular-nums;">${esPrimeraDeCorrida ? format(parseISO(row.fecha), 'dd/MM') : '&nbsp;'}</td>
          <td style="padding:7px 10px;font-size:11px;font-weight:600;color:#111827;border-bottom:1px solid #f3f4f6;">${row.corrida}</td>
          <td style="padding:7px 10px;font-size:11px;color:#4338ca;font-family:ui-monospace,Consolas,monospace;border-bottom:1px solid #f3f4f6;">${row.material}</td>
          <td align="right" style="padding:7px 10px;font-size:11px;color:#374151;border-bottom:1px solid #f3f4f6;font-variant-numeric:tabular-nums;">${Math.round(row.planUn)}</td>
          <td align="right" style="padding:7px 10px;font-size:11px;color:#374151;border-bottom:1px solid #f3f4f6;font-variant-numeric:tabular-nums;">${formatNum(row.planKg, 1)}</td>
          <td align="center" style="padding:7px 10px;font-size:10px;font-weight:700;color:#b45309;border-bottom:1px solid #f3f4f6;">${row.isConvNested ? '—' : row.prioridad}</td>
        </tr>`;
    }).join('');
    const planSalidaHtml = outputPlanRows.length === 0 ? '' : `
  <tr>
    <td style="padding:22px 28px 4px;">
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin-bottom:8px;">
        <tr>
          <td style="font-size:10px;font-weight:700;letter-spacing:0.1em;text-transform:uppercase;color:#6b7280;">Plan de salida — corridas looper</td>
          <td align="right" style="font-size:10px;font-weight:700;color:#b45309;text-transform:capitalize;">Ejecución: ${fechaEjecucion}</td>
        </tr>
      </table>
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border:1px solid #e5e7eb;border-radius:10px;overflow:hidden;">
        <tr style="background:#f9fafb;">
          <td style="padding:8px 10px;font-size:9px;font-weight:700;letter-spacing:0.05em;text-transform:uppercase;color:#6b7280;border-bottom:1px solid #e5e7eb;">Fecha</td>
          <td style="padding:8px 10px;font-size:9px;font-weight:700;letter-spacing:0.05em;text-transform:uppercase;color:#6b7280;border-bottom:1px solid #e5e7eb;">Corrida</td>
          <td style="padding:8px 10px;font-size:9px;font-weight:700;letter-spacing:0.05em;text-transform:uppercase;color:#6b7280;border-bottom:1px solid #e5e7eb;">Material</td>
          <td align="right" style="padding:8px 10px;font-size:9px;font-weight:700;letter-spacing:0.05em;text-transform:uppercase;color:#6b7280;border-bottom:1px solid #e5e7eb;">UN</td>
          <td align="right" style="padding:8px 10px;font-size:9px;font-weight:700;letter-spacing:0.05em;text-transform:uppercase;color:#6b7280;border-bottom:1px solid #e5e7eb;">Kg</td>
          <td align="center" style="padding:8px 10px;font-size:9px;font-weight:700;letter-spacing:0.05em;text-transform:uppercase;color:#6b7280;border-bottom:1px solid #e5e7eb;">Prior.</td>
        </tr>${planSalidaFilas}
      </table>
    </td>
  </tr>`;
    return `
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:600px;margin:0 auto;background:#ffffff;font-family:-apple-system,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;">
  <tr>
    <td style="background:#1d4ed8;padding:22px 28px;">
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
        <tr>
          <td style="font-size:15px;font-weight:700;color:#ffffff;letter-spacing:0.02em;">CHAIDE Y CHAIDE</td>
          <td align="right" style="font-size:11px;font-weight:600;letter-spacing:0.06em;text-transform:uppercase;color:#c7d7fd;">Planificación de Producción</td>
        </tr>
      </table>
    </td>
  </tr>
  <tr>
    <td style="padding:26px 28px 6px;">
      <p style="margin:0;font-size:10px;font-weight:700;letter-spacing:0.1em;text-transform:uppercase;color:#6b7280;">Corte y Laminado · Reporte diario</p>
      <h1 style="margin:4px 0 0;font-size:20px;font-weight:700;color:#111827;">Rollos y disponibilidad de máquina</h1>
      <p style="margin:6px 0 0;font-size:12px;color:#6b7280;text-transform:capitalize;">${fechaHoy} · Correo automático, no responder</p>
    </td>
  </tr>
  <tr>
    <td style="padding:18px 28px 4px;">
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
        <tr>
          <td width="33.33%" style="background:#eef4ff;border-radius:10px 0 0 10px;padding:14px 12px;border:1px solid #e5e7eb;border-right:none;">
            <p style="margin:0;font-size:9px;font-weight:700;letter-spacing:0.08em;text-transform:uppercase;color:#6b7280;">Rollos req. (kg)</p>
            <p style="margin:4px 0 0;font-size:20px;font-weight:700;color:#1d4ed8;font-variant-numeric:tabular-nums;">${formatNum(totalsUnified.planKg, 0)}</p>
          </td>
          <td width="33.34%" style="background:#eef4ff;padding:14px 12px;border-top:1px solid #e5e7eb;border-bottom:1px solid #e5e7eb;">
            <p style="margin:0;font-size:9px;font-weight:700;letter-spacing:0.08em;text-transform:uppercase;color:#6b7280;">Rollos req. (un)</p>
            <p style="margin:4px 0 0;font-size:20px;font-weight:700;color:#1d4ed8;font-variant-numeric:tabular-nums;">${formatNum(totalsUnified.planUn, 0)}</p>
          </td>
          <td width="33.33%" style="background:#eef4ff;border-radius:0 10px 10px 0;padding:14px 12px;border:1px solid #e5e7eb;border-left:none;">
            <p style="margin:0;font-size:9px;font-weight:700;letter-spacing:0.08em;text-transform:uppercase;color:#6b7280;">Corridas looper</p>
            <p style="margin:4px 0 0;font-size:20px;font-weight:700;color:#1d4ed8;font-variant-numeric:tabular-nums;">${totalsUnified.totalRuns}</p>
          </td>
        </tr>
      </table>
    </td>
  </tr>
  <tr>
    <td style="padding:22px 28px 4px;">
      <p style="margin:0 0 10px;font-size:10px;font-weight:700;letter-spacing:0.1em;text-transform:uppercase;color:#6b7280;">Gestión de tiempos</p>
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border:1px solid #e5e7eb;border-radius:10px;overflow:hidden;">
        <tr style="background:#ecfdf5;">
          <td style="padding:10px 14px;font-size:12px;font-weight:700;color:#047857;border-bottom:1px solid #e5e7eb;">Día</td>
          <td style="padding:10px 14px;font-size:12px;color:#374151;border-bottom:1px solid #e5e7eb;font-variant-numeric:tabular-nums;">${diaLabel}</td>
          <td align="right" style="padding:10px 14px;font-size:12px;font-weight:700;color:#047857;border-bottom:1px solid #e5e7eb;font-variant-numeric:tabular-nums;">${diaDisponibleOEE.toFixed(2)} h</td>
        </tr>
        <tr style="background:#eef2ff;">
          <td style="padding:10px 14px;font-size:12px;font-weight:700;color:#4338ca;border-bottom:1px solid #e5e7eb;">Noche</td>
          <td style="padding:10px 14px;font-size:12px;color:#374151;border-bottom:1px solid #e5e7eb;font-variant-numeric:tabular-nums;">${nocheLabel}</td>
          <td align="right" style="padding:10px 14px;font-size:12px;font-weight:700;color:#4338ca;border-bottom:1px solid #e5e7eb;font-variant-numeric:tabular-nums;">${nocheDisponibleOEE.toFixed(2)} h</td>
        </tr>
        <tr style="background:#fffbeb;">
          <td style="padding:10px 14px;font-size:12px;font-weight:700;color:#b45309;">Mantenimiento Programado</td>
          <td style="padding:10px 14px;font-size:12px;color:#374151;">—</td>
          <td align="right" style="padding:10px 14px;font-size:12px;font-weight:700;color:#b45309;font-variant-numeric:tabular-nums;">${mttoPreventivoHoras.toFixed(2)} h</td>
        </tr>
      </table>
    </td>
  </tr>${planSalidaHtml}
  <tr>
    <td style="padding:22px 28px 6px;">
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
        <tr>
          <td width="33.33%" style="padding-right:6px;">
            <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:${ocupacionColor};border-radius:10px;">
              <tr><td style="padding:14px 14px;">
                <p style="margin:0;font-size:9px;font-weight:700;letter-spacing:0.08em;text-transform:uppercase;color:#fecaca;">Ocupación real</p>
                <p style="margin:4px 0 0;font-size:22px;font-weight:700;color:#ffffff;font-variant-numeric:tabular-nums;">${ocupacionPorc.toFixed(1)}%</p>
              </td></tr>
            </table>
          </td>
          <td width="33.34%" style="padding:0 6px;">
            <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#111827;border-radius:10px;">
              <tr><td style="padding:14px 14px;">
                <p style="margin:0;font-size:9px;font-weight:700;letter-spacing:0.08em;text-transform:uppercase;color:#9ca3af;">Tiempo operativo</p>
                <p style="margin:4px 0 0;font-size:22px;font-weight:700;color:#ffffff;font-variant-numeric:tabular-nums;">${totalsUnified.tProceso.toFixed(2)} h</p>
              </td></tr>
            </table>
          </td>
          <td width="33.33%" style="padding-left:6px;">
            <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#111827;border-radius:10px;">
              <tr><td style="padding:14px 14px;">
                <p style="margin:0;font-size:9px;font-weight:700;letter-spacing:0.08em;text-transform:uppercase;color:#9ca3af;">Disponibilidad total</p>
                <p style="margin:4px 0 0;font-size:22px;font-weight:700;color:#ffffff;font-variant-numeric:tabular-nums;">${tDisponible.toFixed(2)} h</p>
              </td></tr>
            </table>
          </td>
        </tr>
      </table>
    </td>
  </tr>
  ${critico ? `
  <tr>
    <td style="padding:10px 28px 24px;">
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#fef2f2;border:1px solid #fecaca;border-radius:8px;">
        <tr><td style="padding:10px 14px;font-size:11px;font-weight:600;color:#b91c1c;">
          <strong>Capacidad crítica:</strong> la ocupación real supera el 100% — evaluar minimización de corridas para optimizar la carga del Looper.
        </td></tr>
      </table>
    </td>
  </tr>` : ''}
  <tr>
    <td style="padding:0 28px 28px;">
      <p style="margin:0;font-size:11px;line-height:1.6;color:#9ca3af;border-top:1px solid #e5e7eb;padding-top:16px;">
        Este correo fue generado automáticamente por el Optimizador de Producción, favor no responder.
        Para dudas sobre estos datos, contacta a Planificación Táctica.
      </p>
    </td>
  </tr>
</table>`;
  };

  const handleEnviarReporte = async () => {
    const destino = destinatariosReporte.trim();
    if (!destino) {
      addNotification('warning', 'Escribe al menos un correo destinatario antes de enviar.');
      return;
    }
    setIsSendingReporte(true);
    try {
      const resultado = await serviciosService.enviarCorreo({
        destino,
        // Mismo formato que el correo de Corte Espuma (Carruseles): "Corte y Laminado" es el
        // departamento SAP real que agrupa ambos procesos, distinguidos por el nombre del proceso
        // entre corchetes -- Looper solo opera Centro 1000 (Quito), sin variante por planta.
        asunto: 'Reporte de producción — Corte y Laminado [Looper]-[Quito]',
        cuerpo: construirReporteHtml(),
        nota: 'Este correo fue generado automáticamente, favor no responder.',
      });
      addNotification('success', `${resultado.message} — ${resultado.destinatarios.join(', ')}`);
    } catch (error) {
      addNotification('error', `Error al enviar el reporte: ${(error as Error).message}`);
    } finally {
      setIsSendingReporte(false);
    }
  };

  // Empaqueta los materiales de un grupo dentro de sus N corridas (bins de 40 un.) usando
  // Best-Fit-Decreasing: cada material entra ENTERO en la corrida donde mejor quepa, y solo
  // se fracciona entre varias corridas si su necesidad por sí sola supera el tamaño de un bloque.
  // Esto unifica las necesidades menores en un único ciclo en vez de repartirlas parejo entre todas las corridas.
  const distributeItemsIntoRuns = (items: UnifiedNeedRow[], totalRuns: number, blockSize: number) => {
    const bins = Array.from({ length: totalRuns }, () => ({
      remaining: blockSize,
      allocations: [] as { material: string; planUn: number }[]
    }));

    const sorted = [...items].filter(it => it.planUn > 0).sort((a, b) => b.planUn - a.planUn);

    sorted.forEach(item => {
      let qtyLeft = Math.round(item.planUn);

      while (qtyLeft > 0) {
        // Best-fit: el bin con menor espacio libre que aún alcance a cubrir qtyLeft completo
        let bestBinIdx = -1;
        let bestRemaining = Infinity;
        bins.forEach((bin, idx) => {
          if (bin.remaining >= qtyLeft && bin.remaining < bestRemaining) {
            bestBinIdx = idx;
            bestRemaining = bin.remaining;
          }
        });

        if (bestBinIdx >= 0) {
          bins[bestBinIdx].allocations.push({ material: item.material, planUn: qtyLeft });
          bins[bestBinIdx].remaining -= qtyLeft;
          qtyLeft = 0;
        } else {
          // No cabe entero en ninguna corrida: solo aquí se fracciona, en el bin con más espacio disponible
          let maxBinIdx = 0;
          bins.forEach((bin, idx) => { if (bin.remaining > bins[maxBinIdx].remaining) maxBinIdx = idx; });
          const take = Math.min(qtyLeft, bins[maxBinIdx].remaining);
          if (take <= 0) break;
          bins[maxBinIdx].allocations.push({ material: item.material, planUn: take });
          bins[maxBinIdx].remaining -= take;
          qtyLeft -= take;
        }
      }
    });

    return bins;
  };

  // Plan de Salida: prioriza corridas por impacto en la necesidad (déficit de stock primero,
  // luego % de déficit, luego mayor consumo total) y reparte las corridas de cada grupo en
  // round-robin para no dejar todas las corridas de un mismo grupo consecutivas.
  const outputPlanRows = useMemo(() => {
    // Antes caía a la "Ventana de Producción" seleccionada (o a hoy) — pero el guardado real del P3
    // (ver handleOpenGuardarPlan) SIEMPRE fecha la respuesta al día hábil siguiente a la revisión, sin
    // importar qué esté marcado en el calendario (esas fechas son el rango de producción, no la
    // respuesta). La vista previa de "Plan de Salida" mostraba entonces una fecha distinta a la que
    // terminaba grabándose — se alinea al mismo criterio, editable igual por fila si hace falta.
    const defaultDate = format(siguienteDiaHabil(new Date()), 'yyyy-MM-dd');

    const eligibleGroups = groupedNeeds.filter(g => {
      const isConvOnly = g.items.every(it => it.descripcion.toUpperCase().includes('CONV') || it.descripcion.toUpperCase().includes('CV'));
      return !isConvOnly && g.runs > 0;
    });

    const scored = eligibleGroups.map(g => {
      const deficitUnits = Math.max(0, g.totalNroRollos - g.totalStockUN);
      const deficitRatio = g.totalNroRollos > 0 ? deficitUnits / g.totalNroRollos : 0;
      const score = (g.hasGroupDeficit ? 1_000_000 : 0) + deficitRatio * 100_000 + g.totalConsumoKg;
      return { group: g, score, remaining: g.runs, totalRuns: g.runs };
    }).sort((a, b) => b.score - a.score);

    // El empaquetado de cada grupo se calcula una sola vez (no por cada corrida). Las variantes CONV
    // se excluyen del empaquetado: no ocupan cupo físico de la corrida del Looper, se producen aparte
    // en el proceso alterno (otra máquina) a partir de la lámina base ya empacada.
    const groupBins = new Map<string, ReturnType<typeof distributeItemsIntoRuns>>();
    scored.forEach(gw => {
      const key = `${gw.group.apertura}|${gw.group.densidad}`;
      const runnableItems = gw.group.items.filter(it => !isConvDescripcion(it.descripcion));
      groupBins.set(key, distributeItemsIntoRuns(runnableItems, gw.totalRuns, BLOCK_SIZE));
    });

    const corridaSequence: { group: typeof scored[0]['group']; runIndex: number; totalRuns: number }[] = [];
    let anyLeft = true;
    while (anyLeft) {
      anyLeft = false;
      for (const gw of scored) {
        if (gw.remaining > 0) {
          const runIndex = gw.totalRuns - gw.remaining + 1;
          corridaSequence.push({ group: gw.group, runIndex, totalRuns: gw.totalRuns });
          gw.remaining--;
          anyLeft = true;
        }
      }
    }

    const rows: CorridaOutputRow[] = [];
    corridaSequence.forEach((c, seqIdx) => {
      const prioridad = seqIdx + 1;
      const groupKey = `${c.group.apertura}|${c.group.densidad}`;
      const corridaId = `${groupKey}|r${c.runIndex}`;
      const corridaLabel = `D${c.group.densidad}-${c.group.apertura} (Corrida ${c.runIndex}/${c.totalRuns})`;
      const fecha = corridaFechas[corridaId] || defaultDate;

      const bin = groupBins.get(groupKey)?.[c.runIndex - 1];
      if (!bin) return;

      bin.allocations.forEach(alloc => {
        const item = c.group.items.find(it => it.material === alloc.material);
        if (!item || alloc.planUn <= 0) return;
        rows.push({
          corridaId,
          fecha,
          corrida: corridaLabel,
          material: item.material,
          descripcion: item.descripcion,
          planUn: alloc.planUn,
          planKg: alloc.planUn * item.peso,
          prioridad,
          isConvNested: false
        });

        // Las variantes CONV no ocupan cupo propio de corrida (no están en el bin), pero se
        // muestran informativamente junto a la corrida de su lámina base: por cada UN asignada
        // acá de la base, el proceso alterno devuelve el doble en la variante CONV.
        const convChildren = c.group.items.filter(it => isConvDescripcion(it.descripcion) && it.bomParentMaterial === item.material);
        convChildren.forEach(conv => {
          const convPlanUn = Math.round(alloc.planUn * CONV_SPLIT_FACTOR);
          if (convPlanUn <= 0) return;
          rows.push({
            corridaId,
            fecha,
            corrida: corridaLabel,
            material: conv.material,
            descripcion: conv.descripcion,
            planUn: convPlanUn,
            planKg: convPlanUn * conv.peso,
            prioridad,
            isConvNested: true
          });
        });
      });
    });

    return rows;
  }, [groupedNeeds, corridaFechas, siguienteDiaHabil]);

  const handleUpdateCorridaFecha = (corridaId: string, fecha: string) => {
    setCorridaFechas(prev => ({ ...prev, [corridaId]: fecha }));
  };

  // Antes de exportar el TXT que genera las Provisionales reales en SAP, valida que el ciclo P2→P3
  // con Venta Externa esté cerrado para los materiales cuyo origen es Venta Externa (planGruposVentaExternaSet):
  // debe existir una Respuesta P3 nuestra (grupo Laminado, no PFD) cuya fecha_modificacion sea
  // EXACTAMENTE un día después de la línea del P2 origen — misma regla "revisión hoy, devolución
  // mañana" que ya valida "Data Aprobada" en Venta Externa (ver fetchDataAprobada ahí), pero
  // verificada del lado de Laminado, automáticamente, sin necesitar un clic manual de "aprobar": no
  // hay ningún campo "aprobado" persistido — se recalcula en vivo contra la API cada vez, igual que el
  // resto del módulo. Materiales sin origen Venta Externa (Forros/Muebles/Prensado) no se validan acá.
  const validarAprobacionVentaExterna = useCallback(async (materiales: string[]): Promise<string[]> => {
    const materialesVE = materiales.filter(m => {
      const origenes = materialOrigenesPlantaMap.get(String(Number(m)));
      return !!origenes && Array.from(origenes.keys()).some(c => planGruposVentaExternaSet.has(c));
    });
    if (materialesVE.length === 0) return [];

    const [planesRes, detallesRes] = await Promise.all([planGrupoService.getAll(), detalleTacticoService.getAll()]);
    const planes = planesRes.data || [];
    const detalles = detallesRes.data || [];
    const planPorCodigo = new Map(planes.map(pg => [pg.codigo_plan_grupo, pg]));

    return materialesVE.filter(m => {
      const matNum = Number(m);
      const origenesVE = Array.from(materialOrigenesPlantaMap.get(String(matNum))?.keys() || [])
        .filter(c => planGruposVentaExternaSet.has(c));

      const aprobado = origenesVE.some(codigoPadre => {
        // Se valida contra la FECHA DEL PLAN, no contra `fecha_modificacion`. Antes se exigía que la
        // respuesta tuviera `fecha_modificacion` = la de la línea P2 + 1 día, y eso NUNCA podía
        // cumplirse: la API devuelve ese campo vacío al insertar y solo lo llena al actualizar —
        // verificado en producción, 31.312 de 44.328 filas de detalle_tactico (71%) y los 85 de 85
        // plan_grupo lo traen en null. Resultado: el export quedaba bloqueado aunque el P3 existiera.
        // Caso real: material 30017862 con P2 #263 (12-ago) y su P3 #269 (12-ago, cantidad 54) ya
        // grabado, y aun así se reportaba como "sin Respuesta P3 aprobada".
        //
        // Criterio vigente: existe al menos un P3 ACTIVO que referencia ese P2 para ese material, y
        // su plan no es anterior al P2 que responde.
        const planP2 = planPorCodigo.get(codigoPadre);
        const fechaP2 = soloFecha(planP2?.fecha_inicio_plan);

        const respuestas = detalles.filter(d =>
          d.estado === 'A' &&
          d.codigo_plan_grupo_padre === codigoPadre &&
          Number(d.codigo_material) === matNum &&
          d.codigo_plan_grupo !== codigoPadre &&
          esPlanP3(planPorCodigo.get(d.codigo_plan_grupo)?.valor)
        );
        if (respuestas.length === 0) return false;

        return respuestas.some(r => {
          const planP3 = planPorCodigo.get(r.codigo_plan_grupo);
          if (!planP3 || planP3.estado !== 'A') return false;
          const fechaP3 = soloFecha(planP3.fecha_inicio_plan);
          // Sin fecha en alguno de los dos, basta con que el P3 exista y esté activo.
          if (!fechaP2 || !fechaP3) return true;
          return fechaP3 >= fechaP2;
        });
      });

      return !aprobado; // se reporta como "no aprobado" (queda en el array de faltantes)
    });
  }, [materialOrigenesPlantaMap, planGruposVentaExternaSet]);

  const handleExportTxt = useCallback(async () => {
    const rows = outputPlanRows;
    if (rows.length === 0) {
      addNotification('warning', 'No hay datos para exportar.');
      return;
    }

    setIsValidandoExportTxt(true);
    try {
      const materiales = Array.from(new Set(rows.map(r => r.material)));
      const noAprobados = await validarAprobacionVentaExterna(materiales);
      if (noAprobados.length > 0) {
        addNotification('error', `Exportación bloqueada: ${noAprobados.length} material(es) con origen Venta Externa aún no tienen Respuesta P3 aprobada (fecha correcta) — ${noAprobados.join(', ')}. Genera/corrige el P3 antes de exportar.`);
        return;
      }
    } catch (e) {
      addNotification('error', `No se pudo validar la aprobación de Venta Externa: ${(e as Error).message}. Exportación cancelada por seguridad.`);
      return;
    } finally {
      setIsValidandoExportTxt(false);
    }

    // Estructura fija de carga SAP: Material, Centro, Clase de orden, Cantidad,
    // Inicio programado, Clase de programación, Clave. Centro/Clase de orden/Clase de
    // programación/Clave son siempre el mismo valor para esta línea de producción.
    const lines = rows.map(r => {
      const [y, m, d] = r.fecha.split('-');
      const inicioProgramado = `${d}.${m}.${y}`;
      return [r.material, '1000', 'ZMOQ', Math.round(r.planKg), inicioProgramado, '1', '000'].join('\t');
    });
    const content = lines.join('\n');
    const blob = new Blob([content], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `PlanSalidaLaminado_${format(new Date(), 'yyyyMMdd_HHmm')}.txt`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }, [outputPlanRows, addNotification, validarAprobacionVentaExterna]);

  const renderTopConsolidation = () => {
    const isSaturated = totalsUnified.totalRuns > 6;
    
    return (
      <div className="sticky top-0 z-30 bg-white border border-gray-100 rounded-2xl shadow-md overflow-hidden mb-8 font-sans text-left">
        <div className="grid grid-cols-12 border-b border-gray-100">
          {/* 1. Demanda Consolidada (2 cols) */}
          <div className="col-span-2 p-3 border-r border-gray-100 bg-gray-50/50 flex flex-col justify-center min-h-[120px]">
            <p className="text-[8px] font-black uppercase text-slate-400 tracking-widest text-center mb-3">DEMANDA CONSOLIDADA</p>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1 font-bold text-[9px]">
                <p className="text-slate-400 uppercase text-center border-b border-gray-200 pb-1 mb-2">KG</p>
                <div className="flex justify-between px-1 text-slate-500"><span>NEC. PLANTA:</span> <span className="text-red-600">{formatNum(totalsUnified.kg, 0)}</span></div>
                <div className="flex justify-between px-1 text-slate-500"><span>HALB:</span> <span className="text-blue-600">{formatNum(totalsUnified.kgHalb, 0)}</span></div>
                <div className="flex justify-between px-1 pt-1 border-t border-gray-200 mt-1 text-slate-800"><span className="font-black">TOTAL:</span> <span>{formatNum(totalsUnified.totalKg, 0)}</span></div>
              </div>
              <div className="space-y-1 font-bold text-[9px]">
                <p className="text-slate-400 uppercase text-center border-b border-gray-200 pb-1 mb-2">UN</p>
                <div className="flex justify-between px-1 text-slate-500"><span>PROV:</span> <span className="text-red-600">{formatNum(totalsUnified.un, 0)}</span></div>
                <div className="flex justify-between px-1 text-slate-500"><span>HALB:</span> <span className="text-blue-600">{formatNum(totalsUnified.totalRollos - totalsUnified.un, 0)}</span></div>
                <div className="flex justify-between px-1 pt-1 border-t border-gray-200 mt-1 text-slate-800"><span className="font-black">TOTAL:</span> <span>{formatNum(totalsUnified.totalRollos, 0)}</span></div>
              </div>
            </div>
          </div>

          {/* 2. Plan (2 cols - Reducido) */}
          <div className="col-span-2 grid grid-cols-2 border-r border-gray-100">
            <div className="p-3 border-r border-gray-100 flex flex-col items-center justify-center text-center bg-indigo-50/50">
              <p className="text-[8px] font-black uppercase text-slate-400 tracking-tighter mb-4">ROLLOS REQ. (KG)</p>
              <span className="text-lg font-black text-indigo-700 tracking-tighter leading-none">{formatNum(totalsUnified.planKg, 0)}</span>
            </div>
            <div className="p-3 flex flex-col items-center justify-center text-center bg-gray-50">
              <p className="text-[8px] font-black uppercase text-slate-400 tracking-tighter mb-4">ROLLOS REQ. (UN)</p>
              <span className="text-xl font-black text-slate-800 tracking-tighter leading-none">{Math.round(totalsUnified.planUn).toLocaleString()}</span>
            </div>
          </div>

          {/* 3. Corridas LOOPER (1 col - Reducido) */}
          <div className={cn(
            "p-3 border-r border-gray-100 flex flex-col items-center justify-center text-center transition-all",
            isSaturated ? "bg-red-600 animate-pulse" : "bg-cyan-50/60"
          )}>
            <p className={cn("text-[8px] font-black uppercase tracking-tighter mb-4", isSaturated ? "text-white" : "text-cyan-800")}>CORRIDAS LOOPER</p>
            <span className={cn("text-3xl font-black tracking-tighter leading-none", isSaturated ? "text-white" : "text-cyan-900")}>{totalsUnified.totalRuns}</span>
            {isSaturated && <span className="text-[7px] font-black uppercase text-white mt-2">ALERTA CAPACIDAD</span>}
          </div>

          {/* 4. Gestión de Tiempos (2 cols - Ampliada) */}
          <div className="col-span-2 p-3 border-r border-gray-100 flex flex-col justify-center">
            <div className="flex items-center justify-between mb-4">
              <p className="text-[8px] font-black uppercase text-slate-400 tracking-widest">GESTIÓN DE TIEMPOS</p>
              <Popover>
                <PopoverTrigger asChild>
                  <button
                    type="button"
                    title="Envía por correo un resumen de Rollos, Gestión de Tiempos, Tiempo Operativo y Disponibilidad Total"
                    className="flex items-center gap-1 text-[7px] font-black uppercase tracking-wider text-indigo-700 border border-indigo-200 bg-white rounded px-2 py-1 hover:bg-indigo-50 transition-colors"
                  >
                    <Mail className="w-2.5 h-2.5" /> Enviar Reporte
                  </button>
                </PopoverTrigger>
                <PopoverContent className="w-[300px] p-4 bg-white border border-gray-100 rounded-2xl shadow-xl text-slate-800" align="end">
                  <p className="text-[9px] font-black uppercase text-indigo-700 tracking-widest mb-1">Enviar Reporte por Correo</p>
                  <p className="text-[8px] text-slate-400 font-bold uppercase mb-3">Rollos, Gestión de Tiempos, Ocupación y Disponibilidad — snapshot de este momento</p>
                  <label className="text-[8px] font-black uppercase text-slate-500 tracking-wider block mb-1">Destinatarios (separados por coma)</label>
                  <textarea
                    value={destinatariosReporte}
                    onChange={(e) => setDestinatariosReporte(e.target.value)}
                    placeholder="nombre@chaideychaide.com, otro@chaideychaide.com"
                    rows={2}
                    className="w-full bg-white border border-gray-200 rounded-lg px-2 py-1.5 text-[10px] text-slate-700 font-bold outline-none focus:border-indigo-500 resize-none"
                  />
                  <Button
                    onClick={handleEnviarReporte}
                    disabled={isSendingReporte || !destinatariosReporte.trim()}
                    className="w-full mt-3 h-9 rounded-xl gap-2 font-black text-[10px] uppercase bg-indigo-600 text-white hover:bg-indigo-700"
                  >
                    {isSendingReporte ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Mail className="w-3.5 h-3.5" />} Enviar
                  </Button>
                </PopoverContent>
              </Popover>
            </div>
            <div className="space-y-3">
              <div className="flex items-center gap-3">
                <span className="text-[9px] font-black text-slate-400 w-12">DÍA:</span>
                <select value={selectedDiaShift} onChange={(e) => setSelectedDiaShift(e.target.value)} className="bg-white border border-gray-200 rounded-lg px-2 py-1.5 text-[10px] text-indigo-700 flex-1 font-black outline-none appearance-none cursor-pointer">
                  {diaShiftOptions.map(o => <option key={o.v} value={o.v}>{o.l}</option>)}
                </select>
                <span className="text-[8px] font-black text-indigo-700 whitespace-nowrap tabular-nums" title="Disponibilidad neta del turno Día (-13% OEE)">{diaDisponibleOEE.toFixed(2)}h</span>
              </div>
              <div className="flex items-center gap-3">
                <span className="text-[9px] font-black text-slate-400 w-12">NOCHE:</span>
                <select value={selectedNocheShift} onChange={(e) => setSelectedNocheShift(e.target.value)} className="bg-white border border-gray-200 rounded-lg px-2 py-1.5 text-[10px] text-indigo-700 flex-1 font-black outline-none appearance-none cursor-pointer">
                  {nocheShiftOptions.map(o => <option key={o.v} value={o.v}>{o.l}</option>)}
                </select>
                <span className="text-[8px] font-black text-purple-700 whitespace-nowrap tabular-nums" title="Disponibilidad neta del turno Noche (-13% OEE)">{nocheDisponibleOEE.toFixed(2)}h</span>
              </div>
              <div className="flex items-center gap-3">
                <span className="text-[9px] font-black text-slate-400 w-12">SÁBADO:</span>
                <select value={selectedSabadoShift} onChange={(e) => setSelectedSabadoShift(e.target.value)} className="bg-white border border-gray-200 rounded-lg px-2 py-1.5 text-[10px] text-amber-700 flex-1 font-black outline-none appearance-none cursor-pointer">
                  {diaShiftOptions.map(o => <option key={o.v} value={o.v}>{o.l}</option>)}
                </select>
                <span className="text-[8px] font-black text-amber-700 whitespace-nowrap tabular-nums" title="Disponibilidad neta del turno Sábado (-13% OEE) -- se suma aparte de Día, no lo reemplaza">{sabadoDisponibleOEE.toFixed(2)}h</span>
              </div>
              <div className="flex items-center gap-3">
                <span className="text-[9px] font-black text-slate-400 w-12">MTTO:</span>
                <Popover>
                  <PopoverTrigger asChild>
                    <button type="button" className="flex-1 bg-indigo-50/60 border border-indigo-200 rounded-lg px-2 py-1.5 flex items-center justify-between hover:bg-indigo-50 transition-colors cursor-pointer">
                      <span className="text-[8px] font-black text-indigo-700 uppercase flex items-center gap-1"><Info className="w-3 h-3" /> MTTO PREVENTIVO</span>
                      <span className="text-[10px] font-black text-indigo-700">{mttoPreventivoHoras.toFixed(2)} H</span>
                    </button>
                  </PopoverTrigger>
                  <PopoverContent className="w-[300px] p-4 bg-white border border-gray-100 rounded-2xl shadow-xl text-slate-800" align="start">
                    <p className="text-[9px] font-black uppercase text-indigo-700 tracking-widest mb-1">Operación Adicional — Looper</p>
                    <p className="text-[8px] text-slate-400 font-bold uppercase mb-3">Tareas de mantenimiento preventivo programadas</p>
                    {mttoPreventivoTasks.length === 0 ? (
                      <p className="text-[10px] text-slate-400 italic">Sin mantenimientos programados para la(s) fecha(s) seleccionada(s)</p>
                    ) : (
                      <div className="space-y-2">
                        {mttoPreventivoTasks.map((t, i) => (
                          <div key={i} className="flex items-center justify-between gap-2 text-[9px] border-b border-gray-100 pb-1.5">
                            <span className="font-bold uppercase text-slate-600 truncate max-w-[140px]" title={t.maquina}>{t.maquina}</span>
                            <span className="text-slate-400 font-mono">{t.fecha || '—'}</span>
                            <span className="font-black text-indigo-700 whitespace-nowrap">{t.horas.toFixed(2)}h</span>
                          </div>
                        ))}
                        <div className="flex items-center justify-between pt-1 text-[9px]">
                          <span className="font-black uppercase text-slate-800">Total</span>
                          <span className="font-black text-indigo-700">{mttoPreventivoHoras.toFixed(2)}h</span>
                        </div>
                      </div>
                    )}
                  </PopoverContent>
                </Popover>
              </div>
            </div>
          </div>

          {/* 5. Personal Asignado (5 cols - Ampliada) */}
          <div className="col-span-5 p-4 flex flex-col justify-center bg-gray-50/50">
            <div className="flex items-center justify-between mb-4">
              <p className="text-[8px] font-black uppercase text-slate-400 tracking-widest">PERSONAL ASIGNADO — LAMINADO CILÍNDRICO</p>
              <button
                type="button"
                onClick={handleAutoAssignPersonnel}
                title="Asigna automáticamente según calificación: Operador A (>50%) en OP-01, Ayudante B (≤50%) en OP-02, para ambos turnos"
                className="text-[7px] font-black uppercase tracking-wider text-emerald-700 border border-emerald-300 bg-white rounded px-2 py-1 hover:bg-emerald-50 transition-colors"
              >
                Auto-asignar por calificación
              </button>
            </div>
            <div className="grid grid-cols-2 gap-8">
              <div className="space-y-2 border-l-2 border-indigo-400 pl-4">
                <p className="text-[8px] text-indigo-700 uppercase font-black tracking-widest mb-2">TURNO DÍA</p>
                <div className="space-y-3">
                   <div className="grid grid-cols-12 items-center gap-2">
                      <span className="col-span-3 text-[8px] text-slate-400 font-black">OP-01</span>
                      <select value={assignedPersonnel.diaOp1} onChange={(e) => handleAssignOperator('diaOp1', e.target.value)}
                        className="col-span-9 bg-white border border-gray-200 rounded px-2 py-1.5 text-[9px] text-slate-700 font-black outline-none focus:border-indigo-500">
                        <option value="">— SELECCIONAR —</option>
                        {operadoresLaminado.map((op, i) => {
                          const code = getProp(op, ['CodigoOperador ', 'CODIGO_OPERADOR']);
                          const taken = isOperatorTakenElsewhere('diaOp1', code);
                          return (
                            <option key={i} value={code} disabled={taken}>
                              {getProp(op, ['NombreOperador', 'NOMBRE_OPERADOR'])} — [{getProp(op, ['Calificacion', 'CALIFICACION'])}]{taken ? ' (ASIGNADO)' : ''}
                            </option>
                          );
                        })}
                      </select>
                   </div>
                   <div className="grid grid-cols-12 items-center gap-2">
                      <span className="col-span-3 text-[8px] text-slate-400 font-black">OP-02</span>
                      <select value={assignedPersonnel.diaOp2} onChange={(e) => handleAssignOperator('diaOp2', e.target.value)}
                        className="col-span-9 bg-white border border-gray-200 rounded px-2 py-1.5 text-[9px] text-slate-700 font-black outline-none focus:border-indigo-500">
                        <option value="">— SELECCIONAR —</option>
                        {operadoresLaminado.map((op, i) => {
                          const code = getProp(op, ['CodigoOperador ', 'CODIGO_OPERADOR']);
                          const taken = isOperatorTakenElsewhere('diaOp2', code);
                          return (
                            <option key={i} value={code} disabled={taken}>
                              {getProp(op, ['NombreOperador', 'NOMBRE_OPERADOR'])} — [{getProp(op, ['Calificacion', 'CALIFICACION'])}]{taken ? ' (ASIGNADO)' : ''}
                            </option>
                          );
                        })}
                      </select>
                   </div>
                </div>
              </div>

              <div className="space-y-2 border-l-2 border-purple-400 pl-4">
                <p className="text-[8px] text-purple-700 uppercase font-black tracking-widest mb-2">TURNO NOCHE</p>
                <div className="space-y-3">
                   <div className="grid grid-cols-12 items-center gap-2">
                      <span className="col-span-3 text-[8px] text-slate-400 font-black">OP-01</span>
                      <select value={assignedPersonnel.nocheOp1} onChange={(e) => handleAssignOperator('nocheOp1', e.target.value)}
                        className="col-span-9 bg-white border border-gray-200 rounded px-2 py-1.5 text-[9px] text-slate-700 font-black outline-none focus:border-purple-500">
                        <option value="">— SELECCIONAR —</option>
                        {operadoresLaminado.map((op, i) => {
                          const code = getProp(op, ['CodigoOperador ', 'CODIGO_OPERADOR']);
                          const taken = isOperatorTakenElsewhere('nocheOp1', code);
                          return (
                            <option key={i} value={code} disabled={taken}>
                              {getProp(op, ['NombreOperador', 'NOMBRE_OPERADOR'])} — [{getProp(op, ['Calificacion', 'CALIFICACION'])}]{taken ? ' (ASIGNADO)' : ''}
                            </option>
                          );
                        })}
                      </select>
                   </div>
                   <div className="grid grid-cols-12 items-center gap-2">
                      <span className="col-span-3 text-[8px] text-slate-400 font-black">OP-02</span>
                      <select value={assignedPersonnel.nocheOp2} onChange={(e) => handleAssignOperator('nocheOp2', e.target.value)}
                        className="col-span-9 bg-white border border-gray-200 rounded px-2 py-1.5 text-[9px] text-slate-700 font-black outline-none focus:border-purple-500">
                        <option value="">— SELECCIONAR —</option>
                        {operadoresLaminado.map((op, i) => {
                          const code = getProp(op, ['CodigoOperador ', 'CODIGO_OPERADOR']);
                          const taken = isOperatorTakenElsewhere('nocheOp2', code);
                          return (
                            <option key={i} value={code} disabled={taken}>
                              {getProp(op, ['NombreOperador', 'NOMBRE_OPERADOR'])} — [{getProp(op, ['Calificacion', 'CALIFICACION'])}]{taken ? ' (ASIGNADO)' : ''}
                            </option>
                          );
                        })}
                      </select>
                   </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-12 bg-gray-50/70 border-t border-gray-100">
          <div className="col-span-3 p-4 border-r border-gray-100 flex items-center justify-center gap-6">
            <div className="text-[10px] font-black text-slate-400 uppercase tracking-widest">OCUPACIÓN REAL (%)</div>
            <div className="flex items-center gap-3">
              <div className={cn("w-3 h-3 rounded-full shadow-[0_0_10px]", ocupacionPorc > 100 ? "bg-red-500 shadow-red-500 animate-pulse" : "bg-emerald-500 shadow-emerald-500")} />
              <span className={cn("text-2xl font-black tabular-nums", ocupacionPorc > 100 ? "text-red-600" : "text-emerald-600")}>{ocupacionPorc.toFixed(1)}%</span>
            </div>
          </div>
          <div className="col-span-2 p-4 border-r border-gray-100 flex flex-col items-center justify-center">
            <p className="text-[9px] font-black text-slate-400 uppercase tracking-tighter mb-1">TIEMPO OPERATIVO (H)</p>
            <span className="text-2xl font-black text-emerald-600 leading-none tabular-nums">{totalsUnified.tProceso.toFixed(2)}</span>
          </div>
          <div className="col-span-2 p-4 border-r border-gray-100 flex flex-col items-center justify-center">
            <p className="text-[9px] font-black text-slate-400 uppercase tracking-tighter mb-1">DISPONIBILIDAD TOTAL (H)</p>
            <span className="text-2xl font-black text-amber-600 leading-none tabular-nums">{tDisponible.toFixed(2)}</span>
            <p className="text-[7px] font-bold text-slate-400 uppercase tracking-tighter mt-1">Día {diaDisponibleOEE.toFixed(2)}h + Noche {nocheDisponibleOEE.toFixed(2)}h{selectedSabadoShift !== 'EMPTY' ? ` + Sábado ${sabadoDisponibleOEE.toFixed(2)}h` : ''} (-13% OEE c/u) -{mttoPreventivoHoras.toFixed(2)}h MTTO</p>
          </div>
          <div className="col-span-5 flex items-center px-6">
             {isSaturated && (
               <div className="flex items-center gap-3 text-red-600 animate-pulse">
                  <AlertCircle className="w-6 h-6 flex-shrink-0" />
                  <p className="text-[10px] font-black uppercase leading-tight">Capacidad Crítica: Evaluar minimización de corridas para optimizar ocupación.</p>
               </div>
             )}
          </div>
        </div>
      </div>
    );
  };

  if (!mounted) return <div className="p-4 md:p-6 min-h-screen bg-white" />;

  return (
    <div className="p-4 md:p-6 space-y-6 bg-white min-h-screen rounded-xl border border-gray-100 shadow-sm font-sans text-left">
      <div className="flex items-center justify-between pb-4 border-b border-gray-100">
        <div className="flex items-center space-x-3 text-left">
          <div className="p-2 bg-red-600/10 rounded-xl shadow-inner"><Scissors className="w-6 h-6 text-red-600" /></div>
          <div>
            <h2 className="text-xl font-black text-gray-800 uppercase tracking-tighter">Programación Táctica Laminado</h2>
            <p className="text-[10px] text-gray-400 font-bold uppercase tracking-widest">Setup: {SETUP_TIME_PER_RUN}min | Auditoría Multialmacén SAP</p>
          </div>
        </div>
        <div className="flex items-center gap-3">
           {/* "Sincronizar y Generar Necesidades": un solo botón, un solo clic — antes eran 2 pasos
               separados (Sincronizar, luego Generar Necesidades); el usuario los pidió combinados por
               ser repetitivos en el uso diario. Sincroniza y, en cuanto los datos ya se reflejan en el
               render, dispara el cálculo automáticamente (ver handleSincronizarYGenerar/syncStep). */}
           <Button onClick={handleSincronizarYGenerar} disabled={syncStep !== 'idle'} variant={datosCargados ? 'outline' : 'default'} className={cn(
             "rounded-xl h-10 px-6 text-[10px] font-black uppercase tracking-widest flex items-center gap-2",
             datosCargados ? "border-blue-200 text-blue-700 hover:bg-blue-50" : "bg-blue-600 text-white hover:bg-blue-700 shadow-lg"
           )}>
              {syncStep !== 'idle' ? <Loader2 className="w-4 h-4 animate-spin" /> : <RefreshCw className="w-4 h-4" />} Sincronizar y Generar Necesidades
           </Button>
           <Popover>
            <PopoverTrigger asChild>
              <button className="h-10 px-5 rounded-2xl border border-gray-200 bg-white hover:border-red-500/50 flex items-center gap-3 font-black text-[11px] uppercase shadow-sm transition-all">
                <Filter className="w-4 h-4 text-red-500" /> 
                {selectedDates.size === 0 ? 'Plan Maestro' : `${selectedDates.size} días seleccionados`}
              </button>
            </PopoverTrigger>
            <PopoverContent className="w-[260px] p-0 border-none shadow-2xl rounded-2xl overflow-hidden mt-3" align="end">
              <div className="bg-white p-5 font-sans text-left">
                <div className="flex items-center justify-between mb-5">
                  <h3 className="text-xs font-black text-slate-800 capitalize">{format(viewDate, 'MMMM yyyy', { locale: es })}</h3>
                  <div className="flex gap-1 bg-slate-50 p-1 rounded-xl">
                    <Button variant="ghost" size="icon" onClick={() => setViewDate(prev => subMonths(prev, 1))} className="h-8 w-8 hover:bg-white"><ChevronLeft className="w-4 h-4" /></Button>
                    <Button variant="ghost" size="icon" onClick={() => setViewDate(prev => addMonths(prev, 1))} className="h-8 w-8 hover:bg-white"><ChevronRight className="w-4 h-4" /></Button>
                  </div>
                </div>
                <div className="grid grid-cols-7 gap-y-1.5 text-center mb-4">
                  {['LU', 'MA', 'MI', 'JU', 'VI', 'SA', 'DO'].map(d => <div key={d} className="text-[10px] font-black text-slate-300 py-1">{d}</div>)}
                  {calendarDaysList.map((day, idx) => {
                    if (!day) return <div key={idx} />;
                    const dStr = format(day, 'yyyy-MM-dd');
                    const isSelected = selectedDates.has(dStr);
                    return (
                      <button key={dStr} onClick={() => { const n = new Set(selectedDates); if (isSelected) { n.delete(dStr); } else { n.add(dStr); } setSelectedDates(n); }} className={cn("relative h-8 w-8 mx-auto rounded-xl flex items-center justify-center transition-all", isSelected ? "bg-red-600 text-white shadow-md shadow-red-200" : "hover:bg-slate-50")}>
                        <span className={cn("text-xs font-black", isSelected ? "text-white" : (datesWithOrders.has(dStr) ? "text-slate-700" : "text-slate-200"))}>{format(day, 'd')}</span>
                        {datesWithOrders.has(dStr) && !isSelected && <div className="absolute bottom-1.5 w-1 h-1 bg-red-400 rounded-full" />}
                      </button>
                    );
                  })}
                </div>
                <Button variant="ghost" size="sm" className="w-full text-[10px] font-black uppercase text-red-600 h-9 mt-1 rounded-xl tracking-widest" onClick={() => setSelectedDates(new Set())}>Ver Todo el Plan</Button>
              </div>
            </PopoverContent>
          </Popover>
        </div>
      </div>

      {/* Barra de progreso SOLO de la fase "sincronizando" (traer datos crudos de SAP, sin indicador
          propio). La fase "generando" ya tiene su propia barra, más detallada (Generando Necesidades:
          X/Y, ver resumenProgress más abajo en la tabla) — mostrar esta también ahí duplicaba el
          aviso (reportado por el usuario con una captura real: 2 barras a la vez). */}
      {syncStep === 'sincronizando' && (
        <div className="flex items-center gap-3 rounded-xl border border-blue-100 bg-blue-50/40 px-4 py-2.5">
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
          redacción compacta que Corte Espuma y Venta Externa (ver [[carga_manual_modulos_tacticos]]). */}
      {!datosCargados && !isLoading && (
        <div
          className="flex items-center gap-2.5 rounded-xl border border-dashed border-blue-200 bg-blue-50/40 px-4 py-2.5 text-left"
          title="Este módulo no consulta SAP al abrirse. Sincronizar trae Grupos, Restricciones, Provisionales, FERT, KPI Looper, Inventario, Habilidades y Mantenimiento, y calcula el resumen automáticamente al terminar."
        >
          <RefreshCw className="w-4 h-4 text-blue-600 shrink-0" />
          <p className="text-[11px] font-bold text-slate-600">
            Sin datos cargados — pulsa <span className="font-black text-blue-700">Sincronizar y Generar Necesidades</span> para traerlos.
          </p>
        </div>
      )}

      <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
        <TabsList className="grid grid-cols-5 h-11 bg-gray-100/50 p-1.5 rounded-2xl border border-gray-200 mb-8">
          {[
            { v: 'resumen', l: 'Resumen Necesidades', i: LayoutDashboard },
            { v: 'necesidadesPlanta', l: 'Necesidades Planta', i: Boxes },
            // Tab "Provisionales" (v: 'ordenes') oculto: dejó de aportar al cálculo de Resumen
            // Necesidades (ver handleProcessResumen) y su tabla es solo auditoría manual de SAP.
            // El TabsContent y filteredOrders se conservan en el código (no se eliminan) porque
            // filteredOrders sigue siendo necesario para datesWithOrders (calendario) y el guard de
            // handleProcessResumen.
            { v: 'ordenesFert', l: 'Órdenes FERT', i: ShoppingCart },
            { v: 'inventario', l: 'Inventarios SAP', i: Database },
            { v: 'salida', l: 'Salida de Datos', i: ClipboardList }
          ].map(tab => (
            <TabsTrigger key={tab.v} value={tab.v} className="gap-2 text-[10px] font-black uppercase transition-all data-[state=active]:bg-white data-[state=active]:shadow-lg data-[state=active]:text-red-600 rounded-xl">
              <tab.i className="w-4 h-4" /> {tab.l}
            </TabsTrigger>
          ))}
        </TabsList>

        <TabsContent value="resumen" className="space-y-6 animate-in fade-in duration-300">
          {/* "Generar Respuestas": antes vivía en un panel flotante arrastrable sobre la tabla (para
              seguir alcanzable en un plan con muchas filas, sin scroll). El usuario lo encontró poco
              claro y pidió pasarlo a botón estático — pero NO en el header global junto a
              Sincronizar (que es una acción de módulo completo), sino debajo de la fila de tabs,
              contextual al tab "Resumen Necesidades" donde vive la tabla que se está aprobando —
              mismo patrón que "Generar Necesidades · P1/PFF" en Corte Espuma (vive dentro del tab
              "Necesidades Planta", no en el header). Se acepta el trade-off de tener que volver
              arriba (al inicio de este tab, no de la página) para generar la respuesta tras
              revisar/ajustar filas más abajo. Colores unificados con Corte Espuma (única fuente ya
              consistente): P3 = negro sólido (es la respuesta real que se envía, el commit de más
              peso); PFD = índigo outline, mismo peso que "Generar Necesidades"/"Editar Plan" (es un
              reporte de faltante, no la respuesta final). */}
          <div className="flex items-center gap-3 flex-wrap justify-end">
            <Button
              onClick={handleOpenGuardarPlan}
              disabled={isSavingPlan || respuestaSalidaRows.every(r => r.cantidadKg <= 0)}
              className="rounded-xl h-10 px-6 text-[10px] font-black uppercase tracking-widest flex items-center gap-2 bg-slate-900 hover:bg-slate-800 text-white shadow-lg"
            >
              {isSavingPlan ? <Loader2 className="w-4 h-4 animate-spin" /> : <ClipboardList className="w-4 h-4" />}
              {isSavingPlan ? 'Guardando...' : 'Generar Respuestas · P3 - Rollos'}
            </Button>
            <Button
              onClick={handleOpenGuardarPlanPFD}
              disabled={isSavingPlanPFD || respuestaSalidaRows.length === 0}
              variant="outline"
              className="rounded-xl h-10 px-6 text-[10px] font-black uppercase tracking-widest flex items-center gap-2 border-indigo-200 text-indigo-700 hover:bg-indigo-50"
            >
              {isSavingPlanPFD ? <Loader2 className="w-4 h-4 animate-spin" /> : <ClipboardList className="w-4 h-4" />}
              {isSavingPlanPFD ? 'Guardando...' : 'Generar Respuestas · PFD - Rollos'}
            </Button>
            <Button
              onClick={handleOpenEditarPlan}
              disabled={isLoadingEditPlan}
              variant="outline"
              className="rounded-xl h-10 px-6 text-[10px] font-black uppercase tracking-widest flex items-center gap-2 border-indigo-200 text-indigo-700 hover:bg-indigo-50"
            >
              {isLoadingEditPlan ? <Loader2 className="w-4 h-4 animate-spin" /> : <Pencil className="w-4 h-4" />}
              {isLoadingEditPlan ? 'Cargando...' : 'Editar Plan'}
            </Button>
          </div>
          {renderTopConsolidation()}

          <div className="rounded-2xl border border-gray-100 shadow-sm overflow-hidden bg-white mt-8">
            <div className="overflow-x-auto max-h-[600px] relative text-left">
              <table className="w-full border-collapse font-sans text-[11px] text-center">
                <thead className="sticky top-0 z-20">
                  <tr className="bg-slate-100 text-slate-700 uppercase font-black tracking-tighter text-[10px] border-b-2 border-slate-300">
                    <th className="px-4 py-4 border-r border-black/5 text-left w-32">Material</th>
                    <th className="px-6 py-4 border-r border-black/5 text-left min-w-[200px]">Descripción</th>
                    <th className="px-2 py-4 border-r border-black/5 text-slate-700">Peso (Kg)</th>
                    <th className="px-2 py-4 border-r border-black/5 text-slate-700">Dens.</th>
                    <th className="px-2 py-4 border-r border-black/5 text-slate-700">T. Rollo (Min)</th>
                    <th className="px-3 py-4 border-r border-black/5 text-slate-700">Stock 1006 (Kg)</th>
                    <th className="px-2 py-4 border-r border-black/5 text-slate-700">UN 1006</th>
                    <th className="px-3 py-4 border-r border-black/5 text-slate-700">Stock 1008 (Kg)</th>
                    <th className="px-2 py-4 border-r border-black/5 text-slate-700">UN 1008</th>
                    <th className="px-3 py-4 border-r border-black/5 text-slate-700">Stock 1015 (Kg)</th>
                    <th className="px-2 py-4 border-r border-black/5 text-slate-700">UN 1015</th>
                    <th className="px-3 py-4 border-r border-black/5 text-amber-800 bg-amber-50/60 uppercase">Producción Diaria (Kg)</th>
                    <th className="px-2 py-4 border-r border-black/5 text-amber-800 bg-amber-50/60 uppercase">Producción Diaria (Un)</th>
                    <th className="px-3 py-4 border-r border-black/10 bg-indigo-50 text-indigo-700 uppercase">T. ROLLOS BODEGAS UN</th>
                    <th className="px-3 py-4 border-r border-black/10 bg-indigo-50 text-indigo-700 uppercase">T. ROLLOS BODEGAS KG</th>
                    <th className="px-4 py-4 border-r border-black/5 text-right text-teal-800 bg-teal-50/60 uppercase">NEC. PLANTA [Kg]</th>
                    <th className="px-4 py-4 border-r border-black/5 text-right text-slate-700 uppercase">OF_HALB [Kg]</th>
                    <th className="px-4 py-4 border-r border-black/10 text-right bg-slate-100 text-slate-800 font-black uppercase">T. NECESIDADES [Kg]</th>
                    <th className="px-3 py-4 border-r border-black/5 text-teal-800 bg-teal-50/60 uppercase">NEC. PLANTA [Un]</th>
                    <th className="px-3 py-4 border-r border-black/5 text-slate-700 uppercase">HALB [Un]</th>
                    <th className="px-3 py-4 border-r border-black/10 bg-amber-50 text-amber-700 font-black uppercase">T. NECESIDADES [Un]</th>
                    <th className="px-3 py-4 border-r border-black/5 text-center uppercase" title="Rojo = déficit de stock (Forros/Muebles con prioridad, o Venta Externa aplazado); click Aprobar si ya tiene corrida asignada. % = participación Forros/Muebles dentro del bloque, sin Venta Externa.">semaforo % Nec.</th>
                    <th className="px-4 py-4 border-r border-black/5 text-right font-black bg-[#fee2e2] text-red-900 uppercase">PLAN (UN)</th>
                    <th className="px-4 py-4 border-r border-black/5 text-right font-black bg-[#fee2e2] text-red-900 uppercase">PLAN (KG)</th>
                    <th className="px-4 py-4 text-right font-black bg-indigo-50 text-indigo-700 uppercase">T. PROCESO (H)</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50">
                  {isProcessingResumen ? (
                    <tr><td colSpan={25} className="py-20 text-center">
                      <Loader2 className="w-8 h-8 animate-spin mx-auto text-red-500 mb-3" />
                      <p className="text-[10px] font-black uppercase text-slate-400 mb-3">
                        Generando Necesidades: {resumenProgress.current} / {resumenProgress.total}
                      </p>
                      <div className="w-full max-w-md mx-auto h-2 bg-slate-100 rounded-full overflow-hidden">
                        <div
                          className="h-full bg-red-600 transition-all duration-300"
                          style={{ width: `${resumenProgress.total > 0 ? Math.min((resumenProgress.current / resumenProgress.total) * 100, 100) : 0}%` }}
                        />
                      </div>
                      <p className="text-[9px] font-bold text-slate-300 mt-2 tabular-nums">
                        {resumenProgress.total > 0 ? Math.round((resumenProgress.current / resumenProgress.total) * 100) : 0}%
                      </p>
                    </td></tr>
                  ) : (
                    groupedNeeds.map((group) => {
                      const groupKey = `${group.apertura}|${group.densidad}`;
                      const isExp = expandedGroups.has(groupKey);
                      return (
                        <React.Fragment key={groupKey}>
                          <tr className={cn("hover:brightness-95 cursor-pointer transition-all border-l-4 font-black", getDensityColor(group.densidad))} onClick={() => toggleGroup(groupKey)}>
                            <td className="px-4 py-4 text-left border-r border-gray-100/10 flex items-center gap-2">
                               {isExp ? <Minus className="w-3 h-3 text-red-500" /> : <Plus className="w-3 h-3 text-indigo-500" />}
                               {/* Apertura se mantiene, pero discreta: "12 SL" existe en más de una apertura real
                                   (ej. 200 y 214) — ocultarla del todo haría indistinguibles esos dos bloques,
                                   aunque sigan siendo grupos internamente distintos (groupKey = apertura|densidad). */}
                               <div className="flex flex-col leading-tight">
                                  <span className="font-black text-[10px] uppercase tracking-widest text-slate-700">D{group.densidad}</span>
                                  <span className="text-[8px] font-bold text-slate-400 uppercase tracking-wide">Apertura {group.apertura}</span>
                               </div>
                            </td>
                            <td className="px-6 py-4 text-left font-black uppercase">
                               <div className="flex flex-col gap-1.5">
                                  {group.hasGroupDeficit ? (
                                    <div className="flex items-center gap-2"><div className="w-3 h-3 rounded-full bg-red-500 animate-pulse" /><span className="text-red-700">CORRIDA NECESARIA LOOPER D-{group.densidad}</span></div>
                                  ) : (
                                    <div className="flex items-center gap-2"><div className="w-3 h-3 rounded-full bg-green-500" /><span className="text-indigo-900">CORRIDA LOOPER D-{group.densidad}</span></div>
                                  )}
                                  <div className="flex items-center gap-1.5 normal-case" onClick={(e) => e.stopPropagation()}>
                                     <span className="text-[9px] text-slate-500 font-black uppercase tracking-wide">Corridas</span>
                                     <button
                                       type="button"
                                       onClick={() => { setCorridasDraft(prev => { const n = { ...prev }; delete n[groupKey]; return n; }); handleUpdateCorridasBloque(group.apertura, group.densidad, Math.max(0, group.runs - 1)); }}
                                       title="Quitar una corrida"
                                       className="w-5 h-5 flex items-center justify-center rounded border border-slate-300 bg-white text-slate-600 font-black leading-none hover:bg-slate-100 focus:outline-none focus:ring-2 focus:ring-indigo-400"
                                     >−</button>
                                     <input
                                       type="number"
                                       min="0"
                                       value={corridasDraft[groupKey] !== undefined ? corridasDraft[groupKey] : group.runs}
                                       onChange={(e) => setCorridasDraft(prev => ({ ...prev, [groupKey]: e.target.value }))}
                                       onBlur={() => commitCorridasDraft(group.apertura, group.densidad)}
                                       onKeyDown={commitDraftOnEnter}
                                       className={cn(
                                         "w-10 bg-white border rounded px-1 text-center font-black focus:outline-none focus:ring-2",
                                         (group.items[0]?.runsRecomendado ?? 0) !== group.runs
                                           ? "border-amber-400 text-amber-700 focus:ring-amber-400"
                                           : "border-slate-200 text-slate-700 focus:ring-indigo-400"
                                       )}
                                     />
                                     <button
                                       type="button"
                                       onClick={() => { setCorridasDraft(prev => { const n = { ...prev }; delete n[groupKey]; return n; }); handleUpdateCorridasBloque(group.apertura, group.densidad, group.runs + 1); }}
                                       title="Agregar una corrida"
                                       className="w-5 h-5 flex items-center justify-center rounded border border-slate-300 bg-white text-slate-600 font-black leading-none hover:bg-slate-100 focus:outline-none focus:ring-2 focus:ring-indigo-400"
                                     >+</button>
                                     <span className="text-[9px] text-slate-400 font-bold whitespace-nowrap">recomendado: {group.items[0]?.runsRecomendado ?? 0}</span>
                                     {(() => {
                                       const recomendado = group.items[0]?.runsRecomendado ?? 0;
                                       const delta = group.runs - recomendado;
                                       if (delta === 0) return null;
                                       // Subir corridas por encima del recomendado no genera riesgo de cobertura (solo
                                       // deja stock de sobra): se marca como "refuerzo" informativo, no como alerta.
                                       // Bajar por debajo del recomendado sí puede dejar déficit real sin cubrir: se
                                       // marca en tono de advertencia. En ambos casos el botón hace lo mismo: volver
                                       // al valor recomendado (mismo mecanismo de redistribución).
                                       const isRefuerzo = delta > 0;
                                       return (
                                         <>
                                           <span className={cn(
                                             "text-[8px] font-black rounded px-1.5 py-0.5 flex items-center gap-1 whitespace-nowrap border",
                                             isRefuerzo ? "text-sky-700 bg-sky-50 border-sky-300" : "text-amber-700 bg-amber-50 border-amber-300"
                                           )}>
                                             {isRefuerzo ? <Info className="w-2.5 h-2.5" /> : <AlertCircle className="w-2.5 h-2.5" />}
                                             {isRefuerzo ? `CORRIDA ADICIONAL (+${delta})` : `AJUSTE MANUAL (${delta}) · BAJO EL DÉFICIT`}
                                           </span>
                                           <button
                                             type="button"
                                             onClick={() => { setCorridasDraft(prev => { const n = { ...prev }; delete n[groupKey]; return n; }); handleUpdateCorridasBloque(group.apertura, group.densidad, recomendado); }}
                                             title="Restablecer al valor recomendado"
                                             className="w-5 h-5 flex items-center justify-center rounded border border-slate-300 bg-white text-slate-500 hover:bg-slate-100 focus:outline-none focus:ring-2 focus:ring-indigo-400"
                                           >
                                             <RefreshCw className="w-2.5 h-2.5" />
                                           </button>
                                         </>
                                       );
                                     })()}
                                  </div>
                               </div>
                            </td>
                            <td colSpan={11} className="border-r border-gray-100/10"></td>
                            <td className="px-3 py-4 bg-indigo-50 text-indigo-700 font-mono border-r border-gray-100/10">{formatNum(group.totalStockUN, 0)}</td>
                            <td className="px-3 py-4 bg-indigo-50 text-indigo-700 font-mono border-r border-gray-100/10">{formatNum(group.totalStockKg, 0)}</td>
                            <td className="px-4 py-4 text-right font-mono font-black text-teal-800 bg-teal-50/40 border-r border-gray-100/10">{formatNum(group.totalKg, 0)}</td>
                            <td className="px-4 py-4 text-right font-mono font-black text-slate-700 bg-indigo-50/50 border-r border-gray-100/10">{formatNum(group.totalKgHalb, 0)}</td>
                            <td className="px-4 py-4 text-right font-mono font-black text-slate-800 bg-slate-100 border-r border-gray-100/10">{formatNum(group.totalConsumoKg, 0)}</td>
                            <td className="px-3 py-4 font-mono font-black text-teal-900 bg-teal-50/40 border-r border-gray-100/10">{formatNum(group.totalRollos, 0)}</td>
                            <td className="px-3 py-4 bg-[#d1d5db]/50 font-mono text-slate-800 border-r border-gray-100/10">{formatNum(group.totalRollosHalb, 0)}</td>
                            <td className="px-3 py-4 bg-amber-50 font-mono text-amber-700 border-r border-gray-100/10">{formatNum(group.totalNroRollos, 0)}</td>
                            <td className="border-r border-gray-100/10"></td>
                            <td className="px-4 py-4 text-right font-mono font-black text-red-900 bg-[#fee2e2] border-r border-gray-100/10">{formatNum(group.totalPlanUn, 0)}</td>
                            <td className="px-4 py-4 text-right font-mono font-black text-red-900 bg-[#fee2e2] border-r border-gray-100/10">{formatNum(group.totalPlanKg, 0)}</td>
                            <td className="px-4 py-4 text-right font-mono font-black text-indigo-700 bg-indigo-50">{formatNum(group.totalTProceso, 1)}</td>
                          </tr>
                          {isExp && buildDisplayOrder(group.items).map(({ item, nested }, iIdx) => (
                            <tr key={`${groupKey}-${iIdx}`} className={cn("transition-colors font-bold text-slate-700", nested ? "bg-slate-50/70 hover:bg-slate-100" : "bg-white hover:bg-blue-50")}>
                              <td className={cn("px-4 py-3 border-r border-gray-100 font-mono font-black text-indigo-600 text-left", nested ? "pl-16" : "pl-10")}>
                                {nested && <span className="text-slate-300 mr-1">↳</span>}
                                {item.material}
                              </td>
                              <td className="px-6 py-3 border-r border-gray-100 text-left text-slate-900 font-black uppercase leading-tight truncate max-w-[250px]">
                                {item.descripcion}
                                {nested && <span className="ml-2 text-[8px] font-black normal-case tracking-wide text-amber-700 bg-amber-50 border border-amber-200 rounded px-1.5 py-0.5 align-middle whitespace-nowrap">Otra máquina · no cuenta corrida</span>}
                              </td>
                              <td className="px-2 py-3 border-r border-gray-100 font-mono text-slate-700">{Math.round(item.peso).toLocaleString()}</td>
                              <td className="px-2 py-3 border-r border-gray-100 text-slate-700">{item.densidad}</td>
                              <td className="px-2 py-3 border-r border-gray-100 font-mono text-slate-700">{item.looperTRolloMin || '—'}</td>
                              <td className="px-3 py-3 border-r border-gray-100 font-mono text-slate-700">{item.stock1006 > 0 ? Math.round(item.stock1006).toLocaleString() : '—'}</td>
                              <td className="px-2 py-3 border-r border-gray-100 font-mono text-indigo-900">{item.stockUN1006 > 0 ? Math.round(item.stockUN1006).toLocaleString() : '—'}</td>
                              <td className="px-3 py-3 border-r border-gray-100 font-mono text-slate-700">{item.stock1008 > 0 ? Math.round(item.stock1008).toLocaleString() : '—'}</td>
                              <td className="px-2 py-3 border-r border-gray-100 font-mono text-indigo-900">{item.stockUN1008 > 0 ? Math.round(item.stockUN1008).toLocaleString() : '—'}</td>
                              <td className="px-3 py-3 border-r border-gray-100 font-mono text-slate-700">{item.stock1015 > 0 ? Math.round(item.stock1015).toLocaleString() : '—'}</td>
                              <td className="px-2 py-3 border-r border-gray-100 font-mono text-indigo-900">{item.stockUN1015 > 0 ? Math.round(item.stockUN1015).toLocaleString() : '—'}</td>
                              <td className="px-3 py-3 border-r border-gray-100 font-mono text-amber-800 bg-amber-50/20">{item.prodDiariaKg > 0 ? Math.round(item.prodDiariaKg).toLocaleString() : '—'}</td>
                              <td className="px-2 py-3 border-r border-gray-100 font-mono text-amber-900 bg-amber-50/20">{item.prodDiariaUn > 0 ? Math.round(item.prodDiariaUn).toLocaleString() : '—'}</td>
                              <td className="px-3 py-4 border-r border-gray-100 font-mono text-indigo-900 bg-indigo-50/10">{Math.round(item.totalStockUN).toLocaleString()}</td>
                              <td className="px-3 py-4 border-r border-gray-100 font-mono text-indigo-900 bg-indigo-50/10">{Math.round(item.totalStockKg).toLocaleString()}</td>
                              <td className="px-4 py-3 border-r border-gray-100 text-right font-mono text-teal-800 bg-teal-50/30">{Math.round(item.consumoKg).toLocaleString()}</td>
                              <td className="px-4 py-3 border-r border-gray-100 text-right font-mono text-slate-700">{Math.round(item.consumoKgHalb).toLocaleString()}</td>
                              <td className="px-4 py-3 border-r border-gray-100 text-right font-mono text-slate-900 font-black">{Math.round(item.totalConsumoKg).toLocaleString()}</td>
                              <td className="px-3 py-3 border-r border-gray-100 font-mono text-teal-900 bg-teal-50/30 font-black">{Math.round(item.consumoUn).toLocaleString()}</td>
                              <td className="px-3 py-3 border-r border-gray-100 bg-[#d1d5db]/10 font-mono text-slate-900">{Math.round(item.nroRollosHalb).toLocaleString()}</td>
                              <td className="px-3 py-3 border-r border-gray-100 bg-slate-100/10 font-mono text-slate-900 font-black">{Math.round(item.totalNroRollos).toLocaleString()}</td>
                              <td className="px-3 py-3 border-r border-gray-100 text-center font-black">
                                 <div className="flex flex-col items-center gap-1">
                                    {(() => {
                                      const deficitKey = `${item.material}|${item.apertura}|${item.densidad}`;
                                      // Ya no se distingue "rojo duro" (Venta Externa) de "rojo blando" (Forros/
                                      // Muebles) — Venta Externa dejó de ser un piso obligatorio (puede aplazarse,
                                      // ver TIER 1/2/3 en handleProcessResumen). Cualquier déficit de stock se
                                      // trata igual y admite "Aprobar" cuando ya hay corrida asignada.
                                      const requiereAprobacion = item.hasDeficit && item.planUn > 0;
                                      const aprobado = requiereAprobacion && approvedDeficitRows.has(deficitKey);
                                      const enVerde = !item.hasDeficit || aprobado;
                                      return (
                                        <>
                                          <div className={cn(
                                            "w-3 h-3 rounded-full",
                                            enVerde ? "bg-green-500" : "bg-red-500 shadow-[0_0_8px_#ef4444]"
                                          )} />
                                          <span className={cn("text-[8px] font-black uppercase tracking-tighter", enVerde ? "text-green-700" : "text-red-700")}>
                                            {!item.hasDeficit ? "STOCK OK" : aprobado ? "CORRIDA ASIGNADA" : "STOCK BAJO"}
                                          </span>
                                          <span className="text-[9px] text-slate-900 font-black font-mono" title="Participación dentro del bloque — solo Forros/Muebles, Venta Externa no compite por este %">
                                            {(item.porcentajeNecesidad * 100).toFixed(1)}%
                                          </span>
                                          {item.necVentaExternaUn > 0 && (
                                            <span className="text-[7px] text-indigo-700 font-black font-mono bg-indigo-50 border border-indigo-200 rounded px-1 py-0.5" title="Necesidad de Venta Externa — se cubre según prioridad y stock disponible; puede quedar corta y aplazarse sin bloquear nada">
                                              VE: {item.necVentaExternaUn.toLocaleString()} UN
                                            </span>
                                          )}
                                          {requiereAprobacion && (
                                            <button
                                              type="button"
                                              onClick={(e) => { e.stopPropagation(); toggleAprobarDeficit(item.material, item.apertura, item.densidad); }}
                                              title={aprobado ? "Aprobado con corrida ya asignada — click para revertir" : "Stock bajo pero ya tiene corrida asignada: aprobar confirma que la corrida corrige la necesidad"}
                                              className={cn(
                                                "flex items-center gap-1 text-[7px] font-black uppercase tracking-wide rounded px-1.5 py-0.5 border whitespace-nowrap",
                                                aprobado ? "bg-emerald-50 text-emerald-700 border-emerald-300" : "bg-red-50 text-red-700 border-red-300 animate-pulse"
                                              )}
                                            >
                                              {aprobado ? <CheckCircle2 className="w-2.5 h-2.5" /> : <AlertCircle className="w-2.5 h-2.5" />}
                                              {aprobado ? "APROBADO" : "APROBAR"}
                                            </button>
                                          )}
                                        </>
                                      );
                                    })()}
                                 </div>
                              </td>
                              <td className="px-2 py-3 border-r border-black/10 bg-[#fee2e2]/20">
                                 {(() => {
                                   // Material 100% Venta Externa (sin participación Forros/Muebles, porcentajeNecesidad
                                   // === 0): PLAN (UN) es editable igual que cualquier otro material — Venta Externa
                                   // ya no tiene un piso obligatorio que proteger (puede quedar corta y aplazarse, ver
                                   // TIER 1/2/3 en handleProcessResumen); el override manual se respeta igual en el
                                   // recálculo automático (planManualOverrides).
                                   const planUnKey = `${item.material}|${item.apertura}|${item.densidad}`;
                                   return (
                                     <input
                                       type="number"
                                       min="0"
                                       value={planUnDraft[planUnKey] !== undefined ? planUnDraft[planUnKey] : item.planUn}
                                       onChange={(e) => setPlanUnDraft(prev => ({ ...prev, [planUnKey]: e.target.value }))}
                                       onBlur={() => commitPlanUnDraft(item.material, item.apertura, item.densidad)}
                                       onKeyDown={commitDraftOnEnter}
                                       className="w-16 bg-white border border-red-200 rounded px-1 text-center font-black text-red-900 focus:outline-none focus:ring-2 focus:ring-red-400"
                                     />
                                   );
                                 })()}
                              </td>
                              <td className="px-4 py-3 border-r border-black/10 text-right font-mono text-red-900 bg-[#fee2e2]/20">{Math.round(item.planKg).toLocaleString()}</td>
                              <td className="px-4 py-3 text-right font-mono font-black text-indigo-900 bg-indigo-50/10">{formatNum(item.tProceso, 1)}</td>
                            </tr>
                          ))}
                        </React.Fragment>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </div>


          <Dialog open={planActivoPendienteConfirmacion !== null} onOpenChange={(open) => { if (!open && !isEjecutandoModificacionAutomatica) setPlanActivoPendienteConfirmacion(null); }}>
            <DialogContent className="max-w-xl">
              <DialogHeader>
                <DialogTitle>Confirmar desactivación de Plan Activo</DialogTitle>
                <DialogDescription>
                  La(s) fecha(s) seleccionada(s) incluye una ya vencida o de hoy, cubierta por el/los siguiente(s)
                  Plan Grupo P3 (creados en un día anterior a hoy). Al confirmar, se reconcilian sus detalles contra
                  la necesidad recién calculada y se marcan como inactivos (estado &apos;I&apos;). Esta acción no crea un plan
                  nuevo ni afecta Provisionales/FERT.
                </DialogDescription>
              </DialogHeader>
              {planActivoPendienteConfirmacion && (
                <div className="border border-slate-100 rounded-xl overflow-hidden">
                  <table className="w-full text-[11px] border-collapse">
                    <thead className="bg-gray-50 text-gray-400 uppercase font-bold">
                      <tr>
                        <th className="px-3 py-2 text-left">Plan Grupo</th>
                        <th className="px-3 py-2 text-left">Valor</th>
                        <th className="px-3 py-2 text-left">Rango</th>
                        <th className="px-3 py-2 text-left">Creado</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-50">
                      {planActivoPendienteConfirmacion.planes.map(plan => (
                        <tr key={plan.codigo_plan_grupo}>
                          <td className="px-3 py-2 font-mono">#{plan.codigo_plan_grupo}</td>
                          <td className="px-3 py-2">{plan.valor}</td>
                          <td className="px-3 py-2 font-mono">{soloFecha(plan.fecha_inicio_plan)} → {soloFecha(plan.fecha_fin_plan)}</td>
                          <td className="px-3 py-2 font-mono">{soloFecha(plan.fecha_creacion)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
              <DialogFooter>
                <Button variant="outline" onClick={() => setPlanActivoPendienteConfirmacion(null)} disabled={isEjecutandoModificacionAutomatica}>Cancelar</Button>
                <Button onClick={handleConfirmarModificacionAutomaticaPlanActivo} disabled={isEjecutandoModificacionAutomatica} className="bg-red-600 hover:bg-red-700 text-white">
                  {isEjecutandoModificacionAutomatica ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
                  {isEjecutandoModificacionAutomatica ? 'Desactivando...' : 'Confirmar y Desactivar'}
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>

          {redistribuirToast && (
            <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-[60] w-full max-w-md bg-white border border-indigo-200 rounded-2xl shadow-2xl p-4 flex items-start gap-3 animate-in slide-in-from-bottom-4">
              <Info className="w-5 h-5 text-indigo-600 flex-shrink-0 mt-0.5" />
              <div className="flex-1 text-left">
                <p className="text-[11px] font-black text-slate-800 leading-snug">
                  Bloque <span className="font-mono">{redistribuirToast.apertura}/{redistribuirToast.densidad}</span>: material <span className="font-mono">{redistribuirToast.material}</span> pasó a {redistribuirToast.editedValue.toLocaleString()} UN
                  {redistribuirToast.techoNuevo !== redistribuirToast.techoActual && (
                    <> ({redistribuirToast.techoActual.toLocaleString()} → {redistribuirToast.techoNuevo.toLocaleString()} UN de capacidad)</>
                  )}.
                </p>
                <p className="text-[10px] text-slate-400 font-bold mt-1">¿Redistribuir la diferencia entre los demás materiales del bloque según su % de participación?</p>
                <div className="flex items-center gap-2 mt-3">
                  <Button size="sm" onClick={handleConfirmarCompletarTecho} className="h-7 px-3 text-[10px] font-black bg-indigo-600 hover:bg-indigo-700 text-white">Redistribuir</Button>
                  <Button size="sm" variant="outline" onClick={handleDescartarCompletarTecho} className="h-7 px-3 text-[10px] font-black">Dejar así</Button>
                </div>
              </div>
            </div>
          )}

          <Dialog open={planPreview !== null} onOpenChange={(open) => { if (!open && !isSavingPlan) setPlanPreview(null); }}>
            <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
              <DialogHeader>
                <DialogTitle>Confirmar creación de Plan Grupo</DialogTitle>
                <DialogDescription>
                  Revisa los datos que se van a grabar antes de continuar. Esta acción crea registros nuevos en producción.
                </DialogDescription>
              </DialogHeader>
              {planPreview && (
                <div className="space-y-4 text-left text-sm">
                  <div className="grid grid-cols-2 gap-3 bg-slate-50 rounded-xl p-4 border border-slate-100">
                    <div><span className="font-black text-slate-500 text-[10px] uppercase block">Grupo</span>{planPreview.nombreGrupo} (código {planPreview.codigo_grupo})</div>
                    <div><span className="font-black text-slate-500 text-[10px] uppercase block">Valor Plan</span>{planPreview.valor}</div>
                    <div><span className="font-black text-slate-500 text-[10px] uppercase block">Fecha Inicio</span>{planPreview.fechaInicio}</div>
                    <div><span className="font-black text-slate-500 text-[10px] uppercase block">Fecha Fin</span>{planPreview.fechaFin}</div>
                  </div>
                  <div>
                    <span className="font-black text-slate-500 text-[10px] uppercase block mb-2">Materiales a guardar ({planPreview.rows.length})</span>
                    <div className="border border-slate-100 rounded-xl overflow-hidden max-h-[260px] overflow-y-auto">
                      <table className="w-full text-[11px] border-collapse">
                        <thead className="bg-gray-50 text-gray-400 uppercase font-bold sticky top-0">
                          <tr>
                            <th className="px-3 py-2 text-left">Material</th>
                            <th className="px-3 py-2 text-left">Descripción</th>
                            <th className="px-3 py-2 text-center">¿Corrida?</th>
                            <th className="px-3 py-2 text-right">Cantidad Un</th>
                            <th className="px-3 py-2 text-right">Cantidad Kg</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-50">
                          {planPreview.rows.map(row => (
                            <tr key={row.material}>
                              <td className="px-3 py-2 font-mono">{row.material}</td>
                              <td className="px-3 py-2 truncate max-w-[220px]">{row.descripcion}</td>
                              <td className="px-3 py-2 text-center">{row.tieneCorrida ? 'Sí' : 'Stock'}</td>
                              <td className="px-3 py-2 text-right font-mono">{Math.round(row.cantidadUn)}</td>
                              <td className="px-3 py-2 text-right font-mono">{row.cantidadKg.toLocaleString(undefined, { maximumFractionDigits: 1 })}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                </div>
              )}
              <DialogFooter>
                <Button variant="outline" onClick={() => setPlanPreview(null)} disabled={isSavingPlan}>Cancelar</Button>
                <Button onClick={handleConfirmGuardarPlan} disabled={isSavingPlan} className="bg-emerald-600 hover:bg-emerald-700 text-white">
                  {isSavingPlan ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
                  {isSavingPlan ? 'Guardando...' : 'Confirmar y Guardar'}
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>

          <Dialog open={planPreviewPFD !== null} onOpenChange={(open) => { if (!open && !isSavingPlanPFD) setPlanPreviewPFD(null); }}>
            <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
              <DialogHeader>
                <DialogTitle>Confirmar creación de Plan Grupo PFD</DialogTitle>
                <DialogDescription>
                  Revisa los datos que se van a grabar antes de continuar. Los materiales &quot;No — stock&quot; se guardan con cantidad 0. Esta acción crea registros nuevos en producción.
                </DialogDescription>
              </DialogHeader>
              {planPreviewPFD && (
                <div className="space-y-4 text-left text-sm">
                  <div className="grid grid-cols-2 gap-3 bg-slate-50 rounded-xl p-4 border border-slate-100">
                    <div><span className="font-black text-slate-500 text-[10px] uppercase block">Grupo</span>{planPreviewPFD.nombreGrupo} (código {planPreviewPFD.codigo_grupo})</div>
                    <div><span className="font-black text-slate-500 text-[10px] uppercase block">Valor Plan</span>{planPreviewPFD.valor}</div>
                    <div><span className="font-black text-slate-500 text-[10px] uppercase block">Fecha Inicio</span>{planPreviewPFD.fechaInicio}</div>
                    <div><span className="font-black text-slate-500 text-[10px] uppercase block">Fecha Fin</span>{planPreviewPFD.fechaFin}</div>
                  </div>
                  <div>
                    <span className="font-black text-slate-500 text-[10px] uppercase block mb-2">Materiales a guardar ({planPreviewPFD.rows.length})</span>
                    <div className="border border-slate-100 rounded-xl overflow-hidden max-h-[260px] overflow-y-auto">
                      <table className="w-full text-[11px] border-collapse">
                        <thead className="bg-gray-50 text-gray-400 uppercase font-bold sticky top-0">
                          <tr>
                            <th className="px-3 py-2 text-left">Material</th>
                            <th className="px-3 py-2 text-left">Descripción</th>
                            <th className="px-3 py-2 text-center">¿Corrida?</th>
                            <th className="px-3 py-2 text-right">Cantidad Un</th>
                            <th className="px-3 py-2 text-right">Cantidad Kg</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-50">
                          {planPreviewPFD.rows.map(row => (
                            <tr key={row.material}>
                              <td className="px-3 py-2 font-mono">{row.material}</td>
                              <td className="px-3 py-2 truncate max-w-[220px]">{row.descripcion}</td>
                              <td className="px-3 py-2 text-center">{row.tieneCorrida ? 'Sí — plan' : 'No — stock'}</td>
                              <td className="px-3 py-2 text-right font-mono">{Math.round(row.cantidadUn)}</td>
                              <td className="px-3 py-2 text-right font-mono">{row.cantidadKg.toLocaleString(undefined, { maximumFractionDigits: 1 })}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                </div>
              )}
              <DialogFooter>
                <Button variant="outline" onClick={() => setPlanPreviewPFD(null)} disabled={isSavingPlanPFD}>Cancelar</Button>
                <Button onClick={handleConfirmGuardarPlanPFD} disabled={isSavingPlanPFD} className="bg-amber-600 hover:bg-amber-700 text-white">
                  {isSavingPlanPFD ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
                  {isSavingPlanPFD ? 'Guardando...' : 'Confirmar y Guardar'}
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>

          <Dialog open={planesGrupoDisponibles !== null} onOpenChange={(open) => { if (!open && !isLoadingEditPlan) { setPlanesGrupoDisponibles(null); setPlanGrupoSeleccionado(null); } }}>
            <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
              <DialogHeader>
                <DialogTitle>¿Qué Plan Grupo quieres editar?</DialogTitle>
                <DialogDescription>
                  Hay {planesGrupoDisponibles?.length ?? 0} Plan Grupo activo(s) para Corte y Laminado (Centro 1000). El último guardado queda preseleccionado; elige otro si necesitas corregir uno anterior.
                </DialogDescription>
              </DialogHeader>
              {planesGrupoDisponibles && (
                <div className="border border-slate-100 rounded-xl overflow-hidden max-h-[320px] overflow-y-auto">
                  <table className="w-full text-[11px] border-collapse">
                    <thead className="bg-gray-50 text-gray-400 uppercase font-bold sticky top-0">
                      <tr>
                        <th className="px-3 py-2 text-left w-8"></th>
                        <th className="px-3 py-2 text-left">Código</th>
                        <th className="px-3 py-2 text-left">Valor Plan</th>
                        <th className="px-3 py-2 text-left">Fecha Inicio</th>
                        <th className="px-3 py-2 text-left">Fecha Fin</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-50">
                      {planesGrupoDisponibles.map((p, idx) => (
                        <tr
                          key={p.codigo_plan_grupo}
                          onClick={() => setPlanGrupoSeleccionado(p.codigo_plan_grupo)}
                          className={cn("cursor-pointer transition-colors", planGrupoSeleccionado === p.codigo_plan_grupo ? "bg-indigo-50" : "hover:bg-slate-50")}
                        >
                          <td className="px-3 py-2 text-center">
                            <input type="radio" readOnly checked={planGrupoSeleccionado === p.codigo_plan_grupo} className="accent-indigo-600" />
                          </td>
                          <td className="px-3 py-2 font-mono font-black">
                            #{p.codigo_plan_grupo}{idx === 0 && <span className="ml-2 text-[8px] font-black uppercase text-emerald-700 bg-emerald-50 border border-emerald-200 rounded-full px-1.5 py-0.5">Último guardado</span>}
                          </td>
                          <td className="px-3 py-2">{p.valor}</td>
                          <td className="px-3 py-2 font-mono">{soloFecha(p.fecha_inicio_plan) || '—'}</td>
                          <td className="px-3 py-2 font-mono">{soloFecha(p.fecha_fin_plan) || '—'}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
              <DialogFooter>
                <Button variant="outline" onClick={() => { setPlanesGrupoDisponibles(null); setPlanGrupoSeleccionado(null); }} disabled={isLoadingEditPlan}>Cancelar</Button>
                <Button onClick={handleConfirmarSeleccionPlan} disabled={isLoadingEditPlan || !planGrupoSeleccionado} className="bg-indigo-600 hover:bg-indigo-700 text-white">
                  {isLoadingEditPlan ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
                  {isLoadingEditPlan ? 'Cargando...' : 'Continuar'}
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>

          <Dialog open={editPlanPreview !== null} onOpenChange={(open) => { if (!open && !isSavingEditPlan) setEditPlanPreview(null); }}>
            <DialogContent className="max-w-3xl max-h-[85vh] overflow-y-auto">
              <DialogHeader>
                <DialogTitle>Editar Plan Grupo guardado</DialogTitle>
                <DialogDescription>
                  Se recalculó la salida de datos actual del Plan Grupo #{editPlanPreview?.codigo_plan_grupo}: los materiales que ya no aplican quedaron premarcados para eliminar. Corrige cantidades, agrega o quita materiales si hace falta. Los cambios se graban solo al confirmar.
                </DialogDescription>
              </DialogHeader>
              {editPlanPreview && (
                <div className="space-y-4 text-left text-sm">
                  <div className="grid grid-cols-2 gap-3 bg-slate-50 rounded-xl p-4 border border-slate-100">
                    <div><span className="font-black text-slate-500 text-[10px] uppercase block">Plan Grupo</span>#{editPlanPreview.codigo_plan_grupo} — {editPlanPreview.valor}</div>
                    <div><span className="font-black text-slate-500 text-[10px] uppercase block">Vigencia</span>{editPlanPreview.fechaInicio} a {editPlanPreview.fechaFin}</div>
                  </div>

                  <div>
                    <span className="font-black text-slate-500 text-[10px] uppercase block mb-2">Materiales ({editPlanPreview.rows.filter(r => !r.marcadoEliminar).length})</span>
                    <div className="border border-slate-100 rounded-xl overflow-hidden max-h-[280px] overflow-y-auto">
                      <table className="w-full text-[11px] border-collapse">
                        <thead className="bg-gray-50 text-gray-400 uppercase font-bold sticky top-0">
                          <tr>
                            <th className="px-3 py-2 text-left">Material</th>
                            <th className="px-3 py-2 text-left">Descripción</th>
                            <th className="px-3 py-2 text-right">Cantidad (Kg)</th>
                            <th className="px-3 py-2 text-center">Acción</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-50">
                          {editPlanPreview.rows.map((row, idx) => (
                            <tr key={`${row.material}-${idx}`} className={cn(row.marcadoEliminar && "opacity-40 line-through", row.esNuevo && !row.marcadoEliminar && "bg-emerald-50/50")}>
                              <td className="px-3 py-2 font-mono">{row.material}</td>
                              <td className="px-3 py-2 truncate max-w-[200px]">{row.descripcion}</td>
                              <td className="px-3 py-2 text-right">
                                <input
                                  type="number"
                                  value={row.cantidad}
                                  disabled={row.marcadoEliminar}
                                  onChange={(e) => handleUpdateEditRowCantidad(idx, parseFloat(e.target.value) || 0)}
                                  className="w-24 bg-white border border-slate-200 rounded px-2 py-1 text-right font-mono focus:outline-none focus:ring-2 focus:ring-indigo-400 disabled:bg-slate-100"
                                />
                              </td>
                              <td className="px-3 py-2 text-center">
                                <button type="button" onClick={() => handleRemoveEditRow(idx)} className={cn("p-1.5 rounded-lg", row.marcadoEliminar ? "text-emerald-600 hover:bg-emerald-50" : "text-red-500 hover:bg-red-50")} title={row.marcadoEliminar ? "Deshacer" : "Quitar"}>
                                  <Trash2 className="w-4 h-4" />
                                </button>
                              </td>
                            </tr>
                          ))}
                          {editPlanPreview.rows.length === 0 && (
                            <tr><td colSpan={4} className="py-8 text-center text-slate-300 uppercase font-black tracking-widest italic">Sin materiales</td></tr>
                          )}
                        </tbody>
                      </table>
                    </div>
                  </div>

                  {materialesDisponiblesParaAgregar.length > 0 && (
                    <div>
                      <span className="font-black text-slate-500 text-[10px] uppercase block mb-2">Agregar material del Resumen actual</span>
                      <div className="flex flex-wrap gap-2 max-h-[120px] overflow-y-auto p-1">
                        {materialesDisponiblesParaAgregar.map(m => (
                          <button
                            key={m.material}
                            type="button"
                            onClick={() => handleAddMaterialToEditPlan(m.material)}
                            className="text-[10px] font-black uppercase px-3 py-1.5 rounded-full border border-indigo-200 text-indigo-700 hover:bg-indigo-50 flex items-center gap-1"
                          >
                            <Plus className="w-3 h-3" /> {m.material} — {m.descripcion}
                          </button>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )}
              <DialogFooter>
                <Button variant="outline" onClick={() => setEditPlanPreview(null)} disabled={isSavingEditPlan}>Cancelar</Button>
                <Button onClick={handleConfirmEditarPlan} disabled={isSavingEditPlan} className="bg-indigo-600 hover:bg-indigo-700 text-white">
                  {isSavingEditPlan ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
                  {isSavingEditPlan ? 'Guardando...' : 'Guardar Cambios'}
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </TabsContent>

        <TabsContent value="necesidadesPlanta" className="animate-in fade-in duration-300 space-y-10 text-left">
          <div className="flex items-center justify-between">
            <p className="text-[9px] font-bold text-slate-400 uppercase tracking-widest">
              Se actualiza automáticamente al guardar o editar un plan. Usa este botón si otra área registró cambios.
            </p>
            <Button
              onClick={() => fetchNecesidadesPlanta()}
              disabled={necesidadesPlantaLoading}
              variant="outline"
              className="rounded-xl h-10 px-6 text-[10px] font-black uppercase tracking-widest flex items-center gap-2 border-indigo-200 text-indigo-700 hover:bg-indigo-50"
            >
              {necesidadesPlantaLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <RefreshCw className="w-4 h-4" />} Actualizar P2
            </Button>
          </div>
          {necesidadesPlantaLoading ? (
            <div className="flex items-center justify-center py-24 text-slate-300"><Loader2 className="w-6 h-6 animate-spin" /></div>
          ) : Object.keys(necesidadesPlantaData).length === 0 ? (
            <div className="py-24 text-center text-slate-300 uppercase font-black tracking-widest italic opacity-50">Sin necesidades de planta detectadas</div>
          ) : (
            <MaterialSummaryTable data={necesidadesPlantaData} />
          )}
        </TabsContent>

        <TabsContent value="ordenes" className="space-y-6 animate-in fade-in duration-300 text-left">
          <div className="rounded-2xl border border-gray-100 shadow-sm overflow-hidden bg-white">
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200 border-collapse font-sans text-[11px] text-center">
                <thead className="bg-gray-50 uppercase font-bold tracking-widest text-[9px] text-gray-400 sticky top-0 z-10">
                  <tr>
                    <th className="px-6 py-5 border-r border-gray-100">Orden</th>
                    <th className="px-6 py-5 border-r border-gray-100">Fecha Inicio</th>
                    <th className="px-6 py-5 border-r border-gray-100">Código FERT</th>
                    <th className="px-6 py-5 border-r border-gray-100 text-left">Descripción del Producto</th>
                    <th className="px-6 py-5 border-r border-gray-100">Cantidad</th>
                    <th className="px-6 py-5 border-r border-gray-100">Responsable</th>
                    <th className="px-6 py-5 border-r border-gray-100">Máquina</th>
                    <th className="px-6 py-5">Almacén</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50 font-bold text-slate-700">
                  {filteredOrders.length === 0 ? (
                    <tr><td colSpan={8} className="py-24 text-slate-300 font-black uppercase tracking-widest italic text-center">No se detectaron órdenes para los criterios aplicados</td></tr>
                  ) : (
                    filteredOrders.map((o, i) => {
                      const { code, desc } = extractMaterialInfo(o);
                      const resp = getProp(o, ['RESPCONTROLPROD', 'RESPCTRLPROD', 'RespControlProd', 'RESP_CONTROL_PROD', 'RESPONSABLE']);
                      return (
                        <tr key={i} className="hover:bg-slate-50 transition-colors">
                          <td className="px-6 py-4 font-black text-slate-900 border-r border-gray-50">{getProp(o, ['ORDENPREVISIONAL', 'ORDEN']) || '—'}</td>
                          <td className="px-6 py-4 border-r border-gray-50 font-mono text-[9px] text-slate-500 text-center">{getProp(o, ['FECHAINICIO', 'FECHA']) || '—'}</td>
                          <td className="px-6 py-4 font-mono font-black text-red-600 border-r border-gray-50 tracking-tighter text-sm text-center">{code}</td>
                          <td className="px-6 py-4 text-left border-r border-gray-100 text-slate-800 font-black uppercase leading-tight max-w-[450px]">{desc}</td>
                          <td className="px-6 py-4 font-black text-slate-900 border-r border-gray-50 font-mono text-sm text-center">{Number(getProp(o, ['CANTPROGRAMADA', 'CANTIDAD', 'CANT_PROG']) || 0).toLocaleString()}</td>
                          <td className="px-6 py-4 border-r border-gray-50 text-center"><Badge variant="outline" className="text-[10px] font-black bg-blue-50 text-blue-700 border-blue-100">{resp || '—'}</Badge></td>
                          <td className="px-6 py-4 font-bold text-slate-600 border-r border-gray-50 text-[10px] uppercase text-center">{getProp(o, ['MAQUINA', 'RECURSO', 'ID_MAQUINA']) || '—'}</td>
                          <td className="px-6 py-4 font-bold text-slate-400 text-[10px] text-center">{getProp(o, ['Almacen', 'ALMACEN']) || '—'}</td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </TabsContent>

        <TabsContent value="ordenesFert" className="space-y-6 animate-in fade-in duration-300 text-left">
          <div className="rounded-2xl border border-gray-100 shadow-sm overflow-hidden bg-white">
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200 border-collapse font-sans text-[11px] text-center">
                <thead className="bg-gray-50 uppercase font-bold tracking-widest text-[9px] text-gray-400 sticky top-0 z-10">
                  <tr>
                    <th className="px-6 py-5 border-r border-gray-100">Orden FERT</th>
                    <th className="px-6 py-5 border-r border-gray-100">Fecha</th>
                    <th className="px-6 py-5 border-r border-gray-100">Código FERT</th>
                    <th className="px-6 py-5 border-r border-gray-100 text-left">Descripción del Producto</th>
                    <th className="px-6 py-5 border-r border-gray-100">Cant. Pendiente</th>
                    <th className="px-6 py-5 border-r border-gray-100">Responsable</th>
                    <th className="px-6 py-5 border-r border-gray-100">Máquina</th>
                    <th className="px-6 py-5">Almacén</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50 font-bold text-slate-700">
                  {filteredFertOrders.length === 0 ? (
                    <tr><td colSpan={8} className="py-24 text-slate-300 font-black uppercase tracking-widest italic text-center">No se detectaron órdenes FERT para los criterios aplicados</td></tr>
                  ) : (
                    filteredFertOrders.map((o, i) => {
                      const { code, desc } = extractMaterialInfo(o);
                      const orderNum = getProp(o, ['ORDEN', 'ORDEN_PROCESO', 'ORDEN_FERT']) || '—';
                      const date = getProp(o, ['FECHA', 'FECHAINICIO', 'FECHA_INICIO']);
                      const qty = Number(getProp(o, ['CANTPENDIENTE', 'CANT_PEND', 'CANTIDAD', 'CANT_PROG']) || 0);
                      const resp = getProp(o, ['RESPCTRLPROD', 'RESP_CONTROL_PROD', 'RESPONSABLE']);
                      const mach = getProp(o, ['MAQUINA', 'RECURSO', 'ID_MAQUINA']);
                      const alm = getProp(o, ['ALMACEN', 'CENTRO', 'Almacen']);
                      
                      return (
                        <tr key={i} className="hover:bg-indigo-50/20 transition-colors">
                          <td className="px-6 py-4 font-black text-slate-900 border-r border-gray-50 text-center">{orderNum}</td>
                          <td className="px-6 py-4 border-r border-gray-50 font-mono text-[9px] text-slate-500 text-center">{date}</td>
                          <td className="px-6 py-4 font-mono font-black text-red-600 border-r border-gray-50 tracking-tighter text-sm text-center">{code}</td>
                          <td className="px-6 py-4 text-left border-r border-white/10 text-slate-800 font-black uppercase leading-tight max-w-[450px]">{desc}</td>
                          <td className="px-6 py-4 font-black text-slate-900 border-r border-gray-50 font-mono text-sm text-center">{qty.toLocaleString()}</td>
                          <td className="px-6 py-4 border-r border-gray-50 text-center"><Badge variant="outline" className="text-[10px] font-black bg-indigo-50 text-indigo-700 border-indigo-100">{String(resp || '—')}</Badge></td>
                          <td className="px-6 py-4 font-bold text-slate-600 border-r border-gray-50 text-[10px] uppercase text-center">{mach || '—'}</td>
                          <td className="px-6 py-4 font-bold text-slate-400 text-[10px] text-center">{alm || '—'}</td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </TabsContent>

        <TabsContent value="inventario" className="animate-in fade-in duration-300 space-y-4 text-left">
          <div className="flex items-center justify-between px-2">
            <div className="flex items-center gap-3 text-left">
              <div className="p-2 bg-blue-600 rounded-xl text-white shadow-lg"><Database className="w-4 h-4" /></div>
              <h3 className="text-sm font-black uppercase tracking-widest text-slate-800">Inventario SAP Año Actual (Auditado)</h3>
            </div>
          </div>
          <Card className="rounded-2xl border border-blue-100 shadow-sm overflow-hidden bg-white">
            <div className="overflow-x-auto max-h-[600px] relative text-center">
              <table className="w-full border-collapse text-center font-sans text-[10px]">
                <thead className="bg-gray-50 uppercase font-bold tracking-widest text-[8px] text-gray-400 sticky top-0 z-10">
                  <tr>
                    <th className="px-4 py-5 border-r border-gray-100">Material</th>
                    <th className="px-6 py-5 border-r border-gray-100 text-left">Nombre</th>
                    <th className="px-3 py-5 border-r border-gray-100">Centro</th>
                    <th className="px-3 py-5 border-r border-gray-100 text-indigo-700">ALM.</th>
                    <th className="px-3 py-5 border-r border-gray-100 bg-green-50 text-green-700">Libre Utiliz.</th>
                    <th className="px-3 py-5 border-r border-gray-100 bg-blue-50 text-blue-700">En Traslado</th>
                    <th className="px-3 py-5 border-r border-gray-100">Insp. Calidad</th>
                    <th className="px-3 py-5 border-r border-gray-100 text-red-700">Bloqueado</th>
                    <th className="px-3 py-5 border-r border-gray-100">Punto Pedido</th>
                    <th className="px-3 py-5">Tipo</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50 text-[11px] font-black text-slate-700">
                  {inventarioSAP.filter(row => String(row.NOMBRE || row.DESCRIPCION || '').toUpperCase().includes('LAMINA CILINDRICA')).length === 0 ? (
                    <tr><td colSpan={10} className="py-24 text-slate-300 font-black uppercase tracking-widest italic text-center">No hay inventario registrado en los almacenes configurados</td></tr>
                  ) : (
                    inventarioSAP.filter(row => String(row.NOMBRE || row.DESCRIPCION || '').toUpperCase().includes('LAMINA CILINDRICA')).map((row, i) => (
                      <tr key={i} className="hover:bg-blue-50/10 transition-colors">
                        <td className="px-4 py-3 border-r border-dashed border-gray-100 font-mono text-blue-700 text-center font-black">{cleanCode(row.MATERIAL)}</td>
                        <td className="px-6 py-3 border-r border-dashed border-gray-100 text-left uppercase text-slate-700 font-black truncate max-w-[200px]" title={row.NOMBRE}>{row.NOMBRE || '—'}</td>
                        <td className="px-3 py-3 border-r border-dashed border-gray-100 text-center">{row.CENTRO}</td>
                        <td className="px-3 py-3 border-r border-dashed border-gray-100 text-indigo-700 font-black bg-indigo-50/30 text-center">{row.ALMACEN}</td>
                        <td className="px-3 py-3 border-r border-dashed border-gray-100 font-mono text-green-700 bg-green-50/30 text-center font-black">{Number(row.LIBREUTILIZACION || 0).toLocaleString()}</td>
                        <td className="px-3 py-3 border-r border-dashed border-gray-100 font-mono text-blue-700 bg-blue-50/30 text-center font-black">{Number(row.ENTRASLADO || 0).toLocaleString()}</td>
                        <td className="px-3 py-3 border-r border-dashed border-gray-100 font-mono text-slate-500 text-center">{Number(row.INSPECCCALIDAD || 0).toLocaleString()}</td>
                        <td className="px-3 py-3 border-r border-dashed border-gray-100 font-mono text-red-700 text-center">{Number(row.BLOQUEADO || 0).toLocaleString()}</td>
                        <td className="px-3 py-3 border-r border-dashed border-gray-100 font-mono text-indigo-600 text-center">{Number(row.PUNTOPEDIDO || 0).toLocaleString()}</td>
                        <td className="px-3 py-3 text-[10px] text-slate-400 text-center uppercase font-bold">{row.TIPO_MATERIAL}</td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </Card>
        </TabsContent>

        <TabsContent value="salida" className="animate-in fade-in duration-300 space-y-4 text-left">
          <div className="flex items-center justify-between px-2 flex-wrap gap-3">
            <div className="flex items-center gap-3 text-left">
              <div className="p-2 bg-red-600 rounded-xl text-white shadow-lg"><ClipboardList className="w-4 h-4" /></div>
              <div>
                <h3 className="text-sm font-black uppercase tracking-widest text-slate-800">Plan de Salida — Corridas Looper</h3>
                <p className="text-[9px] text-slate-400 font-bold uppercase tracking-widest">
                  Prioridad: 1) Déficit de stock &nbsp;2) % de déficit &nbsp;3) Mayor consumo (Kg) — corridas intercaladas por grupo
                </p>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <Button onClick={handleExportTxt} disabled={isValidandoExportTxt} className="bg-primary hover:bg-primary/90 text-primary-foreground rounded-xl h-10 px-6 text-[10px] font-black uppercase tracking-widest shadow-lg flex items-center gap-2">
                {isValidandoExportTxt ? <Loader2 className="w-4 h-4 animate-spin" /> : <Download className="w-4 h-4" />} {isValidandoExportTxt ? 'Validando P3…' : 'Exportar TXT'}
              </Button>
            </div>
          </div>

          <div className="rounded-2xl border border-gray-100 shadow-sm overflow-hidden bg-white">
            <div className="overflow-x-auto max-h-[600px] relative">
              <table className="w-full border-collapse font-sans text-[11px] text-center">
                <thead className="sticky top-0 z-20 bg-gray-50 uppercase font-bold tracking-widest text-[9px] text-gray-400">
                  <tr>
                    <th className="px-4 py-4 border-r border-gray-100">Fecha</th>
                    <th className="px-6 py-4 border-r border-gray-100 text-left">Corrida / Apertura</th>
                    <th className="px-4 py-4 border-r border-gray-100">Material</th>
                    <th className="px-6 py-4 border-r border-gray-100 text-left min-w-[220px]">Descripción</th>
                    <th className="px-4 py-4 border-r border-gray-100">Plan (Un)</th>
                    <th className="px-4 py-4 border-r border-gray-100">Plan (Kg)</th>
                    <th className="px-4 py-4 bg-red-50 text-red-700">Prioridad</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50 font-bold text-slate-700">
                  {outputPlanRows.length === 0 ? (
                    <tr><td colSpan={7} className="py-24 text-slate-300 font-black uppercase tracking-widest italic text-center">No hay corridas calculadas para los criterios actuales</td></tr>
                  ) : (
                    outputPlanRows.map((row, i) => {
                      const isFirstOfCorrida = i === 0 || outputPlanRows[i - 1].corridaId !== row.corridaId;
                      return (
                        <tr key={`${row.corridaId}-${row.material}-${i}`} className={cn("transition-colors", row.isConvNested ? "bg-slate-50/70 hover:bg-slate-100" : "hover:bg-red-50/20")}>
                          <td className="px-4 py-3 border-r border-gray-100">
                            {isFirstOfCorrida ? (
                              <input
                                type="date"
                                value={row.fecha}
                                onChange={(e) => handleUpdateCorridaFecha(row.corridaId, e.target.value)}
                                className="bg-white border border-gray-200 rounded-lg px-2 py-1 text-[10px] font-black text-slate-700 outline-none focus:border-red-400"
                              />
                            ) : (
                              <span className="text-[9px] text-slate-300 font-mono">{row.fecha}</span>
                            )}
                          </td>
                          <td className="px-6 py-3 border-r border-gray-100 text-left font-black uppercase text-slate-800">{row.corrida}</td>
                          <td className={cn("px-4 py-3 border-r border-gray-100 font-mono font-black text-indigo-600", row.isConvNested && "pl-8")}>
                            {row.isConvNested && <span className="text-slate-300 mr-1">↳</span>}
                            {row.material}
                          </td>
                          <td className="px-6 py-3 border-r border-gray-100 text-left uppercase leading-tight truncate max-w-[280px]" title={row.descripcion}>
                            {row.descripcion}
                            {row.isConvNested && <span className="ml-2 text-[8px] font-black normal-case tracking-wide text-amber-700 bg-amber-50 border border-amber-200 rounded px-1.5 py-0.5 align-middle whitespace-nowrap">Otra máquina · no cuenta corrida</span>}
                          </td>
                          <td className="px-4 py-3 border-r border-gray-100 font-mono text-red-900 bg-[#fee2e2]/30">{Math.round(row.planUn).toLocaleString()}</td>
                          <td className="px-4 py-3 border-r border-gray-100 font-mono text-red-900 bg-[#fee2e2]/30">{formatNum(row.planKg, 1)}</td>
                          <td className="px-4 py-3 bg-amber-50 text-amber-700 font-black">{row.isConvNested ? '—' : row.prioridad}</td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </div>

          <div className="flex items-center justify-between px-2 flex-wrap gap-3 pt-6">
            <div className="flex items-center gap-3 text-left">
              <div className="p-2 bg-amber-600 rounded-xl text-white shadow-lg"><ClipboardList className="w-4 h-4" /></div>
              <div>
                <h3 className="text-sm font-black uppercase tracking-widest text-slate-800">Simulación — Salida de Datos por Respuesta (Paso 3)</h3>
                <p className="text-[9px] text-slate-400 font-bold uppercase tracking-widest">
                  Materiales referenciados en &quot;Necesidades Planta&quot; · con corrida = cantidad planificada · sin corrida = stock disponible (bodegas + Producción Diaria) · aún no se graba en base de datos
                </p>
              </div>
            </div>
          </div>

          <div className="rounded-2xl border border-gray-100 shadow-sm overflow-hidden bg-white">
            <div className="overflow-x-auto max-h-[600px] relative">
              <table className="w-full border-collapse font-sans text-[11px] text-center">
                <thead className="sticky top-0 z-20 bg-gray-50 uppercase font-bold tracking-widest text-[9px] text-gray-400">
                  <tr>
                    <th className="px-4 py-4 border-r border-gray-100">Material</th>
                    <th className="px-6 py-4 border-r border-gray-100 text-left min-w-[220px]">Descripción</th>
                    <th className="px-4 py-4 border-r border-gray-100 text-left">Origen (Plan Grupo)</th>
                    <th className="px-4 py-4 border-r border-gray-100">¿Corrida?</th>
                    <th className="px-4 py-4 border-r border-gray-100">Cantidad (Un)</th>
                    <th className="px-4 py-4">Cantidad (Kg)</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50 font-bold text-slate-700">
                  {respuestaSalidaRows.length === 0 ? (
                    <tr><td colSpan={6} className="py-24 text-slate-300 font-black uppercase tracking-widest italic text-center">No hay materiales de &quot;Necesidades Planta&quot; para simular</td></tr>
                  ) : (
                    respuestaSalidaRows.map((row) => (
                      <tr key={row.material} className="hover:bg-amber-50/20 transition-colors">
                        <td className="px-4 py-3 border-r border-gray-100 font-mono font-black text-indigo-600">{row.material}</td>
                        <td className="px-6 py-3 border-r border-gray-100 text-left uppercase leading-tight truncate max-w-[280px]" title={row.descripcion}>{row.descripcion}</td>
                        <td className="px-4 py-3 border-r border-gray-100 text-left font-mono text-slate-500">{row.origenes}</td>
                        <td className="px-4 py-3 border-r border-gray-100">
                          <span className={cn("text-[9px] font-black uppercase px-2 py-1 rounded-full", row.tieneCorrida ? "bg-emerald-50 text-emerald-700 border border-emerald-200" : "bg-amber-50 text-amber-700 border border-amber-200")}>
                            {row.tieneCorrida ? 'Sí — plan' : 'No — stock'}
                          </span>
                        </td>
                        <td className="px-4 py-3 border-r border-gray-100 font-mono text-slate-900">{Math.round(row.cantidadUn).toLocaleString()}</td>
                        <td className="px-4 py-3 font-mono text-slate-900">{formatNum(row.cantidadKg, 1)}</td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
};
