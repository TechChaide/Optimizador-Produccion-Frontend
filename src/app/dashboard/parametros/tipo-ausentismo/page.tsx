"use client";

import { useState, useEffect, useCallback } from 'react';
import { useToast } from '@/hooks/use-toast';
import TipoAusentismoForm from './components/form';
import TipoAusentismoTable from './components/table';
import { CalendarOff } from 'lucide-react';
import { TipoAusentismo } from '@/types/interfaces';
import { tipoAusentismoService } from '@/services/tipoausentismo.service';

export default function TipoAusentismoPage() {
  const [records, setRecords] = useState<TipoAusentismo[]>([]);
  const [selectedRecord, setSelectedRecord] = useState<TipoAusentismo | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [hasFetched, setHasFetched] = useState(false);
  const { toast } = useToast();

  const fetchRecords = useCallback(async () => {
    setIsLoading(true);
    try {
      const response = await tipoAusentismoService.getAll();
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

  useEffect(() => {
    const onChanged = () => fetchRecords();
    window.addEventListener('records-changed', onChanged as EventListener);
    return () => window.removeEventListener('records-changed', onChanged as EventListener);
  }, [fetchRecords]);

  const handleEdit = (record: TipoAusentismo) => { setSelectedRecord(record); setIsFormOpen(true); };
  const handleAddNew = () => { setSelectedRecord(null); setIsFormOpen(true); };
  const handleSuccess = () => { fetchRecords(); setIsFormOpen(false); setSelectedRecord(null); };
  const handleCancel = () => { if (records.length > 0) { setIsFormOpen(false); setSelectedRecord(null); } };

  const showTable = hasFetched && !isFormOpen && records.length > 0;

  return (
    <div className="p-6 md:p-8 space-y-6">
      <div className="flex items-center gap-3">
        <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-indigo-600/10">
          <CalendarOff className="h-6 w-6 text-indigo-600" />
        </div>
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-gray-900">Tipos de Ausentismo</h1>
          <p className="text-sm text-gray-500">Catálogo de motivos de ausentismo del sistema.</p>
        </div>
      </div>

      {isFormOpen ? (
        <TipoAusentismoForm record={selectedRecord} onSuccess={handleSuccess} onCancel={handleCancel} />
      ) : showTable ? (
        <TipoAusentismoTable records={records} isLoading={isLoading} onEdit={handleEdit} onAddNew={handleAddNew} />
      ) : null}
    </div>
  );
}
