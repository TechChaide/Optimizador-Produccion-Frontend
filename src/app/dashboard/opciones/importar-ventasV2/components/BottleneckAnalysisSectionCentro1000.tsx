
'use client';

import React, { useState, useMemo, useCallback } from 'react';
import { exportToXLSX } from './utils';
import { TransferNeed, BottleneckAnalysisSectionCentro1000Props } from './types';
import { BottleneckSummaryTable, EMPTY_SUMMARY_ENRICHED } from './BottleneckSummaryTable';
import { BottleneckClassTable } from './BottleneckClassTable';
import { bottleneckAnalysisService } from '@/services/BottleneckAnalysisService';

export const BottleneckAnalysisSectionCentro1000: React.FC<BottleneckAnalysisSectionCentro1000Props> = ({ 
  data, 
  tiemposCanon, 
  numMaximoSabados, 
  maxExtrasHoras, 
  horasTrabajo, 
  horasExtrasFin, 
  trasladosDesdeCentro2000,
  onComputedDataReady
}) => {
  // Estado para capturar los datos calculados finales del motor de la tabla
  const [computedData, setComputedData] = useState<any[]>([]);

  // Usar el servicio centralizado para el filtrado inicial
  const analysis = useMemo(() => {
    if (data.length === 0) return null;
    return bottleneckAnalysisService.analyzeCenter1000(data, tiemposCanon, trasladosDesdeCentro2000);
  }, [data, tiemposCanon, trasladosDesdeCentro2000]);

  // Extraer datos del análisis
  const { 
    filteredData = [],
    exportSheet = []
  } = analysis || {};

  const handleComputedDataReady = useCallback(
    (results: any[]) => {
      setComputedData(results);
      onComputedDataReady?.(results);
    },
    [onComputedDataReady]
  );

  if (data.length === 0) {
    return <div className="p-4 text-center text-gray-600">Carga datos primero desde la pestaña "Datos del Backend"</div>;
  }

  if (filteredData.length === 0) {
    return <div className="p-4 text-center text-gray-600">No hay datos para el Centro 1000</div>;
  }

  return (
    <div>
      <div className="flex justify-end mb-4">
        <button
          onClick={() => exportToXLSX(exportSheet, 'Analisis_Centro1000')}
          className="inline-flex items-center px-4 py-2 text-sm font-medium text-white bg-teal-600 border border-teal-700 rounded-lg hover:bg-teal-700 transition-colors"
        >
          <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
          </svg>
          Descargar Excel (Todo Centro 1000)
        </button>
      </div>

      <BottleneckSummaryTable 
        datosEnriquecidosE={EMPTY_SUMMARY_ENRICHED}
        datosEnriquecidosX={EMPTY_SUMMARY_ENRICHED}
        datosCalculados={computedData} 
        tiemposCanon={tiemposCanon}
        numMaximoSabados={numMaximoSabados}
        maxExtrasHoras={maxExtrasHoras}
        horasTrabajo={horasTrabajo}
        horasExtrasFin={horasExtrasFin}
        centroLabel="Centro 1000"
        isCentro1000={true}
      />
      
      <BottleneckClassTable 
        datos={filteredData}
        datosCompletos={filteredData}
        titulo="Centro 1000 - Análisis de Cuello de Botella (Incluye Traslados Gye)"
        tiemposCanon={tiemposCanon}
        onComputedDataReady={handleComputedDataReady}
        maxExtrasHoras={maxExtrasHoras}
        horasExtrasFin={horasExtrasFin}
        trasladosDesdeCentro2000={trasladosDesdeCentro2000}
        isCentro1000={true}
      />
    </div>
  );
};
