"use client";

/**
 * MatchFiltersSheet — Sheet de filtros avançados da lista de jogos (TASK-05).
 *
 * Exibe três seções de filtro em um bottom sheet:
 *  1. Fase (grupos/oitavas/quartas/semifinal/terceiro/final)
 *  2. Status do Palpite (todos/enviado/pendente/bloqueado)
 *  3. Seleção (busca por nome + lista de teams via useTeams)
 *
 * Ações: "Aplicar Filtros" (commit para a lista) e "Limpar Filtros" (reset total).
 *
 * Estado interno: rascunho local (draft) — não afeta a lista até "Aplicar".
 * Re-inicializado quando o sheet abre (prop open: false → true).
 *
 * Contrato visual: ai/screen/jogos-task-05.md
 * Acessibilidade: focus trap / ESC / overlay gerenciados pelo Base UI Dialog (shadcn Sheet).
 */

import { useEffect, useState } from "react";

import { Check, Search } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { cn } from "@/lib/utils";
import type { Stage } from "@/types";

import type { MatchPredictionStatus } from "@/features/matches/lib/matchesHelpers";
import { useTeams } from "@/features/matches/hooks/useTeams";

// ---------------------------------------------------------------------------
// Constantes de opções (evita hardcode espalhado)
// ---------------------------------------------------------------------------

const STAGE_OPTIONS: { value: Stage; label: string }[] = [
  { value: "grupos", label: "Fase de Grupos" },
  { value: "dezesseis-avos", label: "16 Avos" },
  { value: "oitavas", label: "Oitavas" },
  { value: "quartas", label: "Quartas" },
  { value: "semifinal", label: "Semifinal" },
  { value: "terceiro", label: "3º Lugar" },
  { value: "final", label: "Final" },
];

const PREDICTION_STATUS_OPTIONS: {
  value: MatchPredictionStatus;
  label: string;
}[] = [
  { value: "enviado", label: "Palpite Enviado" },
  { value: "pendente", label: "Palpite Pendente" },
  { value: "bloqueado", label: "Jogo Encerrado" },
];

// ---------------------------------------------------------------------------
// Tipos de props
// ---------------------------------------------------------------------------

export interface MatchFiltersSheetProps {
  /** Controla abertura do sheet. */
  open: boolean;
  /** Fechar sem aplicar alterações pendentes. */
  onClose: () => void;

  /** Fase atualmente aplicada na lista. */
  selectedStage: Stage | undefined;
  /** Status de palpite atualmente aplicado na lista. */
  selectedPredictionStatus: MatchPredictionStatus | undefined;
  /** TeamId atualmente aplicado na lista. */
  selectedTeamId: string | undefined;

  /**
   * "Aplicar Filtros" — commita os valores do rascunho para a lista.
   */
  onApply: (filters: {
    stage: Stage | undefined;
    predictionStatus: MatchPredictionStatus | undefined;
    teamId: string | undefined;
  }) => void;

  /**
   * "Limpar Filtros" — reseta todos os filtros (incluindo chips e busca).
   */
  onClear: () => void;
}

// ---------------------------------------------------------------------------
// Subcomponente: ToggleButton
// ---------------------------------------------------------------------------

interface ToggleButtonProps {
  label: string;
  selected: boolean;
  onClick: () => void;
}

function ToggleButton({ label, selected, onClick }: ToggleButtonProps) {
  return (
    <Button
      type="button"
      size="sm"
      variant={selected ? "default" : "outline"}
      onClick={onClick}
      className={cn(
        "rounded-lg min-h-11 px-3 text-sm shrink-0",
        "transition-colors duration-150",
        "focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
      )}
      aria-pressed={selected}
    >
      {label}
    </Button>
  );
}

// ---------------------------------------------------------------------------
// Componente principal: MatchFiltersSheet
// ---------------------------------------------------------------------------

