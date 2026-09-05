'use client';

import React from 'react';
import { TimesCanonSectionProps } from './types';

export const TimesCanonSection: React.FC<TimesCanonSectionProps> = ({ results, isLoading, numMaximoSabados = 0, maxExtrasHoras = 0, horasTrabajo = 8, horasExtrasFin = 0 }) => {
  if (isLoading) {
    return (
      <div className="flex items-center justify-center p-8">
        <div className="flex items-center gap-3 text-gray-500">
          <svg className="animate-spin h-5 w-5" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
          </svg>
          <span>Cargando tiempos canónicos por puesto de trabajo...</span>
        </div>
      </div>
    );
  }

  if (results.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center p-8 text-gray-500">
        <svg className="h-12 w-12 mb-3 text-gray-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
        </svg>
        <span>Haz clic en "Cargar Datos" para obtener los tiempos canónicos</span>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {results.map((result, idx) => (
        <div key={`${result.mesNumero}-${idx}`} className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden">
          <div className="px-6 py-4 border-b border-gray-200">
            <h4 className="text-lg font-semibold text-gray-800">{result.mes}</h4>
            <div className="grid grid-cols-4 gap-4 mt-3">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 flex items-center justify-center bg-blue-50 rounded-lg">
                  <svg className="w-4 h-4 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                  </svg>
                </div>
                <div>
                  <p className="text-xs text-gray-500">Días Laborables (L-V)</p>
                  <p className="text-lg font-semibold text-blue-600">{result.diasLaborables}</p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 flex items-center justify-center bg-purple-50 rounded-lg">
                  <svg className="w-4 h-4 text-purple-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                  </svg>
                </div>
                <div>
                  <p className="text-xs text-gray-500">Días Sábados</p>
                  <p className="text-lg font-semibold text-purple-600">{result.diasSabados}</p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 flex items-center justify-center bg-amber-50 rounded-lg">
                  <svg className="w-4 h-4 text-amber-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                </div>
                <div>
                  <p className="text-xs text-gray-500">Feriados descontados</p>
                  <p className="text-lg font-semibold text-amber-600">{result.diasFeriados?.length ?? 0}</p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 flex items-center justify-center bg-green-50 rounded-lg">
                  <svg className="w-4 h-4 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                  </svg>
                </div>
                <div>
                  <p className="text-xs text-gray-500">Semanas del Mes</p>
                  <p className="text-lg font-semibold text-green-600">{Math.ceil(((result.diasLaborables ?? 0) + (result.diasSabados ?? 0)) / 6)}</p>
                </div>
              </div>
            </div>
            {result.diasFeriados && result.diasFeriados.length > 0 && (
              <div className="mt-3 p-2 bg-amber-50 rounded-md">
                <span className="text-xs text-amber-700 font-medium">Feriados: </span>
                <span className="text-xs text-amber-600">{result.diasFeriados.join(', ')}</span>
              </div>
            )}
          </div>

          {result.error && (
            <div className="mx-6 my-4 p-3 bg-red-50 text-red-700 border border-red-200 rounded-md text-sm flex items-center gap-2">
              <svg className="w-5 h-5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              Error: {result.error}
            </div>
          )}

          {Array.isArray(result.data) && result.data.length > 0 ? (
            <>
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead className="sticky top-0 z-10 bg-gray-50">
                    <tr className="bg-gray-50 border-b border-gray-200">
                      {(() => {
                        const colMap: { [k: string]: string } = {
                          'minutos_horario_normal_TOTAL': '(Jornada normal [min])',
                          'minutos_horario_normal_CON_PUESTOS': '(Jornada Normal * Número de puestos [min])',
                          'horas_horario_normal_TOTAL': '(Jornada normal [h])',
                          'horas_horario_normal_CON_PUESTOS': '(Jornada normal puestos [h])',
                          'minutos_extras_TOTAL': '(Jornada normal + 2h extras [min])',
                          'minutos_extras_CON_PUESTOS': '(Jornada normal * puestos + 2h extras [min])',
                          'horas_extras_TOTAL': '(Jornada normal + 2h extras [h])',
                          'horas_extras_CON_PUESTOS': '(Jornada normal puestos + 2h extras [h])',
                          'minutos_sabado_TOTAL': '(Jornada sabados extras [min])',
                          'minutos_sabado_CON_PUESTOS': '(Jornada sabados puestos [min])',
                          'horas_sabado_TOTAL': '(Jornada sabados [h])',
                          'horas_sabado_CON_PUESTOS': '(Jornada sabados puestos [h])'
                        };
                        return Object.keys(result.data[0] || {}).map(col => (
                          <th key={col} className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider whitespace-nowrap">
                            {colMap[col] ?? col}
                          </th>
                        ));
                      })()}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {result.data.map((row: any, rowIdx: number) => (
                      <tr key={rowIdx} className="hover:bg-gray-50 transition-colors">
                        {Object.keys(row).map(col => (
                          <td key={`${rowIdx}-${col}`} className="px-4 py-2.5 text-sm text-gray-700">
                            {typeof row[col] === 'number' 
                              ? <span className="font-mono">{row[col].toLocaleString(undefined, { maximumFractionDigits: 3 })}</span>
                              : String(row[col] ?? '')}
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              <div className="mt-4 px-4">
                <h5 className="text-sm font-semibold text-gray-700 mb-2">Configuraciones - {result.mes}</h5>
                <div className="overflow-x-auto bg-white rounded-lg border border-gray-200">
                  <table className="w-full text-sm">
                    <tbody>
                      <tr className="border-b">
                        <td className="px-4 py-2 font-medium text-gray-600">Días laborables (L-V)</td>
                        <td className="px-4 py-2 text-right font-mono text-gray-800">{result.diasLaborables}</td>
                      </tr>
                      <tr className="border-b bg-gray-50">
                        <td className="px-4 py-2 font-medium text-gray-600">Días sábados</td>
                        <td className="px-4 py-2 text-right font-mono text-gray-800">{result.diasSabados}</td>
                      </tr>
                      <tr className="border-b">
                        <td className="px-4 py-2 font-medium text-gray-600">Feriados (count)</td>
                        <td className="px-4 py-2 text-right font-mono text-gray-800">{result.diasFeriados?.length ?? 0}</td>
                      </tr>
                      <tr className="border-b bg-gray-50">
                        <td className="px-4 py-2 font-medium text-gray-600">Feriados (lista)</td>
                        <td className="px-4 py-2 text-right text-xs text-gray-700">{(result.diasFeriados || []).join(', ') || '-'}</td>
                      </tr>
                      <tr className="border-b">
                        <td className="px-4 py-2 font-medium text-gray-600">Semanas del mes</td>
                        <td className="px-4 py-2 text-right font-mono text-gray-800">{Math.ceil(((result.diasLaborables ?? 0) + (result.diasSabados ?? 0)) / 6)}</td>
                      </tr>
                      <tr className="border-b bg-gray-50">
                        <td className="px-4 py-2 font-medium text-gray-600">Horas de trabajo (diarias)</td>
                        <td className="px-4 py-2 text-right font-mono text-gray-800">{horasTrabajo} h</td>
                      </tr>
                      <tr className="border-b">
                        <td className="px-4 py-2 font-medium text-gray-600">Máximo sábados permitidos</td>
                        <td className="px-4 py-2 text-right font-mono text-gray-800">{numMaximoSabados}</td>
                      </tr>
                      <tr className="border-b bg-gray-50">
                        <td className="px-4 py-2 font-medium text-gray-600">Máximo horas extras</td>
                        <td className="px-4 py-2 text-right font-mono text-gray-800">{maxExtrasHoras} h</td>
                      </tr>
                      <tr>
                        <td className="px-4 py-2 font-medium text-gray-600">Horas extras fin de semana</td>
                        <td className="px-4 py-2 text-right font-mono text-gray-800">{horasExtrasFin} h</td>
                      </tr>
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Tabla de Horas Extras por Semana */}
              <div className="mt-6 px-4">
                <h5 className="text-sm font-semibold text-gray-700 mb-2">Horas Extras por Semana - {result.mes}</h5>
                <div className="overflow-x-auto bg-white rounded-lg border border-gray-200">
                  <table className="w-full text-sm">
                    <thead className="bg-gray-50 border-b border-gray-200">
                      <tr>
                        <th className="px-4 py-2 text-left font-semibold text-gray-600">Descripción</th>
                        <th className="px-4 py-2 text-center font-semibold text-gray-600">Días L-V</th>
                        <th className="px-4 py-2 text-right font-semibold text-gray-600">Total Horas</th>
                      </tr>
                    </thead>
                    <tbody>
                      {(() => {
                        const diasLaborablesTotal = result.diasLaborables ?? 0;
                        const diasSabadosTotal = result.diasSabados ?? 0;
                        
                        // Calcular número de semanas basado en semanas normales (L-V son máx 5 por semana)
                        const semanasNormales = Math.floor(diasLaborablesTotal / 5);
                        const diasLaborablesExtra = diasLaborablesTotal % 5;
                        
                        const filas = [];
                        
                        // Filas de semanas normales (solo L-V, sin sábados)
                        for (let i = 0; i < semanasNormales; i++) {
                          const horasExtrasLV = 5 * (maxExtrasHoras ?? 0);
                          
                          filas.push({
                            type: 'semana',
                            numero: i + 1,
                            diasLV: 5,
                            horasExtrasLV,
                            totalHoras: horasExtrasLV
                          });
                        }
                        
                        // Fila de L-V extra si hay
                        if (diasLaborablesExtra > 0) {
                          const horasExtrasLV = diasLaborablesExtra * (maxExtrasHoras ?? 0);
                          filas.push({
                            type: 'extras-lv',
                            label: 'Días L-V Extra',
                            diasLV: diasLaborablesExtra,
                            horasExtrasLV,
                            totalHoras: horasExtrasLV
                          });
                        }
                        
                        // Filas de Sábados (una por cada sábado)
                        for (let i = 0; i < diasSabadosTotal; i++) {
                          filas.push({
                            type: 'sabado',
                            label: `Sábado ${i + 1}`,
                            diasLV: 0,
                            horasExtrasLV: 0,
                            totalHoras: horasExtrasFin ?? 0
                          });
                        }
                        
                        const totalHorasSum = filas.reduce((acc, fila) => acc + fila.totalHoras, 0);
                        
                        return (
                          <>
                            {filas.map((fila, idx) => (
                              <tr key={idx} className={fila.type === 'sabado' ? 'bg-yellow-50 border-b border-yellow-200' : (idx % 2 === 0 ? 'bg-white' : 'bg-gray-50')}>
                                <td className="px-4 py-2 font-medium text-gray-700">
                                  {fila.type === 'semana' ? `Semana ${fila.numero}` : fila.label}
                                </td>
                                <td className="px-4 py-2 text-center font-mono text-gray-800">{fila.diasLV}</td>
                                <td className="px-4 py-2 text-right font-mono font-semibold text-blue-600">{fila.totalHoras} h</td>
                              </tr>
                            ))}
                            <tr className="bg-gray-100 border-t-2 border-gray-300">
                              <td className="px-4 py-2 font-bold text-gray-800">Total</td>
                              <td className="px-4 py-2"></td>
                              <td className="px-4 py-2 text-right font-mono font-bold text-green-600">{totalHorasSum} h</td>
                            </tr>
                          </>
                        );
                      })()}
                    </tbody>
                  </table>
                </div>
              </div>
            </>
          ) : (
            !result.error && (
              <div className="p-8 text-center text-gray-500">
                <svg className="h-12 w-12 mx-auto mb-3 text-gray-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M20 13V6a2 2 0 00-2-2H6a2 2 0 00-2 2v7m16 0v5a2 2 0 01-2 2H6a2 2 0 01-2-2v-5m16 0h-2.586a1 1 0 00-.707.293l-2.414 2.414a1 1 0 01-.707.293h-3.172a1 1 0 01-.707-.293l-2.414-2.414A1 1 0 006.586 13H4" />
                </svg>
                <span className="text-sm">Sin datos disponibles</span>
              </div>
            )
          )}
        </div>
      ))}
    </div>
  );
};
