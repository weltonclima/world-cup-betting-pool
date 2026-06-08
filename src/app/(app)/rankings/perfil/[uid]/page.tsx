import { ParticipantProfile } from "@/features/rankings";

/** Perfil do Participante (Tela 05) — PRD-05, TASK-12. Next 15: params é Promise. */
export default async function PerfilParticipantePage({
  params,
}: {
  params: Promise<{ uid: string }>;
}) {
  const { uid } = await params;
  return <ParticipantProfile uid={uid} />;
}
