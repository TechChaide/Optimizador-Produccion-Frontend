'use client';

import React, { useState, useEffect, useMemo, useRef } from 'react';
import { serviciosService } from '@/services/servicios.service';
import { useAppContext } from '@/context/AppProvider';
import { Package, Loader2 } from 'lucide-react';
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

interface CuboInventariosItem {
  [key: string]: any;
}

const ROWS_PER_PAGE_OPTIONS = [20, 50, 100, 200];

// Listado oficial de Cascos proporcionado por el usuario
const CASCOS_ORDEN = [
  "40002023", "40003063", "40003064", "40003065", "40003066", "40000958", "40000959", "40000941", 
  "40001871", "40001872", "40002044", "40001895", "40001873", "40001874", "40002944", "40002942", 
  "40002946", "40002945", "40002943", "40002947", "40002859", "40002860", "40002861", "40002862", 
  "40003067", "40003068", "40003069", "40003070", "40001204", "40001205", "40001206", "40001296", 
  "40001605", "40001606", "40001607", "40001794", "40001742", "40001743", "40001744", "40001915", 
  "40002747", "40002748", "40002749", "40002750", "40002752", "40001608", "40000021", "40000022", 
  "40000023", "40001381", "40001415", "40001844", "40002022", "40002011", "40001163", "40000982", 
  "40000050", "40003075", "40002857", "40001722", "40002962", "40002173", "40000822", "40001798", 
  "40003076", "40003142", "40003143", "40003144", "40003145", "40003183", "40003212", "40003252", 
  "40003332", "40003333", "40003334", "40003265"
];

const normalizeMaterialCode = (code: string | number): string => {
  const codeStr = String(code).trim();
  return codeStr.slice(-8);
};

