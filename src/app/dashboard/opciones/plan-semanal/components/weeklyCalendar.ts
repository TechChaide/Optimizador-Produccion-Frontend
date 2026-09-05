import type { WeekSegment } from './types';

const MONTH_SHORT = ['Ene','Feb','Mar','Abr','May','Jun','Jul','Ago','Sep','Oct','Nov','Dic'];

function getISOWeekYear(date: Date): { week: number; year: number } {
  const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
  const dayNum = d.getUTCDay() || 7; // Mon=1,...,Sun=7
  d.setUTCDate(d.getUTCDate() + 4 - dayNum); // Thursday of this ISO week
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
  const week = Math.ceil(((d.getTime() - yearStart.getTime()) / 86400000 + 1) / 7);
  return { week, year: d.getUTCFullYear() };
}

/**
 * Given a list of {mes, anio} pairs, returns all week-month segments.
 * A week that spans two months generates two separate segments (one per month).
 */
export function getWeekSegments(meses: Array<{ mes: number; anio: number }>): WeekSegment[] {
  const segMap = new Map<string, WeekSegment>();

  for (const { mes, anio } of meses) {
    const daysInMonth = new Date(anio, mes, 0).getDate();

    for (let day = 1; day <= daysInMonth; day++) {
      const date = new Date(anio, mes - 1, day);
      const dow = date.getDay(); // 0=Sun, 1=Mon,..., 6=Sat
      if (dow === 0) continue;  // skip Sunday

      const { week, year: isoYear } = getISOWeekYear(date);
      const weekKey = `${isoYear}W${week}|${anio}-${mes}`;
      const satKey  = `${isoYear}W${week}`;

      if (!segMap.has(weekKey)) {
        segMap.set(weekKey, {
          isoWeek: week,
          isoYear,
          mes,
          anio,
          diasLaborales: 0,
          tieneSabado: false,
          label: `Sem ${week} ${MONTH_SHORT[mes - 1]}`,
          weekKey,
          satKey,
        });
      }

      const seg = segMap.get(weekKey)!;
      if (dow >= 1 && dow <= 5) seg.diasLaborales++;
      if (dow === 6) seg.tieneSabado = true;
    }
  }

  return Array.from(segMap.values()).sort((a, b) => {
    if (a.isoYear !== b.isoYear) return a.isoYear - b.isoYear;
    if (a.isoWeek !== b.isoWeek) return a.isoWeek - b.isoWeek;
    if (a.anio !== b.anio) return a.anio - b.anio;
    return a.mes - b.mes;
  });
}
