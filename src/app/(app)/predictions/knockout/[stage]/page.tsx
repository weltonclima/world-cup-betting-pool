"use client";

/**
 * Página de Fase Eliminatória (/predictions/knockout/[stage]) — TASK-14 (PRD03-07..11).
 *
 * Renderiza a chave interativa (Bracket via KnockoutPhaseScreen) de uma fase:
 * `stage ∈ {dezesseis-avos, oitavas, quartas, semifinal, final}`. A fase "final"
 * também renderiza a disputa de 3º lugar (stage "terceiro") na mesma tela (PRD03-11).
 *
 * Data-fetching: usePhaseMatches(stage) + buildBracketFromFixtures (TASK-03/05).
 * Auto-save local (usePredictionDraft) a cada par completo; persistência server em
 * lote (useUpsertPredictionsBatch) ao "Salvar Fase". Persiste como placar exato
 * contra o matchId real (A1/A3). Bloqueio de fase até a anterior concluir (A6).
 *
 * Container com tema `.palpites-theme` (shell verde — MASTER §2.4-palpites).
 */

import { use, useCallback, useMemo, useState } from "react";
import { notFound } from "next/navigation";
import { toast } from "sonner";

import { BackButton } from "@/components/layout/BackButton";
import { useAuth } from "@/hooks/useAuth";
import { useMatches, useTeams } from "@/features/matches/hooks";
import { buildTeamMap, resolveTeam } from "@/features/matches/lib/matchesHelpers";
import {
  usePredictionDraft,
  usePredictions,
  useUpsertPredictionsBatch,
} from "@/features/predictions/hooks";
import {
  KnockoutPhaseScreen,
  buildSaveFeedback,
  type KnockoutSection,
  type BracketScores,
} from "@/features/predictions/components";
import { buildBracketFromFixtures } from "@/features/predictions/lib";
import { isPredictionLocked } from "@/features/predictions/lib/predictionsHelpers";
import type { MatchWithId, Stage } from "@/types";
import type { UpsertPredictionInput } from "@/services/predictions";

// ── Configuração das fases eliminatórias (ordem + rótulo + bloqueio A6) ──────────

interface KnockoutStageConfig {
  /** Stage(s) renderizado(s) — a final inclui também "terceiro". */
  stages: Stage[];
  /** Rótulo pt-BR da fase. */
  title: string;
  /** Título da seção principal no Bracket. */
  sectionTitle?: string;
  /** Slug da fase anterior (undefined na primeira eliminatória). */
  prevSlug?: KnockoutSlug;
  /** Stage anterior usado na regra de bloqueio A6 (undefined na primeira). */
  prevStage?: Stage;
  /** Slug da próxima fase (undefined na última). */
  nextSlug?: KnockoutSlug;
}

type KnockoutSlug =
  | "dezesseis-avos"
  | "oitavas"
  | "quartas"
  | "semifinal"
  | "final";

const KNOCKOUT_CONFIG: Record<KnockoutSlug, KnockoutStageConfig> = {
  "dezesseis-avos": {
    stages: ["dezesseis-avos"],
    title: "16 avos de final",
    // Gate A6: 16 avos abre só quando os jogos REAIS da fase de grupos terminam
    // (confrontos do mata-mata dependem dos classificados). Sem prevSlug pois
    // grupos não é uma fase de chave (sem nav prev/next de mata-mata).
    prevStage: "grupos",
    nextSlug: "oitavas",
  },
  oitavas: {
    stages: ["oitavas"],
    title: "Oitavas de final",
    prevSlug: "dezesseis-avos",
    prevStage: "dezesseis-avos",
    nextSlug: "quartas",
  },
  quartas: {
    stages: ["quartas"],
    title: "Quartas de final",
    prevSlug: "oitavas",
    prevStage: "oitavas",
    nextSlug: "semifinal",
  },
  semifinal: {
    stages: ["semifinal"],
    title: "Semifinais",
    prevSlug: "quartas",
    prevStage: "quartas",
    nextSlug: "final",
  },
  final: {
    stages: ["final", "terceiro"],
    title: "Final e 3º lugar",
    sectionTitle: "Final",
    prevSlug: "semifinal",
    prevStage: "semifinal",
  },
};

