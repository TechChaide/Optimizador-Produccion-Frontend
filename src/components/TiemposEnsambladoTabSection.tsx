'use client';

import React, { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { serviciosService } from '@/services/servicios.service';
import { grupoService } from '@/services/grupo.service';
import { useRuntimeInspector } from '@/services/RuntimeInspector';
import { useAppContext } from '@/context/AppProvider';
import { useTiemposFertData, dedupeTiemposRows } from '@/hooks/useTiemposFertData';
import { useFertPrincipalesRevCapHalb } from '@/hooks/useRevCapHalbLink';
import { publishTiempoFinalPorPuesto, publishCantidadFinalPorPuesto, publishTiempoInicialPorPuesto, publishCantidadInicialPorPuesto, publishResultadoAjusteCentro, publishResultadoActualCentro, CantReprogMaterialRow } from '@/hooks/useProgTiemposCapacidad';
import { Clock, Loader2, Search, Home, AlertCircle, UserCircle, Check, ChevronsUpDown, X, LayoutGrid, Calendar as CalendarIcon } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from '@/components/ui/badge';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
} from "@/components/ui/command";
import { cn } from '@/lib/utils';

interface TiempoEnsamblado {
  CodMaterial: string;
  Centro: string;
  PuestoTrabajoLinea: string;
  Linea: string;
  PuestoTrabajo: string;
  Tiempo_Min: number;
  StockActual: number;
  StockSeguridad: number;
  StockMaximo: number;
  GrupoCompras: string;
  ClaseAprovisionam: string;
  TamLoteMin: number;
  TamLoteMax: number;
  RespCtrlProd: string;
  NombRespControlProd: string;
}

interface TiemposEnsambladoTabSectionProps {
  readonly allowedLines?: string[];
  readonly allowedWorkstations?: string[];
  readonly isCompact?: boolean;
}

/**
 * Normaliza una cadena de fecha a formato YYYY-MM-DD
 * Soporta DD/MM/YYYY y YYYY-MM-DD
 */
const MAT_BALANCEO_LINK_KEY = 'material_balanceo_expanded_data';
const CANT_REPROG_KEY = 'prog_tiempos_cant_reprog';
// Espejo de 'sim_prog_dates' pero para la "Fecha previsionales": se publica aquí para que otras
// pestañas (p.ej. "Rev cap Halb") puedan filtrar Órdenes Previsionales con la misma fecha
// seleccionada acá, igual que ya ocurre con "Día programación" vía sim_prog_dates.
const PROVISIONAL_DATES_KEY = 'sim_provisional_dates';

interface MatBalanceoLink {
  centro: string;
  linea: string;
  material: string;
  puestoTrabajo: string;
  cantPresupuesto: number;
  minimo: number;
  maximo: number;
  prioridad: number;
  habilitado: boolean;
}

// Debe mantenerse igual a RESTRICCIONES_PUESTOS en RevCapacidadTabSection.tsx: es el valor por
// defecto de "Puestos T1" cuando el usuario todavía no lo ha ajustado a mano en Rev Capacidad.
const RESTRICCIONES_PUESTOS: Record<string, number> = {
  'LINEA 1|Armado': 12,
  'LINEA 1|Cerrado L1': 6,
  'LINEA 2|Armado': 6,
  'LINEA 2|Cerrado1 L2': 4,
  'LINEA 2|Cerrado2 L2': 4,
  'LINEA 3|Armado': 2,
  'LINEA 3|Cerrado L3': 1,
  'LINEA 5|Armado': 2,
};

const RANGO_OCUPACION_MIN = 93;
const RANGO_OCUPACION_MAX = 100;

const readLocalJSON = (key: string): any => {
  try {
    const raw = localStorage.getItem(key);
    return raw ? JSON.parse(raw) : null;
  } catch (e) {
    return null;
  }
};

// Mapeo de equivalencias Máquina -> Línea (igual al usado en "Fert" y "Previsionales"): la Línea
// de una orden Fert/Previsional se deriva de su Máquina, no de patrones en Categoría.
const MAQUINA_LINEA_MAP: Record<string, string> = {
  'HR-ARM01': 'LINEA 1',
  'HR-ARM02': 'LINEA 2',
  'HR-ARM03': 'LINEA 3',
  'HR-ARM05': 'LINEA 5',
  'HR-ARM21': 'LINEA 1',
  'HR-ARM22': 'LINEA 2',
  'HR-ARM25': 'LINEA 5',
};

const mapLinea = (o: any): string => {
  const maquina = String(o.MAQUINA || o.Maquina || o.maquina || '').trim().toUpperCase();
  return MAQUINA_LINEA_MAP[maquina] || '';
};

const normalizeDateISO = (dateStr: any): string | null => {
  if (!dateStr) return null;
  const s = String(dateStr).trim();
  
  // Caso: DD/MM/YYYY
  let match = s.match(/^(\d{1,2})[\/-](\d{1,2})[\/-](\d{4})/);
  if (match) {
    return `${match[3]}-${match[2].padStart(2, '0')}-${match[1].padStart(2, '0')}`;
  }
  
  // Caso: YYYY-MM-DD
  match = s.match(/^(\d{4})-(\d{1,2})-(\d{1,2})/);
  if (match) {
    return `${match[1]}-${match[2].padStart(2, '0')}-${match[3].padStart(2, '0')}`;
  }
  
  return null;
};

