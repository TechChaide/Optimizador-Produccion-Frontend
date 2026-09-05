
'use client';

import React, { useState, useMemo, useEffect, memo, useCallback } from 'react';
import { MONTH_NAMES, MONTH_NUMBERS } from './constants';
import { safeNumber, normalizeMaterialCode } from './utils';
import { TiempoCanonResult, ViableTransfer } from './types';
import { Badge } from '@/components/ui/badge';
import { Search, ChevronLeft, ChevronRight, ChevronsLeft, ChevronsRight } from 'lucide-react';

interface BacklogProgressiveSectionProps {
  data: any[];
  tiemposCanon: TiempoCanonResult[];
  centro: string;
  titulo: string;
  numMaximoSabados: number;
  maxExtrasHoras: number;
  horasExtrasFin: number;
  trasladosViables?: ViableTransfer[];
}

// Componente de fila memoizado para optimizar el rendimiento
const BacklogDataRow = memo(({ r, isMounted, format, centro }: { r: any, isMounted: boolean, format: (v: number, d?: number) => string, centro: string }) => {
  return (
    <tr className="hover:bg-gray-50 transition-colors">
      <td className="px-2 py-2 font-bold text-gray-700">{r.mesNombre}</td>
      <td className="px-2 py-2 text-center">{r.ClaseAprovisionam}</td>
      <td className="px-2 py-2 font-mono">{r.CodMaterial}</td>
      <td className="px-2 py-2 truncate border-r max-w-[200px]" title={r.Descripcion}>{r.Descripcion}</td>
      
      <td className="px-2 py-2 text-right font-mono text-blue-600">{format(r._stockInitial)}</td>
      <td className={`px-2 py-2 text-right font-mono border-r ${centro === '1000' ? 'text-orange-600' : 'text-blue-600'}`}>
        {centro === '1000' && r._traslado > 0 ? '-' : ''}{format(r._traslado)}
      </td>
      
      <td className="px-2 py-2 text-right font-mono text-green-600">{format(r._prodMC)}</td>
      <td className="px-2 py-2 text-right font-mono text-green-700 font-bold bg-green-50">{format(r._prodBL)}</td>
      <td className="px-2 py-2 text-right font-mono text-green-800 font-bold border-r">{format(r._viableTotal)}</td>
      
      <td className="px-2 py-2 text-right font-mono text-purple-600 font-bold">{format(r._dispatchSales)}</td>
      <td className="px-2 py-2 text-right font-mono text-purple-600 border-r">{format(r._dispatchBL)}</td>
      
      <td className="px-2 py-2 text-right font-mono text-red-500 font-bold">{format(r._backlogMC)}</td>
      <td className={`px-2 py-2 text-right font-mono font-bold border-r ${r._backlogAcum > 0 ? 'text-red-700 bg-red-50' : 'text-gray-400'}`}>{format(r._backlogAcum)}</td>
      
      <td className={`px-2 py-2 text-right font-mono font-bold ${r._saldoFinal > 0 ? 'text-emerald-700 bg-emerald-50' : 'text-gray-400'}`}>{format(r._saldoFinal)}</td>
    </tr>
  );
});
BacklogDataRow.displayName = 'BacklogDataRow';

