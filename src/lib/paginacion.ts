import type { BodyResponse } from '@/types/body-response';

export interface FetchAllPagesOptions {
  // Filas por página. Debe ser grande (menos viajes) pero sin llegar a respuestas de decenas de MB.
  pageSize?: number;
  // Páginas pedidas en paralelo después de la primera.
  concurrency?: number;
  // Avance acumulado (filas recibidas / total), p. ej. para barras de carga.
  onProgress?: (loaded: number, total: number) => void;
}

const asArray = <T>(data: unknown): T[] => (data == null ? [] : Array.isArray(data) ? data : [data as T]);

const getTotal = (res: BodyResponse<unknown>): number | null => {
  const total = res.totalRegistros ?? res.totalRecords ?? res.totalRows;
  return typeof total === 'number' && total >= 0 ? total : null;
};

// Recupera TODAS las filas de un endpoint paginado (page base 1).
// - La primera página se pide ya con el tamaño real (no una sonda de 1 fila): trae datos + total en un
//   solo viaje.
// - Con el total conocido, el resto de páginas se piden en paralelo (con límite de concurrencia) y se
//   concatenan en orden de página.
// - Si el backend recorta el tamaño de página (devuelve menos filas que las pedidas pero el total dice
//   que hay más), se continúa con ese tamaño efectivo.
// - Si el backend no informa el total, o la última página llega completa (total desfasado), se sigue
//   página a página hasta recibir una incompleta, para no perder filas.
export async function fetchAllPages<T>(
  fetchPage: (page: number, pageSize: number) => Promise<BodyResponse<unknown>>,
  { pageSize = 20000, concurrency = 3, onProgress }: FetchAllPagesOptions = {},
): Promise<T[]> {
  const first = await fetchPage(1, pageSize);
  const firstRows = asArray<T>(first.data);
  const total = getTotal(first);
  let loaded = firstRows.length;
  onProgress?.(loaded, total ?? loaded);

  // Todo cupo en la primera página
  if (firstRows.length === 0 || (total !== null ? loaded >= total : firstRows.length < pageSize)) return firstRows;

  const size = firstRows.length < pageSize ? firstRows.length : pageSize;
  const pages: T[][] = [firstRows];
  let nextPage = 2;

  if (total !== null) {
    const totalPages = Math.ceil(total / size);
    for (let start = 2; start <= totalPages; start += concurrency) {
      const chunk = Array.from({ length: Math.min(concurrency, totalPages - start + 1) }, (_, i) => start + i);
      const results = await Promise.all(chunk.map(p => fetchPage(p, size)));
      results.forEach((res, idx) => {
        const rows = asArray<T>(res.data);
        pages[chunk[idx] - 1] = rows;
        loaded += rows.length;
      });
      onProgress?.(loaded, total);
    }
    nextPage = totalPages + 1;
    if (pages[pages.length - 1].length < size) return pages.flat();
  }

  for (;;) {
    const rows = asArray<T>((await fetchPage(nextPage, size)).data);
    pages.push(rows);
    loaded += rows.length;
    onProgress?.(loaded, Math.max(loaded, total ?? 0));
    if (rows.length < size) break;
    nextPage++;
  }
  return pages.flat();
}
