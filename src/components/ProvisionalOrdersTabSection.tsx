'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { serviciosService } from '@/services/servicios.service';
import { useRuntimeInspector } from '@/services/RuntimeInspector';
import { logger } from '@/services/LogService';
import { useAppContext } from '@/context/AppProvider';
import { Package } from 'lucide-react';

interface ProvisionalOrder {
  ORDENPREVISIONAL: string;
  MATERIAL: string;
  NOMBRE: string;
  CATEGORIA: string;
  CANTIDAD: number;
  UNIDAD: string;
  FECHAINICIO: string;
  FECHAFIN: string;
  RESPCONTROLPROD: string;
  Centro: string;
  Almacen: string;
  Maquina: string | null;
  ClaseOrden: string;
  CodMaterial: string;
}

interface PaginationState {
  currentPage: number;
  totalRegistros: number;
  pageSize: number;
  isExploring: boolean;
  rowsPerPage: number;
}

export const ProvisionalOrdersTabSection: React.FC = () => {
  const inspector = useRuntimeInspector('ProvisionalOrdersTab');
  const { addNotification } = useAppContext();

  const [orders, setOrders] = useState<ProvisionalOrder[]>([]);
  const [pagination, setPagination] = useState<PaginationState>({
    currentPage: 1,
    totalRegistros: 0,
    pageSize: 1,
    isExploring: true,
    rowsPerPage: 20,
  });
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  // Initial exploration to know the total records
  useEffect(() => {
    const performExploration = async () => {
      try {
        setIsLoading(true);
        setError(null);
        logger.log('[ProvisionalOrdersTab] Iniciando exploración inicial con 1 fila...');
        
        const response = await serviciosService.OrdenesProvisionalesPaginados(1, 1);
        
        if (response.data && response.data.length > 0) {
          const total = response.totalRegistros || 0;
          logger.log(`[ProvisionalOrdersTab] Exploración completada. Total de registros: ${total}`);
          inspector.captureVariable('totalRegistros', total);
          
          setPagination(prev => ({
            ...prev,
            totalRegistros: total,
            pageSize: 20000,
            isExploring: false,
          }));

          addNotification('success', `Se encontraron ${total} órdenes previsionales. Cargando tabla...`);
          
          // Cargar la primera página después de la exploración
          setIsLoading(true);
          const pageResponse = await serviciosService.OrdenesProvisionalesPaginados(1, 20000);
          if (pageResponse.data) {
            setOrders(pageResponse.data);
            logger.log(`[ProvisionalOrdersTab] Primera página cargada con ${pageResponse.data.length} registros`);
          }
        } else {
          throw new Error('No se obtuvieron datos en la exploración');
        }
      } catch (err) {
        const errorMessage = (err as Error).message;
        logger.error(`[ProvisionalOrdersTab] Error en exploración: ${errorMessage}`);
        setError(errorMessage);
        addNotification('error', `Error al explorar órdenes: ${errorMessage}`);
      } finally {
        setIsLoading(false);
      }
    };

    performExploration();
  }, [addNotification]);

  // Load orders for current page
  const loadOrdersForPage = useCallback(async (page: number) => {
    try {
      setIsLoading(true);
      setError(null);
      logger.log(`[ProvisionalOrdersTab] Cargando página ${page} con ${pagination.pageSize} registros por página...`);

      const response = await serviciosService.OrdenesProvisionalesPaginados(page, pagination.pageSize);
      
      if (response.data) {
        setOrders(response.data);
        setPagination(prev => ({
          ...prev,
          currentPage: page,
        }));
        logger.log(`[ProvisionalOrdersTab] Página ${page} cargada con ${response.data.length} registros`);
        inspector.captureVariable('loadedOrders', response.data.length);
      } else {
        throw new Error('No se obtuvieron datos');
      }
    } catch (err) {
      const errorMessage = (err as Error).message;
      logger.error(`[ProvisionalOrdersTab] Error al cargar página: ${errorMessage}`);
      setError(errorMessage);
      addNotification('error', `Error al cargar órdenes: ${errorMessage}`);
    } finally {
      setIsLoading(false);
    }
  }, [pagination.pageSize, addNotification]);

  const totalPages = Math.ceil(pagination.totalRegistros / pagination.pageSize);
  const totalPagesLocal = Math.ceil(orders.length / pagination.rowsPerPage);
  
  const startIndex = (pagination.currentPage - 1) * pagination.rowsPerPage;
  const endIndex = startIndex + pagination.rowsPerPage;
  const displayedOrders = orders.slice(startIndex, endIndex);

  const handlePrevious = () => {
    if (pagination.currentPage > 1) {
      setPagination(prev => ({
        ...prev,
        currentPage: prev.currentPage - 1,
      }));
    }
  };

  const handleNext = () => {
    if (pagination.currentPage < totalPagesLocal) {
      setPagination(prev => ({
        ...prev,
        currentPage: prev.currentPage + 1,
      }));
    }
  };

  const handleLoadPage = (page: number) => {
    setPagination(prev => ({
      ...prev,
      currentPage: page,
    }));
  };

  const handleRowsPerPageChange = (newRowsPerPage: number) => {
    setPagination(prev => ({
      ...prev,
      rowsPerPage: newRowsPerPage,
      currentPage: 1,
    }));
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center space-x-3">
        <Package className="w-6 h-6 text-gray-700" />
        <h3 className="text-xl font-semibold text-gray-700">Datos de Órdenes Previsionales</h3>
      </div>

      {/* Info Card */}
      {pagination.totalRegistros > 0 && (
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
          <p className="text-sm text-blue-800">
            <span className="font-semibold">Total de registros:</span> {pagination.totalRegistros.toLocaleString()} | 
            <span className="font-semibold ml-4">Registros por página:</span> {pagination.pageSize.toLocaleString()} | 
            <span className="font-semibold ml-4">Total de páginas:</span> {totalPages}
          </p>
        </div>
      )}

      {/* Error Message */}
      {error && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-4">
          <p className="text-sm text-red-800">
            <span className="font-semibold">Error:</span> {error}
          </p>
        </div>
      )}

      {/* Loading State */}
      {isLoading && (
        <div className="flex justify-center items-center py-8">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-500"></div>
          <span className="ml-3 text-gray-600">Cargando...</span>
        </div>
      )}

      {/* Table */}
      {!isLoading && orders.length > 0 && (
        <div className="bg-white rounded-lg shadow-lg overflow-hidden">
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-100">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-700 uppercase tracking-wider">
                    Orden Previsional
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-700 uppercase tracking-wider">
                    Material
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-700 uppercase tracking-wider">
                    Nombre
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-700 uppercase tracking-wider">
                    Categoría
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-700 uppercase tracking-wider">
                    Cantidad
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-700 uppercase tracking-wider">
                    Unidad
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-700 uppercase tracking-wider">
                    Fecha Inicio
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-700 uppercase tracking-wider">
                    Fecha Fin
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-700 uppercase tracking-wider">
                    Centro
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-700 uppercase tracking-wider">
                    Almacén
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {displayedOrders.map((order, index) => (
                  <tr key={`${order.ORDENPREVISIONAL}-${index}`} className="hover:bg-gray-50">
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                      {order.ORDENPREVISIONAL}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600">
                      {order.MATERIAL}
                    </td>
                    <td className="px-6 py-4 text-sm text-gray-600 max-w-xs truncate">
                      {order.NOMBRE}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600">
                      {order.CATEGORIA}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-semibold text-gray-900">
                      {order.CANTIDAD}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600">
                      {order.UNIDAD}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600">
                      {order.FECHAINICIO}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600">
                      {order.FECHAFIN}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600">
                      {order.Centro}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600">
                      {order.Almacen}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Pagination Controls */}
      {!isLoading && orders.length > 0 && (
        <div className="flex items-center justify-between bg-white p-4 rounded-lg shadow-lg">
          <div className="flex items-center space-x-4">
            <label className="text-sm font-semibold text-gray-700">Filas por página:</label>
            <select
              value={pagination.rowsPerPage}
              onChange={(e) => handleRowsPerPageChange(Number(e.target.value))}
              className="px-3 py-2 border border-gray-300 rounded-md text-sm bg-white font-medium text-gray-700 hover:border-gray-400 focus:outline-none focus:ring-2 focus:ring-indigo-500"
            >
              <option value={5}>5</option>
              <option value={10}>10</option>
              <option value={20}>20</option>
              <option value={50}>50</option>
              <option value={100}>100</option>
            </select>
          </div>

          <div className="flex items-center space-x-4">
            <button
              onClick={handlePrevious}
              disabled={pagination.currentPage === 1 || isLoading}
              className="px-4 py-2 bg-indigo-600 text-white font-semibold rounded-md shadow-sm hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 disabled:bg-indigo-300 disabled:cursor-not-allowed"
            >
              ← Anterior
            </button>

            <div className="flex items-center space-x-2">
              <span className="text-sm text-gray-600">
                Página <span className="font-bold">{pagination.currentPage}</span> de <span className="font-bold">{totalPagesLocal}</span>
              </span>
              <div className="flex space-x-1 ml-4">
                {Array.from({ length: Math.min(5, totalPagesLocal) }, (_, i) => {
                  const page = i + 1;
                  return (
                    <button
                      key={page}
                      onClick={() => handleLoadPage(page)}
                      disabled={isLoading}
                      className={`px-3 py-1 rounded ${
                        pagination.currentPage === page
                          ? 'bg-indigo-600 text-white font-semibold'
                          : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
                      }`}
                    >
                      {page}
                    </button>
                  );
                })}
              </div>
            </div>

            <button
              onClick={handleNext}
              disabled={pagination.currentPage === totalPagesLocal || isLoading}
              className="px-4 py-2 bg-indigo-600 text-white font-semibold rounded-md shadow-sm hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 disabled:bg-indigo-300 disabled:cursor-not-allowed"
            >
              Siguiente →
            </button>
          </div>
        </div>
      )}

      {/* Empty State */}
      {!isLoading && orders.length === 0 && pagination.totalRegistros === 0 && (
        <div className="flex flex-col items-center justify-center py-12 text-gray-500 border-2 border-dashed rounded-lg">
          <Package className="w-12 h-12 mb-4 text-gray-300" />
          <p>No hay órdenes previsionales disponibles</p>
        </div>
      )}
    </div>
  );
};
