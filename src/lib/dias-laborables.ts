import { format } from 'date-fns';
import { detalleCalendarioService } from '@/services/detallecalendario.service';

/**
 * Días hábiles para la programación táctica.
 *
 * Hasta ahora "día hábil" era simplemente "no es sábado ni domingo", así que un P2 fechado el
 * siguiente día laborable podía caer en un feriado o en un día que la planta decidió no trabajar, y
 * la fecha quedaba mal sin que nada lo advirtiera. Estas funciones agregan un segundo criterio: un
 * conjunto de fechas 'yyyy-MM-dd' declaradas NO laborables.
 *
 * La fuente de esas fechas es el calendario que ya existe en la app (Configuraciones → Calendario
 * Área: `detalle_calendario` + `tipo_detalle`), no una lista fija de feriados nacionales — así cubre
 * tanto los feriados como los días que "por a o b circunstancia" no se trabaja, que es justamente lo
 * que no se puede saber de antemano.
 *
 * Si el calendario está vacío, el conjunto viene vacío y el comportamiento es idéntico al de antes
 * (solo se saltan fines de semana). Nunca inventa feriados.
 */
export type DiasNoLaborables = ReadonlySet<string>;

export const SIN_DIAS_NO_LABORABLES: DiasNoLaborables = new Set<string>();

/** Nombre del tipo de detalle que marca un día como no trabajado (ver tabla `tipo_detalle`). */
const TIPO_NO_LABORABLE = /feriado|no\s*laborab|no\s*trabaj/i;

/** Tipo de detalle que declara que ese día SÍ se trabaja — permite anular un feriado nacional. */
const TIPO_LABORABLE = /jornada/i;

/**
 * Feriados nacionales de Ecuador. Son línea base, no un supuesto: están fijados por ley (Código del
 * Trabajo, art. 65) y no dependen de la configuración de la planta. El calendario de la app puede
 * AGREGAR días encima (paros, mantenimientos, inventarios) y también ANULAR uno de estos marcándolo
 * con un tipo "Jornada…", para el caso en que la planta decida trabajar un feriado.
 *
 * Motivo de existir: el P2 del 07-ago-2026 (viernes) se fechó al "siguiente día hábil" = lunes
 * 10-ago, que es feriado nacional. El calendario interno estaba vacío, así que nada lo advirtió.
 *
 * NO se incluyen los feriados LOCALES (6-dic Fundación de Quito, 25-jul Fundación de Guayaquil):
 * aplican a una ciudad y no a la otra, y este cálculo hoy no distingue centro. Si hacen falta, van
 * cargados en el calendario de la app.
 */
const FERIADOS_FIJOS_EC: [number, number][] = [
  [1, 1],   // Año Nuevo
  [5, 1],   // Día del Trabajo
  [5, 24],  // Batalla del Pichincha
  [8, 10],  // Primer Grito de Independencia
  [10, 9],  // Independencia de Guayaquil
  [11, 2],  // Día de los Difuntos
  [11, 3],  // Independencia de Cuenca
  [12, 25], // Navidad
];

/** Domingo de Pascua (algoritmo de Meeus/Jones/Butcher) — base de Carnaval y Viernes Santo. */
const domingoDePascua = (anio: number): Date => {
  const a = anio % 19;
  const b = Math.floor(anio / 100);
  const c = anio % 100;
  const d = Math.floor(b / 4);
  const e = b % 4;
  const f = Math.floor((b + 8) / 25);
  const g = Math.floor((b - f + 1) / 3);
  const h = (19 * a + b - d - g + 15) % 30;
  const i = Math.floor(c / 4);
  const k = c % 4;
  const l = (32 + 2 * e + 2 * i - h - k) % 7;
  const m = Math.floor((a + 11 * h + 22 * l) / 451);
  const mes = Math.floor((h + l - 7 * m + 114) / 31);
  const dia = ((h + l - 7 * m + 114) % 31) + 1;
  return new Date(anio, mes - 1, dia);
};

/** Feriados nacionales de Ecuador de un año, como fechas 'yyyy-MM-dd'. */
export const feriadosNacionales = (anio: number): string[] => {
  const fechas = FERIADOS_FIJOS_EC.map(([mes, dia]) => format(new Date(anio, mes - 1, dia), 'yyyy-MM-dd'));
  const pascua = domingoDePascua(anio);
  const desdePascua = (dias: number) => {
    const d = new Date(pascua);
    d.setDate(d.getDate() + dias);
    return format(d, 'yyyy-MM-dd');
  };
  // Carnaval en Ecuador es LUNES y MARTES previos al miércoles de ceniza (-48 y -47 desde Pascua);
  // Viernes Santo es -2.
  fechas.push(desdePascua(-48), desdePascua(-47), desdePascua(-2));
  return fechas;
};

