"use client";

import { AppShell, AppShellContent, AppShellHeader } from '@/components/layout/app-shell';
import { Sidebar, SidebarContent, SidebarHeader, SidebarMenu, SidebarMenuItem, SidebarMenuButton, SidebarProvider, MobileMenuButton, useSidebar } from '@/components/ui/sidebar-new';
import { ProtectedRoute } from '@/components/protected-route';
import Image from 'next/image';
import Link from 'next/link';
import {
    Collapsible,
    CollapsibleContent,
    CollapsibleTrigger,
} from "@/components/ui/collapsible"
import {
    Tooltip,
    TooltipContent,
    TooltipProvider,
    TooltipTrigger,
} from "@/components/ui/tooltip"
// Se importa el namespace completo de lucide-react (en vez de una lista fija de nombres)
// para que cualquier ícono definido en el backend (campo `icono` del menú) se resuelva
// automáticamente, incluyendo íconos agregados después de este archivo. Ver resolveIcon más abajo.
import * as LucideIcons from 'lucide-react';
import { ChevronsUpDown, LogOut } from 'lucide-react';
import React, { useEffect, useState } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { menuService } from '@/services/seguridades/menu.service';
import { serviciosService } from '@/services/seguridades/servicios.service';
import { useToast } from '@/hooks/use-toast';
import { environment } from '@/environments/environments.prod';
import { User } from '@/types/interfaces';
// (LogoutButton preserved in repo but not used here; we implement custom panel UI)


// Tipo local ampliado para soportar children anidados (el backend envía árbol).
type MenuNode = {
    codigo_menu: number;
    codigo_padre: number | null;
    nombre: string;
    icono: string;
    path: string;
    estado: string;
    codigo_aplicacion: string;
    children?: MenuNode[];
};

// Resuelve un ícono por nombre contra el paquete lucide-react completo (todos los
// exports, no una lista curada), así el mapeo siempre refleja la última versión
// instalada y cualquier nombre de ícono nuevo enviado por el backend se muestra
// sin tener que editar este archivo cada vez.
function resolveIcon(name: string): React.ComponentType<any> {
    const icons = LucideIcons as unknown as Record<string, React.ComponentType<any>>;
    return icons[name] || icons.Shield;
}

// Construir árbol de menú a partir de un array plano basándose en padre-hijo
function buildMenuTree(flatItems: MenuNode[]): MenuNode[] {
    const itemsById = new Map<number, MenuNode>();
    const roots: MenuNode[] = [];

    // Crear mapa de items por ID
    for (const item of flatItems) {
        itemsById.set(item.codigo_menu, { ...item, children: [] });
    }

    // Establecer relaciones padre-hijo
    for (const item of flatItems) {
        const treeItem = itemsById.get(item.codigo_menu)!;
        
        if (item.codigo_padre === null || item.codigo_padre === 0) {
            // Es un root
            roots.push(treeItem);
        } else {
            // ¿Tiene padre en el mapa?
            const parent = itemsById.get(item.codigo_padre);
            if (parent) {
                parent.children = parent.children || [];
                parent.children.push(treeItem);
            } else {
                // Padre no existe, tratar como root
                roots.push(treeItem);
            }
        }
    }

    // Ordenar raíces y sus hijos
    const sort = (nodes: MenuNode[]) => {
        nodes.sort((a, b) => a.codigo_menu - b.codigo_menu);
        for (const node of nodes) {
            if (node.children && node.children.length > 0) {
                sort(node.children);
            }
        }
    };
    sort(roots);

    return roots;
}

// Filtrar menú solo para items que pertenecen a una aplicación específica
function filterMenuByApp(nodes: MenuNode[], appCode: string): MenuNode[] {
    const result: MenuNode[] = [];
    for (const node of nodes) {
        const children = node.children ? filterMenuByApp(node.children, appCode) : [];
        
        // Incluir si:
        // 1. Pertenece a la app (codigo_aplicacion match)
        // 2. O es un agrupador/raíz que tiene hijos en la app
        const belongsToApp = !node.codigo_aplicacion || node.codigo_aplicacion === appCode;
        const isGrouper = node.path === '.' || node.path === '|' || !node.path;
        
        if (belongsToApp || (isGrouper && children.length > 0)) {
            result.push({ ...node, children });
        }
    }
    return result;
}

