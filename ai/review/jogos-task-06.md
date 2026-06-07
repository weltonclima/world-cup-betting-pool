# REVIEW — TASK-06: Página Detalhe do Jogo (`/matches/[id]`)

> Feature: Jogos (PRD-03) · Tipo: UI · Commit: `551d5ed`
> Revisor: Claude (gsd-code-reviewer + gsd-ui-auditor, stance adversarial)
> Data: 2026-06-07 · Fonte de verdade: `docs/prd-03/PRD03-02-Detalhe-Jogo.png`
> Spec: `ai/spec/jogos-task-06.md` · Screen: `ai/screen/jogos-task-06.md` · Design: `design-system/MASTER.md`

---

## Veredicto: **REJECTED**

- **BLOCKER:** 1
- **WARNING:** 3

Motivo: ausência total de `<h1>` na página viola simultaneamente o contrato do spec (§9),
o contrato do screen (§11) e a hierarquia de headings WCAG (Prioridade 1 — acessibilidade
crítica). Demais pontos são WARNINGs de fidelidade visual / arbitrary values.

---

## Evidências verificadas (claims do relatório)

| Claim | Resultado |
|---|---|
| 31 testes novos | ✅ 17 (MatchDetail) + 14 (MatchDetailActions) = 31 |
| Suite verde | ✅ JSON reporter: total=31 pass=31 fail=0 suitesFailed=0 (sem false-green de load) |
| `tsc` limpo | ✅ `tsc --noEmit` sem erros |
| `getDiagnostics` nos 3 arquivos | ✅ zero diagnostics |
| Dados só via `useMatchDetail` | ✅ nenhum fetch/Firestore direto no componente |
| CTAs sem `href` p/ rotas PRD-04 | ✅ todos `<Button disabled>`, nenhum href |
| Sem `any` / sem `style={{}}` | ✅ confirmado |

---

## BLOCKERS

### BL-01 — Página não possui `<h1>`; hierarquia de headings começa em `<h2>`
**Arquivo:** `src/features/matches/components/MatchDetail.tsx` (todo o componente; `SectionHeading` = `<h2>` na linha 133)
**Prioridade UI:** 1 (Acessibilidade — CRÍTICA, blocking)
**Issue:**
- O spec §9 exige explicitamente: *"Hierarquia de headings: `<h1>` para título da partida, `<h2>` para seções"*.
- O screen §11 exige: *"`h1` = "Detalhes do Jogo"; `h2` para cada seção"*.
- A imagem PRD03-02 mostra o título "Detalhes do Jogo" no topo da tela (header), que é o título de página esperado.
- Na implementação, o único nível de heading renderizado é `<h2>` (4×: Detalhes do Jogo, Status do Jogo, Status do Palpite, Ações). **Não existe nenhum `<h1>`** no componente.
- O `Header` global (`src/components/layout/Header.tsx:25`) usa `<span>` para a marca "Bolão dos Parças", não um `<h1>`. Logo o documento inteiro da rota `/matches/[id]` não tem h1 e a árvore de headings inicia em h2 — salto de nível (h1 ausente), falha de leitura por screen reader e quebra do contrato.
**Fix concreto:** Renderizar um `<h1>` como título da tela acima do bloco de times (ou no topo, conforme header da imagem). Ex.:
```tsx
<div className="flex items-center gap-2">
  <BackButton />
</div>
<h1 className="text-2xl font-semibold text-foreground">Detalhes do Jogo</h1>
<p className="text-sm text-muted-foreground">{subtitle}</p>
```
E rebaixar (ou manter) as seções como `<h2>` (já estão). Garantir h1 → h2 sem saltos.

---

## WARNINGS

### WR-01 — Fidelidade visual: título de página "Detalhes do Jogo" ausente do topo da tela
**Arquivo:** `MatchDetail.tsx` (estados sucesso/404/error)
**Prioridade UI:** 5 (Layout) — não quebra a tarefa, mas diverge da imagem.
**Issue:** `Visual diff: header da tela — esperado "← back · Detalhes do Jogo (título centralizado)" (PRD03-02 + screen §4 sticky header h-14), encontrado apenas link "← Voltar" sem título de página.` Resolver junto com BL-01 (o `<h1>` cobre ambos).

### WR-02 — Arbitrary value `max-w-[100px]` nos nomes das seleções
**Arquivo:** `MatchDetail.tsx:339`, `MatchDetail.tsx:359`
**Prioridade UI:** 5 (Spacing/escala) → WARNING.
**Issue:** `design-system/MASTER.md §4 e §15` proíbem valores arbitrários sem justificativa ("Nunca usar valores arbitrários"). `max-w-[100px]` é arbitrário. `min-h-[44px]` (botões) também é arbitrário porém justificável (WCAG 2.5.5 touch target) — aceitável. `max-w-[100px]` deveria usar um token de escala (ex. `max-w-24` = 96px ou `max-w-28` = 112px).
**Fix:** Trocar `max-w-[100px]` por `max-w-24` (ou `max-w-28`).

### WR-03 — Skeleton de 404/error não reusa estrutura; back duplicado entre estados
**Arquivo:** `MatchDetail.tsx:282-315`
**Prioridade UI:** 6 (Experience) → WARNING (cosmético/manutenção, não bloqueia).
**Issue:** O estado loading renderiza um back-skeleton (`h-5 w-16`) mas os estados error/404 renderizam um `BackButton` real — comportamento correto, porém o loading não mostra back navegável (usuário preso durante loading sem rota de saída visível). Aceitável dado que loading é transitório, mas considerar manter o `BackButton` real visível também no loading para escape route consistente (screen §4 mostra back no header sticky em todos os estados).
**Fix (opcional):** Renderizar `<BackButton />` real fora do skeleton, acima dele, em todos os estados.

