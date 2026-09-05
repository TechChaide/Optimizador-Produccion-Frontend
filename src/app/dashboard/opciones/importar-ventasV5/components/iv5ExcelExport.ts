/**
 * Exportacion multi-hoja IV5 (Q34).
 *
 * Estructura de hojas:
 *  - ResumenMensual{centro}: agregado por (sector, linea) por mes.
 *  - ResumenSemanal{centro}: agregado por (sector, linea) por (anio, isoWeek).
 *  - DetalleMaterialMensual{centro}: una fila por (material, mes).
 *  - DetalleMaterialSemanal{centro}: una fila por (material, weekKey).
 *  - Diagnostico: log completo de alertas.
 *  - CuadreDemanda: demanda backend vs demanda IV5 vs despachos vs backlog gen.
 *
 * Cada fila respeta la identidad:
 *   StockFinal = StockInicial + ProduccionTotal + TraslEntrantes - Despachos
 *                - TraslSalientes
 */

import { exportToXLSXMultiSheet, normalizeMaterialCode } from '../../importar-ventasV2/components/utils';
import type {
  Centro,
  Iv5DiagnosticEntry,
  Iv5MonthlySnapshot,
  Iv5RunResult,
  Iv5WeeklyRow,
} from './iv5Types';

interface ExportParams {
  resultC1000: Iv5RunResult | null;
  resultC2000: Iv5RunResult | null;
  effectiveData?: any[];
  filenamePrefix?: string;
}

/** Etiqueta del backend por (centro|material). */
function buildEtiquetaLookup(effectiveData?: any[]): Map<string, string> {
  const out = new Map<string, string>();
  for (const row of effectiveData ?? []) {
    const mat = normalizeMaterialCode(row.CodMaterial ?? '');
    const centro = String(row.Centro ?? '').trim();
    const etq = String(row.Etiqueta ?? '').trim();
    if (!mat || !centro || !etq) continue;
    const k = `${centro}|${mat}`;
    if (!out.has(k)) out.set(k, etq);
  }
  return out;
}

/**
 * Producción en SÁBADOS, por proporción del consumo de capacidad de la línea.
 * El consumo de capacidad va en orden JN -> HE -> Sábado. Para una (línea,
 * semana), los minutos de sábado usados = max(0, minUsadosLínea − (capJN+capHE)).
 * Esos minutos se reparten entre los materiales en proporción a su producción.
 * Devuelve mapas con las uds producidas en sábado por material y por línea,
 * en granularidad semanal y mensual.
 */
function buildSabadoMaps(weekly: Iv5WeeklyRow[]) {
  // 1) Totales de minutos usados por línea/semana (capJN/HE/Sab son de la línea).
  const lineAgg = new Map<string, { minUsados: number; capJN: number; capHE: number; capSab: number }>();
  for (const r of weekly) {
    const k = `${r.centro}|${r.linea}|${r.weekKey}`;
    let a = lineAgg.get(k);
    if (!a) {
      a = { minUsados: 0, capJN: r.capJN, capHE: r.capHE, capSab: r.capSab };
      lineAgg.set(k, a);
    }
    a.minUsados += r.minUsados;
  }
  // 2) Atribución proporcional de las uds de sábado a cada material.
  const byMatWeek = new Map<string, number>();   // centro|material|weekKey
  const byMatMes = new Map<string, number>();    // centro|material|anio|mes
  const byLineWeek = new Map<string, number>();  // centro|sector|linea|isoYear|isoWeek
  const byLineMes = new Map<string, number>();   // centro|sector|linea|anio|mes
  for (const r of weekly) {
    const a = lineAgg.get(`${r.centro}|${r.linea}|${r.weekKey}`)!;
    const satMinLinea = Math.max(0, a.minUsados - (a.capJN + a.capHE));
    const satUds = a.minUsados > 0 ? r.produccionBase * (satMinLinea / a.minUsados) : 0;
    byMatWeek.set(`${r.centro}|${r.material}|${r.weekKey}`, satUds);
    const add = (m: Map<string, number>, k: string) => m.set(k, (m.get(k) ?? 0) + satUds);
    add(byMatMes, `${r.centro}|${r.material}|${r.anio}|${r.mes}`);
    add(byLineWeek, `${r.centro}|${r.sectorRef}|${r.linea}|${r.isoYear}|${r.isoWeek}`);
    add(byLineMes, `${r.centro}|${r.sectorRef}|${r.linea}|${r.anio}|${r.mes}`);
  }
  return { byMatWeek, byMatMes, byLineWeek, byLineMes };
}