export const CuboInventariosTab: React.FC = () => {
    const { addNotification } = useAppContext();
    const [allData, setAllData] = useState<CuboInventariosItem[]>([]);
    const [isLoading, setIsLoading] = useState(false);
    const [columns, setColumns] = useState<string[]>([]);
    const [currentPage, setCurrentPage] = useState(1);
    const [rowsPerPage, setRowsPerPage] = useState(ROWS_PER_PAGE_OPTIONS[0]);

    // Refs and state for double scrollbar
    const topScrollRef = useRef<HTMLDivElement>(null);
    const tableScrollRef = useRef<HTMLDivElement>(null);
    const tableRef = useRef<HTMLTableElement>(null);
    const [tableWidth, setTableWidth] = useState(0);
    const lastScrolledRef = useRef<'top' | 'table' | null>(null);

    useEffect(() => {
        const fetchAllInventario = async () => {
            setIsLoading(true);
            try {
                // 1. Exploratory call to get total records
                const exploreResponse = await serviciosService.getCuboInventarios(1, 1);
                const totalRecords = exploreResponse.totalRegistros || 0;

                if (totalRecords === 0) {
                    setAllData([]);
                    addNotification('info', 'No se encontraron datos en Cubo de Inventarios.');
                    setIsLoading(false);
                    return;
                }
                
                // 2. Fetch all data in batches
                const BATCH_SIZE = 10000;
                const totalPagesToFetch = Math.ceil(totalRecords / BATCH_SIZE);
                let fetchedData: CuboInventariosItem[] = [];

                for (let i = 1; i <= totalPagesToFetch; i++) {
                    const pageResponse = await serviciosService.getCuboInventarios(i, BATCH_SIZE);
                    if (pageResponse.data && Array.isArray(pageResponse.data)) {
                        fetchedData = fetchedData.concat(pageResponse.data);
                    }
                }

                setAllData(fetchedData);

                if (fetchedData.length > 0 && columns.length === 0) {
                    let originalColumns = Object.keys(fetchedData[0]);
                    
                    // Columnas a excluir solicitadas por el usuario
                    const columnsToExclude = [
                        'Etiqueta', 'Sector', 'TipoMaterial', 'Estrategia', 
                        'PaisOrigen', 'Categoria', 'HojaRuta', 'TamLoteMin', 'TamLoteMax'
                    ];

                    let filteredColumns = originalColumns.filter(col => !columnsToExclude.includes(col));

                    const stockActualCol = 'StockActual';
                    const descripcionCol = 'Descripcion';
                    const peticionBorradoCol = 'PeticionBorrado';

                    // Reorganize columns for better visibility
                    const stockActualIndex = filteredColumns.indexOf(stockActualCol);
                    if (stockActualIndex > -1) {
                        filteredColumns.splice(stockActualIndex, 1);
                    }

                    const descripcionIndex = filteredColumns.indexOf(descripcionCol);
                    const targetIndex = descripcionIndex !== -1 ? descripcionIndex + 1 : 2;
                    filteredColumns.splice(targetIndex, 0, stockActualCol);
                    
                    // Move PeticionBorrado to the end
                    const peticionIndex = filteredColumns.indexOf(peticionBorradoCol);
                    if (peticionIndex > -1) {
                        filteredColumns.splice(peticionIndex, 1);
                        filteredColumns.push(peticionBorradoCol);
                    }
                    
                    setColumns(filteredColumns);
                }

            } catch (error) {
                addNotification('error', `Error al cargar datos de inventario: ${(error as Error).message}`);
                setAllData([]);
            } finally {
                setIsLoading(false);
            }
        };

        fetchAllInventario();
    }, [addNotification, columns.length]);

    // Filtrado y Ordenamiento según el listado oficial de CASCOS
    const filteredData = useMemo(() => {
        if (!allData || allData.length === 0) return [];
        
        const cascosSet = new Set(CASCOS_ORDEN);
        
        // 1. Filtrar solo los materiales que están en la lista oficial
        const results = allData.filter(row => {
          const normalized = normalizeMaterialCode(row.Material);
          return cascosSet.has(normalized);
        });

        // 2. Ordenar basándose en el índice de la lista CASCOS_ORDEN
        return results.sort((a, b) => {
            const indexA = CASCOS_ORDEN.indexOf(normalizeMaterialCode(a.Material));
            const indexB = CASCOS_ORDEN.indexOf(normalizeMaterialCode(b.Material));
            return indexA - indexB;
        });
    }, [allData]);

    const totalRecords = filteredData.length;
    const totalPages = totalRecords > 0 ? Math.ceil(totalRecords / rowsPerPage) : 1;

    const displayedData = useMemo(() => {
        const start = (currentPage - 1) * rowsPerPage;
        return filteredData.slice(start, start + rowsPerPage);
    }, [filteredData, currentPage, rowsPerPage]);

    const goToPage = (page: number) => {
        setCurrentPage(Math.max(1, Math.min(page, totalPages)));
    };

    const handleRowsPerPageChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
        setRowsPerPage(Number(e.target.value));
        setCurrentPage(1);
    };

    // Double scrollbar logic
    useEffect(() => {
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
    }, [displayedData]);

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

    if (isLoading && allData.length === 0) {
        return (
            <div className="flex justify-center items-center py-8">
                <Loader2 className="w-8 h-8 animate-spin text-indigo-500" />
                <span className="ml-3 text-gray-600">Cargando Inventario...</span>
            </div>
        );
    }

    if (!isLoading && allData.length === 0) {
        return (
            <div className="flex flex-col items-center justify-center py-12 text-gray-500">
              <Package className="w-12 h-12 mb-4 text-gray-300" />
              <p>No hay datos de inventario para mostrar.</p>
            </div>
        );
    }
    
    return (
        <div className="space-y-4">
             <div className="bg-indigo-50 border border-indigo-200 p-3 rounded-md mb-2">
               <p className="text-xs text-indigo-800">
                 Mostrando información filtrada y ordenada según el listado oficial de <strong>{CASCOS_ORDEN.length} cascos</strong>.
               </p>
             </div>

             {/* Top Scrollbar */}
             <div ref={topScrollRef} onScroll={handleTopScroll} className="overflow-x-auto overflow-y-hidden" style={{ height: '18px' }}>
                <div style={{ width: `${tableWidth}px`, height: '1px' }}></div>
            </div>
             <div ref={tableScrollRef} onScroll={handleTableScroll} className="border rounded-lg overflow-auto max-h-[60vh]">
                 <table ref={tableRef} className="min-w-full text-xs border-collapse">
                     <TableHeader className="bg-gray-100 sticky top-0 z-10">
                         <TableRow className="border-b-2 border-gray-300">
                             {columns.map((col, index) => (
                               <TableHead 
                                 key={col} 
                                 className={cn(
                                   "text-center border-r border-dashed border-gray-300 font-bold text-gray-700 uppercase tracking-wider",
                                   col === 'Descripcion' && 'min-w-[382px]',
                                   index === columns.length - 1 && "border-r-0"
                                 )}
                               >
                                 {col}
                               </TableHead>
                             ))}
                         </TableRow>
                     </TableHeader>
                     <TableBody>
                        {displayedData.map((row, idx) => (
                           <TableRow key={idx} className="hover:bg-gray-50 border-b border-dashed border-gray-200">
                                {columns.map((col, colIndex) => {
                                    let displayValue = String(row[col] ?? '-');
                                    if (col === 'Material') {
                                        displayValue = normalizeMaterialCode(displayValue);
                                    }
                                    return (
                                        <TableCell 
                                            key={`${idx}-${col}`} 
                                            className={cn(
                                                "text-center border-r border-dashed border-gray-200",
                                                col === 'Material' && 'font-mono font-bold text-indigo-700',
                                                col === 'Descripcion' && 'min-w-[382px] whitespace-nowrap',
                                                colIndex === columns.length - 1 && "border-r-0"
                                            )}
                                        >
                                          {displayValue}
                                        </TableCell>
                                    );
                                })}
                           </TableRow>
                        ))}
                     </TableBody>
                 </table>
            </div>
            {/* Pagination Controls */}
            <div className="flex items-center justify-between mt-4">
                <div className="flex items-center space-x-2">
                    <span className="text-sm text-gray-600">Filas por página:</span>
                    <select
                        value={rowsPerPage}
                        onChange={handleRowsPerPageChange}
                        className="px-3 py-2 border border-gray-300 rounded-md text-sm"
                    >
                        {ROWS_PER_PAGE_OPTIONS.map(size => <option key={size} value={size}>{size}</option>)}
                    </select>
                </div>
                <div className="flex items-center space-x-2">
                     <span className="text-sm text-gray-600">Página {currentPage} de {totalPages} ({totalRecords} registros)</span>
                     <Button variant="outline" size="sm" onClick={() => goToPage(1)} disabled={currentPage === 1}>Primera</Button>
                     <Button variant="outline" size="sm" onClick={() => goToPage(currentPage - 1)} disabled={currentPage === 1}>Anterior</Button>
                     <Button variant="outline" size="sm" onClick={() => goToPage(currentPage + 1)} disabled={currentPage >= totalPages}>Siguiente</Button>
                     <Button variant="outline" size="sm" onClick={() => goToPage(totalPages)} disabled={currentPage >= totalPages}>Última</Button>
                </div>
           </div>
        </div>
    );
};