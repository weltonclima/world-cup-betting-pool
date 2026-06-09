/**
 * GroupSelectionGrid — tela de seleção de grupo (TASK-08, PRD03-02).
 *
 * Componente APRESENTACIONAL e puro: recebe os resumos por grupo (progresso/
 * status) por props. Sem hooks de dados — a derivação acontece no page.tsx.
 * Grid responsivo 3 col (mobile) → 4 col (desktop) de GroupCard (TASK-06).
 *
 * Helper puro `buildGroupSummaries` (exportado): agrupa as partidas de fase de
 * grupos por groupId, cruza com os palpites do usuário e deriva fração/status.
 *
 * Contrato: ai/spec/palpites-massa-task-08.md · ai/screen/palpites-massa-task-08.md
 *
 * Tema: tokens apenas — herda o verde dentro de `.palpites-theme` (container da
 * rota). Neutro fora do escopo.
 */

import { Info } from "lucide-react";

import { cn } from "@/lib/utils";
import { buttonVariants } from "@/components/ui/button";
import type { MatchWithId, Prediction } from "@/types";

import { GroupCard } from "./GroupCard";
import type { FillStatus } from "./PhaseCard";

/** Resumo de preenchimento de um grupo, pronto para render. */
export interface GroupSummary {
  /** ID do grupo ("A".."L"). */
  groupId: string;
  /** Rótulo de exibição ("Grupo A"). */
  name: string;
  /** Total de partidas do grupo. */
  totalCount: number;
  /** Partidas com palpite preenchido. */
  filledCount: number;
  /** Status derivado de filled/total. */
  status: FillStatus;
  /** Destino ao tocar no card. */
  href: string;
}

/**
 * Deriva o resumo por grupo a partir das partidas e dos palpites do usuário.
 *
 * Considera apenas partidas com `stage === "grupos"` e `groupId` definido.
 * Ordena os grupos por `groupId` ASC (A → L) de forma estável.
 *
 * Função pura — testável sem React.
 */
export function buildGroupSummaries(
  matches: MatchWithId[],
  predictions: Prediction[],
): GroupSummary[] {
  const filledMatchIds = new Set<string>(predictions.map((p) => p.matchId));

  // Agrupa as partidas de grupo por groupId.
  const byGroup = new Map<string, { total: number; filled: number }>();
  for (const match of matches) {
    if (match.stage !== "grupos") continue;
    const groupId = match.groupId;
    if (!groupId) continue;

    const entry = byGroup.get(groupId) ?? { total: 0, filled: 0 };
    entry.total += 1;
    if (filledMatchIds.has(match.id)) entry.filled += 1;
    byGroup.set(groupId, entry);
  }

  const summaries: GroupSummary[] = [];
  for (const [groupId, counts] of byGroup) {
    let status: FillStatus;
    if (counts.total > 0 && counts.filled === counts.total) {
      status = "concluido";
    } else if (counts.filled > 0) {
      status = "andamento";
    } else {
      status = "nao-iniciado";
    }

    summaries.push({
      groupId,
      name: `Grupo ${groupId}`,
      totalCount: counts.total,
      filledCount: counts.filled,
      status,
      href: `/predictions/grupos/${groupId}`,
    });
  }

  // Ordenação estável por groupId ASC (A → L).
  summaries.sort((a, b) => a.groupId.localeCompare(b.groupId));
  return summaries;
}

export interface GroupSelectionGridProps {
  summaries: GroupSummary[];
  isLoading: boolean;
  isError: boolean;
  onRetry: () => void;
}

function GridSkeleton() {
  return (
    <div role="status" aria-live="polite">
      <span className="sr-only">Carregando grupos</span>
      <div
        className="grid grid-cols-3 gap-3 md:grid-cols-4"
        aria-hidden="true"
      >
        {Array.from({ length: 12 }, (_, i) => (
          <div
            key={i}
            className="h-16 rounded-xl bg-muted animate-pulse motion-reduce:animate-none"
          />
        ))}
      </div>
    </div>
  );
}

function GridError({ onRetry }: { onRetry: () => void }) {
  return (
    <div role="alert" className="flex flex-col items-start gap-3">
      <p className="text-sm text-destructive">
        Não foi possível carregar os grupos.
      </p>
      <button
        type="button"
        onClick={onRetry}
        className={cn(buttonVariants({ variant: "outline", size: "lg" }), "min-h-[44px]")}
      >
        Tentar novamente
      </button>
    </div>
  );
}

export function GroupSelectionGrid({
  summaries,
  isLoading,
  isError,
  onRetry,
}: GroupSelectionGridProps) {
  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col gap-1">
        <h1 className="text-2xl font-semibold text-foreground">Fase de Grupos</h1>
        <p className="text-sm text-muted-foreground">
          Escolha o grupo para palpitar todos os jogos de uma vez.
        </p>
      </div>

      {isError ? (
        <GridError onRetry={onRetry} />
      ) : isLoading ? (
        <GridSkeleton />
      ) : summaries.length === 0 ? (
        <p className="py-6 text-center text-sm text-muted-foreground">
          Os jogos da fase de grupos ainda não estão disponíveis.
        </p>
      ) : (
        <>
          <h2 className="text-sm font-medium text-foreground">Selecione um grupo</h2>

          <ul className="grid grid-cols-3 gap-3 md:grid-cols-4">
            {summaries.map((summary) => (
              <li key={summary.groupId}>
                <GroupCard
                  name={summary.name}
                  filledCount={summary.filledCount}
                  totalCount={summary.totalCount}
                  status={summary.status}
                  href={summary.href}
                />
              </li>
            ))}
          </ul>

          <div className="flex items-start gap-2 rounded-lg border border-border bg-muted/50 p-3">
            <Info
              size={16}
              aria-hidden="true"
              className="mt-0.5 shrink-0 text-muted-foreground"
            />
            <p className="text-xs text-muted-foreground">
              Você pode preencher os grupos em qualquer ordem.
            </p>
          </div>
        </>
      )}
    </div>
  );
}
