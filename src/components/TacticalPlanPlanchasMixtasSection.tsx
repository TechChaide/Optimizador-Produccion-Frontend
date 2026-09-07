'use client';

import React, { useState, useEffect, useMemo } from 'react';
import { Layers, Loader2 } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from '@/components/ui/table';
import { ProvisionalOrdersSummaryTab } from './ProvisionalOrdersSummaryTab';
import { TiemposEnsambladoTab } from './TiemposEnsambladoTab';
import { ProvisionalOrdersPlanchasMixtasTab } from './ProvisionalOrdersPlanchasMixtasTab';
import { PlanGrupoEnsambladoTab } from './PlanGrupoEnsambladoTab';
import { PlanGrupoEnsambladoPFFTab, type ComponentePlanchaAccum } from './PlanGrupoEnsambladoPFFTab';
import { PlanTacticoPFFTab } from './PlanTacticoPFFTab';
import { PlanPlanchasMixtasTab } from './PlanPlanchasMixtasTab';
import { grupoService } from '@/services/grupo.service';
import { restriccionService } from '@/services/restriccion.service';
import { serviciosService } from '@/services/servicios.service';
import type { Grupo, Restriccion } from '@/types/interfaces';
import { useAppContext } from '@/context/AppProvider';

// Nombre/alias que identifica al Grupo de Prensado (Lámina Prensada), buscado tanto en el nombre del
// grupo como en su descripción/alias de departamento (ej. "PRENSADO QUITO")
const GRUPO_PRENSADO_TEXTO = 'prensado';

const matchesGrupoPrensado = (grupo: Grupo): boolean => {
  const nombre = String(grupo.nombre_grupo || '').toLowerCase();
  const alias = String(grupo.departamentos_mapea || '').toLowerCase();
  return nombre.includes(GRUPO_PRENSADO_TEXTO) || alias.includes(GRUPO_PRENSADO_TEXTO);
};

