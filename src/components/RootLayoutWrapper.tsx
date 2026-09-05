
'use client';

import React, { memo } from 'react';
import { LogProvider } from '@/context/LogContext';
import { OperationProvider } from '@/context/OperationContext';
import { AppProvider } from '@/context/AppProvider';
import { WidgetsStateProvider } from '@/context/WidgetsStateContext';

interface RootLayoutWrapperProps {
  children: React.ReactNode;
}

function RootLayoutWrapper({ children }: RootLayoutWrapperProps) {
  return (
    <LogProvider>
      <OperationProvider>
        <AppProvider>
          <WidgetsStateProvider>
            {children}
          </WidgetsStateProvider>
        </AppProvider>
      </OperationProvider>
    </LogProvider>
  );
}

export default memo(RootLayoutWrapper);
