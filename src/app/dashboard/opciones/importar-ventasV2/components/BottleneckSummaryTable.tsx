
'use client';

import React, { useState, useMemo, useEffect, useCallback, memo } from 'react';
import { MONTH_NAMES } from './constants';
import { safeNumber, exportToXLSX } from './utils';
import { TiempoCanonResult } from './types';

/** Referencia estable; `[]` en JSX crea un array nuevo cada render e invalida memos. */
export const EMPTY_SUMMARY_ENRICHED: any[] = [];

const BottleneckSummaryResumenRow = memo(function BottleneckSummaryResumenRow({
  resumen,
  format,
}: {
  resumen: Record<string, number | string>;
  format: (val: number, decimals?: number) => string;
}) {
  return (
    <tr className="hover:bg-blue-50/50 transition-colors">
      <td className="px-3 py-2 text-sm font-medium text-gray-900">{isNaN(parseInt(String(resumen.mes))) ? resumen.mes : MONTH_NAMES[parseInt(String(resumen.mes))] || resumen.mes}</td>
      <td className="px-3 py-2 text-sm text-gray-600">{String(resumen.respCtrlProd)}</td>
      <td className="px-3 py-2 text-sm font-medium text-gray-900">{String(resumen.linea)}</td>
      <td className="px-3 py-2 text-sm text-center font-mono text-gray-600">{String(resumen.diasLaborables)}</td>
      <td className="px-2 py-2 text-sm text-right font-mono text-indigo-700 font-semibold">{format(Number(resumen.necesidadTotal))}</td>
      <td className="px-2 py-2 text-sm text-right font-mono text-indigo-600">{format(Number(resumen.necesidadPromedioDiaria), 1)}</td>
      <td className="px-2 py-2 text-sm text-right font-mono text-purple-700 font-semibold">{format(Number(resumen.necesidadAFabricarTotal))}</td>
      <td className="px-2 py-2 text-sm text-right font-mono text-purple-600">{format(Number(resumen.necesidadAFabricarPromedioDiaria), 1)}</td>
      <td className="px-2 py-2 text-sm text-right font-mono text-blue-700 bg-blue-50/30">{format(Number(resumen.consumidoJN))}</td>
      <td className="px-2 py-2 text-sm text-right font-mono text-blue-600 bg-blue-50/30">{format(Number(resumen.consumidoJN) / 60, 2)}</td>
      <td className={`px-2 py-2 text-sm text-right font-mono font-semibold bg-blue-50/30 ${Number(resumen.libreJN) >= 0 ? 'text-emerald-600' : 'text-red-600'}`}>{format(Number(resumen.libreJN))}</td>
      <td className={`px-2 py-2 text-sm text-right font-mono font-semibold bg-blue-50/30 ${Number(resumen.libreJN) >= 0 ? 'text-emerald-600' : 'text-red-600'}`}>{format(Number(resumen.libreJN) / 60, 2)}</td>
      <td className="px-2 py-2 text-sm text-right font-mono text-amber-700 bg-amber-50/30">{Number(resumen.consumidoHE) > 0 ? format(Number(resumen.consumidoHE)) : '—'}</td>
      <td className="px-2 py-2 text-sm text-right font-mono text-amber-600 bg-amber-50/30">{Number(resumen.consumidoHE) > 0 ? format(Number(resumen.consumidoHE) / 60, 2) : '—'}</td>
      <td className={`px-2 py-2 text-sm text-right font-mono font-semibold bg-amber-50/30 ${Number(resumen.libreHE) >= 0 ? 'text-emerald-600' : 'text-red-600'}`}>{format(Number(resumen.libreHE))}</td>
      <td className={`px-2 py-2 text-right font-mono font-semibold bg-amber-50/30 ${Number(resumen.libreHE) >= 0 ? 'text-emerald-600' : 'text-red-600'}`}>{format(Number(resumen.libreHE) / 60, 2)}</td>
      <td className="px-2 py-2 text-sm text-right font-mono text-violet-700 bg-violet-50/30">{Number(resumen.consumidoSAB) > 0 ? format(Number(resumen.consumidoSAB)) : '—'}</td>
      <td className="px-2 py-2 text-sm text-right font-mono text-violet-600 bg-violet-50/30">{Number(resumen.consumidoSAB) > 0 ? format(Number(resumen.consumidoSAB) / 60, 2) : '—'}</td>
      <td className={`px-2 py-2 text-sm text-right font-mono font-semibold bg-violet-50/30 ${Number(resumen.libreSAB) >= 0 ? 'text-emerald-600' : 'text-red-600'}`}>{format(Number(resumen.libreSAB))}</td>
      <td className={`px-2 py-2 text-sm text-right font-mono font-semibold bg-violet-50/30 ${Number(resumen.libreSAB) >= 0 ? 'text-emerald-600' : 'text-red-600'}`}>{format(Number(resumen.libreSAB) / 60, 2)}</td>
      <td className="px-2 py-2 text-sm text-right font-mono text-gray-700">{format(Number(resumen.horasPromedioPorDia), 2)}</td>
    </tr>
  );
});
BottleneckSummaryResumenRow.displayName = 'BottleneckSummaryResumenRow';

