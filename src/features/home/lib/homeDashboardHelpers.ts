/**
 * Funções puras da Home Dashboard (TASK-05).
 * Sem React, sem Firebase — testáveis em isolamento.
 * Toda a lógica de derivação/join fica aqui; o compositor useHomeDashboard orquestra.
 */

import { scorePrediction } from "@/features/predictions/lib";
import type { MatchListItem } from "@/features/matches/hooks/useMatchesList";
import type {
  MatchWithId,
  PoolStats,
  Prediction,
  Ranking,
  Stage,
  Statistics,
  SystemSettings,
  TeamWithId,
} from "@/types";

// ---------------------------------------------------------------------------
// Tipos de saída (reexportados pelo barrel para uso no compositor e na UI)
// ---------------------------------------------------------------------------

/** Informações de uma seleção resolvida a partir do cache de teams. */
export interface ResolvedTeam {
  name: string;
  flagUrl: string | undefined; // undefined se não constar no doc (campo opcional no schema)
}

/** Status do palpite do usuário para o próximo jogo (A6). UI da Home feature. */
export type HomePredictionStatus = "enviado" | "pendente" | "bloqueado";

/** Próximo jogo com dados resolvidos. */
export interface NextMatchSummary {
  matchId: string; // doc id do Firestore (id da API-Football)
  kickoffAt: string; // ISO 8601
  homeTeam: ResolvedTeam;
  awayTeam: ResolvedTeam;
  predictionStatus: HomePredictionStatus;
  /** Palpite do usuário, se enviado. */
  userPrediction: { homeScore: number; awayScore: number } | null;
  /** Destino do CTA "Enviar/Editar Palpite" — tela de palpites do jogo. */
  predictionsHref: string;
}

/** Um resultado recente com os pontos ponderados do palpite do usuário. */
export interface RecentResult {
  matchId: string;
  kickoffAt: string;
  homeTeam: ResolvedTeam;
  awayTeam: ResolvedTeam;
  matchHomeScore: number; // placar real — não null (jogo finished, validado pelo schema)
  matchAwayScore: number;
  userPrediction: { homeScore: number; awayScore: number } | null;
  // Pontos ponderados do palpite neste jogo (scorePrediction): 10 = placar
  // exato, 5 = acertou o vencedor, 0 = errou. Sem palpite → 0 (use
  // `userPrediction === null` para distinguir "sem palpite" de "errou").
  points: 0 | 5 | 10;
}

/** Raio-X dos palpites do usuário em jogos finalizados (TASK-03 home-revamp). */
export interface PredictionBreakdown {
  correct: number; // placar exato (10 pts)
  partial: number; // só vencedor (5 pts)
  wrong: number; // errou (0 pts)
  total: number; // correct + partial + wrong (palpites em jogos finished)
  isEmpty: boolean; // true quando total === 0
}

/** Aviso do sistema para exibição no card Avisos. */
export interface SystemNotice {
  id: string; // chave estável para React key
  message: string; // texto pt-BR derivado das flags
  severity: "info" | "warning";
}

/** Jogo aberto para palpitar (TASK-02 home-revamp). */
export interface OpenMatchSummary {
  matchId: string;
  kickoffAt: string; // ISO 8601
  homeTeam: ResolvedTeam; // já resolvido via MatchListItem
  awayTeam: ResolvedTeam;
  deadlineLabel: string; // ex.: "Fecha em 1h 30m" | "Fecha em 45m"
  /** true quando faltam < 60min para o kickoff (urgência na UI; não re-parsear label). */
  isUrgent: boolean;
  predictHref: string; // "/matches/{matchId}/predict"
}

/** Resultado de deriveOpenMatches. */
export interface OpenMatchesResult {
  items: OpenMatchSummary[]; // ≤ limit
  totalOpen: number; // total antes do corte (para "+ N outros")
}

/** Direção da tendência de posição no ranking. */
export type HeroTrendDirection = "up" | "down" | "stable";

