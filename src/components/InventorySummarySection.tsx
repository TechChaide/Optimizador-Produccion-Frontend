

'use client';

import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { logger } from '@/services/LogService';
import { queryApi } from '@/hooks/useApiData';
import { Package, Loader2 } from 'lucide-react';
import { useAppContext } from '@/context/AppProvider';

interface InventoryItem {
    Sector: string;
    Centro: string;
    StockActual: number;
}

interface SectorRow {
    sector: string;
    stockByCenter: { [center: string]: number };
    totalStock: number;
}

interface DisplayRow {
    type: 'data' | 'subtotal' | 'total';
    sector: string;
    stockByCenter: { [center: string]: number };
    totalStock: number;
}

export const InventorySummarySection: React.FC = () => {
    const { addNotification } = useAppContext();
        const [isProcessing, setIsProcessing] = useState<boolean>(true);
        const [allRows, setAllRows] = useState<SectorRow[]>([]);
        const [centers, setCenters] = useState<string[]>([]);
        const [error, setError] = useState<string | null>(null);

    const fetchInventorySummary = useCallback(async () => {
        setIsProcessing(true);
        setError(null);
        addNotification('info', `Consultando stock total por sector y centro desde CuboInventarios...`);

        try {
            const inventoryData: InventoryItem[] = await queryApi({
                source: 'CuboInventarios',
                operation: 'get_data',
                columns: ['Sector', 'Centro', 'StockActual'],
                pagination: { limit: 500000 }
            });
            
            if (inventoryData) {
                const totals: { [sector: string]: { stockByCenter: { [center: string]: number }, totalStock: number } } = {};
                const centerSet = new Set<string>();

                inventoryData.forEach(item => {
                    if (item.Sector && item.Centro && item.StockActual) {
                        const sector = item.Sector || 'Sin Sector';
                        const centro = String(item.Centro).trim();
                        centerSet.add(centro);

                        if (!totals[sector]) {
                            totals[sector] = { stockByCenter: {}, totalStock: 0 };
                        }
                        
                        totals[sector].stockByCenter[centro] = (totals[sector].stockByCenter[centro] || 0) + Number(item.StockActual);
                        totals[sector].totalStock += Number(item.StockActual);
                    }
                });
                
                const sortedCenters = Array.from(centerSet).sort();
                setCenters(sortedCenters);

                const sectorRows = Object.entries(totals).map(([sector, data]) => ({
                    sector,
                    ...data
                }));
                setAllRows(sectorRows);

                addNotification('success', `Resumen de inventario cargado correctamente.`);
            } else {
                 addNotification('warning', `La consulta a CuboInventarios no devolvió datos.`);
                 setAllRows([]);
                 setCenters([]);
            }

        } catch (err) {
            const errorMessage = `Error al consultar el resumen de inventario: ${(err as Error).message}`;
            setError(errorMessage);
            addNotification('error', errorMessage);
        } finally {
            setIsProcessing(false);
        }
    }, [addNotification]);
    
    useEffect(() => {
        fetchInventorySummary();
    }, [fetchInventorySummary]);
    
    const displayRows = useMemo(() => {
        if (allRows.length === 0) return [];
        
        const priorityOrder = ['01 COLCHONES', '02 BASES-CABECERO-CAMA', '03 MUEBLES FABRICACIÓN'];
        
        const prioritySectors: SectorRow[] = [];
        const otherSectors: SectorRow[] = [];

        allRows.forEach(row => {
            if (priorityOrder.includes(row.sector)) {
                prioritySectors.push(row);
            } else {
                otherSectors.push(row);
            }
        });
        
        prioritySectors.sort((a, b) => priorityOrder.indexOf(a.sector) - priorityOrder.indexOf(b.sector));
        otherSectors.sort((a, b) => a.sector.localeCompare(b.sector));
        
        const subtotalFabricacion: DisplayRow = {
            type: 'subtotal', sector: 'Subtotal Fabricación', stockByCenter: {}, totalStock: 0,
        };
        prioritySectors.forEach(pSector => {
            subtotalFabricacion.totalStock += pSector.totalStock;
            Object.entries(pSector.stockByCenter).forEach(([center, stock]) => {
                subtotalFabricacion.stockByCenter[center] = (subtotalFabricacion.stockByCenter[center] || 0) + stock;
            });
        });

        
        const subtotalOtros: DisplayRow = {
            type: 'subtotal', sector: 'Subtotal Otros', stockByCenter: {}, totalStock: 0,
        };
        otherSectors.forEach(oSector => {
            subtotalOtros.totalStock += oSector.totalStock;
            Object.entries(oSector.stockByCenter).forEach(([center, stock]) => {
                subtotalOtros.stockByCenter[center] = (subtotalOtros.stockByCenter[center] || 0) + stock;
            });
        });

        const priorityDisplayRows: DisplayRow[] = prioritySectors.map(s => ({...s, type: 'data'}));
        const otherDisplayRows: DisplayRow[] = otherSectors.map(s => ({...s, type: 'data'}));

        const finalRows: DisplayRow[] = [];
        if (priorityDisplayRows.length > 0) {
            finalRows.push(...priorityDisplayRows, subtotalFabricacion);
        }
        if (otherDisplayRows.length > 0) {
            finalRows.push(...otherDisplayRows, subtotalOtros);
        }

        return finalRows;

    }, [allRows]);
    
    const footerTotals = useMemo(() => {
        const grandTotal: DisplayRow = {
            type: 'total',
            sector: 'TOTAL GENERAL',
            stockByCenter: {},
            totalStock: 0,
        };
        allRows.forEach(row => {
            grandTotal.totalStock += row.totalStock;
            Object.entries(row.stockByCenter).forEach(([center, stock]) => {
                grandTotal.stockByCenter[center] = (grandTotal.stockByCenter[center] || 0) + stock;
            });
        });
        return grandTotal;
    }, [allRows]);


    return (
        <div className="p-6 md:p-8 space-y-6 bg-white shadow-lg rounded-xl m-4">
            <div className="flex items-center space-x-3">
                <Package />
                <h2 className="text-2xl font-semibold text-gray-700">Resumen de Inventario por Sector y Centro</h2>
            </div>
            
            <p className="text-gray-600">
                Este reporte muestra la suma total del campo `StockActual` agrupado por `Sector` y `Centro`, consultado directamente desde `CuboInventarios` sin filtros.
                Utilícelo para verificar el saldo inicial total del plan de producción.
            </p>

            <div className="border rounded-lg overflow-auto max-h-[70vh]">
                <table className="min-w-full text-sm divide-y divide-gray-200">
                    <thead className="bg-gray-100 sticky top-0 z-10">
                        <tr>
                            <th className="px-4 py-2 text-left font-semibold text-gray-600 uppercase tracking-wider sticky left-0 bg-gray-100">Sector</th>
                            {centers.map(center => (
                                <th key={center} className="px-4 py-2 text-right font-semibold text-gray-600 uppercase tracking-wider">{center}</th>
                            ))}
                            <th className="px-4 py-2 text-right font-semibold text-gray-600 uppercase tracking-wider sticky right-0 bg-gray-100">Total General</th>
                        </tr>
                    </thead>
                    <tbody className="bg-white divide-y divide-gray-200">
                        {isProcessing ? (
                            <tr>
                                <td colSpan={centers.length + 2} className="text-center p-8">
                                    <div className="flex justify-center items-center gap-2 text-gray-500">
                                        <Loader2 className="w-5 h-5 animate-spin" />
                                        <span>Consultando...</span>
                                    </div>
                                </td>
                            </tr>
                        ) : error ? (
                            <tr>
                                <td colSpan={centers.length + 2} className="text-center p-8 text-red-500">
                                    {error}
                                </td>
                            </tr>
                        ) : displayRows.length > 0 ? (
                            displayRows.map((row, index) => (
                                <tr key={row.sector + index} className={`group ${row.type === 'subtotal' ? 'bg-blue-50 font-bold' : 'hover:bg-gray-50'}`}>
                                    <td className={`px-4 py-2 whitespace-nowrap sticky left-0 group-hover:bg-gray-50 ${row.type === 'subtotal' ? 'bg-blue-50' : 'bg-white'}`}>{row.sector}</td>
                                    {centers.map(center => (
                                        <td key={center} className="px-4 py-2 whitespace-nowrap font-mono text-right text-gray-700">
                                            {Math.round(row.stockByCenter[center] || 0).toLocaleString()}
                                        </td>
                                    ))}
                                    <td className={`px-4 py-2 whitespace-nowrap font-mono text-right font-bold text-blue-800 sticky right-0 group-hover:bg-gray-50 ${row.type === 'subtotal' ? 'bg-blue-50' : 'bg-white'}`}>
                                        {Math.round(row.totalStock).toLocaleString()}
                                    </td>
                                </tr>
                            ))
                        ) : (
                             <tr>
                                <td colSpan={centers.length + 2} className="text-center p-8 text-gray-500">
                                    No se encontraron datos de inventario.
                                </td>
                            </tr>
                        )}
                    </tbody>
                     <tfoot className="bg-gray-800 text-white sticky bottom-0 z-10">
                        <tr>
                            <th className="px-4 py-2 text-left font-bold uppercase tracking-wider sticky left-0 bg-gray-800">{footerTotals.sector}</th>
                             {centers.map(center => (
                                <th key={`total-${center}`} className="px-4 py-2 text-right font-bold uppercase tracking-wider">
                                    {Math.round(footerTotals.stockByCenter[center] || 0).toLocaleString()}
                                </th>
                            ))}
                            <th className="px-4 py-2 text-right font-bold uppercase tracking-wider sticky right-0 bg-gray-800">
                                {Math.round(footerTotals.totalStock).toLocaleString()}
                            </th>
                        </tr>
                    </tfoot>
                </table>
            </div>
        </div>
    );
};

