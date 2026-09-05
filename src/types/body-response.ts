
export interface BodyResponse<T> {
  data: T;
  // Common pagination/metadata fields returned alongside `data` by several endpoints
  // in this codebase (naming is inconsistent across backend routes).
  totalRegistros?: number;
  totalRecords?: number;
  totalRows?: number;
  length?: number;
  [key: string]: unknown;
}
