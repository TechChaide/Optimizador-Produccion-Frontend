// Funciones utilitarias para los componentes de importar-ventasV2

import { ecuadorHolidaysService } from '@/services/ecuador-holidays.service';
import { MONTH_NUMBERS, MONTH_NAMES } from './constants';
import type { WorkDaysCalculation, TiempoCanonResult, FilaHorasExtras, HorasExtrasPorMesCentro, BottleneckDataRow } from './types';
import * as XLSX from 'xlsx';

// Función para normalizar códigos de material a 8 dígitos consistentes
export const normalizeMaterialCode = (code: string | number): string => {
  const codeStr = String(code).trim();
  return codeStr.slice(-8);
};

// Función para exportar datos a XLSX
export function exportToXLSX<T extends Record<string, unknown>>(data: T[], filename: string, columns?: { key: string; header: string }[]) {
  if (!data || data.length === 0) {
    alert('No hay datos para exportar');
    return;
  }

  // Preparar datos para el Excel
  let exportData: Record<string, unknown>[] = [];

  if (columns && columns.length > 0) {
    // Usar columnas específicas
    exportData = data.map(row => {
      const newRow: Record<string, unknown> = {};
      columns.forEach(col => {
        newRow[col.header] = row[col.key] ?? '';
      });
      return newRow;
    });
  } else {
    // Usar todas las columnas
    exportData = data;
  }

  // Crear workbook y worksheet
  const worksheet = XLSX.utils.json_to_sheet(exportData);
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, 'Datos');

  // Aplicar estilos y ajustes de columnas
  const columnWidths = Object.keys(exportData[0] || {}).map(col => ({
    wch: Math.min(col.length + 5, 30)
  }));
  worksheet['!cols'] = columnWidths;

  // Descargar el archivo
  const dateStr = new Date().toISOString().split('T')[0];
  XLSX.writeFile(workbook, `${filename}_${dateStr}.xlsx`);
}

// Función para exportar múltiples hojas en un único archivo XLSX
export function exportToXLSXMultiSheet(sheets: { sheetName: string; data: Record<string, unknown>[] }[], filename: string) {
  const workbook = XLSX.utils.book_new();
  sheets.forEach(({ sheetName, data }) => {
    if (!data || data.length === 0) return;
    const worksheet = XLSX.utils.json_to_sheet(data);
    const columnWidths = Object.keys(data[0] || {}).map(col => ({ wch: Math.min(col.length + 5, 40) }));
    worksheet['!cols'] = columnWidths;
    XLSX.utils.book_append_sheet(workbook, worksheet, sheetName.substring(0, 31));
  });
  if (workbook.SheetNames.length === 0) { alert('No hay datos para exportar'); return; }
  const dateStr = new Date().toISOString().split('T')[0];
  XLSX.writeFile(workbook, `${filename}_${dateStr}.xlsx`);
}

// Función para convertir mes a número (acepta nombre o número)
export function getMesNumero(mesInput: string): number | null {
  const asNumber = parseInt(mesInput);
  if (!isNaN(asNumber) && asNumber >= 1 && asNumber <= 12) {
    return asNumber;
  }
  return MONTH_NUMBERS[mesInput as keyof typeof MONTH_NUMBERS] || null;
}

// Función para convertir mes número a nombre
export function getMesNombre(mesNum: number): string {
  return MONTH_NAMES[mesNum] || `Mes ${mesNum}`;
}

// Función segura para convertir a número
export const safeNumber = (v: unknown): number => {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
};

// Calcular necesidades
export function computeNecesidades(row: BottleneckDataRow): number {
  const unidadesProy = safeNumber(row.UnidadesProyectado ?? 0);
  const stockSeg = safeNumber(row.StockSeguridad ?? 0);
  const stockAct = safeNumber(row.StockActual ?? 0);
  return Math.max(0, unidadesProy - stockAct + stockSeg);
}

