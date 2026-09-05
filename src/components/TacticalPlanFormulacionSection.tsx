'use client';

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { 
  FlaskConical,
  Package,
  Loader2,
  LayoutDashboard,
  Calendar as CalendarIcon,
  ChevronLeft,
  ChevronRight,
  Database,
  RefreshCw,
  Minus,
  Plus,
  ShoppingCart,
  Box,
  TrendingUp,
  Table as TableIcon,
  Info
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
import { useRuntimeInspector } from '@/services/RuntimeInspector';
import { useAppContext } from '@/context/AppProvider';
import type { Grupo, Restriccion } from '@/types/interfaces';
import type { CuboInventariosItem } from '@/types/types';
import { cn } from '@/lib/utils';
import { guardarEnCache, leerDeCache, actualizarEnCache } from '@/lib/cache-modulos';
import { format, startOfMonth, endOfMonth, eachDayOfInterval, getDay, addMonths, subMonths } from 'date-fns';
import { es } from 'date-fns/locale';

const BLOCK_LENGTH_METERS = 20;
const CURADO_DIAS_ESPERA = 2; // tiempo de curado/espera desde fabricación hasta disponible para consumo

// Responsables de Control de Producción que consumen el recurso Formulación, por centro
const RESPONSABLES_POR_CENTRO: Record<string, string[]> = {
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
const fetchConsumoDiarioKg = async (material: string): Promise<number> => {
  try {
    const response = await serviciosService.getConsumosFormulado(material);
    const rows: RawApiRow[] = (response as { data?: RawApiRow[] })?.data || [];
    const hoy = new Date();
    hoy.setHours(0, 0, 0, 0);
    const hace7 = new Date(hoy);
    hace7.setDate(hace7.getDate() - 6);
    const netoKg = rows.reduce((sum, r) => {
      const mov = getProp(r, ['Movimiento', 'MOVIMIENTO']);
      if (mov !== '261' && mov !== '262') return sum;
      const fecha = parseFechaSAP(getProp(r, ['Fecha', 'FECHA']));
      if (!fecha || fecha < hace7 || fecha > hoy) return sum;
      return sum + safeNum(getProp(r, ['Cantidad', 'CANTIDAD']));
    }, 0);
    return Math.abs(netoKg) / 7;
  } catch {
    return 0;
  }
};

// Materiales de PRUEBA (ej. "BLOQUE FORMULADO PRUEBAS MQ COFAMA") — el usuario confirmó que tanto
// Leader como Cofama corren pruebas de máquina de vez en cuando, y esos bloques NO deben contarse
// como stock/curado real en ningún lado (ni en las tablas de detalle, ni en la Evaluación general,
// ni en el Resumen). Filtro amplio por "PRUEBA" (singular o plural) sobre la descripción/nombre —
// nomenclatura humana en SAP, no hay un flag dedicado para esto.
const esMaterialPrueba = (descripcion: string): boolean => /PRUEBA/i.test(descripcion);

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
        <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-widest px-2">{space.title} (0)</h4>
        <p className="text-[9px] font-bold text-slate-300 uppercase tracking-widest px-2">Filtro: {filterLabel}</p>
        <div className="py-10 text-center bg-gray-50/30 rounded-3xl border-2 border-dashed border-gray-100 mb-8">
          <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">
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

  return (
    <div className="space-y-2">
      <div className="px-2 flex items-baseline justify-between flex-wrap gap-2">
        <div className="flex items-center gap-2 flex-wrap">
          <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-widest">{space.title} ({filtered.length})</h4>
          <span className="text-[9px] font-black uppercase tracking-wider bg-emerald-50 text-emerald-700 rounded-full px-3 py-1">Disponible: {formatNum(unidadesDisponible, 1)} UN</span>
          <span className="text-[9px] font-black uppercase tracking-wider bg-amber-50 text-amber-700 rounded-full px-3 py-1">Pendiente Curado: {formatNum(unidadesPendiente, 1)} UN</span>
        </div>
        <p className="text-[9px] font-bold text-slate-300 uppercase tracking-widest">Filtro: {filterLabel}</p>
      </div>
      <div className="rounded-2xl border border-gray-100 shadow-sm overflow-hidden bg-white text-left mb-2">
        <div className="overflow-x-auto max-h-[500px]">
          <table className="w-full border-collapse text-center font-sans text-[10px] text-gray-700">
            <thead className="bg-gray-50 sticky top-0 text-[9px] font-bold uppercase text-gray-400 tracking-widest z-10">
              <tr>
                {COLUMNAS_CURADO.map((col, i) => (
                  <th key={i} className="px-4 py-4 border-r border-gray-100 whitespace-nowrap uppercase">
                    {col}
                  </th>
                ))}
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
                        <td colSpan={COLUMNAS_CURADO.length} className="px-4 py-2 text-left text-[9px] font-black uppercase tracking-widest text-indigo-700">
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
        <p className="text-[9px] font-bold text-slate-400 uppercase tracking-widest">
          Mostrando {(paginaActual - 1) * CURADO_PAGE_SIZE + 1}–{Math.min(paginaActual * CURADO_PAGE_SIZE, filtered.length)} de {filtered.length}
        </p>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" className="h-7 px-3 text-[9px] font-black uppercase rounded-xl" disabled={paginaActual <= 1} onClick={() => setPage(p => Math.max(1, p - 1))}>Anterior</Button>
          <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Página {paginaActual} / {totalPaginas}</span>
          <Button variant="outline" size="sm" className="h-7 px-3 text-[9px] font-black uppercase rounded-xl" disabled={paginaActual >= totalPaginas} onClick={() => setPage(p => Math.min(totalPaginas, p + 1))}>Siguiente</Button>
        </div>
      </div>
    </div>
  );
};

const isResponsableAllowed = (centro: string, resp: string): boolean => {
  const allowed = RESPONSABLES_POR_CENTRO[centro];
  return !!allowed && allowed.includes(resp);
};

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
// stock y plan de reposición, agrupado por apertura/densidad.
interface FormuladoSummaryRow {
  blockCode: string;
  blockDesc: string;
  corrida: string;
  dens: string;
  apertura: string;
  totalBloquesProv: number;
  totalBloquesFert: number;
  planReposicion: number;
  stockKg: number;
  stockUN: number;
  stockEnCuradoUN: number;
  stockUtilUN: number;
  pesoBloque: number;
  kgTotal: number;
  unidades: number;
  // Consumo diario promedio de los últimos 7 días corridos (ver fetchConsumoDiarioKg /
  // getConsumosFormulado) — Kg de movimiento 261 (salida a producción) neteado contra 262
  // (reversa de esa salida), sin incluir 101/102 (recepción de este mismo bloque, no es consumo).
  consumoDiarioKg: number;
  ferts: FormuladoFertEntry[];
}

// Recorre la explosión BOM (getMaestroMaterialesExplosion) de una orden y, por cada material
// "BLOQUE FORMULADO" encontrado, sube un nivel (MATERIAL_PADRE) para identificar el componente
// intermedio que lo consume, y otro nivel más para el componente final. CANTIDAD_ACUMULADA ya
// viene expresada por unidad de la orden, tal como se usa en el resto de trazas BOM de este módulo.
const traceBloqueFormuladoConsumption = (
  bomData: MaterialExplosionRow[],
  fertCode: string,
  ordenNum: string,
  origin: 'prov' | 'fert',
  centro: string,
  respCtrlProd: string
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
    const total = safeNum(formuladoRow.CANTIDAD_ACUMULADA || formuladoRow.CANTIDAD_UNITARIA || 0);

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
  ordenes: RawApiRow[];
  ordenesFert: RawApiRow[];
  cuboInventarios: CuboInventariosItem[];
  curadoData: RawApiRow[];
  unifiedSummaryData: FormuladoSummaryRow[];
  consumoBloqueFormulado: ConsumoBloqueRow[];
}

export const TacticalPlanFormulacionSection: React.FC = () => {
  const inspector = useRuntimeInspector('TacticalPlanFormulacion');
  useAppContext();

  const [mounted, setMounted] = useState(false);
  const [activeTab, setActiveTab] = useState('resumen');
  const [, setGrupos] = useState<Grupo[]>([]);
  const [, setRestricciones] = useState<Restriccion[]>([]);
  const [ordenes, setOrders] = useState<RawApiRow[]>([]);
  const [ordenesFert, setOrdersFert] = useState<RawApiRow[]>([]);
  const [cuboInventarios, setCuboInventarios] = useState<CuboInventariosItem[]>([]);
  const [curadoData, setCuradoData] = useState<RawApiRow[]>([]);
  // El módulo YA NO sincroniza solo al abrirse — mismo criterio que Corte Espuma/Venta Externa/
  // Laminado (ver [[carga_manual_modulos_tacticos]], antes marcado como pendiente para este módulo).
  const [isLoading, setIsLoading] = useState(false);
  const [datosCargados, setDatosCargados] = useState(false);
  // "Sincronizar" y "Generar Necesidades" (2 clics separados) se combinan en 1 — el usuario lo pidió
  // por ser repetitivo en el uso diario, mismo patrón ya aplicado en Corte Espuma/Venta Externa/
  // Laminado (ver [[modulos_tacticos_sincronizar_y_generar_combinado]]).
  const [autoGenerarPendiente, setAutoGenerarPendiente] = useState(false);
  const [syncStep, setSyncStep] = useState<'idle' | 'sincronizando' | 'generando'>('idle');

  const [isProcessingResumen, setIsProcessingResumen] = useState(false);
  const [resumenProgress, setResumenProgress] = useState({ current: 0, total: 0 });
  const [unifiedSummaryData, setUnifiedSummaryData] = useState<FormuladoSummaryRow[]>([]);
  const [consumoBloqueFormulado, setConsumoBloqueFormulado] = useState<ConsumoBloqueRow[]>([]);

  const [selectedDates, setSelectedDates] = useState<Set<string>>(new Set());
  const [viewDate, setViewDate] = useState(new Date());
  const [expandedGroups, setExpandedGroups] = useState<Set<string>>(new Set());

  useEffect(() => {
    setMounted(true);
    const today = new Date();
    setViewDate(today);
    setSelectedDates(new Set([format(today, 'yyyy-MM-dd')]));
  }, []);


  // Base por centro y fecha (1000 = UIO, 2000 = GYE). El filtro por responsable de Control de
  // Producción (RESPONSABLES_POR_CENTRO) se aplica más abajo, en handleProcessResumen, antes de
  // acumular necesidades — el Resumen ya NO considera la necesidad global de todos los
  // responsables, solo la de quienes controlan el recurso Formulación.
  const provFiltradas = useMemo(() => {
    return ordenes.filter(o => {
      const centro = getProp(o, ['CENTRO', 'Centro']).trim();
      if (centro && !['1000', '2000'].includes(centro)) return false;
      const itemDateFull = getProp(o, ['FECHAINICIO', 'FECHA']).trim();
      const itemDate = itemDateFull.includes('T') ? itemDateFull.split('T')[0] : itemDateFull;
      return selectedDates.size === 0 || selectedDates.has(itemDate);
    });
  }, [ordenes, selectedDates]);

  const prodFiltradas = useMemo(() => {
    return ordenesFert.filter(o => {
      const centro = getProp(o, ['CENTRO', 'Centro']).trim();
      if (centro && !['1000', '2000'].includes(centro)) return false;
      const itemDateFull = getProp(o, ['FECHA', 'FECHAINICIO', 'FECHA_INICIO']).trim();
      const itemDate = itemDateFull.includes('T') ? itemDateFull.split('T')[0] : itemDateFull;
      return selectedDates.size === 0 || selectedDates.has(itemDate);
    });
  }, [ordenesFert, selectedDates]);

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

  // Necesidad neta = (necesidad de órdenes provisionales por fecha + necesidad en proceso de
  // órdenes FERT) − stock disponible (stock SAP menos lo que aún está en curado). El plan de
  // reposición solo cubre el faltante, no la necesidad bruta. Solo se acumulan órdenes cuyo
  // responsable de Control de Producción está autorizado para el centro (RESPONSABLES_POR_CENTRO)
  // — una orden de un responsable no listado no debe inflar la necesidad de Formulación.
  const handleProcessResumen = useCallback(async () => {
    const buildEntry = (o: RawApiRow, origin: 'prov' | 'fert') => ({
      order: o,
      origin,
      centro: getProp(o, ['CENTRO', 'Centro']).trim(),
      resp: getProp(o, ['RESPCTRLPROD', 'RESPCONTROLPROD', 'RESP_CONTROL_PROD', 'RESPONSABLE']).trim()
    });
    const allOrders = [
      ...provFiltradas.map(o => buildEntry(o, 'prov' as const)),
      ...prodFiltradas.map(o => buildEntry(o, 'fert' as const))
    ].filter(e => isResponsableAllowed(e.centro, e.resp));
    if (allOrders.length === 0) {
      setUnifiedSummaryData([]);
      setConsumoBloqueFormulado([]);
      return;
    }
    setIsProcessingResumen(true);
    const groupsMap = new Map<string, FormuladoSummaryRow>();
    const consumoRows: ConsumoBloqueRow[] = [];
    // Consumo/D se pide UNA vez por Bloque Formulado (no por orden): varias órdenes distintas
    // pueden trazar al mismo blockCode, y getConsumosFormulado ya trae todo el histórico de ese
    // material en una sola llamada — repetirla por orden sería puro desperdicio.
    const consumoDiarioCache = new Map<string, number>();
    setResumenProgress({ current: 0, total: allOrders.length });

    for (let i = 0; i < allOrders.length; i++) {
      const { order: o, origin, centro: centroOrden, resp: respOrden } = allOrders[i];
      const info = extractMaterialInfo(o);
      const qty = safeNum(getProp(o, ['CANTPEND', 'CANTPENDIENTE', 'CANTPROGRAMADA', 'CANTIDAD', 'CANT_PROG']));
      const anchoVal = parseFloat(info.ancho) || 0;
      const espVal = parseFloat(info.esp) || 0;
      const densVal = parseFloat(String(info.dens)) || 0;
      const usefulHeight = (densVal < 30) ? 103 : 85;
      const itemBloques = (usefulHeight * BLOCK_LENGTH_METERS * 100) > 0
        ? (qty * espVal * anchoVal) / (usefulHeight * BLOCK_LENGTH_METERS * 100)
        : 0;
      const itemKg = (anchoVal * 200 * espVal * densVal * qty) / 10000;
      const ordenNum = getProp(o, ['ORDENPREVISIONAL', 'ORDEN', 'ORDEN_PROCESO']) || '—';

      let blockCode = '—';
      let blockDesc = '—';
      try {
        const bomResponse = await serviciosService.getMaestroMaterialesExplosion("1000", info.code.padStart(18, '0'), 1, 100);
        const bomData = bomResponse?.data?.data || bomResponse?.data || [];
        if (Array.isArray(bomData)) {
          const blockComp = bomData.find(row => (row.DESCRIPCION_COMPONENTE || '').toUpperCase().includes('BLOQUE FORMULADO'));
          if (blockComp) {
            blockCode = cleanCode(blockComp.COMPONENTE);
            blockDesc = String(blockComp.DESCRIPCION_COMPONENTE).toUpperCase();
          }
          consumoRows.push(...traceBloqueFormuladoConsumption(bomData, info.code, ordenNum, origin, centroOrden, respOrden));
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

      // "Salida de Datos" (unifiedSummaryData) SOLO debe reflejar Bloque Formulado real — el usuario
      // confirmó que ese tab toma sus datos de "Consumo de Bloque Formulado por Componente" (arriba),
      // no de los materiales auto-referenciados. Antes esta sección corría igual con blockCode='—',
      // agrupando materiales como "LAMINA PRENSADA"/"TACO PRENSADO" bajo su propia apertura/densidad
      // como si fueran un bloque — verificado en vivo: aparecían mezclados en la sección "Combinación
      // (sin apertura técnica)" con un Stock/Plan Reposición calculado con la física de bloque
      // (pesoBloque), que no les aplica. Ahora solo entran los materiales con blockCode real.
      if (blockCode !== '—') {
        const key = `${blockCode}|${info.apertura}|${densVal}`;
        if (!groupsMap.has(key)) {
          const invRows = cuboInventarios.filter(inv => cleanCode(inv.Material) === blockCode);
          const stockKg = invRows.reduce((sum, item) => sum + safeNum(item.StockActual), 0);
          const corrida = extraerCorridaCategoria(invRows[0]?.Categoria || '');
          const pesoBloque = (100 * usefulHeight * BLOCK_LENGTH_METERS * densVal) / 10000;
          const stockUN = pesoBloque > 0 ? stockKg / pesoBloque : 0;
          const stockEnCuradoKg = getStockEnCurado(blockCode);
          const stockEnCuradoUN = pesoBloque > 0 ? stockEnCuradoKg / pesoBloque : 0;
          const stockUtilUN = Math.max(0, stockUN - stockEnCuradoUN);
          if (!consumoDiarioCache.has(blockCode)) {
            consumoDiarioCache.set(blockCode, await fetchConsumoDiarioKg(blockCode));
          }
          const consumoDiarioKg = consumoDiarioCache.get(blockCode) ?? 0;
          groupsMap.set(key, {
            blockCode, blockDesc: blockDesc !== '—' ? blockDesc : info.desc, corrida,
            dens: info.dens, apertura: info.apertura,
            totalBloquesProv: 0, totalBloquesFert: 0, planReposicion: 0,
            stockKg, stockUN, stockEnCuradoUN, stockUtilUN, pesoBloque,
            kgTotal: 0, unidades: 0, consumoDiarioKg,
            ferts: []
          });
        }
        const entry = groupsMap.get(key)!;
        if (origin === 'prov') {
          entry.totalBloquesProv += itemBloques;
        } else {
          entry.totalBloquesFert += itemBloques;
        }
        entry.kgTotal += itemKg;
        entry.unidades += qty;
        entry.planReposicion = Math.max(0, Math.ceil(entry.totalBloquesProv + entry.totalBloquesFert - entry.stockUtilUN));
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
      aperturaSortIndex(a.apertura) - aperturaSortIndex(b.apertura) || a.corrida.localeCompare(b.corrida)
    );
    setUnifiedSummaryData(summaryOrdenado);
    setConsumoBloqueFormulado(consumoRows);
    // Mantiene el snapshot en sync — si el usuario navega a otro módulo y vuelve, el tab Resumen ya
    // no aparece vacío (ver SnapshotFormulacion). No-op si todavía no se sincronizó ningún dato base
    // (actualizarEnCache no escribe sobre un snapshot inexistente).
    actualizarEnCache<SnapshotFormulacion>(CACHE_FORMULACION, {
      unifiedSummaryData: summaryOrdenado,
      consumoBloqueFormulado: consumoRows,
    });
    setIsProcessingResumen(false);
  }, [provFiltradas, prodFiltradas, cuboInventarios, getStockEnCurado]);

  // Segunda fase de "Sincronizar y Generar Necesidades" (ver handleSincronizarYGenerar): corre
  // handleProcessResumen automáticamente en cuanto el render con los datos recién sincronizados ya
  // ocurrió — acá arriba, handleProcessResumen ya es la versión fresca (provFiltradas/prodFiltradas
  // ya se recalcularon). Antes era un botón manual separado ("Generar Necesidades"); el usuario pidió
  // combinarlo con Sincronizar por ser repetitivo en el uso diario.
  useEffect(() => {
    if (!autoGenerarPendiente) return;
    setAutoGenerarPendiente(false);
    setSyncStep('generando');
    handleProcessResumen().finally(() => setSyncStep('idle'));
  }, [autoGenerarPendiente, handleProcessResumen]);

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

  // Consumo trazado (COD_FORMULADO -> intermedio -> componente final), acotado por los
  // responsables de control de producción que corresponden a cada centro — este es el
  // contenido de las pestañas "Provisionales" y "FERT".
  const provConsumoResponsable = useMemo(
    () => consumoBloqueFormulado.filter(r => r.origin === 'prov' && isResponsableAllowed(r.centro, r.respCtrlProd)),
    [consumoBloqueFormulado]
  );
  const fertConsumoResponsable = useMemo(
    () => consumoBloqueFormulado.filter(r => r.origin === 'fert' && isResponsableAllowed(r.centro, r.respCtrlProd)),
    [consumoBloqueFormulado]
  );

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

  const handleSincronizarYGenerar = useCallback(async () => {
    setIsLoading(true);
    setSyncStep('sincronizando');
    try {
      const groupsRes = await grupoService.getAll();
      const filteredGroups = (groupsRes.data || []).filter(g => {
        const name = (g.nombre_grupo || '').toLowerCase();
        return name.includes('formulación') || name.includes('espuma');
      });
      setGrupos(filteredGroups);
      const groupsIds = filteredGroups.map(g => g.codigo_grupo);
      const [restrsRes, provsRes, curadoRes, fertsRes, cuboRes] = await Promise.all([
        restriccionService.getAll(),
        serviciosService.OrdenesProvisionalesPaginados(1, 20000).catch(() => ({ data: [] })),
        serviciosService.getTiemposCuradoBloqueFormulado(1, 10000).catch(() => ({ data: [] })),
        serviciosService.getOrdenesFert(1, 20000).catch(() => ({ data: [] })),
        serviciosService.getCuboInventarios(1, 50000).catch(() => ({ data: [] }))
      ]);
      setRestricciones((restrsRes.data || []).filter((r) => groupsIds.includes(r.codigo_grupo)));
      setOrders(provsRes.data?.data || provsRes.data || []);
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
        ordenes: provsRes.data?.data || provsRes.data || [],
        ordenesFert: fertsRes.data?.data || fertsRes.data || [],
        cuboInventarios: Array.isArray(cuboRes.data) ? cuboRes.data : [],
        curadoData: rawCurado,
        unifiedSummaryData: previo?.unifiedSummaryData || [],
        consumoBloqueFormulado: previo?.consumoBloqueFormulado || [],
      });
      // No se llama handleProcessResumen() directo acá: leería provFiltradas/prodFiltradas (useMemo
      // derivados del estado que se acaba de actualizar arriba) por closure vieja. Se dispara desde
      // el efecto de más abajo, que ve la versión fresca una vez que el siguiente render ya ocurrió
      // (mismo criterio que Corte Espuma/Venta Externa/Laminado).
      setAutoGenerarPendiente(true);
    } catch {
      console.error('Error sincronizando datos formulacion');
      setSyncStep('idle');
    } finally {
      setIsLoading(false);
    }
  }, []);

  // Rehidratación: si ya se había sincronizado en esta sesión, se recupera lo trabajado (datos crudos
  // Y el resumen ya procesado) en vez de dejar el módulo vacío al volver de otro módulo — mismo
  // criterio que Corte Espuma/Venta Externa/Laminado (ver [[persistencia_resumen_procesado_gap]]).
  useEffect(() => {
    if (!mounted) return;
    const snap = leerDeCache<SnapshotFormulacion>(CACHE_FORMULACION);
    if (snap) {
      setOrders(snap.ordenes);
      setOrdersFert(snap.ordenesFert);
      setCuboInventarios(snap.cuboInventarios);
      setCuradoData(snap.curadoData);
      setUnifiedSummaryData(snap.unifiedSummaryData || []);
      setConsumoBloqueFormulado(snap.consumoBloqueFormulado || []);
      setDatosCargados(true);
    }
  }, [mounted]);

  const calendarDaysList = useMemo(() => {
    const start = startOfMonth(viewDate);
    const end = endOfMonth(viewDate);
    const days = eachDayOfInterval({ start, end });
    const startDay = getDay(start);
    const padding = startDay === 0 ? 6 : startDay - 1;
    return [...Array(padding).fill(null), ...days];
  }, [viewDate]);

  // Resumen compacto de trazabilidad: qué componentes finales (ej. láminas) consumen cada
  // Bloque Formulado, a través del nivel intermedio (bloque cortado), por orden.
  const renderConsumoBloqueTable = (data: ConsumoBloqueRow[], title: string = "Consumo de Bloque Formulado por Componente (Trazabilidad)") => {
    const grouped: Record<string, { nombreFormulado: string; items: ConsumoBloqueRow[] }> = {};
    data.forEach(row => {
      if (!grouped[row.codFormulado]) grouped[row.codFormulado] = { nombreFormulado: row.nombreFormulado, items: [] };
      grouped[row.codFormulado].items.push(row);
    });
    const codes = Object.keys(grouped).sort();
    const total = data.reduce((s, r) => s + r.total, 0);

    return (
      <div className="space-y-4">
        <div className="flex items-center justify-between px-2">
          <h3 className="text-sm font-black text-slate-800 uppercase tracking-widest flex items-center gap-2">
            <FlaskConical className="w-4 h-4 text-indigo-600" />
            {title}
          </h3>
          <Badge variant="outline" className="text-[10px] font-black border-slate-200 bg-slate-50">T. CONSUMO: {formatNum(total, 1)}</Badge>
        </div>
        <div className="rounded-2xl border border-gray-100 shadow-sm overflow-hidden bg-white text-left">
          <div className="overflow-x-auto max-h-[500px]">
            <table className="w-full border-collapse text-center font-sans text-[10px] text-gray-700">
              <thead className="bg-gray-50 sticky top-0 text-[9px] font-bold uppercase text-gray-400 tracking-widest z-20">
                <tr>
                  <th className="px-4 py-4 text-left border-r border-gray-100">FORMULADO</th>
                  <th className="px-6 py-4 text-left border-r border-gray-100">NOMBRECOMPONENTE</th>
                  <th className="px-4 py-4 border-r border-gray-100">COMPONENTE</th>
                  <th className="px-6 py-4 text-left border-r border-gray-100">NOMBRE</th>
                  <th className="px-4 py-4 border-r border-gray-100">MATERIAL</th>
                  <th className="px-4 py-4 border-r border-gray-100">ORDEN</th>
                  <th className="px-3 py-4 border-r border-gray-100">UN</th>
                  <th className="px-4 py-4 bg-indigo-50 text-indigo-700 font-black">Total</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50 font-bold">
                {codes.length === 0 ? (
                  <tr><td colSpan={8} className="py-20 text-center text-slate-200 uppercase font-black">Sin consumo de Bloque Formulado detectado</td></tr>
                ) : (
                  codes.map(code => {
                    const group = grouped[code];
                    const subtotal = group.items.reduce((s, r) => s + r.total, 0);
                    return (
                      <React.Fragment key={code}>
                        <tr className="bg-slate-50">
                          <td className="px-4 py-2 text-left font-mono font-black text-indigo-600 border-r border-gray-100">{code}</td>
                          <td colSpan={5} className="px-6 py-2 text-left uppercase font-black text-slate-700 border-r border-gray-100 truncate max-w-[300px]">{group.nombreFormulado}</td>
                          <td className="px-3 py-2 border-r border-gray-100 opacity-40 uppercase">Subtotal</td>
                          <td className="px-4 py-2 bg-indigo-50 text-indigo-800 font-black">{formatNum(subtotal, 1)}</td>
                        </tr>
                        {group.items.map((row, idx) => (
                          <tr key={idx} className="hover:bg-slate-50 transition-colors font-mono text-[9px]">
                            <td className="px-4 py-2 border-r border-gray-100 text-slate-300 pl-8 text-left">{row.codFormulado}</td>
                            <td className="px-6 py-2 border-r border-gray-100 text-left uppercase truncate max-w-[220px]">{row.nombreComponente}</td>
                            <td className="px-4 py-2 border-r border-gray-100 text-indigo-600 font-black">{row.componente}</td>
                            <td className="px-6 py-2 border-r border-gray-100 text-left uppercase truncate max-w-[220px]">{row.nombre}</td>
                            <td className="px-4 py-2 border-r border-gray-100 text-slate-500">{row.material}</td>
                            <td className="px-4 py-2 border-r border-gray-100 text-slate-500">{row.orden}</td>
                            <td className="px-3 py-2 border-r border-gray-100 uppercase">{row.un}</td>
                            <td className="px-4 py-2 font-black text-slate-900">{formatNum(row.total, 3)}</td>
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
              <thead className="bg-gray-50 sticky top-0 text-[9px] font-bold uppercase text-gray-400 tracking-widest z-20">
                <tr>
                  <th className="px-6 py-4 text-left border-r border-gray-100 w-32">Bloque Formulado</th>
                  <th className="px-4 py-4 text-left border-r border-gray-100 text-indigo-700">Corrida</th>
                  <th className="px-6 py-4 text-left border-r border-gray-100">Descripción Técnica SAP</th>
                  <th className="px-3 py-4 border-r border-gray-100">Dens.</th>
                  <th className="px-3 py-4 border-r border-gray-100">Apert.</th>
                  <th className="px-4 py-4 border-r border-gray-100">Nec. Prov (Bloq)</th>
                  <th className="px-4 py-4 border-r border-gray-100">Nec. Proceso/FERT (Bloq)</th>
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
                  const isExp = expandedGroups.has(row.blockCode);
                  // Cobertura Actual (días) = Stock Útil (convertido a Kg vía pesoBloque) ÷
                  // Consumo/D. Sin consumo reciente (0 Kg/día en los últimos 7 días) no hay con qué
                  // dividir — se muestra "—" en vez de un falso Infinity o un 0 que se leería como
                  // "sin cobertura" cuando en realidad es "sin dato para calcularla".
                  const coberturaActualDias = row.consumoDiarioKg > 0 ? (row.stockUtilUN * row.pesoBloque) / row.consumoDiarioKg : null;
                  return (
                    <React.Fragment key={idx}>
                      <tr className="hover:bg-slate-50 transition-colors cursor-pointer" onClick={() => { const n = new Set(expandedGroups); if (isExp) { n.delete(row.blockCode); } else { n.add(row.blockCode); } setExpandedGroups(n); }}>
                        <td className="px-6 py-3 text-left font-mono font-black text-indigo-600 border-r border-gray-100 flex items-center gap-2">
                           {isExp ? <Minus className="w-3 h-3" /> : <Plus className="w-3 h-3" />}
                           {row.blockCode}
                        </td>
                        <td className="px-4 py-3 text-left font-mono font-black text-indigo-700 bg-indigo-50/10 border-r border-gray-100 whitespace-nowrap">{row.corrida}</td>
                        <td className="px-6 py-3 text-left uppercase text-slate-900 font-black text-[9px] border-r border-gray-100 truncate max-w-[300px]">{row.blockDesc}</td>
                        <td className="px-3 py-3 border-r border-gray-100 font-mono text-slate-400">{row.dens}</td>
                        <td className="px-3 py-3 border-r border-gray-100 font-black text-blue-700 bg-blue-50/10">{row.apertura}</td>
                        <td className="px-4 py-3 border-r border-gray-100 font-mono font-black text-slate-700 bg-slate-50/10">{row.totalBloquesProv.toFixed(2)}</td>
                        <td className="px-4 py-3 border-r border-gray-100 font-mono font-black text-purple-700 bg-purple-50/10">{row.totalBloquesFert.toFixed(2)}</td>
                        <td className="px-6 py-3 border-r border-gray-100 text-right font-mono font-black text-emerald-600 bg-emerald-50/10">{row.stockKg.toLocaleString(undefined, { maximumFractionDigits: 0 })}</td>
                        <td className="px-4 py-3 border-r border-gray-100 text-right font-mono font-black text-emerald-800 bg-emerald-50/20">{row.stockUN.toFixed(1)}</td>
                        <td className="px-4 py-3 border-r border-gray-100 text-right font-mono font-black text-amber-700 bg-amber-50/20">{row.stockEnCuradoUN.toFixed(1)}</td>
                        <td className="px-4 py-3 border-r border-gray-100 text-right font-mono font-black text-emerald-800 bg-emerald-50/30">{row.stockUtilUN.toFixed(1)}</td>
                        <td className="px-4 py-3 border-r border-gray-100 text-right font-mono font-black text-cyan-700 bg-cyan-50/20">{row.consumoDiarioKg.toFixed(1)}</td>
                        <td className="px-4 py-3 border-r border-gray-100 text-right font-mono font-black text-rose-700 bg-rose-50/20">{coberturaActualDias === null ? '—' : coberturaActualDias.toFixed(1)}</td>
                        <td className="px-6 py-3 text-right font-mono font-black text-yellow-700 bg-yellow-50/30">{row.planReposicion}</td>
                      </tr>
                      {isExp && row.ferts.map((f, fIdx: number) => (
                        <tr key={`${idx}-${fIdx}`} className="bg-slate-50/50 text-[9px] text-slate-400 font-medium">
                          <td className="px-6 py-1.5 text-left pl-10 italic">{f.code}</td>
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
              <tfoot className="bg-gray-100 text-gray-800 font-black text-[9px] uppercase border-t-2 border-gray-200 sticky bottom-0 z-20">
                <tr>
                  <td colSpan={7} className="px-6 py-4 text-right tracking-widest border-r border-gray-200">Totales de Sección</td>
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
          <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Evaluación Stock / En Curado / Stock Útil por Material</h4>
          <p className="text-[9px] font-bold text-slate-300 uppercase tracking-widest">Stock (UN) = Stock (KG) ÷ Lote Mínimo (igual que Inventarios) · En Curado separado por proceso (Leader / Cofama), no combinado</p>
        </div>
        <div className="rounded-2xl border border-gray-100 shadow-sm overflow-hidden bg-white text-left mb-8">
          <div className="overflow-x-auto max-h-[500px]">
            <table className="w-full border-collapse text-center font-sans text-[10px] text-gray-700">
              <thead className="bg-gray-50 sticky top-0 text-[9px] font-bold uppercase text-gray-400 tracking-widest z-10">
                <tr>
                  <th className="px-4 py-4 text-left border-r border-gray-100">Material</th>
                  <th className="px-6 py-4 text-left border-r border-gray-100">Descripción</th>
                  <th className="px-4 py-4 border-r border-gray-100">Lote Mín. (KG)</th>
                  <th className="px-4 py-4 border-r border-gray-100 text-emerald-700 bg-emerald-50/50">Stock (KG)</th>
                  <th className="px-4 py-4 border-r border-gray-100 text-emerald-700 bg-emerald-50/50 font-black">Stock (UN)</th>
                  <th className="px-4 py-4 border-r border-gray-100 text-amber-700 bg-amber-50/50">En Curado Leader (UN)</th>
                  <th className="px-4 py-4 border-r border-gray-100 text-orange-700 bg-orange-50/50">En Curado Cofama (UN)</th>
                  <th className="px-4 py-4 text-emerald-700 bg-emerald-50/50 font-black">Stock Útil (UN)</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50 font-bold">
                {data.length === 0 ? (
                  <tr><td colSpan={8} className="py-16 text-center text-slate-200 uppercase font-black">Sin stock de &quot;BLOQUE FORMULADO&quot; registrado</td></tr>
                ) : (
                  data.map((row, idx) => {
                    const prevApertura = idx > 0 ? data[idx - 1].apertura : null;
                    const nuevoGrupo = row.apertura !== prevApertura;
                    return (
                      <React.Fragment key={idx}>
                        {nuevoGrupo && (
                          <tr className="bg-indigo-50/60">
                            <td colSpan={8} className="px-4 py-2 text-left text-[9px] font-black uppercase tracking-widest text-indigo-700">
                              {aperturaGroupLabel(row.apertura)}
                            </td>
                          </tr>
                        )}
                        <tr className="hover:bg-slate-50 transition-colors">
                          <td className="px-4 py-3 text-left font-mono font-black text-indigo-600 border-r border-gray-100">{row.materialCode}</td>
                          <td className="px-6 py-3 text-left uppercase text-slate-700 border-r border-gray-100 truncate max-w-[280px]">{row.descripcion}</td>
                          <td className="px-4 py-3 border-r border-gray-100 font-mono text-slate-400">{row.loteMin > 0 ? formatNum(row.loteMin, 0) : '—'}</td>
                          <td className="px-4 py-3 border-r border-gray-100 font-mono font-black text-emerald-600 bg-emerald-50/10">{formatNum(row.stockKg, 0)}</td>
                          <td className="px-4 py-3 border-r border-gray-100 font-mono font-black text-emerald-800 bg-emerald-50/20">{row.stockUN.toFixed(1)}</td>
                          <td className="px-4 py-3 border-r border-gray-100 font-mono font-black text-amber-700 bg-amber-50/20">{row.stockEnCuradoLeaderUN.toFixed(1)}</td>
                          <td className="px-4 py-3 border-r border-gray-100 font-mono font-black text-orange-700 bg-orange-50/20">{row.stockEnCuradoCofamaUN.toFixed(1)}</td>
                          <td className="px-4 py-3 font-mono font-black text-emerald-800 bg-emerald-50/30">{row.stockUtilUN.toFixed(1)}</td>
                        </tr>
                      </React.Fragment>
                    );
                  })
                )}
              </tbody>
              {data.length > 0 && (
                <tfoot className="bg-gray-100 text-gray-800 font-black text-[9px] uppercase border-t-2 border-gray-200 sticky bottom-0 z-10">
                  <tr>
                    <td colSpan={3} className="px-4 py-4 text-right tracking-widest border-r border-gray-200">Totales</td>
                    <td className="px-4 py-4 border-r border-gray-200 font-mono text-emerald-700 bg-emerald-50">{formatNum(tStockKg, 0)}</td>
                    <td className="px-4 py-4 border-r border-gray-200 font-mono text-emerald-700 bg-emerald-50">{tStockUN.toFixed(1)}</td>
                    <td className="px-4 py-4 border-r border-gray-200 font-mono text-amber-700 bg-amber-50">{tEnCuradoLeaderUN.toFixed(1)}</td>
                    <td className="px-4 py-4 border-r border-gray-200 font-mono text-orange-700 bg-orange-50">{tEnCuradoCofamaUN.toFixed(1)}</td>
                    <td className="px-4 py-4 font-mono text-emerald-700 bg-emerald-50">{tUtilUN.toFixed(1)}</td>
                  </tr>
                </tfoot>
              )}
            </table>
          </div>
        </div>
      </div>
    );
  };

  const renderContent = () => {
    if (isLoading) {
      return (
        <div className="flex flex-col items-center justify-center p-20 gap-4">
          <Loader2 className="w-10 h-10 animate-spin text-primary" />
          <p className="text-xs font-bold text-gray-400 uppercase tracking-widest animate-pulse">Sincronizando SAP...</p>
        </div>
      );
    }

    switch (activeTab) {
      case 'resumen': return (
        <div className="space-y-12 animate-in fade-in duration-300">
           {isProcessingResumen ? (
             <div className="py-32 text-center">
                <Loader2 className="w-12 h-12 animate-spin mx-auto text-primary mb-6" />
                <p className="text-[11px] font-black uppercase text-slate-400 tracking-widest">Ejecutando Explosión Técnica BOM: {resumenProgress.current} / {resumenProgress.total}</p>
             </div>
           ) : (
             <>
               {renderSummaryTable(summarySpaces.apertura, "Bloque Formulado — Apertura (194.5 / 206 / 219 / 228...)", TrendingUp)}
               {renderSummaryTable(summarySpaces.combinacion, "Bloque Formulado — Combinación (sin apertura técnica)", Box)}
             </>
           )}
        </div>
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
               <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mt-4">Sin datos técnicos de curado en SAP</p>
             </div>
           )}
        </div>
      );
      case 'ordenes': return (
        <div className="animate-in fade-in duration-300 text-left">
           {/* El espacio de órdenes crudas (Provisionales tal cual las devuelve SAP, una fila por
               orden) se retiró a pedido del usuario: para captura y trazabilidad es más útil este
               único espacio, ya agrupado por material/componente con cantidades unificadas. Incluye
               TODOS los materiales de responsables de Formulación, no solo los que trazan a un
               "BLOQUE FORMULADO" — los que no trazan aparecen auto-referenciados (Formulado =
               el propio material) para no perder visibilidad de ninguna orden. */}
           {renderConsumoBloqueTable(provConsumoResponsable, "Consumo de Bloque Formulado por Componente — Provisionales")}
        </div>
      );
      case 'ordenesProd': return (
        <div className="animate-in fade-in duration-300 text-left">
          {renderConsumoBloqueTable(fertConsumoResponsable, "Consumo de Bloque Formulado por Componente — FERT")}
        </div>
      );
      case 'inventario': return (
        <div className="animate-in fade-in duration-300 text-left">
          <Card className="rounded-2xl border border-gray-100 shadow-sm overflow-hidden bg-white">
            <div className="px-6 pt-5 pb-3 flex items-start gap-2 text-slate-400">
              <Info className="w-3.5 h-3.5 mt-0.5 shrink-0" />
              <p className="text-[10px] leading-relaxed">
                Fuente: <span className="font-black text-slate-500">CuboInventarios SAP</span>. <span className="font-black text-green-600">Stock (KG)</span> es el <code className="font-mono">StockActual</code> reportado por SAP.
                <span className="font-black text-blue-600"> Stock (UN)</span> = Stock (KG) ÷ Lote Mínimo, es decir, cuántos lotes mínimos de fabricación caben en el stock disponible.
              </p>
            </div>
            <div className="overflow-x-auto max-h-[600px] relative">
              <table className="w-full border-collapse text-center font-sans text-[10px]">
                <thead className="bg-gray-50 sticky top-0 text-[9px] font-bold uppercase text-gray-400 tracking-widest z-10">
                  <tr>
                    <th className="px-6 py-5 border-r border-gray-100">Material</th>
                    <th className="px-6 py-5 border-r border-gray-100 text-left">Descripción del Bloque (SAP)</th>
                    <th className="px-4 py-5 border-r border-gray-100 text-left text-indigo-700">Categoría</th>
                    <th className="px-3 py-5 border-r border-gray-100">Centro</th>
                    <th className="px-3 py-5 border-r border-gray-100 text-purple-700">Clase Aprov.</th>
                    <th className="px-3 py-5 border-r border-gray-100 bg-green-50/50 text-green-700">
                      Stock (KG)
                      <span className="block normal-case font-normal text-gray-400 text-[7px] tracking-normal mt-0.5">StockActual SAP</span>
                    </th>
                    <th className="px-3 py-5 border-r border-gray-100 bg-blue-50/50 text-blue-700">
                      Stock (UN)
                      <span className="block normal-case font-normal text-gray-400 text-[7px] tracking-normal mt-0.5">KG ÷ Lote Mín.</span>
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
                        <td className="px-3 py-3 text-[9px] text-blue-600 uppercase font-black">{row.RespCtrlProd || '—'}</td>
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
          <Popover>
            <PopoverTrigger asChild>
              <Button variant="outline" className="h-9 px-5 rounded-xl border-gray-200 gap-2 font-black text-[10px] uppercase shadow-sm transition-all hover:border-primary/50">
                <CalendarIcon className="w-4 h-4 text-primary" /> {selectedDates.size === 0 ? 'Plan Maestro' : `${selectedDates.size} Días`}
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-72 p-0 border-none shadow-2xl rounded-2xl overflow-hidden mt-2" align="end">
              <div className="bg-white p-5 font-sans text-left text-[11px]">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="font-black text-slate-800 capitalize">{format(viewDate, 'MMMM yyyy', { locale: es })}</h3>
                  <div className="flex gap-1 bg-gray-50 p-1 rounded-xl">
                    <Button variant="ghost" size="icon" onClick={() => setViewDate(prev => subMonths(prev, 1))} className="h-8 w-8 hover:bg-white"><ChevronLeft className="w-4 h-4" /></Button>
                    <Button variant="ghost" size="icon" onClick={() => setViewDate(prev => addMonths(prev, 1))} className="h-8 w-8 hover:bg-white"><ChevronRight className="w-4 h-4" /></Button>
                  </div>
                </div>
                <div className="grid grid-cols-7 gap-y-1 text-center mb-4">
                  {['LU', 'MA', 'MI', 'JU', 'VI', 'SA', 'DO'].map(d => <div key={d} className="text-[9px] font-black text-slate-300 uppercase py-1">{d}</div>)}
                  {calendarDaysList.map((day, idx) => {
                    if (!day) return <div key={idx} />;
                    const dStr = format(day, 'yyyy-MM-dd');
                    const isSel = selectedDates.has(dStr);
                    return (
                      <button key={dStr} onClick={() => { const n = new Set(selectedDates); if (isSel) { n.delete(dStr); } else { n.add(dStr); } setSelectedDates(n); }} className={cn("relative h-8 w-8 mx-auto rounded-xl flex items-center justify-center transition-all", isSel ? "bg-primary text-white shadow-md" : "hover:bg-slate-50")}>
                        <span className={cn("text-xs font-black", isSel ? "text-white" : "text-slate-700")}>{format(day, 'd')}</span>
                      </button>
                    );
                  })}
                </div>
                <Button variant="ghost" size="sm" className="w-full text-[10px] font-black uppercase text-primary h-9 rounded-xl hover:bg-primary/5 tracking-widest" onClick={() => setSelectedDates(new Set())}>Ver Todo</Button>
              </div>
            </PopoverContent>
          </Popover>
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
      {!datosCargados && !isLoading && (
        <div
          className="flex items-center gap-2.5 rounded-xl border border-dashed border-blue-200 bg-blue-50/40 px-4 py-2.5 text-left"
          title="Este módulo no consulta SAP al abrirse. Sincronizar y Generar Necesidades trae Provisionales, FERT, Curado e Inventarios, y calcula el resumen automáticamente al terminar."
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
            { v: 'resumen', l: 'Salida de Datos', i: LayoutDashboard }, 
            { v: 'curado', l: 'Control Curado', i: TableIcon },
            { v: 'ordenes', l: 'Provisionales', i: Package }, 
            { v: 'ordenesProd', l: 'FERT', i: ShoppingCart },
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
    </div>
  );
};
