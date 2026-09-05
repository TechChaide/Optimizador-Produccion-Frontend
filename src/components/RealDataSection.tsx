
'use client';

import React, { useEffect, useState } from 'react';
import { logger } from '@/services/LogService';
import { RealDataIcon } from '@/constants/constants';
import { serviciosService } from '@/services/servicios.service';
import { Button } from '@/components/ui/button';

interface ColumnInfo {
    column_name: string;
    friendly_name: string;
    description: string;
    sample_value: string;
}

interface SourceInfo {
    description: string;
    columns: ColumnInfo[];
}

interface Documentation {
    [sourceName: string]: SourceInfo;
}

interface DataDictionaryProps {
    title: string;
    sourceInfo: SourceInfo | undefined;
    isLoading: boolean;
}

const DataDictionary: React.FC<DataDictionaryProps> = ({ title, sourceInfo, isLoading }) => {
    if (isLoading) {
        return (
            <div className="bg-white p-6 rounded-xl shadow-lg">
                <h3 className="text-lg font-semibold text-gray-800 mb-4">{title}</h3>
                <p className="text-gray-500 animate-pulse">Consultando esquema de la fuente de datos...</p>
            </div>
        );
    }

    if (!sourceInfo) {
        return (
            <div className="bg-white p-6 rounded-xl shadow-lg">
                <h3 className="text-lg font-semibold text-gray-800 mb-4">{title}</h3>
                <p className="text-gray-500">No se encontró la documentación para esta fuente de datos.</p>
            </div>
        );
    }
    
    return (
        <div className="bg-white p-6 rounded-xl shadow-lg">
            <h3 className="text-lg font-semibold text-gray-800 mb-2">{title}</h3>
            <p className="text-sm text-gray-600 mb-4">{sourceInfo.description}</p>
            <div className="overflow-x-auto max-h-[60vh] border rounded-lg bg-gray-50">
                <table className="min-w-full text-sm divide-y divide-gray-200">
                    <thead className="bg-gray-100 sticky top-0">
                        <tr>
                            <th className="px-4 py-2 text-left font-semibold text-gray-600 uppercase tracking-wider w-1/4">Nombre de Columna (API)</th>
                            <th className="px-4 py-2 text-left font-semibold text-gray-600 uppercase tracking-wider w-1/4">Nombre Amigable</th>
                            <th className="px-4 py-2 text-left font-semibold text-gray-600 uppercase tracking-wider w-1/4">Descripción</th>
                            <th className="px-4 py-2 text-left font-semibold text-gray-600 uppercase tracking-wider w-1/4">Valor de Ejemplo</th>
                        </tr>
                    </thead>
                    <tbody className="bg-white divide-y divide-gray-200">
                        {Array.isArray(sourceInfo.columns) && sourceInfo.columns.length > 0 ? (
                            sourceInfo.columns.map(col => (
                                <tr key={col.column_name} className="hover:bg-gray-50">
                                    <td className="px-4 py-2 whitespace-nowrap font-mono text-indigo-700">{col.column_name}</td>
                                    <td className="px-4 py-2 whitespace-nowrap text-gray-800">{col.friendly_name}</td>
                                    <td className="px-4 py-2 whitespace-normal text-gray-600">{col.description}</td>
                                    <td className="px-4 py-2 whitespace-nowrap font-mono text-gray-500">{col.sample_value || 'N/A'}</td>
                                </tr>
                            ))
                        ) : (
                            <tr>
                                <td colSpan={4} className="px-4 py-8 text-center text-gray-500 italic">
                                    Información de columnas no disponible para esta tabla.
                                </td>
                            </tr>
                        )}
                    </tbody>
                </table>
            </div>
        </div>
    );
};

export const RealDataSection: React.FC = () => {
    const [documentation, setDocumentation] = useState<Documentation | null>(null);
    const [isLoading, setIsLoading] = useState<boolean>(true);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        logger.log(`\n--------------------------------------------------\n[RealDataSection] Montado.`);
        const fetchDocumentation = async () => {
            setIsLoading(true);
            setError(null);
            try {
                const response = await serviciosService.getDiccionarioDeDatos();
                const data = response?.data || response;
                setDocumentation(data && typeof data === 'object' ? data : null);
            } catch (err) {
                setError((err as Error).message);
            } finally {
                setIsLoading(false);
            }
        };
        fetchDocumentation();
    }, []);

    const dataSources = documentation ? Object.keys(documentation) : [];

    return (
        <div className="p-6 md:p-8 space-y-6">
            <div className="flex items-center space-x-3">
                <RealDataIcon />
                <h2 className="text-2xl font-semibold text-gray-700">Diccionario de Datos</h2>
            </div>
            
            <p className="text-gray-600 text-sm">
                Esta sección muestra los esquemas de las fuentes de datos disponibles directamente desde la API. Cada tabla lista las columnas que se pueden consultar, su descripción y su nombre técnico.
            </p>

            {isLoading && <p className="text-gray-500 animate-pulse text-center py-20">Consultando Diccionario de Fuentes...</p>}
            {error && (
              <div className="bg-red-50 border border-red-200 p-6 rounded-xl text-center">
                <p className="text-red-600 font-semibold">Error al cargar la documentación</p>
                <p className="text-red-500 text-sm mt-2">{error}</p>
                <Button onClick={() => window.location.reload()} className="mt-4" variant="outline">Reintentar</Button>
              </div>
            )}
            
            {!isLoading && !error && (
              <div className="space-y-8">
                  {dataSources.length > 0 ? (
                      dataSources.map(sourceName => (
                          <DataDictionary
                              key={sourceName}
                              title={`Tabla: ${sourceName}`}
                              sourceInfo={documentation?.[sourceName]}
                              isLoading={false}
                          />
                      ))
                  ) : (
                      <div className="text-center py-20 text-gray-500">
                          No se cargaron fuentes de datos del diccionario.
                      </div>
                  )}
              </div>
            )}
        </div>
    );
};
