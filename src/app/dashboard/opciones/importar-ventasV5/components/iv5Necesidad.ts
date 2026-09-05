/**
 * Necesidad semanal IV5 por (centro, linea, material, semana).
 *
 * El motor consume las filas de demanda ya ajustadas por el usuario (mismo shape
 * que `RawBackendDataTable.onDataLoaded`) y las distribuye a semanas usando
 * `distributeMonthlyToWeeks` (peso = diasLaborales del segmento).
 *
 * "Necesidad para prorrateo" = demanda de la semana + brecha vs objetivoEfectivo
 * (PIO si existe, sino stockSeguridad). El backlog acumulado se suma en la
 * progresiva, no aqui (ya que aqui aun no se conoce el balance).
 */

import type { WeekSegment } from '../../plan-semanal/components/types';
import { safeNumber, normalizeMaterialCode } from '../../importar-ventasV2/components/utils';
import type { PioMap } from '../../importar-ventasV2/components/types';
import type { Centro, Iv5MaterialWeekNeed, LineaKey, MaterialKey, WeekKey } from './iv5Types';
import { IV5_VIRTUAL_TRANSFER_LINE } from './iv5Constants';

/** Tres tipos de fila tras el agrupamiento de RawBackendDataTable. */
type RowKind = 'OWN' | 'TRANSFER_OUT' | 'TRANSFER_IN' | 'SKIP';

/**
 * Clasifica una fila de `effectiveData` para un centro dado (1000 o 2000):
 *  - OWN: fila A (Centro=1000) en C1000, fila C (Centro=2000 + no clase F) en C2000.
 *    -> Aporta `demanda` y consume capacidad propia del centro.
 *  - TRANSFER_OUT: solo en C1000. Fila B (Centro=2000 + clase F).
 *    -> Aporta `necesidadTraslado` (obligacion de envio a C2000) y consume capacidad C1000.
 *  - TRANSFER_IN: solo en C2000. Fila B vista desde C2000.
 *    -> Aporta `demanda` con linea virtual (capacidad 0); el suministro llega como
 *       trasladoEntrante desde la corrida de C1000.
 *  - SKIP: la fila no aplica al centro analizado.
 */
function classifyRow(r: any, centro: Centro): RowKind {
  const orig = String(r.Centro ?? '').trim();
  const esF =
    Boolean(r._isAgregatedF) ||
    String(r.ClaseAprovisionam ?? '').trim().toUpperCase() === 'F';
  if (centro === '1000') {
    if (orig === '1000') return 'OWN';
    if (orig === '2000' && esF) return 'TRANSFER_OUT';
    return 'SKIP';
  }
  if (centro === '2000') {
    if (orig === '2000' && esF) return 'TRANSFER_IN';
    if (orig === '2000' && !esF) return 'OWN';
    return 'SKIP';
  }
  return 'SKIP';
}

interface MaterialMonthlyAggregated {
  centro: Centro;
  /** Linea de fabricacion para necesidades OWN/TRANSFER_OUT (real). */
  linea: LineaKey;
  material: MaterialKey;
  mes: number;
  anio: number;
  /** Demanda propia del centro (ventas a sus clientes). */
  demanda: number;
  /** Solo C1000: obligacion de produccion para enviar a C2000 (filas B). */
  necesidadTraslado: number;
  /** Solo C2000: demanda atribuible a clase F que se cubrira con traslado entrante. */
  demandaTransferIn: number;
  stockActualInicial: number;
  stockSeguridad: number;
  stockObjetivoEfectivo: number;
  tupp: number;
  sectorRef: string;
  descripcion: string;
}

export interface MaterialMeta {
  material: MaterialKey;
  centro: Centro;
  /** Linea fija (la que viene del backend o seleccionada por mayoria). */
  lineaFija: LineaKey;
  /** Stock inicial absoluto (primer mes en el horizonte). */
  stockInicialAbs: number;
  /** Mapa por (`${anio}-${mes}`) de stockSeguridad y objetivoEfectivo. Clave compuesta para soportar horizontes multi-año. */
  byMonth: Map<string, { stockSeguridad: number; stockObjetivoEfectivo: number; demanda: number; tupp: number; }>;
  sectorRef: string;
  descripcion: string;
  /** Tiempo unitario (min/uds) representativo (ponderado por demanda). */
  tuppRepresentativo: number;
  /** Indica si en algun mes hubo `_isAgregatedF` (clase F). Solo informativo. */
  esClaseF: boolean;
}

