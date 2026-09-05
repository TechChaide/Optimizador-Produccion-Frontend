'use client';

import React, { useMemo } from 'react';
import type { DriftEntry, MonthlySnapshot, PlanLedgerWeek } from './types';

export interface FillStatsByCenter {
  centro: string;
  materialesProcesados: number;
  semanasConFill: number;
  unidadesPIO: number;
  unidadesAdelanto: number;
  unidadesBacklog: number;
  minutosConsumidos: number;
}

interface Props {
  ledgerC1000: PlanLedgerWeek[];
  ledgerC2000: PlanLedgerWeek[];
  monthlyC1000: MonthlySnapshot[];
  monthlyC2000: MonthlySnapshot[];
  fillStats: FillStatsByCenter[];
  drift: DriftEntry[];
}

interface LineMonthSummary {
  centro: string;
  linea: string;
  mes: number;
  anio: number;
  mesNombre: string;
  capTotal: number;
  capSab: number;
  idleAntesFill: number;
  idleDespuesFill: number;
  prodMotor: number;
  prodFill: number;
  sabadosActivos: number;
}

function fmt(n: number): string {
  if (!Number.isFinite(n)) return '-';
  return Math.round(n).toLocaleString('es-EC');
}

function buildLineMonthSummary(ledger: PlanLedgerWeek[]): LineMonthSummary[] {
  const out = new Map<string, LineMonthSummary>();
  // Para idle "antes del fill" usamos: capTotal - sum(produccion * tupp).
  // Para idle "despues del fill" usamos: capTotal - sum((produccion + produccionFill) * tupp).
  const capByLineWeek = new Map<string, number>();
  for (const w of ledger) {
    const lwk = `${w.centro}|${w.linea}|${w.weekKey}`;
    if (!capByLineWeek.has(lwk)) capByLineWeek.set(lwk, w.capTotal);
  }

  const usedBaseByLineWeek = new Map<string, number>();
  const usedTotalByLineWeek = new Map<string, number>();
  for (const w of ledger) {
    const lwk = `${w.centro}|${w.linea}|${w.weekKey}`;
    usedBaseByLineWeek.set(lwk, (usedBaseByLineWeek.get(lwk) || 0) + Math.round(w.produccion * w.tupp));
    usedTotalByLineWeek.set(
      lwk,
      (usedTotalByLineWeek.get(lwk) || 0) + Math.round((w.produccion + w.produccionFill) * w.tupp),
    );
  }

  // Indexamos por linea-mes
  const seenLineWeek = new Set<string>();
  for (const w of ledger) {
    const lmk = `${w.centro}|${w.linea}|${w.anio}|${w.mes}`;
    let row = out.get(lmk);
    if (!row) {
      row = {
        centro: w.centro,
        linea: w.linea,
        mes: w.mes,
        anio: w.anio,
        mesNombre: w.mesNombre,
        capTotal: 0,
        capSab: 0,
        idleAntesFill: 0,
        idleDespuesFill: 0,
        prodMotor: 0,
        prodFill: 0,
        sabadosActivos: 0,
      };
      out.set(lmk, row);
    }
    row.prodMotor += w.produccion;
    row.prodFill += w.produccionFill;

    const lwk = `${w.centro}|${w.linea}|${w.weekKey}`;
    if (!seenLineWeek.has(lwk)) {
      seenLineWeek.add(lwk);
      const cap = capByLineWeek.get(lwk) || 0;
      const usedBase = usedBaseByLineWeek.get(lwk) || 0;
      const usedTotal = usedTotalByLineWeek.get(lwk) || 0;
      row.capTotal += cap;
      row.idleAntesFill += Math.max(0, cap - usedBase);
      row.idleDespuesFill += Math.max(0, cap - usedTotal);
    }
    if (w.sabadoActivo) {
      row.capSab += w.capSab;
      // Cada (linea, semana) cuenta una sola vez aunque haya muchos materiales.
    }
  }
  // sabadosActivos: contar (linea-semana) con sabado=true.
  const sabSeen = new Set<string>();
  for (const w of ledger) {
    if (!w.sabadoActivo) continue;
    const lwk = `${w.centro}|${w.linea}|${w.weekKey}`;
    if (sabSeen.has(lwk)) continue;
    sabSeen.add(lwk);
    const lmk = `${w.centro}|${w.linea}|${w.anio}|${w.mes}`;
    const row = out.get(lmk);
    if (row) row.sabadosActivos += 1;
  }

  return Array.from(out.values()).sort((a, b) => {
    if (a.centro !== b.centro) return a.centro < b.centro ? -1 : 1;
    if (a.linea !== b.linea) return a.linea < b.linea ? -1 : 1;
    if (a.anio !== b.anio) return a.anio - b.anio;
    return a.mes - b.mes;
  });
}

