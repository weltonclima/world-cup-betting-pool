// @vitest-environment jsdom
import { render } from "@testing-library/react";
import { useQueryClient, type QueryClient } from "@tanstack/react-query";
import { useEffect } from "react";
import { describe, expect, it } from "vitest";

import { QueryProvider, makeQueryClient } from "@/providers/QueryProvider";

const STALE_TIME = 30 * 60 * 1000; // 30 minutos
const GC_TIME = 24 * 60 * 60 * 1000; // 24 horas

describe("QueryProvider", () => {
  it("makeQueryClient cria QueryClient com staleTime 30min e gcTime 24h", () => {
    const client = makeQueryClient();
    const options = client.getDefaultOptions();

    expect(options.queries?.staleTime).toBe(STALE_TIME);
    expect(options.queries?.gcTime).toBe(GC_TIME);
  });

  it("revalida sempre ao retornar o foco à janela (refetchOnWindowFocus)", () => {
    const client = makeQueryClient();
    const options = client.getDefaultOptions();

    expect(options.queries?.refetchOnWindowFocus).toBe("always");
  });

  it("fornece um QueryClient com as opções padrão do projeto", () => {
    let captured: QueryClient | undefined;

    function Probe() {
      const client = useQueryClient();
      captured = client;
      return null;
    }

    render(
      <QueryProvider>
        <Probe />
      </QueryProvider>,
    );

    const options = captured?.getDefaultOptions();
    expect(options?.queries?.staleTime).toBe(STALE_TIME);
    expect(options?.queries?.gcTime).toBe(GC_TIME);
    expect(options?.queries?.refetchOnWindowFocus).toBe("always");
  });

  it("mantém a mesma instância de QueryClient entre re-renders", () => {
    const clients: QueryClient[] = [];

    function Probe({ tick }: { tick: number }) {
      const client = useQueryClient();
      useEffect(() => {
        clients.push(client);
      }, [client, tick]);
      return null;
    }

    const { rerender } = render(
      <QueryProvider>
        <Probe tick={0} />
      </QueryProvider>,
    );
    rerender(
      <QueryProvider>
        <Probe tick={1} />
      </QueryProvider>,
    );

    expect(clients.length).toBeGreaterThanOrEqual(2);
    expect(clients[0]).toBe(clients[1]);
  });
});
