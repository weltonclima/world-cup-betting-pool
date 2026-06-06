"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Clock, LoaderCircle } from "lucide-react";
import { toast } from "sonner";

import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";

/**
 * Tela para usuários com status "pending" (PRD-01, TASK-09).
 *
 * Layout claro conforme `docs/prd-01/aguardando.png`: título no topo, relógio +
 * textos no centro, botão "Atualizar status" na base. Classe `.auth-light` dá o
 * `--primary` verde ao botão (texto/borda) com contraste AA. Sem botão "Sair"
 * (segue o mock).
 *
 * Leitura de `status` pós-refresh sem corrida:
 * O `status` lido do `useAuth()` dentro do handler é o valor da closure daquele
 * render — após `await refreshProfile()` (que dispara setState e re-renderiza)
 * essa closure continua obsoleta. Por isso a decisão (redirect/toast) NÃO é
 * tomada no handler: ele só marca um "tick" (`refreshTick`). Um `useEffect` que
 * depende de `refreshTick` roda no render seguinte lendo o `status`/`error` JÁ
 * commitados (frescos), eliminando a corrida. O tick incrementa a cada clique
 * para o efeito disparar mesmo quando `status` permanece "pending".
 */
export function PendingApprovalScreen() {
  const router = useRouter();
  const { refreshProfile, status, error } = useAuth();

  // true enquanto a releitura do perfil está em andamento (desabilita o botão).
  const [refreshing, setRefreshing] = useState(false);
  // Contador incrementado após cada releitura concluída. Dispara o efeito de
  // decisão lendo o status/erro frescos do contexto. 0 = nenhum refresh ainda.
  const [refreshTick, setRefreshTick] = useState(0);

  /** Releitura manual do perfil. A decisão é tomada no efeito abaixo. */
  async function handleRefresh() {
    setRefreshing(true);
    try {
      await refreshProfile();
    } finally {
      // Avança o tick mesmo em caso de falha: o efeito lê `error` e avisa.
      setRefreshTick((tick) => tick + 1);
      setRefreshing(false);
    }
  }

  // Decide o desfecho do refresh com base no estado JÁ commitado do contexto.
  // Só roda após um refresh real (refreshTick > 0), nunca na montagem inicial.
  useEffect(() => {
    if (refreshTick === 0) return;

    if (error) {
      toast.error("Não foi possível atualizar. Tente novamente.");
      return;
    }

    if (status === "approved") {
      router.push("/home");
      return;
    }

    // Continua pendente (ou status indisponível por outro motivo): informa.
    toast.info("Ainda aguardando aprovação.");
  }, [refreshTick, status, error, router]);

  return (
    <div
      role="main"
      aria-label="Aguardando aprovação"
      className="auth-light flex min-h-screen flex-col bg-background px-6 py-10"
    >
      {/* Título — topo */}
      <header className="pt-4 text-center">
        <h1 className="text-2xl font-semibold text-foreground">
          Aguardando Aprovação
        </h1>
      </header>

      {/* Conteúdo — centro: relógio em círculo + mensagens */}
      <div className="flex flex-1 flex-col items-center justify-center gap-6 text-center">
        <div className="flex h-28 w-28 items-center justify-center rounded-full bg-muted">
          <Clock aria-hidden="true" className="h-14 w-14 text-muted-foreground" />
        </div>

        <div className="flex max-w-sm flex-col gap-2">
          <p className="text-lg font-semibold text-foreground">
            Cadastro realizado!
          </p>
          <p className="text-sm text-muted-foreground">
            Seu acesso está aguardando aprovação do administrador.
          </p>
          <p className="text-sm text-muted-foreground">
            Você receberá um email quando sua conta for liberada.
          </p>
        </div>
      </div>

      {/* Ação — base: releitura do perfil (texto/borda verde) */}
      <Button
        variant="outline"
        onClick={() => void handleRefresh()}
        disabled={refreshing}
        aria-busy={refreshing}
        className="h-11 w-full border-primary text-primary hover:bg-primary/10 hover:text-primary"
      >
        {refreshing ? (
          <LoaderCircle
            size={16}
            aria-hidden="true"
            className="animate-spin motion-reduce:animate-none"
          />
        ) : null}
        {refreshing ? "Atualizando..." : "Atualizar status"}
      </Button>
    </div>
  );
}
