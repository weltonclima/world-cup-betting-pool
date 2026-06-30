"use client";

  import { useQuery, type UseQueryResult } from "@tanstack/react-query";
  import type { Query } from "@tanstack/react-query";

  import { getBracket } from "@/services/worldcup";
  import { STALE_TIME } from "@/server/cache/tiers";
  import type { BracketResponse, KnockoutMatch } from "@/types/worldcup";

  import { worldcupKeys } from "./worldcupKeys";

  /** Achata os 6 buckets do bracket numa lista única de confrontos. */
  function allBracketMatches(data: BracketResponse): KnockoutMatch[] {
    return [
      data.roundOf32,
      data.roundOf16,
      data.quarterFinals,
      data.semiFinals,
      data.thirdPlace,
      data.final,
    ].flat();
  }

  /**
   * Indica se o bracket tem confronto ao vivo OU prestes a começar — gatilho do
   * polling de 60s no client.
   *
   * Espelha `snapshotHasDueMatch` do servidor (route da bracket): além de
   * `em-andamento` (placar ao vivo muda), inclui `definido` com kickoff já no
   * passado — o jogo começou na ESPN mas a derivação ainda não virou
   * `em-andamento`. Sem este segundo caso a transição definido→ao-vivo nunca
   * seria capturada, pois o body do bracket NÃO carrega `hasLiveGroupMatch`
   * (ao contrário dos grupos), então não há flag pronta para gatilhar o poll.
   */
  export function bracketHasLiveOrDueMatch(
    data: BracketResponse | undefined,
    now: number,
  ): boolean {
    if (!data) return false;
    return allBracketMatches(data).some(
      (m) =>
        m.status === "em-andamento" ||
        (m.status === "definido" &&
          m.kickoffAt !== undefined &&
          Date.parse(m.kickoffAt) <= now),
    );
  }

  /**
   * Hook TanStack Query para o chaveamento do mata-mata (TASK-05).
   *
   * Consome `getBracket` → `GET /api/worldcup/bracket` (proxy + cache Next).
   *
   * `staleTime` = `STALE_TIME.grupos` (24h) — chaveamento é estático: fases
   * avançam devagar (a cada 2-3 dias) e a revalidação server-side garante frescor.
   *
   * `refetchInterval`: quando há confronto ao vivo (ou já no horário) no bracket,
   * revalida a cada 60s para refletir placar/status em tempo real — mesmo padrão
   * de `useGroups`. Como o body do bracket não expõe `hasLiveGroupMatch`, o
   * gatilho é derivado dos próprios confrontos via {@link bracketHasLiveOrDueMatch}.
   * O callback recebe o `Query` bruto (pré-select): `query.state.data` é
   * `BracketResponse | undefined`, fonte não transformada.
   */
  export function useBracket(): UseQueryResult<BracketResponse> {
    return useQuery({
      queryKey: worldcupKeys.bracket(),
      queryFn: getBracket,
      staleTime: STALE_TIME.grupos,
      refetchInterval: (query: Query<BracketResponse>) =>
        bracketHasLiveOrDueMatch(
          query.state.data as BracketResponse | undefined,
          Date.now(),
        )
          ? 60_000
          : false,
    });
  }
