
export interface BodyListResponse<T> {
  data: T[];
  size: number;
  // Algunas rutas del backend devuelven el conteo bajo "length" en vez de "size" — se declara
  // explícito (en vez de dejarlo caer al index signature) porque `unknown || number` no narrowa
  // bien en un `||` y producía falsos errores de tipo en los callers.
  length?: number;
  [key: string]: unknown;
}
