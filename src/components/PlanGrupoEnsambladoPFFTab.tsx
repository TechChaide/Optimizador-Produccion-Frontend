'use client';

import React, { useState, useEffect, useMemo } from 'react';
import * as XLSX from 'xlsx';
import { grupoService } from '@/services/grupo.service';
import { planGrupoService } from '@/services/plangrupo.service';
import { detalleTacticoService } from '@/services/detalletactico.service';
import { serviciosService } from '@/services/servicios.service';
import { useAppContext } from '@/context/AppProvider';
import { Inbox, Loader2, RefreshCw, TriangleAlert, CalendarDays, PackageSearch, LayoutGrid, Download, FileSpreadsheet, ArrowRightCircle } from 'lucide-react';
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { cn } from '@/lib/utils';
import type { Grupo, PlanGrupo, DetalleTactico } from '@/types/interfaces';

// Nombre de los Grupos externos de Ensamblado cuyo PlanGrupo queremos recuperar aquí, identificado por
// el patrón de PlanGrupo.valor "Plan Táctico - Centro {Centro} {PLAN_SUFFIX}". A diferencia de la
// pestaña "Plan Grupo Ensamblado (P1)" (que muestra un solo plan, el de la fecha objetivo hoy + 3 días
// hábiles), aquí se listan TODOS los "PFF" guardados y el usuario escoge la fecha desde un desplegable.
const GRUPO_ENSAMBLADO_NOMBRE = 'ensamblado';
const CENTRO_FILTRO = '1000';
const PLAN_SUFFIX = '- PFF';
// Mismo sufijo sin el "- " inicial, solo para mostrarlo más limpio en textos de la UI
const PLAN_SUFFIX_LABEL = PLAN_SUFFIX.replace(/^-\s*/, '');

const matchesGrupoNombre = (nombreGrupo: string | undefined, target: string): boolean =>
    String(nombreGrupo || '').trim().toLowerCase().includes(target);

// Normaliza códigos de material para cruzar el Componente (Maestro de Materiales/Explosión) con el
// CodMaterial de Tiempos de Ensamblado, que pueden venir con distinta longitud/relleno de ceros
const normalizeMaterialCode = (code: string | number): string => {
    const codeStr = String(code).trim();
    return codeStr.slice(-8);
};

// True si `valor` contiene el sufijo buscado como token completo (ej. "Plan Táctico - Centro 1000 - PFF"
// contiene "PFF"), sin importar en qué posición exacta aparece. Se exige que no esté pegado a otro
// dígito/letra (límite de palabra) para no confundir "PFF" con otro sufijo que lo contenga como substring.
const valorContieneSufijo = (valor: string | undefined, sufijo: string): boolean => {
    const trimmed = String(valor || '').trim();
    const pattern = new RegExp(`(^|[^a-z0-9])${sufijo}([^a-z0-9]|$)`, 'i');
    return pattern.test(trimmed);
};

// Filtro de componentes para la explosión de materiales: se incluye todo componente cuya descripción
// contenga "PLANCHA", excepto los que contengan "LATEX" (ej. "PLANCHA DE LATEX" no debe incluirse)
const COMPONENTE_INCLUYE = 'plancha';
const COMPONENTE_EXCLUYE = 'latex';

export interface ComponentePlanchaAccum {
    componente: string;
    descripcion: string;
    unidad: string;
    cantidadTotal: number;
    horasRequeridas: number;
}

const toDateKey = (date: Date): string => {
    const y = date.getFullYear();
    const m = String(date.getMonth() + 1).padStart(2, '0');
    const d = String(date.getDate()).padStart(2, '0');
    return `${y}-${m}-${d}`;
};

// Resta N días laborables (omite sábado y domingo) a una fecha
const subtractBusinessDays = (date: Date, days: number): Date => {
    const result = new Date(date);
    let remaining = days;
    while (remaining > 0) {
        result.setDate(result.getDate() - 1);
        const dayOfWeek = result.getDay();
        if (dayOfWeek !== 0 && dayOfWeek !== 6) {
            remaining--;
        }
    }
    return result;
};

