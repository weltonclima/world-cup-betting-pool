# SPEC — TASK-05 · Hooks TanStack Query + compositor `useHomeDashboard` (PRD-02)

> Origem: `ai/plan/home-dashboard.md` §3 TASK-05 · PRD: `ai/prd/home-dashboard.md` §3, §5, §6, §7b
> Tipo: application · SP: 5 · Criticality: high · Risk: high · TDD: yes · Screen: no
> Dependências: TASK-03 (serviços Firestore), TASK-01 (schemas + tipos)

---

## 1. Objetivo

Criar a camada reativa da Home Dashboard: factory de query-keys (`homeKeys`), sete hooks por recurso usando `useQuery` (sem redefinir cache), e o hook compositor `useHomeDashboard` que orquestra todos eles, executa joins client-side com o cache de `teams`, calcula `isCorrect` por comparação de placar, e expõe ao componente uma estrutura derivada pronta para renderização + estado agregado (`isLoading / isError / refetch`).

---

## 2. Decisões de design resolvidas (antes de implementar)

### A1 — Total de participantes
`entries.length` do ranking geral (`Ranking.entries`). Não consultar `users` approved (custo de leitura extra + possível divergência com o ranking calculado). Fonte já agregada.

### A2 — Cache: 30 min do projeto (não 5 min)
`staleTime: 30min / gcTime: 24h` definidos em `makeQueryClient` (`src/providers/QueryProvider.tsx`). **Nenhum hook desta task pode redefinir `staleTime` ou `gcTime`** — herdar o global, conforme padrão de `useUsersByStatus`. Divergência com PRD §Performance ("5min") ignorada: decisão de produto = manter consistência com o projeto.

### A3 — Denominador do aproveitamento
`statistics.accuracy` (já calculado, 0–100) é a fonte de verdade para o percentual. `statistics.totalCorrect` é o numerador exibido. Denominador como texto ("jogos palpitados") depende de R1 — sem `gamesPredicted` nem `wrong` no schema MVP (D1 do PRD §7b). **Solução MVP:** exibir só `totalCorrect` e `accuracy`; omitir denominador numérico ou exibir traço ("–") onde `gamesPredicted` seria necessário. Não derivar `gamesPredicted` a partir de `accuracy`/`totalCorrect` (frágil, arredondamento).

### A5 — Elegibilidade do próximo jogo
Menor `kickoffAt` com `status === "scheduled"`. Adicionalmente, se `systemSettings.predictionsLocked === true`, o status do palpite para esse jogo é `"bloqueado"` (não `"pendente"`), mesmo sem palpite. O serviço `getNextScheduledMatch` já retorna o jogo correto; a flag de bloqueio é derivada no compositor.

### A6 — Status do palpite do próximo jogo
Enum string `"enviado" | "pendente" | "bloqueado"`:
- `"bloqueado"`: `systemSettings.predictionsLocked === true` (independe de haver palpite).
- `"enviado"`: palpites do uid contêm um entry com `matchId === nextMatch.id` (precisa do doc id — ver §3.2).
- `"pendente"`: não bloqueado + sem palpite registrado.

### D1 / R2 — `isCorrect` calculado client-side
Para jogo `finished`: `isCorrect = prediction.homeScore === match.homeScore && prediction.awayScore === match.awayScore`. Placar de jogo finalizado não é null (validado pelo refinement do `matchSchema`). Sem campo `isCorrect` persistido.

---

## 3. Arquivos a criar

```
src/features/home/hooks/
  homeKeys.ts
  useGeneralRanking.ts
  useStatistics.ts
  useNextMatch.ts
  useRecentResults.ts
  useTeams.ts
  usePredictions.ts
  useSystemSettings.ts
  useHomeDashboard.ts
  index.ts
src/features/home/lib/
  homeDashboardHelpers.ts       ← funções puras testáveis
src/features/home/hooks/__tests__/
  homeDashboardHelpers.test.ts  ← TDD: helpers puros
  useHomeDashboard.test.ts      ← TDD: compositor (mock dos hooks por recurso)
```

