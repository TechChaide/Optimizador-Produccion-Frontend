'use client';

import React, { useState, useEffect, useMemo } from 'react';
import { serviciosService } from '@/services/servicios.service';
import { Loader2, RefreshCw, Search, Wrench, Inbox, AlertTriangle, ChevronsLeft, ChevronLeft, ChevronRight, ChevronsRight } from 'lucide-react';
import { useAppContext } from '@/context/AppProvider';
import { humanizeLabel } from '@/lib/utils';
import type { Restriccion } from '@/types/interfaces';

interface MantenimientoProgramado {
  [key: string]: any;
}

interface MantenimientoProgramadoSectionProps {
  restricciones?: Restriccion[];
}

const ROWS_PER_PAGE = 20;

// Campos de fecha/hora que SISMAC programa sin considerar fines de semana (una máquina puede
// quedar con mantenimiento "programado" para un sábado o domingo, días en que la planta no
// trabaja). El backend (apps.chaide.com/ProductionOptimizer) no acepta ningún filtro de fecha
// desde el frontend y siempre devuelve esas fechas crudas — se corrigen aquí, recorriendo la
// fecha (y sus horas de inicio/fin) al siguiente día hábil, para que un mantenimiento del
// sábado 01/08 se muestre correctamente como lunes 03/08.
const CAMPOS_FECHA_A_RECORRER = ['FECHA_PRO', 'FECHA_OT_PRG_INI', 'FECHA_OT_PRG_FIN'];

// Minutos que se asumen cuando SISMAC no manda la duración de la OT. Verificado contra el SP: hoy
// `Duracion_Minutos` llega vacío en TODOS los registros, así que sin este respaldo la columna de
// tiempo queda en blanco y el mantenimiento no descuenta ni una hora de capacidad.
const DURACION_MANTENIMIENTO_DEFECTO_MIN = 60;

/**
 * Minutos de una OT, con cadena de respaldo:
 *   1) `Duracion_Minutos` si viene con dato (fuente real).
 *   2) Diferencia entre FECHA_OT_PRG_FIN y FECHA_OT_PRG_INI, si ambas vienen.
 *   3) Valor por defecto, marcado como estimado para no confundirlo con el dato real.
 */
export function calcularTiempoMantenimiento(row: MantenimientoProgramado): { minutos: number; origen: 'sismac' | 'calculado' | 'estimado' } {
  const dur = row['Duracion_Minutos'];
  if (dur !== '' && dur !== null && dur !== undefined) {
    const n = Number(dur);
    if (!isNaN(n) && n > 0) return { minutos: n, origen: 'sismac' };
  }
  const ini = row['FECHA_OT_PRG_INI'];
  const fin = row['FECHA_OT_PRG_FIN'];
  if (ini && fin) {
    const diff = (new Date(fin).getTime() - new Date(ini).getTime()) / 60000;
    if (!isNaN(diff) && diff > 0) return { minutos: Math.round(diff), origen: 'calculado' };
  }
  return { minutos: DURACION_MANTENIMIENTO_DEFECTO_MIN, origen: 'estimado' };
}

// El backend entrega estas fechas como ISO con sufijo Z, pero el componente de fecha (año/mes/día)
// ya viene expresado en el día real programado (ver FECHA_PRO en los datos: 05:00 UTC = medianoche
// local) — se usan los componentes UTC para determinar el día de la semana de forma estable, sin
// depender de la zona horaria del navegador donde corra la app.
function diasHastaSiguienteDiaHabil(fechaISO: string): number {
  const dia = new Date(fechaISO).getUTCDay(); // 0=domingo … 6=sábado
  if (dia === 6) return 2; // sábado -> lunes
  if (dia === 0) return 1; // domingo -> lunes
  return 0;
}

// Marca cada fila reprogramada con `_fueReprogramado` (en vez de devolver un set de índices
// separado) para que el indicador sobreviva a cualquier filtrado posterior del arreglo (por
// restricciones de responsable, búsqueda, etc.) sin desalinearse.
function recorrerFinDeSemana(dataArray: MantenimientoProgramado[]): MantenimientoProgramado[] {
  return dataArray.map((row) => {
    const fechaPro = row['FECHA_PRO'];
    if (!fechaPro) return row;
    const dias = diasHastaSiguienteDiaHabil(fechaPro);
    if (dias === 0) return row;
    const filaAjustada: MantenimientoProgramado = { ...row, _fueReprogramado: true };
    CAMPOS_FECHA_A_RECORRER.forEach((campo) => {
      const valor = row[campo];
      if (!valor) return;
      const fecha = new Date(valor);
      fecha.setUTCDate(fecha.getUTCDate() + dias);
      filaAjustada[campo] = fecha.toISOString();
    });
    return filaAjustada;
  });
}

