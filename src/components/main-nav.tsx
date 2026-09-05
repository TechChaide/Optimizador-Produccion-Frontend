'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { ActiveView, viewConfig, OPCIONES_ITEMS, PARAMETROS_ITEMS, CONFIGURACIONES_ITEMS } from '@/constants/constants';
import { useAppLoading } from '@/context/AppProvider';
import { cn } from '@/lib/utils';
import { Loader2, ChevronDown, ChevronRight, LayoutDashboard, Settings, Folder } from 'lucide-react';

interface CollapsibleSectionProps {
  title: string;
  icon: React.ReactNode;
  items: ActiveView[];
  isOpen: boolean;
  onToggle: () => void;
  pathname: string;
  isLoading: boolean;
  isCollapsed?: boolean;
}

function CollapsibleSection({ 
  title, 
  icon, 
  items, 
  isOpen, 
  onToggle, 
  pathname, 
  isLoading,
  isCollapsed = false
}: Readonly<CollapsibleSectionProps>) {
  const hasActiveChild = items.some(viewId => {
    const config = viewConfig[viewId];
    return config?.href && pathname === config.href;
  });

  return (
    <div className="space-y-1">
      <button
        onClick={onToggle}
        className={cn(
          'w-full flex items-center px-3 py-2 text-primary-foreground rounded-md text-sm font-medium hover:bg-white/20 gap-x-3',
          hasActiveChild && 'bg-white/15',
          isCollapsed && 'justify-center px-2'
        )}
        title={isCollapsed ? title : undefined}
      >
        {icon}
        {!isCollapsed && (
          <>
            <span className="flex-1 text-left">{title}</span>
            {isOpen ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
          </>
        )}
      </button>
      
      {isOpen && !isCollapsed && (
        <div className="ml-4 pl-2 border-l border-white/20 space-y-1">
          {items.map(viewId => {
            const config = viewConfig[viewId];
            if (!config?.href) return null;
            
            const isActive = pathname === config.href;

            return (
              <Link
                key={viewId}
                href={config.href}
                prefetch={false}
                className={cn(
                  'flex items-center px-3 py-2 text-primary-foreground rounded-md text-sm font-medium hover:bg-white/20 gap-x-3',
                  isActive && 'bg-white/25',
                  isLoading ? 'cursor-not-allowed opacity-50' : ''
                )}
                aria-disabled={isLoading}
                onClick={(e) => {
                  if (isLoading) e.preventDefault();
                }}
              >
                {React.cloneElement(config.icon, { className: 'h-4 w-4' })}
                <span className="flex-1 text-xs">{config.title}</span>
                {isLoading && viewId === ActiveView.PRODUCTION_PLAN && (
                  <Loader2 className="h-4 w-4 animate-spin" />
                )}
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}

export function MainNav({ className, isCollapsed = false, ...props }: Readonly<React.HTMLAttributes<HTMLElement> & { isCollapsed?: boolean }>) {
  const isLoading = useAppLoading();
  const pathname = usePathname();
  const [mounted, setMounted] = useState(false);
  
  const [opcionesOpen, setOpcionesOpen] = useState(true);
  const [parametrosOpen, setParametrosOpen] = useState(false);
  const [configuracionesOpen, setConfiguracionesOpen] = useState(false);

  // Hydration guard to prevent mismatch errors
  useEffect(() => {
    setMounted(true);
  }, []);

  if (!mounted) {
    return null; // Don't render until client-side hydration is complete
  }

  const dashboardConfig = viewConfig[ActiveView.DASHBOARD];
  const isDashboardActive = pathname === dashboardConfig?.href;

  return (
    <nav className={cn('flex flex-col space-y-2', className)} {...props}>
      {/* Dashboard - enlace directo */}
      <Link
        href={dashboardConfig?.href || '/dashboard'}
        prefetch={false}
        className={cn(
          'flex items-center px-3 py-2 text-primary-foreground rounded-md text-sm font-medium hover:bg-white/20 gap-x-3',
          isDashboardActive && 'bg-white/25',
          isLoading ? 'cursor-not-allowed opacity-50' : '',
          isCollapsed && 'justify-center px-2'
        )}
        aria-disabled={isLoading}
        title={isCollapsed ? 'Dashboard' : undefined}
        onClick={(e) => {
          if (isLoading) e.preventDefault();
        }}
      >
        <LayoutDashboard className="h-5 w-5" />
        {!isCollapsed && <span className="flex-1">Dashboard</span>}
      </Link>

      {/* Opciones - sección contraíble */}
      <CollapsibleSection
        title="Opciones"
        icon={<Folder className="h-5 w-5" />}
        items={OPCIONES_ITEMS}
        isOpen={opcionesOpen}
        onToggle={() => setOpcionesOpen(!opcionesOpen)}
        pathname={pathname}
        isLoading={isLoading}
        isCollapsed={isCollapsed}
      />

      {/* Parámetros - sección contraíble */}
      <CollapsibleSection
        title="Parámetros"
        icon={<Settings className="h-5 w-5" />}
        items={PARAMETROS_ITEMS}
        isOpen={parametrosOpen}
        onToggle={() => setParametrosOpen(!parametrosOpen)}
        pathname={pathname}
        isLoading={isLoading}
        isCollapsed={isCollapsed}
      />

      {/* Configuraciones - sección contraíble */}
      <CollapsibleSection
        title="Configuraciones"
        icon={<Settings className="h-5 w-5" />}
        items={CONFIGURACIONES_ITEMS}
        isOpen={configuracionesOpen}
        onToggle={() => setConfiguracionesOpen(!configuracionesOpen)}
        pathname={pathname}
        isLoading={isLoading}
        isCollapsed={isCollapsed}
      />
    </nav>
  );
}
