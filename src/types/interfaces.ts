
// Este archivo es autogenerado. No lo modifiques manually.

export interface Aplicacion {
  codigo_aplicacion: string;
  nombre_aplicacion: string;
  estado: string;
}

export interface Clase {
  codigo_clase: number;
  nombre_clase: string;
  estado: string;
}

export interface Menu {
  codigo_menu: number;
  codigo_padre: number;
  nombre: string;
  icono: string;
  path: string;
  estado: string;
  codigo_aplicacion: string;
}

export interface MenuTipoUsuario {
  codigo_menu_tipo_usuario: number;
  estado: string;
  usuario_modificacion: string;
  fecha_modificacion: Date | string;
  codigo_menu: number;
  codigo_tipo_usuario: number;
}

export interface Permisos {
  codigo_permiso: number;
  estado: string;
  usuario_modificacion: string;
  fecha_modificacion: Date | string;
  codigo_tipo_permiso: number;
  codigo_menu_tipo_usuario: number;
}

export interface Propiedad {
  codigo_propiedad: number;
  nombre_propiedad: string;
  valor_propiedad: string;
  estado: string;
  codigo_aplicacion: string;
}

export interface TipoPermiso {
  codigo_tipo_permiso: number;
  nombre_tipo_permiso: string;
  mnemonico: string;
  estado: string;
}

export interface TipoUsuario {
  codigo_tipo_usuario: number;
  codigo_clase: number;
  nombre_tipo_usuario: string;
  estado: string;
  usuario_modificacion: string;
  fecha_modificacion: Date | string;
}

export interface TipoUsuarioAplicacion {
  codigo_tipo_usuario_aplicacion: number;
  estado: string;
  usuario_modificacion: string;
  fecha_modificacion: Date | string;
  codigo_aplicacion: string;
  codigo_tipo_usuario: number;
}

export interface Usuario {
  codigo_usuario: number;
  id_usuario: string;
  condicion: string;
  estado: string;
  usuario_modificacion: string;
  fecha_modificacion: Date | string;
  codigo_tipo_usuario: number;
}

export interface UsuarioTipoUsuario {
  codigo_usuario_tipo_usuario: number;
  estado: string;
  codigo_usuario: number;
  codigo_tipo_usuario: number;
}

export interface User {
  codigo_usuario: number;
  usuario: string;
  correo_usuario: string;
  condicion: string;
  id_usuario: string;
  codigo_empleado: string;
  CODIGO?: string;
  CEDULA?: string;
  LOCALIDAD?: string;
  NOMBRE?: string;
  GRUPO_DEPARTAMENTO?: string;
  DEPARTAMENTO?: string;
  CARGO?: string;
  STATUS?: string;
}

export interface Auth {
  message: string;
  token: string;
  expiresIn: string;
  user:User;
  // Shape not defined by the backend contract used in this app; field is carried through
  // but never read anywhere in the codebase (verified via repo-wide search for `perfiles`).
  perfiles: unknown[];
}

export interface FichaSocialHistorica {
  CODIGO: string;
  NOMBRE: string;
  LOCALIDAD: string;
  CEDULA: string;
  MAIL: string;
  GRUPO_DEPARTAMENTO: string;
  DEPARTAMENTO: string;
  CARGO: string;
  CODIGO_JEFE: string;
}

export interface InformacionExterna {
  codigo_informacion_externa: number;
  codigo_usuario: number;
  identificador: string;
  nombres: string;
  passcode: string;
  estado: string;
  fecha_creacion: Date | string;
  usuario_creacion: string;
  fecha_modificacion: Date | string;
  usuario_modificacion: string;
}

export interface Ausentismo {
    codigo_ausentismo: number;
    codigo_tipo_ausentismo: number;
    codigo_operador: string | null;
    codigo_empleado: string;
    fecha_inicio: Date;
    fecha_fin: Date;
    tiempo_efectivo: string;
    descripcion: string;
    estado: string;
    fecha_creacion: Date;
    usuario_creacion: string;
    fecha_modificacion: Date;
    usuario_modificacion: string;
    operador?: Operador;
}

