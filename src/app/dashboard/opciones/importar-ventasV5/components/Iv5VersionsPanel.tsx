'use client';

import React, { useCallback, useEffect, useState } from 'react';
import type { Iv5Version } from './iv5Types';
import { loadIv5Versions, saveIv5Versions } from './iv5Persistence';

interface Props {
  buildSnapshot: () => Omit<Iv5Version, 'id' | 'savedAt' | 'nota'> | null;
  onLoadVersion?: (v: Iv5Version) => void;
}

function fmt(n: number): string {
  if (!Number.isFinite(n)) return '-';
  return Math.round(n).toLocaleString('es-EC');
}

function aggregateVersion(v: Iv5Version): {
  prodTotal: number;
  despachosTotal: number;
  backlogFinalTotal: number;
  semanasC1000: number;
  semanasC2000: number;
  alertas: number;
} {
  const sumMonthlyProd = (rs: Iv5Version['monthlyC1000']) =>
    rs.reduce(
      (s, m) => s + m.produccionBase + m.produccionAlternativa + m.produccionAdelanto + m.produccionPio,
      0,
    );
  const sumMonthlyDesp = (rs: Iv5Version['monthlyC1000']) =>
    rs.reduce((s, m) => s + m.despachosVentas, 0);
  const sumMonthlyBack = (rs: Iv5Version['monthlyC1000']) =>
    rs.reduce((s, m) => s + m.backlogFinalMes, 0);

  return {
    prodTotal: sumMonthlyProd(v.monthlyC1000) + sumMonthlyProd(v.monthlyC2000),
    despachosTotal: sumMonthlyDesp(v.monthlyC1000) + sumMonthlyDesp(v.monthlyC2000),
    backlogFinalTotal: sumMonthlyBack(v.monthlyC1000) + sumMonthlyBack(v.monthlyC2000),
    semanasC1000: v.ledgerC1000.length,
    semanasC2000: v.ledgerC2000.length,
    alertas: v.diagnostics.length,
  };
}

export const Iv5VersionsPanel: React.FC<Props> = ({ buildSnapshot, onLoadVersion }) => {
  const [versions, setVersions] = useState<Iv5Version[]>([]);
  const [nota, setNota] = useState('');

  useEffect(() => {
    setVersions(loadIv5Versions());
  }, []);

  const handleSave = useCallback(() => {
    const snap = buildSnapshot();
    if (!snap) {
      alert('No hay datos suficientes para guardar la version IV5.');
      return;
    }
    const v: Iv5Version = {
      id: `IV5-${Date.now()}`,
      savedAt: new Date().toISOString(),
      nota: nota.trim() || undefined,
      ...snap,
    };
    const next = [v, ...loadIv5Versions()];
    saveIv5Versions(next);
    setVersions(next);
    setNota('');
    alert(`Version IV5 guardada (${v.id}).`);
  }, [buildSnapshot, nota]);

  const handleLoad = useCallback(
    (id: string) => {
      const v = versions.find((x) => x.id === id);
      if (!v || !onLoadVersion) return;
      onLoadVersion(v);
    },
    [versions, onLoadVersion],
  );

  const handleDelete = useCallback((id: string) => {
    if (!confirm('Eliminar esta version IV5?')) return;
    const next = loadIv5Versions().filter((v) => v.id !== id);
    saveIv5Versions(next);
    setVersions(next);
  }, []);

  return (
    <div className="space-y-2">
      <div className="flex flex-col sm:flex-row sm:items-end gap-2">
        <div className="flex-1">
          <label className="block text-[11px] font-medium text-gray-700 mb-1">Nota (opcional)</label>
          <input
            type="text"
            value={nota}
            onChange={(e) => setNota(e.target.value)}
            placeholder="Ej: prueba con tope 19500 + 3 sabados"
            className="w-full border border-gray-300 rounded px-2 py-1.5 text-xs"
          />
        </div>
        <button
          type="button"
          onClick={handleSave}
          className="text-xs px-3 py-1.5 rounded bg-indigo-600 text-white hover:bg-indigo-700"
        >
          Guardar version IV5 (local)
        </button>
      </div>

      <div className="overflow-x-auto border border-gray-200 rounded">
        <table className="min-w-full text-[11px]">
          <thead className="bg-gray-100">
            <tr>
              <th className="px-2 py-1 text-left">ID</th>
              <th className="px-2 py-1 text-left">Guardada</th>
              <th className="px-2 py-1 text-left">Filtros</th>
              <th className="px-2 py-1 text-left">Tope 1000/2000</th>
              <th className="px-2 py-1 text-right">Sem 1000</th>
              <th className="px-2 py-1 text-right">Sem 2000</th>
              <th className="px-2 py-1 text-right">Prod total</th>
              <th className="px-2 py-1 text-right">Despachos</th>
              <th className="px-2 py-1 text-right">Backlog fin</th>
              <th className="px-2 py-1 text-right">Alertas</th>
              <th className="px-2 py-1 text-left">Plan global</th>
              <th className="px-2 py-1 text-left">Nota</th>
              <th className="px-2 py-1 text-left">Acciones</th>
            </tr>
          </thead>
          <tbody>
            {versions.length === 0 ? (
              <tr>
                <td colSpan={13} className="px-2 py-3 text-center text-gray-500 italic">
                  Sin versiones guardadas todavia.
                </td>
              </tr>
            ) : (
              versions.map((v) => {
                const agg = aggregateVersion(v);
                return (
                  <tr key={v.id} className="hover:bg-gray-50">
                    <td className="px-2 py-1 font-mono">{v.id}</td>
                    <td className="px-2 py-1 whitespace-nowrap">
                      {new Date(v.savedAt).toLocaleString('es-EC')}
                    </td>
                    <td className="px-2 py-1">
                      {v.filters.año} / {v.filters.meses.join(',')} / {v.filters.centros.join(',')}
                    </td>
                    <td className="px-2 py-1">
                      {fmt(v.stockCap.centro1000)} / {fmt(v.stockCap.centro2000)}
                    </td>
                    <td className="px-2 py-1 text-right">{agg.semanasC1000}</td>
                    <td className="px-2 py-1 text-right">{agg.semanasC2000}</td>
                    <td className="px-2 py-1 text-right">{fmt(agg.prodTotal)}</td>
                    <td className="px-2 py-1 text-right">{fmt(agg.despachosTotal)}</td>
                    <td className="px-2 py-1 text-right">{fmt(agg.backlogFinalTotal)}</td>
                    <td className="px-2 py-1 text-right">{agg.alertas}</td>
                    <td className="px-2 py-1">
                      {v.savedToDB ? (
                        <span className="text-emerald-700 font-semibold">Si</span>
                      ) : (
                        <span className="text-gray-500">No</span>
                      )}
                    </td>
                    <td className="px-2 py-1">{v.nota ?? ''}</td>
                    <td className="px-2 py-1 whitespace-nowrap">
                      <button
                        type="button"
                        onClick={() => handleLoad(v.id)}
                        disabled={!onLoadVersion}
                        className="text-[11px] px-2 py-0.5 rounded border border-blue-300 text-blue-700 hover:bg-blue-50 disabled:text-gray-400 disabled:border-gray-300 disabled:hover:bg-white mr-1"
                      >
                        Cargar
                      </button>
                      <button
                        type="button"
                        onClick={() => handleDelete(v.id)}
                        className="text-[11px] px-2 py-0.5 rounded border border-red-300 text-red-700 hover:bg-red-50"
                      >
                        Eliminar
                      </button>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
};

export default Iv5VersionsPanel;
