"use client";

/**
 * CompactScoreInput — input de placar compacto e DIGITÁVEL (TASK-06, palpites-massa).
 *
 * Variante do `ScoreInput` (stepper +/-) para preenchimento em massa: o usuário
 * digita o número de gols e navega entre campos com TAB (ordem natural do DOM).
 *
 * Contrato: ai/spec/palpites-massa-task-06.md §6 · ai/screen/palpites-massa-task-06.md §5
 *
 * Acessibilidade:
 * - `aria-label` obrigatório (ex.: "Gols Brasil") — o campo não tem label visível próprio.
 * - `inputMode="numeric"` + `pattern="[0-9]*"` abrem o teclado numérico no mobile.
 * - Estado inválido expõe `aria-invalid` + `aria-describedby` (mensagem associada).
 * - `min-h-[44px] min-w-[44px]` garante WCAG 2.5.5.
 * - Navegação TAB nativa (sem tabIndex positivo, sem captura de teclado).
 *
 * Tema: usa apenas tokens (`border-input`, `ring-ring`, `bg-card`, `border-destructive`).
 * Dentro do escopo `.palpites-theme` o foco herda o verde; fora, permanece neutro.
 */

import { useId } from "react";

import { cn } from "@/lib/utils";

export interface CompactScoreInputProps {
  /** aria-label obrigatório (ex.: "Gols Brasil"). */
  label: string;
  /** Valor atual; `null` = campo vazio / placar não preenchido. */
  value: number | null;
  /** Emitido a cada mudança; `null` quando o campo é esvaziado. */
  onChange: (value: number | null) => void;
  /** Desabilita o campo (estado genérico). */
  disabled?: boolean;
  /** Jogo bloqueado por kickoff — desabilita e sinaliza para leitores de tela. */
  locked?: boolean;
  /** Marca o campo como inválido (borda destrutiva + aria-invalid). */
  invalid?: boolean;
  /** Mensagem de erro associada via aria-describedby (renderiza apenas se `invalid`). */
  errorMessage?: string;
  /** Valor mínimo permitido. Default 0. */
  min?: number;
  /** Valor máximo permitido. Default 99. */
  max?: number;
  /** id do input (para associação externa de label). */
  id?: string;
  className?: string;
}

export function CompactScoreInput({
  label,
  value,
  onChange,
  disabled = false,
  locked = false,
  invalid = false,
  errorMessage,
  min = 0,
  max = 99,
  id,
  className,
}: CompactScoreInputProps) {
  const generatedId = useId();
  const inputId = id ?? generatedId;
  const errorId = `${inputId}-error`;
  const isDisabled = disabled || locked;
  const showError = invalid && Boolean(errorMessage);

  function handleChange(event: React.ChangeEvent<HTMLInputElement>) {
    // Mantém apenas dígitos.
    const digits = event.target.value.replace(/\D/g, "");

    if (digits === "") {
      onChange(null);
      return;
    }

    const parsed = Number.parseInt(digits, 10);
    const clamped = Math.min(Math.max(parsed, min), max);
    onChange(clamped);
  }

  return (
    <>
      <input
        id={inputId}
        type="text"
        inputMode="numeric"
        pattern="[0-9]*"
        autoComplete="off"
        aria-label={label}
        aria-invalid={invalid || undefined}
        aria-describedby={showError ? errorId : undefined}
        disabled={isDisabled}
        value={value ?? ""}
        onChange={handleChange}
        maxLength={String(max).length}
        className={cn(
          "min-h-[44px] min-w-[44px] w-12 rounded-md border bg-card text-center text-lg font-bold text-foreground",
          "transition-colors duration-150 motion-reduce:transition-none",
          "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
          "disabled:opacity-50 disabled:cursor-not-allowed",
          invalid ? "border-destructive" : "border-input",
          className,
        )}
      />
      {showError ? (
        <span id={errorId} role="alert" className="text-xs text-destructive">
          {errorMessage}
        </span>
      ) : null}
    </>
  );
}
