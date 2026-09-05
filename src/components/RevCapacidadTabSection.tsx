'use client';

import React, { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { serviciosService } from '@/services/servicios.service';
import { grupoService } from '@/services/grupo.service';
import { useRuntimeInspector } from '@/services/RuntimeInspector';
import { useAppContext } from '@/context/AppProvider';
import { 
  Activity,
  Loader2,
  Home,
  Download,
  ArrowRightLeft,
  AlertCircle
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { cn } from '@/lib/utils';
import * as XLSX from 'xlsx';
import { useTiempoFinalPorPuesto, useCantidadFinalPorPuesto, useTiempoInicialPorPuesto, useCantidadInicialPorPuesto } from '@/hooks/useProgTiemposCapacidad';

interface SummaryRow {
  linea: string;
  puesto: string;
  cantOrdFab: number;
  cantOrdPrev: number;
  tiempoOrdFab: number;
  tiempoOrdPrev: number;
  totalCantidad: number;
  totalTiempo: number;
  cantInicial: number;
  tiempoInicial: number;
  puestosObjetivo: number;
}

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

const normalizeDateISO = (dateStr: any): string | null => {
  if (!dateStr) return null;
  const s = String(dateStr).trim();
  let match = s.match(/^(\d{1,2})[\/-](\d{1,2})[\/-](\d{4})/);
  if (match) return `${match[3]}-${match[2].padStart(2, '0')}-${match[1].padStart(2, '0')}`;
  match = s.match(/^(\d{4})-(\d{1,2})-(\d{1,2})/);
  if (match) return `${match[1]}-${match[2].padStart(2, '0')}-${match[3].padStart(2, '0')}`;
  return null;
};

const normalizeMaterialCode = (code: string | number): string => {
  return String(code || '').trim().slice(-8);
};

const normalizeKey = (text: string) => {
  return String(text || '')
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim()
    .toUpperCase();
};

// Mapeo de equivalencias M\u00e1quina -> L\u00ednea (igual al usado en "Fert" y "Previsionales"): la L\u00ednea
// de una orden Fert/Previsional se deriva de su M\u00e1quina, no de patrones en Categor\u00eda.
const MAQUINA_LINEA_MAP: Record<string, string> = {
  'HR-ARM01': 'LINEA 1',
  'HR-ARM02': 'LINEA 2',
  'HR-ARM03': 'LINEA 3',
  'HR-ARM05': 'LINEA 5',
  'HR-ARM21': 'LINEA 1',
  'HR-ARM22': 'LINEA 2',
  'HR-ARM25': 'LINEA 5',
};

// Rendimiento a aplicar sobre "Tiempo Disponible" segun la Linea del puesto (todos los puestos de
// una misma linea usan el mismo factor: Armado/Cerrado de LINEA 1 -> Rend L1, etc.), igual criterio
// que ya se usa para ponderar "Total Tiempo".
const getRendFactor = (lineaNormalized: string, rends: Record<string, number>): number => {
  if (lineaNormalized.includes('1')) return rends.L1;
  if (lineaNormalized.includes('2')) return rends.L2;
  if (lineaNormalized.includes('3')) return rends.L3;
  if (lineaNormalized.includes('5')) return rends.L5;
  return 1;
};

export const RevCapacidadTabSection: React.FC = () => {
  const inspector = useRuntimeInspector('RevCapacidadTab');
  const { addNotification } = useAppContext();
  // "Total Tiempo" y "Total Cantidad" por Centro+Línea+Puesto, publicados por "Prog Tiempos" (ambos
  // basados en su columna "Cant Reprog"). Cuando existen, reemplazan el cálculo propio de esta
  // pestaña para que los ajustes hechos en Prog Tiempos se reflejen tanto en el % Ocupación como en
  // la Cantidad Total mostrada aquí — de lo contrario quedarían inconsistentes entre sí.
  const tiempoFinalPorPuesto = useTiempoFinalPorPuesto();
  const cantidadFinalPorPuesto = useCantidadFinalPorPuesto();
  // "Tiempo inicial"/"Cant inicial": la demanda cruda (SIN el ajuste de Cant Reprog) tal como la
  // calcula "Total Cantidad"/"Tiempo Total" en "Prog Tiempos" — el contrapunto de las columnas de
  // arriba, que sí reflejan el ajuste.
  const tiempoInicialPorPuesto = useTiempoInicialPorPuesto();
  const cantidadInicialPorPuesto = useCantidadInicialPorPuesto();

  const [technicalData, setTechnicalData] = useState<any[]>([]);
  const [fertOrders, setFertOrders] = useState<any[]>([]);
  const [provisionalOrders, setProvisionalOrders] = useState<any[]>([]);
  const [availableCenters, setAvailableCenters] = useState<string[]>([]);
  const [selectedCenter, setSelectedCenter] = useState<string>("1000");
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [isMounted, setIsMounted] = useState(false);
  
  // Filtros persistentes e independientes por centro
  const [progDates, setProgDates] = useState<Record<string, string>>({});
  const [horasT1ByCenter, setHorasT1ByCenter] = useState<Record<string, number>>({});
  const [horasT2ByCenter, setHorasT2ByCenter] = useState<Record<string, number>>({});
  
  // Rendimientos independientes por centro
  const [rendimientosByCenter, setRendimientosByCenter] = useState<Record<string, Record<string, number>>>({
    '1000': { L1: 1.05, L2: 1.08, L3: 1.05, L5: 1.05 },
    '2000': { L1: 1.05, L2: 1.08, L3: 1.05, L5: 1.05 }
  });

  const [editablePuestosT1, setEditablePuestosT1] = useState<Record<string, number>>({});
  const [editablePuestosT2, setEditablePuestosT2] = useState<Record<string, number>>({});

  useEffect(() => {
    setIsMounted(true);
    // Cargar datos persistentes de localStorage al montar
    const savedT1 = localStorage.getItem('sim_puestos_t1');
    const savedT2 = localStorage.getItem('sim_puestos_t2');
    const savedH1 = localStorage.getItem('sim_horas_t1_by_center');
    const savedH2 = localStorage.getItem('sim_horas_t2_by_center');
    const savedProgDates = localStorage.getItem('sim_prog_dates');
    const savedRend = localStorage.getItem('sim_rendimientos_by_center');

    if (savedT1) try { setEditablePuestosT1(JSON.parse(savedT1)); } catch(e) {}
    if (savedT2) try { setEditablePuestosT2(JSON.parse(savedT2)); } catch(e) {}
    if (savedH1) try { setHorasT1ByCenter(JSON.parse(savedH1)); } catch(e) {}
    if (savedH2) try { setHorasT2ByCenter(JSON.parse(savedH2)); } catch(e) {}
    if (savedProgDates) try { setProgDates(JSON.parse(savedProgDates)); } catch(e) {}
    if (savedRend) try { setRendimientosByCenter(JSON.parse(savedRend)); } catch(e) {}
  }, []);

  const loadData = useCallback(async () => {
    setIsLoading(true);
    try {
      const [groupsRes, fertRes, prevRes] = await Promise.all([
        grupoService.getAll(),
        serviciosService.getOrdenesFert(1, 10000),
        serviciosService.OrdenesProvisionalesAlphaPaginados(1, 10000)
      ]);

      const centers = [...new Set((groupsRes?.data || []).map((g: any) => String(g.centro).trim()))].sort();
      setAvailableCenters(centers);
      if (centers.length > 0 && !selectedCenter) setSelectedCenter(centers[0]);

      let allTiempos: any[] = [];
      let page = 1;
      let hasMore = true;
      while (hasMore && page <= 5) {
        const response = await serviciosService.getTiemposEnsamblado(page, 5000);
        const raw = Array.isArray(response?.data) ? response.data : [];
        allTiempos = [...allTiempos, ...raw];
        if (raw.length < 5000) hasMore = false; else page++;
      }
      setTechnicalData(allTiempos);
      setFertOrders(Array.isArray(fertRes?.data) ? fertRes.data : []);
      setProvisionalOrders(Array.isArray(prevRes?.data) ? prevRes.data : []);

    } catch (err) {
      addNotification('error', `Error al cargar datos: ${(err as Error).message}`);
    } finally {
      setIsLoading(false);
    }
  }, [addNotification, selectedCenter]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  // Valores actuales basados en el centro seleccionado
  const programmingDate = progDates[selectedCenter] || new Date().toISOString().split('T')[0];
  const currentHorasT1 = horasT1ByCenter[selectedCenter] ?? 8.75;
  const currentHorasT2 = horasT2ByCenter[selectedCenter] ?? 8.75;
  const currentRends = rendimientosByCenter[selectedCenter] || { L1: 1.05, L2: 1.08, L3: 1.05, L5: 1.05 };

  const fertSumMap = useMemo(() => {
    const map = new Map<string, number>();
    const targetDateISO = normalizeDateISO(programmingDate);
    if (!targetDateISO || !selectedCenter) return map;

    fertOrders.forEach(o => {
      if (normalizeDateISO(o.FECHA || o.fecha) === targetDateISO && String(o.CENTRO || '').trim() === selectedCenter) {
        const maquina = String(o.MAQUINA || o.Maquina || o.maquina || '').trim().toUpperCase();
        const linea = MAQUINA_LINEA_MAP[maquina] || '';

        const material = normalizeMaterialCode(o.MATERIAL || o.CodMaterial);
        const key = `${linea}|${material}`;
        map.set(key, (map.get(key) || 0) + Number(o.CANTPENDIENTE || 0));
      }
    });
    return map;
  }, [fertOrders, programmingDate, selectedCenter]);

  const prevSumMap = useMemo(() => {
    const map = new Map<string, number>();
    const targetDateISO = normalizeDateISO(programmingDate);
    if (!targetDateISO || !selectedCenter) return map;

    provisionalOrders.forEach(o => {
      if (normalizeDateISO(o.FECHAINICIO || o.fecha_inicio) === targetDateISO && String(o.Centro || '').trim() === selectedCenter) {
        const maquina = String(o.Maquina || o.MAQUINA || o.maquina || '').trim().toUpperCase();
        const linea = MAQUINA_LINEA_MAP[maquina] || '';

        const material = normalizeMaterialCode(o.MATERIAL || o.CodMaterial || o.Material);
        const key = `${linea}|${material}`;
        map.set(key, (map.get(key) || 0) + Number(o.CANTIDAD || 0));
      }
    });
    return map;
  }, [provisionalOrders, programmingDate, selectedCenter]);

  const summaryData = useMemo((): SummaryRow[] => {
    const map = new Map<string, SummaryRow>();
    const base = technicalData.filter(d => String(d.Centro || '').trim() === selectedCenter);
    const allowedLines = ['LINEA 1', 'LINEA 2', 'LINEA 3', 'LINEA 5'];
    const allowedWstations = ['Armado', 'Cerrado L1', 'Cerrado1 L2', 'Cerrado2 L2', 'Cerrado L3'];

    base.forEach(row => {
      const lineRaw = String(row.Linea || '').trim();
      const lineNormalized = normalizeKey(lineRaw);
      const puestoRaw = String(row.PuestoTrabajo || '').trim();
      
      if (!allowedLines.some(l => lineNormalized.includes(l))) return;
      if (!allowedWstations.includes(puestoRaw)) return;

      const key = `${lineNormalized}|${puestoRaw}`;
      const matKey = `${lineNormalized}|${normalizeMaterialCode(row.CodMaterial)}`;

      if (!map.has(key)) {
        map.set(key, {
          linea: lineNormalized, puesto: puestoRaw,
          cantOrdFab: 0, cantOrdPrev: 0,
          tiempoOrdFab: 0, tiempoOrdPrev: 0,
          totalCantidad: 0, totalTiempo: 0,
          cantInicial: 0, tiempoInicial: 0,
          puestosObjetivo: RESTRICCIONES_PUESTOS[key] || 0
        });
      }

      const entry = map.get(key)!;
      const qFab = fertSumMap.get(matKey) || 0;
      const qPrev = prevSumMap.get(matKey) || 0;
      const tUnit = Number(row.Tiempo_Min || 0);

      let rendFactor = 1;
      if (lineNormalized.includes('1')) rendFactor = currentRends.L1;
      else if (lineNormalized.includes('2')) rendFactor = currentRends.L2;
      else if (lineNormalized.includes('3')) rendFactor = currentRends.L3;
      else if (lineNormalized.includes('5')) rendFactor = currentRends.L5;

      entry.cantOrdFab += qFab;
      entry.tiempoOrdFab += ((qFab * tUnit) / 60) * rendFactor;
      entry.cantOrdPrev += qPrev;
      entry.tiempoOrdPrev += ((qPrev * tUnit) / 60) * rendFactor;
      entry.totalCantidad = entry.cantOrdFab + entry.cantOrdPrev;
      entry.totalTiempo = entry.tiempoOrdFab + entry.tiempoOrdPrev;
      // Respaldo de "Cant/Tiempo inicial" mientras "Prog Tiempos" no haya publicado nada: el mismo
      // cálculo propio de "Total Cantidad"/"Total Tiempo" de arriba, con las mismas condiciones
      // (Centro+Línea+Puesto, fecha de programación, Rendimiento).
      entry.cantInicial = entry.totalCantidad;
      entry.tiempoInicial = entry.totalTiempo;
    });

    const result = Array.from(map.values());
    // Si "Prog Tiempos" ya publicó un "Tiempo Final" y una "Cant Reprog" para este Centro+Línea+
    // Puesto, esos valores mandan sobre el cálculo propio de arriba (así el % Ocupación Y la
    // Cantidad Total reflejan los ajustes hechos en Prog Tiempos, de forma consistente entre sí).
    // Si todavía no hay nada publicado, se conserva el cálculo propio (demanda cruda) como respaldo.
    // "Cant inicial"/"Tiempo inicial" toman, con el mismo criterio, el "Total Cantidad"/"Tiempo
    // Total" de Prog Tiempos SIN el ajuste de Cant Reprog: la foto de la demanda original.
    result.forEach(entry => {
      const puestoNorm = entry.puesto.trim().toUpperCase().replace(/\s+/g, ' ');
      const key = `${selectedCenter}|${entry.linea}|${puestoNorm}`;
      const tiempoPublicado = tiempoFinalPorPuesto[key];
      if (tiempoPublicado !== undefined) entry.totalTiempo = tiempoPublicado;
      const cantidadPublicada = cantidadFinalPorPuesto[key];
      if (cantidadPublicada !== undefined) entry.totalCantidad = cantidadPublicada;
      const tiempoInicialPublicado = tiempoInicialPorPuesto[key];
      if (tiempoInicialPublicado !== undefined) entry.tiempoInicial = tiempoInicialPublicado;
      const cantidadInicialPublicada = cantidadInicialPorPuesto[key];
      if (cantidadInicialPublicada !== undefined) entry.cantInicial = cantidadInicialPublicada;
    });

    return result.sort((a, b) => a.linea.localeCompare(b.linea) || a.puesto.localeCompare(b.puesto));
  }, [technicalData, selectedCenter, fertSumMap, prevSumMap, currentRends, tiempoFinalPorPuesto, cantidadFinalPorPuesto, tiempoInicialPorPuesto, cantidadInicialPorPuesto]);

  // Sincronizar y guardar en localStorage
  useEffect(() => {
    if (isMounted) {
      localStorage.setItem('sim_puestos_t1', JSON.stringify(editablePuestosT1));
      localStorage.setItem('sim_puestos_t2', JSON.stringify(editablePuestosT2));
      localStorage.setItem('sim_horas_t1_by_center', JSON.stringify(horasT1ByCenter));
      localStorage.setItem('sim_horas_t2_by_center', JSON.stringify(horasT2ByCenter));
      localStorage.setItem('sim_prog_dates', JSON.stringify(progDates));
      localStorage.setItem('sim_rendimientos_by_center', JSON.stringify(rendimientosByCenter));
    }
  }, [editablePuestosT1, editablePuestosT2, horasT1ByCenter, horasT2ByCenter, progDates, rendimientosByCenter, isMounted]);

  // Inicializar puestos vacíos
  useEffect(() => {
    if (summaryData.length === 0) return;
    setEditablePuestosT1(prev => {
      const next = { ...prev };
      let changed = false;
      summaryData.forEach(r => {
        const key = `${selectedCenter}|${r.linea}|${r.puesto}`;
        if (next[key] === undefined) {
          next[key] = r.puestosObjetivo;
          changed = true;
        }
      });
      return changed ? next : prev;
    });
    setEditablePuestosT2(prev => {
      const next = { ...prev };
      let changed = false;
      summaryData.forEach(r => {
        const key = `${selectedCenter}|${r.linea}|${r.puesto}`;
        if (next[key] === undefined) {
          next[key] = 0;
          changed = true;
        }
      });
      return changed ? next : prev;
    });
  }, [summaryData, selectedCenter]);

  const grandTotals = useMemo(() => {
    return summaryData.reduce((acc, r) => {
      const key = `${selectedCenter}|${r.linea}|${r.puesto}`;
      const t1 = editablePuestosT1[key] ?? r.puestosObjetivo;
      const t2 = editablePuestosT2[key] ?? 0;
      const dispTime = ((t1 * currentHorasT1) + (t2 * currentHorasT2)) * getRendFactor(r.linea, currentRends);
      // "Total Cantidad" (general) solo suma el Puesto "Armado" de cada línea: los demás puestos
      // (Cerrado L1, Cerrado1/2 L2, Cerrado L3) son pasos posteriores del MISMO material, así que
      // sumarlos también duplicaría la cantidad real.
      const esArmado = r.puesto.trim().toLowerCase() === 'armado';

      return {
        totalCant: acc.totalCant + (esArmado ? r.totalCantidad : 0),
        totalTime: acc.totalTime + r.totalTiempo,
        totalPuestos: acc.totalPuestos + (r.totalTiempo / (currentHorasT1 || 1)),
        totalT1: acc.totalT1 + t1,
        totalT2: acc.totalT2 + t2,
        totalDispTime: acc.totalDispTime + dispTime,
        totalObjetivo: acc.totalObjetivo + r.puestosObjetivo,
      };
    }, { totalCant: 0, totalTime: 0, totalPuestos: 0, totalT1: 0, totalT2: 0, totalDispTime: 0, totalObjetivo: 0 });
  }, [summaryData, selectedCenter, editablePuestosT1, editablePuestosT2, currentHorasT1, currentHorasT2]);

  const hourOptions = [8.75, 10, 11, 12];

  const handleRendChange = (lineKey: string, value: number) => {
    setRendimientosByCenter(prev => ({
      ...prev,
      [selectedCenter]: {
        ...(prev[selectedCenter] || {}),
        [lineKey]: value
      }
    }));
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex items-center space-x-3">
          <Activity className="w-6 h-6 text-indigo-600" />
          <h3 className="text-xl font-semibold text-gray-800">Resumen de Capacidad y Balanceo</h3>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" className="bg-blue-50 text-blue-700 border-blue-200" onClick={() => loadData()}>
            <ArrowRightLeft className="w-4 h-4 mr-2" /> Recalcular Carga
          </Button>
          <Button 
            variant="outline" size="sm" 
            onClick={() => {
              const exportRows = summaryData.map(r => {
                const key = `${selectedCenter}|${r.linea}|${r.puesto}`;
                const t1 = editablePuestosT1[key] ?? r.puestosObjetivo;
                const t2 = editablePuestosT2[key] ?? 0;
                const disp = ((t1 * currentHorasT1) + (t2 * currentHorasT2)) * getRendFactor(r.linea, currentRends);
                return {
                  'Línea': r.linea, 'Puesto Trabajo': r.puesto,
                  'Cant inicial': r.cantInicial,
                  'Tiempo inicial': Number(r.tiempoInicial.toFixed(2)),
                  'Total Cantidad': r.totalCantidad,
                  'Total Tiempo (h)': Number(r.totalTiempo.toFixed(2)),
                  'Puestos T1': t1,
                  'Puestos T2': t2,
                  'Tiempo Disponible (h)': Number(disp.toFixed(2)),
                  'Diferencia (h)': Number((disp - r.totalTiempo).toFixed(2))
                };
              });
              const ws = XLSX.utils.json_to_sheet(exportRows);
              const wb = XLSX.utils.book_new();
              XLSX.utils.book_append_sheet(wb, ws, "Capacidad");
              XLSX.writeFile(wb, `Capacidad_${selectedCenter}.xlsx`);
            }}
          >
            <Download className="w-4 h-4 mr-2" /> Exportar
          </Button>
        </div>
      </div>

      <Tabs value={selectedCenter} onValueChange={setSelectedCenter} className="w-full">
        <TabsList className="flex h-auto bg-gray-100/50 p-1 mb-4">
          {availableCenters.map(center => (
            <TabsTrigger key={center} value={center} className="px-6 py-2 text-xs font-bold uppercase data-[state=active]:bg-white data-[state=active]:text-indigo-700">
              <Home className="w-3 h-3 mr-2" /> Centro {center}
            </TabsTrigger>
          ))}
        </TabsList>

        <div className="grid grid-cols-1 md:grid-cols-4 lg:grid-cols-8 gap-4 p-4 bg-gray-50 border rounded-xl mb-6 shadow-sm">
          <div className="flex flex-col gap-1">
            <label className="text-[10px] font-bold text-gray-400 uppercase ml-1">Día Prog:</label>
            <input 
              type="date" 
              value={programmingDate} 
              onChange={e => {
                const val = e.target.value;
                setProgDates(prev => {
                  const next = { ...prev, [selectedCenter]: val };
                  if (selectedCenter === '1000') next['2000'] = val;
                  return next;
                });
              }} 
              className="text-xs border rounded-md px-2 py-2 text-indigo-700 font-medium h-9 outline-none focus:ring-2 focus:ring-indigo-500" 
            />
          </div>
          <div className="flex flex-col gap-1">
            <label className="text-[10px] font-bold text-gray-400 uppercase ml-1">Fecha Prev:</label>
            <input type="date" value={programmingDate} disabled className="text-xs border rounded-md px-2 py-2 text-gray-500 font-medium h-9 outline-none bg-gray-100 cursor-not-allowed" />
          </div>
          <div className="flex flex-col gap-1">
            <label className="text-[10px] font-bold text-gray-400 uppercase ml-1">Horas T1:</label>
            <select 
              value={currentHorasT1} 
              onChange={e => setHorasT1ByCenter(prev => ({ ...prev, [selectedCenter]: Number(e.target.value) }))} 
              className="text-xs border rounded-md px-2 py-1 h-9 font-bold text-indigo-700 bg-white"
            >
              {hourOptions.map(h => <option key={`t1-${h}`} value={h}>{h}</option>)}
            </select>
          </div>
          <div className="flex flex-col gap-1">
            <label className="text-[10px] font-bold text-gray-400 uppercase ml-1">Horas T2:</label>
            <select 
              value={currentHorasT2} 
              onChange={e => setHorasT2ByCenter(prev => ({ ...prev, [selectedCenter]: Number(e.target.value) }))} 
              className="text-xs border rounded-md px-2 py-1 h-9 font-bold text-indigo-700 bg-white"
            >
              {hourOptions.map(h => <option key={`t2-${h}`} value={h}>{h}</option>)}
            </select>
          </div>
          
          {[1, 2, 3, 5].map((lineNum) => {
            const key = `L${lineNum}`;
            return (
              <div key={key} className="flex flex-col gap-1">
                <label className="text-[10px] font-bold text-gray-400 uppercase ml-1">Rend {key}:</label>
                <input 
                  type="number" step="0.01" 
                  value={currentRends[key]} 
                  onChange={e => handleRendChange(key, Number(e.target.value))}
                  className="text-xs border rounded-md px-2 py-1 h-9 font-bold text-indigo-700 bg-white" 
                />
              </div>
            );
          })}
        </div>

        <div className="bg-white rounded-lg shadow-md border overflow-hidden">
          <div className="overflow-x-auto">
            <table className="min-w-full text-xs border-collapse">
              <thead className="bg-gray-50 uppercase text-[10px] font-bold text-gray-600">
                <tr>
                  <th className="px-4 py-3 text-left border">Línea</th>
                  <th className="px-4 py-3 text-left border">Puesto Trabajo</th>
                  <th className="px-4 py-3 text-right border text-purple-700 bg-purple-50/10">Cant inicial</th>
                  <th className="px-4 py-3 text-right border text-indigo-700 bg-indigo-50/10">Tiempo inicial</th>
                  <th className="px-4 py-3 text-right border text-purple-700 bg-purple-50/30">Total Cantidad</th>
                  <th className="px-4 py-3 text-right border bg-indigo-50/30">Total Tiempo (h)</th>
                  <th className="px-4 py-3 text-right border text-indigo-700 bg-indigo-50/50">Puestos T1</th>
                  <th className="px-4 py-3 text-right border text-indigo-700 bg-indigo-50/50">Puestos T2</th>
                  <th className="px-4 py-3 text-right border text-green-700 bg-green-50/30 font-bold">Tiempo Disponible</th>
                  <th className="px-4 py-3 text-right border text-teal-700">Diferencia (h)</th>
                  <th className="px-4 py-3 text-right border text-violet-700 bg-violet-50/30">% Ocupación</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {isLoading ? (
                  <tr><td colSpan={11} className="px-6 py-12 text-center text-gray-500"><Loader2 className="w-8 h-8 animate-spin mx-auto mb-2" /> Cargando...</td></tr>
                ) : summaryData.length > 0 ? (() => {
                  const items: React.ReactNode[] = [];
                  const lines = [...new Set(summaryData.map(r => r.linea))];
                  lines.forEach(lineName => {
                    const rows = summaryData.filter(r => r.linea === lineName);
                    rows.forEach((r, idx) => {
                      const key = `${selectedCenter}|${r.linea}|${r.puesto}`;

                      const t1 = editablePuestosT1[key] ?? r.puestosObjetivo;
                      const t2 = editablePuestosT2[key] ?? 0;

                      const dispTime = ((t1 * currentHorasT1) + (t2 * currentHorasT2)) * getRendFactor(r.linea, currentRends);
                      const deltaHours = dispTime - r.totalTiempo;
                      const ocupacion = dispTime > 0 ? (r.totalTiempo / dispTime) * 100 : 0;

                      items.push(
                        <tr key={key} className="hover:bg-gray-50 transition-colors">
                          {idx === 0 && <td rowSpan={rows.length} className="px-4 py-3 font-bold text-gray-900 border align-top bg-gray-50/50">{lineName}</td>}
                          <td className="px-4 py-3 font-medium text-gray-700 border">{r.puesto}</td>
                          <td className="px-4 py-3 text-right border text-purple-700 bg-purple-50/5">{r.cantInicial.toLocaleString()}</td>
                          <td className="px-4 py-3 text-right border text-indigo-700 bg-indigo-50/5">{r.tiempoInicial.toFixed(2)}</td>
                          <td className="px-4 py-3 text-right font-bold border text-purple-700 bg-purple-50/5">{r.totalCantidad.toLocaleString()}</td>
                          <td className="px-4 py-3 text-right font-bold border bg-indigo-50/5">{r.totalTiempo.toFixed(2)}</td>

                          <td className="px-0 py-0 border bg-white min-w-[80px]">
                            <input 
                              type="number" 
                              value={t1} 
                              min="0"
                              max={r.puestosObjetivo}
                              onChange={e => {
                                const val = Number(e.target.value);
                                const finalVal = Math.min(val, r.puestosObjetivo);
                                setEditablePuestosT1(p => ({...p, [key]: finalVal}));
                              }} 
                              className="w-full text-right px-3 py-3 font-bold text-indigo-600 outline-none h-full bg-transparent focus:bg-indigo-50" 
                            />
                          </td>
                          
                          <td className="px-0 py-0 border bg-white min-w-[80px]">
                            <input 
                              type="number" 
                              value={t2} 
                              min="0"
                              max={r.puestosObjetivo}
                              onChange={e => {
                                const val = Number(e.target.value);
                                const finalVal = Math.min(val, r.puestosObjetivo);
                                setEditablePuestosT2(p => ({...p, [key]: finalVal}));
                              }} 
                              className="w-full text-right px-3 py-3 font-bold text-indigo-600 outline-none h-full bg-transparent focus:bg-indigo-50" 
                            />
                          </td>
                          
                          <td className="px-4 py-3 text-right font-bold border text-green-700 bg-green-50/10">
                            {isMounted ? `${dispTime.toFixed(1)}h` : '-'}
                          </td>
                          <td className={cn("px-4 py-3 text-right font-bold border font-mono", deltaHours < 0 ? "text-red-600 bg-red-50" : deltaHours > 0 ? "text-green-600 bg-green-50" : "text-gray-400")}>
                            {isMounted ? (deltaHours > 0 ? `+${deltaHours.toFixed(2)}` : deltaHours.toFixed(2)) : '-'}
                          </td>
                          <td className="px-4 py-3 text-right font-bold border text-violet-700 bg-violet-50/10">
                            {isMounted ? `${ocupacion.toFixed(1)}%` : '-'}
                          </td>
                        </tr>
                      );
                    });
                  });
                  return items;
                })() : (
                  <tr><td colSpan={11} className="px-6 py-12 text-center text-gray-400 italic">Sin datos.</td></tr>
                )}
              </tbody>
              {summaryData.length > 0 && (
                <tfoot className="bg-gray-800 text-white font-bold text-[11px] sticky bottom-0">
                  <tr>
                    <td colSpan={4} className="px-4 py-3 text-right uppercase border-r border-gray-700">Total General:</td>
                    <td className="px-4 py-3 text-right font-mono border-r border-gray-700 text-purple-300">{grandTotals.totalCant.toLocaleString()}</td>
                    <td className="px-4 py-3 text-right font-mono border-r border-gray-700 text-indigo-300">{grandTotals.totalTime.toFixed(2)}</td>
                    <td className="px-4 py-3 text-right font-mono border-r border-gray-700 text-indigo-300">{grandTotals.totalT1}</td>
                    <td className="px-4 py-3 text-right font-mono border-r border-gray-700 text-indigo-300">{grandTotals.totalT2}</td>
                    <td className="px-4 py-3 text-right font-mono border-r border-gray-700 text-green-300">{isMounted ? `${grandTotals.totalDispTime.toFixed(1)}h` : '-'}</td>
                    <td className="px-4 py-3 text-right font-mono border-r border-gray-700 text-teal-300">{isMounted ? (grandTotals.totalDispTime - grandTotals.totalTime).toFixed(2) : '-'}h</td>
                    <td className="px-4 py-3 text-right text-violet-300">
                      {isMounted ? `${(grandTotals.totalDispTime > 0 ? (grandTotals.totalTime / grandTotals.totalDispTime) * 100 : 0).toFixed(1)}%` : '-'}
                    </td>
                  </tr>
                </tfoot>
              )}
            </table>
          </div>
        </div>
      </Tabs>

      <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 flex items-start gap-3">
        <AlertCircle className="w-5 h-5 text-blue-600 flex-shrink-0 mt-0.5" />
        <div className="text-xs text-blue-800 space-y-1">
          <p><b>Rendimientos Independientes:</b> Los factores "Rend L1", "Rend L2", etc., ahora se guardan de forma única para cada centro.</p>
          <p><b>Sincronización Día Prog:</b> Al cambiar la fecha en el <b>Centro 1000</b>, esta se replicará automáticamente en el <b>Centro 2000</b>.</p>
          <p><b>Validación de Puestos:</b> Los valores ingresados no pueden exceder los <b>Puestos Objetivo</b>.</p>
          <p><b>Persistencia:</b> Todos los ajustes se guardan automáticamente en el navegador.</p>
        </div>
      </div>
    </div>
  );
};
