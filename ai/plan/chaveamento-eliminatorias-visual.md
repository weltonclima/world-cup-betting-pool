# PLAN — Chaveamento Visual das Eliminatórias (PRD-16)

> Fonte: `ai/prd/chaveamento-eliminatorias-visual.md`
> Slug: `chaveamento-eliminatorias-visual`

## 1. Planning summary

Feature de baixo-médio risco em 4 tasks. Foundation = expor `kickoffAt`/`venue` no contrato (schema + derivação no servidor, já disponíveis no `MatchWithId`). Em seguida, o redesenho frontend em duas camadas: card de confronto (data, venue, badge vencedor) e orquestração de fases (progressão visual). Risco principal já mitigado no PRD: `kickoffAt` opcional + route handler já trata snapshot inválido como cache miss (verificado em `route.ts:48-58`).

Sequência: contrato/dados primeiro (TASK-01), helpers puros (TASK-02), card (TASK-03), orquestração de fases (TASK-04).

## 2. Recommended execution phases

- **Phase 1 – Foundation (contrato + dados):** TASK-01
- **Phase 2 – Domain helpers (puros, testáveis):** TASK-02
- **Phase 3 – UI (apresentação):** TASK-03, TASK-04

## 3. Tasks

### TASK-01 – Expor kickoffAt/venue no contrato do bracket
- Type: api
- Goal: Adicionar `kickoffAt` (opcional) e `venue` (opcional) ao `knockoutMatchSchema` e propagá-los em `deriveBracket`, sem quebrar snapshots stale.
- Scope:
  - `knockoutMatchSchema`: + `kickoffAt: isoDateTime.optional()`, `venue: venueSchema.optional()` (reusar shape de `matches.ts` ou definir local strict).
  - `deriveBracket`: montar `KnockoutMatch` com `kickoffAt: match.kickoffAt` + spread condicional de `venue`.
  - `BracketPayload` herda tipos via `KnockoutMatch`.
  - NÃO mudar `bracketResponseSchema` shape (apenas os itens internos mudam via knockoutMatchSchema).
- Main modules/files likely involved:
  - `src/schemas/worldcup.ts`
  - `src/server/worldcup/bracket.ts`
  - `src/types/worldcup.ts` (deriva automático)
- Dependencies: none
- Story points: 2
- Criticality: high
- Technical risk: low
- Recommended TDD later: no (campos opcionais aditivos; cobertos por TASK-02 e testes existentes de bracket)
- Execution cost:
  - spec: sonnet/medium
  - tdd: N/A
  - implement: sonnet/high
  - test: sonnet/medium
  - review: sonnet/medium
- Status: done
- Phases done: spec, implement, test, review
- Notes: Atualizar `src/server/worldcup/__tests__/bracket.test.ts` para verificar propagação de `kickoffAt`. Campos OPCIONAIS — não exigem refine; snapshots stale continuam parseando.

### TASK-02 – Helpers puros: vencedor + formatação de data
- Type: domain
- Goal: Lógica pura e testável para determinar lado vencedor e formatar `kickoffAt` em pt-BR (fuso local).
- Scope:
  - `getWinningSide(match): "home" | "away" | "draw" | null` — null quando não encerrado; draw quando placares iguais.
  - `formatKickoffBr(iso?: string): string` — ex.: "Dom, 29 Jun · 16h00"; fallback "Data a confirmar" quando ausente.
  - Formatação via `Intl.DateTimeFormat` no fuso local (padrão projeto, ver `matches-day-local-tz`).
- Main modules/files likely involved:
  - `src/features/worldcup/lib/knockoutHelpers.ts` (novo)
  - `src/features/worldcup/lib/__tests__/knockoutHelpers.test.ts` (novo)
- Dependencies: TASK-01 (tipo `KnockoutMatch` com kickoffAt)
- Story points: 2
- Criticality: medium
- Technical risk: low
- Recommended TDD later: yes (regras condicionais — vencedor/empate/null; formatação de data com fallback)
- Execution cost:
  - spec: sonnet/medium
  - tdd: sonnet/high
  - implement: sonnet/high
  - test: sonnet/medium
  - review: sonnet/medium
- Status: done
- Phases done: spec, tdd, implement, test, review
- Notes: Pênaltis NÃO modelados — empate retorna "draw" sem "(pen.)". **Regra bolão:** placar de pênaltis não conta; empate no tempo regulamentar/prorrogação = "draw" para fins de pontuação. Formatação só no cliente (evita divergência SSR/browser).

### TASK-03 – Redesenho KnockoutMatchCard (data, venue, badge vencedor)
- Type: application
- Goal: Card de confronto com data/hora, cidade do estádio e destaque visual do vencedor, mantendo as 3 variantes de status.
- Scope:
  - Exibir `formatKickoffBr(match.kickoffAt)` no topo do card.
  - Exibir `match.venue.city` quando presente (muted, secundário).
  - Badge/destaque do vencedor via `getWinningSide` quando `encerrado` (ring/ícone troféu/peso visual no lado vencedor).
  - Manter aguardando/definido/encerrado e acessibilidade (aria-label do resultado).
