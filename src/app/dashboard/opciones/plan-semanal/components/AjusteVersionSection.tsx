'use client';

import React, { useMemo, useState, useCallback } from 'react';
import type { PlanSemanalRow, WeekSegment, VersionPlan, AjusteEntry } from './types';
import { buildSectorPivot, applyAdjustments } from './weeklyCompute';
import { isSectorEditableByCode, sectorFromPivotKey, centroFromPivotKey } from './sectorEditPolicy';
import { planGlobalService } from '@/services/planglobal.service';
import { detallesService } from '@/services/detalles.service';

interface Props {
  rows: PlanSemanalRow[];
  segments: WeekSegment[];
  activeSatKeys: Set<string>;
  onToggleSaturday: (satKey: string) => void;
  readOnlyProduction?: boolean;
  requiredSaturdaysByMonth?: Record<string, number>;
  año: string;
  meses: string[];
  onVersionSaved: (v: VersionPlan) => void;
}

function generateVersionId(count: number): string {
  const num = String(count + 1).padStart(4, '0');
  const now  = new Date();
  const d    = String(now.getDate()).padStart(2, '0');
  const m    = String(now.getMonth() + 1).padStart(2, '0');
  const y    = String(now.getFullYear());
  return `V${num}.${d}${m}${y}`;
}

function safeNum(v: unknown): number {
  const n = Number(v);
  return isNaN(n) ? 0 : n;
}

function monthLabel(anio: number, mes: number): string {
  const dt = new Date(anio, mes - 1, 1);
  return dt.toLocaleDateString('es-CL', { month: 'short', year: 'numeric' });
}

function loadVersionCount(): number {
  try {
    const raw = localStorage.getItem('ps_versions');
    if (!raw) return 0;
    return (JSON.parse(raw) as VersionPlan[]).length;
  } catch { return 0; }
}

/** Saves rows to DB in batches to avoid overwhelming the API. */
async function saveBatchToDB(
  rows: PlanSemanalRow[],
  codigoPlan: number,
  onProgress?: (done: number, total: number) => void,
): Promise<void> {
  const BATCH = 1000;
  let done = 0;
  for (let i = 0; i < rows.length; i += BATCH) {
    const batch = rows.slice(i, i + BATCH);
    const payload = batch.map((r) => ({
      codigo_detalle:          0,
      codigo_plan:             codigoPlan,
      codigo_familia_producto: 1,                           // FK requerido; default hasta tener lookup
      centro:                  r.centro,
      centro_produccion:       r.sector,
      codigo_material:         r.CodMaterial,
      cantidad_proyectada:     r.despachosVentasSemana,    // despachos ventas distribuidos
      cantidad_producir:       r.cantidadSemanal,          // producción planificada semanal
      semana:                  r.isoWeek,
      cantidad_transferencia:  r.trasladoSemana,           // traslado intercentro distribuido
      linea_produccion:        r.linea,
      estado:                  'A',
    }));
    await detallesService.savePlanSemanalBulk(payload);
    done += batch.length;
    onProgress?.(done, rows.length);
  }
}