function totalProdMonthly(r: Iv5MonthlySnapshot): number {
  return r.produccionBase + r.produccionAlternativa + r.produccionAdelanto + r.produccionPio;
}
function totalProdWeekly(r: Iv5WeeklyRow): number {
  return r.produccionBase + r.produccionAlternativa + r.produccionAdelanto + r.produccionPio;
}

function buildResumenMensual(monthly: Iv5MonthlySnapshot[], satByLineMes: Map<string, number>): any[] {
  const buckets = new Map<string, any>();
  for (const r of monthly) {
    const k = `${r.centro}|${r.sectorRef}|${r.linea}|${r.anio}|${r.mes}`;
    let b = buckets.get(k);
    if (!b) {
      b = {
        Centro: r.centro,
        Sector: r.sectorRef,
        Linea: r.linea,
        Mes: r.mesNombre,
        MesNumero: r.mes,
        Anio: r.anio,
        DemandaVentas: 0,
        NecesidadTraslado: 0,
        DemandaPlan: 0,
        Despachos: 0,
        ProduccionBase: 0,
        ProduccionAdelanto: 0,
        ProduccionAlternativa: 0,
        ProduccionPIO: 0,
        ProduccionTotal: 0,
        TrasladoEntrante: 0,
        TrasladoSaliente: 0,
        StockInicial: 0,
        StockFinal: 0,
        StockReservadoFinal: 0,
        StockInicialFisico: 0,
        StockFinalFisico: 0,
        BacklogFinal: 0,
        CapTotal: 0,
        SabadosActivos: 0,
        ProduccionSabadoUds: 0,
        IdleMinutos: 0,
        Materiales: 0,
      };
      buckets.set(k, b);
    }
    b.DemandaVentas += r.demanda;
    b.NecesidadTraslado += r.necesidadTraslado;
    b.DemandaPlan += r.demandaPlan;
    b.Despachos += r.despachosVentas;
    b.ProduccionBase += r.produccionBase;
    b.ProduccionAdelanto += r.produccionAdelanto;
    b.ProduccionAlternativa += r.produccionAlternativa;
    b.ProduccionPIO += r.produccionPio;
    b.ProduccionTotal += totalProdMonthly(r);
    b.TrasladoEntrante += r.trasladoEntrante;
    b.TrasladoSaliente += r.trasladoSaliente;
    b.StockInicial += r.stockInicialMes;
    b.StockFinal += r.stockFinalMes;
    b.StockReservadoFinal += r.stockReservadoMes ?? 0;
    b.StockInicialFisico += r.stockInicialMes; // reservas iniciales del mes no se agregan acá
    b.StockFinalFisico += r.stockFinalFisicoMes ?? r.stockFinalMes + (r.stockReservadoMes ?? 0);
    b.BacklogFinal += r.backlogFinalMes;
    b.CapTotal += r.capTotalMes;
    b.SabadosActivos = Math.max(b.SabadosActivos, r.sabadosActivos);
    b.IdleMinutos += r.idleMes;
    b.Materiales += 1;
  }
  // Validación de identidad sobre el agregado
  for (const b of buckets.values()) {
    b.ProduccionSabadoUds = Math.round(
      satByLineMes.get(`${b.Centro}|${b.Sector}|${b.Linea}|${b.Anio}|${b.MesNumero}`) ?? 0,
    );
    b.ValidacionBalance =
      b.StockInicialFisico +
      b.ProduccionTotal +
      b.TrasladoEntrante -
      b.Despachos -
      b.TrasladoSaliente -
      b.StockFinalFisico;
  }
  return Array.from(buckets.values()).sort((a, b) => {
    if (a.Anio !== b.Anio) return a.Anio - b.Anio;
    if (a.MesNumero !== b.MesNumero) return a.MesNumero - b.MesNumero;
    if (a.Sector !== b.Sector) return String(a.Sector).localeCompare(String(b.Sector));
    return String(a.Linea).localeCompare(String(b.Linea));
  });
}

