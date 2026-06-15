"use client";

import type { JSX } from "react";
import { Dna } from "lucide-react";

import type { BettorDna } from "@/features/rankings/lib";

interface BettorDnaCardProps {
  dna: BettorDna;
}

const TENDENCY_LABEL: Record<BettorDna["tendency"], string> = {
  otimista: "Otimista 🔥",
  cauteloso: "Cauteloso 🧊",
};

export function BettorDnaCard({ dna }: BettorDnaCardProps): JSX.Element {
  return (
    <section
      aria-labelledby="dna-heading"
      className="rounded-xl border border-border bg-card p-4 shadow-sm"
    >
      <h3
        id="dna-heading"
        className="mb-3 flex items-center gap-2 text-base font-semibold text-foreground"
      >
        <Dna size={18} aria-hidden="true" className="text-primary" />
        DNA do Palpiteiro
      </h3>
      <dl className="grid grid-cols-3 gap-2">
        <div className="flex flex-col gap-0.5">
          <dt className="text-xs text-muted-foreground">Tendência</dt>
          <dd className="text-sm font-semibold text-primary">
            {TENDENCY_LABEL[dna.tendency]}
          </dd>
        </div>
        <div className="flex flex-col gap-0.5">
          <dt className="text-xs text-muted-foreground">Placar Favorito</dt>
          <dd className="text-sm font-semibold tabular-nums text-foreground">
            {dna.favoritePrediction
              ? `${dna.favoritePrediction.homeScore} × ${dna.favoritePrediction.awayScore}`
              : "—"}
          </dd>
        </div>
        <div className="flex flex-col gap-0.5">
          <dt className="text-xs text-muted-foreground">Média de Gols</dt>
          <dd className="text-sm font-semibold tabular-nums text-foreground">
            {dna.avgGoalsPerMatch} gols/jogo
          </dd>
        </div>
      </dl>
    </section>
  );
}
