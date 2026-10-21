'use client';

import React, { useEffect, useMemo, useState } from 'react';
import { format, parseISO } from 'date-fns';
import { es } from 'date-fns/locale';
import { Layers, Loader2, Mail, Minus, Plus } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { useAppContext } from '@/context/AppProvider';
import { restriccionService } from '@/services/restriccion.service';
import { serviciosService } from '@/services/servicios.service';

// Tab "Consumo Acolchadoras" de Laminado (usuario 2026-10-19). SOLO CONSULTA: no participa del
// cálculo del plan ni del envío a SAP. Toma las órdenes FERT de la fecha del plan cuya MAQUINA es una
// acolchadora (HR-ACH02, PT-ACH02, ...), suma lo planificado por máquina y referencia, explota el BOM
// de cada referencia hasta la LAMINA CILINDRICA y convierte esos Kg en rollos con el PesoUN del
// maestro Looper — para ver cuántos rollos y de qué referencia consume cada acolchadora.
// HISTÓRICO (Prom Prod Turno H y Un/Mtrs) y Nivel_Prod quedan pendientes: el usuario está generando
// el servicio con el cubo histórico. El TURNO tampoco viene en la orden FERT; ese nivel se agrega
// cuando llegue ese cubo.

type RawApiRow = Record<string, unknown>;

interface ExplosionRow {
  MATERIAL_PADRE?: string;
  COMPONENTE?: string;
  DESCRIPCION_COMPONENTE?: string;
  CANTIDAD_UNITARIA?: number | string;
  CANTIDAD_ACUMULADA?: number | string;
}

interface LaminaConsumo {
  codigo: string;
  descripcion: string;
  kgPorUnidad: number; // Kg de lámina por unidad (metro/ST) de la referencia
  kg: number;
  pesoUN: number;
  rollos: number;
}

interface Referencia {
  material: string;
  nombre: string;
  unidad: string;
  cantidad: number;
  ordenes: string[];
  laminas: LaminaConsumo[];
}

interface Maquina {
  maquina: string;
  cantidad: number;
  referencias: Referencia[];
}

interface Acolchadora {
  nombre: string;
  cantidad: number;
  kg: number;
  rollos: number;
  maquinas: Maquina[];
}

// Fila de la vista: una lámina en una máquina, con las referencias de acolchado que la consumen.
interface FilaLamina {
  key: string;
  maquina: string;
  codigo: string;
  descripcion: string;
  pesoUN: number;
  cantidad: number; // Un/Mtrs planificados de las referencias que usan esta lámina
  kg: number;
  rollos: number; // exactos; en pantalla se redondean al entero superior (rollosEnteros)
  referencias: { material: string; nombre: string; unidad: string; cantidad: number; ordenes: string[]; kgPorUnidad: number; kg: number }[];
}

interface BloqueAcolchadora {
  nombre: string;
  maquinas: string[];
  cantidad: number;
  kg: number;
  rollosUn: number;
  filas: FilaLamina[];
  sinLamina: Referencia[];
}

// Rollos completos que se entregan a la máquina: 11.4 -> 12. El epsilon evita que 12.0000001 por
// redondeo de punto flotante suba a 13.
const rollosEnteros = (f: { rollos: number; pesoUN: number }) => (f.pesoUN > 0 ? Math.ceil(f.rollos - 1e-6) : 0);

const safeNum = (val: unknown): number => {
  const n = Number(val);
  return isNaN(n) ? 0 : n;
};

const cleanCode = (code: unknown): string => String(code || '').replace(/^0+/, '').trim();

const getProp = (obj: RawApiRow, keys: string[]): string => {
  const rowKeys = Object.keys(obj);
  for (const k of keys) {
    const found = rowKeys.find(rk => rk.toLowerCase().trim() === k.toLowerCase().trim());
    if (found) return String(obj[found] ?? '').trim();
  }
  return '';
};

// "HR-ACH02" / "PT-ACH02" / "ACOLCHADORA02" -> "02". Sin número de acolchadora -> null (no es acolchadora).
const numeroAcolchadora = (maquina: string): string | null => {
  const m = maquina.toUpperCase().match(/(?:ACH|ACOLCHADORA)\s*-?\s*(\d{1,2})\b/);
  return m ? m[1].padStart(2, '0') : null;
};

const fmt = (n: number, dec = 0) => n.toLocaleString('es-EC', { minimumFractionDigits: dec, maximumFractionDigits: dec });

// Caché a nivel de módulo: el TabsContent se desmonta al cambiar de pestaña y así no se vuelve a
// explotar el mismo material al regresar.
const explosionCache = new Map<string, ExplosionRow[]>();
const getExplosion = async (code: string): Promise<ExplosionRow[]> => {
  if (explosionCache.has(code)) return explosionCache.get(code)!;
  let rows: ExplosionRow[] = [];
  try {
    const response = await serviciosService.getMaestroMaterialesExplosion('1000', code.padStart(18, '0'), 1, 500);
    const data = response?.data?.data || response?.data || [];
    rows = Array.isArray(data) ? data : [];
  } catch (e) {
    console.warn(`Consumo Acolchadoras: error explotando ${code}:`, (e as Error).message);
  }
  explosionCache.set(code, rows);
  return rows;
};

