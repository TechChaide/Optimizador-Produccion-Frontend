/**
 * Fixture A — Caso base sin pico de demanda.
 *
 * Escenario: 4 semanas de horizonte, demanda estable, capacidad suficiente.
 * No se requiere anticipación. Los stocks se mantienen en niveles cercanos
 * al objetivo en ambos centros.
 *
 * Qué se valida con este fixture:
 *  - Que el motor rediseñado produce resultados equivalentes al motor original
 *    cuando no hay restricciones de capacidad ni necesidad de anticipar.
 *  - Que el balance básico cuadra:
 *      stock_final = stock_inicial + producción + traslado_entrante
 *                  − despachos − traslado_saliente
 *  - Que C2000 cubre toda la demanda usando su propia línea (X/E) y los
 *    traslados normales desde C1000 (F).
 *
 * Diferencia esperada entre motores: prácticamente ninguna.
 */

import type { Fixture, FixtureExpectedResults } from './fixtureTypes';

export const fixtureA: Fixture = {
  nombre: 'A — Caso base sin pico',
  descripcion: '4 semanas de demanda estable con capacidad suficiente en ambos centros',
  proposito: 'Validar que el motor rediseñado se comporta igual que el original cuando no hay restricciones',

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
      stockInicial: 100,
      stockSeguridad: 80,
      stockObjetivo: 100,
      demandaSemanal: [80, 80, 80, 80],
    },
    {
      codigo: 'M1',
      descripcion: 'Producto F (fabrica C1000, vende C2000)',
      sector: '01',
      centro: '2000',
      clase: 'F',
      lineaFabricacion: 'Linea-A-C1000', // F se fabrica en C1000
      tupp: 1,
      stockInicial: 80,
      stockSeguridad: 60,
      stockObjetivo: 80,
      demandaSemanal: [50, 50, 50, 50],
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
      stockSeguridad: 40,
      stockObjetivo: 60,
      demandaSemanal: [40, 40, 40, 40],
    },
  ],

  capacidades: [
    // C1000 Línea A produce M0 (propio) y M1 (traslado F)
    {
      linea: 'Linea-A-C1000',
      centro: '1000',
      capacidadSemanal: [200, 200, 200, 200], // 80+50 = 130 demanda + holgura
    },
    // C2000 Línea B produce M2 (X/E)
    {
      linea: 'Linea-B-C2000',
      centro: '2000',
      capacidadSemanal: [60, 60, 60, 60], // 40 demanda + 20 holgura
    },
  ],

  stockCap: {
    centro1000: 10000, // amplio, no se va a tocar
    centro2000: 10000, // amplio, no se va a tocar
    sectoresAplicables: ['01', '02', '03'],
  },
};

/**
 * Resultados esperados calculados manualmente.
 *
 * Lógica:
 * - M0 (C1000 propio): stock siempre 100 al cierre (produce 80 = demanda).
 * - M1 (F en C2000): C1000 produce 50, traslada 50, stock C2000 se mantiene 80.
 * - M2 (X/E en C2000): C2000 produce 40 con su línea propia, stock 60.
 *
 * Como no hay anticipación necesaria, ambos motores deberían dar resultados
 * prácticamente idénticos.
 */
