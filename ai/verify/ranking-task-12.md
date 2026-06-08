# VERIFICATION

## 1. Task: TASK-12 – Tela 05: Perfil do Participante

## 2. Must-have truths
- T-01: `/rankings/perfil/[uid]` monta `ParticipantProfile` (stub substituído); `uid` de `params` (Promise, Next 15) — **VERIFIED**
- T-02: Identidade — avatar (fallback iniciais) + nome (`entry.name` → fallback `nickname`) — **VERIFIED**
- T-03: Card "Posição Atual #N de M" (`entry.position` / `entries.length`) — **VERIFIED**
- T-04: Grid Pontos/Acertos(mesmo valor, binário)/Erros(`wrong ?? totalWrong ?? "—"`)/Aproveitamento(`%` ou "—") — **VERIFIED**
- T-05: "Desempenho por Fase" das 5 fases de ranking via `correctByStage` (binário ⇒ pts = acertos); "—" sem stats — **VERIFIED**
- T-06: Composição `useRanking("geral")` + filtro `uid` + `useParticipantProfile(uid)` — **VERIFIED**
- T-07: Estados loading / error(retry) / not-found("Participante não encontrado") — **VERIFIED**
- T-08: **Botão "Ver histórico de palpites" OMITIDO** com comentário referenciando A5 (privado) — **VERIFIED**
- T-09: Sem `any`, tsc strict 0, tokens sem hex/inline, Lucide n/a, suite verde — **VERIFIED**

## 3. Evidence per truth
- **T-01:** `src/app/(app)/rankings/perfil/[uid]/page.tsx` — Server Component `async`, `params: Promise<{ uid: string }>`, `const { uid } = await params;` → `<ParticipantProfile uid={uid} />`. `ParticipantProfile.tsx:36-38` recebe `uid: string` e é `"use client"`. Export no barrel `components/index.ts:17`.
- **T-02:** `ProfileIdentity` (`ParticipantProfile.tsx:85-103`): `Avatar h-20 w-20` com `role="img" aria-label={displayName}` + `AvatarFallback` com `initials(displayName)`. `displayName = entry.name ?? entry.nickname` (linha 64). Sem `AvatarImage` (não há `photoURL` no schema — G8, correto). Nome em `<h1>` (linha 99).
- **T-03:** `CurrentPositionCard` (linhas 106-124): `#{position}` (`text-4xl font-bold text-primary`) + "de {total} participantes"; `position={entry.position}`, `total={rankingQuery.data?.entries.length ?? 0}` (linhas 69-72).
- **T-04:** `ProfileStatsGrid` (linhas 127-163): `erros = entry.wrong ?? stats?.totalWrong` (linha 134); métricas (linhas 135-144): Pontos=`String(entry.points)`, Acertos=`String(entry.points)` (mesmo valor binário, comentário linha 136), Erros=`erros === undefined ? "—" : String(erros)`, Aproveitamento=`entry.accuracy === undefined ? "—" : \`${entry.accuracy}%\``. Semântica `<dl>/<dt>/<dd>`.
- **T-05:** `StagePerformance` (linhas 166-194) itera `STAGE_LABELS` (linhas 14-20: grupos/oitavas/quartas/semifinal/final — exclui "geral"/"dezesseis-avos"/"terceiro"); `pts = stats ? (stats.correctByStage[scope] ?? 0) : null`; render `pts === null ? "—" : \`${pts} pts\``. `correctByStage` é `partialRecord(stageSchema,…)` → index `number | undefined`, tratado por `?? 0`. Sub-h2 (linha 173).
- **T-06:** `const rankingQuery = useRanking("geral")` (linha 39); `const statsQuery = useParticipantProfile(uid)` (linha 40); `entry = rankingQuery.data?.entries.find((e) => e.uid === uid) ?? null` (linhas 56-57). Wiring = default proposto pelo spec (G6); sem novo serviço.
- **T-07:** loading `if (rankingQuery.isLoading || statsQuery.isLoading) return <RankingSkeleton/>` (linhas 42-44); error `if (isError) return <RankingErrorState onRetry={() => { void rankingQuery.refetch(); void statsQuery.refetch(); }}/>` (linhas 45-54); not-found `if (!entry) return <RankingEmptyState message="Participante não encontrado"/>` (linhas 59-61). `RankingEmptyStateProps.message` aceito (componente confirmado).
- **T-08:** Nenhum botão renderizado. Comentário-guarda em `ParticipantProfile.tsx:75-79` referencia A5 RESOLVIDO=privado, sem navegação/destino, rules cruzadas → TASK-14. Test "NÃO renderiza o botão … (A5 privado)" (`__tests__:79-83`) assert `queryByText(/Ver histórico de palpites/i)` é `null`.
- **T-09:** `rtk tsc --noEmit` → "TypeScript compilation completed" (exit 0). Scan do arquivo: sem `any`, sem hex, sem estilo inline; classes só tokens semânticos (`bg-card`, `text-primary`, `text-muted-foreground`, `border-border`). Nenhum ícone Lucide usado nesta tela (sem `<` voltar/compartilhar — G2 omitido) — nada a marcar `aria-hidden`. Vitest 3/3 verde.

## 4. Test correlation
`ParticipantProfile.test.tsx` (3, jsdom, mock do barrel `@/features/rankings` + import direto do componente):
1. populado: nome "Lucas Pereira", "#5", "de 2 participantes", `getAllByText("11").length ≥ 2` (Pontos+Acertos mesmo valor binário), "23%", "6 pts" (grupos). Assertam texto renderizado real.
2. guarda A5: botão histórico ausente (`queryByText` null).
3. not-found: `uid="u-zzz"` ausente no ranking → "Participante não encontrado".
Tests realmente rodaram (default reporter, "Tests 3 passed (3)", duração 2.07s).

## 5. Out-of-scope drift
none. Apenas Tela 05. Sem novos serviços/hooks (reusa `useRanking`/`useParticipantProfile` de TASK-05). Sem escrita. Botão histórico/predictions alheias corretamente não implementados (A5).

## 6. Findings
- BLOCKER: nenhum
- WARNING: 2 (ver review) — duplicação de `<h1>` (layout "Ranking" + nome do participante); `RankingSubNav` vaza na tela de perfil (carry-forward TASK-07). Nenhum bloqueia.
  - Nota (G3): linha "Participante desde {createdAt}" **omitida** — `createdAt` não está em `rankings`/`statistics`. Intencional/correto (não defeito). O componente exibe `@{nickname}` como subtítulo no lugar.
  - Nota (G4): "X de Y jogos" **omitido** no Aproveitamento (Y não exposto). Intencional/correto.
  - Nota (G5): "#N por fase" **omitido** em Desempenho por Fase (`correctByStage` só tem acertos). Intencional/correto.
  - Nota (G7): Pontos e Acertos mantêm ambos os rótulos com o mesmo número (binário) — fidelidade ao layout, sem métrica de "vencedor". Correto.

## 7. Verdict: goal-achieved
