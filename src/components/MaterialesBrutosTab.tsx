'use client';

import React, { useState, useEffect, useMemo, useRef } from 'react';
import { serviciosService } from '@/services/servicios.service';
import { useAppContext } from '@/context/AppProvider';
import { Database, Loader2, Search, ArrowRight, AlertCircle, PlayCircle, StopCircle, CheckCircle2 } from 'lucide-react';
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { cn } from '@/lib/utils';
import { Badge } from '@/components/ui/badge';

interface MaterialBrutoItem {
  [key: string]: any;
}

const ROWS_PER_PAGE_OPTIONS = [20, 50, 100, 200, 500];

export const MaterialesBrutosTab: React.FC = () => {
    const { addNotification } = useAppContext();
    const [allData, setAllData] = useState<MaterialBrutoItem[]>([]); 
    const [isLoading, setIsLoading] = useState(false);
    const [columns, setColumns] = useState<string[]>([]);
    const [searchTerm, setSearchTerm] = useState('');
    const [currentPage, setCurrentPage] = useState(1);
    const [rowsPerPage, setRowsPerPage] = useState(ROWS_PER_PAGE_OPTIONS[1]); 
    const [totalRecords, setTotalRecords] = useState(0);

    // Estados para el Escaneo Global
    const [isDeepSearching, setIsDeepSearching] = useState(false);
    const [scanProgress, setScanProgress] = useState(0);
    const [foundInScan, setFoundInScan] = useState(false);
    const abortControllerRef = useRef<AbortController | null>(null);

    // Refs para scrollbar doble
    const topScrollRef = useRef<HTMLDivElement>(null);
    const tableScrollRef = useRef<HTMLDivElement>(null);
    const tableRef = useRef<HTMLTableElement>(null);
    const [tableWidth, setTableWidth] = useState(0);
    const lastScrolledRef = useRef<'top' | 'table' | null>(null);

    // Carga de datos por bloque (página de API)
    const loadBlock = async (page: number, rows: number) => {
        setIsLoading(true);
        try {
            const response = await serviciosService.getMaterialesBrutosPorMaterialMateriaPrima(page, rows);
            if (response && response.data) {
                const dataArray = Array.isArray(response.data) ? response.data : [response.data];
                
                if (page === 1 || totalRecords === 0) {
                    setTotalRecords(response.totalRegistros || response.totalRecords || dataArray.length);
                    if (dataArray.length > 0 && columns.length === 0) {
                        setColumns(Object.keys(dataArray[0]));
                    }
                }

                setAllData(dataArray);
                return dataArray;
            }
        } catch (error) {
            console.error('Error al cargar datos:', error);
            addNotification('error', 'Error al cargar datos de materiales brutos');
        } finally {
            setIsLoading(false);
        }
        return null;
    };

    // Función de búsqueda profunda (Escaneo de páginas)
    const handleDeepSearch = async () => {
        if (!searchTerm.trim()) {
            addNotification('warning', 'Ingresa un código FERT para realizar el escaneo global.');
            return;
        }

        setIsDeepSearching(true);
        setFoundInScan(false);
        setScanProgress(0);
        
        const term = searchTerm.toLowerCase();
        let pageToScan = 1;
        const scanRowsPerPage = 500; // Escanear bloques grandes para velocidad
        const maxPages = 500; // Límite de seguridad
        
        addNotification('info', `Iniciando escaneo global para FERT: ${searchTerm}...`);

        try {
            while (pageToScan <= maxPages) {
                setScanProgress(pageToScan);
                const response = await serviciosService.getMaterialesBrutosPorMaterialMateriaPrima(pageToScan, scanRowsPerPage);
                
                if (!response || !response.data || response.data.length === 0) {
                    addNotification('warning', `Fin de los datos alcanzado en la página ${pageToScan}. No se encontró el material.`);
                    break;
                }

                const data = Array.isArray(response.data) ? response.data : [response.data];
                const match = data.find(r => String(r.FERT_PRINCIPAL || '').toLowerCase().includes(term));

                if (match) {
                    setFoundInScan(true);
                    setAllData(data);
                    setRowsPerPage(scanRowsPerPage);
                    setCurrentPage(pageToScan);
                    if (columns.length === 0) setColumns(Object.keys(match));
                    addNotification('success', `¡Material encontrado! Ubicado en la página ${pageToScan} (Bloque de ${scanRowsPerPage} registros).`);
                    break;
                }

                pageToScan++;
                // Pequeña pausa para no saturar el hilo principal
                await new Promise(resolve => setTimeout(resolve, 50));
                
                if (pageToScan > maxPages) {
                    addNotification('error', 'Se alcanzó el límite de escaneo de 500 páginas sin resultados.');
                }
            }
        } catch (error) {
            console.error('Error en búsqueda profunda:', error);
            addNotification('error', 'El escaneo global ha fallado.');
        } finally {
            setIsDeepSearching(false);
        }
    };

    // Carga inicial y cuando cambia la página o el tamaño
    useEffect(() => {
        if (!isDeepSearching) {
            loadBlock(currentPage, rowsPerPage);
        }
    }, [currentPage, rowsPerPage]);

    const totalPages = Math.max(1, Math.ceil(totalRecords / rowsPerPage));

    const handlePageChange = (page: number) => {
        setCurrentPage(Math.max(1, Math.min(page, totalPages)));
    };

    const handleRowsPerPageChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
        setRowsPerPage(Number(e.target.value));
        setCurrentPage(1);
    };

    // Sincronización de scrollbars
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
    }, [allData]);

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

    // Filtrado local (sobre lo que está en memoria)
    const filteredRows = useMemo(() => {
        if (!searchTerm.trim()) return allData;
        const term = searchTerm.toLowerCase();
        return allData.filter(r => 
            String(r.FERT_PRINCIPAL || '').toLowerCase().includes(term)
        );
    }, [allData, searchTerm]);

    return (
        <div className="space-y-4">
            <div className="flex flex-col md:flex-row gap-4 items-center justify-between bg-white p-4 rounded-lg shadow-sm border">
                <div className="flex items-center gap-4 flex-1">
                  <div className="relative w-full md:w-80">
                      <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                      <Input 
                          placeholder="Buscar FERT_PRINCIPAL..." 
                          className="pl-10 h-10 border-indigo-200 focus:ring-indigo-500"
                          value={searchTerm}
                          onChange={(e) => setSearchTerm(e.target.value)}
                          onKeyDown={(e) => e.key === 'Enter' && handleDeepSearch()}
                      />
                  </div>
                  
                  <Button 
                    onClick={handleDeepSearch} 
                    disabled={isLoading || isDeepSearching}
                    className="bg-indigo-600 hover:bg-indigo-700 text-white gap-2 h-10 px-6 shadow-md transition-all active:scale-95"
                  >
                    {isDeepSearching ? (
                        <>
                            <Loader2 className="h-4 w-4 animate-spin" />
                            Escaneando Pág. {scanProgress}...
                        </>
                    ) : (
                        <>
                            <Search className="h-4 w-4" />
                            Buscar en Todo el Maestro
                        </>
                    )}
                  </Button>

                  {isDeepSearching && (
                      <div className="flex items-center gap-2 text-xs text-indigo-600 font-medium animate-pulse">
                          <PlayCircle className="h-3 w-3" />
                          Escaneando bloques de 500 registros...
                      </div>
                  )}

                  {foundInScan && !isDeepSearching && (
                      <Badge className="bg-emerald-100 text-emerald-700 border-emerald-200 flex gap-1 items-center">
                          <CheckCircle2 className="h-3 w-3" />
                          Resultado encontrado en Pág. {currentPage}
                      </Badge>
                  )}
                </div>
            </div>

            <div className="bg-indigo-50 border border-indigo-100 p-2 px-4 rounded-md flex items-center gap-3">
                <AlertCircle className="h-4 w-4 text-indigo-500" />
                <p className="text-[11px] text-indigo-700">
                    <strong>Nota:</strong> Los materiales de Muebles y Planchas están distribuidos en miles de registros. Usa <strong>"Buscar en Todo el Maestro"</strong> para que el sistema localice automáticamente la página correcta.
                </p>
            </div>

            {allData.length > 0 ? (
                <>
                    <div ref={topScrollRef} onScroll={handleTopScroll} className="overflow-x-auto overflow-y-hidden h-[18px]">
                        <div style={{ width: `${tableWidth}px`, height: '1px' }}></div>
                    </div>

                    <div ref={tableScrollRef} onScroll={handleTableScroll} className="border rounded-lg overflow-auto max-h-[60vh] shadow-inner bg-white">
                        <table ref={tableRef} className="min-w-full text-[11px] border-collapse">
                            <thead className="bg-gray-100 sticky top-0 z-10 shadow-sm">
                                <tr className="border-b-2 border-gray-300">
                                    {columns.map(col => (
                                        <TableHead key={col} className="text-center font-bold text-gray-700 uppercase tracking-wider px-4 py-2 border-r border-dashed border-gray-300 last:border-r-0 whitespace-nowrap">
                                            {col}
                                        </TableHead>
                                    ))}
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-100">
                                {filteredRows.map((row, idx) => (
                                    <tr key={idx} className="hover:bg-indigo-50/40 transition-colors">
                                        {columns.map((col, cIdx) => (
                                          <TableCell key={`${idx}-${cIdx}`} className={cn(
                                              "px-4 py-2 text-center border-r border-dashed border-gray-200 last:border-r-0 whitespace-nowrap",
                                              col === 'FERT_PRINCIPAL' && "font-bold text-indigo-700 bg-indigo-50/20"
                                          )}>
                                              {String(row[col] ?? '-')}
                                          </TableCell>
                                        ))}
                                    </tr>
                                ))}
                                {filteredRows.length === 0 && (
                                    <tr>
                                        <td colSpan={columns.length} className="py-20 text-center text-gray-500 italic bg-gray-50">
                                            No se encontraron coincidencias para "{searchTerm}" en los datos cargados actualmente.
                                            <br />
                                            <Button variant="link" onClick={handleDeepSearch} className="text-indigo-600 mt-2">
                                                Haz clic aquí para buscar en todas las páginas de la base de datos
                                            </Button>
                                        </td>
                                    </tr>
                                )}
                            </tbody>
                        </table>
                    </div>

                    <div className="flex items-center justify-between mt-4 bg-white p-3 rounded-lg border shadow-sm">
                        <div className="flex items-center space-x-2">
                            <span className="text-xs text-gray-600">Filas por página:</span>
                            <select
                                value={rowsPerPage}
                                onChange={handleRowsPerPageChange}
                                className="px-3 py-1.5 border rounded-md text-xs bg-white focus:ring-indigo-500"
                            >
                                {ROWS_PER_PAGE_OPTIONS.map(size => <option key={size} value={size}>{size}</option>)}
                            </select>
                        </div>
                        <div className="flex items-center space-x-2">
                            <span className="text-xs text-gray-600 font-medium">
                                Página <strong className="text-indigo-700">{currentPage}</strong> de {totalPages} ({totalRecords.toLocaleString()} registros totales)
                            </span>
                            <div className="flex gap-1 ml-4">
                                <Button variant="outline" size="sm" className="h-8" onClick={() => handlePageChange(1)} disabled={currentPage === 1 || isLoading || isDeepSearching}>Primera</Button>
                                <Button variant="outline" size="sm" className="h-8" onClick={() => handlePageChange(currentPage - 1)} disabled={currentPage === 1 || isLoading || isDeepSearching}>Ant.</Button>
                                <Button variant="outline" size="sm" className="h-8" onClick={() => handlePageChange(currentPage + 1)} disabled={currentPage >= totalPages || isLoading || isDeepSearching}>Sig.</Button>
                                <Button variant="outline" size="sm" className="h-8" onClick={() => handlePageChange(totalPages)} disabled={currentPage >= totalPages || isLoading || isDeepSearching}>Última</Button>
                            </div>
                        </div>
                    </div>
                </>
            ) : (
                <div className="flex flex-col items-center justify-center py-20 bg-white border-2 border-dashed rounded-xl shadow-sm">
                    {isLoading || isDeepSearching ? (
                        <>
                            <div className="relative">
                                <Loader2 className="w-12 h-12 animate-spin text-indigo-500 mb-4" />
                                {isDeepSearching && (
                                    <span className="absolute inset-0 flex items-center justify-center text-[10px] font-bold text-indigo-700 mt-[-15px]">
                                        {scanProgress}
                                    </span>
                                )}
                            </div>
                            <p className="text-indigo-800 font-semibold text-sm">
                                {isDeepSearching ? `Escaneando página ${scanProgress}...` : 'Consultando base de datos...'}
                            </p>
                            <p className="text-gray-400 text-xs mt-2">Esto puede tomar unos segundos debido al volumen de datos.</p>
                        </>
                    ) : (
                        <>
                            <Database className="w-12 h-12 text-gray-300 mb-4" />
                            <p className="text-gray-500 text-sm">No se han cargado registros.</p>
                            <Button onClick={() => loadBlock(1, rowsPerPage)} variant="outline" className="mt-4 border-indigo-200 text-indigo-600">
                                Cargar Datos Iniciales
                            </Button>
                        </>
                    )}
                </div>
            )}
        </div>
    );
};