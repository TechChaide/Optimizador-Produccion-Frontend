
/**
 * RuntimeInspector: Sistema de observabilidad profunda para rastrear
 * variables, estados, operaciones y contexto de ejecución en tiempo real.
 * 
 * Permite al agente de IA responder preguntas sobre qué está haciendo el código,
 * qué valores tienen las variables, qué operaciones se están ejecutando, etc.
 */

export interface VariableSnapshot {
  id: string;
  timestamp: Date;
  section: string;
  scope: string; // 'component', 'function', 'api', 'calculation'
  name: string;
  value: any;
  type: string; // typeof value
  metadata?: {
    source?: string; // de dónde viene (API, usuario, cálculo)
    dependencies?: string[]; // variables de las que depende
    description?: string;
  };
}

export interface ExecutionContext {
  id: string;
  timestamp: Date;
  section: string;
  action: string; // 'load', 'filter', 'calculate', 'submit', 'transform'
  status: 'started' | 'running' | 'completed' | 'failed';
  inputs?: Record<string, any>;
  outputs?: Record<string, any>;
  duration?: number;
  error?: string;
  stackTrace?: string[];
}

export interface StateSnapshot {
  section: string;
  timestamp: Date;
  state: Record<string, any> | string;
  props?: Record<string, any> | string;
  computed?: Record<string, any> | string;
}

type InspectorListener = (event: {
  type: 'variable' | 'context' | 'state';
  data: VariableSnapshot | ExecutionContext | StateSnapshot;
}) => void;

class RuntimeInspector {
  private static instance: RuntimeInspector;
  private listeners: InspectorListener[] = [];
  
  // Almacenamiento en memoria
  private variables: Map<string, VariableSnapshot[]> = new Map(); // key: section
  private contexts: ExecutionContext[] = [];
  private states: Map<string, StateSnapshot> = new Map(); // key: section
  private activeContexts: Map<string, ExecutionContext> = new Map(); // key: contextId

  private constructor() {}

  public static getInstance(): RuntimeInspector {
    if (!RuntimeInspector.instance) {
      RuntimeInspector.instance = new RuntimeInspector();
    }
    return RuntimeInspector.instance;
  }

  /**
   * Suscribirse a cambios
   */
  public subscribe(listener: InspectorListener): () => void {
    this.listeners.push(listener);
    return () => {
      this.listeners = this.listeners.filter(l => l !== listener);
    };
  }

  /**
   * Capturar una variable o valor
   */
  public captureVariable(
    section: string,
    scope: string,
    name: string,
    value: any,
    metadata?: VariableSnapshot['metadata']
  ): void {
    const snapshot: VariableSnapshot = {
      id: `var-${Date.now()}-${Math.random().toString(36).substring(7)}`,
      timestamp: new Date(),
      section,
      scope,
      name,
      value: this.serializeValue(value),
      type: typeof value,
      metadata,
    };

    // Almacenar
    if (!this.variables.has(section)) {
      this.variables.set(section, []);
    }
    const sectionVars = this.variables.get(section)!;
    
    // Mantener solo las últimas 50 variables por sección
    if (sectionVars.length >= 50) {
      sectionVars.shift();
    }
    sectionVars.push(snapshot);

    // Notificar
    this.notifyListeners({
      type: 'variable',
      data: snapshot,
    });
  }

  /**
   * Iniciar un contexto de ejecución
   */
  public startContext(
    section: string,
    action: string,
    inputs?: Record<string, any>
  ): string {
    const contextId = `ctx-${Date.now()}-${Math.random().toString(36).substring(7)}`;
    
    const context: ExecutionContext = {
      id: contextId,
      timestamp: new Date(),
      section,
      action,
      status: 'started',
      inputs: inputs ? this.serializeValue(inputs) : undefined,
    };

    this.activeContexts.set(contextId, context);
    this.contexts.push(context);

    // Mantener solo los últimos 100 contextos
    if (this.contexts.length > 100) {
      this.contexts.shift();
    }

    this.notifyListeners({
      type: 'context',
      data: context,
    });

    return contextId;
  }

  /**
   * Actualizar un contexto de ejecución
   */
  public updateContext(
    contextId: string,
    status: ExecutionContext['status'],
    data?: { outputs?: Record<string, any>; error?: string; stackTrace?: string[] }
  ): void {
    const context = this.activeContexts.get(contextId);
    if (!context) return;

    const startTime = context.timestamp.getTime();
    const duration = Date.now() - startTime;

    const updated: ExecutionContext = {
      ...context,
      status,
      duration,
      outputs: data?.outputs ? this.serializeValue(data.outputs) : context.outputs,
      error: data?.error,
      stackTrace: data?.stackTrace,
    };

    if (status === 'completed' || status === 'failed') {
      this.activeContexts.delete(contextId);
    } else {
      this.activeContexts.set(contextId, updated);
    }

    const index = this.contexts.findIndex(c => c.id === contextId);
    if (index !== -1) {
      this.contexts[index] = updated;
    }

    this.notifyListeners({
      type: 'context',
      data: updated,
    });
  }

  /**
   * Capturar el estado completo de un componente
   */
  public captureState(
    section: string,
    state: Record<string, any>,
    props?: Record<string, any>,
    computed?: Record<string, any>
  ): void {
    const snapshot: StateSnapshot = {
      section,
      timestamp: new Date(),
      state: JSON.stringify(this.serializeValue(state), null, 2),
      props: props ? JSON.stringify(this.serializeValue(props), null, 2) : undefined,
      computed: computed ? JSON.stringify(this.serializeValue(computed), null, 2) : undefined,
    };

    this.states.set(section, snapshot);

    this.notifyListeners({
      type: 'state',
      data: snapshot,
    });
  }

