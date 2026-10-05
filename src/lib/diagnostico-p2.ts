// Diagnóstico de la recuperación de P2 (Corte Espuma / Corte y Laminado) para el panel de progreso:
// distingue "no hay ningún P2 activo" de "hay P2 activos pero con otra fecha" (el origen no generó el
// ciclo, o lo grabó con otra convención de fechas), que antes solo se veía en consola.
export interface DiagnosticoP2 {
  recuperacion: string;
  pt: string;
  // "#codigo valor (inicio → fin)" de cada P2 tomado / descartado por fecha. fin (yyyy-MM-dd) separa
  // los de ciclos ya pasados (siguen "A" porque el área de origen no los desactiva) de los que de
  // verdad chocan con el ciclo (vigentes o futuros con otra fecha).
  usados: string[];
  fuera: { texto: string; fin: string }[];
}

const ddmm = (fecha: string) => (/^\d{4}-\d{2}-\d{2}$/.test(fecha) ? `${fecha.slice(8, 10)}/${fecha.slice(5, 7)}` : fecha);

export const pasoPanelDiagnosticoP2 = (d: DiagnosticoP2 | null): { estado: 'ok' | 'aviso'; detalle?: string } => {
  if (!d) return { estado: 'ok' };
  const ciclo = `recuperación ${ddmm(d.recuperacion)} / PT ${ddmm(d.pt)}`;
  // Solo se listan los que chocan con el ciclo; los vencidos (fin antes de la recuperación) se
  // resumen en una cuenta y no levantan aviso — pedido del usuario 2026-10-05 (la lista era ruido).
  const enConflicto = d.fuera.filter(f => !f.fin || f.fin >= d.recuperacion);
  const vencidos = d.fuera.length - enConflicto.length;
  const fuera = (enConflicto.length > 0 ? ` Activos con otra fecha (no se toman): ${enConflicto.map(f => f.texto).join(' · ')}.` : '')
    + (vencidos > 0 ? ` ${vencidos} P2 de ciclos anteriores siguen activos (A) en BD; no se toman.` : '');
  if (d.usados.length === 0) {
    return {
      estado: 'aviso',
      detalle: enConflicto.length > 0 || vencidos > 0
        ? `Ningún P2 del ciclo (${ciclo}).${fuera}`
        : `Ningún P2 activo para este módulo (${ciclo}): el área de origen aún no lo genera.`,
    };
  }
  return { estado: enConflicto.length > 0 ? 'aviso' : 'ok', detalle: `P2 del ciclo (${ciclo}): ${d.usados.join(' · ')}.${fuera}` };
};
