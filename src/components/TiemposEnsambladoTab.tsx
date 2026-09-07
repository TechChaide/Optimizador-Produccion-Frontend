'use client';

import React, { useState, useEffect, useRef, useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from '@/components/ui/table';
import { Loader2, Search } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';

interface TiemposEnsambladoTabProps {
    data: any[];
    isLoading: boolean;
}

const ROWS_PER_PAGE_OPTIONS = [20, 50, 100];

export const TiemposEnsambladoTab: React.FC<TiemposEnsambladoTabProps> = ({ data, isLoading }) => {
    const [isMounted, setIsMounted] = useState(false);
    const [columns, setColumns] = useState<string[]>([]);
    const [searchTerm, setSearchTerm] = useState('');
    const [currentPage, setCurrentPage] = useState(1);
    const [rowsPerPage, setRowsPerPage] = useState(ROWS_PER_PAGE_OPTIONS[0]);
    
    const topScrollRef = useRef<HTMLDivElement>(null);
    const tableScrollRef = useRef<HTMLDivElement>(null);
    const tableRef = useRef<HTMLTableElement>(null);
    const [tableWidth, setTableWidth] = useState(0);
    const lastScrolledRef = useRef<'top' | 'table' | null>(null);

    // Hydration Guard
    useEffect(() => {
        setIsMounted(true);
    }, []);

    // Extraer columnas únicas de los datos
    useEffect(() => {
        if (data && data.length > 0) {
            setColumns(Object.keys(data[0]));
        }
    }, [data]);

    // Filtrar datos basados en el término de búsqueda
    const filteredData = useMemo(() => {
        if (!data) return [];
        if (!searchTerm.trim()) return data;
        const term = searchTerm.toLowerCase();
        return data.filter(row => {
            const materialValue = String(row.CodMaterial ?? row.MATERIAL ?? row.Material ?? '').toLowerCase();
            const descValue = String(row.Descripcion ?? row.Material ?? '').toLowerCase();
            return materialValue.includes(term) || descValue.includes(term);
        });
    }, [data, searchTerm]);

    const totalRecords = filteredData.length;
    const totalPages = Math.max(1, Math.ceil(totalRecords / rowsPerPage));

    // Obtener datos para la página actual
    const paginatedData = useMemo(() => {
        const start = (currentPage - 1) * rowsPerPage;
        return filteredData.slice(start, start + rowsPerPage);
    }, [filteredData, currentPage, rowsPerPage]);

    // Resetear a la primera página cuando cambian los filtros
    useEffect(() => {
        setCurrentPage(1);
    }, [searchTerm, rowsPerPage]);

    // Lógica para sincronizar scrollbars dobles
    useEffect(() => {
        if (!isMounted) return;

        const calculateWidth = () => {
            if (tableRef.current) {
                setTableWidth(tableRef.current.offsetWidth);
            }
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
    }, [paginatedData, isMounted]);

    const handleTopScroll = (e: React.UIEvent<HTMLDivElement>) => {
        if (lastScrolledRef.current === 'table') {
            lastScrolledRef.current = null;
            return;
        }
        if (tableScrollRef.current) {
            lastScrolledRef.current = 'top';
            tableScrollRef.current.scrollLeft = e.currentTarget.scrollLeft;
        }
    };

    const handleTableScroll = (e: React.UIEvent<HTMLDivElement>) => {
        if (lastScrolledRef.current === 'top') {
            lastScrolledRef.current = null;
            return;
        }
        if (topScrollRef.current) {
            lastScrolledRef.current = 'table';
            topScrollRef.current.scrollLeft = e.currentTarget.scrollLeft;
        }
    };

    if (!isMounted) {
        return (
            <Card>
                <CardContent className="p-8 flex justify-center">
                    <Loader2 className="w-8 h-8 animate-spin text-gray-400" />
                </CardContent>
            </Card>
        );
    }

    return (
        <Card>
            <CardHeader>
                <CardTitle>Tiempos de Ensamblado - Muebles (Centro 1000)</CardTitle>
                <CardDescription>Tiempos de ensamblado para el grupo de Muebles en el centro 1000.</CardDescription>
            </CardHeader>
            <CardContent>
                {isLoading ? (
                    <div className="flex justify-center items-center p-8">
                        <Loader2 className="w-8 h-8 animate-spin" />
                    </div>
                ) : (
                    <>
                        <div className="mb-4 relative">
                            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-4 w-4" />
                            <Input
                                placeholder="Buscar por código de material o descripción..."
                                value={searchTerm}
                                onChange={(e) => setSearchTerm(e.target.value)}
                                className="pl-10 h-10"
                            />
                        </div>
                        
                        {paginatedData.length > 0 ? (
                            <>
                                <div ref={topScrollRef} onScroll={handleTopScroll} className="overflow-x-auto overflow-y-hidden" style={{ height: '18px' }}>
                                    <div style={{ width: `${tableWidth}px`, height: '1px' }}></div>
                                </div>
                                <div ref={tableScrollRef} onScroll={handleTableScroll} className="border rounded-lg overflow-auto max-h-[60vh]">
                                    <table ref={tableRef} className="min-w-full text-xs divide-y divide-gray-200">
                                        <TableHeader>
                                            <TableRow>
                                                {columns.map(col => (
                                                    <TableHead key={col}>
                                                        {col === 'CodMaterial' ? 'MATERIAL' : col}
                                                    </TableHead>
                                                ))}
                                            </TableRow>
                                        </TableHeader>
                                        <TableBody>
                                            {paginatedData.map((row, idx) => (
                                                <TableRow key={`row-${idx}`}>
                                                    {columns.map(col => {
                                                        const value = row[col];
                                                        const displayValue = (col === 'Tiempo_Min' || col === 'Tiempo') && typeof value === 'number'
                                                            ? value.toFixed(2)
                                                            : String(value ?? '-');
                                                        return <TableCell key={`${idx}-${col}`}>{displayValue}</TableCell>;
                                                    })}
                                                </TableRow>
                                            ))}
                                        </TableBody>
                                    </table>
                                </div>

                                <div className="flex items-center justify-between mt-4">
                                    <div className="flex items-center space-x-2">
                                        <span className="text-sm text-gray-600">Filas por página:</span>
                                        <select
                                            value={rowsPerPage}
                                            onChange={(e) => setRowsPerPage(Number(e.target.value))}
                                            className="px-3 py-1 border border-gray-300 rounded-md text-sm bg-white"
                                        >
                                            {ROWS_PER_PAGE_OPTIONS.map(size => (
                                                <option key={size} value={size}>{size}</option>
                                            ))}
                                        </select>
                                    </div>
                                    <div className="flex items-center space-x-2">
                                        <span className="text-sm text-gray-600">
                                            Página {currentPage} de {totalPages} ({totalRecords} registros)
                                        </span>
                                        <div className="flex gap-1">
                                            <Button variant="outline" size="sm" onClick={() => goToPage(1)} disabled={currentPage === 1}>
                                                Primera
                                            </Button>
                                            <Button variant="outline" size="sm" onClick={() => goToPage(prev => Math.max(1, prev - 1))} disabled={currentPage === 1}>
                                                Anterior
                                            </Button>
                                            <Button variant="outline" size="sm" onClick={() => goToPage(prev => Math.min(totalPages, prev + 1))} disabled={currentPage === totalPages}>
                                                Siguiente
                                            </Button>
                                            <Button variant="outline" size="sm" onClick={() => goToPage(totalPages)} disabled={currentPage === totalPages}>
                                                Última
                                            </Button>
                                        </div>
                                    </div>
                                </div>
                            </>
                        ) : (
                             <div className="text-center py-8 text-gray-500">
                                {searchTerm ? `No se encontraron resultados para "${searchTerm}"` : 'No se encontraron datos de tiempos de ensamblado.'}
                            </div>
                        )}
                    </>
                )}
            </CardContent>
        </Card>
    );
};