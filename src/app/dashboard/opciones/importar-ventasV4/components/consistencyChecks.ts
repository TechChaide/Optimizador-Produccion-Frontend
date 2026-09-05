/**
 * Verificaciones IV4 entre la suma del ledger semanal y los totales mensuales
 * que entrego el motor reusado de IV3. Se ejecuta tras `closeRoundingDrift`
 * y deberia devolver lista vacia; si no, expone los descuadres detectados.
 */

import { safeNumber, normalizeMaterialCode } from '../../importar-ventasV2/components/utils';
import { getMesNumericoRegressive } from '../../importar-ventasV2/components/backlogRegressiveCompute';
import { aggregateLedgerToMonthly } from './ledgerCompute';
import type { DriftEntry, PlanLedgerWeek } from './types';

export function checkWeeklyVsMonthly(
  ledger: PlanLedgerWeek[],
  finalRowsCentro: any[],
  centro: string,
): DriftEntry[] {
  const monthly = aggregateLedgerToMonthly(ledger.filter(w => w.centro === centro));
  const monthlyByKey = new Map(monthly.map(m => [`${m.centro}|${m.material}|${m.anio}|${m.mes}`, m]));

  const out: DriftEntry[] = [];

  for (const r of finalRowsCentro) {
    const material = normalizeMaterialCode(r.CodMaterial);
    const mesNum = safeNumber(r._mesNumero) || getMesNumericoRegressive(r.mesRef || r.Mes);
    const anio = safeNumber(r._anioFila || r.Año || r.año);
    if (!mesNum || !anio) continue;
    const k = `${centro}|${material}|${anio}|${mesNum}`;
    const snap = monthlyByKey.get(k);
    if (!snap) continue;

    const expected = {
      produccion: safeNumber(r._prodViableTotal),
      despachosVentas: safeNumber(r._despachosVentas),
      trasladoSaliente: centro === '1000' ? safeNumber(r._despachosTraslado) : 0,
      trasladoEntrante: centro === '2000' ? safeNumber(r._trasladoEntranteDesdeC1000) : 0,
    };

    const got = {
      produccion: snap.produccion,
      despachosVentas: snap.despachosVentas,
      trasladoSaliente: snap.trasladoSaliente,
      trasladoEntrante: snap.trasladoEntrante,
    };

    (Object.keys(expected) as Array<keyof typeof expected>).forEach(metric => {
      const diff = Math.round(got[metric] - expected[metric]);
      if (Math.abs(diff) > 0) {
        out.push({
          centro,
          mes: mesNum,
          anio,
          metric,
          monthlyEngine: expected[metric],
          ledgerSum: got[metric],
          diff,
        });
      }
    });
  }

  return out;
}
