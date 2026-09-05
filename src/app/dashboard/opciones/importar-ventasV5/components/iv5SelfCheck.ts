/**
 * Auditoria runtime IV5.
 *
 * Verifica las 3 identidades obligatorias antes de aceptar una version IV5:
 *
 *  (1) Cuadre semanal por (centro, material, semana):
 *      stockFinal == stockInicial + produccionTotal + trasladoEntrante
 *                    - despachosVentas - trasladoSaliente
 *
 *  (2) Cuadre mensual = sum semanal por (centro, material, mes):
 *      monthly.demanda == sum(weekly.demanda)
 *      monthly.despachosVentas == sum(weekly.despachosVentas)
 *      monthly.produccionTotal == sum(weekly.produccionTotal)
 *      monthly.stockInicialMes == primera weekly.stockInicial del mes
 *      monthly.stockFinalMes == ultima weekly.stockFinal del mes
 *
 *  (3) Traslados intercentro (cuando hay 1000 y 2000):
 *      sum(trasladoSaliente C1000) ~= sum(trasladoEntrante C2000) por material
 *
 * Devuelve `Iv5DiagnosticEntry[]` con severidad "error" en caso de descuadres
 * y "info" si todo cuadra.
 */

import type { Iv5DiagnosticEntry, Iv5MonthlySnapshot, Iv5WeeklyRow } from './iv5Types';

const EPS = 0.5;

function totalProdWeekly(r: Iv5WeeklyRow): number {
  return r.produccionBase + r.produccionAlternativa + r.produccionAdelanto + r.produccionPio;
}
function totalProdMonthly(r: Iv5MonthlySnapshot): number {
  return r.produccionBase + r.produccionAlternativa + r.produccionAdelanto + r.produccionPio;
}

