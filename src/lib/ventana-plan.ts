import { addDays, format, getDay, isValid, parseISO } from 'date-fns';
import { es } from 'date-fns/locale';
import { fechaLocalEcuador } from '@/lib/dias-laborables';
import { horasSolapadas } from '@/lib/restriccionesCapacidad';

/**
 * Horas de una OT de mantenimiento dentro de la ventana del plan — regla única de Corte Espuma,
 * Laminado y Venta Externa (usuario 2026-10-09, con ejemplos):
 *  1. OT con HORA real (ej. 13/10 22:35 → 23:35): cuenta en el turno donde realmente cae — Día, Noche
 *     o Sábado — solo lo que solapa (tope: su duración). Ventana mar 13/10 21:00 → mié 14/10 15:45:
 *     esa OT es de la Noche del martes → descuenta 1 h; una de 14/10 11:35 → 12:35 cae en el Día.
 *  2. OT solo con FECHA (SISMAC programa por día a las 0:00, o la hora real no toca ningún turno):
 *     cuenta COMPLETA en el turno DÍA (o Sábado) de esa fecha — nunca en la Noche. Sábado o domingo
 *     sin turno pasa al lunes.
 * Devuelve las horas y el turno donde cuenta, o null si no cae en la ventana.
 */
export const mttoEnVentana = <T extends { turno: string; ini: Date; fin: Date }>(
  ot: { inicio: unknown; fin: unknown; fecha?: unknown; duracionH: number },
  turnos: T[],
): { horas: number; turno: T; conHora: boolean } | null => {
  const ini = new Date(String(ot.inicio ?? ''));
  const fin = new Date(String(ot.fin ?? ''));
  const conHora = isValid(ini) && format(ini, 'HH:mm') !== '00:00';
  if (conHora && isValid(fin) && fin > ini) {
    let mejor: { turno: T; horas: number } | null = null;
    let total = 0;
    turnos.forEach(t => {
      const h = horasSolapadas(ini, fin, t.ini, t.fin);
      total += h;
      if (h > 0 && (!mejor || h > mejor.horas)) mejor = { turno: t, horas: h };
    });
    if (mejor && total > 0) return { horas: ot.duracionH > 0 ? Math.min(ot.duracionH, total) : total, turno: (mejor as { turno: T }).turno, conHora: true };
  }
  // Por fecha: turno Día (o Sábado) de ese día, nunca la Noche.
  if (!(ot.duracionH > 0)) return null;
  const dia = fechaLocalEcuador(ot.fecha || ot.inicio);
  if (!dia) return null;
  const turnoDe = (d: string) => turnos.find(t => t.turno !== 'Noche' && format(t.ini, 'yyyy-MM-dd') === d) ?? null;
  let turno = turnoDe(dia);
  const wd = getDay(parseISO(dia));
  if (!turno && (wd === 6 || wd === 0)) turno = turnoDe(format(addDays(parseISO(dia), wd === 6 ? 2 : 1), 'yyyy-MM-dd'));
  return turno ? { horas: ot.duracionH, turno, conHora: false } : null;
};

// Ventana del plan de producción (Corte Espuma / Corte Laminado): desde la noche anterior hasta el
// fin del turno día del plan. Ver turnosVentanaMaquina (Espuma) y ventanaPlan (Laminado).

/** "VIE 02/10 19:00" — formato corto del inicio/fin de la ejecución del plan. */
export const fechaHoraEjecucion = (d: Date): string => format(d, 'EEE dd/MM HH:mm', { locale: es }).toUpperCase();

/**
 * Bloque del correo "EJECUCIÓN DEL PLAN DE PRODUCCIÓN — INICIO: VIE 02/10 19:00 ⇒ FIN: LUN 05/10 19:00",
 * sin reseña adicional (pedido del usuario 2026-10-02). Estilos inline: los clientes de correo
 * ignoran <style>.
 */
export const ejecucionPlanHtml = (inicio: Date, fin: Date): string => `
      <table role="presentation" cellpadding="0" cellspacing="0" style="margin:12px 0 0;border:1px solid #bfdbfe;border-radius:8px;background:#eff6ff;">
        <tr><td style="padding:8px 12px;">
          <p style="margin:0;font-size:9px;font-weight:700;letter-spacing:0.1em;text-transform:uppercase;color:#1d4ed8;">Ejecución del plan de producción</p>
          <p style="margin:3px 0 0;font-size:13px;font-weight:700;color:#111827;font-variant-numeric:tabular-nums;">INICIO: ${fechaHoraEjecucion(inicio)} &rArr; FIN: ${fechaHoraEjecucion(fin)}</p>
        </td></tr>
      </table>`;
