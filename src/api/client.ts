export class ApiError extends Error {
  status: number;
  body: unknown;

  constructor(status: number, body: unknown) {
    super(`Error de la API (status ${status})`);
    this.status = status;
    this.body = body;
  }
}

const BASE_URL = import.meta.env.VITE_API_BASE_URL ?? "https://cc-platform-api.azurewebsites.net";

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

// Variante para respuestas que no son JSON (archivos). apiFetch no cambia.
// Devuelve el Blob y el nombre que el servidor puso en Content-Disposition
// (null si no vino). En error lee el JSON de error igual que apiFetch.
export async function apiFetchArchivo(
  path: string,
  options: { token: string; method?: string }
): Promise<{ blob: Blob; nombre: string | null }> {
  const response = await fetch(`${BASE_URL}${path}`, {
    method: options.method ?? "GET",
    headers: { Authorization: `Bearer ${options.token}` },
  });

  if (!response.ok) {
    const body = await response.json().catch(() => undefined);
    throw new ApiError(response.status, body);
  }

  const disposicion = response.headers.get("Content-Disposition") ?? "";
  const nombre = /filename\*?=(?:UTF-8'')?"?([^";]+)"?/i.exec(disposicion)?.[1]?.trim() ?? null;
  return { blob: await response.blob(), nombre };
}
