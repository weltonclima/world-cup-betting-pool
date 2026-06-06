"use client";

import { LogOut, ShieldOff } from "lucide-react";
import { toast } from "sonner";

import { firebaseAuth } from "@/firebase";
import { Button } from "@/components/ui/button";

/**
 * Tela de acesso bloqueado para usuários com status "blocked"
 * ou em caso de erro de perfil (fallback seguro).
 */
export function BlockedScreen() {
  /** Efetua o logout via Firebase Auth. */
  async function handleSignOut() {
    try {
      await firebaseAuth.signOut();
    } catch {
      toast.error("Não foi possível sair. Tente novamente.");
    }
  }

  return (
    <div
      role="main"
      aria-label="Acesso bloqueado"
      className="flex min-h-screen flex-col items-center justify-center gap-6 bg-background px-6"
    >
      {/* Ícone de escudo bloqueado — estado destrutivo/crítico */}
      <ShieldOff
        aria-hidden="true"
        className="h-16 w-16 text-destructive"
      />

      {/* Título */}
      <h1 className="text-2xl font-semibold text-foreground text-center">
        Acesso Bloqueado
      </h1>

      {/* Descrição */}
      <p className="text-sm text-muted-foreground text-center max-w-sm">
        Sua conta foi bloqueada. Entre em contato com o administrador.
      </p>

      {/* Botão de saída — variante destructive */}
      <Button
        variant="destructive"
        onClick={() => void handleSignOut()}
        className="w-full max-w-xs"
      >
        <LogOut size={16} aria-hidden="true" />
        Sair
      </Button>
    </div>
  );
}