---

## UI/UX Review — violações por prioridade

| Prioridade | Violações | Classificação |
|---|---|---|
| P1 Acessibilidade | 1 (h1 ausente / salto de nível) | **BLOCKER** |
| P2 Touch & Interação | 0 | — (touch targets `min-h-[44px]` OK; disabled acessível com `aria-disabled`) |
| P3 Performance | 0 | — (img `loading="lazy"` + `decoding="async"`) |
| P4 Estilo | 0 | — (ícones Lucide named, tokens semânticos, 1 CTA primário/seção) |
| P5 Layout/Responsivo | 2 (título topo ausente WR-01; `max-w-[100px]` WR-02) | WARNING |
| P6 Tipografia/Cor | 0 | — |
| P7 Animação | 0 | — (`animate-pulse motion-reduce:animate-none` correto) |
| P8 Forms/Feedback | 0 | — (loading/error/404/empty cobertos; refetch funcional) |
| P9 Navegação | 0 | — (back → `/matches` previsível; deep link por rota `[id]`) |
| P10 Charts | n/a | — |

**BLOCKER count:** 1 · **WARNING count:** 3

### Violações Críticas (P1-P2 — sempre blocking)
- BL-01: documento sem `<h1>`; heading tree inicia em `<h2>`.

### Top-3 priority fixes
1. **Adicionar `<h1>` "Detalhes do Jogo"** (BL-01) — screen reader e contrato spec/screen; corrige hierarquia h1→h2 e fidelidade ao header da imagem. *Impacto: acessibilidade crítica + fidelidade visual.*
2. **Trocar `max-w-[100px]` por token de escala** (`max-w-24`) — conformidade com design system §15.
3. **Manter `BackButton` real visível no estado loading** — escape route consistente em todos os estados (screen §4 header sticky).

---

## Pontos fortes (não bloqueiam — registrados)

- Estados loading/error/404 implementados conforme spec §4 com `role="status"`, `aria-busy`, `aria-label`.
- CTAs 100% disabled com `disabled` + `aria-disabled="true"` + `aria-label` descritivo ("disponível em breve") — não engana o usuário, sem href para PRD-04 (D1/D4 cumpridos).
- `deriveActions` cobre todas as combinações status×palpite do spec §5, incluindo o caso `bloqueado + scheduled` (kickoff passou).
- Placar exibido (`2 × 1`) apenas para `finished` com scores não-nulos — bônus além do spec, correto.
- Fallback de bandeira com iniciais + `aria-label` (acessível).
- Formatação date-fns + ptBR conforme spec §8.
- Sem `any`, sem `style`, sem hex; tokens semânticos do design system.

---

## Arquivos revisados
- `src/app/(app)/matches/[id]/page.tsx`
- `src/features/matches/components/MatchDetail.tsx`
- `src/features/matches/components/MatchDetailActions.tsx`
- `src/features/matches/components/__tests__/MatchDetail.test.tsx`
- `src/features/matches/components/__tests__/MatchDetailActions.test.tsx`
- (contexto) `useMatchDetail.ts`, `MatchStatusBadge.tsx`, `GameStatusBadge.tsx`, `MatchesErrorState.tsx`, `Header.tsx`

---

_Revisado: 2026-06-07 · Reviewer: Claude (gsd-code-reviewer + gsd-ui-auditor) · Veredicto: **rejected** (1 BLOCKER)_

---

## Re-review (BLOCKER fix)

> Re-review focado · Commit: branch `feat/integracao-api-football` · Data: 2026-06-07
> Escopo: apenas verificar a correção do BLOCKER e dos 2 WARNINGs apontados. Não é re-run completo.

### Veredicto: **APPROVED**

| Item | Status | Evidência |
|---|---|---|
| **BL-01** (h1 ausente / heading tree em h2) | ✅ **RESOLVIDO** | `MatchDetail.tsx:327` — `<h1>Detalhes do Jogo</h1>` único no componente; `SectionHeading` (`<h2>`, linha 133) renomeado para "Informações" (linha 370). Hierarquia agora h1 → h2 (4× h2: Informações, Status do Jogo, Status do Palpite, Ações), sem saltos. |
| **WR-02** (`max-w-[100px]` arbitrary) | ✅ **RESOLVIDO** | Linhas 338 e 358 agora `max-w-24`; grep não encontra nenhum `max-w-[...]` remanescente. (`min-h-[44px]` permanece — aceitável por WCAG 2.5.5.) |
| **WR-03** (back não visível no loading) | ✅ **RESOLVIDO** | `MatchDetail.tsx:280` — `<BackButton/>` real renderizado no estado loading, fora do skeleton; skeleton já não traz back falso. BackButton presente nos 4 estados (loading 280, error 290, 404 305, sucesso 324). |
| WR-01 (título de página ausente) | ✅ Coberto pelo h1 (BL-01). |

### Verificações técnicas

- `getDiagnostics` em `MatchDetail.tsx`: **zero diagnostics**.
- Sem `any`, sem `style={{}}` inline — confirmado por leitura.
- **Regressão de teste:** nenhuma. T11 (`MatchDetail.test.tsx:152`) afirma `getByText("Detalhes do Jogo")` — continua passando pois o texto agora é o `<h1>` (não mais o `<h2>`). Nenhum teste depende de "Detalhes do Jogo" ser `<h2>`, conta `<h1>`/links, nem asserta "Informações". T14 (link "Voltar") inalterado.

### Issues NOVOS introduzidos pela correção
- Nenhum. (O loading passa a ter `<BackButton>` real + skeleton, mas nenhum teste conta links duplicados; comportamento correto e intencional.)

_Re-revisado: 2026-06-07 · Reviewer: Claude · Veredicto: **approved**_
