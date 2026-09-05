/**
 * Etapa 3 IV5 - Progresiva semanal.
 *
 * Calcula semana a semana, en orden cronologico:
 *  1. necesidad efectiva al prorrateo:
 *        udsPropias = demanda + brecha objetivoEfectivo + backlog topado (Mejora 1)
 *        udsTraslado = necesidadTraslado
 *     - La brecha solo se considera para el prorrateo; el balance ledger es
 *       contra stockInicial real. Se recalcula **cada semana** con el stock
 *       vigente (si quedara fijada al stock inicial, meses posteriores
 *       seguirian pidiendo tiempo como si el inventario no hubiera subido).
 *     - El backlog acumulado (Mejora 1) se suma para que el prorrateo "vea"
 *       la deuda y reserve capacidad para drenarla. Se aplica un tope K=1:
 *       el backlog que entra al prorrateo nunca excede la demanda nueva de
 *       la semana, para evitar que un backlog heredado monopolice la linea.
 *  2. prorrateo proporcional puro: la capacidad de la linea se reparte entre
 *     materiales segun su tiempo total requerido (propio + traslado) y dentro
 *     de cada material entre necesidad propia y traslado proporcional a su
 *     tiempo, sin distincion por clase de aprovisionamiento.
 *  3. La produccion semanal = produccionBase (TODO el prorrateo, propio +
 *     traslado) + produccionAdelanto (la que el regresivo movio desde semanas
 *     futuras a esta semana) + produccionAlternativa + produccionPio.
 *  4. Despachos en C1000: cuando el disponible no alcanza, se reparten ventas
 *     propias (demanda + backlog completo, sin tope) y traslado saliente
 *     proporcional al pedido en uds. C2000 solo tiene ventas propias.
 *  5. Stock final = stockInicial + produccionTotal + traslEntrante - despachos
 *     - traslSaliente.
 *  6. backlogFinal = backlog inicial + demanda - despachos. Rolls a la siguiente.
 */

import { safeNumber } from '../../importar-ventasV2/components/utils';
import { getMesNombre } from '../../importar-ventasV2/components/utils';
import type {
  Centro,
  Iv5LineWeekCapacity,
  Iv5MaterialWeekNeed,
  Iv5WeeklyRow,
  LineaKey,
  MaterialKey,
  WeekKey,
} from './iv5Types';
import {
  type Iv5CapacityMatrix,
  getCapacityCell,
  reserveMinutes,
} from './iv5Capacity';
import {
  prorrateoNivel1y2,
  type MaterialDemandSlot,
} from './iv5Prorrateo';
import type { MaterialMeta } from './iv5Necesidad';
import type { Iv5AdvanceMap } from './iv5Regressive';

interface ProgressiveParams {
  centro: Centro;
  needs: Iv5MaterialWeekNeed[];
  metas: Map<MaterialKey, MaterialMeta>;
  capacity: Iv5CapacityMatrix;
  advances: Iv5AdvanceMap;
  /**
   * Solo C2000: traslado entrante semanal por (material, weekKey) que llega
   * desde C1000 (sale del ledger de la corrida previa de C1000). En C1000
   * debe quedar undefined o vacio.
   */
  trasladoEntranteByMatWeek?: Map<string, number>;
  /** Stock semanal por material (state mutable para poder consultarlo despues). */
  stockState?: Map<MaterialKey, number>;
  /** Backlog rolling por material (state mutable). */
  backlogState?: Map<MaterialKey, number>;
  /** Produccion en lineas alternativas por (`${altLinea}|${weekKey}|${material}`). */
  altProductionByKey?: Map<string, number>;
}

export interface Iv5ProgressiveResult {
  ledger: Iv5WeeklyRow[];
  stockState: Map<MaterialKey, number>;
  backlogState: Map<MaterialKey, number>;
  /** Por (material, weekKey) cuanto traslado salio del centro durante la semana. */
  trasladosSalientesPorMatSem: Map<string, number>;
  /** Por (material, weekKey) cuanto traslado entro al centro durante la semana. */
  trasladosEntrantesPorMatSem: Map<string, number>;
  /** Semanas ordenadas cronologicamente (weekKey unicos). */
  weekOrder: WeekKey[];
}

function keyMatWeek(material: MaterialKey, weekKey: WeekKey): string {
  return `${material}|${weekKey}`;
}

function keyLineWeek(linea: LineaKey, weekKey: WeekKey): string {
  return `${linea}|${weekKey}`;
}