export const BacklogProgressiveSection: React.FC<BacklogProgressiveSectionProps> = ({
  data,
  tiemposCanon,
  centro,
  titulo,
  numMaximoSabados,
  maxExtrasHoras,
  horasExtrasFin,
  trasladosViables = []
}) => {
  const [isMounted, setIsMounted] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedMes, setSelectedMes] = useState('');
  const [selectedSector, setSelectedSector] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 50;

  useEffect(() => setIsMounted(true), []);

  const getMesNumerico = (mesRaw: any): number => {
    if (!mesRaw) return 0;
    const val = String(mesRaw).trim();
    const asNum = parseInt(val);
    if (!isNaN(asNum) && asNum >= 1 && asNum <= 12) return asNum;
    return MONTH_NUMBERS[val as keyof typeof MONTH_NUMBERS] || 0;
  };

  const allSimulationResults = useMemo(() => {
    if (!data || data.length === 0) return [];

    const timeline = Array.from(new Set(data.map(r => {
      const year = safeNumber(r.Año || r.año || new Date().getFullYear());
      const mesNum = getMesNumerico(r.mesRef || r.Mes);
      // Usar base 0 para evitar error en Diciembre (mes 12 % 12 = 0)
      return (year * 12) + (mesNum - 1);
    }))).sort((a, b) => a - b);

    const tcMap = new Map<string, TiempoCanonResult>();
    tiemposCanon.forEach(tc => {
      tcMap.set(String(tc.mesNumero), tc);
      tcMap.set(tc.mes, tc);
    });

    const stockTracker = new Map<string, number>(); 
    const backlogBag = new Map<string, number>();   
    const todasLasFilas: any[] = [];

    for (const tKey of timeline) {
      const year = Math.floor(tKey / 12);
      const mesNum = (tKey % 12) + 1;
      const mesKey = String(mesNum);
      
      const tc = tcMap.get(mesKey);
      if (!tc) continue;

      const filasMes = data.filter(r => {
        const rYear = safeNumber(r.Año || r.año || new Date().getFullYear());
        const rMes = getMesNumerico(r.mesRef || r.Mes);
        return rYear === year && rMes === mesNum;
      });

      const idleTimeByLine = new Map<string, number>();
      const timeUsedByLineMC = new Map<string, number>();
      const totalTimeByLine = new Map<string, number>();

      // Primero calcular tiempo base consumido en Jornada Normal/Extras/Sábados (del Resumen)
      filasMes.forEach(r => {
        const linea = String(r.lineaRef || r.LineaFabricacion || 'Sin línea');
        const tupp = safeNumber(r.tiempoUnitarioPorPuesto);
        const unitsProducedMC = safeNumber(r._prodViable || (safeNumber(r.necesidadMaximaProducirJornadaNormal) + 
                                safeNumber(r.necesidadMaximaProducirHorasExtras) + 
                                safeNumber(r.necesidadMaximaProducirSabados)));
        
        const timeMC = unitsProducedMC * tupp;
        timeUsedByLineMC.set(linea, (timeUsedByLineMC.get(linea) || 0) + timeMC);

        if (!totalTimeByLine.has(linea)) {
          const lineaNorm = String(linea).toLowerCase().replace(/\s+/g, '');
          const dp = tc.data.find((item: any) => {
            const nl = String(item?.nombre_linea ?? '').toLowerCase().replace(/\s+/g, '');
            return nl === lineaNorm || nl.includes(lineaNorm);
          });
          const total = safeNumber(dp?.minutos_horario_normal_TOTAL || 0) + 
                        ((tc.diasLaborables * maxExtrasHoras) * 60) + 
                        ((tc.diasSabados * horasExtrasFin) * 60);
          totalTimeByLine.set(linea, total);
        }
      });

      totalTimeByLine.forEach((total, linea) => {
        idleTimeByLine.set(linea, Math.max(0, total - (timeUsedByLineMC.get(linea) || 0)));
      });

      const procesadosMes = filasMes.map(r => {
        const code = normalizeMaterialCode(r.CodMaterial);
        const linea = String(r.lineaRef || r.LineaFabricacion || 'Sin línea');
        const tupp = safeNumber(r.tiempoUnitarioPorPuesto);
        const isC1000 = centro === '1000';
        
        // --- 1. DATOS BASE DEL RESUMEN (REQUERIMIENTO DEL USUARIO) ---
        // Usar los valores exactos calculados en el tab de Resumen
        const dispatchSales = safeNumber(r._demandaCubierta);
        const backlogMC = safeNumber(r._backlogVentas);
        const actualTransfer = isC1000 ? safeNumber(r._envioC2000) : safeNumber(r._trValorAMostrar);
        const prodMC = safeNumber(r._prodViable);
        
        // El stock inicial se arrastra de la simulación progresiva
        const initialStock = stockTracker.get(code) ?? safeNumber(r._stockInitial);
        const backlogAnterior = backlogBag.get(code) || 0;

        // --- 2. PRIORIDAD 2: RECUPERACIÓN DE DEUDA (PROGRESIVO) ---
        // Intentar pagar deuda antigua usando la capacidad libre calculada en el paso anterior
        let prodBL = 0;
        const clase = String(r.ClaseAprovisionam || '').trim().toUpperCase();
        const puedeFabricarAqui = isC1000 ? true : clase !== 'F';

        if (backlogAnterior > 0 && tupp > 0 && puedeFabricarAqui && (idleTimeByLine.get(linea) || 0) > 0) {
          const timeAvailable = idleTimeByLine.get(linea)!;
          const unitsPossible = Math.floor(timeAvailable / tupp);
          prodBL = Math.min(backlogAnterior, unitsPossible);
          idleTimeByLine.set(linea, timeAvailable - (prodBL * tupp));
        }

        // El saldo final "técnico" del mes antes de pagar deuda antigua
        const saldoFinalPreRecovery = safeNumber(r._saldoFinal);
        
        // Pagar deuda antigua con excedentes + producción extra
        const totalDisponibleParaBL = saldoFinalPreRecovery + prodBL;
        const dispatchBL = Math.min(backlogAnterior, totalDisponibleParaBL);
        
        const finalStock = Math.max(0, totalDisponibleParaBL - dispatchBL);
        
        // Backlog acumulado = Lo que quedaba - lo pagado hoy + lo que falló hoy
        const backlogAcumulado = Math.max(0, (backlogAnterior - dispatchBL) + backlogMC);
        
        // Si hay deuda acumulada, no puede sobrar producto
        const saldoFinalCorregido = backlogAcumulado > 0 ? 0 : finalStock;

        stockTracker.set(code, saldoFinalCorregido);
        backlogBag.set(code, backlogAcumulado);

        return {
          ...r,
          mesNombre: MONTH_NAMES[mesNum],
          _stockInitial: initialStock,
          _traslado: actualTransfer,
          _prodMC: prodMC,
          _prodBL: prodBL,
          _viableTotal: prodMC + prodBL,
          _dispatchSales: dispatchSales,
          _dispatchBL: dispatchBL,
          _backlogMC: backlogMC,
          _backlogAcum: backlogAcumulado,
          _saldoFinal: saldoFinalCorregido
        };
      });

      todasLasFilas.push(...procesadosMes);
    }

    return todasLasFilas;
  }, [data, tiemposCanon, centro, maxExtrasHoras, horasExtrasFin]);

  const sectoresUnicos = useMemo(() =>
    Array.from(new Set(allSimulationResults.map(r => String(r.Sector || '')).filter(s => s !== ''))).sort()
  , [allSimulationResults]);

  const filteredResults = useMemo(() => {
    let results = allSimulationResults;
    if (searchTerm.trim()) {
      const q = searchTerm.toLowerCase();
      results = results.filter(r =>
        String(r.CodMaterial).toLowerCase().includes(q) ||
        String(r.Descripcion).toLowerCase().includes(q)
      );
    }
    if (selectedMes) results = results.filter(r => r.mesNombre === selectedMes);
    if (selectedSector) results = results.filter(r => String(r.Sector || '') === selectedSector);
    return results;
  }, [allSimulationResults, searchTerm, selectedMes, selectedSector]);

  const totalPages = Math.max(1, Math.ceil(filteredResults.length / itemsPerPage));
  const paginatedResults = useMemo(() => {
    const start = (currentPage - 1) * itemsPerPage;
    return filteredResults.slice(start, start + itemsPerPage);
  }, [filteredResults, currentPage]);

  const totals = useMemo(() => {
    const res = { stockIni: 0, traslados: 0, prodMC: 0, prodBL: 0, viable: 0, dispMC: 0, dispBL: 0, blMC: 0, blAcum: 0, saldo: 0 };
    filteredResults.forEach(r => {
      res.stockIni += r._stockInitial;
      res.traslados += r._traslado;
      res.prodMC += r._prodMC;
      res.prodBL += r._prodBL;
      res.viable += r._viableTotal;
      res.dispMC += r._dispatchSales;
      res.dispBL += r._dispatchBL;
      res.blMC += r._backlogMC;
      res.blAcum += r._backlogAcum;
      res.saldo += r._saldoFinal;
    });
    return res;
  }, [filteredResults]);

  const format = useCallback((val: number, decimals: number = 0) => {
    if (!isMounted) return '';
    return val.toLocaleString(undefined, { minimumFractionDigits: decimals, maximumFractionDigits: decimals });
  }, [isMounted]);

  const uniqueMonths = useMemo(() => {
    return Array.from(new Set(allSimulationResults.map(r => r.mesNombre))).sort((a, b) => {
      const getNum = (name: string) => Object.entries(MONTH_NAMES).find(([_, v]) => v === name)?.[0] || '0';
      return parseInt(getNum(a)) - parseInt(getNum(b));
    });
  }, [allSimulationResults]);

  if (data.length === 0) {
    return <div className="p-8 text-center text-gray-500">No hay datos disponibles para simulación.</div>;
  }

  return (
    <div className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden">
      <div className="px-6 py-4 border-b border-gray-200 bg-gray-50 flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h3 className="text-lg font-bold text-gray-800 uppercase">{titulo}</h3>
          <p className="text-xs text-gray-500 mt-1">Simulación sincronizada con Resultados Consolidados del Resumen Mensual</p>
        </div>
        
        <div className="flex flex-wrap items-center gap-2 w-full md:w-auto">
          <div className="relative">
            <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-gray-400" />
            <input
              type="text"
              placeholder="Buscar material..."
              className="pl-9 pr-4 py-2 border rounded-md text-sm w-full md:w-64 focus:ring-2 focus:ring-blue-500 focus:outline-none"
              value={searchTerm}
              onChange={(e) => { setSearchTerm(e.target.value); setCurrentPage(1); }}
            />
          </div>
          
          <select
            className="px-3 py-2 border rounded-md text-sm bg-white focus:ring-2 focus:ring-blue-500 focus:outline-none"
            value={selectedMes}
            onChange={(e) => { setSelectedMes(e.target.value); setCurrentPage(1); }}
          >
            <option value="">Todos los meses</option>
            {uniqueMonths.map(m => <option key={m} value={m}>{m}</option>)}
          </select>

          <select
            className="px-3 py-2 border rounded-md text-sm bg-white focus:ring-2 focus:ring-blue-500 focus:outline-none"
            value={selectedSector}
            onChange={(e) => { setSelectedSector(e.target.value); setCurrentPage(1); }}
          >
            <option value="">Sector: Todos</option>
            {sectoresUnicos.map(s => <option key={s} value={s}>{s}</option>)}
          </select>

          <Badge variant="outline" className="bg-blue-50 text-blue-700 ml-auto md:ml-0">
            {filteredResults.length} Registros
          </Badge>
        </div>
      </div>

      <div className="overflow-x-auto max-h-[60vh] overflow-y-auto">
        <table className="w-full border-collapse">
          <thead className="sticky top-0 z-20 bg-gray-100 text-[10px] uppercase font-bold text-gray-600">
            <tr className="border-b border-300">
              <th colSpan={4} className="px-2 py-2 bg-gray-200 border-r">Producto</th>
              <th colSpan={2} className="px-2 py-2 bg-blue-50 text-blue-800 border-r">
                {centro === '1000' ? 'Existencias y Salidas' : 'Existencias y Entradas'}
              </th>
              <th colSpan={3} className="px-2 py-2 bg-green-50 text-green-800 border-r">Producción</th>
              <th colSpan={2} className="px-2 py-2 bg-purple-50 text-purple-800 border-r">Salidas Reales</th>
              <th colSpan={2} className="px-2 py-2 bg-red-50 text-red-800 border-r">Deuda (Backlog)</th>
              <th className="px-2 py-2 bg-emerald-50 text-emerald-800">Inventario</th>
            </tr>
            <tr className="bg-gray-50 border-b border-gray-200 text-center">
              <th className="px-2 py-1 text-left min-w-[80px]">Mes</th>
              <th className="px-2 py-1 min-w-[50px]">Clase</th>
              <th className="px-2 py-1 min-w-[90px]">Material</th>
              <th className="px-2 py-1 text-left min-w-[150px] border-r">Descripción</th>
              
              <th className="px-2 py-1 min-w-[80px] text-blue-700">Stock Ini</th>
              <th className={`px-2 py-1 min-w-[80px] border-r ${centro === '1000' ? 'text-orange-700' : 'text-blue-700'}`}>
                {centro === '1000' ? 'Traslado (Real)' : 'Traslados'}
              </th>
              
              <th className="px-2 py-1 min-w-[80px] text-green-700">Viable Base</th>
              <th className="px-2 py-1 min-w-[90px] text-green-700 bg-green-100/50">Prod. Recup. (BL)</th>
              <th className="px-2 py-1 min-w-[80px] text-green-800 font-bold border-r">Viable Total</th>
              
              <th className="px-2 py-1 min-w-[80px] text-purple-700">Despacho MC</th>
              <th className="px-2 py-1 min-w-[80px] text-purple-700 border-r">Despacho BL</th>
              
              <th className="px-2 py-1 min-w-[80px] text-red-700">Backlog MC</th>
              <th className="px-2 py-1 min-w-[90px] text-red-800 font-bold border-r">Backlog Acum</th>
              
              <th className="px-2 py-1 min-w-[90px] text-emerald-700">Saldo Final</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100 text-[11px]">
            {paginatedResults.map((r, idx) => (
              <BacklogDataRow 
                key={`${r.CodMaterial}-${r.mesNombre}-${idx}`} 
                r={r} 
                isMounted={isMounted} 
                format={format} 
                centro={centro}
              />
            ))}
          </tbody>
          <tfoot className="sticky bottom-0 z-20 bg-gray-800 text-white font-bold text-[10px]">
            <tr>
              <td colSpan={4} className="px-2 py-2 border-r border-gray-600">TOTALES FILTRADOS ({filteredResults.length} reg.)</td>
              <td className="px-2 py-2 text-right font-mono text-blue-300">{format(totals.stockIni)}</td>
              <td className={`px-2 py-2 text-right font-mono border-r border-gray-600 ${centro === '1000' ? 'text-orange-300' : 'text-blue-300'}`}>
                {centro === '1000' && totals.traslados > 0 ? '-' : ''}{format(totals.traslados)}
              </td>
              <td className="px-2 py-2 text-right font-mono text-green-300">{format(totals.prodMC)}</td>
              <td className="px-2 py-2 text-right font-mono text-green-400">{format(totals.prodBL)}</td>
              <td className="px-2 py-2 text-right font-mono text-green-300 border-r border-gray-600">{format(totals.viable)}</td>
              <td className="px-2 py-2 text-right font-mono text-purple-300">{format(totals.dispMC)}</td>
              <td className="px-2 py-2 text-right font-mono text-purple-300 border-r border-gray-600">{format(totals.dispBL)}</td>
              <td className="px-2 py-2 text-right font-mono text-red-300">{format(totals.blMC)}</td>
              <td className="px-2 py-2 text-right font-mono text-red-400 border-r border-gray-600">{format(totals.blAcum)}</td>
              <td className="px-2 py-2 text-right font-mono text-emerald-300">{format(totals.saldo)}</td>
            </tr>
          </tfoot>
        </table>
      </div>

      <div className="px-6 py-3 bg-gray-50 border-t border-gray-200 flex flex-col sm:flex-row justify-between items-center gap-4">
        <div className="text-sm text-gray-600">
          Mostrando <span className="font-semibold">{Math.min(filteredResults.length, (currentPage - 1) * itemsPerPage + 1)}</span> a <span className="font-semibold">{Math.min(filteredResults.length, currentPage * itemsPerPage)}</span> de <span className="font-semibold">{filteredResults.length}</span> registros
        </div>
        
        <div className="flex items-center gap-1">
          <button onClick={() => setCurrentPage(1)} disabled={currentPage === 1} className="p-2 rounded-md hover:bg-gray-200 disabled:opacity-30 transition-colors"><ChevronsLeft className="h-4 w-4" /></button>
          <button onClick={() => setCurrentPage(p => Math.max(1, p - 1))} disabled={currentPage === 1} className="p-2 rounded-md hover:bg-gray-200 disabled:opacity-30 transition-colors"><ChevronLeft className="h-4 w-4" /></button>
          <div className="flex items-center px-4 py-1 bg-white border rounded-md text-sm font-medium">Página {currentPage} de {totalPages}</div>
          <button onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))} disabled={currentPage === totalPages} className="p-2 rounded-md hover:bg-gray-200 disabled:opacity-30 transition-colors"><ChevronRight className="h-4 w-4" /></button>
          <button onClick={() => setCurrentPage(totalPages)} disabled={currentPage === totalPages} className="p-2 rounded-md hover:bg-gray-200 disabled:opacity-30 transition-colors"><ChevronsRight className="h-4 w-4" /></button>
        </div>
      </div>
    </div>
  );
};
