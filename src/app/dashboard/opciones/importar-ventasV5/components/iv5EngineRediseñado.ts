/**
 * Motor IV5 REDISEÑADO — implementación para datos reales (integrado a la app).
 *
 * Implementa el modelo discutido con el usuario:
 *  - Loop integrado semana a semana entre C1000 y C2000 (no pre-pase optimista)
 *  - Pasada 1 (forward) identifica déficits y sobrantes reales
 *  - Pasada 2 anticipa producción usando sobrantes
 *  - Reservas anticipadas separadas del stock regular
 *  - Tope agregado de almacenamiento respetado durante anticipación
 *
 * ============================================================================
 * ESTADO ACTUAL: TURNO 3
 * ============================================================================
 *  - Turno 1: esqueleto + toggle UI ← LISTO
 *  - Turno 2: adaptador + loop integrado Pasada 1 ← LISTO
 *  - Turno 3 (este): Pasada 2 anticipación + reservas + tope ← LISTO
 *  - Turno 4: respaldo X/E + prorrateo 2 niveles consistente ← PENDIENTE
 */

import type { WeekSegment } from '../../plan-semanal/components/types';
import type { TiempoCanonResult, PioMap } from '../../importar-ventasV2/components/types';
import { getMesNombre } from '../../importar-ventasV2/components/utils';
import type {
  Centro,
  Iv5StockCap,
  Iv5RunResult,
  Iv5WeeklyRow,
  Iv5DiagnosticEntry,
  Iv5MaterialWeekNeed,
  LineaKey,
  MaterialKey,
  WeekKey,
} from './iv5Types';
import { buildIv5Needs, type MaterialMeta } from './iv5Necesidad';
import {
  buildIv5Capacity,
  getCapacityCell,
  type Iv5CapacityMatrix,
} from './iv5Capacity';
import { IV5_VIRTUAL_TRANSFER_LINE } from './iv5Constants';
import { aggregateWeeklyToMonthly } from './iv5Aggregate';

// ============================================================================
// API PÚBLICA
// ============================================================================

export interface Iv5EngineRediseñadoParams {
  weekSegments: WeekSegment[];
  effectiveData: any[];
  tiemposCanon: TiempoCanonResult[];
  activeSatKeysC1000: Set<string>;
  activeSatKeysC2000: Set<string>;
  horasTrabajo: number;
  maxExtrasHoras: number;
  horasExtrasFin: number;
  pioMap: PioMap;
  stockCap: Iv5StockCap;
  maxSabadosMes: number;
  wantC1000: boolean;
  wantC2000: boolean;
}

/**
 * Material X/E con déficit operativo en C2000 que NO pudo respaldarse desde
 * C1000 porque no tiene línea productiva en C1000 (no aparece en metasC1000).
 * `cantidad` = total de uds de faltante operativo (demanda + backlog) que
 * quedaron sin posibilidad de traslado, acumulado en todo el horizonte.
 */
export interface Iv5XESinLineaC1000 {
  material: MaterialKey;
  descripcion: string;
  cantidad: number;
}

export interface Iv5EngineRediseñadoResult {
  resultC1000: Iv5RunResult | null;
  resultC2000: Iv5RunResult | null;
  diagnosticos: Iv5DiagnosticEntry[];
  /** X/E con déficit en C2000 sin línea en C1000 (no respaldables). */
  xeSinLineaC1000: Iv5XESinLineaC1000[];
}

// ============================================================================
// ESTADO INTERNO DEL MOTOR
// ============================================================================

interface MotorState {
  stockRegular: Map<string, number>;
  backlog: Map<string, number>;
  reservas: Map<string, number>;
  produccion: Map<string, number>;
  trasladoEntrante: Map<string, number>;
  trasladoSaliente: Map<string, number>;
  despachos: Map<string, number>;
}

function keyMC(material: string, centro: Centro): string {
  return `${material}|${centro}`;
}
function keyMCW(material: string, centro: Centro, weekKey: WeekKey): string {
  return `${material}|${centro}|${weekKey}`;
}
function keyMCT(material: string, centro: Centro, targetWeekKey: WeekKey): string {
  return `${material}|${centro}|t${targetWeekKey}`;
}

function initState(
  metasC1000: Map<MaterialKey, MaterialMeta> | null,
  metasC2000: Map<MaterialKey, MaterialMeta> | null,
): MotorState {
  const state: MotorState = {
    stockRegular: new Map(),
    backlog: new Map(),
    reservas: new Map(),
    produccion: new Map(),
    trasladoEntrante: new Map(),
    trasladoSaliente: new Map(),
    despachos: new Map(),
  };
  if (metasC1000) {
    for (const meta of metasC1000.values()) {
      state.stockRegular.set(keyMC(meta.material, '1000'), meta.stockInicialAbs);
      state.backlog.set(keyMC(meta.material, '1000'), 0);
    }
  }
  if (metasC2000) {
    for (const meta of metasC2000.values()) {
      state.stockRegular.set(keyMC(meta.material, '2000'), meta.stockInicialAbs);
      state.backlog.set(keyMC(meta.material, '2000'), 0);
    }
  }
  return state;
}

// ============================================================================
// PLAN DE ANTICIPACIONES (Pasada 2)
// ============================================================================

type DestinoAnticipacion = 'C1000_PROPIO' | 'C2000_TRANSFER_F' | 'C2000_TRANSFER_XE';

interface AnticipacionPlaneada {
  material: MaterialKey;
  uds: number;
  semanaOrigenKey: WeekKey;
  semanaTargetKey: WeekKey;
  destino: DestinoAnticipacion;
  lineaProduccion: LineaKey;
  centroProduccion: Centro;
  tupp: number;
}

interface Deficit {
  material: MaterialKey;
  centro: Centro;
  semanaKey: WeekKey;
  uds: number;
  lineaProduccion: LineaKey;
  centroProduccion: Centro;
  destino: DestinoAnticipacion;
  tupp: number;
}

// ============================================================================
// PROCESAMIENTO POR SEMANA
// ============================================================================

interface NecesidadMaterialSemanaInfo {
  need: Iv5MaterialWeekNeed;
  necesidadUds: number;
  /** Nivel 1 (crítico): demanda + backlog + brecha hasta stock de SEGURIDAD. */
  udsN1: number;
  /** Nivel 2 (deseable): brecha desde seguridad hasta stock OBJETIVO. */
  udsN2: number;
}

/**
 * Prorrateo de capacidad en DOS NIVELES de prioridad sobre una línea.
 * Primero reparte el Nivel 1 (demanda + backlog + seguridad) de TODOS los items;
 * solo la capacidad que sobra se reparte al Nivel 2 (colchón hasta el objetivo).
 * Así la demanda y el stock de seguridad de todos los materiales se atienden
 * antes de construir cualquier inventario-objetivo (prioridad del negocio).
 * Devuelve las uds asignadas a cada item (en el mismo orden de entrada).
 */
function prorratearDosNiveles(
  items: { udsN1: number; udsN2: number; tupp: number }[],
  capTotalMin: number,
): number[] {
  const asign = items.map(() => 0);
  if (capTotalMin <= 0) return asign;

  // Nivel 1 (crítico).
  const reqMin1 = items.reduce((s, it) => s + it.udsN1 * Math.max(0.0001, it.tupp), 0);
  let capRest = capTotalMin;
  if (reqMin1 > 0) {
    const f1 = Math.min(1, capTotalMin / reqMin1);
    let usado = 0;
    items.forEach((it, i) => {
      const uds = Math.max(0, Math.floor(it.udsN1 * f1));
      asign[i] = uds;
      usado += uds * Math.max(0.0001, it.tupp);
    });
    capRest = Math.max(0, capTotalMin - usado);
  }

  // Nivel 2 (deseable) con la capacidad remanente.
  const reqMin2 = items.reduce((s, it) => s + it.udsN2 * Math.max(0.0001, it.tupp), 0);
  if (reqMin2 > 0 && capRest > 0) {
    const f2 = Math.min(1, capRest / reqMin2);
    items.forEach((it, i) => {
      asign[i] += Math.max(0, Math.floor(it.udsN2 * f2));
    });
  }

  return asign;
}

