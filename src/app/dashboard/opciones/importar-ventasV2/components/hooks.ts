// Hooks personalizados para los componentes de importar-ventasV2

import { useEffect } from 'react';

// Hook: close dropdown when clicking outside
export function useClickOutside<T extends HTMLElement>(
  ref: React.RefObject<T>, 
  handler: () => void
) {
  useEffect(() => {
    function onClick(e: MouseEvent) {
      if (!ref.current) return;
      if (ref.current.contains(e.target as Node)) return;
      handler();
    }
    document.addEventListener('mousedown', onClick);
    return () => document.removeEventListener('mousedown', onClick);
  }, [ref, handler]);
}
