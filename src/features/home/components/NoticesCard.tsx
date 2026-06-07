"use client";

import { AlertTriangle, Bell, Info } from "lucide-react";

import { cn } from "@/lib/utils";
import type { SystemNotice } from "@/features/home/lib/homeDashboardHelpers";

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

export interface NoticesCardProps {
  /** Lista de avisos derivados das flags do system_settings (via deriveNotices). */
  notices: SystemNotice[];
}

// ---------------------------------------------------------------------------
// Subcomponente interno: item de aviso
// ---------------------------------------------------------------------------

/** Ícone e cor por severidade do aviso. */
const SEVERITY_MAP = {
  warning: {
    Icon: AlertTriangle,
    className: "text-destructive",
  },
  info: {
    Icon: Info,
    className: "text-muted-foreground",
  },
} as const;

interface AvisoItemProps {
  notice: SystemNotice;
}

/** Renderiza um único aviso com ícone semanticamente apropriado. */
function AvisoItem({ notice }: AvisoItemProps) {
  const { Icon, className } = SEVERITY_MAP[notice.severity];

  return (
    <div className="flex items-start gap-2 py-2 border-b border-border last:border-b-0">
      <Icon
        size={16}
        className={cn(className, "shrink-0 mt-0.5")}
        aria-hidden="true"
      />
      <span className="text-sm text-foreground">{notice.message}</span>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Skeleton de carregamento (TASK-10 usa enquanto isSystemLoading)
// ---------------------------------------------------------------------------

/**
 * Skeleton do card Avisos — genérico simples, conforme §5.1 do contrato visual.
 * Exportado para uso em home/page.tsx (TASK-10).
 */
export function NoticesCardSkeleton() {
  return (
    <div
      className="rounded-lg border border-border bg-card p-4"
      role="status"
      aria-busy="true"
      aria-label="Carregando Avisos"
    >
      {/* Linha de título */}
      <div className="h-4 w-1/4 rounded bg-muted animate-pulse motion-reduce:animate-none mb-3" />
      {/* Linha de conteúdo */}
      <div className="h-6 w-1/2 rounded bg-muted animate-pulse motion-reduce:animate-none" />
    </div>
  );
}

// ---------------------------------------------------------------------------
// Componente principal
// ---------------------------------------------------------------------------

/**
 * Card Avisos — exibe comunicados do sistema derivados de system_settings.
 *
 * Puramente apresentacional: recebe SystemNotice[] via props.
 * A derivação dos avisos é responsabilidade de deriveNotices (homeDashboardHelpers).
 *
 * Estados:
 *   - Lista de avisos → renderiza cada item com ícone por severidade.
 *   - Sem avisos → mensagem neutra "Nenhum aviso no momento".
 */
export function NoticesCard({ notices }: NoticesCardProps) {
  return (
    <section
      aria-label="Avisos do sistema"
      className="rounded-lg border border-border bg-card p-4 shadow-sm"
    >
      {/* Título do card */}
      <h2 className="flex items-center gap-2 text-sm font-semibold text-foreground mb-3">
        <Bell size={16} className="text-primary" aria-hidden="true" />
        Avisos
      </h2>

      {notices.length === 0 ? (
        /* Estado vazio — sem avisos ativos */
        <p className="text-sm text-muted-foreground text-center py-3">
          Nenhum aviso no momento
        </p>
      ) : (
        /* Lista de avisos */
        <div>
          {notices.map((notice) => (
            <AvisoItem key={notice.id} notice={notice} />
          ))}
        </div>
      )}
    </section>
  );
}
