'use client';

import React, { useState, useEffect, useMemo, useRef } from 'react';
import { serviciosService } from '@/services/servicios.service';
import { useAppContext } from '@/context/AppProvider';
import { Award, Loader2 } from 'lucide-react';
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from '@/components/ui/table';

/**
 * Componente que muestra las habilidades del personal (CuboHabilidadesOP)
 * filtradas específicamente para el área de Muebles.
 */
export const HabilidadesMueblesTab: React.FC = () => {
    const { addNotification } = useAppContext();
    const [allData, setAllData] = useState<any[]>([]);
    const [isLoading, setIsLoading] = useState(false);
    const [columns, setColumns] = useState<string[]>([]);

    // Refs para el scrollbar doble (superior e inferior)
    const topScrollRef = useRef<HTMLDivElement>(null);
    const tableScrollRef = useRef<HTMLDivElement>(null);
    const tableRef = useRef<HTMLTableElement>(null);
    const [tableWidth, setTableWidth] = useState(0);
    const lastScrolledRef = useRef<'top' | 'table' | null>(null);

    useEffect(() => {
        const fetchData = async () => {
            setIsLoading(true);
            try {
                const response = await serviciosService.getCuboHabilidadesOP();
                if (response && response.data) {
                    const dataArray = Array.isArray(response.data) ? response.data : [response.data];
                    setAllData(dataArray);
                    
                    // Extraer columnas dinámicamente del primer registro
                    if (dataArray.length > 0) {
                        setColumns(Object.keys(dataArray[0]));
                    }
                }
            } catch (error) {
                addNotification('error', `Error al cargar habilidades: ${(error as Error).message}`);
            } finally {
                setIsLoading(false);
            }
        };
        fetchData();
    }, [addNotification]);

    // Filtrar datos: Mostrar solo filas que tengan relación con "Muebles" en cualquier columna
    const filteredData = useMemo(() => {
        return allData.filter(row => 
            Object.values(row).some(val => 
                String(val).toUpperCase().includes('MUEBLES')
            )
        );
    }, [allData]);

    // Lógica de sincronización de scrollbars
    useEffect(() => {
        const calculateWidth = () => {
            if (tableRef.current) setTableWidth(tableRef.current.offsetWidth);
        };
        calculateWidth();
        window.addEventListener('resize', calculateWidth);
        
        const resizeObserver = new ResizeObserver(calculateWidth);
        if (tableRef.current) {
            resizeObserver.observe(tableRef.current);
        }

        return () => {
            window.removeEventListener('resize', calculateWidth);
            if (tableRef.current) {
                resizeObserver.unobserve(tableRef.current);
            }
        };
    }, [filteredData]);

    const handleTopScroll = (e: React.UIEvent<HTMLDivElement>) => {
        if (lastScrolledRef.current === 'table') { lastScrolledRef.current = null; return; }
        if (tableScrollRef.current) {
            lastScrolledRef.current = 'top';
            tableScrollRef.current.scrollLeft = e.currentTarget.scrollLeft;
        }
    };

    const handleTableScroll = (e: React.UIEvent<HTMLDivElement>) => {
        if (lastScrolledRef.current === 'top') { lastScrolledRef.current = null; return; }
        if (topScrollRef.current) {
            lastScrolledRef.current = 'table';
            topScrollRef.current.scrollLeft = e.currentTarget.scrollLeft;
        }
    };

    if (isLoading && allData.length === 0) {
        return (
            <div className="flex justify-center items-center py-8">
                <Loader2 className="w-8 h-8 animate-spin text-indigo-500" />
                <span className="ml-3 text-gray-600">Cargando Habilidades Muebles...</span>
            </div>
        );
    }

    return (
        <div className="space-y-4">
            <div className="bg-indigo-50 border border-indigo-200 p-3 rounded-md">
                <p className="text-xs text-indigo-800 flex items-center gap-2">
                    <Award className="w-4 h-4" />
                    Mostrando las habilidades y calificaciones técnicas filtradas para el personal de <strong>Muebles</strong>.
                </p>
            </div>

            {/* Scrollbar Superior */}
            <div ref={topScrollRef} onScroll={handleTopScroll} className="overflow-x-auto overflow-y-hidden" style={{ height: '18px' }}>
                <div style={{ width: `${tableWidth}px`, height: '1px' }}></div>
            </div>

            {/* Tabla con Scrollbar Inferior */}
            <div ref={tableScrollRef} onScroll={handleTableScroll} className="border rounded-lg overflow-auto max-h-[60vh]">
                <table ref={tableRef} className="min-w-full text-xs border-collapse">
                    <thead className="bg-gray-100 sticky top-0 z-10">
                        <TableRow className="border-b-2 border-gray-300">
                            {columns.map(col => (
                                <TableHead key={col} className="text-center font-bold text-gray-700 uppercase tracking-wider px-4 py-2 border-r border-dashed border-gray-300 last:border-r-0 whitespace-nowrap">
                                    {col}
                                </TableHead>
                            ))}
                        </TableRow>
                    </thead>
                    <tbody className="divide-y divide-gray-200">
                        {filteredData.length > 0 ? filteredData.map((row, idx) => (
                            <TableRow key={idx} className="hover:bg-gray-50">
                                {columns.map((col, cIdx) => (
                                    <TableCell key={`${idx}-${col}`} className="px-4 py-2 text-center border-r border-dashed border-gray-200 last:border-r-0 whitespace-nowrap">
                                        {String(row[col] ?? '-')}
                                    </TableCell>
                                ))}
                            </TableRow>
                        )) : (
                            <TableRow>
                                <td colSpan={columns.length || 1} className="py-10 text-center text-gray-500">
                                    No se encontraron habilidades para Muebles en el sistema.
                                </td>
                            </TableRow>
                        )}
                    </tbody>
                </table>
            </div>
        </div>
    );
};
