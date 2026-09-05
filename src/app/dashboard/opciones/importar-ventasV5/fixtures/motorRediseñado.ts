/**
 * Motor IV5 REDISEÑADO — implementación standalone para validación con fixtures.
 *
 * Esta es una implementación simplificada y self-contained del motor IV5
 * rediseñado descrito en las conversaciones con el usuario. Sirve para
 * validar el comportamiento del modelo conceptual contra los fixtures
 * (A, B, C, D) sin necesidad de integrar a la aplicación Next.js.
 *
 * Características implementadas:
 *  - Loop semanal forward integrado C1000 + C2000 (Pasada 1)
 *  - Anticipación con recálculo en cascada (Pasada 2)
 *  - Reservas anticipadas segregadas del stock regular
 *  - Materiales X/E con respaldo opcional en C1000
 *  - Prorrateo proporcional puro por línea
 *  - Tope agregado de almacenamiento (sectores 01-03)
 *
 * Características NO implementadas (no necesarias para validar el diseño):
 *  - Mini-pasada PIO mensual
 *  - Drift close week-vs-month
 *  - Líneas alternativas dinámicas (las definiciones son explícitas en el fixture)
 */

import type {
  Centro,
  Fixture,
  FixtureMaterial,
  FixtureLineCapacity,
} from './fixtureTypes';

// =============================================================================
// TIPOS DE RESULTADO
// =============================================================================

export interface LedgerRow {
  material: string;
  centro: Centro;
  semana: number;
  produccion: number;
  trasladoSaliente: number;
  trasladoEntrante: number;
  despachosVentas: number;
  stockFinalRegular: number;
  stockReservado: number;
  stockFinalFisico: number;
  backlogFinal: number;
}

export interface MotorResult {
  fixtureNombre: string;
  ledger: LedgerRow[];
  anticipaciones: Anticipacion[];
  diagnosticos: string[];
}

export interface Anticipacion {
  material: string;
  semanaOrigen: number;
  semanaTarget: number;
  uds: number;
  destino: 'C1000_PROPIO' | 'C2000_TRANSFER_F' | 'C2000_TRANSFER_XE';
}

// =============================================================================
// ESTADO INTERNO DEL MOTOR
// =============================================================================

interface EstadoMotor {
  /** Stock regular por (material|centro). */
  stockRegular: Map<string, number>;
  /** Backlog acumulado por (material|centro). */
  backlog: Map<string, number>;
  /** Reservas anticipadas por (material|centro|semanaTarget) -> uds. */
  reservas: Map<string, number>;
  /** Capacidad consumida por (linea|semana). */
  capUsada: Map<string, number>;
  /** Producción registrada por (material|centro|semana) -> uds. */
  produccion: Map<string, number>;
  /** Traslados entrantes por (material|centro|semana) -> uds. */
  trasladoEntrante: Map<string, number>;
  /** Traslados salientes por (material|centro|semana) -> uds. */
  trasladoSaliente: Map<string, number>;
  /** Despachos a clientes por (material|centro|semana) -> uds. */
  despachos: Map<string, number>;
  /** Snapshot de stock final regular por (material|centro|semana). */
  stockFinalSemanal: Map<string, number>;
  /** Snapshot de reservas pendientes por (material|centro|semana). */
  reservasSemanal: Map<string, number>;
  /** Backlog final por semana. */
  backlogSemanal: Map<string, number>;
}

function keyMC(material: string, centro: Centro): string {
  return `${material}|${centro}`;
}
function keyMCS(material: string, centro: Centro, semana: number): string {
  return `${material}|${centro}|${semana}`;
}
function keyMCT(material: string, centro: Centro, target: number): string {
  return `${material}|${centro}|t${target}`;
}
function keyLS(linea: string, semana: number): string {
  return `${linea}|${semana}`;
}

function initState(fixture: Fixture): EstadoMotor {
  const state: EstadoMotor = {
    stockRegular: new Map(),
    backlog: new Map(),
    reservas: new Map(),
    capUsada: new Map(),
    produccion: new Map(),
    trasladoEntrante: new Map(),
    trasladoSaliente: new Map(),
    despachos: new Map(),
    stockFinalSemanal: new Map(),
    reservasSemanal: new Map(),
    backlogSemanal: new Map(),
  };
  for (const m of fixture.materiales) {
    state.stockRegular.set(keyMC(m.codigo, m.centro), m.stockInicial);
    state.backlog.set(keyMC(m.codigo, m.centro), 0);
  }
  return state;
}

// =============================================================================
// FUNCIONES AUXILIARES
// =============================================================================

function getStockObjetivo(m: FixtureMaterial): number {
  return m.stockObjetivo ?? m.stockSeguridad;
}

function getCapacidadSemana(cap: FixtureLineCapacity, semana: number): number {
  return cap.capacidadSemanal[semana - 1] ?? 0;
}

