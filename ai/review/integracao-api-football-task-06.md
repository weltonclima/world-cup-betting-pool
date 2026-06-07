# REVIEW (adversarial) — TASK-06 · Hooks React Query por tier + repontar Home

> Commit: `759c3a4` · Spec: `ai/spec/integracao-api-football-task-06.md`
> Reviewer: Staff Engineer (skill /review) · Stance: FORCE · Read-only

## Verdict: **approved** (0 BLOCKER · 0 WARNING)

`tsc --noEmit` exit 0. Suíte `src/features/matches` verde (parte dos 79 testes rodados); spec reporta 333/333 em `src/features` incluindo as 12 suites da Home. Hooks novos criados, Home repontada via `staleTime` sem alterar contrato/compositor. Nada a bloquear ou ajustar — implementação limpa e fiel à spec.

## Escopo / Arquitetura
- 5 arquivos novos em `src/features/matches/hooks/` (`matchesKeys`, `useMatches`, `useMatch`, `useTeams`, `index`) + barrel `src/features/matches/index.ts`. Bate com §3/§7 da spec.
- Home: somente `staleTime` adicionado em `useNextMatch`/`useRecentResults`/`useTeams` — query keys, queryFn e assinaturas inalteradas. Verifiquei os 3 arquivos: nenhuma outra mudança. `homeDashboardHelpers`/`useHomeDashboard` não tocados. **Home não quebrada** (§4/§5).

## Correção (staleTime por tier / Home)
- `STALE_TIME` importado de `@/server/cache/tiers` (fonte única espelhada do `REVALIDATE`). Confirmei (spec/leitura) que `tiers.ts` NÃO tem `import "server-only"` → seguro no client. **OK** — risco documentado em §9 caso isso mude no futuro.
- Tiers aplicados: `useMatches`/`useMatch` = `jogoDia` (30min, tier único A5 documentado); `useTeams` (matches) = `selecoes` (24h); Home `useNextMatch` = `jogoDia`, `useRecentResults` = `jogoEncerrado` (5min), `useTeams` = `selecoes`. Escolhas justificadas e coerentes com a semântica de cada recurso (§4).
- `useMatch(id)` usa `enabled: id.length > 0` — evita disparo com id vazio. Correto.
- `matchesKeys` é factory hierárquica no padrão TanStack (`all`/`lists`/`list`/`details`/`detail`/`teams`), permitindo invalidação granular. Namespace `"matches"` separado de `"home"`. Bem feito.

## Decisões revisadas (não são achados)
- **Tier único por lista (A5):** aceitável e documentado — o `staleTime` do client é só gatilho de refetch da UI; a frequência real de chamada à API vive no `revalidate` server-side (TASK-04). Sem desvio do plano.
- **Dois `useTeams` (home e matches) com caches separados por query key:** intencional para desacoplar features; mesmo tier e mesma queryFn. Consolidação adiada para quando a tela de Jogos existir. Decisão de arquitetura razoável, não um defeito.

## Contratos / Testes
- Contrato dos hooks da Home preservado (troca só a fonte atrás) — os testes da Home mockam no nível de hook/compositor, então o repoint de fonte e o `staleTime` não exigiram mudança de mock. Confirmado pela leitura da spec §5/§6.
- Hooks novos de matches são wrappers finos de serviços já testados na TASK-05 + `useQuery`; sem testes dedicados (plano: TDD = no). Aceitável — a futura tela de Jogos adicionará integração. Não é gap bloqueante.

## Risco
Muito baixo. Mudança aditiva e transparente. Única dependência frágil (import de `tiers.ts` no client sem `server-only`) já está documentada como risco em §9 com plano de mitigação (extrair `STALE_TIME` para módulo isomórfico se necessário).

---
_Reviewer: Claude (skill /review) — adversarial · read-only_
