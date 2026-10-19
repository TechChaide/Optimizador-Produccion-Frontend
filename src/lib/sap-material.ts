// Largo fijo del código de material en SAP (MATNR interno): los materiales numéricos se guardan con
// ceros a la izquierda hasta 18 caracteres (p. ej. 30019574 -> 000000000030019574). La interfaz de
// "ENVIAR A SAP" (InsertarSolicitudProduccionHB -> tabla ZPPT_ORDER_INT) recibe el valor tal cual, sin
// la conversión ALPHA que SAP aplica en pantalla, así que el material sin relleno no se reconoce y HANA
// rechaza la solicitud ("La API de HANA rechazó la solicitud", confirmado por el usuario 2026-10-14).
// Mismo relleno que ya usan las consultas de materiales a HANA del resto de la app (padStart(18, '0')).
export const SAP_MATERIAL_LENGTH = 18;

export const formatMaterialSap = (material: string | number | null | undefined): string => {
  const codigo = String(material ?? '').trim();
  return codigo ? codigo.padStart(SAP_MATERIAL_LENGTH, '0') : codigo;
};

// ESTATUS_REG_ORD (CHAR 01): según la especificación SAP (CHD-EF AUTOMATIZAR GENERACION DE ORDENES DE
// PRODUCCION), al cargar el registro desde el aplicativo Chaide el valor DEBE ser "1" (2/3 los asigna SAP
// al procesar). Antes Muebles/Taller de Corte enviaban "A" y HANA rechazaba la solicitud.
export const SAP_ESTATUS_REG_ORD_CARGADO = '1';

// USUARIO (CHAR 08): máximo 8 caracteres. Se usa el código de empleado (corto, mismo criterio que el envío
// de Ensamblado); el nombre de usuario (p. ej. "sebastian.guerrero") excede el largo y HANA lo rechaza.
export const SAP_USUARIO_MAX = 8;
export const usuarioProcesoSap = (): string => {
  const user = typeof window !== 'undefined' ? JSON.parse(localStorage.getItem('user') || '{}') : {};
  const codigo = String(user?.codigo_empleado || user?.usuario || user?.id_usuario || 'admin').trim();
  return codigo.slice(0, SAP_USUARIO_MAX);
};
