'use client';

import React, { useMemo, useState, useCallback, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { MultiSelectDropdown } from './MultiSelectDropdown';
import { exportToXLSXMultiSheet, safeNumber } from './utils';
import type { WeekSegment } from '../../plan-semanal/components/types';
import type { TiempoCanonResult } from './types';

interface Props {
  dataC1000: any[];
  dataC2000: any[];
  weekSegments: WeekSegment[];
  activeSatKeysByCenter: Record<string, Set<string>>;
  maxExtrasHoras: number;
  horasTrabajo: number;
  horasExtrasFin: number;
  tiemposCanonC1000: TiempoCanonResult[];
  tiemposCanonC2000: TiempoCanonResult[];
  /** Si existe, el panel "Diagnóstico de capacidad" se renderiza al final del flujo IV3 (portal). */
  diagnosticPortalTarget?: HTMLElement | null;
}

type WeeklyMetricMap = Record<string, number>;

type MonthlyAggregateRow = {
  key: string;
  centro: string;
  anio: number;
  mesNumero: number;
  mesNombre: string;
  saldoInicial: number;
  produccion: number;
  despachos: number;
  traslados: number;
  /** Suma `_demandaVenta`: demanda planificada del mes (igual al Ajuste de presupuesto L-V). */
  demandaVenta: number;
  /** Suma `_backlogFinalVentas`: cuadra con Despachos vs demanda L-V. */
  backlogVentas: number;
  /** Suma `_backlogFinalTraslado` (C1000 intercentro). */
  backlogTraslado: number;
  saldoFinal: number;
  weeks: {
    saldoInicial: WeeklyMetricMap;
    produccion: WeeklyMetricMap;
    despachos: WeeklyMetricMap;
    traslados: WeeklyMetricMap;
    saldoFinal: WeeklyMetricMap;
  };
};

type WeeklyDetailRow = {
  centro: string;
  anio: number;
  mesNumero: number;
  mesNombre: string;
  semana: string;
  semanaKey: string;
  codigoMaterial: string;
  sector: string;
  linea: string;
  saldoInicial: number;
  produccion: number;
  despachos: number;
  traslados: number;
  saldoFinal: number;
  /** Demanda de ventas del mes (`_demandaVenta`); mismo valor en cada fila semanal del material. */
  demandaVenta: number;
  /** Backlog ventas al cierre del mes (mismo valor en cada fila semanal del material). */
  backlogFinalMes: number;
  /** Backlog traslado intercentro (C1000); 0 en C2000. */
  backlogTrasladoMes: number;
};

function formatNum(n: number): string {
  return n.toLocaleString(undefined, { maximumFractionDigits: 0 });
}

function formatPct(n: number): string {
  return `${n.toLocaleString(undefined, { maximumFractionDigits: 1, minimumFractionDigits: 1 })}%`;
}

type DiagnosticLineRow = {
  key: string;
  centro: string;
  anio: number;
  mesNumero: number;
  mesNombre: string;
  linea: string;
  capJN: number;
  capHE: number;
  capSab: number;
  capTotal: number;
  minBase: number;
  minAdelanto: number;
  minRecuperado: number;
  minPIO: number;
  minUsados: number;
  minFromViable: number;
  deltaVsViable: number;
  idleFinal: number;
  pctUso: number;
  nMateriales: number;
  nMaterialesTuppCero: number;
  lineaResolvida: boolean;
  /** Suma de déficits en unidades (motor de cuellos), agregada por material en la línea-mes. */
  defJN: number;
  defHE: number;
  defSAB: number;
  maxJNUnidades: number;
  maxHEUnidades: number;
  maxSabUnidades: number;
  minJNAsign: number;
  minHEAsign: number;
  minSabAsign: number;
  pctUsoPoolSab: number;
};

function mergeWeights(items: { key: string; w: number }[]): { key: string; w: number }[] {
  const m = new Map<string, number>();
  for (const it of items) {
    if (it.w <= 0) continue;
    m.set(it.key, (m.get(it.key) || 0) + it.w);
  }
  return Array.from(m.entries()).map(([key, w]) => ({ key, w }));
}

function allocateIntegerProportional(total: number, items: { key: string; w: number }[]): WeeklyMetricMap {
  const out: WeeklyMetricMap = {};
  const merged = mergeWeights(items);
  const T = Math.round(total);
  if (T === 0) return out;
  if (!merged.length) return out;

  const tw = merged.reduce((s, x) => s + x.w, 0);
  if (tw <= 0) {
    out[merged[0].key] = T;
    return out;
  }

  const raw = merged.map(r => {
    const exact = (T * r.w) / tw;
    const base = Math.floor(exact);
    return { ...r, base, frac: exact - base };
  });
  let remaining = T - raw.reduce((s, x) => s + x.base, 0);
  raw.sort((a, b) => b.frac - a.frac);
  for (let i = 0; i < raw.length && remaining > 0; i += 1) {
    raw[i].base += 1;
    remaining -= 1;
  }
  raw.forEach(r => {
    out[r.key] = r.base;
  });
  return out;
}

function getTcForMonth(list: TiempoCanonResult[] | undefined, mesNumero: number): TiempoCanonResult | null {
  if (!list?.length) return null;
  return list.find(tc => tc.mesNumero === mesNumero) ?? null;
}

function canonListForCentro(
  centro: string,
  tiemposCanonC1000: TiempoCanonResult[],
  tiemposCanonC2000: TiempoCanonResult[],
): TiempoCanonResult[] {
  return String(centro).trim() === '1000' ? tiemposCanonC1000 : tiemposCanonC2000;
}

/** Mismo criterio de match línea ↔ tiempos canónicos que `backlogRegressiveCompute` / `BottleneckClassTable`. */
function findCanonDpForLine(tc: TiempoCanonResult | null, linea: string): any | null {
  if (!tc?.data || !Array.isArray(tc.data)) return null;
  const lineaNorm = String(linea).toLowerCase().replace(/\s+/g, '');
  const registros = tc.data.filter((item: any) => {
    const nl = String(item?.nombre_linea ?? '')
      .toLowerCase()
      .replace(/\s+/g, '');
    return nl === lineaNorm || nl.includes(lineaNorm) || lineaNorm.includes(nl);
  });
  return registros[0] ?? null;
}

/** Despachos / traslados: proporcional solo a días laborables por semana. */
function splitByLaborDaysOnly(total: number, monthSegments: WeekSegment[]): WeeklyMetricMap {
  if (!monthSegments.length) return {};
  return allocateIntegerProportional(total, monthSegments.map(s => ({ key: s.weekKey, w: s.diasLaborales })));
}

/**
 * Producción mensual del motor: parte laboral y parte sábado según pesos de tiempo canónico;
 * labor por días laborables de cada semana; sábado repartido en semanas con sábado elegido por el usuario.
 */
function splitProductionLaborAndSaturday(
  total: number,
  monthSegments: WeekSegment[],
  activeSatKeys: Set<string>,
  tc: TiempoCanonResult | null,
  horasTrabajo: number,
  horasExtrasFin: number,
): WeeklyMetricMap {
  if (!monthSegments.length) return {};

  const T = Math.round(total);
  if (T === 0) return {};

  const sumLab = monthSegments.reduce((s, g) => s + g.diasLaborales, 0);
  const ht = Math.max(horasTrabajo || 0, 1e-9);
  const hef = Math.max(horasExtrasFin || 0, 1e-9);

  const D_L = tc && tc.diasLaborables > 0 ? tc.diasLaborables : sumLab;
  const D_S = tc ? Math.max(0, tc.diasSabados) : 0;

  const T_L = D_L * ht;
  const T_S = D_S * hef;
  const denom = T_L + T_S;

  let P_L = T;
  let P_S = 0;
  if (denom > 0 && D_S > 0) {
    P_L = Math.floor(T * (T_L / denom));
    P_S = T - P_L;
  }

  const labAlloc = allocateIntegerProportional(P_L, monthSegments.map(s => ({ key: s.weekKey, w: s.diasLaborales })));

  const selected = monthSegments.filter(s => s.tieneSabado && activeSatKeys.has(s.satKey));
  let satAlloc: WeeklyMetricMap = {};
  if (P_S > 0) {
    if (selected.length > 0) {
      satAlloc = allocateIntegerProportional(P_S, selected.map(s => ({ key: s.weekKey, w: 1 })));
    } else {
      satAlloc = allocateIntegerProportional(P_S, monthSegments.map(s => ({ key: s.weekKey, w: s.diasLaborales })));
    }
  }

  const keys = new Set([...Object.keys(labAlloc), ...Object.keys(satAlloc)]);
  const out: WeeklyMetricMap = {};
  keys.forEach(k => {
    out[k] = (labAlloc[k] || 0) + (satAlloc[k] || 0);
  });
  return out;
}

function accumulateMap(target: WeeklyMetricMap, source: WeeklyMetricMap): void {
  Object.entries(source).forEach(([weekKey, value]) => {
    target[weekKey] = (target[weekKey] || 0) + value;
  });
}

export const BacklogRegressiveTotalsReportV3: React.FC<Props> = ({
  dataC1000,
  dataC2000,
  weekSegments,
  activeSatKeysByCenter,
  maxExtrasHoras,
  horasTrabajo,
  horasExtrasFin,
  tiemposCanonC1000,
  tiemposCanonC2000,
  diagnosticPortalTarget = null,
}) => {
  const [anios, setAnios] = useState<string[]>([]);
  const [meses, setMeses] = useState<string[]>([]);
  const [sectores, setSectores] = useState<string[]>([]);
  const [lineas, setLineas] = useState<string[]>([]);
  const [viewMode, setViewMode] = useState<'mensual' | 'semanal'>('mensual');
  const [expandedMonths, setExpandedMonths] = useState<Set<string>>(new Set());
  const [monthlyPage, setMonthlyPage] = useState(1);
  const [monthlyPageSize, setMonthlyPageSize] = useState(20);
  const [diagnosticPage, setDiagnosticPage] = useState(1);
  const [diagnosticPageSize] = useState(25);
  const [showBottleneckCross, setShowBottleneckCross] = useState(false);

  const rowsC1000 = dataC1000;
  const rowsC2000 = dataC2000;

  const allRows = useMemo(() => [...rowsC1000, ...rowsC2000], [rowsC1000, rowsC2000]);

  const aniosOpciones = useMemo(() => {
    const set = new Set<string>();
    allRows.forEach(r => {
      const y = String(safeNumber(r._anioFila ?? r.Año ?? r.año));
      if (y !== '0') set.add(y);
    });
    return Array.from(set).sort((a, b) => Number(b) - Number(a)).map(v => ({ value: v, label: v }));
  }, [allRows]);

  const mesesOpciones = useMemo(() => {
    const set = new Set<string>();
    allRows.forEach(r => {
      const m = String(r.mesNombre || '');
      if (m) set.add(m);
    });
    return Array.from(set).sort().map(v => ({ value: v, label: v }));
  }, [allRows]);

  const sectoresOpciones = useMemo(() => {
    const set = new Set<string>();
    allRows.forEach(r => {
      const s = String(r.Sector || '').trim();
      if (s) set.add(s);
    });
    return Array.from(set).sort().map(v => ({ value: v, label: v }));
  }, [allRows]);

  const lineasOpciones = useMemo(() => {
    const set = new Set<string>();
    allRows.forEach(r => set.add(String(r.lineaRef || r.LineaFabricacion || 'Sin línea')));
    return Array.from(set).sort().map(v => ({ value: v, label: v }));
  }, [allRows]);

  const applyFilters = useCallback((rows: any[]) => {
    return rows.filter(r => {
      const y = String(safeNumber(r._anioFila ?? r.Año ?? r.año));
      const m = String(r.mesNombre || '');
      const s = String(r.Sector || '');
      const l = String(r.lineaRef || r.LineaFabricacion || 'Sin línea');
      if (anios.length > 0 && !anios.includes(y)) return false;
      if (meses.length > 0 && !meses.includes(m)) return false;
      if (sectores.length > 0 && !sectores.includes(s)) return false;
      if (lineas.length > 0 && !lineas.includes(l)) return false;
      return true;
    });
  }, [anios, meses, sectores, lineas]);

  const filteredC1000 = useMemo(() => applyFilters(rowsC1000), [rowsC1000, applyFilters]);
  const filteredC2000 = useMemo(() => applyFilters(rowsC2000), [rowsC2000, applyFilters]);

  const monthlyRows = useMemo(() => {
    const map = new Map<string, MonthlyAggregateRow>();
    const allFiltered = [...filteredC1000, ...filteredC2000];

    allFiltered.forEach((row: any) => {
      const anio = safeNumber(row._anioFila ?? row.Año ?? row.año);
      const mesNumero = safeNumber(row._mesNumero);
      if (!anio || !mesNumero) return;

      const centro = String(row.Centro || row.centro || '');
      const mesNombre = String(row.mesNombre || mesNumero);
      const key = `${centro}|${anio}|${mesNumero}`;

      if (!map.has(key)) {
        map.set(key, {
          key,
          centro,
          anio,
          mesNumero,
          mesNombre,
          saldoInicial: 0,
          produccion: 0,
          despachos: 0,
          traslados: 0,
          demandaVenta: 0,
          backlogVentas: 0,
          backlogTraslado: 0,
          saldoFinal: 0,
          weeks: {
            saldoInicial: {},
            produccion: {},
            despachos: {},
            traslados: {},
            saldoFinal: {},
          },
        });
      }

      const monthSegs = weekSegments.filter(seg => seg.anio === anio && seg.mes === mesNumero);
      if (!monthSegs.length) return;
      const centerSatKeys = activeSatKeysByCenter[centro] ?? new Set<string>();
      const tc = getTcForMonth(canonListForCentro(centro, tiemposCanonC1000, tiemposCanonC2000), mesNumero);

      const current = map.get(key)!;
      const saldoInicial = safeNumber(row._stockInitial);
      const produccion = safeNumber(row._prodViableTotal);
      // La demanda semanal debe venir del presupuesto de ventas distribuido a semanas.
      const despachos = safeNumber(row._despachosVentas ?? row._despachosReales);
      // Centro 1000 envia (resta), centro 2000 recibe (suma).
      const trasladosBrutos = centro === '1000'
        ? safeNumber(row._despachosTraslado ?? row._trasladoSalienteC2000)
        : safeNumber(row._trasladoEntranteDesdeC1000);
      const traslados = centro === '1000' ? -Math.abs(trasladosBrutos) : Math.abs(trasladosBrutos);

      current.saldoInicial += saldoInicial;
      current.produccion += produccion;
      current.despachos += despachos;
      current.traslados += traslados;
      current.demandaVenta += safeNumber(row._demandaVenta);
      current.backlogVentas += safeNumber(row._backlogFinalVentas ?? row._backlogFinal);
      current.backlogTraslado += safeNumber(row._backlogFinalTraslado);

      accumulateMap(
        current.weeks.produccion,
        splitProductionLaborAndSaturday(produccion, monthSegs, centerSatKeys, tc, horasTrabajo, horasExtrasFin),
      );
      accumulateMap(current.weeks.despachos, splitByLaborDaysOnly(despachos, monthSegs));
      accumulateMap(current.weeks.traslados, splitByLaborDaysOnly(traslados, monthSegs));
    });

    const rows = Array.from(map.values());

    // Saldo encadenado por semana:
    // saldoInicial(semana_1) = saldoInicial mensual
    // saldoFinal(semana_n) = saldoInicial(semana_n) + produccion + traslados - despachos
    // saldoInicial(semana_n+1) = saldoFinal(semana_n)
    rows.forEach(row => {
      const monthWeeks = weekSegments
        .filter(seg => seg.anio === row.anio && seg.mes === row.mesNumero)
        .sort((a, b) => a.isoYear - b.isoYear || a.isoWeek - b.isoWeek);

      let running = row.saldoInicial;
      monthWeeks.forEach(week => {
        const wk = week.weekKey;
        const prod = safeNumber(row.weeks.produccion[wk] || 0);
        const desp = safeNumber(row.weeks.despachos[wk] || 0);
        const tras = safeNumber(row.weeks.traslados[wk] || 0);

        row.weeks.saldoInicial[wk] = running;
        running = running + prod + tras - desp;
        row.weeks.saldoFinal[wk] = running;
      });

      // El saldo final mensual es el saldo final de la ultima semana del mes.
      row.saldoFinal = running;
    });

    return rows.sort((a, b) => {
      if (a.anio !== b.anio) return a.anio - b.anio;
      if (a.mesNumero !== b.mesNumero) return a.mesNumero - b.mesNumero;
      return a.centro.localeCompare(b.centro);
    });
  }, [
    filteredC1000,
    filteredC2000,
    weekSegments,
    activeSatKeysByCenter,
    horasTrabajo,
    horasExtrasFin,
    tiemposCanonC1000,
    tiemposCanonC2000,
  ]);

  const weeklyDetailRows = useMemo<WeeklyDetailRow[]>(() => {
    const out: WeeklyDetailRow[] = [];
    const allFiltered = [...filteredC1000, ...filteredC2000];

    allFiltered.forEach((row: any) => {
      const anio = safeNumber(row._anioFila ?? row.Año ?? row.año);
      const mesNumero = safeNumber(row._mesNumero);
      if (!anio || !mesNumero) return;

      const centro = String(row.Centro || row.centro || '');
      const mesNombre = String(row.mesNombre || mesNumero);
      const codigoMaterial = String(row.CodMaterial || '');
      const sector = String(row.Sector || '');
      const linea = String(row.lineaRef || row.LineaFabricacion || 'Sin línea');
      const centerSatKeys = activeSatKeysByCenter[centro] ?? new Set<string>();
      const tc = getTcForMonth(canonListForCentro(centro, tiemposCanonC1000, tiemposCanonC2000), mesNumero);

      const monthWeeks = weekSegments
        .filter(seg => seg.anio === anio && seg.mes === mesNumero)
        .sort((a, b) => a.isoYear - b.isoYear || a.isoWeek - b.isoWeek);
      if (!monthWeeks.length) return;

      const saldoInicialMes = safeNumber(row._stockInitial);
      const produccionMes = safeNumber(row._prodViableTotal);
      const despachosMes = safeNumber(row._despachosVentas ?? row._despachosReales);
      const trasladosBrutos = centro === '1000'
        ? safeNumber(row._despachosTraslado ?? row._trasladoSalienteC2000)
        : safeNumber(row._trasladoEntranteDesdeC1000);
      const trasladosMes = centro === '1000' ? -Math.abs(trasladosBrutos) : Math.abs(trasladosBrutos);
      const demandaVenta = safeNumber(row._demandaVenta);
      const backlogFinalMes = safeNumber(row._backlogFinalVentas ?? row._backlogFinal);
      const backlogTrasladoMes = safeNumber(row._backlogFinalTraslado);

      const weekProd = splitProductionLaborAndSaturday(
        produccionMes,
        monthWeeks,
        centerSatKeys,
        tc,
        horasTrabajo,
        horasExtrasFin,
      );
      const weekDesp = splitByLaborDaysOnly(despachosMes, monthWeeks);
      const weekTras = splitByLaborDaysOnly(trasladosMes, monthWeeks);

      let running = saldoInicialMes;
      monthWeeks.forEach(week => {
        const wk = week.weekKey;
        const prod = safeNumber(weekProd[wk] || 0);
        const desp = safeNumber(weekDesp[wk] || 0);
        const tras = safeNumber(weekTras[wk] || 0);
        const saldoInicial = running;
        const saldoFinal = saldoInicial + prod + tras - desp;
        running = saldoFinal;

        out.push({
          centro,
          anio,
          mesNumero,
          mesNombre,
          semana: week.label,
          semanaKey: wk,
          codigoMaterial,
          sector,
          linea,
          saldoInicial,
          produccion: prod,
          despachos: desp,
          traslados: tras,
          saldoFinal,
          demandaVenta,
          backlogFinalMes,
          backlogTrasladoMes,
        });
      });
    });

    return out;
  }, [
    filteredC1000,
    filteredC2000,
    weekSegments,
    activeSatKeysByCenter,
    horasTrabajo,
    horasExtrasFin,
    tiemposCanonC1000,
    tiemposCanonC2000,
  ]);

  const monthlySummary = useMemo(() => {
    const map = new Map<string, { centro: string; mes: string; backlogVentas: number; backlogTraslado: number }>();
    monthlyRows.forEach(r => {
      const key = `${r.centro}|${r.anio}|${r.mesNumero}`;
      const prev = map.get(key) || {
        centro: r.centro,
        mes: `${r.anio}-${String(r.mesNumero).padStart(2, '0')}`,
        backlogVentas: 0,
        backlogTraslado: 0,
      };
      prev.backlogVentas += safeNumber(r.backlogVentas);
      prev.backlogTraslado += safeNumber(r.backlogTraslado);
      map.set(key, prev);
    });
    return Array.from(map.values()).sort((a, b) => a.mes.localeCompare(b.mes) || a.centro.localeCompare(b.centro));
  }, [monthlyRows]);

  const diagnosticRows = useMemo((): DiagnosticLineRow[] => {
    const map = new Map<string, DiagnosticLineRow>();
    const allFiltered = [...filteredC1000, ...filteredC2000];

    allFiltered.forEach((row: any) => {
      const anio = safeNumber(row._anioFila ?? row.Año ?? row.año);
      const mesNumero = safeNumber(row._mesNumero);
      if (!anio || !mesNumero) return;

      const centro = String(row.Centro || row.centro || '').trim();
      const linea = String(row.lineaRef || row.LineaFabricacion || 'Sin línea');
      const mesNombre = String(row.mesNombre || mesNumero);
      const key = `${centro}|${anio}|${mesNumero}|${linea}`;

      const tc = getTcForMonth(canonListForCentro(centro, tiemposCanonC1000, tiemposCanonC2000), mesNumero);
      const dp = findCanonDpForLine(tc, linea);
      const capJN = safeNumber(dp?.minutos_horario_normal_TOTAL ?? 0);
      const capHE = tc ? safeNumber(tc.diasLaborables) * Math.max(0, safeNumber(maxExtrasHoras)) * 60 : 0;
      const capSab = tc ? safeNumber(tc.diasSabados) * Math.max(0, safeNumber(horasExtrasFin)) * 60 : 0;
      const capTotal = capJN + capHE + capSab;
      const lineaResolvida = dp != null;

      if (!map.has(key)) {
        map.set(key, {
          key,
          centro,
          anio,
          mesNumero,
          mesNombre,
          linea,
          capJN,
          capHE,
          capSab,
          capTotal,
          minBase: 0,
          minAdelanto: 0,
          minRecuperado: 0,
          minPIO: 0,
          minUsados: 0,
          minFromViable: 0,
          deltaVsViable: 0,
          idleFinal: 0,
          pctUso: 0,
          nMateriales: 0,
          nMaterialesTuppCero: 0,
          lineaResolvida,
          defJN: 0,
          defHE: 0,
          defSAB: 0,
          maxJNUnidades: 0,
          maxHEUnidades: 0,
          maxSabUnidades: 0,
          minJNAsign: 0,
          minHEAsign: 0,
          minSabAsign: 0,
          pctUsoPoolSab: 0,
        });
      }

      const agg = map.get(key)!;
      const tupp = safeNumber(row.tiempoUnitarioPorPuesto ?? row._tupp);
      const pb = safeNumber(row._prodBase);
      const pa = safeNumber(row._prodAdelantada);
      const pr = safeNumber(row._prodRecuperada);
      const pp = safeNumber(row._prodObjetivoInventario);
      const pv = safeNumber(row._prodViableTotal);

      const maxJN = safeNumber(row.necesidadMaximaProducirJornadaNormal);
      const maxHE = safeNumber(row.necesidadMaximaProducirHorasExtras);
      const maxSab = safeNumber(row.necesidadMaximaProducirSabados);

      agg.minBase += pb * tupp;
      agg.minAdelanto += pa * tupp;
      agg.minRecuperado += pr * tupp;
      agg.minPIO += pp * tupp;
      agg.minFromViable += pv * tupp;
      agg.nMateriales += 1;
      if (tupp <= 0) agg.nMaterialesTuppCero += 1;

      agg.defJN += safeNumber(row.deficitJornadaNormal);
      agg.defHE += safeNumber(row.deficitHorasExtras);
      agg.defSAB += safeNumber(row.deficitSabados);
      agg.maxJNUnidades += maxJN;
      agg.maxHEUnidades += maxHE;
      agg.maxSabUnidades += maxSab;
      agg.minJNAsign += maxJN * tupp;
      agg.minHEAsign += maxHE * tupp;
      agg.minSabAsign += maxSab * tupp;
    });

    const rows = Array.from(map.values()).map(r => {
      const minUsados = r.minBase + r.minAdelanto + r.minRecuperado + r.minPIO;
      const idleFinal = Math.max(0, r.capTotal - minUsados);
      const pctUso = r.capTotal > 0 ? (minUsados / r.capTotal) * 100 : 0;
      const deltaVsViable = r.minFromViable - minUsados;
      const pctUsoPoolSab = r.capSab > 0 ? (r.minSabAsign / r.capSab) * 100 : 0;
      return {
        ...r,
        minUsados,
        idleFinal,
        pctUso,
        deltaVsViable,
        pctUsoPoolSab,
      };
    });

    return rows.sort((a, b) => {
      if (a.centro !== b.centro) return a.centro.localeCompare(b.centro);
      if (a.anio !== b.anio) return a.anio - b.anio;
      if (a.mesNumero !== b.mesNumero) return a.mesNumero - b.mesNumero;
      return a.linea.localeCompare(b.linea);
    });
  }, [
    filteredC1000,
    filteredC2000,
    tiemposCanonC1000,
    tiemposCanonC2000,
    maxExtrasHoras,
    horasExtrasFin,
  ]);

  const diagnosticTotalPages = useMemo(
    () => Math.max(1, Math.ceil(diagnosticRows.length / diagnosticPageSize)),
    [diagnosticRows.length, diagnosticPageSize],
  );

  const pagedDiagnosticRows = useMemo(() => {
    const safePage = Math.min(diagnosticPage, diagnosticTotalPages);
    const start = (safePage - 1) * diagnosticPageSize;
    return diagnosticRows.slice(start, start + diagnosticPageSize);
  }, [diagnosticRows, diagnosticPage, diagnosticPageSize, diagnosticTotalPages]);

  const monthlyTotalPages = useMemo(
    () => Math.max(1, Math.ceil(monthlyRows.length / monthlyPageSize)),
    [monthlyRows.length, monthlyPageSize]
  );

  const pagedMonthlyRows = useMemo(() => {
    const safePage = Math.min(monthlyPage, monthlyTotalPages);
    const start = (safePage - 1) * monthlyPageSize;
    return monthlyRows.slice(start, start + monthlyPageSize);
  }, [monthlyRows, monthlyPage, monthlyPageSize, monthlyTotalPages]);

  /** Suma aritmética de las filas mensuales visibles en la página (no incluye desglose semanal). */
  const pagedMonthlyTotals = useMemo(() => {
    return pagedMonthlyRows.reduce(
      (acc, r) => ({
        saldoInicial: acc.saldoInicial + safeNumber(r.saldoInicial),
        produccion: acc.produccion + safeNumber(r.produccion),
        despachos: acc.despachos + safeNumber(r.despachos),
        traslados: acc.traslados + safeNumber(r.traslados),
        demandaVenta: acc.demandaVenta + safeNumber(r.demandaVenta),
        backlogTraslado: acc.backlogTraslado + safeNumber(r.backlogTraslado),
        backlogVentas: acc.backlogVentas + safeNumber(r.backlogVentas),
        saldoFinal: acc.saldoFinal + safeNumber(r.saldoFinal),
      }),
      {
        saldoInicial: 0,
        produccion: 0,
        despachos: 0,
        traslados: 0,
        demandaVenta: 0,
        backlogTraslado: 0,
        backlogVentas: 0,
        saldoFinal: 0,
      },
    );
  }, [pagedMonthlyRows]);

  const intercentro = useMemo(() => {
    const saliente = filteredC1000.reduce((sum, r) => sum + safeNumber(r._despachosTraslado ?? r._trasladoSalienteC2000), 0);
    const entrante = filteredC2000.reduce((sum, r) => sum + safeNumber(r._trasladoEntranteDesdeC1000), 0);
    const backlogTrasladoC1000 = filteredC1000.reduce((sum, r) => sum + safeNumber(r._backlogFinalTraslado), 0);
    return { saliente, entrante, backlogTrasladoC1000, ok: Math.abs(saliente - entrante) < 0.5 };
  }, [filteredC1000, filteredC2000]);

  const toggleMonthExpanded = useCallback((key: string) => {
    setExpandedMonths(prev => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  }, []);

  const handleExport = useCallback(() => {
    const detalleSemanalCodigo = weeklyDetailRows.map(r => ({
      Centro: r.centro,
      Año: r.anio,
      MesNumero: r.mesNumero,
      Mes: r.mesNombre,
      Semana: r.semana,
      SemanaKey: r.semanaKey,
      CodigoMaterial: r.codigoMaterial,
      Sector: r.sector,
      Linea: r.linea,
      DemandaVentas: r.demandaVenta,
      SaldoInicial: r.saldoInicial,
      Produccion: r.produccion,
      Despachos: r.despachos,
      Traslados: r.traslados,
      SaldoFinal: r.saldoFinal,
      BacklogFinalMes: r.backlogFinalMes,
      BacklogTrasladoMes: r.backlogTrasladoMes,
    }));

    const resumenMensual = monthlyRows.map(r => ({
      Centro: r.centro,
      Año: r.anio,
      Mes: r.mesNombre,
      DemandaVentas: r.demandaVenta,
      SaldoInicial: r.saldoInicial,
      Produccion: r.produccion,
      Despachos: r.despachos,
      Traslados: r.traslados,
      BacklogFinalVentas: r.backlogVentas,
      BacklogFinalTraslado: r.backlogTraslado,
      SaldoFinal: r.saldoFinal,
    }));

    // Hoja "DetalleMensual": agrega weeklyDetailRows por (centro, año, mes, código) → una fila por material-mes.
    type DetalleMensualRow = {
      Centro: string; Año: number; MesNumero: number; Mes: string;
      CodigoMaterial: string; Sector: string; Linea: string;
      DemandaVentas: number; SaldoInicial: number; Produccion: number;
      Despachos: number; Traslados: number; SaldoFinal: number;
      BacklogFinalMes: number; BacklogTrasladoMes: number;
    };
    const dmMap = new Map<string, DetalleMensualRow>();
    for (const r of weeklyDetailRows) {
      const k = `${r.centro}|${r.anio}|${r.mesNumero}|${r.codigoMaterial}`;
      if (!dmMap.has(k)) {
        dmMap.set(k, {
          Centro: r.centro, Año: r.anio, MesNumero: r.mesNumero, Mes: r.mesNombre,
          CodigoMaterial: r.codigoMaterial, Sector: r.sector, Linea: r.linea,
          DemandaVentas: r.demandaVenta,
          SaldoInicial: r.saldoInicial,
          Produccion: 0, Despachos: 0, Traslados: 0,
          SaldoFinal: r.saldoFinal,
          BacklogFinalMes: r.backlogFinalMes,
          BacklogTrasladoMes: r.backlogTrasladoMes,
        });
      }
      const cur = dmMap.get(k)!;
      cur.Produccion += r.produccion;
      cur.Despachos += r.despachos;
      cur.Traslados += r.traslados;
      cur.SaldoFinal = r.saldoFinal; // última semana del mes
    }
    const detalleMensual = Array.from(dmMap.values()).sort((a, b) =>
      a.Centro.localeCompare(b.Centro) || a.Año - b.Año || a.MesNumero - b.MesNumero || a.CodigoMaterial.localeCompare(b.CodigoMaterial),
    );

    exportToXLSXMultiSheet(
      [
        { sheetName: 'DetalleMensual', data: detalleMensual },
        { sheetName: 'DetalleSemanalCodigo', data: detalleSemanalCodigo },
        { sheetName: 'ResumenMensual', data: resumenMensual },
      ],
      'IV3_Punto2_Backlog_Semanal_Mensual',
    );
  }, [monthlyRows, weeklyDetailRows]);

  const handleMonthlyPageSizeChange = useCallback((value: number) => {
    setMonthlyPageSize(value);
    setMonthlyPage(1);
  }, []);

  useEffect(() => {
    setDiagnosticPage(1);
  }, [anios, meses, sectores, lineas]);

  const capacityDiagnosticSection = useMemo(
    () => (
      <div className="bg-white rounded-lg border border-gray-200 p-4">
        <div className="flex flex-wrap items-start justify-between gap-2 mb-2">
          <h5
            className="text-sm font-semibold text-gray-800"
            title="Diagnóstico de capacidad. Compara minutos teóricos por línea-mes con los consumidos por producción base, adelanto, recuperación y PIO. Identifica idle no aprovechado y posibles fallos de configuración."
          >
            Diagnóstico de capacidad (línea / mes)
          </h5>
          <button
            type="button"
            onClick={() => setShowBottleneckCross(v => !v)}
            className="text-xs px-2 py-1 border rounded bg-white text-gray-800 hover:bg-gray-50 shrink-0"
          >
            {showBottleneckCross ? 'Ocultar cruce con cuellos' : 'Mostrar cruce con cuellos'}
          </button>
        </div>
        {showBottleneckCross && (
          <p className="text-xs text-gray-600 mb-2">
            Vista de cruce: Cap Sáb (calendario) vs. Min Sáb asign (motor) y déficits residuales. Def JN/HE/SAB son
            sumas de unidades por material en la línea-mes.
          </p>
        )}
        <p className="text-xs text-gray-600 mb-3">
          Minutos de capacidad (JN + HE + sábado según tiempos canónicos) frente a minutos usados por componente de
          producción. Resaltado ámbar: uso &lt; 80% sin adelanto/recuperación/PIO. Resaltado rojo: línea sin match en
          tiempos canónicos.
        </p>
        <div className="overflow-auto">
          <table
            className={`${showBottleneckCross ? 'min-w-[1680px]' : 'min-w-[1200px]'} text-xs border-collapse`}
          >
            <thead className="bg-gray-100 text-gray-700">
              {showBottleneckCross ? (
                <>
                  <tr>
                    <th rowSpan={2} className="px-2 py-2 text-left align-middle">
                      Centro
                    </th>
                    <th rowSpan={2} className="px-2 py-2 text-left align-middle">
                      Mes
                    </th>
                    <th rowSpan={2} className="px-2 py-2 text-left align-middle">
                      Línea
                    </th>
                    <th rowSpan={2} className="px-2 py-2 text-right align-middle" title="Minutos jornada normal (API)">
                      Cap JN
                    </th>
                    <th rowSpan={2} className="px-2 py-2 text-right align-middle" title="días laborables × maxExtrasHoras × 60">
                      Cap HE
                    </th>
                    <th rowSpan={2} className="px-2 py-2 text-right align-middle" title="días sábado × horasExtrasFin × 60">
                      Cap Sáb
                    </th>
                    <th rowSpan={2} className="px-2 py-2 text-right align-middle">
                      Cap total
                    </th>
                    <th rowSpan={2} className="px-2 py-2 text-right align-middle">
                      Min base
                    </th>
                    <th rowSpan={2} className="px-2 py-2 text-right align-middle">
                      Min adelanto
                    </th>
                    <th rowSpan={2} className="px-2 py-2 text-right align-middle">
                      Min recup
                    </th>
                    <th rowSpan={2} className="px-2 py-2 text-right align-middle">
                      Min PIO
                    </th>
                    <th rowSpan={2} className="px-2 py-2 text-right align-middle">
                      Min usados
                    </th>
                    <th rowSpan={2} className="px-2 py-2 text-right align-middle">
                      Idle
                    </th>
                    <th rowSpan={2} className="px-2 py-2 text-right align-middle">
                      % uso
                    </th>
                    <th
                      rowSpan={2}
                      className="px-2 py-2 text-right align-middle"
                      title="Σ(_prodViableTotal×TUPP) − min usados; distinto de 0 sugiere filas precomputadas o campos inconsistentes."
                    >
                      Δ vs viable
                    </th>
                    <th rowSpan={2} className="px-2 py-2 text-right align-middle">
                      Materiales
                    </th>
                    <th rowSpan={2} className="px-2 py-2 text-right align-middle" title="Filas con TUPP ≤ 0 en este grupo">
                      Mat. sin TUPP
                    </th>
                    <th colSpan={7} className="px-2 py-2 text-center bg-orange-50/80 text-orange-950 border-l-2 border-orange-200">
                      Cuellos
                    </th>
                  </tr>
                  <tr className="bg-orange-50/40">
                    <th className="px-2 py-1.5 text-right border-l-2 border-orange-200" title="Σ déficit jornada normal (unidades)">
                      Def JN
                    </th>
                    <th className="px-2 py-1.5 text-right" title="Σ déficit tras HE (unidades)">
                      Def HE
                    </th>
                    <th className="px-2 py-1.5 text-right" title="Σ déficit tras sábado (unidades)">
                      Def SAB
                    </th>
                    <th className="px-2 py-1.5 text-right" title="Σ maxJN × TUPP (min)">
                      Min JN asign
                    </th>
                    <th className="px-2 py-1.5 text-right" title="Σ maxHE × TUPP (min)">
                      Min HE asign
                    </th>
                    <th className="px-2 py-1.5 text-right" title="Σ maxSab × TUPP (min)">
                      Min Sáb asign
                    </th>
                    <th className="px-2 py-1.5 text-right" title="Min Sáb asign / Cap Sáb">
                      % pool Sáb
                    </th>
                  </tr>
                </>
              ) : (
                <tr>
                  <th className="px-2 py-2 text-left">Centro</th>
                  <th className="px-2 py-2 text-left">Mes</th>
                  <th className="px-2 py-2 text-left">Línea</th>
                  <th className="px-2 py-2 text-right" title="Minutos jornada normal (API)">
                    Cap JN
                  </th>
                  <th className="px-2 py-2 text-right" title="días laborables × maxExtrasHoras × 60">
                    Cap HE
                  </th>
                  <th className="px-2 py-2 text-right" title="días sábado × horasExtrasFin × 60">
                    Cap Sáb
                  </th>
                  <th className="px-2 py-2 text-right">Cap total</th>
                  <th className="px-2 py-2 text-right">Min base</th>
                  <th className="px-2 py-2 text-right">Min adelanto</th>
                  <th className="px-2 py-2 text-right">Min recup</th>
                  <th className="px-2 py-2 text-right">Min PIO</th>
                  <th className="px-2 py-2 text-right">Min usados</th>
                  <th className="px-2 py-2 text-right">Idle</th>
                  <th className="px-2 py-2 text-right">% uso</th>
                  <th
                    className="px-2 py-2 text-right"
                    title="Σ(_prodViableTotal×TUPP) − min usados; distinto de 0 sugiere filas precomputadas o campos inconsistentes."
                  >
                    Δ vs viable
                  </th>
                  <th className="px-2 py-2 text-right">Materiales</th>
                  <th className="px-2 py-2 text-right" title="Filas con TUPP ≤ 0 en este grupo">
                    Mat. sin TUPP
                  </th>
                </tr>
              )}
            </thead>
            <tbody>
              {pagedDiagnosticRows.map(d => {
                const idleNotUsed =
                  d.pctUso < 80 &&
                  d.minPIO + d.minAdelanto + d.minRecuperado === 0 &&
                  d.lineaResolvida;
                const rowClass = !d.lineaResolvida
                  ? 'bg-red-50/70'
                  : idleNotUsed
                    ? 'bg-amber-50/60'
                    : 'bg-white';
                const poolSabIdleHint =
                  d.capSab > 0 && d.defHE === 0 && d.minSabAsign === 0;
                return (
                  <tr key={d.key} className={`border-t border-gray-100 ${rowClass}`}>
                    <td className="px-2 py-1.5">{d.centro}</td>
                    <td className="px-2 py-1.5 whitespace-nowrap">{d.mesNombre}</td>
                    <td className="px-2 py-1.5 max-w-[200px] truncate" title={d.linea}>
                      {d.linea}
                    </td>
                    <td className="px-2 py-1.5 text-right font-mono">{formatNum(d.capJN)}</td>
                    <td className="px-2 py-1.5 text-right font-mono">{formatNum(d.capHE)}</td>
                    <td className="px-2 py-1.5 text-right font-mono">{formatNum(d.capSab)}</td>
                    <td className="px-2 py-1.5 text-right font-mono font-medium">{formatNum(d.capTotal)}</td>
                    <td className="px-2 py-1.5 text-right font-mono">{formatNum(d.minBase)}</td>
                    <td className="px-2 py-1.5 text-right font-mono">{formatNum(d.minAdelanto)}</td>
                    <td className="px-2 py-1.5 text-right font-mono">{formatNum(d.minRecuperado)}</td>
                    <td className="px-2 py-1.5 text-right font-mono">{formatNum(d.minPIO)}</td>
                    <td className="px-2 py-1.5 text-right font-mono font-semibold">{formatNum(d.minUsados)}</td>
                    <td className="px-2 py-1.5 text-right font-mono">{formatNum(d.idleFinal)}</td>
                    <td className="px-2 py-1.5 text-right font-mono">{formatPct(d.pctUso)}</td>
                    <td className="px-2 py-1.5 text-right font-mono">{formatNum(d.deltaVsViable)}</td>
                    <td className="px-2 py-1.5 text-right font-mono">{formatNum(d.nMateriales)}</td>
                    <td
                      className={`px-2 py-1.5 text-right font-mono ${d.nMaterialesTuppCero > 0 ? 'text-red-700 font-semibold' : ''}`}
                    >
                      {formatNum(d.nMaterialesTuppCero)}
                    </td>
                    {showBottleneckCross && (
                      <>
                        <td className="px-2 py-1.5 text-right font-mono border-l-2 border-orange-100">
                          {formatNum(d.defJN)}
                        </td>
                        <td className="px-2 py-1.5 text-right font-mono">{formatNum(d.defHE)}</td>
                        <td
                          className={`px-2 py-1.5 text-right font-mono ${d.defSAB > 0 ? 'text-red-700 font-semibold' : ''}`}
                          title={d.defSAB > 0 ? 'Faltó pool de sábado para cubrir esta necesidad.' : undefined}
                        >
                          {formatNum(d.defSAB)}
                        </td>
                        <td className="px-2 py-1.5 text-right font-mono">{formatNum(d.minJNAsign)}</td>
                        <td className="px-2 py-1.5 text-right font-mono">{formatNum(d.minHEAsign)}</td>
                        <td className="px-2 py-1.5 text-right font-mono">{formatNum(d.minSabAsign)}</td>
                        <td
                          className={`px-2 py-1.5 text-right font-mono ${poolSabIdleHint ? 'text-gray-500 italic' : ''}`}
                          title={
                            poolSabIdleHint
                              ? 'Pool sábado vacío porque HE ya cubría todo el déficit.'
                              : undefined
                          }
                        >
                          {formatPct(d.pctUsoPoolSab)}
                        </td>
                      </>
                    )}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        <div className="mt-3 flex flex-wrap items-center justify-between gap-2 text-xs text-gray-600">
          <span>
            Mostrando <strong>{pagedDiagnosticRows.length}</strong> de <strong>{diagnosticRows.length}</strong> líneas
          </span>
          <div className="flex items-center justify-end gap-2">
            <button
              type="button"
              onClick={() => setDiagnosticPage(p => Math.max(1, p - 1))}
              disabled={diagnosticPage <= 1}
              className="px-2 py-1 border rounded disabled:opacity-50 bg-white"
            >
              Anterior
            </button>
            <span>
              Página <strong>{Math.min(diagnosticPage, diagnosticTotalPages)}</strong> de{' '}
              <strong>{diagnosticTotalPages}</strong>
            </span>
            <button
              type="button"
              onClick={() => setDiagnosticPage(p => Math.min(diagnosticTotalPages, p + 1))}
              disabled={diagnosticPage >= diagnosticTotalPages}
              className="px-2 py-1 border rounded disabled:opacity-50 bg-white"
            >
              Siguiente
            </button>
          </div>
        </div>
      </div>
    ),
    [showBottleneckCross, pagedDiagnosticRows, diagnosticRows, diagnosticPage, diagnosticTotalPages],
  );

  if (allRows.length === 0) {
    return <div className="p-6 text-sm text-gray-500 border border-gray-200 rounded-lg bg-white">No hay resultados para mostrar en Punto 2.</div>;
  }

  return (
    <div className="space-y-4">
      <div className="bg-white rounded-lg border border-gray-200 p-4">
        <div className="flex flex-col lg:flex-row lg:items-end gap-3 flex-wrap">
          <MultiSelectDropdown label="Año" options={aniosOpciones} selected={anios} onChange={setAnios} />
          <MultiSelectDropdown label="Mes" options={mesesOpciones} selected={meses} onChange={setMeses} />
          <MultiSelectDropdown label="Sector" options={sectoresOpciones} selected={sectores} onChange={setSectores} />
          <MultiSelectDropdown label="Línea" options={lineasOpciones} selected={lineas} onChange={setLineas} />
          <div className="flex items-center border border-gray-300 rounded-md overflow-hidden">
            <button
              type="button"
              onClick={() => setViewMode('mensual')}
              className={`px-3 py-2 text-xs ${viewMode === 'mensual' ? 'bg-blue-600 text-white' : 'bg-white text-gray-700'}`}
            >
              Mensual
            </button>
            <button
              type="button"
              onClick={() => setViewMode('semanal')}
              className={`px-3 py-2 text-xs ${viewMode === 'semanal' ? 'bg-blue-600 text-white' : 'bg-white text-gray-700'}`}
            >
              Semanal
            </button>
          </div>
          <button
            type="button"
            onClick={handleExport}
            className="ml-auto inline-flex items-center px-4 py-2 rounded-md bg-green-600 text-white text-sm font-medium hover:bg-green-700"
          >
            Exportar Excel (Semanal + Mensual)
          </button>
        </div>
        <div className={`mt-3 text-xs rounded-md px-3 py-2 ${intercentro.ok ? 'bg-emerald-50 text-emerald-900' : 'bg-amber-50 text-amber-900'}`}>
          <strong>Intercentro (filtros actuales):</strong> saliente C1000 = {formatNum(intercentro.saliente)} · entrante C2000 ={' '}
          {formatNum(intercentro.entrante)}
          {intercentro.backlogTrasladoC1000 > 0 && (
            <>
              {' '}
              · backlog traslado C1000 = <strong>{formatNum(intercentro.backlogTrasladoC1000)}</strong>
            </>
          )}
        </div>
      </div>

      <div className="bg-white rounded-lg border border-gray-200 overflow-auto">
        <div className="px-3 py-2 border-b border-gray-200 bg-gray-50 flex flex-wrap items-center justify-between gap-2 text-xs text-gray-700">
          <span>
            Mostrando <strong>{pagedMonthlyRows.length}</strong> de <strong>{monthlyRows.length}</strong> meses
          </span>
          <div className="flex items-center gap-2">
            <label htmlFor="monthlyPageSize" className="text-gray-600">Meses por página</label>
            <select
              id="monthlyPageSize"
              value={monthlyPageSize}
              onChange={(e) => handleMonthlyPageSizeChange(Number(e.target.value))}
              className="border border-gray-300 rounded px-2 py-1 bg-white"
            >
              <option value={10}>10</option>
              <option value={20}>20</option>
              <option value={50}>50</option>
            </select>
          </div>
        </div>
        <table className="min-w-full text-xs border-collapse">
          <thead className="bg-gray-100">
            <tr>
              <th className="px-2 py-2 text-left">Expandir</th>
              <th className="px-2 py-2 text-left">Centro</th>
              <th className="px-2 py-2 text-left">Año</th>
              <th className="px-2 py-2 text-left">Mes</th>
              <th className="px-2 py-2 text-right">Saldo inicial</th>
              <th className="px-2 py-2 text-right">Producción</th>
              <th className="px-2 py-2 text-right">Despachos</th>
              <th className="px-2 py-2 text-right">Traslados</th>
              <th
                className="px-2 py-2 text-right text-blue-800"
                title="Demanda de ventas del mes (_demandaVenta). Debe coincidir con el total mensual del Ajuste de presupuesto (L-V)."
              >
                Demanda
              </th>
              <th className="px-2 py-2 text-right" title="Faltante de demanda de traslado plan C1000→C2000 (no incluida en L-V ventas).">
                Backlog traslado
              </th>
              <th
                className="px-2 py-2 text-right"
                title="Faltante de demanda de ventas (L-V). Identidad: Despachos + Backlog ventas = Demanda + Backlog mes anterior."
              >
                Backlog ventas
              </th>
              <th className="px-2 py-2 text-right">Saldo final</th>
            </tr>
          </thead>
          <tbody>
            {pagedMonthlyRows.map(row => {
              const isExpanded = viewMode === 'semanal' || expandedMonths.has(row.key);
              const monthWeeks = weekSegments.filter(seg => seg.anio === row.anio && seg.mes === row.mesNumero);
              return (
                <React.Fragment key={row.key}>
                  <tr className="border-t border-gray-100 bg-white">
                    <td className="px-2 py-1">
                      <button
                        type="button"
                        onClick={() => toggleMonthExpanded(row.key)}
                        className="px-2 py-0.5 border rounded text-[10px] bg-white"
                      >
                        {isExpanded ? '-' : '+'}
                      </button>
                    </td>
                    <td className="px-2 py-1">{row.centro}</td>
                    <td className="px-2 py-1">{row.anio}</td>
                    <td className="px-2 py-1 font-semibold">{row.mesNombre}</td>
                    <td className="px-2 py-1 text-right">{formatNum(row.saldoInicial)}</td>
                    <td className="px-2 py-1 text-right">{formatNum(row.produccion)}</td>
                    <td className="px-2 py-1 text-right">{formatNum(row.despachos)}</td>
                    <td className="px-2 py-1 text-right">{formatNum(row.traslados)}</td>
                    <td className="px-2 py-1 text-right font-semibold text-blue-800">{formatNum(row.demandaVenta)}</td>
                    <td className="px-2 py-1 text-right font-medium text-indigo-900">{formatNum(row.backlogTraslado)}</td>
                    <td className="px-2 py-1 text-right font-medium text-gray-800">{formatNum(row.backlogVentas)}</td>
                    <td className="px-2 py-1 text-right font-semibold">{formatNum(row.saldoFinal)}</td>
                  </tr>
                  {isExpanded && monthWeeks.map(week => (
                    <tr key={`${row.key}-${week.weekKey}`} className="border-t border-gray-100 bg-blue-50/40">
                      <td className="px-2 py-1 text-center text-gray-400">·</td>
                      <td className="px-2 py-1 text-xs text-gray-600">{row.centro}</td>
                      <td className="px-2 py-1 text-xs text-gray-600">{row.anio}</td>
                      <td className="px-2 py-1 text-xs font-medium">{week.label}</td>
                      <td className="px-2 py-1 text-right text-xs">{formatNum(safeNumber(row.weeks.saldoInicial[week.weekKey] || 0))}</td>
                      <td className="px-2 py-1 text-right text-xs">{formatNum(safeNumber(row.weeks.produccion[week.weekKey] || 0))}</td>
                      <td className="px-2 py-1 text-right text-xs">{formatNum(safeNumber(row.weeks.despachos[week.weekKey] || 0))}</td>
                      <td className="px-2 py-1 text-right text-xs">{formatNum(safeNumber(row.weeks.traslados[week.weekKey] || 0))}</td>
                      <td className="px-2 py-1 text-right text-xs text-gray-400">—</td>
                      <td className="px-2 py-1 text-right text-xs text-gray-400">—</td>
                      <td className="px-2 py-1 text-right text-xs text-gray-400">—</td>
                      <td className="px-2 py-1 text-right text-xs font-medium">{formatNum(safeNumber(row.weeks.saldoFinal[week.weekKey] || 0))}</td>
                    </tr>
                  ))}
                </React.Fragment>
              );
            })}
          </tbody>
          {pagedMonthlyRows.length > 0 && (
            <tfoot className="bg-gray-100 border-t-2 border-gray-400">
              <tr title="Suma aritmética de las filas mensuales visibles en esta página (sin desglose semanal).">
                <td className="px-2 py-2 text-left font-semibold text-gray-900" colSpan={4}>
                  Total
                </td>
                <td className="px-2 py-2 text-right font-semibold text-gray-900">{formatNum(pagedMonthlyTotals.saldoInicial)}</td>
                <td className="px-2 py-2 text-right font-semibold text-gray-900">{formatNum(pagedMonthlyTotals.produccion)}</td>
                <td className="px-2 py-2 text-right font-semibold text-gray-900">{formatNum(pagedMonthlyTotals.despachos)}</td>
                <td className="px-2 py-2 text-right font-semibold text-gray-900">{formatNum(pagedMonthlyTotals.traslados)}</td>
                <td className="px-2 py-2 text-right font-bold text-blue-800">{formatNum(pagedMonthlyTotals.demandaVenta)}</td>
                <td className="px-2 py-2 text-right font-semibold text-indigo-950">{formatNum(pagedMonthlyTotals.backlogTraslado)}</td>
                <td className="px-2 py-2 text-right font-semibold text-gray-900">{formatNum(pagedMonthlyTotals.backlogVentas)}</td>
                <td className="px-2 py-2 text-right font-semibold text-gray-900">{formatNum(pagedMonthlyTotals.saldoFinal)}</td>
              </tr>
            </tfoot>
          )}
        </table>
      </div>

      <div className="flex items-center justify-end gap-2 text-xs">
        <button
          type="button"
          onClick={() => setMonthlyPage((p) => Math.max(1, p - 1))}
          disabled={monthlyPage <= 1}
          className="px-2 py-1 border rounded disabled:opacity-50 bg-white"
        >
          Anterior
        </button>
        <span>
          Página <strong>{Math.min(monthlyPage, monthlyTotalPages)}</strong> de <strong>{monthlyTotalPages}</strong>
        </span>
        <button
          type="button"
          onClick={() => setMonthlyPage((p) => Math.min(monthlyTotalPages, p + 1))}
          disabled={monthlyPage >= monthlyTotalPages}
          className="px-2 py-1 border rounded disabled:opacity-50 bg-white"
        >
          Siguiente
        </button>
      </div>

      <div className="bg-white rounded-lg border border-gray-200 p-4">
        <h5 className="text-sm font-semibold text-gray-800 mb-2">Resumen mensual por centro</h5>
        <div className="overflow-auto">
          <table className="min-w-[420px] text-sm">
            <thead className="bg-gray-100 text-gray-700">
              <tr>
                <th className="px-2 py-2 text-left">Centro</th>
                <th className="px-2 py-2 text-left">Mes</th>
                <th className="px-2 py-2 text-right" title="Cuadre con demanda L-V + Despachos">
                  Backlog ventas
                </th>
                <th className="px-2 py-2 text-right" title="Solo C1000: pendiente traslado plan">
                  Backlog traslado
                </th>
              </tr>
            </thead>
            <tbody>
              {monthlySummary.map((r, idx) => (
                <tr key={`${r.centro}-${r.mes}-${idx}`} className="border-t border-gray-100">
                  <td className="px-2 py-2">{r.centro}</td>
                  <td className="px-2 py-2">{r.mes}</td>
                  <td className="px-2 py-2 text-right font-semibold">{formatNum(r.backlogVentas)}</td>
                  <td className="px-2 py-2 text-right font-semibold">{formatNum(r.backlogTraslado)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {diagnosticPortalTarget
        ? createPortal(capacityDiagnosticSection, diagnosticPortalTarget)
        : capacityDiagnosticSection}
    </div>
  );
};
