"use client";

import type { JSX } from "react";
import { Info } from "lucide-react";

/** Aviso de indisponibilidade de biometria (sem suporte ou WebView — A9, TASK-06). */
export function PasskeyUnsupportedNotice({
  reason,
}: {
  reason: "unsupported" | "webview";
}): JSX.Element {
  const message =
    reason === "webview"
      ? "Abra o app no navegador (Chrome ou Safari) para ativar a biometria."
      : "Seu dispositivo ou navegador não suporta biometria. Você pode continuar usando e-mail e senha.";

  return (
    <div
      role="note"
      className="flex items-start gap-3 rounded-lg border border-border bg-muted/50 px-4 py-3"
    >
      <Info
        size={20}
        aria-hidden="true"
        className="mt-0.5 shrink-0 text-muted-foreground"
      />
      <p className="text-sm text-muted-foreground">{message}</p>
    </div>
  );
}
