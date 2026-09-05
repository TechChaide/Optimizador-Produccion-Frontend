'use client';

import { TacticalPlanSection } from '@/components/TacticalPlanSection';
import { useAppContext } from '@/context/AppProvider';

export default function ProgramacionTacticaPage() {
  const { handleGenerateTacticalPlan } = useAppContext();
  return <TacticalPlanSection onGeneratePlan={handleGenerateTacticalPlan} />;
}
