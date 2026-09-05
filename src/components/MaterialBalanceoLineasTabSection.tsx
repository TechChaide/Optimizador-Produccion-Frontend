'use client';

import React, { useState, useEffect, useMemo } from 'react';
import {
  Plus,
  Trash2,
  LayoutGrid,
  Download,
  AlertCircle,
  Loader2,
  Home
} from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Checkbox } from '@/components/ui/checkbox';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { useToast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';
import * as XLSX from 'xlsx';
import { serviciosService } from '@/services/servicios.service';
import { materialesBalanceoService } from '@/services/materialesBalanceo.service';
import type { MaterialesBalanceoGrupo } from '@/types/interfaces';

interface MaterialBalanceoRow {
  id: string;
  codigoMaterialBalanceo?: number;
  material: string;
  descripcion: string;
  habilitado: boolean;
  minimo: number;
  maximo: number;
  cantPresupuesto: number;
  prioridad: number;
}

interface DisplayRow extends MaterialBalanceoRow {
  centro: string;
  linea: string;
  puestoTrabajo: string;
  tiempoMin: number;
  esFilaTecnica: boolean;
}

const STORAGE_KEY = 'material_balanceo_lineas_data';
const PRESUPUESTO_DATA_KEY = 'presupuesto_consolidado_data';
const EXPANDED_DATA_KEY = 'material_balanceo_expanded_data';

const CENTROS = ["1000", "2000"] as const;
type Centro = typeof CENTROS[number];

// Mapeo de equivalencias Máquina -> Línea (igual al usado en "Fert" y "Previsionales"): la Línea
// de un material se deriva de la Máquina de su orden Fert, no de patrones en Categoría.
const MAQUINA_LINEA_MAP: Record<string, string> = {
  'HR-ARM01': 'LINEA 1',
  'HR-ARM02': 'LINEA 2',
  'HR-ARM03': 'LINEA 3',
  'HR-ARM05': 'LINEA 5',
  'HR-ARM21': 'LINEA 1',
  'HR-ARM22': 'LINEA 2',
  'HR-ARM25': 'LINEA 5',
};

const INITIAL_DATA: MaterialBalanceoRow[] = [
  { id: '1', material: '20007201', descripcion: 'CHN ZAFIRO 135X190X029', habilitado: true, minimo: 0, maximo: 100, cantPresupuesto: 0, prioridad: 0 },
  { id: '2', material: '20004463', descripcion: 'CHN ZAFIRO 135X190X024', habilitado: true, minimo: 0, maximo: 100, cantPresupuesto: 0, prioridad: 0 },
  { id: '3', material: '20004462', descripcion: 'CHN ZAFIRO 105X190X024', habilitado: true, minimo: 0, maximo: 100, cantPresupuesto: 0, prioridad: 0 },
  { id: '4', material: '20007200', descripcion: 'CHN ZAFIRO 105X190X029', habilitado: true, minimo: 0, maximo: 100, cantPresupuesto: 0, prioridad: 0 },
  { id: '5', material: '20003642', descripcion: 'CHN IMPERIAL 31 135X190X31', habilitado: true, minimo: 0, maximo: 100, cantPresupuesto: 0, prioridad: 0 },
  { id: '6', material: '20006132', descripcion: 'CHN ALTERNATIVA ESPUMA 080X190X011', habilitado: false, minimo: 0, maximo: 100, cantPresupuesto: 0, prioridad: 0 },
  { id: '7', material: '20003275', descripcion: 'CHN ALTERNATIVA ESPUMA 080X190X015', habilitado: false, minimo: 0, maximo: 100, cantPresupuesto: 0, prioridad: 0 },
  { id: '8', material: '20006133', descripcion: 'CHN ALTERNATIVA ESPUMA 105X190X011', habilitado: false, minimo: 0, maximo: 100, cantPresupuesto: 0, prioridad: 0 },
  { id: '9', material: '20003277', descripcion: 'CHN ALTERNATIVA ESPUMA 105X190X015', habilitado: true, minimo: 0, maximo: 100, cantPresupuesto: 0, prioridad: 0 },
  { id: '10', material: '20006134', descripcion: 'CHN ALTERNATIVA ESPUMA 135X190X011', habilitado: true, minimo: 0, maximo: 100, cantPresupuesto: 0, prioridad: 0 },
  { id: '11', material: '20003278', descripcion: 'CHN ALTERNATIVA ESPUMA 135X190X015', habilitado: true, minimo: 0, maximo: 100, cantPresupuesto: 0, prioridad: 0 },
];

export const MaterialBalanceoLineasTabSection: React.FC = () => {
  const { toast } = useToast();
  const [rows, setRows] = useState<MaterialBalanceoRow[]>([]);
  const [technicalData, setTechnicalData] = useState<any[]>([]);
  const [presupuestoRefData, setPresupuestoRefData] = useState<any[]>([]);
  const [fertData, setFertData] = useState<any[]>([]);
  const [isLoaded, setIsLoaded] = useState(false);
  const [isLoadingTech, setIsLoadingTech] = useState(false);
  const [materialesBalanceoApi, setMaterialesBalanceoApi] = useState<MaterialesBalanceoGrupo[]>([]);
  const [activeCentroTab, setActiveCentroTab] = useState<Centro>("1000");

  const normalizeMaterialCode = (code: string | number): string => {
    return String(code || '').trim().slice(-8);
  };

  // Un material solo puede estar ingresado una vez: Línea y Puesto Trabajo se derivan siempre del
  // mismo Material (vía Fert/Tiempos), así que controlar duplicados de Material evita duplicar
  // la combinación Línea + Material + Puesto Trabajo en la tabla.
  const dedupeRowsByMaterial = (list: MaterialBalanceoRow[]): MaterialBalanceoRow[] => {
    const seen = new Set<string>();
    const result: MaterialBalanceoRow[] = [];
    list.forEach(r => {
      const norm = normalizeMaterialCode(r.material);
      if (!norm) {
        result.push(r);
        return;
      }
      if (seen.has(norm)) return;
      seen.add(norm);
      result.push(r);
    });
    return result;
  };

  // Cargar datos técnicos de la API
  const fetchTechnicalData = async () => {
    setIsLoadingTech(true);
    try {
      let allTiempos: any[] = [];
      let page = 1;
      let hasMore = true;
      const pageSize = 5000;

      while (hasMore && page <= 10) {
        const response = await serviciosService.getTiemposEnsamblado(page, pageSize);
        const raw = Array.isArray(response?.data) ? response.data : [];
        allTiempos = [...allTiempos, ...raw];
        if (raw.length < pageSize) hasMore = false; else page++;
      }
      setTechnicalData(allTiempos);
    } catch (error) {
      console.error('Error loading technical data:', error);
      toast({ title: "Error", description: "No se pudieron cargar los tiempos técnicos.", variant: "destructive" });
    } finally {
      setIsLoadingTech(false);
    }
  };

  // Cargar datos de Fert para vincular la columna "Línea" por coincidencia de Material
  const fetchFertData = async () => {
    try {
      let allFert: any[] = [];
      let page = 1;
      let hasMore = true;
      const pageSize = 5000;

      while (hasMore && page <= 10) {
        const response = await serviciosService.getOrdenesFert(page, pageSize);
        const raw = Array.isArray(response?.data) ? response.data : [];
        allFert = [...allFert, ...raw];
        if (raw.length < pageSize) hasMore = false; else page++;
      }
      setFertData(allFert);
    } catch (error) {
      console.error('Error loading Fert data:', error);
      toast({ title: "Error", description: "No se pudieron cargar los datos de Fert para vincular la Línea.", variant: "destructive" });
    }
  };

  // Cargar los materiales de balanceo configurados por grupo (vista de administración)
  const fetchMaterialesBalanceoApi = async () => {
    try {
      const response = await materialesBalanceoService.getAll();
      setMaterialesBalanceoApi((response.data || []) as MaterialesBalanceoGrupo[]);
    } catch (error) {
      console.error('Error loading materiales de balanceo:', error);
      toast({ title: "Error", description: "No se pudieron cargar los materiales de balanceo.", variant: "destructive" });
    }
  };

  // Cargar datos del localStorage al montar
  useEffect(() => {
    // 1. Cargar configuración de filas de balanceo
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored) {
      try {
        const parsed = JSON.parse(stored);
        const migrated = parsed.map((r: any) => ({
          ...r,
          minimo: r.minimo !== undefined ? r.minimo : 0,
          maximo: r.maximo !== undefined ? r.maximo : 100,
          cantPresupuesto: r.cantPresupuesto !== undefined ? r.cantPresupuesto : 0,
          prioridad: r.prioridad !== undefined ? r.prioridad : 0
        }));
        setRows(dedupeRowsByMaterial(migrated));
      } catch (e) {
        setRows(INITIAL_DATA);
      }
    } else {
      setRows(INITIAL_DATA);
    }

    // 2. Cargar datos del presupuesto consolidado para vinculación automática
    const presuDataRaw = localStorage.getItem(PRESUPUESTO_DATA_KEY);
    if (presuDataRaw) {
      try {
        setPresupuestoRefData(JSON.parse(presuDataRaw));
      } catch (e) {
        console.error('Error parsing presupuesto reference data:', e);
      }
    }

    setIsLoaded(true);
    fetchTechnicalData();
    fetchFertData();
    fetchMaterialesBalanceoApi();
  }, []);

  // Incorporar a la tabla los materiales de balanceo administrados desde Grupos
  useEffect(() => {
    if (!isLoaded || materialesBalanceoApi.length === 0) return;
    setRows(prevRows => {
      const existentesCodigo = new Set(prevRows.map(r => r.codigoMaterialBalanceo).filter((v): v is number => v !== undefined));
      const existentesMaterial = new Set(prevRows.map(r => normalizeMaterialCode(r.material)).filter(Boolean));
      const nuevas: MaterialBalanceoRow[] = materialesBalanceoApi
        .filter(m => !existentesCodigo.has(m.codigo_material_balanceo) && !existentesMaterial.has(normalizeMaterialCode(String(m.codigo_material))))
        .map(m => ({
          id: `api-${m.codigo_material_balanceo}`,
          codigoMaterialBalanceo: m.codigo_material_balanceo,
          material: String(m.codigo_material),
          descripcion: '',
          habilitado: m.estado === 'A',
          minimo: m.porc_minimo_balanceo,
          maximo: m.porc_maximo_balanceo,
          cantPresupuesto: 0,
          prioridad: (m as any).prioridad ?? 0,
        }));
      return nuevas.length > 0 ? dedupeRowsByMaterial([...prevRows, ...nuevas]) : prevRows;
    });
  }, [materialesBalanceoApi, isLoaded]);

  // Guardar datos en localStorage cuando cambian
  useEffect(() => {
    if (isLoaded) {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(rows));
    }
  }, [rows, isLoaded]);

  const handleAddRow = () => {
    const newRow: MaterialBalanceoRow = {
      id: Date.now().toString(),
      material: '',
      descripcion: '',
      habilitado: true,
      minimo: 0,
      maximo: 100,
      cantPresupuesto: 0,
      prioridad: 0
    };
    setRows([...rows, newRow]);
  };

  const handleRemoveRow = (id: string) => {
    setRows(rows.filter(r => r.id !== id));
  };

  const handleUpdateRow = (id: string, field: keyof MaterialBalanceoRow, value: any) => {
    if (field === 'material') {
      const norm = normalizeMaterialCode(value);
      if (norm) {
        const isDuplicate = rows.some(r => r.id !== id && normalizeMaterialCode(r.material) === norm);
        if (isDuplicate) {
          toast({
            title: "Material duplicado",
            description: `El material ${value} ya está ingresado. Cada material solo puede registrarse una vez.`,
            variant: "destructive"
          });
          return;
        }
      }
    }
    setRows(rows.map(r => r.id === id ? { ...r, [field]: value } : r));
  };

  // Mapa Material -> Línea construido desde la pestaña Fert (coincidencia únicamente por Material)
  const fertLineaByMaterial = useMemo(() => {
    const map = new Map<string, string>();
    fertData.forEach(f => {
      const matNorm = normalizeMaterialCode(f.MATERIAL);
      if (!matNorm || map.has(matNorm)) return;

      const maquina = String(f.MAQUINA || f.Maquina || f.maquina || '').trim().toUpperCase();
      const linea = MAQUINA_LINEA_MAP[maquina] || '';

      if (linea) map.set(matNorm, linea);
    });
    return map;
  }, [fertData]);

  // Mapa Centro+Material -> Prioridad/Mínimo/Máximo, tomado de la tabla "Materiales de Balanceo"
  // (administrada desde Grupos), filtrado al grupo "Ensamblado" y activo. Al estar indexado por
  // Centro, un mismo Material puede tener valores distintos en Centro 1000 y Centro 2000.
  const materialesBalanceoPorCentro = useMemo(() => {
    const map = new Map<string, { prioridad: number; minimo: number; maximo: number }>();
    materialesBalanceoApi.forEach((m: any) => {
      const grupo = m.grupo || m;
      const nombreGrupo = String(grupo?.nombre_grupo || '').toLowerCase();
      if (!nombreGrupo.includes('ensamblado')) return;
      if (m.estado !== 'A') return;

      const centro = String(grupo?.centro || '').trim();
      const materialNorm = normalizeMaterialCode(m.codigo_material);
      if (!centro || !materialNorm) return;

      map.set(`${centro}|${materialNorm}`, {
        prioridad: Number(m.prioridad ?? 0),
        minimo: Number(m.porc_minimo_balanceo ?? 0),
        maximo: Number(m.porc_maximo_balanceo ?? 0),
      });
    });
    return map;
  }, [materialesBalanceoApi]);

  // LÓGICA DE UNIÓN: Línea se resuelve por Material contra la pestaña Fert. Puesto Trabajo, Tiempo (min)
  // y Centro se resuelven contra la pestaña Tiempos, cruzando esa Línea junto con el Material; cada
  // puesto de trabajo encontrado para esa combinación Línea+Material genera su propia fila.
  const expandedRows = useMemo(() => {
    const results: DisplayRow[] = [];

    rows.forEach(baseRow => {
      const materialNorm = normalizeMaterialCode(baseRow.material);
      const linea = fertLineaByMaterial.get(materialNorm) || '-';

      // Buscar coincidencias en technicalData (Tiempos) por Línea + Material
      const matches = linea === '-' ? [] : technicalData.filter(tech =>
        normalizeMaterialCode(tech.CodMaterial) === materialNorm &&
        String(tech.Linea || '').trim().toUpperCase() === linea.toUpperCase()
      );

      if (matches.length > 0) {
        matches.forEach(match => {
          const centro = String(match.Centro || '').trim();

          // VINCULACIÓN DE PRESUPUESTO: Buscar coincidencia en los datos de la pestaña Presupuesto
          const presuMatch = presupuestoRefData.find(p =>
            normalizeMaterialCode(p.codigo_material) === materialNorm &&
            String(p.centro || '').trim() === centro &&
            String(p.linea_produccion || '').trim().toUpperCase() === linea.toUpperCase()
          );

          // Si hay coincidencia, el valor de Cant Presupuesto es "Cant. a Producir" del Presupuesto (prioridad automática)
          const cantPresupuestoFinal = presuMatch
            ? Number(presuMatch.cantidad_a_producir ?? 0)
            : baseRow.cantPresupuesto;

          // VINCULACIÓN DE PRIORIDAD/MÍNIMO/MÁXIMO: tomados de "Materiales de Balanceo" (grupo
          // Ensamblado) para este Centro puntual; si el material aún no está configurado ahí para
          // este Centro, se conserva el valor propio de la fila.
          const balanceoMatch = materialesBalanceoPorCentro.get(`${centro}|${materialNorm}`);

          results.push({
            ...baseRow,
            centro,
            linea,
            cantPresupuesto: cantPresupuestoFinal,
            puestoTrabajo: String(match.PuestoTrabajo || '-'),
            tiempoMin: Number(match.Tiempo_Min || 0),
            prioridad: balanceoMatch ? balanceoMatch.prioridad : baseRow.prioridad,
            minimo: balanceoMatch ? balanceoMatch.minimo : baseRow.minimo,
            maximo: balanceoMatch ? balanceoMatch.maximo : baseRow.maximo,
            esFilaTecnica: true
          });
        });
      } else {
        // Sin Línea (Fert) o sin coincidencia Línea+Material en Tiempos: no hay Centro que resolver
        results.push({
          ...baseRow,
          centro: '-',
          linea,
          puestoTrabajo: '-',
          tiempoMin: 0,
          esFilaTecnica: false
        });
      }
    });

    return results;
  }, [rows, technicalData, presupuestoRefData, fertLineaByMaterial, materialesBalanceoPorCentro]);

  // Publicar la relación Centro + Línea + Material + Puesto Trabajo -> Cant Presupuesto (y también
  // Mínimo/Máximo/Prioridad/Habilitado, propiedades del material) para que otras pestañas (Prog
  // Tiempos, Rev Cap Halb) puedan tomarlas directamente, diferenciadas por centro.
  useEffect(() => {
    if (!isLoaded) return;
    const linkData = expandedRows
      .filter(r => r.esFilaTecnica)
      .map(r => ({
        centro: String(r.centro || '').trim(),
        linea: String(r.linea || '').trim().toUpperCase(),
        material: normalizeMaterialCode(r.material),
        puestoTrabajo: String(r.puestoTrabajo || '').trim().toUpperCase().replace(/\s+/g, ' '),
        cantPresupuesto: Number(r.cantPresupuesto || 0),
        minimo: Number(r.minimo || 0),
        maximo: Number(r.maximo || 0),
        prioridad: Number(r.prioridad || 0),
        habilitado: !!r.habilitado
      }));
    localStorage.setItem(EXPANDED_DATA_KEY, JSON.stringify(linkData));
  }, [expandedRows, isLoaded]);

  // Separa las filas expandidas ESTRICTAMENTE por el valor de la columna Centro (1000 o 2000).
  // Cada fila pertenece a un único centro: nada se duplica entre sub-pestañas.
  const rowsByCentro = useMemo(() => {
    const result: Record<Centro, DisplayRow[]> = { "1000": [], "2000": [] };
    expandedRows.forEach(row => {
      if (row.centro === '1000' || row.centro === '2000') {
        result[row.centro].push(row);
      }
    });
    return result;
  }, [expandedRows]);

  // Filas cuyo material aún no coincide con ningún dato técnico (Centro = "-"): no pertenecen a ningún
  // centro todavía, por lo que se muestran aparte para poder seguir editándolas.
  const pendingRows = useMemo(() => expandedRows.filter(row => row.centro === '-'), [expandedRows]);

  const handleExport = () => {
    const dataToExport = expandedRows.map(r => ({
      'Centro': r.centro,
      'Línea': r.linea,
      'Material': r.material,
      'Descripción': r.descripcion,
      'Puesto Trabajo': r.puestoTrabajo,
      'Tiempo (min)': r.tiempoMin,
      'Habilitado': r.habilitado ? 'SI' : 'NO',
      'Cant Presupuesto': r.cantPresupuesto,
      'Mínimo (%)': r.minimo,
      'Máximo (%)': r.maximo
    }));

    const ws = XLSX.utils.json_to_sheet(dataToExport);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Materiales Balanceo");
    XLSX.writeFile(wb, "Material_Balanceo_Con_Puestos.xlsx");
    
    toast({ title: "Éxito", description: "Plan de balanceo exportado a Excel." });
  };

  const renderTable = (rowsForCentro: DisplayRow[]) => (
    <Card className="border shadow-sm overflow-hidden">
      <CardContent className="p-0">
        <div className="overflow-x-auto max-h-[70vh]">
          <table className="min-w-full divide-y divide-gray-200 text-xs">
            <thead className="bg-gray-50 sticky top-0 z-10">
              <tr>
                <th className="px-4 py-3 text-left font-bold text-gray-600 uppercase tracking-wider w-24 border-r">Centro</th>
                <th className="px-4 py-3 text-left font-bold text-gray-600 uppercase tracking-wider w-32 border-r">Línea</th>
                <th className="px-4 py-3 text-left font-bold text-gray-600 uppercase tracking-wider w-40 border-r">Material</th>
                <th className="px-4 py-3 text-left font-bold text-gray-600 uppercase tracking-wider border-r">Descripción</th>
                <th className="px-4 py-3 text-left font-bold text-indigo-700 uppercase tracking-wider border-r bg-indigo-50/20">Puesto Trabajo</th>
                <th className="px-4 py-3 text-right font-bold text-indigo-700 uppercase tracking-wider border-r bg-indigo-50/20">tiempo (min)</th>
                <th className="px-4 py-3 text-center font-bold text-violet-700 uppercase tracking-wider w-24 border-r bg-violet-50/20">Prioridad</th>
                <th className="px-4 py-3 text-center font-bold text-gray-600 uppercase tracking-wider w-24 border-r">Habilitado</th>
                <th className="px-4 py-3 text-center font-bold text-gray-600 uppercase tracking-wider w-16 border-r">Acción</th>
                <th className="px-4 py-3 text-center font-bold text-indigo-700 uppercase tracking-wider w-24 border-r bg-indigo-50/30">Cant Presupuesto</th>
                <th className="px-4 py-3 text-center font-bold text-indigo-700 uppercase tracking-wider w-24 border-r bg-indigo-50/30">Mínimo (%)</th>
                <th className="px-4 py-3 text-center font-bold text-indigo-700 uppercase tracking-wider w-24 bg-indigo-50/30">Máximo (%)</th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {isLoadingTech && rowsForCentro.length === 0 ? (
                <tr>
                  <td colSpan={12} className="px-6 py-12 text-center text-gray-400">
                    <div className="flex flex-col items-center gap-2">
                      <Loader2 className="w-8 h-8 animate-spin text-indigo-500" />
                      <span>Sincronizando información técnica de puestos...</span>
                    </div>
                  </td>
                </tr>
              ) : rowsForCentro.map((row, idx) => (
                <tr key={`${row.id}-${idx}`} className={cn("hover:bg-gray-50 transition-colors", !row.habilitado && "bg-gray-50/50 opacity-70")}>
                  <td className="px-4 py-1.5 border-r font-bold text-gray-700">
                    {row.centro}
                  </td>
                  <td className="px-4 py-1.5 border-r font-bold text-gray-700">
                    {row.linea}
                  </td>
                  <td className="px-2 py-1.5 border-r">
                    <Input
                      value={row.material}
                      onChange={(e) => handleUpdateRow(row.id, 'material', e.target.value)}
                      placeholder="Código SAP"
                      className="h-8 text-xs border-none shadow-none focus-visible:ring-1 focus-visible:ring-indigo-500 font-mono"
                    />
                  </td>
                  <td className="px-2 py-1.5 border-r">
                    <Input
                      value={row.descripcion}
                      onChange={(e) => handleUpdateRow(row.id, 'descripcion', e.target.value.toUpperCase())}
                      placeholder="Descripción del material"
                      className="h-8 text-xs border-none shadow-none focus-visible:ring-1 focus-visible:ring-indigo-500"
                    />
                  </td>
                  <td className="px-4 py-1.5 border-r font-medium text-indigo-800 bg-indigo-50/10">
                    {row.puestoTrabajo}
                  </td>
                  <td className="px-4 py-1.5 border-r text-right font-mono font-bold text-indigo-700 bg-indigo-50/10">
                    {row.tiempoMin > 0 ? row.tiempoMin.toLocaleString(undefined, { minimumFractionDigits: 3 }) : '-'}
                  </td>
                  <td className="px-2 py-1.5 border-r text-center bg-violet-50/5">
                    {row.esFilaTecnica ? (
                      <span className="font-bold text-violet-700">{row.prioridad}</span>
                    ) : (
                      <select
                        value={row.prioridad}
                        onChange={(e) => handleUpdateRow(row.id, 'prioridad', Number(e.target.value))}
                        className="h-8 text-xs text-center border-none shadow-none bg-transparent focus:ring-1 focus:ring-indigo-500 font-bold text-violet-700 rounded"
                      >
                        {[0, 1, 2, 3, 4, 5].map(v => <option key={v} value={v}>{v}</option>)}
                      </select>
                    )}
                  </td>
                  <td className="px-2 py-1.5 border-r text-center">
                    <div className="flex items-center justify-center">
                      <Checkbox
                        checked={row.habilitado}
                        onCheckedChange={(val) => handleUpdateRow(row.id, 'habilitado', !!val)}
                        className="h-5 w-5 data-[state=checked]:bg-indigo-600"
                      />
                    </div>
                  </td>
                  <td className="px-2 py-1.5 border-r text-center">
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => handleRemoveRow(row.id)}
                      className="h-8 w-8 text-red-400 hover:text-red-700 hover:bg-red-50"
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </td>
                  <td className="px-4 py-1.5 border-r text-center font-mono font-bold text-indigo-700 bg-indigo-50/10">
                    {Number(row.cantPresupuesto || 0).toLocaleString()}
                  </td>
                  <td className="px-2 py-1.5 border-r text-center bg-indigo-50/5">
                    {row.esFilaTecnica ? (
                      <span className="font-bold text-indigo-700">{row.minimo}</span>
                    ) : (
                      <Input
                        type="number"
                        value={row.minimo}
                        onChange={(e) => handleUpdateRow(row.id, 'minimo', Number(e.target.value))}
                        className="h-8 text-xs text-center border-none shadow-none focus-visible:ring-1 focus-visible:ring-indigo-500 font-bold text-indigo-700"
                      />
                    )}
                  </td>
                  <td className="px-2 py-1.5 text-center bg-indigo-50/5">
                    {row.esFilaTecnica ? (
                      <span className="font-bold text-indigo-700">{row.maximo}</span>
                    ) : (
                      <Input
                        type="number"
                        value={row.maximo}
                        onChange={(e) => handleUpdateRow(row.id, 'maximo', Number(e.target.value))}
                        className="h-8 text-xs text-center border-none shadow-none focus-visible:ring-1 focus-visible:ring-indigo-500 font-bold text-indigo-700"
                      />
                    )}
                  </td>
                </tr>
              ))}
              {rowsForCentro.length === 0 && !isLoadingTech && (
                <tr>
                  <td colSpan={12} className="px-6 py-12 text-center text-gray-400 italic">
                    No hay materiales configurados para este centro. Haga clic en "Añadir Línea" para comenzar.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </CardContent>
    </Card>
  );

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex items-center space-x-3">
          <LayoutGrid className="w-6 h-6 text-indigo-600" />
          <div>
            <h3 className="text-xl font-semibold text-gray-800">Material Balanceo Líneas</h3>
            <p className="text-xs text-gray-500">Configuración técnica y límites porcentuales por puesto de trabajo</p>
          </div>
        </div>
        
        <div className="flex gap-2">
          <Button onClick={handleAddRow} size="sm" className="bg-indigo-600 hover:bg-indigo-700">
            <Plus className="w-4 h-4 mr-2" /> Añadir Línea
          </Button>
          <Button onClick={handleExport} variant="outline" size="sm" className="border-green-600 text-green-700 hover:bg-green-50">
            <Download className="w-4 h-4 mr-2" /> Exportar Excel
          </Button>
        </div>
      </div>

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

        <TabsContent value="1000">{renderTable(rowsByCentro["1000"])}</TabsContent>
        <TabsContent value="2000">{renderTable(rowsByCentro["2000"])}</TabsContent>
      </Tabs>

      {pendingRows.length > 0 && (
        <div className="space-y-2">
          <p className="text-[10px] font-bold text-amber-600 uppercase tracking-wider flex items-center gap-1">
            <AlertCircle className="w-3 h-3" /> Materiales sin vincular a un centro (pendientes de datos técnicos)
          </p>
          {renderTable(pendingRows)}
        </div>
      )}

      <div className="flex items-center gap-2 p-3 bg-blue-50 border border-blue-200 rounded-lg text-blue-800">
        <AlertCircle className="w-4 h-4 flex-shrink-0" />
        <p className="text-xs">
          <b>Nota:</b> La columna <b>Línea</b> se vincula automáticamente por coincidencia de Material contra la pestaña Fert.
          Los valores de <b>Cant Presupuesto</b> toman el dato de <b>Cant. a Producir</b> de la pestaña Presupuesto, sincronizado automáticamente basándose en la coincidencia de Centro, Línea y Material.
          Los valores de <b>Prioridad</b>, <b>Mínimo (%)</b> y <b>Máximo (%)</b> se toman de la tabla <b>Materiales de Balanceo</b> del grupo Ensamblado, diferenciados por Centro (un mismo material puede tener valores distintos en Centro 1000 y 2000); mientras el material no tenga configuración en esa tabla para el Centro resuelto, esos campos quedan editables manualmente.
        </p>
      </div>
    </div>
  );
};
