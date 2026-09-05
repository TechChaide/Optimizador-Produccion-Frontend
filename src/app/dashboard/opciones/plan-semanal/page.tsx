'use client';

import React, { useEffect } from 'react';
import { useRouter } from 'next/navigation';

export default function PlanSemanalPage() {
  const router = useRouter();
  useEffect(() => {
    router.replace('/dashboard/opciones/importar-ventasV2');
  }, [router]);

  return (
    <div className="min-h-[30vh] flex items-center justify-center text-sm text-gray-600">
      Redirigiendo a Importar Ventas V2...
    </div>
  );
}
