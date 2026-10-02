'use client';

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { AlertTriangle, CheckCircle2, Circle, Loader2, X, XCircle } from 'lucide-react';
import { cn } from '@/lib/utils';

/**
 * Panel flotante de progreso para los flujos largos de los módulos tácticos (Sincronizar y generar
 * necesidades, P2/P3/PFD, envío a SAP, reporte). Cada módulo declara su lista de pasos y va
 * marcando su estado; el panel no bloquea la pantalla (esquina inferior derecha).
 *
 * Al concluir sin avisos ni errores muestra "Concluido" y se cierra solo. Con algún aviso o error
 * queda abierto para que el usuario lo lea y lo cierre a mano.
 */

export type EstadoPaso = 'pendiente' | 'en_curso' | 'ok' | 'aviso' | 'error' | 'omitido';

export interface PasoProgreso {
  id: string;
  etiqueta: string;
  estado: EstadoPaso;
  detalle?: string;
  progreso?: { actual: number; total: number };
  inicio?: number;
  fin?: number;
}

export interface PanelProgresoControl {
  abierto: boolean;
  titulo: string;
  pasos: PasoProgreso[];
  resultado: { tipo: 'ok' | 'aviso' | 'error'; mensaje: string } | null;
  enCurso: boolean;
  iniciar: (titulo: string, pasos: { id: string; etiqueta: string }[]) => void;
  actualizar: (id: string, cambios: Partial<Omit<PasoProgreso, 'id' | 'etiqueta'>>) => void;
  // Cierra el flujo: el resultado (ok / aviso / error) se deduce del estado final de los pasos.
  concluir: (mensaje?: string) => void;
  cerrar: () => void;
}

const CIERRE_AUTOMATICO_MS = 4000;

export function usePanelProgreso(): PanelProgresoControl {
  const [abierto, setAbierto] = useState(false);
  const [titulo, setTitulo] = useState('');
  const [pasos, setPasos] = useState<PasoProgreso[]>([]);
  const [resultado, setResultado] = useState<PanelProgresoControl['resultado']>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const limpiarTimer = () => {
    if (timer.current) clearTimeout(timer.current);
    timer.current = null;
  };

  const iniciar = useCallback((t: string, lista: { id: string; etiqueta: string }[]) => {
    limpiarTimer();
    setTitulo(t);
    setPasos(lista.map(p => ({ ...p, estado: 'pendiente' })));
    setResultado(null);
    setPorConcluir(null);
    setAbierto(true);
  }, []);

  const actualizar = useCallback<PanelProgresoControl['actualizar']>((id, cambios) => {
    setPasos(prev => prev.map(p => {
      if (p.id !== id) return p;
      const sig = { ...p, ...cambios };
      if (cambios.estado === 'en_curso' && !p.inicio) sig.inicio = Date.now();
      if (cambios.estado && cambios.estado !== 'en_curso' && cambios.estado !== 'pendiente' && !p.fin) sig.fin = Date.now();
      return sig;
    }));
  }, []);

  const cerrar = useCallback(() => {
    limpiarTimer();
    setAbierto(false);
  }, []);

  // El resultado se deduce de los pasos (error > aviso > ok) en un efecto, DESPUÉS de que se
  // apliquen los últimos actualizar() del mismo tick; el mensaje lo pone el módulo.
  const [porConcluir, setPorConcluir] = useState<{ mensaje?: string } | null>(null);
  const concluir = useCallback((mensaje?: string) => setPorConcluir({ mensaje }), []);
  useEffect(() => {
    if (!porConcluir) return;
    const tipo: 'ok' | 'aviso' | 'error' = pasos.some(p => p.estado === 'error')
      ? 'error'
      : pasos.some(p => p.estado === 'aviso') ? 'aviso' : 'ok';
    setResultado({
      tipo,
      mensaje: porConcluir.mensaje || (tipo === 'ok' ? 'Concluido' : tipo === 'aviso' ? 'Concluido con avisos' : 'Terminó con errores'),
    });
    setPorConcluir(null);
    if (tipo === 'ok') {
      limpiarTimer();
      timer.current = setTimeout(() => setAbierto(false), CIERRE_AUTOMATICO_MS);
    }
  }, [porConcluir, pasos]);

  useEffect(() => () => limpiarTimer(), []);

  const enCurso = abierto && resultado === null;
  return useMemo(
    () => ({ abierto, titulo, pasos, resultado, enCurso, iniciar, actualizar, concluir, cerrar }),
    [abierto, titulo, pasos, resultado, enCurso, iniciar, actualizar, concluir, cerrar]
  );
}

