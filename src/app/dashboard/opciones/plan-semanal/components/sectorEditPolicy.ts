/**
 * Solo sectores 01, 02 y 03 (p. ej. "01 COLCHONES") pueden editarse en el pivot de ajuste.
 * El resto se muestra como referencia del plan original.
 */
export function centroFromPivotKey(sectorKey: string): string {
  const i = sectorKey.indexOf('|');
  return i >= 0 ? sectorKey.slice(0, i).trim() : '';
}

export function sectorFromPivotKey(sectorKey: string): string {
  const i = sectorKey.indexOf('|');
  return i >= 0 ? sectorKey.slice(i + 1).trim() : sectorKey.trim();
}

export function isSectorEditableByCode(sector: string): boolean {
  const s = String(sector ?? '').trim();
  return /^(01|02|03)(\s|$|[/-])/i.test(s);
}