// Calcular días laborables
export async function calculateWorkDays(year: number, month: number): Promise<WorkDaysCalculation> {
  const startDate = new Date(year, month - 1, 1);
  const endDate = new Date(year, month, 0);
  
  let holidays: Array<{ date: string; name: string }> = [];
  try {
    holidays = await ecuadorHolidaysService.getHolidaysForRange(startDate, endDate);
  } catch (error) {
    console.error('Error al obtener feriados:', error);
  }

  const holidayDates = new Set(holidays.map(h => h.date));
  
  let diasLaborables = 0;
  let diasSabados = 0;

  for (let day = 1; day <= endDate.getDate(); day++) {
    const date = new Date(year, month - 1, day);
    const dayOfWeek = date.getDay();
    const dateString = date.toISOString().split('T')[0];

    if (holidayDates.has(dateString)) {
      continue;
    }

    if (dayOfWeek >= 1 && dayOfWeek <= 5) {
      diasLaborables++;
    } else if (dayOfWeek === 6) {
      diasSabados++;
    }
  }

  return {
    diasLaborables,
    diasSabados,
    diasFeriados: holidays.map(h => h.date)
  };
}

// Función compartida: enriquecer datos de una clase con participación, necesidad máxima, etc.
export function enriquecerDatosClase(
  datos: BottleneckDataRow[],
  tiemposCanon: TiempoCanonResult[],
  tiempoConsumidoAnterior: { [mesLinea: string]: number } = {}
) {
  const computeNec = (row: BottleneckDataRow) => {
    const up = safeNumber(row.UnidadesProyectado ?? 0);
    const ss = safeNumber(row.StockSeguridad ?? 0);
    const sa = safeNumber(row.StockActual ?? 0);
    return Math.max(0, up - sa + ss);
  };

  const buscarTiempoCanon = (mesRaw: string) => {
    let found = tiemposCanon.find(t => t.mes === mesRaw);
    if (found) return found;
    const mesNum = parseInt(mesRaw);
    if (!isNaN(mesNum) && mesNum >= 1 && mesNum <= 12) {
      const mesNombre = MONTH_NAMES[mesNum];
      found = tiemposCanon.find(t => t.mes === mesNombre);
      if (found) return found;
      found = tiemposCanon.find(t => t.mesNumero === mesNum);
      if (found) return found;
    }
    return null;
  };

  // Función para normalizar nombres de líneas para comparación
  const normalizarLinea = (linea: string): string => {
    return String(linea).toLowerCase().replace(/\s+/g, '').replace('linea', '').replace('línea', '');
  };

  const obtenerTiempoDisp = (mes: string, linea: string, puesto: string | null) => {
    const tc = buscarTiempoCanon(mes);
    if (!tc || !tc.data || !Array.isArray(tc.data)) return null;

    const lineaNorm = normalizarLinea(linea);
    
    // Primero filtrar por línea
    const registrosLinea = tc.data.filter(item => {
      const nombreLinea = normalizarLinea(item?.nombre_linea ?? '');
      return nombreLinea === lineaNorm || nombreLinea.includes(lineaNorm) || lineaNorm.includes(nombreLinea);
    });

    // Si no encontramos registros de la línea, intentar buscar por puesto en todos los datos
    if (registrosLinea.length === 0) {
      if (puesto && puesto !== '-' && puesto !== '') {
        const pn = String(puesto).toLowerCase().trim();
        const dp = tc.data.find(item => {
          const nombreEstacion = String(item?.nombre_estacion ?? '').toLowerCase().trim();
          return nombreEstacion.includes(pn) || pn.includes(nombreEstacion);
        });
        if (dp) {
          return {
            minutos_horario_normal: safeNumber(dp?.minutos_horario_normal_CON_PUESTOS ?? dp?.minutos_horario_normal_TOTAL ?? 0),
            minutos_con_extras: safeNumber(dp?.minutos_extras_CON_PUESTOS ?? dp?.minutos_extras_TOTAL ?? 0),
            minutos_fin_semana: safeNumber(dp?.minutos_sabado_CON_PUESTOS ?? dp?.minutos_sabado_TOTAL ?? 0),
            diasLaborables: tc.diasLaborables,
            diasSabados: tc.diasSabados
          };
        }
      }
      return null;
    }

    // Sumar todos los tiempos de las estaciones de esa línea
    let minutos_horario_normal = 0;
    let minutos_con_extras = 0;
    let minutos_fin_semana = 0;
    
    registrosLinea.forEach(dato => {
      minutos_horario_normal += safeNumber(dato?.minutos_horario_normal_CON_PUESTOS ?? dato?.minutos_horario_normal_TOTAL ?? 0);
      minutos_con_extras += safeNumber(dato?.minutos_extras_CON_PUESTOS ?? dato?.minutos_extras_TOTAL ?? 0);
      minutos_fin_semana += safeNumber(dato?.minutos_sabado_CON_PUESTOS ?? dato?.minutos_sabado_TOTAL ?? 0);
    });

    return {
      minutos_horario_normal,
      minutos_con_extras,
      minutos_fin_semana,
      diasLaborables: tc.diasLaborables,
      diasSabados: tc.diasSabados
    };
  };

  // Mapa de necesidades por línea para participación
  const mapa: { [k: string]: number } = {};
  datos.forEach(row => {
    const k = `${String(row.Mes ?? 'Sin mes')}|${String(row.LineaFabricacion ?? 'Sin línea')}`;
    mapa[k] = (mapa[k] || 0) + computeNec(row);
  });

  return datos.map(row => {
    const mes = String(row.Mes ?? 'Sin mes');
    const linea = String(row.LineaFabricacion ?? 'Sin línea');
    const key = `${mes}|${linea}`;
    const necesidad = computeNec(row);
    const sumaNecLinea = mapa[key] ?? necesidad;
    const participacionIndividual = sumaNecLinea > 0 ? (necesidad / sumaNecLinea) * 100 : 0;
    const tiempoPorUnidad = safeNumber(row.TiempoPorUnidad ?? 0);
    const numeroPuestos = safeNumber(row.NumeroPuestos ?? row.numero_puestos ?? 1);
    const tiempoUnitarioPorPuesto = numeroPuestos > 0 ? tiempoPorUnidad / numeroPuestos : 0;
    // T. Total necesidad inicial = (Tiempo Unitarío / Puestos) * Necesidades
    const tiempoTotalNecesidad = tiempoUnitarioPorPuesto * necesidad;
    const tiempoDisp = obtenerTiempoDisp(mes, linea, row.PuestoCuellodeBottella ?? null);

    let necesidadMaximaAFabricar = 0;
    let horasExtrasUsadas = 0;
    let tiempoParaMaterial = 0;

    if (tiempoDisp && tiempoPorUnidad > 0) {
      const techoAbsoluto = tiempoDisp.minutos_con_extras + tiempoDisp.minutos_fin_semana;
      const consumidoPrev = tiempoConsumidoAnterior?.[key] ?? 0;
      const tiempoMaxDisp = Math.max(0, techoAbsoluto - consumidoPrev);
      
      // Calcular tiempo disponible para este material según su participación
      tiempoParaMaterial = (participacionIndividual / 100) * tiempoMaxDisp;
      
      // Nueva lógica: si tiempoRequerido <= tiempoDisponible => Producir todo
      const tiempoRequerido = necesidad * tiempoPorUnidad;
      
      if (tiempoRequerido <= tiempoMaxDisp) {
        // Producir todo lo que se necesita
        necesidadMaximaAFabricar = necesidad;
      } else {
        // Aplicar prorrateo: utilizar el tiempo disponible prorratreado
        const tiempoUnitario = numeroPuestos > 0 ? tiempoPorUnidad / numeroPuestos : 0;
        const tiempoParaMaterialEnUnidades = tiempoUnitario > 0 ? tiempoParaMaterial / tiempoUnitario : 0;
        necesidadMaximaAFabricar = Math.floor(tiempoParaMaterialEnUnidades);
      }

      const tiempoNormalRest = Math.max(0, tiempoDisp.minutos_horario_normal - consumidoPrev);
      const tiempoNormalParaMaterial = (participacionIndividual / 100) * tiempoNormalRest;
      // Horas extras temporalmente deshabilitadas (se mantiene valor 0)
      const tiempoRealUsado = Math.min(necesidad, necesidadMaximaAFabricar) * tiempoPorUnidad;
      if (tiempoRealUsado > tiempoNormalParaMaterial) {
        horasExtrasUsadas = 0;
      }
    }

    return {
      ...row,
      participacionIndividual: participacionIndividual.toFixed(2),
      tiempoTotalNecesidad,
      tiempoParaMaterial,
      necesidadMaximaAFabricar,
      horasExtrasUsadas: horasExtrasUsadas.toFixed(2),
      mesRef: mes,
      lineaRef: linea
    };
  });
}
// Interfaz para el resultado del análisis de bottleneck por material
export interface BottleneckMaterialAnalysis {
  Centro: string;
  LineaFabricacion: string;
  NombreLinea: string;
  CodMaterial: string;
  NombreMaterial: string;
  Necesidad: number;
  PuestoDeTrabajo: string | null;
  NumeroPuestos: number | null;
  TiempoCanonicoMinutos: number | null;
  TiempoCanonicoHoras: number | null;
  Metodologia: string; // "Mayor necesidad" o "Voto mayoría"
}

