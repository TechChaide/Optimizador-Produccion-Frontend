import { useEffect, useMemo, useSyncExternalStore } from 'react';
import { serviciosService } from '@/services/servicios.service';
import { useAppContext } from '@/context/AppProvider';

export const CENTROS = ['1000', '2000'] as const;
export type Centro = typeof CENTROS[number];

const findColumn = (cols: string[], name: string): string | null =>
  cols.find(c => c.toLowerCase() === name) || cols.find(c => c.toLowerCase().includes(name)) || null;

export interface NecesidadPar {
  centro: Centro;
  material: string;
}

// Bloque único por material (MaestroMaterialesExplosionPaginado siempre se pide como
// page=1, rowsPerPage=5000: cada material de necesidad cabe en una sola página).
const ROWS_PER_PAGE = 50;
// Peticiones en paralelo (una por material de necesidad) para no disparar todas de una vez.
const CONCURRENCY = 5;

interface Store {
  isLoading: boolean;
  progressDone: number;
  progressTotal: number;
  columns: string[];
  itemsByCentro: Record<Centro, any[]>;
  lastRunAt: number | null;
}

const createInitialStore = (): Store => ({
  isLoading: false,
  progressDone: 0,
  progressTotal: 0,
  columns: [],
  itemsByCentro: { '1000': [], '2000': [] },
  lastRunAt: null,
});

// Store a nivel de módulo: la pestaña "Rev Cap Halb" dispara explodeNecesidades() automáticamente
// con los pares Centro+Material de Órdenes Fert/Previsionales; la pestaña "Explosion Materiales"
// (ambas sub-pestañas) solo lee el resultado con useNecesidadesExplotadas().
let store: Store = createInitialStore();
const listeners = new Set<() => void>();
let notify: ((type: 'error' | 'warning' | 'success' | 'info', message: string) => void) | null = null;

const emit = () => listeners.forEach(listener => listener());

const patchStore = (patch: Partial<Store>) => {
  store = { ...store, ...patch };
  emit();
};

const subscribe = (listener: () => void) => {
  listeners.add(listener);
  return () => listeners.delete(listener);
};

const getSnapshot = () => store;

export async function explodeNecesidades(pares: NecesidadPar[]): Promise<void> {
  if (store.isLoading) {
    notify?.('warning', 'Ya hay una explosión de necesidades en curso, espere a que termine.');
    return;
  }

  const unique = new Map<string, NecesidadPar>();
  pares.forEach(p => {
    const material = String(p.material ?? '').trim();
    if (!material) return;
    unique.set(`${p.centro}|${material}`, { centro: p.centro, material });
  });
  const list = Array.from(unique.values());

  if (list.length === 0) {
    notify?.('warning', 'No hay materiales de necesidades (Fert_Principal) para explotar.');
    return;
  }

  patchStore({ isLoading: true, progressDone: 0, progressTotal: list.length });

  const resultByCentro: Record<Centro, any[]> = { '1000': [], '2000': [] };
  let columns: string[] = [];
  let errores = 0;

  let idx = 0;
  const worker = async () => {
    while (idx < list.length) {
      const current = list[idx++];
      try {
        const response = await serviciosService.getMaestroMaterialesExplosion(
          current.centro, current.material, 1, ROWS_PER_PAGE
        );
        const dataArray: any[] = Array.isArray((response as any)?.data) ? (response as any).data : [];
        if (dataArray.length > 0 && columns.length === 0) columns = Object.keys(dataArray[0]);
        resultByCentro[current.centro].push(...dataArray);
      } catch (err) {
        errores++;
      } finally {
        patchStore({ progressDone: store.progressDone + 1 });
      }
    }
  };

  const workerCount = Math.min(CONCURRENCY, list.length);
  await Promise.all(Array.from({ length: workerCount }, worker));

  patchStore({
    isLoading: false,
    itemsByCentro: resultByCentro,
    columns,
    lastRunAt: Date.now(),
  });

  const totalFilas = resultByCentro['1000'].length + resultByCentro['2000'].length;
  if (errores > 0) {
    notify?.('warning', `Explosión de necesidades completada con ${errores} error(es) de ${list.length} materiales (${totalFilas} filas obtenidas).`);
  } else {
    notify?.('success', `Explosión de necesidades completada: ${list.length} materiales, ${totalFilas} filas.`);
  }
}

/**
 * Lee el resultado (y estado) de la última explosión de necesidades disparada con
 * explodeNecesidades(), junto con las columnas de filtrado (Centro, Fert_Principal, etc.)
 * detectadas en ese resultado. También registra el canal de notificaciones del componente
 * que la esté usando (el último montado gana).
 */
export function useNecesidadesExplotadas() {
  const { addNotification } = useAppContext();

  useEffect(() => {
    notify = addNotification;
    return () => {
      if (notify === addNotification) notify = null;
    };
  }, [addNotification]);

  const snapshot = useSyncExternalStore(subscribe, getSnapshot, getSnapshot);

  const centroColumn = useMemo(() => (snapshot.columns.length === 0 ? null : findColumn(snapshot.columns, 'centro')), [snapshot.columns]);
  const fertPrincipalColumn = useMemo(() => (snapshot.columns.length === 0 ? null : findColumn(snapshot.columns, 'fert_principal')), [snapshot.columns]);
  const descripcionFertColumn = useMemo(() => (snapshot.columns.length === 0 ? null : findColumn(snapshot.columns, 'descripcion_fert')), [snapshot.columns]);
  const materialPadreColumn = useMemo(() => (snapshot.columns.length === 0 ? null : findColumn(snapshot.columns, 'material_padre')), [snapshot.columns]);
  const componenteColumn = useMemo(() => (snapshot.columns.length === 0 ? null : (snapshot.columns.find(c => c.toLowerCase() === 'componente') || null)), [snapshot.columns]);
  const descripcionComponenteColumn = useMemo(() => (snapshot.columns.length === 0 ? null : findColumn(snapshot.columns, 'descripcion_componente')), [snapshot.columns]);

  return {
    ...snapshot,
    centroColumn,
    fertPrincipalColumn,
    descripcionFertColumn,
    materialPadreColumn,
    componenteColumn,
    descripcionComponenteColumn,
  };
}
