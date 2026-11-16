/**
 * Maestro TEMPORAL de protectores subcontratados (Programación Táctica Subcontratación), extraído del
 * Excel "SS y PP Forros protectores.xlsx" (Z:/00_Planificación/Formatos 002/2026/PROYECTOS 2026) el 2026-11-16:
 *  - PROTECTORES: hoja REV PED COMPRAS (forro col A ↔ FERT col C) + CALCULO SS-PP (FERT resp. 027 que no
 *    están en REV PED COMPRAS, sin forro) + Tabla2 (tamaño de paquete, CALCULO SS-PP BZ:CB) +
 *    dISTRIBUCIÓN col C (precio por unidad; solo impermeables, kits y PLUS).
 *  - TALLERES: hoja dISTRIBUCIÓN filas 3-6 (código SAP, capacidad en unidades, ruta).
 * Generado por script; para actualizarlo volver a correr la extracción, no editar a mano.
 */

export interface ProtectorMaestro {
  fert: string;
  descripcion: string;
  forro: string;
  descripcionForro: string;
  // Tabla2 (LOTE): SS se redondea a este múltiplo y el pedido sale en paquetes; 0 = sin paquete (no se pide).
  paquete: number;
  precio?: number;
}

export interface TallerProtector {
  nombre: string;
  codProveedor: string;
  ruta: string;
  // "CAPACIDAD EN UNIDADES" del Excel (rango); el reparto usa el punto medio.
  capacidadMin: number;
  capacidadMax: number;
}

