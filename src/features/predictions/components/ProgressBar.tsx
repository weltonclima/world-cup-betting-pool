/**
 * ProgressBar — barra de progresso percentual com label "X / Y" (TASK-06).
 *
 * Usada no Hub ("72 / 104" · "44%") e dentro do GroupCard (progresso do grupo).
 *
 * Contrato: ai/spec/palpites-massa-task-06.md §6 · ai/screen/palpites-massa-task-06.md §5
 *
 * Acessibilidade:
 * - `role="progressbar"` + `aria-valuemin/max/now/valuetext`.
 * - Status nunca por cor isolada — a fração textual acompanha a barra.
 *
 * Tema: trilho `bg-muted`, preenchimento `bg-primary` (herda o verde dentro de
 * `.palpites-theme`; neutro fora). Sem hex, sem cor inline.
 *
 * Nota (exceção geométrica): a largura percentual do preenchimento é o ÚNICO
 * valor dinâmico sem classe Tailwind estática equivalente. Aplicada via
 * `style={{ width }}` — puramente geométrica, nenhuma propriedade de cor/tema.
 */

import { cn } from "@/lib/utils";

export interface ProgressBarProps {
  /** Quantidade preenchida. */
  value: number;
  /** Total possível. */
  total: number;
  /** Sobrescreve o label "X / Y" default. */
  label?: string;
  /** Exibe a fração "X / Y". Default true. */
  showFraction?: boolean;
  /** Exibe o percentual "Z%". Default true. */
  showPercent?: boolean;
  className?: string;
}

export function ProgressBar({
  value,
  total,
  label,
  showFraction = true,
  showPercent = true,
  className,
}: ProgressBarProps) {
  const safeTotal = total > 0 ? total : 0;
  const safeValue = Math.min(Math.max(value, 0), safeTotal);
  const percent = safeTotal > 0 ? Math.round((safeValue / safeTotal) * 100) : 0;

  const fractionLabel = label ?? `${safeValue} / ${safeTotal}`;
  const valueText = `${safeValue} / ${safeTotal} (${percent}%)`;

  return (
    <div className={cn("flex flex-col gap-1", className)}>
      {showFraction || showPercent ? (
        <div className="flex items-center justify-between gap-2">
          {showFraction ? (
            <span className="text-sm font-medium text-foreground">
              {fractionLabel}
            </span>
          ) : null}
          {showPercent ? (
            <span className="text-sm font-semibold text-foreground">
              {percent}%
            </span>
          ) : null}
        </div>
      ) : null}

      <div
        role="progressbar"
        aria-valuemin={0}
        aria-valuemax={safeTotal}
        aria-valuenow={safeValue}
        aria-valuetext={valueText}
        className="h-2 w-full overflow-hidden rounded-full bg-muted"
      >
        <div
          className="h-full rounded-full bg-primary transition-[width] duration-300 motion-reduce:transition-none"
          style={{ width: `${percent}%` }}
        />
      </div>
    </div>
  );
}