// Función de voto a mayoría: Retorna el item más frecuente en una lista
export function votarPorMayoria<T, K extends string | number>(items: T[], selector: (item: T) => K): T | null {
  if (items.length === 0) return null;
  
  const frecuencia: { [key: string]: { count: number; item: T } } = {};
  
  items.forEach(item => {
    const key = String(selector(item));
    if (!frecuencia[key]) {
      frecuencia[key] = { count: 0, item };
    }
    frecuencia[key].count++;
  });
  
  let ganador = items[0];
  let maxVotos = 0;
  
  Object.values(frecuencia).forEach(({ count, item }) => {
    if (count > maxVotos) {
      maxVotos = count;
      ganador = item;
    }
  });
  
  return ganador;
}

// Función para extraer el material con mayor necesidad por Centro+Línea
// Si hay empate, usa voto a mayoría
export function getMaterialesCuelloBotellaPorLinea(
  datos: BottleneckDataRow[]
): BottleneckMaterialAnalysis[] {
  const gruposPorLinea: { [key: string]: BottleneckDataRow[] } = {};
  
  // Agrupar por Centro + LineaFabricacion
  datos.forEach(row => {
    const centro = String(row.CentroFabricacion ?? row.Centro ?? '');
    const linea = String(row.LineaFabricacion ?? '');
    const key = `${centro}|${linea}`;
    
    if (!gruposPorLinea[key]) {
      gruposPorLinea[key] = [];
    }
    gruposPorLinea[key].push(row);
  });
  
  const resultados: BottleneckMaterialAnalysis[] = [];
  
  Object.entries(gruposPorLinea).forEach(([key, grupo]) => {
    const [centro, linea] = key.split('|');
    
    // Calcular necesidad de cada material
    const necesidadesPorMaterial: { [codMaterial: string]: number } = {};
    
    grupo.forEach(row => {
      const codMat = String(row.CodMaterial ?? '');
      const nec = computeNecesidades(row);
      necesidadesPorMaterial[codMat] = (necesidadesPorMaterial[codMat] || 0) + nec;
    });
    
    // Encontrar la necesidad máxima
    const maxNecesidad = Math.max(...Object.values(necesidadesPorMaterial));
    
    // Materiales con mayor necesidad
    const materialesConMaxNecesidad = grupo.filter(row => {
      const codMat = String(row.CodMaterial ?? '');
      return necesidadesPorMaterial[codMat] === maxNecesidad;
    });
    
    // Si hay empate, usar voto a mayoría por puesto de trabajo
    let materialSeleccionado: BottleneckDataRow | null = null;
    let metodologia = 'Mayor necesidad';
    
    if (materialesConMaxNecesidad.length > 1) {
      materialSeleccionado = votarPorMayoria(materialesConMaxNecesidad, (item) => 
        item.PuestoCuellodeBottella || item.LineaFabricacion || '-'
      );
      metodologia = 'Voto mayoría';
    } else {
      materialSeleccionado = materialesConMaxNecesidad[0];
    }
    
    if (materialSeleccionado) {
      const necesidad = computeNecesidades(materialSeleccionado);
      
      resultados.push({
        Centro: centro,
        LineaFabricacion: linea,
        NombreLinea: String(materialSeleccionado.NombreLinea ?? materialSeleccionado.LineaFabricacion ?? linea),
        CodMaterial: String(materialSeleccionado.CodMaterial ?? ''),
        NombreMaterial: String(materialSeleccionado.NombreMaterial ?? materialSeleccionado.CodMaterial ?? ''),
        Necesidad: necesidad,
        PuestoDeTrabajo: materialSeleccionado.PuestoCuellodeBottella ?? null,
        NumeroPuestos: materialSeleccionado.NumeroPuestos ?? null,
        TiempoCanonicoMinutos: materialSeleccionado.TiempoFabricacionNecesidad ?? null,
        TiempoCanonicoHoras: materialSeleccionado.TiempoFabricacionNecesidadHoras ?? null,
        Metodologia: metodologia
      });
    }
  });
  
  return resultados;
}

