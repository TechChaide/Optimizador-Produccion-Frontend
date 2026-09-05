
'use client';

import React, { useState, useEffect, useMemo } from 'react';
import { planGrupoService } from '@/services/plangrupo.service';
import { planGlobalService } from '@/services/planglobal.service';
import { detalleTacticoService } from '@/services/detalletactico.service';
import { useRuntimeInspector } from '@/services/RuntimeInspector';
import { useAppContext } from '@/context/AppProvider';
import { useResultadoAjustePorCentro, useResultadoActualPorCentro, ResultadoAjustePorCentro } from '@/hooks/useProgTiemposCapacidad';
import {
  CheckCircle2,
  Loader2,
  Home,
  Download,
  Search,
  Scale,
  AlertCircle,
  Filter,
  X,
  RefreshCw,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { cn } from '@/lib/utils';
import * as XLSX from 'xlsx';
import { Grupo, DetalleTactico } from '@/types/interfaces';

interface PlanPropuestoTabSectionProps {
  groups?: Grupo[];
}

// Ecuador = UTC-5 todo el año (sin horario de verano).
const ECUADOR_UTC_OFFSET_MS = 5 * 60 * 60 * 1000;

// PlanGrupo.fecha_inicio_plan llega como timestamp UTC completo (ej. "2026-08-05T03:00:00.000Z"),
// que puede corresponder al día calendario SIGUIENTE en hora de Ecuador. Se reexpresa en hora de
// Ecuador antes de comparar contra el Día de Programación (fecha simple, sin zona horaria).
const normalizeDateISO = (dateStr: any): string | null => {
  if (!dateStr) return null;
  const s = String(dateStr).trim();

  let match = s.match(/^(\d{1,2})[\/-](\d{1,2})[\/-](\d{4})$/);
  if (match) return `${match[3]}-${match[2].padStart(2, '0')}-${match[1].padStart(2, '0')}`;

  match = s.match(/^(\d{4})-(\d{1,2})-(\d{1,2})$/);
  if (match) return `${match[1]}-${match[2].padStart(2, '0')}-${match[3].padStart(2, '0')}`;

  const parsed = new Date(s);
  if (isNaN(parsed.getTime())) return null;
  const local = new Date(parsed.getTime() - ECUADOR_UTC_OFFSET_MS);
  return `${local.getUTCFullYear()}-${String(local.getUTCMonth() + 1).padStart(2, '0')}-${String(local.getUTCDate()).padStart(2, '0')}`;
};

// Esta pestaña ya NO calcula ningún plan por su cuenta: solo PRESENTA el resultado de Ensamblado que
// deja el botón "Ajustar Capacidad" de "Prog Tiempos" (useResultadoAjustePorCentro), congelado en el
// momento en que ese botón corre — no reacciona a ediciones manuales posteriores ni a otros cambios,
// salvo que el usuario presione "Refrescar" (ver más abajo).
export const PlanPropuestoTabSection: React.FC<PlanPropuestoTabSectionProps> = ({ groups = [] }) => {
  const inspector = useRuntimeInspector('PlanPropuestoTab');
  const { addNotification } = useAppContext();

  const resultadoAjuste = useResultadoAjustePorCentro();
  // Espejo en vivo de "Prog Tiempos" (incluye ediciones manuales de "Cant Reprog" aunque no se haya
  // presionado "Ajustar Capacidad"). El botón "Refrescar" toma una foto de esto y la usa como fuente
  // en lugar de `resultadoAjuste`, sin volver a tocarla hasta el próximo "Refrescar" o "Ajustar
  // Capacidad".
  const resultadoActual = useResultadoActualPorCentro();
  const [resultadoRefrescado, setResultadoRefrescado] = useState<ResultadoAjustePorCentro | null>(null);
  const resultadoActivo = resultadoRefrescado ?? resultadoAjuste;

  // Si vuelve a correr "Ajustar Capacidad" en Prog Tiempos, esa corrida oficial vuelve a mandar
  // sobre cualquier foto tomada antes con "Refrescar".
  useEffect(() => {
    setResultadoRefrescado(null);
  }, [resultadoAjuste]);

  const availableCenters = useMemo(() => {
    const fromGroups = [...new Set(groups.map(g => String(g.centro).trim()))].filter(Boolean).sort();
    return fromGroups.length > 0 ? fromGroups : ['1000', '2000'];
  }, [groups]);

  const [selectedCenter, setSelectedCenter] = useState<string>('1000');
  const [isSaving, setIsSaving] = useState<boolean>(false);
  const [filtro, setFiltro] = useState({ linea: '', material: '' });
  const [progDates, setProgDates] = useState<Record<string, string>>({});

  const currentProgrammingDate = progDates[selectedCenter] || new Date().toISOString().split('T')[0];

  useEffect(() => {
    if (!availableCenters.includes(selectedCenter) && availableCenters.length > 0) {
      setSelectedCenter(availableCenters[0]);
    }
  }, [availableCenters, selectedCenter]);

  useEffect(() => {
    try {
      const saved = localStorage.getItem('sim_prog_dates');
      if (saved) setProgDates(JSON.parse(saved));
    } catch (e) {}
  }, []);

  const datosDelCentro = useMemo(
    () => resultadoActivo[selectedCenter] || [],
    [resultadoActivo, selectedCenter]
  );

  const datosFiltrados = useMemo(() => {
    return datosDelCentro.filter(r =>
      (filtro.linea === '' || r.linea.toLowerCase().includes(filtro.linea.toLowerCase())) &&
      (filtro.material === '' ||
        r.material.toLowerCase().includes(filtro.material.toLowerCase()) ||
        r.descripcion.toLowerCase().includes(filtro.material.toLowerCase()))
    );
  }, [datosDelCentro, filtro]);

  // Si hay algo exportable (Cant. Reprog distinto de cero, con los filtros activos) en CUALQUIER
  // Centro — el botón "Exportar Excel" ahora genera un solo archivo con todos los centros.
  const hayDatosParaExportar = useMemo(() => {
    return availableCenters.some(centro => (resultadoActivo[centro] || []).some(r =>
      (filtro.linea === '' || r.linea.toLowerCase().includes(filtro.linea.toLowerCase())) &&
      (filtro.material === '' ||
        r.material.toLowerCase().includes(filtro.material.toLowerCase()) ||
        r.descripcion.toLowerCase().includes(filtro.material.toLowerCase())) &&
      r.cantReprog !== 0
    ));
  }, [availableCenters, resultadoActivo, filtro]);

  const totales = useMemo(() => datosFiltrados.reduce((acc, r) => ({
    original: acc.original + r.cantidadOriginal,
    reprog: acc.reprog + r.cantReprog,
    tiempo: acc.tiempo + r.tiempoFinal,
  }), { original: 0, reprog: 0, tiempo: 0 }), [datosFiltrados]);

  const handleRefrescar = () => {
    if (Object.keys(resultadoActual).length === 0) {
      addNotification('warning', 'Aún no hay datos en vivo de "Prog Tiempos" para refrescar (abra esa pestaña al menos una vez en esta sesión).');
      return;
    }
    setResultadoRefrescado(resultadoActual);
    addNotification('success', 'Plan Propuesto refrescado con los valores actuales de "Prog Tiempos" (incluyendo ediciones manuales de Cant Reprog).');
  };

  const handleExport = () => {
    // Un solo archivo con una sub-pestaña por Centro (mismos filtros de Línea/Material que están
    // activos en pantalla, aplicados a cada Centro por separado). Solo se exportan los registros
    // con "Cant. Reprog" distinto de cero — los que quedaron en 0 no representan producción real.
    const wb = XLSX.utils.book_new();

    availableCenters.forEach(centro => {
      const datosDelCentroExport = (resultadoActivo[centro] || []).filter(r =>
        (filtro.linea === '' || r.linea.toLowerCase().includes(filtro.linea.toLowerCase())) &&
        (filtro.material === '' ||
          r.material.toLowerCase().includes(filtro.material.toLowerCase()) ||
          r.descripcion.toLowerCase().includes(filtro.material.toLowerCase())) &&
        r.cantReprog !== 0
      );

      const ws = XLSX.utils.json_to_sheet(datosDelCentroExport.map(r => ({
        'Centro': r.centro,
        'Línea': r.linea,
        'Material': r.material,
        'Descripción': r.descripcion,
        'Puesto Trabajo': r.puesto,
        'Cant. Original': r.cantidadOriginal,
        'Cant. Reprog (Prog Tiempos)': r.cantReprog,
        'Diferencia (±)': r.cantReprog - r.cantidadOriginal,
        'Tiempo Final (h)': Number(r.tiempoFinal.toFixed(2)),
      })));
      XLSX.utils.book_append_sheet(wb, ws, `Centro ${centro}`);
    });

    XLSX.writeFile(wb, `Plan_Propuesto.xlsx`);
  };

  const handleSavePlan = async () => {
    if (availableCenters.length === 0) {
      addNotification('warning', 'No hay centros disponibles para guardar.');
      return;
    }

    setIsSaving(true);
    addNotification('info', 'Iniciando proceso de guardado masivo para todos los centros...');

    try {
      const globalsRes = await planGlobalService.getAll();
      const allGlobals = Array.isArray(globalsRes?.data) ? globalsRes.data : (Array.isArray(globalsRes) ? globalsRes : []);
      const activeGlobalPlan = allGlobals.find(p => p.estado === 'A');

      if (!activeGlobalPlan) {
        addNotification('error', 'No se encontró un Plan Global activo (Mediano Plazo). Por favor genere uno primero.');
        setIsSaving(false);
        return;
      }

      const codigoPlanGlobal = activeGlobalPlan.codigo_plan;
      const now = new Date();
      const planDate = currentProgrammingDate ? new Date(currentProgrammingDate + 'T12:00:00') : now;
      const targetDateISO = normalizeDateISO(currentProgrammingDate);

      // Se traen UNA sola vez todos los PlanGrupo y DetalleTactico, para poder desactivar en
      // cascada los planes de Ensamblado (Grupo 1 y 6, uno por Centro) que ya estén activos en la
      // fecha que se está programando, antes de crear los nuevos.
      const [allPlanGruposRes, allDetallesRes] = await Promise.all([
        planGrupoService.getAll(),
        detalleTacticoService.getAll(),
      ]);
      const allPlanGrupos = Array.isArray(allPlanGruposRes?.data) ? allPlanGruposRes.data : (Array.isArray(allPlanGruposRes) ? allPlanGruposRes : []);
      const allDetalles = Array.isArray(allDetallesRes?.data) ? allDetallesRes.data : (Array.isArray(allDetallesRes) ? allDetallesRes : []);

      let totalSuccessCount = 0;
      let totalFailCount = 0;
      let totalDesactivados = 0;

      for (const centerId of availableCenters) {
        const grupoEncontrado = groups.find(g =>
          String(g.centro).trim() === centerId &&
          g.nombre_grupo.toLowerCase().includes('ensamblado')
        );

        if (!grupoEncontrado) {
          console.warn(`[PlanPropuesto] No se encontró grupo de Ensamblado para Centro ${centerId}`);
          continue;
        }

        // Se guarda EXACTAMENTE lo que esta pestaña tiene activo para este Centro: el resultado de
        // "Ajustar Capacidad", o el snapshot en vivo de "Prog Tiempos" si se presionó "Refrescar"
        // (ese último ya incluye ediciones manuales de "Cant Reprog"). No se recalcula nada aquí.
        // Se excluyen los registros con "Cant Reprog" en cero: no representan producción real.
        const itemsDelCentro = (resultadoActivo[centerId] || []).filter(item => item.cantReprog !== 0);

        if (itemsDelCentro.length === 0) {
          console.log(`[PlanPropuesto] Centro ${centerId} no tiene registros con Cant Reprog distinto de cero para guardar.`);
          continue;
        }

        // Eliminar (desactivar en cascada) los planes de Ensamblado de este Centro que ya estén
        // activos en la fecha que se está programando, sin importar el sufijo (P1, P2, etc.).
        const planesActivos = allPlanGrupos.filter((p: any) =>
          p.estado === 'A' &&
          p.codigo_grupo === grupoEncontrado.codigo_grupo &&
          normalizeDateISO(p.fecha_inicio_plan) === targetDateISO
        );

        for (const planViejo of planesActivos) {
          try {
            await planGrupoService.save({
              ...planViejo,
              estado: 'I',
              fecha_modificacion: now,
              usuario_modificacion: 'Admin',
            });
            const hijos = allDetalles.filter((d: any) => d.codigo_plan_grupo === planViejo.codigo_plan_grupo);
            for (const hijo of hijos) {
              await detalleTacticoService.save({
                ...hijo,
                estado: 'I',
                fecha_modificacion: now,
                usuario_modificacion: 'Admin',
              });
            }
            totalDesactivados++;
          } catch (e) {
            console.error(`[PlanPropuesto] Error desactivando plan previo ${planViejo.codigo_plan_grupo} (Grupo ${grupoEncontrado.codigo_grupo}):`, e);
          }
        }

        const planGrupoPayload: any = {
          codigo_plan_grupo: 0,
          codigo_plan: codigoPlanGlobal,
          codigo_grupo: grupoEncontrado.codigo_grupo,
          codigo_familia_grupo: 0,
          valor: `Plan Táctico - Centro ${centerId} - P1`,
          fecha_inicio_plan: planDate,
          fecha_fin_plan: planDate,
          estado: 'A',
          fecha_creacion: now,
          usuario_creacion: 'Admin'
        };

        const resPlanGrupo = await planGrupoService.save(planGrupoPayload);
        const createdPlan = (resPlanGrupo as any).data || resPlanGrupo;
        const newCodigoPlanGrupo = createdPlan?.codigo_plan_grupo;

        if (!newCodigoPlanGrupo) {
          console.error(`[PlanPropuesto] Falló creación de PlanGrupo para ${centerId}`, resPlanGrupo);
          totalFailCount++;
          continue;
        }

        for (const item of itemsDelCentro) {
          const detallePayload: DetalleTactico = {
            codigo_detalle_tactico: 0,
            codigo_plan_grupo: newCodigoPlanGrupo,
            codigo_material: parseInt(item.material) || 0,
            linea_produccion: item.linea,
            cantidad_produccion_neta: String(item.cantReprog),
            resp_ctrl_prod: '',
            clase_aprovisionamiento: 'E',
            cantidad_aprovisionamiento: 0,
            estado: 'A',
            fecha_modificacion: new Date(),
            usuario_modificacion: 'Admin'
          };

          try {
            await detalleTacticoService.save(detallePayload);
            totalSuccessCount++;
          } catch (e) {
            console.error(`Error guardando material ${item.material} en centro ${centerId}:`, e);
            totalFailCount++;
          }
        }
      }

      if (totalFailCount === 0) {
        addNotification('success', `Plan guardado exitosamente para todos los centros (${totalSuccessCount} detalles creados, ${totalDesactivados} planes anteriores desactivados). Herencia de Plan Global: ${codigoPlanGlobal}`);
      } else {
        addNotification('warning', `Proceso completado con observaciones. ${totalSuccessCount} detalles creados, ${totalDesactivados} planes anteriores desactivados, ${totalFailCount} fallidos.`);
      }

    } catch (error) {
      console.error('[PlanPropuesto] Error en proceso masivo:', error);
      addNotification('error', `Error crítico al ejecutar el guardado masivo: ${(error as Error).message}`);
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="space-y-6 relative">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex items-center space-x-3">
          <Scale className="w-6 h-6 text-green-600" />
          <div>
            <h3 className="text-xl font-semibold text-gray-800">Plan Propuesto</h3>
            <p className="text-xs text-gray-500">
              Presenta, sin recalcular, el resultado de "Ajustar Capacidad" en "Prog Tiempos". Use "Refrescar" para traer ediciones manuales de "Cant Reprog" hechas ahí sin esperar a que se vuelva a correr "Ajustar Capacidad".
            </p>
          </div>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={handleRefrescar} className="border-blue-200 text-blue-700 bg-blue-50 hover:bg-blue-100">
            <RefreshCw className="w-4 h-4 mr-2" /> Refrescar
          </Button>
          <Button variant="outline" size="sm" onClick={handleExport} disabled={!hayDatosParaExportar} className="border-green-200 text-green-700 bg-green-50 hover:bg-green-100">
            <Download className="w-4 h-4 mr-2" /> Exportar Excel
          </Button>
        </div>
      </div>

      <Tabs value={selectedCenter} onValueChange={setSelectedCenter} className="w-full">
        <TabsList className="flex h-auto bg-gray-100/50 p-1 mb-4 gap-1">
          {availableCenters.map(center => (
            <TabsTrigger key={center} value={center} className="px-6 py-2 text-xs font-bold uppercase data-[state=active]:bg-white data-[state=active]:text-indigo-700">
              <Home className="w-3 h-3 mr-2" /> Centro {center}
            </TabsTrigger>
          ))}
        </TabsList>

        <div className="flex flex-wrap items-center gap-4 p-4 bg-gray-50 border rounded-xl shadow-sm mb-4">
          <div className="flex flex-col gap-1 w-48">
            <label className="text-[10px] font-bold text-gray-400 uppercase ml-1">Día programación:</label>
            <input
              type="date"
              value={currentProgrammingDate}
              disabled
              className="text-xs border rounded-md px-2 py-2 text-gray-500 font-medium h-9 outline-none bg-gray-100 cursor-not-allowed"
            />
          </div>
          <span className="text-[11px] text-gray-400 italic">Se toma de "Prog Tiempos"; no se edita desde aquí.</span>

          <div className="relative w-48">
            <Search className="absolute left-2 top-2.5 h-3.5 w-3.5 text-gray-400" />
            <input type="text" value={filtro.linea} onChange={e => setFiltro(p => ({ ...p, linea: e.target.value }))}
              placeholder="Filtrar Línea..." className="w-full pl-7 pr-2 py-2 text-xs border rounded-md h-9 outline-none focus:ring-1 focus:ring-indigo-500" />
          </div>
          <div className="relative w-56">
            <Search className="absolute left-2 top-2.5 h-3.5 w-3.5 text-gray-400" />
            <input type="text" value={filtro.material} onChange={e => setFiltro(p => ({ ...p, material: e.target.value }))}
              placeholder="Filtrar Material/Descripción..." className="w-full pl-7 pr-2 py-2 text-xs border rounded-md h-9 outline-none focus:ring-1 focus:ring-indigo-500" />
          </div>
          {(filtro.linea || filtro.material) && (
            <Button variant="ghost" size="sm" onClick={() => setFiltro({ linea: '', material: '' })} className="h-9 text-[10px] text-red-500 hover:text-red-700 hover:bg-red-50 font-bold uppercase">
              <X className="w-3.5 h-3.5 mr-1" /> Limpiar
            </Button>
          )}
        </div>

        <div className="bg-white rounded-lg shadow-sm border overflow-hidden">
          <div className="overflow-x-auto">
            <table className="min-w-full text-xs divide-y divide-gray-200 border-collapse">
              <thead className="bg-gray-50 uppercase text-[10px] font-bold text-gray-600">
                <tr>
                  <th className="px-4 py-3 text-left border-b">Línea</th>
                  <th className="px-4 py-3 text-left border-b">Material</th>
                  <th className="px-4 py-3 text-left border-b">Descripción</th>
                  <th className="px-4 py-3 text-left border-b">Puesto Trabajo</th>
                  <th className="px-4 py-3 text-right border-b">Cant. Original</th>
                  <th className="px-4 py-3 text-right text-indigo-700 bg-indigo-50/30 border-b">Cant. Reprog</th>
                  <th className="px-4 py-3 text-right border-b">Diferencia (±)</th>
                  <th className="px-4 py-3 text-right bg-indigo-50/30 border-b">Tiempo Final (h)</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {datosFiltrados.length > 0 ? datosFiltrados.map((row, idx) => {
                  const diferencia = row.cantReprog - row.cantidadOriginal;
                  return (
                    <tr key={`${row.linea}-${row.material}-${idx}`} className="hover:bg-gray-50 transition-colors">
                      <td className="px-4 py-2.5 text-gray-400 font-medium italic">{row.linea}</td>
                      <td className="px-4 py-2.5 font-mono font-bold text-gray-700">{row.material}</td>
                      <td className="px-4 py-2.5 text-gray-600 max-w-xs truncate" title={row.descripcion}>{row.descripcion}</td>
                      <td className="px-4 py-2.5 text-gray-500 font-medium">{row.puesto}</td>
                      <td className="px-4 py-2.5 text-right text-gray-400 font-mono">{row.cantidadOriginal.toLocaleString()}</td>
                      <td className="px-4 py-2.5 text-right font-bold text-indigo-700 bg-indigo-50/5 font-mono">{row.cantReprog.toLocaleString()}</td>
                      <td className={cn("px-4 py-2.5 text-right font-bold font-mono", diferencia > 0 ? 'text-green-600' : diferencia < 0 ? 'text-red-600' : 'text-gray-300')}>
                        {diferencia > 0 ? `+${diferencia.toLocaleString()}` : diferencia.toLocaleString()}
                      </td>
                      <td className="px-4 py-2.5 text-right font-mono font-bold text-indigo-800 bg-indigo-50/5">{row.tiempoFinal.toFixed(2)}h</td>
                    </tr>
                  );
                }) : (
                  <tr>
                    <td colSpan={8} className="px-6 py-12 text-center text-gray-400 italic">
                      <div className="flex flex-col items-center gap-2">
                        <Filter className="w-8 h-8 text-gray-200" />
                        <span>No hay un resultado de "Ajustar Capacidad" para el Centro {selectedCenter}. Presione ese botón en "Prog Tiempos" primero.</span>
                      </div>
                    </td>
                  </tr>
                )}
              </tbody>
              {datosFiltrados.length > 0 && (
                <tfoot className="bg-gray-800 text-white font-bold text-[10px] sticky bottom-0">
                  <tr>
                    <td colSpan={4} className="px-4 py-3 text-right uppercase border-r border-gray-700">Totales ({datosFiltrados.length} regs):</td>
                    <td className="px-4 py-3 text-right border-r border-gray-700 font-mono">{totales.original.toLocaleString()}</td>
                    <td className="px-4 py-3 text-right text-indigo-300 border-r border-gray-700 font-mono">{totales.reprog.toLocaleString()}</td>
                    <td className="px-4 py-3 text-right border-r border-gray-700 font-mono">
                      {(totales.reprog - totales.original).toLocaleString()}
                    </td>
                    <td className="px-4 py-3 text-right text-emerald-300 font-mono">{totales.tiempo.toFixed(2)}h</td>
                  </tr>
                </tfoot>
              )}
            </table>
          </div>
        </div>
      </Tabs>

      <div className="fixed bottom-10 right-10 z-[100]">
        <Button
          size="lg"
          disabled={isSaving || Object.keys(resultadoActivo).length === 0}
          className="bg-green-600 hover:bg-green-700 text-white rounded-full h-16 w-16 shadow-2xl flex items-center justify-center border-2 border-white transition-all hover:scale-110 active:scale-95 disabled:bg-gray-400"
          onClick={handleSavePlan}
          title="Guardar Plan Propuesto (Todos los Centros)"
        >
          {isSaving ? <Loader2 className="w-8 h-8 animate-spin" /> : <CheckCircle2 className="w-8 h-8" />}
        </Button>
      </div>

      <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 flex items-start gap-3 mt-4">
        <AlertCircle className="w-5 h-5 text-blue-600 flex-shrink-0 mt-0.5" />
        <div className="text-[11px] text-blue-800 space-y-1">
          <p><b>Solo presentación:</b> esta pestaña no calcula ningún plan propio. Muestra tal cual el resultado que deja "Ajustar Capacidad" en "Prog Tiempos"; ajuste ahí si algo no cuadra.</p>
          <p><b>Guardado:</b> antes de crear el nuevo plan, se desactivan automáticamente (en cascada, junto con sus detalles) los planes de Ensamblado (Grupo 1 y Grupo 6, uno por Centro) que ya estén activos en la fecha que se está programando.</p>
        </div>
      </div>
    </div>
  );
};
