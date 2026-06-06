"use client";

import { useState, type ReactNode } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";

// Cache padrão do projeto (.claude/CLAUDE.md):
const STALE_TIME = 30 * 60 * 1000; // 30 minutos
const GC_TIME = 24 * 60 * 60 * 1000; // 24 horas

/**
 * Cria um QueryClient com as opções de cache padrão do projeto.
 * Exportado para permitir teste isolado das opções (seção 7.3 da spec).
 */
export function makeQueryClient(): QueryClient {
  return new QueryClient({
    defaultOptions: {
      queries: {
        staleTime: STALE_TIME,
        gcTime: GC_TIME,
      },
    },
  });
}

export function QueryProvider({ children }: { children: ReactNode }) {
  // Inicializador do useState → instância estável por montagem do componente.
  // NÃO usar `new QueryClient()` direto no corpo (recriaria a cada render).
  // Passa-se a REFERÊNCIA da função makeQueryClient (lazy), não o resultado.
  const [queryClient] = useState(makeQueryClient);

  return (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  );
}