function getDemandaSemana(m: FixtureMaterial, semana: number): number {
  return m.demandaSemanal[semana - 1] ?? 0;
}

/** Stock total en sectores con tope agregado, por centro. */
function calcStockSectoresCap(
  fixture: Fixture,
  centro: Centro,
  state: EstadoMotor,
): number {
  let total = 0;
  for (const m of fixture.materiales) {
    if (m.centro !== centro) continue;
    if (!fixture.stockCap.sectoresAplicables.includes(m.sector)) continue;
    const reg = state.stockRegular.get(keyMC(m.codigo, centro)) ?? 0;
    let res = 0;
    for (const [k, v] of state.reservas.entries()) {
      if (k.startsWith(`${m.codigo}|${centro}|`)) res += v;
    }
    total += reg + res;
  }
  return total;
}

/** Calcula espacio libre en el tope agregado del centro. */
function calcEspacioLibreCap(
  fixture: Fixture,
  centro: Centro,
  state: EstadoMotor,
): number {
  const stockSectores = calcStockSectoresCap(fixture, centro, state);
  const tope = centro === '1000' ? fixture.stockCap.centro1000 : fixture.stockCap.centro2000;
  return Math.max(0, tope - stockSectores);
}

// =============================================================================
// LOOP SEMANAL — PROCESA UNA SEMANA
// =============================================================================

interface AnticipacionPlaneada {
  material: string;
  uds: number;
  semanaOrigen: number;
  semanaTarget: number;
  destino: 'C1000_PROPIO' | 'C2000_TRANSFER_F' | 'C2000_TRANSFER_XE';
  /** Línea donde se produce físicamente (siempre en C1000). */
  lineaProduccion: string;
}

/**
 * Procesa una semana del horizonte aplicando la lógica completa:
 * - Calcula necesidades
 * - Prorrateo en C2000 (X/E)
 * - Construye carga C1000 (propio + traslados F + traslados X/E + anticipaciones)
 * - Prorrateo en C1000 por línea
 * - Madura reservas (las que cumplen target esta semana)
 * - Actualiza stocks, backlogs, registra ledger
 */
