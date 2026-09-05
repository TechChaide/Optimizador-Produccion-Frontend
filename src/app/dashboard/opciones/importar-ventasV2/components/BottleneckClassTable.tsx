
'use client';

import React, { useState, useMemo, useEffect, memo, useRef } from 'react';
import { MONTH_NAMES, MONTH_NUMBERS } from './constants';
import { safeNumber, exportToXLSX, normalizeMaterialCode } from './utils';
import { TiempoCanonResult, TransferNeed, ViableTransfer, BottleneckClassTableProps } from './types';
import { Download } from 'lucide-react';

const EMPTY_TRANSFER_NEEDS: TransferNeed[] = [];
const EMPTY_VIABLE_TRANSFERS: ViableTransfer[] = [];

// Componente de fila optimizado con guarda de hidratación
const DataRow = memo(({ row, idx, linea, isCentro1000, showSaldos, isMounted }: { row: any, idx: number, linea: string, isCentro1000: boolean, showSaldos: boolean, isMounted: boolean }) => {
  const mesDisplay = !isNaN(parseInt(row.mesRef)) ? (MONTH_NAMES[parseInt(row.mesRef)] || row.mesRef) : row.mesRef;

  const format = (val: number, decimals: number = 0) => {
    if (!isMounted) return '';
    return Number(val || 0).toLocaleString(undefined, { 
      minimumFractionDigits: decimals, 
      maximumFractionDigits: decimals 
    });
  };

  return (
    <tr key={`${linea}-${idx}`} className="hover:bg-gray-50 transition-colors text-[11px]">
      <td className="px-2 py-2 font-bold text-indigo-900 bg-indigo-50/30 whitespace-nowrap min-w-[80px]">{mesDisplay}</td>
      <td className="px-2 py-2 font-medium text-gray-600 min-w-[60px]">{String(row.ClaseAprovisionam || '-').trim().toUpperCase()}</td>
      <td className="px-2 py-2 font-medium text-gray-900 font-mono min-w-[90px]">{row.CodMaterial ?? '-'}</td>
      <td className="px-2 py-2 text-gray-600 max-w-40 truncate min-w-[150px]" title={row.Descripcion ?? ''}>{row.Descripcion ?? '-'}</td>
      <td className="px-2 py-2 text-gray-600 min-w-[100px]">{row.CentroFabricacion || row.Centro || '-'}</td>
      <td className="px-2 py-2 text-gray-600 min-w-[100px]">{row.LineaFabricacion ?? '-'}</td>
      <td className="px-2 py-2 text-gray-600 min-w-[120px]">{row.PuestoCuellodeBottella ?? '-'}</td>
      <td className="px-2 py-2 text-right font-mono text-gray-600 min-w-[60px]">{row.NumeroPuestos ?? row.numero_puestos ?? '-'}</td>
      <td className="px-2 py-2 text-gray-600 min-w-[100px]">{row.Sector ?? '-'}</td>
      <td className="px-2 py-2 text-gray-600 min-w-[120px]">{row.NombRespControlProd ?? row.RespCtrlProd ?? '-'}</td>
      <td className="px-2 py-2 text-right font-mono text-indigo-600 font-semibold border-r-2 border-gray-200 min-w-[70px]">
        {format(row.tiempoUnitarioPorPuesto, 3)}
      </td>
      
      <td className="px-2 py-2 text-right font-mono text-teal-700 font-semibold min-w-[80px]">{format(row._traslado)}</td>
      <td className="px-2 py-2 text-right font-mono text-gray-700 min-w-[80px]">{format(row._necPropia)}</td>
      <td className="px-2 py-2 text-right font-mono text-blue-700 border-r-2 border-gray-300 min-w-[90px]">{format(row._necesidad)}</td>
      
      <td className="px-2 py-2 text-right font-mono text-blue-600 min-w-[80px]">{format(row.tiempoTotalNecesidad, 2)}</td>
      <td className="px-2 py-2 text-right font-mono text-blue-600 min-w-[60px]">{format(row.participacionIndividual, 2)}%</td>
      <td className="px-2 py-2 text-right font-mono text-blue-600 min-w-[90px]">{isMounted ? `${format(row.minutosDisponiblesJornadaNormal, 1)} m` : ''}</td>
      <td className="px-2 py-2 text-right font-mono text-blue-800 font-semibold min-w-[80px]">{format(row.necesidadMaximaProducirJornadaNormal)}</td>
      <td className="px-2 py-2 text-right font-mono text-green-700 border-r-2 border-gray-300 min-w-[80px]">{format(row.deficitJornadaNormal)}</td>
      
      <td className="px-2 py-2 text-right font-mono text-green-600 min-w-[80px]">{format(row.tiempoTotalNecesidadDeficitJN, 2)}</td>
      <td className="px-2 py-2 text-right font-mono text-green-600 min-w-[60px]">{format(row.participacionDeficitJN, 2)}%</td>
      <td className="px-2 py-2 text-right font-mono text-green-600 min-w-[90px]">{isMounted ? `${format(row.minutosDisponiblesHorasExtras, 1)} m` : ''}</td>
      <td className="px-2 py-2 text-right font-mono text-green-700 min-w-[80px]">{format(row.necesidadMaximaProducirHorasExtras)}</td>
      <td className="px-2 py-2 text-right font-mono text-orange-700 border-r-2 border-gray-300 min-w-[80px]">{format(row.deficitHorasExtras)}</td>
      
      <td className="px-2 py-2 text-right font-mono text-orange-600 min-w-[80px]">{format(row.tiempoTotalNecesidadDeficitHE, 2)}</td>
      <td className="px-2 py-2 text-right font-mono text-orange-600 min-w-[60px]">{format(row.participacionDeficitHE, 2)}%</td>
      <td className="px-2 py-2 text-right font-mono text-orange-600 min-w-[90px]">{isMounted ? `${format(row.minutosDisponiblesSabados, 1)} m` : ''}</td>
      <td className="px-2 py-2 text-right font-mono text-orange-800 font-semibold min-w-[80px]">{format(row.necesidadMaximaProducirSabados)}</td>
      <td className="px-2 py-2 text-right font-mono text-orange-700 border-r-2 border-gray-300 min-w-[80px]">{format(row.deficitSabados)}</td>
      
      <td className="px-2 py-2 text-right font-mono text-purple-700 font-bold bg-purple-50/30 border-r-2 border-gray-300 min-w-[90px]">{format(row._prodViable)}</td>
      
      {showSaldos ? (
        <>
          <td className={`px-2 py-2 text-right font-mono font-semibold ${row._deficitGeneral > 0 ? 'text-red-700' : 'text-green-700'} bg-red-50/10 min-w-[80px]`}>{format(row._deficitGeneral)}</td>
          <td className="px-2 py-2 text-right font-mono text-teal-700 font-semibold bg-teal-50/20 min-w-[90px]">{format(row._trValorAMostrar)}</td>
          <td className="px-2 py-2 text-right font-mono text-indigo-700 font-semibold bg-indigo-50/30 min-w-[90px]">{format(row._stockInitial)}</td>
          <td className="px-2 py-2 text-right font-mono text-gray-700 min-w-[80px]">{format(row.up)}</td>
          <td className="px-2 py-2 text-right font-mono text-green-700 font-bold bg-green-50/30 min-w-[90px]">{format(row._demandaCubierta)}</td>
          <td className={`px-2 py-2 text-right font-mono font-bold bg-blue-50/30 ${row._backlogVentas > 0 ? 'text-red-600' : 'text-blue-700'} min-w-[80px]`}>{format(row._backlogVentas)}</td>
          <td className={`px-2 py-2 text-right font-mono font-bold bg-amber-50/30 ${row._backlogTraslado > 0 ? 'text-amber-800' : 'text-gray-500'} min-w-[80px]`}>{format(row._backlogTraslado ?? 0)}</td>
          <td className={`px-2 py-2 text-right font-mono font-bold border-r-2 border-gray-300 bg-emerald-50/30 ${row._saldoFinal < 0 ? 'text-red-700' : 'text-emerald-700'} min-w-[90px]`}>{format(row._saldoFinal)}</td>
        </>
      ) : isCentro1000 ? (
        <>
          <td className="px-2 py-2 text-right font-mono text-teal-700 font-semibold bg-teal-50/10 min-w-[80px]">{format(row._envioC2000Plan ?? row._trValorAMostrar)}</td>
          <td className="px-2 py-2 text-right font-mono text-teal-800 font-semibold bg-teal-50/20 min-w-[80px]">{format(row._envioC2000)}</td>
          <td className="px-2 py-2 text-right font-mono text-cyan-700 font-semibold bg-cyan-50/10 min-w-[90px]">{format(row._quedaC1000)}</td>
          <td className={`px-2 py-2 text-right font-mono font-semibold ${row._deficitGeneral > 0 ? 'text-red-700' : 'text-green-700'} border-r-2 border-gray-300 min-w-[80px]`}>{format(row._deficitGeneral)}</td>
        </>
      ) : (
        <>
          <td className={`px-2 py-2 text-right font-mono font-semibold ${row._deficitGeneral > 0 ? 'text-red-700' : 'text-green-700'} bg-red-50/10 min-w-[80px]`}>{format(row._deficitGeneral)}</td>
          <td className="px-2 py-2 text-right font-mono text-teal-700 font-semibold bg-teal-50/20 min-w-[90px]">{format(row._trValorAMostrar)}</td>
          <td className={`px-2 py-2 text-right font-mono font-bold ${row._deficitNeto2000 > 0 ? 'text-red-700' : 'text-green-700'} border-r-2 border-gray-300 bg-purple-50/20 min-w-[80px]`}>{format(row._deficitNeto2000)}</td>
        </>
      )}
    </tr>
  );
});
DataRow.displayName = 'DataRow';

