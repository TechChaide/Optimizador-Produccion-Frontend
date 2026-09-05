'use client';

import { useState, useCallback, useEffect } from 'react';
import { planGrupoService } from '@/services/plangrupo.service';
import { detalleTacticoService } from '@/services/detalletactico.service';
import { serviciosService } from '@/services/servicios.service';

// Fuente única de "Plan Final": unifica los Planes Táctico "PFF" de los Centros 1000 y 2000,
// filtrados a la fecha de "Día programación" fijada en la pestaña "Prog Tiempos" (localStorage
// 'sim_prog_dates'). Tanto la pestaña "Plan Final" como "Resumen Plan final" consumen este mismo
// hook para garantizar que ambas trabajen exactamente sobre el mismo conjunto de datos.
export interface PlanFinalRow {
  centro: string;
  linea: string;
  puestoTrabajo: string;
  codigoMaterial: string;
  descripcion: string;
  cantidad: number;
  ordFab: string;
  planValor: string;
  fechaPlan: string;
  codigoPlanGrupo: number;
  codigoDetalleTactico: number;
}

const CENTROS_PFF = ['1000', '2000'];

// Mapeo de equivalencias Máquina -> Línea (igual al usado en "Fert" y "Previsionales"): la Línea
// de una orden Fert se deriva de su Máquina, no de patrones en Categoría.
const MAQUINA_LINEA_MAP: Record<string, string> = {
  'HR-ARM01': 'LINEA 1',
  'HR-ARM02': 'LINEA 2',
  'HR-ARM03': 'LINEA 3',
  'HR-ARM05': 'LINEA 5',
  'HR-ARM21': 'LINEA 1',
  'HR-ARM22': 'LINEA 2',
  'HR-ARM25': 'LINEA 5',
};

// Ecuador = UTC-5 todo el año (sin horario de verano).
const ECUADOR_UTC_OFFSET_MS = 5 * 60 * 60 * 1000;