function procesarSemana(
  fixture: Fixture,
  semana: number,
  state: EstadoMotor,
  anticipacionesParaEstaSemana: AnticipacionPlaneada[],
): void {
  const materiales = fixture.materiales;
  const capacidades = fixture.capacidades;

  // ===== 0. Maduración de reservas que cumplen su target esta semana =====
  for (const m of materiales) {
    const key = keyMCT(m.codigo, m.centro, semana);
    const maduras = state.reservas.get(key) ?? 0;
    if (maduras > 0) {
      const stockKey = keyMC(m.codigo, m.centro);
      state.stockRegular.set(stockKey, (state.stockRegular.get(stockKey) ?? 0) + maduras);
      state.reservas.delete(key);
    }
  }

  // ===== 1. Calcular necesidades por material en C2000 =====
  // necesidad = demanda + backlog + brecha(stockObjetivo - stockRegular)
  // (brecha se calcula con stock regular, NO incluye reservas pendientes)
  type Necesidad = { material: string; uds: number; demanda: number };
  const necesidadesC2000: Necesidad[] = [];
  for (const m of materiales) {
    if (m.centro !== '2000') continue;
    const stockReg = state.stockRegular.get(keyMC(m.codigo, '2000')) ?? 0;
    const back = state.backlog.get(keyMC(m.codigo, '2000')) ?? 0;
    const demanda = getDemandaSemana(m, semana);
    const brecha = Math.max(0, getStockObjetivo(m) - stockReg);
    const necesidad = demanda + back + brecha;
    if (necesidad > 0) {
      necesidadesC2000.push({ material: m.codigo, uds: necesidad, demanda });
    }
  }

  // ===== 2. C2000 produce X/E con su capacidad propia (prorrateo por línea) =====
  // Solo aplica a materiales clase X/E en C2000. Los F no se fabrican en C2000.
  const produccionPropiaC2000 = new Map<string, number>(); // material -> uds
  const residualParaC1000 = new Map<string, number>(); // material -> uds que faltan

  for (const cap of capacidades) {
    if (cap.centro !== '2000') continue;
    const capDisp = getCapacidadSemana(cap, semana);
    if (capDisp <= 0) continue;

    // Materiales X/E que se fabrican en esta línea de C2000
    const materialesLinea = materiales.filter(
      (m) =>
        m.centro === '2000' &&
        m.clase !== 'F' &&
        m.lineaFabricacion === cap.linea,
    );
    if (materialesLinea.length === 0) continue;

    // Total tiempo requerido
    type Slot = { material: string; necesidadUds: number; tupp: number };
    const slots: Slot[] = [];
    for (const m of materialesLinea) {
      const nec = necesidadesC2000.find((n) => n.material === m.codigo);
      if (!nec || nec.uds <= 0) continue;
      slots.push({ material: m.codigo, necesidadUds: nec.uds, tupp: m.tupp });
    }
    const totalReq = slots.reduce((s, sl) => s + sl.necesidadUds * sl.tupp, 0);
    if (totalReq <= 0) continue;

    // Prorrateo proporcional puro: factor = min(1, capDisp / totalReq)
    const factor = Math.min(1, capDisp / totalReq);
    for (const sl of slots) {
      const minAsignados = sl.necesidadUds * sl.tupp * factor;
      const udsProducidas = Math.floor(minAsignados / Math.max(0.0001, sl.tupp));
      produccionPropiaC2000.set(sl.material, udsProducidas);
      // Capacidad usada
      state.capUsada.set(
        keyLS(cap.linea, semana),
        (state.capUsada.get(keyLS(cap.linea, semana)) ?? 0) + udsProducidas * sl.tupp,
      );
    }
  }

  // Calcular residual para C1000 (lo que no se pudo producir en C2000)
  for (const nec of necesidadesC2000) {
    const propio = produccionPropiaC2000.get(nec.material) ?? 0;
    const m = materiales.find((mm) => mm.codigo === nec.material && mm.centro === '2000');
    if (!m) continue;
    if (m.clase === 'F') {
      // F: TODO se va a C1000 (C2000 no produce F)
      residualParaC1000.set(m.codigo, nec.uds);
    } else {
      // X/E: residual solo si existe respaldo en C1000
      const residual = Math.max(0, nec.uds - propio);
      if (residual > 0 && m.lineaC1000Respaldo) {
        residualParaC1000.set(m.codigo, residual);
      }
      // Si no hay respaldo, el residual se queda como déficit (backlog futuro)
    }
  }

  // ===== 3. Construir carga C1000 por línea =====
  // Buckets: M0 propio + transferF + transferXE + anticipaciones planeadas para esta semana origen
  type CargaItem = {
    material: string;
    uds: number;
    tipo: 'C1000_PROPIO' | 'C2000_TRANSFER_F' | 'C2000_TRANSFER_XE' | 'ANTICIPACION';
    targetWeek?: number; // solo para anticipaciones
    /** Solo para anticipaciones: indica el destino real de la producción anticipada. */
    destinoAnticipacion?: 'C1000_PROPIO' | 'C2000_TRANSFER_F' | 'C2000_TRANSFER_XE';
  };
  const cargaPorLinea = new Map<string, CargaItem[]>();

  // 3a. Demanda propia C1000
  for (const m of materiales) {
    if (m.centro !== '1000') continue;
    const stockReg = state.stockRegular.get(keyMC(m.codigo, '1000')) ?? 0;
    const back = state.backlog.get(keyMC(m.codigo, '1000')) ?? 0;
    const demanda = getDemandaSemana(m, semana);
    const brecha = Math.max(0, getStockObjetivo(m) - stockReg);
    const necesidad = demanda + back + brecha;
    if (necesidad <= 0) continue;
    const arr = cargaPorLinea.get(m.lineaFabricacion) ?? [];
    arr.push({ material: m.codigo, uds: necesidad, tipo: 'C1000_PROPIO' });
    cargaPorLinea.set(m.lineaFabricacion, arr);
  }

  // 3b. Traslados F y X/E para C2000
  for (const [matCodigo, uds] of residualParaC1000.entries()) {
    const m = materiales.find((mm) => mm.codigo === matCodigo && mm.centro === '2000');
    if (!m) continue;
    let linea: string;
    let tipo: 'C2000_TRANSFER_F' | 'C2000_TRANSFER_XE';
    if (m.clase === 'F') {
      linea = m.lineaFabricacion; // F: línea declarada (en C1000)
      tipo = 'C2000_TRANSFER_F';
    } else {
      if (!m.lineaC1000Respaldo) continue; // no debería pasar (ya filtramos)
      linea = m.lineaC1000Respaldo;
      tipo = 'C2000_TRANSFER_XE';
    }
    const arr = cargaPorLinea.get(linea) ?? [];
    arr.push({ material: matCodigo, uds, tipo });
    cargaPorLinea.set(linea, arr);
  }

  // 3c. Anticipaciones planeadas que se producen esta semana
  // FIX: pasamos el destino real (propio/F/XE) en lugar de hardcodearlo después
  for (const ant of anticipacionesParaEstaSemana) {
    const arr = cargaPorLinea.get(ant.lineaProduccion) ?? [];
    arr.push({
      material: ant.material,
      uds: ant.uds,
      tipo: 'ANTICIPACION',
      targetWeek: ant.semanaTarget,
      destinoAnticipacion: ant.destino,
    });
    cargaPorLinea.set(ant.lineaProduccion, arr);
  }

  // ===== 4. Prorrateo C1000 por línea =====
  const produccionAsignada = new Map<string, Map<string, number>>(); // linea -> material -> uds
  const transfersFEfectivos = new Map<string, number>(); // material -> uds reales transferidas (F)
  const transfersXEEfectivos = new Map<string, number>(); // material -> uds reales (XE)
  const anticipacionesEjecutadas: AnticipacionPlaneada[] = [];

  for (const cap of capacidades) {
    if (cap.centro !== '1000') continue;
    const items = cargaPorLinea.get(cap.linea) ?? [];
    if (items.length === 0) continue;
    const capDisp = getCapacidadSemana(cap, semana);

    // Calcular total tiempo requerido
    const totalReq = items.reduce((s, it) => {
      const m = materiales.find((mm) => mm.codigo === it.material);
      const tupp = m?.tupp ?? 1;
      return s + it.uds * tupp;
    }, 0);
    if (totalReq <= 0) continue;

    const factor = Math.min(1, capDisp / totalReq);

    const matAsigMap = produccionAsignada.get(cap.linea) ?? new Map<string, number>();
    for (const it of items) {
      const m = materiales.find((mm) => mm.codigo === it.material);
      const tupp = m?.tupp ?? 1;
      const minAsignados = it.uds * tupp * factor;
      const udsAsignadas = Math.floor(minAsignados / Math.max(0.0001, tupp));

      const prev = matAsigMap.get(it.material) ?? 0;
      matAsigMap.set(it.material, prev + udsAsignadas);

      // Capacidad usada
      state.capUsada.set(
        keyLS(cap.linea, semana),
        (state.capUsada.get(keyLS(cap.linea, semana)) ?? 0) + udsAsignadas * tupp,
      );

      // Clasificar para movimientos
      if (it.tipo === 'C2000_TRANSFER_F') {
        transfersFEfectivos.set(
          it.material,
          (transfersFEfectivos.get(it.material) ?? 0) + udsAsignadas,
        );
      } else if (it.tipo === 'C2000_TRANSFER_XE') {
        transfersXEEfectivos.set(
          it.material,
          (transfersXEEfectivos.get(it.material) ?? 0) + udsAsignadas,
        );
      } else if (it.tipo === 'ANTICIPACION' && it.targetWeek) {
        // FIX: usar el destino real que vino con el item, no hardcodear
        anticipacionesEjecutadas.push({
          material: it.material,
          uds: udsAsignadas,
          semanaOrigen: semana,
          semanaTarget: it.targetWeek,
          destino: it.destinoAnticipacion ?? 'C2000_TRANSFER_F',
          lineaProduccion: cap.linea,
        });
      }
    }
    produccionAsignada.set(cap.linea, matAsigMap);
  }

  // ===== 5. Registrar producción C1000 + traslados =====
  // Toda la producción C1000 va al ledger. Lo que va para C2000 se registra como traslado.
  for (const [linea, matMap] of produccionAsignada.entries()) {
    for (const [material, uds] of matMap.entries()) {
      const m = materiales.find((mm) => mm.codigo === material);
      if (!m) continue;
      // Producción registrada en C1000 (línea de producción)
      const prodKey = keyMCS(material, '1000', semana);
      state.produccion.set(prodKey, (state.produccion.get(prodKey) ?? 0) + uds);
    }
  }

  // ===== 6. Procesar movimientos por material =====

  // 6a. Producción propia C2000 (X/E)
  for (const [material, uds] of produccionPropiaC2000.entries()) {
    const prodKey = keyMCS(material, '2000', semana);
    state.produccion.set(prodKey, (state.produccion.get(prodKey) ?? 0) + uds);
    // Va al stock regular de C2000
    const stockKey = keyMC(material, '2000');
    state.stockRegular.set(stockKey, (state.stockRegular.get(stockKey) ?? 0) + uds);
  }

  // 6b. Materiales C1000 propios:
  //  - La producción NORMAL (no anticipada) se suma al stock regular C1000
  //  - La producción ANTICIPADA C1000_PROPIO se separa y va a reservas[M|1000|target]
  //    (no entra al stock regular para no ser despachada antes de tiempo)
  for (const m of materiales) {
    if (m.centro !== '1000') continue;
    const prodKey = keyMCS(m.codigo, '1000', semana);
    const producidoTotal = state.produccion.get(prodKey) ?? 0;
    if (producidoTotal <= 0) continue;

    // Calcular cuánto de esa producción es anticipación propia
    let producidoAnticipado = 0;
    for (const ant of anticipacionesEjecutadas) {
      if (ant.material === m.codigo && ant.destino === 'C1000_PROPIO') {
        producidoAnticipado += ant.uds;
      }
    }

    const producidoNormal = Math.max(0, producidoTotal - producidoAnticipado);
    const stockKey = keyMC(m.codigo, '1000');
    if (producidoNormal > 0) {
      state.stockRegular.set(stockKey, (state.stockRegular.get(stockKey) ?? 0) + producidoNormal);
    }
    // La porción anticipada se maneja en step 6e (va a reservas C1000)
  }

  // 6c. Traslados F a C2000: salen de C1000, entran a C2000 como regular
  for (const [material, uds] of transfersFEfectivos.entries()) {
    const traslSalKey = keyMCS(material, '1000', semana);
    state.trasladoSaliente.set(traslSalKey, (state.trasladoSaliente.get(traslSalKey) ?? 0) + uds);
    const traslEntKey = keyMCS(material, '2000', semana);
    state.trasladoEntrante.set(traslEntKey, (state.trasladoEntrante.get(traslEntKey) ?? 0) + uds);
    state.stockRegular.set(keyMC(material, '2000'), (state.stockRegular.get(keyMC(material, '2000')) ?? 0) + uds);
  }

  // 6d. Traslados X/E a C2000: salen de C1000, entran a C2000 como regular
  for (const [material, uds] of transfersXEEfectivos.entries()) {
    const traslSalKey = keyMCS(material, '1000', semana);
    state.trasladoSaliente.set(traslSalKey, (state.trasladoSaliente.get(traslSalKey) ?? 0) + uds);
    const traslEntKey = keyMCS(material, '2000', semana);
    state.trasladoEntrante.set(traslEntKey, (state.trasladoEntrante.get(traslEntKey) ?? 0) + uds);
    state.stockRegular.set(keyMC(material, '2000'), (state.stockRegular.get(keyMC(material, '2000')) ?? 0) + uds);
  }

  // 6e. Anticipaciones ejecutadas: ramificar según destino
  //  - C1000_PROPIO: se queda en C1000 como reserva (NO se traslada, NO entra al stock regular)
  //  - C2000_TRANSFER_F/XE: se traslada a C2000 y va a reservas en C2000
  for (const ant of anticipacionesEjecutadas) {
    if (ant.destino === 'C1000_PROPIO') {
      // La producción anticipada propia ya NO se contabilizó en stock regular C1000 (ver 6b)
      // Solo va a la reserva propia en C1000
      const resKey = keyMCT(ant.material, '1000', ant.semanaTarget);
      state.reservas.set(resKey, (state.reservas.get(resKey) ?? 0) + ant.uds);
    } else {
      // Traslado a C2000 + reserva en C2000
      const traslSalKey = keyMCS(ant.material, '1000', semana);
      state.trasladoSaliente.set(traslSalKey, (state.trasladoSaliente.get(traslSalKey) ?? 0) + ant.uds);
      const traslEntKey = keyMCS(ant.material, '2000', semana);
      state.trasladoEntrante.set(traslEntKey, (state.trasladoEntrante.get(traslEntKey) ?? 0) + ant.uds);
      const resKey = keyMCT(ant.material, '2000', ant.semanaTarget);
      state.reservas.set(resKey, (state.reservas.get(resKey) ?? 0) + ant.uds);
    }
  }

  // Nota: para materiales F y X/E (centro=2000), el stock C1000 nunca acumula
  // porque su producción nunca se sumó a stockRegular[material|1000] (step 6b filtra
  // por m.centro === '1000'). La producción se registra solo en state.produccion
  // y se traslada inmediatamente en 6c/6d/6e.

  // ===== 8. Despachos a clientes y actualización de backlog =====
  for (const m of materiales) {
    const stockKey = keyMC(m.codigo, m.centro);
    const stockDisp = state.stockRegular.get(stockKey) ?? 0;
    const back = state.backlog.get(stockKey) ?? 0;
    const demanda = getDemandaSemana(m, semana);
    const pedido = demanda + back;
    const desp = Math.min(stockDisp, pedido);

    const despKey = keyMCS(m.codigo, m.centro, semana);
    state.despachos.set(despKey, desp);

    state.stockRegular.set(stockKey, stockDisp - desp);
    const backNuevo = Math.max(0, pedido - desp);
    state.backlog.set(stockKey, backNuevo);
  }

  // ===== 9. Snapshots para el ledger =====
  // Tomamos snapshot del stock y reservas para AMBOS centros donde el material existe
  // (centro principal + C1000 si el material es F/XE y se produce ahí como traslado)
  for (const m of materiales) {
    const centrosAGuardar: Centro[] = m.centro === '2000' ? ['1000', '2000'] : ['1000'];
    for (const c of centrosAGuardar) {
      const stockKey = keyMC(m.codigo, c);
      state.stockFinalSemanal.set(keyMCS(m.codigo, c, semana), state.stockRegular.get(stockKey) ?? 0);
      // Backlog solo aplica en el centro principal del material
      if (c === m.centro) {
        state.backlogSemanal.set(keyMCS(m.codigo, c, semana), state.backlog.get(stockKey) ?? 0);
      }
      // Reservas: sumamos todas las que están en (material|centro|*)
      let resTotal = 0;
      for (const [k, v] of state.reservas.entries()) {
        if (k.startsWith(`${m.codigo}|${c}|`)) resTotal += v;
      }
      state.reservasSemanal.set(keyMCS(m.codigo, c, semana), resTotal);
    }
  }
}

