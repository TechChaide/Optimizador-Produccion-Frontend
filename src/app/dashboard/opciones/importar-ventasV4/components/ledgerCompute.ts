/**
 * Construye el ledger semanal de IV4 a partir de las filas mensuales producidas
 * por el motor reusado de IV3 (computeBacklogRegressiveFinalRows). Aplica:
 *   - Distribucion por largest remainder (peso = diasLaborales + sabadoActivo).
 *   - Reglas de balance semanal (stock y backlog) con arrastres semana a semana.
 *   - Cierre de drift contra los totales mensuales del motor (ajusta ultima semana).
 *
 * Mantiene la regla: la vista mensual se obtiene SIEMPRE agregando este ledger.
 */

import type { WeekSegment } from '../../plan-semanal/components/types';
import type { TiempoCanonResult } from '../../importar-ventasV2/components/types';
import { safeNumber, normalizeMaterialCode } from '../../importar-ventasV2/components/utils';
import { MONTH_NAMES } from '../../importar-ventasV2/components/constants';
import { getMesNumericoRegressive } from '../../importar-ventasV2/components/backlogRegressiveCompute';
import type { BuildLedgerParams, MonthlySnapshot, PlanLedgerWeek } from './types';

interface LargestRemainderItem<T> {
  ref: T;
  weight: number;
  base: number;
  frac: number;
}

/**
 * Reparte un total entero entre items con pesos no negativos usando el metodo
 * de "mayor residuo" (largest remainder), garantizando que la suma final = total.
 */
function distributeLargestRemainder<T>(
  total: number,
  items: Array<{ ref: T; weight: number }>,
): Array<{ ref: T; value: number }> {
  if (!items.length) return [];
  const totWeight = items.reduce((s, it) => s + Math.max(0, it.weight), 0);
  if (totWeight <= 0 || total === 0) {
    return items.map(it => ({ ref: it.ref, value: 0 }));
  }

  const tentative: LargestRemainderItem<T>[] = items.map(it => {
    const exact = (total * Math.max(0, it.weight)) / totWeight;
    const base = Math.floor(exact);
    return { ref: it.ref, weight: it.weight, base, frac: exact - base };
  });

  let assigned = tentative.reduce((s, it) => s + it.base, 0);
  let remainder = Math.round(total - assigned);

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

  return tentative.map(it => ({ ref: it.ref, value: it.base }));
}

function findLineCanonMinutes(
  tc: TiempoCanonResult | undefined,
  linea: string,
): number {
  if (!tc || !tc.data || !Array.isArray(tc.data)) return 0;
  const target = String(linea).toLowerCase().replace(/\s+/g, '');
  const dp = tc.data.find((item: any) => {
    const nl = String(item?.nombre_linea ?? '').toLowerCase().replace(/\s+/g, '');
    return nl === target || nl.includes(target);
  });
  return safeNumber(dp?.minutos_horario_normal_TOTAL || 0);
}

/**
 * Construye el ledger semanal para un centro. Genera una fila por cada
 * (linea, material, semana) con balance, capacidad e idle.
 *
 * Si la primera semana del mes no tiene `_stockInitial`, ese stock se asigna
 * solo a la primera semana del primer mes que aparece. El resto de semanas
 * arrastra `stockInicial = stockFinal[N-1]` via rebalanceArrastres.
 */
