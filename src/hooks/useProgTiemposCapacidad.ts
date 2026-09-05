import { useSyncExternalStore } from 'react';

// Suma de "Tiempo Final" (basado en Cant Reprog) por Centro+Línea+Puesto Trabajo, publicada por
// "Prog Tiempos". "Rev Capacidad" la usa como su "Total Tiempo (h)" para que el % Ocupación que
// muestra refleje los ajustes de Cant Reprog hechos en Prog Tiempos.
export type TiempoFinalPorPuesto = Record<string, number>;

let store: TiempoFinalPorPuesto = {};
const listeners = new Set<() => void>();

const emit = () => listeners.forEach(listener => listener());

const subscribe = (listener: () => void) => {
  listeners.add(listener);
  return () => listeners.delete(listener);
};

const getSnapshot = () => store;

export function publishTiempoFinalPorPuesto(data: TiempoFinalPorPuesto) {
  store = data;
  emit();
}

export function useTiempoFinalPorPuesto(): TiempoFinalPorPuesto {
  return useSyncExternalStore(subscribe, getSnapshot, getSnapshot);
}

// Suma de "Cant Reprog" (la cantidad ya ajustada, no la demanda cruda) por Centro+Línea+Puesto
// Trabajo, publicada por "Prog Tiempos". "Rev Capacidad" la usa como su "Total Cantidad" para que
// esa columna quede consistente con el "% Ocupación" (que ya refleja Cant Reprog vía Tiempo Final) —
// de lo contrario la cantidad mostrada seguiría siendo la demanda sin ajustar mientras el % de
// Ocupación sí cambia.
export type CantidadFinalPorPuesto = Record<string, number>;

let cantidadStore: CantidadFinalPorPuesto = {};
const cantidadListeners = new Set<() => void>();

const emitCantidad = () => cantidadListeners.forEach(listener => listener());

const subscribeCantidad = (listener: () => void) => {
  cantidadListeners.add(listener);
  return () => cantidadListeners.delete(listener);
};

const getCantidadSnapshot = () => cantidadStore;

export function publishCantidadFinalPorPuesto(data: CantidadFinalPorPuesto) {
  cantidadStore = data;
  emitCantidad();
}

export function useCantidadFinalPorPuesto(): CantidadFinalPorPuesto {
  return useSyncExternalStore(subscribeCantidad, getCantidadSnapshot, getCantidadSnapshot);
}

// Suma de "Tiempo Total" (demanda cruda: Tiempo ordFab + Tiempo ordPrev, SIN el ajuste de Cant
// Reprog) por Centro+Línea+Puesto Trabajo, publicada por "Prog Tiempos". "Rev Capacidad" la usa
// como su "Tiempo inicial", para comparar la demanda original contra el "Total Tiempo (h)" ya
// ajustado (que si refleja Cant Reprog vía Tiempo Final).
export type TiempoInicialPorPuesto = Record<string, number>;

let tiempoInicialStore: TiempoInicialPorPuesto = {};
const tiempoInicialListeners = new Set<() => void>();

const emitTiempoInicial = () => tiempoInicialListeners.forEach(listener => listener());

const subscribeTiempoInicial = (listener: () => void) => {
  tiempoInicialListeners.add(listener);
  return () => tiempoInicialListeners.delete(listener);
};

const getTiempoInicialSnapshot = () => tiempoInicialStore;

export function publishTiempoInicialPorPuesto(data: TiempoInicialPorPuesto) {
  tiempoInicialStore = data;
  emitTiempoInicial();
}

export function useTiempoInicialPorPuesto(): TiempoInicialPorPuesto {
  return useSyncExternalStore(subscribeTiempoInicial, getTiempoInicialSnapshot, getTiempoInicialSnapshot);
}

// Suma de "Total Cantidad" (demanda cruda: Cant ordFab + Cant ordPrev, SIN el ajuste de Cant
// Reprog) por Centro+Línea+Puesto Trabajo, publicada por "Prog Tiempos". "Rev Capacidad" la usa
// como su "Cant inicial", el contrapunto de "Cant inicial" es "Total Cantidad" (ya ajustada).
export type CantidadInicialPorPuesto = Record<string, number>;

