import { ApiError } from "../../api/client";

export function mensajeDeError(err: unknown): string {
  if (
    err instanceof ApiError &&
    typeof err.body === "object" &&
    err.body !== null &&
    "error" in err.body &&
    typeof (err.body as { error: unknown }).error === "string"
  ) {
    return (err.body as { error: string }).error;
  }
  return "No se pudo registrar la decisión. Intentá de nuevo.";
}
