'use client';

import React, { useState, useEffect, useMemo } from 'react';
import { grupoService } from '@/services/grupo.service';
import { planGrupoService } from '@/services/plangrupo.service';
import { detalleTacticoService } from '@/services/detalletactico.service';
import { restriccionService } from '@/services/restriccion.service';
import { serviciosService } from '@/services/servicios.service';
import { useAppContext } from '@/context/AppProvider';
import { Inbox, Loader2, RefreshCw, TriangleAlert, Search, CheckCircle2, X, ArrowRight } from 'lucide-react';
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { cn } from '@/lib/utils';
import type { Grupo, PlanGrupo, DetalleTactico, Restriccion } from '@/types/interfaces';

// Nombre del Grupo cuyo proceso externo procesa nuestras entradas (Plan Táctico Muebles) y devuelve,
// como respuesta, cuánto puede producir "Corte y Laminado" — identificado por el patrón de PlanGrupo.valor
// "Plan Táctico - Centro {Centro} - P3".
const GRUPO_RESPUESTA_NOMBRE = 'corte y laminado';
const GRUPO_PROPIO_NOMBRE = 'muebles';
const CENTRO_INVESTIGACION = '1000';
// Tolerancia (en unidades) para considerar que hay déficit real entre lo propio (P2) y lo respondido (P3),
// evita marcar como déficit diferencias de redondeo insignificantes
const TOLERANCIA_DEFICIT = 0.01;

const matchesGrupoNombre = (nombreGrupo: string | undefined, target: string): boolean =>
    String(nombreGrupo || '').trim().toLowerCase().includes(target);

// Extrae el sufijo "P<n>" de un valor de PlanGrupo, ej. "Plan Táctico - Centro 1000 - P3" -> "P3". Busca un
// segmento (separado por " - ") que sea EXACTAMENTE "P<dígitos>", empezando por el final, en vez de exigir
// que "P3" sea literalmente el último token: "Corte y Laminado" empezó (2026-09-04) a agregar una categoría
// después del sufijo (ej. "Plan Táctico - Centro 1000 - P3 - Espuma", "... - P2 - Rollos") y el ancla al
// final de cadena (`$`) dejaba de matchear esos casos — el Plan de Respuesta existía en la base pero
// "Plan Grupo Recuperado" lo mostraba como si no hubiera llegado ninguno. Sigue sin matchear "P1.3"/"P1.5"
// (el segmento completo no es solo dígitos), que es el comportamiento ya esperado por el resto del archivo.
const extractPlanSuffix = (valor: string | undefined): string | null => {
    const segmentos = String(valor || '').split('-').map(s => s.trim());
    for (let i = segmentos.length - 1; i >= 0; i--) {
        const match = segmentos[i].match(/^P(\d+)$/i);
        if (match) return `P${match[1]}`;
    }
    return null;
};

const normalizeMaterialCode = (code: string | number): string => {
    const codeStr = String(code).trim();
    return codeStr.slice(-8);
};

const parseERPDateOnly = (value: string): Date | null => {
    const parts = String(value).trim().split('-');
    if (parts.length !== 3) return null;
    const [y, m, d] = parts.map(Number);
    if (!y || !m || !d) return null;
    return new Date(y, m - 1, d);
};

// Formatea fecha_creacion de un PlanGrupo, mostrando "—" cuando viene vacía/nula en vez del 31/12/1969
// que resulta de "new Date(null)" (equivale al epoch Unix, que en Ecuador cae un día antes por el UTC-5)
// — el proceso externo "Corte y Laminado" no siempre guarda esta fecha en su PlanGrupo de respuesta.
const formatFechaCreacion = (fechaCreacion: Date | string | null | undefined): string => {
    if (!fechaCreacion) return '—';
    const fecha = new Date(fechaCreacion);
    if (Number.isNaN(fecha.getTime()) || fecha.getTime() === 0) return '—';
    return fecha.toLocaleDateString('es-EC');
};

const toDateKey = (date: Date): string => {
    const y = date.getFullYear();
    const m = String(date.getMonth() + 1).padStart(2, '0');
    const d = String(date.getDate()).padStart(2, '0');
    return `${y}-${m}-${d}`;
};

// Funciones puras (no dependen de closures de estado de React) para derivar los Responsables de Control
// de Producción de un Grupo y los mapas de Pendientes Totales, a partir de datos recién descargados —
// se usan dentro de handleInvestigar con los datos que ACABA de devolver ensureSupportData, nunca con el
// estado del componente directamente, para evitar el bug de closure obsoleto (ver comentario en handleInvestigar).
const computeValidRespCodes = (restricciones: Restriccion[], grupoIds: Set<number>): string[] => {
    const respRestriccion = restricciones.find(r => r.nombre_restriccion === 'RespCtrlProd' && grupoIds.has(r.codigo_grupo));
    if (!respRestriccion || !respRestriccion.valor_restriccion) return [];
    return respRestriccion.valor_restriccion.split(/[&,]/).map(c => String(c).trim()).filter(Boolean);
};

const buildPendientesMaps = (pendientesRaw: any[]) => {
    const destinatarioMap = new Map<string, string>();
    const fechaByPosition = new Map<string, string>();
    pendientesRaw.forEach((item: any) => {
        const pedido = String(item.PEDIDO || '').trim();
        if (!pedido) return;

        const destinatario = String(item.DESTINATARIO_MERCADERIA || item.NOMBRE || '').trim();
        if (destinatario && !destinatarioMap.has(pedido)) {
            destinatarioMap.set(pedido, destinatario);
            destinatarioMap.set(pedido.replace(/^0+/, ''), destinatario);
        }

        const posicionNum = Number(item.POSICION);
        const dia = String(item.DIAENTREGA || '').padStart(2, '0');
        const mes = String(item.MESENTREGA || '').padStart(2, '0');
        const anio = String(item.ANIOENTREGA || '');
        if (dia === '00' || mes === '00' || !anio || Number.isNaN(posicionNum)) return;
        const formatted = `${dia}-${mes}-${anio}`;
        fechaByPosition.set(`${pedido}|${posicionNum}`, formatted);
        fechaByPosition.set(`${pedido.replace(/^0+/, '')}|${posicionNum}`, formatted);
    });
    return { destinatarioMap, fechaByPosition };
};

