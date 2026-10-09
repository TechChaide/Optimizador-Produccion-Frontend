'use client';

/**
 * Flujo de 3 pasos para el "Reporte de producción" de los módulos tácticos:
 *
 *   1. Guardar reporte   -> foto del plan EN ESE MOMENTO: TXT + HTML del correo en la carpeta
 *                           compartida (ver src/lib/planes-txt.ts / api/planes-txt).
 *   2. Recuperar reporte -> lee lo guardado (no recalcula) y lo muestra en vista previa.
 *   3. Enviar            -> manda por correo exactamente lo recuperado y, si sale bien, borra la
 *                           foto HTML (el correo ya está en la bandeja); en la carpeta queda solo el TXT.
 *
 * Por qué separado: entre que se arma el plan y se envía el correo, se exporta a SAP y SAP tarda en
 * crear las órdenes FERT. Si el correo se arma al enviar, la necesidad ya se recalculó con esas FERT
 * nuevas y el reporte deja de coincidir con el plan que realmente se programó. Guardar primero
 * congela el plan; el envío posterior ya no depende del estado de SAP.
 *
 * El estado "guardado" se lee de la carpeta compartida (no de la sesión): si otro usuario o una
 * pestaña anterior ya guardó el reporte de esa fecha objetivo, el botón aparece directo en
 * "Recuperar reporte".
 *
 * Uso: `const flujo = useReportePlanTxt({...})` en el módulo; <ReportePlanTxtAcciones flujo /> va
 * dentro del Popover de "Enviar Reporte" y <ReportePlanTxtVistaPrevia flujo /> FUERA del Popover
 * (si quedara dentro, al cerrarse el Popover desmontaría el diálogo).
 */
import React, { useCallback, useEffect, useRef, useState } from 'react';
import { format } from 'date-fns';
import { CheckCircle2, FileSearch, Loader2, Mail, RotateCcw, Save, Upload } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useAppContext } from '@/context/AppProvider';
import { serviciosService } from '@/services/servicios.service';
import { cn } from '@/lib/utils';
import {
  buscarPlanVigente, consultarPlanTxt, eliminarFotoCorreoPlanTxt, guardarPlanTxt, obtenerPlanTxt,
  type CentroPlanTxt, type ModuloPlanTxt, type PlanTxtRecuperado,
} from '@/lib/planes-txt';

export type EstadoReportePlanTxt = 'sin-fecha' | 'verificando' | 'sin-guardar' | 'guardado' | 'error-carpeta';

/** De qué reporte guardado viene el plan que se carga en el módulo (para avisarlo en pantalla). */
export interface OrigenEstadoPlan { fechaObjetivo: string; guardadoEn: string }

export interface ConfigReportePlanTxt {
  modulo: ModuloPlanTxt;
  centro: CentroPlanTxt;
  /** yyyy-MM-dd; null = el módulo todavía no tiene fecha objetivo (no se puede guardar). */
  fechaObjetivo: string | null;
  asunto: string;
  /** Arma el HTML del correo con los datos ACTUALES del módulo (solo se llama al guardar). */
  construirHtml: () => string | Promise<string>;
  /** Opcional: al revisar el reporte, completa en la foto guardada datos que recién existen después
   *  de guardar (ej. Laminado: número de orden SAP). Si cambia algo, la foto se vuelve a guardar para
   *  que el archivo quede igual a lo que se envía. Si falla, se revisa la foto tal cual. */
  completarHtml?: (html: string, fechaObjetivo: string) => Promise<string>;
  /** Texto corto para notificaciones/diálogo cuando hay varios flujos en el mismo módulo (ej. "Centro 1000"). */
  etiqueta?: string;
  /** Respaldo de lo planificado (turnos, corridas, ajustes) que se guarda junto al TXT como {fecha}.estado.json. */
  capturarEstado?: () => unknown;
  /** Vuelve a cargar ese respaldo en la pantalla del módulo; devuelve false si no lo reconoce. */
  restaurarEstado?: (estado: unknown, origen: OrigenEstadoPlan) => boolean;
}

export interface FlujoReportePlanTxt {
  config: ConfigReportePlanTxt;
  estado: EstadoReportePlanTxt;
  guardadoEn: string | null;
  ruta: string | null;
  enviadoEn: string | null;
  guardando: boolean;
  recuperando: boolean;
  enviando: boolean;
  vista: PlanTxtRecuperado | null;
  vistaAbierta: boolean;
  setVistaAbierta: (v: boolean) => void;
  /** true si quedó guardado (false si se canceló o falló). sinConfirmar: el grupo ya preguntó una sola vez.
   *  silencioso: sin aviso de éxito (lo muestra el panel de progreso del módulo). */
  guardar: (opts?: { sinConfirmar?: boolean; silencioso?: boolean }) => Promise<boolean>;
  /** true si se recuperó. abrir=false: no abre el diálogo individual (lo usa el diálogo de grupo). */
  recuperar: (opts?: { abrir?: boolean; fecha?: string }) => Promise<boolean>;
  /** Fecha objetivo del reporte abierto en la vista previa. */
  fechaVista: string | null;
  /** true si se envió. */
  enviar: (destino: string) => Promise<boolean>;
  /** Hay respaldo recuperado y el módulo sabe cargarlo. */
  puedeCargar: boolean;
  /** Carga en el módulo lo planificado que se recuperó (cierra la vista previa). */
  cargarEnModulo: () => boolean;
}

const NOTA_CORREO = 'Este correo fue generado automáticamente, favor no responder.';
const horaCorta = (iso: string | null) => (iso ? format(new Date(iso), 'dd/MM HH:mm') : '—');

