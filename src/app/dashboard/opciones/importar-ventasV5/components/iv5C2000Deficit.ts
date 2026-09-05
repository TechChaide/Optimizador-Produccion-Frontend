/**
 * Pre-pase IV5 - Calculo de deficit semanal de C2000 para dimensionar
 * los traslados que se le pediran a C1000.
 *
 * Restaura la logica que IV2 tenia en `BottleneckClassTable`:
 *   necesidadSemana = demanda + backlogPrev + max(0, objetivoEfectivo - stockPrev)
 *   capPropiaEstim  = 0 si clase F (capacidad C2000 = 0 para esos materiales)
 *                   = prorrateo proporcional simple si clase X o E
 *   deficit         = max(0, necesidadSemana - stockPrev - capPropiaEstim)
 *
 * Diferencias con la version de IV2:
 *  - IV5 trabaja semana a semana con stock rolling (no mensual con distribucion).
 *  - El objetivo efectivo usa el invObjetivo PIO cuando esta definido y supera
 *    al stockSeguridad; sino se reduce al stockSeguridad como piso defensivo.
 *  - Para X/E con linea real en C2000, la capPropiaEstim se calcula con un
 *    mini-prorrateo proporcional al tiempo requerido por material en esa
 *    (linea, semana). No replica todas las etapas (regresiva, alternativas,
 *    PIO) porque eso solo afina pequenos ajustes; lo dominante es el factor
 *    "tiempo material / tiempo total linea".
 *
 * Salida: Map<material|weekKey, uds> con el deficit a pedir a C1000 + resumen
 * mensual para diagnostico.
 */

import { safeNumber } from '../../importar-ventasV2/components/utils';
import type { WeekSegment } from '../../plan-semanal/components/types';
import type { PioMap, TiempoCanonResult } from '../../importar-ventasV2/components/types';
import type { Iv5DiagnosticEntry, MaterialKey, SatKey, WeekKey } from './iv5Types';
import { buildIv5Capacity, getCapacityCell } from './iv5Capacity';
import { buildIv5Needs, type MaterialMeta } from './iv5Necesidad';
import { buildAlternativeLines } from './iv5MultiLine';

export interface ComputeC2000DeficitParams {
  effectiveData: any[];
  weekSegments: WeekSegment[];
  pioMap: PioMap;
  tiemposCanon: TiempoCanonResult[];
  activeSatKeysC2000: Set<SatKey>;
  maxExtrasHoras: number;
  horasExtrasFin: number;
  maxSabadosMes: number;
}

export interface Iv5C2000DeficitMonthSummary {
  mes: number;
  anio: number;
  totalDeficit: number;
  deficitF: number;
  deficitXE: number;
  materialesConDeficit: number;
}

export interface Iv5C2000DeficitResult {
  /** key: `${material}|${weekKey}` -> uds que C2000 necesita recibir como traslado. */
  deficitByMatWeek: Map<string, number>;
  /** Diagnostico (severity=info) con resumen mensual. */
  diagnostics: Iv5DiagnosticEntry[];
  /** Resumen mensual para debug visible. */
  summaryByMes: Iv5C2000DeficitMonthSummary[];
  /** Solo informativo: clase de cada material (F vs X/E) tal como lo ve el motor. */
  esClaseFByMat: Map<MaterialKey, boolean>;
}

function keyMatWeek(material: MaterialKey, weekKey: WeekKey): string {
  return `${material}|${weekKey}`;
}

/**
 * Calcula el deficit semanal de C2000 para cada material, asumiendo que el
 * traslado pedido SI se entrega completo. Esta es la estimacion ideal que
 * C2000 le presenta a C1000; el motor final puede entregar menos si C1000
 * no tiene capacidad, pero esa decision queda en la pasada real de C1000.
 */
