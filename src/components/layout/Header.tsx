"use client";

/** Barra de topo fixa com identidade da aplicação. */
export function Header() {
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

        {/* Slot reservado para avatar/menu do usuário — preenchido no PRD-01 */}
        <div aria-label="Ações do usuário" />
      </div>
    </header>
  );
}
