'use client';

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import * as XLSX from 'xlsx';
import { BedDouble, ChevronDown, ChevronRight, Download, Eraser, FileSpreadsheet, Loader2, RefreshCw, TriangleAlert, Upload, Wand2 } from 'lucide-react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Table, TableBody, TableCell, TableFooter, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { useAppContext } from '@/context/AppProvider';
import { sapCompartido } from '@/lib/datos-sap-compartidos';
import { serviciosService } from '@/services/servicios.service';
import { addBusinessDays } from '@/lib/dias-laborables';
import { cn } from '@/lib/utils';
import {
  FERT_FORRO_ALMOHADA_EXCEL,
  FORROS_ALMOHADA_EXCEL,
  TALLERES_ALMOHADA_EXCEL,
  type ForroAlmohadaMaestro,
  type TapaAlmohada,
} from '@/data/almohadasForrosExcel';
import { distribuirPedido, normalizarTela, resumenPorTaller, PARAMETROS_DISTRIBUCION_DEFECTO, type Asignacion, type ForroDistribucion } from '@/lib/almohadas-distribucion';
import { leerExcelValidacion, type ExcelValidacion, type ValoresExcelForro } from '@/lib/almohadas-validacion-excel';
import {
  ALMACEN_FORROS_ALMOHADA,
  ALMACENES_LEIDOS,
  almacenesDeForro,
  claveAlmacen,
  sumarAlmacenes,
  CENTRO_ALMOHADAS,
  PARAMETROS_SS_PP_DEFECTO,
  calcularReposicion,
  calcularSsPp,
  type MovimientoForro,
  type ParametrosSsPp,
  type ResultadoReposicion,
  type ResultadoSsPp,
} from '@/lib/almohadas-reposicion';

type Fila = Record<string, unknown>;

const getProp = (obj: Fila | null | undefined, keys: string[]): string => {
  if (!obj) return '';
  const rowKeys = Object.keys(obj);
  for (const k of keys) {
    const found = rowKeys.find(rk => rk.toLowerCase().trim() === k.toLowerCase().trim());
    if (found && obj[found] !== null && obj[found] !== undefined) return String(obj[found]).trim();
  }
  return '';
};
const num = (v: unknown): number => {
  const n = Number(String(v ?? '').replace(/,/g, ''));
  return Number.isFinite(n) ? n : 0;
};
const limpiarCodigo = (v: unknown): string => String(v ?? '').trim().replace(/\.0$/, '').replace(/^0+/, '');

// 'yyyy-MM-dd' desde ISO, dd/mm/yyyy o dd.mm.yyyy (SAP); '' si no se reconoce.
const fechaISO = (raw: unknown): string => {
  if (raw instanceof Date && !isNaN(raw.getTime())) {
    return `${raw.getFullYear()}-${String(raw.getMonth() + 1).padStart(2, '0')}-${String(raw.getDate()).padStart(2, '0')}`;
  }
  const s = String(raw ?? '').trim();
  const iso = s.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (iso) return `${iso[1]}-${iso[2]}-${iso[3]}`;
  const dmy = s.match(/^(\d{1,2})[/.](\d{1,2})[/.](\d{4})/);
  return dmy ? `${dmy[3]}-${dmy[2].padStart(2, '0')}-${dmy[1].padStart(2, '0')}` : '';
};
const aFecha = (iso: string): Date | null => {
  const m = iso.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  return m ? new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3])) : null;
};
const filasDe = (r: unknown): Fila[] => {
  const cuerpo = r as { data?: unknown } | null | undefined;
  const data = cuerpo?.data as { data?: unknown } | unknown[] | undefined;
  if (Array.isArray(data)) return data as Fila[];
  const anidado = (data as { data?: unknown } | undefined)?.data;
  return Array.isArray(anidado) ? (anidado as Fila[]) : [];
};

const fmt = (v: number, dec = 0): string =>
  v.toLocaleString('es-EC', { minimumFractionDigits: dec, maximumFractionDigits: dec });

const PRIORIDAD_ORDEN: Record<string, number> = { A: 0, B: 1, C: 2 };
const claseprioridad = (p: string | null): string =>
  p === 'A' ? 'bg-red-100 text-red-700 border-red-200'
    : p === 'B' ? 'bg-amber-100 text-amber-700 border-amber-200'
      : p === 'C' ? 'bg-emerald-100 text-emerald-700 border-emerald-200'
        : 'bg-gray-100 text-gray-500 border-gray-200';

interface OrdenForro {
  orden: string;
  fert: string;
  descripcionFert: string;
  fecha: string;
  cantidad: number;
  porBom: boolean;
}

interface ForroCalculado {
  maestro: ForroAlmohadaMaestro;
  ordenes: OrdenForro[];
  necesidad: number;
  stock: number;
  transito: number;
  ssPp: ResultadoSsPp | null;
  rep: ResultadoReposicion;
  pedidoFinal: number;
  loteMin: number;
  loteMax: number;
  loteCalculado: boolean;
  tapa: TapaAlmohada | undefined;
  tapaPorBom: boolean;
  ppManual: boolean;
  ssManual: boolean;
}

type ComponenteForro = { forro: string; factor: number };

// FERT → forros del Excel (1 forro por almohada).
const FORROS_POR_FERT = (() => {
  const m = new Map<string, ComponenteForro[]>();
  FERT_FORRO_ALMOHADA_EXCEL.forEach(([fert, forro]) => {
    const lista = m.get(fert) ?? [];
    if (!lista.some(c => c.forro === forro)) lista.push({ forro, factor: 1 });
    m.set(fert, lista);
  });
  return m;
})();

// Lote cuando el Excel no lo trae: misma fórmula del Excel (CALCULO SS-PP, BJ y BP):
// mínimo = EVEN(consumo semanal ÷ 2.5 × 5), máximo = mínimo × 1.5.
const loteDe = (m: ForroAlmohadaMaestro, ssPp: ResultadoSsPp | null) => {
  if ((m.loteMin ?? 0) > 0) return { loteMin: m.loteMin!, loteMax: m.loteMax || m.loteMin! * 1.5, loteCalculado: false };
  const semanal = ssPp?.consumoSemanal ?? 0;
  if (semanal <= 0) return { loteMin: 0, loteMax: 0, loteCalculado: false };
  const min = Math.ceil((semanal / 2.5) * 5 / 2) * 2;
  return { loteMin: min, loteMax: min * 1.5, loteCalculado: true };
};

// Explosión BOM (centro 1000) e hijos directos de un material.
const hijosBom = async (material: string): Promise<Fila[]> => {
  const r = await serviciosService.getMaestroMaterialesExplosion(CENTRO_ALMOHADAS, material.padStart(18, '0'), 1, 500);
  const filas = filasDe(r);
  const directos = filas.filter(f => limpiarCodigo(getProp(f, ['MATERIAL_PADRE'])) === material);
  return directos.length ? directos : filas.filter(f => getProp(f, ['NIVEL']) === '1');
};
const descComponente = (f: Fila) => getProp(f, ['DESCRIPCION_COMPONENTE', 'DESCRIPCION']).toUpperCase();

const iguales = (app: number, excel: number) => Math.abs(app - excel) <= Math.max(1, Math.abs(excel) * 0.01);

const CLAVE_ASIGNACION = 'almohadas-subcontratacion:';
const leerAsignacion = (fechaCorte: string): Asignacion => {
  try {
    const raw = localStorage.getItem(CLAVE_ASIGNACION + fechaCorte);
    return raw ? (JSON.parse(raw) as Asignacion) : {};
  } catch {
    return {};
  }
};
// Personas y peso por taller (filas 7 y 6 del PLAN SUBCONTRATACIÓN); editables, se recuerdan en el navegador.
type CapacidadTalleres = Record<string, { personas: number; peso: number }>;
const CLAVE_CAPACIDAD = 'almohadas-subcontratacion-capacidad';
const CAPACIDAD_EXCEL: CapacidadTalleres = Object.fromEntries(TALLERES_ALMOHADA_EXCEL.map(t => [t.nombre, { personas: t.personas, peso: t.peso }]));
const leerCapacidad = (): CapacidadTalleres => {
  try {
    const raw = localStorage.getItem(CLAVE_CAPACIDAD);
    return raw ? { ...CAPACIDAD_EXCEL, ...(JSON.parse(raw) as CapacidadTalleres) } : CAPACIDAD_EXCEL;
  } catch {
    return CAPACIDAD_EXCEL;
  }
};
const guardarCapacidad = (c: CapacidadTalleres) => {
  try {
    localStorage.setItem(CLAVE_CAPACIDAD, JSON.stringify(c));
  } catch {
    /* sin almacenamiento local */
  }
};
const guardarAsignacion = (fechaCorte: string, a: Asignacion) => {
  try {
    localStorage.setItem(CLAVE_ASIGNACION + fechaCorte, JSON.stringify(a));
  } catch {
    /* sin almacenamiento local: la asignación vive solo en la sesión */
  }
};

