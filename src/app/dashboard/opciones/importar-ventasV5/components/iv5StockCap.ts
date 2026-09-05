/**
 * Etapa 5a IV5 - Validacion del tope agregado de stock por sectores.
 *
 * Regla del usuario (Q16):
 *  - Centro 1000: stockFinal sumado de sectores 01 + 02 + 03 <= 19500.
 *  - Centro 2000: stockFinal sumado de sectores 01 + 02 + 03 <= 12500.
 *  Defaults parametrizables desde la UI (Iv5StockCapEditor).
 *
 * Se valida AL CIERRE DE CADA SEMANA. Si el tope se viola, se recorta
 * proporcional al **tiempo-equivalente del anticipo pendiente** (Q17/Q22).
 *
 * Implementacion:
 *  - Para cada (centro, weekKey) calcula `stockSectoresAplicables` sumando
 *    stockFinal de filas cuyo `sectorRef` empieza con uno de
 *    `stockCap.sectoresAplicables`.
 *  - Si excede el tope, ordena las filas que aportan stock excedente con
 *    mas peso al `produccionAdelanto` (anticipo) y reduce la produccion
 *    proporcional al tiempo equivalente: cada uds reducida libera
 *    `tupp * uds` minutos a la capacidad correspondiente.
 *  - Refresca stockFinal y emite alerta TOPE_AGREGADO_RECORTADO.
 *  - Si tras los recortes aun excede el tope (caso muy raro de stock
 *    inicial > tope), emite alerta TOPE_AGREGADO_EXCEDIDO sin tocar el dato.
 */

import { safeNumber } from '../../importar-ventasV2/components/utils';
import type { Centro, Iv5DiagnosticEntry, Iv5StockCap, Iv5WeeklyRow } from './iv5Types';
import { type Iv5CapacityMatrix, getCapacityCell } from './iv5Capacity';

function leadingSectorCode(sector: string): string {
  const t = String(sector ?? '').trim();
  const m = t.match(/^(\d+)/);
  return m ? m[1].padStart(2, '0') : '';
}

interface RunStockCapParams {
  centro: Centro;
  ledger: Iv5WeeklyRow[];
  capacity: Iv5CapacityMatrix;
  stockCap: Iv5StockCap;
}

