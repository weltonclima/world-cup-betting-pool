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
  return <PredictionForm matchId={id} />;
}
