'use client';

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import * as XLSX from 'xlsx';
import { BedDouble, ChevronDown, ChevronRight, Download, Loader2, RefreshCw, TriangleAlert, Upload } from 'lucide-react';
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
} from '@/data/almohadasForrosExcel';
import {
  ALMACEN_FORROS_ALMOHADA,
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
}

type Asignacion = Record<string, Record<string, number>>;

const FORROS_POR_FERT = (() => {
  const m = new Map<string, string[]>();
  FERT_FORRO_ALMOHADA_EXCEL.forEach(([fert, forro]) => {
    const lista = m.get(fert) ?? [];
    if (!lista.includes(forro)) lista.push(forro);
    m.set(fert, lista);
  });
  return m;
})();

const CLAVE_ASIGNACION = 'almohadas-subcontratacion:';
const leerAsignacion = (fechaCorte: string): Asignacion => {
  try {
    const raw = localStorage.getItem(CLAVE_ASIGNACION + fechaCorte);
    return raw ? (JSON.parse(raw) as Asignacion) : {};
  } catch {
    return {};
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
// Almacén, Por entregar (cantidad). Se suman por material, solo almacén 1014 si la columna existe.
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
      const almacen = limpiarCodigo(getProp(r, ['Almacén', 'Almacen', 'ALMACEN']));
      if (almacen && almacen !== ALMACEN_FORROS_ALMOHADA) return;
      porMaterial.set(material, (porMaterial.get(material) ?? 0) + pendiente);
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
  const inputMe2nRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    setAsignacion(leerAsignacion(fechaCorte));
  }, [fechaCorte]);

  const sincronizar = useCallback(async () => {
    setCargando(true);
    try {
      setAvance({ etapa: 'Órdenes FERT e inventario', n: 0, total: 2 });
      const [fert, inv] = await Promise.all([sapCompartido.ordenesFert(), sapCompartido.inventarioAnioActual()]);
      setFertRows(filasDe(fert));
      setInvRows(filasDe(inv));

      const codigos = FORROS_ALMOHADA_EXCEL.map(f => f.codigo);
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
      setArchivoMe2n({ nombre: archivo.name, filas });
      addNotification('success', `ME2N cargado: ${filas} posiciones abiertas, ${porMaterial.size} materiales.`);
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
      const pendienteTxt = getProp(o, ['CANTPENDIENTE', 'CANT_PEND']);
      const cantidad = pendienteTxt !== '' ? num(pendienteTxt) : num(getProp(o, ['CANTPROGRAMADA', 'CANTIDAD']));
      if (cantidad <= 0) return;
      const fert = limpiarCodigo(getProp(o, ['MATERIAL', 'CODIGOMATERIAL']));
      const descripcionFert = getProp(o, ['NOMBRE', 'DESCRIPCION', 'TEXTO']);
      const forros = FORROS_POR_FERT.get(fert);
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
      forros.forEach(forro => {
        const lista = porForro.get(forro) ?? [];
        lista.push({ orden, fert, descripcionFert, fecha, cantidad });
        porForro.set(forro, lista);
      });
    });
    porForro.forEach(l => l.sort((a, b) => a.fecha.localeCompare(b.fecha)));
    return {
      ordenesPorForro: porForro,
      sinMapear: Array.from(sinMapearMap.values()).sort((a, b) => b.cantidad - a.cantidad),
    };
  }, [fertRows, fechaCorte]);

  // ---------------- Paso 2: stock 1014 ----------------
  const stockPorMaterial = useMemo(() => {
    const m = new Map<string, number>();
    invRows.forEach(r => {
      if (limpiarCodigo(getProp(r, ['ALMACEN'])) !== ALMACEN_FORROS_ALMOHADA) return;
      const centro = getProp(r, ['CENTRO']);
      if (centro && centro !== CENTRO_ALMOHADAS) return;
      const material = limpiarCodigo(getProp(r, ['MATERIAL']));
      m.set(material, (m.get(material) ?? 0) + num(getProp(r, ['LIBREUTILIZACION'])));
    });
    return m;
  }, [invRows]);

  const ssPpPorForro = useMemo(() => {
    const m = new Map<string, ResultadoSsPp>();
    consumos.forEach((movs, codigo) => m.set(codigo, calcularSsPp(movs, params)));
    return m;
  }, [consumos, params]);

  // ---------------- Paso 3: reposición ----------------
  const forros: ForroCalculado[] = useMemo(() => FORROS_ALMOHADA_EXCEL.map(maestro => {
    const ordenes = ordenesPorForro.get(maestro.codigo) ?? [];
    const necesidad = ordenes.reduce((s, o) => s + o.cantidad, 0);
    const stock = stockPorMaterial.get(maestro.codigo) ?? 0;
    const tr = transito.get(maestro.codigo) ?? 0;
    const ssPp = ssPpPorForro.get(maestro.codigo) ?? null;
    const rep = calcularReposicion({
      necesidad,
      stock,
      transito: tr,
      ss: ssPp?.ss ?? 0,
      pp: ssPp?.pp ?? 0,
      consumoDiario: ssPp?.consumoDiario ?? 0,
      loteMin: maestro.loteMin ?? 0,
    });
    const manual = pedidoManual[maestro.codigo];
    return { maestro, ordenes, necesidad, stock, transito: tr, ssPp, rep, pedidoFinal: manual ?? rep.pedido };
  }).sort((a, b) =>
    (PRIORIDAD_ORDEN[a.maestro.prioridad ?? ''] ?? 9) - (PRIORIDAD_ORDEN[b.maestro.prioridad ?? ''] ?? 9)
    || a.rep.stockFinal - b.rep.stockFinal
  ), [ordenesPorForro, stockPorMaterial, transito, ssPpPorForro, pedidoManual]);

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
  const porTaller = useMemo(() => TALLERES_ALMOHADA_EXCEL.map(t => {
    let un = 0;
    let usd = 0;
    conPedido.forEach(f => {
      const q = asignacion[f.maestro.codigo]?.[t.nombre] ?? 0;
      un += q;
      usd += q * (f.maestro.precio ?? 0);
    });
    return { taller: t, un, usd };
  }), [conPedido, asignacion]);

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
      'Lote min': f.maestro.loteMin ?? 0,
      'Lote max': f.maestro.loteMax ?? 0,
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
        Cantidad: f.pedidoFinal,
        Precio: f.maestro.precio ?? 0,
        'Costo total': Math.round(f.pedidoFinal * (f.maestro.precio ?? 0) * 100) / 100,
      };
      TALLERES_ALMOHADA_EXCEL.forEach(t => { fila[t.nombre] = asignacion[f.maestro.codigo]?.[t.nombre] ?? 0; });
      fila.Asignado = asignadoDe(f.maestro.codigo);
      fila.Diferencia = asignadoDe(f.maestro.codigo) - f.pedidoFinal;
      return fila;
    }),
    Tapas: conPedido.filter(f => f.maestro.tapa).map(f => ({
      Forro: f.maestro.codigo,
      'Desc. forro': f.maestro.descripcion,
      Tapa: f.maestro.tapa!.codigo,
      'Desc. tapa': f.maestro.tapa!.descripcion,
      Tela: f.maestro.tapa!.tela,
      Color: f.maestro.tapa!.color,
      Tapas: f.pedidoFinal * f.maestro.tapa!.tapasPorForro,
    })),
    Talleres: porTaller.map(p => ({
      Taller: p.taller.nombre,
      Proveedor: p.taller.codProveedor,
      'Dia entrega': p.taller.diaEntrega,
      Hora: p.taller.horaEntrega,
      Unidades: p.un,
      USD: Math.round(p.usd * 100) / 100,
    })),
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
        <TabsList className="grid w-full grid-cols-4 gap-1 h-auto p-1 bg-muted border border-dashed border-gray-300 rounded-lg">
          <TabsTrigger value="necesidad" className="font-bold text-blue-700 data-[state=active]:text-blue-700">1 Necesidad</TabsTrigger>
          <TabsTrigger value="stock" className="font-bold text-blue-700 data-[state=active]:text-blue-700">2 Stock y SS/PP</TabsTrigger>
          <TabsTrigger value="reposicion" className="font-bold text-blue-700 data-[state=active]:text-blue-700">3 Reposición</TabsTrigger>
          <TabsTrigger value="subcontratacion" className="font-bold text-blue-700 data-[state=active]:text-blue-700">4 Plan Subcontratación</TabsTrigger>
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
                        <TableCell className="text-gray-600"><span className="font-mono">{o.fert}</span> · {o.descripcionFert}</TableCell>
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
                    <TableCell className="text-right tabular-nums">{f.ssPp ? fmt(f.ssPp.ss) : '—'}</TableCell>
                    <TableCell className="text-right tabular-nums font-semibold">{f.ssPp ? fmt(f.ssPp.pp) : '—'}</TableCell>
                    <TableCell className="text-right tabular-nums">{f.maestro.loteMin ? fmt(f.maestro.loteMin) : '—'}</TableCell>
                    <TableCell className="text-right tabular-nums">{f.maestro.loteMax ? fmt(f.maestro.loteMax) : '—'}</TableCell>
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
              {!archivoMe2n && <span className="text-xs text-amber-700 ml-3">Tránsito = 0 (sin ME2N)</span>}
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
                  <TableHead className="text-right" title="PP + SS/2">PP/SS</TableHead>
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
                    <TableCell className="text-right tabular-nums">{f.maestro.loteMin ? fmt(f.maestro.loteMin) : '—'}</TableCell>
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
          <div className="flex justify-end">
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
                      <TableCell className="text-xs">{f.maestro.descripcion}</TableCell>
                      <TableCell className="text-right tabular-nums font-semibold">{fmt(f.pedidoFinal)}</TableCell>
                      <TableCell className="text-right tabular-nums text-gray-500" title={f.maestro.tapa ? `${f.maestro.tapa.descripcion} · ${f.maestro.tapa.tela} ${f.maestro.tapa.color}` : undefined}>
                        {f.maestro.tapa ? fmt(f.pedidoFinal * f.maestro.tapa.tapasPorForro) : '—'}
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
                    {porTaller.map(p => <TableCell key={p.taller.nombre} className="text-center tabular-nums">{p.un ? fmt(p.un) : '—'}</TableCell>)}
                    <TableCell className="text-right tabular-nums">{fmt(porTaller.reduce((s, p) => s + p.un, 0))}</TableCell>
                    <TableCell />
                  </TableRow>
                  <TableRow>
                    <TableCell colSpan={3} className="font-semibold">Total USD</TableCell>
                    <TableCell className="text-right tabular-nums">${fmt(totales.pedidoUsd, 2)}</TableCell>
                    <TableCell colSpan={2} />
                    {porTaller.map(p => <TableCell key={p.taller.nombre} className="text-center tabular-nums text-xs">{p.usd ? `$${fmt(p.usd, 2)}` : '—'}</TableCell>)}
                    <TableCell className="text-right tabular-nums">${fmt(porTaller.reduce((s, p) => s + p.usd, 0), 2)}</TableCell>
                    <TableCell />
                  </TableRow>
                </TableFooter>
              )}
            </Table>
          </div>
        </TabsContent>
      </Tabs>

      {sincronizadoEn && (
        <div className="text-[11px] text-gray-400 text-right">
          SAP {sincronizadoEn.toLocaleTimeString('es-EC', { hour: '2-digit', minute: '2-digit' })}
          {archivoMe2n ? ` · ME2N ${archivoMe2n.nombre}` : ''}
        </div>
      )}
    </div>
  );
};
