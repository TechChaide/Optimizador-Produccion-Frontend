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
  Box,
  TrendingUp,
  Table as TableIcon,
  Info,
  Mail,
  FileText,
} from 'lucide-react';
import { Card } from '@/components/ui/card';
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
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
import { useReportePlanTxt, useAutoCargaPlanVigente, useReportePlanTxtGrupo, ReportePlanTxtAccionesGrupo, ReportePlanTxtVistaPreviaGrupo, type OrigenEstadoPlan } from '@/components/ReportePlanTxtFlujo';
import { PanelProgreso, usePanelProgreso } from '@/components/PanelProgreso';
import { guardarEnCache, leerDeCache, actualizarEnCache } from '@/lib/cache-modulos';
import { CUPULA_MAX_CM } from '@/lib/bloques-espuma';
import { ventanaCorte } from '@/lib/ventana-corte';
import { nextBusinessDay, addBusinessDays, laborablesHorizonte, cargarDiasNoLaborables, type DiasNoLaborables } from '@/lib/dias-laborables';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';

const BLOCK_LENGTH_METERS = 20;
// Tiempo de curado/reposo: 3 días TOTALES contando el propio día de fabricación (día 1 = fab, día 2,
// día 3 = reposo), disponible para consumo recién al día 4 (fab + 3). Antes era 2 (disponible en
// fab + 2, es decir solo 2 días de reposo sin contar el de fabricación como día 1) — confirmado por
// el usuario como bug de criterio: le faltaba un día de cobertura real a los bloques.
const CURADO_DIAS_ESPERA = 3;

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

// Cofama: una corrida puede combinar hasta DOS dimensiones de bloque distintas en la misma fila
// (ej. "1un - 160X200 / 1un - 200X200" = 1 unidad de 160X200 Y 1 unidad de 200X200 del mismo
// bloque/CodBloque). El usuario pidió partir esto en "1er Cant/1er Comb" y "2da Cant/2da Comb"
// (estructura tomada de su propia referencia en Excel) para poder leer cuánta cantidad hay de
// CADA dimensión, en vez de tratar la combinación completa como una sola unidad indivisible.
interface CorridaComponente { cantidad: number; dimension: string }
const parseCorridaComponentes = (raw: string): CorridaComponente[] => {
  return raw.split('/').map(part => {
    const m = part.trim().match(/^(\d+)\s*un\s*-\s*(.+)$/i);
    if (!m) return null;
    return { cantidad: safeNum(m[1]), dimension: m[2].trim().toUpperCase() };
  }).filter((c): c is CorridaComponente => c !== null);
};

// Tipo de bloque (VI, BI...) — el usuario confirmó que sale de una LÓGICA posicional sobre
// NomMaterial, no de un diccionario de palabras: la palabra que sigue inmediatamente a la
// densidad ("D48 VISCO GEL CL" -> "VISCO" -> "VI"; "D30 BIOCRYSTAL" -> "BIOCRYSTAL" -> "BI"),
// tomando sus primeras 2 letras. Vacío si NomMaterial no trae ese patrón (ej. materiales de
// prueba tipo "BLOQUE FORMULADO PRUEBAS MQ COFAMA", que no tienen "D{n}" en el nombre).
const extraerTipoBloque = (nomMaterial: string): string => {
  const m = nomMaterial.match(/D\s*\d+(?:\.\d+)?\s+([A-Za-zÀ-ÿ]+)/);
  return m ? m[1].slice(0, 2).toUpperCase() : '';
};

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

// Materiales de PRUEBA (ej. "BLOQUE FORMULADO PRUEBAS MQ COFAMA") — el usuario confirmó que tanto
// Leader como Cofama corren pruebas de máquina de vez en cuando, y esos bloques NO deben contarse
// como stock/curado real en ningún lado (ni en las tablas de detalle, ni en la Evaluación general,
// ni en el Resumen). Filtro amplio por "PRUEBA" (singular o plural) sobre la descripción/nombre —
// nomenclatura humana en SAP, no hay un flag dedicado para esto.
const esMaterialPrueba = (descripcion: string): boolean => /PRUEBA/i.test(descripcion);

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
  const estado = getProp(row, ['estado', 'ESTADO']).trim().toUpperCase();
  const maquina = getProp(row, ['Maquina', 'MAQUINA']).trim().toUpperCase();
  if (estadoTras !== space.estadoTras || estado !== space.estado || maquina !== space.maquina) return false;
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

// Cuántos registros se muestran por página en cada espacio de "Control Curado" — antes se
// renderizaban TODOS los registros filtrados de una vez (podían ser 700+ filas para combinaciones
// como F_BLO_ST/BL/BCFR), forzando al navegador a montar todo el DOM de la tabla aunque el usuario
// solo viera una fracción por el scroll interno.
const CURADO_PAGE_SIZE = 50;

