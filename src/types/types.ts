

export type SyncStatus = {
    isSynced: boolean;
    lastSyncTimestamp: string | null;
    errors: string[];
}

export interface PlanningProgress {
  message: string;
  current: number;
  total: number;
  step: 'monthly' | 'daily';
}


export type AppState = {
  year: number | null;
  activeView: ActiveView;
  salesData: SalesDataRow[];
  isLoading: boolean;
  productionPlan: ProductionPlan;
  detailedProductionPlan: DetailedProductionPlan | null;
  planningProgress: PlanningProgress | null;
  constraints: AppConstraints;
  employees: Employee[];
  employeeSkills: EmployeeSkill[];
  maintenanceEvents: MaintenanceEvent[];
  absenteeismEvents: AbsenteeismEvent[];
  workShifts: WorkShift[];
  tacticalPlanResult: TacticalPlanResult | null;
  syncStatus: SyncStatus | null;
  // New state for step-by-step planning
  planningStep: number;
  demandAnalysis: DemandAnalysisResult | null;
  apiAssemblyData: TiempoEnsambleItem[];
  apiCuboInventariosData: CuboInventariosItem[];
  planningYear: string;
  planningMonth: string;
  c2000RequiredHours: Record<string, number>;
};

export type AppAction =
  | { type: 'SET_YEAR'; payload: number }
  | { type: 'SET_ACTIVE_VIEW'; payload: ActiveView }
  | { type: 'SET_SALES_DATA'; payload: SalesDataRow[] }
  | { type: 'GENERATE_PRODUCTION_PLAN_START' }
  | { type: 'GENERATE_PRODUCTION_PLAN_SUCCESS'; payload: ProductionPlan }
  | { type: 'GENERATE_PRODUCTION_PLAN_ERROR'; payload: string[] }
  | { type: 'SET_CONSTRAINTS'; payload: AppConstraints }
  | { type: 'SET_EMPLOYEES'; payload: Employee[] }
  | { type: 'SET_EMPLOYEE_SKILLS'; payload: EmployeeSkill[] }
  | { type: 'SET_MAINTENANCE_EVENTS'; payload: MaintenanceEvent[] }
  | { type: 'SET_ABSENTEEISM_EVENTS'; payload: AbsenteeismEvent[] }
  | { type: 'SET_WORK_SHIFTS'; payload: WorkShift[] }
  | { type: 'GENERATE_TACTICAL_PLAN'; payload: TacticalPlanResult | null }
  | { type: 'SET_IS_LOADING'; payload: boolean }
  | { type: 'SET_SYNC_STATUS'; payload: SyncStatus | null }
  | { type: 'SET_PLANNING_PROGRESS'; payload: PlanningProgress | null }
  // New actions for step-by-step planning
  | { type: 'SET_PLANNING_STEP'; payload: number }
  | { type: 'SET_DEMAND_ANALYSIS'; payload: DemandAnalysisResult | null }
  | { type: 'RESET_PLANNING' }
  | { type: 'SET_API_ASSEMBLY_DATA'; payload: TiempoEnsambleItem[] }
  | { type: 'SET_API_CUBO_INVENTARIOS_DATA'; payload: CuboInventariosItem[] }
  | { type: 'SET_PLANNING_YEAR'; payload: string }
  | { type: 'SET_PLANNING_MONTH'; payload: string }
  | { type: 'SET_C2000_REQUIRED_HOURS'; payload: Record<string, number> };


export type AbsenteeismEvent = {
  id: string;
  reason: 'Vacaciones' | 'Cita Médica' | 'Capacitaciones';
  startDate: string; 
  startTime: string; 
  endDate: string;   
  endTime: string;   
  employeeIds: string[]; 
  notes?: string;
};

export type MaintenanceEvent = {
  id: string;
  title: string;
  processType: ProcessType; 
  workstationDefinitionId: string; 
  productionLineId?: string; 
  startDate: string; 
  startTime: string; 
  endDate: string;   
  endTime: string;   
};

export type Employee = {
  id: string;
  name: string;
  employeeCode: string;
  isActive?: boolean;
};

export interface Qualification {
  centerId: string;
  role: 'Operador' | 'Ayudante';
  skillLevel: number; 
}

export interface EmployeeSkill {
  employeeId: string;
  machineCode: string; 
  qualifications: Qualification[];
}

export type ProcessType = 'Colchones' | 'Forros' | 'Bases' | 'Paneles' | 'Espuma' | 'Muebles';

