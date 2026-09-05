/**
 * REPRO Paso 1 — Reproducción aislada del bug de anticipación.
 *
 * NO modifica el motor. Construye entradas sintéticas y corre el motor REAL
 * `runIv5EngineRediseñado` para observar si la anticipación aprovecha el
 * tiempo ocioso temprano (julio) para cubrir el déficit de fin de año (dic).
 *
 * Ejecutar:
 *   npx tsx src/app/dashboard/opciones/importar-ventasV5/fixtures/reproAnticipacion.ts
 */

import { runIv5EngineRediseñado } from '../components/iv5EngineRediseñado';
import { decidirSabados } from '../components/iv5SabadosDecision';
import type { WeekSegment } from '../../plan-semanal/components/types';
import type { Iv5MonthlySnapshot } from '../components/iv5Types';
import { normalizeMaterialCode } from '../../importar-ventasV2/components/utils';

const MESES = [6, 7, 8, 9, 10, 11, 12];
const NOMBRE_MES: Record<number, string> = {
  6: 'Junio', 7: 'Julio', 8: 'Agosto', 9: 'Septiembre',
  10: 'Octubre', 11: 'Noviembre', 12: 'Diciembre',
};

function makeWeekSegments(weeksPerMonth = 1): WeekSegment[] {
  const segs: WeekSegment[] = [];
  let iso = 1;
  for (const m of MESES) {
    for (let w = 0; w < weeksPerMonth; w++) {
      segs.push({
        isoWeek: iso,
        isoYear: 2026,
        mes: m,
        anio: 2026,
        diasLaborales: Math.round(20 / weeksPerMonth),
        tieneSabado: false,
        label: `M${m}-S${w + 1}`,
        weekKey: `2026W${iso}|2026-${m}`,
        satKey: `2026W${iso}`,
      });
      iso++;
    }
  }
  return segs;
}

/** tiemposCanon mínimo: capacidad JN (min) por mes para cada línea. */
function makeTiemposCanon(capByMonth: Record<number, number>, lineas: string[]): any[] {
  return MESES.map((m) => ({
    mesNumero: m,
    mes: m,
    data: lineas.map((l) => ({
      nombre_linea: l,
      minutos_horario_normal_TOTAL: capByMonth[m] ?? 0,
    })),
  }));
}

/** tiemposCanon con capacidad distinta por línea (para C1000 vs C2000). */
function makeTiemposCanonMultiLinea(capByLineMonth: Record<string, Record<number, number>>): any[] {
  const lineas = Object.keys(capByLineMonth);
  return MESES.map((m) => ({
    mesNumero: m,
    mes: m,
    data: lineas.map((l) => ({
      nombre_linea: l,
      minutos_horario_normal_TOTAL: capByLineMonth[l][m] ?? 0,
    })),
  }));
}

interface RowOpts {
  cod: string;
  centro: string;
  linea: string;
  demandByMonth: Record<number, number>;
  stockInicial: number;
  stockSeguridad: number;
  clase?: string; // 'F' | 'X' | 'E'
  tupp?: number;
  sector?: string;
}

function makeRows(o: RowOpts): any[] {
  return MESES.map((m) => ({
    CodMaterial: o.cod,
    Mes: m,
    ['Año']: 2026,
    Centro: o.centro,
    LineaFabricacion: o.linea,
    Sector: o.sector ?? '01 COLCHONES',
    NombreMaterial: `Material ${o.cod}`,
    NumeroPuestos: 1,
    TiempoPorUnidad: o.tupp ?? 1,
    UnidadesProyectado: o.demandByMonth[m] ?? 0,
    StockActual: o.stockInicial,
    StockSeguridad: o.stockSeguridad,
    ClaseAprovisionam: o.clase ?? 'X',
  }));
}

function printMonthly(title: string, monthly: Iv5MonthlySnapshot[]): void {
  console.log('\n' + title);
  console.log(
    'Mes        | Demanda |  Cap | Idle | ProdBase | Reservado | TrasSal | StockFin | Backlog',
  );
  console.log('-'.repeat(92));
  const sorted = [...monthly].sort((a, b) => a.mes - b.mes);
  const pad = (v: any, n: number) => String(v).padStart(n);
  for (const s of sorted) {
    console.log(
      [
        NOMBRE_MES[s.mes].padEnd(10),
        pad(Math.round(s.demanda), 7),
        pad(Math.round(s.capTotalMes), 5),
        pad(Math.round(s.idleMes), 5),
        pad(Math.round(s.produccionBase), 9),
        pad(Math.round(s.stockReservadoMes ?? 0), 10),
        pad(Math.round(s.trasladoSaliente), 8),
        pad(Math.round(s.stockFinalMes), 9),
        pad(Math.round(s.backlogFinalMes), 8),
      ].join(' |'),
    );
  }
}

// ============================================================================
// ESCENARIO 1 — Solo C1000, un material. Ocioso en jun-oct, pico en nov-dic.
// ============================================================================
/**
 * Verifica la identidad de conservación por material en todo el horizonte:
 *   stockInicial(1ª sem) + ΣProducción + ΣTrasEntrante
 *     === stockFinal(últ. sem) + stockReservado(últ.) + ΣDespachos + ΣTrasSaliente
 */
