/**
 * PIO — Producción por Inventario Objetivo
 * Construye el mapa de materiales elegibles con su promedio diario e inventario objetivo.
 * Solo aplica a sector colchones, top N por etiqueta, segun restricciones DIAS_INV_OBJETIVO_*.
 */

import type { TiempoCanonResult, PioMap, PioMaterialEntry } from './types';
import { normalizeMaterialCode } from './utils';

const SECTOR_COLCHONES = '01 COLCHONES';

export function buildPioMap(
  bottleneckData: any[],
  tiemposCanon: TiempoCanonResult[],
  restricciones: any[],
  firstThreeMeses: number[]
): PioMap {
  const map: PioMap = new Map();

  const topN =
    parseInt(
      restricciones.find(r => r.nombre_restriccion === 'TOP_N_INV_OBJETIVO')
        ?.valor_restriccion ?? '2'
    ) || 2;

  // Días de inventario objetivo POR CENTRO. Cada restricción trae el centro de
  // su grupo (`r.grupo.centro`), así dos centros pueden tener días distintos
  // para la misma etiqueta. Se mantiene un fallback "global" por etiqueta por si
  // algún grupo no trae centro (compatibilidad con el comportamiento anterior).
  const diasPorCentroEtiqueta = new Map<string, number>(); // `${centro}|${etiqueta}` -> dias
  const diasGlobalPorEtiqueta = new Map<string, number>(); // etiqueta -> dias (fallback)
  restricciones
    .filter(r => String(r.nombre_restriccion ?? '').startsWith('DIAS_INV_OBJETIVO_'))
    .forEach(r => {
      const etiqueta = String(r.nombre_restriccion).replace('DIAS_INV_OBJETIVO_', '').trim();
      const dias = parseInt(r.valor_restriccion) || 10;
      const centro = String(r?.grupo?.centro ?? '').trim();
      if (centro) diasPorCentroEtiqueta.set(`${centro}|${etiqueta}`, dias);
      diasGlobalPorEtiqueta.set(etiqueta, dias);
    });

  if (diasGlobalPorEtiqueta.size === 0 || firstThreeMeses.length === 0) return map;

  // Días objetivo para (centro, etiqueta): específico por centro, con fallback
  // al valor global de la etiqueta y, en último caso, 10 días.
  const diasObjetivoDe = (centro: string, etiqueta: string): number =>
    diasPorCentroEtiqueta.get(`${centro}|${etiqueta}`) ??
    diasGlobalPorEtiqueta.get(etiqueta) ??
    10;

  const totalDias = firstThreeMeses.reduce((sum, mes) => {
    const tc = tiemposCanon.find(t => t.mesNumero === mes);
    return sum + (tc?.diasLaborables ?? 0);
  }, 0);

  if (totalDias === 0) return map;

  type MatAcc = { matCode: string; etiqueta: string; centro: string; totalUds: number };
  const byCentroEtMat = new Map<string, MatAcc>();

  for (const r of bottleneckData) {
    const sector = String(r.Sector || '').trim();
    const etiqueta = String(r.Etiqueta || '').trim();
    const mes = parseInt(String(r.Mes ?? r.mes ?? '0'));
    const uds = parseFloat(String(r.UnidadesProyectado ?? '0')) || 0;
    if (
      sector !== SECTOR_COLCHONES ||
      !diasGlobalPorEtiqueta.has(etiqueta) ||
      !firstThreeMeses.includes(mes) ||
      uds <= 0
    ) continue;

    const matCode = normalizeMaterialCode(r.CodMaterial ?? '');
    const centro = String(r.Centro || '').trim();
    const key = `${centro}|${etiqueta}|${matCode}`;
    const prev = byCentroEtMat.get(key);
    if (prev) prev.totalUds += uds;
    else byCentroEtMat.set(key, { matCode, etiqueta, centro, totalUds: uds });
  }

  const byCentroEt = new Map<string, MatAcc[]>();
  byCentroEtMat.forEach(acc => {
    const key = `${acc.centro}|${acc.etiqueta}`;
    if (!byCentroEt.has(key)) byCentroEt.set(key, []);
    byCentroEt.get(key)!.push(acc);
  });

  byCentroEt.forEach((mats, key) => {
    const sepIdx = key.indexOf('|');
    const centro = key.slice(0, sepIdx);
    const etiqueta = key.slice(sepIdx + 1);
    const diasObjetivo = diasObjetivoDe(centro, etiqueta);
    mats
      .sort((a, b) => b.totalUds - a.totalUds)
      .slice(0, topN)
      .forEach(acc => {
        const promDiario = acc.totalUds / totalDias;
        const entry: PioMaterialEntry = {
          promDiario,
          invObjetivo: promDiario * diasObjetivo,
          etiqueta,
        };
        map.set(`${acc.matCode}|${centro}`, entry);
      });
  });

  return map;
}
