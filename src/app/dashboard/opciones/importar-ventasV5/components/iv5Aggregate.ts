/**
 * Agregacion semanal -> mensual IV5.
 *
 * Garantiza la identidad por mes:
 *   StockFinalMes = StockInicialMes + ProduccionTotal + TraslEntrantes
 *                   - Despachos - TraslSalientes
 *
 * StockInicialMes se toma del stockInicial de la primera semana del mes
 * para ese material; StockFinalMes del stockFinal de la ultima.
 *
 * Si un material deja de tener filas backend en un mes (sin necesidad
 * semanal), el ledger no trae semanas para ese mes aunque el stock siga
 * existiendo. Sin ajuste, las sumas agregadas de StockFinal(m) y
 * StockInicial(m+1) en Excel no cuadran. `fillMonthlyStockCarryGaps`
 * inserta meses "inventario plano" (flujos en 0, semanasContadas=0) con
 * StockIni=stockFin=arrastre cuando el arrastre es > 0. Si el mismo material
 * ya tiene snapshot real en **otra linea** ese mes (cambio de linea), no se
 * inserta sintetico en la linea vieja para evitar doble conteo en pivots
 * agregados solo por sector.
 */

import { getMesNombre } from '../../importar-ventasV2/components/utils';
import type { Centro, Iv5MonthlySnapshot, Iv5WeeklyRow, LineaKey, MaterialKey } from './iv5Types';

interface MonthBucket {
  centro: Centro;
  linea: LineaKey;
  material: MaterialKey;
  mes: number;
  anio: number;
  weekRows: Iv5WeeklyRow[];
}

function monthEpoch(anio: number, mes: number): number {
  return anio * 12 + mes;
}

function epochToAnioMes(e: number): { anio: number; mes: number } {
  const anio = Math.floor((e - 1) / 12);
  const mes = e - anio * 12;
  return { anio, mes };
}

function idleCarryMonthlySnapshot(s: {
  centro: Centro;
  linea: LineaKey;
  material: MaterialKey;
  anio: number;
  mes: number;
  sectorRef: string;
  descripcion: string;
  stock: number;
}): Iv5MonthlySnapshot {
  return {
    centro: s.centro,
    linea: s.linea,
    material: s.material,
    mes: s.mes,
    anio: s.anio,
    mesNombre: getMesNombre(s.mes),
    sectorRef: s.sectorRef,
    descripcion: s.descripcion,
    demanda: 0,
    necesidadTraslado: 0,
    demandaPlan: 0,
    despachosVentas: 0,
    produccionBase: 0,
    produccionAlternativa: 0,
    produccionAdelanto: 0,
    produccionPio: 0,
    produccionTotal: 0,
    trasladoSaliente: 0,
    trasladoEntrante: 0,
    stockInicialMes: s.stock,
    stockFinalMes: s.stock,
    backlogInicialMes: 0,
    backlogFinalMes: 0,
    capTotalMes: 0,
    capSabMes: 0,
    idleMes: 0,
    semanasContadas: 0,
    sabadosActivos: 0,
  };
}

/**
 * Completa meses sin snapshot para cada (centro, linea, material) cuando
 * aun hay inventario arrastrado (>0) dentro del rango de meses del horizonte.
 */
export function fillMonthlyStockCarryGaps(snapshots: Iv5MonthlySnapshot[]): Iv5MonthlySnapshot[] {
  if (snapshots.length === 0) return snapshots;
  const eMin = Math.min(...snapshots.map((s) => monthEpoch(s.anio, s.mes)));
  const eMax = Math.max(...snapshots.map((s) => monthEpoch(s.anio, s.mes)));

  /** Mes en que el material tiene datos reales de ledger (cualquier linea). */
  const matMesConSemanas = new Set<string>();
  for (const s of snapshots) {
    if (s.semanasContadas > 0) {
      matMesConSemanas.add(`${s.centro}|${s.material}|${monthEpoch(s.anio, s.mes)}`);
    }
  }

  const byKey = new Map<string, Iv5MonthlySnapshot[]>();
  for (const s of snapshots) {
    const k = `${s.centro}|${s.linea}|${s.material}`;
    const arr = byKey.get(k) ?? [];
    arr.push(s);
    byKey.set(k, arr);
  }
  const out: Iv5MonthlySnapshot[] = [];
  for (const arr of byKey.values()) {
    const byE = new Map<number, Iv5MonthlySnapshot>();
    for (const s of arr) byE.set(monthEpoch(s.anio, s.mes), s);
    let carry: number | null = null;
    let sectorRef = arr[0].sectorRef;
    let descripcion = arr[0].descripcion;
    const { centro, linea, material } = arr[0];
    for (let e = eMin; e <= eMax; e++) {
      const { anio, mes } = epochToAnioMes(e);
      const hit = byE.get(e);
      if (hit) {
        sectorRef = hit.sectorRef;
        descripcion = hit.descripcion;
        carry = hit.stockFinalMes;
        out.push(hit);
        continue;
      }
      if (carry !== null && carry > 0) {
        const matMesKey = `${centro}|${material}|${e}`;
        if (matMesConSemanas.has(matMesKey)) {
          // El stock del material ya va en otra linea este mes: no duplicar.
          carry = 0;
          continue;
        }
        out.push(
          idleCarryMonthlySnapshot({
            centro,
            linea,
            material,
            anio,
            mes,
            sectorRef,
            descripcion,
            stock: carry,
          }),
        );
      }
    }
  }
  return out.sort((a, b) => {
    if (a.centro !== b.centro) return a.centro.localeCompare(b.centro);
    if (a.anio !== b.anio) return a.anio - b.anio;
    if (a.mes !== b.mes) return a.mes - b.mes;
    if (a.sectorRef !== b.sectorRef) return a.sectorRef.localeCompare(b.sectorRef);
    if (a.linea !== b.linea) return a.linea.localeCompare(b.linea);
    return a.material.localeCompare(b.material);
  });
}

