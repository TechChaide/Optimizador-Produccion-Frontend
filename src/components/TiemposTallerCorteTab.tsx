'use client';

import React, { useState, useMemo } from 'react';
import { Loader2, Save, Search, TriangleAlert, FileSpreadsheet, Pencil } from 'lucide-react';
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from '@/components/ui/table';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

interface TiemposTallerCorteTabProps {
    // Materiales de forro detectados en la tabla inicial de "PLAN TÁCTICO" (ProvisionalOrdersTallerCorteTab)
    materiales: { codigo: string; descripcion: string }[];
    // Tiempo EFECTIVO (minutos) por código — Excel (KPI-TC-Temp.xlsx, temporal) sobrescrito por
    // cualquier override manual guardado. Es el que realmente usa "PLAN TÁCTICO".
    tiemposEfectivoMap: Map<string, number>;
    // Códigos con override manual guardado (Restriccion) — para distinguir en pantalla "Excel" de "Manual"
    tiemposOverrideMap: Map<string, number>;
    // Guarda (crea o actualiza) un override manual — ver TacticalPlanTallerCorteSection, que crea el
    // Grupo/Restriccion la primera vez que se necesita.
    onGuardarTiempo: (codigo: string, descripcion: string, minutos: number) => Promise<void>;
    isLoadingTiempos: boolean;
}

