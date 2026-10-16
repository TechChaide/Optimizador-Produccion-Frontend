'use client';

/**
 * Aviso de respuestas del día (usuario 2026-10-16): campana fija en el dashboard que avisa cuando ya
 * existe la respuesta que habilita al siguiente proceso — P2-VENTA (para Laminado / Corte Espuma),
 * P3 Rollos de Laminado y P3 de Corte Espuma (para el área cuyo P2 respondieron: Forros, Muebles, VE…).
 * Ej.: "Laminado respondió P3 Rollos #1234 a las 10:15 · 18 materiales para Forros".
 *
 * Va en el layout del dashboard (no dentro de un módulo), así lo ve también un proceso cuyo módulo no
 * se toca (Forros). Sin correo: el reporte de cada módulo ya sale por correo. Solo lectura: Plan Grupo
 * cada 5 min / al volver a la pestaña, y los detalles solo de un plan nuevo. Cualquier error deja la
 * campana en silencio: nunca debe romper el layout común.
 */
import React, { useCallback, useEffect, useRef, useState } from 'react';
import { format } from 'date-fns';
import { Bell } from 'lucide-react';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { useToast } from '@/hooks/use-toast';
import { planGrupoService } from '@/services/plangrupo.service';
import { grupoService } from '@/services/grupo.service';
import { detallesDePlanes } from '@/lib/datos-sap-compartidos';
import { respuestasDelDia } from '@/lib/estado-dia';
import type { PlanGrupo } from '@/types/interfaces';

const INTERVALO_MS = 5 * 60 * 1000;

interface Aviso { codigo: number; hora: string; texto: string }

const claveVistos = (hoy: string) => `avisoRespuestas:vistos:${hoy}`;
const leerVistos = (hoy: string): Set<number> => {
  try { return new Set(JSON.parse(localStorage.getItem(claveVistos(hoy)) || '[]')); } catch { return new Set(); }
};
const guardarVistos = (hoy: string, vistos: Set<number>) => {
  try { localStorage.setItem(claveVistos(hoy), JSON.stringify(Array.from(vistos))); } catch { /* sin almacenamiento: solo no recuerda lo visto */ }
};

const plural = (n: number) => `${n} material${n === 1 ? '' : 'es'}`;

