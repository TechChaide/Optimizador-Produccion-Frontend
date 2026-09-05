/**
 * Prorrateo IV5 - Reparto proporcional puro de capacidad por material.
 *
 * Politica (sin distincion por clase de aprovisionamiento F/X/E):
 *  1) Para cada material valido:
 *        total_min_material = nec_propio_min + nec_traslado_min
 *  2) Si capacidad >= sum(total_min_material), todos al 100%.
 *     Si no, factor = capacidad / sum(total_min_material).
 *  3) Minutos asignados por bucket (propio/traslado) dentro del material:
 *        min_propio   = nec_propio_min   * factor
 *        min_traslado = nec_traslado_min * factor
 *  4) Floor + Mayor Residuo en MINUTOS: redistribuye los minutos perdidos por
 *     redondeo a los buckets con mayor residuo, respetando la demanda en
 *     minutos de cada bucket.
 *  5) Conversion de minutos a unidades: uds = floor(min / tupp). Luego se
 *     aplica Mayor Residuo en UNIDADES para reasignar +1 ud al bucket con
 *     mayor residuo, respetando demanda del bucket y capacidad global de la
 *     linea.
 *  6) Materiales con total_min_material = 0 se excluyen del calculo y reciben
 *     asignacion 0 (Regla de division por cero).
 *
 * Importante: el calculo combina los dos niveles del IV5 anterior (entre
 * materiales y dentro del material) en un solo paso proporcional. Cada bucket
 * (propio o traslado) recibe directamente la cuota:
 *
 *     min_bucket = nec_bucket_min * factor
 *
 * Esto es matematicamente equivalente a:
 *
 *     min_total_material = total_min_material * factor
 *     min_bucket         = min_total_material * (nec_bucket_min / total_min_material)
 *
 * pero evita propagacion de errores de redondeo intermedio.
 */

import { safeNumber } from '../../importar-ventasV2/components/utils';

const EPS = 1e-6;

/** Slot de necesidad por material en (linea, semana) para el prorrateo. */
export interface MaterialDemandSlot {
  material: string;
  /** Uds totales solicitadas (propias + traslado). */
  uds: number;
  /**
   * Uds solicitadas como necesidad PROPIA del centro analizado.
   * En C1000: demanda 1000 + brecha objetivo + backlog acumulado.
   * En C2000: demanda 2000 + brecha objetivo + backlog acumulado.
   */
  udsPropias: number;
  /**
   * Uds solicitadas como TRASLADO al otro centro.
   * Solo aplica a C1000 (necesidad de fabricar para enviar a C2000).
   * En C2000 siempre vale 0.
   */
  udsTraslado: number;
  /** Tiempo unitario por puesto (min/uds). */
  tupp: number;
}

/** Resultado del prorrateo por material. */
export interface MaterialAllocation {
  material: string;
  /** Uds totales asignadas (propias + traslado). */
  udsAsignadas: number;
  /** Uds asignadas al bucket propio. */
  udsPropias: number;
  /** Uds asignadas al bucket traslado. */
  udsTraslado: number;
  /** Minutos efectivamente reservados ((udsPropias + udsTraslado) * tupp). */
  minutosUsados: number;
}

interface BucketInternal {
  idxAlloc: number;
  tipo: 'propio' | 'traslado';
  necUds: number;
  necMin: number;
  tupp: number;
}

/**
 * Reparte `minutosDisponibles` entre los materiales de una linea/semana
 * aplicando la politica proporcional pura descrita en la cabecera.
 */