/** Resumo consolidado do Hero da Home (TASK-01 home-revamp). */
export interface HeroSummary {
  /** Posição no ranking do pool (null sem ranking ou usuário fora das entries). */
  position: number | null;
  totalParticipants: number | null;
  /** Pontos ponderados do usuário (null sem entry). */
  points: number | null;
  /** Tendência de posição; null quando há <2 snapshots em positionHistory. */
  trend: {
    direction: HeroTrendDirection;
    delta: number; // variação absoluta de posição (>=0)
    roundLabel: string | null; // "R{round}" da última entrada, se houver
  } | null;
  accuracy: number; // 0–100 (0 sem statistics)
  totalCorrect: number; // 0 sem statistics
  /** Jogos jogados = exatos + parciais + erros; null quando totalWrong ausente. */
  denominator: number | null;
  longestStreak: number; // 0 sem statistics
  /** Posições por `at` (asc); null com <2 pontos. */
  sparkline: number[] | null;
  /** Régua de percentil (bullet); null sem poolStats ou sem pontos do usuário. */
  ruler: {
    lowest: number;
    average: number;
    highest: number;
    userPoints: number;
    fraction: number; // 0–1 na escala [lowest, highest] (posição do usuário)
    averageFraction: number; // 0–1 na escala [lowest, highest] (posição da média)
    label: "acima da média" | "na média" | "abaixo da média";
  } | null;
  /** true quando não há nada relevante a exibir (conta nova / pré-torneio). */
  isEmpty: boolean;
}

/**
 * Hero dividido por fase (split-phase-ranking TASK-05). Presente APENAS quando a
 * flag `splitPhaseRanking` do pool está ON; `undefined` no ramo OFF (retrocompat).
 * `eliminatorias` é `null` quando o doc de ranking da fase ainda não existe
 * (torneio só na fase de grupos) — a UI degrada graciosamente.
 */
export interface HeroSummaryByScope {
  grupos: HeroSummary;
  eliminatorias: HeroSummary | null;
}

/** Saída completa do compositor useHomeDashboard. */
export interface HomeDashboardData {
  /** Hero consolidado (TASK-01 home-revamp). */
  heroSummary: HeroSummary;
  /**
   * Hero por fase (split-phase-ranking TASK-05). `undefined` quando a flag do
   * pool está OFF — nesse caso a UI usa `heroSummary` (geral). Quando presente,
   * a UI renderiza os dois escopos lado a lado em vez do hero único.
   */
  heroSummaryByScope?: HeroSummaryByScope;
  /** Raio-X dos palpites (TASK-03 home-revamp). */
  predictionBreakdown: PredictionBreakdown;
  nextMatch: NextMatchSummary | null;
  recentResults: RecentResult[]; // até 5
  /** Jogos ainda abertos para palpitar (TASK-02 home-revamp). */
  openMatches: OpenMatchesResult;
  /** Fase ativa da Copa para o banner (PRD-16 / TASK-04); null sem jogos. */
  currentStage: Stage | null;
  notices: SystemNotice[];
  /** true se qualquer query obrigatória ainda estiver carregando. */
  isLoading: boolean;
  /** true se qualquer query obrigatória falhou. */
  isError: boolean;
  /** Chama refetch em todas as queries. */
  refetch: () => void;
}

// ---------------------------------------------------------------------------
// 1. buildTeamMap
// ---------------------------------------------------------------------------

/**
 * Constrói um Map de teamId → TeamWithId a partir do array retornado por listAllTeams.
 * Evita iterar o array a cada join (O(1) lookup).
 *
 * O serviço injeta o doc id após o parse (TeamWithId); o schema permanece .strict().
 */
export function buildTeamMap(teams: TeamWithId[]): Map<string, TeamWithId> {
  return new Map(teams.map((t) => [t.id, t]));
}

// ---------------------------------------------------------------------------
// 2. resolveTeam
// ---------------------------------------------------------------------------

/**
 * Resolve nome e flagUrl de uma seleção pelo id, usando o Map pré-construído.
 * Fallback: name = teamId (raw), flagUrl = undefined.
 * Edge case: teamId ausente no cache (seed incompleto, doc deletado).
 */
export function resolveTeam(teamId: string, teamMap: Map<string, TeamWithId>): ResolvedTeam {
  const team = teamMap.get(teamId);
  return {
    name: team?.name ?? teamId,
    flagUrl: team?.flagUrl,
  };
}

// ---------------------------------------------------------------------------
// 3. computeIsCorrect
// ---------------------------------------------------------------------------

/**
 * Calcula se o palpite acertou o placar exato de um jogo finalizado.
 * Regra: acerto binário — placar exato → true; qualquer diferença → false.
 * Sem palpite → false (usuário não participou deste jogo).
 *
 * @param match      - Partida finalizada (homeScore/awayScore garantidamente não-null pelo schema).
 * @param prediction - Palpite do usuário para esta partida, ou null/undefined se não enviou.
 */
export function computeIsCorrect(
  match: MatchWithId,
  prediction: Prediction | null | undefined,
): boolean {
  if (!prediction) return false;
  // Guarda de segurança: placar nulo não deveria ocorrer em jogos finished
  // (o refinement do schema garante non-null), mas protege contra dados inconsistentes.
  if (match.homeScore === null || match.awayScore === null) return false;
  return prediction.homeScore === match.homeScore && prediction.awayScore === match.awayScore;
}

