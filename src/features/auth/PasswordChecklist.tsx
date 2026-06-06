import { CheckCircle2, Circle, Info } from "lucide-react";

import { cn } from "@/lib/utils";
import { RESET_PASSWORD_MIN_LENGTH } from "@/features/auth/schemas";

/**
 * Checklist ao vivo das regras de senha da tela "Definir nova senha"
 * (PRD-01.1, TASK-04, mock `04-nova-senha.png`).
 *
 * Duas regras são validações REAIS, derivadas do `resetPasswordSchema`:
 *  - mínimo de caracteres (`RESET_PASSWORD_MIN_LENGTH`);
 *  - conter letras E números.
 *
 * A terceira ("não pode ser igual à anterior") é apenas INFORMATIVA (A2): o app
 * não conhece a senha atual, logo não é verificável no fluxo de reset e NÃO
 * bloqueia o submit. É renderizada como item neutro/informativo.
 */
interface PasswordChecklistProps {
  value: string;
}

type RuleStatus = "satisfied" | "pending" | "info";

interface Rule {
  label: string;
  status: RuleStatus;
}

export function PasswordChecklist({ value }: PasswordChecklistProps) {
  const hasMinLength = value.length >= RESET_PASSWORD_MIN_LENGTH;
  const hasLetterAndNumber = /[A-Za-z]/.test(value) && /[0-9]/.test(value);

  const rules: Rule[] = [
    {
      label: `Mínimo de ${RESET_PASSWORD_MIN_LENGTH} caracteres`,
      status: hasMinLength ? "satisfied" : "pending",
    },
    {
      label: "Letras e números",
      status: hasLetterAndNumber ? "satisfied" : "pending",
    },
    // Informativa — sempre "info" (não derivada de `value`, não bloqueante).
    { label: "Não pode ser igual à anterior", status: "info" },
  ];

  return (
    <ul aria-live="polite" className="flex flex-col gap-2">
      {rules.map((rule) => (
        <li
          key={rule.label}
          data-state={rule.status}
          className={cn(
            "flex items-center gap-2 text-sm",
            rule.status === "satisfied"
              ? "text-foreground"
              : "text-muted-foreground",
          )}
        >
          {rule.status === "satisfied" ? (
            <CheckCircle2 size={16} className="text-primary" aria-hidden="true" />
          ) : rule.status === "info" ? (
            <Info size={16} className="text-muted-foreground" aria-hidden="true" />
          ) : (
            <Circle size={16} className="text-muted-foreground" aria-hidden="true" />
          )}
          <span>{rule.label}</span>
          <span className="sr-only">
            {rule.status === "satisfied"
              ? " — concluído"
              : rule.status === "info"
                ? " — informativo, não validado"
                : " — pendente"}
          </span>
        </li>
      ))}
    </ul>
  );
}
