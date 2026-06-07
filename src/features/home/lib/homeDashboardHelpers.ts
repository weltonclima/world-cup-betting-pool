/**
 * Funções puras da Home Dashboard (TASK-05).
 * Sem React, sem Firebase — testáveis em isolamento.
 * Toda a lógica de derivação/join fica aqui; o compositor useHomeDashboard orquestra.
 */

import type {
  MatchWithId,
  Prediction,
  Ranking,
  Statistics,
  SystemSettings,
  TeamWithId,
} from "@/types";

// ---------------------------------------------------------------------------
// Tipos de saída (reexportados pelo barrel para uso no compositor e na UI)
// ---------------------------------------------------------------------------

/** Posição do usuário no ranking geral. */
export interface RankingSummary {
  position: number;          // posição do usuário (1-based)
  totalParticipants: number; // entries.length (A1 — fonte única: ranking calculado)
  points: number;            // pontos do usuário
}

/** Informações de uma seleção resolvida a partir do cache de teams. */
export interface ResolvedTeam {
  name: string;
  flagUrl: string | undefined; // undefined se não constar no doc (campo opcional no schema)
}

/** Status do palpite do usuário para o próximo jogo (A6). */
export type PredictionStatus = "enviado" | "pendente" | "bloqueado";

/** Próximo jogo com dados resolvidos. */
export interface NextMatchSummary {
  matchId: string;             // doc id do Firestore (id da API-Football)
  kickoffAt: string;           // ISO 8601
  homeTeam: ResolvedTeam;
  awayTeam: ResolvedTeam;
  predictionStatus: PredictionStatus;
  /** Palpite do usuário, se enviado. */
  userPrediction: { homeScore: number; awayScore: number } | null;
}

/** Um resultado recente com acertou/errou calculado. */
export interface RecentResult {
  matchId: string;
  kickoffAt: string;
  homeTeam: ResolvedTeam;
  awayTeam: ResolvedTeam;
  matchHomeScore: number;      // placar real — não null (jogo finished, validado pelo schema)
  matchAwayScore: number;
  userPrediction: { homeScore: number; awayScore: number } | null;
  isCorrect: boolean;          // true se palpite == placar real; false se sem palpite ou errou
}

/** Resumo de estatísticas do usuário. */
export interface PerformanceSummary {
  totalCorrect: number;        // statistics.totalCorrect (0 se sem dados)
  accuracy: number;            // statistics.accuracy 0–100 (0 se sem dados)
  /** Maior sequência de acertos (statistics.longestStreak; 0 se sem dados). */
  longestStreak: number;
  /**
   * Total de palpites enviados — derivado de totalCorrect / (accuracy / 100) (D1).
   * 0 quando accuracy é 0 (evita divisão por zero).
   */
  gamesPredicted: number;
}

/** Informação de fase atual. */
export interface CurrentStageSummary {
  /** null se system_settings não existir ou currentStage não for informado. */
  stage: import("@/types").Stage | null;
  /** "Rodada X de Y" — derivado de matches.round se disponível, senão null. */
  roundLabel: string | null;
}

/** Aviso do sistema para exibição no card Avisos. */
export interface SystemNotice {
  id: string;        // chave estável para React key
  message: string;   // texto pt-BR derivado das flags
  severity: "info" | "warning";
}

/** Saída completa do compositor useHomeDashboard. */
export interface HomeDashboardData {
  ranking: RankingSummary | null;
  performance: PerformanceSummary;
  nextMatch: NextMatchSummary | null;
  recentResults: RecentResult[];        // até 5
  currentStage: CurrentStageSummary;
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
  return (
    prediction.homeScore === match.homeScore &&
    prediction.awayScore === match.awayScore
  );
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
): PredictionStatus {
  if (predictionsLocked) return "bloqueado";
  const hasPrediction = predictions.some((p) => p.matchId === matchId);
  return hasPrediction ? "enviado" : "pendente";
}

// ---------------------------------------------------------------------------
// 5. deriveRankingSummary
// ---------------------------------------------------------------------------

/**
 * Extrai posição, pontos e total de participantes do ranking geral para o usuário.
 * Retorna null se o ranking não existir ou o usuário não estiver nas entries.
 */
export function deriveRankingSummary(
  ranking: Ranking | null | undefined,
  uid: string,
): RankingSummary | null {
  if (!ranking) return null;
  const entry = ranking.entries.find((e) => e.uid === uid);
  if (!entry) return null;
  return {
    position: entry.position,
    totalParticipants: ranking.entries.length,  // A1: fonte única é o ranking calculado
    points: entry.points,
  };
}

// ---------------------------------------------------------------------------
// 6. derivePerformanceSummary
// ---------------------------------------------------------------------------

/**
 * Extrai totalCorrect, accuracy e longestStreak de statistics.
 * gamesPredicted é derivado de totalCorrect / (accuracy / 100) (D1 — campo não existe no schema).
 * Quando statistics é null/undefined (usuário sem dados agregados ainda), retorna zeros.
 */
export function derivePerformanceSummary(
  statistics: Statistics | null | undefined,
): PerformanceSummary {
  const totalCorrect = statistics?.totalCorrect ?? 0;
  const accuracy = statistics?.accuracy ?? 0;
  const longestStreak = statistics?.longestStreak ?? 0;
  // Derivação D1: palpites = acertos / (aproveitamento / 100); evita divisão por zero.
  const gamesPredicted =
    accuracy > 0 ? Math.round(totalCorrect / (accuracy / 100)) : 0;
  return { totalCorrect, accuracy, longestStreak, gamesPredicted };
}

// ---------------------------------------------------------------------------
// 7. deriveCurrentStage
// ---------------------------------------------------------------------------

/**
 * Tabela de rodadas totais por fase do torneio (Copa 2026 — imutável).
 * Fonte estrutural do torneio, não hardcode de dados dinâmicos.
 */
const ROUNDS_PER_STAGE: Record<string, number> = {
  grupos: 3,
  oitavas: 1,
  quartas: 1,
  semifinal: 1,
  terceiro: 1,
  final: 1,
};

/**
 * Extrai fase atual de systemSettings e monta o rótulo "Rodada X de Y".
 *
 * Fonte do round: nextMatch → recentResults[0] → null.
 * Rodada disponível apenas com stage + round não-null.
 */
export function deriveCurrentStage(
  settings: SystemSettings | null | undefined,
  nextMatch: MatchWithId | null | undefined,
  recentResults: MatchWithId[],
): CurrentStageSummary {
  const stage = settings?.currentStage ?? null;
  const roundSource = nextMatch ?? recentResults[0] ?? null;
  const round = roundSource?.round ?? null;

  const roundLabel =
    stage && round != null
      ? `Rodada ${round} de ${ROUNDS_PER_STAGE[stage] ?? "?"}`
      : null;

  return { stage, roundLabel };
}

// ---------------------------------------------------------------------------
// 8. deriveNotices
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
