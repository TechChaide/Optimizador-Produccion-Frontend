// Grupo dedicado a "Planificación Táctica Taller de Corte" (forros de Muebles, RespCtrlProd 026).
// Deliberadamente distinto al Grupo SAP "Taller de Corte" (codigo_grupo=7) que ya existe para
// Colchones/Bases (RespCtrlProd 003&004). Lo usan los tiempos manuales de la pestaña "Tiempos" (una
// Restriccion por material) y el Plan Grupo "PFTC" (Plan Final Taller de Corte) de la pestaña "PLAN TÁCTICO".
import { grupoService } from '@/services/grupo.service';
import type { Grupo } from '@/types/interfaces';

export const GRUPO_TALLER_CORTE_NOMBRE = 'Taller de Corte - Forros Muebles';
export const GRUPO_TALLER_CORTE_DEPARTAMENTO = 'TALLER DE CORTE FORROS MUEBLES';
export const GRUPO_TALLER_CORTE_CENTRO = '1000';

export const buscarGrupoTallerCorte = async (): Promise<Grupo | null> => {
  const gruposRes = await grupoService.getAll();
  return (gruposRes.data || []).find(g => g.nombre_grupo === GRUPO_TALLER_CORTE_NOMBRE) ?? null;
};

// Devuelve el Grupo dedicado, creándolo la primera vez que se necesita.
export const obtenerOCrearGrupoTallerCorte = async (): Promise<Grupo> => {
  const existente = await buscarGrupoTallerCorte();
  if (existente) return existente;
  const nuevo = await grupoService.save({
    codigo_grupo: 0,
    centro: GRUPO_TALLER_CORTE_CENTRO,
    nombre_grupo: GRUPO_TALLER_CORTE_NOMBRE,
    departamentos_mapea: GRUPO_TALLER_CORTE_DEPARTAMENTO,
    estado: 'A',
  } as unknown as Grupo);
  if (!nuevo.data?.codigo_grupo) throw new Error('No se pudo crear el Grupo de Taller de Corte.');
  return nuevo.data;
};