export const esFinDeSemana = (d: Date): boolean => {
  const dia = d.getDay();
  return dia === 0 || dia === 6;
};

export const esDiaNoLaborable = (d: Date, feriados: DiasNoLaborables = SIN_DIAS_NO_LABORABLES): boolean =>
  esFinDeSemana(d) || feriados.has(format(d, 'yyyy-MM-dd'));

/**
 * Próximo día laborable a partir de una fecha: avanza un día y sigue avanzando mientras caiga en
 * fin de semana o en un día no laborable. Siempre avanza al menos un día (nunca devuelve `from`).
 */
export const nextBusinessDay = (from: Date, feriados: DiasNoLaborables = SIN_DIAS_NO_LABORABLES): Date => {
  const d = new Date(from);
  d.setDate(d.getDate() + 1);
  // Tope de seguridad: si alguien declarara un año entero como no laborable, esto corta en vez de
  // colgar el navegador en un while infinito.
  let guardia = 0;
  while (esDiaNoLaborable(d, feriados) && guardia < 366) {
    d.setDate(d.getDate() + 1);
    guardia++;
  }
  return d;
};

/**
 * Día laborable anterior a una fecha: retrocede un día y sigue retrocediendo mientras caiga en fin
 * de semana o en un día no laborable. Simétrico a nextBusinessDay. Siempre retrocede al menos un día.
 */
export const previousBusinessDay = (from: Date, feriados: DiasNoLaborables = SIN_DIAS_NO_LABORABLES): Date => {
  const d = new Date(from);
  d.setDate(d.getDate() - 1);
  let guardia = 0;
  while (esDiaNoLaborable(d, feriados) && guardia < 366) {
    d.setDate(d.getDate() - 1);
    guardia++;
  }
  return d;
};

/**
 * Suma (o resta, con N negativo) N días HÁBILES. No equivale a encadenar nextBusinessDay sobre el
 * resultado anterior desde fuera: hay que aplicarlo N veces sobre la misma fecha que va avanzando
 * (encadenarlo mal, por ejemplo llamándolo dos veces sobre "hoy", da +3 en viernes en vez de +2).
 */
export const addBusinessDays = (from: Date, n: number, feriados: DiasNoLaborables = SIN_DIAS_NO_LABORABLES): Date => {
  let d = new Date(from);
  const paso = n < 0 ? previousBusinessDay : nextBusinessDay;
  for (let i = 0; i < Math.abs(n); i++) d = paso(d, feriados);
  return d;
};

/**
 * Carga las fechas no laborables desde el calendario configurado en la app. Devuelve un Set de
 * 'yyyy-MM-dd'. Ante cualquier error devuelve un Set vacío: quedarse sin feriados degrada a la
 * conducta anterior (solo fines de semana), que es preferible a romper el cálculo de fechas.
 */
export const cargarDiasNoLaborables = async (): Promise<Set<string>> => {
  // 1) Línea base: feriados nacionales del año en curso y del siguiente (para que un cálculo hecho
  //    en diciembre no se quede sin los de enero).
  const anio = new Date().getFullYear();
  const fechas = new Set<string>([...feriadosNacionales(anio), ...feriadosNacionales(anio + 1)]);

  // 2) Encima, el calendario configurado en la app: puede agregar días no trabajados (paros,
  //    mantenimientos, inventarios) y también anular un feriado si ese día se declara como jornada.
  try {
    const res = await detalleCalendarioService.getAll();
    const fechasDeDetalle = (det: (typeof res.data)[number]): string[] => {
      // Un detalle puede cubrir un rango (fecha_inicio..fecha_fin) o un solo día (fecha_real).
      const inicio = det.fecha_inicio || det.fecha_real;
      const fin = det.fecha_fin || det.fecha_real || inicio;
      if (!inicio) return [];
      const d = new Date(inicio);
      const hasta = new Date(fin);
      if (isNaN(d.getTime()) || isNaN(hasta.getTime())) return [];
      const out: string[] = [];
      let guardia = 0;
      while (d <= hasta && guardia < 366) {
        out.push(format(d, 'yyyy-MM-dd'));
        d.setDate(d.getDate() + 1);
        guardia++;
      }
      return out;
    };

    (res.data || []).forEach(det => {
      if (det.estado !== 'A') return;
      const nombreTipo = det.tipo_detalle?.nombre_tipo_detalle || '';
      // El nombre del propio detalle también cuenta: un día puede declararse no laborable sin que
      // exista un tipo dedicado para el motivo puntual (mantenimiento, paro, inventario…).
      const esNoLaborable = TIPO_NO_LABORABLE.test(nombreTipo) || TIPO_NO_LABORABLE.test(det.nombre_detalle || '');
      const esLaborable = !esNoLaborable && TIPO_LABORABLE.test(nombreTipo);
      if (!esNoLaborable && !esLaborable) return;

      fechasDeDetalle(det).forEach(f => {
        if (esNoLaborable) fechas.add(f);
        else fechas.delete(f); // jornada declarada: ese día SÍ se trabaja, aunque sea feriado
      });
    });
  } catch (e) {
    console.warn('[dias-laborables] No se pudo cargar el calendario configurado; quedan solo los feriados nacionales:', (e as Error).message);
  }
  return fechas;
};

