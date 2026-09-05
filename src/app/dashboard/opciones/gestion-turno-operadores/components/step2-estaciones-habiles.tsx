"use client";

import { useEffect, useMemo, useState } from 'react';
import { useToast } from '@/hooks/use-toast';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { estacionService } from '@/services/estacion.service';
import { lineaService } from '@/services/linea.service';
import {
  AlertCircle,
  CalendarDays,
  Factory,
  ListChecks,
  Search,
  Users,
} from 'lucide-react';
import type { Grupo, Linea } from '@/types/interfaces';
import type { SolicitudPlanificacionItem } from '@/types/planificador-personas';

interface Step2EstacionesHabilesProps {
  grupo: Grupo | null;
  operadores: Array<{ identificador_operador: string }>;
  dateRangeStart: string;
  dateRangeEnd: string;
  onDateRangeChange: (start: string, end: string) => void;
  numTurnos: number;
  onSolicitudChange?: (solicitud: SolicitudPlanificacionItem[]) => void;
  isLoading?: boolean;
}

interface EstacionRelacion {
  codigo_linea: number;
  nombre_linea: string;
  codigo_estacion: number;
  nombre_estacion: string;
  numero_puestos: number;
  numero_personas: number;
  puesto_habilidades: string;
}

interface LineaConEstaciones {
  linea: Linea;
  estaciones: EstacionRelacion[];
}

type SeleccionTurno = Record<number, number>;

