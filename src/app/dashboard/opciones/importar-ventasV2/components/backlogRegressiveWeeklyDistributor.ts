import type { WeekSegment } from '../../plan-semanal/components/types';
import { MONTH_NAMES } from './constants';
import { safeNumber } from './utils';

export interface WeeklyMetricMap {
  [weekKey: string]: number;
}

export interface WeeklyBacklogRow {
  id: string;
  centro: string;
  anio: number;
  mesNumero: number;
  mesNombre: string;
  sector: string;
  linea: string;
  material: string;
  descripcion: string;
  totalMensual: number;
  semanal: WeeklyMetricMap;
}

function getDaysWeight(seg: WeekSegment, activeSatKeys: Set<string>): number {
  const sat = seg.tieneSabado && activeSatKeys.has(seg.satKey) ? 1 : 0;
  return seg.diasLaborales + sat;
}

function splitMonthlyAcrossWeeks(
  total: number,
  segments: WeekSegment[],
  activeSatKeys: Set<string>
): WeeklyMetricMap {
  const out: WeeklyMetricMap = {};
  if (!segments.length) return out;

  const weights = segments.map(seg => ({ weekKey: seg.weekKey, w: getDaysWeight(seg, activeSatKeys) }));
  const totalWeight = weights.reduce((sum, it) => sum + it.w, 0);
  if (totalWeight <= 0) return out;

  const raw = weights.map(it => {
    const exact = (total * it.w) / totalWeight;
    const base = Math.floor(exact);
    return { ...it, exact, base, frac: exact - base };
  });

  let remainder = Math.round(total - raw.reduce((sum, it) => sum + it.base, 0));
  raw.sort((a, b) => b.frac - a.frac);
  for (let i = 0; i < raw.length && remainder > 0; i += 1) {
    raw[i].base += 1;
    remainder -= 1;
  }

  for (const it of raw) out[it.weekKey] = it.base;
  return out;
}

export function buildWeeklyBacklogRows(
  rows: any[],
  segments: WeekSegment[],
  activeSatKeys: Set<string>
): WeeklyBacklogRow[] {
  const out: WeeklyBacklogRow[] = [];

  rows.forEach((r: any, idx: number) => {
    const anio = safeNumber(r._anioFila ?? r.Año ?? r.año);
    const mesNumero = safeNumber(r._mesNumero);
    if (!anio || !mesNumero) return;

    const monthSegs = segments.filter(s => s.anio === anio && s.mes === mesNumero);
    if (!monthSegs.length) return;

    const totalMensual = safeNumber(r._backlogFinal ?? 0);
    const semanal = splitMonthlyAcrossWeeks(totalMensual, monthSegs, activeSatKeys);

    out.push({
      id: `${r.Centro || r.centro || ''}|${r.CodMaterial || ''}|${anio}|${mesNumero}|${idx}`,
      centro: String(r.Centro || r.centro || ''),
      anio,
      mesNumero,
      mesNombre: String(r.mesNombre || MONTH_NAMES[mesNumero] || `Mes ${mesNumero}`),
      sector: String(r.Sector || ''),
      linea: String(r.lineaRef || r.LineaFabricacion || 'Sin línea'),
      material: String(r.CodMaterial || ''),
      descripcion: String(r.Descripcion || r.descripcion || ''),
      totalMensual,
      semanal,
    });
  });

  return out;
}
