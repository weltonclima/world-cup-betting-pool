"use client";

/**
 * GroupStandingsTable — tabela semântica de classificação de um grupo (TASK-07).
 *
 * 10 colunas de dado: # Seleção J V E D GP GC SG PTS
 * Nota: a coluna "P" presente no rótulo do PRD é redundante com "PTS" (Pontos)
 * e não está incluída no exemplo numérico — omitida intencionalmente (spec §6.3).
 *
 * Cada linha inclui:
 * - Barra de cor à esquerda (border-l-4) indicando situação de qualificação.
 * - Texto sr-only com a situação textual (color-not-only, a11y).
 * - Bandeira + nome da seleção (fallback de iniciais se flagUrl ausente).
 * - SG (saldo de gols) com sinal explícito (+N para positivos, 0 neutro, -N negativos).
 * - PTS em destaque (font-bold).
 */

import { cn } from "@/lib/utils";
import type { GroupTable } from "@/types/worldcup";
import type { Qualification } from "@/types/worldcup";

// ---------------------------------------------------------------------------
// Tipos de props
// ---------------------------------------------------------------------------

export interface GroupStandingsTableProps {
  table: GroupTable;
  className?: string;
}

// ---------------------------------------------------------------------------
// Mapeamento de qualificação → classes de barra de cor + texto sr-only
// ---------------------------------------------------------------------------

interface QualificationStyle {
  /** Classes da barra border-l-4 (tokens-only, ui-spec §10). */
  barClass: string;
  /** Texto legível por leitores de tela — garante color-not-only (spec §6.4). */
  srText: string;
}

const QUALIFICATION_STYLE: Record<Qualification, QualificationStyle> = {
  classificado: { barClass: "border-l-4 border-primary", srText: "Classificado" },
  possivel: { barClass: "border-l-4 border-primary/40", srText: "Possível classificado" },
  eliminado: { barClass: "border-l-4 border-muted-foreground/30", srText: "Eliminado" },
  indefinido: { barClass: "border-l-4 border-transparent", srText: "Situação a definir" },
};

// ---------------------------------------------------------------------------
// Subcomponente: TeamFlag (bandeira + fallback de iniciais)
// Espelha o padrão de TeamFlag em MatchCard.tsx — tamanho compacto w-7 h-5 para tabela.
// ---------------------------------------------------------------------------

interface TeamFlagProps {
  name: string;
  flagUrl?: string;
}

function TeamFlag({ name, flagUrl }: TeamFlagProps) {
  if (flagUrl) {
    return (
      <img
        src={flagUrl}
        alt={name}
        loading="lazy"
        decoding="async"
        className="w-7 h-5 rounded-sm object-cover border border-border"
      />
    );
  }

  // Fallback: iniciais (até 3 letras) quando flagUrl não disponível
  const initials = name
    .split(" ")
    .map((w) => w[0])
    .join("")
    .slice(0, 3)
    .toUpperCase();

  return (
    <span
      aria-label={name}
      className="w-7 h-5 flex items-center justify-center rounded-sm bg-muted text-xs font-bold text-muted-foreground"
    >
      {initials}
    </span>
  );
}

// ---------------------------------------------------------------------------
// Formatação do saldo de gols (SG)
// ---------------------------------------------------------------------------

/** Formata o saldo de gols: +N (positivo), 0 (zero), -N (negativo). */
function formatGoalDiff(value: number): string {
  if (value > 0) return `+${value}`;
  return String(value);
}

// ---------------------------------------------------------------------------
// Componente principal
// ---------------------------------------------------------------------------

/**
 * Tabela de classificação de um grupo com semântica HTML completa e suporte a a11y.
 */
