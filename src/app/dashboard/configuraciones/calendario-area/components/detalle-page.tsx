"use client";

import { useState, useEffect } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { ChevronLeft, CalendarRange } from 'lucide-react';
import DetalleCalendarioTable from './detalle-calendario-table';
import DetalleCalendarioForm from './detalle-calendario-form';
import { DetalleCalendario, Calendario } from '@/types/interfaces';
import { calendarioService } from '@/services/calendario.service';
import { useToast } from '@/hooks/use-toast';

export default function DetallesCalendarioPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const codigoCalendario = searchParams.get('codigo');
  const { toast } = useToast();

  const [calendario, setCalendario] = useState<Calendario | null>(null);
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [selectedRecord, setSelectedRecord] = useState<DetalleCalendario | null>(null);
  const [isLoading, setIsLoading] = useState(!!codigoCalendario);

  useEffect(() => {
    if (!codigoCalendario) {
      toast({ title: 'Error', description: 'Calendario no especificado', variant: 'destructive' });
      router.push('/dashboard/configuraciones/calendario-area');
      return;
    }

    const fetchCalendario = async () => {
      try {
        const response = await calendarioService.getById(Number(codigoCalendario));
        setCalendario(response.data);
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : 'Error al cargar el calendario';
        toast({ title: 'Error', description: errorMessage, variant: 'destructive' });
        router.push('/dashboard/configuraciones/calendario-area');
      } finally {
        setIsLoading(false);
      }
    };

    fetchCalendario();
  }, [codigoCalendario, router, toast]);

  const handleEdit = (record: DetalleCalendario) => {
    setSelectedRecord(record);
    setIsFormOpen(true);
  };

  const handleAddNew = () => {
    setSelectedRecord(null);
    setIsFormOpen(true);
  };

  const handleSuccess = () => {
    setIsFormOpen(false);
    setSelectedRecord(null);
  };

  const handleCancel = () => {
    setIsFormOpen(false);
    setSelectedRecord(null);
  };

  if (isLoading) {
    return (
      <div className="p-6 md:p-8">
        <div className="text-center py-12">Cargando...</div>
      </div>
    );
  }

  if (!calendario) {
    return (
      <div className="p-6 md:p-8">
        <div className="text-center py-12">Calendario no encontrado</div>
      </div>
    );
  }

  return (
    <div className="p-6 md:p-8 space-y-6">
      {/* Header */}
      <div className="flex items-center gap-4">
        <Button
          variant="ghost"
          size="icon"
          className="rounded-full"
          onClick={() => router.push('/dashboard/configuraciones/calendario-area')}
        >
          <ChevronLeft className="h-5 w-5" />
        </Button>
        <div className="flex items-center gap-3">
          <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-indigo-600/10">
            <CalendarRange className="h-6 w-6 text-indigo-600" />
          </div>
          <div>
            <h1 className="text-2xl font-bold tracking-tight text-gray-900">Gestión de Detalles</h1>
            <p className="text-sm text-gray-500">
              {calendario.nombre_calendario} • {calendario.grupo?.nombre_grupo}
            </p>
          </div>
        </div>
      </div>

      {/* Contenido */}
      {isFormOpen ? (
        <DetalleCalendarioForm
          record={selectedRecord}
          codigoCalendario={calendario.codigo_calendario}
          onSuccess={handleSuccess}
          onCancel={handleCancel}
        />
      ) : (
        <DetalleCalendarioTable
          codigoCalendario={calendario.codigo_calendario}
          onEdit={handleEdit}
          onAddNew={handleAddNew}
        />
      )}
    </div>
  );
}
