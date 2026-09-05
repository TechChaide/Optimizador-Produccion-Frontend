'use client';

import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { useSearchParams } from 'next/navigation';
import { ShoppingCart, Package, Loader2, LayoutDashboard, Calendar as CalendarIcon, ChevronLeft, ChevronRight, Filter, TrendingUp, Box, X, Layers, Wand2, Save, ClipboardCheck, RefreshCw, Clock, Search } from 'lucide-react';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from '@/components/ui/button';
import { grupoService } from '@/services/grupo.service';
import { restriccionService } from '@/services/restriccion.service';
import { serviciosService } from '@/services/servicios.service';
import { planGrupoService } from '@/services/plangrupo.service';
import { detalleTacticoService } from '@/services/detalletactico.service';
import { useAppContext } from '@/context/AppProvider';
import type { Grupo, Restriccion, PlanGrupo, DetalleTactico } from '@/types/interfaces';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import { nextBusinessDay as nextBusinessDayCal, cargarDiasNoLaborables, fechaLocalEcuador, type DiasNoLaborables } from '@/lib/dias-laborables';
import { guardarEnCache, leerDeCache, actualizarEnCache } from '@/lib/cache-modulos';
import { format, startOfMonth, endOfMonth, eachDayOfInterval, getDay, parseISO, addMonths, subMonths, addDays } from 'date-fns';
import { es } from 'date-fns/locale';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Accordion, AccordionItem, AccordionTrigger, AccordionContent } from "@/components/ui/accordion";
import { Progress } from "@/components/ui/progress";

// Respaldo SOLO para cuando el material no tiene tiempo estándar real en el catálogo SAP (ver
// calculateSummary/matchTiempoEstandar) — antes era el único cálculo usado, sobreestimando el
// tiempo real hasta ~22x en casos verificados (ver comentario en calculateSummary).
const PACKING_TIME_PER_UNIT_SECONDS = 15;

// Discriminador de tipo de componente en la explosión BOM (mismo criterio que usa
// Corte y Laminado para identificar la "lámina" que consume como materia prima).
const DESCRIPCION_ROLLO = 'LAMINA CILINDRICA';

const TIPO_TAG: Record<'ESPUMAS' | 'ROLLOS', string> = { ESPUMAS: 'Espumas', ROLLOS: 'Rollos' };

interface NecesidadMaterial {
  material: string;
  descripcion: string;
  cantidad: number;
}

interface DataAprobadaRow {
  material: string;
  descripcion: string;
  cantidad: number;
  respuestaCant: number;
  planGrupo: string;
  fechasOk: boolean | null;
}

// Misma regla que ya usaba el JSX de "Data Aprobada" inline, subida a función compartida para que
// "PFD - VENTA" (generarPfdVentaPreview) no la duplique.
const estadoDataAprobada = (row: DataAprobadaRow): 'pendiente' | 'parcial' | 'completo' =>
  row.respuestaCant <= 0 ? 'pendiente' : row.respuestaCant >= row.cantidad ? 'completo' : 'parcial';

// Una fila por material FERT/PT — exactamente lo que "Guardar PFD-VENTA" va a grabar en
// DetalleTactico (cantidad), más 2 columnas informativas (categoria/tiempoHoras) para dar contexto
// sin necesitar una vista agrupada aparte (ver generarPfdVentaPreview).
interface PfdVentaLinea {
  material: string;
  descripcion: string;
  categoria: string;
  cantidad: number;
  tiempoHoras: number;
}
interface PfdVentaPreview {
  lineas: PfdVentaLinea[];
  sinTrazabilidad: DataAprobadaRow[];
  ptCubiertos: Set<string>;
}

// Cantidad viene como texto desde DetalleTactico (p.ej. "120.5000"); mismo criterio de limpieza
// que usan Corte Espuma / Corte y Laminado en sus resúmenes.
const parseQty = (val: unknown): number => {
  const n = Number(String(val ?? '').replace(/[^0-9.-]/g, ''));
  return isNaN(n) ? 0 : n;
};

// Normaliza fecha_inicio_plan/fecha_fin_plan/fecha_modificacion a 'yyyy-MM-dd'. Delega en
// fechaLocalEcuador (@/lib/dias-laborables): el sufijo horario NO siempre es "T00:00:00" — un plan
// grabado a media tarde/noche en Ecuador llega en UTC con esa hora real, y recortar el ISO a lo
// bruto podía devolver el día calendario SIGUIENTE (mismo bug documentado en Corte Espuma,
// explotarPFFParaCentro). Mismo criterio que usa Corte y Laminado.
const soloFecha = (v: unknown): string => {
  const s = String(v ?? '').trim();
  if (!s || s === 'null' || s === 'undefined') return '';
  return fechaLocalEcuador(s);
};

// Solo el plan "P3" es una respuesta real de Corte y Laminado contra el P2 — "PFD" es una
// variante de salida para otro proceso (deja constancia de qué material quedó sin planificar,
// forzando a 0 los que no tienen corrida) y no debe contarse como material efectivamente recibido.
const esPlanP3 = (valor: unknown): boolean => /\bp3\b/i.test(String(valor || ''));

// Día hábil: lunes a viernes MENOS los feriados / días no trabajados del calendario configurado
// (Configuraciones → Calendario Área) — ver @/lib/dias-laborables. Dentro del componente se usa el
// wrapper siguienteDiaHabil, que ya lleva ese calendario cargado. El día que se adopte sábado como
// laborable, eso se resuelve ahí y aplica a todos los módulos a la vez.

// Tab "Pendientes": solo Espumas (Corte Espuma consume esta demanda) — el resto de sectores del
// mismo endpoint (Colchones, Muebles, etc.) no aplica a este módulo.
const SECTOR_ESPUMAS = '09 ESPUMAS';

// Cod.Buscar: clave de cruce entre "Pendientes Totales" y "Órdenes FERT", igual a la fórmula ya
// usada en el archivo Excel de origen: [@POSICION]*1 & [@PEDIDO]*1 & [@MATERIAL]*1 — el "*1" fuerza
// cada valor a número (elimina ceros a la izquierda) antes de concatenarlos como texto.
const buildCodBuscar = (posicion: unknown, pedido: unknown, material: unknown): string => {
  const num = (v: unknown) => String(parseQty(v));
  return `${num(posicion)}${num(pedido)}${num(material)}`;
};

// Clasificación MTO/MTS de una orden Provisional por su ClaseOrden — confirmado con datos reales
// (verificado que KD siempre trae PEDIDOVENTAS real y LA siempre lo trae vacío/"000000"): KD = MTO
// (bajo pedido, con cliente), LA = MTS (sin cliente). Es solo una ETIQUETA informativa — no excluye
// filas del listado, eso se controla por RESPCTRLPROD (ver filterData), no por ClaseOrden.
const clasificarClaseOrden = (claseOrden: unknown): string => {
  const c = String(claseOrden || '').trim().toUpperCase();
  if (c === 'KD') return 'MTO';
  if (c === 'LA') return 'MTS';
  return c || '—';
};

// A diferencia de `String(v || '')`, no descarta 0/"" legítimos (ej. CANT_PEND_ENTREGA: 0) —
// solo cae a '' cuando el campo realmente no vino (null/undefined).
const numOrEmpty = (v: unknown): string => (v === null || v === undefined || v === '') ? '' : String(v);

interface PendienteRow {
  pedido: string;
  posicion: string;
  codBuscar: string;
  cantPedida: string;
  centro: string;
  fechaPedido: string;
  fechaEntrega: string;
  ciudadDestino: string;
  volPend: string;
  // Cruce contra Órdenes FERT por Cod.Buscar (POSICION+PEDIDO+MATERIAL) — fecha de entrega de la
  // Orden FERT que ya cubre este pedido/posición/material, si existe.
  fechaEntregaFert: string;
}

// Snapshot de lo que este módulo tiene cargado. Se guarda al sincronizar y se restaura al volver de
// otro módulo, para no perder el trabajo en curso solo por navegar — mismo patrón que Corte Espuma
// (ver @/lib/cache-modulos y [[persistencia_datos_modulos]]).
const CACHE_VENTA_EXTERNA = 'tactica-venta-externa';
interface SnapshotVentaExterna {
  grupos: Grupo[];
  restricciones: Restriccion[];
  ordenes: Record<string, unknown>[];
  ordenesFert: Record<string, unknown>[];
  tiemposEnsamblado: Record<string, unknown>[];
  diasNoLaborables: string[];
  // Resultado YA CALCULADO del tab "Data Aprobada" (ver fetchDataAprobada) — a diferencia del resto
  // de este snapshot (datos crudos), esto es el resultado de un cálculo disparado por el botón
  // "Actualizar" de ese tab; sin cachearlo aparte, volvía a quedar vacío al navegar a otro módulo y
  // volver, igual que pasaba con el resumen de Corte y Laminado (ver
  // [[laminado_prioridad_consumo_interno_sobre_venta_externa]] y la verificación de persistencia de
  // esta sesión). Se sincroniza con actualizarEnCache directo en fetchDataAprobada, sin overrides
  // manuales de por medio (es un recálculo puro, no editable).
  dataAprobada: Record<string, DataAprobadaRow[]>;
  // Resultado YA CALCULADO de "Generar Necesidades - BOM FERT" (ver handleCalcularNecesidadRollos) -
  // mismo problema que dataAprobada: sin cachearlo aparte, el usuario perdia la necesidad recien
  // explotada del BOM al navegar a otro modulo y volver, aunque los datos crudos (ordenes/ordenesFert)
  // si sobrevivieran. Se sincroniza con actualizarEnCache al final de handleCalcularNecesidadRollos.
  necesidadEspumas1000: NecesidadMaterial[];
  necesidadEspumas2000: NecesidadMaterial[];
  necesidadRollos1000: NecesidadMaterial[];
  necesidadRollos2000: NecesidadMaterial[];
}

