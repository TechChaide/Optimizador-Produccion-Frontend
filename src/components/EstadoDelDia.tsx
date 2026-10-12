'use client';

import { useCallback, useEffect, useState } from 'react';
import { format } from 'date-fns';
import { CheckCircle2, Circle, FileText, Loader2, MailCheck, RefreshCw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { sapCompartido } from '@/lib/datos-sap-compartidos';
import { hitosDePlanes, hitosDeReportes, type HitoDia } from '@/lib/estado-dia';

/**
 * Barra "Estado del día" (usuario 2026-10-12, ver [[flujo-dos-etapas]]): la cadena completa de las dos
 * etapas — Etapa 1: P2 VE → P3 Laminado → P3 Corte Espuma; Etapa 2: PFD-VENTA y reportes de cada
 * módulo —, consultada en vivo al abrir el módulo. Reemplaza la carga automática del último reporte:
 * ese reporte se abre solo con "Ver último reporte". `recarga` cambia tras cada acción del módulo
 * (generar, enviar) para volver a consultar.
 */
export function EstadoDelDia({ moduloActual, recarga, onVerUltimoReporte }: {
  moduloActual: HitoDia['modulo'];
  recarga?: number;
  onVerUltimoReporte?: () => void;
}) {
  const [hitos, setHitos] = useState<HitoDia[] | null>(null);
  const [cargando, setCargando] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const consultar = useCallback(async () => {
    setCargando(true);
    setError(null);
    const hoy = format(new Date(), 'yyyy-MM-dd');
    try {
      const [planes, reportes] = await Promise.all([
        sapCompartido.planGrupos().then(r => r.data || []),
        hitosDeReportes(hoy),
      ]);
      setHitos([...hitosDePlanes(planes, hoy), ...reportes]);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setCargando(false);
    }
  }, []);

  useEffect(() => { void consultar(); }, [consultar, recarga]);

  const fila = (etapa: 1 | 2, titulo: string) => (
    <div className="flex items-start gap-2 flex-wrap">
      <span className="text-[10px] font-black uppercase tracking-widest text-slate-500 w-36 shrink-0 pt-1">{titulo}</span>
      <div className="flex flex-wrap gap-1.5 flex-1">
        {(hitos ?? []).filter(h => h.etapa === etapa).map(h => (
          <span
            key={h.id}
            title={h.detalle || 'Pendiente hoy'}
            className={cn(
              'inline-flex items-center gap-1 rounded-lg border px-2 py-1 text-[10px] font-bold whitespace-nowrap',
              h.estado === 'pendiente' ? 'border-dashed border-slate-300 text-slate-500 bg-white' : 'border-emerald-200 bg-emerald-50 text-emerald-800',
              h.modulo === moduloActual && 'ring-1 ring-blue-300',
            )}
          >
            {h.estado === 'enviado' ? <MailCheck className="w-3 h-3" /> : h.estado === 'hecho' ? <CheckCircle2 className="w-3 h-3" /> : <Circle className="w-3 h-3" />}
            <span className="uppercase">{h.modulo}</span> · {h.etiqueta}
            {h.detalle && <span className="font-mono font-normal text-[10px] text-slate-600">{h.detalle}</span>}
          </span>
        ))}
      </div>
    </div>
  );

  return (
    <div className="rounded-xl border border-slate-200 bg-slate-50/60 px-4 py-3 space-y-2">
      <div className="flex items-center justify-between gap-2 flex-wrap">
        <p className="text-[11px] font-black uppercase tracking-widest text-slate-700">
          Estado del día · {format(new Date(), 'dd/MM')}
        </p>
        <div className="flex items-center gap-1">
          {onVerUltimoReporte && (
            <Button type="button" variant="ghost" size="sm" onClick={onVerUltimoReporte} className="h-7 px-2 gap-1 text-[10px] font-bold uppercase text-slate-600">
              <FileText className="w-3.5 h-3.5" /> Ver último reporte
            </Button>
          )}
          <Button type="button" variant="ghost" size="sm" onClick={() => void consultar()} disabled={cargando} className="h-7 px-2 gap-1 text-[10px] font-bold uppercase text-slate-600" title="Volver a consultar el estado">
            {cargando ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <RefreshCw className="w-3.5 h-3.5" />}
          </Button>
        </div>
      </div>
      {error && <p className="text-[10px] font-bold text-amber-700">No se pudo consultar el estado: {error}</p>}
      {hitos === null && !error ? (
        <p className="text-[10px] text-slate-500 flex items-center gap-1"><Loader2 className="w-3 h-3 animate-spin" /> Consultando planes y reportes de hoy…</p>
      ) : (
        <>
          {fila(1, 'Etapa 1 · Planificar')}
          {fila(2, 'Etapa 2 · Cerrar')}
        </>
      )}
    </div>
  );
}
