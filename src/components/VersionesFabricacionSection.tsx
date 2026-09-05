'use client';

import React, { useState, useEffect } from 'react';
import { serviciosService } from '@/services/servicios.service';
import { Loader2 } from 'lucide-react';
import { useAppContext } from '@/context/AppProvider';

interface VersionFabricacion {
  [key: string]: any;
}

const ROWS_PER_PAGE = 20;

export const VersionesFabricacionSection: React.FC = () => {
  const { addNotification } = useAppContext();
  const [versiones, setVersiones] = useState<VersionFabricacion[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);
  const [totalRecords, setTotalRecords] = useState(0);
  const [columns, setColumns] = useState<string[]>([]);

  useEffect(() => {
    fetchVersiones(1);
  }, []);

  const fetchVersiones = async (page: number) => {
    setIsLoading(true);
    try {
      const response = await serviciosService.VersionesFabricacion(page, ROWS_PER_PAGE);
      if (response && response.data) {
        const dataArray = Array.isArray(response.data) ? response.data : [response.data];
        setVersiones(dataArray);
        
        // Si hay una propiedad con el total, úsala; sino estima basado en la data
        if (response.totalRegistros) {
          setTotalRecords(response.totalRegistros);
        } else if (response.totalRecords) {
          setTotalRecords(response.totalRecords);
        } else if (response.totalRows) {
          setTotalRecords(response.totalRows);
        } else {
          // Asumimos que si es menor que ROWS_PER_PAGE, es la última página
          setTotalRecords(
            dataArray.length < ROWS_PER_PAGE 
              ? (page - 1) * ROWS_PER_PAGE + dataArray.length
              : (page) * ROWS_PER_PAGE + 1
          );
        }
        
        // Extraer columnas del primer registro
        if (dataArray.length > 0) {
          setColumns(Object.keys(dataArray[0]));
        }
      } else {
        setVersiones([]);
        setTotalRecords(0);
        addNotification('warning', 'No se encontraron versiones de fabricación');
      }
    } catch (error) {
      addNotification('error', `Error al cargar versiones: ${(error as Error).message}`);
      setVersiones([]);
      setTotalRecords(0);
    } finally {
      setIsLoading(false);
    }
  };

  const totalPages = Math.ceil(totalRecords / ROWS_PER_PAGE);

  const goToPage = (page: number) => {
    const newPage = Math.max(1, Math.min(page, totalPages));
    setCurrentPage(newPage);
    fetchVersiones(newPage);
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
        <h2 className="text-2xl font-bold">Versiones de Fabricación de Materiales</h2>
        <button
          onClick={() => goToPage(currentPage)}
          className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 transition-colors"
          disabled={isLoading}
        >
          Actualizar
        </button>
      </div>

      {versiones.length === 0 ? (
        <div className="text-center py-8 text-gray-500">
          No hay versiones disponibles
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
                {versiones.map((row, idx) => (
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
                Página {currentPage} de {totalPages} ({totalRecords} registros totales)
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