let cantidadInicialStore: CantidadInicialPorPuesto = {};
const cantidadInicialListeners = new Set<() => void>();

const emitCantidadInicial = () => cantidadInicialListeners.forEach(listener => listener());

const subscribeCantidadInicial = (listener: () => void) => {
  cantidadInicialListeners.add(listener);
  return () => cantidadInicialListeners.delete(listener);
};

const getCantidadInicialSnapshot = () => cantidadInicialStore;

export function publishCantidadInicialPorPuesto(data: CantidadInicialPorPuesto) {
  cantidadInicialStore = data;
  emitCantidadInicial();
}

export function useCantidadInicialPorPuesto(): CantidadInicialPorPuesto {
  return useSyncExternalStore(subscribeCantidadInicial, getCantidadInicialSnapshot, getCantidadInicialSnapshot);
}

// Resultado (por Centro) de la última vez que se ejecutó el botón "Ajustar Capacidad" en
// "Prog Tiempos" — a diferencia de un store continuo, esto NO se actualiza con cada edición o
// recálculo en vivo: solo se reemplaza cuando el botón corre para ese Centro. "Plan Propuesto" lo
// usa para PRESENTAR exactamente ese resultado, sin recalcular ni reaccionar a cambios intermedios.
export interface CantReprogMaterialRow {
  centro: string;
  linea: string;
  material: string;
  descripcion: string;
  puesto: string;
  cantidadOriginal: number;
  cantReprog: number;
  tiempoFinal: number;
}
export type ResultadoAjustePorCentro = Record<string, CantReprogMaterialRow[]>;

let resultadoAjusteStore: ResultadoAjustePorCentro = {};
const resultadoAjusteListeners = new Set<() => void>();

const emitResultadoAjuste = () => resultadoAjusteListeners.forEach(listener => listener());

const subscribeResultadoAjuste = (listener: () => void) => {
  resultadoAjusteListeners.add(listener);
  return () => resultadoAjusteListeners.delete(listener);
};

const getResultadoAjusteSnapshot = () => resultadoAjusteStore;

export function publishResultadoAjusteCentro(centro: string, filas: CantReprogMaterialRow[]) {
  resultadoAjusteStore = { ...resultadoAjusteStore, [centro]: filas };
  emitResultadoAjuste();
}

export function useResultadoAjustePorCentro(): ResultadoAjustePorCentro {
  return useSyncExternalStore(subscribeResultadoAjuste, getResultadoAjusteSnapshot, getResultadoAjusteSnapshot);
}

// Espejo EN VIVO (por Material) de "Total Cantidad"/"Cant Reprog"/"Tiempo Final" de "Prog Tiempos",
// publicado en cada render mientras esa pestaña está montada — a diferencia de
// `resultadoAjusteStore`, que solo se actualiza al correr "Ajustar Capacidad". El botón
// "Refrescar" de "Plan Propuesto" copia este snapshot vigente hacia la vista, para traer también
// ediciones manuales de "Cant Reprog" sin depender de que se haya presionado ese botón.
let resultadoActualStore: ResultadoAjustePorCentro = {};
const resultadoActualListeners = new Set<() => void>();

const emitResultadoActual = () => resultadoActualListeners.forEach(listener => listener());

const subscribeResultadoActual = (listener: () => void) => {
  resultadoActualListeners.add(listener);
  return () => resultadoActualListeners.delete(listener);
};

const getResultadoActualSnapshot = () => resultadoActualStore;

export function publishResultadoActualCentro(centro: string, filas: CantReprogMaterialRow[]) {
  resultadoActualStore = { ...resultadoActualStore, [centro]: filas };
  emitResultadoActual();
}

export function useResultadoActualPorCentro(): ResultadoAjustePorCentro {
  return useSyncExternalStore(subscribeResultadoActual, getResultadoActualSnapshot, getResultadoActualSnapshot);
}