function procesarSemana(
  seg: WeekSegment,
  needsC1000: Iv5MaterialWeekNeed[],
  needsC2000: Iv5MaterialWeekNeed[],
  metasC1000: Map<MaterialKey, MaterialMeta>,
  metasC2000: Map<MaterialKey, MaterialMeta>,
  capacityC1000: Iv5CapacityMatrix | null,
  capacityC2000: Iv5CapacityMatrix | null,
  state: MotorState,
  ledgerC1000: Iv5WeeklyRow[],
  ledgerC2000: Iv5WeeklyRow[],
  wantC1000: boolean,
  wantC2000: boolean,
  anticipacionesParaEstaSemana: AnticipacionPlaneada[],
  xeSinLineaCollector: Map<MaterialKey, { descripcion: string; cantidad: number }>,
): void {
  const wk = seg.weekKey;

  // ============================================================
  // 0. Maduración de reservas con target = esta semana
  // ============================================================
  const reservasAMadurar: string[] = [];
  for (const [resKey, uds] of state.reservas.entries()) {
    if (resKey.endsWith(`|t${wk}`)) {
      reservasAMadurar.push(resKey);
      const sin = resKey.replace(`|t${wk}`, '');
      const parts = sin.split('|');
      const material = parts[0];
      const centro = parts[1] as Centro;
      const stockKey = keyMC(material, centro);
      state.stockRegular.set(stockKey, (state.stockRegular.get(stockKey) ?? 0) + uds);
    }
  }
  for (const k of reservasAMadurar) state.reservas.delete(k);

  // Snapshots iniciales
  const stockInicialMap = new Map<string, number>();
  for (const [k, v] of state.stockRegular.entries()) stockInicialMap.set(k, v);
  const backlogInicialMap = new Map<string, number>();
  for (const [k, v] of state.backlog.entries()) backlogInicialMap.set(k, v);

  // ============================================================
  // A. Necesidades C2000
  // ============================================================
  const necesidadesC2000Sem = wantC2000
    ? needsC2000
        .filter((n) => n.weekKey === wk)
        .map((n) => {
          const stockPrev = state.stockRegular.get(keyMC(n.material, '2000')) ?? 0;
          const back = state.backlog.get(keyMC(n.material, '2000')) ?? 0;
          const seguridad = n.stockSeguridad;
          const safetyGap = Math.max(0, Math.round(seguridad - stockPrev));
          const objGapExtra = Math.max(0, Math.round(n.stockObjetivoEfectivo - Math.max(stockPrev, seguridad)));
          const udsN1 = Math.round(n.demanda) + Math.round(back) + safetyGap;
          const udsN2 = objGapExtra;
          const necesidadUds = udsN1 + udsN2;
          return { need: n, necesidadUds, udsN1, udsN2 } as NecesidadMaterialSemanaInfo;
        })
        .filter((x) => x.necesidadUds > 0)
    : [];

  // ============================================================
  // B. C2000 X/E producción propia (incluye anticipaciones X/E intra-C2000)
  // ============================================================
  const prodPropiaC2000 = new Map<MaterialKey, number>();
  const necesidadTrasladoF = new Map<MaterialKey, { udsN1: number; udsN2: number }>();

  if (wantC2000 && capacityC2000) {
    type CargaC2000Item =
      | { tipo: 'NORMAL_XE'; material: MaterialKey; udsN1: number; udsN2: number; tupp: number }
      | { tipo: 'ANTICIP_XE'; material: MaterialKey; udsN1: number; udsN2: number; tupp: number; targetKey: WeekKey };

    const xeByLine = new Map<LineaKey, CargaC2000Item[]>();

    for (const info of necesidadesC2000Sem) {
      if (info.need.linea === IV5_VIRTUAL_TRANSFER_LINE) {
        const prev = necesidadTrasladoF.get(info.need.material) ?? { udsN1: 0, udsN2: 0 };
        necesidadTrasladoF.set(info.need.material, {
          udsN1: prev.udsN1 + info.udsN1,
          udsN2: prev.udsN2 + info.udsN2,
        });
        continue;
      }
      const arr = xeByLine.get(info.need.linea) ?? [];
      arr.push({
        tipo: 'NORMAL_XE',
        material: info.need.material,
        udsN1: info.udsN1,
        udsN2: info.udsN2,
        tupp: info.need.tupp,
      });
      xeByLine.set(info.need.linea, arr);
    }

    // Las anticipaciones son construcción de stock para el futuro: van al
    // Nivel 2 (después de demanda + seguridad de la semana actual).
    for (const ant of anticipacionesParaEstaSemana) {
      if (ant.centroProduccion !== '2000') continue;
      const arr = xeByLine.get(ant.lineaProduccion) ?? [];
      arr.push({
        tipo: 'ANTICIP_XE',
        material: ant.material,
        udsN1: 0,
        udsN2: ant.uds,
        tupp: ant.tupp,
        targetKey: ant.semanaTargetKey,
      });
      xeByLine.set(ant.lineaProduccion, arr);
    }

    for (const [linea, items] of xeByLine.entries()) {
      const cell = getCapacityCell(capacityC2000, linea, wk);
      if (!cell || cell.capTotal <= 0) continue;
      const asign = prorratearDosNiveles(items, cell.capTotal);
      items.forEach((it, idx) => {
        const udsAsign = asign[idx];
        if (udsAsign <= 0) return;
        if (it.tipo === 'NORMAL_XE') {
          prodPropiaC2000.set(
            it.material,
            (prodPropiaC2000.get(it.material) ?? 0) + udsAsign,
          );
        } else {
          const resKey = keyMCT(it.material, '2000', it.targetKey);
          state.reservas.set(resKey, (state.reservas.get(resKey) ?? 0) + udsAsign);
          state.produccion.set(
            keyMCW(it.material, '2000', wk),
            (state.produccion.get(keyMCW(it.material, '2000', wk)) ?? 0) + udsAsign,
          );
        }
      });
    }
  }

  // ============================================================
  // B'. Respaldo X/E vía C1000 (alcance: demanda + backlog, NO brecha)
  // ------------------------------------------------------------
  // Cuando la línea de C2000 satura y no alcanza a cubrir la parte
  // OPERATIVA (demanda + backlog) de un material X/E, ese faltante se
  // convierte en un requerimiento de traslado que C1000 evaluará en el
  // prorrateo del paso D. Deliberadamente NO se incluye la brecha al
  // stock objetivo: pasarla sobrecargaba C1000 y hundía su stock cuando
  // el material se vende en ambos centros (regresión del Turno 4).
  // ============================================================
  const necesidadTrasladoXE = new Map<MaterialKey, number>();
  if (wantC2000 && wantC1000) {
    for (const info of necesidadesC2000Sem) {
      const n = info.need;
      if (n.linea === IV5_VIRTUAL_TRANSFER_LINE) continue; // clase F ya va por TRANSFER_F
      const material = n.material;
      const stockPrev = state.stockRegular.get(keyMC(material, '2000')) ?? 0;
      const back = Math.round(state.backlog.get(keyMC(material, '2000')) ?? 0);
      const operativo = Math.round(n.demanda) + back;
      const producido = prodPropiaC2000.get(material) ?? 0;
      const faltante = Math.max(0, operativo - (stockPrev + producido));
      if (faltante > 0) {
        necesidadTrasladoXE.set(
          material,
          (necesidadTrasladoXE.get(material) ?? 0) + faltante,
        );
      }
    }
  }

  // ============================================================
  // C. Carga C1000: propio + traslados F + anticipaciones
  // ============================================================
  type CargaItemC1000 =
    | { tipo: 'PROPIO'; material: MaterialKey; udsN1: number; udsN2: number; tupp: number }
    | { tipo: 'TRANSFER_F'; material: MaterialKey; udsN1: number; udsN2: number; tupp: number }
    | { tipo: 'TRANSFER_XE'; material: MaterialKey; udsN1: number; udsN2: number; tupp: number }
    | { tipo: 'ANTICIP_PROPIO'; material: MaterialKey; udsN1: number; udsN2: number; tupp: number; targetKey: WeekKey }
    | { tipo: 'ANTICIP_TRANSFER_F'; material: MaterialKey; udsN1: number; udsN2: number; tupp: number; targetKey: WeekKey };

  const cargaPorLinea = new Map<LineaKey, CargaItemC1000[]>();

  if (wantC1000) {
    const propiasC1000 = needsC1000.filter((n) => n.weekKey === wk);
    for (const n of propiasC1000) {
      const stockPrev = state.stockRegular.get(keyMC(n.material, '1000')) ?? 0;
      const back = state.backlog.get(keyMC(n.material, '1000')) ?? 0;
      const seguridad = n.stockSeguridad;
      const safetyGap = Math.max(0, Math.round(seguridad - stockPrev));
      const objGapExtra = Math.max(0, Math.round(n.stockObjetivoEfectivo - Math.max(stockPrev, seguridad)));
      const udsN1 = Math.round(n.demanda) + Math.round(back) + safetyGap;
      const udsN2 = objGapExtra;
      if (udsN1 + udsN2 <= 0) continue;
      const arr = cargaPorLinea.get(n.linea) ?? [];
      arr.push({ tipo: 'PROPIO', material: n.material, udsN1, udsN2, tupp: n.tupp });
      cargaPorLinea.set(n.linea, arr);
    }

    for (const [material, traslado] of necesidadTrasladoF.entries()) {
      if (traslado.udsN1 + traslado.udsN2 <= 0) continue;
      const needRef = needsC1000.find(
        (n) => n.material === material && n.weekKey === wk,
      );
      if (!needRef) continue;
      const arr = cargaPorLinea.get(needRef.linea) ?? [];
      arr.push({
        tipo: 'TRANSFER_F',
        material,
        udsN1: traslado.udsN1,
        udsN2: traslado.udsN2,
        tupp: needRef.tupp,
      });
      cargaPorLinea.set(needRef.linea, arr);
    }

    // Respaldo X/E: el faltante operativo de C2000 entra como carga en la
    // línea de C1000 del material. Si el material no tiene presencia
    // productiva en C1000 (no está en metasC1000), no puede respaldarse y
    // el faltante queda como déficit que detectará la Pasada 2 / diagnóstico.
    for (const [material, udsXE] of necesidadTrasladoXE.entries()) {
      if (udsXE <= 0) continue;
      const metaC1000 = metasC1000.get(material);
      if (!metaC1000 || metaC1000.lineaFija === IV5_VIRTUAL_TRANSFER_LINE) {
        // No hay línea productiva en C1000 → no se puede respaldar.
        // Se acumula para el reporte visible al usuario.
        const prev = xeSinLineaCollector.get(material);
        const descripcion = metasC2000.get(material)?.descripcion ?? '';
        if (prev) {
          prev.cantidad += udsXE;
          if (!prev.descripcion && descripcion) prev.descripcion = descripcion;
        } else {
          xeSinLineaCollector.set(material, { descripcion, cantidad: udsXE });
        }
        continue;
      }
      const needRef = needsC1000.find(
        (n) => n.material === material && n.weekKey === wk,
      );
      const linea = metaC1000.lineaFija;
      const tupp = needRef?.tupp ?? metaC1000.tuppRepresentativo;
      const arr = cargaPorLinea.get(linea) ?? [];
      // El respaldo X/E es operativo (demanda + backlog), va al Nivel 1.
      arr.push({ tipo: 'TRANSFER_XE', material, udsN1: udsXE, udsN2: 0, tupp });
      cargaPorLinea.set(linea, arr);
    }

    // Anticipaciones = construcción de stock futuro => Nivel 2 (después de la
    // demanda + seguridad de la semana actual de todos los materiales).
    for (const ant of anticipacionesParaEstaSemana) {
      if (ant.centroProduccion !== '1000') continue;
      const arr = cargaPorLinea.get(ant.lineaProduccion) ?? [];
      if (ant.destino === 'C1000_PROPIO') {
        arr.push({
          tipo: 'ANTICIP_PROPIO',
          material: ant.material,
          udsN1: 0,
          udsN2: ant.uds,
          tupp: ant.tupp,
          targetKey: ant.semanaTargetKey,
        });
      } else {
        arr.push({
          tipo: 'ANTICIP_TRANSFER_F',
          material: ant.material,
          udsN1: 0,
          udsN2: ant.uds,
          tupp: ant.tupp,
          targetKey: ant.semanaTargetKey,
        });
      }
      cargaPorLinea.set(ant.lineaProduccion, arr);
    }
  }

  // ============================================================
  // D. Prorrateo C1000 por línea (DOS NIVELES: demanda+seguridad antes que objetivo)
  // ============================================================
  const asignPropio = new Map<MaterialKey, number>();
  const asignTransferF = new Map<MaterialKey, number>();
  const asignTransferXE = new Map<MaterialKey, number>();
  const asignAnticipPropio: { material: MaterialKey; uds: number; targetKey: WeekKey }[] = [];
  const asignAnticipTransferF: { material: MaterialKey; uds: number; targetKey: WeekKey }[] = [];

  if (wantC1000 && capacityC1000) {
    for (const [linea, items] of cargaPorLinea.entries()) {
      const cell = getCapacityCell(capacityC1000, linea, wk);
      if (!cell || cell.capTotal <= 0) continue;
      const asign = prorratearDosNiveles(items, cell.capTotal);
      items.forEach((it, idx) => {
        const udsAsign = asign[idx];
        if (udsAsign <= 0) return;
        if (it.tipo === 'PROPIO') {
          asignPropio.set(it.material, (asignPropio.get(it.material) ?? 0) + udsAsign);
        } else if (it.tipo === 'TRANSFER_F') {
          asignTransferF.set(it.material, (asignTransferF.get(it.material) ?? 0) + udsAsign);
        } else if (it.tipo === 'TRANSFER_XE') {
          asignTransferXE.set(it.material, (asignTransferXE.get(it.material) ?? 0) + udsAsign);
        } else if (it.tipo === 'ANTICIP_PROPIO') {
          asignAnticipPropio.push({ material: it.material, uds: udsAsign, targetKey: it.targetKey });
        } else {
          asignAnticipTransferF.push({ material: it.material, uds: udsAsign, targetKey: it.targetKey });
        }
      });
    }
  }

  // ============================================================
  // E. Aplicar movimientos al estado
  // ============================================================
  for (const [material, uds] of prodPropiaC2000.entries()) {
    if (uds <= 0) continue;
    state.produccion.set(
      keyMCW(material, '2000', wk),
      (state.produccion.get(keyMCW(material, '2000', wk)) ?? 0) + uds,
    );
    const key = keyMC(material, '2000');
    state.stockRegular.set(key, (state.stockRegular.get(key) ?? 0) + uds);
  }

  for (const [material, uds] of asignPropio.entries()) {
    if (uds <= 0) continue;
    state.produccion.set(
      keyMCW(material, '1000', wk),
      (state.produccion.get(keyMCW(material, '1000', wk)) ?? 0) + uds,
    );
    state.stockRegular.set(
      keyMC(material, '1000'),
      (state.stockRegular.get(keyMC(material, '1000')) ?? 0) + uds,
    );
  }

  for (const [material, uds] of asignTransferF.entries()) {
    if (uds <= 0) continue;
    state.produccion.set(
      keyMCW(material, '1000', wk),
      (state.produccion.get(keyMCW(material, '1000', wk)) ?? 0) + uds,
    );
    state.trasladoSaliente.set(
      keyMCW(material, '1000', wk),
      (state.trasladoSaliente.get(keyMCW(material, '1000', wk)) ?? 0) + uds,
    );
    state.trasladoEntrante.set(
      keyMCW(material, '2000', wk),
      (state.trasladoEntrante.get(keyMCW(material, '2000', wk)) ?? 0) + uds,
    );
    const keyC2000 = keyMC(material, '2000');
    state.stockRegular.set(keyC2000, (state.stockRegular.get(keyC2000) ?? 0) + uds);
  }

  for (const [material, uds] of asignTransferXE.entries()) {
    if (uds <= 0) continue;
    state.produccion.set(
      keyMCW(material, '1000', wk),
      (state.produccion.get(keyMCW(material, '1000', wk)) ?? 0) + uds,
    );
    state.trasladoSaliente.set(
      keyMCW(material, '1000', wk),
      (state.trasladoSaliente.get(keyMCW(material, '1000', wk)) ?? 0) + uds,
    );
    state.trasladoEntrante.set(
      keyMCW(material, '2000', wk),
      (state.trasladoEntrante.get(keyMCW(material, '2000', wk)) ?? 0) + uds,
    );
    const keyC2000 = keyMC(material, '2000');
    state.stockRegular.set(keyC2000, (state.stockRegular.get(keyC2000) ?? 0) + uds);
  }

  for (const ant of asignAnticipPropio) {
    if (ant.uds <= 0) continue;
    state.produccion.set(
      keyMCW(ant.material, '1000', wk),
      (state.produccion.get(keyMCW(ant.material, '1000', wk)) ?? 0) + ant.uds,
    );
    const resKey = keyMCT(ant.material, '1000', ant.targetKey);
    state.reservas.set(resKey, (state.reservas.get(resKey) ?? 0) + ant.uds);
  }

  for (const ant of asignAnticipTransferF) {
    if (ant.uds <= 0) continue;
    state.produccion.set(
      keyMCW(ant.material, '1000', wk),
      (state.produccion.get(keyMCW(ant.material, '1000', wk)) ?? 0) + ant.uds,
    );
    state.trasladoSaliente.set(
      keyMCW(ant.material, '1000', wk),
      (state.trasladoSaliente.get(keyMCW(ant.material, '1000', wk)) ?? 0) + ant.uds,
    );
    state.trasladoEntrante.set(
      keyMCW(ant.material, '2000', wk),
      (state.trasladoEntrante.get(keyMCW(ant.material, '2000', wk)) ?? 0) + ant.uds,
    );
    const resKey = keyMCT(ant.material, '2000', ant.targetKey);
    state.reservas.set(resKey, (state.reservas.get(resKey) ?? 0) + ant.uds);
  }

  // ============================================================
  // F. Despachos a clientes
  // ============================================================
  if (wantC1000) {
    for (const meta of metasC1000.values()) {
      const need = needsC1000.find((n) => n.material === meta.material && n.weekKey === wk);
      const demanda = need ? Math.round(need.demanda) : 0;
      const key = keyMC(meta.material, '1000');
      const stockDisp = state.stockRegular.get(key) ?? 0;
      const back = state.backlog.get(key) ?? 0;
      const pedido = demanda + back;
      const desp = Math.min(stockDisp, pedido);
      state.despachos.set(keyMCW(meta.material, '1000', wk), desp);
      state.stockRegular.set(key, stockDisp - desp);
      state.backlog.set(key, Math.max(0, pedido - desp));
    }
  }

  if (wantC2000) {
    for (const meta of metasC2000.values()) {
      const need = needsC2000.find((n) => n.material === meta.material && n.weekKey === wk);
      const demanda = need ? Math.round(need.demanda) : 0;
      const key = keyMC(meta.material, '2000');
      const stockDisp = state.stockRegular.get(key) ?? 0;
      const back = state.backlog.get(key) ?? 0;
      const pedido = demanda + back;
      const desp = Math.min(stockDisp, pedido);
      state.despachos.set(keyMCW(meta.material, '2000', wk), desp);
      state.stockRegular.set(key, stockDisp - desp);
      state.backlog.set(key, Math.max(0, pedido - desp));
    }
  }

  // ============================================================
  // G. Registrar filas del ledger
  // ============================================================
  const sumReservas = (material: MaterialKey, centro: Centro): number => {
    let total = 0;
    for (const [resKey, uds] of state.reservas.entries()) {
      if (resKey.startsWith(`${material}|${centro}|`)) total += uds;
    }
    return total;
  };

  if (wantC1000) {
    for (const meta of metasC1000.values()) {
      const prod = state.produccion.get(keyMCW(meta.material, '1000', wk)) ?? 0;
      const traslSal = state.trasladoSaliente.get(keyMCW(meta.material, '1000', wk)) ?? 0;
      const desp = state.despachos.get(keyMCW(meta.material, '1000', wk)) ?? 0;
      const stockInicial = stockInicialMap.get(keyMC(meta.material, '1000')) ?? 0;
      const stockFinal = state.stockRegular.get(keyMC(meta.material, '1000')) ?? 0;
      const backlogInicial = backlogInicialMap.get(keyMC(meta.material, '1000')) ?? 0;
      const backlogFinal = state.backlog.get(keyMC(meta.material, '1000')) ?? 0;
      const need = needsC1000.find((n) => n.material === meta.material && n.weekKey === wk);
      const reservasTotal = sumReservas(meta.material, '1000');
      if (
        prod === 0 &&
        traslSal === 0 &&
        desp === 0 &&
        stockFinal === 0 &&
        backlogFinal === 0 &&
        reservasTotal === 0
      ) {
        continue;
      }
      const cell = capacityC1000 ? getCapacityCell(capacityC1000, meta.lineaFija, wk) : null;
      ledgerC1000.push(
        buildLedgerRow({
          centro: '1000',
          linea: need?.linea ?? meta.lineaFija,
          material: meta.material,
          seg,
          sectorRef: meta.sectorRef,
          descripcion: meta.descripcion,
          tupp: need?.tupp ?? meta.tuppRepresentativo,
          cell,
          demanda: need ? Math.round(need.demanda) : 0,
          necesidadTrasladoSemana: 0,
          despachosVentas: desp,
          trasladoSaliente: traslSal,
          trasladoEntrante: 0,
          produccionBase: prod,
          stockInicial,
          stockFinal,
          stockSeguridad: need?.stockSeguridad ?? 0,
          stockObjetivoEfectivo: need?.stockObjetivoEfectivo ?? 0,
          backlogInicial,
          backlogGenerado: backlogFinal,
          backlogFinal,
          stockReservado: reservasTotal,
        }),
      );
    }
  }

  if (wantC2000) {
    for (const meta of metasC2000.values()) {
      const prod = state.produccion.get(keyMCW(meta.material, '2000', wk)) ?? 0;
      const traslEnt = state.trasladoEntrante.get(keyMCW(meta.material, '2000', wk)) ?? 0;
      const desp = state.despachos.get(keyMCW(meta.material, '2000', wk)) ?? 0;
      const stockInicial = stockInicialMap.get(keyMC(meta.material, '2000')) ?? 0;
      const stockFinal = state.stockRegular.get(keyMC(meta.material, '2000')) ?? 0;
      const backlogInicial = backlogInicialMap.get(keyMC(meta.material, '2000')) ?? 0;
      const backlogFinal = state.backlog.get(keyMC(meta.material, '2000')) ?? 0;
      const need = needsC2000.find((n) => n.material === meta.material && n.weekKey === wk);
      const reservasTotal = sumReservas(meta.material, '2000');
      if (
        prod === 0 &&
        traslEnt === 0 &&
        desp === 0 &&
        stockFinal === 0 &&
        backlogFinal === 0 &&
        backlogInicial === 0 &&
        reservasTotal === 0
      ) {
        continue;
      }
      const cell = capacityC2000 ? getCapacityCell(capacityC2000, meta.lineaFija, wk) : null;
      ledgerC2000.push(
        buildLedgerRow({
          centro: '2000',
          linea: need?.linea ?? meta.lineaFija,
          material: meta.material,
          seg,
          sectorRef: meta.sectorRef,
          descripcion: meta.descripcion,
          tupp: need?.tupp ?? meta.tuppRepresentativo,
          cell,
          demanda: need ? Math.round(need.demanda) : 0,
          necesidadTrasladoSemana: 0,
          despachosVentas: desp,
          trasladoSaliente: 0,
          trasladoEntrante: traslEnt,
          produccionBase: prod,
          stockInicial,
          stockFinal,
          stockSeguridad: need?.stockSeguridad ?? 0,
          stockObjetivoEfectivo: need?.stockObjetivoEfectivo ?? 0,
          backlogInicial,
          backlogGenerado: backlogFinal,
          backlogFinal,
          stockReservado: reservasTotal,
        }),
      );
    }
  }
}

