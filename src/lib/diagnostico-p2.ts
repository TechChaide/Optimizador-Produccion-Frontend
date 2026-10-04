// Diagnóstico de la recuperación de P2 (Corte Espuma / Corte y Laminado) para el panel de progreso:
// distingue "no hay ningún P2 activo" de "hay P2 activos pero con otra fecha" (el origen no generó el
// ciclo, o lo grabó con otra convención de fechas), que antes solo se veía en consola.
export interface DiagnosticoP2 {
  recuperacion: string;
  pt: string;
  // "#codigo valor (inicio → fin)" de cada P2 tomado / descartado por fecha.
  usados: string[];
  fuera: string[];
}

const ddmm = (fecha: string) => (/^\d{4}-\d{2}-\d{2}$/.test(fecha) ? `${fecha.slice(8, 10)}/${fecha.slice(5, 7)}` : fecha);

export const pasoPanelDiagnosticoP2 = (d: DiagnosticoP2 | null): { estado: 'ok' | 'aviso'; detalle?: string } => {
  if (!d) return { estado: 'ok' };
  const ciclo = `recuperación ${ddmm(d.recuperacion)} / PT ${ddmm(d.pt)}`;
  const fuera = d.fuera.length > 0 ? ` Activos con otra fecha (no se toman): ${d.fuera.join(' · ')}.` : '';
  if (d.usados.length === 0) {
    return {
      estado: 'aviso',
      detalle: d.fuera.length > 0
        ? `Ningún P2 del ciclo (${ciclo}).${fuera}`
        : `Ningún P2 activo para este módulo (${ciclo}): el área de origen aún no lo genera.`,
    };
  }
  return { estado: d.fuera.length > 0 ? 'aviso' : 'ok', detalle: `P2 del ciclo (${ciclo}): ${d.usados.join(' · ')}.${fuera}` };
};
