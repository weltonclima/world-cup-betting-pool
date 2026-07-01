# PRD — Auto-refresh ao retornar à página (resultados e ranking)

## 1. Feature summary

Hoje, ao navegar para outra página ou trocar de aba e voltar à tela de resultados (`/matches`) ou ranking, os dados permanecem congelados no estado antigo até o usuário recarregar manualmente. O problema é de cache: o `staleTime` padrão de 30min faz o React Query considerar os dados "frescos", impedindo que `refetchOnWindowFocus` e `refetchOnMount` (ambos `true` por padrão) disparem o refetch.

A feature entrega atualização automática nesses dois cenários:
1. **Troca de aba / foco de janela** — usuário vai para outra aba do browser e volta.
2. **Navegação interna** — usuário vai para outra rota do app (e.g., `/profile`) e volta para `/matches` ou `/ranking`.

## 2. Consolidated scope

**In scope**:
- Troca de aba/janela dispara refetch nas queries de ranking e resultados.
- Navegação de volta à página de ranking ou matches dispara refetch nessas queries.
- Nenhuma mudança visível de UX além dos dados atualizarem em background (sem loading flicker — React Query mantém dado antigo enquanto busca o novo).
- Cobre: ranking geral, ranking por pool, ranking por fase, lista de partidas, próxima partida.
- Cobre indiretamente: home dashboard (que reutiliza `useRanking` e `useRecentResults`).

**Out of scope**:
- Polling automático com intervalo fixo (desnecessário — o padrão focus/mount já cobre o caso de uso).
- Mudança no staleTime global (só os hooks afetados mudam).
- Bracket (`/matches/eliminatorias`) — já tem `refetchInterval` live-aware próprio (PRD-16, TASK-09).

## 3. System understanding relevant to this feature

### Mecanismo React Query (TanStack Query v5)

React Query decide refetch por duas flags:
- `refetchOnWindowFocus`: dispara quando o documento recupera foco (`visibilitychange` / `focus`). Default `true`, mas só refetch se dados estão stale.
- `refetchOnMount`: dispara quando o hook monta. Default `true`, mas só refetch se dados estão stale.
- Ambos aceitam `"always"` → refetch incondicionalmente, ignorando `staleTime`.

### QueryProvider global (`src/providers/QueryProvider.tsx`)

```ts
defaultOptions: {
  queries: {
    staleTime: 30 * 60 * 1000, // 30min — muito alto para ranking/matches
    gcTime: 24 * 60 * 60 * 1000,
    // refetchOnWindowFocus: true (default implícito)
    // refetchOnMount: true (default implícito)
  },
}
```

Com `staleTime` de 30min, um retorno dentro de 30min não dispara refetch — os dados são considerados "frescos".

### Hooks afetados

| Hook | Arquivo | staleTime atual | Problema |
|---|---|---|---|
| `useRanking` | `features/rankings/hooks/useRanking.ts` | global 30min | não atualiza ao navegar de volta |
| `usePoolRanking` | `features/rankings/hooks/usePoolRanking.ts` | global 30min | idem |
| `usePoolRankingByScope` | `features/rankings/hooks/usePoolRankingByScope.ts` | global 30min | idem |
| `useMatches` | `features/matches/hooks/useMatches.ts` | `STALE_TIME.jogoDia` 30min | idem |
| `useNextMatch` | `features/home/hooks/useNextMatch.ts` | `STALE_TIME.jogoDia` 30min | idem |

**Não afetado** (já tem staleTime curto ou mecanismo próprio):
- `useRecentResults` → `STALE_TIME.jogoEncerrado` (5min) — já atualiza frequentemente.
- `useBracket` → tem `refetchInterval` live-aware (1min se ao vivo, polling bracket).
- `useGroupStandings` → dados de grupos (estáticos durante fase de grupos).

### Cache tiers (`src/server/cache/tiers.ts`)

Tiers existentes — `STALE_TIME.jogoEncerrado` = 5min é o candidato natural para ranking/matches, mas a solução `refetchOnMount: "always"` é mais precisa: garante atualização na navegação sem quebrar o cache durante uso contínuo na mesma página.

## 4. Technical impact analysis

### Mudanças necessárias

**A. `QueryProvider.tsx` — `refetchOnWindowFocus: "always"` global**

