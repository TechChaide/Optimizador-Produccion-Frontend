'use client';

import Image from 'next/image';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Eye, EyeOff, Camera } from 'lucide-react';
import { Label } from '@/components/ui/label';
import { useState } from 'react';
import { authService } from '@/services/seguridades/auth.service';
import { tipoUsuarioAplicacionService } from '@/services/seguridades/tipoUsuarioAplicacion.service';
import { environment } from '@/environments/environments.prod';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { AlertTriangle } from 'lucide-react';
import { toast } from '@/hooks/use-toast';
import { CameraModal } from '@/components/camera-modal';

function ChaideLogo() {
  return (
    <div className="flex flex-col items-center justify-center text-white">
      <div className="flex flex-col items-center gap-4">
        <Image
          src={`${environment.basePath}/img/logo_chaide.svg`}
          alt="Chaide Logo"
          width={250}
          height={250}
          priority
        />
      </div>
    </div>
  );
}

const initialState = {
  success: false,
  message: '',
};

function SubmitButton({ pending }: { pending: boolean }) {
    return (
        <Button type="submit" className="w-full" disabled={pending}>
            {pending ? 'Ingresando...' : 'Ingresar'}
        </Button>
    );
}

export default function LoginPage() {
    const [state, setState] = useState(initialState);
    const [pending, setPending] = useState(false);
    const [showPassword, setShowPassword] = useState(false);
    const [usuario, setUsuario] = useState('');
    const [loginType, setLoginType] = useState<'password' | 'facial' | null>(null);
    const [showCameraModal, setShowCameraModal] = useState(false);

    // Expresiones regulares para detectar tipo de login
    // nombre.apellido con opcionalmente números al final (requerir al menos un nombre antes del punto)
    const patternPassword = /^[a-z]+(?:\.[a-z]+)\d*$/i;
    // 1 a 4 números -> validación facial (documento corto)
    const patternFacial = /^\d{1,4}$/;
    // 5 o más números -> contraseña basada en documento largo
    const patternPasswordNumbers = /^\d{5,}$/;

    const detectLoginType = (value: string) => {
        setUsuario(value);
        // DEBUG: ver coincidencias (remover cuando esté validado)
        // console.debug('detectLoginType', value, { password: patternPassword.test(value), passwordNumbers: patternPasswordNumbers.test(value), facial: patternFacial.test(value) });

        if (patternPassword.test(value)) {
            setLoginType('password');
        } else if (patternPasswordNumbers.test(value)) {
            // Más de 4 números → contraseña
            setLoginType('password');
        } else if (patternFacial.test(value)) {
            // 1-4 números → validación facial
            setLoginType('facial');
        } else {
            setLoginType(null);
        }
    };

    const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
        e.preventDefault();
        
        // Si es validación facial, abrir modal de cámara
        if (loginType === 'facial') {
            setShowCameraModal(true);
            return;
        }

        // Login por contraseña (default si no es facial)
        setPending(true);
        setState(initialState);
        try {
            const formData = new FormData(e.currentTarget);
            const password = formData.get('password') as string;
            
            if (!password) {
                setState({ 
                    success: false, 
                    message: 'Por favor, ingrese su contraseña.' 
                });
                setPending(false);
                return;
            }
            
            const response = await authService.loginCentral({ email: usuario, password });

            // Con httpOnly cookies, el token está en la cookie (no en el body)
            // Solo verificamos que user y perfiles existan
            const layered = (obj: any, keys: string[]): any => keys.reduce((acc, k) => (acc && acc[k] !== undefined ? acc[k] : undefined), obj);
            const user     = layered(response, ['user'])     || layered(response, ['data', 'user'])     || layered(response, ['data', 'data', 'user']);
            const perfiles = layered(response, ['perfiles']) || layered(response, ['data', 'perfiles']) || layered(response, ['data', 'data', 'perfiles']);
            const message  = layered(response, ['message'])  || layered(response, ['data', 'message']);

            if (user && perfiles) {
                try {
                    // Guardar datos preliminares
                    if (user) localStorage.setItem('user', JSON.stringify(user));
                    if (perfiles) localStorage.setItem('perfiles', JSON.stringify(perfiles));

                    const perfilesArray: any[] = Array.isArray(perfiles) ? perfiles : [];
                    const appsByProfile: Record<string, any[]> = {};

                    // Recolectar perfiles por aplicación
                    for (const perfil of perfilesArray) {
                        const codigo = perfil?.codigo_tipo_usuario || perfil?.codigoTipoUsuario || perfil?.codigo || perfil?.id;
                        if (!codigo) continue;
                        try {
                            const resp = await tipoUsuarioAplicacionService.getByCodigoTipoUsuario(String(codigo));
                            const items: any[] = Array.isArray(resp?.data) ? resp.data : [];
                            for (const item of items) {
                                const codigoApp = item?.codigo_aplicacion || item?.aplicacion?.codigo_aplicacion;
                                if (codigoApp) {
                                    if (!appsByProfile[codigoApp]) appsByProfile[codigoApp] = [];
                                    if (!appsByProfile[codigoApp].includes(perfil)) appsByProfile[codigoApp].push(perfil);
                                }
                            }
                        } catch (err) {
                            // Continuar con siguiente perfil
                        }
                    }

                    const aplicacionesConfiguradas = Array.isArray(environment.aplicaciones) 
                        ? environment.aplicaciones 
                        : [environment.nombreAplicacion];
                    
                    const appsByProfileFiltrado: Record<string, any[]> = {};
                    for (const app of aplicacionesConfiguradas) {
                        if (appsByProfile[app]) {
                            appsByProfileFiltrado[app] = appsByProfile[app];
                        }
                    }

                    const aplicacionesValidas = Object.keys(appsByProfileFiltrado);
                    if (!aplicacionesValidas.length) {
                        setState({ success: false, message: 'No tienes acceso a las aplicaciones configuradas.' });
                        setPending(false);
                        return;
                    }

                    // Guardar datos en localStorage
                    localStorage.setItem('appsByProfile', JSON.stringify(appsByProfileFiltrado));
                    localStorage.setItem('aplicacionesDisponibles', JSON.stringify(aplicacionesValidas));

                    // Navegar al dashboard
                    const basePath = ((window as any).__NEXT_DATA__?.basePath || process.env.NEXT_PUBLIC_BASE_PATH || '').replace(/\/+$/, '');
                    window.location.href = `${basePath}/dashboard`;
                    console.log('✓ Login por contraseña exitoso');
                    console.log('appsByProfile:', appsByProfileFiltrado);
                    toast({
                        title: '¡Bienvenido!',
                        description: 'Has iniciado sesión exitosamente.',
                    });
                    return;
                } catch (validErr) {
                    setState({ success: false, message: 'Error validando acceso a la aplicación.' });
                    setPending(false);
                    return;
                }
            } else {
                // Si el backend dijo login successful pero no envió user/perfiles, lo tratamos como error de formato.
                setState({
                    success: false,
                    message: message ? `Respuesta inválida del servidor: faltan datos de usuario. (${message})` : 'Credenciales incorrectas.',
                });
            }
        } catch (error) {
            const errorMessage =
                typeof error === 'object' && error !== null && 'message' in error
                    ? (error as { message?: string }).message
                    : undefined;
            setState({ success: false, message: errorMessage || 'Error de autenticación.' });
        } finally {
            setPending(false);
        }
    };

    return (
        <div className="w-full lg:grid lg:min-h-[100vh] lg:grid-cols-2 xl:min-h-[100vh]">
            {/* Ocultar panel azul en móvil, mostrar solo en lg+ */}
            <div className="hidden lg:flex items-center justify-center py-12 bg-primary">
                <ChaideLogo />
            </div>
            <div className="flex items-center justify-center min-h-screen py-12">
                <Card className="mx-auto max-w-sm w-full shadow-2xl">
                    <CardHeader className="text-center">
                        <div className="flex justify-center items-center gap-2 mb-2">
                            <Image
                                src={`${environment.basePath}/img/Chide.svg`}
                                alt="Chaide Logo"
                                width={46}
                                height={46}
                                priority
                            />
                            <CardTitle className="text-2xl">Módulo de Optimización de la Planificación</CardTitle>
                        </div>
                        <CardDescription>
                            Inicio de Sesión
                        </CardDescription>
                    </CardHeader>
                    <CardContent>
                        <form onSubmit={handleSubmit}>
                            <div className="space-y-4 pt-6">
                                <div className="space-y-2">
                                    <Label htmlFor="usuario">Usuario</Label>
                                    <Input 
                                        id="usuario" 
                                        name="usuario" 
                                        placeholder="Ingrese su usuario (nombre.apellido o documento)" 
                                        value={usuario}
                                        onChange={(e) => detectLoginType(e.target.value)}
                                        required 
                                    />
                                    <p className="text-xs text-muted-foreground">
                                        {loginType === 'password' && '✓ Formato usuario detectado'}
                                        {loginType === 'facial' && '✓ Validación facial detectada'}
                                        {loginType === null && usuario && '✗ Formato no válido'}
                                    </p>
                                </div>

                                {/* Mostrar campo contraseña solo si loginType es 'password' */}
                                {loginType === 'password' && (
                                    <div className="space-y-2 animate-in fade-in">
                                        <Label htmlFor="password">Contraseña</Label>
                                        <div className="relative">
                                            <Input
                                                id="password"
                                                name="password"
                                                type={showPassword ? 'text' : 'password'}
                                                placeholder="Ingrese su contraseña"
                                                required
                                            />
                                            <button
                                                type="button"
                                                tabIndex={-1}
                                                className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-primary focus:outline-none"
                                                onClick={() => setShowPassword((v) => !v)}
                                                aria-label={showPassword ? 'Ocultar contraseña' : 'Mostrar contraseña'}
                                            >
                                                {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                                            </button>
                                        </div>
                                    </div>
                                )}
                                
                                {state && !state.success && state.message && (
                                    <Alert variant="destructive">
                                        <AlertTriangle className="h-4 w-4" />
                                        <AlertTitle>Error de autenticación</AlertTitle>
                                        <AlertDescription>
                                            {state.message}
                                        </AlertDescription>
                                    </Alert>
                                )}
                                
                                {/* Botón para login facial o contraseña, solo si el tipo es válido */}
                                {loginType === 'facial' && (
                                    <Button
                                        type="submit"
                                        className="w-full"
                                        disabled={pending}
                                    >
                                        <Camera className="w-4 h-4 mr-2" />
                                        {pending ? 'Validando...' : 'Validación Facial'}
                                    </Button>
                                )}
                                {loginType === 'password' && (
                                    <Button
                                        type="submit"
                                        className="w-full"
                                        disabled={pending}
                                    >
                                        {pending ? 'Ingresando...' : 'Ingresar'}
                                    </Button>
                                )}
                            </div>
                        </form>
                    </CardContent>
                </Card>

                {/* Modal de Validación Facial */}
                <CameraModal
                    isOpen={showCameraModal}
                    onClose={() => setShowCameraModal(false)}
                    employee={usuario ? { CODIGO: usuario, NOMBRE: usuario } : null}
                    onValidationComplete={async (result) => {
                        if (result.status === 'approved') {
                            setShowCameraModal(false);
                            
                            // Construir contraseña como objeto JSON
                            const codigo = result.empleado?.codigo || usuario;
                            const nombre = result.empleado?.nombre || '';
                            const departamento = result.empleado?.departamento || '';
                            const centro = result.empleado?.centro || '1000';
                            
                            const passwordObj = {
                                CODIGO: codigo,
                                NOMBRE: nombre,
                                DEPARTAMENTO: departamento,
                                CENTRO: centro
                            };
                            
                            console.log('✓ Validación facial exitosa');
                            console.log('Código:', codigo);
                            console.log('Password objeto:', passwordObj);
                            
                            toast({
                                title: 'Validación exitosa',
                                description: 'Ingresando al sistema...'
                            });

                            // Hacer login con loginCentral
                            setPending(true);
                            setState(initialState);
                            try {
                                console.log('Iniciando loginCentral con código:', codigo);
                                const response = await authService.loginCentral({ 
                                    email: codigo, 
                                    password: passwordObj 
                                });
                                
                                console.log('Respuesta del loginCentral:', response);

                                const layered = (obj: any, keys: string[]): any => keys.reduce((acc, k) => (acc && acc[k] !== undefined ? acc[k] : undefined), obj);
                                const user = layered(response, ['user']) || layered(response, ['data', 'user']) || layered(response, ['data', 'data', 'user']);
                                const perfiles = layered(response, ['perfiles']) || layered(response, ['data', 'perfiles']) || layered(response, ['data', 'data', 'perfiles']);

                                console.log('User encontrado:', user);
                                console.log('Perfiles encontrados:', perfiles);

                                if (user && perfiles) {
                                    if (user) localStorage.setItem('user', JSON.stringify(user));
                                    if (perfiles) localStorage.setItem('perfiles', JSON.stringify(perfiles));

                                    const perfilesArray = Array.isArray(perfiles) ? perfiles : [];
                                    const appsByProfile: Record<string, any[]> = {};

                                    for (const perfil of perfilesArray) {
                                        const codigoPerfil = perfil?.codigo_tipo_usuario || perfil?.codigoTipoUsuario || perfil?.codigo || perfil?.id;
                                        if (!codigoPerfil) continue;
                                        try {
                                            const resp = await tipoUsuarioAplicacionService.getByCodigoTipoUsuario(String(codigoPerfil));
                                            const items = Array.isArray(resp?.data) ? resp.data : [];
                                            for (const item of items) {
                                                const codigoApp = item?.codigo_aplicacion || item?.aplicacion?.codigo_aplicacion;
                                                if (codigoApp) {
                                                    if (!appsByProfile[codigoApp]) appsByProfile[codigoApp] = [];
                                                    if (!appsByProfile[codigoApp].includes(perfil)) appsByProfile[codigoApp].push(perfil);
                                                }
                                            }
                                        } catch (err) {
                                            console.error('Error procesando perfil:', err);
                                        }
                                    }

                                    const aplicacionesConfiguradas = Array.isArray(environment.aplicaciones) 
                                        ? environment.aplicaciones 
                                        : [environment.nombreAplicacion];
                                    
                                    const appsByProfileFiltrado: Record<string, any[]> = {};
                                    for (const app of aplicacionesConfiguradas) {
                                        if (appsByProfile[app]) {
                                            appsByProfileFiltrado[app] = appsByProfile[app];
                                        }
                                    }

                                    const aplicacionesValidas = Object.keys(appsByProfileFiltrado);
                                    console.log('Aplicaciones válidas:', aplicacionesValidas);
                                    
                                    if (aplicacionesValidas.length > 0) {
                                        localStorage.setItem('appsByProfile', JSON.stringify(appsByProfileFiltrado));
                                        console.log('✓ Login facial exitoso - Datos guardados en localStorage');
                                        console.log('Aplicaciones válidas:', aplicacionesValidas);
                                        console.log('User:', user);
                                        console.log('AppsByProfile:', appsByProfileFiltrado);
                                        // Redirigir al dashboard tras login facial exitoso
                                        const basePath = ((window as any).__NEXT_DATA__?.basePath || process.env.NEXT_PUBLIC_BASE_PATH || '').replace(/\/+$/, '');
                                        window.location.href = `${basePath}/dashboard`;
                                        toast({
                                            title: 'Login exitoso',
                                            description: 'Acceso al dashboard completado'
                                        });
                                    } else {
                                        setState({ success: false, message: 'No tienes acceso a las aplicaciones configuradas.' });
                                    }
                                } else {
                                    console.error('No se encontró user o perfiles');
                                    setState({ success: false, message: 'Error al procesar la validación facial. User o perfiles no encontrados.' });
                                }
                            } catch (err) {
                                console.error('Error en login facial:', err);
                                setState({ success: false, message: 'Error al completar el login facial.' });
                            } finally {
                                setPending(false);
                            }
                        } else {
                            toast({
                                title: 'Validación fallida',
                                description: result.message || result.error,
                                variant: 'destructive'
                            });
                        }
                    }}
                />
            </div>
        </div>
    );
}
