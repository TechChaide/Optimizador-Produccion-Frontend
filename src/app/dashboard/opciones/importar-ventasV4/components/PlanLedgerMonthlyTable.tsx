'use client';

import React, { useMemo, useState } from 'react';
import type { MonthlySnapshot } from './types';

interface Props {
  rows: MonthlySnapshot[];
  title?: string;
}

function fmt(n: number): string {
  if (!Number.isFinite(n)) return '-';
  return Math.round(n).toLocaleString('es-EC');
}

export const PlanLedgerMonthlyTable: React.FC<Props> = ({ rows, title }) => {
  const [filterMaterial, setFilterMaterial] = useState('');
  const [filterLinea, setFilterLinea] = useState('');

  const filtered = useMemo(() => {
    return rows.filter(r => {
      if (filterMaterial && !r.material.includes(filterMaterial)) return false;
      if (filterLinea && !r.linea.toLowerCase().includes(filterLinea.toLowerCase())) return false;
      return true;
    });
  }, [rows, filterMaterial, filterLinea]);

  if (!rows.length) {
    return (
      <div className="text-sm text-gray-500 italic p-3 border border-gray-200 rounded">
        Sin datos en el snapshot mensual.
      </div>
    );
  }

  return (
    <div className="space-y-2">
      {title && <h4 className="text-sm font-semibold text-gray-800">{title}</h4>}
      <div className="flex gap-2 flex-wrap">
        <input
          type="text"
          placeholder="Filtrar material"
          value={filterMaterial}
          onChange={e => setFilterMaterial(e.target.value)}
          className="border border-gray-300 rounded px-2 py-1 text-xs"
        />
        <input
          type="text"
          placeholder="Filtrar linea"
          value={filterLinea}
          onChange={e => setFilterLinea(e.target.value)}
          className="border border-gray-300 rounded px-2 py-1 text-xs"
        />
        <span className="text-xs text-gray-500 self-center">{filtered.length} filas</span>
      </div>
      <div className="overflow-x-auto border border-gray-200 rounded">
        <table className="min-w-full text-[11px]">
          <thead className="bg-gray-100 sticky top-0">
            <tr>
              <th className="px-2 py-1 text-left">Centro</th>
              <th className="px-2 py-1 text-left">Mes</th>
              <th className="px-2 py-1 text-left">Linea</th>
              <th className="px-2 py-1 text-left">Material</th>
              <th className="px-2 py-1 text-left">Descripcion</th>
              <th className="px-2 py-1 text-right">Demanda</th>
              <th className="px-2 py-1 text-right">Despachos</th>
              <th className="px-2 py-1 text-right bg-blue-50 font-semibold">Produccion</th>
              <th className="px-2 py-1 text-right bg-blue-50 font-semibold">Prod Fill</th>
              <th className="px-2 py-1 text-right">Tras. Sal.</th>
              <th className="px-2 py-1 text-right">Tras. Ent.</th>
              <th className="px-2 py-1 text-right">Stock Ini</th>
              <th className="px-2 py-1 text-right">Stock Fin</th>
              <th className="px-2 py-1 text-right">Backlog Ini</th>
              <th className="px-2 py-1 text-right">Backlog Fin</th>
              <th className="px-2 py-1 text-right">Cap Tot</th>
              <th className="px-2 py-1 text-right">Cap Sab</th>
              <th className="px-2 py-1 text-right">Idle</th>
              <th className="px-2 py-1 text-right">Sab Act</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((r, i) => (
              <tr key={`${r.centro}|${r.material}|${r.anio}|${r.mes}|${i}`}>
                <td className="px-2 py-1">{r.centro}</td>
                <td className="px-2 py-1">{r.mesNombre}</td>
                <td className="px-2 py-1">{r.linea}</td>
                <td className="px-2 py-1 font-mono">{r.material}</td>
                <td className="px-2 py-1 truncate max-w-[200px]" title={r.descripcion}>{r.descripcion}</td>
                <td className="px-2 py-1 text-right">{fmt(r.demanda)}</td>
                <td className="px-2 py-1 text-right">{fmt(r.despachosVentas)}</td>
                <td className="px-2 py-1 text-right bg-blue-50 font-semibold">{fmt(r.produccion)}</td>
                <td className="px-2 py-1 text-right bg-blue-50">{fmt(r.produccionFill)}</td>
                <td className="px-2 py-1 text-right">{fmt(r.trasladoSaliente)}</td>
                <td className="px-2 py-1 text-right">{fmt(r.trasladoEntrante)}</td>
                <td className="px-2 py-1 text-right">{fmt(r.stockInicialMes)}</td>
                <td className="px-2 py-1 text-right">{fmt(r.stockFinalMes)}</td>
                <td className="px-2 py-1 text-right">{fmt(r.backlogInicialMes)}</td>
                <td className="px-2 py-1 text-right">{fmt(r.backlogFinalMes)}</td>
                <td className="px-2 py-1 text-right">{fmt(r.capTotalMes)}</td>
                <td className="px-2 py-1 text-right">{fmt(r.capSabMes)}</td>
                <td className="px-2 py-1 text-right">{fmt(r.idleMes)}</td>
                <td className="px-2 py-1 text-right">{r.sabadosActivos}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};