Nenhum arquivo existente é alterado nesta task.

---

## 4. `homeKeys` — factory de query-keys

**Arquivo:** `src/features/home/hooks/homeKeys.ts`

Espelha exatamente o padrão de `usersKeys.ts` — fonte única de strings evita drift entre query e invalidação.

```ts
/**
 * Factory de query-keys da feature home (TASK-05).
 * Espelha o padrão de usersKeys.ts: fonte única, sem strings mágicas.
 */
export const homeKeys = {
  generalRanking: ["home", "general-ranking"]                  as const,
  statistics:     (uid: string) => ["home", "statistics", uid] as const,
  nextMatch:      ["home", "next-match"]                        as const,
  recentResults:  ["home", "recent-results"]                    as const,
  teams:          ["home", "teams"]                             as const,
  predictions:    (uid: string) => ["home", "predictions", uid] as const,
  systemSettings: ["home", "system-settings"]                   as const,
} as const;
```

> Nota: `teams` e os recursos sem parâmetro usam array literal (não função) por consistência com o padrão `usersKeys.all`.

---

## 5. Hooks por recurso

Todos os hooks seguem o mesmo contrato de `useUsersByStatus`:
- Importam o serviço correspondente de `@/services`.
- Usam `homeKeys` para a `queryKey`.
- **Não definem `staleTime` nem `gcTime`** — herdam do `QueryClient` global.
- Retornam `UseQueryResult<T>` tipado explicitamente.

### 5.1 `useGeneralRanking`

```ts
// src/features/home/hooks/useGeneralRanking.ts
"use client";
import { useQuery, type UseQueryResult } from "@tanstack/react-query";
import { getGeneralRanking } from "@/services";
import type { Ranking } from "@/types";
import { homeKeys } from "./homeKeys";

export function useGeneralRanking(): UseQueryResult<Ranking | null> {
  return useQuery({
    queryKey: homeKeys.generalRanking,
    queryFn: getGeneralRanking,
  });
}
```

### 5.2 `useStatistics`

Desabilitado quando `uid` for nulo (usuário não autenticado — edge case de segurança).

```ts
// src/features/home/hooks/useStatistics.ts
"use client";
import { useQuery, type UseQueryResult } from "@tanstack/react-query";
import { getStatistics } from "@/services";
import type { Statistics } from "@/types";
import { homeKeys } from "./homeKeys";

export function useStatistics(uid: string | null): UseQueryResult<Statistics | null> {
  return useQuery({
    queryKey: homeKeys.statistics(uid ?? ""),
    queryFn: () => getStatistics(uid!),
    enabled: uid !== null,
  });
}
```

### 5.3 `useNextMatch`

```ts
// src/features/home/hooks/useNextMatch.ts
"use client";
import { useQuery, type UseQueryResult } from "@tanstack/react-query";
import { getNextScheduledMatch } from "@/services";
import type { Match } from "@/types";
import { homeKeys } from "./homeKeys";

export function useNextMatch(): UseQueryResult<Match | null> {
  return useQuery({
    queryKey: homeKeys.nextMatch,
    queryFn: getNextScheduledMatch,
  });
}
```

### 5.4 `useRecentResults`

```ts
// src/features/home/hooks/useRecentResults.ts
"use client";
import { useQuery, type UseQueryResult } from "@tanstack/react-query";
import { getRecentFinishedMatches } from "@/services";
import type { Match } from "@/types";
import { homeKeys } from "./homeKeys";

export function useRecentResults(): UseQueryResult<Match[]> {
  return useQuery({
    queryKey: homeKeys.recentResults,
    queryFn: getRecentFinishedMatches,
  });
}
```

### 5.5 `useTeams`

Cache de join — coleção pequena (≤ 48), buscada uma vez, reutilizada por todas as derivações.

