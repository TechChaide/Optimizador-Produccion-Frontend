'use client';

import React, { useEffect, useMemo, useState } from 'react';
import { getWeekSegments } from '../../plan-semanal/components/weeklyCalendar';
import { MultiSelectDropdown } from './MultiSelectDropdown';

type RowInput = Record<string, unknown>;
type Segment = ReturnType<typeof getWeekSegments>[number];

type CodeNode = {
  codeKey: string;
  centro: string;
  sector: string;
  etiqueta: string;
  codigo: string;
  descripcion: string;
  monthDemand: Map<string, number>; // monthKey -> demanda mensual
};

const safeNum = (v: unknown) => {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
};

const monthKey = (anio: number, mes: number) => `${anio}-${String(mes).padStart(2, '0')}`;

/**
 * Reparte la demanda mensual en semanas L-V con peso = diasLaborales por segmento.
 * Usa mayor residuo (como el ledger IV4) para que la suma de semanas coincida exactamente
 * con Math.round(total); evita inflar totales mensuales vs. Excel/ledger por redondeos independientes.
 */
function distributeByBusinessDays(total: number, segs: Segment[]): Map<string, number> {
  const out = new Map<string, number>();
  if (!segs.length) return out;
  const totalInt = Math.round(total);
  const items = segs.map(seg => ({ seg, weight: Math.max(0, seg.diasLaborales) }));
  const totWeight = items.reduce((s, it) => s + it.weight, 0);
  if (totWeight <= 0) {
    for (const it of items) out.set(it.seg.weekKey, 0);
    return out;
  }
  if (totalInt === 0) {
    for (const it of items) out.set(it.seg.weekKey, 0);
    return out;
  }

  const tentative = items.map(it => {
    const exact = (totalInt * it.weight) / totWeight;
    const base = Math.floor(exact);
    return { ...it, base, frac: exact - base };
  });
  let assigned = tentative.reduce((s, it) => s + it.base, 0);
  let remainder = totalInt - assigned;

  const ordered = [...tentative].sort((a, b) => b.frac - a.frac);
  for (let i = 0; i < ordered.length && remainder > 0; i += 1) {
    ordered[i].base += 1;
    remainder -= 1;
  }
  for (let i = ordered.length - 1; i >= 0 && remainder < 0; i -= 1) {
    if (ordered[i].base > 0) {
      ordered[i].base -= 1;
      remainder += 1;
    }
  }

  for (const it of tentative) {
    out.set(it.seg.weekKey, it.base);
  }
  return out;
}

/** Misma clave que byCodeMonth: ajuste agregado por (centro, sector, etiqueta, material, año-mes). */
function rowMonthDemandKey(r: RowInput, yearFallback: string): string | null {
  const mes = Number(r.Mes ?? r.mes ?? 0);
  const anio = Number(r.Año ?? r.año ?? yearFallback ?? 0);
  if (!mes || !anio) return null;
  const centro = String(r.Centro ?? '').trim();
  const sector = String(r.Sector ?? 'SIN SECTOR').trim();
  const etiqueta = String(r.Etiqueta ?? r.Categoria ?? 'SIN ETIQUETA').trim();
  const codigo = String(r.CodMaterial ?? '').trim();
  if (!codigo) return null;
  return `${centro}|${sector}|${etiqueta}|${codigo}|${anio}|${String(mes).padStart(2, '0')}`;
}

/**
 * Reparte un entero entre varias filas según pesos (mayor residuo).
 * Si hay varias filas backend con la misma clave de ajuste (p. ej. distinta LineaFabricacion),
 * cada una debe llevar solo su parte para que SUM(UnidadesProyectado) = total del codeKey.
 */
