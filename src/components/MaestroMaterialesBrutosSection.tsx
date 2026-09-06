'use client';

import React, { useState, useEffect } from 'react';
import { serviciosService } from '@/services/servicios.service';
import { Loader2, RefreshCw, Boxes, Inbox, ChevronsLeft, ChevronLeft, ChevronRight, ChevronsRight } from 'lucide-react';
import { useAppContext } from '@/context/AppProvider';
import { humanizeLabel } from '@/lib/utils';

interface MaterialBruto {
  [key: string]: any;
}

const ROWS_PER_PAGE = 20;
const BLOCK_SIZE = 5000; // Solicitar bloques de 5000 registros

export const MaestroMaterialesBrutosSection: React.FC = () => {
  const { addNotification } = useAppContext();
  const [allMateriales, setAllMateriales] = useState<MaterialBruto[]>([]); // Todos los datos cargados
  const [isLoading, setIsLoading] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);
  const [totalRecords, setTotalRecords] = useState(0);
  const [columns, setColumns] = useState<string[]>([]);
  const [loadedBlocks, setLoadedBlocks] = useState<Set<number>>(new Set()); // Track which blocks are loaded
  const [actualBlockSize, setActualBlockSize] = useState(BLOCK_SIZE); // Detect actual size returned by API

  // Fetch inicial para obtener el total y el primer bloque (página 1 del bloque)
  useEffect(() => {
    loadBlockByPage(1); // Página 1 = bloque página 1
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const loadBlockByPage = async (blockPage: number) => {
    // Check if already loaded
    if (loadedBlocks.has(blockPage)) return;

    setIsLoading(true);
    try {
      const response = await serviciosService.getMaterialesBrutosPorMaterialMateriaPrima(blockPage, BLOCK_SIZE);
      if (response && response.data) {
        const dataArray = Array.isArray(response.data) ? response.data : [response.data];
        const receivedCount = dataArray.length;

        // Solo obtener totalRecords una vez (en el primer fetch)
        if (blockPage === 1) {
          if (response.totalRegistros) {
            setTotalRecords(response.totalRegistros);
          } else if (response.totalRecords) {
            setTotalRecords(response.totalRecords);
          } else if (response.totalRows) {
            setTotalRecords(response.totalRows);
          } else {
            setTotalRecords(receivedCount || 0);
          }

          // Extraer columnas del primer registro
          if (dataArray.length > 0) {
            setColumns(Object.keys(dataArray[0]));
          }

          // Detectar el tamaño real que devuelve el API
          if (receivedCount > 0) {
            setActualBlockSize(receivedCount);
          }
        }

        // Agregar nuevos datos a los existentes
        setAllMateriales(prev => [...prev, ...dataArray]);

        // Mark this block as loaded
        setLoadedBlocks(prev => new Set([...prev, blockPage]));
      } else {
        if (blockPage === 1) {
          setAllMateriales([]);
          setTotalRecords(0);
          addNotification('warning', 'No se encontraron datos de materiales brutos');
        }
      }
    } catch (error) {
      addNotification('error', `Error al cargar materiales brutos: ${(error as Error).message}`);
      if (blockPage === 1) {
        setAllMateriales([]);
        setTotalRecords(0);
      }
    } finally {
      setIsLoading(false);
    }
  };

  const totalPages = Math.ceil(totalRecords / ROWS_PER_PAGE);

  // Obtener los datos a mostrar en la página actual
  const startIdx = (currentPage - 1) * ROWS_PER_PAGE;
  const endIdx = startIdx + ROWS_PER_PAGE;
  const displayedMateriales = allMateriales.slice(startIdx, endIdx);

  const goToPage = (page: number) => {
    const newPage = Math.max(1, Math.min(page, totalPages));
    setCurrentPage(newPage);

    // Calcular cuál bloque necesitamos basado en el tamaño real del API
    const requiredIdx = (newPage - 1) * ROWS_PER_PAGE + ROWS_PER_PAGE;

    // Si necesitamos datos que aún no hemos cargado, cargar el siguiente bloque
    if (requiredIdx > allMateriales.length && allMateriales.length < totalRecords) {
      // Calcular qué página de bloque necesitamos (basado en actualBlockSize)
      const blockPageNeeded = Math.ceil(requiredIdx / actualBlockSize);

      if (!loadedBlocks.has(blockPageNeeded)) {
        loadBlockByPage(blockPageNeeded);
      }
    }
  };

  const handleRefresh = () => {
    setAllMateriales([]);
    setLoadedBlocks(new Set());
    setCurrentPage(1);
    setActualBlockSize(BLOCK_SIZE);
    loadBlockByPage(1);
  };

  const isFirstLoad = isLoading && currentPage === 1 && allMateriales.length === 0;

  return (
    <div className="p-6 md:p-8 space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div className="flex items-center gap-3">
          <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-teal-600/10">
            <Boxes className="h-6 w-6 text-teal-600" />
          </div>
          <div>
            <h1 className="text-2xl font-bold tracking-tight text-gray-900">Maestro de Materiales Brutos</h1>
            <p className="text-sm text-gray-500">Catálogo completo de materiales y materias primas.</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {totalRecords > 0 && (
            <div className="hidden sm:flex items-center gap-1.5 rounded-full border border-teal-100 bg-teal-50 px-3 py-1.5 text-xs font-semibold text-teal-700">
              {totalRecords.toLocaleString()} materiales
            </div>
          )}
          <button
            onClick={handleRefresh}
            disabled={isLoading}
            className="inline-flex items-center gap-2 rounded-lg border border-gray-200 bg-white px-4 py-2 text-sm font-medium text-gray-700 shadow-sm transition-colors hover:bg-gray-50 disabled:opacity-50"
          >
            <RefreshCw className={`h-4 w-4 ${isLoading ? 'animate-spin' : ''}`} />
            Actualizar
          </button>
        </div>
      </div>

      <div className="rounded-2xl border border-gray-100 bg-white shadow-sm">
        {isFirstLoad ? (
          <div className="flex flex-col items-center justify-center gap-3 py-24 text-gray-400">
            <Loader2 className="h-8 w-8 animate-spin text-teal-500" />
            <span className="text-sm">Cargando materiales brutos...</span>
          </div>
        ) : displayedMateriales.length === 0 && allMateriales.length === 0 ? (
          <div className="flex flex-col items-center justify-center gap-2 py-24 text-gray-400">
            <Inbox className="h-10 w-10" />
            <p className="text-sm">No hay datos disponibles</p>
          </div>
        ) : (
          <>
            <div className="relative max-h-[65vh] overflow-auto">
              {isLoading && (
                <div className="sticky left-0 top-0 z-20 flex items-center gap-2 bg-teal-600 px-4 py-1.5 text-xs font-medium text-white">
                  <Loader2 className="h-3 w-3 animate-spin" />
                  Cargando más registros...
                </div>
              )}
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
                  {displayedMateriales.map((row, idx) => (
                    <tr key={idx} className="transition-colors hover:bg-teal-50/40">
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

            {totalPages > 1 && (
              <div className="flex flex-col gap-3 border-t border-gray-100 px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
                <div className="text-xs text-gray-400">
                  <p>Mostrando {startIdx + 1}–{Math.min(endIdx, totalRecords)} de {totalRecords.toLocaleString()} registros</p>
                  <p className="text-gray-300">{allMateriales.length.toLocaleString()} cargados en memoria</p>
                </div>
                <div className="flex items-center gap-1">
                  <button onClick={() => goToPage(1)} disabled={currentPage === 1 || isLoading} className="rounded-md p-1.5 text-gray-500 transition-colors hover:bg-gray-100 disabled:cursor-not-allowed disabled:opacity-30">
                    <ChevronsLeft className="h-4 w-4" />
                  </button>
                  <button onClick={() => goToPage(currentPage - 1)} disabled={currentPage === 1 || isLoading} className="rounded-md p-1.5 text-gray-500 transition-colors hover:bg-gray-100 disabled:cursor-not-allowed disabled:opacity-30">
                    <ChevronLeft className="h-4 w-4" />
                  </button>
                  <div className="min-w-[90px] rounded-md bg-gray-50 px-3 py-1.5 text-center text-xs font-semibold text-gray-600">
                    Página {currentPage} de {totalPages}
                  </div>
                  <button onClick={() => goToPage(currentPage + 1)} disabled={currentPage === totalPages || isLoading} className="rounded-md p-1.5 text-gray-500 transition-colors hover:bg-gray-100 disabled:cursor-not-allowed disabled:opacity-30">
                    <ChevronRight className="h-4 w-4" />
                  </button>
                  <button onClick={() => goToPage(totalPages)} disabled={currentPage === totalPages || isLoading} className="rounded-md p-1.5 text-gray-500 transition-colors hover:bg-gray-100 disabled:cursor-not-allowed disabled:opacity-30">
                    <ChevronsRight className="h-4 w-4" />
                  </button>
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
};