function buildResumenSemanal(weekly: Iv5WeeklyRow[], satByLineWeek: Map<string, number>): any[] {
  const buckets = new Map<string, any>();
  for (const r of weekly) {
    const k = `${r.centro}|${r.sectorRef}|${r.linea}|${r.isoYear}|${r.isoWeek}`;
    let b = buckets.get(k);
    if (!b) {
      b = {
        Centro: r.centro,
        Sector: r.sectorRef,
        Linea: r.linea,
        Anio: r.isoYear,
        Semana: r.isoWeek,
        WeekKey: r.weekKey,
        MesNombre: r.mesNombre,
        DiasLV: r.diasLV,
        SabadoActivo: r.sabadoActivo ? 1 : 0,
        DemandaVentas: 0,
        NecesidadTraslado: 0,
        DemandaPlan: 0,
        Despachos: 0,
        ProduccionBase: 0,
        ProduccionAdelanto: 0,
        ProduccionAlternativa: 0,
        ProduccionPIO: 0,
        ProduccionTotal: 0,
        TrasladoEntrante: 0,
        TrasladoSaliente: 0,
        StockInicial: 0,
        StockFinal: 0,
        StockReservadoInicial: 0,
        StockReservadoFinal: 0,
        StockInicialFisico: 0,
        StockFinalFisico: 0,
        BacklogInicial: 0,
        BacklogFinal: 0,
        CapTotal: 0,
        ProduccionSabadoUds: 0,
        IdleMinutos: 0,
        Materiales: 0,
      };
      buckets.set(k, b);
    }
    const stockResIni = r.stockReservadoInicial ?? 0;
    const stockResFin = r.stockReservado ?? 0;
    b.DemandaVentas += r.demanda;
    b.NecesidadTraslado += r.necesidadTrasladoSemana;
    b.DemandaPlan += r.demanda + r.necesidadTrasladoSemana;
    b.Despachos += r.despachosVentas;
    b.ProduccionBase += r.produccionBase;
    b.ProduccionAdelanto += r.produccionAdelanto;
    b.ProduccionAlternativa += r.produccionAlternativa;
    b.ProduccionPIO += r.produccionPio;
    b.ProduccionTotal += totalProdWeekly(r);
    b.TrasladoEntrante += r.trasladoEntrante;
    b.TrasladoSaliente += r.trasladoSaliente;
    b.StockInicial += r.stockInicial;
    b.StockFinal += r.stockFinal;
    b.StockReservadoInicial += stockResIni;
    b.StockReservadoFinal += stockResFin;
    b.StockInicialFisico += r.stockInicial + stockResIni;
    b.StockFinalFisico += r.stockFinalFisico ?? (r.stockFinal + stockResFin);
    b.BacklogInicial += r.backlogInicial;
    b.BacklogFinal += r.backlogFinal;
    b.CapTotal = Math.max(b.CapTotal, r.capTotal);
    b.IdleMinutos += r.idleSem;
    b.Materiales += 1;
  }
  // Validación de identidad sobre el agregado
  for (const b of buckets.values()) {
    b.ProduccionSabadoUds = Math.round(
      satByLineWeek.get(`${b.Centro}|${b.Sector}|${b.Linea}|${b.Anio}|${b.Semana}`) ?? 0,
    );
    b.ValidacionBalance =
      b.StockInicialFisico +
      b.ProduccionTotal +
      b.TrasladoEntrante -
      b.Despachos -
      b.TrasladoSaliente -
      b.StockFinalFisico;
  }
  return Array.from(buckets.values()).sort((a, b) => {
    if (a.Anio !== b.Anio) return a.Anio - b.Anio;
    if (a.Semana !== b.Semana) return a.Semana - b.Semana;
    if (a.Sector !== b.Sector) return String(a.Sector).localeCompare(String(b.Sector));
    return String(a.Linea).localeCompare(String(b.Linea));
  });
}

