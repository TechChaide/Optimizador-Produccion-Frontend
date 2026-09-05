
import React, { useState, useMemo, useEffect } from 'react';
import { logger } from '@/services/LogService';
import { operationTracker } from '@/services/OperationTracker';
import { useRuntimeInspector } from '@/services/RuntimeInspector';
import { ConstraintsIcon, DataImportIcon, MONTH_NAMES } from '@/constants/constants';
import { useAppContext } from '@/context/AppProvider';
import { parseShiftsAndCostsExcel } from '@/services/OptimizationService';
import { ChevronDown, ChevronUp } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { restriccionService } from '@/services/restriccion.service';
import { ecuadorHolidaysService } from '@/services/ecuador-holidays.service';
import { grupoService } from '@/services/grupo.service';
import { lineaService } from '@/services/linea.service';
import { estacionService } from '@/services/estacion.service';
import type { Restriccion, Grupo, Linea, Estacion } from '@/types/interfaces';


// All props are removidos, data vendrá del contexto
type ConstraintConfigurationSectionProps = Record<string, unknown>;

export const ConstraintConfigurationSection: React.FC<ConstraintConfigurationSectionProps> = () => {
    const inspector = useRuntimeInspector('ConstraintConfiguration');
    const { 
      constraints, 
      setConstraints: onConstraintsUpdate,
      addNotification, 
      syncStatus 
    } = useAppContext();
    
    const isDataSynced = syncStatus?.isSynced || false;
    
    useEffect(() => {
      logger.log(`\n--------------------------------------------------\n##################################\n--------------------------------------------------\n[ConstraintConfigurationSection] Montado.`);
    }, []);

    useEffect(() => {
      inspector.captureState({
        isDataSynced,
        constraintsLoaded: !!constraints,
        workstationsCount: constraints?.workstationDefinitions?.length || 0,
        productionLinesCount: constraints?.productionLines?.length || 0
      });
    }, [isDataSynced, constraints]);

    const [activeTab, setActiveTab] = useState<string>('generales');
    const [isSyncing, setIsSyncing] = useState(false);
    
    const [configYear, setConfigYear] = useState<string>(new Date().getFullYear().toString());
    const [configMonth, setConfigMonth] = useState<string>((new Date().getMonth() + 1).toString());
    const [textFilters, setTextFilters] = useState({ centro: '', nombResp: '' });
    
    // Estados para Generales
    const [restricciones, setRestricciones] = useState<Restriccion[]>([]);
    const [expandedGroups, setExpandedGroups] = useState<Set<number>>(new Set());
    
    // Estados para Sincronización
    const [grupos, setGrupos] = useState<Grupo[]>([]);
    const [lineas, setLineas] = useState<Linea[]>([]);
    const [estaciones, setEstaciones] = useState<Estacion[]>([]);
    const [syncStructLoading, setSyncStructLoading] = useState(false);
    
    // Estados para Feriados
    const [holidays, setHolidays] = useState<any[]>([]);
    const [holidaysLoading, setHolidaysLoading] = useState(false);

    // Cargar restricciones al montar
    useEffect(() => {
      loadRestricciones();
    }, []);

    // Cargar feriados de Ecuador al montar
    useEffect(() => {
      loadEcuadorHolidays();
    }, []);

    // Cargar estructura (grupos, líneas, estaciones) al montar
    useEffect(() => {
      loadEstructuraProduccion();
    }, []);

    const loadRestricciones = async () => {
      try {
        const result = await restriccionService.getAll();
        setRestricciones(result.data);
        addNotification('success', 'Restricciones cargadas correctamente');
      } catch (error) {
        console.error('Error al cargar restricciones:', error);
        addNotification('error', `Error al cargar restricciones: ${(error as Error).message}`);
      }
    };

    const loadEcuadorHolidays = async () => {
      setHolidaysLoading(true);
      try {
        const currentYear = new Date().getFullYear();
        const holidaysList = await ecuadorHolidaysService.getHolidaysForYear(currentYear);
        setHolidays(holidaysList);
        addNotification('success', `${holidaysList.length} feriados de Ecuador cargados`);
      } catch (error) {
        console.error('Error al cargar feriados:', error);
        addNotification('error', 'Error al cargar feriados de Ecuador');
      } finally {
        setHolidaysLoading(false);
      }
    };

    const loadEstructuraProduccion = async () => {
      setSyncStructLoading(true);
      try {
        const [gruposResult, lineasResult, estacionesResult] = await Promise.all([
          grupoService.getAll(),
          lineaService.getAll(),
          estacionService.getAll(),
        ]);
        setGrupos(gruposResult.data);
        setLineas(lineasResult.data);
        setEstaciones(estacionesResult.data);
        addNotification('success', `Estructura cargada: ${gruposResult.data.length} grupos, ${lineasResult.data.length} líneas, ${estacionesResult.data.length} estaciones`);
      } catch (error) {
        console.error('Error al cargar estructura:', error);
        addNotification('error', `Error al cargar estructura: ${(error as Error).message}`);
      } finally {
        setSyncStructLoading(false);
      }
    };

    const toggleGroupExpansion = (groupId: number) => {
      const newExpanded = new Set(expandedGroups);
      if (newExpanded.has(groupId)) {
        newExpanded.delete(groupId);
      } else {
        newExpanded.add(groupId);
      }
      setExpandedGroups(newExpanded);
    };

    // Agrupar líneas y estaciones por grupo y centro
    const estructuraAgrupada = useMemo(() => {
      const grouped = new Map<number, { grupo: Grupo; lineas: Map<number, { linea: Linea; estaciones: Estacion[] }> }>();
      
      grupos.forEach(g => {
        grouped.set(g.codigo_grupo, {
          grupo: g,
          lineas: new Map(),
        });
      });

      lineas.forEach(l => {
        const grupoId = l.codigo_grupo;
        if (grouped.has(grupoId)) {
          const grupoData = grouped.get(grupoId)!;
          grupoData.lineas.set(l.codigo_linea, {
            linea: l,
            estaciones: [],
          });
        }
      });

      estaciones.forEach(e => {
        lineas.forEach(l => {
          if (l.codigo_linea === e.codigo_linea) {
            const grupoId = l.codigo_grupo;
            if (grouped.has(grupoId)) {
              const grupoData = grouped.get(grupoId)!;
              if (grupoData.lineas.has(l.codigo_linea)) {
                grupoData.lineas.get(l.codigo_linea)!.estaciones.push(e);
              }
            }
          }
        });
      });

      return grouped;
    }, [grupos, lineas, estaciones]);

    // Agrupar restricciones por grupo y centro
    const restriccionesPorGrupoYCentro = useMemo(() => {
      const grouped = new Map<number, Map<string, Restriccion[]>>();
      restricciones.forEach(r => {
        const groupId = r.codigo_grupo;
        if (!grouped.has(groupId)) {
          grouped.set(groupId, new Map());
        }
        const grupoMap = grouped.get(groupId)!;
        // Buscar el grupo para obtener el centro
        const grupo = grupos.find(g => g.codigo_grupo === groupId);
        const centro = grupo?.centro || 'General';
        if (!grupoMap.has(centro)) {
          grupoMap.set(centro, []);
        }
        grupoMap.get(centro)!.push(r);
      });
      return grouped;
    }, [restricciones, grupos]);

    // Mapeo de nombres de feriados inglés → español
    const holidayTranslations: { [key: string]: string } = {
        'New Year': 'Año Nuevo',
        'New Year\'s Day': 'Año Nuevo',
        'Maundy Thursday': 'Jueves Santo',
        'Good Friday': 'Viernes Santo',
        'Easter Sunday': 'Domingo de Pascua',
        'Easter Monday': 'Lunes de Pascua',
        'Carnival': 'Carnaval',
        'Carnival Monday': 'Carnaval (Lunes)',
        'Carnival Tuesday': 'Carnaval (Martes)',
        'Ash Wednesday': 'Miércoles de Ceniza',
        'Labour Day': 'Día del Trabajo',
        'Labor Day': 'Día del Trabajo',
        'May Day': 'Día del Trabajo',
        'Day of Labor': 'Día del Trabajo',
        'Battle of Pichincha': 'Batalla de Pichincha',
        'First Call for Independence': 'Primer Grito de Independencia',
        'Independence of Guayaquil': 'Independencia de Guayaquil',
        'Independencia de Guayaquil': 'Independencia de Guayaquil',
        'All Saints Day': 'Día de Difuntos',
        'All Souls Day': 'Día de Difuntos',
        'Independence of Cuenca': 'Independencia de Cuenca',
        'Independencia de Cuenca': 'Independencia de Cuenca',
        'Columbus Day': 'Colón descubre América',
        'Simón Bolívar\'s Birthday': 'Natalicio de Simón Bolívar',
        'Simon Bolivar\'s Birthday': 'Natalicio de Simón Bolívar',
        'Foundation of Quito': 'Fundación de Quito',
        'Founding of Quito': 'Fundación de Quito',
        'Independence of Latacunga': 'Independencia de Latacunga',
        'Independencia de Latacunga': 'Independencia de Latacunga',
        'Christmas': 'Navidad',
        'Christmas Day': 'Navidad',
        'Viernes Santo': 'Viernes Santo',
        'Sábado de Gloria': 'Sábado de Gloria',
        'Carnaval (Viernes)': 'Carnaval (Viernes)',
        'Carnaval (Sábado)': 'Carnaval (Sábado)',
    };

    // Función para traducir nombre de feriado
    const translateHolidayName = (name: string): string => {
        return holidayTranslations[name] || name;
    };

    // Parsea 'YYYY-MM-DD' como fecha LOCAL evitando que JS la interprete como UTC
    const parseLocalDate = (dateStr: string): Date => {
      const [year, month, day] = dateStr.split('-').map(Number);
      return new Date(year, month - 1, day);
    };

    // Agrupar y ordenar feriados por mes
    const holidaysByMonth = useMemo(() => {
      const monthMap = new Map<number, typeof holidays>();
        
      [...holidays].sort((a, b) => parseLocalDate(a.date).getTime() - parseLocalDate(b.date).getTime()).forEach(holiday => {
        const date = parseLocalDate(holiday.date);
        const month = date.getMonth(); // 0-11
        if (!monthMap.has(month)) {
          monthMap.set(month, []);
        }
        monthMap.get(month)!.push(holiday);
      });
        
      return monthMap;
    }, [holidays]);

    // Calcular color del feriado según mes
    const getHolidayColor = (dateStr: string) => {
      const holidayDate = parseLocalDate(dateStr);
      const today = new Date();
      const currentMonth = today.getMonth();
      const currentYear = today.getFullYear();
      const holidayMonth = holidayDate.getMonth();
      const holidayYear = holidayDate.getFullYear();

      if (holidayYear === currentYear && holidayMonth === currentMonth) {
        return 'bg-green-100 border-green-300'; // Mes presente
      } else if (holidayYear < currentYear || (holidayYear === currentYear && holidayMonth < currentMonth)) {
        return 'bg-gray-100 border-gray-300'; // Mes anterior
      } else {
        return 'bg-yellow-100 border-yellow-300'; // Mes futuro
      }
    };

    const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
      const file = event.target.files?.[0];
      if (!file) return;

      addNotification('info', `Procesando archivo ${file.name}...`);
      setIsSyncing(true);

      const opId = operationTracker.startOperation(
        'Constraints',
        'data_import',
        `Importando configuración desde ${file.name}`
      );

      try {
        const { shiftConfigs, shiftParameters, laborCostFactors, globalBaseCostPerHour } = await parseShiftsAndCostsExcel(file);
        
        onConstraintsUpdate({
          ...constraints,
          shiftParameters,
          laborCostFactors,
          globalBaseCostPerHour,
          importedShiftConfigs: shiftConfigs,
        });

        operationTracker.completeOperation(opId, 'Configuración de costos y turnos importada correctamente.');
        addNotification('success', 'La configuración de costos y turnos se ha actualizado desde el archivo Excel.');
      
      } catch (error) {
        console.error('Error parsing shifts and costs file:', error);
        const errorMessage = (error as Error).message || 'Error desconocido al procesar el archivo.';
        operationTracker.failOperation(opId, errorMessage);
        addNotification('error', `Error al importar: ${errorMessage}`);
      } finally {
        setIsSyncing(false);
        event.target.value = '';
      }
    };

    const handleTextFilterChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
      const { name, value } = e.target;
      setTextFilters(prev => ({ ...prev, [name]: value }));
    };
    
    const filterOptions = useMemo(() => {
      if (!constraints.importedShiftConfigs) {
          return { centros: [], nombResps: [] };
      }
      const centros = [...new Set(constraints.importedShiftConfigs.map(c => String(c.Centro)))].sort((a, b) => a.localeCompare(b, undefined, { numeric: true }));
      const nombResps = [...new Set(constraints.importedShiftConfigs.map(c => String(c.NombRespControlProd)))].sort((a, b) => a.localeCompare(b));
      return {
          centros: centros.map(c => ({ value: c, label: c })),
          nombResps: nombResps.map(n => ({ value: n, label: n })),
      };
    }, [constraints.importedShiftConfigs]);

    const filteredShiftConfigs = useMemo(() => {
      if (!constraints.importedShiftConfigs) return [];

      return constraints.importedShiftConfigs.filter(config => {
          const yearMatch = String(config.Año) === configYear;
          const monthMatch = String(config.Mes) === configMonth;
          const centroMatch = !textFilters.centro || String(config.Centro) === textFilters.centro;
          const nombRespMatch = !textFilters.nombResp || String(config.NombRespControlProd) === textFilters.nombResp;

          return yearMatch && monthMatch && centroMatch && nombRespMatch;
      });
    }, [constraints.importedShiftConfigs, configYear, configMonth, textFilters]);
    
    const activeShiftConfig = useMemo(() => {
        return filteredShiftConfigs.length > 0 ? filteredShiftConfigs[0] : null;
    }, [filteredShiftConfigs]);

    const tabs = [
      { id: 'generales', label: '0. Generales' },
      { id: 'syncAndConfig', label: '1. Sincronización y Configuración' },
      { id: 'costsAndShifts', label: '2. Costos y Turnos' },
      { id: 'holidays', label: '3. Feriados' },
    ];

    return (
      <div className="p-6 md:p-8 space-y-6">
          <div className="flex items-center space-x-3">
              <ConstraintsIcon />
              <h2 className="text-2xl font-semibold text-gray-700">Configuración del Entorno de Producción</h2>
          </div>

          <div className="border-b border-gray-200">
              <nav className="-mb-px flex space-x-4 overflow-x-auto" aria-label="Tabs">
                  {tabs.map(tab => (
                      <button
                          key={tab.id}
                          onClick={() => setActiveTab(tab.id)}
                          className={`whitespace-nowrap py-3 px-1 border-b-2 font-medium text-sm
                              ${activeTab === tab.id
                                  ? 'border-indigo-500 text-indigo-600'
                                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                              }`}
                      >
                          {tab.label}
                      </button>
                  ))}
              </nav>
          </div>
          
          <div className="mt-6">
              {/* TAB 0: GENERALES */}
              {activeTab === 'generales' && (
                <div className="space-y-6">
                  <div className="bg-white p-6 rounded-xl shadow-lg space-y-4">
                    <h3 className="text-lg font-semibold text-gray-800">Restricciones por Grupo</h3>
                    <p className="text-sm text-gray-600">
                      Visualice todas las restricciones de producción organizadas por grupo y centro.
                    </p>
                    
                    {restricciones.length === 0 ? (
                      <div className="text-center py-8 text-gray-500">
                        No hay restricciones cargadas. Cargando automáticamente...
                      </div>
                    ) : (
                      <div className="space-y-4">
                        {Array.from(restriccionesPorGrupoYCentro.entries()).map(([groupId, centrosMap]) => {
                          const grupo = grupos.find(g => g.codigo_grupo === groupId);
                          return (
                          <div key={groupId} className="border rounded-lg overflow-hidden">
                            <button
                              onClick={() => toggleGroupExpansion(groupId)}
                              className="w-full px-4 py-3 bg-indigo-50 hover:bg-indigo-100 flex items-center justify-between"
                            >
                              <span className="font-semibold text-indigo-900">
                                Grupo: {grupo?.nombre_grupo || `Grupo ${groupId}`} - Centro: {grupo?.centro || 'Sin asignar'}
                              </span>
                              {expandedGroups.has(groupId) ? 
                                <ChevronUp className="w-5 h-5" /> : 
                                <ChevronDown className="w-5 h-5" />
                              }
                            </button>
                            
                            {expandedGroups.has(groupId) && (
                              <div className="p-4 bg-white space-y-4">
                                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                                  {Array.from(centrosMap.entries()).map(([centro, restriccionesDelCentro]) => (
                                    <div key={centro} className="border rounded-lg p-4 bg-gray-50">
                                      <h5 className="font-semibold text-gray-800 mb-3 border-b pb-2">
                                        Centro: {centro}
                                      </h5>
                                      <div className="space-y-2">
                                        {restriccionesDelCentro.map(r => (
                                          <div key={r.codigo_restriccion} className="text-sm p-2 bg-white rounded border border-gray-200">
                                            <p className="font-medium text-gray-700">{r.nombre_restriccion}</p>
                                            <p className="text-gray-600">{r.valor_restriccion}</p>
                                            {r.descripcion && (
                                              <p className="text-xs text-gray-500 mt-1">{r.descripcion}</p>
                                            )}
                                          </div>
                                        ))}
                                      </div>
                                    </div>
                                  ))}
                                </div>
                              </div>
                            )}
                          </div>
                          );
                        })}
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* TAB 1: SINCRONIZACIÓN Y CONFIGURACIÓN */}
              {activeTab === 'syncAndConfig' && (
                <div className="space-y-8">
                  <div className="bg-white p-6 rounded-xl shadow-lg space-y-4">
                      <h3 className="text-lg font-semibold text-gray-800">Sincronización de Estructura y Tiempos</h3>
                      <p className="text-sm text-gray-600">
                          Presione este botón para obtener la estructura más reciente de Centros, Líneas, Puestos de Trabajo y sus respectivos tiempos de ensamble desde la API.
                          Este paso es **obligatorio** antes de generar un plan de producción. La estructura se descubrirá automáticamente. Después de sincronizar, puede ajustar los parámetros como el número de empleados o puestos por línea.
                      </p>
                      <div className="flex items-center gap-4 pt-2">
                          {/* <button 
                              onClick={handleSyncClick} 
                              disabled={isSyncing}
                              className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 flex items-center disabled:bg-blue-300"
                          >
                              <DataImportIcon/>
                              {isSyncing ? 'Sincronizando...' : 'Sincronizar y Validar Datos'}
                          </button> */}
                          {isDataSynced && (
                              <span className="text-sm font-medium text-green-600">✓ Estructura y tiempos sincronizados y validados correctamente.</span>
                          )}
                          {!isDataSynced && constraints.productProcessInfos.length > 0 && (
                               <span className="text-sm font-medium text-yellow-600">⚠️ La estructura podría estar desactualizada. Se recomienda sincronizar.</span>
                          )}
                      </div>
                   </div>

                  <div className="bg-white p-6 rounded-xl shadow-lg">
                      <h3 className="text-lg font-semibold text-gray-800 mb-4">Líneas y Estaciones por Centro</h3>
                      {syncStructLoading ? (
                        <div className="text-center py-8 text-gray-600">
                          <p>Cargando estructura de producción...</p>
                        </div>
                      ) : (
                        <div className="max-h-[80vh] overflow-y-auto space-y-6">
                          {Array.from(estructuraAgrupada.entries()).map(([groupId, groupData]) => (
                            <div key={groupId} className="border rounded-lg overflow-hidden">
                              <div className="px-4 py-3 bg-indigo-50">
                                <h4 className="text-md font-bold text-indigo-900">
                                  Grupo: {groupData.grupo.nombre_grupo} - Centro: {groupData.grupo.centro}
                                </h4>
                              </div>
                              <div className="p-4 bg-white space-y-4">
                                {Array.from(groupData.lineas.entries()).map(([lineaId, lineaData]) => (
                                  <div key={lineaId} className="border-l-4 border-indigo-300 pl-4 py-2">
                                    <h5 className="font-semibold text-gray-800 mb-3">Línea: {lineaData.linea.nombre_linea}</h5>
                                    <div className="space-y-2 ml-4">
                                      {lineaData.estaciones.length > 0 ? (
                                        lineaData.estaciones.map(estacion => (
                                          <div key={estacion.codigo_estacion} className="p-3 bg-gray-50 rounded border border-gray-200">
                                            <p className="text-sm font-medium text-gray-700">
                                              📍 {estacion.nombre_estacion}
                                            </p>
                                            <p className="text-xs text-gray-500 mt-1">
                                              ID: {estacion.codigo_estacion} | Estado: {estacion.estado}
                                            </p>
                                          </div>
                                        ))
                                      ) : (
                                        <div className="text-sm text-gray-400 italic">No hay estaciones asignadas</div>
                                      )}
                                    </div>
                                  </div>
                                ))}
                                {groupData.lineas.size === 0 && (
                                  <div className="text-center py-4 text-gray-400">
                                    No hay líneas en este grupo
                                  </div>
                                )}
                              </div>
                            </div>
                          ))}
                          {estructuraAgrupada.size === 0 && (
                            <div className="text-center py-8 text-gray-500">
                              No hay estructura de producción cargada
                            </div>
                          )}
                        </div>
                      )}
                  </div>

                </div>
              )}

              {/* TAB 2: COSTOS Y TURNOS */}
              {activeTab === 'costsAndShifts' && (
                  <div className="bg-white p-6 rounded-xl shadow-lg space-y-4">
                      <h3 className="text-lg font-semibold text-gray-800">Configuración de Turnos y Costos por Excel</h3>
                      <p className="text-sm text-gray-600">
                          Utilice esta sección para cargar la configuración de turnos y costos laborales desde un archivo Excel estandarizado. Toda la configuración se gestiona ahora desde la hoja `Configuracion_Turnos`.
                      </p>
                      <div className="flex items-center justify-center pt-4 gap-4">
                          <label className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 flex items-center cursor-pointer disabled:bg-gray-400 disabled:cursor-not-allowed">
                               <DataImportIcon />
                               {isSyncing ? 'Procesando...' : 'Importar Archivo de Configuración'}
                              <input 
                                  type="file" 
                                  className="hidden" 
                                  onChange={handleFileUpload}
                                  accept=".xlsx, .xls"
                                  disabled={isSyncing}
                              />
                          </label>
                      </div>

                      {constraints.importedShiftConfigs && constraints.importedShiftConfigs.length > 0 && (
                          <div className="mt-6 space-y-8">
                               <div>
                                  <h4 className="font-semibold text-gray-700 mb-2">Resumen de Turnos para Planificación</h4>
                                  <p className="text-xs text-gray-500 mb-4">
                                    Mostrando la configuración activa para el período seleccionado (el sistema usa la primera fila encontrada).
                                  </p>
                                  {activeShiftConfig ? (
                                      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                                          <div className="p-3 border rounded-lg bg-blue-50 text-center">
                                              <p className="text-sm font-medium text-blue-800">Horas Normales</p>
                                              <p className="text-2xl font-bold text-blue-900">{activeShiftConfig['Horas Normales']}h</p>
                                              <p className="text-xs text-blue-600">(Lunes a Viernes)</p>
                                          </div>
                                          <div className="p-3 border rounded-lg bg-blue-50 text-center">
                                              <p className="text-sm font-medium text-blue-800">Horas Extra Máximas</p>
                                              <p className="text-2xl font-bold text-blue-900">{activeShiftConfig['H.E. 50% (Diurnas)']}h</p>
                                              <p className="text-xs text-blue-600">(Lunes a Viernes)</p>
                                          </div>
                                          <div className="p-3 border rounded-lg bg-blue-50 text-center">
                                              <p className="text-sm font-medium text-blue-800">Horas Sábado/Feriado</p>
                                              <p className="text-2xl font-bold text-blue-900">{activeShiftConfig['H.E. 100% (Sab-Dom/Fer)']}h</p>
                                              <p className="text-xs text-blue-600">(Jornada especial)</p>
                                          </div>
                                          <div className="p-3 border rounded-lg bg-blue-50 text-center">
                                              <p className="text-sm font-medium text-blue-800"># Turnos</p>
                                              <p className="text-2xl font-bold text-blue-900">{activeShiftConfig['# Turnos']}</p>
                                              <p className="text-xs text-blue-600">(Planificados)</p>
                                          </div>
                                      </div>
                                  ) : (
                                      <div className="text-center py-4 text-gray-500">
                                          No hay configuración de turnos para el Año y Mes seleccionados.
                                      </div>
                                  )}
                              </div>
                              
                              <div className="mt-6">
                                  <h4 className="font-semibold text-gray-700 mb-2">Factores de Costo</h4>
                                   {activeShiftConfig ? (
                                      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                                          <div className="p-3 border rounded-lg bg-gray-50">
                                              <p className="text-xs text-gray-500">Costo Base/Hora</p>
                                              <p className="text-lg font-bold text-gray-800">${activeShiftConfig['Costo Horas Normales'].toFixed(2)}</p>
                                          </div>
                                          <div className="p-3 border rounded-lg bg-gray-50">
                                              <p className="text-xs text-gray-500">Recargo Extra Diurno</p>
                                              <p className="text-lg font-bold text-gray-800">{activeShiftConfig['Costo H.E. 50% (Diurnas)']}%</p>
                                          </div>
                                           <div className="p-3 border rounded-lg bg-gray-50">
                                              <p className="text-xs text-gray-500">Recargo Nocturno</p>
                                              <p className="text-lg font-bold text-gray-800">{activeShiftConfig['Costo Recargo Jornada Nocturna (%)']}%</p>
                                          </div>
                                          <div className="p-3 border rounded-lg bg-gray-50">
                                              <p className="text-xs text-gray-500">Recargo FDS/Feriado</p>
                                              <p className="text-lg font-bold text-gray-800">{activeShiftConfig['Costo H.E. 100% (Sab-Dom/Fer)']}%</p>
                                          </div>
                                      </div>
                                  ) : (
                                      <div className="text-center py-4 text-gray-500">
                                          No hay configuración de costos para el Año y Mes seleccionados.
                                      </div>
                                  )}
                              </div>

                              <div>
                                  <h4 className="font-semibold text-gray-700 mb-2">Detalle de Configuración</h4>
                                  <div className="flex flex-wrap items-end space-x-2 mb-4 p-4 border rounded-lg bg-gray-50">
                                    <div>
                                       <label htmlFor="configYear" className="block text-sm font-medium text-gray-700">Año</label>
                                       <select id="configYear" value={configYear} onChange={e => setConfigYear(e.target.value)} className="mt-1 block w-full pl-3 pr-10 py-2 text-base border-gray-300 focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm rounded-md border">
                                          {[...new Set((constraints.importedShiftConfigs || []).map(c => c.Año))].sort((a, b) => a - b).map(y => <option key={y} value={String(y)}>{y}</option>)}
                                       </select>
                                    </div>
                                    <div>
                                       <label htmlFor="configMonth" className="block text-sm font-medium text-gray-700">Mes</label>
                                       <select id="configMonth" value={configMonth} onChange={e => setConfigMonth(e.target.value)} className="mt-1 block w-full pl-3 pr-10 py-2 text-base border-gray-300 focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm rounded-md border">
                                           {MONTH_NAMES.map((m, i) => <option key={i+1} value={String(i+1)}>{m}</option>)}
                                       </select>
                                    </div>
                                    <div className="flex-grow">
                                       <label htmlFor="filterCentro" className="block text-sm font-medium text-gray-700">Centro</label>
                                       <select id="filterCentro" name="centro" value={textFilters.centro} onChange={handleTextFilterChange} className="mt-1 block w-full pl-3 pr-10 py-2 text-base border-gray-300 focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm rounded-md border">
                                          <option value="">Todos</option>
                                          {filterOptions.centros.map(opt => <option key={opt.value} value={opt.value}>{opt.label}</option>)}
                                       </select>
                                    </div>
                                     <div className="flex-grow">
                                       <label htmlFor="filterNombResp" className="block text-sm font-medium text-gray-700">Nombre Resp.</label>
                                        <select id="filterNombResp" name="nombResp" value={textFilters.nombResp} onChange={handleTextFilterChange} className="mt-1 block w-full pl-3 pr-10 py-2 text-base border-gray-300 focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm rounded-md border">
                                          <option value="">Todos</option>
                                          {filterOptions.nombResps.map(opt => <option key={opt.value} value={opt.value}>{opt.label}</option>)}
                                       </select>
                                    </div>
                                  </div>

                                  <div className="border rounded-lg overflow-auto max-h-[60vh]">
                                    <table className="min-w-full text-xs divide-y divide-gray-200">
                                      <thead className="bg-gray-100 sticky top-0">
                                        <tr>
                                          <th className="px-2 py-2 text-left font-semibold text-gray-600">Centro</th>
                                          <th className="px-2 py-2 text-left font-semibold text-gray-600">Resp. Ctrl. Prod.</th>
                                          <th className="px-2 py-2 text-left font-semibold text-gray-600">Nombre Resp.</th>
                                          <th className="px-2 py-2 text-right font-semibold text-gray-600">H. Normales</th>
                                          <th className="px-2 py-2 text-right font-semibold text-gray-600">H.E. 50%</th>
                                          <th className="px-2 py-2 text-right font-semibold text-gray-600">H.E. 100%</th>
                                          <th className="px-2 py-2 text-right font-semibold text-gray-600"># Turnos</th>
                                          <th className="px-2 py-2 text-right font-semibold text-gray-600">Costo H. Normal</th>
                                          <th className="px-2 py-2 text-right font-semibold text-gray-600">Rec. HE 50%</th>
                                          <th className="px-2 py-2 text-right font-semibold text-gray-600">Rec. Nocturno %</th>
                                          <th className="px-2 py-2 text-right font-semibold text-gray-600">Rec. FDS/Fer %</th>
                                        </tr>
                                      </thead>
                                      <tbody className="bg-white divide-y divide-gray-200">
                                        {filteredShiftConfigs.map((config) => {
                                          const configKey = `${config.Centro}-${config.RespCtrlProd}-${config.Año}-${config.Mes}`;
                                          return (
                                          <tr key={configKey}>
                                            <td className="px-2 py-2">{config.Centro}</td>
                                            <td className="px-2 py-2">{config.RespCtrlProd}</td>
                                            <td className="px-2 py-2">{config.NombRespControlProd}</td>
                                            <td className="px-2 py-2 text-right font-mono">{config['Horas Normales']}</td>
                                            <td className="px-2 py-2 text-right font-mono">{config['H.E. 50% (Diurnas)']}</td>
                                            <td className="px-2 py-2 text-right font-mono">{config['H.E. 100% (Sab-Dom/Fer)']}</td>
                                            <td className="px-2 py-2 text-right font-mono">{config['# Turnos']}</td>
                                            <td className="px-2 py-2 text-right font-mono">${config['Costo Horas Normales'].toFixed(2)}</td>
                                            <td className="px-2 py-2 text-right font-mono">{config['Costo H.E. 50% (Diurnas)']}%</td>
                                            <td className="px-2 py-2 text-right font-mono">{config['Costo Recargo Jornada Nocturna (%)']}%</td>
                                            <td className="px-2 py-2 text-right font-mono">{config['Costo H.E. 100% (Sab-Dom/Fer)']}%</td>
                                          </tr>
                                          );
                                        })}
                                      </tbody>
                                    </table>
                                  </div>
                              </div>
                          </div>
                      )}

                  </div>
              )}

              {/* TAB 3: FERIADOS ECUADOR */}
              {activeTab === 'holidays' && (
                <div className="bg-white p-6 rounded-xl shadow-lg space-y-6">
                    <div>
                        <h3 className="text-lg font-semibold text-gray-800">Feriados de Ecuador</h3>
                        <p className="text-sm text-gray-600 mt-1">
                            Feriados oficiales de Ecuador cargados automáticamente. Los colores indican: Verde (mes actual), Gris (meses anteriores), Amarillo (meses futuros).
                        </p>
                    </div>

                    {holidaysLoading ? (
                      <div className="text-center py-8">
                        <p className="text-gray-600">Cargando feriados...</p>
                      </div>
                    ) : (
                      <div className="space-y-6">
                        {Array.from(holidaysByMonth.entries()).map(([monthIndex, monthHolidays]) => {
                          const monthNames = ['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio', 'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'];
                          const monthName = monthNames[monthIndex];
                          
                          return (
                            <div key={monthIndex} className="border rounded-lg p-4 bg-gray-50">
                              <h4 className="text-lg font-bold text-gray-900 mb-4 pb-2 border-b-2 border-indigo-300">
                                {monthName} (2026)
                              </h4>
                              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                                {monthHolidays.map((holiday) => {
                                  const colorClass = getHolidayColor(holiday.date);
                                  const date = parseLocalDate(holiday.date);
                                  const formatted = date.toLocaleDateString('es-EC', { year: 'numeric', month: 'long', day: 'numeric' });
                                  const translatedName = translateHolidayName(holiday.name);
                                  
                                  return (
                                    <div key={holiday.date} className={`border-2 rounded-lg p-4 ${colorClass}`}>
                                      <h5 className="font-semibold text-gray-900 text-sm">{translatedName}</h5>
                                      <p className="text-xs text-gray-700 mt-1">{formatted}</p>
                                      <Badge variant="outline" className="mt-2 text-xs">
                                        {parseLocalDate(holiday.date).toLocaleDateString('es-EC', { weekday: 'short' })}
                                      </Badge>
                                    </div>
                                  );
                                })}
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    )}

                    {holidays.length === 0 && !holidaysLoading && (
                      <div className="text-center py-8 text-gray-500">
                        No hay feriados disponibles.
                      </div>
                    )}
                </div>
              )}
          </div>
      </div>
    );
};