// =============================================================================
// PASADA 2 — ANTICIPACIÓN
// =============================================================================

/**
 * Analiza el resultado de la Pasada 1 e identifica déficits que pueden cubrirse
 * con anticipaciones desde semanas previas con sobrante de capacidad.
 *
 * Devuelve el plan de anticipaciones a aplicar.
 */
function planificarAnticipaciones(
  fixture: Fixture,
  pasada1State: EstadoMotor,
): AnticipacionPlaneada[] {
  const plan: AnticipacionPlaneada[] = [];
  const N = fixture.config.numSemanas;

  // Identificar déficits por (material, centro, semana)
  // Un déficit existe si: backlog > 0 OR stock_fin < objetivo
  type Deficit = {
    material: string;
    centro: Centro;
    semana: number;
    uds: number;
    lineaProduccion: string; // línea en C1000 donde se debe producir
    destino: 'C1000_PROPIO' | 'C2000_TRANSFER_F' | 'C2000_TRANSFER_XE';
  };
  const deficits: Deficit[] = [];

  for (let w = 1; w <= N; w++) {
    for (const m of fixture.materiales) {
      const stockFin = pasada1State.stockFinalSemanal.get(keyMCS(m.codigo, m.centro, w)) ?? 0;
      const back = pasada1State.backlogSemanal.get(keyMCS(m.codigo, m.centro, w)) ?? 0;
      const obj = getStockObjetivo(m);
      const deficit = Math.max(0, obj - stockFin) + back;
      if (deficit <= 0) continue;

      // Determinar línea de producción C1000 y destino
      let lineaProd: string;
      let destino: 'C1000_PROPIO' | 'C2000_TRANSFER_F' | 'C2000_TRANSFER_XE';

      if (m.centro === '1000') {
        lineaProd = m.lineaFabricacion;
        destino = 'C1000_PROPIO';
      } else if (m.clase === 'F') {
        lineaProd = m.lineaFabricacion; // F se hace en C1000
        destino = 'C2000_TRANSFER_F';
      } else {
        // X/E
        if (!m.lineaC1000Respaldo) continue; // sin respaldo, no se puede anticipar
        lineaProd = m.lineaC1000Respaldo;
        destino = 'C2000_TRANSFER_XE';
      }

      deficits.push({
        material: m.codigo,
        centro: m.centro,
        semana: w,
        uds: deficit,
        lineaProduccion: lineaProd,
        destino,
      });
    }
  }

  // Ordenar déficits cronológicamente (primero los más tempranos)
  deficits.sort((a, b) => a.semana - b.semana);

  // Para cada déficit, buscar sobrantes en semanas previas (más tempranas primero)
  // Sobrante = capacidad de la línea - capacidad ya usada en pasada 1
  const capRestantePorLineaSem = new Map<string, number>(); // (linea|semana) -> minutos restantes
  for (const cap of fixture.capacidades) {
    for (let w = 1; w <= N; w++) {
      const total = getCapacidadSemana(cap, w);
      const usada = pasada1State.capUsada.get(keyLS(cap.linea, w)) ?? 0;
      capRestantePorLineaSem.set(keyLS(cap.linea, w), Math.max(0, total - usada));
    }
  }

  // ===== ITERAR POR (SEMANA ORIGEN, LÍNEA) APLICANDO PRORRATEO DOS NIVELES =====
  // En lugar de procesar cada déficit greedy (que da prioridad al orden de aparición),
  // recorremos las semanas origen forward y para cada (línea, semana) aplicamos
  // prorrateo proporcional puro entre los déficits competidores que tengan target
  // futuro y residual > 0:
  //   - Nivel 1: por destino (C1000_PROPIO vs C2000_TRANSFER_*)
  //   - Nivel 2: dentro de cada grupo, por material según su necesidad
  //
  // Esto asegura que ningún material tenga prioridad arbitraria solo por el orden
  // en que aparece en el fixture.

  // Track residual por déficit (cuánto queda por cubrir)
  const residualPorDeficit = new Map<number, number>();
  const idxPorDef = new Map<Deficit, number>();
  for (let i = 0; i < deficits.length; i++) {
    residualPorDeficit.set(i, deficits[i].uds);
    idxPorDef.set(deficits[i], i);
  }

  const tuppDeMaterial = (codigo: string): number => {
    const m = fixture.materiales.find((mm) => mm.codigo === codigo);
    return m?.tupp ?? 1;
  };

  // Helper: chequeo de tope agregado (igual lógica que antes)
  const calcUdsMaxPorCap = (def: Deficit, wOrigen: number, tupp: number): number => {
    const material = fixture.materiales.find(
      (mm) => mm.codigo === def.material && mm.centro === def.centro,
    );
    if (!material) return Number.POSITIVE_INFINITY;
    if (def.destino === 'C1000_PROPIO') return Number.POSITIVE_INFINITY;
    if (!fixture.stockCap.sectoresAplicables.includes(material.sector)) {
      return Number.POSITIVE_INFINITY;
    }
    const tope = fixture.stockCap.centro2000;
    let maxStockEnVentana = 0;
    for (let w = wOrigen; w < def.semana; w++) {
      let totalSemana = 0;
      for (const mm of fixture.materiales) {
        if (mm.centro !== '2000') continue;
        if (!fixture.stockCap.sectoresAplicables.includes(mm.sector)) continue;
        const stockFin = pasada1State.stockFinalSemanal.get(keyMCS(mm.codigo, '2000', w)) ?? 0;
        let antVivas = 0;
        for (const otherAnt of plan) {
          if (otherAnt.destino === 'C1000_PROPIO') continue;
          if (otherAnt.material !== mm.codigo) continue;
          if (otherAnt.semanaOrigen <= w && w < otherAnt.semanaTarget) {
            antVivas += otherAnt.uds;
          }
        }
        totalSemana += stockFin + antVivas;
      }
      if (totalSemana > maxStockEnVentana) maxStockEnVentana = totalSemana;
    }
    const espacioDisp = Math.max(0, tope - maxStockEnVentana);
    return Math.floor(espacioDisp / tupp);
  };

  // Recorrer cada semana origen (forward) y cada línea de C1000
  for (let wOrigen = 1; wOrigen <= N; wOrigen++) {
    for (const cap of fixture.capacidades) {
      if (cap.centro !== '1000') continue; // anticipaciones se producen siempre en C1000
      const lineaKey = keyLS(cap.linea, wOrigen);

      // Loop interno: mientras haya capacidad Y déficits a cubrir, intenta asignar
      let iteraciones = 0;
      while ((capRestantePorLineaSem.get(lineaKey) ?? 0) > 0 && iteraciones < 100) {
        iteraciones++;
        const capDisp = capRestantePorLineaSem.get(lineaKey) ?? 0;
        if (capDisp <= 0) break;

        // Déficits activos: misma línea, target > wOrigen, residual > 0
        const activos = deficits.filter(
          (d) =>
            d.lineaProduccion === cap.linea &&
            d.semana > wOrigen &&
            (residualPorDeficit.get(idxPorDef.get(d)!) ?? 0) > 0,
        );
        if (activos.length === 0) break;

        // Tomar los de semana target MÁS TEMPRANA primero
        const earliestTarget = Math.min(...activos.map((d) => d.semana));
        const competidores = activos.filter((d) => d.semana === earliestTarget);

        const necMinDef = (d: Deficit) =>
          (residualPorDeficit.get(idxPorDef.get(d)!) ?? 0) * tuppDeMaterial(d.material);

        const totalNecMin = competidores.reduce((s, d) => s + necMinDef(d), 0);
        if (totalNecMin <= 0) break;

        // Capacidad a usar este turno = mín entre capacidad y necesidad
        const capParaUsar = Math.min(capDisp, totalNecMin);

        // ===== NIVEL 1 — Prorrateo proporcional puro por destino (centro) =====
        const grupoPropio = competidores.filter((d) => d.destino === 'C1000_PROPIO');
        const grupoTransfer = competidores.filter((d) => d.destino !== 'C1000_PROPIO');

        const necPropio = grupoPropio.reduce((s, d) => s + necMinDef(d), 0);
        const necTransfer = grupoTransfer.reduce((s, d) => s + necMinDef(d), 0);
        const totGen = necPropio + necTransfer;
        const capPropio = totGen > 0 ? capParaUsar * (necPropio / totGen) : 0;
        const capTransfer = totGen > 0 ? capParaUsar * (necTransfer / totGen) : 0;

        // ===== NIVEL 2 — Prorrateo dentro de cada grupo por material =====
        const procesarGrupo = (grupo: Deficit[], capGrupo: number): number => {
          const totGrupo = grupo.reduce((s, d) => s + necMinDef(d), 0);
          if (totGrupo <= 0 || capGrupo <= 0) return 0;
          let asignadoTotalMin = 0;
          for (const d of grupo) {
            const tupp = tuppDeMaterial(d.material);
            const necMin = necMinDef(d);
            const asignMin = capGrupo * (necMin / totGrupo);
            let udsAsign = Math.floor(asignMin / Math.max(0.0001, tupp));

            // Aplicar tope agregado (puede recortar)
            const udsMaxPorCap = calcUdsMaxPorCap(d, wOrigen, tupp);
            udsAsign = Math.min(udsAsign, udsMaxPorCap);

            if (udsAsign <= 0) continue;

            plan.push({
              material: d.material,
              uds: udsAsign,
              semanaOrigen: wOrigen,
              semanaTarget: d.semana,
              destino: d.destino,
              lineaProduccion: cap.linea,
            });
            residualPorDeficit.set(
              idxPorDef.get(d)!,
              (residualPorDeficit.get(idxPorDef.get(d)!) ?? 0) - udsAsign,
            );
            asignadoTotalMin += udsAsign * tupp;
          }
          return asignadoTotalMin;
        };

        const usadoPropio = procesarGrupo(grupoPropio, capPropio);
        const usadoTransfer = procesarGrupo(grupoTransfer, capTransfer);
        const totalUsado = usadoPropio + usadoTransfer;

        // Si no se logró asignar nada (todos los udsAsign fueron 0 por redondeo
        // o por tope), salir para evitar loop infinito. La capacidad restante
        // queda disponible para futuras semanas origen o se pierde.
        if (totalUsado <= 0) break;

        capRestantePorLineaSem.set(lineaKey, capDisp - totalUsado);
      }
    }
  }

  return plan;
}

