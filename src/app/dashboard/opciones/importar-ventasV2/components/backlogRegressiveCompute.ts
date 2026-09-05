/**
 * Cálculo compartido del backlog regresivo (misma lógica que BacklogRegressiveSection).
 * Extraído para reutilizar en el reporte de totales mensuales sin duplicar reglas.
 *
 * C1000: despacho con prioridad **ventas primero**, luego traslado plan hacia C2000.
 * Backlog de ventas y de traslado se llevan por separado.
 */

import { MONTH_NAMES, MONTH_NUMBERS } from './constants';
import { safeNumber, normalizeMaterialCode } from './utils';
import type { TiempoCanonResult, ViableTransfer, PioMap } from './types';

export function getMesNumericoRegressive(mesRaw: unknown): number {
  if (!mesRaw) return 0;
  const val = String(mesRaw).trim();
  const asNum = parseInt(val, 10);
  if (!isNaN(asNum) && asNum >= 1 && asNum <= 12) return asNum;
  return MONTH_NUMBERS[val as keyof typeof MONTH_NUMBERS] || 0;
}

/** Suma cantidades por material|mes (evita subcontar si hay varias filas con la misma clave). */
export function aggregateViableTransferList(trasladosViables: ViableTransfer[]): ViableTransfer[] {
  const byKey = new Map<string, { code: string; mesLabel: string; cant: number }>();
  for (const v of trasladosViables || []) {
    const code = normalizeMaterialCode(v.CodMaterial);
    const mesNum = getMesNumericoRegressive(v.mes);
    const k = `${code}|${mesNum}`;
    const add = safeNumber(v.cantidad);
    const prev = byKey.get(k);
    const mesLabel = String(v.mes ?? '').trim() || String(mesNum);
    if (prev) prev.cant += add;
    else byKey.set(k, { code, mesLabel, cant: add });
  }
  return Array.from(byKey.values()).map(({ code, mesLabel, cant }) => ({
    CodMaterial: code,
    mes: mesLabel,
    cantidad: cant,
  }));
}

function buildViableCantidadMap(trasladosViables: ViableTransfer[]): Map<string, number> {
  const m = new Map<string, number>();
  for (const v of aggregateViableTransferList(trasladosViables)) {
    const k = `${normalizeMaterialCode(v.CodMaterial)}|${getMesNumericoRegressive(v.mes)}`;
    m.set(k, safeNumber(v.cantidad));
  }
  return m;
}

/** Traslados efectivos C1000→C2000 a partir del resultado regresivo C1000 (despacho traslado simulado). */
export function viableTransfersFromC1000RegressiveRows(rows: any[]): ViableTransfer[] {
  const raw: ViableTransfer[] = [];
  for (const r of rows || []) {
    const qty = safeNumber(r._despachosTraslado);
    if (qty <= 0) continue;
    const code = normalizeMaterialCode(r.CodMaterial);
    const mes = String(r.mesRef ?? r.Mes ?? r._mesNumero ?? '').trim();
    raw.push({ CodMaterial: code, mes, cantidad: qty });
  }
  return aggregateViableTransferList(raw);
}

export interface ComputeBacklogRegressiveParams {
  data: any[];
  tiemposCanon: TiempoCanonResult[];
  centro: string;
  maxExtrasHoras: number;
  horasExtrasFin: number;
  trasladosViables: ViableTransfer[];
  pioMap?: PioMap;
}

/**
 * Consolida varias filas fuente con el mismo material–mes en una sola fila para el motor regresivo,
 * sumando demanda/buen backlog/produccion como en DemandWeeklyAdjustmentSection (donde cada fila fina
 * aporta). Sin esto, Map.set pisaba la ultima fila y subcontaba frente al total del ajuste de presupuesto.
 *
 * Metadatos internos _merge* se eliminan antes del loop principal.
 */
