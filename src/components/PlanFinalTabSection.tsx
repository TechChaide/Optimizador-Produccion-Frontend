'use client';

import React, { useMemo, useState } from 'react';
import { ArrowRightLeft, Search, X, Loader2, ChevronLeft, ChevronRight, AlertCircle, Layers, Download } from 'lucide-react';
import { Button } from '@/components/ui/button';
import * as XLSX from 'xlsx';
import { usePlanFinalData } from '@/hooks/usePlanFinalData';

export const PlanFinalTabSection: React.FC = () => {
  const { rows, isLoading, error, diaProgramacion, reload } = usePlanFinalData();

  const [filters, setFilters] = useState({ centro: '', linea: '', material: '' });
  const [currentPage, setCurrentPage] = useState(1);
  const [rowsPerPage, setRowsPerPage] = useState(50);

  const filteredResults = useMemo(() => {
    return rows.filter(r => {
      const matchCentro = filters.centro === '' || r.centro === filters.centro;
      const matchLinea = filters.linea === '' || r.linea.toLowerCase().includes(filters.linea.toLowerCase());
      const matchMaterial = filters.material === '' ||
        r.codigoMaterial.toLowerCase().includes(filters.material.toLowerCase()) ||
        r.descripcion.toLowerCase().includes(filters.material.toLowerCase());
      return matchCentro && matchLinea && matchMaterial;
    });
  }, [rows, filters]);

  const grandTotal = useMemo(
    () => filteredResults.reduce((sum, r) => sum + r.cantidad, 0),
    [filteredResults]
  );

  const centrosDisponibles = useMemo(
    () => [...new Set(rows.map(r => r.centro))].filter(Boolean).sort(),
    [rows]
  );

  const totalPages = Math.max(1, Math.ceil(filteredResults.length / rowsPerPage));
  const paginatedResults = useMemo(() => {
    const start = (currentPage - 1) * rowsPerPage;
    return filteredResults.slice(start, start + rowsPerPage);
  }, [filteredResults, currentPage, rowsPerPage]);

  const handleFilterChange = (field: keyof typeof filters, value: string) => {
    setFilters(prev => ({ ...prev, [field]: value }));
    setCurrentPage(1);
  };

  const clearFilters = () => {
    setFilters({ centro: '', linea: '', material: '' });
    setCurrentPage(1);
  };

  const handleExport = () => {
    // "Día programación" (YYYY-MM-DD) reexpresada como DD.MM.YYYY: se arma la fecha en formato
    // DD/MM/YYYY y se reemplazan las barras por puntos, tal como pide la plantilla de exportación.
    const [anio, mes, dia] = String(diaProgramacion || '').split('-');
    const fechaExport = (anio && mes && dia) ? `${dia}/${mes}/${anio}`.replace(/\//g, '.') : '';

    const headers = ['OrdFab', 'Material', 'Centro', 'clase orden', 'Cantidad', 'Fecha', 'const 1', 'claveh'];
    const dataRows = filteredResults.map(r => [
      String(r.ordFab),
      String(r.codigoMaterial),
      String(r.centro),
      String(r.centro) === '2000' ? 'ZCOG' : 'ZCOQ',
      String(r.cantidad),
      fechaExport,
      '1',
      '000',
    ]);

    const ws = XLSX.utils.aoa_to_sheet([headers, ...dataRows]);

    // Requisito crítico: toda la hoja debe quedar en formato de texto puro, para que valores como
    // "000" (claveh) o materiales con ceros a la izquierda nunca se conviertan a número en Excel.
    const range = XLSX.utils.decode_range(ws['!ref'] as string);
    for (let R = range.s.r; R <= range.e.r; R++) {
      for (let C = range.s.c; C <= range.e.c; C++) {
        const cell = ws[XLSX.utils.encode_cell({ r: R, c: C })];
        if (cell) {
          cell.t = 's';
          cell.z = '@';
        }
      }
    }

    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Plan Final');
    XLSX.writeFile(wb, `Plan_Final_${diaProgramacion || 'sin_fecha'}.xlsx`);
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex items-center space-x-3">
          <Layers className="w-6 h-6 text-indigo-600" />
          <div>
            <h3 className="text-xl font-semibold text-gray-800">Plan Final</h3>
            <p className="text-xs text-gray-500 mt-1">
              Unificación de "Plan Táctico - Centro 1000 - PFF" y "Plan Táctico - Centro 2000 - PFF"
              para la fecha de Día programación: <span className="font-bold text-indigo-700">{diaProgramacion || '—'}</span>
            </p>
          </div>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={handleExport} disabled={filteredResults.length === 0} className="border-green-200 text-green-700 bg-green-50 hover:bg-green-100">
            <Download className="w-4 h-4 mr-2" /> Exportar Excel
          </Button>
          <Button variant="outline" size="sm" className="bg-blue-50 text-blue-700 border-blue-200" onClick={() => reload()}>
            <ArrowRightLeft className="w-4 h-4 mr-2" /> Recargar
          </Button>
        </div>
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-3 flex items-start gap-3 text-red-800 text-xs">
          <AlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5" />
          <span>{error}</span>
        </div>
      )}

      <div className="flex flex-wrap gap-3 p-4 bg-gray-50 border rounded-xl shadow-sm">
        <div className="flex flex-col gap-1 w-40">
          <label className="text-[10px] font-bold text-gray-400 uppercase ml-1">Centro:</label>
          <select
            value={filters.centro}
            onChange={e => handleFilterChange('centro', e.target.value)}
            className="text-xs border rounded-md px-2 py-2 outline-none h-9 font-medium text-gray-700"
          >
            <option value="">Todos</option>
            {centrosDisponibles.map(c => <option key={c} value={c}>{c}</option>)}
          </select>
        </div>
        <div className="flex flex-col gap-1 w-40">
          <label className="text-[10px] font-bold text-gray-400 uppercase ml-1">Línea:</label>
          <div className="relative">
            <Search className="absolute left-2 top-2.5 h-3.5 w-3.5 text-gray-400" />
            <input type="text" value={filters.linea} onChange={e => handleFilterChange('linea', e.target.value)}
              placeholder="Filtrar..." className="w-full pl-7 pr-2 py-2 text-xs border rounded-md h-9 outline-none focus:ring-1 focus:ring-indigo-500" />
          </div>
        </div>
        <div className="flex flex-col gap-1 w-56">
          <label className="text-[10px] font-bold text-gray-400 uppercase ml-1">Material / Descripción:</label>
          <div className="relative">
            <Search className="absolute left-2 top-2.5 h-3.5 w-3.5 text-gray-400" />
            <input type="text" value={filters.material} onChange={e => handleFilterChange('material', e.target.value)}
              placeholder="Buscar..." className="w-full pl-7 pr-2 py-2 text-xs border rounded-md h-9 outline-none focus:ring-1 focus:ring-indigo-500" />
          </div>
        </div>
        <div className="flex items-end">
          <Button variant="ghost" size="sm" onClick={clearFilters} className="h-9 text-[10px] text-red-500 hover:text-red-700 hover:bg-red-50 font-bold uppercase">
            <X className="w-3.5 h-3.5 mr-1" /> Limpiar
          </Button>
        </div>
      </div>

      <div className="bg-white rounded-lg shadow-sm border overflow-hidden">
        <div className="overflow-x-auto">
          <table className="min-w-full text-xs divide-y divide-gray-200 border-collapse">
            <thead className="bg-gray-50 uppercase text-[10px] font-bold text-gray-600">
              <tr>
                <th className="px-4 py-3 text-left border-b">Centro</th>
                <th className="px-4 py-3 text-left border-b">Línea</th>
                <th className="px-4 py-3 text-left border-b">Material</th>
                <th className="px-4 py-3 text-left border-b">Descripción</th>
                <th className="px-4 py-3 text-right border-b bg-indigo-50/30 text-indigo-700">Cantidad</th>
                <th className="px-4 py-3 text-left border-b bg-emerald-50/30 text-emerald-700">OrdFab</th>
                <th className="px-4 py-3 text-left border-b">Plan</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {isLoading ? (
                <tr><td colSpan={7} className="px-6 py-12 text-center text-gray-500"><Loader2 className="w-8 h-8 animate-spin mx-auto mb-2" /> Cargando Plan Final...</td></tr>
              ) : paginatedResults.length > 0 ? (
                paginatedResults.map((row, idx) => (
                  <tr key={`${row.codigoPlanGrupo}-${row.codigoDetalleTactico}-${idx}`} className="hover:bg-gray-50 transition-colors">
                    <td className="px-4 py-2.5 font-mono font-bold text-gray-700">{row.centro}</td>
                    <td className="px-4 py-2.5 text-gray-500 font-medium">{row.linea}</td>
                    <td className="px-4 py-2.5 font-mono font-bold text-gray-700">{row.codigoMaterial}</td>
                    <td className="px-4 py-2.5 text-gray-600 max-w-xs truncate" title={row.descripcion}>{row.descripcion}</td>
                    <td className="px-4 py-2.5 text-right font-bold text-indigo-700 bg-indigo-50/5 font-mono">{row.cantidad.toLocaleString()}</td>
                    <td className="px-4 py-2.5 font-mono font-bold text-emerald-700 bg-emerald-50/5">{row.ordFab || '-'}</td>
                    <td className="px-4 py-2.5 text-gray-400 italic">{row.planValor}</td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={7} className="px-6 py-12 text-center text-gray-400 italic">
                    No hay registros de Plan Final para la fecha {diaProgramacion || 'seleccionada'}.
                  </td>
                </tr>
              )}
            </tbody>
            {filteredResults.length > 0 && (
              <tfoot className="bg-gray-800 text-white font-bold text-[10px] sticky bottom-0">
                <tr>
                  <td colSpan={4} className="px-4 py-3 text-right uppercase border-r border-gray-700">Total filtrado ({filteredResults.length} regs):</td>
                  <td className="px-4 py-3 text-right text-indigo-300 font-mono">{grandTotal.toLocaleString()}</td>
                  <td className="px-4 py-3"></td>
                  <td className="px-4 py-3"></td>
                </tr>
              </tfoot>
            )}
          </table>
        </div>
      </div>

      {totalPages > 1 && (
        <div className="flex flex-col sm:flex-row items-center justify-between gap-4 px-2 py-2 bg-gray-50 border rounded-lg">
          <div className="flex items-center gap-4 text-[10px]">
            <span className="font-bold text-gray-400 uppercase">Mostrar:</span>
            <select
              value={rowsPerPage}
              onChange={(e) => { setRowsPerPage(Number(e.target.value)); setCurrentPage(1); }}
              className="border rounded p-1 bg-white text-gray-700 font-bold outline-none"
            >
              <option value={20}>20</option>
              <option value={50}>50</option>
              <option value={100}>100</option>
              <option value={200}>200</option>
            </select>
            <span className="text-gray-400 font-bold">
              Pág. {currentPage} de {totalPages} | Total {filteredResults.length} registros
            </span>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" onClick={() => setCurrentPage(p => Math.max(1, p - 1))} disabled={currentPage === 1} className="h-8 w-8 p-0">
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <Button variant="outline" size="sm" onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))} disabled={currentPage === totalPages} className="h-8 w-8 p-0">
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        </div>
      )}
    </div>
  );
};
