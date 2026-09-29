
import type { Auth, Usuario } from "@/types/interfaces";
import type { BodyResponse } from "@/types/body-response";
import { environment } from "@/environments/environments.prod";
import { fetchWithAuth } from "@/lib/http-client";

const API_URL = `${environment.apiURLSeguridades}/api/auths/login`;
const API_URL_CENTRAL = `${environment.apiURLSeguridades}/api/auths/loginCentral`;

// Define a type for the login credentials
type LoginCredentials = {
  email: string;
  password: string;
};

// Tipo para login facial/central — aceptar string o el objeto facial
type LoginCentralCredentials = {
  email: string;
  password:
    | string
    | {
        CODIGO: string;
        NOMBRE: string;
        DEPARTAMENTO?: string;
        CENTRO?: string;
      };
};

export const authService = {
  async login(credentials: LoginCredentials): Promise<BodyResponse<Auth>> {
    // Para compatibilidad, reenviamos cualquier llamada a `login()` hacia `loginCentral()`
    // Si se recibe un password string, lo pasamos tal cual; si es un objeto, también se envía.
    return this.loginCentral({ email: credentials.email, password: (credentials as any).password as any });
  },

  async loginCentral(credentials: any): Promise<BodyResponse<Auth>> {
    // suppressAuthRedirect: true — un 401 aquí es simplemente "contraseña incorrecta", no una sesión
    // expirada (ver comentario en fetchWithAuth), así que no debe limpiar+recargar la página. Sigue
    // enviando cookies normalmente (skipAuth NO se toca) — un intento anterior de arreglo usó
    // `skipAuth: true` y eso dejó de enviar cookies en el login, lo que puede haber roto la validación
    // en el backend (dejó de poder loguearse incluso con credenciales correctas, confirmado 2026-09-28).
    const response = await fetchWithAuth(API_URL_CENTRAL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: credentials.email,
        password: credentials.password,
      }),
      suppressAuthRedirect: true,
    });

    if (!response.ok) {
      const errorBody = await response.json().catch(() => ({ message: 'Error al iniciar sesión facial.' }));
      throw new Error(errorBody.message || 'Ocurrió un error desconocido.');
    }
    
    return response.json() as Promise<BodyResponse<Auth>>;
  },
};
