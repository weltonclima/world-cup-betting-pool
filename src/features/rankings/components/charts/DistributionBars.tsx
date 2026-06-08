import { cn } from "@/lib/utils";
import type { DistributionBucket } from "@/types";

export interface DistributionBarsProps {
  buckets: DistributionBucket[];
  className?: string;
}

/**
 * Distribuição de pontuação em barras horizontais (PRD-05 Tela 06).
 * Tailwind puro (sem Recharts). Largura da barra é proporcional ao maior `count`.
 *
 * `style={{ width }}` é a ÚNICA exceção à regra "sem estilos inline": a largura é um
 * valor de DADO (proporção), não uma decisão de estilo — padrão aceito em data-viz.
 * Cor/altura/raio ficam no Tailwind. Label e count são sempre legíveis (cor não é o
 * único indicador — acessibilidade).
 */
export function DistributionBars({ buckets, className }: DistributionBarsProps) {
  const maxCount = Math.max(1, ...buckets.map((b) => b.count));

  return (
    <div className={cn("flex flex-col gap-2", className)}>
      {buckets.map((bucket) => {
        const pct = Math.round((bucket.count / maxCount) * 100);
        return (
          <div key={bucket.label} className="flex items-center gap-3 text-sm">
            <span className="w-24 shrink-0 text-muted-foreground">
              {bucket.label}
            </span>
            <div className="h-3 flex-1 overflow-hidden rounded-full bg-muted">
              <div
                className="h-full rounded-full bg-primary"
                style={{ width: `${pct}%` }}
              />
            </div>
            <span className="w-6 shrink-0 text-right font-medium tabular-nums">
              {bucket.count}
            </span>
          </div>
        );
      })}
    </div>
  );
}
