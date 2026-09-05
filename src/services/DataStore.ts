
/**
 * DataStore: Almacén centralizado de datos de la aplicación
 * 
 * Esta es la "zona común" donde todos los componentes guardan sus datos
 * para que la IA pueda acceder a ellos fácilmente.
 * 
 * Características:
 * - Single source of truth para todos los datos
 * - Sistema de suscripción para actualizaciones en tiempo real
 * - Historial de cambios
 * - Acceso fácil para herramientas de IA
 */

export interface DataSnapshot {
  timestamp: Date;
  source: string; // Componente que guardó los datos
  data: any;
  metadata?: {
    description?: string;
    rowCount?: number;
    filters?: any;
    [key: string]: any;
  };
}

export interface DataStoreState {
  // Datos principales de la aplicación
  salesData: DataSnapshot | null;
  productionPlan: DataSnapshot | null;
  employees: DataSnapshot | null;
  maintenanceEvents: DataSnapshot | null;
  absenteeismEvents: DataSnapshot | null;
  workShifts: DataSnapshot | null;
  constraints: DataSnapshot | null;
  tacticalPlan: DataSnapshot | null;
  inventory: DataSnapshot | null;
  
  // Datos adicionales
  [key: string]: DataSnapshot | null;
}

type DataKey = keyof DataStoreState | string;
type DataStoreListener = (key: DataKey, snapshot: DataSnapshot | null) => void;

class DataStore {
  private static instance: DataStore;
  private state: DataStoreState = {
    salesData: null,
    productionPlan: null,
    employees: null,
    maintenanceEvents: null,
    absenteeismEvents: null,
    workShifts: null,
    constraints: null,
    tacticalPlan: null,
    inventory: null,
  };
  
  private listeners: DataStoreListener[] = [];
  private history: Map<DataKey, DataSnapshot[]> = new Map();

  private constructor() {}

  public static getInstance(): DataStore {
    if (!DataStore.instance) {
      DataStore.instance = new DataStore();
    }
    return DataStore.instance;
  }

  /**
   * Suscribirse a cambios en el store
   */
  public subscribe(listener: DataStoreListener): () => void {
    this.listeners.push(listener);
    return () => {
      this.listeners = this.listeners.filter(l => l !== listener);
    };
  }

  /**
   * Guardar datos en el store
   */
  public setData(
    key: DataKey,
    data: any,
    source: string,
    metadata?: DataSnapshot['metadata']
  ): void {
    const snapshot: DataSnapshot = {
      timestamp: new Date(),
      source,
      data: this.serializeData(data),
      metadata: {
        ...metadata,
        rowCount: Array.isArray(data) ? data.length : undefined,
      },
    };

    // Guardar en estado actual
    (this.state as any)[key] = snapshot;

    // Guardar en historial (mantener últimos 10)
    if (!this.history.has(key)) {
      this.history.set(key, []);
    }
    const hist = this.history.get(key)!;
    hist.push(snapshot);
    if (hist.length > 10) {
      hist.shift();
    }

    // Notificar listeners
    this.notifyListeners(key, snapshot);
  }

  /**
   * Obtener datos del store
   */
  public getData(key: DataKey): DataSnapshot | null {
    return (this.state as any)[key] || null;
  }

  /**
   * Obtener todos los datos del store
   */
  public getAllData(): DataStoreState {
    return { ...this.state };
  }

  /**
   * Obtener historial de un dato
   */
  public getHistory(key: DataKey, limit: number = 10): DataSnapshot[] {
    return this.history.get(key)?.slice(-limit) || [];
  }

  /**
   * Obtener resumen de todos los datos disponibles
   */
  public getSummary(): {
    availableKeys: string[];
    dataByKey: Record<string, {
      lastUpdate: Date;
      source: string;
      rowCount?: number;
      description?: string;
    }>;
  } {
    const availableKeys: string[] = [];
    const dataByKey: Record<string, any> = {};

    Object.entries(this.state).forEach(([key, snapshot]) => {
      if (snapshot) {
        availableKeys.push(key);
        dataByKey[key] = {
          lastUpdate: snapshot.timestamp,
          source: snapshot.source,
          rowCount: snapshot.metadata?.rowCount,
          description: snapshot.metadata?.description,
        };
      }
    });

    return { availableKeys, dataByKey };
  }

  /**
   * Limpiar un dato específico
   */
  public clearData(key: DataKey): void {
    (this.state as any)[key] = null;
    this.notifyListeners(key, null);
  }

  /**
   * Limpiar todos los datos
   */
  public clearAll(): void {
    Object.keys(this.state).forEach(key => {
      (this.state as any)[key] = null;
    });
    this.history.clear();
  }

  /**
   * Serializar datos para almacenamiento seguro
   */
  private serializeData(data: any): any {
    try {
      if (data === null || data === undefined) return data;
      
      if (typeof data === 'function') {
        return '[Function]';
      }

      if (data instanceof Date) {
        return data.toISOString();
      }

      if (Array.isArray(data)) {
        // Para arrays grandes, mantener todo pero advertir
        if (data.length > 10000) {
          console.warn(`DataStore: Large array (${data.length} items) being stored. Consider pagination.`);
        }
        return data.map(item => this.serializeData(item));
      }

      if (typeof data === 'object') {
        const serialized: any = {};
        for (const key of Object.keys(data)) {
          try {
            serialized[key] = this.serializeData(data[key]);
          } catch {
            serialized[key] = '[Unserializable]';
          }
        }
        return serialized;
      }

      return data;
    } catch (error) {
      console.error('DataStore serialization error:', error);
      return '[Serialization Error]';
    }
  }

  private notifyListeners(key: DataKey, snapshot: DataSnapshot | null): void {
    this.listeners.forEach(listener => {
      try {
        listener(key, snapshot);
      } catch (error) {
        console.error('DataStore listener error:', error);
      }
    });
  }
}

export const dataStore = DataStore.getInstance();

/**
 * Hook de React para usar el DataStore
 */
export function useDataStore() {
  return {
    setData: (key: DataKey, data: any, source: string, metadata?: DataSnapshot['metadata']) => {
      dataStore.setData(key, data, source, metadata);
    },
    
    getData: (key: DataKey) => {
      return dataStore.getData(key);
    },
    
    getAllData: () => {
      return dataStore.getAllData();
    },
    
    getSummary: () => {
      return dataStore.getSummary();
    },
    
    clearData: (key: DataKey) => {
      dataStore.clearData(key);
    }
  };
}
