/**
 * Funções puras da feature Jogos (TASK-01).
 * Sem React, sem Firebase — testáveis em isolamento.
 * Toda a lógica de derivação/agrupamento/filtro fica aqui; o compositor de TASK-02 orquestra.
 */

import { format } from "date-fns";
import { ptBR } from "date-fns/locale";

import type { MatchStatus, MatchWithId, Prediction, Stage, TeamWithId } from "@/types";

// ---------------------------------------------------------------------------
// Tipos de saída (reexportados pelo barrel para uso no compositor e na UI)
// ---------------------------------------------------------------------------

/** Seleção resolvida a partir do teamMap. */
export interface ResolvedTeam {
  name: string;
  flagUrl: string | undefined; // undefined se não constar no doc (campo opcional no schema)
}

/** Status de palpite por partida. */
export type MatchPredictionStatus = "enviado" | "pendente" | "bloqueado";

/** Rótulo do status do jogo em pt-BR. */
export type GameStatusLabel = "Agendado" | "Ao Vivo" | "Encerrado" | "Adiado" | "Cancelado";

/** Seção de jogos agrupados por dia. */
export interface MatchDaySection {
  /** "Hoje" | "Amanhã" | "15 de junho de 2026" */
  label: string;
  /** "yyyy-MM-dd" UTC — chave estável para React key */
  date: string;
  matches: MatchWithId[];
}

/** Filtros aceitos por filterMatches. */
export interface MatchFilters {
  stage?: Stage;
  teamId?: string;
}

/** Bucket temporal de uma partida relativo ao dia corrente. */
export type TemporalBucket = "anteriores" | "hoje" | "proximos";

// ---------------------------------------------------------------------------
// 1. buildTeamMap
// ---------------------------------------------------------------------------

/**
 * Constrói um Map de teamId → TeamWithId a partir do array retornado pelo serviço de teams.
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
// 3. groupMatchesByDay
// ---------------------------------------------------------------------------

/**
 * Extrai a data UTC no formato "yyyy-MM-dd" de uma string ISO 8601.
 * Comparação de dia usa a data UTC do kickoff vs a data UTC de now (sem conversão de fuso).
 *
 * Exportada para reuso no compositor de tabs temporais (classificação por dateKey).
 */
export function toUtcDateKey(isoString: string): string {
  // Pega os 10 primeiros caracteres de uma data ISO normalizada para UTC.
  return new Date(isoString).toISOString().slice(0, 10);
}

/**
 * Classifica um dateKey ("yyyy-MM-dd" UTC) em um bucket temporal relativo a todayKey.
 *
 * Comparação lexicográfica de strings ISO date == comparação cronológica:
 * - dateKey < todayKey  → "anteriores"
 * - dateKey === todayKey → "hoje"
 * - dateKey > todayKey  → "proximos"
 *
 * Ambas as chaves devem vir de toUtcDateKey (mesmo formato/fuso UTC).
 *
 * @param dateKey  - Data UTC da partida ("yyyy-MM-dd").
 * @param todayKey - Data UTC de referência ("yyyy-MM-dd").
 */
export function classifyDateKey(dateKey: string, todayKey: string): TemporalBucket {
  if (dateKey < todayKey) return "anteriores";
  if (dateKey > todayKey) return "proximos";
  return "hoje";
}

/**
 * Agrupa partidas por dia (data UTC do kickoff) e gera rótulos em pt-BR.
 *
 * - Ordena globalmente por kickoffAt ASC antes de agrupar.
 * - Rótulo: "Hoje" | "Amanhã" | data por extenso (date-fns pt-BR).
 * - Dentro de cada seção, jogos ordenados por kickoffAt ASC.
 * - Array vazio → retorna [].
 *
 * @param matches - Partidas (qualquer status).
 * @param now     - Data de referência (injetada — nunca new Date() interno).
 */
export function groupMatchesByDay(matches: MatchWithId[], now: Date): MatchDaySection[] {
  if (matches.length === 0) return [];

  const nowDateKey = toUtcDateKey(now.toISOString());
  const nowMs = now.getTime();
  // "Amanhã" em UTC: avança 1 dia do nowDateKey
  const tomorrowDate = new Date(nowMs + 24 * 60 * 60 * 1000);
  const tomorrowDateKey = toUtcDateKey(tomorrowDate.toISOString());

  // Ordena por kickoffAt ASC
  const sorted = [...matches].sort(
    (a, b) => new Date(a.kickoffAt).getTime() - new Date(b.kickoffAt).getTime(),
  );

  // Agrupa por dateKey (preservando a ordem)
  const sectionMap = new Map<string, MatchWithId[]>();
  for (const match of sorted) {
    const dateKey = toUtcDateKey(match.kickoffAt);
    const existing = sectionMap.get(dateKey);
    if (existing) {
      existing.push(match);
    } else {
      sectionMap.set(dateKey, [match]);
    }
  }

  // Monta as seções com label
  const sections: MatchDaySection[] = [];
  for (const [dateKey, dayMatches] of sectionMap.entries()) {
    let label: string;
    if (dateKey === nowDateKey) {
      label = "Hoje";
    } else if (dateKey === tomorrowDateKey) {
      label = "Amanhã";
    } else {
      // Ex.: "22 de junho de 2026"
      // dateKey é "yyyy-MM-dd" (UTC). Parseamos os componentes e criamos uma Date local
      // para que date-fns/format não desloque o dia ao converter UTC → fuso local.
      const [year, month, day] = dateKey.split("-").map(Number);
      // new Date(y, m-1, d) cria meia-noite local — sem risco de deslocamento de fuso.
      const dateObj = new Date(year!, month! - 1, day!);
      label = format(dateObj, "d 'de' MMMM 'de' yyyy", { locale: ptBR });
    }

    sections.push({
      label,
      date: dateKey,
      matches: dayMatches,
    });
  }

  // Seções já estão em ordem ASC porque sorted foi inserido nessa ordem no Map
  return sections;
}

