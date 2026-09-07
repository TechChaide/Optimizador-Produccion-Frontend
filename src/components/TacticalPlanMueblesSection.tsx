'use client';

import React, { useState, useEffect, useRef } from 'react';
import { TacticalSchedulingIcon } from '@/constants/constants';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from '@/components/ui/table';
import { Loader2 } from 'lucide-react';

import { ProvisionalOrdersSummaryTab } from './ProvisionalOrdersSummaryTab';
import { PlanMueblesTabSection } from './PlanMueblesTabSection';
import { TiemposEnsambladoTab } from './TiemposEnsambladoTab';
import { CuboInventariosTab } from './CuboInventariosTab';
import { CuboInventariosTelasTab } from './CuboInventariosTelasTab';
import { CuboInventariosGeneralTab } from './CuboInventariosGeneralTab';
import { HabilidadesMueblesTab } from './HabilidadesMueblesTab';
import { PendientesTotalesTab } from './PendientesTotalesTab';
import { ProvisionalOrdersAlphaTab, ProvisionalOrdersAlphaTabHandle } from './ProvisionalOrdersAlphaTab';
import { MantenimientoProgramadoSection } from './MantenimientoProgramadoSection';
import { PlanGrupoRecuperadoTab } from './PlanGrupoRecuperadoTab';
import { grupoService } from '@/services/grupo.service';
import { restriccionService } from '@/services/restriccion.service';
import { serviciosService } from '@/services/servicios.service';
import type { Grupo, Restriccion } from '@/types/interfaces';
import { useAppContext } from '@/context/AppProvider';

// Componente para la tabla de Grupos
const GruposTab: React.FC<{ grupos: Grupo[]; isLoading: boolean }> = ({ grupos, isLoading }) => {
    if (isLoading) {
        return <div className="flex justify-center items-center p-8"><Loader2 className="w-8 h-8 animate-spin" /></div>;
    }

    return (
        <Card>
            <CardHeader>
                <CardTitle>Listado de Grupos de Muebles</CardTitle>
                <CardDescription>Grupos operativos para la fabricación de muebles.</CardDescription>
            </CardHeader>
            <CardContent>
                <div className="border rounded-lg overflow-auto max-h-[60vh]">
                    <Table>
                        <TableHeader>
                            <TableRow>
                                <TableHead className="text-center border-r border-dashed border-gray-300">Código</TableHead>
                                <TableHead className="text-center border-r border-dashed border-gray-300">Nombre</TableHead>
                                <TableHead className="text-center border-r border-dashed border-gray-300">Centro</TableHead>
                                <TableHead className="text-center">Estado</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {grupos.map(grupo => (
                                <TableRow key={grupo.codigo_grupo}>
                                    <TableCell className="text-center border-r border-dashed border-gray-300">{grupo.codigo_grupo}</TableCell>
                                    <TableCell className="text-center border-r border-dashed border-gray-300">{grupo.nombre_grupo}</TableCell>
                                    <TableCell className="text-center border-r border-dashed border-gray-300">{grupo.centro}</TableCell>
                                    <TableCell className="text-center">{grupo.estado === 'A' ? 'Activo' : 'Inactivo'}</TableCell>
                                </TableRow>
                            ))}
                        </TableBody>
                    </Table>
                </div>
            </CardContent>
        </Card>
    );
};

// Componente para la tabla de Restricciones
const RestriccionesTab: React.FC<{ restricciones: (Restriccion & { grupo?: Grupo })[]; isLoading: boolean }> = ({ restricciones, isLoading }) => {
    if (isLoading) {
        return <div className="flex justify-center items-center p-8"><Loader2 className="w-8 h-8 animate-spin" /></div>;
    }

    return (
        <Card>
            <CardHeader>
                <CardTitle>Listado de Restricciones para Muebles</CardTitle>
                <CardDescription>Restricciones de producción para el grupo de Muebles.</CardDescription>
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
                        </TableBody>
                    </Table>
                </div>
            </CardContent>
        </Card>
    );
};


