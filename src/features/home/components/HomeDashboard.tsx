"use client";

/**
 * HomeDashboard — componente principal da tela /home (TASK-10).
 *
 * Chama useHomeDashboard (compositor TASK-05) e renderiza:
 *   - loading  → skeletons por card (sem layout shift)
 *   - error    → estado de erro de página com "Tentar Novamente"
 *   - sucesso  → HomeHeader + grade responsiva de 8 cards
 *
 * Decisão de design: erro em nível de página (não por card individual),
 * pois useHomeDashboard expõe isError/refetch agregados. Documentado em
 * ai/spec/home-dashboard-task-10.md §3.1 como emenda ao §5.3 do contrato visual.
 *
 * Contrato visual: ai/screen/home-dashboard-task-06.md
 */

import { AlertCircle } from "lucide-react";

import { Button } from "@/components/ui/button";
import { useAuth } from "@/hooks/useAuth";

import { useHomeDashboard } from "@/features/home/hooks/useHomeDashboard";

import { HeroCard, HeroCardSkeleton } from "./HeroCard";
import { HomeHeader } from "./HomeHeader";
import { LastResultsCard, LastResultsCardSkeleton } from "./LastResultsCard";
import { NextMatchCard, NextMatchCardSkeleton } from "./NextMatchCard";
import { OpenMatchesCard, OpenMatchesCardSkeleton } from "./OpenMatchesCard";
import { RaioXCard, RaioXCardSkeleton } from "./RaioXCard";

// ---------------------------------------------------------------------------
// Subcomponente interno: estado de erro de página
// ---------------------------------------------------------------------------

interface ErrorStateProps {
  /** Callback para re-executar todas as queries via refetch agregado. */
  onRetry: () => void;
}

/**
 * Estado de erro em nível de página.
 * aria-live="polite" anuncia ao leitor de tela quando o erro aparece.
 */
function ErrorState({ onRetry }: ErrorStateProps) {
  return (
    <div
      role="alert"
      aria-live="polite"
      className="flex flex-col items-center gap-4 py-12 px-4"
    >
      <AlertCircle
        size={40}
        className="text-destructive"
        aria-hidden="true"
      />
      <p className="text-base font-semibold text-foreground text-center">
        Erro ao carregar dashboard
      </p>
      <p className="text-sm text-muted-foreground text-center">
        Não foi possível carregar os dados. Tente novamente.
      </p>
      <Button
        variant="outline"
        size="sm"
        onClick={onRetry}
        className="min-h-[44px]"
      >
        Tentar Novamente
      </Button>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Subcomponente interno: skeleton do HomeHeader (§4.3 da spec)
// ---------------------------------------------------------------------------

/**
 * Skeleton do bloco de boas-vindas (HomeHeader) durante loading.
 * Dimensões espelham o componente real (size-12 avatar + 2 linhas de texto).
 */
function HomeHeaderSkeleton() {
  return (
    <div
      data-testid="home-header-skeleton"
      className="mb-6 flex items-center gap-3"
      aria-hidden="true"
    >
      <div className="size-12 rounded-full bg-muted animate-pulse motion-reduce:animate-none shrink-0" />
      <div className="flex flex-col gap-2 flex-1">
        <div className="h-5 w-2/5 rounded bg-muted animate-pulse motion-reduce:animate-none" />
        <div className="h-4 w-1/3 rounded bg-muted animate-pulse motion-reduce:animate-none" />
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Componente principal
// ---------------------------------------------------------------------------

/**
 * Composição da Home Dashboard.
 *
 * Renderiza dentro do AppShell (<main> com px-4 py-4 pb-20 max-w-4xl; offset do header fixo via pt-20 no wrapper).
 * Não cria wrapper próprio — usa flex-col gap-4 conforme o contrato visual §1.2.
 */
export function HomeDashboard() {
  // Lê profile para o HomeHeader (nome e uid)
  const { profile, firebaseUser } = useAuth();

  // Dados e estado agregado do compositor
  const {
    heroSummary,
    predictionBreakdown,
    nextMatch,
    recentResults,
    openMatches,
    notices,
    isLoading,
    isError,
    refetch,
  } = useHomeDashboard();

  // ── Estado de erro de página ─────────────────────────────────────────────
  // Exibido apenas quando isError=true e isLoading=false.
  // Enquanto há loading, mostramos skeletons (melhor UX que erro imediato).
  if (isError && !isLoading) {
    return <ErrorState onRetry={refetch} />;
  }

  // ── Grade de conteúdo (loading com skeletons OU dados reais) ─────────────
  return (
    <div className="flex flex-col gap-4">

      {/* Bloco de boas-vindas — skeleton durante loading */}
      {isLoading ? (
        <HomeHeaderSkeleton />
      ) : (
        <HomeHeader
          name={profile?.name ?? null}
          uid={firebaseUser?.uid ?? null}
          avatarUrl={profile?.avatarUrl ?? null}
        />
      )}

      {/* Hero — posição + tendência + aproveitamento + sparkline + régua (TASK-01 home-revamp) */}
      {isLoading ? (
        <HeroCardSkeleton />
      ) : (
        <HeroCard summary={heroSummary} />
      )}

      {/* Próximo Jogo — card full-width */}
      {isLoading ? (
        <NextMatchCardSkeleton />
      ) : (
        <NextMatchCard
          nextMatch={nextMatch}
          ctaHref={nextMatch?.predictionsHref}
        />
      )}

      {/* Jogos abertos pra palpitar — card full-width (lista + faixa de avisos) */}
      {isLoading ? (
        <OpenMatchesCardSkeleton />
      ) : (
        <OpenMatchesCard openMatches={openMatches} notices={notices} />
      )}

      {/* Últimos Resultados — card full-width (lista até 5 itens) */}
      {isLoading ? (
        <LastResultsCardSkeleton />
      ) : (
        <LastResultsCard results={recentResults} />
      )}

      {/* Raio-X dos Palpites — card full-width (donut exato/vencedor/erro) */}
      {isLoading ? (
        <RaioXCardSkeleton />
      ) : (
        <RaioXCard breakdown={predictionBreakdown} />
      )}

    </div>
  );
}