export function aggregateWeeklyToMonthly(ledger: Iv5WeeklyRow[]): Iv5MonthlySnapshot[] {
  const buckets = new Map<string, MonthBucket>();
  for (const row of ledger) {
    const key = `${row.centro}|${row.linea}|${row.material}|${row.anio}|${row.mes}`;
    let b = buckets.get(key);
    if (!b) {
      b = {
        centro: row.centro,
        linea: row.linea,
        material: row.material,
        mes: row.mes,
        anio: row.anio,
        weekRows: [],
      };
      buckets.set(key, b);
    }
    b.weekRows.push(row);
  }
  const out: Iv5MonthlySnapshot[] = [];
  for (const b of buckets.values()) {
    const ordered = [...b.weekRows].sort((a, b1) => {
      if (a.isoYear !== b1.isoYear) return a.isoYear - b1.isoYear;
      if (a.isoWeek !== b1.isoWeek) return a.isoWeek - b1.isoWeek;
      // Misma semana ISO puede partirse en dos segmentos (mes distinto); orden mes calendario.
      if (a.anio !== b1.anio) return a.anio - b1.anio;
      return a.mes - b1.mes;
    });
    const first = ordered[0];
    const last = ordered[ordered.length - 1];
    const sum = (key: keyof Iv5WeeklyRow): number =>
      ordered.reduce((s, r) => s + (Number(r[key]) || 0), 0);
    const sabadosActivos = ordered.reduce((s, r) => s + (r.sabadoActivo ? 1 : 0), 0);

    // Stock reservado y físico — solo si la fila los tiene (motor rediseñado)
    const tieneReservas = ordered.some((r) => r.stockReservado !== undefined);
    const stockReservadoMes = tieneReservas ? last.stockReservado ?? 0 : undefined;
    const stockFinalFisicoMes = tieneReservas
      ? (last.stockFinalFisico ?? last.stockFinal + (last.stockReservado ?? 0))
      : undefined;

    out.push({
      centro: b.centro,
      linea: b.linea,
      material: b.material,
      mes: b.mes,
      anio: b.anio,
      mesNombre: getMesNombre(b.mes),
      sectorRef: first.sectorRef,
      descripcion: first.descripcion,
      demanda: sum('demanda'),
      necesidadTraslado: sum('necesidadTrasladoSemana'),
      demandaPlan: sum('demanda') + sum('necesidadTrasladoSemana'),
      despachosVentas: sum('despachosVentas'),
      produccionBase: sum('produccionBase'),
      produccionAlternativa: sum('produccionAlternativa'),
      produccionAdelanto: sum('produccionAdelanto'),
      produccionPio: sum('produccionPio'),
      produccionTotal:
        sum('produccionBase') +
        sum('produccionAlternativa') +
        sum('produccionAdelanto') +
        sum('produccionPio'),
      trasladoSaliente: sum('trasladoSaliente'),
      trasladoEntrante: sum('trasladoEntrante'),
      stockInicialMes: first.stockInicial,
      stockFinalMes: last.stockFinal,
      backlogInicialMes: first.backlogInicial,
      backlogFinalMes: last.backlogFinal,
      capTotalMes: sum('capTotal'),
      capSabMes: sum('capSab'),
      idleMes: sum('idleSem'),
      semanasContadas: ordered.length,
      sabadosActivos,
      stockReservadoMes,
      stockFinalFisicoMes,
    });
  }

  return fillMonthlyStockCarryGaps(out);
}
