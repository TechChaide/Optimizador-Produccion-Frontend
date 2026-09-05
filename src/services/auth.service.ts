import type { Auth, User } from "@/types/interfaces";
import type { BodyResponse } from "@/types/body-response";
import { environment } from "@/environments/environments.prod";
import { BodyListResponse } from "@/types/body-list-response";

const API_URL = `${environment.apiURLSeguridades}/api/auths/login`;

// Define a type for the login credentials
type LoginCredentials = {
  email: string;
  password: string;
};

export const authService = {
  async login(credentials: LoginCredentials): Promise<BodyResponse<Auth>> {
    const response = await fetch(API_URL, {
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
    const response = await fetch(
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
    const response = await fetch(
      `${environment.apiURLSeguridades}/api/usuarios/fichasUsuarios`,
      {
        method: "GET",
        headers: { "Content-Type": "application/json" },
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