/**
 * Reparte el disponible para salida de un material en C1000 entre ventas
 * propias (demanda + backlog) y traslado saliente (necesidad de envio a C2000)
 * proporcional al pedido en uds.
 *
 *  - Si el disponible cubre todo el pedido, ambos buckets se atienden al 100%.
 *  - Si no, el reparto es proporcional al peso de cada pedido en uds, con
 *    redondeo Floor + Mayor Residuo (el residuo va al bucket con mayor demanda
 *    pendiente).
 *
 * No introduce sesgo "ventas primero": ambos buckets sufren el recorte por
 * escasez con la misma proporcion. Esto es consistente con el prorrateo
 * proporcional puro aplicado a la capacidad de produccion.
 */
export function splitDespachoC1000(
  disponible: number,
  pedidoPropio: number,
  pedidoTraslado: number,
): { despachosVentas: number; trasladoSaliente: number } {
  const disp = Math.max(0, Math.floor(disponible));
  const propio = Math.max(0, Math.floor(pedidoPropio));
  const traslado = Math.max(0, Math.floor(pedidoTraslado));
  const totalPedido = propio + traslado;
  if (totalPedido <= 0 || disp <= 0) {
    return { despachosVentas: 0, trasladoSaliente: 0 };
  }
  if (disp >= totalPedido) {
    return { despachosVentas: propio, trasladoSaliente: traslado };
  }
  let despachosVentas = Math.min(propio, Math.floor((disp * propio) / totalPedido));
  let trasladoSaliente = Math.min(traslado, Math.floor((disp * traslado) / totalPedido));
  let residuo = disp - despachosVentas - trasladoSaliente;
  while (residuo > 0) {
    const restPropio = propio - despachosVentas;
    const restTras = traslado - trasladoSaliente;
    if (restPropio <= 0 && restTras <= 0) break;
    if (restPropio >= restTras && restPropio > 0) despachosVentas += 1;
    else if (restTras > 0) trasladoSaliente += 1;
    else despachosVentas += 1;
    residuo -= 1;
  }
  return { despachosVentas, trasladoSaliente };
}