// ---------------------------------------------------------------------------
// 4. derivePredictionStatus
// ---------------------------------------------------------------------------

/**
 * Determina o status do palpite do usuário para o próximo jogo (A6).
 *
 * Prioridade: bloqueado > enviado > pendente.
 */
export function derivePredictionStatus(
  matchId: string,
  predictions: Prediction[],
  predictionsLocked: boolean,
): HomePredictionStatus {
  if (predictionsLocked) return "bloqueado";
  const hasPrediction = predictions.some((p) => p.matchId === matchId);
  return hasPrediction ? "enviado" : "pendente";
}

// ---------------------------------------------------------------------------
// 4b. buildPredictionsHref — destino do CTA do próximo jogo
// ---------------------------------------------------------------------------

/**
 * Resolve a rota do CTA do próximo jogo, por `matchId`. Palpite editável
 * (pendente/enviado) → tela de palpite do jogo (`/matches/{id}/predict`). Jogo
 * encerrado (`bloqueado`, CTA "Ver Jogo") → detalhe do jogo (`/matches/{id}`).
 *
 * `matchId` é o id estável do jogo (slug para grupos), casando com o parâmetro
 * de `/matches/[id]`.
 */
export function buildPredictionsHref(matchId: string, status: HomePredictionStatus): string {
  return status === "bloqueado" ? `/matches/${matchId}` : `/matches/${matchId}/predict`;
}

// ---------------------------------------------------------------------------
// 5. derivePredictionBreakdown (TASK-03 home-revamp)
// ---------------------------------------------------------------------------

/**
 * Tabula os palpites do usuário sobre jogos `finished` em 3 categorias via
 * `scorePrediction`: correct (placar exato, 10) / partial (só vencedor, 5) /
 * wrong (errou, 0). Resolve no cliente o gap "partial não persistido" — sem
 * rede extra, sem tocar recalc.
 *
 * Regras (spec §6):
 * - Só jogos `status === "finished"` (R1).
 * - Jogo finished sem palpite do usuário é ignorado — não conta como wrong (R2).
 * - `scorePrediction` recebe MatchWithId; MatchListItem carrega os campos usados
 *   (status/homeScore/awayScore) — cast estreito local (R4).
 * - `pending` não deve ocorrer (filtro R1), mas se ocorrer é ignorado (R3).
 *
 * Função pura: sem `new Date()` interno; o status do jogo já define elegibilidade.
 */
export function derivePredictionBreakdown(
  matches: MatchListItem[],
  predictions: Prediction[],
): PredictionBreakdown {
  let correct = 0;
  let partial = 0;
  let wrong = 0;

  for (const match of matches) {
    if (match.status !== "finished") continue; // R1
    const pred = predictions.find((p) => p.matchId === match.id);
    if (!pred) continue; // R2 — sem palpite → ignora

    // R4: MatchListItem tem status/homeScore/awayScore que scorePrediction usa.
    const { status } = scorePrediction(pred, match as unknown as MatchWithId);
    if (status === "correct") correct++;
    else if (status === "partial") partial++;
    else if (status === "wrong") wrong++;
    // status === "pending" não deve ocorrer (R3) → ignora
  }

  const total = correct + partial + wrong;
  return { correct, partial, wrong, total, isEmpty: total === 0 };
}

// ---------------------------------------------------------------------------
// 6. deriveNotices
// ---------------------------------------------------------------------------

/**
 * Deriva o conjunto mínimo de avisos do sistema a partir de flags + próximo kickoff.
 *
 * Avisos deriváveis no MVP (R6):
 *   1. Palpites travados: "Palpites encerrados para esta fase."  (warning)
 *   2. Prazo se aproximando (< 3h para o próximo kickoff):
 *      "Prazo encerra em Xh Ym." / "Prazo encerra em Ymin."  (warning)
 *   3. Cadastros fechados: "Cadastros encerrados."  (info)
 *
 * @param settings  - Configurações do sistema (pode ser null/undefined).
 * @param nextMatch - Próximo jogo (para calcular prazo).
 * @param now       - Data de referência (injetada para facilitar testes).
 */