// Componente para la tabla de Restricciones del Grupo Prensado
const RestriccionesPrensadoTab: React.FC<{ restricciones: (Restriccion & { grupo?: Grupo })[]; isLoading: boolean }> = ({ restricciones, isLoading }) => {
  if (isLoading) {
    return <div className="flex justify-center items-center p-8"><Loader2 className="w-8 h-8 animate-spin" /></div>;
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Restricciones del Grupo Prensado</CardTitle>
        <CardDescription>
          Restricciones de los grupos cuyo nombre o descripción de departamento coincide con "Prensado".
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="border rounded-lg overflow-auto max-h-[60vh]">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="text-center border-r border-dashed border-gray-300">Grupo</TableHead>
                <TableHead className="text-center border-r border-dashed border-gray-300">Nombre Restricción</TableHead>
                <TableHead className="text-center border-r border-dashed border-gray-300">Valor</TableHead>
                <TableHead className="text-center">Descripción</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {restricciones.map(restriccion => (
                <TableRow key={restriccion.codigo_restriccion}>
                  <TableCell className="text-center border-r border-dashed border-gray-300">{restriccion.grupo?.nombre_grupo || restriccion.codigo_grupo}</TableCell>
                  <TableCell className="text-center border-r border-dashed border-gray-300">{restriccion.nombre_restriccion}</TableCell>
                  <TableCell className="text-center border-r border-dashed border-gray-300">{restriccion.valor_restriccion}</TableCell>
                  <TableCell className="text-center">{restriccion.descripcion}</TableCell>
                </TableRow>
              ))}
              {restricciones.length === 0 && (
                <TableRow>
                  <TableCell colSpan={4} className="text-center py-6 text-gray-400 text-xs">
                    No se encontraron restricciones para el Grupo Prensado.
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </div>
      </CardContent>
    </Card>
  );
};

/**
 * Componente de sección para la Programación Táctica de Planchas Mixtas.
 * Incluye visualización de órdenes previsionales y tiempos de fabricación.
 */
export const TacticalPlanPlanchasMixtasSection: React.FC = () => {
  const { addNotification } = useAppContext();
  const [mounted, setMounted] = useState(false);
  const [gruposPlanchas, setGruposPlanchas] = useState<Grupo[]>([]);
  const [restriccionesPrensado, setRestriccionesPrensado] = useState<Restriccion[]>([]);
  const [isLoadingRestricciones, setIsLoadingRestricciones] = useState(true);

  // Pestaña activa (controlada) del Tabs — permite que "Plan Grupo Ensamblado (PFF)" navegue
  // directamente a "Plan Táctico PFF" desde su botón flotante
  const [activeTab, setActiveTab] = useState('plan-tactico');

  // Resultado de la Explosión de Materiales — Componentes de Plancha (calculado en "Plan Grupo Ensamblado
  // (PFF)"), entregado aquí para alimentar la pestaña "Plan Táctico PFF"
  const [pffComponentesPlancha, setPffComponentesPlancha] = useState<ComponentePlanchaAccum[]>([]);
  const [pffFechaObjetivo, setPffFechaObjetivo] = useState<string | null>(null);

  // Responsables de Control de Producción del área (ej. "015&016"), tomados de la restricción
  // "RespCtrlProd" del Grupo Prensado, usados para filtrar órdenes previsionales en todas las pestañas
  const validRespCodesPrensado = useMemo(() => {
    const respRestriccion = restriccionesPrensado.find(r => r.nombre_restriccion === 'RespCtrlProd');
    if (!respRestriccion || !respRestriccion.valor_restriccion) return [];

    return respRestriccion.valor_restriccion
      .split(/[&,]/)
      .map(code => String(code).trim())
      .filter(Boolean);
  }, [restriccionesPrensado]);
  const [tiemposPlanchasData, setTiemposPlanchasData] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isTiemposLoading, setIsTiemposLoading] = useState(false);

  // Hydration Guard
  useEffect(() => {
    setMounted(true);
  }, []);

  // Cargar grupos para identificar el código de grupo de Planchas
  useEffect(() => {
    if (!mounted) return;

    const fetchInitialData = async () => {
      setIsLoading(true);
      try {
        const res = await grupoService.getAll();
        const allGrupos = res.data || [];
        
        // Buscamos grupos relacionados con Planchas o Mixtas
        const filtered = allGrupos.filter(g => 
          g.nombre_grupo.toLowerCase().includes('plancha') || 
          g.nombre_grupo.toLowerCase().includes('mixta')
        );
        setGruposPlanchas(filtered);
      } catch (error) {
        addNotification('error', `Error al cargar grupos: ${(error as Error).message}`);
      } finally {
        setIsLoading(false);
      }
    };
    fetchInitialData();
  }, [addNotification, mounted]);

  // Cargar el Grupo Prensado (Lámina Prensada) y sus Restricciones — se busca por coincidencia en el
  // nombre del grupo o en su descripción/alias de departamento (departamentos_mapea), ej. "PRENSADO QUITO"
  useEffect(() => {
    if (!mounted) return;

    const fetchRestriccionesPrensado = async () => {
      setIsLoadingRestricciones(true);
      try {
        const [gruposRes, restriccionesRes] = await Promise.all([
          grupoService.getAll(),
          restriccionService.getAll(),
        ]);

        const allGrupos = gruposRes.data || [];
        const allRestricciones = restriccionesRes.data || [];

        const gruposPrensado = allGrupos.filter(matchesGrupoPrensado);
        if (gruposPrensado.length > 0) {
          const gruposPrensadoIds = new Set(gruposPrensado.map(g => g.codigo_grupo));
          const filteredRestricciones = allRestricciones.filter(r => gruposPrensadoIds.has(r.codigo_grupo));
          const restriccionesConGrupo = filteredRestricciones.map(r => {
            const grupo = allGrupos.find(g => g.codigo_grupo === r.codigo_grupo);
            return { ...r, grupo };
          });
          setRestriccionesPrensado(restriccionesConGrupo);
        } else {
          setRestriccionesPrensado([]);
        }
      } catch (error) {
        addNotification('error', `Error al cargar restricciones del Grupo Prensado: ${(error as Error).message}`);
      } finally {
        setIsLoadingRestricciones(false);
      }
    };
    fetchRestriccionesPrensado();
  }, [addNotification, mounted]);

  // Cargar Tiempos de Fabricación basados en el grupo encontrado
  useEffect(() => {
    if (!mounted || gruposPlanchas.length === 0) {
      if (mounted && !isLoading) setIsTiemposLoading(false);
      return;
    }

    const fetchTiempos = async () => {
      setIsTiemposLoading(true);
      // Tomamos el primer grupo como referencia (usualmente 1000 - Planchas)
      const targetGroup = gruposPlanchas[0];
      const centro = targetGroup.centro || '1000';
      const codigoGrupo = targetGroup.codigo_grupo;

      try {
        const response = await serviciosService.getTiemposEnsambladobyCentroyCodigoGrupo(centro, codigoGrupo);
        if (response && response.data) {
          const dataArray = Array.isArray(response.data) ? response.data : [response.data];
          
          // Filtrar por responsables 015 y 016 como solicitó el usuario
          const filtered = dataArray.filter((item: any) => {
            const resp = String(item.RespControlProd || item.RESPCONTROLPROD || '').trim();
            return resp === '015' || resp === '016';
          });
          
          // Si el API no devuelve el campo de responsable, mostramos los datos del grupo completo
          setTiemposPlanchasData(filtered.length > 0 ? filtered : dataArray);
        } else {
          setTiemposPlanchasData([]);
        }
      } catch (error) {
        console.error("Error cargando tiempos de Planchas", error);
      } finally {
        setIsTiemposLoading(false);
      }
    };

    fetchTiempos();
  }, [gruposPlanchas, addNotification, isLoading, mounted]);

  if (!mounted) {
    return (
      <div className="p-6 md:p-8 flex justify-center items-center h-64">
        <Loader2 className="w-8 h-8 animate-spin text-gray-400" />
      </div>
    );
  }

  return (
    <div className="p-6 md:p-8 space-y-6">
      <div className="flex items-center space-x-3">
        <Layers className="w-6 h-6 text-gray-700" />
        <h2 className="text-2xl font-semibold text-gray-700">Programación Táctica Planchas Mixtas</h2>
      </div>
      
      <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
        <TabsList className="grid w-full grid-cols-4 gap-1 h-auto p-1 bg-muted border border-dashed border-gray-300 rounded-lg">
          <TabsTrigger value="plan-tactico" className="font-bold text-blue-700 data-[state=active]:text-blue-700">
            Plan Táctico
          </TabsTrigger>
          <TabsTrigger value="plan-grupo-ensamblado" className="font-bold text-blue-700 data-[state=active]:text-blue-700">
            Plan Grupo Ensamblado (P1)
          </TabsTrigger>
          <TabsTrigger value="plan-grupo-ensamblado-pff" className="font-bold text-blue-700 data-[state=active]:text-blue-700">
            Plan Grupo Ensamblado (PFF)
          </TabsTrigger>
          <TabsTrigger value="plan-tactico-pff" className="font-bold text-blue-700 data-[state=active]:text-blue-700">
            Plan Táctico PFF
          </TabsTrigger>
          <TabsTrigger value="ordenes" className="font-bold text-blue-700 data-[state=active]:text-blue-700">
            Ord. Prev. ({validRespCodesPrensado.length > 0 ? validRespCodesPrensado.join('&') : '...'})
          </TabsTrigger>
          <TabsTrigger value="plan" className="font-bold text-blue-700 data-[state=active]:text-blue-700">
            PLAN
          </TabsTrigger>
          <TabsTrigger value="tiempos" className="font-bold text-blue-700 data-[state=active]:text-blue-700">
            Tiempos de Fabricación
          </TabsTrigger>
          <TabsTrigger value="restricciones" className="font-bold text-blue-700 data-[state=active]:text-blue-700">
            Restricciones
          </TabsTrigger>
        </TabsList>

        <TabsContent value="plan-tactico" className="mt-4">
          <ProvisionalOrdersPlanchasMixtasTab restricciones={restriccionesPrensado} />
        </TabsContent>

        <TabsContent value="plan-grupo-ensamblado" className="mt-4">
          <PlanGrupoEnsambladoTab />
        </TabsContent>

        <TabsContent value="plan-grupo-ensamblado-pff" className="mt-4">
          <PlanGrupoEnsambladoPFFTab
            onExplosionComplete={(componentes, fecha) => {
              setPffComponentesPlancha(componentes);
              setPffFechaObjetivo(fecha);
            }}
            onNavigateToPlanTacticoPFF={() => setActiveTab('plan-tactico-pff')}
          />
        </TabsContent>

        <TabsContent value="plan-tactico-pff" className="mt-4">
          <PlanTacticoPFFTab
            restricciones={restriccionesPrensado}
            componentesPlancha={pffComponentesPlancha}
            fechaObjetivo={pffFechaObjetivo}
          />
        </TabsContent>

        <TabsContent value="ordenes" className="mt-4">
          <Card>
            <CardHeader>
              <CardTitle>Datos de Órdenes Previsionales</CardTitle>
              <CardDescription>
                Visualización y exploración de todas las órdenes previsionales correspondientes al área de Planchas Mixtas
                (Responsables {validRespCodesPrensado.length > 0 ? validRespCodesPrensado.join(' y ') : '— restricción "RespCtrlProd" no encontrada'}).
              </CardDescription>
            </CardHeader>
            <CardContent>
              <ProvisionalOrdersSummaryTab respCodes={validRespCodesPrensado} centroFilter="1000" />
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="plan" className="mt-4">
          <PlanPlanchasMixtasTab respCodes={validRespCodesPrensado} />
        </TabsContent>

        <TabsContent value="tiempos" className="mt-4">
          <TiemposEnsambladoTab
            data={tiemposPlanchasData}
            isLoading={isTiemposLoading}
          />
        </TabsContent>

        <TabsContent value="restricciones" className="mt-4">
          <RestriccionesPrensadoTab restricciones={restriccionesPrensado} isLoading={isLoadingRestricciones} />
        </TabsContent>
      </Tabs>
    </div>
  );
};