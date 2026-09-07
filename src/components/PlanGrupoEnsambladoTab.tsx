'use client';

import React, { useState, useEffect, useMemo } from 'react';
import { grupoService } from '@/services/grupo.service';
import { planGrupoService } from '@/services/plangrupo.service';
import { detalleTacticoService } from '@/services/detalletactico.service';
import { useAppContext } from '@/context/AppProvider';
import { Inbox, Loader2, RefreshCw, TriangleAlert } from 'lucide-react';
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import type { Grupo, PlanGrupo, DetalleTactico } from '@/types/interfaces';

// Nombre de los Grupos externos de Ensamblado cuyo PlanGrupo queremos recuperar aquí, identificado por
// el patrón de PlanGrupo.valor "Plan Táctico - Centro {Centro} {PLAN_SUFFIX}". Ensamblado es el proceso
// externo que consume Planchas Mixtas (Láminas Prensadas / Espuma) como semielaborado, y publica su
// propio plan con este sufijo — no es un plan que este módulo genere, solo se lee para consulta. Puede
// haber más de un Grupo cuyo nombre contenga "Ensamblado" (ej. por línea o turno), por eso se buscan
// TODOS. Nota: el Grupo Ensamblado también guarda otros PlanGrupo con otros sufijos (ej. "PFF") — esos
// NO se muestran aquí, solo el que coincide con PLAN_SUFFIX.
const GRUPO_ENSAMBLADO_NOMBRE = 'ensamblado';
const CENTRO_FILTRO = '1000';
const PLAN_SUFFIX = 'P1';
// Mismo sufijo sin el "- " inicial, solo para mostrarlo más limpio en textos de la UI (ej. "(P1)" en vez de "(- P1)")
const PLAN_SUFFIX_LABEL = PLAN_SUFFIX.replace(/^-\s*/, '');

const matchesGrupoNombre = (nombreGrupo: string | undefined, target: string): boolean =>
    String(nombreGrupo || '').trim().toLowerCase().includes(target);

// True si `valor` contiene el sufijo buscado como token completo (ej. "Plan Táctico - Centro 1000 - P1"
// contiene "P1"), sin importar en qué posición exacta aparece ni qué haya después. Se exige que no esté
// pegado a otro dígito/letra (límite de palabra) para no confundir "P1" con "P10"/"P11"/"PFSM1".
const valorContieneSufijo = (valor: string | undefined, sufijo: string): boolean => {
    const trimmed = String(valor || '').trim();
    return trimmed.includes(sufijo);
};

// Suma N días laborables (omite sábado y domingo) a una fecha
const addBusinessDays = (date: Date, days: number): Date => {
    const result = new Date(date);
    let remaining = days;
    while (remaining > 0) {
        result.setDate(result.getDate() + 1);
        const dayOfWeek = result.getDay();
        if (dayOfWeek !== 0 && dayOfWeek !== 6) {
            remaining--;
        }
    }
    return result;
};

const toDateKey = (date: Date): string => {
    const y = date.getFullYear();
    const m = String(date.getMonth() + 1).padStart(2, '0');
    const d = String(date.getDate()).padStart(2, '0');
    return `${y}-${m}-${d}`;
};

// Fecha objetivo del Plan Grupo de Ensamblado que nos interesa: hoy + 3 días laborables (mismo criterio
// que la fecha objetivo de la Ventana de Fabricación de Muebles/Planchas Mixtas)
const FECHA_OBJETIVO_DIAS_HABILES = 3;

