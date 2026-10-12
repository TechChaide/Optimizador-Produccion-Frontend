/**
 * Caché DIARIA en el navegador (IndexedDB) para consultas que SAP actualiza una sola vez al día — hoy
 * el Cubo de inventarios (usuario 2026-10-12: "solo deberíamos correrlo una vez al día, en el primer
 * flujo de sincronización"). Pesa ~51 MB, demasiado para localStorage. Sobrevive a recargar la página;
 * al cambiar el día la entrada deja de servir y la siguiente sincronización la vuelve a bajar.
 * Cualquier falla de IndexedDB (navegación privada, cuota) se ignora: se descarga como siempre.
 */
const BD = 'optimizador-cache-diaria';
const ALMACEN = 'consultas';

interface EntradaDiaria<T> { fecha: string; guardadoEn: string; valor: T }

const fechaLocal = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
const hoyLocal = () => fechaLocal(new Date());

/**
 * Periodo semanal que arranca el JUEVES (fecha del jueves más reciente, incluido hoy): los
 * mantenimientos preventivos se cargan al final del miércoles o, como máximo, el jueves, y no cambian
 * hasta la siguiente carga (usuario 2026-10-12).
 */
export const periodoDesdeJueves = (): string => {
  const d = new Date();
  d.setDate(d.getDate() - ((d.getDay() - 4 + 7) % 7));
  return fechaLocal(d);
};

/** ¿Hoy es jueves? Ese día la carga semanal puede llegar en cualquier momento. */
export const esJuevesHoy = (): boolean => new Date().getDay() === 4;

const abrir = (): Promise<IDBDatabase> => new Promise((ok, mal) => {
  if (typeof indexedDB === 'undefined') { mal(new Error('IndexedDB no disponible')); return; }
  const req = indexedDB.open(BD, 1);
  req.onupgradeneeded = () => { req.result.createObjectStore(ALMACEN); };
  req.onsuccess = () => ok(req.result);
  req.onerror = () => mal(req.error);
});

const operar = async <R,>(modo: IDBTransactionMode, fn: (s: IDBObjectStore) => IDBRequest<R>): Promise<R> => {
  const db = await abrir();
  try {
    return await new Promise<R>((ok, mal) => {
      const req = fn(db.transaction(ALMACEN, modo).objectStore(ALMACEN));
      req.onsuccess = () => ok(req.result);
      req.onerror = () => mal(req.error);
    });
  } finally {
    db.close();
  }
};

/**
 * Valor guardado para la clave en el periodo vigente (por defecto HOY; otro periodo, p. ej.
 * periodoDesdeJueves()), o null (otro periodo, sin guardar o IndexedDB no disponible).
 */
export const leerDiario = async <T,>(clave: string, periodo: string = hoyLocal()): Promise<{ valor: T; guardadoEn: Date } | null> => {
  try {
    const e = await operar<EntradaDiaria<T> | undefined>('readonly', s => s.get(clave));
    return e && e.fecha === periodo ? { valor: e.valor, guardadoEn: new Date(e.guardadoEn) } : null;
  } catch {
    return null;
  }
};

export const guardarDiario = async <T,>(clave: string, valor: T, periodo: string = hoyLocal()): Promise<void> => {
  try {
    await operar('readwrite', s => s.put({ fecha: periodo, guardadoEn: new Date().toISOString(), valor } satisfies EntradaDiaria<T>, clave));
  } catch {
    // Sin caché: la próxima sincronización lo vuelve a bajar.
  }
};