/**
 * Plan vigente al abrir el módulo (Laminado 2026-10-06, extendido a Corte Espuma, Venta Externa y
 * Formulación 2026-10-08): si no hay datos de la sesión, carga en modo consulta el último reporte
 * guardado (ver buscarPlanVigente) hasta que se sincronice uno nuevo. Sin SAP. Se intenta una sola vez,
 * cuando `listo`; hayDatos() se vuelve a mirar al llegar el plan para no pisar una sincronización que
 * empezó mientras tanto.
 */
export function useAutoCargaPlanVigente(p: {
  modulo: ModuloPlanTxt;
  centros: CentroPlanTxt[];
  listo?: boolean;
  hayDatos: () => boolean;
  restaurar: (estado: unknown, origen: OrigenEstadoPlan) => boolean;
}): void {
  const intentada = useRef(false);
  const actual = useRef(p);
  actual.current = p;
  useEffect(() => {
    if (p.listo === false || intentada.current) return;
    intentada.current = true;
    if (actual.current.hayDatos()) return;
    // Sin cleanup a propósito: con la guarda del ref, el doble montaje de Strict Mode cancelaría la única carga.
    void buscarPlanVigente(actual.current.modulo, actual.current.centros).then(plan => {
      if (!plan || actual.current.hayDatos()) return;
      actual.current.restaurar(plan.estado, { fechaObjetivo: plan.fechaObjetivo, guardadoEn: plan.modificado });
    });
  }, [p.listo]);
}

