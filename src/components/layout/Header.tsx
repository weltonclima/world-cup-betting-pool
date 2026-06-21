"use client";

import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { ShieldCheck } from "lucide-react";

import { useAuth } from "@/hooks/useAuth";
import { cn } from "@/lib/utils";
import { buttonVariants } from "@/components/ui/button";
import { NotificationBell } from "@/features/notifications/components/NotificationBell";
import { useForegroundPush } from "@/features/push/hooks/useForegroundPush";

/** Barra de topo fixa com identidade da aplicação. */
export function Header() {
  const { role } = useAuth();
  const pathname = usePathname();
  const isAdminRoute = pathname.startsWith("/admin");
  // Dedup de push em foreground (TASK-05): app aberto não duplica o sino+toast.
  useForegroundPush();

  return (
    <header
      role="banner"
      aria-label="Cabeçalho da aplicação"
      className="fixed top-0 right-0 left-0 z-50 h-20 border-b border-border bg-background/95 backdrop-blur-sm"
    >
      <div className="flex h-full items-center justify-between px-4">
        {/* Identidade da aplicação — logo clicável para a home.
            Dimensões intrínsecas (560×373) evitam CLS; altura visual h-8.
            priority: header sempre visível (evita flash/LCP penalty). */}
        <Link
          href="/home"
          aria-label="Bolão dos Parças — página inicial"
          className="inline-flex items-center rounded-md transition-opacity hover:opacity-90 focus-visible:ring-2 focus-visible:ring-primary focus-visible:outline-none"
        >
          <Image
            src="/logo-login.png"
            alt="Bolão dos Parças"
            width={560}
            height={373}
            priority
            className="h-16 w-auto object-contain"
          />
        </Link>

        {/* Ações do usuário — sino de notificações (PRD-08) + entrada admin
            role-gated (PRD-01.2, A3 camada 1) */}
        <div aria-label="Ações do usuário" className="flex items-center gap-1">
          <NotificationBell />
          {role === "admin" ? (
            // Navegação → link real (role="link"). Estilizado como botão ghost
            // via buttonVariants; não usa o primitive Button (que imporia
            // semântica de botão a um elemento de navegação).
            <Link
              href="/admin/dashboard"
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
