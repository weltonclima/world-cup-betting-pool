import { RankingEmptyState } from "@/features/rankings";
import type { HistoryParticipantStat } from "@/schemas/history";
import type { RankingEntry } from "@/types";

const integerFormatter = new Intl.NumberFormat("pt-BR");
const averageFormatter = new Intl.NumberFormat("pt-BR", {
  minimumFractionDigits: 1,
  maximumFractionDigits: 1,
});

/** Card de métrica (card-via-classes, mesmo padrão de `PoolStatsScreen`). */
function StatCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex flex-col gap-1 rounded-lg border border-border bg-card p-4">
      <span className="text-sm font-medium text-muted-foreground">{label}</span>
      <span className="text-3xl font-bold tabular-nums text-primary">{value}</span>
    </div>
  );
}

export interface FrozenStatsProps {
  statistics?: HistoryParticipantStat[];
  ranking: RankingEntry[];
}

/**
 * Tab "Estatísticas" do detalhe do Histórico (TASK-15): agregados congelados
 * do pool (`history/{cid}__{poolId}.statistics`). Snapshot `__geral` (sem
 * `statistics` — ranking do campeonato inteiro, não do pool) cai no empty
 * state, per regra §6.3 do spec (fallback documentado).
 */
export function FrozenStats({ statistics }: FrozenStatsProps) {
  if (!statistics || statistics.length === 0) {
    return (
      <RankingEmptyState message="Estatísticas indisponíveis para este campeonato" />
    );
  }

  const participants = statistics.length;
  const avgAccuracy =
    statistics.reduce((sum, s) => sum + s.accuracy, 0) / participants;
  const longestStreak = Math.max(...statistics.map((s) => s.longestStreak));
  const totalCorrect = statistics.reduce((sum, s) => sum + s.totalCorrect, 0);

  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
      <StatCard
        label="Participantes"
        value={integerFormatter.format(participants)}
      />
      <StatCard
        label="Média de aproveitamento"
        value={`${averageFormatter.format(avgAccuracy)}%`}
      />
      <StatCard
        label="Maior sequência"
        value={integerFormatter.format(longestStreak)}
      />
      <StatCard
        label="Total de acertos exatos"
        value={integerFormatter.format(totalCorrect)}
      />
    </div>
  );
}