export const MantenimientoProgramadoSection: React.FC<MantenimientoProgramadoSectionProps> = ({ restricciones = [] }) => {
  const { addNotification } = useAppContext();
  const [mantenimientosRaw, setMantenimientosRaw] = useState<MantenimientoProgramado[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);
  const [columns, setColumns] = useState<string[]>([]);
  const [searchTerm, setSearchTerm] = useState('');

  // Responsables de Control de Producción habilitados para Muebles (restricción "RespCtrlProd")
  const validRespCodes = useMemo(() => {
    const respRestriccion = restricciones.find(r => r.nombre_restriccion === 'RespCtrlProd');
    if (!respRestriccion || !respRestriccion.valor_restriccion) return [];

    return respRestriccion.valor_restriccion
      .split(/[&,]/)
      .map(code => String(code).trim())
      .filter(Boolean);
  }, [restricciones]);

  // Máquinas excluidas por responsable (restricción "HRNP")
  const forbiddenMachinesMap = useMemo(() => {
    const hrnpRestriccion = restricciones.find(r => r.nombre_restriccion === 'HRNP');
    if (!hrnpRestriccion || !hrnpRestriccion.valor_restriccion) return new Map<string, string[]>();

    const map = new Map<string, string[]>();
    const regex = /\[([^:]+):\{([^}]+)\}\]/g;
    let match;

    const rawValue = hrnpRestriccion.valor_restriccion;
    while ((match = regex.exec(rawValue)) !== null) {
      const respCode = match[1].trim();
      const machines = match[2].split(',').map(m => m.trim()).filter(Boolean);
      map.set(respCode, machines);
    }
    return map;
  }, [restricciones]);

  const mantenimientos = useMemo(() => {
    return mantenimientosRaw.filter(row => {
      const rowResp = String(row.RespCtrlProd || '').trim();

      if (validRespCodes.length > 0 && !validRespCodes.includes(rowResp)) {
        return false;
      }

      if (forbiddenMachinesMap.has(rowResp)) {
        const rowMachine = String(row.MaquinaSismac || row.MAQUINA || '').trim();
        const forbiddenOnes = forbiddenMachinesMap.get(rowResp);
        if (forbiddenOnes?.includes(rowMachine)) {
          return false;
        }
      }

      return true;
    });
  }, [mantenimientosRaw, validRespCodes, forbiddenMachinesMap]);

  const cantidadReprogramados = useMemo(
    () => mantenimientos.reduce((count, row) => count + (row._fueReprogramado ? 1 : 0), 0),
    [mantenimientos]
  );

  // Si el filtrado reduce la cantidad de páginas, evita quedar atrapado en una página vacía
  useEffect(() => {
    const maxPage = Math.max(1, Math.ceil(mantenimientos.length / ROWS_PER_PAGE));
    setCurrentPage(prev => Math.min(prev, maxPage));
  }, [mantenimientos.length]);

  useEffect(() => {
    fetchMantenimientos();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const fetchMantenimientos = async () => {
    setIsLoading(true);
    try {
      const response = await serviciosService.ListarMantenimientoPreventivosProgramados();
      if (response && response.data) {
        const dataArrayCrudo = Array.isArray(response.data) ? response.data : [response.data];
        const dataArray = recorrerFinDeSemana(dataArrayCrudo);
        setMantenimientosRaw(dataArray);

        if (dataArrayCrudo.length > 0) {
          setColumns(Object.keys(dataArrayCrudo[0]));
        }

        const totalReprogramados = dataArray.reduce((count, row) => count + (row._fueReprogramado ? 1 : 0), 0);
        if (totalReprogramados > 0) {
          addNotification('warning', `${totalReprogramados} mantenimiento${totalReprogramados === 1 ? '' : 's'} programado${totalReprogramados === 1 ? '' : 's'} en fin de semana se movió al siguiente día hábil.`);
        }
      } else {
        setMantenimientosRaw([]);
        addNotification('warning', 'No se encontraron mantenimientos programados');
      }
    } catch (error) {
      addNotification('error', `Error al cargar mantenimientos: ${(error as Error).message}`);
      setMantenimientosRaw([]);
    } finally {
      setIsLoading(false);
    }
  };

  const filteredIndexed = useMemo(() => {
    const term = searchTerm.trim().toLowerCase();
    return mantenimientos
      .map((row, index) => ({ row, index }))
      .filter(({ row }) => !term || columns.some(col => String(row[col] ?? '').toLowerCase().includes(term)));
  }, [mantenimientos, columns, searchTerm]);

  useEffect(() => {
    setCurrentPage(1);
  }, [searchTerm]);

  const totalPages = Math.max(1, Math.ceil(filteredIndexed.length / ROWS_PER_PAGE));
  const startIndex = (currentPage - 1) * ROWS_PER_PAGE;
  const endIndex = startIndex + ROWS_PER_PAGE;
  const currentData = filteredIndexed.slice(startIndex, endIndex);

  const goToPage = (page: number) => {
    setCurrentPage(Math.max(1, Math.min(page, totalPages)));
  };

  return (
    <div className="p-6 md:p-8 space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div className="flex items-center gap-3">
          <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-amber-500/10">
            <Wrench className="h-6 w-6 text-amber-600" />
          </div>
          <div>
            <h1 className="text-2xl font-bold tracking-tight text-gray-900">Mantenimientos Preventivos</h1>
            <p className="text-sm text-gray-500">Órdenes de trabajo programadas por SISMAC, con duración estimada.</p>
          </div>
        </div>
        <button
          onClick={fetchMantenimientos}
          disabled={isLoading}
          className="inline-flex items-center gap-2 rounded-lg border border-gray-200 bg-white px-4 py-2 text-sm font-medium text-gray-700 shadow-sm transition-colors hover:bg-gray-50 disabled:opacity-50"
        >
          <RefreshCw className={`h-4 w-4 ${isLoading ? 'animate-spin' : ''}`} />
          Actualizar
        </button>
      </div>

      {cantidadReprogramados > 0 && (
        <div className="flex items-center gap-2.5 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
          <AlertTriangle className="h-4 w-4 flex-shrink-0 text-amber-500" />
          <span>
            {cantidadReprogramados} registro{cantidadReprogramados === 1 ? '' : 's'} programado{cantidadReprogramados === 1 ? '' : 's'} originalmente en fin de semana — movido{cantidadReprogramados === 1 ? '' : 's'} al siguiente día hábil (resaltado{cantidadReprogramados === 1 ? '' : 's'} abajo).
          </span>
        </div>
      )}

      <div className="rounded-2xl border border-gray-100 bg-white shadow-sm">
        <div className="flex flex-col gap-3 border-b border-gray-100 p-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="relative w-full sm:max-w-xs">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
            <input
              type="search"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Buscar en la tabla..."
              className="w-full rounded-lg border border-gray-200 bg-gray-50 py-2 pl-9 pr-3 text-sm outline-none transition-colors focus:border-amber-300 focus:bg-white focus:ring-2 focus:ring-amber-100"
            />
          </div>
          <p className="text-xs font-medium text-gray-400">
            {filteredIndexed.length} registro{filteredIndexed.length === 1 ? '' : 's'}
            {filteredIndexed.length !== mantenimientos.length ? ` (de ${mantenimientos.length})` : ''}
          </p>
        </div>

        {isLoading ? (
          <div className="flex flex-col items-center justify-center gap-3 py-24 text-gray-400">
            <Loader2 className="h-8 w-8 animate-spin text-amber-500" />
            <span className="text-sm">Cargando mantenimientos programados...</span>
          </div>
        ) : filteredIndexed.length === 0 ? (
          <div className="flex flex-col items-center justify-center gap-2 py-24 text-gray-400">
            <Inbox className="h-10 w-10" />
            <p className="text-sm">
              {mantenimientos.length === 0 ? 'No hay mantenimientos programados' : 'Ningún registro coincide con la búsqueda'}
            </p>
          </div>
        ) : (
          <>
            <div className="max-h-[65vh] overflow-auto">
              <table className="w-full border-collapse text-sm">
                <thead className="sticky top-0 z-10 bg-gray-50">
                  <tr>
                    <th className="whitespace-nowrap border-b border-gray-100 bg-indigo-50/60 px-4 py-3 text-left text-[11px] font-bold uppercase tracking-wide text-indigo-700">
                      Tiempo
                    </th>
                    {columns.map((col) => (
                      <th
                        key={col}
                        className="whitespace-nowrap border-b border-gray-100 px-4 py-3 text-left text-[11px] font-bold uppercase tracking-wide text-gray-500"
                      >
                        {humanizeLabel(col)}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50">
                  {currentData.map(({ row, index: indiceGlobal }) => {
                    const fueReprogramado = !!row._fueReprogramado;
                    const tiempo = calcularTiempoMantenimiento(row);
                    return (
                      <tr key={indiceGlobal} className={`transition-colors ${fueReprogramado ? 'bg-amber-50/70 hover:bg-amber-50' : 'hover:bg-indigo-50/40'}`}>
                        <td
                          className="whitespace-nowrap bg-indigo-50/30 px-4 py-2.5"
                          title={
                            tiempo.origen === 'sismac' ? 'Duración enviada por SISMAC (Duracion_Minutos).'
                            : tiempo.origen === 'calculado' ? 'Calculada como fin − inicio de la OT programada.'
                            : `SISMAC no envió duración para esta OT: se asume el valor por defecto de ${DURACION_MANTENIMIENTO_DEFECTO_MIN} min.`
                          }
                        >
                          <span className="font-mono font-bold text-indigo-800">{tiempo.minutos} min</span>
                          <span className="ml-1 text-[10px] font-semibold text-gray-400">
                            ({(tiempo.minutos / 60).toFixed(2)} h)
                          </span>
                          {tiempo.origen !== 'sismac' && (
                            <span className={`ml-2 rounded px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wide ${tiempo.origen === 'calculado' ? 'bg-sky-100 text-sky-700' : 'bg-amber-100 text-amber-700'}`}>
                              {tiempo.origen === 'calculado' ? 'calculado' : 'estimado'}
                            </span>
                          )}
                        </td>
                        {columns.map((col) => (
                          <td key={`${indiceGlobal}-${col}`} className="whitespace-nowrap px-4 py-2.5 text-gray-700">
                            {typeof row[col] === 'object'
                              ? JSON.stringify(row[col])
                              : String(row[col] ?? '-')}
                          </td>
                        ))}
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {totalPages > 1 && (
              <div className="flex flex-col gap-3 border-t border-gray-100 px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
                <p className="text-xs text-gray-400">
                  Mostrando {startIndex + 1}–{Math.min(endIndex, filteredIndexed.length)} de {filteredIndexed.length}
                </p>
                <div className="flex items-center gap-1">
                  <button onClick={() => goToPage(1)} disabled={currentPage === 1} className="rounded-md p-1.5 text-gray-500 transition-colors hover:bg-gray-100 disabled:cursor-not-allowed disabled:opacity-30">
                    <ChevronsLeft className="h-4 w-4" />
                  </button>
                  <button onClick={() => goToPage(currentPage - 1)} disabled={currentPage === 1} className="rounded-md p-1.5 text-gray-500 transition-colors hover:bg-gray-100 disabled:cursor-not-allowed disabled:opacity-30">
                    <ChevronLeft className="h-4 w-4" />
                  </button>
                  <div className="min-w-[90px] rounded-md bg-gray-50 px-3 py-1.5 text-center text-xs font-semibold text-gray-600">
                    Página {currentPage} de {totalPages}
                  </div>
                  <button onClick={() => goToPage(currentPage + 1)} disabled={currentPage === totalPages} className="rounded-md p-1.5 text-gray-500 transition-colors hover:bg-gray-100 disabled:cursor-not-allowed disabled:opacity-30">
                    <ChevronRight className="h-4 w-4" />
                  </button>
                  <button onClick={() => goToPage(totalPages)} disabled={currentPage === totalPages} className="rounded-md p-1.5 text-gray-500 transition-colors hover:bg-gray-100 disabled:cursor-not-allowed disabled:opacity-30">
                    <ChevronsRight className="h-4 w-4" />
                  </button>
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
};
