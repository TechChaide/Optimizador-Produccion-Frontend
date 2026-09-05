'use client';

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import type { IV4Version, MonthlySnapshot, PlanLedgerWeek } from './types';

const STORAGE_KEY = 'iv4_versions';

function loadVersions(): IV4Version[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? (JSON.parse(raw) as IV4Version[]) : [];
  } catch {
    return [];
  }
}

function saveVersions(list: IV4Version[]) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(list));
}

function fmt(n: number): string {
  if (!Number.isFinite(n)) return '-';
  return Math.round(n).toLocaleString('es-EC');
}

function fmtSigned(n: number): string {
  if (!Number.isFinite(n)) return '-';
  const v = Math.round(n);
  if (v > 0) return `+${v.toLocaleString('es-EC')}`;
  return v.toLocaleString('es-EC');
}

interface VersionAggregate {
  prodTotal: number;
  prodFillTotal: number;
  despachosTotal: number;
  backlogFinalTotal: number;
  sabadosActivos: number;
  semanasC1000: number;
  semanasC2000: number;
}

function sumLedgerSat(ledger: PlanLedgerWeek[]): number {
  // Cada (linea, semana) cuenta una sola vez
  const seen = new Set<string>();
  let total = 0;
  for (const w of ledger) {
    if (!w.sabadoActivo) continue;
    const k = `${w.centro}|${w.linea}|${w.weekKey}`;
    if (seen.has(k)) continue;
    seen.add(k);
    total += 1;
  }
  return total;
}

function sumMonthly(monthly: MonthlySnapshot[], pick: (m: MonthlySnapshot) => number): number {
  return monthly.reduce((s, m) => s + pick(m), 0);
}

function aggregateVersion(v: IV4Version): VersionAggregate {
  return {
    prodTotal:
      sumMonthly(v.monthlyC1000, m => m.produccion) +
      sumMonthly(v.monthlyC2000, m => m.produccion),
    prodFillTotal:
      sumMonthly(v.monthlyC1000, m => m.produccionFill) +
      sumMonthly(v.monthlyC2000, m => m.produccionFill),
    despachosTotal:
      sumMonthly(v.monthlyC1000, m => m.despachosVentas) +
      sumMonthly(v.monthlyC2000, m => m.despachosVentas),
    backlogFinalTotal:
      sumMonthly(v.monthlyC1000, m => m.backlogFinalMes) +
      sumMonthly(v.monthlyC2000, m => m.backlogFinalMes),
    sabadosActivos: sumLedgerSat(v.ledgerC1000) + sumLedgerSat(v.ledgerC2000),
    semanasC1000: v.ledgerC1000.length,
    semanasC2000: v.ledgerC2000.length,
  };
}

interface Props {
  buildSnapshot: () => Omit<IV4Version, 'id' | 'savedAt' | 'nota'> | null;
  onLoadVersion?: (v: IV4Version) => void;
}

