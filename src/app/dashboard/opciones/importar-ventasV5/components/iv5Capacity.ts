/**
 * Calculo de capacidad semanal IV5 por (centro, linea, semana).
 *
 * Reglas confirmadas (alineadas con IV2/IV3):
 *  - JN: minutos_horario_normal_TOTAL del cuello de botella (primera estacion
 *    coincidente en los tiempos canonicos), distribuido por semana proporcional
 *    a diasLaborales. No se suma por estaciones ni se usa _CON_PUESTOS.
 *  - HE: diasLaborales * 120 min/dia (2h extras × 60). Mismo resultado que
 *    minutos_extras_TOTAL - minutos_horario_normal_TOTAL de la API cuando el
 *    cuello de botella trabaja jornada 8h + 2h extras.
 *  - Sabados: cada sabado activo aporta `horasExtrasFin * 60` minutos. El tope
 *    fisico mensual lo controla `maxSabadosMes` desde la UI.
 *
 * El consumo se hace en orden: JN -> HE -> Sabado (vease `consumeMinutes`).
 */

import type { WeekSegment } from '../../plan-semanal/components/types';
import type { TiempoCanonResult } from '../../importar-ventasV2/components/types';
import { safeNumber } from '../../importar-ventasV2/components/utils';
import type { Centro, Iv5LineWeekCapacity, LineaKey, SatKey, WeekKey } from './iv5Types';
import { IV5_HE_BLOCK_HOURS, IV5_VIRTUAL_TRANSFER_LINE } from './iv5Constants';

function normLinea(linea: string): string {
  return String(linea ?? '')
    .toLowerCase()
    .replace(/\s+/g, '')
    .replace('linea', '')
    .replace('línea', '');
}

/**
 * Devuelve los minutos JN del cuello de botella de una linea para un mes.
 * Toma la primera estacion coincidente (igual que IV2) y usa minutos_horario_normal_TOTAL
 * para no inflar la capacidad con _CON_PUESTOS, ya que TUPP divide por NumeroPuestos.
 */
function lineMonthlyJN(tc: TiempoCanonResult, linea: LineaKey): number {
  if (!tc?.data || !Array.isArray(tc.data)) return 0;
  const lineaNorm = normLinea(linea);
  const match = (tc.data as any[]).find(item => {
    const nl = normLinea(item?.nombre_linea ?? '');
    return nl === lineaNorm || nl.includes(lineaNorm) || lineaNorm.includes(nl);
  });
  return match ? safeNumber(match.minutos_horario_normal_TOTAL ?? 0) : 0;
}

export interface BuildIv5CapacityParams {
  centro: Centro;
  lineas: LineaKey[];
  weekSegments: WeekSegment[];
  tiemposCanon: TiempoCanonResult[];
  activeSatKeys: Set<SatKey>;
  maxExtrasHoras: number;
  horasExtrasFin: number;
  /** Tope mensual fisico de sabados que el motor puede contar (por centro). */
  maxSabadosMes?: number;
}

export type Iv5CapacityMatrix = Map<LineaKey, Map<WeekKey, Iv5LineWeekCapacity>>;