// Filtra `data` por el criterio de `space` (ver CURADO_SPACES) y agrega Fecha Disponible
// (fabricación + CURADO_DIAS_ESPERA) y Estado a cada registro, sin perder ninguna de las columnas
// originales que trae la fuente SAP. Componente propio (no una función auxiliar del padre) para
// poder llevar su propia página de paginación sin mezclar el estado de los distintos espacios
// (Leader/Cofama/T8/Looper) entre sí.
const CuradoSpaceTable: React.FC<{ data: RawApiRow[]; space: CuradoSpaceConfig }> = ({ data, space }) => {
  const [page, setPage] = useState(1);

  const todayStr = format(new Date(), 'yyyy-MM-dd');
  // Orden y agrupación según space.groupBy (ver CURADO_SPACES):
  // - 'apertura' (Leader): Apertura (194.5/206/219/228, "sin apertura" al final) y, dentro,
  //   Densidad ascendente — para ubicar de un vistazo la corrida de un bloque concreto.
  // - 'none' (Cofama): sin encabezado de grupo (una fila puede pertenecer a DOS dimensiones a la
  //   vez, ver parseCorridaComponentes) — se ordena por la primera combinación (1er Comb) para que
  //   al menos quede agrupado visualmente lo más posible, sin mentir con un encabezado por fila.
  // La fecha de fabricación queda como desempate dentro de cada grupo en ambos casos.
  const filtered = useMemo(() => data.filter(row => matchesCuradoSpace(row, space)).map(row => {
    const fechaRaw = getProp(row, ['fecha', 'FECHA', 'FECHA_INICIO', 'FECHA_FABRICACION', 'FECHA_OT_PRG_INI']);
    const fab = parseFechaSAP(fechaRaw);
    let fechaDisponible = '—';
    let disponible = false;
    if (fab) {
      const disp = new Date(fab);
      disp.setDate(disp.getDate() + CURADO_DIAS_ESPERA);
      fechaDisponible = format(disp, 'yyyy-MM-dd');
      disponible = todayStr >= fechaDisponible;
    }
    const unidades = safeNum(getProp(row, ['CantidadStock', 'CANTIDADSTOCK', 'CANTIDAD_STOCK']));
    const info = extractMaterialInfo(row);
    const nomMaterial = getProp(row, ['NomMaterial', 'NOMMATERIAL']);
    const densNum = String(info.dens).replace(/\D/g, '');
    const tipoBloque = extraerTipoBloque(nomMaterial);
    const componentes = parseCorridaComponentes(getProp(row, ['corridaproceso', 'CORRIDAPROCESO']));
    const combLabel = (dim: string) => [densNum, tipoBloque, dim].filter(Boolean).join(' ');
    const cant1 = componentes[0]?.cantidad ?? 0;
    const comb1 = componentes[0] ? combLabel(componentes[0].dimension) : '';
    const cant2 = componentes[1]?.cantidad ?? 0;
    const comb2 = componentes[1] ? combLabel(componentes[1].dimension) : '';
    return {
      __raw: row, __fechaFabTime: fab ? fab.getTime() : 0, __fechaDisponible: fechaDisponible, __disponible: disponible,
      __unidades: unidades, __apertura: info.apertura, __dens: info.dens,
      __densNum: densNum, __cant1: cant1, __comb1: comb1, __cant2: cant2, __comb2: comb2,
      __alturaCm: alturaCuradoCm(row),
    };
  }).sort((a, b) => {
    const grupoCmp = space.groupBy === 'apertura'
      ? compareAperturaDensidad({ apertura: a.__apertura, dens: a.__dens }, { apertura: b.__apertura, dens: b.__dens })
      : a.__comb1.localeCompare(b.__comb1);
    return grupoCmp || a.__fechaFabTime - b.__fechaFabTime;
  }), [data, space, todayStr]);

  // Totales en unidades (CantidadStock por registro) — disponible = ya pasó CURADO_DIAS_ESPERA
  // desde fabricación; pendiente = todavía dentro de la ventana de curado. Se calculan sobre TODO
  // `filtered`, no solo la página visible — son totales del espacio completo, no de la página.
  const unidadesDisponible = filtered.filter(r => r.__disponible).reduce((s, r) => s + r.__unidades, 0);
  const unidadesPendiente = filtered.filter(r => !r.__disponible).reduce((s, r) => s + r.__unidades, 0);

  const totalPaginas = Math.max(1, Math.ceil(filtered.length / CURADO_PAGE_SIZE));
  const paginaActual = Math.min(page, totalPaginas);
  const pageRows = filtered.slice((paginaActual - 1) * CURADO_PAGE_SIZE, paginaActual * CURADO_PAGE_SIZE);

  const filterLabel = `ESTADOTRAS=${space.estadoTras} · ESTADO=${space.estado} · MAQUINA=${space.maquina}`
    + (space.corridaproceso.length > 0 ? ` · CORRIDAPROCESO=${space.corridaproceso.join(' / ')}` : ' · CORRIDAPROCESO=(todas, por combinación)');

  if (filtered.length === 0) {
    return (
      <div className="space-y-2">
        <h4 className="text-[10px] font-black text-slate-500 uppercase tracking-widest px-2">{space.title} (0)</h4>
        <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest px-2">Filtro: {filterLabel}</p>
        <div className="py-10 text-center bg-gray-50/30 rounded-3xl border-2 border-dashed border-gray-100 mb-8">
          <p className="text-[10px] font-bold text-gray-500 uppercase tracking-widest">
            0 de {data.length} registros de curado coinciden con este filtro
          </p>
        </div>
      </div>
    );
  }

  // Columnas EXACTAS de las capturas reales que el usuario compartió (Leader/Cofama) — mismo nombre
  // de campo, mismo orden: Idbloque, fecha, orden, CodMaterial, NomMaterial, corridaproceso, peso,
  // estado, CodBloque, operador, Maquina, estadoTras, CantidadStock. Antes se anteponían dos
  // columnas calculadas ("Fecha Disponible +2d" y una insignia "Estado" Disponible/En Curado) que NO
  // estaban en esas capturas, y se renombraba "ESTADOTRAS" a "ESTADO" para mostrarlo — dejaba dos
  // columnas con la misma etiqueta "ESTADO" (la insignia calculada y el campo crudo), confuso y
  // distinto de lo pedido. Ahora se muestran los campos crudos tal cual vienen, sin agregar ni
  // renombrar nada — si una fila no trae alguna de estas columnas, se le pone un guion.
  const COLUMNAS_CURADO = ['Idbloque', 'fecha', 'orden', 'CodMaterial', 'NomMaterial', 'corridaproceso', 'peso', 'estado', 'CodBloque', 'operador', 'Maquina', 'estadoTras', 'CantidadStock'];
  const valorColumna = (raw: RawApiRow, columna: string): string => {
    const v = getProp(raw, [columna, columna.toUpperCase()]);
    return v || '—';
  };
  // Cofama únicamente: columnas calculadas que parten corridaproceso en sus hasta-dos
  // combinaciones (ver parseCorridaComponentes/extraerTipoBloque) — estructura tomada de la
  // referencia en Excel que compartió el usuario. Leader no las necesita: su corridaproceso
  // siempre es "1", no una combinación de dimensiones.
  const esCofama = space.key === 'cofama';
  const COLUMNAS_EXTRA_COFAMA = ['Densidad', '1er Cant', '1er Comb', '2da Cant', '2da Comb'];
  const columnasTotales = COLUMNAS_CURADO.length + 2 + (esCofama ? COLUMNAS_EXTRA_COFAMA.length : 0);

  return (
    <div className="space-y-2">
      <div className="px-2 flex items-baseline justify-between flex-wrap gap-2">
        <div className="flex items-center gap-2 flex-wrap">
          <h4 className="text-[10px] font-black text-slate-500 uppercase tracking-widest">{space.title} ({filtered.length})</h4>
          <span className="text-[10px] font-black uppercase tracking-wider bg-emerald-50 text-emerald-700 rounded-full px-3 py-1">Disponible: {formatNum(unidadesDisponible, 1)} UN</span>
          <span className="text-[10px] font-black uppercase tracking-wider bg-amber-50 text-amber-700 rounded-full px-3 py-1">Pendiente Curado: {formatNum(unidadesPendiente, 1)} UN</span>
        </div>
        <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Filtro: {filterLabel}</p>
      </div>
      <div className="rounded-2xl border border-gray-100 shadow-sm overflow-hidden bg-white text-left mb-2">
        <div className="overflow-x-auto max-h-[500px]">
          <table className="w-full border-collapse text-center font-sans text-[10px] text-gray-700">
            <thead className="bg-gray-50 sticky top-0 text-[10px] font-bold uppercase text-gray-500 tracking-widest z-10">
              <tr>
                {COLUMNAS_CURADO.map((col, i) => (
                  <th key={i} className="px-4 py-4 border-r border-gray-100 whitespace-nowrap uppercase">
                    {col}
                  </th>
                ))}
                <th className="px-4 py-4 border-r border-gray-100 whitespace-nowrap uppercase bg-emerald-50/40 text-emerald-700" title="CuradoAltura (mm) ÷ 10">Altura (cm)</th>
                <th className="px-4 py-4 border-r border-gray-100 whitespace-nowrap uppercase bg-emerald-50/40 text-emerald-700" title={`Altura − cúpula (${CUPULA_MAX_CM} cm)`}>Útil (cm)</th>
                {esCofama && COLUMNAS_EXTRA_COFAMA.map((col, i) => (
                  <th key={`extra-${i}`} className="px-4 py-4 border-r border-gray-100 whitespace-nowrap uppercase bg-indigo-50/40 text-indigo-700">
                    {col}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50 font-bold">
              {pageRows.map((row, idx) => {
                // Encabezado de grupo SOLO para 'apertura' (Leader): una fila de Cofama puede
                // pertenecer a dos combinaciones a la vez (ver parseCorridaComponentes), así que
                // agruparla bajo un solo encabezado por fila sería engañoso — Cofama no lleva.
                const nuevoGrupo = space.groupBy === 'apertura' && (idx === 0 || row.__apertura !== pageRows[idx - 1].__apertura);
                return (
                  <React.Fragment key={idx}>
                    {nuevoGrupo && (
                      <tr className="bg-indigo-50/60">
                        <td colSpan={columnasTotales} className="px-4 py-2 text-left text-[10px] font-black uppercase tracking-widest text-indigo-700">
                          {aperturaGroupLabel(row.__apertura)}
                        </td>
                      </tr>
                    )}
                    <tr className="hover:bg-slate-50 transition-colors">
                      {COLUMNAS_CURADO.map((col, i) => (
                        <td key={i} className="px-4 py-3 border-r border-gray-100 font-mono text-slate-500 whitespace-nowrap text-center">
                          {valorColumna(row.__raw, col)}
                        </td>
                      ))}
                      <td className="px-4 py-3 border-r border-gray-100 font-mono text-emerald-800 font-black whitespace-nowrap text-center bg-emerald-50/10">{row.__alturaCm > 0 ? row.__alturaCm.toFixed(1) : '—'}</td>
                      <td className="px-4 py-3 border-r border-gray-100 font-mono text-emerald-800 whitespace-nowrap text-center bg-emerald-50/10">{row.__alturaCm > 0 ? (row.__alturaCm - CUPULA_MAX_CM).toFixed(1) : '—'}</td>
                      {esCofama && (
                        <>
                          <td className="px-4 py-3 border-r border-gray-100 font-mono text-slate-500 whitespace-nowrap text-center bg-indigo-50/10">{row.__densNum || '—'}</td>
                          <td className="px-4 py-3 border-r border-gray-100 font-mono text-slate-700 font-black whitespace-nowrap text-center bg-indigo-50/10">{row.__cant1 || '—'}</td>
                          <td className="px-4 py-3 border-r border-gray-100 font-mono text-indigo-700 font-black whitespace-nowrap text-center bg-indigo-50/10">{row.__comb1 || '—'}</td>
                          <td className="px-4 py-3 border-r border-gray-100 font-mono text-slate-700 font-black whitespace-nowrap text-center bg-indigo-50/10">{row.__cant2 || '—'}</td>
                          <td className="px-4 py-3 border-r border-gray-100 font-mono text-indigo-700 font-black whitespace-nowrap text-center bg-indigo-50/10">{row.__comb2 || '—'}</td>
                        </>
                      )}
                    </tr>
                  </React.Fragment>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
      <div className="flex items-center justify-between px-2 mb-8">
        <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">
          Mostrando {(paginaActual - 1) * CURADO_PAGE_SIZE + 1}–{Math.min(paginaActual * CURADO_PAGE_SIZE, filtered.length)} de {filtered.length}
        </p>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" className="h-7 px-3 text-[10px] font-black uppercase rounded-xl" disabled={paginaActual <= 1} onClick={() => setPage(p => Math.max(1, p - 1))}>Anterior</Button>
          <span className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Página {paginaActual} / {totalPaginas}</span>
          <Button variant="outline" size="sm" className="h-7 px-3 text-[10px] font-black uppercase rounded-xl" disabled={paginaActual >= totalPaginas} onClick={() => setPage(p => Math.min(totalPaginas, p + 1))}>Siguiente</Button>
        </div>
      </div>
    </div>
  );
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
// materiales de combinación — ver summarySpaces más abajo) siempre al final.
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
}

// Respaldo de lo planificado guardado junto al TXT ({fecha}.estado.json), ver capturarEstadoPlan.
// Cambiar su forma exige subir `version` (los respaldos viejos dejan de cargarse).
interface EstadoPlanFormulacion {
  tipo: 'formulacion-salida';
  version: 2;
  diaCorte: string;
  unifiedSummaryData: FormuladoSummaryRow[];
  consumoBloqueFormulado: ConsumoBloqueRow[];
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
  // Reporte guardado del que viene lo que se ve (ver restaurarEstadoPlan); null = datos de la sesión.
  const [planCargadoDe, setPlanCargadoDe] = useState<OrigenEstadoPlan | null>(null);
  const [consumoBloqueFormulado, setConsumoBloqueFormulado] = useState<ConsumoBloqueRow[]>([]);
  const [expandedGroups, setExpandedGroups] = useState<Set<string>>(new Set());

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

  // Paso 1 · Necesidad: FERT de la ventana (pendiente + planificado) de los responsables de Formulación
  // y de Venta Externa (038), explotadas a Kg de Bloque Formulado. Necesidad neta = esa necesidad −
  // stock útil (stock SAP menos lo que aún está en curado); el plan de reposición cubre el faltante.
  const handleProcessResumen = useCallback(async (): Promise<{ estado: 'ok' | 'aviso' | 'error'; mensaje: string; progreso?: { actual: number; total: number } }> => {
    const allOrders = prodFiltradas.flatMap(o => {
      const centro = getProp(o, ['CENTRO', 'Centro']).trim();
      const resp = getProp(o, ['RESPCTRLPROD', 'RESPCONTROLPROD', 'RESP_CONTROL_PROD', 'RESPONSABLE']).trim();
      if (!entraEnFormulacion(centro, resp, respPorCentroDinamico)) return [];
      const esVenta = resp === RESP_VENTA_EXTERNA;
      const tramo = tramoFert(fechaFinOrden(o));
      if (!tramo) return [];
      const destino: DestinoConsumo = resp === RESP_VENTA_EXTERNA ? 'VE' : resp === RESP_SUBBLOQUES_GYE ? '2000' : '1000';
      return [{ order: o, origin: 'fert' as const, centro, resp, esVenta, tramo, destino }];
    });
    if (allOrders.length === 0) {
      setUnifiedSummaryData([]);
      setConsumoBloqueFormulado([]);
      return { estado: 'aviso', mensaje: `Sin FERT de Formulación / Venta Externa entre ${pendienteDesde} y ${ventana.d}.` };
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
      // Materiales cuyo BOM no resuelve a ningún "BLOQUE FORMULADO" (13 casos reales verificados:
      // LAMINA PRENSADA, TACO PRENSADO, LAMINA LATEX, ESPUMA ALM VISCO CONVOLUTE — de responsables
      // de Formulación, pero sin ese componente en su árbol) quedaban invisibles en "Consumo de
      // Bloque Formulado" (antes solo se poblaba desde traceBloqueFormuladoConsumption). El usuario
      // pidió que ESE espacio muestre TODOS los materiales, no solo los que trazan a un bloque — se
      // agrega una fila auto-referenciada (Formulado = el propio material) para no perder visibilidad
      // de estas órdenes ahora que el espacio de "órdenes crudas" se retira de estos dos tabs.
      if (blockCode === '—') {
        consumoRows.push({
          codFormulado: info.code,
          nombreFormulado: info.desc,
          componente: info.code,
          nombreComponente: info.desc,
          material: info.code,
          nombre: info.desc,
          orden: String(ordenNum),
          un: 'UN',
          total: qty,
          origin,
          centro: centroOrden,
          respCtrlProd: respOrden
        });
      }
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
    setUnifiedSummaryData(summaryOrdenado);
    setConsumoBloqueFormulado(consumoRows);
    setMovimientosConsumo(Object.fromEntries(movimientosCache));
    // Mantiene el snapshot en sync — si el usuario navega a otro módulo y vuelve, el tab Resumen ya
    // no aparece vacío (ver SnapshotFormulacion). No-op si todavía no se sincronizó ningún dato base
    // (actualizarEnCache no escribe sobre un snapshot inexistente).
    actualizarEnCache<SnapshotFormulacion>(CACHE_FORMULACION, {
      unifiedSummaryData: summaryOrdenado,
      consumoBloqueFormulado: consumoRows,
    });
    setIsProcessingResumen(false);
    return { estado: 'ok', mensaje: `${allOrders.length} orden(es) → ${summaryOrdenado.length} bloque(s) formulado(s) en el resumen.`, progreso: { actual: allOrders.length, total: allOrders.length } };
  }, [prodFiltradas, cuboInventarios, getStockEnCurado, respPorCentroDinamico, tramoFert, pendienteDesde, ventana.d]);

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
  const summarySpaces = useMemo(() => {
    const apertura = unifiedSummaryData.filter(row => row.apertura !== '—');
    const combinacion = unifiedSummaryData.filter(row => row.apertura === '—');
    return { apertura, combinacion };
  }, [unifiedSummaryData]);

  // "Reporte de producción" (EN DESARROLLO) — este módulo no tenía correo: el reporte se arma acá
  // con el mismo esquema HTML de los correos de los otros módulos y el contenido de la tabla Resumen
  // por centro (mismas columnas y misma Cobertura Actual que renderSummaryTable). Mismo flujo de 3
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

  const construirReporteHtmlFormulacion = (centro: '1000' | '2000', fechaObjetivo: string) => {
    const esc = (v: unknown) => String(v ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
    const th = (t: string, right = false) => `<td${right ? ' align="right"' : ''} style="padding:6px 8px;font-size:9px;font-weight:700;text-transform:uppercase;color:#6b7280;background:#f9fafb;border-bottom:1px solid #e5e7eb;">${t}</td>`;
    const td = (t: string, right = false) => `<td${right ? ' align="right"' : ''} style="padding:5px 8px;font-size:11px;color:#374151;border-bottom:1px solid #f3f4f6;">${t}</td>`;
    const seccion = (titulo: string, filas: FormuladoSummaryRow[]) => {
      if (filas.length === 0) return `<p style="margin:18px 0 6px;font-size:10px;font-weight:700;text-transform:uppercase;color:#6b7280;">${titulo}</p><p style="font-size:11px;color:#9ca3af;">Sin bloques para este centro.</p>`;
      const tStockKg = filas.reduce((s, r) => s + r.stockKg, 0);
      const tStockUtilKg = filas.reduce((s, r) => s + r.stockUtilUN * r.pesoBloque, 0);
      const tConsumoKg = filas.reduce((s, r) => s + r.consumoDiarioKg, 0);
      const tReposicion = filas.reduce((s, r) => s + r.planReposicion, 0);
      return `
<p style="margin:18px 0 6px;font-size:10px;font-weight:700;text-transform:uppercase;color:#6b7280;">${titulo}</p>
<table role="presentation" cellpadding="0" cellspacing="0" style="width:100%;border:1px solid #e5e7eb;border-collapse:collapse;">
  <tr>${th('Bloque')}${th('Corrida')}${th('Descripción')}${th('Dens.')}${th('Apert.')}${th('Pendiente (Bloq)', true)}${th('Planificado (Bloq)', true)}${th('Stock (Kg)', true)}${th('Stock (UN)', true)}${th('En Curado (UN)', true)}${th('Stock Útil (UN)', true)}${th('Consumo/D (Kg)', true)}${th('Cobertura (Días)', true)}${th('Plan Reposición (UN)', true)}</tr>
  ${filas.map(r => {
    const cobertura = r.consumoDiarioKg > 0 ? (r.stockUtilUN * r.pesoBloque) / r.consumoDiarioKg : null;
    return `<tr>${td(esc(r.blockCode))}${td(esc(r.corrida))}${td(esc(r.blockDesc))}${td(esc(r.dens))}${td(esc(r.apertura))}${td(r.totalBloquesPendiente.toFixed(2), true)}${td(r.totalBloquesPlanificado.toFixed(2), true)}${td(formatNum(r.stockKg, 0), true)}${td(r.stockUN.toFixed(1), true)}${td(r.stockEnCuradoUN.toFixed(1), true)}${td(r.stockUtilUN.toFixed(1), true)}${td(r.consumoDiarioKg.toFixed(1), true)}${td(cobertura === null ? '—' : cobertura.toFixed(1), true)}${td(String(r.planReposicion), true)}</tr>`;
  }).join('')}
</table>
<p style="margin:6px 0 0;font-size:11px;font-weight:700;color:#b45309;">Totales — Stock: ${formatNum(tStockKg, 0)} Kg · Cobertura sección: ${tConsumoKg > 0 ? (tStockUtilKg / tConsumoKg).toFixed(1) : '—'} días · Plan Reposición: ${tReposicion} UN</p>`;
    };
    const rango = `pendiente ${pendienteDesde} → día de corte ${ventana.d}`;
    return `
<div style="max-width:960px;margin:0 auto;background:#ffffff;font-family:-apple-system,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#4f46e5;"><tr><td style="padding:18px 24px;font-size:15px;font-weight:700;color:#ffffff;">CHAIDE Y CHAIDE</td><td align="right" style="padding:18px 24px;font-size:11px;font-weight:600;text-transform:uppercase;color:#c7d2fe;">Planificación de Producción</td></tr></table>
<div style="padding:20px 24px 24px;">
<p style="margin:0;font-size:10px;font-weight:700;text-transform:uppercase;color:#6b7280;">Formulación · Centro ${centro} (${centro === '1000' ? 'Quito' : 'Guayaquil'}) · Reporte diario</p>
<h1 style="margin:4px 0 0;font-size:20px;color:#111827;">Bloque Formulado — necesidad, stock y plan de reposición</h1>
<p style="margin:6px 0 0;font-size:12px;color:#6b7280;">Fecha objetivo: ${fechaObjetivo} · Ventana FERT: ${rango}</p>
${seccion('Bloque Formulado — Apertura', summarySpaces.apertura.filter(r => r.centro === centro))}
${seccion('Bloque Formulado — Combinación (sin apertura técnica)', summarySpaces.combinacion.filter(r => r.centro === centro))}
<p style="margin:20px 0 0;padding-top:14px;border-top:1px solid #e5e7eb;font-size:11px;color:#9ca3af;">Generado automáticamente por el Optimizador de Producción, favor no responder. Para dudas sobre estos datos, contacta a Planificación Táctica.</p>
</div>
</div>`;
  };

  const fechaObjetivoReporte = ventana.d;
  const asuntoReporteFormulacion = (centro: '1000' | '2000') => `Reporte de producción — Formulación [Bloque Formulado]-[Centro ${centro}]`;
  // Respaldo de "Salida de Datos" que viaja junto al TXT ({fecha}.estado.json) para volver a cargar
  // lo planificado desde "Recuperar y revisar" (mismo flujo que Corte Laminado). Cubre ambos centros:
  // se guarda una sola vez, en el reporte del Centro 1000.
  const capturarEstadoPlan = (): EstadoPlanFormulacion => ({
    tipo: 'formulacion-salida',
    version: 2,
    diaCorte: ventana.d,
    unifiedSummaryData,
    consumoBloqueFormulado,
  });
  const restaurarEstadoPlan = (crudo: unknown, origen: OrigenEstadoPlan): boolean => {
    const e = crudo as Partial<EstadoPlanFormulacion> | null;
    // version 1 (rango de fechas + provisionales) ya no se carga: hay que volver a sincronizar.
    if (!e || e.tipo !== 'formulacion-salida' || e.version !== 2 || !Array.isArray(e.unifiedSummaryData)) return false;
    setDiaCorte(e.diaCorte ?? '');
    setUnifiedSummaryData(e.unifiedSummaryData);
    setConsumoBloqueFormulado(e.consumoBloqueFormulado ?? []);
    setPlanCargadoDe(origen);
    setActiveTab('necesidad');
    return true;
  };

  const reporteFlujo1000 = useReportePlanTxt({
    modulo: 'formulacion',
    centro: '1000',
    fechaObjetivo: fechaObjetivoReporte,
    asunto: asuntoReporteFormulacion('1000'),
    construirHtml: () => construirReporteHtmlFormulacion('1000', fechaObjetivoReporte),
    etiqueta: 'Centro 1000',
    capturarEstado: capturarEstadoPlan,
    restaurarEstado: restaurarEstadoPlan,
  });
  const reporteFlujo2000 = useReportePlanTxt({
    modulo: 'formulacion',
    centro: '2000',
    fechaObjetivo: fechaObjetivoReporte,
    asunto: asuntoReporteFormulacion('2000'),
    construirHtml: () => construirReporteHtmlFormulacion('2000', fechaObjetivoReporte),
    etiqueta: 'Centro 2000',
  });
  // Los dos centros son el mismo reporte: un solo Guardar / Revisar / Enviar para ambos.
  const reporteGrupo = useReportePlanTxtGrupo([reporteFlujo1000, reporteFlujo2000]);
  // Solo el reporte del Centro 1000 lleva el respaldo del módulo (ver reporteFlujo1000).
  useAutoCargaPlanVigente({
    modulo: 'formulacion',
    centros: ['1000'],
    listo: mounted,
    hayDatos: () => datosCargados || syncStep !== 'idle' || !!leerDeCache<SnapshotFormulacion>(CACHE_FORMULACION),
    restaurar: restaurarEstadoPlan,
  });

  // Fase 2 del panel (igual que los otros 3 módulos): tras generar necesidades, guarda el reporte de
  // ambos centros (reemplaza el existente) y cierra con "Ver reporte y enviar". El envío sigue manual.
  useEffect(() => {
    if (!reportePorGuardar) return;
    setReportePorGuardar(false);
    void (async () => {
      panelProgreso.actualizar('rep', { estado: 'en_curso' });
      const oks: boolean[] = [];
      for (const f of reporteGrupo.flujos) oks.push(await f.guardar({ sinConfirmar: true, silencioso: true }));
      const ok = oks.some(Boolean);
      panelProgreso.actualizar('rep', ok
        ? { estado: oks.every(Boolean) ? 'ok' : 'aviso', detalle: `Reporte del ${fechaObjetivoReporte} guardado en la carpeta compartida${oks.every(Boolean) ? '' : ' (un centro falló, reintenta desde "Enviar Reporte")'} — todavía no se envió.` }
        : { estado: 'error', detalle: 'No se pudo guardar; reintenta desde "Enviar Reporte".' });
      panelProgreso.concluir(
        ok ? 'Necesidades y reporte guardados. Revisa y envía el reporte.' : undefined,
        ok ? [{ etiqueta: 'Ver reporte y enviar', onClick: () => { void reporteGrupo.recuperarTodos(fechaObjetivoReporte); } }] : [],
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

  // Evaluación de Stock (KG/UN) / En Curado (UN) / Stock Útil (UN) por material "BLOQUE
  // FORMULADO", con la misma base de conversión (TamLoteMin) que el Resumen e Inventarios — para
  // que Control Curado permita verificar esos tres números sin cambiar de tab.
  //
  // "En Curado" se calcula POR SEPARADO para Leader y Cofama (getStockEnCurado con spaceKey) — antes
  // se sumaban los dos procesos en una sola cifra, sin forma de saber de cuál venía cada Kg (el
  // usuario lo confirmó como el problema real: "materiales que se están mezclando con el proceso de
  // Leader y Cofama"). stockUtilUN sigue siendo un solo número (stock disponible real del material),
  // descontando el total en curado de ambos procesos combinados — eso sí debe ser uno solo, porque
  // es el mismo stock físico sin importar qué proceso lo está curando.
  const curadoStockEvaluation = useMemo(() => {
    return filteredInventario
      .map(inv => {
        const materialCode = cleanCode(inv.Material);
        const stockEnCuradoLeaderKg = getStockEnCurado(materialCode, 'leader');
        const stockEnCuradoCofamaKg = getStockEnCurado(materialCode, 'cofama');
        const stockEnCuradoKg = stockEnCuradoLeaderKg + stockEnCuradoCofamaKg;
        const stockEnCuradoLeaderUN = inv.loteMin > 0 ? stockEnCuradoLeaderKg / inv.loteMin : 0;
        const stockEnCuradoCofamaUN = inv.loteMin > 0 ? stockEnCuradoCofamaKg / inv.loteMin : 0;
        const stockEnCuradoUN = stockEnCuradoLeaderUN + stockEnCuradoCofamaUN;
        const stockUtilUN = Math.max(0, inv.stockUN - stockEnCuradoUN);
        const info = extractMaterialInfo(inv);
        return {
          materialCode,
          descripcion: inv.Descripcion || '—',
          apertura: info.apertura,
          dens: info.dens,
          loteMin: inv.loteMin,
          stockKg: inv.stockKg,
          stockUN: inv.stockUN,
          stockEnCuradoLeaderKg,
          stockEnCuradoCofamaKg,
          stockEnCuradoKg,
          stockEnCuradoLeaderUN,
          stockEnCuradoCofamaUN,
          stockEnCuradoUN,
          stockUtilUN
        };
      })
      .filter(r => r.stockKg > 0 || r.stockEnCuradoKg > 0)
      // Mismo orden Apertura -> Densidad que los espacios Leader/Cofama (ver CuradoSpaceTable),
      // para que los tres espacios de Control Curado se lean con el mismo criterio.
      .sort(compareAperturaDensidad);
  }, [filteredInventario, getStockEnCurado]);

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
        seguir('Tiempos de curado', serviciosService.getTiemposCuradoBloqueFormulado(1, 10000)).catch(() => ({ data: [] })),
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
      setDatosCargados(true);
    }
  }, [mounted]);


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
    return (
      <div className="rounded-2xl border border-gray-100 shadow-sm overflow-hidden bg-white text-left">
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
                return (
                  <React.Fragment key={code}>
                    <tr className="bg-slate-100">
                      <td className="px-4 py-2 text-left font-mono font-black text-indigo-600 border-r border-gray-100">{code}</td>
                      <td colSpan={7} className="px-4 py-2 text-left uppercase font-black text-slate-700 border-r border-gray-100">{group.nombreFormulado}</td>
                      <td colSpan={3} className="px-3 py-2 border-r border-gray-100 text-[9px] text-slate-500 whitespace-nowrap">Pend. {formatNum(kg(items, 'pendiente'), 1)} · Plan. {formatNum(kg(items, 'planificado'), 1)}</td>
                      <td className="px-4 py-2 bg-indigo-50 text-indigo-800 font-black">{formatNum(kg(items), 3)}</td>
                    </tr>
                    {Array.from(group.cortados.entries()).map(([componente, rows]) => (
                      <React.Fragment key={componente}>
                        {rows.map((row, idx) => (
                          <tr key={idx} className="hover:bg-slate-50 transition-colors font-mono text-[10px]">
                            <td className="px-4 py-1.5 border-r border-gray-100 text-slate-400 text-left">{row.codFormulado}</td>
                            <td className="px-4 py-1.5 border-r border-gray-100 text-left uppercase truncate max-w-[220px]">{idx === 0 ? row.nombreComponente : ''}</td>
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
                        <tr className="bg-emerald-50/60">
                          <td />
                          <td colSpan={columnas - 2} className="px-4 py-1.5 text-left uppercase font-black text-emerald-800">Total {rows[0].nombreComponente}</td>
                          <td className="px-4 py-1.5 font-black text-emerald-900">{formatNum(kg(rows), 3)}</td>
                        </tr>
                      </React.Fragment>
                    ))}
                  </React.Fragment>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    );
  };

  const renderSummaryTable = (data: FormuladoSummaryRow[], title: string, icon: React.ComponentType<{ className?: string }>) => {
    const tStockKg = data.reduce((s, r) => s + r.stockKg, 0);
    const tStockUn = data.reduce((s, r) => s + r.stockUN, 0);
    const tConsumoDiarioKg = data.reduce((s, r) => s + r.consumoDiarioKg, 0);
    // Cobertura de sección: ratio de totales (Stock Útil total en Kg ÷ Consumo/D total), no
    // promedio de las coberturas individuales — un promedio simple de días sesgaría hacia los
    // bloques con menos consumo, aunque representen poco stock real.
    const tStockUtilKg = data.reduce((s, r) => s + r.stockUtilUN * r.pesoBloque, 0);
    const tCoberturaActual = tConsumoDiarioKg > 0 ? tStockUtilKg / tConsumoDiarioKg : null;

    return (
      <div className="space-y-4">
        <div className="flex items-center justify-between px-2">
          <h3 className="text-sm font-black text-slate-800 uppercase tracking-widest flex items-center gap-2">
            {React.createElement(icon, { className: "w-4 h-4 text-indigo-600" })}
            {title}
          </h3>
          <div className="flex gap-4">
            <Badge variant="outline" className="text-[10px] font-black border-slate-200 bg-slate-50">T. STOCK: {formatNum(tStockKg, 0)} KG</Badge>
            <Badge variant="outline" className="text-[10px] font-black border-slate-200 bg-slate-50">T. UNIDADES: {Math.round(tStockUn)} UN</Badge>
          </div>
        </div>
        <div className="rounded-2xl border border-gray-100 shadow-sm overflow-hidden bg-white text-left">
          <div className="overflow-x-auto max-h-[500px]">
            <table className="w-full border-collapse text-center font-sans text-[10px] text-gray-700">
              <thead className="bg-gray-50 sticky top-0 text-[10px] font-bold uppercase text-gray-500 tracking-widest z-20">
                <tr>
                  <th className="px-6 py-4 text-left border-r border-gray-100 w-32">Bloque Formulado</th>
                  <th className="px-3 py-4 border-r border-gray-100 text-slate-500">Centro</th>
                  <th className="px-4 py-4 text-left border-r border-gray-100 text-indigo-700">Corrida</th>
                  <th className="px-6 py-4 text-left border-r border-gray-100">Descripción Técnica SAP</th>
                  <th className="px-3 py-4 border-r border-gray-100">Dens.</th>
                  <th className="px-3 py-4 border-r border-gray-100">Apert.</th>
                  <th className="px-4 py-4 border-r border-gray-100">Pendiente (Bloq)</th>
                  <th className="px-4 py-4 border-r border-gray-100">Planificado (Bloq)</th>
                  <th className="px-6 py-4 border-r border-gray-100 text-emerald-700 bg-emerald-50/50">Stock (Kg)</th>
                  <th className="px-4 py-4 border-r border-gray-100 text-emerald-700 bg-emerald-50/50 font-black">Stock (UN)</th>
                  <th className="px-4 py-4 border-r border-gray-100 text-amber-700 bg-amber-50/50">En Curado (UN)</th>
                  <th className="px-4 py-4 border-r border-gray-100 text-emerald-700 bg-emerald-50/50 font-black">Stock Útil (UN)</th>
                  <th className="px-4 py-4 border-r border-gray-100 text-cyan-700 bg-cyan-50/50 font-black">Consumo/D (Kg)</th>
                  <th className="px-4 py-4 border-r border-gray-100 text-rose-700 bg-rose-50/50 font-black">Cobertura Actual (Días)</th>
                  <th className="px-6 py-4 text-right bg-yellow-50/50 text-yellow-700 font-black">Plan Reposición (UN)</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50 font-bold">
                {data.map((row, idx) => {
                  // Clave compuesta con centro: el mismo blockCode puede aparecer dos veces (Quito y
                  // Guayaquil) desde que la agrupación se partió por centro — usar solo blockCode acá
                  // expandía/colapsaba ambas filas a la vez.
                  const groupKey = `${row.blockCode}|${row.centro}`;
                  const isExp = expandedGroups.has(groupKey);
                  // Cobertura Actual (días) = Stock Útil (convertido a Kg vía pesoBloque) ÷
                  // Consumo/D. Sin consumo reciente (0 Kg/día en los últimos 7 días) no hay con qué
                  // dividir — se muestra "—" en vez de un falso Infinity o un 0 que se leería como
                  // "sin cobertura" cuando en realidad es "sin dato para calcularla".
                  const coberturaActualDias = row.consumoDiarioKg > 0 ? (row.stockUtilUN * row.pesoBloque) / row.consumoDiarioKg : null;
                  return (
                    <React.Fragment key={idx}>
                      <tr className="hover:bg-slate-50 transition-colors cursor-pointer" onClick={() => { const n = new Set(expandedGroups); if (isExp) { n.delete(groupKey); } else { n.add(groupKey); } setExpandedGroups(n); }}>
                        <td className="px-6 py-3 text-left font-mono font-black text-indigo-600 border-r border-gray-100 flex items-center gap-2">
                           {isExp ? <Minus className="w-3 h-3" /> : <Plus className="w-3 h-3" />}
                           {row.blockCode}
                        </td>
                        <td className="px-3 py-3 border-r border-gray-100 font-black text-slate-500">{row.centro}</td>
                        <td className="px-4 py-3 text-left font-mono font-black text-indigo-700 bg-indigo-50/10 border-r border-gray-100 whitespace-nowrap">{row.corrida}</td>
                        <td className="px-6 py-3 text-left uppercase text-slate-900 font-black text-[10px] border-r border-gray-100 truncate max-w-[300px]">{row.blockDesc}</td>
                        <td className="px-3 py-3 border-r border-gray-100 font-mono text-slate-500">{row.dens}</td>
                        <td className="px-3 py-3 border-r border-gray-100 font-black text-blue-700 bg-blue-50/10">{row.apertura}</td>
                        <td className="px-4 py-3 border-r border-gray-100 font-mono font-black text-slate-700 bg-slate-50/10">{row.totalBloquesPendiente.toFixed(2)}</td>
                        <td className="px-4 py-3 border-r border-gray-100 font-mono font-black text-purple-700 bg-purple-50/10">{row.totalBloquesPlanificado.toFixed(2)}</td>
                        <td className="px-6 py-3 border-r border-gray-100 text-right font-mono font-black text-emerald-600 bg-emerald-50/10">{row.stockKg.toLocaleString(undefined, { maximumFractionDigits: 0 })}</td>
                        <td className="px-4 py-3 border-r border-gray-100 text-right font-mono font-black text-emerald-800 bg-emerald-50/20">{row.stockUN.toFixed(1)}</td>
                        <td className="px-4 py-3 border-r border-gray-100 text-right font-mono font-black text-amber-700 bg-amber-50/20">{row.stockEnCuradoUN.toFixed(1)}</td>
                        <td className="px-4 py-3 border-r border-gray-100 text-right font-mono font-black text-emerald-800 bg-emerald-50/30">{row.stockUtilUN.toFixed(1)}</td>
                        <td className="px-4 py-3 border-r border-gray-100 text-right font-mono font-black text-cyan-700 bg-cyan-50/20">{row.consumoDiarioKg.toFixed(1)}</td>
                        <td className="px-4 py-3 border-r border-gray-100 text-right font-mono font-black text-rose-700 bg-rose-50/20">{coberturaActualDias === null ? '—' : coberturaActualDias.toFixed(1)}</td>
                        <td className="px-6 py-3 text-right font-mono font-black text-yellow-700 bg-yellow-50/30">{row.planReposicion}</td>
                      </tr>
                      {isExp && row.ferts.map((f, fIdx: number) => (
                        <tr key={`${idx}-${fIdx}`} className="bg-slate-50/50 text-[10px] text-slate-500 font-medium">
                          <td className="px-6 py-1.5 text-left pl-10 italic">{f.code}</td>
                          <td></td>
                          <td></td>
                          <td className="px-6 py-1.5 text-left uppercase italic truncate max-w-[300px]">{f.desc}</td>
                          <td colSpan={2}></td>
                          <td className="px-4 py-1.5 font-mono">{f.origin === 'prov' ? f.bloques.toFixed(3) : '—'}</td>
                          <td className="px-4 py-1.5 font-mono">{f.origin === 'fert' ? f.bloques.toFixed(3) : '—'}</td>
                          <td colSpan={2}></td>
                          <td className="px-4 py-1.5 font-mono opacity-50">{f.kg.toLocaleString(undefined, { maximumFractionDigits: 1 })}</td>
                          <td colSpan={4}></td>
                        </tr>
                      ))}
                    </React.Fragment>
                  );
                })}
              </tbody>
              <tfoot className="bg-gray-100 text-gray-800 font-black text-[10px] uppercase border-t-2 border-gray-200 sticky bottom-0 z-20">
                <tr>
                  <td colSpan={8} className="px-6 py-4 text-right tracking-widest border-r border-gray-200">Totales de Sección</td>
                  <td className="px-6 py-4 border-r border-gray-200 font-mono text-emerald-700 bg-emerald-50">{formatNum(tStockKg, 0)}</td>
                  <td className="px-4 py-4 border-r border-gray-200 font-mono text-emerald-700 bg-emerald-50">{Math.round(tStockUn)}</td>
                  <td colSpan={2} className="px-6 py-4"></td>
                  <td className="px-4 py-4 border-r border-gray-200 font-mono text-cyan-700 bg-cyan-50">{formatNum(tConsumoDiarioKg, 1)}</td>
                  <td className="px-4 py-4 border-r border-gray-200 font-mono text-rose-700 bg-rose-50">{tCoberturaActual === null ? '—' : tCoberturaActual.toFixed(1)}</td>
                  <td className="px-6 py-4"></td>
                </tr>
              </tfoot>
            </table>
          </div>
        </div>
      </div>
    );
  };

  // Evaluación Stock (KG/UN) / En Curado (UN) / Stock Útil (UN) por material — misma base de
  // cálculo (TamLoteMin) que Inventarios y Resumen, disponible aquí para no tener que cambiar de
  // tab a la hora de verificar coherencia entre los tres números.
  const renderCuradoEvaluation = (data: typeof curadoStockEvaluation) => {
    const tStockKg = data.reduce((s, r) => s + r.stockKg, 0);
    const tStockUN = data.reduce((s, r) => s + r.stockUN, 0);
    const tEnCuradoLeaderUN = data.reduce((s, r) => s + r.stockEnCuradoLeaderUN, 0);
    const tEnCuradoCofamaUN = data.reduce((s, r) => s + r.stockEnCuradoCofamaUN, 0);
    const tUtilUN = data.reduce((s, r) => s + r.stockUtilUN, 0);

    return (
      <div className="space-y-2">
        <div className="px-2 flex items-center justify-between">
          <h4 className="text-[10px] font-black text-slate-500 uppercase tracking-widest" title="Stock (UN) = Stock (KG) ÷ Lote Mínimo · En Curado separado por proceso (Leader / Cofama)">Evaluación Stock / En Curado / Stock Útil por Material</h4>
        </div>
        <div className="rounded-2xl border border-gray-100 shadow-sm overflow-hidden bg-white text-left mb-8">
          <div className="overflow-x-auto max-h-[500px]">
            <table className="w-full border-collapse text-center font-sans text-[10px] text-gray-700">
              <thead className="bg-gray-50 sticky top-0 text-[10px] font-bold uppercase text-gray-500 tracking-widest z-10">
                <tr>
                  <th className="px-4 py-4 text-left border-r border-gray-100">Material</th>
                  <th className="px-6 py-4 text-left border-r border-gray-100">Descripción</th>
                  <th className="px-4 py-4 border-r border-gray-100">Lote Mín. (KG)</th>
                  <th className="px-4 py-4 border-r border-gray-100 text-emerald-700 bg-emerald-50/50">Stock (KG)</th>
                  <th className="px-4 py-4 border-r border-gray-100 text-emerald-700 bg-emerald-50/50 font-black">Stock (UN)</th>
                  <th className="px-4 py-4 border-r border-gray-100 text-amber-700 bg-amber-50/50">En Curado Leader (UN)</th>
                  <th className="px-4 py-4 border-r border-gray-100 text-orange-700 bg-orange-50/50">En Curado Cofama (UN)</th>
                  <th className="px-4 py-4 border-r border-gray-100 text-emerald-700 bg-emerald-50/50 font-black">Stock Útil (UN)</th>
                  <th className="px-4 py-4 text-teal-700 bg-teal-50/50" title="Promedio de CuradoAltura de los bloques de curado del material (mín–máx y cantidad en el tooltip)">Curado Altura (cm)</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50 font-bold">
                {data.length === 0 ? (
                  <tr><td colSpan={9} className="py-16 text-center text-slate-200 uppercase font-black">Sin stock de &quot;BLOQUE FORMULADO&quot; registrado</td></tr>
                ) : (
                  data.map((row, idx) => {
                    const prevApertura = idx > 0 ? data[idx - 1].apertura : null;
                    const nuevoGrupo = row.apertura !== prevApertura;
                    return (
                      <React.Fragment key={idx}>
                        {nuevoGrupo && (
                          <tr className="bg-indigo-50/60">
                            <td colSpan={9} className="px-4 py-2 text-left text-[10px] font-black uppercase tracking-widest text-indigo-700">
                              {aperturaGroupLabel(row.apertura)}
                            </td>
                          </tr>
                        )}
                        <tr className="hover:bg-slate-50 transition-colors">
                          <td className="px-4 py-3 text-left font-mono font-black text-indigo-600 border-r border-gray-100">{row.materialCode}</td>
                          <td className="px-6 py-3 text-left uppercase text-slate-700 border-r border-gray-100 truncate max-w-[280px]">{row.descripcion}</td>
                          <td className="px-4 py-3 border-r border-gray-100 font-mono text-slate-500">{row.loteMin > 0 ? formatNum(row.loteMin, 0) : '—'}</td>
                          <td className="px-4 py-3 border-r border-gray-100 font-mono font-black text-emerald-600 bg-emerald-50/10">{formatNum(row.stockKg, 0)}</td>
                          <td className="px-4 py-3 border-r border-gray-100 font-mono font-black text-emerald-800 bg-emerald-50/20">{row.stockUN.toFixed(1)}</td>
                          <td className="px-4 py-3 border-r border-gray-100 font-mono font-black text-amber-700 bg-amber-50/20">{row.stockEnCuradoLeaderUN.toFixed(1)}</td>
                          <td className="px-4 py-3 border-r border-gray-100 font-mono font-black text-orange-700 bg-orange-50/20">{row.stockEnCuradoCofamaUN.toFixed(1)}</td>
                          <td className="px-4 py-3 border-r border-gray-100 font-mono font-black text-emerald-800 bg-emerald-50/30">{row.stockUtilUN.toFixed(1)}</td>
                          {(() => {
                            const altura = alturaRealPorBloque.get(row.materialCode);
                            return (
                              <td className="px-4 py-3 font-mono font-black text-teal-800 bg-teal-50/20" title={altura ? `${altura.min.toFixed(1)}–${altura.max.toFixed(1)} cm · ${altura.n} bloque(s)` : 'Sin registros de curado con altura'}>
                                {altura ? (altura.suma / altura.n).toFixed(1) : '—'}
                              </td>
                            );
                          })()}
                        </tr>
                      </React.Fragment>
                    );
                  })
                )}
              </tbody>
              {data.length > 0 && (
                <tfoot className="bg-gray-100 text-gray-800 font-black text-[10px] uppercase border-t-2 border-gray-200 sticky bottom-0 z-10">
                  <tr>
                    <td colSpan={3} className="px-4 py-4 text-right tracking-widest border-r border-gray-200">Totales</td>
                    <td className="px-4 py-4 border-r border-gray-200 font-mono text-emerald-700 bg-emerald-50">{formatNum(tStockKg, 0)}</td>
                    <td className="px-4 py-4 border-r border-gray-200 font-mono text-emerald-700 bg-emerald-50">{tStockUN.toFixed(1)}</td>
                    <td className="px-4 py-4 border-r border-gray-200 font-mono text-amber-700 bg-amber-50">{tEnCuradoLeaderUN.toFixed(1)}</td>
                    <td className="px-4 py-4 border-r border-gray-200 font-mono text-orange-700 bg-orange-50">{tEnCuradoCofamaUN.toFixed(1)}</td>
                    <td className="px-4 py-4 border-r border-gray-200 font-mono text-emerald-700 bg-emerald-50">{tUtilUN.toFixed(1)}</td>
                    <td className="px-4 py-4 bg-teal-50" />
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
               {renderSummaryTable(summarySpaces.apertura, "Bloque Formulado — Apertura (194.5 / 206 / 219 / 228...)", TrendingUp)}
               {renderSummaryTable(summarySpaces.combinacion, "Bloque Formulado — Combinación (sin apertura técnica)", Box)}
             </>
           )}
        </div>
      );
      case 'consumo': return (
        <div className="animate-in fade-in duration-300 text-left">{renderConsumoHistorico()}</div>
      );
      case 'curado': return (
        <div className="animate-in fade-in duration-300 text-left space-y-4">
           {renderCuradoEvaluation(curadoStockEvaluation)}
           {CURADO_SPACES.map(space => (
             <CuradoSpaceTable key={space.key} data={curadoData} space={space} />
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
          <div className="overflow-x-auto rounded-2xl border border-gray-100 bg-white">
            <table className="w-full border-collapse text-[11px] text-center">
              <thead className="bg-gray-50 text-[10px] font-bold uppercase text-gray-500 tracking-widest">
                <tr>
                  <th className="px-4 py-2 text-left">Kg Bloque Formulado</th>
                  {(['1000', '2000', 'VE'] as const).map(dst => <th key={dst} className="px-4 py-2">{ETIQUETA_DESTINO[dst]}</th>)}
                  <th className="px-4 py-2 text-indigo-700">Total</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50 font-mono font-bold">
                {(['pendiente', 'planificado'] as const).map(tramo => (
                  <tr key={tramo}>
                    <td className={cn("px-4 py-2 text-left font-sans font-black uppercase", tramo === 'pendiente' ? 'text-amber-700' : 'text-emerald-700')}>{tramo}</td>
                    {(['1000', '2000', 'VE'] as const).map(dst => (
                      <td key={dst} className="px-4 py-2">
                        {formatNum(necesidadKg[dst][tramo], 1)}
                        {dst === '2000' && <span className="ml-1 font-sans text-[10px] text-amber-700">· {formatNum(subBloquesGye[tramo], 0)} sub-bloq.</span>}
                      </td>
                    ))}
                    <td className="px-4 py-2 text-indigo-800">{formatNum(necesidadKg['1000'][tramo] + necesidadKg['2000'][tramo] + necesidadKg.VE[tramo], 1)}</td>
                  </tr>
                ))}
                <tr className="bg-indigo-50/50 font-black">
                  <td className="px-4 py-2 text-left font-sans uppercase text-indigo-800">Total</td>
                  {(['1000', '2000', 'VE'] as const).map(dst => (
                    <td key={dst} className="px-4 py-2">
                      {formatNum(necesidadKg[dst].pendiente + necesidadKg[dst].planificado, 1)}
                      {dst === '2000' && <span className="ml-1 font-sans text-[10px] text-amber-700">· {formatNum(subBloquesGye.pendiente + subBloquesGye.planificado, 0)} sub-bloq.</span>}
                    </td>
                  ))}
                  <td className="px-4 py-2 text-indigo-900">{formatNum((['1000', '2000', 'VE'] as const).reduce((s, dst) => s + necesidadKg[dst].pendiente + necesidadKg[dst].planificado, 0), 1)}</td>
                </tr>
              </tbody>
            </table>
          </div>
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
                disabled={isProcessingResumen || unifiedSummaryData.length === 0}
                title="Guarda el Resumen (Plan de Reposición) por centro y envíalo por correo desde la vista previa"
                className="h-10 px-4 rounded-xl gap-2 font-black text-[10px] uppercase border-indigo-200 text-indigo-700 hover:bg-indigo-50"
              >
                <Mail className="w-4 h-4" /> Reporte
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-80 p-4 space-y-3" align="end">
              <div>
                <p className="text-xs font-black uppercase tracking-widest text-slate-700">Reporte de producción <span className="text-amber-600">(en desarrollo)</span></p>
              </div>
              <ReportePlanTxtAccionesGrupo grupo={reporteGrupo} />
            </PopoverContent>
          </Popover>
          <ReportePlanTxtVistaPreviaGrupo
            grupo={reporteGrupo}
            titulo="Formulación [Bloque Formulado]"
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
