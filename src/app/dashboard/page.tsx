'use client';

import React from 'react';
import { DashboardSection } from '@/components/DashboardSection';
import { useAppContext } from '@/context/AppProvider';

export default function DashboardPage() {
  const { productionPlan, salesData, constraints } = useAppContext();

  return (
    <DashboardSection
      plan={productionPlan.dailyPlan}
      salesData={salesData}
      constraints={constraints}
    />
  );
}