function accumulateMaterialMonthRow(prev: any | undefined, r: any, isC1000: boolean): any {
  const demVenta = safeNumber(r.UnidadesProyectado);
  const demTrasladoPlan = isC1000 ? safeNumber(r._envioC2000Plan ?? r._envioC2000) : 0;
  const prodViable = safeNumber(r._prodViable);
  const backlogVentas = safeNumber(r._backlogVentas);
  const tupp = safeNumber(r.tiempoUnitarioPorPuesto);

  if (!prev) {
    const demTotal = demVenta + demTrasladoPlan;
    return {
      ...r,
      _demandaMes: demTotal,
      _demandaVenta: demVenta,
      _trasladoSalienteC2000: isC1000 ? demTrasladoPlan : 0,
      _prodBase: prodViable,
      _prodAdelantada: 0,
      _prodRecuperada: 0,
      _backlogIdentificado: backlogVentas,
      _tupp: tupp,
      _mergeProdSum: prodViable,
      _mergeTuppNumerator: prodViable * tupp,
      _mergeMaxProdForLine: prodViable,
      StockActual: Math.max(0, safeNumber(r.StockActual)),
    };
  }

  const nextDemVenta = safeNumber(prev._demandaVenta) + demVenta;
  const nextTraslado = safeNumber(prev._trasladoSalienteC2000) + demTrasladoPlan;
  const nextProd = safeNumber(prev._prodBase) + prodViable;
  const nextBacklog = safeNumber(prev._backlogIdentificado) + backlogVentas;
  const nextProdSum = safeNumber(prev._mergeProdSum) + prodViable;
  const nextTuppNum = safeNumber(prev._mergeTuppNumerator) + prodViable * tupp;
  const mergedTupp = nextProdSum > 0 ? nextTuppNum / nextProdSum : safeNumber(prev._tupp);

  const dominant = safeNumber(prev._mergeMaxProdForLine);
  const incomingWinsLine = prodViable > dominant;
  const lineaRef = incomingWinsLine ? r.lineaRef : prev.lineaRef;
  const LineaFabricacion = incomingWinsLine ? r.LineaFabricacion : prev.LineaFabricacion;
  const maxProd = Math.max(dominant, prodViable);

  const demTotal = isC1000 ? nextDemVenta + nextTraslado : nextDemVenta;

  return {
    ...prev,
    lineaRef,
    LineaFabricacion,
    UnidadesProyectado: nextDemVenta,
    StockActual: Math.max(safeNumber(prev.StockActual), safeNumber(r.StockActual)),
    _demandaMes: demTotal,
    _demandaVenta: nextDemVenta,
    _trasladoSalienteC2000: isC1000 ? nextTraslado : 0,
    _prodBase: nextProd,
    _prodAdelantada: 0,
    _prodRecuperada: 0,
    _backlogIdentificado: nextBacklog,
    _tupp: mergedTupp,
    _mergeProdSum: nextProdSum,
    _mergeTuppNumerator: nextTuppNum,
    _mergeMaxProdForLine: maxProd,
  };
}

