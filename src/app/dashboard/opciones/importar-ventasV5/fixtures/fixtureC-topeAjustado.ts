/**
 * Fixture C — Pico de demanda + tope de almacenamiento ajustado.
 *
 * Escenario: mismo pico de demanda que Fixture B, pero con un tope agregado
 * de C2000 muy ajustado. La anticipación se ve limitada porque no cabe el
 * stock anticipado en la bodega.
 *
 * Qué se valida con este fixture:
 *  - Que el motor rediseñado verifica el tope antes de cada anticipación.
 *  - Que cuando el tope no permite anticipar todo lo deseado, la anticipación
 *    se reduce al máximo posible (Alternativa A de Q2).
 *  - Que el tiempo de capacidad C1000 que queda ocioso por la restricción
 *    de tope NO se redistribuye (Q2 sub-respuesta).
 *  - Que el déficit residual en sem 4 se convierte en backlog visible.
 *
 * Diferencia esperada vs motor original:
 *  - Motor original: la regresiva anticipa sin chequear tope durante el
 *    cálculo. El post-proceso StockCap puede recortar el ledger ex-post,
 *    pero ya se "perdieron" oportunidades por no haber elegido mejor durante
 *    la planificación.
 *  - Motor rediseñado: el chequeo de tope ocurre en línea con la decisión
 *    de anticipación, evitando producir lo que después se va a recortar.
 */

import type { Fixture, FixtureExpectedResults } from './fixtureTypes';

export const fixtureC: Fixture = {
  nombre: 'C — Pico de demanda con tope ajustado',
  descripcion: 'Mismo pico que Fixture B, pero tope C2000 = 220 limita la anticipación posible',
  proposito: 'Validar que el tope de almacenamiento limita correctamente la anticipación y el tiempo no usado queda ocioso',

  config: {
    anio: 2026,
    meses: [1],
    numSemanas: 4,
  },

  materiales: [
    {
      codigo: 'M0',
      descripcion: 'Producto propio C1000',
      sector: '01',
      centro: '1000',
      clase: 'X',
      lineaFabricacion: 'Linea-A-C1000',
      tupp: 1,
      stockInicial: 50,
      stockSeguridad: 40,
      stockObjetivo: 50,
      demandaSemanal: [50, 50, 50, 50],
    },
    {
      codigo: 'M1',
      descripcion: 'Producto F (fabrica C1000, vende C2000)',
      sector: '01', // entra al tope agregado C2000
      centro: '2000',
      clase: 'F',
      lineaFabricacion: 'Linea-A-C1000',
      tupp: 1,
      stockInicial: 100,
      stockSeguridad: 80,
      stockObjetivo: 100,
      demandaSemanal: [50, 50, 50, 250], // mismo pico que Fixture B
    },
    {
      codigo: 'M2',
      descripcion: 'Producto X/E C2000',
      sector: '01', // entra al tope agregado C2000
      centro: '2000',
      clase: 'X',
      lineaFabricacion: 'Linea-B-C2000',
      tupp: 1,
      stockInicial: 60,
      stockSeguridad: 50,
      stockObjetivo: 60,
      demandaSemanal: [40, 40, 40, 40],
    },
  ],

  capacidades: [
    {
      linea: 'Linea-A-C1000',
      centro: '1000',
      capacidadSemanal: [200, 200, 200, 200],
    },
    {
      linea: 'Linea-B-C2000',
      centro: '2000',
      capacidadSemanal: [60, 60, 60, 60],
    },
  ],

  stockCap: {
    centro1000: 10000, // amplio
    centro2000: 220, // AJUSTADO: justo al límite del stock operativo normal
    sectoresAplicables: ['01', '02', '03'],
  },
};