export function buildLedgerFromMonthly(params: BuildLedgerParams): PlanLedgerWeek[] {
  const {
    finalRowsCentro,
    weekSegments,
    activeSatKeys,
    centro,
    horasExtrasFin,
    maxExtrasHoras,
    tiemposCanon,
  } = params;

  if (!finalRowsCentro?.length || !weekSegments?.length) return [];

  const tcByMes = new Map<number, TiempoCanonResult>();
  for (const tc of tiemposCanon || []) {
    tcByMes.set(tc.mesNumero, tc);
  }

  const minutosLineaCache = new Map<string, number>();
  const getLineMinutes = (mesNum: number, linea: string): number => {
    const k = `${mesNum}|${linea}`;
    if (minutosLineaCache.has(k)) return minutosLineaCache.get(k)!;
    const v = findLineCanonMinutes(tcByMes.get(mesNum), linea);
    minutosLineaCache.set(k, v);
    return v;
  };

  const ledger: PlanLedgerWeek[] = [];

  for (const r of finalRowsCentro) {
    const material = normalizeMaterialCode(r.CodMaterial);
    const linea = String(r.lineaRef || r.LineaFabricacion || 'Sin linea');
    const sectorRef = String(r.Sector ?? r.sector ?? '');
    const descripcion = String(r.NombreMaterial ?? r.Descripcion ?? r.descripcion ?? '');
    const mesNum = safeNumber(r._mesNumero) || getMesNumericoRegressive(r.mesRef || r.Mes);
    const anio = safeNumber(r._anioFila || r.Año || r.año);
    if (!mesNum || !anio) continue;

    const segs = weekSegments.filter(s => s.mes === mesNum && s.anio === anio);
    if (!segs.length) continue;

    const prodTotal = safeNumber(r._prodViableTotal);
    const despVentas = safeNumber(r._despachosVentas);
    const despTrasladoSaliente = centro === '1000' ? safeNumber(r._despachosTraslado) : 0;
    const trasladoEntrante = centro === '2000' ? safeNumber(r._trasladoEntranteDesdeC1000) : 0;
    const stockIniMes = safeNumber(r._stockInitial);
    const backlogIniMes = safeNumber(r._backlogPasado);
    const tupp = safeNumber(r.tiempoUnitarioPorPuesto || r._tupp);
    const demandaMes = safeNumber(r._demandaVenta || r.UnidadesProyectado);
    const minutosLinea = getLineMinutes(mesNum, linea);

    const segWeights = segs.map(seg => {
      const sabadoActivo = seg.tieneSabado && activeSatKeys.has(seg.satKey);
      const w = seg.diasLaborales + (sabadoActivo ? 1 : 0);
      return { seg, sabadoActivo, weight: w };
    });

    const prodSplit = distributeLargestRemainder(
      Math.round(prodTotal),
      segWeights.map(it => ({ ref: it, weight: it.weight })),
    );
    const despVentasSplit = distributeLargestRemainder(
      Math.round(despVentas),
      segWeights.map(it => ({ ref: it, weight: it.weight })),
    );
    const trasSalSplit = distributeLargestRemainder(
      Math.round(despTrasladoSaliente),
      segWeights.map(it => ({ ref: it, weight: it.weight })),
    );
    const trasEntSplit = distributeLargestRemainder(
      Math.round(trasladoEntrante),
      segWeights.map(it => ({ ref: it, weight: it.weight })),
    );
    const demandaSplit = distributeLargestRemainder(
      Math.round(demandaMes),
      segWeights.map(it => ({ ref: it, weight: it.weight })),
    );

    const totalDiasLab = segs.reduce((s, seg) => s + seg.diasLaborales, 0);

    for (let i = 0; i < segWeights.length; i += 1) {
      const { seg, sabadoActivo, weight } = segWeights[i];

      const capJN = totalDiasLab > 0 ? Math.round((minutosLinea * seg.diasLaborales) / totalDiasLab) : 0;
      const capHE = Math.round(seg.diasLaborales * maxExtrasHoras * 60);
      const capSab = sabadoActivo ? Math.round(horasExtrasFin * 60) : 0;
      const capTotal = capJN + capHE + capSab;

      const produccion = prodSplit[i].value;
      const minUsadosBase = Math.round(produccion * tupp);
      const idleSem = Math.max(0, capTotal - minUsadosBase);

      const week: PlanLedgerWeek = {
        centro,
        linea,
        material,
        weekKey: seg.weekKey,
        satKey: seg.satKey,
        isoWeek: seg.isoWeek,
        isoYear: seg.isoYear,
        mes: seg.mes,
        anio: seg.anio,
        diasLV: seg.diasLaborales,
        sabadoActivo,
        diasEfectivos: weight,
        capJN,
        capHE,
        capSab,
        capTotal,
        minUsadosBase,
        idleSem,
        demanda: demandaSplit[i].value,
        despachosVentas: despVentasSplit[i].value,
        trasladoSaliente: trasSalSplit[i].value,
        trasladoEntrante: trasEntSplit[i].value,
        produccion,
        produccionFill: 0,
        stockInicial: i === 0 ? stockIniMes : 0,
        stockFinal: 0,
        backlogInicial: i === 0 ? backlogIniMes : 0,
        backlogFinal: 0,
        sectorRef,
        descripcion,
        mesNombre: MONTH_NAMES[seg.mes] || `Mes ${seg.mes}`,
        tupp,
      };
      ledger.push(week);
    }
  }

  return ledger;
}

