/**
 * Etapa 4 IV5 - Mini-pasada PIO mensual.
 *
 * Despues de la progresiva, en la ultima semana de cada mes, si:
 *  - hay holgura libre en (linea, ultima_semana), y
 *  - el stockFinal del material esta por debajo del invObjetivo PIO,
 *
 * se reserva produccion adicional `produccionPio` hasta cubrir la brecha o
 * agotar la holgura, prorrateado por tiempo equivalente entre los materiales
 * con brecha en la misma linea/semana.
 *
 * Esta etapa NO crea backlog, NO desplaza despachos. Solo aumenta el stock
 * final de la ultima semana del mes y, por arrastre, los meses siguientes.
 */

import { safeNumber } from '../../importar-ventasV2/components/utils';
import type { PioMap } from '../../importar-ventasV2/components/types';
import type { Centro, Iv5WeeklyRow, LineaKey, MaterialKey, WeekKey } from './iv5Types';
import { type Iv5CapacityMatrix, getCapacityCell, reserveMinutes } from './iv5Capacity';

export interface Iv5MonthlyPioParams {
  centro: Centro;
  ledger: Iv5WeeklyRow[];
  capacity: Iv5CapacityMatrix;
  pioMap: PioMap;
}

export function runIv5MonthlyPio(params: Iv5MonthlyPioParams): {
  diagnostics: Array<{ linea: LineaKey; weekKey: WeekKey; mensaje: string; brechaResidual: number; material: MaterialKey }>;
} {
  const { centro, ledger, capacity, pioMap } = params;
  const diagnostics: Array<{ linea: LineaKey; weekKey: WeekKey; mensaje: string; brechaResidual: number; material: MaterialKey }> = [];

  // Identifica la ultima weekKey de cada (linea, mes, anio) cronologicamente.
  type Bucket = { linea: LineaKey; mes: number; anio: number; weekKey: WeekKey; isoYear: number; isoWeek: number; rowIndexes: number[] };
  const lastWeekPerLineMonth = new Map<string, Bucket>();
  ledger.forEach((row, idx) => {
    const k = `${row.linea}|${row.anio}|${row.mes}`;
    const prev = lastWeekPerLineMonth.get(k);
    const isLater =
      !prev ||
      row.isoYear > prev.isoYear ||
      (row.isoYear === prev.isoYear && row.isoWeek > prev.isoWeek);
    if (isLater) {
      lastWeekPerLineMonth.set(k, {
        linea: row.linea,
        mes: row.mes,
        anio: row.anio,
        weekKey: row.weekKey,
        isoYear: row.isoYear,
        isoWeek: row.isoWeek,
        rowIndexes: [idx],
      });
    } else if (prev && row.isoYear === prev.isoYear && row.isoWeek === prev.isoWeek && row.weekKey === prev.weekKey) {
      prev.rowIndexes.push(idx);
    }
  });

  // Re-coloca los rowIndexes con la ultima weekKey detectada (algunas iteraciones quedaron parciales).
  const rowsByLineWeek = new Map<string, number[]>();
  ledger.forEach((row, idx) => {
    const k = `${row.linea}|${row.weekKey}`;
    const arr = rowsByLineWeek.get(k) ?? [];
    arr.push(idx);
    rowsByLineWeek.set(k, arr);
  });

  for (const bucket of lastWeekPerLineMonth.values()) {
    const cell = getCapacityCell(capacity, bucket.linea, bucket.weekKey);
    if (!cell) continue;
    const idleLibre = cell.minDisponibles;
    if (idleLibre <= 0) continue;
    const idxList = rowsByLineWeek.get(`${bucket.linea}|${bucket.weekKey}`) ?? [];
    if (!idxList.length) continue;

    type Slot = { idx: number; uds: number; tupp: number; material: MaterialKey };
    const slots: Slot[] = [];

    for (const idx of idxList) {
      const r = ledger[idx];
      const pio = pioMap.get(`${r.material}|${centro}`);
      if (!pio) continue;
      const objetivo = safeNumber(pio.invObjetivo);
      const brecha = Math.max(0, Math.round(objetivo - r.stockFinal));
      if (brecha <= 0) continue;
      slots.push({ idx, uds: brecha, tupp: r.tupp, material: r.material });
    }
    if (!slots.length) continue;

    const tiempoTotal = slots.reduce((s, sl) => s + sl.uds * sl.tupp, 0);
    if (tiempoTotal <= 0) continue;
    const limitMin = Math.min(idleLibre, tiempoTotal);

    for (const sl of slots) {
      if (limitMin <= 0) break;
      const cuotaMin = (limitMin * sl.uds * sl.tupp) / tiempoTotal;
      const tupp = Math.max(0.0001, sl.tupp);
      const udsAsignadas = Math.max(0, Math.floor(cuotaMin / tupp));
      if (udsAsignadas <= 0) continue;
      const reserved = reserveMinutes(capacity, bucket.linea, bucket.weekKey, udsAsignadas * tupp);
      const udsEfectivas = Math.floor(reserved / tupp);
      if (udsEfectivas <= 0) continue;

      const row = ledger[sl.idx];
      row.produccionPio += udsEfectivas;
      row.stockFinal += udsEfectivas;
      row.minUsados += reserved;
      row.idleSem = Math.max(0, row.idleSem - reserved);
      // refresca alerta de stock bajo seguridad
      row.alertaStockBajoSeguridad = row.stockFinal < row.stockSeguridad;

      const brechaResidual = sl.uds - udsEfectivas;
      if (brechaResidual > 0) {
        diagnostics.push({
          linea: bucket.linea,
          weekKey: bucket.weekKey,
          material: sl.material,
          mensaje: `PIO no completo: faltaron ${brechaResidual} uds para alcanzar invObjetivo.`,
          brechaResidual,
        });
      }
    }
  }

  return { diagnostics };
}
