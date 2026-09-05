"use client";

import { useState, useEffect, useCallback } from 'react';
import { useToast } from '@/hooks/use-toast';
import GrupoForm from './components/form';
import GrupoTable from './components/table';
import RestriccionesModal from './components/restricciones-modal';
import RelacionesModal from './components/relaciones-modal';
import MaterialesBalanceoModal from './components/materiales-balanceo-modal';
import MaterialesBalanceoCargaMasivaModal from './components/materiales-balanceo-carga-masiva-modal';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Grupo } from '@/types/interfaces';
import { grupoService } from '@/services/grupo.service';

export default function GruposPage() {
  const [records, setRecords] = useState<Grupo[]>([]);
  const [selectedRecord, setSelectedRecord] = useState<Grupo | null>(null);
  const [selectedGrupoParaRestricciones, setSelectedGrupoParaRestricciones] = useState<Grupo | null>(null);
  const [selectedGrupoParaRelaciones, setSelectedGrupoParaRelaciones] = useState<Grupo | null>(null);
  const [selectedGrupoParaMaterialesBalanceo, setSelectedGrupoParaMaterialesBalanceo] = useState<Grupo | null>(null);
  const [selectedGrupoParaCargaMasiva, setSelectedGrupoParaCargaMasiva] = useState<Grupo | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [isRestriccionesModalOpen, setIsRestriccionesModalOpen] = useState(false);
  const [isRelacionesModalOpen, setIsRelacionesModalOpen] = useState(false);
  const [isMaterialesBalanceoModalOpen, setIsMaterialesBalanceoModalOpen] = useState(false);
  const [isCargaMasivaModalOpen, setIsCargaMasivaModalOpen] = useState(false);
  const [hasFetched, setHasFetched] = useState(false);
  const { toast } = useToast();

  const fetchRecords = useCallback(async () => {
    setIsLoading(true);
    try {
      const response = await grupoService.getAll();
      const data = response.data || [];
      setRecords(data);
      if (data.length === 0) setIsFormOpen(true);
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'No se pudo cargar los grupos.';
      toast({ title: 'Error', description: errorMessage, variant: 'destructive' });
      setIsFormOpen(true);
    } finally {
      setIsLoading(false);
      setHasFetched(true);
    }
  }, [toast]);

  useEffect(() => { fetchRecords(); }, [fetchRecords]);
  const handleEdit = (record: Grupo) => { setSelectedRecord(record); setIsFormOpen(true); };
  const handleAddNew = () => { setSelectedRecord(null); setIsFormOpen(true); };
  const handleManageRestricciones = (record: Grupo) => {
    setSelectedGrupoParaRestricciones(record);
    setIsRestriccionesModalOpen(true);
  };
  const handleManageRelaciones = (record: Grupo) => {
    setSelectedGrupoParaRelaciones(record);
    setIsRelacionesModalOpen(true);
  };
  const handleManageMaterialesBalanceo = (record: Grupo) => {
    setSelectedGrupoParaMaterialesBalanceo(record);
    setIsMaterialesBalanceoModalOpen(true);
  };
  const handleCargaMasivaMaterialesBalanceo = (record: Grupo) => {
    setSelectedGrupoParaCargaMasiva(record);
    setIsCargaMasivaModalOpen(true);
  };

  // handle deletion triggered from table
  useEffect(() => {
    const onChanged = () => fetchRecords();
    globalThis.window?.addEventListener('records-changed', onChanged as EventListener);
    return () => globalThis.window?.removeEventListener('records-changed', onChanged as EventListener);
  }, [fetchRecords]);
  const handleSuccess = () => { fetchRecords(); setIsFormOpen(false); setSelectedRecord(null); };
  const handleCancel = () => { if (records.length > 0) { setIsFormOpen(false); setSelectedRecord(null); } };

  const showTable = hasFetched && !isFormOpen && records.length > 0;

  return (
    <div className="p-6 md:p-8 space-y-6">
      <div className="flex items-center space-x-3">
        <h2 className="text-2xl font-semibold text-gray-700">Parámetros - Grupos</h2>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Configuración de Grupos</CardTitle>
        </CardHeader>
        <CardContent>
          <p>Administra los grupos de trabajo usados en la planificación.</p>
        </CardContent>
      </Card>

      {isFormOpen && (
        <GrupoForm record={selectedRecord} onSuccess={handleSuccess} onCancel={handleCancel} />
      )}
      {!isFormOpen && showTable && (
        <GrupoTable 
          records={records} 
          isLoading={isLoading} 
          onEdit={handleEdit} 
          onAddNew={handleAddNew}
          onManageRestricciones={handleManageRestricciones}
          onManageRelaciones={handleManageRelaciones}
          onManageMaterialesBalanceo={handleManageMaterialesBalanceo}
          onCargaMasivaMaterialesBalanceo={handleCargaMasivaMaterialesBalanceo}
        />
      )}

      <RestriccionesModal
        grupo={selectedGrupoParaRestricciones}
        isOpen={isRestriccionesModalOpen}
        onClose={() => {
          setIsRestriccionesModalOpen(false);
          setSelectedGrupoParaRestricciones(null);
        }}
      />

      <RelacionesModal
        grupo={selectedGrupoParaRelaciones}
        isOpen={isRelacionesModalOpen}
        onClose={() => {
          setIsRelacionesModalOpen(false);
          setSelectedGrupoParaRelaciones(null);
        }}
      />

      <MaterialesBalanceoModal
        grupo={selectedGrupoParaMaterialesBalanceo}
        isOpen={isMaterialesBalanceoModalOpen}
        onClose={() => {
          setIsMaterialesBalanceoModalOpen(false);
          setSelectedGrupoParaMaterialesBalanceo(null);
        }}
      />

      <MaterialesBalanceoCargaMasivaModal
        grupo={selectedGrupoParaCargaMasiva}
        isOpen={isCargaMasivaModalOpen}
        onClose={() => {
          setIsCargaMasivaModalOpen(false);
          setSelectedGrupoParaCargaMasiva(null);
        }}
        onImported={() => {
          setIsCargaMasivaModalOpen(false);
          setSelectedGrupoParaCargaMasiva(null);
        }}
      />
    </div>
  );
}
