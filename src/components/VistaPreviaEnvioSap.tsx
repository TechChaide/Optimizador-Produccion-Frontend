'use client';

import React, { memo, useCallback, useEffect, useMemo, useState } from 'react';
import { Loader2, Send, X } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { cn } from '@/lib/utils';
import type { SolicitudProduccionHBPayload } from '@/services/servicios.service';

export type CampoSolicitudSap = { key: keyof SolicitudProduccionHBPayload; label: string; type?: 'number' };

type Fila = { key: string; descripcion: string; payload: SolicitudProduccionHBPayload };

// Vista previa "Confirmar envío a SAP" compartida por Corte Laminado y Corte Espuma. Las filas (y sus
// ediciones / la X para quitar) viven en el estado de ESTE componente: antes vivían en el módulo, y
// cada tecla o cada X volvía a renderizar el módulo completo (miles de líneas de tablas) — por eso se
// sentía lento (pedido del usuario 2026-10-07). El módulo solo recibe el resultado al confirmar.
const FilaSap = memo(function FilaSap({ fila, index, campos, errorCampo, enviando, onCambio, onQuitar }: {
  fila: Fila;
  index: number;
  campos: CampoSolicitudSap[];
  errorCampo?: (p: SolicitudProduccionHBPayload, campo: keyof SolicitudProduccionHBPayload) => string | null;
  enviando: boolean;
  onCambio: (index: number, campo: keyof SolicitudProduccionHBPayload, valor: string | number) => void;
  onQuitar: (index: number) => void;
}) {
  const { payload } = fila;
  return (
    <tr>
      <td className="px-1 py-1 text-center">
        <button
          type="button"
          onClick={() => onQuitar(index)}
          disabled={enviando}
          title="Quitar esta orden del envío a SAP"
          aria-label={`Quitar ${payload.CodigoMaterial} del envío`}
          className="inline-flex items-center justify-center w-6 h-6 rounded-md text-slate-400 hover:text-red-600 hover:bg-red-50 disabled:opacity-40 disabled:pointer-events-none"
        >
          <X className="w-3.5 h-3.5" />
        </button>
      </td>
      <td className="px-2 py-1 truncate max-w-[180px]" title={fila.descripcion}>{fila.descripcion || '—'}</td>
      {campos.map(f => {
        const error = errorCampo ? errorCampo(payload, f.key) : null;
        return (
          <td key={f.key} className="px-1 py-1">
            <Input
              type={f.type === 'number' ? 'number' : 'text'}
              value={payload[f.key] ?? ''}
              onChange={(e) => onCambio(index, f.key, f.type === 'number' ? (Number(e.target.value) || 0) : e.target.value)}
              disabled={enviando}
              title={error || undefined}
              className={cn("h-7 text-[10px] font-mono px-1.5", f.key === 'Observaciones' ? 'w-48' : 'w-24', error && "border-red-400 bg-red-50")}
            />
          </td>
        );
      })}
    </tr>
  );
});

