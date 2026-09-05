'use client';

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { queryApi } from '@/hooks/useApiData';
import { TacticalSchedulingIcon } from '@/constants/constants';
import { Package, Users, Loader2, ClipboardList, Search, Info, MapPin, Box } from 'lucide-react';
import { useAppContext } from '@/context/AppProvider';
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { TacticalPlanSection } from './TacticalPlanSection';
import { serviciosService } from '@/services/servicios.service';
import { restriccionService } from '@/services/restriccion.service';
import { grupoService } from '@/services/grupo.service';
import { Badge } from '@/components/ui/badge';

interface InventoryMueblesItem {
    StockActual: number;
    StockSeguridad: number;
    Centro: string;
}

export const TacticalPlanMueblesSection: React.FC = () => {
    const { addNotification, handleGenerateTacticalPlan } = useAppContext();
    const [isLoading, setIsLoading] = useState(true);
    const [inventoryData, setInventoryData] = useState<InventoryMueblesItem[]>([]);
    const [qualifiedOperatorCount, setQualifiedOperatorCount] = useState<number | null>(null);
    const [ordenesProvisionales, setOrdenesProvisionales] = useState<any[]>([]);
    const [restricciones, setRestricciones] = useState<any[]>([]);
    const [error, setError] = useState<string | null>(null);
    const [searchTerm, setSearchTerm] = useState('');

    const fetchData = useCallback(async () => {
        setIsLoading(true);
        setError(null);
        try {
            const [inventoryRes, skillsRes, , restrsRes, provsRes] = await Promise.all([
                queryApi({
                    source: 'CuboInventarios',
                    operation: 'get_data',
                    filters: { 'RespCtrlProd': ['006', '019'] },
                    columns: ['StockActual', 'StockSeguridad', 'Centro']
                }),
                queryApi({
                    source: 'HabilidadesOperador',
                    operation: 'get_data',
                    filters: { 'Calificacion': 100 },
                    columns: ['Calificacion']
                }),
                grupoService.getAll(),
                restriccionService.getAll(),
                serviciosService.OrdenesProvisionalesPaginados(1, 20000).catch(() => ({ data: [] }))
            ]);

            if (inventoryRes) setInventoryData(inventoryRes);
            if (skillsRes) setQualifiedOperatorCount(skillsRes.length);
            
            setRestricciones(restrsRes.data || []);
            setOrdenesProvisionales(provsRes.data?.data || provsRes.data || []);

        } catch (err: any) {
            const errorMessage = `Error al consultar datos para Muebles: ${err.message}`;
            setError(errorMessage);
            addNotification('error', errorMessage);
        } finally {
            setIsLoading(false);
        }
    }, [addNotification]);

    useEffect(() => {
        fetchData();
    }, [fetchData]);

    // Filtrar órdenes basadas en las restricciones de responsables de Muebles/Corte y Laminado
    const filteredOrders = useMemo(() => {
        // Extraer los códigos de responsables permitidos desde las restricciones
        const respCodes = restricciones
            .filter(r => (r.nombre_restriccion === 'Hojas_Rutas_Materiales' || r.nombre_restriccion === 'RESPCTRLPROD'))
            .flatMap(r => r.valor_restriccion.split(/[&,]/).map((v: string) => v.trim()))
            .filter(v => v !== '');

        return ordenesProvisionales.filter(o => {
            const responsable = String(o.RESPCONTROLPROD || o.RespControlProd || '').trim();
            const matchResp = respCodes.length === 0 || respCodes.includes(responsable);
            
            if (!matchResp) return false;

            if (searchTerm.trim()) {
                const query = searchTerm.toLowerCase();
                const mat = String(o.MATERIAL || '').toLowerCase();
                const ord = String(o.ORDENPREVISIONAL || '').toLowerCase();
                return mat.includes(query) || ord.includes(query);
            }

            return true;
        });
    }, [ordenesProvisionales, restricciones, searchTerm]);
    
    return (
        <div className="p-6 md:p-8 space-y-6 text-left">
            <div className="flex items-center space-x-3">
                <div className="p-2 bg-indigo-600/10 rounded-xl">
                    <TacticalSchedulingIcon />
                </div>
                <h2 className="text-2xl font-bold text-gray-700 uppercase tracking-tight">Programación Táctica Diaria (Muebles)</h2>
            </div>
            
            <Tabs defaultValue="inventory" className="w-full">
                <TabsList className="grid w-full grid-cols-3 h-12 bg-gray-100/50 p-1.5 rounded-2xl border border-gray-200">
                    <TabsTrigger value="inventory" className="gap-2 text-[10px] font-black uppercase transition-all data-[state=active]:bg-white data-[state=active]:shadow-md">
                        <Package className="w-4 h-4" /> Resumen Inventario
                    </TabsTrigger>
                    <TabsTrigger value="orders" className="gap-2 text-[10px] font-black uppercase transition-all data-[state=active]:bg-white data-[state=active]:shadow-md">
                        <ClipboardList className="w-4 h-4" /> Órdenes Provisionales
                    </TabsTrigger>
                    <TabsTrigger value="planning" className="gap-2 text-[10px] font-black uppercase transition-all data-[state=active]:bg-white data-[state=active]:shadow-md">
                        <Users className="w-4 h-4" /> Planificación Táctica
                    </TabsTrigger>
                </TabsList>
                
                <TabsContent value="inventory" className="mt-6 space-y-4 animate-in fade-in duration-300">
                     <div className="bg-white p-6 rounded-3xl shadow-xl border border-gray-100">
                        <div className="flex justify-between items-center mb-6">
                            <div>
                                <h3 className="text-lg font-black text-gray-800 uppercase tracking-tighter flex items-center gap-2">
                                    <Box className="w-5 h-5 text-indigo-600" />
                                    Inventario Muebles (Resp. 006 & 019)
                                </h3>
                                <p className="text-[10px] text-gray-400 font-bold uppercase tracking-widest mt-1">Auditado vía CuboInventarios SAP</p>
                            </div>
                            {qualifiedOperatorCount !== null && (
                                <div className="flex items-center p-3 bg-blue-50 border border-blue-100 rounded-2xl shadow-sm">
                                    <Users className="mr-3 h-5 w-5 text-blue-600" />
                                    <div>
                                        <span className="text-xs font-black text-blue-900 block leading-tight">
                                            {qualifiedOperatorCount} Operadores
                                        </span>
                                        <span className="text-[9px] font-bold text-blue-400 uppercase tracking-widest">Calificación 100%</span>
                                    </div>
                                </div>
                            )}
                        </div>

                        {isLoading ? (
                            <div className="flex flex-col justify-center items-center h-48 gap-3">
                                <Loader2 className="w-8 h-8 animate-spin text-indigo-600" />
                                <span className="text-[10px] font-black uppercase text-gray-400 tracking-widest">Consultando SAP...</span>
                            </div>
                        ) : error ? (
                            <div className="text-center py-10 text-red-600 font-bold bg-red-50 rounded-2xl border border-red-100">{error}</div>
                        ) : (
                            <div className="overflow-hidden border border-gray-100 rounded-2xl shadow-inner">
                                <table className="min-w-full text-[11px] divide-y divide-gray-200">
                                    <thead className="bg-gray-50/80">
                                        <tr className="uppercase font-black text-gray-400 tracking-widest">
                                            <th className="px-6 py-4 text-left">Centro de Stock</th>
                                            <th className="px-6 py-4 text-right">Stock Actual</th>
                                            <th className="px-6 py-4 text-right">Stock Seguridad</th>
                                        </tr>
                                    </thead>
                                    <tbody className="bg-white divide-y divide-gray-50 font-bold">
                                        {inventoryData.map((item, index) => (
                                            <tr key={index} className="hover:bg-indigo-50/30 transition-colors">
                                                <td className="px-6 py-4 flex items-center gap-2">
                                                    <MapPin className="w-3 h-3 text-slate-300" />
                                                    <span className="text-slate-700">Centro {item.Centro}</span>
                                                </td>
                                                <td className="px-6 py-4 text-right font-mono text-indigo-600">{Number(item.StockActual || 0).toLocaleString()}</td>
                                                <td className="px-6 py-4 text-right font-mono text-slate-400">{Number(item.StockSeguridad || 0).toLocaleString()}</td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        )}
                    </div>
                </TabsContent>

                <TabsContent value="orders" className="mt-6 space-y-4 animate-in fade-in duration-300">
                    <div className="bg-white p-5 rounded-3xl shadow-xl border border-gray-100">
                        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-6">
                            <div>
                                <h3 className="text-lg font-black text-gray-800 uppercase tracking-tighter">Órdenes Provisionales Muebles</h3>
                                <p className="text-[10px] text-gray-400 font-bold uppercase tracking-widest mt-1">Filtradas por Responsables Técnicos</p>
                            </div>
                            <div className="relative group">
                                <Search className="absolute left-3 top-2.5 h-4 w-4 text-slate-300 group-hover:text-indigo-500 transition-colors" />
                                <input 
                                    type="text" 
                                    placeholder="Buscar Orden o Material..." 
                                    value={searchTerm}
                                    onChange={(e) => setSearchTerm(e.target.value)}
                                    className="pl-10 pr-4 py-2 bg-slate-50 border border-slate-100 rounded-2xl text-xs font-bold w-64 focus:ring-4 focus:ring-indigo-500/10 focus:bg-white outline-none transition-all"
                                />
                            </div>
                        </div>

                        <div className="border border-gray-100 rounded-2xl overflow-hidden shadow-inner">
                            <div className="overflow-x-auto max-h-[60vh]">
                                <table className="min-w-full text-[11px] font-sans">
                                    <thead className="bg-[#f8fafc] text-slate-400 uppercase font-black tracking-widest text-[9px] border-b border-gray-100">
                                        <tr>
                                            <th className="px-6 py-4 text-left border-r border-gray-50">Orden</th>
                                            <th className="px-6 py-4 text-left border-r border-gray-50">Material</th>
                                            <th className="px-6 py-4 text-left border-r border-gray-100">Descripción</th>
                                            <th className="px-6 py-4 text-center border-r border-gray-50">Cant.</th>
                                            <th className="px-6 py-4 text-center border-r border-gray-50">Fecha Inicio</th>
                                            <th className="px-6 py-4 text-center border-r border-gray-50">Resp. CP</th>
                                            <th className="px-6 py-4 text-center">Máquina</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-gray-50 font-bold">
                                        {isLoading ? (
                                            <tr><td colSpan={7} className="py-20 text-center"><Loader2 className="w-8 h-8 animate-spin mx-auto text-indigo-200" /></td></tr>
                                        ) : filteredOrders.length === 0 ? (
                                            <tr><td colSpan={7} className="py-20 text-center text-slate-300 font-black uppercase tracking-widest italic">No se detectaron órdenes para los criterios aplicados</td></tr>
                                        ) : (
                                            filteredOrders.map((o, idx) => {
                                                const matCode = String(o.MATERIAL || '').match(/^\d+/)?.[0]?.slice(-8) || '—';
                                                const description = String(o.MATERIAL || '').replace(/^\d+\s*/, '') || o.NOMBRE || '—';
                                                const dRaw = String(o.FECHAINICIO || o.FECHA || '—').trim();
                                                const date = dRaw.includes('T') ? dRaw.split('T')[0] : dRaw;
                                                return (
                                                    <tr key={idx} className="hover:bg-indigo-50/20 transition-colors">
                                                        <td className="px-6 py-3 font-black text-slate-800 border-r border-gray-50">{o.ORDENPREVISIONAL || '—'}</td>
                                                        <td className="px-6 py-3 font-mono font-black text-indigo-600 border-r border-gray-50">{matCode}</td>
                                                        <td className="px-6 py-3 text-left border-r border-gray-100 text-slate-500 uppercase max-w-[300px] truncate">{description}</td>
                                                        <td className="px-6 py-3 text-center font-black text-slate-900 border-r border-gray-50 bg-slate-50/30">{Number(o.CANTIDAD || o.CANTPROGRAMADA || 0).toLocaleString()}</td>
                                                        <td className="px-6 py-3 text-center font-mono text-slate-400 border-r border-gray-50">{date}</td>
                                                        <td className="px-6 py-3 text-center border-r border-gray-50">
                                                            <Badge variant="outline" className="text-[10px] font-black bg-indigo-50 text-indigo-700 border-indigo-100">{String(o.RESPCONTROLPROD || '—')}</Badge>
                                                        </td>
                                                        <td className="px-6 py-3 text-center text-slate-400 font-bold text-[10px] uppercase">{o.MAQUINA || o.RECURSO || '—'}</td>
                                                    </tr>
                                                );
                                            })
                                        )}
                                    </tbody>
                                </table>
                            </div>
                        </div>

                        <div className="mt-4 px-4 py-3 bg-blue-50/50 border border-blue-100 rounded-2xl flex items-center gap-3">
                            <Info className="w-4 h-4 text-blue-600" />
                            <p className="text-[10px] font-bold text-blue-700 uppercase tracking-widest">
                                Reporte validado contra la matriz de responsables SAP para el sector Muebles.
                            </p>
                        </div>
                    </div>
                </TabsContent>
                
                <TabsContent value="planning" className="mt-6 animate-in fade-in duration-300">
                   <TacticalPlanSection onGeneratePlan={handleGenerateTacticalPlan} />
                </TabsContent>
            </Tabs>
        </div>
    );
};
