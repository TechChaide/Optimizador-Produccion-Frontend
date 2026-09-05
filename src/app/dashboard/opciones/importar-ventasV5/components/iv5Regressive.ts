/**
 * Etapa 1 IV5 - Regresiva semanal.
 *
 * Por cada (linea, semana_t) calcula el deficit agregado:
 *   deficit_t = max(0, sum_uds_necesidad_t * tupp - capacidad_t)
 *
 * Si hay deficit en t, busca semanas anteriores t-1, t-2... con holgura libre
 * y reserva produccion adelantada repartida proporcional al **tiempo
 * equivalente** de los materiales que componen el deficit (Q17).
 *
 * El resultado es un mapa por (linea, weekKey, material) de uds adelantadas
 * que se sumaran a `produccionAdelanto` en la progresiva.
 *
 * No modifica capacidades crudas; reduce `minDisponibles` mediante
 * `reserveMinutes`.
 */

import { safeNumber } from '../../importar-ventasV2/components/utils';
import type { Iv5MaterialWeekNeed, LineaKey, MaterialKey, WeekKey } from './iv5Types';
import { type Iv5CapacityMatrix, getCapacityCell, reserveMinutes } from './iv5Capacity';
import type { MaterialMeta } from './iv5Necesidad';
import { IV5_VIRTUAL_TRANSFER_LINE } from './iv5Constants';

export interface Iv5AdvanceMap {
  /** key: `${linea}|${weekKey}|${material}` -> uds adelantadas en esa semana origen. */
  byKey: Map<string, number>;
}

export interface Iv5RegressiveResult {
  advances: Iv5AdvanceMap;
  /** Para diagnostico: deficits residuales por (linea, weekKey) tras la pasada. */
  deficitResidualMin: Map<string, number>;
}

interface ScopedNeed {
  weekKey: WeekKey;
  isoWeek: number;
  isoYear: number;
  mes: number;
  anio: number;
  material: MaterialKey;
  uds: number;
  tupp: number;
}

function keyAdv(linea: LineaKey, weekKey: WeekKey, material: MaterialKey): string {
  return `${linea}|${weekKey}|${material}`;
}

function keyLW(linea: LineaKey, weekKey: WeekKey): string {
  return `${linea}|${weekKey}`;
}

export function runIv5Regressive(
  needs: Iv5MaterialWeekNeed[],
  metas: Map<MaterialKey, MaterialMeta>,
  capacity: Iv5CapacityMatrix,
): Iv5RegressiveResult {
  const advances: Iv5AdvanceMap = { byKey: new Map() };
  const deficitResidualMin = new Map<string, number>();

  // Agrupa por linea -> weekKey -> needs
  const byLineWeek = new Map<LineaKey, Map<WeekKey, ScopedNeed[]>>();
  // Necesitamos un orden cronologico de weekKeys por linea para saltar hacia atras.
  const orderByLine = new Map<LineaKey, WeekKey[]>();
  const seenOrder = new Map<LineaKey, Set<WeekKey>>();

  for (const n of needs) {
    // La linea virtual de C2000 no tiene capacidad fisica (capTotal=0). Sus
    // shadow needs se cubren via trasladoEntrante en la progresiva, no
    // requieren reservas regresivas.
    if (n.linea === IV5_VIRTUAL_TRANSFER_LINE) continue;
    const dem = safeNumber(n.demanda) + safeNumber(n.necesidadTraslado);
    if (dem <= 0) continue;
    const meta = metas.get(n.material);
    if (!meta) continue;
    const slot: ScopedNeed = {
      weekKey: n.weekKey,
      isoWeek: n.isoWeek,
      isoYear: n.isoYear,
      mes: n.mes,
      anio: n.anio,
      material: n.material,
      uds: dem,
      tupp: n.tupp,
    };
    let byWeek = byLineWeek.get(n.linea);
    if (!byWeek) {
      byWeek = new Map();
      byLineWeek.set(n.linea, byWeek);
    }
    let arr = byWeek.get(n.weekKey);
    if (!arr) {
      arr = [];
      byWeek.set(n.weekKey, arr);
    }
    arr.push(slot);

    let order = orderByLine.get(n.linea);
    if (!order) {
      order = [];
      orderByLine.set(n.linea, order);
      seenOrder.set(n.linea, new Set());
    }
    const seen = seenOrder.get(n.linea)!;
    if (!seen.has(n.weekKey)) {
      seen.add(n.weekKey);
      order.push(n.weekKey);
    }
  }

  for (const [linea, order] of orderByLine.entries()) {
    order.sort((a, b) => {
      const ca = getCapacityCell(capacity, linea, a);
      const cb = getCapacityCell(capacity, linea, b);
      if (!ca || !cb) return 0;
      if (ca.isoYear !== cb.isoYear) return ca.isoYear - cb.isoYear;
      if (ca.isoWeek !== cb.isoWeek) return ca.isoWeek - cb.isoWeek;
      if (ca.anio !== cb.anio) return ca.anio - cb.anio;
      return ca.mes - cb.mes;
    });
  }

  // Recorrido en orden cronologico inverso (de la ultima a la primera) por linea.
  for (const [linea, byWeek] of byLineWeek.entries()) {
    const order = orderByLine.get(linea) ?? [];
    for (let i = order.length - 1; i >= 0; i--) {
      const weekKey = order[i];
      const cell = getCapacityCell(capacity, linea, weekKey);
      if (!cell) continue;
      const slots = byWeek.get(weekKey) ?? [];
      const tiempoRequerido = slots.reduce((s, sl) => s + sl.uds * sl.tupp, 0);
      const deficit = Math.max(0, tiempoRequerido - cell.minDisponibles);
      if (deficit <= 0) continue;
      // Ya reservamos lo que cabe en t (no aqui, lo hara la progresiva).
      // Anticipamos el deficit en t-1, t-2, ... mientras haya holgura libre.
      let pendienteMin = deficit;
      for (let j = i - 1; j >= 0 && pendienteMin > 0; j--) {
        const prevWeek = order[j];
        const prevCell = getCapacityCell(capacity, linea, prevWeek);
        if (!prevCell) continue;
        if (prevCell.minDisponibles <= 0) continue;
        const minsAReservar = Math.min(pendienteMin, prevCell.minDisponibles);
        // Distribuir minsAReservar entre slots proporcional al tiempo equivalente
        // de cada material en t (tiempo del deficit).
        for (const sl of slots) {
          if (minsAReservar <= 0) break;
          const tiempoSlot = Math.max(0, sl.uds * sl.tupp);
          if (tiempoSlot <= 0) continue;
          const cuota = (minsAReservar * tiempoSlot) / Math.max(0.0001, tiempoRequerido);
          const tupp = Math.max(0.0001, sl.tupp);
          const udsAdv = Math.max(0, Math.floor(cuota / tupp));
          if (udsAdv <= 0) continue;
          const minsAdv = udsAdv * tupp;
          const reserved = reserveMinutes(capacity, linea, prevWeek, minsAdv);
          if (reserved <= 0) continue;
          const k = keyAdv(linea, prevWeek, sl.material);
          advances.byKey.set(k, (advances.byKey.get(k) ?? 0) + Math.floor(reserved / tupp));
          pendienteMin -= reserved;
        }
        // Si no se pudo asignar a ningun slot por redondeos, abortamos esa semana
        if (pendienteMin === deficit) break;
      }
      if (pendienteMin > 0) {
        deficitResidualMin.set(keyLW(linea, weekKey), (deficitResidualMin.get(keyLW(linea, weekKey)) ?? 0) + pendienteMin);
      }
    }
  }

  return { advances, deficitResidualMin };
}