/**
 * Resultados esperados.
 *
 * Análisis cap:
 * - Stock normal C2000 sectores 01-03 = M1 (100) + M2 (60) = 160
 * - Espacio libre antes de tope = 220 - 160 = 60
 * - Motor rediseñado puede anticipar máx. 60 uds en sem 1
 *   (poner más reservas excedería el tope)
 *
 * Sem 1: anticipa 60 uds M1 para sem 4 (no las 100 que pediría sin tope)
 *   Tiempo C1000 usado = 50 (M0) + 50 (M1 normal) + 60 (M1 anticipado) = 160 min
 *   Tiempo C1000 perdido por tope = 40 min (capacidad disponible 200 - 160 = 40 ocioso)
 *
 * Sem 2: no se puede anticipar más, el cap sigue al límite
 *   (con la maduración aún en sem 4, las reservas siguen ocupando bodega)
 *   Tiempo C1000 ocioso = 100 min (solo carga normal de 100)
 *
 * Sem 3: igual a sem 2
 *
 * Sem 4: la reserva de 60 madura. Necesidad M1 = 250.
 *   Maduración = 60 → nuevo traslado pedido = 250 - 0 - 60 = 190
 *   Carga Línea A sem 4 = 50 (M0) + 190 (M1) = 240 min vs 200 cap → déficit 40 min
 *   Prorrateo factor = 200/240 = 0.833
 *   M0 sem 4: 50 × 0.833 ≈ 42 uds producidas (stock_fin 42)
 *   M1 sem 4: 190 × 0.833 ≈ 158 uds producidas → traslado 158
 *   C2000 M1 sem 4: stock 100 + maduración 60 + transfer 158 = 318
 *     Despachos = min(318, 250) = 250 → stock_fin 68
 *   Backlog M1 sem 4 = 0 ✓ (alcanzó)
 *
 * Resultado: la anticipación parcial mitiga el pico parcialmente. El backlog
 * de M1 termina cubierto pero el stock M0 en C1000 baja por debajo de obj
 * porque el prorrateo recortó su producción en sem 4.
 */
