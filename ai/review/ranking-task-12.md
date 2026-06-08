# REVIEW — TASK-12 (Perfil do Participante) — UI

**Depth:** standard + UI checklist · **Files:** ParticipantProfile.tsx, ParticipantProfile.test.tsx, perfil/[uid]/page.tsx, components/index.ts · **Status:** issues_found (2 WARNING; 0 BLOCKER)

## Summary
Tela 05 somente-leitura, sólida e fiel ao sistema binário. Identidade (avatar grande + fallback de iniciais, `role="img"`/`aria-label`=nome), card "Posição Atual #N de M", grid 2x2 semântico `<dl>/<dt>/<dd>` (Pontos/Acertos = mesmo valor binário; Erros com fallback `wrong ?? totalWrong ?? "—"`; Aproveitamento `%`/"—"), "Desempenho por Fase" das 5 fases de ranking via `correctByStage` (index `number|undefined` tratado por `?? 0`, "—" quando sem stats). Composição `useRanking("geral")`+filtro `uid` + `useParticipantProfile(uid)`. Estados loading/error(retry)/not-found completos. Next 15 `params` Promise corretamente `await`-ada no Server Component. **Guarda A5 confirmada: nenhum botão de histórico é renderizado, sem destino/navegação, comentário de código apontando A5/TASK-14.** Tokens semânticos (sem hex/inline), sem `any`, tsc 0, suite 3/3.

## Critical Issues
Nenhum.

## A5 Privacy Guard — CONFIRMADO
O botão "Ver histórico de palpites" está **verdadeiramente ausente**: não há `<Button>`, `<Link>`, `onClick`, `router.push` nem qualquer destino no componente. No lugar há apenas o comentário-guarda (`ParticipantProfile.tsx:75-79`) referenciando A5 RESOLVIDO=privado e a lockdown de leitura cruzada deferida à TASK-14. Test dedicado assere a ausência (`queryByText(/Ver histórico de palpites/i)` → null). Sem vazamento de palpites alheios.

## Warnings

### WR-01 (a11y P1, baixo): dois `<h1>` na página de perfil
**File:** `ParticipantProfile.tsx:99` + `src/app/(app)/rankings/layout.tsx:13`
**Issue:** o layout compartilhado `/rankings` já renderiza `<h1>Ranking</h1>` em **todas** as telas da seção, inclusive `/rankings/perfil/[uid]`. `ParticipantProfile` adiciona um segundo `<h1>` para o nome do participante. Resultado: dois `h1` no documento (hierarquia de cabeçalhos não-única). O nome do participante seria mais corretamente um `<h2>` (e as fases `<h3>`), OU o layout deveria suprimir seu `<h1>` em telas de detalhe.
**Severity:** WARNING (não-bloqueante; ambos os h1 têm texto legível; leitores de tela ainda navegam). Decorre da combinação layout (TASK-07) + componente, não de um bug isolado da TASK-12.
**Sugestão:** rebaixar o nome para `<h2>` e "Desempenho por Fase" para `<h3>`, ou condicionar o `<h1>` do layout.

### WR-02 (escopo/nav P9, baixo): `RankingSubNav` vaza na tela de perfil — carry-forward TASK-07
**File:** `src/app/(app)/rankings/layout.tsx:14`
**Issue:** o `/screen` (§4, §10) determina que a sub-nav NÃO deve aparecer na tela de perfil (contextual, fora dos itens fixos). O layout monta `RankingSubNav` incondicionalmente, então ela aparece também em `/perfil/[uid]`. Igualmente, o header de contexto "Perfil do Participante" + voltar/compartilhar (G2) foi omitido (decisão aceitável da task), mas a presença da sub-nav genérica diverge do mock.
**Severity:** WARNING — **carry-forward já conhecido da TASK-07 (G1)**; fora do escopo de TASK-12 alterar o layout. Não bloqueia.

## UI/UX Review
**Violações por prioridade:** P1: 1 (WR-01 dois h1 — sugestão). P9: 1 (WR-02 sub-nav leak — carry). P2–P8/P10: 0.
**BLOCKER:** 0 · **WARNING:** 2 (1 sugestão de hierarquia, 1 carry-forward).
- **Style:** tokens semânticos (`text-primary`, `bg-card`, `text-muted-foreground`, `border-border`), `tabular-nums` nos números, sem hex/inline. Verde `.ranking-theme` herdado (AA em light, validado). OK.
- **Layout:** `mx-auto max-w-lg flex-col gap-4` mobile-first; grid 2x2 e fases `grid-cols-2 sm:grid-cols-3`; `pb-20` do layout respeitado. OK.
- **A11y:** avatar `role="img"`+`aria-label`=nome; métricas via `<dl>/<dt>/<dd>` (label+valor associados); nenhum ícone Lucide nesta tela (nada a marcar `aria-hidden`); sem alvos interativos <44px (não há botões/links nesta tela após omissão A5/G2). Foco visível n/a (sem controles focáveis). OK exceto WR-01.
- **Lógica:** not-found dispara quando `entry` ausente (find→null), independente de `stats` (correto: identidade/posição vêm do ranking). Binário same-value sem duplicar como métricas distintas. `correctByStage[scope] ?? 0` cobre o `undefined` do `partialRecord`. `stats` null → fases mostram "—" (não 0), distinção correta entre "sem dados" e "zero acertos". Next 15 `await params` correto.
- **Performance:** render O(entries) só para `find`; sem listas grandes. OK.

## Verdict: approved with adjustments

A5 privacy guard verificada e sólida (botão verdadeiramente ausente, sem destino). Nenhum bloqueador. WR-01 (dois h1) é ajuste de hierarquia recomendado, não bloqueante; WR-02 é carry-forward de layout da TASK-07. Omissões G3/G4/G5 são intencionais e corretas.