- Main modules/files likely involved:
  - `src/features/worldcup/components/KnockoutMatchCard.tsx`
  - `src/features/worldcup/components/__tests__/KnockoutMatchCard.test.tsx` (atualizar)
- Dependencies: TASK-01, TASK-02
- Story points: 3
- Criticality: medium
- Technical risk: low
- Recommended TDD later: no (presentacional; testes de snapshot/render atualizados na fase test)
- Execution cost:
  - spec: sonnet/high
  - tdd: N/A
  - implement: sonnet/high
  - test: sonnet/medium
  - review: sonnet/high
- Status: done
- Phases done: spec, ui-spec, implement, test, review, ui-review
- Notes: is_frontend: true → roda ui-spec + patterns:nextjs + ui-review. Tailwind v4 + shadcn. Mobile-first. Review: approved-with-adjustments — CR-01 (T13 exact→partial match, ICU-brittle), WR-01 (ring padding px-1.5/-mx-1.5 baked ui-spec §8), WR-04 (T16 testa ausência data-winner) aplicados. WR-02 (SideFlag initials w[0] undefined com espaços) registrado como tech-debt futura (lógica pré-existente). WR-03 declinado (spec §6.3 manda manter aria-label atual). 20 testes verdes + tsc limpo.

### TASK-04 – BracketView + PhaseSection: progressão visual entre fases
- Type: application
- Goal: Orquestrar as fases com header expressivo e divisor de progressão ("vencedores avançam para [próxima fase]") entre seções, mantendo estados de ciclo de vida.
- Scope:
  - `PhaseSection`: header com label + contagem de jogos; separador visual.
  - `BracketView`: constante estática `PHASE_PROGRESSION` (key → próximo label); render do divisor de progressão entre fases não-finais e não-vazias.
  - Manter pending/error/empty/ok e omissão de fases vazias.
  - Sem SVG/bracket horizontal (decisão PRD).
- Main modules/files likely involved:
  - `src/features/worldcup/components/BracketView.tsx`
  - `src/features/worldcup/components/PhaseSection.tsx`
  - `src/features/worldcup/components/__tests__/PhaseSection.test.tsx` (atualizar)
- Dependencies: TASK-03
- Story points: 3
- Criticality: medium
- Technical risk: low
- Recommended TDD later: no (apresentacional/orquestração; testes de render)
- Execution cost:
  - spec: sonnet/high
  - tdd: N/A
  - implement: sonnet/high
  - test: sonnet/medium
  - review: sonnet/high
- Status: in-progress
- Phases done: spec, ui-spec, implement, test, review, ui-review
- Notes: is_frontend: true → ui-spec + patterns:nextjs + ui-review.
- Redesign v2 (pós-feedback usuário): descartado divisor vertical simples. Novo layout = árvore horizontal com colunas por fase (16-avos→Final), scroll-x + snap por coluna no mobile, linhas conectoras tipo chaveamento ("]"), tema do app. 3º lugar fora da árvore. PhaseSection deixou de ser usado pelo BracketView (arquivo/testes mantidos). Aguardando validação visual no browser.

## 4. Dependency map

```
TASK-01 (contrato/dados)
   └─> TASK-02 (helpers puros)
          └─> TASK-03 (card)
                 └─> TASK-04 (orquestração fases)
```

- TASK-01: sem dependências (foundation).
- TASK-02: precisa do tipo de TASK-01.
- TASK-03: precisa de TASK-01 (campos) + TASK-02 (helpers).
- TASK-04: precisa de TASK-03 (card pronto).

## 5. Recommended execution order

1. TASK-01 — contrato + propagação de dados (foundation)
2. TASK-02 — helpers puros (vencedor + data)
3. TASK-03 — card redesenhado
4. TASK-04 — orquestração de fases com progressão

## 6. Planning risks and blockers

- **TASK-01 — fallback stale:** route handler retorna `snap.payload` cru no caminho de resiliência (openfootball down + snapshot stale). Por isso `kickoffAt` é OPCIONAL — frontend degrada. Sem bloqueador.
- **TASK-02 — pênaltis:** Copa 2026 resolve mata-mata empate por pênaltis; schema não tem campo. `getWinningSide` retorna "draw" — aceito nesta fase, pode virar TASK futura "(pen.)".
- **TASK-03/04 — regressão visual:** componentes têm testes co-localizados; atualizar junto. Frontend → ui-spec/ui-review obrigatórios.
- Nenhum bloqueador externo. Sem migração de dados. Sem novos secrets/env.

plan-checker: gate atingido (4 tasks), mas agente `gsd-plan-checker` indisponível neste ambiente (GSD desabilitados em `~/.claude/_disabled/agents/`) → pass pulado conforme CLAUDE.md. Análise goal-backward (passos 4-5) cobre: cadeia linear TASK-01→04 entrega os 2 requisitos do PRD (data/hora via 01+02+03; progressão visual via 04). Sem gap de goal detectado.
