import type { ApiQuery } from '@/types/types';

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
            let serverMessage = 'Error desconocido en el servidor.';
            try {
                const parsed = JSON.parse(errorText);
                serverMessage = parsed.message || parsed.error || errorText;
            } catch {
                serverMessage = errorText;
            }
            
            const error: any = new Error(`Error API (${res.status}): ${serverMessage}`);
            error.status = res.status;
            error.info = serverMessage;
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
        // Redirigir a la fuente oficial de documentación en serviciosService
        endpoint = '/Aplicativos/ApiOptimizadorProduccion/api/servicios/diccionarioDeDatos';
        method = 'GET';
        body = undefined;
    } else {
        // Corregido: Las consultas de datos ahora apuntan al endpoint bajo /api/servicios/
        endpoint = '/Aplicativos/ApiOptimizadorProduccion/api/servicios/query';
    }

    const fullUrl = endpoint;
    console.log(`[useApiData] Querying API: ${method} ${fullUrl}`, body ? JSON.stringify(body) : 'No Body');
    try {
        const response = await fetcher(fullUrl, method, body);
        return response;
    } catch(e) {
        console.error('[useApiData] API Fetch failed:', e);
        throw e;
    }
};