export function MatchFiltersSheet({
  open,
  onClose,
  selectedStage,
  selectedPredictionStatus,
  selectedTeamId,
  onApply,
  onClear,
}: MatchFiltersSheetProps) {
  // ── Estado de rascunho ──────────────────────────────────────────────────
  const [draftStage, setDraftStage] = useState<Stage | undefined>(
    selectedStage,
  );
  const [draftPredictionStatus, setDraftPredictionStatus] = useState<
    MatchPredictionStatus | undefined
  >(selectedPredictionStatus);
  const [draftTeamId, setDraftTeamId] = useState<string | undefined>(
    selectedTeamId,
  );
  const [teamSearch, setTeamSearch] = useState("");

  // Sincroniza o rascunho com os valores externos ao reabrir o sheet
  useEffect(() => {
    if (open) {
      setDraftStage(selectedStage);
      setDraftPredictionStatus(selectedPredictionStatus);
      setDraftTeamId(selectedTeamId);
      setTeamSearch("");
    }
  }, [open]); // eslint-disable-line react-hooks/exhaustive-deps
  // Intencionalmente omitimos selectedStage/selectedPredictionStatus/selectedTeamId do
  // array de deps: só queremos sincronizar ao *abrir* o sheet (open: false→true),
  // não a cada mudança externa enquanto o sheet está fechado.

  // ── Dados de seleções ────────────────────────────────────────────────────
  const { data: teams = [] } = useTeams();

  const filteredTeams = teamSearch.trim()
    ? teams.filter((t) =>
        t.name.toLowerCase().includes(teamSearch.trim().toLowerCase()),
      )
    : teams;

  // ── Handlers das ações ───────────────────────────────────────────────────

  function handleApply() {
    onApply({
      stage: draftStage,
      predictionStatus: draftPredictionStatus,
      teamId: draftTeamId,
    });
    onClose();
  }

  function handleClear() {
    onClear();
    onClose();
  }

  // ── Handlers de toggle ───────────────────────────────────────────────────

  function toggleStage(value: Stage) {
    setDraftStage((prev) => (prev === value ? undefined : value));
  }

  function togglePredictionStatus(value: MatchPredictionStatus) {
    setDraftPredictionStatus((prev) => (prev === value ? undefined : value));
  }

  function toggleTeamId(id: string) {
    setDraftTeamId((prev) => (prev === id ? undefined : id));
  }

  // ── Render ───────────────────────────────────────────────────────────────

  return (
    <Sheet open={open} onOpenChange={(isOpen) => !isOpen && onClose()}>
      <SheetContent
        side="bottom"
        className="rounded-t-2xl max-h-[90vh] overflow-y-auto px-4 pb-6 pt-0"
      >
        {/* Header */}
        <SheetHeader className="px-0 pb-4">
          <SheetTitle className="text-xl font-semibold text-foreground">
            Filtros
          </SheetTitle>
        </SheetHeader>

        <div className="flex flex-col gap-6">
          {/* ── Seção: Fase ─────────────────────────────────────────────── */}
          <section aria-labelledby="filter-section-stage">
            <p
              id="filter-section-stage"
              className="text-sm font-semibold text-foreground mb-3"
            >
              Fase
            </p>
            <div role="group" aria-label="Filtro por fase" className="flex flex-wrap gap-2">
              <ToggleButton
                label="Todas as fases"
                selected={draftStage === undefined}
                onClick={() => setDraftStage(undefined)}
              />
              {STAGE_OPTIONS.map(({ value, label }) => (
                <ToggleButton
                  key={value}
                  label={label}
                  selected={draftStage === value}
                  onClick={() => toggleStage(value)}
                />
              ))}
            </div>
          </section>

          {/* ── Seção: Status do Palpite ─────────────────────────────────── */}
          <section aria-labelledby="filter-section-status">
            <p
              id="filter-section-status"
              className="text-sm font-semibold text-foreground mb-3"
            >
              Status do Palpite
            </p>
            <div role="group" aria-label="Filtro por status do palpite" className="flex flex-wrap gap-2">
              <ToggleButton
                label="Todos"
                selected={draftPredictionStatus === undefined}
                onClick={() => setDraftPredictionStatus(undefined)}
              />
              {PREDICTION_STATUS_OPTIONS.map(({ value, label }) => (
                <ToggleButton
                  key={value}
                  label={label}
                  selected={draftPredictionStatus === value}
                  onClick={() => togglePredictionStatus(value)}
                />
              ))}
            </div>
          </section>

          {/* ── Seção: Seleção ───────────────────────────────────────────── */}
          <section aria-labelledby="filter-section-team">
            <p
              id="filter-section-team"
              className="text-sm font-semibold text-foreground mb-3"
            >
              Seleção
            </p>

            {/* Input de busca */}
            <div className="relative mb-2">
              <Search
                size={16}
                aria-hidden="true"
                className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground pointer-events-none"
              />
              <Input
                type="search"
                placeholder="Buscar seleção"
                aria-label="Buscar por seleção"
                value={teamSearch}
                onChange={(e) => setTeamSearch(e.target.value)}
                className="pl-9"
              />
            </div>

            {/* Lista de seleções */}
            <div
              role="listbox"
              aria-label="Seleção para filtro"
              aria-multiselectable="false"
              className="max-h-48 overflow-y-auto border border-border rounded-lg"
            >
              {/* "Todas as seleções" — sempre no topo */}
              <div
                role="option"
                aria-selected={draftTeamId === undefined}
                tabIndex={0}
                onClick={() => setDraftTeamId(undefined)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" || e.key === " ") {
                    e.preventDefault();
                    setDraftTeamId(undefined);
                  }
                }}
                className={cn(
                  "flex items-center justify-between px-3 min-h-[44px] cursor-pointer",
                  "hover:bg-accent transition-colors duration-100",
                  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-inset",
                  draftTeamId === undefined && "bg-accent",
                )}
              >
                <span className="text-sm text-foreground">Todas as seleções</span>
                {draftTeamId === undefined && (
                  <Check
                    size={16}
                    className="text-primary shrink-0"
                    aria-hidden="true"
                  />
                )}
              </div>

              {/* Teams filtrados */}
              {filteredTeams.map((team) => (
                <div
                  key={team.id}
                  role="option"
                  aria-selected={draftTeamId === team.id}
                  tabIndex={0}
                  onClick={() => toggleTeamId(team.id)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" || e.key === " ") {
                      e.preventDefault();
                      toggleTeamId(team.id);
                    }
                  }}
                  className={cn(
                    "flex items-center justify-between gap-3 px-3 min-h-[44px] cursor-pointer",
                    "hover:bg-accent transition-colors duration-100",
                    "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-inset",
                    draftTeamId === team.id && "bg-accent",
                  )}
                >
                  <div className="flex items-center gap-2 min-w-0">
                    {/* Bandeira ou placeholder */}
                    {team.flagUrl ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={team.flagUrl}
                        alt=""
                        aria-hidden="true"
                        className="w-5 h-4 object-cover rounded-sm shrink-0"
                      />
                    ) : (
                      <div
                        aria-hidden="true"
                        className="w-5 h-4 bg-muted rounded-sm shrink-0"
                      />
                    )}
                    <span className="text-sm text-foreground truncate">
                      {team.name}
                    </span>
                  </div>
                  {draftTeamId === team.id && (
                    <Check
                      size={16}
                      className="text-primary shrink-0"
                      aria-hidden="true"
                    />
                  )}
                </div>
              ))}
            </div>
          </section>

          {/* ── Ações ────────────────────────────────────────────────────── */}
          <div className="flex flex-col gap-2 pt-4 border-t border-border">
            <Button
              type="button"
              variant="default"
              className="w-full h-11"
              onClick={handleApply}
            >
              Aplicar Filtros
            </Button>
            <Button
              type="button"
              variant="ghost"
              className="w-full h-11 text-muted-foreground"
              onClick={handleClear}
            >
              Limpar Filtros
            </Button>
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
}