```ts
// src/features/home/hooks/useTeams.ts
"use client";
import { useQuery, type UseQueryResult } from "@tanstack/react-query";
import { listAllTeams } from "@/services";
import type { Team } from "@/types";
import { homeKeys } from "./homeKeys";

export function useTeams(): UseQueryResult<Team[]> {
  return useQuery({
    queryKey: homeKeys.teams,
    queryFn: listAllTeams,
  });
}
```

### 5.6 `usePredictions`

Desabilitado quando `uid` for nulo.

```ts
// src/features/home/hooks/usePredictions.ts
"use client";
import { useQuery, type UseQueryResult } from "@tanstack/react-query";
import { listPredictionsByUid } from "@/services";
import type { Prediction } from "@/types";
import { homeKeys } from "./homeKeys";

export function usePredictions(uid: string | null): UseQueryResult<Prediction[]> {
  return useQuery({
    queryKey: homeKeys.predictions(uid ?? ""),
    queryFn: () => listPredictionsByUid(uid!),
    enabled: uid !== null,
  });
}
```

### 5.7 `useSystemSettings`

```ts
// src/features/home/hooks/useSystemSettings.ts
"use client";
import { useQuery, type UseQueryResult } from "@tanstack/react-query";
import { getSystemSettings } from "@/services";
import type { SystemSettings } from "@/types";
import { homeKeys } from "./homeKeys";

export function useSystemSettings(): UseQueryResult<SystemSettings | null> {
  return useQuery({
    queryKey: homeKeys.systemSettings,
    queryFn: getSystemSettings,
  });
}
```

---

## 6. Tipos de saída do compositor

Definir em `src/features/home/hooks/useHomeDashboard.ts` (ou em `src/types/` se reutilizados por UI).

```ts
/** Posição do usuário no ranking geral. */
export interface RankingSummary {
  position: number;          // posição do usuário (1-based)
  totalParticipants: number; // entries.length (A1)
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
  totalCorrect: number;         // statistics.totalCorrect (0 se sem dados)
  accuracy: number;             // statistics.accuracy 0–100 (0 se sem dados)
  /** null: sem statistics no MVP (D1); não derivar de accuracy para evitar arredondamento. */
  gamesPredicted: null;
  /** null: sem statistics no MVP (D1). */
  wrong: null;
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
```

> **Nota sobre `matchId`:** o schema `matchSchema` é `.strict()` e **não inclui** o campo `id` (doc id do Firestore). Os serviços mapeiam `d.data()` sem injetar o id. Para resolver A6 (status do palpite por matchId), a Match precisa carregar o doc id. **Decisão desta spec:** os serviços `getNextScheduledMatch` e `getRecentFinishedMatches` devem ser estendidos para retornar o doc id junto com os dados — ver §7 abaixo.

---

## 7. Ajuste necessário nos serviços de matches (fora do escopo de TASK-03, necessário para TASK-05)

O `matchSchema` é `.strict()` e não inclui `id`. Mas `useHomeDashboard` precisa do doc id para cruzar com `prediction.matchId`. Duas opções:

**Opção A (recomendada):** Criar um tipo `MatchWithId = Match & { id: string }` em `src/types/matches.ts` e ajustar `getNextScheduledMatch` / `getRecentFinishedMatches` para retornar `{ id: d.id, ...matchSchema.parse(d.data()) }`. O schema Zod não é alterado (`.strict()` continua válido para os dados do Firestore); o `id` é injetado **após** o parse.

**Opção B:** Fazer o join no compositor usando `kickoffAt` + equipes como surrogate key. **Rejeitada** — frágil (dois jogos podem ter mesmo kickoffAt).

**Decisão desta spec:** implementar Opção A. Ajustar `src/services/matches.ts` adicionando o tipo `MatchWithId` e modificando as duas funções para retornar `MatchWithId | null` e `MatchWithId[]` respectivamente. Esse ajuste faz parte da implementação de TASK-05 (é viável sem risco de regressão já que TASK-03 ainda não tem testes de integração completos — os testes dos serviços são via mock).

