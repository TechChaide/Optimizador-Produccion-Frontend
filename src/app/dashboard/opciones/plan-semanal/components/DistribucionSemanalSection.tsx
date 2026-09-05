'use client';

import React, { useMemo, useState } from 'react';
import type { PlanSemanalRow, WeekSegment } from './types';

interface Props {
  rows: PlanSemanalRow[];
  segments: WeekSegment[];
  activeSatKeys: Set<string>;
  onToggleSaturday?: (satKey: string) => void;
}

const CENTROS: Record<string, string> = { '1000': 'C1000 - Quito', '2000': 'C2000 - Guayaquil' };

export const DistribucionSemanalSection: React.FC<Props> = ({ rows, segments, activeSatKeys, onToggleSaturday }) => {
  const [filtroCentro, setFiltroCentro] = useState('');
  const [filtroSector, setFiltroSector] = useState('');
  const [filtroMat, setFiltroMat] = useState('');
  const [vistaColumna, setVistaColumna] = useState<'produccion' | 'despachos' | 'traslado'>('produccion');

  const centros  = useMemo(() => [...new Set(rows.map(r => r.centro))].sort(), [rows]);
  const sectores = useMemo(() => {
    const s = new Set(rows.filter(r => !filtroCentro || r.centro === filtroCentro).map(r => r.sector));
    return [...s].sort();
  }, [rows, filtroCentro]);

  const filteredRows = useMemo(() => rows.filter(r => {
    if (filtroCentro && r.centro !== filtroCentro) return false;
    if (filtroSector && r.sector !== filtroSector) return false;
    if (filtroMat) {
      const q = filtroMat.toLowerCase();
      if (!r.CodMaterial.toLowerCase().includes(q) && !r.descripcion.toLowerCase().includes(q)) return false;
    }
    return true;
  }), [rows, filtroCentro, filtroSector, filtroMat]);

  const getCellValue = (r: PlanSemanalRow) => {
    if (vistaColumna === 'despachos') return r.despachosVentasSemana;
    if (vistaColumna === 'traslado')  return r.trasladoSemana;
    return r.cantidadSemanal;
  };

  // Group: sectorKey → materialCode → weekKey → value
  const grouped = useMemo(() => {
    const bySector = new Map<string, Map<string, { row: PlanSemanalRow; byWeek: Map<string, number> }>>();
    for (const r of filteredRows) {
      const sk = `${r.centro}|${r.sector}`;
      if (!bySector.has(sk)) bySector.set(sk, new Map());
      const byMat = bySector.get(sk)!;
      if (!byMat.has(r.CodMaterial)) byMat.set(r.CodMaterial, { row: r, byWeek: new Map() });
      const entry = byMat.get(r.CodMaterial)!;
      entry.byWeek.set(r.weekKey, (entry.byWeek.get(r.weekKey) || 0) + getCellValue(r));
    }
    return bySector;
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filteredRows, vistaColumna]);

  const colTotals = useMemo(() => {
    const m = new Map<string, number>();
    for (const r of filteredRows) m.set(r.weekKey, (m.get(r.weekKey) || 0) + getCellValue(r));
    return m;
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filteredRows, vistaColumna]);

  if (rows.length === 0) {
    return (
      <div className="p-8 text-center text-gray-500">
        Sin datos. Primero envía los resultados del Backlog Regresivo desde Importar Ventas 2.
      </div>
    );
  }

  const grandTotal = Array.from(colTotals.values()).reduce((s, v) => s + v, 0);

  return (
    <div>
      {/* Filters + column selector */}
      <div className="flex flex-wrap gap-3 mb-4 items-end">
        <select
          value={filtroCentro}
          onChange={e => { setFiltroCentro(e.target.value); setFiltroSector(''); }}
          className="border border-gray-300 rounded-md px-3 py-1.5 text-sm"
        >
          <option value="">Centro: Todos</option>
          {centros.map(c => <option key={c} value={c}>{CENTROS[c] ?? c}</option>)}
        </select>
        <select
          value={filtroSector}
          onChange={e => setFiltroSector(e.target.value)}
          className="border border-gray-300 rounded-md px-3 py-1.5 text-sm"
        >
          <option value="">Sector: Todos</option>
          {sectores.map(s => <option key={s} value={s}>{s}</option>)}
        </select>
        <input
          type="text"
          placeholder="Material / descripción..."
          value={filtroMat}
          onChange={e => setFiltroMat(e.target.value)}
          className="border border-gray-300 rounded-md px-3 py-1.5 text-sm min-w-[220px]"
        />
        <div className="flex items-center gap-1 border border-gray-300 rounded-md overflow-hidden text-sm">
          {([['produccion','Producción'], ['despachos','Desp. Ventas'], ['traslado','Traslado']] as const).map(([v, label]) => (
            <button
              key={v}
              onClick={() => setVistaColumna(v)}
              className={`px-3 py-1.5 transition-colors ${vistaColumna === v ? 'bg-indigo-600 text-white font-semibold' : 'bg-white text-gray-600 hover:bg-gray-50'}`}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      <div className="overflow-x-auto border border-gray-200 rounded-lg max-h-[70vh]">
        <table className="text-[10px] w-full border-collapse">
          <thead className="bg-gray-50 sticky top-0 z-10">
            <tr>
              <th className="px-2 py-2 text-left border-b border-r border-gray-200 bg-gray-100 min-w-[70px]">Centro</th>
              <th className="px-2 py-2 text-left border-b border-r border-gray-200 bg-gray-100 min-w-[110px]">Sector</th>
              <th className="px-2 py-2 text-left border-b border-r border-gray-200 bg-gray-100 min-w-[80px]">Código</th>
              <th className="px-2 py-2 text-left border-b border-r border-gray-200 bg-gray-100 min-w-[160px]">Descripción</th>
              <th className="px-2 py-2 text-left border-b border-r border-gray-200 bg-gray-100 min-w-[50px]">Mes</th>
              <th className="px-2 py-2 text-right border-b border-r border-gray-200 bg-gray-100 min-w-[70px]">Stock Ini.</th>
              {segments.map(seg => {
                const diasEf = seg.diasLaborales + (seg.tieneSabado && activeSatKeys.has(seg.satKey) ? 1 : 0);
                const satOn = seg.tieneSabado && activeSatKeys.has(seg.satKey);
                return (
                  <th key={seg.weekKey} className="px-2 py-2 text-center border-b border-r border-gray-200 min-w-[88px]">
                    <div className="font-bold">{seg.label}</div>
                    <div className="text-gray-500 font-normal">
                      {seg.diasLaborales} L-V{seg.tieneSabado ? ' + sáb' : ''} = {diasEf}d
                    </div>
                    {seg.tieneSabado && onToggleSaturday && (
                      <button
                        type="button"
                        onClick={() => onToggleSaturday(seg.satKey)}
                        className={`mt-1 px-1.5 py-0.5 rounded text-[8px] font-semibold border ${
                          satOn
                            ? 'bg-amber-200 border-amber-500 text-amber-900'
                            : 'bg-white border-amber-300 text-amber-800'
                        }`}
                      >
                        {satOn ? 'Sáb ON' : 'Sáb OFF'}
                      </button>
                    )}
                  </th>
                );
              })}
              <th className="px-2 py-2 text-center border-b border-gray-200 bg-gray-50 min-w-[80px] font-bold">Total</th>
            </tr>
          </thead>
          <tbody>
            {Array.from(grouped.entries()).map(([sk, byMat]) => {
              const [centro, sector] = sk.split('|');
              const matEntries = Array.from(byMat.entries());

              return matEntries.map(([cod, { row, byWeek }], idx) => {
                const rowTotal = Array.from(byWeek.values()).reduce((s, v) => s + v, 0);
                return (
                  <tr key={`${sk}|${cod}`} className={idx % 2 === 0 ? 'bg-white' : 'bg-gray-50'}>
                    {idx === 0 && (
                      <>
                        <td className="px-2 py-1 border-r border-gray-200 font-semibold text-blue-800 align-top" rowSpan={matEntries.length}>
                          {CENTROS[centro] ?? centro}
                        </td>
                        <td className="px-2 py-1 border-r border-gray-200 font-semibold text-gray-700 align-top" rowSpan={matEntries.length}>
                          {sector}
                        </td>
                      </>
                    )}
                    <td className="px-2 py-1 border-r border-gray-200 font-mono">{cod}</td>
                    <td className="px-2 py-1 border-r border-gray-200 truncate max-w-xs">{row.descripcion}</td>
                    <td className="px-2 py-1 border-r border-gray-200 text-indigo-700 font-semibold">{row.mesNombre}</td>
                    <td className="px-2 py-1 border-r border-gray-200 text-right text-gray-600">
                      {row.stockInicial.toLocaleString()}
                    </td>
                    {segments.map(seg => (
                      <td key={seg.weekKey} className="px-2 py-1 text-right border-r border-gray-100">
                        {(byWeek.get(seg.weekKey) || 0).toLocaleString()}
                      </td>
                    ))}
                    <td className="px-2 py-1 text-right font-bold text-blue-900">{rowTotal.toLocaleString()}</td>
                  </tr>
                );
              });
            })}
            {/* Totals row */}
            <tr className="bg-gray-100 font-bold border-t-2 border-gray-300">
              <td className="px-2 py-2 border-r border-gray-200" colSpan={6}>TOTAL GENERAL</td>
              {segments.map(seg => (
                <td key={seg.weekKey} className="px-2 py-2 text-right border-r border-gray-200 text-blue-900">
                  {(colTotals.get(seg.weekKey) || 0).toLocaleString()}
                </td>
              ))}
              <td className="px-2 py-2 text-right text-blue-900">{grandTotal.toLocaleString()}</td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  );
};
