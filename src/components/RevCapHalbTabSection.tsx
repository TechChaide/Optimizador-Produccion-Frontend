'use client';

import React, { useState, useEffect, useMemo, useRef } from 'react';
import { Layers, Loader2, Home, Boxes } from 'lucide-react';
import { useTiemposFertData } from '@/hooks/useTiemposFertData';
import { publishFertPrincipalesRevCapHalb } from '@/hooks/useRevCapHalbLink';
import { useNecesidadesExplotadas, explodeNecesidades, NecesidadPar, CENTROS, Centro } from '@/hooks/useNecesidadesExplotadas';
import { useAppContext } from '@/context/AppProvider';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';

const NO_MESAS_KEY = 'rev_cap_halb_no_mesas';
const HORAS_PROG_KEY = 'rev_cap_halb_horas_prog';
const CANT_REPROG_KEY = 'rev_cap_halb_cant_reprog';
// Publicados por la pestaña "Prog Tiempos" (Día programación / Fecha previsionales), por Centro.
// "Cant OrdFab" se filtra con sim_prog_dates y "Cant ordPrev" con sim_provisional_dates, para que
// ambas columnas queden atadas a los mismos filtros de fecha que el usuario ya configuró ahí.
const PROG_DATES_KEY = 'sim_prog_dates';
const PROVISIONAL_DATES_KEY = 'sim_provisional_dates';
// Publicado por la pestaña "Mat Balanceo" (Centro + Línea + Material + Puesto Trabajo -> Cant
// Presupuesto/Mínimo/Máximo/Prioridad/Habilitado). Se lee al vuelo al presionar "Ajustar", no se
// mantiene sincronizado en vivo.
const MAT_BALANCEO_LINK_KEY = 'material_balanceo_expanded_data';
// Ocupación recalculada dentro de este umbral (97-100%) se considera "suficientemente cerca" del
// 100% al subir cantidades, sin necesidad de forzar el objetivo exacto en cada fila.
const TOLERANCIA_OCUPACION_MIN = 97;

const normCode = (code: any): string => String(code ?? '').trim().replace(/^0+(?=\d)/, '');
// Mat Balanceo normaliza sus códigos de Material tomando los últimos 8 caracteres (no recortando
// ceros a la izquierda como normCode); hay que igualar esa normalización para poder cruzar
// Fert_Principal contra el Material publicado por esa pestaña.
const normCode8 = (code: any): string => String(code ?? '').trim().slice(-8);

interface MatBalanceoInfo {
  minimo: number;
  maximo: number;
  prioridad: number;
  cantPresupuesto: number;
  habilitado: boolean;
}

const readMatBalanceoMap = (): Map<string, MatBalanceoInfo> => {
  const map = new Map<string, MatBalanceoInfo>();
  try {
    const raw = localStorage.getItem(MAT_BALANCEO_LINK_KEY);
    if (!raw) return map;
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return map;
    parsed.forEach((item: any) => {
      const key = `${String(item.centro ?? '').trim()}|${normCode8(item.material)}`;
      if (!map.has(key)) {
        map.set(key, {
          minimo: Number(item.minimo || 0),
          maximo: Number(item.maximo || 0),
          prioridad: Number(item.prioridad || 0),
          cantPresupuesto: Number(item.cantPresupuesto || 0),
          habilitado: !!item.habilitado,
        });
      }
    });
  } catch (e) {}
  return map;
};

const normalizeDateISO = (dateStr: any): string | null => {
  if (!dateStr) return null;
  const s = String(dateStr).trim();

  let match = s.match(/^(\d{1,2})[\/-](\d{1,2})[\/-](\d{4})/);
  if (match) {
    return `${match[3]}-${match[2].padStart(2, '0')}-${match[1].padStart(2, '0')}`;
  }

  match = s.match(/^(\d{4})-(\d{1,2})-(\d{1,2})/);
  if (match) {
    return `${match[1]}-${match[2].padStart(2, '0')}-${match[3].padStart(2, '0')}`;
  }

  return null;
};

interface DetailRow {
  reprogKey: string;
  centro: string;
  componente: string;
  fertPrincipal: string;
  descripcionFert: string;
  tiempoMin: number;
  cantOrdFab: number;
  cantOrdPrev: number;
  totalCant: number;
  totalTiempo: number;
  cantReprog: number;
  tiempoFinal: number;
}

