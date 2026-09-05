"use client";

export default function ConexionesPage() {
  return (
    <div className="p-6 md:p-8 space-y-6 h-screen flex flex-col">
      <div className="flex items-center space-x-3">
        <h2 className="text-2xl font-semibold text-gray-700">Parámetros - Conexiones</h2>
      </div>

      <div className="flex-1 border rounded-lg overflow-hidden shadow-lg">
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