export function useReportePlanTxt(config: ConfigReportePlanTxt): FlujoReportePlanTxt {
  const { addNotification } = useAppContext();
  const [estado, setEstado] = useState<EstadoReportePlanTxt>(config.fechaObjetivo ? 'verificando' : 'sin-fecha');
  const [guardadoEn, setGuardadoEn] = useState<string | null>(null);
  const [ruta, setRuta] = useState<string | null>(null);
  const [enviadoEn, setEnviadoEn] = useState<string | null>(null);
  const [guardando, setGuardando] = useState(false);
  const [recuperando, setRecuperando] = useState(false);
  const [enviando, setEnviando] = useState(false);
  const [vista, setVista] = useState<PlanTxtRecuperado | null>(null);
  const [vistaAbierta, setVistaAbierta] = useState(false);
  // Fecha objetivo del reporte abierto en la vista previa (puede ser otra que la del módulo).
  const [fechaVista, setFechaVista] = useState<string | null>(null);

  // construirHtml cambia en cada render del módulo (cierra sobre su estado): se lee del ref al
  // guardar para usar siempre los datos vigentes sin re-disparar la verificación.
  const configRef = useRef(config);
  configRef.current = config;
  const prefijo = config.etiqueta ? `${config.etiqueta}: ` : '';

  const { modulo, centro, fechaObjetivo } = config;
  useEffect(() => {
    setVista(null);
    setFechaVista(null);
    setEnviadoEn(null);
    if (!fechaObjetivo) { setEstado('sin-fecha'); setGuardadoEn(null); setRuta(null); return; }
    let vigente = true;
    setEstado('verificando');
    consultarPlanTxt({ modulo, centro, fechaObjetivo })
      .then(meta => {
        if (!vigente) return;
        setEstado(meta ? 'guardado' : 'sin-guardar');
        setGuardadoEn(meta?.modificado ?? null);
        setRuta(meta?.ruta ?? null);
      })
      .catch(() => { if (vigente) setEstado('error-carpeta'); });
    return () => { vigente = false; };
  }, [modulo, centro, fechaObjetivo]);

  const guardar = useCallback(async (opts?: { sinConfirmar?: boolean; silencioso?: boolean }): Promise<boolean> => {
    const cfg = configRef.current;
    if (!cfg.fechaObjetivo) {
      addNotification('warning', `${prefijo}no hay fecha objetivo para guardar el reporte.`);
      return false;
    }
    if (estado === 'guardado' && !opts?.sinConfirmar && !window.confirm(
      `${prefijo}ya hay un reporte guardado el ${horaCorta(guardadoEn)} para el ${cfg.fechaObjetivo}.\n\n` +
      '¿Reemplazarlo con los datos ACTUALES del módulo? Si ya se exportó a SAP, la necesidad puede haber cambiado por las órdenes FERT nuevas.'
    )) return false;
    setGuardando(true);
    try {
      const html = await cfg.construirHtml();
      const estadoModulo = cfg.capturarEstado?.();
      const res = await guardarPlanTxt({ modulo: cfg.modulo, centro: cfg.centro, fechaObjetivo: cfg.fechaObjetivo, html, asunto: cfg.asunto, estado: estadoModulo });
      setEstado('guardado');
      setGuardadoEn(new Date().toISOString());
      setRuta(res.ruta);
      setVista(null);
      setEnviadoEn(null);
      if (!opts?.silencioso) addNotification('success', `${prefijo}reporte guardado (todavía no se envió). Cuando SAP termine las FERT, usa "Recuperar y revisar" para enviarlo. Archivo: ${res.ruta}`);
      return true;
    } catch (error) {
      addNotification('error', `${prefijo}error al guardar el reporte: ${(error as Error).message}`);
      return false;
    } finally {
      setGuardando(false);
    }
  }, [addNotification, estado, guardadoEn, prefijo]);

  const recuperar = useCallback(async (opts?: { abrir?: boolean; fecha?: string }): Promise<boolean> => {
    const cfg = configRef.current;
    // fecha: abrir el plan de OTRA fecha objetivo (ej. el lunes, revisar lo que se guardó el viernes
    // para el lunes, cuando el módulo ya apunta al martes).
    const fecha = opts?.fecha || cfg.fechaObjetivo;
    if (!fecha) return false;
    setRecuperando(true);
    try {
      let plan = await obtenerPlanTxt({ modulo: cfg.modulo, centro: cfg.centro, fechaObjetivo: fecha });
      if (cfg.completarHtml && plan.html) {
        try {
          const html = await cfg.completarHtml(plan.html, fecha);
          if (html !== plan.html) {
            const res = await guardarPlanTxt({ modulo: cfg.modulo, centro: cfg.centro, fechaObjetivo: fecha, html, asunto: cfg.asunto, estado: plan.estado ?? undefined });
            plan = { ...plan, html, ruta: res.ruta, contenido: (await obtenerPlanTxt({ modulo: cfg.modulo, centro: cfg.centro, fechaObjetivo: fecha })).contenido };
          }
        } catch (error) {
          addNotification('warning', `${prefijo}no se pudieron completar los datos de SAP en el reporte: ${(error as Error).message}`);
        }
      }
      setVista(plan);
      setFechaVista(fecha);
      if (fecha === cfg.fechaObjetivo) {
        setGuardadoEn(plan.modificado);
        setRuta(plan.ruta);
      }
      if (opts?.abrir !== false) setVistaAbierta(true);
      return true;
    } catch (error) {
      addNotification('error', `${prefijo}error al recuperar el reporte: ${(error as Error).message}`);
      return false;
    } finally {
      setRecuperando(false);
    }
  }, [addNotification, prefijo]);

  const enviar = useCallback(async (destino: string): Promise<boolean> => {
    const cfg = configRef.current;
    if (!vista) return false;
    // Sin foto HTML no se envía: el TXT en texto plano no es el correo diseñado (lo reportó el
    // usuario). La vista previa ofrece "Volver a guardar" para regenerarlo.
    if (!vista.html) {
      addNotification('warning', `${prefijo}no hay correo con formato guardado: vuelve a guardar el reporte antes de enviar.`);
      return false;
    }
    if (!destino.trim()) {
      addNotification('warning', 'Escribe al menos un correo destinatario antes de enviar.');
      return false;
    }
    setEnviando(true);
    try {
      // Se envía lo RECUPERADO (la foto guardada), nunca se vuelve a llamar construirHtml acá.
      const resultado = await serviciosService.enviarCorreo({
        destino: destino.trim(),
        asunto: cfg.asunto,
        cuerpo: vista.html,
        nota: NOTA_CORREO,
      });
      setEnviadoEn(new Date().toISOString());
      setVistaAbierta(false);
      addNotification('success', `${prefijo}${resultado.message} — ${resultado.destinatarios.join(', ')}`);
      // Enviado OK: la foto HTML ya cumplió su función (el correo quedó en la bandeja de entrada),
      // en la carpeta queda solo el TXT. Si la limpieza falla el envío igual fue exitoso: solo avisa.
      const fechaEnviada = fechaVista || cfg.fechaObjetivo;
      if (fechaEnviada) {
        try {
          await eliminarFotoCorreoPlanTxt({ modulo: cfg.modulo, centro: cfg.centro, fechaObjetivo: fechaEnviada });
          setVista({ ...vista, html: null });
        } catch (e) {
          addNotification('warning', `${prefijo}correo enviado, pero no se pudo borrar la foto del correo: ${(e as Error).message}`);
        }
      }
      return true;
    } catch (error) {
      addNotification('error', `${prefijo}error al enviar el reporte: ${(error as Error).message}`);
      return false;
    } finally {
      setEnviando(false);
    }
  }, [addNotification, prefijo, vista, fechaVista]);

  const puedeCargar = !!vista?.estado && !!config.restaurarEstado;
  const cargarEnModulo = useCallback((): boolean => {
    const cfg = configRef.current;
    if (!vista?.estado || !cfg.restaurarEstado) return false;
    const ok = cfg.restaurarEstado(vista.estado, { fechaObjetivo: fechaVista || cfg.fechaObjetivo || '', guardadoEn: vista.modificado });
    if (ok) {
      setVistaAbierta(false);
      addNotification('success', `${prefijo}plan guardado el ${horaCorta(vista.modificado)} cargado en el módulo (turnos, corridas y ajustes). Si sincronizas, se recalcula con datos actuales de SAP.`);
    } else {
      addNotification('warning', `${prefijo}el respaldo guardado no es compatible con esta versión del módulo; solo se puede revisar el reporte.`);
    }
    return ok;
  }, [vista, fechaVista, addNotification, prefijo]);

  return {
    config, estado, guardadoEn, ruta, enviadoEn, guardando, recuperando, enviando,
    vista, vistaAbierta, setVistaAbierta, guardar, recuperar, enviar, puedeCargar, cargarEnModulo, fechaVista,
  };
}

/**
 * Pasos del flujo (van dentro del Popover "Enviar Reporte" de cada módulo). Cada paso explica qué
 * hace: el usuario no tenía claro si "Guardar" avisaba, ni de dónde salía el correo al enviar.
 */
const PasoReporte: React.FC<{ n: number; titulo: string; hecho: boolean; activo: boolean; children: React.ReactNode }> = ({ n, titulo, hecho, activo, children }) => (
  <div className={cn('rounded-lg border p-2 space-y-1.5', activo ? 'border-indigo-200 bg-indigo-50/40' : 'border-slate-100', !activo && !hecho && 'opacity-60')}>
    <p className="flex items-center gap-1.5 text-[9px] font-black uppercase tracking-wider text-slate-700">
      <span className={cn('flex h-4 w-4 items-center justify-center rounded-full text-[8px] text-white', hecho ? 'bg-emerald-600' : activo ? 'bg-indigo-600' : 'bg-slate-300')}>
        {hecho ? '✓' : n}
      </span>
      {titulo}
    </p>
    {children}
  </div>
);

