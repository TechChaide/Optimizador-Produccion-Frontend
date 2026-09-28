'use client';

import React, { useState, useEffect, useMemo, useRef } from 'react';
import { serviciosService } from '@/services/servicios.service';
import { useAppContext } from '@/context/AppProvider';
import { Package, Check, ChevronsUpDown, Loader2, BellRing, AlertTriangle, Clock, Calendar, CalendarDays, LayoutDashboard, History, ListChecks, ChevronUp, ChevronDown, Calculator, FileJson, Sparkles, CheckCircle2, PieChart, PackageSearch, Mail, ClipboardCheck } from 'lucide-react';
import type { OrdenFert, ProvisionalOrder, Restriccion } from '@/types/interfaces';
import { Button } from '@/components/ui/button';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem } from '@/components/ui/command';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { cn } from '@/lib/utils';

const normalizeMaterialCode = (code: string | number): string => {
  const codeStr = String(code).trim();
  return codeStr.slice(-8);
};

// Prefijo de las Restriccion que guarda "Plan Táctico (Alpha)" (ProvisionalOrdersAlphaTab.tsx) cada vez
// que se ejecuta/modula la Distribución de Mesas: una fila por fecha objetivo
// (nombre_restriccion = "PlanDiarioConfig:<YYYY-MM-DD>") con el horario, las mesas, el personal
// asignado y el Gantt de esa fecha, serializado en JSON dentro de `descripcion`. Esta pestaña "PLAN"
// consume esos snapshots (ya vienen en la prop `restricciones`, filtrada por el Grupo de Muebles) en
// vez de recalcular una aproximación propia con un horario/N° de mesas genérico.
const PLAN_DIARIO_PREFIJO = 'PlanDiarioConfig:';

// Solo para el texto "1 equivalente = X min" del recuadro "Unidades Equivalentes Planificadas" — el
// valor numérico en sí ya viene calculado y congelado en PlanDiarioSnapshotResumen.unidadesEquivalentesPlanificadas
// (ver MINUTOS_POR_MUEBLE_EQUIVALENTE en ProvisionalOrdersAlphaTab.tsx, ambos deben evolucionar juntos).
const MINUTOS_POR_MUEBLE_EQUIVALENTE_PLAN = 32.21;

// Copia local de las formas de PlanDiarioSnapshot (definidas en ProvisionalOrdersAlphaTab.tsx) — es el
// contrato JSON persistido en `descripcion`, así que ambas copias deben evolucionar juntas si cambia el
// guardado en "Plan Táctico (Alpha)".
interface PlanDiarioSnapshotItem {
  material: string;
  nombre: string;
  source: 'Previsional' | 'Fert';
  id: string;
  cantidad: number;
  tamano: 'Pequeño' | 'Mediano' | 'Grande' | null;
  startHour: number;
  endHour: number;
  overflow: boolean;
}

interface PlanDiarioSnapshotMesa {
  tableId: number;
  tableName: string;
  linea: 'Línea 1 – Línea de Camas' | 'Línea 2 – Línea de Muebles';
  capacityHours: number;
  usedHours: number;
  person: string;
  percentage: string;
  calificacion: number | null;
  items: PlanDiarioSnapshotItem[];
}

// Mismos 6 recuadros de "Detalle de Planificación Ejecutada" de "Plan Táctico (Alpha)", congelados en
// el momento de guardar el snapshot (ver ProvisionalOrdersAlphaTab.tsx) — permite mostrar ese resumen
// para fechas ya ejecutadas sin re-derivar la clasificación inmediata/diferida/movible/extra.
interface PlanDiarioSnapshotResumen {
  horasRequeridas: number;
  capacidadDisponible: number;
  deficitCapacidad: number; // negativo = déficit real, positivo = capacidad sobrante
  ordenesMtsAdicionalesCount: number;
  ordenesMtsAdicionalesHoras: number;
  unidadesFisicasPlanificadas: number;
  ordenesPlanificadasTotal: number;
  diferidasCount: number;
  moviblesCount: number;
  unidadesEquivalentesPlanificadas: number;
}

interface PlanDiarioSnapshot {
  fecha: string;
  shiftId: string;
  shiftLabel: string;
  shiftStartTime: string;
  shiftDisplayEndTime: string;
  mesas: PlanDiarioSnapshotMesa[];
  resumen: PlanDiarioSnapshotResumen | null;
}

interface PlanSummaryDay {
  date: string;
  snapshot: PlanDiarioSnapshot | null;
  cantProgramada: number;
  tiempoTotalH: number;
  capacidadTotalH: number;
  mesas: PlanDiarioSnapshotMesa[];
}

// Escala fija del eje X del Diagrama de Gantt (en horas) — igual patrón/valor que en "Plan Táctico (Alpha)"
const GANTT_HOURS_SCALE = 12;

const parseHHMM = (time: string): number => {
  const [h, m] = time.split(':').map(Number);
  return h * 60 + m;
};

// Hora real de reloj ("HH:MM") correspondiente a un offset en horas desde el inicio del turno guardado
// en el snapshot — mismo cálculo que el eje X del Gantt en "Plan Táctico (Alpha)"
const formatShiftClockLabel = (shiftStartTime: string, offsetHours: number): string => {
  const totalMinutes = parseHHMM(shiftStartTime) + Math.round(offsetHours * 60);
  const hh = Math.floor(totalMinutes / 60) % 24;
  const mm = totalMinutes % 60;
  return `${String(hh).padStart(2, '0')}:${String(mm).padStart(2, '0')}`;
};

const tamanoColorClass = (tamano: PlanDiarioSnapshotItem['tamano']): string => {
  if (tamano === 'Grande') return 'bg-red-200 border-red-300 text-red-800';
  if (tamano === 'Mediano') return 'bg-emerald-200 border-emerald-300 text-emerald-800';
  return 'bg-blue-200 border-blue-300 text-blue-800';
};

// Hora de inicio del "turno de referencia" usado por la Alerta de Riesgo (IA) de esta pestaña — un
// turno simple de un solo bloque, no ligado al horario/turno real elegido en "Plan Táctico (Alpha)"
// (esta pestaña "PLAN" es un visor de lo ya lanzado, no comparte ese estado). Mismo patrón que la
// pestaña "PLAN" del Taller de Corte (PlanTallerCorteTab.tsx).
const TURNO_REFERENCIA_INICIO = '07:00';
const TURNO_REFERENCIA_HORAS_OPTIONS = [8, 9, 10];

const stripAccents = (s: string): string => s.normalize('NFD').replace(/[̀-ͯ]/g, '');

// Umbral (minutos de tiempo unitario de fabricación) que separa "Sofás Pequeños" de "Sofás Grandes" en
// el cuadro "Resumen por Tipo de Mueble" — acordado explícitamente con el usuario (2026-08-26): mismo
// valor que ya usa "Plan Táctico (Alpha)" para el corte Mediano/Grande en Muebles (SIZE_THRESHOLDS,
// ProvisionalOrdersAlphaTab.tsx), duplicado aquí a propósito (ambos archivos evolucionan por separado).
const SOFA_MINUTOS_GRANDE = 147;

type TipoMueble = 'CAMAS' | 'CABECEROS' | 'SOFAS_PEQUEÑOS' | 'SOFAS_GRANDES' | 'OTROS';

const TIPO_MUEBLE_ORDEN: TipoMueble[] = ['CAMAS', 'CABECEROS', 'SOFAS_PEQUEÑOS', 'SOFAS_GRANDES', 'OTROS'];

const TIPO_MUEBLE_LABEL: Record<TipoMueble, string> = {
  CAMAS: 'Camas (Grandes y Pequeñas)',
  CABECEROS: 'Cabeceros',
  SOFAS_PEQUEÑOS: 'Sofás Pequeños',
  SOFAS_GRANDES: 'Sofás Grandes',
  OTROS: 'Otros (Bench, Veladores, etc.)',
};

// Clasificación por palabras clave en la descripción (NOMBRE) — "CAMA"/"CABECERO" priman sobre "SOFA"
// porque no se solapan en la práctica; todo lo que no matchea ninguna palabra clave cae en "Otros".
// Cabeceros: además de la palabra completa "CABECERO", muchos vienen con el nombre abreviado empezando
// directamente en "CAB" (ej. "CAB CAPRI 105...", confirmado en vivo por el usuario 2026-09-28 — sin esto
// caían silenciosamente en "Otros", ej. las 12 órdenes de cabecero de la fecha objetivo 01/10/2026 que
// se veían en el sistema pero el resumen mostraba en 0).
const clasificarTipoMueble = (nombreRaw: string, tiempoUnitMin: number): TipoMueble => {
  const n = stripAccents(String(nombreRaw || '').toUpperCase());
  if (n.startsWith('CAB') || n.includes('CABECERO')) return 'CABECEROS';
  if (n.includes('CAMA')) return 'CAMAS';
  if (n.includes('SOFA')) return tiempoUnitMin > SOFA_MINUTOS_GRANDE ? 'SOFAS_GRANDES' : 'SOFAS_PEQUEÑOS';
  return 'OTROS';
};

// Ventana de fabricación para la Alerta de Riesgo de Stock de Insumos: hoy + los 13 días siguientes (14
// días calendario en total). Independiente del filtro Fecha(s) de arriba — igual que resumenPorFecha, es
// una vista fija sobre TODO el histórico cargado.
// Ampliada de 3 a 14 días (2026-09-08, a pedido explícito del usuario) tras investigar en vivo por qué
// dos telas con stock casi nulo (0.12/5.06, "TELA MUEBLES RESIFLEX HUGO...") no aparecían en riesgo: sí
// tenían >60 órdenes Fert pendientes reales, pero todas con FECHA 6-20 días en el futuro (concentradas
// ~09-14), fuera de la ventana de 3 días vigente entonces. Además esas telas tienen
// `PlazoEntregaPrevisto` (lead time de compra) = 8 días en el Cubo de Inventarios — con una ventana de
// solo 3 días, la alerta nunca alcanzaría a dar aviso a tiempo para reordenar. 14 días da margen sobre
// ese lead time observado; no se implementó ventana dinámica por insumo (usar el propio
// PlazoEntregaPrevisto de cada uno) porque el usuario eligió explícitamente la opción más simple de
// ampliar el valor fijo, no la variante dinámica.
const INSUMO_VENTANA_DIAS = 14;

// Prefijos de DESCRIPCION_COMPONENTE que identifican insumos comprados (no fabricados en planta) más
// allá de Telas/Cascos — pedido explícito del usuario (2026-09-08) para ampliar la Alerta de Riesgo de
// Stock a cartón, herrajes, plásticos, etc. Cada prefijo se usa tal cual como etiqueta de "tipo" en la
// UI (capitalizado), salvo que se indique lo contrario en INSUMO_PREFIJO_LABEL.
const INSUMO_PREFIJOS_GENERALES = [
  'CARTON', 'CERTIFICADO', 'ETIQUETA', 'FUNDA', 'GARRUCHA', 'HERRAJE', 'NIVELADOR',
  'PADDING', 'PATA', 'PLACA', 'PLASTICO', 'RESBALON', 'RODELA', 'STICKER',
  'TACO', 'TORNILLO',
];

const INSUMO_PREFIJO_LABEL: Record<string, string> = {
  CARTON: 'Cartón', CERTIFICADO: 'Certificado', ETIQUETA: 'Etiqueta', FUNDA: 'Funda',
  GARRUCHA: 'Garrucha', HERRAJE: 'Herraje', NIVELADOR: 'Nivelador', PADDING: 'Padding',
  PATA: 'Pata', PLACA: 'Placa', PLASTICO: 'Plástico', RESBALON: 'Resbalón',
  RODELA: 'Rodela', STICKER: 'Sticker', TACO: 'Taco', TORNILLO: 'Tornillo',
};

// Prefijos de componentes ficticios/semielaborados fabricados en planta (no son insumos comprados) —
// se descartan explícitamente aunque coincidieran por error con algún prefijo de insumo real, pedido
// explícito del usuario. "PLUMON" se agregó el 2026-09-08 (segunda corrección): no es un insumo comprado,
// es un semielaborado fabricado en planta, se descarta igual que ENSAMBLE/BASE/ESTRUCTURA/etc. No se
// solapan hoy con INSUMO_PREFIJOS_GENERALES, pero se chequean primero como salvaguarda ante futuros
// prefijos que sí puedan colisionar.
const COMPONENTE_FICTICIO_PREFIJOS = ['ENSAMBLE', 'BASE', 'ESTRUCTURA', 'FORRO BASE', 'FORRO', 'LAMINA', 'PLUMON'];

// Identifica el tipo de insumo por la descripción del COMPONENTE de la explosión de materiales. Telas y
// Cascos (criterio ya usado en "Plan Táctico (Alpha)": "TELA MUEBLES..." / "CASCO...") siguen siendo los
// más relevantes; a partir de 2026-09-08 se amplía a otros insumos comprados vía
// INSUMO_PREFIJOS_GENERALES, descartando explícitamente semielaborados fabricados en planta. Devuelve
// null si no matchea ningún insumo conocido o si es un componente ficticio a descartar.
const clasificarTipoInsumo = (descripcionUpper: string): string | null => {
  if (descripcionUpper.startsWith('TELA MUEBLES')) return 'Tela';
  if (descripcionUpper.startsWith('CASCO')) return 'Casco';
  if (COMPONENTE_FICTICIO_PREFIJOS.some(p => descripcionUpper.startsWith(p))) return null;
  const prefijo = INSUMO_PREFIJOS_GENERALES.find(p => descripcionUpper.startsWith(p));
  return prefijo ? INSUMO_PREFIJO_LABEL[prefijo] : null;
};

// Devuelve los códigos (normalizados) que cuelgan, a cualquier profundidad, de "TELA DE APROVECHAMIENTO"
// (material 30020937) dentro de la explosión de un material padre. Este material es un "cajón de
// sastre" que en SAP lista como sus propios "componentes" una muestra fija de ~10 telas de colores/
// productos completamente distintos (todas con cantidad placeholder 0.25/1, sin relación con lo que el
// pedido realmente usa) — NO es consumo real. Confirmado en vivo (2026-08-26): la explosión de
// "SOFÁ FOAM 105 ELEMENTA BRUMA" (20014132) incluye, colgando de 30020937, "TELA MUEBLES ASTRA BEIGE
// WESTVIEW STUCCO" (40003011) y "TELA MUEBLES EPIC BRUMA FLEMMINGS STORM" (40002771) — ninguna es la
// tela real del pedido. Mismo hallazgo y mismo fix que getCodigosBajoTelaAprovechamiento en
// ProvisionalOrdersAlphaTab.tsx (duplicado aquí a propósito).
const getCodigosBajoTelaAprovechamiento = (components: any[]): Set<string> => {
  const hijosPorPadre = new Map<string, any[]>();
  const raices: string[] = [];
  components.forEach((comp: any) => {
    const padre = normalizeMaterialCode(comp.MATERIAL_PADRE || '');
    const codigo = normalizeMaterialCode(comp.COMPONENTE || '');
    if (padre) {
      if (!hijosPorPadre.has(padre)) hijosPorPadre.set(padre, []);
      hijosPorPadre.get(padre)!.push(comp);
    }
    const desc = String(comp.DESCRIPCION_COMPONENTE || '').trim().toUpperCase();
    if (codigo && (desc.startsWith('TELA DE APROVECHAMIENTO') || codigo === '30020937')) {
      raices.push(codigo);
    }
  });
  const bajoAprovechamiento = new Set<string>(raices);
  const pendientes = [...raices];
  while (pendientes.length > 0) {
    const actual = pendientes.pop()!;
    (hijosPorPadre.get(actual) || []).forEach((hijo: any) => {
      const codigoHijo = normalizeMaterialCode(hijo.COMPONENTE || '');
      if (codigoHijo && !bajoAprovechamiento.has(codigoHijo)) {
        bajoAprovechamiento.add(codigoHijo);
        pendientes.push(codigoHijo);
      }
    });
  }
  return bajoAprovechamiento;
};

interface InsumoRiesgoItem {
  tipo: string;
  componente: string;
  descripcion: string;
  unidad: string;
  necesario: number;
  stockActual: number | null;
  consumoPasado: number;
  disponibleReal: number | null;
  cantidadNetaAConseguir: number;
}

// Una fila de "GENERAR INFORME DE RIESGO": una orden (Previsional o Fert) que consume, como componente
// de su explosión de materiales, el insumo en riesgo — con el detalle de pedido/cliente resuelto vía
// Pendientes Totales, igual patrón que ParentOrderRow en PlanGrupoRecuperadoTab.tsx.
interface InsumoOrdenDetalle {
  source: 'Previsional' | 'Fert';
  id: string;
  pedido: string;
  posicion: string;
  material: string;
  nombre: string;
  cliente: string;
  fecha: string;
  cantidadPendiente: number;
  consumoComponente: number;
  ventana: 'Pasada' | 'Futura';
}

