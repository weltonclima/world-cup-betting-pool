# VERIFICATION

## 1. Task: TASK-09 – Tela 03: Ranking por Fase (+ Por Grupo)

## 2. Must-have truths
- T-01: `/rankings/fase` renderiza sub-abas "Por Fase" / "Por Grupo" (Shadcn/Tabs), "Por Fase" default — **VERIFIED**
- T-02: "Por Fase" → 5 cards (Grupos, Oitavas, Quartas, Semifinal, Final) com ícone + `#posição` + Acertos + Aproveitamento; sem dados → `—` — **VERIFIED**
- T-03: "Por Grupo" → seletor A–L + ranking do grupo (posição, nome/apelido, acertos, aprov.) com destaque "Você" — **VERIFIED**
- T-04: Estados loading (skeleton) / empty / error (+ retry) ligados às queries (por card na fase; na lista no grupo) — **VERIFIED**
- T-05: Binário — exibe Acertos (`points`) + Aproveitamento, sem duplicar Pontos/Acertos — **VERIFIED**
- T-06: Linha do grupo → perfil (next/link, ≥44px); seletor e triggers ≥44px — **VERIFIED**
- T-07: tsc strict sem `any`, sem hex/inline, Lucide named, tema herdado, suite verde — **VERIFIED**

## 3. Evidence per truth
- **T-01:** `PhaseRanking.tsx:72-92` → `<Tabs defaultValue="fase">` com `TabsList grid grid-cols-2` + dois `TabsTab` (`value="fase"` "Por Fase" / `value="grupo"` "Por Grupo"); painéis `TabsPanel`. Primitiva `@base-ui/react/tabs` (`tabs.tsx`) entrega `role=tablist/tab/tabpanel`, roving tabindex, setas e `aria-selected` nativos. `page.tsx` (Server Component fino) → `<PhaseRanking />` (substitui stub).
- **T-02:** `STAGE_CARDS` (`PhaseRanking.tsx:29-39`) = 5 fases exatas `grupos/oitavas/quartas/semifinal/final` com rótulos pt-BR + ícones Lucide (`Users/Network/Trophy/Medal/Trophy`). `StageRankingCards` (`:97-105`) itera num `<ul>` semântico. `StageRankingCard` (`:124-189`): `useRanking(scope)`, `entry = data?.entries.find(e => e.uid === currentUid)` (`:136`), 3 `MetricColumn` Posição `#{position}`/Acertos `{points}`/Aproveitamento `{accuracy}%`; sem entry/sem doc → `entry ? … : PLACEHOLDER` ("—") em todas as três (`:174-183`). Ícone `aria-hidden`, círculo `bg-primary/10 text-primary`.
- **T-03:** `GroupRankingView` (`:232-260`): `useState(GROUP_IDS[0] ?? "A")` → grupo default "A"; `GroupSelector` chips A–L; `useGroupRanking(group)`; lista `<ol>` de `RankingRow`. `RankingRow` (`:264-310`): posição `tabular-nums`, `Avatar`+`AvatarFallback initials()`, `name ?? nickname`, `@nickname` em `text-muted-foreground`, `{points} pts`, `accuracyLabel`. Destaque `entry.uid === currentUid` → `bg-primary/10` + `<Badge>Você</Badge>` (`:278, :290-292`).
- **T-04:** Por fase (degradação por card, OQ3): `isLoading` → skeleton inline 3 barras `bg-muted animate-pulse motion-reduce:animate-none` (`:148-156`); `isError` → texto `text-destructive` + Button "Tentar Novamente" `onClick={() => void refetch()}` (`:157-169`). Por grupo: `isLoading` → `<RankingSkeleton/>`; `isError` → `<RankingErrorState onRetry={() => void refetch()}/>`; `!data || entries.length===0` → `<RankingEmptyState message="Nenhum dado para este grupo"/>` (`:241-247`). `RankingEmptyState` aceita prop `message`.
- **T-05:** Card exibe **Acertos** (`String(entry.points)`) + **Aproveitamento** (`accuracyLabel`) — sem coluna "Pontos" redundante; OQ1/D2 respeitado. `accuracyLabel` retorna `—` quando `accuracy === undefined` (`:67-69`).
- **T-06:** `RankingRow` é `<Link href={`/rankings/perfil/${entry.uid}`}>` com `min-h-11` (`:273-276`). Chips do `GroupSelector` `min-h-11` (`:217`). `TabsTab` `min-h-11` (`:76, :79`). Button de retry `min-h-11`.
- **T-07:** Scan `any` → nenhum (`PLACEHOLDER` constante; tipos `RankingEntry`/`RankingScope`/`LucideIcon`/`Exclude<RankingScope,"geral">`). tsc `--noEmit` exit 0 ("TypeScript compilation completed"). Classes só tokens semânticos (`bg-primary/10`, `text-muted-foreground`, `text-destructive`, `bg-card`, `border-border`) — sem hex/inline. Ícones Lucide named (`Medal/Network/Trophy/Users`). Tema `.ranking-theme` herdado do shell (TASK-07), não reaplicado. `"use client"` presente. Suite PhaseRanking 3/3.

## 4. Test correlation
- `PhaseRanking.test.tsx` (3, jsdom, QueryClientProvider): (1) entry do usuário existe → `#2` e `6` renderizados em ≥1 card; (2) usuário sem entry na fase → `—` presente e `#2` ausente (cobre placeholder D1); (3) destaque "Você" → badge "Você" + nome "Voce Mesmo" presentes. Mocka `@/features/rankings` (hooks) e `@/hooks/useAuth`; importa o componente por path direto p/ escapar do mock do barrel — assertam texto renderizado, não internals. Cross-check raw (rtk proxy): `Test Files 1 passed (1) / Tests 3 passed (3)` — sem load-failure (RTK não mentiu).
- Lacuna menor: o teste de "Você" depende de ambos os painéis montados (`keepMounted`) — não exercita o clique de troca de aba nem a troca de grupo (`setGroup`). Cobertura de comportamento é leve, mas alinhada ao §9 ("testes leves, não bloqueantes").

## 5. Out-of-scope drift
none. Só Tela 03 (Por Fase + Por Grupo). `RankingRow` local (TASK-08 não exporta a sua — duplicação consciente prevista no §3/§7: "subcomponente local se não exportado"). `GROUP_IDS`/`STAGE_CARDS` são constantes dedicadas no escopo da feature (sem hardcode espalhado). Nenhuma escrita; só leitura via hooks prontos.

## 6. Findings
- BLOCKER: nenhum
- WARNING:
  - W-01 (a11y, baixo): card "sem dados" mostra `—` em três colunas sem `aria-label` agregado ("sem dados nesta fase") — screen recomenda considerar isso (§8). Rótulos textuais "Posição/Acertos/Aproveitamento" existem, mitigando.
  - W-02 (consistência): `GroupSelector` usa `role="group"` + `aria-pressed` (toggle buttons) em vez de `radiogroup`/`aria-current`; aceitável pelo screen (§5: "radiogroup/segmented" como alternativa; `aria-pressed` listado como válido). Não bloqueia.
  - Nota (G3/OQ2): `GROUP_IDS` = A–L fixos (12 grupos), sem filtrar por doc gravado; grupos sem doc caem no empty-state — comportamento aceitável e previsto.
  - Nota: duplicação de `initials`/`accuracyLabel`/`RankingRow` entre `GeneralRanking.tsx` e `PhaseRanking.tsx` (TASK-08 não exportou) — débito menor, previsto no spec.

## 7. Verdict: goal-achieved
