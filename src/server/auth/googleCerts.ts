import { SESSION_COOKIE_CERTS_URL, type GoogleCerts } from "./verifySession";

/**
 * Fetch + cache dos certificados públicos do Google usados para verificar
 * SESSION COOKIES do Firebase (TASK-10).
 *
 * O endpoint responde `{ "<kid>": "<x509 PEM>" }` e envia `Cache-Control:
 * max-age=<s>`. Respeitamos esse `max-age` para evitar bater no endpoint a cada
 * request do middleware. O cache é em memória do runtime do middleware (não há
 * estado compartilhado entre instâncias — aceitável: cada instância revalida no
 * máximo a cada `max-age`).
 *
 * Mantido FORA de `verifySession.ts` para que aquela função permaneça pura
 * (certs injetados) e testável sem rede.
 */

interface CertCache {
  certs: GoogleCerts;
  /** Epoch em ms até quando o cache é válido. */
  expiresAt: number;
}

let cache: CertCache | null = null;

/** Extrai `max-age` (segundos) do header `Cache-Control`; 0 se ausente. */
function parseMaxAgeSeconds(cacheControl: string | null): number {
  if (!cacheControl) {
    return 0;
  }
  const match = /max-age=(\d+)/i.exec(cacheControl);
  return match?.[1] ? Number.parseInt(match[1], 10) : 0;
}

/**
 * Retorna os certificados públicos, servindo do cache quando ainda válido.
 * `now` é injetável para teste. Lança se o fetch falhar e não houver cache.
 */
export async function fetchGoogleCerts(
  now: number = Date.now(),
): Promise<GoogleCerts> {
  if (cache && cache.expiresAt > now) {
    return cache.certs;
  }

  const response = await fetch(SESSION_COOKIE_CERTS_URL);
  if (!response.ok) {
    throw new Error(
      `Falha ao buscar certificados públicos do Google: HTTP ${response.status}`,
    );
  }

  const certs = (await response.json()) as GoogleCerts;
  const maxAgeSeconds = parseMaxAgeSeconds(response.headers.get("cache-control"));
  cache = { certs, expiresAt: now + maxAgeSeconds * 1000 };
  return certs;
}

/** Limpa o cache (uso em testes). */
export function __clearGoogleCertsCache(): void {
  cache = null;
}
