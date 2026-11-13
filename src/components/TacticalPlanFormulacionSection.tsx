'use client';

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { 
  FlaskConical,
  Loader2,
  LayoutDashboard,
  Database,
  RefreshCw,
  Minus,
  Plus,
  ShoppingCart,
  TrendingUp,
  Table as TableIcon,
  Info,
  Mail,
  FileText,
} from 'lucide-react';
import { Card } from '@/components/ui/card';
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from '@/components/ui/button';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { grupoService } from '@/services/grupo.service';
import { restriccionService } from '@/services/restriccion.service';
import { serviciosService } from '@/services/servicios.service';
import { sapCompartido, refrescarDatosSap, refrescarAlSincronizar } from '@/lib/datos-sap-compartidos';
import { DatosSapEstado } from '@/components/DatosSapEstado';
import { useRuntimeInspector } from '@/services/RuntimeInspector';
import { useAppContext } from '@/context/AppProvider';
import type { Restriccion } from '@/types/interfaces';
import type { CuboInventariosItem } from '@/types/types';
import { cn } from '@/lib/utils';
import { useReportePlanTxt, useAutoCargaPlanVigente, ReportePlanTxtAcciones, ReportePlanTxtVistaPrevia, type OrigenEstadoPlan } from '@/components/ReportePlanTxtFlujo';
import { PanelProgreso, usePanelProgreso } from '@/components/PanelProgreso';
import { guardarEnCache, leerDeCache, actualizarEnCache } from '@/lib/cache-modulos';
import { CUPULA_MAX_CM } from '@/lib/bloques-espuma';
import { ventanaCorte } from '@/lib/ventana-corte';
import { nextBusinessDay, previousBusinessDay, addBusinessDays, esDiaNoLaborable, laborablesHorizonte, cargarDiasNoLaborables, type DiasNoLaborables } from '@/lib/dias-laborables';
import { buscarUltimoPlanTxt } from '@/lib/planes-txt';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';

const BLOCK_LENGTH_METERS = 20;
// Curado: disponible desde fabricación + 2 días (usuario 2026-10-31, misma regla que su Excel de Leader:
// HOY − fecha ≥ 2). Pendiente: los bloques para exportación curan 3 días — regla aún no aplicada.
const CURADO_DIAS_ESPERA = 2;

// Una fila del paso 2 (stock por Bloque Formulado y espacio de curado, ver stockCuradoPorEspacio).
interface StockCuradoRow {
  materialCode: string; descripcion: string; apertura: string; dens: string;
  curadosUN: number; curadosKg: number; enCuradoUN: number; enCuradoKg: number;
  pesoProm: number; stockSapKg: number;
  // Variación del peso de los bloques fabricados (ver estadisticaPeso).
  pesoN: number; pesoMin: number; pesoMax: number; pesoCV: number; pesoDescartados: number;
}

// Peso real del bloque = promedio de los bloques fabricados (usuario 2026-11-12). Excel Bloq.For del
// 12/11: variación por material ≤ 1,5 % salvo bloques parciales (30004624: uno de 653 Kg entre otros de
// ~1140), por eso se descartan los que se alejan más de ±20 % de la mediana antes de promediar.
const TOLERANCIA_PESO_MEDIANA = 0.2;
const estadisticaPeso = (pesos: number[]) => {
  if (pesos.length === 0) return { pesoProm: 0, pesoN: 0, pesoMin: 0, pesoMax: 0, pesoCV: 0, pesoDescartados: 0 };
  const orden = [...pesos].sort((a, b) => a - b);
  const mitad = Math.floor(orden.length / 2);
  const mediana = orden.length % 2 ? orden[mitad] : (orden[mitad - 1] + orden[mitad]) / 2;
  const validos = orden.filter(p => Math.abs(p / mediana - 1) <= TOLERANCIA_PESO_MEDIANA);
  const prom = validos.reduce((s, p) => s + p, 0) / validos.length;
  const desv = Math.sqrt(validos.reduce((s, p) => s + (p - prom) ** 2, 0) / validos.length);
  return { pesoProm: prom, pesoN: validos.length, pesoMin: validos[0], pesoMax: validos[validos.length - 1], pesoCV: prom > 0 ? desv / prom : 0, pesoDescartados: orden.length - validos.length };
};

// Paso 1 · Necesidad (usuario 2026-10-31): solo FERT (las provisionales varían, no es información real),
// por FECHAFIN, misma regla para todos (UIO, GYE 041 y Venta Externa 038). Planificado = FERT del día de corte D;
// Pendiente = FERT con saldo de hasta 3 días hábiles antes — más atrás ya es retraso del PT, y 3 días es
// lo que toma fabricar y curar un bloque.
const DIAS_PENDIENTE_FERT = 3;
// Venta Externa en Corte = responsable 038 (1 lámina cortada = 1 lámina empacada, se pasa a Kg por BOM).
const RESP_VENTA_EXTERNA = '038';
// GYE no tiene formuladora: su consumo de Bloque Formulado son las FERT 041 de UIO (sub-bloques cortados
// a medida y enviados; cantidad en UN de sub-bloque, Kg por BOM). Las láminas del centro 2000 consumen
// esos sub-bloques, no el formulado, así que no se cuentan (serían doble conteo).
const RESP_SUBBLOQUES_GYE = '041';
type TramoNecesidad = 'pendiente' | 'planificado';
type DestinoConsumo = '1000' | '2000' | 'VE';
const ETIQUETA_DESTINO: Record<DestinoConsumo, string> = { '1000': 'UIO', '2000': 'GYE (041)', VE: 'VE' };

// Responsables de Control de Producción que consumen el recurso Formulación, por centro — FALLBACK
// únicamente, para el ratito entre que el módulo se monta y "Sincronizar" trae la restricción real
// (ver respPorCentroDinamico). Verificado contra la restricción real del Grupo Formulación
// (RespCtrlProd_Consumo_1000 / RespCtrlProd_Consumo_2000) que compartió el usuario: este arreglo
// fijo estaba desactualizado (1000 traía "014"/"041" que no están en la restricción real, y le
// faltaban "029"/"031"/"040"; 2000 le faltaba "038") — quedó como reflejo de la restricción en el
// momento en que se escribió, no una fuente de verdad viva.
const RESPONSABLES_POR_CENTRO_FALLBACK: Record<string, string[]> = {
  '1000': ['013', '014', '036', '038', '039', '041', '044'],
  '2000': ['002', '039']
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

interface MaterialDimensions {
  dens: string;
  ancho: string;
  largo: string;
  esp: string;
  apertura: string;
  tipo: string;
}

const safeNum = (val: unknown): number => {
  const n = Number(val);
  return isNaN(n) ? 0 : n;
};

const cleanCode = (code: unknown): string => {
  return String(code || '').replace(/^0+/, '').trim();
};

// Fecha 'yyyy-MM-dd' de una orden SAP: acepta ISO (con hora tras 'T' o espacio) y DD/MM/YYYY; '' si
// no hay o viene "null".
const soloFechaOrden = (o: Record<string, unknown>, keys: string[]): string => {
  const v = getProp(o, keys);
  const iso = v.match(/^(\d{4}-\d{2}-\d{2})/);
  if (iso) return iso[1];
  const dmy = v.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})/);
  return dmy ? `${dmy[3]}-${dmy[2].padStart(2, '0')}-${dmy[1].padStart(2, '0')}` : '';
};
// FECHAFIN de una orden con el MISMO respaldo que Corte (auditMapper: sin FECHAFIN = orden de un solo
// día, su FECHAINICIO). 2026-10-28: sin este respaldo las FERT sin FECHAFIN no caían en el día de corte y
// el tab FERT quedaba vacío aunque la Salida de Datos sí las tenía.
const fechaFinOrden = (o: Record<string, unknown>): string =>
  soloFechaOrden(o, ['FECHAFIN', 'FECHA_FIN']) || soloFechaOrden(o, ['FECHAINICIO', 'FECHA', 'FECHA_INICIO']);