function verificarBalance(result: any, etiqueta: string): void {
  const ledger = (result?.ledger ?? []) as any[];
  const byMat = new Map<string, any[]>();
  for (const r of ledger) {
    const k = r.material + '|' + r.centro;
    if (!byMat.has(k)) byMat.set(k, []);
    byMat.get(k)!.push(r);
  }
  let maxErr = 0;
  for (const rows of byMat.values()) {
    rows.sort((a, b) => (a.isoYear - b.isoYear) || (a.isoWeek - b.isoWeek) || (a.mes - b.mes));
    const first = rows[0];
    const last = rows[rows.length - 1];
    let prod = 0, tEnt = 0, tSal = 0, desp = 0;
    for (const r of rows) {
      prod += (r.produccionBase || 0) + (r.produccionAlternativa || 0) + (r.produccionAdelanto || 0) + (r.produccionPio || 0);
      tEnt += r.trasladoEntrante || 0;
      tSal += r.trasladoSaliente || 0;
      desp += r.despachosVentas || 0;
    }
    const lhs = (first.stockInicial || 0) + prod + tEnt;
    const rhs = (last.stockFinal || 0) + (last.stockReservado || 0) + desp + tSal;
    maxErr = Math.max(maxErr, Math.abs(lhs - rhs));
  }
  console.log(`  [balance ${etiqueta}] max |LHS-RHS| = ${maxErr}  ${maxErr < 1e-6 ? '✓ OK' : '✗ ROTO'}`);
}

function escenario1(weeksPerMonth = 1): void {
  console.log('═'.repeat(92));
  console.log(`  ESCENARIO 1 — Solo C1000, un material X/E  (${weeksPerMonth} semana(s)/mes)`);
  console.log('  Capacidad 100/mes. Demanda baja jun-oct (40), pico nov(130)/dic(150).');
  console.log('  Ocioso temprano disponible; déficit al final. ¿La anticipación lo cubre?');
  console.log('═'.repeat(92));

  const weekSegments = makeWeekSegments(weeksPerMonth);
  const capByMonth: Record<number, number> = { 6: 100, 7: 100, 8: 100, 9: 100, 10: 100, 11: 100, 12: 100 };
  const tiemposCanon = makeTiemposCanon(capByMonth, ['LINEA 1']);

  const effectiveData = makeRows({
    cod: 'M1',
    centro: '1000',
    linea: 'LINEA 1',
    demandByMonth: { 6: 40, 7: 40, 8: 40, 9: 40, 10: 40, 11: 130, 12: 150 },
    stockInicial: 50,
    stockSeguridad: 50,
    clase: 'X',
  });

  const r = runIv5EngineRediseñado({
    weekSegments,
    effectiveData,
    tiemposCanon: tiemposCanon as any,
    activeSatKeysC1000: new Set<string>(),
    activeSatKeysC2000: new Set<string>(),
    horasTrabajo: 8,
    maxExtrasHoras: 0,
    horasExtrasFin: 0,
    pioMap: new Map() as any,
    stockCap: { centro1000: 9_999_999, centro2000: 9_999_999, sectoresAplicables: ['01 COLCHONES'] },
    maxSabadosMes: 0,
    wantC1000: true,
    wantC2000: false,
  });

  for (const d of r.diagnosticos) {
    if (d.code === 'INFO') console.log('  · ' + d.mensaje);
  }
  if (r.resultC1000) printMonthly('C1000 — resultado mensual:', r.resultC1000.monthly);

  // Resumen
  const dic = r.resultC1000?.monthly.find((m) => m.mes === 12);
  const idleTemprano = (r.resultC1000?.monthly ?? [])
    .filter((m) => m.mes <= 10)
    .reduce((s, m) => s + m.idleMes, 0);
  console.log(
    `\n  >> Backlog diciembre: ${Math.round(dic?.backlogFinalMes ?? 0)} | ` +
    `Idle total jun-oct: ${Math.round(idleTemprano)} min (~unidades con tupp=1).`,
  );
  console.log(
    '  >> Si hay backlog en dic Y sobra idle temprano => la anticipación NO escala (bug reproducido).',
  );
}

