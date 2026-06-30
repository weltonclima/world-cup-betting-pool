"use client";

/**
 * BracketView — chaveamento das eliminatórias (PRD-16 · TASK-09).
 *
 * Dois layouts responsivos sobre a MESMA query (useBracket):
 *
 * - Desktop (lg+): colunas por fase (16-avos → Final) lado a lado, com scroll
 *   horizontal. Conectores SVG reais entre colunas adjacentes (parentMatchIds).
 * - Mobile (< lg): abas por fase. Cada aba mostra a fase atual + a próxima
 *   (scroll horizontal). A próxima fase aparece em opacity-60 como peek-ahead.
 *   A Disputa do 3º lugar vive dentro da aba Final.
 *
 * Conectores: desenhados por ConnectorLayer (SVG absolute, aria-hidden).
 * Dependem de parentMatchIds (TASK-08). Ausente → sem conector, sem erro.
 */

import { useEffect, useRef, useState } from "react";

import { cn } from "@/lib/utils";
import { useBracket } from "@/features/worldcup/hooks/useBracket";
import { buildTreeOrder } from "@/features/worldcup/lib/knockoutHelpers";
import { Tabs, TabsList, TabsTab, TabsPanel } from "@/components/ui/tabs";
import type { BracketResponse, KnockoutMatch } from "@/types/worldcup";

import { KnockoutMatchCard } from "./KnockoutMatchCard";
import { WorldcupEmptyState } from "./WorldcupEmptyState";
import { WorldcupErrorState } from "./WorldcupErrorState";
import { WorldcupSkeleton } from "./WorldcupSkeleton";

// ---------------------------------------------------------------------------
// Configuração das fases (ordem oficial de progressão)
// ---------------------------------------------------------------------------

interface PhaseConfig {
  key: keyof BracketResponse;
  /** Rótulo completo (coluna / heading). */
  label: string;
  /** Rótulo curto (aba no mobile — precisa caber em grid de 5 colunas). */
  short: string;
}

/** Fases que compõem a progressão (3º lugar fica fora — sem avanço). */
const BRACKET_PHASES: PhaseConfig[] = [
  { key: "roundOf32", label: "16-avos", short: "16-avos" },
  { key: "roundOf16", label: "Oitavas", short: "Oitavas" },
  { key: "quarterFinals", label: "Quartas", short: "Quartas" },
  { key: "semiFinals", label: "Semifinais", short: "Semis" },
  { key: "final", label: "Final", short: "Final" },
];

const THIRD_PLACE: PhaseConfig = {
  key: "thirdPlace",
  label: "Disputa do 3º Lugar",
  short: "3º Lugar",
};

// ---------------------------------------------------------------------------
// ConnectorLayer — SVG de conectores H-bracket entre colunas adjacentes
// ---------------------------------------------------------------------------

/**
 * Sobrepõe um SVG absolutamente posicionado sobre o PhaseTree container.
 * Para cada match em rightMatches com parentMatchIds, desenha um conector
 * no formato H-bracket (⊣) ligando os dois cards-pai ao card-filho.
 *
 * Posicionamento via getBoundingClientRect relativo ao container.
 * ResizeObserver re-mede ao redimensionar.
 * aria-hidden: conectores são puramente decorativos.
 */
