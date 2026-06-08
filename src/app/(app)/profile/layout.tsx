import type { ReactNode } from "react";

/**
 * Layout da seção Perfil (PRD-06). Aplica o tema verde escopo `.profile-theme`
 * (MASTER §2.4 — mesmo verde validado AA) a todas as telas de /profile.
 */
export default function ProfileLayout({
  children,
}: {
  children: ReactNode;
}) {
  return <div className="profile-theme flex flex-col gap-4 pb-20 md:pb-4">{children}</div>;
}