// =============================================================================
// CONSTRUCCIÓN DEL LEDGER
// =============================================================================

function construirLedger(fixture: Fixture, state: EstadoMotor): LedgerRow[] {
  const rows: LedgerRow[] = [];
  const N = fixture.config.numSemanas;

  // Generar fila por (material, centro, semana) donde haya movimiento
  for (let w = 1; w <= N; w++) {
    for (const m of fixture.materiales) {
      const centro = m.centro;
      // También considerar el centro 1000 para materiales 2000 (las producciones F/XE)
      const centrosPosibles: Centro[] = m.centro === '2000' ? ['1000', '2000'] : ['1000'];

      for (const c of centrosPosibles) {
        const prod = state.produccion.get(keyMCS(m.codigo, c, w)) ?? 0;
        const traslSal = state.trasladoSaliente.get(keyMCS(m.codigo, c, w)) ?? 0;
        const traslEnt = state.trasladoEntrante.get(keyMCS(m.codigo, c, w)) ?? 0;
        const desp = state.despachos.get(keyMCS(m.codigo, c, w)) ?? 0;
        const stockFin = state.stockFinalSemanal.get(keyMCS(m.codigo, c, w)) ?? 0;
        const reservas = state.reservasSemanal.get(keyMCS(m.codigo, c, w)) ?? 0;
        const back = state.backlogSemanal.get(keyMCS(m.codigo, c, w)) ?? 0;

        // Para C1000 que solo produce y traslada (no es su centro), stock siempre 0
        let stockFinFila = stockFin;
        if (c === '1000' && m.centro === '2000') {
          stockFinFila = 0;
        }

        // Solo agregar fila si hay actividad o stock relevante
        if (prod === 0 && traslSal === 0 && traslEnt === 0 && desp === 0 && stockFinFila === 0 && reservas === 0 && back === 0) {
          continue;
        }

        rows.push({
          material: m.codigo,
          centro: c,
          semana: w,
          produccion: prod,
          trasladoSaliente: traslSal,
          trasladoEntrante: traslEnt,
          despachosVentas: desp,
          stockFinalRegular: stockFinFila,
          stockReservado: reservas, // mostrar reservas independientemente del centro
          stockFinalFisico: stockFinFila + reservas,
          backlogFinal: back,
        });
      }
    }
  }

  return rows;
}