// ============================================================================
// ESCENARIO 2 — Material X/E vendido en AMBOS centros (como el caso real).
// C2000 satura en nov/dic => C1000 lo respalda (TrasladoSaliente) en el pico,
// justo cuando C1000 también tiene su propio pico. ¿C1000 anticipa lo suyo?
// ============================================================================
function escenario2(): void {
  console.log('\n\n' + '═'.repeat(92));
  console.log('  ESCENARIO 2 — Material X/E en C1000 y C2000 (caso real)');
  console.log('  C1000 LINEA 1 cap 100; C2000 LINEA 2 cap 60.');
  console.log('  C2000 satura nov/dic => C1000 respalda (traslado) en el pico.');
  console.log('  ¿C1000 sigue anticipando su propio déficit con el ocioso de jul-ago?');
  console.log('═'.repeat(92));

  const weekSegments = makeWeekSegments(4);
  const tiemposCanon = makeTiemposCanonMultiLinea({
    'LINEA 1': { 6: 120, 7: 120, 8: 120, 9: 120, 10: 120, 11: 120, 12: 120 },
    // C2000 LLENO todo el año (cap = demanda base). Sin holgura para anticipar
    // lo suyo => en el pico depende del respaldo de C1000.
    'LINEA 2': { 6: 50, 7: 50, 8: 50, 9: 50, 10: 50, 11: 50, 12: 50 },
  });

  const demC1000 = { 6: 40, 7: 40, 8: 40, 9: 45, 10: 50, 11: 70, 12: 90 };
  const demC2000 = { 6: 50, 7: 50, 8: 50, 9: 50, 10: 50, 11: 80, 12: 100 };
  const rowsC1000 = makeRows({
    cod: 'M1', centro: '1000', linea: 'LINEA 1',
    demandByMonth: demC1000, stockInicial: 100, stockSeguridad: 100, clase: 'X',
  });
  const rowsC2000 = makeRows({
    cod: 'M1', centro: '2000', linea: 'LINEA 2',
    demandByMonth: demC2000, stockInicial: 100, stockSeguridad: 100, clase: 'X',
  });

  const base = {
    weekSegments,
    tiemposCanon: tiemposCanon as any,
    activeSatKeysC1000: new Set<string>(),
    activeSatKeysC2000: new Set<string>(),
    horasTrabajo: 8,
    maxExtrasHoras: 0,
    horasExtrasFin: 0,
    pioMap: new Map() as any,
    stockCap: { centro1000: 9_999_999, centro2000: 9_999_999, sectoresAplicables: ['01 COLCHONES'] },
    maxSabadosMes: 0,
  };

  // (A) CONTROL: solo C1000 (sin la carga de respaldo a C2000).
  console.log('\n  --- (A) CONTROL: C1000 SOLO (sin respaldo a C2000) ---');
  const rA = runIv5EngineRediseñado({ ...base, effectiveData: rowsC1000, wantC1000: true, wantC2000: false });
  for (const d of rA.diagnosticos) if (d.code === 'INFO') console.log('  · ' + d.mensaje);
  if (rA.resultC1000) printMonthly('C1000 SOLO:', rA.resultC1000.monthly);

  // (B) REAL: C1000 + C2000 (con respaldo X/E en el pico).
  console.log('\n  --- (B) C1000 + C2000 (con respaldo X/E) ---');
  const rB = runIv5EngineRediseñado({ ...base, effectiveData: [...rowsC1000, ...rowsC2000], wantC1000: true, wantC2000: true });
  for (const d of rB.diagnosticos) if (d.code === 'INFO') console.log('  · ' + d.mensaje);
  if (rB.resultC1000) printMonthly('C1000 (propio):', rB.resultC1000.monthly);
  if (rB.resultC2000) printMonthly('C2000:', rB.resultC2000.monthly);
  verificarBalance(rB.resultC1000, 'esc2-C1000');
  verificarBalance(rB.resultC2000, 'esc2-C2000');

  const dicA = rA.resultC1000?.monthly.find((m) => m.mes === 12);
  const dicB = rB.resultC1000?.monthly.find((m) => m.mes === 12);
  console.log(
    `\n  >> C1000 backlog dic — (A) solo: ${Math.round(dicA?.backlogFinalMes ?? 0)} | ` +
    `(B) con respaldo: ${Math.round(dicB?.backlogFinalMes ?? 0)}`,
  );
  console.log(
    '  >> Si (A)=0 y (B)>0 con idle temprano sin usar => el respaldo a C2000 rompe la anticipación de C1000.',
  );
}

// ============================================================================
// ESCENARIO 3 — MUCHOS materiales compartiendo la línea C1000 (como el real).
// La línea tiene ocioso grande en jun-oct y se satura en nov-dic. Cada material
// necesita anticiparse. ¿Reparte bien el ocioso o se queda corto y deja backlog?
// ============================================================================
function escenario3(weeksPerMonth: number, nMateriales: number): void {
  console.log('\n\n' + '═'.repeat(92));
  console.log(`  ESCENARIO 3 — ${nMateriales} materiales en C1000 LINEA 1  (${weeksPerMonth} sem/mes)`);
  console.log('  Línea con mucho ocioso jun-oct, saturada nov-dic. Cada material con pico al final.');
  console.log('═'.repeat(92));

  const weekSegments = makeWeekSegments(weeksPerMonth);
  // Cap por mes = 100*N. Demanda base 30*N (idle 70*N jun-oct); pico 150*N
  // (corto 50*N en nov-dic). Capacidad TOTAL del año alcanza de sobra; solo
  // está mal repartida en el tiempo => la anticipación DEBE resolverlo.
  const capLinea = nMateriales * 100;
  const tiemposCanon = makeTiemposCanon(
    { 6: capLinea, 7: capLinea, 8: capLinea, 9: capLinea, 10: capLinea, 11: capLinea, 12: capLinea },
    ['LINEA 1'],
  );

  const effectiveData: any[] = [];
  for (let k = 1; k <= nMateriales; k++) {
    effectiveData.push(
      ...makeRows({
        cod: `M${k}`,
        centro: '1000',
        linea: 'LINEA 1',
        demandByMonth: { 6: 30, 7: 30, 8: 30, 9: 30, 10: 30, 11: 150, 12: 150 },
        stockInicial: 50,
        stockSeguridad: 50,
        clase: 'X',
      }),
    );
  }

  const r = runIv5EngineRediseñado({
    weekSegments,
    effectiveData,
    tiemposCanon: tiemposCanon as any,
    activeSatKeysC1000: new Set<string>(),
    activeSatKeysC2000: new Set<string>(),
    horasTrabajo: 8,
    maxExtrasHoras: 0,
    horasExtrasFin: 0,
    pioMap: new Map() as any,
    stockCap: { centro1000: 9_999_999, centro2000: 9_999_999, sectoresAplicables: ['01 COLCHONES'] },
    maxSabadosMes: 0,
    wantC1000: true,
    wantC2000: false,
  });

  for (const d of r.diagnosticos) {
    if (d.code === 'INFO') console.log('  · ' + d.mensaje);
  }

  // Agrega a nivel LÍNEA por mes.
  const monthly = r.resultC1000?.monthly ?? [];
  const byMes = new Map<number, { dem: number; prod: number; res: number; back: number }>();
  for (const s of monthly) {
    const e = byMes.get(s.mes) ?? { dem: 0, prod: 0, res: 0, back: 0 };
    e.dem += s.demanda;
    e.prod += s.produccionBase;
    e.res += s.stockReservadoMes ?? 0;
    e.back += s.backlogFinalMes;
    byMes.set(s.mes, e);
  }
  console.log('\nLÍNEA C1000 (suma de todos los materiales) — por mes:');
  console.log('Mes        | Demanda |  CapLín | Idle | ProdLín | Reservado | Backlog');
  console.log('-'.repeat(78));
  const pad = (v: any, n: number) => String(v).padStart(n);
  let backTotal = 0;
  let idleTemprano = 0;
  for (const m of MESES) {
    const e = byMes.get(m)!;
    const idle = capLinea - e.prod; // tupp=1
    if (m <= 10) idleTemprano += idle;
    backTotal += e.back;
    console.log(
      [
        NOMBRE_MES[m].padEnd(10),
        pad(Math.round(e.dem), 7),
        pad(capLinea, 7),
        pad(Math.round(idle), 5),
        pad(Math.round(e.prod), 8),
        pad(Math.round(e.res), 10),
        pad(Math.round(e.back), 8),
      ].join(' |'),
    );
  }
  console.log(
    `\n  >> Backlog total fin de año: ${Math.round(backTotal)} | Idle línea jun-oct: ${Math.round(idleTemprano)}.`,
  );
  console.log(
    '  >> Backlog grande + idle temprano sin usar = BUG REPRODUCIDO (anticipación no escala con muchos materiales).',
  );
}