// ============================================================================
// FILA LEDGER
// ============================================================================

interface BuildLedgerRowParams {
  centro: Centro;
  linea: LineaKey;
  material: MaterialKey;
  seg: WeekSegment;
  sectorRef: string;
  descripcion: string;
  tupp: number;
  cell: ReturnType<typeof getCapacityCell>;
  demanda: number;
  necesidadTrasladoSemana: number;
  despachosVentas: number;
  trasladoSaliente: number;
  trasladoEntrante: number;
  produccionBase: number;
  stockInicial: number;
  stockFinal: number;
  stockSeguridad: number;
  stockObjetivoEfectivo: number;
  backlogInicial: number;
  backlogGenerado: number;
  backlogFinal: number;
  stockReservado: number;
}

function buildLedgerRow(p: BuildLedgerRowParams): Iv5WeeklyRow {
  return {
    centro: p.centro,
    linea: p.linea,
    material: p.material,
    weekKey: p.seg.weekKey,
    satKey: p.seg.satKey,
    isoWeek: p.seg.isoWeek,
    isoYear: p.seg.isoYear,
    mes: p.seg.mes,
    anio: p.seg.anio,
    sectorRef: p.sectorRef,
    descripcion: p.descripcion,
    mesNombre: getMesNombre(p.seg.mes),
    tupp: p.tupp,
    diasLV: p.cell?.diasLV ?? p.seg.diasLaborales,
    sabadoActivo: p.cell?.sabadoActivo ?? false,
    capJN: p.cell?.capJN ?? 0,
    capHE: p.cell?.capHE ?? 0,
    capSab: p.cell?.capSab ?? 0,
    capTotal: p.cell?.capTotal ?? 0,
    minUsados: p.produccionBase * p.tupp,
    idleSem: Math.max(0, (p.cell?.capTotal ?? 0) - p.produccionBase * p.tupp),
    demanda: p.demanda,
    necesidadTrasladoSemana: p.necesidadTrasladoSemana,
    despachosVentas: p.despachosVentas,
    trasladoSaliente: p.trasladoSaliente,
    trasladoEntrante: p.trasladoEntrante,
    produccionBase: p.produccionBase,
    produccionAlternativa: 0,
    produccionAdelanto: 0,
    produccionPio: 0,
    stockInicial: p.stockInicial,
    stockFinal: p.stockFinal,
    stockSeguridad: p.stockSeguridad,
    stockObjetivoEfectivo: p.stockObjetivoEfectivo,
    backlogInicial: p.backlogInicial,
    backlogGenerado: p.backlogGenerado,
    backlogFinal: p.backlogFinal,
    alertaStockBajoSeguridad: p.stockFinal < p.stockSeguridad,
    alertaTopeAgregado: false,
    stockReservado: p.stockReservado,
    stockFinalFisico: p.stockFinal + p.stockReservado,
  };
}