// Diagrama de Gantt "tal cual" el de "Plan Táctico (Alpha)" (mismo layout/colores/leyenda/eje de
// horas), pero de SOLO LECTURA: redibuja el Gantt guardado en el snapshot de cada fecha seleccionada
// que sí tenga un Plan Diario guardado (punto 4 del pedido del usuario, 2026-08-25) — no recalcula nada.
const PlanDiarioGanttSection: React.FC<{ planSummaryByDate: PlanSummaryDay[] }> = ({ planSummaryByDate }) => {
  const diasConSnapshot = planSummaryByDate.filter(d => d.snapshot && d.mesas.length > 0);
  if (diasConSnapshot.length === 0) return null;

  return (
    <div className="bg-white border border-gray-200 rounded-xl shadow-md overflow-hidden mt-4">
      <div className="flex items-center gap-2 px-6 py-4 bg-gradient-to-r from-slate-900 to-purple-900">
        <LayoutDashboard className="w-5 h-5 text-purple-200" />
        <h3 className="text-sm font-bold text-white uppercase tracking-wide">Diagrama de Gantt — Plan Diario Guardado (Plan Táctico)</h3>
      </div>
      <div className="p-6 space-y-8">
        {diasConSnapshot.map(day => {
          const snapshot = day.snapshot!;
          const endShiftHours = (parseHHMM(snapshot.shiftDisplayEndTime) - parseHHMM(snapshot.shiftStartTime)) / 60;
          const endShiftLeftPct = endShiftHours > 0 && endShiftHours <= GANTT_HOURS_SCALE ? (endShiftHours / GANTT_HOURS_SCALE) * 100 : null;

          return (
            <div key={day.date} className="space-y-4">
              <h4 className="text-xs font-extrabold text-gray-700 uppercase tracking-wide border-b border-dashed border-gray-300 pb-1">
                {day.date} — {snapshot.shiftLabel}
              </h4>

              <div className="flex flex-wrap items-center gap-4 text-[11px] text-gray-600">
                <span className="inline-flex items-center gap-1.5"><span className="w-3 h-3 rounded-sm bg-red-200 border border-red-300 inline-block" /> Grande</span>
                <span className="inline-flex items-center gap-1.5"><span className="w-3 h-3 rounded-sm bg-emerald-200 border border-emerald-300 inline-block" /> Mediano</span>
                <span className="inline-flex items-center gap-1.5"><span className="w-3 h-3 rounded-sm bg-blue-200 border border-blue-300 inline-block" /> Pequeño</span>
                <span className="inline-flex items-center gap-1.5 text-gray-600">
                  <span className="w-3 border-t-[3px] border-dashed border-slate-600 inline-block" /> Límite de capacidad de la mesa
                </span>
                <span className="inline-flex items-center gap-1.5 text-gray-600">
                  <span className="w-3 border-t-4 border-slate-900 inline-block" /> Fin de turno ({snapshot.shiftDisplayEndTime})
                </span>
              </div>

              <div className="relative">
                {endShiftLeftPct !== null && (
                  <div
                    className="pointer-events-none absolute top-0 bottom-0 z-30 border-r-4 border-slate-900"
                    style={{ left: `calc(11.75rem + (100% - 16rem) * ${endShiftLeftPct / 100})` }}
                    title={`Fin de turno: ${snapshot.shiftDisplayEndTime}`}
                  />
                )}

                <div className="space-y-6">
                  {(['Línea 1 – Línea de Camas', 'Línea 2 – Línea de Muebles'] as const).map(linea => {
                    const mesasLinea = day.mesas.filter(m => m.linea === linea);
                    if (mesasLinea.length === 0) return null;

                    return (
                      <div key={linea} className="space-y-3">
                        <h5 className="text-[11px] font-extrabold text-gray-600 uppercase tracking-wide">{linea}</h5>
                        {mesasLinea.map(mesa => {
                          const utilizacionPct = mesa.capacityHours > 0 ? (mesa.usedHours / mesa.capacityHours) * 100 : 0;
                          return (
                            <div key={mesa.tableId} className="flex items-stretch gap-3">
                              <div className="w-44 shrink-0 flex flex-col justify-center">
                                <p className="text-xs font-bold text-gray-800">{mesa.tableName}</p>
                                <p className="text-sm font-extrabold text-gray-900 font-mono">{mesa.usedHours.toFixed(2)} / {mesa.capacityHours.toFixed(2)} h</p>
                              </div>
                              <div className="flex-1">
                                <div className="relative h-10 bg-gray-50 border border-gray-200 rounded-md overflow-hidden">
                                  {mesa.capacityHours > 0 && mesa.capacityHours <= GANTT_HOURS_SCALE && (
                                    <div
                                      className="absolute top-0 bottom-0 border-l-[3px] border-dashed border-slate-600 z-20"
                                      style={{ left: `${(mesa.capacityHours / GANTT_HOURS_SCALE) * 100}%` }}
                                      title={`Límite de capacidad: ${mesa.capacityHours.toFixed(2)} h`}
                                    />
                                  )}
                                  {mesa.items.map((item, idx) => {
                                    const left = (item.startHour / GANTT_HOURS_SCALE) * 100;
                                    const width = ((item.endHour - item.startHour) / GANTT_HOURS_SCALE) * 100;
                                    return (
                                      <div
                                        key={`${item.source}-${item.id}-${item.material}-${idx}`}
                                        className={cn(
                                          "absolute top-0.5 bottom-0.5 border rounded-sm px-1 flex items-center overflow-hidden",
                                          tamanoColorClass(item.tamano),
                                          item.overflow && "ring-2 ring-red-600"
                                        )}
                                        style={{ left: `${left}%`, width: `${Math.max(width, 0.5)}%` }}
                                        title={`${item.nombre} (${item.material}) — ${item.tamano ?? '—'} — ${(item.endHour - item.startHour).toFixed(2)} h${item.overflow ? ' — EXCEDE CAPACIDAD' : ''}`}
                                      >
                                        <span className="text-[9px] font-semibold truncate">{item.material}</span>
                                      </div>
                                    );
                                  })}
                                </div>
                              </div>
                              <div className="w-14 shrink-0 flex items-center justify-end">
                                <span className={cn("text-xs font-extrabold", utilizacionPct > 100 ? 'text-red-600' : utilizacionPct >= 90 ? 'text-emerald-700' : 'text-gray-600')}>
                                  {utilizacionPct.toFixed(0)}%
                                </span>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    );
                  })}

                  <div className="flex items-stretch gap-3">
                    <div className="w-44 shrink-0" />
                    <div className="flex-1 flex justify-between text-[9px] text-gray-400 font-mono px-0.5">
                      {Array.from({ length: GANTT_HOURS_SCALE + 1 }, (_, h) => h).filter(h => h % 2 === 0).map(h => (
                        <span key={h}>{formatShiftClockLabel(snapshot.shiftStartTime, h)}</span>
                      ))}
                    </div>
                    <div className="w-14 shrink-0" />
                  </div>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};

// ---------------------------------------------------------------------------------------------
// Generación del cuerpo HTML del correo "PLAN" (2026-09-06): reconstruye, en HTML basado 100% en
// <table>/estilos inline (nada de flexbox/grid — no son confiables en clientes de correo tipo
// Outlook), las mismas 5 secciones que se ven en pantalla para las fechas actualmente filtradas:
// 1) Resumen de Órdenes Lanzadas por Fecha, 2) Resumen por Tipo de Mueble, 3) Capacidad Consolidada +
// Estado de Órdenes, 4) Desglose por Fecha y Mesa, 5) Diagrama de Gantt (aproximado con celdas de
// tabla de ancho fijo en vez de posicionamiento absoluto).
const escapeHtml = (s: unknown): string =>
  String(s ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');

const tamanoColorHex = (tamano: PlanDiarioSnapshotItem['tamano']): { bg: string; text: string; border: string } => {
  if (tamano === 'Grande') return { bg: '#fecaca', text: '#991b1b', border: '#fca5a5' };
  if (tamano === 'Mediano') return { bg: '#a7f3d0', text: '#065f46', border: '#6ee7b7' };
  return { bg: '#bfdbfe', text: '#1e40af', border: '#93c5fd' };
};

const CORREO_TH_STYLE = 'padding:6px 10px;text-align:center;font-size:11px;font-weight:bold;color:#374151;background:#f3f4f6;border:1px solid #d1d5db;white-space:nowrap;';
const CORREO_TD_STYLE = 'padding:6px 10px;text-align:center;font-size:12px;color:#111827;border:1px solid #e5e7eb;';
const CORREO_SECTION_TITLE_STYLE = 'font-size:13px;font-weight:bold;color:#ffffff;background:#312e81;padding:8px 12px;margin:0;';

const buildResumenPorFechaHtml = (
  resumenPorFecha: { fecha: string; ordenes: number; unidades: number; horas: number; sinTiempoCount: number }[]
): string => {
  if (resumenPorFecha.length === 0) return '<p style="font-size:12px;color:#6b7280;">No hay órdenes lanzadas.</p>';
  const totalOrdenes = resumenPorFecha.reduce((s, r) => s + r.ordenes, 0);
  const totalUnidades = resumenPorFecha.reduce((s, r) => s + r.unidades, 0);
  const totalHoras = resumenPorFecha.reduce((s, r) => s + r.horas, 0);
  const fechaCols = resumenPorFecha.map(r => `<th style="${CORREO_TH_STYLE}">${escapeHtml(r.fecha)}</th>`).join('');
  const ordenesCols = resumenPorFecha.map(r => `<td style="${CORREO_TD_STYLE}">${r.ordenes}</td>`).join('');
  const unidadesCols = resumenPorFecha.map(r => `<td style="${CORREO_TD_STYLE}">${r.unidades.toLocaleString()}</td>`).join('');
  const horasCols = resumenPorFecha.map(r => `<td style="${CORREO_TD_STYLE}color:#1d4ed8;font-weight:600;">${r.horas.toFixed(2)}${r.sinTiempoCount > 0 ? ' *' : ''}</td>`).join('');
  return `
    <table style="border-collapse:collapse;width:100%;" cellpadding="0" cellspacing="0">
      <tr><th style="${CORREO_TH_STYLE}text-align:left;">Fecha</th>${fechaCols}<th style="${CORREO_TH_STYLE}background:#e5e7eb;">Total</th></tr>
      <tr><td style="${CORREO_TD_STYLE}text-align:left;font-weight:bold;">Órdenes Lanzadas</td>${ordenesCols}<td style="${CORREO_TD_STYLE}font-weight:bold;background:#f9fafb;">${totalOrdenes}</td></tr>
      <tr><td style="${CORREO_TD_STYLE}text-align:left;font-weight:bold;">Unidades Lanzadas</td>${unidadesCols}<td style="${CORREO_TD_STYLE}font-weight:bold;background:#f9fafb;">${totalUnidades.toLocaleString()}</td></tr>
      <tr><td style="${CORREO_TD_STYLE}text-align:left;font-weight:bold;">Horas Requeridas</td>${horasCols}<td style="${CORREO_TD_STYLE}font-weight:bold;color:#1d4ed8;background:#f9fafb;">${totalHoras.toFixed(2)}</td></tr>
    </table>
    ${resumenPorFecha.some(r => r.sinTiempoCount > 0) ? '<p style="font-size:10px;color:#b45309;">* Hay orden(es) sin tiempo unitario cargado, no incluida(s) en la suma de horas.</p>' : ''}`;
};

const buildResumenPorTipoMuebleHtml = (
  resumenPorTipoMueble: { tipo: TipoMueble; unidades: number; ordenes: number; pct: number }[]
): string => {
  if (resumenPorTipoMueble.length === 0) return '<p style="font-size:12px;color:#6b7280;">Sin datos.</p>';
  const rows = resumenPorTipoMueble.map(r => `
    <tr>
      <td style="${CORREO_TD_STYLE}text-align:left;font-weight:bold;">${escapeHtml(TIPO_MUEBLE_LABEL[r.tipo])}</td>
      <td style="${CORREO_TD_STYLE}">${r.unidades.toLocaleString()}</td>
      <td style="${CORREO_TD_STYLE}">${r.ordenes}</td>
      <td style="${CORREO_TD_STYLE}font-weight:bold;color:#4338ca;">${r.pct.toFixed(1)}%</td>
    </tr>`).join('');
  return `
    <table style="border-collapse:collapse;width:100%;" cellpadding="0" cellspacing="0">
      <tr>
        <th style="${CORREO_TH_STYLE}text-align:left;">Tipo de Mueble</th>
        <th style="${CORREO_TH_STYLE}">Unidades</th>
        <th style="${CORREO_TH_STYLE}">Órdenes</th>
        <th style="${CORREO_TH_STYLE}">% Participación</th>
      </tr>
      ${rows}
    </table>`;
};

// Mismos 6 recuadros de "Detalle de Planificación Ejecutada" (ver el bloque equivalente en JSX,
// detalleEjecutadoResumen) — dos filas de 3 columnas, mismo patrón de tabla título+valores que el resto
// del correo (buildCapacidadEstadoHtml, etc.), para que se vea bien también en Outlook.
const buildDetalleEjecutadoHtml = (r: {
  horasRequeridas: number;
  capacidadDisponible: number;
  deficitCapacidad: number;
  ordenesMtsAdicionalesCount: number;
  ordenesMtsAdicionalesHoras: number;
  unidadesFisicasPlanificadas: number;
  ordenesPlanificadasTotal: number;
  diferidasCount: number;
  moviblesCount: number;
  unidadesEquivalentesPlanificadas: number;
  fechasConDatos: number;
  fechasSinDatos: number;
}): string => {
  const esSobrante = r.deficitCapacidad >= 0;
  return `
    <p style="font-size:10px;color:#6b7280;margin:0 0 8px;">${r.fechasConDatos} fecha(s) con datos${r.fechasSinDatos > 0 ? ` · ${r.fechasSinDatos} sin Distribución de Mesas guardada` : ''}</p>
    <table style="border-collapse:collapse;width:100%;margin-bottom:8px;" cellpadding="0" cellspacing="0">
      <tr>
        <th style="${CORREO_TH_STYLE}">Horas Requeridas (Compromisos Inmediatos)</th>
        <th style="${CORREO_TH_STYLE}">Capacidad Disponible</th>
        <th style="${CORREO_TH_STYLE}${esSobrante ? 'color:#15803d;' : 'color:#b91c1c;'}">${esSobrante ? 'Capacidad Sobrante' : 'Déficit de Capacidad'}</th>
      </tr>
      <tr>
        <td style="${CORREO_TD_STYLE}font-weight:bold;color:#1d4ed8;">${r.horasRequeridas.toFixed(2)} h</td>
        <td style="${CORREO_TD_STYLE}font-weight:bold;color:#15803d;">${r.capacidadDisponible.toFixed(2)} h</td>
        <td style="${CORREO_TD_STYLE}font-weight:bold;${esSobrante ? 'color:#15803d;' : 'color:#b91c1c;'}">${Math.abs(r.deficitCapacidad).toFixed(2)} h</td>
      </tr>
    </table>
    <table style="border-collapse:collapse;width:100%;" cellpadding="0" cellspacing="0">
      <tr>
        <th style="${CORREO_TH_STYLE}">Órdenes MTS Adicionales (Relleno de Capacidad)</th>
        <th style="${CORREO_TH_STYLE}">Unidades Físicas Planificadas</th>
        <th style="${CORREO_TH_STYLE}">Unidades Equivalentes Planificadas</th>
      </tr>
      <tr>
        <td style="${CORREO_TD_STYLE}font-weight:bold;color:#6d28d9;">${r.ordenesMtsAdicionalesCount}<br/><span style="font-size:10px;font-weight:normal;">${r.ordenesMtsAdicionalesHoras.toFixed(2)} h agregadas</span></td>
        <td style="${CORREO_TD_STYLE}font-weight:bold;color:#4338ca;">${r.unidadesFisicasPlanificadas.toLocaleString()}<br/><span style="font-size:10px;font-weight:normal;">${r.ordenesPlanificadasTotal} órdenes en total${(r.diferidasCount > 0 || r.moviblesCount > 0) ? ` (excl. ${r.diferidasCount} diferida(s)/${r.moviblesCount} movible(s))` : ''}</span></td>
        <td style="${CORREO_TD_STYLE}font-weight:bold;color:#0e7490;">${r.unidadesEquivalentesPlanificadas.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}<br/><span style="font-size:10px;font-weight:normal;">1 equiv. = ${MINUTOS_POR_MUEBLE_EQUIVALENTE_PLAN} min</span></td>
      </tr>
    </table>`;
};

const buildCapacidadEstadoHtml = (
  globalSummary: { totalCant: number; totalHours: number },
  avgDailyCapacityHours: number,
  statusSummary: { pastCant: number; pastHours: number; todayCant: number; todayHours: number; futureCant: number; futureHours: number }
): string => {
  const diasCarga = avgDailyCapacityHours > 0 ? (globalSummary.totalHours / avgDailyCapacityHours).toFixed(1) : '—';
  return `
    <table style="border-collapse:collapse;width:100%;" cellpadding="0" cellspacing="0">
      <tr>
        <td style="vertical-align:top;padding:0 6px 0 0;width:50%;">
          <p style="${CORREO_SECTION_TITLE_STYLE}border-radius:6px 6px 0 0;">CAPACIDAD CONSOLIDADA (TOTAL SISTEMA)</p>
          <table style="border-collapse:collapse;width:100%;" cellpadding="0" cellspacing="0">
            <tr>
              <th style="${CORREO_TH_STYLE}">Unidades Totales</th>
              <th style="${CORREO_TH_STYLE}">Horas Totales</th>
              <th style="${CORREO_TH_STYLE}">Días Carga</th>
            </tr>
            <tr>
              <td style="${CORREO_TD_STYLE}font-weight:bold;">${globalSummary.totalCant.toLocaleString()}</td>
              <td style="${CORREO_TD_STYLE}font-weight:bold;color:#4338ca;">${globalSummary.totalHours.toFixed(1)}h</td>
              <td style="${CORREO_TD_STYLE}font-weight:bold;color:#1d4ed8;">${diasCarga} Días</td>
            </tr>
          </table>
        </td>
        <td style="vertical-align:top;padding:0 0 0 6px;width:50%;">
          <p style="${CORREO_SECTION_TITLE_STYLE}border-radius:6px 6px 0 0;">ESTADO DE ÓRDENES (CRONOLÓGICO)</p>
          <table style="border-collapse:collapse;width:100%;" cellpadding="0" cellspacing="0">
            <tr>
              <th style="${CORREO_TH_STYLE}color:#b91c1c;">Atrasadas</th>
              <th style="${CORREO_TH_STYLE}color:#1d4ed8;">Hoy</th>
              <th style="${CORREO_TH_STYLE}color:#15803d;">Por Planificar</th>
            </tr>
            <tr>
              <td style="${CORREO_TD_STYLE}background:#fef2f2;color:#b91c1c;font-weight:bold;">${statusSummary.pastCant.toLocaleString()}<br/><span style="font-size:10px;font-weight:normal;">${statusSummary.pastHours.toFixed(1)}h</span></td>
              <td style="${CORREO_TD_STYLE}background:#eff6ff;color:#1d4ed8;font-weight:bold;">${statusSummary.todayCant.toLocaleString()}<br/><span style="font-size:10px;font-weight:normal;">${statusSummary.todayHours.toFixed(1)}h</span></td>
              <td style="${CORREO_TD_STYLE}background:#f0fdf4;color:#15803d;font-weight:bold;">${statusSummary.futureCant.toLocaleString()}<br/><span style="font-size:10px;font-weight:normal;">${statusSummary.futureHours.toFixed(1)}h</span></td>
            </tr>
          </table>
        </td>
      </tr>
    </table>`;
};

const buildDesglosePorFechaYMesaHtml = (planSummaryByDate: PlanSummaryDay[]): string => {
  if (planSummaryByDate.length === 0) return '<p style="font-size:12px;color:#6b7280;">No hay fechas seleccionadas para analizar capacidad.</p>';
  return planSummaryByDate.map(day => {
    if (!day.snapshot) {
      return `
        <div style="margin-bottom:14px;border:1px solid #e5e7eb;border-radius:6px;overflow:hidden;">
          <p style="margin:0;padding:6px 10px;background:#4338ca;color:#ffffff;font-size:12px;font-weight:bold;text-align:center;">FECHA: ${escapeHtml(day.date)}</p>
          <p style="margin:0;padding:10px;background:#fffbeb;color:#92400e;font-size:11px;font-style:italic;text-align:center;">No hay un Plan Diario guardado para esta fecha.</p>
        </div>`;
    }
    const capacidadOcupadaTotal = day.capacidadTotalH > 0 ? (day.tiempoTotalH / day.capacidadTotalH) * 100 : 0;
    const rows = day.mesas.map(mesa => {
      const capMesa = mesa.capacityHours > 0 ? (mesa.usedHours / mesa.capacityHours) * 100 : 0;
      const cantMesa = mesa.items.reduce((s, it) => s + it.cantidad, 0);
      const personalLabel = mesa.person
        ? `${mesa.person}${mesa.percentage ? ` (${mesa.percentage}%)` : ''}${mesa.calificacion !== null ? ` — Capacitación ${mesa.calificacion}%` : ''}`
        : 'Sin Asignar';
      return `
        <tr${cantMesa === 0 ? ' style="background:#fee2e2;"' : ''}>
          <td style="${CORREO_TD_STYLE}text-align:left;font-weight:600;">${escapeHtml(mesa.tableName)}</td>
          <td style="${CORREO_TD_STYLE}text-align:left;color:#1d4ed8;">${escapeHtml(personalLabel)}</td>
          <td style="${CORREO_TD_STYLE}">${cantMesa}</td>
          <td style="${CORREO_TD_STYLE}">${mesa.usedHours.toFixed(2)}</td>
          <td style="${CORREO_TD_STYLE}color:#6b7280;">${mesa.capacityHours.toFixed(2)}</td>
          <td style="${CORREO_TD_STYLE}font-weight:bold;${capMesa > 100 ? 'color:#dc2626;background:#fef2f2;' : 'color:#1d4ed8;'}">${capMesa.toFixed(1)}%</td>
        </tr>`;
    }).join('');
    return `
      <div style="margin-bottom:14px;border:1px solid #e5e7eb;border-radius:6px;overflow:hidden;">
        <p style="margin:0;padding:6px 10px;background:#4338ca;color:#ffffff;font-size:11px;font-weight:bold;text-align:center;">
          FECHA: ${escapeHtml(day.date)} &nbsp;|&nbsp; CANT: ${day.cantProgramada.toLocaleString()} &nbsp;|&nbsp; REQ: ${day.tiempoTotalH.toFixed(1)}h &nbsp;|&nbsp; DISP: ${day.capacidadTotalH.toFixed(1)}h (${escapeHtml(day.snapshot.shiftLabel)}) &nbsp;|&nbsp; OCUPACIÓN: ${capacidadOcupadaTotal.toFixed(1)}%
        </p>
        <table style="border-collapse:collapse;width:100%;" cellpadding="0" cellspacing="0">
          <tr>
            <th style="${CORREO_TH_STYLE}text-align:left;">Mesa</th>
            <th style="${CORREO_TH_STYLE}text-align:left;">Personal</th>
            <th style="${CORREO_TH_STYLE}">Cant</th>
            <th style="${CORREO_TH_STYLE}">Horas Req</th>
            <th style="${CORREO_TH_STYLE}">Horas Disp</th>
            <th style="${CORREO_TH_STYLE}">Ocupación %</th>
          </tr>
          ${rows}
        </table>
      </div>`;
  }).join('');
};

// Aproximación del Gantt de pantalla (posicionamiento absoluto en %) usando <table> de ancho fijo por
// mesa: se ordenan los ítems por hora de inicio y se intercalan celdas vacías (huecos) entre ellos —
// el ancho de cada celda en px es proporcional a su duración en horas. No requiere CSS de layout
// moderno, por lo que se ve razonablemente bien también en Outlook.
const GANTT_EMAIL_WIDTH_PX = 640;

const buildGanttHtml = (planSummaryByDate: PlanSummaryDay[]): string => {
  const diasConSnapshot = planSummaryByDate.filter(d => d.snapshot && d.mesas.length > 0);
  if (diasConSnapshot.length === 0) return '';
  const pxPerHour = GANTT_EMAIL_WIDTH_PX / GANTT_HOURS_SCALE;

  const dias = diasConSnapshot.map(day => {
    const snapshot = day.snapshot!;
    const mesasHtml = (['Línea 1 – Línea de Camas', 'Línea 2 – Línea de Muebles'] as const).map(linea => {
      const mesasLinea = day.mesas.filter(m => m.linea === linea);
      if (mesasLinea.length === 0) return '';
      const filas = mesasLinea.map(mesa => {
        const items = [...mesa.items].sort((a, b) => a.startHour - b.startHour);
        let cursor = 0;
        const celdas: string[] = [];
        items.forEach((item, idx) => {
          const gapHoras = item.startHour - cursor;
          if (gapHoras > 0.05) {
            celdas.push(`<td style="width:${Math.round(gapHoras * pxPerHour)}px;padding:0;border:none;"></td>`);
          }
          const anchoPx = Math.max(Math.round((item.endHour - item.startHour) * pxPerHour), 6);
          const { bg, text, border } = tamanoColorHex(item.tamano);
          celdas.push(`<td style="width:${anchoPx}px;height:26px;background:${bg};border:1px solid ${border};padding:0 2px;overflow:hidden;"><span style="font-size:8px;font-weight:600;color:${text};white-space:nowrap;">${escapeHtml(item.material)}</span></td>`);
          cursor = item.endHour;
        });
        if (cursor < GANTT_HOURS_SCALE) {
          celdas.push(`<td style="width:${Math.round((GANTT_HOURS_SCALE - cursor) * pxPerHour)}px;padding:0;border:none;"></td>`);
        }
        const utilizacionPct = mesa.capacityHours > 0 ? (mesa.usedHours / mesa.capacityHours) * 100 : 0;
        return `
          <tr>
            <td style="${CORREO_TD_STYLE}text-align:left;white-space:nowrap;width:130px;">
              <span style="font-weight:bold;">${escapeHtml(mesa.tableName)}</span><br/>
              <span style="font-family:monospace;font-size:10px;">${mesa.usedHours.toFixed(2)} / ${mesa.capacityHours.toFixed(2)} h</span>
            </td>
            <td style="padding:2px;border:1px solid #e5e7eb;background:#f9fafb;">
              <table cellpadding="0" cellspacing="0" style="border-collapse:collapse;width:${GANTT_EMAIL_WIDTH_PX}px;"><tr>${celdas.join('')}</tr></table>
            </td>
            <td style="${CORREO_TD_STYLE}width:50px;font-weight:bold;${utilizacionPct > 100 ? 'color:#dc2626;' : 'color:#374151;'}">${utilizacionPct.toFixed(0)}%</td>
          </tr>`;
      }).join('');
      return `
        <p style="margin:10px 0 4px;font-size:11px;font-weight:bold;color:#4b5563;text-transform:uppercase;">${escapeHtml(linea)}</p>
        <table style="border-collapse:collapse;" cellpadding="0" cellspacing="0">${filas}</table>`;
    }).join('');

    const horasEje = Array.from({ length: GANTT_HOURS_SCALE + 1 }, (_, h) => h).filter(h => h % 2 === 0)
      .map(h => `<td style="width:${Math.round(2 * pxPerHour)}px;font-size:9px;color:#9ca3af;font-family:monospace;">${formatShiftClockLabel(snapshot.shiftStartTime, h)}</td>`).join('');

    return `
      <div style="margin-bottom:20px;">
        <h4 style="font-size:12px;font-weight:bold;color:#374151;border-bottom:1px dashed #d1d5db;padding-bottom:4px;">${escapeHtml(day.date)} — ${escapeHtml(snapshot.shiftLabel)} (fin de turno ${escapeHtml(snapshot.shiftDisplayEndTime)})</h4>
        <p style="font-size:10px;color:#6b7280;">
          <span style="background:#fecaca;border:1px solid #fca5a5;padding:1px 5px;">&nbsp;</span> Grande &nbsp;
          <span style="background:#a7f3d0;border:1px solid #6ee7b7;padding:1px 5px;">&nbsp;</span> Mediano &nbsp;
          <span style="background:#bfdbfe;border:1px solid #93c5fd;padding:1px 5px;">&nbsp;</span> Pequeño
        </p>
        ${mesasHtml}
        <table cellpadding="0" cellspacing="0" style="border-collapse:collapse;margin-left:130px;"><tr>${horasEje}</tr></table>
      </div>`;
  }).join('');

  return `<div style="border:1px solid #e5e7eb;border-top:none;padding:12px;overflow-x:auto;">${dias}</div>`;
};

interface ReporteCorreoParams {
  fechasFiltro: string[];
  detalleEjecutado: {
    horasRequeridas: number;
    capacidadDisponible: number;
    deficitCapacidad: number;
    ordenesMtsAdicionalesCount: number;
    ordenesMtsAdicionalesHoras: number;
    unidadesFisicasPlanificadas: number;
    ordenesPlanificadasTotal: number;
    diferidasCount: number;
    moviblesCount: number;
    unidadesEquivalentesPlanificadas: number;
    fechasConDatos: number;
    fechasSinDatos: number;
  } | null;
  resumenPorFecha: { fecha: string; ordenes: number; unidades: number; horas: number; sinTiempoCount: number }[];
  resumenPorTipoMueble: { tipo: TipoMueble; unidades: number; ordenes: number; pct: number }[];
  globalSummary: { totalCant: number; totalHours: number };
  avgDailyCapacityHours: number;
  statusSummary: { pastCant: number; pastHours: number; todayCant: number; todayHours: number; futureCant: number; futureHours: number };
  planSummaryByDate: PlanSummaryDay[];
}

// Orden de secciones del informe por correo — pedido explícito del usuario 2026-09-16:
// 1. Detalle de Planificación Ejecutada, 2. Desglose por Fecha y Mesa, 3. Resumen por Tipo de Mueble,
// 4. Diagrama de Gantt, 5. Resumen de Órdenes Lanzadas por Fecha, 6. Capacidad Consolidada y Estado de
// Órdenes (antes el orden era distinto: Resumen por Fecha, Tipo de Mueble, Capacidad/Estado, Desglose,
// Gantt — y no existía la sección de Detalle de Planificación Ejecutada).
const buildReporteCorreoHtml = (p: ReporteCorreoParams): string => {
  const fechasLabel = p.fechasFiltro.length > 0 ? p.fechasFiltro.join(', ') : 'Todas las fechas disponibles';
  const seccionTitulo = (n: number, titulo: string) => `<p style="${CORREO_SECTION_TITLE_STYLE}border-radius:6px 6px 0 0;margin-top:20px;">${n}. ${escapeHtml(titulo)}</p>`;
  const ganttHtml = buildGanttHtml(p.planSummaryByDate);

  return `
    <div style="font-family:Arial, Helvetica, sans-serif;color:#111827;max-width:900px;">
      <h2 style="font-size:16px;color:#1e293b;margin:0 0 4px;">Planificación Táctica Muebles — Reporte "PLAN"</h2>
      <p style="font-size:11px;color:#6b7280;margin:0 0 16px;">Fecha(s) del filtro: <strong>${escapeHtml(fechasLabel)}</strong> — generado ${escapeHtml(new Date().toLocaleString('es-EC'))}</p>

      ${seccionTitulo(1, 'Detalle de Planificación Ejecutada')}
      <div style="border:1px solid #e5e7eb;border-top:none;padding:10px;">
        ${p.detalleEjecutado ? buildDetalleEjecutadoHtml(p.detalleEjecutado) : '<p style="font-size:12px;color:#6b7280;">Ninguna fecha del filtro tiene una Distribución de Mesas guardada desde "Plan Táctico (Alpha)".</p>'}
      </div>

      ${seccionTitulo(2, 'Desglose por Fecha y Mesa (Filtro Actual)')}
      <div style="border:1px solid #e5e7eb;border-top:none;padding:10px;">
        ${buildDesglosePorFechaYMesaHtml(p.planSummaryByDate)}
      </div>

      ${seccionTitulo(3, 'Resumen por Tipo de Mueble (Filtro Actual)')}
      <div style="border:1px solid #e5e7eb;border-top:none;padding:10px;">
        ${buildResumenPorTipoMuebleHtml(p.resumenPorTipoMueble)}
      </div>

      ${seccionTitulo(4, 'Diagrama de Gantt — Plan Diario Guardado (Plan Táctico)')}
      ${ganttHtml || '<div style="border:1px solid #e5e7eb;border-top:none;padding:10px;"><p style="font-size:12px;color:#6b7280;margin:0;">Ninguna fecha del filtro tiene una Distribución de Mesas guardada.</p></div>'}

      ${seccionTitulo(5, 'Resumen de Órdenes Lanzadas por Fecha')}
      <div style="border:1px solid #e5e7eb;border-top:none;padding:10px;overflow-x:auto;">
        ${buildResumenPorFechaHtml(p.resumenPorFecha)}
      </div>

      ${seccionTitulo(6, 'Capacidad Consolidada y Estado de Órdenes')}
      <div style="border:1px solid #e5e7eb;border-top:none;padding:10px;">
        ${buildCapacidadEstadoHtml(p.globalSummary, p.avgDailyCapacityHours, p.statusSummary)}
      </div>
    </div>`;
};

interface PlanMueblesTabSectionProps {
  restricciones: Restriccion[];
  columns?: string[];
  hideControls?: boolean;
  tiemposData?: any[];
  displayMode?: 'full' | 'plan';
}

interface PaginationState {
  currentPage: number;
  totalRegistros: number;
  pageSize: number;
  isExploring: boolean;
  rowsPerPage: number;
}

interface ComponentExplosion {
  id: string;
  description: string;
  unit: string;
  totalNeeded: number;
}

const ROWS_PER_PAGE_OPTIONS = [10, 20, 50, 100];

// MultiSelect component
const MultiSelect: React.FC<{
  options: { value: string; label: string }[];
  selected: string[];
  onChange: (selected: string[]) => void;
  placeholder?: string;
}> = ({ options, selected, onChange, placeholder }) => {
  const [open, setOpen] = useState(false);

  const handleSelect = (value: string) => {
    const newSelected = selected.includes(value)
      ? selected.filter((item) => item !== value)
      : [...selected, value];
    onChange(newSelected);
  };

  const isAllSelected = options.length > 0 && selected.length === options.length;

  return (
    <div className="flex flex-col items-start w-full">
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <Button
            variant="outline"
            role="combobox"
            aria-expanded={open}
            className="w-full justify-between h-9 text-sm font-normal"
          >
            <span className="truncate">
              {selected.length === 0
                ? placeholder || 'Seleccionar...'
                : isAllSelected
                ? 'Todas las fechas'
                : `${selected.length} seleccionada(s)`}
            </span>
            <ChevronsUpDown className="ml-1 h-4 w-4 shrink-0 opacity-50" />
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-[250px] p-0">
          <Command>
            <CommandInput placeholder="Buscar fecha..." className="h-9" />
            <CommandEmpty>No se encontraron fechas.</CommandEmpty>
            <CommandGroup className="max-h-60 overflow-y-auto">
              <CommandItem
                onSelect={() => {
                  if (isAllSelected) {
                    onChange([]);
                  } else {
                    onChange(options.map(o => o.value));
                  }
                }}
                className="font-bold border-b mb-1"
              >
                <Check
                  className={cn(
                    'mr-2 h-4 w-4',
                    isAllSelected ? 'opacity-100' : 'opacity-0'
                  )}
                />
                {isAllSelected ? "Desmarcar Todas" : "Seleccionar Todas"}
              </CommandItem>
              {options.map((option) => (
                <CommandItem
                  key={option.value}
                  value={option.value}
                  onSelect={() => {
                    handleSelect(option.value);
                  }}
                >
                  <Check
                    className={cn(
                      'mr-2 h-4 w-4',
                      selected.includes(option.value) ? 'opacity-100' : 'opacity-0'
                    )}
                  />
                  <span className="text-xs">{option.label}</span>
                </CommandItem>
              ))}
            </CommandGroup>
          </Command>
        </PopoverContent>
      </Popover>
      {selected.length > 0 && !isAllSelected && (
          <div className="pt-1 text-left w-full min-h-[22px]">
            {selected.slice(0, 3).map(value => (
              <Badge key={value} variant="secondary" className="mr-1 mb-1 max-w-[100px] truncate" title={value}>
                {value}
              </Badge>
            ))}
            {selected.length > 3 && <Badge variant="secondary">+{selected.length - 3}</Badge>}
          </div>
      )}
      {isAllSelected && (
        <div className="pt-1 text-left w-full min-h-[22px]">
           <Badge variant="secondary" className="bg-indigo-50 text-indigo-700 border-indigo-200">
             Mostrando todo el horizonte
           </Badge>
        </div>
      )}
    </div>
  );
};

export const PlanMueblesTabSection: React.FC<PlanMueblesTabSectionProps> = ({ restricciones, columns, hideControls = false, tiemposData = [], displayMode = 'full' }) => {
  const { addNotification } = useAppContext();
  const [isMounted, setIsMounted] = useState(false);
  const [orders, setOrders] = useState<any[]>([]);
  const [deliveryDatesMap, setDeliveryDatesMap] = useState<Map<string, string>>(new Map());
  // Cliente (DESTINATARIO_MERCADERIA/NOMBRE) por PEDIDO — usado por "GENERAR INFORME DE RIESGO" de la
  // Alerta de Riesgo de Stock de Insumos, ver useEffect de fetchPendientesMapping más abajo.
  const [clienteMap, setClienteMap] = useState<Map<string, string>>(new Map());
  const [pagination, setPagination] = useState<PaginationState>({
    currentPage: 1,
    totalRegistros: 0,
    pageSize: 10000,
    isExploring: true,
    rowsPerPage: 100,
  });
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  const [selectedDates, setSelectedDates] = useState<string[]>([]);
  const [hasSetDefaultDate, setHasSetDefaultDate] = useState(false);

  // Estado para Explosión de Materiales
  const [explosionResults, setExplosionResults] = useState<ComponentExplosion[]>([]);
  const [isExploding, setIsExploding] = useState(false);

  // Estado para "Enviar Correo" — envía por email las 5 tablas de la pestaña "PLAN" (Resumen por Fecha,
  // Resumen por Tipo de Mueble, Capacidad/Estado de Órdenes, Desglose por Fecha y Mesa, Gantt) para las
  // fechas actualmente filtradas, vía POST /api/servicios/enviarCorreo.
  const [emailDialogOpen, setEmailDialogOpen] = useState(false);
  const [emailDestino, setEmailDestino] = useState('');
  const [emailAsunto, setEmailAsunto] = useState('Reporte de Producción - Plan Táctico Muebles');
  const [emailSending, setEmailSending] = useState(false);

  // Destinatarios del "Informe Ejecutivo" ya NO se ingresan a mano — se toman de la Restricción
  // "CORREOS_ELECTRONICOS_INFORME_EJECUTIVO" del Grupo de Muebles (valor_restriccion = lista de correos
  // separados por coma, mismo patrón de "Nombre Restricción/Valor" que el resto de Restricciones), pedido
  // explícito del usuario 2026-09-16. Se recalcula solo si cambia la lista de restricciones cargadas.
  const NOMBRE_RESTRICCION_CORREOS_INFORME = 'CORREOS_ELECTRONICOS_INFORME_EJECUTIVO';
  const correosInformeEjecutivo = useMemo(() => {
    const restriccion = restricciones.find(r => r.nombre_restriccion?.trim().toUpperCase() === NOMBRE_RESTRICCION_CORREOS_INFORME);
    return (restriccion?.valor_restriccion || '').trim();
  }, [restricciones]);

  const topScrollRef = useRef<HTMLDivElement>(null);
  const tableScrollRef = useRef<HTMLDivElement>(null);
  const tableRef = useRef<HTMLTableElement>(null);
  const [tableWidth, setTableWidth] = useState(0);
  const lastScrolledRef = useRef<'top' | 'table' | null>(null);

  // Hydration Guard
  useEffect(() => {
    setIsMounted(true);
  }, []);

  // Handlers for synchronized scrollbars
  const handleTopScroll = (e: React.UIEvent<HTMLDivElement>) => {
    if (lastScrolledRef.current === 'table') {
      lastScrolledRef.current = null;
      return;
    }
    if (tableScrollRef.current) {
      lastScrolledRef.current = 'top';
      tableScrollRef.current.scrollLeft = e.currentTarget.scrollLeft;
    }
  };

  const handleTableScroll = (e: React.UIEvent<HTMLDivElement>) => {
    if (lastScrolledRef.current === 'top') {
      lastScrolledRef.current = null;
      return;
    }
    if (topScrollRef.current) {
      lastScrolledRef.current = 'table';
      topScrollRef.current.scrollLeft = e.currentTarget.scrollLeft;
    }
  };

  // Snapshots de Plan Diario ("PlanDiarioConfig:<fecha>") ya guardados desde "Plan Táctico (Alpha)" —
  // vienen dentro de la prop `restricciones` (ya filtrada por el/los Grupo(s) de Muebles), solo hay que
  // separarlos por prefijo y parsear el JSON de `descripcion`. Fuente única de horario/mesas/personal/
  // Gantt para esta pestaña "PLAN" (ver punto 1 del pedido del usuario, 2026-08-25).
  const planDiarioSnapshotsByDate = useMemo(() => {
    const map = new Map<string, PlanDiarioSnapshot>();
    if (displayMode !== 'plan') return map;
    (restricciones || [])
      .filter(r => r.nombre_restriccion?.startsWith(PLAN_DIARIO_PREFIJO))
      .forEach(r => {
        try {
          const snapshot = JSON.parse(r.descripcion || '') as PlanDiarioSnapshot;
          if (snapshot?.fecha) map.set(snapshot.fecha, snapshot);
        } catch {
          // Restriccion con el prefijo pero descripcion corrupta/no-JSON: se ignora silenciosamente
        }
      });
    return map;
  }, [restricciones, displayMode]);

  // Capacidad diaria de referencia para "DÍAS CARGA" en CAPACIDAD CONSOLIDADA (TOTAL SISTEMA): promedio
  // de la capacidad total (suma de horas disponibles de todas las mesas) de los Planes Diarios ya
  // guardados. Antes de que exista ningún snapshot (primer uso de esta función), se usa un valor de
  // referencia conservador (14 mesas x 9h x 87%) para no dividir por cero.
  const avgDailyCapacityHours = useMemo(() => {
    const totals = Array.from(planDiarioSnapshotsByDate.values())
      .map(s => s.mesas.reduce((sum, m) => sum + m.capacityHours, 0))
      .filter(t => t > 0);
    if (totals.length === 0) return 14 * 9 * 0.87;
    return totals.reduce((sum, t) => sum + t, 0) / totals.length;
  }, [planDiarioSnapshotsByDate]);

  const tiemposMap = useMemo(() => {
    if (!tiemposData || tiemposData.length === 0) {
        return new Map<string, number>();
    }
    const map = new Map<string, number>();
    tiemposData.forEach(item => {
        const materialCode = normalizeMaterialCode(item.CodMaterial ?? item.MATERIAL ?? item.Material ?? '');
        const tiempo = item.Tiempo_Min ?? item.Tiempo ?? 0;
        if (materialCode && tiempo > 0) {
            if (!map.has(materialCode)) {
                map.set(materialCode, tiempo);
            }
        }
    });
    return map;
  }, [tiemposData]);

  const COLUMNS_TO_DISPLAY = columns || [
    'FECHA', 'PEDIDO', 'POSICION', 'ORDEN', 'MATERIAL', 'NOMBRE', 'CANTPROGRAMADA', 'CANTPENDIENTE', 'CENTRO', 
    'MAQUINA', 'PUESTOTRABAJO', 'SECTORDESC', 'CATEGORIA', 'RESPCTRLPROD'
  ];

  // Cargar fechas de entrega Y cliente (DESTINATARIO_MERCADERIA/NOMBRE) desde Pendientes Totales para el
  // cruce de información — paginado completo (antes solo se pedía una página de 20000, incompleta frente
  // al total real ~23000+ registros, dejando pedidos sin fecha/cliente resuelto al azar según el orden de
  // los datos; se corrige aquí porque "GENERAR INFORME DE RIESGO" necesita el Cliente resuelto de forma
  // confiable para cualquier pedido). Mismo patrón (`destinatarioMap`) que buildPendientesMaps en
  // PlanGrupoRecuperadoTab.tsx.
  useEffect(() => {
    if (!isMounted) return;

    const fetchPendientesMapping = async () => {
      try {
        const explore = await serviciosService.getPendientesTotales(1, 1);
        const total = explore.totalRegistros || 0;
        let combined: any[] = [];
        if (total > 0) {
          const BATCH = 20000;
          const pages = Math.ceil(total / BATCH);
          for (let i = 1; i <= pages; i++) {
            const res = await serviciosService.getPendientesTotales(i, BATCH);
            if (res.data) combined = combined.concat(Array.isArray(res.data) ? res.data : [res.data]);
          }
        }

        const dateMap = new Map<string, string>();
        const clientMap = new Map<string, string>();
        combined.forEach((item: any) => {
          const pedido = String(item.PEDIDO || '').trim();
          if (!pedido) return;

          const cliente = String(item.DESTINATARIO_MERCADERIA || item.NOMBRE || '').trim();
          if (cliente && !clientMap.has(pedido)) {
            clientMap.set(pedido, cliente);
            clientMap.set(pedido.replace(/^0+/, ''), cliente);
          }

          const dia = String(item.DIAENTREGA || '').padStart(2, '0');
          const mes = String(item.MESENTREGA || '').padStart(2, '0');
          const anio = String(item.ANIOENTREGA || '');
          if (dia === '00' || mes === '00' || !anio) return;
          const formattedDate = `${dia}-${mes}-${anio}`;
          dateMap.set(pedido, formattedDate);
          dateMap.set(pedido.replace(/^0+/, ''), formattedDate);
        });
        setDeliveryDatesMap(dateMap);
        setClienteMap(clientMap);
      } catch (e) {
        console.error("Error cargando mapeo de fechas de entrega/cliente", e);
      }
    };
    fetchPendientesMapping();
  }, [isMounted]);

  useEffect(() => {
    if (!isMounted) return;

    const fetchData = async () => {
      setIsLoading(true);
      setError(null);
      
      try {
        const exploreResponse = await serviciosService.getOrdenesFert(1, 1);
        const totalFert = exploreResponse.totalRegistros || 0;

        let allFert: OrdenFert[] = [];
        if (totalFert > 0) {
          const BATCH_SIZE = 10000;
          const pages = Math.ceil(totalFert / BATCH_SIZE);
          for (let i = 1; i <= pages; i++) {
            const res = await serviciosService.getOrdenesFert(i, BATCH_SIZE);
            if (res.data) allFert = allFert.concat(res.data);
          }
        }

        const provResponse = await serviciosService.OrdenesProvisionalesPaginados(1, 20000);
        let allProv: ProvisionalOrder[] = [];
        if (provResponse.data) {
          allProv = Array.isArray(provResponse.data) ? provResponse.data : [provResponse.data];
        }

        const validResp = ['019', '006'];

        const fertMapped = allFert.filter(o =>
          validResp.includes(String(o.RESPCTRLPROD).trim()) && o.CENTRO === '1000'
        ).map(o => ({ ...o, _isPrevisional: false, _displayId: o.ORDEN }));

        // Bugfix (2026-09-08, encontrado investigando por qué faltaban telas en la Alerta de Riesgo de
        // Insumos): el campo real que devuelve /OrdenesProvisionalesPaginadas es "Centro" (verificado en
        // vivo contra la API), NO "CENTRO" — `ProvisionalOrder.CENTRO` (types.ts) nunca coincidió con el
        // dato real. `o.CENTRO === '1000'` daba SIEMPRE `undefined === '1000'` = false, así que TODAS las
        // Órdenes Previsionales quedaban excluidas silenciosamente de esta pestaña "PLAN" (tabla
        // principal, resúmenes, bottleneck, y Riesgo de Insumos) — grave dado que Previsional será ~90%
        // del volumen a futuro (ver [[project_muebles_tactico_kardex]], entrada 2026-09-04).
        const provMapped = allProv.filter(o =>
          validResp.includes(String(o.RESPCONTROLPROD).trim()) && (o as any).Centro === '1000'
        ).map(o => ({
          FECHA: o.FECHAINICIO,
          PEDIDO: (o as any).PEDIDOVENTAS || '',
          POSICION: (o as any).POSICIONPEDIDO || '',
          ORDEN: o.ORDENPREVISIONAL,
          MATERIAL: o.MATERIAL,
          NOMBRE: o.NOMBRE,
          CANTPROGRAMADA: o.CANTIDAD,
          CANTPENDIENTE: o.CANTIDAD,
          CENTRO: (o as any).Centro,
          MAQUINA: o.Maquina,
          PUESTOTRABAJO: o.PUESTOTRABAJO || o.Maquina,
          RESPCTRLPROD: o.RESPCONTROLPROD,
          _isPrevisional: true,
          _displayId: o.ORDENPREVISIONAL
        }));

        setOrders([...fertMapped, ...provMapped]);

      } catch (err) {
        const errorMessage = (err as Error).message;
        setError(errorMessage);
        addNotification('error', `Error al cargar datos: ${errorMessage}`);
      } finally {
        setIsLoading(false);
      }
    };

    if (restricciones) {
      fetchData();
    }
  }, [addNotification, restricciones, isMounted]);

  // ORDENES ESTRUCTURALES FILTRADAS (Toma en cuenta restricciones base como exclusión de LAMIN-01)
  const structuralFilteredOrders = useMemo(() => {
    return orders.filter(order => {
        const puesto = String(order.PUESTOTRABAJO || '').trim().toUpperCase();
        return puesto !== 'LAMIN-01';
    });
  }, [orders]);

  // CÁLCULOS MACRO (Usando structuralFilteredOrders para respetar restricciones actualizadas)
  const globalSummary = useMemo(() => {
    const totalCant = structuralFilteredOrders.reduce((sum, o) => sum + (Number(o.CANTPROGRAMADA) || 0), 0);
    const totalTimeMin = structuralFilteredOrders.reduce((sum, o) => {
      const materialCode = normalizeMaterialCode(o.MATERIAL);
      const t = tiemposMap.get(materialCode) || 0;
      return sum + (Number(o.CANTPROGRAMADA) || 0) * t;
    }, 0);

    return { totalCant, totalHours: totalTimeMin / 60 };
  }, [structuralFilteredOrders, tiemposMap]);

  const statusSummary = useMemo(() => {
    const getTargetDateStr = () => {
      const today = new Date();
      let daysAdded = 0;
      let result = new Date(today);
      while (daysAdded < 3) {
        result.setDate(result.getDate() + 1);
        const day = result.getDay();
        if (day !== 0 && day !== 6) daysAdded++;
      }
      return result.toISOString().split('T')[0];
    };

    const todayStr = new Date().toISOString().split('T')[0];
    const targetPlanningDateStr = getTargetDateStr();

    let pastCant = 0, pastHours = 0;
    let todayCant = 0, todayHours = 0;
    let futureCant = 0, futureHours = 0;

    structuralFilteredOrders.forEach(o => {
      const materialCode = normalizeMaterialCode(o.MATERIAL);
      const t = tiemposMap.get(materialCode) || 0;
      const hours = ((Number(o.CANTPROGRAMADA) || 0) * t) / 60;
      const cant = (Number(o.CANTPROGRAMADA) || 0);

      if (o.FECHA < todayStr) {
        pastCant += cant;
        pastHours += hours;
      } 
      else if (o.FECHA === todayStr) {
        todayCant += cant;
        todayHours += hours;
      }
      else if (o.FECHA >= targetPlanningDateStr) {
        futureCant += cant;
        futureHours += hours;
      }
    });

    return { pastCant, pastHours, todayCant, todayHours, futureCant, futureHours };
  }, [structuralFilteredOrders, tiemposMap]);

  const uniqueDates = useMemo(() => {
    const dates = new Set(structuralFilteredOrders.map(order => order.FECHA));
    return Array.from(dates).sort((a, b) => new Date(b).getTime() - new Date(a).getTime());
  }, [structuralFilteredOrders]);

  useEffect(() => {
    if (!hasSetDefaultDate && uniqueDates.length > 0 && displayMode === 'plan') {
      const getTargetDate = () => {
        const today = new Date();
        let daysAdded = 0;
        let result = new Date(today);
        while (daysAdded < 3) {
          result.setDate(result.getDate() + 1);
          const day = result.getDay();
          if (day !== 0 && day !== 6) daysAdded++;
        }
        return result.toISOString().split('T')[0];
      };

      const target = getTargetDate();
      setSelectedDates([target]);
      setHasSetDefaultDate(true);
    }
  }, [uniqueDates, hasSetDefaultDate, displayMode]);

  const filteredOrders = useMemo(() => {
    return structuralFilteredOrders.filter(order => {
        if (selectedDates.length === 0) return true;
        return selectedDates.includes(order.FECHA);
      });
  }, [structuralFilteredOrders, selectedDates]);
  
  const missingTimesInfo = useMemo(() => {
    const missing = new Set<string>();
    filteredOrders.forEach(order => {
      const materialCode = normalizeMaterialCode(order.MATERIAL);
      if (!tiemposMap.has(materialCode)) {
        missing.add(materialCode);
      }
    });
    const list = Array.from(missing).sort();
    return { count: list.length, list };
  }, [filteredOrders, tiemposMap]);

  // Resumen "todo lo lanzado": Órdenes/Unidades/Horas por fecha, SIN aplicar el filtro Fecha(s) de
  // arriba a propósito (vista panorámica de todas las fechas con órdenes, no del recorte actual) —
  // mismo patrón que "PLAN" del Taller de Corte (PlanTallerCorteTab.tsx). Ordenado cronológicamente
  // ascendente para que se lea como un calendario.
  const resumenPorFecha = useMemo(() => {
    if (displayMode !== 'plan') return [];
    const map = new Map<string, { ordenes: number; unidades: number; horasMin: number; sinTiempoCount: number }>();
    structuralFilteredOrders.forEach(o => {
      const fecha = String(o.FECHA || '').trim();
      if (!fecha) return;
      if (!map.has(fecha)) map.set(fecha, { ordenes: 0, unidades: 0, horasMin: 0, sinTiempoCount: 0 });
      const entry = map.get(fecha)!;
      entry.ordenes += 1;
      const cantidad = Number(o.CANTPROGRAMADA) || 0;
      entry.unidades += cantidad;
      const materialCode = normalizeMaterialCode(o.MATERIAL);
      const tiempoUnitMin = tiemposMap.get(materialCode);
      if (tiempoUnitMin === undefined) entry.sinTiempoCount++;
      else entry.horasMin += tiempoUnitMin * cantidad;
    });
    return Array.from(map.entries())
      .map(([fecha, v]) => ({ fecha, ordenes: v.ordenes, unidades: v.unidades, horas: v.horasMin / 60, sinTiempoCount: v.sinTiempoCount }))
      .sort((a, b) => a.fecha.localeCompare(b.fecha));
  }, [structuralFilteredOrders, tiemposMap, displayMode]);

  // Turno de referencia (horas, jornada única desde TURNO_REFERENCIA_INICIO) elegido por el usuario,
  // usado por la Alerta de Riesgo (cuellos de botella) de abajo.
  const [turnoReferenciaHoras, setTurnoReferenciaHoras] = useState<number>(9);

  // Cuellos de botella: agrupa las órdenes visibles (filteredOrders, respeta Fecha(s)) por
  // (Fecha, Puesto de Trabajo/Máquina), las ordena por su identificador de orden (_displayId — única
  // pista de secuencia disponible en este visor) y acumula su tiempo — las que empujan el acumulado más
  // allá de la jornada del turno de referencia se marcan "en riesgo de retraso". Órdenes sin tiempo
  // unitario cargado no se pueden secuenciar y se excluyen del cálculo.
  const bottleneckAnalysis = useMemo(() => {
    if (displayMode !== 'plan') return { overloaded: [] as { fecha: string; puesto: string; horasRequeridas: number; ordenesEnRiesgo: number; ordenesTotal: number }[], totalOrdenesEnRiesgo: 0 };
    const capacidadMin = turnoReferenciaHoras * 60;
    const groups = new Map<string, { fecha: string; puesto: string; orders: { id: string; tiempoMin: number }[] }>();
    filteredOrders.forEach(o => {
      const fecha = String(o.FECHA || '').trim();
      if (!fecha) return;
      const materialCode = normalizeMaterialCode(o.MATERIAL);
      const tiempoUnitMin = tiemposMap.get(materialCode);
      if (tiempoUnitMin === undefined) return;
      const tiempoMin = tiempoUnitMin * (Number(o.CANTPROGRAMADA) || 0);
      if (tiempoMin <= 0) return;
      const puesto = String(o.PUESTOTRABAJO || o.MAQUINA || '').trim() || '(Sin Puesto)';
      const key = `${fecha}|${puesto}`;
      if (!groups.has(key)) groups.set(key, { fecha, puesto, orders: [] });
      groups.get(key)!.orders.push({ id: String(o._displayId ?? ''), tiempoMin });
    });

    const overloaded: { fecha: string; puesto: string; horasRequeridas: number; ordenesEnRiesgo: number; ordenesTotal: number }[] = [];
    let totalOrdenesEnRiesgo = 0;
    groups.forEach(group => {
      const sorted = [...group.orders].sort((a, b) => a.id.localeCompare(b.id, undefined, { numeric: true }));
      let acumuladoMin = 0;
      let enRiesgo = 0;
      sorted.forEach(o => {
        acumuladoMin += o.tiempoMin;
        if (acumuladoMin > capacidadMin) enRiesgo++;
      });
      if (enRiesgo > 0) {
        overloaded.push({ fecha: group.fecha, puesto: group.puesto, horasRequeridas: acumuladoMin / 60, ordenesEnRiesgo: enRiesgo, ordenesTotal: sorted.length });
        totalOrdenesEnRiesgo += enRiesgo;
      }
    });
    overloaded.sort((a, b) => a.fecha.localeCompare(b.fecha) || a.puesto.localeCompare(b.puesto));
    return { overloaded, totalOrdenesEnRiesgo };
  }, [filteredOrders, tiemposMap, turnoReferenciaHoras, displayMode]);

  // Resumen por Tipo de Mueble: unidades lanzadas por categoría (Camas/Cabeceros/Sofás/Otros), sobre el
  // filtro Fecha(s) actual (a diferencia de resumenPorFecha, este SÍ reacciona a la fecha elegida, a
  // pedido explícito del usuario). Porcentaje de participación sobre el total de unidades del filtro.
  const resumenPorTipoMueble = useMemo(() => {
    if (displayMode !== 'plan') return [];
    const buckets: Record<TipoMueble, { unidades: number; ordenes: number }> = {
      CAMAS: { unidades: 0, ordenes: 0 },
      CABECEROS: { unidades: 0, ordenes: 0 },
      SOFAS_PEQUEÑOS: { unidades: 0, ordenes: 0 },
      SOFAS_GRANDES: { unidades: 0, ordenes: 0 },
      OTROS: { unidades: 0, ordenes: 0 },
    };
    filteredOrders.forEach(o => {
      const materialCode = normalizeMaterialCode(o.MATERIAL);
      const tiempoUnitMin = tiemposMap.get(materialCode) || 0;
      const tipo = clasificarTipoMueble(String(o.NOMBRE || ''), tiempoUnitMin);
      buckets[tipo].unidades += Number(o.CANTPROGRAMADA) || 0;
      buckets[tipo].ordenes += 1;
    });
    const totalUnidades = TIPO_MUEBLE_ORDEN.reduce((s, tipo) => s + buckets[tipo].unidades, 0);
    return TIPO_MUEBLE_ORDEN.map(tipo => ({
      tipo,
      unidades: buckets[tipo].unidades,
      ordenes: buckets[tipo].ordenes,
      pct: totalUnidades > 0 ? (buckets[tipo].unidades / totalUnidades) * 100 : 0,
    }));
  }, [filteredOrders, tiemposMap, displayMode]);

  // Alerta de Riesgo de Stock — Insumos (Telas/Cascos y, desde 2026-09-08, cartón/herrajes/plásticos/etc.
  // vía INSUMO_PREFIJOS_GENERALES): cálculo bajo demanda (botón), no automático, porque requiere una
  // Explosión de Materiales por cada material único con demanda (una llamada de red por material, mismo
  // costo que "Calcular Explosión" de más abajo). Cachea el Stock Actual (Cubo de Inventarios) tras la
  // primera vez que se calcula.
  const [materialStockActualMap, setMaterialStockActualMap] = useState<Map<string, number> | null>(null);
  const [insumoStockState, setInsumoStockState] = useState<{ items: InsumoRiesgoItem[]; detalleMap: Map<string, InsumoOrdenDetalle[]>; loading: boolean; calculatedAt: string | null }>({ items: [], detalleMap: new Map(), loading: false, calculatedAt: null });
  // "GENERAR INFORME DE RIESGO": un solo botón/modal que detalla TODOS los insumos en riesgo calculados y,
  // para cada uno, las órdenes afectadas — no uno por insumo (a pedido explícito del usuario, 2026-09-08).
  const [informeRiesgoOpen, setInformeRiesgoOpen] = useState(false);
  // "GENERAR INFORME COMERCIAL": versión resumida del Informe de Riesgo para el área comercial (a
  // quienes se les compartirá el link de esta pantalla para revisar a diario, pedido explícito del
  // usuario 2026-09-14) — un listado plano de pedidos afectados, sin el detalle técnico de Stock
  // Actual/Necesario/Disponible que sí necesita el Informe de Riesgo. Una fila por (orden, insumo en
  // riesgo que la afecta): si una orden está bloqueada por más de un insumo, aparece una vez por cada
  // uno con su propia "Razón de Riesgo", en vez de una sola fila con motivos combinados.
  const [informeComercialOpen, setInformeComercialOpen] = useState(false);

  const ensureStockMap = async (): Promise<Map<string, number>> => {
    if (materialStockActualMap) return materialStockActualMap;
    const invExplore = await serviciosService.getCuboInventarios(1, 1);
    const totalInv = invExplore.totalRegistros || 0;
    const stockActualMap = new Map<string, number>();
    if (totalInv > 0) {
      const BATCH_INV = 20000;
      const pagesInv = Math.ceil(totalInv / BATCH_INV);
      for (let i = 1; i <= pagesInv; i++) {
        const res = await serviciosService.getCuboInventarios(i, BATCH_INV);
        if (res.data) {
          const items = Array.isArray(res.data) ? res.data : [res.data];
          items.forEach((item: any) => {
            const material = normalizeMaterialCode(item.Material || '');
            const actual = Number(item.StockActual) || 0;
            stockActualMap.set(material, (stockActualMap.get(material) || 0) + actual);
          });
        }
      }
    }
    setMaterialStockActualMap(stockActualMap);
    return stockActualMap;
  };

  // Kardex: Disponible Real = Stock Actual - Consumo de Órdenes Pasadas Pendientes (sin Producción
  // Propia Pendiente — Telas/Cascos son insumos comprados, no se fabrican en Muebles, mismo criterio ya
  // establecido en "Plan Táctico (Alpha)"). Riesgo cuando Cantidad Neta Requerida (Necesario de la
  // ventana de INSUMO_VENTANA_DIAS días - Disponible Real) > 0.
  const handleCalcularRiesgoInsumos = async () => {
    setInsumoStockState(prev => ({ ...prev, loading: true }));
    try {
      const stockMap = await ensureStockMap();

      const todayKey = new Date().toISOString().split('T')[0];
      const ventanaKeys = new Set<string>();
      for (let i = 0; i < INSUMO_VENTANA_DIAS; i++) {
        const d = new Date();
        d.setDate(d.getDate() + i);
        ventanaKeys.add(d.toISOString().split('T')[0]);
      }

      const demandMap = new Map<string, number>();
      const pastDemandMap = new Map<string, number>();
      // Órdenes concretas (Previsional/Fert) detrás de cada material top-level, para poder desglosar
      // "GENERAR INFORME DE RIESGO" por orden más abajo — sin esto solo tendríamos el total agregado por
      // material, igual que ya le pasó a la investigación de déficit de "Plan Grupo Recuperado" (ver
      // memoria de ese módulo: la composición exacta de órdenes no es reconstruible si no se guarda aquí).
      const ordersByMaterialFuturo = new Map<string, typeof structuralFilteredOrders>();
      const ordersByMaterialPasado = new Map<string, typeof structuralFilteredOrders>();
      structuralFilteredOrders.forEach(o => {
        const fecha = String(o.FECHA || '').trim();
        if (!fecha) return;
        const pendiente = Number(o.CANTPENDIENTE) || 0;
        if (pendiente <= 0) return;
        const material = normalizeMaterialCode(o.MATERIAL);
        if (ventanaKeys.has(fecha)) {
          demandMap.set(material, (demandMap.get(material) || 0) + pendiente);
          if (!ordersByMaterialFuturo.has(material)) ordersByMaterialFuturo.set(material, []);
          ordersByMaterialFuturo.get(material)!.push(o);
        } else if (fecha < todayKey) {
          pastDemandMap.set(material, (pastDemandMap.get(material) || 0) + pendiente);
          if (!ordersByMaterialPasado.has(material)) ordersByMaterialPasado.set(material, []);
          ordersByMaterialPasado.get(material)!.push(o);
        }
      });

      const uniqueMaterials = Array.from(new Set([...demandMap.keys(), ...pastDemandMap.keys()]));
      if (uniqueMaterials.length === 0) {
        setInsumoStockState({ items: [], detalleMap: new Map(), loading: false, calculatedAt: new Date().toLocaleString('es-EC') });
        addNotification('info', `No hay órdenes pendientes en la ventana de ${INSUMO_VENTANA_DIAS} días ni en el histórico pasado.`);
        return;
      }

      const grouped = new Map<string, InsumoRiesgoItem>();
      const detalleMap = new Map<string, InsumoOrdenDetalle[]>();
      for (const material of uniqueMaterials) {
        const parentDemand = demandMap.get(material) || 0;
        const parentPastDemand = pastDemandMap.get(material) || 0;
        const ordenesFuturas = ordersByMaterialFuturo.get(material) || [];
        const ordenesPasadas = ordersByMaterialPasado.get(material) || [];
        const res = await serviciosService.getMaestroMaterialesExplosion('1000', material, 1, 5000);
        if (!res.data) continue;
        const components = Array.isArray(res.data) ? res.data : [res.data];
        const codigosBajoAprovechamiento = getCodigosBajoTelaAprovechamiento(components);
        components.forEach((comp: any) => {
          const descripcion = String(comp.DESCRIPCION_COMPONENTE || '').trim();
          const tipo = clasificarTipoInsumo(descripcion.toUpperCase());
          if (!tipo) return;

          // Normalizado (últimos 8 dígitos) — DEBE coincidir con las claves de stockMap (construido
          // desde el Cubo de Inventarios, que sí trae el Material con ceros a la izquierda). Antes se
          // usaba el código crudo del componente aquí, lo que hacía que la búsqueda de Stock Actual
          // fallara SIEMPRE (nunca coincidía con stockMap) y todo insumo con demanda apareciera como
          // "en riesgo" sin importar el stock real — bug detectado 2026-08-26.
          const componente = normalizeMaterialCode(comp.COMPONENTE || '');
          if (!componente || codigosBajoAprovechamiento.has(componente)) return;
          const cantBase = Number(comp.CANTIDAD_ACUMULADA ?? comp.CANTIDAD_UNITARIA ?? 0);
          const necesario = cantBase * parentDemand;
          const consumoPasado = cantBase * parentPastDemand;
          if (necesario <= 0 && consumoPasado <= 0) return;

          if (!grouped.has(componente)) {
            grouped.set(componente, {
              tipo, componente, descripcion, unidad: String(comp.UNIDAD || 'UN'),
              necesario: 0, stockActual: null, consumoPasado: 0, disponibleReal: null, cantidadNetaAConseguir: 0,
            });
          }
          const entry = grouped.get(componente)!;
          entry.necesario += necesario;
          entry.consumoPasado += consumoPasado;

          if (!detalleMap.has(componente)) detalleMap.set(componente, []);
          const detalleList = detalleMap.get(componente)!;
          [...ordenesFuturas.map(o => ({ o, ventana: 'Futura' as const })), ...ordenesPasadas.map(o => ({ o, ventana: 'Pasada' as const }))]
            .forEach(({ o, ventana }) => {
              const cantidadPendiente = Number(o.CANTPENDIENTE) || 0;
              if (cantidadPendiente <= 0) return;
              const pedido = String(o.PEDIDO || '').trim();
              detalleList.push({
                source: o._isPrevisional ? 'Previsional' : 'Fert',
                id: String(o._displayId || ''),
                pedido,
                posicion: String(o.POSICION || '').trim(),
                material: String(o.MATERIAL || '').trim(),
                nombre: String(o.NOMBRE || '').trim(),
                cliente: clienteMap.get(pedido) || clienteMap.get(pedido.replace(/^0+/, '')) || (pedido ? 'Cliente no identificado' : 'Sin Pedido (MTS)'),
                fecha: String(o.FECHA || '').trim(),
                cantidadPendiente,
                consumoComponente: cantBase * cantidadPendiente,
                ventana,
              });
            });
        });
      }

      const results = Array.from(grouped.values())
        .map(item => {
          const stockActual = stockMap.get(item.componente) ?? null;
          const disponibleReal = stockActual !== null ? stockActual - item.consumoPasado : null;
          const cantidadNetaAConseguir = disponibleReal !== null ? Math.max(0, item.necesario - disponibleReal) : item.necesario;
          return { ...item, stockActual, disponibleReal, cantidadNetaAConseguir };
        })
        .filter(item => item.cantidadNetaAConseguir > 0)
        .sort((a, b) => b.cantidadNetaAConseguir - a.cantidadNetaAConseguir);

      results.forEach(item => {
        detalleMap.get(item.componente)?.sort((a, b) => a.fecha.localeCompare(b.fecha));
      });

      setInsumoStockState({ items: results, detalleMap, loading: false, calculatedAt: new Date().toLocaleString('es-EC') });
      if (results.length === 0) {
        addNotification('success', `Sin riesgo de faltante de insumos detectado para hoy y los próximos ${INSUMO_VENTANA_DIAS} días.`);
      } else {
        addNotification('warning', `${results.length} insumo(s) con riesgo de faltante detectado(s).`);
      }
    } catch (e) {
      addNotification('error', `Error al calcular riesgo de insumos: ${(e as Error).message}`);
      setInsumoStockState(prev => ({ ...prev, loading: false }));
    }
  };

  // Filas del "INFORME COMERCIAL": aplana insumoStockState.detalleMap (agrupado por insumo) a un
  // listado plano de pedidos, con la Razón de Riesgo (tipo + código del insumo) como texto simple —
  // formato pedido explícito del usuario 2026-09-14 para compartir con el área comercial.
  const informeComercialRows = useMemo(() => {
    const rows: { orden: string; pedido: string; posicion: string; material: string; descripcion: string; cantidad: number; cliente: string; razon: string }[] = [];
    insumoStockState.items.forEach(item => {
      const detalles = insumoStockState.detalleMap.get(item.componente) || [];
      const razon = `Falta de ${item.tipo} ${item.componente}`;
      detalles.forEach(d => {
        rows.push({
          orden: d.id,
          pedido: d.pedido,
          posicion: d.posicion,
          material: d.material,
          descripcion: d.nombre,
          cantidad: d.cantidadPendiente,
          cliente: d.cliente,
          razon,
        });
      });
    });
    return rows;
  }, [insumoStockState]);

  // Desglose por Fecha y Mesa: ya NO se recalcula con un horario/N° de mesas genérico ni con un
  // ranking artificial de tapiceros — se lee tal cual el snapshot de Plan Diario guardado desde "Plan
  // Táctico (Alpha)" para esa fecha objetivo (horario, mesas, personal/% y horas disponibles reales de
  // ese día). Si una fecha seleccionada nunca tuvo una Distribución de Mesas ejecutada/guardada en esa
  // pestaña, `snapshot` queda `null` y la UI lo indica en vez de mostrar datos inventados.
  const planSummaryByDate = useMemo<PlanSummaryDay[]>(() => {
    if (displayMode !== 'plan' || selectedDates.length === 0) return [];

    return selectedDates.map(date => {
      const snapshot = planDiarioSnapshotsByDate.get(date) ?? null;
      const mesas = snapshot?.mesas ?? [];
      return {
        date,
        snapshot,
        cantProgramada: mesas.reduce((sum, m) => sum + m.items.reduce((s, it) => s + it.cantidad, 0), 0),
        tiempoTotalH: mesas.reduce((sum, m) => sum + m.usedHours, 0),
        capacidadTotalH: mesas.reduce((sum, m) => sum + m.capacityHours, 0),
        mesas,
      };
    }).sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
  }, [selectedDates, displayMode, planDiarioSnapshotsByDate]);

  // "DETALLE DE PLANIFICACIÓN EJECUTADA": suma el `resumen` congelado (ver PlanDiarioSnapshotResumen)
  // de cada fecha seleccionada que sí tenga snapshot guardado — pedido explícito del usuario 2026-09-16,
  // primer recuadro de la pestaña "PLAN" y del informe por correo. `null` si ninguna fecha seleccionada
  // tiene snapshot (nunca se ejecutó "Distribución de Mesas" ese día en "Plan Táctico (Alpha)").
  const detalleEjecutadoResumen = useMemo(() => {
    if (displayMode !== 'plan') return null;
    const conSnapshot = planSummaryByDate.filter(d => d.snapshot?.resumen);
    if (conSnapshot.length === 0) return null;
    const sum = (fn: (r: PlanDiarioSnapshotResumen) => number) => conSnapshot.reduce((s, d) => s + fn(d.snapshot!.resumen as PlanDiarioSnapshotResumen), 0);
    return {
      horasRequeridas: sum(r => r.horasRequeridas),
      capacidadDisponible: sum(r => r.capacidadDisponible),
      deficitCapacidad: sum(r => r.deficitCapacidad),
      ordenesMtsAdicionalesCount: sum(r => r.ordenesMtsAdicionalesCount),
      ordenesMtsAdicionalesHoras: sum(r => r.ordenesMtsAdicionalesHoras),
      unidadesFisicasPlanificadas: sum(r => r.unidadesFisicasPlanificadas),
      ordenesPlanificadasTotal: sum(r => r.ordenesPlanificadasTotal),
      diferidasCount: sum(r => r.diferidasCount),
      moviblesCount: sum(r => r.moviblesCount),
      unidadesEquivalentesPlanificadas: sum(r => r.unidadesEquivalentesPlanificadas),
      fechasConDatos: conSnapshot.length,
      fechasSinDatos: planSummaryByDate.length - conSnapshot.length,
    };
  }, [planSummaryByDate, displayMode]);

  const totalPagesLocal = Math.ceil(filteredOrders.length / pagination.rowsPerPage);
  const startIndex = (pagination.currentPage - 1) * pagination.rowsPerPage;
  const endIndex = startIndex + pagination.rowsPerPage;
  const displayedOrders = filteredOrders.slice(startIndex, endIndex);

  const goToPage = (page: number) => {
    setPagination(prev => ({ ...prev, currentPage: Math.max(1, Math.min(page, totalPagesLocal)) }));
  };

  const handleRowsPerPageChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    setPagination(prev => ({ ...prev, rowsPerPage: Number(e.target.value), currentPage: 1 }));
  };
  
  const handleDateChange = (dates: string[]) => {
    setSelectedDates(dates);
    setPagination(prev => ({ ...prev, currentPage: 1 }));
    setExplosionResults([]); 
  };

  // Función para Explosión de Materiales
  const handleExplodeMaterials = async () => {
    if (filteredOrders.length === 0) {
        addNotification('warning', 'No hay órdenes en el plan actual para explosionar.');
        return;
    }

    setIsExploding(true);
    setExplosionResults([]);
    
    const fertDemandMap = new Map<string, number>();
    filteredOrders.forEach(o => {
        const code = normalizeMaterialCode(o.MATERIAL);
        fertDemandMap.set(code, (fertDemandMap.get(code) || 0) + (Number(o.CANTPROGRAMADA) || 0));
    });

    const uniqueFerts = Array.from(fertDemandMap.keys());
    const allComponents: any[] = [];

    try {
        addNotification('info', `Iniciando explosión de ${uniqueFerts.length} materiales únicos...`);
        
        for (const fert of uniqueFerts) {
            const res = await serviciosService.getMaestroMaterialesExplosion('1000', fert, 1, 5000);
            if (res.data) {
                const components = Array.isArray(res.data) ? res.data : [res.data];
                const parentDemand = fertDemandMap.get(fert) || 0;
                
                components.forEach((comp: any) => {
                    const cantBase = Number(comp.CANTIDAD_ACUMULADA || comp.CANTIDAD_UNITARIA || 0);
                    allComponents.push({
                        ...comp,
                        calculatedNeeded: cantBase * parentDemand
                    });
                });
            }
        }

        const grouped = new Map<string, ComponentExplosion>();
        allComponents.forEach(c => {
            const id = String(c.COMPONENTE || 'Unknown');
            if (!grouped.has(id)) {
                grouped.set(id, {
                    id,
                    description: c.DESCRIPCION_COMPONENTE || 'Sin Descripción',
                    unit: c.UNIDAD || 'UN',
                    totalNeeded: 0
                });
            }
            grouped.get(id)!.totalNeeded += c.calculatedNeeded;
        });

        const sortedResults = Array.from(grouped.values()).sort((a, b) => b.totalNeeded - a.totalNeeded);
        setExplosionResults(sortedResults);
        
        if (sortedResults.length > 0) {
            addNotification('success', `Explosión completada. Se identificaron ${sortedResults.length} componentes necesarios.`);
        } else {
            addNotification('warning', 'La consulta de explosión no devolvió componentes para estos materiales.');
        }

    } catch (e) {
        console.error("Error en explosión:", e);
        addNotification('error', 'Error al procesar la explosión de materiales.');
    } finally {
        setIsExploding(false);
    }
  };

  // Cuerpo HTML del correo, recalculado en vivo mientras el modal está abierto — se usa tanto para la
  // vista previa (iframe) como para el envío real, así lo que el usuario ve es exactamente lo que se
  // manda (a pedido explícito del usuario, 2026-09-06: quiere revisar el contenido antes de enviar).
  const emailCuerpoHtml = useMemo(() => buildReporteCorreoHtml({
    fechasFiltro: selectedDates,
    detalleEjecutado: detalleEjecutadoResumen,
    resumenPorFecha,
    resumenPorTipoMueble,
    globalSummary,
    avgDailyCapacityHours,
    statusSummary,
    planSummaryByDate,
  }), [selectedDates, detalleEjecutadoResumen, resumenPorFecha, resumenPorTipoMueble, globalSummary, avgDailyCapacityHours, statusSummary, planSummaryByDate]);

  const handleEnviarCorreo = async () => {
    const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    const destinatarios = emailDestino.split(',').map(d => d.trim()).filter(Boolean);
    const invalidos = destinatarios.filter(d => !EMAIL_REGEX.test(d));
    if (destinatarios.length === 0) {
      addNotification('warning', 'Ingresa al menos un destinatario.');
      return;
    }
    if (invalidos.length > 0) {
      addNotification('warning', `Correo(s) inválido(s): ${invalidos.join(', ')}`);
      return;
    }
    if (!emailAsunto.trim()) {
      addNotification('warning', 'Ingresa un asunto para el correo.');
      return;
    }

    setEmailSending(true);
    try {
      const res = await serviciosService.enviarCorreo(
        destinatarios.join(','),
        emailAsunto.trim(),
        emailCuerpoHtml,
        'Este correo fue generado automáticamente, favor no responder.'
      );
      addNotification('success', res.message || `Correo enviado a ${res.destinatarios.join(', ')}`);
      setEmailDialogOpen(false);
    } catch (e) {
      addNotification('error', `Error al enviar el correo: ${(e as Error).message}`);
    } finally {
      setEmailSending(false);
    }
  };

  useEffect(() => {
    if (!isMounted) return;
    const calculateWidth = () => { if (tableRef.current) setTableWidth(tableRef.current.offsetWidth); };
    calculateWidth();
    window.addEventListener('resize', calculateWidth);
    const resizeObserver = new ResizeObserver(calculateWidth);
    if (tableRef.current) resizeObserver.observe(tableRef.current);
    return () => {
      window.removeEventListener('resize', calculateWidth);
      if (tableRef.current) resizeObserver.unobserve(tableRef.current);
    };
  }, [displayedOrders, isMounted]);

  if (!isMounted) return null;

  return (
    <div className="space-y-4">
      {displayMode === 'plan' && missingTimesInfo.count > 0 && (
        <div className="bg-red-50 border-l-4 border-red-500 p-4 mb-4 shadow-md animate-pulse">
          <div className="flex items-center gap-4">
            <div className="flex-shrink-0 bg-red-100 p-2 rounded-full">
              <BellRing className="h-6 w-6 text-red-600" />
            </div>
            <div className="flex-1">
              <h3 className="text-sm font-bold text-red-800 uppercase tracking-tight flex items-center gap-2">
                <AlertTriangle className="h-4 w-4" /> Alerta de Consistencia de Datos
              </h3>
              <p className="text-xs text-red-700 font-medium mt-0.5">
                Se han detectado <span className="underline decoration-2">{missingTimesInfo.count}</span> materiales en la selección que <span className="font-bold">no tienen información de tiempo</span>.
              </p>
            </div>
          </div>
          
          <div className="mt-3 pt-3 border-t border-red-200">
            <p className="text-[10px] text-red-600 font-bold uppercase mb-2">Números de material sin tiempo:</p>
            <div className="flex flex-wrap gap-1.5">
              {missingTimesInfo.list.map(code => (
                <Badge key={code} variant="outline" className="bg-white text-red-700 border-red-300 text-[10px] py-0 px-2 font-mono h-5">
                  {code}
                </Badge>
              ))}
            </div>
          </div>
        </div>
      )}

      {!hideControls && (
        <div className="flex flex-col space-y-6 mb-4">
          <div className="flex items-start justify-between">
            <div className="flex items-start space-x-4 flex-1">
              <div className="w-56">
                <label htmlFor="date-filter" className="text-sm font-semibold text-gray-700">Fecha(s):</label>
                <MultiSelect
                  options={uniqueDates.map(d => ({ value: d, label: d }))}
                  selected={selectedDates}
                  onChange={handleDateChange}
                  placeholder="Todas las fechas"
                />
              </div>

              {displayMode === 'plan' && (
                <>
                  <div className="flex items-end h-16 gap-2">
                    <Button
                        onClick={handleExplodeMaterials}
                        disabled={isExploding || filteredOrders.length === 0}
                        className="bg-emerald-600 hover:bg-emerald-700 text-white gap-2 shadow-md h-9"
                    >
                        {isExploding ? <Loader2 className="w-4 h-4 animate-spin" /> : <Calculator className="w-4 h-4" />}
                        Calcular Explosión
                    </Button>
                    <Button
                        onClick={() => {
                            if (!correosInformeEjecutivo) {
                                addNotification('warning', `No hay correos configurados en la Restricción "${NOMBRE_RESTRICCION_CORREOS_INFORME}". Configúrela en "Restricciones" o ingrese los destinatarios manualmente en el diálogo.`);
                            }
                            setEmailDestino(correosInformeEjecutivo);
                            const fechaObjetivoAsunto = selectedDates.length > 0 ? selectedDates.join(', ') : 'Todas las fechas';
                            setEmailAsunto(`Reporte de Producción - Plan Táctico Muebles - ${fechaObjetivoAsunto}`);
                            setEmailDialogOpen(true);
                        }}
                        className="bg-indigo-600 hover:bg-indigo-700 text-white gap-2 shadow-md h-9"
                    >
                        <Mail className="w-4 h-4" />
                        Enviar Correo
                    </Button>
                  </div>
                </>
              )}
            </div>
          </div>

          {/* "DETALLE DE PLANIFICACIÓN EJECUTADA": mismos 6 recuadros que "Plan Táctico (Alpha)" muestra en
              vivo el día que se ejecuta la Distribución de Mesas, ahora agregados para la(s) fecha(s)
              seleccionada(s) en "Fecha(s):" — primer recuadro de la pestaña "PLAN", pedido explícito del
              usuario 2026-09-16. Si ninguna fecha seleccionada tiene snapshot guardado (nunca se ejecutó
              "Distribución de Mesas" en "Plan Táctico (Alpha)" ese día), no se muestra. */}
          {displayMode === 'plan' && detalleEjecutadoResumen && (
            <div className="bg-white border border-gray-200 rounded-xl shadow-md overflow-hidden">
              <div className="flex items-center justify-between px-6 py-4 bg-gradient-to-r from-purple-900 to-indigo-900">
                <div className="flex items-center gap-2">
                  <ClipboardCheck className="w-5 h-5 text-purple-200" />
                  <h3 className="text-sm font-bold text-white uppercase tracking-wide">Detalle de Planificación Ejecutada</h3>
                </div>
                <p className="text-[11px] text-purple-200 font-medium">
                  {detalleEjecutadoResumen.fechasConDatos} fecha(s) con datos
                  {detalleEjecutadoResumen.fechasSinDatos > 0 ? ` · ${detalleEjecutadoResumen.fechasSinDatos} sin Distribución de Mesas guardada` : ''}
                </p>
              </div>
              <div className="p-6 grid grid-cols-1 md:grid-cols-3 xl:grid-cols-6 gap-4">
                <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                  <p className="text-[10px] font-bold text-blue-500 uppercase">Horas Requeridas (Compromisos Inmediatos)</p>
                  <p className="text-xl font-black text-blue-800">{detalleEjecutadoResumen.horasRequeridas.toFixed(2)} h</p>
                </div>
                <div className="bg-emerald-50 border border-emerald-200 rounded-lg p-4">
                  <p className="text-[10px] font-bold text-emerald-500 uppercase">Capacidad Disponible</p>
                  <p className="text-xl font-black text-emerald-800">{detalleEjecutadoResumen.capacidadDisponible.toFixed(2)} h</p>
                </div>
                <div className={`border rounded-lg p-4 ${detalleEjecutadoResumen.deficitCapacidad >= 0 ? 'bg-emerald-50 border-emerald-200' : 'bg-red-50 border-red-200'}`}>
                  <p className={`text-[10px] font-bold uppercase ${detalleEjecutadoResumen.deficitCapacidad >= 0 ? 'text-emerald-500' : 'text-red-500'}`}>
                    {detalleEjecutadoResumen.deficitCapacidad >= 0 ? 'Capacidad Sobrante' : 'Déficit de Capacidad'}
                  </p>
                  <p className={`text-xl font-black ${detalleEjecutadoResumen.deficitCapacidad >= 0 ? 'text-emerald-800' : 'text-red-800'}`}>
                    {Math.abs(detalleEjecutadoResumen.deficitCapacidad).toFixed(2)} h
                  </p>
                </div>
                <div className="bg-purple-50 border border-purple-200 rounded-lg p-4">
                  <p className="text-[10px] font-bold text-purple-500 uppercase">Órdenes MTS Adicionales (Relleno de Capacidad)</p>
                  <p className="text-xl font-black text-purple-800">{detalleEjecutadoResumen.ordenesMtsAdicionalesCount}</p>
                  <p className="text-[10px] text-purple-400">{detalleEjecutadoResumen.ordenesMtsAdicionalesHoras.toFixed(2)} h agregadas</p>
                </div>
                <div className="bg-indigo-50 border border-indigo-200 rounded-lg p-4">
                  <p className="text-[10px] font-bold text-indigo-500 uppercase">Unidades Físicas Planificadas</p>
                  <p className="text-xl font-black text-indigo-800">{detalleEjecutadoResumen.unidadesFisicasPlanificadas.toLocaleString()}</p>
                  <p className="text-[10px] text-indigo-400">{detalleEjecutadoResumen.ordenesPlanificadasTotal} órdenes en total</p>
                  {(detalleEjecutadoResumen.diferidasCount > 0 || detalleEjecutadoResumen.moviblesCount > 0) && (
                    <p className="text-[9px] text-indigo-300 mt-1 pt-1 border-t border-indigo-100">
                      Ya excluye {detalleEjecutadoResumen.diferidasCount} diferida(s) y {detalleEjecutadoResumen.moviblesCount} movible(s)
                    </p>
                  )}
                </div>
                <div className="bg-cyan-50 border border-cyan-200 rounded-lg p-4">
                  <p className="text-[10px] font-bold text-cyan-500 uppercase">Unidades Equivalentes Planificadas</p>
                  <p className="text-xl font-black text-cyan-800">
                    {detalleEjecutadoResumen.unidadesEquivalentesPlanificadas.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  </p>
                  <p className="text-[10px] text-cyan-400">1 equivalente = {MINUTOS_POR_MUEBLE_EQUIVALENTE_PLAN} min</p>
                </div>
              </div>
            </div>
          )}

          {displayMode === 'plan' && (
            <div className="bg-white border border-gray-200 rounded-xl shadow-sm overflow-hidden">
              <div className="flex items-center justify-between px-6 py-4 bg-gradient-to-r from-slate-900 to-emerald-900">
                <div className="flex items-center gap-2">
                  <CalendarDays className="w-5 h-5 text-emerald-200" />
                  <h3 className="text-sm font-bold text-white uppercase tracking-wide">Resumen de Órdenes Lanzadas por Fecha</h3>
                </div>
                <span className="text-xs text-emerald-200 font-mono">{resumenPorFecha.length} fecha(s)</span>
              </div>
              {resumenPorFecha.length === 0 ? (
                <p className="text-center py-8 text-gray-400 text-xs">No hay órdenes lanzadas.</p>
              ) : (
                <div className="overflow-x-auto">
                  <table className="text-xs border-collapse">
                    <thead className="bg-gray-100">
                      <tr>
                        <th className="px-3 py-2 text-left font-bold text-gray-700 uppercase border-r border-b border-gray-300 sticky left-0 bg-gray-100 whitespace-nowrap">Fecha</th>
                        {resumenPorFecha.map(r => (
                          <th key={r.fecha} className="px-3 py-2 text-center font-bold text-gray-700 border-r border-b border-gray-300 whitespace-nowrap">{r.fecha}</th>
                        ))}
                        <th className="px-3 py-2 text-center font-extrabold text-gray-800 border-b border-gray-300 whitespace-nowrap bg-gray-200">Total</th>
                      </tr>
                    </thead>
                    <tbody className="bg-white">
                      <tr>
                        <td className="px-3 py-2 text-left font-bold text-gray-700 border-r border-b border-gray-200 sticky left-0 bg-white whitespace-nowrap">Órdenes Lanzadas</td>
                        {resumenPorFecha.map(r => (
                          <td key={r.fecha} className="px-3 py-2 text-center border-r border-b border-gray-200">{r.ordenes}</td>
                        ))}
                        <td className="px-3 py-2 text-center font-bold border-b border-gray-200 bg-gray-50">
                          {resumenPorFecha.reduce((s, r) => s + r.ordenes, 0)}
                        </td>
                      </tr>
                      <tr>
                        <td className="px-3 py-2 text-left font-bold text-gray-700 border-r border-b border-gray-200 sticky left-0 bg-white whitespace-nowrap">Unidades Lanzadas</td>
                        {resumenPorFecha.map(r => (
                          <td key={r.fecha} className="px-3 py-2 text-center border-r border-b border-gray-200">{r.unidades.toLocaleString()}</td>
                        ))}
                        <td className="px-3 py-2 text-center font-bold border-b border-gray-200 bg-gray-50">
                          {resumenPorFecha.reduce((s, r) => s + r.unidades, 0).toLocaleString()}
                        </td>
                      </tr>
                      <tr>
                        <td className="px-3 py-2 text-left font-bold text-gray-700 border-r border-gray-200 sticky left-0 bg-white whitespace-nowrap">Horas Requeridas</td>
                        {resumenPorFecha.map(r => (
                          <td key={r.fecha} className="px-3 py-2 text-center border-r border-gray-200 text-blue-700 font-semibold">
                            {r.horas.toFixed(2)}
                            {r.sinTiempoCount > 0 && (
                              <span className="ml-0.5 text-amber-600" title={`${r.sinTiempoCount} orden(es) sin tiempo unitario cargado, no incluida(s) en esta suma`}>*</span>
                            )}
                          </td>
                        ))}
                        <td className="px-3 py-2 text-center font-bold text-blue-700 bg-gray-50">
                          {resumenPorFecha.reduce((s, r) => s + r.horas, 0).toFixed(2)}
                        </td>
                      </tr>
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}

          {displayMode === 'plan' && (
            <div className="bg-gradient-to-r from-indigo-50 to-purple-50 border border-indigo-200 rounded-xl p-5 shadow-sm space-y-3">
              <div className="flex items-center justify-between gap-3 flex-wrap">
                <div className="flex items-center gap-2">
                  <Sparkles className="w-5 h-5 text-indigo-600" />
                  <h3 className="text-sm font-bold text-gray-800 uppercase tracking-tight">Alertas de Riesgo (IA)</h3>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-[11px] font-semibold text-gray-500 whitespace-nowrap">Turno de referencia:</span>
                  <Select value={String(turnoReferenciaHoras)} onValueChange={(v) => setTurnoReferenciaHoras(Number(v))}>
                    <SelectTrigger className="h-8 w-[230px] text-xs font-semibold bg-white">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {TURNO_REFERENCIA_HORAS_OPTIONS.map(h => (
                        <SelectItem key={h} value={String(h)} className="text-xs">
                          {h} horas ({TURNO_REFERENCIA_INICIO} - {formatShiftClockLabel(TURNO_REFERENCIA_INICIO, h)})
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              {bottleneckAnalysis.overloaded.length === 0 ? (
                <div className="flex items-center gap-2 text-emerald-700 bg-white/60 rounded-lg px-3 py-2">
                  <CheckCircle2 className="w-4 h-4 shrink-0" />
                  <p className="text-xs font-semibold">
                    No se detectan riesgos de retraso: ningún puesto de trabajo supera la jornada de {turnoReferenciaHoras}h en las fechas mostradas.
                  </p>
                </div>
              ) : (
                <div className="space-y-2">
                  <div className="flex items-start gap-2 bg-white/60 rounded-lg px-3 py-2">
                    <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
                    <p className="text-xs font-semibold text-amber-800">
                      Hay {bottleneckAnalysis.totalOrdenesEnRiesgo} orden(es) con riesgo de retraso por cuellos de botella en {bottleneckAnalysis.overloaded.length} puesto(s) de trabajo — la carga programada supera la jornada de {turnoReferenciaHoras}h seleccionada.
                    </p>
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
                    {bottleneckAnalysis.overloaded.map(g => (
                      <div key={`${g.fecha}-${g.puesto}`} className="border border-amber-200 bg-white rounded-lg px-3 py-2">
                        <p className="text-[11px] font-bold text-gray-800">{g.puesto} <span className="font-normal text-gray-400">— {g.fecha}</span></p>
                        <p className="text-[11px] text-amber-700">
                          {g.horasRequeridas.toFixed(2)}h requeridas vs {turnoReferenciaHoras}h de turno — excede en {(g.horasRequeridas - turnoReferenciaHoras).toFixed(2)}h ({g.ordenesEnRiesgo} de {g.ordenesTotal} orden(es) en riesgo)
                        </p>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              <div className="border-t border-indigo-200 pt-3 space-y-2">
                <div className="flex items-center justify-between gap-3 flex-wrap">
                  <p className="text-xs font-bold text-gray-700 uppercase tracking-tight">Riesgo de Stock — Insumos (Telas, Cascos, Cartón, Herrajes, etc.)</p>
                  <Button
                    onClick={handleCalcularRiesgoInsumos}
                    disabled={insumoStockState.loading}
                    size="sm"
                    className="h-7 text-xs gap-1.5 bg-indigo-600 hover:bg-indigo-700 text-white"
                  >
                    {insumoStockState.loading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <PackageSearch className="w-3.5 h-3.5" />}
                    {insumoStockState.calculatedAt ? 'Recalcular' : 'Calcular Riesgo de Insumos'}
                  </Button>
                </div>
                {insumoStockState.calculatedAt === null ? (
                  <p className="text-[11px] text-gray-500">
                    Calcula el riesgo de faltante de insumos comprados (Telas, Cascos, Cartón, Certificados, Etiquetas, Fundas, Garruchas, Herrajes, Niveladores, Padding, Patas, Placas, Plástico, Resbalones, Rodelas, Stickers, Tacos, Tornillos) para hoy y los próximos {INSUMO_VENTANA_DIAS} días, tomando el Stock Actual menos el consumo de todas las órdenes pasadas pendientes (explota materiales de las órdenes con demanda — puede tardar unos segundos).
                  </p>
                ) : insumoStockState.items.length === 0 ? (
                  <div className="flex items-center gap-2 text-emerald-700 bg-white/60 rounded-lg px-3 py-2">
                    <CheckCircle2 className="w-4 h-4 shrink-0" />
                    <p className="text-xs font-semibold">
                      Sin riesgo de faltante de insumos para hoy y los próximos {INSUMO_VENTANA_DIAS} días. (calculado {insumoStockState.calculatedAt})
                    </p>
                  </div>
                ) : (
                  <div className="space-y-2">
                    <div className="flex items-start justify-between gap-3 flex-wrap bg-white/60 rounded-lg px-3 py-2">
                      <div className="flex items-start gap-2">
                        <AlertTriangle className="w-4 h-4 text-red-600 shrink-0 mt-0.5" />
                        <p className="text-xs font-semibold text-red-800">
                          Hay {insumoStockState.items.length} insumo(s) con riesgo de faltante hoy o dentro de la ventana de {INSUMO_VENTANA_DIAS} días. (calculado {insumoStockState.calculatedAt})
                        </p>
                      </div>
                      <div className="flex items-center gap-2 shrink-0">
                        <Button
                          onClick={() => setInformeRiesgoOpen(true)}
                          size="sm"
                          className="h-7 text-xs gap-1.5 bg-red-600 hover:bg-red-700 text-white shrink-0"
                        >
                          <FileJson className="w-3.5 h-3.5" /> GENERAR INFORME DE RIESGO
                        </Button>
                        <Button
                          onClick={() => setInformeComercialOpen(true)}
                          size="sm"
                          className="h-7 text-xs gap-1.5 bg-indigo-600 hover:bg-indigo-700 text-white shrink-0"
                        >
                          <ListChecks className="w-3.5 h-3.5" /> GENERAR INFORME COMERCIAL
                        </Button>
                      </div>
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
                      {insumoStockState.items.map(item => (
                        <div key={item.componente} className="border border-red-200 bg-white rounded-lg px-3 py-2 space-y-1.5">
                          <p className="text-[11px] font-bold text-gray-800">
                            {item.tipo} <span className="font-mono">{item.componente}</span>
                            <span className="font-normal text-gray-400"> — {item.descripcion}</span>
                          </p>
                          <p className="text-[11px] text-red-700">
                            Necesario {item.necesario.toFixed(2)} {item.unidad} — Disponible {item.disponibleReal !== null ? item.disponibleReal.toFixed(2) : '—'} — Falta {item.cantidadNetaAConseguir.toFixed(2)}
                          </p>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}

          {displayMode === 'plan' && (
            <div className="bg-gray-50 border border-gray-200 rounded-lg p-4 shadow-sm">
              <h4 className="text-[13px] font-bold text-gray-800 mb-4 text-center uppercase tracking-wide flex items-center justify-center gap-2">
                <PieChart className="w-4 h-4 text-indigo-600" /> Resumen por Tipo de Mueble (Filtro Actual)
              </h4>
              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
                {resumenPorTipoMueble.map(r => (
                  <div key={r.tipo} className="bg-white border border-gray-200 rounded-lg p-3 flex flex-col items-center text-center">
                    <p className="text-[10px] font-bold text-gray-500 uppercase tracking-wide mb-1">{TIPO_MUEBLE_LABEL[r.tipo]}</p>
                    <p className="text-lg font-extrabold text-gray-900">{r.unidades.toLocaleString()}</p>
                    <p className="text-[10px] text-gray-400 mb-1.5">unidad(es) — {r.ordenes} orden(es)</p>
                    <div className="w-full h-1.5 bg-gray-100 rounded-full overflow-hidden">
                      <div className="h-full bg-indigo-500 rounded-full" style={{ width: `${Math.min(r.pct, 100)}%` }} />
                    </div>
                    <p className="text-xs font-bold text-indigo-700 mt-1">{r.pct.toFixed(1)}%</p>
                  </div>
                ))}
              </div>
            </div>
          )}

          {displayMode === 'plan' && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* Card 1: CAPACIDAD CONSOLIDADA (Toma en cuenta restricciones actualizadas) */}
                <div className="bg-gray-50 border border-gray-200 rounded-lg p-4 shadow-sm">
                  <h4 className="text-[13px] font-bold text-gray-800 mb-4 text-center uppercase tracking-wide flex items-center justify-center gap-2">
                    <LayoutDashboard className="w-4 h-4 text-indigo-600" /> CAPACIDAD CONSOLIDADA (TOTAL SISTEMA)
                  </h4>
                  <div className="grid grid-cols-3 gap-0 items-center text-base border rounded-md bg-white min-h-[80px]">
                      <div className="text-center border-r border-dashed border-gray-300 p-3 flex flex-col justify-center">
                          <p className="text-[10px] text-gray-500 font-semibold uppercase mb-1">UNIDADES TOTALES</p>
                          <p className="font-bold text-base text-gray-900">{globalSummary.totalCant.toLocaleString()}</p>
                      </div>
                      <div className="text-center border-r border-dashed border-gray-300 p-3 flex flex-col justify-center">
                          <p className="text-[10px] text-gray-500 font-semibold uppercase mb-1">HORAS TOTALES</p>
                          <p className="font-bold text-base text-indigo-700">{globalSummary.totalHours.toFixed(1)}h</p>
                      </div>
                      <div className="text-center p-3 flex flex-col justify-center">
                          <p className="text-[10px] text-gray-500 font-semibold uppercase mb-1">DÍAS CARGA</p>
                          <p className="font-bold text-base text-blue-600">
                            {(globalSummary.totalHours / avgDailyCapacityHours).toFixed(1)} Días
                          </p>
                      </div>
                  </div>
                </div>

                {/* Card 2: ESTADO DE ÓRDENES (Toma en cuenta restricciones actualizadas) */}
                <div className="bg-gray-50 border border-gray-200 rounded-lg p-4 shadow-sm">
                  <h4 className="text-[13px] font-bold text-gray-800 mb-4 text-center uppercase tracking-wide flex items-center justify-center gap-2">
                    <History className="w-4 h-4 text-indigo-600" /> ESTADO DE ÓRDENES (CRONOLÓGICO)
                  </h4>
                  <div className="grid grid-cols-3 gap-0 items-center text-sm border rounded-md bg-white min-h-[80px]">
                      <div className="text-center border-r border-dashed border-gray-300 p-2 flex flex-col justify-center bg-red-50/30">
                          <p className="text-[9px] text-red-600 font-bold uppercase mb-1" title="Órdenes antes de hoy">ATRASADAS</p>
                          <p className="font-bold text-sm text-red-700">{statusSummary.pastCant.toLocaleString()}</p>
                          <p className="text-[10px] text-red-500 font-mono">{statusSummary.pastHours.toFixed(1)}h</p>
                      </div>
                      <div className="text-center border-r border-dashed border-gray-300 p-2 flex flex-col justify-center bg-blue-50/30">
                          <p className="text-[9px] text-blue-600 font-bold uppercase mb-1" title="Carga del día de hoy">HOY</p>
                          <p className="font-bold text-sm text-blue-700">{statusSummary.todayCant.toLocaleString()}</p>
                          <p className="text-[10px] text-blue-500 font-mono">{statusSummary.todayHours.toFixed(1)}h</p>
                      </div>
                      <div className="text-center p-2 flex flex-col justify-center bg-green-50/30">
                          <p className="text-[9px] text-green-600 font-bold uppercase mb-1" title="Carga total por planificar">POR PLANIFICAR</p>
                          <p className="font-bold text-sm text-green-700">{statusSummary.futureCant.toLocaleString()}</p>
                          <p className="text-[10px] text-green-500 font-mono">{statusSummary.futureHours.toFixed(1)}h</p>
                      </div>
                  </div>
                </div>
            </div>
          )}

          {displayMode === 'plan' && (
            <div className="bg-gray-50 border border-gray-200 rounded-lg p-4 shadow-sm">
              <h4 className="text-[13px] font-bold text-gray-800 mb-4 text-center uppercase tracking-wide flex items-center justify-center gap-2">
                <ListChecks className="w-4 h-4 text-indigo-600" /> Desglose por Fecha y Mesa (Filtro Actual)
              </h4>
              <div className="space-y-4 max-h-[500px] overflow-y-auto">
                  {selectedDates.length > 0 ? (
                    planSummaryByDate.map((daySummary) => {
                      const capacidadOcupadaTotal = daySummary.capacidadTotalH > 0 ? (daySummary.tiempoTotalH / daySummary.capacidadTotalH) * 100 : 0;
                      if (!daySummary.snapshot) {
                        return (
                          <div key={daySummary.date} className="border rounded-md bg-white overflow-hidden shadow-sm">
                            <div className="p-2 bg-indigo-600 text-white text-xs font-bold uppercase text-center">FECHA: {daySummary.date}</div>
                            <p className="p-4 text-center text-amber-700 text-xs italic bg-amber-50">
                              No hay un Plan Diario guardado para esta fecha — ejecute "Distribución de Mesas" en "Plan Táctico (Alpha)" cuando esta sea la fecha objetivo de esa pestaña.
                            </p>
                          </div>
                        );
                      }
                      return (
                      <div key={daySummary.date} className="border rounded-md bg-white overflow-hidden shadow-sm">
                          <div className="grid grid-cols-5 gap-0 items-center text-xs p-2 bg-indigo-600 text-white font-bold uppercase">
                              <div className="text-center border-r border-indigo-400">FECHA: {daySummary.date}</div>
                              <div className="text-center border-r border-indigo-400">CANT: {daySummary.cantProgramada.toLocaleString()}</div>
                              <div className="text-center border-r border-indigo-400">REQ: {daySummary.tiempoTotalH.toFixed(1)}h</div>
                              <div className="text-center border-r border-indigo-400">DISP: {daySummary.capacidadTotalH.toFixed(1)}h ({daySummary.snapshot.shiftLabel})</div>
                              <div className="text-center">OCUPACIÓN: {capacidadOcupadaTotal.toFixed(1)}%</div>
                          </div>
                          <div className="overflow-x-auto">
                            <table className="min-w-full text-xs">
                              <thead className="bg-gray-100 text-gray-600 uppercase border-b">
                                <tr>
                                  <th className="px-3 py-1.5 text-left font-bold border-r">Mesa</th>
                                  <th className="px-3 py-1.5 text-left font-bold border-r">Personal</th>
                                  <th className="px-2 py-1.5 text-center font-bold border-r">Cant</th>
                                  <th className="px-2 py-1.5 text-center font-bold border-r">Horas Req</th>
                                  <th className="px-2 py-1.5 text-center font-bold border-r">Horas Disp</th>
                                  <th className="px-2 py-1.5 text-center font-bold">Ocupación %</th>
                                </tr>
                              </thead>
                              <tbody>
                                {daySummary.mesas.map((mesa) => {
                                  const capMesa = mesa.capacityHours > 0 ? (mesa.usedHours / mesa.capacityHours) * 100 : 0;
                                  const cantMesa = mesa.items.reduce((s, it) => s + it.cantidad, 0);
                                  const sinProductos = cantMesa === 0;
                                  const personalLabel = mesa.person
                                    ? `${mesa.person}${mesa.percentage ? ` (${mesa.percentage}%)` : ''}${mesa.calificacion !== null ? ` — Capacitación ${mesa.calificacion}%` : ''}`
                                    : 'Sin Asignar';
                                  return (
                                    <tr key={mesa.tableId} className={cn("border-b last:border-0", sinProductos && "bg-red-100")}>
                                      <td className="px-3 py-1 font-semibold border-r">{mesa.tableName}</td>
                                      <td className="px-3 py-1 border-r text-blue-600 truncate max-w-[220px]" title={personalLabel}>{personalLabel}</td>
                                      <td className="px-2 py-1 text-center font-mono border-r">{cantMesa}</td>
                                      <td className="px-2 py-1 text-center font-mono border-r">{mesa.usedHours.toFixed(2)}</td>
                                      <td className="px-2 py-1 text-center font-mono border-r text-gray-500">{mesa.capacityHours.toFixed(2)}</td>
                                      <td className={cn("px-2 py-1 text-center font-bold font-mono", capMesa > 100 ? "text-red-600 bg-red-50" : "text-blue-600")}>
                                        {capMesa.toFixed(1)}%
                                      </td>
                                    </tr>
                                  );
                                })}
                              </tbody>
                            </table>
                          </div>
                      </div>
                      );
                    })
                  ) : (
                    <p className="p-4 text-center text-gray-500 text-sm italic bg-white rounded-md border">Selecciona fechas para analizar capacidad.</p>
                  )}
              </div>
            </div>
          )}

          {displayMode === 'plan' && <PlanDiarioGanttSection planSummaryByDate={planSummaryByDate} />}
        </div>
      )}

      <div className="bg-white rounded-lg shadow-lg overflow-hidden border">
        <div ref={topScrollRef} onScroll={handleTopScroll} className="overflow-x-auto overflow-y-hidden" style={{ height: '18px' }}>
            <div style={{ width: `${tableWidth}px`, height: '1px' }}></div>
        </div>
        <div ref={tableScrollRef} onScroll={handleTableScroll} className="overflow-x-auto">
          <table ref={tableRef} className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-100">
              <tr>
                {COLUMNS_TO_DISPLAY.map((col, index) => (
                  <th key={col} className={cn("px-3 py-3 text-center text-[11px] font-bold text-gray-700 uppercase tracking-wider", index < COLUMNS_TO_DISPLAY.length - 1 && "border-r border-dashed border-gray-300")}>
                    {col}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {displayedOrders.map((order, index) => {
                  const materialCode = normalizeMaterialCode(order.MATERIAL);
                  const tiempoMin = tiemposMap.get(materialCode) || 0;
                  const tiempoTotal = (Number(order.CANTPROGRAMADA) || 0) * tiempoMin;

                  return (
                    <tr key={`${order._displayId}-${index}`} className={cn("hover:bg-gray-50 transition-colors", order._isPrevisional ? "bg-blue-50/20" : "")}>
                      {COLUMNS_TO_DISPLAY.map((col, colIndex) => {
                          const isBorder = colIndex < COLUMNS_TO_DISPLAY.length - 1 ? 'border-r border-dashed border-gray-300' : '';
                          
                          if (col === 'TIEMPO') {
                              return (
                                 <td key={col} className={cn("px-2 py-3 text-center font-mono font-bold text-[13px]", tiempoTotal === 0 ? "text-red-400" : "text-blue-700", isBorder)}>
                                   {tiempoTotal > 0 ? tiempoTotal.toFixed(2) : '-'}
                                 </td>
                              );
                          }

                          if (col === 'FECHA ENTREGA') {
                             const pedidoRaw = String(order.PEDIDO || '').trim();
                             const pedidoNoZeros = pedidoRaw.replace(/^0+/, '');
                             const deliveryDate = deliveryDatesMap.get(pedidoRaw) || deliveryDatesMap.get(pedidoNoZeros) || '-';
                             return (
                                <td key={col} className={cn("px-2 py-3 text-center text-[13px] font-semibold text-emerald-700", isBorder)}>
                                  {deliveryDate}
                                </td>
                             );
                          }

                          let displayValue = String((order as any)[col] ?? '-');
                          if ((col === 'PEDIDO' || col === 'POSICION') && displayValue.startsWith('000')) {
                              displayValue = displayValue.substring(3);
                          } else if (col === 'ORDEN' && displayValue.length > 4 && !order._isPrevisional) {
                              displayValue = displayValue.substring(4);
                          } else if (col === 'MATERIAL') {
                              displayValue = normalizeMaterialCode(displayValue);
                          }

                          return (
                           <td key={col} className={cn("px-2 py-3 text-center text-sm text-gray-600", col === 'CANTPROGRAMADA' && "font-bold text-gray-900", isBorder)}>
                             {displayValue}
                           </td>
                          );
                      })}
                    </tr>
                  );
              })}
            </tbody>
          </table>
        </div>
      </div>
      
      <div className="flex items-center justify-between mt-4">
        <div className="flex items-center space-x-4">
          <span className="text-sm text-gray-600">Mostrando {displayedOrders.length} de {filteredOrders.length} registros.</span>
          <select value={pagination.rowsPerPage} onChange={handleRowsPerPageChange} className="px-3 py-2 border border-gray-300 rounded-md text-sm bg-white font-medium text-gray-700 hover:border-gray-400 focus:outline-none focus:ring-2 focus:ring-indigo-500"
          >
            {ROWS_PER_PAGE_OPTIONS.map(size => <option key={size} value={size}>{size}</option>)}
          </select>
        </div>
        <div className="flex items-center space-x-2">
          <Button variant="outline" size="sm" onClick={() => goToPage(1)} disabled={pagination.currentPage === 1}>Primera</Button>
          <Button variant="outline" size="sm" onClick={() => goToPage(pagination.currentPage - 1)} disabled={pagination.currentPage === 1}>Ant.</Button>
          <span className="text-sm text-gray-600 px-2 font-bold">{pagination.currentPage} / {totalPagesLocal}</span>
          <Button variant="outline" size="sm" onClick={() => goToPage(pagination.currentPage + 1)} disabled={pagination.currentPage >= totalPagesLocal}>Sig.</Button>
          <Button variant="outline" size="sm" onClick={() => goToPage(totalPagesLocal)} disabled={pagination.currentPage >= totalPagesLocal}>Última</Button>
        </div>
      </div>

      {/* SUBSECCIÓN: EXPLOSIÓN DE MATERIALES */}
      {displayMode === 'plan' && (
        <div className="mt-8">
            <Accordion type="single" collapsible className="w-full bg-white border rounded-xl shadow-lg">
                <AccordionItem value="explosion" className="border-b-0">
                    <AccordionTrigger className="px-6 py-4 hover:no-underline">
                        <div className="flex items-center gap-3">
                            <div className="bg-emerald-100 p-2 rounded-lg">
                                <FileJson className="w-5 h-5 text-emerald-700" />
                            </div>
                            <div className="text-left">
                                <h3 className="text-lg font-bold text-gray-800">Explosión de Materiales (Necesidad de Componentes)</h3>
                                <p className="text-xs text-gray-500">Listado consolidado de componentes requeridos para el plan actual</p>
                            </div>
                            {explosionResults.length > 0 && (
                                <Badge className="ml-4 bg-emerald-100 text-emerald-700 border-emerald-200">
                                    {explosionResults.length} componentes
                                </Badge>
                            )}
                        </div>
                    </AccordionTrigger>
                    <AccordionContent className="px-6 pb-6">
                        {isExploding ? (
                            <div className="flex flex-col items-center justify-center py-12 gap-4">
                                <Loader2 className="w-12 h-12 animate-spin text-emerald-600" />
                                <p className="text-sm text-gray-600 font-medium">Procesando explosión de materiales... esto puede tomar un momento.</p>
                            </div>
                        ) : explosionResults.length > 0 ? (
                            <div className="overflow-x-auto border rounded-lg">
                                <table className="min-w-full divide-y divide-gray-200 text-xs">
                                    <thead className="bg-emerald-50">
                                        <tr>
                                            <th className="px-4 py-3 text-left font-bold text-emerald-900 uppercase">Material Componente</th>
                                            <th className="px-4 py-3 text-left font-bold text-emerald-900 uppercase">Descripción</th>
                                            <th className="px-4 py-3 text-center font-bold text-emerald-900 uppercase">Unidad</th>
                                            <th className="px-4 py-3 text-right font-bold text-emerald-900 uppercase">Cantidad Total Necesaria</th>
                                        </tr>
                                    </thead>
                                    <tbody className="bg-white divide-y divide-gray-100">
                                        {explosionResults.map((comp, idx) => (
                                            <tr key={`${comp.id}-${idx}`} className="hover:bg-emerald-50/30 transition-colors">
                                                <td className="px-4 py-2 font-mono font-bold text-indigo-700">{comp.id}</td>
                                                <td className="px-4 py-2 text-gray-700">{comp.description}</td>
                                                <td className="px-4 py-2 text-center text-gray-500 font-medium">{comp.unit}</td>
                                                <td className="px-4 py-2 text-right font-mono font-bold text-emerald-700">
                                                    {comp.totalNeeded.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                    <tfoot className="bg-gray-800 text-white font-bold">
                                        <tr>
                                            <td colSpan={3} className="px-4 py-3 text-right uppercase">Resumen de Explosión</td>
                                            <td className="px-4 py-3 text-right">
                                                {explosionResults.reduce((sum, c) => sum + c.totalNeeded, 0).toLocaleString(undefined, { maximumFractionDigits: 0 })} unidades de material
                                            </td>
                                        </tr>
                                    </tfoot>
                                </table>
                            </div>
                        ) : (
                            <div className="flex flex-col items-center justify-center py-12 bg-gray-50 border-2 border-dashed rounded-lg">
                                <Calculator className="w-12 h-12 text-gray-300 mb-4" />
                                <p className="text-sm text-gray-500">Haz clic en el botón superior <span className="font-bold">"Calcular Explosión"</span> para ver los materiales necesarios.</p>
                                <p className="text-xs text-gray-400 mt-1">Se procesarán todos los materiales correspondientes al filtro de fechas actual.</p>
                            </div>
                        )}
                    </AccordionContent>
                </AccordionItem>
            </Accordion>
        </div>
      )}

      <Dialog open={emailDialogOpen} onOpenChange={(open) => !emailSending && setEmailDialogOpen(open)}>
        <DialogContent className="sm:max-w-4xl max-h-[90vh] flex flex-col">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2"><Mail className="w-4 h-4 text-indigo-600" /> Enviar Correo — Reporte "PLAN"</DialogTitle>
            <DialogDescription>
              Se enviarán, en este orden: Detalle de Planificación Ejecutada, Desglose por Fecha y Mesa, Resumen por Tipo de Mueble, Diagrama de Gantt, Resumen de Órdenes Lanzadas por Fecha, y Capacidad Consolidada y Estado de Órdenes — para {selectedDates.length > 0 ? `${selectedDates.length} fecha(s) seleccionada(s)` : 'todas las fechas disponibles'}.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3 overflow-y-auto flex-1 pr-1">
            <div className="space-y-1">
              <Label htmlFor="email-destino" className="text-xs font-semibold">
                Destinatarios (separados por coma) — tomados de la Restricción "{NOMBRE_RESTRICCION_CORREOS_INFORME}"
              </Label>
              <Input
                id="email-destino"
                value={emailDestino}
                onChange={(e) => setEmailDestino(e.target.value)}
                placeholder="correo1@chaideychaide.com, correo2@chaideychaide.com"
                disabled={emailSending}
              />
              <p className="text-[11px] text-gray-500">
                Puede editarlos solo para este envío — para cambiarlos de forma permanente, actualice la
                Restricción "{NOMBRE_RESTRICCION_CORREOS_INFORME}" en "Restricciones".
              </p>
            </div>
            <div className="space-y-1">
              <Label htmlFor="email-asunto" className="text-xs font-semibold">Asunto</Label>
              <Input
                id="email-asunto"
                value={emailAsunto}
                onChange={(e) => setEmailAsunto(e.target.value)}
                disabled={emailSending}
              />
            </div>
            <div className="space-y-1">
              <Label className="text-xs font-semibold">Vista previa del contenido</Label>
              <div className="border border-gray-300 rounded-md overflow-hidden bg-white">
                <iframe
                  title="Vista previa del correo"
                  srcDoc={`<!doctype html><html><head><meta charset="utf-8"/><style>body{margin:0;padding:12px;}</style></head><body>${emailCuerpoHtml}</body></html>`}
                  className="w-full h-[420px]"
                  sandbox=""
                />
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEmailDialogOpen(false)} disabled={emailSending}>Cancelar</Button>
            <Button onClick={handleEnviarCorreo} disabled={emailSending} className="bg-indigo-600 hover:bg-indigo-700 text-white gap-2">
              {emailSending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Mail className="w-4 h-4" />}
              {emailSending ? 'Enviando...' : 'Enviar Correo'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={informeRiesgoOpen} onOpenChange={setInformeRiesgoOpen}>
        <DialogContent className="sm:max-w-6xl max-h-[90vh] flex flex-col">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <PackageSearch className="w-4 h-4 text-red-600" />
              Informe de Riesgo de Insumos — {insumoStockState.items.length} insumo(s) en riesgo
            </DialogTitle>
            <DialogDescription>
              Detalle, por cada insumo con riesgo de faltante, de las órdenes (Previsionales y Fert) que lo consumen — hoy o dentro de la ventana de {INSUMO_VENTANA_DIAS} días (demanda futura) o con consumo pasado pendiente. (calculado {insumoStockState.calculatedAt})
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-6 overflow-y-auto flex-1 pr-1">
            {insumoStockState.items.map(item => {
              const detalles = insumoStockState.detalleMap.get(item.componente) || [];
              return (
                <div key={item.componente} className="border border-gray-200 rounded-lg overflow-hidden">
                  <div className="bg-red-50 border-b border-red-200 px-4 py-2 space-y-2">
                    <p className="text-sm font-bold text-gray-800">
                      {item.tipo} <span className="font-mono">{item.componente}</span>
                      <span className="font-normal text-gray-500"> — {item.descripcion}</span>
                    </p>
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                      <div className="bg-white border border-gray-200 rounded-lg p-2 text-center">
                        <p className="text-[10px] font-semibold text-gray-500 uppercase">Stock Actual</p>
                        <p className="text-sm font-bold text-gray-800">{item.stockActual !== null ? item.stockActual.toFixed(2) : '—'} {item.unidad}</p>
                      </div>
                      <div className="bg-white border border-gray-200 rounded-lg p-2 text-center">
                        <p className="text-[10px] font-semibold text-gray-500 uppercase">Necesario ({INSUMO_VENTANA_DIAS} días)</p>
                        <p className="text-sm font-bold text-gray-800">{item.necesario.toFixed(2)} {item.unidad}</p>
                      </div>
                      <div className="bg-white border border-gray-200 rounded-lg p-2 text-center">
                        <p className="text-[10px] font-semibold text-gray-500 uppercase">Disponible Real</p>
                        <p className="text-sm font-bold text-gray-800">{item.disponibleReal !== null ? item.disponibleReal.toFixed(2) : '—'} {item.unidad}</p>
                      </div>
                      <div className="bg-red-100 border border-red-200 rounded-lg p-2 text-center">
                        <p className="text-[10px] font-semibold text-red-600 uppercase">Falta por Conseguir</p>
                        <p className="text-sm font-bold text-red-700">{item.cantidadNetaAConseguir.toFixed(2)} {item.unidad}</p>
                      </div>
                    </div>
                  </div>

                  {detalles.length === 0 ? (
                    <div className="flex items-center gap-2 text-gray-500 bg-gray-50 px-3 py-4 justify-center">
                      <p className="text-xs">No se encontraron órdenes con consumo positivo de este insumo (puede deberse a demanda de un material padre sin órdenes propias detectadas en el filtro actual).</p>
                    </div>
                  ) : (
                    <div className="overflow-x-auto">
                      <table className="min-w-full divide-y divide-gray-200 text-xs">
                        <thead className="bg-gray-50">
                          <tr>
                            <th className="px-3 py-2 text-left font-bold text-gray-600 uppercase">Ventana</th>
                            <th className="px-3 py-2 text-left font-bold text-gray-600 uppercase">Fecha</th>
                            <th className="px-3 py-2 text-left font-bold text-gray-600 uppercase">Pedido</th>
                            <th className="px-3 py-2 text-left font-bold text-gray-600 uppercase">Orden</th>
                            <th className="px-3 py-2 text-left font-bold text-gray-600 uppercase">Material</th>
                            <th className="px-3 py-2 text-left font-bold text-gray-600 uppercase">Descripción</th>
                            <th className="px-3 py-2 text-left font-bold text-gray-600 uppercase">Cliente</th>
                            <th className="px-3 py-2 text-right font-bold text-gray-600 uppercase">Cant. Pendiente</th>
                            <th className="px-3 py-2 text-right font-bold text-gray-600 uppercase">Consumo del Insumo</th>
                          </tr>
                        </thead>
                        <tbody className="bg-white divide-y divide-gray-100">
                          {detalles.map((d, idx) => (
                            <tr key={`${d.source}-${d.id}-${idx}`} className="hover:bg-red-50/30 transition-colors">
                              <td className="px-3 py-2">
                                <Badge className={d.ventana === 'Pasada' ? 'bg-amber-100 text-amber-700 border-amber-200' : 'bg-blue-100 text-blue-700 border-blue-200'}>
                                  {d.ventana}
                                </Badge>
                              </td>
                              <td className="px-3 py-2 text-gray-600 whitespace-nowrap">{d.fecha}</td>
                              <td className="px-3 py-2 font-mono text-gray-700">{d.pedido || '—'}{d.posicion ? `/${d.posicion}` : ''}</td>
                              <td className="px-3 py-2 font-mono font-bold text-indigo-700">{d.id} <span className="text-gray-400 font-normal">({d.source})</span></td>
                              <td className="px-3 py-2 font-mono text-gray-700">{d.material}</td>
                              <td className="px-3 py-2 text-gray-700">{d.nombre}</td>
                              <td className="px-3 py-2 text-gray-700">{d.cliente}</td>
                              <td className="px-3 py-2 text-right text-gray-700">{d.cantidadPendiente.toLocaleString(undefined, { maximumFractionDigits: 2 })}</td>
                              <td className="px-3 py-2 text-right font-bold text-red-700">{d.consumoComponente.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
                            </tr>
                          ))}
                        </tbody>
                        <tfoot className="bg-gray-800 text-white font-bold">
                          <tr>
                            <td colSpan={8} className="px-3 py-2 text-right uppercase">Total Consumo de Órdenes Listadas</td>
                            <td className="px-3 py-2 text-right">
                              {detalles.reduce((sum, d) => sum + d.consumoComponente, 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })} {item.unidad}
                            </td>
                          </tr>
                        </tfoot>
                      </table>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setInformeRiesgoOpen(false)}>Cerrar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* "GENERAR INFORME COMERCIAL": versión resumida para el área comercial (link de uso diario) — un
          listado plano de pedidos afectados por riesgo de faltante de insumos, sin el detalle técnico
          de Stock/Necesario/Disponible del Informe de Riesgo. */}
      <Dialog open={informeComercialOpen} onOpenChange={setInformeComercialOpen}>
        <DialogContent className="sm:max-w-5xl max-h-[90vh] flex flex-col">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <ListChecks className="w-4 h-4 text-indigo-600" />
              Informe Comercial de Riesgo — {informeComercialRows.length} pedido(s) afectado(s)
            </DialogTitle>
            <DialogDescription>
              Pedidos con riesgo de retraso por falta de un insumo (Tela, Casco u otro comprado) para hoy o
              dentro de los próximos {INSUMO_VENTANA_DIAS} días. (calculado {insumoStockState.calculatedAt})
            </DialogDescription>
          </DialogHeader>
          <div className="overflow-auto flex-1 pr-1">
            {informeComercialRows.length === 0 ? (
              <div className="flex items-center gap-2 text-gray-500 bg-gray-50 px-3 py-4 justify-center rounded-lg">
                <p className="text-xs">No hay pedidos afectados por riesgo de faltante de insumos.</p>
              </div>
            ) : (
              <table className="min-w-full divide-y divide-gray-200 text-xs">
                <thead className="bg-gray-50 sticky top-0">
                  <tr>
                    <th className="px-3 py-2 text-left font-bold text-gray-600 uppercase">Orden</th>
                    <th className="px-3 py-2 text-left font-bold text-gray-600 uppercase">Pedido</th>
                    <th className="px-3 py-2 text-left font-bold text-gray-600 uppercase">Posición</th>
                    <th className="px-3 py-2 text-left font-bold text-gray-600 uppercase">Material</th>
                    <th className="px-3 py-2 text-left font-bold text-gray-600 uppercase">Descripción</th>
                    <th className="px-3 py-2 text-right font-bold text-gray-600 uppercase">Cantidad</th>
                    <th className="px-3 py-2 text-left font-bold text-gray-600 uppercase">Cliente</th>
                    <th className="px-3 py-2 text-left font-bold text-gray-600 uppercase">Razón de Riesgo</th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-100">
                  {informeComercialRows.map((r, idx) => (
                    <tr key={`${r.orden}-${idx}`} className="hover:bg-indigo-50/30 transition-colors">
                      <td className="px-3 py-2 font-mono font-bold text-indigo-700">{r.orden}</td>
                      <td className="px-3 py-2 font-mono text-gray-700">{r.pedido || '—'}</td>
                      <td className="px-3 py-2 font-mono text-gray-700">{r.posicion || '—'}</td>
                      <td className="px-3 py-2 font-mono text-gray-700">{r.material}</td>
                      <td className="px-3 py-2 text-gray-700">{r.descripcion}</td>
                      <td className="px-3 py-2 text-right text-gray-700">{r.cantidad.toLocaleString(undefined, { maximumFractionDigits: 2 })}</td>
                      <td className="px-3 py-2 text-gray-700">{r.cliente}</td>
                      <td className="px-3 py-2 text-red-700 font-semibold whitespace-nowrap">{r.razon}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setInformeComercialOpen(false)}>Cerrar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};