Adicionar `refetchOnWindowFocus: "always"` nos `defaultOptions.queries`. Isso cobre o cenário de troca de aba/janela para TODAS as queries (incluindo ranking, matches, home). O custo é mínimo: refetch só dispara quando o usuário ativamente volta ao app — não é polling contínuo.

Impacto em queries estáticas (teams 24h, grupos 24h): o payload é pequeno, o servidor tem cache, e o refetch acontece no máximo uma vez por retorno de aba. Aceitável.

**B. Ranking hooks — `refetchOnMount: "always"`**

`useRanking`, `usePoolRanking`, `usePoolRankingByScope` ganham `refetchOnMount: "always"`. Isso garante que navegar de volta à tela de ranking sempre busca dados frescos.

No Next.js App Router, cada navegação para uma rota diferente desmonta e remonta o componente de página (e seus hooks). `refetchOnMount: "always"` em cima da navegação = refresh garantido.

**C. Matches hooks — `refetchOnMount: "always"`**

`useMatches` e `useNextMatch` ganham `refetchOnMount: "always"`. Cobre a página de jogos (`/matches`) e o card de próximo jogo na home.

### Arquivos afetados

```
src/providers/QueryProvider.tsx                           ← refetchOnWindowFocus: "always"
src/providers/__tests__/QueryProvider.test.tsx            ← atualizar teste de opções
src/features/rankings/hooks/useRanking.ts                 ← refetchOnMount: "always"
src/features/rankings/hooks/usePoolRanking.ts             ← refetchOnMount: "always"
src/features/rankings/hooks/usePoolRankingByScope.ts      ← refetchOnMount: "always"
src/features/matches/hooks/useMatches.ts                  ← refetchOnMount: "always"
src/features/home/hooks/useNextMatch.ts                   ← refetchOnMount: "always"
```

### Sem impacto em

- API Route Handlers (nenhuma mudança server-side).
- Firestore Rules (sem alteração de permissões).
- Schemas / tipos (nenhuma mudança de contrato).
- Build / deploy (mudança puramente client-side).

## 5. Risks

| Risco | Severidade | Mitigação |
|---|---|---|
| Aumento de requisições ao servidor | Baixo | Ocorre só em eventos discretos (foco/mount), não polling contínuo. Servidor tem cache no Next.js. |
| `refetchOnWindowFocus: "always"` global pode refetchar queries de admin desnecessariamente | Baixo | Admin routes têm poucos usuários; payloads pequenos; sem side-effects. |
| Interação com `refetchInterval` do bracket | Nenhum | Bracket tem seu próprio intervalo independente; `refetchOnWindowFocus: "always"` apenas adiciona um disparo extra no foco — inofensivo. |
| Teste de `QueryProvider` falha ao verificar `defaultOptions` | Baixo | Atualizar o teste existente para incluir a nova opção. |

## 6. Ambiguities and gaps

- **`useStatistics` e `usePoolStats` (home)**: herdam staleTime global (30min). Se o usuário quer que estatísticas também atualizem ao retornar, `refetchOnWindowFocus: "always"` global já cobre (via aba), mas `refetchOnMount` não cobrirá para esses hooks. Avaliação: estatísticas mudam com recalc (cron ~30min), então 30min staleTime é adequado. Não incluído no scope.
- **`useMyRanking` / `useParticipantProfile`**: não mencionados pelo usuário. Staletime global 30min. Cobertos pelo `refetchOnWindowFocus: "always"` global para troca de aba, mas não por `refetchOnMount`. Fora de scope por ora.

## 7. Recommended implementation concerns

- A adição de `refetchOnWindowFocus: "always"` no QueryClient global é a mudança de maior alcance — validar que não quebra testes existentes que mockam `QueryClient`.
- `refetchOnMount: "always"` deve ser adicionado diretamente nas chamadas `useQuery` dos hooks afetados, não como override global, para manter o princípio de menor privilégio.
- O teste de `QueryProvider` verifica `staleTime` e `gcTime` — precisará ser atualizado para também checar `refetchOnWindowFocus: "always"`.
- TDD não se aplica aqui: a mudança é de configuração/comportamento de infra de dados, não de lógica de negócio. Testes de integração (se existirem para os hooks) poderiam validar o comportamento de refetch, mas o custo/benefício é baixo para uma config change.
