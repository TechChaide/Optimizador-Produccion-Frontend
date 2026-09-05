export interface SolicitudPlanificacionEstacion {
  estacion_planificacion: string;
  estacion_habilidad: string;
}

export interface SolicitudPlanificacionItem {
  turno: string;
  linea: string;
  estacion: SolicitudPlanificacionEstacion;
  personas_requeridas: number;
  numero_semanas: number;
  grupo: string;
}

export interface OperadorAsignadoPlanificacion {
  codigo_operador: number;
  nombre_operador: string;
  calificacion: number;
  rol: string;
  semana_inicio: number;
  semana_fin: number;
}

export interface AsignacionPlanificacionResultado {
  turno: string;
  estacion_planificacion: string;
  estacion_habilidad: string;
  grupo: string;
  personas_requeridas: number;
  personas_asignadas: number;
  numero_semanas: number;
  operadores: OperadorAsignadoPlanificacion[];
  advertencias: string[];
}

export interface RespuestaPlanificacionData {
  exitoso: boolean;
  total_turnos: number;
  asignaciones: AsignacionPlanificacionResultado[];
  errores: string[];
}