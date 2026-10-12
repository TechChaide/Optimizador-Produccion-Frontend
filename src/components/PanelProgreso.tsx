'use client';

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { AlertTriangle, CheckCircle2, Circle, Loader2, X, XCircle } from 'lucide-react';
import { format, isValid, parseISO } from 'date-fns';
import { es } from 'date-fns/locale';
import { cn } from '@/lib/utils';

/**
 * Panel flotante de progreso para los flujos largos de los módulos tácticos (Sincronizar y generar
 * necesidades, P2/P3/PFD, envío a SAP, reporte). Cada módulo declara su lista de pasos y va
 * marcando su estado; el panel no bloquea la pantalla (esquina inferior derecha).
 *
 * Opcionalmente arranca con pedirFecha(): pregunta la fecha a evaluar antes de sincronizar.
 *
 * Al concluir sin avisos ni errores muestra "Concluido" y se cierra solo. Con algún aviso o error
 * queda abierto para que el usuario lo lea y lo cierre a mano. Si concluir() recibe acciones (ej.
 * "Ver reporte y enviar"), se muestran como botones al pie y el panel tampoco se cierra solo.
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

// Paso previo opcional: antes de sincronizar, el panel pregunta qué fecha se va a evaluar y muestra
// qué fechas derivadas usará el módulo (ej. P2 = siguiente día hábil), para que nadie sincronice
// sin saber sobre qué día. Al confirmar se llama onConfirmar y el módulo arranca con iniciar().
export interface PreparacionFecha {
  titulo: string;
  fechaInicial: string; // yyyy-MM-dd
  // Si viene, pide un rango (desde = fecha, hasta) en vez de un solo día — ej. la "Ventana de
  // Producción" de Venta Externa. hasta siempre llega ≥ fecha.
  hastaInicial?: string;
  // Líneas "qué se va a evaluar" para la fecha elegida (null = sin fecha, si sinFecha está habilitado).
  detalle: (fecha: string | null, hasta?: string) => { etiqueta: string; valor: string }[];
  // Aviso opcional (ej. la fecha cae en día no laborable); no bloquea.
  aviso?: (fecha: string | null, hasta?: string) => string | null;
  // Si viene, ofrece la casilla "sin fecha" (ej. Plan Maestro = todas las fechas).
  sinFecha?: string;
  // true: la fecha sale de una regla del módulo (ej. Corte Espuma, hoy) — se muestra para confirmar,
  // sin poder cambiarla.
  fija?: boolean;
  onConfirmar: (fecha: string | null, hasta?: string) => void;
}

/** Botón al pie del panel cuando el flujo termina (siguiente paso sugerido). */
export interface AccionPanel {
  etiqueta: string;
  onClick: () => void;
}

export interface PanelProgresoControl {
  abierto: boolean;
  titulo: string;
  pasos: PasoProgreso[];
  resultado: { tipo: 'ok' | 'aviso' | 'error'; mensaje: string; acciones?: AccionPanel[] } | null;
  enCurso: boolean;
  preparacion: PreparacionFecha | null;
  pedirFecha: (p: PreparacionFecha) => void;
  iniciar: (titulo: string, pasos: { id: string; etiqueta: string }[]) => void;
  actualizar: (id: string, cambios: Partial<Omit<PasoProgreso, 'id' | 'etiqueta'>>) => void;
  // Cierra el flujo: el resultado (ok / aviso / error) se deduce del estado final de los pasos.
  concluir: (mensaje?: string, acciones?: AccionPanel[]) => void;
  cerrar: () => void;
}

const CIERRE_AUTOMATICO_MS = 4000;

