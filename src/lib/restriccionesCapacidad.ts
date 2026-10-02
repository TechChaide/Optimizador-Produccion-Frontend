import type { Restriccion } from '@/types/interfaces';

// Restricciones de capacidad por grupo (Parámetros → Grupos). Cada módulo las lee de SU grupo:
// Corte Espuma / Corte Laminado → grupo Corte y Laminado (8 = UIO, 16 = GYE), Venta Externa → su
// grupo, Formulación → el suyo. Los nombres se comparan normalizados (sin mayúsculas, acentos,
// espacios ni guiones bajos): "Paros _Planificados" y "PAROS_PLANIFICADOS" son la misma.
//   Rendimiento_Carruseles    → Corte Espuma, Carruseles
//   Rendimiento_Cnc           → Corte Espuma, Cortadora CNC
//   Rendimiento_Looper        → Corte Laminado (Laminado Cilíndrico)
//   Paros _Planificados       → % de paro de todos los turnos
//   HORAS_TRABAJO_DÍA         → horario por defecto del turno Día        (ej. "07:00 - 15:45")
//   HORAS_TRABAJO_NOCHE       → horario por defecto del turno Noche      (ej. "21:00 - 05:30")
//   HORAS_TRABAJO_FINDESEMANA → horario ofrecido para el Sábado (manual, arranca en VACÍO)
//   NUM_TURNOS                → 1 = solo Día, 2 = Día + Noche (3 = cadena de 3 turnos, ver jornada)
export const RESTRICCION_CAPACIDAD = {
  rendimientoCarruseles: 'Rendimiento_Carruseles',
  rendimientoCnc: 'Rendimiento_Cnc',
  rendimientoLooper: 'Rendimiento_Looper',
  parosPlanificados: 'Paros_Planificados',
  horasTrabajoDia: 'HORAS_TRABAJO_DIA',
  horasTrabajoNoche: 'HORAS_TRABAJO_NOCHE',
  horasTrabajoFinDeSemana: 'HORAS_TRABAJO_FINDESEMANA',
  numTurnos: 'NUM_TURNOS',
} as const;

const normalizar = (s: unknown) =>
  String(s ?? '').normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[\s_]/g, '').toUpperCase();

const buscarRestriccion = (restricciones: Restriccion[], codigoGrupo: number, nombre: string) => {
  const buscado = normalizar(nombre);
  return restricciones.find(x =>
    x.codigo_grupo === codigoGrupo &&
    x.estado === 'A' &&
    normalizar(x.nombre_restriccion) === buscado
  );
};

// Porcentaje (0–100) de una restricción activa del grupo, o null si no existe / no es válida.
// Acepta "13", "13%", "13,5" y también fracción "0.13" (se lleva a 13).
export const porcentajeRestriccion = (
  restricciones: Restriccion[],
  codigoGrupo: number,
  nombre: string,
): number | null => {
  const r = buscarRestriccion(restricciones, codigoGrupo, nombre);
  if (!r) return null;
  const n = Number(String(r.valor_restriccion ?? '').replace('%', '').replace(',', '.').trim());
  if (!Number.isFinite(n) || n < 0) return null;
  const pct = n > 0 && n < 1 ? n * 100 : n;
  return pct <= 100 ? pct : null;
};

// --- Turnos / jornada laboral ---

export interface OpcionTurno { v: string; l: string; h: number }
export interface Horario { l: string; h: number }

// Jornada estándar cuando el grupo no tiene la restricción HORAS_TRABAJO_* correspondiente.
export const HORARIO_ESTANDAR: Record<'dia' | 'noche' | 'finDeSemana', Horario> = {
  dia: { l: '07:00 - 15:45', h: 8.75 },
  noche: { l: '21:00 - 05:30', h: 8.5 },
  finDeSemana: { l: '07:00 - 13:00', h: 6 },
};

