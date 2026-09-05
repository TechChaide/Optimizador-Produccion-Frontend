import React, { useMemo, useState, useEffect } from 'react';
import { logger } from '@/services/LogService';
import { ResponsiveContainer, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, PieChart, Pie, Cell, LineChart, Line, ScatterChart, Scatter } from 'recharts';
import { ProductionPlanItem, SalesDataRow, AppConstraints, ChartDataItem, Holiday } from '@/types/types';
import { DashboardIcon, MONTH_NAMES } from '@/constants/constants';
import { useAppContext } from '@/context/AppProvider';

const COLORS = ['#0088FE', '#00C49F', '#FFBB28', '#FF8042', '#8884D8', '#82Ca9D'];
const getDayTypeForProduction = (date: Date, holidays: Holiday[]): 'Weekday' | 'Saturday' | 'Sunday' | 'ProductiveHoliday' | 'NonProductiveHoliday' => {
    const yyyyMmDd = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
    const holidayInfo = holidays.find(h => h.date === yyyyMmDd);

    if (holidayInfo && (holidayInfo.appliesTo === 'Produccion' || holidayInfo.appliesTo === 'Ambos')) {
        return holidayInfo.isProductionAllowed ? 'ProductiveHoliday' : 'NonProductiveHoliday';
    }

    const dayOfWeek = date.getDay(); // 0 (Sun) to 6 (Sat)
    if (dayOfWeek === 0) return 'Sunday';
    if (dayOfWeek === 6) return 'Saturday';
    return 'Weekday'; // Mon-Fri
};


interface InteractiveAreaData {
  barChartData: { sector: string; units: number; dollars: number }[];
  pieChartData: { family: string; value: number }[];
  scatterPlotData: { units: number; dollars: number }[];
}

