import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

/** Convierte una llave cruda del backend (snake_case, UPPER_CASE, camelCase) en una
 *  etiqueta legible en Título Caso — ej. "FECHA_OT_PRG_INI" -> "Fecha Ot Prg Ini". */
export function humanizeLabel(key: string): string {
  const spaced = key
    .replace(/[_-]+/g, ' ')
    .replace(/([a-z0-9])([A-Z])/g, '$1 $2')
    .trim();
  return spaced
    .split(/\s+/)
    .map(word => (word.length <= 3 && word === word.toUpperCase())
      ? word
      : word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
    .join(' ');
}
