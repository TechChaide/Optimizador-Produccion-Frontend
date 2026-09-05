/**
 * Orquestador IV5.
 *
 * En la Fase 2 ejecuta las etapas core:
 *  - Etapa 1 (regresiva semanal por linea fija): `runIv5Regressive`.
 *  - Etapa 3 (progresiva semanal): `runIv5Progressive`.
 *
 * En fases posteriores se enchufan en este mismo orquestador:
 *  - Etapa 0 (multi-linea todo-o-nada) -> Fase 5
 *  - Etapa 2 (alternativas residuales) -> Fase 5
 *  - Etapa 4 (mini-pasada PIO mensual) -> Fase 4
 *  - Etapa 5a (validacion de tope agregado) -> Fase 6
 *  - Etapa 5b (cierre de drift week vs month) -> Fase 7
 *
 * `runIv5Engine` es puro: no toca DOM, no muta inputs externos, devuelve
 * `Iv5RunResult` para que la UI lo renderice.
 */

import type { WeekSegment } from '../../plan-semanal/components/types';
import type { TiempoCanonResult, PioMap } from '../../importar-ventasV2/components/types';

import type {
  Centro,
  Iv5DiagnosticEntry,
  Iv5RunResult,
  Iv5WeeklyRow,
  Iv5StockCap,
  MaterialKey,
  WeekKey,
} from './iv5Types';
import { buildIv5Capacity } from './iv5Capacity';
import { buildIv5Needs } from './iv5Necesidad';
import { runIv5Regressive } from './iv5Regressive';
import { runIv5Progressive } from './iv5Progressive';
import { runIv5MonthlyPio } from './iv5MonthlyPio';
import { runIv5StockCap } from './iv5StockCap';
import { runIv5DriftClose } from './iv5DriftClose';
import { aggregateWeeklyToMonthly } from './iv5Aggregate';
import {
  buildAlternativeLines,
  buildNeedsByLineMaterialMin,
  buildNeedsByLineWeekMaterial,
  runIv5AlternativasResiduales,
  runIv5PreEtapaTodoONada,
} from './iv5MultiLine';

export interface Iv5EngineParams {
  centro: Centro;
  weekSegments: WeekSegment[];
  effectiveData: any[];
  tiemposCanon: TiempoCanonResult[];
  activeSatKeys: Set<string>;
  horasTrabajo: number;
  maxExtrasHoras: number;
  horasExtrasFin: number;
  pioMap: PioMap;
  stockCap: Iv5StockCap;
  maxSabadosMes: number;
  /**
   * Solo aplica a centro=2000. Mapa (material|weekKey) -> uds que arribaran
   * desde C1000 en esa semana. Sale de la corrida previa de C1000:
   * `aggregateTrasladoSalienteFromLedger(ledgerC1000)`.
   *
   * El progressive lo usa para sumar al disponible de C2000 (cubrir demanda
   * clase F sin reservar capacidad propia). En C1000 debe quedar `undefined`.
   */
  trasladoEntranteByMatWeek?: Map<string, number>;
  /**
   * Solo aplica a centro=1000. Mapa (material|weekKey) -> uds que C2000
   * necesita recibir como traslado. Si esta definido, REEMPLAZA el calculo
   * por defecto de "demanda bruta clase F" y permite que C1000 reserve
   * capacidad para:
   *   - Clase F: solo el deficit real (no la demanda bruta).
   *   - Clase X/E: el faltante cuando la capacidad propia de C2000 no
   *     alcanza la necesidad.
   * Lo construye `computeC2000Deficits` antes de ejecutar el motor C1000.
   */
  deficitC2000ByMatWeek?: Map<string, number>;
}

/**
 * Construye el motor IV5 base (regresiva + progresiva) para un centro y
 * devuelve ledger semanal, snapshots mensuales y diagnostico.
 *
 * Esta es la API publica del motor. La UI llamara dos veces (2000 y 1000) y
 * encadenara la necesidad de traslado calculada en 2000 hacia 1000.
 */
