import { MatchDetail } from "@/features/matches/components/MatchDetail";

/**
 * Página /matches/[id] — Detalhe do Jogo (TASK-06).
 *
 * Server Component intencional: sem diretiva "use client".
 * AuthGuard + AppShell já estão no layout pai (src/app/(app)/layout.tsx).
 * Toda a lógica de estado (loading/error/404/sucesso) está em <MatchDetail>.
 *
 * Next.js 15: params é uma Promise — deve ser awaited.
 */
export default async function MatchDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  return <MatchDetail id={id} />;
}
