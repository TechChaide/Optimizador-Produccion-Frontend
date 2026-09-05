'use client';

import React from 'react';
import Image from 'next/image';
import { DashboardSection } from '@/components/DashboardSection';
import { DataImportSection } from '@/components/DataImportSection';
import { ConstraintConfigurationSection } from '@/components/ConstraintConfigurationSection';
import { PersonnelManagementSection } from '@/components/PersonnelManagementSection';
import { MaintenanceSection } from '@/components/MaintenanceSection';
import { AbsenteeismSection } from '@/components/AbsenteeismSection';
import { ProductionPlanSection } from '@/components/ProductionPlanSection';
import { TacticalPlanSection } from '@/components/TacticalPlanSection';
import { TacticalPlan2Section } from '@/components/TacticalPlan2Section';
import { WorkShiftPlanningSection } from '@/components/WorkShiftPlanningSection';
import { RealDataSection } from '@/components/RealDataSection';
import { InventoryNeedsSection } from '@/components/InventoryNeedsSection';
import { ProductionCapacitySection } from '@/components/ProductionCapacitySection';
import { TacticalPlanMueblesSection } from '@/components/TacticalPlanMueblesSection';
import { NeedsCalculationC2000Section } from '@/components/NeedsCalculationC2000Section';
import { ActiveView, viewConfig } from '@/constants/constants';
import { useAppContext } from '@/context/AppProvider';
import { Toaster } from "@/components/ui/toaster";
import { ClientProvider } from '@/context/ClientProvider';
import { MainNav } from '@/components/main-nav';


// The component that needs the context
const ProductionOptimizerClient: React.FC = () => {
    const {
        activeView,
        dispatch,
        handleDataImported,
        salesData,
        productionPlan,
        handleGeneratePlan,
        isLoading,
        constraints,
        setConstraints,
        employees,
        setEmployees,
        employeeSkills,
        setSkills,
        maintenanceEvents,
        setMaintenanceEvents,
        absenteeismEvents,
        setAbsenteeismEvents,
        workShifts,
        setWorkShifts,
        handleGenerateTacticalPlan,
        tacticalPlanResult,
        addNotification,
        handleSyncAndValidate,
        syncStatus,
    } = useAppContext();

    const renderActiveView = () => {
        switch (activeView) {
            case ActiveView.DASHBOARD:
                return <DashboardSection plan={productionPlan.dailyPlan} salesData={salesData} constraints={constraints} />;
            case ActiveView.DATA_IMPORT:
                return <DataImportSection onDataImported={handleDataImported} />;
            case ActiveView.CONSTRAINTS:
                return <ConstraintConfigurationSection />;
            case ActiveView.NEEDS_CALCULATION_C2000:
                return <NeedsCalculationC2000Section />;
            case ActiveView.INVENTORY_NEEDS:
                return <InventoryNeedsSection />;
            case ActiveView.PRODUCTION_CAPACITY:
                return <ProductionCapacitySection />;
            case ActiveView.PERSONNEL:
                return <PersonnelManagementSection employees={employees} setEmployees={setEmployees} skills={employeeSkills} setSkills={setSkills} constraints={constraints} />;
            case ActiveView.MAINTENANCE:
                return <MaintenanceSection events={maintenanceEvents} setEvents={setMaintenanceEvents} constraints={constraints} onConstraintsUpdate={setConstraints} addNotification={addNotification} />;
            case ActiveView.ABSENTEEISM:
                return <AbsenteeismSection events={absenteeismEvents} setEvents={setAbsenteeismEvents} employees={employees} />;
            case ActiveView.PRODUCTION_PLAN:
                return <ProductionPlanSection />;
            case ActiveView.TACTICAL_SCHEDULING:
                return <TacticalPlanSection onGeneratePlan={handleGenerateTacticalPlan} />;
            case ActiveView.TACTICAL_SCHEDULING_2:
                return <TacticalPlan2Section />;
            case ActiveView.TACTICAL_SCHEDULING_MUEBLES:
                return <TacticalPlanMueblesSection />;
            case ActiveView.WORK_SHIFT_PLANNING:
                return <WorkShiftPlanningSection shifts={workShifts} setShifts={setWorkShifts} constraints={constraints} employees={employees} absenteeismEvents={absenteeismEvents} employeeSkills={employeeSkills} />;
            case ActiveView.DICTIONARY:
                return <RealDataSection />;
            default:
                return <DashboardSection plan={productionPlan.dailyPlan} salesData={salesData} constraints={constraints} />;
        }
    };

    return (
      <div className="flex h-screen bg-gray-100">
        {/* Sidebar */}
        <div className="hidden md:flex flex-col w-64 bg-primary text-primary-foreground">
            <div className="flex items-center justify-center h-20 bg-primary px-4 pt-5 pb-3">
                <Image src="/logo.png" alt="Chaide Logo" width={180} height={60} style={{width: 'auto', height: 'auto'}} />
            </div>
            <div className="flex flex-col flex-1 overflow-y-auto">
                <nav className="flex-1 px-2 py-4 space-y-2">
                  <MainNav />
                </nav>
            </div>
        </div>

        {/* Main content */}
        <div className="flex flex-col flex-1 overflow-y-auto">
            <div className="p-4">
              {renderActiveView()}
            </div>
        </div>
        <Toaster />
    </div>
    );
};


// This is the default export for the page, which is a Server Component.
// It wraps the Client Component in the provider.
export default function ProductionOptimizerPage() {
    return <ProductionOptimizerClient />;
}