interface PlanGrupoEnsambladoPFFTabProps {
    // Se invoca con el resultado de la Explosión de Materiales — Componentes de Plancha (y su fecha
    // objetivo) para que el componente padre lo entregue a la pestaña "Plan Táctico PFF"
    onExplosionComplete?: (componentes: ComponentePlanchaAccum[], fechaObjetivo: string | null) => void;
    // Cambia a la pestaña "Plan Táctico PFF" (botón flotante tras calcular la explosión)
    onNavigateToPlanTacticoPFF?: () => void;
}

export const PlanGrupoEnsambladoPFFTab: React.FC<PlanGrupoEnsambladoPFFTabProps> = ({ onExplosionComplete, onNavigateToPlanTacticoPFF }) => {
    const { addNotification } = useAppContext();

    const [allGrupos, setAllGrupos] = useState<Grupo[]>([]);
    const [allPlanGrupos, setAllPlanGrupos] = useState<PlanGrupo[]>([]);
    const [allDetallesTacticos, setAllDetallesTacticos] = useState<DetalleTactico[]>([]);
    const [isLoading, setIsLoading] = useState(false);
    const [selectedDateKey, setSelectedDateKey] = useState<string | null>(null);
    const [componentesPlancha, setComponentesPlancha] = useState<ComponentePlanchaAccum[]>([]);
    const [isExplodingPlancha, setIsExplodingPlancha] = useState(false);

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

    // Códigos de TODOS los Grupos cuyo nombre contiene "Ensamblado" (puede haber más de uno), en Centro 1000
    const grupoEnsambladoCentroIds = useMemo(() => {
        const ids = new Set(allGrupos.filter(g => matchesGrupoNombre(g.nombre_grupo, GRUPO_ENSAMBLADO_NOMBRE)).map(g => g.codigo_grupo));
        return new Set(
            allGrupos.filter(g => ids.has(g.codigo_grupo) && String(g.centro || '').trim() === CENTRO_FILTRO).map(g => g.codigo_grupo)
        );
    }, [allGrupos]);

    // TODOS los PlanGrupo de Ensamblado (Centro 1000) cuyo valor contiene el token "PFF", del más
    // reciente al más antiguo por fecha objetivo (fecha_inicio_plan) y, dentro de la misma fecha, por
    // fecha de creación
    const planesPFF = useMemo(() => {
        return allPlanGrupos
            .filter(p => grupoEnsambladoCentroIds.has(p.codigo_grupo) && valorContieneSufijo(p.valor, PLAN_SUFFIX))
            .sort((a, b) => {
                const fechaDiff = new Date(b.fecha_inicio_plan).getTime() - new Date(a.fecha_inicio_plan).getTime();
                if (fechaDiff !== 0) return fechaDiff;
                return new Date(b.fecha_creacion).getTime() - new Date(a.fecha_creacion).getTime();
            });
    }, [allPlanGrupos, grupoEnsambladoCentroIds]);

    // Fechas objetivo únicas disponibles entre los planes PFF encontrados, para poblar el desplegable
    const fechasDisponibles = useMemo(() => {
        const keys = new Set(planesPFF.map(p => toDateKey(new Date(p.fecha_inicio_plan))));
        return Array.from(keys).sort((a, b) => (a < b ? 1 : a > b ? -1 : 0));
    }, [planesPFF]);

    // Fecha efectivamente seleccionada: la elegida por el usuario si sigue disponible, si no la más reciente
    const fechaSeleccionada = useMemo(() => {
        if (selectedDateKey && fechasDisponibles.includes(selectedDateKey)) return selectedDateKey;
        return fechasDisponibles[0] ?? null;
    }, [selectedDateKey, fechasDisponibles]);

    // Planes PFF que corresponden a la fecha seleccionada
    const planesDeLaFecha = useMemo(() => {
        if (!fechaSeleccionada) return [];
        return planesPFF.filter(p => toDateKey(new Date(p.fecha_inicio_plan)) === fechaSeleccionada);
    }, [planesPFF, fechaSeleccionada]);

    // Detalles Tácticos que pertenecen a cada PlanGrupo PFF de la fecha seleccionada
    const detallesPorPlan = useMemo(() => {
        const map = new Map<number, DetalleTactico[]>();
        planesDeLaFecha.forEach(p => map.set(p.codigo_plan_grupo, []));
        allDetallesTacticos.forEach(d => {
            if (map.has(d.codigo_plan_grupo)) {
                map.get(d.codigo_plan_grupo)!.push(d);
            }
        });
        return map;
    }, [planesDeLaFecha, allDetallesTacticos]);

    const totalDetalles = useMemo(
        () => planesDeLaFecha.reduce((s, p) => s + (detallesPorPlan.get(p.codigo_plan_grupo)?.length || 0), 0),
        [planesDeLaFecha, detallesPorPlan]
    );

    // Al cambiar de fecha, los resultados de la explosión anterior ya no corresponden a los materiales
    // padre mostrados arriba — se limpian para forzar un nuevo cálculo explícito
    useEffect(() => {
        setComponentesPlancha([]);
    }, [fechaSeleccionada]);

    // Explosiona (vía Maestro de Materiales) cada material padre de la fecha seleccionada y acumula
    // únicamente los componentes tipo "PLANCHA" (excluyendo los de "LATEX"), sumando la cantidad
    // necesaria de cada componente en función de la demanda (cantidad_produccion_neta) de su padre
    const handleExplosionPlancha = async () => {
        const materialDemandMap = new Map<string, number>();
        planesDeLaFecha.forEach(plan => {
            (detallesPorPlan.get(plan.codigo_plan_grupo) || []).forEach(d => {
                const material = String(d.codigo_material || '').trim();
                const cantidad = Number(d.cantidad_produccion_neta) || 0;
                if (material && cantidad > 0) {
                    materialDemandMap.set(material, (materialDemandMap.get(material) || 0) + cantidad);
                }
            });
        });

        const uniqueMaterials = Array.from(materialDemandMap.keys());
        if (uniqueMaterials.length === 0) {
            addNotification('warning', 'No hay materiales padre en esta fecha para explosionar.');
            return;
        }

        setIsExplodingPlancha(true);
        addNotification('info', `Explosionando ${uniqueMaterials.length} material(es) padre para identificar componentes de PLANCHA...`);

        try {
            // Tiempos de Ensamblado (minutos por unidad de cada componente), para calcular el tiempo
            // requerido = tiempo unitario (min) × cantidad total necesaria / 60 → horas
            const fetchTiemposUnitMinMap = async (): Promise<Map<string, number>> => {
                const tiemposMap = new Map<string, number>();
                try {
                    const tiemposExplore = await serviciosService.getTiemposEnsamblado(1, 1);
                    const totalTiempos = tiemposExplore.totalRegistros || 0;
                    if (totalTiempos > 0) {
                        const BATCH = 20000;
                        const pages = Math.ceil(totalTiempos / BATCH);
                        for (let i = 1; i <= pages; i++) {
                            const res = await serviciosService.getTiemposEnsamblado(i, BATCH);
                            if (res.data) {
                                const items = Array.isArray(res.data) ? res.data : [res.data];
                                items.forEach((item: any) => {
                                    const material = normalizeMaterialCode(item.CodMaterial || item.Material || '');
                                    const tiempo = Number(item.Tiempo_Min ?? item.Tiempo ?? 0);
                                    if (material && tiempo > 0 && !tiemposMap.has(material)) {
                                        tiemposMap.set(material, tiempo);
                                    }
                                });
                            }
                        }
                    }
                } catch (error) {
                    console.error('Error al cargar Tiempos de Ensamblado:', error);
                }
                return tiemposMap;
            };

            const [responses, tiemposUnitMinMap] = await Promise.all([
                Promise.all(uniqueMaterials.map(async (material) => {
                    try {
                        const res = await serviciosService.getMaestroMaterialesExplosion('1000', material, 1, 5000);
                        if (res && res.data) return Array.isArray(res.data) ? res.data : [res.data];
                    } catch (error) {
                        console.error(`Error en explosión del material ${material}:`, error);
                    }
                    return [] as any[];
                })),
                fetchTiemposUnitMinMap(),
            ]);

            const grouped = new Map<string, Omit<ComponentePlanchaAccum, 'horasRequeridas'>>();

            responses.forEach((components, idx) => {
                const material = uniqueMaterials[idx];
                const parentDemand = materialDemandMap.get(material) || 0;
                if (parentDemand === 0) return;

                components.forEach((comp: any) => {
                    const descripcion = String(comp.DESCRIPCION_COMPONENTE || '').trim();
                    const componente = String(comp.COMPONENTE || '').trim();
                    if (!componente) return;

                    const descripcionUpper = descripcion.toUpperCase();
                    if (!descripcionUpper.includes(COMPONENTE_INCLUYE.toUpperCase())) return;
                    if (descripcionUpper.includes(COMPONENTE_EXCLUYE.toUpperCase())) return;

                    const cantBase = Number(comp.CANTIDAD_ACUMULADA ?? comp.CANTIDAD_UNITARIA ?? 0);
                    const necesario = cantBase * parentDemand;
                    if (necesario <= 0) return;

                    const unidad = String(comp.UNIDAD || 'UN');
                    if (!grouped.has(componente)) {
                        grouped.set(componente, { componente, descripcion, unidad, cantidadTotal: 0 });
                    }
                    grouped.get(componente)!.cantidadTotal += necesario;
                });
            });

            const sorted = Array.from(grouped.values())
                .map(c => {
                    const tiempoUnitMin = tiemposUnitMinMap.get(normalizeMaterialCode(c.componente)) ?? 0;
                    return { ...c, horasRequeridas: (tiempoUnitMin * c.cantidadTotal) / 60 };
                })
                .sort((a, b) => b.cantidadTotal - a.cantidadTotal);
            setComponentesPlancha(sorted);
            onExplosionComplete?.(sorted, fechaSeleccionada);

            if (sorted.length > 0) {
                addNotification('success', `Explosión completada: ${sorted.length} componente(s) de PLANCHA identificado(s).`);
            } else {
                addNotification('warning', 'No se encontraron componentes tipo "PLANCHA" en la explosión de estos materiales.');
            }
        } catch (error) {
            console.error('Error en la explosión de materiales de Plancha:', error);
            addNotification('error', 'Error al procesar la explosión de materiales.');
        } finally {
            setIsExplodingPlancha(false);
        }
    };

    // Exporta a Excel la tabla de Explosión de Materiales — Componentes de Plancha, con el mismo formato
    // mostrado en pantalla (incluye el Tiempo Requerido calculado en la explosión)
    const exportComponentesPlanchaToExcel = () => {
        if (componentesPlancha.length === 0) return;

        const rows = componentesPlancha.map(c => ({
            'Componente': c.componente,
            'Descripción': c.descripcion,
            'Unidad': c.unidad,
            'Cantidad Total Necesaria': Number(c.cantidadTotal.toFixed(2)),
            'Tiempo Requerido (h)': Number(c.horasRequeridas.toFixed(2)),
        }));

        const worksheet = XLSX.utils.json_to_sheet(rows);
        const workbook = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(workbook, worksheet, 'Componentes Plancha');

        const fechaArchivo = new Date().toISOString().slice(0, 10);
        XLSX.writeFile(workbook, `Explosion_Materiales_Componentes_Plancha_${fechaArchivo}.xlsx`);
    };

    // Genera el archivo .txt para carga en el LSMW de SAP. Formato por línea:
    // Componente 1000 ZMOQ Cantidad Total Necesaria (entero) Fecha(DD.MM.AAAA) 1 0000
    // Se excluyen los componentes cuya cantidad redondeada sea 0. La fecha usada es 1 día LABORABLE
    // antes de la fecha objetivo del Plan Grupo (fecha seleccionada en el desplegable) — el componente
    // debe estar disponible un día laborable antes de que se necesite el material padre.
    const exportComponentesPlanchaToLSMW = () => {
        if (componentesPlancha.length === 0 || !fechaSeleccionada) return;

        const [y, m, d] = fechaSeleccionada.split('-').map(Number);
        const fechaPrevia = subtractBusinessDays(new Date(y, m - 1, d), 1);
        const fechaTexto = `${String(fechaPrevia.getDate()).padStart(2, '0')}.${String(fechaPrevia.getMonth() + 1).padStart(2, '0')}.${fechaPrevia.getFullYear()}`;

        const lines = componentesPlancha
            .map(c => ({ ...c, cantidadRedondeada: Math.round(c.cantidadTotal) }))
            .filter(c => c.cantidadRedondeada > 0)
            .map(c => `${c.componente} 1000 ZMOQ ${c.cantidadRedondeada} ${fechaTexto} 1 0000`);

        if (lines.length === 0) return;

        const blob = new Blob([lines.join('\r\n') + '\r\n'], { type: 'text/plain;charset=utf-8' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        const fechaArchivo = new Date().toISOString().slice(0, 10);
        link.href = url;
        link.download = `Componentes_Plancha_LSMW_${fechaArchivo}.txt`;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(url);
    };

    const formatFechaLabel = (key: string): string => {
        const [y, m, d] = key.split('-').map(Number);
        return new Date(y, m - 1, d).toLocaleDateString('es-EC', { weekday: 'long', day: '2-digit', month: '2-digit', year: 'numeric' });
    };

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
                            Todos los Planes de Grupo del proceso externo "Ensamblado" (patrón "Plan Táctico - Centro {CENTRO_FILTRO} {PLAN_SUFFIX}").
                            Escoja la fecha objetivo para ver su detalle. Solo lectura: este módulo no genera estos planes.
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

                {fechasDisponibles.length > 0 && (
                    <div className="flex items-center gap-2 mt-4">
                        <CalendarDays className="w-4 h-4 text-gray-400 shrink-0" />
                        <span className="text-[11px] font-bold text-gray-600 uppercase shrink-0">Fecha objetivo:</span>
                        <Select value={fechaSeleccionada ?? undefined} onValueChange={setSelectedDateKey}>
                            <SelectTrigger className="h-8 w-[280px] text-xs">
                                <SelectValue placeholder="Seleccione una fecha" />
                            </SelectTrigger>
                            <SelectContent>
                                {fechasDisponibles.map(key => (
                                    <SelectItem key={key} value={key} className="text-xs capitalize">
                                        {formatFechaLabel(key)}
                                    </SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                        <span className="text-[11px] text-gray-400">{fechasDisponibles.length} fecha(s) con plan guardado</span>
                    </div>
                )}
            </div>

            {planesPFF.length === 0 && (
                <div className="bg-amber-50 border border-amber-300 rounded-lg p-4 flex items-start gap-2">
                    <TriangleAlert className="w-4 h-4 text-amber-600 mt-0.5 shrink-0" />
                    <p className="text-xs text-amber-800">
                        Todavía no se encontró ningún Plan de Grupo de "Ensamblado" con el patrón "Plan Táctico - Centro {CENTRO_FILTRO} {PLAN_SUFFIX}".
                        El proceso externo aún no lo ha generado.
                    </p>
                </div>
            )}

            {planesDeLaFecha.map(plan => {
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

            {planesDeLaFecha.length > 0 && (
                <p className="text-[11px] text-gray-400 text-right">{planesDeLaFecha.length} plan(es) · {totalDetalles} detalle(s) en la fecha seleccionada</p>
            )}

            {planesDeLaFecha.length > 0 && (
                <div className="bg-white border border-gray-200 rounded-xl shadow-md overflow-hidden">
                    <div className="flex items-center justify-between gap-4 flex-wrap px-6 py-4 bg-gradient-to-r from-slate-900 to-orange-900">
                        <div className="flex items-center gap-2">
                            <LayoutGrid className="w-5 h-5 text-orange-200" />
                            <div>
                                <h3 className="text-sm font-bold text-white uppercase tracking-wide">Explosión de Materiales — Componentes de Plancha</h3>
                                <p className="text-[10px] text-orange-200">
                                    Componentes con "PLANCHA" en la descripción (excluye "LATEX"), explosionados desde los materiales
                                    padre de la fecha seleccionada.
                                </p>
                            </div>
                        </div>
                        <div className="flex items-center gap-2 shrink-0">
                            <Button
                                onClick={exportComponentesPlanchaToLSMW}
                                disabled={componentesPlancha.length === 0}
                                size="sm"
                                className="h-8 bg-white/10 hover:bg-white/20 text-white gap-1.5 text-xs"
                            >
                                <Download className="w-3.5 h-3.5" />
                                Descargar .txt LSMW
                            </Button>
                            <Button
                                onClick={exportComponentesPlanchaToExcel}
                                disabled={componentesPlancha.length === 0}
                                size="sm"
                                className="h-8 bg-white/10 hover:bg-white/20 text-white gap-1.5 text-xs"
                            >
                                <FileSpreadsheet className="w-3.5 h-3.5" />
                                Exportar a Excel
                            </Button>
                            <Button
                                onClick={handleExplosionPlancha}
                                disabled={isExplodingPlancha}
                                size="sm"
                                className="h-8 bg-orange-600 hover:bg-orange-700 text-white gap-1.5 text-xs"
                            >
                                {isExplodingPlancha ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <PackageSearch className="w-3.5 h-3.5" />}
                                Explosión de Materiales
                            </Button>
                        </div>
                    </div>
                    <div className="p-6">
                        <div className="border border-gray-300 rounded-lg overflow-auto max-h-[50vh]">
                            <Table>
                                <TableHeader>
                                    <TableRow className="bg-gray-100 hover:bg-gray-100 border-b-2 border-gray-300 sticky top-0">
                                        <TableHead className="text-[10px] font-extrabold text-gray-600 uppercase border-r border-gray-200">Componente</TableHead>
                                        <TableHead className="text-[10px] font-extrabold text-gray-600 uppercase border-r border-gray-200">Descripción</TableHead>
                                        <TableHead className="text-[10px] font-extrabold text-gray-600 uppercase text-center border-r border-gray-200">Unidad</TableHead>
                                        <TableHead className="text-[10px] font-extrabold text-gray-600 uppercase text-center border-r border-gray-200">Cantidad Total Necesaria</TableHead>
                                        <TableHead className="text-[10px] font-extrabold text-gray-600 uppercase text-center">Tiempo Requerido (h)</TableHead>
                                    </TableRow>
                                </TableHeader>
                                <TableBody>
                                    {componentesPlancha.map((c, idx) => (
                                        <TableRow key={c.componente} className={cn("border-b border-gray-200", idx % 2 === 1 && "bg-gray-50/70")}>
                                            <TableCell className="text-[11px] font-mono font-semibold text-gray-800 border-r border-gray-200">{c.componente}</TableCell>
                                            <TableCell className="text-[11px] text-gray-700 border-r border-gray-200">{c.descripcion}</TableCell>
                                            <TableCell className="text-[11px] text-center text-gray-600 border-r border-gray-200">{c.unidad}</TableCell>
                                            <TableCell className="text-[11px] text-center font-mono font-bold text-orange-700 border-r border-gray-200">
                                                {c.cantidadTotal.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                            </TableCell>
                                            <TableCell className="text-[11px] text-center font-mono font-bold text-gray-700">
                                                {c.horasRequeridas.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                            </TableCell>
                                        </TableRow>
                                    ))}
                                    {componentesPlancha.length === 0 && (
                                        <TableRow>
                                            <TableCell colSpan={5} className="text-center py-6 text-gray-400 text-xs">
                                                Presione "Explosión de Materiales" para calcular los componentes de Plancha de esta fecha.
                                            </TableCell>
                                        </TableRow>
                                    )}
                                </TableBody>
                            </Table>
                        </div>
                    </div>
                </div>
            )}

            {componentesPlancha.length > 0 && (
                <button
                    type="button"
                    onClick={onNavigateToPlanTacticoPFF}
                    title="Ir a Plan Táctico PFF con estos Componentes de Plancha"
                    className="fixed bottom-6 right-6 z-50 flex items-center gap-2 bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-sm px-5 py-3.5 rounded-full shadow-xl shadow-indigo-900/30 transition-colors"
                >
                    <ArrowRightCircle className="w-5 h-5" />
                    Ir a Plan Táctico PFF
                </button>
            )}
        </div>
    );
};