/**
 * Distribuye un total mensual entre los `WeekSegment[]` de ese mes, usando
 * el metodo de mayor residuo (entero exacto): asigna `floor(prop * total)` y
 * reparte el residuo a las semanas con mayor parte fraccional.
 */
export function distributeMonthlyToWeeks(total: number, segs: WeekSegment[]): Map<WeekKey, number> {
  const out = new Map<WeekKey, number>();
  const totalInt = Math.round(safeNumber(total));
  if (segs.length === 0) return out;
  const totalDias = segs.reduce((s, m) => s + m.diasLaborales, 0);
  if (totalInt === 0 || totalDias <= 0) {
    for (const seg of segs) out.set(seg.weekKey, 0);
    return out;
  }
  const items = segs.map(seg => {
    const exact = (totalInt * seg.diasLaborales) / totalDias;
    const base = Math.floor(exact);
    return { seg, base, frac: exact - base };
  });
  let assigned = items.reduce((s, it) => s + it.base, 0);
  let remainder = totalInt - assigned;
  const sorted = [...items].sort((a, b) => b.frac - a.frac);
  for (let i = 0; i < sorted.length && remainder > 0; i++) {
    sorted[i].base += 1;
    remainder -= 1;
  }
  for (let i = sorted.length - 1; i >= 0 && remainder < 0; i--) {
    if (sorted[i].base > 0) {
      sorted[i].base -= 1;
      remainder += 1;
    }
  }
  for (const it of items) out.set(it.seg.weekKey, it.base);
  return out;
}

function getMesNumero(raw: unknown): number {
  const v = Number(raw);
  if (!Number.isFinite(v) || v < 1 || v > 12) return 0;
  return v;
}

function pickLineaFija(rows: any[]): LineaKey {
  // Mayor demanda (ponderada por UnidadesProyectado) decide la linea fija.
  // Solo se consideran filas con `kind != 'TRANSFER_IN'` para no apuntar a la
  // linea virtual al elegir la linea fabril del material.
  const counts = new Map<string, number>();
  for (const r of rows) {
    const k = String(r.LineaFabricacion ?? r.lineaRef ?? '').trim();
    if (!k) continue;
    counts.set(k, (counts.get(k) ?? 0) + safeNumber(r.UnidadesProyectado));
  }
  let bestKey = '';
  let bestVal = -1;
  for (const [k, v] of counts.entries()) {
    if (v > bestVal) {
      bestVal = v;
      bestKey = k;
    }
  }
  return bestKey || (rows[0] ? String(rows[0].LineaFabricacion ?? rows[0].lineaRef ?? '') : '');
}

interface BuildNeedsParams {
  centro: Centro;
  effectiveData: any[];
  weekSegments: WeekSegment[];
  pioMap: PioMap;
  /**
   * Solo aplica a centro='1000'. Mapa `${material}|${weekKey}` -> uds que
   * C2000 necesita recibir como traslado en esa semana. Si esta definido,
   * REEMPLAZA la `necesidadTraslado` calculada por defecto (que asumia
   * "demanda bruta clase F"). Permite que el motor pida a C1000 exactamente
   * el deficit calculado por el pre-pase C2000 (tanto clase F como X/E).
   */
  deficitC2000ByMatWeek?: Map<string, number>;
}

export interface Iv5NeedsBundle {
  /** Tupla flat lista para iterar por (linea, weekKey). */
  needs: Iv5MaterialWeekNeed[];
  /** Material -> meta. Util para acceder a stock inicial y descripciones. */
  metas: Map<MaterialKey, MaterialMeta>;
  /** Lineas distintas que aparecen como linea fija de algun material. */
  lineas: LineaKey[];
}