export const BottleneckClassTable: React.FC<BottleneckClassTableProps & { showSaldos?: boolean }> = ({ 
  datos, 
  datosCompletos,
  titulo, 
  tiemposCanon, 
  onTransferNeedsCalculated,
  onComputedDataReady,
  forzarTrasladoTotal = false,
  maxExtrasHoras = 2,
  horasExtrasFin = 2,
  trasladosDesdeCentro2000 = EMPTY_TRANSFER_NEEDS,
  isCentro1000 = false,
  trasladosViables = EMPTY_VIABLE_TRANSFERS,
  showSaldos = false
}) => {
  const [searchTerm, setSearchTerm] = useState<string>('');
  const [selectedLinea, setSelectedLinea] = useState<string>('');
  const [selectedMes, setSelectedMes] = useState<string>('');
  const [selectedSector, setSelectedSector] = useState<string>('');
  const [currentPage, setCurrentPage] = useState<number>(1);
  const [isMounted, setIsMounted] = useState(false);
  const itemsPerPage = 50;

  // Guarda de hidratación
  useEffect(() => setIsMounted(true), []);

  const lastEmittedSignature = useRef<string>('');
  const lastTransferNeedsSignature = useRef<string>('');

  const getTimelineKey = (row: any) => {
    const year = safeNumber(row.Año || row.año || new Date().getFullYear());
    let month = 0;
    const mesRaw = String(row.Mes || row.mesRef || '');
    const asNum = parseInt(mesRaw);
    if (!isNaN(asNum) && asNum >= 1 && asNum <= 12) month = asNum;
    else month = MONTH_NUMBERS[mesRaw as keyof typeof MONTH_NUMBERS] || 0;
    return (year * 12) + month;
  };

  const quickMaps = useMemo(() => {
    const traslados = new Map<string, number>();
    trasladosDesdeCentro2000.forEach(item => {
      const code = normalizeMaterialCode(item.CodMaterial);
      const key = `${code}|${item.mes}`;
      traslados.set(key, (traslados.get(key) || 0) + item.necesidadTraslado);
    });

    const viables = new Map<string, number>();
    trasladosViables.forEach(item => {
      const code = normalizeMaterialCode(item.CodMaterial);
      viables.set(`${code}|${item.mes}`, item.cantidad);
    });

    const tiempos = new Map<string, TiempoCanonResult>();
    tiemposCanon.forEach(t => {
      tiempos.set(t.mes, t);
      tiempos.set(String(t.mesNumero), t);
    });

    return { traslados, viables, tiempos };
  }, [trasladosDesdeCentro2000, trasladosViables, tiemposCanon]);

  const filasCalculadas = useMemo(() => {
    if (!datos || datos.length === 0) return [];

    const timeline = Array.from(new Set(datos.map(r => getTimelineKey(r))))
      .sort((a, b) => a - b);

    if (timeline.length === 0) return [];

    const stockTracker = new Map<string, number>(); 
    const todasLasFilasProcesadas: any[] = [];
    const trasladosAplicados = new Set<string>(); 

    for (const tKey of timeline) {
      const filasDelMes = datos.filter(r => getTimelineKey(r) === tKey);
      if (filasDelMes.length === 0) continue;

      const mesRef = String(filasDelMes[0].Mes || filasDelMes[0].mesRef || '');
      const tc = quickMaps.tiempos.get(mesRef) || quickMaps.tiempos.get(String(parseInt(mesRef)));
      if (!tc) continue;

      const poolMinutosHEPorLinea = new Map<string, number>();
      const poolMinutosSabadosPorLinea = new Map<string, number>();
      const sumaTiempoNecPorLinea = new Map<string, number>();
      const mapaAgrupamiento = new Map<string, { necesidades: number }>();
      const tiempoDispGlobalPorLinea = new Map<string, number>();

      const enriquecidosBase = filasDelMes.map(row => {
        const code = normalizeMaterialCode(row.CodMaterial ?? '');
        const cDem = String(row.Centro || '').trim();
        const keyStock = `${code}|${cDem}`;
        const linea = String(row.LineaFabricacion ?? 'Sin línea');
        const keyLinea = `${tKey}|${linea}`;

        const _stockInitial = stockTracker.has(keyStock)
          ? stockTracker.get(keyStock)!
          : safeNumber(row.StockActual);

        const ss = safeNumber(row.StockSeguridad);
        const up = safeNumber(row.UnidadesProyectado);
        
        const trKey = `${code}|${mesRef}`;
        let _traslado = 0;
        if (isCentro1000 && !trasladosAplicados.has(trKey)) {
          _traslado = quickMaps.traslados.get(trKey) || 0;
          trasladosAplicados.add(trKey);
        }
        
        const _necPropia = Math.max(0, up - _stockInitial + ss);
        const rawNec = (isCentro1000 && cDem !== '1000') ? 0 : _necPropia;
        const _necesidad = rawNec + _traslado;

        const esF = String(row.ClaseAprovisionam || '').trim().toUpperCase() === 'F';
        const prodAqui = isCentro1000 ? true : !esF;

        if (!mapaAgrupamiento.has(keyLinea)) mapaAgrupamiento.set(keyLinea, { necesidades: 0 });
        if (prodAqui) mapaAgrupamiento.get(keyLinea)!.necesidades += _necesidad;

        if (!tiempoDispGlobalPorLinea.has(keyLinea)) {
          const lineaNorm = String(linea).toLowerCase().replace(/\s+/g, '');
          const registrosLinea = tc.data.filter((item: any) => {
            const nl = String(item?.nombre_linea ?? '').toLowerCase().replace(/\s+/g, '');
            return nl === lineaNorm || nl.includes(lineaNorm) || lineaNorm.includes(nl);
          });
          const pBotella = registrosLinea[0];
          const minutosJN = safeNumber(pBotella?.minutos_horario_normal_TOTAL ?? 0);
          const minutosConExtras = safeNumber(pBotella?.minutos_extras_TOTAL ?? 0);
          const minutosSabadoApi = safeNumber(pBotella?.minutos_sabado_TOTAL ?? 0);

          // Capeamos el pool de sábados al máximo permitido por la restricción HORAS_EXTRAS_FIN_SEMANA.
          // La API puede devolver un valor calculado con más horas/sábado que las permitidas.
          const maxMinutosSabadoPermitidos = tc.diasSabados * horasExtrasFin * 60;
          const minutosSabado = tc.diasSabados > 0
            ? Math.min(minutosSabadoApi, maxMinutosSabadoPermitidos)
            : minutosSabadoApi;

          // Pool de HE y sábados basado en tiempos canónicos del cuello de botella.
          tiempoDispGlobalPorLinea.set(keyLinea, minutosJN);
          poolMinutosHEPorLinea.set(keyLinea, Math.max(0, minutosConExtras - minutosJN));
          poolMinutosSabadosPorLinea.set(keyLinea, Math.max(0, minutosSabado));
        }

        const tupp = safeNumber(row.TiempoPorUnidad ?? 0) / Math.max(1, safeNumber(row.NumeroPuestos ?? row.numero_puestos ?? 1));
        if (prodAqui) sumaTiempoNecPorLinea.set(keyLinea, (sumaTiempoNecPorLinea.get(keyLinea) || 0) + (tupp * _necesidad));

        return { ...row, mesRef, lineaRef: linea, _stockInitial, _traslado, _necPropia, _necesidad, tiempoUnitarioPorPuesto: tupp, prodAqui, keyLinea, keyStock, up, ss };
      });

      const sumDefJN = new Map<string, number>();
      const sumTDefJN = new Map<string, number>();

      const pase2 = enriquecidosBase.map(r => {
        const partInd = (r.prodAqui && (mapaAgrupamiento.get(r.keyLinea)?.necesidades ?? 0) > 0) 
          ? (r._necesidad / mapaAgrupamiento.get(r.keyLinea)!.necesidades) * 100 : 0;
        
        const dispJN = tiempoDispGlobalPorLinea.get(r.keyLinea) || 0;
        let maxJN = 0;

        if (r._isPreComputed) {
          maxJN = safeNumber(r.necesidadMaximaProducirJornadaNormal);
        } else if (!forzarTrasladoTotal && r.prodAqui) {
          const totalNecLinea = sumaTiempoNecPorLinea.get(r.keyLinea) || 0;
          if (totalNecLinea <= dispJN) maxJN = r._necesidad;
          else maxJN = r.tiempoUnitarioPorPuesto > 0 ? Math.floor(((partInd / 100) * dispJN) / r.tiempoUnitarioPorPuesto) : 0;
        }

        const defJN = Math.max(0, r._necesidad - maxJN);
        const tDefJN = r.prodAqui ? defJN * r.tiempoUnitarioPorPuesto : 0;
        sumDefJN.set(r.keyLinea, (sumDefJN.get(r.keyLinea) || 0) + defJN);
        sumTDefJN.set(r.keyLinea, (sumTDefJN.get(r.keyLinea) || 0) + tDefJN);

        return { ...r, participacionIndividual: partInd, minutosDisponiblesJornadaNormal: (partInd / 100) * dispJN, tiempoTotalNecesidad: r.prodAqui ? r._necesidad * r.tiempoUnitarioPorPuesto : 0, necesidadMaximaProducirJornadaNormal: maxJN, deficitJornadaNormal: defJN, tiempoTotalNecesidadDeficitJN: tDefJN };
      });

      const prelimRows = pase2.map(r => {
        const poolHE = poolMinutosHEPorLinea.get(r.keyLinea) || 0;
        const partDefJN = (r.prodAqui && sumDefJN.get(r.keyLinea)! > 0) ? (r.deficitJornadaNormal / sumDefJN.get(r.keyLinea)!) * 100 : 0;

        let maxHE = 0;
        if (r._isPreComputed) {
          maxHE = safeNumber(r.necesidadMaximaProducirHorasExtras);
        } else if (r.prodAqui && sumTDefJN.get(r.keyLinea)! > 0) {
          if (sumTDefJN.get(r.keyLinea)! <= poolHE) maxHE = r.deficitJornadaNormal;
          else maxHE = r.tiempoUnitarioPorPuesto > 0 ? Math.floor(((partDefJN / 100) * poolHE) / r.tiempoUnitarioPorPuesto) : 0;
        }

        const deficitHE = Math.max(0, r.deficitJornadaNormal - maxHE);
        return { r, maxHE, deficitHE, partDefJN };
      });

      const sumDefHE = new Map<string, number>();
      const sumTDefHETiempo = new Map<string, number>();
      prelimRows.forEach(({ r, deficitHE }) => {
        sumDefHE.set(r.keyLinea, (sumDefHE.get(r.keyLinea) || 0) + deficitHE);
        if (r.prodAqui) {
          sumTDefHETiempo.set(r.keyLinea, (sumTDefHETiempo.get(r.keyLinea) || 0) + deficitHE * r.tiempoUnitarioPorPuesto);
        }
      });

      prelimRows.forEach(({ r, maxHE, deficitHE, partDefJN }) => {
        const poolHE = poolMinutosHEPorLinea.get(r.keyLinea) || 0;
        const poolSab = poolMinutosSabadosPorLinea.get(r.keyLinea) || 0;
        const partDefHE = (r.prodAqui && (sumDefHE.get(r.keyLinea) || 0) > 0)
          ? (deficitHE / (sumDefHE.get(r.keyLinea) || 1)) * 100
          : 0;

        let maxSab = 0;
        let _prodViable = 0;

        if (r._isPreComputed) {
          maxSab = safeNumber(r.necesidadMaximaProducirSabados);
          _prodViable = safeNumber(r._prodViable);
        } else {
          if (r.prodAqui && deficitHE > 0 && poolSab > 0) {
            if ((sumTDefHETiempo.get(r.keyLinea) || 0) <= poolSab) maxSab = deficitHE;
            else maxSab = r.tiempoUnitarioPorPuesto > 0 ? Math.floor(((partDefHE / 100) * poolSab) / r.tiempoUnitarioPorPuesto) : 0;
            maxSab = Math.min(maxSab, deficitHE);
          }
          _prodViable = r.necesidadMaximaProducirJornadaNormal + maxHE + maxSab;
        }

        const deficitSabados = Math.max(0, deficitHE - maxSab);
        const _deficitGeneral = Math.max(0, r._necesidad - _prodViable);
        
        const trKey = `${normalizeMaterialCode(r.CodMaterial)}|${r.mesRef}`;
        const trViableValue = quickMaps.viables.get(trKey) || 0;

        const trasladoPlan =
          trasladosViables && trasladosViables.length > 0
            ? trViableValue
            : isCentro1000
              ? Math.round(_prodViable * (r._necesidad > 0 ? r._traslado / r._necesidad : 0))
              : trViableValue;

        let _disponibilidad: number;
        let _demandaCubierta: number;
        let _backlogVentas: number;
        let _backlogTraslado: number;
        let _saldoFinal: number;
        let _trValorAMostrar: number;
        let _envioC2000Plan: number;
        let _envioC2000: number;
        let _quedaC1000: number;

        if (isCentro1000) {
          const base = r._stockInitial + _prodViable;
          _demandaCubierta = Math.min(r.up, Math.max(0, base));
          const rem = Math.max(0, base - _demandaCubierta);
          _envioC2000Plan = trasladoPlan;
          _envioC2000 = Math.min(trasladoPlan, rem);
          _backlogVentas = Math.max(0, r.up - _demandaCubierta);
          _backlogTraslado = Math.max(0, trasladoPlan - _envioC2000);
          _saldoFinal = Math.max(0, rem - _envioC2000);
          _trValorAMostrar = trasladoPlan;
          _disponibilidad = base;
          _quedaC1000 = Math.round(_prodViable - _envioC2000);
        } else {
          _trValorAMostrar = trasladoPlan;
          _disponibilidad = r._stockInitial + _prodViable + _trValorAMostrar;
          _demandaCubierta = Math.min(r.up, Math.max(0, _disponibilidad));
          _backlogVentas = Math.max(0, r.up - _demandaCubierta);
          _backlogTraslado = 0;
          _saldoFinal = Math.max(0, _disponibilidad - _demandaCubierta);
          _envioC2000Plan = 0;
          _envioC2000 = 0;
          _quedaC1000 = _prodViable;
        }

        stockTracker.set(r.keyStock, _saldoFinal);

        todasLasFilasProcesadas.push({
          ...r,
          _isPreComputed: r._isPreComputed || true,
          necesidadMaximaProducirHorasExtras: maxHE,
          necesidadMaximaProducirSabados: maxSab,
          deficitHorasExtras: deficitHE,
          deficitSabados,
          tiempoTotalNecesidadDeficitHE: r.prodAqui ? deficitHE * r.tiempoUnitarioPorPuesto : 0,
          tiempoTotalNecesidadDeficitSAB: r.prodAqui ? deficitSabados * r.tiempoUnitarioPorPuesto : 0,
          _prodViable,
          _deficitGeneral,
          _trValorAMostrar,
          _deficitNeto2000: Math.max(0, _deficitGeneral - trViableValue),
          _envioC2000Plan,
          _envioC2000: isCentro1000 ? _envioC2000 : 0,
          _quedaC1000,
          participacionDeficitJN: partDefJN,
          minutosDisponiblesHorasExtras: (partDefJN / 100) * poolHE,
          minutosDisponiblesSabados: (partDefHE / 100) * poolSab,
          _demandaCubierta,
          _backlogVentas,
          _backlogTraslado,
          _saldoFinal,
        });
      });
    }

    return todasLasFilasProcesadas;
  }, [datos, quickMaps, isCentro1000, forzarTrasladoTotal, maxExtrasHoras, horasExtrasFin, trasladosViables]);

  useEffect(() => {
    if (onComputedDataReady && filasCalculadas.length > 0) {
      const signature = JSON.stringify(filasCalculadas.map(f => ({ m: f.CodMaterial, mes: f.mesRef, p: f._prodViable, t: f._trValorAMostrar })));
      if (lastEmittedSignature.current !== signature) {
        lastEmittedSignature.current = signature;
        onComputedDataReady(filasCalculadas);
      }
    }
  }, [filasCalculadas, onComputedDataReady]);

  useEffect(() => {
    if (!onTransferNeedsCalculated || filasCalculadas.length === 0 || isCentro1000) return;

    const newNeeds = filasCalculadas
      .filter(r => safeNumber(r._deficitGeneral) > 0)
      .map(r => ({
        CodMaterial: normalizeMaterialCode(r.CodMaterial),
        mes: String(r.mesRef ?? ''),
        necesidadTraslado: safeNumber(r._deficitGeneral),
      }))
      .sort(
        (a, b) =>
          a.CodMaterial.localeCompare(b.CodMaterial) ||
          a.mes.localeCompare(b.mes, undefined, { numeric: true })
      );

    const signature = JSON.stringify(newNeeds);
    if (lastTransferNeedsSignature.current === signature) return;
    lastTransferNeedsSignature.current = signature;
    onTransferNeedsCalculated(newNeeds);
  }, [filasCalculadas, onTransferNeedsCalculated, isCentro1000]);

  const datosFiltrados = useMemo(() => {
    let result = filasCalculadas;
    const q = searchTerm.toLowerCase();
    if (q) {
      result = result.filter(row => String(row.CodMaterial || '').toLowerCase().includes(q) || String(row.Descripcion || '').toLowerCase().includes(q));
    }
    if (selectedLinea) {
      result = result.filter(row => row.lineaRef === selectedLinea);
    }
    if (selectedMes) {
      result = result.filter(row => {
        const mesNombre = !isNaN(parseInt(row.mesRef)) ? (MONTH_NAMES[parseInt(row.mesRef)] || row.mesRef) : row.mesRef;
        return mesNombre === selectedMes || String(row.mesRef) === selectedMes;
      });
    }
    if (selectedSector) {
      result = result.filter(row => String(row.Sector || '') === selectedSector);
    }
    return result;
  }, [filasCalculadas, searchTerm, selectedLinea, selectedMes, selectedSector]);

  const totals = useMemo(() => {
    const res = {
      necPropia: 0, traslados: 0, necesidad: 0, tiempoNec: 0, dispMinJN: 0, maxJN: 0, defJN: 0,
      tDefJN: 0, tMinHE: 0, maxHE: 0, defHE: 0, tDefHE: 0, tMinSAB: 0, maxSAB: 0, defSAB: 0, tDefSAB: 0, viable: 0,
      defGral: 0, trViable: 0, defNeto: 0, stockIni: 0, demanda: 0, demCubierta: 0, backlog: 0, backlogTrasl: 0, saldoFinal: 0,
      envio2000: 0, envio2000Plan: 0, queda1000: 0
    };
    datosFiltrados.forEach((r: any) => {
      res.necPropia += safeNumber(r._necPropia);
      res.traslados += safeNumber(r._traslado);
      res.necesidad += safeNumber(r._necesidad);
      res.tiempoNec += safeNumber(r.tiempoTotalNecesidad);
      res.dispMinJN += safeNumber(r.minutosDisponiblesJornadaNormal);
      res.maxJN += safeNumber(r.necesidadMaximaProducirJornadaNormal);
      res.defJN += safeNumber(r.deficitJornadaNormal);
      res.tDefJN += safeNumber(r.tiempoTotalNecesidadDeficitJN);
      res.tMinHE += safeNumber(r.minutosDisponiblesHorasExtras);
      res.maxHE += safeNumber(r.necesidadMaximaProducirHorasExtras);
      res.defHE += safeNumber(r.deficitHorasExtras);
      res.tDefHE += safeNumber(r.tiempoTotalNecesidadDeficitHE);
      res.tMinSAB += safeNumber(r.minutosDisponiblesSabados);
      res.maxSAB += safeNumber(r.necesidadMaximaProducirSabados);
      res.defSAB += safeNumber(r.deficitSabados);
      res.tDefSAB += safeNumber(r.tiempoTotalNecesidadDeficitSAB);
      res.viable += safeNumber(r._prodViable);
      res.defGral += safeNumber(r._deficitGeneral);
      res.trViable += safeNumber(r._trValorAMostrar);
      res.defNeto += safeNumber(r._deficitNeto2000);
      res.envio2000 += safeNumber(r._envioC2000);
      res.envio2000Plan += safeNumber(r._envioC2000Plan ?? r._trValorAMostrar);
      res.queda1000 += safeNumber(r._quedaC1000);
      res.stockIni += safeNumber(r._stockInitial);
      res.demanda += safeNumber(r.up);
      res.demCubierta += safeNumber(r._demandaCubierta);
      res.backlog += safeNumber(r._backlogVentas);
      res.backlogTrasl += safeNumber(r._backlogTraslado);
      res.saldoFinal += safeNumber(r._saldoFinal);
    });
    return res;
  }, [datosFiltrados]);

  const paginatedData = useMemo(() => {
    const start = (currentPage - 1) * itemsPerPage;
    return datosFiltrados.slice(start, start + itemsPerPage);
  }, [datosFiltrados, currentPage]);

  const totalPages = Math.max(1, Math.ceil(datosFiltrados.length / itemsPerPage));

  const mesesUnicosOptions = useMemo(() => {
    const nombres = filasCalculadas.map(r => {
      const val = String(r.mesRef || '');
      const num = parseInt(val);
      return !isNaN(num) && MONTH_NAMES[num] ? MONTH_NAMES[num] : val;
    }).filter(m => m !== '');
    
    return Array.from(new Set(nombres)).sort((a, b) => {
      const getNum = (name: string) => {
        const entry = Object.entries(MONTH_NAMES).find(([_, v]) => v === name);
        return entry ? parseInt(entry[0]) : 0;
      };
      return getNum(a) - getNum(b);
    });
  }, [filasCalculadas]);

  const lineasUnicasOptions = useMemo(() => {
    return Array.from(new Set(filasCalculadas.map(r => String(r.lineaRef || ''))))
      .filter(l => l !== '')
      .sort();
  }, [filasCalculadas]);

  const sectoresUnicosOptions = useMemo(() => {
    return Array.from(new Set(filasCalculadas.map(r => String(r.Sector || ''))))
      .filter(s => s !== '')
      .sort();
  }, [filasCalculadas]);

  const formatTotal = (val: number, decimals: number = 0) => {
    if (!isMounted) return '';
    return val.toLocaleString(undefined, { 
      minimumFractionDigits: decimals, 
      maximumFractionDigits: decimals 
    });
  };

  return (
    <div className="mb-8 bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden">
      <div className="px-4 py-3 border-b border-gray-200 flex justify-between items-center bg-gray-50">
        <div>
          <h3 className="text-sm font-bold text-gray-800 uppercase tracking-tight">{titulo}</h3>
          <p className="text-[10px] text-gray-500">{datosFiltrados.length} registros</p>
        </div>
        <button onClick={() => exportToXLSX(filasCalculadas, `Detalle_${titulo.replace(/\s+/g, '_')}`)} className="p-1.5 text-green-700 hover:bg-green-100 rounded-md transition-colors">
          <Download className="w-4 h-4" />
        </button>
      </div>

      <div className="px-4 py-2 bg-white border-b border-gray-100 flex gap-2 flex-wrap items-center text-xs">
        <div className="relative">
          <input type="search" placeholder="Buscar material..." value={searchTerm} onChange={e => setSearchTerm(e.target.value)} className="border border-gray-300 pl-8 pr-2 py-1.5 rounded-md text-xs w-48" />
          <svg className="absolute left-2.5 top-2 h-3.5 w-3.5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"/></svg>
        </div>
        
        <select value={selectedMes} onChange={e => setSelectedMes(e.target.value)} className="border border-gray-300 px-3 py-1.5 rounded-md text-sm bg-white">
          <option value="">Mes: Todos</option>
          {mesesUnicosOptions.map(m => <option key={`opt-mes-${m}`} value={m}>{m}</option>)}
        </select>

        <select value={selectedLinea} onChange={e => setSelectedLinea(e.target.value)} className="border border-gray-300 px-3 py-1.5 rounded-md text-sm bg-white">
          <option value="">Línea: Todas</option>
          {lineasUnicasOptions.map(l => <option key={`opt-linea-${l}`} value={l}>{l}</option>)}
        </select>

        <select value={selectedSector} onChange={e => setSelectedSector(e.target.value)} className="border border-gray-300 px-3 py-1.5 rounded-md text-sm bg-white">
          <option value="">Sector: Todos</option>
          {sectoresUnicosOptions.map(s => <option key={`opt-sector-${s}`} value={s}>{s}</option>)}
        </select>
      </div>

      <div className="overflow-x-auto max-h-[600px] overflow-y-auto relative">
        <table className="w-full border-collapse">
          <thead className="sticky top-0 z-20 bg-gray-100 shadow-sm text-[10px]">
            <tr className="border-b border-gray-300">
              <th colSpan={11} className="px-2 py-1 text-center font-bold text-gray-700 uppercase bg-gray-200">Información General</th>
              <th colSpan={3} className="px-2 py-1 text-center font-bold text-teal-700 uppercase bg-teal-50 border-r-2 border-gray-300">Aprovisionamiento</th>
              <th colSpan={5} className="px-2 py-1 text-center font-bold text-blue-700 uppercase bg-blue-100 border-r-2 border-gray-300">Jornada Normal</th>
              <th colSpan={5} className="px-2 py-1 text-center font-bold text-green-700 uppercase bg-green-100 border-r-2 border-gray-300">Horas Extras</th>
              <th colSpan={5} className="px-2 py-1 text-center font-bold text-orange-700 uppercase bg-orange-100 border-r-2 border-gray-300">Sábados</th>
              <th
                colSpan={showSaldos ? 8 : isCentro1000 ? 4 : 3}
                className="px-2 py-1 text-center font-bold text-purple-700 uppercase bg-purple-100 border-r-2 border-gray-300"
              >
                Resultados Consolidados
              </th>
            </tr>
            <tr className="bg-gray-50 border-b border-gray-200 uppercase font-bold text-gray-500">
              <th className="px-2 py-1 text-left bg-indigo-50/50 min-w-[80px]">Mes</th>
              <th className="px-2 py-1 text-left min-w-[60px]">Clase</th><th className="px-2 py-1 text-left min-w-[90px]">Material</th><th className="px-2 py-1 text-left min-w-[150px]">Descripción</th>
              <th className="px-2 py-1 text-left min-w-[100px]">Centro</th><th className="px-2 py-1 text-left min-w-[100px]">Línea</th><th className="px-2 py-1 text-left min-w-[120px]">Puesto</th>
              <th className="px-2 py-1 text-right min-w-[60px]">Puestos</th><th className="px-2 py-1 text-left min-w-[100px]">Sector</th><th className="px-2 py-1 text-left min-w-[120px]">Responsable</th>
              <th className="px-2 py-1 text-right text-indigo-600 border-r-2 border-gray-200 min-w-[70px]">T.Unit</th>
              <th className="px-2 py-1 text-right text-teal-600 min-w-[80px]">Traslado</th><th className="px-2 py-1 text-right text-gray-600 min-w-[80px]">Nec.Propia</th>
              <th className="px-2 py-1 text-right text-blue-600 border-r-2 border-gray-300 min-w-[90px]">Necesidad</th>
              <th className="px-2 py-1 text-right text-blue-600 min-w-[80px]">T.Total</th><th className="px-2 py-1 text-right text-blue-600 min-w-[60px]">Part.%</th>
              <th className="px-2 py-1 text-right text-blue-600 min-w-[90px]">Disp.Min</th><th className="px-2 py-1 text-right text-blue-700 min-w-[80px]">Max.JN</th>
              <th className="px-2 py-1 text-right text-green-600 border-r-2 border-gray-300 min-w-[80px]">Def.JN</th>
              <th className="px-2 py-1 text-right text-green-600 min-w-[80px]">T.Total</th><th className="px-2 py-1 text-right text-green-600 min-w-[60px]">Part.%</th>
              <th className="px-2 py-1 text-right text-green-600 min-w-[90px]">Disp.Min</th><th className="px-2 py-1 text-right text-green-700 min-w-[80px]">Max.HE</th>
              <th className="px-2 py-1 text-right text-orange-600 border-r-2 border-gray-300 min-w-[80px]">Def.HE</th>
              <th className="px-2 py-1 text-right text-orange-600 min-w-[80px]">T.Total</th><th className="px-2 py-1 text-right text-orange-600 min-w-[60px]">Part.%</th>
              <th className="px-2 py-1 text-right text-orange-600 min-w-[90px]">Disp.Min</th><th className="px-2 py-1 text-right text-orange-700 min-w-[80px]">Max.Sab</th>
              <th className="px-2 py-1 text-right text-orange-600 border-r-2 border-gray-300 min-w-[80px]">Def.Sab</th>
              <th className="px-2 py-1 text-right text-purple-600 min-w-[90px]">Viable</th>
              {showSaldos ? (
                <>
                  <th className="px-2 py-1 text-right text-red-600 min-w-[80px]">Def.Gral</th><th className="px-2 py-1 text-right text-teal-600 min-w-[90px]">Traslados</th>
                  <th className="px-2 py-1 text-right text-indigo-600 min-w-[90px]">Stock Ini</th><th className="px-2 py-1 text-right text-gray-600 min-w-[80px]">Demanda</th>
                  <th className="px-2 py-1 text-right text-green-600 min-w-[90px]">Despachos</th><th className="px-2 py-1 text-right text-blue-600 min-w-[80px]">BL Ventas</th>
                  <th className="px-2 py-1 text-right text-amber-600 min-w-[80px]">BL Trasl.</th>
                  <th className="px-2 py-1 text-right text-emerald-600 border-r-2 border-gray-300 min-w-[90px]">Saldo Final</th>
                </>
              ) : isCentro1000 ? (
                <>
                  <th className="px-2 py-1 text-right text-teal-600 min-w-[80px]" title="Plan (viable / ratio)">Tr. plan</th>
                  <th className="px-2 py-1 text-right text-teal-700 min-w-[80px]" title="Traslado efectivo tras priorizar ventas">Tr. efec.</th>
                  <th className="px-2 py-1 text-right text-cyan-600 min-w-[90px]">Queda 1000</th>
                  <th className="px-2 py-1 text-right text-red-600 border-r-2 border-gray-300 min-w-[80px]">Def.Gral</th>
                </>
              ) : (
                <>
                  <th className="px-2 py-1 text-right text-red-600 min-w-[80px]">Def.Gral</th><th className="px-2 py-1 text-right text-teal-600 min-w-[90px]">Entradas</th>
                  <th className="px-2 py-1 text-right text-purple-600 border-r-2 border-gray-300 min-w-[80px]">Def.Neto</th>
                </>
              )}
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {paginatedData.map((row: any, idx: number) => (
              <DataRow key={`row-${row.CodMaterial}-${idx}`} row={row} idx={idx} linea={row.lineaRef} isCentro1000={isCentro1000} showSaldos={showSaldos} isMounted={isMounted} />
            ))}
          </tbody>
          <tfoot className="sticky bottom-0 z-20 bg-gray-800 text-white font-bold text-[10px]">
            <tr>
              <td colSpan={11} className="px-2 py-2 border-r-2 border-gray-600">TOTALES FILTRADOS</td>
              <td className="px-2 py-2 text-right font-mono text-teal-300 min-w-[80px]">{formatTotal(totals.traslados)}</td>
              <td className="px-2 py-2 text-right font-mono text-gray-300 min-w-[80px]">{formatTotal(totals.necPropia)}</td>
              <td className="px-2 py-2 text-right font-mono text-blue-300 border-r-2 border-gray-600 min-w-[90px]">{formatTotal(totals.necesidad)}</td>
              <td className="px-2 py-2 text-right font-mono text-blue-200 min-w-[80px]">{formatTotal(totals.tiempoNec, 1)}</td>
              <td className="min-w-[60px]"></td><td className="px-2 py-2 text-right font-mono text-blue-200 min-w-[90px]">{formatTotal(totals.dispMinJN)}</td>
              <td className="px-2 py-2 text-right font-mono text-blue-300 min-w-[80px]">{formatTotal(totals.maxJN)}</td>
              <td className="px-2 py-2 text-right font-mono text-green-300 border-r-2 border-gray-600 min-w-[80px]">{formatTotal(totals.defJN)}</td>
              <td className="px-2 py-2 text-right font-mono text-green-200 min-w-[80px]">{formatTotal(totals.tDefJN, 1)}</td>
              <td className="min-w-[60px]"></td><td className="px-2 py-2 text-right font-mono text-green-200 min-w-[90px]">{formatTotal(totals.tMinHE)}</td>
              <td className="px-2 py-2 text-right font-mono text-green-300 min-w-[80px]">{formatTotal(totals.maxHE)}</td>
              <td className="px-2 py-2 text-right font-mono text-orange-300 border-r-2 border-gray-600 min-w-[80px]">{formatTotal(totals.defHE)}</td>
              <td className="px-2 py-2 text-right font-mono text-orange-200 min-w-[80px]">{formatTotal(totals.tDefHE, 1)}</td>
              <td className="min-w-[60px]"></td><td className="px-2 py-2 text-right font-mono text-orange-200 min-w-[90px]">{formatTotal(totals.tMinSAB)}</td>
              <td className="px-2 py-2 text-right font-mono text-orange-300 min-w-[80px]">{formatTotal(totals.maxSAB)}</td>
              <td className="px-2 py-2 text-right font-mono text-orange-200 border-r-2 border-gray-600 min-w-[80px]">{formatTotal(totals.defSAB)}</td>
              <td className="px-2 py-2 text-right font-mono text-purple-300 bg-purple-900/20 border-r-2 border-gray-600 min-w-[90px]">{formatTotal(totals.viable)}</td>
              {showSaldos ? (
                <>
                  <td className="px-2 py-2 text-right font-mono text-red-300 min-w-[80px]">{formatTotal(totals.defGral)}</td>
                  <td className="px-2 py-2 text-right font-mono text-teal-300 min-w-[90px]">{formatTotal(totals.trViable)}</td>
                  <td className="px-2 py-2 text-right font-mono text-indigo-300 min-w-[90px]">{formatTotal(totals.stockIni)}</td>
                  <td className="px-2 py-2 text-right font-mono text-gray-300 min-w-[80px]">{formatTotal(totals.demanda)}</td>
                  <td className="px-2 py-2 text-right font-mono text-green-300 min-w-[90px]">{formatTotal(totals.demCubierta)}</td>
                  <td className="px-2 py-2 text-right font-mono text-blue-300 min-w-[80px]">{formatTotal(totals.backlog)}</td>
                  <td className="px-2 py-2 text-right font-mono text-amber-200 min-w-[80px]">{formatTotal(totals.backlogTrasl)}</td>
                  <td className="px-2 py-2 text-right font-mono border-r-2 border-gray-600 min-w-[90px]">{formatTotal(totals.saldoFinal)}</td>
                </>
              ) : isCentro1000 ? (
                <>
                  <td className="px-2 py-2 text-right font-mono text-teal-300 min-w-[80px]">{formatTotal(totals.envio2000Plan)}</td>
                  <td className="px-2 py-2 text-right font-mono text-teal-200 min-w-[80px]">{formatTotal(totals.envio2000)}</td>
                  <td className="px-2 py-2 text-right font-mono text-cyan-300 min-w-[90px]">{formatTotal(totals.queda1000)}</td>
                  <td className="px-2 py-2 text-right font-mono border-r-2 border-gray-600 min-w-[80px]">{formatTotal(totals.defGral)}</td>
                </>
              ) : (
                <>
                  <td className="px-2 py-2 text-right font-mono text-red-300 min-w-[80px]">{formatTotal(totals.defGral)}</td>
                  <td className="px-2 py-2 text-right font-mono text-teal-300 min-w-[90px]">{formatTotal(totals.trViable)}</td>
                  <td className="px-2 py-2 text-right font-mono border-r-2 border-gray-600 min-w-[80px]">{formatTotal(totals.defNeto)}</td>
                </>
              )}
            </tr>
          </tfoot>
        </table>
      </div>
      
      <div className="px-4 py-2 bg-gray-50 border-t border-gray-200 flex justify-between items-center text-xs">
        <span className="text-gray-600">Página {currentPage} de {totalPages}</span>
        <div className="flex gap-1">
          <button onClick={() => setCurrentPage(p => Math.max(1, p - 1))} disabled={currentPage === 1} className="px-2 py-1 border rounded disabled:opacity-50 hover:bg-white">Anterior</button>
          <button onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))} disabled={currentPage === totalPages} className="px-2 py-1 border rounded disabled:opacity-50 hover:bg-white">Siguiente</button>
        </div>
      </div>
    </div>
  );
};
