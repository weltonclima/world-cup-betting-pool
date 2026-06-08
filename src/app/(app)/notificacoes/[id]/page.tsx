import { NotificationDetail } from "@/features/notifications/components";

/** Tela 02 — Detalhe da Notificação (PRD-08, PRD08-02). */
export default async function NotificacaoDetalhePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  return <NotificationDetail id={id} />;
}
