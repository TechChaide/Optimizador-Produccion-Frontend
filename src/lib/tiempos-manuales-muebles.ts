// TEMPORAL (pedido del usuario 2026-10-06, lanzamiento de la nueva colección de tela): tiempos unitarios
// de fabricación ingresados a mano para materiales de Muebles que todavía NO tienen tiempo en los cubos
// del backend (TiemposEnsamblado / PR2). Se persisten como Restriccion del Grupo de Muebles:
//   nombre_restriccion = "TiempoManualMuebles:<material>", valor_restriccion = minutos por unidad.
// El tiempo del backend SIEMPRE tiene prioridad: el manual solo se usa mientras el cubo no traiga un
// tiempo > 0 para ese material, así que deja de aplicarse solo en cuanto TI actualice los cubos.
// Cuando todos los materiales nuevos estén en el backend, este módulo y su panel se pueden retirar.
import type { Restriccion } from '@/types/interfaces';

export const TIEMPO_MANUAL_MUEBLES_PREFIJO = 'TiempoManualMuebles:';
export const TIEMPO_MANUAL_MUEBLES_DESCRIPCION = 'Tiempo unitario manual (min) - Muebles, temporal hasta que exista en el backend';

export interface TiempoManualMueble {
  minutos: number;
  descripcion: string;
  codigoRestriccion: number;
  fechaModificacion: string;
}

export const esRestriccionTiempoManualMuebles = (r: Pick<Restriccion, 'nombre_restriccion'>): boolean =>
  !!r.nombre_restriccion?.startsWith(TIEMPO_MANUAL_MUEBLES_PREFIJO);

// La descripción del material se guarda como "<TIEMPO_MANUAL_MUEBLES_DESCRIPCION> — <descripción>"
const descripcionMaterial = (descripcion: string | null | undefined): string => {
  const texto = String(descripcion || '');
  const prefijo = `${TIEMPO_MANUAL_MUEBLES_DESCRIPCION} — `;
  return texto.startsWith(prefijo) ? texto.slice(prefijo.length).trim() : texto.trim();
};

// material (8 dígitos) -> tiempo manual guardado (solo estado 'A' y minutos > 0)
export const getTiemposManualesMuebles = (restricciones: Restriccion[]): Map<string, TiempoManualMueble> => {
  const map = new Map<string, TiempoManualMueble>();
  restricciones.forEach(r => {
    if (!esRestriccionTiempoManualMuebles(r) || (r.estado && r.estado !== 'A')) return;
    const material = r.nombre_restriccion.slice(TIEMPO_MANUAL_MUEBLES_PREFIJO.length).trim().slice(-8);
    const minutos = Number(r.valor_restriccion);
    if (!material || !(minutos > 0)) return;
    map.set(material, {
      minutos,
      descripcion: descripcionMaterial(r.descripcion),
      codigoRestriccion: r.codigo_restriccion,
      fechaModificacion: r.fecha_modificacion ? String(r.fecha_modificacion) : '',
    });
  });
  return map;
};
