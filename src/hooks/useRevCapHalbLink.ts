import { useSyncExternalStore } from 'react';

export type FertPrincipalesPorCentro = Record<string, Set<string>>;

const EMPTY: FertPrincipalesPorCentro = { '1000': new Set(), '2000': new Set() };

// Store a nivel de módulo: la pestaña "Rev cap Halb" publica aquí, por Centro, los códigos
// "Fert_Principal" (normalizados) que aparecen en su tabla "Detalle por Componente". La pestaña
// "Prog Tiempos" lo usa para marcar la columna "Ajustado" (Material ya reprogramado en Rev Cap
// Halb), de forma reactiva.
let store: FertPrincipalesPorCentro = EMPTY;
const listeners = new Set<() => void>();

const emit = () => listeners.forEach(listener => listener());

const subscribe = (listener: () => void) => {
  listeners.add(listener);
  return () => listeners.delete(listener);
};

const getSnapshot = () => store;

export function publishFertPrincipalesRevCapHalb(data: FertPrincipalesPorCentro) {
  store = data;
  emit();
}

export function useFertPrincipalesRevCapHalb(): FertPrincipalesPorCentro {
  return useSyncExternalStore(subscribe, getSnapshot, getSnapshot);
}
