"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { ShieldCheck } from "lucide-react";

import { useAuth } from "@/hooks/useAuth";
import { cn } from "@/lib/utils";
import { buttonVariants } from "@/components/ui/button";

/** Barra de topo fixa com identidade da aplicação. */
export function Header() {
  const { role } = useAuth();
  const pathname = usePathname();
  const isAdminRoute = pathname.startsWith("/admin");

  return (
    <header
      role="banner"
      aria-label="Cabeçalho da aplicação"
      className="fixed top-0 right-0 left-0 z-50 h-14 border-b border-border bg-background/95 backdrop-blur-sm"
    >
      <div className="flex h-full items-center justify-between px-4">
        {/* Título da aplicação */}
        <span className="text-lg font-bold text-foreground">
          Bolão dos Parças
        </span>

        {/* Ações do usuário — entrada admin role-gated (PRD-01.2, A3 camada 1) */}
        <div aria-label="Ações do usuário" className="flex items-center gap-1">
          {role === "admin" ? (
            // Navegação → link real (role="link"). Estilizado como botão ghost
            // via buttonVariants; não usa o primitive Button (que imporia
            // semântica de botão a um elemento de navegação).
            <Link
              href="/admin"
              aria-label="Painel admin"
              aria-current={isAdminRoute ? "page" : undefined}
              className={cn(buttonVariants({ variant: "ghost" }), "size-11")}
            >
              <ShieldCheck size={20} aria-hidden="true" />
            </Link>
          ) : null}
        </div>
      </div>
    </header>
  );
}
