"use client";

/**
 * Tela de carregamento exibida enquanto o estado de autenticação é resolvido.
 * Respeita `prefers-reduced-motion` para o spinner.
 */
export function LoadingScreen() {
  return (
    <div
      role="status"
      aria-live="polite"
      aria-label="Carregando aplicação"
      className="flex min-h-screen flex-col items-center justify-center gap-4 bg-background"
    >
      {/* Spinner circular com reduced-motion */}
      <div
        aria-hidden="true"
        className="h-10 w-10 animate-spin rounded-full border-4 border-border border-t-primary motion-reduce:animate-none"
      />

      {/* Texto para leitores de tela */}
      <span className="sr-only">Carregando aplicação...</span>
    </div>
  );
}