const segundos = (p: PasoProgreso) => {
  if (!p.inicio) return null;
  const s = ((p.fin ?? Date.now()) - p.inicio) / 1000;
  return s < 60 ? `${s.toFixed(1)} s` : `${Math.floor(s / 60)} min ${Math.round(s % 60)} s`;
};

const IconoPaso: React.FC<{ estado: EstadoPaso }> = ({ estado }) => {
  switch (estado) {
    case 'en_curso': return <Loader2 className="w-4 h-4 text-blue-600 animate-spin shrink-0" />;
    case 'ok': return <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />;
    case 'aviso': return <AlertTriangle className="w-4 h-4 text-amber-500 shrink-0" />;
    case 'error': return <XCircle className="w-4 h-4 text-red-600 shrink-0" />;
    case 'omitido': return <Circle className="w-4 h-4 text-slate-200 shrink-0" />;
    default: return <Circle className="w-4 h-4 text-slate-300 shrink-0" />;
  }
};

export const PanelProgreso: React.FC<{ panel: PanelProgresoControl }> = ({ panel }) => {
  // Re-render cada segundo mientras corre, para que el tiempo del paso en curso avance.
  const [, setTick] = useState(0);
  useEffect(() => {
    if (!panel.enCurso) return;
    const id = setInterval(() => setTick(t => t + 1), 1000);
    return () => clearInterval(id);
  }, [panel.enCurso]);

  if (!panel.abierto) return null;
  const r = panel.resultado;

  return (
    <div className="fixed bottom-4 right-4 z-[60] w-[360px] max-w-[calc(100vw-2rem)] bg-white border border-gray-200 rounded-2xl shadow-2xl overflow-hidden animate-in slide-in-from-bottom-4 fade-in duration-200">
      <div className="flex items-center justify-between px-4 py-2.5 bg-slate-50 border-b border-gray-100">
        <p className="text-[10px] font-black uppercase tracking-widest text-slate-700 truncate">{panel.titulo}</p>
        <button
          type="button"
          onClick={panel.cerrar}
          title={panel.enCurso ? 'Ocultar — el proceso sigue corriendo' : 'Cerrar'}
          className="text-slate-400 hover:text-slate-700"
        >
          <X className="w-4 h-4" />
        </button>
      </div>
      <ul className="px-4 py-3 space-y-2.5">
        {panel.pasos.map(p => {
          const pct = p.progreso && p.progreso.total > 0 ? Math.min(100, (p.progreso.actual / p.progreso.total) * 100) : null;
          const t = segundos(p);
          return (
            <li key={p.id} className="space-y-1">
              <div className="flex items-center gap-2">
                <IconoPaso estado={p.estado} />
                <span className={cn(
                  'flex-1 text-[11px] font-bold',
                  p.estado === 'pendiente' || p.estado === 'omitido' ? 'text-slate-400' : 'text-slate-700',
                  p.estado === 'error' && 'text-red-700'
                )}>
                  {p.etiqueta}
                </span>
                {p.progreso && p.progreso.total > 0 && (
                  <span className="text-[10px] font-black text-slate-500 tabular-nums">{p.progreso.actual}/{p.progreso.total}</span>
                )}
                {t && <span className="text-[9px] text-slate-400 tabular-nums w-14 text-right">{t}</span>}
              </div>
              {pct !== null && p.estado === 'en_curso' && (
                <div className="ml-6 h-1.5 bg-slate-100 rounded-full overflow-hidden">
                  <div className="h-full bg-blue-500 transition-all duration-300" style={{ width: `${pct}%` }} />
                </div>
              )}
              {p.detalle && (
                <p className={cn(
                  'ml-6 text-[10px] leading-snug',
                  p.estado === 'error' ? 'text-red-600' : p.estado === 'aviso' ? 'text-amber-700' : 'text-slate-500'
                )}>
                  {p.detalle}
                </p>
              )}
            </li>
          );
        })}
      </ul>
      {r && (
        <div className={cn(
          'flex items-center gap-2 px-4 py-2.5 border-t text-[11px] font-black',
          r.tipo === 'ok' && 'bg-emerald-50 border-emerald-100 text-emerald-700',
          r.tipo === 'aviso' && 'bg-amber-50 border-amber-100 text-amber-700',
          r.tipo === 'error' && 'bg-red-50 border-red-100 text-red-700'
        )}>
          <IconoPaso estado={r.tipo} />
          <span className="flex-1">{r.mensaje}</span>
        </div>
      )}
    </div>
  );
};