  /**
   * Obtener variables de una sección
   */
  public getVariables(section?: string, limit: number = 50): VariableSnapshot[] {
    if (section) {
      return this.variables.get(section)?.slice(-limit) || [];
    }
    
    // Todas las secciones
    const allVars: VariableSnapshot[] = [];
    this.variables.forEach(vars => {
      allVars.push(...vars.slice(-limit));
    });
    return allVars.slice(-limit);
  }

  /**
   * Obtener contextos de ejecución
   */
  public getContexts(section?: string, limit: number = 50): ExecutionContext[] {
    if (section) {
      return this.contexts
        .filter(c => c.section === section)
        .slice(-limit);
    }
    return this.contexts.slice(-limit);
  }

  /**
   * Obtener estado actual de una sección
   */
  public getState(section: string): StateSnapshot | undefined {
    return this.states.get(section);
  }

  /**
   * Obtener todos los estados actuales
   */
  public getAllStates(): Record<string, StateSnapshot> {
    const result: Record<string, StateSnapshot> = {};
    this.states.forEach((state, section) => {
      result[section] = state;
    });
    return result;
  }

  /**
   * Obtener contextos activos (en ejecución)
   */
  public getActiveContexts(): ExecutionContext[] {
    return Array.from(this.activeContexts.values());
  }

  /**
   * Buscar variables por nombre
   */
  public searchVariables(query: string, section?: string): VariableSnapshot[] {
    const lowerQuery = query.toLowerCase();
    const allVars = this.getVariables(section, 100);
    
    return allVars.filter(v => 
      v.name.toLowerCase().includes(lowerQuery) ||
      (v.metadata?.description?.toLowerCase().includes(lowerQuery))
    );
  }

  /**
   * Obtener resumen del estado actual
   */
  public getSummary(): {
    totalVariables: number;
    totalContexts: number;
    activeContexts: number;
    sections: string[];
    recentActivity: Array<{
      section: string;
      action: string;
      timestamp: Date;
    }>;
  } {
    const sectionNames = new Set<string>();
    let totalVars = 0;
    
    this.variables.forEach((vars, section) => {
      sectionNames.add(section);
      totalVars += vars.length;
    });

    this.contexts.forEach(ctx => sectionNames.add(ctx.section));
    this.states.forEach((_, section) => sectionNames.add(section));

    const recentActivity = this.contexts
      .slice(-10)
      .map(ctx => ({
        section: ctx.section,
        action: ctx.action,
        timestamp: ctx.timestamp,
      }));

    return {
      totalVariables: totalVars,
      totalContexts: this.contexts.length,
      activeContexts: this.activeContexts.size,
      sections: Array.from(sectionNames).sort(),
      recentActivity,
    };
  }

  /**
   * Limpiar datos antiguos
   */
  public clear(section?: string): void {
    if (section) {
      this.variables.delete(section);
      this.states.delete(section);
      this.contexts = this.contexts.filter(c => c.section !== section);
    } else {
      this.variables.clear();
      this.states.clear();
      this.contexts = [];
      this.activeContexts.clear();
    }
  }

  /**
   * Serializar valores para almacenamiento seguro
   */
  private serializeValue(value: any, depth = 0): any {
    try {
      if (depth > 5) {
        return '[Depth Limit Exceeded]';
      }
      if (value === null || value === undefined) return value;
      if (typeof value === 'function') return '[Function]';
      if (value instanceof Date) return value.toISOString();
      if (Array.isArray(value)) {
        if (value.length > 50) {
          return `[Array(${value.length})]`;
        }
        return value.map(v => this.serializeValue(v, depth + 1));
      }
      if (typeof value === 'object') {
        const keys = Object.keys(value);
        if (keys.length > 50) {
          return `[Object with ${keys.length} keys]`;
        }
        const serialized: any = {};
        for (const key of keys) {
          serialized[key] = this.serializeValue(value[key], depth + 1);
        }
        return serialized;
      }
      return value;
    } catch {
      return '[Serialization Error]';
    }
  }

  private notifyListeners(event: Parameters<InspectorListener>[0]): void {
    this.listeners.forEach(listener => {
      try {
        listener(event);
      } catch (error) {
        console.error('Error in RuntimeInspector listener:', error);
      }
    });
  }
}

export const runtimeInspector = RuntimeInspector.getInstance();

/**
 * Hook de React para instrumentar componentes
 */
export function useRuntimeInspector(section: string) {
  return {
    captureVariable: (name: string, value: any, metadata?: VariableSnapshot['metadata']) => {
      runtimeInspector.captureVariable(section, 'component', name, value, metadata);
    },
    
    captureState: (state: Record<string, any>, props?: Record<string, any>, computed?: Record<string, any>) => {
      runtimeInspector.captureState(section, state, props, computed);
    },
    
    startContext: (action: string, inputs?: Record<string, any>) => {
      return runtimeInspector.startContext(section, action, inputs);
    },
    
    updateContext: (contextId: string, status: ExecutionContext['status'], data?: any) => {
      runtimeInspector.updateContext(contextId, status, data);
    },
  };
}
