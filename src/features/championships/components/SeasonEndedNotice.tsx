"use client";

/**
 * SeasonEndedNotice — estado "temporada encerrada" da ÁREA ATIVA (bugfix
 * multi-championship).
 *
 * Exibido quando o pool não tem NENHUM campeonato ativo (todos arquivados — ex.:
 * pool legado só-Copa após o fim do torneio). Substitui o conteúdo de
 * jogos/palpite/ranking/home, que antes mostrava a Copa encerrada. Aponta o
 * usuário ao Histórico (ranking/estatísticas finais congeladas) e, quando o
 * pool pode habilitar um novo campeonato, oferece o atalho de configuração.
 *
 * Reutiliza os tokens visuais da casa (ícone 40 / `text-muted-foreground`,
 * `role="status"`, `py-12` centralizado) — mesma linguagem de `CupOnlyNotice` /
 * `RankingEmptyState`, só muda a semântica (encerrado ≠ sem-dados ≠ não-aplicável).
 */

import Link from "next/link";
import { Trophy } from "lucide-react";

import { buttonVariants } from "@/components/ui/button";
import { useAuth } from "@/hooks/useAuth";
import { isGroupAdminRole, isSuperAdminRole } from "@/schemas/shared";
import { cn } from "@/lib/utils";

const HISTORY_HREF = "/rankings/history";
const SETTINGS_HREF = "/group/settings";

export interface SeasonEndedNoticeProps {
  /**
   * Mensagem principal. Default: temporada encerrada. Consumidores podem
   * contextualizar (ex.: "Nenhum jogo ativo — a temporada foi encerrada").
   */
  message?: string;
  /** Subtítulo opcional (contexto por tela). */
  subtitle?: string;
  /**
   * Força mostrar/ocultar o atalho "Habilitar novo campeonato" (config do grupo).
   * Ausente (default) → AUTO: exibido só para admin do grupo (group_admin/
   * super_admin) — é a ação que reativa o pool. Participante comum não o vê.
   */
  showEnableCta?: boolean;
  className?: string;
}

/** Aviso centralizado "temporada encerrada → veja o Histórico". */
export function SeasonEndedNotice({
  message = "Temporada encerrada",
  subtitle = "O campeonato foi arquivado. O ranking e as estatísticas finais estão no Histórico.",
  showEnableCta,
  className,
}: SeasonEndedNoticeProps) {
  const { profile } = useAuth();
  const role = profile?.role ?? null;
  const isAdmin = role !== null && (isGroupAdminRole(role) || isSuperAdminRole(role));
  // Override explícito vence; senão, exibe o CTA de reativação só para admin.
  const enableCta = showEnableCta ?? isAdmin;
  return (
    <div
      role="status"
      className={cn(
        "flex flex-col items-center justify-center py-12 gap-3 text-center px-4",
        className,
      )}
    >
      <Trophy size={40} aria-hidden="true" className="text-muted-foreground" />
      <p className="text-sm font-medium text-foreground">{message}</p>
      {subtitle ? (
        <p className="text-sm text-muted-foreground max-w-xs">{subtitle}</p>
      ) : null}
      <div className="flex flex-col sm:flex-row items-center gap-2 mt-1">
        <Link
          href={HISTORY_HREF}
          className={cn(
            buttonVariants({ variant: "default", size: "sm" }),
            "min-h-11 px-4", // alvo de toque ≥44px (mobile)
          )}
        >
          Ver Histórico
        </Link>
        {enableCta ? (
          <Link
            href={SETTINGS_HREF}
            className={cn(
              buttonVariants({ variant: "outline", size: "sm" }),
              "min-h-11 px-4",
            )}
          >
            Habilitar novo campeonato
          </Link>
        ) : null}
      </div>
    </div>
  );
}