```ts
// src/types/matches.ts — adicionar
export type MatchWithId = Match & { id: string };
```

```ts
// src/services/matches.ts — getNextScheduledMatch
const first = snapshot.docs[0];
if (!first) return null;
return { id: first.id, ...matchSchema.parse(first.data()) };

// src/services/matches.ts — getRecentFinishedMatches
return snapshot.docs.map((d) => ({ id: d.id, ...matchSchema.parse(d.data()) }));
```

Atualizar `src/services/index.ts` export types se necessário.

---

## 8. Funções puras (helpers testáveis)

**Arquivo:** `src/features/home/lib/homeDashboardHelpers.ts`

Todas as funções são puras (sem React, sem side-effects). São o alvo principal do TDD.

### 8.1 `buildTeamMap`

```ts
/**
 * Constrói um Map de teamId → Team a partir do array retornado por listAllTeams.
 * Evita iterar o array a cada join (O(1) lookup).
 */
export function buildTeamMap(teams: Team[]): Map<string, Team> {
  return new Map(teams.map((t, _i, _arr) => {
    // O doc id não está no Team (schema .strict()). O serviço injeta o id separadamente.
    // buildTeamMap recebe o array enriquecido com id (TeamWithId).
    return [t.id, t];
  }));
}
```

> **Nota:** assim como `Match`, `Team` também não tem `id` no schema. O serviço `listAllTeams` precisa do mesmo ajuste — retornar `TeamWithId = Team & { id: string }`. Incluir esse ajuste na implementação de TASK-05 junto com o de `matches`.

```ts
// Tipo auxiliar (src/types/teams.ts)
export type TeamWithId = Team & { id: string };

// src/services/teams.ts — listAllTeams
return snapshot.docs.map((d) => ({ id: d.id, ...teamSchema.parse(d.data()) }));
```

### 8.2 `resolveTeam`

```ts
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
```

### 8.3 `computeIsCorrect`

```ts
/**
 * Calcula se o palpite acertou o placar exato de um jogo finalizado.
 * Regra: acerto binário — placar exato → true; qualquer diferença → false.
 * Sem palpite → false (usuário não participou deste jogo).
 *
 * @param match  - Partida finalizada (homeScore/awayScore garantidamente não-null pelo schema).
 * @param prediction - Palpite do usuário para esta partida, ou null/undefined se não enviou.
 */
export function computeIsCorrect(
  match: MatchWithId,
  prediction: Prediction | null | undefined,
): boolean {
  if (!prediction) return false;
  // match.homeScore e match.awayScore são non-null em jogos finished (refinement do schema).
  // Cast seguro: chamado apenas com jogos finished.
  return (
    prediction.homeScore === (match.homeScore as number) &&
    prediction.awayScore === (match.awayScore as number)
  );
}
```

### 8.4 `derivePredictionStatus`

```ts
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
```

### 8.5 `deriveRankingSummary`

```ts
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
    totalParticipants: ranking.entries.length,  // A1
    points: entry.points,
  };
}
```

### 8.6 `derivePerformanceSummary`

```ts
/**
 * Extrai totalCorrect e accuracy de statistics.
 * gamesPredicted e wrong são null no MVP (D1 — sem esses campos no schema).
 * Quando statistics é null (usuário sem dados agregados ainda), retorna zeros.
 */
export function derivePerformanceSummary(
  statistics: Statistics | null | undefined,
): PerformanceSummary {
  return {
    totalCorrect: statistics?.totalCorrect ?? 0,
    accuracy: statistics?.accuracy ?? 0,
    gamesPredicted: null,
    wrong: null,
  };
}
```

### 8.7 `deriveCurrentStage`