export function deriveNotices(
  settings: SystemSettings | null | undefined,
  nextMatch: MatchWithId | null | undefined,
  now: Date,
): SystemNotice[] {
  const notices: SystemNotice[] = [];

  if (settings?.predictionsLocked) {
    notices.push({
      id: "predictions-locked",
      message: "Palpites encerrados para esta fase.",
      severity: "warning",
    });
  }

  if (nextMatch) {
    const msUntilKickoff = new Date(nextMatch.kickoffAt).getTime() - now.getTime();
    const THREE_HOURS_MS = 3 * 60 * 60 * 1000;
    if (msUntilKickoff > 0 && msUntilKickoff < THREE_HOURS_MS) {
      const totalMinutes = Math.floor(msUntilKickoff / 60_000);
      const h = Math.floor(totalMinutes / 60);
      const m = totalMinutes % 60;
      // Exibe "Xh Ymin" se houver horas; senão só "Ymin".
      const label = h > 0 ? `${h}h ${m}min` : `${m}min`;
      notices.push({
        id: "kickoff-soon",
        message: `Prazo encerra em ${label}.`,
        severity: "warning",
      });
    }
  }

  if (settings && !settings.registrationOpen) {
    notices.push({
      id: "registration-closed",
      message: "Cadastros encerrados.",
      severity: "info",
    });
  }

  return notices;
}

// ---------------------------------------------------------------------------
// 7. deriveHeroSummary (TASK-01 home-revamp)
// ---------------------------------------------------------------------------

/**
 * Consolida o Hero da Home a partir de dados já agregados (sem rede extra):
 * posição/tendência do ranking, aproveitamento com denominador, streak,
 * sparkline de evolução e régua de percentil vs `pool_stats`.
 *
 * Funções puras: sem `new Date()` interno; ordenação por `at` (ISO 8601).
 * Regras de borda em ai/spec/task-home-revamp-01.md §6.
 */
export function deriveHeroSummary(
  ranking: Ranking | null | undefined,
  statistics: Statistics | null | undefined,
  poolStats: PoolStats | null | undefined,
  uid: string,
): HeroSummary {
  // Posição / pontos / total de participantes do ranking do pool.
  const entry = ranking?.entries.find((e) => e.uid === uid) ?? null;
  const position = entry?.position ?? null;
  const points = entry?.points ?? null;
  const totalParticipants = ranking ? ranking.entries.length : null;

  // Tendência: comparar os 2 últimos snapshots por `at` (>=2 obrigatório).
  // Filtra escopo "geral" (§6.2) — alinhado a geralHistory() em myRankingDerivations;
  // hoje recalc só grava geral, mas blinda contra positionHistory multi-escopo.
  const history = (statistics?.positionHistory ?? []).filter((h) => h.scope === "geral");
  const sorted = [...history].sort((a, b) => a.at.localeCompare(b.at));
  let trend: HeroSummary["trend"] = null;
  let sparkline: number[] | null = null;
  const last = sorted.at(-1);
  const prev = sorted.at(-2);
  if (last && prev) {
    const diff = prev.position - last.position; // >0 = subiu (posição menor é melhor)
    const direction: HeroTrendDirection = diff > 0 ? "up" : diff < 0 ? "down" : "stable";
    trend = {
      direction,
      delta: Math.abs(diff),
      roundLabel: last.round != null ? `R${last.round}` : null,
    };
    sparkline = sorted.map((s) => s.position);
  }

  // Aproveitamento + denominador.
  const accuracy = statistics?.accuracy ?? 0;
  const totalCorrect = statistics?.totalCorrect ?? 0;
  const longestStreak = statistics?.longestStreak ?? 0;
  // Denominador = exatos + PARCIAIS (vencedor/empate) + erros. Parciais opcionais
  // (retrocompat) → caem em 0; ainda gated por totalWrong (sinal de doc apurado).
  const denominator =
    statistics?.totalWrong != null
      ? totalCorrect + (statistics.totalPartial ?? 0) + statistics.totalWrong
      : null;

  // Régua de percentil (bullet): só com poolStats e pontos do usuário.
  let ruler: HeroSummary["ruler"] = null;
  if (poolStats && points != null) {
    const { lowestPoints, highestPoints, averagePoints } = poolStats;
    const span = highestPoints - lowestPoints;
    const toFraction = (v: number) =>
      span <= 0 ? 1 : Math.min(1, Math.max(0, (v - lowestPoints) / span));
    const fraction = toFraction(points);
    const averageFraction = toFraction(averagePoints);
    const label =
      points > averagePoints
        ? "acima da média"
        : points < averagePoints
          ? "abaixo da média"
          : "na média";
    ruler = {
      lowest: lowestPoints,
      average: averagePoints,
      highest: highestPoints,
      userPoints: points,
      fraction,
      averageFraction,
      label,
    };
  }

  const isEmpty = position === null && statistics == null && poolStats == null;

  return {
    position,
    totalParticipants,
    points,
    trend,
    accuracy,
    totalCorrect,
    denominator,
    longestStreak,
    sparkline,
    ruler,
    isEmpty,
  };
}

