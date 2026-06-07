"use client";

/**
 * PredictionForm — componente principal da tela de palpite (TASK-07).
 *
 * Orquestra todos os estados da rota /matches/[id]/predict:
 *  - loading  → PredictionFormSkeleton
 *  - error    → MatchLoadError (onRetry)
 *  - 404      → PredictionMatchNotFound
 *  - locked   → PredictionLockedState
 *  - form     → formulário ativo (create | edit)
 *  - success  → PredictionSuccess
 *
 * Lógica de dados:
 *  - useMatchDetail(id) → dados da partida + times resolvidos
 *  - usePredictions(uid) → pré-preencher em modo edit
 *  - useUpsertPrediction(uid) → mutação de salvar
 *  - isPredictionLocked(match, now) → guard de bloqueio
 *
 * Ref visual: PRD04-03/04/05/06 | Contrato: ai/screen/palpites-task-07.md
 */

import { useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import Link from "next/link";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { AlertCircle, ArrowLeft, Calendar, MapPin } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Form, FormField, FormItem, FormMessage } from "@/components/ui/form";
import { useAuth } from "@/hooks/useAuth";
import { useMatchDetail } from "@/features/matches/hooks/useMatchDetail";
import type { MatchDetailItem } from "@/features/matches/hooks/useMatchDetail";
import type { ResolvedTeam } from "@/features/matches/lib/matchesHelpers";
import { isPredictionLocked } from "@/features/predictions/lib";
import { usePredictions, useUpsertPrediction } from "@/features/predictions/hooks";
import {
  predictionFormSchema,
  type PredictionFormValues,
} from "@/schemas/predictions";

import { PredictionLockedState } from "./PredictionLockedState";
import { PredictionSuccess } from "./PredictionSuccess";
import { ScoreInput } from "./ScoreInput";

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

export interface PredictionFormProps {
  matchId: string;
}

// ---------------------------------------------------------------------------
// Subcomponente: TeamFlag
// ---------------------------------------------------------------------------

function TeamFlag({ team }: { team: ResolvedTeam }) {
  if (team.flagUrl) {
    return (
      <img
        src={team.flagUrl}
        alt={team.name}
        width={64}
        height={44}
        loading="lazy"
        decoding="async"
        className="w-16 h-11 rounded object-contain"
      />
    );
  }

  const initials = team.name
    .split(" ")
    .map((w) => w[0])
    .join("")
    .slice(0, 3)
    .toUpperCase();

  return (
    <span
      aria-label={team.name}
      className="w-16 h-11 flex items-center justify-center rounded bg-muted text-sm font-bold text-muted-foreground"
    >
      {initials}
    </span>
  );
}

// ---------------------------------------------------------------------------
// Subcomponente: MatchHeader
// ---------------------------------------------------------------------------

