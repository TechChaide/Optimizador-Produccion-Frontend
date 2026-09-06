'use client';

import Link from 'next/link';
import {
  ClipboardList,
  Clock,
  Tag,
  CalendarOff,
  Users2,
  Plug,
  ArrowRight,
} from 'lucide-react';

const SECTIONS = [
  {
    href: '/dashboard/parametros/turnos',
    icon: Clock,
    title: 'Turnos',
    description: 'Configura los horarios y turnos de trabajo disponibles en la planificación.',
    color: 'indigo',
  },
  {
    href: '/dashboard/parametros/tipo-detalle',
    icon: Tag,
    title: 'Tipos de Detalle',
    description: 'Administra los tipos de detalle utilizados en los planes tácticos.',
    color: 'sky',
  },
  {
    href: '/dashboard/parametros/tipo-ausentismo',
    icon: CalendarOff,
    title: 'Tipos de Ausentismo',
    description: 'Catálogo de motivos de ausentismo del personal operativo.',
    color: 'amber',
  },
  {
    href: '/dashboard/parametros/grupos',
    icon: Users2,
    title: 'Grupos',
    description: 'Grupos operativos, sus restricciones, relaciones y materiales de balanceo.',
    color: 'emerald',
  },
  {
    href: '/dashboard/parametros/conexiones',
    icon: Plug,
    title: 'Conexiones',
    description: 'Documentación de la API y endpoints disponibles del sistema.',
    color: 'rose',
  },
] as const;

const COLOR_CLASSES: Record<string, { badge: string; icon: string; hover: string }> = {
  indigo: { badge: 'bg-indigo-600/10', icon: 'text-indigo-600', hover: 'group-hover:border-indigo-200' },
  sky: { badge: 'bg-sky-600/10', icon: 'text-sky-600', hover: 'group-hover:border-sky-200' },
  amber: { badge: 'bg-amber-600/10', icon: 'text-amber-600', hover: 'group-hover:border-amber-200' },
  emerald: { badge: 'bg-emerald-600/10', icon: 'text-emerald-600', hover: 'group-hover:border-emerald-200' },
  rose: { badge: 'bg-rose-600/10', icon: 'text-rose-600', hover: 'group-hover:border-rose-200' },
};

export default function ParametrosPage() {
  return (
    <div className="p-6 md:p-8 space-y-8">
      <div className="flex items-center gap-3">
        <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-indigo-600/10">
          <ClipboardList className="h-6 w-6 text-indigo-600" />
        </div>
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-gray-900">Parámetros</h1>
          <p className="text-sm text-gray-500">Configura los catálogos y parámetros globales del sistema de producción.</p>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {SECTIONS.map(({ href, icon: Icon, title, description, color }) => {
          const colors = COLOR_CLASSES[color];
          return (
            <Link
              key={href}
              href={href}
              className={`group flex flex-col gap-4 rounded-2xl border border-gray-100 bg-white p-5 shadow-sm transition-all hover:-translate-y-0.5 hover:shadow-md ${colors.hover}`}
            >
              <div className="flex items-center justify-between">
                <div className={`flex h-11 w-11 items-center justify-center rounded-2xl ${colors.badge}`}>
                  <Icon className={`h-6 w-6 ${colors.icon}`} />
                </div>
                <ArrowRight className="h-4 w-4 text-gray-300 transition-all group-hover:translate-x-1 group-hover:text-gray-500" />
              </div>
              <div>
                <h3 className="text-base font-semibold text-gray-900">{title}</h3>
                <p className="mt-1 text-sm text-gray-500">{description}</p>
              </div>
            </Link>
          );
        })}
      </div>
    </div>
  );
}
