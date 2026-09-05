import { useEffect, useSyncExternalStore } from 'react';
import { serviciosService } from '@/services/servicios.service';
import { useAppContext } from '@/context/AppProvider';

interface Store {
  tiemposData: any[];
  fertOrders: any[];
  provisionalOrders: any[];
  isLoading: boolean;
  hasLoaded: boolean;
}

const createInitialStore = (): Store => ({
  tiemposData: [],
  fertOrders: [],
  provisionalOrders: [],
  isLoading: false,
  hasLoaded: false,
});

// Store a nivel de módulo: es la fuente única de TiemposEnsamblado + Órdenes Fert/Previsionales
// para la pestaña "Prog Tiempos" (que la carga/actualiza) y para "Explosion Materiales" (que solo
// la lee, para las columnas "Cant Total" y "Tiempo total req"). Al vivir fuera de React persiste
// aunque ambas pestañas se desmonten y se vuelvan a montar.
let store: Store = createInitialStore();
const listeners = new Set<() => void>();
let notifyError: ((type: 'error', message: string) => void) | null = null;

// El origen (/TiemposEnsamblado) a veces repite exactamente el mismo registro (mismo
// Centro+Material+Línea+Puesto+Tiempo+HojaRuta) más de una vez. Se deduplica aquí, en la fuente
// compartida por "Prog Tiempos" y "Explosion Materiales", para que ninguna de las dos duplique
// filas mientras se corrige el dato en el origen.
export const dedupeTiemposRows = (rows: any[]): any[] => {
  const seen = new Set<string>();
  return rows.filter(row => {
    const key = [row.Centro, row.CodMaterial, row.Linea, row.PuestoTrabajo, row.Tiempo_Min, row.HojaRuta, row.CONTADORHOJARUTA]
      .map(v => String(v ?? '').trim())
      .join('|');
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
};

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

async function loadTiemposFertData(): Promise<void> {
  if (store.isLoading) return;
  patchStore({ isLoading: true });

  try {
    let allTiempos: any[] = [];
    let page = 1;
    let hasMore = true;
    const pageSize = 10000;

    while (hasMore) {
      const response = await serviciosService.getTiemposEnsamblado(page, pageSize);
      const rawData = Array.isArray(response?.data) ? response.data : [];
      allTiempos = [...allTiempos, ...rawData];

      const total = (response as any)?.totalRegistros || (response as any)?.totalRecords || 0;
      if (allTiempos.length >= total || rawData.length < pageSize || total === 0) {
        hasMore = false;
      } else {
        page++;
      }
      if (page > 50) break;
    }

    const [fertResponse, prevResponse] = await Promise.all([
      serviciosService.getOrdenesFert(1, 10000),
      serviciosService.OrdenesProvisionalesAlphaPaginados(1, 10000),
    ]);

    patchStore({
      tiemposData: dedupeTiemposRows(allTiempos),
      fertOrders: Array.isArray(fertResponse?.data) ? fertResponse.data : [],
      provisionalOrders: Array.isArray(prevResponse?.data) ? prevResponse.data : [],
      hasLoaded: true,
    });
  } catch (err) {
    notifyError?.('error', `Error al cargar datos de Tiempos/Órdenes: ${(err as Error).message}`);
  } finally {
    patchStore({ isLoading: false });
  }
}

function ensureTiemposFertLoaded() {
  if (store.hasLoaded || store.isLoading) return;
  loadTiemposFertData();
}

/**
 * Expone TiemposEnsamblado + Órdenes Fert/Previsionales desde un store compartido a nivel de
 * módulo. `refresh` fuerza una recarga (pensado para el botón "Actualizar" de "Prog Tiempos");
 * `ensureLoaded` solo carga si todavía no hay datos (para que otros consumidores, como
 * "Explosion Materiales", tengan algo que mostrar la primera vez sin forzar una recarga).
 */
export function useTiemposFertData() {
  const { addNotification } = useAppContext();

  useEffect(() => {
    notifyError = addNotification;
    return () => {
      if (notifyError === addNotification) notifyError = null;
    };
  }, [addNotification]);

  const snapshot = useSyncExternalStore(subscribe, getSnapshot, getSnapshot);

  return {
    tiemposData: snapshot.tiemposData,
    fertOrders: snapshot.fertOrders,
    provisionalOrders: snapshot.provisionalOrders,
    isLoading: snapshot.isLoading,
    hasLoaded: snapshot.hasLoaded,
    refresh: loadTiemposFertData,
    ensureLoaded: ensureTiemposFertLoaded,
  };
}
