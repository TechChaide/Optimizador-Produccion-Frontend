'use client';

import React, { useMemo, useState } from 'react';
import type { PlanLedgerWeek } from './types';

interface Props {
  rows: PlanLedgerWeek[];
  title?: string;
}

interface RowKey {
  centro: string;
  linea: string;
  material: string;
  descripcion: string;
  sectorRef: string;
}

function fmt(n: number): string {
  if (!Number.isFinite(n)) return '-';
  return Math.round(n).toLocaleString('es-EC');
}

export const PlanLedgerWeeklyTable: React.FC<Props> = ({ rows, title }) => {
  const [filterMaterial, setFilterMaterial] = useState('');
  const [filterLinea, setFilterLinea] = useState('');

  const weeks = useMemo(() => {
    const map = new Map<string, { weekKey: string; mes: number; anio: number; isoWeek: number; isoYear: number; tieneSabado: boolean; sabadoActivo: boolean; mesNombre: string; }>();
    for (const r of rows) {
      if (!map.has(r.weekKey)) {
        map.set(r.weekKey, {
          weekKey: r.weekKey,
          mes: r.mes,
          anio: r.anio,
          isoWeek: r.isoWeek,
          isoYear: r.isoYear,
          tieneSabado: r.sabadoActivo || r.capSab > 0,
          sabadoActivo: r.sabadoActivo,
          mesNombre: r.mesNombre,
        });
      } else {
        const prev = map.get(r.weekKey)!;
        prev.sabadoActivo = prev.sabadoActivo || r.sabadoActivo;
      }
    }
    return Array.from(map.values()).sort((a, b) => {
      if (a.isoYear !== b.isoYear) return a.isoYear - b.isoYear;
      if (a.isoWeek !== b.isoWeek) return a.isoWeek - b.isoWeek;
      return a.mes - b.mes;
    });
  }, [rows]);

  const grouped = useMemo(() => {
    const map = new Map<string, { key: RowKey; weeks: Map<string, PlanLedgerWeek> }>();
    for (const r of rows) {
      if (filterMaterial && !r.material.includes(filterMaterial)) continue;
      if (filterLinea && !r.linea.toLowerCase().includes(filterLinea.toLowerCase())) continue;
      const k = `${r.centro}|${r.material}|${r.linea}`;
      if (!map.has(k)) {
        map.set(k, {
          key: { centro: r.centro, linea: r.linea, material: r.material, descripcion: r.descripcion, sectorRef: r.sectorRef },
          weeks: new Map(),
        });
      }
      map.get(k)!.weeks.set(r.weekKey, r);
    }
    return Array.from(map.values()).sort((a, b) => a.key.material.localeCompare(b.key.material));
  }, [rows, filterMaterial, filterLinea]);

  if (!rows.length) {
    return (
      <div className="text-sm text-gray-500 italic p-3 border border-gray-200 rounded">
        Sin datos en el ledger semanal.
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
        <span className="text-xs text-gray-500 self-center">
          Mostrando {grouped.length} materiales x {weeks.length} semanas
        </span>
      </div>
      <div className="overflow-x-auto border border-gray-200 rounded">
        <table className="min-w-full text-[11px]">
          <thead className="bg-gray-100 sticky top-0">
            <tr>
              <th className="px-2 py-1 text-left">Centro</th>
              <th className="px-2 py-1 text-left">Linea</th>
              <th className="px-2 py-1 text-left">Material</th>
              <th className="px-2 py-1 text-left">Descripcion</th>
              <th className="px-2 py-1 text-left">Metrica</th>
              {weeks.map(w => (
                <th key={w.weekKey} className={`px-2 py-1 text-right ${w.sabadoActivo ? 'bg-amber-100' : ''}`}>
                  W{w.isoWeek}-{String(w.mes).padStart(2, '0')}
                  {w.sabadoActivo && <span className="block text-[9px] text-amber-700">+sab</span>}
                </th>
              ))}
              <th className="px-2 py-1 text-right">Total</th>
            </tr>
          </thead>
          <tbody>
            {grouped.map(({ key, weeks: wkMap }) => {
              const renderRow = (label: string, getter: (w: PlanLedgerWeek) => number, opts?: { highlight?: boolean }) => {
                let total = 0;
                return (
                  <tr key={`${key.centro}|${key.material}|${key.linea}|${label}`} className={opts?.highlight ? 'bg-blue-50' : ''}>
                    <td className="px-2 py-1">{key.centro}</td>
                    <td className="px-2 py-1">{key.linea}</td>
                    <td className="px-2 py-1 font-mono">{key.material}</td>
                    <td className="px-2 py-1 truncate max-w-[160px]" title={key.descripcion}>{key.descripcion}</td>
                    <td className="px-2 py-1 font-semibold">{label}</td>
                    {weeks.map(w => {
                      const r = wkMap.get(w.weekKey);
                      const v = r ? getter(r) : 0;
                      total += v;
                      return (
                        <td key={w.weekKey} className="px-2 py-1 text-right">{v ? fmt(v) : '-'}</td>
                      );
                    })}
                    <td className="px-2 py-1 text-right font-semibold">{fmt(total)}</td>
                  </tr>
                );
              };

              return (
                <React.Fragment key={`grp-${key.centro}|${key.material}|${key.linea}`}>
                  {renderRow('Demanda', w => w.demanda)}
                  {renderRow('Despachos', w => w.despachosVentas)}
                  {renderRow('Produccion', w => w.produccion + w.produccionFill, { highlight: true })}
                  {renderRow('Tras. Sal.', w => w.trasladoSaliente)}
                  {renderRow('Tras. Ent.', w => w.trasladoEntrante)}
                  {renderRow('Stock Ini', w => w.stockInicial)}
                  {renderRow('Stock Fin', w => w.stockFinal)}
                  {renderRow('Backlog Ini', w => w.backlogInicial)}
                  {renderRow('Backlog Fin', w => w.backlogFinal)}
                  {renderRow('Cap Total', w => w.capTotal)}
                  {renderRow('Idle', w => w.idleSem)}
                </React.Fragment>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
};
