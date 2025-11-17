export type HttpMethod = 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';

export type HeadersInitLike = Record<string, string>;

export interface HttpRequest {
    method: HttpMethod;
    url: string;
    headers?: HeadersInitLike;
    body?: unknown;
    timeoutMs?: number;
}

export interface HttpResponse<T = unknown> {
    status: number;
    headers: HeadersInitLike;
    data: T;
    raw: Response;
}

export class HttpError extends Error {
    public readonly status?: number;
    public readonly responseText?: string;

    constructor(message: string, status?: number, responseText?: string) {
        super(message);
        this.name = 'HttpError';
        this.status = status;
        this.responseText = responseText;
    }
}

// A minimal interface that any HTTP client can implement to be used by the SDK
export interface HttpClientLike {
    request<T = unknown>(req: HttpRequest): Promise<HttpResponse<T>>;
}

/**
 * HTTP client interface with standard CRUD methods
 */
export interface HttpClientMethods {
    get: <T = unknown>(path: string, headers?: HeadersInitLike) => Promise<T>;
    post: <T = unknown>(path: string, body?: unknown, headers?: HeadersInitLike) => Promise<T>;
    put: <T = unknown>(path: string, body?: unknown, headers?: HeadersInitLike) => Promise<T>;
    patch: <T = unknown>(path: string, body?: unknown, headers?: HeadersInitLike) => Promise<T>;
    delete: <T = unknown>(path: string, headers?: HeadersInitLike) => Promise<T>;
}