function splitIntegerByWeights(totalInt: number, weights: number[]): number[] {
  const n = weights.length;
  if (n === 0) return [];
  const safeW = weights.map(w => Math.max(0, w));
  const tw = safeW.reduce((s, w) => s + w, 0);
  if (totalInt === 0) return weights.map(() => 0);
  if (tw <= 0) {
    const base = Math.floor(totalInt / n);
    let rem = totalInt - base * n;
    return weights.map((_, i) => base + (i < rem ? 1 : 0));
  }

  const tentative = safeW.map(w => {
    const exact = (totalInt * w) / tw;
    const base = Math.floor(exact);
    return { base, frac: exact - base };
  });
  let assigned = tentative.reduce((s, t) => s + t.base, 0);
  let remainder = totalInt - assigned;
  const ordered = tentative.map((t, i) => ({ ...t, i })).sort((a, b) => b.frac - a.frac);
  for (let k = 0; k < ordered.length && remainder > 0; k += 1) {
    tentative[ordered[k].i].base += 1;
    remainder -= 1;
  }
  for (let k = ordered.length - 1; k >= 0 && remainder < 0; k -= 1) {
    const idx = ordered[k].i;
    if (tentative[idx].base > 0) {
      tentative[idx].base -= 1;
      remainder += 1;
    }
  }
  return tentative.map(t => t.base);
}

interface Props {
  rawData: RowInput[];
  year: string;
  meses: string[];
  getMesNumero: (m: string) => number | null;
  onAdjustedDataChange?: (rows: RowInput[]) => void;
}

