
'use client';

import React, { useState, useEffect, useMemo, useRef } from 'react';
import { serviciosService } from '@/services/servicios.service';
import { useAppContext } from '@/context/AppProvider';
import { logger } from '@/services/LogService';
import { Package, Loader2, Search, Table as TableIcon, Filter, AlertCircle } from 'lucide-react';
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';

interface CuboInventariosItem {
  [key: string]: any;
}

const ROWS_PER_PAGE_OPTIONS = [20, 50, 100, 200];

export const CuboInventariosGeneralTab: React.FC = () => {
    const { addNotification } = useAppContext();
    const [allData, setAllData] = useState<CuboInventariosItem[]>([]);
    const [isLoading, setIsLoading] = useState(false);
    const [columns, setColumns] = useState<string[]>([]);
    const [searchTerm, setSearchTerm] = useState('');
    const [currentPage, setCurrentPage] = useState(1);
    const [rowsPerPage, setRowsPerPage] = useState(ROWS_PER_PAGE_OPTIONS[1]); 

    // Refs para sincronización de scrollbar doble
    const topScrollRef = useRef<HTMLDivElement>(null);
    const tableScrollRef = useRef<HTMLDivElement>(null);
    const tableRef = useRef<HTMLTableElement>(null);
    const [tableWidth, setTableWidth] = useState(0);
    const lastScrolledRef = useRef<'top' | 'table' | null>(null);

    useEffect(() => {
        const fetchAllInventario = async () => {
            setIsLoading(true);
            logger.log('[CuboInventarios] Iniciando descarga global de datos...', 'info');
            try {
                // Consultamos un bloque inicial para explorar estructura y total
                const exploreResponse = await serviciosService.getCuboInventarios(1, 100);
                const totalRecords = exploreResponse.totalRegistros || exploreResponse.totalRecords || 0;

                if (!exploreResponse.data || exploreResponse.data.length === 0) {
                    logger.log('[CuboInventarios] El API no devolvió datos en la consulta inicial.', 'warning');
                    setAllData([]);
                    setIsLoading(false);
                    return;
                }

                logger.log(`[CuboInventarios] Total de registros reportados: ${totalRecords}`, 'info');
                
                // Descarga masiva en bloques de 10,000 para estabilidad
                const BATCH_SIZE = 10000;
                const totalPagesToFetch = Math.ceil(totalRecords / BATCH_SIZE) || 1;
                let fetchedData: CuboInventariosItem[] = [];

                for (let i = 1; i <= totalPagesToFetch; i++) {
                    const pageResponse = await serviciosService.getCuboInventarios(i, BATCH_SIZE);
                    if (pageResponse.data && Array.isArray(pageResponse.data)) {
                        fetchedData = fetchedData.concat(pageResponse.data);
                    }
                    if (fetchedData.length >= totalRecords && totalRecords > 0) break;
                }

                setAllData(fetchedData);
                logger.log(`[CuboInventarios] Descarga completada: ${fetchedData.length} registros en memoria.`, 'success');

                // Configuración dinámica de columnas prioritarias
                if (fetchedData.length > 0) {
                    const sample = fetchedData[0];
                    const originalColumns = Object.keys(sample);
                    
                    // Identificar nombres reales de columnas (ignorar case)
                    const findCol = (name: string) => originalColumns.find(c => c.toUpperCase() === name.toUpperCase()) || name;
                    
                    const priority = [
                        findCol('Material'), 
                        findCol('Descripcion'), 
                        findCol('StockActual'), 
                        'STOCK DISPONIBLE', // Nueva columna calculada
                        findCol('RESPCTRLPROD'), 
                        findCol('Centro'), 
                        findCol('ClaseAprovisionam')
                    ];
                    
                    const others = originalColumns.filter(c => !priority.includes(c));
                    setColumns([...priority, ...others]);
                    
                    logger.log(`[CuboInventarios] Estructura detectada. Columnas: ${originalColumns.join(', ')}`, 'info');
                }

            } catch (error) {
                console.error('Error al cargar inventario:', error);
                logger.log(`[CuboInventarios] Error crítico: ${(error as Error).message}`, 'error');
                addNotification('error', 'Error al sincronizar el Cubo de Inventarios.');
            } finally {
                setIsLoading(false);
            }
        };

        fetchAllInventario();
    }, [addNotification]);

    // Lógica de filtrado solicitada por el usuario
    const filteredData = useMemo(() => {
        if (!allData || allData.length === 0) return [];

        return allData.filter(row => {
            // Regla 1: No muestres nada que empiece con "PTBO" de la columna "DESCRIPCION"
            const descKey = Object.keys(row).find(k => k.toUpperCase() === 'DESCRIPCION');
            const descValue = String(row[descKey || ''] || '').trim().toUpperCase();
            if (descValue.startsWith('PTBO')) return false;
            
            // Regla 2: Muestra solamente la información de "006" y "019" de la columna "RESPCTRLPROD"
            const respKey = Object.keys(row).find(k => k.toUpperCase() === 'RESPCTRLPROD');
            const respValue = String(row[respKey || ''] || '').trim();
            if (respValue !== '006' && respValue !== '019') return false;
            
            // Filtro de búsqueda manual (buscador)
            if (searchTerm.trim()) {
                const term = searchTerm.toLowerCase();
                const materialKey = Object.keys(row).find(k => k.toUpperCase() === 'MATERIAL');
                const material = String(row[materialKey || ''] || '').toLowerCase();
                return material.includes(term) || descValue.toLowerCase().includes(term);
            }
            
            return true;
        });
    }, [allData, searchTerm]);

    const totalRecords = filteredData.length;
    const totalPages = Math.max(1, Math.ceil(totalRecords / rowsPerPage));

    const displayedData = useMemo(() => {
        const start = (currentPage - 1) * rowsPerPage;
        return filteredData.slice(start, start + rowsPerPage);
    }, [filteredData, currentPage, rowsPerPage]);

    // Sincronización de scroll para tablas anchas
    useEffect(() => {
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
    }, [displayedData]);

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

    return (
        <div className="space-y-4">
             {/* Indicadores de Filtro Activo */}
             <div className="bg-indigo-50 border border-indigo-200 p-3 rounded-lg flex items-center gap-4 flex-wrap shadow-sm">
                <div className="flex items-center gap-2">
                    <Filter className="w-4 h-4 text-indigo-600" />
                    <span className="text-xs font-bold text-indigo-800 uppercase">Configuración de Vista:</span>
                </div>
                <Badge variant="secondary" className="bg-white border-indigo-300 text-indigo-700 text-[10px] font-bold">
                    RESPONSABLES: 006, 019
                </Badge>
                <Badge variant="secondary" className="bg-white border-indigo-300 text-indigo-700 text-[10px] font-bold">
                    EXCLUYE: PTBO*
                </Badge>
                <Badge variant="secondary" className="bg-indigo-600 text-white text-[10px] font-bold">
                    CÁLCULO: STOCK DISPONIBLE = ACTUAL - SEGURIDAD
                </Badge>
                {isLoading && (
                    <div className="flex items-center gap-2 text-xs text-indigo-600 ml-auto animate-pulse font-medium">
                        <Loader2 className="w-3 h-3 animate-spin" />
                        Sincronizando maestro completo...
                    </div>
                )}
             </div>

             <div className="flex flex-col md:flex-row gap-4 items-center justify-between">
                <div className="relative w-full md:w-96">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                    <Input 
                        placeholder="Buscar por material o descripción..." 
                        className="pl-10 h-10 text-sm border-gray-300 focus:ring-indigo-500"
                        value={searchTerm}
                        onChange={(e) => { setSearchTerm(e.target.value); setCurrentPage(1); }}
                    />
                </div>
                <div className="flex items-center gap-2 text-sm text-gray-500 font-medium">
                    <TableIcon className="w-4 h-4" />
                    <span>Visualizando <strong>{totalRecords.toLocaleString()}</strong> materiales de Muebles</span>
                </div>
            </div>

            {isLoading && allData.length === 0 ? (
                <div className="flex flex-col justify-center items-center py-24 gap-4 bg-white border rounded-xl shadow-sm border-dashed">
                    <Loader2 className="w-12 h-12 animate-spin text-indigo-600" />
                    <div className="text-center">
                        <span className="text-gray-900 font-bold block">Conectando con el Cubo de Inventarios</span>
                        <span className="text-gray-500 text-xs mt-1">Este proceso puede tardar unos segundos dependiendo del volumen de datos...</span>
                    </div>
                </div>
            ) : displayedData.length === 0 ? (
                <div className="flex flex-col justify-center items-center py-24 gap-4 bg-white border rounded-xl shadow-sm border-dashed">
                    <AlertCircle className="w-12 h-12 text-amber-500" />
                    <div className="text-center">
                        <span className="text-gray-900 font-bold block">No hay datos para mostrar</span>
                        <span className="text-gray-500 text-xs mt-1">
                            {allData.length === 0 
                                ? 'La respuesta del servidor está vacía.' 
                                : 'Los filtros de responsabilidad (006/019) o descripción (PTBO) han descartado todos los registros.'}
                        </span>
                        <Button variant="outline" className="mt-4 border-indigo-200 text-indigo-600" onClick={() => window.location.reload()}>
                            Reintentar Sincronización
                        </Button>
                    </div>
                </div>
            ) : (
                <>
                    <div ref={topScrollRef} onScroll={handleTopScroll} className="overflow-x-auto overflow-y-hidden" style={{ height: '18px' }}>
                        <div style={{ width: `${tableWidth}px`, height: '1px' }}></div>
                    </div>

                    <div ref={tableScrollRef} onScroll={handleTableScroll} className="border rounded-lg overflow-auto max-h-[58vh] bg-white shadow-sm scroll-smooth">
                        <table ref={tableRef} className="min-w-full text-[11px] border-collapse">
                            <thead className="bg-gray-100 sticky top-0 z-10 shadow-sm">
                                <tr className="border-b-2 border-gray-300">
                                    {columns.map(col => (
                                        <TableHead key={col} className={cn(
                                            "text-center font-bold text-gray-700 uppercase tracking-wider px-4 py-2.5 border-r border-dashed border-gray-300 last:border-r-0 whitespace-nowrap bg-gray-50",
                                            col === 'STOCK DISPONIBLE' && "bg-indigo-600 text-white border-white border-solid"
                                        )}>
                                            {col.replace(/_/g, ' ')}
                                        </TableHead>
                                    ))}
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-100">
                                {displayedData.map((row, idx) => (
                                    <tr key={idx} className="hover:bg-blue-50/40 transition-colors">
                                        {columns.map((col, colIndex) => {
                                            let val: any;
                                            const isMaterial = col.toUpperCase().includes('MATERIAL');
                                            const isResp = col.toUpperCase().includes('RESP');
                                            const isStock = col.toUpperCase().includes('STOCK');
                                            const isAvailable = col === 'STOCK DISPONIBLE';

                                            if (isAvailable) {
                                              // Cálculo Dinámico: Actual - Seguridad
                                              const keys = Object.keys(row);
                                              const saKey = keys.find(k => k.toUpperCase() === 'STOCKACTUAL');
                                              const ssKey = keys.find(k => k.toUpperCase() === 'STOCKSEGURIDAD');
                                              val = Number(row[saKey || ''] || 0) - Number(row[ssKey || ''] || 0);
                                            } else {
                                              val = row[col];
                                            }

                                            if (isMaterial) val = String(val).replace(/^0+/, '');
                                            
                                            return (
                                                <TableCell key={`${idx}-${col}`} className={cn(
                                                    "px-4 py-2 text-center border-r border-dashed border-gray-200 last:border-r-0 whitespace-nowrap",
                                                    (isStock || isAvailable) && Number(val) > 0 && "font-bold text-emerald-700 bg-emerald-50/20",
                                                    (isStock || isAvailable) && Number(val) < 0 && "font-bold text-red-700 bg-red-50/20",
                                                    isMaterial && "font-mono font-bold text-indigo-700",
                                                    isResp && "font-bold text-blue-700 bg-blue-50/20",
                                                    isAvailable && "bg-indigo-50 border-x-2 border-indigo-200"
                                                )}>
                                                    {typeof val === 'number' ? val.toLocaleString() : String(val ?? '-')}
                                                </TableCell>
                                            );
                                        })}
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>

                    <div className="flex items-center justify-between mt-4 bg-white p-3 rounded-lg border shadow-sm">
                        <div className="flex items-center space-x-2">
                            <span className="text-xs text-gray-600 font-medium">Filas por página:</span>
                            <select
                                value={rowsPerPage}
                                onChange={(e) => { setRowsPerPage(Number(e.target.value)); setCurrentPage(1); }}
                                className="px-2 py-1 border rounded-md text-xs bg-white focus:ring-indigo-500"
                            >
                                {ROWS_PER_PAGE_OPTIONS.map(size => <option key={size} value={size}>{size}</option>)}
                            </select>
                        </div>
                        <div className="flex items-center space-x-2">
                             <span className="text-xs text-gray-600 font-bold">
                                Página {currentPage} de {totalPages} ({totalRecords.toLocaleString()} registros filtrados)
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
            )}
        </div>
    );
};
