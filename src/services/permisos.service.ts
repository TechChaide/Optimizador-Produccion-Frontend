import { crudSeguridades } from "@/services/seguridades/crudSeguridades";

export interface Permiso {
  codigo_permiso: number;
  estado: string;
  codigo_tipo_permiso: number;
  codigo_menu_tipo_usuario: number;
}

export const permisosService = crudSeguridades<Permiso>('permisos', 'permiso');
