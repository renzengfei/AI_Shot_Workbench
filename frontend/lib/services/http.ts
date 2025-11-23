const API_BASE = process.env.NEXT_PUBLIC_API_BASE || 'http://localhost:8000';

async function request<T = unknown>(path: string, init?: RequestInit): Promise<T> {
    const res = await fetch(`${API_BASE}${path}`, init);
    if (!res.ok) {
        let detail = res.statusText;
        try {
            const data = (await res.json()) as { detail?: string };
            detail = data.detail || detail;
        } catch {
            // ignore
        }
        throw new Error(detail);
    }
    const contentType = res.headers.get('content-type') || '';
    if (contentType.includes('application/json')) {
        return res.json() as Promise<T>;
    }
    // @ts-expect-error: caller should know response type
    return res;
}

export const http = {
    get: <T = unknown>(path: string, init?: RequestInit) => request<T>(path, { method: 'GET', ...init }),
    post: <T = unknown>(path: string, body: unknown, init?: RequestInit) =>
        request<T>(path, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', ...(init?.headers || {}) },
            body: typeof body === 'string' ? body : JSON.stringify(body),
            ...init,
        }),
};

export { API_BASE };