export function usePanelProgreso(): PanelProgresoControl {
  const [abierto, setAbierto] = useState(false);
  const [titulo, setTitulo] = useState('');
  const [pasos, setPasos] = useState<PasoProgreso[]>([]);
  const [resultado, setResultado] = useState<PanelProgresoControl['resultado']>(null);
  const [preparacion, setPreparacion] = useState<PreparacionFecha | null>(null);
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
    setPreparacion(null);
    setAbierto(true);
  }, []);

  const pedirFecha = useCallback((p: PreparacionFecha) => {
    limpiarTimer();
    setTitulo(p.titulo);
    setPasos([]);
    setResultado(null);
    setPreparacion(p);
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
    setPreparacion(null);
    setAbierto(false);
  }, []);

  // El resultado se deduce de los pasos (error > aviso > ok) en un efecto, DESPUÉS de que se
  // apliquen los últimos actualizar() del mismo tick; el mensaje lo pone el módulo.
  const [porConcluir, setPorConcluir] = useState<{ mensaje?: string; acciones?: AccionPanel[] } | null>(null);
  const concluir = useCallback((mensaje?: string, acciones?: AccionPanel[]) => setPorConcluir({ mensaje, acciones }), []);
  useEffect(() => {
    if (!porConcluir) return;
    const tipo: 'ok' | 'aviso' | 'error' = pasos.some(p => p.estado === 'error')
      ? 'error'
      : pasos.some(p => p.estado === 'aviso') ? 'aviso' : 'ok';
    setResultado({
      tipo,
      mensaje: porConcluir.mensaje || (tipo === 'ok' ? 'Concluido' : tipo === 'aviso' ? 'Concluido con avisos' : 'Terminó con errores'),
      acciones: porConcluir.acciones,
    });
    setPorConcluir(null);
    if (tipo === 'ok' && !porConcluir.acciones?.length) {
      limpiarTimer();
      timer.current = setTimeout(() => setAbierto(false), CIERRE_AUTOMATICO_MS);
    }
  }, [porConcluir, pasos]);

  useEffect(() => () => limpiarTimer(), []);

  const enCurso = abierto && resultado === null && preparacion === null;
  return useMemo(
    () => ({ abierto, titulo, pasos, resultado, enCurso, preparacion, pedirFecha, iniciar, actualizar, concluir, cerrar }),
    [abierto, titulo, pasos, resultado, enCurso, preparacion, pedirFecha, iniciar, actualizar, concluir, cerrar]
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

const fechaLarga = (f: string) => {
  const d = parseISO(f);
  return isValid(d) ? format(d, "EEEE dd/MM/yyyy", { locale: es }) : f;
};

const VistaPreparacion: React.FC<{ prep: PreparacionFecha }> = ({ prep }) => {
  const [fecha, setFecha] = useState(prep.fechaInicial);
  const [hasta, setHasta] = useState(prep.hastaInicial ?? prep.fechaInicial);
  const [sinFecha, setSinFecha] = useState(false);
  const esRango = prep.hastaInicial !== undefined;
  const elegida = sinFecha ? null : fecha;
  const hastaElegida = esRango && !sinFecha ? hasta : undefined;
  const valida = sinFecha || (isValid(parseISO(fecha)) && (!esRango || (isValid(parseISO(hasta)) && hasta >= fecha)));
  const lineas = valida ? prep.detalle(elegida, hastaElegida) : [];
  const aviso = valida ? prep.aviso?.(elegida, hastaElegida) : esRango ? 'Escoge un rango válido ("hasta" no puede ser antes de "desde").' : 'Escoge una fecha válida.';

  return (
    <div className="px-4 py-3 space-y-3">
      <div className="space-y-1.5">
        <p className="text-[11px] font-black text-slate-700">
          {prep.fija ? 'Fecha a evaluar' : esRango ? '¿Qué fechas vas a evaluar?' : '¿Qué fecha vas a evaluar?'}
        </p>
        {prep.fija ? (
          <p className="text-[12px] font-black text-blue-700 capitalize">{fechaLarga(fecha)}</p>
        ) : esRango ? (
          <div className="grid grid-cols-2 gap-2">
            {([['Desde', fecha, setFecha], ['Hasta', hasta, setHasta]] as const).map(([etq, val, set]) => (
              <label key={etq} className="space-y-0.5">
                <span className="text-[9px] font-black uppercase tracking-widest text-slate-400">{etq}</span>
                <input
                  type="date"
                  value={val}
                  disabled={sinFecha}
                  onChange={e => set(e.target.value)}
                  className="w-full h-9 px-2 rounded-xl border border-gray-200 text-[11px] font-bold text-slate-700 disabled:opacity-40"
                />
              </label>
            ))}
          </div>
        ) : (
          <>
            <input
              type="date"
              value={fecha}
              disabled={sinFecha}
              onChange={e => setFecha(e.target.value)}
              className="w-full h-9 px-3 rounded-xl border border-gray-200 text-[12px] font-bold text-slate-700 disabled:opacity-40"
            />
            {!sinFecha && valida && <p className="text-[10px] font-bold text-slate-500 capitalize">{fechaLarga(fecha)}</p>}
          </>
        )}
        {prep.sinFecha && (
          <label className="flex items-center gap-2 text-[10px] font-bold text-slate-500 cursor-pointer">
            <input type="checkbox" checked={sinFecha} onChange={e => setSinFecha(e.target.checked)} />
            {prep.sinFecha}
          </label>
        )}
      </div>
      {lineas.length > 0 && (
        <ul className="rounded-xl bg-slate-50 border border-slate-100 px-3 py-2 space-y-1">
          {lineas.map(l => (
            <li key={l.etiqueta} className="flex justify-between gap-3 text-[10px]">
              <span className="text-slate-500 font-bold">{l.etiqueta}</span>
              <span className="text-slate-700 font-black text-right">{l.valor}</span>
            </li>
          ))}
        </ul>
      )}
      {aviso && <p className="text-[10px] leading-snug text-amber-700 font-bold">{aviso}</p>}
      <button
        type="button"
        disabled={!valida}
        onClick={() => prep.onConfirmar(elegida, hastaElegida)}
        className="w-full h-9 rounded-xl bg-blue-600 hover:bg-blue-700 disabled:opacity-40 text-white text-[10px] font-black uppercase tracking-widest"
      >
        {esRango ? 'Sincronizar con estas fechas' : 'Sincronizar con esta fecha'}
      </button>
    </div>
  );
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
      {panel.preparacion && <VistaPreparacion key={panel.preparacion.fechaInicial + panel.titulo} prep={panel.preparacion} />}
      {!panel.preparacion && <ul className="px-4 py-3 space-y-2.5">
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
      </ul>}
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
      {r?.acciones && r.acciones.length > 0 && (
        <div className="flex flex-wrap gap-2 px-4 py-2.5 border-t border-gray-100 bg-white">
          {r.acciones.map(a => (
            <button
              key={a.etiqueta}
              type="button"
              onClick={() => { panel.cerrar(); a.onClick(); }}
              className="flex-1 min-w-[140px] h-8 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-[10px] font-black uppercase tracking-widest"
            >
              {a.etiqueta}
            </button>
          ))}
        </div>
      )}
    </div>
  );
};