// Kg de lámina por unidad de la referencia. Mismo criterio que Resumen Necesidades: hijos directos
// (MATERIAL_PADRE = código) con "LAMINA CILINDRICA", una fila por componente (el servicio duplica la
// fila por cada FERT_PRINCIPAL que lo consume; CANTIDAD_UNITARIA es constante entre duplicados). Si la
// referencia no trae la lámina directa (ej. una Tapa), se baja por sus hijos ACOLCHADO/TAPA
// multiplicando las cantidades unitarias, hasta 3 niveles.
const laminasPorUnidad = async (code: string, nivel = 0): Promise<Map<string, { descripcion: string; kgPorUnidad: number }>> => {
  const out = new Map<string, { descripcion: string; kgPorUnidad: number }>();
  if (nivel > 3) return out;
  const rows = (await getExplosion(code)).filter(r => cleanCode(r.MATERIAL_PADRE) === code || !r.MATERIAL_PADRE);
  const vistos = new Set<string>();
  for (const r of rows) {
    const comp = cleanCode(r.COMPONENTE);
    if (!comp || vistos.has(comp)) continue;
    vistos.add(comp);
    const desc = String(r.DESCRIPCION_COMPONENTE || '').toUpperCase();
    const cant = safeNum(r.CANTIDAD_UNITARIA || r.CANTIDAD_ACUMULADA || 0);
    if (desc.includes('LAMINA CILINDRICA')) {
      const prev = out.get(comp);
      out.set(comp, { descripcion: desc, kgPorUnidad: (prev?.kgPorUnidad || 0) + cant });
    } else if (desc.startsWith('ACOLCHADO') || desc.startsWith('TAPA')) {
      const hijos = await laminasPorUnidad(comp, nivel + 1);
      hijos.forEach((v, k) => {
        const prev = out.get(k);
        out.set(k, { descripcion: v.descripcion, kgPorUnidad: (prev?.kgPorUnidad || 0) + v.kgPorUnidad * cant });
      });
    }
  }
  return out;
};

interface InventarioRow {
  MATERIAL?: unknown;
  ALMACEN?: unknown;
  LIBREUTILIZACION?: unknown;
}

// Mismas bodegas que Resumen Necesidades de Laminado (getStockKg: 1006/1008/1015, LIBREUTILIZACION en Kg).
const BODEGAS_STOCK = ['1006', '1008', '1015'] as const;

// Correo "Rollos requeridos por referencia de lámina" (usuario 2026-10-21): solo el resumen de arriba,
// con el mismo esqueleto HTML del reporte de Laminado (cabecera Chaide, KPIs, tabla, pie). Destinatarios
// precargados de la restricción GRUPO_CONTROL_CONSUMO_ROLLOS (separados por "&", ","; editables en la
// vista previa). Envío directo: la pestaña es solo consulta, no depende de SAP como el reporte del plan,
// así que no pasa por Guardar TXT → Recuperar.
const RESTRICCION_CORREO_CONSUMO = 'GRUPO_CONTROL_CONSUMO_ROLLOS';
const ASUNTO_CORREO_CONSUMO = 'Control consumo de rollos — Corte y Laminado [Acolchadoras]-[Quito]';
const NOTA_CORREO = 'Este correo fue generado automáticamente, favor no responder.';

interface LaminaResumen {
  codigo: string;
  descripcion: string;
  kg: number;
  pesoUN: number;
  porAcolchadora: Map<string, number>;
  rollosUn: number;
  stockUn: Record<string, number>;
  stockTotalUn: number;
  saldoUn: number;
}