export const Iv4DiagnosticPanel: React.FC<Props> = ({
  ledgerC1000,
  ledgerC2000,
  monthlyC1000,
  monthlyC2000,
  fillStats,
  drift,
}) => {
  const lineMonthC1000 = useMemo(() => buildLineMonthSummary(ledgerC1000), [ledgerC1000]);
  const lineMonthC2000 = useMemo(() => buildLineMonthSummary(ledgerC2000), [ledgerC2000]);

  const totalProdC1000 = monthlyC1000.reduce((s, r) => s + r.produccion + r.produccionFill, 0);
  const totalProdC2000 = monthlyC2000.reduce((s, r) => s + r.produccion + r.produccionFill, 0);
  const totalDespC1000 = monthlyC1000.reduce((s, r) => s + r.despachosVentas, 0);
  const totalDespC2000 = monthlyC2000.reduce((s, r) => s + r.despachosVentas, 0);
  const totalBacklogC1000 = monthlyC1000.reduce((s, r) => s + r.backlogFinalMes, 0);
  const totalBacklogC2000 = monthlyC2000.reduce((s, r) => s + r.backlogFinalMes, 0);

  if (!ledgerC1000.length && !ledgerC2000.length) return null;

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 md:grid-cols-4 gap-2 text-[11px]">
        <div className="border border-gray-200 rounded p-2 bg-gray-50">
          <div className="text-gray-500">Produccion C1000</div>
          <div className="text-base font-semibold">{fmt(totalProdC1000)}</div>
        </div>
        <div className="border border-gray-200 rounded p-2 bg-gray-50">
          <div className="text-gray-500">Produccion C2000</div>
          <div className="text-base font-semibold">{fmt(totalProdC2000)}</div>
        </div>
        <div className="border border-gray-200 rounded p-2 bg-gray-50">
          <div className="text-gray-500">Despachos C1000</div>
          <div className="text-base font-semibold">{fmt(totalDespC1000)}</div>
        </div>
        <div className="border border-gray-200 rounded p-2 bg-gray-50">
          <div className="text-gray-500">Despachos C2000</div>
          <div className="text-base font-semibold">{fmt(totalDespC2000)}</div>
        </div>
        <div className="border border-gray-200 rounded p-2 bg-gray-50">
          <div className="text-gray-500">Backlog final C1000</div>
          <div className="text-base font-semibold">{fmt(totalBacklogC1000)}</div>
        </div>
        <div className="border border-gray-200 rounded p-2 bg-gray-50">
          <div className="text-gray-500">Backlog final C2000</div>
          <div className="text-base font-semibold">{fmt(totalBacklogC2000)}</div>
        </div>
        <div className="border border-gray-200 rounded p-2 bg-gray-50">
          <div className="text-gray-500">Drift detectado</div>
          <div className={`text-base font-semibold ${drift.length ? 'text-orange-700' : 'text-emerald-700'}`}>
            {drift.length}
          </div>
        </div>
        <div className="border border-gray-200 rounded p-2 bg-gray-50">
          <div className="text-gray-500">Centros con fill</div>
          <div className="text-base font-semibold">{fillStats.filter(s => s.materialesProcesados > 0).length}</div>
        </div>
      </div>

      <div>
        <h5 className="text-xs font-semibold text-gray-800 mb-1">Resumen del relleno semanal por centro</h5>
        {fillStats.length === 0 ? (
          <p className="text-[11px] text-gray-500 italic">Sin actividad de relleno.</p>
        ) : (
          <div className="overflow-x-auto border border-gray-200 rounded">
            <table className="min-w-full text-[11px]">
              <thead className="bg-gray-100">
                <tr>
                  <th className="px-2 py-1 text-left">Centro</th>
                  <th className="px-2 py-1 text-right">Materiales</th>
                  <th className="px-2 py-1 text-right">Semanas</th>
                  <th className="px-2 py-1 text-right">U. PIO</th>
                  <th className="px-2 py-1 text-right">U. Adelanto</th>
                  <th className="px-2 py-1 text-right">U. Backlog</th>
                  <th className="px-2 py-1 text-right">Min consumidos</th>
                </tr>
              </thead>
              <tbody>
                {fillStats.map(s => (
                  <tr key={s.centro}>
                    <td className="px-2 py-1">{s.centro}</td>
                    <td className="px-2 py-1 text-right">{s.materialesProcesados}</td>
                    <td className="px-2 py-1 text-right">{s.semanasConFill}</td>
                    <td className="px-2 py-1 text-right">{fmt(s.unidadesPIO)}</td>
                    <td className="px-2 py-1 text-right">{fmt(s.unidadesAdelanto)}</td>
                    <td className="px-2 py-1 text-right">{fmt(s.unidadesBacklog)}</td>
                    <td className="px-2 py-1 text-right">{fmt(s.minutosConsumidos)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <div>
        <h5 className="text-xs font-semibold text-gray-800 mb-1">Capacidad e idle por linea / mes</h5>
        <div className="overflow-x-auto border border-gray-200 rounded max-h-72">
          <table className="min-w-full text-[11px]">
            <thead className="bg-gray-100 sticky top-0">
              <tr>
                <th className="px-2 py-1 text-left">Centro</th>
                <th className="px-2 py-1 text-left">Mes</th>
                <th className="px-2 py-1 text-left">Linea</th>
                <th className="px-2 py-1 text-right">Cap total</th>
                <th className="px-2 py-1 text-right">Cap sab</th>
                <th className="px-2 py-1 text-right">Sab activos</th>
                <th className="px-2 py-1 text-right">Idle pre-fill</th>
                <th className="px-2 py-1 text-right">Idle post-fill</th>
                <th className="px-2 py-1 text-right">Prod motor</th>
                <th className="px-2 py-1 text-right">Prod fill</th>
              </tr>
            </thead>
            <tbody>
              {[...lineMonthC1000, ...lineMonthC2000].map((r, i) => (
                <tr key={`${r.centro}|${r.linea}|${r.anio}|${r.mes}|${i}`}>
                  <td className="px-2 py-1">{r.centro}</td>
                  <td className="px-2 py-1">{r.mesNombre}</td>
                  <td className="px-2 py-1">{r.linea}</td>
                  <td className="px-2 py-1 text-right">{fmt(r.capTotal)}</td>
                  <td className="px-2 py-1 text-right">{fmt(r.capSab)}</td>
                  <td className="px-2 py-1 text-right">{r.sabadosActivos}</td>
                  <td className="px-2 py-1 text-right">{fmt(r.idleAntesFill)}</td>
                  <td className="px-2 py-1 text-right">{fmt(r.idleDespuesFill)}</td>
                  <td className="px-2 py-1 text-right">{fmt(r.prodMotor)}</td>
                  <td className="px-2 py-1 text-right font-semibold">{fmt(r.prodFill)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {drift.length > 0 && (
        <div>
          <h5 className="text-xs font-semibold text-orange-800 mb-1">Drift entre suma semanal y total mensual</h5>
          <div className="overflow-x-auto border border-orange-300 rounded">
            <table className="min-w-full text-[11px]">
              <thead className="bg-orange-100">
                <tr>
                  <th className="px-2 py-1 text-left">Centro</th>
                  <th className="px-2 py-1 text-left">Mes/Anio</th>
                  <th className="px-2 py-1 text-left">Metrica</th>
                  <th className="px-2 py-1 text-right">Motor</th>
                  <th className="px-2 py-1 text-right">Ledger</th>
                  <th className="px-2 py-1 text-right">Diff</th>
                </tr>
              </thead>
              <tbody>
                {drift.map((d, i) => (
                  <tr key={`${d.centro}|${d.anio}|${d.mes}|${d.metric}|${i}`}>
                    <td className="px-2 py-1">{d.centro}</td>
                    <td className="px-2 py-1">{d.mes}/{d.anio}</td>
                    <td className="px-2 py-1">{d.metric}</td>
                    <td className="px-2 py-1 text-right">{fmt(d.monthlyEngine)}</td>
                    <td className="px-2 py-1 text-right">{fmt(d.ledgerSum)}</td>
                    <td className="px-2 py-1 text-right">{fmt(d.diff)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
};