```ts
/**
 * Extrai fase atual de systemSettings e monta o rótulo "Rodada X de Y".
 *
 * "Rodada X de Y":
 *   - X = round do próximo jogo (se disponível) ou dos recentResults[0].
 *   - Y = número total de rodadas da fase (hardcoded por fase — ver tabela abaixo).
 *   - Se round não estiver disponível: roundLabel = null.
 *
 * Tabela de rounds por fase:
 *   grupos: 3  |  oitavas: 1  |  quartas: 1  |  semifinal: 1  |  terceiro: 1  |  final: 1
 */
export function deriveCurrentStage(
  settings: SystemSettings | null | undefined,
  nextMatch: MatchWithId | null | undefined,
  recentResults: MatchWithId[],
): CurrentStageSummary {
  const stage = settings?.currentStage ?? null;
  const roundSource = nextMatch ?? recentResults[0] ?? null;
  const round = roundSource?.round ?? null;

  const ROUNDS_PER_STAGE: Record<string, number> = {
    grupos: 3,
    oitavas: 1,
    quartas: 1,
    semifinal: 1,
    terceiro: 1,
    final: 1,
  };

  const roundLabel =
    stage && round != null
      ? `Rodada ${round} de ${ROUNDS_PER_STAGE[stage] ?? "?"}`
      : null;

  return { stage, roundLabel };
}
```

### 8.8 `deriveNotices`

```ts
/**
 * Deriva o conjunto mínimo de avisos do sistema a partir de flags + próximo kickoff.
 *
 * Avisos deriváveis no MVP (R6):
 *   1. Palpites travados: "Palpites encerrados para esta fase."  (warning)
 *   2. Prazo se aproximando (< 3h para o próximo kickoff):
 *      "Prazo encerra em Xh Ym."  (warning)
 *   3. Cadastros fechados: "Cadastros encerrados."  (info)
 *
 * @param settings   - Configurações do sistema (pode ser null).
 * @param nextMatch  - Próximo jogo (para calcular prazo).
 * @param now        - Data de referência (injetada para facilitar testes).
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
```

---

## 9. Compositor `useHomeDashboard`

**Arquivo:** `src/features/home/hooks/useHomeDashboard.ts`