function buildDetalleMaterialMensual(
  monthly: Iv5MonthlySnapshot[],
  etiquetaLookup: Map<string, string>,
  satByMatMes: Map<string, number>,
): any[] {
  return monthly.map((r) => {
    const prodTotal = totalProdMonthly(r);
    const stockResFin = r.stockReservadoMes ?? 0;
    // Stock físico inicial: para el agregado mensual aproximamos como
    // stockInicialMes (no hay reservas iniciales mensuales explícitas).
    // Para validación más precisa usar la vista semanal.
    const stockFinFisico = r.stockFinalFisicoMes ?? (r.stockFinalMes + stockResFin);
    const stockIniFisico = r.stockInicialMes;
    // Identidad: stockFinFisico = stockIniFisico + prodTotal + trasladoEntrante - despachos - trasladoSaliente
    const validacion =
      stockIniFisico + prodTotal + r.trasladoEntrante - r.despachosVentas - r.trasladoSaliente - stockFinFisico;
    return {
      Centro: r.centro,
      Sector: r.sectorRef,
      Etiqueta: etiquetaLookup.get(`${r.centro}|${r.material}`) ?? '',
      Linea: r.linea,
      Material: r.material,
      Descripcion: r.descripcion,
      Mes: r.mesNombre,
      MesNumero: r.mes,
      Anio: r.anio,
      DemandaVentas: r.demanda,
      NecesidadTraslado: r.necesidadTraslado,
      DemandaPlan: r.demandaPlan,
      Despachos: r.despachosVentas,
      ProduccionBase: r.produccionBase,
      ProduccionAdelanto: r.produccionAdelanto,
      ProduccionAlternativa: r.produccionAlternativa,
      ProduccionPIO: r.produccionPio,
      ProduccionTotal: prodTotal,
      ProduccionSabadoUds: Math.round(satByMatMes.get(`${r.centro}|${r.material}|${r.anio}|${r.mes}`) ?? 0),
      // Traslados consolidados: TrasladoEntrante/Saliente ya incluyen normales,
      // anticipaciones (F y X/E) y respaldo X/E. No hay otras vías.
      TrasladoEntrante: r.trasladoEntrante,
      TrasladoSaliente: r.trasladoSaliente,
      StockInicial: r.stockInicialMes,
      StockFinal: r.stockFinalMes,
      // Columnas nuevas (motor rediseñado): stock reservado + stock físico total
      StockReservadoFinal: stockResFin,
      StockInicialFisico: stockIniFisico,
      StockFinalFisico: stockFinFisico,
      // Validación de identidad: debe ser 0 si todo cuadra
      // StockFinalFisico = StockInicialFisico + ProduccionTotal + TrasladoEntrante − Despachos − TrasladoSaliente
      ValidacionBalance: validacion,
      BacklogInicial: r.backlogInicialMes,
      BacklogFinal: r.backlogFinalMes,
      CapTotal: r.capTotalMes,
      Idle: r.idleMes,
      SabadosActivos: r.sabadosActivos,
      SemanasContadas: r.semanasContadas,
    };
  });
}

