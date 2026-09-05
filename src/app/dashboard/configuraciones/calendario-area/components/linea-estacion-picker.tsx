"use client";

import { useState, useEffect } from 'react';
import { Linea, Estacion } from '@/types/interfaces';
import { lineaService } from '@/services/linea.service';
import { estacionService } from '@/services/estacion.service';
import { ChevronDown, ChevronRight } from 'lucide-react';

interface LineaEstacionPickerProps {
  selectedData: Map<number, number[]>; // Map<codigo_linea, number[]> de codigo_estaciones
  onChange: (selectedData: Map<number, number[]>) => void;
  codigoGrupo?: number | null;
}

interface LineaConEstaciones {
  linea: Linea;
  estaciones: Estacion[];
  isExpanded: boolean;
}

const buildLineasConEstaciones = (lineas: Linea[], estaciones: Estacion[]): LineaConEstaciones[] => {
  return lineas.map(linea => ({
    linea,
    estaciones: estaciones.filter(est => est.codigo_linea === linea.codigo_linea),
    isExpanded: false,
  }));
};

export default function LineaEstacionPicker({ selectedData, onChange, codigoGrupo }: Readonly<LineaEstacionPickerProps>) {
  const [lineasConEstaciones, setLineasConEstaciones] = useState<LineaConEstaciones[]>([]);
  const [expandedLineas, setExpandedLineas] = useState<Set<number>>(new Set());
  const [isLoading, setIsLoading] = useState(true);

  // Cargar líneas y estaciones
  useEffect(() => {
    const loadData = async () => {
      // Si no se ha elegido grupo, no mostramos líneas ni estaciones
      if (!codigoGrupo) {
        setLineasConEstaciones([]);
        setIsLoading(false);
        return;
      }

      try {
        const [lineasRes, estacionesRes] = await Promise.all([
          lineaService.getAll(),
          estacionService.getAll(),
        ]);

        const allLineas = lineasRes.data || [];
        const estaciones = estacionesRes.data || [];

        // Filtrar líneas por el grupo seleccionado
        const lineas = allLineas.filter(l => l.codigo_grupo === codigoGrupo);

        const lineasConEst = buildLineasConEstaciones(lineas, estaciones);
        setLineasConEstaciones(lineasConEst);
        // colapsar lista al cambiar de grupo
        setExpandedLineas(new Set());
      } catch (error) {
        console.error('Error cargando líneas y estaciones:', error);
      } finally {
        setIsLoading(false);
      }
    };

    loadData();
  }, [codigoGrupo]);

  const toggleLineaExpanded = (codigoLinea: number) => {
    const newExpanded = new Set(expandedLineas);
    if (newExpanded.has(codigoLinea)) {
      newExpanded.delete(codigoLinea);
    } else {
      newExpanded.add(codigoLinea);
    }
    setExpandedLineas(newExpanded);
  };

  const isLineaSelected = (codigoLinea: number) => {
    const estacionesDelLinea = lineasConEstaciones.find(l => l.linea.codigo_linea === codigoLinea)?.estaciones || [];
    if (estacionesDelLinea.length === 0) return false;
    const selectedEstaciones = selectedData.get(codigoLinea) || [];
    // Línea seleccionada si ALL sus estaciones están seleccionadas
    return estacionesDelLinea.every(est => selectedEstaciones.includes(est.codigo_estacion));
  };

  const isLineaPartiallySelected = (codigoLinea: number) => {
    const selectedEstaciones = selectedData.get(codigoLinea) || [];
    return selectedEstaciones.length > 0 && !isLineaSelected(codigoLinea);
  };

  const toggleLineaSelection = (codigoLinea: number) => {
    const estacionesDelLinea = lineasConEstaciones.find(l => l.linea.codigo_linea === codigoLinea)?.estaciones || [];
    const newData = new Map(selectedData);

    if (isLineaSelected(codigoLinea)) {
      // Desmarcar toda la línea
      newData.delete(codigoLinea);
    } else {
      // Marcar toda la línea
      const estacionesIds = estacionesDelLinea.map(est => est.codigo_estacion);
      newData.set(codigoLinea, estacionesIds);
    }

    onChange(newData);
  };

  const toggleEstacionSelection = (codigoLinea: number, codigoEstacion: number) => {
    const newData = new Map(selectedData);
    const selectedEstaciones = newData.get(codigoLinea) || [];

    if (selectedEstaciones.includes(codigoEstacion)) {
      // Desmarcar estación
      const updated = selectedEstaciones.filter(est => est !== codigoEstacion);
      if (updated.length === 0) {
        newData.delete(codigoLinea);
      } else {
        newData.set(codigoLinea, updated);
      }
    } else {
      // Marcar estación
      newData.set(codigoLinea, [...selectedEstaciones, codigoEstacion]);
    }

    onChange(newData);
  };

  if (isLoading) {
    return <div className="text-center py-4 text-gray-500">Cargando líneas y estaciones...</div>;
  }

  // Si no hay grupo seleccionado, pedir que el usuario seleccione primero
  if (!codigoGrupo) {
    return (
      <div className="space-y-2">
        <div className="block text-sm font-medium text-gray-700">Línea(s) y Estación(es) <span className="text-red-500">*</span></div>
        <div className="border rounded-md p-4 bg-gray-50 text-gray-500">Selecciona primero un Grupo para ver las líneas y estaciones asociadas.</div>
        <p className="text-xs text-gray-500 italic">Selecciona un grupo arriba para filtrar líneas y estaciones.</p>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      <div className="block text-sm font-medium text-gray-700">
        Línea(s) y Estación(es) <span className="text-red-500">*</span>
      </div>
      <div className="border rounded-md p-4 bg-white max-h-80 overflow-y-auto space-y-2">
        {lineasConEstaciones.length === 0 ? (
          <p className="text-gray-500 text-sm">No hay líneas disponibles</p>
        ) : (
          lineasConEstaciones.map(({ linea, estaciones }) => (
            <div key={linea.codigo_linea} className="space-y-1">
              {/* Checkbox de Línea */}
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => toggleLineaExpanded(linea.codigo_linea)}
                  className="p-0 hover:bg-gray-100 rounded flex-shrink-0"
                >
                  {expandedLineas.has(linea.codigo_linea) ? (
                    <ChevronDown className="w-4 h-4 text-gray-600" />
                  ) : (
                    <ChevronRight className="w-4 h-4 text-gray-600" />
                  )}
                </button>
                <input
                  type="checkbox"
                  id={`linea-${linea.codigo_linea}`}
                  checked={isLineaSelected(linea.codigo_linea)}
                  onChange={() => toggleLineaSelection(linea.codigo_linea)}
                  className={`w-4 h-4 text-primary border-gray-300 rounded cursor-pointer ${
                    isLineaPartiallySelected(linea.codigo_linea) ? 'opacity-50' : ''
                  }`}
                />
                <label
                  htmlFor={`linea-${linea.codigo_linea}`}
                  className="text-sm font-semibold text-gray-700 cursor-pointer flex-1"
                >
                  {linea.nombre_linea}
                </label>
              </div>

              {/* Estaciones de la Línea */}
              {expandedLineas.has(linea.codigo_linea) && estaciones.length > 0 && (
                <div className="ml-6 space-y-1">
                  {estaciones.map(estacion => (
                    <div key={estacion.codigo_estacion} className="flex items-center gap-2">
                      <input
                        type="checkbox"
                        id={`estacion-${estacion.codigo_estacion}`}
                        checked={(selectedData.get(linea.codigo_linea) || []).includes(estacion.codigo_estacion)}
                        onChange={() => toggleEstacionSelection(linea.codigo_linea, estacion.codigo_estacion)}
                        className="w-4 h-4 text-primary border-gray-300 rounded cursor-pointer"
                      />
                      <label
                        htmlFor={`estacion-${estacion.codigo_estacion}`}
                        className="text-sm text-gray-600 cursor-pointer flex-1"
                      >
                        {estacion.nombre_estacion}
                      </label>
                    </div>
                  ))}
                </div>
              )}
            </div>
          ))
        )}
      </div>
      <p className="text-xs text-gray-500 italic">
        Selecciona líneas: marca automáticamente todas sus estaciones. O selecciona estaciones individuales.
      </p>
    </div>
  );
}