// ============================================================================
// ESCENARIO 4 — Caída GRADUAL con objetivo ALTO (lo más parecido al real).
// Objetivo 300 (>> demanda mensual). Demanda sube gradualmente. La línea tiene
// ocioso temprano pero el stock se erosiona despacio => déficits aparecen mes a
// mes. ¿La anticipación tapa los cercanos y deja el hueco grande del final?
// ============================================================================
function escenario4(weeksPerMonth: number, nMateriales: number): void {
  console.log('\n\n' + '═'.repeat(92));
  console.log(`  ESCENARIO 4 — ${nMateriales} materiales, objetivo ALTO, caída gradual  (${weeksPerMonth} sem/mes)`);
  console.log('  Objetivo 300. Demanda sube gradual. Ocioso temprano. ¿Tapa cercanos y deja el final?');
  console.log('═'.repeat(92));

  const weekSegments = makeWeekSegments(weeksPerMonth);
  const capLinea = nMateriales * 60;
  const tiemposCanon = makeTiemposCanon(
    { 6: capLinea, 7: capLinea, 8: capLinea, 9: capLinea, 10: capLinea, 11: capLinea, 12: capLinea },
    ['LINEA 1'],
  );

  // Arranca EN el objetivo (sin brecha temprana) => ocioso GENUINO temprano.
  // Demanda sube gradual y supera la capacidad al final => caída gradual.
  const demandByMonth = { 6: 40, 7: 45, 8: 50, 9: 55, 10: 60, 11: 75, 12: 90 };
  const effectiveData: any[] = [];
  for (let k = 1; k <= nMateriales; k++) {
    effectiveData.push(
      ...makeRows({
        cod: `M${k}`,
        centro: '1000',
        linea: 'LINEA 1',
        demandByMonth,
        stockInicial: 300,
        stockSeguridad: 300, // arranca justo en el objetivo
        clase: 'X',
      }),
    );
  }

  const r = runIv5EngineRediseñado({
    weekSegments,
    effectiveData,
    tiemposCanon: tiemposCanon as any,
    activeSatKeysC1000: new Set<string>(),
    activeSatKeysC2000: new Set<string>(),
    horasTrabajo: 8,
    maxExtrasHoras: 0,
    horasExtrasFin: 0,
    pioMap: new Map() as any,
    stockCap: { centro1000: 9_999_999, centro2000: 9_999_999, sectoresAplicables: ['01 COLCHONES'] },
    maxSabadosMes: 0,
    wantC1000: true,
    wantC2000: false,
  });

  for (const d of r.diagnosticos) {
    if (d.code === 'INFO') console.log('  · ' + d.mensaje);
  }

  const monthly = r.resultC1000?.monthly ?? [];
  const byMes = new Map<number, { dem: number; prod: number; res: number; back: number; stk: number }>();
  for (const s of monthly) {
    const e = byMes.get(s.mes) ?? { dem: 0, prod: 0, res: 0, back: 0, stk: 0 };
    e.dem += s.demanda;
    e.prod += s.produccionBase;
    e.res += s.stockReservadoMes ?? 0;
    e.back += s.backlogFinalMes;
    e.stk += s.stockFinalMes;
    byMes.set(s.mes, e);
  }
  console.log('\nLÍNEA C1000 (suma de materiales) — por mes:');
  console.log('Mes        | Demanda |  CapLín | Idle | ProdLín | Reservado | StockFin | Backlog');
  console.log('-'.repeat(82));
  const pad = (v: any, n: number) => String(v).padStart(n);
  let backTotal = 0;
  let idleTemprano = 0;
  for (const m of MESES) {
    const e = byMes.get(m)!;
    const idle = capLinea - e.prod;
    if (m <= 9) idleTemprano += idle;
    backTotal += e.back;
    console.log(
      [
        NOMBRE_MES[m].padEnd(10),
        pad(Math.round(e.dem), 7),
        pad(capLinea, 7),
        pad(Math.round(idle), 5),
        pad(Math.round(e.prod), 8),
        pad(Math.round(e.res), 10),
        pad(Math.round(e.stk), 9),
        pad(Math.round(e.back), 8),
      ].join(' |'),
    );
  }
  console.log(
    `\n  >> Backlog total fin de año: ${Math.round(backTotal)} | Idle línea jun-sep: ${Math.round(idleTemprano)}.`,
  );
}

