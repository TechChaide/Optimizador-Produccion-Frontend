/**
 * Mantenimiento SAP (ListarMantenimientosPreventivos → sp_Get_MantenimientosPreventivosAgendados),
 * estructura del 2026-10-28. Regla del usuario: solo cuentan las OTs de las áreas de planta que
 * evaluamos ("Corte y Laminado" y "Espuma") y la máquina se cruza por MaquinaSismac (respaldo
 * ID_MAQUINA). El mapa de abajo dice a qué módulo le resta cada máquina; se va ampliando a medida que
 * se agregan máquinas a las evaluaciones. Cada módulo sigue decidiendo sus propias máquinas (Corte
 * Espuma: MACHINES_BY_PLANTA; Laminado y Venta Externa: restricción MANTENIMIENTO); el mapa sirve para
 * mostrar a qué módulo pertenece una OT y para no repetir el filtro de área en cada uno.
 */

type Fila = Record<string, unknown>;

const valor = (fila: Fila, clave: string): string => {
  const k = Object.keys(fila).find(x => x.toLowerCase() === clave.toLowerCase());
  const v = k ? fila[k] : undefined;
  return v === null || v === undefined ? '' : String(v).trim();
};

// SAP trae "Corte y  Laminado" con doble espacio, de ahí el \s+.
const AREAS_MTTO = [/^corte\s+y\s+laminado$/i, /^espuma$/i];

/** ¿La OT es de un área que evaluamos (Corte y Laminado / Espuma)? */
export const esAreaMtto = (fila: Fila): boolean => {
  const area = valor(fila, 'AREA');
  return AREAS_MTTO.some(re => re.test(area));
};

/** Código de máquina de la OT: MaquinaSismac, o ID_MAQUINA si viene vacío. En mayúsculas. */
export const maquinaSismacDe = (fila: Fila): string => (valor(fila, 'MaquinaSismac') || valor(fila, 'ID_MAQUINA')).toUpperCase();

export type ModuloMtto = 'Corte Espuma' | 'Laminado' | 'Venta Externa' | 'Formulación';

/**
 * Máquinas operativas del flujo, Centro 1000 (usuario 2026-10-28). El Centro 2000 se está
 * reestructurando para usar la misma metodología. `restaCapacidad: false` = mapeada, pero el módulo
 * todavía no tiene capacidad de la que restar (Formulación).
 */
export const MAQUINAS_MTTO: Record<string, { modulo: ModuloMtto; nombre: string; restaCapacidad: boolean }> = {
  CR04: { modulo: 'Corte Espuma', nombre: 'Carrusel 4 Fecken', restaCapacidad: true },
  CR03: { modulo: 'Corte Espuma', nombre: 'Carrusel 3 Schmuziger', restaCapacidad: true },
  CR01: { modulo: 'Corte Espuma', nombre: 'Carrusel 1 Schmuziger', restaCapacidad: true },
  CNC01: { modulo: 'Corte Espuma', nombre: 'Cortadora CNC Giotto', restaCapacidad: true },
  V02: { modulo: 'Corte Espuma', nombre: 'Vertical HR_V02', restaCapacidad: true },
  V03: { modulo: 'Corte Espuma', nombre: 'Vertical HR_V03', restaCapacidad: true },
  LO00: { modulo: 'Laminado', nombre: 'Laminadora Looper Fecken', restaCapacidad: true },
  MEE01: { modulo: 'Venta Externa', nombre: 'Empacadora Elektroteks', restaCapacidad: true },
  BT01: { modulo: 'Formulación', nombre: 'Espumadora Laader', restaCapacidad: false },
  BT02: { modulo: 'Formulación', nombre: 'Espumadora Cofama', restaCapacidad: false },
  PG03: { modulo: 'Formulación', nombre: 'Puente Grúa IPF', restaCapacidad: false },
  ME00: { modulo: 'Formulación', nombre: 'Mesa Elevadora Bloques Espuma', restaCapacidad: false },
  T201: { modulo: 'Formulación', nombre: 'Cortadora Fecken T 2', restaCapacidad: false },
};

/** Módulo al que pertenece la OT (null = área fuera de la evaluación o máquina aún no mapeada). */
export const moduloMttoDe = (fila: Fila): (typeof MAQUINAS_MTTO)[string] & { id: string } | null => {
  if (!esAreaMtto(fila)) return null;
  const id = maquinaSismacDe(fila);
  const m = MAQUINAS_MTTO[id];
  return m ? { ...m, id } : null;
};
