import "server-only";

import { timingSafeEqual } from "node:crypto";

/**
 * Compara o secret esperado (env) com o fornecido (header) em tempo constante,
 * evitando timing attack na verificação do `x-cron-secret` (TASK-14, carry-forward
 * WR-01 da TASK-03). Retorna false — sem lançar — quando ausente/vazio ou quando
 * os comprimentos diferem (timingSafeEqual exige buffers de mesmo tamanho).
 */
export function safeSecretEqual(
  expected: string | undefined,
  provided: string | null,
): boolean {
  if (
    expected === undefined ||
    expected.length === 0 ||
    provided === null ||
    provided.length === 0
  ) {
    return false;
  }
  const a = Buffer.from(expected, "utf8");
  const b = Buffer.from(provided, "utf8");
  if (a.length !== b.length) return false;
  return timingSafeEqual(a, b);
}
