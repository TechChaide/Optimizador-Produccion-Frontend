/**
 * Fechas en hora de ECUADOR (UTC−5, sin horario de verano).
 *
 * Toda la app planifica sobre días calendario de planta ecuatoriana, así que "qué día es" debe
 * resolverse SIEMPRE en hora de Ecuador, nunca en UTC ni en la hora local de la máquina que corre
 * el código.
 *
 * El error a evitar es `date.toISOString().split('T')[0]`: convierte a UTC y, como Ecuador va 5
 * horas atrás, cualquier hora local desde las 19:00 ya cae en el día SIGUIENTE en UTC y la fecha
 * se corre un día. Con turno nocturno (21:00–05:30) eso ocurre todas las noches, y también en
 * cualquier proceso que corra de tarde/noche (importaciones, guardado de planes, exportaciones).
 *
 * Ejemplo del desfase:
 *   local  2026-08-13 19:30  →  UTC 2026-08-14 00:30  →  toISOString() = "2026-08-14"  ✗
 *                                                        toFechaEcuador() = "2026-08-13"  ✓
 *
 * El error MÁS SUTIL — el que realmente causó fechas guardadas un día adelante pese a usar este
 * archivo — es usar `d.getFullYear()/getMonth()/getDate()` (versión anterior de este helper): esos
 * métodos NO son "hora de Ecuador", son la hora local del SISTEMA OPERATIVO que ejecuta el código.
 * En el navegador del usuario normalmente coincide, pero basta que el reloj de Windows tenga mal
 * configurado el huso horario (o que el proceso corra en un servidor/CI en UTC u otra zona) para
 * que "hoy" salga corrido, sin que haya forma de notarlo desde el código que lo consume. Por eso
 * TODAS las funciones de este archivo fijan expresamente `timeZone: 'America/Guayaquil'` vía
 * `Intl.DateTimeFormat` — el resultado es el mismo sin importar en qué huso esté configurada la
 * máquina que ejecuta el código.
 */

const ECUADOR_TZ = 'America/Guayaquil';

const ecuadorParts = (fecha: Date): Record<string, string> => {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: ECUADOR_TZ,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
  }).formatToParts(fecha);
  const out: Record<string, string> = {};
  parts.forEach(p => { out[p.type] = p.value; });
  return out;
};

/** Fecha calendario 'YYYY-MM-DD' en hora de Ecuador. Acepta Date o algo parseable a Date. */
export function toFechaEcuador(fecha: Date | string | number): string {
  const d = fecha instanceof Date ? fecha : new Date(fecha);
  if (isNaN(d.getTime())) return '';
  const p = ecuadorParts(d);
  return `${p.year}-${p.month}-${p.day}`;
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
 * 'YYYY-MM-DDT00:00:00' — medianoche SIN zona horaria (sin 'Z' ni offset), para guardar fechas de
 * PLAN (fecha_inicio_plan/fecha_fin_plan: día calendario, sin hora) como datetime2 en el backend.
 *
 * Nunca uses `new Date(fecha)` + JSON.stringify para esto: un objeto Date siempre serializa vía
 * `.toISOString()`, que agrega "Z" (UTC). El backend puede reinterpretar esa "Z" convirtiéndola a
 * la zona del servidor, corriendo la fecha un día — el mismo desfase documentado arriba, pero al
 * GUARDAR en vez de al leer. Mandando un string "naive" (sin Z), SQL Server datetime2 lo guarda
 * literal, sin ninguna conversión — no importa en qué huso esté corriendo el navegador o el
 * servidor. Al leerlo de vuelta, `new Date('...T00:00:00')` (sin Z) también se interpreta en hora
 * LOCAL en JS, así que `toFechaEcuador` sobre ese valor devuelve el mismo día calendario que se
 * guardó, sin importar el huso del entorno.
 */
export function toDatetime2Medianoche(fechaYYYYMMDD: string): string {
  return `${fechaYYYYMMDD}T00:00:00`;
}

/**
 * 'YYYY-MM-DDTHH:mm' en hora de Ecuador, para inputs `datetime-local`.
 * `toISOString().slice(0,16)` mostraría la hora en UTC (5 h adelantada) dentro del input.
 */
export function toFechaHoraEcuador(fecha: Date | string | number): string {
  const d = fecha instanceof Date ? fecha : new Date(fecha);
  if (isNaN(d.getTime())) return '';
  const p = ecuadorParts(d);
  return `${p.year}-${p.month}-${p.day}T${p.hour}:${p.minute}`;
}