// ---------------------------------------------------------------------------
// 8. deriveOpenMatches (TASK-02 home-revamp)
// ---------------------------------------------------------------------------

/** 60 minutos em ms — limiar de urgência e de troca do formato do rótulo. */
const SIXTY_MINUTES_MS = 60 * 60 * 1000;

/**
 * Monta o rótulo de deadline a partir do tempo restante.
 * < 60min → "Fecha em Ym"; ≥ 60min → "Fecha em Xh Ym" (horas inteiras + minutos).
 */
function buildDeadlineLabel(msUntilKickoff: number): string {
  const totalMinutes = Math.floor(msUntilKickoff / 60_000);
  const h = Math.floor(totalMinutes / 60);
  const m = totalMinutes % 60;
  return h > 0 ? `Fecha em ${h}h ${m}m` : `Fecha em ${m}m`;
}

/**
 * Deriva os jogos ainda abertos para palpitar a partir do flatList de useMatchesList.
 *
 * Elegibilidade: `predictionStatus === "pendente"` já encapsula status scheduled +
 * kickoff futuro + sem lock + sem palpite (deriveMatchPredictionStatus). Não
 * re-implementa lock aqui.
 *
 * Ordena por kickoff ascendente, corta em `limit` (padrão 3) e reporta `totalOpen`
 * (total antes do corte) para o rodapé "+ N outros".
 *
 * `now` é injetado (nunca `new Date()` interno) para testabilidade.
 */
export function deriveOpenMatches(
  matches: MatchListItem[],
  now: Date,
  limit = 3,
): OpenMatchesResult {
  const open = matches
    .filter((m) => m.predictionStatus === "pendente")
    .sort((a, b) => new Date(a.kickoffAt).getTime() - new Date(b.kickoffAt).getTime());

  const items: OpenMatchSummary[] = open.slice(0, limit).map((m) => {
    const msUntilKickoff = new Date(m.kickoffAt).getTime() - now.getTime();
    return {
      matchId: m.id,
      kickoffAt: m.kickoffAt,
      homeTeam: m.homeTeam,
      awayTeam: m.awayTeam,
      deadlineLabel: buildDeadlineLabel(msUntilKickoff),
      isUrgent: msUntilKickoff < SIXTY_MINUTES_MS,
      predictHref: `/matches/${m.id}/predict`,
    };
  });

  return { items, totalOpen: open.length };
}

// ---------------------------------------------------------------------------
// 9. deriveCurrentStage (TASK-04 / PRD-16)
// ---------------------------------------------------------------------------

/** Status que representam um jogo que ainda VAI acontecer (define a fase ativa). */
const ACTIVE_MATCH_STATUSES: ReadonlyArray<MatchListItem["status"]> = ["scheduled", "live"];

/**
 * Deriva a fase ATIVA da Copa para o banner da Home.
 *
 * Regra: fase do próximo jogo a acontecer = menor `kickoffAt` entre os jogos
 * ATIVOS (`scheduled`/`live`). `postponed`/`canceled` NÃO definem a fase — o jogo
 * não vai acontecer e advertiria uma fase errada. Sem nenhum ativo → torneio
 * encerrado: fase do jogo FINALIZADO mais recente. Sem jogos elegíveis → null.
 *
 * Função PURA: sem `new Date()` interno — decide por `status`/`kickoffAt`.
 * `kickoffAt` inválido → tratado como +Infinity (vai p/ o fim, nunca sequestra
 * a seleção do próximo jogo).
 */
export function deriveCurrentStage(matches: MatchListItem[]): Stage | null {
  if (matches.length === 0) return null;

  const ms = (m: MatchListItem) => {
    const t = new Date(m.kickoffAt).getTime();
    return Number.isNaN(t) ? Infinity : t;
  };

  const upcoming = matches
    .filter((m) => ACTIVE_MATCH_STATUSES.includes(m.status))
    .sort((a, b) => ms(a) - ms(b));
  if (upcoming.length > 0) return upcoming[0]!.stage;

  // Sem ativos → torneio encerrado: fase do jogo FINALIZADO mais recente.
  const finished = matches.filter((m) => m.status === "finished").sort((a, b) => ms(b) - ms(a));
  return finished.length > 0 ? finished[0]!.stage : null;
}
