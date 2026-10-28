/**
 * Estado del día del flujo en dos etapas (usuario 2026-10-12, ver [[flujo-dos-etapas]]): qué planes del
 * ciclo de hoy ya existen en Plan Grupo y qué reportes ya se guardaron/enviaron, para que cada módulo
 * muestre al abrirse en qué paso va TODA la cadena (VE → Laminado → Corte Espuma), en vez de cargar el
 * último reporte guardado. Solo lectura: Plan Grupo (tabla chica) + metadatos de la carpeta de reportes.
 */
import type { PlanGrupo } from '@/types/interfaces';
import { fechaLocalPlana, fechaHoraCreacionPlanGrupo } from '@/lib/dias-laborables';
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

// fecha_creacion vuelve de la API corrida +5h (ver fechaHoraCreacionPlanGrupo): antes se tomaba la
// hora literal del string y Data Aprobada mostraba 15:35 para un P2 grabado a las 10:35.
const fecha = (v: unknown) => fechaHoraCreacionPlanGrupo(v).fecha;
const hora = (v: unknown) => fechaHoraCreacionPlanGrupo(v).hora;

/** Planes ACTIVOS creados hoy cuyo valor cumple la expresión. */
const creadosHoy = (planes: PlanGrupo[], hoy: string, re: RegExp, excluir?: RegExp) => planes
  .filter(p => p.estado === 'A' && fecha(p.fecha_creacion) === hoy && re.test(String(p.valor || '')) && !(excluir && excluir.test(String(p.valor || ''))))
  .sort((a, b) => a.codigo_plan_grupo - b.codigo_plan_grupo);

const hitoPlanes = (id: string, etapa: EtapaFlujo, modulo: HitoDia['modulo'], etiqueta: string, encontrados: PlanGrupo[]): HitoDia => ({
  id, etapa, modulo, etiqueta,
  estado: encontrados.length > 0 ? 'hecho' : 'pendiente',
  detalle: encontrados.map(p => `#${p.codigo_plan_grupo}${hora(p.fecha_creacion) ? ` ${hora(p.fecha_creacion)}` : ''}`).join(' · '),
});

/** Hitos de planes (etapa 1 y PFD-VENTA de la etapa 2) a partir de Plan Grupo. */
export const hitosDePlanes = (planes: PlanGrupo[], hoy: string): HitoDia[] => [
  hitoPlanes('ve-p2', 1, 'Venta Externa', 'P2 Espumas/Rollos', creadosHoy(planes, hoy, /p2\s*-\s*venta/i, /diferido/i)),
  hitoPlanes('lam-p3', 1, 'Laminado', 'P3 Rollos', creadosHoy(planes, hoy, /\bp3\b.*rollo/i)),
  hitoPlanes('ce-p3-1000', 1, 'Corte Espuma', 'P3 Quito', creadosHoy(planes, hoy, /centro\s*1000.*\bp3\b.*espuma/i)),
  hitoPlanes('ce-p3-2000', 1, 'Corte Espuma', 'P3 Guayaquil', creadosHoy(planes, hoy, /centro\s*2000.*\bp3\b.*espuma/i)),
  hitoPlanes('ve-pfd', 2, 'Venta Externa', 'PFD-VENTA', creadosHoy(planes, hoy, /pfd-venta/i)),
];

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
