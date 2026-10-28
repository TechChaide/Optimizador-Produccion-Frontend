/**
 * Ventana del "día de corte" compartida por Corte Espuma (Sub-Bloques-T8) y Formulación (FERT).
 *
 * Usuario 2026-10-28: los dos módulos deben mostrar el MISMO universo de órdenes — Corte procesa las
 * FERT del día de corte y Formulación es la suma de lo que se está cortando (kg de bloque formulado),
 * así que el dato tiene que coincidir. La regla vive acá para que no se vuelva a separar:
 *  - D = día de corte (por defecto hoy + 1 hábil).
 *  - Colchones / Muebles: FERT con FECHAFIN = D (PT − 1).
 *  - Venta Externa: FERT con FECHAFIN = D + 1 hábil (su HALB va fechada al PT), así en D se cortan
 *    las dos para el mismo PT.
 *  - Solo FERT en firme; provisionales y el pendiente de días anteriores no entran (ese tiempo ya
 *    lo muestra la Capacidad Operativa como exceso del turno, usuario 2026-10-27).
 */
import { format } from 'date-fns';
import type { Restriccion } from '@/types/interfaces';

export interface VentanaCorte {
  /** Día de corte D ('yyyy-MM-dd'). */
  d: string;
  /** FECHAFIN de las FERT de Venta Externa que se cortan en D (D + 1 hábil). */
  venta: string;
}

export const ventanaCorte = (diaCorte: string, siguienteDiaHabil: (d: Date) => Date): VentanaCorte => {
  const d = diaCorte || format(siguienteDiaHabil(new Date()), 'yyyy-MM-dd');
  return { d, venta: format(siguienteDiaHabil(new Date(`${d}T12:00:00`)), 'yyyy-MM-dd') };
};

/** Área de origen (cruce con el P2) que identifica a Venta Externa. */
export const esAreaVentaExterna = (area: string | undefined): boolean => /venta\s*externa/i.test(area || '');

/** ¿Una FERT con esta FECHAFIN ('yyyy-MM-dd') se corta en el día D de la ventana? */
export const fertEnVentanaCorte = (fechaFin: string, esVentaExterna: boolean, v: VentanaCorte): boolean =>
  fechaFin === (esVentaExterna ? v.venta : v.d);

// ── Universo de Corte Espuma ──────────────────────────────────────────────────────────────────────
// Qué órdenes son "de corte" (movido desde TacticalPlanEspumasSection 2026-10-28 para que Formulación
// verifique su tab FERT contra exactamente el mismo universo que Sub-Bloques-T8).

// Responsables de Control de Producción de Corte, por centro. Es solo el RESPALDO: los valores reales
// se leen de las restricciones del grupo "Corte y Laminado" de cada centro (ver responsablesCorte),
// que es donde el negocio los mantiene. Esta lista queda como red de seguridad para el arranque —antes
// de que las restricciones carguen— y para el caso de que un centro no tenga la restricción creada.
//
// Grupos reales: Centro 1000 → grupo 8, Centro 2000 → grupo 16. Restricciones que se leen:
//   RespCtrlProd             → TODOS los responsables permitidos del centro
//   RespCtrlProd_Verticales  → subconjunto que trabaja en corte VERTICAL
//   (carruseles = permitidos − verticales, no hay restricción propia)
// (El 015 de Centro 2000 NO va aquí: solo aplica a materiales puntuales, ver RESP_EXCEPCION_POR_MATERIAL.)
export const ALLOWED_RESP_CORTE_FALLBACK: Record<'1000' | '2000', string[]> = {
  '1000': ['013', '038', '039', '044', '036', '029'],
  '2000': ['002', '038', '039'],
};
export const VERTICALES_RESP_FALLBACK: Record<'1000' | '2000', string[]> = {
  '1000': ['039', '036', '029'],
  '2000': ['039'],
};
export const CODIGO_GRUPO_CORTE_POR_CENTRO: Record<'1000' | '2000', number> = { '1000': 8, '2000': 16 };
export const NOMBRE_RESTRICCION_RESP = 'RESPCTRLPROD';
export const NOMBRE_RESTRICCION_RESP_VERTICALES = 'RESPCTRLPROD_VERTICALES';

// Materiales que la laminadora repotenciada de Guayaquil (LA02) corta bajo el responsable 015 — el 015
// es de Prensado/Planchas Mixtas, así que NO se habilita completo en Corte Espuma: solo estos
// materiales entran (ver RESP_EXCEPCION_POR_MATERIAL) y se atribuyen a LA02 sin importar su HR.
export const MATERIALES_LA02_GYE = new Set(['30002888', '30002889']);
// Responsables que Corte Espuma acepta en un centro SOLO para materiales puntuales (no para todo su
// alcance). Se suman a los carruseles del centro; cualquier otra orden/componente de ese responsable
// se descarta en la entrada (getFilteredData, auditMapper, explosión PFF — ver respExcepcionExcluye).
export const RESP_EXCEPCION_POR_MATERIAL: Record<'1000' | '2000', { resp: string; materiales: Set<string> }[]> = {
  '1000': [],
  '2000': [{ resp: '015', materiales: MATERIALES_LA02_GYE }],
};
// true = la fila es de un responsable de excepción pero su material no está habilitado → se descarta.
export const respExcepcionExcluye = (centro: string, resp: string, material: string): boolean => {
  const excepcion = RESP_EXCEPCION_POR_MATERIAL[centro as '1000' | '2000']?.find(e => e.resp === resp);
  return !!excepcion && !excepcion.materiales.has(material);
};

