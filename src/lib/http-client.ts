/**
 * HTTP Client with automatic token handling via httpOnly cookies
 * Intercepts all requests to add credentials and handle 401/403 responses
 * 
 * Note: Token is managed by the backend as httpOnly cookie
 * This client only needs to include cookies in requests
 */

import { toast } from "@/hooks/use-toast";

export type FetchOptions = RequestInit & {
  skipAuth?: boolean;
  // Suprime SOLO el manejo de "sesión expirada" (limpiar localStorage + redirigir a login) en un
  // 401/403 — a diferencia de `skipAuth`, NO cambia si se envían cookies (`credentials`). Pensado para
  // la propia petición de login: un 401 ahí es "contraseña incorrecta" (respuesta normal del backend),
  // no una sesión vencida, pero SÍ puede necesitar seguir enviando cookies (p. ej. si el backend valida
  // algo como CSRF contra una cookie ya presente) — ver loginCentral.
  suppressAuthRedirect?: boolean;
};

/**
 * Fetch wrapper that automatically:
 * 1. Includes httpOnly cookies with credentials: 'include'
 * 2. Handles 401/403 errors by clearing local auth state and redirecting to login
 * 
 * @param url - The URL to fetch
 * @param options - Fetch options (can include skipAuth: true to skip credentials)
 * @returns Promise with the fetch response
 */
export async function fetchWithAuth(
  url: string,
  options: FetchOptions = {}
) {
  const { skipAuth = false, suppressAuthRedirect = false, ...restOptions } = options;

  // Realizar la petición con credenciales (incluye httpOnly cookies). cache: 'no-store' por defecto —
  // sin esto, el navegador puede revalidar contra su caché HTTP (mismo GET repetido a la misma URL, p.
  // ej. detalle_tactico/plan_grupo sin parámetros) y devolver un 304 Not Modified. `response.ok` es
  // `false` para 304 (solo es `true` en el rango 200-299), así que cada servicio que hace
  // `if (!response.ok) throw ...` lo trataba como error real, aunque 304 significa "sin cambios, usa la
  // copia cacheada" — no hay nada roto (confirmado 2026-09-16: "Error 304" al cargar Plan Grupo
  // Recuperado). Esta app siempre necesita el dato más reciente, así que se fuerza a no cachear nunca.
  //
  // Reintenta (una vez, tras una pausa corta) SOLO si `fetch()` en sí lanza una excepción ("Failed to
  // fetch": la petición nunca llegó a establecer conexión — DNS/red caída, VPN reconectándose, etc.) —
  // no si el servidor respondió con un status de error, que es una respuesta real y no debe reintentarse
  // a ciegas. Confirmado 2026-09-16 y 2026-09-22: mismo "Failed to fetch" genérico en fetchWithAuth con
  // el backend y CORS verificados sanos las dos veces — parece ser un corte de red intermitente real del
  // lado del cliente, no un bug de este código; reintentar es la mitigación razonable para ese caso.
  let response: Response;
  try {
    response = await fetch(url, {
      ...restOptions,
      credentials: skipAuth ? 'omit' : 'include', // 'include' para enviar cookies
      cache: restOptions.cache ?? 'no-store',
    });
  } catch (networkError) {
    console.warn('⚠️ Falló la conexión de red, reintentando una vez en 800ms…', networkError);
    await new Promise(resolve => setTimeout(resolve, 800));
    response = await fetch(url, {
      ...restOptions,
      credentials: skipAuth ? 'omit' : 'include',
      cache: restOptions.cache ?? 'no-store',
    });
  }

  // Si error de autenticación (401 Unauthorized o 403 Forbidden — algunos endpoints del backend
  // devuelven 403 con mensaje "Authentication token required" para el mismo caso de token
  // faltante/expirado, en vez de 401), limpiar auth local y redirigir a login. La redirección estuvo
  // deshabilitada para debug desde el commit que creó este archivo (abril 2026) y nunca se reactivó,
  // dejando al usuario atascado en una página rota con un error críptico en vez de volver al login
  // (confirmado 2026-09-15: "Authentication token required" en getCuboInventarios).
  //
  // `suppressAuthRedirect` excluye del manejo de "sesión expirada": un 401 de la propia petición de
  // LOGIN (contraseña incorrecta, la respuesta normal y esperada del backend) NO es una sesión que haya
  // expirado — antes de este chequeo, cualquier intento de login fallido disparaba esta lógica igual
  // que un token vencido, forzando una recarga completa de la página (redirectToLogin) en medio del
  // propio formulario de login, y tapando el mensaje real de "contraseña incorrecta" del backend con el
  // genérico de sesión expirada (confirmado 2026-09-28). Es una opción APARTE de `skipAuth` (que solo
  // controla si se envían cookies) — un primer intento de arreglo usó `skipAuth: true` para el login y
  // eso además dejó de enviar cookies en esa petición, lo que puede haber roto el login mismo si el
  // backend depende de alguna cookie presente (confirmado el mismo día: dejó de poder loguearse incluso
  // con credenciales correctas) — revertido a `skipAuth: false` (login sigue enviando cookies, igual que
  // siempre funcionó) y ahora usa solo `suppressAuthRedirect: true`.
  if (!suppressAuthRedirect && (response.status === 401 || response.status === 403)) {
    clearAuthData();
    redirectToLogin();
    // Intentar extraer mensaje del body sin consumir el stream original
    let errMsg = 'Tu sesión ha expirado. Por favor, inicia sesión de nuevo.';
    try {
      const cloned = response.clone();
      const body = await cloned.json().catch(() => null);
      if (body) {
        if (typeof body === 'string') errMsg = body;
        else if (body.message) errMsg = body.message;
        else if (body.error) errMsg = body.error;
      }
    } catch (_) {
      // Ignorar errores al parsear
    }
    toast({
      title: 'Error de autenticación',
      description: errMsg,
      variant: 'destructive',
    });
    console.error(`❌ Error ${response.status} - Sesión no válida`, errMsg);
    throw new Error(errMsg);
  }

  return response;
}