export function runIv5Progressive(params: ProgressiveParams): Iv5ProgressiveResult {
  const {
    centro,
    needs,
    metas,
    capacity,
    advances,
    trasladoEntranteByMatWeek,
    stockState = new Map<MaterialKey, number>(),
    backlogState = new Map<MaterialKey, number>(),
    altProductionByKey,
  } = params;

  // Inicializa stock state con stockInicialAbs si aun no existe.
  for (const meta of metas.values()) {
    if (!stockState.has(meta.material)) {
      stockState.set(meta.material, meta.stockInicialAbs);
    }
    if (!backlogState.has(meta.material)) {
      backlogState.set(meta.material, 0);
    }
  }

  // Agrupa needs por (linea, weekKey)
  type LineSlot = { need: Iv5MaterialWeekNeed; trasladoSemana: number };
  const grouped = new Map<LineaKey, Map<WeekKey, LineSlot[]>>();
  const weekCellByKey = new Map<WeekKey, Iv5LineWeekCapacity>();

  for (const n of needs) {
    const meta = metas.get(n.material);
    if (!meta) continue;
    // En IV5 v3 la necesidad de traslado saliente vive directamente en
    // `n.necesidadTraslado` (la pone `buildIv5Needs` para C1000 a partir
    // de filas clase F con Centro=2000). En C2000 vale 0 y el traslado
    // se recibe via `trasladoEntranteByMatWeek`.
    const trasladoSemana = centro === '1000' ? safeNumber(n.necesidadTraslado) : 0;
    let byWeek = grouped.get(n.linea);
    if (!byWeek) {
      byWeek = new Map();
      grouped.set(n.linea, byWeek);
    }
    let arr = byWeek.get(n.weekKey);
    if (!arr) {
      arr = [];
      byWeek.set(n.weekKey, arr);
    }
    arr.push({ need: n, trasladoSemana });
    const cell = getCapacityCell(capacity, n.linea, n.weekKey);
    if (cell) weekCellByKey.set(n.weekKey, cell);
  }

  // Genera orden cronologico unificado por todos los weekKeys que aparezcan
  const allWeeks = new Map<WeekKey, Iv5LineWeekCapacity>();
  for (const [, byWeek] of grouped) {
    for (const wk of byWeek.keys()) {
      const cell = weekCellByKey.get(wk);
      if (cell) allWeeks.set(wk, cell);
    }
  }
  const weekOrder = [...allWeeks.entries()]
    .sort((a, b) => {
      if (a[1].isoYear !== b[1].isoYear) return a[1].isoYear - b[1].isoYear;
      if (a[1].isoWeek !== b[1].isoWeek) return a[1].isoWeek - b[1].isoWeek;
      if (a[1].anio !== b[1].anio) return a[1].anio - b[1].anio;
      return a[1].mes - b[1].mes;
    })
    .map((e) => e[0]);

  const ledger: Iv5WeeklyRow[] = [];
  const trasladosSalientesPorMatSem = new Map<string, number>();
  const trasladosEntrantesPorMatSem = new Map<string, number>();

  for (const weekKey of weekOrder) {
    for (const [linea, byWeek] of grouped.entries()) {
      const slots = byWeek.get(weekKey);
      if (!slots) continue;
      const cell = getCapacityCell(capacity, linea, weekKey);
      if (!cell) continue;

      // 1) Construye el slot agregado por material para el prorrateo:
      //    udsPropias = demanda + brecha objetivo + backlog topado (Mejora 1).
      //    udsTraslado = traslado a C2000 (solo C1000).
      type MatAggSlot = MaterialDemandSlot & { brechaObjetivo: number; demanda: number };
      const matAggregate = new Map<MaterialKey, MatAggSlot>();
      for (const s of slots) {
        const dem = Math.round(safeNumber(s.need.demanda));
        const tras = Math.round(safeNumber(s.trasladoSemana));
        const brecha = Math.max(
          0,
          Math.round(
            safeNumber(s.need.stockObjetivoEfectivo) - safeNumber(stockState.get(s.need.material) ?? 0),
          ),
        );
        const prev = matAggregate.get(s.need.material);
        if (!prev) {
          matAggregate.set(s.need.material, {
            material: s.need.material,
            uds: dem + tras + brecha,
            udsPropias: dem + brecha,
            udsTraslado: tras,
            tupp: s.need.tupp,
            brechaObjetivo: brecha,
            demanda: dem,
          });
        } else {
          prev.uds += dem + tras + brecha;
          prev.udsPropias += dem + brecha;
          prev.udsTraslado += tras;
          prev.brechaObjetivo += brecha;
          prev.demanda += dem;
        }
      }

      // Mejora 1: suma el backlog acumulado al prorrateo con tope K=1.
      //  - K=1 significa: el backlog que entra al prorrateo nunca excede la
      //    demanda nueva de la semana. Asi un backlog heredado grande no
      //    monopoliza la linea; se distribuye en varias semanas conforme
      //    aparecen demandas frescas.
      //  - Solo se suma para C1000 y C2000 donde la deuda es contra ventas
      //    propias. El traslado no genera backlog, por lo que no se ajusta
      //    `udsTraslado`.
      //  - El despacho sigue cobrando el backlog COMPLETO (sin tope) via
      //    `pedidoPropio = dem + backlogInicial`.
      for (const agg of matAggregate.values()) {
        const backlogActual = Math.max(0, Math.round(safeNumber(backlogState.get(agg.material) ?? 0)));
        if (backlogActual <= 0) continue;
        const backlogTopado = Math.min(backlogActual, agg.demanda);
        if (backlogTopado <= 0) continue;
        agg.udsPropias += backlogTopado;
        agg.uds += backlogTopado;
      }

      const slotsForProrrateo = Array.from(matAggregate.values());

      // 2) Prorrateo (capacity.minDisponibles ya descuenta lo reservado por la regresiva).
      const allocs = prorrateoNivel1y2(slotsForProrrateo, cell.minDisponibles);
      const allocByMat = new Map(allocs.map((a) => [a.material, a]));

      // Reserva los minutos efectivamente usados por la base.
      for (const a of allocs) {
        if (a.minutosUsados > 0) {
          reserveMinutes(capacity, linea, weekKey, a.minutosUsados);
        }
      }

      // 3) Construye filas ledger por material (una sola fila por material en (linea, weekKey)).
      const slotByMat = new Map<MaterialKey, LineSlot>();
      for (const s of slots) {
        if (!slotByMat.has(s.need.material)) slotByMat.set(s.need.material, s);
      }

      for (const [material, slot] of slotByMat.entries()) {
        const meta = metas.get(material)!;
        const need = slot.need;
        const stockInicial = safeNumber(stockState.get(material) ?? 0);
        const backlogInicial = safeNumber(backlogState.get(material) ?? 0);
        const advUds = advances.byKey.get(`${linea}|${weekKey}|${material}`) ?? 0;
        const alloc = allocByMat.get(material) ?? {
          material,
          udsAsignadas: 0,
          udsPropias: 0,
          udsTraslado: 0,
          minutosUsados: 0,
        };

        // Produccion alternativa: lo que la Etapa 2 reservo en otras lineas para este material/semana
        let produccionAlternativa = 0;
        if (altProductionByKey) {
          for (const [altKey, uds] of altProductionByKey.entries()) {
            // altKey: `${altLinea}|${weekKey}|${material}`
            const parts = altKey.split('|');
            if (parts.length < 3) continue;
            const wk = parts[parts.length - 2];
            const mat = parts[parts.length - 1];
            const altLinea = parts.slice(0, parts.length - 2).join('|');
            if (mat === material && wk === weekKey && altLinea !== linea) {
              produccionAlternativa += uds;
            }
          }
        }

        // produccionBase = TODO lo asignado por el prorrateo (propio + traslado).
        // El split entre necesidades propias y traslado lo hace el reparto del
        // disponible mas abajo, NO la variable de produccion. Mantener
        // udsAsignadas evita que las unidades reservadas para traslado se
        // pierdan al contabilizar minutos vs producto.
        const produccionBase = alloc.udsAsignadas;
        const produccionAdelanto = advUds;
        const produccionTotalSinPio = produccionBase + produccionAdelanto + produccionAlternativa;
        const dem = Math.round(safeNumber(need.demanda));
        const tras = Math.round(safeNumber(slot.trasladoSemana));

        // Traslado entrante (solo C2000): sale del ledger previo de C1000 y llega
        // como suministro adicional a la disponibilidad de la semana.
        const trasladoEntrante =
          centro === '2000'
            ? Math.round(safeNumber(trasladoEntranteByMatWeek?.get(keyMatWeek(material, weekKey)) ?? 0))
            : 0;

        // Despachos:
        // - C2000: todas las salidas son ventas (no hay traslado saliente).
        // - C1000: ventas propias y traslado saliente se reparten proporcional
        //   al pedido en uds (politica proporcional pura). El prorrateo ya
        //   asigno la mezcla propio/traslado en produccionBase via
        //   alloc.udsPropias y alloc.udsTraslado; el despacho no impone
        //   prioridad "propio primero".
        const disponibleParaSalida = stockInicial + produccionTotalSinPio + trasladoEntrante;
        let despachosVentas = 0;
        let trasladoSaliente = 0;
        if (centro === '1000') {
          const split = splitDespachoC1000(
            disponibleParaSalida,
            dem + backlogInicial,
            tras,
          );
          despachosVentas = split.despachosVentas;
          trasladoSaliente = split.trasladoSaliente;
        } else {
          const needV = dem + backlogInicial;
          despachosVentas = Math.min(disponibleParaSalida, needV);
        }

        const stockFinal = Math.max(
          0,
          disponibleParaSalida - despachosVentas - trasladoSaliente,
        );
        const backlogGenerado = Math.max(0, dem + backlogInicial - despachosVentas);
        const backlogFinal = backlogGenerado;

        stockState.set(material, stockFinal);
        backlogState.set(material, backlogFinal);

        if (trasladoSaliente > 0) {
          const k = keyMatWeek(material, weekKey);
          trasladosSalientesPorMatSem.set(k, (trasladosSalientesPorMatSem.get(k) ?? 0) + trasladoSaliente);
        }
        if (trasladoEntrante > 0) {
          const k = keyMatWeek(material, weekKey);
          trasladosEntrantesPorMatSem.set(k, (trasladosEntrantesPorMatSem.get(k) ?? 0) + trasladoEntrante);
        }

        const stockSeguridad = need.stockSeguridad;
        const stockObjetivoEfectivo = need.stockObjetivoEfectivo;
        const alertaStockBajoSeguridad = stockFinal < stockSeguridad;
        const idleSem = cell.minDisponibles;

        ledger.push({
          centro,
          linea,
          material,
          weekKey,
          satKey: cell.satKey,
          isoWeek: cell.isoWeek,
          isoYear: cell.isoYear,
          mes: cell.mes,
          anio: cell.anio,
          sectorRef: meta.sectorRef,
          descripcion: meta.descripcion,
          mesNombre: getMesNombre(cell.mes),
          tupp: need.tupp,
          diasLV: cell.diasLV,
          sabadoActivo: cell.sabadoActivo,
          capJN: cell.capJN,
          capHE: cell.capHE,
          capSab: cell.capSab,
          capTotal: cell.capTotal,
          minUsados: produccionTotalSinPio * need.tupp,
          idleSem,
          demanda: dem,
          necesidadTrasladoSemana: tras,
          despachosVentas,
          trasladoSaliente,
          trasladoEntrante,
          produccionBase,
          produccionAlternativa,
          produccionAdelanto,
          produccionPio: 0,
          stockInicial,
          stockFinal,
          stockSeguridad,
          stockObjetivoEfectivo,
          backlogInicial,
          backlogGenerado,
          backlogFinal,
          alertaStockBajoSeguridad,
          alertaTopeAgregado: false,
        });
      }
    }
  }

  return {
    ledger,
    stockState,
    backlogState,
    trasladosSalientesPorMatSem,
    trasladosEntrantesPorMatSem,
    weekOrder,
  };
}
