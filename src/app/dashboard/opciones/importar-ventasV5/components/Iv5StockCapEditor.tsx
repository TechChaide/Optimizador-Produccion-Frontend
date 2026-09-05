'use client';

import React from 'react';
import type { Iv5StockCap } from './iv5Types';
import { IV5_DEFAULT_CAP_C1000, IV5_DEFAULT_CAP_C2000 } from './iv5Constants';

/**
 * Editor de topes agregados de stock IV5.
 *
 * Aplica a la suma de stock final de los sectores `01 COLCHONES`,
 * `02 BASES-CABECEROS-CAMA` y `03 MUEBLES FABRICACION` por centro.
 * Defaults parametrizables (Q16 confirmado por el usuario).
 */
interface Props {
  value: Iv5StockCap;
  maxSabadosMes: number;
  onChange: (next: Iv5StockCap) => void;
  onMaxSabadosChange: (n: number) => void;
}

export const Iv5StockCapEditor: React.FC<Props> = ({ value, maxSabadosMes, onChange, onMaxSabadosChange }) => {
  const handleNum = (key: 'centro1000' | 'centro2000', raw: string) => {
    const n = Number(raw);
    if (!Number.isFinite(n) || n < 0) return;
    onChange({ ...value, [key]: n });
  };

  const handleReset = () => {
    onChange({
      ...value,
      centro1000: IV5_DEFAULT_CAP_C1000,
      centro2000: IV5_DEFAULT_CAP_C2000,
    });
  };

  return (
    <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
      <div>
        <label className="block text-[11px] font-medium text-gray-700 mb-1">
          Tope agregado Centro 1000 (sectores 01+02+03)
        </label>
        <input
          type="number"
          min={0}
          step={100}
          value={value.centro1000}
          onChange={(e) => handleNum('centro1000', e.target.value)}
          className="w-full border border-gray-300 rounded px-2 py-1.5 text-xs"
        />
        <p className="text-[10px] text-gray-500 mt-0.5">
          Default: {IV5_DEFAULT_CAP_C1000.toLocaleString('es-EC')}.
        </p>
      </div>
      <div>
        <label className="block text-[11px] font-medium text-gray-700 mb-1">
          Tope agregado Centro 2000 (sectores 01+02+03)
        </label>
        <input
          type="number"
          min={0}
          step={100}
          value={value.centro2000}
          onChange={(e) => handleNum('centro2000', e.target.value)}
          className="w-full border border-gray-300 rounded px-2 py-1.5 text-xs"
        />
        <p className="text-[10px] text-gray-500 mt-0.5">
          Default: {IV5_DEFAULT_CAP_C2000.toLocaleString('es-EC')}.
        </p>
      </div>
      <div>
        <label className="block text-[11px] font-medium text-gray-700 mb-1">
          Maximo sabados/mes (parametrizable)
        </label>
        <input
          type="number"
          min={0}
          max={5}
          step={1}
          value={maxSabadosMes}
          onChange={(e) => {
            const n = Number(e.target.value);
            if (Number.isFinite(n) && n >= 0 && n <= 5) onMaxSabadosChange(n);
          }}
          className="w-full border border-gray-300 rounded px-2 py-1.5 text-xs"
        />
        <p className="text-[10px] text-gray-500 mt-0.5">
          Limite fisico mensual usado por el motor IV5.
        </p>
      </div>
      <div className="flex items-end">
        <button
          type="button"
          onClick={handleReset}
          className="text-xs px-3 py-1.5 rounded border border-gray-300 text-gray-700 hover:bg-gray-50"
        >
          Restablecer defaults
        </button>
      </div>
    </div>
  );
};

export default Iv5StockCapEditor;