export const fixtureCExpected: FixtureExpectedResults = {
  motorOriginal: [
    // El motor original no chequea tope durante la regresiva. Puede generar
    // un ledger que viola el tope temporalmente, luego StockCap (etapa 5a)
    // recorta ex-post. El resultado preciso depende de cómo recortar.
    // Lo dejamos sin especificar; lo importante es que probablemente generará
    // un diagnóstico TOPE_AGREGADO_RECORTADO en alguna semana.
  ],

  motorRediseñado: [
    // Anticipaciones planeadas (con prorrateo dos niveles + tope C2000):
    //   M0: 16 uds | sem 1 → sem 4 | C1000_PROPIO
    //   M1: 60 uds | sem 1 → sem 4 | C2000_TRANSFER_F  (limitado por tope)
    //   M0:  1 ud  | sem 2 → sem 4 | C1000_PROPIO

    // Semana 1: M0 anticipa 16, M1 anticipa 60 (cap restringe a 60)
    { material: 'M0', centro: '1000', semana: 1, produccion: 66, trasladoSaliente: 0, trasladoEntrante: 0, despachosVentas: 50, stockFinalRegular: 50, stockReservado: 16, stockFinalFisico: 66, backlogFinal: 0 },
    { material: 'M1', centro: '1000', semana: 1, produccion: 110, trasladoSaliente: 110, trasladoEntrante: 0, despachosVentas: 0, stockFinalRegular: 0, stockReservado: 0, stockFinalFisico: 0, backlogFinal: 0 },
    { material: 'M1', centro: '2000', semana: 1, produccion: 0, trasladoSaliente: 0, trasladoEntrante: 110, despachosVentas: 50, stockFinalRegular: 100, stockReservado: 60, stockFinalFisico: 160, backlogFinal: 0 },
    { material: 'M2', centro: '2000', semana: 1, produccion: 40, trasladoSaliente: 0, trasladoEntrante: 0, despachosVentas: 40, stockFinalRegular: 60, stockReservado: 0, stockFinalFisico: 60, backlogFinal: 0 },

    // Semana 2: M0 anticipa 1 más. M1 no puede más (cap ya saturado por reservas anteriores)
    { material: 'M0', centro: '1000', semana: 2, produccion: 51, trasladoSaliente: 0, trasladoEntrante: 0, despachosVentas: 50, stockFinalRegular: 50, stockReservado: 17, stockFinalFisico: 67, backlogFinal: 0 },
    { material: 'M1', centro: '1000', semana: 2, produccion: 50, trasladoSaliente: 50, trasladoEntrante: 0, despachosVentas: 0, stockFinalRegular: 0, stockReservado: 0, stockFinalFisico: 0, backlogFinal: 0 },
    { material: 'M1', centro: '2000', semana: 2, produccion: 0, trasladoSaliente: 0, trasladoEntrante: 50, despachosVentas: 50, stockFinalRegular: 100, stockReservado: 60, stockFinalFisico: 160, backlogFinal: 0 },
    { material: 'M2', centro: '2000', semana: 2, produccion: 40, trasladoSaliente: 0, trasladoEntrante: 0, despachosVentas: 40, stockFinalRegular: 60, stockReservado: 0, stockFinalFisico: 60, backlogFinal: 0 },

    // Semana 3: sin anticipaciones nuevas. Reservas permanecen.
    { material: 'M0', centro: '1000', semana: 3, produccion: 50, trasladoSaliente: 0, trasladoEntrante: 0, despachosVentas: 50, stockFinalRegular: 50, stockReservado: 17, stockFinalFisico: 67, backlogFinal: 0 },
    { material: 'M1', centro: '1000', semana: 3, produccion: 50, trasladoSaliente: 50, trasladoEntrante: 0, despachosVentas: 0, stockFinalRegular: 0, stockReservado: 0, stockFinalFisico: 0, backlogFinal: 0 },
    { material: 'M1', centro: '2000', semana: 3, produccion: 0, trasladoSaliente: 0, trasladoEntrante: 50, despachosVentas: 50, stockFinalRegular: 100, stockReservado: 60, stockFinalFisico: 160, backlogFinal: 0 },
    { material: 'M2', centro: '2000', semana: 3, produccion: 40, trasladoSaliente: 0, trasladoEntrante: 0, despachosVentas: 40, stockFinalRegular: 60, stockReservado: 0, stockFinalFisico: 60, backlogFinal: 0 },

    // Semana 4: maduran M0=17 + M1=60. Necesidad M1 = 250-60 = 190. Carga total 300, prorrateo recorta.
    { material: 'M0', centro: '1000', semana: 4, produccion: 33, trasladoSaliente: 0, trasladoEntrante: 0, despachosVentas: 50, stockFinalRegular: 50, stockReservado: 0, stockFinalFisico: 50, backlogFinal: 0 },
    { material: 'M1', centro: '1000', semana: 4, produccion: 166, trasladoSaliente: 166, trasladoEntrante: 0, despachosVentas: 0, stockFinalRegular: 0, stockReservado: 0, stockFinalFisico: 0, backlogFinal: 0 },
    // C2000 M1 sem 4: stock 100 + maduración 60 + transfer 166 = 326, despacha 250, stock_fin 76 (debajo de obj 100)
    { material: 'M1', centro: '2000', semana: 4, produccion: 0, trasladoSaliente: 0, trasladoEntrante: 166, despachosVentas: 250, stockFinalRegular: 76, stockReservado: 0, stockFinalFisico: 76, backlogFinal: 0 },
    { material: 'M2', centro: '2000', semana: 4, produccion: 40, trasladoSaliente: 0, trasladoEntrante: 0, despachosVentas: 40, stockFinalRegular: 60, stockReservado: 0, stockFinalFisico: 60, backlogFinal: 0 },
  ],

  notasComparacion: [
    'El tope C2000 = 220 limita la anticipación a 60 uds (no 100 como en Fixture B).',
    'Sem 1: 40 min de capacidad C1000 quedan ociosos por restricción de bodega (no por falta de demanda).',
    'Sem 2 y 3: 100 min cada semana quedan ociosos por la misma razón.',
    'Sem 4: el déficit residual (40 uds de M1) se prorratea proporcionalmente, recortando producción de M0 propia de C1000.',
    'Consecuencia: stock M0 al cierre sem 4 = 42 (debajo del objetivo 50) → arrastra brecha a un eventual sem 5.',
    'Backlog total al cierre del horizonte: 0 (la demanda se cubrió, pero con uso intensivo del prorrateo en sem 4).',
    'En el motor original, los stocks reservados no existen como concepto: las anticipaciones se mezclan con stock regular y pueden romper el tope temporalmente, generando recortes ex-post poco intuitivos.',
  ],
};
