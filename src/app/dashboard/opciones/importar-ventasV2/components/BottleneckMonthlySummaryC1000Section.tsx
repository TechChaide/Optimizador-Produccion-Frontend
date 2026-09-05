
'use client';

import React, { useState, useMemo, useCallback } from 'react';
import { TiempoCanonResult, ViableTransfer, TransferNeed } from './types';
import { BottleneckSummaryTable, EMPTY_SUMMARY_ENRICHED } from './BottleneckSummaryTable';
import { BottleneckClassTable } from './BottleneckClassTable';
import { safeNumber, normalizeMaterialCode } from './utils';

interface BottleneckMonthlySummaryC1000SectionProps {
  data: any[];
  tiemposCanon: TiempoCanonResult[];
  numMaximoSabados: number;
  maxExtrasHoras: number;
  horasTrabajo: number;
  horasExtrasFin: number;
  trasladosViables?: ViableTransfer[];
  trasladosDesdeCentro2000?: TransferNeed[];
  /** Filas calculadas del resumen (EXF) elevadas al padre para backlog regresivo y otros tabs. */
  onSummaryComputed?: (rows: any[]) => void;
}

const EMPTY_VIABLE_TRANSFERS: ViableTransfer[] = [];
const EMPTY_TRANSFER_NEEDS: TransferNeed[] = [];
const EMPTY_TIEMPO_CONSUMIDO: Record<string, number> = {};

export const BottleneckMonthlySummaryC1000Section: React.FC<BottleneckMonthlySummaryC1000SectionProps> = ({ 
  data, 
  tiemposCanon, 
  numMaximoSabados, 
  maxExtrasHoras, 
  horasTrabajo, 
  horasExtrasFin,
  trasladosViables = EMPTY_VIABLE_TRANSFERS,
  trasladosDesdeCentro2000 = EMPTY_TRANSFER_NEEDS,
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

  // Filtrar solo datos que involucren al Centro 1000 como fabricante
  const filteredDataCentro1000 = useMemo(() => {
    return data.filter(row => {
      const cFab = String(row.CentroFabricacion || '').trim();
      const cDem = String(row.Centro || '').trim();
      return cFab === '1000' || (cFab === '' && cDem === '1000');
    });
  }, [data]);

  // IMPORTANTE: Agrupar por material separando demanda C1000 de demanda C2000
  const dataEXF = useMemo(() => {
    const rawFiltered = filteredDataCentro1000.filter(row => {
      const clase = String(row.ClaseAprovisionam || '').trim().toUpperCase();
      return ['E', 'X', 'F'].includes(clase);
    });

    const porMaterial = new Map<string, any>();
    
    // Primero, procesar todas las filas que Quito fabrica
    rawFiltered.forEach(row => {
      const code = normalizeMaterialCode(row.CodMaterial ?? '');
      const mes = String(row.Mes ?? '');
      const cDem = String(row.Centro || '').trim();
      const key = `${code}|${mes}`;
      
      if (!porMaterial.has(key)) {
        porMaterial.set(key, { 
          ...row, 
          UnidadesProyectado: 0, 
          StockActual: 0, 
          StockSeguridad: 0, 
          _Necesidades: 0, 
          _necPropia: 0,
          Centro: '1000', 
          _isAggregated: true 
        });
      }
      const agg = porMaterial.get(key)!;
      
      // SOLO SUMAR SI LA DEMANDA ES DE QUITO (CENTRO 1000)
      if (cDem === '1000') {
        agg.UnidadesProyectado = safeNumber(agg.UnidadesProyectado) + safeNumber(row.UnidadesProyectado ?? 0);
        // CORRECCIÓN: Preservar el stock más alto encontrado en la agregación
        agg.StockActual = Math.max(safeNumber(agg.StockActual), safeNumber(row.StockActual)); 
        agg.StockSeguridad = Math.max(safeNumber(agg.StockSeguridad), safeNumber(row.StockSeguridad));
        
        let nec = 0;
        if (row._Necesidades !== undefined && row._Necesidades !== null) {
          nec = safeNumber(row._Necesidades);
        } else {
          const up = safeNumber(row.UnidadesProyectado ?? 0);
          const ss = safeNumber(row.StockSeguridad ?? 0);
          const sa = safeNumber(row.StockActual ?? 0);
          nec = Math.max(0, up - sa + ss);
        }
        
        agg._Necesidades = safeNumber(agg._Necesidades) + nec;
        agg._necPropia = safeNumber(agg._necPropia) + nec;
      }
    });

    // Segundo, asegurar que materiales que SOLO tienen traslados también aparezcan
    trasladosDesdeCentro2000.forEach(tr => {
      const code = normalizeMaterialCode(tr.CodMaterial);
      const mes = String(tr.mes);
      const key = `${code}|${mes}`;
      
      if (!porMaterial.has(key)) {
        const refRow = data.find(r => normalizeMaterialCode(r.CodMaterial) === code);
        if (refRow) {
          porMaterial.set(key, {
            ...refRow,
            Mes: mes,
            UnidadesProyectado: 0,
            StockActual: Math.max(0, safeNumber(refRow.StockActual)),
            StockSeguridad: Math.max(0, safeNumber(refRow.StockSeguridad)),
            _Necesidades: 0,
            _necPropia: 0,
            Centro: '1000',
            _isAggregated: true
          });
        }
      }
    });

    return Array.from(porMaterial.values());
  }, [filteredDataCentro1000, trasladosDesdeCentro2000, data]);

  if (data.length === 0) {
    return <div className="p-4 text-center text-gray-600">Carga datos primero desde la pestaña "Datos del Backend"</div>;
  }

  return (
    <div>
      <div className="bg-teal-50 border border-teal-200 rounded-lg p-4 mb-6">
        <div className="flex gap-3">
          <div className="flex-shrink-0">
            <svg className="w-6 h-6 text-teal-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          </div>
          <div>
            <h3 className="text-lg font-semibold text-teal-900">Resumen Mensual Unificado C1000</h3>
            <p className="text-sm text-teal-800 mt-1">
              Esta sección presenta una visión consolidada de todos los materiales demandados en el Centro 1000, 
              incluyendo las Clases E, X y F (que para Quito son fabricación propia).
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
        centroLabel="Centro 1000 (Quito)"
        isCentro1000={true}
        showSaldos={true}
      />
      
      <BottleneckClassTable 
        datos={dataEXF}
        datosCompletos={filteredDataCentro1000}
        titulo="Visión Unificada: Clases E + X + F (Quito)"
        tiemposCanon={tiemposCanon}
        tiempoConsumidoAnterior={EMPTY_TIEMPO_CONSUMIDO}
        onComputedDataReady={handleComputedDataReady}
        maxExtrasHoras={maxExtrasHoras}
        horasExtrasFin={horasExtrasFin}
        isCentro1000={true}
        showSaldos={true}
        trasladosViables={trasladosViables}
        trasladosDesdeCentro2000={trasladosDesdeCentro2000}
      />
    </div>
  );
};
