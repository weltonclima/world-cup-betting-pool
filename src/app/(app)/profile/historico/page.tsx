import { PredictionHistory, ProfileSubHeader } from "@/features/profile/components";

/** Tela 03 — Histórico de Palpites (PRD-06, PRD06-03). */
export default function HistoricoPage() {
  return (
    <>
      <ProfileSubHeader title="Histórico de Palpites" />
      <PredictionHistory />
    </>
  );
}
