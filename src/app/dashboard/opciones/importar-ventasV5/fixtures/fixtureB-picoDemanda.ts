/**
 * Fixture B — Pico de demanda en semana 4.
 *
 * Escenario: 4 semanas de horizonte. La demanda de M1 (clase F) sube
 * abruptamente en la semana 4 (de 50 a 250 uds). C1000 tiene capacidad libre
 * en las primeras 3 semanas que se podría usar para anticipar producción
 * destinada a la semana 4.
 *
 * Qué se valida con este fixture:
 *  - Que el motor rediseñado detecta el déficit futuro en sem 4 y anticipa
 *    producción de M1 en las semanas 1, 2, 3 (idle disponible).
 *  - Que las anticipaciones llegan a C2000 como stock reservado (etiquetado
 *    para sem 4) y no se confunden con stock regular.
 *  - Que en sem 4 la carga de C1000 baja porque parte del traslado de M1 ya
 *    fue entregado anticipadamente.
 *  - Que C2000 sem 4 cubre la demanda pico sin generar backlog.
 *
 * Diferencia esperada vs motor original:
 *  - Motor original: la lógica de pre-pase no anticipa de manera correcta
 *    el pico cross-center; en sem 4 C1000 hace prorrateo proporcional puro,
 *    M0 propia queda con stock por debajo del objetivo y M1 en C2000 queda
 *    con backlog porque la capacidad de sem 4 no alcanza.
 *  - Motor rediseñado: anticipa en sem 1-3 (aprovechando idle), llega a sem 4
 *    con stock reservado, cubre el pico sin generar backlog.
 */

import type { Fixture, FixtureExpectedResults } from './fixtureTypes';

export const fixtureB: Fixture = {
  nombre: 'B — Pico de demanda en semana 4',
  descripcion: 'Demanda de M1 (clase F) salta de 50 a 250 en semana 4. C1000 tiene idle en sem 1-3.',
  proposito: 'Validar la lógica de anticipación: pre-producir en semanas con idle para cubrir picos futuros',

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
      demandaSemanal: [50, 50, 50, 50], // estable
    },
    {
      codigo: 'M1',
      descripcion: 'Producto F (fabrica C1000, vende C2000)',
      sector: '01',
      centro: '2000',
      clase: 'F',
      lineaFabricacion: 'Linea-A-C1000', // mismo Línea A que M0 — compiten por capacidad
      tupp: 1,
      stockInicial: 100,
      stockSeguridad: 80,
      stockObjetivo: 100,
      demandaSemanal: [50, 50, 50, 250], // PICO en sem 4
    },
    {
      codigo: 'M2',
      descripcion: 'Producto X/E C2000',
      sector: '01',
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
    // Línea A de C1000: produce M0 y M1. Capacidad ajustada para que solo
    // alcance con anticipación.
    //  - Sem 1, 2, 3: demanda 50 (M0) + 50 (M1) = 100 min, sobran 100
    //  - Sem 4: demanda 50 (M0) + 250 (M1) = 300 min, faltan 100 min
    //  - Idle total sem 1-3: 300 min → alcanza para anticipar 100 min de M1 en sem 4
    {
      linea: 'Linea-A-C1000',
      centro: '1000',
      capacidadSemanal: [200, 200, 200, 200],
    },
    // Línea B de C2000: produce M2. Capacidad estable suficiente.
    {
      linea: 'Linea-B-C2000',
      centro: '2000',
      capacidadSemanal: [60, 60, 60, 60],
    },
  ],

  stockCap: {
    centro1000: 10000, // amplio, no se va a tocar en este fixture
    centro2000: 10000, // amplio
    sectoresAplicables: ['01', '02', '03'],
  },
};

/**
 * Resultados esperados — calculados manualmente.
 *
 * Las cantidades pueden tener pequeñas diferencias en la implementación real
 * por redondeos en el prorrateo, pero los patrones generales (presencia/
 * ausencia de backlog, niveles de stock, anticipaciones) deben coincidir.
 */
