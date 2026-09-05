/**
 * Índice de fixtures para validación del motor IV5 rediseñado.
 *
 * Estos archivos contienen datos de prueba que permiten comparar el
 * comportamiento del motor original (el que existe hoy en la aplicación)
 * con el motor rediseñado (el integrado semana a semana con anticipación
 * y reservas).
 *
 * Cada fixture incluye:
 *  - Datos de entrada (materiales, capacidades, topes, demanda semanal)
 *  - Resultados esperados calculados manualmente para cada motor
 *  - Notas sobre qué diferencias se esperan
 *
 * Próximo paso (Fase 2): implementar el motor rediseñado como script
 * standalone (`motorRediseñado.ts`) que pueda ejecutarse contra estos
 * fixtures y generar una salida real comparable con el motor original.
 *
 * Uso futuro: si se decide hacer un motor v3 o agregar otra etapa, estos
 * fixtures sirven como regresión: cualquier nueva versión debe seguir
 * produciendo los resultados esperados (o se decide cambiar las expectativas
 * conscientemente).
 */

export { fixtureA, fixtureAExpected } from './fixtureA-casoBase';
export { fixtureB, fixtureBExpected } from './fixtureB-picoDemanda';
export { fixtureC, fixtureCExpected } from './fixtureC-topeAjustado';
export { fixtureD, fixtureDExpected } from './fixtureD-XEdesborda';
export type {
  Fixture,
  FixtureMaterial,
  FixtureLineCapacity,
  FixtureStockCap,
  FixtureConfig,
  FixtureExpectedRow,
  FixtureExpectedResults,
  Centro,
  ClaseAprovisionam,
} from './fixtureTypes';

import { fixtureA, fixtureAExpected } from './fixtureA-casoBase';
import { fixtureB, fixtureBExpected } from './fixtureB-picoDemanda';
import { fixtureC, fixtureCExpected } from './fixtureC-topeAjustado';
import { fixtureD, fixtureDExpected } from './fixtureD-XEdesborda';

/** Catálogo completo de fixtures para iterar fácilmente desde un script. */
export const TODOS_LOS_FIXTURES = [
  { fixture: fixtureA, expected: fixtureAExpected },
  { fixture: fixtureB, expected: fixtureBExpected },
  { fixture: fixtureC, expected: fixtureCExpected },
  { fixture: fixtureD, expected: fixtureDExpected },
] as const;
