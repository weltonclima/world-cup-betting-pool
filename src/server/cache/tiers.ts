import { differenceInHours } from "date-fns";

import type { Match, MatchWithId } from "@/types/matches";

/**
 * Faixas de cache da Copa (PRD-07), em **fonte única** compartilhada entre
 * servidor e client.
 *
 * - Servidor (Next.js): usar como `revalidate` em **segundos**
 *   (`fetch(url, { next: { revalidate } })`).
 * - Client (React Query): usar `STALE_TIME` (ms) como `staleTime`.
 *
 * Cada tier:
 * - `grupos`        — composição dos grupos (estático): 24h.
 * - `selecoes`      — seleções participantes (estático): 24h.
 * - `jogoFuturo`    — partida agendada em outro dia: 6h. Também reaproveitado
 *                     como tier "longo" para jogos encerrados (frios) e cancelados.
 * - `jogoDia`       — partida agendada para hoje (UTC): 30min.
 * - `jogoAoVivo`    — partida em andamento: 1min (tier mais sensível a quota).
 * - `jogoEncerrado` — partida finalizada na janela quente (< 6h): 5min.
 *
 * Os valores estão em segundos para casar diretamente com o `revalidate` nativo
 * do Next.js. O espelho em milissegundos (`STALE_TIME`) é derivado abaixo.
 */
export const REVALIDATE = {
  grupos: 24 * 60 * 60, // 24h
  selecoes: 24 * 60 * 60, // 24h
  jogoFuturo: 6 * 60 * 60, // 6h
  jogoDia: 30 * 60, // 30min
  jogoAoVivo: 60, // 1min
  jogoEncerrado: 5 * 60, // 5min
} as const;

/** Chave de tier de cache (nome estável compartilhado por server e client). */
export type CacheTier = keyof typeof REVALIDATE;

/**
 * Espelho de {@link REVALIDATE} em **milissegundos**, para o `staleTime` do
 * React Query. Derivado programaticamente (`segundos * 1000`) — sem duplicar
 * números mágicos. Mantém exatamente as mesmas chaves de `REVALIDATE`.
 */
export const STALE_TIME = Object.fromEntries(
  (Object.keys(REVALIDATE) as CacheTier[]).map((key) => [
    key,
    REVALIDATE[key] * 1000,
  ]),
) as Record<CacheTier, number>;

/**
 * Janela "quente" (em horas) durante a qual uma partida recém-encerrada continua
 * sendo revalidada com frequência, para estabilizar o placar/ajustes oficiais.
 * Medida a partir do `kickoffAt` (início do jogo) — ver decisão D1 na spec.
 */
const JANELA_QUENTE_HORAS = 6;

/**
 * Indica se duas datas caem no mesmo dia do calendário em **UTC**.
 *
 * O `isSameDay` do date-fns compara no fuso **local** do runtime, o que tornaria
 * a decisão dependente do timezone da máquina. Como `kickoffAt` é UTC e o servidor
 * roda em UTC (decisão D2), comparamos diretamente os componentes UTC de data.
 */
function isSameUtcDay(a: Date, b: Date): boolean {
  return (
    a.getUTCFullYear() === b.getUTCFullYear() &&
    a.getUTCMonth() === b.getUTCMonth() &&
    a.getUTCDate() === b.getUTCDate()
  );
}

/**
 * Escolhe o tier de `revalidate` (em **segundos**) adequado para uma partida,
 * conforme `status` e data, relativo ao instante `now`.
 *
 * Regra (PRD-07):
 * - `live` → `jogoAoVivo` (1min).
 * - `finished` e `(now - kickoffAt) < 6h` → `jogoEncerrado` (5min, janela quente).
 * - `finished` e `(now - kickoffAt) >= 6h` → `jogoFuturo` (6h, tier longo/frio).
 * - `scheduled`/`postponed` no mesmo dia de `now` (UTC) → `jogoDia` (30min).
 * - `scheduled`/`postponed` em outro dia → `jogoFuturo` (6h).
 * - `canceled` → `jogoFuturo` (6h, tier longo).
 *
 * Comparações de data usam date-fns; "mesmo dia" é avaliado em UTC, pois o
 * runtime do servidor roda em UTC e `kickoffAt` já vem em UTC (ver decisão D2).
 *
 * @param match Partida (com ou sem `id`).
 * @param now Instante de referência da decisão.
 * @returns Valor de `revalidate` em segundos.
 */
export function revalidateForMatch(
  match: Match | MatchWithId,
  now: Date,
): number {
  const kickoff = new Date(match.kickoffAt);

  switch (match.status) {
    case "live":
      return REVALIDATE.jogoAoVivo;

    case "finished": {
      const horasDesdeInicio = differenceInHours(now, kickoff);
      return horasDesdeInicio < JANELA_QUENTE_HORAS
        ? REVALIDATE.jogoEncerrado
        : REVALIDATE.jogoFuturo;
    }

    case "scheduled":
    case "postponed":
      return isSameUtcDay(now, kickoff)
        ? REVALIDATE.jogoDia
        : REVALIDATE.jogoFuturo;

    case "canceled":
      return REVALIDATE.jogoFuturo;
  }
}
