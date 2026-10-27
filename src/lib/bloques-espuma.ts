// Reglas comunes de bloque de espuma — Corte Espuma (tab Sub-Bloques-T8) y Formulación las comparten
// para que lámina → sub-bloques → bloques salga igual en los dos módulos (usuario 2026-10-27).
//
//  - Aperturas técnicas (194.5/206/219/228): salen de un bloque madre de LARGO_BLOQUE_M y se cuentan
//    en bloques = Σ (sub-bloques × ancho) ÷ LARGO_BLOQUE_M.
//  - Combinación (105/115/135/145/160/200…: visco, látex, HS, BIO): el sub-bloque ya llega a la medida
//    de corte, se cuenta en UN = sub-bloques.
//  - Sub-bloques ENTEROS = ⌈cantidad ÷ ⌊altura útil ÷ espesor⌋⌉ — 0.7 sub-bloques no existen.
//  - Altura útil: bloque de ALTURA_BLOQUE_CM menos la cúpula (CUPULA_MAX_CM) = 103 cm; 85 cm para
//    D ≥ 28 (confirmado para aperturas técnicas; visco/HS/BIO pendiente de su altura real).

export const APERTURAS_TECNICAS = ['194.5', '206', '219', '228'];
export const esAperturaTecnica = (apertura: string): boolean => APERTURAS_TECNICAS.includes(apertura);

// Largo del bloque madre (m).
export const LARGO_BLOQUE_M = 20;

// Modelo de bloque (usuario 2026-10-17, valores por verificar en planta): bloque real de ~108 cm; la
// cúpula se despeja con ~4 cm de corte y nunca más de 5 cm → altura útil 108 − 5 = 103.
export const ALTURA_BLOQUE_CM = 108;
export const CUPULA_CM = 4;
export const CUPULA_MAX_CM = 5;
export const ALTURA_UTIL_CM = ALTURA_BLOQUE_CM - CUPULA_MAX_CM;
export const DENSIDAD_ALTURA_REDUCIDA = 28;
export const ALTURA_UTIL_REDUCIDA_CM = 85;

export const alturaUtilCm = (densidad: number): number =>
  densidad >= DENSIDAD_ALTURA_REDUCIDA ? ALTURA_UTIL_REDUCIDA_CM : ALTURA_UTIL_CM;

// alturaMaestroCm: "Altura" del material en KPIMaestroCarruseles (usuario 2026-10-27) — la altura útil
// real de ese material, también para visco/HS/BIO. Sin ella (material fuera del maestro) se usa la
// regla por densidad.
export const unidadesPorSubBloque = (densidad: number, espesorCm: number, alturaMaestroCm?: number): number =>
  Math.max(1, Math.floor((alturaMaestroCm && alturaMaestroCm > 0 ? alturaMaestroCm : alturaUtilCm(densidad)) / espesorCm));

export const subBloquesEnteros = (cantidad: number, unidadesPorSub: number): number =>
  Math.ceil(cantidad / unidadesPorSub - 1e-9);

// Metros de bloque madre que consumen los sub-bloques (cada uno ocupa su ancho a lo largo del bloque).
export const longitudSubBloquesM = (subBloques: number, anchoCm: number): number => (subBloques * anchoCm) / 100;

// Densidad desde la categoría FERT: "CM-LAM-D30NR-194.5" → "30".
export const densidadDeCategoria = (categoria: string): string | undefined =>
  String(categoria || '').match(/(?:^|-)D(\d+(?:\.\d+)?)/i)?.[1];

// Apertura desde la categoría: segmento numérico de 3 cifras, "CM-LAM-D12SL-194.5" → "194.5".
export const aperturaDeCategoria = (categoria: string): string | undefined =>
  String(categoria || '').split(/[-_\s]/).reverse().find(s => /^\d{3}(\.\d+)?$/.test(s));

// Tipo de espuma = categoría sin el segmento de apertura: "CM-LAM-D12SL-194.5" → "CM-LAM-D12SL".
export const tipoDeCategoria = (categoria: string): string =>
  String(categoria || '').split('-').filter(s => !/^\d{3}(\.\d+)?$/.test(s.trim())).join('-');

// Tipo de espuma desde la descripción (respaldo cuando la FERT no trae categoría): las palabras que no
// son LAMINA/ESPUMA, la densidad ni la medida. "LAMINA ESPUMA D15 NG FRR 100X200X1.5" → "NG FRR",
// "LAMINA D15 AM AF 103X188X3.2" → "AM AF", "LAMINA SPRING D15 101X023X1" → "SPRING".
export const tipoEspumaDesc = (descripcion: string): string =>
  String(descripcion || '').toUpperCase().split(/\s+/)
    .filter(w => w && !/^(LAMINA|LÁMINA|ESPUMA)$/.test(w) && !/^D\d+(\.\d+)?$/.test(w) && !/\d+(\.\d+)?X\d/.test(w))
    .join(' ');
