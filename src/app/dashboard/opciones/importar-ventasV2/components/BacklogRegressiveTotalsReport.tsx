'use client';

import React, { useMemo, useState, useCallback } from 'react';
import {
  aggregateViableTransferList,
  computeBacklogRegressiveFinalRows,
  viableTransfersFromC1000RegressiveRows,
} from './backlogRegressiveCompute';
import { MONTH_NAMES } from './constants';
import { safeNumber, exportToXLSX } from './utils';
import type { TiempoCanonResult, ViableTransfer, PioMap } from './types';
import { MultiSelectDropdown } from './MultiSelectDropdown';

export interface BacklogRegressiveTotalsReportProps {
  dataC1000: any[];
  dataC2000: any[];
  tiemposCanon: TiempoCanonResult[];
  maxExtrasHoras: number;
  horasExtrasFin: number;
  trasladosViables: ViableTransfer[];
  pioMap?: PioMap;
}

type MesAgg = {
  key: string;
  anio: number;
  mesNumero: number;
  mesNombre: string;
  stockIni: number;
  prodBase: number;
  produccion: number;
  prodPio: number;
  despachos: number;
  traslado: number;
  saldoFinal: number;
};

function formatNum(n: number) {
  return n.toLocaleString(undefined, { maximumFractionDigits: 0 });
}