/** Ordena el ledger por (material, anio, isoWeek). */
function compareLedger(a: PlanLedgerWeek, b: PlanLedgerWeek): number {
  if (a.centro !== b.centro) return a.centro < b.centro ? -1 : 1;
  if (a.material !== b.material) return a.material < b.material ? -1 : 1;
  if (a.anio !== b.anio) return a.anio - b.anio;
  if (a.mes !== b.mes) return a.mes - b.mes;
  if (a.isoWeek !== b.isoWeek) return a.isoWeek - b.isoWeek;
  return 0;
}

/**
 * Aplica las identidades de balance y arrastra stock/backlog semana a semana
 * por (centro, material). Modifica una copia ordenada del ledger.
 */
export function rebalanceArrastres(ledger: PlanLedgerWeek[]): PlanLedgerWeek[] {
  const ordered = [...ledger].sort(compareLedger);

  let prevKey = '';
  let prevStock = 0;
  let prevBacklog = 0;

  for (const w of ordered) {
    const groupKey = `${w.centro}|${w.material}`;
    if (groupKey !== prevKey) {
      prevKey = groupKey;
      prevStock = w.stockInicial;
      prevBacklog = w.backlogInicial;
    } else {
      w.stockInicial = prevStock;
      w.backlogInicial = prevBacklog;
    }

    const disponible = w.stockInicial + w.produccion + w.produccionFill + w.trasladoEntrante;
    const totalSalidas = w.despachosVentas + w.trasladoSaliente;
    const stockFinal = Math.max(0, disponible - totalSalidas);
    const necesidadConBacklog = w.demanda + w.backlogInicial;
    const backlogFinal = Math.max(0, necesidadConBacklog - w.despachosVentas);

    w.stockFinal = stockFinal;
    w.backlogFinal = backlogFinal;

    prevStock = stockFinal;
    prevBacklog = backlogFinal;
  }

  return ordered;
}

/** Agrega el ledger semanal a snapshot mensual por (centro, linea, material, mes). */
export function aggregateLedgerToMonthly(ledger: PlanLedgerWeek[]): MonthlySnapshot[] {
  const byKey = new Map<string, MonthlySnapshot>();

  const orderedLedger = [...ledger].sort(compareLedger);
  for (const w of orderedLedger) {
    const k = `${w.centro}|${w.material}|${w.anio}|${w.mes}`;
    let snap = byKey.get(k);
    if (!snap) {
      snap = {
        centro: w.centro,
        linea: w.linea,
        material: w.material,
        mes: w.mes,
        anio: w.anio,
        mesNombre: w.mesNombre,
        sectorRef: w.sectorRef,
        descripcion: w.descripcion,
        demanda: 0,
        despachosVentas: 0,
        produccion: 0,
        produccionFill: 0,
        trasladoSaliente: 0,
        trasladoEntrante: 0,
        stockInicialMes: w.stockInicial,
        stockFinalMes: 0,
        backlogInicialMes: w.backlogInicial,
        backlogFinalMes: 0,
        capTotalMes: 0,
        capSabMes: 0,
        idleMes: 0,
        semanasContadas: 0,
        sabadosActivos: 0,
      };
      byKey.set(k, snap);
    }
    snap.demanda += w.demanda;
    snap.despachosVentas += w.despachosVentas;
    snap.produccion += w.produccion;
    snap.produccionFill += w.produccionFill;
    snap.trasladoSaliente += w.trasladoSaliente;
    snap.trasladoEntrante += w.trasladoEntrante;
    snap.capTotalMes += w.capTotal;
    snap.capSabMes += w.capSab;
    snap.idleMes += w.idleSem;
    snap.semanasContadas += 1;
    snap.sabadosActivos += w.sabadoActivo ? 1 : 0;
    snap.stockFinalMes = w.stockFinal;
    snap.backlogFinalMes = w.backlogFinal;
  }

  return Array.from(byKey.values()).sort((a, b) => {
    if (a.centro !== b.centro) return a.centro < b.centro ? -1 : 1;
    if (a.material !== b.material) return a.material < b.material ? -1 : 1;
    if (a.anio !== b.anio) return a.anio - b.anio;
    return a.mes - b.mes;
  });
}

