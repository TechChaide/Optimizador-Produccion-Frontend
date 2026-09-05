'use client';

import React, { useState, useEffect, useMemo } from 'react';
import { 
  CalendarClock, 
  Users, 
  Lock, 
  Package, 
  MountainSnow, 
  TreePalm, 
  Loader2, 
  ClipboardList, 
  UserCheck, 
  Clock, 
  CalendarRange,
  Activity,
  CheckCircle2,
  LayoutGrid,
  Boxes,
  Layers,
  ClipboardCheck
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { ProvisionalOrdersTabSection } from './ProvisionalOrdersTabSection';
import { OrdenesFertTabSection } from './OrdenesFertTabSection';
import { HabilidadesOpTabSection } from './HabilidadesOpTabSection';
import { TiemposEnsambladoTabSection } from './TiemposEnsambladoTabSection';
import { PresupuestoProdSemanalTabSection } from './PresupuestoProdSemanalTabSection';
import { ExplosionMaterialesTabSection } from './ExplosionMaterialesTabSection';
import { RevCapacidadTabSection } from './RevCapacidadTabSection';
import { RevCapHalbTabSection } from './RevCapHalbTabSection';
import { PlanPropuestoTabSection } from './PlanPropuestoTabSection';
import { PlanFinalTabSection } from './PlanFinalTabSection';
import { ResumenPlanFinalTabSection } from './ResumenPlanFinalTabSection';
import { MaterialBalanceoLineasTabSection } from './MaterialBalanceoLineasTabSection';
import { grupoService } from '@/services/grupo.service';
import { restriccionService } from '@/services/restriccion.service';
import type { Grupo, Restriccion } from '@/types/interfaces';

const CENTROS = [
  { codigo: 1000, nombre: 'Quito', Icon: MountainSnow },
  { codigo: 2000, nombre: 'Guayaquil', Icon: TreePalm },
];

export const TacticalPlan2Section: React.FC = () => {
  const [mounted, setMounted] = useState(false);
  const [grupos, setGrupos] = useState<Grupo[]>([]);
  const [restricciones, setRestricciones] = useState<Restriccion[]>([]);
  const [isLoadingGrupos, setIsLoadingGrupos] = useState(false);
  const [isLoadingRestricciones, setIsLoadingRestricciones] = useState(false);

  useEffect(() => {
    setMounted(true);
    loadGrupos();
    loadRestricciones();
  }, []);

  const loadGrupos = async () => {
    setIsLoadingGrupos(true);
    try {
      const res = await grupoService.getAll();
      setGrupos(res.data || []);
    } catch (error) {
      console.error('Error loading groups:', error);
    } finally {
      setIsLoadingGrupos(false);
    }
  };

  const loadRestricciones = async () => {
    setIsLoadingRestricciones(true);
    try {
      const res = await restriccionService.getAll();
      setRestricciones(res.data || []);
    } catch (error) {
      console.error('Error loading restrictions:', error);
    } finally {
      setIsLoadingRestricciones(false);
    }
  };

  const gruposFiltrados = useMemo(() => {
    return grupos.filter(g => 
      g.nombre_grupo.toLowerCase().includes('ensamblado')
    );
  }, [grupos]);

  const restriccionesFiltradas = useMemo(() => {
    return restricciones.filter(r => {
      const grupoAsociado = grupos.find(g => g.codigo_grupo === r.codigo_grupo);
      return grupoAsociado && grupoAsociado.nombre_grupo.toLowerCase().includes('ensamblado');
    });
  }, [restricciones, grupos]);

  const resolveCentro = (codigoOrValue?: any) => {
    if (codigoOrValue == null) return null;
    const codigo = Number(codigoOrValue);
    return CENTROS.find(x => x.codigo === codigo) || null;
  };

  if (!mounted) return null;

  return (
    <div className="p-6 md:p-8 space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-3">
          <CalendarClock className="w-6 h-6 text-indigo-600" />
          <h2 className="text-2xl font-bold text-gray-800">Programación Táctica colchones</h2>
        </div>
      </div>
      
      <Tabs defaultValue="grupos" className="w-full">
        <TabsList className="flex flex-wrap h-auto w-full justify-start bg-gray-100/50 p-1 mb-8 gap-1 rounded-xl border border-gray-200 shadow-sm">
          <TabsTrigger value="grupos" className="flex items-center gap-2 px-4 py-2.5 text-xs font-bold uppercase tracking-tight transition-all data-[state=active]:bg-white data-[state=active]:text-indigo-700 data-[state=active]:shadow-sm rounded-lg">
            <Users className="w-3.5 h-3.5" />
            Grupos
          </TabsTrigger>
          <TabsTrigger value="restricciones" className="flex items-center gap-2 px-4 py-2.5 text-xs font-bold uppercase tracking-tight transition-all data-[state=active]:bg-white data-[state=active]:text-indigo-700 data-[state=active]:shadow-sm rounded-lg">
            <Lock className="w-3.5 h-3.5" />
            Restricciones
          </TabsTrigger>
          <TabsTrigger value="habilidades" className="flex items-center gap-2 px-4 py-2.5 text-xs font-bold uppercase tracking-tight transition-all data-[state=active]:bg-white data-[state=active]:text-indigo-700 data-[state=active]:shadow-sm rounded-lg">
            <UserCheck className="w-3.5 h-3.5" />
            Habilidades
          </TabsTrigger>
          <TabsTrigger value="tiempos" className="flex items-center gap-2 px-4 py-2.5 text-xs font-bold uppercase tracking-tight transition-all data-[state=active]:bg-white data-[state=active]:text-indigo-700 data-[state=active]:shadow-sm rounded-lg">
            <Clock className="w-3.5 h-3.5" />
            Tiempos
          </TabsTrigger>
          <TabsTrigger value="explosion_materiales" className="flex items-center gap-2 px-4 py-2.5 text-xs font-bold uppercase tracking-tight transition-all data-[state=active]:bg-white data-[state=active]:text-indigo-700 data-[state=active]:shadow-sm rounded-lg">
            <Boxes className="w-3.5 h-3.5" />
            Explosion Materiales
          </TabsTrigger>
          <TabsTrigger value="presupuesto_semanal" className="flex items-center gap-2 px-4 py-2.5 text-xs font-bold uppercase tracking-tight transition-all data-[state=active]:bg-white data-[state=active]:text-indigo-700 data-[state=active]:shadow-sm rounded-lg">
            <CalendarRange className="w-3.5 h-3.5" />
            Presupuesto
          </TabsTrigger>
          <TabsTrigger value="material_balanceo" className="flex items-center gap-2 px-4 py-2.5 text-xs font-bold uppercase tracking-tight transition-all data-[state=active]:bg-white data-[state=active]:text-indigo-700 data-[state=active]:shadow-sm rounded-lg">
            <LayoutGrid className="w-3.5 h-3.5" />
            Mat Balanceo
          </TabsTrigger>
          <TabsTrigger value="ordenes" className="flex items-center gap-2 px-4 py-2.5 text-xs font-bold uppercase tracking-tight transition-all data-[state=active]:bg-white data-[state=active]:text-indigo-700 data-[state=active]:shadow-sm rounded-lg">
            <Package className="w-3.5 h-3.5" />
            Previsionales
          </TabsTrigger>
          <TabsTrigger value="fert" className="flex items-center gap-2 px-4 py-2.5 text-xs font-bold uppercase tracking-tight transition-all data-[state=active]:bg-white data-[state=active]:text-indigo-700 data-[state=active]:shadow-sm rounded-lg">
            <ClipboardList className="w-3.5 h-3.5" />
            Fert
          </TabsTrigger>
          <TabsTrigger value="prog_tiempos" className="flex items-center gap-2 px-4 py-2.5 text-xs font-bold uppercase tracking-tight transition-all data-[state=active]:bg-white data-[state=active]:text-indigo-700 data-[state=active]:shadow-sm rounded-lg">
            <Clock className="w-3.5 h-3.5" />
            Prog Tiempos
          </TabsTrigger>
          <TabsTrigger value="rev_cap_halb" className="flex items-center gap-2 px-4 py-2.5 text-xs font-bold uppercase tracking-tight transition-all data-[state=active]:bg-white data-[state=active]:text-indigo-700 data-[state=active]:shadow-sm rounded-lg">
            <Layers className="w-3.5 h-3.5" />
            Rev cap Halb
          </TabsTrigger>
          <TabsTrigger value="rev_capacidad" className="flex items-center gap-2 px-4 py-2.5 text-xs font-bold uppercase tracking-tight transition-all data-[state=active]:bg-white data-[state=active]:text-indigo-700 data-[state=active]:shadow-sm rounded-lg">
            <Activity className="w-3.5 h-3.5" />
            Rev Capacidad
          </TabsTrigger>
          <TabsTrigger value="plan_propuesto" className="flex items-center gap-2 px-4 py-2.5 text-xs font-bold uppercase tracking-tight transition-all data-[state=active]:bg-indigo-600 data-[state=active]:text-white data-[state=active]:shadow-md rounded-lg border border-indigo-200">
            <CheckCircle2 className="w-3.5 h-3.5" />
            Plan Propuesto
          </TabsTrigger>
          <TabsTrigger value="plan_final" className="flex items-center gap-2 px-4 py-2.5 text-xs font-bold uppercase tracking-tight transition-all data-[state=active]:bg-indigo-600 data-[state=active]:text-white data-[state=active]:shadow-md rounded-lg border border-indigo-200">
            <Layers className="w-3.5 h-3.5" />
            Plan Final
          </TabsTrigger>
          <TabsTrigger value="resumen_plan_final" className="flex items-center gap-2 px-4 py-2.5 text-xs font-bold uppercase tracking-tight transition-all data-[state=active]:bg-indigo-600 data-[state=active]:text-white data-[state=active]:shadow-md rounded-lg border border-indigo-200">
            <ClipboardCheck className="w-3.5 h-3.5" />
            Resumen Plan final
          </TabsTrigger>
        </TabsList>

        <TabsContent value="grupos">
          <Card>
            <CardHeader>
              <CardTitle>Grupos Operativos (Ensamblado)</CardTitle>
            </CardHeader>
            <CardContent>
              {isLoadingGrupos ? (
                <div className="flex justify-center py-12"><Loader2 className="w-8 h-8 animate-spin text-indigo-600" /></div>
              ) : (
                <div className="rounded-md border overflow-hidden">
                  <Table>
                    <TableHeader className="bg-gray-50">
                      <TableRow>
                        <TableHead className="w-24">Código</TableHead>
                        <TableHead>Centro</TableHead>
                        <TableHead>Nombre del Grupo</TableHead>
                        <TableHead className="text-center">Estado</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {gruposFiltrados.map((g) => {
                        const centro = resolveCentro(g.centro);
                        return (
                          <TableRow key={g.codigo_grupo}>
                            <TableCell className="font-mono font-bold text-indigo-600">{g.codigo_grupo}</TableCell>
                            <TableCell>{centro?.nombre || '-'}</TableCell>
                            <TableCell className="font-medium">{g.nombre_grupo}</TableCell>
                            <TableCell className="text-center">
                              <Badge variant={g.status === 'A' ? 'default' : 'destructive'} className={g.status === 'A' ? 'bg-green-600' : ''}>
                                {g.status === 'A' ? 'Activo' : 'Inactivo'}
                              </Badge>
                            </TableCell>
                          </TableRow>
                        );
                      })}
                    </TableBody>
                  </Table>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="restricciones">
          <Card>
            <CardHeader>
              <CardTitle>Restricciones de Producción (Ensamblado)</CardTitle>
            </CardHeader>
            <CardContent>
              {isLoadingRestricciones ? (
                <div className="flex justify-center py-12"><Loader2 className="w-8 h-8 animate-spin text-indigo-600" /></div>
              ) : (
                <div className="rounded-md border overflow-hidden">
                  <Table>
                    <TableHeader className="bg-gray-50">
                      <TableRow>
                        <TableHead>Nombre Restricción</TableHead>
                        <TableHead className="text-center">Valor</TableHead>
                        <TableHead>Grupo Asociado</TableHead>
                        <TableHead className="text-center">Estado</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {restriccionesFiltradas.map((r) => {
                        const grupo = grupos.find(g => g.codigo_grupo === r.codigo_grupo);
                        return (
                          <TableRow key={r.codigo_restriccion}>
                            <TableCell className="font-semibold text-gray-700">{r.nombre_restriccion}</TableCell>
                            <TableCell className="text-center font-mono bg-blue-50/50">{r.valor_restriccion}</TableCell>
                            <TableCell>{grupo?.nombre_grupo} ({grupo?.centro})</TableCell>
                            <TableCell className="text-center">
                              <Badge variant={r.estado === 'A' ? 'default' : 'destructive'} className={r.estado === 'A' ? 'bg-green-600' : ''}>
                                {r.estado === 'A' ? 'Activo' : 'Inactivo'}
                              </Badge>
                            </TableCell>
                          </TableRow>
                        );
                      })}
                    </TableBody>
                  </Table>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="habilidades">
          <Card>
            <CardHeader>
              <CardTitle>Habilidades OP</CardTitle>
            </CardHeader>
            <CardContent>
              <HabilidadesOpTabSection groups={grupos} restrictions={restricciones} />
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="tiempos">
          <Card>
            <CardHeader>
              <CardTitle>Tiempos de Ensamblado</CardTitle>
            </CardHeader>
            <CardContent>
              <TiemposEnsambladoTabSection />
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="explosion_materiales">
          <Card>
            <CardHeader>
              <CardTitle>Explosion Materiales</CardTitle>
              <CardDescription>Explosión de materiales por Centro+Material, vía MaestroMaterialesExplosionPaginado.</CardDescription>
            </CardHeader>
            <CardContent>
              <ExplosionMaterialesTabSection />
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="presupuesto_semanal">
          <Card>
            <CardHeader>
              <CardTitle>Presupuesto</CardTitle>
              <CardDescription>Visualización de la demanda agrupada por semanas.</CardDescription>
            </CardHeader>
            <CardContent>
              <PresupuestoProdSemanalTabSection />
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="material_balanceo">
          <Card>
            <CardHeader>
              <CardTitle>Configuración de Materiales para Balanceo</CardTitle>
              <CardDescription>Gestione los materiales habilitados y sus líneas correspondientes para los cálculos de optimización.</CardDescription>
            </CardHeader>
            <CardContent>
              <MaterialBalanceoLineasTabSection />
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="ordenes">
          <Card>
            <CardHeader>
              <CardTitle>Órdenes Previsionales</CardTitle>
            </CardHeader>
            <CardContent>
              <ProvisionalOrdersTabSection />
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="fert">
          <Card>
            <CardHeader>
              <CardTitle>Órdenes Fert</CardTitle>
            </CardHeader>
            <CardContent>
              <OrdenesFertTabSection />
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="prog_tiempos">
          <Card>
            <CardHeader>
              <CardTitle>Programación de Tiempos (Ensamblado)</CardTitle>
            </CardHeader>
            <CardContent>
              <TiemposEnsambladoTabSection 
                allowedLines={['LINEA 1', 'LINEA 2', 'LINEA 3', 'LINEA 5']} 
                allowedWorkstations={['Armado', 'Cerrado L1', 'Cerrado1 L2', 'Cerrado2 L2', 'Cerrado L3']}
                isCompact={true}
              />
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="rev_cap_halb">
          <Card>
            <CardHeader>
              <CardTitle>Rev cap Halb</CardTitle>
            </CardHeader>
            <CardContent>
              <RevCapHalbTabSection />
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="rev_capacidad">
          <Card>
            <CardHeader>
              <CardTitle>Revisión de Capacidad</CardTitle>
              <CardDescription>Resumen agregado de carga por puesto de trabajo.</CardDescription>
            </CardHeader>
            <CardContent>
              <RevCapacidadTabSection />
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="plan_propuesto">
          <Card>
            <CardHeader>
              <CardTitle>Plan de Producción Propuesto (Optimizado)</CardTitle>
              <CardDescription>Cantidades ajustadas para cumplir con los puestos objetivo por línea.</CardDescription>
            </CardHeader>
            <CardContent>
              <PlanPropuestoTabSection groups={grupos} />
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="plan_final">
          <Card>
            <CardHeader>
              <CardTitle>Plan Final</CardTitle>
              <CardDescription>Unificación de los Planes Tácticos "PFF" de Centro 1000 y 2000, filtrados por Día programación.</CardDescription>
            </CardHeader>
            <CardContent>
              <PlanFinalTabSection />
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="resumen_plan_final">
          <Card>
            <CardHeader>
              <CardTitle>Resumen Plan final</CardTitle>
              <CardDescription>Total de cantidad por Centro, Línea y Puesto trabajo, agregado a partir de "Plan Final".</CardDescription>
            </CardHeader>
            <CardContent>
              <ResumenPlanFinalTabSection />
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
};
