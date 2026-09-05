
'use client';

import React, { useEffect, useState } from 'react';
import { logger } from '@/services/LogService';
import { RealDataIcon } from '@/constants/constants';
import { queryApi } from '@/hooks/useApiData';

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

// --- Reusable Dictionary Component ---
interface DataDictionaryProps {
    title: string;
    sourceInfo: SourceInfo | undefined;
    isLoading: boolean;
}
// ...existing code...

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
                        {sourceInfo.columns.map(col => (
                            <tr key={col.column_name} className="hover:bg-gray-50">
                                <td className="px-4 py-2 whitespace-nowrap font-mono text-indigo-700">{col.column_name}</td>
                                <td className="px-4 py-2 whitespace-nowrap text-gray-800">{col.friendly_name}</td>
                                <td className="px-4 py-2 whitespace-normal text-gray-600">{col.description}</td>
                                <td className="px-4 py-2 whitespace-nowrap font-mono text-gray-500">{col.sample_value || 'N/A'}</td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
        </div>
    );
};


export const RealDataSection: React.FC = () => {
        useEffect(() => {
            logger.log(`\n--------------------------------------------------\n##################################\n--------------------------------------------------\n[RealDataSection] Montado.`);
        }, []);
    const [documentation, setDocumentation] = useState<Documentation | null>(null);
    const [isLoading, setIsLoading] = useState<boolean>(true);
    const [error, setError] = useState<Error | null>(null);

    useEffect(() => {
        const fetchDocumentation = async () => {
            setIsLoading(true);
            setError(null);
            try {
                const docData = await queryApi({ operation: 'get_documentation' });
                setDocumentation(docData);
            } catch (err) {
                setError(err as Error);
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
                Utiliza esta información para entender la estructura de datos al solicitar cambios en la aplicación.
            </p>

            {isLoading && <p className="text-gray-500 animate-pulse text-center">Cargando documentación de la API...</p>}
            {error && <p className="text-red-500 text-center">Error al cargar la documentación: {error.message}</p>}
            
            <div className="space-y-8">
                {dataSources.map(sourceName => (
                    <DataDictionary
                        key={sourceName}
                        title={`Tabla: ${sourceName}`}
                        sourceInfo={documentation?.[sourceName]}
                        isLoading={false}
                    />
                ))}
            </div>
        </div>
    );
};