// ============================================================================
// DETECCIÓN DE DÉFICITS Y PLANIFICACIÓN
// ============================================================================

function detectarDeficits(
  ledgerC1000: Iv5WeeklyRow[],
  ledgerC2000: Iv5WeeklyRow[],
  needsC1000: Iv5MaterialWeekNeed[],
  needsC2000: Iv5MaterialWeekNeed[],
  metasC1000: Map<MaterialKey, MaterialMeta>,
  metasC2000: Map<MaterialKey, MaterialMeta>,
): Deficit[] {
  const deficits: Deficit[] = [];

  // Índices needs por `${material}|${weekKey}` (primera ocurrencia, como `.find`)
  // para evitar O(n) por fila de ledger.
  const needIdxC1000 = new Map<string, Iv5MaterialWeekNeed>();
  for (const n of needsC1000) {
    const k = `${n.material}|${n.weekKey}`;
    if (!needIdxC1000.has(k)) needIdxC1000.set(k, n);
  }
  const needIdxC2000 = new Map<string, Iv5MaterialWeekNeed>();
  for (const n of needsC2000) {
    const k = `${n.material}|${n.weekKey}`;
    if (!needIdxC2000.has(k)) needIdxC2000.set(k, n);
  }

  for (const row of ledgerC1000) {
    const meta = metasC1000.get(row.material);
    if (!meta) continue;
    if (meta.lineaFija === IV5_VIRTUAL_TRANSFER_LINE) continue;
    const need = needIdxC1000.get(`${row.material}|${row.weekKey}`);
    const obj = need?.stockObjetivoEfectivo ?? row.stockObjetivoEfectivo ?? 0;
    const def = Math.max(0, obj - row.stockFinal) + row.backlogFinal;
    if (def <= 0) continue;
    deficits.push({
      material: row.material,
      centro: '1000',
      semanaKey: row.weekKey,
      uds: def,
      lineaProduccion: meta.lineaFija,
      centroProduccion: '1000',
      destino: 'C1000_PROPIO',
      tupp: need?.tupp ?? meta.tuppRepresentativo,
    });
  }

  for (const row of ledgerC2000) {
    const meta = metasC2000.get(row.material);
    if (!meta || !meta.esClaseF) continue;
    const need = needIdxC2000.get(`${row.material}|${row.weekKey}`);
    const obj = need?.stockObjetivoEfectivo ?? row.stockObjetivoEfectivo ?? 0;
    const def = Math.max(0, obj - row.stockFinal) + row.backlogFinal;
    if (def <= 0) continue;
    const needC1000 = needIdxC1000.get(`${row.material}|${row.weekKey}`);
    if (!needC1000) continue;
    deficits.push({
      material: row.material,
      centro: '2000',
      semanaKey: row.weekKey,
      uds: def,
      lineaProduccion: needC1000.linea,
      centroProduccion: '1000',
      destino: 'C2000_TRANSFER_F',
      tupp: needC1000.tupp,
    });
  }

  for (const row of ledgerC2000) {
    const meta = metasC2000.get(row.material);
    if (!meta || meta.esClaseF) continue;
    if (meta.lineaFija === IV5_VIRTUAL_TRANSFER_LINE) continue;
    const need = needIdxC2000.get(`${row.material}|${row.weekKey}`);
    const obj = need?.stockObjetivoEfectivo ?? row.stockObjetivoEfectivo ?? 0;
    const def = Math.max(0, obj - row.stockFinal) + row.backlogFinal;
    if (def <= 0) continue;

    // Anticipación del déficit X/E de C2000. Si el material tiene línea
    // productiva en C1000, se anticipa produciéndolo TEMPRANO en C1000 (con su
    // ocioso sobrante) y trasladándolo a C2000 — igual que la clase F. Reusa la
    // ruta ANTICIP_TRANSFER_F y es Nivel 2 (no compromete la demanda de C1000).
    // Si NO tiene línea en C1000, la única opción es anticipar intra-C2000.
    const metaC1000 = metasC1000.get(row.material);
    const tieneLineaC1000 = !!metaC1000 && metaC1000.lineaFija !== IV5_VIRTUAL_TRANSFER_LINE;
    if (tieneLineaC1000) {
      const needC1000 = needIdxC1000.get(`${row.material}|${row.weekKey}`);
      deficits.push({
        material: row.material,
        centro: '2000',
        semanaKey: row.weekKey,
        uds: def,
        lineaProduccion: metaC1000!.lineaFija,
        centroProduccion: '1000',
        destino: 'C2000_TRANSFER_XE',
        tupp: needC1000?.tupp ?? metaC1000!.tuppRepresentativo,
      });
    } else {
      deficits.push({
        material: row.material,
        centro: '2000',
        semanaKey: row.weekKey,
        uds: def,
        lineaProduccion: meta.lineaFija,
        centroProduccion: '2000',
        destino: 'C2000_TRANSFER_XE',
        tupp: need?.tupp ?? meta.tuppRepresentativo,
      });
    }
  }

  return deficits;
}