// ==================== HORAS EXTRAS - LOCALSTORAGE ====================

const HORAS_EXTRAS_STORAGE_PREFIX = 'horasExtras_';

/**
 * Genera la key de localStorage para un mes y centro específico
 */
export function getHorasExtrasStorageKey(mes: string, centro: string): string {
  return `${HORAS_EXTRAS_STORAGE_PREFIX}${mes}_Centro${centro}`;
}

/**
 * Genera la estructura de filas de horas extras para una línea basada en los parámetros del mes
 */
export function generarFilasHorasExtras(
  diasLaborables: number,
  diasSabados: number,
  maxExtrasHoras: number,
  horasExtrasFin: number
): FilaHorasExtras[] {
  const filas: FilaHorasExtras[] = [];
  
  // Calcular semanas normales (5 días L-V por semana)
  const semanasNormales = Math.floor(diasLaborables / 5);
  const diasLaborablesExtra = diasLaborables % 5;
  
  // Filas de semanas normales (L-V)
  for (let i = 0; i < semanasNormales; i++) {
    const horasExtrasLV = 5 * maxExtrasHoras;
    filas.push({
      id: `semana_${i + 1}`,
      tipo: 'semana',
      descripcion: `Semana ${i + 1}`,
      diasLV: 5,
      totalHoras: horasExtrasLV,
      horasConsumidas: 0,
      consumido: false
    });
  }
  
  // Fila de días L-V extra (si hay)
  if (diasLaborablesExtra > 0) {
    const horasExtrasLV = diasLaborablesExtra * maxExtrasHoras;
    filas.push({
      id: 'extras_lv',
      tipo: 'extras-lv',
      descripcion: 'Días L-V Extra',
      diasLV: diasLaborablesExtra,
      totalHoras: horasExtrasLV,
      horasConsumidas: 0,
      consumido: false
    });
  }
  
  // Filas de sábados
  for (let i = 0; i < diasSabados; i++) {
    filas.push({
      id: `sabado_${i + 1}`,
      tipo: 'sabado',
      descripcion: `Sábado ${i + 1}`,
      diasLV: 0,
      totalHoras: horasExtrasFin,
      horasConsumidas: 0,
      consumido: false
    });
  }
  
  return filas;
}