// Orden padre (Previsional o Fert) que consume, como componente, el material objetivo en déficit
interface ParentOrderRow {
    id: string;
    source: 'Previsional' | 'Fert';
    pedido: string;
    posicion: string;
    material: string;
    nombre: string;
    tipo: 'MTO' | 'MTS';
    cantidad: number;
    // Fecha propia de la orden en el ERP (FECHAINICIO en Previsionales, FECHA en Fert) — a diferencia de
    // "fechaEntrega" (solo aplica a MTO, viene de Pendientes Totales), esta SIEMPRE tiene valor
    fechaPropia: string;
    fechaEntrega: string;
    cliente: string;
    // Cuánto del material objetivo consume esta orden padre específica (cantidad acumulada del BOM × cantidad de la orden)
    consumoComponente: number;
}

interface InvestigacionState {
    materialObjetivo: string;
    cantidadPropia: number;
    cantidadRespuesta: number;
    fechaTarget: Date;
    isLoading: boolean;
    ordenes: ParentOrderRow[];
}

interface PlanGrupoRecuperadoTabProps {
    // Lleva al usuario a la pestaña "PLAN TÁCTICO" y dispara "Actualizar Datos" allí, para generar el
    // PASO 3 (Final) — se ofrece cuando "Corte y Laminado" ya respondió sin déficit y no hace falta
    // mover ninguna orden en SAP antes de avanzar.
    onIrAPasoFinal?: () => void;
}