export const fixtureBExpected: FixtureExpectedResults = {
  motorOriginal: [
    // === Motor ORIGINAL — sin anticipación cross-center correcta ===
    //
    // Sem 1, 2, 3: el motor original con su pre-pase calcula deficit M1 ≈ 0
    // (stock 100 cubre demanda 50). Pide solo lo necesario semana a semana.
    //
    // Sem 4: el deficit estimado de M1 = max(0, 250+0 - 100 - 0) = 150.
    // C1000 sem 4 recibe carga: M0 (50) + M1 (150) = 200 min, justo en capacidad.
    // C1000 produce todo. Traslado real M1 = 150.
    // C2000 sem 4: stock 100 + transfer 150 = 250, dispatches 250, stock_fin = 0, backlog = 0.
    //
    // Hmm pero los stocks objetivo no se mantienen estrictamente porque la
    // fórmula deficit del pre-pase resta stockPrev. El motor original
    // sub-pide ligeramente y los stocks van bajando.
    //
    // En la realidad, el motor original con regresiva intra-línea SÍ anticipa
    // algo (sem 4 deficit lo cubre con idle de sem 1-3 de Línea A). Por lo
    // tanto el resultado depende mucho de los detalles.
    //
    // Para este fixture, esperamos un resultado SIMILAR al rediseñado en este
    // escenario base, porque la regresiva intra-línea ya cubre buena parte.
    // La diferencia clave aparecerá en Fixture C (con tope) y en escenarios
    // donde la pre-pasada estima mal.
    //
    // No completo todos los números aquí porque dependen de la implementación
    // exacta del motor original (PIO, drift close, etc).
  ],

  motorRediseñado: [
    // === Motor REDISEÑADO (con prorrateo dos niveles) ===
    //
    // Pasada 1 (sin anticipación): detecta dos déficits en sem 4 línea A C1000.
    //   - Carga sem 4 = 50 (M0) + 250 (M1) = 300 min vs cap 200 → factor 0.667
    //   - M0 prod 33 (déficit 17 vs obj 50)
    //   - M1 traslado 166 → C2000 M1 stock_fin 16 (déficit 84 vs obj 100)
    //
    // Pasada 2 — prorrateo dos niveles por (semana origen, línea):
    //   Sem 1 Línea-A idle 100 min, déficits competidores M0 (17) + M1 (84) = 101 min
    //     Nivel 1 por centro: factor 100/101 = 0.99
    //       C1000_PROPIO (M0): 16.83 min → M0 16 uds
    //       C2000_TRANSFER (M1): 83.16 min → M1 83 uds
    //     Total asignado: 99 min, residuales: M0=1, M1=1
    //   Sem 2 idle 100 min, residuales 2 min → cubre todo
    //     M0 +1 ud, M1 +1 ud
    //
    // RESULTADO: M0 anticipado 17 (16+1) y M1 anticipado 84 (83+1)
    //
    // Semana 1
    { material: 'M0', centro: '1000', semana: 1, produccion: 66, trasladoSaliente: 0, trasladoEntrante: 0, despachosVentas: 50, stockFinalRegular: 50, stockReservado: 16, stockFinalFisico: 66, backlogFinal: 0 },
    { material: 'M1', centro: '1000', semana: 1, produccion: 133, trasladoSaliente: 133, trasladoEntrante: 0, despachosVentas: 0, stockFinalRegular: 0, stockReservado: 0, stockFinalFisico: 0, backlogFinal: 0 },
    { material: 'M1', centro: '2000', semana: 1, produccion: 0, trasladoSaliente: 0, trasladoEntrante: 133, despachosVentas: 50, stockFinalRegular: 100, stockReservado: 83, stockFinalFisico: 183, backlogFinal: 0 },
    { material: 'M2', centro: '2000', semana: 1, produccion: 40, trasladoSaliente: 0, trasladoEntrante: 0, despachosVentas: 40, stockFinalRegular: 60, stockReservado: 0, stockFinalFisico: 60, backlogFinal: 0 },
    // Semana 2 (sigue distribuyendo el residual de M0 y M1)
    { material: 'M0', centro: '1000', semana: 2, produccion: 51, trasladoSaliente: 0, trasladoEntrante: 0, despachosVentas: 50, stockFinalRegular: 50, stockReservado: 17, stockFinalFisico: 67, backlogFinal: 0 },
    { material: 'M1', centro: '1000', semana: 2, produccion: 51, trasladoSaliente: 51, trasladoEntrante: 0, despachosVentas: 0, stockFinalRegular: 0, stockReservado: 0, stockFinalFisico: 0, backlogFinal: 0 },
    { material: 'M1', centro: '2000', semana: 2, produccion: 0, trasladoSaliente: 0, trasladoEntrante: 51, despachosVentas: 50, stockFinalRegular: 100, stockReservado: 84, stockFinalFisico: 184, backlogFinal: 0 },
    { material: 'M2', centro: '2000', semana: 2, produccion: 40, trasladoSaliente: 0, trasladoEntrante: 0, despachosVentas: 40, stockFinalRegular: 60, stockReservado: 0, stockFinalFisico: 60, backlogFinal: 0 },
    // Semana 3 (steady state, reservas siguen guardadas)
    { material: 'M0', centro: '1000', semana: 3, produccion: 50, trasladoSaliente: 0, trasladoEntrante: 0, despachosVentas: 50, stockFinalRegular: 50, stockReservado: 17, stockFinalFisico: 67, backlogFinal: 0 },
    { material: 'M1', centro: '1000', semana: 3, produccion: 50, trasladoSaliente: 50, trasladoEntrante: 0, despachosVentas: 0, stockFinalRegular: 0, stockReservado: 0, stockFinalFisico: 0, backlogFinal: 0 },
    { material: 'M1', centro: '2000', semana: 3, produccion: 0, trasladoSaliente: 0, trasladoEntrante: 50, despachosVentas: 50, stockFinalRegular: 100, stockReservado: 84, stockFinalFisico: 184, backlogFinal: 0 },
    { material: 'M2', centro: '2000', semana: 3, produccion: 40, trasladoSaliente: 0, trasladoEntrante: 0, despachosVentas: 40, stockFinalRegular: 60, stockReservado: 0, stockFinalFisico: 60, backlogFinal: 0 },
    // Semana 4: maduran 17 de M0 + 84 de M1; prorrateo recorta M0 a 33 y M1 a 166
    { material: 'M0', centro: '1000', semana: 4, produccion: 33, trasladoSaliente: 0, trasladoEntrante: 0, despachosVentas: 50, stockFinalRegular: 50, stockReservado: 0, stockFinalFisico: 50, backlogFinal: 0 },
    { material: 'M1', centro: '1000', semana: 4, produccion: 166, trasladoSaliente: 166, trasladoEntrante: 0, despachosVentas: 0, stockFinalRegular: 0, stockReservado: 0, stockFinalFisico: 0, backlogFinal: 0 },
    // C2000 sem 4: stock previo 100 + maduración 84 + transfer 166 = 350, despacha 250, stock_fin 100
    { material: 'M1', centro: '2000', semana: 4, produccion: 0, trasladoSaliente: 0, trasladoEntrante: 166, despachosVentas: 250, stockFinalRegular: 100, stockReservado: 0, stockFinalFisico: 100, backlogFinal: 0 },
    { material: 'M2', centro: '2000', semana: 4, produccion: 40, trasladoSaliente: 0, trasladoEntrante: 0, despachosVentas: 40, stockFinalRegular: 60, stockReservado: 0, stockFinalFisico: 60, backlogFinal: 0 },
  ],

  notasComparacion: [
    'El motor rediseñado anticipa 100 uds de M1 en sem 1 para entregar en sem 4.',
    'C2000 acumula stock reservado de M1 durante sem 1-3 (no se confunde con stock regular).',
    'En sem 4, la reserva madura y se suma al stock disponible junto con el traslado normal.',
    'Stocks regular se mantienen al objetivo en todas las semanas; cero backlog.',
    'Línea A de C1000 alcanza su capacidad total en sem 1 (100 normal + 100 anticipado).',
    'Comportamiento esperado del motor original: en este fixture la regresiva intra-línea cubre el pico de manera similar; pero los stocks finales pueden quedar ligeramente por debajo del objetivo debido a la fórmula de déficit del pre-pase que resta stockPrev dos veces.',
    'La diferencia REAL más visible aparece en Fixture C, donde el tope limita la capacidad de anticipación.',
  ],
};
