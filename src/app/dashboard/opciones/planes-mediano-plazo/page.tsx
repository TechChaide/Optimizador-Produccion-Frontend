'use client';

import React from 'react';
import { PlanesMedianoPlazoSection } from './components/PlanesMedianoPlazoSection';

export default function PlanesMedianoPlazoPage() {
  return (
    <div className="min-h-screen bg-gray-50">
      <div className="bg-white border-b border-gray-200 shadow-sm">
        <div className="px-6 py-4">
          <h1 className="text-xl font-semibold text-gray-800">Planes a Mediano Plazo</h1>
          <p className="text-sm text-gray-500 mt-0.5">
            Consulta y gestiona los planes de mediano plazo con sus semanas activas y detalles.
          </p>
        </div>
      </div>
      <div className="p-6">
        <PlanesMedianoPlazoSection />
      </div>
    </div>
  );
}
