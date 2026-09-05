import type { WeekSegment, PlanSemanalRow, SlimBacklogRow } from './types';

function safeNum(val: unknown): number {
  const n = Number(val);
  return isNaN(n) ? 0 : n;
}

/**
 * Distributes monthly slim backlog rows into weekly segments.
 * All monthly amounts (producción, despachos ventas, traslado) are
 * split proportionally by effective working days per week-segment.
 */
export function distributeToWeeks(
  finalRows: SlimBacklogRow[],
  segments: WeekSegment[],
  activeSatKeys: Set<string>,
): PlanSemanalRow[] {
  const result: PlanSemanalRow[] = [];

  for (const r of finalRows) {
    const mesNum  = safeNum(r._mesNumero);
    const anio    = safeNum(r._anioFila);
    const prodMes = safeNum(r._prodViableTotal);

    if (mesNum === 0 || anio === 0) continue;

    const rowSegs = segments.filter(s => s.mes === mesNum && s.anio === anio);
    if (rowSegs.length === 0) continue;

    // Total effective days for this month (considering active Saturdays)
    const totalDiasEfectivos = rowSegs.reduce((sum, s) => {
      const sat = s.tieneSabado && activeSatKeys.has(s.satKey) ? 1 : 0;
      return sum + s.diasLaborales + sat;
    }, 0);

    if (totalDiasEfectivos === 0) continue;

    // Monthly amounts to distribute proportionally
    const despVentasMes = safeNum(r._despachosVentas);
    // For C1000: traslado saliente; for C2000: traslado recibido
    const trasladoMes   = r.centro === '1000'
      ? safeNum(r._despachosTraslado)
      : safeNum(r._trasladoEntranteDesdeC1000);

    for (const seg of rowSegs) {
      const diasSat  = seg.tieneSabado && activeSatKeys.has(seg.satKey) ? 1 : 0;
      const diasEfec = seg.diasLaborales + diasSat;
      const factor   = diasEfec / totalDiasEfectivos;

      const cantSem       = Math.round(prodMes * factor);
      const cantDia       = diasEfec > 0 ? Math.round(cantSem / diasEfec) : 0;
      const despVentasSem = Math.round(despVentasMes * factor);
      const trasladoSem   = Math.round(trasladoMes * factor);

      result.push({
        weekKey:        seg.weekKey,
        satKey:         seg.satKey,
        isoWeek:        seg.isoWeek,
        isoYear:        seg.isoYear,
        mes:            seg.mes,
        anio:           seg.anio,
        diasLaborales:  seg.diasLaborales,
        tieneSabado:    seg.tieneSabado,
        label:          seg.label,
        CodMaterial:    r.CodMaterial,
        descripcion:    r.descripcion,
        mesNombre:      r.mesNombre,
        sector:         r.sector,
        linea:          r.linea,
        centro:         r.centro,
        cantidadMensual:       prodMes,
        cantidadSemanal:       cantSem,
        cantDiaria:            cantDia,
        diasEfectivos:         diasEfec,
        despachosVentasSemana: despVentasSem,
        stockInicial:          safeNum(r._stockInitial),
        trasladoSemana:        trasladoSem,
      });
    }
  }

  return result;
}

/**
 * Aggregates distribution rows to sector level for the adjustment pivot table.
 * Returns a map: sectorKey (`${centro}|${sector}`) → weekKey → cell data
 */
export function buildSectorPivot(
  rows: PlanSemanalRow[],
): Map<string, Map<string, { cantDiaria: number; cantSemanal: number; diasEfectivos: number }>> {
  const pivot = new Map<string, Map<string, { cantDiaria: number; cantSemanal: number; diasEfectivos: number }>>();

  for (const row of rows) {
    const sKey = `${row.centro}|${row.sector}`;
    if (!pivot.has(sKey)) pivot.set(sKey, new Map());
    const wMap = pivot.get(sKey)!;

    const prev = wMap.get(row.weekKey) ?? { cantDiaria: 0, cantSemanal: 0, diasEfectivos: row.diasEfectivos };
    wMap.set(row.weekKey, {
      cantDiaria:    0, // recomputed after aggregation
      cantSemanal:   prev.cantSemanal + row.cantidadSemanal,
      diasEfectivos: row.diasEfectivos,
    });
  }

  // Recompute cantDiaria from aggregated cantSemanal
  for (const wMap of pivot.values()) {
    for (const [wk, cell] of wMap.entries()) {
      wMap.set(wk, {
        ...cell,
        cantDiaria: cell.diasEfectivos > 0 ? Math.round(cell.cantSemanal / cell.diasEfectivos) : 0,
      });
    }
  }

  return pivot;
}

/**
 * Applies user-defined sector-level adjustments back to material rows proportionally.
 * When the user changes the daily average for a sector × week, all materials
 * in that sector are redistributed proportionally to the new total.
 */
export function applyAdjustments(
  baseRows: PlanSemanalRow[],
  ajustes: Map<string, Map<string, number>>, // sectorKey → weekKey → newCantDiaria
): PlanSemanalRow[] {
  // Original sector totals per weekKey (before adjustment)
  const sectorWeekTotals = new Map<string, number>(); // `${sectorKey}|${weekKey}` → cantSemanal
  for (const r of baseRows) {
    const k = `${r.centro}|${r.sector}|${r.weekKey}`;
    sectorWeekTotals.set(k, (sectorWeekTotals.get(k) || 0) + r.cantidadSemanal);
  }

  return baseRows.map(r => {
    const sKey  = `${r.centro}|${r.sector}`;
    const swKey = `${r.centro}|${r.sector}|${r.weekKey}`;
    const newDia = ajustes.get(sKey)?.get(r.weekKey);

    if (newDia === undefined) return r;

    const newSemanalSector  = newDia * r.diasEfectivos;
    const origSemanalSector = sectorWeekTotals.get(swKey) || 0;

    if (origSemanalSector === 0) return { ...r, cantidadSemanal: 0, cantDiaria: 0 };

    const proportion    = r.cantidadSemanal / origSemanalSector;
    const newSemanalMat = Math.round(newSemanalSector * proportion);
    const newDiaMat     = r.diasEfectivos > 0 ? Math.round(newSemanalMat / r.diasEfectivos) : 0;

    // Scale despachos and traslado by the same proportion
    const scaleFactor         = origSemanalSector > 0 ? newSemanalSector / origSemanalSector : 1;
    const newDespVentas       = Math.round(r.despachosVentasSemana * scaleFactor);
    const newTraslado         = Math.round(r.trasladoSemana * scaleFactor);

    return {
      ...r,
      cantidadSemanal:       newSemanalMat,
      cantDiaria:            newDiaMat,
      despachosVentasSemana: newDespVentas,
      trasladoSemana:        newTraslado,
    };
  });
}
