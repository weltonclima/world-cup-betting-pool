"use client";

import type { JSX } from "react";
import Link from "next/link";
import { ChevronRight, type LucideIcon } from "lucide-react";

/**
 * Item navegável da lista de Perfil/Configurações (PRD06-01/05): ícone à
 * esquerda, título + subtítulo, chevron à direita. Renderiza como `Link`
 * (navegação) ou `button` (ação), preservando alvo de toque ≥ 44px.
 */
interface ProfileMenuItemProps {
  icon: LucideIcon;
  title: string;
  subtitle?: string;
  href?: string;
  onClick?: () => void;
  disabled?: boolean;
}

export function ProfileMenuItem({
  icon: Icon,
  title,
  subtitle,
  href,
  onClick,
  disabled = false,
}: ProfileMenuItemProps): JSX.Element {
  const content = (
    <>
      <span className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-muted text-foreground">
        <Icon size={20} aria-hidden="true" />
      </span>
      <span className="flex min-w-0 flex-1 flex-col text-left">
        <span className="text-sm font-medium text-foreground">{title}</span>
        {subtitle ? (
          <span className="truncate text-xs text-muted-foreground">
            {subtitle}
          </span>
        ) : null}
      </span>
      <ChevronRight
        size={20}
        aria-hidden="true"
        className="shrink-0 text-muted-foreground"
      />
    </>
  );

  const className =
    "flex min-h-[56px] w-full items-center gap-3 rounded-lg border border-border bg-card px-4 py-3 text-left transition-colors duration-150 hover:bg-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50";

  if (href && !disabled) {
    return (
      <Link href={href} className={className}>
        {content}
      </Link>
    );
  }

  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={className}
    >
      {content}
    </button>
  );
}