export function iv5SelfCheck(params: {
  weeklyAll: Iv5WeeklyRow[];
  monthlyAll: Iv5MonthlySnapshot[];
}): Iv5DiagnosticEntry[] {
  const { weeklyAll, monthlyAll } = params;
  const out: Iv5DiagnosticEntry[] = [];

  // (1) cuadre semanal
  for (const r of weeklyAll) {
    const prodTotal = totalProdWeekly(r);
    const expected =
      r.stockInicial + prodTotal + r.trasladoEntrante - r.despachosVentas - r.trasladoSaliente;
    const diff = Math.abs(expected - r.stockFinal);
    if (diff > EPS) {
      out.push({
        severity: 'error',
        centro: r.centro,
        mes: r.mes,
        anio: r.anio,
        isoYear: r.isoYear,
        isoWeek: r.isoWeek,
        linea: r.linea,
        material: r.material,
        code: 'DRIFT_WEEK_VS_MONTH',
        mensaje: `Cuadre semanal roto: esperado ${expected.toFixed(2)} vs stockFinal ${r.stockFinal.toFixed(2)} (diff ${diff.toFixed(2)}).`,
        data: { prodTotal, expected, diff },
      });
    }
  }

  // (2) cuadre mensual = agregacion semanal
  const weeklyByCMM = new Map<string, Iv5WeeklyRow[]>();
  for (const r of weeklyAll) {
    const k = `${r.centro}|${r.linea}|${r.material}|${r.anio}|${r.mes}`;
    const arr = weeklyByCMM.get(k) ?? [];
    arr.push(r);
    weeklyByCMM.set(k, arr);
  }

  for (const m of monthlyAll) {
    const k = `${m.centro}|${m.linea}|${m.material}|${m.anio}|${m.mes}`;
    const ws = (weeklyByCMM.get(k) ?? []).sort((a, b) => {
      if (a.isoYear !== b.isoYear) return a.isoYear - b.isoYear;
      if (a.isoWeek !== b.isoWeek) return a.isoWeek - b.isoWeek;
      if (a.anio !== b.anio) return a.anio - b.anio;
      return a.mes - b.mes;
    });
    if (ws.length === 0) {
      // Meses sinteticos de inventario plano (sin semanas en ledger) por arrastre IV5.
      const idleCarry =
        m.semanasContadas === 0 &&
        Math.abs(m.stockInicialMes - m.stockFinalMes) < EPS &&
        m.demanda === 0 &&
        m.necesidadTraslado === 0 &&
        m.despachosVentas === 0 &&
        totalProdMonthly(m) < EPS;
      if (idleCarry) continue;
      out.push({
        severity: 'warn',
        centro: m.centro,
        mes: m.mes,
        anio: m.anio,
        material: m.material,
        code: 'DRIFT_WEEK_VS_MONTH',
        mensaje: 'Snapshot mensual sin filas semanales asociadas.',
      });
      continue;
    }
    const sumDem = ws.reduce((s, r) => s + r.demanda, 0);
    const sumTrasNeed = ws.reduce((s, r) => s + r.necesidadTrasladoSemana, 0);
    const sumDesp = ws.reduce((s, r) => s + r.despachosVentas, 0);
    const sumProd = ws.reduce((s, r) => s + totalProdWeekly(r), 0);
    const sumTrasS = ws.reduce((s, r) => s + r.trasladoSaliente, 0);
    const sumTrasE = ws.reduce((s, r) => s + r.trasladoEntrante, 0);
    const expectedProd = totalProdMonthly(m);
    const checks: Array<{ label: string; actual: number; expected: number }> = [
      { label: 'demanda', actual: m.demanda, expected: sumDem },
      { label: 'necesidadTraslado', actual: m.necesidadTraslado, expected: sumTrasNeed },
      { label: 'demandaPlan', actual: m.demandaPlan, expected: sumDem + sumTrasNeed },
      { label: 'despachos', actual: m.despachosVentas, expected: sumDesp },
      { label: 'produccionTotal', actual: expectedProd, expected: sumProd },
      { label: 'trasladoSaliente', actual: m.trasladoSaliente, expected: sumTrasS },
      { label: 'trasladoEntrante', actual: m.trasladoEntrante, expected: sumTrasE },
      { label: 'stockInicial', actual: m.stockInicialMes, expected: ws[0].stockInicial },
      { label: 'stockFinal', actual: m.stockFinalMes, expected: ws[ws.length - 1].stockFinal },
      { label: 'backlogFinal', actual: m.backlogFinalMes, expected: ws[ws.length - 1].backlogFinal },
    ];
    for (const c of checks) {
      if (Math.abs(c.actual - c.expected) > EPS) {
        out.push({
          severity: 'error',
          centro: m.centro,
          mes: m.mes,
          anio: m.anio,
          material: m.material,
          code: 'DRIFT_WEEK_VS_MONTH',
          mensaje: `Cuadre mensual ${c.label}: snapshot ${c.actual.toFixed(2)} vs sum semanal ${c.expected.toFixed(2)}.`,
        });
      }
    }
  }

  // (3) traslados intercentro
  const trasladoSalientePorMat = new Map<string, number>();
  const trasladoEntrantePorMat = new Map<string, number>();
  for (const r of weeklyAll) {
    if (r.centro === '1000' && r.trasladoSaliente > 0) {
      trasladoSalientePorMat.set(r.material, (trasladoSalientePorMat.get(r.material) ?? 0) + r.trasladoSaliente);
    }
    if (r.centro === '2000' && r.trasladoEntrante > 0) {
      trasladoEntrantePorMat.set(r.material, (trasladoEntrantePorMat.get(r.material) ?? 0) + r.trasladoEntrante);
    }
  }
  const allMats = new Set<string>([...trasladoSalientePorMat.keys(), ...trasladoEntrantePorMat.keys()]);
  for (const mat of allMats) {
    const sale = trasladoSalientePorMat.get(mat) ?? 0;
    const entra = trasladoEntrantePorMat.get(mat) ?? 0;
    if (Math.abs(sale - entra) > EPS) {
      out.push({
        severity: 'warn',
        centro: '1000',
        material: mat,
        code: 'DRIFT_WEEK_VS_MONTH',
        mensaje: `Traslado 1000->2000 desbalanceado: sale ${sale.toFixed(0)}, entra ${entra.toFixed(0)}.`,
        data: { sale, entra },
      });
    }
  }

  if (out.length === 0) {
    out.push({
      severity: 'info',
      centro: '',
      code: 'INFO',
      mensaje: `Cuadre OK: ${weeklyAll.length.toLocaleString('es-EC')} filas semanales, ${monthlyAll.length.toLocaleString('es-EC')} snapshots mensuales y traslados consistentes.`,
    });
  }
  return out;
}