/**
 * Construye la necesidad semanal de un centro y los metadatos por material.
 *
 * Atribucion correcta (alineada con IV4):
 *  - C1000: la `demanda` viene SOLO de filas con `Centro=1000` (clientes C1000).
 *           La `necesidadTraslado` viene SOLO de filas con `Centro=2000`+claseF
 *           (obligacion de fabricar para enviar a C2000). Ambas usan la linea
 *           real del material en C1000.
 *  - C2000: la `demanda` total = filas C (no clase F) + filas B (clase F).
 *           Las filas C consumen capacidad propia de C2000 con su linea real;
 *           las filas B se modelan con `linea = IV5_VIRTUAL_TRANSFER_LINE`,
 *           cuya capacidad sera 0 (no consumen minutos en C2000) y su
 *           suministro entra como trasladoEntrante desde la corrida de C1000.
 *
 * Distribuye la demanda mensual a semanas L-V por mayor residuo y calcula
 * `stockObjetivoEfectivo = max(invObjetivo PIO, stockSeguridad)`.
 */
export function buildIv5Needs(params: BuildNeedsParams): Iv5NeedsBundle {
  const { centro, effectiveData, weekSegments, pioMap, deficitC2000ByMatWeek } = params;
  // Clave compuesta anio-mes para evitar colisiones en horizontes multi-año
  // (p.ej. enero-2026 y enero-2027 deben ser segmentos distintos).
  const segsByMes = new Map<string, WeekSegment[]>();
  for (const seg of weekSegments) {
    const mk = `${seg.anio}-${seg.mes}`;
    const arr = segsByMes.get(mk) ?? [];
    arr.push(seg);
    segsByMes.set(mk, arr);
  }

  // Pre-clasificacion: nos quedamos solo con filas que aportan algo a este centro.
  const filtered = effectiveData
    .map((r) => ({ row: r, kind: classifyRow(r, centro) }))
    .filter((x) => x.kind !== 'SKIP');

  // Agrupa por (material, mes). En C2000 las filas TRANSFER_IN aportan a
  // `demandaTransferIn`; las OWN aportan a `demanda`. En C1000, las
  // TRANSFER_OUT aportan a `necesidadTraslado` y las OWN a `demanda`.
  const byMatMes = new Map<string, MaterialMonthlyAggregated>();
  const matRows = new Map<MaterialKey, any[]>();
  /** Solo filas no-virtuales (OWN/TRANSFER_OUT en C1000, OWN en C2000). */
  const matRowsRealLine = new Map<MaterialKey, any[]>();
  const matFirstMonth = new Map<MaterialKey, number>(); // mesEpoch absoluto = anio*12 + mes

  for (const { row: r, kind } of filtered) {
    const code = normalizeMaterialCode(r.CodMaterial);
    const mesNum = getMesNumero(r.Mes);
    if (!mesNum) continue;
    const anio = safeNumber(r.Año ?? r['año'] ?? new Date().getFullYear());
    const epoch = anio * 12 + mesNum;
    const key = `${code}|${anio}|${mesNum}`;
    const linea = String(r.LineaFabricacion ?? r.lineaRef ?? '').trim();
    const sector = String(r.Sector ?? '').trim() || 'SIN SECTOR';
    const descripcion = String(r.NombreMaterial ?? r.Descripcion ?? r.descripcion ?? '').trim();
    const tupp =
      safeNumber(r.NumeroPuestos ?? 1) > 0
        ? safeNumber(r.TiempoPorUnidad) / safeNumber(r.NumeroPuestos ?? 1)
        : safeNumber(r.TiempoPorUnidad);
    const up = safeNumber(r.UnidadesProyectado);

    const aporteDemanda = kind === 'OWN' ? up : 0;
    const aporteTrasladoOut = kind === 'TRANSFER_OUT' ? up : 0;
    const aporteTransferIn = kind === 'TRANSFER_IN' ? up : 0;

    const prev = byMatMes.get(key);
    if (!prev) {
      byMatMes.set(key, {
        centro,
        linea: kind === 'TRANSFER_IN' ? '' : linea,
        material: code,
        mes: mesNum,
        anio,
        demanda: aporteDemanda,
        necesidadTraslado: aporteTrasladoOut,
        demandaTransferIn: aporteTransferIn,
        stockActualInicial: safeNumber(r.StockActual),
        stockSeguridad: safeNumber(r.StockSeguridad),
        stockObjetivoEfectivo: safeNumber(r.StockSeguridad),
        tupp,
        sectorRef: sector,
        descripcion,
      });
    } else {
      prev.demanda += aporteDemanda;
      prev.necesidadTraslado += aporteTrasladoOut;
      prev.demandaTransferIn += aporteTransferIn;
      prev.stockActualInicial = Math.max(prev.stockActualInicial, safeNumber(r.StockActual));
      prev.stockSeguridad = Math.max(prev.stockSeguridad, safeNumber(r.StockSeguridad));
      prev.stockObjetivoEfectivo = Math.max(prev.stockObjetivoEfectivo, safeNumber(r.StockSeguridad));
      // ponderar tupp por uds totales aportadas (demanda+traslado+transferIn)
      const aporteTotal = aporteDemanda + aporteTrasladoOut + aporteTransferIn;
      const totalAcumulado = prev.demanda + prev.necesidadTraslado + prev.demandaTransferIn;
      const wPrev = Math.max(0.0001, totalAcumulado - aporteTotal);
      const w = aporteTotal;
      if (w > 0) {
        prev.tupp = (prev.tupp * wPrev + tupp * w) / Math.max(0.0001, wPrev + w);
      }
      if (!prev.linea && kind !== 'TRANSFER_IN') prev.linea = linea;
      if (!prev.sectorRef || prev.sectorRef === 'SIN SECTOR') prev.sectorRef = sector;
      if (!prev.descripcion) prev.descripcion = descripcion;
    }

    const arr = matRows.get(code) ?? [];
    arr.push(r);
    matRows.set(code, arr);

    if (kind !== 'TRANSFER_IN') {
      const arr2 = matRowsRealLine.get(code) ?? [];
      arr2.push(r);
      matRowsRealLine.set(code, arr2);
    }

    const prevEpoch = matFirstMonth.get(code) ?? Infinity;
    if (epoch < prevEpoch) matFirstMonth.set(code, epoch);
  }

  // Aplica PIO (cuando exista) al objetivoEfectivo.
  for (const agg of byMatMes.values()) {
    const pio = pioMap.get(`${agg.material}|${agg.centro}`);
    const invObj = pio ? safeNumber(pio.invObjetivo) : 0;
    agg.stockObjetivoEfectivo = Math.max(agg.stockSeguridad, invObj);
  }

  // Construye metas por material. Para `lineaFija` solo se usan filas con
  // linea real (OWN o TRANSFER_OUT); las TRANSFER_IN no votan porque
  // su LineaFabricacion es de C1000 y nunca aplica a la capacidad de C2000.
  const metas = new Map<MaterialKey, MaterialMeta>();
  for (const [code, rows] of matRows.entries()) {
    const realRows = matRowsRealLine.get(code) ?? [];
    const onlyTransferIn = realRows.length === 0;
    const lineaFija = onlyTransferIn ? IV5_VIRTUAL_TRANSFER_LINE : pickLineaFija(realRows);
    const epochMin = matFirstMonth.get(code) ?? Infinity;
    let stockInicialAbs = 0;
    for (const r of rows) {
      const epoch = safeNumber(r.Año ?? r['año'] ?? 0) * 12 + getMesNumero(r.Mes);
      if (epoch === epochMin) {
        stockInicialAbs = Math.max(stockInicialAbs, safeNumber(r.StockActual));
      }
    }
    const byMonth = new Map<string, { stockSeguridad: number; stockObjetivoEfectivo: number; demanda: number; tupp: number; }>();
    let totalDem = 0;
    let totalTuppNum = 0;
    let esClaseF = false;
    let sectorRef = '';
    let descripcion = '';
    for (const agg of byMatMes.values()) {
      if (agg.material !== code) continue;
      const demandaTotalCentro = agg.demanda + agg.demandaTransferIn;
      byMonth.set(`${agg.anio}-${agg.mes}`, {
        stockSeguridad: agg.stockSeguridad,
        stockObjetivoEfectivo: agg.stockObjetivoEfectivo,
        demanda: demandaTotalCentro,
        tupp: agg.tupp,
      });
      totalDem += demandaTotalCentro;
      totalTuppNum += demandaTotalCentro * agg.tupp;
      if (!sectorRef && agg.sectorRef) sectorRef = agg.sectorRef;
      if (!descripcion && agg.descripcion) descripcion = agg.descripcion;
    }
    for (const r of rows) {
      if (r._isAgregatedF || String(r.ClaseAprovisionam ?? '').trim().toUpperCase() === 'F') {
        esClaseF = true;
        break;
      }
    }
    metas.set(code, {
      material: code,
      centro,
      lineaFija,
      stockInicialAbs,
      byMonth,
      sectorRef: sectorRef || 'SIN SECTOR',
      descripcion,
      tuppRepresentativo: totalDem > 0 ? totalTuppNum / totalDem : 0,
      esClaseF,
    });
  }

  // Genera necesidades semanales:
  //  - 1 need real por (material, semana) en `meta.lineaFija` con la `demanda`
  //    propia distribuida y la `necesidadTraslado` distribuida. Esta es la
  //    necesidad que va a prorrateo y reserva capacidad.
  //  - Si C2000 y el material tiene demanda TRANSFER_IN > 0 en el mes,
  //    se agrega un shadow need con `linea = IV5_VIRTUAL_TRANSFER_LINE` y
  //    demanda = parte semanal de TRANSFER_IN. Esa demanda no consume
  //    capacidad (la linea virtual tiene capTotal=0); su suministro llega
  //    como trasladoEntrante desde C1000.
  const needs: Iv5MaterialWeekNeed[] = [];
  const lineasSet = new Set<LineaKey>();

  // helpers para acceder a los datos por mes
  const aggByMatMes = new Map<string, MaterialMonthlyAggregated>();
  for (const agg of byMatMes.values()) aggByMatMes.set(`${agg.material}|${agg.anio}|${agg.mes}`, agg);

  for (const meta of metas.values()) {
    if (meta.lineaFija) lineasSet.add(meta.lineaFija);
    const tieneRealLineaC2000 = centro === '2000' && meta.lineaFija !== IV5_VIRTUAL_TRANSFER_LINE;

    for (const [mesKey, monthData] of meta.byMonth.entries()) {
      const sepIdx = mesKey.indexOf('-');
      const anio = Number(mesKey.slice(0, sepIdx));
      const mes = Number(mesKey.slice(sepIdx + 1));
      const segs = segsByMes.get(mesKey) ?? [];
      if (!segs.length) continue;
      const agg = aggByMatMes.get(`${meta.material}|${anio}|${mes}`);
      const demandaPropia = agg?.demanda ?? 0;
      const trasladoOut = agg?.necesidadTraslado ?? 0;
      // Si en C2000 el material tiene linea real (filas C), absorbe la demanda
      // TRANSFER_IN dentro de la demanda propia. Esto evita emitir dos filas
      // ledger (real + shadow) para el mismo (material, semana) y tratar a un
      // material clase F mal etiquetado como ambiguo.
      let transferIn = agg?.demandaTransferIn ?? 0;
      let demandaCombinada = demandaPropia;
      if (tieneRealLineaC2000 && transferIn > 0) {
        demandaCombinada += transferIn;
        transferIn = 0;
      }

      // Distribuir cada componente por separado
      const demDist = distributeMonthlyToWeeks(demandaCombinada, segs);
      const trasDist = distributeMonthlyToWeeks(trasladoOut, segs);
      const transferInDist = distributeMonthlyToWeeks(transferIn, segs);

      const lineaReal = meta.lineaFija;
      const tieneRealLine = lineaReal && lineaReal !== IV5_VIRTUAL_TRANSFER_LINE;

      for (const seg of segs) {
        const demSem = demDist.get(seg.weekKey) ?? 0;
        const trasSem = trasDist.get(seg.weekKey) ?? 0;
        const transferInSem = transferInDist.get(seg.weekKey) ?? 0;

        // Need en linea real (si existe). En C1000 lleva demanda + traslado out.
        // En C2000 (filas C), lleva solo demanda; transferIn va al shadow need.
        if (tieneRealLine) {
          needs.push({
            centro,
            linea: lineaReal,
            material: meta.material,
            weekKey: seg.weekKey,
            isoWeek: seg.isoWeek,
            isoYear: seg.isoYear,
            mes: seg.mes,
            anio: seg.anio,
            demanda: demSem,
            necesidadTraslado: trasSem,
            stockSeguridad: monthData.stockSeguridad,
            stockObjetivoEfectivo: monthData.stockObjetivoEfectivo,
            tupp: monthData.tupp,
            hasDemandaPropia: demSem > 0,
            sectorRef: meta.sectorRef,
            descripcion: meta.descripcion,
          });
        }

        // Shadow need (solo C2000) para demanda clase F que se cubre por traslado.
        if (centro === '2000' && transferInSem > 0) {
          lineasSet.add(IV5_VIRTUAL_TRANSFER_LINE);
          needs.push({
            centro,
            linea: IV5_VIRTUAL_TRANSFER_LINE,
            material: meta.material,
            weekKey: seg.weekKey,
            isoWeek: seg.isoWeek,
            isoYear: seg.isoYear,
            mes: seg.mes,
            anio: seg.anio,
            demanda: transferInSem,
            necesidadTraslado: 0,
            stockSeguridad: monthData.stockSeguridad,
            stockObjetivoEfectivo: monthData.stockObjetivoEfectivo,
            tupp: monthData.tupp,
            hasDemandaPropia: transferInSem > 0,
            sectorRef: meta.sectorRef,
            descripcion: meta.descripcion,
          });
        }
      }
    }
  }

  // Override de necesidadTraslado en C1000 con el deficit calculado por el
  // pre-pase C2000. Si el caller pasa `deficitC2000ByMatWeek` (solo cuando
  // centro=1000), se reemplaza el calculo "demanda bruta clase F" por el
  // deficit semanal real. Esto:
  //   1) Para clase F: reduce la cantidad pedida cuando el stock C2000 ya
  //      cubre parte de la demanda (antes pediamos la demanda completa).
  //   2) Para clase X/E: introduce traslado cuando la capacidad propia
  //      de C2000 no alcanza (antes no se pedia nada).
  if (centro === '1000' && deficitC2000ByMatWeek && deficitC2000ByMatWeek.size > 0) {
    // Indice de needs existentes por (material, weekKey).
    type NeedIndex = { idx: number; need: Iv5MaterialWeekNeed };
    const needIdx = new Map<string, NeedIndex>();
    for (let i = 0; i < needs.length; i++) {
      const n = needs[i];
      needIdx.set(`${n.material}|${n.weekKey}`, { idx: i, need: n });
    }

    // Indice de WeekSegment por weekKey para crear needs nuevos cuando hace falta.
    const segByKey = new Map<WeekKey, WeekSegment>();
    for (const s of weekSegments) segByKey.set(s.weekKey, s);

    // Indice por material -> primera fila real C1000 (Centro=1000) para
    // descubrir su LineaFabricacion en C1000. Necesario para X/E con
    // deficit que aun no aparecen como need C1000.
    const rowsByMatC1000 = new Map<MaterialKey, any>();
    for (const r of effectiveData) {
      const codigo = normalizeMaterialCode(r.CodMaterial);
      if (!codigo) continue;
      if (String(r.Centro ?? '').trim() !== '1000') continue;
      if (!rowsByMatC1000.has(codigo)) rowsByMatC1000.set(codigo, r);
    }

    // Indice por material -> stockSeguridad y stockObjetivoEfectivo segun
    // PIO de C2000 (mismo objetivo que C2000 espera al recibir el traslado).
    // Para needs nuevos sirven como referencias coherentes.
    const c2000DefaultsByMat = new Map<
      MaterialKey,
      { stockSeguridad: number; stockObjetivoEfectivo: number; sectorRef: string; descripcion: string; tupp: number }
    >();
    for (const r of effectiveData) {
      const codigo = normalizeMaterialCode(r.CodMaterial);
      if (!codigo || String(r.Centro ?? '').trim() !== '2000') continue;
      if (c2000DefaultsByMat.has(codigo)) continue;
      const ss = safeNumber(r.StockSeguridad);
      const pio = pioMap.get(`${codigo}|2000`);
      const invObj = pio ? safeNumber(pio.invObjetivo) : 0;
      const objetivo = invObj > 0 && invObj > ss ? invObj : ss;
      const tupp =
        safeNumber(r.NumeroPuestos ?? 1) > 0
          ? safeNumber(r.TiempoPorUnidad) / safeNumber(r.NumeroPuestos ?? 1)
          : safeNumber(r.TiempoPorUnidad);
      c2000DefaultsByMat.set(codigo, {
        stockSeguridad: ss,
        stockObjetivoEfectivo: objetivo,
        sectorRef: String(r.Sector ?? '').trim() || 'SIN SECTOR',
        descripcion: String(r.NombreMaterial ?? r.Descripcion ?? r.descripcion ?? '').trim(),
        tupp,
      });
    }

    // Acumula necesidadTraslado nueva por (material, weekKey) - los multiples
    // shadow/real needs pueden producir multiples entradas, pero el deficit
    // es uno solo por (material, weekKey). Limpiamos primero los traslados
    // viejos del agregado clase F y luego aplicamos el deficit.
    // Paso 1: poner necesidadTraslado=0 en todos los needs C1000 para que el
    // deficit reemplace por completo (no se sume al calculo previo).
    for (const n of needs) n.necesidadTraslado = 0;

    // Paso 2: asignar el deficit al need correspondiente o crear uno nuevo.
    for (const [matWeekKey, deficitUds] of deficitC2000ByMatWeek.entries()) {
      const def = Math.max(0, Math.round(deficitUds));
      if (def <= 0) continue;
      const [material, weekKey] = matWeekKey.split('|') as [MaterialKey, WeekKey];
      const existing = needIdx.get(matWeekKey);
      if (existing) {
        // Suma al need ya creado (puede que ya tenga demanda propia C1000).
        existing.need.necesidadTraslado += def;
        continue;
      }
      // No hay need C1000 aun para este (material, weekKey). Hace falta crear uno.
      const seg = segByKey.get(weekKey);
      if (!seg) continue;
      const rowC1000 = rowsByMatC1000.get(material);
      const c2k = c2000DefaultsByMat.get(material);
      // Linea: si el material existe en C1000, usa su LineaFabricacion;
      // en caso contrario el material no puede atenderse desde C1000 y se
      // omite (queda como deficit no cubierto, lo detectara el diagnostico).
      const lineaC1000 = rowC1000
        ? String(rowC1000.LineaFabricacion ?? rowC1000.lineaRef ?? '').trim()
        : '';
      if (!lineaC1000) continue;
      const tupp =
        rowC1000 && safeNumber(rowC1000.NumeroPuestos ?? 1) > 0
          ? safeNumber(rowC1000.TiempoPorUnidad) / safeNumber(rowC1000.NumeroPuestos ?? 1)
          : c2k?.tupp ?? 0;
      const sectorRef =
        String(rowC1000?.Sector ?? '').trim() || c2k?.sectorRef || 'SIN SECTOR';
      const descripcion =
        String(rowC1000?.NombreMaterial ?? rowC1000?.Descripcion ?? rowC1000?.descripcion ?? '').trim() ||
        c2k?.descripcion ||
        '';
      const stockSeguridad = c2k?.stockSeguridad ?? 0;
      const stockObjetivoEfectivo = c2k?.stockObjetivoEfectivo ?? stockSeguridad;
      const newNeed: Iv5MaterialWeekNeed = {
        centro: '1000',
        linea: lineaC1000,
        material,
        weekKey: seg.weekKey,
        isoWeek: seg.isoWeek,
        isoYear: seg.isoYear,
        mes: seg.mes,
        anio: seg.anio,
        demanda: 0,
        necesidadTraslado: def,
        stockSeguridad,
        stockObjetivoEfectivo,
        tupp,
        hasDemandaPropia: false,
        sectorRef,
        descripcion,
      };
      needs.push(newNeed);
      needIdx.set(matWeekKey, { idx: needs.length - 1, need: newNeed });
      lineasSet.add(lineaC1000);
    }
  }

  return {
    needs,
    metas,
    lineas: Array.from(lineasSet),
  };
}