export const VistaPreviaEnvioSap = memo(function VistaPreviaEnvioSap({
  abierto, titulo, descripcion, tiempos, filasIniciales, campos, errorCampo, avisoErrores, enviando, onCancelar, onConfirmar,
}: {
  abierto: boolean;
  titulo: React.ReactNode;
  descripcion: React.ReactNode;
  // Cuánto tardó cada paso del armado (ver medirPaso), para ubicar la demora sin suponer.
  tiempos?: string;
  filasIniciales: Fila[] | null;
  campos: CampoSolicitudSap[];
  errorCampo?: (p: SolicitudProduccionHBPayload, campo: keyof SolicitudProduccionHBPayload) => string | null;
  avisoErrores?: (n: number) => React.ReactNode;
  enviando: boolean;
  onCancelar: () => void;
  onConfirmar: (payloads: SolicitudProduccionHBPayload[]) => void;
}) {
  const [filas, setFilas] = useState<Fila[]>([]);
  useEffect(() => { setFilas(filasIniciales ?? []); }, [filasIniciales]);

  const onCambio = useCallback((index: number, campo: keyof SolicitudProduccionHBPayload, valor: string | number) => {
    setFilas(prev => prev.map((f, i) => i === index ? { ...f, payload: { ...f.payload, [campo]: valor } } : f));
  }, []);
  const onQuitar = useCallback((index: number) => {
    setFilas(prev => prev.filter((_, i) => i !== index));
  }, []);

  const errores = useMemo(() => errorCampo
    ? filas.reduce((n, f) => n + campos.filter(c => errorCampo(f.payload, c.key)).length, 0)
    : 0, [filas, campos, errorCampo]);

  return (
    <Dialog open={abierto} onOpenChange={(open) => { if (!open && !enviando) onCancelar(); }}>
      <DialogContent className="max-w-[96vw] max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{titulo}</DialogTitle>
          <DialogDescription>{descripcion}</DialogDescription>
        </DialogHeader>
        {abierto && (
          <div className="space-y-4 text-left text-sm">
            <div>
              <span className="font-black text-slate-500 text-[10px] uppercase block mb-2">Órdenes a crear ({filas.length})</span>
              {tiempos && <p className="-mt-1 mb-2 text-[10px] text-slate-400 font-mono">{tiempos}</p>}
              <div className="border border-slate-100 rounded-xl overflow-auto max-h-[400px]">
                <table className="text-[11px] border-collapse">
                  <thead className="bg-gray-50 text-gray-400 uppercase font-bold sticky top-0 z-10">
                    <tr>
                      <th className="px-2 py-2 w-8" aria-label="Quitar" />
                      <th className="px-2 py-2 text-left whitespace-nowrap">Descripción</th>
                      {campos.map(f => (
                        <th key={f.key} className="px-2 py-2 text-left whitespace-nowrap">{f.label}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-50">
                    {filas.map((fila, i) => (
                      <FilaSap key={fila.key} fila={fila} index={i} campos={campos} errorCampo={errorCampo} enviando={enviando} onCambio={onCambio} onQuitar={onQuitar} />
                    ))}
                  </tbody>
                </table>
              </div>
              {errores > 0 && avisoErrores && <p className="mt-2 text-[11px] font-bold text-red-600">{avisoErrores(errores)}</p>}
            </div>
          </div>
        )}
        <DialogFooter>
          <Button variant="outline" onClick={onCancelar} disabled={enviando}>Cancelar</Button>
          <Button onClick={() => onConfirmar(filas.map(f => f.payload))} disabled={enviando || errores > 0 || filas.length === 0} className="bg-emerald-600 hover:bg-emerald-700 text-white">
            {enviando ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Send className="w-4 h-4 mr-2" />} {enviando ? 'Enviando…' : 'Confirmar y Enviar a SAP'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
});

// Mide un paso del armado del envío (pedido del usuario 2026-10-07: ubicar dónde se va el tiempo).
// Anota "etiqueta x.x s" en `log` y lo deja también en la consola.
export const medirPaso = async <T,>(log: string[], etiqueta: string, paso: Promise<T> | (() => Promise<T>)): Promise<T> => {
  const t0 = performance.now();
  try {
    return await (typeof paso === 'function' ? paso() : paso);
  } finally {
    const s = (performance.now() - t0) / 1000;
    log.push(`${etiqueta} ${s.toFixed(1)} s`);
    console.info(`[Envío SAP] ${etiqueta}: ${s.toFixed(2)} s`);
  }
};

// Versión de Fabricación por centro|material, compartida entre módulos y reutilizada mientras la
// pestaña esté abierta: el endpoint es por material, y antes se pedía de nuevo en cada "Enviar a SAP"
// en lotes de 5 que esperaban uno al otro. Ahora: caché + hasta 10 consultas simultáneas, y los
// módulos la precargan en segundo plano apenas el plan está listo, así la vista previa abre al toque.
const cacheVersiones = new Map<string, Promise<unknown[]>>();

export const versionesFabricacionCacheadas = async <T,>(
  centro: string,
  materiales: string[],
  consultar: (centro: string, material: string) => Promise<T[]>,
  concurrencia = 10,
): Promise<Map<string, T[]>> => {
  const resultado = new Map<string, T[]>();
  const pendientes = [...new Set(materiales)];
  const trabajar = async () => {
    for (let m = pendientes.shift(); m !== undefined; m = pendientes.shift()) {
      const clave = `${centro}|${m}`;
      let promesa = cacheVersiones.get(clave) as Promise<T[]> | undefined;
      if (!promesa) {
        promesa = consultar(centro, m);
        cacheVersiones.set(clave, promesa);
        // Un fallo no se queda en caché: el próximo envío lo vuelve a intentar.
        promesa.catch(() => cacheVersiones.delete(clave));
      }
      try { resultado.set(m, await promesa); } catch { resultado.set(m, []); }
    }
  };
  await Promise.all(Array.from({ length: Math.min(concurrencia, pendientes.length) }, trabajar));
  return resultado;
};
