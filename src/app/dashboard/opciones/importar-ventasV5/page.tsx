'use client';

import React, { useEffect, useState } from 'react';
import { serviciosService } from '@/services/servicios.service';
import { restriccionService } from '@/services/restriccion.service';
import type { FilterOptions } from '../importar-ventasV2/components/types';
import { getMesNumero } from '../importar-ventasV2/components/utils';
import { ImportarVentas5Section } from './components/ImportarVentas5Section';

/**
 * Pagina IV5 (Importar Ventas 5).
 *
 * Espejo simplificado de IV4: levanta opciones de filtros (anios, meses, centros)
 * y restricciones (NUMERO_MAXIMO_SABADOS, MAX_EXTRAS_HORAS, HORAS_TRABAJO,
 * HORAS_EXTRAS_FIN_SEMANA, DIAS_INV_OBJETIVO_*) y delega toda la logica a
 * `ImportarVentas5Section`. Aislada de IV3/IV4 (no comparte estado ni servicios
 * de escritura distintos a planGlobal/detalles, que se reusan tal cual).
 */
export default function ImportarVentasV5Page() {
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
        console.error('Error al cargar restricciones (IV5):', error);
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
        console.error('Error al cargar opciones de filtros (IV5):', error);
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
          <h1 className="text-xl font-semibold text-gray-800">Importar Ventas 5 - Motor IV5 con regresiva semanal y tope agregado</h1>
          <p className="text-sm text-gray-500 mt-0.5">
            Pestana independiente, no afecta IV3 ni IV4. Granularidad semanal, anticipos proporcionales,
            multilinea hibrido, mini-pasada PIO mensual y validacion de tope agregado de stock.
          </p>
        </div>
      </div>
      <div className="p-6">
        <ImportarVentas5Section
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