export default function Step2EstacionesHabiles({
  grupo,
  operadores,
  dateRangeStart,
  dateRangeEnd,
  onDateRangeChange,
  numTurnos,
  onSolicitudChange,
  isLoading = false,
}: Step2EstacionesHabilesProps) {
  const [searchFilter, setSearchFilter] = useState('');
  const [lineasConEstaciones, setLineasConEstaciones] = useState<LineaConEstaciones[]>([]);
  const [seleccionPorTurno, setSeleccionPorTurno] = useState<SeleccionTurno[]>([]);
  const [isLoadingRelaciones, setIsLoadingRelaciones] = useState(false);
  const { toast } = useToast();

  useEffect(() => {
    setSeleccionPorTurno(Array.from({ length: numTurnos }, () => ({})));
  }, [numTurnos, grupo?.codigo_grupo]);

  useEffect(() => {
    const fetchRelaciones = async () => {
      if (!grupo) {
        setLineasConEstaciones([]);
        return;
      }

      setIsLoadingRelaciones(true);
      try {
        const [lineasResponse, estacionesResponse] = await Promise.all([
          lineaService.getAll(),
          estacionService.getAll(),
        ]);

        const lineasGrupo = (lineasResponse.data || []).filter(
          linea => linea.codigo_grupo === grupo.codigo_grupo && linea.estado === 'A'
        );

        const lineaIds = new Set(lineasGrupo.map(linea => linea.codigo_linea));

        const estacionesGrupo = (estacionesResponse.data || []).filter(
          estacion => lineaIds.has(estacion.codigo_linea) && estacion.estado === 'A'
        );

        const relaciones = lineasGrupo
          .map(linea => ({
            linea,
            estaciones: estacionesGrupo
              .filter(estacion => estacion.codigo_linea === linea.codigo_linea)
              .map(estacion => ({
                codigo_linea: linea.codigo_linea,
                nombre_linea: linea.nombre_linea,
                codigo_estacion: estacion.codigo_estacion,
                nombre_estacion: estacion.nombre_estacion,
                numero_puestos: Math.max(1, estacion.numero_puestos || 1),
                numero_personas: Math.max(1, estacion.numero_personas || 1),
                puesto_habilidades: estacion.puesto_habilidades || '',
              })),
          }))
          .filter(item => item.estaciones.length > 0);

        setLineasConEstaciones(relaciones);
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : 'No se pudieron cargar las líneas y estaciones';
        toast({ title: 'Error', description: errorMessage, variant: 'destructive' });
        setLineasConEstaciones([]);
      } finally {
        setIsLoadingRelaciones(false);
      }
    };

    fetchRelaciones();
  }, [grupo, toast]);

  const estacionesFiltradas = useMemo(() => {
    if (!searchFilter.trim()) return lineasConEstaciones;

    const filtro = searchFilter.toLowerCase();
    return lineasConEstaciones
      .map(item => ({
        ...item,
        estaciones: item.estaciones.filter(estacion =>
          item.linea.nombre_linea.toLowerCase().includes(filtro) ||
          estacion.nombre_estacion.toLowerCase().includes(filtro)
        ),
      }))
      .filter(item => item.estaciones.length > 0);
  }, [lineasConEstaciones, searchFilter]);

  const totalEstacionesDisponibles = useMemo(
    () => lineasConEstaciones.reduce((total, item) => total + item.estaciones.length, 0),
    [lineasConEstaciones]
  );

  const resumenPorTurno = useMemo(
    () =>
      seleccionPorTurno.map(seleccion => {
        const estacionesActivas = Object.keys(seleccion).length;
        const personas = Object.values(seleccion).reduce((sum, cantidad) => sum + cantidad, 0);
        return { estacionesActivas, personas };
      }),
    [seleccionPorTurno]
  );

  useEffect(() => {
    const estacionesIndexadas = new Map<number, EstacionRelacion>();
    lineasConEstaciones.forEach(item => {
      item.estaciones.forEach(estacion => {
        estacionesIndexadas.set(estacion.codigo_estacion, estacion);
      });
    });

    const numeroSemanas = (() => {
      if (!dateRangeStart || !dateRangeEnd) {
        return 0;
      }

      const start = new Date(`${dateRangeStart}T00:00:00`);
      const end = new Date(`${dateRangeEnd}T00:00:00`);
      const diffInMs = end.getTime() - start.getTime();
      const diffInDays = Math.floor(diffInMs / (1000 * 60 * 60 * 24)) + 1;

      return Math.max(1, Math.ceil(diffInDays / 7));
    })();

    const solicitud = seleccionPorTurno.flatMap((seleccion, turnoIndex) =>
      Object.entries(seleccion).flatMap(([codigoEstacion, cantidad]) => {
        const estacion = estacionesIndexadas.get(Number(codigoEstacion));

        if (!estacion || !grupo || numeroSemanas === 0) {
          return [] as SolicitudPlanificacionItem[];
        }

        return [{
          turno: `Turno ${turnoIndex + 1}`,
          linea: estacion.nombre_linea,
          estacion: {
            estacion_planificacion: estacion.nombre_estacion,
            estacion_habilidad: estacion.puesto_habilidades || estacion.nombre_estacion,
          },
          personas_requeridas: cantidad,
          numero_semanas: numeroSemanas,
          grupo: grupo.nombre_grupo,
        }];
      })
    );

    onSolicitudChange?.(solicitud);
  }, [
    dateRangeEnd,
    dateRangeStart,
    grupo,
    lineasConEstaciones,
    onSolicitudChange,
    seleccionPorTurno,
  ]);

  const updateSeleccion = (turnoIndex: number, codigoEstacion: number, cantidad: number | null) => {
    setSeleccionPorTurno(previous => {
      const next = [...previous];
      const actual = { ...(next[turnoIndex] || {}) };

      if (cantidad === null) {
        delete actual[codigoEstacion];
      } else {
        actual[codigoEstacion] = cantidad;
      }

      next[turnoIndex] = actual;
      return next;
    });
  };

  const handleCheckboxChange = (
    turnoIndex: number,
    estacion: EstacionRelacion,
    checked: boolean
  ) => {
    const cantidadSugerida = estacion.numero_puestos * estacion.numero_personas;
    updateSeleccion(turnoIndex, estacion.codigo_estacion, checked ? cantidadSugerida : null);
  };

  const handleCantidadChange = (
    turnoIndex: number,
    estacion: EstacionRelacion,
    value: string
  ) => {
    const parsed = Number(value);
    const cantidadSugerida = estacion.numero_puestos * estacion.numero_personas;
    const cantidad = Number.isFinite(parsed) ? Math.max(1, parsed) : cantidadSugerida;
    updateSeleccion(turnoIndex, estacion.codigo_estacion, cantidad);
  };

  const limpiarTurno = (turnoIndex: number) => {
    setSeleccionPorTurno(previous => {
      const next = [...previous];
      next[turnoIndex] = {};
      return next;
    });
  };

  const seleccionarTodasLasEstacionesDeLinea = (
    turnoIndex: number,
    estaciones: EstacionRelacion[]
  ) => {
    setSeleccionPorTurno(previous => {
      const next = [...previous];
      const actual = { ...(next[turnoIndex] || {}) };

      estaciones.forEach(estacion => {
        actual[estacion.codigo_estacion] = estacion.numero_puestos * estacion.numero_personas;
      });

      next[turnoIndex] = actual;
      return next;
    });
  };

  const handleDateSelect = (value: string) => {
    if (!value) {
      onDateRangeChange('', '');
      return;
    }

    const [year, month, day] = value.split('-').map(Number);
    const startDate = new Date(year, month - 1, day);
    const endDate = new Date(year, month - 1, day + 6);

    const formattedStart = startDate.toISOString().split('T')[0];
    const formattedEnd = endDate.toISOString().split('T')[0];

    onDateRangeChange(formattedStart, formattedEnd);
  };

  const formatDateRangeDisplay = () => {
    if (!dateRangeStart || !dateRangeEnd) return '';

    const start = new Date(dateRangeStart).toLocaleDateString('es-EC', {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
    });
    const end = new Date(dateRangeEnd).toLocaleDateString('es-EC', {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
    });

    return `${start} - ${end}`;
  };

  if (!grupo) {
    return (
      <Card className="rounded-2xl shadow-xl border border-gray-100 overflow-hidden">
        <div className="bg-gradient-to-r from-blue-600 to-indigo-600 px-6 py-4">
          <h2 className="text-white font-bold text-lg">Estaciones Hábiles por Turno</h2>
        </div>
        <CardContent className="p-6">
          <div className="flex items-start gap-3 p-4 bg-amber-50 rounded-xl border border-amber-200">
            <AlertCircle className="w-5 h-5 text-amber-600 mt-0.5 flex-shrink-0" />
            <div>
              <p className="text-sm font-medium text-amber-900">Paso anterior incompleto</p>
              <p className="text-xs text-amber-700 mt-1">Primero debes seleccionar un grupo</p>
            </div>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      <Card className="rounded-2xl shadow-xl border border-gray-100 overflow-hidden">
        <div className="bg-gradient-to-r from-blue-600 via-blue-700 to-indigo-600 px-6 py-5">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
            <div>
              <h2 className="text-white font-bold text-xl">Estaciones Hábiles por Turno</h2>
              <p className="text-blue-100 text-sm mt-1">
                En cada turno marca qué estaciones estarán hábiles y cuántas personas necesitas por estación.
              </p>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 min-w-full lg:min-w-[28rem]">
              <div className="rounded-xl bg-white/10 border border-white/20 px-4 py-3 backdrop-blur-sm">
                <p className="text-[11px] uppercase tracking-[0.2em] text-blue-100">Grupo</p>
                <p className="text-sm font-semibold text-white mt-1 truncate">{grupo.nombre_grupo}</p>
              </div>
              <div className="rounded-xl bg-white/10 border border-white/20 px-4 py-3 backdrop-blur-sm">
                <p className="text-[11px] uppercase tracking-[0.2em] text-blue-100">Líneas / estaciones</p>
                <p className="text-2xl font-bold text-white mt-1">{lineasConEstaciones.length} / {totalEstacionesDisponibles}</p>
              </div>
              <div className="rounded-xl bg-white/10 border border-white/20 px-4 py-3 backdrop-blur-sm">
                <p className="text-[11px] uppercase tracking-[0.2em] text-blue-100">Operadores</p>
                <p className="text-2xl font-bold text-white mt-1">{operadores.length}</p>
              </div>
            </div>
          </div>
        </div>
        <CardContent className="p-6 space-y-6">
          <div className="rounded-2xl border border-blue-100 bg-gradient-to-r from-blue-50 via-white to-indigo-50 p-5">
            <div className="flex flex-col gap-4 xl:flex-row xl:items-end xl:justify-between">
              <div className="flex items-start gap-3 max-w-2xl">
                <CalendarDays className="w-5 h-5 text-blue-700 mt-0.5" />
                <div>
                  <p className="text-sm font-semibold text-blue-950">Semana operativa</p>
                  <p className="text-xs text-blue-800 mt-1">
                    Selecciona la fecha de inicio y el sistema completa automáticamente 7 días para todos los turnos.
                  </p>
                </div>
              </div>

              <div className="grid grid-cols-1 gap-3 sm:grid-cols-[minmax(16rem,20rem)_minmax(16rem,1fr)] xl:min-w-[38rem]">
                <div className="space-y-2">
                  <label className="text-xs font-semibold text-blue-950">Fecha de inicio</label>
                  <input
                    type="date"
                    className="w-full rounded-xl border border-blue-200 bg-white px-3 py-2.5 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
                    value={dateRangeStart}
                    onChange={event => handleDateSelect(event.target.value)}
                    disabled={isLoading || isLoadingRelaciones}
                  />
                </div>

                <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3">
                  <p className="text-xs font-semibold text-emerald-900">Intervalo seleccionado</p>
                  <p className="text-sm text-emerald-800 mt-1">
                    {dateRangeStart && dateRangeEnd ? formatDateRangeDisplay() : 'Selecciona una fecha para generar la semana operativa'}
                  </p>
                </div>
              </div>
            </div>
          </div>

          <div className="space-y-4">
              {isLoadingRelaciones ? (
                <div className="rounded-2xl border border-slate-200 bg-white p-10 text-center text-slate-500">
                  Cargando líneas y estaciones del grupo...
                </div>
              ) : estacionesFiltradas.length === 0 ? (
                <div className="rounded-2xl border border-slate-200 bg-white p-10 text-center">
                  <Factory className="w-10 h-10 text-slate-300 mx-auto mb-3" />
                  <p className="text-sm font-semibold text-slate-700">
                    {searchFilter ? 'No hay coincidencias con ese filtro' : 'No hay líneas o estaciones activas para este grupo'}
                  </p>
                </div>
              ) : (
                <div
                  className="grid gap-4 items-stretch"
                  style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 26rem), 1fr))' }}
                >
                  {Array.from({ length: numTurnos }).map((_, turnoIndex) => (
                    <div
                      key={`turno-${turnoIndex}`}
                      className="h-full rounded-2xl border border-fuchsia-100 bg-gradient-to-b from-fuchsia-50 to-white p-4 shadow-sm"
                    >
                      <div className="flex items-start justify-between gap-3 mb-4">
                        <div>
                          <p className="text-xs font-bold tracking-[0.2em] uppercase text-fuchsia-700">
                            Turno {turnoIndex + 1}
                          </p>
                          <p className="text-xs text-slate-500 mt-1">
                            Estaciones activas: {resumenPorTurno[turnoIndex]?.estacionesActivas || 0}
                          </p>
                        </div>
                        <div className="text-right">
                          <Badge className="bg-fuchsia-600 text-white hover:bg-fuchsia-600">
                            {resumenPorTurno[turnoIndex]?.personas || 0} pers.
                          </Badge>
                          <button
                            type="button"
                            onClick={() => limpiarTurno(turnoIndex)}
                            className="block mt-2 text-[11px] font-semibold text-slate-500 hover:text-slate-700"
                          >
                            Limpiar turno
                          </button>
                        </div>
                      </div>

                      <div className="space-y-4 max-h-[38rem] overflow-y-auto pr-1">
                        {estacionesFiltradas.map(item => (
                          <div
                            key={`turno-${turnoIndex}-linea-${item.linea.codigo_linea}`}
                            className="rounded-2xl border border-slate-200 bg-white p-4"
                          >
                            <div className="flex items-center justify-between gap-3 mb-3">
                              <div className="flex items-center gap-2 min-w-0">
                                <Factory className="w-4 h-4 text-fuchsia-500" />
                                <p className="text-sm font-semibold text-slate-900">{item.linea.nombre_linea}</p>
                              </div>
                              <button
                                type="button"
                                onClick={() => seleccionarTodasLasEstacionesDeLinea(turnoIndex, item.estaciones)}
                                disabled={isLoading || isLoadingRelaciones || item.estaciones.length === 0}
                                className="shrink-0 rounded-lg border border-fuchsia-200 bg-fuchsia-50 px-3 py-1.5 text-[11px] font-semibold text-fuchsia-700 transition-colors hover:bg-fuchsia-100 disabled:cursor-not-allowed disabled:opacity-50"
                              >
                                Seleccionar todas
                              </button>
                            </div>

                            <div className="space-y-3">
                              {item.estaciones.map(estacion => {
                                const checked = seleccionPorTurno[turnoIndex]?.[estacion.codigo_estacion] != null;
                                const cantidadSugerida = estacion.numero_puestos * estacion.numero_personas;
                                const cantidad = seleccionPorTurno[turnoIndex]?.[estacion.codigo_estacion] ?? cantidadSugerida;

                                return (
                                  <div
                                    key={`turno-${turnoIndex}-estacion-${estacion.codigo_estacion}`}
                                    className={`rounded-xl border p-3 transition-colors ${
                                      checked ? 'border-fuchsia-200 bg-fuchsia-50' : 'border-slate-200 bg-slate-50'
                                    }`}
                                  >
                                    <div className="flex items-start gap-3">
                                      <input
                                        type="checkbox"
                                        checked={checked}
                                        onChange={event =>
                                          handleCheckboxChange(turnoIndex, estacion, event.target.checked)
                                        }
                                        className="mt-1 h-4 w-4 rounded border-slate-300 text-fuchsia-600 focus:ring-fuchsia-500"
                                        disabled={isLoading || isLoadingRelaciones}
                                      />

                                      <div className="flex-1 min-w-0">
                                        <p className="text-sm font-semibold text-slate-900 break-words">
                                          {estacion.nombre_linea} - {estacion.nombre_estacion}
                                        </p>
                                        {estacion.puesto_habilidades && (
                                          <p className="text-xs font-medium text-fuchsia-700 mt-1 break-words">
                                            {estacion.puesto_habilidades}
                                          </p>
                                        )}
                                        <p className="text-xs text-slate-500 mt-1">
                                          Estación habilitada para el turno {turnoIndex + 1}
                                        </p>
                                        <div className="mt-2 flex flex-wrap gap-2">
                                          <Badge variant="outline" className="text-[11px] font-semibold">
                                            Puestos: {estacion.numero_puestos}
                                          </Badge>
                                          <Badge variant="outline" className="text-[11px] font-semibold">
                                            Personas: {estacion.numero_personas}
                                          </Badge>
                                        </div>
                                      </div>

                                      <div className="w-24">
                                        <label className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500 block mb-1">
                                          Personas
                                        </label>
                                        <input
                                          type="number"
                                          min={1}
                                          value={cantidad}
                                          onChange={event =>
                                            handleCantidadChange(turnoIndex, estacion, event.target.value)
                                          }
                                          disabled={!checked || isLoading || isLoadingRelaciones}
                                          className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-fuchsia-500 disabled:bg-slate-100 disabled:text-slate-400"
                                        />
                                      </div>
                                    </div>
                                  </div>
                                );
                              })}
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}