export const PlanGrupoRecuperadoTab: React.FC<PlanGrupoRecuperadoTabProps> = ({ onIrAPasoFinal }) => {
    const { addNotification } = useAppContext();

    const [allGrupos, setAllGrupos] = useState<Grupo[]>([]);
    const [allPlanGrupos, setAllPlanGrupos] = useState<PlanGrupo[]>([]);
    const [allDetallesTacticos, setAllDetallesTacticos] = useState<DetalleTactico[]>([]);
    const [isLoading, setIsLoading] = useState(false);

    // Datos de soporte para la investigación de órdenes padre (Previsional/Fert/Pendientes/Restricciones),
    // cargados de forma perezosa solo la primera vez que se investiga un déficit, no en el fetch inicial
    const [allPrevisionalRaw, setAllPrevisionalRaw] = useState<any[]>([]);
    const [allFertRaw, setAllFertRaw] = useState<any[]>([]);
    const [pendientesRaw, setPendientesRaw] = useState<any[]>([]);
    const [allRestricciones, setAllRestricciones] = useState<Restriccion[]>([]);
    const [supportDataLoaded, setSupportDataLoaded] = useState(false);
    const [isLoadingSupportData, setIsLoadingSupportData] = useState(false);

    const [investigacion, setInvestigacion] = useState<InvestigacionState | null>(null);
    const [movidas, setMovidas] = useState<Set<string>>(new Set());

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
            addNotification('success', 'Datos de Plan Grupo Recuperado cargados correctamente.');
        } catch (error) {
            addNotification('error', `Error al cargar Plan Grupo Recuperado: ${(error as Error).message}`);
        } finally {
            setIsLoading(false);
        }
    };

    useEffect(() => {
        fetchAllData();
    }, []);

    // Códigos de Grupo "Corte y Laminado" (puede haber uno por Centro, ej. Quito y Guayaquil)
    const grupoRespuestaIds = useMemo(
        () => new Set(allGrupos.filter(g => matchesGrupoNombre(g.nombre_grupo, GRUPO_RESPUESTA_NOMBRE)).map(g => g.codigo_grupo)),
        [allGrupos]
    );

    // Códigos de Grupo "Muebles" (nuestras propias entradas)
    const grupoPropioIds = useMemo(
        () => new Set(allGrupos.filter(g => matchesGrupoNombre(g.nombre_grupo, GRUPO_PROPIO_NOMBRE)).map(g => g.codigo_grupo)),
        [allGrupos]
    );

    // Planes de RESPUESTA: PlanGrupo de "Corte y Laminado" cuyo valor termina en "- P3"
    const planesRespuesta = useMemo(() => {
        return allPlanGrupos.filter(p => grupoRespuestaIds.has(p.codigo_grupo) && extractPlanSuffix(p.valor) === 'P3');
    }, [allPlanGrupos, grupoRespuestaIds]);
    const planesRespuestaIds = useMemo(() => new Set(planesRespuesta.map(p => p.codigo_plan_grupo)), [planesRespuesta]);

    // Planes PROPIOS: PlanGrupo de "Muebles" cuyo valor termina en "- P2" (los que yo generé al Guardar Plan Táctico)
    const planesPropios = useMemo(() => {
        return allPlanGrupos.filter(p => grupoPropioIds.has(p.codigo_grupo) && extractPlanSuffix(p.valor) === 'P2');
    }, [allPlanGrupos, grupoPropioIds]);
    const planesPropiosIds = useMemo(() => new Set(planesPropios.map(p => p.codigo_plan_grupo)), [planesPropios]);
    const planesPropiosById = useMemo(() => new Map(planesPropios.map(p => [p.codigo_plan_grupo, p])), [planesPropios]);

    // Detalles Tácticos de RESPUESTA: pertenecen a un plan de respuesta (Corte y Laminado - P3) Y cuyo
    // codigo_plan_grupo_padre apunta a alguno de mis propios planes (Muebles - P2)
    const detallesRecuperados = useMemo(() => {
        return allDetallesTacticos.filter(d =>
            planesRespuestaIds.has(d.codigo_plan_grupo) &&
            d.codigo_plan_grupo_padre != null &&
            planesPropiosIds.has(d.codigo_plan_grupo_padre)
        );
    }, [allDetallesTacticos, planesRespuestaIds, planesPropiosIds]);

    // Para cada Detalle recuperado, busca el Detalle PROPIO (P2) del mismo material dentro del mismo plan
    // padre, y calcula el déficit: cuánto pidió Muebles (P2) vs. cuánto puede fabricar Corte y Laminado (P3)
    const detalleDeficitMap = useMemo(() => {
        const map = new Map<number, { cantidadPropia: number; cantidadRespuesta: number; deficit: number }>();
        detallesRecuperados.forEach(d => {
            const detallePropio = allDetallesTacticos.find(x =>
                x.codigo_plan_grupo === d.codigo_plan_grupo_padre && x.codigo_material === d.codigo_material
            );
            const cantidadPropia = Number(detallePropio?.cantidad_produccion_neta) || 0;
            const cantidadRespuesta = Number(d.cantidad_produccion_neta) || 0;
            map.set(d.codigo_detalle_tactico, { cantidadPropia, cantidadRespuesta, deficit: cantidadPropia - cantidadRespuesta });
        });
        return map;
    }, [detallesRecuperados, allDetallesTacticos]);

    // Carga (una sola vez, perezosamente) los datos necesarios para investigar órdenes padre: Previsional
    // Alpha, Fert, Pendientes Totales y Restricciones — no se cargan en el fetch inicial de esta pestaña
    // porque son pesados y solo se necesitan si el usuario realmente investiga un déficit.
    // Devuelve SIEMPRE los datos recién descargados (o los ya cacheados en estado, si supportDataLoaded).
    // Importante: handleInvestigar usa el valor DEVUELTO por esta función, nunca lee allPrevisionalRaw/
    // allFertRaw/pendientesRaw/allRestricciones directamente del estado del componente — si lo hiciera,
    // en la primera invocación (cuando supportDataLoaded todavía es false al empezar) esas variables
    // seguirían siendo los arreglos vacíos que existían en el momento en que se creó/llamó la función,
    // porque los setState de abajo solo se reflejan en el PRÓXIMO render, no en esta ejecución en curso
    // (closure obsoleto/stale closure de React) — eso hacía que la investigación siempre devolviera 0
    // resultados en el primer intento, aunque sí existieran órdenes que consumen el material.
    const ensureSupportData = async (): Promise<{
        previsional: any[];
        fert: any[];
        pendientes: any[];
        restricciones: Restriccion[];
    } | null> => {
        if (supportDataLoaded) {
            return { previsional: allPrevisionalRaw, fert: allFertRaw, pendientes: pendientesRaw, restricciones: allRestricciones };
        }

        setIsLoadingSupportData(true);
        try {
            const BATCH = 20000;

            const provExplore = await serviciosService.getOrdenesProvisionalesAlphaPaginados(1, 1);
            const totalProv = provExplore.totalRegistros || 0;
            let combinedProv: any[] = [];
            if (totalProv > 0) {
                const pages = Math.ceil(totalProv / BATCH);
                for (let i = 1; i <= pages; i++) {
                    const res = await serviciosService.getOrdenesProvisionalesAlphaPaginados(i, BATCH);
                    if (res.data) combinedProv = combinedProv.concat(Array.isArray(res.data) ? res.data : [res.data]);
                }
            }

            const fertExplore = await serviciosService.getOrdenesFert(1, 1);
            const totalFert = fertExplore.totalRegistros || 0;
            let combinedFert: any[] = [];
            if (totalFert > 0) {
                const pages = Math.ceil(totalFert / BATCH);
                for (let i = 1; i <= pages; i++) {
                    const res = await serviciosService.getOrdenesFert(i, BATCH);
                    if (res.data) combinedFert = combinedFert.concat(Array.isArray(res.data) ? res.data : [res.data]);
                }
            }

            const pendExplore = await serviciosService.getPendientesTotales(1, 1);
            const totalPend = pendExplore.totalRegistros || 0;
            let combinedPend: any[] = [];
            if (totalPend > 0) {
                const pages = Math.ceil(totalPend / BATCH);
                for (let i = 1; i <= pages; i++) {
                    const res = await serviciosService.getPendientesTotales(i, BATCH);
                    if (res.data) combinedPend = combinedPend.concat(Array.isArray(res.data) ? res.data : [res.data]);
                }
            }

            const restriccionesRes = await restriccionService.getAll();
            const combinedRestricciones = restriccionesRes.data || [];

            setAllPrevisionalRaw(combinedProv);
            setAllFertRaw(combinedFert);
            setPendientesRaw(combinedPend);
            setAllRestricciones(combinedRestricciones);
            setSupportDataLoaded(true);

            return { previsional: combinedProv, fert: combinedFert, pendientes: combinedPend, restricciones: combinedRestricciones };
        } catch (error) {
            addNotification('error', `Error al cargar datos de soporte para la investigación: ${(error as Error).message}`);
            return null;
        } finally {
            setIsLoadingSupportData(false);
        }
    };

    // Investiga qué órdenes padre (Previsional o Fert, MTO o MTS, Muebles, con fecha propia igual o
    // ANTERIOR a la fecha del plan) usan el material en déficit como componente, y cuánto consume cada
    // una — para que el usuario pueda escoger cuáles mover a otro día y así reducir la Cantidad Neta
    // Requerida hasta la capacidad que realmente puede fabricar Corte y Laminado (Plan Respuesta P3).
    //
    // Se incluye "fecha propia <= fecha del plan" (no solo "=") porque el cálculo original de la Cantidad
    // Neta Requerida no solo tomó órdenes con fecha propia exacta de ese día: también incluyó órdenes MTS
    // más antiguas usadas para llenar capacidad sobrante (ordenadas por antigüedad). Esa composición
    // exacta no queda persistida en ningún lado (solo se guardó el total agregado por material), así que
    // esta es una aproximación — la suma de "Consumo del Componente" puede no calzar exactamente con la
    // Cantidad Neta Requerida original, pero da un universo razonable de candidatas a mover.
    const handleInvestigar = async (materialObjetivo: string, cantidadPropia: number, cantidadRespuesta: number, fechaTarget: Date) => {
        setMovidas(new Set());
        setInvestigacion({ materialObjetivo, cantidadPropia, cantidadRespuesta, fechaTarget, isLoading: true, ordenes: [] });

        const supportData = await ensureSupportData();
        if (!supportData) {
            setInvestigacion(null);
            return;
        }
        const { previsional, fert, pendientes, restricciones } = supportData;
        const validRespCodesLocal = computeValidRespCodes(restricciones, grupoPropioIds);
        const pendientesMapsLocal = buildPendientesMaps(pendientes);

        if (validRespCodesLocal.length === 0) {
            addNotification('error', 'No se encontró la restricción "RespCtrlProd" del Grupo Muebles. No se puede determinar qué órdenes son propias.');
            setInvestigacion(prev => prev ? { ...prev, isLoading: false } : null);
            return;
        }

        try {
            const targetKey = toDateKey(fechaTarget);

            const provOrders = previsional.filter((row: any) => {
                if (!validRespCodesLocal.includes(String(row.RESPCONTROLPROD || '').trim())) return false;
                if (String(row.Centro || '').trim() !== CENTRO_INVESTIGACION) return false;
                const fecha = row.FECHAINICIO ? parseERPDateOnly(row.FECHAINICIO) : null;
                return !!fecha && toDateKey(fecha) <= targetKey && (Number(row.CANTIDAD) || 0) > 0;
            });

            const fertOrders = fert.filter((row: any) => {
                if (!validRespCodesLocal.includes(String(row.RESPCTRLPROD || '').trim())) return false;
                if (String(row.CENTRO || '').trim() !== CENTRO_INVESTIGACION) return false;
                const fecha = row.FECHA ? parseERPDateOnly(row.FECHA) : null;
                return !!fecha && toDateKey(fecha) <= targetKey && (Number(row.CANTPENDIENTE) || 0) > 0;
            });

            const uniqueMaterials = Array.from(new Set([
                ...provOrders.map((r: any) => normalizeMaterialCode(r.MATERIAL || r.CodMaterial || '')),
                ...fertOrders.map((r: any) => normalizeMaterialCode(r.MATERIAL || '')),
            ])).filter(Boolean);

            if (uniqueMaterials.length === 0) {
                addNotification('warning', `No se encontraron órdenes de Muebles con fecha ${targetKey} para investigar.`);
                setInvestigacion(prev => prev ? { ...prev, isLoading: false } : null);
                return;
            }

            addNotification('info', `Investigando ${uniqueMaterials.length} material(es) único(s) de la fecha ${targetKey}...`);

            const responses = await Promise.all(uniqueMaterials.map(async (material) => {
                try {
                    const res = await serviciosService.getMaestroMaterialesExplosion(CENTRO_INVESTIGACION, material, 1, 5000);
                    if (res && res.data) return Array.isArray(res.data) ? res.data : [res.data];
                } catch (error) {
                    console.error(`Error en explosión del material ${material}:`, error);
                }
                return [] as any[];
            }));
            const explosionByMaterial = new Map<string, any[]>(uniqueMaterials.map((m, idx) => [m, responses[idx] || []]));

            const rows: ParentOrderRow[] = [];

            provOrders.forEach((row: any) => {
                const material = normalizeMaterialCode(row.MATERIAL || row.CodMaterial || '');
                const components = explosionByMaterial.get(material) || [];
                const match = components.find((c: any) => normalizeMaterialCode(c.COMPONENTE) === materialObjetivo);
                if (!match) return;

                const cantBase = Number(match.CANTIDAD_ACUMULADA ?? match.CANTIDAD_UNITARIA ?? 0);
                const cantidad = Number(row.CANTIDAD) || 0;
                const consumoComponente = cantBase * cantidad;
                if (consumoComponente <= 0) return;

                const pedido = String(row.PEDIDOVENTAS || '').trim();
                const posicion = String(row.POSICIONPEDIDO || '').trim();
                const tipo: 'MTO' | 'MTS' = pedido ? 'MTO' : 'MTS';
                const fechaEntrega = pedido
                    ? (pendientesMapsLocal.fechaByPosition.get(`${pedido}|${Number(posicion)}`)
                        || pendientesMapsLocal.fechaByPosition.get(`${pedido.replace(/^0+/, '')}|${Number(posicion)}`)
                        || '—')
                    : '—';
                const cliente = pedido
                    ? (pendientesMapsLocal.destinatarioMap.get(pedido) || pendientesMapsLocal.destinatarioMap.get(pedido.replace(/^0+/, '')) || 'Cliente no identificado')
                    : '—';

                rows.push({
                    id: String(row.ORDENPREVISIONAL || ''),
                    source: 'Previsional',
                    pedido: pedido || '—',
                    posicion: posicion || '—',
                    material,
                    nombre: String(row.NOMBRE || '').trim(),
                    tipo,
                    cantidad,
                    fechaPropia: String(row.FECHAINICIO || '').trim() || '—',
                    fechaEntrega,
                    cliente,
                    consumoComponente,
                });
            });

            fertOrders.forEach((row: any) => {
                const material = normalizeMaterialCode(row.MATERIAL || '');
                const components = explosionByMaterial.get(material) || [];
                const match = components.find((c: any) => normalizeMaterialCode(c.COMPONENTE) === materialObjetivo);
                if (!match) return;

                const cantBase = Number(match.CANTIDAD_ACUMULADA ?? match.CANTIDAD_UNITARIA ?? 0);
                const cantidad = Number(row.CANTPENDIENTE) || 0;
                const consumoComponente = cantBase * cantidad;
                if (consumoComponente <= 0) return;

                const pedido = String(row.PEDIDO || '').trim();
                const posicion = String(row.POSICION || '').trim();
                const tipo: 'MTO' | 'MTS' = pedido ? 'MTO' : 'MTS';
                const fechaEntrega = pedido
                    ? (pendientesMapsLocal.fechaByPosition.get(`${pedido}|${Number(posicion)}`)
                        || pendientesMapsLocal.fechaByPosition.get(`${pedido.replace(/^0+/, '')}|${Number(posicion)}`)
                        || '—')
                    : '—';
                const cliente = pedido
                    ? (pendientesMapsLocal.destinatarioMap.get(pedido) || pendientesMapsLocal.destinatarioMap.get(pedido.replace(/^0+/, '')) || 'Cliente no identificado')
                    : '—';

                rows.push({
                    id: String(row.ORDEN || ''),
                    source: 'Fert',
                    pedido: pedido || '—',
                    posicion: posicion || '—',
                    material,
                    nombre: String(row.NOMBRE || '').trim(),
                    tipo,
                    cantidad,
                    fechaPropia: String(row.FECHA || '').trim() || '—',
                    fechaEntrega,
                    cliente,
                    consumoComponente,
                });
            });

            rows.sort((a, b) => b.consumoComponente - a.consumoComponente);

            setInvestigacion(prev => prev ? { ...prev, isLoading: false, ordenes: rows } : null);
            if (rows.length === 0) {
                addNotification('warning', `No se encontró ninguna orden padre que consuma el material ${materialObjetivo} en la fecha ${targetKey}.`);
            } else {
                addNotification('success', `${rows.length} orden(es) padre encontrada(s) que consumen el material ${materialObjetivo}.`);
            }
        } catch (error) {
            addNotification('error', `Error al investigar órdenes padre: ${(error as Error).message}`);
            setInvestigacion(prev => prev ? { ...prev, isLoading: false } : null);
        }
    };

    const toggleMovida = (id: string) => {
        setMovidas(prev => {
            const next = new Set(prev);
            if (next.has(id)) next.delete(id);
            else next.add(id);
            return next;
        });
    };

    // True cuando ya hay al menos un Detalle Recuperado y NINGUNO tiene déficit real: "Corte y Laminado"
    // cubrió por completo lo pedido en el Plan Propio (P2), así que no hace falta investigar ni mover
    // nada en SAP — se puede avanzar directamente al Paso 3 (Final).
    const todoResueltoSinDeficit = useMemo(() => {
        if (detallesRecuperados.length === 0) return false;
        return detallesRecuperados.every(d => {
            const info = detalleDeficitMap.get(d.codigo_detalle_tactico);
            return !info || info.deficit <= TOLERANCIA_DEFICIT;
        });
    }, [detallesRecuperados, detalleDeficitMap]);

    // Cuántos Detalles Recuperados sí quedaron con déficit real (para el banner/botón de confirmación
    // manual: el usuario puede revisar/investigar cada uno con "Investigar", pero también puede optar por
    // continuar a Paso 3 de todos modos sin haber resuelto el déficit por completo — decisión suya, no del
    // sistema, 2026-09-04).
    const detallesConDeficit = useMemo(() => {
        return detallesRecuperados.filter(d => {
            const info = detalleDeficitMap.get(d.codigo_detalle_tactico);
            return !!info && info.deficit > TOLERANCIA_DEFICIT;
        }).length;
    }, [detallesRecuperados, detalleDeficitMap]);

    // Resumen en vivo: cuánto se libera al mover las órdenes marcadas, y la utilización resultante contra
    // la capacidad ofrecida por Corte y Laminado (Plan Respuesta P3)
    const resumenInvestigacion = useMemo(() => {
        if (!investigacion) return null;
        const consumoMovido = investigacion.ordenes
            .filter(o => movidas.has(`${o.source}-${o.id}-${o.material}`))
            .reduce((s, o) => s + o.consumoComponente, 0);
        const demandaRestante = Math.max(0, investigacion.cantidadPropia - consumoMovido);
        const utilizacionPct = investigacion.cantidadRespuesta > 0 ? (demandaRestante / investigacion.cantidadRespuesta) * 100 : Infinity;
        return { consumoMovido, demandaRestante, utilizacionPct };
    }, [investigacion, movidas]);

    if (isLoading && allPlanGrupos.length === 0) {
        return (
            <div className="flex flex-col items-center justify-center py-20 bg-gray-50 rounded-xl border-2 border-dashed gap-4">
                <Loader2 className="w-12 h-12 animate-spin text-indigo-600" />
                <p className="text-sm font-bold text-gray-700">Cargando Plan Grupo Recuperado...</p>
            </div>
        );
    }

    return (
        <div className="space-y-4">
            <div className="bg-white border border-gray-200 rounded-xl p-6 shadow-sm">
                <div className="flex items-center justify-between gap-4 flex-wrap">
                    <div>
                        <h3 className="text-sm font-bold text-gray-800 uppercase tracking-tight">Plan Grupo Recuperado</h3>
                        <p className="text-[11px] text-gray-500 mt-1">
                            Respuestas de "{GRUPO_RESPUESTA_NOMBRE.replace(/\b\w/g, c => c.toUpperCase())}" (Plan Táctico - Centro - P3)
                            asociadas a los Planes Táctico de Muebles (P2) que yo generé al presionar "Guardar Plan Táctico".
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

            {planesRespuesta.length === 0 && (
                <div className="bg-amber-50 border border-amber-300 rounded-lg p-4 flex items-start gap-2">
                    <TriangleAlert className="w-4 h-4 text-amber-600 mt-0.5 shrink-0" />
                    <p className="text-xs text-amber-800">
                        Todavía no se encontró ningún Plan de Grupo de "{GRUPO_RESPUESTA_NOMBRE.replace(/\b\w/g, c => c.toUpperCase())}" con el
                        patrón "Plan Táctico - Centro {'{'}Centro{'}'} - P3". El proceso externo aún no ha generado una respuesta, o todavía no corre para hoy.
                    </p>
                </div>
            )}

            {planesRespuesta.length > 0 && planesPropios.length === 0 && (
                <div className="bg-amber-50 border border-amber-300 rounded-lg p-4 flex items-start gap-2">
                    <TriangleAlert className="w-4 h-4 text-amber-600 mt-0.5 shrink-0" />
                    <p className="text-xs text-amber-800">
                        Se encontraron {planesRespuesta.length} plan(es) de respuesta, pero no hay ningún Plan Táctico de Muebles (P2)
                        propio contra el cual cruzarlos. Ejecute "Guardar Plan Táctico" en la pestaña "Plan Táctico" primero.
                    </p>
                </div>
            )}

            {todoResueltoSinDeficit && (
                <div className="bg-emerald-50 border border-emerald-300 rounded-lg p-4 flex items-center justify-between gap-4 flex-wrap">
                    <div className="flex items-start gap-2">
                        <CheckCircle2 className="w-4 h-4 text-emerald-600 mt-0.5 shrink-0" />
                        <p className="text-xs text-emerald-800">
                            "{GRUPO_RESPUESTA_NOMBRE.replace(/\b\w/g, c => c.toUpperCase())}" respondió sin déficit para los {detallesRecuperados.length} material(es)
                            de este Plan Táctico: no hace falta mover ninguna orden en SAP, puede avanzar directamente al Paso 3.
                        </p>
                    </div>
                    {onIrAPasoFinal && (
                        <Button
                            onClick={onIrAPasoFinal}
                            size="sm"
                            className="h-8 bg-emerald-600 hover:bg-emerald-700 text-white gap-1.5 text-xs shrink-0"
                        >
                            <ArrowRight className="w-3.5 h-3.5" />
                            IR A PASO 3: PLANIFICACIÓN FINAL
                        </Button>
                    )}
                </div>
            )}

            {detallesRecuperados.length > 0 && !todoResueltoSinDeficit && (
                <div className="bg-amber-50 border border-amber-300 rounded-lg p-4 flex items-center justify-between gap-4 flex-wrap">
                    <div className="flex items-start gap-2">
                        <TriangleAlert className="w-4 h-4 text-amber-600 mt-0.5 shrink-0" />
                        <p className="text-xs text-amber-800">
                            "{GRUPO_RESPUESTA_NOMBRE.replace(/\b\w/g, c => c.toUpperCase())}" respondió con déficit en {detallesConDeficit} de {detallesRecuperados.length} material(es).
                            Puede usar "Investigar" en cada fila para mover órdenes en SAP y reducirlo, o confirmar y continuar al Paso 3 de todos modos
                            (la decisión de aceptar el déficit pendiente es suya, no la bloquea el sistema).
                        </p>
                    </div>
                    {onIrAPasoFinal && (
                        <Button
                            onClick={onIrAPasoFinal}
                            size="sm"
                            className="h-8 bg-amber-600 hover:bg-amber-700 text-white gap-1.5 text-xs shrink-0"
                        >
                            <ArrowRight className="w-3.5 h-3.5" />
                            CONFIRMAR Y CONTINUAR A PASO 3
                        </Button>
                    )}
                </div>
            )}

            <div className="bg-white border border-gray-200 rounded-xl shadow-md overflow-hidden">
                <div className="flex items-center justify-between px-6 py-4 bg-gradient-to-r from-slate-900 to-indigo-900">
                    <div className="flex items-center gap-2">
                        <Inbox className="w-5 h-5 text-indigo-200" />
                        <h3 className="text-sm font-bold text-white uppercase tracking-wide">Detalles Tácticos Recuperados</h3>
                    </div>
                    <span className="text-[11px] text-indigo-200 font-mono">{detallesRecuperados.length} registro(s)</span>
                </div>
                <div className="p-6">
                    <div className="border border-gray-300 rounded-lg overflow-auto max-h-[60vh]">
                        <Table>
                            <TableHeader>
                                <TableRow className="bg-gray-100 hover:bg-gray-100 border-b-2 border-gray-300 sticky top-0">
                                    <TableHead className="text-[10px] font-extrabold text-gray-600 uppercase border-r border-gray-200">Cód. Detalle</TableHead>
                                    <TableHead className="text-[10px] font-extrabold text-gray-600 uppercase border-r border-gray-200">Material</TableHead>
                                    <TableHead className="text-[10px] font-extrabold text-gray-600 uppercase text-center border-r border-gray-200">Cant. Producción Neta</TableHead>
                                    <TableHead className="text-[10px] font-extrabold text-gray-600 uppercase text-center border-r border-gray-200">Resp. Ctrl. Prod.</TableHead>
                                    <TableHead className="text-[10px] font-extrabold text-gray-600 uppercase text-center border-r border-gray-200">Clase Aprov.</TableHead>
                                    <TableHead className="text-[10px] font-extrabold text-gray-600 uppercase text-center border-r border-gray-200">Cant. Aprov.</TableHead>
                                    <TableHead className="text-[10px] font-extrabold text-gray-600 uppercase border-r border-gray-200">Plan Respuesta (P3)</TableHead>
                                    <TableHead className="text-[10px] font-extrabold text-gray-600 uppercase border-r border-gray-200">Plan Propio (P2)</TableHead>
                                    <TableHead className="text-[10px] font-extrabold text-gray-600 uppercase text-center">Déficit</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {detallesRecuperados.map((d, idx) => {
                                    const planRespuesta = allPlanGrupos.find(p => p.codigo_plan_grupo === d.codigo_plan_grupo);
                                    const planPropio = d.codigo_plan_grupo_padre != null ? planesPropiosById.get(d.codigo_plan_grupo_padre) : undefined;
                                    const deficitInfo = detalleDeficitMap.get(d.codigo_detalle_tactico);
                                    const hayDeficit = !!deficitInfo && deficitInfo.deficit > TOLERANCIA_DEFICIT;
                                    return (
                                        <TableRow key={d.codigo_detalle_tactico} className={cn("border-b border-gray-200", idx % 2 === 1 && "bg-gray-50/70", hayDeficit && "bg-red-50/60")}>
                                            <TableCell className="text-[11px] font-mono text-gray-700 border-r border-gray-200">{d.codigo_detalle_tactico}</TableCell>
                                            <TableCell className="text-[11px] font-mono font-semibold text-gray-800 border-r border-gray-200">{d.codigo_material}</TableCell>
                                            <TableCell className="text-[11px] text-center font-mono font-bold text-indigo-700 border-r border-gray-200">{d.cantidad_produccion_neta}</TableCell>
                                            <TableCell className="text-[11px] text-center border-r border-gray-200">{d.resp_ctrl_prod || '—'}</TableCell>
                                            <TableCell className="text-[11px] text-center border-r border-gray-200">{d.clase_aprovisionamiento || '—'}</TableCell>
                                            <TableCell className="text-[11px] text-center border-r border-gray-200">{d.cantidad_aprovisionamiento}</TableCell>
                                            <TableCell className="text-[11px] border-r border-gray-200">
                                                <span className="font-semibold text-gray-800">{planRespuesta?.valor || `#${d.codigo_plan_grupo}`}</span>
                                                <span className="block text-gray-500">{planRespuesta ? formatFechaCreacion(planRespuesta.fecha_creacion) : ''}</span>
                                            </TableCell>
                                            <TableCell className="text-[11px] border-r border-gray-200">
                                                <span className="font-semibold text-gray-800">{planPropio?.valor || `#${d.codigo_plan_grupo_padre}`}</span>
                                                <span className="block text-gray-500">{planPropio ? formatFechaCreacion(planPropio.fecha_creacion) : ''}</span>
                                            </TableCell>
                                            <TableCell className="text-[11px] text-center">
                                                {hayDeficit && deficitInfo && planPropio ? (
                                                    <div className="flex flex-col items-center gap-1">
                                                        <span className="text-red-700 font-bold">
                                                            -{deficitInfo.deficit.toFixed(2)} ({deficitInfo.cantidadRespuesta.toFixed(2)} de {deficitInfo.cantidadPropia.toFixed(2)})
                                                        </span>
                                                        <Button
                                                            size="sm"
                                                            onClick={() => handleInvestigar(d.codigo_material.toString(), deficitInfo.cantidadPropia, deficitInfo.cantidadRespuesta, new Date(planPropio.fecha_inicio_plan))}
                                                            disabled={isLoadingSupportData}
                                                            className="h-6 bg-red-600 hover:bg-red-700 text-white gap-1 text-[10px] px-2"
                                                        >
                                                            {isLoadingSupportData ? <Loader2 className="w-3 h-3 animate-spin" /> : <Search className="w-3 h-3" />}
                                                            Investigar
                                                        </Button>
                                                    </div>
                                                ) : (
                                                    <span className="text-emerald-600 font-semibold inline-flex items-center gap-1">
                                                        <CheckCircle2 className="w-3.5 h-3.5" /> OK
                                                    </span>
                                                )}
                                            </TableCell>
                                        </TableRow>
                                    );
                                })}
                                {detallesRecuperados.length === 0 && (
                                    <TableRow>
                                        <TableCell colSpan={9} className="text-center py-6 text-gray-400 text-xs">
                                            No se encontraron Detalles Tácticos de respuesta que coincidan con mis Planes Táctico de Muebles (P2).
                                        </TableCell>
                                    </TableRow>
                                )}
                            </TableBody>
                        </Table>
                    </div>
                </div>
            </div>

            {/* Investigación de órdenes padre que consumen el material en déficit */}
            <Dialog open={investigacion !== null} onOpenChange={(open) => !open && setInvestigacion(null)}>
                <DialogContent className="max-w-5xl">
                    <DialogHeader>
                        <DialogTitle>Órdenes que Consumen el Material {investigacion?.materialObjetivo}</DialogTitle>
                        <DialogDescription>
                            Marque las órdenes que va a mover a otro día en SAP. La utilización se recalcula en vivo contra la
                            capacidad que puede fabricar Corte y Laminado ({investigacion?.cantidadRespuesta.toFixed(2)}). Se muestran
                            órdenes de Muebles (Previsional y Fert, MTO y MTS) con fecha propia igual o anterior a la fecha del plan —
                            esta es una aproximación de qué generó la demanda original, ya que la composición exacta (que pudo incluir
                            órdenes MTS de relleno de capacidad por antigüedad) no queda persistida; la suma de "Consumo del Componente"
                            puede no calzar exactamente con la Cantidad Neta Requerida original.
                        </DialogDescription>
                    </DialogHeader>

                    {investigacion && resumenInvestigacion && (
                        <div className={cn(
                            "rounded-lg border p-4 grid grid-cols-2 md:grid-cols-4 gap-4",
                            resumenInvestigacion.utilizacionPct > 100 ? "bg-red-50 border-red-200" : "bg-emerald-50 border-emerald-200"
                        )}>
                            <div>
                                <p className="text-[10px] font-bold text-gray-500 uppercase">Cantidad Neta Requerida (P2)</p>
                                <p className="text-lg font-black text-gray-800">{investigacion.cantidadPropia.toFixed(2)}</p>
                            </div>
                            <div>
                                <p className="text-[10px] font-bold text-gray-500 uppercase">Capacidad Ofrecida (P3)</p>
                                <p className="text-lg font-black text-gray-800">{investigacion.cantidadRespuesta.toFixed(2)}</p>
                            </div>
                            <div>
                                <p className="text-[10px] font-bold text-gray-500 uppercase">Seleccionado para Mover</p>
                                <p className="text-lg font-black text-indigo-700">
                                    {resumenInvestigacion.consumoMovido.toFixed(2)} <span className="text-xs font-normal text-gray-400">({movidas.size} orden(es))</span>
                                </p>
                            </div>
                            <div>
                                <p className="text-[10px] font-bold text-gray-500 uppercase">Utilización Resultante</p>
                                <p className={cn("text-lg font-black", resumenInvestigacion.utilizacionPct > 100 ? "text-red-700" : "text-emerald-700")}>
                                    {Number.isFinite(resumenInvestigacion.utilizacionPct) ? `${resumenInvestigacion.utilizacionPct.toFixed(1)}%` : '—'}
                                </p>
                            </div>
                        </div>
                    )}

                    {investigacion?.isLoading ? (
                        <div className="flex flex-col items-center justify-center py-16 gap-3">
                            <Loader2 className="w-8 h-8 animate-spin text-indigo-600" />
                            <p className="text-xs text-gray-500">Buscando órdenes padre y explosionando materiales...</p>
                        </div>
                    ) : (
                        <div className="border border-gray-300 rounded-lg overflow-auto max-h-[45vh]">
                            <Table>
                                <TableHeader>
                                    <TableRow className="bg-gray-100 hover:bg-gray-100 border-b-2 border-gray-300 sticky top-0">
                                        <TableHead className="text-[10px] font-extrabold text-gray-600 uppercase text-center border-r border-gray-200 w-10">Mover</TableHead>
                                        <TableHead className="text-[10px] font-extrabold text-gray-600 uppercase border-r border-gray-200">Orden</TableHead>
                                        <TableHead className="text-[10px] font-extrabold text-gray-600 uppercase border-r border-gray-200">Pedido</TableHead>
                                        <TableHead className="text-[10px] font-extrabold text-gray-600 uppercase text-center border-r border-gray-200">Posición</TableHead>
                                        <TableHead className="text-[10px] font-extrabold text-gray-600 uppercase border-r border-gray-200">Material</TableHead>
                                        <TableHead className="text-[10px] font-extrabold text-gray-600 uppercase border-r border-gray-200">Descripción</TableHead>
                                        <TableHead className="text-[10px] font-extrabold text-gray-600 uppercase text-center border-r border-gray-200">Tipo</TableHead>
                                        <TableHead className="text-[10px] font-extrabold text-gray-600 uppercase text-center border-r border-gray-200">Cantidad</TableHead>
                                        <TableHead className="text-[10px] font-extrabold text-gray-600 uppercase text-center border-r border-gray-200">Fecha Propia</TableHead>
                                        <TableHead className="text-[10px] font-extrabold text-gray-600 uppercase text-center border-r border-gray-200">Fecha Entrega</TableHead>
                                        <TableHead className="text-[10px] font-extrabold text-gray-600 uppercase border-r border-gray-200">Cliente</TableHead>
                                        <TableHead className="text-[10px] font-extrabold text-gray-600 uppercase text-center">Consumo del Componente</TableHead>
                                    </TableRow>
                                </TableHeader>
                                <TableBody>
                                    {investigacion?.ordenes.map((o, idx) => {
                                        const key = `${o.source}-${o.id}-${o.material}`;
                                        const seleccionada = movidas.has(key);
                                        return (
                                            <TableRow key={`${key}-${idx}`} className={cn("border-b border-gray-200", idx % 2 === 1 && "bg-gray-50/70", seleccionada && "bg-indigo-50")}>
                                                <TableCell className="text-center border-r border-gray-200">
                                                    <Checkbox checked={seleccionada} onCheckedChange={() => toggleMovida(key)} />
                                                </TableCell>
                                                <TableCell className="text-[11px] font-mono text-gray-700 border-r border-gray-200">{o.id}</TableCell>
                                                <TableCell className="text-[11px] font-mono text-gray-700 border-r border-gray-200">{o.pedido}</TableCell>
                                                <TableCell className="text-[11px] text-center border-r border-gray-200">{o.posicion}</TableCell>
                                                <TableCell className="text-[11px] font-mono font-semibold text-gray-800 border-r border-gray-200">{o.material}</TableCell>
                                                <TableCell className="text-[11px] text-gray-700 border-r border-gray-200">{o.nombre}</TableCell>
                                                <TableCell className="text-[11px] text-center border-r border-gray-200">{o.tipo}</TableCell>
                                                <TableCell className="text-[11px] text-center font-semibold border-r border-gray-200">{o.cantidad}</TableCell>
                                                <TableCell className="text-[11px] text-center font-mono border-r border-gray-200">{o.fechaPropia}</TableCell>
                                                <TableCell className="text-[11px] text-center font-mono border-r border-gray-200">{o.fechaEntrega}</TableCell>
                                                <TableCell className="text-[11px] border-r border-gray-200">{o.cliente}</TableCell>
                                                <TableCell className="text-[11px] text-center font-mono font-bold text-purple-700">{o.consumoComponente.toFixed(2)}</TableCell>
                                            </TableRow>
                                        );
                                    })}
                                    {investigacion && investigacion.ordenes.length === 0 && (
                                        <TableRow>
                                            <TableCell colSpan={12} className="text-center py-6 text-gray-400 text-xs">
                                                No se encontraron órdenes padre que consuman este material en la fecha del plan.
                                            </TableCell>
                                        </TableRow>
                                    )}
                                </TableBody>
                            </Table>
                        </div>
                    )}

                    <div className="flex justify-end">
                        <Button variant="outline" onClick={() => setInvestigacion(null)} className="gap-1.5">
                            <X className="w-3.5 h-3.5" />
                            Cerrar
                        </Button>
                    </div>
                </DialogContent>
            </Dialog>
        </div>
    );
};
