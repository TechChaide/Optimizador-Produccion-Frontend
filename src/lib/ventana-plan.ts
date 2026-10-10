import { addDays, format, getDay, parseISO } from 'date-fns';
import { es } from 'date-fns/locale';
import { fechaLocalEcuador } from '@/lib/dias-laborables';

/**
 * Turno donde se descuenta una OT de mantenimiento (regla del usuario 2026-10-09, para Corte Espuma,
 * Laminado y Venta Externa): SISMAC carga el mantenimiento con fecha/hora y SIEMPRE lo ejecuta en el
 * turno DÍA de esa fecha (o el Sábado, si ese día es sábado con turno) — nunca en la Noche, aunque la
 * hora caiga de noche. Una OT de sábado o domingo sin turno pasa al lunes (como ya hacía Laminado).
 * Devuelve el turno de la ventana del plan en que cuenta COMPLETA, o null si ese día no está en la
 * ventana (ej. la noche del plan es del día anterior: su mantenimiento es de ese día, no del plan).
 */
export const turnoDiaMtto = <T extends { turno: string; ini: Date }>(fechaOT: unknown, turnos: T[]): T | null => {
  const dia = fechaLocalEcuador(fechaOT);
  if (!dia) return null;
  const turnoDe = (d: string) => turnos.find(t => t.turno !== 'Noche' && format(t.ini, 'yyyy-MM-dd') === d) ?? null;
  const turno = turnoDe(dia);
  if (turno) return turno;
  const wd = getDay(parseISO(dia));
  return wd === 6 || wd === 0 ? turnoDe(format(addDays(parseISO(dia), wd === 6 ? 2 : 1), 'yyyy-MM-dd')) : null;
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
