
'use client';

import React from 'react';
import type { Grupo, Restriccion } from '@/types/interfaces';

interface ProgDiariaTabSectionProps {
  readonly groups: Grupo[];
  readonly restrictions: Restriccion[];
}

/**
 * Componente para la pestaña "Prog diaria".
 * Actualmente se encuentra vacío por requerimiento del usuario.
 */
export const ProgDiariaTabSection: React.FC<ProgDiariaTabSectionProps> = () => {
  return null;
};
