"use client";

import React, { useMemo, useState } from 'react';
import { Loader2, RefreshCw, Search } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { serviciosService } from '@/services/servicios.service';
import type { Grupo } from '@/types/interfaces';
import { cn } from '@/lib/utils';

// Minutos por unidad de una fila de tiemposEnsambladoByGrupoYCentroPR2: Tiempo_Min / Tiempo; si la
// fila trae el tiempo en HORAS para una cantidad (TiempoPlastificado + Cantidad), se divide. Acepta
// coma decimal. Misma regla que usa matchTiempoEstandar de Venta Externa (la importa de acá).
const num = (v: unknown) => Number(String(v ?? '').trim().replace(',', '.')) || 0;
export const minPorUnidadTiempo = (t: Record<string, unknown>): number | null => {
  const min = num(t.Tiempo_Min) || num(t.Tiempo);
  if (min > 0) return min;
  const horas = num(t.TiempoPlastificado);
  const cant = num(t.Cantidad);
  return horas > 0 && cant > 0 ? (horas * 60) / cant : null;
};

// Mismo código que extractMaterialInfo de Venta Externa: dígitos iniciales, últimos 8.
const codigoMaterial = (t: Record<string, unknown>) => {
  const s = String(t.MATERIAL || t.Material || t.CodMaterial || '').trim();
  const m = s.match(/^(\d+)/);
  return (m ? m[1] : s).slice(-8);
};

export interface LineaVerificacion { material: string; descripcion: string; cantidad: number; tiempoHoras: number }

interface Props {
  grupos: Grupo[];
  // Filas que el módulo tiene cargadas hoy (lo que usa el cálculo), por centro.
  tiemposModulo: Record<'1000' | '2000', number>;
  // Últimas líneas de PFD-VENTA por centro, para comparar contra el servicio.
  lineasPfd: Record<'1000' | '2000', LineaVerificacion[]>;
}

