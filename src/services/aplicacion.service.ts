import type { Aplicacion } from "@/types/interfaces";
import { crudSeguridades } from "@/services/seguridades/crudSeguridades";

export const aplicacionService = crudSeguridades<Aplicacion>('aplicacions', 'aplicacion');
