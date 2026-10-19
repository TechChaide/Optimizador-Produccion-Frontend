'use client';

import React, { useEffect, useMemo, useState } from 'react';
import { Layers, Loader2, Minus, Plus } from 'lucide-react';
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

interface Props {
  ordenesFert: RawApiRow[];
  selectedDates: Set<string>;
  kpiLooperData: RawApiRow[];
}

export const ConsumoAcolchadorasTab: React.FC<Props> = ({ ordenesFert, selectedDates, kpiLooperData }) => {
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

  // Resumen para Laminado: rollos por referencia de lámina, todas las acolchadoras.
  const resumenLaminas = useMemo(() => {
    const m = new Map<string, { codigo: string; descripcion: string; kg: number; rollos: number; pesoUN: number; acolchadoras: Set<string> }>();
    acolchadoras.forEach(a => a.maquinas.forEach(maq => maq.referencias.forEach(r => r.laminas.forEach(l => {
      const e = m.get(l.codigo) || { codigo: l.codigo, descripcion: l.descripcion, kg: 0, rollos: 0, pesoUN: l.pesoUN, acolchadoras: new Set<string>() };
      e.kg += l.kg;
      e.rollos += l.rollos;
      e.acolchadoras.add(a.nombre.replace('ACOLCHADORA ', 'ACH'));
      m.set(l.codigo, e);
    }))));
    return Array.from(m.values()).sort((a, b) => b.kg - a.kg);
  }, [acolchadoras]);

  const [abiertos, setAbiertos] = useState<Set<string>>(new Set());
  const toggle = (k: string) => setAbiertos(prev => {
    const n = new Set(prev);
    if (n.has(k)) n.delete(k); else n.add(k);
    return n;
  });
  const expandirTodo = () => {
    const n = new Set<string>();
    acolchadoras.forEach(a => {
      n.add(a.nombre);
      a.maquinas.forEach(m => {
        n.add(`${a.nombre}|${m.maquina}`);
        m.referencias.forEach(r => n.add(`${a.nombre}|${m.maquina}|${r.material}`));
      });
    });
    setAbiertos(n);
  };

  const Toggle = ({ k }: { k: string }) => (
    <button onClick={() => toggle(k)} className="inline-flex items-center justify-center w-4 h-4 mr-2 rounded border border-current/30 align-middle">
      {abiertos.has(k) ? <Minus className="w-3 h-3" /> : <Plus className="w-3 h-3" />}
    </button>
  );
  const pendiente = <span className="text-[9px] font-black uppercase text-slate-400 italic">pendiente</span>;
  const fechas = Array.from(selectedDates).sort();

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between px-2 gap-4 flex-wrap">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-violet-600 rounded-xl text-white shadow-lg"><Layers className="w-4 h-4" /></div>
          <div>
            <h3 className="text-sm font-black uppercase tracking-widest text-slate-800">Consumo de Laminado por Acolchadora</h3>
            <p className="text-[10px] font-bold text-slate-500">
              Órdenes FERT de acolchadoras {fechas.length > 0 ? `del ${fechas.join(', ')}` : '(todas las fechas — selecciona la fecha del plan)'} · BOM hasta la lámina · rollos = Kg ÷ PesoUN Looper. Solo consulta, no afecta el plan.
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
          <button onClick={() => setAbiertos(new Set())} className="text-[10px] font-black uppercase px-3 py-1.5 rounded-lg border border-slate-200 hover:bg-slate-50">Colapsar todo</button>
        </div>
      </div>

      {resumenLaminas.length > 0 && (
        <div className="rounded-2xl border border-violet-100 bg-white shadow-sm overflow-hidden">
          <div className="px-4 py-2 bg-violet-50 text-[10px] font-black uppercase tracking-widest text-violet-800">Rollos requeridos por referencia de lámina</div>
          <div className="overflow-x-auto">
            <table className="min-w-full text-[11px] font-bold text-slate-700">
              <thead className="text-[10px] uppercase text-slate-500 bg-slate-50">
                <tr>
                  <th className="px-3 py-2 text-left">Lámina</th>
                  <th className="px-3 py-2 text-left">Descripción</th>
                  <th className="px-3 py-2 text-right">Kg</th>
                  <th className="px-3 py-2 text-right">Peso UN</th>
                  <th className="px-3 py-2 text-right">Rollos</th>
                  <th className="px-3 py-2 text-left">Acolchadoras</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {resumenLaminas.map(l => (
                  <tr key={l.codigo}>
                    <td className="px-3 py-1.5 font-mono text-slate-900">{l.codigo}</td>
                    <td className="px-3 py-1.5">{l.descripcion}</td>
                    <td className="px-3 py-1.5 text-right font-mono">{fmt(l.kg, 1)}</td>
                    <td className="px-3 py-1.5 text-right font-mono">{l.pesoUN > 0 ? fmt(l.pesoUN, 2) : <span className="text-amber-600">sin Looper</span>}</td>
                    <td className="px-3 py-1.5 text-right font-mono font-black text-violet-700">{l.pesoUN > 0 ? fmt(l.rollos, 1) : '—'}</td>
                    <td className="px-3 py-1.5 text-slate-500">{Array.from(l.acolchadoras).sort().join(', ')}</td>
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
                <th colSpan={2} className="bg-slate-800" />
                <th colSpan={2} className="px-3 py-1.5 bg-sky-200 text-sky-900 text-center">Histórico</th>
                <th colSpan={2} className="px-3 py-1.5 bg-orange-200 text-orange-900 text-center">Diario</th>
                <th className="bg-slate-800" />
                <th colSpan={3} className="px-3 py-1.5 bg-violet-200 text-violet-900 text-center">Consumo Laminado</th>
              </tr>
              <tr className="bg-slate-800 text-white">
                <th className="px-3 py-2 text-left">Actividad / Referencia</th>
                <th className="px-3 py-2 text-left">Máquina</th>
                <th className="px-3 py-2 text-right">Prom Prod Turno (H)</th>
                <th className="px-3 py-2 text-right">Prom Prod Turno (Un/Mtrs)</th>
                <th className="px-3 py-2 text-right">Prod Planif (H)</th>
                <th className="px-3 py-2 text-right">Prod Planif (Un/Mtrs)</th>
                <th className="px-3 py-2 text-right">Nivel Prod.</th>
                <th className="px-3 py-2 text-right">Kg/Und</th>
                <th className="px-3 py-2 text-right">Kg</th>
                <th className="px-3 py-2 text-right">Rollos</th>
              </tr>
            </thead>
            <tbody className="font-bold text-slate-700">
              {acolchadoras.length === 0 ? (
                <tr><td colSpan={10} className="py-20 text-center text-slate-400 font-black uppercase tracking-widest italic">
                  {ordenesFert.length === 0 ? 'Sin órdenes FERT cargadas — pulsa Sincronizar' : 'No hay órdenes FERT de acolchadoras para la fecha seleccionada'}
                </td></tr>
              ) : acolchadoras.map(a => (
                <React.Fragment key={a.nombre}>
                  <tr className="bg-emerald-500 text-white border-t-2 border-white">
                    <td className="px-3 py-2 font-black"><Toggle k={a.nombre} />{a.nombre}</td>
                    <td className="px-3 py-2 text-[10px]">{a.maquinas.length} máq.</td>
                    <td className="px-3 py-2 text-right">{pendiente}</td>
                    <td className="px-3 py-2 text-right">{pendiente}</td>
                    <td className="px-3 py-2 text-right">{pendiente}</td>
                    <td className="px-3 py-2 text-right font-mono font-black">{fmt(a.cantidad)}</td>
                    <td className="px-3 py-2 text-right">{pendiente}</td>
                    <td />
                    <td className="px-3 py-2 text-right font-mono">{fmt(a.kg, 1)}</td>
                    <td className="px-3 py-2 text-right font-mono font-black">{fmt(a.rollos, 1)}</td>
                  </tr>
                  {abiertos.has(a.nombre) && a.maquinas.map(m => {
                    const km = `${a.nombre}|${m.maquina}`;
                    return (
                      <React.Fragment key={km}>
                        <tr className="bg-emerald-50 border-t border-emerald-100">
                          <td className="px-3 py-1.5 pl-8"><Toggle k={km} />{m.referencias.length} referencia(s)</td>
                          <td className="px-3 py-1.5 font-mono">{m.maquina}</td>
                          <td className="px-3 py-1.5 text-right bg-yellow-100/60">{pendiente}</td>
                          <td className="px-3 py-1.5 text-right bg-yellow-100/60">{pendiente}</td>
                          <td className="px-3 py-1.5 text-right">{pendiente}</td>
                          <td className="px-3 py-1.5 text-right font-mono">{fmt(m.cantidad)}</td>
                          <td colSpan={4} />
                        </tr>
                        {abiertos.has(km) && m.referencias.map(r => {
                          const kr = `${km}|${r.material}`;
                          const kg = r.laminas.reduce((s, l) => s + l.kg, 0);
                          const rollos = r.laminas.reduce((s, l) => s + l.rollos, 0);
                          return (
                            <React.Fragment key={kr}>
                              <tr className="border-t border-slate-100 hover:bg-slate-50">
                                <td className="px-3 py-1.5 pl-14" title={`Órdenes: ${r.ordenes.join(', ')}`}>
                                  <Toggle k={kr} />
                                  <span className="font-mono text-slate-900 mr-2">{r.material}</span>
                                  <span className="uppercase">{r.nombre}</span>
                                </td>
                                <td className="px-3 py-1.5 text-[10px] text-slate-500">{r.ordenes.length} OF</td>
                                <td colSpan={3} />
                                <td className="px-3 py-1.5 text-right font-mono">{fmt(r.cantidad)} <span className="text-[9px] text-slate-400">{r.unidad}</span></td>
                                <td />
                                <td />
                                <td className="px-3 py-1.5 text-right font-mono">{fmt(kg, 1)}</td>
                                <td className="px-3 py-1.5 text-right font-mono text-violet-700">{fmt(rollos, 1)}</td>
                              </tr>
                              {abiertos.has(kr) && (r.laminas.length === 0 ? (
                                <tr><td colSpan={10} className="px-3 py-1.5 pl-24 text-[10px] text-amber-600 italic">
                                  {progreso ? 'Explotando BOM…' : 'Sin LAMINA CILINDRICA en el BOM de esta referencia'}
                                </td></tr>
                              ) : r.laminas.map(l => (
                                <tr key={`${kr}|${l.codigo}`} className="text-slate-500">
                                  <td className="px-3 py-1 pl-24" colSpan={7}>
                                    └ <span className="font-mono text-slate-700 mr-2">{l.codigo}</span>{l.descripcion}
                                    {l.pesoUN <= 0 && <span className="ml-2 text-amber-600 text-[9px] font-black uppercase">sin PesoUN Looper</span>}
                                  </td>
                                  <td className="px-3 py-1 text-right font-mono">{fmt(l.kgPorUnidad, 3)}</td>
                                  <td className="px-3 py-1 text-right font-mono">{fmt(l.kg, 1)}</td>
                                  <td className="px-3 py-1 text-right font-mono text-violet-700">{l.pesoUN > 0 ? fmt(l.rollos, 1) : '—'}</td>
                                </tr>
                              )))}
                            </React.Fragment>
                          );
                        })}
                      </React.Fragment>
                    );
                  })}
                </React.Fragment>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