function planificarAnticipaciones(
  deficits: Deficit[],
  ledgerC2000Pasada1: Iv5WeeklyRow[],
  ledgerC1000Pasada1: Iv5WeeklyRow[],
  capacityC1000: Iv5CapacityMatrix | null,
  capacityC2000: Iv5CapacityMatrix | null,
  sortedSegs: WeekSegment[],
  stockCap: Iv5StockCap,
  metasC2000: Map<MaterialKey, MaterialMeta>,
): AnticipacionPlaneada[] {
  const plan: AnticipacionPlaneada[] = [];
  const indexByWeek = new Map<WeekKey, number>();
  sortedSegs.forEach((seg, i) => indexByWeek.set(seg.weekKey, i));

  // Minutos usados por (centro|linea|weekKey) en UNA pasada del ledger (antes
  // se filtraba el ledger completo por cada celda de capacidad → O(n²)).
  const usadosCLW = new Map<string, number>();
  const acumUsados = (centro: Centro, ledger: Iv5WeeklyRow[]) => {
    for (const r of ledger) {
      const k = `${centro}|${r.linea}|${r.weekKey}`;
      usadosCLW.set(k, (usadosCLW.get(k) ?? 0) + r.minUsados);
    }
  };
  acumUsados('1000', ledgerC1000Pasada1);
  acumUsados('2000', ledgerC2000Pasada1);

  const capRestante = new Map<string, number>();
  const fillCap = (cap: Iv5CapacityMatrix | null, centro: Centro) => {
    if (!cap) return;
    for (const [linea, byWeek] of cap.entries()) {
      for (const [weekKey, cell] of byWeek.entries()) {
        const k = `${centro}|${linea}|${weekKey}`;
        capRestante.set(k, Math.max(0, cell.capTotal - (usadosCLW.get(k) ?? 0)));
      }
    }
  };
  fillCap(capacityC1000, '1000');
  fillCap(capacityC2000, '2000');

  // --- Precálculos para acelerar el tope de bodega C2000 (capBoundPorTope) ---
  // Antes era O(ventana × materiales × plan) por cada déficit (cúbico a escala).
  // Ahora O(ventana): stock del sector por semana precalculado + anticipaciones
  // vivas mantenidas incrementalmente.
  const sectoresSet = new Set(stockCap.sectoresAplicables);
  const sectorMats: { material: MaterialKey; stockIni: number }[] = [];
  for (const meta of metasC2000.values()) {
    if (sectoresSet.has(meta.sectorRef)) {
      sectorMats.push({ material: meta.material, stockIni: meta.stockInicialAbs });
    }
  }
  const esSectorC2000 = new Set(sectorMats.map((m) => m.material));
  const stockC2000ByMatWeek = new Map<string, number>();
  for (const r of ledgerC2000Pasada1) stockC2000ByMatWeek.set(`${r.material}|${r.weekKey}`, r.stockFinal);
  // Stock del sector por índice de semana (suma de stockFinal Pasada1, o
  // stockInicialAbs si la semana no tiene fila — replica el fallback original).
  const stockSectorPorIdx = sortedSegs.map((seg) => {
    let tot = 0;
    for (const sm of sectorMats) tot += stockC2000ByMatWeek.get(`${sm.material}|${seg.weekKey}`) ?? sm.stockIni;
    return tot;
  });
  // Anticipaciones "vivas" del sector por índice de semana (incremental).
  const antVivasPorIdx = new Array<number>(sortedSegs.length).fill(0);

  // Déficits indexados por `${centro}|${linea}` para no filtrar TODOS por iteración.
  const deficitsByCL = new Map<string, Deficit[]>();
  for (const d of deficits) {
    const k = `${d.centroProduccion}|${d.lineaProduccion}`;
    let arr = deficitsByCL.get(k);
    if (!arr) { arr = []; deficitsByCL.set(k, arr); }
    arr.push(d);
  }

  const residualPorDeficit = new Map<number, number>();
  const idxPorDef = new Map<Deficit, number>();
  deficits.forEach((d, i) => {
    residualPorDeficit.set(i, d.uds);
    idxPorDef.set(d, i);
  });

  for (let i = 0; i < sortedSegs.length; i++) {
    const segOrigen = sortedSegs[i];
    for (const centroProd of ['1000', '2000'] as Centro[]) {
      const cap = centroProd === '1000' ? capacityC1000 : capacityC2000;
      if (!cap) continue;
      for (const [linea] of cap.entries()) {
        const lineKey = `${centroProd}|${linea}|${segOrigen.weekKey}`;
        let iteraciones = 0;
        while ((capRestante.get(lineKey) ?? 0) > 0 && iteraciones < 100) {
          iteraciones++;
          const capDisp = capRestante.get(lineKey) ?? 0;
          if (capDisp <= 0) break;

          const candidatos = deficitsByCL.get(`${centroProd}|${linea}`) ?? [];
          const activos = candidatos.filter((d) => {
            const targetIdx = indexByWeek.get(d.semanaKey) ?? -1;
            return targetIdx > i && (residualPorDeficit.get(idxPorDef.get(d)!) ?? 0) > 0;
          });
          if (activos.length === 0) break;

          const earliestTargetIdx = Math.min(
            ...activos.map((d) => indexByWeek.get(d.semanaKey)!),
          );
          const competidores = activos.filter(
            (d) => indexByWeek.get(d.semanaKey) === earliestTargetIdx,
          );

          const necMinDef = (d: Deficit) =>
            (residualPorDeficit.get(idxPorDef.get(d)!) ?? 0) * d.tupp;
          const totalNecMin = competidores.reduce((s, d) => s + necMinDef(d), 0);
          if (totalNecMin <= 0) break;

          const capParaUsar = Math.min(capDisp, totalNecMin);

          const grupoPropio = competidores.filter((d) => d.destino === 'C1000_PROPIO');
          const grupoTransfer = competidores.filter((d) => d.destino !== 'C1000_PROPIO');
          const necPropio = grupoPropio.reduce((s, d) => s + necMinDef(d), 0);
          const necTransfer = grupoTransfer.reduce((s, d) => s + necMinDef(d), 0);
          const totGen = necPropio + necTransfer;
          const capPropio = totGen > 0 ? capParaUsar * (necPropio / totGen) : 0;
          const capTransfer = totGen > 0 ? capParaUsar * (necTransfer / totGen) : 0;

          // Cota superior de uds por tope de bodega C2000 (solo destinos de
          // traslado). Infinity cuando no aplica (C1000_PROPIO o sin tope).
          // Cota por tope de bodega C2000, O(ventana): usa el stock del sector
          // precalculado por semana + las anticipaciones vivas mantenidas
          // incrementalmente. Equivalente exacto al cálculo O(n³) anterior.
          const capBoundPorTope = (d: Deficit): number => {
            if (d.destino === 'C1000_PROPIO') return Infinity;
            if (!esSectorC2000.has(d.material)) return Infinity;
            const targetIdx = indexByWeek.get(d.semanaKey) ?? -1;
            let maxStockEnVentana = 0;
            for (let w = i; w < targetIdx; w++) {
              const totalSemana = stockSectorPorIdx[w] + antVivasPorIdx[w];
              if (totalSemana > maxStockEnVentana) maxStockEnVentana = totalSemana;
            }
            const espacio = Math.max(0, stockCap.centro2000 - maxStockEnVentana);
            return Math.floor(espacio / d.tupp);
          };

          // Reparte `capGrupo` minutos en UNIDADES ENTERAS. Antes se hacía un
          // prorrateo proporcional con floor() por material: cuando muchos
          // materiales competían, la fracción de cada uno caía por debajo de 1
          // unidad, se redondeaba a 0 y el ocioso quedaba sin usar. Ahora:
          //  Fase 1: piso proporcional en unidades enteras (acotado por déficit
          //          residual y tope de bodega).
          //  Fase 2: el sobrante se reparte de a 1 unidad por material hasta
          //          agotar los minutos => no se pierde ocioso por redondeo.
          const procesarGrupo = (grupo: Deficit[], capGrupo: number): number => {
            if (capGrupo <= 0) return 0;
            const items = grupo
              .map((d) => {
                const idx = idxPorDef.get(d)!;
                const residual = residualPorDeficit.get(idx) ?? 0;
                const maxUds = Math.max(0, Math.min(residual, capBoundPorTope(d)));
                return { d, idx, tupp: Math.max(0.0001, d.tupp), maxUds, asign: 0 };
              })
              .filter((x) => x.maxUds > 0);
            if (items.length === 0) return 0;

            const totGrupoMin = items.reduce((s, x) => s + x.maxUds * x.tupp, 0);
            let minRestante = capGrupo;

            // Fase 1: piso proporcional en unidades enteras.
            for (const x of items) {
              if (totGrupoMin <= 0) break;
              const targetUds = (capGrupo * ((x.maxUds * x.tupp) / totGrupoMin)) / x.tupp;
              const uds = Math.min(x.maxUds, Math.floor(targetUds));
              if (uds > 0) {
                x.asign = uds;
                minRestante -= uds * x.tupp;
              }
            }

            // Fase 2: reparte el sobrante de a 1 unidad entera por material.
            let progreso = true;
            while (progreso && minRestante > 1e-9) {
              progreso = false;
              for (const x of items) {
                if (x.asign >= x.maxUds) continue;
                if (x.tupp > minRestante + 1e-9) continue;
                x.asign += 1;
                minRestante -= x.tupp;
                progreso = true;
              }
            }

            // Aplica las asignaciones al plan y al residual.
            let usadoMin = 0;
            for (const x of items) {
              if (x.asign <= 0) continue;
              plan.push({
                material: x.d.material,
                uds: x.asign,
                semanaOrigenKey: segOrigen.weekKey,
                semanaTargetKey: x.d.semanaKey,
                destino: x.d.destino,
                lineaProduccion: linea,
                centroProduccion: centroProd,
                tupp: x.d.tupp,
              });
              residualPorDeficit.set(x.idx, (residualPorDeficit.get(x.idx) ?? 0) - x.asign);
              usadoMin += x.asign * x.tupp;
              // Mantiene incremental el stock vivo del sector para capBoundPorTope:
              // la anticipación está "viva" desde su semana origen (i) hasta su target.
              if (x.d.destino !== 'C1000_PROPIO' && esSectorC2000.has(x.d.material)) {
                const ti = indexByWeek.get(x.d.semanaKey) ?? -1;
                for (let w = i; w < ti; w++) antVivasPorIdx[w] += x.asign;
              }
            }
            return usadoMin;
          };

          let usadoTotal = procesarGrupo(grupoPropio, capPropio)
            + procesarGrupo(grupoTransfer, capTransfer);
          // Reaprovecha minutos que el split propio/traslado o el redondeo
          // dejaron sin usar: una pasada final sobre ambos grupos juntos.
          const sobrante = capParaUsar - usadoTotal;
          if (sobrante >= 1e-9) {
            usadoTotal += procesarGrupo([...grupoPropio, ...grupoTransfer], sobrante);
          }
          if (usadoTotal <= 0) break;
          capRestante.set(lineKey, capDisp - usadoTotal);
        }
      }
    }
  }

  return plan;
}