export const AjusteVersionSection: React.FC<Props> = ({
  rows, segments, activeSatKeys, onToggleSaturday, readOnlyProduction = false, requiredSaturdaysByMonth, año, meses, onVersionSaved
}) => {
  const [overrides, setOverrides] = useState<Map<string, Map<string, number>>>(new Map());
  const [appliedOverrides, setAppliedOverrides] = useState<Map<string, Map<string, number>>>(new Map());
  const [refreshCount, setRefreshCount] = useState(0);
  const [nota, setNota] = useState('');
  const [saving, setSaving] = useState(false);
  const [saveProgress, setSaveProgress] = useState<{ done: number; total: number } | null>(null);
  const [saved, setSaved] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  const basePivot = useMemo(() => buildSectorPivot(rows), [rows]);

  /** Solo sectores 01, 02 y 03 por centro (vista de ajuste acotada). */
  const sectorKeys = useMemo(() => {
    const keys: string[] = [];
    for (const sk of basePivot.keys()) {
      if (!isSectorEditableByCode(sectorFromPivotKey(sk))) continue;
      if (!keys.includes(sk)) keys.push(sk);
    }
    return keys.sort();
  }, [basePivot]);

  /** Filas de sector ordenadas por centro, seguidas de una fila total por cada centro con datos. */
  const pivotBodyRows = useMemo(() => {
    type Row = { kind: 'sector'; sk: string } | { kind: 'total'; centro: string };
    const sorted = [...sectorKeys].sort((a, b) => {
      const ca = centroFromPivotKey(a);
      const cb = centroFromPivotKey(b);
      if (ca !== cb) return ca.localeCompare(cb);
      return sectorFromPivotKey(a).localeCompare(sectorFromPivotKey(b));
    });
    const centros = [...new Set(sorted.map(centroFromPivotKey))].filter(Boolean).sort();
    const out: Row[] = [];
    for (const c of centros) {
      const keys = sorted.filter(sk => centroFromPivotKey(sk) === c);
      for (const sk of keys) out.push({ kind: 'sector', sk });
      if (keys.length > 0) out.push({ kind: 'total', centro: c });
    }
    return out;
  }, [sectorKeys]);

  const monthGroups = useMemo(() => {
    const groups = new Map<string, { key: string; label: string; segments: WeekSegment[] }>();
    for (const seg of segments) {
      const key = `${seg.anio}-${String(seg.mes).padStart(2, '0')}`;
      if (!groups.has(key)) {
        groups.set(key, { key, label: monthLabel(seg.anio, seg.mes), segments: [] });
      }
      groups.get(key)!.segments.push(seg);
    }
    return Array.from(groups.values());
  }, [segments]);

  const selectedSaturdaysByMonth = useMemo(() => {
    const out: Record<string, number> = {};
    for (const seg of segments) {
      if (!seg.tieneSabado) continue;
      const key = `${seg.anio}-${String(seg.mes).padStart(2, '0')}`;
      if (activeSatKeys.has(seg.satKey)) out[key] = (out[key] || 0) + 1;
    }
    return out;
  }, [segments, activeSatKeys]);

  const getCell = useCallback((sKey: string, wKey: string) => {
    const base = basePivot.get(sKey)?.get(wKey) ?? { cantDiaria: 0, cantSemanal: 0, diasEfectivos: 0 };
    const editable = isSectorEditableByCode(sectorFromPivotKey(sKey));
    const ov = editable ? appliedOverrides.get(sKey)?.get(wKey) : undefined;
    if (ov !== undefined) {
      return { cantDiaria: ov, cantSemanal: ov * base.diasEfectivos, diasEfectivos: base.diasEfectivos };
    }
    return base;
  }, [appliedOverrides, basePivot, refreshCount]);

  const handleCellChange = useCallback((sKey: string, wKey: string, value: string) => {
    if (readOnlyProduction) return;
    if (!isSectorEditableByCode(sectorFromPivotKey(sKey))) return;
    const num = parseFloat(value);
    setOverrides(prev => {
      const next = new Map(prev);
      if (!next.has(sKey)) next.set(sKey, new Map());
      const wMap = new Map(next.get(sKey)!);
      if (isNaN(num)) wMap.delete(wKey);
      else wMap.set(wKey, num);
      next.set(sKey, wMap);
      return next;
    });
  }, [readOnlyProduction]);

  const overridesEditableOnly = useMemo(() => {
    const out = new Map<string, Map<string, number>>();
    for (const [sk, wm] of overrides) {
      if (!isSectorEditableByCode(sectorFromPivotKey(sk))) continue;
      out.set(sk, wm);
    }
    return out;
  }, [overrides]);

  const adjustedRows = useMemo(() => {
    if (overridesEditableOnly.size === 0) return rows;
    return applyAdjustments(rows, overridesEditableOnly);
  }, [rows, overridesEditableOnly]);

  const applyDemandRefresh = useCallback(() => {
    const snapshot = new Map<string, Map<string, number>>();
    for (const [sk, wm] of overridesEditableOnly.entries()) {
      snapshot.set(sk, new Map(wm));
    }
    setAppliedOverrides(snapshot);
    setRefreshCount(prev => prev + 1);
  }, [overridesEditableOnly]);

  const handleSave = async () => {
    setSaving(true);
    setSaveError(null);
    setSaveProgress(null);

    try {
      if (requiredSaturdaysByMonth) {
        const mismatches: string[] = [];
        for (const [monthKey, required] of Object.entries(requiredSaturdaysByMonth)) {
          const selected = selectedSaturdaysByMonth[monthKey] || 0;
          if (selected !== required) {
            mismatches.push(`${monthKey}: ${selected}/${required}`);
          }
        }
        if (mismatches.length > 0) {
          setSaveError(`No se puede guardar. Sábados por mes fuera de regla exacta (${mismatches.join(' · ')}).`);
          return;
        }
      }

      // 1. Build version metadata
      const count = loadVersionCount();
      const id    = generateVersionId(count);
      const now   = new Date();

      const ajustes: AjusteEntry[] = [];
      for (const [sk, wMap] of overridesEditableOnly.entries()) {
        const pipe = sk.indexOf('|');
        const centro = pipe >= 0 ? sk.slice(0, pipe) : '';
        const sector = pipe >= 0 ? sk.slice(pipe + 1) : sk;
        for (const [weekKey, cantDiariaAjustada] of wMap.entries()) {
          ajustes.push({ sector, centro, weekKey, cantDiariaAjustada });
        }
      }

      // 2. Save header to DB
      const allSegs   = segments;
      const firstSeg  = allSegs[0];
      const lastSeg   = allSegs[allSegs.length - 1];
      const fechaIni  = firstSeg
        ? new Date(firstSeg.anio, firstSeg.mes - 1, 1)
        : now;
      const fechaFin  = lastSeg
        ? new Date(lastSeg.anio, lastSeg.mes, 0)  // last day of last month
        : now;

      let codigoPlan = 0;
      let savedToDB  = false;

      try {
        const planResp = await planGlobalService.save({
          codigo_plan:       0,
          identificador_plan: id,
          fecha_inicio:      fechaIni,
          fecha_fin:         fechaFin,
          estado:            'A',
          fecha_creacion:    now,
          usuario_creacion:  'sistema',
        });
        codigoPlan = planResp.data?.codigo_plan ?? 0;

        // 3. Save all detail rows to DB in batches
        const totalRows = adjustedRows.length;
        setSaveProgress({ done: 0, total: totalRows });
        await saveBatchToDB(adjustedRows, codigoPlan, (done, total) => {
          setSaveProgress({ done, total });
        });
        savedToDB = true;
      } catch (dbErr) {
        console.error('Error al guardar en DB (se guarda solo en localStorage):', dbErr);
        setSaveError(`Guardado en DB falló: ${dbErr instanceof Error ? dbErr.message : 'Error desconocido'}. La versión se guardó solo localmente.`);
      }

      // 4. Always save to localStorage (independent of DB result)
      const version: VersionPlan = {
        id,
        savedAt:       now.toISOString(),
        año,
        meses,
        nota,
        activeSatKeys: Array.from(activeSatKeys),
        ajustes,
        rowsC1000:     adjustedRows.filter(r => r.centro === '1000'),
        rowsC2000:     adjustedRows.filter(r => r.centro === '2000'),
        savedToDB,
      };

      const raw      = localStorage.getItem('ps_versions');
      const versions = raw ? JSON.parse(raw) as VersionPlan[] : [];
      versions.unshift(version);
      localStorage.setItem('ps_versions', JSON.stringify(versions));

      if (!saveError) {
        setSaved(true);
        setTimeout(() => setSaved(false), 4000);
      }
      onVersionSaved(version);
    } catch (e) {
      setSaveError(`Error inesperado: ${e instanceof Error ? e.message : String(e)}`);
    } finally {
      setSaving(false);
      setSaveProgress(null);
    }
  };

  if (rows.length === 0) {
    return (
      <div className="p-8 text-center text-gray-500">
        Sin datos. Envía los resultados del Backlog Regresivo desde Importar Ventas 2.
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        {!readOnlyProduction && (
          <button
            type="button"
            onClick={applyDemandRefresh}
            className="px-3 py-1.5 text-xs font-semibold rounded bg-blue-600 text-white hover:bg-blue-700"
          >
            Actualizar demanda
          </button>
        )}
      </div>
      {requiredSaturdaysByMonth && (
        <div className="bg-amber-50 border border-amber-200 rounded-md p-2 text-[11px] text-amber-900">
          {Object.entries(requiredSaturdaysByMonth).map(([monthKey, required]) => {
            const selected = selectedSaturdaysByMonth[monthKey] || 0;
            const ok = selected === required;
            return (
              <div key={monthKey} className={ok ? 'text-emerald-700' : 'text-amber-800'}>
                {monthKey}: Sábados seleccionados <strong>{selected}</strong> / requeridos <strong>{required}</strong>
              </div>
            );
          })}
        </div>
      )}

      {/* Pivot table */}
      <div className="overflow-x-auto border border-gray-200 rounded-lg">
        <table className="text-[10px] w-full border-collapse">
          <thead className="bg-gray-50 sticky top-0 z-10">
            <tr>
              <th className="px-2 py-2 text-left border-b border-r border-gray-200 bg-gray-100 min-w-[80px]">Centro</th>
              <th className="px-2 py-2 text-left border-b border-r border-gray-200 bg-gray-100 min-w-[130px]">Sector</th>
              {monthGroups.flatMap(group => [
                ...group.segments.map(seg => {
                const diasEf = seg.diasLaborales + (seg.tieneSabado && activeSatKeys.has(seg.satKey) ? 1 : 0);
                const satOn = seg.tieneSabado && activeSatKeys.has(seg.satKey);
                return (
                  <th key={`${group.key}-${seg.weekKey}`} className="px-2 py-2 text-center border-b border-r border-gray-200 min-w-[96px]">
                    <div className="font-bold">{seg.label}</div>
                    <div className="text-gray-500 font-normal text-[9px]">
                      {seg.diasLaborales} L-V
                      {seg.tieneSabado ? ' + sáb' : ''} = {diasEf}d
                    </div>
                    {seg.tieneSabado && (
                      <button
                        type="button"
                        onClick={() => onToggleSaturday(seg.satKey)}
                        className={`mt-1 px-2 py-0.5 rounded text-[9px] font-semibold border transition-colors ${
                          satOn
                            ? 'bg-amber-200 border-amber-500 text-amber-900'
                            : 'bg-white border-amber-300 text-amber-800 hover:bg-amber-50'
                        }`}
                        title="Incluir o excluir el sábado de esta semana ISO en el reparto (solo en este tramo de mes)"
                      >
                        {satOn ? 'Sábado ON' : 'Sábado OFF'}
                      </button>
                    )}
                  </th>
                );
              }),
                <th key={`month-total-${group.key}`} className="px-2 py-2 text-center border-b border-r border-gray-300 bg-blue-50 min-w-[120px]">
                  <div className="font-bold text-blue-900">Total ventas mes</div>
                  <div className="text-blue-700 font-normal text-[9px]">{group.label}</div>
                </th>,
              ])}
            </tr>
          </thead>
          <tbody>
            {(() => {
              let sectorRowIndex = 0;
              return pivotBodyRows.map(row => {
              if (row.kind === 'total') {
                const c = row.centro;
                const keysForC = sectorKeys.filter(sk => centroFromPivotKey(sk) === c);
                return (
                  <tr
                    key={`total-${c}`}
                    className="bg-indigo-50 border-t-2 border-indigo-200 font-bold text-indigo-950"
                  >
                    <td className="px-2 py-1.5 border-r border-indigo-200">
                      {c === '1000' ? 'C1000' : c === '2000' ? 'C2000' : c}
                    </td>
                    <td className="px-2 py-1.5 border-r border-indigo-200 text-[10px] uppercase tracking-tight">
                      Total sect. 01–03
                    </td>
                    {monthGroups.flatMap(group => {
                      const weekCells = group.segments.map(seg => {
                        let sumDia = 0;
                        let sumSem = 0;
                        for (const sk of keysForC) {
                          const cell = getCell(sk, seg.weekKey);
                          sumDia += safeNum(cell.cantDiaria);
                          sumSem += safeNum(cell.cantSemanal);
                        }
                        return (
                          <td key={`${c}-${group.key}-${seg.weekKey}`} className="px-1 py-1.5 text-right border-r border-indigo-100">
                            <div className="flex flex-col items-end gap-0.5">
                              <span className="tabular-nums">{sumDia.toLocaleString(undefined, { maximumFractionDigits: 2 })}</span>
                              <span className="text-indigo-700 text-[9px] font-semibold">
                                Sem: {sumSem.toLocaleString()}
                              </span>
                            </div>
                          </td>
                        );
                      });
                      let monthTotal = 0;
                      for (const sk of keysForC) {
                        for (const seg of group.segments) {
                          monthTotal += safeNum(getCell(sk, seg.weekKey).cantSemanal);
                        }
                      }
                      return [
                        ...weekCells,
                        <td key={`mt-${c}-${group.key}`} className="px-1 py-1.5 text-right border-r border-indigo-200 bg-indigo-100/50">
                          <span className="tabular-nums font-bold">{monthTotal.toLocaleString()}</span>
                        </td>,
                      ];
                    })}
                  </tr>
                );
              }
              const sk = row.sk;
              const pipe = sk.indexOf('|');
              const centro = pipe >= 0 ? sk.slice(0, pipe) : '';
              const sector = pipe >= 0 ? sk.slice(pipe + 1) : sk;
              const stripe = sectorRowIndex++ % 2 === 0 ? 'bg-white' : 'bg-gray-50';
              return (
                <tr key={sk} className={stripe}>
                  <td className="px-2 py-1 border-r border-gray-200 font-semibold text-blue-800">
                    {centro === '1000' ? 'C1000' : 'C2000'}
                  </td>
                  <td className="px-2 py-1 border-r border-gray-200 font-medium text-gray-700">{sector}</td>
                  {monthGroups.flatMap(group => {
                    const weekCells = group.segments.map(seg => {
                      const cell = getCell(sk, seg.weekKey);
                      const isOverridden = overrides.get(sk)?.has(seg.weekKey);
                      return (
                        <td key={`${sk}-${group.key}-${seg.weekKey}`} className="px-1 py-1 border-r border-gray-100">
                          <div className="flex flex-col items-center gap-0.5">
                            <input
                              type="number"
                              min={0}
                              value={isOverridden ? (overrides.get(sk)?.get(seg.weekKey) ?? '') : (cell.cantDiaria || '')}
                              placeholder={String(cell.cantDiaria || 0)}
                              onChange={e => handleCellChange(sk, seg.weekKey, e.target.value)}
                              disabled={readOnlyProduction}
                              className={`w-full text-right text-[10px] border rounded px-1 py-0.5 ${
                                isOverridden
                                  ? 'border-amber-400 bg-amber-50 font-semibold'
                                  : 'border-gray-200 bg-white'
                              }`}
                            />
                            <span className="text-gray-500 text-[9px]">
                              Sem: {cell.cantSemanal.toLocaleString()}
                            </span>
                          </div>
                        </td>
                      );
                    });
                    let monthTotal = 0;
                    for (const seg of group.segments) {
                      monthTotal += safeNum(getCell(sk, seg.weekKey).cantSemanal);
                    }
                    return [
                      ...weekCells,
                      <td key={`mt-${sk}-${group.key}`} className="px-1 py-1 text-right border-r border-blue-200 bg-blue-50/40">
                        <span className="tabular-nums font-semibold text-blue-900">{monthTotal.toLocaleString()}</span>
                      </td>,
                    ];
                  })}
                </tr>
              );
            });
            })()}
            {(() => {
              const sectors = [...new Set(sectorKeys.map(sk => sectorFromPivotKey(sk)))].sort();
              const rowsNational: React.ReactNode[] = [];
              for (const sec of sectors) {
                const keysForSector = sectorKeys.filter(sk => sectorFromPivotKey(sk) === sec);
                rowsNational.push(
                  <tr key={`national-${sec}`} className="bg-emerald-50 border-t border-emerald-200 font-semibold text-emerald-950">
                    <td className="px-2 py-1.5 border-r border-emerald-200">Nacional</td>
                    <td className="px-2 py-1.5 border-r border-emerald-200">Sector {sec}</td>
                    {monthGroups.flatMap(group => {
                      const weekCells = group.segments.map(seg => {
                        let sumDia = 0;
                        let sumSem = 0;
                        for (const sk of keysForSector) {
                          const cell = getCell(sk, seg.weekKey);
                          sumDia += safeNum(cell.cantDiaria);
                          sumSem += safeNum(cell.cantSemanal);
                        }
                        return (
                          <td key={`nat-${sec}-${group.key}-${seg.weekKey}`} className="px-1 py-1.5 text-right border-r border-emerald-100">
                            <div className="flex flex-col items-end gap-0.5">
                              <span className="tabular-nums">{sumDia.toLocaleString(undefined, { maximumFractionDigits: 2 })}</span>
                              <span className="text-emerald-700 text-[9px] font-semibold">Sem: {sumSem.toLocaleString()}</span>
                            </div>
                          </td>
                        );
                      });
                      let monthTotal = 0;
                      for (const sk of keysForSector) {
                        for (const seg of group.segments) {
                          monthTotal += safeNum(getCell(sk, seg.weekKey).cantSemanal);
                        }
                      }
                      return [
                        ...weekCells,
                        <td key={`nat-mt-${sec}-${group.key}`} className="px-1 py-1.5 text-right border-r border-emerald-200 bg-emerald-100/60">
                          <span className="tabular-nums font-bold">{monthTotal.toLocaleString()}</span>
                        </td>,
                      ];
                    })}
                  </tr>,
                );
              }

              rowsNational.push(
                <tr key="national-grand-total" className="bg-emerald-100 border-t-2 border-emerald-300 font-bold text-emerald-950">
                  <td className="px-2 py-1.5 border-r border-emerald-300">Nacional</td>
                  <td className="px-2 py-1.5 border-r border-emerald-300">Gran Total</td>
                  {monthGroups.flatMap(group => {
                    const weekCells = group.segments.map(seg => {
                      let sumDia = 0;
                      let sumSem = 0;
                      for (const sk of sectorKeys) {
                        const cell = getCell(sk, seg.weekKey);
                        sumDia += safeNum(cell.cantDiaria);
                        sumSem += safeNum(cell.cantSemanal);
                      }
                      return (
                        <td key={`nat-grand-${group.key}-${seg.weekKey}`} className="px-1 py-1.5 text-right border-r border-emerald-200">
                          <div className="flex flex-col items-end gap-0.5">
                            <span className="tabular-nums">{sumDia.toLocaleString(undefined, { maximumFractionDigits: 2 })}</span>
                            <span className="text-emerald-800 text-[9px] font-semibold">Sem: {sumSem.toLocaleString()}</span>
                          </div>
                        </td>
                      );
                    });
                    let monthTotal = 0;
                    for (const sk of sectorKeys) {
                      for (const seg of group.segments) {
                        monthTotal += safeNum(getCell(sk, seg.weekKey).cantSemanal);
                      }
                    }
                    return [
                      ...weekCells,
                      <td key={`nat-grand-mt-${group.key}`} className="px-1 py-1.5 text-right border-r border-emerald-300 bg-emerald-200/60">
                        <span className="tabular-nums font-bold">{monthTotal.toLocaleString()}</span>
                      </td>,
                    ];
                  })}
                </tr>,
              );

              return rowsNational;
            })()}
          </tbody>
        </table>
      </div>

      {/* Save section */}
      <div className="space-y-2 pt-2">
        <div className="flex items-center gap-3">
          <input
            type="text"
            placeholder="Nota (opcional)..."
            value={nota}
            onChange={e => setNota(e.target.value)}
            className="border border-gray-300 rounded-md px-3 py-2 text-sm flex-1 max-w-md"
          />
          <button
            onClick={handleSave}
            disabled={saving}
            className="px-5 py-2 bg-green-600 text-white text-sm font-semibold rounded-md hover:bg-green-700 disabled:bg-gray-400 transition-colors"
          >
            {saving ? 'Guardando...' : 'Guardar versión'}
          </button>
          {saved && !saveError && (
            <span className="text-green-700 text-sm font-medium">¡Versión guardada en BD y localmente!</span>
          )}
        </div>

        {/* Progress bar while saving to DB */}
        {saveProgress && (
          <div className="max-w-md">
            <div className="flex justify-between text-xs text-gray-600 mb-1">
              <span>Guardando en base de datos...</span>
              <span>{saveProgress.done} / {saveProgress.total}</span>
            </div>
            <div className="w-full bg-gray-200 rounded-full h-2">
              <div
                className="bg-green-500 h-2 rounded-full transition-all"
                style={{ width: `${Math.round((saveProgress.done / saveProgress.total) * 100)}%` }}
              />
            </div>
          </div>
        )}

        {saveError && (
          <p className="text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded p-2 max-w-2xl">
            {saveError}
          </p>
        )}

        <p className="text-xs text-gray-500">
          Esta vista solo lista los sectores <strong>01, 02 y 03</strong> por centro (colchones, bases/cabecero, muebles fabricación).
          {readOnlyProduction
            ? ' La producción está en modo solo lectura: únicamente puede seleccionar los sábados.'
            : ' Los valores son la cantidad diaria promedio; al editar, el sistema redistribuye proporcionalmente a nivel de material.'}
          Use <strong>Sábado ON/OFF</strong> en la columna correspondiente cuando exista sábado en ese tramo de mes.
        </p>
      </div>
    </div>
  );
};