export function runIv5StockCap(params: RunStockCapParams): {
  diagnostics: Iv5DiagnosticEntry[];
} {
  const { centro, ledger, capacity, stockCap } = params;
  const diagnostics: Iv5DiagnosticEntry[] = [];

  const tope = centro === '1000' ? stockCap.centro1000 : centro === '2000' ? stockCap.centro2000 : Infinity;
  if (!Number.isFinite(tope) || tope <= 0) return { diagnostics };
  const sectoresAplicables = new Set(stockCap.sectoresAplicables.map((s) => s.padStart(2, '0')));

  // Index por (anio, mes, isoYear, isoWeek) -> filas de las semanas.
  type WeekBucket = { weekKey: string; rows: Iv5WeeklyRow[] };
  const buckets = new Map<string, WeekBucket>();
  for (const row of ledger) {
    if (row.centro !== centro) continue;
    const k = row.weekKey;
    let b = buckets.get(k);
    if (!b) {
      b = { weekKey: k, rows: [] };
      buckets.set(k, b);
    }
    b.rows.push(row);
  }

  // Procesa weekKeys en orden cronologico. El recorte semana actual afecta
  // al stock inicial de la siguiente porque las filas del mismo material
  // comparten su rolling state via stockFinal -> stockInicial.
  const weekKeysOrdered = Array.from(buckets.values())
    .sort((a, b) => {
      const ra = a.rows[0];
      const rb = b.rows[0];
      if (!ra || !rb) return 0;
      if (ra.isoYear !== rb.isoYear) return ra.isoYear - rb.isoYear;
      return ra.isoWeek - rb.isoWeek;
    })
    .map((b) => b.weekKey);

  for (const weekKey of weekKeysOrdered) {
    const b = buckets.get(weekKey);
    if (!b) continue;
    const rowsAplican = b.rows.filter((r) => sectoresAplicables.has(leadingSectorCode(r.sectorRef)));
    let stockTotal = rowsAplican.reduce((s, r) => s + r.stockFinal, 0);
    if (stockTotal <= tope) continue;
    let exceso = stockTotal - tope;

    // Estrategia de recorte: priorizar filas con `produccionAdelanto > 0`
    // (anticipo regresivo), luego `produccionPio`, luego `produccionAlternativa`,
    // y como ultimo recurso `produccionBase`. La cuota se reparte proporcional
    // al tiempo-equivalente (uds * tupp) del componente que se recorta.
    const componentes: Array<keyof Iv5WeeklyRow> = [
      'produccionAdelanto',
      'produccionPio',
      'produccionAlternativa',
      'produccionBase',
    ];

    for (const comp of componentes) {
      if (exceso <= 0) break;
      const candidatos = rowsAplican.filter((r) => safeNumber(r[comp]) > 0);
      if (candidatos.length === 0) continue;
      const tiempos = candidatos.map((r) => Math.max(0, safeNumber(r[comp]) * r.tupp));
      const tiempoTotal = tiempos.reduce((a, b) => a + b, 0);
      if (tiempoTotal <= 0) continue;

      let recortadoEnPasada = 0;
      candidatos.forEach((r, idx) => {
        if (exceso <= 0) return;
        const peso = tiempos[idx] / tiempoTotal;
        const cuota = exceso * peso;
        const tupp = Math.max(0.0001, r.tupp);
        const udsActuales = Math.floor(safeNumber(r[comp]));
        const udsARecortar = Math.min(udsActuales, Math.ceil(cuota));
        if (udsARecortar <= 0) return;
        // Aplica recorte
        (r as any)[comp] = udsActuales - udsARecortar;
        r.stockFinal = Math.max(0, r.stockFinal - udsARecortar);
        const minsLiberados = udsARecortar * tupp;
        r.minUsados = Math.max(0, r.minUsados - minsLiberados);
        // Devuelve minutos a capacidad
        const cell = getCapacityCell(capacity, r.linea, r.weekKey);
        if (cell) {
          cell.minReservados = Math.max(0, cell.minReservados - minsLiberados);
          cell.minDisponibles = Math.min(cell.capTotal, cell.minDisponibles + minsLiberados);
        }
        // Actualiza idleSem visible
        r.idleSem = cell ? cell.minDisponibles : r.idleSem + minsLiberados;
        exceso -= udsARecortar;
        recortadoEnPasada += udsARecortar;
        diagnostics.push({
          severity: 'warn',
          centro,
          mes: r.mes,
          anio: r.anio,
          isoWeek: r.isoWeek,
          isoYear: r.isoYear,
          linea: r.linea,
          material: r.material,
          code: 'TOPE_AGREGADO_RECORTADO',
          mensaje: `Recorte ${udsARecortar} uds de ${String(comp)} para respetar tope ${tope} (${centro}).`,
          data: { componente: String(comp), udsRecortadas: udsARecortar },
        });
        // refresca alerta de stock seguridad
        r.alertaStockBajoSeguridad = r.stockFinal < r.stockSeguridad;
        r.alertaTopeAgregado = true;
      });
      if (recortadoEnPasada === 0) break;
    }

    if (exceso > 0) {
      // Sin produccion para recortar: emite alerta hard.
      const ref = rowsAplican[0];
      diagnostics.push({
        severity: 'error',
        centro,
        mes: ref?.mes,
        anio: ref?.anio,
        isoWeek: ref?.isoWeek,
        isoYear: ref?.isoYear,
        code: 'TOPE_AGREGADO_EXCEDIDO',
        mensaje: `Tope agregado (${tope}) excedido en ${exceso} uds; no hay produccion para recortar.`,
      });
      for (const r of rowsAplican) r.alertaTopeAgregado = true;
    } else {
      // Marca filas afectadas con la bandera (las que aportan stock al sector).
      stockTotal = rowsAplican.reduce((s, r) => s + r.stockFinal, 0);
      if (stockTotal > tope * 0.95) {
        for (const r of rowsAplican) r.alertaTopeAgregado = true;
      }
    }
  }

  return { diagnostics };
}
