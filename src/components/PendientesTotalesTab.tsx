'use client';

import React, { useState, useEffect, useMemo, useRef } from 'react';
import { serviciosService } from '@/services/servicios.service';
import { useAppContext } from '@/context/AppProvider';
import { ClipboardList, Loader2, Search, Package } from 'lucide-react';
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { cn } from '@/lib/utils';

interface PendienteItem {
  [key: string]: any;
}

const ROWS_PER_PAGE_OPTIONS = [20, 50, 100];

// Solo se muestran pendientes cuya fecha de entrega (ANIOENTREGA) sea este año o posterior
const TARGET_ANIO_ENTREGA = 2026;

export const PendientesTotalesTab: React.FC = () => {
    const { addNotification } = useAppContext();
    const [isMounted, setIsMounted] = useState(false);
    const [data, setData] = useState<PendienteItem[]>([]);
    const [isLoading, setIsLoading] = useState(false);
    const [columns, setColumns] = useState<string[]>([]);
    const [searchTerm, setSearchTerm] = useState('');
    const [currentPage, setCurrentPage] = useState(1);
    const [rowsPerPage, setRowsPerPage] = useState(ROWS_PER_PAGE_OPTIONS[0]);

    // Refs para scrollbar doble
    const topScrollRef = useRef<HTMLDivElement>(null);
    const tableScrollRef = useRef<HTMLDivElement>(null);
    const tableRef = useRef<HTMLTableElement>(null);
    const [tableWidth, setTableWidth] = useState(0);
    const lastScrolledRef = useRef<'top' | 'table' | null>(null);

    useEffect(() => {
        setIsMounted(true);
    }, []);

    // Descarga el set completo (paginado internamente) y filtra por ANIOENTREGA = 2026
    const fetchData = async () => {
        setIsLoading(true);
        try {
            const explore = await serviciosService.getPendientesTotales(1, 1);
            const total = explore.totalRegistros || 0;

            let combined: PendienteItem[] = [];
            if (total > 0) {
                const BATCH_SIZE = 20000;
                const totalPages = Math.ceil(total / BATCH_SIZE);
                for (let i = 1; i <= totalPages; i++) {
                    const res = await serviciosService.getPendientesTotales(i, BATCH_SIZE);
                    if (res && res.data) {
                        const batch = Array.isArray(res.data) ? res.data : [res.data];
                        combined = combined.concat(batch);
                    }
                }
            }

            const filtered = combined.filter(item => Number(item.ANIOENTREGA) >= TARGET_ANIO_ENTREGA);
            setData(filtered);

            if (filtered.length > 0) {
                setColumns(Object.keys(filtered[0]));
            }
        } catch (error) {
            console.error('Error al cargar pendientes:', error);
            addNotification('error', 'Error al cargar los pendientes totales');
        } finally {
            setIsLoading(false);
        }
    };

    useEffect(() => {
        if (isMounted) {
            fetchData();
        }
    }, [isMounted]);

    // Filtrado local por término de búsqueda, sobre el set ya filtrado por año
    const searchedData = useMemo(() => {
        if (!searchTerm.trim()) return data;
        const term = searchTerm.toLowerCase();
        return data.filter(row =>
            Object.values(row).some(val =>
                String(val).toLowerCase().includes(term)
            )
        );
    }, [data, searchTerm]);

    const totalRecords = searchedData.length;
    const totalPages = Math.max(1, Math.ceil(totalRecords / rowsPerPage));

    // Paginación client-side sobre el set ya filtrado (por año + búsqueda)
    const filteredData = useMemo(() => {
        const start = (currentPage - 1) * rowsPerPage;
        return searchedData.slice(start, start + rowsPerPage);
    }, [searchedData, currentPage, rowsPerPage]);

    // Sincronización de scrollbars
    useEffect(() => {
        if (!isMounted) return;
        const calculateWidth = () => {
            if (tableRef.current) setTableWidth(tableRef.current.offsetWidth);
        };
        calculateWidth();
        window.addEventListener('resize', calculateWidth);
        const resizeObserver = new ResizeObserver(calculateWidth);
        if (tableRef.current) resizeObserver.observe(tableRef.current);
        return () => {
            window.removeEventListener('resize', calculateWidth);
            if (tableRef.current) resizeObserver.unobserve(tableRef.current);
        };
    }, [filteredData, isMounted]);

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

    if (!isMounted) return null;

    return (
        <div className="space-y-4">
            <div className="flex flex-col md:flex-row gap-4 items-center justify-between">
                <div className="relative w-full md:w-96">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                    <Input 
                        placeholder="Buscar en todos los pendientes de 2026 en adelante..."
                        className="pl-10"
                        value={searchTerm}
                        onChange={(e) => { setSearchTerm(e.target.value); setCurrentPage(1); }}
                    />
                </div>
                <div className="flex items-center gap-2 text-sm text-gray-500">
                    <ClipboardList className="w-4 h-4" />
                    <span>Total Registros (Año Entrega {TARGET_ANIO_ENTREGA}+): <strong>{totalRecords.toLocaleString()}</strong></span>
                </div>
            </div>

            {isLoading && data.length === 0 ? (
                <div className="flex justify-center items-center py-20">
                    <Loader2 className="w-8 h-8 animate-spin text-indigo-600" />
                    <span className="ml-3 text-gray-600 font-medium">Cargando Pendientes Totales...</span>
                </div>
            ) : data.length > 0 ? (
                <>
                    <div ref={topScrollRef} onScroll={handleTopScroll} className="overflow-x-auto overflow-y-hidden h-[18px]">
                        <div style={{ width: `${tableWidth}px`, height: '1px' }}></div>
                    </div>

                    <div ref={tableScrollRef} onScroll={handleTableScroll} className="border rounded-lg overflow-auto max-h-[60vh] bg-white shadow-sm">
                        <table ref={tableRef} className="min-w-full text-xs border-collapse">
                            <thead className="bg-gray-100 sticky top-0 z-10 shadow-sm">
                                <tr className="border-b-2 border-gray-300">
                                    {columns.map(col => (
                                        <TableHead key={col} className="text-center font-bold text-gray-700 uppercase tracking-wider px-4 py-2 border-r border-dashed border-gray-300 last:border-r-0 whitespace-nowrap">
                                            {col.replace(/_/g, ' ')}
                                        </TableHead>
                                    ))}
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-200">
                                {filteredData.map((row, idx) => (
                                    <tr key={idx} className="hover:bg-gray-50 transition-colors">
                                        {columns.map((col, cIdx) => (
                                          <TableCell key={`${idx}-${cIdx}`} className="px-4 py-2 text-center border-r border-dashed border-gray-200 last:border-r-0 whitespace-nowrap text-gray-600">
                                              {String(row[col] ?? '-')}
                                          </TableCell>
                                        ))}
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>

                    <div className="flex items-center justify-between mt-4 bg-gray-50 p-3 rounded-lg border">
                        <div className="flex items-center space-x-2">
                            <span className="text-xs text-gray-600">Filas por página:</span>
                            <select
                                value={rowsPerPage}
                                onChange={(e) => {
                                    setRowsPerPage(Number(e.target.value));
                                    setCurrentPage(1);
                                }}
                                className="px-3 py-1.5 border rounded-md text-xs bg-white focus:ring-indigo-500"
                            >
                                {ROWS_PER_PAGE_OPTIONS.map(size => <option key={size} value={size}>{size}</option>)}
                            </select>
                        </div>
                        <div className="flex items-center space-x-2">
                            <span className="text-xs text-gray-600 font-medium">
                                Página <strong>{currentPage}</strong> de {totalPages}
                            </span>
                            <div className="flex gap-1 ml-4">
                                <Button variant="outline" size="sm" className="h-8" onClick={() => setCurrentPage(1)} disabled={currentPage === 1 || isLoading}>Primera</Button>
                                <Button variant="outline" size="sm" className="h-8" onClick={() => setCurrentPage(p => Math.max(1, p - 1))} disabled={currentPage === 1 || isLoading}>Anterior</Button>
                                <Button variant="outline" size="sm" className="h-8" onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))} disabled={currentPage >= totalPages || isLoading}>Siguiente</Button>
                                <Button variant="outline" size="sm" className="h-8" onClick={() => setCurrentPage(totalPages)} disabled={currentPage >= totalPages || isLoading}>Última</Button>
                            </div>
                        </div>
                    </div>
                </>
            ) : (
                <div className="flex flex-col items-center justify-center py-20 bg-gray-50 border-2 border-dashed rounded-xl">
                    <Package className="w-12 h-12 text-gray-300 mb-4" />
                    <p className="text-gray-500">No se encontraron pendientes en el sistema.</p>
                </div>
            )}
        </div>
    );
};
