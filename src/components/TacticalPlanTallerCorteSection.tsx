'use client';

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { Scissors, Loader2 } from 'lucide-react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ProvisionalOrdersTallerCorteTab } from './ProvisionalOrdersTallerCorteTab';
import { TiemposTallerCorteTab } from './TiemposTallerCorteTab';
import { PlanTallerCorteTab } from './PlanTallerCorteTab';
import { grupoService } from '@/services/grupo.service';
import { restriccionService } from '@/services/restriccion.service';
import { useAppContext } from '@/context/AppProvider';
import { TALLER_CORTE_TIEMPOS_EXCEL } from '@/data/tallerCorteTiemposExcel';

// Nombre del Grupo dedicado a persistir los tiempos unitarios manuales de este módulo. Deliberadamente
// distinto al Grupo SAP "Taller de Corte" (codigo_grupo=7) que ya existe para Colchones/Bases
// (RespCtrlProd 003&004) — es un área distinta a los forros de Muebles (026) que planifica este módulo.
const GRUPO_TIEMPOS_TC_NOMBRE = 'Taller de Corte - Forros Muebles';
const GRUPO_TIEMPOS_TC_DEPARTAMENTO = 'TALLER DE CORTE FORROS MUEBLES';
const GRUPO_TIEMPOS_TC_CENTRO = '1000';
const RESTRICCION_TIEMPO_DESCRIPCION = 'Tiempo unitario de cosido (min) - Taller de Corte';

