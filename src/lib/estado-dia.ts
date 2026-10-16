/**
 * Estado del día del flujo en dos etapas (usuario 2026-10-12, ver [[flujo-dos-etapas]]): qué planes del
 * ciclo de hoy ya existen en Plan Grupo y qué reportes ya se guardaron/enviaron, para que cada módulo
 * muestre al abrirse en qué paso va TODA la cadena (VE → Laminado → Corte Espuma), en vez de cargar el
 * último reporte guardado. Solo lectura: Plan Grupo (tabla chica) + metadatos de la carpeta de reportes.
 */
import type { PlanGrupo } from '@/types/interfaces';
import { fechaLocalPlana } from '@/lib/dias-laborables';
import { consultarPlanTxt, type ModuloPlanTxt, type CentroPlanTxt } from '@/lib/planes-txt';

export type EtapaFlujo = 1 | 2;
export type EstadoHito = 'hecho' | 'pendiente' | 'enviado';

export interface HitoDia {
  id: string;
  etapa: EtapaFlujo;
  modulo: 'Venta Externa' | 'Laminado' | 'Corte Espuma';
  etiqueta: string;
  estado: EstadoHito;
  /** "#1123 09:40" o "guardado 10:15" — vacío si pendiente. */
  detalle: string;
}

const fecha = (v: unknown) => {
  const s = String(v ?? '').trim();
  return !s || s === 'null' ? '' : fechaLocalPlana(s);
};
// fecha_creacion se graba "naive Ecuador" (ecuadorNowNaiveISO): la hora literal es la del string.
const hora = (v: unknown) => String(v ?? '').match(/T(\d{2}:\d{2})/)?.[1] ?? '';

/** Planes ACTIVOS creados hoy cuyo valor cumple la expresión. */
const creadosHoy = (planes: PlanGrupo[], hoy: string, re: RegExp, excluir?: RegExp) => planes
  .filter(p => p.estado === 'A' && fecha(p.fecha_creacion) === hoy && re.test(String(p.valor || '')) && !(excluir && excluir.test(String(p.valor || ''))))
  .sort((a, b) => a.codigo_plan_grupo - b.codigo_plan_grupo);

const hitoPlanes = (id: string, etapa: EtapaFlujo, modulo: HitoDia['modulo'], etiqueta: string, encontrados: PlanGrupo[]): HitoDia => ({
  id, etapa, modulo, etiqueta,
  estado: encontrados.length > 0 ? 'hecho' : 'pendiente',
  detalle: encontrados.map(p => `#${p.codigo_plan_grupo}${hora(p.fecha_creacion) ? ` ${hora(p.fecha_creacion)}` : ''}`).join(' · '),
});

// Planes de cada hito, por el texto de su valor en Plan Grupo. Única definición: la usan las ✓ de las
// pestañas-paso (hitosDePlanes) y el aviso de respuestas del encabezado (respuestasDelDia).
const DEF_HITOS_PLANES: { id: string; etapa: EtapaFlujo; modulo: HitoDia['modulo']; etiqueta: string; re: RegExp; excluir?: RegExp }[] = [
  { id: 've-p2', etapa: 1, modulo: 'Venta Externa', etiqueta: 'P2 Espumas/Rollos', re: /p2\s*-\s*venta/i, excluir: /diferido/i },
  { id: 'lam-p3', etapa: 1, modulo: 'Laminado', etiqueta: 'P3 Rollos', re: /\bp3\b.*rollo/i },
  { id: 'ce-p3-1000', etapa: 1, modulo: 'Corte Espuma', etiqueta: 'P3 Quito', re: /centro\s*1000.*\bp3\b.*espuma/i },
  { id: 'ce-p3-2000', etapa: 1, modulo: 'Corte Espuma', etiqueta: 'P3 Guayaquil', re: /centro\s*2000.*\bp3\b.*espuma/i },
  { id: 've-pfd', etapa: 2, modulo: 'Venta Externa', etiqueta: 'PFD-VENTA', re: /pfd-venta/i },
];