// ============================================================================
// ESCENARIO 5 — Fragmentación por floor: tupp ALTO + muchos materiales.
// Hay ocioso GENUINO temprano, pero al repartirlo entre muchos materiales cada
// uno recibe una fracción de minuto que floor() vuelve 0 => 0 anticipación,
// ocioso sin usar, y backlog al final.
// ============================================================================
function escenario5(N: number, TUPP: number, capUnidades: number, base: number, peak: number): void {
  console.log('\n\n' + '═'.repeat(92));
  console.log(`  ESCENARIO 5 — tupp=${TUPP}, ${N} materiales, capLínea=${capUnidades} uds/mes.`);
  console.log(`  Demanda base ${base}/mes (ocioso temprano), pico ${peak}/mes (nov-dic).`);
  console.log('  Hipótesis: el reparto proporcional + floor deja a cada material en 0 => no anticipa.');
  console.log('═'.repeat(92));

  const weekSegments = makeWeekSegments(4);
  const capMin = capUnidades * TUPP;
  const tiemposCanon = makeTiemposCanon(
    { 6: capMin, 7: capMin, 8: capMin, 9: capMin, 10: capMin, 11: capMin, 12: capMin },
    ['LINEA 1'],
  );

  const demandByMonth = { 6: base, 7: base, 8: base, 9: base, 10: base, 11: peak, 12: peak };
  const effectiveData: any[] = [];
  for (let k = 1; k <= N; k++) {
    effectiveData.push(
      ...makeRows({
        cod: `M${k}`, centro: '1000', linea: 'LINEA 1',
        demandByMonth, stockInicial: 10, stockSeguridad: 10, clase: 'X', tupp: TUPP,
      }),
    );
  }

  const r = runIv5EngineRediseñado({
    weekSegments, effectiveData, tiemposCanon: tiemposCanon as any,
    activeSatKeysC1000: new Set<string>(), activeSatKeysC2000: new Set<string>(),
    horasTrabajo: 8, maxExtrasHoras: 0, horasExtrasFin: 0, pioMap: new Map() as any,
    stockCap: { centro1000: 9_999_999, centro2000: 9_999_999, sectoresAplicables: ['01 COLCHONES'] },
    maxSabadosMes: 0, wantC1000: true, wantC2000: false,
  });

  for (const d of r.diagnosticos) if (d.code === 'INFO') console.log('  · ' + d.mensaje);

  const monthly = r.resultC1000?.monthly ?? [];
  const byMes = new Map<number, { dem: number; prod: number; res: number; back: number }>();
  for (const s of monthly) {
    const e = byMes.get(s.mes) ?? { dem: 0, prod: 0, res: 0, back: 0 };
    e.dem += s.demanda; e.prod += s.produccionBase;
    e.res += s.stockReservadoMes ?? 0; e.back += s.backlogFinalMes;
    byMes.set(s.mes, e);
  }
  console.log('\nLÍNEA C1000 (suma de materiales, unidades) — por mes:');
  console.log('Mes        | Demanda | CapUds | IdleUds | ProdUds | Reservado | Backlog');
  console.log('-'.repeat(78));
  const pad = (v: any, n: number) => String(v).padStart(n);
  let backTotal = 0, idleTemprano = 0;
  for (const m of MESES) {
    const e = byMes.get(m)!;
    const idle = capUnidades - e.prod;
    if (m <= 10) idleTemprano += idle;
    backTotal += e.back;
    console.log([
      NOMBRE_MES[m].padEnd(10), pad(Math.round(e.dem), 7), pad(capUnidades, 6),
      pad(Math.round(idle), 7), pad(Math.round(e.prod), 7),
      pad(Math.round(e.res), 10), pad(Math.round(e.back), 8),
    ].join(' |'));
  }
  console.log(`\n  >> Backlog fin de año: ${Math.round(backTotal)} | Idle unidades jun-oct: ${Math.round(idleTemprano)}.`);
  console.log('  >> Backlog>0 con idle temprano sin usar = BUG por fragmentación/floor REPRODUCIDO.');
}