export const Iv4VersionsPanel: React.FC<Props> = ({ buildSnapshot, onLoadVersion }) => {
  const [versions, setVersions] = useState<IV4Version[]>([]);
  const [nota, setNota] = useState('');
  const [compareA, setCompareA] = useState<string>('');
  const [compareB, setCompareB] = useState<string>('');

  useEffect(() => {
    setVersions(loadVersions());
  }, []);

  const handleSave = useCallback(() => {
    const snap = buildSnapshot();
    if (!snap) {
      alert('No hay datos suficientes para guardar la version IV4.');
      return;
    }
    const v: IV4Version = {
      id: `IV4-${Date.now()}`,
      savedAt: new Date().toISOString(),
      nota: nota.trim() || undefined,
      ...snap,
    };
    const next = [v, ...loadVersions()];
    saveVersions(next);
    setVersions(next);
    setNota('');
    alert(`Version IV4 guardada (${v.id}).`);
  }, [buildSnapshot, nota]);

  const handleLoad = useCallback((id: string) => {
    const v = versions.find(x => x.id === id);
    if (!v || !onLoadVersion) return;
    onLoadVersion(v);
  }, [versions, onLoadVersion]);

  const handleDelete = useCallback((id: string) => {
    if (!window.confirm('Eliminar esta version IV4?')) return;
    const next = versions.filter(v => v.id !== id);
    saveVersions(next);
    setVersions(next);
    if (compareA === id) setCompareA('');
    if (compareB === id) setCompareB('');
  }, [versions, compareA, compareB]);

  const versionA = useMemo(() => versions.find(v => v.id === compareA) || null, [versions, compareA]);
  const versionB = useMemo(() => versions.find(v => v.id === compareB) || null, [versions, compareB]);
  const aggA = useMemo(() => (versionA ? aggregateVersion(versionA) : null), [versionA]);
  const aggB = useMemo(() => (versionB ? aggregateVersion(versionB) : null), [versionB]);

  return (
    <div className="space-y-3">
      <div className="flex items-end gap-2 flex-wrap">
        <div className="flex-1 min-w-[200px]">
          <label className="block text-xs font-medium text-gray-700 mb-1">Nota (opcional)</label>
          <input
            type="text"
            value={nota}
            onChange={e => setNota(e.target.value)}
            placeholder="Descripcion breve"
            className="w-full border border-gray-300 rounded px-2 py-1 text-sm"
          />
        </div>
        <button
          type="button"
          onClick={handleSave}
          className="px-3 py-1.5 text-xs font-semibold rounded bg-indigo-600 text-white hover:bg-indigo-700"
        >
          Guardar version IV4
        </button>
      </div>

      {versions.length >= 2 && (
        <div className="border border-blue-200 bg-blue-50 rounded p-3 space-y-2">
          <div className="flex flex-wrap items-end gap-2">
            <div>
              <label className="block text-[11px] font-medium text-gray-700 mb-0.5">Version A</label>
              <select
                value={compareA}
                onChange={e => setCompareA(e.target.value)}
                className="border border-gray-300 rounded px-2 py-1 text-xs"
              >
                <option value="">Seleccionar...</option>
                {versions.map(v => <option key={v.id} value={v.id}>{v.id} ({new Date(v.savedAt).toLocaleDateString('es-EC')})</option>)}
              </select>
            </div>
            <div>
              <label className="block text-[11px] font-medium text-gray-700 mb-0.5">Version B</label>
              <select
                value={compareB}
                onChange={e => setCompareB(e.target.value)}
                className="border border-gray-300 rounded px-2 py-1 text-xs"
              >
                <option value="">Seleccionar...</option>
                {versions.map(v => <option key={v.id} value={v.id}>{v.id} ({new Date(v.savedAt).toLocaleDateString('es-EC')})</option>)}
              </select>
            </div>
            <span className="text-[11px] text-gray-600 self-end">Diferencias muestran B - A</span>
          </div>

          {aggA && aggB && (
            <div className="overflow-x-auto">
              <table className="min-w-full text-[11px]">
                <thead className="bg-blue-100">
                  <tr>
                    <th className="px-2 py-1 text-left">Metrica</th>
                    <th className="px-2 py-1 text-right">A</th>
                    <th className="px-2 py-1 text-right">B</th>
                    <th className="px-2 py-1 text-right">Delta (B - A)</th>
                  </tr>
                </thead>
                <tbody>
                  {([
                    ['Produccion motor', aggA.prodTotal, aggB.prodTotal],
                    ['Produccion fill', aggA.prodFillTotal, aggB.prodFillTotal],
                    ['Despachos ventas', aggA.despachosTotal, aggB.despachosTotal],
                    ['Backlog final', aggA.backlogFinalTotal, aggB.backlogFinalTotal],
                    ['Sabados activos', aggA.sabadosActivos, aggB.sabadosActivos],
                    ['Semanas C1000', aggA.semanasC1000, aggB.semanasC1000],
                    ['Semanas C2000', aggA.semanasC2000, aggB.semanasC2000],
                  ] as Array<[string, number, number]>).map(([label, a, b]) => {
                    const diff = b - a;
                    const cls = diff > 0 ? 'text-emerald-700' : diff < 0 ? 'text-red-700' : 'text-gray-700';
                    return (
                      <tr key={label}>
                        <td className="px-2 py-1">{label}</td>
                        <td className="px-2 py-1 text-right">{fmt(a)}</td>
                        <td className="px-2 py-1 text-right">{fmt(b)}</td>
                        <td className={`px-2 py-1 text-right font-semibold ${cls}`}>{fmtSigned(diff)}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}

          {(!aggA || !aggB) && (
            <p className="text-[11px] text-gray-600 italic">Selecciona dos versiones para comparar.</p>
          )}
        </div>
      )}

      {versions.length === 0 ? (
        <p className="text-xs text-gray-500 italic">Sin versiones IV4 guardadas.</p>
      ) : (
        <div className="overflow-x-auto border border-gray-200 rounded">
          <table className="min-w-full text-xs">
            <thead className="bg-gray-100">
              <tr>
                <th className="px-2 py-1 text-left">ID</th>
                <th className="px-2 py-1 text-left">Guardada</th>
                <th className="px-2 py-1 text-left">Filtros</th>
                <th className="px-2 py-1 text-right">Sem C1000</th>
                <th className="px-2 py-1 text-right">Sem C2000</th>
                <th className="px-2 py-1 text-left">Nota</th>
                <th className="px-2 py-1 text-center">Acciones</th>
              </tr>
            </thead>
            <tbody>
              {versions.map(v => (
                <tr key={v.id} className="border-t border-gray-200">
                  <td className="px-2 py-1 font-mono">{v.id}</td>
                  <td className="px-2 py-1">{new Date(v.savedAt).toLocaleString('es-EC')}</td>
                  <td className="px-2 py-1">
                    {v.filters.año} / {v.filters.meses.join(', ')} / {v.filters.centros.join(',')}
                  </td>
                  <td className="px-2 py-1 text-right">{v.ledgerC1000.length}</td>
                  <td className="px-2 py-1 text-right">{v.ledgerC2000.length}</td>
                  <td className="px-2 py-1">{v.nota || '-'}</td>
                  <td className="px-2 py-1 text-center space-x-2">
                    {onLoadVersion && (
                      <button
                        type="button"
                        onClick={() => handleLoad(v.id)}
                        className="px-2 py-0.5 text-[11px] rounded bg-emerald-600 text-white hover:bg-emerald-700"
                      >
                        Cargar
                      </button>
                    )}
                    <button
                      type="button"
                      onClick={() => handleDelete(v.id)}
                      className="px-2 py-0.5 text-[11px] rounded bg-red-600 text-white hover:bg-red-700"
                    >
                      Eliminar
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
};