export interface Calendario {
    codigo_calendario: number;
    codigo_grupo?: number;
    codigo_turno: number;
    codigo_linea: number;
    codigo_lineas?: number[];
    nombre_calendario: string;
    hora_inicio: string;
    estado: string;
    fecha_modificacion: Date;
    usuario_modificacion: string;
    linea?: Linea;
    lineas?: Linea[];
    grupo?: Grupo;
    turno?: Turno;
}

export interface DetalleCalendario {
    codigo_detalle: number;
    codigo_calendario: number;
    codigo_estacion: number;
    nombre_detalle: string;
    fecha_real: Date;
    fecha_inicio: Date;
    fecha_fin: Date;
    codigo_tipo_detalle: number;
    estado: string;
    fecha_modificacion: Date;
    usuario_modificacion: string;
    tipo_detalle?: TipoDetalle;
    calendario?: Calendario;
    estacion?: Estacion;
}

export interface DetalleTactico {
    codigo_detalle_tactico: number;
    codigo_plan_grupo: number;
    codigo_material: number;
    linea_produccion: string;
    cantidad_produccion_neta: string;
    resp_ctrl_prod: string;
    clase_aprovisionamiento: string;
    cantidad_aprovisionamiento: number;
    estado: string;
    fecha_modificacion: Date;
    usuario_modificacion: string;
    codigo_plan_grupo_padre?: number;
}

export interface Detalles {
    codigo_detalle: number;
    codigo_material: number;
    codigo_plan: number;
    codigo_familia_producto: number;
    cantidad_produccion_planificada: string;
    cantidad_transferencia: string;
    cantidad_produccion_neta: string;
    centro: string;
    centro_produccion?: string;
    linea_produccion?: string;
    semana?: string;
    fecha_inicio?: string | Date;
    fecha_fin?: string | Date;
    cantidad_proyectada?: number | string;
    cantidad_producir?: number | string;
    resp_ctrl_prod: string;
    estado: string;
    fecha_creacion: Date;
    usuario_creacion: string;
    plan_grupo?: PlanGrupo;
    familia_grupo?: FamiliaProductos;
}

export interface Estacion {
    codigo_estacion: number;
    codigo_linea: number;
    nombre_estacion: string;
    numero_puestos: number;
    numero_personas?: number;
    puesto_habilidades?: string;
    estado: string;
    fecha_modificacion: Date;
    usuario_modificacion: string;
    linea?: Linea;
}

export interface FamiliaProductos {
    codigo_familia_producto: number;
    nombre_familia_producto: string;
    estado: string;
    fecha_modificacion: Date;
    usuario_modificacion: string;
}

export interface Grupo {
    codigo_grupo: number;
    centro: string;
    nombre_grupo: string;
    // Descripción/alias del área a la que mapea el grupo (ej. "PRENSADO QUITO"), usada para buscar
    // grupos por texto además de nombre_grupo
    departamentos_mapea?: string;
    estado: string;
    fecha_modificacion: Date;
    usuario_modificacion: string;
}

export interface Linea {
    codigo_linea: number;
    codigo_grupo: number;
    nombre_linea: string;
    estado: string;
    fecha_modificacion: Date;
    usuario_modificacion: string;
    grupo?: Grupo;
}

export interface Operador {
    codigo_operador: number;
    identificador_operador: string;
    estado: string;
    fecha_creacion: Date;
    usuario_creacion: string;
}

export interface PlanGlobal {
    codigo_plan: number;
    identificador_plan: string;
    fecha_inicio: Date;
    fecha_fin: Date;
    estado: string;
    fecha_creacion: Date;
    usuario_creacion: string;
}

/** Registro de detalle semanal para el Plan Semanal — refleja el schema real de la tabla `detalles`. */
export interface DetallePlanSemanal {
    codigo_detalle?:          number;
    codigo_plan:              number;
    codigo_familia_producto:  number;
    centro:                   string;
    centro_produccion:        string;
    codigo_material:          string;
    cantidad_proyectada:      number;
    cantidad_producir:        number;
    semana:                   string;
    cantidad_transferencia:   number;
    linea_produccion:         string;
    estado:                   string;
    fecha_creacion?:          Date;
    usuario_creacion?:        string;
    fecha_modificacion?:      Date;
    usuario_modificacion?:    string;
}