export function prorrateoNivel1y2(
  slots: MaterialDemandSlot[],
  minutosDisponibles: number,
): MaterialAllocation[] {
  const alloc: MaterialAllocation[] = slots.map((s) => ({
    material: s.material,
    udsAsignadas: 0,
    udsPropias: 0,
    udsTraslado: 0,
    minutosUsados: 0,
  }));
  if (minutosDisponibles <= 0 || slots.length === 0) return alloc;

  // Construye buckets (propio/traslado) por material, descartando los que
  // tienen total_material = 0 (Regla 1) o tupp invalido.
  const buckets: BucketInternal[] = [];
  let totalRequeridoMin = 0;
  slots.forEach((s, i) => {
    const tupp = Math.max(0, safeNumber(s.tupp));
    if (tupp <= 0) return;
    const necProp = Math.max(0, safeNumber(s.udsPropias));
    const necTras = Math.max(0, safeNumber(s.udsTraslado));
    if (necProp + necTras <= 0) return;
    if (necProp > 0) {
      const necMin = necProp * tupp;
      buckets.push({ idxAlloc: i, tipo: 'propio', necUds: necProp, necMin, tupp });
      totalRequeridoMin += necMin;
    }
    if (necTras > 0) {
      const necMin = necTras * tupp;
      buckets.push({ idxAlloc: i, tipo: 'traslado', necUds: necTras, necMin, tupp });
      totalRequeridoMin += necMin;
    }
  });
  if (buckets.length === 0 || totalRequeridoMin <= 0) return alloc;

  // factor = min(1, capacidad / total_requerido).
  const factor = Math.min(1, minutosDisponibles / totalRequeridoMin);

  // Asigna minutos por bucket en valor continuo y luego aplica Floor + Mayor
  // Residuo para reasignar los minutos perdidos.
  const minFloatPorBucket = buckets.map((b) => b.necMin * factor);
  const minPorBucket = minFloatPorBucket.map((m) => Math.floor(m));
  const objetivoMin = Math.min(minutosDisponibles, totalRequeridoMin * factor);
  let faltanteMin = Math.max(0, Math.floor(objetivoMin) - sum(minPorBucket));
  if (faltanteMin > 0) {
    const orden = minFloatPorBucket
      .map((m, i) => ({ i, residuo: m - minPorBucket[i] }))
      .sort((a, b) => b.residuo - a.residuo);
    for (const { i } of orden) {
      if (faltanteMin <= 0) break;
      // No exceder necesidad en minutos de cada bucket.
      if (minPorBucket[i] + 1 > buckets[i].necMin + EPS) continue;
      minPorBucket[i] += 1;
      faltanteMin -= 1;
    }
  }

  // Convierte minutos -> unidades por bucket (floor), respetando demanda.
  const udsPorBucket = buckets.map((b, i) => {
    const u = Math.floor(minPorBucket[i] / Math.max(EPS, b.tupp));
    return Math.min(u, b.necUds);
  });
  let minUsadosTotal = udsPorBucket.reduce((s, u, i) => s + u * buckets[i].tupp, 0);

  // Mayor Residuo en UNIDADES: intenta sumar +1 ud al bucket con mayor residuo
  // mientras quepa en la capacidad global y no exceda demanda del bucket.
  const ordenUds = buckets
    .map((b, i) => ({
      i,
      residuo: minPorBucket[i] / Math.max(EPS, b.tupp) - udsPorBucket[i],
    }))
    .sort((a, b) => b.residuo - a.residuo);
  for (const { i } of ordenUds) {
    const b = buckets[i];
    if (udsPorBucket[i] + 1 > b.necUds) continue;
    const extraMin = b.tupp;
    if (minUsadosTotal + extraMin > minutosDisponibles + EPS) continue;
    udsPorBucket[i] += 1;
    minUsadosTotal += extraMin;
  }

  // Vuelca al arreglo de salida agrupando buckets por material.
  buckets.forEach((b, i) => {
    const a = alloc[b.idxAlloc];
    const uds = udsPorBucket[i];
    if (uds <= 0) return;
    if (b.tipo === 'propio') a.udsPropias += uds;
    else a.udsTraslado += uds;
  });
  slots.forEach((s, i) => {
    const tupp = Math.max(0, safeNumber(s.tupp));
    alloc[i].udsAsignadas = alloc[i].udsPropias + alloc[i].udsTraslado;
    alloc[i].minutosUsados = alloc[i].udsAsignadas * tupp;
  });

  return alloc;
}

function sum(arr: number[]): number {
  let s = 0;
  for (const v of arr) s += v;
  return s;
}