/**
 * Zona horaria del negocio (Ecuador). UTC-5 fijo, sin horario de verano.
 *
 * Por qué existe: la API guarda `fecha_inicio_plan`/`fecha_fin_plan` como timestamp UTC. Leer solo
 * la parte de fecha del ISO (`String(fecha).split('T')[0]`) es correcto SOLO si la hora local cae
 * antes de las 19:00 — de ahí en adelante (19:00 local + 5h = 00:00 UTC) el timestamp UTC ya cruzó a
 * la calendar date SIGUIENTE, y ese recorte devuelve un día que en Ecuador todavía no ha llegado.
 *
 * Caso real que lo destapó: un P1 grabado a las 17:00 ("17/8/2026 17:00" hora Ecuador) quedó en UTC
 * como "2026-08-17T22:00:00Z" — el recorte ingenuo daba 17-ago, coincidencia. El PFF que lo
 * reemplazó, grabado más tarde el mismo día a las 22:00, quedó en UTC como
 * "2026-08-18T03:00:00Z" — el recorte ingenuo daba **18-ago**, un día de más, y el PFF recién creado
 * dejaba de coincidir con la ventana de fecha esperada (hoy+3 días hábiles), mostrando "no hay ningún
 * Plan Grupo P1/PFF activo" pese a que el plan correcto sí existía y estaba activo.
 */
const ZONA_HORARIA_NEGOCIO = 'America/Guayaquil';

/**
 * Fecha calendario 'yyyy-MM-dd' de un timestamp, en hora de Ecuador — no en UTC ni en la zona
 * horaria del navegador/servidor donde corre el código. Úsese para comparar `fecha_inicio_plan`/
 * `fecha_fin_plan` (vienen en UTC de la API) contra una fecha objetivo calculada localmente.
 *
 * Seguro también con fechas PLANAS sin hora (ej. Provisionales `FECHAINICIO: "2026-08-11"`): esas se
 * devuelven tal cual, sin conversión — convertirlas igual las correría un día hacia atrás. Por eso
 * es un reemplazo directo tanto de `String(v).split('T')[0]` como del `soloFecha` que ya existía en
 * Corte y Laminado.
 */
export const fechaLocalEcuador = (v: unknown): string => {
  if (v === null || v === undefined || v === '') return '';
  if (v instanceof Date) {
    if (isNaN(v.getTime())) return '';
    return new Intl.DateTimeFormat('en-CA', { timeZone: ZONA_HORARIA_NEGOCIO, year: 'numeric', month: '2-digit', day: '2-digit' }).format(v);
  }
  const s = String(v).trim();
  // Sin componente de hora ('T'): es una fecha PLANA (ej. Provisionales `FECHAINICIO: "2026-08-11"`),
  // no un instante en el tiempo — no hay nada que convertir de zona horaria. Convertirla igual la
  // correría un día hacia atrás por error: `new Date('2026-08-11')` se interpreta como medianoche
  // UTC, y medianoche UTC cae en el día ANTERIOR en Ecuador (UTC-5). Se devuelve tal cual.
  if (!s.includes('T')) return s.slice(0, 10);
  const d = new Date(s);
  if (isNaN(d.getTime())) return '';
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: ZONA_HORARIA_NEGOCIO,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(d);
};