const construirCorreoConsumoHtml = (
  laminas: LaminaResumen[],
  fechas: string[],
  corridas: Props['corridasSiguienteDia'],
): string => {
  const fechaHoy = format(new Date(), "EEEE d 'de' MMMM 'de' yyyy", { locale: es });
  const fechaPlan = fechas.length > 0 ? fechas.map(f => format(parseISO(f), "EEEE d 'de' MMMM", { locale: es })).join(', ') : 'todas las fechas';
  const conPeso = laminas.filter(l => l.pesoUN > 0);
  const faltan = conPeso.filter(l => l.saldoUn < 0).length;
  const totalRollos = conPeso.reduce((s, l) => s + l.rollosUn, 0);
  const totalKg = laminas.reduce((s, l) => s + l.kg, 0);
  const corridaLabel = `${corridas.fecha.slice(8, 10)}/${corridas.fecha.slice(5, 7)}`;
  const th = 'padding:8px 8px;font-size:9px;font-weight:700;letter-spacing:0.05em;text-transform:uppercase;color:#6b7280;border-bottom:1px solid #e5e7eb;';
  const thStock = `${th}background:#f0fdfa;color:#115e59;`;
  const td = 'padding:7px 8px;font-size:11px;color:#374151;border-bottom:1px solid #f3f4f6;font-variant-numeric:tabular-nums;';
  const filas = laminas.map((l, i) => {
    const bg = i % 2 === 0 ? '#ffffff' : '#fafafa';
    const ok = l.pesoUN > 0;
    const achs = Array.from(l.porAcolchadora.entries()).sort(([a], [b]) => a.localeCompare(b))
      .map(([ach, n]) => `<span style="display:inline-block;margin:1px 2px;padding:1px 5px;border-radius:4px;background:#f5f3ff;border:1px solid #ede9fe;font-size:10px;color:#5b21b6;white-space:nowrap;">${ach} · <b>${ok ? n : '—'}</b> un</span>`).join('');
    const cubre = !ok
      ? '<span style="font-size:10px;color:#d97706;">sin PesoUN</span>'
      : l.saldoUn >= 0
        ? '<span style="padding:2px 6px;border-radius:4px;background:#d1fae5;color:#065f46;font-size:10px;font-weight:700;">CUBRE</span>'
        : `<span style="padding:2px 6px;border-radius:4px;background:#fee2e2;color:#b91c1c;font-size:10px;font-weight:700;">FALTA ${fmt(-l.saldoUn)}</span>`;
    const c = corridas.porMaterial.get(l.codigo);
    return `
        <tr style="background:${bg};">
          <td style="${td}color:#4338ca;font-family:ui-monospace,Consolas,monospace;">${l.codigo}</td>
          <td style="${td}font-weight:600;color:#111827;">${l.descripcion}</td>
          <td style="${td}">${achs}</td>
          <td align="right" style="${td}">${fmt(l.kg, 1)}</td>
          <td align="right" style="${td}">${ok ? fmt(l.pesoUN, 2) : '<span style="color:#d97706;">sin Looper</span>'}</td>
          <td align="right" style="${td}font-weight:700;color:#6d28d9;">${ok ? fmt(l.rollosUn) : '—'}</td>
          ${BODEGAS_STOCK.map(b => `<td align="right" style="${td}background:#f0fdfa;">${ok ? fmt(l.stockUn[b]) : '—'}</td>`).join('')}
          <td align="right" style="${td}background:#f0fdfa;font-weight:700;">${ok ? fmt(l.stockTotalUn) : '—'}</td>
          <td align="right" style="${td}background:#f0fdfa;font-weight:700;color:${l.saldoUn < 0 ? '#dc2626' : '#047857'};">${ok ? (l.saldoUn > 0 ? `+${fmt(l.saldoUn)}` : fmt(l.saldoUn)) : '—'}</td>
          <td align="center" style="${td}background:#f0fdfa;">${cubre}</td>
          <td align="right" style="${td}color:#6b7280;">${c ? fmt(Math.round(c.un)) : '—'}</td>
        </tr>`;
  }).join('');
  const kpi = (titulo: string, valor: string, color: string, borde: string) => `
          <td width="25%" style="background:#f5f3ff;padding:14px 12px;border:1px solid #e5e7eb;${borde}">
            <p style="margin:0;font-size:9px;font-weight:700;letter-spacing:0.08em;text-transform:uppercase;color:#6b7280;">${titulo}</p>
            <p style="margin:4px 0 0;font-size:20px;font-weight:700;color:${color};font-variant-numeric:tabular-nums;">${valor}</p>
          </td>`;
  return `
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:960px;margin:0 auto;background:#ffffff;font-family:-apple-system,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;">
  <tr>
    <td style="background:#1d4ed8;padding:22px 28px;">
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
        <tr>
          <td style="font-size:15px;font-weight:700;color:#ffffff;letter-spacing:0.02em;">CHAIDE Y CHAIDE</td>
          <td align="right" style="font-size:11px;font-weight:600;letter-spacing:0.06em;text-transform:uppercase;color:#c7d7fd;">Planificación de Producción</td>
        </tr>
      </table>
    </td>
  </tr>
  <tr>
    <td style="padding:26px 28px 6px;">
      <p style="margin:0;font-size:10px;font-weight:700;letter-spacing:0.1em;text-transform:uppercase;color:#6b7280;">Corte y Laminado · Consumo acolchadoras</p>
      <h1 style="margin:4px 0 0;font-size:20px;font-weight:700;color:#111827;">Rollos requeridos por referencia de lámina</h1>
      <p style="margin:6px 0 0;font-size:12px;color:#6b7280;text-transform:capitalize;">${fechaHoy} · Correo automático, no responder</p>
      <p style="margin:4px 0 0;font-size:12px;color:#b45309;font-weight:700;">Órdenes FERT de acolchadoras: <span style="text-transform:capitalize;">${fechaPlan}</span></p>
    </td>
  </tr>
  <tr>
    <td style="padding:18px 28px 4px;">
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
        <tr>${kpi('Láminas', String(laminas.length), '#6d28d9', 'border-radius:10px 0 0 10px;border-right:none;')}${kpi('Rollos req. (un)', fmt(totalRollos), '#6d28d9', 'border-left:none;border-right:none;')}${kpi('Rollos req. (kg)', fmt(totalKg, 0), '#6d28d9', 'border-left:none;border-right:none;')}${kpi('Sin stock suficiente', String(faltan), faltan > 0 ? '#dc2626' : '#047857', 'border-radius:0 10px 10px 0;border-left:none;')}
        </tr>
      </table>
    </td>
  </tr>
  <tr>
    <td style="padding:22px 28px 4px;">
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin-bottom:8px;">
        <tr>
          <td style="font-size:10px;font-weight:700;letter-spacing:0.1em;text-transform:uppercase;color:#6b7280;">Rollos requeridos por referencia de lámina</td>
          <td align="right" style="font-size:10px;font-weight:700;color:${faltan > 0 ? '#dc2626' : '#047857'};text-transform:uppercase;">${faltan > 0 ? `${faltan} de ${laminas.length} láminas sin stock suficiente` : 'El stock cubre todas las láminas'}</td>
        </tr>
      </table>
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border:1px solid #e5e7eb;border-radius:10px;overflow:hidden;">
        <tr style="background:#f9fafb;">
          <td style="${th}">Lámina</td>
          <td style="${th}">Descripción</td>
          <td style="${th}">Rollos por acolchadora [un]</td>
          <td align="right" style="${th}">Kg</td>
          <td align="right" style="${th}">Peso UN</td>
          <td align="right" style="${th}">Rollos [un]</td>
          ${BODEGAS_STOCK.map(b => `<td align="right" style="${thStock}">Stock ${b} [un]</td>`).join('')}
          <td align="right" style="${thStock}">Stock final [un]</td>
          <td align="right" style="${thStock}">Saldo [un]</td>
          <td align="center" style="${thStock}">¿Cubre?</td>
          <td align="right" style="${th}white-space:nowrap;">Corrida ${corridaLabel} [un] (info)</td>
        </tr>${filas}
      </table>
      <p style="margin:8px 0 0;font-size:10px;color:#9ca3af;">
        Rollos [un] = Kg de lámina (BOM de la referencia × cantidad planificada) ÷ PesoUN Looper, al entero superior por máquina.
        Stock = libre utilización en bodegas ${BODEGAS_STOCK.join(' / ')} en rollos completos. La corrida del ${corridaLabel} es informativa: no se suma al stock ni al saldo.
      </p>
    </td>
  </tr>
  <tr>
    <td style="padding:16px 28px 28px;">
      <p style="margin:0;font-size:11px;line-height:1.6;color:#9ca3af;border-top:1px solid #e5e7eb;padding-top:16px;">
        Este correo fue generado automáticamente por el Optimizador de Producción, favor no responder.
        Para dudas sobre estos datos, contacta a Planificación Táctica.
      </p>
    </td>
  </tr>
</table>`;
};

interface Props {
  ordenesFert: RawApiRow[];
  selectedDates: Set<string>;
  kpiLooperData: RawApiRow[];
  inventarioSAP: InventarioRow[];
  // Órdenes FERT de Laminado ya en SAP (014/031) del siguiente día hábil, por material. SOLO
  // INFORMATIVO: no entra al stock, saldo ni "¿Cubre?".
  corridasSiguienteDia: { fecha: string; porMaterial: Map<string, { un: number; kg: number; corridas: number; ordenes: string[] }> };
}

