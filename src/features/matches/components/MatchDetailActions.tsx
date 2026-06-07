"use client";

/**
 * MatchDetailActions — CTAs contextuais da tela de detalhe do jogo (TASK-06).
 *
 * Renderiza botões de ação contextualizada por `predictionStatus` + `matchStatus`.
 * TODOS os botões são disabled/placeholder — PRD-04 (formulário de palpite) ainda
 * não existe. Nenhum botão usa `href` para rotas inexistentes.
 *
 * Contrato visual: ai/screen/jogos-task-06.md §12
 */

import {
  BarChart2,
  Eye,
  Info,
  Pencil,
  Send,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import type { MatchPredictionStatus } from "@/features/matches/lib/matchesHelpers";
import type { MatchStatus } from "@/types";

// ---------------------------------------------------------------------------
// Tipos
// ---------------------------------------------------------------------------

export interface MatchDetailActionsProps {
  predictionStatus: MatchPredictionStatus;
  matchStatus: MatchStatus;
}

interface ActionConfig {
  label: string;
  ariaLabel: string;
  variant: "default" | "outline" | "ghost";
  icon: React.ReactNode;
}

// ---------------------------------------------------------------------------
// Derivação de ações por contexto
// ---------------------------------------------------------------------------

function deriveActions(
  predictionStatus: MatchPredictionStatus,
  matchStatus: MatchStatus,
): ActionConfig[] {
  const verInfoPartida: ActionConfig = {
    label: "Ver Informações da Partida",
    ariaLabel: "Ver informações da partida (disponível em breve)",
    variant: "outline",
    icon: <Info size={16} aria-hidden="true" />,
  };

  const visualizarPalpite: ActionConfig = {
    label: "Visualizar Palpite",
    ariaLabel: "Visualizar palpite (disponível em breve)",
    variant: "outline",
    icon: <Eye size={16} aria-hidden="true" />,
  };

  const verResultado: ActionConfig = {
    label: "Visualizar Resultado & Estatísticas",
    ariaLabel: "Visualizar resultado e estatísticas (disponível em breve)",
    variant: "outline",
    icon: <BarChart2 size={16} aria-hidden="true" />,
  };

  // Jogo encerrado (independente do status de palpite — bloqueado com finished)
  if (matchStatus === "finished") {
    return [
      {
        ...visualizarPalpite,
        variant: "default",
        ariaLabel: "Visualizar palpite (disponível em breve)",
      },
      verInfoPartida,
      verResultado,
    ];
  }

  // Jogo ao vivo (bloqueado)
  if (matchStatus === "live") {
    return [
      {
        ...visualizarPalpite,
        variant: "default",
        ariaLabel: "Visualizar palpite (disponível em breve)",
      },
      verInfoPartida,
    ];
  }

  // Jogo scheduled — diferencia pelo status do palpite
  if (predictionStatus === "enviado") {
    return [
      {
        label: "Editar Palpite",
        ariaLabel: "Editar palpite (disponível em breve)",
        variant: "default",
        icon: <Pencil size={16} aria-hidden="true" />,
      },
      visualizarPalpite,
      verInfoPartida,
    ];
  }

  if (predictionStatus === "pendente") {
    return [
      {
        label: "Enviar Palpite",
        ariaLabel: "Enviar palpite (disponível em breve)",
        variant: "default",
        icon: <Send size={16} aria-hidden="true" />,
      },
      verInfoPartida,
    ];
  }

  // bloqueado + scheduled (kickoffAt passou mas status ainda não atualizou)
  return [
    {
      ...visualizarPalpite,
      variant: "default",
      ariaLabel: "Visualizar palpite (disponível em breve)",
    },
    verInfoPartida,
  ];
}

// ---------------------------------------------------------------------------
// Componente
// ---------------------------------------------------------------------------

/**
 * CTAs contextuais para a tela de detalhe do jogo.
 *
 * Todos os botões são desabilitados (PRD-04 pendente). A lógica de habilitação
 * será adicionada em TASK-04 (PRD-04) sem alterar esta interface.
 */
export function MatchDetailActions({
  predictionStatus,
  matchStatus,
}: MatchDetailActionsProps) {
  const actions = deriveActions(predictionStatus, matchStatus);

  return (
    <div className="flex flex-col gap-3">
      {actions.map((action) => (
        <Button
          key={action.label}
          variant={action.variant}
          disabled
          aria-disabled="true"
          aria-label={action.ariaLabel}
          className="w-full min-h-[44px] justify-start gap-2"
        >
          {action.icon}
          {action.label}
        </Button>
      ))}
    </div>
  );
}