// ============================================================================
// CORRECCIÓN DE IDLE A NIVEL LÍNEA
// ============================================================================

/**
 * Reescribe `idleSem` en cada fila del ledger usando la idle REAL de la línea
 * (capTotal − suma de minUsados de TODOS los materiales en esa línea/semana),
 * en lugar del cálculo per-row (engañoso) que sólo restaba lo de UN material.
 *
 * Esto permite que la columna "Idle" del Excel muestre el remanente real de
 * minutos disponibles de la línea, no un número inflado.
 */
function corregirIdleLineas(ledger: Iv5WeeklyRow[]): void {
  type Bucket = { capTotal: number; minUsadosTotal: number; rows: Iv5WeeklyRow[] };
  const buckets = new Map<string, Bucket>();
  for (const r of ledger) {
    const k = `${r.centro}|${r.linea}|${r.weekKey}`;
    let b = buckets.get(k);
    if (!b) {
      b = { capTotal: r.capTotal, minUsadosTotal: 0, rows: [] };
      buckets.set(k, b);
    }
    b.minUsadosTotal += r.minUsados;
    b.rows.push(r);
  }
  for (const b of buckets.values()) {
    const idleReal = Math.max(0, b.capTotal - b.minUsadosTotal);
    for (const r of b.rows) {
      r.idleSem = idleReal;
    }
  }
}