export const DashboardSection: React.FC<{ plan: ProductionPlanItem[]; salesData: SalesDataRow[]; constraints: AppConstraints; }> = ({ plan, salesData, constraints }) => {
  const [interactiveAreaContent, setInteractiveAreaContent] = useState<string>('');
  const [interactiveAreaData, setInteractiveAreaData] = useState<InteractiveAreaData>({
    barChartData: [],
    pieChartData: [],
    scatterPlotData: []
  });

  // Cargar datos de localStorage solo en cliente
  useEffect(() => {
    const savedData = localStorage.getItem('interactiveAreaData');
    if (savedData) {
      setInteractiveAreaData(JSON.parse(savedData));
    }
  }, []);

  // Log de montaje del componente
  useEffect(() => {
    logger.log(`\n--------------------------------------------------\n##################################\n--------------------------------------------------\n[DashboardSection] Montado.`);
  }, []);

  useEffect(() => {
    localStorage.setItem('interactiveAreaData', JSON.stringify(interactiveAreaData));
  }, [interactiveAreaData]);

  const handleContentChange = (event: React.ChangeEvent<HTMLTextAreaElement>) => {
    setInteractiveAreaContent(event.target.value);
  };

  const handleGenerateCharts = () => {
    // Simulación de datos para gráficos
    const barChartData = [
      { sector: 'Sector A', units: 100, dollars: 200 },
      { sector: 'Sector B', units: 150, dollars: 300 }
    ];

    const pieChartData = [
      { family: 'Family A', value: 400 },
      { family: 'Family B', value: 600 }
    ];

    const scatterPlotData = [
      { units: 100, dollars: 200 },
      { units: 150, dollars: 300 }
    ];

    setInteractiveAreaData({ barChartData, pieChartData, scatterPlotData });
  };

  const planComplianceData = useMemo<ChartDataItem[]>(() => {
    if (!plan || !salesData) return [];
    
    const monthlySalesDemand: { [key: string]: number } = {}; // key: YYYY-MM
    salesData.forEach(row => {
      const key = `${row.año}-${String(row.mes).padStart(2, '0')}`;
      monthlySalesDemand[key] = (monthlySalesDemand[key] || 0) + row.unidadesProyectado;
    });

    const monthlyProduction: { [key: string]: number } = {};
    plan.forEach(item => {
      const key = `${item.year}-${String(item.month).padStart(2, '0')}`;
      monthlyProduction[key] = (monthlyProduction[key] || 0) + item.quantityToProduce;
    });
    
    const allMonths = new Set([...Object.keys(monthlySalesDemand), ...Object.keys(monthlyProduction)]);
    const sortedMonths = Array.from(allMonths).sort();

    return sortedMonths.map(monthKey => {
      const [year, monthNum] = monthKey.split('-');
      const monthName = MONTH_NAMES[parseInt(monthNum,10) -1];
      return {
        name: `${monthName.substring(0,3)} ${year.slice(-2)}`,
        proyectado: monthlySalesDemand[monthKey] || 0,
        producido: monthlyProduction[monthKey] || 0,
      };
    });
  }, [plan, salesData]);


  const capacityUtilizationData = useMemo<ChartDataItem[]>(() => {
    if (!plan || !constraints.productionLines.length || plan.length === 0) return [];
    
    const lineUsage: { [lineName: string]: { usedHours: number } } = {};
    const lineCapacity: { [lineName: string]: { totalHours: number } } = {};

    // 1. Calculate total available hours per line for the entire planning period
    const firstPlanDate = new Date(plan[0].year, plan[0].month - 1, 1);
    const lastPlanDate = new Date(plan[plan.length-1].year, plan[plan.length-1].month, 0);
    
    const activeLines = constraints.productionLines.filter(l => l.isActive !== false);

    activeLines.forEach(line => {
      lineCapacity[line.name] = { totalHours: 0 };
      lineUsage[line.name] = { usedHours: 0 };
    });

    // Capacity calculation logic MUST match OptimizationService
    const REGULAR_HOURS_PER_DAY = 8;
    const EXTRA_HOURS_PER_DAY = 2;
    const SATURDAY_HOLIDAY_HOURS = 5;

    for (let d = new Date(firstPlanDate); d <= lastPlanDate; d.setDate(d.getDate() + 1)) {
        const dayType = getDayTypeForProduction(d, constraints.holidays);
        let hoursToday = 0;
        
        if (dayType === 'Weekday') {
            hoursToday = REGULAR_HOURS_PER_DAY + EXTRA_HOURS_PER_DAY; // Total potential hours
        } else if (dayType === 'Saturday' || dayType === 'ProductiveHoliday') {
            hoursToday = SATURDAY_HOLIDAY_HOURS;
        }

        if (hoursToday > 0) {
            activeLines.forEach(line => {
                if (!lineCapacity[line.name]) lineCapacity[line.name] = { totalHours: 0 };
                lineCapacity[line.name].totalHours += hoursToday;
            });
        }
    }

    // 2. Sum up used hours from the plan
    plan.forEach(item => {
        if (item.assignedLineId && lineUsage[item.assignedLineId] && item.hoursWorked > 0) {
            lineUsage[item.assignedLineId].usedHours += item.hoursWorked;
        }
    });

    return activeLines.map(line => {
        const usage = lineUsage[line.name];
        const capacity = lineCapacity[line.name];
        const utilization = capacity && capacity.totalHours > 0 ? (usage.usedHours / capacity.totalHours) * 100 : 0;
        return {
            name: line.name,
            utilizacion: parseFloat(utilization.toFixed(1)),
        };
    }).filter(d => d.utilizacion > 0);
  }, [plan, constraints]);

  const inventoryLevelsData = useMemo<ChartDataItem[]>(() => {
    if (!constraints.inventorySettings.length) return [];
    // This is conceptual as currentStock is not dynamically updated in this example.
    // We can show configured min/max against a hypothetical current stock or just the settings.
    return constraints.inventorySettings.map(setting => ({
        name: setting.itemName,
        minStock: setting.minStock,
        maxStock: setting.maxStock,
        // currentStock: setting.currentStock || 0 // if available
    }));
  }, [constraints.inventorySettings]);

  const laborCostData = useMemo<ChartDataItem[]>(() => {
    if (!plan) return [];
    const monthlyCosts: { [key: string]: number } = {};
     plan.forEach(item => {
      const key = `${item.year}-${String(item.month).padStart(2, '0')}`;
      monthlyCosts[key] = (monthlyCosts[key] || 0) + item.estimatedLaborCost;
    });
    const allMonths = new Set(Object.keys(monthlyCosts));
    const sortedMonths = Array.from(allMonths).sort();

    return sortedMonths.map(monthKey => {
      const [year, monthNum] = monthKey.split('-');
      const monthName = MONTH_NAMES[parseInt(monthNum,10) -1];
      return {
        name: `${monthName.substring(0,3)} ${year.slice(-2)}`,
        costo: parseFloat(monthlyCosts[monthKey].toFixed(0)),
      };
    });
  }, [plan]);


  if (plan.length === 0 && salesData.length === 0) {
    return (
      <div className="p-6 md:p-8 text-center">
        <DashboardIcon />
        <h2 className="text-2xl font-semibold text-gray-700 mt-4">Dashboard</h2>
        <p className="text-gray-500 mt-2">Importe datos y genere un plan para ver las visualizaciones.</p>
      </div>
    );
  }

  return (
    <div className="p-4 md:p-6 space-y-6">
      <div className="flex items-center space-x-3 mb-6">
        <DashboardIcon />
        <h2 className="text-2xl font-semibold text-gray-700">Dashboard de Producción</h2>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Plan Compliance Chart */}
        <div className="bg-white p-4 rounded-xl shadow-lg">
          <h3 className="text-lg font-semibold text-gray-700 mb-3">Cumplimiento del Plan (Unidades)</h3>
          {planComplianceData.length > 0 ? (
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={planComplianceData} margin={{ top: 5, right: 20, left: -20, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="name" />
                <YAxis />
                <Tooltip />
                <Legend />
                <Bar dataKey="proyectado" fill="#8884d8" name="Ventas Proyectadas" />
                <Bar dataKey="producido" fill="#82ca9d" name="Producción Realizada" />
              </BarChart>
            </ResponsiveContainer>
          ) : <p className="text-gray-500 text-sm">No hay datos suficientes para este gráfico.</p>}
        </div>

        {/* Capacity Utilization Chart */}
        <div className="bg-white p-4 rounded-xl shadow-lg">
          <h3 className="text-lg font-semibold text-gray-700 mb-3">Utilización de Horas por Línea (%)</h3>
           {capacityUtilizationData.length > 0 ? (
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={capacityUtilizationData} layout="vertical" margin={{ top: 5, right: 30, left: 30, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis type="number" domain={[0, 100]}/>
                <YAxis dataKey="name" type="category" width={100} />
                <Tooltip formatter={(value: number) => `${value}%`} />
                <Legend />
                <Bar dataKey="utilizacion" fill="#00C49F" name="Utilización de Horas" barSize={20} />
              </BarChart>
            </ResponsiveContainer>
          ) : <p className="text-gray-500 text-sm">No hay datos suficientes para este gráfico (requiere plan y líneas con capacidad definida).</p>}
        </div>

        {/* Inventory Levels (Example - could be more dynamic) */}
        <div className="bg-white p-4 rounded-xl shadow-lg">
          <h3 className="text-lg font-semibold text-gray-700 mb-3">Niveles de Inventario Configurados</h3>
          {inventoryLevelsData.length > 0 ? (
            <ResponsiveContainer width="100%" height={300}>
                <BarChart data={inventoryLevelsData} margin={{ top: 5, right: 20, left: -20, bottom: 50 }}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="name" angle={-30} textAnchor="end" interval={0} height={70} />
                    <YAxis />
                    <Tooltip />
                    <Legend />
                    <Bar dataKey="minStock" stackId="a" fill="#FFBB28" name="Stock Mínimo" />
                    <Bar dataKey="maxStock" stackId="a" fill="#FF8042" name="Stock Máximo" />
                    {/* <Bar dataKey="currentStock" fill="#0088FE" name="Stock Actual" /> */}
                </BarChart>
            </ResponsiveContainer>
          ): <p className="text-gray-500 text-sm">No hay configuraciones de inventario definidas.</p>}
        </div>
        
        {/* Labor Costs Chart */}
        <div className="bg-white p-4 rounded-xl shadow-lg">
          <h3 className="text-lg font-semibold text-gray-700 mb-3">Costos de Mano de Obra Estimados ($)</h3>
          {laborCostData.length > 0 ? (
            <ResponsiveContainer width="100%" height={300}>
              <LineChart data={laborCostData} margin={{ top: 5, right: 20, left: -20, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="name" />
                <YAxis />
                <Tooltip formatter={(value: number) => `$${value.toLocaleString()}`}/>
                <Legend />
                <Line type="monotone" dataKey="costo" stroke="#8884d8" strokeWidth={2} name="Costo Labor Mensual" activeDot={{ r: 8 }} />
              </LineChart>
            </ResponsiveContainer>
          ) : <p className="text-gray-500 text-sm">No hay datos de costos en el plan de producción.</p>}
        </div>

      </div>

      {/* Interactive Area */}
      <div style={{ marginTop: '20px', padding: '10px', border: '1px solid #ccc', borderRadius: '5px' }}>
        <h3>Área Interactiva</h3>
        <button onClick={handleGenerateCharts} style={{ marginBottom: '10px', padding: '10px', borderRadius: '5px' }}>
          Generar Gráficos
        </button>

        <h4>Gráfico de Barras</h4>
        <BarChart width={400} height={300} data={interactiveAreaData.barChartData}>
          <XAxis dataKey="sector" />
          <YAxis />
          <Tooltip />
          <Bar dataKey="units" fill="#8884d8" />
          <Bar dataKey="dollars" fill="#82ca9d" />
        </BarChart>

        <h4>Gráfico de Pastel</h4>
        <PieChart width={400} height={300}>
          <Pie data={interactiveAreaData.pieChartData} dataKey="value" nameKey="family" fill="#8884d8" />
        </PieChart>

        <h4>Gráfico de Dispersión</h4>
        <ScatterChart width={400} height={300}>
          <XAxis dataKey="units" />
          <YAxis dataKey="dollars" />
          <Scatter data={interactiveAreaData.scatterPlotData} fill="#8884d8" />
        </ScatterChart>
      </div>
    </div>
  );
};