function buildDetalleMaterialSemanal(
  weekly: Iv5WeeklyRow[],
  etiquetaLookup: Map<string, string>,
  satByMatWeek: Map<string, number>,
): any[] {
  return weekly.map((r) => {
    const prodTotal = totalProdWeekly(r);
    const stockResIni = r.stockReservadoInicial ?? 0;
    const stockResFin = r.stockReservado ?? 0;
    const stockIniFisico = r.stockInicial + stockResIni;
    const stockFinFisico = r.stockFinalFisico ?? (r.stockFinal + stockResFin);
    // Identidad de balance físico:
    //   StockFinalFisico = StockInicialFisico + ProduccionTotal + TrasladoEntrante − Despachos − TrasladoSaliente
    const validacion =
      stockIniFisico + prodTotal + r.trasladoEntrante - r.despachosVentas - r.trasladoSaliente - stockFinFisico;
    return {
      Centro: r.centro,
      Sector: r.sectorRef,
      Etiqueta: etiquetaLookup.get(`${r.centro}|${r.material}`) ?? '',
      Linea: r.linea,
      Material: r.material,
      Descripcion: r.descripcion,
      Mes: r.mesNombre,
      Anio: r.anio,
      AnioISO: r.isoYear,
      Semana: r.isoWeek,
      WeekKey: r.weekKey,
      DiasLV: r.diasLV,
      SabadoActivo: r.sabadoActivo ? 1 : 0,
      DemandaVentas: r.demanda,
      NecesidadTraslado: r.necesidadTrasladoSemana,
      DemandaPlan: r.demanda + r.necesidadTrasladoSemana,
      Despachos: r.despachosVentas,
      ProduccionBase: r.produccionBase,
      ProduccionAdelanto: r.produccionAdelanto,
      ProduccionAlternativa: r.produccionAlternativa,
      ProduccionPIO: r.produccionPio,
      ProduccionTotal: prodTotal,
      ProduccionSabadoUds: Math.round(satByMatWeek.get(`${r.centro}|${r.material}|${r.weekKey}`) ?? 0),
      // Traslados consolidados: incluyen TODOS (normales, anticipaciones F,
      // anticipaciones X/E backup). Las entradas a C2000 incluyen también las
      // anticipaciones que llegan como reservas (no van a stock regular pero
      // sí cuentan como traslado físico).
      TrasladoEntrante: r.trasladoEntrante,
      TrasladoSaliente: r.trasladoSaliente,
      StockInicial: r.stockInicial,
      StockFinal: r.stockFinal,
      StockSeguridad: r.stockSeguridad,
      StockObjetivoEfectivo: r.stockObjetivoEfectivo,
      // Columnas nuevas: stock reservado + stock físico (motor rediseñado)
      StockReservadoInicial: stockResIni,
      StockReservadoFinal: stockResFin,
      StockInicialFisico: stockIniFisico,
      StockFinalFisico: stockFinFisico,
      // Validación de identidad: debe ser 0 si todo cuadra.
      // StockFinalFisico = StockInicialFisico + ProduccionTotal + TrasladoEntrante − Despachos − TrasladoSaliente
      ValidacionBalance: validacion,
      BacklogInicial: r.backlogInicial,
      BacklogGenerado: r.backlogGenerado,
      BacklogFinal: r.backlogFinal,
      AlertaStockBajoSeguridad: r.alertaStockBajoSeguridad ? 'SI' : '',
      AlertaTopeAgregado: r.alertaTopeAgregado ? 'SI' : '',
      CapJN: r.capJN,
      CapHE: r.capHE,
      CapSab: r.capSab,
      CapTotal: r.capTotal,
      MinUsados: r.minUsados,
      Idle: r.idleSem,
      Tupp: r.tupp,
    };
  });
}

function buildDiagnosticoSheet(diagnostics: Iv5DiagnosticEntry[]): any[] {
  return diagnostics.map((d) => ({
    Severidad: d.severity,
    Codigo: d.code,
    Centro: d.centro ?? '',
    Linea: d.linea ?? '',
    Material: d.material ?? '',
    Mes: d.mes ?? '',
    Anio: d.anio ?? '',
    AnioISO: d.isoYear ?? '',
    Semana: d.isoWeek ?? '',
    Mensaje: d.mensaje,
    Datos: d.data ? JSON.stringify(d.data) : '',
  }));
}

function buildBackendDemandLookup(effectiveData: any[]): Map<string, number> {
  const out = new Map<string, number>();
  for (const r of effectiveData) {
    const centro = String(r.Centro ?? '').trim();
    const material = String(r.CodigoArticulo ?? r.Material ?? '').trim().slice(-8);
    const anio = Number(r.Anio ?? r.anio ?? 0);
    const mes = Number(r.Mes ?? r.mes ?? 0);
    if (!centro || !material || !anio || !mes) continue;
    const k = `${centro}|${material}|${anio}|${mes}`;
    out.set(k, (out.get(k) ?? 0) + Number(r.UnidadesProyectado ?? 0));
  }
  return out;
}

