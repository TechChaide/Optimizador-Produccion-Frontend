'use client';

import React, { useState, useEffect } from 'react';
import { serviciosService } from '@/services/servicios.service';
import { Loader2 } from 'lucide-react';
import { useAppContext } from '@/context/AppProvider';

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
  }, []);

  const loadBlockByPage = async (blockPage: number) => {
    // Check if already loaded
    if (loadedBlocks.has(blockPage)) return;

    setIsLoading(true);
    try {
      const response = await serviciosService.getMMaterialesBrutosPorMaterialMateriaPrima(blockPage, BLOCK_SIZE);
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

  if (isLoading && currentPage === 1) {
    return (
      <div className="flex justify-center items-center h-64">
        <Loader2 className="w-8 h-8 animate-spin" />
      </div>
    );
  }

  return (
    <div className="bg-white rounded-lg shadow-lg p-6">
      <div className="flex justify-between items-center mb-6">
        <h2 className="text-2xl font-bold">Maestro de Materiales Brutos</h2>
        <button
          onClick={() => {
            setAllMateriales([]);
            setLoadedBlocks(new Set());
            setCurrentPage(1);
            setActualBlockSize(BLOCK_SIZE);
            loadBlockByPage(1);
          }}
          className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 transition-colors"
          disabled={isLoading}
        >
          Actualizar
        </button>
      </div>

      {displayedMateriales.length === 0 && allMateriales.length === 0 ? (
        <div className="text-center py-8 text-gray-500">
          No hay datos disponibles
        </div>
      ) : (
        <>
          <div className="overflow-x-auto border rounded-lg">
            <table className="w-full border-collapse">
              <thead>
                <tr className="bg-gray-100 border-b">
                  {columns.map((col) => (
                    <th
                      key={col}
                      className="px-4 py-3 text-left text-sm font-semibold text-gray-700 whitespace-nowrap"
                    >
                      {col}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {displayedMateriales.map((row, idx) => (
                  <tr key={idx} className="border-b hover:bg-gray-50 transition-colors">
                    {columns.map((col) => (
                      <td
                        key={`${idx}-${col}`}
                        className="px-4 py-3 text-sm text-gray-700"
                      >
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

          {/* Pagination Controls */}
          {totalPages > 1 && (
            <div className="flex justify-between items-center mt-6">
              <div className="text-sm text-gray-600">
                <div className="mb-2">
                  <strong>Mostrando:</strong> {startIdx + 1}-{Math.min(endIdx, totalRecords)} de {totalRecords} registros
                </div>
                <div className="text-xs text-gray-500">
                  ({ROWS_PER_PAGE} registros por página | Página {currentPage} de {totalPages} | {allMateriales.length} de {totalRecords} cargados en memoria)
                </div>
              </div>

              <div className="flex gap-2 items-center">
                <button
                  onClick={() => goToPage(1)}
                  disabled={currentPage === 1 || isLoading}
                  className="px-3 py-2 border rounded disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-100"
                >
                  ← Primera
                </button>

                <button
                  onClick={() => goToPage(currentPage - 1)}
                  disabled={currentPage === 1 || isLoading}
                  className="px-3 py-2 border rounded disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-100"
                >
                  ← Anterior
                </button>

                <div className="flex items-center gap-2">
                  <span className="text-sm">Página</span>
                  <input
                    type="number"
                    min={1}
                    max={totalPages}
                    value={currentPage}
                    onChange={(e) => goToPage(parseInt(e.target.value) || 1)}
                    className="w-16 px-2 py-1 border rounded text-center"
                    disabled={isLoading}
                  />
                  <span className="text-sm">de {totalPages}</span>
                </div>

                <button
                  onClick={() => goToPage(currentPage + 1)}
                  disabled={currentPage === totalPages || isLoading}
                  className="px-3 py-2 border rounded disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-100"
                >
                  Siguiente →
                </button>

                <button
                  onClick={() => goToPage(totalPages)}
                  disabled={currentPage === totalPages || isLoading}
                  className="px-3 py-2 border rounded disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-100"
                >
                  Última →
                </button>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
};
