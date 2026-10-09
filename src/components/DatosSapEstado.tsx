'use client';

import { useSyncExternalStore } from 'react';
import { format } from 'date-fns';
import { DatabaseZap } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { momentoDatosSap, refrescarDatosSap, suscribirDatosSap, versionDatosSap } from '@/lib/datos-sap-compartidos';

/**
 * Junto a "Sincronizar" de cada módulo táctico: muestra de qué hora son los datos SAP compartidos
 * (ver datos-sap-compartidos) y permite pedirlos de nuevo. "Actualizar datos SAP" descarta lo
 * guardado y corre la sincronización del módulo (onActualizar), que vuelve a ir a SAP.
 */
export function DatosSapEstado({ onActualizar, disabled }: { onActualizar: () => void; disabled?: boolean }) {
  useSyncExternalStore(suscribirDatosSap, versionDatosSap, versionDatosSap);
  const momento = momentoDatosSap();

  return (
    <div className="flex items-center gap-2">
      {momento && (
        <span className="text-[10px] font-bold text-slate-500 whitespace-nowrap" title="Los módulos comparten la misma descarga de SAP hasta que se actualice.">
          Datos SAP de las {format(momento, 'HH:mm')}
        </span>
      )}
      <Button
        type="button"
        variant="ghost"
        disabled={disabled}
        onClick={() => { refrescarDatosSap(); onActualizar(); }}
        className="h-10 px-3 rounded-xl text-[10px] font-black uppercase tracking-widest text-slate-600 hover:bg-slate-100 flex items-center gap-1.5"
        title="Vuelve a descargar los datos de SAP para todos los módulos y sincroniza este."
      >
        <DatabaseZap className="w-4 h-4" /> Actualizar datos SAP
      </Button>
    </div>
  );
}