// Fusionar árboles de menús por codigo_menu (recursivo)
function mergeMenuTrees(trees: MenuNode[]): MenuNode[] {
    const byId = new Map<number, MenuNode>();

    const mergeInto = (target: MenuNode, source: MenuNode) => {
        if (!source.children || source.children.length === 0) return;
        target.children = target.children || [];
        const childMap = new Map<number, MenuNode>(target.children.map(c => [c.codigo_menu, c]));
        for (const sc of source.children) {
            const existing = childMap.get(sc.codigo_menu);
            if (existing) {
                mergeInto(existing, sc);
            } else {
                // Clonar superficialmente
                childMap.set(sc.codigo_menu, { ...sc, children: sc.children ? [...sc.children] : [] });
            }
        }
        target.children = Array.from(childMap.values()).sort((a, b) => a.codigo_menu - b.codigo_menu);
    };

    for (const root of trees) {
        const existing = byId.get(root.codigo_menu);
        if (existing) {
            mergeInto(existing, root);
        } else {
            byId.set(root.codigo_menu, { ...root, children: root.children ? [...root.children] : [] });
        }
    }
    return Array.from(byId.values()).sort((a, b) => a.codigo_menu - b.codigo_menu);
}

// Filtrar solo nodos activos (estado === 'A'). Mantener nodos agrupadores si conservan hijos activos.
function filterActive(nodes: MenuNode[]): MenuNode[] {
    const result: MenuNode[] = [];
    for (const n of nodes) {
        const children = n.children ? filterActive(n.children) : [];
        const isGroupish = n.path === '.' || n.path === '|' || !n.path || n.path === '#';
        const isActive = n.estado === 'A';
        if ((isActive && !isGroupish) || (isActive && isGroupish) || (isGroupish && children.length)) {
            result.push({ ...n, children });
        }
    }
    return result;
}

// Transformar árbol backend -> estructura esperada por RecursiveMenu
function toRecursiveItems(nodes: MenuNode[]): any[] {
    return nodes.map(n => {
        const IconComp = resolveIcon(n.icono);
        const hasChildren = !!(n.children && n.children.length);
        // Reglas:
        // '.' => raíz (no navegable)
        // '|' => agrupador (no navegable)
        // otro valor => ruta navegable
        const isRoot = n.path === '.';
        const isBranch = n.path === '|';
        const isNavigable = !(isRoot || isBranch) && !!n.path;
        const children = hasChildren ? toRecursiveItems(n.children!) : undefined;
        return {
            label: n.nombre,
            icon: IconComp,
            path: isNavigable ? n.path : undefined,
            children
        };
    });
}

// Componente para renderizar items del menú flotante (recursivo con n niveles)
const FloatingMenuItem = ({ item, pathname, level = 0 }: { item: any, pathname: string | null, level?: number }) => {
    const [isOpen, setIsOpen] = useState(false);
    const timeoutRef = React.useRef<NodeJS.Timeout | null>(null);
    const hasChildren = item.children && item.children.length > 0;
    
    const handleMouseEnter = () => {
        if (timeoutRef.current) {
            clearTimeout(timeoutRef.current);
        }
        setIsOpen(true);
    };
    
    const handleMouseLeave = () => {
        timeoutRef.current = setTimeout(() => {
            setIsOpen(false);
        }, 150); // Pequeño delay para permitir transición al submenú
    };
    
    if (hasChildren) {
        return (
            <div 
                className="relative"
                onMouseEnter={handleMouseEnter}
                onMouseLeave={handleMouseLeave}
            >
                <div className="flex items-center justify-between px-3 py-2 text-sm hover:bg-primary/10 rounded cursor-pointer mx-1">
                    <div className="flex items-center gap-2">
                        {item.icon && <item.icon className="h-4 w-4" />}
                        <span>{item.label}</span>
                    </div>
                    <svg className="h-3 w-3 ml-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                    </svg>
                </div>
                {isOpen && (
                    <div 
                        className="absolute left-full top-0 bg-white/90 backdrop-blur-md text-primary rounded-lg shadow-2xl min-w-[200px] py-1"
                        style={{ 
                            marginLeft: '-4px',
                            paddingLeft: '8px',
                            zIndex: 60 + level * 10 
                        }}
                        onMouseEnter={handleMouseEnter}
                        onMouseLeave={handleMouseLeave}
                    >
                        <div className="rounded-lg">
                            {item.children.map((child: any, idx: number) => (
                                <FloatingMenuItem key={idx} item={child} pathname={pathname} level={level + 1} />
                            ))}
                        </div>
                    </div>
                )}
            </div>
        );
    }
    
    // Item sin hijos - es un link navegable
    return (
        <Link
            href={item.path ? item.path : '#'}
            className={`flex items-center gap-2 px-3 py-2 text-sm hover:bg-primary/10 rounded mx-1 ${
                item.path && pathname?.startsWith(item.path) ? 'bg-primary/20 text-primary font-medium' : ''
            }`}
        >
            {item.icon && <item.icon className="h-4 w-4" />}
            <span>{item.label}</span>
        </Link>
    );
};