// ============================================================================
// ESCENARIO 6 — VIOLACIÓN DE PRIORIDAD (demanda vs colchón-objetivo).
// Línea apretada (cap = demanda total). Material A = pura demanda (sin objetivo).
// Material B = poca demanda + objetivo ALTO (vía PIO). El motor reparte
// proporcional => B construye colchón-objetivo mientras A no cubre su demanda.
// Una lógica por prioridades (demanda primero) daría CERO backlog.
// ============================================================================
function escenario6_prioridad(): void {
  console.log('═'.repeat(92));
  console.log('  ESCENARIO 6 — Prioridad: demanda (A) vs objetivo-colchón (B), línea apretada');
  console.log('  Cap 90/mes = demanda A(60)+B(30). B tiene objetivo PIO=100 (A no tiene objetivo).');
  console.log('  Esperado por PRIORIDAD: ambas demandas cubiertas, 0 backlog, B no construye colchón.');
  console.log('═'.repeat(92));

  const weekSegments = makeWeekSegments(1);
  const cap = 90;
  const tiemposCanon = makeTiemposCanon(
    { 6: cap, 7: cap, 8: cap, 9: cap, 10: cap, 11: cap, 12: cap }, ['LINEA 1'],
  );

  const demA: Record<number, number> = { 6: 60, 7: 60, 8: 60, 9: 60, 10: 60, 11: 60, 12: 60 };
  const demB: Record<number, number> = { 6: 30, 7: 30, 8: 30, 9: 30, 10: 30, 11: 30, 12: 30 };
  const rowsA = makeRows({ cod: 'MATA', centro: '1000', linea: 'LINEA 1', demandByMonth: demA, stockInicial: 0, stockSeguridad: 0, clase: 'X' });
  const rowsB = makeRows({ cod: 'MATB', centro: '1000', linea: 'LINEA 1', demandByMonth: demB, stockInicial: 0, stockSeguridad: 0, clase: 'X' });

  // B tiene un stock OBJETIVO alto (100) vía PIO; A no tiene objetivo (safety 0).
  const pioMap = new Map<string, any>();
  pioMap.set(`${normalizeMaterialCode('MATB')}|1000`, { promDiario: 0, invObjetivo: 100, etiqueta: 'TEST' });

  const r = runIv5EngineRediseñado({
    weekSegments, effectiveData: [...rowsA, ...rowsB], tiemposCanon: tiemposCanon as any,
    activeSatKeysC1000: new Set<string>(), activeSatKeysC2000: new Set<string>(),
    horasTrabajo: 8, maxExtrasHoras: 0, horasExtrasFin: 0, pioMap: pioMap as any,
    stockCap: { centro1000: 9_999_999, centro2000: 9_999_999, sectoresAplicables: ['01 COLCHONES'] },
    maxSabadosMes: 0, wantC1000: true, wantC2000: false,
  });

  for (const d of r.diagnosticos) if (d.code === 'INFO') console.log('  · ' + d.mensaje);
  verificarBalance(r.resultC1000, 'esc6');

  const monthly = r.resultC1000?.monthly ?? [];
  const codA = normalizeMaterialCode('MATA');
  const codB = normalizeMaterialCode('MATB');
  const pad = (v: any, n: number) => String(v).padStart(n);
  const linea = (label: string, cod: string) => {
    console.log('\n  ' + label);
    console.log('  Mes        | Demanda | ProdBase | StockFin | Backlog');
    for (const m of MESES) {
      const s = monthly.find((x) => x.mes === m && x.material === cod);
      if (!s) continue;
      console.log('  ' + [
        NOMBRE_MES[m].padEnd(10), pad(Math.round(s.demanda), 7),
        pad(Math.round(s.produccionBase), 8), pad(Math.round(s.stockFinalMes), 8),
        pad(Math.round(s.backlogFinalMes), 8),
      ].join(' |'));
    }
  };
  linea('Material A (pura demanda — DEBERÍA tener prioridad):', codA);
  linea('Material B (objetivo 100 — colchón deseable, baja prioridad):', codB);

  const backA = MESES.reduce((s, m) => s + (monthly.find((x) => x.mes === m && x.material === codA)?.backlogFinalMes ?? 0), 0);
  const stockBfin = monthly.find((x) => x.mes === 12 && x.material === codB)?.stockFinalMes ?? 0;
  console.log('\n  >> MOTOR ACTUAL: backlog acumulado de A (su demanda sin atender): ' + Math.round(backA)
    + ' | colchón que B construyó: ' + Math.round(stockBfin));
  console.log('  >> IDEAL POR PRIORIDAD: backlog de A = 0 (cap 90 alcanza para demanda 60+30); B colchón = 0.');
  console.log('  >> Si A tiene backlog Y B tiene colchón > 0 => el motor sacrificó demanda (P1) por objetivo (P3).');
}

