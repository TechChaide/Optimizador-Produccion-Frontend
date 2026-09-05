/**
 * Caché en memoria para los datos de trabajo de los módulos tácticos.
 *
 * Problema que resuelve: cada módulo es una página con su estado en `useState`. Al navegar a otro
 * módulo React desmonta el componente y TODO lo cargado se pierde — había que volver a sincronizar
 * (8 llamadas a SAP, ~35 s) solo por haber ido a mirar otra pantalla. Con la carga en manual eso se
 * volvió especialmente molesto: el módulo no se recarga solo, así que quedaba vacío.
 *
 * Vive fuera de React a propósito: es un objeto de módulo, así que sobrevive al desmontaje de
 * cualquier componente y muere con la pestaña. NO se persiste en `sessionStorage`: son +40.000
 * órdenes por módulo y serializarlas/deserializarlas costaría más que volver a pedirlas.
 *
 * Ciclo de vida del dato: se guarda al sincronizar y se reemplaza al volver a sincronizar o al
 * refrescar el P2 (que es lo que ocurre después de generar un P3/PFD). Es decir, el usuario mantiene
 * lo que está trabajando hasta que él mismo pide datos nuevos.
 */
const cache = new Map<string, unknown>();

export const guardarEnCache = <T>(clave: string, valor: T): void => {
  cache.set(clave, valor);
};

export const leerDeCache = <T>(clave: string): T | undefined => cache.get(clave) as T | undefined;

export const hayEnCache = (clave: string): boolean => cache.has(clave);

/** Borra lo guardado de un módulo — para forzar que la próxima entrada lo pida de nuevo. */
export const invalidarCache = (clave: string): void => {
  cache.delete(clave);
};

/** Actualiza una parte del snapshot ya guardado, sin tener que reescribirlo entero. */
export const actualizarEnCache = <T extends object>(clave: string, parcial: Partial<T>): void => {
  const actual = cache.get(clave) as T | undefined;
  if (!actual) return;
  cache.set(clave, { ...actual, ...parcial });
};