export function computeC2000Deficits(
  params: ComputeC2000DeficitParams,
): Iv5C2000DeficitResult {
  const {
    effectiveData,
    weekSegments,
    pioMap,
    tiemposCanon,
    activeSatKeysC2000,
    maxExtrasHoras,
    horasExtrasFin,
    maxSabadosMes,
  } = params;

  const deficitByMatWeek = new Map<string, number>();
  const diagnostics: Iv5DiagnosticEntry[] = [];
  const summaryByMes: Iv5C2000DeficitMonthSummary[] = [];
  const esClaseFByMat = new Map<MaterialKey, boolean>();

  if (!weekSegments.length || !effectiveData.length) {
    return { deficitByMatWeek, diagnostics, summaryByMes, esClaseFByMat };
  }

  // 1) Construye necesidades de C2000 (incluye filas TRANSFER_IN como shadow needs).
  const needsBundle = buildIv5Needs({
    centro: '2000',
    effectiveData,
    weekSegments,
    pioMap,
  });

  // 2) Capacidad de C2000 por linea/semana (la linea virtual saldra con capTotal=0).
  // Se incluyen lineas alternativas para no subestimar la capacidad propia de C2000
  // (omitirlas provocaba que el pre-pase reportara un deficit mayor al real, lo que
  // se traducia en traslados exagerados pedidos a C1000).
  const alternatives = buildAlternativeLines(effectiveData, '2000', needsBundle.metas);
  const allLineasC2000 = new Set<string>(needsBundle.lineas);
  for (const alts of alternatives.values()) for (const a of alts) allLineasC2000.add(a);

  const capacity = buildIv5Capacity({
    centro: '2000',
    lineas: Array.from(allLineasC2000),
    weekSegments,
    tiemposCanon,
    activeSatKeys: activeSatKeysC2000,
    maxExtrasHoras,
    horasExtrasFin,
    maxSabadosMes,
  });

  // 3) Indice esClaseF por material (sirve para reporte y para que el caller
  //    decida si X/E con deficit deben generar TRANSFER_OUT en C1000).
  for (const meta of needsBundle.metas.values()) {
    esClaseFByMat.set(meta.material, !!meta.esClaseF);
  }

  // 4) Ordena semanas cronologicamente para hacer stock rolling.
  type WeekInfo = {
    weekKey: WeekKey;
    isoYear: number;
    isoWeek: number;
    mes: number;
    anio: number;
  };
  const allWeeks = new Map<WeekKey, WeekInfo>();
  for (const n of needsBundle.needs) {
    if (!allWeeks.has(n.weekKey)) {
      allWeeks.set(n.weekKey, {
        weekKey: n.weekKey,
        isoYear: n.isoYear,
        isoWeek: n.isoWeek,
        mes: n.mes,
        anio: n.anio,
      });
    }
  }
  const weekOrder = Array.from(allWeeks.values()).sort((a, b) => {
    if (a.isoYear !== b.isoYear) return a.isoYear - b.isoYear;
    if (a.isoWeek !== b.isoWeek) return a.isoWeek - b.isoWeek;
    if (a.anio !== b.anio) return a.anio - b.anio;
    return a.mes - b.mes;
  });

  // 5) Stock y backlog rolling por material (asumiendo que el traslado pedido
  //    se entrega completo: best-case desde el punto de vista C2000).
  const stockState = new Map<MaterialKey, number>();
  const backlogState = new Map<MaterialKey, number>();
  for (const meta of needsBundle.metas.values()) {
    stockState.set(meta.material, meta.stockInicialAbs);
    backlogState.set(meta.material, 0);
  }

  // 6) Agrupacion por (linea, semana) para calcular el prorrateo de cap propia X/E.
  type ProrrateoSlot = {
    material: MaterialKey;
    tupp: number;
    necesidadUds: number; // demanda + backlogPrev + brecha objetivo (lo que pedimos a la capacidad propia)
  };
  const slotsByLineWeek = new Map<string, ProrrateoSlot[]>();
  // Mapa rapido: por (material, weekKey) cuanto representa la "necesidad" calculada
  // (usada despues para calcular el deficit).
  const necesidadByMatWeek = new Map<string, number>();
  // Objetivo efectivo por material/semana (para diagnosticar origen del valor).
  const objetivoOrigenByMatWeek = new Map<string, 'PIO' | 'SEGURIDAD'>();

  // Helper: objetivo efectivo segun PIO o seguridad.
  const objetivoEfectivo = (
    meta: MaterialMeta,
    mes: number,
    stockSeguridad: number,
  ): { uds: number; origen: 'PIO' | 'SEGURIDAD' } => {
    const pio = pioMap.get(`${meta.material}|2000`);
    const invObj = pio ? safeNumber(pio.invObjetivo) : 0;
    if (invObj > 0 && invObj > stockSeguridad) {
      return { uds: invObj, origen: 'PIO' };
    }
    return { uds: stockSeguridad, origen: 'SEGURIDAD' };
  };

  // Resumen por mes (para diagnostico).
  const summaryMap = new Map<string, Iv5C2000DeficitMonthSummary>();
  const ensureSummary = (mes: number, anio: number): Iv5C2000DeficitMonthSummary => {
    const k = `${anio}|${mes}`;
    let s = summaryMap.get(k);
    if (!s) {
      s = { mes, anio, totalDeficit: 0, deficitF: 0, deficitXE: 0, materialesConDeficit: 0 };
      summaryMap.set(k, s);
    }
    return s;
  };

  // 7) Indice de needs por weekKey (todos los needs de C2000, incluyendo shadow).
  const needsByWeek = new Map<WeekKey, typeof needsBundle.needs>();
  for (const n of needsBundle.needs) {
    const arr = needsByWeek.get(n.weekKey) ?? [];
    arr.push(n);
    needsByWeek.set(n.weekKey, arr);
  }

  // 8) Loop principal: cronologico, semana a semana.
  for (const wi of weekOrder) {
    const needsThisWeek = needsByWeek.get(wi.weekKey) ?? [];

    // 8a) Construye slots por (linea, semana) y calcula necesidad por material.
    //     Para shadow needs (linea virtual / clase F), capacidad propia es 0 y
    //     toda la necesidad pasa directo a deficit.
    slotsByLineWeek.clear();
    for (const n of needsThisWeek) {
      const meta = needsBundle.metas.get(n.material);
      if (!meta) continue;
      const stockPrev = safeNumber(stockState.get(n.material) ?? 0);
      const backlogPrev = safeNumber(backlogState.get(n.material) ?? 0);
      const stockSeg = safeNumber(n.stockSeguridad);
      const obj = objetivoEfectivo(meta, n.mes, stockSeg);
      const brecha = Math.max(0, Math.round(obj.uds - stockPrev));
      const necesidadSemana =
        Math.round(safeNumber(n.demanda)) + Math.round(backlogPrev) + brecha;

      const matWeekKey = keyMatWeek(n.material, n.weekKey);
      necesidadByMatWeek.set(
        matWeekKey,
        (necesidadByMatWeek.get(matWeekKey) ?? 0) + necesidadSemana,
      );
      objetivoOrigenByMatWeek.set(matWeekKey, obj.origen);

      // Agrupa por (linea, weekKey) solo para slots con capacidad real > 0
      // (la linea virtual no entra al prorrateo porque su capTotal es 0).
      const cell = getCapacityCell(capacity, n.linea, n.weekKey);
      if (cell && cell.capTotal > 0 && necesidadSemana > 0 && safeNumber(n.tupp) > 0) {
        const lwKey = `${n.linea}|${n.weekKey}`;
        const arr = slotsByLineWeek.get(lwKey) ?? [];
        arr.push({
          material: n.material,
          tupp: safeNumber(n.tupp),
          necesidadUds: necesidadSemana,
        });
        slotsByLineWeek.set(lwKey, arr);
      }
    }

    // 8b) Prorrateo proporcional simple por (linea, semana): reparte minutos
    //     disponibles proporcional al tiempo total requerido por material.
    const capPropiaByMatWeek = new Map<string, number>();
    for (const [lwKey, slots] of slotsByLineWeek.entries()) {
      const [linea, weekKey] = lwKey.split('|') as [string, WeekKey];
      const cell = getCapacityCell(capacity, linea, weekKey);
      if (!cell) continue;
      const minutosDisp = cell.capTotal;
      let totalReqMin = 0;
      for (const s of slots) totalReqMin += s.necesidadUds * s.tupp;
      if (totalReqMin <= 0 || minutosDisp <= 0) continue;
      const factor = Math.min(1, minutosDisp / totalReqMin);
      for (const s of slots) {
        const minsAsignados = s.necesidadUds * s.tupp * factor;
        const udsAsignadas = Math.max(0, Math.floor(minsAsignados / Math.max(0.0001, s.tupp)));
        const cap = Math.min(udsAsignadas, s.necesidadUds);
        const mwk = keyMatWeek(s.material, weekKey);
        capPropiaByMatWeek.set(mwk, (capPropiaByMatWeek.get(mwk) ?? 0) + cap);
      }
    }

    // 8c) Calcula deficit por material y actualiza stock/backlog asumiendo
    //     que el traslado pedido SI se entrega (best-case desde C2000).
    for (const n of needsThisWeek) {
      const matWeekKey = keyMatWeek(n.material, n.weekKey);
      // Solo procesa cada (material, weekKey) una vez aunque haya shadow + real.
      // Para ello consumimos la entrada y la borramos.
      if (!necesidadByMatWeek.has(matWeekKey)) continue;
      const necesidadSemana = necesidadByMatWeek.get(matWeekKey) ?? 0;
      necesidadByMatWeek.delete(matWeekKey);

      const meta = needsBundle.metas.get(n.material);
      if (!meta) continue;

      const stockPrev = safeNumber(stockState.get(n.material) ?? 0);
      const backlogPrev = safeNumber(backlogState.get(n.material) ?? 0);
      const capPropia = capPropiaByMatWeek.get(matWeekKey) ?? 0;
      const deficit = Math.max(0, necesidadSemana - stockPrev - capPropia);
      const demSem = Math.round(safeNumber(n.demanda));

      if (deficit > 0) {
        deficitByMatWeek.set(
          matWeekKey,
          (deficitByMatWeek.get(matWeekKey) ?? 0) + deficit,
        );
        const sum = ensureSummary(n.mes, n.anio);
        sum.totalDeficit += deficit;
        if (meta.esClaseF) sum.deficitF += deficit;
        else sum.deficitXE += deficit;
        sum.materialesConDeficit += 1;
      }

      // Stock rolling best-case: asumimos que C1000 cubre el deficit pedido.
      const suministro = capPropia + deficit; // capacidad propia + lo que pediremos a C1000
      const disponible = stockPrev + suministro;
      const pedido = demSem + backlogPrev;
      const despachos = Math.min(disponible, pedido);
      const stockFin = Math.max(0, disponible - despachos);
      const backFin = Math.max(0, pedido - despachos);
      stockState.set(n.material, stockFin);
      backlogState.set(n.material, backFin);
    }
  }

  // 9) Construye lista ordenada de resumen mensual.
  for (const s of summaryMap.values()) summaryByMes.push(s);
  summaryByMes.sort((a, b) => (a.anio - b.anio) || (a.mes - b.mes));

  // 10) Diagnostico resumido (1 entrada por mes) - severity info, no warning.
  for (const s of summaryByMes) {
    diagnostics.push({
      severity: 'info',
      centro: '2000',
      mes: s.mes,
      anio: s.anio,
      code: 'INFO',
      mensaje:
        `Deficit C2000 estimado mes ${s.mes}/${s.anio}: total ${Math.round(s.totalDeficit)} uds` +
        ` (F=${Math.round(s.deficitF)}, X/E=${Math.round(s.deficitXE)}).`,
      data: {
        totalDeficit: Math.round(s.totalDeficit),
        deficitF: Math.round(s.deficitF),
        deficitXE: Math.round(s.deficitXE),
        materialesConDeficit: s.materialesConDeficit,
      },
    });
  }

  return { deficitByMatWeek, diagnostics, summaryByMes, esClaseFByMat };
}