export const fixtureAExpected: FixtureExpectedResults = {
  motorOriginal: [
    // Semana 1
    { material: 'M0', centro: '1000', semana: 1, produccion: 80, trasladoSaliente: 0, trasladoEntrante: 0, despachosVentas: 80, stockFinalRegular: 100, stockReservado: 0, stockFinalFisico: 100, backlogFinal: 0 },
    { material: 'M1', centro: '1000', semana: 1, produccion: 50, trasladoSaliente: 50, trasladoEntrante: 0, despachosVentas: 0, stockFinalRegular: 0, stockReservado: 0, stockFinalFisico: 0, backlogFinal: 0 },
    { material: 'M1', centro: '2000', semana: 1, produccion: 0, trasladoSaliente: 0, trasladoEntrante: 50, despachosVentas: 50, stockFinalRegular: 80, stockReservado: 0, stockFinalFisico: 80, backlogFinal: 0 },
    { material: 'M2', centro: '2000', semana: 1, produccion: 40, trasladoSaliente: 0, trasladoEntrante: 0, despachosVentas: 40, stockFinalRegular: 60, stockReservado: 0, stockFinalFisico: 60, backlogFinal: 0 },
    // Semana 2-4: igual a semana 1 (steady state)
    { material: 'M0', centro: '1000', semana: 2, produccion: 80, trasladoSaliente: 0, trasladoEntrante: 0, despachosVentas: 80, stockFinalRegular: 100, stockReservado: 0, stockFinalFisico: 100, backlogFinal: 0 },
    { material: 'M1', centro: '1000', semana: 2, produccion: 50, trasladoSaliente: 50, trasladoEntrante: 0, despachosVentas: 0, stockFinalRegular: 0, stockReservado: 0, stockFinalFisico: 0, backlogFinal: 0 },
    { material: 'M1', centro: '2000', semana: 2, produccion: 0, trasladoSaliente: 0, trasladoEntrante: 50, despachosVentas: 50, stockFinalRegular: 80, stockReservado: 0, stockFinalFisico: 80, backlogFinal: 0 },
    { material: 'M2', centro: '2000', semana: 2, produccion: 40, trasladoSaliente: 0, trasladoEntrante: 0, despachosVentas: 40, stockFinalRegular: 60, stockReservado: 0, stockFinalFisico: 60, backlogFinal: 0 },
    { material: 'M0', centro: '1000', semana: 3, produccion: 80, trasladoSaliente: 0, trasladoEntrante: 0, despachosVentas: 80, stockFinalRegular: 100, stockReservado: 0, stockFinalFisico: 100, backlogFinal: 0 },
    { material: 'M1', centro: '1000', semana: 3, produccion: 50, trasladoSaliente: 50, trasladoEntrante: 0, despachosVentas: 0, stockFinalRegular: 0, stockReservado: 0, stockFinalFisico: 0, backlogFinal: 0 },
    { material: 'M1', centro: '2000', semana: 3, produccion: 0, trasladoSaliente: 0, trasladoEntrante: 50, despachosVentas: 50, stockFinalRegular: 80, stockReservado: 0, stockFinalFisico: 80, backlogFinal: 0 },
    { material: 'M2', centro: '2000', semana: 3, produccion: 40, trasladoSaliente: 0, trasladoEntrante: 0, despachosVentas: 40, stockFinalRegular: 60, stockReservado: 0, stockFinalFisico: 60, backlogFinal: 0 },
    { material: 'M0', centro: '1000', semana: 4, produccion: 80, trasladoSaliente: 0, trasladoEntrante: 0, despachosVentas: 80, stockFinalRegular: 100, stockReservado: 0, stockFinalFisico: 100, backlogFinal: 0 },
    { material: 'M1', centro: '1000', semana: 4, produccion: 50, trasladoSaliente: 50, trasladoEntrante: 0, despachosVentas: 0, stockFinalRegular: 0, stockReservado: 0, stockFinalFisico: 0, backlogFinal: 0 },
    { material: 'M1', centro: '2000', semana: 4, produccion: 0, trasladoSaliente: 0, trasladoEntrante: 50, despachosVentas: 50, stockFinalRegular: 80, stockReservado: 0, stockFinalFisico: 80, backlogFinal: 0 },
    { material: 'M2', centro: '2000', semana: 4, produccion: 40, trasladoSaliente: 0, trasladoEntrante: 0, despachosVentas: 40, stockFinalRegular: 60, stockReservado: 0, stockFinalFisico: 60, backlogFinal: 0 },
  ],

  // En este caso base, el motor rediseñado da los mismos resultados
  motorRediseñado: [], // se llena automáticamente con copia del motorOriginal

  notasComparacion: [
    'En caso base sin restricciones, ambos motores producen resultados idénticos.',
    'No hay anticipaciones porque no hay déficit en ninguna semana.',
    'Stocks se mantienen estables en su nivel objetivo.',
    'Demanda cubierta al 100% en ambos centros para todas las semanas.',
  ],
};

// El motor rediseñado da resultados idénticos al original en este escenario
fixtureAExpected.motorRediseñado = [...fixtureAExpected.motorOriginal];
