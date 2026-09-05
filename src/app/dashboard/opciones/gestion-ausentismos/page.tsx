'use client';

import { AbsenteeismSection } from '@/components/AbsenteeismSection';
import { useAppContext } from '@/context/AppProvider';

export default function GestionAusentismosPage() {
  const { absenteeismEvents, setAbsenteeismEvents, employees } = useAppContext();
  return (
    <AbsenteeismSection 
      events={absenteeismEvents} 
      setEvents={setAbsenteeismEvents} 
      employees={employees} 
    />
  );
}
