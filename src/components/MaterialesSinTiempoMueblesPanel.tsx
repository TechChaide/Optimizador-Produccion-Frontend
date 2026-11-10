'use client';

import React, { useMemo, useState } from 'react';
import { Clock, Loader2, Pencil, Save, Search, TriangleAlert, Download } from 'lucide-react';
import * as XLSX from 'xlsx';
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from '@/components/ui/table';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import type { TiempoManualMueble } from '@/lib/tiempos-manuales-muebles';

export interface MaterialSinTiempoBackend {
  material: string;
  nombre: string;
  ordenes: number;
  unidades: number;
  // Fecha de entrega más próxima entre sus órdenes (DD-MM-YYYY), para priorizar qué completar primero
  fechaEntregaMasProxima: string;
  fechaEntregaMasProximaDate: Date;
}

interface MaterialesSinTiempoMueblesPanelProps {
  // Materiales de las órdenes vigentes SIN tiempo en el backend (tengan o no tiempo manual)
  materiales: MaterialSinTiempoBackend[];
  tiemposManualesMap: Map<string, TiempoManualMueble>;
  onGuardarTiempoManual: (material: string, descripcion: string, minutos: number) => Promise<void>;
  onNotify: (type: 'success' | 'error' | 'warning' | 'info', message: string) => void;
}

