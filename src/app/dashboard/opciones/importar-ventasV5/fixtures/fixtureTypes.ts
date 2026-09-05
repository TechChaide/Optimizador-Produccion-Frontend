/**
 * Tipos compartidos para los fixtures de validación IV5.
 *
 * Estos tipos definen un formato SIMPLIFICADO de fixture (más fácil de leer y
 * mantener) que se traduce a la entrada real del motor IV5 a través de un
 * convertidor (fixtureConverter.ts).
 *
 * La idea es que las personas que lean los fixtures puedan entenderlos sin
 * conocer la estructura interna del motor, y que sea fácil agregar nuevos
 * escenarios cambiando solo números.
 */

export type Centro = '1000' | '2000';
export type ClaseAprovisionam = 'F' | 'X' | 'E';

/** Definición de un material en el fixture. */
export interface FixtureMaterial {
  /** Código del material (ej. "M001"). */
  codigo: string;
  /** Nombre humano para reportes. */
  descripcion: string;
  /** Sector (importante para tope agregado: '01','02','03' entran al cap). */
  sector: string;
  /** Centro al que pertenece el material (donde se cumple la demanda). */
  centro: Centro;
  /** Clase de aprovisionamiento. */
  clase: ClaseAprovisionam;
  /** Línea de fabricación principal. Si clase=F, se fabrica en C1000 aunque el centro sea 2000. */
  lineaFabricacion: string;
  /**
   * Solo aplica a materiales X/E con centro=2000.
   * Si está definido, indica la línea de C1000 que puede fabricar el material como
   * respaldo cuando la capacidad propia de C2000 no alcanza para cubrir la demanda.
   * Si NO está definido, el déficit que C2000 no pueda cubrir se acumula como
   * backlog (no hay traslado posible).
   */
  lineaC1000Respaldo?: string;
  /** Tiempo unitario por puesto (min/uds). */
  tupp: number;
  /** Stock inicial al comenzar el horizonte. */
  stockInicial: number;
  /** Stock seguridad (piso defensivo). */
  stockSeguridad: number;
  /** Stock objetivo PIO (si está definido, se usa; sino se usa stockSeguridad como objetivo). */
  stockObjetivo?: number;
  /** Demanda por semana del horizonte (array con un valor por semana). */
  demandaSemanal: number[];
}

/** Capacidad disponible por línea por semana (en minutos). */
export interface FixtureLineCapacity {
  /** Línea (ej. "Linea A", "Linea B"). */
  linea: string;
  /** Centro donde está la línea. */
  centro: Centro;
  /** Minutos disponibles por semana (array con un valor por semana). */
  capacidadSemanal: number[];
}

/** Tope agregado de almacenamiento por centro. */
export interface FixtureStockCap {
  centro1000: number;
  centro2000: number;
  /** Sectores que cuentan para el tope (típicamente '01','02','03'). */
  sectoresAplicables: string[];
}

/** Configuración general del fixture. */
export interface FixtureConfig {
  /** Año del horizonte. */
  anio: number;
  /** Meses del horizonte (cronológicos). */
  meses: number[];
  /** Número de semanas que cubren los meses. */
  numSemanas: number;
}

/** Definición completa de un fixture. */
export interface Fixture {
  /** Nombre identificador del fixture (para reportes). */
  nombre: string;
  /** Breve descripción de qué escenario representa. */
  descripcion: string;
  /** Qué comportamiento se busca validar. */
  proposito: string;
  config: FixtureConfig;
  materiales: FixtureMaterial[];
  capacidades: FixtureLineCapacity[];
  stockCap: FixtureStockCap;
}

/** Resultado esperado por (material, centro, semana) para validar el motor. */
export interface FixtureExpectedRow {
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

/** Conjunto de resultados esperados para un fixture, por motor. */
export interface FixtureExpectedResults {
  motorOriginal: FixtureExpectedRow[];
  motorRediseñado: FixtureExpectedRow[];
  /** Comentarios humanos sobre las diferencias esperadas entre motores. */
  notasComparacion: string[];
}
