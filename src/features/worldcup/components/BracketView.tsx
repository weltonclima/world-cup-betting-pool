"use client";

/**
 * BracketView — chaveamento das eliminatórias em árvore horizontal (PRD-16 TASK-04 v2).
 *
 * Layout: colunas por fase (16-avos → Final) lado a lado, com scroll horizontal
 * + snap por coluna no mobile e linhas conectoras tipo árvore entre as fases.
 * Tema do app (tokens shadcn, dark/light). Disputa do 3º lugar fica fora da
 * árvore (não tem progressão), renderizada abaixo.
 *
 * Estados de ciclo de vida: pending → error → vazio total → sucesso.
 */

import { useBracket } from "@/features/worldcup/hooks/useBracket";
import { cn } from "@/lib/utils";
import type { BracketResponse, KnockoutMatch } from "@/types/worldcup";

import { KnockoutMatchCard } from "./KnockoutMatchCard";
import { WorldcupEmptyState } from "./WorldcupEmptyState";
import { WorldcupErrorState } from "./WorldcupErrorState";
import { WorldcupSkeleton } from "./WorldcupSkeleton";

// ---------------------------------------------------------------------------
// Configuração das fases da árvore (ordem oficial de progressão)
// ---------------------------------------------------------------------------

interface PhaseConfig {
  key: keyof BracketResponse;
  label: string;
}

/** Fases que compõem a árvore de progressão (3º lugar fica fora — sem avanço). */
const BRACKET_PHASES: PhaseConfig[] = [
  { key: "roundOf32", label: "16-avos" },
  { key: "roundOf16", label: "Oitavas" },
  { key: "quarterFinals", label: "Quartas" },
  { key: "semiFinals", label: "Semifinais" },
  { key: "final", label: "Final" },
];

const THIRD_PLACE: PhaseConfig = { key: "thirdPlace", label: "Disputa do 3º Lugar" };

// ---------------------------------------------------------------------------
// Conectores (linhas tipo árvore, decorativos)
// ---------------------------------------------------------------------------

/**
 * Linhas conectoras de um slot de confronto.
 * - `hasNext`: existe próxima coluna → desenha saída à direita + junção do par.
 * - `hasPrev`: existe coluna anterior → desenha entrada à esquerda.
 * - `even`: posição par no par (topo) → linha vertical desce; ímpar (base) → sobe.
 */
function SlotConnectors({
  hasNext,
  hasPrev,
  even,
}: {
  hasNext: boolean;
  hasPrev: boolean;
  even: boolean;
}) {
  return (
    <>
      {hasPrev && (
        // Entrada: linha horizontal vindo da coluna anterior até o card.
        <span
          aria-hidden="true"
          className="pointer-events-none absolute left-0 top-1/2 h-px w-3 -translate-x-full -translate-y-1/2 bg-border"
        />
      )}
      {hasNext && (
        <>
          {/* Saída: linha horizontal do card até o vão da árvore. */}
          <span
            aria-hidden="true"
            className="pointer-events-none absolute right-0 top-1/2 h-px w-3 translate-x-full -translate-y-1/2 bg-border"
          />
          {/* Junção vertical do par: topo desce, base sobe (encontram no meio). */}
          <span
            aria-hidden="true"
            className={cn(
              "pointer-events-none absolute right-0 w-px translate-x-[calc(0.75rem+1px)] bg-border",
              even ? "top-1/2 bottom-0" : "top-0 bottom-1/2",
            )}
          />
        </>
      )}
    </>
  );
}

// ---------------------------------------------------------------------------
// Coluna de uma fase
// ---------------------------------------------------------------------------

function gameCountLabel(n: number): string {
  return n === 1 ? "1 jogo" : `${n} jogos`;
}

function PhaseColumn({
  label,
  matches,
  hasNext,
  hasPrev,
}: {
  label: string;
  matches: KnockoutMatch[];
  hasNext: boolean;
  hasPrev: boolean;
}) {
  return (
    <section
      aria-label={label}
      className="flex w-[44vw] max-w-[180px] shrink-0 flex-col sm:w-[150px]"
    >
      <h2 className="sticky top-0 z-10 mb-2 bg-background pb-1 text-center text-xs font-semibold text-foreground">
        {label}
        <span className="block font-normal text-muted-foreground">
          {gameCountLabel(matches.length)}
        </span>
      </h2>

      {/* Corpo: slots distribuídos verticalmente (flex-1) → alinham ao par da próxima fase. */}
      <div className="flex flex-1 flex-col gap-2">
        {matches.map((match, mi) => (
          <div
            key={match.id}
            className="relative flex flex-1 items-center"
          >
            <KnockoutMatchCard match={match} variant="compact" className="w-full" />
            <SlotConnectors
              hasNext={hasNext}
              hasPrev={hasPrev}
              even={mi % 2 === 0}
            />
          </div>
        ))}
      </div>
    </section>
  );
}

// ---------------------------------------------------------------------------
// Componente principal
// ---------------------------------------------------------------------------

/**
 * Tela de eliminatórias: árvore horizontal de fases + scroll/snap no mobile.
 * Trata todos os estados de ciclo de vida da query (pending/error/empty/ok).
 */
export function BracketView() {
  const { data, isPending, isError, refetch } = useBracket();

  // 1. Carregando
  if (isPending) {
    return <WorldcupSkeleton variant="bracket" />;
  }

  // 2. Erro
  if (isError) {
    return <WorldcupErrorState onRetry={() => void refetch()} />;
  }

  // 3. Sucesso mas todas as fases vazias
  const allKeys: (keyof BracketResponse)[] = [
    ...BRACKET_PHASES.map((p) => p.key),
    THIRD_PLACE.key,
  ];
  const hasAnyMatch = allKeys.some((key) => data[key].length > 0);
  if (!hasAnyMatch) {
    return <WorldcupEmptyState />;
  }

  // 4. Colunas da árvore: apenas fases com jogos (mantém geometria do par).
  const renderedPhases = BRACKET_PHASES.filter((p) => data[p.key].length > 0);
  const thirdPlaceMatches = data[THIRD_PLACE.key];

  return (
    <div className="flex flex-col gap-6">
      {/* Dica de scroll (só mobile/tablet — desktop mostra a árvore inteira) */}
      <p className="text-xs text-muted-foreground/70 lg:hidden">
        Deslize para o lado para ver todas as fases →
      </p>

      {/* Árvore horizontal — scroll livre estilo flatlist (momentum, sem snap) */}
      <div className="-mx-4 overflow-x-auto overscroll-x-contain scroll-smooth px-4">
        <div className="flex min-w-max items-stretch gap-6 pb-2">
          {renderedPhases.map((phase, ci) => (
            <PhaseColumn
              key={phase.key}
              label={phase.label}
              matches={data[phase.key]}
              hasPrev={ci > 0}
              hasNext={ci < renderedPhases.length - 1}
            />
          ))}
        </div>
      </div>

      {/* Disputa do 3º lugar — fora da árvore (sem progressão) */}
      {thirdPlaceMatches.length > 0 && (
        <section aria-label={THIRD_PLACE.label} className="flex flex-col gap-2">
          <h2 className="text-sm font-semibold text-foreground">
            {THIRD_PLACE.label}
            <span className="ml-1.5 font-normal text-muted-foreground">
              · {gameCountLabel(thirdPlaceMatches.length)}
            </span>
          </h2>
          <div className="w-[150px]">
            {thirdPlaceMatches.map((match) => (
              <KnockoutMatchCard key={match.id} match={match} variant="compact" />
            ))}
          </div>
        </section>
      )}
    </div>
  );
}
