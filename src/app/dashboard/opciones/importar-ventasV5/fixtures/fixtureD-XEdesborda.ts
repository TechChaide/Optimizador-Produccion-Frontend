/**
 * Fixture D — X/E desborda C2000, con respaldo C1000 parcial.
 *
 * Escenario: dos materiales X/E (M2 y M3) comparten la línea de C2000 que es
 * insuficiente para cubrir sus demandas combinadas. Uno de ellos (M2) tiene
 * línea de respaldo definida en C1000; el otro (M3) NO la tiene.
 *
 * Qué se valida con este fixture:
 *  - Que el déficit residual de X/E en C2000 se enruta correctamente a la
 *    línea de respaldo en C1000 cuando está definida.
 *  - Que si el material X/E NO tiene línea definida en C1000, el déficit
 *    simplemente se acumula como backlog (no hay traslado posible).
 *  - Que el prorrateo proporcional puro funciona cuando dos materiales X/E
 *    comparten una línea de C2000.
 *  - Que la línea de respaldo en C1000 tiene su propia capacidad y puede
 *    eventualmente convertirse en cuello de botella secundario.
 *
 * Comportamiento esperado clave:
 *  - M2 (con respaldo): mantiene stock cercano al objetivo durante todas las
 *    semanas, hasta que la línea de respaldo C1000 también se satura.
 *  - M3 (sin respaldo): stock erosiona progresivamente; eventualmente
 *    aparece backlog cuando el stock se agota.
 */

import type { Fixture, FixtureExpectedResults } from './fixtureTypes';

export const fixtureD: Fixture = {
  nombre: 'D — X/E desborda C2000 con respaldo parcial',
  descripcion: 'M2 (X/E con respaldo C1000) y M3 (X/E sin respaldo) comparten línea C2000 insuficiente',
  proposito: 'Validar el flujo X/E → respaldo C1000 y el caso donde no hay respaldo → backlog',

  config: {
    anio: 2026,
    meses: [1],
    numSemanas: 4,
  },

  materiales: [
    {
      codigo: 'M0',
      descripcion: 'Producto propio C1000 (estable, para referencia)',
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
      codigo: 'M2',
      descripcion: 'X/E con respaldo en C1000',
      sector: '01',
      centro: '2000',
      clase: 'X',
      lineaFabricacion: 'Linea-B-C2000', // línea principal en C2000
      lineaC1000Respaldo: 'Linea-C-C1000', // línea de respaldo cuando C2000 no alcanza
      tupp: 1,
      stockInicial: 80,
      stockSeguridad: 60,
      stockObjetivo: 80,
      demandaSemanal: [80, 80, 80, 80], // alta — desborda capacidad C2000
    },
    {
      codigo: 'M3',
      descripcion: 'X/E SIN respaldo (no existe línea en C1000)',
      sector: '01',
      centro: '2000',
      clase: 'X',
      lineaFabricacion: 'Linea-B-C2000', // misma línea que M2 → compiten
      // sin lineaC1000Respaldo: el déficit residual se queda como backlog
      tupp: 1,
      stockInicial: 40,
      stockSeguridad: 30,
      stockObjetivo: 40,
      demandaSemanal: [40, 40, 40, 40],
    },
  ],

  capacidades: [
    // Línea A de C1000: dedicada a M0 (propio)
    {
      linea: 'Linea-A-C1000',
      centro: '1000',
      capacidadSemanal: [60, 60, 60, 60], // suficiente para 50 + holgura
    },
    // Línea B de C2000: compartida entre M2 (necesidad 80) y M3 (necesidad 40)
    // → necesidad total 120 vs cap 60 → siempre hay prorrateo
    {
      linea: 'Linea-B-C2000',
      centro: '2000',
      capacidadSemanal: [60, 60, 60, 60],
    },
    // Línea C de C1000: dedicada a respaldo de M2
    {
      linea: 'Linea-C-C1000',
      centro: '1000',
      capacidadSemanal: [50, 50, 50, 50],
    },
  ],

  stockCap: {
    centro1000: 10000, // amplio, no entra a jugar en este fixture
    centro2000: 10000, // amplio
    sectoresAplicables: ['01', '02', '03'],
  },
};