interface BottleneckSummaryTableProps {
  datosEnriquecidosE: any[];
  datosEnriquecidosX: any[];
  datosCalculados?: any[];
  tiemposCanon: TiempoCanonResult[];
  numMaximoSabados: number;
  maxExtrasHoras: number;
  horasTrabajo: number;
  horasExtrasFin: number;
  centroLabel?: string;
  isCentro1000?: boolean;
  showSaldos?: boolean;
}

export const BottleneckSummaryTable: React.FC<BottleneckSummaryTableProps> = ({ 
  datosEnriquecidosE, 
  datosEnriquecidosX,
  datosCalculados,
  tiemposCanon, 
  numMaximoSabados, 
  maxExtrasHoras, 
  horasTrabajo, 
  horasExtrasFin,
  centroLabel = 'Centro 2000',
  isCentro1000 = false,
  showSaldos = false
}) => {
  const [selectedLinea, setSelectedLinea] = useState<string>('');
  const [selectedRespCtrlProd, setSelectedRespCtrlProd] = useState<string>('');
  const [selectedMes, setSelectedMes] = useState<string>('');
  const [selectedSector, setSelectedSector] = useState<string>('');
  const [isMounted, setIsMounted] = useState(false);

  useEffect(() => setIsMounted(true), []);

  const buscarTiempoCanonPorMesSummary = (mesRaw: string) => {
    let found = tiemposCanon.find(t => t.mes === mesRaw);
    if (found) return found;
    const mesNum = parseInt(mesRaw);
    if (!isNaN(mesNum) && mesNum >= 1 && mesNum <= 12) {
      const mesNombre = MONTH_NAMES[mesNum];
      found = tiemposCanon.find(t => t.mes === mesNombre);
      if (found) return found;
      found = tiemposCanon.find(t => t.mesNumero === mesNum);
      if (found) return found;
    }
    return null;
  };

  const filas = useMemo(() => {
    if (datosCalculados && datosCalculados.length > 0) return datosCalculados;
    return [...datosEnriquecidosE, ...datosEnriquecidosX];
  }, [datosCalculados, datosEnriquecidosE, datosEnriquecidosX]);

  const usaDatosCalc = !!(datosCalculados && datosCalculados.length > 0);

  const sectoresUnicos = useMemo(() =>
    Array.from(new Set(filas.map(r => String(r.Sector || '')).filter(s => s !== ''))).sort()
  , [filas]);

  const mesesUnicosOptions = useMemo(() => {
    const map = new Map<number, string>();
    filas.forEach(r => {
      const mes = String(r.mesRef || r.Mes || '');
      const num = parseInt(mes);
      if (!isNaN(num) && num >= 1 && num <= 12) map.set(num, MONTH_NAMES[num] || mes);
    });
    return Array.from(map.entries()).sort((a, b) => a[0] - b[0]).map(([num, label]) => ({ value: String(num), label }));
  }, [filas]);

  const resumenArray = useMemo(() => {
    const filasParaResumen = selectedSector
      ? filas.filter(r => String(r.Sector || '') === selectedSector)
      : filas;

    const resumenPorLinea: { [key: string]: any } = {};

    filasParaResumen.forEach(row => {
      const mes = String(row.mesRef || row.Mes || 'Sin mes');
      const linea = String(row.lineaRef || row.LineaFabricacion || 'Sin línea');
      const key = `${mes}|${linea}`;

      if (!resumenPorLinea[key]) {
        const tiempoCanonMes = buscarTiempoCanonPorMesSummary(mes);
        const diasSabados = tiempoCanonMes?.diasSabados ?? 0;
        const diasLaborables = tiempoCanonMes?.diasLaborables ?? 0;

        let tiempoCanonicoInicial = 0;
        let minutosConExtras = 0;
        let minutosFinSemana = 0;
        let puestoSeleccionado = 'Sin puesto';

        if (tiempoCanonMes?.data && Array.isArray(tiempoCanonMes.data)) {
          const lineaNorm = String(linea).toLowerCase().replace(/\s+/g, '');
          const registrosLinea = tiempoCanonMes.data.filter((item: any) => {
            const nl = String(item?.nombre_linea ?? '').toLowerCase().replace(/\s+/g, '');
            return nl === lineaNorm || nl.includes(lineaNorm);
          });
          const datoPuesto = registrosLinea[0] || tiempoCanonMes.data[0];
          if (datoPuesto) {
            tiempoCanonicoInicial = safeNumber(datoPuesto?.minutos_horario_normal_TOTAL ?? 0);
            minutosConExtras = safeNumber(datoPuesto?.minutos_extras_TOTAL ?? 0);
            minutosFinSemana = safeNumber(datoPuesto?.minutos_sabado_TOTAL ?? 0);
            puestoSeleccionado = String(datoPuesto?.nombre_estacion ?? 'Sin puesto');
          }
        }

        const poolHE = Math.max(0, minutosConExtras - tiempoCanonicoInicial);

        resumenPorLinea[key] = {
          linea, mes,
          diasSabados, diasLaborables,
          numeroSemanas: Math.ceil((diasLaborables + diasSabados) / 7),
          horasPromedioPorDia: 0,
          mesNumero: tiempoCanonMes?.mesNumero ?? 0,
          dispJN: tiempoCanonicoInicial,
          dispHE: poolHE,
          dispSAB: minutosFinSemana,
          consumidoJN: 0, consumidoHE: 0, consumidoSAB: 0,
          libreJN: 0, libreHE: 0, libreSAB: 0,
          respCtrlProd: String(row.NombRespControlProd || row.RespCtrlProd || 'Sin responsable'),
          necesidadTotal: 0, necesidadPromedioDiaria: 0,
          necesidadAFabricarTotal: 0, necesidadAFabricarPromedioDiaria: 0,
          envioC2000Total: 0, quedaC1000Total: 0,
          puestoSeleccionado
        };
      }

      const r = resumenPorLinea[key];

      if (usaDatosCalc) {
        const tupp = safeNumber(row.tiempoUnitarioPorPuesto ?? 0);
        r.necesidadTotal += safeNumber(row._necesidad ?? 0);
        r.necesidadAFabricarTotal += safeNumber(row._prodViable ?? 0);
        r.envioC2000Total += safeNumber(row._envioC2000 ?? 0);
        r.quedaC1000Total += safeNumber(row._quedaC1000 ?? 0);
        r.consumidoJN  += safeNumber(row.necesidadMaximaProducirJornadaNormal ?? 0) * tupp;
        r.consumidoHE  += safeNumber(row.necesidadMaximaProducirHorasExtras ?? 0) * tupp;
        r.consumidoSAB += safeNumber(row.necesidadMaximaProducirSabados ?? 0) * tupp;
      } else {
        const necesidad = safeNumber(row.necesidadTotal ?? (safeNumber(row.UnidadesProyectado ?? 0) - safeNumber(row.StockActual ?? 0) + safeNumber(row.StockSeguridad ?? 0)));
        const tupp = safeNumber(row.TiempoPorUnidad ?? 0) / Math.max(1, safeNumber(row.NumeroPuestos ?? row.numero_puestos ?? 1));
        r.necesidadTotal += necesidad;
        r.necesidadAFabricarTotal += safeNumber(row.necesidadMaximaAFabricar ?? 0);
        r.consumidoJN += tupp * necesidad;
      }
    });

    Object.values(resumenPorLinea).forEach(resumen => {
      resumen.libreJN  = resumen.dispJN  - resumen.consumidoJN;
      resumen.libreHE  = resumen.dispHE  - resumen.consumidoHE;
      resumen.libreSAB = resumen.dispSAB - resumen.consumidoSAB;
      const totalConsumed = resumen.consumidoJN + resumen.consumidoHE + resumen.consumidoSAB;
      resumen.horasPromedioPorDia = resumen.diasLaborables > 0 ? (totalConsumed / 60) / resumen.diasLaborables : 0;
      resumen.necesidadPromedioDiaria = resumen.diasLaborables > 0 ? resumen.necesidadTotal / resumen.diasLaborables : 0;
      resumen.necesidadAFabricarPromedioDiaria = resumen.diasLaborables > 0 ? resumen.necesidadAFabricarTotal / resumen.diasLaborables : 0;
    });

    return Object.values(resumenPorLinea).sort((a, b) => {
      if (a.mesNumero !== b.mesNumero) return a.mesNumero - b.mesNumero;
      return a.linea.localeCompare(b.linea);
    });
  }, [filas, selectedSector, tiemposCanon, usaDatosCalc]);

  const lineasUnicas = useMemo(() => Array.from(new Set(resumenArray.map((r: any) => r.linea))).sort(), [resumenArray]);
  const respCtrlProdUnicos = useMemo(() => Array.from(new Set(resumenArray.map((r: any) => r.respCtrlProd).filter((v: string) => v !== 'Sin responsable'))).sort(), [resumenArray]);

  const resumenFiltered = resumenArray.filter((r: any) => {
    const matchLinea = !selectedLinea || r.linea === selectedLinea;
    const matchResp = !selectedRespCtrlProd || r.respCtrlProd === selectedRespCtrlProd;
    const matchMes = !selectedMes || String(r.mesNumero) === selectedMes;
    return matchLinea && matchResp && matchMes;
  });

  const handleExportCSV = () => {
    const dataToExport = resumenFiltered.map(r => ({
      Mes: r.mes,
      Responsable: r.respCtrlProd,
      SemanasDelMes: r.numeroSemanas,
      Linea: r.linea,
      PuestoCuellodeBottella: r.puestoSeleccionado,
      DiasLaborables: r.diasLaborables,
      NecesidadTotal: r.necesidadTotal,
      NecesidadAFabricarTotal: r.necesidadAFabricarTotal,
      HorasPorDia: Number(r.horasPromedioPorDia.toFixed(2))
    }));
    exportToXLSX(dataToExport, `Resumen_${centroLabel.replace(/\s+/g, '')}_PorLinea`);
  };

  const totals = useMemo(() => {
    const res = { nec: 0, necFab: 0, envio: 0, queda: 0, consJN: 0, libJN: 0, consHE: 0, libHE: 0, consSAB: 0, libSAB: 0 };
    resumenFiltered.forEach(r => {
      res.nec += r.necesidadTotal;
      res.necFab += r.necesidadAFabricarTotal;
      res.envio += r.envioC2000Total;
      res.queda += r.quedaC1000Total;
      res.consJN += r.consumidoJN;
      res.libJN += r.libreJN;
      res.consHE += r.consumidoHE;
      res.libHE += r.libreHE;
      res.consSAB += r.consumidoSAB;
      res.libSAB += r.libreSAB;
    });
    return res;
  }, [resumenFiltered]);

  const format = useCallback((val: number, decimals: number = 0) => {
    if (!isMounted) return '';
    return val.toLocaleString(undefined, { 
      minimumFractionDigits: decimals, 
      maximumFractionDigits: decimals 
    });
  }, [isMounted]);

  return (
    <div className="mb-8 bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden">
      <div className="px-6 py-4 border-b border-gray-200 flex justify-between items-center">
        <div>
          <h3 className="text-lg font-semibold text-gray-800">Resumen por Línea de Fabricación</h3>
          <p className="text-sm text-gray-500 mt-1">Resumen de tiempos de fabricación por línea - {centroLabel}</p>
        </div>
        <button
          onClick={handleExportCSV}
          className="inline-flex items-center px-3 py-2 text-sm font-medium text-green-700 bg-green-50 border border-green-200 rounded-lg hover:bg-green-100 transition-colors"
        >
          Descargar CSV
        </button>
      </div>

      <div className="px-6 py-3 bg-gray-50 border-b border-gray-100">
        <div className="flex gap-4 flex-wrap">
          <div className="flex items-center gap-2">
            <label className="text-sm font-medium text-gray-600">Mes:</label>
            <select value={selectedMes} onChange={e => setSelectedMes(e.target.value)} className="border border-gray-300 px-3 py-1.5 rounded-md text-sm bg-white">
              <option value="">Todos</option>
              {mesesUnicosOptions.map(m => <option key={`sum-opt-mes-${m.value}`} value={m.value}>{m.label}</option>)}
            </select>
          </div>
          <div className="flex items-center gap-2">
            <label className="text-sm font-medium text-gray-600">Sector:</label>
            <select value={selectedSector} onChange={e => setSelectedSector(e.target.value)} className="border border-gray-300 px-3 py-1.5 rounded-md text-sm bg-white">
              <option value="">Todos</option>
              {sectoresUnicos.map(s => <option key={`sum-opt-sector-${s}`} value={s}>{s}</option>)}
            </select>
          </div>
          <div className="flex items-center gap-2">
            <label className="text-sm font-medium text-gray-600">Línea:</label>
            <select value={selectedLinea} onChange={e => setSelectedLinea(e.target.value)} className="border border-gray-300 px-3 py-1.5 rounded-md text-sm bg-white">
              <option value="">Todas las líneas</option>
              {lineasUnicas.map((linea: string) => <option key={`sum-opt-linea-${linea}`} value={linea}>{linea}</option>)}
            </select>
          </div>
          <div className="flex items-center gap-2">
            <label className="text-sm font-medium text-gray-600">Responsable:</label>
            <select value={selectedRespCtrlProd} onChange={e => setSelectedRespCtrlProd(e.target.value)} className="border border-gray-300 px-3 py-1.5 rounded-md text-sm bg-white">
              <option value="">Todos</option>
              {respCtrlProdUnicos.map((resp: string) => <option key={`sum-opt-resp-${resp}`} value={resp}>{resp}</option>)}
            </select>
          </div>
        </div>
      </div>

      <div className="overflow-x-auto max-h-[500px] overflow-y-auto relative">
        <table className="w-full">
          <thead className="sticky top-0 z-20 bg-gray-50 shadow-sm">
            <tr className="bg-gray-50">
              <th rowSpan={3} className="px-3 py-2 text-left text-xs font-semibold text-gray-600 uppercase border-r border-gray-200">Mes</th>
              <th rowSpan={3} className="px-3 py-2 text-left text-xs font-semibold text-gray-600 uppercase border-r border-gray-200">Responsable</th>
              <th rowSpan={3} className="px-3 py-2 text-left text-xs font-semibold text-gray-600 uppercase border-r border-gray-200">Línea</th>
              <th rowSpan={3} className="px-3 py-2 text-center text-xs font-semibold text-gray-600 uppercase border-r border-gray-200">Días Lab.</th>
              <th colSpan={2} className="px-2 py-2 text-center text-xs font-semibold text-indigo-600 uppercase border-r border-gray-200">Necesidad</th>
              <th colSpan={2} className="px-2 py-2 text-center text-xs font-semibold text-purple-600 uppercase border-r border-gray-200">Nec. Fabricar</th>
              <th colSpan={4} className="px-2 py-2 text-center text-xs font-bold text-blue-800 uppercase bg-blue-50 border-r border-gray-200">Jornada Normal</th>
              <th colSpan={4} className="px-2 py-2 text-center text-xs font-bold text-amber-800 uppercase bg-amber-50 border-r border-gray-200">Horas Extras L-V</th>
              <th colSpan={4} className="px-2 py-2 text-center text-xs font-bold text-violet-800 uppercase bg-violet-50 border-r border-gray-200">Sábados</th>
              <th rowSpan={3} className="px-2 py-2 text-center text-xs font-semibold text-gray-600 uppercase">h/día</th>
            </tr>
            <tr className="bg-gray-50">
              <th rowSpan={2} className="px-2 py-1 text-center text-[10px] text-indigo-500 border-r border-gray-100">Total</th>
              <th rowSpan={2} className="px-2 py-1 text-center text-[10px] text-indigo-500 border-r border-gray-200">Prom/día</th>
              <th rowSpan={2} className="px-2 py-1 text-center text-[10px] text-purple-500 border-r border-gray-100">Total</th>
              <th rowSpan={2} className="px-2 py-1 text-center text-[10px] text-purple-500 border-r border-gray-200">Prom/día</th>
              <th colSpan={2} className="px-1 py-1 text-center text-[10px] font-semibold text-blue-700 bg-blue-50 border-b border-blue-200">Consumido</th>
              <th colSpan={2} className="px-1 py-1 text-center text-[10px] font-semibold text-emerald-700 bg-blue-50 border-r border-gray-200 border-b border-blue-200">Libre</th>
              <th colSpan={2} className="px-1 py-1 text-center text-[10px] font-semibold text-amber-700 bg-amber-50 border-b border-amber-200">Consumido</th>
              <th colSpan={2} className="px-1 py-1 text-center text-[10px] font-semibold text-emerald-700 bg-amber-50 border-r border-gray-200 border-b border-amber-200">Libre</th>
              <th colSpan={2} className="px-1 py-1 text-center text-[10px] font-semibold text-violet-700 bg-violet-50 border-b border-violet-200">Consumido</th>
              <th colSpan={2} className="px-1 py-1 text-center text-[10px] font-semibold text-emerald-700 bg-violet-50 border-r border-gray-200 border-b border-violet-200">Libre</th>
            </tr>
            <tr className="bg-gray-50 border-b border-gray-200">
              <th className="px-1 py-1 text-center text-[10px] text-blue-500 bg-blue-50">min</th>
              <th className="px-1 py-1 text-center text-[10px] text-blue-500 bg-blue-50">h</th>
              <th className="px-1 py-1 text-center text-[10px] text-emerald-500 bg-blue-50">min</th>
              <th className="px-1 py-1 text-center text-[10px] text-emerald-500 bg-blue-50 border-r border-gray-200">h</th>
              <th className="px-1 py-1 text-center text-[10px] text-amber-500 bg-amber-50">min</th>
              <th className="px-1 py-1 text-center text-[10px] text-amber-500 bg-amber-50">h</th>
              <th className="px-1 py-1 text-center text-[10px] text-emerald-500 bg-amber-50">min</th>
              <th className="px-1 py-1 text-center text-[10px] text-emerald-500 bg-amber-50 border-r border-gray-200">h</th>
              <th className="px-1 py-1 text-center text-[10px] text-violet-500 bg-violet-50">min</th>
              <th className="px-1 py-1 text-center text-[10px] text-violet-500 bg-violet-50">h</th>
              <th className="px-1 py-1 text-center text-[10px] text-emerald-500 bg-violet-50">min</th>
              <th className="px-1 py-1 text-center text-[10px] text-emerald-500 bg-violet-50 border-r border-gray-200">h</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {resumenFiltered.map((resumen, idx) => (
              <BottleneckSummaryResumenRow
                key={`res-row-${resumen.mes}-${resumen.linea}-${idx}`}
                resumen={resumen as Record<string, number | string>}
                format={format}
              />
            ))}
          </tbody>
          <tfoot className="sticky bottom-0 z-20 bg-gray-800 text-white font-bold text-[10px]">
            <tr>
              <td colSpan={4} className="px-3 py-2 text-right border-r border-gray-600">TOTAL GENERAL</td>
              <td className="px-2 py-2 text-right font-mono text-indigo-300">{format(totals.nec)}</td>
              <td className="px-2 py-2"></td>
              <td className="px-2 py-2 text-right font-mono text-purple-300 border-r border-gray-600">{format(totals.necFab)}</td>
              <td className="px-2 py-2"></td>
              <td className="px-2 py-2 text-right font-mono">{format(totals.consJN)}</td>
              <td className="px-2 py-2 text-right font-mono">{format(totals.consJN / 60, 1)}</td>
              <td className="px-2 py-2 text-right font-mono">{format(totals.libJN)}</td>
              <td className="px-2 py-2 text-right font-mono border-r border-gray-600">{format(totals.libJN / 60, 1)}</td>
              <td className="px-2 py-2 text-right font-mono">{format(totals.consHE)}</td>
              <td className="px-2 py-2 text-right font-mono">{format(totals.consHE / 60, 1)}</td>
              <td className="px-2 py-2 text-right font-mono">{format(totals.libHE)}</td>
              <td className="px-2 py-2 text-right font-mono border-r border-gray-600">{format(totals.libHE / 60, 1)}</td>
              <td className="px-2 py-2 text-right font-mono">{format(totals.consSAB)}</td>
              <td className="px-2 py-2 text-right font-mono">{format(totals.consSAB / 60, 1)}</td>
              <td className="px-2 py-2 text-right font-mono">{format(totals.libSAB)}</td>
              <td className="px-2 py-2 text-right font-mono border-r border-gray-600">{format(totals.libSAB / 60, 1)}</td>
              <td></td>
            </tr>
          </tfoot>
        </table>
      </div>
    </div>
  );
};
