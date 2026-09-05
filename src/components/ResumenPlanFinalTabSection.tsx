'use client';

import React, { useMemo, useState } from 'react';
import { ArrowRightLeft, Search, X, Loader2, AlertCircle, ClipboardCheck, Download } from 'lucide-react';
import { Button } from '@/components/ui/button';
import * as XLSX from 'xlsx';
import { usePlanFinalData } from '@/hooks/usePlanFinalData';

interface ResumenRow {
  centro: string;
  linea: string;
  totalCantidad: number;
}

export const ResumenPlanFinalTabSection: React.FC = () => {
  const { rows, isLoading, error, diaProgramacion, reload } = usePlanFinalData();

  const [filters, setFilters] = useState({ centro: '', linea: '' });

  // Tabla resumen: sumatoria de Cantidad por cada combinación única de Centro + Línea,
  // construida exclusivamente a partir de los datos ya unificados en "Plan Final" (usePlanFinalData).
  const resumen = useMemo((): ResumenRow[] => {
    const map = new Map<string, ResumenRow>();
    rows.forEach(r => {
      const key = `${r.centro}|${r.linea}`;
      if (!map.has(key)) {
        map.set(key, { centro: r.centro, linea: r.linea, totalCantidad: 0 });
      }
      map.get(key)!.totalCantidad += r.cantidad;
    });
    return Array.from(map.values()).sort((a, b) =>
      a.centro.localeCompare(b.centro) || a.linea.localeCompare(b.linea)
    );
  }, [rows]);

  const filteredResumen = useMemo(() => {
    return resumen.filter(r => {
      const matchCentro = filters.centro === '' || r.centro === filters.centro;
      const matchLinea = filters.linea === '' || r.linea.toLowerCase().includes(filters.linea.toLowerCase());
      return matchCentro && matchLinea;
    });
  }, [resumen, filters]);

  const grandTotal = useMemo(
    () => filteredResumen.reduce((sum, r) => sum + r.totalCantidad, 0),
    [filteredResumen]
  );

  const centrosDisponibles = useMemo(
    () => [...new Set(resumen.map(r => r.centro))].filter(Boolean).sort(),
    [resumen]
  );

  const handleFilterChange = (field: keyof typeof filters, value: string) => {
    setFilters(prev => ({ ...prev, [field]: value }));
  };

  const clearFilters = () => setFilters({ centro: '', linea: '' });

  const handleExport = () => {
    const ws = XLSX.utils.json_to_sheet(filteredResumen.map(r => ({
      'Centro': r.centro,
      'Linea': r.linea,
      'Total cantidad': r.totalCantidad,
    })));
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Resumen Plan Final');
    XLSX.writeFile(wb, `Resumen_Plan_Final_${diaProgramacion || 'sin_fecha'}.xlsx`);
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex items-center space-x-3">
          <ClipboardCheck className="w-6 h-6 text-indigo-600" />
          <div>
            <h3 className="text-xl font-semibold text-gray-800">Resumen Plan final</h3>
            <p className="text-xs text-gray-500 mt-1">
              Total de cantidad por Centro + Línea, a partir de "Plan Final"
              para la fecha: <span className="font-bold text-indigo-700">{diaProgramacion || '—'}</span>
            </p>
          </div>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={handleExport} disabled={filteredResumen.length === 0} className="border-green-200 text-green-700 bg-green-50 hover:bg-green-100">
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
                <th className="px-4 py-3 text-left border-b">Linea</th>
                <th className="px-4 py-3 text-right border-b bg-indigo-50/30 text-indigo-700">Total cantidad</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {isLoading ? (
                <tr><td colSpan={3} className="px-6 py-12 text-center text-gray-500"><Loader2 className="w-8 h-8 animate-spin mx-auto mb-2" /> Calculando resumen...</td></tr>
              ) : filteredResumen.length > 0 ? (
                filteredResumen.map((row, idx) => (
                  <tr key={`${row.centro}-${row.linea}-${idx}`} className="hover:bg-gray-50 transition-colors">
                    <td className="px-4 py-2.5 font-mono font-bold text-gray-700">{row.centro}</td>
                    <td className="px-4 py-2.5 text-gray-500 font-medium">{row.linea}</td>
                    <td className="px-4 py-2.5 text-right font-bold text-indigo-700 bg-indigo-50/5 font-mono">{row.totalCantidad.toLocaleString()}</td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={3} className="px-6 py-12 text-center text-gray-400 italic">
                    No hay datos de Plan Final para la fecha {diaProgramacion || 'seleccionada'}.
                  </td>
                </tr>
              )}
            </tbody>
            {filteredResumen.length > 0 && (
              <tfoot className="bg-gray-800 text-white font-bold text-[10px] sticky bottom-0">
                <tr>
                  <td colSpan={2} className="px-4 py-3 text-right uppercase border-r border-gray-700">Total ({filteredResumen.length} combinaciones):</td>
                  <td className="px-4 py-3 text-right text-indigo-300 font-mono">{grandTotal.toLocaleString()}</td>
                </tr>
              </tfoot>
            )}
          </table>
        </div>
      </div>
    </div>
  );
};