// A diferencia de "FECHA"/"FECHAINICIO" de OrdenesFert/Provisionales (que ya llegan como fecha simple
// "YYYY-MM-DD"), PlanGrupo.fecha_inicio_plan llega como timestamp UTC completo (ej.
// "2026-08-05T03:00:00.000Z"). Ese instante equivale a 2026-08-04 22:00 en Ecuador, así que tomar el
// prefijo UTC tal cual puede devolver el día calendario siguiente al que realmente corresponde en hora
// local — por eso los planes "PFF" nunca calzaban contra el "Día programación" (fecha calendario local,
// sin zona horaria). Para timestamps con hora se reexpresa el instante en hora de Ecuador antes de
// extraer el día; las fechas simples (sin hora) se toman literalmente, sin ningún ajuste de zona.
const normalizeDateISO = (dateStr: any): string | null => {
  if (!dateStr) return null;
  const s = String(dateStr).trim();

  // Fecha simple sin hora: DD/MM/YYYY o DD-MM-YYYY
  let match = s.match(/^(\d{1,2})[\/-](\d{1,2})[\/-](\d{4})$/);
  if (match) return `${match[3]}-${match[2].padStart(2, '0')}-${match[1].padStart(2, '0')}`;

  // Fecha simple sin hora: YYYY-MM-DD (p.ej. el valor de un <input type="date">)
  match = s.match(/^(\d{4})-(\d{1,2})-(\d{1,2})$/);
  if (match) return `${match[1]}-${match[2].padStart(2, '0')}-${match[3].padStart(2, '0')}`;

  // Timestamp completo (con hora/zona, típicamente UTC del backend): se reexpresa en hora de Ecuador.
  const parsed = new Date(s);
  if (isNaN(parsed.getTime())) return null;
  const local = new Date(parsed.getTime() - ECUADOR_UTC_OFFSET_MS);
  const y = local.getUTCFullYear();
  const m = String(local.getUTCMonth() + 1).padStart(2, '0');
  const d = String(local.getUTCDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
};

const normalizeMaterialCode = (code: string | number): string => {
  return String(code || '').trim().slice(-8);
};

const patternPFF = (centro: string) => `Plan Táctico - Centro ${centro} - PFF`;

export function usePlanFinalData() {
  const [rows, setRows] = useState<PlanFinalRow[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [diaProgramacion, setDiaProgramacion] = useState<string>('');

  const load = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      let progDates: Record<string, string> = {};
      try {
        const saved = localStorage.getItem('sim_prog_dates');
        if (saved) progDates = JSON.parse(saved);
      } catch (e) {}
      // "Día programación" de Prog Tiempos: se guarda espejada en 1000 y 2000, se usa un único valor.
      const targetDate = progDates['1000'] || progDates['2000'] || new Date().toISOString().split('T')[0];
      const targetDateISO = normalizeDateISO(targetDate);
      setDiaProgramacion(targetDate);

      const [planGruposRes, detallesRes, fertRes] = await Promise.all([
        planGrupoService.getAll(),
        detalleTacticoService.getAll(),
        serviciosService.getOrdenesFert(1, 10000),
      ]);
      const allPlanGrupos = Array.isArray(planGruposRes?.data) ? planGruposRes.data : (Array.isArray(planGruposRes) ? planGruposRes : []);
      const allDetalles = Array.isArray(detallesRes?.data) ? detallesRes.data : (Array.isArray(detallesRes) ? detallesRes : []);
      const allFert = Array.isArray(fertRes?.data) ? fertRes.data : [];

      // "Linea"/"OrdFab" se traen de "Fert", buscando por Centro+Material (ignorando ceros a la
      // izquierda vía normalizeMaterialCode), restringido a la misma "Día programación" que ya filtra
      // el resto de Plan Final, y quedándose con la PRIMERA orden Fert que aparezca para ese
      // Centro+Material — igual que el Centro 1000 de Plan Final busca únicamente en la sub-pestaña
      // "Centro 1000" de Fert, y el Centro 2000 en "Centro 2000".
      const fertByCentroMaterial = new Map<string, { linea: string; orden: string }>();
      allFert.forEach((o: any) => {
        if (normalizeDateISO(o.FECHA || o.fecha) !== targetDateISO) return;
        const centro = String(o.CENTRO || '').trim();
        const material = normalizeMaterialCode(o.MATERIAL || o.Material || o.CodMaterial);
        if (!centro || !material) return;
        const key = `${centro}|${material}`;
        if (fertByCentroMaterial.has(key)) return;

        const maquina = String(o.MAQUINA || o.Maquina || o.maquina || '').trim().toUpperCase();
        const linea = MAQUINA_LINEA_MAP[maquina] || '';
        const orden = String(o.ORDEN || '').trim();
        fertByCentroMaterial.set(key, { linea, orden });
      });

      // Planes "PFF" vigentes (estado 'A') de los Centros 1000 y 2000, en la fecha objetivo.
      const matchedPlans = CENTROS_PFF.flatMap(centro => {
        const pattern = patternPFF(centro);
        return allPlanGrupos
          .filter((p: any) => p.estado === 'A' && p.valor === pattern && normalizeDateISO(p.fecha_inicio_plan) === targetDateISO)
          .map((p: any) => ({ ...p, _centro: centro }));
      });

      const planById = new Map<number, any>();
      matchedPlans.forEach(p => planById.set(p.codigo_plan_grupo, p));

      const detalles = allDetalles.filter((d: any) => d.estado === 'A' && planById.has(d.codigo_plan_grupo));

      // Join con la matriz técnica (Centro+Línea+Material) para resolver "Puesto Trabajo" y descripción,
      // ya que DetalleTactico no guarda esa información directamente.
      const puestoMap = new Map<string, string>();
      const descMap = new Map<string, string>();
      // Mapa auxiliar Centro+Material -> primera descripción encontrada (sin importar la línea), para
      // poder mostrar al menos la descripción del material cuando el detalle táctico no trae
      // "linea_produccion" (ver más abajo) y por lo tanto no se puede armar la clave Centro+Línea+Material.
      const descByCentroMaterial = new Map<string, string>();

      if (detalles.length > 0) {
        let allTiempos: any[] = [];
        let page = 1;
        let hasMore = true;
        while (hasMore && page <= 10) {
          const response = await serviciosService.getTiemposEnsamblado(page, 5000);
          const raw = Array.isArray(response?.data) ? response.data : [];
          allTiempos = [...allTiempos, ...raw];
          if (raw.length < 5000) hasMore = false; else page++;
        }

        allTiempos.forEach(t => {
          const centro = String(t.Centro || '').trim();
          const linea = String(t.Linea || '').trim().toUpperCase();
          const material = normalizeMaterialCode(t.CodMaterial);
          const key = `${centro}|${linea}|${material}`;
          const desc = String(t.Material || t.NombreMaterial || '').trim();
          if (!puestoMap.has(key)) puestoMap.set(key, String(t.PuestoTrabajo || '').trim() || 'N/D');
          if (!descMap.has(key)) descMap.set(key, desc);
          const centroMaterialKey = `${centro}|${material}`;
          if (!descByCentroMaterial.has(centroMaterialKey)) descByCentroMaterial.set(centroMaterialKey, desc);
        });
      }

      const unified: PlanFinalRow[] = detalles.map((d: any) => {
        const plan = planById.get(d.codigo_plan_grupo);
        const centro = plan?._centro || '';
        // Algunos detalles tácticos "PFF" no traen "linea_produccion" (llega null desde el origen). En
        // ese caso no hay forma confiable de inferirla: un mismo material puede ensamblarse en más de una
        // línea, así que se deja "N/D" en vez de adivinar y arrastrar un Puesto Trabajo incorrecto.
        const lineaRaw = String(d.linea_produccion || '').trim().toUpperCase();
        const material = normalizeMaterialCode(d.codigo_material);
        const key = `${centro}|${lineaRaw}|${material}`;

        // "Linea"/"OrdFab" vienen de la primera orden Fert de este Centro+Material. Si el material no
        // tiene ninguna orden Fert en ese Centro, "Linea" conserva el respaldo de linea_produccion
        // (Puesto Trabajo/Descripción siguen resolviéndose contra ESTA linea_produccion, sin cambios).
        const fertMatch = fertByCentroMaterial.get(`${centro}|${material}`);
        const linea = fertMatch?.linea || lineaRaw || 'N/D';
        const ordFab = fertMatch?.orden || '';

        return {
          centro,
          linea,
          puestoTrabajo: lineaRaw ? (puestoMap.get(key) || 'N/D') : 'N/D',
          codigoMaterial: material,
          descripcion: descMap.get(key) || descByCentroMaterial.get(`${centro}|${material}`) || `Material ${material}`,
          cantidad: Number(d.cantidad_produccion_neta) || 0,
          ordFab,
          planValor: plan?.valor || '',
          fechaPlan: normalizeDateISO(plan?.fecha_inicio_plan) || '',
          codigoPlanGrupo: d.codigo_plan_grupo,
          codigoDetalleTactico: d.codigo_detalle_tactico,
        };
      });

      setRows(unified);
    } catch (err) {
      setError((err as Error).message);
      setRows([]);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  return { rows, isLoading, error, diaProgramacion, reload: load };
}