export interface PlanGrupo {
    codigo_plan_grupo: number;
    codigo_plan: number;
    codigo_grupo: number;
    codigo_familia_grupo: number;
    valor: string;
    fecha_inicio_plan: Date;
    fecha_fin_plan: Date;
    estado: string;
    fecha_creacion: Date;
    usuario_creacion: string;
    plan_grupo?: PlanGrupo;
    grupo?: Grupo;
}

export interface Restriccion {
    codigo_restriccion: number;
    codigo_grupo: number;
    nombre_restriccion: string;
    valor_restriccion: string;
    descripcion: string;
    estado: string;
    fecha_modificacion: Date;
    usuario_modificacion: string;
    grupo?: Grupo;
}

export interface TipoAusentismo {
    codigo_tipo_ausentismo: number;
    nombre_tipo_ausentismo: string;
    estado: string;
    fecha_modificacion: Date;
    usuario_modificacion: string;
}

export interface TipoDetalle {
    codigo_tipo_detalle: number;
    nombre_tipo_detalle: string;
    estado: string;
    fecha_modificacion: Date;
    usuario_modificacion: string;
}

export interface Turno {
    codigo_turno: number;
    nombre_turno: string;
    estado: string;
    fecha_modificacion: Date;
    usuario_modificacion: string;
}

export interface MaterialesBalanceo {
    codigo_material_balanceo: number;
    codigo_material: number;
    porc_maximo_balanceo: number;
    porc_minimo_balanceo: number;
    prioridad: number;
    estado: string;
    fecha_modificacion: Date;
    usuario_modificacion: string;
}

export interface MaterialesBalanceoGrupo extends Grupo {
    codigo_material_balanceo: number;
    codigo_material: number;
    porc_maximo_balanceo: number;
    porc_minimo_balanceo: number;
    prioridad: number;
    estado: string;
    fecha_modificacion: Date;
    usuario_modificacion: string;
}

export interface OrdenFert {
  CENTRO: string;
  ORDEN: string;
  MATERIAL: string;
  SECTORDESC: string;
  CATEGORIA: string;
  NOMBRE: string;
  CANTPROGRAMADA: number;
  CANTENTREGADA: number;
  CANTNOTIFICADA: number;
  CANTRECHAZO: number;
  UNIDAD: string;
  FECHA: string;
  ANIO: number;
  MES: number;
  DIA: number;
  SEMANA: number;
  RESPCTRLPROD: string;
  PRIORIDAD: number;
  ENLINEA: number;
  MAQUINA: string;
  PEDIDO: string;
  CANTPROGPESONETO: number;
  CANTENTREGPESONETO: number;
  CANTNOTIFPESONETO: number;
  CANTRECHAZOPESONETO: number;
  POSICION: string;
  PUESTOTRABAJO: string;
  PUESTOTRABAJO2: string;
  PUESTOTRABAJO3: string;
  IDHOJARUTA: string;
  FECHAORDEN: string;
  CANTPENDIENTE: number;
  TIEMPOPENDIENTE: number;
}

// Forma real de una orden previsional tal como la devuelve el backend (endpoint
// OrdenesProvisionalesPaginadas) — distinta del ProvisionalOrder de @/types/types (que es el objeto
// de entrada del optimizador, con muchos menos campos).
export interface ProvisionalOrder {
  ORDENPREVISIONAL: string;
  MATERIAL: string;
  NOMBRE: string;
  CATEGORIA: string;
  CANTIDAD: number;
  UNIDAD: string;
  FECHAINICIO: string;
  FECHAFIN: string;
  RESPCONTROLPROD: string;
  Centro: string;
  Almacen: string;
  Maquina: string | null;
  MAQUINA: string | null;
  RECURSO: string | null;
  ClaseOrden: string;
  CodMaterial: string;
  LINEA?: string;
  Pedidoventas?: string;
  PEDIDOVENTAS?: string;
  POSICIONPEDIDO?: string;
  PosicionPedido?: string;
  PUESTOTRABAJO?: string;
  [key: string]: any;
}