// =============================================================================
// FUNCIÓN PRINCIPAL
// =============================================================================

export function runMotorRediseñado(fixture: Fixture): MotorResult {
  const N = fixture.config.numSemanas;

  // ===== PASADA 1: ejecutar todas las semanas sin anticipaciones =====
  const state1 = initState(fixture);
  for (let w = 1; w <= N; w++) {
    procesarSemana(fixture, w, state1, []);
  }

  // ===== PASADA 2: planificar anticipaciones =====
  const plan = planificarAnticipaciones(fixture, state1);

  // Si no hay anticipaciones, el resultado final es state1
  if (plan.length === 0) {
    return {
      fixtureNombre: fixture.nombre,
      ledger: construirLedger(fixture, state1),
      anticipaciones: [],
      diagnosticos: ['Sin anticipaciones necesarias.'],
    };
  }

  // ===== RE-EJECUTAR con anticipaciones planeadas =====
  const state2 = initState(fixture);
  for (let w = 1; w <= N; w++) {
    const anticipacionesEstaSemana = plan.filter((p) => p.semanaOrigen === w);
    procesarSemana(fixture, w, state2, anticipacionesEstaSemana);
  }

  return {
    fixtureNombre: fixture.nombre,
    ledger: construirLedger(fixture, state2),
    anticipaciones: plan.map((p) => ({
      material: p.material,
      semanaOrigen: p.semanaOrigen,
      semanaTarget: p.semanaTarget,
      uds: p.uds,
      destino: p.destino,
    })),
    diagnosticos: [
      `${plan.length} anticipación(es) planificadas.`,
      ...plan.map(
        (p) =>
          `${p.material}: ${p.uds} uds desde sem ${p.semanaOrigen} para sem ${p.semanaTarget} (${p.destino})`,
      ),
    ],
  };
}