export function AvisoRespuestasDia() {
  const { toast } = useToast();
  const [avisos, setAvisos] = useState<Aviso[]>([]);
  const [vistos, setVistos] = useState<Set<number>>(new Set());
  // Texto por plan ya armado: los detalles de un plan se piden una sola vez.
  const textoPorPlan = useRef(new Map<number, string>());
  const nombreGrupo = useRef<Map<number, string> | null>(null);
  const primeraConsulta = useRef(true);

  const textoDe = useCallback(async (r: ReturnType<typeof respuestasDelDia>[number], planes: Map<number, PlanGrupo>): Promise<string> => {
    const { plan } = r;
    const detalles = (await detallesDePlanes([plan.codigo_plan_grupo])).filter(d => d.estado === 'A' && d.codigo_plan_grupo === plan.codigo_plan_grupo);
    if (r.id === 've-p2') {
      // P2 de Venta Externa: lo consume Laminado (Rollos) o Corte Espuma (Espumas).
      const destino = /rollo/i.test(String(plan.valor || '')) ? 'Laminado' : 'Corte Espuma';
      const tipo = /rollo/i.test(String(plan.valor || '')) ? 'Rollos' : 'Espumas';
      const n = new Set(detalles.map(d => d.codigo_material)).size;
      return `Venta Externa generó P2 ${tipo} #${plan.codigo_plan_grupo} a las ${r.hora} · ${plural(n)} para ${destino}`;
    }
    // P3: un aviso con el desglose por área del P2 padre (el propio P3 como padre = sin área).
    if (!nombreGrupo.current) {
      const g = await grupoService.getAll();
      nombreGrupo.current = new Map((g.data || []).map(x => [x.codigo_grupo, String(x.nombre_grupo || '').trim()]));
    }
    const porArea = new Map<string, Set<number>>();
    detalles.forEach(d => {
      const padre = d.codigo_plan_grupo_padre ? planes.get(d.codigo_plan_grupo_padre) : undefined;
      if (!padre || padre.codigo_plan_grupo === plan.codigo_plan_grupo) return;
      const area = nombreGrupo.current!.get(padre.codigo_grupo) || `Grupo ${padre.codigo_grupo}`;
      if (!porArea.has(area)) porArea.set(area, new Set());
      porArea.get(area)!.add(d.codigo_material);
    });
    const areas = Array.from(porArea.entries()).map(([area, mats]) => `${plural(mats.size)} para ${area}`);
    return `${r.modulo} respondió ${r.etiqueta} #${plan.codigo_plan_grupo} a las ${r.hora}${areas.length ? ` · ${areas.join(' · ')}` : ''}`;
  }, []);

  const consultar = useCallback(async () => {
    const hoy = format(new Date(), 'yyyy-MM-dd');
    try {
      const planesLista = (await planGrupoService.getAll()).data || [];
      const planes = new Map(planesLista.map(p => [p.codigo_plan_grupo, p]));
      const respuestas = respuestasDelDia(planesLista, hoy);
      const nuevos: Aviso[] = [];
      for (const r of respuestas) {
        const codigo = r.plan.codigo_plan_grupo;
        if (!textoPorPlan.current.has(codigo)) {
          textoPorPlan.current.set(codigo, await textoDe(r, planes).catch(() => `${r.modulo} · ${r.etiqueta} #${codigo} a las ${r.hora}`));
          if (!primeraConsulta.current) nuevos.push({ codigo, hora: r.hora, texto: textoPorPlan.current.get(codigo)! });
        }
      }
      setAvisos(respuestas.map(r => ({ codigo: r.plan.codigo_plan_grupo, hora: r.hora, texto: textoPorPlan.current.get(r.plan.codigo_plan_grupo)! })).reverse());
      setVistos(leerVistos(hoy));
      // Mensaje emergente solo para lo que aparece con la app abierta (no lo que ya existía al entrar).
      nuevos.forEach(a => toast({ title: 'Respuesta disponible', description: a.texto }));
      primeraConsulta.current = false;
    } catch (e) {
      console.warn('[Aviso respuestas] No se pudo consultar:', (e as Error).message);
    }
  }, [textoDe, toast]);

  useEffect(() => {
    void consultar();
    const id = window.setInterval(() => { void consultar(); }, INTERVALO_MS);
    const alVolver = () => { if (document.visibilityState === 'visible') void consultar(); };
    document.addEventListener('visibilitychange', alVolver);
    return () => { window.clearInterval(id); document.removeEventListener('visibilitychange', alVolver); };
  }, [consultar]);

  const sinVer = avisos.filter(a => !vistos.has(a.codigo)).length;
  const marcarVistos = (abierto: boolean) => {
    if (!abierto || sinVer === 0) return;
    const hoy = format(new Date(), 'yyyy-MM-dd');
    const todos = new Set([...Array.from(vistos), ...avisos.map(a => a.codigo)]);
    guardarVistos(hoy, todos);
    setVistos(todos);
  };

  return (
    <Popover onOpenChange={marcarVistos}>
      <PopoverTrigger asChild>
        <button
          type="button"
          title="Respuestas del día"
          className="fixed top-3 right-4 z-40 w-9 h-9 flex items-center justify-center rounded-full bg-white border border-slate-200 shadow-md text-slate-600 hover:bg-slate-50 focus:outline-none focus:ring-2 focus:ring-indigo-400"
        >
          <Bell className="w-4 h-4" />
          {sinVer > 0 && (
            <span className="absolute -top-1 -right-1 min-w-[18px] h-[18px] px-1 rounded-full bg-red-600 text-white text-[10px] font-black flex items-center justify-center">{sinVer}</span>
          )}
        </button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-[380px] max-w-[calc(100vw-2rem)] p-0">
        <div className="px-3 py-2 border-b text-[11px] font-black uppercase tracking-wide text-slate-600">Respuestas del día</div>
        {avisos.length === 0 ? (
          <p className="px-3 py-4 text-xs text-slate-500">Todavía no hay P2-VENTA ni respuestas P3 de hoy.</p>
        ) : (
          <ul className="max-h-[60vh] overflow-y-auto divide-y">
            {avisos.map(a => (
              <li key={a.codigo} className={`px-3 py-2 text-xs ${vistos.has(a.codigo) ? 'text-slate-600' : 'text-slate-900 font-semibold bg-indigo-50/50'}`}>{a.texto}</li>
            ))}
          </ul>
        )}
      </PopoverContent>
    </Popover>
  );
}
