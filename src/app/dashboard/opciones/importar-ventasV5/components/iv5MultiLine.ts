/**
 * IV5 - Multi-linea hibrido (Q28-29).
 *
 * El usuario confirmo el modelo hibrido en 2 etapas:
 *
 *  Etapa 0 (pre-pasada todo-o-nada): si la linea fija tendra deficit en el mes y
 *  alguna linea alternativa tiene `idleLibre >= deficit_mes_completo` del
 *  material, redirige TODO el material a la alternativa. Esto evita oscilacion
 *  semana a semana.
 *
 *  Etapa 2 (alternativas residuales con parcial): para deficits residuales que
 *  no pudieron resolverse via regresiva, se intenta produccion parcial en lineas
 *  alternativas (proporcional al idle libre por linea), con regla anti-oscilacion:
 *  una vez que un material elige una alternativa en un mes, no cambia para los
 *  meses siguientes a menos que la holgura desaparezca.
 *
 * El soporte multi-linea requiere conocer las "lineas posibles" por material.
 * Se obtiene del input `effectiveData` agrupando todas las `LineaFabricacion`
 * registradas para ese material en el rango. Esa informacion se calcula aqui
 * (no necesita un endpoint nuevo).
 */

import { safeNumber, normalizeMaterialCode } from '../../importar-ventasV2/components/utils';
import type { Centro, Iv5LineWeekCapacity, LineaKey, MaterialKey, WeekKey } from './iv5Types';
import { type Iv5CapacityMatrix, getCapacityCell, reserveMinutes, sumIdleByLinea } from './iv5Capacity';
import type { MaterialMeta } from './iv5Necesidad';

/** Mapa material -> lineas alternativas (excluyendo la linea fija). */
export type AlternativeLinesByMaterial = Map<MaterialKey, LineaKey[]>;

export function buildAlternativeLines(
  effectiveData: any[],
  centro: Centro,
  metas: Map<MaterialKey, MaterialMeta>,
): AlternativeLinesByMaterial {
  const out: AlternativeLinesByMaterial = new Map();
  const byMat = new Map<MaterialKey, Set<LineaKey>>();
  for (const r of effectiveData) {
    const cf = String(r.CentroFabricacion ?? r.Centro ?? '').trim();
    if (cf !== String(centro)) continue;
    const code = normalizeMaterialCode(r.CodMaterial);
    const linea = String(r.LineaFabricacion ?? r.lineaRef ?? '').trim();
    if (!code || !linea) continue;
    let set = byMat.get(code);
    if (!set) {
      set = new Set();
      byMat.set(code, set);
    }
    set.add(linea);
  }
  for (const [code, set] of byMat.entries()) {
    const meta = metas.get(code);
    if (!meta) continue;
    const alternativas = Array.from(set).filter((l) => l && l !== meta.lineaFija);
    if (alternativas.length > 0) out.set(code, alternativas);
  }
  return out;
}

/**
 * Etapa 0 - todo-o-nada.
 *
 * Para cada material con linea alternativa, calcula deficit_mensual_estimado
 * en su linea fija (necesidad mensual de tiempo - capacidad mensual). Si una
 * alternativa tiene `sumIdleByLinea >= deficit`, redirige TODOS los needs del
 * material en el horizonte a esa alternativa.
 *
 * Devuelve un mapa material -> lineaSeleccionada (puede ser la fija o una
 * alternativa). El caller debe re-asignar la linea de las needs respectivas.
 */
export interface Iv5RoutingDecision {
  material: MaterialKey;
  lineaOriginal: LineaKey;
  lineaSeleccionada: LineaKey;
  motivo: 'TODO_O_NADA' | 'PARCIAL_RESIDUAL' | 'FIJA';
}

