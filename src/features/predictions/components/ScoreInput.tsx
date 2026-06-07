"use client";

/**
 * ScoreInput — stepper acessível de placar (TASK-07).
 *
 * Componente reutilizável de incremento/decremento de gols.
 * Sem React Hook Form — recebe valor e callbacks diretamente.
 *
 * Acessibilidade:
 * - role="group" + aria-label agrupa os controles para screen readers.
 * - <output aria-live="polite"> anuncia mudanças de valor sem interromper o fluxo.
 * - Botões com aria-label descritivos (ex.: "Diminuir Gols Mandante").
 * - min-h-[44px] min-w-[44px] garante WCAG 2.5.5 em ambas as dimensões.
 * - type="button" evita submit acidental quando dentro de <form>.
 */

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

export interface ScoreInputProps {
  /** Nome do campo — ex.: "Gols Mandante" — usado para aria-label do grupo e dos botões. */
  label: string;
  /** Valor atual (número de gols). */
  value: number;
  /** Callback de mudança de valor. */
  onChange: (value: number) => void;
  /** Desabilita os botões — true no estado Bloqueado. */
  disabled?: boolean;
  /** Valor mínimo permitido. Default: 0. */
  min?: number;
  /** Valor máximo permitido. Default: 20. */
  max?: number;
}

// ---------------------------------------------------------------------------
// Componente
// ---------------------------------------------------------------------------

export function ScoreInput({
  label,
  value,
  onChange,
  disabled = false,
  min = 0,
  max = 20,
}: ScoreInputProps) {
  const canDecrement = !disabled && value > min;
  const canIncrement = !disabled && value < max;

  return (
    <div
      role="group"
      aria-label={label}
      className="flex flex-col items-center gap-2"
    >
      {/* Label visual acima do stepper */}
      <span className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
        {label}
      </span>

      {/* Controles do stepper */}
      <div className="flex items-center gap-4">
        {/* Botão decrementar */}
        <button
          type="button"
          onClick={() => onChange(Math.max(min, value - 1))}
          disabled={!canDecrement}
          aria-label={`Diminuir ${label}`}
          className="min-h-[44px] min-w-[44px] flex items-center justify-center rounded-lg border border-border bg-background text-2xl font-bold text-foreground hover:bg-muted transition-colors duration-150 motion-reduce:transition-none focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          −
        </button>

        {/* Valor central — display semântico com anúncio de mudança */}
        <output
          aria-live="polite"
          aria-label={`${label}: ${value}`}
          className="text-5xl font-bold text-foreground min-w-[3rem] text-center"
        >
          {value}
        </output>

        {/* Botão incrementar */}
        <button
          type="button"
          onClick={() => onChange(Math.min(max, value + 1))}
          disabled={!canIncrement}
          aria-label={`Aumentar ${label}`}
          className="min-h-[44px] min-w-[44px] flex items-center justify-center rounded-lg border border-border bg-background text-2xl font-bold text-foreground hover:bg-muted transition-colors duration-150 motion-reduce:transition-none focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          +
        </button>
      </div>
    </div>
  );
}
