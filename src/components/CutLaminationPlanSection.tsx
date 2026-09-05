'use client';

import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { serviciosService } from '@/services/servicios.service';
import { useAppContext } from '@/context/AppProvider';
import { Loader2, RefreshCw, Search, Scissors, ChevronLeft, ChevronRight, ChevronsLeft, ChevronsRight } from 'lucide-react';
import { cn } from '@/lib/utils';

interface OrdenProvisional {
  ORDENPREVISIONAL: string;
  CodMaterial: string;
  MATERIAL: string;
  NOMBRE: string;
  CATEGORIA: string;
  CANTIDAD: number;
  UNIDAD: string;
  FECHAINICIO: string;
  FECHAFIN: string;
  Maquina: string | null;
  Centro: string;
  [key: string]: any;
}

const ROWS_PER_PAGE = 20;

const formatFecha = (value: string): string => {
  if (!value) return '—';
  const match = String(value).match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (!match) return String(value);
  const [, y, m, d] = match;
  return `${d}/${m}/${y}`;
};

export const CutLaminationPlanSection: React.FC = () => {
  const { addNotification } = useAppContext();
  const [isMounted, setIsMounted] = useState(false);
  const [orders, setOrders] = useState<OrdenProvisional[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const isInitialLoadDone = useRef(false);

  const [selectedMaquina, setSelectedMaquina] = useState<string>('');
  const [searchTerm, setSearchTerm] = useState('');
  const [fechaDesde, setFechaDesde] = useState('');
  const [fechaHasta, setFechaHasta] = useState('');
  const [currentPage, setCurrentPage] = useState(1);

  useEffect(() => { setIsMounted(true); }, []);

  const fetchData = useCallback(async () => {
    setIsLoading(true);
    try {
      const response = await serviciosService.OrdenesProvisionalesAlphaPaginados(1, 10000);
      setOrders(response.data || []);
    } catch (err) {
      addNotification('error', `Error al cargar el plan de corte y laminado: ${(err as Error).message}`);
    } finally {
      setIsLoading(false);
    }
  }, [addNotification]);

  useEffect(() => {
    if (isMounted && !isInitialLoadDone.current) {
      fetchData();
      isInitialLoadDone.current = true;
    }
  }, [fetchData, isMounted]);

  const maquinaOptions = useMemo(() => {
    const set = new Set<string>();
    orders.forEach(o => { if (o.Maquina) set.add(o.Maquina); });
    return Array.from(set).sort();
  }, [orders]);

  const filteredOrders = useMemo(() => {
    let result = orders;

    if (selectedMaquina) {
      result = result.filter(o => o.Maquina === selectedMaquina);
    }

    if (searchTerm.trim()) {
      const term = searchTerm.trim().toLowerCase();
      result = result.filter(o =>
        String(o.CodMaterial || '').toLowerCase().includes(term) ||
        String(o.NOMBRE || '').toLowerCase().includes(term) ||
        String(o.ORDENPREVISIONAL || '').toLowerCase().includes(term)
      );
    }

    if (fechaDesde) {
      result = result.filter(o => String(o.FECHAINICIO || '') >= fechaDesde);
    }
    if (fechaHasta) {
      result = result.filter(o => String(o.FECHAINICIO || '') <= fechaHasta);
    }

    return [...result].sort((a, b) => {
      const dateCompare = String(a.FECHAINICIO || '').localeCompare(String(b.FECHAINICIO || ''));
      if (dateCompare !== 0) return dateCompare;
      return String(a.ORDENPREVISIONAL || '').localeCompare(String(b.ORDENPREVISIONAL || ''));
    });
  }, [orders, selectedMaquina, searchTerm, fechaDesde, fechaHasta]);

  useEffect(() => { setCurrentPage(1); }, [selectedMaquina, searchTerm, fechaDesde, fechaHasta]);

  const totalPages = Math.max(1, Math.ceil(filteredOrders.length / ROWS_PER_PAGE));
  const displayedOrders = useMemo(() => {
    const start = (currentPage - 1) * ROWS_PER_PAGE;
    return filteredOrders.slice(start, start + ROWS_PER_PAGE);
  }, [filteredOrders, currentPage]);

  if (!isMounted) return null;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div className="flex items-center gap-2">
          <Scissors className="w-5 h-5 text-gray-500" />
          <div>
            <h3 className="text-lg font-semibold text-gray-800">Plan de Corte y Laminado</h3>
            <p className="text-xs text-gray-500">Órdenes provisionales de fabricación con fecha, material y cantidad planificada.</p>
          </div>
        </div>
        <button
          onClick={fetchData}
          disabled={isLoading}
          className="flex items-center gap-1.5 text-xs font-medium text-indigo-600 hover:text-indigo-800 disabled:opacity-50"
        >
          {isLoading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <RefreshCw className="w-3.5 h-3.5" />}
          Actualizar
        </button>
      </div>

      <div className="bg-white p-4 rounded-xl shadow-sm border flex flex-wrap items-end gap-4">
        <div className="flex flex-col gap-1">
          <label className="text-[10px] font-semibold uppercase tracking-wide text-gray-500">Máquina / Hoja de Ruta</label>
          <select
            value={selectedMaquina}
            onChange={e => setSelectedMaquina(e.target.value)}
            className="text-xs border border-gray-300 rounded-md px-2 py-1.5 min-w-[180px] focus:ring-1 focus:ring-indigo-500 outline-none"
          >
            <option value="">Todas las máquinas</option>
            {maquinaOptions.map(m => (
              <option key={m} value={m}>{m}</option>
            ))}
          </select>
        </div>

        <div className="flex flex-col gap-1">
          <label className="text-[10px] font-semibold uppercase tracking-wide text-gray-500">Fecha desde</label>
          <input
            type="date"
            value={fechaDesde}
            onChange={e => setFechaDesde(e.target.value)}
            className="text-xs border border-gray-300 rounded-md px-2 py-1.5 focus:ring-1 focus:ring-indigo-500 outline-none"
          />
        </div>

        <div className="flex flex-col gap-1">
          <label className="text-[10px] font-semibold uppercase tracking-wide text-gray-500">Fecha hasta</label>
          <input
            type="date"
            value={fechaHasta}
            onChange={e => setFechaHasta(e.target.value)}
            className="text-xs border border-gray-300 rounded-md px-2 py-1.5 focus:ring-1 focus:ring-indigo-500 outline-none"
          />
        </div>

        <div className="flex flex-col gap-1 flex-1 min-w-[200px]">
          <label className="text-[10px] font-semibold uppercase tracking-wide text-gray-500">Buscar (material, descripción u orden)</label>
          <div className="relative">
            <Search className="absolute left-2 top-2 h-3.5 w-3.5 text-gray-400" />
            <input
              type="text"
              value={searchTerm}
              onChange={e => setSearchTerm(e.target.value)}
              placeholder="Ej. LAMINA CILINDRICA, 30012660..."
              className="w-full text-xs pl-7 pr-2 py-1.5 border border-gray-300 rounded-md focus:ring-1 focus:ring-indigo-500 outline-none"
            />
          </div>
        </div>
      </div>

      <div className="bg-white rounded-xl shadow-sm border overflow-hidden">
        <div className="overflow-x-auto max-h-[65vh]">
          <table className="w-full text-[12px] border-collapse">
            <thead className="bg-slate-900 sticky top-0 z-10 text-white text-left uppercase tracking-wider">
              <tr>
                <th className="px-4 py-3 font-semibold">Fecha</th>
                <th className="px-4 py-3 font-semibold">Corrida / Apertura</th>
                <th className="px-4 py-3 font-semibold">Material</th>
                <th className="px-4 py-3 font-semibold">Descripción</th>
                <th className="px-4 py-3 font-semibold text-right">Plan (UN)</th>
                <th className="px-4 py-3 font-semibold text-right">Plan (KG)</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {isLoading && orders.length === 0 ? (
                <tr>
                  <td colSpan={6} className="py-20 text-center">
                    <Loader2 className="h-8 w-8 animate-spin text-indigo-600 mx-auto mb-2" />
                    <span className="text-gray-500 text-sm">Consultando servidor...</span>
                  </td>
                </tr>
              ) : displayedOrders.length > 0 ? (
                displayedOrders.map((order, idx) => {
                  const isUnidades = String(order.UNIDAD).toUpperCase() !== 'KG';
                  return (
                    <tr key={`${order.ORDENPREVISIONAL}-${idx}`} className="hover:bg-gray-50 transition-colors">
                      <td className="px-4 py-2.5 whitespace-nowrap">
                        <span className="inline-block bg-gray-100 border border-gray-200 rounded-full px-2.5 py-0.5 text-[11px] font-medium text-gray-700">
                          {formatFecha(order.FECHAINICIO)}
                        </span>
                      </td>
                      <td className="px-4 py-2.5 whitespace-nowrap font-semibold text-gray-800">{order.ORDENPREVISIONAL}</td>
                      <td className="px-4 py-2.5 whitespace-nowrap font-mono text-indigo-700">{order.CodMaterial}</td>
                      <td className="px-4 py-2.5 text-gray-700">{order.NOMBRE}</td>
                      <td className={cn("px-4 py-2.5 text-right font-mono font-semibold", isUnidades ? "bg-red-50 text-red-700" : "text-gray-400")}>
                        {isUnidades ? Number(order.CANTIDAD).toLocaleString() : '—'}
                      </td>
                      <td className={cn("px-4 py-2.5 text-right font-mono font-semibold", !isUnidades ? "bg-red-50 text-red-700" : "text-gray-400")}>
                        {!isUnidades ? Number(order.CANTIDAD).toLocaleString(undefined, { minimumFractionDigits: 1, maximumFractionDigits: 3 }) : '—'}
                      </td>
                    </tr>
                  );
                })
              ) : (
                <tr>
                  <td colSpan={6} className="py-20 text-center text-gray-400 italic">
                    No se encontraron órdenes para los filtros seleccionados.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        <div className="flex items-center justify-between px-4 py-3 border-t bg-gray-50/50">
          <div className="text-[11px] font-medium text-gray-500">
            {filteredOrders.length} registro{filteredOrders.length === 1 ? '' : 's'}
          </div>
          <div className="flex items-center gap-1">
            <button onClick={() => setCurrentPage(1)} disabled={currentPage === 1} className="p-1.5 rounded border disabled:opacity-40 hover:bg-gray-100"><ChevronsLeft className="h-4 w-4" /></button>
            <button onClick={() => setCurrentPage(p => p - 1)} disabled={currentPage === 1} className="p-1.5 rounded border disabled:opacity-40 hover:bg-gray-100"><ChevronLeft className="h-4 w-4" /></button>
            <div className="px-3 text-[11px] font-medium text-gray-600 min-w-[100px] text-center">Página {currentPage} de {totalPages}</div>
            <button onClick={() => setCurrentPage(p => p + 1)} disabled={currentPage === totalPages} className="p-1.5 rounded border disabled:opacity-40 hover:bg-gray-100"><ChevronRight className="h-4 w-4" /></button>
            <button onClick={() => setCurrentPage(totalPages)} disabled={currentPage === totalPages} className="p-1.5 rounded border disabled:opacity-40 hover:bg-gray-100"><ChevronsRight className="h-4 w-4" /></button>
          </div>
        </div>
      </div>
    </div>
  );
};