export const DemandWeeklyAdjustmentSection: React.FC<Props> = ({ rawData, year, meses, getMesNumero, onAdjustedDataChange }) => {
  const [sectorOverrides, setSectorOverrides] = useState<Map<string, Map<string, number>>>(new Map());
  const [etiquetaOverrides, setEtiquetaOverrides] = useState<Map<string, Map<string, number>>>(new Map());
  const [draftDailyInputs, setDraftDailyInputs] = useState<Map<string, string>>(new Map());
  const [selectedCentro, setSelectedCentro] = useState('');
  const [selectedSectors, setSelectedSectors] = useState<string[]>([]);
  const [selectedMonths, setSelectedMonths] = useState<string[]>([]);
  const [expandedCentros, setExpandedCentros] = useState<Set<string>>(new Set());
  const [expandedSectores, setExpandedSectores] = useState<Set<string>>(new Set());

  const segments = useMemo(() => {
    const y = Number(year);
    if (!y) return [] as Segment[];
    const mesesList = meses
      .map(m => ({ mes: getMesNumero(m) ?? Number(m), anio: y }))
      .filter(m => Number.isFinite(m.mes) && m.mes >= 1 && m.mes <= 12);
    return getWeekSegments(mesesList);
  }, [year, meses, getMesNumero]);

  const monthGroups = useMemo(() => {
    const groups = new Map<string, { key: string; label: string; segments: Segment[] }>();
    for (const seg of segments) {
      const mk = monthKey(seg.anio, seg.mes);
      if (!groups.has(mk)) {
        const label = new Date(seg.anio, seg.mes - 1, 1).toLocaleDateString('es-EC', { month: 'short', year: 'numeric' });
        groups.set(mk, { key: mk, label, segments: [] });
      }
      groups.get(mk)!.segments.push(seg);
    }
    return Array.from(groups.values());
  }, [segments]);

  const visibleMonthGroups = useMemo(() => {
    if (selectedMonths.length === 0) return monthGroups;
    const selected = new Set(selectedMonths);
    return monthGroups.filter(g => selected.has(g.key));
  }, [monthGroups, selectedMonths]);

  const baseline = useMemo(() => {
    const codes = new Map<string, CodeNode>();

    for (const r of rawData) {
      const mes = Number(r.Mes ?? r.mes ?? 0);
      const anio = Number(r.Año ?? r.año ?? year ?? 0);
      if (!mes || !anio) continue;
      const mk = monthKey(anio, mes);
      const centro = String(r.Centro ?? '').trim();
      const sector = String(r.Sector ?? 'SIN SECTOR').trim();
      const etiqueta = String(r.Etiqueta ?? r.Categoria ?? 'SIN ETIQUETA').trim();
      const codigo = String(r.CodMaterial ?? '').trim();
      if (!codigo) continue;
      const descripcion = String(r.Descripcion ?? r.descripcion ?? '');
      const dem = safeNum(r.UnidadesProyectado);

      const codeKey = `${centro}|${sector}|${etiqueta}|${codigo}`;
      if (!codes.has(codeKey)) {
        codes.set(codeKey, { codeKey, centro, sector, etiqueta, codigo, descripcion, monthDemand: new Map() });
      }
      const node = codes.get(codeKey)!;
      node.monthDemand.set(mk, (node.monthDemand.get(mk) || 0) + dem);
    }

    // baselineSem[codeKey][weekKey] = semanal
    const baselineSem = new Map<string, Map<string, number>>();
    for (const [codeKey, node] of codes.entries()) {
      const weekMap = new Map<string, number>();
      for (const [mk, demMes] of node.monthDemand.entries()) {
        const segs = monthGroups.find(g => g.key === mk)?.segments ?? [];
        const dist = distributeByBusinessDays(demMes, segs);
        for (const [wk, v] of dist.entries()) weekMap.set(wk, (weekMap.get(wk) || 0) + v);
      }
      baselineSem.set(codeKey, weekMap);
    }
    return { codes, baselineSem };
  }, [rawData, year, monthGroups]);

  const adjustedSem = useMemo(() => {
    // clone baseline
    const current = new Map<string, Map<string, number>>();
    for (const [ck, wm] of baseline.baselineSem.entries()) current.set(ck, new Map(wm));

    const allCodes = Array.from(baseline.codes.values());

    // Apply sector overrides first
    for (const [sKey, wMap] of sectorOverrides.entries()) {
      const [centro, sector] = sKey.split('|');
      const sectorCodes = allCodes.filter(c => c.centro === centro && c.sector === sector);
      if (sectorCodes.length === 0) continue;

      for (const [wk, newDaily] of wMap.entries()) {
        const seg = segments.find(s => s.weekKey === wk);
        if (!seg) continue;
        const targetSem = Math.round(newDaily * seg.diasLaborales);

        const etiquetas = Array.from(new Set(sectorCodes.map(c => c.etiqueta)));
        const baseSector = sectorCodes.reduce((s, c) => s + safeNum(baseline.baselineSem.get(c.codeKey)?.get(wk)), 0);
        const uniformEtiqueta = etiquetas.length > 0 ? targetSem / etiquetas.length : 0;

        for (const et of etiquetas) {
          const etCodes = sectorCodes.filter(c => c.etiqueta === et);
          const baseEt = etCodes.reduce((s, c) => s + safeNum(baseline.baselineSem.get(c.codeKey)?.get(wk)), 0);
          const targetEt = baseSector > 0 ? (targetSem * baseEt) / baseSector : uniformEtiqueta;

          const uniformCode = etCodes.length > 0 ? targetEt / etCodes.length : 0;
          for (const code of etCodes) {
            const baseCode = safeNum(baseline.baselineSem.get(code.codeKey)?.get(wk));
            const next = baseEt > 0 ? Math.round((targetEt * baseCode) / baseEt) : Math.round(uniformCode);
            current.get(code.codeKey)?.set(wk, next);
          }
        }
      }
    }

    // Apply etiqueta overrides after sector overrides
    for (const [eKey, wMap] of etiquetaOverrides.entries()) {
      const [centro, sector, etiqueta] = eKey.split('|');
      const etCodes = allCodes.filter(c => c.centro === centro && c.sector === sector && c.etiqueta === etiqueta);
      if (etCodes.length === 0) continue;

      for (const [wk, newDaily] of wMap.entries()) {
        const seg = segments.find(s => s.weekKey === wk);
        if (!seg) continue;
        const targetSem = Math.round(newDaily * seg.diasLaborales);
        const baseEt = etCodes.reduce((s, c) => s + safeNum(baseline.baselineSem.get(c.codeKey)?.get(wk)), 0);
        const uniformCode = etCodes.length > 0 ? targetSem / etCodes.length : 0;
        for (const code of etCodes) {
          const baseCode = safeNum(baseline.baselineSem.get(code.codeKey)?.get(wk));
          const next = baseEt > 0 ? Math.round((targetSem * baseCode) / baseEt) : Math.round(uniformCode);
          current.get(code.codeKey)?.set(wk, next);
        }
      }
    }
    return current;
  }, [baseline, sectorOverrides, etiquetaOverrides, segments]);

  const centers = useMemo(() => {
    return Array.from(new Set(Array.from(baseline.codes.values()).map(c => c.centro))).sort();
  }, [baseline]);

  const allBaselineSectors = useMemo(
    () => Array.from(new Set(Array.from(baseline.codes.values()).map(c => c.sector))).sort(),
    [baseline],
  );

  useEffect(() => {
    setSelectedSectors([...allBaselineSectors]);
  }, [allBaselineSectors]);

  const sectorOptions = useMemo(() => {
    const all = Array.from(baseline.codes.values());
    const filtered = selectedCentro ? all.filter(c => c.centro === selectedCentro) : all;
    return Array.from(new Set(filtered.map(c => c.sector))).sort();
  }, [baseline, selectedCentro]);

  /** Primera vista y cada nuevo baseline: centros abiertos para ver sectores; etiquetas ocultas hasta Expandir en el sector. */
  useEffect(() => {
    setExpandedCentros(new Set(centers));
    setExpandedSectores(new Set());
  }, [baseline, centers]);

  const filteredCodes = useMemo(() => {
    const all = Array.from(baseline.codes.values());
    const selectedS = new Set(selectedSectors);
    const selectedM = new Set(selectedMonths);
    return all.filter(c => {
      if (selectedCentro && c.centro !== selectedCentro) return false;
      if (selectedS.size > 0 && !selectedS.has(c.sector)) return false;
      if (selectedM.size > 0 && !Array.from(c.monthDemand.keys()).some(k => selectedM.has(k))) return false;
      return true;
    });
  }, [baseline, selectedCentro, selectedSectors, selectedMonths]);

  const weeklyAgg = useMemo(() => {
    const byEtiqueta = new Map<string, number>();
    const bySector = new Map<string, number>();
    const byCentro = new Map<string, number>();
    const byNational = new Map<string, number>();
    for (const c of filteredCodes) {
      const wm = adjustedSem.get(c.codeKey);
      if (!wm) continue;
      for (const [wk, v] of wm.entries()) {
        const eKey = `${c.centro}|${c.sector}|${c.etiqueta}|${wk}`;
        const sKey = `${c.centro}|${c.sector}|${wk}`;
        const cKey = `${c.centro}|${wk}`;
        byEtiqueta.set(eKey, (byEtiqueta.get(eKey) || 0) + v);
        bySector.set(sKey, (bySector.get(sKey) || 0) + v);
        byCentro.set(cKey, (byCentro.get(cKey) || 0) + v);
        byNational.set(wk, (byNational.get(wk) || 0) + v);
      }
    }
    return { byEtiqueta, bySector, byCentro, byNational };
  }, [filteredCodes, adjustedSem]);

  const adjustedRawRows = useMemo<RowInput[]>(() => {
    const byCodeMonth = new Map<string, number>();
    for (const code of filteredCodes) {
      for (const group of monthGroups) {
        const monthTotal = group.segments.reduce(
          (sum, seg) => sum + safeNum(adjustedSem.get(code.codeKey)?.get(seg.weekKey)),
          0,
        );
        const [anioStr, mesStr] = group.key.split('-');
        const k = `${code.centro}|${code.sector}|${code.etiqueta}|${code.codigo}|${anioStr}|${mesStr}`;
        byCodeMonth.set(k, monthTotal);
      }
    }

    const indicesByKey = new Map<string, number[]>();
    rawData.forEach((r, idx) => {
      const key = rowMonthDemandKey(r, year);
      if (!key || !byCodeMonth.has(key)) return;
      if (!indicesByKey.has(key)) indicesByKey.set(key, []);
      indicesByKey.get(key)!.push(idx);
    });

    const byIndex = new Map<number, number>();
    for (const [key, indices] of indicesByKey) {
      const mt = Math.round(byCodeMonth.get(key)!);
      const weights = indices.map(i => safeNum(rawData[i].UnidadesProyectado));
      const parts = splitIntegerByWeights(mt, weights);
      indices.forEach((i, j) => byIndex.set(i, parts[j] ?? 0));
    }

    return rawData.map((r, i) => {
      if (!byIndex.has(i)) return r;
      return { ...r, UnidadesProyectado: byIndex.get(i)! };
    });
  }, [adjustedSem, filteredCodes, monthGroups, rawData, year]);

  useEffect(() => {
    onAdjustedDataChange?.(adjustedRawRows);
  }, [adjustedRawRows, onAdjustedDataChange]);

  const rows = useMemo(() => {
    const centros = Array.from(new Set(filteredCodes.map(c => c.centro))).sort();
    const out: Array<{ kind: 'centro' | 'sector' | 'etiqueta' | 'centroTotal' | 'nacionalTotal'; key: string; centro?: string; sector?: string; etiqueta?: string }> = [];

    for (const centro of centros) {
      out.push({ kind: 'centro', key: `ctr-${centro}`, centro });
      if (!expandedCentros.has(centro)) {
        out.push({ kind: 'centroTotal', key: `tc-${centro}`, centro });
        continue;
      }
      const sectorKeys = Array.from(new Set(filteredCodes.filter(c => c.centro === centro).map(c => `${c.centro}|${c.sector}`))).sort();
      for (const sKey of sectorKeys) {
        const [, sector] = sKey.split('|');
        out.push({ kind: 'sector', key: `s-${sKey}`, centro, sector });
        if (!expandedSectores.has(sKey)) continue;

        const etiquetas = Array.from(new Set(filteredCodes.filter(c => c.centro === centro && c.sector === sector).map(c => c.etiqueta))).sort();
        for (const et of etiquetas) {
          out.push({ kind: 'etiqueta', key: `e-${centro}|${sector}|${et}`, centro, sector, etiqueta: et });
        }
      }
      out.push({ kind: 'centroTotal', key: `tc-${centro}`, centro });
    }
    out.push({ kind: 'nacionalTotal', key: 'tn' });
    return out;
  }, [filteredCodes, expandedCentros, expandedSectores]);

  const getWeeklySem = (row: (typeof rows)[number], wk: string) => {
    if (row.kind === 'etiqueta') {
      return safeNum(weeklyAgg.byEtiqueta.get(`${row.centro}|${row.sector}|${row.etiqueta}|${wk}`));
    }
    if (row.kind === 'sector') {
      return safeNum(weeklyAgg.bySector.get(`${row.centro}|${row.sector}|${wk}`));
    }
    if (row.kind === 'centro') {
      return safeNum(weeklyAgg.byCentro.get(`${row.centro}|${wk}`));
    }
    if (row.kind === 'centroTotal') {
      return safeNum(weeklyAgg.byCentro.get(`${row.centro}|${wk}`));
    }
    return safeNum(weeklyAgg.byNational.get(wk));
  };

  const commitDailyEdit = (row: (typeof rows)[number], wk: string, raw: string) => {
    const v = Number(raw);
    if (!Number.isFinite(v)) return;
    if (row.kind === 'sector') {
      const sk = `${row.centro}|${row.sector}`;
      setSectorOverrides(prev => {
        const next = new Map(prev);
        const wm = new Map(next.get(sk) ?? new Map());
        wm.set(wk, v);
        next.set(sk, wm);
        return next;
      });
      return;
    }
    if (row.kind === 'etiqueta') {
      const ek = `${row.centro}|${row.sector}|${row.etiqueta}`;
      setEtiquetaOverrides(prev => {
        const next = new Map(prev);
        const wm = new Map(next.get(ek) ?? new Map());
        wm.set(wk, v);
        next.set(ek, wm);
        return next;
      });
    }
  };

  const setDraftValue = (cellKey: string, value: string) => {
    setDraftDailyInputs(prev => {
      const next = new Map(prev);
      next.set(cellKey, value);
      return next;
    });
  };

  const clearDraftValue = (cellKey: string) => {
    setDraftDailyInputs(prev => {
      const next = new Map(prev);
      next.delete(cellKey);
      return next;
    });
  };

  if (rawData.length === 0) {
    return <div className="p-8 text-center text-gray-500">Sin datos consolidados de ventas para ajustar.</div>;
  }

  const toggleCenter = (centro: string) => {
    setExpandedCentros(prev => {
      const next = new Set(prev);
      if (next.has(centro)) next.delete(centro);
      else next.add(centro);
      return next;
    });
  };

  const toggleSector = (centro: string, sector: string) => {
    const key = `${centro}|${sector}`;
    setExpandedSectores(prev => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  };

  const exportDetailExcel = async () => {
    const XLSX = await import('xlsx');
    const rowsDetail: Array<Record<string, string | number>> = [];
    for (const c of filteredCodes) {
      for (const g of visibleMonthGroups) {
        const monthTotal = g.segments.reduce((s, seg) => s + safeNum(adjustedSem.get(c.codeKey)?.get(seg.weekKey)), 0);
        for (const seg of g.segments) {
          const sem = safeNum(adjustedSem.get(c.codeKey)?.get(seg.weekKey));
          const daily = seg.diasLaborales > 0 ? Math.round(sem / seg.diasLaborales) : 0;
          rowsDetail.push({
            Centro: c.centro,
            Sector: c.sector,
            Etiqueta: c.etiqueta,
            CodigoMaterial: c.codigo,
            Descripcion: c.descripcion,
            Mes: g.label,
            Semana: seg.label,
            DiasLaborales: seg.diasLaborales,
            PromedioDiario: daily,
            TotalSemanal: sem,
            TotalMesCodigo: monthTotal,
          });
        }
      }
    }
    const wb = XLSX.utils.book_new();
    const ws = XLSX.utils.json_to_sheet(rowsDetail);
    XLSX.utils.book_append_sheet(wb, ws, 'Detalle Ajustado');
    XLSX.writeFile(wb, `AjustePresupuestoDetalle_${year || 'sin-anio'}.xlsx`);
  };

  return (
    <div className="bg-white rounded-lg border border-gray-200 p-4 space-y-3">
      <h3 className="text-sm font-semibold text-gray-800">Ajuste de Presupuesto de Ventas (L-V)</h3>
      <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
        <div>
          <label className="block text-xs font-semibold text-gray-600 mb-1">Centro</label>
          <select
            value={selectedCentro}
            onChange={e => {
              setSelectedCentro(e.target.value);
              setSelectedSectors([]);
            }}
            className="w-full border border-gray-300 rounded-md px-2 py-1.5 text-xs bg-white"
          >
            <option value="">Todos</option>
            {centers.map(c => <option key={c} value={c}>{c}</option>)}
          </select>
        </div>
        <div className="[&>div>label]:text-xs [&>div>label]:font-semibold [&>div>label]:text-gray-600 [&>div>label]:mb-1 [&>div>button]:py-1.5 [&>div>button]:text-xs [&>div>.mt-2]:max-h-14 [&>div>.mt-2]:overflow-auto">
          <MultiSelectDropdown
            label="Sectores"
            options={sectorOptions.map(s => ({ value: s, label: s }))}
            selected={selectedSectors}
            onChange={setSelectedSectors}
          />
          <div className="mt-1 flex gap-2">
            <button
              type="button"
              onClick={() => setSelectedSectors(sectorOptions)}
              className="text-[10px] text-blue-700 hover:underline"
            >
              Seleccionar todos
            </button>
            <button
              type="button"
              onClick={() => setSelectedSectors([])}
              className="text-[10px] text-gray-600 hover:underline"
            >
              Limpiar
            </button>
          </div>
        </div>
        <div className="[&>div>label]:text-xs [&>div>label]:font-semibold [&>div>label]:text-gray-600 [&>div>label]:mb-1 [&>div>button]:py-1.5 [&>div>button]:text-xs [&>div>.mt-2]:max-h-14 [&>div>.mt-2]:overflow-auto">
          <MultiSelectDropdown
            label="Meses"
            options={monthGroups.map(m => ({ value: m.key, label: m.label }))}
            selected={selectedMonths}
            onChange={setSelectedMonths}
          />
          <div className="mt-1 flex gap-2">
            <button
              type="button"
              onClick={() => setSelectedMonths(monthGroups.map(m => m.key))}
              className="text-[10px] text-blue-700 hover:underline"
            >
              Seleccionar todos
            </button>
            <button
              type="button"
              onClick={() => setSelectedMonths([])}
              className="text-[10px] text-gray-600 hover:underline"
            >
              Limpiar
            </button>
          </div>
        </div>
        <div className="flex items-end">
          <button
            type="button"
            onClick={exportDetailExcel}
            className="w-full bg-green-600 text-white text-xs font-semibold px-3 py-2 rounded hover:bg-green-700"
          >
            Exportar detalle ajustado (Excel)
          </button>
        </div>
      </div>
      <div className="overflow-x-auto border border-gray-200 rounded-lg">
        <table className="text-[10px] w-full border-collapse">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-2 py-2 text-left border-b border-r border-gray-200 min-w-[120px]">Nivel</th>
              <th className="px-2 py-2 text-left border-b border-r border-gray-200 min-w-[120px]">Clave</th>
              {visibleMonthGroups.flatMap(g => [
                ...g.segments.map(seg => (
                  <th key={`${g.key}-${seg.weekKey}`} className="px-2 py-2 text-center border-b border-r border-gray-200 min-w-[96px]">
                    <div className="font-bold">{seg.label}</div>
                    <div className="text-[9px] text-gray-500">{seg.diasLaborales} L-V</div>
                  </th>
                )),
                <th key={`tm-${g.key}`} className="px-2 py-2 text-center border-b border-r border-blue-200 bg-blue-50 min-w-[96px]">
                  Total {g.label}
                </th>,
              ])}
            </tr>
          </thead>
          <tbody>
            {rows.map(row => (
              <tr key={row.key} className={row.kind.includes('Total') ? 'bg-indigo-50 font-semibold' : 'bg-gray-50'}>
                <td className="px-2 py-1 border-r border-gray-200">
                  {row.kind === 'centro' ? 'Centro' : row.kind === 'sector' ? 'Sector' : row.kind === 'etiqueta' ? 'Etiqueta' : row.kind === 'centroTotal' ? 'Total Centro' : 'Total Nacional'}
                </td>
                <td className="px-2 py-1 border-r border-gray-200">
                  {row.kind === 'centro' && (
                    <button type="button" onClick={() => toggleCenter(row.centro!)} className="font-semibold text-blue-700 hover:underline">
                      {expandedCentros.has(row.centro!) ? '▼' : '▶'} {row.centro}
                    </button>
                  )}
                  {row.kind === 'sector' && `${row.centro} · ${row.sector}`}
                  {row.kind === 'sector' && (
                    <button type="button" onClick={() => toggleSector(row.centro!, row.sector!)} className="ml-2 text-[9px] text-blue-700 hover:underline">
                      {expandedSectores.has(`${row.centro}|${row.sector}`) ? 'Contraer' : 'Expandir'}
                    </button>
                  )}
                  {row.kind === 'etiqueta' && `${row.centro} · ${row.sector} · ${row.etiqueta}`}
                  {row.kind === 'centroTotal' && row.centro}
                  {row.kind === 'nacionalTotal' && 'Nacional'}
                </td>
                {visibleMonthGroups.flatMap(g => {
                  const weekCells = g.segments.map(seg => {
                    const sem = getWeeklySem(row, seg.weekKey);
                    const daily = seg.diasLaborales > 0 ? Math.round(sem / seg.diasLaborales) : 0;
                    const editable = row.kind === 'sector' || row.kind === 'etiqueta';
                    const cellKey = `${row.key}|${seg.weekKey}`;
                    const draft = draftDailyInputs.get(cellKey);
                    return (
                      <td key={`${row.key}-${seg.weekKey}`} className="px-1 py-1 border-r border-gray-100">
                        {editable ? (
                          <div className="flex flex-col items-center">
                            <input
                              type="number"
                              min={0}
                              value={draft ?? String(daily)}
                              onChange={e => setDraftValue(cellKey, e.target.value)}
                              onBlur={e => {
                                if (e.target.value.trim() !== '') commitDailyEdit(row, seg.weekKey, e.target.value);
                                clearDraftValue(cellKey);
                              }}
                              onKeyDown={e => {
                                if (e.key === 'Enter') {
                                  const target = e.currentTarget;
                                  if (target.value.trim() !== '') commitDailyEdit(row, seg.weekKey, target.value);
                                  clearDraftValue(cellKey);
                                  target.blur();
                                } else if (e.key === 'Escape') {
                                  clearDraftValue(cellKey);
                                  e.currentTarget.blur();
                                }
                              }}
                              className="w-full text-right text-[10px] border border-gray-200 rounded px-1 py-0.5"
                            />
                          </div>
                        ) : (
                          <div className="text-right">
                            <div>{daily.toLocaleString()}</div>
                          </div>
                        )}
                      </td>
                    );
                  });
                  const monthTotal = g.segments.reduce((s, seg) => s + getWeeklySem(row, seg.weekKey), 0);
                  return [...weekCells, <td key={`${row.key}-mt-${g.key}`} className="px-1 py-1 text-right border-r border-blue-100 bg-blue-50/40">{monthTotal.toLocaleString()}</td>];
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};

