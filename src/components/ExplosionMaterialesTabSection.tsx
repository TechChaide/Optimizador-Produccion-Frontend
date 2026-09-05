'use client';

import React, { useState, useMemo } from 'react';
import { Boxes, Loader2, Search, X, Home, Layers } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { useNecesidadesExplotadas, CENTROS, Centro } from '@/hooks/useNecesidadesExplotadas';

// Tabla + paginación por Centro, reutilizada por las dos sub-pestañas ("Reporte General" y
// "Explosión Necesidades"): ambas leen el mismo resultado de MaestroMaterialesExplosionPaginado
// (listas de objetos con columnas dinámicas, agrupadas por Centro).
interface CentroExplosionTableProps {
  columns: string[];
  itemsByCentro: Record<Centro, any[]>;
  emptyMessage: (centro: Centro) => string;
}

const CentroExplosionTable: React.FC<CentroExplosionTableProps> = ({ columns, itemsByCentro, emptyMessage }) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [activeCentroTab, setActiveCentroTab] = useState<Centro>('1000');
  const [currentPageByCentro, setCurrentPageByCentro] = useState<Record<Centro, number>>({ '1000': 1, '2000': 1 });
  const [rowsPerPage, setRowsPerPage] = useState(20);

  const filteredItemsByCentro = useMemo(() => {
    const term = searchTerm.toLowerCase().trim();
    if (!term) return itemsByCentro;
    const result: Record<Centro, ExplosionMaterialItem[]> = { '1000': [], '2000': [] };
    CENTROS.forEach(centro => {
      result[centro] = itemsByCentro[centro].filter(item =>
        columns.some(col => String(item[col] ?? '').toLowerCase().includes(term))
      );
    });
    return result;
  }, [itemsByCentro, columns, searchTerm]);

  const setCurrentPage = (centro: Centro, page: number) => {
    setCurrentPageByCentro(prev => ({ ...prev, [centro]: page }));
  };

  const renderCentroTable = (centro: Centro) => {
    const data = filteredItemsByCentro[centro];
    const currentPage = currentPageByCentro[centro];
    const totalPagesLocal = Math.max(1, Math.ceil(data.length / rowsPerPage));
    const startIndex = (currentPage - 1) * rowsPerPage;
    const endIndex = startIndex + rowsPerPage;
    const displayedItems = data.slice(startIndex, endIndex);

    return (
      <div className="space-y-4">
        <div className="bg-white rounded-lg shadow-sm border overflow-hidden">
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  {columns.map(col => (
                    <th
                      key={col}
                      className="px-4 py-3 text-left text-[10px] font-bold text-gray-500 uppercase tracking-wider whitespace-nowrap"
                    >
                      {col}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {displayedItems.length > 0 ? displayedItems.map((item, idx) => (
                  <tr key={idx} className="hover:bg-gray-50 transition-colors">
                    {columns.map(col => (
                      <td key={col} className="px-4 py-2 whitespace-nowrap text-xs text-gray-600">
                        {typeof item[col] === 'object' ? JSON.stringify(item[col]) : String(item[col] ?? '-')}
                      </td>
                    ))}
                  </tr>
                )) : (
                  <tr>
                    <td colSpan={Math.max(columns.length, 1)} className="px-6 py-12 text-center text-gray-400 italic">
                      {emptyMessage(centro)}
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>

        <div className="bg-gray-50 px-6 py-4 border-t flex items-center justify-between rounded-lg">
          <div className="flex items-center gap-4">
            <span className="text-xs font-medium text-gray-500 uppercase">Ver:</span>
            <select
              value={rowsPerPage}
              onChange={(e) => {
                setRowsPerPage(Number(e.target.value));
                setCurrentPageByCentro({ '1000': 1, '2000': 1 });
              }}
              className="text-sm border rounded p-1 bg-white"
            >
              <option value={10}>10</option>
              <option value={20}>20</option>
              <option value={50}>50</option>
            </select>
            <span className="text-xs text-gray-400 font-medium">
              Viendo {data.length === 0 ? 0 : startIndex + 1} - {Math.min(endIndex, data.length)} de {data.length}
            </span>
          </div>

          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" onClick={() => setCurrentPage(centro, Math.max(1, currentPage - 1))} disabled={currentPage === 1}> Anterior </Button>
            <div className="px-4 py-1 bg-white border rounded text-sm font-bold text-indigo-600 min-w-[80px] text-center"> {currentPage} / {totalPagesLocal} </div>
            <Button variant="outline" size="sm" onClick={() => setCurrentPage(centro, Math.min(totalPagesLocal, currentPage + 1))} disabled={currentPage === totalPagesLocal}> Siguiente </Button>
          </div>
        </div>
      </div>
    );
  };

  return (
    <div className="space-y-4">
      <div className="relative w-64">
        <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-gray-400" />
        <Input
          type="search"
          placeholder="Buscar..."
          className="pl-9 h-9 text-xs"
          value={searchTerm}
          onChange={(e) => { setSearchTerm(e.target.value); setCurrentPageByCentro({ '1000': 1, '2000': 1 }); }}
        />
        {searchTerm && (
          <button
            onClick={() => { setSearchTerm(''); setCurrentPageByCentro({ '1000': 1, '2000': 1 }); }}
            className="absolute right-2.5 top-2.5 text-gray-400 hover:text-gray-600"
          >
            <X className="w-4 h-4" />
          </button>
        )}
      </div>

      <Tabs value={activeCentroTab} onValueChange={(val) => setActiveCentroTab(val as Centro)} className="w-full">
        <TabsList className="flex h-auto bg-gray-100/50 p-1 mb-4">
          {CENTROS.map(centro => (
            <TabsTrigger
              key={centro}
              value={centro}
              className="data-[state=active]:bg-white data-[state=active]:text-indigo-700 data-[state=active]:shadow-sm px-6 py-2 text-xs font-bold uppercase tracking-wider"
            >
              <Home className="w-3 h-3 mr-2" />
              Centro {centro}
            </TabsTrigger>
          ))}
        </TabsList>

        <TabsContent value="1000">{renderCentroTable('1000')}</TabsContent>
        <TabsContent value="2000">{renderCentroTable('2000')}</TabsContent>
      </Tabs>
    </div>
  );
};

export const ExplosionMaterialesTabSection: React.FC = () => {
  const {
    isLoading: isExplotandoNecesidades,
    progressDone,
    progressTotal,
    columns: necesidadesColumns,
    itemsByCentro: necesidadesItemsByCentro,
    lastRunAt: necesidadesLastRunAt,
  } = useNecesidadesExplotadas();

  const [activeMainTab, setActiveMainTab] = useState<'general' | 'necesidades'>('general');

  if (isExplotandoNecesidades && necesidadesLastRunAt === null) {
    return (
      <div className="flex flex-col justify-center items-center py-20 bg-white rounded-lg border border-dashed">
        <Loader2 className="h-10 w-10 animate-spin text-indigo-500" />
        <span className="mt-4 text-gray-600 font-medium">Cargando explosión de materiales... ({progressDone}/{progressTotal})</span>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center space-x-3">
        <Boxes className="w-6 h-6 text-indigo-600" />
        <div>
          <h3 className="text-xl font-semibold text-gray-700">Explosión de Materiales</h3>
          <p className="text-xs text-gray-500">Reporte general y explosión de necesidades (Rev Cap Halb), separados por Centro</p>
        </div>
      </div>

      <Tabs value={activeMainTab} onValueChange={(val) => setActiveMainTab(val as 'general' | 'necesidades')} className="w-full">
        <TabsList className="flex h-auto bg-gray-100/50 p-1 mb-4">
          <TabsTrigger
            value="general"
            className="data-[state=active]:bg-white data-[state=active]:text-indigo-700 data-[state=active]:shadow-sm px-6 py-2 text-xs font-bold uppercase tracking-wider"
          >
            <Boxes className="w-3 h-3 mr-2" />
            Reporte General
          </TabsTrigger>
          <TabsTrigger
            value="necesidades"
            className="data-[state=active]:bg-white data-[state=active]:text-indigo-700 data-[state=active]:shadow-sm px-6 py-2 text-xs font-bold uppercase tracking-wider"
          >
            <Layers className="w-3 h-3 mr-2" />
            Explosión Necesidades
          </TabsTrigger>
        </TabsList>

        <TabsContent value="general" className="space-y-4">
          <div className="flex justify-between items-center">
            <p className="text-xs text-gray-500">
              {necesidadesLastRunAt
                ? `Resultado de MaestroMaterialesExplosionPaginado por cada Centro+Material con órdenes Fert/Previsionales abiertas. Última corrida: ${new Date(necesidadesLastRunAt).toLocaleString()}`
                : 'Aún no se ha corrido ninguna explosión de necesidades.'}
            </p>
            {isExplotandoNecesidades && (
              <span className="text-xs font-medium text-indigo-600 flex items-center">
                <Loader2 className="w-3 h-3 mr-2 animate-spin" />
                Explotando {progressDone}/{progressTotal}…
              </span>
            )}
          </div>

          {necesidadesLastRunAt === null ? (
            <div className="flex flex-col justify-center items-center py-16 bg-white rounded-lg border border-dashed">
              <span className="text-gray-500 font-medium">
                Cargando datos de "Rev Cap Halb" para poder explotar necesidades automáticamente…
              </span>
            </div>
          ) : (
            <CentroExplosionTable
              columns={necesidadesColumns}
              itemsByCentro={necesidadesItemsByCentro}
              emptyMessage={(centro) => `No se encontraron registros de explosión de materiales para el Centro ${centro}.`}
            />
          )}
        </TabsContent>

        <TabsContent value="necesidades" className="space-y-4">
          <div className="flex justify-between items-center">
            <p className="text-xs text-gray-500">
              {necesidadesLastRunAt
                ? `Resultado de MaestroMaterialesExplosionPaginado por cada Centro+Material con órdenes Fert/Previsionales abiertas. Última corrida: ${new Date(necesidadesLastRunAt).toLocaleString()}`
                : 'Aún no se ha corrido ninguna explosión de necesidades.'}
            </p>
            {isExplotandoNecesidades && (
              <span className="text-xs font-medium text-indigo-600 flex items-center">
                <Loader2 className="w-3 h-3 mr-2 animate-spin" />
                Explotando {progressDone}/{progressTotal}…
              </span>
            )}
          </div>

          {necesidadesLastRunAt === null ? (
            <div className="flex flex-col justify-center items-center py-16 bg-white rounded-lg border border-dashed">
              <span className="text-gray-500 font-medium">
                Cargando datos de "Rev Cap Halb" para poder explotar necesidades automáticamente…
              </span>
            </div>
          ) : (
            <CentroExplosionTable
              columns={necesidadesColumns}
              itemsByCentro={necesidadesItemsByCentro}
              emptyMessage={(centro) => `No se encontraron materiales explotados de necesidades para el Centro ${centro}.`}
            />
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
};