/**
 * Guarda la estructura de horas extras en localStorage
 */
export function guardarHorasExtrasEnStorage(data: HorasExtrasPorMesCentro): void {
  const key = getHorasExtrasStorageKey(data.mes, data.centro);
  try {
    localStorage.setItem(key, JSON.stringify(data));
    console.log(`[HorasExtras] Guardado en localStorage: ${key}`, data);
  } catch (error) {
    console.error(`[HorasExtras] Error guardando en localStorage: ${key}`, error);
  }
}

/**
 * Recupera la estructura de horas extras desde localStorage
 */
export function obtenerHorasExtrasDeStorage(mes: string, centro: string): HorasExtrasPorMesCentro | null {
  const key = getHorasExtrasStorageKey(mes, centro);
  try {
    const stored = localStorage.getItem(key);
    if (stored) {
      const parsed = JSON.parse(stored);
      console.log(`[HorasExtras] Recuperado de localStorage: ${key}`, parsed);
      return parsed;
    }
  } catch (error) {
    console.error(`[HorasExtras] Error leyendo de localStorage: ${key}`, error);
  }
  return null;
}

/**
 * Resultado de consumir horas extras
 */
export interface ResultadoConsumoHorasExtras {
  horasConsumidas: number;           // Total de horas extras consumidas
  minutosAdicionales: number;        // Minutos adicionales ganados (horasConsumidas * 60)
  filasActualizadas: FilaHorasExtras[]; // Estado actualizado de las filas
  detalleConsumo: string[];          // Detalle de consumo por fila (ej: "S1: 4h, S2: 2h")
  necesidadCubierta: boolean;        // Si se logró cubrir la necesidad
}

