/**
 * Decisión de sábados dirigida por NECESIDAD (motor rediseñado).
 *
 * Envuelve a `runIv5EngineRediseñado` sin tocar el núcleo. Abre sábados (hasta
 * el tope `maxSabadosMes` por centro/mes) SOLO cuando reducen backlog, eligiendo
 * de a uno el que más lo reduce (greedy). El motor (con R1 + anticipación) usa
 * cada sábado abierto: cubre primero demanda/seguridad y el sobrante va al
 * objetivo; la anticipación aprovecha el ocioso del sábado para pre-trasladar.
 *
 * El conjunto ganador se congela y la corrida final es determinística. Cada
 * sábado abierto queda etiquetado:
 *  - 'operativo': redujo backlog en SU MISMO mes.
 *  - 'anticipacion': redujo backlog en un mes POSTERIOR (pre-build).
 */
import {
  runIv5EngineRediseñado,
  type Iv5EngineRediseñadoParams,
  type Iv5EngineRediseñadoResult,
} from './iv5EngineRediseñado';
import type { Centro } from './iv5Types';

export interface SabadoAbierto {
  centro: Centro;
  satKey: string;
  mes: number;
  anio: number;
  motivo: 'operativo' | 'anticipacion';
  /** uds de backlog que su apertura redujo (sobre el total). */
  backlogReducido: number;
}

export interface DecidirSabadosResult {
  /** Resultado final del motor con los sábados ya abiertos. */
  resultado: Iv5EngineRediseñadoResult;
  sabadosAbiertos: SabadoAbierto[];
  activeSatKeysC1000Final: Set<string>;
  activeSatKeysC2000Final: Set<string>;
}

/** Backlog acumulado (backlog-semanas) por `${anio}-${mes}` sobre ambos centros. */
function unmetPorMes(result: Iv5EngineRediseñadoResult): Map<string, number> {
  const m = new Map<string, number>();
  for (const r of [result.resultC1000, result.resultC2000]) {
    if (!r) continue;
    for (const row of r.ledger) {
      const k = `${row.anio}-${row.mes}`;
      m.set(k, (m.get(k) ?? 0) + (row.backlogFinal ?? 0));
    }
  }
  return m;
}
function totalUnmet(porMes: Map<string, number>): number {
  let t = 0;
  for (const v of porMes.values()) t += v;
  return t;
}

export function decidirSabados(
  params: Iv5EngineRediseñadoParams,
  maxIteraciones = 60,
): DecidirSabadosResult {
  const active1000 = new Set(params.activeSatKeysC1000);
  const active2000 = new Set(params.activeSatKeysC2000);

  // Sábados disponibles (semanas con sábado) y su mes/año.
  const satInfo = new Map<string, { mes: number; anio: number }>();
  for (const seg of params.weekSegments) {
    if (seg.tieneSabado && !satInfo.has(seg.satKey)) {
      satInfo.set(seg.satKey, { mes: seg.mes, anio: seg.anio });
    }
  }
  const allSat = Array.from(satInfo.keys());
  const maxSab = Math.max(0, Math.floor(params.maxSabadosMes || 0));

  const run = (a1: Set<string>, a2: Set<string>) =>
    runIv5EngineRediseñado({ ...params, activeSatKeysC1000: a1, activeSatKeysC2000: a2 });
  const countMes = (active: Set<string>, mes: number, anio: number) =>
    Array.from(active).filter((sk) => {
      const i = satInfo.get(sk);
      return i && i.mes === mes && i.anio === anio;
    }).length;

  let current = run(active1000, active2000);
  let currentPorMes = unmetPorMes(current);
  let currentTotal = totalUnmet(currentPorMes);
  const opened: SabadoAbierto[] = [];

  const centrosWanted: Centro[] = [];
  if (params.wantC1000) centrosWanted.push('1000');
  if (params.wantC2000) centrosWanted.push('2000');

  for (let iter = 0; iter < maxIteraciones && currentTotal > 0 && maxSab > 0; iter++) {
    let best:
      | { centro: Centro; satKey: string; result: Iv5EngineRediseñadoResult; porMes: Map<string, number>; total: number; improvement: number }
      | null = null;

    for (const centro of centrosWanted) {
      const active = centro === '1000' ? active1000 : active2000;
      for (const sk of allSat) {
        if (active.has(sk)) continue;
        const info = satInfo.get(sk)!;
        if (countMes(active, info.mes, info.anio) >= maxSab) continue; // tope mensual
        const a1 = centro === '1000' ? new Set([...active1000, sk]) : active1000;
        const a2 = centro === '2000' ? new Set([...active2000, sk]) : active2000;
        const tr = run(a1, a2);
        const trPorMes = unmetPorMes(tr);
        const trTotal = totalUnmet(trPorMes);
        const improvement = currentTotal - trTotal;
        if (!best || improvement > best.improvement) {
          best = { centro, satKey: sk, result: tr, porMes: trPorMes, total: trTotal, improvement };
        }
      }
    }

    if (!best || best.improvement < 1) break; // ningún sábado más reduce backlog

    // Commit del mejor sábado.
    const info = satInfo.get(best.satKey)!;
    (best.centro === '1000' ? active1000 : active2000).add(best.satKey);

    // Motivo: si el propio mes del sábado tenía backlog, es operativo (cubre el
    // faltante de ese mes); si su mes no tenía backlog pero igual reduce el de
    // un mes posterior, es anticipación (pre-build).
    const backlogPropioMes = currentPorMes.get(`${info.anio}-${info.mes}`) ?? 0;
    const motivo: 'operativo' | 'anticipacion' = backlogPropioMes > 0 ? 'operativo' : 'anticipacion';

    opened.push({
      centro: best.centro,
      satKey: best.satKey,
      mes: info.mes,
      anio: info.anio,
      motivo,
      backlogReducido: Math.round(best.improvement),
    });

    current = best.result;
    currentPorMes = best.porMes;
    currentTotal = best.total;
  }

  return {
    resultado: current,
    sabadosAbiertos: opened,
    activeSatKeysC1000Final: active1000,
    activeSatKeysC2000Final: active2000,
  };
}