// Cuántos caracteres del cuerpo crudo de una respuesta de error se muestran como último recurso,
// cuando no es JSON con {message}/{error} — evita volcar respuestas enormes (ver extractErrorMessage).
const RAW_ERROR_BODY_MAX_CHARS = 300;

/**
 * Extrae un mensaje de error corto y legible del body de una respuesta HTTP no-ok, para usar en
 * `throw new Error(...)`. Si el body es JSON con `message`/`error`, usa eso. Si no, usa el texto crudo
 * pero TRUNCADO — sin este límite, un endpoint que responde con error pero devuelve un body grande (p.
 * ej. un dump de filas de la tabla, un stack trace largo) termina volcando todo ese texto como mensaje
 * de error, reventando cualquier notificación/toast que lo muestre (confirmado 2026-09-16: `detalle_tactico`
 * ya tiene decenas de miles de filas tras las pruebas de "Guardar Plan Táctico" en varios módulos, y un
 * error ahí llegó a mostrar cientos de registros crudos en pantalla).
 */
export async function extractErrorMessage(response: Response, fallback: string): Promise<string> {
  let text: string;
  try {
    text = await response.text();
  } catch {
    return fallback;
  }
  try {
    const json = JSON.parse(text);
    if (json && typeof json === 'object' && !Array.isArray(json)) {
      if (typeof json.message === 'string' && json.message.trim()) return json.message;
      if (typeof json.error === 'string' && json.error.trim()) return json.error;
    }
  } catch {
    // No es JSON — sigue con el texto crudo (truncado) más abajo.
  }
  const trimmed = text.trim();
  if (!trimmed) return fallback;
  const truncated = trimmed.length > RAW_ERROR_BODY_MAX_CHARS
    ? `${trimmed.slice(0, RAW_ERROR_BODY_MAX_CHARS)}… (${trimmed.length} caracteres en total)`
    : trimmed;
  return `${fallback}: ${truncated}`;
}

/**
 * Limpia todos los datos de autenticación local del localStorage
 * Nota: La cookie httpOnly se maneja en el backend
 */
function clearAuthData() {
  if (typeof window !== 'undefined') {
    localStorage.removeItem('user');
    localStorage.removeItem('appsByProfile');
  }
}

/**
 * Redirige al usuario a la página de login
 */
function redirectToLogin() {
  if (typeof window !== 'undefined') {
    const basePath = ((window as any).__NEXT_DATA__?.basePath || process.env.NEXT_PUBLIC_BASE_PATH || '').replace(/\/+$/, '');
    window.location.href = basePath ? `${basePath}/` : '/';
  }
}

/**
 * Limpia todos los datos de autenticación local
 * Nota: El backend se encarga de limpiar la cookie httpOnly en logout
 */
export function clearAuth() {
  clearAuthData();
}
