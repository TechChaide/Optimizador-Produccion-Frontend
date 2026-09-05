'use client';

import React, { useState, useMemo, useCallback } from 'react';
import { TiempoCanonResult, ViableTransfer } from './types';
import { BottleneckSummaryTable, EMPTY_SUMMARY_ENRICHED } from './BottleneckSummaryTable';
import { BottleneckClassTable } from './BottleneckClassTable';

interface BottleneckMonthlySummaryC2000SectionProps {
  data: any[];
  tiemposCanon: TiempoCanonResult[];
  numMaximoSabados: number;
  maxExtrasHoras: number;
  horasTrabajo: number;
  horasExtrasFin: number;
  trasladosViables?: ViableTransfer[];
  onSummaryComputed?: (rows: any[]) => void;
}

const EMPTY_VIABLE_TRANSFERS: ViableTransfer[] = [];
const EMPTY_TIEMPO_CONSUMIDO: Record<string, number> = {};

export const BottleneckMonthlySummaryC2000Section: React.FC<BottleneckMonthlySummaryC2000SectionProps> = ({ 
  data, 
  tiemposCanon, 
  numMaximoSabados, 
  maxExtrasHoras, 
  horasTrabajo, 
  horasExtrasFin,
  trasladosViables = EMPTY_VIABLE_TRANSFERS,
  onSummaryComputed
}) => {
  const [computedDataEXF, setComputedDataEXF] = useState<any[]>([]);

  const handleComputedDataReady = useCallback(
    (rows: any[]) => {
      setComputedDataEXF(rows);
      onSummaryComputed?.(rows);
    },
    [onSummaryComputed]
  );

  const filteredDataCentro2000 = useMemo(() => {
    return data.filter(row => 
      String(row.Centro || '').trim() === '2000'
    );
  }, [data]);

  const dataEXF = useMemo(() => {
    return filteredDataCentro2000.filter(row => {
      const clase = String(row.ClaseAprovisionam || '').trim().toUpperCase();
      return ['E', 'X', 'F'].includes(clase);
    });
  }, [filteredDataCentro2000]);

  if (data.length === 0) {
    return <div className="p-4 text-center text-gray-600">Carga datos primero desde la pestaña "Datos del Backend"</div>;
  }

  return (
    <div>
      <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-6">
        <div className="flex gap-3">
          <div className="flex-shrink-0">
            <svg className="w-6 h-6 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          </div>
          <div>
            <h3 className="text-lg font-semibold text-blue-900">Resumen Mensual Unificado C2000</h3>
            <p className="text-sm text-blue-800 mt-1">
              Esta sección presenta una visión consolidada de todos los materiales demandados en el Centro 2000, 
              incluyendo las Clases E (In-house), X (Flexible) y F (Fabricación Centralizada en Quito).
            </p>
          </div>
        </div>
      </div>

      <BottleneckSummaryTable 
        datosEnriquecidosE={EMPTY_SUMMARY_ENRICHED}
        datosEnriquecidosX={EMPTY_SUMMARY_ENRICHED}
        datosCalculados={computedDataEXF}
        tiemposCanon={tiemposCanon}
        numMaximoSabados={numMaximoSabados}
        maxExtrasHoras={maxExtrasHoras}
        horasTrabajo={horasTrabajo}
        horasExtrasFin={horasExtrasFin}
        centroLabel="Centro 2000 (E+X+F)"
        showSaldos={true}
      />
      
      <BottleneckClassTable 
        datos={dataEXF}
        datosCompletos={filteredDataCentro2000}
        titulo="Visión Unificada: Clases E + X + F"
        tiemposCanon={tiemposCanon}
        tiempoConsumidoAnterior={EMPTY_TIEMPO_CONSUMIDO}
        onComputedDataReady={handleComputedDataReady}
        maxExtrasHoras={maxExtrasHoras}
        horasExtrasFin={horasExtrasFin}
        isCentro1000={false}
        trasladosViables={trasladosViables}
        showSaldos={true}
      />
    </div>
  );
};
