

import type { ApiQuery, PresupuestoItem, TiempoEnsambleItem } from '@/types/types';

// --- Configuración Central de API ---
const API_TOKEN = 'SmGjjVAzURYKthfwGdY8riSK3U3mMCCBQBMiImGMRPuAo7BlUbwhyeemswWuP9kf721d3d';

/**
 * Un 'fetcher' genérico y reutilizable para peticiones a la API.
 * Se encarga de hacer la petición fetch, añadir el token de autorización,
 * y parsear la respuesta como JSON. Puede manejar peticiones GET y POST.
 */
const fetcher = async (url: string, method: 'GET' | 'POST', body?: any) => {
    const options: RequestInit = {
        method,
        headers: {
            'Authorization': `Bearer ${API_TOKEN}`,
            'Content-Type': 'application/json',
            'Accept': 'application/json',
        },
    };

    if (method === 'POST' && body) {
        options.body = JSON.stringify(body);
    }

    try {
        const res = await fetch(url, options);

        if (!res.ok) {
            const errorText = await res.text();
            const error: any = new Error('Ocurrió un error al cargar los datos desde la API.');
            try {
                error.info = JSON.parse(errorText);
            } catch (e) {
                error.info = { message: `No se pudo leer el cuerpo del error. Estado: ${res.status}`, statusText: res.statusText, body: errorText };
            }
            error.status = res.status;
            throw error;
        }

        if (res.status === 204 || res.headers.get('content-length') === '0') {
            return null;
        }

        const jsonResponse = await res.json();
        return jsonResponse;

    } catch (error) {
        console.error('Fetcher: Capturado error de fetch', error);
        throw error;
    }
};

/**
 * Realiza una consulta genérica al nuevo motor de la API.
 * @param query El objeto de la consulta, que puede ser para documentación o datos.
 * @returns La respuesta de la API.
 */
export const queryApi = async (query: ApiQuery): Promise<any> => {
    let endpoint = '';
    let method: 'GET' | 'POST' = 'POST';
    let body: any = query;

    if (query.operation === 'get_documentation') {
        endpoint = '/Aplicativos/ApiOptimizadorProduccion/documentation/';
        method = 'GET';
        body = undefined; // No body for documentation GET request
    } else {
        endpoint = '/Aplicativos/ApiOptimizadorProduccion/query/';
    }

    const fullUrl = endpoint;
    console.log(`[useApiData] Querying API: ${method} ${fullUrl}`, body ? JSON.stringify(body) : 'No Body');
    try {
        const response = await fetcher(fullUrl, method, body);
        // console.log(`[useApiData] API Response:`, response); // This can be too verbose
        return response;
    } catch(e) {
        console.error('[useApiData] API Fetch failed:', e);
        throw e;
    }
};