// Pestaña de consulta (usuario 2026-10-09): muestra el servicio tiemposEnsambladoByGrupoYCentroPR2
// tal cual llega (todas sus columnas), para verificar si la consulta y el cálculo de Empaque son
// correctos — p. ej. 20003095 salía a 15 s/und (respaldo) en PFD-VENTA. Consulta propia, no depende
// de lo sincronizado; permite probar otros grupos además de los de Venta Externa.
export const VentaExternaTiemposServicioTab: React.FC<Props> = ({ grupos, tiemposModulo, lineasPfd }) => {
  const [centro, setCentro] = useState<'1000' | '2000'>('1000');
  const [gruposExtra, setGruposExtra] = useState('');
  const [cargando, setCargando] = useState(false);
  const [resultado, setResultado] = useState<{ grupo: number; filas: Record<string, unknown>[]; error?: string }[]>([]);
  const [filtro, setFiltro] = useState('');

  const gruposVE = useMemo(() => grupos.filter(g => String(g.centro ?? '') === centro).map(g => g.codigo_grupo), [grupos, centro]);

  const consultar = async () => {
    const extra = gruposExtra.split(/[\s,;]+/).map(Number).filter(n => Number.isInteger(n) && n > 0);
    const codigos = [...new Set([...gruposVE, ...extra])];
    setCargando(true);
    const res = await Promise.all(codigos.map(async grupo => {
      try {
        const r = await serviciosService.tiemposEnsambladoByGrupoYCentroPR2(centro, grupo);
        const filas = (Array.isArray(r?.data) ? r.data : r?.data?.data) || [];
        return { grupo, filas: filas as Record<string, unknown>[] };
      } catch (e) {
        return { grupo, filas: [], error: (e as Error).message };
      }
    }));
    setResultado(res);
    setCargando(false);
  };

  const todas = useMemo(() => resultado.flatMap(r => r.filas.map((f): Record<string, unknown> => ({ ...f, __grupo: r.grupo }))), [resultado]);
  const columnas = useMemo(() => {
    const set = new Set<string>();
    todas.slice(0, 300).forEach(f => Object.keys(f).forEach(k => k !== '__grupo' && set.add(k)));
    return [...set];
  }, [todas]);
  const visibles = useMemo(() => {
    const q = filtro.trim().toUpperCase();
    const f = q ? todas.filter(t => Object.values(t).some(v => String(v ?? '').toUpperCase().includes(q))) : todas;
    return f.slice(0, 500);
  }, [todas, filtro]);

  // Verificación: cada PT de PFD-VENTA contra lo que devolvió el servicio.
  const porMaterial = useMemo(() => {
    const m = new Map<string, Record<string, unknown>[]>();
    todas.forEach(t => { const c = codigoMaterial(t); if (!m.has(c)) m.set(c, []); m.get(c)!.push(t); });
    return m;
  }, [todas]);
  const verificacion = lineasPfd[centro].map(l => {
    const filas = porMaterial.get(l.material) || [];
    const min = filas.map(minPorUnidadTiempo).find(v => v !== null) ?? null;
    return { ...l, filas: filas.length, min, horasServicio: min !== null ? (l.cantidad * min) / 60 : null };
  });

  return (
    <div className="space-y-5">
      <div className="rounded-2xl border border-gray-100 bg-white p-5 shadow-sm space-y-3">
        <div>
          <p className="text-[10px] font-bold uppercase text-cyan-600 tracking-wider">Consulta de verificación</p>
          <h3 className="text-sm font-black text-gray-700 uppercase">Servicio de tiempos · tiemposEnsambladoByGrupoYCentroPR2</h3>
          <p className="text-[11px] text-gray-500 mt-1">
            Muestra lo que devuelve el servicio por Centro + Código de grupo, con todas sus columnas, y lo cruza con el último PFD-VENTA.
            El módulo tiene cargadas hoy <b>{tiemposModulo[centro]}</b> filas de tiempos para el Centro {centro} (lo que usa el cálculo).
          </p>
        </div>
        <div className="flex flex-wrap items-end gap-3">
          <div className="flex rounded-lg border border-gray-200 overflow-hidden">
            {(['1000', '2000'] as const).map(c => (
              <button key={c} type="button" onClick={() => setCentro(c)}
                className={cn('px-3 py-1.5 text-[11px] font-black', centro === c ? 'bg-cyan-600 text-white' : 'bg-white text-slate-600 hover:bg-slate-50')}>
                Centro {c}
              </button>
            ))}
          </div>
          <div className="text-[11px] text-slate-600">
            Grupos Venta Externa: <b>{gruposVE.length ? gruposVE.join(', ') : '— (ninguno con este centro)'}</b>
          </div>
          <div className="flex flex-col">
            <label className="text-[10px] font-bold uppercase text-slate-500">Otros grupos (opcional)</label>
            <Input value={gruposExtra} onChange={e => setGruposExtra(e.target.value)} placeholder="ej. 5, 12" className="h-8 w-40 text-xs" />
          </div>
          <button type="button" onClick={consultar} disabled={cargando}
            className="flex items-center gap-1.5 rounded-lg bg-cyan-600 px-3 py-2 text-[11px] font-black uppercase text-white hover:bg-cyan-700 disabled:opacity-60">
            {cargando ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <RefreshCw className="w-3.5 h-3.5" />} Consultar servicio
          </button>
        </div>
        {resultado.length > 0 && (
          <div className="flex flex-wrap gap-2">
            {resultado.map(r => (
              <span key={r.grupo} className={cn('rounded-md border px-2 py-1 text-[11px] font-bold', r.error ? 'border-red-200 bg-red-50 text-red-700' : r.filas.length ? 'border-emerald-200 bg-emerald-50 text-emerald-700' : 'border-amber-200 bg-amber-50 text-amber-700')}>
                Grupo {r.grupo}: {r.error ? `error — ${r.error}` : `${r.filas.length} filas`}
              </span>
            ))}
          </div>
        )}
      </div>

      {resultado.length > 0 && verificacion.length > 0 && (
        <div className="rounded-2xl border border-gray-100 bg-white shadow-sm overflow-hidden">
          <p className="px-5 pt-4 pb-2 text-[11px] font-black uppercase text-slate-700">Verificación PFD-VENTA · Centro {centro}</p>
          <div className="overflow-x-auto">
            <table className="w-full text-[11px]">
              <thead className="bg-slate-50 text-[10px] uppercase text-slate-500">
                <tr>
                  <th className="px-3 py-2 text-left">Material</th>
                  <th className="px-3 py-2 text-left">Descripción</th>
                  <th className="px-3 py-2 text-right">Cantidad</th>
                  <th className="px-3 py-2 text-right">Filas en servicio</th>
                  <th className="px-3 py-2 text-right">min/und</th>
                  <th className="px-3 py-2 text-right">s/und</th>
                  <th className="px-3 py-2 text-right">Horas (servicio)</th>
                  <th className="px-3 py-2 text-right">Horas (PFD-VENTA)</th>
                </tr>
              </thead>
              <tbody>
                {verificacion.map(v => (
                  <tr key={v.material} className={cn('border-t border-gray-100', v.min === null && 'bg-red-50/60')}>
                    <td className="px-3 py-1.5 font-mono text-indigo-700">{v.material}</td>
                    <td className="px-3 py-1.5 text-slate-700">{v.descripcion}</td>
                    <td className="px-3 py-1.5 text-right tabular-nums">{v.cantidad.toLocaleString()}</td>
                    <td className="px-3 py-1.5 text-right tabular-nums">{v.filas}</td>
                    <td className="px-3 py-1.5 text-right tabular-nums">{v.min !== null ? v.min.toFixed(4) : <span className="font-bold text-red-700">sin tiempo</span>}</td>
                    <td className="px-3 py-1.5 text-right tabular-nums">{v.min !== null ? (v.min * 60).toFixed(2) : '—'}</td>
                    <td className="px-3 py-1.5 text-right font-bold tabular-nums text-emerald-700">{v.horasServicio !== null ? v.horasServicio.toFixed(2) : '—'}</td>
                    <td className="px-3 py-1.5 text-right font-bold tabular-nums text-amber-700">{v.tiempoHoras.toFixed(2)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {resultado.length > 0 && (
        <div className="rounded-2xl border border-gray-100 bg-white shadow-sm overflow-hidden">
          <div className="flex flex-wrap items-center justify-between gap-3 px-5 pt-4 pb-2">
            <p className="text-[11px] font-black uppercase text-slate-700">Respuesta del servicio · {todas.length} filas{visibles.length < todas.length ? ` (se muestran ${visibles.length})` : ''}</p>
            <div className="relative">
              <Search className="absolute left-2 top-2 w-3.5 h-3.5 text-slate-400" />
              <Input value={filtro} onChange={e => setFiltro(e.target.value)} placeholder="Buscar (ej. 20003095)" className="h-8 w-56 pl-7 text-xs" />
            </div>
          </div>
          <div className="overflow-auto max-h-[520px]">
            <table className="w-full text-[11px]">
              <thead className="sticky top-0 bg-slate-50 text-[10px] uppercase text-slate-500">
                <tr>
                  <th className="px-3 py-2 text-left">Grupo</th>
                  {columnas.map(c => <th key={c} className="px-3 py-2 text-left whitespace-nowrap">{c}</th>)}
                  <th className="px-3 py-2 text-right whitespace-nowrap text-cyan-700">min/und (cálculo)</th>
                </tr>
              </thead>
              <tbody>
                {visibles.map((f, i) => {
                  const min = minPorUnidadTiempo(f);
                  return (
                    <tr key={i} className="border-t border-gray-100">
                      <td className="px-3 py-1.5 tabular-nums">{String(f.__grupo)}</td>
                      {columnas.map(c => <td key={c} className="px-3 py-1.5 whitespace-nowrap text-slate-700">{String(f[c] ?? '')}</td>)}
                      <td className="px-3 py-1.5 text-right font-bold tabular-nums text-cyan-700">{min !== null ? min.toFixed(4) : '—'}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
};
