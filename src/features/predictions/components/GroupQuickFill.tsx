/**
 * GroupQuickFill — tela de palpite em massa do grupo (TASK-09, PRD03-03).
 *
 * Componente APRESENTACIONAL e puro: recebe os items (de useGroupPredictions),
 * estados e handlers por props. Sem hooks de dados — a orquestração (draft,
 * batch, toast) acontece no page.tsx. Testável em isolamento.
 *
 * Renderiza 6 linhas de jogo (GroupMatchRow) com navegação TAB natural e um
 * CTA "Salvar Grupo". Estados: loading, error (retry), empty, populated,
 * saving (CTA "Salvando…").
 *
 * Contrato: ai/spec/palpites-massa-task-09.md · ai/screen/palpites-massa-task-09.md
 *
 * Tema: tokens apenas — herda o verde dentro de `.palpites-theme` (container da rota).
 */

import Link from "next/link";
import { Lock } from "lucide-react";

import { cn } from "@/lib/utils";
import { buttonVariants } from "@/components/ui/button";
import type { GroupPredictionItem } from "@/features/predictions/hooks/useGroupPredictions";
import type { BatchUpsertResult } from "@/services/predictions";

import { GroupMatchRow } from "./GroupMatchRow";

// ── Feedback agregado (pura — testável sem React) ────────────────────────────

export type SaveFeedbackTone = "success" | "warning" | "error" | "info";

export interface SaveFeedback {
  tone: SaveFeedbackTone;
  message: string;
}

/**
 * Deriva o feedback agregado (tom + mensagem pt-BR) do resultado do batch.
 * Regra R6 do spec da TASK-09. Função pura.
 */
export function buildSaveFeedback(result: BatchUpsertResult): SaveFeedback {
  const saved = result.saved.length;
  const rejected = result.rejected.length;

  if (saved > 0 && rejected === 0) {
    return {
      tone: "success",
      message: `${saved} ${saved === 1 ? "palpite salvo" : "palpites salvos"}.`,
    };
  }
  if (saved > 0 && rejected > 0) {
    return {
      tone: "warning",
      message: `${saved} salvos, ${rejected} não salvos (jogos encerrados ou inválidos).`,
    };
  }
  if (saved === 0 && rejected > 0) {
    return {
      tone: "error",
      message: `Nenhum palpite salvo. ${rejected} ${rejected === 1 ? "jogo encerrado ou inválido" : "jogos encerrados ou inválidos"}.`,
    };
  }
  // Nada salvo, nada rejeitado — payload estava vazio.
  return {
    tone: "info",
    message: "Preencha ao menos um jogo para salvar.",
  };
}

// ── Componente ────────────────────────────────────────────────────────────────

export interface GroupQuickFillProps {
  groupId: string;
  items: GroupPredictionItem[];
  isLoading: boolean;
  isError: boolean;
  isSaving: boolean;
  /**
   * Bloqueio de palpites no nível do POOL do usuário (toggle do admin —
   * pools/{groupId}.predictionsLocked). Diferente do lock per-match
   * (item.isLocked, por kickoff): quando true, TODOS os jogos ficam travados
   * e o "Salvar Grupo" é desabilitado. O servidor (batch route) também rejeita.
   */
  locked?: boolean;
  onRetry: () => void;
  onScoreChange: (
    matchId: string,
    home: number | null,
    away: number | null,
  ) => void;
  onSave: () => void;
}

function QuickFillSkeleton() {
  return (
    <div role="status" aria-live="polite" className="flex flex-col gap-2">
      <span className="sr-only">Carregando jogos do grupo</span>
      <div className="flex flex-col gap-2" aria-hidden="true">
        {Array.from({ length: 6 }, (_, i) => (
          <div
            key={i}
            className="h-16 w-full rounded-xl bg-muted animate-pulse motion-reduce:animate-none"
          />
        ))}
      </div>
    </div>
  );
}

function QuickFillError({ onRetry }: { onRetry: () => void }) {
  return (
    <div role="alert" className="flex flex-col items-start gap-3">
      <p className="text-sm text-destructive">
        Não foi possível carregar os jogos deste grupo.
      </p>
      <button
        type="button"
        onClick={onRetry}
        className={cn(
          buttonVariants({ variant: "outline", size: "lg" }),
          "min-h-[44px]",
        )}
      >
        Tentar novamente
      </button>
    </div>
  );
}

export function GroupQuickFill({
  groupId,
  items,
  isLoading,
  isError,
  isSaving,
  locked = false,
  onRetry,
  onScoreChange,
  onSave,
}: GroupQuickFillProps) {
  // Há ao menos um item preenchido (par completo) e desbloqueado?
  // Com o pool bloqueado, nada é salvável (mesmo com pares completos no draft).
  const hasSavable =
    !locked &&
    items.some(
      (i) =>
        !i.isLocked &&
        i.currentScores !== undefined &&
        Number.isFinite(i.currentScores.homeScore) &&
        Number.isFinite(i.currentScores.awayScore),
    );

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col gap-1">
        <h1 className="text-2xl font-semibold text-foreground">
          Grupo {groupId}
        </h1>
        <p className="text-sm text-muted-foreground">
          Digite todos os resultados dos jogos do grupo de uma vez.
        </p>
      </div>

      {isError ? (
        <QuickFillError onRetry={onRetry} />
      ) : isLoading ? (
        <QuickFillSkeleton />
      ) : items.length === 0 ? (
        <div className="flex flex-col items-start gap-3 py-6">
          <p className="text-sm text-muted-foreground">
            Os jogos deste grupo ainda não estão disponíveis.
          </p>
          <Link
            href="/predictions/groups"
            className={cn(
              buttonVariants({ variant: "outline", size: "lg" }),
              "min-h-[44px]",
            )}
          >
            Voltar para os grupos
          </Link>
        </div>
      ) : (
        <>
          {locked ? (
            <div
              role="status"
              className="flex items-start gap-2 rounded-xl border border-border bg-muted p-3 text-sm text-muted-foreground"
            >
              <Lock size={16} aria-hidden="true" className="mt-0.5 shrink-0" />
              <span>
                Os palpites deste grupo foram bloqueados pelo organizador. Você
                pode ver seus palpites, mas não editá-los.
              </span>
            </div>
          ) : null}

          <ul className="flex flex-col gap-2">
            {items.map((item) => (
              <li key={item.matchId}>
                <GroupMatchRow
                  homeTeam={item.homeTeam}
                  awayTeam={item.awayTeam}
                  homeScore={item.currentScores?.homeScore ?? null}
                  awayScore={item.currentScores?.awayScore ?? null}
                  locked={item.isLocked || locked}
                  onHomeChange={(value) =>
                    onScoreChange(
                      item.matchId,
                      value,
                      item.currentScores?.awayScore ?? null,
                    )
                  }
                  onAwayChange={(value) =>
                    onScoreChange(
                      item.matchId,
                      item.currentScores?.homeScore ?? null,
                      value,
                    )
                  }
                />
              </li>
            ))}
          </ul>

          <button
            type="button"
            onClick={onSave}
            disabled={isSaving || !hasSavable}
            className={cn(
              buttonVariants({ variant: "default", size: "lg" }),
              "min-h-[44px] w-full md:w-auto md:self-end",
            )}
          >
            {isSaving ? "Salvando…" : "Salvar Grupo"}
          </button>
        </>
      )}
    </div>
  );
}
