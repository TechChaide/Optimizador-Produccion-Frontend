'use client';

import React, { useState, useRef } from 'react';
import { useClickOutside } from './hooks';
import type { MultiSelectDropdownProps } from './types';

export const MultiSelectDropdown: React.FC<MultiSelectDropdownProps> = ({ 
  label, 
  options, 
  selected, 
  onChange, 
  disabled = false 
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement | null>(null);
  useClickOutside(containerRef, () => setIsOpen(false));

  const toggleOption = (value: string) => {
    const newSelected = selected.includes(value)
      ? selected.filter(v => v !== value)
      : [...selected, value];
    onChange(newSelected);
  };

  const getSelectedLabels = () => {
    return selected
      .map(val => options.find(opt => opt.value === val)?.label)
      .filter(Boolean);
  };

  return (
    <div className="relative" ref={containerRef}>
      <label className="block text-sm font-medium mb-2">{label}</label>
      <button
        onClick={() => setIsOpen(!isOpen)}
        disabled={disabled}
        className="w-full border rounded px-3 py-2 text-left bg-white hover:bg-gray-50 disabled:bg-gray-100 transition"
      >
        <div className="flex items-center justify-between">
          <span className={selected.length === 0 ? 'text-gray-500' : ''}>
            {selected.length === 0
              ? `Seleccionar ${label}...`
              : `${selected.length} seleccionado${selected.length !== 1 ? 's' : ''}`}
          </span>
          <span className="text-xs">▼</span>
        </div>
      </button>

      {isOpen && (
        <div className="absolute top-full left-0 right-0 mt-1 bg-white border rounded shadow-lg z-50 max-h-64 overflow-y-auto">
          {options.map(option => (
            <label
              key={option.value}
              className="flex items-center px-3 py-2 hover:bg-blue-50 cursor-pointer border-b last:border-b-0"
            >
              <input
                type="checkbox"
                checked={selected.includes(option.value)}
                onChange={() => toggleOption(option.value)}
                className="mr-2"
              />
              <span className="text-sm">{option.label}</span>
            </label>
          ))}
        </div>
      )}

      {/* Mostrar selecciones como badges */}
      <div className="mt-2 flex flex-wrap gap-1">
        {getSelectedLabels().map(label => (
          <span
            key={label}
            className="inline-block bg-blue-100 text-blue-800 text-xs px-2 py-1 rounded"
          >
            {label}
          </span>
        ))}
      </div>
    </div>
  );
};