export const TacticalPlanVentaExternaSection: React.FC = () => {
  const { addNotification } = useAppContext();

  const [mounted, setMounted] = useState(false);
  const [activeTab, setActiveTab] = useState('resumen');
  // El módulo YA NO sincroniza solo al abrirse — ver handleSincronizarYGenerar. Este flag distingue
  // "todavía no se pidió nada" del estado vacío real, para mostrar el aviso correcto.
  const [datosCargados, setDatosCargados] = useState(false);
  // "Sincronizar" dispara además "Generar Necesidades · BOM FERT" automáticamente (antes 2 clics) —
  // SOLO si ya hay una "Ventana de Producción" (selectedDates) elegida, igual que la validación
  // manual del botón; si no, se deja para que el usuario elija fecha y lo dispare a mano (el botón
  // sigue disponible aparte, a diferencia de Laminado/Espuma — acá el paso intermedio de elegir fecha
  // es obligatorio, no opcional). Mismo patrón general que [[modulos_tacticos_sincronizar_y_generar_combinado]].
  const [autoGenerarPendiente, setAutoGenerarPendiente] = useState(false);
  const [syncStep, setSyncStep] = useState<'idle' | 'sincronizando' | 'generando'>('idle');
  const [grupos, setGrupos] = useState<Grupo[]>([]);
  const [restricciones, setRestricciones] = useState<Restriccion[]>([]);
  const [ordenes, setOrders] = useState<Record<string, unknown>[]>([]);
  const [ordenesFert, setOrdersFert] = useState<Record<string, unknown>[]>([]);
  const [tiemposEnsamblado, setTiemposEnsamblado] = useState<Record<string, unknown>[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  // Días NO laborables (feriados + días que la planta decide no trabajar) del calendario configurado.
  // Vacío = solo se saltan fines de semana. Se carga en el init de abajo.
  const [diasNoLaborables, setDiasNoLaborables] = useState<DiasNoLaborables>(new Set<string>());
  const siguienteDiaHabil = useCallback((d: Date) => nextBusinessDayCal(d, diasNoLaborables), [diasNoLaborables]);
  const [selectedDates, setSelectedDates] = useState<string[]>([]);
  const [viewDate, setViewDate] = useState(new Date());
  // Fecha(s) de "Resumen Necesidades" — selector PROPIO de este tab, deliberadamente separado de
  // `selectedDates` ("Ventana de Producción", usada por Provisionales/generar P2). Multi-select
  // EXACTO (no acumulado "hasta"): una fecha muestra solo lo de ESE día; varias fechas suman solo esos
  // días entre sí — no todo lo anterior. Corregido a pedido del usuario (la primera versión sumaba
  // "hasta" la fecha elegida, arrastrando días previos sin que el usuario lo esperara). Default: hoy.
  const [selectedDatesResumen, setSelectedDatesResumen] = useState<string[]>(() => [format(new Date(), 'yyyy-MM-dd')]);
  const [viewDateResumen, setViewDateResumen] = useState(new Date());
  const [expandedCategorias1000, setExpandedCategorias1000] = useState<string[]>([]);
  const [expandedCategorias2000, setExpandedCategorias2000] = useState<string[]>([]);

  // Llegada desde el botón "Diferir" de Corte Espuma (panel "sobre-ocupado — candidatos a diferir",
  // ver renderDashboard en TacticalPlanEspumasSection.tsx): ese panel es puramente informativo ahí
  // (no mueve ninguna fecha por sí solo), así que en vez de escribir el plan P2 desde otro módulo, se
  // trae al planificador AQUÍ, al tab Plan P2, con la fecha sugerida ya preseleccionada en "Ventana
  // de Producción" — la decisión final (confirmar esa fecha u otra, y regenerar) la sigue tomando el
  // planificador en su propio flujo, igual que cualquier otra generación de P2. Solo se aplica UNA
  // vez al montar (no en cada cambio de searchParams) para no pisar una selección manual posterior.
  const searchParams = useSearchParams();
  useEffect(() => {
    const tab = searchParams.get('tab');
    const fecha = searchParams.get('fecha');
    const material = searchParams.get('material');
    if (tab === 'p2') setActiveTab('planP2');
    if (fecha) setSelectedDates([fecha]);
    if (material) {
      addNotification('info', `Vienes de Corte Espuma para diferir el material ${material}: confirma la fecha en "Ventana de Producción" (ya preseleccionada) y genera el P2 de Espumas para aplicarla.`);
    }
  }, []);

  // Tab "Pendientes": pedidos aún no entregados (getPendientesTotales), con filtro por texto
  // (Pedido/Material) y por rango de Fecha de Entrega, agrupados por Material. Se carga de forma
  // perezosa (solo al abrir el tab por primera vez) por el volumen de registros (+20K).
  const [pendientesTotales, setPendientesTotales] = useState<Record<string, unknown>[]>([]);
  const [isLoadingPendientes, setIsLoadingPendientes] = useState(false);
  const [pendientesCargados, setPendientesCargados] = useState(false);
  const [pendientesSearch, setPendientesSearch] = useState('');
  const [pendientesFechaDesde, setPendientesFechaDesde] = useState('');
  const [pendientesFechaHasta, setPendientesFechaHasta] = useState('');
  const [expandedPendientesMateriales, setExpandedPendientesMateriales] = useState<string[]>([]);

  // Necesidad P2 (Plan de Grupo origen para Laminado/Espumas) — ambas se calculan explotando la
  // lista de materiales de las Órdenes FERT (Provisionales NO aplica para este paso).
  const [necesidadEspumas1000, setNecesidadEspumas1000] = useState<NecesidadMaterial[]>([]);
  const [necesidadEspumas2000, setNecesidadEspumas2000] = useState<NecesidadMaterial[]>([]);
  const [necesidadRollos1000, setNecesidadRollos1000] = useState<NecesidadMaterial[]>([]);
  const [necesidadRollos2000, setNecesidadRollos2000] = useState<NecesidadMaterial[]>([]);
  const [isExplodingBom, setIsExplodingBom] = useState(false);
  const [bomProgress, setBomProgress] = useState({ current: 0, total: 0 });
  // Diagnóstico de la última corrida de "Calcular Necesidad": qué FERT llegaron a explotarse
  // (ya pasaron centro + restricciones + fecha) pero no aportaron ninguna línea de Espuma/Rollo, y
  // cuáles fallaron al consultar el Maestro de Materiales — ver explodeNecesidadesFert.
  const [bomDiagnostico, setBomDiagnostico] = useState<{ sinMatch: string[]; conError: string[] }>({ sinMatch: [], conError: [] });
  const [savingPlanP2, setSavingPlanP2] = useState<Record<string, boolean>>({});
  const [planP2Generado, setPlanP2Generado] = useState<Record<string, number>>({});
  const [isSavingAllPlanP2, setIsSavingAllPlanP2] = useState(false);
  // "PFD - VENTA": vista previa (generarPfdVentaPreview, en memoria, no se cachea entre navegaciones —
  // se recalcula desde cero cada vez que se pulsa "Generar PFD-VENTA", con su propia explosión BOM
  // fresca, ver sección al final del tab "Data Aprobada") y estado de guardado por centro. No depende
  // de haber corrido "Generar Necesidades · BOM FERT" antes — antes sí dependía de un estado
  // (`trazabilidadPT1000/2000`) que solo se llenaba ahí, y si el usuario ya estaba viendo Data
  // Aprobada actualizada sin haber vuelto a pasar por ese botón en la misma sesión, PFD-VENTA no
  // encontraba trazabilidad para nada (reportado por el usuario con datos reales) — ver
  // generarPfdVentaPreview.
  const [pfdVentaPreview, setPfdVentaPreview] = useState<Record<string, PfdVentaPreview>>({});
  const [isGeneratingPfdVenta, setIsGeneratingPfdVenta] = useState<Record<string, boolean>>({});
  const [pfdVentaBomProgress, setPfdVentaBomProgress] = useState<Record<string, { current: number; total: number }>>({});
  const [savingPfdVenta, setSavingPfdVenta] = useState<Record<string, boolean>>({});
  const [pfdVentaGenerado, setPfdVentaGenerado] = useState<Record<string, number>>({});

  // Data Aprobada (P3): recupera, por cada P2 propio activo, la respuesta del plan consumidor
  // (P3) — sus DetalleTactico cuyo codigo_plan_grupo_padre apunta a nuestro P2.
  const [dataAprobada, setDataAprobada] = useState<Record<string, DataAprobadaRow[]>>({});
  const [isLoadingDataAprobada, setIsLoadingDataAprobada] = useState(false);

  // Calendario "abierto": sin tope de rango entre la fecha más antigua y la más nueva seleccionada
  // (antes limitado a 3 días). El usuario confirmó liberar esta restricción a propósito — el filtro
  // también sirve para seleccionar una fecha fuera de la ventana operativa normal, para evaluación de
  // tiempo/what-if, no solo para el rango real hoy+1..hoy+3.
  const toggleSelectedDate = (dateStr: string) => {
    setSelectedDates(prev => (
      prev.includes(dateStr) ? prev.filter(d => d !== dateStr) : [...prev, dateStr]
    ));
  };

  const toggleSelectedDateResumen = (dateStr: string) => {
    setSelectedDatesResumen(prev => (
      prev.includes(dateStr) ? prev.filter(d => d !== dateStr) : [...prev, dateStr]
    ));
  };

  useEffect(() => { setMounted(true); }, []);

  const fetchGrupos = async () => {
    try {
      const res = await grupoService.getAll();
      const filtered = (res.data || []).filter(g => 
        g.nombre_grupo && (g.nombre_grupo.toLowerCase().includes('venta externa') || g.nombre_grupo.toLowerCase().includes('ventaexterna'))
      );
      setGrupos(filtered);
      return filtered;
    } catch (error) {
      console.error('Error cargando grupos:', error);
      return [];
    }
  };

  const fetchRestricciones = async (gruposIds: number[]) => {
    try {
      const res = await restriccionService.getAll();
      const filtered = (res.data || []).filter(r => gruposIds.includes(r.codigo_grupo));
      setRestricciones(filtered);
      return filtered;
    } catch (error) {
      console.error('Error cargando restricciones:', error);
      return [];
    }
  };

  const fetchOrdenes = async () => {
    try {
      const pProv = serviciosService.OrdenesProvisionalesPaginados(1, 20000).catch(() => ({ data: [] }));
      const pFert = serviciosService.getOrdenesFert(1, 20000).catch(() => ({ data: [] }));
      
      const [resProv, resFert] = await Promise.all([pProv, pFert]);
      
      setOrders(resProv.data || []);
      setOrdersFert(resFert.data || []);
      return { ordenes: resProv.data || [], ordenesFert: resFert.data || [] };
    } catch (error) {
      console.error('Error cargando órdenes:', error);
      return { ordenes: [], ordenesFert: [] };
    }
  };

  const fetchTiemposEnsamblado = async (filteredGroups: Grupo[]) => {
    try {
      const allTiempos: Record<string, unknown>[] = [];
      for (const g of filteredGroups) {
        if (!g.centro) continue;
        try {
          const res = await serviciosService.getTiemposEnsambladobyCentroyCodigoGrupo(String(g.centro), g.codigo_grupo);
          const actualData = res.data?.data || res.data || [];
          if (Array.isArray(actualData)) allTiempos.push(...actualData);
        } catch {
          console.warn(`Error cargando tiempos para grupo ${g.codigo_grupo}`);
        }
      }
      setTiemposEnsamblado(allTiempos);
      return allTiempos;
    } catch (error) {
      console.error('Error cargando tiempos:', error);
      return [];
    }
  };

  // Sincronización manual: se dispara con el botón "Sincronizar" del encabezado, no al abrir el
  // módulo — mismo criterio que Corte Espuma (ver [[carga_manual_modulos_tacticos]]). Entrar a mirar
  // no debe costar 4 llamadas pesadas a SAP (Provisionales/FERT ~20K filas cada una) cada vez.
  const handleSincronizarYGenerar = useCallback(async () => {
    setIsLoading(true);
    setSyncStep('sincronizando');
    try {
      const [groups, dias] = await Promise.all([
        fetchGrupos(),
        cargarDiasNoLaborables(),
      ]);
      const ids = groups.map(g => g.codigo_grupo);
      const [restrs, ordenesRes, tiempos] = await Promise.all([
        fetchRestricciones(ids),
        fetchOrdenes(),
        fetchTiemposEnsamblado(groups),
      ]);
      setDiasNoLaborables(dias);
      setDatosCargados(true);
      guardarEnCache<SnapshotVentaExterna>(CACHE_VENTA_EXTERNA, {
        grupos: groups,
        restricciones: restrs,
        ordenes: ordenesRes.ordenes,
        ordenesFert: ordenesRes.ordenesFert,
        tiemposEnsamblado: tiempos,
        diasNoLaborables: [...dias],
        // Data Aprobada y la Necesidad BOM se sincronizan aparte (ver fetchDataAprobada y
        // handleCalcularNecesidadRollos) — acá se preserva lo que ya hubiera, en vez de resetearlo,
        // por si el usuario vuelve a sincronizar sin haber navegado fuera del módulo.
        dataAprobada,
        necesidadEspumas1000,
        necesidadEspumas2000,
        necesidadRollos1000,
        necesidadRollos2000,
      });
      // No se llama handleCalcularNecesidadRollos() directo acá: leería fertC1000ParaP2/
      // fertC2000ParaP2 (useMemo derivados del estado que se acaba de actualizar arriba) por closure
      // vieja. Se dispara desde el efecto de más abajo, que ve la versión fresca una vez que el
      // siguiente render ya ocurrió (mismo criterio que Corte y Laminado/Corte Espuma).
      setAutoGenerarPendiente(true);
    } finally {
      setIsLoading(false);
    }
  }, [dataAprobada, necesidadEspumas1000, necesidadEspumas2000, necesidadRollos1000, necesidadRollos2000]);

  // Rehidratación: si ya se había sincronizado en esta sesión, se recupera lo trabajado en vez de
  // dejar el módulo vacío al volver de otro módulo (ver @/lib/cache-modulos). Incluye Data Aprobada
  // (ver fetchDataAprobada) — antes solo se restauraban los datos crudos, así que ese tab volvía
  // vacío tras navegar a otro módulo hasta pulsar "Actualizar" de nuevo.
  useEffect(() => {
    if (!mounted) return;
    const snap = leerDeCache<SnapshotVentaExterna>(CACHE_VENTA_EXTERNA);
    if (snap) {
      setGrupos(snap.grupos);
      setRestricciones(snap.restricciones);
      setOrders(snap.ordenes);
      setOrdersFert(snap.ordenesFert);
      setTiemposEnsamblado(snap.tiemposEnsamblado);
      setDiasNoLaborables(new Set(snap.diasNoLaborables));
      setDataAprobada(snap.dataAprobada || {});
      setNecesidadEspumas1000(snap.necesidadEspumas1000 || []);
      setNecesidadEspumas2000(snap.necesidadEspumas2000 || []);
      setNecesidadRollos1000(snap.necesidadRollos1000 || []);
      setNecesidadRollos2000(snap.necesidadRollos2000 || []);
      setDatosCargados(true);
    }
  }, [mounted]);

  const fetchPendientesTotales = useCallback(async () => {
    setIsLoadingPendientes(true);
    try {
      const res = await serviciosService.getPendientesTotales(1, 20000);
      setPendientesTotales(res.data || []);
    } catch (error) {
      console.error('Error cargando pendientes:', error);
    } finally {
      setIsLoadingPendientes(false);
      setPendientesCargados(true);
    }
  }, []);

  // Carga perezosa: solo trae los +20K registros de Pendientes la primera vez que se abre el tab, y
  // solo si ya se sincronizó lo base — abrir el tab sin datos no debe disparar esta consulta sola.
  useEffect(() => {
    if (datosCargados && activeTab === 'pendientes' && !pendientesCargados && !isLoadingPendientes) {
      fetchPendientesTotales();
    }
  }, [datosCargados, activeTab, pendientesCargados, isLoadingPendientes, fetchPendientesTotales]);

  // Días con datos para el punto/resalte del calendario "Fecha" — compartido entre los tabs
  // Provisionales y FERT, así que debe incluir fechas de AMBAS fuentes (antes solo miraba
  // ordenesFert: un día con órdenes Provisionales pero sin FERT aparecía apagado, como si no tuviera
  // datos, cuando trabajabas en el tab de Provisionales).
  const datesWithOrders = useMemo(() => {
    const dates = new Set<string>();
    [...ordenesFert, ...ordenes].forEach(o => {
      // Mismo criterio que filterData: FECHAFIN si existe (Provisionales), si no FECHA/FECHAINICIO
      // (FERT) — el punto del calendario debe marcar el mismo día que realmente hace match al filtrar.
      const d = String(o.FECHAFIN || o.FECHA || o.FECHAINICIO || '').trim();
      if (d && d !== 'null' && d !== 'undefined') {
        const normalized = d.includes('T') ? d.split('T')[0] : d;
        dates.add(normalized);
      }
    });
    return dates;
  }, [ordenesFert, ordenes]);

  const calendarDays = useMemo(() => {
    const start = startOfMonth(viewDate);
    const end = endOfMonth(viewDate);
    const days = eachDayOfInterval({ start, end });
    const startDay = getDay(start);
    const padding = startDay === 0 ? 6 : startDay - 1;
    return [...Array(padding).fill(null), ...days];
  }, [viewDate]);

  // Mismo cálculo que calendarDays, pero para el selector propio de "Resumen Necesidades"
  // (selectedDatesResumen) — mes de navegación independiente del de "Ventana de Producción".
  const calendarDaysResumen = useMemo(() => {
    const start = startOfMonth(viewDateResumen);
    const end = endOfMonth(viewDateResumen);
    const days = eachDayOfInterval({ start, end });
    const startDay = getDay(start);
    const padding = startDay === 0 ? 6 : startDay - 1;
    return [...Array(padding).fill(null), ...days];
  }, [viewDateResumen]);

  const extractMaterialInfo = (item: Record<string, unknown>) => {
    const matStr = String(item.MATERIAL || item.Material || item.CodMaterial || '').trim();
    const nameStr = String(item.NOMBRE || item.NombreMaterial || item.Descripcion || '').trim();
    const catStr = String(item.CATEGORIA || item.Categoria || '').trim();
    
    const match = matStr.match(/^(\d+)/);
    const code = match ? match[1].slice(-8) : matStr.slice(-8);
    const desc = nameStr || matStr.replace(/^\d+\s*/, '') || '—';

    const dimensions: { dens: string; ancho: string; largo: string; esp: string; tipo: string } = { dens: '—', ancho: '—', largo: '—', esp: '—', tipo: '—' };
    
    const techPatternMatch = catStr.match(/D(\d+)([a-zA-Z]+)/i);
    if (techPatternMatch) {
      dimensions.dens = techPatternMatch[1]; 
      dimensions.tipo = techPatternMatch[2].toUpperCase(); 
    } else {
      const densMatch = desc.match(/D-?(\d+)/i);
      if (densMatch) dimensions.dens = densMatch[1];
      const tipoMatch = desc.match(/D-?\d+([a-zA-Z]+)/i);
      if (tipoMatch) dimensions.tipo = tipoMatch[1].toUpperCase();
    }

    const dimMatch = desc.match(/(\d+(?:\.\d+)?)\s*[xX*]\s*(\d+(?:\.\d+)?)(?:\s*[xX*]\s*(\d+(?:\.\d+)?))?/);
    if (dimMatch) {
      dimensions.ancho = dimMatch[1];
      dimensions.largo = dimMatch[2];
      if (dimMatch[3]) dimensions.esp = dimMatch[3];
    }
    
    return { code, desc, ...dimensions };
  };

  const filterData = (data: Record<string, unknown>[], centro: string, applyDateFilter: boolean = true, dateOverride?: string[]) => {
    const relevantGroups = grupos.filter(g => String(g.centro).trim() === centro);
    if (relevantGroups.length === 0) return [];
    
    const groupIds = relevantGroups.map(g => g.codigo_grupo);
    const groupRest = restricciones.filter(r => groupIds.includes(r.codigo_grupo));

    // Comparación insensible a mayúsculas/minúsculas: verificado con datos reales que la restricción
    // de Venta Externa Centro 1000 se guardó como nombre_restriccion="RespCtrlProd" (no "RESPCTRLPROD"
    // exacto) — con comparación exacta, respCodes quedaba vacío y el filtro de responsable no
    // aplicaba nada, dejando pasar cualquier responsable sin que nadie lo notara.
    const nombreRestriccion = (r: Restriccion) => String(r.nombre_restriccion || '').trim().toUpperCase();

    const respCodes = groupRest
      .filter(r => nombreRestriccion(r) === 'RESPCTRLPROD')
      .flatMap(r => r.valor_restriccion.split(/[,&]/).map(v => v.trim()))
      .filter(v => v !== '');

    const almCodes = groupRest
      .filter(r => nombreRestriccion(r) === 'ALMACEN')
      .flatMap(r => r.valor_restriccion.split(/[,&]/).map(v => v.trim()))
      .filter(v => v !== '');

    const sectorCodes = groupRest
      .filter(r => nombreRestriccion(r) === 'SECTOR')
      .flatMap(r => r.valor_restriccion.split(/[,&]/).map(v => v.trim()))
      .filter(v => v !== '');

    return data.filter(o => {
      const itemCentro = String(o.CENTRO || o.Centro || o.centro || '').trim();
      if (itemCentro !== centro) return false;
      
      const itemResp = String(o.RESPCTRLPROD || o.RESPCONTROLPROD || o.RespCtrlProd || o.RespControlProd || '').trim();
      const matchResp = respCodes.length === 0 || respCodes.some(code => itemResp === code || itemResp.includes(code));
      
      const itemAlmValue = String(o.ALMACEN || o.Almacen || o.almacen || '').trim();
      const matchAlm = almCodes.length === 0 || itemAlmValue === '' || almCodes.includes(itemAlmValue);
      
      const itemSectorValue = String(o.SECTORDESC || o.Sector || o.SECTOR || '').trim();
      const matchSector = sectorCodes.length === 0 || itemSectorValue === '' || sectorCodes.some(code => itemSectorValue.includes(code));


      if (applyDateFilter) {
        const fechas = dateOverride ?? selectedDates;
        const soloFechaStr = (v: unknown) => {
          const s = String(v ?? '').trim();
          return s.includes('T') ? s.split('T')[0] : s;
        };
        const itemInicio = soloFechaStr(o.FECHA || o.FECHAINICIO);
        const itemFin = soloFechaStr(o.FECHAFIN);
        // Provisionales trae FECHAINICIO (constante en el dato real — no diferencia por orden, no
        // sirve para filtrar) y FECHAFIN (sí varía por orden, es la fecha real de vencimiento). Se
        // probó FECHAFIN >= fecha seleccionada (mostrar la cola completa hacia adelante), pero el
        // usuario lo rechazó explícitamente: necesita que sea rastreable 1:1 con la selección — si
        // eliges el 12 de agosto, ves SOLO lo que vence exactamente el 12, nada antes ni después. Si
        // la orden no trae FECHAFIN (caso FERT), se mantiene la misma coincidencia exacta contra
        // FECHA/FECHAINICIO de siempre.
        const matchDate = fechas.length === 0
          ? true
          : itemFin
            ? fechas.includes(itemFin)
            : fechas.includes(itemInicio);
        return matchResp && matchAlm && matchSector && matchDate;
      }

      return matchResp && matchAlm && matchSector;
    });
  };

  const provC1000 = useMemo(() => filterData(ordenes, '1000'), [ordenes, grupos, restricciones, selectedDates]);
  const provC2000 = useMemo(() => filterData(ordenes, '2000'), [ordenes, grupos, restricciones, selectedDates]);

  // Fuente de datos para GENERAR el P2 (cambio de fondo pedido por el usuario, revierte el criterio
  // anterior "P2 sale de Provisionales, FERT queda fuera"): ahora el P2 se explota desde Órdenes FERT
  // en vez de Provisionales — mismo `filterData` (centro + RESPCTRLPROD/ALMACEN/SECTOR + fecha), que
  // ya sabía manejar la forma de FERT (sin FECHAFIN, cae a coincidencia exacta contra FECHA — ver el
  // comentario dentro de filterData). SECTOR, que en Provisionales no filtraba nada porque el campo no
  // existe ahí, en FERT SÍ tiene datos reales — verificar que no repita el bug de mayúsculas de
  // RESPCTRLPROD si aparecen materiales excluidos sin explicación. `provC1000`/`provC2000` NO se
  // tocan: siguen alimentando el tab "Provisionales", que ahora es solo de referencia (igual que FERT
  // lo era antes de este cambio).
  const fertC1000ParaP2 = useMemo(() => filterData(ordenesFert, '1000'), [ordenesFert, grupos, restricciones, selectedDates]);
  const fertC2000ParaP2 = useMemo(() => filterData(ordenesFert, '2000'), [ordenesFert, grupos, restricciones, selectedDates]);

  // TEMPORAL — diagnóstico para confirmar si la restricción RESPCTRLPROD/ALMACEN realmente excluye
  // algo en Provisionales Centro 1000, o si simplemente TODA la data ya comparte el mismo valor (y
  // por eso "parece" que no filtra nada). Compara el total de Centro 1000 (sin restricción) contra
  // el total ya filtrado (provC1000) y lista los valores distintos de RESPCONTROLPROD/ALMACEN vistos.
  useEffect(() => {
    if (ordenes.length === 0) return;
    const soloCentro1000 = ordenes.filter(o => String(o.CENTRO || o.Centro || o.centro || '').trim() === '1000');
    const respsDistintos = new Set(soloCentro1000.map(o => String(o.RESPCTRLPROD || o.RESPCONTROLPROD || o.RespCtrlProd || o.RespControlProd || '').trim()));
    const almsDistintos = new Set(soloCentro1000.map(o => String(o.ALMACEN || o.Almacen || o.almacen || '').trim()));
    console.log('[DEBUG Provisionales] Centro 1000 sin restricción:', soloCentro1000.length, '| con restricción (provC1000):', provC1000.length);
    console.log('[DEBUG Provisionales] Valores RESPCTRLPROD distintos en Centro 1000:', Array.from(respsDistintos));
    console.log('[DEBUG Provisionales] Valores ALMACEN distintos en Centro 1000:', Array.from(almsDistintos));
  }, [ordenes, provC1000]);
  // (Se eliminaron fertC1000/fertC2000, las FERT filtradas por el selector "Fecha": eran las únicas
  //  consumidoras del selector en el lado FERT y alimentaban "Resumen Necesidades", que ahora usa su
  //  propio selector — ver fertC1000Resumen más abajo. El selector "Fecha" quedó como exclusivo de
  //  Provisionales, que es lo que se había decidido.)

  // Tab "Órdenes FERT": ya NO se filtra por el selector "Fecha" (a diferencia de fertC1000/fertC2000
  // de arriba, que siguen date-filtradas porque alimentan las tarjetas de "Resumen Necesidades",
  // summaryData1000/2000 — eso no se tocó). El selector "Fecha" ahora es específico de Provisionales;
  // FERT queda como tab de referencia/comparación, solo con las restricciones de Venta Externa
  // (RESPCTRLPROD/ALMACEN/SECTOR) aplicadas, mostrando todas las fechas a la vez.
  const fertC1000SinFecha = useMemo(() => filterData(ordenesFert, '1000', false), [ordenesFert, grupos, restricciones]);
  const fertC2000SinFecha = useMemo(() => filterData(ordenesFert, '2000', false), [ordenesFert, grupos, restricciones]);

  // "Resumen Necesidades": Órdenes FERT fechadas EXACTO en alguna de las fechas elegidas — vista de
  // "lo ya ejecutado/comprometido" (carga operativa, no necesidad futura), sin cambios por el giro a
  // FERT en la generación del P2 (ver fertC1000ParaP2 más arriba): ese cálculo usa FERT de la fecha
  // SELECCIONADA en "Ventana de Producción" (pasada o futura), mientras que ESTE resumen usa
  // `selectedDatesResumen` (su propio selector, ver más abajo) — son dos ventanas de fecha distintas
  // sobre la misma fuente (FERT), no hay que confundirlas. Match EXACTO por fecha, no acumulado: una
  // fecha = solo ese día; varias fechas = la suma de esos días entre sí, nunca arrastra días previos
  // no elegidos (corregido a pedido del usuario, la primera versión sí acumulaba "hasta" la fecha).
  const soloFertFechasResumen = (data: Record<string, unknown>[]) => data.filter(o => {
    const fecha = String(o.FECHA || o.Fecha || '').split('T')[0];
    return fecha && selectedDatesResumen.includes(fecha);
  });
  const fertC1000Resumen = useMemo(() => soloFertFechasResumen(filterData(ordenesFert, '1000', false)), [ordenesFert, grupos, restricciones, selectedDatesResumen]);
  const fertC2000Resumen = useMemo(() => soloFertFechasResumen(filterData(ordenesFert, '2000', false)), [ordenesFert, grupos, restricciones, selectedDatesResumen]);

  // Ventana informativa de selección (Espumas/Rollos): resume selectedDates en {inicio, fin, fechas}
  // para mostrar en la UI ("Ventana de Producción") y en el mensaje de resultado — ya no se usa para
  // filtrar Provisionales (provC1000/provC2000 filtran directo por FECHAFIN vía filterData, ver ahí).
  // Sin tope de amplitud (antes MAX_DIAS_SELECCION limitaba a 3 días) — el calendario quedó "abierto"
  // a propósito, para poder seleccionar una fecha fuera de la ventana operativa normal como evaluación
  // de tiempo/what-if, no solo el rango real hoy+1..hoy+3.
  const ventanaP2 = useMemo(() => {
    if (selectedDates.length === 0) return { inicio: '', fin: '', fechas: [] as string[] };
    const ordenadas = [...selectedDates].sort();
    const inicio = ordenadas[0];
    const fin = ordenadas[ordenadas.length - 1];
    const fechas = eachDayOfInterval({ start: parseISO(inicio), end: parseISO(fin) }).map(d => format(d, 'yyyy-MM-dd'));
    return { inicio, fin, fechas };
  }, [selectedDates]);
  const tiemposC1000 = useMemo(() => filterData(tiemposEnsamblado, '1000', false), [tiemposEnsamblado, grupos, restricciones]);
  const tiemposC2000 = useMemo(() => filterData(tiemposEnsamblado, '2000', false), [tiemposEnsamblado, grupos, restricciones]);

  // Lookup de tiempos estándar por material+centro para match en Provisionales/FERT
  const buildTiempoLookup = (tiempos: Record<string, unknown>[]) => {
    const map = new Map<string, Record<string, unknown>[]>();
    tiempos.forEach(t => {
      const info = extractMaterialInfo(t);
      if (!map.has(info.code)) map.set(info.code, []);
      map.get(info.code)!.push(t);
    });
    return map;
  };
  const tiempoLookup1000 = useMemo(() => buildTiempoLookup(tiemposC1000), [tiemposC1000]);
  const tiempoLookup2000 = useMemo(() => buildTiempoLookup(tiemposC2000), [tiemposC2000]);

  const matchTiempoEstandar = (materialCode: string, maquina: string, lookup: Map<string, Record<string, unknown>[]>) => {
    const candidates = lookup.get(materialCode);
    if (!candidates || candidates.length === 0) return null;
    const byMaquina = candidates.find(t => {
      const linea = String(t.Linea || t.PuestoTrabajoLinea || '').trim().toUpperCase();
      return linea && linea === String(maquina).trim().toUpperCase();
    });
    const match = byMaquina || candidates[0];
    return Number(match.Tiempo_Min || match.Tiempo || 0);
  };

  // Línea de producción real (ej. "Carruseles - LINEA 1") para poblar linea_produccion al grabar
  // DetalleTactico — mismo lookup que matchTiempoEstandar, sin filtrar por máquina (un material
  // puede repetirse en varios puestos; se toma el primero).
  const matchLineaProduccion = (materialCode: string, lookup: Map<string, Record<string, unknown>[]>) => {
    const candidates = lookup.get(materialCode);
    if (!candidates || candidates.length === 0) return '';
    return String(candidates[0].PuestoTrabajoLinea || candidates[0].Linea || '').trim();
  };

  // --- Necesidad P2 (origen para Corte Espuma / Corte y Laminado) ---
  // Ambas necesidades salen de explotar la lista de materiales (BOM) de las Órdenes FERT
  // (fertC1000ParaP2/fertC2000ParaP2, ya filtradas por centro/RESPCTRLPROD/ALMACEN/SECTOR y por la
  // fecha seleccionada — ver filterData). Cambio de fondo (2026-08-14): antes se usaban Provisionales
  // y FERT quedaba como tab de solo referencia; ahora es al revés — Provisionales sigue existiendo
  // como tab de referencia, sin alimentar el P2.

  // Idéntico al cleanCode de Corte y Laminado (mismo criterio de limpieza de código SAP).
  const cleanCode = (v: unknown) => String(v || '').replace(/^0+/, '').trim();

  const DESCRIPCION_ESPUMA = 'ESPUMA';

  // Fallback de nomenclatura para cuando el componente no tiene responsable conocido (mismo esquema
  // que ES_LAMINA_CORTADA en Corte Espuma, pero con el patrón de nombres real de Venta Externa: aquí
  // las láminas se llaman "LAMINA ESPUMA D…" o "LAMINA CILINDRICA D…", no "LAMINA D…" a secas).
  // Verificado contra los 84 materiales reales: los 81 componentes legítimos EMPIEZAN por "LAMINA";
  // los 3 químicos de formulación que se colaban antes (40000849/50/51, "FLEXPUR VISC…ESPUMA VISC",
  // hijos de 30014085 "BLOQUE FORMULADO D40 VISCO", responsable 005 = Formulación) empiezan por
  // "FLEXPUR" — el patrón los excluye solo, sin necesitar un tope de nivel inventado en el código.
  const ES_LAMINA_VENTA_EXTERNA = (desc: string): boolean => /^LAMINA\b/.test(String(desc || '').trim().toUpperCase());

  // Responsable de Control de Producción por material, armado con las órdenes que este módulo ya
  // carga (Provisionales + FERT completas, sin filtrar). Verificado: resuelve 81 de 81 componentes
  // HALB reales sin necesitar el inventario, y deja sin responsable exactamente a los 3 químicos.
  const responsableDeMaterial = useMemo(() => {
    const map = new Map<string, string>();
    const registrar = (filas: Record<string, unknown>[], campos: string[]) => {
      filas.forEach(o => {
        const code = cleanCode(o.MATERIAL || o.CodMaterial);
        if (!code || map.has(code)) return;
        for (const c of campos) {
          const r = String(o[c] || '').trim();
          if (r) { map.set(code, r); return; }
        }
      });
    };
    registrar(ordenes, ['RESPCONTROLPROD', 'RESPCTRLPROD']);
    registrar(ordenesFert, ['RESPCTRLPROD', 'RESPCONTROLPROD']);
    return map;
  }, [ordenes, ordenesFert]);

  // Responsables que fabrican el HALB (el componente a producir), por centro — restricción
  // `Hojas_Rutas_Materiales` del grupo de Venta Externa. Mismo patrón que ya usa Corte Espuma con
  // RespCtrlProd_Verticales: el criterio lo mantiene el negocio en las restricciones, no una lista de
  // nombres en el código.
  //
  // Los dos niveles del flujo quedan así, cada uno con su propia restricción:
  //   RESPCTRLPROD           → quién es dueño del FERT/PT que se vende (018&045 c1000 · 018 c2000)
  //   Hojas_Rutas_Materiales → quién fabrica el HALB del nivel inferior (038&014 c1000 · 038 c2000)
  //
  // Los valores coinciden exactamente con lo que muestran los datos reales: de los 81 componentes
  // HALB de los materiales de Venta Externa, 74 son del responsable 038 (Corte Espuma) y 1 del 014
  // (30017862, LAMINA CILINDRICA). El lookup se acota a los grupos de Venta Externa (`grupos` en este
  // módulo ya viene filtrado a 18/19) — la misma restricción existe en el grupo 8 con otro
  // significado y no debe mezclarse.
  //
  // Si la restricción no existiera, se acepta cualquier componente con responsable conocido: ya
  // alcanza para dejar fuera los químicos de formulación, que no tienen ninguno.
  const responsablesHalbPorCentro = useMemo(() => {
    const porCentro: Record<string, { lista: string[]; definida: boolean }> = {};
    (['1000', '2000'] as const).forEach(centro => {
      const idsGrupo = grupos.filter(g => String(g.centro).trim() === centro).map(g => g.codigo_grupo);
      const restr = restricciones.find(r =>
        idsGrupo.includes(r.codigo_grupo) &&
        r.estado === 'A' &&
        String(r.nombre_restriccion || '').trim().toUpperCase() === 'HOJAS_RUTAS_MATERIALES'
      );
      porCentro[centro] = restr
        ? { lista: String(restr.valor_restriccion || '').split(/[,&]/).map(v => v.trim()).filter(Boolean), definida: true }
        : { lista: [], definida: false };
    });
    return porCentro;
  }, [grupos, restricciones]);

  // Explota la lista de materiales de cada orden Provisional única del centro: se toma CUALQUIER fila
  // del árbol de BOM cuya descripción coincida con "ESPUMA" o "LAMINA CILINDRICA", sin importar en qué
  // NIVEL aparezca — mismo criterio que ya usa Corte y Laminado para su propia explosión de láminas
  // (ver laminaRows en TacticalPlanCorteLaminadoSection). Este es el filtro real de relevancia: un
  // material Provisional real (con RESP/ClaseOrden correctos) puede seguir sin pertenecer a la
  // Necesidad de Espuma/Rollo si su BOM no contiene ninguno de esos componentes — verificado con datos
  // reales (material 20013403 "BASE RESIFLEX...": su BOM son químicos crudos — TDI, POLYOL, aminas —
  // y partes no-espuma, sin ningún componente ESPUMA/LAMINA CILINDRICA; queda correctamente en
  // sinMatch, no en la Necesidad, aunque la orden en sí sea legítima).
  const explodeNecesidadesFert = async (centro: string, fertOrders: Record<string, unknown>[], onStep: () => void): Promise<{ espumas: NecesidadMaterial[]; rollos: NecesidadMaterial[]; sinMatch: string[]; conError: string[]; trazabilidad: Record<string, string[]> }> => {
    const materialQty = new Map<string, number>();
    fertOrders.forEach(o => {
      const info = extractMaterialInfo(o);
      if (!info.code) return;
      const qty = Number(o.CANTPROGRAMADA || o.CANTIDAD || 0);
      materialQty.set(info.code, (materialQty.get(info.code) || 0) + qty);
    });

    const espumasMap = new Map<string, NecesidadMaterial>();
    const rollosMap = new Map<string, NecesidadMaterial>();
    // Trazabilidad inversa (componente -> FERT/PT que lo necesitan), para "PFD - VENTA": side-output
    // del MISMO BOM walk forward de acá abajo, sin llamadas SAP nuevas. Se usa para, desde un
    // componente YA RESPONDIDO por Corte Espuma/Laminado (Data Aprobada), subir de nivel hacia el
    // FERT/PT que depende de él — dirección opuesta a la de esta función (que baja de FERT a
    // componente) — ver generarPfdVentaPreview.
    const trazabilidadMap = new Map<string, Set<string>>();
    // Diagnóstico: distingue, para cada Provisional que SÍ llegó hasta acá (ya pasó centro +
    // restricciones + fecha), entre "la consulta BOM falló" (conError) y "la consulta respondió pero
    // ninguna fila coincidió con ESPUMA/LAMINA CILINDRICA" (sinMatch) — antes ambos casos
    // desaparecían en silencio, sin dejar rastro de por qué un material con pedido real no
    // terminaba en la tabla de Necesidad.
    const sinMatch: string[] = [];
    const conError: string[] = [];
    for (const [matCode, qty] of materialQty.entries()) {
      const fullCode = matCode.padStart(18, '0');
      let encontroMatch = false;
      try {
        const response = await serviciosService.getMaestroMaterialesExplosion(centro, fullCode, 1, 500);
        const rawData = response?.data?.data || response?.data || [];
        if (Array.isArray(rawData)) {
          rawData.forEach((row: Record<string, unknown>) => {
            const desc = String(row.DESCRIPCION_COMPONENTE || '').toUpperCase();
            // Candidato: la descripción tiene que mencionar espuma o rollo en algún punto. Esto NO
            // decide la relevancia todavía, solo acota qué filas vale la pena evaluar — igual que
            // TIENE_COMPONENTE_ESPUMA en Corte Espuma.
            const esEspuma = desc.includes(DESCRIPCION_ESPUMA);
            const esRollo = desc.includes(DESCRIPCION_ROLLO);
            if (!esEspuma && !esRollo) return;

            const compCode = cleanCode(row.COMPONENTE);
            if (!compCode) return;

            // Relevancia por RESPONSABLE — mismo esquema que usa el PFF de Corte Espuma, sin límite
            // de nivel: se recorre TODO el árbol y se decide por quién fabrica el componente, no por
            // dónde aparece. La restricción `Hojas_Rutas_Materiales` del grupo (018/19) es el
            // criterio autoritativo; el patrón de nombres es solo el respaldo cuando no hay
            // responsable que consultar (componente sin ninguna orden abierta ahora mismo — caso
            // real: 30005709/30005761, láminas legítimas sin demanda activa en este momento).
            const respComp = responsableDeMaterial.get(compCode);
            const reglaHalb = responsablesHalbPorCentro[centro];
            const esDeVentaExterna = respComp
              ? (!reglaHalb?.definida || reglaHalb.lista.includes(respComp))
              : ES_LAMINA_VENTA_EXTERNA(desc);
            if (!esDeVentaExterna) return;

            encontroMatch = true;
            const cantAcum = Number(row.CANTIDAD_ACUMULADA || row.CANTIDAD_UNITARIA || 0);
            const target = esRollo ? rollosMap : espumasMap;
            if (!target.has(compCode)) {
              target.set(compCode, { material: compCode, descripcion: desc, cantidad: 0 });
            }
            target.get(compCode)!.cantidad += qty * cantAcum;
            // Trazabilidad (para "PFD - VENTA", ver arriba): a diferencia de la Necesidad P2 (que
            // acepta un match a CUALQUIER nivel del árbol), acá SÍ importa el nivel — el componente
            // que realmente responde Corte Espuma/Laminado (y que Data Aprobada rastrea) es el hijo
            // DIRECTO del FERT/PT (NIVEL 1 en el árbol de SAP). Un match más profundo (nivel 2, 3...)
            // no es el mismo componente que se está respondiendo — verificado observando el flujo:
            // aceptar cualquier nivel devolvía relaciones incorrectas. Un componente sin match en
            // nivel 1 simplemente no obtiene entrada en `trazabilidadMap` y cae en "Sin trazabilidad"
            // en generarPfdVentaPreview, en vez de generar una relación falsa.
            const nivel = Number(row.NIVEL ?? row.Nivel);
            if (nivel === 1) {
              if (!trazabilidadMap.has(compCode)) trazabilidadMap.set(compCode, new Set());
              trazabilidadMap.get(compCode)!.add(matCode);
            }
          });
        }
        if (!encontroMatch) sinMatch.push(matCode);
      } catch (error) {
        console.warn(`Error explotando BOM para material ${matCode} (centro ${centro}):`, (error as Error).message);
        conError.push(matCode);
      }
      onStep();
    }
    const trazabilidad: Record<string, string[]> = {};
    trazabilidadMap.forEach((fertCodes, compCode) => { trazabilidad[compCode] = Array.from(fertCodes); });
    return {
      espumas: Array.from(espumasMap.values()).sort((a, b) => a.material.localeCompare(b.material)),
      rollos: Array.from(rollosMap.values()).sort((a, b) => a.material.localeCompare(b.material)),
      sinMatch,
      conError,
      trazabilidad,
    };
  };

  const handleCalcularNecesidadRollos = useCallback(async () => {
    if (selectedDates.length === 0) {
      addNotification('warning', 'Selecciona al menos una fecha (filtro "Fecha") antes de calcular la necesidad.');
      return;
    }
    setIsExplodingBom(true);
    setBomDiagnostico({ sinMatch: [], conError: [] });
    try {
      const uniqueMaterialCount = (orders: Record<string, unknown>[]) => new Set(orders.map(o => extractMaterialInfo(o).code).filter(Boolean)).size;
      const total = uniqueMaterialCount(fertC1000ParaP2) + uniqueMaterialCount(fertC2000ParaP2);
      let current = 0;
      setBomProgress({ current: 0, total });
      const onStep = () => setBomProgress({ current: ++current, total });

      const [n1000, n2000] = [
        await explodeNecesidadesFert('1000', fertC1000ParaP2, onStep),
        await explodeNecesidadesFert('2000', fertC2000ParaP2, onStep),
      ];
      setNecesidadEspumas1000(n1000.espumas);
      setNecesidadEspumas2000(n2000.espumas);
      setNecesidadRollos1000(n1000.rollos);
      setNecesidadRollos2000(n2000.rollos);
      // Mantiene el snapshot en sync — si el usuario navega a otro modulo y vuelve, esta tabla ya no
      // aparece vacia (ver SnapshotVentaExterna). No-op si todavia no se sincronizo ningun dato base.
      actualizarEnCache<SnapshotVentaExterna>(CACHE_VENTA_EXTERNA, {
        necesidadEspumas1000: n1000.espumas,
        necesidadEspumas2000: n2000.espumas,
        necesidadRollos1000: n1000.rollos,
        necesidadRollos2000: n2000.rollos,
      });

      const sinMatch = [...n1000.sinMatch, ...n2000.sinMatch];
      const conError = [...n1000.conError, ...n2000.conError];
      setBomDiagnostico({ sinMatch, conError });

      const incidencias = [
        sinMatch.length > 0 ? `${sinMatch.length} FERT sin Espuma/Rollo detectado en su BOM` : null,
        conError.length > 0 ? `${conError.length} FERT con error al consultar el BOM` : null,
      ].filter(Boolean).join(' · ');
      const nivel = sinMatch.length + conError.length > 0 ? 'warning' : 'success';
      addNotification(nivel, `Necesidad calculada (ventana ${ventanaP2.inicio} → ${ventanaP2.fin}) — Centro 1000: ${n1000.espumas.length} espumas / ${n1000.rollos.length} rollos. Centro 2000: ${n2000.espumas.length} espumas / ${n2000.rollos.length} rollos.${incidencias ? ` (${incidencias})` : ''}`);
    } catch (error) {
      addNotification('error', `Error al calcular la necesidad: ${(error as Error).message}`);
    } finally {
      setIsExplodingBom(false);
    }
  }, [fertC1000ParaP2, fertC2000ParaP2, ventanaP2, selectedDates, addNotification]);

  // Segunda fase de "Sincronizar" (ver handleSincronizarYGenerar): dispara handleCalcularNecesidadRollos
  // automáticamente SOLO si ya hay una Ventana de Producción elegida (selectedDates) — si no, se deja
  // callado para que el usuario la elija y lo dispare a mano con el botón "Generar Necesidades · BOM
  // FERT", que sigue disponible aparte (a diferencia de Laminado/Espuma, acá elegir fecha es un paso
  // obligatorio intermedio, no opcional). Declarado después de handleCalcularNecesidadRollos para que
  // la referencia ya sea la versión fresca (sus dependencias, fertC1000ParaP2/fertC2000ParaP2, ya se
  // recalcularon con los datos recién sincronizados).
  useEffect(() => {
    if (!autoGenerarPendiente) return;
    setAutoGenerarPendiente(false);
    if (selectedDates.length === 0) {
      setSyncStep('idle');
      return;
    }
    setSyncStep('generando');
    handleCalcularNecesidadRollos().finally(() => setSyncStep('idle'));
  }, [autoGenerarPendiente, handleCalcularNecesidadRollos, selectedDates]);

  // Consulta inversa: antes de (re)generar un P2, revisa si ya existe uno activo para ese centro+tipo
  // y, de existir, si algún plan P3 (u otro consumidor) ya ejecutó contra él — un DetalleTactico
  // activo cuyo codigo_plan_grupo_padre apunte a ese P2 pero cuyo codigo_plan_grupo sea otro plan.
  // Si ya fue consumido, no se debe reemplazar en silencio (rompería la trazabilidad del P3 activo);
  // si no fue consumido, se desactiva (estado 'I') y se libera el paso para crear el nuevo.
  const verificarPlanP2Activo = async (centro: '1000' | '2000', tipo: 'ESPUMAS' | 'ROLLOS') => {
    const grupoCentro = grupos.find(g => String(g.centro).trim() === centro);
    if (!grupoCentro) return { grupoCentro: null as Grupo | null, planActivo: null as PlanGrupo | null, planesActivos: [] as PlanGrupo[], planesP3: [] as PlanGrupo[], detallesPlanActivo: [] as DetalleTactico[] };

    const valorRegex = new RegExp(`plan\\s*t[aá]ctico.*centro.*${centro}.*p2.*${tipo}`, 'i');
    const planesRes = await planGrupoService.getAll();
    const todosLosPlanes = planesRes.data || [];

    // TODOS los P2 activos de este centro+tipo, no solo el primero que aparezca. Antes esto era un
    // .find(): si por cualquier motivo quedaban dos o más activos (corridas previas, un plan mal
    // fechado que no se apagó), solo se desactivaba uno y el resto quedaba vivo para siempre,
    // conviviendo con el plan nuevo. Se ordenan por fecha y código descendente para que `planActivo`
    // sea el MÁS RECIENTE — es el único candidato razonable a reconciliar.
    const planesActivos = todosLosPlanes
      .filter(pg => pg.estado === 'A' && pg.codigo_grupo === grupoCentro.codigo_grupo && valorRegex.test(String(pg.valor || '')))
      .sort((a, b) => {
        const porFecha = soloFecha(b.fecha_inicio_plan).localeCompare(soloFecha(a.fecha_inicio_plan));
        return porFecha !== 0 ? porFecha : b.codigo_plan_grupo - a.codigo_plan_grupo;
      });
    const planActivo = planesActivos[0] || null;

    if (!planActivo) return { grupoCentro, planActivo: null, planesActivos, planesP3: [], detallesPlanActivo: [] as DetalleTactico[] };

    const detallesRes = await detalleTacticoService.getAll();
    const todosLosDetalles = detallesRes.data || [];
    const planPorCodigo = new Map(todosLosPlanes.map(pg => [pg.codigo_plan_grupo, pg]));
    const codigosP3 = new Set(
      todosLosDetalles
        .filter(d => d.estado === 'A' && d.codigo_plan_grupo_padre === planActivo.codigo_plan_grupo && d.codigo_plan_grupo !== planActivo.codigo_plan_grupo)
        .map(d => d.codigo_plan_grupo)
    );
    const planesP3 = Array.from(codigosP3)
      .map(c => planPorCodigo.get(c))
      .filter((p): p is PlanGrupo => !!p && p.estado === 'A');

    const detallesPlanActivo = todosLosDetalles.filter(d => d.estado === 'A' && d.codigo_plan_grupo === planActivo.codigo_plan_grupo);

    return { grupoCentro, planActivo, planesActivos, planesP3, detallesPlanActivo };
  };

  type ResultadoGeneracionP2 = {
    centro: '1000' | '2000';
    tipo: 'ESPUMAS' | 'ROLLOS';
    status: 'ok' | 'sin-datos' | 'bloqueado' | 'error' | 'confirmar-reemplazo';
    mensaje: string;
    codigoPlan?: number;
  };

  // Núcleo sin notificaciones: genera el PlanGrupo "origen" (P2) de un centro para UN tipo de
  // necesidad (Espumas o Rollos — son dos planes independientes, no uno combinado) y devuelve un
  // resultado estructurado por subgrupo (centro+tipo). Al ser el origen de la cadena (Venta Externa
  // no consume de nadie más), codigo_plan_grupo_padre se auto-referencia al propio plan recién creado.
  // Se reutiliza tanto para el botón individual como para "Generar Todos", que la llama 4 veces
  // (una por cada combinación centro×tipo) y consolida los 4 resultados en un solo resumen.
  //
  // `forzar`: solo aplica a ESPUMAS (ver más abajo) — confirma que se acepta reemplazar un P2 activo
  // que está fechado para OTRO día distinto al que se está por grabar (ver status 'confirmar-reemplazo').
  const generarPlanP2Core = useCallback(async (centro: '1000' | '2000', tipo: 'ESPUMAS' | 'ROLLOS', forzar = false): Promise<ResultadoGeneracionP2> => {
    const key = `${centro}-${tipo}`;
    const lineas = (tipo === 'ESPUMAS'
      ? (centro === '1000' ? necesidadEspumas1000 : necesidadEspumas2000)
      : (centro === '1000' ? necesidadRollos1000 : necesidadRollos2000)
    ).filter(l => l.cantidad > 0);

    if (lineas.length === 0) {
      return { centro, tipo, status: 'sin-datos', mensaje: `No hay necesidad de ${TIPO_TAG[tipo]} calculada para el Centro ${centro}.` };
    }

    setSavingPlanP2(prev => ({ ...prev, [key]: true }));
    try {
      const { grupoCentro, planActivo, planesActivos, planesP3, detallesPlanActivo } = await verificarPlanP2Activo(centro, tipo);
      if (!grupoCentro) {
        return { centro, tipo, status: 'error', mensaje: `No se encontró el grupo de Venta Externa para el Centro ${centro}.` };
      }

      const user = typeof window !== 'undefined' ? JSON.parse(localStorage.getItem('user') || '{}') : {};
      const usuario = user?.name || 'admin';

      // ESPUMAS: el P2 se graba con la "fecha del PT" — la que el planificador seleccionó en el
      // filtro "Ventana de Producción" (ventanaP2, ya usado para decidir qué FERT entran a la
      // explosión de BOM, ver fertC1000ParaP2/fertC2000ParaP2). Antes se grababa SIEMPRE a hoy + 1
      // día hábil, desacoplado de esa selección — mismo criterio que ya usa P1/PFF en Corte Espuma
      // (grabar la fecha real de producción, no un offset fijo). ROLLOS no cambia: sigue fijo a
      // hoy+1, es de Corte y Laminado, fuera de este ajuste. Fallback defensivo: si lineas.length>0
      // aquí, ventanaP2 ya debería estar poblada (la necesidad de Espumas se filtró por selectedDates
      // vía fertC1000ParaP2/fertC2000ParaP2) — si igual llegara vacía, se cae al viejo hoy+1.
      const fechaPlanP2 = tipo === 'ESPUMAS'
        ? (ventanaP2.fin || ventanaP2.inicio || format(siguienteDiaHabil(new Date()), 'yyyy-MM-dd'))
        : format(siguienteDiaHabil(new Date()), 'yyyy-MM-dd');

      // Salvaguarda: "Ventana de Producción" se dejó a propósito sin tope, para evaluar fechas fuera
      // de la ventana operativa normal ("qué pasaría si") — ver su comentario. Con ESPUMAS ahora
      // grabando esa fecha, generar con una fecha de prueba reemplazaría en silencio el plan activo
      // real (con otra fecha), descuadrando la necesidad que ve Corte Espuma sin ningún aviso. Si hay
      // un plan activo fechado para OTRO día que el que se va a grabar y todavía no se confirmó
      // (forzar=false), se corta ANTES de escribir nada — el caller decide si confirma y reintenta
      // con forzar=true.
      if (tipo === 'ESPUMAS' && planActivo && !forzar && soloFecha(planActivo.fecha_inicio_plan) !== fechaPlanP2) {
        return {
          centro, tipo, status: 'confirmar-reemplazo',
          mensaje: `${TIPO_TAG[tipo]} Centro ${centro}: ya existe un Plan #${planActivo.codigo_plan_grupo} activo fechado ${soloFecha(planActivo.fecha_inicio_plan)} — generar con la fecha seleccionada (${fechaPlanP2}) lo desactivará. ¿Continuar?`,
        };
      }

      // La generación es diaria, pero acotada al MISMO día hábil (antes se reconciliaba el mismo
      // Plan Grupo indefinidamente, sin importar cuántos días hubieran pasado — un plan de hace 3
      // días terminaba representando la necesidad de hoy, con su propia fecha_inicio_plan sin
      // actualizar). Si el plan activo ya es de hoy (mismo fechaPlanP2), se reconcilia por material
      // sobre el mismo codigo_plan_grupo (actualiza cantidad si el material ya tenía línea, agrega
      // línea nueva si es un material que apareció recién) — evita duplicar planes si se corre varias
      // veces el mismo día. Si el plan activo es de un día ANTERIOR, se crea un plan NUEVO con la
      // fecha de hoy y el anterior se desactiva (estado -> 'I') con el mismo criterio ya probado en
      // Corte y Laminado (ver desactivarPlanGrupo ahí): solo se apaga el PlanGrupo, sus
      // DetalleTactico NO cambian de estado — evita el bug de filas huérfanas que causó
      // planGrupoService.save() sobre un plan existente la vez anterior.
      const planActivoEsDeHoy = planActivo && soloFecha(planActivo.fecha_inicio_plan) === fechaPlanP2;

      // La advertencia solo aplica si se intenta REGENERAR EL MISMO CICLO que un P3 ya respondió —
      // cambiar en silencio las cantidades de un P2 que Corte Espuma/Laminado ya usó para fechar SU
      // respuesta sí rompería esa trazabilidad. Un P2 de un ciclo distinto (de un día anterior, como
      // #122/#123 fechados hoy mientras se genera el ciclo de mañana) no advierte aunque tenga P3
      // encima — su P3 respondió a ESE ciclo, ya cerrado desde la perspectiva del ciclo que se está
      // generando ahora; no hace falta "coordinar" nada, se desactiva y se sigue (ver rama de abajo).
      // Antes se comparaba la fecha del P3 contra "hoy" (planesP3Abiertos), pero eso bloqueaba igual
      // un P3 fechado exactamente hoy — que es precisamente el caso normal al generar el ciclo de
      // mañana.
      //
      // Antes esto era un bloqueo SIN salida ('bloqueado', sin forzar posible) — el usuario no tenía
      // forma de regenerar el P2 salvo desactivando el plan a mano fuera de la app. Se cambió al mismo
      // patrón de confirmación que ya usa el reemplazo por fecha distinta (status 'confirmar-reemplazo'
      // + forzar=true): informa la consecuencia real (el P3 #438/#439 va a quedar huérfano de su
      // origen) y deja que el usuario decida con conocimiento, en vez de dejarlo sin poder avanzar.
      if (planActivoEsDeHoy && planActivo && planesP3.length > 0 && !forzar) {
        return {
          centro, tipo, status: 'confirmar-reemplazo',
          mensaje: `${TIPO_TAG[tipo]} Centro ${centro}: el Plan #${planActivo.codigo_plan_grupo} (mismo ciclo que se está generando) ya fue ejecutado por el/los Plan(es) P3 #${planesP3.map(p => p.codigo_plan_grupo).join(', #')}. Si regeneras, ese P3 queda sin el P2 que lo originó (huérfano) y Corte Espuma/Laminado tendría que volver a responder. ¿Continuar de todas formas?`,
        };
      }

      let codigoPlanGrupo: number;
      let esActualizacion = false;
      const planesDesactivados: number[] = [];

      // Apaga TODOS los P2 activos de este centro+tipo salvo el que se indique conservar. Un plan P2
      // vigente por centro+tipo y nada más: si se crea uno nuevo (o se ajusta uno existente), los
      // anteriores dejan de representar la necesidad y deben quedar en 'I'. Solo se apaga el
      // PlanGrupo — sus DetalleTactico NO cambian de estado, para no dejar filas huérfanas (mismo
      // criterio ya probado en Corte y Laminado, ver desactivarPlanGrupo ahí).
      const desactivarOtrosPlanes = async (conservar: number | null) => {
        for (const pg of planesActivos) {
          if (pg.codigo_plan_grupo === conservar) continue;
          await planGrupoService.save({ ...pg, estado: 'I' } as unknown as PlanGrupo);
          planesDesactivados.push(pg.codigo_plan_grupo);
        }
      };

      if (planActivoEsDeHoy && planActivo) {
        codigoPlanGrupo = planActivo.codigo_plan_grupo;
        esActualizacion = true;
        // Se reconcilia el del día, pero cualquier otro que siguiera activo igual se apaga.
        await desactivarOtrosPlanes(codigoPlanGrupo);
      } else {
        await desactivarOtrosPlanes(null);
        const planPayload = {
          codigo_plan_grupo: 0,
          codigo_grupo: grupoCentro.codigo_grupo,
          codigo_familia_grupo: null,
          codigo_plan: null,
          valor: `Plan Táctico - Centro ${centro} - P2 - ${TIPO_TAG[tipo]}`,
          fecha_inicio_plan: fechaPlanP2,
          fecha_fin_plan: fechaPlanP2,
          estado: 'A',
          usuario_creacion: usuario,
          // Faltaba en el payload — la columna quedaba NULL en BD (verificado con datos reales,
          // ver [[plan_grupo_fecha_creacion_faltante]]). Mismo patrón ya usado en
          // grupo-operadores/components/form.tsx (fecha_creacion: new Date()).
          fecha_creacion: new Date(),
        };
        const planResponse = await planGrupoService.save(planPayload as unknown as PlanGrupo);
        codigoPlanGrupo = planResponse.data.codigo_plan_grupo;
      }

      // Solo hay líneas "ya existentes" para reconciliar cuando seguimos sobre el plan de hoy — un
      // plan recién creado (o recién reemplazado) empieza sin detalle previo.
      const existentePorMaterial = esActualizacion
        ? new Map(detallesPlanActivo.map(d => [String(Number(d.codigo_material)), d]))
        : new Map<string, DetalleTactico>();

      let actualizados = 0;
      let agregados = 0;
      let fallidos = 0;
      for (const linea of lineas) {
        try {
          const existente = existentePorMaterial.get(String(Number(linea.material)));
          const detallePayload = {
            codigo_detalle_tactico: existente ? existente.codigo_detalle_tactico : 0,
            codigo_material: Number(linea.material),
            cantidad_produccion_neta: Math.round(linea.cantidad).toFixed(0),
            resp_ctrl_prod: '',
            clase_aprovisionamiento: 'E',
            cantidad_aprovisionamiento: 0,
            estado: 'A',
            codigo_plan_grupo: codigoPlanGrupo,
            // Sin auto-referencia: verificado contra datos reales (plan #36 "Forros" y 317/375
            // filas de detalle_tactico en producción) que codigo_plan_grupo_padre se deja vacío en
            // el plan ORIGEN — solo se llena en las líneas del plan CONSUMIDOR (P3) cuando de verdad
            // hereda de un origen rastreable.
            codigo_plan_grupo_padre: null,
            usuario_modificacion: usuario,
            linea_produccion: matchLineaProduccion(linea.material, centro === '1000' ? tiempoLookup1000 : tiempoLookup2000),
          };
          await detalleTacticoService.save(detallePayload as unknown as DetalleTactico);
          if (existente) actualizados++; else agregados++;
        } catch (error) {
          console.warn(`[Plan P2 ${tipo}] Falló material ${linea.material}:`, (error as Error).message);
          fallidos++;
        }
      }

      setPlanP2Generado(prev => ({ ...prev, [key]: codigoPlanGrupo }));
      const sufijoP3Cerrados = planesDesactivados.length > 0 && planesP3.length > 0
        ? ` (ya cerrado por Plan(es) P3 #${planesP3.map(p => p.codigo_plan_grupo).join(', #')})`
        : '';
      const sufijoDesactivado = planesDesactivados.length > 0
        ? ` Plan(es) anterior(es) #${planesDesactivados.join(', #')}${sufijoP3Cerrados} desactivado(s).`
        : '';
      // El sufijo de desactivación va en ambos caminos: reconciliar el plan del día también puede
      // haber apagado otros planes que seguían activos.
      const accion = esActualizacion
        ? `actualizado (${agregados} agregados, ${actualizados} refrescados).${sufijoDesactivado}`
        : `creado (${agregados} materiales) para ${fechaPlanP2}.${sufijoDesactivado}`;
      if (fallidos === 0) {
        return { centro, tipo, status: 'ok', codigoPlan: codigoPlanGrupo, mensaje: `${TIPO_TAG[tipo]} Centro ${centro}: Plan #${codigoPlanGrupo} ${accion}.` };
      }
      return { centro, tipo, status: 'ok', codigoPlan: codigoPlanGrupo, mensaje: `${TIPO_TAG[tipo]} Centro ${centro}: Plan #${codigoPlanGrupo} ${accion}, ${fallidos} fallidos.` };
    } catch (error) {
      return { centro, tipo, status: 'error', mensaje: `${TIPO_TAG[tipo]} Centro ${centro}: error al guardar — ${(error as Error).message}` };
    } finally {
      setSavingPlanP2(prev => ({ ...prev, [key]: false }));
    }
  }, [grupos, necesidadEspumas1000, necesidadEspumas2000, necesidadRollos1000, necesidadRollos2000, ventanaP2, siguienteDiaHabil, tiempoLookup1000, tiempoLookup2000]);

  // "PFD - VENTA": mismo grupo (18/19) y patrón de guardado que el P2 (generarPlanP2Core arriba), pero
  // el valor lleva el token compuesto "PFD-VENTA" (no "PFD" suelto, para no chocar con el /pfd/i que ya
  // usa Corte y Laminado bajo SU propio codigo_grupo=8 — acá vive en el codigo_grupo de Venta Externa,
  // así que el riesgo real es bajo, pero se evita igual) y cada línea de DetalleTactico graba
  // codigo_plan_grupo_padre = el P2 activo del que se deriva (a diferencia del P2, que no se
  // auto-referencia — ver el comentario en generarPlanP2Core). Requiere haber generado la vista previa
  // primero (pfdVentaPreview, ver generarPfdVentaPreview) — solo Espumas, un plan por centro.
  const guardarPfdVentaCore = useCallback(async (centro: '1000' | '2000'): Promise<ResultadoGeneracionP2> => {
    const tipo = 'ESPUMAS' as const;
    const key = `PFD-${centro}`;
    const lineas = pfdVentaPreview[centro]?.lineas || [];
    if (lineas.length === 0) {
      return { centro, tipo, status: 'sin-datos', mensaje: `No hay materiales PFD-VENTA generados para el Centro ${centro} — pulsa "Generar PFD-VENTA" primero.` };
    }

    setSavingPfdVenta(prev => ({ ...prev, [key]: true }));
    try {
      const { grupoCentro: grupoP2, planActivo: p2Activo } = await verificarPlanP2Activo(centro, tipo);
      if (!grupoP2 || !p2Activo) {
        return { centro, tipo, status: 'error', mensaje: `No hay un P2 activo de Espumas para el Centro ${centro} — PFD-VENTA necesita un P2 vigente del que derivar.` };
      }

      const user = typeof window !== 'undefined' ? JSON.parse(localStorage.getItem('user') || '{}') : {};
      const usuario = user?.name || 'admin';

      // Búsqueda propia del PFD-VENTA activo (mismo patrón que verificarPlanP2Activo, con su propia
      // regex — no se reutiliza esa función porque busca por "...p2...", no por "...pfd-venta...").
      const valorRegexPfd = new RegExp(`plan\\s*t[aá]ctico.*centro.*${centro}.*pfd-venta.*${tipo}`, 'i');
      const planesRes = await planGrupoService.getAll();
      const todosLosPlanes = planesRes.data || [];
      const planesActivosPfd = todosLosPlanes.filter(pg =>
        pg.estado === 'A' && pg.codigo_grupo === grupoP2.codigo_grupo && valorRegexPfd.test(String(pg.valor || ''))
      );
      for (const pg of planesActivosPfd) {
        await planGrupoService.save({ ...pg, estado: 'I' } as unknown as PlanGrupo);
      }

      const planPayload = {
        codigo_plan_grupo: 0,
        codigo_grupo: grupoP2.codigo_grupo,
        codigo_familia_grupo: null,
        codigo_plan: null,
        valor: `Plan Táctico - Centro ${centro} - PFD-VENTA - ${TIPO_TAG[tipo]}`,
        // Misma ventana que el P2 del que deriva — PFD-VENTA no tiene fecha propia, hereda la del
        // ciclo que lo originó.
        fecha_inicio_plan: soloFecha(p2Activo.fecha_inicio_plan) || format(siguienteDiaHabil(new Date()), 'yyyy-MM-dd'),
        fecha_fin_plan: soloFecha(p2Activo.fecha_fin_plan) || format(siguienteDiaHabil(new Date()), 'yyyy-MM-dd'),
        estado: 'A',
        usuario_creacion: usuario,
        fecha_creacion: new Date(),
      };
      const planResponse = await planGrupoService.save(planPayload as unknown as PlanGrupo);
      const codigoPlanGrupo = planResponse.data.codigo_plan_grupo;

      let agregados = 0;
      let fallidos = 0;
      for (const linea of lineas) {
        try {
          const detallePayload = {
            codigo_detalle_tactico: 0,
            codigo_material: Number(linea.material),
            cantidad_produccion_neta: Math.round(linea.cantidad).toFixed(0),
            resp_ctrl_prod: '',
            clase_aprovisionamiento: 'E',
            cantidad_aprovisionamiento: 0,
            estado: 'A',
            codigo_plan_grupo: codigoPlanGrupo,
            codigo_plan_grupo_padre: p2Activo.codigo_plan_grupo,
            usuario_modificacion: usuario,
            linea_produccion: matchLineaProduccion(linea.material, centro === '1000' ? tiempoLookup1000 : tiempoLookup2000),
          };
          await detalleTacticoService.save(detallePayload as unknown as DetalleTactico);
          agregados++;
        } catch (error) {
          console.warn(`[PFD-VENTA] Falló material ${linea.material}:`, (error as Error).message);
          fallidos++;
        }
      }

      setPfdVentaGenerado(prev => ({ ...prev, [key]: codigoPlanGrupo }));
      const sufijo = planesActivosPfd.length > 0
        ? ` Plan(es) anterior(es) #${planesActivosPfd.map(p => p.codigo_plan_grupo).join(', #')} desactivado(s).`
        : '';
      if (fallidos === 0) {
        return { centro, tipo, status: 'ok', codigoPlan: codigoPlanGrupo, mensaje: `PFD-VENTA Centro ${centro}: Plan #${codigoPlanGrupo} creado (${agregados} materiales), derivado del P2 #${p2Activo.codigo_plan_grupo}.${sufijo}` };
      }
      return { centro, tipo, status: 'ok', codigoPlan: codigoPlanGrupo, mensaje: `PFD-VENTA Centro ${centro}: Plan #${codigoPlanGrupo} creado (${agregados} materiales), ${fallidos} fallidos.${sufijo}` };
    } catch (error) {
      return { centro, tipo, status: 'error', mensaje: `PFD-VENTA Centro ${centro}: error al guardar — ${(error as Error).message}` };
    } finally {
      setSavingPfdVenta(prev => ({ ...prev, [key]: false }));
    }
  }, [pfdVentaPreview, siguienteDiaHabil, tiempoLookup1000, tiempoLookup2000]);

  // Botón individual por bloque: genera un solo subgrupo y notifica su resultado puntual.
  // 'confirmar-reemplazo' (solo ESPUMAS, ver generarPlanP2Core): se cortó ANTES de escribir porque la
  // fecha seleccionada reemplazaría un plan activo fechado distinto — se confirma acá y, si se
  // acepta, se reintenta la misma llamada con forzar=true.
  const handleGenerarPlanP2 = useCallback(async (centro: '1000' | '2000', tipo: 'ESPUMAS' | 'ROLLOS') => {
    let resultado = await generarPlanP2Core(centro, tipo);
    if (resultado.status === 'confirmar-reemplazo') {
      if (window.confirm(resultado.mensaje)) {
        resultado = await generarPlanP2Core(centro, tipo, true);
      } else {
        addNotification('warning', `${resultado.mensaje} (cancelado por el usuario, no se hizo ningún cambio)`);
        return;
      }
    }
    const nivel = resultado.status === 'ok' ? 'success' : resultado.status === 'sin-datos' ? 'warning' : 'error';
    addNotification(nivel, resultado.mensaje);
  }, [generarPlanP2Core, addNotification]);

  // Botón único "Generar Todos los P2": recorre los 3 subgrupos vigentes SECUENCIALMENTE (cada uno
  // hace su propia verificación P3 + guardado/actualización; correrlos en paralelo arriesgaría
  // condiciones de carrera sobre el mismo PlanGrupo activo), y consolida los resultados en un único
  // resumen — no dispara notificaciones sueltas. Rollos - Centro 2000 no aplica: no hay actividad de
  // Corte y Laminado en ese centro.
  const handleGenerarTodosPlanesP2 = useCallback(async () => {
    setIsSavingAllPlanP2(true);
    try {
      const combos: Array<{ centro: '1000' | '2000'; tipo: 'ESPUMAS' | 'ROLLOS' }> = [
        { centro: '1000', tipo: 'ESPUMAS' },
        { centro: '1000', tipo: 'ROLLOS' },
        { centro: '2000', tipo: 'ESPUMAS' },
      ];

      const resultados: ResultadoGeneracionP2[] = [];
      for (const combo of combos) {
        let resultado = await generarPlanP2Core(combo.centro, combo.tipo);
        // 'confirmar-reemplazo' (solo ESPUMAS): mismo criterio que el botón individual — se confirma
        // acá antes de seguir con el resto del loop, y si se cancela se cuenta como 'bloqueado' (no
        // se escribió nada, mismo tratamiento de notificación que ya existe para ese status).
        if (resultado.status === 'confirmar-reemplazo') {
          if (window.confirm(resultado.mensaje)) {
            resultado = await generarPlanP2Core(combo.centro, combo.tipo, true);
          } else {
            resultado = { ...resultado, status: 'bloqueado', mensaje: `${resultado.mensaje} (cancelado por el usuario, no se hizo ningún cambio)` };
          }
        }
        resultados.push(resultado);
      }

      const ok = resultados.filter(r => r.status === 'ok');
      const bloqueados = resultados.filter(r => r.status === 'bloqueado');
      const sinDatos = resultados.filter(r => r.status === 'sin-datos');
      const errores = resultados.filter(r => r.status === 'error');

      const resumen = resultados.map(r => `[${r.status.toUpperCase()}] ${r.mensaje}`).join(' | ');
      if (errores.length === 0 && bloqueados.length === 0) {
        addNotification('success', `Generación completa: ${ok.length} plan(es) guardado(s), ${sinDatos.length} sin datos. ${resumen}`);
      } else {
        addNotification('warning', `Generación con incidencias: ${ok.length} ok, ${bloqueados.length} bloqueado(s), ${sinDatos.length} sin datos, ${errores.length} error(es). ${resumen}`);
      }
    } finally {
      setIsSavingAllPlanP2(false);
    }
  }, [generarPlanP2Core, addNotification]);

  // "Data Aprobada": por cada P2 propio activo (Espumas/Rollos por centro), recupera qué respondió
  // el plan consumidor "P3" (nunca "PFD" — ver esPlanP3) — un DetalleTactico con
  // codigo_plan_grupo_padre = nuestro plan y el mismo codigo_material, pero perteneciente a OTRO
  // codigo_plan_grupo (el del P3). Si un material tiene más de una respuesta (varios P3), se suman
  // las cantidades y se listan los planes separados por coma. Se recalcula siempre contra la API (no
  // depende de haber corrido "Calcular Necesidad" en la misma sesión), así sigue funcionando después
  // de recargar la página.
  const fetchDataAprobada = useCallback(async () => {
    setIsLoadingDataAprobada(true);
    try {
      const [planesRes, detallesRes] = await Promise.all([planGrupoService.getAll(), detalleTacticoService.getAll()]);
      const planes = planesRes.data || [];
      const detalles = detallesRes.data || [];
      const planPorCodigo = new Map(planes.map(pg => [pg.codigo_plan_grupo, pg]));

      const descripcionPorMaterial = new Map<string, string>();
      [...necesidadEspumas1000, ...necesidadEspumas2000, ...necesidadRollos1000, ...necesidadRollos2000]
        .forEach(n => descripcionPorMaterial.set(n.material, n.descripcion));

      const combos: Array<{ centro: '1000' | '2000'; tipo: 'ESPUMAS' | 'ROLLOS' }> = [
        { centro: '1000', tipo: 'ESPUMAS' },
        { centro: '1000', tipo: 'ROLLOS' },
        { centro: '2000', tipo: 'ESPUMAS' },
      ];

      const resultado: Record<string, DataAprobadaRow[]> = {};

      for (const combo of combos) {
        const key = `${combo.centro}-${combo.tipo}`;
        const grupoCentro = grupos.find(g => String(g.centro).trim() === combo.centro);
        if (!grupoCentro) { resultado[key] = []; continue; }

        const valorRegex = new RegExp(`plan\\s*t[aá]ctico.*centro.*${combo.centro}.*p2.*${combo.tipo}`, 'i');
        const planPropio = planes.find(pg =>
          pg.estado === 'A' && pg.codigo_grupo === grupoCentro.codigo_grupo && valorRegex.test(String(pg.valor || ''))
        );
        if (!planPropio) { resultado[key] = []; continue; }

        const misLineas = detalles.filter(d => d.estado === 'A' && d.codigo_plan_grupo === planPropio.codigo_plan_grupo);
        resultado[key] = misLineas.map(linea => {
          const respuestas = detalles.filter(d =>
            d.estado === 'A' &&
            d.codigo_plan_grupo_padre === planPropio.codigo_plan_grupo &&
            d.codigo_material === linea.codigo_material &&
            d.codigo_plan_grupo !== planPropio.codigo_plan_grupo &&
            esPlanP3(planPorCodigo.get(d.codigo_plan_grupo)?.valor)
          );
          const respuestaCant = respuestas.reduce((s, r) => s + parseQty(r.cantidad_produccion_neta), 0);
          const codigosPlanesRespuesta = Array.from(new Set(respuestas.map(r => r.codigo_plan_grupo)));
          const planGrupo = codigosPlanesRespuesta.length > 0
            ? codigosPlanesRespuesta.map(c => String(c).padStart(3, '0')).join(', ')
            : '—';

          // Contraste de fechas: se compara por LÍNEA (fecha_modificacion de DetalleTactico, que fija
          // el backend al guardar — no lo controla el cliente), no por rango de PlanGrupo. Laminado
          // ahora fuerza fecha_inicio_plan/fecha_fin_plan del P3 siempre a "hoy+1" al guardar (dejó de
          // representar un período de producción), así que ya no es comparable contra el rango del P2.
          // Regla de negocio: "revisión hoy, devolución mañana" — la respuesta debe haberse guardado
          // EXACTAMENTE un día después de la última vez que se guardó/refrescó nuestra línea del P2.
          let fechasOk: boolean | null = null;
          const fechaLineaP2 = soloFecha(linea.fecha_modificacion);
          if (respuestas.length > 0) {
            fechasOk = !!fechaLineaP2 && respuestas.every(r => {
              const fechaLineaP3 = soloFecha(r.fecha_modificacion);
              if (!fechaLineaP3) return false;
              const fechaEsperada = format(addDays(parseISO(fechaLineaP2), 1), 'yyyy-MM-dd');
              return fechaLineaP3 === fechaEsperada;
            });
          }

          return {
            material: String(linea.codigo_material),
            descripcion: descripcionPorMaterial.get(String(linea.codigo_material)) || '—',
            cantidad: parseQty(linea.cantidad_produccion_neta),
            respuestaCant,
            planGrupo,
            fechasOk,
          };
        }).sort((a, b) => a.material.localeCompare(b.material));
      }

      setDataAprobada(resultado);
      // Mantiene el snapshot en sync — si el usuario navega a otro módulo y vuelve, este tab ya no
      // aparece vacío (ver SnapshotVentaExterna.dataAprobada). No-op si todavía no se sincronizó
      // ningún dato base (actualizarEnCache no escribe sobre un snapshot inexistente).
      actualizarEnCache<SnapshotVentaExterna>(CACHE_VENTA_EXTERNA, { dataAprobada: resultado });
    } catch (error) {
      addNotification('error', `Error al recuperar Data Aprobada: ${(error as Error).message}`);
    } finally {
      setIsLoadingDataAprobada(false);
    }
  }, [grupos, necesidadEspumas1000, necesidadEspumas2000, necesidadRollos1000, necesidadRollos2000, addNotification]);

  const calculateSummary = (data: Record<string, unknown>[], centroId: string) => {
    const lookup = centroId === '1000' ? tiempoLookup1000 : tiempoLookup2000;
    const map = new Map<string, { centro: string; maquina: string; categoria: string; densidad: string; espesor: string; tipo: string; totalOrdenes: number; totalCantidad: number; totalTiempoEmpaque: number }>();
    data.forEach(o => {
      const categoria = String(o.CATEGORIA || o.Categoria || o.categoria || '').trim();
      if (!categoria || categoria === 'N/A') return;

      const maquina = String(o.MAQUINA || o.Maquina || o.maquina || o.RECURSO || 'SIN MÁQUINA').trim();
      const info = extractMaterialInfo(o);
      const espesor = info.esp || '—';
      const tipo = info.tipo || '—';
      const densidad = info.dens || '—';
      const key = `${maquina}|${categoria}|${espesor}|${tipo}`;

      const qty = Number(o.CANTPROGRAMADA || o.CANTIDAD || 0);
      // Tiempo real de SAP (mismo cruce material+máquina que ya usa "T. Estándar (Min)" en las
      // tablas Provisionales/FERT — ver matchTiempoEstandar): verificado con dato real (material
      // 20006172, PLANCHA ESPUMA D12, HojaRuta HR-LAMR1, Tiempo_Min=0.0113) que el placeholder fijo
      // de 15seg/unidad sobreestimaba ~22x (7.00h mostradas vs ~0.32h reales). Si el material no
      // tiene tiempo estándar en el catálogo (caso no verificado hoy), se usa el placeholder como
      // respaldo en vez de mostrar 0h, que sería más engañoso todavía.
      const tiempoEstandarMin = matchTiempoEstandar(info.code, maquina, lookup);
      const empaqueHours = tiempoEstandarMin !== null ? (qty * tiempoEstandarMin) / 60 : (qty * PACKING_TIME_PER_UNIT_SECONDS) / 3600;

      if (!map.has(key)) {
        map.set(key, { centro: centroId, maquina, categoria, densidad, espesor, tipo, totalOrdenes: 0, totalCantidad: 0, totalTiempoEmpaque: 0 });
      }
      const entry = map.get(key)!;
      entry.totalOrdenes += 1;
      entry.totalCantidad += qty;
      entry.totalTiempoEmpaque += empaqueHours;
    });
    return Array.from(map.values()).sort((a, b) =>
      a.maquina.localeCompare(b.maquina) || a.categoria.localeCompare(b.categoria) || a.espesor.localeCompare(b.espesor)
    );
  };

  const summaryData1000 = useMemo(() => calculateSummary(fertC1000Resumen, '1000'), [fertC1000Resumen]);
  const summaryData2000 = useMemo(() => calculateSummary(fertC2000Resumen, '2000'), [fertC2000Resumen]);

  // Agrupación por Categoría Técnica (la categoría ya embebe la densidad, p.ej. D40ESP)
  const groupByCategoria = (data: typeof summaryData1000) => {
    const map = new Map<string, { categoria: string; densidad: string; tipo: string; rows: typeof summaryData1000; totalOrdenes: number; totalCantidad: number; totalTiempoEmpaque: number }>();
    data.forEach(row => {
      if (!map.has(row.categoria)) {
        map.set(row.categoria, { categoria: row.categoria, densidad: row.densidad, tipo: row.tipo, rows: [], totalOrdenes: 0, totalCantidad: 0, totalTiempoEmpaque: 0 });
      }
      const group = map.get(row.categoria)!;
      group.rows.push(row);
      group.totalOrdenes += row.totalOrdenes;
      group.totalCantidad += row.totalCantidad;
      group.totalTiempoEmpaque += row.totalTiempoEmpaque;
    });
    return Array.from(map.values()).sort((a, b) => a.categoria.localeCompare(b.categoria));
  };

  const groupedSummary1000 = useMemo(() => groupByCategoria(summaryData1000), [summaryData1000]);
  const groupedSummary2000 = useMemo(() => groupByCategoria(summaryData2000), [summaryData2000]);

  // "PFD - VENTA": dirección OPUESTA a explodeNecesidadesFert — en vez de bajar de FERT/PT a
  // componente, sube desde el componente YA RESPONDIDO (Data Aprobada, estado 'completo') hacia su(s)
  // FERT/PT padre. La trazabilidad (componente -> FERT/PT) se calcula FRESCA acá mismo, en cada clic
  // de "Generar PFD-VENTA" (mismo BOM que ya generó el P2 — sin datos nuevos, solo se vuelve a
  // recorrer) — antes se guardaba en un estado aparte (trazabilidadPT1000/2000) que solo se llenaba al
  // pulsar "Generar Necesidades · BOM FERT" en otro punto del módulo: si Data Aprobada ya estaba
  // actualizada sin haber vuelto a pasar por ese botón en la misma sesión, PFD-VENTA no encontraba
  // trazabilidad para NADA (reportado por el usuario con datos reales) — recalcularla acá elimina esa
  // dependencia oculta.
  //
  // El universo de FERT NO sale de fertC1000ParaP2/fertC2000ParaP2 directo — esos dependen de
  // `selectedDates` (la "Ventana de Producción" que se ve ahora mismo en el calendario), que puede
  // haber quedado en una selección más ancha (varias fechas) que la fecha REAL con la que se guardó el
  // P2 activo. Caso real que lo destapó: material 20003094 mostraba 1.708 unidades en PFD-VENTA — la
  // suma de 5 órdenes reales con Liberación 31-ago/01-sep(x2)/02-sep/07-sep — cuando el P2 activo
  // (#524) está fechado exacto 01-sep; solo las 2 órdenes de esa fecha (300 unidades) responden a ESE
  // ciclo. Se relee el P2 activo (verificarPlanP2Activo) y se filtra FERT por SU fecha real
  // (`filterData(..., [fechaP2])`, con dateOverride) — misma fecha con la que se explotó el BOM que
  // originó este P2, no lo que el calendario muestre en este instante.
  // Solo Espumas: Rollos no tiene Data Aprobada con datos reales hoy (las corridas se aplazan a
  // propósito hasta resolver stock, ver captura real de esta sesión).
  const generarPfdVentaPreview = async (centro: '1000' | '2000') => {
    const rows = dataAprobada[`${centro}-ESPUMAS`] || [];

    const { planActivo: p2Activo } = await verificarPlanP2Activo(centro, 'ESPUMAS');
    if (!p2Activo) {
      addNotification('warning', `No hay un P2 activo de Espumas para el Centro ${centro} — genera el P2 primero.`);
      return;
    }
    const fechaP2 = soloFecha(p2Activo.fecha_inicio_plan);
    const fertOrigen = filterData(ordenesFert, centro, true, [fechaP2]);
    if (fertOrigen.length === 0) {
      addNotification('warning', `No hay Órdenes FERT fechadas exacto ${fechaP2} (fecha del P2 #${p2Activo.codigo_plan_grupo}) para el Centro ${centro}.`);
      return;
    }

    setIsGeneratingPfdVenta(prev => ({ ...prev, [centro]: true }));
    const uniqueMaterialCount = new Set(fertOrigen.map(o => extractMaterialInfo(o).code).filter(Boolean)).size;
    setPfdVentaBomProgress(prev => ({ ...prev, [centro]: { current: 0, total: uniqueMaterialCount } }));
    let current = 0;
    const onStep = () => setPfdVentaBomProgress(prev => ({ ...prev, [centro]: { current: ++current, total: uniqueMaterialCount } }));

    try {
      const { trazabilidad } = await explodeNecesidadesFert(centro, fertOrigen, onStep);

      const ptCubiertos = new Set<string>();
      const sinTrazabilidad: DataAprobadaRow[] = [];

      rows.filter(r => estadoDataAprobada(r) === 'completo').forEach(r => {
        const padres = trazabilidad[r.material];
        if (!padres || padres.length === 0) { sinTrazabilidad.push(r); return; }
        padres.forEach(pt => ptCubiertos.add(pt));
      });

      // "si existe varios FERT con el mismo HALB, es simple la suma" -> se suma por material más
      // abajo, igual que ya hace calculateSummary para la agrupación de "Resumen Necesidades".
      const fertCubierto = fertOrigen.filter(o => ptCubiertos.has(cleanCode(o.MATERIAL)));

      // Una fila por material — lo que de verdad se va a grabar (cantidad), más categoría/tiempo
      // como columnas informativas (mismo cruce matchTiempoEstandar que ya usa "Resumen Necesidades",
      // con el mismo respaldo de placeholder cuando el material no tiene tiempo estándar real).
      const lookup = centro === '1000' ? tiempoLookup1000 : tiempoLookup2000;
      const porMaterial = new Map<string, PfdVentaLinea>();
      fertCubierto.forEach(o => {
        const info = extractMaterialInfo(o);
        if (!info.code) return;
        const qty = Number(o.CANTPROGRAMADA || o.CANTIDAD || 0);
        const categoria = String(o.CATEGORIA || o.Categoria || o.categoria || '—').trim() || '—';
        const maquina = String(o.MAQUINA || o.Maquina || o.RECURSO || '').trim();
        const tiempoEstandarMin = matchTiempoEstandar(info.code, maquina, lookup);
        const tiempoHoras = tiempoEstandarMin !== null ? (qty * tiempoEstandarMin) / 60 : (qty * PACKING_TIME_PER_UNIT_SECONDS) / 3600;
        if (!porMaterial.has(info.code)) {
          porMaterial.set(info.code, { material: info.code, descripcion: info.desc, categoria, cantidad: 0, tiempoHoras: 0 });
        }
        const entry = porMaterial.get(info.code)!;
        entry.cantidad += qty;
        entry.tiempoHoras += tiempoHoras;
      });

      setPfdVentaPreview(prev => ({
        ...prev,
        [centro]: {
          sinTrazabilidad,
          ptCubiertos,
          lineas: Array.from(porMaterial.values()).sort((a, b) => a.material.localeCompare(b.material)),
        },
      }));
    } catch (error) {
      addNotification('error', `Error al generar PFD-VENTA Centro ${centro}: ${(error as Error).message}`);
    } finally {
      setIsGeneratingPfdVenta(prev => ({ ...prev, [centro]: false }));
    }
  };

  // Totales globales para el dashboard superior
  const globalStats = useMemo(() => {
    const all = [...summaryData1000, ...summaryData2000];
    return {
      ordenes: all.reduce((sum, r) => sum + r.totalOrdenes, 0),
      unidades: all.reduce((sum, r) => sum + r.totalCantidad, 0),
      horasEmpaque: all.reduce((sum, r) => sum + r.totalTiempoEmpaque, 0)
    };
  }, [summaryData1000, summaryData2000]);

  // Mapa Cod.Buscar → Fecha de Órdenes FERT (mismo cruce que Pendientes, ver buildCodBuscar): usa
  // TODAS las FERT cargadas (sin el filtro de centro/responsable/fecha que aplican fertC1000/
  // fertC2000), porque Pendientes no está acotado a esos mismos criterios.
  // Verificado contra la respuesta real de OrdenesFertPaginadas: NO existe un campo propio de
  // "fecha entrega" ahí — se usa "FECHA" (fecha planificada/ejecución de la orden FERT), que es la
  // misma que ya se muestra como columna "Fecha" en la tabla de ese tab.
  const fertFechaEntregaPorCodBuscar = useMemo(() => {
    const map = new Map<string, string>();
    ordenesFert.forEach(o => {
      const cod = buildCodBuscar(o.POSICION, o.PEDIDO, o.MATERIAL);
      const fecha = String(o.FECHA || '').split('T')[0];
      if (cod && fecha) map.set(cod, fecha);
    });
    return map;
  }, [ordenesFert]);

  // Tab "Pendientes": fijo a SECTOR "09 ESPUMAS" (único sector que consume este módulo), filtra por
  // texto (Pedido o Material) y por rango de Fecha de Entrega, luego agrupa por Material (Accordion)
  // para no listar +20K filas planas.
  const pendientesFiltrados = useMemo(() => {
    const search = pendientesSearch.trim().toLowerCase();
    const desde = pendientesFechaDesde ? parseISO(pendientesFechaDesde) : null;
    const hasta = pendientesFechaHasta ? parseISO(pendientesFechaHasta) : null;
    return pendientesTotales.filter((p) => {
      const sector = String(p.SECTOR || '').trim().toUpperCase();
      if (sector !== SECTOR_ESPUMAS) return false;
      const pedido = String(p.PEDIDO || '').trim();
      const material = String(p.MATERIAL || '').trim();
      const descripcion = String(p.DESCRIPCION_MATERIAL || '').trim();
      if (search && !pedido.toLowerCase().includes(search) && !material.toLowerCase().includes(search) && !descripcion.toLowerCase().includes(search)) {
        return false;
      }
      // fechaLocalEcuador: FECHA_ENTREGA es un timestamp UTC real (confirmado, ej.
      // "2026-01-07T05:00:00.000Z") — mismo bug de zona horaria que en Corte Espuma.
      const fechaStr = fechaLocalEcuador(p.FECHA_ENTREGA);
      if ((desde || hasta) && !fechaStr) return false;
      if (desde || hasta) {
        const fecha = parseISO(fechaStr);
        if (desde && fecha < desde) return false;
        if (hasta && fecha > hasta) return false;
      }
      return true;
    });
  }, [pendientesTotales, pendientesSearch, pendientesFechaDesde, pendientesFechaHasta]);

  // Separado por CENTRO (1000/2000) — antes un mismo material mezclaba pedidos de ambas plantas bajo
  // el mismo grupo, sin distinguir de dónde sale cada uno.
  const pendientesAgrupadosPorCentro = useMemo(() => {
    const maps: Record<'1000' | '2000', Map<string, { material: string; descripcion: string; pedidos: PendienteRow[] }>> = {
      '1000': new Map(),
      '2000': new Map(),
    };
    pendientesFiltrados.forEach((p) => {
      const centro = String(p.CENTRO || '').trim();
      if (centro !== '1000' && centro !== '2000') return;
      const material = String(p.MATERIAL || '').trim();
      const codBuscar = buildCodBuscar(p.POSICION, p.PEDIDO, p.MATERIAL);
      const map = maps[centro];
      if (!map.has(material)) {
        map.set(material, { material, descripcion: String(p.DESCRIPCION_MATERIAL || '').trim(), pedidos: [] });
      }
      map.get(material)!.pedidos.push({
        pedido: String(p.PEDIDO || '').trim(),
        posicion: String(p.POSICION || '').trim(),
        codBuscar,
        cantPedida: numOrEmpty(p.CANT_PEDIDA),
        centro,
        // El endpoint no trae "FECHA_PEDIDO": la fecha del pedido viene en "FECHA". fechaLocalEcuador
        // por el mismo motivo que arriba: son timestamps UTC reales, no fechas planas.
        fechaPedido: fechaLocalEcuador(p.FECHA),
        fechaEntrega: fechaLocalEcuador(p.FECHA_ENTREGA),
        ciudadDestino: String(p.CIUDAD_DESTINO || '').trim(),
        // El endpoint no trae "VOL_PEND": el volumen pendiente de entrega viene en "VOLUMENPENDIENTEENTREGA".
        volPend: numOrEmpty(p.VOLUMENPENDIENTEENTREGA),
        fechaEntregaFert: fertFechaEntregaPorCodBuscar.get(codBuscar) || '',
      });
    });
    return {
      '1000': Array.from(maps['1000'].values()).sort((a, b) => b.pedidos.length - a.pedidos.length),
      '2000': Array.from(maps['2000'].values()).sort((a, b) => b.pedidos.length - a.pedidos.length),
    };
  }, [pendientesFiltrados, fertFechaEntregaPorCodBuscar]);

  // Popover del filtro "Fecha" ("Ventana de Producción") — se usa en Provisionales y en Plan P2
  // (también controla la ventana de generación del P2, ver ventanaP2). "Resumen Necesidades" tiene su
  // PROPIO selector aparte (fechaResumenPopover, más abajo) — no comparte esta selección a propósito.
  const fechaPopover = (
    <Popover>
      <PopoverTrigger asChild>
        <Button variant="outline" size="sm" className="h-10 px-6 rounded-2xl border-gray-200 hover:bg-white hover:border-primary/50 gap-2 font-bold text-xs uppercase transition-all shadow-sm">
          <Filter className="w-4 h-4" /> Fecha{selectedDates.length > 0 ? ` (${selectedDates.length})` : ''}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-64 p-0 border-none shadow-2xl rounded-2xl overflow-hidden mt-2" align="end">
        <div className="bg-white p-4 font-sans">
          <div className="flex items-center justify-between mb-4 text-left">
            <h3 className="text-xs font-bold text-gray-800 capitalize">{format(viewDate, 'MMMM yyyy', { locale: es })}</h3>
            <div className="flex gap-1 bg-gray-50 rounded-xl p-1">
              <Button variant="ghost" size="icon" onClick={() => setViewDate(subMonths(viewDate, 1))} className="h-7 w-7 hover:bg-white hover:shadow-sm"><ChevronLeft className="w-4 h-4" /></Button>
              <Button variant="ghost" size="icon" onClick={() => setViewDate(addMonths(viewDate, 1))} className="h-7 w-7 hover:bg-white hover:shadow-sm"><ChevronRight className="w-4 h-4" /></Button>
            </div>
          </div>
          <p className="text-[9px] font-bold text-gray-300 uppercase tracking-widest mb-2">Toca varias fechas para combinarlas</p>
          <div className="grid grid-cols-7 gap-y-1 text-center mb-3">
            {['LU', 'MA', 'MI', 'JU', 'VI', 'SA', 'DO'].map((day, idx) => <div key={`cal-head-${idx}`} className="text-[9px] font-bold text-gray-300 uppercase py-1">{day}</div>)}
            {calendarDays.map((day, idx) => {
              if (!day) return <div key={`cal-pad-${idx}`} className="p-1" />;
              const dateStr = format(day, 'yyyy-MM-dd');
              const isSelected = selectedDates.includes(dateStr);
              return (
                <button key={dateStr} onClick={() => toggleSelectedDate(dateStr)} className={cn("relative h-8 w-8 mx-auto rounded-xl flex items-center justify-center transition-all", isSelected ? "bg-primary text-white shadow-md" : "hover:bg-gray-100")}>
                  <span className={cn("text-xs font-bold", !datesWithOrders.has(dateStr) && !isSelected ? "text-gray-200" : "")}>{format(day, 'd')}</span>
                  {datesWithOrders.has(dateStr) && !isSelected && <div className="absolute bottom-1.5 w-1 h-1 bg-primary/40 rounded-full" />}
                </button>
              );
            })}
          </div>
          <Button variant="ghost" size="sm" className="w-full text-[10px] font-black uppercase text-primary h-8 mt-1 rounded-xl hover:bg-primary/5 tracking-widest" onClick={() => setSelectedDates([])}>Ver Todo</Button>
        </div>
      </PopoverContent>
    </Popover>
  );

  // Popover del selector de fecha PROPIO de "Resumen Necesidades" (selectedDatesResumen) —
  // multi-select EXACTO (toggle, igual patrón que fechaPopover/selectedDates): varias fechas SUMAN
  // solo esos días entre sí, no arrastran nada anterior no elegido.
  const fechaResumenPopover = (
    <Popover>
      <PopoverTrigger asChild>
        <Button variant="outline" size="sm" className="h-9 px-4 rounded-xl border-gray-200 hover:bg-white hover:border-primary/50 gap-2 font-bold text-[10px] uppercase transition-all shadow-sm">
          <CalendarIcon className="w-3.5 h-3.5" />
          {selectedDatesResumen.length === 1
            ? format(parseISO(selectedDatesResumen[0]), 'd MMM yyyy', { locale: es })
            : `${selectedDatesResumen.length} fechas`}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-64 p-0 border-none shadow-2xl rounded-2xl overflow-hidden mt-2" align="start">
        <div className="bg-white p-4 font-sans">
          <div className="flex items-center justify-between mb-4 text-left">
            <h3 className="text-xs font-bold text-gray-800 capitalize">{format(viewDateResumen, 'MMMM yyyy', { locale: es })}</h3>
            <div className="flex gap-1 bg-gray-50 rounded-xl p-1">
              <Button variant="ghost" size="icon" onClick={() => setViewDateResumen(subMonths(viewDateResumen, 1))} className="h-7 w-7 hover:bg-white hover:shadow-sm"><ChevronLeft className="w-4 h-4" /></Button>
              <Button variant="ghost" size="icon" onClick={() => setViewDateResumen(addMonths(viewDateResumen, 1))} className="h-7 w-7 hover:bg-white hover:shadow-sm"><ChevronRight className="w-4 h-4" /></Button>
            </div>
          </div>
          <p className="text-[9px] font-bold text-gray-300 uppercase tracking-widest mb-2">Toca varias fechas para sumarlas</p>
          <div className="grid grid-cols-7 gap-y-1 text-center mb-3">
            {['LU', 'MA', 'MI', 'JU', 'VI', 'SA', 'DO'].map((day, idx) => <div key={`cal-res-head-${idx}`} className="text-[9px] font-bold text-gray-300 uppercase py-1">{day}</div>)}
            {calendarDaysResumen.map((day, idx) => {
              if (!day) return <div key={`cal-res-pad-${idx}`} className="p-1" />;
              const dateStr = format(day, 'yyyy-MM-dd');
              const isSelected = selectedDatesResumen.includes(dateStr);
              return (
                <button key={dateStr} onClick={() => toggleSelectedDateResumen(dateStr)} className={cn("relative h-8 w-8 mx-auto rounded-xl flex items-center justify-center transition-all", isSelected ? "bg-primary text-white shadow-md" : "hover:bg-gray-100")}>
                  <span className="text-xs font-bold">{format(day, 'd')}</span>
                </button>
              );
            })}
          </div>
          <Button variant="ghost" size="sm" className="w-full text-[10px] font-black uppercase text-primary h-8 mt-1 rounded-xl hover:bg-primary/5 tracking-widest" onClick={() => setSelectedDatesResumen([format(new Date(), 'yyyy-MM-dd')])}>Solo hoy</Button>
        </div>
      </PopoverContent>
    </Popover>
  );

  if (!mounted) return null;

  return (
    <div className="p-4 md:p-6 space-y-6 bg-white min-h-screen rounded-xl border border-gray-100 shadow-sm font-sans text-left">
      <div className="flex items-center justify-between pb-4 border-b border-gray-100">
        <div className="flex items-center space-x-3 text-left">
          <div className="p-2 bg-green-600/10 rounded-xl"><ShoppingCart className="w-6 h-6 text-green-600" /></div>
          <div>
            <h2 className="text-xl font-bold text-gray-800 uppercase tracking-tight">Plan Táctico Venta Externa</h2>
            <p className="text-xs text-gray-500 font-medium">Control de Órdenes FERT y Programación Técnica</p>
          </div>
        </div>
        {/* "Sincronizar": trae datos crudos de SAP y, si ya hay una Ventana de Producción elegida,
            calcula la Necesidad BOM automáticamente al terminar (ver handleSincronizarYGenerar) —
            mismo color/forma en los 4 módulos tácticos (azul), distinto de la familia "Generar
            Necesidades"/"Generar Respuestas" (índigo/sólido, ver más abajo en el tab Plan P2). El
            botón "Generar Necesidades · BOM FERT" sigue disponible aparte para recalcular tras
            cambiar la fecha, sin re-sincronizar todo. */}
        <Button onClick={handleSincronizarYGenerar} disabled={syncStep !== 'idle'} variant={datosCargados ? 'outline' : 'default'} className={cn(
          "rounded-xl h-10 px-6 gap-2 font-bold text-xs uppercase",
          datosCargados ? "border-blue-200 text-blue-700 hover:bg-blue-50" : "bg-blue-600 text-white hover:bg-blue-700 shadow-lg"
        )}>
          {syncStep !== 'idle' ? <Loader2 className="w-4 h-4 animate-spin" /> : <RefreshCw className="w-4 h-4" />} Sincronizar
        </Button>
      </div>

      {/* Barra de progreso SOLO de la fase "sincronizando" (sin indicador propio). La fase
          "generando" (si ya había fecha elegida) ya tiene su propia barra junto al botón "Generar
          Necesidades · BOM FERT" (isExplodingBom/bomProgress, "X/Y materiales explotados") —
          mostrar esta también ahí duplicaba el aviso (mismo problema reportado por el usuario con
          una captura real en Corte y Laminado). */}
      {syncStep === 'sincronizando' && (
        <div className="flex items-center gap-3 rounded-xl border border-blue-100 bg-blue-50/40 px-4 py-2.5 mt-4">
          <div className="flex-1 h-1.5 bg-blue-100 rounded-full overflow-hidden">
            <div className="h-full bg-blue-600 w-1/2 transition-all duration-700 ease-out" />
          </div>
          <span className="text-[10px] font-black uppercase tracking-widest text-blue-700 shrink-0 flex items-center gap-1.5">
            <Loader2 className="w-3.5 h-3.5 animate-spin" />
            Sincronizando SAP...
          </span>
        </div>
      )}

      {/* Estado vacío inicial: el módulo no consulta SAP al abrirse. Mismo criterio y misma
          redacción compacta que Corte Espuma (ver [[carga_manual_modulos_tacticos]]). */}
      {!datosCargados && !isLoading && (
        <div
          className="flex items-center gap-2.5 rounded-xl border border-dashed border-blue-200 bg-blue-50/40 px-4 py-2.5 text-left"
          title="Este módulo no consulta SAP al abrirse. Sincronizar trae Grupos, Restricciones, Provisionales, FERT y Tiempos de Ensamblado."
        >
          <RefreshCw className="w-4 h-4 text-blue-600 shrink-0" />
          <p className="text-[11px] font-bold text-slate-600">
            Sin datos cargados — pulsa <span className="font-black text-blue-700">Sincronizar</span> para traerlos.
          </p>
        </div>
      )}

      <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
        <TabsList className="grid grid-cols-6 h-10 bg-gray-50/80 p-1 rounded-xl border border-gray-100 mb-6">
          {[
            { v: 'resumen', l: 'Resumen Necesidades', i: LayoutDashboard },
            { v: 'ordenes', l: 'Provisionales', i: Package },
            { v: 'ordenesFert', l: 'FERT', i: ShoppingCart },
            { v: 'planP2', l: 'Plan P2', i: Layers },
            { v: 'dataAprobada', l: 'Data Aprobada', i: ClipboardCheck },
            { v: 'pendientes', l: 'Pendientes', i: Clock }
          ].map(tab => (
            <TabsTrigger key={tab.v} value={tab.v} className="gap-2 text-[9px] font-bold uppercase transition-all data-[state=active]:bg-white data-[state=active]:shadow-sm">
              <tab.i className="w-3.5 h-3.5" /> {tab.l}
            </TabsTrigger>
          ))}
        </TabsList>

        <TabsContent value="resumen" className="space-y-6 animate-in fade-in duration-300">
          {/* Selector PROPIO de este tab (selectedDatesResumen/fechaResumenPopover) — deliberadamente
              separado de `selectedDates` ("Ventana de Producción", usada por Provisionales/generar
              P2). Antes esta fecha estaba fija a hoy sin poder cambiarla; ahora es multi-select EXACTO
              (no acumulado "hasta" — una fecha muestra solo ese día, varias suman solo esos días). */}
          <div className="flex justify-between items-center bg-gray-50/50 p-4 rounded-2xl border border-gray-100">
            <div className="flex items-center gap-4 text-left">
              <div className="p-2 bg-primary/10 rounded-xl"><CalendarIcon className="w-5 h-5 text-primary" /></div>
              <div>
                <p className="text-[10px] font-bold uppercase text-gray-400 tracking-wider">Carga Operativa</p>
                <h3 className="text-sm font-black text-gray-700 uppercase">
                  {selectedDatesResumen.length === 1 && selectedDatesResumen[0] === format(new Date(), 'yyyy-MM-dd')
                    ? 'Ejecutado hoy (FERT)'
                    : selectedDatesResumen.length === 1
                    ? `Ejecutado el ${format(parseISO(selectedDatesResumen[0]), 'd MMM yyyy', { locale: es })} (FERT)`
                    : `Ejecutado en ${selectedDatesResumen.length} fechas (FERT)`}
                </h3>
              </div>
            </div>
            {fechaResumenPopover}
          </div>

          {/* Estadísticas de Carga - Dashboard Superior */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <Card className="p-4 border-none shadow-sm bg-blue-50/30 flex items-center gap-4">
              <div className="p-3 bg-blue-500/10 rounded-2xl text-blue-600"><TrendingUp className="w-5 h-5" /></div>
              <div>
                <p className="text-[9px] font-black uppercase text-gray-400 tracking-widest">Total Órdenes</p>
                <p className="text-xl font-black text-gray-800">{globalStats.ordenes}</p>
              </div>
            </Card>
            <Card className="p-4 border-none shadow-sm bg-green-50/30 flex items-center gap-4">
              <div className="p-3 bg-green-500/10 rounded-2xl text-green-600"><Package className="w-5 h-5" /></div>
              <div>
                <p className="text-[9px] font-black uppercase text-gray-400 tracking-widest">Total Unidades</p>
                <p className="text-xl font-black text-gray-800">{globalStats.unidades.toLocaleString()}</p>
              </div>
            </Card>
            <Card className="p-4 border-none shadow-sm bg-amber-50/30 flex items-center gap-4">
              <div className="p-3 bg-amber-500/10 rounded-2xl text-amber-600"><Box className="w-5 h-5" /></div>
              <div>
                <p className="text-[9px] font-black uppercase text-gray-400 tracking-widest">Horas Totales Empaque</p>
                <p className="text-xl font-black text-gray-800">{globalStats.horasEmpaque.toFixed(1)}h</p>
              </div>
            </Card>
          </div>

          {[ 
            { t: 'Planta 1000 - Quito', d: groupedSummary1000, c: 'text-green-700', b: 'bg-green-600', expanded: expandedCategorias1000, setExpanded: setExpandedCategorias1000 },
            { t: 'Planta 2000 - Guayaquil', d: groupedSummary2000, c: 'text-indigo-700', b: 'bg-indigo-600', expanded: expandedCategorias2000, setExpanded: setExpandedCategorias2000 }
          ].map((center, idx) => (
            <div key={idx} className="space-y-4">
              <div className="flex items-center justify-between px-1">
                <h3 className={cn("text-[11px] font-black uppercase flex items-center gap-2 tracking-widest", center.c)}>
                  <div className={cn("w-2.5 h-2.5 rounded-full", center.b)} /> {center.t}
                </h3>
                <Badge variant="outline" className="text-[9px] font-bold border-gray-200 text-gray-400">{center.d.length} Categorías identificadas</Badge>
              </div>
              <Card className="rounded-2xl border border-gray-100 shadow-sm overflow-hidden bg-white">
                {center.d.length === 0 ? (
                  <div className="py-16 text-center text-gray-400 font-bold uppercase tracking-widest opacity-30">Sin operaciones programadas</div>
                ) : (
                  <div className="max-h-[600px] overflow-y-auto px-4">
                    <Accordion type="multiple" value={center.expanded} onValueChange={center.setExpanded} className="divide-y divide-gray-50">
                      {center.d.map(group => (
                        <AccordionItem key={group.categoria} value={group.categoria} className="border-b-0">
                          <AccordionTrigger className="hover:no-underline py-3 px-2">
                            <div className="flex items-center justify-between w-full pr-4 text-left">
                              <div className="flex items-center gap-3">
                                <Badge className="bg-blue-50 text-blue-800 font-bold text-[9px] uppercase border-blue-200">D{group.densidad}</Badge>
                                <div>
                                  <p className="text-xs font-black text-gray-700 uppercase">{group.categoria}</p>
                                  <p className="text-[9px] font-bold text-gray-400 uppercase">{group.tipo} · {group.rows.length} variante(s)</p>
                                </div>
                              </div>
                              <div className="flex items-center gap-6 text-right">
                                <div>
                                  <p className="text-[8px] font-black uppercase text-gray-400 tracking-wider">Órdenes</p>
                                  <p className="text-xs font-mono font-bold text-gray-600">{group.totalOrdenes}</p>
                                </div>
                                <div>
                                  <p className="text-[8px] font-black uppercase text-gray-400 tracking-wider">Unidades</p>
                                  <p className="text-xs font-mono font-black text-gray-900">{group.totalCantidad.toLocaleString()}</p>
                                </div>
                                <div>
                                  <p className="text-[8px] font-black uppercase text-amber-500 tracking-wider">Tiempo Planchas (H)</p>
                                  <p className="text-xs font-mono font-black text-amber-600">{group.totalTiempoEmpaque.toFixed(2)}</p>
                                </div>
                              </div>
                            </div>
                          </AccordionTrigger>
                          <AccordionContent>
                            <table className="w-full border-collapse text-center font-sans bg-gray-50/40 rounded-xl overflow-hidden">
                              <thead className="bg-gray-50 text-[9px] font-black uppercase text-gray-400 border-b border-gray-100">
                                <tr>
                                  <th className="px-4 py-2 border-r border-gray-100 text-left">Máquina / Recurso</th>
                                  <th className="px-3 py-2 border-r border-gray-100 text-primary">Tipo</th>
                                  <th className="px-3 py-2 border-r border-gray-100 bg-blue-50/50 text-blue-800">Espesor</th>
                                  <th className="px-3 py-2 border-r border-gray-100">Órdenes</th>
                                  <th className="px-3 py-2 border-r border-gray-100 font-black">Unidades</th>
                                  <th className="px-4 py-2 text-center text-amber-700 bg-amber-50/30">Tiempo Planchas (H)</th>
                                </tr>
                              </thead>
                              <tbody className="divide-y divide-gray-50 text-[11px]">
                                {group.rows.map((row, i) => (
                                  <tr key={i} className="hover:bg-gray-50/50 transition-colors">
                                    <td className="px-4 py-2 font-black text-gray-700 border-r border-gray-100 uppercase text-left">{row.maquina}</td>
                                    <td className="px-3 py-2 font-black text-primary border-r border-gray-100 uppercase">{row.tipo}</td>
                                    <td className="px-3 py-2 font-black text-blue-700 border-r border-gray-100 bg-blue-50/5">{row.espesor}</td>
                                    <td className="px-3 py-2 font-mono border-r border-gray-100 text-gray-400">{row.totalOrdenes}</td>
                                    <td className="px-3 py-2 font-mono font-black text-gray-900 border-r border-gray-100">{row.totalCantidad.toLocaleString()}</td>
                                    <td className="px-4 py-2 font-mono font-black text-amber-600 text-center bg-amber-50/5">{row.totalTiempoEmpaque.toFixed(2)}</td>
                                  </tr>
                                ))}
                              </tbody>
                            </table>
                          </AccordionContent>
                        </AccordionItem>
                      ))}
                    </Accordion>
                  </div>
                )}
                {center.d.length > 0 && (
                  <div className="bg-gray-100 text-gray-800 font-black text-[10px] uppercase border-t-2 border-gray-200 px-6 py-3 flex items-center justify-between">
                    <span className="tracking-widest">Total {center.t}</span>
                    <div className="flex items-center gap-8 font-mono">
                      <span>{center.d.reduce((s, r) => s + r.totalOrdenes, 0)} órdenes</span>
                      <span className="text-green-600">{center.d.reduce((s, r) => s + r.totalCantidad, 0).toLocaleString()} unid.</span>
                      <span className="text-amber-600">{center.d.reduce((s, r) => s + r.totalTiempoEmpaque, 0).toFixed(1)}h empaque</span>
                    </div>
                  </div>
                )}
              </Card>
            </div>
          ))}
        </TabsContent>

        <TabsContent value="ordenes" className="space-y-8 animate-in fade-in duration-300">
          {/* El selector "Fecha" ahora filtra específicamente este tab (ver filterData/provC1000) —
              antes solo era visible en "Resumen Necesidades", así que aquí no había forma de ver ni
              cambiar qué fechas estaban acotando la tabla. Mismo patrón que el header de Resumen. */}
          <div className="flex justify-between items-center bg-gray-50/50 p-4 rounded-2xl border border-gray-100">
            <div className="flex items-center gap-4 text-left flex-1 min-w-0">
              <div className="p-2 bg-primary/10 rounded-xl"><CalendarIcon className="w-5 h-5 text-primary" /></div>
              <div className="min-w-0">
                <p className="text-[10px] font-bold uppercase text-gray-400 tracking-wider">Filtro de Provisionales</p>
                <h3 className="text-sm font-black text-gray-700 uppercase">
                  {selectedDates.length === 0
                    ? 'TODAS LAS FECHAS'
                    : selectedDates.length === 1
                      ? format(parseISO(selectedDates[0]), 'EEEE, d MMMM yyyy', { locale: es })
                      : `${selectedDates.length} FECHAS SELECCIONADAS`}
                </h3>
                {selectedDates.length > 1 && (
                  <div className="flex flex-wrap gap-1 mt-1.5">
                    {[...selectedDates].sort().map(d => (
                      <Badge key={d} variant="outline" className="text-[9px] font-mono gap-1 pr-1 border-primary/20 text-primary bg-primary/5">
                        {format(parseISO(d), 'd MMM', { locale: es })}
                        <button onClick={() => toggleSelectedDate(d)} className="hover:bg-primary/10 rounded-full p-0.5"><X className="w-2.5 h-2.5" /></button>
                      </Badge>
                    ))}
                  </div>
                )}
              </div>
            </div>
            {fechaPopover}
          </div>

          {[
            { t: 'Quito 1000 - Órdenes Provisionales', d: provC1000, b: 'bg-green-600', c: 'text-green-700', lookup: tiempoLookup1000 },
            { t: 'Guayaquil 2000 - Órdenes Provisionales', d: provC2000, b: 'bg-indigo-600', c: 'text-indigo-700', lookup: tiempoLookup2000 }
          ].map((center, idx) => (
            <div key={idx} className="space-y-4">
              <h3 className={cn("text-[11px] font-bold uppercase flex items-center gap-2 px-1", center.c)}>
                <div className={cn("w-2 h-2 rounded-full", center.b)} /> {center.t} ({center.d.length} registros)
              </h3>
              <Card className="rounded-2xl border border-gray-100 shadow-sm overflow-hidden bg-white">
                <div className="overflow-x-auto max-h-[450px]">
                  <table className="w-full border-collapse text-center">
                    <thead className="bg-gray-50 sticky top-0 z-10 text-[9px] font-bold uppercase text-gray-400 border-b border-gray-100">
                      <tr>
                        <th className="px-3 py-4 border-r border-gray-100">Orden</th>
                        {/* Pedido/Posición/Cod.Buscar — mismas columnas que ya tiene la tabla de Órdenes FERT
                            (ver TabsContent "ordenesFert" más abajo), agregadas acá para poder cruzar
                            Provisionales contra "Pendientes" por el mismo codBuscar (POSICION+PEDIDO+MATERIAL).
                            Si la orden provisional no trae POSICION/PEDIDO en la API, se verá "—" en toda la
                            columna — eso confirma que el dato no existe ahí y hay que buscarlo en otro lado. */}
                        <th className="px-3 py-4 border-r border-gray-100">Pedido</th>
                        <th className="px-3 py-4 border-r border-gray-100">Posición</th>
                        <th className="px-3 py-4 border-r border-gray-100">Fecha</th>
                        <th className="px-3 py-4 border-r border-gray-100">Material</th>
                        <th className="px-3 py-4 border-r border-gray-100 text-left">Descripción</th>
                        <th className="px-3 py-4 border-r border-gray-100 bg-blue-50/20 text-blue-900">Categoría</th>
                        <th className="px-2 py-4 border-r border-gray-100">DENS.</th>
                        <th className="px-2 py-4 border-r border-gray-100">ANCHO</th>
                        <th className="px-2 py-4 border-r border-gray-100">LARGO</th>
                        <th className="px-2 py-4 border-r border-gray-100">ESP.</th>
                        <th className="px-3 py-4 border-r border-gray-100">Cant.</th>
                        <th className="px-3 py-4 border-r border-gray-100 text-teal-700 bg-teal-50/20 font-black">T. Estándar (Min)</th>
                        <th className="px-3 py-4 border-r border-gray-100 text-amber-700 bg-amber-50/20 font-black">T. Empaque (H)</th>
                        <th className="px-3 py-4 border-r border-gray-100 font-bold">Máquina</th>
                        <th className="px-3 py-4 border-r border-gray-100">ALM.</th>
                        {/* Visible para poder auditar en la propia tabla que el filtro de restricción
                            (filterData, RESPCTRLPROD 018/045) realmente está acotando — antes no se podía
                            verificar esto sin cruzar contra un export aparte de SAP. */}
                        <th className="px-3 py-4 border-r border-gray-100 bg-slate-50 text-slate-700 font-black">Resp.</th>
                        {/* ClaseOrden traducida a MTO (KD, con cliente) / MTS (LA, sin cliente) — confirmado
                            con datos reales. Solo informativo, no filtra filas de la lista. */}
                        <th className="px-3 py-4 border-r border-gray-100 bg-purple-50/20 text-purple-900 font-black">Tipo (MTO/MTS)</th>
                        <th className="px-3 py-4 font-mono text-gray-500">Cod.Buscar</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-50 text-[10px]">
                      {center.d.map((o, i) => {
                        const info = extractMaterialInfo(o);
                        const qty = Number(o.CANTPROGRAMADA || o.CANTIDAD || 0);
                        const empaqueHours = (qty * PACKING_TIME_PER_UNIT_SECONDS) / 3600;
                        const maquina = String(o.MAQUINA || o.Maquina || o.RECURSO || '—');
                        const tiempoEstandar = matchTiempoEstandar(info.code, maquina, center.lookup);
                        // Confirmado con datos reales (export de OrdenesProvisionalesPaginados): el campo NO
                        // se llama PEDIDO/POSICION como en FERT — se llama PEDIDOVENTAS/POSICIONPEDIDO. Por
                        // eso salían vacíos antes. buildCodBuscar trata ausentes como 0 (parseQty), no como
                        // vacío — sin esta guarda, una orden sin pedido mostraba igual un Cod.Buscar "armado"
                        // con ceros, que parece un código real pero no lo es.
                        // "000000" es el placeholder de las órdenes LA (sin cliente) — es un string no
                        // vacío (truthy en JS), así que hay que descartarlo explícitamente además de
                        // vacío/undefined; si no, seguía calculando un Cod.Buscar falso con ceros.
                        const esValorAusente = (v: unknown) => !v || /^0+$/.test(String(v).trim());
                        const tienePedidoOPosicion = !esValorAusente(o.POSICIONPEDIDO) || !esValorAusente(o.PEDIDOVENTAS);
                        const codBuscar = tienePedidoOPosicion ? buildCodBuscar(o.POSICIONPEDIDO, o.PEDIDOVENTAS, o.MATERIAL) : '—';
                        // El filtro "Fecha" ahora compara contra FECHAFIN cuando existe (ver filterData) —
                        // se muestra esa como fecha principal, con FECHAINICIO como referencia secundaria,
                        // para que la tabla coincida con lo que realmente se está filtrando.
                        const fechaInicioDisplay = String(o.FECHA || o.FECHAINICIO || '—');
                        const fechaFinDisplay = o.FECHAFIN ? String(o.FECHAFIN) : '';
                        const claseOrden = clasificarClaseOrden(o.ClaseOrden);

                        return (
                          <tr key={i} className="hover:bg-gray-50/50 transition-colors">
                            <td className="px-3 py-2 font-medium text-gray-900 border-r border-gray-100">{String(o.ORDENPREVISIONAL || o.ORDEN || '—')}</td>
                            <td className="px-3 py-2 font-mono text-gray-700 border-r border-gray-100">{String(o.PEDIDOVENTAS || '—')}</td>
                            <td className="px-3 py-2 font-mono text-gray-700 border-r border-gray-100">{String(o.POSICIONPEDIDO || '—')}</td>
                            <td className="px-3 py-2 border-r border-gray-100 font-mono text-[9px]">
                              {fechaFinDisplay
                                ? <span className="text-gray-700 font-bold">{fechaFinDisplay}</span>
                                : <span className="text-gray-400">{fechaInicioDisplay}</span>}
                              {fechaFinDisplay && <span className="block text-gray-300">inicio {fechaInicioDisplay}</span>}
                            </td>
                            <td className="px-3 py-2 font-mono font-bold text-primary border-r border-gray-100 tracking-tighter">{info.code}</td>
                            <td className="px-3 py-2 text-left border-r border-gray-50 truncate max-w-[180px] text-gray-500 uppercase">{info.desc}</td>
                            <td className="px-3 py-2 text-blue-800 border-r border-gray-100 bg-blue-50/5 uppercase font-bold">{String(o.CATEGORIA || '—')}</td>
                            <td className="px-2 py-2 font-mono border-r border-gray-50">{info.dens}</td>
                            <td className="px-2 py-2 font-mono border-r border-gray-50">{info.ancho}</td>
                            <td className="px-2 py-2 font-mono border-r border-gray-50">{info.largo}</td>
                            <td className="px-2 py-2 font-mono border-r border-gray-50">{info.esp}</td>
                            <td className="px-3 py-2 font-bold text-gray-900 border-r border-gray-100 font-mono">{qty}</td>
                            <td className="px-3 py-2 font-mono font-bold text-teal-600 border-r border-gray-100 bg-teal-50/10">{tiempoEstandar !== null ? tiempoEstandar.toFixed(4) : '—'}</td>
                            <td className="px-3 py-2 font-mono font-bold text-amber-600 border-r border-gray-100 bg-amber-50/10">{empaqueHours.toFixed(2)}</td>
                            <td className="px-3 py-2 font-bold text-gray-700 border-r border-gray-100 uppercase">{maquina}</td>
                            <td className="px-3 py-2 font-medium text-gray-400 border-r border-gray-100">{String(o.Almacen || o.ALMACEN || '—')}</td>
                            <td className="px-3 py-2 font-mono font-bold text-slate-700 bg-slate-50/50 border-r border-gray-100">{String(o.RESPCTRLPROD || o.RESPCONTROLPROD || o.RespCtrlProd || o.RespControlProd || '—')}</td>
                            <td className="px-3 py-2 font-mono font-bold text-purple-700 bg-purple-50/10 border-r border-gray-100">{claseOrden}</td>
                            <td className="px-3 py-2 font-mono text-gray-500">{codBuscar}</td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </Card>
            </div>
          ))}
        </TabsContent>

        <TabsContent value="ordenesFert" className="space-y-8 animate-in fade-in duration-300">
          <p className="text-[10px] text-gray-400 font-bold uppercase tracking-widest -mt-2">
            Vista de referencia — no depende del filtro &quot;Fecha&quot; (ese selector ahora solo filtra el tab Provisionales). Muestra todas las Órdenes FERT con las restricciones de Venta Externa aplicadas.
          </p>
          {[
            { t: 'Quito 1000 - Órdenes FERT', d: fertC1000SinFecha, b: 'bg-green-600', c: 'text-green-700', lookup: tiempoLookup1000 },
            { t: 'Guayaquil 2000 - Órdenes FERT', d: fertC2000SinFecha, b: 'bg-indigo-600', c: 'text-indigo-700', lookup: tiempoLookup2000 }
          ].map((center, idx) => (
            <div key={idx} className="space-y-4">
              <h3 className={cn("text-[11px] font-bold uppercase flex items-center gap-2 px-1", center.c)}>
                <div className={cn("w-2 h-2 rounded-full", center.b)} /> {center.t} ({center.d.length} registros)
              </h3>
              <Card className="rounded-2xl border border-gray-100 shadow-sm overflow-hidden bg-white">
                <div className="overflow-x-auto max-h-[450px]">
                  <table className="w-full border-collapse text-center font-sans">
                    <thead className="bg-gray-50 sticky top-0 z-10 text-[9px] font-bold uppercase text-gray-400 border-b border-gray-100">
                      <tr>
                        <th className="px-3 py-4 border-r border-gray-100">Orden</th>
                        <th className="px-3 py-4 border-r border-gray-100">Pedido</th>
                        <th className="px-3 py-4 border-r border-gray-100">Posición</th>
                        <th className="px-3 py-4 border-r border-gray-100">Fecha</th>
                        <th className="px-3 py-4 border-r border-gray-100">Material</th>
                        <th className="px-3 py-4 border-r border-gray-100 text-left">Descripción</th>
                        <th className="px-3 py-4 border-r border-gray-100 bg-blue-50/20 text-blue-900 font-black">Categoría</th>
                        <th className="px-2 py-4 border-r border-gray-100">DENS.</th>
                        <th className="px-2 py-4 border-r border-gray-100">ANCHO</th>
                        <th className="px-2 py-4 border-r border-gray-100">LARGO</th>
                        <th className="px-2 py-4 border-r border-gray-100">ESP.</th>
                        <th className="px-3 py-4 border-r border-gray-100">Cant.</th>
                        <th className="px-3 py-4 border-r border-gray-100 text-teal-700 bg-teal-50/20 font-black">T. Estándar (Min)</th>
                        <th className="px-3 py-4 border-r border-gray-100 text-amber-700 bg-amber-50/20 font-black">T. Empaque (H)</th>
                        <th className="px-3 py-4 border-r border-gray-100 font-bold">Máquina</th>
                        <th className="px-3 py-4 border-r border-gray-100">ALM.</th>
                        <th className="px-3 py-4 font-mono text-gray-500">Cod.Buscar</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-50 text-[10px]">
                      {center.d.map((o, i) => {
                        const info = extractMaterialInfo(o);
                        const qty = Number(o.CANTPROGRAMADA || o.CANTIDAD || 0);
                        const empaqueHours = (qty * PACKING_TIME_PER_UNIT_SECONDS) / 3600;
                        const maquina = String(o.MAQUINA || o.RECURSO || '—');
                        const tiempoEstandar = matchTiempoEstandar(info.code, maquina, center.lookup);
                        const codBuscar = buildCodBuscar(o.POSICION, o.PEDIDO, o.MATERIAL);

                        return (
                          <tr key={i} className="hover:bg-gray-50/50 transition-colors">
                            <td className="px-3 py-2 font-medium text-gray-900 border-r border-gray-100">{String(o.ORDEN || '—')}</td>
                            <td className="px-3 py-2 font-mono text-gray-700 border-r border-gray-100">{String(o.PEDIDO || '—')}</td>
                            <td className="px-3 py-2 font-mono text-gray-700 border-r border-gray-100">{String(o.POSICION || '—')}</td>
                            <td className="px-3 py-2 border-r border-gray-100 font-mono text-[9px] text-gray-400">{String(o.FECHA || '—')}</td>
                            <td className="px-3 py-2 font-mono font-bold text-primary border-r border-gray-100 tracking-tighter">{info.code}</td>
                            <td className="px-3 py-2 text-left border-r border-gray-50 truncate max-w-[180px] text-gray-500 uppercase">{info.desc}</td>
                            <td className="px-3 py-2 text-blue-800 border-r border-gray-100 bg-blue-50/5 uppercase font-black">{String(o.CATEGORIA || '—')}</td>
                            <td className="px-2 py-2 font-mono border-r border-gray-50">{info.dens}</td>
                            <td className="px-2 py-2 font-mono border-r border-gray-50">{info.ancho}</td>
                            <td className="px-2 py-2 font-mono border-r border-gray-50">{info.largo}</td>
                            <td className="px-2 py-2 font-mono border-r border-gray-50">{info.esp}</td>
                            <td className="px-3 py-2 font-bold text-gray-900 border-r border-gray-100 font-mono">{qty}</td>
                            <td className="px-3 py-2 font-mono font-bold text-teal-600 border-r border-gray-100 bg-teal-50/10">{tiempoEstandar !== null ? tiempoEstandar.toFixed(4) : '—'}</td>
                            <td className="px-3 py-2 font-mono font-bold text-amber-600 border-r border-gray-100 bg-amber-50/10">{empaqueHours.toFixed(2)}</td>
                            <td className="px-3 py-2 font-bold text-gray-700 border-r border-gray-50 uppercase">{maquina}</td>
                            <td className="px-3 py-2 font-medium text-gray-400 border-r border-gray-100">{String(o.ALMACEN || '—')}</td>
                            <td className="px-3 py-2 font-mono text-gray-500">{codBuscar}</td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </Card>
            </div>
          ))}
        </TabsContent>

        <TabsContent value="planP2" className="space-y-6 animate-in fade-in duration-300">
          <div className="flex flex-col gap-4 bg-gray-50/50 p-4 rounded-2xl border border-gray-100">
            <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
              <div className="text-left">
                <p className="text-[10px] font-bold uppercase text-gray-400 tracking-wider">Necesidad Origen (P2)</p>
                <h3 className="text-sm font-black text-gray-700 uppercase">Espumas + Rollos (BOM de Órdenes FERT)</h3>
                <p className="text-[10px] text-gray-400 mt-1">Ambas necesidades se calculan explotando la lista de materiales de las Órdenes FERT (Provisionales queda como tab de referencia, ya no alimenta este cálculo): componentes &quot;ESPUMA&quot; → Corte Espuma, &quot;LAMINA CILINDRICA&quot; → Corte y Laminado.</p>
                <div className="flex items-center gap-1.5 mt-2 flex-wrap">
                  {selectedDates.length === 0 ? (
                    <Badge className="bg-amber-50 text-amber-700 border-amber-200 text-[9px] font-black uppercase gap-1.5">
                      <CalendarIcon className="w-3 h-3" /> Selecciona al menos 1 fecha para calcular la necesidad
                    </Badge>
                  ) : (
                    <Badge className="bg-primary/10 text-primary border-primary/20 text-[9px] font-black uppercase gap-1.5">
                      <CalendarIcon className="w-3 h-3" /> Ventana de Producción: {format(parseISO(ventanaP2.inicio), 'd MMM', { locale: es })} → {format(parseISO(ventanaP2.fin), 'd MMM yyyy', { locale: es })}
                    </Badge>
                  )}
                  <span className="text-[9px] text-gray-400 font-bold uppercase">Definida por el filtro &quot;Fecha&quot; (sin tope de días, sin saltos entre el mínimo y el máximo seleccionado)</span>
                </div>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                {fechaPopover}
                {/* Familia "Generar Necesidades": trae/calcula datos (sync o explosión BOM) sin
                    escribir nada — outline, tono índigo. "Generar Respuestas" (escribe Plan Grupo/
                    Detalle Táctico real) es sólido/primario. Mismos 2 niveles en los 4 módulos tácticos. */}
                <Button onClick={handleCalcularNecesidadRollos} disabled={isExplodingBom || selectedDates.length === 0} variant="outline" className="h-10 px-6 rounded-2xl gap-2 font-bold text-xs uppercase border-indigo-200 text-indigo-700 hover:bg-indigo-50">
                  {isExplodingBom ? <Loader2 className="w-4 h-4 animate-spin" /> : <Wand2 className="w-4 h-4" />}
                  {isExplodingBom ? `Explotando BOM ${bomProgress.current}/${bomProgress.total}` : 'Generar Necesidades · BOM FERT'}
                </Button>
                <Button
                  onClick={handleGenerarTodosPlanesP2}
                  disabled={isSavingAllPlanP2 || isExplodingBom || (necesidadEspumas1000.length === 0 && necesidadEspumas2000.length === 0 && necesidadRollos1000.length === 0)}
                  className="h-10 px-6 rounded-2xl gap-2 font-bold text-xs uppercase bg-slate-900 hover:bg-slate-800 text-white"
                >
                  {isSavingAllPlanP2 ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                  Generar Respuestas · Todos P2
                </Button>
              </div>
            </div>
            {isExplodingBom && (
              <div className="space-y-1.5">
                <Progress value={bomProgress.total > 0 ? (bomProgress.current / bomProgress.total) * 100 : 0} className="h-2" />
                <p className="text-[9px] font-bold uppercase text-gray-400 tracking-widest text-right">{bomProgress.current} / {bomProgress.total} materiales explotados</p>
              </div>
            )}
            {!isExplodingBom && (bomDiagnostico.sinMatch.length > 0 || bomDiagnostico.conError.length > 0) && (
              <div className="space-y-1.5 bg-amber-50/60 border border-amber-200 rounded-xl px-3 py-2">
                {bomDiagnostico.sinMatch.length > 0 && (
                  <p className="text-[9px] text-amber-800">
                    <span className="font-black uppercase tracking-wider">{bomDiagnostico.sinMatch.length} FERT sin Espuma/Rollo en su BOM</span> — se consultó su explosión de materiales pero ninguna fila (de cualquier nivel) coincidió con &quot;ESPUMA&quot;/&quot;LAMINA CILINDRICA&quot;: <span className="font-mono">{bomDiagnostico.sinMatch.join(', ')}</span>
                  </p>
                )}
                {bomDiagnostico.conError.length > 0 && (
                  <p className="text-[9px] text-red-700">
                    <span className="font-black uppercase tracking-wider">{bomDiagnostico.conError.length} FERT con error al consultar el BOM</span> — revisa la consola del navegador para el detalle: <span className="font-mono">{bomDiagnostico.conError.join(', ')}</span>
                  </p>
                )}
              </div>
            )}
          </div>

          {[
            { t: 'Centro 1000 - Quito', centro: '1000' as const, c: 'text-green-700', b: 'bg-green-600' },
            { t: 'Centro 2000 - Guayaquil', centro: '2000' as const, c: 'text-indigo-700', b: 'bg-indigo-600' }
          ].map((center) => (
            <div key={center.centro} className="space-y-4">
              <h3 className={cn("text-[11px] font-black uppercase flex items-center gap-2 tracking-widest px-1", center.c)}>
                <div className={cn("w-2.5 h-2.5 rounded-full", center.b)} /> {center.t}
              </h3>

              <div className={cn("grid grid-cols-1 gap-4", center.centro === '1000' && "lg:grid-cols-2")}>
                {[
                  { tipo: 'ESPUMAS' as const, label: 'Necesidad Espumas Venta Externa', rows: center.centro === '1000' ? necesidadEspumas1000 : necesidadEspumas2000, accent: 'text-teal-600', bg: 'bg-teal-50/30' },
                  // Rollos (Corte y Laminado) solo existe en Centro 1000 — no hay actividad/pedidos
                  // de ese material en Centro 2000, por eso se suprime ese espacio.
                  ...(center.centro === '1000' ? [{ tipo: 'ROLLOS' as const, label: 'Necesidad Rollos Venta Externa', rows: necesidadRollos1000, accent: 'text-amber-600', bg: 'bg-amber-50/30' }] : [])
                ].map((block, bIdx) => {
                  const key = `${center.centro}-${block.tipo}`;
                  return (
                    <Card key={bIdx} className="rounded-2xl border border-gray-100 shadow-sm overflow-hidden bg-white flex flex-col">
                      <div className={cn("px-4 py-2.5 flex items-center justify-between gap-2 border-b border-gray-100", block.bg)}>
                        <span className="text-[9px] font-black uppercase tracking-widest text-gray-500">{block.label} ({block.rows.length})</span>
                        <div className="flex items-center gap-2 shrink-0">
                          {planP2Generado[key] && (
                            <Badge className="bg-emerald-50 text-emerald-700 border-emerald-200 text-[8px] font-bold uppercase">Plan #{planP2Generado[key]}</Badge>
                          )}
                          <Button
                            size="sm"
                            onClick={() => handleGenerarPlanP2(center.centro, block.tipo)}
                            disabled={block.rows.length === 0 || !!savingPlanP2[key]}
                            className="h-7 px-3 rounded-lg gap-1.5 font-bold text-[9px] uppercase bg-slate-900 hover:bg-slate-800 text-white"
                          >
                            {savingPlanP2[key] ? <Loader2 className="w-3 h-3 animate-spin" /> : <Save className="w-3 h-3" />}
                            Generar Respuestas · P2
                          </Button>
                        </div>
                      </div>
                      <div className="overflow-x-auto max-h-[350px]">
                        <table className="w-full border-collapse text-center">
                          <thead className="bg-gray-50 sticky top-0 text-[9px] font-bold uppercase text-gray-400">
                            <tr>
                              <th className="px-3 py-3 border-r border-gray-100">Material</th>
                              <th className="px-3 py-3 border-r border-gray-100 text-left">Descripción</th>
                              <th className="px-3 py-3">Cantidad</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-gray-50 text-[10px]">
                            {block.rows.length === 0 ? (
                              <tr><td colSpan={3} className="py-10 text-center text-gray-300 font-bold uppercase tracking-widest">Sin datos</td></tr>
                            ) : (
                              block.rows.map((row, i) => (
                                <tr key={i} className="hover:bg-gray-50/50">
                                  <td className="px-3 py-2 font-mono font-bold text-primary border-r border-gray-50">{row.material}</td>
                                  <td className="px-3 py-2 text-left border-r border-gray-50 text-gray-500 uppercase truncate max-w-[220px]">{row.descripcion}</td>
                                  <td className={cn("px-3 py-2 font-mono font-black", block.accent)}>{row.cantidad.toLocaleString(undefined, { maximumFractionDigits: 2 })}</td>
                                </tr>
                              ))
                            )}
                          </tbody>
                        </table>
                      </div>
                    </Card>
                  );
                })}
              </div>
            </div>
          ))}
        </TabsContent>

        <TabsContent value="dataAprobada" className="space-y-6 animate-in fade-in duration-300">
          <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 bg-gray-50/50 p-4 rounded-2xl border border-gray-100">
            <div className="text-left">
              <p className="text-[10px] font-bold uppercase text-gray-400 tracking-wider">Recepción de Datos (P3)</p>
              <h3 className="text-sm font-black text-gray-700 uppercase">Respuesta del Plan Consumidor</h3>
              <p className="text-[10px] text-gray-400 mt-1">Por cada material que enviamos en nuestro P2, busca si algún Plan P3 (consumidor real, no PFD) ya respondió — un DetalleTactico cuyo <span className="font-mono">codigo_plan_grupo_padre</span> apunta a nuestro plan. La columna &quot;Fechas&quot; avisa si esa respuesta NO se guardó exactamente un día después de nuestra línea (regla &quot;revisión hoy, devolución mañana&quot;).</p>
            </div>
            <Button onClick={fetchDataAprobada} disabled={isLoadingDataAprobada} variant="outline" className="h-10 px-6 rounded-2xl gap-2 font-bold text-xs uppercase shrink-0 border-indigo-200 text-indigo-700 hover:bg-indigo-50">
              {isLoadingDataAprobada ? <Loader2 className="w-4 h-4 animate-spin" /> : <RefreshCw className="w-4 h-4" />}
              Actualizar
            </Button>
          </div>

          {[
            { key: '1000-ESPUMAS', t: 'Centro 1000 · P2 Espumas', c: 'text-teal-700', b: 'bg-teal-600' },
            { key: '1000-ROLLOS', t: 'Centro 1000 · P2 Rollos', c: 'text-amber-700', b: 'bg-amber-600' },
            { key: '2000-ESPUMAS', t: 'Centro 2000 · P2 Espumas', c: 'text-teal-700', b: 'bg-teal-600' }
          ].map((block) => {
            const rows = dataAprobada[block.key] || [];
            return (
              <div key={block.key} className="space-y-3">
                <h3 className={cn("text-[11px] font-black uppercase flex items-center gap-2 tracking-widest px-1", block.c)}>
                  <div className={cn("w-2.5 h-2.5 rounded-full", block.b)} /> {block.t} ({rows.length})
                </h3>
                <Card className="rounded-2xl border border-gray-100 shadow-sm overflow-hidden bg-white">
                  <div className="overflow-x-auto max-h-[400px]">
                    <table className="w-full border-collapse text-center">
                      <thead className="bg-gray-50 sticky top-0 text-[9px] font-bold uppercase text-gray-400">
                        <tr>
                          <th className="px-3 py-3 border-r border-gray-100">Material</th>
                          <th className="px-3 py-3 border-r border-gray-100 text-left">Descripción</th>
                          <th className="px-3 py-3 border-r border-gray-100">Cantidad</th>
                          <th className="px-3 py-3 border-r border-gray-100">Respuesta Cant.</th>
                          <th className="px-3 py-3 border-r border-gray-100">Plan Grupo</th>
                          <th className="px-3 py-3 border-r border-gray-100">Fechas</th>
                          <th className="px-3 py-3">Estado</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-50 text-[10px]">
                        {rows.length === 0 ? (
                          <tr><td colSpan={7} className="py-10 text-center text-gray-300 font-bold uppercase tracking-widest">Sin plan P2 activo o sin materiales</td></tr>
                        ) : (
                          rows.map((row, i) => {
                            const estado = estadoDataAprobada(row);
                            return (
                              <tr key={i} className="hover:bg-gray-50/50">
                                <td className="px-3 py-2 font-mono font-bold text-primary border-r border-gray-50">{row.material}</td>
                                <td className="px-3 py-2 text-left border-r border-gray-50 text-gray-500 uppercase truncate max-w-[220px]">{row.descripcion}</td>
                                <td className="px-3 py-2 font-mono font-black text-gray-900 border-r border-gray-50">{row.cantidad.toLocaleString()}</td>
                                <td className="px-3 py-2 font-mono font-black text-indigo-700 border-r border-gray-50">{row.respuestaCant.toLocaleString()}</td>
                                <td className="px-3 py-2 font-mono text-gray-500 border-r border-gray-50">{row.planGrupo}</td>
                                <td className="px-3 py-2 border-r border-gray-50">
                                  {row.fechasOk === null ? (
                                    <span className="text-gray-300">—</span>
                                  ) : (
                                    <Badge className={cn(
                                      "text-[8px] font-bold uppercase border",
                                      row.fechasOk ? "bg-emerald-50 text-emerald-700 border-emerald-200" : "bg-red-50 text-red-700 border-red-200"
                                    )}>
                                      {row.fechasOk ? 'Coinciden' : 'Distintas'}
                                    </Badge>
                                  )}
                                </td>
                                <td className="px-3 py-2">
                                  <Badge className={cn(
                                    "text-[8px] font-bold uppercase border",
                                    estado === 'completo' && "bg-emerald-50 text-emerald-700 border-emerald-200",
                                    estado === 'parcial' && "bg-amber-50 text-amber-700 border-amber-200",
                                    estado === 'pendiente' && "bg-gray-50 text-gray-400 border-gray-200"
                                  )}>
                                    {estado}
                                  </Badge>
                                </td>
                              </tr>
                            );
                          })
                        )}
                      </tbody>
                    </table>
                  </div>
                </Card>
              </div>
            );
          })}

          {/* "PFD - VENTA": sube desde el componente YA RESPONDIDO (estado "completo" arriba) hacia su
              FERT/PT padre — dirección opuesta a como se explota el BOM para generar la Necesidad P2
              (ver generarPfdVentaPreview). Solo Espumas: Rollos no tiene Data Aprobada con datos reales hoy. */}
          <div className="pt-6 mt-6 border-t-2 border-dashed border-gray-100 space-y-6">
            <div className="bg-indigo-50/40 p-4 rounded-2xl border border-indigo-100 text-left">
              <p className="text-[10px] font-bold uppercase text-indigo-400 tracking-wider">Siguiente paso</p>
              <h3 className="text-sm font-black text-gray-700 uppercase">PFD - Venta (FERT/PT listos)</h3>
              <p className="text-[10px] text-gray-400 mt-1">Por cada componente en estado &quot;completo&quot; arriba, sube al FERT/PT que depende de él (mismo BOM de la Necesidad P2, en sentido inverso) y agrupa por categoría — igual que &quot;Resumen Necesidades&quot;, con el tiempo real de plastificado.</p>
            </div>

            {(['1000', '2000'] as const).map(centro => {
              const preview = pfdVentaPreview[centro];
              const keySave = `PFD-${centro}`;
              return (
                <div key={centro} className="space-y-3">
                  <div className="flex items-center justify-between px-1">
                    <h3 className="text-[11px] font-black uppercase flex items-center gap-2 tracking-widest text-indigo-700">
                      <div className="w-2.5 h-2.5 rounded-full bg-indigo-600" /> PFD-VENTA · Centro {centro}
                      {pfdVentaGenerado[keySave] && (
                        <Badge className="bg-emerald-50 text-emerald-700 border-emerald-200 text-[8px] font-bold uppercase">Plan #{pfdVentaGenerado[keySave]}</Badge>
                      )}
                    </h3>
                    <div className="flex items-center gap-2">
                      <Button
                        onClick={() => generarPfdVentaPreview(centro)}
                        disabled={isGeneratingPfdVenta[centro]}
                        variant="outline" size="sm"
                        className="h-9 px-4 rounded-2xl gap-2 font-bold text-[10px] uppercase border-indigo-200 text-indigo-700 hover:bg-indigo-50"
                      >
                        {isGeneratingPfdVenta[centro] ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <RefreshCw className="w-3.5 h-3.5" />} Generar PFD-VENTA
                      </Button>
                      {preview && preview.lineas.length > 0 && (
                        <Button
                          onClick={async () => {
                            const resultado = await guardarPfdVentaCore(centro);
                            addNotification(resultado.status === 'ok' ? 'success' : resultado.status === 'sin-datos' ? 'warning' : 'error', resultado.mensaje);
                          }}
                          disabled={savingPfdVenta[keySave]}
                          size="sm"
                          className="h-9 px-4 rounded-2xl gap-2 font-bold text-[10px] uppercase bg-indigo-600 text-white hover:bg-indigo-700"
                        >
                          {savingPfdVenta[keySave] ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <ClipboardCheck className="w-3.5 h-3.5" />} Guardar PFD-VENTA
                        </Button>
                      )}
                    </div>
                  </div>

                  {isGeneratingPfdVenta[centro] && (
                    <div className="flex items-center gap-3 rounded-xl border border-indigo-100 bg-indigo-50/40 px-4 py-2.5">
                      <div className="flex-1 h-1.5 bg-indigo-100 rounded-full overflow-hidden">
                        <div
                          className="h-full bg-indigo-600 transition-all duration-300 ease-out"
                          style={{ width: `${(pfdVentaBomProgress[centro]?.total ?? 0) > 0 ? ((pfdVentaBomProgress[centro]?.current ?? 0) / (pfdVentaBomProgress[centro]!.total)) * 100 : 0}%` }}
                        />
                      </div>
                      <span className="text-[10px] font-black uppercase tracking-widest text-indigo-700 shrink-0">
                        Explotando BOM {pfdVentaBomProgress[centro]?.current ?? 0} / {pfdVentaBomProgress[centro]?.total ?? 0} materiales
                      </span>
                    </div>
                  )}

                  {!preview ? (
                    <Card className="rounded-2xl border border-dashed border-gray-200 py-10 text-center text-gray-300 font-bold uppercase tracking-widest text-xs">
                      {isGeneratingPfdVenta[centro] ? 'Explotando BOM...' : <>Pulsa &quot;Generar PFD-VENTA&quot; para ver los materiales FERT/PT listos.</>}
                    </Card>
                  ) : (
                    <>
                      <Card className="rounded-2xl border border-gray-100 shadow-sm overflow-hidden bg-white">
                        {preview.lineas.length === 0 ? (
                          <div className="py-16 text-center text-gray-400 font-bold uppercase tracking-widest opacity-30">Ningún FERT/PT cubierto todavía</div>
                        ) : (
                          <div className="overflow-x-auto max-h-[500px] overflow-y-auto">
                            <table className="w-full border-collapse text-center font-sans">
                              <thead className="bg-gray-50 sticky top-0 text-[9px] font-black uppercase text-gray-400 border-b border-gray-100">
                                <tr>
                                  <th className="px-4 py-3 border-r border-gray-100 text-left">Material</th>
                                  <th className="px-4 py-3 border-r border-gray-100 text-left">Descripción</th>
                                  <th className="px-4 py-3 border-r border-gray-100 text-left">Categoría</th>
                                  <th className="px-4 py-3 border-r border-gray-100 font-black bg-indigo-50/30 text-indigo-700">Unidades (se graba)</th>
                                  <th className="px-4 py-3 text-amber-700 bg-amber-50/30">Tiempo Planchas (H)</th>
                                </tr>
                              </thead>
                              <tbody className="divide-y divide-gray-50 text-[11px]">
                                {preview.lineas.map((linea, i) => (
                                  <tr key={i} className="hover:bg-gray-50/50 transition-colors">
                                    <td className="px-4 py-2 font-mono font-bold text-indigo-600 border-r border-gray-50 text-left">{linea.material}</td>
                                    <td className="px-4 py-2 text-left font-sans normal-case text-gray-600 border-r border-gray-50 truncate max-w-[220px]">{linea.descripcion}</td>
                                    <td className="px-4 py-2 text-left font-mono text-gray-500 border-r border-gray-50">{linea.categoria}</td>
                                    <td className="px-4 py-2 font-mono font-black text-indigo-700 bg-indigo-50/10 border-r border-gray-50">{linea.cantidad.toLocaleString()}</td>
                                    <td className="px-4 py-2 font-mono font-black text-amber-600 bg-amber-50/5">{linea.tiempoHoras.toFixed(2)}</td>
                                  </tr>
                                ))}
                              </tbody>
                            </table>
                          </div>
                        )}
                      </Card>

                      {preview.sinTrazabilidad.length > 0 && (
                        <Card className="rounded-2xl border border-dashed border-amber-200 bg-amber-50/30 p-4">
                          <p className="text-[10px] font-black uppercase text-amber-700 tracking-widest mb-2">Sin trazabilidad ({preview.sinTrazabilidad.length})</p>
                          <p className="text-[10px] text-amber-600/80 mb-3">Estos componentes ya están &quot;completo&quot; pero no se encontró su FERT/PT padre en la Necesidad P2 (BOM sin match, o el componente ya no pertenece al P2 activo) — no cuentan como cubiertos, revísalos aparte.</p>
                          <div className="space-y-1">
                            {preview.sinTrazabilidad.map(r => (
                              <div key={r.material} className="flex items-center justify-between text-[10px] font-mono text-amber-700 bg-white/60 rounded-lg px-3 py-1.5">
                                <span>{r.material} — {r.descripcion}</span>
                                <span>{r.cantidad.toLocaleString()}</span>
                              </div>
                            ))}
                          </div>
                        </Card>
                      )}
                    </>
                  )}
                </div>
              );
            })}
          </div>
        </TabsContent>

        <TabsContent value="pendientes" className="space-y-6 animate-in fade-in duration-300">
          <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 bg-gray-50/50 p-4 rounded-2xl border border-gray-100">
            <div className="text-left">
              <p className="text-[10px] font-bold uppercase text-gray-400 tracking-wider">Pedidos sin entregar</p>
              <h3 className="text-sm font-black text-gray-700 uppercase">Pendientes Totales</h3>
            </div>
            <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
              <div className="relative">
                <Search className="w-3.5 h-3.5 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2" />
                <Input
                  value={pendientesSearch}
                  onChange={(e) => setPendientesSearch(e.target.value)}
                  placeholder="Buscar Pedido, Material o Descripción..."
                  className="h-10 pl-9 rounded-2xl border-gray-200 text-xs w-full sm:w-72"
                />
              </div>
              <div className="flex items-center gap-2">
                <Input
                  type="date"
                  value={pendientesFechaDesde}
                  onChange={(e) => setPendientesFechaDesde(e.target.value)}
                  className="h-10 rounded-2xl border-gray-200 text-xs"
                />
                <span className="text-[10px] font-bold text-gray-400 uppercase">a</span>
                <Input
                  type="date"
                  value={pendientesFechaHasta}
                  onChange={(e) => setPendientesFechaHasta(e.target.value)}
                  className="h-10 rounded-2xl border-gray-200 text-xs"
                />
              </div>
              <Button
                variant="outline"
                size="sm"
                onClick={fetchPendientesTotales}
                disabled={isLoadingPendientes}
                className="h-10 px-4 rounded-2xl gap-2 font-bold text-[10px] uppercase border-indigo-200 text-indigo-700 hover:bg-indigo-50"
              >
                <RefreshCw className={cn("w-3.5 h-3.5", isLoadingPendientes && "animate-spin")} /> Actualizar
              </Button>
            </div>
          </div>

          {(['1000', '2000'] as const).map(centro => {
            const grupos = pendientesAgrupadosPorCentro[centro];
            const totalPedidos = grupos.reduce((s, g) => s + g.pedidos.length, 0);
            const nombrePlanta = centro === '1000' ? 'UIO' : 'GYE';
            return (
              <div key={centro} className="space-y-3">
                <div className="flex items-center justify-between px-1">
                  <h3 className="text-[11px] font-black uppercase flex items-center gap-2 tracking-widest text-amber-700">
                    <div className="w-2.5 h-2.5 rounded-full bg-amber-600" /> Pedidos Pendientes — Centro {centro} ({nombrePlanta})
                  </h3>
                  <Badge variant="outline" className="text-[9px] font-bold border-gray-200 text-gray-400">
                    {totalPedidos.toLocaleString()} pedidos · {grupos.length.toLocaleString()} materiales
                  </Badge>
                </div>

                <Card className="rounded-2xl border border-gray-100 shadow-sm overflow-hidden bg-white">
                  {isLoadingPendientes ? (
                    <div className="py-16 flex flex-col items-center justify-center gap-3 text-gray-400">
                      <Loader2 className="w-6 h-6 animate-spin" />
                      <p className="text-[10px] font-bold uppercase tracking-widest">Cargando pendientes...</p>
                    </div>
                  ) : grupos.length === 0 ? (
                    <div className="py-16 text-center text-gray-400 font-bold uppercase tracking-widest opacity-30">Sin pedidos pendientes</div>
                  ) : (
                    <div className="max-h-[600px] overflow-y-auto px-4">
                      <Accordion type="multiple" value={expandedPendientesMateriales} onValueChange={setExpandedPendientesMateriales} className="divide-y divide-gray-50">
                        {grupos.map(group => (
                          <AccordionItem key={group.material} value={`${centro}::${group.material}`} className="border-b-0">
                            <AccordionTrigger className="hover:no-underline py-3 px-2">
                              <div className="flex items-center justify-between w-full pr-4 text-left">
                                <div className="flex items-center gap-3">
                                  <Badge className="bg-amber-50 text-amber-800 font-mono font-bold text-[9px] border-amber-200">{group.material}</Badge>
                                  <p className="text-xs font-black text-gray-700 uppercase truncate max-w-[360px]">{group.descripcion || 'Sin descripción'}</p>
                                </div>
                                <div>
                                  <p className="text-[8px] font-black uppercase text-gray-400 tracking-wider">Pedidos</p>
                                  <p className="text-xs font-mono font-bold text-amber-600 text-right">{group.pedidos.length}</p>
                                </div>
                              </div>
                            </AccordionTrigger>
                            <AccordionContent>
                              <div className="overflow-x-auto">
                              <table className="w-full border-collapse text-center font-sans bg-gray-50/40 rounded-xl overflow-hidden">
                                <thead className="bg-gray-50 text-[9px] font-black uppercase text-gray-400 border-b border-gray-100">
                                  <tr>
                                    <th className="px-4 py-2 border-r border-gray-100 text-left">Pedido</th>
                                    <th className="px-3 py-2 border-r border-gray-100">Posición</th>
                                    <th className="px-3 py-2 border-r border-gray-100">Cant. Pedida</th>
                                    <th className="px-3 py-2 border-r border-gray-100">Vol. Pend.</th>
                                    <th className="px-3 py-2 border-r border-gray-100">Fecha Pedido</th>
                                    <th className="px-3 py-2 border-r border-gray-100">Fecha Entrega</th>
                                    <th className="px-3 py-2 border-r border-gray-100 text-left">Ciudad Destino</th>
                                    <th className="px-3 py-2 border-r border-gray-100 font-mono text-gray-500">Cod.Buscar</th>
                                    <th className="px-4 py-2 bg-teal-50/40 text-teal-700">FERT · Fecha Entrega</th>
                                  </tr>
                                </thead>
                                <tbody className="divide-y divide-gray-50 text-[11px]">
                                  {group.pedidos.map((p, i) => (
                                    <tr key={i} className="hover:bg-gray-50/50 transition-colors">
                                      <td className="px-4 py-2 font-mono font-bold text-gray-700 border-r border-gray-100 text-left">{p.pedido}</td>
                                      <td className="px-3 py-2 font-mono text-gray-500 border-r border-gray-100">{p.posicion || '—'}</td>
                                      <td className="px-3 py-2 font-mono text-gray-700 border-r border-gray-100">{p.cantPedida || '—'}</td>
                                      <td className="px-3 py-2 font-mono text-gray-700 border-r border-gray-100">{p.volPend || '—'}</td>
                                      <td className="px-3 py-2 font-mono text-gray-500 border-r border-gray-100">{p.fechaPedido || '—'}</td>
                                      <td className="px-3 py-2 font-mono text-gray-500 border-r border-gray-100">{p.fechaEntrega || '—'}</td>
                                      <td className="px-3 py-2 text-left text-gray-500 uppercase border-r border-gray-100">{p.ciudadDestino || '—'}</td>
                                      <td className="px-3 py-2 font-mono text-gray-500 border-r border-gray-100">{p.codBuscar}</td>
                                      <td className="px-4 py-2 font-mono font-bold bg-teal-50/10 text-teal-700">{p.fechaEntregaFert || '—'}</td>
                                    </tr>
                                  ))}
                                </tbody>
                              </table>
                              </div>
                            </AccordionContent>
                          </AccordionItem>
                        ))}
                      </Accordion>
                    </div>
                  )}
                </Card>
              </div>
            );
          })}
        </TabsContent>
      </Tabs>
    </div>
  );
};