```ts
"use client";

import { useCallback } from "react";
import { useAuth } from "@/hooks/useAuth";
import { useGeneralRanking } from "./useGeneralRanking";
import { useStatistics } from "./useStatistics";
import { useNextMatch } from "./useNextMatch";
import { useRecentResults } from "./useRecentResults";
import { useTeams } from "./useTeams";
import { usePredictions } from "./usePredictions";
import { useSystemSettings } from "./useSystemSettings";
import {
  buildTeamMap,
  resolveTeam,
  computeIsCorrect,
  derivePredictionStatus,
  deriveRankingSummary,
  derivePerformanceSummary,
  deriveCurrentStage,
  deriveNotices,
} from "../lib/homeDashboardHelpers";
import type {
  HomeDashboardData,
  NextMatchSummary,
  RecentResult,
} from "./useHomeDashboard"; // tipos no mesmo arquivo ou em types/

export function useHomeDashboard(): HomeDashboardData {
  // 1. uid do usuário autenticado
  const { firebaseUser } = useAuth();
  const uid = firebaseUser?.uid ?? null;

  // 2. Queries por recurso (sem cache override — herdam global 30min/24h)
  const rankingQuery     = useGeneralRanking();
  const statisticsQuery  = useStatistics(uid);
  const nextMatchQuery   = useNextMatch();
  const recentQuery      = useRecentResults();
  const teamsQuery       = useTeams();
  const predictionsQuery = usePredictions(uid);
  const settingsQuery    = useSystemSettings();

  // 3. Estado agregado
  const queries = [rankingQuery, statisticsQuery, nextMatchQuery, recentQuery,
                   teamsQuery, predictionsQuery, settingsQuery];
  const isLoading = uid === null
    ? (teamsQuery.isLoading || nextMatchQuery.isLoading || recentQuery.isLoading || settingsQuery.isLoading)
    : queries.some((q) => q.isLoading);
  const isError = queries.some((q) => q.isError);

  const refetch = useCallback(() => {
    queries.forEach((q) => void q.refetch());
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // 4. Guard: sem uid → retornar estado neutro (usuário não autenticado)
  if (uid === null) {
    return {
      ranking: null,
      performance: { totalCorrect: 0, accuracy: 0, gamesPredicted: null, wrong: null },
      nextMatch: null,
      recentResults: [],
      currentStage: { stage: null, roundLabel: null },
      notices: [],
      isLoading,
      isError,
      refetch,
    };
  }

  // 5. Dados brutos (podem ser undefined enquanto carregam)
  const ranking    = rankingQuery.data;
  const statistics = statisticsQuery.data;
  const nextMatch  = nextMatchQuery.data ?? null;
  const recent     = recentQuery.data ?? [];
  const teams      = teamsQuery.data ?? [];
  const predictions = predictionsQuery.data ?? [];
  const settings   = settingsQuery.data ?? null;

  // 6. Cache de teams (Map para O(1) lookup)
  const teamMap = buildTeamMap(teams);

  // 7. Ranking summary
  const rankingSummary = deriveRankingSummary(ranking, uid);

  // 8. Performance summary
  const performance = derivePerformanceSummary(statistics);

  // 9. Próximo jogo com join de teams + status do palpite
  let nextMatchSummary: NextMatchSummary | null = null;
  if (nextMatch) {
    const predStatus = derivePredictionStatus(
      nextMatch.id,
      predictions,
      settings?.predictionsLocked ?? false,
    );
    const userPred = predictions.find((p) => p.matchId === nextMatch.id) ?? null;
    nextMatchSummary = {
      matchId: nextMatch.id,
      kickoffAt: nextMatch.kickoffAt,
      homeTeam: resolveTeam(nextMatch.homeTeamId, teamMap),
      awayTeam: resolveTeam(nextMatch.awayTeamId, teamMap),
      predictionStatus: predStatus,
      userPrediction: userPred
        ? { homeScore: userPred.homeScore, awayScore: userPred.awayScore }
        : null,
    };
  }

  // 10. Últimos resultados com join de teams + isCorrect
  const recentResults: RecentResult[] = recent.map((match) => {
    const pred = predictions.find((p) => p.matchId === match.id) ?? null;
    return {
      matchId: match.id,
      kickoffAt: match.kickoffAt,
      homeTeam: resolveTeam(match.homeTeamId, teamMap),
      awayTeam: resolveTeam(match.awayTeamId, teamMap),
      matchHomeScore: match.homeScore as number,  // non-null garantido pelo schema (finished)
      matchAwayScore: match.awayScore as number,
      userPrediction: pred ? { homeScore: pred.homeScore, awayScore: pred.awayScore } : null,
      isCorrect: computeIsCorrect(match, pred),
    };
  });

  // 11. Fase atual + rodada
  const currentStage = deriveCurrentStage(settings, nextMatch, recent);

  // 12. Avisos
  const notices = deriveNotices(settings, nextMatch, new Date());

  return {
    ranking: rankingSummary,
    performance,
    nextMatch: nextMatchSummary,
    recentResults,
    currentStage,
    notices,
    isLoading,
    isError,
    refetch,
  };
}
```

---

## 10. Edge cases e tratamento defensivo