export interface SalesDataRow {
  id: string; 
  año: number;
  mes: number;
  sector: string; 
  etiqueta: string; 
  código: string; 
  centro: string; 
  unidadesProyectado: number;
  dolaresProyectado: number;
  descripciónMaterial: string; 
  familia: string;
  marca: string;
  lineaProduccion: string; 
  ClaseAprovisionamiento?: 'E' | 'X' | 'F' | 'N/A';
  // Campos originales del backend
  Mes?: number;
  CodMaterial?: string;
  Centro?: string;
  CentroFabricacion?: string;
  ClaseAprovisionam?: string;
  UnidadesProyectado?: number;
  StockActual?: number;
  StockSeguridad?: number;
  Sector?: string;
  LineaFabricacion?: string | null;
}

export interface WorkstationDefinition {
  id:string;
  name: string; 
  employeesPerWorkstation: number; 
  machineCode: string | null; 
  isActive?: boolean;
}

export interface ProductProcessInfo {
  id: string; 
  productId: string; 
  productName?: string; 
  productionLineId: string; 
  workstationTimes: Array<{ workstationDefinitionId: string; timeHours: number }>; 
  totalManufacturingTimeHours: number; 
  ClaseAprovisionamiento?: 'E' | 'X' | 'F';
}

export interface ProductionLine {
  id: string;
  name: string;
  workCenterId: string; 
  processType: ProcessType; 
  assignedWorkstations: Array<{ 
    definitionId: string; 
    quantity: number;     
  }>;
  capacity: { 
    maxUnitsPerHour: number;
    normalUnitsPerHour: number;
    minUnitsPerHour: number;
  };
  materialsHandled: string[];
  isActive?: boolean;
}

export interface WorkCenter {
  id: string;
  name: string; 
  productionLineIds: string[];
  isActive?: boolean;
}

export interface LaborCostSettings {
  factorAdicionalDiurno: number; 
  factorRecargoNocturno: number; 
  factorFinSemanaFeriado: number; 
}

export interface ShiftParameters {
  regularHoursPerDay: number;
  extraHoursPerDay: number;
  saturdayAndHolidayHours: number;
}

export interface ShiftConfigRow {
  Centro: string;
  Año: number;
  Mes: number;
  RespCtrlProd: string;
  NombRespControlProd: string;
  'Horas Normales': number;
  'H.E. 50% (Diurnas)': number;
  'H.E. 100% (Sab-Dom/Fer)': number;
  '# Turnos': number;
  'Costo Horas Normales': number;
  'Costo H.E. 50% (Diurnas)': number;
  'Costo Recargo Jornada Nocturna (%)': number;
  'Costo H.E. 100% (Sab-Dom/Fer)': number;
}


export interface InventorySetting {
  id: string;
  itemId: string; 
  itemName: string;
  centerId: string; 
  isRawMaterial: boolean; 
  minStock: number;
  maxStock: number;
  currentStock: number; 
  lotMin: number; 
  lotMax: number | null; 
}

export interface Bottleneck { 
  id: string;
  description: string;
  location: string;
  estimatedImpactHours: number;
  isActive?: boolean;
}

export interface SupplierDeliveryTime { 
  id: string;
  materialId: string;
  materialName: string;
  supplierName: string;
  leadTimeDays: number;
  isActive?: boolean;
}

export interface QualityParameter { 
  id: string;
  name: string;
  description: string;
  impactOnTimePercent?: number;
  impactOnCostPercent?: number;
  isActive?: boolean;
}

export interface SupplyInfo {
  código: string;
  centro: string;
  aprovisionamiento: 'E' | 'X' | 'F';
}

export type HolidayScope = 'Distribucion' | 'Toda la Planta' | ProcessType | string; // string for lineId or workCenterId

export interface Holiday {
  id: string;
  date: string; 
  name: string;
  appliesTo: HolidayScope;
  isProductionAllowed: boolean;
  dayType: 'full' | 'half' | 'asueto';
}


export interface ProductionPlanItem {
  id: string;
  productId: string;
  productName: string;
  year: number;
  month: number;
  week: number;
  day: number; 
  quantityToProduce: number;
  demandOnDay: number; 
  initialStockOnDay: number; 
  finalStockOnDay: number; 
  assignedLineId?: string; 
  producingCenterId?: string; 
  demandCenterId?: string; 
  shiftId?: string; 
  estimatedLaborCost: number;
  hoursWorked: number; 
  status: 'Planificado' | 'En Progreso' | 'Completado' | 'Retrasado' | 'Factibilidad Baja' | 'Error en Datos' | 'Transferencia';
  notes?: string;
  isTransfer?: boolean;
  transferDestinationCenterId?: string; 
  transferSourceCenterId?: string; 
}

