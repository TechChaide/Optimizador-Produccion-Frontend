"use client";

import { useState, useEffect, useCallback } from 'react';
import { useToast } from '@/hooks/use-toast';
import TipoDetalleForm from './components/form';
import TipoDetalleTable from './components/table';
import { Tag } from 'lucide-react';
import { TipoDetalle } from '@/types/interfaces';
import { tipoDetalleService } from '@/services/tipodetalle.service';

export default function TipoDetallePage() {
  const [records, setRecords] = useState<TipoDetalle[]>([]);
  const [selectedRecord, setSelectedRecord] = useState<TipoDetalle | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [hasFetched, setHasFetched] = useState(false);
  const { toast } = useToast();

  const fetchRecords = useCallback(async () => {
    setIsLoading(true);
    try {
      const response = await tipoDetalleService.getAll();
      const data = response.data || [];
      setRecords(data);
      if (data.length === 0) setIsFormOpen(true);
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'No se pudo cargar los tipos.';
      toast({ title: 'Error', description: errorMessage, variant: 'destructive' });
      setIsFormOpen(true);
    } finally {
      setIsLoading(false);
      setHasFetched(true);
    }
  }, [toast]);

  useEffect(() => { fetchRecords(); }, [fetchRecords]);

  // refresh when records are changed from table actions
  useEffect(() => {
    const onChanged = () => fetchRecords();
    window.addEventListener('records-changed', onChanged as EventListener);
    return () => window.removeEventListener('records-changed', onChanged as EventListener);
  }, [fetchRecords]);

  const handleEdit = (record: TipoDetalle) => { setSelectedRecord(record); setIsFormOpen(true); };
  const handleAddNew = () => { setSelectedRecord(null); setIsFormOpen(true); };
  const handleSuccess = () => { fetchRecords(); setIsFormOpen(false); setSelectedRecord(null); };
  const handleCancel = () => { if (records.length > 0) { setIsFormOpen(false); setSelectedRecord(null); } };

  const showTable = hasFetched && !isFormOpen && records.length > 0;

  return (
    <div className="p-6 md:p-8 space-y-6">
      <div className="flex items-center gap-3">
        <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-indigo-600/10">
          <Tag className="h-6 w-6 text-indigo-600" />
        </div>
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-gray-900">Tipos de Detalle</h1>
          <p className="text-sm text-gray-500">Catálogo de tipos usados en calendarios y otros módulos.</p>
        </div>
      </div>

      {isFormOpen ? (
        <TipoDetalleForm record={selectedRecord} onSuccess={handleSuccess} onCancel={handleCancel} />
      ) : showTable ? (
        <TipoDetalleTable records={records} isLoading={isLoading} onEdit={handleEdit} onAddNew={handleAddNew} />
      ) : null}
    </div>
  );
}