// Pedidos de compra abiertos (export ME2N, mismas columnas que la hoja "PED COMPRAS"): Material,
// Almacén, Por entregar (cantidad). Se guardan por material + almacén (1014 y 1015; sin columna de
// almacén = 1014); cada forro suma los suyos (almacenesDeForro).
const leerMe2n = async (archivo: File): Promise<{ porMaterial: Map<string, number>; filas: number }> => {
  const wb = XLSX.read(await archivo.arrayBuffer(), { type: 'array', cellDates: true });
  const porMaterial = new Map<string, number>();
  let filas = 0;
  wb.SheetNames.forEach(nombre => {
    const rows = XLSX.utils.sheet_to_json<Fila>(wb.Sheets[nombre], { defval: '' });
    rows.forEach(r => {
      const material = limpiarCodigo(getProp(r, ['Material', 'MATERIAL']));
      const pendiente = num(getProp(r, ['Por entregar (cantidad)', 'Por entregar', 'CANT PENDIENTE', 'Cantidad pendiente']));
      if (!material || pendiente <= 0) return;
      const almacen = limpiarCodigo(getProp(r, ['Almacén', 'Almacen', 'ALMACEN'])) || ALMACEN_FORROS_ALMOHADA;
      if (!ALMACENES_LEIDOS.includes(almacen)) return;
      const clave = claveAlmacen(material, almacen);
      porMaterial.set(clave, (porMaterial.get(clave) ?? 0) + pendiente);
      filas++;
    });
  });
  return { porMaterial, filas };
};

// Movimientos 261 (consumo, cantidad negativa en SAP) y 262 (reversa) de un forro.
const descargarConsumos = async (codigo: string): Promise<MovimientoForro[]> => {
  const r = await serviciosService.getConsumosFormulado(codigo);
  return filasDe(r).flatMap(f => {
    const mov = getProp(f, ['Movimiento', 'MOVIMIENTO']);
    if (mov !== '261' && mov !== '262') return [];
    const fecha = aFecha(fechaISO(getProp(f, ['Fecha', 'FECHA'])));
    return fecha ? [{ fecha, cantidad: -num(getProp(f, ['Cantidad', 'CANTIDAD'])) }] : [];
  });
};

const enParalelo = async <T, R>(items: T[], limite: number, fn: (x: T) => Promise<R>, onAvance: (n: number) => void): Promise<R[]> => {
  const salida: R[] = new Array(items.length);
  let siguiente = 0;
  let hechos = 0;
  const trabajador = async () => {
    while (siguiente < items.length) {
      const i = siguiente++;
      salida[i] = await fn(items[i]);
      onAvance(++hechos);
    }
  };
  await Promise.all(Array.from({ length: Math.min(limite, items.length) }, trabajador));
  return salida;
};

const exportarExcel = (nombre: string, hojas: Record<string, Fila[]>) => {
  const wb = XLSX.utils.book_new();
  Object.entries(hojas).forEach(([hoja, filas]) => XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(filas), hoja.slice(0, 31)));
  XLSX.writeFile(wb, nombre);
};

const METRICAS_VALIDACION: { clave: string; etiqueta: string; app: (f: ForroCalculado) => number; excel: (x: ValoresExcelForro) => number }[] = [
  { clave: 'nec', etiqueta: 'Necesidad', app: f => f.necesidad, excel: x => x.necesidad },
  { clave: 'stock', etiqueta: 'Stock 1014', app: f => f.stock, excel: x => x.stock },
  { clave: 'tr', etiqueta: 'Tránsito', app: f => f.transito, excel: x => x.transito },
  { clave: 'sem', etiqueta: 'Cons. semanal', app: f => f.ssPp?.consumoSemanal ?? 0, excel: x => x.consumoSemanal },
  { clave: 'diario', etiqueta: 'Cons. diario', app: f => f.ssPp?.consumoDiario ?? 0, excel: x => x.consumoDiario },
  { clave: 'ss', etiqueta: 'SS', app: f => f.ssPp?.ss ?? 0, excel: x => x.ss },
  { clave: 'pp', etiqueta: 'PP', app: f => f.ssPp?.pp ?? 0, excel: x => x.pp },
  { clave: 'ppss', etiqueta: 'PP/SS', app: f => f.rep.ppss, excel: x => x.ppss },
  { clave: 'sf', etiqueta: 'Stock final', app: f => f.rep.stockFinal, excel: x => x.stockFinal },
  { clave: 'lote', etiqueta: 'Lote mín', app: f => f.loteMin, excel: x => x.loteMin },
  { clave: 'ped', etiqueta: 'Pedido', app: f => f.rep.pedido, excel: x => x.pedido },
];

const fechaCorteDefecto = (): string => fechaISO(addBusinessDays(new Date(), PARAMETROS_SS_PP_DEFECTO.leadTimeDias));