export interface MonthlyProductionPlanItem {
    id: string; 
    year: number;
    month: number;
    productId: string;
    productName: string;
    centerId: string; // Centro de Demanda
    producingCenterId: string; // Centro de Producción
    totalQuantityToProduce: number;
    totalDemand: number;
    dispatches: number;
    netTransfers: number;
    initialStock: number;
    finalStock: number;
    backlogVentas: number;
    backlogTrasladosF: number;
    backlogTrasladosX: number;
    totalHoursWorked: number;
    totalEstimatedLaborCost: number;
    assignedLineId?: string;
}

export interface WeeklyPlanItem {
  id: string;
  year: number;
  week: number;
  productId: string;
  productName: string;
  workCenterId: string;
  lineId: string;
  initialStock: number;
  production: number;
  sales: number;
  dispatches: number;
  netTransfers: number;
  finalStock: number;
  unmetDemand: number;
}


export interface ProductionPlan {
    dailyPlan: ProductionPlanItem[];
    monthlyPlan: MonthlyProductionPlanItem[];
    weeklyPlan: WeeklyPlanItem[];
    auditLog: string[];
    initialInventory?: Map<string, number>;
}

export interface PlanningGroupMonthlyDetail {
  pairKey: string;
  productId: string;
  centerName: string;
  year: number;
  month: number;
  demand: number;
  initialStock: number;
  minStock: number;
}

export interface MonthlyNeed {
  pairKey: string;
  productId: string;
  centerName: string;
  year: number;
  month: number;
  productionNeeded: number;
}

export interface MonthlyAssignment {
  id: string; 
  year: number;
  month: number;
  lineId: string;
  lineName: string;
  ppiId: string;
  productId: string;
  centerName: string; 
  demandCenterId: string; 
  units: number;
  originalNeedUnits: number;
  advancedUnits: number;
  totalHours: number;
  laborCost: number;
}

export interface DetailedProductionPlan {
  planningGroupDetails: PlanningGroupMonthlyDetail[];
  productionNeeds: MonthlyNeed[];
  monthlyAssignments: MonthlyAssignment[];
}

export interface LineMonthlySummary {
  lineId: string;
  lineName: string;
  centerName: string;
  year: number;
  month: string;
  initialStock: number;
  minStock: number;
  demand: number;
  production: number;
  finalStock: number;
  workingDays: number;
  avgWeekdayHours: number;
  saturdaysWorked: number;
  avgSaturdayHours: number;
c_count: number;
}

export interface AppConstraints {
  workstationDefinitions: WorkstationDefinition[]; 
  workCenters: WorkCenter[];
  productionLines: ProductionLine[];
  productProcessInfos: ProductProcessInfo[];
  globalBaseCostPerHour: number | null; 
  laborCostFactors: LaborCostSettings | null; 
  shiftParameters: ShiftParameters;
  inventorySettings: InventorySetting[];
  bottlenecks: Bottleneck[];
  contingencyFundPercentage: number;
  supplierDeliveryTimes: SupplierDeliveryTime[];
  qualityParameters: QualityParameter[];
  holidays: Holiday[];
  importedShiftConfigs?: ShiftConfigRow[];
}

export interface NotificationMessage {
  id: string;
  type: 'success' | 'error' | 'warning' | 'info';
  text: string;
  errors?: string[]; 
}

export interface ChartDataItem {
  name: string;
  value?: number;
  [key: string]: any;
}

export interface MonthlyInventoryState {
  [centerId: string]: {
    [productId: string]: {
      initialStock: number;
      produced: number;
      receivedViaTransfer: number;
      salesDemandFulfilled: number;
      transferredOut: number;
      finalStock: number;
    };
  };
}

export interface ShiftProportions {
  daytimeProportion: number;
  nighttimeProportion: number;
}

export interface ProvisionalOrder {
    rowIndex: number;
    ORDENPREVISIONAL: string;
    MATERIAL: string;
    NOMBRE: string;
    CANTIDAD: number;
    FECHAINICIO: string; 
    CENTRO: string;
}

export interface TacticalRequest {
    executionDate: string; 
    targetDate: string; 
    provisionalOrders: ProvisionalOrder[];
}

export interface AssignedPersonnel {
    workstationDefinitionId: string;
    workstationName: string;
    required: number;
    available: (Employee & { skillLevel?: number })[];
}

