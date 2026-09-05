'use client';

import React, { useState, useMemo, forwardRef, useImperativeHandle } from 'react';
import { MONTH_NAMES } from './constants';
import { safeNumber, exportToXLSX } from './utils';
import { TiempoCanonResult, TransferNeed } from './types';

// Helper en-memoria para detalle de consumo de horas extras
function computarDetalleC1000(tc: TiempoCanonResult, minutosConsumir: number, maxExtrasHoras: number, horasExtrasFin: number): string {
  const semanasNorm = Math.floor((tc.diasLaborables ?? 0) / 5);
  const diasExtra = (tc.diasLaborables ?? 0) % 5;
  const diasSabados = tc.diasSabados ?? 0;
  let restantes = minutosConsumir;
  const partes: string[] = [];
  for (let i = 0; i < semanasNorm && restantes > 0; i++) {
    const minc = Math.min(5 * maxExtrasHoras * 60, restantes);
    if (minc > 0) { partes.push(`S${i+1}: ${minc/60 % 1 === 0 ? minc/60 : (minc/60).toFixed(1)}h`); restantes -= minc; }
  }
  if (diasExtra > 0 && restantes > 0) {
    const minc = Math.min(diasExtra * maxExtrasHoras * 60, restantes);
    if (minc > 0) { partes.push(`ExLV: ${minc/60 % 1 === 0 ? minc/60 : (minc/60).toFixed(1)}h`); restantes -= minc; }
  }
  for (let i = 0; i < diasSabados && restantes > 0; i++) {
    const minc = Math.min(horasExtrasFin * 60, restantes);
    if (minc > 0) { partes.push(`Sáb${i+1}: ${minc/60 % 1 === 0 ? minc/60 : (minc/60).toFixed(1)}h`); restantes -= minc; }
  }
  return partes.join(', ') || '-';
}

interface Centro1000DetailTableProps {
  datos: any[];
  tiemposCanon: TiempoCanonResult[];
  trasladosDesdeCentro2000: TransferNeed[];
  maxExtrasHoras?: number;
  horasExtrasFin?: number;
}

export interface Centro1000DetailTableHandle {
  getDatosEnriquecidos: () => any[];
}

