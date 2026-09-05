/**
 * Aplica una fase de "relleno semanal" sobre el ledger IV4.
 *
 * Toma el `idle` de capacidad disponible por (linea, semana) y produce
 * unidades adicionales con prioridad:
 *   1) PIO     - hasta inventario objetivo del material (`pioMap`).
 *   2) Adelanto - cubre demanda futura no cubierta del mismo material.
 *   3) Backlog  - reduce backlog inicial heredado en la semana.
 *
 * Las unidades nuevas se acumulan en `produccionFill` (separadas de la
 * `produccion` del motor mensual) y nunca tocan filas de otro centro.
 *
 * Es seguro respecto a doble conteo:
 *   - El idle se calcula como `capTotal - sum(produccion*tupp)` por
 *     (centro, linea, semana) ANTES de iniciar el fill. Esto significa
 *     que cualquier minuto que el motor mensual ya uso queda fuera de la
 *     bolsa y nunca se cuenta dos veces.
 *   - Los materiales que comparten linea-semana comparten una sola bolsa
 *     de idle; el primer material en orden la consume y el siguiente solo
 *     ve lo que sobra.
 */

import type { PioMap } from '../../importar-ventasV2/components/types';
import { rebalanceArrastres } from './ledgerCompute';
import type { PlanLedgerWeek } from './types';

export interface ApplyWeeklyFillParams {
  ledger: PlanLedgerWeek[];
  pioMap: PioMap;
  centro: string;
  /** Si se provee, el fill solo procesa semanas a partir de esta clave (incluida). */
  startWeekKey?: string;
}

interface FillStats {
  materialesProcesados: number;
  semanasConFill: number;
  unidadesPIO: number;
  unidadesAdelanto: number;
  unidadesBacklog: number;
  minutosConsumidos: number;
}

export interface ApplyWeeklyFillResult {
  ledger: PlanLedgerWeek[];
  stats: FillStats;
}

function lineWeekKey(centro: string, linea: string, weekKey: string): string {
  return `${centro}|${linea}|${weekKey}`;
}

function compareWeekChrono(a: PlanLedgerWeek, b: PlanLedgerWeek): number {
  if (a.isoYear !== b.isoYear) return a.isoYear - b.isoYear;
  if (a.isoWeek !== b.isoWeek) return a.isoWeek - b.isoWeek;
  if (a.anio !== b.anio) return a.anio - b.anio;
  return a.mes - b.mes;
}

/**
 * Construye la bolsa de idle por (centro, linea, semana) sumando capTotal y
 * restando los minutos ya consumidos por la produccion del motor mensual.
 *
 * Se toma la `capTotal` del primer registro encontrado para la clave (ya
 * que todas las filas de la misma linea-semana tienen la misma capacidad
 * por construccion en `buildLedgerFromMonthly`).
 */
function buildIdleByLineWeek(rows: PlanLedgerWeek[]): Map<string, number> {
  const cap = new Map<string, number>();
  const used = new Map<string, number>();
  for (const w of rows) {
    const k = lineWeekKey(w.centro, w.linea, w.weekKey);
    if (!cap.has(k)) cap.set(k, w.capTotal);
    used.set(k, (used.get(k) || 0) + Math.round(w.produccion * w.tupp));
  }
  const idle = new Map<string, number>();
  for (const [k, c] of cap.entries()) {
    idle.set(k, Math.max(0, c - (used.get(k) || 0)));
  }
  return idle;
}

/**
 * Recalcula `stockFinal`/`backlogFinal` aplicando arrastres semana a semana
 * sobre un subset de un solo material (in place).
 */
function rebalanceMaterialInPlace(weeksMat: PlanLedgerWeek[], fromIdx: number): void {
  if (!weeksMat.length) return;
  const start = Math.max(0, fromIdx);
  let prevStock = start === 0 ? weeksMat[0].stockInicial : weeksMat[start - 1].stockFinal;
  let prevBacklog = start === 0 ? weeksMat[0].backlogInicial : weeksMat[start - 1].backlogFinal;
  for (let i = start; i < weeksMat.length; i += 1) {
    const w = weeksMat[i];
    w.stockInicial = prevStock;
    w.backlogInicial = prevBacklog;
    const disponible = w.stockInicial + w.produccion + w.produccionFill + w.trasladoEntrante;
    const salidas = w.despachosVentas + w.trasladoSaliente;
    const stockFinal = Math.max(0, disponible - salidas);
    const backlogFinal = Math.max(0, w.demanda + w.backlogInicial - w.despachosVentas);
    w.stockFinal = stockFinal;
    w.backlogFinal = backlogFinal;
    prevStock = stockFinal;
    prevBacklog = backlogFinal;
  }
}

