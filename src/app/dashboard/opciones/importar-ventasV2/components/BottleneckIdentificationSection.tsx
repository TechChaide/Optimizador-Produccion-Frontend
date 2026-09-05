'use client';

import React, { useMemo, useEffect } from 'react';
import { MONTH_NAMES } from './constants';
import { safeNumber } from './utils';
import { TiempoCanonResult } from './types';

interface BottleneckIdentificationSectionProps {
  data: any[];
  tiemposCanon: TiempoCanonResult[];
}

interface LineBottleneck {
  mes: string;
  linea: string;
  puestoCuellodeBottella: string;
  frecuencia: number;
  tiempoTotalAcumulado: number;
  minutos_horario_normal: number;
  minutos_con_extras: number;
  minutos_fin_semana: number;
  materialesAsociados: number;
  detalles: {
    material: string;
    puesto: string;
    necesidad: number;
    tiempoTotal: number;
  }[];
  todasLosDetalles: {
    puesto: string;
    frecuencia: number;
    tiempoTotalAcumulado: number;
  }[];
}

export const BottleneckIdentificationSection: React.FC<BottleneckIdentificationSectionProps> = ({
  data,
  tiemposCanon
}) => {
  const computeNec = (row: any) => {
    const up = safeNumber(row.UnidadesProyectado ?? 0);
    const ss = safeNumber(row.StockSeguridad ?? 0);
    const sa = safeNumber(row.StockActual ?? 0);
    return Math.max(0, up - sa + ss);
  };

  const buscarTiempoCanon = (mesRaw: string) => {
    let found = tiemposCanon.find((t: any) => t.mes === mesRaw);
    if (found) return found;
    const mesNum = parseInt(mesRaw);
    if (!isNaN(mesNum) && mesNum >= 1 && mesNum <= 12) {
      const mesNombre = MONTH_NAMES[mesNum];
      found = tiemposCanon.find((t: any) => t.mes === mesNombre);
      if (found) return found;
      found = tiemposCanon.find((t: any) => t.mesNumero === mesNum);
    }
    return found || null;
  };

  const obtenerDatosPuesto = (mes: string, puesto: string | null) => {
    const tc = buscarTiempoCanon(mes);
    if (!tc || !tc.data || !Array.isArray(tc.data)) return null;

    if (!puesto || puesto === '-' || puesto === '') return null;

    const pn = String(puesto).toLowerCase().trim();
    const dp = tc.data.find((item: any) => {
      const nombreEstacion = String(item?.nombre_estacion ?? '').toLowerCase().trim();
      return nombreEstacion.includes(pn) || pn.includes(nombreEstacion);
    });

    if (!dp) return null;

    return {
      minutos_horario_normal: safeNumber(dp?.minutos_horario_normal_CON_PUESTOS ?? dp?.minutos_horario_normal_TOTAL ?? 0),
      minutos_con_extras: safeNumber(dp?.minutos_extras_CON_PUESTOS ?? dp?.minutos_extras_TOTAL ?? 0),
      minutos_fin_semana: safeNumber(dp?.minutos_sabado_CON_PUESTOS ?? dp?.minutos_sabado_TOTAL ?? 0),
      nombre_estacion: dp?.nombre_estacion
    };
  };

  // Análisis de cuellos de botella
  const bottleneckAnalysis = useMemo(() => {
    const map = new Map<string, Map<string, any[]>>();

    // Agrupar por mes y línea
    data.forEach(row => {
      const mes = String(row.Mes ?? 'Sin mes');
      const linea = String(row.LineaFabricacion ?? 'Sin línea');
      const puesto = String(row.PuestoCuellodeBottella ?? row.PuestoTrabajo ?? '-');
      const key = `${mes}|${linea}`;

      if (!map.has(key)) {
        map.set(key, new Map());
      }

      const puestosMap = map.get(key)!;
      if (!puestosMap.has(puesto)) {
        puestosMap.set(puesto, []);
      }

      puestosMap.get(puesto)!.push(row);
    });

    // Identificar puesto de botella para cada mes/línea
    const results: LineBottleneck[] = [];

    map.forEach((puestosMap, key) => {
      const [mes, linea] = key.split('|');

      // NUEVA LÓGICA: El cuello de botella es el puesto con MAYOR TIEMPO_TOTAL acumulado
      // NO solo la frecuencia de repeticiones
      let maxTiempoTotal = 0;
      let puestoBottella = '-';
      let detallesPuesto: any[] = [];
      const detallesPuestos: any[] = [];

      puestosMap.forEach((materiales, puesto) => {
        // Sumar Tiempo_Total para este puesto
        const tiempoTotalAcumulado = materiales.reduce((sum, row) => {
          return sum + safeNumber(row.Tiempo_Total ?? 0);
        }, 0);

        const frecuencia = materiales.length;

        detallesPuestos.push({
          puesto,
          frecuencia,
          tiempoTotalAcumulado
        });

        // El puesto con mayor Tiempo_Total es el cuello de botella
        if (tiempoTotalAcumulado > maxTiempoTotal) {
          maxTiempoTotal = tiempoTotalAcumulado;
          puestoBottella = puesto;
          detallesPuesto = materiales;
        }
      });

      // Obtener datos del puesto de botella
      const datosPuesto = obtenerDatosPuesto(mes, puestoBottella);

      if (datosPuesto) {
        console.log(`[BOTTLENECK IDENTIFICADO] Mes: ${mes}, Línea: ${linea}`, {
          puestoBottella,
          tiempoTotalAcumulado: maxTiempoTotal,
          numeroMateriales: detallesPuesto.length,
          detallesPuestos: detallesPuestos.sort((a, b) => b.tiempoTotalAcumulado - a.tiempoTotalAcumulado)
        });

        results.push({
          mes,
          linea,
          puestoCuellodeBottella: puestoBottella,
          frecuencia: detallesPuesto.length,
          tiempoTotalAcumulado: maxTiempoTotal,
          minutos_horario_normal: datosPuesto.minutos_horario_normal,
          minutos_con_extras: datosPuesto.minutos_con_extras,
          minutos_fin_semana: datosPuesto.minutos_fin_semana,
          materialesAsociados: detallesPuesto.length,
          detalles: detallesPuesto.map(row => ({
            material: row.CodMaterial,
            puesto: String(row.PuestoCuellodeBottella ?? row.PuestoTrabajo ?? '-'),
            necesidad: computeNec(row),
            tiempoTotal: safeNumber(row.Tiempo_Total ?? 0)
          })),
          todasLosDetalles: detallesPuestos.sort((a, b) => b.tiempoTotalAcumulado - a.tiempoTotalAcumulado)
        });
      }
    });

    return results.sort((a, b) => {
      const mesA = a.mes.localeCompare(b.mes);
      return mesA !== 0 ? mesA : a.linea.localeCompare(b.linea);
    });
  }, [data, tiemposCanon]);

  // TABLA AGRUPADA: Centro|Línea|Puesto → Suma Tiempo_Total
  const tablaAgrupada = useMemo(() => {
    const agregado = new Map<string, number>();
    
    data.forEach(row => {
      const necesidad = computeNec(row);
      if (necesidad === 0) return;
      
      const tiempoPorUnidad = safeNumber(row.TiempoPorUnidad ?? 0);
      const numeroPuestos = safeNumber(row.NumeroPuestos ?? row.numero_puestos ?? 1);
      const tiempoUnitarioPorPuesto = numeroPuestos > 0 ? tiempoPorUnidad / numeroPuestos : 0;
      const tiempoTotalMaterial = tiempoUnitarioPorPuesto * necesidad;
      
      const centro = String(row.Centro ?? '');
      const linea = String(row.LineaFabricacion ?? '');
      
      // Intentar extraer puesto de múltiples campos posibles
      let puesto = String(row.PuestoCuellodeBottella ?? row.PuestoTrabajo ?? row.nombre_estacion ?? '');
      
      // Si incluso así no encuentra puesto, intentar obtenerlo del Tiempo_Total (puede contener info del puesto)
      if (!puesto && row.Tiempo_Total) {
        // Buscar en tiemposCanon el puesto que coincida
        const tc = buscarTiempoCanon(String(row.Mes ?? 'Sin mes'));
        if (tc && tc.data && Array.isArray(tc.data)) {
          // Intentar encontrar algún puesto que tenga Tiempo_Total similar
          for (const item of tc.data) {
            const nombreEstacion = String(item?.nombre_estacion ?? '').toLowerCase().trim();
            if (nombreEstacion) {
              puesto = String(item?.nombre_estacion ?? '');
              break;
            }
          }
        }
      }
      
      if (!puesto) {
        puesto = '-';
      }
      
      const key = `${centro}|${linea}|${puesto}`;
      
      const tiempoActual = agregado.get(key) || 0;
      agregado.set(key, tiempoActual + tiempoTotalMaterial);
    });

    const resultados: {centro: string; linea: string; puesto: string; sumaTotal: number}[] = [];
    agregado.forEach((suma, key) => {
      const [centro, linea, puesto] = key.split('|');
      resultados.push({ centro, linea, puesto, sumaTotal: suma });
    });

    return resultados.sort((a, b) => {
      const cmp1 = a.centro.localeCompare(b.centro);
      if (cmp1 !== 0) return cmp1;
      const cmp2 = a.linea.localeCompare(b.linea);
      if (cmp2 !== 0) return cmp2;
      return b.sumaTotal - a.sumaTotal;  // DESC: mayor tiempo primero
    });
  }, [data, tiemposCanon]);

  // Resumen: Cuello de botella por Centro|Línea
  const resumenCuellosDeBottella = useMemo(() => {
    const mapa = new Map<string, {centro: string; linea: string; puestoBotella: string; tiempoMaximo: number}>();
    
    tablaAgrupada.forEach(row => {
      const key = `${row.centro}|${row.linea}`;
      const actual = mapa.get(key);
      
      if (!actual || row.sumaTotal > actual.tiempoMaximo) {
        mapa.set(key, {
          centro: row.centro,
          linea: row.linea,
          puestoBotella: row.puesto,
          tiempoMaximo: row.sumaTotal
        });
      }
    });
    
    return Array.from(mapa.values()).sort((a, b) => {
      const cmp = a.centro.localeCompare(b.centro);
      return cmp !== 0 ? cmp : a.linea.localeCompare(b.linea);
    });
  }, [tablaAgrupada]);

  // Guardar resamenCuellosDeBottella en localStorage para que otros componentes lo consulten
  useEffect(() => {
    if (typeof window !== 'undefined' && data.length > 0) {
      // Calcular cuellos de botella por Mes|Línea (no por Centro|Línea) para consistencia
      const tablaTiempos = new Map<string, number>();
      const mesLineaPuesto = new Map<string, string>(); // Mes|Línea -> Puesto
      
      const computeNecLocal = (row: any) => {
        const up = safeNumber(row.UnidadesProyectado ?? 0);
        const ss = safeNumber(row.StockSeguridad ?? 0);
        const sa = safeNumber(row.StockActual ?? 0);
        return Math.max(0, up - sa + ss);
      };
      
      data.forEach(row => {
        const necesidad = computeNecLocal(row);
        if (necesidad === 0) return;
        
        const tiempoPorUnidad = safeNumber(row.TiempoPorUnidad ?? 0);
        const numeroPuestos = safeNumber(row.NumeroPuestos ?? row.numero_puestos ?? 1);
        const tiempoUnitarioPorPuesto = numeroPuestos > 0 ? tiempoPorUnidad / numeroPuestos : 0;
        const tiempoTotalMaterial = tiempoUnitarioPorPuesto * necesidad;
        
        const mes = String(row.Mes ?? 'Sin mes');
        const linea = String(row.LineaFabricacion ?? 'Sin línea');
        const puesto = String(row.PuestoCuellodeBottella || row.PuestoTrabajo || '');
        
        if (!puesto) return;
        
        const key = `${mes}|${linea}|${puesto}`;
        const tiempoActual = tablaTiempos.get(key) || 0;
        tablaTiempos.set(key, tiempoActual + tiempoTotalMaterial);
      });
      
      // Identificar cuello de botella por Mes|Línea
      tablaTiempos.forEach((tiempo, key) => {
        const [mes, linea, puesto] = key.split('|');
        const lineaKey = `${mes}|${linea}`;
        
        const actualPuesto = mesLineaPuesto.get(lineaKey);
        let actualTiempo = 0;
        if (actualPuesto) {
          const actualKey = `${mes}|${linea}|${actualPuesto}`;
          actualTiempo = tablaTiempos.get(actualKey) || 0;
        }
        
        if (tiempo > actualTiempo) {
          mesLineaPuesto.set(lineaKey, puesto);
        }
      });
      
      // Guardar en localStorage
      const dataToStore = Array.from(mesLineaPuesto.entries()).map(([key, puesto]) => {
        const [mes, linea] = key.split('|');
        return { mes, linea, puestoBotella: puesto };
      });
      
      localStorage.setItem('bottleneckIdentificationMesLinea', JSON.stringify(dataToStore));
      console.log('[BottleneckIdentificationSection] Guardado en localStorage:', dataToStore.length, 'cuellos de botella por Mes|Línea');
    }
  }, [data]);

  if (data.length === 0) {
    return <div className="p-4 text-center text-gray-600">Carga datos primero desde la pestaña &quot;Datos del Backend&quot;</div>;
  }

  return (
    <div className="space-y-8">
      {/* TABLA 1: Agrupada por Centro|Línea|Puesto */}
      <div>
        <h2 className="text-lg font-bold text-gray-900 mb-4">Tabla Agrupada: Centro | Línea | Puesto | Suma Tiempo_Total</h2>
        <div className="overflow-x-auto bg-white rounded-lg shadow">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-indigo-50">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-semibold text-indigo-900 uppercase">Centro</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-indigo-900 uppercase">Línea</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-indigo-900 uppercase">Puesto Trabajo</th>
                <th className="px-4 py-3 text-right text-xs font-semibold text-indigo-900 uppercase">Suma Tiempo Total (min)</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {tablaAgrupada.map((row, idx) => (
                <tr key={idx} className="hover:bg-indigo-50">
                  <td className="px-4 py-3 text-sm text-gray-700 font-medium">{row.centro || '-'}</td>
                  <td className="px-4 py-3 text-sm text-gray-700 font-medium">{row.linea}</td>
                  <td className="px-4 py-3 text-sm text-gray-700">{row.puesto}</td>
                  <td className="px-4 py-3 text-sm text-right font-mono font-semibold text-indigo-600">
                    {row.sumaTotal.toLocaleString(undefined, { maximumFractionDigits: 2 })}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {tablaAgrupada.length === 0 && (
          <div className="text-center py-8 text-gray-600">
            No hay datos para mostrar la tabla agrupada
          </div>
        )}
      </div>

      {/* RESUMEN: Cuello de botella por Centro|Línea */}
      <div>
        <h2 className="text-lg font-bold text-gray-900 mb-4">Resumen: Cuello de Botella Identificado por Centro y Línea</h2>
        <div className="bg-green-50 border border-green-200 rounded-lg p-4 mb-4">
          <div className="flex gap-3">
            <div className="flex-shrink-0">
              <svg className="w-5 h-5 text-green-600" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
              </svg>
            </div>
            <div>
              <h3 className="font-semibold text-green-900">Definición de Cuello de Botella</h3>
              <p className="text-sm text-green-800 mt-1">
                El cuello de botella por Centro|Línea es el puesto de trabajo que consume la mayor cantidad de tiempo acumulado (Σ Tiempo_Total). Este puesto es el que limita la capacidad de producción.
              </p>
            </div>
          </div>
        </div>

        <div className="overflow-x-auto bg-white rounded-lg shadow">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-green-50">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-semibold text-green-900 uppercase">Centro</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-green-900 uppercase">Línea</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-red-700 uppercase">Puesto Cuello de Botella</th>
                <th className="px-4 py-3 text-right text-xs font-semibold text-green-900 uppercase">Tiempo Máximo (min)</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {resumenCuellosDeBottella.map((item, idx) => (
                <tr key={idx} className="hover:bg-green-50">
                  <td className="px-4 py-3 text-sm font-medium text-gray-900">{item.centro || '-'}</td>
                  <td className="px-4 py-3 text-sm font-medium text-gray-900">{item.linea}</td>
                  <td className="px-4 py-3 text-sm">
                    <span className="inline-block bg-red-100 text-red-800 px-3 py-1 rounded font-semibold">
                      {item.puestoBotella}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-sm text-right font-mono font-semibold text-green-600">
                    {item.tiempoMaximo.toLocaleString(undefined, { maximumFractionDigits: 2 })}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {resumenCuellosDeBottella.length === 0 && (
          <div className="text-center py-8 text-gray-600">
            No hay datos para mostrar el resumen de cuellos de botella
          </div>
        )}
      </div>

      {/* TABLA 2: Análisis de cuellos de botella */}
      <div>
        <h2 className="text-lg font-bold text-gray-900 mb-4">Identificación de Cuellos de Botella</h2>
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-4">
          <div className="flex gap-3">
            <div className="flex-shrink-0">
              <svg className="w-5 h-5 text-blue-600" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M18 5v8a2 2 0 01-2 2h-5l-5 4v-4H4a2 2 0 01-2-2V5a2 2 0 012-2h12a2 2 0 012 2zm-11-1a1 1 0 11-2 0 1 1 0 012 0zM8 9a1 1 0 100-2 1 1 0 000 2zm5-1a1 1 0 11-2 0 1 1 0 012 0z" clipRule="evenodd" />
              </svg>
            </div>
            <div>
              <h3 className="font-semibold text-blue-900">Identificación de Cuellos de Botella</h3>
              <p className="text-sm text-blue-800 mt-1">
                Este análisis identifica el puesto de trabajo crítico (cuello de botella) para cada línea y mes. 
                Se usa el tiempo del puesto que más frecuencia tiene, NO la suma de todos los puestos.
              </p>
            </div>
          </div>
        </div>

        <div className="overflow-x-auto bg-white rounded-lg shadow">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-700 uppercase">Mes</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-700 uppercase">Línea</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-red-700 uppercase">Puesto Botella</th>
                <th className="px-4 py-3 text-right text-xs font-semibold text-gray-700 uppercase">Frecuencia</th>
                <th className="px-4 py-3 text-right text-xs font-semibold text-indigo-700 uppercase">Min. Horario Normal</th>
                <th className="px-4 py-3 text-right text-xs font-semibold text-amber-700 uppercase">Min. Extras</th>
                <th className="px-4 py-3 text-right text-xs font-semibold text-orange-700 uppercase">Min. Fin Semana</th>
                <th className="px-4 py-3 text-right text-xs font-semibold text-gray-700 uppercase">Materiales</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {bottleneckAnalysis.map((item, idx) => (
                <React.Fragment key={`${item.mes}|${item.linea}|${idx}`}>
                  <tr className="hover:bg-gray-50">
                    <td className="px-4 py-3 text-sm text-gray-700 font-medium">{item.mes}</td>
                    <td className="px-4 py-3 text-sm text-gray-700 font-medium">{item.linea}</td>
                    <td className="px-4 py-3 text-sm">
                      <span className="inline-block bg-red-100 text-red-800 px-2.5 py-1 rounded font-semibold">
                        {item.puestoCuellodeBottella}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-sm text-right text-gray-700">{item.frecuencia}</td>
                    <td className="px-4 py-3 text-sm text-right font-mono text-indigo-600 font-semibold">
                      {item.minutos_horario_normal.toLocaleString()}
                    </td>
                    <td className="px-4 py-3 text-sm text-right font-mono text-amber-600 font-semibold">
                      {item.minutos_con_extras.toLocaleString()}
                    </td>
                    <td className="px-4 py-3 text-sm text-right font-mono text-orange-600 font-semibold">
                      {item.minutos_fin_semana.toLocaleString()}
                    </td>
                    <td className="px-4 py-3 text-sm text-right text-gray-700">{item.materialesAsociados}</td>
                  </tr>
                  {/* Detalles de materiales */}
                  {item.detalles.length > 0 && (
                    <tr className="bg-gray-50">
                      <td colSpan={8} className="px-4 py-2">
                        <div className="text-xs font-semibold text-gray-600 mb-2">Materiales asociados ({item.detalles.length}):</div>
                        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-2">
                          {item.detalles.map((detalle, didx) => (
                            <div key={didx} className="bg-white p-2 rounded border border-gray-200 text-xs">
                              <div className="font-mono text-gray-700">{detalle.material}</div>
                              <div className="text-gray-600">Puesto: {detalle.puesto}</div>
                              <div className="text-gray-600">Nec: {detalle.necesidad.toLocaleString()}</div>
                            </div>
                          ))}
                        </div>
                      </td>
                    </tr>
                  )}
                </React.Fragment>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {bottleneckAnalysis.length > 0 && (
        <div className="bg-green-50 border border-green-200 rounded-lg p-4">
          <h3 className="font-semibold text-green-900 mb-2">Resumen</h3>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm text-green-800">
            <div>
              <span className="font-semibold">Combinaciones Mes/Línea:</span> {bottleneckAnalysis.length}
            </div>
            <div>
              <span className="font-semibold">Total de Materiales:</span> {data.length}
            </div>
            <div>
              <span className="font-semibold">Tiempo Máx Base:</span> {Math.max(...bottleneckAnalysis.map(b => b.minutos_horario_normal)).toLocaleString()} min
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