function TotalsTableCentro({ titulo, filas }: { titulo: string; filas: MesAgg[] }) {
  return (
    <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden mb-8">
      <div className="px-4 py-3 bg-gray-50 border-b border-gray-200">
        <h3 className="text-base font-bold text-gray-800">{titulo}</h3>
        <p className="text-xs text-gray-500 mt-1">
          Sumatoria de filas del backlog regresivo con los filtros seleccionados (solo lectura).
        </p>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-sm border-collapse">
          <thead className="bg-gray-100 text-[11px] uppercase text-gray-600">
            <tr>
              <th className="px-3 py-2 text-left">Año</th>
              <th className="px-3 py-2 text-left">Mes</th>
              <th className="px-3 py-2 text-right">Stock ini</th>
              <th className="px-3 py-2 text-right text-slate-700">Prod. Base</th>
              <th className="px-3 py-2 text-right" title="Total = Base + Adelantada + Recuperada + Inv.Obj.">Producción Total</th>
              <th className="px-3 py-2 text-right text-green-800">Prod. Inv. Obj.</th>
              <th className="px-3 py-2 text-right">Despachos</th>
              <th className="px-3 py-2 text-right">Traslado</th>
              <th className="px-3 py-2 text-right">Saldo final</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {filas.length === 0 ? (
              <tr>
                <td colSpan={9} className="px-4 py-8 text-center text-gray-500">
                  Sin filas para los filtros actuales.
                </td>
              </tr>
            ) : (
              filas.map(row => (
                <tr key={row.key} className="hover:bg-gray-50 font-mono text-[13px]">
                  <td className="px-3 py-2">{row.anio}</td>
                  <td className="px-3 py-2 font-medium text-gray-800">{row.mesNombre}</td>
                  <td className="px-3 py-2 text-right text-indigo-700">{formatNum(row.stockIni)}</td>
                  <td className="px-3 py-2 text-right text-slate-600">{formatNum(row.prodBase)}</td>
                  <td className="px-3 py-2 text-right text-purple-700 font-semibold">{formatNum(row.produccion)}</td>
                  <td className={`px-3 py-2 text-right font-semibold ${row.prodPio > 0 ? 'text-green-700' : 'text-gray-300'}`}>{formatNum(row.prodPio)}</td>
                  <td className="px-3 py-2 text-right text-gray-800">{formatNum(row.despachos)}</td>
                  <td className="px-3 py-2 text-right text-amber-800">{formatNum(row.traslado)}</td>
                  <td className="px-3 py-2 text-right text-emerald-700 font-semibold">{formatNum(row.saldoFinal)}</td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function lineaOf(r: any): string {
  return String(r.lineaRef || r.LineaFabricacion || 'Sin línea');
}

function anioFila(r: any): number {
  return safeNumber(r._anioFila ?? r.Año ?? r.año);
}

function mesNumFila(r: any): number {
  return safeNumber(r._mesNumero);
}

/**
 * Reparte la parte del despacho que cubre la demanda del mes (ventas + traslado C1000→C2000)
 * en proporción a cada componente. Si parte del despacho solo liquida backlog, esa parte
 * queda fuera de estas dos columnas (suman como máximo `Despachos`).
 */
function splitDespachosVentasVsTraslado(r: any, isC1000: boolean): { ventas: number; traslado: number } {
  if (r._despachosVentas != null && r._despachosTraslado != null) {
    return { ventas: safeNumber(r._despachosVentas), traslado: safeNumber(r._despachosTraslado) };
  }
  const desp = safeNumber(r._despachosReales);
  if (!isC1000) {
    return { ventas: desp, traslado: 0 };
  }
  const dVentas = safeNumber(r._demandaVenta);
  const dTrasl = safeNumber(r._trasladoSalienteC2000);
  const D = safeNumber(r._demandaMes);
  if (D <= 0) {
    return { ventas: 0, traslado: 0 };
  }
  const cubiertoDemanda = Math.min(desp, D);
  const ratioV = dVentas / D;
  const ratioT = dTrasl / D;
  let v = Math.round(cubiertoDemanda * ratioV);
  let t = Math.round(cubiertoDemanda * ratioT);
  const diff = cubiertoDemanda - (v + t);
  if (diff !== 0) {
    if (dVentas >= dTrasl) v += diff;
    else t += diff;
  }
  return { ventas: v, traslado: t };
}

function applyRowFilters(
  rows: any[],
  anios: string[],
  meses: string[],
  sectores: string[],
  lineas: string[]
): any[] {
  let out = rows;
  if (anios.length > 0) {
    const ys = new Set(anios.map(a => parseInt(a, 10)));
    out = out.filter(r => ys.has(anioFila(r)));
  }
  if (meses.length > 0) {
    const ms = new Set(meses);
    out = out.filter(r => ms.has(String(r.mesNombre)));
  }
  if (sectores.length > 0) {
    const ss = new Set(sectores);
    out = out.filter(r => ss.has(String(r.Sector || '')));
  }
  if (lineas.length > 0) {
    const ls = new Set(lineas);
    out = out.filter(r => ls.has(lineaOf(r)));
  }
  return out;
}

function aggregateByMonth(rows: any[], isC1000: boolean): MesAgg[] {
  const map = new Map<string, MesAgg>();
  for (const r of rows) {
    const anio = anioFila(r);
    const mesNumero = mesNumFila(r);
    if (!mesNumero) continue;
    const key = `${anio}|${mesNumero}`;
    const mesNombre = String(r.mesNombre || MONTH_NAMES[mesNumero] || '');
    const trasl = isC1000
      ? safeNumber(r._despachosTraslado ?? r._trasladoSalienteC2000)
      : safeNumber(r._trasladoEntranteDesdeC1000);
    const cur =
      map.get(key) ||
      ({
        key,
        anio,
        mesNumero,
        mesNombre,
        stockIni: 0,
        prodBase: 0,
        produccion: 0,
        prodPio: 0,
        despachos: 0,
        traslado: 0,
        saldoFinal: 0,
      } as MesAgg);
    cur.stockIni += safeNumber(r._stockInitial);
    cur.prodBase += safeNumber(r._prodBase);
    cur.produccion += safeNumber(r._prodViableTotal);
    cur.prodPio += safeNumber(r._prodObjetivoInventario);
    cur.despachos += safeNumber(r._despachosReales);
    cur.traslado += trasl;
    cur.saldoFinal += safeNumber(r._saldoFinal);
    map.set(key, cur);
  }
  return Array.from(map.values()).sort((a, b) => {
    if (a.anio !== b.anio) return a.anio - b.anio;
    return a.mesNumero - b.mesNumero;
  });
}

export const BacklogRegressiveTotalsReport: React.FC<BacklogRegressiveTotalsReportProps> = ({
  dataC1000,
  dataC2000,
  tiemposCanon,
  maxExtrasHoras,
  horasExtrasFin,
  trasladosViables,
  pioMap,
}) => {
  const [anios, setAnios] = useState<string[]>([]);
  const [meses, setMeses] = useState<string[]>([]);
  const [sectores, setSectores] = useState<string[]>([]);
  const [lineas, setLineas] = useState<string[]>([]);

  const { rowsC1000, rowsC2000 } = useMemo(() => {
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
    return { rowsC1000: r1, rowsC2000: r2 };
  }, [dataC1000, dataC2000, tiemposCanon, maxExtrasHoras, horasExtrasFin, trasladosViables, pioMap]);

  const aniosOpciones = useMemo(() => {
    const s = new Set<number>();
    [...rowsC1000, ...rowsC2000].forEach(r => {
      const y = anioFila(r);
      if (y) s.add(y);
    });
    return Array.from(s).sort((a, b) => b - a).map(y => ({ value: String(y), label: String(y) }));
  }, [rowsC1000, rowsC2000]);

  const sectoresOpciones = useMemo(() => {
    const s = new Set<string>();
    [...rowsC1000, ...rowsC2000].forEach(r => {
      const v = String(r.Sector || '').trim();
      if (v) s.add(v);
    });
    return Array.from(s).sort().map(v => ({ value: v, label: v }));
  }, [rowsC1000, rowsC2000]);

  const lineasOpciones = useMemo(() => {
    const s = new Set<string>();
    [...rowsC1000, ...rowsC2000].forEach(r => s.add(lineaOf(r)));
    return Array.from(s).sort().map(v => ({ value: v, label: v }));
  }, [rowsC1000, rowsC2000]);

  const mesesOpciones = useMemo(() => {
    const s = new Set<string>();
    [...rowsC1000, ...rowsC2000].forEach(r => {
      if (r.mesNombre) s.add(String(r.mesNombre));
    });
    return Array.from(s)
      .sort((a, b) => {
        const na = Object.entries(MONTH_NAMES).find(([, v]) => v === a)?.[0];
        const nb = Object.entries(MONTH_NAMES).find(([, v]) => v === b)?.[0];
        return parseInt(na || '0', 10) - parseInt(nb || '0', 10);
      })
      .map(v => ({ value: v, label: v }));
  }, [rowsC1000, rowsC2000]);

  const filteredC1000 = useMemo(
    () => applyRowFilters(rowsC1000, anios, meses, sectores, lineas),
    [rowsC1000, anios, meses, sectores, lineas]
  );
  const filteredC2000 = useMemo(
    () => applyRowFilters(rowsC2000, anios, meses, sectores, lineas),
    [rowsC2000, anios, meses, sectores, lineas]
  );

  const agg1000 = useMemo(() => aggregateByMonth(filteredC1000, true), [filteredC1000]);
  const agg2000 = useMemo(() => aggregateByMonth(filteredC2000, false), [filteredC2000]);

  const cuadreTraslados = useMemo(() => {
    const t1 = agg1000.reduce((s, r) => s + r.traslado, 0);
    const t2 = agg2000.reduce((s, r) => s + r.traslado, 0);
    return { saliente: t1, entrante: t2, ok: Math.abs(t1 - t2) < 0.5 };
  }, [agg1000, agg2000]);

  const handleExport = useCallback(() => {
    const filtroAnio = anios.length ? anios.join(', ') : 'Todos';
    const filtroMes = meses.length ? meses.join(', ') : 'Todos';
    const filtroSector = sectores.length ? sectores.join(', ') : 'Todos';
    const filtroLinea = lineas.length ? lineas.join(', ') : 'Todos';

    const pushDetalle = (rows: any[], centro: '1000' | '2000') => {
      const out: Record<string, string | number>[] = [];
      const isC1000 = centro === '1000';
      for (const r of rows) {
        const despSplit = splitDespachosVentasVsTraslado(r, isC1000);
        out.push({
          Centro: centro,
          Año: anioFila(r),
          MesNombre: String(r.mesNombre || ''),
          MesNumero: mesNumFila(r),
          Sector: String(r.Sector || ''),
          Linea: lineaOf(r),
          CodMaterial: String(r.CodMaterial ?? ''),
          Clase: String(r.ClaseAprovisionam ?? ''),
          Descripcion: String(r.Descripcion ?? ''),
          FiltroAnioAplicado: filtroAnio,
          FiltroMesAplicado: filtroMes,
          FiltroSectorAplicado: filtroSector,
          FiltroLineaAplicado: filtroLinea,
          StockInicial: safeNumber(r._stockInitial),
          DemandaVentas: safeNumber(r._demandaVenta),
          TotalNecesidad: safeNumber(r._demandaMes),
          TrasladoPlanC2000: isC1000 ? safeNumber(r._trasladoSalienteC2000) : 0,
          TrasladoIntercentro: isC1000
            ? safeNumber(r._despachosTraslado ?? r._trasladoSalienteC2000)
            : safeNumber(r._trasladoEntranteDesdeC1000),
          ProduccionBase: safeNumber(r._prodBase),
          ProduccionTotal: safeNumber(r._prodViableTotal),
          ProduccionPIO: safeNumber(r._prodObjetivoInventario),
          ProdAdelantada: safeNumber(r._prodAdelantada),
          ProdRecuperada: safeNumber(r._prodRecuperada),
          Despachos: safeNumber(r._despachosReales),
          DespachosVentas: despSplit.ventas,
          DespachosTrasladoAlC2000: despSplit.traslado,
          BacklogFinal: safeNumber(r._backlogFinal),
          BacklogFinalVentas: safeNumber(r._backlogFinalVentas ?? r._backlogFinal),
          BacklogFinalTraslado: safeNumber(r._backlogFinalTraslado ?? 0),
          SaldoFinal: safeNumber(r._saldoFinal),
        });
      }
      return out;
    };

    const flat = [...pushDetalle(filteredC1000, '1000'), ...pushDetalle(filteredC2000, '2000')];
    if (flat.length === 0) {
      alert('No hay filas de detalle para exportar con los filtros actuales.');
      return;
    }
    exportToXLSX(flat, 'Backlog_Regresivo_detalle');
  }, [filteredC1000, filteredC2000, anios, meses, sectores, lineas]);

  const sinDatos = rowsC1000.length === 0 && rowsC2000.length === 0;

  if (sinDatos) {
    return (
      <div className="p-8 text-center text-gray-600 bg-white rounded-xl border border-gray-200">
        <p className="font-medium">No hay resultados de backlog regresivo.</p>
        <p className="text-sm mt-2">Cargue datos y complete el análisis (C1000 / C2000) antes de consultar este reporte.</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="bg-white rounded-xl border border-gray-200 p-4 shadow-sm">
        <div className="flex flex-col lg:flex-row lg:items-end gap-3 flex-wrap">
          <MultiSelectDropdown
            label="Año"
            options={aniosOpciones}
            selected={anios}
            onChange={setAnios}
          />
          <MultiSelectDropdown
            label="Mes"
            options={mesesOpciones}
            selected={meses}
            onChange={setMeses}
          />
          <MultiSelectDropdown
            label="Sector"
            options={sectoresOpciones}
            selected={sectores}
            onChange={setSectores}
          />
          <MultiSelectDropdown
            label="Línea"
            options={lineasOpciones}
            selected={lineas}
            onChange={setLineas}
          />
          <button
            type="button"
            onClick={handleExport}
            className="ml-auto inline-flex items-center px-4 py-2 rounded-md bg-green-600 text-white text-sm font-medium hover:bg-green-700"
          >
            Exportar Excel
          </button>
        </div>
        <p className="text-[11px] text-gray-500 mt-2 max-w-4xl">
          El Excel incluye <strong>cada fila de detalle</strong> del backlog regresivo (material–mes–línea–sector, etc.) que
          cumple los filtros, con columnas <strong>Centro</strong>, <strong>Año</strong>, <strong>Mes</strong>,{' '}
          <strong>Sector</strong>, <strong>Línea</strong> y métricas, para que en la tabla dinámica elijas qué niveles
          mostrar u ocultar.
        </p>

        <div
          className={`mt-3 text-xs rounded-md px-3 py-2 ${
            cuadreTraslados.ok ? 'bg-emerald-50 text-emerald-900' : 'bg-amber-50 text-amber-900'
          }`}
        >
          <strong>Intercentro (filtros actuales):</strong> traslado saliente C1000 = {formatNum(cuadreTraslados.saliente)} ·
          traslado entrante C2000 = {formatNum(cuadreTraslados.entrante)}
          {!cuadreTraslados.ok && (
            <span className="block mt-1 font-semibold">
              Diferencia detectada: revise filtros o consistencia material–mes vs. listado viable.
            </span>
          )}
        </div>
      </div>

      <TotalsTableCentro titulo="Totales mensuales — Centro 1000" filas={agg1000} />
      <TotalsTableCentro titulo="Totales mensuales — Centro 2000" filas={agg2000} />
    </div>
  );
};