// ---------------------------------------------------------------------------
// 4. filterMatches
// ---------------------------------------------------------------------------

/**
 * Filtra partidas por fase e/ou teamId.
 * Filtros combinados são AND lógico. Filtros omitidos não restringem.
 * Retorna novo array (sem mutação).
 *
 * Nota: filtro por predictionStatus é responsabilidade do compositor (TASK-02),
 * pois exige dados de predições que não estão disponíveis nesta camada pura.
 *
 * @param matches - Array de partidas.
 * @param filters - Filtros opcionais: { stage?, teamId? }.
 */
export function filterMatches(matches: MatchWithId[], filters: MatchFilters): MatchWithId[] {
  return matches.filter((match) => {
    if (filters.stage !== undefined && match.stage !== filters.stage) {
      return false;
    }
    if (
      filters.teamId !== undefined &&
      match.homeTeamId !== filters.teamId &&
      match.awayTeamId !== filters.teamId
    ) {
      return false;
    }
    return true;
  });
}

// ---------------------------------------------------------------------------
// 5. searchMatchesByCountry
// ---------------------------------------------------------------------------

/**
 * Busca partidas pelo nome do país (mandante ou visitante).
 * - Query vazia (após trim) → retorna o array original.
 * - Case-insensitive, substring match.
 * - Usa resolveTeam internamente (fallback para teamId se ausente no map — sem lançar).
 *
 * @param matches - Array de partidas.
 * @param teamMap - Map pré-construído por buildTeamMap.
 * @param query   - Texto de busca (pode ser vazio).
 */
export function searchMatchesByCountry(
  matches: MatchWithId[],
  teamMap: Map<string, TeamWithId>,
  query: string,
): MatchWithId[] {
  const normalized = query.trim().toLowerCase();
  if (!normalized) return matches;

  return matches.filter((match) => {
    const home = resolveTeam(match.homeTeamId, teamMap).name.toLowerCase();
    const away = resolveTeam(match.awayTeamId, teamMap).name.toLowerCase();
    return home.includes(normalized) || away.includes(normalized);
  });
}

// ---------------------------------------------------------------------------
// 6. deriveMatchPredictionStatus — REGRA CRÍTICA
// ---------------------------------------------------------------------------

/**
 * Determina o status do palpite do usuário para uma partida específica.
 *
 * Prioridade (ordem de avaliação):
 * 1. globalLock === true → "bloqueado"
 * 2. now >= kickoffAt → "bloqueado"
 * 3. match.status !== "scheduled" → "bloqueado"
 * 4. predictions contém p.matchId === match.id → "enviado"
 * 5. caso contrário → "pendente"
 *
 * @param match       - Partida alvo.
 * @param predictions - Lista de palpites do usuário (todos os matchIds).
 * @param now         - Data de referência (injetada — nunca new Date() interno).
 * @param globalLock  - Trava global do sistema (default false).
 */
export function deriveMatchPredictionStatus(
  match: MatchWithId,
  predictions: Prediction[],
  now: Date,
  globalLock = false,
): MatchPredictionStatus {
  if (globalLock) return "bloqueado";
  if (now.getTime() >= new Date(match.kickoffAt).getTime()) return "bloqueado";
  if (match.status !== "scheduled") return "bloqueado";
  if (predictions.some((p) => p.matchId === match.id)) return "enviado";
  return "pendente";
}

// ---------------------------------------------------------------------------
// 7. deriveGameStatusLabel
// ---------------------------------------------------------------------------

/**
 * Mapeia MatchStatus → rótulo pt-BR.
 * TypeScript garante exhaustiveness: novo valor não mapeado causa erro de compilação.
 *
 * @param status - Status do jogo (um dos 5 valores de matchStatusSchema).
 */
export function deriveGameStatusLabel(status: MatchStatus): GameStatusLabel {
  const labels: Record<MatchStatus, GameStatusLabel> = {
    scheduled: "Agendado",
    live: "Ao Vivo",
    finished: "Encerrado",
    postponed: "Adiado",
    canceled: "Cancelado",
  };
  return labels[status];
}
