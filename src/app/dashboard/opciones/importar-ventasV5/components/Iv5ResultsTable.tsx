'use client';

import React, { useMemo } from 'react';
import type { Iv5MonthlySnapshot, Iv5WeeklyRow } from './iv5Types';

interface Props {
  view: 'mensual' | 'semanal';
  monthlyRows: Iv5MonthlySnapshot[];
  weeklyRows: Iv5WeeklyRow[];
  /** Limite visual para evitar reflows pesados; el archivo Excel descarga todo. */
  rowLimitMonthly?: number;
  rowLimitWeekly?: number;
}

function fmt(n: number): string {
  if (!Number.isFinite(n)) return '-';
  return Math.round(n).toLocaleString('es-EC');
}

function totalProduccionMonthly(r: Iv5MonthlySnapshot): number {
  return r.produccionBase + r.produccionAlternativa + r.produccionAdelanto + r.produccionPio;
}

function totalProduccionWeekly(r: Iv5WeeklyRow): number {
  return r.produccionBase + r.produccionAlternativa + r.produccionAdelanto + r.produccionPio;
}

/**
 * Tabla principal IV5 con vista mensual y vista semanal.
 *
 * Columnas alineadas con la regla de auditoria:
 *   StockFinal = StockInicial + ProduccionTotal + TraslEntr - Despachos - TraslSal
 * y `ProduccionTotal = base + alternativa + adelanto + PIO` para que el usuario
 * pueda contrastar manualmente con el reporte agregado por sector.
 */