function ConnectorLayer({
  containerRef,
  leftMatches,
  rightMatches,
}: {
  containerRef: React.RefObject<HTMLDivElement | null>;
  leftMatches: KnockoutMatch[];
  rightMatches: KnockoutMatch[];
}) {
  const [paths, setPaths] = useState<string[]>([]);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const measure = () => {
      const containerRect = container.getBoundingClientRect();
      const newPaths: string[] = [];

      for (const child of rightMatches) {
        if (!child.parentMatchIds) continue;
        const [idA, idB] = child.parentMatchIds;
        if (!idA || !idB) continue;

        const elA = container.querySelector(`[data-match-id="${idA}"]`);
        const elB = container.querySelector(`[data-match-id="${idB}"]`);
        const elChild = container.querySelector(`[data-match-id="${child.id}"]`);
        if (!elA || !elB || !elChild) continue;

        const rA = elA.getBoundingClientRect();
        const rB = elB.getBoundingClientRect();
        const rC = elChild.getBoundingClientRect();

        // Coordenadas relativas ao container. xA/xB são as bordas direitas de
        // cada pai (idênticas hoje — mesma coluna w-full — mas explícitas para
        // não quebrar se um card ganhar largura própria no futuro).
        const xA = rA.right - containerRect.left;
        const xB = rB.right - containerRect.left;
        const x2 = rC.left - containerRect.left;
        const xMid = (xA + x2) / 2;
        const yA = rA.top + rA.height / 2 - containerRect.top;
        const yB = rB.top + rB.height / 2 - containerRect.top;
        const yC = rC.top + rC.height / 2 - containerRect.top;

        // H-bracket: traço horizontal dos pais ao ponto médio do gap,
        // traço vertical unindo-os, traço horizontal ao filho.
        newPaths.push(
          `M ${xA} ${yA} H ${xMid} V ${yB} H ${xB}`,
          `M ${xMid} ${yC} H ${x2}`,
        );
      }

      setPaths(newPaths);
      setReady(true);
    };

    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(container);
    return () => ro.disconnect();
  }, [containerRef, leftMatches, rightMatches]);

  if (paths.length === 0 && ready) return null;

  return (
    <svg
      aria-hidden="true"
      data-testid="bracket-connector"
      className={cn(
        "pointer-events-none absolute inset-0 overflow-visible",
        "text-border transition-opacity duration-150 ease-out motion-reduce:transition-none",
        ready ? "opacity-100" : "opacity-0",
      )}
    >
      {paths.map((d, i) => (
        <path
          key={i}
          d={d}
          fill="none"
          stroke="currentColor"
          strokeWidth="1.5"
          strokeLinecap="round"
        />
      ))}
    </svg>
  );
}

// ---------------------------------------------------------------------------
// Coluna de uma fase (lista de confrontos reais)
// ---------------------------------------------------------------------------

function gameCountLabel(n: number): string {
  return n === 1 ? "1 jogo" : `${n} jogos`;
}

function PhaseColumn({
  label,
  matches,
}: {
  label: string;
  /** Já em ordem de chave (buildTreeOrder) quando há mais de uma coluna. */
  matches: KnockoutMatch[];
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

      {/* justify-around: distribui os jogos pela altura da coluna mais densa.
          Cada fase tem metade dos jogos da anterior → o filho cai no meio
          vertical dos seus dois pais adjacentes, formando a árvore. */}
      <div className="flex flex-1 flex-col justify-around gap-2">
        {matches.map((match) => (
          <KnockoutMatchCard
            key={match.id}
            match={match}
            variant="compact"
            className="w-full"
          />
        ))}
      </div>
    </section>
  );
}

// ---------------------------------------------------------------------------
// Linha horizontal de colunas de fase + conectores
// ---------------------------------------------------------------------------

