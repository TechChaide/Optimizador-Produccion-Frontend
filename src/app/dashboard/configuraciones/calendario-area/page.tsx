"use client";

import { useState, useEffect, useCallback } from 'react';
import { useToast } from '@/hooks/use-toast';
import CalendarioForm from './components/form';
import CalendarGeneral from './components/calendar-general';
import CalendarView from './components/calendar-view';
import { Calendario, DetalleCalendario, Restriccion } from '@/types/interfaces';
import { calendarioService } from '@/services/calendario.service';
import { detalleCalendarioService } from '@/services/detallecalendario.service';
import { restriccionService } from '@/services/restriccion.service';

type ViewMode = 'calendar' | 'form' | 'detail-calendar';

export default function CalendarioAreaPage() {
  const [records, setRecords] = useState<Calendario[]>([]);
  const [allDetalles, setAllDetalles] = useState<DetalleCalendario[]>([]);
  const [restricciones, setRestricciones] = useState<Restriccion[]>([]);
  const [selectedRecord, setSelectedRecord] = useState<Calendario | null>(null);
  const [selectedDetalles, setSelectedDetalles] = useState<DetalleCalendario[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [viewMode, setViewMode] = useState<ViewMode>('calendar');
  const { toast } = useToast();

  const fetchAll = useCallback(async () => {
    setIsLoading(true);
    try {
      const [calRes, detRes, restRes] = await Promise.all([
        calendarioService.getAll(),
        detalleCalendarioService.getAll(),
        restriccionService.getAll(),
      ]);
      setRecords(calRes.data || []);
      setAllDetalles(detRes.data || []);
      setRestricciones(restRes.data || []);
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Error al cargar datos';
      toast({ title: 'Error', description: errorMessage, variant: 'destructive' });
    } finally {
      setIsLoading(false);
    }
  }, [toast]);

  useEffect(() => {
    fetchAll();
  }, [fetchAll]);

  useEffect(() => {
    const onChanged = () => fetchAll();
    globalThis.addEventListener('records-changed', onChanged as EventListener);
    return () => globalThis.removeEventListener('records-changed', onChanged as EventListener);
  }, [fetchAll]);

  const handleAddNew = () => {
    setSelectedRecord(null);
    setViewMode('form');
  };

  const handleEditCalendario = (cal: Calendario) => {
    setSelectedRecord(cal);
    setViewMode('form');
  };

  const handleManageDetalles = (cal: Calendario) => {
    setSelectedRecord(cal);
    const filtered = allDetalles.filter(d => d.codigo_calendario === cal.codigo_calendario);
    setSelectedDetalles(filtered);
    setViewMode('detail-calendar');
  };

  const handleSuccess = () => {
    fetchAll();
    setViewMode('calendar');
    setSelectedRecord(null);
  };

  const handleCancel = () => {
    setViewMode('calendar');
    setSelectedRecord(null);
  };

  const handleBack = () => {
    setViewMode('calendar');
    setSelectedRecord(null);
    setSelectedDetalles([]);
  };

  if (isLoading && records.length === 0) {
    return (
      <div className="p-6 md:p-8">
        <div className="flex items-center justify-center h-96">
          <div className="text-center">
            <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-[#0055b8] mx-auto mb-4" />
            <p className="text-gray-500">Cargando calendarios...</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 md:p-8">
      {viewMode === 'calendar' && (
        <CalendarGeneral
          calendarios={records}
          allDetalles={allDetalles}
          restricciones={restricciones}
          onAddNew={handleAddNew}
          onEditCalendario={handleEditCalendario}
          onManageDetalles={handleManageDetalles}
        />
      )}

      {viewMode === 'form' && (
        <div className="max-w-3xl mx-auto">
          <button
            onClick={handleCancel}
            className="mb-4 px-4 py-2 text-sm text-gray-600 hover:text-gray-900 hover:bg-gray-100 rounded-lg transition flex items-center gap-1"
          >
            ← Volver al Calendario
          </button>
          <CalendarioForm
            record={selectedRecord}
            onSuccess={handleSuccess}
            onCancel={handleCancel}
          />
        </div>
      )}

      {viewMode === 'detail-calendar' && selectedRecord && (
        <div>
          <button
            onClick={handleBack}
            className="mb-4 px-4 py-2 text-sm text-gray-600 hover:text-gray-900 hover:bg-gray-100 rounded-lg transition flex items-center gap-1"
          >
            ← Volver al Calendario General
          </button>
          <CalendarView
            calendario={selectedRecord}
            detalles={selectedDetalles}
            calendarios={records}
            restricciones={restricciones}
          />
        </div>
      )}
    </div>
  );
}
