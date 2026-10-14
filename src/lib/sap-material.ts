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
