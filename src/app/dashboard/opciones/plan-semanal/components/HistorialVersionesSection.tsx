'use client';

import React, { useState, useCallback } from 'react';
import type { VersionPlan } from './types';

interface Props {
  versions: VersionPlan[];
  onLoad: (v: VersionPlan) => void;
  onDelete: (id: string) => void;
  onRefresh: () => void;
}

function exportVersionExcel(v: VersionPlan) {
  import('xlsx').then(XLSX => {
    const wb = XLSX.utils.book_new();

    const toSheet = (rows: any[], label: string) => {
      if (rows.length === 0) return;
      const data = rows.map(r => ({
        'Semana ISO':       `${r.isoYear}W${String(r.isoWeek).padStart(2, '0')}`,
        'Etiqueta':         r.label,
        'Mes Nombre':       r.mesNombre,
        'Mes':              r.mes,
        'Año':              r.anio,
        'Días L-V':         r.diasLaborales,
        'Días Efectivos':   r.diasEfectivos,
        'Centro':           r.centro,
        'Sector':           r.sector,
        'Línea Producción': r.linea,
        'CodMaterial':      r.CodMaterial,
        'Descripción':      r.descripcion,
        'Stock Inicial':    r.stockInicial,
        'Cant. Mensual':    r.cantidadMensual,
        'Cant. Semanal':    r.cantidadSemanal,
        'Cant. Diaria':     r.cantDiaria,
        'Desp. Ventas Sem': r.despachosVentasSemana,
        'Traslado Sem':     r.trasladoSemana,
      }));
      const ws = XLSX.utils.json_to_sheet(data);
      const colWidths = Object.keys(data[0] || {}).map(k => ({ wch: Math.max(k.length + 4, 12) }));
      ws['!cols'] = colWidths;
      XLSX.utils.book_append_sheet(wb, ws, label.substring(0, 31));
    };

    toSheet(v.rowsC1000, 'C1000 - Quito');
    toSheet(v.rowsC2000, 'C2000 - Guayaquil');

    const dateStr = v.id.replace('.', '_');
    XLSX.writeFile(wb, `PlanSemanal_${dateStr}.xlsx`);
  });
}

export const HistorialVersionesSection: React.FC<Props> = ({ versions, onLoad, onDelete, onRefresh }) => {
  const [confirmId, setConfirmId] = useState<string | null>(null);

  const handleDelete = useCallback((id: string) => {
    if (confirmId === id) {
      onDelete(id);
      setConfirmId(null);
    } else {
      setConfirmId(id);
    }
  }, [confirmId, onDelete]);

  if (versions.length === 0) {
    return (
      <div className="p-8 text-center text-gray-500">
        No hay versiones guardadas. Ve al tab &quot;Ajuste y Versión&quot; para crear la primera.
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold text-gray-700">{versions.length} versión(es) guardada(s)</h3>
        <button onClick={onRefresh} className="text-xs text-blue-600 hover:text-blue-800 underline">
          Actualizar lista
        </button>
      </div>

      <div className="space-y-2">
        {versions.map(v => {
          const savedDate = new Date(v.savedAt);
          const dateStr   = savedDate.toLocaleDateString('es-EC', { day: '2-digit', month: 'short', year: 'numeric' });
          const timeStr   = savedDate.toLocaleTimeString('es-EC', { hour: '2-digit', minute: '2-digit' });

          return (
            <div key={v.id} className="border border-gray-200 rounded-lg bg-white p-4 flex items-start justify-between gap-4">
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-3 mb-1">
                  <span className="font-mono font-bold text-indigo-700 text-sm">{v.id}</span>
                  <span className="text-xs text-gray-500">{dateStr} {timeStr}</span>
                  {v.savedToDB
                    ? <span className="text-[10px] bg-green-100 text-green-700 border border-green-200 px-2 py-0.5 rounded-full">BD ✓</span>
                    : <span className="text-[10px] bg-amber-100 text-amber-700 border border-amber-200 px-2 py-0.5 rounded-full">Solo local</span>
                  }
                </div>
                <div className="flex flex-wrap gap-3 text-xs text-gray-600 mb-1">
                  <span>Año: <strong>{v.año}</strong></span>
                  <span>Meses: <strong>{v.meses.join(', ')}</strong></span>
                  <span>Ajustes: <strong>{v.ajustes.length}</strong></span>
                  <span>Sábados activos: <strong>{v.activeSatKeys.length}</strong></span>
                  <span>Filas C1000: <strong>{v.rowsC1000.length}</strong></span>
                  <span>Filas C2000: <strong>{v.rowsC2000.length}</strong></span>
                </div>
                {v.nota && <p className="text-xs text-gray-700 italic">&quot;{v.nota}&quot;</p>}
              </div>
              <div className="flex gap-2 shrink-0">
                <button
                  onClick={() => exportVersionExcel(v)}
                  className="px-3 py-1.5 bg-green-50 text-green-700 border border-green-200 rounded text-xs font-medium hover:bg-green-100 transition-colors"
                >
                  Excel
                </button>
                <button
                  onClick={() => onLoad(v)}
                  className="px-3 py-1.5 bg-blue-50 text-blue-700 border border-blue-200 rounded text-xs font-medium hover:bg-blue-100 transition-colors"
                >
                  Cargar
                </button>
                <button
                  onClick={() => handleDelete(v.id)}
                  className={`px-3 py-1.5 rounded text-xs font-medium transition-colors ${
                    confirmId === v.id
                      ? 'bg-red-600 text-white border border-red-600'
                      : 'bg-red-50 text-red-600 border border-red-200 hover:bg-red-100'
                  }`}
                >
                  {confirmId === v.id ? '¿Confirmar?' : 'Eliminar'}
                </button>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};
