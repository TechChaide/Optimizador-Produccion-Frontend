/**
 * Constantes de IV5.
 *
 * Sectores con tope agregado de stock final (regla del usuario):
 * - Centro 1000: 19500 unidades para 01 + 02 + 03 (sumadas).
 * - Centro 2000: 12500 unidades para 01 + 02 + 03 (sumadas).
 *
 * Estos topes son parametrizables desde la UI (Iv5StockCapEditor) y se persisten
 * en localStorage bajo `iv5_stock_caps`.
 */

/** Codigos de sector que cuentan para el tope agregado (los que arrancan con "01", "02", "03"). */
export const IV5_SECTORES_TOPE_AGREGADO = ['01', '02', '03'] as const;

/** Tope agregado por defecto (Centro 1000) para los 3 sectores. */
export const IV5_DEFAULT_CAP_C1000 = 19500;

/** Tope agregado por defecto (Centro 2000) para los 3 sectores. */
export const IV5_DEFAULT_CAP_C2000 = 12500;

/** Bloque minimo de horas extras (en horas). El usuario confirmo HE en multiplos de 2h. */
export const IV5_HE_BLOCK_HOURS = 2;

/** Maximo de sabados/mes parametrizable por la UI (limite fisico). */
export const IV5_DEFAULT_MAX_SABADOS_MES = 3;

/** Clave de persistencia local para topes agregados editables. */
export const IV5_STOCK_CAPS_STORAGE_KEY = 'iv5_stock_caps';

/** Clave de persistencia local para versiones IV5. */
export const IV5_VERSIONS_STORAGE_KEY = 'iv5_versions';

/** Clave de persistencia local para tope de sabados editable por usuario. */
export const IV5_MAX_SABADOS_STORAGE_KEY = 'iv5_max_sabados_mes';

/** Identificador de plan global para versiones IV5 (mismo schema PMP-V-{n} que IV3/IV4). */
export const IV5_PLAN_PREFIX = 'PMP-V-';

/** Tamanio de lote para `detallesService.savePlanSemanalBulk`. */
export const IV5_BULK_BATCH_SIZE = 1000;

/**
 * Linea virtual usada en C2000 para representar materiales clase F cuya
 * fabricacion se hace en C1000. Tiene capacidad 0, asi el prorrateo no le
 * reserva minutos pero la progresiva si contabiliza la demanda asociada
 * (ventas de C2000 cubiertas con stock + traslado entrante desde C1000).
 */
export const IV5_VIRTUAL_TRANSFER_LINE = '__IV5_TRANSFER_INCOMING__';