// TEMPORAL (ver @/lib/tiempos-manuales-muebles): avisa qué materiales de las órdenes de Muebles no
// tienen tiempo en los cubos del backend y permite ingresarlo a mano, para que "EJECUTAR PLANIFICACIÓN"
// calcule las horas requeridas (y la utilización de capacidad) al 100%. Mismo patrón de captura que la
// pestaña "Tiempos" de Planificación Táctica Taller de Corte.
export const MaterialesSinTiempoMueblesPanel: React.FC<MaterialesSinTiempoMueblesPanelProps> = ({ materiales, tiemposManualesMap, onGuardarTiempoManual, onNotify }) => {
  const [draftValues, setDraftValues] = useState<Record<string, string>>({});
  const [savingMaterial, setSavingMaterial] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [expanded, setExpanded] = useState(true);

  const pendientes = materiales.filter(m => !tiemposManualesMap.has(m.material));
  const conManual = materiales.length - pendientes.length;

  // Pendientes primero; dentro de cada grupo, la fecha de entrega más próxima primero
  const filas = useMemo(() => {
    const term = searchTerm.trim().toLowerCase();
    return materiales
      .filter(m => !term || m.material.includes(term) || m.nombre.toLowerCase().includes(term))
      .sort((a, b) => {
        const pa = tiemposManualesMap.has(a.material) ? 1 : 0;
        const pb = tiemposManualesMap.has(b.material) ? 1 : 0;
        return pa - pb || a.fechaEntregaMasProximaDate.getTime() - b.fechaEntregaMasProximaDate.getTime();
      });
  }, [materiales, tiemposManualesMap, searchTerm]);

  if (materiales.length === 0) return null;

  const handleGuardar = async (m: MaterialSinTiempoBackend) => {
    const raw = draftValues[m.material];
    const minutos = Number(raw);
    if (!raw || Number.isNaN(minutos) || minutos <= 0) {
      onNotify('warning', 'Ingrese un tiempo mayor a 0 minutos.');
      return;
    }
    setSavingMaterial(m.material);
    try {
      await onGuardarTiempoManual(m.material, m.nombre, minutos);
      setDraftValues(prev => {
        const next = { ...prev };
        delete next[m.material];
        return next;
      });
      onNotify('success', `Tiempo de ${m.material} guardado (${minutos.toFixed(2)} min). Vuelva a ejecutar la planificación para recalcular la capacidad.`);
    } catch (error) {
      onNotify('error', `No se pudo guardar el tiempo de ${m.material}: ${(error as Error).message}`);
    } finally {
      setSavingMaterial(null);
    }
  };

  const handleDescargar = () => {
    const ws = XLSX.utils.json_to_sheet(filas.map(m => {
      const manual = tiemposManualesMap.get(m.material);
      return {
        'Material': m.material,
        'Descripción': m.nombre,
        'Órdenes': m.ordenes,
        'Unidades': m.unidades,
        'Entrega más próxima': m.fechaEntregaMasProxima,
        'Tiempo Manual (min)': manual ? manual.minutos : '',
        'Estado': manual ? 'Con tiempo manual' : 'PENDIENTE',
      };
    }));
    ws['!cols'] = [{ wch: 12 }, { wch: 55 }, { wch: 9 }, { wch: 10 }, { wch: 18 }, { wch: 18 }, { wch: 18 }];
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Sin tiempo backend');
    XLSX.writeFile(wb, `Muebles_MaterialesSinTiempo_${new Date().toISOString().slice(0, 10)}.xlsx`);
  };

  return (
    <div className={cn('border rounded-xl shadow-sm overflow-hidden', pendientes.length > 0 ? 'border-red-300' : 'border-indigo-200')}>
      <button
        type="button"
        onClick={() => setExpanded(e => !e)}
        className={cn('w-full flex items-center gap-3 px-5 py-3 text-left', pendientes.length > 0 ? 'bg-red-50' : 'bg-indigo-50')}
      >
        {pendientes.length > 0
          ? <TriangleAlert className="w-5 h-5 text-red-600 shrink-0" />
          : <Clock className="w-5 h-5 text-indigo-600 shrink-0" />}
        <div className="flex-1">
          <p className={cn('text-sm font-bold uppercase tracking-wide', pendientes.length > 0 ? 'text-red-800' : 'text-indigo-800')}>
            Materiales sin tiempo en el backend
          </p>
          <p className="text-[11px] text-gray-600">
            {pendientes.length > 0
              ? <><span className="font-bold text-red-700">{pendientes.length} pendiente(s)</span> — sus órdenes cuentan 0 horas y la capacidad no se calcula al 100%. </>
              : 'Todos tienen tiempo manual. '}
            {conManual > 0 && <>{conManual} con tiempo manual (temporal). </>}
            El tiempo del backend reemplaza al manual en cuanto se actualicen los cubos.
          </p>
        </div>
        <span className="text-[11px] text-gray-500">{expanded ? 'Ocultar' : 'Mostrar'}</span>
      </button>

      {expanded && (
        <div className="p-4 space-y-3 bg-white">
          <div className="flex flex-wrap items-center gap-3">
            <div className="relative flex-1 min-w-[220px]">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 h-4 w-4" />
              <Input
                placeholder="Buscar por material o descripción..."
                value={searchTerm}
                onChange={e => setSearchTerm(e.target.value)}
                className="pl-10 h-9"
              />
            </div>
            <Button size="sm" variant="outline" onClick={handleDescargar} className="h-9 gap-1.5 text-xs">
              <Download className="w-3.5 h-3.5" /> Descargar (Excel)
            </Button>
          </div>
          <div className="border rounded-lg overflow-auto max-h-[50vh]">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="text-center">Material</TableHead>
                  <TableHead className="text-left">Descripción</TableHead>
                  <TableHead className="text-center">Órdenes</TableHead>
                  <TableHead className="text-center">Unidades</TableHead>
                  <TableHead className="text-center">Entrega más próxima</TableHead>
                  <TableHead className="text-center">Tiempo actual (min)</TableHead>
                  <TableHead className="text-center">Nuevo tiempo (min)</TableHead>
                  <TableHead className="text-center">Guardar</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filas.map(m => {
                  const manual = tiemposManualesMap.get(m.material);
                  const draft = draftValues[m.material] ?? '';
                  const isSaving = savingMaterial === m.material;
                  return (
                    <TableRow key={m.material} className={manual ? '' : 'bg-red-50/40'}>
                      <TableCell className="text-center font-mono text-xs">{m.material}</TableCell>
                      <TableCell className="text-left text-xs">{m.nombre}</TableCell>
                      <TableCell className="text-center text-xs">{m.ordenes}</TableCell>
                      <TableCell className="text-center text-xs">{m.unidades}</TableCell>
                      <TableCell className="text-center text-xs font-mono">{m.fechaEntregaMasProxima}</TableCell>
                      <TableCell className="text-center text-xs">
                        {manual
                          ? <span className="inline-flex items-center gap-1 font-bold text-indigo-700"><Pencil className="w-3 h-3" /> {manual.minutos.toFixed(2)}</span>
                          : <span className="font-semibold text-red-600">Sin tiempo</span>}
                      </TableCell>
                      <TableCell className="text-center">
                        <Input
                          type="number"
                          min="0"
                          step="0.01"
                          value={draft}
                          onChange={e => setDraftValues(prev => ({ ...prev, [m.material]: e.target.value }))}
                          onKeyDown={e => { if (e.key === 'Enter') handleGuardar(m); }}
                          className="h-8 w-28 mx-auto text-center"
                          placeholder={manual ? manual.minutos.toFixed(2) : '0.00'}
                        />
                      </TableCell>
                      <TableCell className="text-center">
                        <Button
                          size="sm"
                          onClick={() => handleGuardar(m)}
                          disabled={isSaving || !draft}
                          className="h-8 bg-emerald-600 hover:bg-emerald-700 text-white gap-1.5 text-xs"
                        >
                          {isSaving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Save className="w-3.5 h-3.5" />}
                          Guardar
                        </Button>
                      </TableCell>
                    </TableRow>
                  );
                })}
                {filas.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={8} className="text-center py-6 text-gray-400 text-xs">
                      No se encontraron resultados para &quot;{searchTerm}&quot;
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </div>
        </div>
      )}
    </div>
  );
};