/**
 * Intenta consumir horas extras para cubrir un déficit de tiempo.
 * Consume de 2 en 2 horas (o el incremento configurado) hasta cubrir o agotar.
 * 
 * @param mes - Mes de operación
 * @param centro - Centro de producción
 * @param linea - Línea de producción
 * @param minutosDeficit - Minutos que faltan para cubrir la necesidad
 * @param maxExtrasHoras - Incremento de horas extras por iteración (típicamente 2h)
 * @param guardarEnStorage - Si se debe actualizar el localStorage
 * @returns Resultado del consumo
 */
export function consumirHorasExtras(
  mes: string,
  centro: string,
  linea: string,
  minutosDeficit: number,
  maxExtrasHoras: number = 2,
  guardarEnStorage: boolean = true
): ResultadoConsumoHorasExtras {
  const resultado: ResultadoConsumoHorasExtras = {
    horasConsumidas: 0,
    minutosAdicionales: 0,
    filasActualizadas: [],
    detalleConsumo: [],
    necesidadCubierta: false
  };
  
  if (minutosDeficit <= 0) {
    resultado.necesidadCubierta = true;
    return resultado;
  }
  
  const data = obtenerHorasExtrasDeStorage(mes, centro);
  if (!data || !data.lineas[linea]) {
    console.warn(`[HorasExtras] No hay datos para ${mes}/${centro}/${linea}`);
    return resultado;
  }
  
  const filas = [...data.lineas[linea]];
  let minutosRestantes = minutosDeficit;
  const consumoPorFila: { [id: string]: number } = {};
  
  // Iterar por cada fila en orden (semanas, días extra, sábados)
  for (let i = 0; i < filas.length && minutosRestantes > 0; i++) {
    const fila = filas[i];
    
    // Si la fila ya está completamente consumida, saltar
    if (fila.consumido) continue;

    // Consumir de 2 en 2 horas (o según maxExtrasHoras)
    while (minutosRestantes > 0 && fila.horasConsumidas < fila.totalHoras) {
      // Calcular cuántas horas podemos consumir en esta iteración
      const horasAConsumir = Math.min(
        maxExtrasHoras,                           // Máximo por iteración
        fila.totalHoras - fila.horasConsumidas,   // Lo que queda disponible en la fila
        Math.ceil(minutosRestantes / 60)          // Lo que necesitamos (redondeado hacia arriba)
      );
      
      if (horasAConsumir <= 0) break;
      
      // Actualizar fila
      fila.horasConsumidas += horasAConsumir;
      const minutosGanados = horasAConsumir * 60;
      minutosRestantes -= minutosGanados;
      
      resultado.horasConsumidas += horasAConsumir;
      resultado.minutosAdicionales += minutosGanados;
      
      // Registrar consumo por fila
      consumoPorFila[fila.id] = (consumoPorFila[fila.id] || 0) + horasAConsumir;
      
      // Verificar si la fila está agotada
      if (fila.horasConsumidas >= fila.totalHoras) {
        fila.consumido = true;
        break;
      }
      
      // Verificar si ya cubrimos la necesidad
      if (minutosRestantes <= 0) {
        resultado.necesidadCubierta = true;
        break;
      }
    }
    
    filas[i] = fila;
  }
  
  // Generar detalle de consumo
  Object.entries(consumoPorFila).forEach(([id, horas]) => {
    const fila = filas.find(f => f.id === id);
    if (fila) {
      const abrev = fila.tipo === 'semana' ? `S${id.split('_')[1]}` : 
                    fila.tipo === 'extras-lv' ? 'ExLV' : 
                    `Sáb${id.split('_')[1]}`;
      resultado.detalleConsumo.push(`${abrev}: ${horas}h`);
    }
  });
  
  resultado.filasActualizadas = filas;
  resultado.necesidadCubierta = minutosRestantes <= 0;
  
  // Guardar en storage si se solicita
  if (guardarEnStorage) {
    data.lineas[linea] = filas;
    guardarHorasExtrasEnStorage(data);
  }
  
  return resultado;
}