export const RevCapHalbTabSection: React.FC = () => {
  const {
    itemsByCentro,
    fertPrincipalColumn,
    descripcionFertColumn,
    materialPadreColumn,
    componenteColumn,
    descripcionComponenteColumn,
    isLoading: isExplotandoNecesidades,
    progressDone,
    progressTotal,
  } = useNecesidadesExplotadas();
  const { tiemposData, fertOrders, provisionalOrders, ensureLoaded: ensureTiemposFertLoaded } = useTiemposFertData();
  const { addNotification } = useAppContext();

  useEffect(() => {
    ensureTiemposFertLoaded();
  }, [ensureTiemposFertLoaded]);

  const [isMounted, setIsMounted] = useState(false);
  const [noMesasByCentro, setNoMesasByCentro] = useState<Record<string, number>>({ '1000': 0, '2000': 0 });
  const [horasProgByCentro, setHorasProgByCentro] = useState<Record<string, number>>({ '1000': 0, '2000': 0 });
  const [cantReprogByKey, setCantReprogByKey] = useState<Record<string, number>>({});
  const [progDatesByCentro, setProgDatesByCentro] = useState<Record<string, string>>({});
  const [provDatesByCentro, setProvDatesByCentro] = useState<Record<string, string>>({});
  const [activeCentroTab, setActiveCentroTab] = useState<Centro>('1000');
  const [currentPageByCentro, setCurrentPageByCentro] = useState<Record<Centro, number>>({ '1000': 1, '2000': 1 });
  const [rowsPerPage, setRowsPerPage] = useState(20);
  const [hideZeroTotalCant, setHideZeroTotalCant] = useState(false);

  useEffect(() => {
    setIsMounted(true);
    try {
      const savedMesas = localStorage.getItem(NO_MESAS_KEY);
      if (savedMesas) setNoMesasByCentro(prev => ({ ...prev, ...JSON.parse(savedMesas) }));
    } catch (e) {}
    try {
      const savedHoras = localStorage.getItem(HORAS_PROG_KEY);
      if (savedHoras) setHorasProgByCentro(prev => ({ ...prev, ...JSON.parse(savedHoras) }));
    } catch (e) {}
    try {
      const savedReprog = localStorage.getItem(CANT_REPROG_KEY);
      if (savedReprog) setCantReprogByKey(JSON.parse(savedReprog));
    } catch (e) {}
    try {
      const savedProgDates = localStorage.getItem(PROG_DATES_KEY);
      if (savedProgDates) setProgDatesByCentro(JSON.parse(savedProgDates));
    } catch (e) {}
    try {
      const savedProvDates = localStorage.getItem(PROVISIONAL_DATES_KEY);
      if (savedProvDates) setProvDatesByCentro(JSON.parse(savedProvDates));
    } catch (e) {}
  }, []);

  useEffect(() => {
    if (isMounted) localStorage.setItem(NO_MESAS_KEY, JSON.stringify(noMesasByCentro));
  }, [noMesasByCentro, isMounted]);

  useEffect(() => {
    if (isMounted) localStorage.setItem(HORAS_PROG_KEY, JSON.stringify(horasProgByCentro));
  }, [horasProgByCentro, isMounted]);

  useEffect(() => {
    if (isMounted) localStorage.setItem(CANT_REPROG_KEY, JSON.stringify(cantReprogByKey));
  }, [cantReprogByKey, isMounted]);

  // Tiempo (min) por Centro + Componente, tomado de TiemposEnsamblado (mismo store que "Prog Tiempos").
  const tiempoMinMap = useMemo(() => {
    const map = new Map<string, number>();
    tiemposData.forEach((row: any) => {
      const key = `${String(row.Centro ?? '').trim()}|${normCode(row.CodMaterial)}`;
      if (!map.has(key)) map.set(key, Number(row.Tiempo_Min || 0));
    });
    return map;
  }, [tiemposData]);

  // Materiales padre con registro Puesto Trabajo = "Armado" en TiemposEnsamblado
  const armadoMaterialSet = useMemo(() => {
    const set = new Set<string>();
    tiemposData.forEach((row: any) => {
      if (String(row.PuestoTrabajo ?? '').trim().toLowerCase() === 'armado') {
        set.add(`${String(row.Centro ?? '').trim()}|${normCode(row.CodMaterial)}`);
      }
    });
    return set;
  }, [tiemposData]);

  const todayISO = useMemo(() => new Date().toISOString().split('T')[0], []);

  // Suma de Cant Pendiente (Órdenes Fert) por Centro + Material Padre, para la fecha "Día
  // programación" configurada en "Prog Tiempos" para ese Centro (fallback: hoy, si no se ha
  // configurado nada todavía).
  const fertSumByMaterialMap = useMemo(() => {
    const map = new Map<string, number>();
    fertOrders.forEach((o: any) => {
      const centro = String(o.CENTRO ?? '').trim();
      const targetDateISO = normalizeDateISO(progDatesByCentro[centro]) || todayISO;
      const fertDateISO = normalizeDateISO(o.FECHA || o.fecha);
      if (fertDateISO !== targetDateISO) return;
      const material = normCode(o.MATERIAL || o.Material || o.CodMaterial);
      const key = `${centro}|${material}`;
      const pend = Number(o.CANTPENDIENTE || o.CantPendiente || 0) || 0;
      map.set(key, (map.get(key) || 0) + pend);
    });
    return map;
  }, [fertOrders, progDatesByCentro, todayISO]);

  // Suma de Cantidad (Órdenes Previsionales) por Centro + Material Padre, para la fecha "Fecha
  // previsionales" configurada en "Prog Tiempos" para ese Centro (fallback: hoy).
  const provisionalSumByMaterialMap = useMemo(() => {
    const map = new Map<string, number>();
    provisionalOrders.forEach((o: any) => {
      const centro = String(o.Centro ?? '').trim();
      const targetDateISO = normalizeDateISO(provDatesByCentro[centro]) || todayISO;
      const prevDateISO = normalizeDateISO(o.FECHAINICIO || o.fecha_inicio);
      if (prevDateISO !== targetDateISO) return;
      const material = normCode(o.MATERIAL || o.CodMaterial || o.Material);
      const key = `${centro}|${material}`;
      const cant = Number(o.CANTIDAD || o.Cantidad || 0) || 0;
      map.set(key, (map.get(key) || 0) + cant);
    });
    return map;
  }, [provisionalOrders, provDatesByCentro, todayISO]);

  // Una fila de detalle por registro devuelto por MaestroMaterialesExplosionPaginado (uno por
  // cada Centro+Material de paresNecesidades). "Cant reprog" es editable por fila (clave estable
  // por Centro+Fert_Principal+Componente, no por posición, para no depender del orden de carga).
  const componenteCollator = useMemo(() => new Intl.Collator(undefined, { numeric: true, sensitivity: 'base' }), []);

  const detailRowsByCentro = useMemo(() => {
    const result: Record<Centro, DetailRow[]> = { '1000': [], '2000': [] };
    if (!componenteColumn) return result;

    CENTROS.forEach(centro => {
      const itemsPlancha = (itemsByCentro[centro] || []).filter(item => {
        if (!descripcionComponenteColumn) return true;
        return String(item[descripcionComponenteColumn] ?? '').trim().toUpperCase().startsWith('PLANCHA');
      });

      result[centro] = itemsPlancha.map((item): DetailRow => {
        const componente = String(item[componenteColumn] ?? '');
        const fertPrincipal = fertPrincipalColumn ? String(item[fertPrincipalColumn] ?? '') : '';
        const descripcionFert = descripcionFertColumn ? String(item[descripcionFertColumn] ?? '') : '';
        const materialPadre = materialPadreColumn ? normCode(item[materialPadreColumn]) : '';

        const materialPadreKey = `${centro}|${materialPadre}`;
        const gated = armadoMaterialSet.has(materialPadreKey);
        const cantOrdFab = gated ? (fertSumByMaterialMap.get(materialPadreKey) || 0) : 0;
        const cantOrdPrev = gated ? (provisionalSumByMaterialMap.get(materialPadreKey) || 0) : 0;
        const totalCant = cantOrdFab + cantOrdPrev;
        const tiempoMin = tiempoMinMap.get(`${centro}|${normCode(componente)}`) || 0;
        const totalTiempo = totalCant * tiempoMin;

        const reprogKey = `${centro}|${fertPrincipal}|${componente}`;
        const cantReprog = cantReprogByKey[reprogKey] ?? totalCant;
        const tiempoFinal = cantReprog * tiempoMin;

        return {
          reprogKey, centro, componente, fertPrincipal, descripcionFert,
          tiempoMin, cantOrdFab, cantOrdPrev, totalCant, totalTiempo, cantReprog, tiempoFinal,
        };
      });

      // Ordena por Centro + Componente para que las filas de un mismo componente queden
      // juntas y se note si tiene valores distintos en las demás columnas (p.ej. Fert_Principal).
      result[centro].sort((a, b) => componenteCollator.compare(a.componente, b.componente));
    });
    return result;
  }, [itemsByCentro, componenteColumn, descripcionComponenteColumn, fertPrincipalColumn, descripcionFertColumn, materialPadreColumn, armadoMaterialSet, fertSumByMaterialMap, provisionalSumByMaterialMap, tiempoMinMap, cantReprogByKey, componenteCollator]);

  // Publica, por Centro, los códigos Fert_Principal presentes en esta tabla (normalizados igual que
  // "Material" en Prog Tiempos/Mat Balanceo: últimos 8 caracteres) para que "Prog Tiempos" pueda
  // marcar como "Ajustado" los materiales que ya están siendo reprogramados aquí.
  useEffect(() => {
    const data: Record<string, Set<string>> = { '1000': new Set(), '2000': new Set() };
    CENTROS.forEach(centro => {
      detailRowsByCentro[centro].forEach(row => {
        data[centro].add(normCode8(row.fertPrincipal));
      });
    });
    publishFertPrincipalesRevCapHalb(data);
  }, [detailRowsByCentro]);

  // "Tiempo req" de la tabla de Prensado = suma de "Tiempo final" de todos los componentes del Centro.
  // "Tiempo final" está en minutos (igual que "Tiempo min"); "Tiempo Disp" (No. Mesas × Horas prog)
  // está en horas, así que se divide para 60 para poder comparar ambos en la misma unidad.
  const tiempoReqByCentro = useMemo(() => {
    const result: Record<string, number> = { '1000': 0, '2000': 0 };
    CENTROS.forEach(centro => {
      result[centro] = detailRowsByCentro[centro].reduce((sum, row) => sum + row.tiempoFinal, 0) / 60;
    });
    return result;
  }, [detailRowsByCentro]);

  // "Total (un)" de la tabla de Prensado = suma de "Cant reprog" de todos los componentes del
  // Centro, tal como está en la tabla "Detalle por Componente" de abajo.
  const totalCantReprogByCentro = useMemo(() => {
    const result: Record<string, number> = { '1000': 0, '2000': 0 };
    CENTROS.forEach(centro => {
      result[centro] = detailRowsByCentro[centro].reduce((sum, row) => sum + row.cantReprog, 0);
    });
    return result;
  }, [detailRowsByCentro]);

  const setCurrentPage = (centro: Centro, page: number) => {
    setCurrentPageByCentro(prev => ({ ...prev, [centro]: page }));
  };

  // Materiales (Centro + Material) con órdenes Fert u órdenes Previsionales abiertas: son las
  // "necesidades" a explotar vía MaestroMaterialesExplosionPaginado (uno por material, en vez de
  // bajar la tabla completa de explosión). El resultado se publica en el store de
  // useNecesidadesExplotadas, del que "Detalle por Componente" (abajo) e "Explosion Materiales"
  // (ambas sub-pestañas) leen itemsByCentro.
  const paresNecesidades = useMemo((): NecesidadPar[] => {
    const map = new Map<string, NecesidadPar>();
    fertOrders.forEach((o: any) => {
      const centro = String(o.CENTRO ?? '').trim();
      if (centro !== '1000' && centro !== '2000') return;
      const material = String(o.MATERIAL || o.Material || o.CodMaterial || '').trim();
      if (!material) return;
      map.set(`${centro}|${material}`, { centro: centro as Centro, material });
    });
    provisionalOrders.forEach((o: any) => {
      const centro = String(o.Centro ?? '').trim();
      if (centro !== '1000' && centro !== '2000') return;
      const material = String(o.MATERIAL || o.CodMaterial || o.Material || '').trim();
      if (!material) return;
      map.set(`${centro}|${material}`, { centro: centro as Centro, material });
    });
    return Array.from(map.values());
  }, [fertOrders, provisionalOrders]);

  const handleExplotarNecesidades = () => {
    if (paresNecesidades.length === 0) {
      addNotification('warning', 'No hay materiales con órdenes Fert/Previsionales cargados para explotar.');
      return;
    }
    addNotification('info', `Explotando ${paresNecesidades.length} materiales de necesidades…`);
    explodeNecesidades(paresNecesidades);
  };

  // Dispara la explosión automáticamente en cuanto cambia el conjunto de materiales (Centro+Material)
  // de Órdenes Fert/Previsionales, sin esperar a que el usuario presione el botón. `lastExplodedKeyRef`
  // evita repetir la misma corrida si el componente se re-renderiza sin que los materiales cambien.
  const paresKey = useMemo(
    () => paresNecesidades.map(p => `${p.centro}|${p.material}`).sort().join(','),
    [paresNecesidades]
  );
  const lastExplodedKeyRef = useRef<string>('');
  useEffect(() => {
    if (paresNecesidades.length === 0) return;
    if (paresKey === lastExplodedKeyRef.current) return;
    if (isExplotandoNecesidades) return;
    lastExplodedKeyRef.current = paresKey;
    explodeNecesidades(paresNecesidades);
  }, [paresKey, paresNecesidades, isExplotandoNecesidades]);

  // Ajuste automático de "Cant Reprog" para que "% Ocupación" quede lo más cerca posible de 100%,
  // usando "Prioridad"/"Mínimo % ajustar"/"Máximo % ajustar" publicados por la pestaña "Mat Balanceo".
  //
  // Por Prioridad descendente (5→0), para cada componente se busca su Fert_Principal como Material
  // en Mat Balanceo (mismo Centro). El rango permitido de esa fila se define como:
  //   Sobreocupación (bajar):  [Total cant − Total cant×Máximo%,  Total cant − Total cant×Mínimo%]
  //   Subocupación   (subir):  [Total cant + Total cant×Mínimo%,  Total cant + Total cant×Máximo%]
  // (el corte/incremento de Máximo% es siempre el extremo más agresivo del rango).
  //
  // Para cada fila candidata se calcula el valor EXACTO de Cant Reprog que dejaría la Ocupación
  // recalculada justo en 100% (despejando sobre el tiempo requerido de las demás filas), y ese valor
  // se acota al rango permitido de la fila: si cae dentro, se usa tal cual; si el ajuste necesario
  // excede lo que Mat Balanceo permite para ese material, se usa el extremo del rango más agresivo
  // (el tope permitido) y se continúa con la siguiente fila por prioridad.
  //
  // Criterio de parada: al bajar, se detiene apenas la Ocupación recalculada llega a ≤100%. Al subir,
  // se detiene apenas entra en el rango de tolerancia [97%, 100%].
  //
  // Cada corrida parte de Cant Reprog = Total cant para todas las filas del Centro (no se acumula
  // sobre ediciones manuales previas), para que el resultado sea reproducible.
  const handleAjustar = (centro: Centro) => {
    const rows = detailRowsByCentro[centro];
    if (rows.length === 0) {
      addNotification('warning', `Centro ${centro}: no hay componentes cargados para ajustar.`);
      return;
    }

    const matBalanceo = readMatBalanceoMap();
    const tiempoDisp = (noMesasByCentro[centro] ?? 0) * (horasProgByCentro[centro] ?? 0);
    if (tiempoDisp <= 0) {
      addNotification('warning', `Centro ${centro}: configure "No. Mesas" y "Horas prog" (Tiempo Disp > 0) antes de ajustar.`);
      return;
    }

    const working = new Map<string, number>(rows.map(r => [r.reprogKey, r.totalCant]));

    const tiempoReqMinTotal = (): number =>
      rows.reduce((sum, r) => sum + (working.get(r.reprogKey) ?? 0) * r.tiempoMin, 0);

    const computeOcupacion = (): number => {
      if (tiempoDisp <= 0) return 0;
      return ((tiempoReqMinTotal() / 60) / tiempoDisp) * 100;
    };

    const candidatosConPrioridad = rows
      .map(row => {
        const info = matBalanceo.get(`${centro}|${normCode8(row.fertPrincipal)}`);
        return info && info.habilitado ? { row, info } : null;
      })
      .filter((x): x is { row: DetailRow; info: MatBalanceoInfo } => x !== null)
      .sort((a, b) => b.info.prioridad - a.info.prioridad);

    const ocupacionInicial = computeOcupacion();
    if (ocupacionInicial === 100) {
      addNotification('info', `Centro ${centro}: la Ocupación ya está exactamente en 100%. No se realizó ningún ajuste.`);
      return;
    }

    const direccion: 'bajar' | 'subir' = ocupacionInicial > 100 ? 'bajar' : 'subir';
    addNotification(
      'info',
      `Centro ${centro}: ajustando capacidad (${direccion === 'bajar' ? 'reduciendo' : 'incrementando'} cantidades). Ocupación inicial ${ocupacionInicial.toFixed(1)}%…`
    );

    // Cantidad exacta de "Cant Reprog" para `row` que dejaría la Ocupación recalculada en 100%,
    // manteniendo fijo el aporte de tiempo de todas las demás filas ya ajustadas hasta el momento.
    const valorExactoParaObjetivo = (row: DetailRow): number => {
      const tiempoObjetivoMin = tiempoDisp * 60;
      const tiempoSinFila = tiempoReqMinTotal() - (working.get(row.reprogKey) ?? 0) * row.tiempoMin;
      return (tiempoObjetivoMin - tiempoSinFila) / row.tiempoMin;
    };

    let filasAjustadas = 0;
    let alcanzoObjetivo = false;

    if (direccion === 'bajar') {
      for (const { row, info } of candidatosConPrioridad) {
        if (row.tiempoMin <= 0) continue;
        const corteMinimo = row.totalCant - (row.totalCant * (info.minimo / 100)); // menos agresivo
        const corteMaximo = row.totalCant - (row.totalCant * (info.maximo / 100)); // más agresivo
        const lo = Math.max(0, Math.min(corteMinimo, corteMaximo));
        const hi = Math.max(0, Math.max(corteMinimo, corteMaximo));

        const aplicado = Math.round(Math.max(lo, Math.min(hi, valorExactoParaObjetivo(row))));
        working.set(row.reprogKey, aplicado);
        filasAjustadas++;
        if (computeOcupacion() <= 100) { alcanzoObjetivo = true; break; }
      }
    } else {
      for (const { row, info } of candidatosConPrioridad) {
        if (row.tiempoMin <= 0) continue;
        const subidaMinima = row.totalCant + (row.totalCant * (info.minimo / 100)); // menos agresivo
        const subidaMaxima = row.totalCant + (row.totalCant * (info.maximo / 100)); // más agresivo
        const lo = Math.max(0, Math.min(subidaMinima, subidaMaxima));
        const hi = Math.max(0, Math.max(subidaMinima, subidaMaxima));

        const aplicado = Math.round(Math.max(lo, Math.min(hi, valorExactoParaObjetivo(row))));
        working.set(row.reprogKey, aplicado);
        filasAjustadas++;
        if (computeOcupacion() >= TOLERANCIA_OCUPACION_MIN) { alcanzoObjetivo = true; break; }
      }
    }

    const ocupacionFinal = computeOcupacion();

    setCantReprogByKey(prev => {
      const next = { ...prev };
      working.forEach((value, key) => { next[key] = value; });
      return next;
    });

    if (filasAjustadas === 0) {
      addNotification(
        'warning',
        `Centro ${centro}: no hay materiales habilitados en Mat Balanceo para ajustar. La Ocupación se mantiene en ${ocupacionFinal.toFixed(1)}%.`
      );
    } else if (alcanzoObjetivo) {
      addNotification(
        'success',
        `Centro ${centro}: ajuste completado. Ocupación ${ocupacionInicial.toFixed(1)}% → ${ocupacionFinal.toFixed(1)}% (${filasAjustadas} ${filasAjustadas === 1 ? 'componente ajustado' : 'componentes ajustados'}).`
      );
    } else {
      addNotification(
        'warning',
        `Centro ${centro}: se ajustaron ${filasAjustadas} ${filasAjustadas === 1 ? 'componente' : 'componentes'} dentro de su rango permitido, pero la Ocupación quedó en ${ocupacionFinal.toFixed(1)}% — los rangos configurados en Mat Balanceo no alcanzan para llegar al objetivo.`
      );
    }
  };

  const renderDetailTable = (centro: Centro) => {
    const data = hideZeroTotalCant
      ? detailRowsByCentro[centro].filter(row => row.totalCant !== 0)
      : detailRowsByCentro[centro];
    const currentPage = currentPageByCentro[centro];
    const totalPagesLocal = Math.max(1, Math.ceil(data.length / rowsPerPage));
    const startIndex = (currentPage - 1) * rowsPerPage;
    const endIndex = startIndex + rowsPerPage;
    const displayedItems = data.slice(startIndex, endIndex);

    return (
      <div className="space-y-4">
        <div className="bg-white rounded-lg shadow-sm border overflow-hidden">
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200 text-xs">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-4 py-3 text-left text-[10px] font-bold text-gray-500 uppercase tracking-wider whitespace-nowrap">Centro</th>
                  <th className="px-4 py-3 text-left text-[10px] font-bold text-gray-500 uppercase tracking-wider whitespace-nowrap">Componente</th>
                  <th className="px-4 py-3 text-left text-[10px] font-bold text-gray-500 uppercase tracking-wider whitespace-nowrap">Fert_Principal</th>
                  <th className="px-4 py-3 text-left text-[10px] font-bold text-gray-500 uppercase tracking-wider whitespace-nowrap">Descripcion Fert</th>
                  <th className="px-4 py-3 text-right text-[10px] font-bold text-gray-500 uppercase tracking-wider whitespace-nowrap">Tiempo min</th>
                  <th className="px-4 py-3 text-right text-[10px] font-bold text-emerald-700 uppercase tracking-wider whitespace-nowrap bg-emerald-50/30">Cant OrdFab</th>
                  <th className="px-4 py-3 text-right text-[10px] font-bold text-amber-700 uppercase tracking-wider whitespace-nowrap bg-amber-50/30">Cant ordPrev</th>
                  <th className="px-4 py-3 text-right text-[10px] font-bold text-indigo-700 uppercase tracking-wider whitespace-nowrap bg-indigo-50/30">Total cant</th>
                  <th className="px-4 py-3 text-right text-[10px] font-bold text-indigo-700 uppercase tracking-wider whitespace-nowrap bg-indigo-50/30">Total Tiempo</th>
                  <th className="px-4 py-3 text-right text-[10px] font-bold text-violet-700 uppercase tracking-wider whitespace-nowrap bg-violet-50/30">Cant reprog</th>
                  <th className="px-4 py-3 text-right text-[10px] font-bold text-violet-700 uppercase tracking-wider whitespace-nowrap bg-violet-50/30">Tiempo final</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {displayedItems.length > 0 ? displayedItems.map(row => (
                  <tr key={row.reprogKey} className="hover:bg-gray-50 transition-colors">
                    <td className="px-4 py-2 whitespace-nowrap font-bold text-gray-900">{row.centro}</td>
                    <td className="px-4 py-2 whitespace-nowrap text-gray-600">{row.componente}</td>
                    <td className="px-4 py-2 whitespace-nowrap text-gray-600">{row.fertPrincipal}</td>
                    <td className="px-4 py-2 whitespace-nowrap text-gray-600">{row.descripcionFert}</td>
                    <td className="px-4 py-2 whitespace-nowrap text-right text-gray-600">
                      {row.tiempoMin.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </td>
                    <td className="px-4 py-2 whitespace-nowrap text-right font-bold text-emerald-700 bg-emerald-50/10">
                      {row.cantOrdFab.toLocaleString()}
                    </td>
                    <td className="px-4 py-2 whitespace-nowrap text-right font-bold text-amber-700 bg-amber-50/10">
                      {row.cantOrdPrev.toLocaleString()}
                    </td>
                    <td className="px-4 py-2 whitespace-nowrap text-right font-bold text-indigo-700 bg-indigo-50/10">
                      {row.totalCant.toLocaleString()}
                    </td>
                    <td className="px-4 py-2 whitespace-nowrap text-right font-bold text-indigo-700 bg-indigo-50/10">
                      {row.totalTiempo.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </td>
                    <td className="px-0 py-0 whitespace-nowrap bg-violet-50/10 min-w-[90px]">
                      <input
                        type="number"
                        value={row.cantReprog}
                        min="0"
                        onChange={(e) => {
                          const value = Number(e.target.value);
                          setCantReprogByKey(prev => ({ ...prev, [row.reprogKey]: value }));
                        }}
                        className="w-full text-right px-4 py-2 font-bold text-violet-700 outline-none bg-transparent focus:bg-violet-50"
                      />
                    </td>
                    <td className="px-4 py-2 whitespace-nowrap text-right font-bold text-violet-700 bg-violet-50/10">
                      {row.tiempoFinal.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </td>
                  </tr>
                )) : (
                  <tr>
                    <td colSpan={11} className="px-6 py-12 text-center text-gray-400 italic">
                      No se encontraron componentes para el Centro {centro}.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>

        <div className="bg-gray-50 px-6 py-4 border-t flex items-center justify-between rounded-lg">
          <div className="flex items-center gap-4">
            <span className="text-xs font-medium text-gray-500 uppercase">Ver:</span>
            <select
              value={rowsPerPage}
              onChange={(e) => {
                setRowsPerPage(Number(e.target.value));
                setCurrentPageByCentro({ '1000': 1, '2000': 1 });
              }}
              className="text-sm border rounded p-1 bg-white"
            >
              <option value={10}>10</option>
              <option value={20}>20</option>
              <option value={50}>50</option>
            </select>
            <span className="text-xs text-gray-400 font-medium">
              Viendo {data.length === 0 ? 0 : startIndex + 1} - {Math.min(endIndex, data.length)} de {data.length}
              {isExplotandoNecesidades && <Loader2 className="inline-block w-3 h-3 ml-2 animate-spin" />}
            </span>
          </div>

          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" onClick={() => setCurrentPage(centro, Math.max(1, currentPage - 1))} disabled={currentPage === 1}> Anterior </Button>
            <div className="px-4 py-1 bg-white border rounded text-sm font-bold text-indigo-600 min-w-[80px] text-center"> {currentPage} / {totalPagesLocal} </div>
            <Button variant="outline" size="sm" onClick={() => setCurrentPage(centro, Math.min(totalPagesLocal, currentPage + 1))} disabled={currentPage === totalPagesLocal}> Siguiente </Button>
          </div>
        </div>
      </div>
    );
  };

  const fechaFertDisplay = progDatesByCentro['1000'] || progDatesByCentro['2000'] || todayISO;
  const fechaPrevDisplay = provDatesByCentro['1000'] || provDatesByCentro['2000'] || todayISO;

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex items-center space-x-3">
          <Layers className="w-6 h-6 text-indigo-600" />
          <div>
            <h3 className="text-xl font-semibold text-gray-700">Revisión de Capacidad Halb</h3>
            <p className="text-xs text-gray-500">Capacidad de prensado por Centro, a partir de la Explosión de Materiales</p>
            <p className="text-[11px] text-gray-400 mt-0.5">
              Cant OrdFab: fecha <span className="font-semibold text-gray-600">{fechaFertDisplay}</span> · Cant ordPrev: fecha <span className="font-semibold text-gray-600">{fechaPrevDisplay}</span> (definidas en "Prog Tiempos")
            </p>
          </div>
        </div>

        <Button variant="outline" size="sm" onClick={handleExplotarNecesidades} disabled={isExplotandoNecesidades}>
          {isExplotandoNecesidades ? (
            <>
              <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              Explotando {progressDone}/{progressTotal}…
            </>
          ) : (
            <>
              <Boxes className="w-4 h-4 mr-2" />
              Actualizar Necesidades
            </>
          )}
        </Button>
      </div>

      <div className="bg-white rounded-lg shadow-md border overflow-hidden">
        <div className="px-4 py-3 border-b bg-gray-50 flex items-center justify-between">
          <h4 className="text-sm font-bold text-gray-700 uppercase tracking-wide">Prensado</h4>
        </div>
        <div className="overflow-x-auto">
          <table className="min-w-full text-xs border-collapse">
            <thead className="bg-gray-50 uppercase text-[10px] font-bold text-gray-600">
              <tr>
                <th className="px-4 py-3 text-left border">Centro</th>
                <th className="px-4 py-3 text-right border">No. Mesas</th>
                <th className="px-4 py-3 text-right border">Horas prog</th>
                <th className="px-4 py-3 text-right border text-green-700 bg-green-50/30">Tiempo Disp</th>
                <th className="px-4 py-3 text-right border text-indigo-700 bg-indigo-50/30">Tiempo req</th>
                <th className="px-4 py-3 text-right border text-violet-700 bg-violet-50/30">% Ocupación</th>
                <th className="px-4 py-3 text-right border text-amber-700 bg-amber-50/30">Total (un)</th>
                <th className="px-4 py-3 text-center border">Acción</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {CENTROS.map(centro => {
                const noMesas = noMesasByCentro[centro] ?? 0;
                const horasProg = horasProgByCentro[centro] ?? 0;
                const tiempoDisp = noMesas * horasProg;
                const tiempoReq = tiempoReqByCentro[centro] ?? 0;
                const ocupacion = tiempoDisp > 0 ? (tiempoReq / tiempoDisp) * 100 : 0;
                const totalCantReprog = totalCantReprogByCentro[centro] ?? 0;

                return (
                  <tr key={centro} className="hover:bg-gray-50 transition-colors">
                    <td className="px-4 py-3 font-bold text-gray-900 border">{centro}</td>
                    <td className="px-0 py-0 border bg-white min-w-[100px]">
                      <input
                        type="number"
                        value={noMesas}
                        min="0"
                        onChange={(e) => setNoMesasByCentro(prev => ({ ...prev, [centro]: Number(e.target.value) }))}
                        className="w-full text-right px-3 py-3 font-bold text-indigo-600 outline-none h-full bg-transparent focus:bg-indigo-50"
                      />
                    </td>
                    <td className="px-0 py-0 border bg-white min-w-[100px]">
                      <input
                        type="number"
                        value={horasProg}
                        min="0"
                        step="0.01"
                        onChange={(e) => setHorasProgByCentro(prev => ({ ...prev, [centro]: Number(e.target.value) }))}
                        className="w-full text-right px-3 py-3 font-bold text-indigo-600 outline-none h-full bg-transparent focus:bg-indigo-50"
                      />
                    </td>
                    <td className="px-4 py-3 text-right font-bold border text-green-700 bg-green-50/10">
                      {tiempoDisp.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </td>
                    <td className="px-4 py-3 text-right font-bold border text-indigo-700 bg-indigo-50/10">
                      {tiempoReq.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </td>
                    <td className="px-4 py-3 text-right font-bold border text-violet-700 bg-violet-50/10">
                      {ocupacion.toLocaleString(undefined, { minimumFractionDigits: 1, maximumFractionDigits: 1 })}%
                    </td>
                    <td className="px-4 py-3 text-right font-bold border text-amber-700 bg-amber-50/10">
                      {totalCantReprog.toLocaleString()}
                    </td>
                    <td className="px-4 py-3 text-center border">
                      <Button variant="outline" size="sm" onClick={() => handleAjustar(centro)}>
                        Ajustar
                      </Button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      <div className="bg-white rounded-lg shadow-md border overflow-hidden">
        <div className="px-4 py-3 border-b bg-gray-50 flex items-center justify-between">
          <h4 className="text-sm font-bold text-gray-700 uppercase tracking-wide">Detalle por Componente</h4>
          <label className="flex items-center gap-2 text-xs font-medium text-gray-600 cursor-pointer">
            <input
              type="checkbox"
              checked={hideZeroTotalCant}
              onChange={(e) => {
                setHideZeroTotalCant(e.target.checked);
                setCurrentPageByCentro({ '1000': 1, '2000': 1 });
              }}
              className="rounded border-gray-300"
            />
            Excluir "Total cant" en cero
          </label>
        </div>
        <div className="p-4">
          {!componenteColumn ? (
            <div className="flex flex-col justify-center items-center py-16 bg-white rounded-lg border border-dashed">
              <span className="text-gray-500 font-medium">No fue posible identificar la columna "Componente" en los datos.</span>
            </div>
          ) : (
            <Tabs value={activeCentroTab} onValueChange={(val) => setActiveCentroTab(val as Centro)} className="w-full">
              <TabsList className="flex h-auto bg-gray-100/50 p-1 mb-4">
                {CENTROS.map(centro => (
                  <TabsTrigger
                    key={centro}
                    value={centro}
                    className="data-[state=active]:bg-white data-[state=active]:text-indigo-700 data-[state=active]:shadow-sm px-6 py-2 text-xs font-bold uppercase tracking-wider"
                  >
                    <Home className="w-3 h-3 mr-2" />
                    Centro {centro}
                  </TabsTrigger>
                ))}
              </TabsList>

              <TabsContent value="1000">{renderDetailTable('1000')}</TabsContent>
              <TabsContent value="2000">{renderDetailTable('2000')}</TabsContent>
            </Tabs>
          )}
        </div>
      </div>
    </div>
  );
};