export const Iv5ResultsTable: React.FC<Props> = ({
  view,
  monthlyRows,
  weeklyRows,
  rowLimitMonthly = 800,
  rowLimitWeekly = 1500,
}) => {
  const monthlySorted = useMemo(() => {
    return [...monthlyRows].sort((a, b) => {
      if (a.centro !== b.centro) return a.centro.localeCompare(b.centro);
      if (a.anio !== b.anio) return a.anio - b.anio;
      if (a.mes !== b.mes) return a.mes - b.mes;
      if (a.sectorRef !== b.sectorRef) return a.sectorRef.localeCompare(b.sectorRef);
      if (a.linea !== b.linea) return a.linea.localeCompare(b.linea);
      return a.material.localeCompare(b.material);
    });
  }, [monthlyRows]);

  const weeklySorted = useMemo(() => {
    return [...weeklyRows].sort((a, b) => {
      if (a.centro !== b.centro) return a.centro.localeCompare(b.centro);
      if (a.isoYear !== b.isoYear) return a.isoYear - b.isoYear;
      if (a.isoWeek !== b.isoWeek) return a.isoWeek - b.isoWeek;
      if (a.sectorRef !== b.sectorRef) return a.sectorRef.localeCompare(b.sectorRef);
      if (a.linea !== b.linea) return a.linea.localeCompare(b.linea);
      return a.material.localeCompare(b.material);
    });
  }, [weeklyRows]);

  if (view === 'mensual') {
    const limited = monthlySorted.slice(0, rowLimitMonthly);
    return (
      <div className="overflow-x-auto border border-gray-200 rounded">
        <table className="min-w-full text-[11px]">
          <thead className="bg-gray-100">
            <tr>
              <th className="px-2 py-1 text-left">Centro</th>
              <th className="px-2 py-1 text-left">Mes</th>
              <th className="px-2 py-1 text-left">Sector</th>
              <th className="px-2 py-1 text-left">Linea</th>
              <th className="px-2 py-1 text-left">Material</th>
              <th className="px-2 py-1 text-right">Demanda ventas</th>
              <th className="px-2 py-1 text-right">Req traslado</th>
              <th className="px-2 py-1 text-right bg-blue-50 font-semibold">Demanda plan</th>
              <th className="px-2 py-1 text-right">Despachos</th>
              <th className="px-2 py-1 text-right">Prod base</th>
              <th className="px-2 py-1 text-right">Prod adelanto</th>
              <th className="px-2 py-1 text-right">Prod alt</th>
              <th className="px-2 py-1 text-right">Prod PIO</th>
              <th className="px-2 py-1 text-right bg-blue-50 font-semibold">Prod total</th>
              <th className="px-2 py-1 text-right">Tras entr</th>
              <th className="px-2 py-1 text-right">Tras sal</th>
              <th className="px-2 py-1 text-right">Stock ini</th>
              <th className="px-2 py-1 text-right">Stock fin</th>
              <th className="px-2 py-1 text-right text-amber-700">Stock res</th>
              <th className="px-2 py-1 text-right bg-amber-50 font-semibold">Stock fis</th>
              <th className="px-2 py-1 text-right">Backlog ini</th>
              <th className="px-2 py-1 text-right">Backlog fin</th>
              <th className="px-2 py-1 text-right">Cap total</th>
              <th className="px-2 py-1 text-right">Sabados</th>
              <th className="px-2 py-1 text-right">Idle min</th>
            </tr>
          </thead>
          <tbody>
            {limited.length === 0 ? (
              <tr>
                <td colSpan={25} className="px-2 py-3 text-center text-gray-500 italic">
                  Sin datos para mostrar.
                </td>
              </tr>
            ) : (
              limited.map((r) => {
                const total = totalProduccionMonthly(r);
                return (
                  <tr
                    key={`${r.centro}|${r.linea}|${r.material}|${r.anio}|${r.mes}`}
                    className="hover:bg-gray-50"
                  >
                    <td className="px-2 py-1">{r.centro}</td>
                    <td className="px-2 py-1 whitespace-nowrap">{r.mesNombre}</td>
                    <td className="px-2 py-1">{r.sectorRef}</td>
                    <td className="px-2 py-1">{r.linea}</td>
                    <td className="px-2 py-1 font-mono">{r.material}</td>
                    <td className="px-2 py-1 text-right">{fmt(r.demanda)}</td>
                    <td className="px-2 py-1 text-right">{fmt(r.necesidadTraslado)}</td>
                    <td className="px-2 py-1 text-right font-semibold bg-blue-50">{fmt(r.demandaPlan)}</td>
                    <td className="px-2 py-1 text-right">{fmt(r.despachosVentas)}</td>
                    <td className="px-2 py-1 text-right">{fmt(r.produccionBase)}</td>
                    <td className="px-2 py-1 text-right">{fmt(r.produccionAdelanto)}</td>
                    <td className="px-2 py-1 text-right">{fmt(r.produccionAlternativa)}</td>
                    <td className="px-2 py-1 text-right">{fmt(r.produccionPio)}</td>
                    <td className="px-2 py-1 text-right font-semibold bg-blue-50">{fmt(total)}</td>
                    <td className="px-2 py-1 text-right">{fmt(r.trasladoEntrante)}</td>
                    <td className="px-2 py-1 text-right">{fmt(r.trasladoSaliente)}</td>
                    <td className="px-2 py-1 text-right">{fmt(r.stockInicialMes)}</td>
                    <td className="px-2 py-1 text-right">{fmt(r.stockFinalMes)}</td>
                    <td className="px-2 py-1 text-right text-amber-700">
                      {r.stockReservadoMes !== undefined ? fmt(r.stockReservadoMes) : '-'}
                    </td>
                    <td className="px-2 py-1 text-right font-semibold bg-amber-50">
                      {r.stockFinalFisicoMes !== undefined ? fmt(r.stockFinalFisicoMes) : '-'}
                    </td>
                    <td className="px-2 py-1 text-right">{fmt(r.backlogInicialMes)}</td>
                    <td className="px-2 py-1 text-right">{fmt(r.backlogFinalMes)}</td>
                    <td className="px-2 py-1 text-right">{fmt(r.capTotalMes)}</td>
                    <td className="px-2 py-1 text-right">{r.sabadosActivos}</td>
                    <td className="px-2 py-1 text-right">{fmt(r.idleMes)}</td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
        {monthlySorted.length > rowLimitMonthly && (
          <p className="text-[10px] text-gray-500 italic px-2 py-1">
            Mostrando primeras {rowLimitMonthly} de {monthlySorted.length.toLocaleString('es-EC')} filas; usa
            los filtros o descarga a Excel.
          </p>
        )}
      </div>
    );
  }

  // Vista semanal
  const limited = weeklySorted.slice(0, rowLimitWeekly);
  return (
    <div className="overflow-x-auto border border-gray-200 rounded">
      <table className="min-w-full text-[11px]">
        <thead className="bg-gray-100">
          <tr>
            <th className="px-2 py-1 text-left">Centro</th>
            <th className="px-2 py-1 text-left">Mes</th>
            <th className="px-2 py-1 text-left">Semana</th>
            <th className="px-2 py-1 text-left">Sector</th>
            <th className="px-2 py-1 text-left">Linea</th>
            <th className="px-2 py-1 text-left">Material</th>
            <th className="px-2 py-1 text-right">Demanda ventas</th>
            <th className="px-2 py-1 text-right">Req traslado</th>
            <th className="px-2 py-1 text-right bg-blue-50 font-semibold">Demanda plan</th>
            <th className="px-2 py-1 text-right">Despachos</th>
            <th className="px-2 py-1 text-right">Backlog ini</th>
            <th className="px-2 py-1 text-right">Backlog gen</th>
            <th className="px-2 py-1 text-right">Backlog fin</th>
            <th className="px-2 py-1 text-right">Prod base</th>
            <th className="px-2 py-1 text-right">Prod alt</th>
            <th className="px-2 py-1 text-right">Prod adelanto</th>
            <th className="px-2 py-1 text-right">Prod PIO</th>
            <th className="px-2 py-1 text-right bg-blue-50 font-semibold">Prod total</th>
            <th className="px-2 py-1 text-right">Tras entr</th>
            <th className="px-2 py-1 text-right">Tras sal</th>
            <th className="px-2 py-1 text-right">Stock ini</th>
            <th className="px-2 py-1 text-right">Stock fin</th>
            <th className="px-2 py-1 text-right text-amber-700">Stock res</th>
            <th className="px-2 py-1 text-right bg-amber-50 font-semibold">Stock fis</th>
            <th className="px-2 py-1 text-right">Cap total</th>
            <th className="px-2 py-1 text-right">Idle</th>
            <th className="px-2 py-1 text-left">Alertas</th>
          </tr>
        </thead>
        <tbody>
          {limited.length === 0 ? (
            <tr>
              <td colSpan={27} className="px-2 py-3 text-center text-gray-500 italic">
                Sin datos para mostrar.
              </td>
            </tr>
          ) : (
            limited.map((r, idx) => {
              const prodTotal = totalProduccionWeekly(r);
              return (
                <tr
                  key={`${r.centro}|${r.linea}|${r.material}|${r.weekKey}|${idx}`}
                  className="hover:bg-gray-50"
                >
                  <td className="px-2 py-1">{r.centro}</td>
                  <td className="px-2 py-1 whitespace-nowrap">{r.mesNombre}</td>
                  <td className="px-2 py-1 whitespace-nowrap">{`${r.isoYear}W${r.isoWeek}`}</td>
                  <td className="px-2 py-1">{r.sectorRef}</td>
                  <td className="px-2 py-1">{r.linea}</td>
                  <td className="px-2 py-1 font-mono">{r.material}</td>
                  <td className="px-2 py-1 text-right">{fmt(r.demanda)}</td>
                  <td className="px-2 py-1 text-right">{fmt(r.necesidadTrasladoSemana)}</td>
                  <td className="px-2 py-1 text-right font-semibold bg-blue-50">{fmt(r.demanda + r.necesidadTrasladoSemana)}</td>
                  <td className="px-2 py-1 text-right">{fmt(r.despachosVentas)}</td>
                  <td className="px-2 py-1 text-right">{fmt(r.backlogInicial)}</td>
                  <td className="px-2 py-1 text-right">{fmt(r.backlogGenerado)}</td>
                  <td className="px-2 py-1 text-right">{fmt(r.backlogFinal)}</td>
                  <td className="px-2 py-1 text-right">{fmt(r.produccionBase)}</td>
                  <td className="px-2 py-1 text-right">{fmt(r.produccionAlternativa)}</td>
                  <td className="px-2 py-1 text-right">{fmt(r.produccionAdelanto)}</td>
                  <td className="px-2 py-1 text-right">{fmt(r.produccionPio)}</td>
                  <td className="px-2 py-1 text-right font-semibold bg-blue-50">{fmt(prodTotal)}</td>
                  <td className="px-2 py-1 text-right">{fmt(r.trasladoEntrante)}</td>
                  <td className="px-2 py-1 text-right">{fmt(r.trasladoSaliente)}</td>
                  <td className="px-2 py-1 text-right">{fmt(r.stockInicial)}</td>
                  <td
                    className={`px-2 py-1 text-right ${r.alertaStockBajoSeguridad ? 'text-red-600 font-semibold' : ''}`}
                  >
                    {fmt(r.stockFinal)}
                  </td>
                  <td className="px-2 py-1 text-right text-amber-700">
                    {r.stockReservado !== undefined ? fmt(r.stockReservado) : '-'}
                  </td>
                  <td className="px-2 py-1 text-right font-semibold bg-amber-50">
                    {r.stockFinalFisico !== undefined ? fmt(r.stockFinalFisico) : '-'}
                  </td>
                  <td className="px-2 py-1 text-right">{fmt(r.capTotal)}</td>
                  <td className="px-2 py-1 text-right">{fmt(r.idleSem)}</td>
                  <td className="px-2 py-1 whitespace-nowrap">
                    {r.alertaStockBajoSeguridad ? <span className="text-red-600">SS</span> : ''}
                    {r.alertaTopeAgregado ? <span className="text-red-600 ml-1">CAP</span> : ''}
                  </td>
                </tr>
              );
            })
          )}
        </tbody>
      </table>
      {weeklySorted.length > rowLimitWeekly && (
        <p className="text-[10px] text-gray-500 italic px-2 py-1">
          Mostrando primeras {rowLimitWeekly} de {weeklySorted.length.toLocaleString('es-EC')} filas; usa los
          filtros o descarga a Excel.
        </p>
      )}
    </div>
  );
};

export default Iv5ResultsTable;
