# VERIFICATION

## 1. Task: TASK-08 – Tela 01: Ranking Geral

## 2. Must-have truths
- T-01: `/rankings` renderiza `GeneralRanking` (stub substituído) — **VERIFIED**
- T-02: Pódio top-3 (coroa 1º, ordem 2-1-3, fallback iniciais) + lista #4+ — **VERIFIED**
- T-03: Destaque "Você" (uid sessão) bg-primary/10 + badge — **VERIFIED**
- T-04: Paginação 20/página via `paginate` puro; controles ocultos se ≤20 — **VERIFIED**
- T-05: Estados loading/error(refetch)/empty ligados ao hook — **VERIFIED**
- T-06: Binário — Pts + Aprov sem Acertos duplicado; fallbacks "—"/nickname — **VERIFIED**
- T-07: Linha → perfil (next/link, ≥44px) — **VERIFIED**
- T-08: Sem any, tsc strict, tokens sem hex/inline, Lucide, suite verde — **VERIFIED**

## 3. Evidence per truth
- **T-01:** `src/app/(app)/rankings/page.tsx` → `return <GeneralRanking />` (era stub "Em construção").
- **T-02:** `GeneralRanking.tsx` `podium = entries.slice(0,3)`, `rest = entries.slice(3)`. `RankingPodium`: `Crown` no `i===0` (`aria-hidden`), `visualOrder=["order-2","order-1","order-3"]` (DOM ranking, visual 2-1-3), `Avatar`+`AvatarFallback initials()`, nome + "N pts" `tabular-nums`.
- **T-03:** `entry.uid === currentUid` (`useAuth().firebaseUser?.uid`) → linha `bg-primary/10` + `<Badge>Você</Badge>` (pódio e lista).
- **T-04:** `paginate(rest, page, 20)` (lib puro: `totalPages=max(1,ceil(len/size))`, clamp [1,total], slice). Controles em `totalPages>1`; botões `disabled` nos limites. `pagination.test.ts` cobre fatiamento/clamp/vazio.
- **T-05:** `if (isLoading) return <RankingSkeleton/>; if (isError) return <RankingErrorState onRetry={()=>void refetch()}/>; if (!data || entries.length===0) return <RankingEmptyState/>`.
- **T-06:** Linha mostra `{points} pts` + `accuracyLabel` (accuracy% ou "—"); SEM coluna "Acertos". `name ?? nickname` p/ exibição; `initials` usa name||nickname.
- **T-07:** `RankingRow`/pódio são `<Link href={`/rankings/perfil/${uid}`}>` com `min-h-11`.
- **T-08:** scan `any` → nenhum; tsc exit=0; classes `bg-primary/10`, `text-muted-foreground` etc. (sem hex); `Crown` Lucide named; vitest full 1745/1745.

## 4. Test correlation
- `pagination.test.ts` (6): fatiamento 20, página 2 começa em 21, última traz resto, clamp acima/abaixo, vazio. Assertam valores reais.
- `GeneralRanking.test.tsx` (3, jsdom): pódio mostra top-3 + lista #5; badge "Você" na linha do uid logado; empty quando entries vazio. Mock do hook via barrel + import direto do componente — assertam comportamento (texto renderizado), não mocks internos.

## 5. Out-of-scope drift
none. Só Tela 01 (Geral). Outras telas seguem stubs. `paginate` adicionado à lib (reutilizável por outras telas — escopo correto).

## 6. Findings
- BLOCKER: nenhum
- WARNING: nenhum
  - Nota (G4): avatar sem foto → fallback de iniciais (sem campo de imagem no schema; sem PII). Intencional/documentado.
  - Nota (G2): divergência consciente do screenshot (omitir coluna Acertos) por causa da regra binária — fiel ao sistema, não ao mock 3/1/0.

## 7. Verdict: goal-achieved
