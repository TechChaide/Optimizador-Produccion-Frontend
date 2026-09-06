'use client';

import React, { useState, useEffect } from 'react';
import { serviciosService } from '@/services/servicios.service';
import { Loader2 } from 'lucide-react';
import { useAppContext } from '@/context/AppProvider';

interface MantenimientoProgramado {
  [key: string]: any;
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

function recorrerFinDeSemana(dataArray: MantenimientoProgramado[]): { datos: MantenimientoProgramado[]; indicesReprogramados: Set<number> } {
  const indicesReprogramados = new Set<number>();
  const datos = dataArray.map((row, idx) => {
    const fechaPro = row['FECHA_PRO'];
    if (!fechaPro) return row;
    const dias = diasHastaSiguienteDiaHabil(fechaPro);
    if (dias === 0) return row;
    indicesReprogramados.add(idx);
    const filaAjustada = { ...row };
    CAMPOS_FECHA_A_RECORRER.forEach((campo) => {
      const valor = row[campo];
      if (!valor) return;
      const fecha = new Date(valor);
      fecha.setUTCDate(fecha.getUTCDate() + dias);
      filaAjustada[campo] = fecha.toISOString();
    });
    return filaAjustada;
  });
  return { datos, indicesReprogramados };
}

export const MantenimientoProgramadoSection: React.FC = () => {
  const { addNotification } = useAppContext();
  const [mantenimientos, setMantenimientos] = useState<MantenimientoProgramado[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);
  const [columns, setColumns] = useState<string[]>([]);
  const [filasReprogramadas, setFilasReprogramadas] = useState<Set<number>>(new Set());

  useEffect(() => {
    fetchMantenimientos();
  }, []);

  const fetchMantenimientos = async () => {
    setIsLoading(true);
    try {
      const response = await serviciosService.ListarMantenimientoPreventivosProgramados();
      if (response && response.data) {
        const dataArrayCrudo = Array.isArray(response.data) ? response.data : [response.data];
        const { datos: dataArray, indicesReprogramados } = recorrerFinDeSemana(dataArrayCrudo);
        setMantenimientos(dataArray);
        setFilasReprogramadas(indicesReprogramados);
        if (indicesReprogramados.size > 0) {
          addNotification('warning', `${indicesReprogramados.size} mantenimiento${indicesReprogramados.size === 1 ? '' : 's'} programado${indicesReprogramados.size === 1 ? '' : 's'} en fin de semana se movió al siguiente día hábil.`);
        }

        // Extraer columnas del primer registro
        if (dataArray.length > 0) {
          setColumns(Object.keys(dataArray[0]));
        }
      } else {
        setMantenimientos([]);
        setFilasReprogramadas(new Set());
        addNotification('warning', 'No se encontraron mantenimientos programados');
      }
    } catch (error) {
      addNotification('error', `Error al cargar mantenimientos: ${(error as Error).message}`);
      setMantenimientos([]);
      setFilasReprogramadas(new Set());
    } finally {
      setIsLoading(false);
    }
  };

  const totalPages = Math.ceil(mantenimientos.length / ROWS_PER_PAGE);
  const startIndex = (currentPage - 1) * ROWS_PER_PAGE;
  const endIndex = startIndex + ROWS_PER_PAGE;
  const currentData = mantenimientos.slice(startIndex, endIndex);

  const goToPage = (page: number) => {
    setCurrentPage(Math.max(1, Math.min(page, totalPages)));
  };

  if (isLoading) {
    return (
      <div className="flex justify-center items-center h-64">
        <Loader2 className="w-8 h-8 animate-spin" />
      </div>
    );
  }

  return (
    <div className="bg-white rounded-lg shadow-lg p-6">
      <div className="flex justify-between items-center mb-6">
        <h2 className="text-2xl font-bold">Mantenimientos Preventivos Programados</h2>
        <button
          onClick={fetchMantenimientos}
          className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 transition-colors"
          disabled={isLoading}
        >
          Actualizar
        </button>
      </div>

      {filasReprogramadas.size > 0 && (
        <div className="mb-4 px-4 py-2 bg-amber-50 border border-amber-200 rounded text-sm text-amber-700">
          ⚠ {filasReprogramadas.size} registro{filasReprogramadas.size === 1 ? '' : 's'} programado{filasReprogramadas.size === 1 ? '' : 's'} originalmente en fin de semana — movido{filasReprogramadas.size === 1 ? '' : 's'} al siguiente día hábil (resaltado{filasReprogramadas.size === 1 ? '' : 's'} abajo).
        </div>
      )}

      {mantenimientos.length === 0 ? (
        <div className="text-center py-8 text-gray-500">
          No hay mantenimientos programados
        </div>
      ) : (
        <>
          <div className="overflow-x-auto border rounded-lg">
            <table className="w-full border-collapse">
              <thead>
                <tr className="bg-gray-100 border-b">
                  {/* Columna calculada, primera para que se vea sin desplazar la tabla: el tiempo
                      efectivo de la OT con su cadena de respaldo (ver calcularTiempoMantenimiento). */}
                  <th className="px-4 py-3 text-left text-sm font-semibold text-indigo-700 whitespace-nowrap bg-indigo-50">
                    TIEMPO
                  </th>
                  {columns.map((col) => (
                    <th
                      key={col}
                      className="px-4 py-3 text-left text-sm font-semibold text-gray-700 whitespace-nowrap"
                    >
                      {col}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {currentData.map((row, idx) => {
                  const indiceGlobal = startIndex + idx;
                  const fueReprogramado = filasReprogramadas.has(indiceGlobal);
                  const tiempo = calcularTiempoMantenimiento(row);
                  return (
                    <tr key={idx} className={`border-b transition-colors ${fueReprogramado ? 'bg-amber-50/70 hover:bg-amber-50' : 'hover:bg-gray-50'}`}>
                      <td
                        className="px-4 py-3 text-sm bg-indigo-50/40 whitespace-nowrap"
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
                          <span className={`ml-2 text-[9px] font-bold uppercase tracking-wide px-1.5 py-0.5 rounded ${tiempo.origen === 'calculado' ? 'bg-sky-100 text-sky-700' : 'bg-amber-100 text-amber-700'}`}>
                            {tiempo.origen === 'calculado' ? 'calculado' : 'estimado'}
                          </span>
                        )}
                      </td>
                      {columns.map((col) => (
                        <td
                          key={`${idx}-${col}`}
                          className="px-4 py-3 text-sm text-gray-700"
                        >
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

          {/* Pagination Controls */}
          {totalPages > 1 && (
            <div className="flex justify-between items-center mt-6">
              <div className="text-sm text-gray-600">
                Mostrando {startIndex + 1} a {Math.min(endIndex, mantenimientos.length)} de {mantenimientos.length} registros
              </div>

              <div className="flex gap-2 items-center">
                <button
                  onClick={() => goToPage(1)}
                  disabled={currentPage === 1}
                  className="px-3 py-2 border rounded disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-100"
                >
                  ← Primera
                </button>

                <button
                  onClick={() => goToPage(currentPage - 1)}
                  disabled={currentPage === 1}
                  className="px-3 py-2 border rounded disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-100"
                >
                  ← Anterior
                </button>

                <div className="flex items-center gap-2">
                  <span className="text-sm">Página</span>
                  <input
                    type="number"
                    min={1}
                    max={totalPages}
                    value={currentPage}
                    onChange={(e) => goToPage(parseInt(e.target.value) || 1)}
                    className="w-16 px-2 py-1 border rounded text-center"
                  />
                  <span className="text-sm">de {totalPages}</span>
                </div>

                <button
                  onClick={() => goToPage(currentPage + 1)}
                  disabled={currentPage === totalPages}
                  className="px-3 py-2 border rounded disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-100"
                >
                  Siguiente →
                </button>

                <button
                  onClick={() => goToPage(totalPages)}
                  disabled={currentPage === totalPages}
                  className="px-3 py-2 border rounded disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-100"
                >
                  Última →
                </button>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
};
