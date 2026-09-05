'use client';

/**
 * Iv5StockEvolutionPanel
 *
 * Tabla pivote rapida para evaluar la evolucion mensual de stock por
 * (centro, sector) sin tener que descargar el Excel. Soporta modo
 * comparacion contra una version guardada en `Iv5VersionsPanel` para
 * medir el impacto de cambios en el motor IV5.
 *
 * - Filas: meses ordenados cronologicamente.
 * - Columnas: sectores definidos en `IV5_SECTORES_TOPE_AGREGADO` + Otros + TOTAL.
 * - Celdas: stock inicial -> stock final del mes.
 * - Una tabla por centro presente en la corrida actual.
 *
 * En modo comparacion se muestran lado a lado los valores de la corrida
 * actual vs la version seleccionada, con delta y porcentaje.
 */

import React, { useEffect, useMemo, useState } from 'react';
import { IV5_SECTORES_TOPE_AGREGADO } from './iv5Constants';
import { loadIv5Versions } from './iv5Persistence';
import type { Centro, Iv5MonthlySnapshot, Iv5Version } from './iv5Types';

interface Props {
  monthlyC1000: Iv5MonthlySnapshot[];
  monthlyC2000: Iv5MonthlySnapshot[];
}

interface MonthCellAgg {
  stockInicial: number;
  stockFinal: number;
}

type SectorBucket = string; // '01' | '02' | '03' | 'OTROS' | 'TOTAL'

interface PivotKeyParts {
  centro: Centro;
  mesEpoch: number; // anio*12 + mes
  mesNombre: string;
  sectorBucket: SectorBucket;
}

const SECTOR_BUCKETS: SectorBucket[] = [...IV5_SECTORES_TOPE_AGREGADO, 'OTROS', 'TOTAL'];

function normalizeSector(raw: string): SectorBucket {
  const trimmed = String(raw ?? '').trim();
  for (const s of IV5_SECTORES_TOPE_AGREGADO) {
    if (trimmed === s) return s;
    if (trimmed.startsWith(`${s} `)) return s;
    if (trimmed.startsWith(`${s}-`)) return s;
    if (trimmed.startsWith(`${s}_`)) return s;
  }
  return 'OTROS';
}

function fmt(n: number): string {
  if (!Number.isFinite(n)) return '-';
  return Math.round(n).toLocaleString('es-EC');
}

function fmtSigned(n: number): string {
  if (!Number.isFinite(n)) return '-';
  const v = Math.round(n);
  if (v === 0) return '0';
  return v > 0 ? `+${v.toLocaleString('es-EC')}` : v.toLocaleString('es-EC');
}

function fmtPct(n: number): string {
  if (!Number.isFinite(n) || n === 0) return '0%';
  const v = Math.abs(n) >= 1000 ? Math.round(n) : Math.round(n * 10) / 10;
  return `${n > 0 ? '+' : ''}${v}%`;
}

function pivotByCentroMesSector(
  monthly: Iv5MonthlySnapshot[],
): {
  byKey: Map<string, MonthCellAgg>;
  centros: Centro[];
  mesesOrdenados: { mesEpoch: number; mesNombre: string; mes: number; anio: number }[];
} {
  const byKey = new Map<string, MonthCellAgg>();
  const centros = new Set<Centro>();
  const meses = new Map<number, { mesNombre: string; mes: number; anio: number }>();

  for (const row of monthly) {
    centros.add(row.centro);
    const mesEpoch = row.anio * 12 + row.mes;
    if (!meses.has(mesEpoch)) {
      meses.set(mesEpoch, { mesNombre: row.mesNombre, mes: row.mes, anio: row.anio });
    }
    const sec = normalizeSector(row.sectorRef);

    const addToBucket = (bucket: SectorBucket) => {
      const k = `${row.centro}|${mesEpoch}|${bucket}`;
      const prev = byKey.get(k) ?? { stockInicial: 0, stockFinal: 0 };
      prev.stockInicial += Number(row.stockInicialMes) || 0;
      prev.stockFinal += Number(row.stockFinalMes) || 0;
      byKey.set(k, prev);
    };

    addToBucket(sec);
    addToBucket('TOTAL');
  }

  const mesesOrdenados = Array.from(meses.entries())
    .map(([mesEpoch, info]) => ({ mesEpoch, ...info }))
    .sort((a, b) => a.mesEpoch - b.mesEpoch);

  return {
    byKey,
    centros: Array.from(centros).sort(),
    mesesOrdenados,
  };
}

