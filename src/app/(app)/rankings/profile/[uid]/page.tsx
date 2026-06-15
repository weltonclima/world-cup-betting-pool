import { ParticipantProfile } from "@/features/rankings";
import { BackButton } from "@/components/layout/BackButton";

/** Perfil do Participante (Tela 05) — PRD-05, TASK-12. Next 15: params é Promise. */
export default async function PerfilParticipantePage({
  params,
}: {
  params: Promise<{ uid: string }>;
}) {
  const { uid } = await params;
  return (
    <>
      <BackButton />
      <ParticipantProfile uid={uid} />
    </>
  );
}
