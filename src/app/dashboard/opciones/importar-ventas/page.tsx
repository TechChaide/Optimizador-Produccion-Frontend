'use client';

import { DataImportSection } from '@/components/DataImportSection';
import { useAppContext } from '@/context/AppProvider';

export default function ImportarVentasPage() {
  const { handleDataImported } = useAppContext();
  return <DataImportSection onDataImported={handleDataImported} />;
}