export const ReportePlanTxtAcciones: React.FC<{ flujo: FlujoReportePlanTxt; className?: string; compacto?: boolean }> = ({ flujo, className, compacto }) => {
  const { estado, guardando, recuperando, guardadoEn, enviadoEn, config } = flujo;
  const guardado = estado === 'guardado';

  return (
    <div className={cn('space-y-2', className)}>
      {config.etiqueta && <p className="text-[9px] font-black uppercase tracking-widest text-slate-500">{config.etiqueta}</p>}

      <PasoReporte n={1} titulo="Guardar reporte" hecho={guardado} activo={!guardado}>
        {!compacto && (
          <p className="text-[9px] leading-snug text-slate-500">
            Congela el plan de este momento (correo con formato + TXT) en la carpeta compartida. Hazlo <b>antes</b> de exportar a SAP. Todavía no envía nada.
          </p>
        )}
        {estado === 'verificando' ? (
          <Button disabled variant="outline" className="w-full h-8 gap-2 text-[10px] font-black uppercase">
            <Loader2 className="w-4 h-4 animate-spin" /> Verificando…
          </Button>
        ) : guardado ? (
          <div className="flex items-center justify-between gap-2 text-[9px]">
            <span className="flex items-center gap-1 font-bold text-emerald-700">
              <CheckCircle2 className="w-3 h-3" /> Guardado {horaCorta(guardadoEn)} · fecha {config.fechaObjetivo}
            </span>
            <button
              type="button"
              onClick={() => { void flujo.guardar(); }}
              disabled={guardando}
              title="Reemplaza el reporte guardado con los datos ACTUALES del módulo"
              className="flex items-center gap-1 font-bold text-indigo-600 hover:underline disabled:opacity-50"
            >
              {guardando ? <Loader2 className="w-3 h-3 animate-spin" /> : <RotateCcw className="w-3 h-3" />} Volver a guardar
            </button>
          </div>
        ) : (
          <Button
            onClick={() => { void flujo.guardar(); }}
            disabled={guardando || estado === 'sin-fecha'}
            className="w-full h-8 gap-2 text-[10px] font-black uppercase tracking-widest bg-indigo-600 hover:bg-indigo-700 text-white"
          >
            {guardando ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />} Guardar reporte
          </Button>
        )}
        {estado === 'sin-fecha' && <p className="text-[9px] text-amber-600">Sin fecha objetivo: selecciona la fecha del plan antes de guardar.</p>}
        {estado === 'error-carpeta' && <p className="text-[9px] text-red-600">No se pudo consultar la carpeta compartida. Puedes intentar guardar igual.</p>}
      </PasoReporte>

      <PasoReporte n={2} titulo="Revisar y enviar" hecho={!!enviadoEn} activo={guardado && !enviadoEn}>
        {!compacto && (
          <p className="text-[9px] leading-snug text-slate-500">
            Cuando SAP termine de crear las órdenes FERT, abre lo guardado: verás el correo tal cual saldrá, podrás editar los destinatarios y enviarlo.
          </p>
        )}
        <Button
          onClick={() => { void flujo.recuperar(); }}
          disabled={!guardado || recuperando || guardando}
          className="w-full h-8 gap-2 text-[10px] font-black uppercase tracking-widest bg-emerald-600 hover:bg-emerald-700 text-white"
        >
          {recuperando ? <Loader2 className="w-4 h-4 animate-spin" /> : <FileSearch className="w-4 h-4" />} Recuperar y revisar
        </Button>
        {enviadoEn && <p className="text-[9px] font-bold text-emerald-700">Enviado {horaCorta(enviadoEn)}</p>}
        {config.restaurarEstado && <AbrirOtraFecha recuperando={recuperando} onAbrir={fecha => { void flujo.recuperar({ fecha }); }} />}
      </PasoReporte>
    </div>
  );
};

// Abre el reporte de otra fecha objetivo (ej. el lunes, el plan guardado el viernes para el lunes)
// para revisarlo o cargarlo en el módulo. Solo en módulos que saben restaurar su respaldo.
const AbrirOtraFecha: React.FC<{ recuperando: boolean; onAbrir: (fecha: string) => void }> = ({ recuperando, onAbrir }) => {
  const [fecha, setFecha] = useState('');
  return (
    <div className="flex items-center gap-1.5 pt-1 border-t border-slate-100">
      <span className="text-[8px] font-black uppercase text-slate-400 whitespace-nowrap">Otra fecha</span>
      <input
        type="date"
        value={fecha}
        onChange={e => setFecha(e.target.value)}
        className="flex-1 min-w-0 h-7 px-1.5 rounded-md border border-slate-200 text-[10px] font-bold text-slate-700"
      />
      <button
        type="button"
        disabled={!fecha || recuperando}
        onClick={() => onAbrir(fecha)}
        className="h-7 px-2 rounded-md border border-emerald-200 text-[9px] font-black uppercase text-emerald-700 hover:bg-emerald-50 disabled:opacity-40"
      >
        Abrir
      </button>
    </div>
  );
};

/**
 * Diálogo de vista previa + envío. Renderizar FUERA del Popover (ver comentario del archivo).
 * Alto fijo con la vista previa desplazable y el pie (destinatarios + Enviar) siempre visible: antes
 * el pie quedaba fuera de la pantalla y el botón Enviar no se veía.
 */