| Situação | Comportamento especificado |
|---|---|
| `uid === null` | Queries com `uid` ficam desabilitadas (`enabled: false`); compositor retorna estado neutro. |
| `ranking === null` (doc não existe) | `rankingSummary = null`; card de ranking exibe estado empty. |
| `statistics === null` (sem dados ainda) | `performance` com zeros; não lança erro. |
| `nextMatch === null` (sem jogos agendados) | `nextMatchSummary = null`; card omitido ou vazio. |
| `recent === []` (sem finalizados) | `recentResults = []`; card exibe estado empty. |
| `teams === []` (seed não populou) | `resolveTeam` retorna fallback `{ name: teamId, flagUrl: undefined }` — nome exibido é o id raw. |
| `predictions === []` (sem palpites) | `nextMatch.predictionStatus = "pendente"` (ou `"bloqueado"`); `recentResults[].isCorrect = false`. |
| `match.homeScore === null` em jogo `finished` | Não deveria acontecer (violaria o refinement do schema); mas se chegasse, `computeIsCorrect` retornaria `false` (comparison com non-null prediction scores). O cast para `number` no compositor é seguro para dados válidos; adicionar guard no helper se desejado. |
| `teamId` não encontrado no `teamMap` | `resolveTeam` retorna `{ name: teamId, flagUrl: undefined }` (fallback, não lança). |
| `settings === null` (doc não existe) | `predictionsLocked` assume `false`; `currentStage` assume `null`; sem avisos de locked/registration. |
| Múltiplas queries com erro simultâneo | `isError = true`; `refetch` chama todas as queries; UI exibe estado de erro com "Tentar Novamente". |

---

## 11. Plano de teste (TDD — conforme recomendação do plano)

### 11.1 `homeDashboardHelpers.test.ts` — funções puras (TDD Red→Green→Refactor)

Cobrir por função:

**`computeIsCorrect`**
- Placar exato → `true`
- Placar diferente (home errado) → `false`
- Placar diferente (away errado) → `false`
- Sem palpite (`null`) → `false`
- Sem palpite (`undefined`) → `false`

**`derivePredictionStatus`**
- `predictionsLocked: true` → `"bloqueado"` (independe de palpite)
- Palpite existe + não bloqueado → `"enviado"`
- Sem palpite + não bloqueado → `"pendente"`
- `predictionsLocked: true` com palpite existente → `"bloqueado"` (bloqueado prevalece)

**`deriveRankingSummary`**
- Ranking com uid na lista → `{ position, totalParticipants: entries.length, points }`
- Uid não está nas entries → `null`
- Ranking `null` → `null`
- Ranking com entries vazias → `null`

**`derivePerformanceSummary`**
- Statistics com dados → retorna `totalCorrect` e `accuracy` corretos, `gamesPredicted: null`, `wrong: null`
- Statistics `null` → zeros, nulls
- Statistics `undefined` → zeros, nulls

**`resolveTeam`**
- Id presente no map → retorna `{ name, flagUrl }`
- Id ausente → fallback `{ name: teamId, flagUrl: undefined }`
- `flagUrl` opcional (undefined no schema) → passado corretamente

**`buildTeamMap`**
- Array vazio → Map vazio
- Array com 3 times → Map com 3 entradas por id
- Ids únicos (sem colisão)

**`deriveCurrentStage`**
- Stage presente + round presente → label "Rodada X de Y"
- Stage presente + round `null` → `roundLabel: null`
- Stage `null` → `{ stage: null, roundLabel: null }`
- Stage "grupos" + round 2 → "Rodada 2 de 3"
- Stage "final" + round `null` → `roundLabel: null`

**`deriveNotices`**
- `predictionsLocked: true` → aviso de palpites encerrados
- Kickoff em 1h → aviso de prazo (< 3h)
- Kickoff em 4h → sem aviso de prazo (≥ 3h)
- `registrationOpen: false` → aviso de cadastros encerrados
- `settings: null` → array vazio
- Combinação de todas as flags ativas → 3 avisos

### 11.2 `useHomeDashboard.test.ts` — compositor (mock dos hooks por recurso)

Usar `vi.mock` para mockar os 7 hooks (`useGeneralRanking`, `useStatistics`, etc.) e `useAuth`.

