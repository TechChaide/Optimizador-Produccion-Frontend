
'use client';

import React, { useState, useEffect, forwardRef, useImperativeHandle, memo, useRef, useMemo, useCallback } from 'react';
import { MONTH_NUMBERS, VISIBLE_COLUMNS } from './constants';
import { computeNecesidades, normalizeMaterialCode } from './utils';
import { serviciosService } from '@/services/servicios.service';

const RawBackendTableRow = memo(function RawBackendTableRow({ row, idx }: { row: Record<string, unknown>; idx: number }) {
  const r = row as Record<string, unknown> & {
    _isAgregatedF?: boolean;
    _Necesidades?: number;
    PuestoCuellodeBottella?: string;
    TiempoFabricacionNecesidad?: number | null;
  };
  return (
    <tr className={`hover:bg-gray-50 ${r._isAgregatedF ? 'bg-blue-50/30' : ''}`}>
      {VISIBLE_COLUMNS.map(col => (
        <td key={`cell-${idx}-${col}`} className="px-4 py-2">{String(r[col] ?? '')}</td>
      ))}
      <td className="px-4 py-2 text-right font-mono font-bold text-blue-800">{Math.round(Number(r._Necesidades ?? 0)).toLocaleString()}</td>
      <td className="px-4 py-2">{r.PuestoCuellodeBottella || '-'}</td>
      <td className="px-4 py-2 text-right font-mono">{r.TiempoFabricacionNecesidad != null ? Number(r.TiempoFabricacionNecesidad).toLocaleString() : '-'}</td>
    </tr>
  );
});
RawBackendTableRow.displayName = 'RawBackendTableRow';

const TABLE_COL_COUNT = VISIBLE_COLUMNS.length + 3;

type SectorHierarchyNode = {
  sector: string;
  rows: any[];
  centros: { centro: string; rows: any[] }[];
};

function buildSectorCentroHierarchy(rows: any[]): SectorHierarchyNode[] {
  const bySector = new Map<string, Map<string, any[]>>();
  for (const row of rows) {
    const sector = String(row.Sector ?? '').trim() || '(Sin sector)';
    const centro = String(row.Centro ?? '').trim() || '(Sin centro)';
    if (!bySector.has(sector)) bySector.set(sector, new Map());
    const byC = bySector.get(sector)!;
    if (!byC.has(centro)) byC.set(centro, []);
    byC.get(centro)!.push(row);
  }
  return Array.from(bySector.entries())
    .map(([sector, centroMap]) => {
      const centros = Array.from(centroMap.entries())
        .map(([centro, r]) => ({ centro, rows: r }))
        .sort((a, b) => a.centro.localeCompare(b.centro, 'es', { numeric: true }));
      const rowsFlat = centros.flatMap(c => c.rows);
      return { sector, rows: rowsFlat, centros };
    })
    .sort((a, b) => a.sector.localeCompare(b.sector, 'es'));
}

function sumNum(rows: any[], field: string): number {
  return rows.reduce((s, r) => s + Number(r[field] ?? 0), 0);
}

function centroKey(sector: string, centro: string): string {
  return JSON.stringify([sector, centro]);
}

interface RawBackendDataTableProps {
  año: string;
  meses: string[];
  centros: string[];
  onDataLoaded?: (data: any[]) => void;
}

export interface RawBackendDataTableHandle {
  loadData: () => Promise<void>;
}