const formatNum = (val: unknown, decimals: number = 0): string => {
  const n = safeNum(val);
  return n.toLocaleString(undefined, {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals
  });
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

// Definición explícita de los espacios del tab "Control Curado". Cada espacio se identifica por
// CUATRO columnas de getTiemposCuradoBloqueFormulado — ESTADOTRAS, ESTADO, MAQUINA y
// CORRIDAPROCESO — centralizadas aquí para que el criterio de filtro sea auditable de un vistazo
// en vez de quedar disperso en callbacks inline dentro del render.
//
// estadoTras y estado son dos columnas DISTINTAS de la API (verificado con datos reales: una misma
// fila trae, por ejemplo, estadoTras="BLM" y estado="BCFR" simultáneamente — no son alias la una de
// la otra). Antes solo se filtraba por estadoTras/Maquina; el campo "estado" no se usaba en absoluto.
// Verificado con capturas reales etiquetadas por el usuario (LEADER/COFAMA) que el valor de "estado"
// NO es el mismo para ambos procesos — es CR para Leader, BCFR para Cofama.
interface CuradoSpaceConfig {
  key: string;
  title: string;
  estadoTras: string;
  estado: string;
  maquina: string;
  corridaproceso: string[];
  // Cómo agrupar/ordenar las filas de ESTE espacio (ver CuradoSpaceTable): 'apertura' usa
  // Apertura+Densidad (194.5/206/219/228 — el material trae una sola dimensión técnica fija por
  // fila, así que agrupar por fila tiene sentido). Cofama NO agrupa por encabezado — corridaproceso
  // puede traer DOS combinaciones distintas en la MISMA fila (ej. "1un - 160X200 / 1un - 200X200"),
  // así que esa fila pertenece a dos dimensiones a la vez y un encabezado de grupo por fila
  // mentiría. En vez de eso, Cofama parte cada fila en sus componentes (ver COFAMA_COLUMNAS_EXTRA
  // / parseCorridaComponentes) y solo se ordena, sin encabezados.
  groupBy: 'apertura' | 'none';
}

const CURADO_SPACES: CuradoSpaceConfig[] = [
  {
    key: 'leader',
    title: 'BLOQUE FORMULADO LEADER',
    estadoTras: 'CALLE',
    estado: 'CR',
    maquina: 'F_BLOQ',
    corridaproceso: ['1'],
    groupBy: 'apertura',
  },
  {
    key: 'cofama',
    title: 'BLOQUE FORMULADO COFAMA',
    estadoTras: 'BCALL',
    estado: 'BCFR',
    maquina: 'F_BLOQ_M',
    // COFAMA es por combinación: un mismo material trae múltiples valores de corridaproceso,
    // así que este espacio no filtra por esa columna (a diferencia de LEADER).
    corridaproceso: [],
    groupBy: 'none',
  },
  // Solo estos dos espacios (Leader/Cofama) — el usuario confirmó explícitamente que no hace falta
  // ningún espacio adicional (antes había también T8/Looper, agregados en una sesión previa; se
  // quitaron a pedido expreso: "no es necesario generar más espacios ni distinción").
];

// "Corrida" (columna Categoría de la referencia del usuario, ej. "BQ_F_A_194.5") — confirmado por
// el usuario como el prefijo real de SAP: son los primeros 4 segmentos de Categoria en
// CuboInventarios (ej. "BQ_F_A_206_PL_D 19_AF" -> "BQ_F_A_206"). Se toma tal cual viene de SAP, sin
// inventar formato — si Categoria trae menos de 4 segmentos (o viene vacía), se devuelve el valor
// crudo completo en vez de recortar de más.
const extraerCorridaCategoria = (categoria: string): string => {
  const segmentos = String(categoria || '').split('_');
  if (segmentos.length < 4) return categoria || '—';
  return segmentos.slice(0, 4).join('_');
};

// Consumo diario promedio (Kg/día) de un Bloque Formulado en los últimos 7 días corridos —
// fuente real de SAP (getConsumosFormulado / Registros51Mb, movimientos de mercancía por
// material). Verificado con datos reales (material 30003866, 637 movimientos):
//   - 261 = salida a producción (consumo real de ESTE bloque, Cantidad siempre negativa)
//   - 262 = reversa de un 261 (Cantidad siempre positiva — cancela un consumo mal registrado)
//   - 101/102 = RECEPCIÓN de este mismo bloque (se está fabricando, no consumiendo) — se excluyen,
//     no son consumo.
// Consumo/D = |Σ(261) + Σ(262)| ÷ 7 — la ventana es hoy y los 6 días anteriores (7 días corridos),
// según la hipótesis del propio usuario ("últimos 7 días ÷ 7") al plantear esta columna.
// Movimientos 261/262 del histórico completo, en Kg de consumo (261 resta del stock → consumo positivo;
// 262 lo revierte). Se piden una vez por Bloque Formulado y los usan el Consumo/D del Resumen y el tab
// "Consumo Histórico" (diario / semanal / mensual).
type MovimientoConsumo = { fecha: Date; kg: number };
const fetchMovimientosConsumo = async (material: string): Promise<MovimientoConsumo[]> => {
  try {
    const response = await serviciosService.getConsumosFormulado(material);
    const rows: RawApiRow[] = (response as { data?: RawApiRow[] })?.data || [];
    return rows.flatMap(r => {
      const mov = getProp(r, ['Movimiento', 'MOVIMIENTO']);
      if (mov !== '261' && mov !== '262') return [];
      const fecha = parseFechaSAP(getProp(r, ['Fecha', 'FECHA']));
      return fecha ? [{ fecha, kg: -safeNum(getProp(r, ['Cantidad', 'CANTIDAD'])) }] : [];
    });
  } catch {
    return [];
  }
};
// Tiempos de curado completos: el servicio es paginado; antes se leía solo la página 1 y el usuario vio
// datos hasta el 12/10 mientras su Excel tenía bloques del 29–30/10 (2026-10-31). Sigue pidiendo páginas
// mientras el servicio informe más registros de los leídos (tope de seguridad: 20 páginas).
const fetchCuradoCompleto = async (): Promise<{ data: RawApiRow[]; total: number }> => {
  const POR_PAGINA = 5000;
  const filas: RawApiRow[] = [];
  let total = 0;
  for (let page = 1; page <= 20; page++) {
    const res = await serviciosService.getTiemposCuradoBloqueFormulado(page, POR_PAGINA);
    const lote: RawApiRow[] = (res as { data?: { data?: RawApiRow[] } }).data?.data || (Array.isArray(res.data) ? res.data : []);
    total = Number(res.totalRegistros ?? res.totalRecords ?? res.totalRows ?? 0) || total;
    filas.push(...lote);
    if (lote.length < POR_PAGINA || (total > 0 && filas.length >= total)) break;
  }
  return { data: filas, total };
};

// Kg consumidos en los `dias` corridos que terminan hoy (incluido).
const consumoUltimosDiasKg = (movs: MovimientoConsumo[], dias: number, hasta = new Date()): number => {
  const fin = new Date(hasta);
  fin.setHours(23, 59, 59, 999);
  const ini = new Date(fin);
  ini.setDate(ini.getDate() - dias + 1);
  ini.setHours(0, 0, 0, 0);
  return Math.abs(movs.reduce((s, m) => (m.fecha >= ini && m.fecha <= fin ? s + m.kg : s), 0));
};
const consumoDiarioKgDe = (movs: MovimientoConsumo[]): number => consumoUltimosDiasKg(movs, 7) / 7;

// Tab "Consumo Histórico" (usuario 2026-10-27, validación antes de usarlo en la reposición): el
// consumo de cada Bloque Formulado en tres bases con ventanas corridas que terminan hoy — diario
// (7 días ÷ 7), semanal (28 días ÷ 4) y mensual (90 días ÷ 3) — y las últimas 4 semanas por separado
// para ver la tendencia.
const resumenConsumoHistorico = (movs: MovimientoConsumo[]) => {
  const hoy = new Date();
  const semanas = [3, 2, 1, 0].map(i => {
    const hasta = new Date(hoy);
    hasta.setDate(hasta.getDate() - 7 * i);
    return consumoUltimosDiasKg(movs, 7, hasta);
  });
  const kg28 = consumoUltimosDiasKg(movs, 28);
  const kg90 = consumoUltimosDiasKg(movs, 90);
  return {
    diarioKg: consumoDiarioKgDe(movs),
    semanalKg: kg28 / 4,
    mensualKg: kg90 / 3,
    // Equivalente por día de cada base, para comparar y calcular cobertura con la misma unidad.
    porDia: { diario: consumoDiarioKgDe(movs), semanal: kg28 / 28, mensual: kg90 / 90 },
    semanas,
    movimientos: movs.length,
  };
};

// Paso 3 · Plan de Reposición Leader (usuario 2026-11-12): misma regla que la hoja BASE del Excel
// "NN Programación bloque formulados 2026.xlsx" (PRG LEADER), por Bloque Formulado de apertura:
//   I  Stock [UN]        = stock Kg ÷ peso del bloque
//   O  Meta consumo/día  = histórico (SEMANAS_META_CONSUMO semanas ÷ días hábiles), igual todos los días; editable
//   V  Venta Externa     = solo el EXCESO (usuario 2026-11-12): faltante de las FERT 018 (planchas de venta,
//                          centro 1000) atrasadas + DIAS_VE_DEFAULT días hábiles desde D, menos lo que VE ya
//                          consume en la meta (notificado 018 de las mismas semanas del histórico ÷ días
//                          hábiles × días de la ventana). Las 038 son ya el plan: llegarían tarde.
//   Peso                 = Lote Mín. SAP como estándar; el promedio real de fabricados queda de control
//   AL Plan día anterior = PLAN del último reporte guardado antes del día de producción
//   AC Cobertura actual  = MTS (I + AL) ÷ O · HB (I − V + AL) ÷ O
//   AD Horizonte         = restricción Cobertura_<material> (un valor o L;M;X;J;V), o
//                          Formulacion_Cobertura_Dias, o 1 día de fabricación + 48 h de curado
//   Reponer              = día de producción (DiasProduccion_<apertura>) y AC < AD (MTO: stock Kg < VE Kg)
//   AI Sugerido          = (AD × O) − I + V − AL, a 1 decimal; fracción ≥ 0,3 sube, si no baja
//   AJ PLAN              = sugerido, editable; tope = nichos (30) + autodescarga (6) opcional
type EstrategiaReposicion = 'MTS' | 'MTO' | 'HB';
const HORIZONTE_DEFAULT_DIAS = 1 + CURADO_DIAS_ESPERA;
const NICHOS_MAX_DEFAULT = 30;
const AUTODESCARGA_DEFAULT_UN = 6;
const SEMANAS_META_CONSUMO = 4;
const RESP_VENTA_EXTERNA_PT = '018';
const DIAS_VE_DEFAULT = 4;

// Lo que se calcula al generar (SAP + restricciones resueltas) y viaja en el respaldo del reporte.
interface BaseReposicionRow {
  blockCode: string; blockDesc: string; corrida: string; apertura: string; dens: string;
  pesoBloque: number; pesoFuente: 'real' | 'lote' | 'sin dato'; pesoDetalle?: string; pesoRealProm?: number;
  // Curado / en curado = mismos Kg (CantidadStock) que la pestaña 2 · Stock y Curado, espacio Leader.
  stockKg: number; enCuradoKg: number; curadoKg?: number;
  // veKg = exceso de Venta Externa que entra al cálculo (V); veVentanaKg / veBaseKg lo explican.
  metaKgDia: number; veKg: number; veVentanaKg?: number; veBaseKg?: number; planAnteriorUN: number;
  horizonteDias: number; horizonteRestriccion: boolean;
  estrategia: EstrategiaReposicion; diaProduccion: boolean;
}
interface ReposicionLeader {
  filas: BaseReposicionRow[];
  diaProduccion: string;
  planAnteriorFecha: string | null;
  nichosMax: number;
  autodescargaUN: number;
  autodescarga: boolean;
  // Ajustes del usuario por blockCode, en UN.
  metaOverride: Record<string, number>;
  planOverride: Record<string, number>;
}
interface FilaReposicion extends BaseReposicionRow {
  stockUN: number; enCuradoUN: number; curadoUN: number; metaUNDia: number; veUN: number;
  estrategiaEfectiva: EstrategiaReposicion;
  coberturaActual: number | null; reponer: boolean; sugeridoUN: number;
  planUN: number; planKg: number; coberturaPlan: number | null;
  metaEditada: boolean; planEditado: boolean;
}

// ROUNDUP a 1 decimal y luego entero: fracción ≥ 0,3 sube, menor baja (columna AI del Excel).
const redondeoReposicion = (x: number): number => {
  if (!(x > 0)) return 0;
  const r = Math.ceil(x * 10 - 1e-9) / 10;
  return r - Math.trunc(r) >= 0.3 - 1e-9 ? Math.ceil(r) : Math.floor(r);
};
const numeroRestriccion = (v: string): number | null => {
  const n = Number(v.trim().replace(',', '.'));
  return v.trim() && !isNaN(n) ? n : null;
};
// "3.5" para todos los días o "3,5;3,5;3,5;4;4" (lunes a viernes); fin de semana usa el viernes.
const horizonteDeRestriccion = (valor: string, diaSemana: number): number | null => {
  const partes = valor.split(/[;|]/).map(s => s.trim()).filter(Boolean);
  if (partes.length === 0) return null;
  if (partes.length === 1) return numeroRestriccion(partes[0]);
  const idx = diaSemana >= 1 && diaSemana <= 5 ? diaSemana - 1 : 4;
  return numeroRestriccion(partes[Math.min(idx, partes.length - 1)]);
};
// "L,M,X,V" / "LUNES;MARTES" → días de getDay(). Vacío = null (todos los días hábiles).
const DIA_POR_PREFIJO: Record<string, number> = { L: 1, LU: 1, M: 2, MA: 2, X: 3, MI: 3, J: 4, JU: 4, V: 5, VI: 5, S: 6, SA: 6, D: 0, DO: 0 };
const diasProduccionDeRestriccion = (valor: string): Set<number> | null => {
  const dias = valor.toUpperCase().split(/[,;|\s]+/).map(s => s.trim()).filter(Boolean)
    .map(s => DIA_POR_PREFIJO[s] ?? DIA_POR_PREFIJO[s.slice(0, 2)]).filter((d): d is number => d !== undefined);
  return dias.length ? new Set(dias) : null;
};

const calcularFilaReposicion = (b: BaseReposicionRow, metaOverrideUN?: number, planOverrideUN?: number): FilaReposicion => {
  const peso = b.pesoBloque;
  const aUN = (kg: number) => (peso > 0 ? kg / peso : 0);
  const I = aUN(b.stockKg);
  const V = aUN(b.veKg);
  const AL = b.planAnteriorUN;
  const O = metaOverrideUN ?? aUN(b.metaKgDia);
  const AD = b.horizonteDias;
  // Sin consumo no hay cobertura que medir: se repone solo contra Venta Externa (como MTO).
  const estrategiaEfectiva: EstrategiaReposicion = O > 0 ? b.estrategia : 'MTO';
  const cobertura = (extra: number): number | null => {
    if (estrategiaEfectiva === 'MTO') return null;
    return (estrategiaEfectiva === 'HB' ? I - V + AL + extra : I + AL + extra) / O;
  };
  const coberturaActual = cobertura(0);
  const reponer = b.diaProduccion && (estrategiaEfectiva === 'MTO' ? b.stockKg < b.veKg : (coberturaActual ?? 0) < AD);
  const bruto = (estrategiaEfectiva === 'MTO' ? 0 : AD * O) - I + V - AL;
  const sugeridoUN = reponer ? redondeoReposicion(bruto) : 0;
  const planUN = planOverrideUN ?? sugeridoUN;
  return {
    ...b, stockUN: I, enCuradoUN: aUN(b.enCuradoKg), curadoUN: aUN(b.curadoKg ?? 0), metaUNDia: O, veUN: V, estrategiaEfectiva,
    coberturaActual, reponer, sugeridoUN, planUN, planKg: Math.ceil(planUN * peso), coberturaPlan: cobertura(planUN),
    metaEditada: metaOverrideUN !== undefined, planEditado: planOverrideUN !== undefined,
  };
};
// Control del peso estándar: el promedio real de fabricados se aleja más de 3 % del Lote Mín.
const desfasePeso = (b: BaseReposicionRow): boolean =>
  b.pesoFuente === 'lote' && !!b.pesoRealProm && b.pesoBloque > 0 && Math.abs(b.pesoRealProm / b.pesoBloque - 1) > 0.03;
// ── Paso 3 · Plan de Reposición Cofama (usuario 2026-11-12, Excel "NN Programación bloque formulados cofama",
// hoja BASE): una fila por BLOQUE CORTADO (resp 030). Stock = cortado SAP + los formulados Cofama en calle
// convertidos a cortados por su combinación ("2un - 135X190 / 1un - 105X190"). Misma regla de cobertura que
// Leader con Interno (necesidad FERT del paso 1) en lugar de VE:
//   Cobertura = (Stock + Plan ant. − Interno) ÷ Meta · Sugerido = (Horizonte × Meta) − Stock − Plan ant. + Interno
// El PLAN se arma como en la hoja PLAN: bloque formulado + combinación + cantidad → UN de cada cortado.
// Peso del cortado = Kg de formulado por UN según su BOM SAP.
const RESP_COFAMA_CORTADO = '030';
const TOLERANCIA_MEDIDA_CM = 2;
interface ComponenteCombinacion { un: number; ancho: number; largo: number }
const parseCombinacion = (txt: string): ComponenteCombinacion[] =>
  String(txt || '').split('/').flatMap(p => {
    const m = p.match(/(\d+)\s*un\s*-?\s*(\d+(?:[.,]\d+)?)\s*[xX*]\s*(\d+(?:[.,]\d+)?)/i);
    return m ? [{ un: Number(m[1]), ancho: Number(m[2].replace(',', '.')), largo: Number(m[3].replace(',', '.')) }] : [];
  });
const medidaDeTexto = (desc: string): { ancho: number; largo: number } | null => {
  const m = String(desc || '').match(/(\d{2,3})\s*[xX]\s*(\d{2,3})/);
  return m ? { ancho: Number(m[1]), largo: Number(m[2]) } : null;
};
const medidaCoincide = (a: { ancho: number; largo: number }, b: { ancho: number; largo: number }): boolean => {
  const t = TOLERANCIA_MEDIDA_CM;
  return (Math.abs(a.ancho - b.ancho) <= t && Math.abs(a.largo - b.largo) <= t) || (Math.abs(a.ancho - b.largo) <= t && Math.abs(a.largo - b.ancho) <= t);
};
// Familia del material (VISCO, BIOCRYSTAL, HS, LATEX…): palabras de la descripción sin las genéricas.
const familiaDe = (desc: string): Set<string> => new Set(
  String(desc || '').toUpperCase().split(/[^A-Z]+/).filter(w => w.length >= 2 && !['BLOQUE', 'CORTADO', 'FORMULADO', 'UN', 'MOD', 'STD'].includes(w))
);

interface BaseCofamaRow {
  cortadoCode: string; cortadoDesc: string; formuladoCode: string; formuladoDesc: string; dens: string;
  medida: { ancho: number; largo: number } | null;
  pesoCortado: number;
  stockCortadoKg: number; stockFormuladoUN: number;
  metaKgDia: number; internoKg: number; planAnteriorUN: number;
  horizonteDias: number; horizonteRestriccion: boolean; diaProduccion: boolean;
}
interface FormuladoCofama { code: string; desc: string; pesoKg: number; combinaciones: string[] }
// ¿El cortado es de Cofama? (usuario 2026-11-12: "no debes colocar los materiales de Leader en Cofama").
// Nunca si él o su formulado tienen apertura Leader; además debe tener medida en la descripción o un formulado
// fabricado en F_BLOQ_M (formuladosCofama). Fuera: TRANSICIÓN, PARA ESQUINAS, D12 BL 194.5, TAPICERIA … 194.5.
const esCortadoCofama = (cortadoDesc: string, formuladoCode: string, formuladoDesc: string, formuladosCofama: Set<string>): boolean => {
  const conApertura = (d: string) => extractMaterialInfo({ NOMBRE: d }).apertura !== '—';
  if (conApertura(cortadoDesc) || (formuladoDesc && conApertura(formuladoDesc))) return false;
  return !!medidaDeTexto(cortadoDesc) || (!!formuladoCode && formuladosCofama.has(formuladoCode));
};
interface LineaPlanCofama { id: string; formuladoCode: string; combinacion: string; cantidad: number }
interface SinEmparejarCofama { formuladoCode: string; formuladoDesc: string; combinacion: string; bloques: number }
interface ReposicionCofama {
  filas: BaseCofamaRow[];
  formulados: FormuladoCofama[];
  sinEmparejar: SinEmparejarCofama[];
  diaProduccion: string;
  planAnteriorFecha: string | null;
  lineas: LineaPlanCofama[];
  metaOverride: Record<string, number>;
}
interface FilaCofama extends BaseCofamaRow {
  stockCortadoUN: number; stockTotalUN: number; metaUNDia: number; internoUN: number;
  coberturaActual: number | null; reponer: boolean; sugeridoUN: number;
  planUN: number; coberturaPlan: number | null; metaEditada: boolean;
}

// Reparte N bloques formulados de una combinación a los bloques cortados: primero los cortados cuya BOM
// usa ese formulado, si no los de la misma densidad y familia; la medida empareja con ±2 cm.
const repartirCombinacion = (
  formuladoCode: string, formuladoDesc: string, combinacion: string, bloques: number, filas: BaseCofamaRow[],
): { porCortado: Map<string, number>; sinEmparejar: string[] } => {
  const porCortado = new Map<string, number>();
  const sinEmparejar: string[] = [];
  const propios = filas.filter(f => f.formuladoCode === formuladoCode);
  const dens = extractMaterialInfo({ NOMBRE: formuladoDesc }).dens;
  const fam = familiaDe(formuladoDesc);
  // Afines: misma densidad, ordenados por cuántas palabras de familia comparten (D30 VISCO RZ GEL prefiere
  // un cortado "VISCO RZ GEL" antes que uno solo "VISCO").
  const afines = filas
    .map(f => ({ f, comunes: [...familiaDe(f.cortadoDesc)].filter(w => fam.has(w)).length }))
    .filter(x => x.f.dens === dens && x.comunes > 0)
    .sort((a, b) => b.comunes - a.comunes)
    .map(x => x.f);
  parseCombinacion(combinacion).forEach(c => {
    const destino = [propios, afines].map(g => g.find(f => f.medida && medidaCoincide(f.medida, c))).find(Boolean);
    if (destino) porCortado.set(destino.cortadoCode, (porCortado.get(destino.cortadoCode) || 0) + c.un * bloques);
    else sinEmparejar.push(`${c.un}un - ${c.ancho}X${c.largo}`);
  });
  return { porCortado, sinEmparejar };
};
const planCofamaPorCortado = (r: ReposicionCofama | undefined | null): Map<string, number> => {
  const total = new Map<string, number>();
  if (!r) return total;
  r.lineas.forEach(l => {
    if (!(l.cantidad > 0)) return;
    const f = r.formulados.find(x => x.code === l.formuladoCode);
    repartirCombinacion(l.formuladoCode, f?.desc ?? '', l.combinacion, l.cantidad, r.filas).porCortado
      .forEach((un, code) => total.set(code, (total.get(code) || 0) + un));
  });
  return total;
};
const calcularFilaCofama = (b: BaseCofamaRow, metaOverrideUN: number | undefined, planUN: number): FilaCofama => {
  const aUN = (kg: number) => (b.pesoCortado > 0 ? kg / b.pesoCortado : 0);
  const stockCortadoUN = aUN(b.stockCortadoKg);
  const I = stockCortadoUN + b.stockFormuladoUN;
  const R = aUN(b.internoKg);
  const T = b.planAnteriorUN;
  const O = metaOverrideUN ?? aUN(b.metaKgDia);
  const cobertura = (extra: number) => (O > 0 ? (I + T - R + extra) / O : null);
  const coberturaActual = cobertura(0);
  const reponer = b.diaProduccion && (O > 0 ? (coberturaActual ?? 0) < b.horizonteDias : I + T < R);
  return {
    ...b, stockCortadoUN, stockTotalUN: I, metaUNDia: O, internoUN: R, coberturaActual, reponer,
    sugeridoUN: reponer ? redondeoReposicion(b.horizonteDias * O - I - T + R) : 0,
    planUN, coberturaPlan: cobertura(planUN), metaEditada: metaOverrideUN !== undefined,
  };
};

const planFinalReposicion = (r: ReposicionLeader | undefined | null): Record<string, number> =>
  Object.fromEntries((r?.filas ?? []).map(b => [b.blockCode, calcularFilaReposicion(b, r?.metaOverride?.[b.blockCode], r?.planOverride?.[b.blockCode]).planUN]));

// Materiales de PRUEBA (ej. "BLOQUE FORMULADO PRUEBAS MQ COFAMA") — el usuario confirmó que tanto
// Leader como Cofama corren pruebas de máquina de vez en cuando, y esos bloques NO deben contarse
// como stock/curado real en ningún lado (ni en las tablas de detalle, ni en la Evaluación general,
// ni en el Resumen). Filtro amplio por "PRUEBA" (singular o plural) sobre la descripción/nombre —
// nomenclatura humana en SAP, no hay un flag dedicado para esto.
const esMaterialPrueba = (descripcion: string): boolean => /PRUEBA/i.test(descripcion);
// Muestras de laboratorio (ej. "MUESTRA LAB CALIDAD D17 BB SEGURO"): su BOM en SAP puede traer Bloque
// Formulado, pero no es consumo de producción — no entran en la necesidad (usuario 2026-10-31).
const esMuestraLaboratorio = (descripcion: string): boolean => /MUESTRA/i.test(descripcion);

// Altura real del bloque fabricado (getTiemposCuradoBloqueFormulado, columna CuradoAltura en mm —
// usuario 2026-10-27): 1174 → 117.4 cm. Útil = altura − cúpula (CUPULA_MAX_CM), misma regla del
// modelo de bloque de Corte Espuma, para contrastar con la altura útil que usa el cálculo (103 / 85).
// 2026-10-28: la respuesta del servicio cambió — se busca el campo por nombre (con o sin "_") y, si no
// está, cualquier columna con "altura"; el valor puede venir en mm (1174) o ya en cm (117.4) y con
// coma decimal. Ningún bloque mide más de 400 cm, así que > 400 se toma como mm.
const curadoAlturaRaw = (row: RawApiRow): string => {
  const directo = getProp(row, ['CuradoAltura', 'Curado_Altura', 'AlturaCurado', 'Altura_Curado']);
  if (directo) return directo;
  const clave = Object.keys(row).find(k => /altura/i.test(k));
  return clave ? String(row[clave] ?? '').trim() : '';
};
const alturaCuradoCm = (row: RawApiRow): number => {
  const v = safeNum(curadoAlturaRaw(row).replace(',', '.'));
  return v > 400 ? v / 10 : v;
};

const matchesCuradoSpace = (row: RawApiRow, space: CuradoSpaceConfig): boolean => {
  const nomMaterial = getProp(row, ['NomMaterial', 'NOMMATERIAL']);
  if (esMaterialPrueba(nomMaterial)) return false;
  // "ESTADO" se quitó de la lista de nombres alternativos de estadoTras — son campos reales
  // distintos, usar "ESTADO" como fallback de estadoTras podía terminar comparando el valor
  // equivocado si alguna fila llegara sin estadoTras.
  const estadoTras = getProp(row, ['estadoTras', 'ESTADOTRAS']).trim().toUpperCase();
  // En el Excel del usuario la columna CR/BCFR se llama "estado2" (2026-10-31): se aceptan las dos.
  const estados = [getProp(row, ['estado', 'ESTADO']), getProp(row, ['estado2', 'ESTADO2'])].map(v => v.trim().toUpperCase());
  const maquina = getProp(row, ['Maquina', 'MAQUINA']).trim().toUpperCase();
  if (estadoTras !== space.estadoTras || !estados.includes(space.estado) || maquina !== space.maquina) return false;
  if (space.corridaproceso.length === 0) return true;
  const corrida = getProp(row, ['corridaproceso', 'CORRIDAPROCESO']).trim().toUpperCase();
  return space.corridaproceso.includes(corrida);
};

// getTiemposCuradoBloqueFormulado trae "fecha" en formato DD/MM/YYYY (ej. "06/05/2026" = 6 de
// mayo). `new Date("06/05/2026")` de JS lo interpreta como MM/DD/YYYY (6 de junio) y corrompe
// la fecha silenciosamente, por eso se parsea manualmente en vez de delegar al constructor Date.
const parseFechaSAP = (raw: string): Date | null => {
  if (!raw) return null;
  const part = raw.includes('T') ? raw.split('T')[0] : raw;
  const dmy = part.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (dmy) {
    const d = new Date(Number(dmy[3]), Number(dmy[2]) - 1, Number(dmy[1]));
    return isNaN(d.getTime()) ? null : d;
  }
  const ymd = part.match(/^(\d{4})-(\d{1,2})-(\d{1,2})$/);
  if (ymd) {
    const d = new Date(Number(ymd[1]), Number(ymd[2]) - 1, Number(ymd[3]));
    return isNaN(d.getTime()) ? null : d;
  }
  const fallback = new Date(part);
  return isNaN(fallback.getTime()) ? null : fallback;
};


const isResponsableAllowed = (centro: string, resp: string, respPorCentro: Record<string, string[]>): boolean => {
  const allowed = respPorCentro[centro];
  return !!allowed && allowed.includes(resp);
};
// Solo centro 1000 (único con formuladora). Venta Externa (038) y sub-bloques GYE (041) entran aunque no
// estén en RespCtrlProd_Consumo_1000.
const entraEnFormulacion = (centro: string, resp: string, respPorCentro: Record<string, string[]>): boolean =>
  centro !== '2000' && (resp === RESP_VENTA_EXTERNA || resp === RESP_SUBBLOQUES_GYE || isResponsableAllowed(centro, resp, respPorCentro));

// Una fila de trazabilidad de consumo: desde el material "BLOQUE FORMULADO" (codFormulado) hasta
// el componente final del que forma parte, pasando por el nivel intermedio del árbol BOM
// (ej. bloque formulado -> lámina cortada -> producto terminado).
interface ConsumoBloqueRow {
  codFormulado: string;
  nombreFormulado: string;
  componente: string;
  nombreComponente: string;
  material: string;
  nombre: string;
  orden: string;
  un: string;
  total: number;
  origin: 'prov' | 'fert';
  centro: string;
  respCtrlProd: string;
  // Solo FERT (2026-10-28, ver @/lib/ventana-corte): FECHAFIN de la orden y si su material va en un P2
  // de Venta Externa — con eso el tab FERT filtra el mismo día de corte que Sub-Bloques-T8 de Corte.
  // Ausentes en reportes guardados antes de ese cambio.
  fechaFin?: string;
  ventaExterna?: boolean;
  tramo?: TramoNecesidad;
  destino?: DestinoConsumo;
  // Cantidad pendiente de la orden (láminas, UN) — la misma que cuenta Sub-Bloques-T8 de Corte.
  cantidad?: number;
}

// Una orden individual (provisional o FERT) que consume un Bloque Formulado del grupo agregado.
interface FormuladoFertEntry {
  code: string;
  desc: string;
  qty: number;
  kg: number;
  bloques: number;
  origin: 'prov' | 'fert';
}

// Fila agregada del Resumen (tab "Salida de Datos"): un Bloque Formulado con su necesidad,
// stock y plan de reposición, agrupado por apertura/densidad/CENTRO — el mismo código de material
// puede existir físicamente en Quito (1000) y Guayaquil (2000) como inventario y necesidad
// separados; agruparlos juntos (como se hacía antes) neteaba stock/necesidad de un centro contra
// el otro y podía esconder un faltante real en uno de los dos.
interface FormuladoSummaryRow {
  blockCode: string;
  blockDesc: string;
  centro: string;
  corrida: string;
  dens: string;
  apertura: string;
  totalBloquesPendiente: number;
  totalBloquesPlanificado: number;
  planReposicion: number;
  stockKg: number;
  stockUN: number;
  stockEnCuradoUN: number;
  stockUtilUN: number;
  pesoBloque: number;
  kgTotal: number;
  unidades: number;
  // Consumo diario promedio de los últimos 7 días corridos (ver fetchMovimientosConsumo /
  // getConsumosFormulado) — Kg de movimiento 261 (salida a producción) neteado contra 262
  // (reversa de esa salida), sin incluir 101/102 (recepción de este mismo bloque, no es consumo).
  consumoDiarioKg: number;
  ferts: FormuladoFertEntry[];
}

// Recorre la explosión BOM (getMaestroMaterialesExplosion) de una orden y, por cada material
// "BLOQUE FORMULADO" encontrado, sube un nivel (MATERIAL_PADRE) para identificar el componente
// intermedio que lo consume, y otro nivel más para el componente final. CANTIDAD_ACUMULADA viene
// expresada POR UNIDAD del material consultado (fertCode) — hay que multiplicarla por la cantidad
// real de la orden (qtyOrden: CANTPEND/CANTPENDIENTE/CANTPROGRAMADA) para obtener el consumo real,
// mismo criterio que el resto de trazas BOM del proyecto (ver TacticalPlanForrosSection.tsx,
// `cantidadUnitaria * orderQty`). Antes se omitía esa multiplicación acá y el Total de esta tabla
// quedaba en la escala "por unidad", no en el consumo real de la orden — confirmado por el usuario
// comparando contra un Excel de referencia (los mismos dos componentes con cantidades distintas por
// orden, sin relación de factor constante entre Excel y app: prueba de que faltaba multiplicar por
// la cantidad propia de CADA orden, no un ajuste de escala único).
const traceBloqueFormuladoConsumption = (
  bomData: MaterialExplosionRow[],
  fertCode: string,
  ordenNum: string,
  origin: 'prov' | 'fert',
  centro: string,
  respCtrlProd: string,
  qtyOrden: number
): ConsumoBloqueRow[] => {
  const formuladoRows = bomData.filter(row => (row.DESCRIPCION_COMPONENTE || '').toUpperCase().includes('BLOQUE FORMULADO'));

  return formuladoRows.map(formuladoRow => {
    const codFormulado = cleanCode(formuladoRow.COMPONENTE);
    const nombreFormulado = String(formuladoRow.DESCRIPCION_COMPONENTE || '—').toUpperCase();
    const componenteCode = cleanCode(formuladoRow.MATERIAL_PADRE);
    const componenteRow = bomData.find(r => cleanCode(r.COMPONENTE) === componenteCode);
    const nombreComponente = componenteRow
      ? String(componenteRow.DESCRIPCION_COMPONENTE || '—').toUpperCase()
      : String(formuladoRow.DESCRIPCION_FERT || '—').toUpperCase();
    const material = componenteRow ? cleanCode(componenteRow.MATERIAL_PADRE) : fertCode;
    const nombre = String(formuladoRow.DESCRIPCION_FERT || '—').toUpperCase();
    const total = safeNum(formuladoRow.CANTIDAD_ACUMULADA || formuladoRow.CANTIDAD_UNITARIA || 0) * qtyOrden;

    return {
      codFormulado,
      nombreFormulado,
      componente: componenteCode,
      nombreComponente,
      material,
      nombre,
      orden: String(ordenNum),
      un: 'KG',
      total,
      origin,
      centro,
      respCtrlProd
    };
  });
};

// Función pura (sin dependencias de estado/props) — vive a nivel de módulo para que tanto el
// componente principal como CuradoSpaceTable (definido arriba, fuera del componente) puedan
// llamarla para ordenar/agrupar por apertura y densidad. Antes era un useCallback con deps [],
// una referencia ya estable de por sí — moverla a nivel de módulo no cambia su comportamiento.
const extractMaterialInfo = (item: RawApiRow) => {
  const matStr = getProp(item, ['MATERIAL', 'Material', 'CodMaterial', 'MATERIAL_ID', 'CODIGO']);
  const nameStr = getProp(item, ['NOMBRE', 'NombreMaterial', 'Descripcion', 'NomMaterial', 'DESCRIPCION']);
  const catStr = getProp(item, ['CATEGORIA', 'Categoria', 'CATEGORIA_DESC']);

  const match = matStr.match(/^(\d+)/);
  const code = match ? match[1].slice(-8) : matStr.slice(-8);
  const desc = nameStr || matStr.replace(/^\d+\s*/, '') || '—';

  const dimensions: MaterialDimensions = { dens: '—', ancho: '—', largo: '—', esp: '—', apertura: '—', tipo: '—' };
  const techPattern = catStr.match(/D(\d+)([a-zA-Z]*)/i) || desc.match(/D-?(\d+)([a-zA-Z]*)/i);
  if (techPattern) {
    dimensions.dens = techPattern[1];
    dimensions.tipo = (techPattern[2] || '').toUpperCase();
  }
  const dimMatch = desc.match(/(\d+(?:\.\d+)?)\s*[xX*]\s*(\d+(?:\.\d+)?)(?:\s*[xX*]\s*(\d+(?:\.\d+)?))?/);
  if (dimMatch) {
    dimensions.ancho = dimMatch[1];
    dimensions.largo = dimMatch[2];
    if (dimMatch[3]) dimensions.esp = dimMatch[3];
  }
  const apertureRegex = /194\.5|206|219|228/;
  const apertureMatch = catStr.match(apertureRegex) || desc.match(apertureRegex);
  if (apertureMatch) dimensions.apertura = apertureMatch[0];

  return { code, desc, categoria: catStr, ...dimensions };
};

// Orden fijo de aperturas técnicas (pedido por el usuario para los 3 espacios de Control
// Curado: evaluación general + detalle Leader + detalle Cofama). "—" (sin apertura técnica,
// materiales de combinación) siempre al final.
const APERTURA_ORDEN = ['194.5', '206', '219', '228'];
const aperturaSortIndex = (apertura: string): number => {
  const i = APERTURA_ORDEN.indexOf(apertura);
  return i === -1 ? APERTURA_ORDEN.length : i;
};
// Clave de agrupación/orden: apertura (según APERTURA_ORDEN) y, dentro de cada apertura,
// densidad ascendente (numérica cuando se puede, ej. "D 25"/"D25" -> 25; si no es numérica —
// "TRAN", "CAB/COL"— va al final de su grupo de apertura).
const aperturaDensidadSortKey = (info: { apertura: string; dens: string }): [number, number] => {
  const densNum = parseFloat(info.dens);
  return [aperturaSortIndex(info.apertura), isNaN(densNum) ? Infinity : densNum];
};
const compareAperturaDensidad = (a: { apertura: string; dens: string }, b: { apertura: string; dens: string }): number => {
  const [aApert, aDens] = aperturaDensidadSortKey(a);
  const [bApert, bDens] = aperturaDensidadSortKey(b);
  return aApert !== bApert ? aApert - bApert : aDens - bDens;
};
const aperturaGroupLabel = (apertura: string): string => apertura === '—' ? 'SIN APERTURA (COMBINACIÓN)' : `APERTURA ${apertura}`;

// Persistencia entre módulos (ver @/lib/cache-modulos): antes este módulo no tenía NINGUNA — ni de
// datos crudos ni del resumen ya procesado — a diferencia de Corte Espuma/Venta Externa/Laminado, que
// ya la ganaron en sesiones previas (ver [[persistencia_datos_modulos]]). Se cachea tanto lo crudo
// (ordenes/ordenesFert/cuboInventarios/curadoData) como el resultado de "Generar Necesidades"
// (unifiedSummaryData/consumoBloqueFormulado) — sin esto último, el tab Resumen volvía a aparecer
// vacío al navegar a otro módulo y volver, mismo bug real ya corregido en Corte y Laminado (ver
// [[persistencia_resumen_procesado_gap]]).
const CACHE_FORMULACION = 'tactica-formulacion';
interface SnapshotFormulacion {
  diaCorte?: string;
  ordenesFert: RawApiRow[];
  cuboInventarios: CuboInventariosItem[];
  curadoData: RawApiRow[];
  unifiedSummaryData: FormuladoSummaryRow[];
  consumoBloqueFormulado: ConsumoBloqueRow[];
  reposicion?: ReposicionLeader | null;
  reposicionCofama?: ReposicionCofama | null;
}

// Respaldo de lo planificado guardado junto al TXT ({fecha}.estado.json), ver capturarEstadoPlan.
// Cambiar su forma exige subir `version` (los respaldos viejos dejan de cargarse). `reposicion` es
// opcional (2026-11-12): los respaldos anteriores siguen cargando, sin Plan de Reposición Leader.
interface EstadoPlanFormulacion {
  tipo: 'formulacion-salida';
  version: 2;
  diaCorte: string;
  unifiedSummaryData: FormuladoSummaryRow[];
  consumoBloqueFormulado: ConsumoBloqueRow[];
  reposicion?: ReposicionLeader | null;
  reposicionCofama?: ReposicionCofama | null;
}

export const TacticalPlanFormulacionSection: React.FC = () => {
  const inspector = useRuntimeInspector('TacticalPlanFormulacion');
  useAppContext();

  const [mounted, setMounted] = useState(false);
  const [activeTab, setActiveTab] = useState('necesidad');
  const [restricciones, setRestricciones] = useState<Restriccion[]>([]);
  const [ordenesFert, setOrdersFert] = useState<RawApiRow[]>([]);
  const [cuboInventarios, setCuboInventarios] = useState<CuboInventariosItem[]>([]);
  const [curadoData, setCuradoData] = useState<RawApiRow[]>([]);
  // Total de registros que informa el servicio de curado (0 = no lo informa), para el diagnóstico del paso 2.
  const [curadoTotalServicio, setCuradoTotalServicio] = useState(0);
  // Día de corte D (misma ventana que Sub-Bloques-T8 de Corte, ver @/lib/ventana-corte) con el
  // calendario de feriados / días no trabajados; '' = hoy + 1 hábil. Se elige al sincronizar.
  const [diaCorte, setDiaCorte] = useState('');
  const [calendario, setCalendario] = useState<{ noLaborables: DiasNoLaborables; laborablesExtra: DiasNoLaborables }>({ noLaborables: new Set(), laborablesExtra: new Set() });
  useEffect(() => {
    cargarDiasNoLaborables().then(c => setCalendario({ noLaborables: c.noLaborables, laborablesExtra: c.laborablesExtra })).catch(() => {});
  }, []);
  const siguienteDiaHabil = useCallback((d: Date) => nextBusinessDay(d, calendario.noLaborables, laborablesHorizonte(calendario.laborablesExtra)), [calendario]);
  const ventana = useMemo(() => ventanaCorte(diaCorte, siguienteDiaHabil), [diaCorte, siguienteDiaHabil]);
  const pendienteDesde = useMemo(
    () => format(addBusinessDays(new Date(`${ventana.d}T12:00:00`), -DIAS_PENDIENTE_FERT, calendario.noLaborables, laborablesHorizonte(calendario.laborablesExtra)), 'yyyy-MM-dd'),
    [ventana.d, calendario]
  );
  // Tramo de una FERT por su FECHAFIN; null = fuera de la ventana (no entra en la necesidad).
  const tramoFert = useCallback((fechaFin: string): TramoNecesidad | null => {
    if (fechaFin === ventana.d) return 'planificado';
    return fechaFin >= pendienteDesde && fechaFin < ventana.d ? 'pendiente' : null;
  }, [ventana.d, pendienteDesde]);
  // El módulo YA NO sincroniza solo al abrirse — mismo criterio que Corte Espuma/Venta Externa/
  // Laminado (ver [[carga_manual_modulos_tacticos]], antes marcado como pendiente para este módulo).
  const [isLoading, setIsLoading] = useState(false);
  const [datosCargados, setDatosCargados] = useState(false);
  // "Sincronizar" y "Generar Necesidades" (2 clics separados) se combinan en 1 — el usuario lo pidió
  // por ser repetitivo en el uso diario, mismo patrón ya aplicado en Corte Espuma/Venta Externa/
  // Laminado (ver [[modulos_tacticos_sincronizar_y_generar_combinado]]).
  const [autoGenerarPendiente, setAutoGenerarPendiente] = useState(false);
  const [reportePorGuardar, setReportePorGuardar] = useState(false);
  const [syncStep, setSyncStep] = useState<'idle' | 'sincronizando' | 'generando'>('idle');
  // Panel flotante de progreso de "Sincronizar y Generar Necesidades" (ver handleSincronizarYGenerar).
  const panelProgreso = usePanelProgreso();

  const [isProcessingResumen, setIsProcessingResumen] = useState(false);
  const [resumenProgress, setResumenProgress] = useState({ current: 0, total: 0 });
  // Movimientos 261/262 por Bloque Formulado (ver fetchMovimientosConsumo) para el tab Consumo
  // Histórico. Se llenan al generar el Resumen; con un resumen restaurado se piden desde el tab.
  const [movimientosConsumo, setMovimientosConsumo] = useState<Record<string, MovimientoConsumo[]>>({});
  const [cargandoHistorico, setCargandoHistorico] = useState(false);
  const [baseConsumo, setBaseConsumo] = useState<'diario' | 'semanal' | 'mensual'>('diario');
  const [unifiedSummaryData, setUnifiedSummaryData] = useState<FormuladoSummaryRow[]>([]);
  const [reposicion, setReposicion] = useState<ReposicionLeader | null>(null);
  const [reposicionCofama, setReposicionCofama] = useState<ReposicionCofama | null>(null);
  // Reporte guardado del que viene lo que se ve (ver restaurarEstadoPlan); null = datos de la sesión.
  const [planCargadoDe, setPlanCargadoDe] = useState<OrigenEstadoPlan | null>(null);
  const [consumoBloqueFormulado, setConsumoBloqueFormulado] = useState<ConsumoBloqueRow[]>([]);
  // Grupos abiertos del detalle de Necesidad (ver renderNecesidadTable); vacío = todo contraído.
  const [expandidoNecesidad, setExpandidoNecesidad] = useState<Set<string>>(new Set());

  useEffect(() => {
    setMounted(true);
  }, []);


  // Responsables de Control de Producción reales, leídos de la restricción del Grupo Formulación
  // (RespCtrlProd_Consumo_1000 / RespCtrlProd_Consumo_2000 — ver handleSincronizarYGenerar, que ya
  // filtra `restricciones` a los grupos "formulación"/"espuma"), en vez del arreglo fijo que quedaba
  // desactualizado en cuanto alguien tocaba la restricción en Configuraciones. Con `restricciones`
  // todavía vacío (antes de sincronizar) cae al fallback fijo, para no dejar el módulo sin ningún
  // responsable mientras carga.
  const respPorCentroDinamico = useMemo(() => {
    const build = (centro: string): string[] => {
      const rest = restricciones.find(r => r.nombre_restriccion === `RespCtrlProd_Consumo_${centro}`);
      const valor = rest?.valor_restriccion?.trim();
      if (!valor) return RESPONSABLES_POR_CENTRO_FALLBACK[centro] || [];
      return valor.split(/[,&]/).map(v => v.trim()).filter(Boolean);
    };
    return { '1000': build('1000'), '2000': build('2000') };
  }, [restricciones]);

  // FERT candidatas: centro 1000/2000 y FECHAFIN entre el inicio del pendiente y la fecha de Venta
  // Externa (D+1). El tramo exacto (y el responsable) se resuelve en handleProcessResumen, que ya conoce
  // los materiales de Venta Externa.
  const prodFiltradas = useMemo(() => {
    return ordenesFert.filter(o => {
      const centro = getProp(o, ['CENTRO', 'Centro']).trim();
      if (centro && !['1000', '2000'].includes(centro)) return false;
      const fechaFin = fechaFinOrden(o);
      return !!fechaFin && fechaFin >= pendienteDesde && fechaFin <= ventana.d;
    });
  }, [ordenesFert, pendienteDesde, ventana.d]);

  // Inventario SAP (fuente CuboInventarios) filtrado a materiales "BLOQUE FORMULADO". El
  // StockActual de CuboInventarios ya viene en KG para estos materiales HALB (PesoNetoActual/
  // PesoBrutoActual/StockMaximo no los puebla SAP, siempre llegan en 0). Stock (UN) = Stock (KG)
  // ÷ TamLoteMin (lote mínimo de fabricación, también en KG): representa cuántos lotes mínimos
  // caben en el stock actual. Categoria viene directa del cubo (ej. "BQ_F_A_206_PL_D19_AF").
  const filteredInventario = useMemo(() => {
    return cuboInventarios
      .filter(row => String(row.Descripcion || '').toUpperCase().includes('BLOQUE FORMULADO'))
      .filter(row => !esMaterialPrueba(String(row.Descripcion || '')))
      .map(row => {
        const stockKg = safeNum(row.StockActual);
        const loteMin = safeNum(row.TamLoteMin);
        const loteMax = safeNum(row.TamLoteMax);
        const stockUN = loteMin > 0 ? stockKg / loteMin : 0;
        return {
          ...row,
          stockKg,
          stockUN,
          loteMin,
          loteMax
        };
      });
  }, [cuboInventarios]);

  // Kg de un material que todavía está dentro de su ventana de curado (fabricación + 2 días)
  // y por lo tanto NO debe contarse como stock disponible para descontar necesidades. Solo cuenta
  // como "en curado" lo que también calificaría en alguno de los dos espacios de Control Curado
  // (CURADO_SPACES) — misma definición de "está curando" en ambos lados, para que el Resumen y el
  // tab Control Curado sean coherentes entre sí. Campos confirmados contra la respuesta real de
  // getTiemposCuradoBloqueFormulado: CodMaterial (material), fecha (DD/MM/YYYY) y peso (Kg).
  // spaceKey opcional: sin él, suma cualquiera de los espacios de CURADO_SPACES (comportamiento
  // original, usado por el plan de "Salida de Datos" — ahí no importa de qué proceso viene el
  // curado, solo el total). Con spaceKey, restringe a ESE espacio únicamente (Leader o Cofama por
  // separado) — usado por "Evaluación Stock" para no mezclar ambos procesos en la misma cifra (antes
  // sumaba Leader+Cofama juntos sin forma de distinguirlos, confirmado por el usuario como el
  // problema real).
  const getStockEnCurado = useCallback((materialCode: string, spaceKey?: string): number => {
    const todayStr = format(new Date(), 'yyyy-MM-dd');
    const spacesToCheck = spaceKey ? CURADO_SPACES.filter(s => s.key === spaceKey) : CURADO_SPACES;
    return curadoData.reduce((sum, row) => {
      const mat = cleanCode(getProp(row, ['CodMaterial', 'MATERIAL', 'CODMATERIAL', 'COMPONENTE']));
      if (!mat || mat !== materialCode) return sum;
      if (!spacesToCheck.some(space => matchesCuradoSpace(row, space))) return sum;
      const fechaRaw = getProp(row, ['fecha', 'FECHA', 'FECHA_INICIO', 'FECHA_FABRICACION', 'FECHA_OT_PRG_INI']);
      const fab = parseFechaSAP(fechaRaw);
      if (!fab) return sum;
      const disp = new Date(fab);
      disp.setDate(disp.getDate() + CURADO_DIAS_ESPERA);
      const fechaDisponible = format(disp, 'yyyy-MM-dd');
      if (todayStr >= fechaDisponible) return sum; // ya está disponible, no se descuenta
      const kg = safeNum(getProp(row, ['peso', 'PESO', 'CANTIDAD', 'KG', 'PESO_KG', 'CANT_KG']));
      return sum + kg;
    }, 0);
  }, [curadoData]);

  // Paso 2 · Stock y Curado (usuario 2026-10-31, Excel de Leader): una fila de getTiemposCuradoBloqueFormulado
  // = un bloque físico (Idbloque); CantidadStock = Kg que le quedan, peso = peso real al fabricarlo.
  // Curado = fabricación + CURADO_DIAS_ESPERA. Por Bloque Formulado y por espacio (Leader / Cofama): bloques
  // y Kg curados y en curado, peso real promedio, y el stock del cubo SAP al lado para comparar.
  const stockCuradoPorEspacio = useMemo(() => {
    const todayStr = format(new Date(), 'yyyy-MM-dd');
    const sapKg = new Map<string, number>();
    filteredInventario.forEach(inv => {
      if (String(inv.Centro || '').trim() !== '1000') return;
      const code = cleanCode(inv.Material);
      sapKg.set(code, (sapKg.get(code) || 0) + inv.stockKg);
    });
    const porEspacio: Record<string, StockCuradoRow[]> = {};
    CURADO_SPACES.forEach(space => {
      const m = new Map<string, Omit<StockCuradoRow, 'pesoProm' | 'pesoN' | 'pesoMin' | 'pesoMax' | 'pesoCV' | 'pesoDescartados'> & { pesos: number[] }>();
      curadoData.forEach(row => {
        if (!matchesCuradoSpace(row, space)) return;
        const code = cleanCode(getProp(row, ['CodMaterial', 'MATERIAL', 'CODMATERIAL']));
        if (!code) return;
        const info = extractMaterialInfo(row);
        const r = m.get(code) ?? {
          materialCode: code, descripcion: getProp(row, ['NomMaterial', 'NOMMATERIAL']) || '—', apertura: info.apertura, dens: info.dens,
          curadosUN: 0, curadosKg: 0, enCuradoUN: 0, enCuradoKg: 0, stockSapKg: sapKg.get(code) || 0, pesos: [],
        };
        const peso = safeNum(getProp(row, ['peso', 'PESO']));
        if (peso > 0) r.pesos.push(peso);
        const kg = safeNum(getProp(row, ['CantidadStock', 'CANTIDADSTOCK', 'CANTIDAD_STOCK']));
        const fab = parseFechaSAP(getProp(row, ['fecha', 'FECHA', 'FECHA_INICIO', 'FECHA_FABRICACION', 'FECHA_OT_PRG_INI']));
        if (kg > 0 && fab) {
          const disp = new Date(fab);
          disp.setDate(disp.getDate() + CURADO_DIAS_ESPERA);
          if (todayStr >= format(disp, 'yyyy-MM-dd')) { r.curadosUN += 1; r.curadosKg += kg; }
          else { r.enCuradoUN += 1; r.enCuradoKg += kg; }
        }
        m.set(code, r);
      });
      // Leader: también los Bloques Formulados de apertura con stock SAP sin registros de curado, para que
      // esta pestaña liste lo mismo que el Plan de Reposición (usuario 2026-11-12: "no cuadra siendo la misma data").
      if (space.key === 'leader') {
        filteredInventario.forEach(inv => {
          const code = cleanCode(inv.Material);
          if (String(inv.Centro || '').trim() !== '1000' || m.has(code) || !(inv.stockKg > 0)) return;
          const info = extractMaterialInfo(inv as unknown as RawApiRow);
          if (info.apertura === '—') return;
          m.set(code, {
            materialCode: code, descripcion: String(inv.Descripcion || '—').toUpperCase(), apertura: info.apertura, dens: info.dens,
            curadosUN: 0, curadosKg: 0, enCuradoUN: 0, enCuradoKg: 0, stockSapKg: sapKg.get(code) || 0, pesos: [],
          });
        });
      }
      porEspacio[space.key] = Array.from(m.values())
        .map(({ pesos, ...r }) => ({ ...r, ...estadisticaPeso(pesos) }))
        .sort(compareAperturaDensidad);
    });
    return porEspacio;
  }, [curadoData, filteredInventario]);

  // Paso 3 · Base del Plan de Reposición Leader (ver BaseReposicionRow): universo = Bloques Formulados de
  // apertura del cubo, centro 1000. Resuelve aquí restricciones, peso, meta de consumo, VE y plan del día
  // anterior para que el respaldo del reporte se recargue igual sin SAP. Completa movimientosCache.
  // Último reporte guardado antes del día de producción (de ahí sale el "Plan anterior" de Leader y Cofama).
  const buscarPlanAnterior = useCallback(async (): Promise<{ fecha: string; estado: Partial<EstadoPlanFormulacion> } | null> => {
    const extra = laborablesHorizonte(calendario.laborablesExtra);
    const hoyPlan = previousBusinessDay(new Date(`${ventana.d}T12:00:00`), calendario.noLaborables, extra);
    const fechas: string[] = [];
    for (const d = new Date(hoyPlan); format(d, 'yyyy-MM-dd') < ventana.d; d.setDate(d.getDate() + 1)) fechas.push(format(d, 'yyyy-MM-dd'));
    const previo = await buscarUltimoPlanTxt({ modulo: 'formulacion', centro: '1000', fechas }).catch(() => null);
    return previo?.estado ? { fecha: previo.fechaObjetivo, estado: previo.estado as Partial<EstadoPlanFormulacion> } : null;
  }, [calendario, ventana.d]);
  // Valor de una restricción del grupo por nombre (sin distinguir mayúsculas); '' si no existe.
  const restr = useCallback((nombre: string): string =>
    restricciones.find(r => String(r.nombre_restriccion || '').trim().toUpperCase() === nombre.toUpperCase())?.valor_restriccion?.trim() || '',
  [restricciones]);

  const construirReposicion = useCallback(async (
    movimientosCache: Map<string, MovimientoConsumo[]>,
    previo: { fecha: string; estado: Partial<EstadoPlanFormulacion> } | null,
  ): Promise<ReposicionLeader> => {
    const extra = laborablesHorizonte(calendario.laborablesExtra);
    const dProd = new Date(`${ventana.d}T12:00:00`);
    const hoyPlan = previousBusinessDay(dProd, calendario.noLaborables, extra);

    const universo = new Map<string, { desc: string; categoria: string; apertura: string; dens: string; stockKg: number; loteMin: number }>();
    cuboInventarios.forEach(inv => {
      const desc = String(inv.Descripcion || '');
      if (String(inv.Centro || '').trim() !== '1000' || !/BLOQUE FORMULADO/i.test(desc) || esMaterialPrueba(desc)) return;
      const info = extractMaterialInfo(inv as unknown as RawApiRow);
      if (info.apertura === '—') return;
      const code = cleanCode(inv.Material);
      const u = universo.get(code) ?? { desc: desc.toUpperCase(), categoria: String(inv.Categoria || ''), apertura: info.apertura, dens: info.dens, stockKg: 0, loteMin: 0 };
      u.stockKg += safeNum(inv.StockActual);
      u.loteMin = Math.max(u.loteMin, safeNum(inv.TamLoteMin));
      universo.set(code, u);
    });

    const faltantes = Array.from(universo.keys()).filter(c => !movimientosCache.has(c));
    for (let i = 0; i < faltantes.length; i += 6) {
      const lote = faltantes.slice(i, i + 6);
      const res = await Promise.all(lote.map(fetchMovimientosConsumo));
      lote.forEach((c, k) => movimientosCache.set(c, res[k]));
    }
    // Días hábiles (con jornadas de sábado) de la ventana del histórico, para la meta lineal por día.
    const diasVentana = SEMANAS_META_CONSUMO * 7;
    let diasHabiles = 0;
    for (let i = 0; i < diasVentana; i++) {
      const d = new Date();
      d.setDate(d.getDate() - i);
      if (!esDiaNoLaborable(d, calendario.noLaborables, calendario.laborablesExtra)) diasHabiles++;
    }

    // Venta Externa (V) = exceso de las FERT 018 sobre lo que VE ya consume dentro de la meta histórica.
    const diasVE = Math.max(1, Math.round(numeroRestriccion(restr('Formulacion_Dias_VE')) ?? DIAS_VE_DEFAULT));
    const limiteVE = format(addBusinessDays(dProd, diasVE - 1, calendario.noLaborables, extra), 'yyyy-MM-dd');
    const hoyStr = format(new Date(), 'yyyy-MM-dd');
    const inicioHist = new Date();
    inicioHist.setDate(inicioHist.getDate() - diasVentana + 1);
    const histDesde = format(inicioHist, 'yyyy-MM-dd');
    const ordenes018: { material: string; ventana: number; hist: number }[] = [];
    ordenesFert.forEach(o => {
      if (getProp(o, ['CENTRO', 'Centro']).trim() !== '1000') return;
      if (getProp(o, ['RESPCTRLPROD', 'RESPCONTROLPROD', 'RESP_CONTROL_PROD', 'RESPONSABLE']).trim() !== RESP_VENTA_EXTERNA_PT) return;
      const fechaFin = fechaFinOrden(o);
      if (!fechaFin) return;
      const pend = safeNum(getProp(o, ['CANTPENDIENTE', 'CANTPEND']));
      const notif = safeNum(getProp(o, ['CANTNOTIFICADA', 'CANT_NOTIFICADA']));
      const ventana = fechaFin <= limiteVE && pend > 0 ? pend : 0;
      const hist = fechaFin >= histDesde && fechaFin < hoyStr && notif > 0 ? notif : 0;
      if (ventana > 0 || hist > 0) ordenes018.push({ material: extractMaterialInfo(o).code, ventana, hist });
    });
    // Kg de Bloque Formulado por UN de cada plancha 018: una explosión BOM por material, no por orden.
    const bomPorMaterial = new Map<string, Map<string, number>>();
    const materiales018 = Array.from(new Set(ordenes018.map(o => o.material)));
    for (let i = 0; i < materiales018.length; i += 6) {
      const lote = materiales018.slice(i, i + 6);
      const res = await Promise.all(lote.map(async mat => {
        const porBloque = new Map<string, number>();
        try {
          const r = await serviciosService.getMaestroMaterialesExplosion('1000', mat.padStart(18, '0'), 1, 100);
          const bom: MaterialExplosionRow[] = r?.data?.data || r?.data || [];
          if (Array.isArray(bom)) bom.forEach(row => {
            if (!(row.DESCRIPCION_COMPONENTE || '').toUpperCase().includes('BLOQUE FORMULADO')) return;
            const cod = cleanCode(row.COMPONENTE);
            porBloque.set(cod, (porBloque.get(cod) || 0) + safeNum(row.CANTIDAD_ACUMULADA || row.CANTIDAD_UNITARIA || 0));
          });
        } catch { /* sin BOM: la plancha no suma a ningún bloque */ }
        return porBloque;
      }));
      lote.forEach((mat, k) => bomPorMaterial.set(mat, res[k]));
    }
    const veVentanaKg = new Map<string, number>();
    const veHistKg = new Map<string, number>();
    ordenes018.forEach(o => bomPorMaterial.get(o.material)?.forEach((kgPorUN, cod) => {
      if (o.ventana > 0) veVentanaKg.set(cod, (veVentanaKg.get(cod) || 0) + kgPorUN * o.ventana);
      if (o.hist > 0) veHistKg.set(cod, (veHistKg.get(cod) || 0) + kgPorUN * o.hist);
    }));

    const repPrevia = previo?.estado?.reposicion;
    const planAnterior = planFinalReposicion(repPrevia);

    const curadoLeader = new Map((stockCuradoPorEspacio['leader'] ?? []).map(r => [r.materialCode, r]));
    const pesoReal = new Map(Array.from(curadoLeader).filter(([, r]) => r.pesoProm > 0).map(([c, r]) => [c, r.pesoProm]));
    const horizonteGeneral = numeroRestriccion(restr('Formulacion_Cobertura_Dias')) ?? HORIZONTE_DEFAULT_DIAS;

    const filas: BaseReposicionRow[] = [];
    universo.forEach((u, code) => {
      const real = pesoReal.get(code);
      const pesoBloque = u.loteMin > 0 ? u.loteMin : real ?? 0;
      const veVentana = veVentanaKg.get(code) || 0;
      const veBase = diasHabiles > 0 ? ((veHistKg.get(code) || 0) / diasHabiles) * diasVE : 0;
      const metaKgDia = diasHabiles > 0 ? consumoUltimosDiasKg(movimientosCache.get(code) ?? [], diasVentana) / diasHabiles : 0;
      const coberturaRestr = restr(`Cobertura_${code}`);
      const horizonteMaterial = coberturaRestr ? horizonteDeRestriccion(coberturaRestr, hoyPlan.getDay()) : null;
      const estrategiaRestr = restr(`Estrategia_${code}`).toUpperCase();
      const diasProd = diasProduccionDeRestriccion(restr(`DiasProduccion_${u.apertura}`));
      const fila: BaseReposicionRow = {
        blockCode: code, blockDesc: u.desc, corrida: extraerCorridaCategoria(u.categoria), apertura: u.apertura, dens: u.dens,
        pesoBloque, pesoFuente: u.loteMin > 0 ? 'lote' : real ? 'real' : 'sin dato', pesoRealProm: real,
        pesoDetalle: (() => {
          const c = curadoLeader.get(code);
          const base = u.loteMin > 0 ? `Estándar Lote Mín. SAP ${formatNum(u.loteMin, 0)} Kg` : 'Sin Lote Mín. SAP: promedio real';
          if (!c || c.pesoN === 0) return `${base} · sin bloques fabricados en curado`;
          const dif = u.loteMin > 0 ? ` (${c.pesoProm / u.loteMin - 1 >= 0 ? '+' : ''}${((c.pesoProm / u.loteMin - 1) * 100).toFixed(1)} %)` : '';
          return `${base} · real ${formatNum(c.pesoProm, 0)} Kg${dif}, ${c.pesoN} bloque(s) ${formatNum(c.pesoMin, 0)}–${formatNum(c.pesoMax, 0)}${c.pesoDescartados ? `, ${c.pesoDescartados} parcial(es) fuera` : ''}`;
        })(),
        stockKg: u.stockKg, enCuradoKg: curadoLeader.get(code)?.enCuradoKg ?? 0, curadoKg: curadoLeader.get(code)?.curadosKg ?? 0,
        metaKgDia, veKg: Math.max(0, veVentana - veBase), veVentanaKg: veVentana, veBaseKg: veBase, planAnteriorUN: planAnterior[code] || 0,
        horizonteDias: horizonteMaterial ?? horizonteGeneral, horizonteRestriccion: horizonteMaterial !== null,
        estrategia: estrategiaRestr === 'MTO' || estrategiaRestr === 'HB' ? estrategiaRestr : 'MTS',
        diaProduccion: diasProd ? diasProd.has(dProd.getDay()) : true,
      };
      if (fila.stockKg > 0 || fila.metaKgDia > 0 || veVentana > 0 || fila.planAnteriorUN > 0 || fila.horizonteRestriccion) filas.push(fila);
    });
    filas.sort(compareAperturaDensidad);
    return {
      filas,
      diaProduccion: ventana.d,
      planAnteriorFecha: repPrevia ? previo?.fecha ?? null : null,
      nichosMax: numeroRestriccion(restr('Formulacion_Nichos_Max')) ?? NICHOS_MAX_DEFAULT,
      autodescargaUN: numeroRestriccion(restr('Formulacion_Autodescarga_UN')) ?? AUTODESCARGA_DEFAULT_UN,
      autodescarga: false,
      metaOverride: {},
      planOverride: {},
    };
  }, [restr, calendario, ventana.d, cuboInventarios, ordenesFert, stockCuradoPorEspacio]);

  // Paso 3 · Base del Plan de Reposición Cofama (ver BaseCofamaRow): universo = BLOQUE CORTADO resp 030 del
  // cubo, centro 1000. La BOM de cada cortado da su peso (Kg de formulado por UN) y su formulado.
  const construirReposicionCofama = useCallback(async (
    movimientosCache: Map<string, MovimientoConsumo[]>,
    consumoRows: ConsumoBloqueRow[],
    previo: { fecha: string; estado: Partial<EstadoPlanFormulacion> } | null,
  ): Promise<ReposicionCofama> => {
    const extra = laborablesHorizonte(calendario.laborablesExtra);
    const dProd = new Date(`${ventana.d}T12:00:00`);
    const hoyPlan = previousBusinessDay(dProd, calendario.noLaborables, extra);

    const cortadosCubo = cuboInventarios.filter(inv => String(inv.Centro || '').trim() === '1000' && /BLOQUE CORTADO/i.test(String(inv.Descripcion || '')) && !esMaterialPrueba(String(inv.Descripcion || '')));
    // Cofama = responsable 030 (puede llegar como "30"); si el cubo no lo trae, todos los cortados. En ambos
    // casos se descartan los de apertura Leader aquí y, con la BOM, los que no pasan esCortadoCofama.
    const de030 = cortadosCubo.filter(inv => String(inv.RespCtrlProd ?? '').trim().padStart(3, '0') === RESP_COFAMA_CORTADO);
    const sinApertura = (de030.length > 0 ? de030 : cortadosCubo).filter(inv => extractMaterialInfo({ NOMBRE: String(inv.Descripcion || '') }).apertura === '—');
    const cofamaSpace = CURADO_SPACES.find(s => s.key === 'cofama');
    const formuladosCofama = new Set(curadoData.filter(row => cofamaSpace && matchesCuradoSpace(row, cofamaSpace)).map(row => cleanCode(getProp(row, ['CodMaterial', 'MATERIAL', 'CODMATERIAL']))).filter(Boolean));
    const universo = new Map<string, { desc: string; stockKg: number }>();
    sinApertura.forEach(inv => {
      const code = cleanCode(inv.Material);
      const u = universo.get(code) ?? { desc: String(inv.Descripcion || '').toUpperCase(), stockKg: 0 };
      u.stockKg += safeNum(inv.StockActual);
      universo.set(code, u);
    });

    // BOM del cortado: Kg de Bloque Formulado por UN (= peso del cortado) y qué formulado usa.
    const bom = new Map<string, { formuladoCode: string; formuladoDesc: string; kgPorUN: number }>();
    const codigos = Array.from(universo.keys());
    for (let i = 0; i < codigos.length; i += 6) {
      const lote = codigos.slice(i, i + 6);
      const res = await Promise.all(lote.map(async code => {
        try {
          const r = await serviciosService.getMaestroMaterialesExplosion('1000', code.padStart(18, '0'), 1, 100);
          const filas: MaterialExplosionRow[] = r?.data?.data || r?.data || [];
          const f = Array.isArray(filas) ? filas.filter(x => (x.DESCRIPCION_COMPONENTE || '').toUpperCase().includes('BLOQUE FORMULADO')) : [];
          if (f.length === 0) return null;
          return {
            formuladoCode: cleanCode(f[0].COMPONENTE),
            formuladoDesc: String(f[0].DESCRIPCION_COMPONENTE || '').toUpperCase(),
            kgPorUN: f.reduce((s, x) => s + safeNum(x.CANTIDAD_ACUMULADA || x.CANTIDAD_UNITARIA || 0), 0),
          };
        } catch { return null; }
      }));
      lote.forEach((c, k) => { const b = res[k]; if (b) bom.set(c, b); });
    }

    const faltantes = codigos.filter(c => !movimientosCache.has(c));
    for (let i = 0; i < faltantes.length; i += 6) {
      const lote = faltantes.slice(i, i + 6);
      const res = await Promise.all(lote.map(fetchMovimientosConsumo));
      lote.forEach((c, k) => movimientosCache.set(c, res[k]));
    }
    const diasVentana = SEMANAS_META_CONSUMO * 7;
    let diasHabiles = 0;
    for (let i = 0; i < diasVentana; i++) {
      const d = new Date();
      d.setDate(d.getDate() - i);
      if (!esDiaNoLaborable(d, calendario.noLaborables, calendario.laborablesExtra)) diasHabiles++;
    }

    const internoKg = new Map<string, number>();
    consumoRows.forEach(r => { if (r.un === 'KG' && universo.has(r.componente)) internoKg.set(r.componente, (internoKg.get(r.componente) || 0) + r.total); });

    const planAnterior = planCofamaPorCortado(previo?.estado?.reposicionCofama);
    const horizonteGeneral = numeroRestriccion(restr('Formulacion_Cobertura_Cofama_Dias')) ?? numeroRestriccion(restr('Formulacion_Cobertura_Dias')) ?? HORIZONTE_DEFAULT_DIAS;
    const diasProd = diasProduccionDeRestriccion(restr('DiasProduccion_COFAMA'));

    const filas: BaseCofamaRow[] = [];
    universo.forEach((u, code) => {
      const b = bom.get(code);
      if (!esCortadoCofama(u.desc, b?.formuladoCode ?? '', b?.formuladoDesc ?? '', formuladosCofama)) return;
      const coberturaRestr = restr(`Cobertura_${code}`);
      const horizonteMaterial = coberturaRestr ? horizonteDeRestriccion(coberturaRestr, hoyPlan.getDay()) : null;
      filas.push({
        cortadoCode: code, cortadoDesc: u.desc,
        formuladoCode: b?.formuladoCode ?? '', formuladoDesc: b?.formuladoDesc ?? '',
        dens: extractMaterialInfo({ NOMBRE: u.desc }).dens, medida: medidaDeTexto(u.desc),
        // El cortado está en KG en SAP (su BOM da 1 Kg/Kg): el peso por UN se resuelve más abajo.
        pesoCortado: 0,
        stockCortadoKg: u.stockKg, stockFormuladoUN: 0,
        metaKgDia: diasHabiles > 0 ? consumoUltimosDiasKg(movimientosCache.get(code) ?? [], diasVentana) / diasHabiles : 0,
        internoKg: internoKg.get(code) || 0, planAnteriorUN: planAnterior.get(code) || 0,
        horizonteDias: horizonteMaterial ?? horizonteGeneral, horizonteRestriccion: horizonteMaterial !== null,
        diaProduccion: diasProd ? diasProd.has(dProd.getDay()) : true,
      });
    });

    // Formulados Cofama: los de la BOM de los cortados y los que aparecen en curado, con sus combinaciones.
    const formulados = new Map<string, FormuladoCofama>();
    filas.forEach(f => { if (f.formuladoCode && !formulados.has(f.formuladoCode)) formulados.set(f.formuladoCode, { code: f.formuladoCode, desc: f.formuladoDesc, pesoKg: 0, combinaciones: [] }); });
    const sinEmparejar = new Map<string, SinEmparejarCofama>();
    const stockFormulado = new Map<string, number>();
    curadoData.forEach(row => {
      if (!cofamaSpace || !matchesCuradoSpace(row, cofamaSpace)) return;
      const code = cleanCode(getProp(row, ['CodMaterial', 'MATERIAL', 'CODMATERIAL']));
      const desc = (getProp(row, ['NomMaterial', 'NOMMATERIAL']) || '').toUpperCase();
      const comb = getProp(row, ['corridaproceso', 'CORRIDAPROCESO']).trim();
      if (!code) return;
      const fm = formulados.get(code) ?? { code, desc, pesoKg: 0, combinaciones: [] };
      if (comb && parseCombinacion(comb).length > 0 && !fm.combinaciones.includes(comb)) fm.combinaciones.push(comb);
      formulados.set(code, fm);
      // Bloque en calle (con Kg disponibles): se cuenta como los cortados que va a dar.
      if (safeNum(getProp(row, ['CantidadStock', 'CANTIDADSTOCK', 'CANTIDAD_STOCK'])) <= 0 || !comb) return;
      const { porCortado, sinEmparejar: faltan } = repartirCombinacion(code, desc, comb, 1, filas);
      porCortado.forEach((un, c) => stockFormulado.set(c, (stockFormulado.get(c) || 0) + un));
      faltan.forEach(medida => {
        const k = `${code}|${medida}`;
        const s = sinEmparejar.get(k) ?? { formuladoCode: code, formuladoDesc: desc, combinacion: medida, bloques: 0 };
        s.bloques += 1;
        sinEmparejar.set(k, s);
      });
    });
    filas.forEach(f => { f.stockFormuladoUN = stockFormulado.get(f.cortadoCode) || 0; });

    // Peso por UN del cortado: restricción Peso_<cortado>; si no, de los bloques Cofama fabricados — el peso de
    // cada formulado se reparte entre sus piezas por área (3un - 135X190 de 261,7 Kg → ~87 Kg por pieza).
    const piezas = new Map<string, number[]>();
    curadoData.forEach(row => {
      if (!cofamaSpace || !matchesCuradoSpace(row, cofamaSpace)) return;
      const peso = safeNum(getProp(row, ['peso', 'PESO']));
      const comb = getProp(row, ['corridaproceso', 'CORRIDAPROCESO']).trim();
      const partes = parseCombinacion(comb);
      const areaTotal = partes.reduce((s, p) => s + p.un * p.ancho * p.largo, 0);
      if (!(peso > 0) || areaTotal <= 0) return;
      const code = cleanCode(getProp(row, ['CodMaterial', 'MATERIAL', 'CODMATERIAL']));
      const desc = (getProp(row, ['NomMaterial', 'NOMMATERIAL']) || '').toUpperCase();
      partes.forEach(p => {
        const { porCortado } = repartirCombinacion(code, desc, `1un - ${p.ancho}X${p.largo}`, 1, filas);
        porCortado.forEach((_, c) => piezas.set(c, [...(piezas.get(c) ?? []), (peso * p.ancho * p.largo) / areaTotal]));
      });
    });
    filas.forEach(f => {
      const fijo = numeroRestriccion(restr(`Peso_${f.cortadoCode}`));
      f.pesoCortado = fijo && fijo > 0 ? fijo : estadisticaPeso(piezas.get(f.cortadoCode) ?? []).pesoProm;
    });
    // Peso del formulado (Kg del PLAN): Lote Mín. SAP; si no hay, promedio real de los fabricados Cofama.
    const pesoRealCofama = new Map((stockCuradoPorEspacio['cofama'] ?? []).map(r => [r.materialCode, r.pesoProm]));
    formulados.forEach(fm => {
      const lote = cuboInventarios.filter(inv => cleanCode(inv.Material) === fm.code && String(inv.Centro || '').trim() === '1000').reduce((m, inv) => Math.max(m, safeNum(inv.TamLoteMin)), 0);
      fm.pesoKg = lote > 0 ? lote : pesoRealCofama.get(fm.code) || 0;
      fm.combinaciones.sort();
    });

    filas.sort((a, b) => (parseFloat(a.dens) || 0) - (parseFloat(b.dens) || 0) || a.cortadoDesc.localeCompare(b.cortadoDesc));
    const previa = previo?.estado?.reposicionCofama;
    return {
      filas,
      formulados: Array.from(formulados.values()).sort((a, b) => a.desc.localeCompare(b.desc)),
      sinEmparejar: Array.from(sinEmparejar.values()),
      diaProduccion: ventana.d,
      planAnteriorFecha: previa ? previo?.fecha ?? null : null,
      lineas: [],
      metaOverride: {},
    };
  }, [restr, calendario, ventana.d, cuboInventarios, curadoData, stockCuradoPorEspacio]);

  // Paso 1 · Necesidad: FERT de la ventana (pendiente + planificado) de los responsables de Formulación
  // y de Venta Externa (038), explotadas a Kg de Bloque Formulado. Necesidad neta = esa necesidad −
  // stock útil (stock SAP menos lo que aún está en curado); el plan de reposición cubre el faltante.
  const handleProcessResumen = useCallback(async (): Promise<{ estado: 'ok' | 'aviso' | 'error'; mensaje: string; progreso?: { actual: number; total: number } }> => {
    const allOrders = prodFiltradas.flatMap(o => {
      const centro = getProp(o, ['CENTRO', 'Centro']).trim();
      const resp = getProp(o, ['RESPCTRLPROD', 'RESPCONTROLPROD', 'RESP_CONTROL_PROD', 'RESPONSABLE']).trim();
      if (!entraEnFormulacion(centro, resp, respPorCentroDinamico)) return [];
      if (esMuestraLaboratorio(extractMaterialInfo(o).desc)) return [];
      const esVenta = resp === RESP_VENTA_EXTERNA;
      const tramo = tramoFert(fechaFinOrden(o));
      if (!tramo) return [];
      const destino: DestinoConsumo = resp === RESP_VENTA_EXTERNA ? 'VE' : resp === RESP_SUBBLOQUES_GYE ? '2000' : '1000';
      return [{ order: o, origin: 'fert' as const, centro, resp, esVenta, tramo, destino }];
    });
    if (allOrders.length === 0) {
      setUnifiedSummaryData([]);
      setConsumoBloqueFormulado([]);
      // La reposición Leader va por cobertura: se calcula aunque no haya FERT en la ventana.
      const movs = new Map<string, MovimientoConsumo[]>();
      const previo = await buscarPlanAnterior();
      const rep = await construirReposicion(movs, previo);
      const repCof = await construirReposicionCofama(movs, [], previo);
      setReposicion(rep);
      setReposicionCofama(repCof);
      setMovimientosConsumo(Object.fromEntries(movs));
      actualizarEnCache<SnapshotFormulacion>(CACHE_FORMULACION, { unifiedSummaryData: [], consumoBloqueFormulado: [], reposicion: rep, reposicionCofama: repCof });
      return { estado: 'aviso', mensaje: `Sin FERT de Formulación / Venta Externa entre ${pendienteDesde} y ${ventana.d}; reposición por cobertura: ${rep.filas.length} bloque(s) Leader, ${repCof.filas.length} cortado(s) Cofama.` };
    }
    setIsProcessingResumen(true);
    const groupsMap = new Map<string, FormuladoSummaryRow>();
    const consumoRows: ConsumoBloqueRow[] = [];
    // Consumo/D se pide UNA vez por Bloque Formulado (no por orden): varias órdenes distintas
    // pueden trazar al mismo blockCode, y getConsumosFormulado ya trae todo el histórico de ese
    // material en una sola llamada — repetirla por orden sería puro desperdicio.
    const movimientosCache = new Map<string, MovimientoConsumo[]>();
    setResumenProgress({ current: 0, total: allOrders.length });

    for (let i = 0; i < allOrders.length; i++) {
      const { order: o, origin, centro: centroOrden, resp: respOrden, esVenta, tramo, destino } = allOrders[i];
      const info = extractMaterialInfo(o);
      const qty = safeNum(getProp(o, ['CANTPEND', 'CANTPENDIENTE', 'CANTPROGRAMADA', 'CANTIDAD', 'CANT_PROG']));
      // Pendiente = lo que falta cortar: una orden ya completa no consume más bloque.
      if (qty <= 0) continue;
      const anchoVal = parseFloat(info.ancho) || 0;
      const espVal = parseFloat(info.esp) || 0;
      const densVal = parseFloat(String(info.dens)) || 0;
      const usefulHeight = (densVal < 30) ? 103 : 85;
      const itemBloques = (usefulHeight * BLOCK_LENGTH_METERS * 100) > 0
        ? (qty * espVal * anchoVal) / (usefulHeight * BLOCK_LENGTH_METERS * 100)
        : 0;
      const itemKg = (anchoVal * 200 * espVal * densVal * qty) / 10000;
      const ordenNum = getProp(o, ['ORDENPREVISIONAL', 'ORDEN', 'ORDEN_PROCESO']) || '—';
      const marcaVentana: Partial<ConsumoBloqueRow> = { fechaFin: fechaFinOrden(o), ventaExterna: esVenta, tramo, destino, cantidad: qty };
      const consumoDesde = consumoRows.length;

      let blockCode = '—';
      let blockDesc = '—';
      try {
        const bomResponse = await serviciosService.getMaestroMaterialesExplosion(centroOrden || '1000', info.code.padStart(18, '0'), 1, 100);
        const bomData = bomResponse?.data?.data || bomResponse?.data || [];
        if (Array.isArray(bomData)) {
          const blockComp = bomData.find(row => (row.DESCRIPCION_COMPONENTE || '').toUpperCase().includes('BLOQUE FORMULADO'));
          if (blockComp) {
            blockCode = cleanCode(blockComp.COMPONENTE);
            blockDesc = String(blockComp.DESCRIPCION_COMPONENTE).toUpperCase();
          }
          consumoRows.push(...traceBloqueFormuladoConsumption(bomData, info.code, ordenNum, origin, centroOrden, respOrden, qty));
        }
      } catch { console.warn(`Error BOM para ${info.code}`); }
      // Sin "BLOQUE FORMULADO" en su BOM (lámina prensada, taco, látex, muestras...) la orden no se
      // muestra (usuario 2026-10-31): Formulación solo cuenta lo que consume bloque formulado.
      for (let k = consumoDesde; k < consumoRows.length; k++) Object.assign(consumoRows[k], marcaVentana);

      // "Salida de Datos" (unifiedSummaryData) SOLO debe reflejar Bloque Formulado real — el usuario
      // confirmó que ese tab toma sus datos de "Consumo de Bloque Formulado por Componente" (arriba),
      // no de los materiales auto-referenciados. Antes esta sección corría igual con blockCode='—',
      // agrupando materiales como "LAMINA PRENSADA"/"TACO PRENSADO" bajo su propia apertura/densidad
      // como si fueran un bloque — verificado en vivo: aparecían mezclados en la sección "Combinación
      // (sin apertura técnica)" con un Stock/Plan Reposición calculado con la física de bloque
      // (pesoBloque), que no les aplica. Ahora solo entran los materiales con blockCode real.
      if (blockCode !== '—') {
        // Clave incluye CENTRO: el mismo blockCode es inventario y necesidad separados en Quito
        // (1000) y Guayaquil (2000) — ver comentario de FormuladoSummaryRow.
        const key = `${blockCode}|${info.apertura}|${densVal}|${centroOrden}`;
        if (!groupsMap.has(key)) {
          const invRows = cuboInventarios.filter(inv => cleanCode(inv.Material) === blockCode && String(inv.Centro || '').trim() === centroOrden);
          const stockKg = invRows.reduce((sum, item) => sum + safeNum(item.StockActual), 0);
          const corrida = extraerCorridaCategoria(invRows[0]?.Categoria || '');
          const pesoBloque = (100 * usefulHeight * BLOCK_LENGTH_METERS * densVal) / 10000;
          const stockUN = pesoBloque > 0 ? stockKg / pesoBloque : 0;
          // getStockEnCurado NO distingue centro todavía (getTiemposCuradoBloqueFormulado solo trae
          // CodMaterial/fecha/peso confirmados, sin campo Centro verificado — ver su comentario). Si
          // el mismo blockCode cura en ambos centros a la vez, este Kg "en curado" se le resta a los
          // dos grupos por igual (puede sobrestimar el descuento de un centro y subestimar el otro)
          // hasta que se confirme un campo Centro real en esa respuesta.
          const stockEnCuradoKg = getStockEnCurado(blockCode);
          const stockEnCuradoUN = pesoBloque > 0 ? stockEnCuradoKg / pesoBloque : 0;
          const stockUtilUN = Math.max(0, stockUN - stockEnCuradoUN);
          // Mismo caso que getStockEnCurado: getConsumosFormulado/Registros51Mb solo confirma
          // Movimiento/Fecha/Cantidad, sin Centro — el Consumo/D de acá es compartido entre los dos
          // centros hasta confirmar ese campo en la respuesta real.
          if (!movimientosCache.has(blockCode)) {
            movimientosCache.set(blockCode, await fetchMovimientosConsumo(blockCode));
          }
          const consumoDiarioKg = consumoDiarioKgDe(movimientosCache.get(blockCode) ?? []);
          groupsMap.set(key, {
            blockCode, blockDesc: blockDesc !== '—' ? blockDesc : info.desc, centro: centroOrden, corrida,
            dens: info.dens, apertura: info.apertura,
            totalBloquesPendiente: 0, totalBloquesPlanificado: 0, planReposicion: 0,
            stockKg, stockUN, stockEnCuradoUN, stockUtilUN, pesoBloque,
            kgTotal: 0, unidades: 0, consumoDiarioKg,
            ferts: []
          });
        }
        const entry = groupsMap.get(key)!;
        if (tramo === 'pendiente') {
          entry.totalBloquesPendiente += itemBloques;
        } else {
          entry.totalBloquesPlanificado += itemBloques;
        }
        entry.kgTotal += itemKg;
        entry.unidades += qty;
        entry.planReposicion = Math.max(0, Math.ceil(entry.totalBloquesPendiente + entry.totalBloquesPlanificado - entry.stockUtilUN));
        entry.ferts.push({ code: info.code, desc: info.desc, qty, kg: itemKg, bloques: itemBloques, origin });
      }
      if (i % 10 === 0) setResumenProgress({ current: i + 1, total: allOrders.length });
    }
    // Orden ascendente por Corrida (194.5 -> 206 -> 219 -> 228, pedido por el usuario) — se ordena
    // por la Apertura ya parseada (aperturaSortIndex, misma secuencia que usa Control Curado), no
    // por el string de Corrida en sí: la Categoria real de SAP trae inconsistencias verificadas
    // (ej. un material de apertura 219 etiquetado "BQ_F_A_216.5"), así que Apertura es la fuente
    // más confiable para el orden. Corrida entra como desempate alfabético dentro de cada apertura.
    const summaryOrdenado = Array.from(groupsMap.values()).sort((a, b) =>
      aperturaSortIndex(a.apertura) - aperturaSortIndex(b.apertura) || a.corrida.localeCompare(b.corrida) || a.centro.localeCompare(b.centro)
    );
    const previo = await buscarPlanAnterior();
    const rep = await construirReposicion(movimientosCache, previo);
    const repCof = await construirReposicionCofama(movimientosCache, consumoRows, previo);
    setUnifiedSummaryData(summaryOrdenado);
    setConsumoBloqueFormulado(consumoRows);
    setReposicion(rep);
    setReposicionCofama(repCof);
    setMovimientosConsumo(Object.fromEntries(movimientosCache));
    // Mantiene el snapshot en sync — si el usuario navega a otro módulo y vuelve, el tab Resumen ya
    // no aparece vacío (ver SnapshotFormulacion). No-op si todavía no se sincronizó ningún dato base
    // (actualizarEnCache no escribe sobre un snapshot inexistente).
    actualizarEnCache<SnapshotFormulacion>(CACHE_FORMULACION, {
      unifiedSummaryData: summaryOrdenado,
      consumoBloqueFormulado: consumoRows,
      reposicion: rep,
      reposicionCofama: repCof,
    });
    setIsProcessingResumen(false);
    return { estado: 'ok', mensaje: `${allOrders.length} orden(es) → ${summaryOrdenado.length} bloque(s) formulado(s) en el resumen; reposición: ${rep.filas.length} bloque(s) Leader, ${repCof.filas.length} cortado(s) Cofama.`, progreso: { actual: allOrders.length, total: allOrders.length } };
  }, [prodFiltradas, cuboInventarios, getStockEnCurado, respPorCentroDinamico, tramoFert, pendienteDesde, ventana.d, construirReposicion, construirReposicionCofama, buscarPlanAnterior]);

  // Segunda fase de "Sincronizar y Generar Necesidades" (ver handleSincronizarYGenerar): corre
  // handleProcessResumen automáticamente en cuanto el render con los datos recién sincronizados ya
  // ocurrió — acá arriba, handleProcessResumen ya es la versión fresca (provFiltradas/prodFiltradas
  // ya se recalcularon). Antes era un botón manual separado ("Generar Necesidades"); el usuario pidió
  // combinarlo con Sincronizar por ser repetitivo en el uso diario.
  useEffect(() => {
    if (!autoGenerarPendiente) return;
    setAutoGenerarPendiente(false);
    setSyncStep('generando');
    panelProgreso.actualizar('resumen', { estado: 'en_curso' });
    handleProcessResumen()
      .then(
        // Conteo final en r.progreso: el avance solo se publica cada 10 órdenes y el efecto no alcanza el último.
        r => {
          panelProgreso.actualizar('resumen', { estado: r.estado, detalle: r.mensaje, ...(r.progreso ? { progreso: r.progreso } : {}) });
          // Fase 2 del panel: con necesidades generadas se guarda el reporte (efecto reportePorGuardar).
          if (r.estado === 'error') { panelProgreso.actualizar('rep', { estado: 'omitido' }); panelProgreso.concluir(); }
          else setReportePorGuardar(true);
        },
        e => {
          panelProgreso.actualizar('resumen', { estado: 'error', detalle: (e as Error).message });
          panelProgreso.actualizar('rep', { estado: 'omitido' });
          panelProgreso.concluir();
        }
      )
      .finally(() => setSyncStep('idle'));
  }, [autoGenerarPendiente, handleProcessResumen, panelProgreso]);

  // Avance de la explosión BOM (órdenes procesadas / total) reflejado en el panel mientras corre.
  useEffect(() => {
    if (syncStep !== 'generando' || resumenProgress.total === 0) return;
    panelProgreso.actualizar('resumen', { progreso: { actual: resumenProgress.current, total: resumenProgress.total } });
  }, [syncStep, resumenProgress, panelProgreso.actualizar]); // eslint-disable-line react-hooks/exhaustive-deps

  // Resumen dividido en dos secciones según el tipo de Bloque Formulado, derivado directamente
  // de la apertura ya extraída del material (no depende de que exista match en Control Curado,
  // por eso ya no queda un grupo "Sin Clasificar"):
  // a) Apertura: bloques con apertura técnica (194.5/206/219/228...) — línea continua LEADER.
  // b) Combinación: bloques sin apertura (ej. "BLOQUE FORMULADO D48 VISCO GEL CL 3un-135X190") —
  //    línea de combinación COFAMA.
  // "Reporte de producción" (EN DESARROLLO) — este módulo no tenía correo: el reporte se arma acá
  // con el mismo esquema HTML de los correos de los otros módulos. SOLO CENTRO 1000 (13-11, usuario):
  // la espuma se fabrica únicamente en Quito; lo que consume GYE ya va dentro del plan de reposición
  // Leader/Cofama del Centro 1000, así que el reporte del Centro 2000 se quitó. Mismo flujo de 3
  // pasos que Laminado/Corte Espuma/Venta Externa (Guardar -> Recuperar/vista previa -> Enviar, ver
  // ReportePlanTxtFlujo.tsx). Fecha objetivo = inicio del rango seleccionado (por defecto hoy), o hoy
  // en Plan Maestro.
  const [destinatariosReporte, setDestinatariosReporte] = useState('');

  // Precarga desde la restricción Grupo_Correos_Formulacion si existe (mismo patrón que
  // Grupo_Correos_Laminado / Grupo_Correos_Corte_Espuma); si no está configurada queda vacío y se
  // escribe a mano en la vista previa. Solo autocompleta si el usuario no escribió nada.
  useEffect(() => {
    const correos = Array.from(new Set(restricciones
      .filter(r => String(r.nombre_restriccion || '').trim().toUpperCase() === 'GRUPO_CORREOS_FORMULACION')
      .flatMap(r => String(r.valor_restriccion || '').split(/[,;&]/).map(v => v.trim()))
      .filter(Boolean)));
    if (correos.length > 0) setDestinatariosReporte(prev => prev.trim() ? prev : correos.join(', '));
  }, [restricciones]);

  const construirReporteHtmlFormulacion = (fechaObjetivo: string) => {
    const esc = (v: unknown) => String(v ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
    const th = (t: string, right = false) => `<td${right ? ' align="right"' : ''} style="padding:6px 8px;font-size:9px;font-weight:700;text-transform:uppercase;color:#6b7280;background:#f9fafb;border-bottom:1px solid #e5e7eb;">${t}</td>`;
    const td = (t: string, right = false) => `<td${right ? ' align="right"' : ''} style="padding:5px 8px;font-size:11px;color:#374151;border-bottom:1px solid #f3f4f6;">${t}</td>`;
    const seccionLeader = () => {
      const titulo = `<p style="margin:18px 0 6px;font-size:10px;font-weight:700;text-transform:uppercase;color:#6b7280;">Bloque Formulado Leader — Plan de Reposición</p>`;
      if (!reposicion) return `${titulo}<p style="font-size:11px;color:#9ca3af;">Sin plan de reposición.</p>`;
      const filas = reposicion.filas.map(b => calcularFilaReposicion(b, reposicion.metaOverride[b.blockCode], reposicion.planOverride[b.blockCode]));
      const capacidad = reposicion.nichosMax + (reposicion.autodescarga ? reposicion.autodescargaUN : 0);
      const totalPlan = filas.reduce((s, f) => s + f.planUN, 0);
      const totalKg = filas.reduce((s, f) => s + f.planKg, 0);
      const d1 = (v: number | null) => (v === null ? '—' : v.toFixed(1));
      return `${titulo}
<table role="presentation" cellpadding="0" cellspacing="0" style="width:100%;border:1px solid #e5e7eb;border-collapse:collapse;">
  <tr>${th('Bloque')}${th('Descripción')}${th('Stock (UN)', true)}${th('Meta (UN/día)', true)}${th('VE (UN)', true)}${th('Plan ant. (UN)', true)}${th('Cobertura (días)', true)}${th('Horizonte (días)', true)}${th('Sugerido (UN)', true)}${th('PLAN (UN)', true)}${th('PLAN (Kg)', true)}</tr>
  ${filas.map(f => `<tr${f.planUN > 0 ? ' style="background:#fefce8;"' : ''}>${td(esc(f.blockCode))}${td(esc(f.blockDesc))}${td(f.stockUN.toFixed(1), true)}${td(f.metaUNDia.toFixed(2), true)}${td(f.veUN > 0 ? f.veUN.toFixed(1) : '—', true)}${td(f.planAnteriorUN > 0 ? String(f.planAnteriorUN) : '—', true)}${td(d1(f.coberturaActual), true)}${td(f.horizonteDias.toFixed(1), true)}${td(f.sugeridoUN ? String(f.sugeridoUN) : '—', true)}${td(f.planUN ? `<b>${f.planUN}</b>` : '—', true)}${td(f.planKg ? formatNum(f.planKg, 0) : '—', true)}</tr>`).join('')}
</table>
<p style="margin:6px 0 0;font-size:11px;font-weight:700;color:${totalPlan > capacidad ? '#dc2626' : '#b45309'};">PLAN: ${totalPlan} bloques / capacidad ${capacidad} (nichos ${reposicion.nichosMax}${reposicion.autodescarga ? ` + autodescarga ${reposicion.autodescargaUN}` : ''}) · ${formatNum(totalKg, 0)} Kg</p>`;
    };
    const seccionCofama = () => {
      const titulo = `<p style="margin:18px 0 6px;font-size:10px;font-weight:700;text-transform:uppercase;color:#6b7280;">Bloque Formulado Cofama — Plan de Reposición</p>`;
      const rc = reposicionCofama;
      if (!rc) return `${titulo}<p style="font-size:11px;color:#9ca3af;">Sin plan de reposición.</p>`;
      const plan = planCofamaPorCortado(rc);
      const filas = rc.filas.map(b => calcularFilaCofama(b, rc.metaOverride[b.cortadoCode], plan.get(b.cortadoCode) || 0))
        .filter(f => esCortadoCofama(f.cortadoDesc, f.formuladoCode, f.formuladoDesc, new Set(rc.formulados.filter(x => x.combinaciones.length > 0).map(x => x.code))))
        .filter(f => f.planUN > 0 || f.sugeridoUN > 0 || f.reponer);
      const lineas = rc.lineas.filter(l => l.cantidad > 0);
      const d1 = (v: number | null) => (v === null ? '—' : v.toFixed(1));
      const totalBloques = lineas.reduce((s, l) => s + l.cantidad, 0);
      const totalKg = lineas.reduce((s, l) => s + l.cantidad * (rc.formulados.find(f => f.code === l.formuladoCode)?.pesoKg || 0), 0);
      return `${titulo}
<table role="presentation" cellpadding="0" cellspacing="0" style="width:100%;border:1px solid #e5e7eb;border-collapse:collapse;">
  <tr>${th('Bloque formulado')}${th('Combinación')}${th('Bloques', true)}${th('Kg', true)}</tr>
  ${lineas.length === 0 ? `<tr>${td('Sin plan')}${td('')}${td('', true)}${td('', true)}</tr>` : lineas.map(l => {
    const fm = rc.formulados.find(f => f.code === l.formuladoCode);
    return `<tr>${td(`${esc(l.formuladoCode)} · ${esc(fm?.desc ?? '')}`)}${td(esc(l.combinacion))}${td(`<b>${l.cantidad}</b>`, true)}${td(fm?.pesoKg ? formatNum(l.cantidad * fm.pesoKg, 0) : '—', true)}</tr>`;
  }).join('')}
</table>
<p style="margin:6px 0 10px;font-size:11px;font-weight:700;color:#b45309;">PLAN: ${totalBloques} bloques formulados · ${formatNum(totalKg, 0)} Kg</p>
<table role="presentation" cellpadding="0" cellspacing="0" style="width:100%;border:1px solid #e5e7eb;border-collapse:collapse;">
  <tr>${th('Bloque cortado')}${th('Descripción')}${th('Stock (UN)', true)}${th('Meta (UN/día)', true)}${th('Interno (UN)', true)}${th('Plan ant. (UN)', true)}${th('Cobertura (días)', true)}${th('Horizonte (días)', true)}${th('Sugerido (UN)', true)}${th('PLAN (UN)', true)}${th('Cob. plan (días)', true)}</tr>
  ${filas.map(f => `<tr${f.planUN > 0 ? ' style="background:#fefce8;"' : ''}>${td(esc(f.cortadoCode))}${td(esc(f.cortadoDesc))}${td(f.stockTotalUN.toFixed(1), true)}${td(f.metaUNDia.toFixed(2), true)}${td(f.internoUN > 0 ? f.internoUN.toFixed(1) : '—', true)}${td(f.planAnteriorUN > 0 ? String(f.planAnteriorUN) : '—', true)}${td(d1(f.coberturaActual), true)}${td(f.horizonteDias.toFixed(1), true)}${td(f.sugeridoUN ? String(f.sugeridoUN) : '—', true)}${td(f.planUN ? `<b>${f.planUN}</b>` : '—', true)}${td(f.planUN ? d1(f.coberturaPlan) : '', true)}</tr>`).join('')}
</table>`;
    };
    const rango = `pendiente ${pendienteDesde} → día de corte ${ventana.d}`;
    return `
<div style="max-width:960px;margin:0 auto;background:#ffffff;font-family:-apple-system,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#4f46e5;"><tr><td style="padding:18px 24px;font-size:15px;font-weight:700;color:#ffffff;">CHAIDE Y CHAIDE</td><td align="right" style="padding:18px 24px;font-size:11px;font-weight:600;text-transform:uppercase;color:#c7d2fe;">Planificación de Producción</td></tr></table>
<div style="padding:20px 24px 24px;">
<p style="margin:0;font-size:10px;font-weight:700;text-transform:uppercase;color:#6b7280;">Formulación · Centro 1000 (Quito) · Reporte diario</p>
<h1 style="margin:4px 0 0;font-size:20px;color:#111827;">Bloque Formulado — necesidad, stock y plan de reposición</h1>
<p style="margin:6px 0 0;font-size:12px;color:#6b7280;">Fecha objetivo: ${fechaObjetivo} · Ventana FERT: ${rango}</p>
${seccionLeader()}
${seccionCofama()}
<p style="margin:20px 0 0;padding-top:14px;border-top:1px solid #e5e7eb;font-size:11px;color:#9ca3af;">Generado automáticamente por el Optimizador de Producción, favor no responder. Para dudas sobre estos datos, contacta a Planificación Táctica.</p>
</div>
</div>`;
  };

  const fechaObjetivoReporte = ventana.d;
  const asuntoReporteFormulacion = 'Reporte de producción — Formulación [Bloque Formulado]-[Centro 1000]';
  // Respaldo de "Salida de Datos" que viaja junto al TXT ({fecha}.estado.json) para volver a cargar
  // lo planificado desde "Recuperar y revisar" (mismo flujo que Corte Laminado).
  const capturarEstadoPlan = (): EstadoPlanFormulacion => ({
    tipo: 'formulacion-salida',
    version: 2,
    diaCorte: ventana.d,
    unifiedSummaryData,
    consumoBloqueFormulado,
    reposicion,
    reposicionCofama,
  });
  const restaurarEstadoPlan = (crudo: unknown, origen: OrigenEstadoPlan): boolean => {
    const e = crudo as Partial<EstadoPlanFormulacion> | null;
    // version 1 (rango de fechas + provisionales) ya no se carga: hay que volver a sincronizar.
    if (!e || e.tipo !== 'formulacion-salida' || e.version !== 2 || !Array.isArray(e.unifiedSummaryData)) return false;
    setDiaCorte(e.diaCorte ?? '');
    setUnifiedSummaryData(e.unifiedSummaryData);
    setConsumoBloqueFormulado(e.consumoBloqueFormulado ?? []);
    setReposicion(e.reposicion ?? null);
    setReposicionCofama(e.reposicionCofama ?? null);
    setPlanCargadoDe(origen);
    setActiveTab('necesidad');
    return true;
  };

  const reporteFlujo = useReportePlanTxt({
    modulo: 'formulacion',
    centro: '1000',
    fechaObjetivo: fechaObjetivoReporte,
    asunto: asuntoReporteFormulacion,
    construirHtml: () => construirReporteHtmlFormulacion(fechaObjetivoReporte),
    etiqueta: 'Centro 1000',
    capturarEstado: capturarEstadoPlan,
    restaurarEstado: restaurarEstadoPlan,
  });
  useAutoCargaPlanVigente({
    modulo: 'formulacion',
    centros: ['1000'],
    listo: mounted,
    hayDatos: () => datosCargados || syncStep !== 'idle' || !!leerDeCache<SnapshotFormulacion>(CACHE_FORMULACION),
    restaurar: restaurarEstadoPlan,
  });

  // Fase 2 del panel (igual que los otros 3 módulos): tras generar necesidades, guarda el reporte del
  // Centro 1000 (reemplaza el existente) y cierra con "Ver reporte y enviar". El envío sigue manual.
  useEffect(() => {
    if (!reportePorGuardar) return;
    setReportePorGuardar(false);
    void (async () => {
      panelProgreso.actualizar('rep', { estado: 'en_curso' });
      const ok = await reporteFlujo.guardar({ sinConfirmar: true, silencioso: true });
      panelProgreso.actualizar('rep', ok
        ? { estado: 'ok', detalle: `Reporte del ${fechaObjetivoReporte} guardado en la carpeta compartida — todavía no se envió.` }
        : { estado: 'error', detalle: 'No se pudo guardar; reintenta desde "Enviar Reporte".' });
      panelProgreso.concluir(
        ok ? 'Necesidades y reporte guardados. Revisa y envía el reporte.' : undefined,
        ok ? [{ etiqueta: 'Ver reporte y enviar', onClick: () => { void reporteFlujo.recuperar(); } }] : [],
      );
    })();
  }, [reportePorGuardar]); // eslint-disable-line react-hooks/exhaustive-deps

  // Consumo trazado (COD_FORMULADO -> bloque cortado -> componente final) de la ventana: contenido del
  // tab "1 · Necesidad". Una sola lista con los tres destinos (UIO / GYE / VE): Formulación produce
  // solo en UIO.
  const fertConsumoResponsable = useMemo(
    () => consumoBloqueFormulado.filter(r => r.origin === 'fert' && entraEnFormulacion(r.centro, r.respCtrlProd, respPorCentroDinamico)),
    [consumoBloqueFormulado, respPorCentroDinamico]
  );
  // Kg por destino y tramo (solo filas en KG: las que no trazan a un Bloque Formulado van en UN).
  const necesidadKg = useMemo(() => {
    const m = { '1000': { pendiente: 0, planificado: 0 }, '2000': { pendiente: 0, planificado: 0 }, VE: { pendiente: 0, planificado: 0 } } as Record<DestinoConsumo, Record<TramoNecesidad, number>>;
    fertConsumoResponsable.forEach(r => { if (r.un === 'KG' && r.destino && r.tramo) m[r.destino][r.tramo] += r.total; });
    return m;
  }, [fertConsumoResponsable]);
  // Sub-bloques con medida que se envían a GYE (UN de las FERT 041, una vez por orden).
  const subBloquesGye = useMemo(() => {
    const porOrden = new Map<string, { tramo: TramoNecesidad; un: number }>();
    fertConsumoResponsable.forEach(r => { if (r.destino === '2000' && r.tramo) porOrden.set(r.orden, { tramo: r.tramo, un: r.cantidad ?? 0 }); });
    const t = { pendiente: 0, planificado: 0 } as Record<TramoNecesidad, number>;
    porOrden.forEach(o => { t[o.tramo] += o.un; });
    return t;
  }, [fertConsumoResponsable]);

  // Panel: Rango evaluado → Datos SAP (x/5) → Generando necesidades (fase en el efecto
  // autoGenerarPendiente, que cierra el panel). El rango se elige antes, en handleSincronizarYGenerar.
  const ejecutarSincronizacion = useCallback(async (d: string) => {
    refrescarAlSincronizar(); // FERT siempre frescas; cubo (día) y MTTO (semana) se reusan
    setIsLoading(true);
    setSyncStep('sincronizando');
    setDiaCorte(d);
    setPlanCargadoDe(null);
    const corta = (f: string) => format(new Date(f + 'T00:00:00'), 'EEE dd/MM', { locale: es });
    panelProgreso.iniciar('Formulación — Sincronizar y generar', [
      { id: 'fecha', etiqueta: `Día de corte: ${corta(d)}` },
      { id: 'sap', etiqueta: 'Sincronizando datos SAP' },
      { id: 'resumen', etiqueta: 'Generando necesidades' },
      { id: 'rep', etiqueta: 'Guardando reporte (1000 y 2000)' },
    ]);
    panelProgreso.actualizar('fecha', { estado: 'ok' });
    const TOTAL_CONSULTAS_SAP = 4;
    let hechas = 0;
    const fallidas: string[] = [];
    const seguir = <T,>(nombre: string, promesa: Promise<T>): Promise<T> => promesa.then(
      r => { hechas += 1; panelProgreso.actualizar('sap', { progreso: { actual: hechas, total: TOTAL_CONSULTAS_SAP } }); return r; },
      e => { hechas += 1; fallidas.push(nombre); panelProgreso.actualizar('sap', { progreso: { actual: hechas, total: TOTAL_CONSULTAS_SAP } }); throw e; }
    );
    panelProgreso.actualizar('sap', { estado: 'en_curso', progreso: { actual: 0, total: TOTAL_CONSULTAS_SAP } });
    try {
      const groupsRes = await grupoService.getAll();
      const filteredGroups = (groupsRes.data || []).filter(g => {
        const name = (g.nombre_grupo || '').toLowerCase();
        return name.includes('formulación') || name.includes('espuma');
      });
      const groupsIds = filteredGroups.map(g => g.codigo_grupo);
      const [restrsRes, curadoRes, fertsRes, cuboRes] = await Promise.all([
        seguir('Restricciones', restriccionService.getAll()),
        seguir('Tiempos de curado', fetchCuradoCompleto()).catch(() => ({ data: [] as RawApiRow[], total: 0 })),
        seguir('Órdenes FERT', sapCompartido.ordenesFert()).catch(() => ({ data: [] })),
        seguir('Cubo de inventarios', sapCompartido.cuboInventarios()).catch(() => ({ data: [] }))
      ]);
      panelProgreso.actualizar('sap', {
        estado: fallidas.length > 0 ? 'aviso' : 'ok',
        detalle: fallidas.length > 0 ? `Sin respuesta: ${fallidas.join(', ')} — se siguió con datos vacíos.` : undefined,
      });
      setRestricciones((restrsRes.data || []).filter((r) => groupsIds.includes(r.codigo_grupo)));
      setOrdersFert(fertsRes.data?.data || fertsRes.data || []);
      setCuboInventarios(Array.isArray(cuboRes.data) ? cuboRes.data : []);

      const rawCurado: RawApiRow[] = curadoRes.data || [];
      setCuradoData(rawCurado);
      setCuradoTotalServicio(curadoRes.total);

      const uniqueStatuses = [...new Set(rawCurado.map((r) => String(getProp(r, ['estadoTras', 'ESTADOTRAS']) || 'EMPTY').trim()))];
      inspector.captureVariable('unique_estadoTras_statuses', uniqueStatuses, { description: 'Lista global de estatus detectados en columna estadoTras' });

      // Diagnóstico: combinaciones reales de Maquina/estadoTras/estado/corridaproceso en
      // getTiemposCuradoBloqueFormulado, con conteo de filas — usado para confirmar CURADO_SPACES
      // (LEADER/COFAMA/T8/Looper, ver ahí) contra capturas reales etiquetadas por el usuario.
      const comboCounts = new Map<string, number>();
      rawCurado.forEach((r) => {
        const m = getProp(r, ['Maquina', 'MAQUINA']) || '—';
        const et = getProp(r, ['estadoTras', 'ESTADOTRAS']) || '—';
        const e2 = getProp(r, ['estado2']) || '—';
        const cp = getProp(r, ['corridaproceso', 'CORRIDAPROCESO']) || '—';
        const key = `Maquina=${m} | estadoTras=${et} | estado=${e2} | corridaproceso=${cp}`;
        comboCounts.set(key, (comboCounts.get(key) || 0) + 1);
      });
      const comboSummary = Array.from(comboCounts.entries())
        .sort((a, b) => b[1] - a[1])
        .map(([combo, count]) => `${count}x ${combo}`);
      inspector.captureVariable('curado_maquina_estado_combos', comboSummary, { description: 'Combinaciones únicas de Maquina/estadoTras/estado/corridaproceso en curadoData, ordenadas por frecuencia — usar para fijar los filtros LEADER/COFAMA' });

      // Diagnóstico por fecha: cuántas filas trae cada día en curadoData vs cuántas matchean
      // alguno de los dos espacios de Control Curado (CURADO_SPACES). Las columnas "Fecha
      // Disponible (+2d)" y "Estado" del tab son solo cálculo/badge sobre las filas ya filtradas
      // — no excluyen ninguna fila; el único filtro real es ESTADO/MAQUINA/CORRIDAPROCESO. Esto
      // sirve para confirmar si un día concreto (ej. el 06) está quedando fuera por ese filtro.
      const porFecha = new Map<string, { total: number; matched: number }>();
      rawCurado.forEach((r) => {
        const fecha = getProp(r, ['fecha', 'FECHA', 'FECHA_INICIO', 'FECHA_FABRICACION', 'FECHA_OT_PRG_INI']) || '—';
        const entry = porFecha.get(fecha) || { total: 0, matched: 0 };
        entry.total += 1;
        if (CURADO_SPACES.some(space => matchesCuradoSpace(r, space))) entry.matched += 1;
        porFecha.set(fecha, entry);
      });
      const fechaSummary = Array.from(porFecha.entries())
        .sort((a, b) => a[0].localeCompare(b[0]))
        .map(([fecha, { total, matched }]) => `${fecha}: ${matched}/${total} filas matchean CURADO_SPACES`);
      inspector.captureVariable('curado_matches_por_fecha', fechaSummary, { description: 'Por cada fecha de curadoData, filas que matchean alguno de los dos espacios (LEADER/COFAMA) vs el total de ese día — usar para verificar si falta un día específico por el filtro ESTADO/MAQUINA/CORRIDAPROCESO' });

      setDatosCargados(true);

      // El resumen ya procesado se sincroniza aparte (ver handleProcessResumen) — acá se preserva lo
      // que ya hubiera en caché (previo), en vez de resetearlo, para no perder trabajo si el usuario
      // vuelve a pulsar "Sincronizar" sin haber navegado fuera del módulo.
      const previo = leerDeCache<SnapshotFormulacion>(CACHE_FORMULACION);
      guardarEnCache<SnapshotFormulacion>(CACHE_FORMULACION, {
        diaCorte: d,
        ordenesFert: fertsRes.data?.data || fertsRes.data || [],
        cuboInventarios: Array.isArray(cuboRes.data) ? cuboRes.data : [],
        curadoData: rawCurado,
        unifiedSummaryData: previo?.unifiedSummaryData || [],
        consumoBloqueFormulado: previo?.consumoBloqueFormulado || [],
      });
      // No se llama handleProcessResumen() directo acá: leería prodFiltradas (useMemo
      // derivados del estado que se acaba de actualizar arriba) por closure vieja. Se dispara desde
      // el efecto de más abajo, que ve la versión fresca una vez que el siguiente render ya ocurrió
      // (mismo criterio que Corte Espuma/Venta Externa/Laminado).
      setAutoGenerarPendiente(true);
    } catch (e) {
      console.error('Error sincronizando datos formulacion');
      panelProgreso.actualizar('sap', { estado: 'error', detalle: (e as Error).message });
      panelProgreso.actualizar('resumen', { estado: 'omitido' });
      panelProgreso.actualizar('rep', { estado: 'omitido' });
      panelProgreso.concluir(`Error al sincronizar: ${(e as Error).message}`);
      setSyncStep('idle');
    } finally {
      setIsLoading(false);
    }
  }, [panelProgreso]); // eslint-disable-line react-hooks/exhaustive-deps

  // Botón "Sincronizar y Generar Necesidades": antes de tocar SAP, el panel pide el día de corte D y
  // muestra la ventana de FERT que se evaluará (pendiente + planificado) y la fecha del reporte.
  const handleSincronizarYGenerar = useCallback(() => {
    const larga = (f: string) => format(new Date(f + 'T00:00:00'), 'EEE dd/MM/yyyy', { locale: es });
    const mediodia = (f: string) => new Date(`${f}T12:00:00`);
    panelProgreso.pedirFecha({
      titulo: 'Formulación — Sincronizar y generar',
      fechaInicial: ventana.d,
      detalle: (d) => d ? [
        { etiqueta: 'Planificado (FECHAFIN)', valor: larga(d) },
        { etiqueta: `Pendiente (${DIAS_PENDIENTE_FERT} días hábiles)`, valor: `desde ${larga(format(addBusinessDays(mediodia(d), -DIAS_PENDIENTE_FERT, calendario.noLaborables, laborablesHorizonte(calendario.laborablesExtra)), 'yyyy-MM-dd'))}` },
        { etiqueta: 'Reporte (TXT) con fecha', valor: larga(d) },
      ] : [],
      onConfirmar: (d) => { if (d) void ejecutarSincronizacion(d); },
    });
  }, [ventana.d, calendario, panelProgreso, ejecutarSincronizacion]);

  // Rehidratación: si ya se había sincronizado en esta sesión, se recupera lo trabajado (datos crudos
  // Y el resumen ya procesado) en vez de dejar el módulo vacío al volver de otro módulo — mismo
  // criterio que Corte Espuma/Venta Externa/Laminado (ver [[persistencia_resumen_procesado_gap]]).
  useEffect(() => {
    if (!mounted) return;
    const snap = leerDeCache<SnapshotFormulacion>(CACHE_FORMULACION);
    if (snap) {
      if (snap.diaCorte) setDiaCorte(snap.diaCorte);
      setOrdersFert(snap.ordenesFert);
      setCuboInventarios(snap.cuboInventarios);
      setCuradoData(snap.curadoData);
      setUnifiedSummaryData(snap.unifiedSummaryData || []);
      setConsumoBloqueFormulado(snap.consumoBloqueFormulado || []);
      setReposicion(snap.reposicion ?? null);
      setReposicionCofama(snap.reposicionCofama ?? null);
      setDatosCargados(true);
    }
  }, [mounted]);

  // Ajustes manuales del Plan de Reposición (meta, PLAN, autodescarga): se guardan en caché al momento
  // y viajan en el respaldo la próxima vez que se guarda el reporte.
  const ajustarReposicion = (cambio: (r: ReposicionLeader) => ReposicionLeader) => {
    setReposicion(prev => {
      if (!prev) return prev;
      const nuevo = cambio(prev);
      actualizarEnCache<SnapshotFormulacion>(CACHE_FORMULACION, { reposicion: nuevo });
      return nuevo;
    });
  };
  const ajustarValor = (campo: 'metaOverride' | 'planOverride', code: string, texto: string) => ajustarReposicion(r => {
    const mapa = { ...r[campo] };
    const n = numeroRestriccion(texto);
    if (n === null || n < 0) delete mapa[code]; else mapa[code] = n;
    return { ...r, [campo]: mapa };
  });
  const filasReposicion = useMemo(
    () => (reposicion ? reposicion.filas.map(b => calcularFilaReposicion(b, reposicion.metaOverride[b.blockCode], reposicion.planOverride[b.blockCode])) : []),
    [reposicion]
  );
  const capacidadReposicion = reposicion ? reposicion.nichosMax + (reposicion.autodescarga ? reposicion.autodescargaUN : 0) : 0;
  const totalPlanReposicion = filasReposicion.reduce((s, f) => s + f.planUN, 0);

  const ajustarCofama = (cambio: (r: ReposicionCofama) => ReposicionCofama) => {
    setReposicionCofama(prev => {
      if (!prev) return prev;
      const nuevo = cambio(prev);
      actualizarEnCache<SnapshotFormulacion>(CACHE_FORMULACION, { reposicionCofama: nuevo });
      return nuevo;
    });
  };
  const ajustarLineaCofama = (id: string, cambio: Partial<LineaPlanCofama>) =>
    ajustarCofama(r => ({ ...r, lineas: r.lineas.map(l => (l.id === id ? { ...l, ...cambio } : l)) }));
  const planCofama = useMemo(() => planCofamaPorCortado(reposicionCofama), [reposicionCofama]);
  const filasCofama = useMemo(
    () => (reposicionCofama ? reposicionCofama.filas.map(b => calcularFilaCofama(b, reposicionCofama.metaOverride[b.cortadoCode], planCofama.get(b.cortadoCode) || 0)) : []),
    [reposicionCofama, planCofama]
  );
  // Solo los cortados con algo que mostrar: stock, consumo, necesidad, plan anterior o PLAN de hoy.
  // esCortadoCofama también al mostrar: un reporte guardado antes del filtro (12/11) traía cortados de Leader.
  const formuladosConCombinacion = new Set((reposicionCofama?.formulados ?? []).filter(f => f.combinaciones.length > 0).map(f => f.code));
  const filasCofamaVisibles = filasCofama.filter(f => esCortadoCofama(f.cortadoDesc, f.formuladoCode, f.formuladoDesc, formuladosConCombinacion)).filter(f => f.stockTotalUN > 0 || f.metaKgDia > 0 || f.internoKg > 0 || f.planAnteriorUN > 0 || f.planUN > 0 || f.horizonteRestriccion);


  // Paso 1 · Necesidad: misma estructura que el Excel "CONSUMOS UIO" — Formulado → Bloque cortado →
  // componente / material / orden, Kg de consumo pendiente por orden, con total por bloque cortado y
  // subtotal por Formulado (pendiente / planificado). Las filas que no trazan a un Bloque Formulado van
  // en UN y no suman a los Kg.
  const renderNecesidadTable = (data: ConsumoBloqueRow[]) => {
    const kg = (rows: ConsumoBloqueRow[], tramo?: TramoNecesidad) => rows.reduce((s, r) => (r.un === 'KG' && (!tramo || r.tramo === tramo) ? s + r.total : s), 0);
    const grouped = new Map<string, { nombreFormulado: string; cortados: Map<string, ConsumoBloqueRow[]> }>();
    data.forEach(row => {
      if (!grouped.has(row.codFormulado)) grouped.set(row.codFormulado, { nombreFormulado: row.nombreFormulado, cortados: new Map() });
      const cortados = grouped.get(row.codFormulado)!.cortados;
      if (!cortados.has(row.componente)) cortados.set(row.componente, []);
      cortados.get(row.componente)!.push(row);
    });
    const codes = Array.from(grouped.keys()).sort();
    const columnas = 12;
    const fecha = (f?: string) => f ? f.split('-').reverse().slice(0, 2).join('/') : '—';
    // Plegable en 3 niveles (usuario 2026-11-12): Formulado → Bloque cortado → órdenes. Claves "F|cod" y "C|cod|cortado".
    const claveF = (code: string) => `F|${code}`;
    const claveC = (code: string, componente: string) => `C|${code}|${componente}`;
    const alternar = (k: string) => setExpandidoNecesidad(prev => { const n = new Set(prev); if (n.has(k)) n.delete(k); else n.add(k); return n; });
    const todasF = codes.map(claveF);
    const todasC = codes.flatMap(code => Array.from(grouped.get(code)!.cortados.keys()).map(c => claveC(code, c)));
    const boton = 'h-7 px-3 text-[10px] font-black uppercase';
    const Chevron = ({ abierto }: { abierto: boolean }) => (abierto ? <Minus className="w-3 h-3 inline mr-1.5" /> : <Plus className="w-3 h-3 inline mr-1.5" />);
    return (
      <div className="rounded-2xl border border-gray-100 shadow-sm overflow-hidden bg-white text-left">
        <div className="flex flex-wrap items-center gap-2 px-4 py-2 border-b border-gray-100">
          <Button size="sm" variant="outline" className={boton} onClick={() => setExpandidoNecesidad(new Set([...todasF, ...todasC]))}>Expandir todo</Button>
          <Button size="sm" variant="outline" className={boton} onClick={() => setExpandidoNecesidad(new Set(todasF))}>Ver bloques cortados</Button>
          <Button size="sm" variant="outline" className={boton} onClick={() => setExpandidoNecesidad(new Set())}>Contraer todo</Button>
          <span className="ml-auto text-[10px] font-bold text-slate-500">{codes.length} formulado(s) · {todasC.length} bloque(s) cortado(s)</span>
        </div>
        <div className="overflow-x-auto max-h-[600px]">
          <table className="w-full border-collapse text-center font-sans text-[10px] text-gray-700">
            <thead className="bg-gray-50 sticky top-0 text-[10px] font-bold uppercase text-gray-500 tracking-widest z-20">
              <tr>
                <th className="px-4 py-3 text-left border-r border-gray-100">Formulado</th>
                <th className="px-4 py-3 text-left border-r border-gray-100">Bloque cortado</th>
                <th className="px-3 py-3 border-r border-gray-100">Componente</th>
                <th className="px-4 py-3 text-left border-r border-gray-100">Nombre</th>
                <th className="px-3 py-3 border-r border-gray-100">Material</th>
                <th className="px-3 py-3 border-r border-gray-100">Orden</th>
                <th className="px-3 py-3 border-r border-gray-100">Fecha fin</th>
                <th className="px-3 py-3 border-r border-gray-100">Tramo</th>
                <th className="px-3 py-3 border-r border-gray-100">Destino</th>
                <th className="px-3 py-3 border-r border-gray-100" title="Cantidad pendiente de la orden FERT">Cant. (UN)</th>
                <th className="px-3 py-3 border-r border-gray-100">UN</th>
                <th className="px-4 py-3 bg-indigo-50 text-indigo-700 font-black">Total</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50 font-bold">
              {codes.length === 0 ? (
                <tr><td colSpan={columnas} className="py-20 text-center text-slate-300 uppercase font-black">Sin FERT en la ventana</td></tr>
              ) : codes.map(code => {
                const group = grouped.get(code)!;
                const items = Array.from(group.cortados.values()).flat();
                const abiertoF = expandidoNecesidad.has(claveF(code));
                return (
                  <React.Fragment key={code}>
                    <tr className="bg-slate-100 cursor-pointer hover:bg-slate-200/70" onClick={() => alternar(claveF(code))}>
                      <td className="px-4 py-2 text-left font-mono font-black text-indigo-600 border-r border-gray-100 whitespace-nowrap"><Chevron abierto={abiertoF} />{code}</td>
                      <td colSpan={7} className="px-4 py-2 text-left uppercase font-black text-slate-700 border-r border-gray-100">{group.nombreFormulado} <span className="ml-2 font-bold normal-case text-slate-400">{group.cortados.size} bloque(s) cortado(s)</span></td>
                      <td colSpan={3} className="px-3 py-2 border-r border-gray-100 text-[10px] whitespace-nowrap"><span className="text-amber-700">Pend. {formatNum(kg(items, 'pendiente'), 1)}</span> · <span className="text-emerald-700">Plan. {formatNum(kg(items, 'planificado'), 1)}</span></td>
                      <td className="px-4 py-2 bg-indigo-50 text-indigo-800 font-black">{formatNum(kg(items), 3)}</td>
                    </tr>
                    {abiertoF && Array.from(group.cortados.entries()).map(([componente, rows]) => {
                      const abiertoC = expandidoNecesidad.has(claveC(code, componente));
                      return (
                      <React.Fragment key={componente}>
                        <tr className="bg-emerald-50/60 cursor-pointer hover:bg-emerald-100/60" onClick={() => alternar(claveC(code, componente))}>
                          <td />
                          <td colSpan={2} className="px-4 py-1.5 text-left uppercase font-black text-emerald-800 whitespace-nowrap"><Chevron abierto={abiertoC} />{rows[0].nombreComponente}</td>
                          <td className="px-4 py-1.5 text-left font-mono text-indigo-600">{componente}</td>
                          <td colSpan={4} className="px-3 py-1.5 text-left text-[10px] text-slate-500">{rows.length} orden(es)</td>
                          <td colSpan={3} className="px-3 py-1.5 text-[10px] whitespace-nowrap"><span className="text-amber-700">Pend. {formatNum(kg(rows, 'pendiente'), 1)}</span> · <span className="text-emerald-700">Plan. {formatNum(kg(rows, 'planificado'), 1)}</span></td>
                          <td className="px-4 py-1.5 font-black text-emerald-900">{formatNum(kg(rows), 3)}</td>
                        </tr>
                        {abiertoC && rows.map((row, idx) => (
                          <tr key={idx} className="hover:bg-slate-50 transition-colors font-mono text-[10px]">
                            <td className="px-4 py-1.5 border-r border-gray-100 text-slate-400 text-left">{row.codFormulado}</td>
                            <td className="px-4 py-1.5 border-r border-gray-100 text-left uppercase truncate max-w-[220px] text-slate-400">{idx === 0 ? row.nombreComponente : ''}</td>
                            <td className="px-3 py-1.5 border-r border-gray-100 text-indigo-600 font-black">{row.componente}</td>
                            <td className="px-4 py-1.5 border-r border-gray-100 text-left uppercase truncate max-w-[240px]">{row.nombre}</td>
                            <td className="px-3 py-1.5 border-r border-gray-100 text-slate-500">{row.material}</td>
                            <td className="px-3 py-1.5 border-r border-gray-100 text-slate-500">{row.orden}</td>
                            <td className="px-3 py-1.5 border-r border-gray-100 text-slate-500">{fecha(row.fechaFin)}</td>
                            <td className={cn("px-3 py-1.5 border-r border-gray-100 font-sans font-black uppercase", row.tramo === 'pendiente' ? 'text-amber-700' : 'text-emerald-700')}>{row.tramo === 'pendiente' ? 'Pend.' : 'Plan.'}</td>
                            <td className={cn("px-3 py-1.5 border-r border-gray-100 font-sans font-black", row.destino === 'VE' ? 'text-purple-700' : row.destino === '2000' ? 'text-amber-700' : 'text-slate-500')}>{row.destino ? ETIQUETA_DESTINO[row.destino] : '—'}</td>
                            <td className="px-3 py-1.5 border-r border-gray-100 text-slate-600">{row.cantidad !== undefined ? formatNum(row.cantidad, 0) : '—'}</td>
                            <td className="px-3 py-1.5 border-r border-gray-100 uppercase">{row.un}</td>
                            <td className="px-4 py-1.5 font-black text-slate-900">{formatNum(row.total, 3)}</td>
                          </tr>
                        ))}
                      </React.Fragment>
                      );
                    })}
                  </React.Fragment>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    );
  };

  // Qué trae el servicio de curado cuando un espacio queda vacío: combinaciones más frecuentes de
  // máquina / estados / corrida y rango de fechas, para ajustar CURADO_SPACES con datos reales.
  const diagnosticoCurado = useMemo(() => {
    const combos = new Map<string, number>();
    const fechas: string[] = [];
    curadoData.forEach(r => {
      const k = Object.entries(r).filter(([c]) => /maquina|estado|corrida/i.test(c)).map(([c, v]) => `${c}=${String(v ?? '').trim()}`).join(' · ');
      combos.set(k, (combos.get(k) || 0) + 1);
      const fab = parseFechaSAP(getProp(r, ['fecha', 'FECHA']));
      if (fab) fechas.push(format(fab, 'yyyy-MM-dd'));
    });
    fechas.sort();
    return {
      combos: Array.from(combos.entries()).sort((a, b) => b[1] - a[1]).slice(0, 8),
      fechas: fechas.length ? `${fechas[0]} → ${fechas[fechas.length - 1]}` : '—',
      // Registros por fecha de fabricación (últimas 15), para ver qué días trae el servicio.
      porDia: Object.entries(fechas.reduce<Record<string, number>>((m, f) => { m[f] = (m[f] || 0) + 1; return m; }, {})).slice(-15),
    };
  }, [curadoData]);

  const renderStockCurado = (titulo: string, data: StockCuradoRow[]) => {
    const t = data.reduce((s, r) => ({
      curadosUN: s.curadosUN + r.curadosUN, curadosKg: s.curadosKg + r.curadosKg,
      enCuradoUN: s.enCuradoUN + r.enCuradoUN, enCuradoKg: s.enCuradoKg + r.enCuradoKg, stockSapKg: s.stockSapKg + r.stockSapKg,
    }), { curadosUN: 0, curadosKg: 0, enCuradoUN: 0, enCuradoKg: 0, stockSapKg: 0 });
    const th = "px-4 py-3 border-r border-gray-100";
    const td = "px-4 py-2 border-r border-gray-100 font-mono";
    return (
      <div className="space-y-2">
        <h4 className="px-2 text-[11px] font-black uppercase tracking-widest text-slate-700">{titulo}</h4>
        <div className="rounded-2xl border border-gray-100 shadow-sm overflow-hidden bg-white text-left">
          <div className="overflow-x-auto max-h-[500px]">
            <table className="w-full border-collapse text-center font-sans text-[10px] text-gray-700">
              <thead className="bg-gray-50 sticky top-0 text-[10px] font-bold uppercase text-gray-500 tracking-widest z-10">
                <tr>
                  <th className={cn(th, "text-left")}>Material</th>
                  <th className={cn(th, "text-left")}>Descripción</th>
                  <th className={cn(th, "text-emerald-700 bg-emerald-50/50")} title={`Fabricación + ${CURADO_DIAS_ESPERA} días`}>Curados (bloq.)</th>
                  <th className={cn(th, "text-emerald-700 bg-emerald-50/50")} title="Σ CantidadStock">Curados (Kg)</th>
                  <th className={cn(th, "text-amber-700 bg-amber-50/50")}>En curado (bloq.)</th>
                  <th className={cn(th, "text-amber-700 bg-amber-50/50")} title="Σ CantidadStock">En curado (Kg)</th>
                  <th className={th} title="Promedio de peso de los bloques fabricados">Peso real (Kg/bloq.)</th>
                  <th className={cn(th, "text-teal-700")} title="Promedio de CuradoAltura">Altura (cm)</th>
                  <th className="px-4 py-3 border-r border-gray-100 text-slate-500" title="StockActual del cubo de inventarios, centro 1000">Stock SAP (Kg)</th>
                  <th className="px-4 py-3 text-rose-700" title="Stock SAP − curados − en curado: Kg en SAP sin registro en el servicio de curado (negativo: el curado registra más que SAP)">Sin registro curado (Kg)</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50 font-bold">
                {data.length === 0 ? (
                  <tr><td colSpan={10} className="py-6 px-4 text-left text-[10px] text-slate-500">
                    <p className="font-black uppercase text-slate-400 mb-1">Sin bloques · {formatNum(curadoData.length, 0)} registros de curado{curadoTotalServicio > 0 ? ` (servicio informa ${formatNum(curadoTotalServicio, 0)})` : ''} · fechas {diagnosticoCurado.fechas}</p>
                    {diagnosticoCurado.combos.map(([k, n]) => <p key={k} className="font-mono">{n}× {k}</p>)}
                  </td></tr>
                ) : data.map((row, idx) => {
                  const nuevoGrupo = idx === 0 || row.apertura !== data[idx - 1].apertura;
                  const altura = alturaRealPorBloque.get(row.materialCode);
                  return (
                    <React.Fragment key={row.materialCode}>
                      {nuevoGrupo && (
                        <tr className="bg-indigo-50/60">
                          <td colSpan={10} className="px-4 py-1.5 text-left text-[10px] font-black uppercase tracking-widest text-indigo-700">{aperturaGroupLabel(row.apertura)}</td>
                        </tr>
                      )}
                      <tr className="hover:bg-slate-50 transition-colors">
                        <td className={cn(td, "text-left font-black text-indigo-600")}>{row.materialCode}</td>
                        <td className="px-4 py-2 border-r border-gray-100 text-left uppercase text-slate-700 truncate max-w-[280px]">{row.descripcion}</td>
                        <td className={cn(td, "font-black text-emerald-800 bg-emerald-50/20")}>{formatNum(row.curadosUN, 0)}</td>
                        <td className={cn(td, "text-emerald-700 bg-emerald-50/20")}>{formatNum(row.curadosKg, 1)}</td>
                        <td className={cn(td, "font-black text-amber-800 bg-amber-50/20")}>{formatNum(row.enCuradoUN, 0)}</td>
                        <td className={cn(td, "text-amber-700 bg-amber-50/20")}>{formatNum(row.enCuradoKg, 1)}</td>
                        <td
                          className={cn(td, row.pesoCV > 0.02 ? "text-orange-600" : "text-slate-700")}
                          title={row.pesoN > 0 ? `${row.pesoN} bloque(s) · ${formatNum(row.pesoMin, 0)}–${formatNum(row.pesoMax, 0)} Kg · CV ${(row.pesoCV * 100).toFixed(1)} %${row.pesoDescartados ? ` · ${row.pesoDescartados} descartado(s) por ±${TOLERANCIA_PESO_MEDIANA * 100} % de la mediana` : ''}` : undefined}
                        >{row.pesoProm > 0 ? formatNum(row.pesoProm, 1) : '—'}</td>
                        <td className={cn(td, "text-teal-800")} title={altura ? `${altura.min.toFixed(1)}–${altura.max.toFixed(1)} cm · ${altura.n} bloque(s)` : undefined}>{altura ? (altura.suma / altura.n).toFixed(1) : '—'}</td>
                        <td className="px-4 py-2 border-r border-gray-100 font-mono text-slate-500">{formatNum(row.stockSapKg, 1)}</td>
                        <td className={cn("px-4 py-2 font-mono", Math.abs(row.stockSapKg - row.curadosKg - row.enCuradoKg) > 1 ? "text-rose-700 font-black" : "text-slate-400")}>{formatNum(row.stockSapKg - row.curadosKg - row.enCuradoKg, 1)}</td>
                      </tr>
                    </React.Fragment>
                  );
                })}
              </tbody>
              {data.length > 0 && (
                <tfoot className="bg-gray-100 text-gray-800 font-black text-[10px] uppercase border-t-2 border-gray-200 sticky bottom-0 z-10">
                  <tr>
                    <td colSpan={2} className="px-4 py-3 text-right tracking-widest border-r border-gray-200">Totales</td>
                    <td className="px-4 py-3 border-r border-gray-200 font-mono text-emerald-800">{formatNum(t.curadosUN, 0)}</td>
                    <td className="px-4 py-3 border-r border-gray-200 font-mono text-emerald-700">{formatNum(t.curadosKg, 1)}</td>
                    <td className="px-4 py-3 border-r border-gray-200 font-mono text-amber-800">{formatNum(t.enCuradoUN, 0)}</td>
                    <td className="px-4 py-3 border-r border-gray-200 font-mono text-amber-700">{formatNum(t.enCuradoKg, 1)}</td>
                    <td colSpan={2} className="border-r border-gray-200" />
                    <td className="px-4 py-3 border-r border-gray-200 font-mono text-slate-600">{formatNum(t.stockSapKg, 1)}</td>
                    <td className="px-4 py-3 font-mono text-rose-700">{formatNum(t.stockSapKg - t.curadosKg - t.enCuradoKg, 1)}</td>
                  </tr>
                </tfoot>
              )}
            </table>
          </div>
        </div>
      </div>
    );
  };

  // Con un resumen restaurado (caché / plan guardado) los movimientos no vienen: se piden aquí, una vez
  // por Bloque Formulado que falte.
  const cargarHistoricoConsumo = async () => {
    const faltantes = Array.from(new Set(unifiedSummaryData.map(r => r.blockCode))).filter(c => !movimientosConsumo[c]);
    if (faltantes.length === 0) return;
    setCargandoHistorico(true);
    try {
      const pares = await Promise.all(faltantes.map(async c => [c, await fetchMovimientosConsumo(c)] as const));
      setMovimientosConsumo(prev => ({ ...prev, ...Object.fromEntries(pares) }));
    } finally {
      setCargandoHistorico(false);
    }
  };

  // Altura real promedio por Bloque Formulado (CodMaterial) de los registros de curado cargados, sin
  // materiales de prueba ni filas sin altura.
  const alturaRealPorBloque = useMemo(() => {
    const m = new Map<string, { suma: number; min: number; max: number; n: number }>();
    curadoData.forEach(row => {
      if (esMaterialPrueba(getProp(row, ['NomMaterial', 'NOMMATERIAL']))) return;
      const cm = alturaCuradoCm(row);
      const code = cleanCode(getProp(row, ['CodMaterial', 'MATERIAL', 'CODMATERIAL']));
      if (!code || cm <= 0) return;
      const a = m.get(code) ?? { suma: 0, min: Infinity, max: 0, n: 0 };
      m.set(code, { suma: a.suma + cm, min: Math.min(a.min, cm), max: Math.max(a.max, cm), n: a.n + 1 });
    });
    return m;
  }, [curadoData]);

  const renderConsumoHistorico = () => {
    if (unifiedSummaryData.length === 0) {
      return <div className="py-24 text-center text-[10px] font-bold text-gray-500 uppercase tracking-widest">Genera la Salida de Datos para ver el consumo histórico de sus bloques formulados.</div>;
    }
    const faltan = unifiedSummaryData.some(r => !movimientosConsumo[r.blockCode]);
    const th = 'px-3 py-3 border-r border-gray-100 text-[10px] font-black uppercase text-slate-600';
    const td = 'px-3 py-2 border-r border-gray-100 text-right font-mono text-slate-800';
    const bases = [['diario', 'Diario (7 días)'], ['semanal', 'Semanal (4 sem.)'], ['mensual', 'Mensual (3 meses)']] as const;
    const resaltar = (b: typeof baseConsumo) => (b === baseConsumo ? 'bg-cyan-50 font-black text-cyan-800' : '');
    return (
      <Card className="rounded-2xl border border-gray-100 shadow-sm overflow-hidden bg-white">
        <div className="px-6 py-4 flex flex-wrap items-center justify-between gap-3 border-b border-gray-100">
          <div className="inline-flex rounded-lg border border-slate-200 overflow-hidden">
            {bases.map(([v, l]) => (
              <button key={v} onClick={() => setBaseConsumo(v)} className={`px-3 py-1.5 text-[10px] font-black uppercase ${baseConsumo === v ? 'bg-cyan-600 text-white' : 'bg-white text-slate-600 hover:bg-slate-50'}`}>{l}</button>
            ))}
          </div>
          {faltan && (
            <Button size="sm" variant="outline" disabled={cargandoHistorico} onClick={() => void cargarHistoricoConsumo()} className="h-8 text-[10px] font-black uppercase">
              {cargandoHistorico ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <RefreshCw className="w-3.5 h-3.5" />} Cargar histórico
            </Button>
          )}
        </div>
        <div className="overflow-x-auto">
          <table className="w-full border-collapse text-[11px]">
            <thead className="bg-gray-50">
              <tr>
                <th rowSpan={2} className={`${th} text-left`}>Bloque Formulado</th><th rowSpan={2} className={th}>Centro</th><th rowSpan={2} className={th}>Apertura</th>
                <th rowSpan={2} className={`${th} text-emerald-700`} title="Promedio de CuradoAltura de los bloques de curado cargados (mín–máx y cantidad en el tooltip)">Altura real (cm)</th>
                <th rowSpan={2} className={`${th} text-emerald-700`} title={`Altura real − cúpula (${CUPULA_MAX_CM} cm)`}>Útil real (cm)</th>
                <th rowSpan={2} className={th}>Stock útil (kg)</th>
                <th colSpan={3} className={`${th} text-center`}>Consumo promedio (kg / día)</th>
                <th colSpan={4} className={`${th} text-center`}>Consumo por semana (kg)</th>
                <th rowSpan={2} className={th} title="Consumo diario de los últimos 7 días contra el promedio diario de 3 meses">Tendencia</th>
                <th rowSpan={2} className={`${th} bg-cyan-50`}>Cobertura (días)</th>
              </tr>
              <tr>
                {bases.map(([v, l]) => <th key={v} className={`${th} ${resaltar(v)}`}>{l.split(' ')[0]}</th>)}
                {['S-3', 'S-2', 'S-1', 'Actual'].map(s => <th key={s} className={th}>{s}</th>)}
              </tr>
            </thead>
            <tbody>
              {unifiedSummaryData.map(r => {
                const movs = movimientosConsumo[r.blockCode];
                const h = movs ? resumenConsumoHistorico(movs) : null;
                const stockUtilKg = r.stockUtilUN * r.pesoBloque;
                const porDia = h?.porDia[baseConsumo] ?? 0;
                const tendencia = h && h.porDia.mensual > 0 ? h.porDia.diario / h.porDia.mensual - 1 : null;
                const altura = alturaRealPorBloque.get(r.blockCode);
                return (
                  <tr key={`${r.blockCode}|${r.centro}|${r.apertura}|${r.dens}`} className="border-t border-gray-100 hover:bg-slate-50/60">
                    <td className="px-3 py-2 border-r border-gray-100 text-left">
                      <div className="font-mono font-black text-slate-800">{r.blockCode}</div>
                      <div className="text-[9px] text-slate-500 truncate max-w-[260px]" title={r.blockDesc}>{r.blockDesc}</div>
                    </td>
                    <td className={`${td} text-center`}>{r.centro}</td>
                    <td className={`${td} text-center`}>{r.apertura}</td>
                    <td className={`${td} text-emerald-800 font-black`} title={altura ? `${altura.min.toFixed(1)}–${altura.max.toFixed(1)} cm · ${altura.n} bloque(s)` : 'Sin registros de curado con altura'}>{altura ? (altura.suma / altura.n).toFixed(1) : '—'}</td>
                    <td className={`${td} text-emerald-800`}>{altura ? (altura.suma / altura.n - CUPULA_MAX_CM).toFixed(1) : '—'}</td>
                    <td className={td}>{formatNum(stockUtilKg, 0)}</td>
                    {h ? (
                      <>
                        <td className={`${td} ${resaltar('diario')}`}>{h.porDia.diario.toFixed(1)}</td>
                        <td className={`${td} ${resaltar('semanal')}`}>{h.porDia.semanal.toFixed(1)}</td>
                        <td className={`${td} ${resaltar('mensual')}`}>{h.porDia.mensual.toFixed(1)}</td>
                        {h.semanas.map((kg, i) => <td key={i} className={`${td} text-slate-600`}>{formatNum(kg, 0)}</td>)}
                        <td className={`${td} ${tendencia === null ? '' : tendencia > 0.15 ? 'text-orange-600 font-black' : tendencia < -0.15 ? 'text-emerald-700 font-black' : ''}`}>
                          {tendencia === null ? '—' : `${tendencia > 0 ? '+' : ''}${(tendencia * 100).toFixed(0)}%`}
                        </td>
                        <td className={`${td} bg-cyan-50/40 font-black`}>{porDia > 0 ? (stockUtilKg / porDia).toFixed(1) : '—'}</td>
                      </>
                    ) : (
                      <td colSpan={9} className="px-3 py-2 text-center text-[10px] text-slate-400">Sin histórico cargado</td>
                    )}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </Card>
    );
  };

  const fechaCorta = (f: string) => f.split('-').reverse().slice(0, 2).join('/');

  const renderReposicionLeader = () => {
    if (!reposicion) {
      return <div className="py-16 text-center text-[10px] font-bold text-gray-500 uppercase tracking-widest">Sin plan de reposición Leader — sincroniza para calcularlo.</div>;
    }
    const excedido = totalPlanReposicion > capacidadReposicion;
    const t = filasReposicion.reduce((s, f) => ({ stockUN: s.stockUN + f.stockUN, sugerido: s.sugerido + f.sugeridoUN, planKg: s.planKg + f.planKg }), { stockUN: 0, sugerido: 0, planKg: 0 });
    const th = 'px-3 py-3 border-r border-gray-100';
    const td = 'px-3 py-2 border-r border-gray-100 font-mono text-right';
    const dias = (v: number | null) => (v === null ? '—' : v.toFixed(1));
    const input = 'w-16 rounded-md border px-1.5 py-0.5 text-right font-mono text-[11px] focus:outline-none focus:ring-1 focus:ring-indigo-400';
    const hayAjustes = Object.keys(reposicion.metaOverride).length + Object.keys(reposicion.planOverride).length > 0;
    return (
      <div className="space-y-3">
        <div className="flex flex-wrap items-center gap-x-5 gap-y-2 rounded-2xl border border-gray-100 bg-white px-4 py-3 text-[11px]">
          <span className="font-black uppercase text-slate-700">Bloque Formulado Leader · producción {fechaCorta(reposicion.diaProduccion)}</span>
          <span className="font-bold text-slate-500" title="PLAN del último reporte guardado antes del día de producción (columna Plan ant.)">
            Plan anterior: {reposicion.planAnteriorFecha ? fechaCorta(reposicion.planAnteriorFecha) : 'sin reporte'}
          </span>
          <span className={cn('font-black', excedido ? 'text-red-600' : 'text-emerald-700')} title={`Nichos ${reposicion.nichosMax}${reposicion.autodescarga ? ` + autodescarga ${reposicion.autodescargaUN}` : ''} (bloques de ${BLOCK_LENGTH_METERS} m)`}>
            PLAN {formatNum(totalPlanReposicion, 0)} / {formatNum(capacidadReposicion, 0)} bloques{excedido ? ' · excede capacidad' : ''}
          </span>
          <label className="flex items-center gap-1.5 font-bold text-slate-600 cursor-pointer">
            <input type="checkbox" checked={reposicion.autodescarga} onChange={e => ajustarReposicion(r => ({ ...r, autodescarga: e.target.checked }))} />
            Autodescarga +{formatNum(reposicion.autodescargaUN, 0)}
          </label>
          {hayAjustes && (
            <Button size="sm" variant="outline" className="h-7 text-[10px] font-black uppercase" onClick={() => ajustarReposicion(r => ({ ...r, metaOverride: {}, planOverride: {} }))}>
              Restablecer sugerido
            </Button>
          )}
        </div>
        <div className="rounded-2xl border border-gray-100 shadow-sm overflow-hidden bg-white">
          <div className="overflow-x-auto max-h-[600px]">
            <table className="w-full border-collapse text-center font-sans text-[10px] text-gray-700">
              <thead className="bg-gray-50 sticky top-0 text-[10px] font-bold uppercase text-gray-500 tracking-widest z-20">
                <tr>
                  <th className={cn(th, 'text-left')}>Bloque</th>
                  <th className={cn(th, 'text-left')}>Descripción</th>
                  <th className={th} title="Estándar: Lote Mín. SAP (naranja: el promedio real difiere más de 3 %)">Peso (Kg)</th>
                  <th className={cn(th, 'text-emerald-700 bg-emerald-50/50')} title="Stock SAP (cubo) ÷ peso">Stock SAP (UN)</th>
                  <th className={cn(th, 'text-emerald-700 bg-emerald-50/50')} title="Igual que 2 · Stock y Curado (Leader): Kg curados ÷ peso">Curado (UN)</th>
                  <th className={cn(th, 'text-amber-700 bg-amber-50/50')} title="Igual que 2 · Stock y Curado (Leader): Kg en curado ÷ peso">En curado (UN)</th>
                  <th className={cn(th, 'text-cyan-700 bg-cyan-50/50')} title={`Histórico ${SEMANAS_META_CONSUMO} semanas ÷ días hábiles; editable`}>Meta (UN/día)</th>
                  <th className={cn(th, 'text-purple-700')} title="Exceso FERT 018 (atrasadas + ventana) sobre lo que VE ya consume en la meta">VE (UN)</th>
                  <th className={th} title="PLAN del reporte anterior">Plan ant. (UN)</th>
                  <th className={th} title="Restricción Estrategia_<material>; sin consumo = MTO">Estrat.</th>
                  <th className={cn(th, 'text-rose-700 bg-rose-50/50')}>Cobertura (días)</th>
                  <th className={th} title={`Restricción Cobertura_<material> o Formulacion_Cobertura_Dias; por defecto ${HORIZONTE_DEFAULT_DIAS} (1 día de fabricación + ${CURADO_DIAS_ESPERA} de curado)`}>Horizonte (días)</th>
                  <th className={th}>Acción</th>
                  <th className={cn(th, 'text-yellow-700 bg-yellow-50/50')}>Sugerido (UN)</th>
                  <th className={cn(th, 'text-indigo-700 bg-indigo-50/50')}>PLAN (UN)</th>
                  <th className={th}>PLAN (Kg)</th>
                  <th className="px-3 py-3" title="Cobertura con el PLAN">Cob. plan (días)</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50 font-bold">
                {filasReposicion.length === 0 ? (
                  <tr><td colSpan={17} className="py-12 text-center text-slate-300 uppercase font-black">Sin bloques Leader con stock o consumo</td></tr>
                ) : filasReposicion.map((f, idx) => {
                  const nuevoGrupo = idx === 0 || f.apertura !== filasReposicion[idx - 1].apertura;
                  return (
                    <React.Fragment key={f.blockCode}>
                      {nuevoGrupo && (
                        <tr className="bg-indigo-50/60">
                          <td colSpan={17} className="px-4 py-1.5 text-left text-[10px] font-black uppercase tracking-widest text-indigo-700">{aperturaGroupLabel(f.apertura)}</td>
                        </tr>
                      )}
                      <tr className={cn('hover:bg-slate-50 transition-colors', f.reponer && 'bg-yellow-50/30')}>
                        <td className="px-3 py-2 border-r border-gray-100 text-left font-mono font-black text-indigo-600">{f.blockCode}</td>
                        <td className="px-3 py-2 border-r border-gray-100 text-left uppercase truncate max-w-[260px]" title={f.corrida}>{f.blockDesc}</td>
                        <td className={cn(td, f.pesoFuente === 'sin dato' ? 'text-slate-400' : desfasePeso(f) ? 'text-orange-600' : '')} title={f.pesoFuente === 'sin dato' ? 'Sin peso' : f.pesoDetalle}>{f.pesoBloque > 0 ? formatNum(f.pesoBloque, 0) : '—'}</td>
                        <td
                          className={cn(td, 'text-emerald-800 bg-emerald-50/20')}
                          title={`SAP ${formatNum(f.stockKg, 0)} Kg · curado ${formatNum(f.curadoKg ?? 0, 0)} Kg · en curado ${formatNum(f.enCuradoKg, 0)} Kg · sin registro curado ${formatNum(f.stockKg - (f.curadoKg ?? 0) - f.enCuradoKg, 0)} Kg`}
                        >{f.stockUN.toFixed(1)}</td>
                        <td className={cn(td, 'text-emerald-700 bg-emerald-50/20')}>{f.curadoUN > 0 ? f.curadoUN.toFixed(1) : '—'}</td>
                        <td className={cn(td, 'text-amber-700 bg-amber-50/20')}>{f.enCuradoUN > 0 ? f.enCuradoUN.toFixed(1) : '—'}</td>
                        <td className={cn(td, 'bg-cyan-50/20')}>
                          <input
                            key={`m-${f.blockCode}-${f.metaEditada}`}
                            type="number" min={0} step={0.1}
                            defaultValue={Number(f.metaUNDia.toFixed(2))}
                            onBlur={e => ajustarValor('metaOverride', f.blockCode, e.target.value === String(Number(f.metaUNDia.toFixed(2))) && !f.metaEditada ? '' : e.target.value)}
                            className={cn(input, f.metaEditada ? 'border-cyan-500 text-cyan-800' : 'border-gray-200')}
                            title={`Histórico: ${f.pesoBloque > 0 ? (f.metaKgDia / f.pesoBloque).toFixed(2) : '—'} UN/día (${formatNum(f.metaKgDia, 1)} Kg/día)`}
                          />
                        </td>
                        <td
                          className={cn(td, 'text-purple-700')}
                          title={f.veVentanaKg !== undefined && f.pesoBloque > 0 ? `FERT 018 ventana ${(f.veVentanaKg / f.pesoBloque).toFixed(1)} UN − ya en la meta ${((f.veBaseKg ?? 0) / f.pesoBloque).toFixed(1)} UN` : undefined}
                        >{f.veUN > 0 ? f.veUN.toFixed(1) : '—'}</td>
                        <td className={td}>{f.planAnteriorUN > 0 ? formatNum(f.planAnteriorUN, 0) : '—'}</td>
                        <td className="px-3 py-2 border-r border-gray-100 font-black">{f.estrategiaEfectiva}</td>
                        <td className={cn(td, 'text-rose-700 bg-rose-50/20', f.coberturaActual !== null && f.coberturaActual < f.horizonteDias && 'font-black')}>{dias(f.coberturaActual)}</td>
                        <td className={cn(td, !f.horizonteRestriccion && 'text-slate-400')}>{f.horizonteDias.toFixed(1)}</td>
                        <td className="px-3 py-2 border-r border-gray-100 font-black">
                          {f.reponer ? <span className="text-yellow-700">Reponer</span> : !f.diaProduccion ? <span className="text-slate-400" title="No es día de producción (DiasProduccion_<apertura>)">No prod.</span> : ''}
                        </td>
                        <td className={cn(td, 'text-yellow-700 bg-yellow-50/30 font-black')}>{f.sugeridoUN || '—'}</td>
                        <td className={cn(td, 'bg-indigo-50/30')}>
                          <input
                            key={`p-${f.blockCode}-${f.planEditado}-${f.sugeridoUN}`}
                            type="number" min={0} step={1}
                            defaultValue={f.planUN}
                            onBlur={e => ajustarValor('planOverride', f.blockCode, e.target.value === String(f.sugeridoUN) && !f.planEditado ? '' : e.target.value)}
                            className={cn(input, f.planEditado ? 'border-indigo-500 text-indigo-800 font-black' : 'border-gray-200')}
                          />
                        </td>
                        <td className={td}>{f.planKg > 0 ? formatNum(f.planKg, 0) : '—'}</td>
                        <td className="px-3 py-2 font-mono text-right">{f.planUN > 0 ? dias(f.coberturaPlan) : ''}</td>
                      </tr>
                    </React.Fragment>
                  );
                })}
              </tbody>
              {filasReposicion.length > 0 && (
                <tfoot className="bg-gray-100 text-gray-800 font-black text-[10px] uppercase border-t-2 border-gray-200 sticky bottom-0 z-20">
                  <tr>
                    <td colSpan={3} className="px-3 py-3 text-right tracking-widest border-r border-gray-200">Totales</td>
                    <td className="px-3 py-3 border-r border-gray-200 font-mono text-right text-emerald-700">{t.stockUN.toFixed(1)}</td>
                    <td colSpan={9} className="border-r border-gray-200" />
                    <td className="px-3 py-3 border-r border-gray-200 font-mono text-right text-yellow-700">{formatNum(t.sugerido, 0)}</td>
                    <td className={cn('px-3 py-3 border-r border-gray-200 font-mono text-right', excedido ? 'text-red-600' : 'text-indigo-700')}>{formatNum(totalPlanReposicion, 0)}</td>
                    <td className="px-3 py-3 border-r border-gray-200 font-mono text-right">{formatNum(t.planKg, 0)}</td>
                    <td />
                  </tr>
                </tfoot>
              )}
            </table>
          </div>
        </div>
      </div>
    );
  };

  const renderReposicionCofama = () => {
    const rc = reposicionCofama;
    if (!rc) {
      return <div className="py-16 text-center text-[10px] font-bold text-gray-500 uppercase tracking-widest">Sin plan de reposición Cofama — sincroniza para calcularlo.</div>;
    }
    const th = 'px-3 py-3 border-r border-gray-100';
    const td = 'px-3 py-2 border-r border-gray-100 font-mono text-right';
    const dias = (v: number | null) => (v === null ? '—' : v.toFixed(1));
    const input = 'rounded-md border border-gray-200 px-1.5 py-0.5 font-mono text-[11px] focus:outline-none focus:ring-1 focus:ring-indigo-400';
    const totalBloques = rc.lineas.reduce((s, l) => s + (l.cantidad > 0 ? l.cantidad : 0), 0);
    const totalKg = rc.lineas.reduce((s, l) => s + (l.cantidad > 0 ? l.cantidad * (rc.formulados.find(f => f.code === l.formuladoCode)?.pesoKg || 0) : 0), 0);
    const t = filasCofamaVisibles.reduce((s, f) => ({ stock: s.stock + f.stockTotalUN, sugerido: s.sugerido + f.sugeridoUN, plan: s.plan + f.planUN }), { stock: 0, sugerido: 0, plan: 0 });
    const agregarLinea = () => ajustarCofama(r => ({
      ...r,
      lineas: [...r.lineas, { id: `${Date.now()}-${r.lineas.length}`, formuladoCode: r.formulados[0]?.code ?? '', combinacion: r.formulados[0]?.combinaciones[0] ?? '', cantidad: 1 }],
    }));
    return (
      <div className="space-y-3">
        <div className="flex flex-wrap items-center gap-x-5 gap-y-2 rounded-2xl border border-gray-100 bg-white px-4 py-3 text-[11px]">
          <span className="font-black uppercase text-slate-700">Bloque Formulado Cofama · producción {fechaCorta(rc.diaProduccion)}</span>
          <span className="font-bold text-slate-500">Plan anterior: {rc.planAnteriorFecha ? fechaCorta(rc.planAnteriorFecha) : 'sin reporte'}</span>
          <span className="font-black text-indigo-700">PLAN {formatNum(totalBloques, 0)} bloques formulados · {formatNum(totalKg, 0)} Kg</span>
          {Object.keys(rc.metaOverride).length > 0 && (
            <Button size="sm" variant="outline" className="h-7 text-[10px] font-black uppercase" onClick={() => ajustarCofama(r => ({ ...r, metaOverride: {} }))}>Restablecer meta</Button>
          )}
        </div>

        <div className="rounded-2xl border border-gray-100 shadow-sm overflow-hidden bg-white">
          <div className="flex items-center justify-between px-4 py-2 border-b border-gray-100">
            <span className="text-[10px] font-black uppercase tracking-widest text-slate-600">PLAN · formulado + combinación</span>
            <Button size="sm" variant="outline" className="h-7 gap-1 text-[10px] font-black uppercase" disabled={rc.formulados.length === 0} onClick={agregarLinea}>
              <Plus className="w-3.5 h-3.5" /> Agregar
            </Button>
          </div>
          <table className="w-full border-collapse text-[10px] text-gray-700">
            <thead className="bg-gray-50 text-[10px] font-bold uppercase text-gray-500 tracking-widest">
              <tr>
                <th className={cn(th, 'text-left')}>Bloque formulado</th>
                <th className={cn(th, 'text-left')}>Combinación</th>
                <th className={th}>Bloques</th>
                <th className={th}>Kg</th>
                <th className={cn(th, 'text-left')}>Cortados</th>
                <th className="px-3 py-3" />
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50 font-bold">
              {rc.lineas.length === 0 ? (
                <tr><td colSpan={6} className="py-6 text-center text-slate-300 uppercase font-black">Sin líneas de plan</td></tr>
              ) : rc.lineas.map(l => {
                const fm = rc.formulados.find(f => f.code === l.formuladoCode);
                const rep = repartirCombinacion(l.formuladoCode, fm?.desc ?? '', l.combinacion, l.cantidad > 0 ? l.cantidad : 0, rc.filas);
                const listaId = `comb-${l.id}`;
                return (
                  <tr key={l.id}>
                    <td className="px-3 py-2 border-r border-gray-100">
                      <select value={l.formuladoCode} onChange={e => ajustarLineaCofama(l.id, { formuladoCode: e.target.value, combinacion: rc.formulados.find(f => f.code === e.target.value)?.combinaciones[0] ?? l.combinacion })} className={cn(input, 'max-w-[300px]')}>
                        {rc.formulados.map(f => <option key={f.code} value={f.code}>{f.code} · {f.desc}</option>)}
                      </select>
                    </td>
                    <td className="px-3 py-2 border-r border-gray-100">
                      <input list={listaId} key={`c-${l.id}-${l.formuladoCode}`} defaultValue={l.combinacion} onBlur={e => ajustarLineaCofama(l.id, { combinacion: e.target.value.trim() })} className={cn(input, 'w-56')} placeholder="2un - 135X190 / 1un - 105X190" />
                      <datalist id={listaId}>{(fm?.combinaciones ?? []).map(c => <option key={c} value={c} />)}</datalist>
                    </td>
                    <td className={td}>
                      <input type="number" min={0} step={1} key={`n-${l.id}`} defaultValue={l.cantidad} onBlur={e => ajustarLineaCofama(l.id, { cantidad: Math.max(0, Math.round(numeroRestriccion(e.target.value) ?? 0)) })} className={cn(input, 'w-16 text-right')} />
                    </td>
                    <td className={td}>{fm?.pesoKg ? formatNum(l.cantidad * fm.pesoKg, 0) : '—'}</td>
                    <td className="px-3 py-2 border-r border-gray-100 text-left font-mono">
                      {Array.from(rep.porCortado).map(([c, un]) => <span key={c} className="mr-3 text-emerald-700">{un} → {c}</span>)}
                      {rep.sinEmparejar.map(s => <span key={s} className="mr-3 text-red-600" title="Sin bloque cortado con esa medida (±2 cm)">{s} ?</span>)}
                    </td>
                    <td className="px-3 py-2 text-center">
                      <button className="text-slate-400 hover:text-red-600" title="Quitar" onClick={() => ajustarCofama(r => ({ ...r, lineas: r.lineas.filter(x => x.id !== l.id) }))}><Minus className="w-3.5 h-3.5" /></button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        <div className="rounded-2xl border border-gray-100 shadow-sm overflow-hidden bg-white">
          <div className="overflow-x-auto max-h-[600px]">
            <table className="w-full border-collapse text-center font-sans text-[10px] text-gray-700">
              <thead className="bg-gray-50 sticky top-0 text-[10px] font-bold uppercase text-gray-500 tracking-widest z-20">
                <tr>
                  <th className={cn(th, 'text-left')}>Bloque cortado</th>
                  <th className={cn(th, 'text-left')}>Descripción</th>
                  <th className={th} title="Kg por UN: restricción Peso_<cortado>, o promedio de las piezas de los bloques Cofama fabricados (peso del formulado repartido por área de su combinación)">Peso (Kg)</th>
                  <th className={cn(th, 'text-emerald-700 bg-emerald-50/50')}>Cortado (UN)</th>
                  <th className={cn(th, 'text-amber-700 bg-amber-50/50')} title="Formulados Cofama en calle convertidos por su combinación">Formulado (UN)</th>
                  <th className={cn(th, 'text-emerald-700 bg-emerald-50/50')}>Total (UN)</th>
                  <th className={cn(th, 'text-cyan-700 bg-cyan-50/50')} title={`Histórico ${SEMANAS_META_CONSUMO} semanas ÷ días hábiles; editable`}>Meta (UN/día)</th>
                  <th className={cn(th, 'text-purple-700')} title="Necesidad FERT del paso 1">Interno (UN)</th>
                  <th className={th}>Plan ant. (UN)</th>
                  <th className={cn(th, 'text-rose-700 bg-rose-50/50')}>Cobertura (días)</th>
                  <th className={th} title={`Cobertura_<material>, Formulacion_Cobertura_Cofama_Dias o Formulacion_Cobertura_Dias; por defecto ${HORIZONTE_DEFAULT_DIAS}`}>Horizonte (días)</th>
                  <th className={th}>Acción</th>
                  <th className={cn(th, 'text-yellow-700 bg-yellow-50/50')}>Sugerido (UN)</th>
                  <th className={cn(th, 'text-indigo-700 bg-indigo-50/50')} title="UN que salen de las líneas de PLAN">PLAN (UN)</th>
                  <th className="px-3 py-3">Cob. plan (días)</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50 font-bold">
                {filasCofamaVisibles.length === 0 ? (
                  <tr><td colSpan={15} className="py-12 text-center text-slate-300 uppercase font-black">Sin bloques cortados con stock o consumo</td></tr>
                ) : filasCofamaVisibles.map(f => (
                  <tr key={f.cortadoCode} className={cn('hover:bg-slate-50 transition-colors', f.reponer && 'bg-yellow-50/30')}>
                    <td className="px-3 py-2 border-r border-gray-100 text-left font-mono font-black text-indigo-600">{f.cortadoCode}</td>
                    <td className="px-3 py-2 border-r border-gray-100 text-left uppercase truncate max-w-[260px]" title={f.formuladoCode ? `${f.formuladoCode} · ${f.formuladoDesc}` : 'Sin formulado en la BOM'}>{f.cortadoDesc}</td>
                    <td className={cn(td, !f.pesoCortado && 'text-slate-400')}>{f.pesoCortado > 0 ? formatNum(f.pesoCortado, 1) : '—'}</td>
                    <td className={cn(td, 'text-emerald-800 bg-emerald-50/20')}>{f.stockCortadoUN.toFixed(1)}</td>
                    <td className={cn(td, 'text-amber-700 bg-amber-50/20')}>{f.stockFormuladoUN > 0 ? formatNum(f.stockFormuladoUN, 0) : '—'}</td>
                    <td className={cn(td, 'text-emerald-800 bg-emerald-50/30 font-black')}>{f.stockTotalUN.toFixed(1)}</td>
                    <td className={cn(td, 'bg-cyan-50/20')}>
                      <input
                        key={`mc-${f.cortadoCode}-${f.metaEditada}`}
                        type="number" min={0} step={0.1}
                        defaultValue={Number(f.metaUNDia.toFixed(2))}
                        onBlur={e => ajustarCofama(r => {
                          const mapa = { ...r.metaOverride };
                          const n = numeroRestriccion(e.target.value);
                          if (n === null || n < 0 || (!f.metaEditada && e.target.value === String(Number(f.metaUNDia.toFixed(2))))) delete mapa[f.cortadoCode]; else mapa[f.cortadoCode] = n;
                          return { ...r, metaOverride: mapa };
                        })}
                        className={cn(input, 'w-16 text-right', f.metaEditada && 'border-cyan-500 text-cyan-800')}
                        title={`Histórico: ${f.pesoCortado > 0 ? (f.metaKgDia / f.pesoCortado).toFixed(2) : '—'} UN/día`}
                      />
                    </td>
                    <td className={cn(td, 'text-purple-700')}>{f.internoUN > 0 ? f.internoUN.toFixed(1) : '—'}</td>
                    <td className={td}>{f.planAnteriorUN > 0 ? formatNum(f.planAnteriorUN, 0) : '—'}</td>
                    <td className={cn(td, 'text-rose-700 bg-rose-50/20', f.coberturaActual !== null && f.coberturaActual < f.horizonteDias && 'font-black')}>{dias(f.coberturaActual)}</td>
                    <td className={cn(td, !f.horizonteRestriccion && 'text-slate-400')}>{f.horizonteDias.toFixed(1)}</td>
                    <td className="px-3 py-2 border-r border-gray-100 font-black">
                      {f.reponer ? <span className="text-yellow-700">Reponer</span> : !f.diaProduccion ? <span className="text-slate-400" title="No es día de producción (DiasProduccion_COFAMA)">No prod.</span> : ''}
                    </td>
                    <td className={cn(td, 'text-yellow-700 bg-yellow-50/30 font-black')}>{f.sugeridoUN || '—'}</td>
                    <td className={cn(td, 'text-indigo-800 bg-indigo-50/30 font-black', f.planUN > 0 && f.planUN < f.sugeridoUN && 'text-orange-600')}>{f.planUN || '—'}</td>
                    <td className="px-3 py-2 font-mono text-right">{f.planUN > 0 ? dias(f.coberturaPlan) : ''}</td>
                  </tr>
                ))}
              </tbody>
              {filasCofamaVisibles.length > 0 && (
                <tfoot className="bg-gray-100 text-gray-800 font-black text-[10px] uppercase border-t-2 border-gray-200 sticky bottom-0 z-20">
                  <tr>
                    <td colSpan={5} className="px-3 py-3 text-right tracking-widest border-r border-gray-200">Totales</td>
                    <td className="px-3 py-3 border-r border-gray-200 font-mono text-right text-emerald-700">{t.stock.toFixed(1)}</td>
                    <td colSpan={6} className="border-r border-gray-200" />
                    <td className="px-3 py-3 border-r border-gray-200 font-mono text-right text-yellow-700">{formatNum(t.sugerido, 0)}</td>
                    <td className="px-3 py-3 border-r border-gray-200 font-mono text-right text-indigo-700">{formatNum(t.plan, 0)}</td>
                    <td />
                  </tr>
                </tfoot>
              )}
            </table>
          </div>
        </div>

        {rc.sinEmparejar.length > 0 && (
          <div className="rounded-2xl border border-red-100 bg-red-50/40 px-4 py-3 text-[10px]">
            <p className="font-black uppercase text-red-700 mb-1">Combinaciones en calle sin bloque cortado (±{TOLERANCIA_MEDIDA_CM} cm)</p>
            {rc.sinEmparejar.map(s => (
              <p key={`${s.formuladoCode}|${s.combinacion}`} className="font-mono text-slate-700">{s.formuladoCode} · {s.formuladoDesc} · {s.combinacion} · {s.bloques} bloque(s)</p>
            ))}
          </div>
        )}
      </div>
    );
  };

  const renderContent = () => {
    if (isLoading) {
      return (
        <div className="flex flex-col items-center justify-center p-20 gap-4">
          <Loader2 className="w-10 h-10 animate-spin text-primary" />
          <p className="text-xs font-bold text-gray-500 uppercase tracking-widest animate-pulse">Sincronizando SAP...</p>
        </div>
      );
    }

    switch (activeTab) {
      case 'resumen': return (
        <div className="space-y-12 animate-in fade-in duration-300">
           {isProcessingResumen ? (
             <div className="py-32 text-center">
                <Loader2 className="w-12 h-12 animate-spin mx-auto text-primary mb-6" />
                <p className="text-[11px] font-black uppercase text-slate-500 tracking-widest">Ejecutando Explosión Técnica BOM: {resumenProgress.current} / {resumenProgress.total}</p>
             </div>
           ) : (
             <>
               {renderReposicionLeader()}
               {renderReposicionCofama()}
             </>
           )}
        </div>
      );
      case 'consumo': return (
        <div className="animate-in fade-in duration-300 text-left">{renderConsumoHistorico()}</div>
      );
      case 'curado': return (
        <div className="animate-in fade-in duration-300 text-left space-y-4">
           {curadoData.length > 0 && (
             <p className="px-2 text-[10px] font-bold text-slate-500" title={diagnosticoCurado.porDia.map(([f, n]) => `${f}: ${n}`).join('\n')}>
               Servicio de curado: {formatNum(curadoData.length, 0)} registros{curadoTotalServicio > 0 ? ` (informa ${formatNum(curadoTotalServicio, 0)})` : ''} · fabricación {diagnosticoCurado.fechas} · curado = fabricación + {CURADO_DIAS_ESPERA} días
             </p>
           )}
           {CURADO_SPACES.map(space => (
             <React.Fragment key={space.key}>{renderStockCurado(space.title, stockCuradoPorEspacio[space.key] ?? [])}</React.Fragment>
           ))}
           {(!curadoData || curadoData.length === 0) && (
             <div className="py-24 text-center bg-gray-50/30 rounded-3xl border-2 border-dashed border-gray-100">
               <TableIcon className="w-16 h-16 text-indigo-100 mx-auto" />
               <p className="text-[10px] font-bold text-gray-500 uppercase tracking-widest mt-4">Sin datos técnicos de curado en SAP</p>
             </div>
           )}
        </div>
      );
      case 'necesidad': return (
        <div className="animate-in fade-in duration-300 text-left space-y-6">
          <div className="flex flex-wrap items-center gap-x-5 gap-y-2 rounded-2xl border border-gray-100 bg-white px-4 py-3 text-[11px]">
            <span className="font-black uppercase text-slate-700" title="Se elige al sincronizar">Día de corte {fechaCorta(ventana.d)}</span>
            <span className="font-bold text-amber-700">Pendiente {fechaCorta(pendienteDesde)} → {fechaCorta(ventana.d)}</span>
            <span className="font-bold text-emerald-700">Planificado {fechaCorta(ventana.d)}</span>
          </div>
          {(() => {
            // Resumen por destino (usuario 2026-11-12: la matriz tramo × destino no se entendía): una fila por
            // destino con Pendiente / Planificado / Total en Kg de Bloque Formulado, % del total y, solo para
            // GYE, los sub-bloques (UN) en su propia columna.
            const destinos = [
              { dst: '1000' as const, nombre: 'Quito (UIO)', tip: 'FERT de los responsables de Formulación, centro 1000' },
              { dst: '2000' as const, nombre: 'Guayaquil (GYE)', tip: 'Sub-bloques cortados en UIO para GYE (FERT 041)' },
              { dst: 'VE' as const, nombre: 'Venta Externa', tip: 'FERT 038' },
            ];
            const totalDe = (dst: DestinoConsumo) => necesidadKg[dst].pendiente + necesidadKg[dst].planificado;
            const t = { pendiente: 0, planificado: 0 };
            destinos.forEach(({ dst }) => { t.pendiente += necesidadKg[dst].pendiente; t.planificado += necesidadKg[dst].planificado; });
            const total = t.pendiente + t.planificado;
            const th = 'px-4 py-2 text-right';
            return (
              <div className="overflow-x-auto rounded-2xl border border-gray-100 bg-white">
                <table className="w-full border-collapse text-[11px]">
                  <thead className="bg-gray-50 text-[10px] font-bold uppercase text-gray-500 tracking-widest">
                    <tr>
                      <th className="px-4 py-2 text-left">Necesidad de Bloque Formulado</th>
                      <th className={cn(th, 'text-amber-700')} title={`FECHAFIN ${fechaCorta(pendienteDesde)} → ${fechaCorta(ventana.d)} con saldo`}>Pendiente (Kg)</th>
                      <th className={cn(th, 'text-emerald-700')} title={`FECHAFIN ${fechaCorta(ventana.d)}`}>Planificado (Kg)</th>
                      <th className={cn(th, 'text-indigo-700')}>Total (Kg)</th>
                      <th className={th}>% del total</th>
                      <th className={cn(th, 'text-amber-700')} title="Unidades de sub-bloque de las FERT 041 (pendiente + planificado)">Sub-bloques GYE (UN)</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-50 font-mono font-bold">
                    {destinos.map(({ dst, nombre, tip }) => (
                      <tr key={dst}>
                        <td className="px-4 py-2 text-left font-sans font-black uppercase text-slate-700" title={tip}>{nombre}</td>
                        <td className="px-4 py-2 text-right text-amber-800">{formatNum(necesidadKg[dst].pendiente, 1)}</td>
                        <td className="px-4 py-2 text-right text-emerald-800">{formatNum(necesidadKg[dst].planificado, 1)}</td>
                        <td className="px-4 py-2 text-right text-indigo-800 font-black">{formatNum(totalDe(dst), 1)}</td>
                        <td className="px-4 py-2 text-right text-slate-500">{total > 0 ? `${((totalDe(dst) / total) * 100).toFixed(0)} %` : '—'}</td>
                        <td className="px-4 py-2 text-right text-amber-700">{dst === '2000' ? formatNum(subBloquesGye.pendiente + subBloquesGye.planificado, 0) : ''}</td>
                      </tr>
                    ))}
                    <tr className="bg-indigo-50/50 font-black">
                      <td className="px-4 py-2 text-left font-sans uppercase text-indigo-800">Total</td>
                      <td className="px-4 py-2 text-right text-amber-800">{formatNum(t.pendiente, 1)}</td>
                      <td className="px-4 py-2 text-right text-emerald-800">{formatNum(t.planificado, 1)}</td>
                      <td className="px-4 py-2 text-right text-indigo-900">{formatNum(total, 1)}</td>
                      <td className="px-4 py-2 text-right text-slate-500">{total > 0 ? '100 %' : '—'}</td>
                      <td />
                    </tr>
                  </tbody>
                </table>
              </div>
            );
          })()}
          {renderNecesidadTable(fertConsumoResponsable)}
        </div>
      );
      case 'inventario': return (
        <div className="animate-in fade-in duration-300 text-left">
          <Card className="rounded-2xl border border-gray-100 shadow-sm overflow-hidden bg-white">
            <div className="px-6 pt-5 pb-3 flex items-start gap-2 text-slate-500">
              <span className="inline-flex cursor-help" title="Fuente: CuboInventarios SAP. Stock (KG) = StockActual de SAP; Stock (UN) = Stock (KG) ÷ Lote Mínimo.">
                <Info className="w-3.5 h-3.5 mt-0.5 shrink-0" />
              </span>
            </div>
            <div className="overflow-x-auto max-h-[600px] relative">
              <table className="w-full border-collapse text-center font-sans text-[10px]">
                <thead className="bg-gray-50 sticky top-0 text-[10px] font-bold uppercase text-gray-500 tracking-widest z-10">
                  <tr>
                    <th className="px-6 py-5 border-r border-gray-100">Material</th>
                    <th className="px-6 py-5 border-r border-gray-100 text-left">Descripción del Bloque (SAP)</th>
                    <th className="px-4 py-5 border-r border-gray-100 text-left text-indigo-700">Categoría</th>
                    <th className="px-3 py-5 border-r border-gray-100">Centro</th>
                    <th className="px-3 py-5 border-r border-gray-100 text-purple-700">Clase Aprov.</th>
                    <th className="px-3 py-5 border-r border-gray-100 bg-green-50/50 text-green-700">
                      Stock (KG)
                      <span className="block normal-case font-normal text-gray-500 text-[8px] tracking-normal mt-0.5">StockActual SAP</span>
                    </th>
                    <th className="px-3 py-5 border-r border-gray-100 bg-blue-50/50 text-blue-700">
                      Stock (UN)
                      <span className="block normal-case font-normal text-gray-500 text-[8px] tracking-normal mt-0.5">KG ÷ Lote Mín.</span>
                    </th>
                    <th className="px-3 py-5 border-r border-gray-100 bg-amber-50/50 text-amber-700">Lote Mín. (KG)</th>
                    <th className="px-3 py-5 border-r border-gray-100 bg-amber-50/50 text-amber-700">Lote Máx. (KG)</th>
                    <th className="px-3 py-5">Responsable</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50 font-bold text-[11px]">
                  {filteredInventario.length === 0 ? (
                    <tr><td colSpan={10} className="py-20 text-center text-slate-200 uppercase font-black">No hay stock de &quot;BLOQUE FORMULADO&quot; registrado</td></tr>
                  ) : (
                    filteredInventario.map((row, i) => (
                      <tr key={i} className="hover:bg-gray-50/50 transition-colors">
                        <td className="px-6 py-3 border-r border-gray-100 font-mono text-blue-600">{cleanCode(row.Material)}</td>
                        <td className="px-6 py-3 border-r border-gray-100 text-left uppercase text-slate-500 truncate max-w-[300px] leading-tight">{row.Descripcion || '—'}</td>
                        <td className="px-4 py-3 border-r border-gray-100 text-left text-indigo-600 truncate max-w-[220px]">{row.Categoria || '—'}</td>
                        <td className="px-3 py-3 border-r border-gray-100">{row.Centro}</td>
                        <td className="px-3 py-3 border-r border-gray-100 text-purple-700 font-black bg-purple-50/30">{row.ClaseAprovisionam || '—'}</td>
                        <td className="px-3 py-3 border-r border-gray-100 font-mono text-green-700 bg-green-50/30">{formatNum(row.stockKg, 1)}</td>
                        <td className="px-3 py-3 border-r border-gray-100 font-mono text-blue-500 bg-blue-50/30">{row.loteMin > 0 ? formatNum(row.stockUN, 2) : '—'}</td>
                        <td className="px-3 py-3 border-r border-gray-100 font-mono text-amber-700 bg-amber-50/30">{row.loteMin > 0 ? formatNum(row.loteMin, 0) : '—'}</td>
                        <td className="px-3 py-3 border-r border-gray-100 font-mono text-amber-700 bg-amber-50/30">{row.loteMax > 0 ? formatNum(row.loteMax, 0) : '—'}</td>
                        <td className="px-3 py-3 text-[10px] text-blue-600 uppercase font-black">{row.RespCtrlProd || '—'}</td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </Card>
        </div>
      );
      default: return null;
    }
  };

  if (!mounted) return <div className="p-4 md:p-6 min-h-screen bg-white" />;

  return (
    <div className="p-4 md:p-6 space-y-6 bg-white min-h-screen rounded-xl border border-gray-100 shadow-sm font-sans text-left">
      <div className="flex items-center justify-between pb-4 border-b border-gray-100">
        <div className="flex items-center space-x-3 text-left">
          <div className="p-2 bg-indigo-600/10 rounded-xl shadow-inner"><FlaskConical className="w-6 h-6 text-indigo-600" /></div>
          <h2 className="text-xl font-black text-gray-800 uppercase tracking-tighter">Programación Táctica Formulación</h2>
        </div>
        <div className="flex items-center gap-2">
          {/* "Sincronizar y Generar Necesidades": un solo botón — trae datos crudos de SAP y, al
              terminar, calcula el resumen (explosión BOM) automáticamente (antes 2 clics separados;
              el usuario lo pidió combinado por ser repetitivo en el uso diario, ver
              [[modulos_tacticos_sincronizar_y_generar_combinado]]). */}
          <Button onClick={handleSincronizarYGenerar} disabled={syncStep !== 'idle'} variant={datosCargados ? 'outline' : 'default'} className={cn(
            "h-10 px-6 rounded-xl gap-2 font-black text-[10px] uppercase active:scale-95 transition-all",
            datosCargados ? "border-blue-200 text-blue-700 hover:bg-blue-50" : "bg-blue-600 text-white hover:bg-blue-700 shadow-lg"
          )}>
            {syncStep !== 'idle' ? <Loader2 className="w-4 h-4 animate-spin" /> : <RefreshCw className="w-4 h-4" />} Sincronizar y Generar Necesidades
          </Button>
          <DatosSapEstado onActualizar={() => { void handleSincronizarYGenerar(); }} disabled={syncStep !== 'idle'} />
          <Popover>
            <PopoverTrigger asChild>
              <Button
                variant="outline"
                disabled={isProcessingResumen || (unifiedSummaryData.length === 0 && !reposicion && !reposicionCofama)}
                title="Guarda el Plan de Reposición del Centro 1000 y envíalo por correo desde la vista previa"
                className="h-10 px-4 rounded-xl gap-2 font-black text-[10px] uppercase border-indigo-200 text-indigo-700 hover:bg-indigo-50"
              >
                <Mail className="w-4 h-4" /> Reporte
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-80 p-4 space-y-3" align="end">
              <div>
                <p className="text-xs font-black uppercase tracking-widest text-slate-700">Reporte de producción <span className="text-amber-600">(en desarrollo)</span></p>
              </div>
              <ReportePlanTxtAcciones flujo={reporteFlujo} compacto />
            </PopoverContent>
          </Popover>
          <ReportePlanTxtVistaPrevia
            flujo={reporteFlujo}
            titulo="Formulación [Bloque Formulado] — Centro 1000"
            destinatarios={destinatariosReporte}
            onDestinatariosChange={setDestinatariosReporte}
          />
        </div>
      </div>

      {/* Barra de progreso SOLO de la fase "sincronizando" (sin indicador propio). La fase
          "generando" ya tiene su propia barra, más detallada (Ejecutando Explosión Técnica BOM:
          X/Y, ver resumenProgress más abajo) — mostrar esta también ahí duplicaba el aviso (mismo
          problema reportado por el usuario con una captura real en Corte y Laminado). */}
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
          redacción compacta que Corte Espuma/Venta Externa/Laminado (ver
          [[carga_manual_modulos_tacticos]]). */}
      {planCargadoDe && (
        <div
          className="flex items-center gap-2.5 rounded-xl border border-emerald-200 bg-emerald-50/50 px-4 py-2.5 text-left"
          title="Lo que se ve en Salida de Datos viene del respaldo guardado junto al reporte, no de SAP. Sincronizar recalcula con los datos actuales."
        >
          <FileText className="w-4 h-4 text-emerald-700 shrink-0" />
          <p className="text-[11px] font-bold text-slate-600">
            Reporte del <span className="font-black text-emerald-700">{format(new Date(planCargadoDe.fechaObjetivo + 'T00:00:00'), 'EEE dd/MM/yyyy', { locale: es })}</span>
            {' '}(guardado {format(new Date(planCargadoDe.guardadoEn), 'dd/MM HH:mm')})
          </p>
        </div>
      )}
      {!datosCargados && !isLoading && !planCargadoDe && (
        <div
          className="flex items-center gap-2.5 rounded-xl border border-dashed border-blue-200 bg-blue-50/40 px-4 py-2.5 text-left"
          title="Este módulo no consulta SAP al abrirse. Sincronizar y Generar Necesidades trae FERT, Curado e Inventarios y calcula la necesidad al terminar."
        >
          <RefreshCw className="w-4 h-4 text-blue-500 shrink-0" />
          <p className="text-[11px] font-bold text-slate-600">
            Sin datos cargados — pulsa <span className="font-black text-blue-700">Sincronizar y Generar Necesidades</span> para verlos.
          </p>
        </div>
      )}

      <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
        <TabsList className="grid grid-cols-5 h-11 bg-gray-100/50 p-1.5 rounded-2xl border border-gray-200 mb-8">
          {[
            { v: 'necesidad', l: '1 · Necesidad', i: ShoppingCart },
            { v: 'curado', l: '2 · Stock y Curado', i: TableIcon },
            { v: 'resumen', l: '3 · Plan de Reposición', i: LayoutDashboard },
            { v: 'consumo', l: 'Consumo Histórico', i: TrendingUp },
            { v: 'inventario', l: 'Inventarios SAP', i: Database }
          ].map(tab => (
            <TabsTrigger key={tab.v} value={tab.v} className="gap-2 text-[10px] font-black uppercase transition-all data-[state=active]:bg-white data-[state=active]:shadow-lg data-[state=active]:text-primary rounded-xl">
              <tab.i className="w-4 h-4" /> {tab.l}
            </TabsTrigger>
          ))}
        </TabsList>

        <div className="mt-6">
          {renderContent()}
        </div>
      </Tabs>

      <style jsx global>{`
        .custom-scrollbar::-webkit-scrollbar { width: 4px; }
        .custom-scrollbar::-webkit-scrollbar-track { background: transparent; }
        .custom-scrollbar::-webkit-scrollbar-thumb { background: rgba(255,255,255,0.1); border-radius: 10px; }
        .custom-scrollbar::-webkit-scrollbar-thumb:hover { background: rgba(255,255,255,0.2); }
      `}</style>
      <PanelProgreso panel={panelProgreso} />
    </div>
  );
};
