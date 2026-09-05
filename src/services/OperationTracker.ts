/**
 * OperationTracker: Servicio para rastrear operaciones detalladas en los formularios
 * Proporciona visibilidad en tiempo real de qué está sucediendo en cada sección
 */

export type OperationType = 
  | 'data_load' 
  | 'data_filter' 
  | 'data_import' 
  | 'data_export'
  | 'plan_generation' 
  | 'plan_view' 
  | 'config_update' 
  | 'validation' 
  | 'api_call' 
  | 'calculation' 
  | 'error';

export type OperationStatus = 'started' | 'in_progress' | 'completed' | 'failed' | 'pending';

export interface Operation {
  id: string;
  timestamp: Date;
  section: string; // e.g., 'DataImport', 'ProductionPlan', 'Constraints'
  type: OperationType;
  status: OperationStatus;
  description: string;
  details?: Record<string, any>;
  duration?: number; // en milisegundos
  error?: string;
}

type OperationListener = (operation: Operation) => void;

class OperationTracker {
  private static instance: OperationTracker;
  private listeners: OperationListener[] = [];
  private operations: Operation[] = [];
  private activeOperations: Map<string, Operation> = new Map();

  private constructor() {}

  public static getInstance(): OperationTracker {
    if (!OperationTracker.instance) {
      OperationTracker.instance = new OperationTracker();
    }
    return OperationTracker.instance;
  }

  /**
   * Suscribirse a cambios de operaciones
   */
  public subscribe(listener: OperationListener): () => void {
    this.listeners.push(listener);
    return () => {
      this.listeners = this.listeners.filter(l => l !== listener);
    };
  }

  /**
   * Rastrear el inicio de una operación
   */
  public startOperation(
    section: string,
    type: OperationType,
    description: string,
    details?: Record<string, any>
  ): string {
    const operationId = `op-${Date.now()}-${Math.random().toString(36).substring(7)}`;
    
    const operation: Operation = {
      id: operationId,
      timestamp: new Date(),
      section,
      type,
      status: 'started',
      description,
      details,
    };

    this.activeOperations.set(operationId, operation);
    this.operations.push(operation);
    this.notifyListeners(operation);

    return operationId;
  }

  /**
   * Actualizar el progreso de una operación
   */
  public updateOperation(
    operationId: string,
    status: OperationStatus,
    description?: string,
    details?: Record<string, any>
  ): void {
    const operation = this.activeOperations.get(operationId);
    if (!operation) return;

    const updated: Operation = {
      ...operation,
      status,
      description: description || operation.description,
      details: details ? { ...operation.details, ...details } : operation.details,
      timestamp: new Date(),
    };

    this.activeOperations.set(operationId, updated);
    const index = this.operations.findIndex(o => o.id === operationId);
    if (index !== -1) {
      this.operations[index] = updated;
    }

    this.notifyListeners(updated);
  }

  /**
   * Completar una operación
   */
  public completeOperation(
    operationId: string,
    description?: string,
    details?: Record<string, any>
  ): void {
    const operation = this.activeOperations.get(operationId);
    if (!operation) return;

    const startTime = operation.timestamp.getTime();
    const duration = Date.now() - startTime;

    const completed: Operation = {
      ...operation,
      status: 'completed',
      description: description || operation.description,
      details: details ? { ...operation.details, ...details } : operation.details,
      duration,
      timestamp: new Date(),
    };

    this.activeOperations.delete(operationId);
    const index = this.operations.findIndex(o => o.id === operationId);
    if (index !== -1) {
      this.operations[index] = completed;
    }

    this.notifyListeners(completed);
  }

  /**
   * Marcar una operación como fallida
   */
  public failOperation(operationId: string, error: string, details?: Record<string, any>): void {
    const operation = this.activeOperations.get(operationId);
    if (!operation) return;

    const startTime = operation.timestamp.getTime();
    const duration = Date.now() - startTime;

    const failed: Operation = {
      ...operation,
      status: 'failed',
      error,
      details: details ? { ...operation.details, ...details } : operation.details,
      duration,
      timestamp: new Date(),
    };

    this.activeOperations.delete(operationId);
    const index = this.operations.findIndex(o => o.id === operationId);
    if (index !== -1) {
      this.operations[index] = failed;
    }

    this.notifyListeners(failed);
  }

  /**
   * Obtener las últimas N operaciones
   */
  public getLatestOperations(limit: number = 50): Operation[] {
    return this.operations.slice(-limit);
  }

  /**
   * Obtener operaciones por sección
   */
  public getOperationsBySection(section: string, limit: number = 20): Operation[] {
    return this.operations
      .filter(op => op.section === section)
      .slice(-limit);
  }

  /**
   * Obtener operaciones activas
   */
  public getActiveOperations(): Operation[] {
    return Array.from(this.activeOperations.values());
  }

  /**
   * Limpiar historial de operaciones
   */
  public clearOperations(): void {
    this.operations = [];
    this.activeOperations.clear();
  }

  /**
   * Obtener resumen del estado actual
   */
  public getSummary(): {
    total: number;
    active: number;
    completed: number;
    failed: number;
    bySection: Record<string, number>;
  } {
    const summary = {
      total: this.operations.length,
      active: this.activeOperations.size,
      completed: this.operations.filter(o => o.status === 'completed').length,
      failed: this.operations.filter(o => o.status === 'failed').length,
      bySection: {} as Record<string, number>,
    };

    this.operations.forEach(op => {
      summary.bySection[op.section] = (summary.bySection[op.section] || 0) + 1;
    });

    return summary;
  }

  private notifyListeners(operation: Operation): void {
    this.listeners.forEach(listener => {
      try {
        listener(operation);
      } catch (error) {
        console.error('Error in operation listener:', error);
      }
    });
  }
}

export const operationTracker = OperationTracker.getInstance();
