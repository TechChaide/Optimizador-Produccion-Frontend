'use client';

import React from 'react';
import { AppProvider } from './AppProvider';

export const ClientProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  return <AppProvider>{children}</AppProvider>;
};
