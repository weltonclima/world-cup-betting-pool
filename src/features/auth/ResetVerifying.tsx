import { LoaderCircle } from "lucide-react";

/**
 * Estado "verificando" da redefinição de senha (PRD-01.1, TASK-04).
 *
 * Presentacional puro (sem hooks) — compartilhado entre o `fallback` do
 * `<Suspense>` na página e o estado inicial de `ResetPasswordForm`, evitando
 * divergência de markup (WARNING-1 do review).
 */
export function ResetVerifying() {
  return (
    <div className="flex flex-col items-center gap-4 py-10">
      <LoaderCircle
        size={32}
        aria-hidden="true"
        className="animate-spin text-primary motion-reduce:animate-none"
      />
      <p
        role="status"
        aria-live="polite"
        className="text-sm text-muted-foreground"
      >
        Validando o link de redefinição…
      </p>
    </div>
  );
}