export const TiemposTallerCorteTab: React.FC<TiemposTallerCorteTabProps> = ({ materiales, tiemposEfectivoMap, tiemposOverrideMap, onGuardarTiempo, isLoadingTiempos }) => {
    const [searchTerm, setSearchTerm] = useState('');
    const [draftValues, setDraftValues] = useState<Record<string, string>>({});
    const [savingCode, setSavingCode] = useState<string | null>(null);

    const filteredMateriales = useMemo(() => {
        if (!searchTerm.trim()) return materiales;
        const term = searchTerm.toLowerCase();
        return materiales.filter(m => m.codigo.toLowerCase().includes(term) || m.descripcion.toLowerCase().includes(term));
    }, [materiales, searchTerm]);

    const handleGuardar = async (codigo: string, descripcion: string) => {
        const raw = draftValues[codigo];
        const minutos = Number(raw);
        if (!raw || Number.isNaN(minutos) || minutos <= 0) return;
        setSavingCode(codigo);
        try {
            await onGuardarTiempo(codigo, descripcion, minutos);
            setDraftValues(prev => {
                const next = { ...prev };
                delete next[codigo];
                return next;
            });
        } finally {
            setSavingCode(null);
        }
    };

    const materialesSinTiempo = materiales.filter(m => !tiemposEfectivoMap.has(m.codigo)).length;
    const materialesDeExcel = materiales.filter(m => tiemposEfectivoMap.has(m.codigo) && !tiemposOverrideMap.has(m.codigo)).length;

    return (
        <div className="bg-white border border-gray-200 rounded-xl shadow-sm overflow-hidden">
            <div className="px-6 py-4 bg-gradient-to-r from-slate-900 to-indigo-900">
                <h3 className="text-sm font-bold text-white uppercase tracking-wide">Tiempos Unitarios de Cosido — Taller de Corte</h3>
                <p className="text-[11px] text-indigo-200 mt-0.5">
                    Base: Excel "KPI-TC-Temp.xlsx" entregado por el usuario (temporal, mientras TI lo integra al
                    backend). Cualquier tiempo se puede corregir manualmente aquí — la corrección tiene prioridad
                    sobre el valor del Excel y se guarda en la base del sistema. Alimenta el cálculo de capacidad
                    y la clasificación "grande" (&gt; 90 min) de la pestaña "PLAN TÁCTICO".
                </p>
            </div>
            <div className="p-4 space-y-3">
                <div className="flex flex-wrap items-center gap-4 text-[11px] text-gray-600">
                    <span className="inline-flex items-center gap-1.5"><FileSpreadsheet className="w-3.5 h-3.5 text-emerald-600" /> {materialesDeExcel} del Excel</span>
                    <span className="inline-flex items-center gap-1.5"><Pencil className="w-3.5 h-3.5 text-indigo-600" /> {tiemposOverrideMap.size} con corrección manual</span>
                    {materialesSinTiempo > 0 && (
                        <span className="inline-flex items-center gap-1.5 text-amber-700 font-semibold">
                            <TriangleAlert className="w-3.5 h-3.5" /> {materialesSinTiempo} sin tiempo (ni Excel ni manual)
                        </span>
                    )}
                </div>
                <div className="relative">
                    <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-4 w-4" />
                    <Input
                        placeholder="Buscar por código o descripción..."
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        className="pl-10 h-10"
                    />
                </div>
                <div className="border rounded-lg overflow-auto max-h-[60vh]">
                    <Table>
                        <TableHeader>
                            <TableRow>
                                <TableHead className="text-center border-r border-dashed border-gray-300">Material</TableHead>
                                <TableHead className="text-left border-r border-dashed border-gray-300">Descripción</TableHead>
                                <TableHead className="text-center border-r border-dashed border-gray-300">Tiempo Actual (min)</TableHead>
                                <TableHead className="text-center border-r border-dashed border-gray-300">Origen</TableHead>
                                <TableHead className="text-center border-r border-dashed border-gray-300">Nuevo Tiempo (min)</TableHead>
                                <TableHead className="text-center">Guardar</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {filteredMateriales.map(m => {
                                const actual = tiemposEfectivoMap.get(m.codigo);
                                const esManual = tiemposOverrideMap.has(m.codigo);
                                const draft = draftValues[m.codigo] ?? '';
                                const isSaving = savingCode === m.codigo;
                                return (
                                    <TableRow key={m.codigo}>
                                        <TableCell className="text-center border-r border-dashed border-gray-300 font-mono">{m.codigo}</TableCell>
                                        <TableCell className="text-left border-r border-dashed border-gray-300">{m.descripcion}</TableCell>
                                        <TableCell className={cn("text-center border-r border-dashed border-gray-300", actual === undefined && "text-amber-600 font-semibold")}>
                                            {actual !== undefined ? actual.toFixed(2) : 'Sin registrar'}
                                        </TableCell>
                                        <TableCell className="text-center border-r border-dashed border-gray-300">
                                            {actual === undefined ? (
                                                <span className="text-[10px] text-gray-400">—</span>
                                            ) : esManual ? (
                                                <span className="inline-flex items-center gap-1 text-[10px] font-bold text-indigo-700"><Pencil className="w-3 h-3" /> Manual</span>
                                            ) : (
                                                <span className="inline-flex items-center gap-1 text-[10px] font-bold text-emerald-700"><FileSpreadsheet className="w-3 h-3" /> Excel</span>
                                            )}
                                        </TableCell>
                                        <TableCell className="text-center border-r border-dashed border-gray-300">
                                            <Input
                                                type="number"
                                                min="0"
                                                step="0.01"
                                                value={draft}
                                                onChange={(e) => setDraftValues(prev => ({ ...prev, [m.codigo]: e.target.value }))}
                                                className="h-8 w-28 mx-auto text-center"
                                                placeholder={actual !== undefined ? actual.toFixed(2) : '0.00'}
                                            />
                                        </TableCell>
                                        <TableCell className="text-center">
                                            <Button
                                                size="sm"
                                                onClick={() => handleGuardar(m.codigo, m.descripcion)}
                                                disabled={isSaving || !draft}
                                                className="h-8 bg-emerald-600 hover:bg-emerald-700 text-white gap-1.5 text-xs"
                                            >
                                                {isSaving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Save className="w-3.5 h-3.5" />}
                                                Guardar
                                            </Button>
                                        </TableCell>
                                    </TableRow>
                                );
                            })}
                            {filteredMateriales.length === 0 && (
                                <TableRow>
                                    <TableCell colSpan={6} className="text-center py-6 text-gray-400 text-xs">
                                        {materiales.length === 0
                                            ? 'Todavía no se han detectado materiales de forro — revise la pestaña "PLAN TÁCTICO".'
                                            : `No se encontraron resultados para "${searchTerm}"`}
                                    </TableCell>
                                </TableRow>
                            )}
                        </TableBody>
                    </Table>
                </div>
                {isLoadingTiempos && (
                    <div className="flex items-center gap-2 text-xs text-gray-500">
                        <Loader2 className="w-3.5 h-3.5 animate-spin" /> Cargando overrides manuales guardados...
                    </div>
                )}
            </div>
        </div>
    );
};
