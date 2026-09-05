'use client';

import React, { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { serviciosService } from '@/services/servicios.service';
import { grupoService } from '@/services/grupo.service';
import { restriccionService } from '@/services/restriccion.service';
import { useRuntimeInspector } from '@/services/RuntimeInspector';
import { useAppContext } from '@/context/AppProvider';
import { Package, Loader2, Home, Search, X, Filter, UserCheck, ChevronDown, ChevronRight } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import type { ProvisionalOrder } from '@/types/types';
import type { Grupo, Restriccion } from '@/types/interfaces';

// Mapeo de equivalencias Máquina -> Línea: la columna "Línea" se llena únicamente a partir de la
// Máquina de la orden (ya no por patrones en Categoría). Máquinas fuera de esta tabla no
// pertenecen a ninguna línea de armado y quedan sin Línea.
const MAQUINA_LINEA_MAP: Record<string, string> = {
  'HR-ARM01': 'LINEA 1',
  'HR-ARM02': 'LINEA 2',
  'HR-ARM03': 'LINEA 3',
  'HR-ARM05': 'LINEA 5',
  'HR-ARM21': 'LINEA 1',
  'HR-ARM22': 'LINEA 2',
  'HR-ARM25': 'LINEA 5',
};

export const ProvisionalOrdersTabSection: React.FC = () => {
  const inspector = useRuntimeInspector('ProvisionalOrdersTab');
  const { addNotification } = useAppContext();
  const hasStarted = useRef(false);

  // Estados de Datos
  const [orders, setOrders] = useState<ProvisionalOrder[]>([]);
  const [groups, setGroups] = useState<Grupo[]>([]);
  const [restricciones, setRestricciones] = useState<Restriccion[]>([]);
  const [availableCenters, setAvailableCenters] = useState<string[]>([]);
  const [selectedCenter, setSelectedCenter] = useState<string>("");
  
  // UI States
  const [searchTerm, setSearchTerm] = useState('');
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [currentPage, setCurrentPage] = useState(1);
  const [rowsPerPage, setRowsPerPage] = useState(20);
  const [expandedDates, setExpandedDates] = useState<Set<string>>(new Set());

  const toggleDate = (date: string) => {
    setExpandedDates(prev => {
      const next = new Set(prev);
      if (next.has(date)) next.delete(date);
      else next.add(date);
      return next;
    });
  };

  const normalizeMaterialCode = (code: string | number): string => {
    return String(code || '').trim().slice(-8);
  };

  const loadData = useCallback(async () => {
    setIsLoading(true);
    
    try {
      const [groupsRes, restRes, pageResponse] = await Promise.all([
        grupoService.getAll(),
        restriccionService.getAll(),
        serviciosService.OrdenesProvisionalesPaginados(1, 10000)
      ]);

      // 1. Procesar Grupos y Centros
      const groupsData = Array.isArray(groupsRes?.data) ? groupsRes.data : [];
      setGroups(groupsData);
      
      const centersFromGroups = [...new Set(groupsData.map((g: any) => String(g.centro).trim()))].sort();
      setAvailableCenters(centersFromGroups);

      // 2. Procesar Restricciones
      setRestricciones(Array.isArray(restRes?.data) ? restRes.data : []);

      // 3. Procesar Órdenes
      if (pageResponse && pageResponse.data) {
        const rawOrders = Array.isArray(pageResponse.data) ? pageResponse.data : [];
        
        // Mapeo de LINEA según la Máquina de la orden (tabla de equivalencias)
        const mappedOrders = rawOrders.map((o: any) => {
          const maquina = String(o.Maquina || o.MAQUINA || o.maquina || '').trim().toUpperCase();
          const calculatedLinea = MAQUINA_LINEA_MAP[maquina] || '';

          return {
            ...o,
            LINEA: calculatedLinea
          };
        });

        setOrders(mappedOrders);
      }
      
      if (centersFromGroups.length > 0 && !selectedCenter) {
        setSelectedCenter(centersFromGroups[0]);
      }

      inspector.captureVariable('orders_loaded_count', orders.length);
      inspector.captureVariable('restricciones_loaded_count', restricciones.length);

    } catch (err) {
      addNotification('error', `Error al cargar datos previsionales: ${(err as Error).message}`);
    } finally {
      setIsLoading(false);
    }
  }, [addNotification, selectedCenter, inspector, orders.length, restricciones.length]);

  useEffect(() => {
    if (!hasStarted.current) {
      hasStarted.current = true;
      loadData();
    }
  }, [loadData]);

  // Obtener códigos de RespCtrlProd permitidos para el centro seleccionado
  const allowedResponsables = useMemo(() => {
    if (!selectedCenter || !restricciones.length || !groups.length) return [];
    
    // Buscar el grupo de "Ensamblado" para este centro
    const centerGroup = groups.find(g => 
      String(g.centro).trim() === selectedCenter && 
      g.nombre_grupo.toLowerCase().includes('ensamblado')
    );

    if (!centerGroup) return [];

    // Buscar restricción RespCtrlProd para ese grupo
    const restriction = restricciones.find(r => 
      r.codigo_grupo === centerGroup.codigo_grupo && 
      r.nombre_restriccion === 'RespCtrlProd'
    );

    if (!restriction) return [];

    // El valor suele ser "003" o "003, 004, 006"
    return restriction.valor_restriccion
      .split(/[,&]/)
      .map(v => v.trim())
      .filter(Boolean);
  }, [selectedCenter, restricciones, groups]);

  const currentCenterOrders = useMemo(() => {
    const term = searchTerm.toLowerCase().trim();
    
    return orders.filter(order => {
      // FILTRO 1: Centro seleccionado
      if (String(order.Centro || '').trim() !== selectedCenter) return false;

      // FILTRO 2: RespCtrlProd (Restricción técnica)
      if (allowedResponsables.length > 0) {
        const orderResp = String(order.RESPCONTROLPROD || '').trim();
        if (!allowedResponsables.includes(orderResp)) return false;
      }

      // FILTRO 3: Búsqueda por texto
      if (term) {
        return (
          String(order.ORDENPREVISIONAL || '').toLowerCase().includes(term) ||
          String(order.CodMaterial || order.MATERIAL || '').toLowerCase().includes(term) ||
          String(order.NOMBRE || '').toLowerCase().includes(term) ||
          String(order.CATEGORIA || '').toLowerCase().includes(term) ||
          String(order.LINEA || '').toLowerCase().includes(term)
        );
      }
      return true;
    });
  }, [orders, searchTerm, selectedCenter, allowedResponsables]);

  const summaryByDateLine = useMemo(() => {
    const map = new Map<string, Map<string, number>>();
    const linesSet = new Set<string>();

    currentCenterOrders.forEach(order => {
      const date = String(order.FECHAINICIO || '').trim() || 'Sin Fecha';
      const line = String(order.LINEA || '').trim() || 'Sin Línea';
      const qty = Number(order.CANTIDAD) || 0;

      linesSet.add(line);
      if (!map.has(date)) map.set(date, new Map());
      const lineMap = map.get(date)!;
      lineMap.set(line, (lineMap.get(line) || 0) + qty);
    });

    const dates = Array.from(map.keys()).sort();
    const lines = Array.from(linesSet).sort();

    return { map, dates, lines };
  }, [currentCenterOrders]);

  const ordersByDate = useMemo(() => {
    const map = new Map<string, typeof currentCenterOrders>();
    currentCenterOrders.forEach(order => {
      const date = String(order.FECHAINICIO || '').trim() || 'Sin Fecha';
      if (!map.has(date)) map.set(date, []);
      map.get(date)!.push(order);
    });
    return map;
  }, [currentCenterOrders]);

  const totalPagesLocal = Math.max(1, Math.ceil(currentCenterOrders.length / rowsPerPage));
  const startIndex = (currentPage - 1) * rowsPerPage;
  const endIndex = startIndex + rowsPerPage;
  const displayedOrders = currentCenterOrders.slice(startIndex, endIndex);

  const formatMaterial = (mat: string) => String(mat || '').replace(/^0+/, '');

  if (isLoading && orders.length === 0) {
    return (
      <div className="flex flex-col justify-center items-center py-20 bg-white rounded-lg border border-dashed">
        <Loader2 className="h-10 w-10 animate-spin text-indigo-500" />
        <span className="mt-4 text-gray-600 font-medium">Cargando órdenes previsionales y restricciones...</span>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex items-center space-x-3">
          <Package className="w-6 h-6 text-indigo-600" />
          <div>
            <h3 className="text-xl font-semibold text-gray-700">Órdenes Previsionales</h3>
            <p className="text-xs text-gray-500">Filtradas por responsabilidad técnica (RespCtrlProd)</p>
          </div>
        </div>
        
        <div className="flex items-center gap-3">
          <div className="relative w-64">
            <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-gray-400" />
            <Input
              type="search"
              placeholder="Buscar..."
              className="pl-9 h-9 text-xs"
              value={searchTerm}
              onChange={(e) => { setSearchTerm(e.target.value); setCurrentPage(1); }}
            />
            {searchTerm && (
              <button 
                onClick={() => setSearchTerm('')}
                className="absolute right-2.5 top-2.5 text-gray-400 hover:text-gray-600"
              >
                <X className="w-4 h-4" />
              </button>
            )}
          </div>
          <Button variant="outline" size="sm" onClick={() => { hasStarted.current = false; setOrders([]); loadData(); }}>
            Actualizar
          </Button>
        </div>
      </div>

      <Tabs value={selectedCenter} onValueChange={(val) => { setSelectedCenter(val); setCurrentPage(1); }} className="w-full">
        <TabsList className="flex h-auto bg-gray-100/50 p-1 mb-4">
          {availableCenters.map(center => (
            <TabsTrigger 
              key={center} 
              value={center}
              className="data-[state=active]:bg-white data-[state=active]:text-indigo-700 data-[state=active]:shadow-sm px-6 py-2 text-xs font-bold uppercase tracking-wider"
            >
              <Home className="w-3 h-3 mr-2" />
              Centro {center}
            </TabsTrigger>
          ))}
        </TabsList>

        {/* --- Resumen de Cantidades por Fecha y Línea --- */}
        {summaryByDateLine.dates.length > 0 && (
          <div className="bg-white rounded-lg shadow-sm border overflow-hidden mb-4">
            <div className="px-4 py-2 bg-indigo-50/60 border-b flex items-center gap-2">
              <Package className="w-3.5 h-3.5 text-indigo-600" />
              <span className="text-[11px] font-bold text-indigo-700 uppercase tracking-wider">
                Resumen de Cantidades por Fecha y Línea
              </span>
            </div>
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-4 py-2 text-left text-[10px] font-bold text-gray-500 uppercase tracking-wider w-8"></th>
                    <th className="px-4 py-2 text-left text-[10px] font-bold text-gray-500 uppercase tracking-wider">Fecha</th>
                    {summaryByDateLine.lines.map(line => (
                      <th key={line} className="px-4 py-2 text-right text-[10px] font-bold text-indigo-700 uppercase tracking-wider">
                        {line}
                      </th>
                    ))}
                    <th className="px-4 py-2 text-right text-[10px] font-bold text-gray-700 uppercase tracking-wider bg-gray-100">Total</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {summaryByDateLine.dates.map(date => {
                    const lineMap = summaryByDateLine.map.get(date)!;
                    const rowTotal = summaryByDateLine.lines.reduce((sum, line) => sum + (lineMap.get(line) || 0), 0);
                    const isExpanded = expandedDates.has(date);
                    const dateOrders = ordersByDate.get(date) || [];
                    return (
                      <React.Fragment key={date}>
                        <tr
                          className="hover:bg-gray-50 transition-colors cursor-pointer"
                          onClick={() => toggleDate(date)}
                        >
                          <td className="px-4 py-2 whitespace-nowrap text-gray-400">
                            {isExpanded ? <ChevronDown className="w-3.5 h-3.5" /> : <ChevronRight className="w-3.5 h-3.5" />}
                          </td>
                          <td className="px-4 py-2 whitespace-nowrap text-xs font-medium text-gray-600">{date}</td>
                          {summaryByDateLine.lines.map(line => {
                            const qty = lineMap.get(line) || 0;
                            return (
                              <td key={line} className="px-4 py-2 whitespace-nowrap text-xs text-right text-gray-600 font-mono">
                                {qty > 0 ? qty.toLocaleString() : '-'}
                              </td>
                            );
                          })}
                          <td className="px-4 py-2 whitespace-nowrap text-xs text-right font-bold text-indigo-700 bg-gray-50 font-mono">
                            {rowTotal.toLocaleString()}
                          </td>
                        </tr>
                        {isExpanded && (
                          <tr className="bg-slate-50/70">
                            <td colSpan={summaryByDateLine.lines.length + 3} className="px-4 py-3">
                              <div className="border rounded-md overflow-hidden bg-white">
                                <table className="min-w-full divide-y divide-gray-200">
                                  <thead className="bg-gray-50">
                                    <tr>
                                      <th className="px-3 py-1.5 text-left text-[9px] font-bold text-gray-500 uppercase tracking-wider">Orden</th>
                                      <th className="px-3 py-1.5 text-left text-[9px] font-bold text-gray-500 uppercase tracking-wider">Categoría</th>
                                      <th className="px-3 py-1.5 text-left text-[9px] font-bold text-indigo-700 uppercase tracking-wider">Línea</th>
                                      <th className="px-3 py-1.5 text-left text-[9px] font-bold text-gray-500 uppercase tracking-wider">Material</th>
                                      <th className="px-3 py-1.5 text-left text-[9px] font-bold text-gray-500 uppercase tracking-wider">Nombre</th>
                                      <th className="px-3 py-1.5 text-right text-[9px] font-bold text-gray-500 uppercase tracking-wider">Cantidad</th>
                                      <th className="px-3 py-1.5 text-center text-[9px] font-bold text-indigo-700 uppercase tracking-wider">Resp. Ctrl.</th>
                                    </tr>
                                  </thead>
                                  <tbody className="divide-y divide-gray-100">
                                    {dateOrders.map((order, idx) => (
                                      <tr key={`${order.ORDENPREVISIONAL}-${idx}`} className="hover:bg-gray-50">
                                        <td className="px-3 py-1.5 whitespace-nowrap text-xs font-bold text-indigo-600 font-mono">{order.ORDENPREVISIONAL}</td>
                                        <td className="px-3 py-1.5 whitespace-nowrap text-xs text-gray-600">{order.CATEGORIA || '-'}</td>
                                        <td className="px-3 py-1.5 whitespace-nowrap text-[10px] font-bold text-indigo-700">{order.LINEA || '-'}</td>
                                        <td className="px-3 py-1.5 whitespace-nowrap text-xs font-mono text-gray-600">{formatMaterial(order.CodMaterial || order.MATERIAL)}</td>
                                        <td className="px-3 py-1.5 text-xs text-gray-600 max-w-xs truncate" title={order.NOMBRE}>{order.NOMBRE}</td>
                                        <td className="px-3 py-1.5 whitespace-nowrap text-xs font-bold text-right text-indigo-600">{(Number(order.CANTIDAD) || 0).toLocaleString()}</td>
                                        <td className="px-3 py-1.5 whitespace-nowrap text-xs text-center font-bold text-indigo-700">{order.RESPCONTROLPROD}</td>
                                      </tr>
                                    ))}
                                  </tbody>
                                </table>
                              </div>
                            </td>
                          </tr>
                        )}
                      </React.Fragment>
                    );
                  })}
                  <tr className="bg-indigo-50/40 border-t-2 border-indigo-100">
                    <td className="px-4 py-2"></td>
                    <td className="px-4 py-2 whitespace-nowrap text-xs font-bold text-gray-700 uppercase">Total</td>
                    {summaryByDateLine.lines.map(line => {
                      const colTotal = summaryByDateLine.dates.reduce(
                        (sum, date) => sum + (summaryByDateLine.map.get(date)!.get(line) || 0),
                        0
                      );
                      return (
                        <td key={line} className="px-4 py-2 whitespace-nowrap text-xs text-right font-bold text-indigo-700 font-mono">
                          {colTotal.toLocaleString()}
                        </td>
                      );
                    })}
                    <td className="px-4 py-2 whitespace-nowrap text-xs text-right font-bold text-indigo-800 bg-indigo-100/60 font-mono">
                      {summaryByDateLine.dates.reduce((sum, date) => {
                        const lineMap = summaryByDateLine.map.get(date)!;
                        return sum + summaryByDateLine.lines.reduce((s, line) => s + (lineMap.get(line) || 0), 0);
                      }, 0).toLocaleString()}
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* --- Sección de Filtros Activos e Información de Restricciones --- */}
        <div className="flex flex-wrap gap-2 items-center mb-4 px-1">
          <div className="flex items-center gap-2 mr-4">
            <span className="text-[10px] font-bold text-gray-400 uppercase flex items-center gap-1">
              <Filter className="w-3 h-3" /> Centro Activo:
            </span>
            <Badge variant="secondary" className="bg-indigo-50 text-indigo-700 text-[10px] border-indigo-100 font-bold">
              {selectedCenter}
            </Badge>
          </div>

          <div className="flex items-center gap-2 mr-4">
            <span className="text-[10px] font-bold text-gray-400 uppercase flex items-center gap-1">
              <UserCheck className="w-3 h-3 text-emerald-500" /> Resp. Permitidos:
            </span>
            {allowedResponsables.length > 0 ? (
              allowedResponsables.map(resp => (
                <Badge key={resp} variant="outline" className="bg-emerald-50 text-emerald-700 text-[10px] border-emerald-200 font-mono">
                  {resp}
                </Badge>
              ))
            ) : (
              <span className="text-[10px] text-amber-600 italic">No hay restricción RespCtrlProd definida</span>
            )}
          </div>

          <span className="text-[10px] text-gray-400 ml-auto">
            Mostrando <b>{currentCenterOrders.length}</b> órdenes para colchones.
          </span>
        </div>

        <div className="bg-white rounded-lg shadow-sm border overflow-hidden">
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-[10px] font-bold text-gray-500 uppercase tracking-wider">Orden</th>
                  <th className="px-6 py-3 text-left text-[10px] font-bold text-gray-500 uppercase tracking-wider">Categoría</th>
                  <th className="px-6 py-3 text-left text-[10px] font-bold text-indigo-700 uppercase tracking-wider bg-indigo-50/30">LÍNEA</th>
                  <th className="px-6 py-3 text-left text-[10px] font-bold text-gray-500 uppercase tracking-wider">Material</th>
                  <th className="px-6 py-3 text-left text-[10px] font-bold text-gray-500 uppercase tracking-wider">Nombre</th>
                  <th className="px-6 py-3 text-right text-[10px] font-bold text-gray-500 uppercase tracking-wider">Cantidad</th>
                  <th className="px-6 py-3 text-left text-[10px] font-bold text-gray-500 uppercase tracking-wider">Pedido Ventas</th>
                  <th className="px-6 py-3 text-left text-[10px] font-bold text-gray-500 uppercase tracking-wider">Posición Pedido</th>
                  <th className="px-6 py-3 text-center text-[10px] font-bold text-indigo-700 uppercase tracking-wider bg-indigo-50/30">Resp. Ctrl.</th>
                  <th className="px-6 py-3 text-left text-[10px] font-bold text-gray-500 uppercase tracking-wider">Almacén</th>
                  <th className="px-6 py-3 text-left text-[10px] font-bold text-gray-500 uppercase tracking-wider">F. Inicio</th>
                  <th className="px-6 py-3 text-left text-[10px] font-bold text-gray-500 uppercase tracking-wider">Máquina</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {displayedOrders.length > 0 ? displayedOrders.map((order, idx) => (
                  <tr key={`${order.ORDENPREVISIONAL}-${idx}`} className="hover:bg-gray-50 transition-colors">
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-bold text-indigo-600 font-mono">{order.ORDENPREVISIONAL}</td>
                    <td className="px-6 py-4 whitespace-nowrap text-xs text-gray-600 font-medium">{order.CATEGORIA || '-'}</td>
                    <td className="px-6 py-4 whitespace-nowrap text-[10px] font-bold text-indigo-700 bg-indigo-50/10">{order.LINEA || '-'}</td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-mono text-gray-600">{formatMaterial(order.CodMaterial || order.MATERIAL)}</td>
                    <td className="px-6 py-4 text-sm text-gray-600 max-w-xs truncate" title={order.NOMBRE}>{order.NOMBRE}</td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-bold text-right text-indigo-600">{(Number(order.CANTIDAD) || 0).toLocaleString()}</td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600 font-mono">{order.Pedidoventas || order.PEDIDOVENTAS || '-'}</td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600 font-mono">{order.POSICIONPEDIDO || order.PosicionPedido || '-'}</td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-center font-bold text-indigo-700 bg-indigo-50/10">{order.RESPCONTROLPROD}</td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600">{order.Almacen}</td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600">{order.FECHAINICIO}</td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600 font-mono text-xs">{order.Maquina || '-'}</td>
                  </tr>
                )) : (
                  <tr>
                    <td colSpan={12} className="px-6 py-12 text-center text-gray-400 italic">
                      No se encontraron órdenes para el centro {selectedCenter} que cumplan con la restricción RespCtrlProd.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>

        <div className="bg-gray-50 px-6 py-4 border-t flex items-center justify-between">
          <div className="flex items-center gap-4">
            <span className="text-xs font-medium text-gray-500 uppercase">Ver:</span>
            <select
              value={rowsPerPage}
              onChange={(e) => { setRowsPerPage(Number(e.target.value)); setCurrentPage(1); }}
              className="text-sm border rounded p-1 bg-white"
            >
              <option value={10}>10</option>
              <option value={20}>20</option>
              <option value={50}>50</option>
            </select>
            <span className="text-xs text-gray-400 font-medium">
              Viendo {startIndex + 1} - {Math.min(endIndex, currentCenterOrders.length)} de {currentCenterOrders.length}
            </span>
          </div>

          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" onClick={() => setCurrentPage(p => Math.max(1, p - 1))} disabled={currentPage === 1}> Anterior </Button>
            <div className="px-4 py-1 bg-white border rounded text-sm font-bold text-indigo-600 min-w-[80px] text-center"> {currentPage} / {totalPagesLocal} </div>
            <Button variant="outline" size="sm" onClick={() => setCurrentPage(p => Math.min(totalPagesLocal, p + 1))} disabled={currentPage === totalPagesLocal}> Siguiente </Button>
          </div>
        </div>
      </Tabs>
    </div>
  );
};