function getCell(
  byKey: Map<string, MonthCellAgg>,
  parts: PivotKeyParts,
): MonthCellAgg {
  const k = `${parts.centro}|${parts.mesEpoch}|${parts.sectorBucket}`;
  return byKey.get(k) ?? { stockInicial: 0, stockFinal: 0 };
}

const cellBaseClass =
  'px-2 py-1 text-right font-mono whitespace-nowrap tabular-nums';
const cellSeparatorClass = 'border-l border-gray-200';
const cellHeaderClass =
  'px-2 py-1 text-[11px] text-center font-semibold text-gray-700 bg-gray-50 border-b border-gray-200';

export const Iv5StockEvolutionPanel: React.FC<Props> = ({
  monthlyC1000,
  monthlyC2000,
}) => {
  const [collapsed, setCollapsed] = useState(false);
  const [compareVersionId, setCompareVersionId] = useState<string>('');
  const [versions, setVersions] = useState<Iv5Version[]>([]);

  useEffect(() => {
    setVersions(loadIv5Versions());
  }, []);

  const refreshVersions = () => setVersions(loadIv5Versions());

  const currentMonthly = useMemo(
    () => [...monthlyC1000, ...monthlyC2000],
    [monthlyC1000, monthlyC2000],
  );

  const pivotActual = useMemo(() => pivotByCentroMesSector(currentMonthly), [currentMonthly]);

  const compareVersion = useMemo(
    () => versions.find((v) => v.id === compareVersionId) ?? null,
    [versions, compareVersionId],
  );

  const pivotComparar = useMemo(() => {
    if (!compareVersion) return null;
    return pivotByCentroMesSector([
      ...compareVersion.monthlyC1000,
      ...compareVersion.monthlyC2000,
    ]);
  }, [compareVersion]);

  if (currentMonthly.length === 0) {
    return (
      <div className="rounded-md border border-gray-200 bg-gray-50 p-3 text-xs text-gray-600">
        Sin datos mensuales. Corre el motor IV5 para ver la evolucion de stock.
      </div>
    );
  }

  return (
    <div className="space-y-2">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setCollapsed((c) => !c)}
            className="text-[11px] px-2 py-1 rounded bg-gray-100 hover:bg-gray-200 text-gray-700"
          >
            {collapsed ? 'Expandir tabla' : 'Colapsar tabla'}
          </button>
          <span className="text-[11px] text-gray-500">
            {pivotActual.centros.length} centro(s), {pivotActual.mesesOrdenados.length} mes(es)
          </span>
        </div>
        <div className="flex items-center gap-2">
          <label className="text-[11px] text-gray-700">Comparar con:</label>
          <select
            value={compareVersionId}
            onChange={(e) => setCompareVersionId(e.target.value)}
            className="text-[11px] border border-gray-300 rounded px-2 py-1 bg-white"
          >
            <option value="">— Solo corrida actual —</option>
            {versions.map((v) => (
              <option key={v.id} value={v.id}>
                {v.id} {v.nota ? `(${v.nota})` : ''} —
                {' '}
                {new Date(v.savedAt).toLocaleString('es-EC')}
              </option>
            ))}
          </select>
          <button
            type="button"
            onClick={refreshVersions}
            className="text-[11px] px-2 py-1 rounded bg-gray-100 hover:bg-gray-200 text-gray-700"
            title="Recargar lista de versiones guardadas"
          >
            ↻
          </button>
        </div>
      </div>

      {!collapsed && (
        <div className="space-y-3">
          {pivotActual.centros.map((centro) => (
            <CentroTable
              key={centro}
              centro={centro}
              pivotActual={pivotActual}
              pivotComparar={pivotComparar}
            />
          ))}
        </div>
      )}
    </div>
  );
};

interface CentroTableProps {
  centro: Centro;
  pivotActual: ReturnType<typeof pivotByCentroMesSector>;
  pivotComparar: ReturnType<typeof pivotByCentroMesSector> | null;
}

