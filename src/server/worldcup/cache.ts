import "server-only";

/**
 * Helper de cache Firestore (Admin SDK) para o chaveamento e classificação da Copa.
 *
 * Coleção `worldcup_cache` — acesso exclusivo do Admin SDK; cliente nunca acessa
 * (Security Rules: allow read, write: if false).
 *
 * TTL dinâmico:
 *  - Partida ao vivo na fase de grupos → 60 s (1 min)
 *  - Sem partida ao vivo → 86 400 s (24 h)
 *
 * `computedAt` é epoch ms (number), NÃO Timestamp do Firestore — garante
 * testabilidade sem dependência do Firestore SDK nos testes.
 */

import { getAdminFirestore } from "@/server/firebaseAdmin";

// ─── Constantes ───────────────────────────────────────────────────────────────

/** Nome da coleção de cache no Firestore. */
const WORLDCUP_CACHE_COLLECTION = "worldcup_cache";

/** TTL quando há partida ao vivo na fase de grupos (ms). */
const TTL_LIVE_MS = 60_000;

/** TTL padrão sem partida ao vivo (ms). */
const TTL_DEFAULT_MS = 86_400_000;

/**
 * Versão do schema de derivação. Bumpar invalida TODOS os snapshots de versão
 * anterior (recompute único, sem storm — o recompute regrava com a versão atual).
 * Use quando a forma derivada muda de modo que snapshots antigos ficam incompletos.
 *
 *  - v2 (TASK-09): `parentMatchIds` (arestas da árvore) por confronto de mata-mata.
 *  - v3 (TASK-09): tabela de pareamento FIFA corrigida (R16 slots 1↔2/5↔6/7↔8).
 */
export const CACHE_VERSION = 3;

// ─── Tipos ────────────────────────────────────────────────────────────────────

/**
 * Snapshot armazenado no Firestore para um doc de cache.
 *
 * @template T Tipo do payload JSON (GroupsResponse | BracketResponse).
 */
export interface CacheSnapshot<T = unknown> {
  /** Payload serializado derivado na última computação. */
  payload: T;
  /** Epoch ms do momento em que o snapshot foi gerado. */
  computedAt: number;
  /** Indica se havia partida ao vivo na fase de grupos quando o snapshot foi gerado. */
  hasLiveGroupMatch: boolean;
  /**
   * Versão do schema de derivação (CACHE_VERSION). Ausente em snapshots legados
   * (pré-versionamento) → tratados como desatualizados.
   */
  version?: number;
}

// ─── Funções públicas ─────────────────────────────────────────────────────────

/**
 * Lê um snapshot de `worldcup_cache/{key}`.
 *
 * @param key Chave do doc ("groups" | "bracket").
 * @returns O snapshot ou `null` se o doc não existir.
 */
export async function readSnapshot<T>(
  key: "groups" | "bracket",
): Promise<CacheSnapshot<T> | null> {
  const doc = await getAdminFirestore()
    .collection(WORLDCUP_CACHE_COLLECTION)
    .doc(key)
    .get();

  if (!doc.exists) return null;

  return doc.data() as CacheSnapshot<T>;
}

/**
 * Grava (ou substitui) um snapshot em `worldcup_cache/{key}`.
 *
 * Operação **best-effort**: engole qualquer erro de escrita via try/catch e
 * loga pelo console — uma falha de escrita NUNCA deve derrubar a leitura.
 *
 * @param key              Chave do doc.
 * @param payload          Payload computado a gravar.
 * @param hasLiveGroupMatch Flag de partida ao vivo na fase de grupos.
 * @param computedAt       Epoch ms do instante de computação (passado pela rota).
 */
export async function writeSnapshot(
  key: "groups" | "bracket",
  payload: unknown,
  hasLiveGroupMatch: boolean,
  computedAt: number,
): Promise<void> {
  try {
    await getAdminFirestore()
      .collection(WORLDCUP_CACHE_COLLECTION)
      .doc(key)
      .set({
        payload,
        computedAt,
        hasLiveGroupMatch,
        version: CACHE_VERSION,
      } satisfies CacheSnapshot);
  } catch (err) {
    console.error(
      `[worldcup/cache] Falha ao gravar snapshot "${key}" — cache miss não bloqueado:`,
      err,
    );
  }
}

/**
 * Determina se um snapshot ainda está dentro do TTL válido.
 *
 * TTL:
 *  - `hasLiveGroupMatch === true`  → 60 s  (60 000 ms)
 *  - `hasLiveGroupMatch === false` → 24 h  (86 400 000 ms)
 *
 * @param snapshot Snapshot a avaliar.
 * @param now      Epoch ms de referência (passado pela rota via `Date.now()`).
 * @returns `true` se fresco; `false` se expirado ou no exato limite.
 */
export function isFresh(snapshot: CacheSnapshot, now: number): boolean {
  const ttl = snapshot.hasLiveGroupMatch ? TTL_LIVE_MS : TTL_DEFAULT_MS;
  return now - snapshot.computedAt < ttl;
}

/**
 * Indica se o snapshot foi gerado pela versão de derivação atual. Snapshots de
 * versão anterior (ou sem versão = legados) são considerados desatualizados e
 * devem ser recomputados, mesmo que ainda dentro do TTL.
 */
export function isCurrentVersion(snapshot: CacheSnapshot): boolean {
  return snapshot.version === CACHE_VERSION;
}
