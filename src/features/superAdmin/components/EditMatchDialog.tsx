"use client";

import { useEffect, useState, type JSX } from "react";
import { LoaderCircle } from "lucide-react";

import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type { AdminMatchView, MatchEditInput } from "@/services/superAdmin";

const STATUS_OPTIONS: { value: AdminMatchView["status"]; label: string }[] = [
  { value: "scheduled", label: "Agendado" },
  { value: "live", label: "Ao Vivo" },
  { value: "finished", label: "Encerrado" },
  { value: "postponed", label: "Adiado" },
  { value: "canceled", label: "Cancelado" },
];

/** Status que exigem placar (coerência espelha o refine do `matchSchema` no servidor). */
function requiresScore(status: AdminMatchView["status"]): boolean {
  return status === "live" || status === "finished";
}

function parseScore(raw: string): number | null {
  const trimmed = raw.trim();
  if (trimmed === "") return null;
  const n = Number(trimmed);
  if (!Number.isInteger(n) || n < 0) return null;
  return n;
}

/**
 * Edição manual de uma partida (PRD11-06 / PRD-11 TASK-04). Status + placar.
 * Valida coerência placar↔status no client (mesma regra do servidor); o backend
 * reforça com 422. Controlado; o pai fecha no sucesso.
 */
export function EditMatchDialog({
  open,
  onOpenChange,
  match,
  pending,
  errorMessage,
  onConfirm,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  match: AdminMatchView;
  pending: boolean;
  errorMessage: string | null;
  onConfirm: (input: MatchEditInput) => void;
}): JSX.Element {
  const [status, setStatus] = useState<AdminMatchView["status"]>(match.status);
  const [home, setHome] = useState(match.homeScore?.toString() ?? "");
  const [away, setAway] = useState(match.awayScore?.toString() ?? "");

  // Reseta os campos sempre que o diálogo (re)abre para outra partida.
  useEffect(() => {
    if (open) {
      setStatus(match.status);
      setHome(match.homeScore?.toString() ?? "");
      setAway(match.awayScore?.toString() ?? "");
    }
  }, [open, match]);

  const needsScore = requiresScore(status);
  const homeScore = parseScore(home);
  const awayScore = parseScore(away);
  const scoresValid = needsScore
    ? homeScore !== null && awayScore !== null
    : true;

  function handleConfirm(): void {
    if (!scoresValid) return;
    onConfirm({
      status,
      homeScore: needsScore ? homeScore : null,
      awayScore: needsScore ? awayScore : null,
    });
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (pending) return;
        onOpenChange(next);
      }}
    >
      <DialogContent showCloseButton={!pending}>
        <DialogHeader>
          <DialogTitle>Editar Jogo</DialogTitle>
          <DialogDescription>
            {match.home.name} x {match.away.name}
          </DialogDescription>
        </DialogHeader>

        <div className="flex flex-col gap-4">
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="match-status">Status</Label>
            <select
              id="match-status"
              value={status}
              disabled={pending}
              onChange={(e) =>
                setStatus(e.target.value as AdminMatchView["status"])
              }
              className="h-11 w-full rounded-lg border border-border bg-card px-3 text-sm text-foreground focus-visible:ring-3 focus-visible:ring-ring/50 disabled:opacity-50"
            >
              {STATUS_OPTIONS.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </select>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="home-score">Placar {match.home.name}</Label>
              <Input
                id="home-score"
                type="number"
                min={0}
                inputMode="numeric"
                value={home}
                disabled={pending || !needsScore}
                aria-invalid={needsScore && homeScore === null}
                aria-describedby={
                  needsScore && !scoresValid ? "score-error" : undefined
                }
                onChange={(e) => setHome(e.target.value)}
                className="h-11"
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="away-score">Placar {match.away.name}</Label>
              <Input
                id="away-score"
                type="number"
                min={0}
                inputMode="numeric"
                value={away}
                disabled={pending || !needsScore}
                aria-invalid={needsScore && awayScore === null}
                aria-describedby={
                  needsScore && !scoresValid ? "score-error" : undefined
                }
                onChange={(e) => setAway(e.target.value)}
                className="h-11"
              />
            </div>
          </div>

          {needsScore && !scoresValid ? (
            <p id="score-error" className="text-xs text-destructive">
              Informe o placar (inteiro ≥ 0) para os dois times.
            </p>
          ) : null}

          {errorMessage ? (
            <p role="alert" className="text-sm text-destructive">
              {errorMessage}
            </p>
          ) : null}
        </div>

        <DialogFooter>
          <DialogClose
            disabled={pending}
            render={
              <Button variant="outline" className="h-11">
                Cancelar
              </Button>
            }
          />
          <Button
            className="h-11"
            disabled={pending || !scoresValid}
            aria-busy={pending}
            onClick={handleConfirm}
          >
            {pending ? (
              <LoaderCircle
                size={16}
                aria-hidden="true"
                className="animate-spin motion-reduce:animate-none"
              />
            ) : null}
            Salvar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