export const ConsumoAcolchadorasTab: React.FC<Props> = ({ ordenesFert, selectedDates, kpiLooperData, inventarioSAP, corridasSiguienteDia }) => {
  // Órdenes FERT de acolchadoras en la fecha del plan (centro 2000 fuera, igual que Órdenes FERT).
  const ordenes = useMemo(() => ordenesFert.filter(o => {
    if (getProp(o, ['CENTRO']) === '2000') return false;
    if (!numeroAcolchadora(getProp(o, ['MAQUINA', 'PUESTOTRABAJO', 'RECURSO']))) return false;
    if (safeNum(getProp(o, ['CANTPENDIENTE', 'CANT_PEND', 'CANTIDAD'])) <= 0) return false;
    if (selectedDates.size > 0) {
      const raw = getProp(o, ['FECHA', 'FECHAINICIO', 'FECHA_INICIO']);
      if (!selectedDates.has(raw.includes('T') ? raw.split('T')[0] : raw)) return false;
    }
    return true;
  }), [ordenesFert, selectedDates]);

  const materiales = useMemo(
    () => Array.from(new Set(ordenes.map(o => cleanCode(getProp(o, ['MATERIAL', 'CODIGO_MATERIAL']))).filter(Boolean))).sort(),
    [ordenes]
  );

  const [bom, setBom] = useState<Map<string, Map<string, { descripcion: string; kgPorUnidad: number }>>>(new Map());
  const [progreso, setProgreso] = useState<{ actual: number; total: number } | null>(null);

  useEffect(() => {
    let cancelado = false;
    (async () => {
      const result = new Map<string, Map<string, { descripcion: string; kgPorUnidad: number }>>();
      setProgreso({ actual: 0, total: materiales.length });
      for (let i = 0; i < materiales.length; i++) {
        if (cancelado) return;
        result.set(materiales[i], await laminasPorUnidad(materiales[i]));
        setProgreso({ actual: i + 1, total: materiales.length });
      }
      if (!cancelado) { setBom(result); setProgreso(null); }
    })();
    return () => { cancelado = true; };
  }, [materiales]);

  const pesoUN = useMemo(() => {
    const m = new Map<string, number>();
    kpiLooperData.forEach(k => m.set(cleanCode(k.Material), safeNum(k.PesoUN)));
    return m;
  }, [kpiLooperData]);

  const acolchadoras = useMemo<Acolchadora[]>(() => {
    const porAcol = new Map<string, Map<string, Map<string, Referencia>>>();
    ordenes.forEach(o => {
      const maquina = getProp(o, ['MAQUINA', 'PUESTOTRABAJO', 'RECURSO']).toUpperCase();
      const num = numeroAcolchadora(maquina)!;
      const material = cleanCode(getProp(o, ['MATERIAL', 'CODIGO_MATERIAL']));
      const cantidad = safeNum(getProp(o, ['CANTPENDIENTE', 'CANT_PEND', 'CANTIDAD']));
      if (!porAcol.has(num)) porAcol.set(num, new Map());
      const porMaq = porAcol.get(num)!;
      if (!porMaq.has(maquina)) porMaq.set(maquina, new Map());
      const porRef = porMaq.get(maquina)!;
      const ref = porRef.get(material) || {
        material,
        nombre: getProp(o, ['NOMBRE', 'DESCRIPCION', 'TEXTO_MATERIAL']).toUpperCase(),
        unidad: getProp(o, ['UNIDAD', 'UNIDAD_MEDIDA']).toUpperCase(),
        cantidad: 0,
        ordenes: [],
        laminas: [],
      };
      ref.cantidad += cantidad;
      const orden = getProp(o, ['ORDEN', 'ORDEN_PROCESO', 'ORDEN_FERT']);
      if (orden) ref.ordenes.push(orden);
      porRef.set(material, ref);
    });

    return Array.from(porAcol.entries()).sort(([a], [b]) => a.localeCompare(b)).map(([num, porMaq]) => {
      const maquinas: Maquina[] = Array.from(porMaq.entries()).sort(([a], [b]) => a.localeCompare(b)).map(([maquina, porRef]) => {
        const referencias = Array.from(porRef.values()).map(ref => {
          const laminas = Array.from((bom.get(ref.material) || new Map()).entries()).map(([codigo, l]) => {
            const kg = ref.cantidad * l.kgPorUnidad;
            const p = pesoUN.get(codigo) || 0;
            return { codigo, descripcion: l.descripcion, kgPorUnidad: l.kgPorUnidad, kg, pesoUN: p, rollos: p > 0 ? kg / p : 0 };
          });
          return { ...ref, laminas };
        }).sort((a, b) => b.cantidad - a.cantidad);
        return { maquina, cantidad: referencias.reduce((s, r) => s + r.cantidad, 0), referencias };
      });
      const laminas = maquinas.flatMap(m => m.referencias.flatMap(r => r.laminas));
      return {
        nombre: `ACOLCHADORA ${num}`,
        cantidad: maquinas.reduce((s, m) => s + m.cantidad, 0),
        kg: laminas.reduce((s, l) => s + l.kg, 0),
        rollos: laminas.reduce((s, l) => s + l.rollos, 0),
        maquinas,
      };
    });
  }, [ordenes, bom, pesoUN]);

  // Vista única (usuario 2026-10-19): una fila por máquina + lámina dentro de cada acolchadora, en el
  // orden Máquina · Actividad · Lámina · Kg/Und · Prod Planif · Kg · Rollos [un]. Los rollos se
  // redondean al entero superior por fila (la máquina recibe rollos completos); el detalle de qué
  // referencias de acolchado consumen esa lámina queda plegable debajo de la fila.
  const bloques = useMemo<BloqueAcolchadora[]>(() => acolchadoras.map(a => {
    const filas = new Map<string, FilaLamina>();
    const sinLamina: Referencia[] = [];
    a.maquinas.forEach(m => m.referencias.forEach(r => {
      if (r.laminas.length === 0) { sinLamina.push(r); return; }
      r.laminas.forEach(l => {
        const key = `${m.maquina}|${l.codigo}`;
        const f = filas.get(key) || { key, maquina: m.maquina, codigo: l.codigo, descripcion: l.descripcion, pesoUN: l.pesoUN, cantidad: 0, kg: 0, rollos: 0, referencias: [] };
        f.cantidad += r.cantidad;
        f.kg += l.kg;
        f.rollos += l.rollos;
        f.referencias.push({ material: r.material, nombre: r.nombre, unidad: r.unidad, cantidad: r.cantidad, ordenes: r.ordenes, kgPorUnidad: l.kgPorUnidad, kg: l.kg });
        filas.set(key, f);
      });
    }));
    const lista = Array.from(filas.values()).sort((x, y) => x.maquina.localeCompare(y.maquina) || y.kg - x.kg);
    return {
      nombre: a.nombre,
      maquinas: a.maquinas.map(m => m.maquina),
      cantidad: a.cantidad,
      kg: lista.reduce((s, f) => s + f.kg, 0),
      rollosUn: lista.reduce((s, f) => s + rollosEnteros(f), 0),
      filas: lista,
      sinLamina,
    };
  }), [acolchadoras]);

  const stockKgPorMaterial = useMemo(() => {
    const m = new Map<string, Record<string, number>>();
    inventarioSAP.forEach(inv => {
      const alm = String(inv.ALMACEN ?? '').trim();
      if (!(BODEGAS_STOCK as readonly string[]).includes(alm)) return;
      const mat = cleanCode(inv.MATERIAL);
      const e = m.get(mat) || {};
      e[alm] = (e[alm] || 0) + safeNum(inv.LIBREUTILIZACION);
      m.set(mat, e);
    });
    return m;
  }, [inventarioSAP]);

  // Resumen para Laminado: qué lámina producir y cuántos rollos entregar a cada acolchadora. Los
  // rollos por acolchadora son enteros (suma de sus filas máquina+lámina al entero superior) y el total
  // de la lámina es la suma de esos enteros — lo que realmente sale hacia las máquinas.
  const resumenLaminas = useMemo(() => {
    const m = new Map<string, { codigo: string; descripcion: string; kg: number; pesoUN: number; porAcolchadora: Map<string, number> }>();
    bloques.forEach(b => b.filas.forEach(f => {
      const e = m.get(f.codigo) || { codigo: f.codigo, descripcion: f.descripcion, kg: 0, pesoUN: f.pesoUN, porAcolchadora: new Map<string, number>() };
      e.kg += f.kg;
      const ach = b.nombre.replace('ACOLCHADORA ', 'ACH');
      e.porAcolchadora.set(ach, (e.porAcolchadora.get(ach) || 0) + rollosEnteros(f));
      m.set(f.codigo, e);
    }));
    return Array.from(m.values())
      .map(e => {
        const rollosUn = Array.from(e.porAcolchadora.values()).reduce((s, n) => s + n, 0);
        // Stock en rollos COMPLETOS por bodega (Kg libre ÷ PesoUN, al entero inferior: un rollo
        // a medias no se entrega). Saldo = stock − rollos requeridos; negativo = no cubre.
        const stockKg = stockKgPorMaterial.get(e.codigo) || {};
        const stockUn = Object.fromEntries(BODEGAS_STOCK.map(b => [b, e.pesoUN > 0 ? Math.floor((stockKg[b] || 0) / e.pesoUN + 1e-6) : 0])) as Record<string, number>;
        const stockTotalUn = BODEGAS_STOCK.reduce((s, b) => s + stockUn[b], 0);
        const stockTotalKg = BODEGAS_STOCK.reduce((s, b) => s + (stockKg[b] || 0), 0);
        return { ...e, rollosUn, stockUn, stockTotalUn, stockTotalKg, saldoUn: stockTotalUn - rollosUn };
      })
      .sort((a, b) => b.kg - a.kg);
  }, [bloques, stockKgPorMaterial]);

  const totalKg = bloques.reduce((s, b) => s + b.kg, 0);
  const totalRollos = bloques.reduce((s, b) => s + b.rollosUn, 0);

  const [abiertos, setAbiertos] = useState<Set<string>>(new Set());
  const toggle = (k: string) => setAbiertos(prev => {
    const n = new Set(prev);
    if (n.has(k)) n.delete(k); else n.add(k);
    return n;
  });
  const expandirTodo = () => setAbiertos(new Set(bloques.map(b => b.nombre)));
  const expandirConReferencias = () => setAbiertos(new Set(bloques.flatMap(b => [b.nombre, ...b.filas.map(f => `${b.nombre}|${f.key}`)])));

  const Toggle = ({ k }: { k: string }) => (
    <button onClick={() => toggle(k)} className="inline-flex items-center justify-center w-4 h-4 mr-2 rounded border border-current/30 align-middle shrink-0">
      {abiertos.has(k) ? <Minus className="w-3 h-3" /> : <Plus className="w-3 h-3" />}
    </button>
  );
  const pendiente = <span className="text-[9px] font-black uppercase text-slate-400 italic">pendiente</span>;
  const fechas = Array.from(selectedDates).sort();

  const { addNotification } = useAppContext();
  const [destinatarios, setDestinatarios] = useState('');
  const [correoHtml, setCorreoHtml] = useState<string | null>(null);
  const [enviando, setEnviando] = useState(false);
  const nDestinatarios = destinatarios.split(/[,;]/).map(s => s.trim()).filter(Boolean).length;

  // Destinatarios de la restricción GRUPO_CONTROL_CONSUMO_ROLLOS (mismo patrón que Grupo_Correos_Laminado):
  // solo autocompleta si el usuario todavía no escribió nada.
  useEffect(() => {
    restriccionService.getAll()
      .then(res => {
        const correos = Array.from(new Set((res.data || [])
          .filter(r => r.estado === 'A' && String(r.nombre_restriccion || '').trim().toUpperCase() === RESTRICCION_CORREO_CONSUMO)
          .flatMap(r => String(r.valor_restriccion || '').split(/[,;&]/).map(v => v.trim()))
          .filter(Boolean)));
        if (correos.length > 0) setDestinatarios(prev => prev.trim() ? prev : correos.join(', '));
      })
      .catch(e => console.warn(`[Consumo Acolchadoras] No se pudo cargar ${RESTRICCION_CORREO_CONSUMO}:`, (e as Error).message));
  }, []);

  // La vista previa congela el HTML al abrirse: se envía exactamente lo que se revisó.
  const abrirCorreo = () => setCorreoHtml(construirCorreoConsumoHtml(resumenLaminas, fechas, corridasSiguienteDia));

  const enviarCorreo = async () => {
    if (!correoHtml || !destinatarios.trim()) return;
    setEnviando(true);
    try {
      const res = await serviciosService.enviarCorreo({ destino: destinatarios.trim(), asunto: ASUNTO_CORREO_CONSUMO, cuerpo: correoHtml, nota: NOTA_CORREO });
      addNotification('success', `Consumo Acolchadoras: ${res.message} — ${res.destinatarios.join(', ')}`);
      setCorreoHtml(null);
    } catch (e) {
      addNotification('error', `Consumo Acolchadoras: no se pudo enviar el correo: ${(e as Error).message}`);
    } finally {
      setEnviando(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between px-2 gap-4 flex-wrap">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-violet-600 rounded-xl text-white shadow-lg"><Layers className="w-4 h-4" /></div>
          <div>
            <h3 className="text-sm font-black uppercase tracking-widest text-slate-800">Consumo de Laminado por Acolchadora</h3>
            <p className="text-[10px] font-bold text-slate-500">
              Órdenes FERT de acolchadoras {fechas.length > 0 ? `del ${fechas.join(', ')}` : '(todas las fechas — selecciona la fecha del plan)'} · BOM hasta la lámina · Rollos [un] = Kg ÷ PesoUN Looper, al entero superior. Solo consulta, no afecta el plan.
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {progreso && (
            <span className="flex items-center gap-2 text-[10px] font-black text-violet-700">
              <Loader2 className="w-3 h-3 animate-spin" /> Explotando BOM {progreso.actual}/{progreso.total}
            </span>
          )}
          <button onClick={expandirTodo} className="text-[10px] font-black uppercase px-3 py-1.5 rounded-lg border border-slate-200 hover:bg-slate-50">Expandir todo</button>
          <button onClick={expandirConReferencias} className="text-[10px] font-black uppercase px-3 py-1.5 rounded-lg border border-slate-200 hover:bg-slate-50">+ Referencias</button>
          <button onClick={() => setAbiertos(new Set())} className="text-[10px] font-black uppercase px-3 py-1.5 rounded-lg border border-slate-200 hover:bg-slate-50">Colapsar todo</button>
        </div>
      </div>

      {resumenLaminas.length > 0 && (
        <div className="rounded-2xl border border-violet-100 bg-white shadow-sm overflow-hidden">
          <div className="px-4 py-2 bg-violet-50 text-[10px] font-black uppercase tracking-widest text-violet-800 flex items-center justify-between gap-4">
            <span>Rollos requeridos por referencia de lámina</span>
            <div className="flex items-center gap-3">
              {(() => {
                const faltan = resumenLaminas.filter(l => l.pesoUN > 0 && l.saldoUn < 0).length;
                return faltan > 0
                  ? <span className="text-red-600">{faltan} de {resumenLaminas.length} láminas sin stock suficiente</span>
                  : <span className="text-emerald-700">El stock cubre todas las láminas</span>;
              })()}
              <button
                onClick={abrirCorreo}
                disabled={!!progreso}
                title={progreso ? 'Espera a que termine la explosión del BOM' : 'Vista previa del correo con este resumen'}
                className="flex items-center gap-1 px-2.5 py-1 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white disabled:opacity-50"
              >
                <Mail className="w-3 h-3" /> Enviar correo
              </button>
            </div>
          </div>
          <div className="overflow-x-auto">
            <table className="min-w-full text-[11px] font-bold text-slate-700">
              <thead className="text-[10px] uppercase text-slate-500 bg-slate-50">
                <tr>
                  <th className="px-3 py-2 text-left">Lámina</th>
                  <th className="px-3 py-2 text-left">Descripción</th>
                  <th className="px-3 py-2 text-left">Rollos por acolchadora [un]</th>
                  <th className="px-3 py-2 text-right">Kg</th>
                  <th className="px-3 py-2 text-right">Peso UN</th>
                  <th className="px-3 py-2 text-right">Rollos [un]</th>
                  {BODEGAS_STOCK.map(b => (
                    <th key={b} className="px-3 py-2 text-right bg-teal-50 text-teal-800">Stock {b} [un]</th>
                  ))}
                  <th className="px-3 py-2 text-right bg-teal-50 text-teal-800">Stock final [un]</th>
                  <th className="px-3 py-2 text-right bg-teal-50 text-teal-800">Saldo [un]</th>
                  <th className="px-3 py-2 text-center bg-teal-50 text-teal-800">¿Cubre?</th>
                  <th className="px-3 py-2 text-right bg-slate-100 text-slate-600 whitespace-nowrap" title="Órdenes FERT de Laminado ya en SAP (014/031) del siguiente día hábil. Solo informativo: no se suma al stock ni al saldo">
                    Corrida {corridasSiguienteDia.fecha.slice(8, 10)}/{corridasSiguienteDia.fecha.slice(5, 7)} [un] <span className="normal-case font-bold">(info)</span>
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {resumenLaminas.map(l => (
                  <tr key={l.codigo}>
                    <td className="px-3 py-1.5 font-mono text-slate-900">{l.codigo}</td>
                    <td className="px-3 py-1.5">{l.descripcion}</td>
                    <td className="px-3 py-1.5">
                      <div className="flex flex-wrap gap-1">
                        {Array.from(l.porAcolchadora.entries()).sort(([a], [b]) => a.localeCompare(b)).map(([ach, n]) => (
                          <span key={ach} className="px-1.5 py-0.5 rounded bg-violet-50 border border-violet-100 text-[10px] text-violet-800 whitespace-nowrap">
                            {ach} · <span className="font-mono font-black">{l.pesoUN > 0 ? n : '—'}</span> un
                          </span>
                        ))}
                      </div>
                    </td>
                    <td className="px-3 py-1.5 text-right font-mono">{fmt(l.kg, 1)}</td>
                    <td className="px-3 py-1.5 text-right font-mono">{l.pesoUN > 0 ? fmt(l.pesoUN, 2) : <span className="text-amber-600">sin Looper</span>}</td>
                    <td className="px-3 py-1.5 text-right font-mono font-black text-violet-700">{l.pesoUN > 0 ? fmt(l.rollosUn) : '—'}</td>
                    {BODEGAS_STOCK.map(b => (
                      <td key={b} className="px-3 py-1.5 text-right font-mono bg-teal-50/40 text-slate-600">{l.pesoUN > 0 ? fmt(l.stockUn[b]) : '—'}</td>
                    ))}
                    <td className="px-3 py-1.5 text-right font-mono font-black bg-teal-50/40" title={`${fmt(l.stockTotalKg, 1)} Kg libres`}>
                      {l.pesoUN > 0 ? fmt(l.stockTotalUn) : '—'}
                    </td>
                    <td className={`px-3 py-1.5 text-right font-mono font-black bg-teal-50/40 ${l.saldoUn < 0 ? 'text-red-600' : 'text-emerald-700'}`}>
                      {l.pesoUN > 0 ? (l.saldoUn > 0 ? `+${fmt(l.saldoUn)}` : fmt(l.saldoUn)) : '—'}
                    </td>
                    <td className="px-3 py-1.5 text-center bg-teal-50/40">
                      {l.pesoUN <= 0 ? <span className="text-amber-600 text-[10px]">sin PesoUN</span>
                        : l.saldoUn >= 0
                          ? <span className="px-2 py-0.5 rounded bg-emerald-100 text-emerald-800 text-[10px] font-black uppercase">Cubre</span>
                          : <span className="px-2 py-0.5 rounded bg-red-100 text-red-700 text-[10px] font-black uppercase">Falta {fmt(-l.saldoUn)}</span>}
                    </td>
                    {(() => {
                      const c = corridasSiguienteDia.porMaterial.get(l.codigo);
                      return (
                        <td className="px-3 py-1.5 text-right font-mono bg-slate-50 text-slate-600"
                          title={c ? `${c.corridas} orden(es) SAP: ${c.ordenes.join(', ')} · ${fmt(c.kg, 1)} Kg — solo informativo` : 'Sin orden SAP de Laminado para el siguiente día'}>
                          {c ? fmt(Math.round(c.un)) : <span className="text-slate-300">—</span>}
                        </td>
                      );
                    })()}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      <div className="rounded-2xl border border-gray-100 shadow-sm overflow-hidden bg-white">
        <div className="overflow-x-auto">
          <table className="min-w-full border-collapse text-[11px]">
            <thead className="text-[10px] uppercase font-black">
              <tr>
                <th colSpan={3} className="bg-slate-800" />
                <th colSpan={2} className="px-3 py-1.5 bg-sky-200 text-sky-900 text-center">Histórico</th>
                <th className="bg-slate-800" />
                <th colSpan={2} className="px-3 py-1.5 bg-orange-200 text-orange-900 text-center">Diario</th>
                <th className="bg-slate-800" />
                <th colSpan={2} className="px-3 py-1.5 bg-violet-200 text-violet-900 text-center">Consumo Laminado</th>
              </tr>
              <tr className="bg-slate-800 text-white">
                <th className="px-3 py-2 text-left">Máquina</th>
                <th className="px-3 py-2 text-left">Actividad / Referencia</th>
                <th className="px-3 py-2 text-left">Lámina</th>
                <th className="px-3 py-2 text-right">Prom Prod Turno (H)</th>
                <th className="px-3 py-2 text-right">Prom Prod Turno (Un/Mtrs)</th>
                <th className="px-3 py-2 text-right">Kg/Und</th>
                <th className="px-3 py-2 text-right">Prod Planif (H)</th>
                <th className="px-3 py-2 text-right">Prod Planif (Un/Mtrs)</th>
                <th className="px-3 py-2 text-right">Nivel Prod.</th>
                <th className="px-3 py-2 text-right">Kg</th>
                <th className="px-3 py-2 text-right">Rollos [un]</th>
              </tr>
            </thead>
            <tbody className="font-bold text-slate-700">
              {bloques.length === 0 ? (
                <tr><td colSpan={11} className="py-20 text-center text-slate-400 font-black uppercase tracking-widest italic">
                  {ordenesFert.length === 0 ? 'Sin órdenes FERT cargadas — pulsa Sincronizar' : 'No hay órdenes FERT de acolchadoras para la fecha seleccionada'}
                </td></tr>
              ) : bloques.map(b => (
                <React.Fragment key={b.nombre}>
                  <tr className="bg-emerald-500 text-white border-t-2 border-white">
                    <td className="px-3 py-2 font-mono text-[10px]">{b.maquinas.join(', ')}</td>
                    <td className="px-3 py-2 font-black whitespace-nowrap"><Toggle k={b.nombre} />{b.nombre}</td>
                    <td className="px-3 py-2 text-[10px]">{b.filas.length} lámina(s)</td>
                    <td className="px-3 py-2 text-right">{pendiente}</td>
                    <td className="px-3 py-2 text-right">{pendiente}</td>
                    <td />
                    <td className="px-3 py-2 text-right">{pendiente}</td>
                    <td className="px-3 py-2 text-right font-mono font-black">{fmt(b.cantidad)}</td>
                    <td className="px-3 py-2 text-right">{pendiente}</td>
                    <td className="px-3 py-2 text-right font-mono">{fmt(b.kg, 1)}</td>
                    <td className="px-3 py-2 text-right font-mono font-black text-base">{fmt(b.rollosUn)}</td>
                  </tr>
                  {abiertos.has(b.nombre) && (
                    <>
                      {b.filas.map(f => {
                        const kf = `${b.nombre}|${f.key}`;
                        return (
                          <React.Fragment key={kf}>
                            <tr className="border-t border-slate-100 hover:bg-slate-50">
                              <td className="px-3 py-1.5 font-mono text-slate-600">{f.maquina}</td>
                              <td className="px-3 py-1.5 text-slate-500 whitespace-nowrap"><Toggle k={kf} />{b.nombre}</td>
                              <td className="px-3 py-1.5">
                                <span className="font-mono text-slate-900 mr-2">{f.codigo}</span>
                                <span className="uppercase">{f.descripcion}</span>
                                {f.pesoUN <= 0 && <span className="ml-2 text-amber-600 text-[9px] font-black uppercase">sin PesoUN Looper</span>}
                              </td>
                              <td className="bg-yellow-50" />
                              <td className="bg-yellow-50" />
                              <td className="px-3 py-1.5 text-right font-mono">{f.cantidad > 0 ? fmt(f.kg / f.cantidad, 3) : '—'}</td>
                              <td className="px-3 py-1.5 text-right">{pendiente}</td>
                              <td className="px-3 py-1.5 text-right font-mono">{fmt(f.cantidad)}</td>
                              <td />
                              <td className="px-3 py-1.5 text-right font-mono">{fmt(f.kg, 1)}</td>
                              <td className="px-3 py-1.5 text-right font-mono font-black text-violet-700" title={f.pesoUN > 0 ? `${fmt(f.rollos, 2)} rollos exactos` : undefined}>
                                {f.pesoUN > 0 ? fmt(rollosEnteros(f)) : '—'}
                              </td>
                            </tr>
                            {abiertos.has(kf) && f.referencias.map(r => (
                              <tr key={`${kf}|${r.material}`} className="text-slate-500 text-[10px]">
                                <td />
                                <td colSpan={2} className="px-3 py-1 pl-10" title={`Órdenes: ${r.ordenes.join(', ')}`}>
                                  └ <span className="font-mono text-slate-700 mr-2">{r.material}</span>{r.nombre}
                                  <span className="ml-2 text-slate-400">({r.ordenes.length} OF)</span>
                                </td>
                                <td colSpan={2} />
                                <td className="px-3 py-1 text-right font-mono">{fmt(r.kgPorUnidad, 3)}</td>
                                <td />
                                <td className="px-3 py-1 text-right font-mono">{fmt(r.cantidad)} <span className="text-[9px] text-slate-400">{r.unidad}</span></td>
                                <td />
                                <td className="px-3 py-1 text-right font-mono">{fmt(r.kg, 1)}</td>
                                <td className="px-3 py-1 text-right font-mono">{f.pesoUN > 0 ? fmt(r.kg / f.pesoUN, 1) : '—'}</td>
                              </tr>
                            ))}
                          </React.Fragment>
                        );
                      })}
                      {b.sinLamina.map(r => (
                        <tr key={`${b.nombre}|sin|${r.material}`} className="border-t border-slate-100 text-[10px]">
                          <td className="px-3 py-1.5 font-mono text-slate-500">{b.maquinas.join(', ')}</td>
                          <td colSpan={2} className="px-3 py-1.5" title={`Órdenes: ${r.ordenes.join(', ')}`}>
                            <span className="font-mono text-slate-700 mr-2">{r.material}</span>{r.nombre}
                            <span className="ml-2 text-amber-600 italic">{progreso ? 'explotando BOM…' : 'sin LAMINA CILINDRICA en el BOM'}</span>
                          </td>
                          <td colSpan={4} />
                          <td className="px-3 py-1.5 text-right font-mono">{fmt(r.cantidad)} <span className="text-[9px] text-slate-400">{r.unidad}</span></td>
                          <td colSpan={3} />
                        </tr>
                      ))}
                    </>
                  )}
                </React.Fragment>
              ))}
              {bloques.length > 0 && (
                <tr className="bg-slate-800 text-white font-black">
                  <td colSpan={9} className="px-3 py-2 text-right uppercase text-[10px] tracking-widest">Total acolchadoras</td>
                  <td className="px-3 py-2 text-right font-mono">{fmt(totalKg, 1)}</td>
                  <td className="px-3 py-2 text-right font-mono text-base">{fmt(totalRollos)}</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      <Dialog open={!!correoHtml} onOpenChange={(v) => { if (!v && !enviando) setCorreoHtml(null); }}>
        <DialogContent className="max-w-5xl w-[95vw] h-[90vh] flex flex-col gap-3 overflow-hidden">
          <DialogHeader className="shrink-0">
            <DialogTitle className="text-sm font-black uppercase tracking-widest">Vista previa — Control consumo de rollos</DialogTitle>
            <DialogDescription className="text-[11px]">
              Asunto: {ASUNTO_CORREO_CONSUMO}. Se envía exactamente esto (foto del resumen al abrir la vista previa).
            </DialogDescription>
          </DialogHeader>
          {/* iframe con sandbox: aísla los estilos inline del correo del resto de la app. */}
          <iframe title="Vista previa del correo" sandbox="" srcDoc={correoHtml ?? ''} className="flex-1 min-h-0 w-full rounded-lg border border-slate-200 bg-white" />
          <DialogFooter className="shrink-0 flex-col sm:flex-col gap-2 sm:space-x-0 border-t border-slate-100 pt-3">
            <label className="flex justify-between gap-2 text-[9px] font-black uppercase text-slate-500 tracking-wider">
              <span>Destinatarios ({RESTRICCION_CORREO_CONSUMO}) — puedes agregar o quitar correos antes de enviar (separados por coma)</span>
              <span className="text-slate-400 whitespace-nowrap">{nDestinatarios} {nDestinatarios === 1 ? 'correo' : 'correos'}</span>
            </label>
            <textarea
              value={destinatarios}
              onChange={(e) => setDestinatarios(e.target.value)}
              placeholder="correo1@chaideychaide.com, correo2@chaideychaide.com"
              rows={2}
              className="w-full text-[11px] border border-slate-200 rounded-lg p-2 outline-none focus:border-indigo-400 resize-y"
            />
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => setCorreoHtml(null)} disabled={enviando} className="h-9 text-[10px] font-black uppercase">Cerrar</Button>
              <Button
                onClick={() => { void enviarCorreo(); }}
                disabled={enviando || !destinatarios.trim()}
                className="h-9 gap-2 text-[10px] font-black uppercase tracking-widest bg-indigo-600 hover:bg-indigo-700 text-white"
              >
                {enviando ? <Loader2 className="w-4 h-4 animate-spin" /> : <Mail className="w-4 h-4" />} Enviar correo
              </Button>
            </div>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};
