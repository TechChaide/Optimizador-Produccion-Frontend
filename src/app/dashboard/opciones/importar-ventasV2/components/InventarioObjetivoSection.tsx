'use client';

import React, { useMemo, useState } from 'react';
import {
  aggregateViableTransferList,
  computeBacklogRegressiveFinalRows,
  viableTransfersFromC1000RegressiveRows,
} from './backlogRegressiveCompute';
import { safeNumber } from './utils';
import type { TiempoCanonResult, ViableTransfer, PioMap } from './types';
import { MONTH_NAMES } from './constants';

interface InventarioObjetivoSectionProps {
  dataC1000: any[];
  dataC2000: any[];
  tiemposCanon: TiempoCanonResult[];
  maxExtrasHoras: number;
  horasExtrasFin: number;
  trasladosViables?: ViableTransfer[];
  pioMap?: PioMap;
}

function fmt(n: number) {
  return n.toLocaleString(undefined, { maximumFractionDigits: 0 });
}

function anioFila(r: any) {
  return safeNumber(r._anioFila ?? r.Año ?? r.año);
}

export const InventarioObjetivoSection: React.FC<InventarioObjetivoSectionProps> = ({
  dataC1000,
  dataC2000,
  tiemposCanon,
  maxExtrasHoras,
  horasExtrasFin,
  trasladosViables = [],
  pioMap,
}) => {
  const [filterMes, setFilterMes] = useState('');
  const [filterCentro, setFilterCentro] = useState('');
  const [filterLinea, setFilterLinea] = useState('');
  const [filterEtiqueta, setFilterEtiqueta] = useState('');

  const pioRows = useMemo(() => {
    if (!pioMap || pioMap.size === 0) return [];

    const agg = aggregateViableTransferList(trasladosViables);
    const r1 = computeBacklogRegressiveFinalRows({
      data: dataC1000,
      tiemposCanon,
      centro: '1000',
      maxExtrasHoras,
      horasExtrasFin,
      trasladosViables: agg,
      pioMap,
    });
    const eff = viableTransfersFromC1000RegressiveRows(r1);
    const v2 = eff.length > 0 ? eff : agg;
    const r2 = computeBacklogRegressiveFinalRows({
      data: dataC2000,
      tiemposCanon,
      centro: '2000',
      maxExtrasHoras,
      horasExtrasFin,
      trasladosViables: v2,
      pioMap,
    });

    return [
      ...r1.map(r => ({ ...r, _centro: '1000' })),
      ...r2.map(r => ({ ...r, _centro: '2000' })),
    ].filter(r => safeNumber(r._prodObjetivoInventario) > 0);
  }, [dataC1000, dataC2000, tiemposCanon, maxExtrasHoras, horasExtrasFin, trasladosViables, pioMap]);

  const lineasUnicas = useMemo(() =>
    Array.from(new Set(pioRows.map(r => String(r.lineaRef || r.LineaFabricacion || '')))).filter(Boolean).sort()
  , [pioRows]);

  const etiquetasUnicas = useMemo(() =>
    Array.from(new Set(pioRows.map(r => String(r.Etiqueta || '')))).filter(Boolean).sort()
  , [pioRows]);

  const mesesUnicos = useMemo(() =>
    Array.from(new Set(pioRows.map(r => String(r.mesNombre || '')))).filter(Boolean)
  , [pioRows]);

  const filtered = useMemo(() => {
    let list = pioRows;
    if (filterMes) list = list.filter(r => String(r.mesNombre) === filterMes);
    if (filterCentro) list = list.filter(r => r._centro === filterCentro);
    if (filterLinea) list = list.filter(r => String(r.lineaRef || r.LineaFabricacion || '') === filterLinea);
    if (filterEtiqueta) list = list.filter(r => String(r.Etiqueta || '') === filterEtiqueta);
    return list;
  }, [pioRows, filterMes, filterCentro, filterLinea, filterEtiqueta]);

  const monthlySummary = useMemo(() => {
    const map = new Map<string, { mesNombre: string; mesNumero: number; anio: number; prodPio: number; invObjetivo: number }>();
    for (const r of filtered) {
      const mes = safeNumber(r._mesNumero);
      const anio = anioFila(r);
      const key = `${anio}|${mes}`;
      const cur = map.get(key) || { mesNombre: String(r.mesNombre || MONTH_NAMES[mes] || ''), mesNumero: mes, anio, prodPio: 0, invObjetivo: 0 };
      cur.prodPio += safeNumber(r._prodObjetivoInventario);
      const entry = pioMap?.get(`${String(r.CodMaterial ?? '')}|${r._centro}`);
      cur.invObjetivo += entry?.invObjetivo ?? 0;
      map.set(key, cur);
    }
    return Array.from(map.values()).sort((a, b) => a.anio !== b.anio ? a.anio - b.anio : a.mesNumero - b.mesNumero);
  }, [filtered, pioMap]);

  if (!pioMap || pioMap.size === 0) {
    return (
      <div className="p-8 text-center bg-white rounded-xl border border-gray-200 text-gray-600">
        <p className="font-medium">No hay datos PIO disponibles.</p>
        <p className="text-sm mt-2">Verifique que existan restricciones DIAS_INV_OBJETIVO_* y que haya datos de demanda cargados.</p>
      </div>
    );
  }

  const totalPio = filtered.reduce((s, r) => s + safeNumber(r._prodObjetivoInventario), 0);

  return (
    <div className="space-y-6">
      {/* Filtros */}
      <div className="bg-white rounded-xl border border-gray-200 p-4 shadow-sm">
        <h3 className="text-base font-bold text-gray-800 mb-3">Producción por Inventario Objetivo (PIO)</h3>
        <div className="flex flex-wrap gap-3">
          <select className="border rounded-md px-3 py-2 text-sm bg-white" value={filterMes} onChange={e => setFilterMes(e.target.value)}>
            <option value="">Todos los meses</option>
            {mesesUnicos.map(m => <option key={m} value={m}>{m}</option>)}
          </select>
          <select className="border rounded-md px-3 py-2 text-sm bg-white" value={filterCentro} onChange={e => setFilterCentro(e.target.value)}>
            <option value="">Ambos centros</option>
            <option value="1000">C1000 (Quito)</option>
            <option value="2000">C2000 (Guayaquil)</option>
          </select>
          <select className="border rounded-md px-3 py-2 text-sm bg-white" value={filterLinea} onChange={e => setFilterLinea(e.target.value)}>
            <option value="">Todas las líneas</option>
            {lineasUnicas.map(l => <option key={l} value={l}>{l}</option>)}
          </select>
          <select className="border rounded-md px-3 py-2 text-sm bg-white" value={filterEtiqueta} onChange={e => setFilterEtiqueta(e.target.value)}>
            <option value="">Todas las etiquetas</option>
            {etiquetasUnicas.map(e => <option key={e} value={e}>{e}</option>)}
          </select>
          <span className="ml-auto self-center text-sm font-medium text-green-800 bg-green-50 px-3 py-1.5 rounded-md border border-green-200">
            Total PIO: {fmt(totalPio)} uds
          </span>
        </div>
      </div>

      {/* Tabla detalle */}
      <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
        <div className="overflow-x-auto max-h-[55vh]">
          <table className="w-full border-collapse text-[11px]">
            <thead className="sticky top-0 z-10 bg-gray-100 text-[10px] uppercase font-bold text-gray-600">
              <tr>
                <th className="px-2 py-2 text-left">Mes</th>
                <th className="px-2 py-2 text-center">Centro</th>
                <th className="px-2 py-2 text-left">Línea</th>
                <th className="px-2 py-2 text-left">Material</th>
                <th className="px-2 py-2 text-left">Etiqueta</th>
                <th className="px-2 py-2 text-right">Inv. Objetivo</th>
                <th className="px-2 py-2 text-right">Stock Cierre</th>
                <th className="px-2 py-2 text-right">Máx. Adicional</th>
                <th className="px-2 py-2 text-right text-green-800">Prod. PIO</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {filtered.length === 0 ? (
                <tr>
                  <td colSpan={9} className="px-4 py-8 text-center text-gray-500">Sin filas PIO para los filtros actuales.</td>
                </tr>
              ) : (
                filtered.map((r, idx) => {
                  const entry = pioMap?.get(`${String(r.CodMaterial ?? '')}|${r._centro}`);
                  const stockCierre = safeNumber(r._saldoFinal) - safeNumber(r._prodObjetivoInventario);
                  const maxAdicional = entry ? Math.max(0, entry.invObjetivo - stockCierre) : 0;
                  return (
                    <tr key={idx} className="hover:bg-green-50/30 transition-colors">
                      <td className="px-2 py-1.5 font-medium text-gray-700">{r.mesNombre}</td>
                      <td className="px-2 py-1.5 text-center font-mono text-blue-700">{r._centro}</td>
                      <td className="px-2 py-1.5 text-gray-600 truncate max-w-[120px]">{String(r.lineaRef || r.LineaFabricacion || '—')}</td>
                      <td className="px-2 py-1.5 font-mono text-blue-800">{r.CodMaterial}</td>
                      <td className="px-2 py-1.5 text-gray-700">{String(r.Etiqueta || '—')}</td>
                      <td className="px-2 py-1.5 text-right font-mono text-indigo-700">{entry ? fmt(entry.invObjetivo) : '—'}</td>
                      <td className="px-2 py-1.5 text-right font-mono text-gray-700">{fmt(stockCierre)}</td>
                      <td className="px-2 py-1.5 text-right font-mono text-amber-700">{fmt(maxAdicional)}</td>
                      <td className="px-2 py-1.5 text-right font-mono font-bold text-green-700">{fmt(safeNumber(r._prodObjetivoInventario))}</td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Resumen mensual */}
      {monthlySummary.length > 0 && (
        <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
          <div className="px-4 py-3 bg-gray-50 border-b border-gray-200">
            <h4 className="text-sm font-bold text-gray-800">Resumen mensual PIO (filtros actuales)</h4>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm border-collapse">
              <thead className="bg-gray-100 text-[11px] uppercase text-gray-600">
                <tr>
                  <th className="px-3 py-2 text-left">Año</th>
                  <th className="px-3 py-2 text-left">Mes</th>
                  <th className="px-3 py-2 text-right text-green-800">Prod. PIO total</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {monthlySummary.map(row => (
                  <tr key={row.anio + '|' + row.mesNumero} className="hover:bg-gray-50 font-mono text-[13px]">
                    <td className="px-3 py-2">{row.anio}</td>
                    <td className="px-3 py-2 font-medium text-gray-800">{row.mesNombre}</td>
                    <td className="px-3 py-2 text-right text-green-700 font-semibold">{fmt(row.prodPio)}</td>
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
