'use client';

import React, { createContext, useContext, useEffect, useState, useCallback, useMemo } from 'react';
import { operationTracker, Operation } from '@/services/OperationTracker';
import { logger } from '@/services/LogService';

interface OperationContextType {
  operations: Operation[];
  activeOperations: Operation[];
  summary: {
    total: number;
    active: number;
    completed: number;
    failed: number;
    bySection: Record<string, number>;
  };
  clearOperations: () => void;
}

const OperationContext = createContext<OperationContextType | undefined>(undefined);

export function OperationProvider({ children }: { children: React.ReactNode }) {
  const [trigger, setTrigger] = useState(0);

  useEffect(() => {
    const unsubscribe = operationTracker.subscribe((operation) => {
      // Solo disparar re-render sin mantener estado duplicado
      setTrigger(prev => prev + 1);
      
      // Registrar en logs
      const statusEmoji = {
        'started': '▶️',
        'in_progress': '⏳',
        'completed': '✅',
        'failed': '❌',
        'pending': '⏸️'
      }[operation.status] || '•';
      
      const logMessage = `[${operation.section}] ${statusEmoji} ${operation.description}${operation.duration ? ` (${operation.duration}ms)` : ''}${operation.error ? ` - ERROR: ${operation.error}` : ''}`;
      logger.log(logMessage, operation.status === 'failed' ? 'error' : 'operation');
    });

    return () => {
      unsubscribe();
    };
  }, []);

  // Datos derivados memoizados por `trigger`: evita nuevas referencias en cada re-render del árbol (p. ej. al navegar).
  const operations = useMemo(
    () => operationTracker.getLatestOperations(50),
    [trigger]
  );
  const activeOperations = useMemo(
    () => operationTracker.getActiveOperations(),
    [trigger]
  );
  const summary = useMemo(
    () => operationTracker.getSummary(),
    [trigger]
  );

  const clearOperations = useCallback(() => {
    operationTracker.clearOperations();
    setTrigger(prev => prev + 1);
  }, []);

  const value = useMemo(
    () => ({ operations, activeOperations, summary, clearOperations }),
    [operations, activeOperations, summary, clearOperations]
  );

  return (
    <OperationContext.Provider value={value}>
      {children}
    </OperationContext.Provider>
  );
}

export function useOperations() {
  const context = useContext(OperationContext);
  if (context === undefined) {
    throw new Error('useOperations must be used within an OperationProvider');
  }
  return context;
}