// ============================================================================
// FUNCIÓN PRINCIPAL
// ============================================================================

export function runIv5EngineRediseñado(
  params: Iv5EngineRediseñadoParams,
): Iv5EngineRediseñadoResult {
  const {
    weekSegments,
    effectiveData,
    tiemposCanon,
    activeSatKeysC1000,
    activeSatKeysC2000,
    maxExtrasHoras,
    horasExtrasFin,
    pioMap,
    stockCap,
    maxSabadosMes,
    wantC1000,
    wantC2000,
  } = params;

  const diagnosticos: Iv5DiagnosticEntry[] = [];

  if (!weekSegments.length) {
    return { resultC1000: null, resultC2000: null, diagnosticos, xeSinLineaC1000: [] };
  }

  const needsBundleC1000 = wantC1000
    ? buildIv5Needs({ centro: '1000', effectiveData, weekSegments, pioMap })
    : null;
  const needsBundleC2000 = wantC2000
    ? buildIv5Needs({ centro: '2000', effectiveData, weekSegments, pioMap })
    : null;

  const capacityC1000 = wantC1000 && needsBundleC1000
    ? buildIv5Capacity({
        centro: '1000',
        lineas: needsBundleC1000.lineas,
        weekSegments,
        tiemposCanon,
        activeSatKeys: activeSatKeysC1000,
        maxExtrasHoras,
        horasExtrasFin,
        maxSabadosMes,
      })
    : null;
  const capacityC2000 = wantC2000 && needsBundleC2000
    ? buildIv5Capacity({
        centro: '2000',
        lineas: needsBundleC2000.lineas,
        weekSegments,
        tiemposCanon,
        activeSatKeys: activeSatKeysC2000,
        maxExtrasHoras,
        horasExtrasFin,
        maxSabadosMes,
      })
    : null;

  const sortedSegs = [...weekSegments].sort((a, b) => {
    if (a.isoYear !== b.isoYear) return a.isoYear - b.isoYear;
    if (a.isoWeek !== b.isoWeek) return a.isoWeek - b.isoWeek;
    if (a.anio !== b.anio) return a.anio - b.anio;
    return a.mes - b.mes;
  });

  // Pasada 1
  const state1 = initState(
    needsBundleC1000?.metas ?? null,
    needsBundleC2000?.metas ?? null,
  );
  const ledgerC1000Pasada1: Iv5WeeklyRow[] = [];
  const ledgerC2000Pasada1: Iv5WeeklyRow[] = [];
  const xeSinLineaPasada1 = new Map<MaterialKey, { descripcion: string; cantidad: number }>();
  for (const seg of sortedSegs) {
    procesarSemana(
      seg,
      needsBundleC1000?.needs ?? [],
      needsBundleC2000?.needs ?? [],
      needsBundleC1000?.metas ?? new Map(),
      needsBundleC2000?.metas ?? new Map(),
      capacityC1000,
      capacityC2000,
      state1,
      ledgerC1000Pasada1,
      ledgerC2000Pasada1,
      wantC1000,
      wantC2000,
      [],
      xeSinLineaPasada1,
    );
  }

  const deficits = detectarDeficits(
    ledgerC1000Pasada1,
    ledgerC2000Pasada1,
    needsBundleC1000?.needs ?? [],
    needsBundleC2000?.needs ?? [],
    needsBundleC1000?.metas ?? new Map(),
    needsBundleC2000?.metas ?? new Map(),
  );

  let plan: AnticipacionPlaneada[] = [];
  if (deficits.length > 0) {
    plan = planificarAnticipaciones(
      deficits,
      ledgerC2000Pasada1,
      ledgerC1000Pasada1,
      capacityC1000,
      capacityC2000,
      sortedSegs,
      stockCap,
      needsBundleC2000?.metas ?? new Map(),
    );
  }

  let ledgerC1000Final: Iv5WeeklyRow[];
  let ledgerC2000Final: Iv5WeeklyRow[];
  // Colector de X/E sin línea C1000 correspondiente a la PASADA FINAL
  // (Pasada 1 si no hubo plan; Pasada 2 si hubo anticipaciones).
  let xeSinLineaFinal = xeSinLineaPasada1;

  if (plan.length === 0) {
    ledgerC1000Final = ledgerC1000Pasada1;
    ledgerC2000Final = ledgerC2000Pasada1;
  } else {
    const state2 = initState(
      needsBundleC1000?.metas ?? null,
      needsBundleC2000?.metas ?? null,
    );
    ledgerC1000Final = [];
    ledgerC2000Final = [];
    const xeSinLineaPasada2 = new Map<MaterialKey, { descripcion: string; cantidad: number }>();
    for (const seg of sortedSegs) {
      const anticipacionesEstaSemana = plan.filter(
        (p) => p.semanaOrigenKey === seg.weekKey,
      );
      procesarSemana(
        seg,
        needsBundleC1000?.needs ?? [],
        needsBundleC2000?.needs ?? [],
        needsBundleC1000?.metas ?? new Map(),
        needsBundleC2000?.metas ?? new Map(),
        capacityC1000,
        capacityC2000,
        state2,
        ledgerC1000Final,
        ledgerC2000Final,
        wantC1000,
        wantC2000,
        anticipacionesEstaSemana,
        xeSinLineaPasada2,
      );
    }
    xeSinLineaFinal = xeSinLineaPasada2;
  }

  // Materializa el reporte de X/E sin línea C1000 (ordenado por cantidad desc).
  const xeSinLineaC1000: Iv5XESinLineaC1000[] = Array.from(xeSinLineaFinal.entries())
    .map(([material, info]) => ({
      material,
      descripcion: info.descripcion,
      cantidad: Math.round(info.cantidad),
    }))
    .filter((x) => x.cantidad > 0)
    .sort((a, b) => b.cantidad - a.cantidad);

  // Corregir idleSem para que refleje el remanente REAL de la línea
  // (no el cálculo per-row que ignoraba a otros materiales de la misma línea).
  corregirIdleLineas(ledgerC1000Final);
  corregirIdleLineas(ledgerC2000Final);

  diagnosticos.push({
    severity: 'info',
    centro: wantC1000 ? '1000' : '2000',
    code: 'INFO',
    mensaje:
      `Motor rediseñado (Turno 3): Pasadas 1 y 2 ejecutadas. ${deficits.length} déficits ` +
      `identificados, ${plan.length} anticipaciones planeadas.`,
  });

  for (const row of [...ledgerC1000Final, ...ledgerC2000Final]) {
    if (row.alertaStockBajoSeguridad) {
      diagnosticos.push({
        severity: 'warn',
        centro: row.centro,
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
  }

  const monthlyC1000 = wantC1000 ? aggregateWeeklyToMonthly(ledgerC1000Final) : [];
  const monthlyC2000 = wantC2000 ? aggregateWeeklyToMonthly(ledgerC2000Final) : [];

  return {
    resultC1000: wantC1000
      ? {
          centro: '1000',
          ledger: ledgerC1000Final,
          monthly: monthlyC1000,
          diagnostics: diagnosticos.filter((d) => d.centro === '1000' || d.code === 'INFO'),
        }
      : null,
    resultC2000: wantC2000
      ? {
          centro: '2000',
          ledger: ledgerC2000Final,
          monthly: monthlyC2000,
          diagnostics: diagnosticos.filter((d) => d.centro === '2000' || d.code === 'INFO'),
        }
      : null,
    diagnosticos,
    xeSinLineaC1000,
  };
}
