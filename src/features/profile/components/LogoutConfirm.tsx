"use client";

import { useState, type JSX } from "react";
import { useRouter } from "next/navigation";
import { useQueryClient } from "@tanstack/react-query";
import { LogOut } from "lucide-react";
import { toast } from "sonner";

import { signOut } from "@/services/auth";
import { Button } from "@/components/ui/button";

/** Tela 06 — Encerrar Sessão (confirmação) (PRD06-06). */
export function LogoutConfirm(): JSX.Element {
  const router = useRouter();
  const queryClient = useQueryClient();
  const [pending, setPending] = useState(false);

  async function handleLogout(): Promise<void> {
    setPending(true);
    try {
      await signOut();
      // Limpa cache de dados e preferências locais (PRD-06: "limpar cache local").
      queryClient.clear();
      try {
        window.localStorage.clear();
      } catch {
        // localStorage indisponível (modo privado) — ignorável.
      }
      router.replace("/login");
    } catch {
      toast.error("Não foi possível encerrar a sessão. Tente novamente.");
      setPending(false);
    }
  }

  return (
    <div className="mx-auto flex max-w-sm flex-col items-center gap-6 py-10 text-center">
      <span className="flex size-20 items-center justify-center rounded-full bg-destructive/10 text-destructive">
        <LogOut size={36} aria-hidden="true" />
      </span>

      <div className="flex flex-col gap-2">
        <h1 className="text-xl font-semibold text-foreground">
          Deseja realmente encerrar sua sessão?
        </h1>
        <p className="text-sm text-muted-foreground">
          Você precisará fazer login novamente para acessar sua conta.
        </p>
      </div>

      <div className="flex w-full flex-col gap-3">
        <Button
          type="button"
          variant="destructive"
          className="h-12 w-full"
          disabled={pending}
          onClick={handleLogout}
        >
          {pending ? "Encerrando…" : "Sim, encerrar sessão"}
        </Button>
        <Button
          type="button"
          variant="outline"
          className="h-12 w-full"
          disabled={pending}
          onClick={() => router.back()}
        >
          Cancelar
        </Button>
      </div>
    </div>
  );
}