export const RawBackendDataTable = forwardRef<RawBackendDataTableHandle, RawBackendDataTableProps>(
  ({ año, meses, centros, onDataLoaded }, ref) => {
    const [pageSize, setPageSize] = useState<number>(20);
    const [page, setPage] = useState<number>(1);
    const [searchTerm, setSearchTerm] = useState<string>('');
    const [sectorFilter, setSectorFilter] = useState<string>('');
    const [mesFilter, setMesFilter] = useState<string>('');
    const [rawData, setRawData] = useState<any[]>([]);
    const [isLoading, setIsLoading] = useState<boolean>(false);
    const [error, setError] = useState<string>('');
    const [totalRecordsTarget, setTotalRecordsTarget] = useState<number>(0);
    const [processedRecords, setProcessedRecords] = useState<number>(0);
    const [loadingPhase, setLoadingPhase] = useState<'downloading' | 'calculating' | null>(null);
    const [batchSize, setBatchSize] = useState<number>(10);
    const [expandedSectors, setExpandedSectors] = useState<Set<string>>(() => new Set());
    const [expandedCentros, setExpandedCentros] = useState<Set<string>>(() => new Set());
    const loadSeqRef = useRef(0);

    const processInBatches = async <T, R>(
      items: T[],
      processor: (item: T) => Promise<R>,
      concurrency: number,
      onProgress?: () => void
    ): Promise<R[]> => {
      const results: R[] = [];
      for (let i = 0; i < items.length; i += concurrency) {
        const batch = items.slice(i, i + concurrency);
        const batchResults = await Promise.all(
          batch.map(async (item) => {
            const result = await processor(item);
            onProgress?.();
            return result;
          })
        );
        results.push(...batchResults);
      }
      return results;
    };

    useImperativeHandle(ref, () => ({
      loadData: async () => {
        const currentLoadSeq = ++loadSeqRef.current;
        if (!año || meses.length === 0 || centros.length === 0) {
          alert('Faltan datos para cargar');
          return;
        }

        setIsLoading(true);
        setLoadingPhase('downloading');
        setError('');
        setRawData([]);
        setPage(1);
        setProcessedRecords(0);
        setTotalRecordsTarget(0);

        try {
          const mesNums = meses.map(mes => {
            const asNumber = Number(mes);
            if (!Number.isNaN(asNumber) && asNumber >= 1 && asNumber <= 12) return asNumber;
            return MONTH_NUMBERS[mes as keyof typeof MONTH_NUMBERS];
          }).filter(Boolean);
          
          const mesString = mesNums.join('&');
          const allData: any[] = [];

          for (const centro of centros) {
            const firstResponse = await serviciosService.getMaestroPorMesesYAnio(año, centro, mesString, 1, 1);
            const total = firstResponse.totalRegistros || firstResponse.data?.length || 0;
            if (total === 0) continue;

            const pagSize = 50000;
            const totalPages = Math.ceil(total / pagSize);

            for (let pageNum = 1; pageNum <= totalPages; pageNum++) {
              const response = await serviciosService.getMaestroPorMesesYAnio(año, centro, mesString, pageNum, pagSize);
              const items = response.data || [];
              allData.push(...items);
            }
          }

          // Agregación por material y preservación de stock máximo
          const dataAgrupadaMap = new Map<string, any>();
          
          allData.forEach((item: any) => {
            const code = normalizeMaterialCode(item.CodMaterial);
            const mes = String(item.Mes);
            const clase = String(item.ClaseAprovisionam || '').trim().toUpperCase();
            
            const centroFabResponsable = clase === 'F' ? '1000' : String(item.Centro).trim();
            // La clave preserva el Centro original para que materiales clase F del centro 2000
            // no se fusionen con los del centro 1000 (ambos fabrican en 1000 pero tienen demanda distinta)
            const key = `${code}|${mes}|${String(item.Centro).trim()}`;

            if (!dataAgrupadaMap.has(key)) {
              dataAgrupadaMap.set(key, {
                ...item,
                CentroFabricacion: centroFabResponsable,
                UnidadesProyectado: 0,
                StockActual: 0,
                StockSeguridad: 0,
                _originalCentro: item.Centro,
                _isAgregatedF: clase === 'F'
              });
            }
            
            const agg = dataAgrupadaMap.get(key)!;
            agg.UnidadesProyectado += Number(item.UnidadesProyectado || 0);
            agg.StockActual = Math.max(agg.StockActual, Number(item.StockActual || 0));
            agg.StockSeguridad = Math.max(agg.StockSeguridad, Number(item.StockSeguridad || 0));
          });

          const dataFinalAgrupada = Array.from(dataAgrupadaMap.values());
          const dataWithNecesidades = dataFinalAgrupada.map((r: any) => ({ ...r, _Necesidades: computeNecesidades(r) }));

          setLoadingPhase('calculating');

          const filasParaCalcular = dataWithNecesidades.filter((r: any) => {
            const centroFab = String(r.CentroFabricacion || r.Centro || '');
            const resp = String(r.RespCtrlProd || '');
            const aplicar1000 = centroFab === '1000' && (resp === '003' || resp === '004');
            const aplicar2000 = centroFab === '2000' && (resp === '003' || resp === '006');
            return aplicar1000 || aplicar2000;
          });

          setTotalRecordsTarget(filasParaCalcular.length);
          setProcessedRecords(0);

          await processInBatches(
            filasParaCalcular,
            async (r: any) => {
              const centroFab = String(r.CentroFabricacion || r.Centro || '');
              const CodigoMaterial = String(r.CodMaterial || '');
              const LineaFabricacion = String(r.LineaFabricacion || '');
              const Categoria = String(r.Categoria || r.ClaseAprovisionam || '');
              const Necesidad = Math.round(Number(r._Necesidades ?? 0));

              try {
                const res = await serviciosService.getTiempoMaximoDeFabricacionMaterial(CodigoMaterial, centroFab, LineaFabricacion, Categoria, Necesidad);
                if (res && res.data) {
                  const payload = Array.isArray(res.data) ? res.data[0] : res.data;
                  r.TiempoFabricacionNecesidad = payload?.Tiempo_Total ?? null;
                  r.PuestoCuellodeBottella = payload?.PuestoTrabajo ?? null;
                  r.TiempoPorUnidad = payload?.Tiempo_Min ?? null;
                  r.NumeroPuestos = payload?.numero_puestos ?? null;
                  r.TiempoFabricacionNecesidadHoras = r.TiempoFabricacionNecesidad != null ? Number((Number(r.TiempoFabricacionNecesidad) / 60).toFixed(3)) : null;
                }
              } catch (err) {
                console.error('Error al obtener tiempo fabricación para', CodigoMaterial, err);
              }
            },
            batchSize,
            () => {
              if (currentLoadSeq !== loadSeqRef.current) return;
              setProcessedRecords(prev => prev + 1);
            }
          );

          if (currentLoadSeq !== loadSeqRef.current) return;
          setRawData(dataWithNecesidades);
          if (onDataLoaded) onDataLoaded(dataWithNecesidades);
        } catch (err) {
          if (currentLoadSeq !== loadSeqRef.current) return;
          setError((err as Error).message);
        } finally {
          if (currentLoadSeq !== loadSeqRef.current) return;
          setIsLoading(false);
          setLoadingPhase(null);
        }
      }
    }), [año, meses, centros, onDataLoaded, batchSize]);

    const sectorOptions = Array.from(
      new Set(rawData.map((row: any) => String(row.Sector ?? '').trim()).filter(Boolean)),
    ).sort((a, b) => a.localeCompare(b, 'es'));

    const mesOptions = Array.from(
      new Set(rawData.map((row: any) => String(row.Mes ?? '').trim()).filter(Boolean)),
    ).sort((a, b) => Number(a) - Number(b));

    const filteredData = rawData.filter((row: any) => {
      if (searchTerm && !String(row.CodMaterial || '').toLowerCase().includes(searchTerm.toLowerCase())) return false;
      if (sectorFilter && String(row.Sector ?? '').trim() !== sectorFilter) return false;
      if (mesFilter && String(row.Mes ?? '').trim() !== mesFilter) return false;
      return true;
    });

    const hierarchy = useMemo(() => buildSectorCentroHierarchy(filteredData), [filteredData]);

    useEffect(() => {
      setPage(1);
    }, [searchTerm, sectorFilter, mesFilter]);

    useEffect(() => {
      setExpandedSectors(new Set());
      setExpandedCentros(new Set());
    }, [rawData]);

    const totalPages = Math.max(1, Math.ceil(hierarchy.length / pageSize));
    const pageSectors = hierarchy.slice((page - 1) * pageSize, page * pageSize);

    const toggleSector = useCallback((sector: string) => {
      setExpandedSectors(prev => {
        const wasOpen = prev.has(sector);
        const next = new Set(prev);
        if (wasOpen) {
          next.delete(sector);
          queueMicrotask(() => {
            setExpandedCentros(pc => {
              const m = new Set(pc);
              for (const k of m) {
                try {
                  const [s] = JSON.parse(k) as [string, string];
                  if (s === sector) m.delete(k);
                } catch {
                  /* ignore */
                }
              }
              return m;
            });
          });
        } else {
          next.add(sector);
        }
        return next;
      });
    }, []);

    const toggleCentro = useCallback((sector: string, centro: string) => {
      const key = centroKey(sector, centro);
      setExpandedCentros(prev => {
        const next = new Set(prev);
        if (next.has(key)) next.delete(key);
        else next.add(key);
        return next;
      });
    }, []);

    if (isLoading) {
      const progressPercent = totalRecordsTarget > 0 ? Math.min((processedRecords / totalRecordsTarget) * 100, 100) : 0;
      return (
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-8 text-center">
          <div className="max-w-md mx-auto space-y-4">
            <h3 className="font-bold text-lg text-blue-800">
              {loadingPhase === 'downloading' ? '1. Descargando datos del backend...' : '2. Calculando tiempos por cuello de botella...'}
            </h3>
            <div className="w-full bg-gray-200 rounded-full h-4 overflow-hidden">
              <div className="bg-blue-600 h-full transition-all duration-300" style={{ width: `${progressPercent}%` }} />
            </div>
            <p className="text-sm text-gray-600">{processedRecords.toLocaleString()} de {totalRecordsTarget.toLocaleString()}</p>
          </div>
        </div>
      );
    }

    return (
      <div className="bg-white rounded-lg shadow-sm border border-gray-200">
        <div className="p-4 border-b border-gray-200">
          <p className="text-xs text-gray-600 mb-3">
            Vista agrupada: al cargar, los datos quedan <strong>contraídos</strong> por sector y centro. Use{' '}
            <span className="font-mono">+</span> para desplegar centros y materiales.
          </p>
          <div className="flex flex-wrap items-end gap-4">
            <div className="flex-1 min-w-[200px]">
              <input type="search" placeholder="Buscar material..." value={searchTerm} onChange={e => setSearchTerm(e.target.value)} className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm" />
            </div>
            <div className="min-w-[180px]">
              <label className="block text-[11px] font-semibold text-gray-600 mb-1">Sector</label>
              <select
                value={sectorFilter}
                onChange={e => setSectorFilter(e.target.value)}
                className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm bg-white"
              >
                <option value="">Todos</option>
                {sectorOptions.map(s => (
                  <option key={s} value={s}>{s}</option>
                ))}
              </select>
            </div>
            <div className="min-w-[140px]">
              <label className="block text-[11px] font-semibold text-gray-600 mb-1">Mes</label>
              <select
                value={mesFilter}
                onChange={e => setMesFilter(e.target.value)}
                className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm bg-white"
              >
                <option value="">Todos</option>
                {mesOptions.map(m => (
                  <option key={m} value={m}>{m}</option>
                ))}
              </select>
            </div>
            <button onClick={() => ref && 'current' in ref && (ref.current as any)?.loadData()} className="bg-green-600 text-white px-4 py-2 rounded-md font-bold text-sm hover:bg-green-700 transition">
              Cargar y Agrupar
            </button>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead className="bg-gray-50 border-b">
              <tr>
                {VISIBLE_COLUMNS.map(col => <th key={`head-col-${col}`} className="px-4 py-3 text-left font-semibold uppercase">{col}</th>)}
                <th className="px-4 py-3 text-right font-bold text-blue-700">Nec. Agrupada</th>
                <th className="px-4 py-3 text-left">Puesto CB</th>
                <th className="px-4 py-3 text-right">T. Fab (min)</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {pageSectors.map(seg => {
                const sectorOpen = expandedSectors.has(seg.sector);
                const nMat = seg.rows.length;
                const sumUnid = sumNum(seg.rows, 'UnidadesProyectado');
                const sumNec = sumNum(seg.rows, '_Necesidades');
                const nCentros = seg.centros.length;
                return (
                  <React.Fragment key={`sector-${seg.sector}`}>
                    <tr className="bg-slate-200/90 border-y border-slate-300">
                      <td colSpan={TABLE_COL_COUNT} className="px-3 py-2.5">
                        <div className="flex flex-wrap items-center gap-2 text-sm">
                          <button
                            type="button"
                            onClick={() => toggleSector(seg.sector)}
                            className="inline-flex h-7 w-7 items-center justify-center rounded border border-slate-400 bg-white text-slate-800 font-bold hover:bg-slate-50"
                            aria-expanded={sectorOpen}
                            title={sectorOpen ? 'Contraer sector' : 'Expandir centros del sector'}
                          >
                            {sectorOpen ? '−' : '+'}
                          </button>
                          <span className="font-semibold text-slate-900">Sector: {seg.sector}</span>
                          <span className="text-xs text-slate-700">
                            {nCentros} centro(s) · {nMat} material(es) · Σ Unid. proyectadas:{' '}
                            <strong>{Math.round(sumUnid).toLocaleString()}</strong> · Σ Nec. agrupada:{' '}
                            <strong>{Math.round(sumNec).toLocaleString()}</strong>
                          </span>
                        </div>
                      </td>
                    </tr>
                    {sectorOpen &&
                      seg.centros.map(cg => {
                        const cKey = centroKey(seg.sector, cg.centro);
                        const centroOpen = expandedCentros.has(cKey);
                        const sumUnidC = sumNum(cg.rows, 'UnidadesProyectado');
                        const sumNecC = sumNum(cg.rows, '_Necesidades');
                        return (
                          <React.Fragment key={cKey}>
                            <tr className="bg-slate-100/95 border-b border-slate-200">
                              <td colSpan={TABLE_COL_COUNT} className="px-3 py-2 pl-10">
                                <div className="flex flex-wrap items-center gap-2 text-xs">
                                  <button
                                    type="button"
                                    onClick={() => toggleCentro(seg.sector, cg.centro)}
                                    className="inline-flex h-6 w-6 items-center justify-center rounded border border-slate-400 bg-white font-bold text-slate-800 hover:bg-white"
                                    aria-expanded={centroOpen}
                                    title={centroOpen ? 'Contraer materiales' : 'Ver materiales'}
                                  >
                                    {centroOpen ? '−' : '+'}
                                  </button>
                                  <span className="font-semibold text-slate-800">Centro: {cg.centro}</span>
                                  <span className="text-slate-700">
                                    {cg.rows.length} material(es) · Σ Unid.:{' '}
                                    <strong>{Math.round(sumUnidC).toLocaleString()}</strong> · Σ Nec.:{' '}
                                    <strong>{Math.round(sumNecC).toLocaleString()}</strong>
                                  </span>
                                </div>
                              </td>
                            </tr>
                            {centroOpen &&
                              cg.rows.map((row, idx) => (
                                <RawBackendTableRow
                                  key={`raw-row-${seg.sector}-${cg.centro}-${String((row as { CodMaterial?: string }).CodMaterial)}-${String((row as { Mes?: string }).Mes)}-${idx}`}
                                  row={row as Record<string, unknown>}
                                  idx={idx}
                                />
                              ))}
                          </React.Fragment>
                        );
                      })}
                  </React.Fragment>
                );
              })}
              {hierarchy.length === 0 && (
                <tr>
                  <td colSpan={TABLE_COL_COUNT} className="px-4 py-8 text-center text-gray-500 text-sm">
                    No hay registros con los filtros actuales.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
        
        <div className="p-4 bg-gray-50 border-t flex justify-between items-center text-xs">
          <span>
            Página {page} de {totalPages} <span className="text-gray-500">(sectores)</span>
          </span>
          <div className="flex gap-2">
            <button onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page === 1} className="px-3 py-1 border rounded bg-white">Anterior</button>
            <button onClick={() => setPage(p => Math.min(totalPages, p + 1))} disabled={page === totalPages} className="px-3 py-1 border rounded bg-white">Siguiente</button>
          </div>
        </div>
      </div>
    );
  }
);

RawBackendDataTable.displayName = 'RawBackendDataTable';
