'use client';

import React, { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { serviciosService } from '@/services/servicios.service';
import { useRuntimeInspector } from '@/services/RuntimeInspector';
import { useAppContext } from '@/context/AppProvider';
import { UserCheck, Loader2, Search, Home, Database, UserPlus, AlertCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from '@/components/ui/badge';

interface HabilidadesOpTabSectionProps {
  groups: any[];
  restrictions: any[];
}

export const HabilidadesOpTabSection: React.FC<HabilidadesOpTabSectionProps> = ({ groups, restrictions }) => {
  const inspector = useRuntimeInspector('HabilidadesOpTab');
  const { addNotification } = useAppContext();
  const hasStarted = useRef(false);

  const [allRawData, setAllRawData] = useState<any[]>([]);
  const [columns, setColumns] = useState<string[]>([]);
  const [availableCenters, setAvailableCenters] = useState<string[]>([]);
  
  // UI States
  const [selectedTab, setSelectedTab] = useState<string>("raw_view");
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [searchTerm, setSearchTerm] = useState('');
  
  // Paginación
  const [currentPage, setCurrentPage] = useState(1);
  const [rowsPerPage, setRowsPerPage] = useState(20);

  const loadData = useCallback(async () => {
    setIsLoading(true);
    try {
      const response = await serviciosService.getCuboHabilidadesOP();
      const rawData = Array.isArray(response?.data) ? response.data : [];
      
      setAllRawData(rawData);
      
      if (rawData.length > 0) {
        setColumns(Object.keys(rawData[0]));
      }

      // Obtener centros de los grupos configurados
      const centersFromGroups = [...new Set(groups.map((g: any) => String(g.centro).trim()))].sort();
      setAvailableCenters(centersFromGroups);

      inspector.captureVariable('habilidades_raw_count', rawData.length);
      inspector.captureVariable('centers_available', centersFromGroups);
    } catch (err) {
      addNotification('error', `Error al cargar habilidades OP: ${(err as Error).message}`);
    } finally {
      setIsLoading(false);
    }
  }, [addNotification, inspector, groups]);

  useEffect(() => {
    if (!hasStarted.current) {
      hasStarted.current = true;
      loadData();
    }
  }, [loadData]);

  // Helper para parsear responsables (separados por , o &)
  const parseResponsables = (value: string): string[] => {
    if (!value) return [];
    return value.split(/[,&]/).map(v => v.trim()).filter(Boolean);
  };

  // Obtener responsables configurados para un centro
  const getResponsablesPorCentro = (centerId: string) => {
    const groupForCenter = groups.find(g => String(g.centro).trim() === centerId);
    if (!groupForCenter) return [];
    
    const restriction = restrictions.find(r => 
      r.codigo_grupo === groupForCenter.codigo_grupo && 
      r.nombre_restriccion === 'RespCtrlProd'
    );
    
    return parseResponsables(restriction?.valor_restriccion || '');
  };

  // AGRUPACIÓN Y FILTRADO POR CENTRO Y RESPONSABLE
  const filteredDataByCenter = useMemo(() => {
    const grouped: Record<string, any[]> = {};
    
    availableCenters.forEach(centerId => {
      // 1. Filtrar por Centro (buscando en campos comunes de la API)
      let centerData = allRawData.filter(row => {
        const rowCenter = String(row.CENTRO || row.Centro || row.centro || '').trim();
        return rowCenter === centerId;
      });

      // 2. Filtrar por Responsables configurados
      const allowedResps = getResponsablesPorCentro(centerId);
      if (allowedResps.length > 0) {
        centerData = centerData.filter(row => {
          const resp = String(row.RESPCTRLPROD || row.RespCtrlProd || '').trim();
          return allowedResps.includes(resp);
        });
      }

      grouped[centerId] = centerData;
    });

    return grouped;
  }, [allRawData, availableCenters, groups, restrictions]);

  // Filtro final de búsqueda
  const currentViewData = useMemo(() => {
    let base = selectedTab === "raw_view" 
      ? allRawData 
      : (filteredDataByCenter[selectedTab] || []);

    const term = searchTerm.toLowerCase().trim();
    if (!term) return base;

    return base.filter(row => 
      Object.values(row).some(val => 
        String(val || '').toLowerCase().includes(term)
      )
    );
  }, [allRawData, filteredDataByCenter, selectedTab, searchTerm]);

  const totalPagesLocal = Math.max(1, Math.ceil(currentViewData.length / rowsPerPage));
  const startIndex = (currentPage - 1) * rowsPerPage;
  const displayedData = currentViewData.slice(startIndex, startIndex + rowsPerPage);

  if (isLoading && allRawData.length === 0) {
    return (
      <div className="flex flex-col justify-center items-center py-20 bg-white rounded-lg border border-dashed">
        <Loader2 className="h-10 w-10 animate-spin text-indigo-500" />
        <span className="mt-4 text-gray-600 font-medium">Cargando habilidades...</span>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex items-center space-x-3">
          <UserCheck className="w-6 h-6 text-indigo-600" />
          <div>
            <h3 className="text-xl font-semibold text-gray-800">Cubo de Habilidades OP</h3>
            <p className="text-xs text-gray-500 mt-1">Calificaciones y Disponibilidad Segmentada por Centro</p>
          </div>
        </div>
        
        <div className="flex items-center gap-3">
          <div className="relative w-64">
            <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-gray-400" />
            <Input
              type="search"
              placeholder="Buscar operador, estación..."
              className="pl-9 h-9 text-xs"
              value={searchTerm}
              onChange={(e) => { setSearchTerm(e.target.value); setCurrentPage(1); }}
            />
          </div>
          <Button variant="outline" size="sm" onClick={() => { hasStarted.current = false; loadData(); }}>
            Actualizar
          </Button>
        </div>
      </div>

      <Tabs value={selectedTab} onValueChange={(val) => { setSelectedTab(val); setCurrentPage(1); }} className="w-full">
        <TabsList className="flex flex-wrap h-auto bg-gray-100/50 p-1 mb-4">
          <TabsTrigger 
            value="raw_view"
            className="data-[state=active]:bg-amber-100 data-[state=active]:text-amber-800 px-4 py-2 text-xs font-bold uppercase tracking-wider border-r border-gray-200"
          >
            <Database className="w-3 h-3 mr-2" />
            Vista Bruta ({allRawData.length})
          </TabsTrigger>
          
          {availableCenters.map(center => (
            <TabsTrigger 
              key={center} 
              value={center}
              className="data-[state=active]:bg-white data-[state=active]:text-indigo-700 data-[state=active]:shadow-sm px-4 py-2 text-xs font-bold uppercase tracking-wider"
            >
              <Home className="w-3 h-3 mr-2" />
              Centro {center} ({filteredDataByCenter[center]?.length || 0})
            </TabsTrigger>
          ))}
        </TabsList>

        {/* Panel informativo de Responsables Activos */}
        {selectedTab !== "raw_view" && (
          <div className="mb-4 px-4 py-3 bg-indigo-50 border border-indigo-100 rounded-lg flex items-center gap-3">
            <UserPlus className="w-5 h-5 text-indigo-600 shrink-0" />
            <div className="flex flex-wrap gap-2 items-center">
              <span className="text-xs font-bold text-indigo-800 uppercase tracking-tight">Responsables en Centro {selectedTab}:</span>
              {(() => {
                const resps = getResponsablesPorCentro(selectedTab);
                return resps.length > 0 ? (
                  resps.map(r => (
                    <Badge key={r} variant="secondary" className="bg-indigo-100 text-indigo-700 text-[10px] font-mono border-indigo-200">
                      {r}
                    </Badge>
                  ))
                ) : (
                  <span className="text-[10px] text-indigo-400 italic">Mostrando todos (Sin restricción RespCtrlProd)</span>
                );
              })()}
            </div>
          </div>
        )}

        <div className="bg-white rounded-lg shadow-sm border overflow-hidden">
          {/* Scroll Horizontal Superior */}
          <div className="overflow-x-auto" style={{ transform: 'rotateX(180deg)' }}>
            <div style={{ transform: 'rotateX(180deg)' }}>
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    {columns.map(col => (
                      <th 
                        key={col} 
                        className="px-4 py-3 text-left text-[10px] font-bold text-gray-500 uppercase tracking-wider whitespace-nowrap"
                      >
                        {col.replace(/_/g, ' ')}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200">
                  {displayedData.length > 0 ? displayedData.map((row, idx) => (
                    <tr key={idx} className="hover:bg-gray-50 transition-colors">
                      {columns.map(col => {
                        const val = row[col];
                        const isCalification = col.toLowerCase().includes('calificacion');
                        return (
                          <td key={col} className="px-4 py-3 whitespace-nowrap text-xs text-gray-600">
                            {typeof val === 'number' && isCalification ? (
                              <span className={`font-bold ${val === 100 ? 'text-green-600' : 'text-amber-600'}`}>
                                {val}%
                              </span>
                            ) : String(val ?? '-')}
                          </td>
                        );
                      })}
                    </tr>
                  )) : (
                    <tr>
                      <td colSpan={columns.length || 1} className="px-6 py-12 text-center text-gray-400 italic">
                        <div className="flex flex-col items-center justify-center gap-2">
                          <AlertCircle className="w-8 h-8 text-gray-300" />
                          <span>No se encontraron registros de habilidades para los filtros activos.</span>
                        </div>
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>

          {/* Footer / Paginación */}
          <div className="bg-gray-50 px-6 py-4 border-t flex flex-col sm:flex-row items-center justify-between gap-4">
            <div className="flex items-center gap-4 text-xs">
              <span className="font-medium text-gray-500 uppercase">Ver:</span>
              <select
                value={rowsPerPage}
                onChange={(e) => { setRowsPerPage(Number(e.target.value)); setCurrentPage(1); }}
                className="border rounded p-1 bg-white"
              >
                <option value={10}>10</option>
                <option value={20}>20</option>
                <option value={50}>50</option>
                <option value={100}>100</option>
              </select>
              <span className="text-gray-400">
                {startIndex + 1} - {Math.min(startIndex + rowsPerPage, currentViewData.length)} de {currentViewData.length}
              </span>
            </div>

            <div className="flex items-center gap-2">
              <Button 
                variant="outline" 
                size="sm" 
                onClick={() => setCurrentPage(p => Math.max(1, p - 1))} 
                disabled={currentPage === 1}
              >
                Anterior
              </Button>
              <div className="px-4 py-1 bg-white border rounded text-xs font-bold text-indigo-600 min-w-[80px] text-center">
                {currentPage} / {totalPagesLocal}
              </div>
              <Button 
                variant="outline" 
                size="sm" 
                onClick={() => setCurrentPage(p => Math.min(totalPagesLocal, p + 1))} 
                disabled={currentPage === totalPagesLocal}
              >
                Siguiente
              </Button>
            </div>
          </div>
        </div>
      </Tabs>
    </div>
  );
};