export const PlanGrupoEnsambladoTab: React.FC = () => {
    const { addNotification } = useAppContext();

    const [allGrupos, setAllGrupos] = useState<Grupo[]>([]);
    const [allPlanGrupos, setAllPlanGrupos] = useState<PlanGrupo[]>([]);
    const [allDetallesTacticos, setAllDetallesTacticos] = useState<DetalleTactico[]>([]);
    const [isLoading, setIsLoading] = useState(false);

    const fetchAllData = async () => {
        setIsLoading(true);
        try {
            const [grupoRes, planGrupoRes, detalleRes] = await Promise.all([
                grupoService.getAll(),
                planGrupoService.getAll(),
                detalleTacticoService.getAll(),
            ]);
            setAllGrupos(grupoRes.data || []);
            setAllPlanGrupos(planGrupoRes.data || []);
            setAllDetallesTacticos(detalleRes.data || []);
            addNotification('success', `Plan Grupo de Ensamblado (${PLAN_SUFFIX_LABEL}) cargado correctamente.`);
        } catch (error) {
            addNotification('error', `Error al cargar Plan Grupo de Ensamblado: ${(error as Error).message}`);
        } finally {
            setIsLoading(false);
        }
    };

    useEffect(() => {
        fetchAllData();
    }, []);

    // Códigos de TODOS los Grupos cuyo nombre contiene "Ensamblado" (puede haber más de uno)
    const grupoEnsambladoIds = useMemo(
        () => new Set(allGrupos.filter(g => matchesGrupoNombre(g.nombre_grupo, GRUPO_ENSAMBLADO_NOMBRE)).map(g => g.codigo_grupo)),
        [allGrupos]
    );
    const grupoEnsambladoByCentro = useMemo(
        () => allGrupos.filter(g => grupoEnsambladoIds.has(g.codigo_grupo) && String(g.centro || '').trim() === CENTRO_FILTRO),
        [allGrupos, grupoEnsambladoIds]
    );
    const grupoEnsambladoCentroIds = useMemo(
        () => new Set(grupoEnsambladoByCentro.map(g => g.codigo_grupo)),
        [grupoEnsambladoByCentro]
    );

    // Fecha objetivo: hoy + 3 días laborables (se recalcula cada vez que se recarga el componente)
    const fechaObjetivo = useMemo(() => addBusinessDays(new Date(), FECHA_OBJETIVO_DIAS_HABILES), []);
    const fechaObjetivoKey = useMemo(() => toDateKey(fechaObjetivo), [fechaObjetivo]);

    // PlanGrupo de Ensamblado (Centro 1000) cuyo valor contiene el token "P1" Y cuya fecha objetivo
    // (fecha_inicio_plan) es exactamente hoy + 3 días laborables, ordenados del más reciente al más antiguo
    const planesEnsamblado = useMemo(() => {
        return allPlanGrupos
            .filter(p =>
                grupoEnsambladoCentroIds.has(p.codigo_grupo)
                && valorContieneSufijo(p.valor, PLAN_SUFFIX)
                //&& toDateKey(new Date(p.fecha_inicio_plan)) === fechaObjetivoKey
            )
            .sort((a, b) => new Date(b.fecha_creacion).getTime() - new Date(a.fecha_creacion).getTime());
    }, [allPlanGrupos, grupoEnsambladoCentroIds, fechaObjetivoKey]);

    // Detalles Tácticos que pertenecen a cada PlanGrupo de Ensamblado (P1)
    const detallesPorPlan = useMemo(() => {
        const map = new Map<number, DetalleTactico[]>();
        planesEnsamblado.forEach(p => map.set(p.codigo_plan_grupo, []));
        allDetallesTacticos.forEach(d => {
            if (map.has(d.codigo_plan_grupo)) {
                map.get(d.codigo_plan_grupo)!.push(d);
            }
        });
        return map;
    }, [planesEnsamblado, allDetallesTacticos]);

    const totalDetalles = useMemo(
        () => planesEnsamblado.reduce((s, p) => s + (detallesPorPlan.get(p.codigo_plan_grupo)?.length || 0), 0),
        [planesEnsamblado, detallesPorPlan]
    );

    if (isLoading && allPlanGrupos.length === 0) {
        return (
            <div className="flex flex-col items-center justify-center py-20 bg-gray-50 rounded-xl border-2 border-dashed gap-4">
                <Loader2 className="w-12 h-12 animate-spin text-indigo-600" />
                <p className="text-sm font-bold text-gray-700">Cargando Plan Grupo de Ensamblado...</p>
            </div>
        );
    }

    return (
        <div className="space-y-4">
            <div className="bg-white border border-gray-200 rounded-xl p-6 shadow-sm">
                <div className="flex items-center justify-between gap-4 flex-wrap">
                    <div>
                        <h3 className="text-sm font-bold text-gray-800 uppercase tracking-tight">Plan Grupo de Ensamblado ({PLAN_SUFFIX_LABEL})</h3>
                        <p className="text-[11px] text-gray-500 mt-1">
                            Planes de Grupo del proceso externo "Ensamblado" (patrón "Plan Táctico - Centro {CENTRO_FILTRO} {PLAN_SUFFIX}")
                            cuya fecha objetivo es hoy + {FECHA_OBJETIVO_DIAS_HABILES} días laborables ({fechaObjetivo.toLocaleDateString('es-EC', { day: '2-digit', month: '2-digit', year: 'numeric' })}),
                            que consume Planchas Mixtas (Láminas Prensadas / Espuma) como semielaborado. Solo lectura: este módulo no genera estos planes.
                        </p>
                    </div>
                    <Button
                        onClick={fetchAllData}
                        disabled={isLoading}
                        size="sm"
                        className="h-8 bg-indigo-600 hover:bg-indigo-700 text-white gap-1.5 text-xs"
                    >
                        {isLoading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <RefreshCw className="w-3.5 h-3.5" />}
                        Actualizar
                    </Button>
                </div>
            </div>

            {planesEnsamblado.length === 0 && (
                <div className="bg-amber-50 border border-amber-300 rounded-lg p-4 flex items-start gap-2">
                    <TriangleAlert className="w-4 h-4 text-amber-600 mt-0.5 shrink-0" />
                    <p className="text-xs text-amber-800">
                        Todavía no se encontró ningún Plan de Grupo de "Ensamblado" con el patrón "Plan Táctico - Centro {CENTRO_FILTRO} {PLAN_SUFFIX}"
                        con fecha objetivo {fechaObjetivo.toLocaleDateString('es-EC', { day: '2-digit', month: '2-digit', year: 'numeric' })} (hoy + {FECHA_OBJETIVO_DIAS_HABILES} días laborables).
                        El proceso externo aún no lo ha generado para esa fecha.
                    </p>
                </div>
            )}

            {planesEnsamblado.map(plan => {
                const detalles = detallesPorPlan.get(plan.codigo_plan_grupo) || [];
                return (
                    <div key={plan.codigo_plan_grupo} className="bg-white border border-gray-200 rounded-xl shadow-md overflow-hidden">
                        <div className="flex items-center justify-between px-6 py-4 bg-gradient-to-r from-slate-900 to-indigo-900">
                            <div className="flex items-center gap-2">
                                <Inbox className="w-5 h-5 text-indigo-200" />
                                <div>
                                    <h3 className="text-sm font-bold text-white uppercase tracking-wide">{plan.valor}</h3>
                                    <p className="text-[10px] text-indigo-200">
                                        Creado: {new Date(plan.fecha_creacion).toLocaleDateString('es-EC')} · Fecha del Plan: {new Date(plan.fecha_inicio_plan).toLocaleDateString('es-EC')} · Estado: {plan.estado === 'A' ? 'Activo' : 'Inactivo'}
                                    </p>
                                </div>
                            </div>
                            <span className="text-[11px] text-indigo-200 font-mono">{detalles.length} detalle(s)</span>
                        </div>
                        <div className="p-6">
                            <div className="border border-gray-300 rounded-lg overflow-auto max-h-[50vh]">
                                <Table>
                                    <TableHeader>
                                        <TableRow className="bg-gray-100 hover:bg-gray-100 border-b-2 border-gray-300 sticky top-0">
                                            <TableHead className="text-[10px] font-extrabold text-gray-600 uppercase border-r border-gray-200">Cód. Detalle</TableHead>
                                            <TableHead className="text-[10px] font-extrabold text-gray-600 uppercase border-r border-gray-200">Material</TableHead>
                                            <TableHead className="text-[10px] font-extrabold text-gray-600 uppercase text-center border-r border-gray-200">Cant. Producción Neta</TableHead>
                                            <TableHead className="text-[10px] font-extrabold text-gray-600 uppercase text-center border-r border-gray-200">Resp. Ctrl. Prod.</TableHead>
                                            <TableHead className="text-[10px] font-extrabold text-gray-600 uppercase text-center border-r border-gray-200">Clase Aprov.</TableHead>
                                            <TableHead className="text-[10px] font-extrabold text-gray-600 uppercase text-center border-r border-gray-200">Cant. Aprov.</TableHead>
                                            <TableHead className="text-[10px] font-extrabold text-gray-600 uppercase text-center">Estado</TableHead>
                                        </TableRow>
                                    </TableHeader>
                                    <TableBody>
                                        {detalles.map((d, idx) => (
                                            <TableRow key={d.codigo_detalle_tactico} className={cn("border-b border-gray-200", idx % 2 === 1 && "bg-gray-50/70")}>
                                                <TableCell className="text-[11px] font-mono text-gray-700 border-r border-gray-200">{d.codigo_detalle_tactico}</TableCell>
                                                <TableCell className="text-[11px] font-mono font-semibold text-gray-800 border-r border-gray-200">{d.codigo_material}</TableCell>
                                                <TableCell className="text-[11px] text-center font-mono font-bold text-indigo-700 border-r border-gray-200">{d.cantidad_produccion_neta}</TableCell>
                                                <TableCell className="text-[11px] text-center border-r border-gray-200">{d.resp_ctrl_prod || '—'}</TableCell>
                                                <TableCell className="text-[11px] text-center border-r border-gray-200">{d.clase_aprovisionamiento || '—'}</TableCell>
                                                <TableCell className="text-[11px] text-center border-r border-gray-200">{d.cantidad_aprovisionamiento}</TableCell>
                                                <TableCell className="text-[11px] text-center">{d.estado === 'A' ? 'Activo' : 'Inactivo'}</TableCell>
                                            </TableRow>
                                        ))}
                                        {detalles.length === 0 && (
                                            <TableRow>
                                                <TableCell colSpan={7} className="text-center py-6 text-gray-400 text-xs">
                                                    Este Plan de Grupo no tiene Detalles Tácticos guardados.
                                                </TableCell>
                                            </TableRow>
                                        )}
                                    </TableBody>
                                </Table>
                            </div>
                        </div>
                    </div>
                );
            })}

            {planesEnsamblado.length > 0 && (
                <p className="text-[11px] text-gray-400 text-right">{planesEnsamblado.length} plan(es) · {totalDetalles} detalle(s) en total</p>
            )}
        </div>
    );
};