Cenários:
- Todos os dados presentes → estrutura completa retornada corretamente
- `uid === null` → estado neutro, queries de uid desabilitadas
- `nextMatchQuery.isLoading: true` → `isLoading: true`
- Qualquer query com `isError: true` → `isError: true`
- `ranking` com uid do usuário presente → `rankingSummary` preenchido
- `teams` vazio + next match existente → fallback de nome com teamId raw
- `predictions` vazias + next match → `predictionStatus: "pendente"`
- `predictionsLocked: true` → `predictionStatus: "bloqueado"`
- `recentResults` com jogo finalizado + palpite correto → `isCorrect: true`
- `recentResults` com jogo finalizado + sem palpite → `isCorrect: false`
- `refetch` chama refetch de todos os hooks

---

## 12. Barrel `src/features/home/hooks/index.ts`

```ts
export { homeKeys } from "./homeKeys";
export { useGeneralRanking } from "./useGeneralRanking";
export { useStatistics } from "./useStatistics";
export { useNextMatch } from "./useNextMatch";
export { useRecentResults } from "./useRecentResults";
export { useTeams } from "./useTeams";
export { usePredictions } from "./usePredictions";
export { useSystemSettings } from "./useSystemSettings";
export { useHomeDashboard } from "./useHomeDashboard";
export type {
  HomeDashboardData,
  NextMatchSummary,
  RecentResult,
  RankingSummary,
  ResolvedTeam,
  PerformanceSummary,
  CurrentStageSummary,
  SystemNotice,
  PredictionStatus,
} from "./useHomeDashboard";
```

---

## 13. Restrições do projeto (obrigatórias)

- TypeScript strict — **sem `any`**. Casts explícitos (`as number`) só onde o schema garante segurança (jogo finished tem placar non-null); comentar o motivo.
- **Sem estilos inline** — não aplicável (layer de dados puro).
- **Sem hardcode de dados** — a tabela `ROUNDS_PER_STAGE` em `deriveCurrentStage` é a única constante; aceitável como dado estrutural do torneio (imutável para Copa 2026).
- **Sem redefinição de `staleTime`/`gcTime`** em nenhum hook — herdar do `QueryClient` global.
- Todo hook usa `"use client"` (obrigatório para hooks React em Next.js App Router).
- Funções puras em `homeDashboardHelpers.ts` sem imports React ou Firebase — testáveis em isolamento.
- `enabled: uid !== null` em hooks dependentes de uid — nunca chamar serviço sem uid.

---

## 14. Critérios de aceite

1. `homeKeys` exporta as 7 chaves sem strings repetidas; nenhuma query usa string literal fora desta factory.
2. Cada hook por recurso: `queryKey` usa `homeKeys`, sem `staleTime`/`gcTime` no objeto de opções.
3. `useStatistics` e `usePredictions`: `enabled: uid !== null`; query não dispara com `uid === null`.
4. `useTeams`: buscado uma vez; sem re-fetch por cada jogo (N+1 ausente).
5. `useHomeDashboard` com uid `null` → retorna `isLoading: false` (queries uid-dependentes não carregam), `ranking: null`, `recentResults: []`.
6. `computeIsCorrect(matchFinished, predCorreta)` → `true`; `computeIsCorrect(matchFinished, null)` → `false`.
7. `derivePredictionStatus(id, [], false)` → `"pendente"`; `derivePredictionStatus(id, [pred], false)` → `"enviado"`; `derivePredictionStatus(id, [], true)` → `"bloqueado"`.
8. `recentResults[].isCorrect` correto para palpite exato, palpite errado e sem palpite.
9. `resolveTeam` com id não encontrado retorna `{ name: id, flagUrl: undefined }` sem lançar.
10. `notices` contém aviso de prazo quando kickoff < 3h; sem aviso quando ≥ 3h.
11. `isLoading` é `true` quando qualquer query relevante está carregando.
12. `isError` é `true` quando qualquer query falhou.
13. `refetch` chama `q.refetch()` de todas as queries.
14. Suíte completa verde: `rtk vitest run` nos arquivos de `home/hooks/__tests__/`.
15. `rtk tsc` sem erros novos.
