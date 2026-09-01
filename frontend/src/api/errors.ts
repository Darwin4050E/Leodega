/**
 * Los `catch` de axios en todo el proyecto acceden a `error.response?.data?...`
 * por duck-typing, sin verificar el tipo real. `asApiError` no cambia ese
 * comportamiento en runtime (sigue siendo el mismo objeto, con optional
 * chaining) — solo le da una forma al catch (`unknown`) que TypeScript
 * acepta, evitando el `any` explícito que antes se usaba en cada uno.
 */
export interface ApiErrorResponse {
  response?: {
    status?: number;
    data?: {
      message?: string;
      error?: string;
      errors?: Record<string, string[]>;
    };
  };
  message?: string;
}

export function asApiError(error: unknown): ApiErrorResponse {
  return (error ?? {}) as ApiErrorResponse;
}
