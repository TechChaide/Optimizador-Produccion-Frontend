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
 * Sin datos descargados no se muestra (usuario 2026-10-08): ahí "Sincronizar" ya va a SAP y los dos
 * botones harían lo mismo.
 */
export function DatosSapEstado({ onActualizar, disabled }: { onActualizar: () => void; disabled?: boolean }) {
  useSyncExternalStore(suscribirDatosSap, versionDatosSap, versionDatosSap);
  const momento = momentoDatosSap();
  if (!momento) return null;

  return (
    <div className="flex items-center gap-1 rounded-xl border border-slate-200 bg-white pl-3 pr-1 h-10">
      <span
        className="text-[11px] font-bold text-slate-700 whitespace-nowrap tabular-nums"
        title="Los módulos comparten la misma descarga de SAP hasta que se actualice."
      >
        Datos SAP de las {format(momento, 'HH:mm')}
      </span>
      <Button
        type="button"
        variant="ghost"
        disabled={disabled}
        onClick={() => { refrescarDatosSap(); onActualizar(); }}
        className="h-8 px-2.5 rounded-lg text-[10px] font-black uppercase tracking-widest text-blue-700 hover:bg-blue-50 flex items-center gap-1.5"
        title="Vuelve a descargar los datos de SAP para todos los módulos y sincroniza este. Úsalo cuando SAP cambió después de esa hora (p. ej. órdenes recién creadas)."
      >
        <DatabaseZap className="w-4 h-4" /> Actualizar
      </Button>
    </div>
  );
}