const minutos = (hhmm: string): number | null => {
  const m = /^(\d{1,2})[:.h](\d{2})$/.exec(hhmm.trim());
  if (!m) return null;
  const h = Number(m[1]); const mi = Number(m[2]);
  return h <= 24 && mi < 60 ? h * 60 + mi : null;
};
const hhmm = (min: number) => `${String(Math.floor(min / 60) % 24).padStart(2, '0')}:${String(min % 60).padStart(2, '0')}`;

// "07:00 - 15:45", "7:00-15:45", "07:00 a 15:45" → { l: "07:00 - 15:45", h: 8.75 }. Cruza la
// medianoche si el fin es menor al inicio ("21:00 - 05:30" → 8.5 h).
export const parseHorario = (valor: unknown): Horario | null => {
  const partes = String(valor ?? '').split(/\s*(?:hasta|al|a|-|–)\s*/i).filter(Boolean);
  if (partes.length !== 2) return null;
  const ini = minutos(partes[0]); const fin = minutos(partes[1]);
  if (ini === null || fin === null || ini === fin) return null;
  const dur = fin > ini ? fin - ini : fin + 24 * 60 - ini;
  return { l: `${hhmm(ini)} - ${hhmm(fin)}`, h: Math.round((dur / 60) * 100) / 100 };
};

export interface JornadaRestriccion {
  dia: Horario;
  noche: Horario;
  finDeSemana: Horario;
  // Turnos que arrancan precargados: 1 = Día, 2 = Día + Noche. Un valor 3 se conserva tal cual
  // para avisar en la UI: el tercer turno aún no tiene columna propia en los módulos.
  numTurnos: number;
  // Qué valores vinieron de una restricción (true) y cuáles son la jornada estándar (false).
  desdeRestriccion: { dia: boolean; noche: boolean; finDeSemana: boolean; numTurnos: boolean };
}

export const jornadaDesdeRestricciones = (restricciones: Restriccion[], codigoGrupo: number): JornadaRestriccion => {
  const horario = (nombre: string) => parseHorario(buscarRestriccion(restricciones, codigoGrupo, nombre)?.valor_restriccion);
  const dia = horario(RESTRICCION_CAPACIDAD.horasTrabajoDia);
  const noche = horario(RESTRICCION_CAPACIDAD.horasTrabajoNoche);
  const finDeSemana = horario(RESTRICCION_CAPACIDAD.horasTrabajoFinDeSemana);
  const nt = Math.trunc(Number(String(buscarRestriccion(restricciones, codigoGrupo, RESTRICCION_CAPACIDAD.numTurnos)?.valor_restriccion ?? '').trim()));
  const numTurnosValido = Number.isFinite(nt) && nt >= 1 && nt <= 3;
  return {
    dia: dia ?? HORARIO_ESTANDAR.dia,
    noche: noche ?? HORARIO_ESTANDAR.noche,
    finDeSemana: finDeSemana ?? HORARIO_ESTANDAR.finDeSemana,
    numTurnos: numTurnosValido ? nt : 2,
    desdeRestriccion: { dia: !!dia, noche: !!noche, finDeSemana: !!finDeSemana, numTurnos: numTurnosValido },
  };
};

// Catálogo de horarios del módulo + los horarios de la restricción que no estén ya en él, ordenado
// de VACÍO a la jornada más larga. Un horario que ya existe (mismo texto) reutiliza su clave.
export const opcionesConHorarios = (base: OpcionTurno[], horarios: Horario[]): OpcionTurno[] => {
  const opciones = [...base];
  horarios.forEach(hr => {
    if (!opciones.some(o => parseHorario(o.l)?.l === hr.l)) opciones.push({ v: hr.l, l: hr.l, h: hr.h });
  });
  return opciones.sort((a, b) => (a.v === 'EMPTY' ? -1 : b.v === 'EMPTY' ? 1 : a.h - b.h));
};

// Clave (v) de la opción que corresponde a un horario; 'EMPTY' si no está en el catálogo.
export const claveDeHorario = (opciones: OpcionTurno[], horario: Horario): string =>
  opciones.find(o => parseHorario(o.l)?.l === horario.l)?.v ?? 'EMPTY';
