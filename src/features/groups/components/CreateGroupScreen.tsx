"use client";

import { useState, type JSX } from "react";

import { CreateGroupForm } from "./CreateGroupForm";
import { GroupRequestSent } from "./GroupRequestSent";
import { GroupSubHeader } from "./GroupSubHeader";

/**
 * Tela "Criar Grupo" (PRD-09, TASK-08). Orquestra o fluxo de duas etapas:
 *   1. formulário de criação (PRD09-01)
 *   2. confirmação "Solicitação enviada" (PRD09-02) após o POST bem-sucedido.
 */
export function CreateGroupScreen(): JSX.Element {
  const [sent, setSent] = useState(false);

  if (sent) {
    return <GroupRequestSent />;
  }

  return (
    <div className="flex flex-col gap-5">
      <GroupSubHeader
        title="Criar Grupo"
        subtitle="Preencha as informações do seu grupo"
      />
      <CreateGroupForm onCreated={() => setSent(true)} />
    </div>
  );
}
