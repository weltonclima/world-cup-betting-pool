"use client";

import type { JSX } from "react";

import {
  usePasskeys,
  usePasskeySupport,
  useRegisterPasskey,
} from "../hooks";
import { deriveDeviceLabel } from "../lib/deviceLabel";
import { AddPasskeyButton } from "./AddPasskeyButton";
import { PasskeyList } from "./PasskeyList";
import { PasskeyEmptyState } from "./PasskeyEmptyState";
import { PasskeyUnsupportedNotice } from "./PasskeyUnsupportedNotice";

/** Seção rotulada (consistente com SettingsMenu). */
function Section({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}): JSX.Element {
  return (
    <section className="flex flex-col gap-2">
      <h2 className="px-1 text-xs font-medium uppercase tracking-wide text-muted-foreground">
        {title}
      </h2>
      {children}
    </section>
  );
}

/**
 * Orquestra a tela de Segurança/Biometria (TASK-06): detecção de suporte,
 * registro (CTA) e lista/remoção. Fallback e-mail+senha nunca é afetado.
 */
export function PasskeyManager(): JSX.Element {
  const { supported, isWebView } = usePasskeySupport();
  const passkeys = usePasskeys();
  const register = useRegisterPasskey();

  const list = passkeys.data ?? [];
  // `isPending` cobre tanto o fetch em curso quanto o intervalo em que a query
  // está `disabled` (uid ainda não resolvido) — evita piscar o EmptyState antes
  // da lista. Não acopla firebase no componente (testável via mock do hook).
  const isLoading = passkeys.isPending;

  return (
    <div className="flex flex-col gap-5">
      <Section title="Login por biometria">
        {isWebView ? (
          <PasskeyUnsupportedNotice reason="webview" />
        ) : supported === false ? (
          <PasskeyUnsupportedNotice reason="unsupported" />
        ) : (
          <AddPasskeyButton
            onClick={() => register.mutate(deriveDeviceLabel())}
            loading={register.isPending}
            disabled={supported === null}
          />
        )}
        <p className="px-1 text-xs text-muted-foreground">
          Entre mais rápido usando a biometria do seu celular. Sua senha
          continua válida.
        </p>
      </Section>

      {list.length > 0 ? (
        <Section title="Dispositivos cadastrados">
          <PasskeyList passkeys={list} />
        </Section>
      ) : isLoading ? (
        <div className="flex flex-col gap-2">
          <div
            aria-hidden="true"
            className="h-14 animate-pulse rounded-lg border border-border bg-card motion-reduce:animate-none"
          />
          <div
            aria-hidden="true"
            className="h-14 animate-pulse rounded-lg border border-border bg-card motion-reduce:animate-none"
          />
        </div>
      ) : passkeys.isError ? (
        <div
          role="alert"
          className="flex flex-col items-center gap-3 rounded-lg border border-destructive/40 bg-card px-4 py-6 text-center"
        >
          <p className="text-sm text-muted-foreground">
            Não foi possível carregar seus dispositivos.
          </p>
          <button
            type="button"
            onClick={() => void passkeys.refetch()}
            className="rounded-lg border border-border px-4 py-2 text-sm font-medium text-foreground transition-colors hover:bg-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            Tentar novamente
          </button>
        </div>
      ) : (
        <PasskeyEmptyState />
      )}
    </div>
  );
}