const RecursiveMenu = ({ items, level = 0 }: { items: any[], level?: number }) => {
    const { isCollapsed } = useSidebar();
    const pathname = usePathname();
    
    // Componente para menú flotante con hover (reemplaza Tooltip para ser interactivo)
    const CollapsedMenuWithHover = ({ item }: { item: any }) => {
        const [isOpen, setIsOpen] = useState(false);
        const [menuPosition, setMenuPosition] = useState({ top: 0, left: 0 });
        const triggerRef = React.useRef<HTMLDivElement>(null);
        const timeoutRef = React.useRef<NodeJS.Timeout | null>(null);
        
        const handleMouseEnter = () => {
            if (timeoutRef.current) clearTimeout(timeoutRef.current);
            if (triggerRef.current) {
                const rect = triggerRef.current.getBoundingClientRect();
                setMenuPosition({
                    top: rect.top,
                    left: rect.right + 8
                });
            }
            setIsOpen(true);
        };
        
        const handleMouseLeave = () => {
            timeoutRef.current = setTimeout(() => setIsOpen(false), 150);
        };
        
        return (
            <>
                <div 
                    ref={triggerRef}
                    className="relative"
                    onMouseEnter={handleMouseEnter}
                    onMouseLeave={handleMouseLeave}
                >
                    <div className="w-10 h-10 flex items-center justify-center rounded-md hover:bg-primary-foreground/10 cursor-pointer">
                        <item.icon className="h-5 w-5" />
                    </div>
                </div>
                {isOpen && (
                    <div 
                        className="fixed bg-white/90 backdrop-blur-md text-primary rounded-lg shadow-2xl min-w-[200px]"
                        style={{ top: menuPosition.top, left: menuPosition.left, zIndex: 9999 }}
                        onMouseEnter={handleMouseEnter}
                        onMouseLeave={handleMouseLeave}
                    >
                        <div className="px-3 py-2 font-semibold flex items-center gap-2 border-b border-primary/10">
                            <item.icon className="h-4 w-4" />
                            {item.label}
                        </div>
                        <div className="py-1">
                            {item.children.map((child: any, childIndex: number) => (
                                <FloatingMenuItem key={childIndex} item={child} pathname={pathname} />
                            ))}
                        </div>
                    </div>
                )}
            </>
        );
    };
    
    return (
        <TooltipProvider delayDuration={0}>
            <div className="w-full" style={{ paddingLeft: level > 0 && !isCollapsed ? '1rem' : '0' }}>
                {items.map((item, index) => (
                    <Collapsible key={index} className={isCollapsed ? 'w-full flex justify-center' : 'w-full'}>
                        {item.children ? (
                            <>
                                {isCollapsed ? (
                                    <CollapsedMenuWithHover item={item} />
                                ) : (
                                    <>
                                        <CollapsibleTrigger className="w-full">
                                            <div className="flex items-center justify-between w-full p-2 rounded-md hover:bg-primary/80">
                                                <div className="flex items-center gap-2">
                                                    <item.icon className="h-5 w-5" />
                                                    <span>{item.label}</span>
                                                </div>
                                                <ChevronsUpDown className="h-4 w-4" />
                                            </div>
                                        </CollapsibleTrigger>
                                        <CollapsibleContent>
                                            <RecursiveMenu items={item.children} level={level + 1} />
                                        </CollapsibleContent>
                                    </>
                                )}
                            </>
                        ) : (
                            <SidebarMenuItem>
                                {isCollapsed ? (
                                    <Tooltip>
                                        <TooltipTrigger asChild>
                                            <SidebarMenuButton
                                                href={item.path ? item.path : '#'}
                                                active={item.path ? pathname?.startsWith(item.path) : false}
                                                className="h-10 w-10 justify-center"
                                            >
                                                <item.icon className="h-5 w-5" />
                                            </SidebarMenuButton>
                                        </TooltipTrigger>
                                        <TooltipContent side="right" sideOffset={5} className="bg-white/90 backdrop-blur-md text-primary border-0 shadow-lg">
                                            {item.label}
                                        </TooltipContent>
                                    </Tooltip>
                                ) : (
                                    <SidebarMenuButton
                                        href={item.path ? item.path : '#'}
                                        active={item.path ? pathname?.startsWith(item.path) : false}
                                        className="justify-start pl-4 h-9"
                                    >
                                        <item.icon className="h-4 w-4 mr-2" />
                                        {item.label}
                                    </SidebarMenuButton>
                                )}
                            </SidebarMenuItem>
                        )}
                    </Collapsible>
                ))}
            </div>
        </TooltipProvider>
    );
};