/**
 * Resultados esperados — motor rediseñado.
 *
 * SEM 1 — Estado inicial limpio (sin brechas):
 *
 *   C2000 Linea-B prorrateo:
 *     - M2 necesidad: 80 (demanda) + 0 brecha = 80 min requeridos
 *     - M3 necesidad: 40 (demanda) + 0 brecha = 40 min requeridos
 *     - Total: 120 vs cap 60 → factor = 0.5
 *     - M2 produce 40, M3 produce 20
 *
 *   Residuales que pasan a C1000 como traslado X/E:
 *     - M2: 80 - 40 = 40 uds → va a Linea-C-C1000 (cap 50, fits)
 *     - M3: 40 - 20 = 20 uds → NO tiene línea en C1000 → NO se genera traslado
 *           → 20 uds quedan sin cubrir esta semana en C2000
 *
 *   C1000 Linea-A: M0 demanda 50, cap 60 → produce 50, stock 50
 *   C1000 Linea-C: M2 respaldo 40, cap 50 → produce 40, traslada 40
 *
 *   C2000 cierra:
 *     - M2: stock 80 + own 40 + transfer 40 = 160, despachos 80, stock_fin 80 ✓
 *     - M3: stock 40 + own 20 + transfer 0 = 60, despachos min(60,40)=40, stock_fin 20
 *       (sin backlog porque stock alcanza; pero stock cayó a 20, abajo del obj 40)
 *
 * SEM 2 — M3 acumula brecha:
 *
 *   C2000 Linea-B prorrateo:
 *     - M2 necesidad: 80 + 0 = 80 (stock se mantiene)
 *     - M3 necesidad: 40 + (40-20)=20 brecha = 60 min
 *     - Total: 140 vs cap 60 → factor = 0.429
 *     - M2 produce ≈ 34, M3 produce ≈ 26
 *
 *   Residuales:
 *     - M2: 80 - 34 = 46 → Linea-C (cap 50, fits)
 *     - M3: 60 - 26 = 34 → sin respaldo → no se genera
 *
 *   C2000 cierra:
 *     - M2: stock 80 + 34 + 46 = 160, despachos 80, stock_fin 80
 *     - M3: stock 20 + 26 + 0 = 46, despachos min(46, 40)=40, stock_fin 6
 *
 * SEM 3 — M3 stock casi agotado:
 *
 *   C2000 Linea-B prorrateo:
 *     - M2 necesidad: 80
 *     - M3 necesidad: 40 + (40-6)=34 brecha = 74
 *     - Total: 154 vs cap 60 → factor = 0.39
 *     - M2 produce ≈ 31, M3 produce ≈ 29
 *
 *   Residuales:
 *     - M2: 80 - 31 = 49 → Linea-C (cap 50, fits)
 *     - M3: 74 - 29 = 45 → sin respaldo
 *
 *   C2000 cierra:
 *     - M2: stock 80 + 31 + 49 = 160, despachos 80, stock_fin 80
 *     - M3: stock 6 + 29 + 0 = 35, despachos min(35, 40)=35, stock_fin 0, backlog 5
 *       (aquí aparece el primer backlog de M3)
 *
 * SEM 4 — M3 backlog crece; M2 toca límite de la línea respaldo:
 *
 *   C2000 Linea-B prorrateo:
 *     - M2 necesidad: 80
 *     - M3 necesidad: 40 + 5 backlog + 40 brecha = 85
 *     - Total: 165 vs cap 60 → factor = 0.364
 *     - M2 produce ≈ 29, M3 produce ≈ 31
 *
 *   Residuales:
 *     - M2: 80 - 29 = 51 → Linea-C cap 50 → recortar a 50 (M2 queda 1 corto)
 *     - M3: 85 - 31 = 54 → sin respaldo
 *
 *   C2000 cierra:
 *     - M2: stock 80 + 29 + 50 = 159, despachos 80, stock_fin 79 (1 ud abajo del obj)
 *     - M3: stock 0 + 31 + 0 = 31, despachos min(31, 40+5)=31, stock_fin 0, backlog 14
 *
 * RESUMEN AL CIERRE DEL HORIZONTE:
 *   - M0: stock 50 (al obj), backlog 0 — siempre ok
 *   - M2: stock 79 (1 ud abajo del obj), backlog 0 — respaldo C1000 protege casi al 100%
 *   - M3: stock 0, backlog 14 — sin respaldo, déficit acumulado
 */