export const Centro1000DetailTable = forwardRef<Centro1000DetailTableHandle, Centro1000DetailTableProps>(
  ({ datos, tiemposCanon, trasladosDesdeCentro2000, maxExtrasHoras = 0, horasExtrasFin = 0 }, ref) => {
  const [searchTerm, setSearchTerm] = useState<string>('');
  const [selectedLinea, setSelectedLinea] = useState<string>('');
  const [selectedRespCtrlProd, setSelectedRespCtrlProd] = useState<string>('');

  const trasladosMap = useMemo(() => {
    const map = new Map<string, number>();
    trasladosDesdeCentro2000.forEach(item => {
      map.set(item.CodMaterial, item.necesidadTraslado);
    });
    return map;
  }, [trasladosDesdeCentro2000]);

  const computeNecesidadesLocal = (row: any) => {
    const unidadesProy = safeNumber(row.UnidadesProyectado ?? 0);
    const stockSeg = safeNumber(row.StockSeguridad ?? 0);
    const stockAct = safeNumber(row.StockActual ?? 0);
    return Math.max(0, unidadesProy - stockAct + stockSeg);
  };

  const buscarTiempoCanonPorMes = (mesRaw: string) => {
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

  const crearMapaAgrupamiento = () => {
    const mapa: { [mesLinea: string]: { necesidades: number; count: number; mes: string; linea: string } } = {};
    
    datos.forEach(row => {
      const mes = String(row.Mes ?? 'Sin mes');
      const linea = String(row.LineaFabricacion ?? 'Sin línea');
      const key = `${mes}|${linea}`;
      const codMaterial = String(row.CodMaterial ?? '');
      const traslado = trasladosMap.get(codMaterial) || 0;
      
      if (!mapa[key]) {
        mapa[key] = { necesidades: 0, count: 0, mes, linea };
      }
      
      const necesidadPropia = computeNecesidadesLocal(row);
      mapa[key].necesidades += necesidadPropia + traslado;
      mapa[key].count += 1;
    });
    
    return mapa;
  };

  const mapaAgrupamiento = crearMapaAgrupamiento();

  // Función para normalizar nombres de líneas para comparación
  const normalizarLinea = (linea: string): string => {
    return String(linea).toLowerCase().replace(/\s+/g, '').replace('linea', '').replace('línea', '');
  };

  const obtenerTiempoDisponible = (mes: string, linea: string, puestoTrabajo: string | null, centro: string = '') => {
    const tiempoCanon = buscarTiempoCanonPorMes(mes);
    if (!tiempoCanon || !tiempoCanon.data || !Array.isArray(tiempoCanon.data)) return null;
    
    const lineaNorm = normalizarLinea(linea);
    const centroCodigo = String(centro).trim();
    
    // Primero filtrar por línea Y centro
    let registrosLinea = tiempoCanon.data.filter((item: any) => {
      const nombreLinea = normalizarLinea(item?.nombre_linea ?? '');
      const itemCentro = String(item?.centro ?? item?.Centro ?? '');
      const lineaMatches = nombreLinea === lineaNorm || nombreLinea.includes(lineaNorm) || lineaNorm.includes(nombreLinea);
      const centroMatches = centroCodigo === '' || itemCentro === centroCodigo;
      return lineaMatches && centroMatches;
    });
    
    // Si no encontramos registros CON centro específico, intentar sin el filtro de centro
    if (registrosLinea.length === 0 && centroCodigo !== '') {
      registrosLinea = tiempoCanon.data.filter((item: any) => {
        const nombreLinea = normalizarLinea(item?.nombre_linea ?? '');
        return nombreLinea === lineaNorm || nombreLinea.includes(lineaNorm) || lineaNorm.includes(nombreLinea);
      });
    }

    // Si no encontramos registros de la línea, intentar buscar por puesto en todos los datos
    if (registrosLinea.length === 0) {
      if (puestoTrabajo && puestoTrabajo !== '-' && puestoTrabajo !== '') {
        const pn = String(puestoTrabajo).toLowerCase().trim();
        const dp = tiempoCanon.data.find((item: any) => {
          const nombreEstacion = String(item?.nombre_estacion ?? '').toLowerCase().trim();
          return nombreEstacion.includes(pn) || pn.includes(nombreEstacion);
        });
        if (dp) {
          return {
            minutos_horario_normal: safeNumber(dp?.minutos_horario_normal_TOTAL ?? 0),
            minutos_con_extras: safeNumber(dp?.minutos_extras_TOTAL ?? 0),
            minutos_fin_semana: safeNumber(dp?.minutos_sabado_TOTAL ?? 0),
            minutos_horario_normal_total: safeNumber(dp?.minutos_horario_normal_TOTAL ?? 0),
            diasLaborables: tiempoCanon.diasLaborables,
            diasSabados: tiempoCanon.diasSabados
          };
        }
      }
      return null;
    }

    // Buscar primero el registro que coincida exactamente con puestoCuellodeBottella
    let puestoBotellaDato: any = null;
    if (puestoTrabajo && puestoTrabajo !== '-' && puestoTrabajo !== '') {
      const pn = String(puestoTrabajo).toLowerCase().trim();
      puestoBotellaDato = registrosLinea.find((dato: any) => {
        const nombreEstacion = String(dato?.nombre_estacion ?? '').toLowerCase().trim();
        return nombreEstacion === pn || nombreEstacion.includes(pn) || pn.includes(nombreEstacion);
      }) ?? null;
    }

    // Si no se encontró por nombre directo, usar frecuencia como fallback
    if (!puestoBotellaDato) {
      const estacionesMap = new Map<string, any>();
      registrosLinea.forEach((dato: any) => {
        const nombreEstacion = String(dato?.nombre_estacion ?? '-');
        if (!estacionesMap.has(nombreEstacion)) {
          estacionesMap.set(nombreEstacion, { count: 0, dato });
        }
        estacionesMap.get(nombreEstacion)!.count += 1;
      });
      let maxFrequencia = 0;
      estacionesMap.forEach(({ count, dato }) => {
        if (count > maxFrequencia) { maxFrequencia = count; puestoBotellaDato = dato; }
      });
    }

    // Si no encontramos puesto de botella, retornar null
    if (!puestoBotellaDato) {
      console.warn(`[obtenerTiempoDisponible] No se encontró puesto de botella para Línea: ${linea}, Mes: ${mes}`);
      return null;
    }

    // Usar SOLO el tiempo del puesto de botella con minutos_horario_normal_TOTAL (consistente con Centro 2000)
    const minutos_horario_normal = safeNumber(puestoBotellaDato?.minutos_horario_normal_TOTAL ?? 0);
    const minutos_con_extras = safeNumber(puestoBotellaDato?.minutos_extras_TOTAL ?? 0);
    const minutos_fin_semana = safeNumber(puestoBotellaDato?.minutos_sabado_TOTAL ?? 0);
    const minutos_horario_normal_total = safeNumber(puestoBotellaDato?.minutos_horario_normal_TOTAL ?? 0);

    console.log(`[obtenerTiempoDisponible-CORREGIDO] Mes: ${mes}, Centro: ${centro}, Línea: ${linea}, Puesto Botella: ${puestoBotellaDato?.nombre_estacion}`, {
      minutos_horario_normal,
      minutos_con_extras,
      minutos_fin_semana,
    });

    return {
      minutos_horario_normal,
      minutos_con_extras,
      minutos_fin_semana,
      minutos_horario_normal_total,
      diasLaborables: tiempoCanon.diasLaborables,
      diasSabados: tiempoCanon.diasSabados
    };
  };

  // Paso previo: calcular suma de T. Total Necesidad Inicial por (mes, línea)
  // y obtener el T. Disponible global (minutos_horario_normal_TOTAL) por (mes, línea)
  const sumaTiempoNecPorLinea: { [k: string]: number } = {};
  const tiempoDispGlobalPorLinea: { [k: string]: number } = {};

  datos.forEach(row => {
    const mes = String(row.Mes ?? 'Sin mes');
    const linea = String(row.LineaFabricacion ?? 'Sin línea');
    const key = `${mes}|${linea}`;
    const codMaterial = String(row.CodMaterial ?? '');
    const traslado = trasladosMap.get(codMaterial) || 0;
    const necesidadTotal = computeNecesidadesLocal(row) + traslado;
    const tiempoPorUnidad = safeNumber(row.TiempoPorUnidad ?? 0);
    const numeroPuestos = safeNumber(row.NumeroPuestos ?? row.numero_puestos ?? 1);
    const tiempoUnitarioPorPuesto = numeroPuestos > 0 ? tiempoPorUnidad / numeroPuestos : 0;
    const tiempoTotalNecesidad = tiempoUnitarioPorPuesto * necesidadTotal;

    sumaTiempoNecPorLinea[key] = (sumaTiempoNecPorLinea[key] || 0) + tiempoTotalNecesidad;

    if (tiempoDispGlobalPorLinea[key] === undefined) {
      const tiempoDisp = obtenerTiempoDisponible(mes, linea, row.PuestoCuellodeBottella, row.Centro);
      tiempoDispGlobalPorLinea[key] = tiempoDisp?.minutos_horario_normal ?? 0;
    }
  });

  const enriquecerFila = (row: any, extrasOverride?: { [key: string]: number }, detalleOverride?: { [key: string]: string }) => {
    const mes = String(row.Mes ?? 'Sin mes');
    const linea = String(row.LineaFabricacion ?? 'Sin línea');
    const key = `${mes}|${linea}`;
    const codMaterial = String(row.CodMaterial ?? '');
    const traslado = trasladosMap.get(codMaterial) || 0;
    const necesidadPropia = computeNecesidadesLocal(row);
    const necesidadTotal = necesidadPropia + traslado;
    
    const mapaLinea = mapaAgrupamiento[key];
    const sumaNecesidadesEnLinea = mapaLinea?.necesidades ?? necesidadTotal;
    
    const participacionIndividual = sumaNecesidadesEnLinea > 0 
      ? (necesidadTotal / sumaNecesidadesEnLinea) * 100 
      : 0;
    
    const tiempoPorUnidad = safeNumber(row.TiempoPorUnidad ?? 0);
    const numeroPuestos = safeNumber(row.NumeroPuestos ?? row.numero_puestos ?? 1);
    const tiempoUnitarioPorPuesto = numeroPuestos > 0 ? tiempoPorUnidad / numeroPuestos : 0;
    
    // T. Total necesidad inicial = (Tiempo Unitarío / Puestos) * Necesidades
    const tiempoTotalNecesidad = tiempoUnitarioPorPuesto * necesidadTotal;
    
    const tiempoDisp = obtenerTiempoDisponible(mes, linea, row.PuestoCuellodeBottella, row.Centro);
    
    let necesidadMaximaAFabricar = 0;
    let horasExtrasUsadas = 0;
    let tMaxProm = 0;
    let tiempoParaMaterial = 0;
    const extrasMap = extrasOverride ?? {};
    
    if (tiempoDisp && tiempoPorUnidad > 0) {
      const tiempoDisponibleBase = tiempoDisp.minutos_horario_normal;
      
      // Calcular tiempo disponible para este material según su participación con base en horario normal
      tiempoParaMaterial = (participacionIndividual / 100) * tiempoDisponibleBase;
      
      // Decisión GLOBAL: comparar suma de T. Total Necesidad Inicial de TODA la línea vs T. Disponible global
      const sumaTiempoNecLinea = sumaTiempoNecPorLinea[key] || 0;
      const tiempoDispGlobal = tiempoDispGlobalPorLinea[key] || 0;
      
      if (sumaTiempoNecLinea <= tiempoDispGlobal) {
        // Si el tiempo total de toda la línea cabe en el disponible => fabricar todo
        necesidadMaximaAFabricar = necesidadTotal;
      } else {
        // Si no alcanza: Necesidad Requerida = T. Disponible (por material) / (Tiempo Unitario / Puestos)
        necesidadMaximaAFabricar = tiempoUnitarioPorPuesto > 0 
          ? Math.floor(tiempoParaMaterial / tiempoUnitarioPorPuesto) 
          : 0;
      }
      
      // Calcular Tiempo Requerido: (Tiempo Unitarío / Puestos) * (Necesidad Requerida)
      tMaxProm = tiempoUnitarioPorPuesto * necesidadMaximaAFabricar;
      
      // Horas extras = parte proporcional de los minutos extras del pool para esta línea
      const minutosExtrasLinea = extrasMap[key] || 0;
      const minutosExtrasMaterial = (participacionIndividual / 100) * minutosExtrasLinea;
      horasExtrasUsadas = minutosExtrasMaterial / 60;

      // Si hay extras, ampliar tiempoParaMaterial y recalcular necesidadMaximaAFabricar
      if (minutosExtrasLinea > 0) {
        const tiempoTotalConExtras = tiempoDispGlobal + minutosExtrasLinea;
        const tiempoParaMaterialConExtras = (participacionIndividual / 100) * tiempoTotalConExtras;
        tiempoParaMaterial = tiempoParaMaterialConExtras;

        if (sumaTiempoNecLinea <= tiempoTotalConExtras) {
          necesidadMaximaAFabricar = necesidadTotal;
        } else {
          necesidadMaximaAFabricar = tiempoUnitarioPorPuesto > 0
            ? Math.floor(tiempoParaMaterialConExtras / tiempoUnitarioPorPuesto)
            : 0;
        }
        tMaxProm = tiempoUnitarioPorPuesto * necesidadMaximaAFabricar;
      }
    }
    
    return {
      ...row,
      trasladoDesde2000: traslado,
      necesidadPropia,
      necesidadTotal,
      participacionIndividual,
      tiempoTotalNecesidad,
      tiempoUnitarioPorPuesto,
      tiempoParaMaterial,
      tMaxProm,
      necesidadMaximaAFabricar,
      horasExtrasUsadas: horasExtrasUsadas.toFixed(2),
      horasExtrasDetalle: detalleOverride?.[key] ?? '-',
      horasExtrasTotalLinea: extrasMap[key] ? (extrasMap[key] / 60).toFixed(1) : '0',
      mesRef: mes,
      lineaRef: linea
    };
  };

  const datosEnriquecidos = useMemo(() => {
    // PASO 1: pase base sin extras
    const base = datos.map(row => enriquecerFila(row, {}, {}));
    if (maxExtrasHoras === 0 || tiemposCanon.length === 0) return base;

    // PASO 2: pool en memoria por mes|linea desde tiemposCanon
    const pool: { [key: string]: number } = {};
    const tcMap: { [key: string]: TiempoCanonResult } = {};
    base.forEach(row => {
      const key = `${row.mesRef}|${row.lineaRef}`;
      if (pool[key] === undefined) {
        const tc = buscarTiempoCanonPorMes(row.mesRef);
        if (tc) {
          pool[key] = ((tc.diasLaborables ?? 0) * maxExtrasHoras + (tc.diasSabados ?? 0) * horasExtrasFin) * 60;
          tcMap[key] = tc;
        } else {
          pool[key] = 0;
        }
      }
    });

    // PASO 3: déficit por mes|linea
    const deficit: { [key: string]: number } = {};
    base.forEach(row => {
      const key = `${row.mesRef}|${row.lineaRef}`;
      const nec = safeNumber(row.necesidadTotal ?? 0);
      const fab = safeNumber(row.necesidadMaximaAFabricar ?? 0);
      if (nec > fab) {
        deficit[key] = (deficit[key] || 0) + (nec - fab) * safeNumber(row.tiempoUnitarioPorPuesto ?? 0);
      }
    });

    // PASO 4: consumir del pool en incrementos de maxExtrasHoras*60 min
    const extrasMap: { [key: string]: number } = {};
    const detalleMap: { [key: string]: string } = {};
    Object.entries(deficit).forEach(([key, def]) => {
      const disp = pool[key] || 0;
      if (disp <= 0 || def <= 0) return;
      const inc = maxExtrasHoras * 60;
      let consumido = 0;
      while (consumido < def && consumido < disp) {
        consumido = Math.min(consumido + inc, disp);
      }
      if (consumido <= 0) return;
      extrasMap[key] = consumido;
      const tc = tcMap[key];
      detalleMap[key] = tc ? computarDetalleC1000(tc, consumido, maxExtrasHoras, horasExtrasFin) : `${(consumido/60).toFixed(1)}h`;
      console.log(`[HorasExtras C1000] ${key}: déficit ${def.toFixed(0)}min → +${consumido}min (${detalleMap[key]})`);
    });

    // PASO 5: pase final con extras
    return datos.map(row => enriquecerFila(row, extrasMap, detalleMap));
  },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [datos, trasladosDesdeCentro2000, tiemposCanon, maxExtrasHoras, horasExtrasFin]
  );

  useImperativeHandle(ref, () => ({
    getDatosEnriquecidos: () => datosEnriquecidos
  }), [datosEnriquecidos]);

  const lineasUnicas = Array.from(new Set(datosEnriquecidos.map(r => String(r.lineaRef || r.LineaFabricacion || 'Sin línea')))).sort();
  const respCtrlProdUnicos = Array.from(
    new Set(datosEnriquecidos.map(r => String(r.NombRespControlProd || r.RespCtrlProd || 'Sin responsable')).filter(v => v !== 'Sin responsable'))
  ).sort();

  const datosFiltrados = datosEnriquecidos.filter((row: any) => {
    const matchSearchTerm = !searchTerm || String(row.CodMaterial || '').toLowerCase().includes(String(searchTerm).toLowerCase());
    const matchLinea = !selectedLinea || String(row.lineaRef || row.LineaFabricacion || '').trim() === selectedLinea.trim();
    const matchRespCtrlProd = !selectedRespCtrlProd || String(row.NombRespControlProd || row.RespCtrlProd || '').trim() === selectedRespCtrlProd.trim();
    return matchSearchTerm && matchLinea && matchRespCtrlProd;
  });

  const datosAgrupados = datosFiltrados.reduce((acc: any, row: any) => {
    const linea = String(row.lineaRef || row.LineaFabricacion || 'Sin línea');
    if (!acc[linea]) acc[linea] = [];
    acc[linea].push(row);
    return acc;
  }, {} as { [key: string]: any[] });

  const lineasOrdenadas = Object.keys(datosAgrupados).sort();

  const handleExportCSV = () => {
    const dataToExport = datosFiltrados.map((row: any) => ({
      CodMaterial: row.CodMaterial || '',
      Descripcion: row.NombreMaterial || row.CodMaterial || '',
      Centro: row.CentroFabricacion || row.Centro || '',
      Linea: row.lineaRef || row.LineaFabricacion || '',
      PuestoTrabajo: row.PuestoCuellodeBottella || '',
      NumeroPuestos: safeNumber(row.NumeroPuestos ?? row.numero_puestos ?? 0),
      Sector: row.Sector || '',
      Responsable: row.NombRespControlProd || row.RespCtrlProd || '',
      NecesidadPropia: safeNumber(row.necesidadPropia ?? 0),
      TrasladoDesde2000: safeNumber(row.trasladoDesde2000 ?? 0),
      NecesidadTotal: safeNumber(row.necesidadTotal ?? 0),
      TiempoPorUnidad: safeNumber(row.TiempoPorUnidad ?? 0),
      TiempoUnitarioPorPuesto: safeNumber(row.tiempoUnitarioPorPuesto ?? 0),
      TiempoTotalNecesidad: safeNumber(row.tiempoTotalNecesidad ?? 0),
      ParticipacionPorcentaje: safeNumber(row.participacionIndividual ?? 0),
      NecesidadMaximaFabricar: safeNumber(row.necesidadMaximaAFabricar ?? 0),
      TMaxProm: safeNumber(row.tMaxProm ?? 0),
      HorasExtrasUsadas: safeNumber(row.horasExtrasUsadas ?? 0)
    }));
    
    exportToXLSX(dataToExport, 'Detalle_Centro1000_Materiales');
  };

  return (
    <div className="mb-8 bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden">
      <div className="px-6 py-4 border-b border-gray-200 flex justify-between items-center">
        <div>
          <h3 className="text-lg font-semibold text-gray-800">Detalle de Materiales</h3>
          <p className="text-sm text-gray-500 mt-1">{datosFiltrados.length} materiales - Centro 1000 (incluye traslados desde Centro 2000)</p>
        </div>
        <button
          onClick={handleExportCSV}
          className="inline-flex items-center px-3 py-2 text-sm font-medium text-green-700 bg-green-50 border border-green-200 rounded-lg hover:bg-green-100 transition-colors"
        >
          <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
          </svg>
          Descargar CSV
        </button>
      </div>

      <div className="px-6 py-3 bg-gray-50 border-b border-gray-100">
        <div className="flex gap-4 flex-wrap items-center">
          <div className="flex items-center gap-2">
            <label className="text-sm font-medium text-gray-600">Línea:</label>
            <select 
              value={selectedLinea} 
              onChange={e => setSelectedLinea(e.target.value)} 
              className="border border-gray-300 px-3 py-1.5 rounded-md text-sm bg-white focus:ring-2 focus:ring-teal-500 focus:border-teal-500"
            >
              <option value="">Todas las líneas</option>
              {lineasUnicas.map(linea => (
                <option key={linea} value={linea}>{linea}</option>
              ))}
            </select>
          </div>

          <div className="flex items-center gap-2">
            <label className="text-sm font-medium text-gray-600">Responsable:</label>
            <select 
              value={selectedRespCtrlProd} 
              onChange={e => setSelectedRespCtrlProd(e.target.value)} 
              className="border border-gray-300 px-3 py-1.5 rounded-md text-sm bg-white focus:ring-2 focus:ring-teal-500 focus:border-teal-500"
            >
              <option value="">Todos</option>
              {respCtrlProdUnicos.map(resp => (
                <option key={resp} value={resp}>{resp}</option>
              ))}
            </select>
          </div>

          <div className="flex items-center gap-2">
            <input
              type="search"
              placeholder="Buscar CodMaterial..."
              value={searchTerm}
              onChange={e => setSearchTerm(e.target.value)}
              className="border border-gray-300 px-3 py-1.5 rounded-md text-sm bg-white focus:ring-2 focus:ring-teal-500 focus:border-teal-500 w-48"
            />
          </div>
        </div>
      </div>

      <div className="overflow-x-auto max-h-[600px] overflow-y-auto relative">
        <table className="w-full text-xs">
          <thead className="sticky top-0 z-20 bg-gray-50">
            <tr className="bg-gray-50 border-b border-gray-200">
              <th className="px-3 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">CodMaterial</th>
              <th className="px-3 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">Descripción</th>
              <th className="px-3 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">Centro</th>
              <th className="px-3 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">Línea</th>
              <th className="px-3 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">Puesto Trabajo</th>
              <th className="px-3 py-3 text-right text-xs font-semibold text-gray-600 uppercase tracking-wider">Num Puestos</th>
              <th className="px-3 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">Sector</th>
              <th className="px-3 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">Responsable</th>
              <th className="px-3 py-3 text-right text-xs font-semibold text-gray-600 uppercase tracking-wider">Nec. Propia</th>
              <th className="px-3 py-3 text-right text-xs font-semibold text-amber-700 uppercase tracking-wider">Traslado 2000</th>
              <th className="px-3 py-3 text-right text-xs font-semibold text-teal-700 uppercase tracking-wider">Nec. Total</th>
              <th className="px-3 py-3 text-right text-xs font-semibold text-indigo-600 uppercase tracking-wider">Tiempo Unitarío / Puestos</th>
              <th className="px-3 py-3 text-right text-xs font-semibold text-gray-600 uppercase tracking-wider">T. Total necesidad inicial</th>
              <th className="px-3 py-3 text-right text-xs font-semibold text-gray-600 uppercase tracking-wider">Participación%</th>
              <th className="px-3 py-3 text-right text-xs font-semibold text-pink-600 uppercase tracking-wider">T. Disponible</th>
              <th className="px-3 py-3 text-right text-xs font-semibold text-cyan-600 uppercase tracking-wider">T. Consumido</th>
              <th className="px-3 py-3 text-right text-xs font-semibold text-lime-600 uppercase tracking-wider">T. Libre</th>
              <th className="px-3 py-3 text-right text-xs font-semibold text-gray-600 uppercase tracking-wider">Necesidad Requerida</th>
              <th className="px-3 py-3 text-right text-xs font-semibold text-orange-600 uppercase tracking-wider">Tiempo Requerido</th>
              <th className="px-3 py-3 text-right text-xs font-semibold text-gray-600 uppercase tracking-wider">H. Extras</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {lineasOrdenadas.map((linea) => (
              <React.Fragment key={linea}>
                <tr className="bg-teal-50">
                  <td colSpan={20} className="px-4 py-2 font-semibold text-teal-800 text-sm">
                    <span className="inline-flex items-center">
                      <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
                      </svg>
                      Línea: {linea}
                    </span>
                  </td>
                </tr>
                {datosAgrupados[linea].map((row: any, idx: number) => (
                  <tr key={`${linea}-${idx}`} className="hover:bg-gray-50 transition-colors">
                    <td className="px-3 py-2.5 text-sm font-medium text-gray-900">{row.CodMaterial ?? '-'}</td>
                    <td className="px-3 py-2.5 text-sm text-gray-600 max-w-48 truncate" title={row.Descripcion ?? ''}>{row.Descripcion ?? '-'}</td>
                    <td className="px-3 py-2.5 text-sm text-gray-600">{row.CentroFabricacion || row.Centro || '-'}</td>
                    <td className="px-3 py-2.5 text-sm text-gray-600">{row.LineaFabricacion ?? '-'}</td>
                    <td className="px-3 py-2.5 text-sm text-gray-600">{row.PuestoCuellodeBottella ?? '-'}</td>
                    <td className="px-3 py-2.5 text-sm text-right font-mono text-gray-600">{row.NumeroPuestos ?? row.numero_puestos ?? '-'}</td>
                    <td className="px-3 py-2.5 text-sm text-gray-600">{row.Sector ?? '-'}</td>
                    <td className="px-3 py-2.5 text-sm text-gray-600">{row.NombRespControlProd ?? row.RespCtrlProd ?? '-'}</td>
                    <td className="px-3 py-2.5 text-sm text-right font-mono text-gray-700">{Math.floor(row.necesidadPropia).toLocaleString()}</td>
                    <td className="px-3 py-2.5 text-sm text-right font-mono">
                      {row.trasladoDesde2000 > 0 ? (
                        <span className="text-amber-600 font-medium">{Math.floor(row.trasladoDesde2000).toLocaleString()}</span>
                      ) : (
                        <span className="text-gray-400">0</span>
                      )}
                    </td>
                    <td className="px-3 py-2.5 text-sm text-right font-mono text-teal-700 font-semibold">{Math.floor(row.necesidadTotal).toLocaleString()}</td>
                    <td className="px-3 py-2.5 text-sm text-right font-mono text-indigo-600 font-semibold">
                      {row.tiempoUnitarioPorPuesto != null
                        ? Number(row.tiempoUnitarioPorPuesto).toLocaleString(undefined, { maximumFractionDigits: 3 })
                        : '-'}
                    </td>
                    <td className="px-3 py-2.5 text-sm text-right font-mono text-gray-600">
                      {row.tiempoTotalNecesidad != null
                        ? Number(row.tiempoTotalNecesidad).toLocaleString(undefined, { maximumFractionDigits: 2 })
                        : '-'}
                    </td>
                    <td className="px-3 py-2.5 text-sm text-right font-mono text-gray-600">{Number(row.participacionIndividual || 0).toLocaleString(undefined, { maximumFractionDigits: 2 })}%</td>
                    <td className="px-3 py-2.5 text-sm text-right font-mono text-pink-600 font-medium">
                      {Number(row.tiempoParaMaterial || 0).toLocaleString(undefined, { maximumFractionDigits: 2 })} min
                    </td>
                    <td className="px-3 py-2.5 text-sm text-right font-mono text-cyan-600 font-medium">
                      {row.tMaxProm != null
                        ? Number(row.tMaxProm).toLocaleString(undefined, { maximumFractionDigits: 2 })
                        : '-'} min
                    </td>
                    <td className="px-3 py-2.5 text-sm text-right font-mono text-lime-600 font-medium">
                      {(Number(row.tiempoParaMaterial || 0) - Number(row.tMaxProm || 0)).toLocaleString(undefined, { maximumFractionDigits: 2 })} min
                    </td>
                    <td className="px-3 py-2.5 text-sm text-right font-mono text-emerald-600 font-medium">{row.necesidadMaximaAFabricar.toLocaleString()}</td>
                    <td className="px-3 py-2.5 text-sm text-right font-mono text-orange-600 font-semibold">
                      {row.tMaxProm != null
                        ? Number(row.tMaxProm).toLocaleString(undefined, { maximumFractionDigits: 2 })
                        : '-'}
                    </td>
                    <td className="px-3 py-2.5 text-sm text-right font-mono text-purple-600"
                      title={row.horasExtrasDetalle && row.horasExtrasDetalle !== '-'
                        ? `Línea consumió ${row.horasExtrasTotalLinea}h en total: ${row.horasExtrasDetalle}`
                        : 'Sin horas extras'}>
                      {Number(row.horasExtrasUsadas) > 0 ? (
                        <span>
                          {Number(row.horasExtrasUsadas).toLocaleString(undefined, { maximumFractionDigits: 2 })}h
                          {row.horasExtrasTotalLinea && Number(row.horasExtrasTotalLinea) > 0 && (
                            <span className="ml-1 text-xs text-purple-400">(línea: {row.horasExtrasTotalLinea}h)</span>
                          )}
                        </span>
                      ) : (
                        <span className="text-gray-400">—</span>
                      )}
                    </td>
                  </tr>
                ))}
                {(() => {
                  const filasLinea = datosAgrupados[linea];
                  const totalNecPropia = filasLinea.reduce((sum: number, row: any) => sum + safeNumber(row.necesidadPropia ?? 0), 0);
                  const totalTraslados = filasLinea.reduce((sum: number, row: any) => sum + safeNumber(row.trasladoDesde2000 ?? 0), 0);
                  const totalNecTotal = filasLinea.reduce((sum: number, row: any) => sum + safeNumber(row.necesidadTotal ?? 0), 0);
                  const totalTiempoUnitarioPorPuesto = filasLinea.reduce((sum: number, row: any) => sum + safeNumber(row.tiempoUnitarioPorPuesto ?? 0), 0);
                  const totalTiempoNecesidad = filasLinea.reduce((sum: number, row: any) => {
                    const tiempoUnitario = safeNumber(row.tiempoUnitarioPorPuesto ?? 0);
                    const nec = safeNumber(row.necesidadTotal ?? 0);
                    return sum + (tiempoUnitario * nec);
                  }, 0);
                  const totalParticipacion = filasLinea.reduce((sum: number, row: any) => sum + safeNumber(row.participacionIndividual ?? 0), 0);
                  const totalTiempoParaMaterial = filasLinea.reduce((sum: number, row: any) => sum + safeNumber(row.tiempoParaMaterial ?? 0), 0);
                  const totalNecesidadMax = filasLinea.reduce((sum: number, row: any) => sum + safeNumber(row.necesidadMaximaAFabricar ?? 0), 0);
                  const totalTMaxProm = filasLinea.reduce((sum: number, row: any) => sum + safeNumber(row.tMaxProm ?? 0), 0);
                  const totalHorasExtras = filasLinea.reduce((sum: number, row: any) => sum + safeNumber(row.horasExtrasUsadas ?? 0), 0);
                  
                  const totalTLibre = totalTiempoParaMaterial - totalTMaxProm;
                  
                  return (
                    <tr className="bg-gray-100">
                      <td colSpan={8} className="px-3 py-2.5 text-sm font-semibold text-gray-700">Subtotal {linea}</td>
                      <td className="px-3 py-2.5 text-sm text-right font-mono font-semibold text-gray-700">{Math.floor(totalNecPropia).toLocaleString()}</td>
                      <td className="px-3 py-2.5 text-sm text-right font-mono font-semibold text-amber-700">{Math.floor(totalTraslados).toLocaleString()}</td>
                      <td className="px-3 py-2.5 text-sm text-right font-mono font-semibold text-teal-700">{Math.floor(totalNecTotal).toLocaleString()}</td>
                      <td className="px-3 py-2.5 text-sm text-right font-mono font-semibold text-indigo-700">{totalTiempoUnitarioPorPuesto.toLocaleString(undefined, { maximumFractionDigits: 3 })}</td>
                      <td className="px-3 py-2.5 text-sm text-right font-mono font-semibold text-gray-700">{totalTiempoNecesidad.toLocaleString(undefined, { maximumFractionDigits: 2 })}</td>
                      <td className="px-3 py-2.5 text-sm text-right font-mono font-semibold text-gray-700">{totalParticipacion.toLocaleString(undefined, { maximumFractionDigits: 2 })}%</td>
                      <td className="px-3 py-2.5 text-sm text-right font-mono font-semibold text-pink-700">{totalTiempoParaMaterial.toLocaleString(undefined, { maximumFractionDigits: 2 })} min</td>
                      <td className="px-3 py-2.5 text-sm text-right font-mono font-semibold text-cyan-700">{totalTMaxProm.toLocaleString(undefined, { maximumFractionDigits: 2 })} min</td>
                      <td className="px-3 py-2.5 text-sm text-right font-mono font-semibold text-lime-700">{totalTLibre.toLocaleString(undefined, { maximumFractionDigits: 2 })} min</td>
                      <td className="px-3 py-2.5 text-sm text-right font-mono font-semibold text-emerald-700">{totalNecesidadMax.toLocaleString()}</td>
                      <td className="px-3 py-2.5 text-sm text-right font-mono font-semibold text-orange-700">{totalTMaxProm.toLocaleString(undefined, { maximumFractionDigits: 2 })}</td>
                      <td className="px-3 py-2.5 text-sm text-right font-mono font-semibold text-purple-700">{totalHorasExtras.toLocaleString(undefined, { maximumFractionDigits: 2 })}</td>
                    </tr>
                  );
                })()}
              </React.Fragment>
            ))}
          </tbody>
          <tfoot className="sticky bottom-0 z-20">
            {(() => {
              const totalNecPropia = datosFiltrados.reduce((sum: number, row: any) => sum + safeNumber(row.necesidadPropia ?? 0), 0);
              const totalTraslados = datosFiltrados.reduce((sum: number, row: any) => sum + safeNumber(row.trasladoDesde2000 ?? 0), 0);
              const totalNecTotal = datosFiltrados.reduce((sum: number, row: any) => sum + safeNumber(row.necesidadTotal ?? 0), 0);
              const totalTiempoUnitarioPorPuesto = datosFiltrados.reduce((sum: number, row: any) => sum + safeNumber(row.tiempoUnitarioPorPuesto ?? 0), 0);
              const totalTiempoNecesidad = datosFiltrados.reduce((sum: number, row: any) => {
                const tiempoUnitario = safeNumber(row.tiempoUnitarioPorPuesto ?? 0);
                const nec = safeNumber(row.necesidadTotal ?? 0);
                return sum + (tiempoUnitario * nec);
              }, 0);
              const totalTiempoParaMaterial = datosFiltrados.reduce((sum: number, row: any) => sum + safeNumber(row.tiempoParaMaterial ?? 0), 0);
              const totalNecesidadMax = datosFiltrados.reduce((sum: number, row: any) => sum + safeNumber(row.necesidadMaximaAFabricar ?? 0), 0);
              const totalTMaxProm = datosFiltrados.reduce((sum: number, row: any) => sum + safeNumber(row.tMaxProm ?? 0), 0);
              const totalHorasExtras = datosFiltrados.reduce((sum: number, row: any) => sum + safeNumber(row.horasExtrasUsadas ?? 0), 0);
              const totalTLibre = totalTiempoParaMaterial - totalTMaxProm;
              
              // Calcular promedio de participación por línea (cada línea debería sumar ~100%)
              const lineas = Object.keys(datosAgrupados);
              const participacionPorLinea = lineas.map(linea => {
                const filasLinea = datosAgrupados[linea];
                return filasLinea.reduce((sum: number, row: any) => sum + safeNumber(row.participacionIndividual ?? 0), 0);
              });
              const promedioParticipacion = participacionPorLinea.length > 0 
                ? participacionPorLinea.reduce((a, b) => a + b, 0) / participacionPorLinea.length 
                : 0;
              
              return (
                <tr className="bg-gray-800 text-white">
                  <td colSpan={8} className="px-3 py-3 text-sm font-bold">TOTAL GENERAL ({lineas.length} líneas)</td>
                  <td className="px-3 py-3 text-sm text-right font-mono font-bold">{Math.floor(totalNecPropia).toLocaleString()}</td>
                  <td className="px-3 py-3 text-sm text-right font-mono font-bold text-amber-300">{Math.floor(totalTraslados).toLocaleString()}</td>
                  <td className="px-3 py-3 text-sm text-right font-mono font-bold text-teal-300">{Math.floor(totalNecTotal).toLocaleString()}</td>
                  <td className="px-3 py-3 text-sm text-right font-mono font-bold text-indigo-300">{totalTiempoUnitarioPorPuesto.toLocaleString(undefined, { maximumFractionDigits: 3 })}</td>
                  <td className="px-3 py-3 text-sm text-right font-mono font-bold">{totalTiempoNecesidad.toLocaleString(undefined, { maximumFractionDigits: 2 })}</td>
                  <td className="px-3 py-3 text-sm text-right font-mono font-bold" title="Promedio de participación por línea (cada línea suma ~100%)">~{promedioParticipacion.toLocaleString(undefined, { maximumFractionDigits: 1 })}%</td>
                  <td className="px-3 py-3 text-sm text-right font-mono font-bold text-pink-300">{totalTiempoParaMaterial.toLocaleString(undefined, { maximumFractionDigits: 2 })} min</td>
                  <td className="px-3 py-3 text-sm text-right font-mono font-bold text-cyan-300">{totalTMaxProm.toLocaleString(undefined, { maximumFractionDigits: 2 })} min</td>
                  <td className="px-3 py-3 text-sm text-right font-mono font-bold text-lime-300">{totalTLibre.toLocaleString(undefined, { maximumFractionDigits: 2 })} min</td>
                  <td className="px-3 py-3 text-sm text-right font-mono font-bold text-emerald-300">{totalNecesidadMax.toLocaleString()}</td>
                  <td className="px-3 py-3 text-sm text-right font-mono font-bold text-orange-300">{totalTMaxProm.toLocaleString(undefined, { maximumFractionDigits: 2 })}</td>
                  <td className="px-3 py-3 text-sm text-right font-mono font-bold text-purple-300">{totalHorasExtras.toLocaleString(undefined, { maximumFractionDigits: 2 })}</td>
                </tr>
              );
            })()}
          </tfoot>
        </table>
      </div>
    </div>
  );
});

Centro1000DetailTable.displayName = 'Centro1000DetailTable';