function buildCuadreDemandaSheet(weekly: Iv5WeeklyRow[], backendDemand?: Map<string, number>): any[] {
  // Agrega por (centro, material, mes) demanda IV5 vs despachos vs backlogFinal vs demanda backend
  const buckets = new Map<string, any>();
  for (const r of weekly) {
    const k = `${r.centro}|${r.material}|${r.anio}|${r.mes}`;
    let b = buckets.get(k);
    if (!b) {
      const demBack = backendDemand?.get(k) ?? 0;
      b = {
        Centro: r.centro,
        Material: r.material,
        Sector: r.sectorRef,
        Mes: r.mesNombre,
        MesNumero: r.mes,
        Anio: r.anio,
        DemandaBackend: demBack,
        DemandaVentasIv5: 0,
        NecesidadTrasladoIv5: 0,
        DemandaPlanIv5: 0,
        Despachos: 0,
        BacklogFinal: 0,
        ProduccionTotal: 0,
        Diferencia_DemDesp: 0,
        Diferencia_BackendVsIv5: 0,
      };
      buckets.set(k, b);
    }
    b.DemandaVentasIv5 += r.demanda;
    b.NecesidadTrasladoIv5 += r.necesidadTrasladoSemana;
    b.DemandaPlanIv5 += r.demanda + r.necesidadTrasladoSemana;
    b.Despachos += r.despachosVentas;
    b.BacklogFinal = r.backlogFinal; // ultima semana
    b.ProduccionTotal += totalProdWeekly(r);
    b.Diferencia_DemDesp = b.DemandaVentasIv5 - b.Despachos;
    b.Diferencia_BackendVsIv5 = b.DemandaBackend - b.DemandaPlanIv5;
  }
  return Array.from(buckets.values()).sort((a, b) => {
    if (a.Centro !== b.Centro) return String(a.Centro).localeCompare(String(b.Centro));
    if (a.Anio !== b.Anio) return a.Anio - b.Anio;
    if (a.MesNumero !== b.MesNumero) return a.MesNumero - b.MesNumero;
    return String(a.Material).localeCompare(String(b.Material));
  });
}

function sheetName(prefix: string, centro: Centro): string {
  return `${prefix}${centro}`;
}

export function exportIv5Excel({ resultC1000, resultC2000, effectiveData, filenamePrefix = 'IV5' }: ExportParams): void {
  const sheets: { sheetName: string; data: any[] }[] = [];
  const etiquetaLookup = buildEtiquetaLookup(effectiveData);

  for (const r of [resultC1000, resultC2000].filter(Boolean) as Iv5RunResult[]) {
    const sab = buildSabadoMaps(r.ledger);
    sheets.push({
      sheetName: sheetName('ResumenMensual', r.centro),
      data: buildResumenMensual(r.monthly, sab.byLineMes),
    });
    sheets.push({
      sheetName: sheetName('ResumenSemanal', r.centro),
      data: buildResumenSemanal(r.ledger, sab.byLineWeek),
    });
    sheets.push({
      sheetName: sheetName('DetalleMatMen', r.centro),
      data: buildDetalleMaterialMensual(r.monthly, etiquetaLookup, sab.byMatMes),
    });
    sheets.push({
      sheetName: sheetName('DetalleMatSem', r.centro),
      data: buildDetalleMaterialSemanal(r.ledger, etiquetaLookup, sab.byMatWeek),
    });
  }

  const allDiags: Iv5DiagnosticEntry[] = [
    ...(resultC1000?.diagnostics ?? []),
    ...(resultC2000?.diagnostics ?? []),
  ];
  sheets.push({ sheetName: 'Diagnostico', data: buildDiagnosticoSheet(allDiags) });

  const allWeekly: Iv5WeeklyRow[] = [
    ...(resultC1000?.ledger ?? []),
    ...(resultC2000?.ledger ?? []),
  ];
  const backendDemand = effectiveData ? buildBackendDemandLookup(effectiveData) : undefined;
  sheets.push({ sheetName: 'CuadreDemanda', data: buildCuadreDemandaSheet(allWeekly, backendDemand) });

  exportToXLSXMultiSheet(sheets, filenamePrefix);
}