export function buildIv5Capacity(params: BuildIv5CapacityParams): Iv5CapacityMatrix {
  const {
    centro,
    lineas,
    weekSegments,
    tiemposCanon,
    activeSatKeys,
    maxExtrasHoras,
    horasExtrasFin,
    maxSabadosMes,
  } = params;
  const out: Iv5CapacityMatrix = new Map();

  const tcByMes = new Map<number, TiempoCanonResult>();
  for (const tc of tiemposCanon) tcByMes.set(tc.mesNumero, tc);

  // pre-agrupa segmentos por (anio, mes) para distribucion proporcional de JN mensual
  // (solo `mes` mezclaria dos eneros de distintos años y recortaria capJN por mes).
  const segsByAnioMes = new Map<string, WeekSegment[]>();
  for (const seg of weekSegments) {
    const mk = `${seg.anio}-${seg.mes}`;
    const arr = segsByAnioMes.get(mk) ?? [];
    arr.push(seg);
    segsByAnioMes.set(mk, arr);
  }

  // Tope fisico de sabados/mes: si maxSabadosMes esta definido, recortamos los
  // sabados activos a los primeros N (orden cronologico) por mes.
  const allowedSatByMes = new Map<string, Set<SatKey>>();
  if (typeof maxSabadosMes === 'number' && Number.isFinite(maxSabadosMes)) {
    const segsConSabadoActivo = weekSegments
      .filter((s) => s.tieneSabado && activeSatKeys.has(s.satKey))
      .sort((a, b) => {
        if (a.isoYear !== b.isoYear) return a.isoYear - b.isoYear;
        return a.isoWeek - b.isoWeek;
      });
    for (const seg of segsConSabadoActivo) {
      const k = `${seg.anio}-${seg.mes}`;
      let allowed = allowedSatByMes.get(k);
      if (!allowed) {
        allowed = new Set();
        allowedSatByMes.set(k, allowed);
      }
      if (allowed.size < maxSabadosMes) allowed.add(seg.satKey);
    }
  }

  // Bloque minimo HE: el motor planifica HE en multiplos de IV5_HE_BLOCK_HOURS.
  // Aqui la capacidad bruta se calcula con `diasLaborales * maxExtrasHoras * 60`
  // pero solo redondeada a multiplos de bloque (floor) por dia laborable.
  const minutosHEporDia = Math.floor(maxExtrasHoras / IV5_HE_BLOCK_HOURS) * IV5_HE_BLOCK_HOURS * 60;

  for (const linea of lineas) {
    const byWeek = new Map<WeekKey, Iv5LineWeekCapacity>();
    const esVirtual = linea === IV5_VIRTUAL_TRANSFER_LINE;
    for (const seg of weekSegments) {
      const tc = tcByMes.get(seg.mes);
      const monthKey = `${seg.anio}-${seg.mes}`;
      const allowedSat = allowedSatByMes.get(monthKey);
      const sabadoEnTope =
        !esVirtual &&
        seg.tieneSabado &&
        activeSatKeys.has(seg.satKey) &&
        (allowedSat ? allowedSat.has(seg.satKey) : true);
      const monthSegs = segsByAnioMes.get(`${seg.anio}-${seg.mes}`) ?? [];
      const totalDiasLV = monthSegs.reduce((s, m) => s + m.diasLaborales, 0);
      const lineJNmonth = tc && !esVirtual ? lineMonthlyJN(tc, linea) : 0;
      const capJN = !esVirtual && totalDiasLV > 0 ? (lineJNmonth * seg.diasLaborales) / totalDiasLV : 0;
      const capHE = esVirtual ? 0 : seg.diasLaborales * minutosHEporDia;
      const capSab = sabadoEnTope ? horasExtrasFin * 60 : 0;
      const capTotal = capJN + capHE + capSab;
      byWeek.set(seg.weekKey, {
        centro,
        linea,
        weekKey: seg.weekKey,
        satKey: seg.satKey,
        isoWeek: seg.isoWeek,
        isoYear: seg.isoYear,
        mes: seg.mes,
        anio: seg.anio,
        diasLV: seg.diasLaborales,
        sabadoActivo: sabadoEnTope,
        capJN,
        capHE,
        capSab,
        capTotal,
        minReservados: 0,
        minDisponibles: capTotal,
      });
    }
    out.set(linea, byWeek);
  }

  return out;
}

/**
 * Reserva `mins` minutos en (linea, weekKey). No consume mas de lo disponible.
 * Devuelve los minutos efectivamente reservados (puede ser < mins si no hay holgura).
 */
export function reserveMinutes(
  capacity: Iv5CapacityMatrix,
  linea: LineaKey,
  weekKey: WeekKey,
  mins: number,
): number {
  const byWeek = capacity.get(linea);
  if (!byWeek) return 0;
  const cell = byWeek.get(weekKey);
  if (!cell) return 0;
  const used = Math.max(0, Math.min(mins, cell.minDisponibles));
  cell.minReservados += used;
  cell.minDisponibles = Math.max(0, cell.minDisponibles - used);
  return used;
}

export function getCapacityCell(
  capacity: Iv5CapacityMatrix,
  linea: LineaKey,
  weekKey: WeekKey,
): Iv5LineWeekCapacity | null {
  return capacity.get(linea)?.get(weekKey) ?? null;
}

/**
 * Devuelve la suma de minDisponibles para (linea) en todas sus semanas.
 * Util para detectar idle libre cuando el motor evalua si redirigir a una alternativa.
 */
export function sumIdleByLinea(capacity: Iv5CapacityMatrix, linea: LineaKey): number {
  const byWeek = capacity.get(linea);
  if (!byWeek) return 0;
  let total = 0;
  for (const cell of byWeek.values()) total += cell.minDisponibles;
  return total;
}