export const ReportePlanTxtVistaPrevia: React.FC<{
  flujo: FlujoReportePlanTxt;
  titulo: string;
  destinatarios: string;
  onDestinatariosChange: (v: string) => void;
}> = ({ flujo, titulo, destinatarios, onDestinatariosChange }) => {
  const { vista, vistaAbierta, setVistaAbierta, enviando, guardando, config } = flujo;
  const conFormato = !!vista?.html;
  const nDestinatarios = destinatarios.split(/[,;]/).map(s => s.trim()).filter(Boolean).length;

  // Sin foto HTML no se envía en texto plano: se vuelve a guardar (datos actuales) y se recarga la vista.
  // Solo para la fecha del módulo: guardar toma los datos ACTUALES, nunca debe pisar un plan de otra fecha.
  const otraFecha = !!flujo.fechaVista && flujo.fechaVista !== config.fechaObjetivo;
  const regenerar = async () => {
    if (otraFecha) return;
    if (await flujo.guardar()) await flujo.recuperar();
  };

  return (
    <Dialog open={vistaAbierta} onOpenChange={(v) => { if (!enviando) setVistaAbierta(v); }}>
      <DialogContent className="max-w-4xl w-[95vw] h-[90vh] flex flex-col gap-3 overflow-hidden">
        <DialogHeader className="shrink-0">
          <DialogTitle className="text-sm font-black uppercase tracking-widest">
            Vista previa — {titulo}{config.etiqueta ? ` · ${config.etiqueta}` : ''}
          </DialogTitle>
          <DialogDescription className="text-[11px]">
            Guardado el {horaCorta(vista?.modificado ?? null)} para la fecha objetivo {flujo.fechaVista || config.fechaObjetivo}. Se envía exactamente esto,
            sin recalcular con los datos actuales de SAP.
            {vista && <span className="block font-mono text-[10px] text-slate-400 break-all mt-1">{vista.ruta}</span>}
          </DialogDescription>
        </DialogHeader>

        {vista && (
          <Tabs key={vista.modificado} defaultValue={conFormato ? 'correo' : 'txt'} className="flex-1 min-h-0 flex flex-col">
            <TabsList className="self-start shrink-0">
              <TabsTrigger value="correo" className="text-[10px] font-black uppercase">Correo (lo que se envía)</TabsTrigger>
              <TabsTrigger value="txt" className="text-[10px] font-black uppercase">TXT (archivo)</TabsTrigger>
            </TabsList>
            <TabsContent value="correo" className="flex-1 min-h-0 mt-2">
              {conFormato ? (
                // iframe con sandbox: aísla los estilos inline del correo del resto de la app.
                <iframe title="Vista previa del correo" sandbox="" srcDoc={vista.html ?? ''} className="w-full h-full rounded-lg border border-slate-200 bg-white" />
              ) : (
                <div className="rounded-lg border border-amber-200 bg-amber-50 p-4 text-[11px] text-amber-800 space-y-2">
                  <p className="font-black uppercase tracking-wider">No hay correo con formato guardado</p>
                  <p>
                    Este reporte se guardó sin la copia del correo (versión anterior del módulo), o el correo ya se envió y la copia se
                    borró. No se envía como texto plano: vuelve a guardarlo para generar el correo con formato. Ojo: se tomarán los
                    datos <b>actuales</b> del módulo.
                  </p>
                  <Button onClick={() => { void regenerar(); }} disabled={guardando || otraFecha} title={otraFecha ? "Es el reporte de otra fecha: no se puede regenerar con los datos actuales" : undefined} className="h-8 gap-2 text-[10px] font-black uppercase bg-indigo-600 hover:bg-indigo-700 text-white">
                    {guardando ? <Loader2 className="w-4 h-4 animate-spin" /> : <RotateCcw className="w-4 h-4" />} Volver a guardar y actualizar vista
                  </Button>
                </div>
              )}
            </TabsContent>
            <TabsContent value="txt" className="flex-1 min-h-0 mt-2">
              <pre className="h-full overflow-auto rounded-lg border border-slate-200 bg-slate-50 p-3 text-[11px] leading-snug font-mono text-slate-800 whitespace-pre">{vista.contenido}</pre>
            </TabsContent>
          </Tabs>
        )}

        <DialogFooter className="shrink-0 flex-col sm:flex-col gap-2 sm:space-x-0 border-t border-slate-100 pt-3">
          <label className="flex justify-between gap-2 text-[9px] font-black uppercase text-slate-500 tracking-wider">
            <span>Destinatarios — puedes agregar o quitar correos antes de enviar (separados por coma)</span>
            <span className="text-slate-400 whitespace-nowrap">{nDestinatarios} {nDestinatarios === 1 ? 'correo' : 'correos'}</span>
          </label>
          <textarea
            value={destinatarios}
            onChange={(e) => onDestinatariosChange(e.target.value)}
            placeholder="correo1@chaideychaide.com, correo2@chaideychaide.com"
            rows={2}
            className="w-full text-[11px] border border-slate-200 rounded-lg p-2 outline-none focus:border-indigo-400 resize-y"
          />
          <div className="flex justify-end gap-2">
            {config.restaurarEstado && (
              <Button
                variant="outline"
                onClick={() => {
                  if (window.confirm('Se reemplazará lo que hay en pantalla (turnos, corridas, ajustes y resumen) por lo planificado en este reporte. ¿Continuar?')) flujo.cargarEnModulo();
                }}
                disabled={enviando || !flujo.puedeCargar}
                title={flujo.puedeCargar ? 'Vuelve a mostrar en la pestaña lo que se planificó al guardar' : 'Este reporte se guardó sin respaldo del módulo (antes de esta versión): vuelve a guardarlo para poder cargarlo'}
                className="mr-auto h-9 gap-2 text-[10px] font-black uppercase border-emerald-200 text-emerald-700 hover:bg-emerald-50"
              >
                <Upload className="w-4 h-4" /> Cargar en el módulo
              </Button>
            )}
            <Button variant="outline" onClick={() => setVistaAbierta(false)} disabled={enviando} className="h-9 text-[10px] font-black uppercase">Cerrar</Button>
            <Button
              onClick={() => { void flujo.enviar(destinatarios); }}
              disabled={enviando || !destinatarios.trim() || !conFormato}
              title={conFormato ? undefined : 'Vuelve a guardar el reporte para generar el correo con formato'}
              className="h-9 gap-2 text-[10px] font-black uppercase tracking-widest bg-indigo-600 hover:bg-indigo-700 text-white"
            >
              {enviando ? <Loader2 className="w-4 h-4 animate-spin" /> : <Mail className="w-4 h-4" />} Enviar reporte
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

// ---------------------------------------------------------------------------------------------
// Grupo de centros (Venta Externa, Formulación): el mismo reporte para Centro 1000 y 2000 — un solo
// clic guarda ambos, una sola ventana los revisa (pestaña por centro) y un solo "Enviar" manda los
// dos correos (uno por centro, cada uno con su asunto) a la misma lista. Pedido del usuario: con los
// centros separados cada acción se repetía dos veces. Cada centro sigue siendo su propio archivo y
// su propio flujo por debajo (useReportePlanTxt), así un centro sin plan o sin correo con formato
// no bloquea al otro.
// ---------------------------------------------------------------------------------------------

export interface GrupoReportePlanTxt {
  flujos: FlujoReportePlanTxt[];
  abierta: boolean;
  setAbierta: (v: boolean) => void;
  guardando: boolean;
  recuperando: boolean;
  enviando: boolean;
  guardarTodos: () => Promise<void>;
  /** fecha: abre los reportes de OTRA fecha objetivo (ver AbrirOtraFecha). */
  recuperarTodos: (fecha?: string) => Promise<void>;
  enviarTodos: (destino: string) => Promise<void>;
  /** El respaldo del módulo vive en UN flujo del grupo (el que declara capturarEstado). */
  puedeCargar: boolean;
  sabeCargar: boolean;
  cargarEnModulo: () => void;
}

export function useReportePlanTxtGrupo(flujos: FlujoReportePlanTxt[]): GrupoReportePlanTxt {
  const { addNotification } = useAppContext();
  const [abierta, setAbierta] = useState(false);
  const [enviando, setEnviando] = useState(false);
  const etiquetas = (fs: FlujoReportePlanTxt[]) => fs.map(f => f.config.etiqueta || `Centro ${f.config.centro}`).join(' y ');

  const guardarTodos = async () => {
    const yaGuardados = flujos.filter(f => f.estado === 'guardado');
    // Una sola confirmación para todo el grupo (en vez de una por centro).
    if (yaGuardados.length > 0 && !window.confirm(
      `Ya hay reporte guardado para ${etiquetas(yaGuardados)}.\n\n` +
      '¿Reemplazar con los datos ACTUALES del módulo? Si ya se exportó a SAP, la necesidad puede haber cambiado por las órdenes FERT nuevas.'
    )) return;
    // Secuencial, no en paralelo: construirHtml puede refrescar estado del módulo (ej. el preview
    // FERT/PT de Venta Externa) y dos refrescos simultáneos se pisarían.
    for (const f of flujos) await f.guardar({ sinConfirmar: true });
  };

  const recuperarTodos = async (fecha?: string) => {
    // Otra fecha: no se sabe de antemano qué centros tienen reporte; se intenta con todos.
    const guardados = fecha ? flujos : flujos.filter(f => f.estado === 'guardado');
    if (guardados.length === 0) return;
    const ok = await Promise.all(guardados.map(f => f.recuperar({ abrir: false, fecha })));
    if (ok.some(Boolean)) setAbierta(true);
  };

  const conRespaldo = flujos.find(f => f.puedeCargar);
  const cargarEnModulo = () => {
    if (conRespaldo?.cargarEnModulo()) setAbierta(false);
  };

  const enviarTodos = async (destino: string) => {
    const listos = flujos.filter(f => f.vista?.html);
    if (listos.length === 0) {
      addNotification('warning', 'No hay ningún centro con correo con formato guardado: vuelve a guardar el reporte.');
      return;
    }
    setEnviando(true);
    try {
      const resultados: boolean[] = [];
      for (const f of listos) resultados.push(await f.enviar(destino));
      if (resultados.every(Boolean)) setAbierta(false);
    } finally {
      setEnviando(false);
    }
  };

  return {
    flujos, abierta, setAbierta, enviando,
    guardando: flujos.some(f => f.guardando),
    recuperando: flujos.some(f => f.recuperando),
    guardarTodos, recuperarTodos, enviarTodos,
    puedeCargar: !!conRespaldo,
    sabeCargar: flujos.some(f => !!f.config.restaurarEstado),
    cargarEnModulo,
  };
}

/** Pasos unificados del grupo (dentro del Popover). Muestra el estado de cada centro en una línea. */
export const ReportePlanTxtAccionesGrupo: React.FC<{ grupo: GrupoReportePlanTxt; className?: string }> = ({ grupo, className }) => {
  const { flujos, guardando, recuperando } = grupo;
  const verificando = flujos.some(f => f.estado === 'verificando');
  const nGuardados = flujos.filter(f => f.estado === 'guardado').length;
  const todosGuardados = nGuardados === flujos.length;
  const todosEnviados = flujos.every(f => !!f.enviadoEn);
  const sinFecha = flujos.every(f => f.estado === 'sin-fecha');
  const centros = flujos.map(f => f.config.centro).join(' y ');

  return (
    <div className={cn('space-y-2', className)}>
      <PasoReporte n={1} titulo={`Guardar reporte — Centro ${centros}`} hecho={todosGuardados} activo={!todosGuardados}>
        <p className="text-[9px] leading-snug text-slate-500">
          Un clic guarda los {flujos.length} centros: congela el plan de este momento (correo con formato + TXT). Hazlo <b>antes</b> de exportar a SAP. Todavía no envía nada.
        </p>
        {verificando ? (
          <Button disabled variant="outline" className="w-full h-8 gap-2 text-[10px] font-black uppercase">
            <Loader2 className="w-4 h-4 animate-spin" /> Verificando…
          </Button>
        ) : todosGuardados ? null : (
          <Button
            onClick={() => { void grupo.guardarTodos(); }}
            disabled={guardando || sinFecha}
            className="w-full h-8 gap-2 text-[10px] font-black uppercase tracking-widest bg-indigo-600 hover:bg-indigo-700 text-white"
          >
            {guardando ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />} Guardar reporte ({flujos.length} centros)
          </Button>
        )}
        {!verificando && (
          <ul className="space-y-0.5 text-[9px]">
            {flujos.map(f => (
              <li key={f.config.centro} className="flex items-center gap-1">
                {f.estado === 'guardado'
                  ? <><CheckCircle2 className="w-3 h-3 text-emerald-600" /><span className="font-bold text-emerald-700">Centro {f.config.centro}: guardado {horaCorta(f.guardadoEn)}</span>{f.enviadoEn && <span className="text-emerald-700"> · enviado {horaCorta(f.enviadoEn)}</span>}</>
                  : f.estado === 'error-carpeta'
                    ? <span className="text-red-600">Centro {f.config.centro}: no se pudo consultar la carpeta</span>
                    : f.estado === 'sin-fecha'
                      ? <span className="text-amber-600">Centro {f.config.centro}: sin fecha objetivo</span>
                      : <span className="text-slate-400">Centro {f.config.centro}: sin guardar</span>}
              </li>
            ))}
          </ul>
        )}
        {todosGuardados && (
          <button
            type="button"
            onClick={() => { void grupo.guardarTodos(); }}
            disabled={guardando}
            title="Reemplaza el reporte guardado de ambos centros con los datos ACTUALES del módulo"
            className="flex items-center gap-1 text-[9px] font-bold text-indigo-600 hover:underline disabled:opacity-50"
          >
            {guardando ? <Loader2 className="w-3 h-3 animate-spin" /> : <RotateCcw className="w-3 h-3" />} Volver a guardar ({flujos.length} centros)
          </button>
        )}
      </PasoReporte>

      <PasoReporte n={2} titulo="Revisar y enviar" hecho={todosEnviados} activo={nGuardados > 0 && !todosEnviados}>
        <p className="text-[9px] leading-snug text-slate-500">
          Cuando SAP termine de crear las órdenes FERT, abre lo guardado: una pestaña por centro con el correo tal cual saldrá. Un solo envío manda el correo de cada centro a la misma lista.
        </p>
        <Button
          onClick={() => { void grupo.recuperarTodos(); }}
          disabled={nGuardados === 0 || recuperando || guardando}
          className="w-full h-8 gap-2 text-[10px] font-black uppercase tracking-widest bg-emerald-600 hover:bg-emerald-700 text-white"
        >
          {recuperando ? <Loader2 className="w-4 h-4 animate-spin" /> : <FileSearch className="w-4 h-4" />} Recuperar y revisar
        </Button>
        {grupo.sabeCargar && <AbrirOtraFecha recuperando={recuperando} onAbrir={fecha => { void grupo.recuperarTodos(fecha); }} />}
      </PasoReporte>
    </div>
  );
};

/** Vista previa unificada (una pestaña por centro) + un solo envío. Renderizar FUERA del Popover. */
export const ReportePlanTxtVistaPreviaGrupo: React.FC<{
  grupo: GrupoReportePlanTxt;
  titulo: string;
  destinatarios: string;
  onDestinatariosChange: (v: string) => void;
}> = ({ grupo, titulo, destinatarios, onDestinatariosChange }) => {
  const { flujos, abierta, setAbierta, enviando, guardando } = grupo;
  const conVista = flujos.filter(f => f.vista);
  const listos = flujos.filter(f => f.vista?.html);
  const faltantes = flujos.filter(f => !f.vista?.html);
  const nDestinatarios = destinatarios.split(/[,;]/).map(s => s.trim()).filter(Boolean).length;
  const primero = conVista[0]?.config.centro;

  // Solo para la fecha del módulo: guardar toma los datos ACTUALES, nunca debe pisar un plan de otra fecha.
  const esOtraFecha = (f: FlujoReportePlanTxt) => !!f.fechaVista && f.fechaVista !== f.config.fechaObjetivo;
  const regenerar = async (f: FlujoReportePlanTxt) => {
    if (esOtraFecha(f)) return;
    if (await f.guardar()) await f.recuperar({ abrir: false });
  };

  return (
    <Dialog open={abierta} onOpenChange={(v) => { if (!enviando) setAbierta(v); }}>
      <DialogContent className="max-w-4xl w-[95vw] h-[90vh] flex flex-col gap-3 overflow-hidden">
        <DialogHeader className="shrink-0">
          <DialogTitle className="text-sm font-black uppercase tracking-widest">Vista previa — {titulo}</DialogTitle>
          <DialogDescription className="text-[11px]">
            Una pestaña por centro. Se envía exactamente lo guardado, sin recalcular con los datos actuales de SAP: un correo por centro, a la misma lista.
          </DialogDescription>
        </DialogHeader>

        {primero && (
          <Tabs key={conVista.map(f => f.vista?.modificado).join('|')} defaultValue={primero} className="flex-1 min-h-0 flex flex-col">
            <TabsList className="self-start shrink-0">
              {flujos.map(f => (
                <TabsTrigger key={f.config.centro} value={f.config.centro} disabled={!f.vista} className="text-[10px] font-black uppercase gap-1">
                  Centro {f.config.centro}
                  {f.vista?.html
                    ? <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                    : <span className="text-amber-600">{f.vista ? '· sin formato' : '· sin guardar'}</span>}
                </TabsTrigger>
              ))}
            </TabsList>
            {conVista.map(f => (
              <TabsContent key={f.config.centro} value={f.config.centro} className="flex-1 min-h-0 mt-2 flex flex-col gap-1">
                <p className="shrink-0 text-[10px] text-slate-500">
                  Guardado el {horaCorta(f.vista?.modificado ?? null)} · fecha objetivo {f.fechaVista || f.config.fechaObjetivo}
                  <span className="block font-mono text-[10px] text-slate-400 break-all">{f.vista?.ruta}</span>
                </p>
                <Tabs defaultValue={f.vista?.html ? 'correo' : 'txt'} className="flex-1 min-h-0 flex flex-col">
                  <TabsList className="self-start shrink-0 h-7">
                    <TabsTrigger value="correo" className="text-[9px] font-black uppercase h-5">Correo (lo que se envía)</TabsTrigger>
                    <TabsTrigger value="txt" className="text-[9px] font-black uppercase h-5">TXT (archivo)</TabsTrigger>
                  </TabsList>
                  <TabsContent value="correo" className="flex-1 min-h-0 mt-2">
                    {f.vista?.html ? (
                      <iframe title={`Vista previa del correo — Centro ${f.config.centro}`} sandbox="" srcDoc={f.vista.html} className="w-full h-full rounded-lg border border-slate-200 bg-white" />
                    ) : (
                      <div className="rounded-lg border border-amber-200 bg-amber-50 p-4 text-[11px] text-amber-800 space-y-2">
                        <p className="font-black uppercase tracking-wider">Centro {f.config.centro}: no hay correo con formato guardado</p>
                        <p>Se guardó sin la copia del correo o ya se envió. Este centro no se enviará: vuelve a guardarlo (tomará los datos <b>actuales</b> del módulo).</p>
                        <Button onClick={() => { void regenerar(f); }} disabled={guardando || esOtraFecha(f)} className="h-8 gap-2 text-[10px] font-black uppercase bg-indigo-600 hover:bg-indigo-700 text-white">
                          {f.guardando ? <Loader2 className="w-4 h-4 animate-spin" /> : <RotateCcw className="w-4 h-4" />} Volver a guardar Centro {f.config.centro}
                        </Button>
                      </div>
                    )}
                  </TabsContent>
                  <TabsContent value="txt" className="flex-1 min-h-0 mt-2">
                    <pre className="h-full overflow-auto rounded-lg border border-slate-200 bg-slate-50 p-3 text-[11px] leading-snug font-mono text-slate-800 whitespace-pre">{f.vista?.contenido}</pre>
                  </TabsContent>
                </Tabs>
              </TabsContent>
            ))}
          </Tabs>
        )}

        <DialogFooter className="shrink-0 flex-col sm:flex-col gap-2 sm:space-x-0 border-t border-slate-100 pt-3">
          <label className="flex justify-between gap-2 text-[9px] font-black uppercase text-slate-500 tracking-wider">
            <span>Destinatarios — puedes agregar o quitar correos antes de enviar (separados por coma)</span>
            <span className="text-slate-400 whitespace-nowrap">{nDestinatarios} {nDestinatarios === 1 ? 'correo' : 'correos'}</span>
          </label>
          <textarea
            value={destinatarios}
            onChange={(e) => onDestinatariosChange(e.target.value)}
            placeholder="correo1@chaideychaide.com, correo2@chaideychaide.com"
            rows={2}
            className="w-full text-[11px] border border-slate-200 rounded-lg p-2 outline-none focus:border-indigo-400 resize-y"
          />
          {faltantes.length > 0 && listos.length > 0 && (
            <p className="text-[10px] text-amber-600">
              Se enviará solo {listos.map(f => `Centro ${f.config.centro}`).join(' y ')}; {faltantes.map(f => `Centro ${f.config.centro}`).join(' y ')} no tiene correo con formato.
            </p>
          )}
          <div className="flex justify-end gap-2">
            {grupo.sabeCargar && (
              <Button
                variant="outline"
                onClick={() => {
                  if (window.confirm('Se reemplazará lo que hay en pantalla (ambos centros) por lo planificado en este reporte. ¿Continuar?')) grupo.cargarEnModulo();
                }}
                disabled={enviando || !grupo.puedeCargar}
                title={grupo.puedeCargar ? 'Vuelve a mostrar en el módulo lo que se planificó al guardar' : 'Este reporte se guardó sin respaldo del módulo (antes de esta versión): vuelve a guardarlo para poder cargarlo'}
                className="mr-auto h-9 gap-2 text-[10px] font-black uppercase border-emerald-200 text-emerald-700 hover:bg-emerald-50"
              >
                <Upload className="w-4 h-4" /> Cargar en el módulo
              </Button>
            )}
            <Button variant="outline" onClick={() => setAbierta(false)} disabled={enviando} className="h-9 text-[10px] font-black uppercase">Cerrar</Button>
            <Button
              onClick={() => { void grupo.enviarTodos(destinatarios); }}
              disabled={enviando || !destinatarios.trim() || listos.length === 0}
              className="h-9 gap-2 text-[10px] font-black uppercase tracking-widest bg-indigo-600 hover:bg-indigo-700 text-white"
            >
              {enviando ? <Loader2 className="w-4 h-4 animate-spin" /> : <Mail className="w-4 h-4" />}
              Enviar reporte ({listos.map(f => f.config.centro).join(' + ') || '—'})
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
