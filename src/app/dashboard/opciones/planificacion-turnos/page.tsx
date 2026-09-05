'use client';

import { WorkShiftPlanningSection } from '@/components/WorkShiftPlanningSection';
import { useAppContext } from '@/context/AppProvider';

export default function PlanificacionTurnosPage() {
  const { 
    workShifts, 
    setWorkShifts, 
    constraints, 
    employees, 
    absenteeismEvents, 
    employeeSkills 
  } = useAppContext();

  return (
    <WorkShiftPlanningSection 
      shifts={workShifts} 
      setShifts={setWorkShifts} 
      constraints={constraints} 
      employees={employees} 
      absenteeismEvents={absenteeismEvents} 
      employeeSkills={employeeSkills} 
    />
  );
}