const STAGE_LABEL: Record<KnockoutSlug, string> = {
  "dezesseis-avos": "16 avos",
  oitavas: "Oitavas",
  quartas: "Quartas",
  semifinal: "Semifinais",
  final: "Final",
};

function isKnockoutSlug(value: string): value is KnockoutSlug {
  return value in KNOCKOUT_CONFIG;
}

const TOAST_BY_TONE = {
  success: toast.success,
  warning: toast.warning,
  error: toast.error,
  info: toast.info,
} as const;

interface ChavePageProps {
  params: Promise<{ stage: string }>;
}

export default function ChavePage({ params }: ChavePageProps) {
  const { stage } = use(params);
  if (!isKnockoutSlug(stage)) {
    notFound();
  }

  return <KnockoutPhase slug={stage} />;
}

function KnockoutPhase({ slug }: { slug: KnockoutSlug }) {
  const config = KNOCKOUT_CONFIG[slug];

  const { firebaseUser } = useAuth();
  const uid = firebaseUser?.uid ?? null;

  // Lista completa para a regra de bloqueio (fase anterior) + fixtures de cada stage.
  const matchesQuery = useMatches();
  const teamsQuery = useTeams();
  const predictionsQuery = usePredictions(uid);
  const draft = usePredictionDraft(uid ?? "");
  const batch = useUpsertPredictionsBatch(uid ?? "");

  // Buffer de edição ao vivo (matchId → placar parcial). Fonte que controla o
  // input: precisa guardar um lado só (o outro `null`) enquanto o usuário digita.
  // Sem ele, um confronto vazio nunca aceita o primeiro dígito (par incompleto
  // não persiste no draft → input reverte). Mesmo padrão de useGroupPredictions.
  const [edits, setEdits] = useState<
    Record<string, { homeScore: number | null; awayScore: number | null }>
  >({});

  const isLoading =
    uid === null ||
    matchesQuery.isLoading ||
    teamsQuery.isLoading ||
    predictionsQuery.isLoading;
  const isError =
    matchesQuery.isError || teamsQuery.isError || predictionsQuery.isError;

  const allMatches = useMemo<MatchWithId[]>(
    () => matchesQuery.data ?? [],
    [matchesQuery.data],
  );

  const teamMap = useMemo(
    () => buildTeamMap(teamsQuery.data ?? []),
    [teamsQuery.data],
  );
  const resolveTeamName = useCallback(
    (teamId: string) => resolveTeam(teamId, teamMap),
    [teamMap],
  );

  // Partidas desta fase (uma ou duas stages — final + terceiro).
  const phaseMatches = useMemo<MatchWithId[]>(
    () => allMatches.filter((m) => config.stages.includes(m.stage)),
    [allMatches, config.stages],
  );

  // Estrutura de chave por stage, montando as seções na ordem do config.
  const bracket = useMemo(
    () => buildBracketFromFixtures(phaseMatches),
    [phaseMatches],
  );

  const sections = useMemo<KnockoutSection[]>(() => {
    return config.stages
      .map((stage, index) => ({
        title: index === 0 ? config.sectionTitle : "Disputa de 3º lugar",
        matchups: bracket[stage] ?? [],
      }))
      .filter((section) => section.matchups.length > 0);
  }, [bracket, config.stages, config.sectionTitle]);

  // Placar atual por matchId. Prioridade: edição ao vivo (parcial) > draft > salvo.
  const scores = useMemo<BracketScores>(() => {
    const savedByMatchId = new Map(
      (predictionsQuery.data ?? []).map((p) => [p.matchId, p]),
    );
    const result: BracketScores = {};
    for (const match of phaseMatches) {
      const editVal = edits[match.id];
      if (editVal) {
        result[match.id] = { home: editVal.homeScore, away: editVal.awayScore };
        continue;
      }
      const draftVal = draft.allDrafts[match.id];
      const saved = savedByMatchId.get(match.id);
      const current = draftVal ?? saved;
      if (current) {
        result[match.id] = {
          home: current.homeScore,
          away: current.awayScore,
        };
      }
    }
    return result;
  }, [phaseMatches, predictionsQuery.data, draft.allDrafts, edits]);

  // matchIds bloqueados por kickoff.
  const lockedMatchIds = useMemo<ReadonlySet<string>>(() => {
    const now = new Date();
    return new Set(
      phaseMatches.filter((m) => isPredictionLocked(m, now)).map((m) => m.id),
    );
  }, [phaseMatches]);

  // Bloqueio A6: os jogos REAIS da fase anterior precisam ter terminado
  // (só então os confrontos reais desta fase são conhecidos). Fail-open quando
  // ainda não há fixtures da anterior (dados não carregados → isLoading cobre).
  const isBlocked = useMemo(() => {
    if (!config.prevStage) return false;
    const prevMatches = allMatches.filter((m) => m.stage === config.prevStage);
    if (prevMatches.length === 0) return false;
    return !prevMatches.every((m) => m.status === "finished");
  }, [config.prevStage, allMatches]);

  const hasSavable = useMemo(
    () =>
      phaseMatches.some((m) => {
        if (lockedMatchIds.has(m.id)) return false;
        const s = scores[m.id];
        return s !== undefined && s.home !== null && s.away !== null;
      }),
    [phaseMatches, lockedMatchIds, scores],
  );

  // Edição ao vivo guarda parcial (um lado só); par completo também vai p/ draft.
  const handleScoreChange = useCallback(
    (matchId: string, home: number | null, away: number | null) => {
      setEdits((prev) => ({
        ...prev,
        [matchId]: { homeScore: home, awayScore: away },
      }));
      if (home !== null && away !== null) {
        draft.setDraft(matchId, { homeScore: home, awayScore: away });
      }
    },
    [draft],
  );

  const handleSave = useCallback(() => {
    const payload: UpsertPredictionInput[] = phaseMatches
      .filter((m) => {
        if (lockedMatchIds.has(m.id)) return false;
        const s = scores[m.id];
        return s !== undefined && s.home !== null && s.away !== null;
      })
      .map((m) => {
        const s = scores[m.id]!;
        return { matchId: m.id, homeScore: s.home!, awayScore: s.away! };
      });

    if (payload.length === 0) {
      toast.info("Preencha ao menos um confronto para salvar.");
      return;
    }

    batch.mutate(payload, {
      onSuccess: (result) => {
        const feedback = buildSaveFeedback(result);
        TOAST_BY_TONE[feedback.tone](feedback.message);
      },
      onError: (error) => {
        toast.error(error.message);
      },
    });
  }, [phaseMatches, lockedMatchIds, scores, batch]);

  const refetch = useCallback(() => {
    void matchesQuery.refetch();
    void teamsQuery.refetch();
    void predictionsQuery.refetch();
  }, [matchesQuery, teamsQuery, predictionsQuery]);

  const prev = config.prevSlug
    ? {
        href: `/predictions/knockout/${config.prevSlug}`,
        label: STAGE_LABEL[config.prevSlug],
      }
    : undefined;
  const next = config.nextSlug
    ? {
        href: `/predictions/knockout/${config.nextSlug}`,
        label: STAGE_LABEL[config.nextSlug],
      }
    : undefined;

  return (
    <div className="palpites-theme mx-auto flex max-w-3xl flex-col gap-6 pb-20 md:pb-4">
      <BackButton />
      <KnockoutPhaseScreen
        phaseTitle={config.title}
        sections={sections}
        scores={scores}
        lockedMatchIds={lockedMatchIds}
        resolveTeamName={resolveTeamName}
        onScoreChange={handleScoreChange}
        onSave={handleSave}
        onRetry={refetch}
        isLoading={isLoading}
        isError={isError}
        isSaving={batch.isPending}
        isBlocked={isBlocked}
        hasSavable={hasSavable}
        prev={prev}
        next={next}
      />
    </div>
  );
}
