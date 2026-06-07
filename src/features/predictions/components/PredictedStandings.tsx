/**
 * PredictedStandings — Classificação Prevista do Grupo (TASK-10, PRD03-04).
 *
 * Componente APRESENTACIONAL e puro: recebe a tabela já calculada
 * (computeGroupStandings — TASK-02), um resolvedor de time e o handler de
 * confirmação por props. Sem hooks de dados — a orquestração acontece no
 * page.tsx. VISUAL e NÃO pontuada (A2): nada é persistido.
 *
 * Tabela acessível (Pos/Seleção/Pts/SG/GP) com destaque dos 2 classificados e
 * marcação do 3º como candidato a melhor terceiro. Marcação por ícone+texto
 * (cor não-exclusiva). Sem ajuste manual de desempate (A7).
 *
 * Contrato: ai/spec/palpites-massa-task-10.md · ai/screen/palpites-massa-task-10.md
 *
 * Tema: tokens apenas (`text-win`, `bg-win-bg`, `bg-muted`, `text-foreground`).
 * Herda o verde dentro de `.palpites-theme` (container da rota).
 */

import { CheckCircle2, Star } from "lucide-react";

import { cn } from "@/lib/utils";
import { buttonVariants } from "@/components/ui/button";
import type { GroupStandingEntry } from "@/features/predictions/lib";
import type { ResolvedTeam } from "@/features/matches/lib/matchesHelpers";

// ── Derivação de classificação (pura — testável sem React) ───────────────────

export type Qualification = "qualified" | "best-third-candidate" | "eliminated";

/**
 * Deriva a marcação de classificação a partir da posição (1-based).
 * pos 1–2 → classificado direto; pos 3 → candidato a melhor terceiro; senão eliminado.
 * Regra R2 do spec (A2 — visual, não pontuada).
 */
export function deriveQualification(position: number): Qualification {
  if (position <= 2) return "qualified";
  if (position === 3) return "best-third-candidate";
  return "eliminated";
}

/** Formata o saldo de gols com sinal explícito ("+4" / "0" / "-2"). */
function formatSigned(value: number): string {
  if (value > 0) return `+${value}`;
  return String(value);
}

const QUALIFICATION_LABEL: Record<Qualification, string> = {
  qualified: "classificado",
  "best-third-candidate": "candidato a melhor terceiro",
  eliminated: "eliminado",
};

// ── Bandeira ──────────────────────────────────────────────────────────────────

function TeamFlag({ team }: { team: ResolvedTeam }) {
  if (!team.flagUrl) return null;
  return (
    <img
      src={team.flagUrl}
      alt=""
      aria-hidden="true"
      width={24}
      height={16}
      loading="lazy"
      decoding="async"
      className="h-4 w-6 shrink-0 rounded-sm object-cover"
    />
  );
}

// ── Componente ────────────────────────────────────────────────────────────────

export interface PredictedStandingsProps {
  groupId: string;
  /** Tabela ordenada com position 1-based (de computeGroupStandings). */
  standings: GroupStandingEntry[];
  /** Resolve nome + flagUrl de um teamId. */
  resolveTeamName: (teamId: string) => ResolvedTeam;
  /** true → exibe nota de classificação parcial (faltam palpites). */
  isPartial: boolean;
  /** Avança o fluxo (placeholder até TASK-16). */
  onConfirm: () => void;
  /** Volta ao grid de preenchimento (colapsa a seção). */
  onEdit: () => void;
}

