'use client';

import React, { useMemo, useState, useEffect } from 'react';
import { serviciosService } from '@/services/servicios.service';
import { Loader2, RefreshCw, Search, GraduationCap, Inbox, ChevronsLeft, ChevronLeft, ChevronRight, ChevronsRight, ChevronDown, UserRound, Maximize2, Minimize2 } from 'lucide-react';
import { useAppContext } from '@/context/AppProvider';
import { humanizeLabel } from '@/lib/utils';

interface HabilidadOperador {
  [key: string]: any;
}

interface OperadorGroup {
  key: string;
  identity: Record<string, any>;
  rows: HabilidadOperador[];
}

const GROUPS_PER_PAGE = 10;

export const CalificacionTecnicaSection: React.FC = () => {
  const { addNotification } = useAppContext();
  const [habilidades, setHabilidades] = useState<HabilidadOperador[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);
  const [columns, setColumns] = useState<string[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [expanded, setExpanded] = useState<Set<string>>(new Set());

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

  const filteredData = useMemo(() => {
    const term = searchTerm.trim().toLowerCase();
    if (!term) return habilidades;
    return habilidades.filter(row =>
      columns.some(col => String(row[col] ?? '').toLowerCase().includes(term))
    );
  }, [habilidades, columns, searchTerm]);

  useEffect(() => {
    setCurrentPage(1);
  }, [searchTerm]);

  // Columnas que identifican al operador (código/nombre): son iguales en todas las
  // filas de sus distintas habilidades por puesto, así que se agrupan por ellas en
  // vez de repetirlas en cada fila de la tabla plana.
  const operatorIdColumns = useMemo(
    () => columns.filter(c => /operador/i.test(c)),
    [columns]
  );
  const hasGrouping = operatorIdColumns.length > 0;
  const detailColumns = useMemo(
    () => columns.filter(c => !operatorIdColumns.includes(c)),
    [columns, operatorIdColumns]
  );

  const groups = useMemo<OperadorGroup[]>(() => {
    if (!hasGrouping) return [];
    const map = new Map<string, OperadorGroup>();
    for (const row of filteredData) {
      const key = operatorIdColumns.map(c => String(row[c] ?? '')).join('||');
      let group = map.get(key);
      if (!group) {
        const identity: Record<string, any> = {};
        operatorIdColumns.forEach(c => { identity[c] = row[c]; });
        group = { key, identity, rows: [] };
        map.set(key, group);
      }
      group.rows.push(row);
    }
    return Array.from(map.values());
  }, [filteredData, operatorIdColumns, hasGrouping]);

  const totalPages = Math.max(1, Math.ceil(groups.length / GROUPS_PER_PAGE));
  const startIndex = (currentPage - 1) * GROUPS_PER_PAGE;
  const endIndex = startIndex + GROUPS_PER_PAGE;
  const currentGroups = groups.slice(startIndex, endIndex);

  const goToPage = (page: number) => {
    setCurrentPage(Math.max(1, Math.min(page, totalPages)));
  };

  const isSearching = searchTerm.trim().length > 0;
  const isExpanded = (key: string) => isSearching || expanded.has(key);
  const toggleExpand = (key: string) => {
    setExpanded(prev => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key); else next.add(key);
      return next;
    });
  };
  const allCurrentExpanded = currentGroups.length > 0 && currentGroups.every(g => isExpanded(g.key));
  const toggleExpandAll = () => {
    setExpanded(prev => {
      if (allCurrentExpanded) {
        const next = new Set(prev);
        currentGroups.forEach(g => next.delete(g.key));
        return next;
      }
      const next = new Set(prev);
      currentGroups.forEach(g => next.add(g.key));
      return next;
    });
  };

  const operadoresCount = hasGrouping ? groups.length : null;

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
          {operadoresCount !== null && (
            <div className="hidden sm:flex items-center gap-1.5 rounded-full border border-indigo-100 bg-indigo-50 px-3 py-1.5 text-xs font-semibold text-indigo-700">
              {operadoresCount} operadores
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

      {/* Card */}
      <div className="rounded-2xl border border-gray-100 bg-white shadow-sm">
        <div className="flex flex-col gap-3 border-b border-gray-100 p-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="relative w-full sm:max-w-xs">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
            <input
              type="search"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Buscar en la tabla..."
              className="w-full rounded-lg border border-gray-200 bg-gray-50 py-2 pl-9 pr-3 text-sm outline-none transition-colors focus:border-indigo-300 focus:bg-white focus:ring-2 focus:ring-indigo-100"
            />
          </div>
          <div className="flex items-center gap-3">
            {hasGrouping && currentGroups.length > 0 && (
              <button
                onClick={toggleExpandAll}
                className="inline-flex items-center gap-1.5 rounded-lg border border-gray-200 px-3 py-1.5 text-xs font-medium text-gray-600 transition-colors hover:bg-gray-50"
              >
                {allCurrentExpanded ? <Minimize2 className="h-3.5 w-3.5" /> : <Maximize2 className="h-3.5 w-3.5" />}
                {allCurrentExpanded ? 'Colapsar todo' : 'Expandir todo'}
              </button>
            )}
            <p className="whitespace-nowrap text-xs font-medium text-gray-400">
              {filteredData.length} registro{filteredData.length === 1 ? '' : 's'}
              {filteredData.length !== habilidades.length ? ` (de ${habilidades.length})` : ''}
            </p>
          </div>
        </div>

        {isLoading ? (
          <div className="flex flex-col items-center justify-center gap-3 py-24 text-gray-400">
            <Loader2 className="h-8 w-8 animate-spin text-indigo-500" />
            <span className="text-sm">Cargando calificaciones técnicas...</span>
          </div>
        ) : filteredData.length === 0 ? (
          <div className="flex flex-col items-center justify-center gap-2 py-24 text-gray-400">
            <Inbox className="h-10 w-10" />
            <p className="text-sm">
              {habilidades.length === 0 ? 'No hay datos disponibles' : 'Ningún registro coincide con la búsqueda'}
            </p>
          </div>
        ) : hasGrouping ? (
          <>
            <div className="max-h-[65vh] space-y-2 overflow-auto p-3">
              {currentGroups.map((group) => {
                const expandedNow = isExpanded(group.key);
                return (
                  <div key={group.key} className="overflow-hidden rounded-xl border border-gray-100">
                    <button
                      type="button"
                      onClick={() => toggleExpand(group.key)}
                      className="flex w-full items-center gap-3 bg-gray-50/70 px-4 py-3 text-left transition-colors hover:bg-gray-100"
                    >
                      <ChevronDown className={`h-4 w-4 flex-shrink-0 text-gray-400 transition-transform ${expandedNow ? '' : '-rotate-90'}`} />
                      <div className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full bg-indigo-600/10">
                        <UserRound className="h-4 w-4 text-indigo-600" />
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-baseline gap-x-2">
                          {operatorIdColumns.map((col) => (
                            <span key={col} className="text-sm font-semibold text-gray-900">
                              {String(group.identity[col] ?? '-')}
                            </span>
                          ))}
                        </div>
                      </div>
                      <span className="flex-shrink-0 rounded-full bg-indigo-50 px-2.5 py-1 text-[11px] font-bold text-indigo-700">
                        {group.rows.length} puesto{group.rows.length === 1 ? '' : 's'}
                      </span>
                    </button>

                    {expandedNow && (
                      <div className="overflow-x-auto border-t border-gray-100">
                        <table className="w-full border-collapse text-sm">
                          <thead className="bg-white">
                            <tr>
                              {detailColumns.map((col) => (
                                <th
                                  key={col}
                                  className="whitespace-nowrap border-b border-gray-100 px-4 py-2 text-left text-[11px] font-bold uppercase tracking-wide text-gray-500"
                                >
                                  {humanizeLabel(col)}
                                </th>
                              ))}
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-gray-50">
                            {group.rows.map((row, idx) => (
                              <tr key={idx} className="transition-colors hover:bg-indigo-50/40">
                                {detailColumns.map((col) => (
                                  <td key={`${idx}-${col}`} className="whitespace-nowrap px-4 py-2.5 text-gray-700">
                                    {typeof row[col] === 'object'
                                      ? JSON.stringify(row[col])
                                      : String(row[col] ?? '-')}
                                  </td>
                                ))}
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>

            {totalPages > 1 && (
              <div className="flex flex-col gap-3 border-t border-gray-100 px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
                <p className="text-xs text-gray-400">
                  Mostrando operadores {startIndex + 1}–{Math.min(endIndex, groups.length)} de {groups.length}
                </p>
                <div className="flex items-center gap-1">
                  <button onClick={() => goToPage(1)} disabled={currentPage === 1} className="rounded-md p-1.5 text-gray-500 transition-colors hover:bg-gray-100 disabled:cursor-not-allowed disabled:opacity-30">
                    <ChevronsLeft className="h-4 w-4" />
                  </button>
                  <button onClick={() => goToPage(currentPage - 1)} disabled={currentPage === 1} className="rounded-md p-1.5 text-gray-500 transition-colors hover:bg-gray-100 disabled:cursor-not-allowed disabled:opacity-30">
                    <ChevronLeft className="h-4 w-4" />
                  </button>
                  <div className="min-w-[90px] rounded-md bg-gray-50 px-3 py-1.5 text-center text-xs font-semibold text-gray-600">
                    Página {currentPage} de {totalPages}
                  </div>
                  <button onClick={() => goToPage(currentPage + 1)} disabled={currentPage === totalPages} className="rounded-md p-1.5 text-gray-500 transition-colors hover:bg-gray-100 disabled:cursor-not-allowed disabled:opacity-30">
                    <ChevronRight className="h-4 w-4" />
                  </button>
                  <button onClick={() => goToPage(totalPages)} disabled={currentPage === totalPages} className="rounded-md p-1.5 text-gray-500 transition-colors hover:bg-gray-100 disabled:cursor-not-allowed disabled:opacity-30">
                    <ChevronsRight className="h-4 w-4" />
                  </button>
                </div>
              </div>
            )}
          </>
        ) : (
          <div className="max-h-[65vh] overflow-auto">
            <table className="w-full border-collapse text-sm">
              <thead className="sticky top-0 z-10 bg-gray-50">
                <tr>
                  {columns.map((col) => (
                    <th
                      key={col}
                      className="whitespace-nowrap border-b border-gray-100 px-4 py-3 text-left text-[11px] font-bold uppercase tracking-wide text-gray-500"
                    >
                      {humanizeLabel(col)}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {filteredData.map((row, idx) => (
                  <tr key={idx} className="transition-colors hover:bg-indigo-50/40">
                    {columns.map((col) => (
                      <td key={`${idx}-${col}`} className="whitespace-nowrap px-4 py-2.5 text-gray-700">
                        {typeof row[col] === 'object'
                          ? JSON.stringify(row[col])
                          : String(row[col] ?? '-')}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
};
