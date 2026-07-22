"use client";

/**
 * LeagueStandingsTable — tabela de classificação de liga de pontos corridos (TASK-20).
 *
 * Espelha `GroupStandingsTable` (mesmos tokens/semântica HTML/a11y), SEM os
 * elementos Copa-específicos:
 *  - sem barra de cor / situação de qualificação (liga tem só posição numérica);
 *  - escudo do clube (`crestUrl` ESPN) no lugar da bandeira de seleção; fallback
 *    de iniciais quando ausente.
 *
 * 10 colunas: # Clube J V E D GP GC SG PTS. PTS em destaque (font-bold).
 */

import { cn } from "@/lib/utils";
import type { LeagueStanding } from "@/types/leagues";

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

export interface LeagueStandingsTableProps {
  table: LeagueStanding[];
  /** Nome do campeonato — usado na caption sr-only. */
  championshipName?: string;
  className?: string;
}

// ---------------------------------------------------------------------------
// Subcomponente: TeamCrest (escudo + fallback de iniciais)
// Espelha o TeamFlag de GroupStandingsTable — tamanho compacto w-7 h-5.
// Usa <img loading="lazy"> (não next/image) para consistência com a tabela de
// grupos e por não haver remotePatterns configurado para os hosts ESPN.
// ---------------------------------------------------------------------------

interface TeamCrestProps {
  name: string;
  crestUrl?: string;
}

function TeamCrest({ name, crestUrl }: TeamCrestProps) {
  if (crestUrl) {
    return (
      <img
        src={crestUrl}
        alt={name}
        loading="lazy"
        decoding="async"
        className="w-7 h-5 rounded-sm object-contain"
      />
    );
  }

  // Fallback: iniciais (até 3 letras) quando o escudo não está disponível.
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

export function LeagueStandingsTable({
  table,
  championshipName,
  className,
}: LeagueStandingsTableProps) {
  return (
    // Wrapper overflow-x-auto: scroll horizontal só na tabela em mobile.
    <div className={cn("w-full overflow-x-auto", className)}>
      <table className="w-full border-collapse text-xs sm:text-sm">
        <caption className="sr-only">
          Classificação{championshipName ? ` — ${championshipName}` : ""}
        </caption>

        <thead>
          <tr className="border-b border-border text-muted-foreground">
            <th scope="col" className="px-1.5 sm:px-2 py-2 text-left font-medium w-8">
              #
            </th>
            <th scope="col" className="px-1.5 sm:px-2 py-2 text-left font-medium min-w-[120px]">
              Clube
            </th>
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
          {table.map((row) => (
            <tr
              key={row.team.id}
              className="border-b border-border last:border-b-0 hover:bg-muted/40 transition-colors duration-150"
            >
              <td className="px-1.5 sm:px-2 py-2 tabular-nums text-foreground">
                {row.position}
              </td>

              <td className="px-1.5 sm:px-2 py-2">
                <div className="flex items-center gap-1.5">
                  <TeamCrest name={row.team.name} crestUrl={row.team.crestUrl} />
                  <span className="truncate text-foreground">{row.team.name}</span>
                </div>
              </td>

              <td className="px-1.5 sm:px-2 py-2 text-center tabular-nums text-foreground">
                {row.played}
              </td>
              <td className="px-1.5 sm:px-2 py-2 text-center tabular-nums text-foreground">
                {row.wins}
              </td>
              <td className="px-1.5 sm:px-2 py-2 text-center tabular-nums text-foreground">
                {row.draws}
              </td>
              <td className="px-1.5 sm:px-2 py-2 text-center tabular-nums text-foreground">
                {row.losses}
              </td>
              <td className="px-1.5 sm:px-2 py-2 text-center tabular-nums text-foreground">
                {row.goalsFor}
              </td>
              <td className="px-1.5 sm:px-2 py-2 text-center tabular-nums text-foreground">
                {row.goalsAgainst}
              </td>
              <td className="px-1.5 sm:px-2 py-2 text-center tabular-nums text-foreground">
                {formatGoalDiff(row.goalDifference)}
              </td>
              <td className="px-1.5 sm:px-2 py-2 text-center tabular-nums font-bold text-foreground">
                {row.points}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