function MatchHeader({ match }: { match: MatchDetailItem }) {
  const kickoffDate = new Date(match.kickoffAt);
  const dateStr = format(kickoffDate, "dd/MM/yyyy", { locale: ptBR });
  const timeStr = format(kickoffDate, "HH:mm");

  return (
    <div className="rounded-xl border border-border bg-card shadow-sm p-4 flex flex-col gap-3">
      {/* Times */}
      <div className="flex items-center justify-around gap-4">
        {/* Mandante */}
        <div className="flex flex-col items-center gap-2 flex-1">
          <TeamFlag team={match.homeTeam} />
          <span className="text-sm font-medium text-foreground text-center">
            {match.homeTeam.name}
          </span>
        </div>

        <span
          className="text-xl font-bold text-muted-foreground"
          aria-label="versus"
        >
          ×
        </span>

        {/* Visitante */}
        <div className="flex flex-col items-center gap-2 flex-1">
          <TeamFlag team={match.awayTeam} />
          <span className="text-sm font-medium text-foreground text-center">
            {match.awayTeam.name}
          </span>
        </div>
      </div>

      {/* Detalhes */}
      <div className="flex flex-col gap-1 text-xs text-muted-foreground">
        <span className="flex items-center gap-1">
          <Calendar size={12} aria-hidden="true" />
          {dateStr} - {timeStr}
        </span>
        {match.venue && (
          <span className="flex items-center gap-1">
            <MapPin size={12} aria-hidden="true" />
            {match.venue.name}, {match.venue.city}
          </span>
        )}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Subcomponente: Skeleton de loading
// ---------------------------------------------------------------------------

function PredictionFormSkeleton() {
  return (
    <div
      role="status"
      aria-busy="true"
      aria-label="Carregando formulário de palpite"
      className="flex flex-col gap-4 px-4 py-4 max-w-2xl mx-auto"
    >
      <div
        aria-hidden="true"
        className="h-4 w-16 rounded bg-muted animate-pulse motion-reduce:animate-none"
      />
      <div
        aria-hidden="true"
        className="h-6 w-48 rounded bg-muted animate-pulse motion-reduce:animate-none"
      />
      <div
        aria-hidden="true"
        className="h-24 w-full rounded-xl bg-muted animate-pulse motion-reduce:animate-none"
      />
      <div
        aria-hidden="true"
        className="h-16 w-full rounded-xl bg-muted animate-pulse motion-reduce:animate-none"
      />
      <div
        aria-hidden="true"
        className="h-11 w-full rounded-lg bg-muted animate-pulse motion-reduce:animate-none"
      />
    </div>
  );
}

// ---------------------------------------------------------------------------
// Subcomponente: Estado de erro
// ---------------------------------------------------------------------------

function MatchLoadError({ onRetry }: { onRetry: () => void }) {
  return (
    <div className="flex flex-col items-center justify-center py-12 gap-4 text-center px-4 max-w-2xl mx-auto">
      <AlertCircle size={40} aria-hidden="true" className="text-destructive" />
      <p className="text-sm font-medium text-foreground">
        Erro ao carregar o jogo
      </p>
      <Button
        variant="outline"
        size="sm"
        onClick={onRetry}
        className="min-h-[44px] px-6"
        aria-label="Tentar novamente"
      >
        Tentar novamente
      </Button>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Subcomponente: 404
// ---------------------------------------------------------------------------

function PredictionMatchNotFound() {
  return (
    <div
      role="status"
      className="flex flex-col items-center justify-center py-16 gap-4 text-center px-4 max-w-2xl mx-auto"
    >
      <p className="text-lg font-semibold text-foreground">
        Jogo não encontrado
      </p>
      <p className="text-sm text-muted-foreground">
        Não foi possível encontrar este jogo.
      </p>
      <Link
        href="/matches"
        className="inline-flex items-center gap-2 min-h-[44px] px-6 rounded-lg border border-border bg-background hover:bg-muted text-sm font-medium text-foreground transition-colors duration-150 motion-reduce:transition-none focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
      >
        <ArrowLeft size={16} aria-hidden="true" />
        Voltar para Jogos
      </Link>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Componente principal
// ---------------------------------------------------------------------------

export function PredictionForm({ matchId }: PredictionFormProps) {
  const { firebaseUser } = useAuth();
  const uid = firebaseUser?.uid ?? null;

  // Dados da partida (inclui resolução de times + predictionStatus)
  const { match, isLoading, isError, refetch } = useMatchDetail(matchId);

  // Palpites do usuário (para pré-preenchimento em modo edit)
  const { data: predictions } = usePredictions(uid);
  const existingPrediction = predictions?.find((p) => p.matchId === matchId);

  // Mutação de upsert
  const mutation = useUpsertPrediction(uid ?? "");

  // Estado local: "form" | "success"
  const [formState, setFormState] = useState<"form" | "success">("form");

  // React Hook Form + Zod
  const form = useForm<PredictionFormValues>({
    resolver: zodResolver(predictionFormSchema),
    defaultValues: { homeScore: 0, awayScore: 0 },
  });

  // Pré-preencher quando existingPrediction carrega (modo edit)
  useEffect(() => {
    if (existingPrediction) {
      form.reset({
        homeScore: existingPrediction.homeScore,
        awayScore: existingPrediction.awayScore,
      });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [existingPrediction?.homeScore, existingPrediction?.awayScore]);

  // Estado: loading
  if (isLoading) {
    return <PredictionFormSkeleton />;
  }

  // Estado: error
  if (isError) {
    return <MatchLoadError onRetry={refetch} />;
  }

  // Estado: 404
  if (match === null) {
    return <PredictionMatchNotFound />;
  }

  // Guard de bloqueio (derivado no render)
  const locked = isPredictionLocked(match, new Date());
  if (locked) {
    return (
      <PredictionLockedState match={match} prediction={existingPrediction} />
    );
  }

  // Estado: sucesso
  if (formState === "success") {
    return (
      <PredictionSuccess
        match={match}
        homeScore={form.getValues("homeScore")}
        awayScore={form.getValues("awayScore")}
      />
    );
  }

  // Estado: form ativo (create | edit)
  const isEditMode = existingPrediction !== undefined;

  const onSubmit = async (values: PredictionFormValues) => {
    if (uid === null) return;
    await mutation.mutateAsync({
      matchId,
      homeScore: values.homeScore,
      awayScore: values.awayScore,
    });
    setFormState("success");
  };

  return (
    <div className="flex flex-col gap-6 px-4 py-4 pb-20 max-w-2xl mx-auto md:pb-4">

      {/* Botão voltar */}
      <Link
        href={`/matches/${matchId}`}
        aria-label="Voltar para detalhes do jogo"
        className="inline-flex items-center gap-1 min-h-[44px] py-2 text-sm font-medium text-muted-foreground hover:text-foreground transition-colors duration-150 motion-reduce:transition-none focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 rounded-md"
      >
        <ArrowLeft size={18} aria-hidden="true" />
        <span>Voltar</span>
      </Link>

      {/* Título */}
      <h1 className="text-xl font-bold text-foreground">
        {isEditMode ? "Editar Palpite" : "Enviar Palpite"}
      </h1>

      {/* Header do jogo */}
      <MatchHeader match={match} />

      {/* Formulário */}
      <Form {...form}>
        <form
          onSubmit={form.handleSubmit(onSubmit)}
          noValidate
          className="flex flex-col gap-4"
        >
          {/* Label da seção de palpite */}
          <span className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
            Seu palpite
          </span>

          {/* Steppers lado a lado */}
          <div className="flex items-start justify-around gap-8 py-2">

            {/* Stepper Mandante */}
            <FormField
              control={form.control}
              name="homeScore"
              render={({ field }) => (
                <FormItem className="flex flex-col items-center gap-0 space-y-0">
                  <ScoreInput
                    label="Gols Mandante"
                    value={field.value}
                    onChange={field.onChange}
                    disabled={mutation.isPending}
                  />
                  <FormMessage />
                </FormItem>
              )}
            />

            {/* Separador × */}
            <span
              className="text-3xl font-bold text-muted-foreground mt-8"
              aria-hidden="true"
            >
              ×
            </span>

            {/* Stepper Visitante */}
            <FormField
              control={form.control}
              name="awayScore"
              render={({ field }) => (
                <FormItem className="flex flex-col items-center gap-0 space-y-0">
                  <ScoreInput
                    label="Gols Visitante"
                    value={field.value}
                    onChange={field.onChange}
                    disabled={mutation.isPending}
                  />
                  <FormMessage />
                </FormItem>
              )}
            />

          </div>

          {/* Aviso de edição (modo edit) */}
          {isEditMode && (
            <p className="text-sm text-muted-foreground text-center">
              Alterações são permitidas até o horário oficial de início do jogo.
            </p>
          )}

          {/* Botão submit */}
          <Button
            type="submit"
            disabled={mutation.isPending}
            aria-busy={mutation.isPending}
            className="w-full min-h-[44px] mt-2"
          >
            {mutation.isPending
              ? "Salvando..."
              : isEditMode
                ? "Atualizar palpite"
                : "Salvar palpite"}
          </Button>

        </form>
      </Form>

    </div>
  );
}