const CentroTable: React.FC<CentroTableProps> = ({
  centro,
  pivotActual,
  pivotComparar,
}) => {
  const comparing = pivotComparar !== null;
  const meses = pivotActual.mesesOrdenados;

  return (
    <div className="border border-gray-200 rounded-lg overflow-hidden">
      <div className="bg-slate-800 text-white px-3 py-1.5 text-xs font-semibold">
        Centro {centro}
        {comparing && ' — Comparativo Actual vs Versión guardada'}
      </div>
      <div className="overflow-x-auto">
        <table className="min-w-full text-[11px]">
          <thead>
            <tr>
              <th className={cellHeaderClass} rowSpan={2}>
                Mes
              </th>
              {SECTOR_BUCKETS.map((s) => (
                <th
                  key={s}
                  className={`${cellHeaderClass} ${cellSeparatorClass}`}
                  colSpan={comparing ? 4 : 2}
                >
                  {s === 'TOTAL' ? 'TOTAL' : s === 'OTROS' ? 'Otros sectores' : `Sector ${s}`}
                </th>
              ))}
            </tr>
            <tr>
              {SECTOR_BUCKETS.map((s) =>
                comparing ? (
                  <React.Fragment key={`${s}-sub`}>
                    <th className={`${cellHeaderClass} ${cellSeparatorClass}`}>Actual fin</th>
                    <th className={cellHeaderClass}>Versión fin</th>
                    <th className={cellHeaderClass}>Δ</th>
                    <th className={cellHeaderClass}>%</th>
                  </React.Fragment>
                ) : (
                  <React.Fragment key={`${s}-sub`}>
                    <th className={`${cellHeaderClass} ${cellSeparatorClass}`}>Ini</th>
                    <th className={cellHeaderClass}>Fin</th>
                  </React.Fragment>
                ),
              )}
            </tr>
          </thead>
          <tbody>
            {meses.map((mes) => (
              <tr key={mes.mesEpoch} className="odd:bg-white even:bg-gray-50">
                <td className="px-2 py-1 font-medium text-gray-800 whitespace-nowrap">
                  {mes.mesNombre} {mes.anio}
                </td>
                {SECTOR_BUCKETS.map((sector) => {
                  const parts: PivotKeyParts = {
                    centro,
                    mesEpoch: mes.mesEpoch,
                    mesNombre: mes.mesNombre,
                    sectorBucket: sector,
                  };
                  const actual = getCell(pivotActual.byKey, parts);
                  if (comparing && pivotComparar) {
                    const previo = getCell(pivotComparar.byKey, parts);
                    const delta = actual.stockFinal - previo.stockFinal;
                    const pct =
                      previo.stockFinal !== 0
                        ? (delta / previo.stockFinal) * 100
                        : actual.stockFinal !== 0
                          ? Number.POSITIVE_INFINITY
                          : 0;
                    const deltaClass =
                      delta > 0
                        ? 'text-emerald-700 font-semibold'
                        : delta < 0
                          ? 'text-red-700 font-semibold'
                          : 'text-gray-500';
                    const pctClass =
                      pct > 0
                        ? 'text-emerald-700'
                        : pct < 0
                          ? 'text-red-700'
                          : 'text-gray-500';
                    return (
                      <React.Fragment key={sector}>
                        <td className={`${cellBaseClass} ${cellSeparatorClass}`}>
                          {fmt(actual.stockFinal)}
                        </td>
                        <td className={cellBaseClass}>{fmt(previo.stockFinal)}</td>
                        <td className={`${cellBaseClass} ${deltaClass}`}>{fmtSigned(delta)}</td>
                        <td className={`${cellBaseClass} ${pctClass}`}>
                          {Number.isFinite(pct) ? fmtPct(pct) : '∞'}
                        </td>
                      </React.Fragment>
                    );
                  }
                  return (
                    <React.Fragment key={sector}>
                      <td className={`${cellBaseClass} ${cellSeparatorClass}`}>
                        {fmt(actual.stockInicial)}
                      </td>
                      <td className={cellBaseClass}>{fmt(actual.stockFinal)}</td>
                    </React.Fragment>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};