export const TiemposEnsambladoTabSection: React.FC<TiemposEnsambladoTabSectionProps> = ({ 
  allowedLines, 
  allowedWorkstations,
  isCompact = false 
}) => {
  const inspector = useRuntimeInspector('TiemposEnsambladoTab');
  const { addNotification } = useAppContext();
  const hasStarted = useRef(false);

  // En modo compacto ("Prog Tiempos") los datos técnicos viven en un store compartido con
  // "Explosion Materiales": esta pestaña es la que los carga/actualiza, la otra solo los lee.
  const sharedTiempos = useTiemposFertData();
  // Fert_Principal por Centro publicados por "Rev cap Halb": si el Material de una fila ya
  // aparece ahí, esta fila se marca "Ajustado" y se excluye de futuras reprogramaciones.
  const fertPrincipalesRevCapHalb = useFertPrincipalesRevCapHalb();

  const [localAllData, setLocalAllData] = useState<TiempoEnsamblado[]>([]);
  const [availableCenters, setAvailableCenters] = useState<string[]>([]);
  const [selectedCenter, setSelectedCenter] = useState<string>("");
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedResponsables, setSelectedResponsables] = useState<string[]>([]);
  const [selectedLineas, setSelectedLineas] = useState<string[]>([]);
  const [programmingDate, setProgrammingDate] = useState<string>(new Date().toISOString().split('T')[0]);
  const [provisionalDate, setProvisionalDate] = useState<string>(new Date().toISOString().split('T')[0]);
  const [isLoadingLocal, setIsLoadingLocal] = useState<boolean>(false);

  const allData = (isCompact ? sharedTiempos.tiemposData : localAllData) as TiempoEnsamblado[];
  const isLoading = isCompact ? (isLoadingLocal || sharedTiempos.isLoading) : isLoadingLocal;

  const fertOrders = useMemo(() => {
    if (!isCompact) return [];
    return sharedTiempos.fertOrders.map((o: any) => ({ ...o, LINEA_MAPPED: mapLinea(o) }));
  }, [isCompact, sharedTiempos.fertOrders]);

  const provisionalOrders = useMemo(() => {
    if (!isCompact) return [];
    return sharedTiempos.provisionalOrders.map((o: any) => ({ ...o, LINEA_MAPPED: mapLinea(o) }));
  }, [isCompact, sharedTiempos.provisionalOrders]);

  const [isRespFilterOpen, setIsRespFilterOpen] = useState(false);
  const [isLineaFilterOpen, setIsLineFilterOpen] = useState(false);
  const [hideZeroCantidad, setHideZeroCantidad] = useState(false);

  const [currentPage, setCurrentPage] = useState(1);
  const [rowsPerPage, setRowsPerPage] = useState(20);
  const [matBalanceoLink, setMatBalanceoLink] = useState<MatBalanceoLink[]>([]);
  const [cantReprogByKey, setCantReprogByKey] = useState<Record<string, number>>({});
  const [isReprogLoaded, setIsReprogLoaded] = useState(false);

  const normalizeMaterialCode = (code: string | number): string => {
    return String(code || '').trim().slice(-8);
  };

  // Cargar la relación Centro + Línea + Material + Puesto Trabajo -> Cant Presupuesto publicada por Mat Balanceo
  useEffect(() => {
    if (typeof window === 'undefined') return;
    try {
      const raw = localStorage.getItem(MAT_BALANCEO_LINK_KEY);
      if (raw) setMatBalanceoLink(JSON.parse(raw));
    } catch (e) {
      console.error('[TiemposEnsambladoTab] Error al cargar datos de Mat Balanceo:', e);
    }
  }, []);

  const cantPresupMap = useMemo(() => {
    const map = new Map<string, number>();
    matBalanceoLink.forEach(item => {
      const key = `${item.centro}|${item.linea}|${item.material}|${item.puestoTrabajo}`;
      map.set(key, (map.get(key) || 0) + (Number(item.cantPresupuesto) || 0));
    });
    return map;
  }, [matBalanceoLink]);

  // Mínimo/Máximo/Prioridad/Habilitado son propiedades del Material en sí (no varían por Línea o
  // Puesto), usadas por el proceso de ajuste de capacidad ("Ajustar" por Centro).
  const matBalanceoInfoByMaterial = useMemo(() => {
    const map = new Map<string, { minimo: number; maximo: number; prioridad: number; habilitado: boolean }>();
    matBalanceoLink.forEach(item => {
      const key = `${item.centro}|${item.material}`;
      if (!map.has(key)) {
        map.set(key, {
          minimo: Number(item.minimo) || 0,
          maximo: Number(item.maximo) || 0,
          prioridad: Number(item.prioridad) || 0,
          habilitado: !!item.habilitado,
        });
      }
    });
    return map;
  }, [matBalanceoLink]);

  // "Cant Reprog" (editable, solo en modo compacto): persiste por fila (Centro+Línea+Material+
  // Puesto Trabajo) en localStorage, igual que "Cant reprog" en Rev cap Halb.
  useEffect(() => {
    if (!isCompact || typeof window === 'undefined') return;
    try {
      const raw = localStorage.getItem(CANT_REPROG_KEY);
      if (raw) setCantReprogByKey(JSON.parse(raw));
    } catch (e) {
      console.error('[TiemposEnsambladoTab] Error al cargar Cant Reprog:', e);
    }
    setIsReprogLoaded(true);
  }, [isCompact]);

  useEffect(() => {
    if (isCompact && isReprogLoaded) {
      localStorage.setItem(CANT_REPROG_KEY, JSON.stringify(cantReprogByKey));
    }
  }, [cantReprogByKey, isCompact, isReprogLoaded]);

  // VINCULACIÓN CON REV CAPACIDAD (CENTRO 1000)
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const savedProgDates = localStorage.getItem('sim_prog_dates');
      if (savedProgDates) {
        try {
          const parsed = JSON.parse(savedProgDates);
          // Si existe fecha para el Centro 1000 en capacidad, sincronizarla aquí
          if (parsed['1000']) {
            setProgrammingDate(parsed['1000']);
          }
        } catch (e) {
          console.error('[TiemposEnsambladoTab] Error al cargar sim_prog_dates:', e);
        }
      }
      const savedProvDates = localStorage.getItem(PROVISIONAL_DATES_KEY);
      if (savedProvDates) {
        try {
          const parsed = JSON.parse(savedProvDates);
          if (parsed['1000']) {
            setProvisionalDate(parsed['1000']);
          }
        } catch (e) {
          console.error('[TiemposEnsambladoTab] Error al cargar sim_provisional_dates:', e);
        }
      }
    }
  }, []);

  const loadData = useCallback(async () => {
    setIsLoadingLocal(true);
    try {
      const groupsRes = await grupoService.getAll();
      const centersFromGroups = [...new Set((groupsRes?.data || []).map((g: any) => String(g.centro).trim()))].sort();
      setAvailableCenters(centersFromGroups);
      if (centersFromGroups.length > 0 && !selectedCenter) setSelectedCenter(centersFromGroups[0]);

      if (isCompact) {
        // Datos técnicos + Fert/Previsionales: los trae el store compartido (una sola vez;
        // no repite la descarga si ya hay datos cargados).
        sharedTiempos.ensureLoaded();
      } else if (localAllData.length === 0) {
        let allTiempos: TiempoEnsamblado[] = [];
        let page = 1;
        let hasMore = true;
        const pageSize = 10000;

        while (hasMore) {
          const response = await serviciosService.getTiemposEnsamblado(page, pageSize);
          const rawData = Array.isArray(response?.data) ? response.data : [];
          allTiempos = [...allTiempos, ...rawData];

          const total = response.totalRegistros || response.totalRecords || 0;
          if (allTiempos.length >= total || rawData.length < pageSize || total === 0) {
            hasMore = false;
          } else {
            page++;
          }
          if (page > 50) break;
        }
        const dedupedTiempos = dedupeTiemposRows(allTiempos) as TiempoEnsamblado[];
        setLocalAllData(dedupedTiempos);
        inspector.captureVariable('tiempos_raw_count', dedupedTiempos.length);
      }
    } catch (err) {
      addNotification('error', `Error al cargar datos: ${(err as Error).message}`);
    } finally {
      setIsLoadingLocal(false);
    }
  }, [addNotification, inspector, selectedCenter, isCompact, localAllData.length, sharedTiempos.ensureLoaded]);

  useEffect(() => {
    if (!hasStarted.current || isCompact) {
      hasStarted.current = true;
      loadData();
    }
  }, [loadData, isCompact]);

  // "Prog Tiempos" es la dueña del store compartido de Tiempos/Fert/Previsionales ("Explosion
  // Materiales" solo lo lee): por eso, a diferencia de "Explosion Materiales" (que usa
  // ensureLoaded para no repetir descargas), cada vez que esta pestaña se monta fuerza una
  // recarga real con refresh(). Sin esto, si el store ya tenía datos de una carga previa en la
  // sesión (p. ej. porque "Explosion Materiales" se abrió primero), "Prog Tiempos" se quedaba
  // mostrando esos mismos datos obsoletos (Material/Línea/Puesto Trabajo/Tiempo) hasta que el
  // usuario presionara "Actualizar" a mano.
  const hasRefreshedShared = useRef(false);
  useEffect(() => {
    if (isCompact && !hasRefreshedShared.current) {
      hasRefreshedShared.current = true;
      sharedTiempos.refresh();
    }
  }, [isCompact, sharedTiempos.refresh]);

  // Mapa de suma de Cant Pendiente por (Fecha, Centro, Línea, Material) para FERT. Incluye TODOS
  // los centros (no solo el de la sub-pestaña activa) para poder calcular "Total Cantidad" de
  // cualquier Centro+Línea+Puesto sin depender de cuál sub-pestaña esté abierta — necesario para
  // publicar "Tiempo Final" de ambos centros hacia "Rev Capacidad" en simultáneo.
  const fertSumMap = useMemo(() => {
    const map = new Map<string, number>();
    if (!isCompact || !fertOrders.length || !programmingDate) return map;

    const targetDateISO = normalizeDateISO(programmingDate);
    if (!targetDateISO) return map;

    fertOrders.forEach(o => {
      const fertDateISO = normalizeDateISO(o.FECHA || o.fecha);
      if (fertDateISO !== targetDateISO) return;

      const centro = String(o.CENTRO || '').trim();
      const linea = String(o.LINEA_MAPPED || '').trim().toUpperCase();
      const material = normalizeMaterialCode(o.MATERIAL || o.Material || o.CodMaterial);
      const key = `${centro}|${linea}|${material}`;

      const pend = Number(o.CANTPENDIENTE || o.CantPendiente || 0) || 0;
      map.set(key, (map.get(key) || 0) + pend);
    });

    return map;
  }, [isCompact, fertOrders, programmingDate]);

  // Mapa de suma de Cantidad por (Fecha, Centro, Línea, Material) para PREVISIONALES. Igual que
  // fertSumMap, cubre todos los centros a la vez.
  const provisionalSumMap = useMemo(() => {
    const map = new Map<string, number>();
    if (!isCompact || !provisionalOrders.length || !provisionalDate) return map;

    const targetDateISO = normalizeDateISO(provisionalDate);
    if (!targetDateISO) return map;

    provisionalOrders.forEach(o => {
      const prevDateISO = normalizeDateISO(o.FECHAINICIO || o.fecha_inicio);
      if (prevDateISO !== targetDateISO) return;

      const centro = String(o.Centro || '').trim();
      const linea = String(o.LINEA_MAPPED || '').trim().toUpperCase();
      const material = normalizeMaterialCode(o.MATERIAL || o.CodMaterial || o.Material);
      const key = `${centro}|${linea}|${material}`;

      const cant = Number(o.CANTIDAD || o.Cantidad || 0) || 0;
      map.set(key, (map.get(key) || 0) + cant);
    });

    return map;
  }, [isCompact, provisionalOrders, provisionalDate]);

  // Detalle (no solo la suma) de las Órdenes Previsionales por (Fecha, Centro, Línea, Material):
  // permite, por cada material, repetir su fila técnica una vez por cada Orden Previsional
  // encontrada, mostrando el "Pedido Ventas" y "Posición Pedido" propios de esa orden.
  const provisionalOrdersDetailMap = useMemo(() => {
    const map = new Map<string, any[]>();
    if (!isCompact || !provisionalOrders.length || !provisionalDate) return map;

    const targetDateISO = normalizeDateISO(provisionalDate);
    if (!targetDateISO) return map;

    provisionalOrders.forEach(o => {
      const prevDateISO = normalizeDateISO(o.FECHAINICIO || o.fecha_inicio);
      if (prevDateISO !== targetDateISO) return;

      const centro = String(o.Centro || '').trim();
      const linea = String(o.LINEA_MAPPED || '').trim().toUpperCase();
      const material = normalizeMaterialCode(o.MATERIAL || o.CodMaterial || o.Material);
      const key = `${centro}|${linea}|${material}`;

      if (!map.has(key)) map.set(key, []);
      map.get(key)!.push(o);
    });

    return map;
  }, [isCompact, provisionalOrders, provisionalDate]);

  const baseDataAllCentros = useMemo(() => {
    let base = allData;

    if (allowedLines && allowedLines.length > 0) {
      const allowedUpper = allowedLines.map(l => l.toUpperCase());
      base = base.filter(row => {
        const rowLinea = String(row.Linea || '').trim().toUpperCase();
        return allowedUpper.some(allowed => rowLinea === allowed || rowLinea.includes(allowed) || allowed.includes(rowLinea));
      });
    }

    if (allowedWorkstations && allowedWorkstations.length > 0) {
      const allowedNormalized = allowedWorkstations.map(w => String(w).toUpperCase().replace(/\s+/g, ''));
      base = base.filter(row => {
        const rowPuesto = String(row.PuestoTrabajo || '').toUpperCase().replace(/\s+/g, '');
        return allowedNormalized.includes(rowPuesto);
      });
    }

    return base;
  }, [allData, allowedLines, allowedWorkstations]);

  // Todos los valores derivados por fila (Cant ordFab/ordPrev, Total Cantidad, Tiempos, CantPresup,
  // Cant Reprog, Tiempo Final, Ajustado), precalculados UNA vez para los 2 centros a la vez — así la
  // tabla visible (filtrada al centro activo) y la publicación hacia "Rev Capacidad" (que necesita
  // ambos centros aunque el usuario solo esté viendo uno) usan exactamente la misma lógica.
  const computedDataAllCentros = useMemo(() => {
    return baseDataAllCentros.map(row => {
      const line = String(row.Linea || '').trim().toUpperCase();
      const material = normalizeMaterialCode(row.CodMaterial);
      const centroRow = String(row.Centro || '').trim();
      const key = `${centroRow}|${line}|${material}`;

      const cantOrdFab = fertSumMap.get(key) || 0;
      const cantOrdPrev = provisionalSumMap.get(key) || 0;
      // "Total Cantidad" es la demanda real completa: firme (ordFab) + previsional (ordPrev). Es la
      // base por defecto de "Cant Reprog" (y por lo tanto de lo que se publica hacia "Rev Capacidad"),
      // así que si solo tomara ordFab, toda la demanda previsional quedaría invisible en la Ocupación
      // desde el arranque, sin necesidad de tocar ningún botón de ajuste.
      const totalCantidad = cantOrdFab + cantOrdPrev;

      const tiempoOrdFab = (Number(row.Tiempo_Min || 0) * cantOrdFab) / 60;
      const tiempoOrdPrev = (Number(row.Tiempo_Min || 0) * cantOrdPrev) / 60;
      const tiempoTotalHoras = tiempoOrdFab + tiempoOrdPrev;

      const puestoRaw = String(row.PuestoTrabajo || '').trim();
      const puestoNorm = puestoRaw.toUpperCase().replace(/\s+/g, ' ');
      const cantPresup = cantPresupMap.get(`${centroRow}|${line}|${material}|${puestoNorm}`) || 0;
      const tiempoCantPresup = (Number(row.Tiempo_Min || 0) / 60) * cantPresup;

      // Dependencia lineal: los puestos de una misma línea son estaciones secuenciales del MISMO
      // material fluyendo por la línea, así que "Cant Reprog" debe ser una única cantidad por
      // Centro+Línea+Material — compartida por todos sus puestos — y no una por Puesto. Editar (o
      // ajustar) la fila de un material en cualquier puesto actualiza así, automáticamente, todas
      // sus demás filas en esa misma línea.
      const reprogKey = `${centroRow}|${line}|${material}`;
      const cantReprog = cantReprogByKey[reprogKey] ?? totalCantidad;
      const tiempoFinal = (Number(row.Tiempo_Min || 0) / 60) * cantReprog;

      const ajustado = isCompact && (fertPrincipalesRevCapHalb[centroRow]?.has(material) ?? false);

      return {
        ...row,
        _line: line,
        _material: material,
        _centroRow: centroRow,
        _puestoRaw: puestoRaw,
        _puestoNorm: puestoNorm,
        _cantOrdFab: cantOrdFab,
        _cantOrdPrev: cantOrdPrev,
        _totalCantidad: totalCantidad,
        _tiempoOrdFab: tiempoOrdFab,
        _tiempoOrdPrev: tiempoOrdPrev,
        _tiempoTotalHoras: tiempoTotalHoras,
        _cantPresup: cantPresup,
        _tiempoCantPresup: tiempoCantPresup,
        _reprogKey: reprogKey,
        _cantReprog: cantReprog,
        _tiempoFinal: tiempoFinal,
        _ajustado: ajustado,
      };
    });
  }, [baseDataAllCentros, fertSumMap, provisionalSumMap, cantPresupMap, cantReprogByKey, isCompact, fertPrincipalesRevCapHalb]);

  type ComputedRow = typeof computedDataAllCentros[number];

  const baseData = useMemo(
    () => computedDataAllCentros.filter(row => row._centroRow === selectedCenter),
    [computedDataAllCentros, selectedCenter]
  );

  // Publica, por Centro+Línea+Puesto, la suma de "Tiempo Final" y de "Cant Reprog" (ambas ya
  // ajustadas, no la demanda cruda) para que "Rev Capacidad" las use como su "Total Tiempo (h)" y su
  // "Total Cantidad" — así esa columna queda consistente con el % Ocupación que ya reflejaba los
  // ajustes. Cubre los 2 centros simultáneamente.
  useEffect(() => {
    if (!isCompact) return;
    const tiempoMap: Record<string, number> = {};
    const cantidadMap: Record<string, number> = {};
    const tiempoInicialMap: Record<string, number> = {};
    const cantidadInicialMap: Record<string, number> = {};
    computedDataAllCentros.forEach(row => {
      const key = `${row._centroRow}|${row._line}|${row._puestoNorm}`;
      tiempoMap[key] = (tiempoMap[key] || 0) + row._tiempoFinal;
      cantidadMap[key] = (cantidadMap[key] || 0) + row._cantReprog;
      // "Total Cantidad"/"Tiempo Total" de esta misma pestaña, SIN el ajuste de Cant Reprog: es la
      // demanda cruda (Cant/Tiempo ordFab + ordPrev), la referencia "inicial" para Rev Capacidad.
      tiempoInicialMap[key] = (tiempoInicialMap[key] || 0) + row._tiempoTotalHoras;
      cantidadInicialMap[key] = (cantidadInicialMap[key] || 0) + row._totalCantidad;
    });
    publishTiempoFinalPorPuesto(tiempoMap);
    publishCantidadFinalPorPuesto(cantidadMap);
    publishTiempoInicialPorPuesto(tiempoInicialMap);
    publishCantidadInicialPorPuesto(cantidadInicialMap);
  }, [isCompact, computedDataAllCentros]);

  // Espejo EN VIVO (por Material) de "Total Cantidad"/"Cant Reprog"/"Tiempo Final", publicado en
  // cada render mientras "Prog Tiempos" está montada — a diferencia de `publishResultadoAjusteCentro`
  // (que solo corre al presionar "Ajustar Capacidad"), esto recoge también ediciones manuales del
  // input "Cant Reprog". Es lo que consume el botón "Refrescar" de "Plan Propuesto".
  useEffect(() => {
    if (!isCompact) return;
    const porCentro = new Map<string, Map<string, CantReprogMaterialRow>>();
    computedDataAllCentros.forEach(r => {
      if (!porCentro.has(r._centroRow)) porCentro.set(r._centroRow, new Map());
      const filasResultado = porCentro.get(r._centroRow)!;
      const existente = filasResultado.get(r._reprogKey);
      if (!existente) {
        filasResultado.set(r._reprogKey, {
          centro: r._centroRow,
          linea: r._line,
          material: r._material,
          descripcion: String((r as any).Material || (r as any).NombreMaterial || '').trim(),
          puesto: r._puestoRaw,
          cantidadOriginal: r._totalCantidad,
          cantReprog: r._cantReprog,
          tiempoFinal: r._tiempoFinal,
        });
      } else if (r._puestoRaw.trim().toUpperCase() === 'ARMADO') {
        existente.puesto = r._puestoRaw;
        existente.tiempoFinal = r._tiempoFinal;
      }
    });
    porCentro.forEach((filas, centro) => {
      publishResultadoActualCentro(centro, Array.from(filas.values()));
    });
  }, [isCompact, computedDataAllCentros]);

  const responsablesDisponibles = useMemo(() => {
    return [...new Set(baseData.map(row => String(row.NombRespControlProd || '').trim()))].filter(Boolean).sort();
  }, [baseData]);

  const lineasDisponibles = useMemo(() => {
    return [...new Set(baseData.map(row => String(row.Linea || '').trim()))].filter(Boolean).sort();
  }, [baseData]);

  const currentViewData = useMemo(() => {
    let result = baseData;
    if (selectedResponsables.length > 0) {
      result = result.filter(row => selectedResponsables.includes(String(row.NombRespControlProd || '').trim()));
    }
    if (selectedLineas.length > 0) {
      result = result.filter(row => selectedLineas.includes(String(row.Linea || '').trim()));
    }
    if (isCompact && hideZeroCantidad) {
      result = result.filter(row => row._totalCantidad !== 0);
    }
    const term = searchTerm.toLowerCase().trim();
    if (!term) return result;
    return result.filter(row =>
      String(row.CodMaterial || '').toLowerCase().includes(term) ||
      String(row.Linea || '').toLowerCase().includes(term) ||
      String(row.PuestoTrabajo || '').toLowerCase().includes(term) ||
      String(row.NombRespControlProd || '').toLowerCase().includes(term)
    );
  }, [baseData, selectedResponsables, selectedLineas, isCompact, hideZeroCantidad, searchTerm]);

  // Expande cada fila técnica en tantas filas como Órdenes Previsionales tenga ligadas su material
  // (mismo Centro+Línea+Material, en la Fecha previsionales seleccionada). Si no tiene ninguna, se
  // conserva una única fila sin datos de Pedido Ventas/Posición Pedido.
  const expandedViewData = useMemo(() => {
    if (!isCompact) return currentViewData.map(row => ({ row, order: null as any }));
    const result: { row: ComputedRow; order: any }[] = [];
    currentViewData.forEach(row => {
      const orders = provisionalOrdersDetailMap.get(row._reprogKey) || [];
      if (orders.length === 0) {
        result.push({ row, order: null });
      } else {
        orders.forEach(order => result.push({ row, order }));
      }
    });
    return result;
  }, [currentViewData, isCompact, provisionalOrdersDetailMap]);

  const totalPagesLocal = Math.max(1, Math.ceil(expandedViewData.length / rowsPerPage));
  const startIndex = (currentPage - 1) * rowsPerPage;
  const endIndex = startIndex + rowsPerPage;
  const displayedData = expandedViewData.slice(startIndex, startIndex + rowsPerPage);

  const formatMaterial = (mat: string) => String(mat || '').replace(/^0+/, '');

  const toggleResponsable = (resp: string) => {
    setSelectedResponsables(prev => prev.includes(resp) ? prev.filter(r => r !== resp) : [...prev, resp]);
    setCurrentPage(1);
  };

  const toggleLinea = (linea: string) => {
    setSelectedLineas(prev => prev.includes(linea) ? prev.filter(l => l !== linea) : [...prev, linea]);
    setCurrentPage(1);
  };

  const clearFilters = () => {
    setSelectedResponsables([]);
    setSelectedLineas([]);
    setSearchTerm('');
    setCurrentPage(1);
  };

  // Ajuste de capacidad de un Centro completo: regula el "% Ocupación" de cada Puesto de Trabajo
  // para que quede en [93%, 100%].
  //
  // Dependencia lineal (regla de negocio): los puestos de una misma línea son estaciones
  // secuenciales del MISMO material fluyendo por la línea, así que "Cant Reprog" es una única
  // cantidad por Material+Línea (ver `reprogKey` en computedDataAllCentros) — nunca puede haber dos
  // puestos de la misma línea con cantidades distintas para el mismo material. Por eso el ajuste ya
  // no se procesa puesto por puesto de forma independiente: se procesa LÍNEA por línea, y cada
  // material candidato puede afectar la Ocupación de varios puestos a la vez.
  //
  // Por Prioridad descendente, para cada material candidato (habilitado en Mat Balanceo) que toque
  // al menos un puesto fuera de rango, se calcula el valor EXACTO que TODOS los puestos por los que
  // pasa ese material (estén ya en rango o no) tolerarían sin pasarse de 100%, y se aplica el MÍNIMO
  // de esos valores. Regla dura: ningún puesto de la línea puede quedar por encima de 100% — se
  // acepta que, como consecuencia, algún puesto que comparte el material no llegue al rango [93,100].
  //
  // Ese mínimo se acota siempre a un rango permitido por el propio material:
  //   Piso:  Cant ordFab + Cant ordPrev × mín(Mínimo%, Máximo%)   (el corte más agresivo permitido;
  //          nunca baja de Cant ordFab — las órdenes firmes jamás se reducen)
  //   Techo: máximo entre Total cantidad y Cant Presupuesto (o Total cantidad × (1+Máximo%) si no
  //          hay Cant Presupuesto vinculado) — nunca sube forzando una reducción disfrazada.
  const handleAjustarCentro = (centro: string) => {
    const puestosT1 = (readLocalJSON('sim_puestos_t1') || {}) as Record<string, number>;
    const puestosT2 = (readLocalJSON('sim_puestos_t2') || {}) as Record<string, number>;
    const horasT1ByCenter = (readLocalJSON('sim_horas_t1_by_center') || {}) as Record<string, number>;
    const horasT2ByCenter = (readLocalJSON('sim_horas_t2_by_center') || {}) as Record<string, number>;
    const horasT1 = horasT1ByCenter[centro] ?? 8.75;
    const horasT2 = horasT2ByCenter[centro] ?? 8.75;

    const rowsDeCentro = computedDataAllCentros.filter(r => r._centroRow === centro);
    if (rowsDeCentro.length === 0) {
      addNotification('warning', `Centro ${centro}: no hay datos técnicos cargados; no se pudo ejecutar el ajuste.`);
      return;
    }

    // "working" está indexado por Material+Línea (reprogKey ya no incluye Puesto): un mismo material
    // que pasa por varios puestos de la línea comparte una sola entrada aquí.
    const working = new Map<string, number>();
    rowsDeCentro.forEach(r => {
      if (!working.has(r._reprogKey)) working.set(r._reprogKey, r._totalCantidad);
    });

    const filasPorPuesto = new Map<string, ComputedRow[]>();
    const filasPorMaterial = new Map<string, ComputedRow[]>();
    rowsDeCentro.forEach(r => {
      const puestoKey = `${r._line}|${r._puestoRaw}`;
      if (!filasPorPuesto.has(puestoKey)) filasPorPuesto.set(puestoKey, []);
      filasPorPuesto.get(puestoKey)!.push(r);

      if (!filasPorMaterial.has(r._reprogKey)) filasPorMaterial.set(r._reprogKey, []);
      filasPorMaterial.get(r._reprogKey)!.push(r);
    });

    const dispTimeDe = (linea: string, puestoRaw: string): number => {
      const key = `${centro}|${linea}|${puestoRaw}`;
      const t1 = puestosT1[key] ?? (RESTRICCIONES_PUESTOS[`${linea}|${puestoRaw}`] ?? 0);
      const t2 = puestosT2[key] ?? 0;
      return (t1 * horasT1) + (t2 * horasT2);
    };

    const tiempoTotalDe = (linea: string, puestoRaw: string): number =>
      (filasPorPuesto.get(`${linea}|${puestoRaw}`) || []).reduce((sum, r) => sum + (working.get(r._reprogKey) ?? 0) * (Number(r.Tiempo_Min || 0) / 60), 0);

    const ocupacionDe = (linea: string, puestoRaw: string): number => {
      const disp = dispTimeDe(linea, puestoRaw);
      return disp > 0 ? (tiempoTotalDe(linea, puestoRaw) / disp) * 100 : 0;
    };

    const dentroDeRango = (v: number) => v >= RANGO_OCUPACION_MIN && v <= RANGO_OCUPACION_MAX;

    const puestosPorLinea = new Map<string, Set<string>>();
    filasPorPuesto.forEach((_, gkey) => {
      const [linea, puestoRaw] = gkey.split('|');
      if (!puestosPorLinea.has(linea)) puestosPorLinea.set(linea, new Set());
      puestosPorLinea.get(linea)!.add(puestoRaw);
    });

    let totalPuestos = 0;
    let yaEnRango = 0;
    let ajustadosOk = 0;
    let noAlcanzados = 0;

    puestosPorLinea.forEach((puestosSet, linea) => {
      totalPuestos += puestosSet.size;
      const ocupacionInicialPorPuesto = new Map<string, number>();
      puestosSet.forEach(p => ocupacionInicialPorPuesto.set(p, ocupacionDe(linea, p)));

      // Materiales de esta línea (unión de los materiales de todos sus puestos), habilitados en Mat
      // Balanceo, por Prioridad descendente.
      const materialesDeLaLinea = new Map<string, ComputedRow[]>();
      puestosSet.forEach(puestoRaw => {
        (filasPorPuesto.get(`${linea}|${puestoRaw}`) || []).forEach(r => {
          if (!materialesDeLaLinea.has(r._reprogKey)) {
            materialesDeLaLinea.set(r._reprogKey, filasPorMaterial.get(r._reprogKey) || []);
          }
        });
      });

      const candidatos = Array.from(materialesDeLaLinea.entries())
        .map(([reprogKey, filas]) => {
          if (filas.length === 0) return null;
          const info = matBalanceoInfoByMaterial.get(`${centro}|${filas[0]._material}`);
          return info && info.habilitado ? { reprogKey, filas, info } : null;
        })
        .filter((x): x is { reprogKey: string; filas: ComputedRow[]; info: { minimo: number; maximo: number; prioridad: number; habilitado: boolean } } => x !== null)
        .sort((a, b) => b.info.prioridad - a.info.prioridad);

      const puestosFueraDeRango = () => Array.from(puestosSet).filter(p => !dentroDeRango(ocupacionDe(linea, p)));

      for (const { reprogKey, filas, info } of candidatos) {
        if (puestosFueraDeRango().length === 0) break; // toda la línea ya está en rango

        // Puestos de esta línea por los que pasa este material.
        const puestosDeEsteMaterial = Array.from(new Set(filas.map(f => f._puestoRaw))).filter(p => puestosSet.has(p));
        const afectados = puestosDeEsteMaterial.filter(p => !dentroDeRango(ocupacionDe(linea, p)));
        if (afectados.length === 0) continue; // este material no toca ningún puesto fuera de rango

        // Valor exacto que CADA puesto por el que pasa este material toleraría sin pasarse de 100%
        // (se evalúan TODOS los puestos que comparten el material, no solo los que están fuera de
        // rango, para no arreglar uno y hacer que otro que ya estaba bien se pase de 100%).
        const valoresExactos: number[] = [];
        puestosDeEsteMaterial.forEach(puestoRaw => {
          const filaEnEsePuesto = filas.find(f => f._puestoRaw === puestoRaw);
          if (!filaEnEsePuesto) return;
          const tiempoMinFila = Number(filaEnEsePuesto.Tiempo_Min || 0) / 60;
          if (tiempoMinFila <= 0) return;
          const disp = dispTimeDe(linea, puestoRaw);
          const tiempoSinEsteMaterial = tiempoTotalDe(linea, puestoRaw) - (working.get(reprogKey) ?? 0) * tiempoMinFila;
          valoresExactos.push((disp - tiempoSinEsteMaterial) / tiempoMinFila);
        });
        if (valoresExactos.length === 0) continue;

        // Se toma el MÍNIMO de lo que tolera cada puesto: garantiza que ningún puesto de la línea
        // quede por encima de 100%, aceptando que alguno pueda no alcanzar el rango [93,100] cuando
        // comparte el material con un puesto más estricto.
        const objetivo = Math.min(...valoresExactos);

        const muestra = filas[0];
        const keepMin = Math.min(info.minimo, info.maximo) / 100;
        const piso = muestra._cantOrdFab + Math.round(muestra._cantOrdPrev * keepMin);
        const techoIncremento = muestra._cantPresup > 0
          ? Math.round(muestra._cantPresup)
          : Math.round(muestra._totalCantidad * (1 + info.maximo / 100));
        const techo = Math.max(muestra._totalCantidad, techoIncremento);

        const valorFinal = Math.round(Math.max(piso, Math.min(techo, objetivo)));
        working.set(reprogKey, valorFinal);
      }

      puestosSet.forEach(puestoRaw => {
        const inicial = ocupacionInicialPorPuesto.get(puestoRaw) ?? 0;
        const final = ocupacionDe(linea, puestoRaw);
        if (dentroDeRango(inicial)) {
          yaEnRango++;
        } else if (dentroDeRango(final)) {
          ajustadosOk++;
        } else {
          noAlcanzados++;
        }
      });
    });

    setCantReprogByKey(prev => {
      const next = { ...prev };
      working.forEach((value, key) => { next[key] = value; });
      return next;
    });

    // Publica el resultado de ESTE Centro (y solo este) para que "Plan Propuesto" lo presente tal
    // cual, sin recalcular nada. A diferencia de un store en vivo, esto se congela en el momento en
    // que "Ajustar Capacidad" termina de correr — no se actualiza con ediciones manuales posteriores.
    const filasResultado = new Map<string, CantReprogMaterialRow>();
    rowsDeCentro.forEach(r => {
      const cantReprogFinal = working.get(r._reprogKey) ?? r._totalCantidad;
      const tiempoFinalFila = (Number(r.Tiempo_Min || 0) / 60) * cantReprogFinal;
      const existente = filasResultado.get(r._reprogKey);
      if (!existente) {
        filasResultado.set(r._reprogKey, {
          centro: r._centroRow,
          linea: r._line,
          material: r._material,
          descripcion: String((r as any).Material || (r as any).NombreMaterial || '').trim(),
          puesto: r._puestoRaw,
          cantidadOriginal: r._totalCantidad,
          cantReprog: cantReprogFinal,
          tiempoFinal: tiempoFinalFila,
        });
      } else if (r._puestoRaw.trim().toUpperCase() === 'ARMADO') {
        // Prefiere mostrar "Armado" como Puesto de referencia cuando el material pasa por varios.
        existente.puesto = r._puestoRaw;
        existente.tiempoFinal = tiempoFinalFila;
      }
    });
    publishResultadoAjusteCentro(centro, Array.from(filasResultado.values()));

    // Mensaje de confirmación de la ejecución: resume cuántos Puestos de Trabajo (por Línea) del
    // Centro quedaron dentro del rango [93%, 100%] tras el ajuste.
    if (noAlcanzados === 0) {
      addNotification(
        'success',
        `Centro ${centro}: ajuste de capacidad ejecutado. ${ajustadosOk} de ${totalPuestos} puestos se llevaron al rango 93-100% de Ocupación (${yaEnRango} ya estaban en rango).`
      );
    } else {
      addNotification(
        'warning',
        `Centro ${centro}: ajuste de capacidad ejecutado. ${ajustadosOk} puestos llegaron al rango 93-100%, pero ${noAlcanzados} de ${totalPuestos} no lo alcanzaron con los rangos configurados en Mat Balanceo (revise esos Puestos en Rev Capacidad).`
      );
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex items-center space-x-3">
          <Clock className="w-6 h-6 text-indigo-600" />
          <div>
            <h3 className="text-xl font-semibold text-gray-800">Tiempos de Ensamblado / Muebles</h3>
            <p className="text-xs text-gray-500 mt-1">Matriz técnica de tiempos unitarios y parámetros de lote</p>
          </div>
        </div>
        
        <div className="flex flex-wrap items-center gap-3">
          {isCompact && (
            <>
              <div className="flex items-center gap-2 bg-white border border-gray-300 rounded-md px-3 py-1.5 h-9">
                <label htmlFor="prog-date" className="text-[10px] font-bold text-gray-400 uppercase whitespace-nowrap">Día programación:</label>
                <input
                  id="prog-date"
                  type="date"
                  value={programmingDate}
                  onChange={(e) => {
                      const val = e.target.value;
                      setProgrammingDate(val);
                      
                      // ACTUALIZACIÓN DE LOCALSTORAGE PARA REV CAPACIDAD
                      if (typeof window !== 'undefined') {
                        const saved = localStorage.getItem('sim_prog_dates');
                        let next = {};
                        if (saved) try { next = JSON.parse(saved); } catch(e) {}
                        // Sincronizar con el master (1000) y su espejo (2000)
                        (next as any)['1000'] = val;
                        (next as any)['2000'] = val;
                        localStorage.setItem('sim_prog_dates', JSON.stringify(next));
                      }
                      
                      setCurrentPage(1);
                  }}
                  className="text-xs border-none bg-transparent focus:ring-0 font-medium text-indigo-700 outline-none"
                />
                <CalendarIcon className="w-3.5 h-3.5 text-gray-400" />
              </div>

              <div className="flex items-center gap-2 bg-white border border-gray-300 rounded-md px-3 py-1.5 h-9">
                <label htmlFor="prev-date" className="text-[10px] font-bold text-gray-400 uppercase whitespace-nowrap">Fecha previsionales:</label>
                <input
                  id="prev-date"
                  type="date"
                  value={provisionalDate}
                  onChange={(e) => {
                      const val = e.target.value;
                      setProvisionalDate(val);

                      // ACTUALIZACIÓN DE LOCALSTORAGE PARA REV CAP HALB (Cant ordPrev)
                      if (typeof window !== 'undefined') {
                        const saved = localStorage.getItem(PROVISIONAL_DATES_KEY);
                        let next = {};
                        if (saved) try { next = JSON.parse(saved); } catch(e) {}
                        (next as any)['1000'] = val;
                        (next as any)['2000'] = val;
                        localStorage.setItem(PROVISIONAL_DATES_KEY, JSON.stringify(next));
                      }

                      setCurrentPage(1);
                  }}
                  className="text-xs border-none bg-transparent focus:ring-0 font-medium text-indigo-700 outline-none"
                />
                <CalendarIcon className="w-3.5 h-3.5 text-gray-400" />
              </div>

              <label className="flex items-center gap-2 bg-white border border-gray-300 rounded-md px-3 h-9 text-xs font-medium text-gray-600 cursor-pointer whitespace-nowrap">
                <input
                  type="checkbox"
                  checked={hideZeroCantidad}
                  onChange={(e) => {
                    setHideZeroCantidad(e.target.checked);
                    setCurrentPage(1);
                  }}
                  className="rounded border-gray-300"
                />
                Excluir "Total Cantidad" en cero
              </label>
            </>
          )}

          {!isCompact && (
            <Popover open={isRespFilterOpen} onOpenChange={setIsRespFilterOpen}>
              <PopoverTrigger asChild>
                <Button variant="outline" size="sm" className="h-9 w-56 justify-between bg-white font-normal text-xs">
                  <div className="flex items-center gap-2 truncate">
                    <UserCircle className="w-3.5 h-3.5 text-gray-400" />
                    <span className="truncate">
                      {selectedResponsables.length === 0 ? "Responsables" : `${selectedResponsables.length} responsables`}
                    </span>
                  </div>
                  <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-64 p-0" align="end">
                <Command>
                  <CommandInput placeholder="Buscar responsable..." className="h-8 text-xs" />
                  <CommandEmpty>No encontrado.</CommandEmpty>
                  <CommandGroup className="max-h-64 overflow-y-auto">
                    {responsablesDisponibles.map((resp) => (
                      <CommandItem key={resp} value={resp} onSelect={() => toggleResponsable(resp)} className="text-xs">
                        <Check className={cn("mr-2 h-3.5 w-3.5", selectedResponsables.includes(resp) ? "opacity-100" : "opacity-0")} />
                        {resp}
                      </CommandItem>
                    ))}
                  </CommandGroup>
                </Command>
              </PopoverContent>
            </Popover>
          )}

          {!isCompact && (
            <Popover open={isLineaFilterOpen} onOpenChange={setIsLineFilterOpen}>
              <PopoverTrigger asChild>
                <Button variant="outline" size="sm" className="h-9 w-48 justify-between bg-white font-normal text-xs">
                  <div className="flex items-center gap-2 truncate">
                    <LayoutGrid className="w-3.5 h-3.5 text-gray-400" />
                    <span className="truncate">
                      {selectedLineas.length === 0 ? "Líneas" : `${selectedLineas.length} líneas`}
                    </span>
                  </div>
                  <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-56 p-0" align="end">
                <Command>
                  <CommandInput placeholder="Buscar línea..." className="h-8 text-xs" />
                  <CommandEmpty>No encontrada.</CommandEmpty>
                  <CommandGroup className="max-h-64 overflow-y-auto">
                    {lineasDisponibles.map((linea) => (
                      <CommandItem key={linea} value={linea} onSelect={() => toggleLinea(linea)} className="text-xs">
                        <Check className={cn("mr-2 h-3.5 w-3.5", selectedLineas.includes(linea) ? "opacity-100" : "opacity-0")} />
                        {linea}
                      </CommandItem>
                    ))}
                  </CommandGroup>
                </Command>
              </PopoverContent>
            </Popover>
          )}

          <div className="relative w-64">
            <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-gray-400" />
            <Input
              type="search"
              placeholder="Material, puesto..."
              className="pl-9 h-9 text-xs"
              value={searchTerm}
              onChange={(e) => { setSearchTerm(e.target.value); setCurrentPage(1); }}
            />
          </div>
          <Button variant="outline" size="sm" onClick={() => {
            hasStarted.current = false;
            if (isCompact) {
              sharedTiempos.refresh();
            } else {
              setLocalAllData([]);
            }
            loadData();
          }}>
            Actualizar
          </Button>
          {isCompact && selectedCenter && (
            <Button variant="outline" size="sm" className="bg-rose-50 text-rose-700 border-rose-200 hover:bg-rose-100" onClick={() => handleAjustarCentro(selectedCenter)}>
              Ajustar Capacidad
            </Button>
          )}
        </div>
      </div>

      {(selectedResponsables.length > 0 || selectedLineas.length > 0 || searchTerm) && (
        <div className="flex flex-wrap gap-2 items-center">
          <span className="text-[10px] font-bold text-gray-400 uppercase mr-2">Filtros:</span>
          {selectedResponsables.map(resp => (
            <Badge key={`chip-resp-${resp}`} variant="secondary" className="bg-indigo-50 text-indigo-700 text-[10px] py-0 px-2 flex items-center gap-1">
              Resp: {resp}
              <X className="w-3 h-3 cursor-pointer" onClick={() => toggleResponsable(resp)} />
            </Badge>
          ))}
          {selectedLineas.map(linea => (
            <Badge key={`chip-linea-${linea}`} variant="secondary" className="bg-emerald-50 text-emerald-700 text-[10px] py-0 px-2 flex items-center gap-1">
              Línea: {linea}
              <X className="w-3 h-3 cursor-pointer" onClick={() => toggleLinea(linea)} />
            </Badge>
          ))}
          <Button variant="ghost" size="sm" className="h-6 text-[10px] text-gray-500 underline" onClick={clearFilters}>
            Limpiar todo
          </Button>
        </div>
      )}

      <Tabs value={selectedCenter} onValueChange={(val) => { setSelectedCenter(val); setCurrentPage(1); setSelectedResponsables([]); setSelectedLineas([]); }} className="w-full">
        <TabsList className="flex h-auto bg-gray-100/50 p-1 mb-4">
          {availableCenters.map(center => (
            <TabsTrigger 
              key={center} 
              value={center}
              className="data-[state=active]:bg-white data-[state=active]:text-indigo-700 data-[state=active]:shadow-sm px-6 py-2 text-xs font-bold uppercase tracking-wider"
            >
              <Home className="w-3 h-3 mr-2" />
              Centro {center} ({allData.filter(d => String(d.Centro || '').trim() === center).length})
            </TabsTrigger>
          ))}
        </TabsList>

        <div className="bg-white rounded-lg shadow-sm border overflow-hidden">
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  {isCompact && (
                    <th className="px-4 py-3 text-center text-[10px] font-bold text-gray-500 uppercase tracking-wider">Ajustado</th>
                  )}
                  <th className="px-4 py-3 text-left text-[10px] font-bold text-gray-500 uppercase tracking-wider">Material</th>
                  <th className="px-4 py-3 text-left text-[10px] font-bold text-gray-500 uppercase tracking-wider">Línea</th>
                  <th className="px-4 py-3 text-left text-[10px] font-bold text-gray-500 uppercase tracking-wider">Puesto Trabajo</th>
                  <th className="px-4 py-3 text-right text-[10px] font-bold text-indigo-700 uppercase tracking-wider bg-indigo-50/30">Tiempo (min)</th>
                  {isCompact && (
                    <>
                      <th className="px-4 py-3 text-right text-[10px] font-bold text-emerald-700 uppercase tracking-wider bg-emerald-50/30">Cant ordFab</th>
                      <th className="px-4 py-3 text-right text-[10px] font-bold text-amber-700 uppercase tracking-wider bg-amber-50/30">Cant ordPrev</th>
                      <th className="px-4 py-3 text-left text-[10px] font-bold text-gray-500 uppercase tracking-wider">Pedido Ventas</th>
                      <th className="px-4 py-3 text-left text-[10px] font-bold text-gray-500 uppercase tracking-wider">Posición Pedido</th>
                      <th className="px-4 py-3 text-right text-[10px] font-bold text-indigo-700 uppercase tracking-wider bg-indigo-50/30">Total Cantidad</th>
                      <th className="px-4 py-3 text-right text-[10px] font-bold text-violet-700 uppercase tracking-wider bg-violet-50/30">CantPresup</th>
                      <th className="px-4 py-3 text-right text-[10px] font-bold text-emerald-800 uppercase tracking-wider bg-emerald-100/20">Tiempo ordFab</th>
                      <th className="px-4 py-3 text-right text-[10px] font-bold text-amber-800 uppercase tracking-wider bg-amber-100/20">Tiempo ordPrev</th>
                      <th className="px-4 py-3 text-right text-[10px] font-bold text-indigo-800 uppercase tracking-wider bg-indigo-100/20">Tiempo Total</th>
                      <th className="px-4 py-3 text-right text-[10px] font-bold text-violet-800 uppercase tracking-wider bg-violet-100/20">Tiempo CantPresup</th>
                      <th className="px-4 py-3 text-right text-[10px] font-bold text-rose-700 uppercase tracking-wider bg-rose-50/30">Cant Reprog</th>
                      <th className="px-4 py-3 text-right text-[10px] font-bold text-rose-800 uppercase tracking-wider bg-rose-100/20">Tiempo Final</th>
                    </>
                  )}
                  {!isCompact && (
                    <>
                      <th className="px-4 py-3 text-right text-[10px] font-bold text-gray-500 uppercase tracking-wider">Stock Act.</th>
                      <th className="px-4 py-3 text-right text-[10px] font-bold text-gray-500 uppercase tracking-wider">Stock Seg.</th>
                      <th className="px-4 py-3 text-center text-[10px] font-bold text-gray-500 uppercase tracking-wider">Aprov.</th>
                      <th className="px-4 py-3 text-right text-[10px] font-bold text-gray-500 uppercase tracking-wider">Lote Mín.</th>
                      <th className="px-4 py-3 text-right text-[10px] font-bold text-gray-500 uppercase tracking-wider">Lote Máx.</th>
                      <th className="px-4 py-3 text-left text-[10px] font-bold text-gray-500 uppercase tracking-wider">Responsable</th>
                    </>
                  )}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {displayedData.length > 0 ? displayedData.map(({ row, order }, idx) => {
                  const { _cantOrdFab: cantOrdFab, _cantOrdPrev: cantOrdPrev, _totalCantidad: totalCantidad,
                    _tiempoOrdFab: tiempoOrdFab, _tiempoOrdPrev: tiempoOrdPrev, _tiempoTotalHoras: tiempoTotalHoras,
                    _cantPresup: cantPresup, _tiempoCantPresup: tiempoCantPresup, _reprogKey: reprogKey,
                    _cantReprog: cantReprog, _tiempoFinal: tiempoFinal, _ajustado: ajustado } = row;
                  const pedidoVentas = order ? (order.Pedidoventas || order.PEDIDOVENTAS || '-') : '-';
                  const posicionPedido = order ? (order.POSICIONPEDIDO || order.PosicionPedido || '-') : '-';

                  return (
                    <tr key={`${row.CodMaterial}-${row.PuestoTrabajo}-${order?.ORDENPREVISIONAL || 'sin-orden'}-${idx}`} className={cn("hover:bg-gray-50 transition-colors", ajustado && "bg-gray-50/60 opacity-60")}>
                      {isCompact && (
                        <td className="px-4 py-3 text-center">
                          {ajustado && (
                            <span className="inline-flex items-center justify-center w-5 h-5 rounded-full bg-gray-300 text-white" title="Ya reprogramado en Rev cap Halb">
                              <Check className="w-3.5 h-3.5" />
                            </span>
                          )}
                        </td>
                      )}
                      <td className="px-4 py-3 whitespace-nowrap text-sm font-mono font-bold text-gray-900">{formatMaterial(row.CodMaterial)}</td>
                      <td className="px-4 py-3 whitespace-nowrap text-xs text-gray-600">{row.Linea}</td>
                      <td className="px-4 py-3 whitespace-nowrap text-[10px] text-gray-500 font-medium">{row.PuestoTrabajo}</td>
                      <td className="px-4 py-3 whitespace-nowrap text-xs font-bold text-right text-indigo-600 bg-indigo-50/10">
                        {Number(row.Tiempo_Min || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 3 })}
                      </td>
                      {isCompact && (
                        <>
                          <td className="px-4 py-3 whitespace-nowrap text-xs font-bold text-right text-emerald-700 bg-emerald-50/5">
                            {cantOrdFab > 0 ? cantOrdFab.toLocaleString() : '0'}
                          </td>
                          <td className="px-4 py-3 whitespace-nowrap text-xs font-bold text-right text-amber-700 bg-amber-50/5">
                            {cantOrdPrev > 0 ? cantOrdPrev.toLocaleString() : '0'}
                          </td>
                          <td className="px-4 py-3 whitespace-nowrap text-xs text-gray-600 font-mono">{pedidoVentas}</td>
                          <td className="px-4 py-3 whitespace-nowrap text-xs text-gray-600 font-mono">{posicionPedido}</td>
                          <td className="px-4 py-3 whitespace-nowrap text-xs font-bold text-right text-indigo-700 bg-indigo-50/5">
                            {totalCantidad > 0 ? totalCantidad.toLocaleString() : '0'}
                          </td>
                          <td className="px-4 py-3 whitespace-nowrap text-xs font-bold text-right text-violet-700 bg-violet-50/5">
                            {cantPresup > 0 ? cantPresup.toLocaleString() : '0'}
                          </td>
                          <td className="px-4 py-3 whitespace-nowrap text-xs font-bold text-right text-emerald-800 bg-emerald-100/10">
                            {tiempoOrdFab > 0 ? tiempoOrdFab.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : '0'}
                          </td>
                          <td className="px-4 py-3 whitespace-nowrap text-xs font-bold text-right text-amber-800 bg-amber-100/10">
                            {tiempoOrdPrev > 0 ? tiempoOrdPrev.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : '0'}
                          </td>
                          <td className="px-4 py-3 whitespace-nowrap text-xs font-bold text-right text-indigo-800 bg-indigo-100/10">
                            {tiempoTotalHoras > 0 ? tiempoTotalHoras.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : '0'}
                          </td>
                          <td className="px-4 py-3 whitespace-nowrap text-xs font-bold text-right text-violet-800 bg-violet-100/10">
                            {tiempoCantPresup > 0 ? tiempoCantPresup.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : '0'}
                          </td>
                          <td className="px-0 py-0 whitespace-nowrap bg-rose-50/5 min-w-[90px]">
                            <input
                              type="number"
                              value={cantReprog}
                              min="0"
                              onChange={(e) => {
                                const value = Number(e.target.value);
                                setCantReprogByKey(prev => ({ ...prev, [reprogKey]: value }));
                              }}
                              className="w-full text-right px-4 py-3 text-xs font-bold text-rose-700 outline-none bg-transparent focus:bg-rose-50"
                            />
                          </td>
                          <td className="px-4 py-3 whitespace-nowrap text-xs font-bold text-right text-rose-800 bg-rose-100/10">
                            {tiempoFinal > 0 ? tiempoFinal.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : '0'}
                          </td>
                        </>
                      )}
                      {!isCompact && (
                        <>
                          <td className="px-4 py-3 whitespace-nowrap text-xs text-right text-gray-500">{row.StockActual}</td>
                          <td className="px-4 py-3 whitespace-nowrap text-xs text-right text-gray-700 font-semibold">{row.StockSeguridad}</td>
                          <td className="px-4 py-3 whitespace-nowrap text-center">
                            <Badge variant="outline" className="text-[10px] font-bold bg-blue-50 text-blue-700">{row.ClaseAprovisionam}</Badge>
                          </td>
                          <td className="px-4 py-3 whitespace-nowrap text-[10px] text-right text-gray-500">{row.TamLoteMin}</td>
                          <td className="px-4 py-3 whitespace-nowrap text-[10px] text-right text-gray-500">{row.TamLoteMax || '-'}</td>
                          <td className="px-4 py-3 whitespace-nowrap text-[10px] text-gray-600 truncate max-w-[150px]" title={row.NombRespControlProd}>
                            {row.NombRespControlProd}
                          </td>
                        </>
                      )}
                    </tr>
                  );
                }) : (
                  <tr>
                    <td colSpan={isCompact ? 17 : 10} className="px-6 py-12 text-center text-gray-400 italic">
                      <div className="flex flex-col items-center justify-center gap-2">
                        <AlertCircle className="w-8 h-8 text-gray-300" />
                        <span>No se encontraron registros técnicos para el centro seleccionado.</span>
                      </div>
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>

          <div className="bg-gray-50 px-6 py-4 border-t flex flex-col sm:flex-row items-center justify-between gap-4">
            <div className="flex items-center gap-4 text-xs">
              <span className="font-medium text-gray-500 uppercase">Ver:</span>
              <select
                value={rowsPerPage}
                onChange={(e) => { setRowsPerPage(Number(e.target.value)); setCurrentPage(1); }}
                className="border rounded p-1 bg-white"
              >
                <option value={10}>10</option>
                <option value={20}>20</option>
                <option value={50}>50</option>
                <option value={100}>100</option>
              </select>
              <span className="text-gray-400">
                {startIndex + 1} - {Math.min(startIndex + rowsPerPage, expandedViewData.length)} de {expandedViewData.length}
              </span>
            </div>

            <div className="flex items-center gap-2">
              <Button variant="outline" size="sm" onClick={() => setCurrentPage(p => Math.max(1, p - 1))} disabled={currentPage === 1}>Anterior</Button>
              <div className="px-4 py-1 bg-white border rounded text-sm font-bold text-indigo-600 min-w-[80px] text-center">{currentPage} / {totalPagesLocal}</div>
              <Button variant="outline" size="sm" onClick={() => setCurrentPage(p => Math.min(totalPagesLocal, p + 1))} disabled={currentPage === totalPagesLocal}>Siguiente</Button>
            </div>
          </div>
        </div>
      </Tabs>
    </div>
  );
};
