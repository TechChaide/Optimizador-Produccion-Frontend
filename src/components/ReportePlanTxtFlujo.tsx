'use client';

/**
 * Flujo de 3 pasos para el "Reporte de producción" de los módulos tácticos:
 *
 *   1. Guardar reporte   -> foto del plan EN ESE MOMENTO: TXT + HTML del correo en la carpeta
 *                           compartida (ver src/lib/planes-txt.ts / api/planes-txt).
 *   2. Recuperar reporte -> lee lo guardado (no recalcula) y lo muestra en vista previa.
 *   3. Enviar            -> manda por correo exactamente lo recuperado.
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
import { CheckCircle2, FileSearch, Loader2, Mail, RotateCcw, Save } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useAppContext } from '@/context/AppProvider';
import { serviciosService } from '@/services/servicios.service';
import { cn } from '@/lib/utils';
import {
  consultarPlanTxt, guardarPlanTxt, obtenerPlanTxt, txtACorreoHtml,
  type CentroPlanTxt, type ModuloPlanTxt, type PlanTxtRecuperado,
} from '@/lib/planes-txt';

export type EstadoReportePlanTxt = 'sin-fecha' | 'verificando' | 'sin-guardar' | 'guardado' | 'error-carpeta';

export interface ConfigReportePlanTxt {
  modulo: ModuloPlanTxt;
  centro: CentroPlanTxt;
  /** yyyy-MM-dd; null = el módulo todavía no tiene fecha objetivo (no se puede guardar). */
  fechaObjetivo: string | null;
  asunto: string;
  /** Arma el HTML del correo con los datos ACTUALES del módulo (solo se llama al guardar). */
  construirHtml: () => string | Promise<string>;
  /** Texto corto para notificaciones/diálogo cuando hay varios flujos en el mismo módulo (ej. "Centro 1000"). */
  etiqueta?: string;
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
  guardar: () => Promise<void>;
  recuperar: () => Promise<void>;
  enviar: (destino: string) => Promise<void>;
}