// Sección superior: solo logo (varía colapsado / expandido)
function LogoSection() {
    const { isCollapsed } = useSidebar();
    if (isCollapsed) {
        return (
            <div className="flex items-center justify-center py-4">
                <Image src={`${environment.basePath}/img/Chide.svg`} alt="Chaide Logo" width={40} height={40} />
            </div>
        );
    }
    return (
        <div className="flex items-center justify-center py-4">
            <Image src={`${environment.basePath}/img/logo_chaide.svg`} alt="Chaide Logo" width={170} height={46} />
        </div>
    );
}

// Panel inferior: info usuario + logout
function UserPanel() {
    const { isCollapsed } = useSidebar();
    const [userInfo, setUserInfo] = useState<User | any>(null);
    const [fullName, setFullName] = useState<string>('');

    useEffect(() => {
        const loadUserData = async () => {
            try {
                // Cargar userInfo desde localStorage
                let userData: any = null;
                const userStr = typeof window !== 'undefined' ? localStorage.getItem('user') : null;
                if (userStr) {
                    try { userData = JSON.parse(userStr); } catch { /* ignore */ }
                }
                
                // Si no hay objeto user, intentar decodificar el JWT como fallback
                if (!userData) {
                    const rawToken = typeof window !== 'undefined' ? localStorage.getItem('token') : null;
                    if (rawToken) {
                        const parts = rawToken.split('.');
                        if (parts.length >= 2) {
                            try {
                                const payloadStr = atob(parts[1].replace(/-/g, '+').replace(/_/g, '/'));
                                userData = JSON.parse(payloadStr);
                            } catch { /* ignore decode errors */ }
                        }
                    }
                }
                
                if (!userData) {
                    return;
                }
                
                // Actualizar userInfo en estado
                setUserInfo(userData);
                
                // Ahora cargar información completa del usuario desde serviciosService
                const condicion = userData.condicion;
                
                if (condicion === 'Usuario Interno' && userData.codigo_empleado) {
                    try {
                        const response = await serviciosService.getInformacionUsuarioByCodigoEmpleado(userData.codigo_empleado);
                        if (response?.data && Array.isArray(response.data) && response.data.length > 0) {
                            setFullName(response.data[0].NOMBRE || '');
                        }
                    } catch (err) {
                        console.warn('No se pudo cargar info de usuario interno:', err);
                    }
                } else if (condicion === 'Usuario Externo') {
                    // Para usuarios externos, usar id_usuario del localStorage
                    const userFromStorage = JSON.parse(localStorage.getItem('user') || '{}');
                    const idUsuario = userFromStorage?.id_usuario;
                    
                    if (idUsuario) {
                        try {
                            const response = await serviciosService.getInformacionUsuarioExternoByIdentificacion(idUsuario);
                            if (response?.data && typeof response.data === 'object') {
                                setFullName(response.data.nombres || '');
                            }
                        } catch (err) {
                            console.warn('No se pudo cargar info de usuario externo:', err);
                        }
                    }
                }
            } catch (error) {
                console.error('Error cargando datos del usuario:', error);
            }
        };
        
        loadUserData();
    }, []);

    const displayName: string = fullName || userInfo?.name || userInfo?.usuario || userInfo?.username || userInfo?.correo_usuario || userInfo?.email || userInfo?.sub || 'Usuario';
    const codigoEmpleado = userInfo?.codigo_empleado || userInfo?.employee_code || userInfo?.codigo || null;
    const avatarText = (displayName || '?').trim().charAt(0).toUpperCase();

    const handleLogout = () => {
        try {
            localStorage.removeItem('token');
            localStorage.removeItem('user');
            localStorage.removeItem('perfiles');
            localStorage.removeItem('appsByProfile');
            localStorage.removeItem('aplicacionesDisponibles');
            localStorage.removeItem('perfilesAutorizados'); // Limpiar datos antiguos si existen
            localStorage.clear(); // Eliminar todas las variables de sesión
        } catch (error) {
            console.error('Error al limpiar localStorage:', error);
        }
        const basePath = ((window as any).__NEXT_DATA__?.basePath || process.env.NEXT_PUBLIC_BASE_PATH || '').replace(/\/+$/, '');
        window.location.href = basePath ? `${basePath}/` : '/';
    };

    if (isCollapsed) {
        return (
            <div className="flex items-center justify-center py-4 border-t border-white/10">
                <button
                    aria-label="Cerrar sesión"
                    onClick={handleLogout}
                    className="h-10 w-10 flex items-center justify-center rounded-full bg-white text-primary shadow hover:scale-105 transition"
                >
                    <LogOut className="h-5 w-5" />
                </button>
            </div>
        );
    }

    return (
        <div className="w-full px-2 pb-4 mt-auto">
            <div className="flex items-center gap-4 rounded-2xl bg-white/15 px-3 py-3 backdrop-blur-sm shadow-inner">
                <div className="flex-1 min-w-0 leading-tight">
                    <p className="text-base font-semibold text-white break-words" title={displayName}>{displayName}</p>
                    {codigoEmpleado && <p className="text-xs text-white/80" title={codigoEmpleado}>{codigoEmpleado}</p>}
                    {userInfo?.condicion && <p className="text-xs text-white/80" title={userInfo.condicion}>{userInfo.condicion}</p>}
                    {userInfo?.email && <p className="text-[11px] text-white/60" title={userInfo.email}>{userInfo.email}</p>}
                </div>
                <button
                    aria-label="Cerrar sesión"
                    onClick={handleLogout}
                    className="h-12 w-12 flex items-center justify-center rounded-full bg-white text-primary shadow hover:scale-105 transition"
                >
                    <LogOut className="h-5 w-5" />
                </button>
            </div>
        </div>
    );
}


