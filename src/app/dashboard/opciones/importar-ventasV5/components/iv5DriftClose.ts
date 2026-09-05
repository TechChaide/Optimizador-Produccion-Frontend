/**
 * Etapa 5b IV5 - Cierre de drift week-vs-month.
 *
 * Tras la mini-pasada PIO y el recorte por tope agregado, recalcula el balance
 * semanal de cada material asegurando la identidad:
 *   StockFinal_t = StockInicial_t + ProduccionTotal_t + TraslEntrante_t
 *                  - Despachos_t - TraslSaliente_t
 *
 * Por que aparecen diferencias:
 *  a) Redondeo del prorrateo proporcional: +-1 ud por semana.
 *  b) Propagacion de PIO: runIv5MonthlyPio actualiza row.stockFinal de la
 *     ultima semana del mes, pero NO actualiza row.stockInicial de las
 *     semanas siguientes. DriftClose recalcula la cadena con el stock
 *     correcto (incluye PIO), y cuando hay demanda alta ese stock extra
 *     se convierte en MENOS backlog (no en mas stock). Esto genera dos
 *     fuentes de diferencia "esperada": herencia de stock Y herencia de
 *     backlog, que son las dos caras del mismo fenomeno PIO.
 *
 * Identidad de conservacion para detectar drifts genuinos:
 *   Para C2000 (sin traslado saliente), la ley de conservacion garantiza:
 *     (stockFinal_D - stockFinal_P) - (backlogFinal_D - backlogFinal_P)
 *       == (stockPrev - row.stockInicial) - (backlogPrev - row.backlogInicial)
 *   cuando el UNICO origen de la diferencia es la herencia PIO.
 *   Cualquier desvio de esta identidad es un error genuino.
 *   Para C1000 la misma formula aplica con buena aproximacion.
 *
 * Solo se reporta si unexplainedDrift = |totalDrift - totalInheritance| > 1.5.
 */

import type { Centro, Iv5DiagnosticEntry, Iv5WeeklyRow, MaterialKey } from './iv5Types';
import { splitDespachoC1000 } from './iv5Progressive';

export function runIv5DriftClose(ledger: Iv5WeeklyRow[]): Iv5DiagnosticEntry[] {
  const diagnostics: Iv5DiagnosticEntry[] = [];
  if (ledger.length === 0) return diagnostics;

  /**
   * Orden cronologico estable: el calendario de plan puede partir una misma
   * semana ISO en dos segmentos (weekKey distinto con mismo isoYear/isoWeek).
   * Ordenar solo por isoWeek mezcla esos segmentos y rompe la cadena de stock
   * (diferencias que suelen aparecer desde el primer mes con semana partida).
   * El orden de emision del ledger ya coincide con la progresiva; lo usamos.
   */
  type Bucket = { centro: Centro; material: MaterialKey; rows: { row: Iv5WeeklyRow; ledgerIdx: number }[] };
  const groups = new Map<string, Bucket>();
  ledger.forEach((r, ledgerIdx) => {
    const k = `${r.centro}|${r.material}`;
    let g = groups.get(k);
    if (!g) {
      g = { centro: r.centro, material: r.material, rows: [] };
      groups.set(k, g);
    }
    g.rows.push({ row: r, ledgerIdx });
  });

  for (const g of groups.values()) {
    g.rows.sort((a, b) => a.ledgerIdx - b.ledgerIdx);

    const rows = g.rows.map((x) => x.row);
    // Recalcula stockFinal/backlogFinal en cadena para asegurar la identidad.
    let stockPrev = rows[0]?.stockInicial ?? 0;
    let backlogPrev = rows[0]?.backlogInicial ?? 0;
    for (const row of rows) {
      // Mantiene los valores de demanda/produccion/traslado intactos.
      const prodTotal = row.produccionBase + row.produccionAlternativa + row.produccionAdelanto + row.produccionPio;
      const dispDisp = stockPrev + prodTotal + row.trasladoEntrante;
      // Politica proporcional pura: C1000 reparte el disponible entre ventas
      // propias y traslado saliente con el mismo helper que usa la progresiva.
      // C2000 solo despacha ventas. Esto evita que el cierre vuelva a sesgar
      // "propio primero" y rompa el split del prorrateo.
      let despachosV: number;
      let trasladoS: number;
      if (row.centro === '1000') {
        const split = splitDespachoC1000(
          dispDisp,
          row.demanda + backlogPrev,
          row.necesidadTrasladoSemana,
        );
        despachosV = split.despachosVentas;
        trasladoS = split.trasladoSaliente;
      } else {
        despachosV = Math.min(dispDisp, row.demanda + backlogPrev);
        trasladoS = 0;
      }
      const stockFinal = Math.max(0, dispDisp - despachosV - trasladoS);
      const backlogFinal = Math.max(0, row.demanda + backlogPrev - despachosV);

      // Identidad de conservacion: totalDrift == totalInheritance cuando la
      // unica fuente de divergencia es la herencia PIO (stock o backlog).
      //   totalDrift       = signedDriftStock - signedDriftBacklog
      //   totalInheritance = inheritedCorrection - backlogInheritance
      // Cualquier desvio de esa identidad es un error genuino.
      // Absorbe correctamente tanto la herencia de stock como la conversion
      // stock->backlog que ocurre cuando el PIO extra es consumido por demanda alta.
      const inheritedCorrection = stockPrev - row.stockInicial;
      const backlogInheritance  = backlogPrev - row.backlogInicial;
      const signedDriftStock    = stockFinal - row.stockFinal;
      const signedDriftBacklog  = backlogFinal - row.backlogFinal;
      const totalInheritance    = inheritedCorrection - backlogInheritance;
      const totalDrift          = signedDriftStock - signedDriftBacklog;
      const unexplainedDrift    = Math.abs(totalDrift - totalInheritance);
      if (unexplainedDrift > 1.5) {
        diagnostics.push({
          severity: 'warn',
          centro: row.centro,
          mes: row.mes,
          anio: row.anio,
          isoWeek: row.isoWeek,
          isoYear: row.isoYear,
          linea: row.linea,
          material: row.material,
          code: 'DRIFT_WEEK_VS_MONTH',
          mensaje: `Drift cerrado: stock ${row.stockFinal} -> ${stockFinal}, backlog ${row.backlogFinal} -> ${backlogFinal}.`,
          data: { unexplainedDrift, totalDrift, totalInheritance, inheritedCorrection, backlogInheritance },
        });
      }
      // Aplica los valores cerrados.
      row.stockInicial = stockPrev;
      row.backlogInicial = backlogPrev;
      row.despachosVentas = despachosV;
      row.trasladoSaliente = trasladoS;
      row.stockFinal = stockFinal;
      row.backlogGenerado = backlogFinal;
      row.backlogFinal = backlogFinal;
      row.alertaStockBajoSeguridad = stockFinal < row.stockSeguridad;

      stockPrev = stockFinal;
      backlogPrev = backlogFinal;
    }
  }

  return diagnostics;
}
