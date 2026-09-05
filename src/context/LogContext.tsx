'use client';

import React, { createContext, useContext, useEffect, useState, useCallback, useMemo } from 'react';
import { logger, LogEntry } from '@/services/LogService';

interface LogContextType {
  logs: LogEntry[];
  clearLogs: () => void;
}

const LogContext = createContext<LogContextType | undefined>(undefined);

export function LogProvider({ children }: { children: React.ReactNode }) {
  const [logs, setLogs] = useState<LogEntry[]>([]);

  useEffect(() => {
    const unsubscribe = logger.subscribe((newLog) => {
      setLogs((prevLogs) => prevLogs.length >= 500 ? [...prevLogs.slice(-499), newLog] : [...prevLogs, newLog]);
    });

    return () => {
      unsubscribe();
    };
  }, []);

  const clearLogs = useCallback(() => {
    setLogs([]);
  }, []);

  const value = useMemo(
    () => ({ logs, clearLogs }),
    [logs, clearLogs]
  );

  return (
    <LogContext.Provider value={value}>
      {children}
    </LogContext.Provider>
  );
}

export function useLogs() {
  const context = useContext(LogContext);
  if (context === undefined) {
    throw new Error('useLogs must be used within a LogProvider');
  }
  return context;
}