function PhaseTree({
  phases,
  data,
  showConnectors = false,
}: {
  phases: PhaseConfig[];
  data: BracketResponse;
  showConnectors?: boolean;
}) {
  const containerRef = useRef<HTMLDivElement>(null);

  // Ordem de chave: pais adjacentes ao filho (buildTreeOrder). Para coluna única
  // é a própria lista; para 2+ fases vira a árvore alinhada.
  const orderedMatches = buildTreeOrder(
    phases.map((p) => ({ matches: data[p.key] })),
  );

  return (
    <div ref={containerRef} className="relative flex min-w-max items-stretch gap-6 pb-2">
      {phases.map((phase, i) => (
        <PhaseColumn
          key={phase.key}
          label={phase.label}
          matches={orderedMatches[i] ?? data[phase.key]}
        />
      ))}

      {showConnectors &&
        phases.slice(1).map((rightPhase, i) => (
          <ConnectorLayer
            key={`${phases[i]!.key}->${rightPhase.key}`}
            containerRef={containerRef}
            leftMatches={orderedMatches[i] ?? data[phases[i]!.key]}
            rightMatches={orderedMatches[i + 1] ?? data[rightPhase.key]}
          />
        ))}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Disputa do 3º lugar (fora da árvore — sem progressão)
// ---------------------------------------------------------------------------

function ThirdPlaceSection({ matches }: { matches: KnockoutMatch[] }) {
  if (matches.length === 0) return null;

  return (
    <section aria-label={THIRD_PLACE.label} className="flex flex-col gap-2">
      <h2 className="text-sm font-semibold text-foreground">
        {THIRD_PLACE.label}
        <span className="ml-1.5 font-normal text-muted-foreground">
          · {gameCountLabel(matches.length)}
        </span>
      </h2>
      <div className="w-[150px]">
        {matches.map((match) => (
          <KnockoutMatchCard key={match.id} match={match} variant="compact" />
        ))}
      </div>
    </section>
  );
}

// ---------------------------------------------------------------------------
// Seleção da aba inicial (mobile): fase ao vivo → 1ª não-encerrada → última
// ---------------------------------------------------------------------------

function pickDefaultPhaseKey(
  phases: PhaseConfig[],
  data: BracketResponse,
): string {
  const live = phases.find((p) =>
    data[p.key].some((m) => m.status === "em-andamento"),
  );
  const upcoming = phases.find((p) =>
    data[p.key].some((m) => m.status !== "encerrado"),
  );
  const last = phases[phases.length - 1];
  return (live ?? upcoming ?? last)?.key ?? BRACKET_PHASES[0]!.key;
}

// ---------------------------------------------------------------------------
// Componente principal
// ---------------------------------------------------------------------------

/**
 * Tela de eliminatórias: árvore de colunas no desktop, abas por fase no mobile.
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

  // 4. Apenas fases com jogos.
  const renderedPhases = BRACKET_PHASES.filter((p) => data[p.key].length > 0);
  const thirdPlaceMatches = data[THIRD_PLACE.key];
  const defaultPhaseKey = pickDefaultPhaseKey(renderedPhases, data);
  const lastPhaseKey = renderedPhases[renderedPhases.length - 1]?.key;

  return (
    <div className="flex flex-col gap-6">
      {/* ───────── Desktop: todas as colunas por fase com conectores ───────── */}
      <div data-testid="bracket-desktop" className="hidden lg:flex lg:flex-col lg:gap-6">
        <div className="-mx-4 overflow-x-auto overscroll-x-contain scroll-smooth px-4">
          <PhaseTree phases={renderedPhases} data={data} showConnectors />
        </div>
        <ThirdPlaceSection matches={thirdPlaceMatches} />
      </div>

      {/* ───────── Mobile: abas por fase com fase+próxima ───────── */}
      <div data-testid="bracket-mobile" className="lg:hidden">
        {/* Edge: só a Disputa do 3º lugar tem jogos (nenhuma fase de progressão).
            Sem abas onde ancorá-la → renderiza direto, fora das tabs. */}
        {renderedPhases.length === 0 ? (
          <ThirdPlaceSection matches={thirdPlaceMatches} />
        ) : (
          <Tabs defaultValue={defaultPhaseKey}>
            <TabsList className="grid w-full grid-cols-5">
              {renderedPhases.map((phase) => (
                <TabsTab key={phase.key} value={phase.key} className="min-h-11 text-xs">
                  {phase.short}
                </TabsTab>
              ))}
            </TabsList>

            {renderedPhases.map((phase, phaseIdx) => {
              const isLast = phase.key === lastPhaseKey;
              const nextPhase = renderedPhases[phaseIdx + 1];
              const tabPhases = [phase, nextPhase].filter(
                (p): p is PhaseConfig => p !== undefined,
              );

              return (
                <TabsPanel key={phase.key} value={phase.key} keepMounted>
                  <div className="-mx-4 overflow-x-auto overscroll-x-contain scroll-smooth px-4">
                    <PhaseTree phases={tabPhases} data={data} showConnectors />
                  </div>
                  {/* 3º lugar vive na aba Final (última fase com jogos). */}
                  {isLast && (
                    <div className="mt-6">
                      <ThirdPlaceSection matches={thirdPlaceMatches} />
                    </div>
                  )}
                </TabsPanel>
              );
            })}
          </Tabs>
        )}
      </div>
    </div>
  );
}
