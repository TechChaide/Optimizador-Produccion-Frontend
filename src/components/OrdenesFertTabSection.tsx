'use client';

import React, { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { serviciosService } from '@/services/servicios.service';
import { grupoService } from '@/services/grupo.service';
import { restriccionService } from '@/services/restriccion.service';
import { useRuntimeInspector } from '@/services/RuntimeInspector';
import { useAppContext } from '@/context/AppProvider';
import { operationTracker } from '@/services/OperationTracker';
import { ClipboardList, Loader2, Search, Home, Database, LayoutGrid, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

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

interface OrdenFert {
  CENTRO: string;
  ORDEN: string;
  MATERIAL: string;
  SECTORDESC: string;
  CATEGORIA: string;
  LINEA?: string;
  NOMBRE: string;
  CANTPROGRAMADA: number;
  CANTENTREGADA: number;
  CANTNOTIFICADA: number;
  CANTRECHAZO: number;
  CANTPENDIENTE: number;
  UNIDAD: string;
  FECHA: string;
  ANIO: number;
  MES: number;
  DIA: number;
  SEMANA: number;
  RESPCTRLPROD: string;
  PRIORIDAD: number;
  ENLINEA: number;
  MAQUINA: string;
  PEDIDO: string;
  POSICION: string;
  CANTPROGPESONETO: number;
  SECTOR?: string;
  ETIQUETA?: string;
  [key: string]: any;
}

export const OrdenesFertTabSection: React.FC = () => {
  const inspector = useRuntimeInspector('OrdenesFertTab');
  const { addNotification } = useAppContext();
  const hasStarted = useRef(false);

  // Estados de Datos
  const [allRawOrders, setAllRawOrders] = useState<OrdenFert[]>([]);
  const [availableCenters, setAvailableCenters] = useState<string[]>([]);
  const [groups, setGroups] = useState<any[]>([]);
  const [restrictions, setRestrictions] = useState<any[]>([]);
  
  // Estados de UI
  const [selectedTab, setSelectedTab] = useState<string>("raw_view");
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedSector, setSelectedSector] = useState<string>("ALL");

  // Paginación
  const [currentPage, setCurrentPage] = useState(1);
  const [rowsPerPage, setRowsPerPage] = useState(20);

  const safeNum = (v: any): number => {
    if (v === null || v === undefined) return 0;
    const n = typeof v === 'string' ? parseFloat(v.replace(/,/g, '').trim()) : Number(v);
    return isNaN(n) ? 0 : n;
  };

  const loadData = useCallback(async () => {
    const opId = operationTracker.startOperation('FertOrders', 'data_load', 'Cargando Órdenes FERT');
    setIsLoading(true);
    
    try {
      const groupsRes = await grupoService.getAll();
      const groupsData = Array.isArray(groupsRes?.data) ? groupsRes.data : [];
      setGroups(groupsData);
      
      const centersFromGroups = [...new Set(groupsData.map((g: any) => String(g.centro).trim()))].sort();
      setAvailableCenters(centersFromGroups);

      operationTracker.updateOperation(opId, 'running', 'Recuperando órdenes FERT...');
      const firstPageRes = await serviciosService.getOrdenesFert(1, 10000);
      const rawData: any[] = Array.isArray(firstPageRes?.data) ? firstPageRes.data : [];
      
      let orders: OrdenFert[] = rawData.map(o => {
        const cat = String(o.CATEGORIA || o.Categoria || '').toUpperCase();
        const maquina = String(o.MAQUINA || o.Maquina || o.maquina || '').trim().toUpperCase();
        // Lógica de llenado de columna LINEA según la Máquina de la orden (tabla de equivalencias)
        const calculatedLinea = MAQUINA_LINEA_MAP[maquina] || '';

        return {
          ...o,
          SECTOR: (o.SECTOR || o.Sector || o.sector || o.SECTORDESC || '').trim().toUpperCase(),
          ETIQUETA: (o.ETIQUETA || o.Etiqueta || o.etiqueta || '').trim(),
          CATEGORIA: cat,
          LINEA: calculatedLinea
        };
      }).filter(o => {
        const s = String(o.SECTOR).trim().toUpperCase();
        return s === "01 COLCHONES" || s === "02 BASES";
      });

      setAllRawOrders(orders);

      const restRes = await restriccionService.getAll();
      setRestrictions(restRes?.data || []);

      operationTracker.completeOperation(opId, `Finalizado: ${orders.length} órdenes.`);
      inspector.captureVariable('fert_total_loaded', orders.length);

    } catch (err) {
      const msg = (err as Error).message;
      operationTracker.failOperation(opId, msg);
      addNotification('error', `Error en carga de datos: ${msg}`);
    } finally {
      setIsLoading(false);
    }
  }, [addNotification, inspector]);

  useEffect(() => {
    if (!hasStarted.current) {
      hasStarted.current = true;
      loadData();
    }
  }, [loadData]);

  const getResponsablesPorCentro = (centerId: string) => {
    const group = groups.find(g => String(g.centro).trim() === centerId);
    if (!group) return [];
    const rest = restrictions.find(r => r.codigo_grupo === group.codigo_grupo && r.nombre_restriccion === 'RespCtrlProd');
    if (!rest) return [];
    return rest.valor_restriccion.split(/[,&]/).map((v: string) => v.trim()).filter(Boolean);
  };

  const filteredDataByCenter = useMemo(() => {
    const grouped: Record<string, OrdenFert[]> = {};
    availableCenters.forEach(centerId => {
      let centerOrders = allRawOrders.filter(o => String(o.CENTRO || '').trim() === centerId);
      const allowedResps = getResponsablesPorCentro(centerId);
      if (allowedResps.length > 0) {
        centerOrders = centerOrders.filter(o => allowedResps.includes(String(o.RESPCTRLPROD).trim()));
      }
      grouped[centerId] = centerOrders;
    });
    return grouped;
  }, [allRawOrders, availableCenters, groups, restrictions]);

  const currentViewOrders = useMemo(() => {
    const base = selectedTab === "raw_view" ? allRawOrders : (filteredDataByCenter[selectedTab] || []);
    const term = searchTerm.toLowerCase().trim();
    
    return base.filter(o => {
      if (selectedSector !== "ALL" && String(o.SECTOR || '').trim().toUpperCase() !== selectedSector) return false;
      if (term) {
        return [o.ORDEN, o.MATERIAL, o.NOMBRE, o.PEDIDO, o.POSICION, o.SECTOR, o.ETIQUETA, o.CATEGORIA, o.LINEA].some(v => String(v || '').toLowerCase().includes(term));
      }
      return true;
    });
  }, [allRawOrders, filteredDataByCenter, selectedTab, searchTerm, selectedSector]);

  const totals = useMemo(() => {
    return currentViewOrders.reduce((acc, o) => {
      acc.prog += safeNum(o.CANTPROGRAMADA);
      acc.entreg += safeNum(o.CANTENTREGADA);
      acc.pend += safeNum(o.CANTPENDIENTE);
      return acc;
    }, { prog: 0, entreg: 0, pend: 0 });
  }, [currentViewOrders]);

  // Resumen de Cant Pendiente por Fecha y Línea, solo para las sub-pestañas de Centro (no aplica a
  // "Vista Bruta", que mezcla ambos centros).
  const summaryByDateLine = useMemo(() => {
    const map = new Map<string, Map<string, number>>();
    const linesSet = new Set<string>();

    currentViewOrders.forEach(o => {
      const date = String(o.FECHA || '').trim() || 'Sin Fecha';
      const line = String(o.LINEA || '').trim() || 'Sin Línea';
      const qty = safeNum(o.CANTPENDIENTE);

      linesSet.add(line);
      if (!map.has(date)) map.set(date, new Map());
      const lineMap = map.get(date)!;
      lineMap.set(line, (lineMap.get(line) || 0) + qty);
    });

    const dates = Array.from(map.keys()).sort();
    const lines = Array.from(linesSet).sort();

    return { map, dates, lines };
  }, [currentViewOrders]);

  const startIndex = (currentPage - 1) * rowsPerPage;
  const endIndex = startIndex + rowsPerPage;
  const totalPagesLocal = Math.max(1, Math.ceil(currentViewOrders.length / rowsPerPage));
  const displayedOrders = currentViewOrders.slice(startIndex, endIndex);

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex items-center space-x-3">
          <ClipboardList className="w-6 h-6 text-indigo-600" />
          <div>
            <h3 className="text-xl font-semibold text-gray-800">Órdenes FERT</h3>
            <p className="text-xs text-gray-500 mt-1">Seguimiento de cantidades programadas y pendientes</p>
          </div>
        </div>
        
        <div className="flex flex-wrap items-center gap-3">
          <Select value={selectedSector} onValueChange={setSelectedSector}>
            <SelectTrigger className="h-9 w-56 bg-white">
              <LayoutGrid className="w-3.5 h-3.5 mr-2 text-gray-400" />
              <SelectValue placeholder="Sector" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="ALL">Todos los Sectores</SelectItem>
              <SelectItem value="01 COLCHONES">01 COLCHONES</SelectItem>
              <SelectItem value="02 BASES">02 BASES</SelectItem>
            </SelectContent>
          </Select>

          <div className="relative w-64">
            <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-gray-400" />
            <Input type="search" placeholder="Orden, material, pedido..." className="pl-9 h-9 text-xs" value={searchTerm} onChange={e => { setSearchTerm(e.target.value); setCurrentPage(1); }} />
          </div>
          <Button variant="outline" size="sm" onClick={() => { hasStarted.current = false; loadData(); }}>Actualizar</Button>
        </div>
      </div>

      <Tabs value={selectedTab} onValueChange={(val) => { setSelectedTab(val); setCurrentPage(1); }} className="w-full">
        <TabsList className="flex flex-wrap h-auto bg-gray-100/50 p-1 mb-4">
          <TabsTrigger value="raw_view" className="data-[state=active]:bg-amber-100 data-[state=active]:text-amber-800 px-4 py-2 text-xs font-bold uppercase tracking-wider border-r border-gray-200">
            <Database className="w-3 h-3 mr-2" /> VISTA BRUTA ({allRawOrders.length})
          </TabsTrigger>
          {availableCenters.map(center => (
            <TabsTrigger key={center} value={center} className="data-[state=active]:bg-white data-[state=active]:text-indigo-700 px-6 py-2 text-xs font-bold uppercase tracking-wider">
              <Home className="w-3 h-3 mr-2" /> Centro {center} ({filteredDataByCenter[center]?.length || 0})
            </TabsTrigger>
          ))}
        </TabsList>

        {/* --- Resumen de Cant Pendiente por Fecha y Línea (solo en sub-pestañas de Centro) --- */}
        {selectedTab !== 'raw_view' && summaryByDateLine.dates.length > 0 && (
          <div className="bg-white rounded-lg shadow-sm border overflow-hidden mb-4">
            <div className="px-4 py-2 bg-indigo-50/60 border-b flex items-center gap-2">
              <ClipboardList className="w-3.5 h-3.5 text-indigo-600" />
              <span className="text-[11px] font-bold text-indigo-700 uppercase tracking-wider">
                Resumen de Cant Pendiente por Fecha y Línea
              </span>
            </div>
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
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
                    return (
                      <tr key={date} className="hover:bg-gray-50 transition-colors">
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
                    );
                  })}
                  <tr className="bg-indigo-50/40 border-t-2 border-indigo-100">
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

        <div className="bg-white rounded-lg shadow-sm border overflow-hidden">
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr className="border-b border-gray-300">
                  <th className="px-3 py-3 text-left text-[10px] font-bold text-gray-500 uppercase tracking-wider min-w-[80px]">Centro</th>
                  <th className="px-3 py-3 text-left text-[10px] font-bold text-gray-500 uppercase tracking-wider min-w-[120px]">Sector</th>
                  <th className="px-3 py-3 text-left text-[10px] font-bold text-gray-500 uppercase tracking-wider min-w-[150px]">Etiqueta</th>
                  <th className="px-3 py-3 text-left text-[10px] font-bold text-gray-500 uppercase tracking-wider min-w-[100px]">Categoría</th>
                  <th className="px-3 py-3 text-left text-[10px] font-bold text-indigo-700 uppercase tracking-wider min-w-[120px] bg-indigo-50/30">LÍNEA</th>
                  <th className="px-3 py-3 text-left text-[10px] font-bold text-gray-500 uppercase tracking-wider min-w-[120px]">Máquina</th>
                  <th className="px-3 py-3 text-left text-[10px] font-bold text-gray-500 uppercase tracking-wider min-w-[100px]">Material</th>
                  <th className="px-3 py-3 text-left text-[10px] font-bold text-gray-500 uppercase tracking-wider min-w-[120px]">Fecha</th>
                  <th className="px-3 py-3 text-left text-[10px] font-bold text-gray-500 uppercase tracking-wider min-w-[100px]">Pedido Ventas</th>
                  <th className="px-3 py-3 text-left text-[10px] font-bold text-gray-500 uppercase tracking-wider min-w-[90px]">Posición</th>
                  <th colSpan={2} className="px-3 py-3 text-left text-[10px] font-bold text-gray-500 uppercase tracking-wider">Orden / Nombre</th>
                  <th className="px-4 py-3 text-right text-[10px] font-bold text-gray-700 uppercase bg-gray-100/50 min-w-[80px]">PROG</th>
                  <th className="px-4 py-3 text-right text-green-700 uppercase bg-green-50/30 min-w-[80px]">ENTREG</th>
                  <th className="px-4 py-3 text-right text-amber-700 uppercase bg-amber-50/30 min-w-[80px]">PENDIENTE</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {displayedOrders.length > 0 ? displayedOrders.map((o, idx) => (
                  <tr key={idx} className="hover:bg-gray-50 text-[10px]">
                    <td className="px-3 py-2 font-bold text-gray-500">{o.CENTRO}</td>
                    <td className="px-3 py-2 text-gray-600 truncate max-w-[120px]" title={o.SECTOR}>{o.SECTOR || '-'}</td>
                    <td className="px-3 py-2 text-gray-600 truncate max-w-[150px]" title={o.ETIQUETA}>{o.ETIQUETA || '-'}</td>
                    <td className="px-3 py-2 text-gray-600 truncate max-w-[100px]">{o.CATEGORIA || '-'}</td>
                    <td className="px-3 py-2 font-bold text-indigo-700 bg-indigo-50/10">{o.LINEA || '-'}</td>
                    <td className="px-3 py-2 font-mono text-gray-600">{o.MAQUINA || '-'}</td>
                    <td className="px-3 py-2 font-mono text-gray-900 font-bold">{o.MATERIAL}</td>
                    <td className="px-3 py-2 text-gray-500">{o.FECHA}</td>
                    <td className="px-3 py-2 text-gray-600 font-mono">{o.PEDIDO || '-'}</td>
                    <td className="px-3 py-2 text-gray-600 font-mono">{o.POSICION || '-'}</td>
                    <td className="px-3 py-2 font-bold text-indigo-600">{o.ORDEN}</td>
                    <td className="px-3 py-2 text-gray-600 truncate max-w-[150px]">{o.NOMBRE}</td>
                    <td className="px-4 py-2 text-right font-bold text-gray-700 bg-gray-100/10">{o.CANTPROGRAMADA.toLocaleString()}</td>
                    <td className="px-4 py-2 text-right font-bold text-green-600 bg-green-50/10">{o.CANTENTREGADA.toLocaleString()}</td>
                    <td className="px-4 py-2 text-right font-bold text-amber-600 bg-amber-50/20">{o.CANTPENDIENTE.toLocaleString()}</td>
                  </tr>
                )) : (
                  <tr><td colSpan={15} className="px-6 py-12 text-center text-gray-400 italic">No se encontraron órdenes.</td></tr>
                )}
              </tbody>
              <tfoot className="bg-gray-800 text-white font-bold text-[10px] sticky bottom-0 z-10">
                <tr>
                  <td colSpan={12} className="px-4 py-3 text-right uppercase border-r border-gray-700">TOTALES:</td>
                  <td className="px-4 py-3 text-right">{totals.prog.toLocaleString()}</td>
                  <td className="px-4 py-3 text-right text-green-300">{totals.entreg.toLocaleString()}</td>
                  <td className="px-4 py-3 text-right text-amber-300">{totals.pend.toLocaleString()}</td>
                </tr>
              </tfoot>
            </table>
          </div>

          <div className="bg-gray-50 px-6 py-4 border-t flex flex-col sm:flex-row items-center justify-between gap-4">
            <div className="flex items-center gap-4 text-xs">
              <span className="font-medium text-gray-500 uppercase">Ver:</span>
              <select value={rowsPerPage} onChange={e => { setRowsPerPage(Number(e.target.value)); setCurrentPage(1); }} className="border rounded p-1 bg-white">
                <option value={10}>10</option>
                <option value={20}>20</option>
                <option value={50}>50</option>
              </select>
              <span className="text-gray-400">{startIndex + 1} - {Math.min(endIndex, currentViewOrders.length)} de {currentViewOrders.length}</span>
            </div>
            <div className="flex items-center gap-2">
              <Button variant="outline" size="sm" onClick={() => setCurrentPage(p => Math.max(1, p - 1))} disabled={currentPage === 1}>Ant.</Button>
              <div className="px-4 py-1 bg-white border rounded text-xs font-bold text-indigo-600 min-w-[80px] text-center">{currentPage} / {totalPagesLocal}</div>
              <Button variant="outline" size="sm" onClick={() => setCurrentPage(p => Math.min(totalPagesLocal, p + 1))} disabled={currentPage === totalPagesLocal}>Sig.</Button>
            </div>
          </div>
        </div>
      </Tabs>
    </div>
  );
};
