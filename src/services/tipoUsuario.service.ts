import type { TipoUsuario } from "@/types/interfaces";
import { crudSeguridades } from "@/services/seguridades/crudSeguridades";

export const tipoUsuarioService = crudSeguridades<TipoUsuario>('tipo-usuarios', 'tipo-usuario');