interface EngineMonthlyTotals {
  produccion: number;
  despachosVentas: number;
  trasladoSaliente: number;
  trasladoEntrante: number;
}

function buildEngineTotals(
  finalRowsCentro: any[],
  centro: string,
): Map<string, EngineMonthlyTotals> {
  const map = new Map<string, EngineMonthlyTotals>();
  for (const r of finalRowsCentro) {
    const material = normalizeMaterialCode(r.CodMaterial);
    const mesNum = safeNumber(r._mesNumero) || getMesNumericoRegressive(r.mesRef || r.Mes);
    const anio = safeNumber(r._anioFila || r.Año || r.año);
    if (!mesNum || !anio) continue;
    const k = `${centro}|${material}|${anio}|${mesNum}`;
    map.set(k, {
      produccion: safeNumber(r._prodViableTotal),
      despachosVentas: safeNumber(r._despachosVentas),
      trasladoSaliente: centro === '1000' ? safeNumber(r._despachosTraslado) : 0,
      trasladoEntrante: centro === '2000' ? safeNumber(r._trasladoEntranteDesdeC1000) : 0,
    });
  }
  return map;
}

/**
 * Cierra el drift de redondeo en la ultima semana de cada mes para que la
 * suma semanal coincida exactamente con el total mensual del motor.
 *
 * No fuerza valores negativos: si el ajuste haria negativa una metrica,
 * lo limita a 0 y deja la diferencia para inspeccion via consistencyChecks.
 */
export function closeRoundingDrift(
  ledger: PlanLedgerWeek[],
  finalRowsCentro: any[],
  centro: string,
): PlanLedgerWeek[] {
  const totals = buildEngineTotals(finalRowsCentro, centro);

  const groups = new Map<string, PlanLedgerWeek[]>();
  for (const w of ledger) {
    const k = `${w.centro}|${w.material}|${w.anio}|${w.mes}`;
    if (!groups.has(k)) groups.set(k, []);
    groups.get(k)!.push(w);
  }

  for (const [k, weeks] of groups) {
    const target = totals.get(k);
    if (!target || !weeks.length) continue;
    const sorted = weeks.sort((a, b) => a.isoYear - b.isoYear || a.isoWeek - b.isoWeek);
    const last = sorted[sorted.length - 1];

    const sumProd = sorted.reduce((s, w) => s + w.produccion, 0);
    const sumDesp = sorted.reduce((s, w) => s + w.despachosVentas, 0);
    const sumTrSal = sorted.reduce((s, w) => s + w.trasladoSaliente, 0);
    const sumTrEnt = sorted.reduce((s, w) => s + w.trasladoEntrante, 0);

    const dProd = Math.round(target.produccion - sumProd);
    const dDesp = Math.round(target.despachosVentas - sumDesp);
    const dTrSal = Math.round(target.trasladoSaliente - sumTrSal);
    const dTrEnt = Math.round(target.trasladoEntrante - sumTrEnt);

    last.produccion = Math.max(0, last.produccion + dProd);
    last.despachosVentas = Math.max(0, last.despachosVentas + dDesp);
    last.trasladoSaliente = Math.max(0, last.trasladoSaliente + dTrSal);
    last.trasladoEntrante = Math.max(0, last.trasladoEntrante + dTrEnt);

    last.minUsadosBase = Math.round(last.produccion * last.tupp);
    last.idleSem = Math.max(0, last.capTotal - last.minUsadosBase);
  }

  return rebalanceArrastres(ledger);
}