/**
 * Devuelve un orden estable de materiales priorizando los de mayor
 * `promDiario` en `pioMap` (alta rotacion primero) y luego alfabetico.
 */
function orderMaterials(materials: string[], pioMap: PioMap, centro: string): string[] {
  return [...materials].sort((a, b) => {
    const pa = pioMap.get(`${a}|${centro}`)?.promDiario ?? 0;
    const pb = pioMap.get(`${b}|${centro}`)?.promDiario ?? 0;
    if (pb !== pa) return pb - pa;
    return a.localeCompare(b);
  });
}

export function applyWeeklyFill(params: ApplyWeeklyFillParams): ApplyWeeklyFillResult {
  const { ledger, pioMap, centro, startWeekKey } = params;
  const stats: FillStats = {
    materialesProcesados: 0,
    semanasConFill: 0,
    unidadesPIO: 0,
    unidadesAdelanto: 0,
    unidadesBacklog: 0,
    minutosConsumidos: 0,
  };

  if (!ledger.length) return { ledger, stats };

  const work = ledger.filter(w => w.centro === centro);
  if (!work.length) return { ledger, stats };

  const idleByLineWeek = buildIdleByLineWeek(work);

  const byMaterial = new Map<string, PlanLedgerWeek[]>();
  for (const w of work) {
    if (!byMaterial.has(w.material)) byMaterial.set(w.material, []);
    byMaterial.get(w.material)!.push(w);
  }
  for (const list of byMaterial.values()) list.sort(compareWeekChrono);

  const materialsOrdered = orderMaterials(Array.from(byMaterial.keys()), pioMap, centro);

  for (const material of materialsOrdered) {
    const weeksMat = byMaterial.get(material)!;
    rebalanceMaterialInPlace(weeksMat, 0);

    const startIdx = startWeekKey
      ? Math.max(0, weeksMat.findIndex(w => w.weekKey === startWeekKey))
      : 0;

    let materialUsedFill = false;

    for (let i = startIdx; i < weeksMat.length; i += 1) {
      const w = weeksMat[i];
      const lk = lineWeekKey(w.centro, w.linea, w.weekKey);
      let avail = idleByLineWeek.get(lk) || 0;
      if (avail <= 0 || w.tupp <= 0) continue;

      let consumedHere = 0;

      // 1) PIO: producir hasta llegar al inventario objetivo.
      const pioEntry = pioMap.get(`${material}|${centro}`);
      if (pioEntry && w.stockFinal < pioEntry.invObjetivo) {
        const targetExtra = pioEntry.invObjetivo - w.stockFinal;
        const units = Math.min(targetExtra, Math.floor(avail / w.tupp));
        if (units > 0) {
          w.produccionFill += units;
          avail -= units * w.tupp;
          consumedHere += units * w.tupp;
          stats.unidadesPIO += units;
          rebalanceMaterialInPlace(weeksMat, i);
        }
      }

      // 2) Adelanto: cubrir demanda futura no satisfecha por stock + produccion futura.
      if (avail > 0) {
        let futuraDemanda = 0;
        let futuraOferta = 0;
        for (let j = i + 1; j < weeksMat.length; j += 1) {
          futuraDemanda += weeksMat[j].demanda;
          futuraOferta += weeksMat[j].produccion + weeksMat[j].produccionFill;
        }
        const demandaResidual = Math.max(0, futuraDemanda - futuraOferta - w.stockFinal);
        if (demandaResidual > 0) {
          const units = Math.min(demandaResidual, Math.floor(avail / w.tupp));
          if (units > 0) {
            w.produccionFill += units;
            avail -= units * w.tupp;
            consumedHere += units * w.tupp;
            stats.unidadesAdelanto += units;
            rebalanceMaterialInPlace(weeksMat, i);
          }
        }
      }

      // 3) Backlog: reducir backlog heredado / pendiente en la semana actual.
      if (avail > 0 && w.backlogFinal > 0) {
        const units = Math.min(w.backlogFinal, Math.floor(avail / w.tupp));
        if (units > 0) {
          w.produccionFill += units;
          avail -= units * w.tupp;
          consumedHere += units * w.tupp;
          stats.unidadesBacklog += units;
          rebalanceMaterialInPlace(weeksMat, i);
        }
      }

      if (consumedHere > 0) {
        idleByLineWeek.set(lk, avail);
        w.idleSem = avail;
        w.minUsadosBase += consumedHere;
        stats.minutosConsumidos += consumedHere;
        stats.semanasConFill += 1;
        materialUsedFill = true;
      }
    }

    if (materialUsedFill) stats.materialesProcesados += 1;
  }

  // Re-balance global para asegurar consistencia entre centros y arrastres.
  const finalLedger = rebalanceArrastres(ledger);
  return { ledger: finalLedger, stats };
}