export function runIv5Engine(params: Iv5EngineParams): Iv5RunResult {
  const {
    centro,
    weekSegments,
    effectiveData,
    tiemposCanon,
    activeSatKeys,
    maxExtrasHoras,
    horasExtrasFin,
    pioMap,
    trasladoEntranteByMatWeek,
    deficitC2000ByMatWeek,
  } = params;

  const diagnostics: Iv5DiagnosticEntry[] = [];
  if (!weekSegments.length) {
    return { centro, ledger: [], monthly: [], diagnostics };
  }

  const needsBundle = buildIv5Needs({
    centro,
    effectiveData,
    weekSegments,
    pioMap,
    deficitC2000ByMatWeek: centro === '1000' ? deficitC2000ByMatWeek : undefined,
  });

  // Lineas alternativas detectadas en el dataset crudo (sin endpoints adicionales).
  const alternatives = buildAlternativeLines(effectiveData, centro, needsBundle.metas);

  // Inicialmente la capacidad incluye TODAS las lineas (fijas + alternativas)
  // para que las etapas 0 y 2 puedan reservar minutos en alternativas.
  const allLineas = new Set<string>(needsBundle.lineas);
  for (const alts of alternatives.values()) for (const a of alts) allLineas.add(a);

  const capacity = buildIv5Capacity({
    centro,
    lineas: Array.from(allLineas),
    weekSegments,
    tiemposCanon,
    activeSatKeys,
    maxExtrasHoras,
    horasExtrasFin,
    maxSabadosMes: params.maxSabadosMes,
  });

  // Nota: la necesidadTraslado de C1000 ya se construyo dentro de
  // `buildIv5Needs` a partir de filas clase F (Centro=2000+claseF). No se
  // sobreescribe aqui. C2000 recibe `trasladoEntranteByMatWeek` desde la
  // corrida previa de C1000 y lo aplica en el progressive.

  // Etapa 0 - Pre-pasada todo-o-nada: redirige material entero a alternativa
  // si la linea fija tendra deficit y alguna alt tiene idle libre suficiente.
  const minutosRequeridosByLineMat = buildNeedsByLineMaterialMin(needsBundle.needs);
  const preEtapaDecisions = runIv5PreEtapaTodoONada({
    alternatives,
    metas: needsBundle.metas,
    capacity,
    needsByLineMaterialMin: minutosRequeridosByLineMat,
  });
  if (preEtapaDecisions.length > 0) {
    const altByMat = new Map(preEtapaDecisions.map((d) => [d.material, d.lineaSeleccionada] as const));
    for (const n of needsBundle.needs) {
      const altLinea = altByMat.get(n.material);
      if (altLinea) {
        n.linea = altLinea;
      }
    }
    for (const meta of needsBundle.metas.values()) {
      const altLinea = altByMat.get(meta.material);
      if (altLinea) meta.lineaFija = altLinea;
    }
    for (const d of preEtapaDecisions) {
      diagnostics.push({
        severity: 'info',
        centro,
        material: d.material,
        linea: d.lineaSeleccionada,
        code: 'LINEA_ALTERNATIVA_USADA',
        mensaje: `Etapa 0 (todo-o-nada): material redirigido de ${d.lineaOriginal} a ${d.lineaSeleccionada}.`,
      });
    }
  }

  const regressive = runIv5Regressive(needsBundle.needs, needsBundle.metas, capacity);

  // Etapa 2 - alternativas residuales (parcial).
  const needsByLineWeekMaterial = buildNeedsByLineWeekMaterial(
    needsBundle.needs.map((n) => ({
      linea: n.linea,
      weekKey: n.weekKey,
      material: n.material,
      demanda: n.demanda,
      necesidadTraslado: n.necesidadTraslado,
      tupp: n.tupp,
    })),
  );
  const preferenciaAltPorMatMes = new Map<string, string>();
  const altRes = runIv5AlternativasResiduales({
    centro,
    alternatives,
    capacity,
    deficitResidual: regressive.deficitResidualMin,
    needsByLineWeekMaterial,
    preferenciaAltPorMatMes,
  });
  if (altRes.altProductionByKey.size > 0) {
    for (const d of altRes.decisions) {
      diagnostics.push({
        severity: 'info',
        centro,
        material: d.material,
        linea: d.lineaSeleccionada,
        code: 'LINEA_ALTERNATIVA_USADA',
        mensaje: `Etapa 2 (parcial): produccion residual movida de ${d.lineaOriginal} a ${d.lineaSeleccionada}.`,
      });
    }
  }
  const progressive = runIv5Progressive({
    centro,
    needs: needsBundle.needs,
    metas: needsBundle.metas,
    capacity,
    advances: regressive.advances,
    trasladoEntranteByMatWeek,
    altProductionByKey: altRes.altProductionByKey,
  });

  // Etapa 4 - mini-pasada PIO mensual.
  const pioPass = runIv5MonthlyPio({
    centro,
    ledger: progressive.ledger,
    capacity,
    pioMap,
  });

  // Etapa 5a - validacion del tope agregado y recorte proporcional.
  const stockCapPass = runIv5StockCap({
    centro,
    ledger: progressive.ledger,
    capacity,
    stockCap: params.stockCap,
  });
  for (const d of stockCapPass.diagnostics) diagnostics.push(d);

  // Etapa 5b - cierre de drift week-vs-month.
  const driftDiags = runIv5DriftClose(progressive.ledger);
  for (const d of driftDiags) diagnostics.push(d);
  for (const d of pioPass.diagnostics) {
    diagnostics.push({
      severity: 'info',
      centro,
      linea: d.linea,
      material: d.material,
      code: 'PIO_NO_COMPLETO',
      mensaje: d.mensaje,
      data: { brechaResidual: d.brechaResidual, weekKey: d.weekKey },
    });
  }

  // Diagnostico basico:
  for (const row of progressive.ledger) {
    if (row.alertaStockBajoSeguridad) {
      diagnostics.push({
        severity: 'warn',
        centro,
        mes: row.mes,
        anio: row.anio,
        isoWeek: row.isoWeek,
        isoYear: row.isoYear,
        linea: row.linea,
        material: row.material,
        code: 'STOCK_BAJO_SEGURIDAD',
        mensaje: `Stock final (${row.stockFinal}) < stock seguridad (${row.stockSeguridad}).`,
      });
    }
    if (row.idleSem > 0 && row.demanda + row.necesidadTrasladoSemana > 0 && row.backlogFinal > 0) {
      diagnostics.push({
        severity: 'info',
        centro,
        mes: row.mes,
        anio: row.anio,
        isoWeek: row.isoWeek,
        isoYear: row.isoYear,
        linea: row.linea,
        material: row.material,
        code: 'IDLE_OCIOSO',
        mensaje: `Idle ${Math.round(row.idleSem)} min con backlog ${row.backlogFinal} pendiente.`,
      });
    }
  }

  for (const [key, mins] of regressive.deficitResidualMin.entries()) {
    if (mins > 0) {
      const [linea, weekKey] = key.split('|') as [string, WeekKey];
      diagnostics.push({
        severity: 'warn',
        centro,
        linea,
        code: 'BACKLOG_CRECIENTE',
        mensaje: `Deficit residual no anticipado en (${linea}, ${weekKey}): ${Math.round(mins)} min.`,
      });
    }
  }

  const monthly = aggregateWeeklyToMonthly(progressive.ledger);

  return {
    centro,
    ledger: progressive.ledger,
    monthly,
    diagnostics,
  };
}

