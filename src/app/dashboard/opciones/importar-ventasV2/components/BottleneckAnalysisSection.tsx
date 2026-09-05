
'use client';

import React, { useState, useEffect, useMemo, useRef } from 'react';
import { safeNumber, normalizeMaterialCode } from './utils';
import { TiempoCanonResult, TransferNeed, ViableTransfer, BottleneckAnalysisSectionProps } from './types';
import { BottleneckSummaryTable, EMPTY_SUMMARY_ENRICHED } from './BottleneckSummaryTable';
import { BottleneckClassTable } from './BottleneckClassTable';
import { bottleneckAnalysisService } from '@/services/BottleneckAnalysisService';
import { MONTH_NAMES } from './constants';

export const BottleneckAnalysisSection: React.FC<BottleneckAnalysisSectionProps> = ({ 
  data, 
  tiemposCanon, 
  numMaximoSabados, 
  maxExtrasHoras, 
  horasTrabajo, 
  horasExtrasFin, 
  onTransferNeedsConsolidatedChanged,
  onComputedDataReady,
  trasladosViables = []
}) => {
  const [transferNeedsEX, setTransferNeedsEX] = useState<TransferNeed[]>([]);
  const [computedDataEX, setComputedDataEX] = useState<any[]>([]);
  const [filtroSectorF, setFiltroSectorF] = useState('');
  const [filtroMaterialF, setFiltroMaterialF] = useState('');
  const [filtroMesF, setFiltroMesF] = useState('');
  const lastTransferSignatureRef = useRef('');
  const lastComputedSignatureRef = useRef('');

  // Usar el servicio centralizado
  const analysis = useMemo(() => {
    if (data.length === 0) return null;
    return bottleneckAnalysisService.analyzeCenter2000(data, tiemposCanon);
  }, [data, tiemposCanon]);

  // Extraer datos del análisis
  const { dataEX = [], dataF = [], transferNeedsF = [], filteredData: filteredDataCentro2000 = [] } = analysis || {};

  // Consolidar transferencias INCLUYENDO MES
  const transferNeedsConsolidated = useMemo(() => {
    const consolidated = new Map<string, number>();
    
    const addToMap = (item: TransferNeed) => {
      const key = `${normalizeMaterialCode(item.CodMaterial)}|${item.mes}`;
      consolidated.set(key, (consolidated.get(key) || 0) + item.necesidadTraslado);
    };

    transferNeedsEX.forEach(addToMap);
    transferNeedsF.forEach(addToMap);
    
    return Array.from(consolidated.entries()).map(([key, necesidadTraslado]) => {
      const [CodMaterial, mes] = key.split('|');
      return { CodMaterial, mes, necesidadTraslado };
    });
  }, [transferNeedsEX, transferNeedsF]);

  useEffect(() => {
    if (transferNeedsConsolidated.length > 0) {
      const signature = JSON.stringify(
        transferNeedsConsolidated.map(item => ({
          c: normalizeMaterialCode(item.CodMaterial),
          m: String(item.mes),
          n: safeNumber(item.necesidadTraslado),
        }))
      );
      if (signature !== lastTransferSignatureRef.current) {
        lastTransferSignatureRef.current = signature;
        onTransferNeedsConsolidatedChanged?.(transferNeedsConsolidated);
      }
    }
  }, [transferNeedsConsolidated, onTransferNeedsConsolidatedChanged]);

  const dataFWithZeros = useMemo(() => {
    return dataF.map(row => ({
      ...row,
      _prodViable: 0,
      _isPreComputed: true,
      necesidadMaximaProducirJornadaNormal: 0,
      necesidadMaximaProducirHorasExtras: 0,
      necesidadMaximaProducirSabados: 0,
      _traslado: 0, // Se llenará en el tab de resumen
      _necPropia: safeNumber(row._Necesidades),
      _necesidad: safeNumber(row._Necesidades),
    }));
  }, [dataF]);

  const computedDataConsolidated = useMemo(() => {
    if (computedDataEX.length === 0) return [];
    return [...computedDataEX, ...dataFWithZeros];
  }, [computedDataEX, dataFWithZeros]);

  // Exportar datos calculados al padre (Cerebro)
  useEffect(() => {
    if (onComputedDataReady && computedDataConsolidated.length > 0) {
      const signature = JSON.stringify(
        computedDataConsolidated.map(row => ({
          c: normalizeMaterialCode(row.CodMaterial),
          m: String(row.mesRef || row.Mes || ''),
          p: safeNumber(row._prodViable),
          t: safeNumber(row._trValorAMostrar ?? row._envioC2000 ?? 0),
        }))
      );
      if (signature !== lastComputedSignatureRef.current) {
        lastComputedSignatureRef.current = signature;
        onComputedDataReady(computedDataConsolidated);
      }
    }
  }, [computedDataConsolidated, onComputedDataReady]);

  const sectoresFOpciones = useMemo(() => {
    const s = new Set<string>();
    dataF.forEach(row => {
      const v = String(row.Sector || '').trim();
      if (v) s.add(v);
    });
    return Array.from(s).sort();
  }, [dataF]);

  const mesesFOpciones = useMemo(() => {
    const s = new Set<string>();
    dataF.forEach(row => {
      const mes = String(row.Mes || '').trim();
      if (mes) s.add(mes);
    });
    return Array.from(s).sort((a, b) => {
      const na = parseInt(a, 10);
      const nb = parseInt(b, 10);
      if (!isNaN(na) && !isNaN(nb)) return na - nb;
      return a.localeCompare(b);
    });
  }, [dataF]);

  const dataFFiltrada = useMemo(() => {
    return dataF.filter(row => {
      const sector = String(row.Sector || '').trim();
      const cod = String(row.CodMaterial || '').toLowerCase();
      const desc = String(row.Descripcion || row.NombreMaterial || '').toLowerCase();
      const mes = String(row.Mes || '').trim();

      const okSector = filtroSectorF === '' || sector === filtroSectorF;
      const matQuery = filtroMaterialF.trim().toLowerCase();
      const okMaterial = matQuery === '' || cod.includes(matQuery) || desc.includes(matQuery);
      const okMes = filtroMesF === '' || mes === filtroMesF;
      return okSector && okMaterial && okMes;
    });
  }, [dataF, filtroSectorF, filtroMaterialF, filtroMesF]);

  if (data.length === 0) return <div className="p-4 text-center text-gray-600">Carga datos primero para iniciar el análisis.</div>;

  return (
    <div>
      <BottleneckSummaryTable 
        datosEnriquecidosE={EMPTY_SUMMARY_ENRICHED}
        datosEnriquecidosX={EMPTY_SUMMARY_ENRICHED}
        datosCalculados={computedDataEX}
        tiemposCanon={tiemposCanon}
        numMaximoSabados={numMaximoSabados}
        maxExtrasHoras={maxExtrasHoras}
        horasTrabajo={horasTrabajo}
        horasExtrasFin={horasExtrasFin}
      />
      
      <BottleneckClassTable 
        datos={dataEX}
        datosCompletos={filteredDataCentro2000}
        titulo="Centro 2000 - Clases E + X (Fabricación Local)"
        tiemposCanon={tiemposCanon}
        onTransferNeedsCalculated={setTransferNeedsEX}
        onComputedDataReady={setComputedDataEX}
        maxExtrasHoras={maxExtrasHoras}
        horasExtrasFin={horasExtrasFin}
        trasladosViables={trasladosViables}
      />
      
      {dataF.length > 0 && (
        <div className="mt-8 p-4 bg-amber-50 border border-amber-200 rounded-lg">
          <h3 className="text-sm font-bold text-amber-900 uppercase mb-2">Materiales Clase F (Traslado Quito)</h3>
          <p className="text-xs text-amber-800 mb-4">Estos materiales se trasladan completos sin procesar en Centro 2000. Su demanda ha sido enviada a Quito.</p>
          <div className="flex flex-wrap gap-2 mb-3">
            <input
              type="text"
              placeholder="Material o descripción..."
              value={filtroMaterialF}
              onChange={e => setFiltroMaterialF(e.target.value)}
              className="px-3 py-1.5 border border-amber-300 rounded-md text-xs bg-white min-w-[220px]"
            />
            <select
              value={filtroMesF}
              onChange={e => setFiltroMesF(e.target.value)}
              className="px-3 py-1.5 border border-amber-300 rounded-md text-xs bg-white min-w-[140px]"
            >
              <option value="">Mes: Todos</option>
              {mesesFOpciones.map(m => {
                const n = parseInt(m, 10);
                const mesLabel = !isNaN(n) ? (MONTH_NAMES[n] || m) : m;
                return (
                  <option key={`f-mes-${m}`} value={m}>
                    {mesLabel}
                  </option>
                );
              })}
            </select>
            <select
              value={filtroSectorF}
              onChange={e => setFiltroSectorF(e.target.value)}
              className="px-3 py-1.5 border border-amber-300 rounded-md text-xs bg-white min-w-[180px]"
            >
              <option value="">Sector: Todos</option>
              {sectoresFOpciones.map(s => (
                <option key={`f-sector-${s}`} value={s}>
                  {s}
                </option>
              ))}
            </select>
          </div>
          <div className="max-h-60 overflow-y-auto border border-amber-100 rounded bg-white">
            <table className="w-full text-[10px]">
              <thead className="bg-amber-100 sticky top-0">
                <tr>
                  <th className="px-2 py-1 text-left">Mes</th>
                  <th className="px-2 py-1 text-left">Código</th>
                  <th className="px-2 py-1 text-left">Descripción</th>
                  <th className="px-2 py-1 text-right">Necesidad Traslado</th>
                </tr>
              </thead>
              <tbody>
                {dataFFiltrada.map((row, idx) => {
                  const nec = safeNumber(row._Necesidades);
                  const mesDisplay = !isNaN(parseInt(row.Mes)) ? (MONTH_NAMES[parseInt(row.Mes)] || row.Mes) : row.Mes;
                  return (
                    <tr key={idx} className="border-b border-amber-50">
                      <td className="px-2 py-1 font-bold text-indigo-900">{mesDisplay}</td>
                      <td className="px-2 py-1 font-mono">{row.CodMaterial}</td>
                      <td className="px-2 py-1 truncate max-w-xs">{row.Descripcion || row.NombreMaterial}</td>
                      <td className="px-2 py-1 text-right font-mono font-bold">{Math.round(nec).toLocaleString()}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
};
