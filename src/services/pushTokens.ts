import { API_BASE, buildHttpError } from "./_apiClient";

/**
 * Camada de serviço da store de tokens FCM (web-push-pwa TASK-03). Wrapper de
 * fetch sobre o Route Handler `/api/push/tokens`. Consumido pelo hook de
 * registro de push (TASK-02): POST ao obter/renovar o token, DELETE no logout /
 * permissão revogada. Erros propagam crus (caller best-effort decide tolerar).
 */

const TOKENS_URL = `${API_BASE}/push/tokens`;

/** Registra/atualiza o token FCM do device atual (upsert idempotente no server). */
export async function registerPushToken(token: string): Promise<void> {
  const res = await fetch(TOKENS_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ token }),
  });
  if (!res.ok) throw await buildHttpError(res, "Falha ao registrar o token de push.");
}

/** Remove o token FCM do device (logout / permissão revogada). Idempotente no server. */
export async function deletePushToken(token: string): Promise<void> {
  const res = await fetch(TOKENS_URL, {
    method: "DELETE",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ token }),
  });
  if (!res.ok) throw await buildHttpError(res, "Falha ao remover o token de push.");
}