export default function DashboardLayout({
    children,
}: {
    children: React.ReactNode
}) {
    const [menuItems, setMenuItems] = useState<Record<string, any[]>>({});
    const [menuLoading, setMenuLoading] = useState<boolean>(true);
    const [menuError, setMenuError] = useState<string | null>(null);
    const { toast } = useToast();
    const router = useRouter();

    useEffect(() => {
        const loadMenus = async () => {
            try {
                const appsByProfileStr = typeof window !== 'undefined' ? localStorage.getItem('appsByProfile') : null;
                if (!appsByProfileStr) {
                    toast({
                        title: "Sin datos de aplicaciones",
                        description: "No se encontraron aplicaciones disponibles. Por favor, inicia sesión nuevamente.",
                        variant: "destructive",
                    });
                    router.push('/');
                    return;
                }

                const appsByProfile: Record<string, any[]> = JSON.parse(appsByProfileStr);
                
                // Filtrar SOLO las apps que están en environment.aplicaciones
                const aplicacionesConfiguradas = Array.isArray(environment.aplicaciones) 
                    ? environment.aplicaciones 
                    : [environment.nombreAplicacion];
                
                // Iterar sobre cada aplicación en appsByProfile
                const aplicacionesParaCargar = Object.keys(appsByProfile).filter(app => 
                    aplicacionesConfiguradas.includes(app)
                );

                if (!aplicacionesParaCargar.length) {
                    toast({
                        title: "Sin aplicaciones disponibles",
                        description: "No tienes acceso a las aplicaciones configuradas.",
                        variant: "destructive",
                    });
                    router.push('/');
                    return;
                }

                // Cargar menús para cada aplicación en el mapa
                const menusByApp: Record<string, any[]> = {};

                await Promise.all(aplicacionesParaCargar.map(async (nombreApp) => {
                    try {
                        // Obtener los perfiles para esta aplicación
                        const perfilesDelApp = appsByProfile[nombreApp] || [];
                        const codigosList = perfilesDelApp
                            .map((p: any) => p?.tipo_usuario?.codigo_tipo_usuario || p?.codigo_tipo_usuario || p?.codigo)
                            .filter(Boolean);

                        if (codigosList.length === 0) {
                            console.log(`Sin perfiles para ${nombreApp}`);
                            return;
                        }

                        // Cargar menú para CADA perfil de esta app
                        const menuResults: MenuNode[] = [];
                        await Promise.all(codigosList.map(async (codigo: string) => {
                            try {
                                const resp = await menuService.getMenuByCodigoTipoUsuario(String(codigo));
                                const candidate: any = (resp as any)?.data && (resp as any).data.codigo_menu ? (resp as any).data : resp;
                                if (candidate && typeof candidate === 'object' && candidate.codigo_menu) {
                                    menuResults.push(candidate as MenuNode);
                                }
                            } catch (err) {
                                console.error(`Error cargando menú para perfil ${codigo}:`, err);
                            }
                        }));

                        if (menuResults.length === 0) {
                            console.log(`Sin menús obtenidos para ${nombreApp}`);
                            return;
                        }

                        // Fusionar todos los menús de los perfiles de esta app
                        const merged = mergeMenuTrees(menuResults);
                        
                        // Filtrar SOLO items que pertenecen a esta aplicación
                        const filteredByApp = filterMenuByApp(merged, nombreApp);
                        
                        // Filtrar items activos
                        const filtered = filterActive(filteredByApp);
                        
                        console.log(`Menú fusionado y filtrado para ${nombreApp}:`, filtered);
                        
                        if (filtered.length > 0) {
                            menusByApp[nombreApp] = toRecursiveItems(filtered);
                        }
                    } catch (err) {
                        console.error(`Error procesando menú de ${nombreApp}:`, err);
                    }
                }));

                const appsConMenu = Object.keys(menusByApp);
                if (!appsConMenu.length) {
                    toast({
                        title: "Sin menús disponibles",
                        description: "No se pudo cargar menús para ninguna aplicación. Contacta al administrador.",
                        variant: "destructive",
                    });
                    router.push('/');
                    return;
                }

                setMenuItems(menusByApp);
            } catch (err: any) {
                toast({
                    title: "Error cargando menús",
                    description: err?.message || 'Error inesperado al cargar los menús del sistema',
                    variant: "destructive",
                });
                router.push('/');
            } finally {
                setMenuLoading(false);
            }
        };
        loadMenus();
    }, [toast, router]);

    return (
        <ProtectedRoute>
            <SidebarProvider>
                <div className="flex h-screen w-full bg-background overflow-hidden">
                    <Sidebar>
                        <SidebarHeader>
                            <LogoSection />
                        </SidebarHeader>
                        <SidebarContent>
                            <SidebarMenu>
                                {menuLoading && (
                                    <div className="text-xs text-white/70 px-2 py-1">Cargando menús...</div>
                                )}
                                {!menuLoading && menuError && (
                                    <div className="text-xs text-red-200 px-2 py-1">{menuError}</div>
                                )}
                                {!menuLoading && !menuError && Object.keys(menuItems).length > 0 && (
                                    <div className="w-full">
                                        {Object.entries(menuItems).map(([appName, items]) => (
                                            <div key={appName} className="w-full mb-2">
                                                <RecursiveMenu items={items} />
                                            </div>
                                        ))}
                                    </div>
                                )}
                                {!menuLoading && !menuError && Object.keys(menuItems).length === 0 && (
                                    <div className="text-xs text-white/60 px-2 py-1">Sin opciones de menú</div>
                                )}
                            </SidebarMenu>
                        </SidebarContent>
                        <UserPanel />
                    </Sidebar>
                    <div className="flex flex-col flex-1 relative h-full overflow-y-auto">
                        <MobileMenuButton />
                        {children}
                    </div>
                </div>
            </SidebarProvider>
        </ProtectedRoute>
    )
}
