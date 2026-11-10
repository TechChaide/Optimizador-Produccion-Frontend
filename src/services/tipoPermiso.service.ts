import type { TipoPermiso } from "@/types/interfaces";
import { crudSeguridades } from "@/services/seguridades/crudSeguridades";

export const tipoPermisoService = crudSeguridades<TipoPermiso>('tipo-permisos', 'tipo-permiso');