/** Filas finales del backlog regresivo (una por material–mes), mismos campos que usa la tabla. */
export function computeBacklogRegressiveFinalRows({
  data,
  tiemposCanon,
  centro,
  maxExtrasHoras,
  horasExtrasFin,
  trasladosViables,
  pioMap,
}: ComputeBacklogRegressiveParams): any[] {
  if (!data || data.length === 0) return [];

  const viableCantidadMap = buildViableCantidadMap(trasladosViables);

  const isC1000 = centro === '1000';
  const timeline = Array.from(
    new Set(
      data.map(r => {
        const year = safeNumber(r.Año || r.año || new Date().getFullYear());
        const mesNum = getMesNumericoRegressive(r.mesRef || r.Mes);
        return year * 12 + (mesNum - 1);
      })
    )
  ).sort((a, b) => a - b);

  const tcMap = new Map<string, TiempoCanonResult>();
  tiemposCanon.forEach(tc => {
    tcMap.set(String(tc.mesNumero), tc);
    tcMap.set(tc.mes, tc);
  });

  const rowsByMaterialMonth = new Map<string, any>();
  data.forEach(r => {
    const code = normalizeMaterialCode(r.CodMaterial);
    const year = safeNumber(r.Año || r.año || new Date().getFullYear());
    const mesNum = getMesNumericoRegressive(r.mesRef || r.Mes);
    const key = `${code}|${year}|${mesNum}`;
    const merged = accumulateMaterialMonthRow(rowsByMaterialMonth.get(key), r, isC1000);
    rowsByMaterialMonth.set(key, merged);
  });

  for (const row of rowsByMaterialMonth.values()) {
    delete row._mergeProdSum;
    delete row._mergeTuppNumerator;
    delete row._mergeMaxProdForLine;
  }

  const idleTimeByLineMonth = new Map<string, number>();
  timeline.forEach(tKey => {
    const year = Math.floor(tKey / 12);
    const mesNum = (tKey % 12) + 1;
    const tc = tcMap.get(String(mesNum));
    if (!tc) return;

    const lineasProcesadas = new Set<string>();
    data.forEach(r => {
      const linea = String(r.lineaRef || r.LineaFabricacion || 'Sin línea');
      const lKey = `${linea}|${year}|${mesNum}`;
      if (lineasProcesadas.has(lKey)) return;
      lineasProcesadas.add(lKey);

      const lineaNorm = String(linea).toLowerCase().replace(/\s+/g, '');
      const dp = tc.data.find((item: any) => {
        const nl = String(item?.nombre_linea ?? '')
          .toLowerCase()
          .replace(/\s+/g, '');
        return nl === lineaNorm || nl.includes(lineaNorm);
      });

      const capBase = safeNumber(dp?.minutos_horario_normal_TOTAL || 0);
      const capExtras =
        tc.diasLaborables * maxExtrasHoras * 60 + tc.diasSabados * horasExtrasFin * 60;
      const totalMinutos = capBase + capExtras;

      const minutesUsedBase = data
        .filter(
          row =>
            String(row.lineaRef || row.LineaFabricacion) === linea &&
            getMesNumericoRegressive(row.mesRef || row.Mes) === mesNum
        )
        .reduce(
          (sum, row) => sum + safeNumber(row._prodViable) * safeNumber(row.tiempoUnitarioPorPuesto),
          0
        );

      idleTimeByLineMonth.set(lKey, Math.max(0, totalMinutos - minutesUsedBase));
    });
  });

  const materials = Array.from(new Set(data.map(r => normalizeMaterialCode(r.CodMaterial))));

  // Corrección 2: ordenar materiales por PromDiario desc para que alta rotación tenga
  // prioridad en el idle del loop regresivo (adelanto de backlog) igual que en PIO.
  if (pioMap && pioMap.size > 0) {
    materials.sort((a, b) => {
      const pa = pioMap.get(`${a}|${centro}`)?.promDiario ?? 0;
      const pb = pioMap.get(`${b}|${centro}`)?.promDiario ?? 0;
      return pb - pa;
    });
  }

  materials.forEach(code => {
    for (let i = timeline.length - 1; i >= 0; i--) {
      const tKey = timeline[i];
      const year = Math.floor(tKey / 12);
      const mesNum = (tKey % 12) + 1;
      const currentKey = `${code}|${year}|${mesNum}`;
      const row = rowsByMaterialMonth.get(currentKey);

      if (!row) continue;

      let backlogAFijar = row._backlogIdentificado;

      if (backlogAFijar > 0) {
        for (let j = i - 1; j >= 0 && backlogAFijar > 0; j--) {
          const prevTKey = timeline[j];
          const pYear = Math.floor(prevTKey / 12);
          const pMesNum = (prevTKey % 12) + 1;
          const prevRowKey = `${code}|${pYear}|${pMesNum}`;
          const prevRow = rowsByMaterialMonth.get(prevRowKey);

          if (!prevRow || prevRow._tupp <= 0) continue;

          const lKey = `${prevRow.lineaRef || prevRow.LineaFabricacion || 'Sin línea'}|${pYear}|${pMesNum}`;
          const availableMin = idleTimeByLineMonth.get(lKey) || 0;

          if (availableMin > 0) {
            const unitsToAdelantar = Math.min(
              backlogAFijar,
              Math.floor(availableMin / prevRow._tupp)
            );
            if (unitsToAdelantar > 0) {
              prevRow._prodAdelantada += unitsToAdelantar;
              idleTimeByLineMonth.set(lKey, availableMin - unitsToAdelantar * prevRow._tupp);
              backlogAFijar -= unitsToAdelantar;
            }
          }
        }
      }
    }
  });

  const stockTracker = new Map<string, number>();
  const backlogVentasByMat = new Map<string, number>();
  const backlogTrasladoByMat = new Map<string, number>();
  const backlogC2000ByMat = new Map<string, number>();
  const finalData: any[] = [];

  for (const tKey of timeline) {
    const year = Math.floor(tKey / 12);
    const mesNum = (tKey % 12) + 1;

    materials.forEach(code => {
      const key = `${code}|${year}|${mesNum}`;
      const r = rowsByMaterialMonth.get(key);
      if (!r) return;

      const initialStock = stockTracker.get(code) ?? safeNumber(r.StockActual);
      const demVenta = safeNumber(r._demandaVenta);
      const demTrasladoPlan = safeNumber(r._trasladoSalienteC2000);

      let prodRecuperada = 0;
      const lKey = `${r.lineaRef || r.LineaFabricacion || 'Sin línea'}|${year}|${mesNum}`;
      const minutesLeft = idleTimeByLineMonth.get(lKey) || 0;

      let despachosReales = 0;
      let despachosVentas = 0;
      let despachosTraslado = 0;
      let backlogFinalVentas = 0;
      let backlogFinalTraslado = 0;
      let backlogFinal = 0;
      let backlogPasadoVentas = 0;
      let backlogPasadoTraslado = 0;
      let backlogPasadoTotal = 0;

      if (isC1000) {
        backlogPasadoVentas = backlogVentasByMat.get(code) || 0;
        backlogPasadoTraslado = backlogTrasladoByMat.get(code) || 0;
        backlogPasadoTotal = backlogPasadoVentas + backlogPasadoTraslado;

        if (backlogPasadoTotal > 0 && r._tupp > 0 && minutesLeft > 0) {
          const unitsPossible = Math.min(backlogPasadoTotal, Math.floor(minutesLeft / r._tupp));
          prodRecuperada = unitsPossible;
          idleTimeByLineMonth.set(lKey, minutesLeft - prodRecuperada * r._tupp);
        }

        const prodTotal = r._prodBase + r._prodAdelantada + prodRecuperada;
        const viableCantidad = safeNumber(viableCantidadMap.get(`${code}|${mesNum}`) ?? 0);

        const disponibleTotal = initialStock + prodTotal;
        const needV = demVenta + backlogPasadoVentas;
        const needT = demTrasladoPlan + backlogPasadoTraslado;

        despachosVentas = Math.min(disponibleTotal, needV);
        const rem = Math.max(0, disponibleTotal - despachosVentas);
        despachosTraslado = Math.min(rem, needT);
        despachosReales = despachosVentas + despachosTraslado;
        const trasladoConsistente = Math.abs(despachosTraslado - viableCantidad) < 0.5;

        backlogFinalVentas = Math.max(0, needV - despachosVentas);
        backlogFinalTraslado = Math.max(0, needT - despachosTraslado);
        backlogFinal = backlogFinalVentas + backlogFinalTraslado;
        const finalStock = Math.max(0, disponibleTotal - despachosReales);

        // Correcciones 3, 4, 5: PIO consume idle restante post-backlog, propaga al siguiente mes
        let prodPio = 0;
        let idleParaPIO = idleTimeByLineMonth.get(lKey) || 0;
        const pioEntry = pioMap?.get(`${code}|${centro}`);
        if (pioEntry && r._tupp > 0 && idleParaPIO > 0) {
          const maxAdicional = Math.max(0, pioEntry.invObjetivo - finalStock);
          if (maxAdicional > 0) {
            prodPio = Math.min(maxAdicional, Math.floor(idleParaPIO / r._tupp));
            idleTimeByLineMonth.set(lKey, idleParaPIO - prodPio * r._tupp);
          }
        }
        const finalStockConPIO = finalStock + prodPio;

        stockTracker.set(code, finalStockConPIO);
        backlogVentasByMat.set(code, backlogFinalVentas);
        backlogTrasladoByMat.set(code, backlogFinalTraslado);

        finalData.push({
          ...r,
          mesNombre: MONTH_NAMES[mesNum],
          _mesNumero: mesNum,
          _anioFila: year,
          _stockInitial: initialStock,
          _trasladoEntranteDesdeC1000: 0,
          _trasladoIntercentroConsistente: trasladoConsistente,
          _prodBase: r._prodBase,
          _prodRecuperada: prodRecuperada,
          _prodViableTotal: prodTotal + prodPio,
          _prodObjetivoInventario: prodPio,
          _backlogPasado: backlogPasadoTotal,
          _backlogPasadoVentas: backlogPasadoVentas,
          _backlogPasadoTraslado: backlogPasadoTraslado,
          _backlogFuturo: r._backlogIdentificado - (r._prodAdelantada > 0 ? r._prodAdelantada : 0),
          _despachosReales: despachosReales,
          _despachosVentas: despachosVentas,
          _despachosTraslado: despachosTraslado,
          _backlogFinal: backlogFinal,
          _backlogFinalVentas: backlogFinalVentas,
          _backlogFinalTraslado: backlogFinalTraslado,
          _saldoFinal: finalStockConPIO,
        });
      } else {
        const backlogPasado = backlogC2000ByMat.get(code) || 0;

        if (backlogPasado > 0 && r._tupp > 0 && minutesLeft > 0) {
          const unitsPossible = Math.min(backlogPasado, Math.floor(minutesLeft / r._tupp));
          prodRecuperada = unitsPossible;
          idleTimeByLineMonth.set(lKey, minutesLeft - prodRecuperada * r._tupp);
        }

        const prodTotal = r._prodBase + r._prodAdelantada + prodRecuperada;
        const viableCantidad = safeNumber(viableCantidadMap.get(`${code}|${mesNum}`) ?? 0);
        const trRecibido = viableCantidad;
        const trasladoConsistente = Math.abs(trRecibido - viableCantidad) < 0.5;

        const disponibleTotal = initialStock + prodTotal + trRecibido;
        despachosReales = Math.min(disponibleTotal, r._demandaMes + backlogPasado);
        backlogFinal = Math.max(0, r._demandaMes + backlogPasado - despachosReales);
        const finalStock = Math.max(0, disponibleTotal - despachosReales);

        // Correcciones 3, 4, 5: PIO consume idle restante post-backlog, propaga al siguiente mes
        let prodPio = 0;
        let idleParaPIO = idleTimeByLineMonth.get(lKey) || 0;
        const pioEntry = pioMap?.get(`${code}|${centro}`);
        if (pioEntry && r._tupp > 0 && idleParaPIO > 0) {
          const maxAdicional = Math.max(0, pioEntry.invObjetivo - finalStock);
          if (maxAdicional > 0) {
            prodPio = Math.min(maxAdicional, Math.floor(idleParaPIO / r._tupp));
            idleTimeByLineMonth.set(lKey, idleParaPIO - prodPio * r._tupp);
          }
        }
        const finalStockConPIO = finalStock + prodPio;

        stockTracker.set(code, finalStockConPIO);
        backlogC2000ByMat.set(code, backlogFinal);

        despachosVentas = despachosReales;
        despachosTraslado = 0;
        backlogFinalVentas = backlogFinal;
        backlogFinalTraslado = 0;

        finalData.push({
          ...r,
          mesNombre: MONTH_NAMES[mesNum],
          _mesNumero: mesNum,
          _anioFila: year,
          _stockInitial: initialStock,
          _trasladoEntranteDesdeC1000: trRecibido,
          _trasladoIntercentroConsistente: trasladoConsistente,
          _prodBase: r._prodBase,
          _prodRecuperada: prodRecuperada,
          _prodViableTotal: prodTotal + prodPio,
          _prodObjetivoInventario: prodPio,
          _backlogPasado: backlogPasado,
          _backlogPasadoVentas: backlogPasado,
          _backlogPasadoTraslado: 0,
          _backlogFuturo: r._backlogIdentificado - (r._prodAdelantada > 0 ? r._prodAdelantada : 0),
          _despachosReales: despachosReales,
          _despachosVentas: despachosVentas,
          _despachosTraslado: despachosTraslado,
          _backlogFinal: backlogFinal,
          _backlogFinalVentas: backlogFinalVentas,
          _backlogFinalTraslado: backlogFinalTraslado,
          _saldoFinal: finalStockConPIO,
        });
      }
    });
  }

  return finalData;
}
