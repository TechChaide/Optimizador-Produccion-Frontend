
import React, { useState, useCallback, useContext, useEffect } from 'react';
import { logger } from '@/services/LogService';
import { useRuntimeInspector } from '@/services/RuntimeInspector';
import { 
    TacticalRequest, TacticalPlanResult, NotificationMessage, ProvisionalOrder, TacticalOrderItem 
} from '@/types/types';
import { parseTacticalOrdersExcel } from '@/services/OptimizationService';
import { TacticalSchedulingIcon, DataImportIcon, MAX_FILE_SIZE_MB } from '@/constants/constants';
import { useAppContext } from '@/context/AppProvider';
import { ProvisionalOrdersTabSection } from './ProvisionalOrdersTabSection';


interface TacticalPlanSectionProps {
  onGeneratePlan: (request: TacticalRequest) => TacticalPlanResult;
}

const getTodayString = () => {
    const today = new Date();
    return today.toISOString().split('T')[0]; // YYYY-MM-DD
};

const getTargetDateString = (executionDate: string): string => {
    if (!executionDate) return '';
    const date = new Date(executionDate + 'T00:00:00');
    date.setDate(date.getDate() + 4);
    return date.toISOString().split('T')[0];
};


export const TacticalPlanSection: React.FC<TacticalPlanSectionProps> = ({ 
        onGeneratePlan,
}) => {
        const inspector = useRuntimeInspector('TacticalPlan');
        
        const [activeTab, setActiveTab] = useState<'programacion' | 'ordenes'>('programacion');
        const [executionDate, setExecutionDate] = useState<string>(getTodayString());
        const [provisionalOrders, setProvisionalOrders] = useState<ProvisionalOrder[]>([]);
        const [fileName, setFileName] = useState<string | null>(null);
        const [isProcessing, setIsProcessing] = useState<boolean>(false);
        const [tacticalPlanResult, setTacticalPlanResult] = useState<TacticalPlanResult | null>(null);
    const { addNotification } = useAppContext();

  const handleFileChange = useCallback(async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      // Security: Validate file size before processing
      if (file.size > MAX_FILE_SIZE_MB * 1024 * 1024) {
        addNotification('error', `El archivo es demasiado grande. El tamaño máximo permitido es ${MAX_FILE_SIZE_MB} MB.`);
        setFileName(null);
        event.target.value = '';
        return;
      }
      setFileName(file.name);
      setIsProcessing(true);
      addNotification('info', `Procesando archivo de órdenes: ${file.name}...`);
      try {
        const data = await parseTacticalOrdersExcel(file);
        if (data.length === 0) {
          addNotification('warning', 'El archivo no contiene órdenes previsionales válidas o está vacío.');
          setProvisionalOrders([]);
        } else {
          setProvisionalOrders(data);
          addNotification('success', `Se cargaron ${data.length} órdenes previsionales.`);
        }
      } catch (error) {
        console.error("Error parsing tactical orders file:", error);
        addNotification('error', `Error al procesar el archivo: ${(error as Error).message}`);
        setProvisionalOrders([]);
      } finally {
        setIsProcessing(false);
        event.target.value = ''; 
      }
    }
  }, [addNotification]);

  const handleGenerateClick = () => {
        logger.log(`[TacticalPlanSection] handleGenerateClick iniciado.`);
        if (provisionalOrders.length === 0) {
                logger.log(`[TacticalPlanSection] No hay órdenes previsionales cargadas. Abortando generación.`);
                addNotification('warning', 'Por favor, cargue primero el archivo de órdenes previsionales.');
                return;
        }
        setIsProcessing(true);
        logger.log(`[TacticalPlanSection] executionDate: ${executionDate}`);
        const targetDate = getTargetDateString(executionDate);
        logger.log(`[TacticalPlanSection] targetDate calculado: ${targetDate}`);
        logger.log(`[TacticalPlanSection] provisionalOrders: ${JSON.stringify(provisionalOrders)}`);
        const request: TacticalRequest = {
                executionDate,
                targetDate,
                provisionalOrders,
        };
        logger.log(`[TacticalPlanSection] request construido: ${JSON.stringify(request)}`);
        const result = onGeneratePlan(request);
        logger.log(`[TacticalPlanSection] resultado de onGeneratePlan: ${JSON.stringify(result)}`);
        if (result && result.plan) {
            logger.log(`[TacticalPlanSection] Plan generado con ${result.plan.length} órdenes.`);
            result.plan.forEach((order, idx) => {
                logger.log(`[TacticalPlanSection] Orden #${idx + 1}: Producto=${order.productName}, Cantidad=${order.quantity}, Línea=${order.assignedLineName}, Horas=${order.requiredHours}`);
                order.assignedPersonnel.forEach((personnel) => {
                    logger.log(`[TacticalPlanSection]   Workstation=${personnel.workstationName}, Req=${personnel.required}, Disponibles=${personnel.available.length}`);
                });
            });
        }
        if (result && result.alerts) {
            logger.log(`[TacticalPlanSection] Alertas de viabilidad: ${JSON.stringify(result.alerts)}`);
        }
        setTacticalPlanResult(result);
        setIsProcessing(false);
        logger.log(`[TacticalPlanSection] handleGenerateClick finalizado.`);
    };
  
  const targetDate = getTargetDateString(executionDate);

  return (
    <div className="p-6 md:p-8 space-y-6">
        <div className="flex items-center space-x-3">
            <TacticalSchedulingIcon />
            <h2 className="text-2xl font-semibold text-gray-700">Programación Táctica Diaria</h2>
        </div>

        {/* --- Tabs Navigation --- */}
        <div className="flex border-b border-gray-300 bg-white rounded-t-xl">
            <button
                onClick={() => setActiveTab('programacion')}
                className={`px-6 py-3 font-semibold text-sm transition-colors ${
                    activeTab === 'programacion'
                        ? 'border-b-2 border-indigo-600 text-indigo-600'
                        : 'text-gray-600 hover:text-gray-900'
                }`}
            >
                📅 Programación Táctica
            </button>
            <button
                onClick={() => setActiveTab('ordenes')}
                className={`px-6 py-3 font-semibold text-sm transition-colors ${
                    activeTab === 'ordenes'
                        ? 'border-b-2 border-indigo-600 text-indigo-600'
                        : 'text-gray-600 hover:text-gray-900'
                }`}
            >
                📦 Datos Órdenes Previsionales
            </button>
        </div>

        {/* --- Tab Content --- */}
        {activeTab === 'programacion' && (
            <div className="space-y-6">
                {/* --- Setup Card --- */}
                <div className="bg-white p-6 rounded-xl shadow-lg grid grid-cols-1 md:grid-cols-3 gap-6 items-end">
                    <div className="space-y-1">
                        <label htmlFor="execution-date" className="block text-sm font-medium text-gray-700">1. Fecha de Ejecución</label>
                        <input
                            type="date"
                            id="execution-date"
                            value={executionDate}
                            onChange={e => setExecutionDate(e.target.value)}
                            className="w-full border border-gray-300 rounded-md shadow-sm py-2 px-3 focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm"
                        />
                        <p className="text-xs text-gray-500">El plan se generará para: <span className="font-semibold">{targetDate}</span></p>
                    </div>

                    <div className="space-y-1">
                        <label className="block text-sm font-medium text-gray-700">2. Cargar Órdenes Previsionales</label>
                        <label htmlFor="orders-upload" className="w-full flex items-center justify-center px-4 py-2 border-2 border-dashed border-gray-300 rounded-md cursor-pointer hover:border-indigo-500 hover:bg-indigo-50 transition-colors duration-200">
                            <DataImportIcon />
                            <span className="ml-2 text-sm text-gray-600 truncate">
                                {fileName || "Seleccionar archivo Excel"}
                            </span>
                        </label>
                         <input id="orders-upload" type="file" className="sr-only" accept=".xlsx, .xls" onChange={handleFileChange} disabled={isProcessing} />
                    </div>

                    <button
                        onClick={handleGenerateClick}
                        disabled={isProcessing || provisionalOrders.length === 0}
                        className="w-full px-4 py-2 bg-indigo-600 text-white font-semibold rounded-md shadow-sm hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 disabled:bg-indigo-300 disabled:cursor-not-allowed"
                    >
                        {isProcessing ? 'Generando...' : '3. Generar Plan Táctico'}
                    </button>
                </div>

                {/* --- Results Section --- */}
                {tacticalPlanResult && (
                    <div className="space-y-6 pt-4">
                        {/* Feasibility Alerts */}
                        <div className="bg-white p-6 rounded-xl shadow-lg">
                            <h3 className="text-lg font-semibold text-gray-800 mb-3">Resumen de Viabilidad del Plan</h3>
                            {tacticalPlanResult.alerts.length > 0 ? (
                                <ul className="space-y-2">
                                   {tacticalPlanResult.alerts.map((alert, index) => (
                                       <li key={index} className="p-3 rounded-md text-sm bg-yellow-50 border border-yellow-200 text-yellow-800">
                                           <span className="font-semibold">⚠️ Alerta:</span> {alert}
                                       </li>
                                   ))}
                                </ul>
                            ) : (
                                <div className="p-3 rounded-md text-sm bg-green-50 border border-green-200 text-green-800">
                                    <span className="font-semibold">✅ ¡Éxito!</span> El plan táctico es completamente viable con los recursos y restricciones actuales.
                                </div>
                            )}
                        </div>

                        {/* Tactical Plan Details */}
                        <div className="bg-white p-6 rounded-xl shadow-lg">
                             <h3 className="text-lg font-semibold text-gray-800 mb-3">Plan Táctico Detallado para el {targetDate}</h3>
                             {tacticalPlanResult.plan.length > 0 ? (
                                <div className="space-y-6">
                                    {tacticalPlanResult.plan.map(order => (
                                        <div key={order.id} className="bg-gray-50 p-4 rounded-lg border border-gray-200">
                                            <div className="flex justify-between items-start mb-3">
                                                <div>
                                                    <h4 className="text-md font-bold text-gray-900">{order.productName} ({order.productId})</h4>
                                                    <p className="text-sm text-indigo-700 font-semibold">Producir: {order.quantity} unidades</p>
                                                </div>
                                                <div className="text-right text-sm">
                                                    <p><span className="font-semibold">Línea:</span> {order.assignedLineName}</p>
                                                    <p><span className="font-semibold">Horas Req:</span> {order.requiredHours}h</p>
                                                </div>
                                            </div>
                                            <div>
                                                <h5 className="text-sm font-semibold mb-2">Personal Requerido y Disponible:</h5>
                                                <div className="space-y-2">
                                                    {order.assignedPersonnel.map(personnel => (
                                                        <div key={personnel.workstationDefinitionId} className="p-2 bg-white rounded border text-xs">
                                                            <p className="font-bold">{personnel.workstationName} (Req: {personnel.required})</p>
                                                            {personnel.available.length >= personnel.required ? (
                                                                <ul className="list-disc list-inside pl-2 text-green-700">
                                                                    {personnel.available.slice(0, personnel.required).map(emp => <li key={emp.id}>{emp.name}</li>)}
                                                                </ul>
                                                            ) : (
                                                                <p className="text-red-600 font-semibold">¡Falta personal! (Disponibles: {personnel.available.length})</p>
                                                            )}
                                                        </div>
                                                    ))}
                                                </div>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                             ) : (
                                <p className="text-center py-4 text-gray-500">No se generaron órdenes de producción para esta fecha, posiblemente debido a alertas de viabilidad o falta de demanda.</p>
                             )}
                        </div>
                    </div>
                )}
            </div>
        )}

        {/* --- Órdenes Previsionales Tab --- */}
        {activeTab === 'ordenes' && (
            <div className="bg-white p-6 rounded-xl shadow-lg">
                <ProvisionalOrdersTabSection />
            </div>
        )}
    </div>
  );
};
