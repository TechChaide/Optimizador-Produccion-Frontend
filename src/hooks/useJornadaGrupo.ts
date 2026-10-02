import { useEffect, useMemo, useRef, useState } from 'react';
import type { Restriccion } from '@/types/interfaces';
import {
  claveDeHorario,
  jornadaDesdeRestricciones,
  opcionesConHorarios,
  porcentajeRestriccion,
  RESTRICCION_CAPACIDAD,
  type OpcionTurno,
} from '@/lib/restriccionesCapacidad';

// Catálogo base de horarios — el mismo que usan Corte Espuma, Corte Laminado y Venta Externa.
const DIA_BASE: OpcionTurno[] = [
  { v: 'EMPTY', l: 'VACÍO', h: 0 },
  { v: 'H1', l: '07:00 - 15:45', h: 8.75 },
  { v: 'H2', l: '07:00 - 17:00', h: 10 },
  { v: 'H3', l: '07:00 - 18:00', h: 11 },
  { v: 'H4', l: '07:00 - 19:00', h: 12 },
  { v: 'H5', l: '07:00 - 13:00', h: 6 },
];
const NOCHE_BASE: OpcionTurno[] = [
  { v: 'EMPTY', l: 'VACÍO', h: 0 },
  { v: 'A19', l: '19:00 - 05:30', h: 10.5 },
  { v: 'B21', l: '21:00 - 05:30', h: 8.5 },
];

export interface JornadaGrupoEditable {
  opcionesDia: OpcionTurno[];
  opcionesNoche: OpcionTurno[];
  dia: string; setDia: (v: string) => void;
  noche: string; setNoche: (v: string) => void;
  sabado: string; setSabado: (v: string) => void;
  paroPct: number; setParoPct: (v: number) => void;
  horasBrutas: { dia: number; noche: number; sabado: number; total: number };
  horasEfectivas: { dia: number; noche: number; sabado: number; total: number };
  numTurnos: number;
}

// Turnos editables de un módulo con una sola configuración (no por máquina), precargados desde las
// restricciones del grupo: HORAS_TRABAJO_DÍA / _NOCHE / _FINDESEMANA, NUM_TURNOS y Paros _Planificados
// (ver restriccionesCapacidad.ts). Día con su horario, Noche solo si NUM_TURNOS ≥ 2, Sábado en VACÍO
// (manual). Solo se reaplica si cambia el valor de la restricción (firma): un ajuste manual no se pisa
// al volver a sincronizar.
export function useJornadaGrupo(restricciones: Restriccion[], codigoGrupo: number | null): JornadaGrupoEditable {
  const grupo = codigoGrupo ?? -1;
  const jornada = useMemo(() => jornadaDesdeRestricciones(restricciones, grupo), [restricciones, grupo]);
  const paroRestriccion = useMemo(
    () => porcentajeRestriccion(restricciones, grupo, RESTRICCION_CAPACIDAD.parosPlanificados),
    [restricciones, grupo]
  );
  const opcionesDia = useMemo(() => opcionesConHorarios(DIA_BASE, [jornada.dia, jornada.finDeSemana]), [jornada]);
  const opcionesNoche = useMemo(() => opcionesConHorarios(NOCHE_BASE, [jornada.noche]), [jornada]);

  const [dia, setDia] = useState('EMPTY');
  const [noche, setNoche] = useState('EMPTY');
  const [sabado, setSabado] = useState('EMPTY');
  const [paroPct, setParoPct] = useState(13);

  const firma = useRef('');
  useEffect(() => {
    const f = JSON.stringify([jornada, paroRestriccion]);
    if (f === firma.current) return;
    firma.current = f;
    setDia(claveDeHorario(opcionesDia, jornada.dia));
    setNoche(jornada.numTurnos >= 2 ? claveDeHorario(opcionesNoche, jornada.noche) : 'EMPTY');
    setSabado('EMPTY');
    if (paroRestriccion !== null) setParoPct(paroRestriccion);
  }, [jornada, paroRestriccion, opcionesDia, opcionesNoche]);

  const horasBrutas = useMemo(() => {
    const d = opcionesDia.find(o => o.v === dia)?.h || 0;
    const n = opcionesNoche.find(o => o.v === noche)?.h || 0;
    const s = opcionesDia.find(o => o.v === sabado)?.h || 0;
    return { dia: d, noche: n, sabado: s, total: d + n + s };
  }, [opcionesDia, opcionesNoche, dia, noche, sabado]);

  const horasEfectivas = useMemo(() => {
    const f = 1 - paroPct / 100;
    const r = { dia: horasBrutas.dia * f, noche: horasBrutas.noche * f, sabado: horasBrutas.sabado * f };
    return { ...r, total: r.dia + r.noche + r.sabado };
  }, [horasBrutas, paroPct]);

  return {
    opcionesDia, opcionesNoche,
    dia, setDia, noche, setNoche, sabado, setSabado,
    paroPct, setParoPct,
    horasBrutas, horasEfectivas,
    numTurnos: jornada.numTurnos,
  };
}
