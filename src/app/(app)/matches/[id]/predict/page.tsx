import { PredictionForm } from "@/features/predictions/components";

/**
 * Página /matches/[id]/predict — Enviar/Editar Palpite (TASK-07).
 *
 * Server Component intencional: sem diretiva "use client".
 * AuthGuard + AppShell aplicados pelo layout pai src/app/(app)/layout.tsx.
 * Toda a lógica de estado (loading/error/locked/success) está em <PredictionForm>.
 *
 * Next.js 15: params é uma Promise — deve ser awaited.
 */
export default async function PredictPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  // Ver /matches/[id]/page.tsx: ':' do id namespaced vira `%3A` em `params.id`.
  // Decodifica p/ o matchId canônico (cru) — senão o palpite de jogo de liga bate
  // em id encodado e o detalhe/lookup dá 404. Idempotente p/ ids sem '%'.
  let matchId = id;
  try {
    matchId = decodeURIComponent(id);
  } catch {
    // mantém o valor cru
  }
  return <PredictionForm matchId={matchId} />;
}