const formatDateForSQLServer = (date: Date): string => {
    const pad = (n: number) => n.toString().padStart(2, '0');
    return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())} ${pad(date.getHours())}:${pad(date.getMinutes())}:${pad(date.getSeconds())}.${date.getMilliseconds().toString().padStart(3, '0')}`;
};

/**
 * Sección de nivel superior para "Planificación Táctica Taller de Corte" — el área que fabrica todos
 * los forros de Muebles con RespCtrlProd '026' (10 cosedoras TC-COS01..TC-COS10 + TC-USN01 dedicada a
 * "TAPA T. FALSO NEGRO"/forros de proceso corto). Independiente del módulo "Planificación Táctica
 * Muebles" — no comparte estado ni Grupo SAP con él.
 */
export const TacticalPlanTallerCorteSection: React.FC = () => {
    const { addNotification } = useAppContext();
    const [mounted, setMounted] = useState(false);
    const [activeTab, setActiveTab] = useState('planTactico');

    // Materiales de forro detectados por la pestaña "PLAN TÁCTICO" (tabla inicial), reportados hacia
    // arriba para que la pestaña "Tiempos" sepa qué materiales necesitan tiempo unitario.
    const [materialesDetectados, setMaterialesDetectados] = useState<{ codigo: string; descripcion: string }[]>([]);

    // Tiempos base del Excel "KPI-TC-Temp.xlsx" (entregado por el usuario 2026-08-18) — fuente TEMPORAL
    // mientras TI integra los tiempos reales al backend (ver src/data/tallerCorteTiemposExcel.ts).
    // codigo de material -> minutos (ya convertido desde segundos).
    const excelTiemposMap = useMemo(
        () => new Map(TALLER_CORTE_TIEMPOS_EXCEL.map(e => [e.codigo, e.tiempoMin])),
        []
    );

    // Overrides manuales persistidos (Grupo + Restriccion) — codigo de material -> minutos. Tienen
    // prioridad sobre el valor del Excel cuando el usuario corrige un tiempo puntual desde la pestaña
    // "Tiempos".
    const [tiemposOverrideMap, setTiemposOverrideMap] = useState<Map<string, number>>(new Map());
    // codigo de material -> codigo_restriccion, para saber si hay que actualizar (PUT-like via save con
    // codigo_restriccion) o crear una fila nueva.
    const [restriccionIdMap, setRestriccionIdMap] = useState<Map<string, number>>(new Map());
    const [tallerCorteGrupoId, setTallerCorteGrupoId] = useState<number | null>(null);
    const [isLoadingTiempos, setIsLoadingTiempos] = useState(true);

    // Mapa EFECTIVO (el que realmente alimenta la tabla inicial/capacidad/clasificación de "grande"):
    // Excel como base, sobrescrito por cualquier override manual guardado.
    const tiemposEfectivoMap = useMemo(() => {
        const merged = new Map(excelTiemposMap);
        tiemposOverrideMap.forEach((minutos, codigo) => merged.set(codigo, minutos));
        return merged;
    }, [excelTiemposMap, tiemposOverrideMap]);

    useEffect(() => {
        setMounted(true);
    }, []);

    // Busca el Grupo dedicado a este módulo y, si existe, carga los overrides manuales ya guardados
    // (una Restriccion por material: nombre_restriccion = código, valor_restriccion = minutos). Si el
    // Grupo todavía no existe, se deja tallerCorteGrupoId=null — se crea recién al guardar el primer
    // override (ver handleGuardarTiempo), para no generar un Grupo vacío si nunca se corrige nada.
    useEffect(() => {
        if (!mounted) return;
        const cargarTiempos = async () => {
            setIsLoadingTiempos(true);
            try {
                const gruposRes = await grupoService.getAll();
                const grupo = (gruposRes.data || []).find(g => g.nombre_grupo === GRUPO_TIEMPOS_TC_NOMBRE);
                if (!grupo) {
                    setIsLoadingTiempos(false);
                    return;
                }
                setTallerCorteGrupoId(grupo.codigo_grupo);

                const restriccionesRes = await restriccionService.getAll();
                const restriccionesGrupo = (restriccionesRes.data || []).filter(r => r.codigo_grupo === grupo.codigo_grupo);
                const overrides = new Map<string, number>();
                const ids = new Map<string, number>();
                restriccionesGrupo.forEach(r => {
                    const minutos = Number(r.valor_restriccion);
                    if (!Number.isNaN(minutos)) {
                        overrides.set(r.nombre_restriccion, minutos);
                        ids.set(r.nombre_restriccion, r.codigo_restriccion);
                    }
                });
                setTiemposOverrideMap(overrides);
                setRestriccionIdMap(ids);
            } catch (error) {
                addNotification('error', `Error al cargar tiempos del Taller de Corte: ${(error as Error).message}`);
            } finally {
                setIsLoadingTiempos(false);
            }
        };
        cargarTiempos();
    }, [mounted, addNotification]);

    // Crea (la primera vez) o reutiliza el Grupo dedicado a este módulo, y guarda/actualiza el override
    // manual de un material como una fila Restriccion bajo ese Grupo.
    const handleGuardarTiempo = useCallback(async (codigo: string, descripcion: string, minutos: number) => {
        try {
            let grupoId = tallerCorteGrupoId;
            if (!grupoId) {
                const nuevoGrupo = await grupoService.save({
                    codigo_grupo: 0,
                    centro: GRUPO_TIEMPOS_TC_CENTRO,
                    nombre_grupo: GRUPO_TIEMPOS_TC_NOMBRE,
                    departamentos_mapea: GRUPO_TIEMPOS_TC_DEPARTAMENTO,
                    estado: 'A',
                } as any);
                grupoId = nuevoGrupo.data?.codigo_grupo ?? null;
                if (!grupoId) throw new Error('No se pudo crear el Grupo de persistencia del Taller de Corte.');
                setTallerCorteGrupoId(grupoId);
            }

            const codigoRestriccionExistente = restriccionIdMap.get(codigo);
            const payload: any = {
                codigo_grupo: grupoId,
                nombre_restriccion: codigo,
                valor_restriccion: String(minutos),
                descripcion: `${RESTRICCION_TIEMPO_DESCRIPCION} — ${descripcion}`,
                estado: 'A',
                usuario_modificacion: 'admin',
                fecha_modificacion: formatDateForSQLServer(new Date()),
            };
            if (codigoRestriccionExistente) payload.codigo_restriccion = codigoRestriccionExistente;

            const saved = await restriccionService.save(payload);
            const codigoRestriccion = saved.data?.codigo_restriccion ?? codigoRestriccionExistente;

            setTiemposOverrideMap(prev => new Map(prev).set(codigo, minutos));
            if (codigoRestriccion) {
                setRestriccionIdMap(prev => new Map(prev).set(codigo, codigoRestriccion));
            }
            addNotification('success', `Tiempo unitario de "${descripcion}" guardado (${minutos.toFixed(2)} min).`);
        } catch (error) {
            addNotification('error', `Error al guardar el tiempo unitario: ${(error as Error).message}`);
        }
    }, [tallerCorteGrupoId, restriccionIdMap, addNotification]);

    const handleMaterialesDetectados = useCallback((materiales: { codigo: string; descripcion: string }[]) => {
        setMaterialesDetectados(materiales);
    }, []);

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
                <Scissors className="w-6 h-6 text-gray-700" />
                <h2 className="text-2xl font-semibold text-gray-700">Programación Táctica Taller de Corte</h2>
            </div>

            <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
                <TabsList className="grid w-full grid-cols-3 gap-1 h-auto p-1 bg-muted border border-dashed border-gray-300 rounded-lg">
                    <TabsTrigger value="tiempos" className="font-bold text-blue-700 data-[state=active]:text-blue-700">
                        Tiempos
                    </TabsTrigger>
                    <TabsTrigger value="planTactico" className="font-bold text-blue-700 data-[state=active]:text-blue-700">
                        PLAN TÁCTICO
                    </TabsTrigger>
                    <TabsTrigger value="plan" className="font-bold text-blue-700 data-[state=active]:text-blue-700">
                        PLAN
                    </TabsTrigger>
                </TabsList>

                <TabsContent value="tiempos" className="mt-4">
                    <TiemposTallerCorteTab
                        materiales={materialesDetectados}
                        tiemposEfectivoMap={tiemposEfectivoMap}
                        tiemposOverrideMap={tiemposOverrideMap}
                        onGuardarTiempo={handleGuardarTiempo}
                        isLoadingTiempos={isLoadingTiempos}
                    />
                </TabsContent>

                {/* forceMount: se mantiene montada aunque no esté visible, para que su descarga de datos
                    (Órdenes Previsionales/Fert) empiece de inmediato y la pestaña "Tiempos" reciba la
                    lista de materiales detectados sin depender de que el usuario visite primero esta pestaña. */}
                <TabsContent value="planTactico" className="mt-4 data-[state=inactive]:hidden" forceMount>
                    <ProvisionalOrdersTallerCorteTab
                        tiemposManualMap={tiemposEfectivoMap}
                        onMaterialesDetectados={handleMaterialesDetectados}
                    />
                </TabsContent>

                <TabsContent value="plan" className="mt-4">
                    <PlanTallerCorteTab tiemposManualMap={tiemposEfectivoMap} />
                </TabsContent>
            </Tabs>
        </div>
    );
};
