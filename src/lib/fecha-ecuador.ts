/**
 * Fechas en hora de ECUADOR (UTC−5, sin horario de verano).
 *
 * Toda la app planifica sobre días calendario de planta ecuatoriana, así que "qué día es" debe
 * resolverse SIEMPRE en hora local, nunca en UTC.
 *
 * El error a evitar es `date.toISOString().split('T')[0]`: convierte a UTC y, como Ecuador va 5
 * horas atrás, cualquier hora local desde las 19:00 ya cae en el día SIGUIENTE en UTC y la fecha
 * se corre un día. Con turno nocturno (21:00–05:30) eso ocurre todas las noches, y también en
 * cualquier proceso que corra de tarde/noche (importaciones, guardado de planes, exportaciones).
 *
 * Ejemplo del desfase:
 *   local  2026-08-13 19:30  →  UTC 2026-08-14 00:30  →  toISOString() = "2026-08-14"  ✗
 *                                                        toFechaEcuador() = "2026-08-13"  ✓
 */

/** Fecha calendario 'YYYY-MM-DD' en hora de Ecuador. Acepta Date o algo parseable a Date. */
export function toFechaEcuador(fecha: Date | string | number): string {
  const d = fecha instanceof Date ? fecha : new Date(fecha);
  if (isNaN(d.getTime())) return '';
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

/** Hoy en hora de Ecuador, como 'YYYY-MM-DD'. */
export function getFechaEcuadorHoy(): string {
  return toFechaEcuador(new Date());
}

/** Mes calendario 'YYYY-MM' en hora de Ecuador (para agrupaciones mensuales). */
export function toMesEcuador(fecha: Date | string | number): string {
  return toFechaEcuador(fecha).slice(0, 7);
}

/**
 * 'YYYY-MM-DDTHH:mm' en hora de Ecuador, para inputs `datetime-local`.
 * `toISOString().slice(0,16)` mostraría la hora en UTC (5 h adelantada) dentro del input.
 */
export function toFechaHoraEcuador(fecha: Date | string | number): string {
  const d = fecha instanceof Date ? fecha : new Date(fecha);
  if (isNaN(d.getTime())) return '';
  return `${toFechaEcuador(d)}T${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
}
