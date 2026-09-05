"use client";

import React, { createContext, useContext, useState, useCallback, useMemo } from 'react';

interface WidgetsStateContextType {
  chatIsOpen: boolean;
  logsIsOpen: boolean;
  debugIsOpen: boolean;
  openChat: () => void;
  closeChat: () => void;
  openLogs: () => void;
  closeLogs: () => void;
  openDebug: () => void;
  closeDebug: () => void;
}

const WidgetsStateContext = createContext<WidgetsStateContextType | undefined>(undefined);

export function WidgetsStateProvider({ children }: { children: React.ReactNode }) {
  const [chatIsOpen, setChatIsOpen] = useState(false);
  const [logsIsOpen, setLogsIsOpen] = useState(false);
  const [debugIsOpen, setDebugIsOpen] = useState(false);

  const openChat = useCallback(() => {
    setChatIsOpen(true);
    setLogsIsOpen(false);
    setDebugIsOpen(false);
  }, []);

  const closeChat = useCallback(() => {
    setChatIsOpen(false);
  }, []);

  const openLogs = useCallback(() => {
    setLogsIsOpen(true);
    setChatIsOpen(false);
    setDebugIsOpen(false);
  }, []);

  const closeLogs = useCallback(() => {
    setLogsIsOpen(false);
  }, []);

  const openDebug = useCallback(() => {
    setDebugIsOpen(true);
    setChatIsOpen(false);
    setLogsIsOpen(false);
  }, []);

  const closeDebug = useCallback(() => {
    setDebugIsOpen(false);
  }, []);

  const value = useMemo(
    () => ({
      chatIsOpen,
      logsIsOpen,
      debugIsOpen,
      openChat,
      closeChat,
      openLogs,
      closeLogs,
      openDebug,
      closeDebug,
    }),
    [
      chatIsOpen,
      logsIsOpen,
      debugIsOpen,
      openChat,
      closeChat,
      openLogs,
      closeLogs,
      openDebug,
      closeDebug,
    ]
  );

  return (
    <WidgetsStateContext.Provider value={value}>
      {children}
    </WidgetsStateContext.Provider>
  );
}

export function useWidgetsState() {
  const context = useContext(WidgetsStateContext);
  if (!context) {
    throw new Error('useWidgetsState must be used within WidgetsStateProvider');
  }
  return context;
}
