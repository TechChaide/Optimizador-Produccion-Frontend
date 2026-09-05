/**
 * Persistencia IV5.
 *
 * 1) Versiones locales en `localStorage` (clave `iv5_versions`).
 *    - `loadIv5Versions`, `saveIv5Versions`.
 *
 * 2) `saveIv5DetailsBatch`: espejo de `saveIv4DetailsBatch` (IV4) usando
 *    `detallesService.savePlanSemanalBulk` en lotes de 1000 registros, sobre
 *    el ledger semanal IV5. Mantiene el mismo schema `DetallePlanSemanal`
 *    para reusar el endpoint y no requerir cambios backend.
 *
 *    Mapeo de columnas:
 *      - cantidad_proyectada     <- demanda
 *      - cantidad_producir       <- produccionBase + produccionAlternativa
 *                                   + produccionAdelanto + produccionPio
 *      - cantidad_transferencia  <- trasladoSaliente
 *      - centro                  <- centro
 *      - centro_produccion       <- sectorRef
 *      - codigo_material         <- material
 *      - linea_produccion        <- linea
 *      - semana                  <- isoWeek
 */

import { detallesService } from '@/services/detalles.service';
import { planGlobalService } from '@/services/planglobal.service';
import type { DetallePlanSemanal, PlanGlobal } from '@/types/interfaces';
import type { Iv5RunResult, Iv5Version, Iv5WeeklyRow } from './iv5Types';
import { IV5_BULK_BATCH_SIZE, IV5_PLAN_PREFIX, IV5_VERSIONS_STORAGE_KEY } from './iv5Constants';

export function loadIv5Versions(): Iv5Version[] {
  try {
    const raw = localStorage.getItem(IV5_VERSIONS_STORAGE_KEY);
    return raw ? (JSON.parse(raw) as Iv5Version[]) : [];
  } catch {
    return [];
  }
}

export function saveIv5Versions(list: Iv5Version[]): void {
  try {
    localStorage.setItem(IV5_VERSIONS_STORAGE_KEY, JSON.stringify(list));
  } catch (err) {
    console.error('[IV5] Error guardando versiones en localStorage:', err);
  }
}

/**
 * Convierte un ledger IV5 a payload `DetallePlanSemanal[]` y lo persiste por
 * lotes en el endpoint `savePlanSemanalBulk`.
 */
export async function saveIv5DetailsBatch(
  rows: Iv5WeeklyRow[],
  codigoPlan: number,
  onProgress?: (done: number, total: number) => void,
): Promise<void> {
  if (!Array.isArray(rows) || rows.length === 0) return;
  let done = 0;
  for (let i = 0; i < rows.length; i += IV5_BULK_BATCH_SIZE) {
    const batch = rows.slice(i, i + IV5_BULK_BATCH_SIZE);
    const payload: DetallePlanSemanal[] = batch.map((r) => ({
      codigo_detalle: 0,
      codigo_plan: codigoPlan,
      codigo_familia_producto: 1,
      centro: String(r.centro || ''),
      centro_produccion: String(r.sectorRef || ''),
      codigo_material: String(r.material || ''),
      // Para C1000, la demanda clase F de C2000 vive como necesidadTraslado:
      // guardamos la demanda operativa del centro para no persistir 0 en esas filas.
      cantidad_proyectada: Number((r.demanda || 0) + (r.necesidadTrasladoSemana || 0)),
      cantidad_producir: Number(
        (r.produccionBase || 0) +
          (r.produccionAlternativa || 0) +
          (r.produccionAdelanto || 0) +
          (r.produccionPio || 0),
      ),
      semana: Number(r.isoWeek || 0),
      cantidad_transferencia: Number(r.trasladoSaliente || 0),
      linea_produccion: String(r.linea || ''),
      estado: 'A',
    }));
    await detallesService.savePlanSemanalBulk(payload);
    done += batch.length;
    onProgress?.(done, rows.length);
  }
}

/**
 * Calcula el siguiente identificador `PMP-V-{n}` libre consultando
 * `planGlobalService.getAll()` (no destructivo, comparte la convencion con IV3/IV4).
 */
export async function nextPlanIdentifier(): Promise<string> {
  try {
    const res = await planGlobalService.getAll();
    const list = res.data ?? [];
    const usados = new Set<number>();
    for (const p of list as PlanGlobal[]) {
      const m = String(p.identificador_plan ?? '').match(/^PMP-V-(\d+)$/);
      if (m) {
        const n = Number(m[1]);
        if (Number.isFinite(n)) usados.add(n);
      }
    }
    let n = 1;
    while (usados.has(n)) n++;
    return `${IV5_PLAN_PREFIX}${n}`;
  } catch (err) {
    console.error('[IV5] No se pudo derivar identificador, usando timestamp:', err);
    return `${IV5_PLAN_PREFIX}${Date.now()}`;
  }
}

export interface SaveToPlanGlobalParams {
  resultC1000: Iv5RunResult | null;
  resultC2000: Iv5RunResult | null;
  fechaInicio: Date;
  fechaFin: Date;
  usuarioCreacion?: string;
  onProgress?: (done: number, total: number) => void;
}

/**
 * Crea el `PlanGlobal` y persiste todos los registros IV5 (C1000 + C2000) en
 * el backend usando los endpoints existentes. Devuelve el `codigo_plan`.
 */
export async function saveIv5ToPlanGlobal({
  resultC1000,
  resultC2000,
  fechaInicio,
  fechaFin,
  usuarioCreacion = 'IV5',
  onProgress,
}: SaveToPlanGlobalParams): Promise<{ codigoPlan: number; identificador: string; totalRegistros: number; }> {
  const ledger: Iv5WeeklyRow[] = [
    ...(resultC1000?.ledger ?? []),
    ...(resultC2000?.ledger ?? []),
  ];
  if (ledger.length === 0) {
    throw new Error('No hay registros IV5 para guardar.');
  }
  const identificador = await nextPlanIdentifier();
  const planPayload: PlanGlobal = {
    codigo_plan: 0,
    identificador_plan: identificador,
    fecha_inicio: fechaInicio,
    fecha_fin: fechaFin,
    estado: 'A',
    fecha_creacion: new Date(),
    usuario_creacion: usuarioCreacion,
  };
  const planRes = await planGlobalService.save(planPayload);
  const codigoPlan = Number((planRes.data as PlanGlobal | undefined)?.codigo_plan ?? 0);
  if (!codigoPlan) {
    throw new Error('No se pudo obtener codigo_plan del backend.');
  }
  await saveIv5DetailsBatch(ledger, codigoPlan, onProgress);
  return { codigoPlan, identificador, totalRegistros: ledger.length };
}
