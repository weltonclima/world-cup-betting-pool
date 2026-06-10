"use client";

import type { JSX } from "react";
import { Fingerprint } from "lucide-react";

/** Estado vazio da lista de passkeys (TASK-06). */
export function PasskeyEmptyState(): JSX.Element {
  return (
    <div className="flex flex-col items-center gap-2 rounded-lg border border-dashed border-border bg-card px-4 py-8 text-center">
      <Fingerprint
        size={28}
        aria-hidden="true"
        className="text-muted-foreground"
      />
      <p className="text-sm text-muted-foreground">
        Nenhum dispositivo cadastrado ainda.
      </p>
    </div>
  );
}