/** Hitos de planes (etapa 1 y PFD-VENTA de la etapa 2) a partir de Plan Grupo. */
export const hitosDePlanes = (planes: PlanGrupo[], hoy: string): HitoDia[] =>
  DEF_HITOS_PLANES.map(d => hitoPlanes(d.id, d.etapa, d.modulo, d.etiqueta, creadosHoy(planes, hoy, d.re, d.excluir)));

/** Respuesta del día que habilita al siguiente proceso: P2-VENTA, P3 Rollos y P3 Corte Espuma (no PFD). */
export interface RespuestaDia { id: string; modulo: HitoDia['modulo']; etiqueta: string; plan: PlanGrupo; hora: string }

/** Planes de respuesta creados hoy (activos), uno por plan, del más antiguo al más reciente. */
export const respuestasDelDia = (planes: PlanGrupo[], hoy: string): RespuestaDia[] =>
  DEF_HITOS_PLANES.filter(d => d.etapa === 1).flatMap(d =>
    creadosHoy(planes, hoy, d.re, d.excluir).map(p => ({ id: d.id, modulo: d.modulo, etiqueta: d.etiqueta, plan: p, hora: hora(p.fecha_creacion) })));

const REPORTES: { id: string; modulo: HitoDia['modulo']; etiqueta: string; carpeta: ModuloPlanTxt; centro: CentroPlanTxt }[] = [
  { id: 'lam-rep', modulo: 'Laminado', etiqueta: 'Reporte', carpeta: 'laminado', centro: '1000' },
  { id: 've-rep-1000', modulo: 'Venta Externa', etiqueta: 'Reporte Empaque 1000', carpeta: 'venta-espuma', centro: '1000' },
  { id: 've-rep-2000', modulo: 'Venta Externa', etiqueta: 'Reporte Empaque 2000', carpeta: 'venta-espuma', centro: '2000' },
  { id: 'ce-rep-1000', modulo: 'Corte Espuma', etiqueta: 'Reporte Quito', carpeta: 'corte-espuma', centro: '1000' },
  { id: 'ce-rep-2000', modulo: 'Corte Espuma', etiqueta: 'Reporte Guayaquil', carpeta: 'corte-espuma', centro: '2000' },
];

/**
 * Hitos de reportes de la etapa 2: un reporte guardado HOY (cualquier fecha objetivo de hoy a hoy+4).
 * "enviado" = ya no tiene foto del correo (se borra al enviar bien, ver eliminarFotoCorreoPlanTxt).
 * Si la carpeta no responde, el hito queda pendiente sin bloquear nada.
 */
export const hitosDeReportes = async (hoy: string): Promise<HitoDia[]> => {
  const base = new Date(`${hoy}T12:00:00`);
  const fechas = Array.from({ length: 5 }, (_, i) => {
    const d = new Date(base.getFullYear(), base.getMonth(), base.getDate() + i);
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  });
  return Promise.all(REPORTES.map(async r => {
    const metas = await Promise.all(fechas.map(f => consultarPlanTxt({ modulo: r.carpeta, centro: r.centro, fechaObjetivo: f }).catch(() => null)));
    const deHoy = metas
      .filter((m): m is NonNullable<typeof m> => !!m && fechaLocalPlana(new Date(m.modificado)) === hoy)
      .sort((a, b) => b.modificado.localeCompare(a.modificado))[0];
    const horaGuardado = deHoy ? new Date(deHoy.modificado).toLocaleTimeString('es-EC', { hour: '2-digit', minute: '2-digit', hour12: false, timeZone: 'America/Guayaquil' }) : '';
    const enviado = !!deHoy && deHoy.fotoCorreo === false;
    return {
      id: r.id, etapa: 2 as const, modulo: r.modulo, etiqueta: r.etiqueta,
      estado: !deHoy ? 'pendiente' as const : enviado ? 'enviado' as const : 'hecho' as const,
      detalle: !deHoy ? '' : enviado ? `enviado (guardado ${horaGuardado})` : `guardado ${horaGuardado}, sin enviar`,
    };
  }));
};
