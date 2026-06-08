import type { ReactNode } from "react";

/**
 * Layout da Central de Notificações (PRD-08). Aplica o tema verde escopo
 * `.notifications-theme` (MASTER §2.4 — mesmo verde validado AA).
 */
export default function NotificacoesLayout({
  children,
}: {
  children: ReactNode;
}) {
  return (
    <div className="notifications-theme flex flex-col gap-4 pb-20 md:pb-4">
      {children}
    </div>
  );
}