// ============================================================================
// ESCENARIO 7 — Caso real del usuario: C2000 saturado todo el año + C1000 con
// ocioso temprano pero apretado al final. ¿C1000 usa su ocioso temprano para
// pre-construir (propio y/o respaldo a C2000) y evitar el backlog del final?
// ============================================================================
function escenario7_dualCentro(): void {
  console.log('═'.repeat(92));
  console.log('  ESCENARIO 7 — C2000 saturado todo el año, C1000 ocioso temprano + apretado al final');
  console.log('  ¿C1000 pre-construye con su ocioso temprano para cubrir el déficit de fin de año?');
  console.log('═'.repeat(92));

  const weekSegments = makeWeekSegments(1);
  const tiemposCanon = makeTiemposCanonMultiLinea({
    'LINEA 1': { 6: 100, 7: 100, 8: 100, 9: 100, 10: 100, 11: 100, 12: 100 }, // C1000
    'LINEA 2': { 6: 50, 7: 50, 8: 50, 9: 50, 10: 50, 11: 50, 12: 50 },        // C2000 saturado
  });

  // C1000: demanda propia BAJA temprano (mucho ocioso), ALTA al final (se llena).
  const demC1000 = { 6: 30, 7: 30, 8: 30, 9: 50, 10: 70, 11: 100, 12: 100 };
  // C2000: saturado todo el año (cap 50), pico nov/dic => déficit grande.
  const demC2000 = { 6: 50, 7: 50, 8: 50, 9: 50, 10: 50, 11: 95, 12: 110 };

  const rowsC1000 = makeRows({ cod: 'MX', centro: '1000', linea: 'LINEA 1', demandByMonth: demC1000, stockInicial: 50, stockSeguridad: 0, clase: 'X' });
  const rowsC2000 = makeRows({ cod: 'MX', centro: '2000', linea: 'LINEA 2', demandByMonth: demC2000, stockInicial: 50, stockSeguridad: 0, clase: 'X' });

  // Objetivo (PIO) = 50 en ambos centros => hay colchón objetivo que perseguir.
  const pioMap = new Map<string, any>();
  pioMap.set(`${normalizeMaterialCode('MX')}|1000`, { promDiario: 0, invObjetivo: 50, etiqueta: 'TEST' });
  pioMap.set(`${normalizeMaterialCode('MX')}|2000`, { promDiario: 0, invObjetivo: 50, etiqueta: 'TEST' });

  const r = runIv5EngineRediseñado({
    weekSegments, effectiveData: [...rowsC1000, ...rowsC2000], tiemposCanon: tiemposCanon as any,
    activeSatKeysC1000: new Set<string>(), activeSatKeysC2000: new Set<string>(),
    horasTrabajo: 8, maxExtrasHoras: 0, horasExtrasFin: 0, pioMap: pioMap as any,
    stockCap: { centro1000: 9_999_999, centro2000: 9_999_999, sectoresAplicables: ['01 COLCHONES'] },
    maxSabadosMes: 0, wantC1000: true, wantC2000: true,
  });

  for (const d of r.diagnosticos) if (d.code === 'INFO') console.log('  · ' + d.mensaje);
  verificarBalance(r.resultC1000, 'esc7-C1000');
  verificarBalance(r.resultC2000, 'esc7-C2000');
  if (r.resultC1000) printMonthly('C1000 (ocioso temprano; TrasSal = respaldo a C2000):', r.resultC1000.monthly);
  if (r.resultC2000) printMonthly('C2000 (saturado; TrasEnt no se ve aquí, mirar Backlog):', r.resultC2000.monthly);

  const idleC1000Temprano = (r.resultC1000?.monthly ?? []).filter((m) => m.mes <= 9).reduce((s, m) => s + m.idleMes, 0);
  const backC1000 = (r.resultC1000?.monthly ?? []).reduce((s, m) => s + m.backlogFinalMes, 0);
  const backC2000 = (r.resultC2000?.monthly ?? []).reduce((s, m) => s + m.backlogFinalMes, 0);
  console.log(`\n  >> Idle C1000 jun-sep: ${Math.round(idleC1000Temprano)} | Backlog total C1000: ${Math.round(backC1000)} | C2000: ${Math.round(backC2000)}`);
  console.log('  >> Si C1000 tiene ocioso temprano sin usar Y hay backlog al final => falta pre-construcción/respaldo anticipado.');
}

// ============================================================================
// ESCENARIO 8 — Apertura de sábados por necesidad (wrapper decidirSabados).
// C1000, capJN=1000/mes, 1 sábado disponible/mes (capSab = horasExtrasFin×60).
// Demanda jun/jul 1200 (cubrible con sábado), ago 1500 (ni con sábado alcanza).
// Esperado: el motor abre sábados de jun/jul (backlog→0) y deja residual en ago.
// ============================================================================
function escenario8_sabados(): void {
  console.log('\n\n' + '═'.repeat(92));
  console.log('  ESCENARIO 8 — El motor abre sábados por necesidad (hasta el tope) antes de dejar backlog');
  console.log('  capJN 1000/mes, sábado=+240. Demanda jun/jul 1200 (cubrible), ago 1500 (insuficiente aun con sábado).');
  console.log('═'.repeat(92));

  const meses = [6, 7, 8];
  const weekSegments: WeekSegment[] = meses.map((m, i) => ({
    isoWeek: 30 + i, isoYear: 2026, mes: m, anio: 2026, diasLaborales: 20,
    tieneSabado: true, label: `M${m}`, weekKey: `2026W${30 + i}|2026-${m}`, satKey: `2026W${30 + i}`,
  }));
  const tiemposCanon = meses.map((m) => ({
    mesNumero: m, mes: m, diasLaborables: 20,
    data: [{ nombre_linea: 'LINEA 1', minutos_horario_normal_TOTAL: 1000 }],
  }));
  const demanda: Record<number, number> = { 6: 1200, 7: 1200, 8: 1500 };
  const effectiveData = meses.map((m) => ({
    CodMaterial: 'MX', Mes: m, ['Año']: 2026, Centro: '1000', LineaFabricacion: 'LINEA 1',
    Sector: '01 COLCHONES', NombreMaterial: 'MX', NumeroPuestos: 1, TiempoPorUnidad: 1,
    UnidadesProyectado: demanda[m], StockActual: 0, StockSeguridad: 0, ClaseAprovisionam: 'X',
  }));

  const baseParams = {
    weekSegments, effectiveData, tiemposCanon: tiemposCanon as any,
    activeSatKeysC1000: new Set<string>(), activeSatKeysC2000: new Set<string>(),
    horasTrabajo: 8, maxExtrasHoras: 0, horasExtrasFin: 4, pioMap: new Map() as any,
    stockCap: { centro1000: 9_999_999, centro2000: 9_999_999, sectoresAplicables: ['01 COLCHONES'] },
    maxSabadosMes: 1, wantC1000: true, wantC2000: false,
  };

  const sinSab = runIv5EngineRediseñado(baseParams);
  const dec = decidirSabados(baseParams);

  const backFinal = (res: any): Record<number, number> => {
    const out: Record<number, number> = {};
    for (const row of res.resultC1000?.ledger ?? []) out[row.mes] = row.backlogFinal;
    return out;
  };
  const bSin = backFinal(sinSab);
  const bCon = backFinal(dec.resultado);
  console.log('\n  Backlog final por mes:   sin sábados → con sábados');
  for (const m of meses) {
    console.log(`    ${NOMBRE_MES[m].padEnd(10)}: ${String(bSin[m] ?? 0).padStart(5)} → ${String(bCon[m] ?? 0).padStart(5)}`);
  }
  console.log('\n  Sábados abiertos por el motor:');
  if (dec.sabadosAbiertos.length === 0) console.log('    (ninguno)');
  for (const s of dec.sabadosAbiertos) {
    console.log(`    C${s.centro} ${NOMBRE_MES[s.mes]} (${s.satKey}) — ${s.motivo} — redujo ${s.backlogReducido} de backlog`);
  }
  verificarBalance(dec.resultado.resultC1000, 'esc8');
  console.log('  >> Esperado: abre sábados jun/jul (backlog→0); ago queda residual (ni con sábado alcanza).');
}