export interface TacticalOrderItem {
    id: string;
    productId: string;
    productName: string;
    centerName: string;
    quantity: number;
    assignedLineName: string;
    requiredHours: number;
    assignedPersonnel: AssignedPersonnel[];
}

export interface TacticalPlanResult {
    plan: TacticalOrderItem[];
    alerts: string[];
}

export interface WorkShift {
  id: string; 
  date: string; 
  lineId: string;
  workstationDefId: string;
  shiftType: 'day' | 'night';
  employeeIds: string[]; 
}

export interface Machine {
    code: string;
    name: string;
    processType: ProcessType;
}

export type ApiQuery = 
  | {
      operation: 'get_documentation';
    }
  | {
      operation: 'get_data';
      source: string;
      columns?: string[]; 
      filters?: { [key: string]: any };
      pagination?: { skip?: number; limit?: number };
    }
  | {
      operation: 'get_distinct_values';
      source: string;
      column: string;
    };
    
export interface PresupuestoItem {
  Año: number;
  Mes: number;
  Sector: string;
  Etiqueta: string;
  Centro: string;
  CodVendedor: string;
  CodMaterial: string;
  UnidadesProyectado: number;
  DolaresProyectado: number;
  Vendedor: string;
  Material: string;
  Familia: string;
  Marca: string;
  LineaProduccion: string;
}

export interface TiempoEnsambleItem {
  CodMaterial: string;
  Material?: string; // Adding this as it seems to be used
  Centro: string;
  Linea: string;
  PuestoTrabajo: string;
  Tiempo: number;
  StockActual: number;
  StockSeguridad: number;
  StockMaximo: number;
  TamLoteMin: number;
  TamLoteMax: number | null;
  GrupoCompras: string;
  ClaseAprovisionamiento: 'E' | 'X' | 'F' | null;
}

export interface CuboInventariosItem {
    Material: string;
    Centro: string;
    ClaseAprovisionam: 'E' | 'X' | 'F' | null;
    StockActual?: number;
    StockSeguridad?: number;
    Sector?: string;
    [key: string]: any; // Allow other fields
}

// New type for the demand analysis step
export interface DemandAnalysisResult {
    totalDemand: number;
    demandByGroup: Array<{
        claseAprovisionamiento: 'E' | 'X' | 'F' | 'N/A';
        centro: string;
        sector: string;
        totalUnidades: number;
        producingCenter: string;
    }>;
    unclassifiedMaterials: Array<{
        productId: string;
        productName: string;
        centerId: string;
        sector: string;
        demand: number;
    }>;
    transfers: Array<{
        centro: string;
        sector: string;
        etiqueta: string;
        totalUnidades: number;
    }>;
    productionNeedsFirstMonth: Array<{
        producingCenterId: string;
        sector: string;
        claseAprovisionamiento: 'E' | 'X' | 'F' | 'N/A';
        totalUnits: number;
        requiredHours: number;
    }>;
    auditLog: string[];
}


import { ActiveView } from '@/constants/constants';

// This is the new type for the daily capacity view
export interface DailyCapacityRow {
  centro: string;
  mes: string;
  año: number;
  fecha: string;
  dia: string;
  esFeriado: string;
  maxHorasJornada: number;
  puestoDeTrabajo: string;
  linea: string;
  cantidadPuestos: number;
  horasMaxDisponibles: number;
}


export interface MaestroMaterialCentro {
  CENTRO: string;
  MATERIAL: string;
  TIPO_MATERIAL: string;
  DESCRIPCION: string;
  JERARQUIA: string;
  MARCA: string;
  FAMILIA: string | null;
  ETIQUETA: string | null;
  SECTOR: string;
  SectorDesc: string | null;
  PeticionBorrado: string | null;
  RespControlProd: string | null;
  GrupoCompras: string | null;
  PlanifNecesidades: string | null;
  Unidad: string;
  Categoria: string;
  Precio: number | null;
  Estrategia: string | null;
  HojaRuta: string | null;
  NombRespControlProd: string | null;
  GRUPO_ARTICULOS: string;
  DESC_GRUPO_ART: string;
  PESO_BRUTO: number;
  PESO_NETO: number;
  UNIDAD_PESO: string;
  GRUPO_TIPOS_POSICION_MATERIAL: string;
  FORMA_FABRIC: string;
  FABRICAPROPIA: number;
  TIEMPOTRATAEM: number;
  CLAVEHORIZ: string;
  PLAZOENTREGAPREV: number;
  TIEMPOGLOBALREAP: number;
}