export function runIv5PreEtapaTodoONada(params: {
  alternatives: AlternativeLinesByMaterial;
  metas: Map<MaterialKey, MaterialMeta>;
  capacity: Iv5CapacityMatrix;
  needsByLineMaterialMin: Map<string, number>; // `${linea}|${material}` -> minutos requeridos totales
}): Iv5RoutingDecision[] {
  const { alternatives, metas, capacity, needsByLineMaterialMin } = params;
  const decisions: Iv5RoutingDecision[] = [];
  for (const [material, alts] of alternatives.entries()) {
    const meta = metas.get(material);
    if (!meta) continue;
    const lineaFija = meta.lineaFija;
    const minRequeridos = needsByLineMaterialMin.get(`${lineaFija}|${material}`) ?? 0;
    if (minRequeridos <= 0) continue;
    let capFija = 0;
    const cellsFija = capacity.get(lineaFija);
    if (cellsFija) for (const c of cellsFija.values()) capFija += c.minDisponibles;
    const deficit = Math.max(0, minRequeridos - capFija);
    if (deficit <= 0) continue;
    let mejorAlt: LineaKey | null = null;
    let mejorIdle = -1;
    for (const alt of alts) {
      const idle = sumIdleByLinea(capacity, alt);
      if (idle >= deficit && idle > mejorIdle) {
        mejorIdle = idle;
        mejorAlt = alt;
      }
    }
    if (mejorAlt) {
      decisions.push({
        material,
        lineaOriginal: lineaFija,
        lineaSeleccionada: mejorAlt,
        motivo: 'TODO_O_NADA',
      });
    }
  }
  return decisions;
}

/**
 * Etapa 2 - alternativas residuales (parcial).
 *
 * Para cada deficit residual que la regresiva no pudo absorber, intenta
 * reservar minutos en una alternativa con holgura. Anti-oscilacion: si el
 * material ya tomo una alternativa en un mes anterior, prefiere esa misma.
 */
export function runIv5AlternativasResiduales(params: {
  centro: Centro;
  alternatives: AlternativeLinesByMaterial;
  capacity: Iv5CapacityMatrix;
  deficitResidual: Map<string, number>; // `${linea}|${weekKey}` -> minutos no atendidos
  needsByLineWeekMaterial: Map<string, { material: MaterialKey; uds: number; tupp: number }[]>; // `${linea}|${weekKey}` -> slots
  preferenciaAltPorMatMes?: Map<string, LineaKey>; // `${material}|${anio}-${mes}` -> alt elegida
}): {
  altProductionByKey: Map<string, number>; // `${altLinea}|${weekKey}|${material}` -> uds asignadas
  decisions: Iv5RoutingDecision[];
} {
  const { capacity, deficitResidual, needsByLineWeekMaterial, alternatives, preferenciaAltPorMatMes } = params;
  const altProductionByKey = new Map<string, number>();
  const decisions: Iv5RoutingDecision[] = [];

  for (const [lwKey, deficit] of deficitResidual.entries()) {
    if (deficit <= 0) continue;
    const [linea, weekKey] = lwKey.split('|') as [LineaKey, WeekKey];
    const slots = needsByLineWeekMaterial.get(lwKey) ?? [];
    if (slots.length === 0) continue;
    const cellOriginal = getCapacityCell(capacity, linea, weekKey);
    if (!cellOriginal) continue;
    let pendiente = deficit;
    const tiempoTotal = slots.reduce((s, sl) => s + sl.uds * sl.tupp, 0);
    if (tiempoTotal <= 0) continue;

    for (const sl of slots) {
      if (pendiente <= 0) break;
      const alts = alternatives.get(sl.material);
      if (!alts || alts.length === 0) continue;
      const cuotaMin = (deficit * sl.uds * sl.tupp) / tiempoTotal;
      const tupp = Math.max(0.0001, sl.tupp);
      let udsRestantes = Math.max(0, Math.floor(cuotaMin / tupp));
      if (udsRestantes <= 0) continue;

      // Preferencia anti-oscilacion: usar la alt previa en el mismo mes si existe.
      const monthKey = `${sl.material}|${cellOriginal.anio}-${cellOriginal.mes}`;
      const altPreferida = preferenciaAltPorMatMes?.get(monthKey);
      const sortedAlts = [...alts].sort((a, b) => {
        if (a === altPreferida) return -1;
        if (b === altPreferida) return 1;
        return sumIdleByLinea(capacity, b) - sumIdleByLinea(capacity, a);
      });

      for (const alt of sortedAlts) {
        if (udsRestantes <= 0) break;
        const altCell = getCapacityCell(capacity, alt, weekKey);
        if (!altCell || altCell.minDisponibles <= 0) continue;
        const minsADedicar = Math.min(udsRestantes * tupp, altCell.minDisponibles);
        const reservado = reserveMinutes(capacity, alt, weekKey, minsADedicar);
        const udsAsignadas = Math.floor(reservado / tupp);
        if (udsAsignadas <= 0) continue;
        const k = `${alt}|${weekKey}|${sl.material}`;
        altProductionByKey.set(k, (altProductionByKey.get(k) ?? 0) + udsAsignadas);
        udsRestantes -= udsAsignadas;
        pendiente -= udsAsignadas * tupp;
        if (preferenciaAltPorMatMes && !preferenciaAltPorMatMes.has(monthKey)) {
          preferenciaAltPorMatMes.set(monthKey, alt);
        }
        decisions.push({
          material: sl.material,
          lineaOriginal: linea,
          lineaSeleccionada: alt,
          motivo: 'PARCIAL_RESIDUAL',
        });
      }
    }
  }

  return { altProductionByKey, decisions };
}

