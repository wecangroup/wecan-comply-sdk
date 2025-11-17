import type { AxiosInstance, AxiosRequestConfig, AxiosResponse } from 'axios';
import { HeadersInitLike, HttpClientLike, HttpRequest, HttpResponse, HttpError } from './HttpClient';

function normalizeHeaders(headers: any): HeadersInitLike {
    const out: HeadersInitLike = {};
    if (!headers) return out;
    for (const key of Object.keys(headers)) {
        const value = (headers as any)[key];
        if (Array.isArray(value)) out[key.toLowerCase()] = value.join(', ');
        else if (value != null) out[key.toLowerCase()] = String(value);
    }
    return out;
}

export function createAxiosHttpClient(axios: AxiosInstance): HttpClientLike {
    return {
        async request<T = unknown>(req: HttpRequest): Promise<HttpResponse<T>> {
            const config: AxiosRequestConfig = {
                method: req.method.toLowerCase() as AxiosRequestConfig['method'],
                url: req.url,
                headers: req.headers,
                data: req.body,
                timeout: req.timeoutMs,
                validateStatus: () => true,
            };

            let res: AxiosResponse;
            try {
                res = await axios.request(config);
            } catch (e: any) {
                // Axios throws on network errors/timeouts
                throw new HttpError(e?.message || 'Axios error');
            }

            const headers = normalizeHeaders(res.headers);

            if (res.status < 200 || res.status >= 300) {
                const payload = typeof res.data === 'string' ? res.data : JSON.stringify(res.data);
                throw new HttpError(`HTTP ${res.status}`, res.status, payload);
            }

            // raw is not a Fetch Response here; keep shape-compatible using a cast placeholder
            return { status: res.status, headers, data: res.data as T, raw: undefined as unknown as Response };
        },
    };
}


