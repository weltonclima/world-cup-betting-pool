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
  // Id namespaced de liga traz ':' — Next/Turbopack o normaliza para `%3A` em
  // `params.id`. Decodifica p/ o id CANÔNICO (cru) fluir na árvore; o serviço então
  // encoda 1× no fetch (sem duplo-encode → sem 404 no detalhe). Idempotente p/ ids
  // sem '%' (Copa legada); guarda contra sequência malformada.
  let matchId = id;
  try {
    matchId = decodeURIComponent(id);
  } catch {
    // mantém o valor cru
  }
  return <MatchDetail id={matchId} />;
}
