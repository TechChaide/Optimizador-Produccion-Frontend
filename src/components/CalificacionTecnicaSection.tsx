'use client';

import React, { useState, useEffect } from 'react';
import { serviciosService } from '@/services/servicios.service';
import { Loader2 } from 'lucide-react';
import { useAppContext } from '@/context/AppProvider';

interface HabilidadOperador {
  [key: string]: any;
}

const ROWS_PER_PAGE = 20;

export const CalificacionTecnicaSection: React.FC = () => {
  const { addNotification } = useAppContext();
  const [habilidades, setHabilidades] = useState<HabilidadOperador[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);
  const [columns, setColumns] = useState<string[]>([]);

  useEffect(() => {
    fetchHabilidades();
  }, []);

  const fetchHabilidades = async () => {
    setIsLoading(true);
    try {
      const response = await serviciosService.getHabilidadesOperadorPorEstacion();
      if (response && response.data) {
        const dataArray = Array.isArray(response.data) ? response.data : [response.data];
        setHabilidades(dataArray);
        
        // Extraer columnas del primer registro
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

  const totalPages = Math.ceil(habilidades.length / ROWS_PER_PAGE);
  const startIndex = (currentPage - 1) * ROWS_PER_PAGE;
  const endIndex = startIndex + ROWS_PER_PAGE;
  const currentData = habilidades.slice(startIndex, endIndex);

  const goToPage = (page: number) => {
    setCurrentPage(Math.max(1, Math.min(page, totalPages)));
  };

  if (isLoading) {
    return (
      <div className="flex justify-center items-center h-64">
        <Loader2 className="w-8 h-8 animate-spin" />
      </div>
    );
  }

  return (
    <div className="bg-white rounded-lg shadow-lg p-6">
      <div className="flex justify-between items-center mb-6">
        <h2 className="text-2xl font-bold">Calificaciones Técnicas por Operador</h2>
        <button
          onClick={fetchHabilidades}
          className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 transition-colors"
          disabled={isLoading}
        >
          Actualizar
        </button>
      </div>

      {habilidades.length === 0 ? (
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
                {currentData.map((row, idx) => (
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
                Mostrando {startIndex + 1} a {Math.min(endIndex, habilidades.length)} de {habilidades.length} registros
              </div>

              <div className="flex gap-2 items-center">
                <button
                  onClick={() => goToPage(1)}
                  disabled={currentPage === 1}
                  className="px-3 py-2 border rounded disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-100"
                >
                  ← Primera
                </button>

                <button
                  onClick={() => goToPage(currentPage - 1)}
                  disabled={currentPage === 1}
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
                  />
                  <span className="text-sm">de {totalPages}</span>
                </div>

                <button
                  onClick={() => goToPage(currentPage + 1)}
                  disabled={currentPage === totalPages}
                  className="px-3 py-2 border rounded disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-100"
                >
                  Siguiente →
                </button>

                <button
                  onClick={() => goToPage(totalPages)}
                  disabled={currentPage === totalPages}
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
