"use client";

import { Plug } from 'lucide-react';

export default function ConexionesPage() {
  return (
    <div className="p-6 md:p-8 space-y-6 h-screen flex flex-col">
      <div className="flex items-center gap-3">
        <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-rose-600/10">
          <Plug className="h-6 w-6 text-rose-600" />
        </div>
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-gray-900">Conexiones</h1>
          <p className="text-sm text-gray-500">Documentación de la API y endpoints disponibles del sistema.</p>
        </div>
      </div>

      <div className="flex-1 overflow-hidden rounded-2xl border border-gray-100 shadow-sm">
        <iframe
          src="https://apps.chaide.com/ProductionOptimizer/api-docs/"
          title="API Documentation"
          className="w-full h-full"
          frameBorder="0"
          allowFullScreen
        />
      </div>
    </div>
  );
}
