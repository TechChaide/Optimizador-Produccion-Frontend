
export const environment = {
    production: true,
    nombreAplicacion: "APP_OPTIMIZADOR_PRODUCCION",

    aplicaciones: ["APP_OPTIMIZADOR_PRODUCCION"],

    basePath: process.env.NEXT_PUBLIC_BASE_PATH || '',

    ////////////////////////////////////////Api de Producción (Optimizador)
    //apiURL : 'http://localhost:5400',
    apiURL : 'https://apps.chaide.com/ProductionOptimizer',

    ////////////////////////////////////////Api Planificador de Turnos (Gestión Turno Operadores)
    apiPlanificadorTurnos : 'http://localhost:8000',

    ////////////////////////////////////////Api de Seguridades
    //apiURLSeguridades : 'http://localhost:5400',
    apiURLSeguridades : 'https://apps.chaide.com/seguridadesGuard',

    ///////////////////////////////////////Api de reconocimiento Facial
    apiAuthFacial: 'https://apps.chaide.com/AServiceUth2',

    tituloSistema: 'SISTEMA INTEGRADO DE SEGURIDADES',
};
