import type { Auth, User } from "@/types/interfaces";
import type { BodyResponse } from "@/types/body-response";
import { environment } from "@/environments/environments.prod";
import { BodyListResponse } from "@/types/body-list-response";
import { fetchWithAuth } from "@/lib/http-client";

const API_URL = `${environment.apiURLSeguridades}/api/auths/login`;

// Define a type for the login credentials
type LoginCredentials = {
  email: string;
  password: string;
};

export const authService = {
  async login(credentials: LoginCredentials): Promise<BodyResponse<Auth>> {
    const response = await fetchWithAuth(API_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        email: credentials.email,
        password: credentials.password,
      }),
    });

    if (!response.ok) {
      const errorBody = await response
        .json()
        .catch(() => ({
          message: "Error al iniciar sesión. Por favor, inténtelo de nuevo.",
        }));
      throw new Error(errorBody.message || "Ocurrió un error desconocido.");
    }

    return response.json();
  },

  async getUsuarioInfo(codigo_empleado: string): Promise<BodyResponse<any>> {
    const response = await fetchWithAuth(
      `${environment.apiURLSeguridades}/api/usuarios/usuarioIDusuario`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({codigo_empleado: codigo_empleado}),
      },
    );

    if (!response.ok) {
      const errorBody = await response
        .json()
        .catch(() => ({ message: "Error al obtener usuarios." }));
      throw new Error(errorBody.message || "Ocurrió un error desconocido.");
    }

    return response.json();
  },

  async getUsersInfo(): Promise<BodyListResponse<User>> {
    const response = await fetchWithAuth(
      `${environment.apiURLSeguridades1}/api/usuarios/fichasUsuarios`,
      {
        method: "GET",
        headers: { "Content-Type": "application/json" },
        // Este endpoint (servicio "seguridades", sin Guard) es público y responde CORS con
        // `Access-Control-Allow-Origin: *`. El navegador PROHÍBE "*" en peticiones con credenciales,
        // así que enviando cookies la petición se bloqueaba siempre ("NetworkError when attempting to
        // fetch resource" en Firefox / "Failed to fetch" en Chrome). Sin cookies funciona igual.
        skipAuth: true,
      },
    );

    if (!response.ok) {
      const errorBody = await response
        .json()
        .catch(() => ({ message: "Error al obtener usuarios." }));
      throw new Error(errorBody.message || "Ocurrió un error desconocido.");
    }

    return response.json();
  },
};