export const PROTECTORES_EXCEL: ProtectorMaestro[] = [
  {"fert": "20004131", "descripcion": "PROTECTOR CHN IMPERMEABLE 080 AZ", "forro": "30016982", "descripcionForro": "FORRO PROTECTOR CHN IMPER AZ 080X190", "paquete": 10, "precio": 1.0},
  {"fert": "20004292", "descripcion": "PROTECTOR CHN IMPERMEABLE 090 AZ", "forro": "30016983", "descripcionForro": "FORRO PROTECTOR CHN IMPER AZ 090X190", "paquete": 10, "precio": 1.0},
  {"fert": "20002280", "descripcion": "PROTECTOR CHN IMPERMEABLE 105  AZ", "forro": "30016984", "descripcionForro": "FORRO PROTECTOR CHN IMPER AZ 105X190", "paquete": 30, "precio": 1.0},
  {"fert": "20002283", "descripcion": "PROTECTOR CHN IMPERMEABLE 135 AZ", "forro": "30016985", "descripcionForro": "FORRO PROTECTOR CHN IMPER AZ 135X190", "paquete": 30, "precio": 1.1},
  {"fert": "20002285", "descripcion": "PROTECTOR CHN IMPERMEABLE 160 AZ", "forro": "30016986", "descripcionForro": "FORRO PROTECTOR CHN IMPER AZ 160X200", "paquete": 30, "precio": 1.25},
  {"fert": "20002286", "descripcion": "PROTECTOR CHN IMPERMEABLE 200 AZ", "forro": "30016987", "descripcionForro": "FORRO PROTECTOR CHN IMPER AZ 200X200", "paquete": 30, "precio": 1.5},
  {"fert": "20002613", "descripcion": "PROTECTOR CHN IMPERMEABLE BEBÉ 68x96x06", "forro": "30016988", "descripcionForro": "FORRO PROTECTOR CHN IMPER BEBÉ 68x96x6", "paquete": 30, "precio": 0.6},
  {"fert": "20002013", "descripcion": "PROTECTOR CHN IMPERMEABLE BEBÉ 70X130X10", "forro": "30016989", "descripcionForro": "FORRO PROTECTOR CHN IMPER BEBÉ 70X130X10", "paquete": 30, "precio": 0.6},
  {"fert": "20002336", "descripcion": "PROTECTOR CHN IMPERMEABLE BEBÉ 70X140X10", "forro": "30016990", "descripcionForro": "FORRO PROTECTOR CHN IMPER BEBÉ 70X140X10", "paquete": 30, "precio": 0.6},
  {"fert": "20003832", "descripcion": "PROTECTOR CHN IMPERM 66X99 7862104398109", "forro": "30016991", "descripcionForro": "FORRO PROTECTOR CHN IMPER BL 066X099", "paquete": 10, "precio": 0.6},
  {"fert": "20004130", "descripcion": "PROTECTOR CHN IMPERMEABLE  080 BL", "forro": "30016992", "descripcionForro": "FORRO PROTECTOR CHN IMPER BL 080X190", "paquete": 10, "precio": 1.0},
  {"fert": "20002266", "descripcion": "PROTECTOR CHN IMPERMEABLE 090 BL", "forro": "30016993", "descripcionForro": "FORRO PROTECTOR CHN IMPER BL 090X190", "paquete": 10, "precio": 1.0},
  {"fert": "20001666", "descripcion": "PROTECTOR CHN IMPERMEABLE 105 BL", "forro": "30016994", "descripcionForro": "FORRO PROTECTOR CHN IMPER BL 105X190", "paquete": 30, "precio": 1.0},
  {"fert": "20001667", "descripcion": "PROTECTOR CHN IMPERMEABLE 135 BL", "forro": "30016995", "descripcionForro": "FORRO PROTECTOR CHN IMPER BL 135X190", "paquete": 30, "precio": 1.1},
  {"fert": "20001668", "descripcion": "PROTECTOR CHN IMPERMEABLE 160 BL", "forro": "30016996", "descripcionForro": "FORRO PROTECTOR CHN IMPER BL 160X200", "paquete": 30, "precio": 1.25},
  {"fert": "20001669", "descripcion": "PROTECTOR CHN IMPERMEABLE 200 BL", "forro": "30016997", "descripcionForro": "FORRO PROTECTOR CHN IMPER BL 200X200", "paquete": 30, "precio": 1.5},
  {"fert": "20003830", "descripcion": "PROTECTOR CHN IMPERMEABLE BORN 70X130X10", "forro": "30016999", "descripcionForro": "FORRO PROTECTOR CHN IMPER BORN 70X130X10", "paquete": 0, "precio": 0.61},
  {"fert": "20003831", "descripcion": "PROTECTOR CHN IMPERMEABLE BORN 73X108X10", "forro": "30017000", "descripcionForro": "FORRO PROTECTOR CHN IMPER BORN 73X108X10", "paquete": 0, "precio": 0.6},
  {"fert": "20010524", "descripcion": "PROTECTOR CHN IMPERMEABLE BEBÉ 70X100X10", "forro": "30019090", "descripcionForro": "FORRO PROTECTOR CHN IMPER BEBÉ 70X100X10", "paquete": 30, "precio": 0.6},
  {"fert": "20000534", "descripcion": "PROTECTOR CHN ACOLCHADO 105 BLANCO", "forro": "30020311", "descripcionForro": "FORRO PROTECTOR CHN AC BLANCO 105X190 PB", "paquete": 25},
  {"fert": "20004132", "descripcion": "PROTECTOR CHN ACOLCHADO 080 BLANCO", "forro": "30020418", "descripcionForro": "FORRO PROTECTOR CHN AC BLANCO 080X190 PB", "paquete": 10},
  {"fert": "20004133", "descripcion": "PROTECTOR CHN ACOLCHADO 080 CAFÉ", "forro": "30020419", "descripcionForro": "FORRO PROTECTOR CHN AC CAFÉ 080X190 PB", "paquete": 0},
  {"fert": "20004134", "descripcion": "PROTECTOR CHN ACOLCHADO 080 AZUL", "forro": "30020420", "descripcionForro": "FORRO PROTECTOR CHN AC AZUL 080X190 PB", "paquete": 10},
  {"fert": "20004135", "descripcion": "PROTECTOR CHN ACOLCHADO 080 GRIS", "forro": "30020421", "descripcionForro": "FORRO PROTECTOR CHN AC GRIS 080X190 PB", "paquete": 10},
  {"fert": "20000536", "descripcion": "PROTECTOR CHN ACOLCHADO 090 BLANCO", "forro": "30020422", "descripcionForro": "FORRO PROTECTOR CHN AC BLANCO 090X190 PB", "paquete": 10},
  {"fert": "20000548", "descripcion": "PROTECTOR CHN ACOLCHADO 090 CAFÉ", "forro": "30020423", "descripcionForro": "FORRO PROTECTOR CHN AC CAFÉ 090X190 PB", "paquete": 10},
  {"fert": "20002292", "descripcion": "PROTECTOR CHN ACOLCHADO 090 AZUL", "forro": "30020424", "descripcionForro": "FORRO PROTECTOR CHN AC AZUL 090X190 PB", "paquete": 10},
  {"fert": "20002293", "descripcion": "PROTECTOR CHN ACOLCHADO 090 GRIS", "forro": "30020425", "descripcionForro": "FORRO PROTECTOR CHN AC GRIS 090X190 PB", "paquete": 10},
  {"fert": "20000549", "descripcion": "PROTECTOR CHN ACOLCHADO 105 CAFÉ", "forro": "30020426", "descripcionForro": "FORRO PROTECTOR CHN AC CAFÉ 105X190 PB", "paquete": 25},
  {"fert": "20002211", "descripcion": "PROTECTOR CHN ACOLCHADO 105 AZUL", "forro": "30020427", "descripcionForro": "FORRO PROTECTOR CHN AC AZUL 105X190 PB", "paquete": 25},
  {"fert": "20002215", "descripcion": "PROTECTOR CHN ACOLCHADO 105 GRIS", "forro": "30020428", "descripcionForro": "FORRO PROTECTOR CHN AC GRIS 105X190 PB", "paquete": 25},
  {"fert": "20000535", "descripcion": "PROTECTOR CHN ACOLCHADO 135 BLANCO", "forro": "30020429", "descripcionForro": "FORRO PROTECTOR CHN AC BLANCO 135X190 PB", "paquete": 25},
  {"fert": "20000550", "descripcion": "PROTECTOR CHN ACOLCHADO 135 CAFÉ", "forro": "30020430", "descripcionForro": "FORRO PROTECTOR CHN AC CAFÉ 135X190 PB", "paquete": 25},
  {"fert": "20002212", "descripcion": "PROTECTOR CHN ACOLCHADO 135 AZUL", "forro": "30020431", "descripcionForro": "FORRO PROTECTOR CHN AC AZUL 135X190 PB", "paquete": 25},
  {"fert": "20002217", "descripcion": "PROTECTOR CHN ACOLCHADO 135 GRIS", "forro": "30020432", "descripcionForro": "FORRO PROTECTOR CHN AC GRIS 135X190 PB", "paquete": 25},
  {"fert": "20000533", "descripcion": "PROTECTOR CHN ACOLCHADO 160 BLANCO", "forro": "30020433", "descripcionForro": "FORRO PROTECTOR CHN AC BLANCO 160X200 PB", "paquete": 25},
  {"fert": "20000551", "descripcion": "PROTECTOR CHN ACOLCHADO 160 CAFÉ", "forro": "30020434", "descripcionForro": "FORRO PROTECTOR CHN AC CAFÉ 160X200 PB", "paquete": 25},
  {"fert": "20002213", "descripcion": "PROTECTOR CHN ACOLCHADO 160 AZUL", "forro": "30020435", "descripcionForro": "FORRO PROTECTOR CHN AC AZUL 160X200 PB", "paquete": 25},
  {"fert": "20002218", "descripcion": "PROTECTOR CHN ACOLCHADO 160 GRIS", "forro": "30020436", "descripcionForro": "FORRO PROTECTOR CHN AC GRIS 160X200 PB", "paquete": 25},
  {"fert": "20000537", "descripcion": "PROTECTOR CHN ACOLCHADO 200 BLANCO", "forro": "30020437", "descripcionForro": "FORRO PROTECTOR CHN AC BLANCO 200X200 PB", "paquete": 20},
  {"fert": "20000552", "descripcion": "PROTECTOR CHN ACOLCHADO 200 CAFÉ", "forro": "30020438", "descripcionForro": "FORRO PROTECTOR CHN AC CAFÉ 200X200 PB", "paquete": 20},
  {"fert": "20002214", "descripcion": "PROTECTOR CHN ACOLCHADO 200 AZUL", "forro": "30020439", "descripcionForro": "FORRO PROTECTOR CHN AC AZUL 200X200 PB", "paquete": 20},
  {"fert": "20002219", "descripcion": "PROTECTOR CHN ACOLCHADO 200 GRIS", "forro": "30020440", "descripcionForro": "FORRO PROTECTOR CHN AC GRIS 200X200 PB", "paquete": 20},
  {"fert": "20003308", "descripcion": "PROTECTOR ALM ACOLCHADO 050X070 BL", "forro": "30020610", "descripcionForro": "FORRO PROTECTOR ALM. ACOLCHADO 50X70 PB", "paquete": 50},
  {"fert": "20013410", "descripcion": "CHN BABY CHAIDE+PROTECTOR 68X96X7", "forro": "30024184", "descripcionForro": "FORRO PROT CHN IMPER KIT BB 68X96X06", "paquete": 20, "precio": 0.6},
  {"fert": "20013411", "descripcion": "CHN BABY CHAIDE+PROTECTOR 70X100X10", "forro": "30024185", "descripcionForro": "FORRO PROT CHN IMPER KIT BB 70X100X10", "paquete": 20, "precio": 0.6},
  {"fert": "20013412", "descripcion": "CHN BABY CHAIDE+PROTECTOR 70X130X10", "forro": "30024186", "descripcionForro": "FORRO PROT CHN IMPER KIT BB 70x130x10", "paquete": 20, "precio": 0.6},
  {"fert": "20002444", "descripcion": "PROTECTOR CHN COROSIL 160X200X029", "forro": "", "descripcionForro": "", "paquete": 0},
  {"fert": "20006908", "descripcion": "PRO.CHN.IMPERM.66X99 7862104398109 FAVO", "forro": "", "descripcionForro": "", "paquete": 10, "precio": 0.6},
  {"fert": "20013929", "descripcion": "PROTECTOR CHN IMPERMEABLE PLUS 160 AZ", "forro": "", "descripcionForro": "", "paquete": 30, "precio": 1.25},
  {"fert": "20013924", "descripcion": "PROTECTOR CHN IMPERMEABLE PLUS 135 BL", "forro": "", "descripcionForro": "", "paquete": 30, "precio": 1.1},
  {"fert": "20013925", "descripcion": "PROTECTOR CHN IMPERMEABLE PLUS 160 BL", "forro": "", "descripcionForro": "", "paquete": 30, "precio": 1.25},
  {"fert": "20013928", "descripcion": "PROTECTOR CHN IMPERMEABLE PLUS 135 AZ", "forro": "", "descripcionForro": "", "paquete": 30, "precio": 1.1},
  {"fert": "20013926", "descripcion": "PROTECTOR CHN IMPERMEABLE PLUS 200 BL", "forro": "", "descripcionForro": "", "paquete": 30, "precio": 1.5},
  {"fert": "20013930", "descripcion": "PROTECTOR CHN IMPERMEABLE PLUS 200 AZ", "forro": "", "descripcionForro": "", "paquete": 30, "precio": 1.5},
  {"fert": "20013927", "descripcion": "PROTECTOR CHN IMPERMEABLE PLUS 105 AZ", "forro": "", "descripcionForro": "", "paquete": 30, "precio": 1.0},
  {"fert": "20013923", "descripcion": "PROTECTOR CHN IMPERMEABLE PLUS 105 BL", "forro": "", "descripcionForro": "", "paquete": 30, "precio": 1.0},
];

export const TALLERES_PROTECTOR_EXCEL: TallerProtector[] = [
  {"nombre": "FRANCISCO GUALLICHICO", "codProveedor": "5258618", "ruta": "UIO750", "capacidadMin": 100, "capacidadMax": 150},
  {"nombre": "IZA IZA NELLY IMELDA", "codProveedor": "100394", "ruta": "UIO740", "capacidadMin": 250, "capacidadMax": 350},
  {"nombre": "PANCHI SARABIA EMMA BEATRIS", "codProveedor": "104339", "ruta": "UIO740", "capacidadMin": 150, "capacidadMax": 250},
];
