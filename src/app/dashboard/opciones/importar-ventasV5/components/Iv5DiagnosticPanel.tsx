'use client';

import React, { useMemo, useState } from 'react';
import type { Iv5DiagnosticEntry, Iv5DiagnosticSeverity } from './iv5Types';

interface Props {
  diagnostics: Iv5DiagnosticEntry[];
}

const SEVERITY_LABEL: Record<Iv5DiagnosticSeverity, string> = {
  info: 'Info',
  warn: 'Aviso',
  error: 'Error',
};

const SEVERITY_CLS: Record<Iv5DiagnosticSeverity, string> = {
  info: 'text-gray-700',
  warn: 'text-amber-700',
  error: 'text-red-700',
};

const CODES: Iv5DiagnosticEntry['code'][] = [
  'STOCK_BAJO_SEGURIDAD',
  'TOPE_AGREGADO_EXCEDIDO',
  'TOPE_AGREGADO_RECORTADO',
  'BACKLOG_CRECIENTE',
  'IDLE_OCIOSO',
  'LINEA_ALTERNATIVA_USADA',
  'DRIFT_WEEK_VS_MONTH',
  'PIO_NO_COMPLETO',
  'INFO',
];

export const Iv5DiagnosticPanel: React.FC<Props> = ({ diagnostics }) => {
  const [filterCode, setFilterCode] = useState<string>('');
  const [filterCentro, setFilterCentro] = useState<string>('');
  const [filterSeverity, setFilterSeverity] = useState<string>('');

  const centros = useMemo(() => {
    const set = new Set<string>();
    for (const d of diagnostics) if (d.centro) set.add(d.centro);
    return Array.from(set).sort();
  }, [diagnostics]);

  const filtered = useMemo(() => {
    return diagnostics.filter((d) => {
      if (filterCode && d.code !== filterCode) return false;
      if (filterCentro && d.centro !== filterCentro) return false;
      if (filterSeverity && d.severity !== filterSeverity) return false;
      return true;
    });
  }, [diagnostics, filterCode, filterCentro, filterSeverity]);

  const conteoPorCodigo = useMemo(() => {
    const m = new Map<string, number>();
    for (const d of diagnostics) m.set(d.code, (m.get(d.code) ?? 0) + 1);
    return m;
  }, [diagnostics]);

  return (
    <div className="space-y-2">
      <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
        <div>
          <label className="block text-[11px] font-medium text-gray-700 mb-1">Codigo</label>
          <select
            value={filterCode}
            onChange={(e) => setFilterCode(e.target.value)}
            className="w-full border border-gray-300 rounded px-2 py-1.5 text-xs"
          >
            <option value="">Todos</option>
            {CODES.map((c) => (
              <option key={c} value={c}>
                {c} ({conteoPorCodigo.get(c) ?? 0})
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="block text-[11px] font-medium text-gray-700 mb-1">Centro</label>
          <select
            value={filterCentro}
            onChange={(e) => setFilterCentro(e.target.value)}
            className="w-full border border-gray-300 rounded px-2 py-1.5 text-xs"
          >
            <option value="">Todos</option>
            {centros.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="block text-[11px] font-medium text-gray-700 mb-1">Severidad</label>
          <select
            value={filterSeverity}
            onChange={(e) => setFilterSeverity(e.target.value)}
            className="w-full border border-gray-300 rounded px-2 py-1.5 text-xs"
          >
            <option value="">Todas</option>
            <option value="info">Info</option>
            <option value="warn">Aviso</option>
            <option value="error">Error</option>
          </select>
        </div>
        <div className="text-[11px] text-gray-600 self-end">
          Total: {diagnostics.length.toLocaleString('es-EC')} | Filtradas:{' '}
          {filtered.length.toLocaleString('es-EC')}
        </div>
      </div>

      <div className="overflow-y-auto max-h-72 border border-gray-200 rounded">
        <table className="min-w-full text-[11px]">
          <thead className="bg-gray-100 sticky top-0">
            <tr>
              <th className="px-2 py-1 text-left">Severidad</th>
              <th className="px-2 py-1 text-left">Codigo</th>
              <th className="px-2 py-1 text-left">Centro</th>
              <th className="px-2 py-1 text-left">Linea</th>
              <th className="px-2 py-1 text-left">Material</th>
              <th className="px-2 py-1 text-left">Mes</th>
              <th className="px-2 py-1 text-left">Semana</th>
              <th className="px-2 py-1 text-left">Mensaje</th>
            </tr>
          </thead>
          <tbody>
            {filtered.length === 0 ? (
              <tr>
                <td colSpan={8} className="px-2 py-3 text-center text-gray-500 italic">
                  Sin alertas con los filtros actuales.
                </td>
              </tr>
            ) : (
              filtered.slice(0, 500).map((d, idx) => (
                <tr key={idx} className={`hover:bg-gray-50 ${SEVERITY_CLS[d.severity]}`}>
                  <td className="px-2 py-1">{SEVERITY_LABEL[d.severity]}</td>
                  <td className="px-2 py-1 font-mono">{d.code}</td>
                  <td className="px-2 py-1">{d.centro}</td>
                  <td className="px-2 py-1">{d.linea ?? ''}</td>
                  <td className="px-2 py-1 font-mono">{d.material ?? ''}</td>
                  <td className="px-2 py-1">
                    {d.mes ? `${d.mes}/${d.anio ?? ''}` : ''}
                  </td>
                  <td className="px-2 py-1">
                    {d.isoWeek ? `${d.isoYear ?? ''}W${d.isoWeek}` : ''}
                  </td>
                  <td className="px-2 py-1">{d.mensaje}</td>
                </tr>
              ))
            )}
          </tbody>
        </table>
        {filtered.length > 500 && (
          <p className="text-[10px] text-gray-500 italic px-2 py-1">
            Mostrando primeras 500 de {filtered.length.toLocaleString('es-EC')} (afina los filtros).
          </p>
        )}
      </div>
    </div>
  );
};

export default Iv5DiagnosticPanel;
