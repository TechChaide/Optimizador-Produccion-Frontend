'use client';

import React, { useEffect, useState } from 'react';
import { serviciosService } from '@/services/servicios.service';
import { restriccionService } from '@/services/restriccion.service';
import type { FilterOptions } from '../importar-ventasV2/components/types';
import { getMesNumero } from '../importar-ventasV2/components/utils';
import { ImportarVentas4Section } from './components/ImportarVentas4Section';

export default function ImportarVentasV4Page() {
  const [filterOptions, setFilterOptions] = useState<FilterOptions>({ años: [], meses: [], centros: [] });
  const [isLoadingOptions, setIsLoadingOptions] = useState(true);
  const [numMaximoSabados, setNumMaximoSabados] = useState<number>(0);
  const [maxExtrasHoras, setMaxExtrasHoras] = useState<number>(0);
  const [horasTrabajo, setHorasTrabajo] = useState<number>(0);
  const [horasExtrasFin, setHorasExtrasFin] = useState<number>(0);
  const [restriccionesPIO, setRestriccionesPIO] = useState<any[]>([]);

  useEffect(() => {
    const loadRestrictions = async () => {
      try {
        const restrictionsRes = await restriccionService.getAll();
        const rows = restrictionsRes.data ?? [];
        const restriccionSabados = rows.find((r: any) => r.nombre_restriccion === 'NUMERO_MAXIMO_SABADOS');
        const restriccionMaxExtras = rows.find((r: any) => r.nombre_restriccion === 'MAX_EXTRAS_HORAS');
        const restriccionHorasTrabajo = rows.find((r: any) => r.nombre_restriccion === 'HORAS_TRABAJO');
        const restriccionHorasExtrasFin = rows.find((r: any) => r.nombre_restriccion === 'HORAS_EXTRAS_FIN_SEMANA');

        if (restriccionSabados) setNumMaximoSabados(Number(restriccionSabados.valor_restriccion) || 0);
        if (restriccionMaxExtras) setMaxExtrasHoras(Number(restriccionMaxExtras.valor_restriccion) || 0);
        if (restriccionHorasTrabajo) setHorasTrabajo(Number(restriccionHorasTrabajo.valor_restriccion) || 8);
        if (restriccionHorasExtrasFin) setHorasExtrasFin(Number(restriccionHorasExtrasFin.valor_restriccion) || 0);

        const pio = rows.filter((r: any) =>
          String(r.nombre_restriccion ?? '').startsWith('DIAS_INV_OBJETIVO_') ||
          r.nombre_restriccion === 'TOP_N_INV_OBJETIVO',
        );
        setRestriccionesPIO(pio);
      } catch (error) {
        console.error('Error al cargar restricciones (IV4):', error);
      }
    };
    loadRestrictions();
  }, []);

  useEffect(() => {
    const loadFilterOptions = async () => {
      try {
        const [yearsRes, mesesRes, centrosRes] = await Promise.all([
          serviciosService.getYears(),
          serviciosService.getMeses(),
          serviciosService.getCentros(),
        ]);

        setFilterOptions({
          años: (yearsRes.data || []).map((item: any) => ({
            value: String(item.Año || item.año || item),
            label: String(item.Año || item.año || item),
          })).sort((a: any, b: any) => Number(b.value) - Number(a.value)),
          meses: (mesesRes.data || []).map((item: any) => ({
            value: String(item.Mes || item.mes || item),
            label: String(item.Mes || item.mes || item),
          })),
          centros: (centrosRes.data || []).map((item: any) => ({
            value: item.Centro || item.centro || item,
            label: item.Centro || item.centro || item,
          })),
        });
      } catch (error) {
        console.error('Error al cargar opciones de filtros (IV4):', error);
      } finally {
        setIsLoadingOptions(false);
      }
    };
    loadFilterOptions();
  }, []);

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="bg-white border-b border-gray-200 shadow-sm">
        <div className="px-6 py-4">
          <h1 className="text-xl font-semibold text-gray-800">Importar Ventas 4 - Ledger semanal/mensual</h1>
          <p className="text-sm text-gray-500 mt-0.5">
            Demanda ajustada como fuente unica; ledger consistente entre semana y mes; sabados editables.
          </p>
        </div>
      </div>
      <div className="p-6">
        <ImportarVentas4Section
          filterOptions={filterOptions}
          isLoadingOptions={isLoadingOptions}
          numMaximoSabados={numMaximoSabados}
          maxExtrasHoras={maxExtrasHoras}
          horasTrabajo={horasTrabajo}
          horasExtrasFin={horasExtrasFin}
          restriccionesPIO={restriccionesPIO}
          getMesNumero={getMesNumero}
        />
      </div>
    </div>
  );
}
