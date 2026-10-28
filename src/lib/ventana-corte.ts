/**
 * Ventana del "día de corte" compartida por Corte Espuma (Sub-Bloques-T8) y Formulación (FERT).
 *
 * Usuario 2026-10-28: los dos módulos deben mostrar el MISMO universo de órdenes — Corte procesa las
 * FERT del día de corte y Formulación es la suma de lo que se está cortando (kg de bloque formulado),
 * así que el dato tiene que coincidir. La regla vive acá para que no se vuelva a separar:
 *  - D = día de corte (por defecto hoy + 1 hábil).
 *  - Colchones / Muebles: FERT con FECHAFIN = D (PT − 1).
 *  - Venta Externa: FERT con FECHAFIN = D + 1 hábil (su HALB va fechada al PT), así en D se cortan
 *    las dos para el mismo PT.
 *  - Solo FERT en firme; provisionales y el pendiente de días anteriores no entran (ese tiempo ya
 *    lo muestra la Capacidad Operativa como exceso del turno, usuario 2026-10-27).
 */
import { format } from 'date-fns';

export interface VentanaCorte {
  /** Día de corte D ('yyyy-MM-dd'). */
  d: string;
  /** FECHAFIN de las FERT de Venta Externa que se cortan en D (D + 1 hábil). */
  venta: string;
}

export const ventanaCorte = (diaCorte: string, siguienteDiaHabil: (d: Date) => Date): VentanaCorte => {
  const d = diaCorte || format(siguienteDiaHabil(new Date()), 'yyyy-MM-dd');
  return { d, venta: format(siguienteDiaHabil(new Date(`${d}T12:00:00`)), 'yyyy-MM-dd') };
};

/** Área de origen (cruce con el P2) que identifica a Venta Externa. */
export const esAreaVentaExterna = (area: string | undefined): boolean => /venta\s*externa/i.test(area || '');

/** ¿Una FERT con esta FECHAFIN ('yyyy-MM-dd') se corta en el día D de la ventana? */
export const fertEnVentanaCorte = (fechaFin: string, esVentaExterna: boolean, v: VentanaCorte): boolean =>
  fechaFin === (esVentaExterna ? v.venta : v.d);