/**
 * A partir del ledger de C1000, agrega `trasladoSaliente` por (material, weekKey).
 * El resultado se pasa como `trasladoEntranteByMatWeek` a la corrida de C2000
 * para que su progresiva lo sume al disponible (cubrir demanda clase F sin
 * reservar capacidad propia).
 *
 * Solo cuenta filas reales (no los shadow rows de la linea virtual).
 */
export function aggregateTrasladoSalienteFromLedger(
  ledger: Iv5WeeklyRow[],
): Map<string, number> {
  const out = new Map<string, number>();
  for (const row of ledger) {
    const sal = row.trasladoSaliente;
    if (!sal || sal <= 0) continue;
    const key = `${row.material}|${row.weekKey}`;
    out.set(key, (out.get(key) ?? 0) + sal);
  }
  return out;
}

/** Convenience para acumular ledger de varios centros. */
export function mergeRunResults(...results: Iv5RunResult[]): {
  ledger: Iv5WeeklyRow[];
  monthly: Iv5RunResult['monthly'];
  diagnostics: Iv5DiagnosticEntry[];
} {
  const ledger: Iv5WeeklyRow[] = [];
  const monthly: Iv5RunResult['monthly'] = [];
  const diagnostics: Iv5DiagnosticEntry[] = [];
  for (const r of results) {
    ledger.push(...r.ledger);
    monthly.push(...r.monthly);
    diagnostics.push(...r.diagnostics);
  }
  return { ledger, monthly, diagnostics };
}

/** Mantiene visible el tipo MaterialKey por si el caller necesita anotaciones. */
export type { MaterialKey };