const NOTA_CORREO = 'Este correo fue generado automáticamente, favor no responder.';
const horaCorta = (iso: string | null) => (iso ? format(new Date(iso), 'dd/MM HH:mm') : '—');

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

  // construirHtml cambia en cada render del módulo (cierra sobre su estado): se lee del ref al
  // guardar para usar siempre los datos vigentes sin re-disparar la verificación.
  const configRef = useRef(config);
  configRef.current = config;
  const prefijo = config.etiqueta ? `${config.etiqueta}: ` : '';

  const { modulo, centro, fechaObjetivo } = config;
  useEffect(() => {
    setVista(null);
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

  const guardar = useCallback(async () => {
    const cfg = configRef.current;
    if (!cfg.fechaObjetivo) {
      addNotification('warning', `${prefijo}no hay fecha objetivo para guardar el reporte.`);
      return;
    }
    if (estado === 'guardado' && !window.confirm(
      `${prefijo}ya hay un reporte guardado el ${horaCorta(guardadoEn)} para el ${cfg.fechaObjetivo}.\n\n` +
      '¿Reemplazarlo con los datos ACTUALES del módulo? Si ya se exportó a SAP, la necesidad puede haber cambiado por las órdenes FERT nuevas.'
    )) return;
    setGuardando(true);
    try {
      const html = await cfg.construirHtml();
      const res = await guardarPlanTxt({ modulo: cfg.modulo, centro: cfg.centro, fechaObjetivo: cfg.fechaObjetivo, html, asunto: cfg.asunto });
      setEstado('guardado');
      setGuardadoEn(new Date().toISOString());
      setRuta(res.ruta);
      setVista(null);
      setEnviadoEn(null);
      addNotification('success', `${prefijo}reporte guardado en ${res.ruta}`);
    } catch (error) {
      addNotification('error', `${prefijo}error al guardar el reporte: ${(error as Error).message}`);
    } finally {
      setGuardando(false);
    }
  }, [addNotification, estado, guardadoEn, prefijo]);

  const recuperar = useCallback(async () => {
    const cfg = configRef.current;
    if (!cfg.fechaObjetivo) return;
    setRecuperando(true);
    try {
      const plan = await obtenerPlanTxt({ modulo: cfg.modulo, centro: cfg.centro, fechaObjetivo: cfg.fechaObjetivo });
      setVista(plan);
      setGuardadoEn(plan.modificado);
      setRuta(plan.ruta);
      setVistaAbierta(true);
    } catch (error) {
      addNotification('error', `${prefijo}error al recuperar el reporte: ${(error as Error).message}`);
    } finally {
      setRecuperando(false);
    }
  }, [addNotification, prefijo]);

  const enviar = useCallback(async (destino: string) => {
    const cfg = configRef.current;
    if (!vista) return;
    if (!destino.trim()) {
      addNotification('warning', 'Escribe al menos un correo destinatario antes de enviar.');
      return;
    }
    setEnviando(true);
    try {
      // Se envía lo RECUPERADO (la foto guardada), nunca se vuelve a llamar construirHtml acá.
      const resultado = await serviciosService.enviarCorreo({
        destino: destino.trim(),
        asunto: cfg.asunto,
        cuerpo: vista.html ?? txtACorreoHtml(vista.contenido),
        nota: NOTA_CORREO,
      });
      setEnviadoEn(new Date().toISOString());
      setVistaAbierta(false);
      addNotification('success', `${prefijo}${resultado.message} — ${resultado.destinatarios.join(', ')}`);
    } catch (error) {
      addNotification('error', `${prefijo}error al enviar el reporte: ${(error as Error).message}`);
    } finally {
      setEnviando(false);
    }
  }, [addNotification, prefijo, vista]);

  return {
    config, estado, guardadoEn, ruta, enviadoEn, guardando, recuperando, enviando,
    vista, vistaAbierta, setVistaAbierta, guardar, recuperar, enviar,
  };
}

/** Botones del flujo (van dentro del Popover "Enviar Reporte" de cada módulo). */
export const ReportePlanTxtAcciones: React.FC<{ flujo: FlujoReportePlanTxt; className?: string; compacto?: boolean }> = ({ flujo, className, compacto }) => {
  const { estado, guardando, recuperando, guardadoEn, enviadoEn, config } = flujo;
  const guardado = estado === 'guardado';
  const paso = guardado ? (enviadoEn ? 3 : 2) : 1;

  return (
    <div className={cn('space-y-1.5', className)}>
      {config.etiqueta && <p className="text-[9px] font-black uppercase tracking-widest text-slate-500">{config.etiqueta}</p>}
      {!compacto && (
        <div className="flex items-center gap-1 text-[8px] font-black uppercase tracking-wider">
          {['Guardar', 'Vista previa', 'Enviar'].map((p, i) => (
            <React.Fragment key={p}>
              {i > 0 && <span className="text-slate-300">→</span>}
              <span className={cn('rounded px-1.5 py-0.5', paso === i + 1 ? 'bg-indigo-600 text-white' : paso > i + 1 ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-100 text-slate-400')}>
                {i + 1}. {p}
              </span>
            </React.Fragment>
          ))}
        </div>
      )}

      {estado === 'verificando' ? (
        <Button disabled variant="outline" className="w-full h-9 gap-2 text-[10px] font-black uppercase">
          <Loader2 className="w-4 h-4 animate-spin" /> Verificando reporte guardado…
        </Button>
      ) : guardado ? (
        <Button
          onClick={flujo.recuperar}
          disabled={recuperando || guardando}
          className="w-full h-9 gap-2 text-[10px] font-black uppercase tracking-widest bg-emerald-600 hover:bg-emerald-700 text-white"
        >
          {recuperando ? <Loader2 className="w-4 h-4 animate-spin" /> : <FileSearch className="w-4 h-4" />} Recuperar reporte · vista previa
        </Button>
      ) : (
        <Button
          onClick={flujo.guardar}
          disabled={guardando || estado === 'sin-fecha'}
          className="w-full h-9 gap-2 text-[10px] font-black uppercase tracking-widest bg-indigo-600 hover:bg-indigo-700 text-white"
        >
          {guardando ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />} Guardar reporte
        </Button>
      )}

      {estado === 'sin-fecha' && <p className="text-[9px] text-amber-600">Sin fecha objetivo: selecciona la fecha del plan antes de guardar.</p>}
      {estado === 'error-carpeta' && <p className="text-[9px] text-red-600">No se pudo consultar la carpeta compartida. Puedes intentar guardar igual.</p>}
      {guardado && (
        <div className="flex items-center justify-between gap-2 text-[9px] text-slate-500">
          <span className="flex items-center gap-1">
            <CheckCircle2 className="w-3 h-3 text-emerald-600" />
            Guardado {horaCorta(guardadoEn)} · fecha {config.fechaObjetivo}
            {enviadoEn && <span className="text-emerald-700 font-bold"> · enviado {horaCorta(enviadoEn)}</span>}
          </span>
          <button
            type="button"
            onClick={flujo.guardar}
            disabled={guardando}
            title="Reemplaza el reporte guardado con los datos actuales del módulo"
            className="flex items-center gap-1 font-bold text-indigo-600 hover:underline disabled:opacity-50"
          >
            {guardando ? <Loader2 className="w-3 h-3 animate-spin" /> : <RotateCcw className="w-3 h-3" />} Volver a guardar
          </button>
        </div>
      )}
    </div>
  );
};

/** Diálogo de vista previa + envío. Renderizar FUERA del Popover (ver comentario del archivo). */
export const ReportePlanTxtVistaPrevia: React.FC<{
  flujo: FlujoReportePlanTxt;
  titulo: string;
  destinatarios: string;
  onDestinatariosChange: (v: string) => void;
}> = ({ flujo, titulo, destinatarios, onDestinatariosChange }) => {
  const { vista, vistaAbierta, setVistaAbierta, enviando, config } = flujo;
  const html = vista ? (vista.html ?? txtACorreoHtml(vista.contenido)) : '';

  return (
    <Dialog open={vistaAbierta} onOpenChange={(v) => { if (!enviando) setVistaAbierta(v); }}>
      <DialogContent className="max-w-4xl w-[95vw] max-h-[92vh] flex flex-col gap-3">
        <DialogHeader>
          <DialogTitle className="text-sm font-black uppercase tracking-widest">
            Vista previa — {titulo}{config.etiqueta ? ` · ${config.etiqueta}` : ''}
          </DialogTitle>
          <DialogDescription className="text-[11px]">
            Reporte guardado el {horaCorta(vista?.modificado ?? null)} para la fecha objetivo {config.fechaObjetivo}. Se envía
            exactamente esto, sin recalcular con los datos actuales de SAP.
            {vista && <span className="block font-mono text-[10px] text-slate-400 break-all mt-1">{vista.ruta}</span>}
          </DialogDescription>
        </DialogHeader>

        {vista && (
          <Tabs defaultValue="correo" className="flex-1 min-h-0 flex flex-col">
            <TabsList className="self-start">
              <TabsTrigger value="correo" className="text-[10px] font-black uppercase">Correo</TabsTrigger>
              <TabsTrigger value="txt" className="text-[10px] font-black uppercase">TXT</TabsTrigger>
            </TabsList>
            <TabsContent value="correo" className="flex-1 min-h-0">
              {!vista.html && (
                <p className="text-[10px] text-amber-600 mb-2">Este reporte se guardó sin foto del correo: se enviará el TXT en formato de texto.</p>
              )}
              {/* iframe con sandbox: aísla los estilos inline del correo del resto de la app. */}
              <iframe title="Vista previa del correo" sandbox="" srcDoc={html} className="w-full h-[55vh] rounded-lg border border-slate-200 bg-white" />
            </TabsContent>
            <TabsContent value="txt" className="flex-1 min-h-0">
              <pre className="h-[55vh] overflow-auto rounded-lg border border-slate-200 bg-slate-50 p-3 text-[11px] leading-snug font-mono text-slate-800 whitespace-pre">{vista.contenido}</pre>
            </TabsContent>
          </Tabs>
        )}

        <DialogFooter className="flex-col sm:flex-col gap-2 sm:space-x-0">
          <label className="text-[9px] font-black uppercase text-slate-500 tracking-wider">Destinatarios (separados por coma)</label>
          <textarea
            value={destinatarios}
            onChange={(e) => onDestinatariosChange(e.target.value)}
            placeholder="correo1@chaideychaide.com, correo2@chaideychaide.com"
            rows={2}
            className="w-full text-[11px] border border-slate-200 rounded-lg p-2 outline-none focus:border-indigo-400 resize-none"
          />
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => setVistaAbierta(false)} disabled={enviando} className="h-9 text-[10px] font-black uppercase">Cerrar</Button>
            <Button
              onClick={() => flujo.enviar(destinatarios)}
              disabled={enviando || !destinatarios.trim() || !vista}
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
