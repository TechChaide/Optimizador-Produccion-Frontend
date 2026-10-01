
export const environment = {
    production: true,
    nombreAplicacion: "APP_OPTIMIZADOR_PRODUCCION",

    aplicaciones: ["APP_OPTIMIZADOR_PRODUCCION"],

    basePath: process.env.NEXT_PUBLIC_BASE_PATH || '',

    ////////////////////////////////////////Api de Producción (Optimizador)
    //apiURL : 'http://localhost:5400',
    //apiURL : 'https://apps.chaide.com/ProductionOptimizer',
    apiURL : 'https://apps.chaide.com/ProductionOptimizer_test',

    ////////////////////////////////////////Api Planificador de Turnos (Gestión Turno Operadores)
    apiPlanificadorTurnos : 'http://localhost:8000',

    ////////////////////////////////////////Api de Seguridades
    apiURLSeguridades1 : 'https://apps.chaide.com/seguridades',

    //apiURLSeguridades : 'http://localhost:5400',
    apiURLSeguridades : 'https://apps.chaide.com/seguridadesGuard',

    ///////////////////////////////////////Api de reconocimiento Facial
    apiAuthFacial: 'https://apps.chaide.com/AServiceUth2',

    tituloSistema: 'SISTEMA INTEGRADO DE SEGURIDADES',

    ////////////////////////////////////////Carpeta compartida de planes TXT (ver src/lib/planes-txt.ts)
    // Cada "\" va escapado ("\\"): sin escapar, JS descarta la barra ("\A" -> "A") y la ruta queda
    // rota sin error. En el contenedor Docker (Linux) una ruta UNC no se puede abrir: ahí se monta el
    // recurso SMB como volumen y se sobreescribe con la variable de entorno RUTA_PLANES.
    ruta_planes: '\\\\192.168.7.51\\Archivos Compartidos\\Aplicativos\\Planificacion\\Optimizador-Produccion'

};