export function GroupStandingsTable({ table, className }: GroupStandingsTableProps) {
  const { groupId, standings } = table;

  return (
    // Wrapper overflow-x-auto: permite scroll horizontal só na tabela em mobile (spec §6 / ui-spec §6)
    <div className={cn("w-full overflow-x-auto", className)}>
      <table className="w-full border-collapse text-xs sm:text-sm">
        {/* Caption visível apenas para leitores de tela */}
        <caption className="sr-only">Classificação do Grupo {groupId}</caption>

        <thead>
          <tr className="border-b border-border text-muted-foreground">
            {/* # — posição */}
            <th scope="col" className="px-1.5 sm:px-2 py-2 text-left font-medium w-8">
              #
            </th>

            {/* Seleção — bandeira + nome */}
            <th scope="col" className="px-1.5 sm:px-2 py-2 text-left font-medium min-w-[120px]">
              Seleção
            </th>

            {/* Colunas numéricas com <abbr> para leitores de tela */}
            <th scope="col" className="px-1.5 sm:px-2 py-2 text-center font-medium tabular-nums">
              <abbr title="Jogos">J</abbr>
            </th>
            <th scope="col" className="px-1.5 sm:px-2 py-2 text-center font-medium tabular-nums">
              <abbr title="Vitórias">V</abbr>
            </th>
            <th scope="col" className="px-1.5 sm:px-2 py-2 text-center font-medium tabular-nums">
              <abbr title="Empates">E</abbr>
            </th>
            <th scope="col" className="px-1.5 sm:px-2 py-2 text-center font-medium tabular-nums">
              <abbr title="Derrotas">D</abbr>
            </th>
            <th scope="col" className="px-1.5 sm:px-2 py-2 text-center font-medium tabular-nums">
              <abbr title="Gols Pró">GP</abbr>
            </th>
            <th scope="col" className="px-1.5 sm:px-2 py-2 text-center font-medium tabular-nums">
              <abbr title="Gols Contra">GC</abbr>
            </th>
            <th scope="col" className="px-1.5 sm:px-2 py-2 text-center font-medium tabular-nums">
              <abbr title="Saldo de Gols">SG</abbr>
            </th>
            <th scope="col" className="px-1.5 sm:px-2 py-2 text-center font-medium tabular-nums">
              <abbr title="Pontos">PTS</abbr>
            </th>
          </tr>
        </thead>

        <tbody>
          {standings.map((row) => {
            const { barClass, srText } = QUALIFICATION_STYLE[row.qualification];

            return (
              <tr
                key={row.team.id}
                className="border-b border-border last:border-b-0 hover:bg-muted/40 transition-colors duration-150"
              >
                {/* # — posição com barra de cor e texto sr-only de situação */}
                <td
                  className={cn(
                    "px-1.5 sm:px-2 py-2 tabular-nums text-foreground",
                    barClass,
                  )}
                >
                  {row.position}
                  <span className="sr-only"> — {srText}</span>
                </td>

                {/* Seleção: bandeira + nome */}
                <td className="px-1.5 sm:px-2 py-2">
                  <div className="flex items-center gap-1.5">
                    <TeamFlag name={row.team.name} flagUrl={row.team.flagUrl} />
                    <span className="truncate text-foreground">{row.team.name}</span>
                  </div>
                </td>

                {/* Jogos */}
                <td className="px-1.5 sm:px-2 py-2 text-center tabular-nums text-foreground">
                  {row.played}
                </td>

                {/* Vitórias */}
                <td className="px-1.5 sm:px-2 py-2 text-center tabular-nums text-foreground">
                  {row.wins}
                </td>

                {/* Empates */}
                <td className="px-1.5 sm:px-2 py-2 text-center tabular-nums text-foreground">
                  {row.draws}
                </td>

                {/* Derrotas */}
                <td className="px-1.5 sm:px-2 py-2 text-center tabular-nums text-foreground">
                  {row.losses}
                </td>

                {/* Gols Pró */}
                <td className="px-1.5 sm:px-2 py-2 text-center tabular-nums text-foreground">
                  {row.goalsFor}
                </td>

                {/* Gols Contra */}
                <td className="px-1.5 sm:px-2 py-2 text-center tabular-nums text-foreground">
                  {row.goalsAgainst}
                </td>

                {/* Saldo de Gols — com sinal explícito para positivos */}
                <td className="px-1.5 sm:px-2 py-2 text-center tabular-nums text-foreground">
                  {formatGoalDiff(row.goalDifference)}
                </td>

                {/* Pontos — destaque */}
                <td className="px-1.5 sm:px-2 py-2 text-center tabular-nums font-bold text-foreground">
                  {row.points}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
