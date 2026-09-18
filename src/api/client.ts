export class ApiError extends Error {
  status: number;
  body: unknown;

  constructor(status: number, body: unknown) {
    super(`Error de la API (status ${status})`);
    this.status = status;
    this.body = body;
  }
}

const BASE_URL = import.meta.env.VITE_API_BASE_URL;

interface ApiFetchOptions {
  token: string;
  method?: string;
  body?: unknown;
}

export async function apiFetch<T>(path: string, options: ApiFetchOptions): Promise<T> {
  const headers: Record<string, string> = {
    Authorization: `Bearer ${options.token}`,
  };
  if (options.body !== undefined) {
    headers["Content-Type"] = "application/json";
  }

  const response = await fetch(`${BASE_URL}${path}`, {
    method: options.method ?? "GET",
    headers,
    body: options.body !== undefined ? JSON.stringify(options.body) : undefined,
  });

  const responseBody = await response.json().catch(() => undefined);

  if (!response.ok) {
    throw new ApiError(response.status, responseBody);
  }

  return responseBody as T;
}