export function PredictedStandings({
  groupId,
  standings,
  resolveTeamName,
  isPartial,
  onConfirm,
  onEdit,
}: PredictedStandingsProps) {
  if (standings.length === 0) return null;

  const qualified = standings.filter(
    (e) => deriveQualification(e.position) === "qualified",
  );
  const thirdCandidate = standings.find(
    (e) => deriveQualification(e.position) === "best-third-candidate",
  );

  return (
    <section
      aria-labelledby="standings-heading"
      className="flex flex-col gap-4"
    >
      <h2
        id="standings-heading"
        className="text-lg font-semibold text-foreground"
      >
        Classificação Prevista
      </h2>

      <table className="w-full border-collapse text-sm">
        <caption className="sr-only">
          Classificação prevista do Grupo {groupId}
        </caption>
        <thead>
          <tr className="border-b border-border text-muted-foreground">
            <th scope="col" className="py-2 pr-2 text-left font-medium">
              Pos
            </th>
            <th scope="col" className="py-2 pr-2 text-left font-medium">
              Seleção
            </th>
            <th scope="col" className="py-2 px-2 text-right font-medium">
              Pts
            </th>
            <th scope="col" className="py-2 px-2 text-right font-medium">
              <abbr title="Saldo de gols">SG</abbr>
            </th>
            <th scope="col" className="py-2 pl-2 text-right font-medium">
              <abbr title="Gols pró">GP</abbr>
            </th>
          </tr>
        </thead>
        <tbody>
          {standings.map((entry) => {
            const qualification = deriveQualification(entry.position);
            const team = resolveTeamName(entry.teamId);
            const chipClasses =
              qualification === "qualified"
                ? "bg-win-bg text-win"
                : "bg-muted text-muted-foreground";
            return (
              <tr key={entry.teamId} className="border-b border-border">
                <td className="py-2 pr-2">
                  <span
                    aria-label={`${entry.position}º — ${QUALIFICATION_LABEL[qualification]}`}
                    className={cn(
                      "inline-flex h-6 w-6 items-center justify-center rounded-full text-xs font-bold",
                      chipClasses,
                    )}
                  >
                    {entry.position}
                  </span>
                </td>
                <td className="py-2 pr-2">
                  <span className="flex items-center gap-2">
                    <TeamFlag team={team} />
                    <span className="truncate text-foreground">
                      {team.name}
                    </span>
                  </span>
                </td>
                <td className="py-2 px-2 text-right font-semibold tabular-nums text-foreground">
                  {entry.points}
                </td>
                <td className="py-2 px-2 text-right tabular-nums text-foreground">
                  {formatSigned(entry.goalDifference)}
                </td>
                <td className="py-2 pl-2 text-right tabular-nums text-foreground">
                  {entry.goalsFor}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>

      {/* Classificados (reforço com ícone + texto — cor não-exclusiva) */}
      <div className="flex flex-col gap-2">
        <h3 className="text-sm font-medium text-foreground">Classificados</h3>
        <ul className="flex flex-col gap-2">
          {qualified.map((entry) => (
            <li
              key={entry.teamId}
              className="inline-flex items-center gap-2 rounded-lg border border-border bg-card p-2"
            >
              <CheckCircle2
                size={16}
                aria-hidden="true"
                className="shrink-0 text-win"
              />
              <span className="text-sm text-foreground">
                {resolveTeamName(entry.teamId).name} ({entry.position}º)
              </span>
            </li>
          ))}
          {thirdCandidate ? (
            <li className="inline-flex items-center gap-2 rounded-lg border border-border bg-card p-2 text-muted-foreground">
              <Star size={16} aria-hidden="true" className="shrink-0" />
              <span className="text-sm">
                {resolveTeamName(thirdCandidate.teamId).name} (3º) — candidato a
                melhor terceiro
              </span>
            </li>
          ) : null}
        </ul>
      </div>

      {isPartial ? (
        <p className="text-xs text-muted-foreground">
          Classificação parcial — baseada nos jogos já preenchidos.
        </p>
      ) : null}

      <div className="flex flex-col gap-2 md:flex-row md:items-center">
        <button
          type="button"
          onClick={onConfirm}
          className={cn(
            buttonVariants({ variant: "default", size: "lg" }),
            "min-h-[44px] w-full md:w-auto",
          )}
        >
          Confirmar Classificação
        </button>
        <button
          type="button"
          onClick={onEdit}
          className={cn(
            buttonVariants({ variant: "ghost", size: "lg" }),
            "min-h-[44px] w-full md:w-auto",
          )}
        >
          Editar Resultados
        </button>
      </div>
    </section>
  );
}
