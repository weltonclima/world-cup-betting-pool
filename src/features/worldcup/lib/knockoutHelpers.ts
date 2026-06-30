import type { KnockoutMatch } from "@/types/worldcup";

export type WinningSide = "home" | "away" | "draw" | null;

/** Índice O(1) de KnockoutMatch por id. Construído uma vez por coluna renderizada. */
export function buildMatchIndex(
  matches: KnockoutMatch[],
): Map<string, KnockoutMatch> {
  const map = new Map<string, KnockoutMatch>();
  for (const m of matches) map.set(m.id, m);
  return map;
}

/**
 * Reordena as fases em ORDEM DE CHAVE para renderizar uma árvore limpa: parte da
 * fase mais à direita (filho) e, para cada fase anterior, posiciona os dois pais
 * (via `parentMatchIds`) imediatamente adjacentes ao filho. Resultado: em cada
 * coluna, os dois jogos que alimentam um confronto ficam vizinhos — `justify-around`
 * então centra o filho entre eles, sem linhas cruzadas.
 *
 * Entrada: fases na ordem oficial de progressão (mais jogos → menos jogos), cada
 * uma com sua lista de matches. Saída: a MESMA ordem de fases, cada lista
 * reordenada para a árvore.
 *
 * Degradação: sem `parentMatchIds` (bracketMap ausente), os pais não são
 * referenciados → cada coluna mantém a ordem natural de entrada (append final).
 */
export function buildTreeOrder(
  phases: { matches: KnockoutMatch[] }[],
): KnockoutMatch[][] {
  if (phases.length === 0) return [];

  // A fase mais à direita mantém sua ordem de entrada.
  const result: KnockoutMatch[][] = new Array(phases.length);
  result[phases.length - 1] = [...phases[phases.length - 1]!.matches];

  // Para cada fase anterior, ordena os pais conforme os filhos já ordenados.
  for (let k = phases.length - 2; k >= 0; k--) {
    const childOrder = result[k + 1]!;
    const parents = phases[k]!.matches;
    const index = buildMatchIndex(parents);
    const ordered: KnockoutMatch[] = [];
    const seen = new Set<string>();

    for (const child of childOrder) {
      if (!child.parentMatchIds) continue;
      for (const pid of child.parentMatchIds) {
        if (seen.has(pid)) continue;
        const parent = index.get(pid);
        if (parent) {
          ordered.push(parent);
          seen.add(pid);
        }
      }
    }

    // Pais não referenciados (degradação / dados parciais) → ordem natural ao fim.
    for (const m of parents) {
      if (!seen.has(m.id)) ordered.push(m);
    }

    result[k] = ordered;
  }

  return result;
}

export function getWinningSide(match: KnockoutMatch): WinningSide {
  if (match.status !== "encerrado") return null;
  const home = match.homeScore!;
  const away = match.awayScore!;
  if (home > away) return "home";
  if (away > home) return "away";
  return "draw";
}

/**
 * Lado que AVANÇOU no confronto — autoridade para o destaque visual (TASK-04).
 *
 * Precedência:
 *  1. Só faz sentido em jogo encerrado → demais status retornam null.
 *  2. `advanceSide` (TASK-03) tem prioridade: cobre a decisão por pênaltis, onde
 *     o placar de tempo normal é empate mas um lado avança.
 *  3. Sem `advanceSide` (ex.: snapshot legado), cai para o vencedor por placar;
 *     se o tempo normal empatou MAS há pênaltis, o shootout desempata (o
 *     shootout NUNCA é somado ao placar — apenas decide o avanço aqui).
 */
export function getAdvancingSide(match: KnockoutMatch): WinningSide {
  if (match.status !== "encerrado") return null;
  if (match.advanceSide) return match.advanceSide;

  const byScore = getWinningSide(match);
  if (
    byScore === "draw" &&
    match.homeShootout !== undefined &&
    match.awayShootout !== undefined
  ) {
    if (match.homeShootout > match.awayShootout) return "home";
    if (match.awayShootout > match.homeShootout) return "away";
  }
  return byScore;
}

/**
 * Formata o placar de um lado, anexando os pênaltis entre parênteses quando
 * presentes (ex.: "1 (4)"). INVARIANTE: o shootout JAMAIS é somado ao placar de
 * tempo normal — apenas exibido ao lado.
 */
export function formatSideScore(score: number, shootout?: number): string {
  return shootout === undefined ? String(score) : `${score} (${shootout})`;
}

export function formatKickoffBr(iso?: string): string {
  if (!iso) return "Data a confirmar";
  const date = new Date(iso);
  if (isNaN(date.getTime())) return "Data a confirmar";

  const parts = new Intl.DateTimeFormat("pt-BR", {
    weekday: "short",
    day: "numeric",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).formatToParts(date);

  const get = (type: string) => parts.find((p) => p.type === type)?.value ?? "";

  const weekday = get("weekday").replace(".", "");
  const weekdayCap = weekday.charAt(0).toUpperCase() + weekday.slice(1);
  const day = get("day");
  const month = get("month").replace(".", "");
  const monthCap = month.charAt(0).toUpperCase() + month.slice(1);
  const time = `${get("hour")}h${get("minute")}`;

  return `${weekdayCap}, ${day} ${monthCap} · ${time}`;
}