export const fixtureDExpected: FixtureExpectedResults = {
  motorOriginal: [
    // El motor original también maneja líneas alternativas vía
    // `buildAlternativeLines` y el flujo de la pre-pasada. Los resultados
    // pueden diferir en cantidades exactas pero el patrón general es similar:
    // M2 protegido por respaldo, M3 acumula backlog.
    // No se completan números aquí porque dependen de detalles internos del
    // motor original que conviene observar en la corrida real.
  ],

  motorRediseñado: [
    // Anticipaciones planeadas (con prorrateo y respaldo X/E):
    //   M2: 2 uds | sem 1 → sem 4 | C2000_TRANSFER_XE
    //   (Linea-C de C1000 anticipa 2 uds extra de M2 para cubrir el déficit
    //    de sem 4 cuando el residual M2 supera la capacidad de Linea-C)
    //   M3 no se anticipa porque no tiene línea de respaldo en C1000.

    // === SEMANA 1 ===
    { material: 'M0', centro: '1000', semana: 1, produccion: 50, trasladoSaliente: 0, trasladoEntrante: 0, despachosVentas: 50, stockFinalRegular: 50, stockReservado: 0, stockFinalFisico: 50, backlogFinal: 0 },
    // M2 C1000: 40 normal + 2 anticipado = 42 producidas y trasladadas a C2000
    { material: 'M2', centro: '1000', semana: 1, produccion: 42, trasladoSaliente: 42, trasladoEntrante: 0, despachosVentas: 0, stockFinalRegular: 0, stockReservado: 0, stockFinalFisico: 0, backlogFinal: 0 },
    // M2 C2000: recibe 42 (40 entran a stock regular, 2 a reserva sem 4)
    { material: 'M2', centro: '2000', semana: 1, produccion: 40, trasladoSaliente: 0, trasladoEntrante: 42, despachosVentas: 80, stockFinalRegular: 80, stockReservado: 2, stockFinalFisico: 82, backlogFinal: 0 },
    // M3 solo C2000 (no hay respaldo). Stock cae a 20.
    { material: 'M3', centro: '2000', semana: 1, produccion: 20, trasladoSaliente: 0, trasladoEntrante: 0, despachosVentas: 40, stockFinalRegular: 20, stockReservado: 0, stockFinalFisico: 20, backlogFinal: 0 },

    // === SEMANA 2 — sin anticipaciones nuevas, reserva M2 persiste ===
    { material: 'M0', centro: '1000', semana: 2, produccion: 50, trasladoSaliente: 0, trasladoEntrante: 0, despachosVentas: 50, stockFinalRegular: 50, stockReservado: 0, stockFinalFisico: 50, backlogFinal: 0 },
    { material: 'M2', centro: '1000', semana: 2, produccion: 46, trasladoSaliente: 46, trasladoEntrante: 0, despachosVentas: 0, stockFinalRegular: 0, stockReservado: 0, stockFinalFisico: 0, backlogFinal: 0 },
    { material: 'M2', centro: '2000', semana: 2, produccion: 34, trasladoSaliente: 0, trasladoEntrante: 46, despachosVentas: 80, stockFinalRegular: 80, stockReservado: 2, stockFinalFisico: 82, backlogFinal: 0 },
    { material: 'M3', centro: '2000', semana: 2, produccion: 25, trasladoSaliente: 0, trasladoEntrante: 0, despachosVentas: 40, stockFinalRegular: 5, stockReservado: 0, stockFinalFisico: 5, backlogFinal: 0 },

    // === SEMANA 3 — M3 entra en backlog ===
    { material: 'M0', centro: '1000', semana: 3, produccion: 50, trasladoSaliente: 0, trasladoEntrante: 0, despachosVentas: 50, stockFinalRegular: 50, stockReservado: 0, stockFinalFisico: 50, backlogFinal: 0 },
    { material: 'M2', centro: '1000', semana: 3, produccion: 50, trasladoSaliente: 50, trasladoEntrante: 0, despachosVentas: 0, stockFinalRegular: 0, stockReservado: 0, stockFinalFisico: 0, backlogFinal: 0 },
    { material: 'M2', centro: '2000', semana: 3, produccion: 30, trasladoSaliente: 0, trasladoEntrante: 50, despachosVentas: 80, stockFinalRegular: 80, stockReservado: 2, stockFinalFisico: 82, backlogFinal: 0 },
    // M3: stock 5+29=34, despacha 34, stock_fin 0, backlog 6
    { material: 'M3', centro: '2000', semana: 3, produccion: 29, trasladoSaliente: 0, trasladoEntrante: 0, despachosVentas: 34, stockFinalRegular: 0, stockReservado: 0, stockFinalFisico: 0, backlogFinal: 6 },

    // === SEMANA 4 — M2 maduración salva el día; M3 sigue empeorando ===
    { material: 'M0', centro: '1000', semana: 4, produccion: 50, trasladoSaliente: 0, trasladoEntrante: 0, despachosVentas: 50, stockFinalRegular: 50, stockReservado: 0, stockFinalFisico: 50, backlogFinal: 0 },
    { material: 'M2', centro: '1000', semana: 4, produccion: 50, trasladoSaliente: 50, trasladoEntrante: 0, despachosVentas: 0, stockFinalRegular: 0, stockReservado: 0, stockFinalFisico: 0, backlogFinal: 0 },
    // M2 C2000: maduración 2 (de la reserva sem 1) + own 28 + transfer 50 + carry 80 = 160, despacha 80, stock_fin 80 ✓ al obj
    { material: 'M2', centro: '2000', semana: 4, produccion: 28, trasladoSaliente: 0, trasladoEntrante: 50, despachosVentas: 80, stockFinalRegular: 80, stockReservado: 0, stockFinalFisico: 80, backlogFinal: 0 },
    // M3: stock 0 + 31 = 31, despacha 31, backlog crece a 15 (= 6 prev + 40 nueva - 31)
    { material: 'M3', centro: '2000', semana: 4, produccion: 31, trasladoSaliente: 0, trasladoEntrante: 0, despachosVentas: 31, stockFinalRegular: 0, stockReservado: 0, stockFinalFisico: 0, backlogFinal: 15 },
  ],

  notasComparacion: [
    'M2 tiene línea de respaldo en C1000 (Linea-C). Cada semana C2000 produce parte (40, 34, 31, 29) y el residual se manda a producirse en C1000 (40, 46, 49, 50).',
    'En sem 4 la Línea-C de C1000 ya no puede producir todo el residual (51 pedidos vs 50 capacidad) y M2 queda con 1 ud por debajo del objetivo.',
    'M3 NO tiene línea de respaldo. El residual de C2000 (20, 34, 45, 54 uds cada semana) simplemente NO se produce en ningún lado.',
    'M3 stock se erosiona progresivamente: 40 → 20 → 6 → 0 → 0. En sem 3 aparece el primer backlog (5 uds) y crece a 14 en sem 4.',
    'Sin respaldo y con demanda persistente que supera la capacidad C2000 disponible, la única salida es acumular backlog.',
    'Esta es la situación que muestra el comportamiento esperado por diseño: el motor NO inventa capacidad en C1000 si el material no está definido ahí. Reporta el backlog y deja al usuario decidir (subir capacidad C2000, agregar definición C1000, reducir demanda, etc).',
    'Diferencia esperada vs motor original: el motor original también enruta vía `buildAlternativeLines`, pero la estimación del pre-pase puede sub-pedir traslados X/E y resultar en stocks ligeramente diferentes. Los patrones generales (M2 protegido, M3 con backlog) son los mismos.',
  ],
};