/** Helper: agrega minutos requeridos por (linea, material) sumando todas las semanas. */
export function buildNeedsByLineMaterialMin(
  needs: Array<{ linea: LineaKey; material: MaterialKey; demanda: number; necesidadTraslado?: number; tupp: number }>,
): Map<string, number> {
  const out = new Map<string, number>();
  for (const n of needs) {
    const k = `${n.linea}|${n.material}`;
    const mins =
      (safeNumber(n.demanda) + safeNumber(n.necesidadTraslado ?? 0)) * safeNumber(n.tupp);
    out.set(k, (out.get(k) ?? 0) + mins);
  }
  return out;
}

/** Helper: agrupa slots por (linea, weekKey) para la etapa 2. */
export function buildNeedsByLineWeekMaterial(
  needs: Array<{ linea: LineaKey; weekKey: WeekKey; material: MaterialKey; demanda: number; necesidadTraslado?: number; tupp: number }>,
): Map<string, { material: MaterialKey; uds: number; tupp: number }[]> {
  const out = new Map<string, { material: MaterialKey; uds: number; tupp: number }[]>();
  for (const n of needs) {
    const uds = safeNumber(n.demanda) + safeNumber(n.necesidadTraslado ?? 0);
    if (uds <= 0) continue;
    const k = `${n.linea}|${n.weekKey}`;
    const arr = out.get(k) ?? [];
    arr.push({ material: n.material, uds, tupp: n.tupp });
    out.set(k, arr);
  }
  return out;
}

/** Util: imprime resumen de cells (debug). */
export function debugCapacitySummary(capacity: Iv5CapacityMatrix): Array<{ linea: LineaKey; capTotal: number; idleTotal: number }> {
  const out: Array<{ linea: LineaKey; capTotal: number; idleTotal: number }> = [];
  for (const [linea, byWeek] of capacity.entries()) {
    let capTotal = 0;
    let idleTotal = 0;
    for (const cell of byWeek.values()) {
      capTotal += cell.capTotal;
      idleTotal += cell.minDisponibles;
    }
    out.push({ linea, capTotal, idleTotal });
  }
  return out;
}

/** Tipo de cell exportado para callers que lo necesitan. */
export type { Iv5LineWeekCapacity };
