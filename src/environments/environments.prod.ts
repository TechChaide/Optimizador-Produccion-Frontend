
export const environment = {
    production: true,
    nombreAplicacion: "APP_BASE",

    aplicaciones: ["APP_BASE", "APP_CERTIFICADOS_CALIDAD", "APP_IT_ACTIVOS"],

    basePath: process.env.NEXT_PUBLIC_BASE_PATH || '',

    ////////////////////////////////////////Api de Producción (Optimizador)
    //apiURL : 'http://localhost:5400',
    apiURL : 'https://apps.chaide.com/ProductionOptimizer',

    ////////////////////////////////////////Api de Seguridades
    //apiURLSeguridades : 'http://localhost:5400',
    apiURLSeguridades : 'https://apps.chaide.com/seguridadesGuard',

    ///////////////////////////////////////Api de reconocimiento Facial
    apiAuthFacial: 'https://apps.chaide.com/AServiceUth2',

    tituloSistema: 'SISTEMA INTEGRADO DE SEGURIDADES',
};
