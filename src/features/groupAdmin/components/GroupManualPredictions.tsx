"use client";

import { useMemo, useState, type JSX } from "react";
import { toast } from "sonner";
import { LoaderCircle } from "lucide-react";

import { Button } from "@/components/ui/button";
import { ScoreInput } from "@/features/predictions/components/ScoreInput";
import { selectLockedMatches } from "@/features/predictions/lib";
import { useTeams } from "@/features/home/hooks";
import { useMatches } from "@/features/matches/hooks";
import {
  useCreateManualPrediction,
  useGroupUsers,
} from "@/features/groupAdmin/hooks";
import { ConfirmActionDialog } from "@/features/admin/components/ConfirmActionDialog";
import type { MatchWithId, TeamWithId } from "@/types";

import { GroupAdminSubHeader } from "./GroupAdminSubHeader";
import { EmptyState, ErrorState, ListSkeleton } from "./GroupPendingUsers";

/**
 * Palpites Manuais (PRD-12 / TASK-04). Admin de grupo lança o palpite de um
 * participante aprovado num jogo BLOQUEADO (encerrado/ao vivo/kickoff passado).
 * Confirmação de sobrescrita é incondicional: as Rules impedem o client de ler o
 * palpite alvo, então a transparência real fica na auditoria server-side (TASK-02).
 */
export function GroupManualPredictions(): JSX.Element {
  const members = useGroupUsers("approved");
  const matchesQuery = useMatches();
  const teamsQuery = useTeams();
  const mutation = useCreateManualPrediction();

  // `now` fixado uma vez (lazy) — evita recomputar o filtro a cada render.
  const [now] = useState(() => new Date());

  const [targetUid, setTargetUid] = useState("");
  const [matchId, setMatchId] = useState("");
  const [homeScore, setHomeScore] = useState(0);
  const [awayScore, setAwayScore] = useState(0);
  const [confirmOpen, setConfirmOpen] = useState(false);

  const teamsById = useMemo(() => {
    const map = new Map<string, TeamWithId>();
    for (const team of teamsQuery.data ?? []) map.set(team.id, team);
    return map;
  }, [teamsQuery.data]);

  const lockedMatches = useMemo(
    () => selectLockedMatches(matchesQuery.data ?? [], now),
    [matchesQuery.data, now],
  );

  const isLoading =
    members.isLoading ||
    matchesQuery.isLoading ||
    teamsQuery.isLoading ||
    !members.data ||
    !matchesQuery.data ||
    !teamsQuery.data;
  const isError = members.isError || matchesQuery.isError || teamsQuery.isError;

  function refetchAll(): void {
    if (members.isError) void members.refetch();
    if (matchesQuery.isError) void matchesQuery.refetch();
    if (teamsQuery.isError) void teamsQuery.refetch();
  }

  function matchLabel(match: MatchWithId): string {
    const home = teamsById.get(match.homeTeamId)?.name ?? "?";
    const away = teamsById.get(match.awayTeamId)?.name ?? "?";
    const base = `${home} x ${away}`;
    if (
      match.status === "finished" &&
      match.homeScore !== null &&
      match.awayScore !== null
    ) {
      return `${base} (${match.homeScore} x ${match.awayScore})`;
    }
    return base;
  }

  const selectedMember = members.data?.find((g) => g.user.uid === targetUid);
  const selectedMatch = lockedMatches.find((m) => m.id === matchId);
  const canSubmit = targetUid !== "" && matchId !== "" && !mutation.isPending;

  function reset(): void {
    setTargetUid("");
    setMatchId("");
    setHomeScore(0);
    setAwayScore(0);
  }

  function onConfirm(): void {
    mutation.mutate(
      { targetUid, matchId, homeScore, awayScore },
      {
        onSuccess: () => {
          setConfirmOpen(false);
          reset();
          toast.success("Palpite lançado.");
        },
      },
    );
  }

  return (
    <div className="mx-auto flex w-full max-w-md flex-col gap-4 px-4 py-4">
      <GroupAdminSubHeader
        title="Palpites manuais"
        subtitle="Jogo encerrado ou bloqueado"
      />

      {isError ? (
        <ErrorState onRetry={refetchAll} />
      ) : isLoading ? (
        <ListSkeleton />
      ) : (members.data ?? []).length === 0 ? (
        <EmptyState message="Nenhum participante aprovado no grupo." />
      ) : lockedMatches.length === 0 ? (
        <EmptyState message="Nenhum jogo bloqueado para lançar palpite." />
      ) : (
        <form
          className="flex flex-col gap-4 rounded-xl border border-border bg-card p-4"
          onSubmit={(e) => {
            e.preventDefault();
            if (canSubmit) setConfirmOpen(true);
          }}
        >
          {/* Participante */}
          <div className="flex flex-col gap-1.5">
            <label
              htmlFor="manual-prediction-member"
              className="text-sm font-medium text-foreground"
            >
              Participante
            </label>
            <select
              id="manual-prediction-member"
              value={targetUid}
              disabled={mutation.isPending}
              onChange={(e) => setTargetUid(e.target.value)}
              className="min-h-[44px] w-full rounded-lg border border-border bg-background px-3 text-sm text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <option value="" disabled>
                Selecione…
              </option>
              {(members.data ?? []).map((g) => (
                <option key={g.user.uid} value={g.user.uid}>
                  {g.user.name}
                </option>
              ))}
            </select>
          </div>

          {/* Jogo */}
          <div className="flex flex-col gap-1.5">
            <label
              htmlFor="manual-prediction-match"
              className="text-sm font-medium text-foreground"
            >
              Jogo
            </label>
            <select
              id="manual-prediction-match"
              value={matchId}
              disabled={mutation.isPending}
              onChange={(e) => setMatchId(e.target.value)}
              className="min-h-[44px] w-full rounded-lg border border-border bg-background px-3 text-sm text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <option value="" disabled>
                Selecione…
              </option>
              {lockedMatches.map((match) => (
                <option key={match.id} value={match.id}>
                  {matchLabel(match)}
                </option>
              ))}
            </select>
          </div>

          {/* Placar */}
          <div className="flex items-end justify-center gap-3">
            <ScoreInput
              label="Gols Mandante"
              value={homeScore}
              onChange={setHomeScore}
              disabled={mutation.isPending}
            />
            <span
              aria-hidden="true"
              className="self-center pb-2 text-2xl font-bold text-muted-foreground"
            >
              x
            </span>
            <ScoreInput
              label="Gols Visitante"
              value={awayScore}
              onChange={setAwayScore}
              disabled={mutation.isPending}
            />
          </div>

          <Button
            type="submit"
            disabled={!canSubmit}
            className="min-h-[44px] w-full"
          >
            {mutation.isPending ? (
              <LoaderCircle
                size={16}
                aria-hidden="true"
                className="animate-spin motion-reduce:animate-none"
              />
            ) : null}
            Salvar palpite
          </Button>
        </form>
      )}

      <ConfirmActionDialog
        open={confirmOpen}
        onOpenChange={setConfirmOpen}
        title="Confirmar palpite"
        description={
          selectedMember && selectedMatch
            ? `Lançar ${homeScore} x ${awayScore} para ${selectedMember.user.name} no jogo ${matchLabel(selectedMatch)}. Se já houver um palpite deste participante neste jogo, ele será sobrescrito.`
            : ""
        }
        confirmLabel="Lançar palpite"
        confirmVariant="default"
        pending={mutation.isPending}
        onConfirm={onConfirm}
      />
    </div>
  );
}
