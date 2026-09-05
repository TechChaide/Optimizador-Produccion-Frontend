"use client";

import { useState, useEffect } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { ChevronLeft } from 'lucide-react';
import DetalleCalendarioTable from '../components/detalle-calendario-table';
import DetalleCalendarioForm from '../components/detalle-calendario-form';
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
          onClick={() => router.push('/dashboard/configuraciones/calendario-area')}
        >
          <ChevronLeft className="h-5 w-5" />
        </Button>
        <div>
          <h2 className="text-2xl font-semibold text-gray-700">Gestión de Detalles</h2>
          <p className="text-gray-600">
            {calendario.nombre_calendario} • {calendario.grupo?.nombre_grupo}
          </p>
        </div>
      </div>

      {/* Contenido */}
      {isFormOpen ? (
        <Card>
          <CardContent className="p-6">
            <DetalleCalendarioForm
              record={selectedRecord}
              codigoCalendario={calendario.codigo_calendario}
              onSuccess={handleSuccess}
              onCancel={handleCancel}
            />
          </CardContent>
        </Card>
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