escenario1(1);
escenario1(4);
escenario2();
escenario3(4, 30);
escenario4(4, 30);
escenario5(50, 5, 250, 3, 9);
escenario6_prioridad();
escenario7_dualCentro();
escenario8_sabados();

// ============================================================================
// ESCENARIO 9 — PERFORMANCE a escala realista.
// ~600 materiales, 2 centros × 3 líneas, 7 meses × 4 semanas, sábados disponibles.
// Mide cuánto tarda decidirSabados vs una corrida simple del motor.
// ============================================================================
function escenario9_perf(): void {
  console.log('\n\n' + '═'.repeat(92));
  console.log('  ESCENARIO 9 — PERFORMANCE (escala realista): decidirSabados vs corrida simple');
  console.log('═'.repeat(92));

  const MES7 = [6, 7, 8, 9, 10, 11, 12];
  const WK = 4;
  const lineas = ['LINEA 1', 'LINEA 2', 'LINEA 3'];
  const centros = ['1000', '2000'];
  const matsPorLinea = 100; // 100 × 3 líneas × 2 centros = 600 materiales

  // weekSegments: 4 semanas/mes; la última semana de cada mes tiene sábado.
  const weekSegments: WeekSegment[] = [];
  let iso = 1;
  for (const m of MES7) {
    for (let w = 0; w < WK; w++) {
      weekSegments.push({
        isoWeek: iso, isoYear: 2026, mes: m, anio: 2026, diasLaborales: 5,
        tieneSabado: w === WK - 1, label: `M${m}S${w}`,
        weekKey: `2026W${iso}|2026-${m}`, satKey: `2026W${iso}`,
      });
      iso++;
    }
  }

  // tiemposCanon: capacidad JN por línea/mes (tupp 5 ⇒ ~5200 uds/mes/línea).
  const tiemposCanon = MES7.map((m) => ({
    mesNumero: m, mes: m, diasLaborables: 20,
    data: lineas.map((l) => ({ nombre_linea: l, minutos_horario_normal_TOTAL: 26000 })),
  }));

  // Demanda con pico (nov/dic) que genera déficits ⇒ dispara la anticipación
  // (la fase que escala mal). Para medir solo la pasada base, usar demanda plana baja.
  const demBase: Record<number, number> = { 6: 40, 7: 40, 8: 45, 9: 50, 10: 55, 11: 70, 12: 75 };
  const effectiveData: any[] = [];
  let nMats = 0;
  for (const centro of centros) {
    for (let li = 0; li < lineas.length; li++) {
      for (let k = 1; k <= matsPorLinea; k++) {
        nMats++;
        const cod = `MX${centro}L${li}N${k}`;
        for (const m of MES7) {
          effectiveData.push({
            CodMaterial: cod, Mes: m, ['Año']: 2026, Centro: centro, LineaFabricacion: lineas[li],
            Sector: '01 COLCHONES', NombreMaterial: cod, NumeroPuestos: 1, TiempoPorUnidad: 5,
            UnidadesProyectado: demBase[m], StockActual: 60, StockSeguridad: 60, ClaseAprovisionam: 'X',
          });
        }
      }
    }
  }

  const baseParams = {
    weekSegments, effectiveData, tiemposCanon: tiemposCanon as any,
    activeSatKeysC1000: new Set<string>(), activeSatKeysC2000: new Set<string>(),
    horasTrabajo: 8, maxExtrasHoras: 0, horasExtrasFin: 8, pioMap: new Map() as any,
    stockCap: { centro1000: 9_999_999, centro2000: 9_999_999, sectoresAplicables: ['01 COLCHONES'] },
    maxSabadosMes: 2, wantC1000: true, wantC2000: true,
  };

  console.log(`  Materiales: ${nMats} | filas: ${effectiveData.length} | semanas: ${weekSegments.length} | sábados disp.: ${weekSegments.filter((s) => s.tieneSabado).length}/centro`);

  const t0 = Date.now();
  const una = runIv5EngineRediseñado(baseParams);
  const t1 = Date.now();
  const dec = decidirSabados(baseParams);
  const t2 = Date.now();

  const totalBack = (res: any) => {
    let b = 0;
    for (const r of [res.resultC1000, res.resultC2000]) for (const row of r?.ledger ?? []) b += row.backlogFinal ?? 0;
    return Math.round(b);
  };
  console.log(`\n  Corrida simple del motor:   ${t1 - t0} ms`);
  console.log(`  decidirSabados (wrapper):   ${t2 - t1} ms   (×${(((t2 - t1) / Math.max(1, t1 - t0))).toFixed(1)} la corrida simple)`);
  console.log(`  Sábados abiertos: ${dec.sabadosAbiertos.length}  | backlog total: sin=${totalBack(una)} → con=${totalBack(dec.resultado)}`);
  verificarBalance(dec.resultado.resultC1000, 'esc9-C1000');
  verificarBalance(dec.resultado.resultC2000, 'esc9-C2000');
}

// escenario9_perf();  // perf a 600 materiales (~5 s/corrida tras la optimización). Activar a mano.
