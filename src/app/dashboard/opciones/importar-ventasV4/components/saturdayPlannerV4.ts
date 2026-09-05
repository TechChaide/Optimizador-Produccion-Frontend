/**
 * Planificador de sabados IV4.
 *
 * Encapsula:
 *  - propuesta automatica por mes (formula reusada de IV3:
 *    `Math.ceil((diasSabados * horasExtrasFin) / 5)`),
 *  - sembrado de seleccion por centro,
 *  - aplicacion incremental de cambios (toggle, on, off),
 *  - poda de claves cuando cambian filtros.
 *
 * No toca archivos de IV3.
 */

import type { WeekSegment } from '../../plan-semanal/components/types';
import type { TiempoCanonResult } from '../../importar-ventasV2/components/types';

export interface SaturdayProposalForMonth {
  required: number;
  /** satKeys disponibles en el mes, en orden cronologico ascendente. */
  satKeys: string[];
}

/** Mapa por mes en formato `YYYY-MM` -> propuesta. */
export type SaturdayProposalByMonth = Map<string, SaturdayProposalForMonth>;

export type SaturdayAction = 'on' | 'off' | 'toggle';

function monthKey(anio: number, mes: number): string {
  return `${anio}-${String(mes).padStart(2, '0')}`;
}

/**
 * Calcula cuantos sabados se requieren en un mes y que `satKey` estan
 * disponibles en los `weekSegments`.
 */
export function proposeSaturdaysForMonth(
  tc: TiempoCanonResult | undefined,
  weekSegments: WeekSegment[],
  horasExtrasFin: number,
  anio: number,
  mes: number,
): SaturdayProposalForMonth {
  const required = tc
    ? Math.ceil((Number(tc.diasSabados || 0) * Number(horasExtrasFin || 0)) / 5)
    : 0;
  const satKeys = weekSegments
    .filter(seg => seg.tieneSabado && seg.anio === anio && seg.mes === mes)
    .sort((a, b) => {
      if (a.isoYear !== b.isoYear) return a.isoYear - b.isoYear;
      return a.isoWeek - b.isoWeek;
    })
    .map(seg => seg.satKey);
  return { required: Math.max(0, required), satKeys };
}

/**
 * Construye la propuesta de sabados para todos los meses seleccionados.
 *
 * Si un mes esta en `meses` pero no aparece en `tiemposCanon`, igual queda
 * registrado con `required = 0` y sus `satKeys` segun `weekSegments` (asi
 * la UI puede mostrar las semanas y permitir activacion manual).
 */
export function buildSaturdayProposalByMonth(params: {
  tiemposCanon: TiempoCanonResult[];
  weekSegments: WeekSegment[];
  meses: number[];
  anio: number;
  horasExtrasFin: number;
}): SaturdayProposalByMonth {
  const { tiemposCanon, weekSegments, meses, anio, horasExtrasFin } = params;
  const tcByMes = new Map<number, TiempoCanonResult>();
  for (const tc of tiemposCanon) tcByMes.set(tc.mesNumero, tc);

  const out: SaturdayProposalByMonth = new Map();
  for (const m of meses) {
    if (!Number.isFinite(m) || m < 1 || m > 12) continue;
    const tc = tcByMes.get(m);
    out.set(monthKey(anio, m), proposeSaturdaysForMonth(tc, weekSegments, horasExtrasFin, anio, m));
  }
  return out;
}

/**
 * Devuelve las semanas que el sistema identifico automaticamente (las
 * primeras `required` de cada mes), util para sembrar y resaltar en UI.
 */
export function getSystemIdentifiedSatKeys(proposal: SaturdayProposalByMonth): Set<string> {
  const keys = new Set<string>();
  for (const cfg of proposal.values()) {
    const n = Math.max(0, cfg.required);
    for (const sk of cfg.satKeys.slice(0, n)) keys.add(sk);
  }
  return keys;
}

function cloneCenterRecord(rec: Record<string, Set<string>>, centros: string[]): Record<string, Set<string>> {
  const next: Record<string, Set<string>> = {};
  for (const c of centros) {
    const s = rec[c];
    next[c] = s ? new Set(s) : new Set<string>();
  }
  return next;
}

/**
 * Limpia claves de centros que ya no estan en filtros. No agrega nuevas.
 */
export function pruneSelectionToCentros(
  rec: Record<string, Set<string>>,
  centros: string[],
): Record<string, Set<string>> {
  return cloneCenterRecord(rec, centros);
}

/**
 * Para cada centro sin seleccion, aplica el sembrado del sistema (las
 * semanas identificadas por la propuesta automatica). No sobrescribe
 * selecciones manuales existentes.
 */
export function seedSelectionFromProposal(
  rec: Record<string, Set<string>>,
  centros: string[],
  systemSat: Set<string>,
): Record<string, Set<string>> {
  const next = cloneCenterRecord(rec, centros);
  for (const c of centros) {
    const s = next[c];
    if ((!s || s.size === 0) && systemSat.size > 0) {
      next[c] = new Set(systemSat);
    }
  }
  return next;
}

/**
 * Aplica una accion atomica sobre la seleccion (toggle/on/off) para un
 * centro y semana sabado dada. Devuelve nuevo record sin mutar el original.
 */
export function applySaturdayChange(
  state: Record<string, Set<string>>,
  centro: string,
  satKey: string,
  action: SaturdayAction,
): Record<string, Set<string>> {
  const base = state[centro] ?? new Set<string>();
  const next = new Set(base);
  switch (action) {
    case 'on':
      next.add(satKey);
      break;
    case 'off':
      next.delete(satKey);
      break;
    case 'toggle':
      if (next.has(satKey)) next.delete(satKey);
      else next.add(satKey);
      break;
  }
  return { ...state, [centro]: next };
}

/**
 * Une la propuesta automatica con la seleccion manual existente del centro
 * y devuelve la seleccion resultante para todos los centros (la del centro
 * objetivo queda fusionada; los demas centros se mantienen igual).
 */
export function mergeProposalForCenter(
  state: Record<string, Set<string>>,
  centros: string[],
  centro: string,
  proposal: SaturdayProposalByMonth,
): Record<string, Set<string>> {
  const merged = new Set<string>();
  for (const cfg of proposal.values()) {
    for (const sk of cfg.satKeys.slice(0, cfg.required)) merged.add(sk);
  }
  const manual = state[centro] ?? new Set<string>();
  const next = cloneCenterRecord(state, centros);
  next[centro] = new Set<string>([...merged, ...manual]);
  return next;
}

/**
 * Cuenta cuantos sabados confirmados existen en el mes/anio para un centro,
 * usando los `weekSegments` y la seleccion activa.
 */
export function countSelectedSatInMonth(params: {
  weekSegments: WeekSegment[];
  byCenter: Record<string, Set<string>>;
  centro: string;
  mes: number;
  anio: number;
}): number {
  const { weekSegments, byCenter, centro, mes, anio } = params;
  const keys = byCenter[centro] ?? new Set<string>();
  return weekSegments.filter(
    seg => seg.anio === anio && seg.mes === mes && seg.tieneSabado && keys.has(seg.satKey),
  ).length;
}
