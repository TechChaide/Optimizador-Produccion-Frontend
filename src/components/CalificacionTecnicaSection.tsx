'use client';

import React, { useMemo, useState, useEffect } from 'react';
import { serviciosService } from '@/services/servicios.service';
import {
  Loader2,
  RefreshCw,
  Search,
  GraduationCap,
  Inbox,
  Wrench,
  UserRound,
  Route,
  Gauge,
  ArrowUpNarrowWide,
  CheckCircle2,
  MousePointerClick,
  X,
} from 'lucide-react';
import { useAppContext } from '@/context/AppProvider';
import { humanizeLabel } from '@/lib/utils';

interface HabilidadOperador {
  [key: string]: any;
}

interface StationGroup {
  key: string;
  identity: Record<string, any>;
  rows: HabilidadOperador[];
}

// Normaliza un encabezado de columna a solo mayúsculas/letras para poder
// detectar columnas por significado (p.ej. "Puesto_Trabajo" -> "PUESTOTRABAJO")
// sin depender del formato exacto (espacios, guiones bajos, mayúsculas) que
// use el backend.
const norm = (s: string) => s.toUpperCase().replace(/[^A-Z]/g, '');

export const CalificacionTecnicaSection: React.FC = () => {
  const { addNotification } = useAppContext();
  const [habilidades, setHabilidades] = useState<HabilidadOperador[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [columns, setColumns] = useState<string[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedKey, setSelectedKey] = useState<string | null>(null);

  useEffect(() => {
    fetchHabilidades();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const fetchHabilidades = async () => {
    setIsLoading(true);
    try {
      const response = await serviciosService.getHabilidadesOperadorPorEstacion();
      if (response && response.data) {
        const dataArray = Array.isArray(response.data) ? response.data : [response.data];
        setHabilidades(dataArray);
        if (dataArray.length > 0) {
          setColumns(Object.keys(dataArray[0]));
        }
      } else {
        setHabilidades([]);
        addNotification('warning', 'No se encontraron datos de calificaciones técnicas');
      }
    } catch (error) {
      addNotification('error', `Error al cargar calificaciones técnicas: ${(error as Error).message}`);
      setHabilidades([]);
    } finally {
      setIsLoading(false);
    }
  };

  // ── Detección dinámica de columnas por significado ──────────────────────
  const stationIdColumns = useMemo(() => columns.filter(c => norm(c).includes('PUESTO')), [columns]);
  const operatorIdColumns = useMemo(() => columns.filter(c => norm(c).includes('OPERADOR')), [columns]);
  const lineaProcesoColumn = useMemo(() => columns.find(c => norm(c) === 'LINEAPROCESO'), [columns]);
  const nombreLineaColumn = useMemo(() => columns.find(c => norm(c) === 'NOMBRELINEA'), [columns]);
  const calificacionColumn = useMemo(() => columns.find(c => norm(c).includes('CALIFICACION')), [columns]);
  const prioridadColumn = useMemo(() => columns.find(c => norm(c).includes('PRIORIDAD')), [columns]);
  const rolColumn = useMemo(() => columns.find(c => norm(c) === 'ROL'), [columns]);
  const detailColumns = useMemo(
    () => columns.filter(c => !stationIdColumns.includes(c)),
    [columns, stationIdColumns]
  );
  const hasGrouping = stationIdColumns.length > 0;

  const filteredData = useMemo(() => {
    const term = searchTerm.trim().toLowerCase();
    if (!term) return habilidades;
    return habilidades.filter(row =>
      columns.some(col => String(row[col] ?? '').toLowerCase().includes(term))
    );
  }, [habilidades, columns, searchTerm]);

  const buildGroups = (rows: HabilidadOperador[]): StationGroup[] => {
    if (!hasGrouping) return [];
    const map = new Map<string, StationGroup>();
    for (const row of rows) {
      const key = stationIdColumns.map(c => String(row[c] ?? '')).join('||');
      let group = map.get(key);
      if (!group) {
        const identity: Record<string, any> = {};
        stationIdColumns.forEach(c => { identity[c] = row[c]; });
        group = { key, identity, rows: [] };
        map.set(key, group);
      }
      group.rows.push(row);
    }
    return Array.from(map.values());
  };

  const stationGroups = useMemo(() => buildGroups(filteredData), [filteredData, stationIdColumns, hasGrouping]);
  // Totales del header: se calculan sobre el dataset completo (sin filtro de búsqueda)
  // para que las cifras de arriba no "salten" mientras el usuario escribe.
  const allStationGroups = useMemo(() => buildGroups(habilidades), [habilidades, stationIdColumns, hasGrouping]);
  const totalOperadoresUnicos = useMemo(() => {
    if (operatorIdColumns.length === 0) return null;
    return new Set(habilidades.map(row => operatorIdColumns.map(c => String(row[c] ?? '')).join('||'))).size;
  }, [habilidades, operatorIdColumns]);

  const selectedGroup = useMemo(
    () => stationGroups.find(g => g.key === selectedKey) || null,
    [stationGroups, selectedKey]
  );

  // ── Estadísticas del puesto de trabajo seleccionado ─────────────────────
  const selectedStats = useMemo(() => {
    if (!selectedGroup) return null;
    const rows = selectedGroup.rows;

    const operadoresUnicos = operatorIdColumns.length > 0
      ? new Set(rows.map(r => operatorIdColumns.map(c => String(r[c] ?? '')).join('||'))).size
      : rows.length;

    const lineasUnicas = nombreLineaColumn
      ? new Set(rows.map(r => String(r[nombreLineaColumn] ?? ''))).size
      : null;

    const calificacionValues = calificacionColumn
      ? rows.map(r => Number(r[calificacionColumn])).filter(n => !Number.isNaN(n))
      : [];
    const calificacionAvg = calificacionValues.length > 0
      ? calificacionValues.reduce((a, b) => a + b, 0) / calificacionValues.length
      : null;

    const prioridadValues = prioridadColumn
      ? rows.map(r => Number(r[prioridadColumn])).filter(n => !Number.isNaN(n))
      : [];
    const prioridadAvg = prioridadValues.length > 0
      ? prioridadValues.reduce((a, b) => a + b, 0) / prioridadValues.length
      : null;

    let rolBreakdown: { rol: string; count: number; pct: number }[] = [];
    if (rolColumn) {
      const counts = new Map<string, number>();
      rows.forEach(r => {
        const rol = String(r[rolColumn] ?? 'Sin rol');
        counts.set(rol, (counts.get(rol) || 0) + 1);
      });
      rolBreakdown = Array.from(counts.entries())
        .map(([rol, count]) => ({ rol, count, pct: (count / rows.length) * 100 }))
        .sort((a, b) => b.count - a.count);
    }

    return { operadoresUnicos, lineasUnicas, calificacionAvg, prioridadAvg, rolBreakdown };
  }, [selectedGroup, operatorIdColumns, nombreLineaColumn, calificacionColumn, prioridadColumn, rolColumn]);

  return (
    <div className="p-6 md:p-8 space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div className="flex items-center gap-3">
          <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-indigo-600/10">
            <GraduationCap className="h-6 w-6 text-indigo-600" />
          </div>
          <div>
            <h1 className="text-2xl font-bold tracking-tight text-gray-900">Calificación Técnica</h1>
            <p className="text-sm text-gray-500">Habilidades certificadas de cada operador por estación de trabajo.</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {hasGrouping && (
            <div className="hidden sm:flex items-center gap-1.5 rounded-full border border-indigo-100 bg-indigo-50 px-3 py-1.5 text-xs font-semibold text-indigo-700">
              {allStationGroups.length} puestos de trabajo
            </div>
          )}
          {totalOperadoresUnicos !== null && (
            <div className="hidden sm:flex items-center gap-1.5 rounded-full border border-emerald-100 bg-emerald-50 px-3 py-1.5 text-xs font-semibold text-emerald-700">
              {totalOperadoresUnicos} operadores
            </div>
          )}
          <button
            onClick={fetchHabilidades}
            disabled={isLoading}
            className="inline-flex items-center gap-2 rounded-lg border border-gray-200 bg-white px-4 py-2 text-sm font-medium text-gray-700 shadow-sm transition-colors hover:bg-gray-50 disabled:opacity-50"
          >
            <RefreshCw className={`h-4 w-4 ${isLoading ? 'animate-spin' : ''}`} />
            Actualizar
          </button>
        </div>
      </div>

      {/* Search */}
      <div className="relative w-full sm:max-w-sm">
        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
        <input
          type="search"
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          placeholder="Buscar puesto, línea, operador..."
          className="w-full rounded-lg border border-gray-200 bg-white py-2 pl-9 pr-3 text-sm shadow-sm outline-none transition-colors focus:border-indigo-300 focus:ring-2 focus:ring-indigo-100"
        />
      </div>

      {isLoading ? (
        <div className="flex flex-col items-center justify-center gap-3 rounded-2xl border border-gray-100 bg-white py-24 text-gray-400 shadow-sm">
          <Loader2 className="h-8 w-8 animate-spin text-indigo-500" />
          <span className="text-sm">Cargando calificaciones técnicas...</span>
        </div>
      ) : !hasGrouping || filteredData.length === 0 ? (
        <div className="flex flex-col items-center justify-center gap-2 rounded-2xl border border-gray-100 bg-white py-24 text-gray-400 shadow-sm">
          <Inbox className="h-10 w-10" />
          <p className="text-sm">
            {habilidades.length === 0 ? 'No hay datos disponibles' : 'Ningún registro coincide con la búsqueda'}
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-[1fr_400px] lg:items-start">
          {/* Cards grid: un puesto de trabajo por tarjeta */}
          <div className="grid max-h-[70vh] grid-cols-1 gap-3 overflow-y-auto rounded-2xl border border-gray-100 bg-gray-50/60 p-4 sm:grid-cols-2 xl:grid-cols-3">
            {stationGroups.map((group) => {
              const isSelected = group.key === selectedKey;
              const operadoresUnicos = operatorIdColumns.length > 0
                ? new Set(group.rows.map(r => operatorIdColumns.map(c => String(r[c] ?? '')).join('||'))).size
                : group.rows.length;
              const lineasUnicas = nombreLineaColumn
                ? new Set(group.rows.map(r => String(r[nombreLineaColumn] ?? ''))).size
                : null;
              const codigo = stationIdColumns.find(c => norm(c) === 'PUESTOTRABAJO');
              const nombreEstacion = stationIdColumns.find(c => c !== codigo);

              return (
                <button
                  key={group.key}
                  type="button"
                  onClick={() => setSelectedKey(isSelected ? null : group.key)}
                  className={`group relative flex flex-col gap-3 rounded-2xl border bg-white p-4 text-left shadow-sm transition-all hover:-translate-y-0.5 hover:shadow-md ${
                    isSelected ? 'border-indigo-400 ring-2 ring-indigo-100' : 'border-gray-100'
                  }`}
                >
                  {isSelected && (
                    <CheckCircle2 className="absolute right-3 top-3 h-5 w-5 text-indigo-600" />
                  )}
                  <div className="flex items-center gap-2.5">
                    <div className={`flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-xl ${isSelected ? 'bg-indigo-600 text-white' : 'bg-indigo-600/10 text-indigo-600'}`}>
                      <Wrench className="h-4.5 w-4.5" />
                    </div>
                    <div className="min-w-0">
                      {codigo && (
                        <span className="block truncate font-mono text-[11px] font-semibold uppercase tracking-wide text-gray-400">
                          {String(group.identity[codigo])}
                        </span>
                      )}
                      <span className="block truncate text-sm font-semibold text-gray-900">
                        {nombreEstacion ? String(group.identity[nombreEstacion]) : String(Object.values(group.identity)[0])}
                      </span>
                    </div>
                  </div>

                  {lineaProcesoColumn && group.rows[0]?.[lineaProcesoColumn] && (
                    <span className="w-fit rounded-full bg-gray-100 px-2 py-0.5 text-[11px] font-medium text-gray-600">
                      {String(group.rows[0][lineaProcesoColumn])}
                    </span>
                  )}

                  <div className="mt-1 flex items-center gap-4 border-t border-gray-100 pt-3 text-xs text-gray-500">
                    <span className="flex items-center gap-1.5">
                      <UserRound className="h-3.5 w-3.5 text-gray-400" />
                      <span className="font-semibold text-gray-700">{operadoresUnicos}</span> operador{operadoresUnicos === 1 ? '' : 'es'}
                    </span>
                    {lineasUnicas !== null && (
                      <span className="flex items-center gap-1.5">
                        <Route className="h-3.5 w-3.5 text-gray-400" />
                        <span className="font-semibold text-gray-700">{lineasUnicas}</span> línea{lineasUnicas === 1 ? '' : 's'}
                      </span>
                    )}
                  </div>
                </button>
              );
            })}
          </div>

          {/* Panel de detalle / estadísticas del puesto seleccionado */}
          <div className="rounded-2xl border border-gray-100 bg-white shadow-sm lg:sticky lg:top-6">
            {!selectedGroup || !selectedStats ? (
              <div className="flex flex-col items-center justify-center gap-3 px-6 py-16 text-center text-gray-400">
                <MousePointerClick className="h-9 w-9" />
                <p className="text-sm">Selecciona un puesto de trabajo para ver sus estadísticas y el detalle de operadores certificados.</p>
              </div>
            ) : (
              <>
                <div className="flex items-start justify-between gap-3 border-b border-gray-100 px-5 py-4">
                  <div className="flex items-center gap-3">
                    <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-indigo-600/10">
                      <Wrench className="h-5 w-5 text-indigo-600" />
                    </div>
                    <div>
                      <p className="text-sm font-semibold text-gray-900">
                        {String(Object.values(selectedGroup.identity)[Object.values(selectedGroup.identity).length - 1] ?? Object.values(selectedGroup.identity)[0])}
                      </p>
                      <p className="text-xs text-gray-400">
                        {stationIdColumns.map(c => String(selectedGroup.identity[c])).join(' · ')}
                      </p>
                    </div>
                  </div>
                  <button
                    onClick={() => setSelectedKey(null)}
                    className="rounded-md p-1 text-gray-400 transition-colors hover:bg-gray-100 hover:text-gray-600"
                    aria-label="Cerrar detalle"
                  >
                    <X className="h-4 w-4" />
                  </button>
                </div>

                {/* Stat tiles */}
                <div className="grid grid-cols-2 gap-3 px-5 pt-4">
                  <div className="rounded-xl bg-indigo-50 p-3">
                    <div className="flex items-center gap-1.5 text-indigo-600">
                      <UserRound className="h-3.5 w-3.5" />
                      <span className="text-[11px] font-bold uppercase tracking-wide">Operadores</span>
                    </div>
                    <p className="mt-1 text-2xl font-bold text-indigo-900">{selectedStats.operadoresUnicos}</p>
                  </div>
                  {selectedStats.lineasUnicas !== null && (
                    <div className="rounded-xl bg-emerald-50 p-3">
                      <div className="flex items-center gap-1.5 text-emerald-600">
                        <Route className="h-3.5 w-3.5" />
                        <span className="text-[11px] font-bold uppercase tracking-wide">Líneas</span>
                      </div>
                      <p className="mt-1 text-2xl font-bold text-emerald-900">{selectedStats.lineasUnicas}</p>
                    </div>
                  )}
                  {selectedStats.calificacionAvg !== null && (
                    <div className="rounded-xl bg-amber-50 p-3">
                      <div className="flex items-center gap-1.5 text-amber-600">
                        <Gauge className="h-3.5 w-3.5" />
                        <span className="text-[11px] font-bold uppercase tracking-wide">Calificación</span>
                      </div>
                      <p className="mt-1 text-2xl font-bold text-amber-900">{selectedStats.calificacionAvg.toFixed(0)}</p>
                    </div>
                  )}
                  {selectedStats.prioridadAvg !== null && (
                    <div className="rounded-xl bg-rose-50 p-3">
                      <div className="flex items-center gap-1.5 text-rose-600">
                        <ArrowUpNarrowWide className="h-3.5 w-3.5" />
                        <span className="text-[11px] font-bold uppercase tracking-wide">Prioridad prom.</span>
                      </div>
                      <p className="mt-1 text-2xl font-bold text-rose-900">{selectedStats.prioridadAvg.toFixed(1)}</p>
                    </div>
                  )}
                </div>

                {/* Distribución por rol */}
                {selectedStats.rolBreakdown.length > 0 && (
                  <div className="space-y-2 px-5 pt-4">
                    <p className="text-[11px] font-bold uppercase tracking-wide text-gray-400">Distribución por rol</p>
                    {selectedStats.rolBreakdown.map(({ rol, count, pct }) => (
                      <div key={rol} className="space-y-1">
                        <div className="flex items-center justify-between text-xs">
                          <span className="font-medium text-gray-700">{rol}</span>
                          <span className="text-gray-400">{count} ({pct.toFixed(0)}%)</span>
                        </div>
                        <div className="h-1.5 w-full overflow-hidden rounded-full bg-gray-100">
                          <div className="h-full rounded-full bg-indigo-500" style={{ width: `${pct}%` }} />
                        </div>
                      </div>
                    ))}
                  </div>
                )}

                {/* Roster de operadores */}
                <div className="mt-4 border-t border-gray-100">
                  <p className="px-5 pt-4 text-[11px] font-bold uppercase tracking-wide text-gray-400">
                    Operadores certificados ({selectedGroup.rows.length})
                  </p>
                  <div className="max-h-72 overflow-auto px-5 pb-5 pt-2">
                    <table className="w-full border-collapse text-xs">
                      <thead>
                        <tr>
                          {detailColumns.map(col => (
                            <th key={col} className="whitespace-nowrap border-b border-gray-100 py-1.5 pr-3 text-left font-bold uppercase tracking-wide text-gray-400">
                              {humanizeLabel(col)}
                            </th>
                          ))}
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-50">
                        {selectedGroup.rows.map((row, idx) => (
                          <tr key={idx} className="hover:bg-indigo-50/40">
                            {detailColumns.map(col => (
                              <td key={`${idx}-${col}`} className="whitespace-nowrap py-1.5 pr-3 text-gray-700">
                                {typeof row[col] === 'object' ? JSON.stringify(row[col]) : String(row[col] ?? '-')}
                              </td>
                            ))}
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
};