export const TacticalPlanMueblesSection: React.FC = () => {
    const { addNotification } = useAppContext();
    const [mounted, setMounted] = useState(false);
    const [gruposMuebles, setGruposMuebles] = useState<Grupo[]>([]);
    const [restriccionesMuebles, setRestriccionesMuebles] = useState<Restriccion[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [tiemposMueblesData, setTiemposMueblesData] = useState<any[]>([]);
    const [isTiemposLoading, setIsTiemposLoading] = useState(true);
    const [activeTab, setActiveTab] = useState('plan');
    const provisionalOrdersAlphaRef = useRef<ProvisionalOrdersAlphaTabHandle>(null);

    // Le permite a "Plan Grupo Recuperado" (cuando ya no hay déficit de espuma) llevar al usuario
    // directamente a la pestaña "PLAN TÁCTICO" y disparar "Actualizar Datos" para generar el Paso 3.
    const handleIrAPasoFinal = () => {
        setActiveTab('planTactivo');
        provisionalOrdersAlphaRef.current?.refreshData(true);
    };

    useEffect(() => {
        setMounted(true);
    }, []);

    useEffect(() => {
        if (!mounted) return;

        const fetchInitialData = async () => {
            setIsLoading(true);
            try {
                const [gruposRes, restriccionesRes] = await Promise.all([
                    grupoService.getAll(),
                    restriccionService.getAll()
                ]);

                const allGrupos = gruposRes.data || [];
                const allRestricciones = restriccionesRes.data || [];

                const mueblesGrupos = allGrupos.filter(g => 
                    g.nombre_grupo.toLowerCase().includes('muebles')
                );
                setGruposMuebles(mueblesGrupos);

                if (mueblesGrupos.length > 0) {
                    const mueblesGrupoIds = new Set(mueblesGrupos.map(g => g.codigo_grupo));
                    const filteredRestricciones = allRestricciones.filter(r => 
                        mueblesGrupoIds.has(r.codigo_grupo)
                    );
                    
                    const restriccionesConGrupo = filteredRestricciones.map(r => {
                        const grupo = allGrupos.find(g => g.codigo_grupo === r.codigo_grupo);
                        return { ...r, grupo };
                    });
                    setRestriccionesMuebles(restriccionesConGrupo);
                } else {
                    setRestriccionesMuebles([]);
                }

            } catch (error) {
                addNotification('error', `Error al cargar datos iniciales: ${(error as Error).message}`);
            } finally {
                setIsLoading(false);
            }
        };
        fetchInitialData();
    }, [addNotification, mounted]);

    useEffect(() => {
        if (!mounted || gruposMuebles.length === 0) {
            if (mounted) setIsTiemposLoading(false);
            return;
        }
        
        const fetchTiemposData = async () => {
            setIsTiemposLoading(true);
            const centro = '1000';
            const grupoMuebles = gruposMuebles.find(g => 
                g.centro === centro && g.nombre_grupo.toLowerCase().includes('muebles')
            );

            if (!grupoMuebles) {
                setIsTiemposLoading(false);
                return;
            }

            const codigoGrupo = grupoMuebles.codigo_grupo;

            try {
                const response = await serviciosService.getTiemposEnsambladobyCentroyCodigoGrupo(centro, codigoGrupo);
                if (response && response.data) {
                    const dataArray = Array.isArray(response.data) ? response.data : [response.data];
                    setTiemposMueblesData(dataArray);
                }
            } catch (error) {
                console.error('Error al cargar tiempos de Muebles:', error);
            } finally {
                setIsTiemposLoading(false);
            }
        };

        fetchTiemposData();
    }, [gruposMuebles, mounted]);

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
        <TacticalSchedulingIcon />
        <h2 className="text-2xl font-semibold text-gray-700">Programación Táctica muebles</h2>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
          <TabsList className="grid w-full grid-cols-6 h-auto p-2 bg-muted border border-dashed border-gray-300 rounded-lg gap-2">
              <TabsTrigger value="grupos" className="text-xs py-2 px-1">Grupos</TabsTrigger>
              <TabsTrigger value="restricciones" className="text-xs py-2 px-1">Restricciones</TabsTrigger>
              <TabsTrigger value="ordenes" className="text-xs py-2 px-1">Ord. Prev.</TabsTrigger>
              <TabsTrigger value="ordenesFert" className="text-xs py-2 px-1">Ord. Fert</TabsTrigger>
              <TabsTrigger value="tiemposMuebles" className="text-xs py-2 px-1">Tiempos</TabsTrigger>
              <TabsTrigger value="habilidades" className="text-xs py-2 px-1">Habilidades</TabsTrigger>
              <TabsTrigger value="inventario" className="text-xs py-2 px-1 font-bold bg-blue-50 text-blue-700">INVENTARIO</TabsTrigger>
              <TabsTrigger value="cascos" className="text-xs py-2 px-1">Cascos</TabsTrigger>
              <TabsTrigger value="telas" className="text-xs py-2 px-1">Telas</TabsTrigger>
              <TabsTrigger value="pendientes" className="text-xs py-2 px-1">PEND TOTALES</TabsTrigger>
              <TabsTrigger value="mantenimiento" className="text-xs py-2 px-1">Mantenimiento</TabsTrigger>
              <TabsTrigger value="planTactivo" className="text-xs py-2 px-1">PLAN TÁCTICO</TabsTrigger>
              <TabsTrigger value="planGrupoRecuperado" className="text-xs py-2 px-1">Plan Grupo Recuperado</TabsTrigger>
              <TabsTrigger value="plan" className="text-xs py-2 px-1 font-bold col-span-2">PLAN</TabsTrigger>
          </TabsList>
          
          <TabsContent value="grupos" className="mt-4">
              <GruposTab grupos={gruposMuebles} isLoading={isLoading} />
          </TabsContent>
          <TabsContent value="restricciones" className="mt-4">
              <RestriccionesTab restricciones={restriccionesMuebles} isLoading={isLoading} />
          </TabsContent>
          <TabsContent value="ordenes" className="mt-4">
              <Card>
                  <CardHeader>
                      <CardTitle>Datos de Órdenes Previsionales</CardTitle>
                      <CardDescription>
                          Visualización y exploración de todas las órdenes previsionales disponibles en el sistema, filtrado para almacenes 1011 y 1015.
                      </CardDescription>
                  </CardHeader>
                  <CardContent>
                      <ProvisionalOrdersSummaryTab />
                  </CardContent>
              </Card>
          </TabsContent>
          <TabsContent value="ordenesFert" className="mt-4">
              <Card>
                  <CardHeader>
                      <CardTitle>Órdenes FERT</CardTitle>
                      <CardDescription>
                          Listado completo de órdenes FERT registradas en el sistema para el área de Muebles.
                      </CardDescription>
                  </CardHeader>
                  <CardContent>
                      <PlanMueblesTabSection 
                        restricciones={restriccionesMuebles} 
                        displayMode="full"
                      />
                  </CardContent>
              </Card>
          </TabsContent>
          <TabsContent value="tiemposMuebles" className="mt-4">
              <TiemposEnsambladoTab data={tiemposMueblesData} isLoading={isTiemposLoading} />
          </TabsContent>
          <TabsContent value="habilidades" className="mt-4">
              <Card>
                  <CardHeader>
                      <CardTitle>Habilidades del Personal (CuboHabilidadesOP)</CardTitle>
                      <CardDescription>
                          Consulta de competencias y calificaciones técnicas para el personal del área de Muebles.
                      </CardDescription>
                  </CardHeader>
                  <CardContent>
                      <HabilidadesMueblesTab />
                  </CardContent>
              </Card>
          </TabsContent>
          <TabsContent value="inventario" className="mt-4">
              <Card>
                  <CardHeader>
                      <CardTitle>Cubo de Inventarios (General)</CardTitle>
                      <CardDescription>
                          Visualización completa y búsqueda global en el maestro de inventarios.
                      </CardDescription>
                  </CardHeader>
                  <CardContent>
                      <CuboInventariosGeneralTab />
                  </CardContent>
              </Card>
          </TabsContent>
          <TabsContent value="cascos" className="mt-4">
              <Card>
                  <CardHeader>
                      <CardTitle>Inventario Cascos</CardTitle>
                      <CardDescription>
                          Visualización de los datos de inventario filtrados por "CASCO".
                      </CardDescription>
                  </CardHeader>
                  <CardContent>
                      <CuboInventariosTab />
                  </CardContent>
              </Card>
          </TabsContent>
           <TabsContent value="telas" className="mt-4">
              <Card>
                  <CardHeader>
                      <CardTitle>Inventario Telas</CardTitle>
                      <CardDescription>
                          Visualización de los datos de inventario filtrados por "TELA".
                      </CardDescription>
                  </CardHeader>
                  <CardContent>
                      <CuboInventariosTelasTab />
                  </CardContent>
              </Card>
          </TabsContent>
          <TabsContent value="pendientes" className="mt-4">
              <Card>
                  <CardHeader>
                      <CardTitle>Pendientes Totales</CardTitle>
                      <CardDescription>
                          Listado de toda la carga pendiente reportada en el sistema.
                      </CardDescription>
                  </CardHeader>
                  <CardContent>
                      <PendientesTotalesTab />
                  </CardContent>
              </Card>
          </TabsContent>
          <TabsContent value="mantenimiento" className="mt-4">
              <MantenimientoProgramadoSection restricciones={restriccionesMuebles} />
          </TabsContent>
          <TabsContent value="planTactivo" className="mt-4 data-[state=inactive]:hidden" forceMount>
              <Card>
                  <CardHeader>
                      <CardTitle>Plan Táctico (Alpha)</CardTitle>
                      <CardDescription>
                          Exploración avanzada de órdenes previsionales utilizando el método Alpha.
                      </CardDescription>
                  </CardHeader>
                  <CardContent>
                      <ProvisionalOrdersAlphaTab
                        ref={provisionalOrdersAlphaRef}
                        restricciones={restriccionesMuebles}
                        tiemposData={tiemposMueblesData}
                      />
                  </CardContent>
              </Card>
          </TabsContent>
          <TabsContent value="planGrupoRecuperado" className="mt-4">
              <PlanGrupoRecuperadoTab onIrAPasoFinal={handleIrAPasoFinal} />
          </TabsContent>
          <TabsContent value="plan" className="mt-4">
              <Card>
                  <CardHeader>
                      <CardTitle>PLAN</CardTitle>
                      <CardDescription>
                          Visualización de capacidad por fecha
                      </CardDescription>
                  </CardHeader>
                  <CardContent>
                      <PlanMueblesTabSection 
                        restricciones={restriccionesMuebles} 
                        columns={['FECHA', 'FECHA ENTREGA', 'PEDIDO', 'POSICION', 'ORDEN', 'MATERIAL', 'NOMBRE', 'PUESTOTRABAJO', 'CANTPROGRAMADA', 'TIEMPO']}
                        hideControls={false}
                        tiemposData={tiemposMueblesData}
                        displayMode="plan"
                      />
                  </CardContent>
              </Card>
          </TabsContent>
      </Tabs>
    </div>
  );
};
