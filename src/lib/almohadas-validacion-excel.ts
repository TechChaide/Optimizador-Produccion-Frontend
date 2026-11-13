/**
 * Lee el Excel "Planificación_Forros_ALM_26" (valores calculados guardados por Excel, no las fórmulas)
 * para comparar contra el módulo de Subcontratación forro por forro.
 *  - REV PED COMPRAS (fila 4+): F Código, G NEC FORROS, H stock 1014, J REP SEMANA 1 (tránsito),
 *    K PP/SS, L Stock final, M lote MIN, N lote MAX, P PED PROV, V consumo diario; E2 = fecha de corte.
 *  - CALCULO SS-PP (fila 13+): B material, BA consumo semanal, BC desviación semanal, CI material,
 *    CK PP (×1.25), CL SS (×1.25).
 *  - PED COMPRAS: pedidos abiertos (mismas columnas que ME2N) → tránsito.
 */
import * as XLSX from 'xlsx';

export interface ValoresExcelForro {
  codigo: string;
  necesidad: number;
  stock: number;
  transito: number;
  ppss: number;
  stockFinal: number;
  loteMin: number;
  loteMax: number;
  pedido: number;
  consumoDiario: number;
  consumoSemanal: number;
  desvSemanal: number;
  ss: number;
  pp: number;
}

export interface ExcelValidacion {
  nombre: string;
  fechaCorte: string;
  forros: Map<string, ValoresExcelForro>;
  // Pedidos abiertos de la hoja PED COMPRAS (Por entregar), por material.
  transito: Map<string, number>;
}

type Celda = unknown;
const n = (v: Celda): number => {
  const x = typeof v === 'number' ? v : Number(String(v ?? '').replace(/,/g, ''));
  return Number.isFinite(x) ? x : 0;
};
const codigo = (v: Celda): string => {
  const s = String(v ?? '').trim().replace(/\.0$/, '').replace(/^0+/, '');
  return /^\d{6,}$/.test(s) ? s : '';
};
const iso = (v: Celda): string => {
  if (v instanceof Date && !isNaN(v.getTime())) {
    return `${v.getFullYear()}-${String(v.getMonth() + 1).padStart(2, '0')}-${String(v.getDate()).padStart(2, '0')}`;
  }
  return '';
};
const col = (letras: string): number => XLSX.utils.decode_col(letras);

const hoja = (wb: XLSX.WorkBook, nombre: string): Celda[][] => {
  const clave = wb.SheetNames.find(s => s.normalize('NFC').trim().toUpperCase() === nombre.toUpperCase());
  if (!clave) return [];
  const ws = wb.Sheets[clave];
  // Se lee desde A1 aunque la hoja empiece más abajo (CALCULO SS-PP arranca en A3): índice = fila − 1.
  const fin = XLSX.utils.decode_range(ws['!ref'] || 'A1').e;
  return XLSX.utils.sheet_to_json<Celda[]>(ws, { header: 1, raw: true, defval: null, blankrows: true, range: { s: { r: 0, c: 0 }, e: fin } });
};

export const leerExcelValidacion = async (archivo: File): Promise<ExcelValidacion> => {
  const wb = XLSX.read(await archivo.arrayBuffer(), {
    type: 'array',
    cellDates: true,
    sheets: ['REV PED COMPRAS', 'CALCULO SS-PP', 'PED COMPRAS'],
  });
  const rev = hoja(wb, 'REV PED COMPRAS');
  if (rev.length === 0) throw new Error('El archivo no tiene la hoja "REV PED COMPRAS".');

  const forros = new Map<string, ValoresExcelForro>();
  for (let i = 3; i < rev.length; i++) {
    const r = rev[i] || [];
    const c = codigo(r[col('F')]);
    if (!c || forros.has(c)) continue;
    forros.set(c, {
      codigo: c,
      necesidad: n(r[col('G')]),
      stock: n(r[col('H')]),
      transito: n(r[col('J')]),
      ppss: n(r[col('K')]),
      stockFinal: n(r[col('L')]),
      loteMin: n(r[col('M')]),
      loteMax: n(r[col('N')]),
      pedido: n(r[col('P')]),
      consumoDiario: n(r[col('V')]),
      consumoSemanal: 0,
      desvSemanal: 0,
      ss: 0,
      pp: 0,
    });
  }

  const calc = hoja(wb, 'CALCULO SS-PP');
  const vistosB = new Set<string>();
  const vistosI = new Set<string>();
  for (let i = 12; i < calc.length; i++) {
    const r = calc[i] || [];
    const cB = codigo(r[col('B')]);
    // Primera aparición: el mismo código vuelve a salir más abajo en otra tabla dinámica.
    const fB = cB ? forros.get(cB) : undefined;
    if (fB && !vistosB.has(cB)) {
      vistosB.add(cB);
      fB.consumoSemanal = n(r[col('BA')]);
      fB.desvSemanal = n(r[col('BC')]);
    }
    const cI = codigo(r[col('CI')]);
    const fI = cI ? forros.get(cI) : undefined;
    if (fI && !vistosI.has(cI)) {
      vistosI.add(cI);
      fI.pp = n(r[col('CK')]);
      fI.ss = n(r[col('CL')]);
    }
  }

  const transito = new Map<string, number>();
  const ped = hoja(wb, 'PED COMPRAS');
  if (ped.length > 1) {
    const enc = (ped[0] || []).map(h => String(h ?? '').trim().toUpperCase());
    const iMat = enc.indexOf('MATERIAL');
    const iAlm = enc.findIndex(h => h.startsWith('ALMAC'));
    const iPend = enc.findIndex(h => h.startsWith('POR ENTREGAR'));
    if (iMat >= 0 && iPend >= 0) {
      ped.slice(1).forEach(r => {
        const m = codigo(r?.[iMat]);
        const q = n(r?.[iPend]);
        if (!m || q <= 0) return;
        if (iAlm >= 0 && codigo(r?.[iAlm]) && String(r?.[iAlm]).trim() !== '1014') return;
        transito.set(m, (transito.get(m) ?? 0) + q);
      });
    }
  }

  return { nombre: archivo.name, fechaCorte: iso(rev[1]?.[col('E')]), forros, transito };
};
