'use client';

import React, { useState, useEffect } from 'react';
import { getMaterialesCuelloBotellaPorLinea, exportToXLSX, type BottleneckMaterialAnalysis } from './utils';

interface BottleneckMaterialAnalysisSectionProps {
  data: any[];
  isLoading?: boolean;
}

export const BottleneckMaterialAnalysisSection: React.FC<BottleneckMaterialAnalysisSectionProps> = ({
  data,
  isLoading = false
}) => {
  const [analisisResultados, setAnalisisResultados] = useState<BottleneckMaterialAnalysis[]>([]);
  const [isProcessing, setIsProcessing] = useState(false);

  // Procesar datos cuando cambien
  useEffect(() => {
    if (data && data.length > 0) {
      setIsProcessing(true);
      try {
        const resultados = getMaterialesCuelloBotellaPorLinea(data);
        setAnalisisResultados(resultados);
      } catch (error) {
        console.error('Error procesando bottleneck por material:', error);
        setAnalisisResultados([]);
      } finally {
        setIsProcessing(false);
      }
    } else {
      setAnalisisResultados([]);
    }
  }, [data]);

  if (isLoading || isProcessing) {
    return (
      <div className="flex items-center justify-center py-8">
        <div className="text-gray-600">Procesando análisis de materiales...</div>
      </div>
    );
  }

  if (!analisisResultados.length) {
    return (
      <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
        <p className="text-yellow-800">No hay datos para analizar. Carga los datos del backend primero.</p>
      </div>
    );
  }

  const handleExportCSV = () => {
    const dataToExport = analisisResultados.map(r => ({
      Centro: r.Centro,
      Linea: r.LineaFabricacion,
      NombreLinea: r.NombreLinea,
      CodMaterial: r.CodMaterial,
      NombreMaterial: r.NombreMaterial,
      Necesidad: r.Necesidad,
      PuestoTrabajo: r.PuestoDeTrabajo || '',
      NumeroPuestos: r.NumeroPuestos || 0,
      TiempoCanonicoMinutos: r.TiempoCanonicoMinutos || 0,
      TiempoCanonicoHoras: r.TiempoCanonicoHoras || 0,
      Metodologia: r.Metodologia
    }));
    
    exportToXLSX(dataToExport, 'Bottleneck_Material_Por_Linea');
  };

  return (
    <div className="space-y-4">
      <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 flex justify-between items-start">
        <div>
          <h3 className="font-semibold text-blue-900 mb-2">Análisis de Cuellos de Botella por Material</h3>
          <p className="text-sm text-blue-800">
            Material con mayor necesidad por Línea de Fabricación y Centro.
            Si hay empate, se utiliza voto a mayoría por puesto de trabajo.
          </p>
        </div>
        <button
          onClick={handleExportCSV}
          className="inline-flex items-center px-3 py-2 text-sm font-medium text-green-700 bg-green-50 border border-green-200 rounded-lg hover:bg-green-100 transition-colors"
        >
          <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
          </svg>
          Descargar CSV
        </button>
      </div>

      <div className="overflow-x-auto rounded-lg border border-gray-200 shadow-sm">
        <table className="w-full border-collapse text-sm">
          <thead className="sticky top-0 z-10 bg-gray-100">
            <tr className="bg-gray-100 border-b border-gray-200">
              <th className="px-4 py-3 text-left font-semibold text-gray-700">Centro</th>
              <th className="px-4 py-3 text-left font-semibold text-gray-700">Línea</th>
              <th className="px-4 py-3 text-left font-semibold text-gray-700">Código Material</th>
              <th className="px-4 py-3 text-left font-semibold text-gray-700">Nombre Material</th>
              <th className="px-4 py-3 text-right font-semibold text-gray-700">Necesidad</th>
              <th className="px-4 py-3 text-left font-semibold text-gray-700">Puesto Trabajo</th>
              <th className="px-4 py-3 text-right font-semibold text-gray-700">Nº Puestos</th>
              <th className="px-4 py-3 text-right font-semibold text-gray-700">Tiempo Canónico (min)</th>
              <th className="px-4 py-3 text-right font-semibold text-gray-700">Tiempo Canónico (h)</th>
              <th className="px-4 py-3 text-center font-semibold text-gray-700">Metodología</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-200">
            {analisisResultados.map((resultado, idx) => (
              <tr
                key={idx}
                className={`hover:bg-gray-50 transition-colors ${
                  idx % 2 === 0 ? 'bg-white' : 'bg-gray-50'
                }`}
              >
                <td className="px-4 py-3 font-medium text-gray-900">{resultado.Centro}</td>
                <td className="px-4 py-3 text-gray-700">{resultado.LineaFabricacion}</td>
                <td className="px-4 py-3 font-mono text-sm text-gray-600">{resultado.CodMaterial}</td>
                <td className="px-4 py-3 text-gray-700">{resultado.NombreMaterial}</td>
                <td className="px-4 py-3 text-right font-semibold text-blue-600">
                  {resultado.Necesidad.toLocaleString()}
                </td>
                <td className="px-4 py-3 text-gray-700">
                  {resultado.PuestoDeTrabajo ?? '-'}
                </td>
                <td className="px-4 py-3 text-right text-gray-700">
                  {resultado.NumeroPuestos ?? '-'}
                </td>
                <td className="px-4 py-3 text-right text-gray-700">
                  {resultado.TiempoCanonicoMinutos != null 
                    ? resultado.TiempoCanonicoMinutos.toFixed(2)
                    : '-'
                  }
                </td>
                <td className="px-4 py-3 text-right text-gray-700">
                  {resultado.TiempoCanonicoHoras != null 
                    ? resultado.TiempoCanonicoHoras.toFixed(3)
                    : '-'
                  }
                </td>
                <td className="px-4 py-3 text-center">
                  <span className={`inline-block px-3 py-1 rounded-full text-xs font-semibold ${
                    resultado.Metodologia === 'Voto mayoría'
                      ? 'bg-purple-100 text-purple-800'
                      : 'bg-green-100 text-green-800'
                  }`}>
                    {resultado.Metodologia}
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="bg-gray-50 rounded-lg p-4 border border-gray-200">
        <h4 className="font-semibold text-gray-900 mb-2">Resumen:</h4>
        <ul className="text-sm text-gray-700 space-y-1">
          <li>• Total de líneas analizadas: <strong>{analisisResultados.length}</strong></li>
          <li>• Mayor necesidad encontrada: <strong>{Math.max(...analisisResultados.map(r => r.Necesidad)).toLocaleString()}</strong> unidades</li>
          <li>• Materiales seleccionados por voto mayoría: <strong>{analisisResultados.filter(r => r.Metodologia === 'Voto mayoría').length}</strong></li>
        </ul>
      </div>
    </div>
  );
};