export const TacticalPlanAlmohadasSection: React.FC = () => {
  const { addNotification } = useAppContext();
  const [tab, setTab] = useState('necesidad');
  const [fechaCorte, setFechaCorte] = useState(fechaCorteDefecto);
  const [params, setParams] = useState<ParametrosSsPp>(PARAMETROS_SS_PP_DEFECTO);

  const [fertRows, setFertRows] = useState<Fila[]>([]);
  const [invRows, setInvRows] = useState<Fila[]>([]);
  const [consumos, setConsumos] = useState<Map<string, MovimientoForro[]>>(new Map());
  const [consumosFallidos, setConsumosFallidos] = useState<string[]>([]);
  const [transito, setTransito] = useState<Map<string, number>>(new Map());
  const [archivoMe2n, setArchivoMe2n] = useState<{ nombre: string; filas: number } | null>(null);
  const [cargando, setCargando] = useState(false);
  const [avance, setAvance] = useState<{ etapa: string; n: number; total: number } | null>(null);
  const [sincronizadoEn, setSincronizadoEn] = useState<Date | null>(null);

  const [expandidos, setExpandidos] = useState<Set<string>>(new Set());
  const [verSinMapear, setVerSinMapear] = useState(false);
  const [soloConPedido, setSoloConPedido] = useState(true);
  const [pedidoManual, setPedidoManual] = useState<Record<string, number>>({});
  const [asignacion, setAsignacion] = useState<Asignacion>({});
  const [capacidad, setCapacidad] = useState<CapacidadTalleres>(CAPACIDAD_EXCEL);
  const [paramDist, setParamDist] = useState(PARAMETROS_DISTRIBUCION_DEFECTO);
  const inputMe2nRef = useRef<HTMLInputElement>(null);

  // Huecos del Excel completados por BOM: FERT de almohadas sin forro, forros nuevos y tapas.
  const [forrosPorFertBom, setForrosPorFertBom] = useState<Map<string, ComponenteForro[]>>(new Map());
  const [forrosExtra, setForrosExtra] = useState<ForroAlmohadaMaestro[]>([]);
  const [tapasBom, setTapasBom] = useState<Map<string, TapaAlmohada>>(new Map());

  // Validación contra el Excel.
  const [baseCantidad, setBaseCantidad] = useState<'pendiente' | 'programada'>('pendiente');
  const [excelVal, setExcelVal] = useState<ExcelValidacion | null>(null);
  const [soloDiferencias, setSoloDiferencias] = useState(false);
  const [transitoOrigen, setTransitoOrigen] = useState<'me2n' | 'excel' | null>(null);
  const inputValRef = useRef<HTMLInputElement>(null);

  const maestros = useMemo(() => [...FORROS_ALMOHADA_EXCEL, ...forrosExtra], [forrosExtra]);

  useEffect(() => {
    setAsignacion(leerAsignacion(fechaCorte));
  }, [fechaCorte]);
  useEffect(() => {
    setCapacidad(leerCapacidad());
  }, []);

  const sincronizar = useCallback(async () => {
    setCargando(true);
    try {
      setAvance({ etapa: 'Órdenes FERT e inventario', n: 0, total: 2 });
      const [fert, inv] = await Promise.all([sapCompartido.ordenesFert(), sapCompartido.inventarioAnioActual()]);
      const filasFert = filasDe(fert);
      setFertRows(filasFert);
      setInvRows(filasDe(inv));

      // FERT de almohadas que el Excel no relaciona con un forro → forros hijos en la BOM.
      const fertsSinForro = Array.from(new Set(filasFert.flatMap(o => {
        const centro = getProp(o, ['CENTRO']);
        if (centro && centro !== CENTRO_ALMOHADAS) return [];
        if (!getProp(o, ['SECTORDESC', 'SECTOR']).toUpperCase().includes('ALMOHADA')) return [];
        const fert = limpiarCodigo(getProp(o, ['MATERIAL', 'CODIGOMATERIAL']));
        return fert && !FORROS_POR_FERT.has(fert) ? [fert] : [];
      })));
      const mapaBom = new Map<string, ComponenteForro[]>();
      const nuevos = new Map<string, ForroAlmohadaMaestro>();
      const codigosSeed = new Set(FORROS_ALMOHADA_EXCEL.map(f => f.codigo));
      if (fertsSinForro.length) {
        setAvance({ etapa: 'BOM FERT sin forro', n: 0, total: fertsSinForro.length });
        await enParalelo(fertsSinForro, 6, async fert => {
          try {
            const comps = (await hijosBom(fert)).filter(f => descComponente(f).startsWith('FORRO'));
            const lista = comps.map(f => ({ forro: limpiarCodigo(getProp(f, ['COMPONENTE'])), factor: num(getProp(f, ['CANTIDAD_UNITARIA'])) || 1 }))
              .filter(c => c.forro);
            if (lista.length) mapaBom.set(fert, lista);
            comps.forEach(f => {
              const c = limpiarCodigo(getProp(f, ['COMPONENTE']));
              if (c && !codigosSeed.has(c) && !nuevos.has(c)) {
                nuevos.set(c, { codigo: c, descripcion: getProp(f, ['DESCRIPCION_COMPONENTE', 'DESCRIPCION']), prioridad: null, tela: '' });
              }
            });
          } catch { /* sin BOM: queda en "sin forro" */ }
        }, n => setAvance({ etapa: 'BOM FERT sin forro', n, total: fertsSinForro.length }));
      }
      setForrosPorFertBom(mapaBom);
      setForrosExtra(Array.from(nuevos.values()));

      // Tapas que el Excel no trae → hijos "TAPA..." del forro en la BOM.
      const todos = [...FORROS_ALMOHADA_EXCEL, ...nuevos.values()];
      const sinTapa = todos.filter(f => !f.tapa).map(f => f.codigo);
      const tapas = new Map<string, TapaAlmohada>();
      if (sinTapa.length) {
        setAvance({ etapa: 'BOM tapas', n: 0, total: sinTapa.length });
        await enParalelo(sinTapa, 6, async forro => {
          try {
            const t = (await hijosBom(forro)).find(f => descComponente(f).startsWith('TAPA'));
            if (t) {
              tapas.set(forro, {
                codigo: limpiarCodigo(getProp(t, ['COMPONENTE'])),
                descripcion: getProp(t, ['DESCRIPCION_COMPONENTE', 'DESCRIPCION']),
                tapasPorForro: num(getProp(t, ['CANTIDAD_UNITARIA'])) || 1,
                tela: '', color: '', capas: 0, undPorCapa: 0,
              });
            }
          } catch { /* sin BOM */ }
        }, n => setAvance({ etapa: 'BOM tapas', n, total: sinTapa.length }));
      }
      setTapasBom(tapas);

      const codigos = todos.map(f => f.codigo);
      const fallidos: string[] = [];
      setAvance({ etapa: 'Consumos MB51', n: 0, total: codigos.length });
      const resultados = await enParalelo(
        codigos,
        6,
        async c => {
          try {
            return [c, await descargarConsumos(c)] as const;
          } catch {
            fallidos.push(c);
            return [c, [] as MovimientoForro[]] as const;
          }
        },
        n => setAvance({ etapa: 'Consumos MB51', n, total: codigos.length }),
      );
      setConsumos(new Map(resultados));
      setConsumosFallidos(fallidos);
      setSincronizadoEn(new Date());
      if (fallidos.length) addNotification('warning', `Sin consumos MB51 para ${fallidos.length} forros.`);
    } catch (e) {
      addNotification('error', `Error al sincronizar Almohadas: ${(e as Error).message}`);
    } finally {
      setCargando(false);
      setAvance(null);
    }
  }, [addNotification]);

  useEffect(() => {
    void sincronizar();
  }, [sincronizar]);

  const cargarMe2n = async (archivo: File | undefined) => {
    if (!archivo) return;
    try {
      const { porMaterial, filas } = await leerMe2n(archivo);
      setTransito(porMaterial);
      setTransitoOrigen('me2n');
      setArchivoMe2n({ nombre: archivo.name, filas });
      addNotification('success', `ME2N cargado: ${filas} posiciones abiertas (1014/1015).`);
    } catch (e) {
      addNotification('error', `No se pudo leer el archivo ME2N: ${(e as Error).message}`);
    } finally {
      if (inputMe2nRef.current) inputMe2nRef.current.value = '';
    }
  };

  // ---------------- Paso 1: necesidad por forro ----------------
  const { ordenesPorForro, sinMapear } = useMemo(() => {
    const porForro = new Map<string, OrdenForro[]>();
    const sinMapearMap = new Map<string, { fert: string; descripcion: string; cantidad: number; ordenes: number }>();
    fertRows.forEach(o => {
      const centro = getProp(o, ['CENTRO']);
      if (centro && centro !== CENTRO_ALMOHADAS) return;
      const fecha = fechaISO(getProp(o, ['FECHA', 'FECHAINICIO', 'FECHA_INICIO']));
      if (!fecha || fecha > fechaCorte) return;
      // El Excel suma CANTPROGRAMADA; "pendiente" descuenta lo ya entregado.
      const pendienteTxt = getProp(o, ['CANTPENDIENTE', 'CANT_PEND']);
      const programada = num(getProp(o, ['CANTPROGRAMADA', 'CANTIDAD']));
      const cantidad = baseCantidad === 'programada' || pendienteTxt === '' ? programada : num(pendienteTxt);
      if (cantidad <= 0) return;
      const fert = limpiarCodigo(getProp(o, ['MATERIAL', 'CODIGOMATERIAL']));
      const descripcionFert = getProp(o, ['NOMBRE', 'DESCRIPCION', 'TEXTO']);
      const porBom = !FORROS_POR_FERT.has(fert);
      const forros = FORROS_POR_FERT.get(fert) ?? forrosPorFertBom.get(fert);
      if (!forros) {
        const sector = getProp(o, ['SECTORDESC', 'SECTOR']).toUpperCase();
        if (sector.includes('ALMOHADA')) {
          const previo = sinMapearMap.get(fert) ?? { fert, descripcion: descripcionFert, cantidad: 0, ordenes: 0 };
          previo.cantidad += cantidad;
          previo.ordenes += 1;
          sinMapearMap.set(fert, previo);
        }
        return;
      }
      const orden = limpiarCodigo(getProp(o, ['ORDEN', 'NUMEROORDEN']));
      forros.forEach(({ forro, factor }) => {
        const lista = porForro.get(forro) ?? [];
        lista.push({ orden, fert, descripcionFert, fecha, cantidad: cantidad * factor, porBom });
        porForro.set(forro, lista);
      });
    });
    porForro.forEach(l => l.sort((a, b) => a.fecha.localeCompare(b.fecha)));
    return {
      ordenesPorForro: porForro,
      sinMapear: Array.from(sinMapearMap.values()).sort((a, b) => b.cantidad - a.cantidad),
    };
  }, [fertRows, fechaCorte, baseCantidad, forrosPorFertBom]);

  // ---------------- Paso 2: stock 1014 ----------------
  const stockPorMaterial = useMemo(() => {
    const m = new Map<string, number>();
    invRows.forEach(r => {
      const almacen = limpiarCodigo(getProp(r, ['ALMACEN']));
      if (!ALMACENES_LEIDOS.includes(almacen)) return;
      const centro = getProp(r, ['CENTRO']);
      if (centro && centro !== CENTRO_ALMOHADAS) return;
      const material = limpiarCodigo(getProp(r, ['MATERIAL']));
      const clave = claveAlmacen(material, almacen);
      m.set(clave, (m.get(clave) ?? 0) + num(getProp(r, ['LIBREUTILIZACION'])));
    });
    return m;
  }, [invRows]);

  const ssPpPorForro = useMemo(() => {
    const m = new Map<string, ResultadoSsPp>();
    consumos.forEach((movs, codigo) => m.set(codigo, calcularSsPp(movs, params)));
    return m;
  }, [consumos, params]);

  // ---------------- Paso 3: reposición ----------------
  const forros: ForroCalculado[] = useMemo(() => maestros.map(maestro => {
    const ordenes = ordenesPorForro.get(maestro.codigo) ?? [];
    const necesidad = ordenes.reduce((s, o) => s + o.cantidad, 0);
    const almacenes = almacenesDeForro(maestro.descripcion);
    const stock = sumarAlmacenes(stockPorMaterial, maestro.codigo, almacenes);
    const tr = sumarAlmacenes(transito, maestro.codigo, almacenes);
    // PP / SS escritos a mano por el planificador en el Excel reemplazan al cálculo (igual que el Excel).
    const calculado = ssPpPorForro.get(maestro.codigo) ?? null;
    const ppManual = maestro.ppManual !== undefined;
    const ssManual = maestro.ssManual !== undefined;
    const ssPp: ResultadoSsPp | null = calculado || ppManual || ssManual
      ? {
        ...(calculado ?? { semanal: [], semanasConConsumo: 0, consumoSemanal: 0, consumoDiario: 0, desvSemanal: 0, ss: 0, pp: 0 }),
        ...(ppManual ? { pp: maestro.ppManual! } : {}),
        ...(ssManual ? { ss: maestro.ssManual! } : {}),
      }
      : null;
    const lote = loteDe(maestro, ssPp);
    const rep = calcularReposicion({
      necesidad,
      stock,
      transito: tr,
      ss: ssPp?.ss ?? 0,
      pp: ssPp?.pp ?? 0,
      consumoDiario: ssPp?.consumoDiario ?? 0,
      loteMin: lote.loteMin,
    });
    const manual = pedidoManual[maestro.codigo];
    const tapaBom = maestro.tapa ? undefined : tapasBom.get(maestro.codigo);
    return {
      maestro, ordenes, necesidad, stock, transito: tr, ssPp, rep, pedidoFinal: manual ?? rep.pedido,
      ...lote, tapa: maestro.tapa ?? tapaBom, tapaPorBom: !!tapaBom, ppManual, ssManual,
    };
  }).sort((a, b) =>
    (PRIORIDAD_ORDEN[a.maestro.prioridad ?? ''] ?? 9) - (PRIORIDAD_ORDEN[b.maestro.prioridad ?? ''] ?? 9)
    || a.rep.stockFinal - b.rep.stockFinal
  ), [maestros, ordenesPorForro, stockPorMaterial, transito, ssPpPorForro, pedidoManual, tapasBom]);

  const conNecesidad = useMemo(() => forros.filter(f => f.necesidad > 0).sort((a, b) => b.necesidad - a.necesidad), [forros]);
  const filasReposicion = useMemo(() => (soloConPedido ? forros.filter(f => f.pedidoFinal > 0) : forros), [forros, soloConPedido]);
  const conPedido = useMemo(() => forros.filter(f => f.pedidoFinal > 0), [forros]);

  const totales = useMemo(() => ({
    ordenes: new Set(Array.from(ordenesPorForro.values()).flat().map(o => o.orden)).size,
    necesidad: conNecesidad.reduce((s, f) => s + f.necesidad, 0),
    pedido: conPedido.reduce((s, f) => s + f.pedidoFinal, 0),
    pedidoUsd: conPedido.reduce((s, f) => s + f.pedidoFinal * (f.maestro.precio ?? 0), 0),
    invUsd: forros.reduce((s, f) => s + f.stock * (f.maestro.costoTela ?? 0), 0),
  }), [ordenesPorForro, conNecesidad, conPedido, forros]);

  // ---------------- Paso 4: subcontratación ----------------
  const asignar = (forro: string, taller: string, valor: number) => {
    setAsignacion(prev => {
      const sig: Asignacion = { ...prev, [forro]: { ...(prev[forro] ?? {}), [taller]: valor } };
      if (!(valor > 0)) delete sig[forro][taller];
      guardarAsignacion(fechaCorte, sig);
      return sig;
    });
  };
  const asignadoDe = (forro: string): number => Object.values(asignacion[forro] ?? {}).reduce((s, v) => s + v, 0);
  const forrosDist = useMemo<ForroDistribucion[]>(() => conPedido.map(f => ({
    codigo: f.maestro.codigo,
    cantidad: f.pedidoFinal,
    precio: f.maestro.precio ?? 0,
    prioridad: f.maestro.prioridad ?? null,
    talleres: f.maestro.talleres,
    tela: f.maestro.tela,
  })), [conPedido]);
  const talleresDist = useMemo(() => TALLERES_ALMOHADA_EXCEL.map(t => ({
    nombre: t.nombre,
    ponderado: (capacidad[t.nombre]?.personas ?? 0) * (capacidad[t.nombre]?.peso ?? 0),
  })), [capacidad]);
  const porTaller = useMemo(() => resumenPorTaller(forrosDist, talleresDist, asignacion), [forrosDist, talleresDist, asignacion]);
  const cambiarCapacidad = (taller: string, campo: 'personas' | 'peso', valor: number) => setCapacidad(prev => {
    const sig = { ...prev, [taller]: { ...(prev[taller] ?? { personas: 0, peso: 1 }), [campo]: Math.max(0, valor) } };
    guardarCapacidad(sig);
    return sig;
  });
  const fijarAsignacion = (a: Asignacion) => {
    setAsignacion(a);
    guardarAsignacion(fechaCorte, a);
  };
  // Conserva lo escrito a mano y reparte solo lo que falta de cada forro.
  const distribuir = () => fijarAsignacion(distribuirPedido(forrosDist, talleresDist, asignacion, paramDist));

  const toggle = (codigo: string) => setExpandidos(prev => {
    const s = new Set(prev);
    if (s.has(codigo)) s.delete(codigo); else s.add(codigo);
    return s;
  });

  const exportarReposicion = () => exportarExcel(`Reposicion_Forros_ALM_${fechaCorte}.xlsx`, {
    Reposicion: forros.map(f => ({
      Prioridad: f.maestro.prioridad ?? '',
      Codigo: f.maestro.codigo,
      Descripcion: f.maestro.descripcion,
      Tela: f.maestro.tela,
      'Necesidad semana': f.necesidad,
      'Stock 1014': f.stock,
      'Transito': f.transito,
      'Stock final': f.rep.stockFinal,
      'Consumo semanal': Math.round(f.ssPp?.consumoSemanal ?? 0),
      SS: Math.round(f.ssPp?.ss ?? 0),
      PP: Math.round(f.ssPp?.pp ?? 0),
      'PP/SS': Math.round(f.rep.ppss),
      'Lote min': f.loteMin,
      'Lote max': f.loteMax,
      'Lote calculado': f.loteCalculado ? 'SI' : '',
      'PP/SS manual': [f.ppManual && 'PP', f.ssManual && 'SS'].filter(Boolean).join('+'),
      'Pedido sugerido': f.rep.pedido,
      'Pedido final': f.pedidoFinal,
      'Cobertura (dias)': f.rep.coberturaDias ?? '',
      'Inv USD': Math.round(f.stock * (f.maestro.costoTela ?? 0) * 100) / 100,
    })),
  });

  const exportarSubcontratacion = () => exportarExcel(`Plan_Subcontratacion_ALM_${fechaCorte}.xlsx`, {
    'Plan Subcontratacion': conPedido.map(f => {
      const fila: Fila = {
        Prioridad: f.maestro.prioridad ?? '',
        Codigo: f.maestro.codigo,
        Descripcion: f.maestro.descripcion,
        Tela: f.maestro.tela,
        Cantidad: f.pedidoFinal,
        Precio: f.maestro.precio ?? 0,
        'Costo total': Math.round(f.pedidoFinal * (f.maestro.precio ?? 0) * 100) / 100,
      };
      TALLERES_ALMOHADA_EXCEL.forEach(t => { fila[t.nombre] = asignacion[f.maestro.codigo]?.[t.nombre] ?? 0; });
      fila.Asignado = asignadoDe(f.maestro.codigo);
      fila.Diferencia = asignadoDe(f.maestro.codigo) - f.pedidoFinal;
      return fila;
    }),
    Talleres: porTaller.map(p => {
      const t = TALLERES_ALMOHADA_EXCEL.find(x => x.nombre === p.nombre)!;
      return {
        Taller: p.nombre,
        'Cod. proveedor': t.codProveedor,
        'Dia entrega': t.diaEntrega,
        Hora: t.horaEntrega,
        Personas: capacidad[p.nombre]?.personas ?? 0,
        Peso: capacidad[p.nombre]?.peso ?? 0,
        '%': Math.round(p.porcentaje * 1000) / 10,
        'Objetivo USD': Math.round(p.objetivoUsd * 100) / 100,
        'Asignado USD': Math.round(p.asignadoUsd * 100) / 100,
        'Desviacion USD': Math.round(p.desviacionUsd * 100) / 100,
        UN: p.unidades,
      };
    }),
    Tapas: conPedido.flatMap(f => (f.tapa ? [{
      Forro: f.maestro.codigo,
      'Desc. forro': f.maestro.descripcion,
      Tapa: f.tapa.codigo,
      'Desc. tapa': f.tapa.descripcion,
      Tela: f.tapa.tela,
      Color: f.tapa.color,
      Tapas: f.pedidoFinal * f.tapa.tapasPorForro,
      Origen: f.tapaPorBom ? 'BOM' : 'Excel',
    }] : [])),
  });

  // ---------------- Validar contra Excel ----------------
  const cargarExcelValidacion = async (archivo: File | undefined) => {
    if (!archivo) return;
    try {
      const v = await leerExcelValidacion(archivo);
      setExcelVal(v);
      addNotification('success', `Excel leído: ${v.forros.size} forros${v.fechaCorte ? `, corte ${v.fechaCorte}` : ''}.`);
    } catch (e) {
      addNotification('error', `No se pudo leer el Excel: ${(e as Error).message}`);
    } finally {
      if (inputValRef.current) inputValRef.current.value = '';
    }
  };
  const igualarAlExcel = () => {
    if (!excelVal) return;
    if (excelVal.fechaCorte) setFechaCorte(excelVal.fechaCorte);
    setBaseCantidad('programada');
    if (excelVal.transito.size) {
      setTransito(excelVal.transito);
      setTransitoOrigen('excel');
    }
    setPedidoManual({});
  };

  const comparacion = useMemo(() => {
    if (!excelVal) return [];
    const porCodigo = new Map(forros.map(f => [f.maestro.codigo, f]));
    const codigos = Array.from(new Set([...excelVal.forros.keys(), ...forros.filter(f => f.necesidad > 0 || f.stock > 0).map(f => f.maestro.codigo)]));
    return codigos.map(codigo => {
      const f = porCodigo.get(codigo);
      const x: ValoresExcelForro | undefined = excelVal.forros.get(codigo);
      const metricas = METRICAS_VALIDACION.map(m => {
        const app = f ? m.app(f) : 0;
        const excel = x ? m.excel(x) : 0;
        return { clave: m.clave, app, excel, ok: iguales(app, excel) };
      });
      return {
        codigo,
        descripcion: f?.maestro.descripcion ?? '',
        enExcel: !!x,
        metricas,
        difs: metricas.filter(m => !m.ok).length,
      };
    }).sort((a, b) => b.difs - a.difs || a.codigo.localeCompare(b.codigo));
  }, [excelVal, forros]);
  const resumenValidacion = useMemo(() => METRICAS_VALIDACION.map((m, i) => ({
    etiqueta: m.etiqueta,
    ok: comparacion.filter(c => c.metricas[i].ok).length,
  })), [comparacion]);
  const filasComparacion = soloDiferencias ? comparacion.filter(c => c.difs > 0) : comparacion;

  const exportarComparacion = () => exportarExcel(`Validacion_ALM_${fechaCorte}.xlsx`, {
    Validacion: comparacion.map(c => {
      const fila: Fila = { Codigo: c.codigo, Descripcion: c.descripcion, 'En Excel': c.enExcel ? 'SI' : 'NO' };
      c.metricas.forEach((m, i) => {
        const e = METRICAS_VALIDACION[i].etiqueta;
        fila[`${e} Excel`] = Math.round(m.excel * 100) / 100;
        fila[`${e} App`] = Math.round(m.app * 100) / 100;
        fila[`${e} Dif`] = Math.round((m.app - m.excel) * 100) / 100;
      });
      return fila;
    }),
  });

  const sinDatos = !cargando && fertRows.length === 0 && invRows.length === 0;

  return (
    <div className="p-6 md:p-8 space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <BedDouble className="w-6 h-6 text-gray-700" />
          <h2 className="text-2xl font-semibold text-gray-700">Programación Táctica Subcontratación</h2>
        </div>
        <div className="flex flex-wrap items-end gap-3">
          <div className="space-y-1">
            <Label htmlFor="alm-fecha-corte" className="text-xs text-gray-500">Fecha de corte</Label>
            <Input id="alm-fecha-corte" type="date" value={fechaCorte} onChange={e => e.target.value && setFechaCorte(e.target.value)} className="h-9 w-40" />
          </div>
          <input ref={inputMe2nRef} type="file" accept=".xlsx,.xls,.xlsm" className="hidden" onChange={e => void cargarMe2n(e.target.files?.[0])} />
          <Button variant="outline" size="sm" className="h-9" onClick={() => inputMe2nRef.current?.click()} title="Pedidos de compra abiertos (ME2N), almacén 1014">
            <Upload className="w-4 h-4 mr-2" />
            {archivoMe2n ? `ME2N: ${archivoMe2n.filas} pos.` : 'Cargar ME2N'}
          </Button>
          <Button size="sm" className="h-9" onClick={() => void sincronizar()} disabled={cargando}>
            {cargando ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <RefreshCw className="w-4 h-4 mr-2" />}
            Sincronizar
          </Button>
        </div>
      </div>

      {avance && (
        <div className="flex items-center gap-3 text-sm text-gray-600">
          <Loader2 className="w-4 h-4 animate-spin" />
          <span>{avance.etapa}{avance.total > 2 ? ` ${avance.n}/${avance.total}` : ''}</span>
          {avance.total > 2 && (
            <div className="h-1.5 w-48 rounded bg-gray-200 overflow-hidden">
              <div className="h-full bg-blue-600 transition-all" style={{ width: `${(avance.n / avance.total) * 100}%` }} />
            </div>
          )}
        </div>
      )}

      <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
        {[
          { t: 'Órdenes ≤ corte', v: fmt(totales.ordenes) },
          { t: 'Necesidad (UN)', v: fmt(totales.necesidad) },
          { t: 'Forros a pedir', v: fmt(conPedido.length) },
          { t: 'Pedido (UN / USD)', v: `${fmt(totales.pedido)} / $${fmt(totales.pedidoUsd, 2)}` },
          { t: 'Inventario 1014 USD', v: `$${fmt(totales.invUsd, 2)}` },
        ].map(k => (
          <div key={k.t} className="rounded-lg border border-gray-200 bg-white px-4 py-3 shadow-sm">
            <div className="text-[11px] uppercase tracking-wide text-gray-500">{k.t}</div>
            <div className="text-lg font-semibold text-gray-800 tabular-nums">{k.v}</div>
          </div>
        ))}
      </div>

      {sinDatos && (
        <div className="flex items-center gap-2 rounded-md border border-amber-200 bg-amber-50 px-4 py-2 text-sm text-amber-800">
          <TriangleAlert className="w-4 h-4" /> Sin datos de SAP.
        </div>
      )}

      <Tabs value={tab} onValueChange={setTab} className="w-full">
        <TabsList className="grid w-full grid-cols-5 gap-1 h-auto p-1 bg-muted border border-dashed border-gray-300 rounded-lg">
          <TabsTrigger value="necesidad" className="font-bold text-blue-700 data-[state=active]:text-blue-700">1 Necesidad</TabsTrigger>
          <TabsTrigger value="stock" className="font-bold text-blue-700 data-[state=active]:text-blue-700">2 Stock y SS/PP</TabsTrigger>
          <TabsTrigger value="reposicion" className="font-bold text-blue-700 data-[state=active]:text-blue-700">3 Reposición</TabsTrigger>
          <TabsTrigger value="subcontratacion" className="font-bold text-blue-700 data-[state=active]:text-blue-700">4 Plan Subcontratación</TabsTrigger>
          <TabsTrigger value="validar" className="font-bold text-blue-700 data-[state=active]:text-blue-700">Validar Excel</TabsTrigger>
        </TabsList>

        {/* ---------------- 1 Necesidad ---------------- */}
        <TabsContent value="necesidad" className="mt-4 space-y-4">
          {sinMapear.length > 0 && (
            <div className="rounded-md border border-amber-200 bg-amber-50 text-sm text-amber-800">
              <button type="button" className="flex w-full items-center gap-2 px-4 py-2 text-left" onClick={() => setVerSinMapear(v => !v)}>
                {verSinMapear ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
                <TriangleAlert className="w-4 h-4" />
                {sinMapear.length} FERT de almohadas sin forro asignado ({fmt(sinMapear.reduce((s, x) => s + x.cantidad, 0))} UN)
              </button>
              {verSinMapear && (
                <div className="px-4 pb-3">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>FERT</TableHead>
                        <TableHead>Descripción</TableHead>
                        <TableHead className="text-right">Órdenes</TableHead>
                        <TableHead className="text-right">Cantidad</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {sinMapear.map(x => (
                        <TableRow key={x.fert}>
                          <TableCell className="font-mono text-xs">{x.fert}</TableCell>
                          <TableCell className="text-xs">{x.descripcion}</TableCell>
                          <TableCell className="text-right tabular-nums">{x.ordenes}</TableCell>
                          <TableCell className="text-right tabular-nums">{fmt(x.cantidad)}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              )}
            </div>
          )}
          <div className="border rounded-lg overflow-auto max-h-[65vh] bg-white">
            <Table>
              <TableHeader className="sticky top-0 bg-white z-10">
                <TableRow>
                  <TableHead className="w-8" />
                  <TableHead>Prioridad</TableHead>
                  <TableHead>Forro</TableHead>
                  <TableHead>Descripción</TableHead>
                  <TableHead className="text-right">Órdenes</TableHead>
                  <TableHead className="text-right">Necesidad (UN)</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {conNecesidad.map(f => (
                  <React.Fragment key={f.maestro.codigo}>
                    <TableRow className="cursor-pointer hover:bg-gray-50" onClick={() => toggle(f.maestro.codigo)}>
                      <TableCell>{expandidos.has(f.maestro.codigo) ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}</TableCell>
                      <TableCell><Badge variant="outline" className={claseprioridad(f.maestro.prioridad)}>{f.maestro.prioridad ?? '—'}</Badge></TableCell>
                      <TableCell className="font-mono text-xs">{f.maestro.codigo}</TableCell>
                      <TableCell className="text-xs">{f.maestro.descripcion}</TableCell>
                      <TableCell className="text-right tabular-nums">{f.ordenes.length}</TableCell>
                      <TableCell className="text-right tabular-nums font-semibold">{fmt(f.necesidad)}</TableCell>
                    </TableRow>
                    {expandidos.has(f.maestro.codigo) && f.ordenes.map((o, i) => (
                      <TableRow key={`${o.orden}-${i}`} className="bg-slate-50/70 text-xs">
                        <TableCell />
                        <TableCell className="text-gray-500">{o.fecha}</TableCell>
                        <TableCell className="font-mono text-gray-500">{o.orden}</TableCell>
                        <TableCell className="text-gray-600"><span className="font-mono">{o.fert}</span> · {o.descripcionFert}{o.porBom && <Badge variant="outline" className="ml-2 text-[10px]">BOM</Badge>}</TableCell>
                        <TableCell />
                        <TableCell className="text-right tabular-nums text-gray-600">{fmt(o.cantidad)}</TableCell>
                      </TableRow>
                    ))}
                  </React.Fragment>
                ))}
                {conNecesidad.length === 0 && (
                  <TableRow><TableCell colSpan={6} className="text-center py-6 text-gray-400 text-xs">{cargando ? 'Cargando…' : 'Sin órdenes hasta la fecha de corte.'}</TableCell></TableRow>
                )}
              </TableBody>
              {conNecesidad.length > 0 && (
                <TableFooter>
                  <TableRow>
                    <TableCell colSpan={4} className="font-semibold">Total</TableCell>
                    <TableCell className="text-right tabular-nums">{totales.ordenes}</TableCell>
                    <TableCell className="text-right tabular-nums font-semibold">{fmt(totales.necesidad)}</TableCell>
                  </TableRow>
                </TableFooter>
              )}
            </Table>
          </div>
        </TabsContent>

        {/* ---------------- 2 Stock y SS/PP ---------------- */}
        <TabsContent value="stock" className="mt-4 space-y-4">
          <div className="flex flex-wrap items-end gap-4 rounded-lg border bg-white px-4 py-3">
            {([
              ['semanas', 'Semanas', 1],
              ['leadTimeDias', 'Lead time (días)', 1],
              ['z', 'Z', 0.01],
              ['factorTemporada', 'Factor temporada', 0.05],
            ] as const).map(([clave, etiqueta, paso]) => (
              <div key={clave} className="space-y-1">
                <Label className="text-xs text-gray-500">{etiqueta}</Label>
                <Input
                  type="number"
                  step={paso}
                  min={0}
                  value={params[clave]}
                  onChange={e => {
                    const v = Number(e.target.value);
                    if (Number.isFinite(v) && v > 0) setParams(p => ({ ...p, [clave]: clave === 'semanas' ? Math.round(v) : v }));
                  }}
                  className="h-8 w-28"
                />
              </div>
            ))}
            <Button variant="ghost" size="sm" onClick={() => setParams(PARAMETROS_SS_PP_DEFECTO)}>Restablecer</Button>
            {consumosFallidos.length > 0 && (
              <span className="text-xs text-amber-700" title={consumosFallidos.join(', ')}>Sin MB51: {consumosFallidos.length} forros</span>
            )}
          </div>
          <div className="border rounded-lg overflow-auto max-h-[65vh] bg-white">
            <Table>
              <TableHeader className="sticky top-0 bg-white z-10">
                <TableRow>
                  <TableHead>Forro</TableHead>
                  <TableHead>Descripción</TableHead>
                  <TableHead className="text-right">Stock 1014</TableHead>
                  <TableHead className="text-right">Tránsito</TableHead>
                  <TableHead className="text-right" title="Semanas con consumo / semanas evaluadas">Sem.</TableHead>
                  <TableHead className="text-right">Cons. semanal</TableHead>
                  <TableHead className="text-right">Cons. diario</TableHead>
                  <TableHead className="text-right">σ semanal</TableHead>
                  <TableHead className="text-right">SS</TableHead>
                  <TableHead className="text-right">PP</TableHead>
                  <TableHead className="text-right">Lote mín</TableHead>
                  <TableHead className="text-right">Lote máx</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {forros.map(f => (
                  <TableRow key={f.maestro.codigo}>
                    <TableCell className="font-mono text-xs">{f.maestro.codigo}</TableCell>
                    <TableCell className="text-xs">{f.maestro.descripcion}</TableCell>
                    <TableCell className="text-right tabular-nums">{fmt(f.stock)}</TableCell>
                    <TableCell className="text-right tabular-nums">{f.transito ? fmt(f.transito) : '—'}</TableCell>
                    <TableCell className="text-right tabular-nums text-gray-500">{f.ssPp ? `${f.ssPp.semanasConConsumo}/${params.semanas}` : '—'}</TableCell>
                    <TableCell className="text-right tabular-nums">{f.ssPp ? fmt(f.ssPp.consumoSemanal) : '—'}</TableCell>
                    <TableCell className="text-right tabular-nums">{f.ssPp ? fmt(f.ssPp.consumoDiario, 1) : '—'}</TableCell>
                    <TableCell className="text-right tabular-nums">{f.ssPp ? fmt(f.ssPp.desvSemanal) : '—'}</TableCell>
                    <TableCell className={cn('text-right tabular-nums', f.ssManual && 'italic text-violet-700')} title={f.ssManual ? 'SS manual (Excel)' : undefined}>{f.ssPp ? fmt(f.ssPp.ss) : '—'}</TableCell>
                    <TableCell className={cn('text-right tabular-nums font-semibold', f.ppManual && 'italic text-violet-700')} title={f.ppManual ? 'PP manual (Excel)' : undefined}>{f.ssPp ? fmt(f.ssPp.pp) : '—'}</TableCell>
                    <TableCell className={cn('text-right tabular-nums', f.loteCalculado && 'italic text-blue-700')} title={f.loteCalculado ? 'Calculado: EVEN(semanal ÷ 2.5 × 5)' : undefined}>{f.loteMin ? fmt(f.loteMin) : '—'}</TableCell>
                    <TableCell className={cn('text-right tabular-nums', f.loteCalculado && 'italic text-blue-700')}>{f.loteMax ? fmt(f.loteMax) : '—'}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </TabsContent>

        {/* ---------------- 3 Reposición ---------------- */}
        <TabsContent value="reposicion" className="mt-4 space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <Switch id="alm-solo-pedido" checked={soloConPedido} onCheckedChange={setSoloConPedido} />
              <Label htmlFor="alm-solo-pedido" className="text-sm">Solo forros a pedir</Label>
              {!transitoOrigen && <span className="text-xs text-amber-700 ml-3">Tránsito = 0 (sin ME2N)</span>}
            </div>
            <div className="flex gap-2">
              {Object.keys(pedidoManual).length > 0 && (
                <Button variant="ghost" size="sm" onClick={() => setPedidoManual({})}>Quitar ajustes ({Object.keys(pedidoManual).length})</Button>
              )}
              <Button variant="outline" size="sm" onClick={exportarReposicion}><Download className="w-4 h-4 mr-2" />Excel</Button>
            </div>
          </div>
          <div className="border rounded-lg overflow-auto max-h-[65vh] bg-white">
            <Table>
              <TableHeader className="sticky top-0 bg-white z-10">
                <TableRow>
                  <TableHead>Prio.</TableHead>
                  <TableHead>Forro</TableHead>
                  <TableHead>Descripción</TableHead>
                  <TableHead className="text-right">Necesidad</TableHead>
                  <TableHead className="text-right">Stock 1014</TableHead>
                  <TableHead className="text-right">Tránsito</TableHead>
                  <TableHead className="text-right">Stock final</TableHead>
                  <TableHead className="text-right" title="SS + PP/2">PP/SS</TableHead>
                  <TableHead className="text-right">Lote mín</TableHead>
                  <TableHead className="text-right">Sugerido</TableHead>
                  <TableHead className="text-right">Pedido</TableHead>
                  <TableHead className="text-right">Cobertura (d)</TableHead>
                  <TableHead>Tela</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filasReposicion.map(f => (
                  <TableRow key={f.maestro.codigo} className={cn(f.rep.stockFinal < 0 && 'bg-red-50/60')}>
                    <TableCell><Badge variant="outline" className={claseprioridad(f.maestro.prioridad)}>{f.maestro.prioridad ?? '—'}</Badge></TableCell>
                    <TableCell className="font-mono text-xs">{f.maestro.codigo}</TableCell>
                    <TableCell className="text-xs">{f.maestro.descripcion}</TableCell>
                    <TableCell className="text-right tabular-nums">{fmt(f.necesidad)}</TableCell>
                    <TableCell className="text-right tabular-nums">{fmt(f.stock)}</TableCell>
                    <TableCell className="text-right tabular-nums">{f.transito ? fmt(f.transito) : '—'}</TableCell>
                    <TableCell className={cn('text-right tabular-nums font-semibold', f.rep.stockFinal < 0 && 'text-red-600')}>{fmt(f.rep.stockFinal)}</TableCell>
                    <TableCell className="text-right tabular-nums">{fmt(f.rep.ppss)}</TableCell>
                    <TableCell className={cn('text-right tabular-nums', f.loteCalculado && 'italic text-blue-700')} title={f.loteCalculado ? 'Calculado: EVEN(semanal ÷ 2.5 × 5)' : undefined}>{f.loteMin ? fmt(f.loteMin) : '—'}</TableCell>
                    <TableCell className={cn('text-right tabular-nums', f.rep.excedeLote && 'text-amber-700 font-semibold')} title={f.rep.excedeLote ? `Faltante ${fmt(f.rep.faltante)} > lote mínimo` : undefined}>
                      {f.rep.pedido ? fmt(f.rep.pedido) : '—'}{f.rep.excedeLote ? ' ⚠' : ''}
                    </TableCell>
                    <TableCell className="text-right">
                      <Input
                        type="number"
                        min={0}
                        value={f.pedidoFinal}
                        onChange={e => {
                          const v = Math.max(0, Math.round(Number(e.target.value) || 0));
                          setPedidoManual(prev => {
                            const sig = { ...prev };
                            if (v === f.rep.pedido) delete sig[f.maestro.codigo]; else sig[f.maestro.codigo] = v;
                            return sig;
                          });
                        }}
                        className={cn('h-7 w-24 ml-auto text-right tabular-nums', pedidoManual[f.maestro.codigo] !== undefined && 'border-blue-400 bg-blue-50')}
                      />
                    </TableCell>
                    <TableCell className={cn('text-right tabular-nums', (f.rep.coberturaDias ?? 99) < params.leadTimeDias && 'text-red-600 font-semibold')}>
                      {f.rep.coberturaDias ?? '—'}
                    </TableCell>
                    <TableCell className="text-xs text-gray-500">{f.maestro.tela}</TableCell>
                  </TableRow>
                ))}
                {filasReposicion.length === 0 && (
                  <TableRow><TableCell colSpan={13} className="text-center py-6 text-gray-400 text-xs">{cargando ? 'Cargando…' : 'Sin forros a pedir.'}</TableCell></TableRow>
                )}
              </TableBody>
              {filasReposicion.length > 0 && (
                <TableFooter>
                  <TableRow>
                    <TableCell colSpan={3} className="font-semibold">Total</TableCell>
                    <TableCell className="text-right tabular-nums">{fmt(filasReposicion.reduce((s, f) => s + f.necesidad, 0))}</TableCell>
                    <TableCell className="text-right tabular-nums">{fmt(filasReposicion.reduce((s, f) => s + f.stock, 0))}</TableCell>
                    <TableCell className="text-right tabular-nums">{fmt(filasReposicion.reduce((s, f) => s + f.transito, 0))}</TableCell>
                    <TableCell colSpan={4} />
                    <TableCell className="text-right tabular-nums font-semibold">{fmt(filasReposicion.reduce((s, f) => s + f.pedidoFinal, 0))}</TableCell>
                    <TableCell colSpan={2} />
                  </TableRow>
                </TableFooter>
              )}
            </Table>
          </div>
        </TabsContent>

        {/* ---------------- 4 Plan Subcontratación ---------------- */}
        <TabsContent value="subcontratacion" className="mt-4 space-y-4">
          <div className="flex flex-wrap items-end justify-end gap-3">
            <div className="flex flex-col gap-1">
              <Label className="text-xs text-gray-500" title="Las partes de un forro dividido se redondean a este múltiplo">Paquete (UN)</Label>
              <Input type="number" min={1} value={paramDist.paquete} className="h-8 w-20 text-right"
                onChange={e => setParamDist(v => ({ ...v, paquete: Math.max(1, Number(e.target.value) || 1) }))} />
            </div>
            <div className="flex flex-col gap-1">
              <Label className="text-xs text-gray-500" title="Parte mínima por taller al dividir un forro">Mín. por taller (UN)</Label>
              <Input type="number" min={1} value={paramDist.minimoPorTaller} className="h-8 w-20 text-right"
                onChange={e => setParamDist(v => ({ ...v, minimoPorTaller: Math.max(1, Number(e.target.value) || 1) }))} />
            </div>
            <div className="flex items-center gap-2 h-8" title="Los forros de la misma tela van al mismo taller mientras le quede hueco (aprovecha el corte)">
              <Switch id="agrupar-tela" checked={paramDist.agruparPorTela}
                onCheckedChange={v => setParamDist(x => ({ ...x, agruparPorTela: v }))} />
              <Label htmlFor="agrupar-tela" className="text-xs text-gray-600">Agrupar por tela</Label>
            </div>
            <Button size="sm" onClick={distribuir} disabled={conPedido.length === 0}
              title="Reparte lo pendiente de cada forro según personas × peso, respetando la matriz y lo ya escrito">
              <Wand2 className="w-4 h-4 mr-2" />Distribuir
            </Button>
            <Button variant="outline" size="sm" onClick={() => fijarAsignacion({})} disabled={Object.keys(asignacion).length === 0}>
              <Eraser className="w-4 h-4 mr-2" />Limpiar
            </Button>
            <Button variant="outline" size="sm" onClick={exportarSubcontratacion} disabled={conPedido.length === 0}>
              <Download className="w-4 h-4 mr-2" />Excel
            </Button>
          </div>
          <div className="border rounded-lg overflow-auto max-h-[65vh] bg-white">
            <Table>
              <TableHeader className="sticky top-0 bg-white z-10">
                <TableRow>
                  <TableHead>Prio.</TableHead>
                  <TableHead>Forro</TableHead>
                  <TableHead className="min-w-[220px]">Descripción</TableHead>
                  <TableHead className="text-right">Pedido</TableHead>
                  <TableHead className="text-right">Tapas</TableHead>
                  <TableHead className="text-right">Precio</TableHead>
                  {TALLERES_ALMOHADA_EXCEL.map(t => (
                    <TableHead key={t.nombre} className="text-center min-w-[92px] leading-tight py-1">
                      <div className="text-[11px] font-semibold">{t.nombre}</div>
                      <div className="text-[10px] font-normal text-gray-400">{t.diaEntrega.slice(0, 3)} {t.horaEntrega}</div>
                    </TableHead>
                  ))}
                  <TableHead className="text-right">Asignado</TableHead>
                  <TableHead className="text-right">Dif.</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {conPedido.map(f => {
                  const asignado = asignadoDe(f.maestro.codigo);
                  const dif = asignado - f.pedidoFinal;
                  return (
                    <TableRow key={f.maestro.codigo}>
                      <TableCell><Badge variant="outline" className={claseprioridad(f.maestro.prioridad)}>{f.maestro.prioridad ?? '—'}</Badge></TableCell>
                      <TableCell className="font-mono text-xs">{f.maestro.codigo}</TableCell>
                      <TableCell className="text-xs">
                        {f.maestro.descripcion}
                        {!f.maestro.talleres && <Badge variant="outline" className="ml-2 text-[10px] text-amber-700 border-amber-300" title="Sin matriz de talleres: todos habilitados">sin matriz</Badge>}
                        {f.maestro.tela && <div className="text-[10px] text-gray-400">{normalizarTela(f.maestro.tela)}</div>}
                      </TableCell>
                      <TableCell className="text-right tabular-nums font-semibold">{fmt(f.pedidoFinal)}</TableCell>
                      <TableCell className="text-right tabular-nums text-gray-500" title={f.tapa ? `${f.tapa.descripcion}${f.tapaPorBom ? ' (BOM)' : ` · ${f.tapa.tela} ${f.tapa.color}`}` : undefined}>
                        {f.tapa ? fmt(f.pedidoFinal * f.tapa.tapasPorForro) : '—'}
                      </TableCell>
                      <TableCell className="text-right tabular-nums text-gray-500">{f.maestro.precio ? fmt(f.maestro.precio, 2) : '—'}</TableCell>
                      {TALLERES_ALMOHADA_EXCEL.map(t => {
                        const habilitado = !f.maestro.talleres || f.maestro.talleres.includes(t.nombre);
                        return (
                          <TableCell key={t.nombre} className="text-center p-1">
                            {habilitado ? (
                              <Input
                                type="number"
                                min={0}
                                value={asignacion[f.maestro.codigo]?.[t.nombre] ?? ''}
                                onChange={e => asignar(f.maestro.codigo, t.nombre, Math.max(0, Math.round(Number(e.target.value) || 0)))}
                                className="h-7 w-20 mx-auto text-right tabular-nums"
                              />
                            ) : <span className="text-gray-300">—</span>}
                          </TableCell>
                        );
                      })}
                      <TableCell className="text-right tabular-nums">{fmt(asignado)}</TableCell>
                      <TableCell className={cn('text-right tabular-nums font-semibold', dif === 0 ? 'text-emerald-600' : 'text-red-600')}>{dif === 0 ? '✓' : fmt(dif)}</TableCell>
                    </TableRow>
                  );
                })}
                {conPedido.length === 0 && (
                  <TableRow><TableCell colSpan={8 + TALLERES_ALMOHADA_EXCEL.length} className="text-center py-6 text-gray-400 text-xs">Sin pedidos en el paso 3.</TableCell></TableRow>
                )}
              </TableBody>
              {conPedido.length > 0 && (
                <TableFooter>
                  <TableRow>
                    <TableCell colSpan={3} className="font-semibold">Total UN</TableCell>
                    <TableCell className="text-right tabular-nums font-semibold">{fmt(totales.pedido)}</TableCell>
                    <TableCell colSpan={2} />
                    {porTaller.map(p => <TableCell key={p.nombre} className="text-center tabular-nums">{p.unidades ? fmt(p.unidades) : '—'}</TableCell>)}
                    <TableCell className="text-right tabular-nums">{fmt(porTaller.reduce((s, p) => s + p.unidades, 0))}</TableCell>
                    <TableCell />
                  </TableRow>
                  <TableRow>
                    <TableCell colSpan={3} className="font-semibold">Total USD</TableCell>
                    <TableCell className="text-right tabular-nums">${fmt(totales.pedidoUsd, 2)}</TableCell>
                    <TableCell colSpan={2} />
                    {porTaller.map(p => <TableCell key={p.nombre} className="text-center tabular-nums text-xs">{p.asignadoUsd ? `$${fmt(p.asignadoUsd, 2)}` : '—'}</TableCell>)}
                    <TableCell className="text-right tabular-nums">${fmt(porTaller.reduce((s, p) => s + p.asignadoUsd, 0), 2)}</TableCell>
                    <TableCell />
                  </TableRow>
                  <TableRow>
                    <TableCell colSpan={3} className="font-semibold" title="Costo total × (personas × peso) ÷ Σ">Objetivo USD</TableCell>
                    <TableCell colSpan={3} />
                    {porTaller.map(p => (
                      <TableCell key={p.nombre} className="text-center tabular-nums text-xs text-gray-500" title={`${fmt(p.porcentaje * 100, 1)} %`}>
                        {p.objetivoUsd ? `$${fmt(p.objetivoUsd, 2)}` : '—'}
                      </TableCell>
                    ))}
                    <TableCell colSpan={2} />
                  </TableRow>
                  <TableRow>
                    <TableCell colSpan={3} className="font-semibold">Desviación USD</TableCell>
                    <TableCell colSpan={3} />
                    {porTaller.map(p => (
                      <TableCell key={p.nombre} className={cn('text-center tabular-nums text-xs font-semibold',
                        Math.abs(p.desviacionUsd) <= Math.max(1, p.objetivoUsd * 0.05) ? 'text-emerald-600' : p.desviacionUsd > 0 ? 'text-amber-600' : 'text-red-600')}>
                        {fmt(p.desviacionUsd, 2)}
                      </TableCell>
                    ))}
                    <TableCell colSpan={2} />
                  </TableRow>
                  <TableRow>
                    <TableCell colSpan={3} className="font-semibold">Personas × peso</TableCell>
                    <TableCell colSpan={3} />
                    {TALLERES_ALMOHADA_EXCEL.map(t => (
                      <TableCell key={t.nombre} className="text-center p-1">
                        <div className="flex items-center justify-center gap-1">
                          <Input type="number" min={0} value={capacidad[t.nombre]?.personas ?? 0} title="Personas"
                            onChange={e => cambiarCapacidad(t.nombre, 'personas', Number(e.target.value) || 0)}
                            className="h-7 w-12 text-right tabular-nums px-1" />
                          <Input type="number" min={0} step={0.1} value={capacidad[t.nombre]?.peso ?? 0} title="Peso"
                            onChange={e => cambiarCapacidad(t.nombre, 'peso', Number(e.target.value) || 0)}
                            className="h-7 w-12 text-right tabular-nums px-1" />
                        </div>
                      </TableCell>
                    ))}
                    <TableCell colSpan={2} />
                  </TableRow>
                </TableFooter>
              )}
            </Table>
          </div>
        </TabsContent>
        {/* ---------------- Validar contra Excel ---------------- */}
        <TabsContent value="validar" className="mt-4 space-y-4">
          <div className="flex flex-wrap items-center gap-3 rounded-lg border bg-white px-4 py-3">
            <input ref={inputValRef} type="file" accept=".xlsx,.xlsm" className="hidden" onChange={e => void cargarExcelValidacion(e.target.files?.[0])} />
            <Button variant="outline" size="sm" onClick={() => inputValRef.current?.click()}>
              <FileSpreadsheet className="w-4 h-4 mr-2" />{excelVal ? excelVal.nombre : 'Cargar Excel ALM'}
            </Button>
            {excelVal && (
              <>
                <Button size="sm" onClick={igualarAlExcel} title="Fecha de corte del Excel, cantidad programada y tránsito de la hoja PED COMPRAS">
                  Igualar condiciones al Excel
                </Button>
                <span className="text-xs text-gray-500">Corte Excel: {excelVal.fechaCorte || '—'} · App: {fechaCorte}</span>
              </>
            )}
            <div className="flex items-center gap-2 ml-auto">
              <Label className="text-xs text-gray-500">Cantidad</Label>
              <Button variant={baseCantidad === 'pendiente' ? 'default' : 'outline'} size="sm" className="h-7" onClick={() => setBaseCantidad('pendiente')}>Pendiente</Button>
              <Button variant={baseCantidad === 'programada' ? 'default' : 'outline'} size="sm" className="h-7" onClick={() => setBaseCantidad('programada')}>Programada (Excel)</Button>
            </div>
          </div>

          {excelVal && (
            <>
              <div className="flex flex-wrap items-center gap-2">
                {resumenValidacion.map(r => (
                  <Badge key={r.etiqueta} variant="outline" className={cn('text-xs', r.ok === comparacion.length ? 'border-emerald-300 text-emerald-700' : 'border-amber-300 text-amber-700')}>
                    {r.etiqueta}: {r.ok}/{comparacion.length}
                  </Badge>
                ))}
                <div className="flex items-center gap-2 ml-auto">
                  <Switch id="alm-solo-dif" checked={soloDiferencias} onCheckedChange={setSoloDiferencias} />
                  <Label htmlFor="alm-solo-dif" className="text-sm">Solo diferencias</Label>
                  <Button variant="outline" size="sm" onClick={exportarComparacion}><Download className="w-4 h-4 mr-2" />Excel</Button>
                </div>
              </div>
              <div className="border rounded-lg overflow-auto max-h-[65vh] bg-white">
                <Table>
                  <TableHeader className="sticky top-0 bg-white z-10">
                    <TableRow>
                      <TableHead rowSpan={2}>Forro</TableHead>
                      <TableHead rowSpan={2} className="min-w-[200px]">Descripción</TableHead>
                      {METRICAS_VALIDACION.map(m => <TableHead key={m.clave} colSpan={2} className="text-center border-l">{m.etiqueta}</TableHead>)}
                    </TableRow>
                    <TableRow>
                      {METRICAS_VALIDACION.map(m => (
                        <React.Fragment key={m.clave}>
                          <TableHead className="text-right text-[10px] border-l">Excel</TableHead>
                          <TableHead className="text-right text-[10px]">App</TableHead>
                        </React.Fragment>
                      ))}
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filasComparacion.map(c => (
                      <TableRow key={c.codigo}>
                        <TableCell className="font-mono text-xs">
                          {c.codigo}
                          {!c.enExcel && <Badge variant="outline" className="ml-1 text-[10px]">no Excel</Badge>}
                        </TableCell>
                        <TableCell className="text-xs">{c.descripcion}</TableCell>
                        {c.metricas.map(m => (
                          <React.Fragment key={m.clave}>
                            <TableCell className="text-right tabular-nums text-xs text-gray-500 border-l">{fmt(m.excel, m.clave === 'diario' ? 1 : 0)}</TableCell>
                            <TableCell className={cn('text-right tabular-nums text-xs', m.ok ? 'text-emerald-700' : 'bg-red-50 text-red-700 font-semibold')} title={m.ok ? undefined : `Dif: ${fmt(m.app - m.excel, 1)}`}>
                              {fmt(m.app, m.clave === 'diario' ? 1 : 0)}
                            </TableCell>
                          </React.Fragment>
                        ))}
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </>
          )}
        </TabsContent>
      </Tabs>

      {sincronizadoEn && (
        <div className="text-[11px] text-gray-400 text-right">
          SAP {sincronizadoEn.toLocaleTimeString('es-EC', { hour: '2-digit', minute: '2-digit' })}
          {transitoOrigen === 'excel' ? ' · tránsito: hoja PED COMPRAS' : archivoMe2n ? ` · ME2N ${archivoMe2n.nombre}` : ''}
          {baseCantidad === 'programada' ? ' · cantidad programada' : ''}
        </div>
      )}
    </div>
  );
};
