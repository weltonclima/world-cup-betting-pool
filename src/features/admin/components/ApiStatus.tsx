"use client";

import type { JSX } from "react";
import { CloudOff, Info } from "lucide-react";

import { Badge } from "@/components/ui/badge";

// Endpoints da API-Football monitorados (PRD07-05). Os valores de telemetria
// (status/latência/cache) NÃO são persistidos nesta versão (D-A3) — a tela
// mostra a estrutura com estado honesto "sem dados".
const ENDPOINTS = ["/matches", "/teams", "/standings", "/fixtures", "/players"];

/** Tela — Status da API (PRD07-05). Placeholder honesto (D-A3). */
export function ApiStatus(): JSX.Element {
  return (
    <div className="flex flex-col gap-4">
      {/* Card principal */}
      <section className="flex items-center justify-between gap-3 rounded-2xl border border-border bg-card p-5">
        <div className="flex items-center gap-3">
          <CloudOff size={28} aria-hidden="true" className="text-muted-foreground" />
          <div className="flex flex-col">
            <span className="text-base font-semibold text-foreground">
              API-Football
            </span>
            <span className="text-xs text-muted-foreground">
              Telemetria indisponível nesta versão
            </span>
          </div>
        </div>
        <Badge variant="secondary">Sem dados</Badge>
      </section>

      {/* Endpoints monitorados */}
      <section className="flex flex-col gap-2" aria-labelledby="endpoints">
        <h2 id="endpoints" className="text-lg font-medium text-foreground">
          Endpoints Monitorados
        </h2>
        <ul className="flex flex-col gap-2">
          {ENDPOINTS.map((endpoint) => (
            <li
              key={endpoint}
              className="flex items-center justify-between gap-2 rounded-lg border border-border bg-card px-4 py-3"
            >
              <span className="font-mono text-sm text-foreground">{endpoint}</span>
              <span className="text-xs text-muted-foreground">— ms</span>
            </li>
          ))}
        </ul>
      </section>

      {/* Cache */}
      <section className="flex flex-col gap-2" aria-labelledby="cache">
        <h2 id="cache" className="text-lg font-medium text-foreground">
          Informações do Cache
        </h2>
        <div className="grid grid-cols-2 gap-3">
          {[
            { label: "Hit Rate", value: "—" },
            { label: "Itens em Cache", value: "—" },
            { label: "Próxima Expiração", value: "—" },
            { label: "Revalidação Média", value: "—" },
          ].map((item) => (
            <div
              key={item.label}
              className="flex flex-col gap-1 rounded-lg border border-border bg-card p-4"
            >
              <span className="text-xs font-medium text-muted-foreground">
                {item.label}
              </span>
              <span className="text-2xl font-bold tabular-nums text-foreground">
                {item.value}
              </span>
            </div>
          ))}
        </div>
      </section>

      {/* Aviso honesto */}
      <div className="flex items-start gap-2 rounded-lg bg-muted p-4">
        <Info size={16} aria-hidden="true" className="mt-0.5 shrink-0 text-muted-foreground" />
        <p className="text-xs text-muted-foreground">
          A telemetria da API-Football (status, latência e cache) ainda não é
          instrumentada. Esta tela será preenchida quando os Route Handlers
          registrarem métricas.
        </p>
      </div>
    </div>
  );
}