/**
 * Calcula el total de minutos extras disponibles para una línea (no consumidos)
 */
export function calcularMinutosExtrasDisponibles(mes: string, centro: string, linea: string): number {
  const data = obtenerHorasExtrasDeStorage(mes, centro);
  if (!data || !data.lineas[linea]) return 0;
  
  return data.lineas[linea].reduce((total, fila) => {
    const horasDisponibles = fila.totalHoras - fila.horasConsumidas;
    return total + (horasDisponibles * 60);
  }, 0);
}

/**
 * Obtiene un resumen de las horas extras por línea para mostrar en la UI
 */
export function obtenerResumenHorasExtrasLinea(mes: string, centro: string, linea: string): {
  totalHoras: number;
  horasConsumidas: number;
  horasDisponibles: number;
  detalle: string;
} {
  const data = obtenerHorasExtrasDeStorage(mes, centro);
  if (!data || !data.lineas[linea]) {
    return { totalHoras: 0, horasConsumidas: 0, horasDisponibles: 0, detalle: '-' };
  }
  
  const filas = data.lineas[linea];
  const totalHoras = filas.reduce((sum, f) => sum + f.totalHoras, 0);
  const horasConsumidas = filas.reduce((sum, f) => sum + f.horasConsumidas, 0);
  
  const detalles: string[] = [];
  filas.forEach(fila => {
    if (fila.horasConsumidas > 0) {
      const abrev = fila.tipo === 'semana' ? `S${fila.id.split('_')[1]}` : 
                    fila.tipo === 'extras-lv' ? 'ExLV' : 
                    `Sáb${fila.id.split('_')[1]}`;
      detalles.push(`${abrev}: ${fila.horasConsumidas}h`);
    }
  });
  
  return {
    totalHoras,
    horasConsumidas,
    horasDisponibles: totalHoras - horasConsumidas,
    detalle: detalles.length > 0 ? detalles.join(', ') : '-'
  };
}
