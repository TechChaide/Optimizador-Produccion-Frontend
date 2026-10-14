'use client';

import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react';
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
import { getTiemposManualesMuebles, TIEMPO_MANUAL_MUEBLES_PREFIJO, TIEMPO_MANUAL_MUEBLES_DESCRIPCION } from '@/lib/tiempos-manuales-muebles';

const formatDateForSQLServer = (date: Date): string => {
    const pad = (n: number) => n.toString().padStart(2, '0');
    return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())} ${pad(date.getHours())}:${pad(date.getMinutes())}:${pad(date.getSeconds())}.${date.getMilliseconds().toString().padStart(3, '0')}`;
};

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
    // Tiempos tal como vienen del backend (PR2 + maestro completo, ver fetchTiemposData)
    const [tiemposBackendData, setTiemposBackendData] = useState<any[]>([]);
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

            // Fuente 1: tiempos filtrados por grupo (PR2). Ese filtro depende de la clasificación de
            // puestos en SAP y deja fuera materiales de Muebles que sí tienen tiempo (p. ej. puesto
            // "Armado"), así que se complementa con el maestro completo de TiemposEnsamblado (todas sus
            // páginas), filtrado al centro, solo para los materiales que PR2 no trae con tiempo > 0.
            // Las filas de PR2 van primero: tienen prioridad en el cruce por material (primera con tiempo).
            const [porGrupo, maestro] = await Promise.allSettled([
                serviciosService.getTiemposEnsambladobyCentroyCodigoGrupo(centro, codigoGrupo),
                serviciosService.getTiemposEnsambladoCompleto(),
            ]);

            const toArray = (data: unknown): any[] => (data == null ? [] : Array.isArray(data) ? data : [data]);
            const materialDe = (item: any) => String(item.CodMaterial ?? item.MATERIAL ?? item.Material ?? '').trim().slice(-8);
            const tiempoDe = (item: any) => Number(item.Tiempo_Min ?? item.Tiempo ?? 0);

            const filasGrupo = porGrupo.status === 'fulfilled' ? toArray(porGrupo.value?.data) : [];
            if (porGrupo.status === 'rejected') console.error('Error al cargar tiempos de Muebles por grupo:', porGrupo.reason);

            const conTiempo = new Set(filasGrupo.filter(it => tiempoDe(it) > 0).map(materialDe));
            const filasMaestro = maestro.status === 'fulfilled'
                ? maestro.value.filter(it => String(it.Centro ?? '').trim() === centro && tiempoDe(it) > 0 && !conTiempo.has(materialDe(it)))
                : [];
            if (maestro.status === 'rejected') console.error('Error al cargar el maestro completo de TiemposEnsamblado:', maestro.reason);

            if (porGrupo.status === 'rejected' && maestro.status === 'rejected') {
                addNotification('error', 'No se pudieron cargar los tiempos de fabricación de Muebles.');
            } else {
                setTiemposBackendData([...filasGrupo, ...filasMaestro]);
            }
            setIsTiemposLoading(false);
        };

        fetchTiemposData();
    }, [gruposMuebles, mounted, addNotification]);

    // TEMPORAL — tiempos manuales de materiales nuevos sin tiempo en el backend (ver
    // @/lib/tiempos-manuales-muebles). Se agregan DESPUÉS de las filas del backend y solo para materiales
    // que el backend no trae con tiempo > 0, así el backend siempre gana en el cruce por material.
    const tiemposManualesMap = useMemo(() => getTiemposManualesMuebles(restriccionesMuebles), [restriccionesMuebles]);
    const tiemposMueblesData = useMemo(() => {
        const conTiempoBackend = new Set(
            tiemposBackendData
                .filter(it => Number(it.Tiempo_Min ?? it.Tiempo ?? 0) > 0)
                .map(it => String(it.CodMaterial ?? it.MATERIAL ?? it.Material ?? '').trim().slice(-8))
        );
        const filasManuales = Array.from(tiemposManualesMap.entries())
            .filter(([material]) => !conTiempoBackend.has(material))
            .map(([material, t]) => ({ CodMaterial: material, Centro: '1000', Tiempo_Min: t.minutos, Origen: 'Manual (temporal)', Material: t.descripcion }));
        return [...tiemposBackendData, ...filasManuales];
    }, [tiemposBackendData, tiemposManualesMap]);

    // Crea o actualiza el tiempo manual de un material (Restriccion del Grupo de Muebles, centro 1000)
    const handleGuardarTiempoManual = useCallback(async (material: string, descripcion: string, minutos: number) => {
        const grupo = gruposMuebles.find(g => g.centro === '1000' && g.nombre_grupo.toLowerCase().includes('muebles'));
        if (!grupo) throw new Error('No se encontró el Grupo de Muebles (centro 1000) para guardar el tiempo.');
        const existente = tiemposManualesMap.get(material);
        const payload: any = {
            codigo_grupo: grupo.codigo_grupo,
            nombre_restriccion: `${TIEMPO_MANUAL_MUEBLES_PREFIJO}${material}`,
            valor_restriccion: String(minutos),
            descripcion: `${TIEMPO_MANUAL_MUEBLES_DESCRIPCION} — ${descripcion}`.slice(0, 250),
            estado: 'A',
            usuario_modificacion: 'admin',
            fecha_modificacion: formatDateForSQLServer(new Date()),
        };
        if (existente) payload.codigo_restriccion = existente.codigoRestriccion;
        const saved = await restriccionService.save(payload);
        const guardada = { ...payload, codigo_restriccion: saved.data?.codigo_restriccion ?? existente?.codigoRestriccion ?? 0, grupo } as Restriccion;
        setRestriccionesMuebles(prev => [
            ...prev.filter(r => r.nombre_restriccion !== payload.nombre_restriccion),
            guardada,
        ]);
    }, [gruposMuebles, tiemposManualesMap]);

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
                        tiemposManualesMap={tiemposManualesMap}
                        onGuardarTiempoManual={handleGuardarTiempoManual}
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