// FORRO (funda de tela, no lámina de espuma) — verificado con datos reales del inventario Centro
// 2000: de 122 materiales con responsable "de corte" (002/038/039), 105 son FORRO y solo 17 son
// lámina/espuma real. El responsable "002" en Guayaquil NO es exclusivo de espuma — también cubre
// FORRO, así que confiar solo en el responsable colaba materiales FORRO como necesidad de Corte
// Espuma. Mismo patrón que "PRENSAD" en getFilteredData (el responsable no distingue ESE proceso).
export const ES_FORRO = (desc: string): boolean => /FORRO/i.test(String(desc || ''));
// Descartes por descripción que Corte aplica sobre las FERT (prensado, aprovechamiento, forro).
export const descarteCortePorDescripcion = (desc: string): boolean => /PRENSAD|APROVECHAMIENTO/i.test(desc) || ES_FORRO(desc);

export interface ResponsablesCorte {
  permitidos: string[];
  verticales: string[];
  carruseles: string[];
  origen: { permitidos: 'restricción' | 'respaldo'; verticales: 'restricción' | 'respaldo' };
}

/** Responsables de corte de un centro, leídos de las restricciones de su grupo Corte y Laminado. */
export const responsablesCorte = (restricciones: Restriccion[], centro: '1000' | '2000'): ResponsablesCorte => {
  const parse = (valor: unknown) => String(valor || '').split(/[,&]/).map(v => v.trim()).filter(Boolean);
  const codigoGrupo = CODIGO_GRUPO_CORTE_POR_CENTRO[centro];
  const buscar = (nombre: string) => restricciones.find(r =>
    r.codigo_grupo === codigoGrupo &&
    r.estado === 'A' &&
    String(r.nombre_restriccion || '').trim().toUpperCase() === nombre
  );
  const rTodos = buscar(NOMBRE_RESTRICCION_RESP);
  const rVerticales = buscar(NOMBRE_RESTRICCION_RESP_VERTICALES);

  const declarados = rTodos ? parse(rTodos.valor_restriccion) : ALLOWED_RESP_CORTE_FALLBACK[centro];
  const verticales = rVerticales ? parse(rVerticales.valor_restriccion) : VERTICALES_RESP_FALLBACK[centro];

  // `permitidos` es la UNIÓN de ambas restricciones, no solo RespCtrlProd. Motivo real: al crear
  // RESPCTRLPROD_Verticales para el grupo 16 (Centro 2000) el negocio sacó el 039 de la lista
  // general, que quedó en `002&038`. Si `permitidos` fuera solo esa lista, el 039 quedaría fuera
  // del filtro `allowed` que usan las auditorías y TODA la carga vertical de Guayaquil
  // desaparecería en silencio. La restricción de verticales define el PROCESO; el alcance de
  // responsables es la suma de las dos.
  // + responsables de excepción por material (ej. 015 en GYE para LA02): entran al alcance, pero sus
  // filas de otros materiales se descartan en la entrada (ver respExcepcionExcluye).
  const excepciones = RESP_EXCEPCION_POR_MATERIAL[centro].map(e => e.resp);
  const permitidos = Array.from(new Set([...declarados, ...verticales, ...excepciones]));
  // Carruseles = todo lo permitido que no sea vertical (no hay restricción propia para carrusel).
  const carruseles = permitidos.filter(r => !verticales.includes(r));
  return {
    permitidos,
    verticales,
    carruseles,
    origen: {
      permitidos: rTodos ? 'restricción' : 'respaldo',
      verticales: rVerticales ? 'restricción' : 'respaldo',
    },
  };
};

/**
 * Por qué una FERT de la ventana NO entra a Sub-Bloques-T8 de Corte (null = sí entra). Mismo orden de
 * filtros que fertT8PorCentro + subBloquesT8PorCentro (este último descarta los verticales).
 */
export const motivoFueraDeSubBloques = (r: ResponsablesCorte, centro: string, resp: string, material: string, descripcion: string): string | null => {
  if (!r.permitidos.includes(resp)) return `Responsable ${resp || '—'} no es de Corte`;
  if (descarteCortePorDescripcion(descripcion)) return 'Prensado / aprovechamiento / forro';
  if (respExcepcionExcluye(centro, resp, material)) return `Responsable ${resp} solo para materiales LA02`;
  if (r.verticales.includes(resp)) return `Corte vertical (resp. ${resp})`;
  return null;
};

/**
 * Variante por MATERIAL (Formulación, que no tiene el origen por orden que Corte saca del cruce con
 * Necesidades Planta): una FERT con FECHAFIN = D siempre se corta en D; con FECHAFIN = D+1 solo si su
 * material va en un P2 de Venta Externa. Así un material que piden Colchones y Venta a la vez no pierde
 * sus órdenes de colchones del día (con la regla por orden quedaban todas fechadas a D+1).
 */
export const fertEnVentanaCorteMaterial = (fechaFin: string, materialEnVenta: boolean, v: VentanaCorte): boolean =>
  fechaFin === v.d || (materialEnVenta && fechaFin === v.venta);
