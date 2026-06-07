# PRD — Home Dashboard (PRD-02)

> Fonte: `docs/prd-02/PRD-02-Home-Dashboard.md` + mockup `docs/prd-02/home.png`
> Feature: `home-dashboard` · Versão 1.0 · Gerado em 2026-06-06

## 1. Feature summary

Primeira tela após login de usuário **approved**. Painel central (read-only) que
agrega, em um lugar, a situação do usuário no bolão e o estado da Copa:
posição no ranking, acertos, aproveitamento, próximo jogo palpitável, últimos
resultados, fase atual e avisos do sistema. Consome **exclusivamente Firestore**
(nunca API-Football direto). Mobile-first, com Bottom Navigation obrigatória.

A rota `/home` e o shell (`AppShell` + `AuthGuard` + `BottomNav`/`Header`) já
existem (PRD-01). Esta feature preenche o conteúdo do dashboard — hoje a página
`src/app/(app)/home/page.tsx` é placeholder.

## 2. Consolidated scope

**Inclui (9 blocos + chrome):**
1. **Header de boas-vindas** — saudação "Olá {nome} 👋", avatar, sino de notificações.
2. **Card Ranking Geral** — posição, total de participantes, pontos.
3. **Card Acertos** — total de placares exatos.
4. **Card Aproveitamento** — `%` = (acertos ÷ jogos palpitados) × 100 + fração.
5. **Card Próximo Jogo** — seleções (nome+bandeira), data/hora, status do palpite, CTA (Ver Jogo / Enviar / Editar).
6. **Card Fase Atual** — estágio da Copa (+ "Rodada X de Y" — ver R4).
7. **Card Últimos Resultados** — até 5 jogos finalizados com placar + acertou/errou do usuário.
8. **Card Meu Desempenho** — jogos palpitados, acertos, erros, aproveitamento.
9. **Card Avisos** — comunicados do sistema.
10. **Estados** — loading (skeletons), empty (sem jogos/resultados), error (+ "Tentar Novamente").

**Não inclui (escopo de outros PRDs):**
- Telas de Jogos, Palpites, Ranking, Perfil (Bottom Nav só navega; destinos são placeholders).
- Ingestão/cálculo de dados da Copa (resultados/ranking/estatísticas) — feito por **script Node + `firebase-admin` rodando fora do app** (PRD/tarefa futura). **Não há Cloud Functions** e o app é static export (sem servidor) → app nunca chama a API. No MVP os dados vêm de **seed de dev**.
- Sistema de notificações realtime (sino é visual; realtime fica como gap, ver R5).

## 3. System understanding (partes relevantes)

**Padrões já estabelecidos (PRD-01) a seguir:**
- **Rotas internas** sob `src/app/(app)/` protegidas por `AuthGuard` (status approved → children; pending → `/pending`; blocked/erro → BlockedScreen). `home/page.tsx` já existe.
- **Shell** `src/components/layout/AppShell.tsx` monta `Header` + conteúdo + `BottomNav` (`nav-items.ts`).
- **Auth context** `useAuth()` (`src/hooks/useAuth.ts`) expõe `profile` (nome, nickname), `firebaseUser`, `role`, `status`.
- **Data fetching** TanStack Query, política central em `makeQueryClient` (staleTime 30min, gcTime 24h — note divergência com PRD §Performance "5min", ver A2). Padrão: serviço puro Firestore em `src/services/*` + hook `useQuery` em `src/features/*/hooks/*` + factory de query keys (ex.: `usersKeys.ts`). Doc validado por schema Zod no serviço (`.parse`), erro propaga cru.
- **Schemas Zod** já existem para todas as coleções em `src/schemas/`: `rankings`, `statistics`, `predictions`, `matches`, `teams`, `users`, `systemSettings`. **Tipos derivados** em `src/types/`. Estes schemas são a fonte de verdade — têm precedência sobre os JSON ilustrativos do PRD-02 (ver §5).
- **Forms** React Hook Form + Zod (não há form nesta feature — dashboard read-only; CTAs apenas navegam).

**Coleções e shape REAL (código), por card:**
| Card | Fonte real | Observação |
|---|---|---|
| Ranking Geral | `rankings` doc `scope:"geral"` → `entries[]` (`uid, nickname, position, points`) | Posição/pontos do usuário = achar entry por uid; "total participantes" = `entries.length` |
| Acertos | `statistics/{uid}.totalCorrect` | direto |
| Aproveitamento | `statistics/{uid}.accuracy` | já calculado (0–100) |
| Próximo Jogo | `matches` (status `scheduled`, menor `kickoffAt`) + `teams` (nome/bandeira) + `predictions` do uid p/ o matchId | join client-side |
| Fase Atual | `system_settings.currentStage` | "Rodada X de Y" não tem campo (R4) |
| Últimos Resultados | `matches` (status `finished`, ordenado desc por `kickoffAt`, limit 5) + `teams` + `predictions` do uid | acertou/errou = comparar placar (R3) |
| Meu Desempenho | `statistics/{uid}` | `gamesPredicted`/`wrong` ausentes no schema (R1) |
| Avisos | `system_settings` | schema só tem flags; sem lista de avisos (R6) |

## 4. Technical impact analysis

**Novos arquivos (sem alterar contratos existentes):**
- `src/services/rankings.ts`, `statistics.ts`, `matches.ts`, `predictions.ts`, `teams.ts`, `systemSettings.ts` — leituras puras Firestore validadas por Zod.
- `src/features/home/` — hooks (`useHomeDashboard` ou hooks por card) + query-keys factory + componentes de card + estados (skeleton/empty/error).
- Conteúdo de `src/app/(app)/home/page.tsx` (substitui placeholder).

**Módulos tocados:** nenhuma mutação de schema/serviço existente esperada — **exceto** possível extensão de `statistics`/`systemSettings`/`users` (ver Riscos). `BottomNav`/`Header`/`AppShell` já existem; Header pode ganhar avatar/sino (R7).

**Integrações:** somente Firestore (Client SDK). **Zero** chamada a API-Football no frontend (critério de aceite duro — app é static export, sem servidor onde esconder a key). Dados dependem de um **script de ingestão Node + Admin SDK** (fora do app, fora do escopo desta feature) ter populado `rankings`/`statistics`/`matches`; no MVP, de seed de dev.

**Arquitetura/concerns:** read-heavy, múltiplas coleções → cuidar de N+1 e joins client-side; cache TanStack; budget de carregamento < 2s (perf). Sem novas dependências.

**Persistência:** apenas leitura. Sem migração de dados pelo frontend. Lacunas de campo (R1/R3/R4/R6) podem exigir mudança de modelo no backend/seed — decisão de produto.

## 5. Risks

- **R1 — `statistics` não tem `gamesPredicted` nem `wrong`.** Schema real: `{uid, totalCorrect, accuracy, longestStreak, correctByStage, positionHistory}`. Card "Meu Desempenho" e o denominador do aproveitamento pedem jogos palpitados e erros. Opções: (a) derivar `gamesPredicted` de `accuracy`+`totalCorrect` (frágil, arredondamento), (b) contar `predictions` do uid (custo de leitura + só conta palpites, não jogos finalizados), (c) **estender schema `statistics`** (preferido) com `gamesPredicted`/`wrong`, populados pelo script de ingestão. **Bloqueia** "Meu Desempenho" completo até decisão.
- **R2 — `predictions` não armazena `isCorrect`.** Schema real guarda só o placar previsto. "Acertou/Errou" em Últimos Resultados exige comparar `prediction(home/away)` com `match(home/away)Score` no client (possível, jogo finalizado tem placar) OU persistir `isCorrect`. Comparação client-side é viável e sem custo extra de modelo — **recomendado** para o MVP.
- **R3 — Join client-side matches×teams×predictions.** Sem desnormalização, cada card de jogo precisa de leituras de `teams` (nome/bandeira) e `predictions`. Risco de N+1 e de estourar o budget de 2s. Mitigar: buscar `teams` uma vez (coleção pequena, <50) e cachear; `predictions` do uid em uma query.
- **R4 — "Rodada X de Y" não existe no modelo.** `matches` tem só `stage`; sem número de rodada/matchday. Exibir só a fase, OU estender `matches`/`system_settings`. Decisão de produto.
- **R5 — Sino de notificações / realtime.** PRD §Performance pede realtime p/ notificações e status do usuário, mas não há coleção `notifications` nem listener. Tratar sino como estático no MVP; realtime é trabalho futuro.
- **R6 — "Avisos" sem fonte estruturada.** `system_settings` só tem flags booleanas (`registrationOpen`, `predictionsLocked`, `currentStage`). Os exemplos de aviso ("prazo encerra em 3h", "nova fase") não têm campo. Opções: derivar avisos de flags + próximo kickoff, ou criar coleção/array de avisos. Decisão de produto.
- **R7 — `users` sem `avatarUrl`.** PRD-02 mostra avatar; schema `users` real não tem `avatarUrl`. Usar iniciais (já existe `userAvatar.ts` no admin) como fallback, ou estender `users`. Recomendado: reusar avatar por iniciais no MVP.
- **R8 — Dados dependem de ingestão externa inexistente.** `rankings`/`statistics`/resultados são populados por **script Node + Admin SDK** fora do app (sem Cloud Functions; app static export). Sem ele, dashboard cai em estados empty/error. Garantir estados robustos e **seed de dev** (fonte de dados do MVP).

## 6. Ambiguities and gaps

- **A1 — "Total participantes" (de 28):** `entries.length` do ranking geral ou contagem de `users` approved? Assumir `entries.length` (fonte já agregada).
- **A2 — Cache 5min (PRD) vs 30min (projeto):** projeto centraliza 30min/24h em `makeQueryClient`. Manter política do projeto salvo decisão explícita; não redefinir por hook (consistente com `useUsersByStatus`).
- **A3 — Aproveitamento: denominador "jogos palpitados" vs "jogos" (48):** mockup mostra "12 de 48 jogos" mas fórmula diz "jogos palpitados". `statistics.accuracy` já é a verdade — exibir o número agregado, não recalcular. Definir o texto do denominador depende de R1.
- **A4 — Ordenação/limite de Últimos Resultados:** assumir `status:"finished"` ordenado por `kickoffAt` desc, limit 5.
- **A5 — Próximo jogo "disponível para palpite":** assumir menor `kickoffAt` com `status:"scheduled"` (e palpites não travados por `system_settings.predictionsLocked`?). Confirmar regra de elegibilidade.
- **A6 — Empatriz de CTA do Próximo Jogo:** "Enviar Palpite" (sem palpite) vs "Editar Palpite" (com palpite) vs "Ver Jogo". Mapear pelos `predictions(uid, matchId)` existentes; destino é placeholder (Palpites/Jogos não implementados).

## 7. UI/Layout impact

- **UI Impact:** yes
- **Platforms:** both (mobile-first; tablet 768; desktop 1024+)
- **Screens:** `/home` (nova superfície de conteúdo, dentro do shell existente) — Header de boas-vindas, 8 cards, Bottom Nav (já existe), 3 estados (loading/empty/error)
- **Product type:** Sports/club + Performance-Analytics dashboard (consumer, youth-friendly) — ref. ui-ux-pro-max
- **Recommended style direction:** **Card-based dashboard, energético porém limpo**, alinhado ao tema existente do projeto (Shadcn UI + Tailwind, **primary verde**, superfícies claras, cantos arredondados — ver `home.png` e tema auth). Acentos vivos para destaques (posição/acertos), métricas grandes (números 28–32px), ícones Lucide. Evitar neon do preset "Vibrant"; respeitar tokens já definidos em `globals.css`. Estados de acerto/erro com semântica de cor (verde/vermelho) AA.
- **Design complexity:** medium-high (8 cards heterogêneos, joins de dados, 3 estados, responsividade em 3 breakpoints, skeletons por card)

## 7b. Decisões resolvidas (checkpoint com o usuário)

- **D1 (R1) — Modelo de dados MVP sem novos campos em `statistics`/`predictions`.** `isCorrect` derivado por comparação de placar no client (jogo finalizado tem `goals`). `gamesPredicted`/`wrong`: derivar/ocultar, sem alterar `statistics`. `accuracy`/`totalCorrect` continuam fonte de verdade agregada.
- **D2 (R8) — Seed de dev espelhando o shape da API-Football.** Script popula Firestore (matches/teams/predictions/rankings/statistics/system_settings) no formato já mapeado da API. **Sem Cloud Functions:** ingestão real da API = **script Node + `firebase-admin`** rodando fora do app, em PRD/tarefa futura (gatilho a definir: manual ou GitHub Actions). No MVP, só seed; frontend e testes rodam com dados reais agora.
- **D3 — Alinhar schemas à fonte real (API-Football).** Fonte canônica dos dados da Copa = API-Football v3 (`league=1`, `season=2026`), consumida só por **script Node (Admin SDK)/seed** → Firestore (app static export nunca chama a API). Mudanças de schema necessárias (ver Apêndice A), tratadas como **primeira tarefa do plano**:
  - `matches`: adicionar `venue { name, city }` e `round`/`matchday` (de `league.round`).
  - `shared.stageSchema`: adicionar `"terceiro"` (disputa 3º lugar) — listado em PRD-02 e PRD-03; API tem round "3rd Place Final".
  - Guardar id da API como `homeTeamId`/`awayTeamId` e como doc id de `matches`.
- **Resolve R3** (venue agora no schema) e **R4** ("Rodada X de Y" vem de `league.round`, ex.: "Group Stage - 2" → rodada 2). **R2** confirmado: isCorrect por comparação.

## 8. Implementation concerns (alto nível, sem tarefas)

- **Camada de serviços primeiro:** um serviço puro por coleção lida (`rankings`, `statistics`, `matches`, `teams`, `predictions`, `systemSettings`), cada um validando com o schema Zod existente. Espelha `src/services/users.ts`.
- **Hooks TanStack Query** por recurso, com factory de query-keys (`homeKeys`), herdando staleTime/gcTime global. Considerar um hook compositor `useHomeDashboard` que orquestra as queries e expõe `isLoading/isError` agregados para os estados de tela.
- **Joins client-side** com `teams` cacheado (coleção pequena) para resolver nome/bandeira; comparar placar p/ acertou/errou (R2).
- **Estados de tela** reutilizáveis: skeleton por card, empty e error com retry (`refetch`). Reusar `LoadingScreen`/padrões existentes onde fizer sentido.
- **Acessibilidade/perf** (ui-ux-pro-max): contraste AA nas cores semânticas, alvos de toque ≥44px na Bottom Nav (já existe), imagens de bandeira otimizadas, evitar layout shift com skeletons, budget < 2s.
- **Gating de dados ausentes** (R8): toda query deve degradar para empty/error sem quebrar a tela.
- **Decisões de produto pendentes** (R6/R7 + A1–A6) resolvidas no `/plan`/`/spec`. R1–R4/R8 já resolvidas (§7b). Cards sem dependência podem avançar primeiro.

---

## Apêndice A — Contrato API-Football v3 → Firestore

> Fonte da Copa: API-Football v3 (`league=1`, `season=2026`). Consumida **só por script Node + `firebase-admin`** (fora do app) / seed → Firestore. **Sem Cloud Functions; app é static export (sem servidor)** → app nunca chama a API (critério de aceite duro). Compartilhado com PRD-03 (Jogos).

**Envelope:** `{ get, parameters, errors, results, paging, response[] }`.

**`/fixtures` → coleção `matches`:**
| Campo `matches` | Origem | Nota |
|---|---|---|
| doc id | `fixture.id` | id da API |
| `homeTeamId`/`awayTeamId` | `teams.home.id`/`away.id` | id da API |
| `kickoffAt` | `fixture.date` | ISO 8601 ✓ |
| `venue.name`/`venue.city` | `fixture.venue.name`/`city` | **novo** |
| `stage` | derivar de `league.round` | mapa abaixo |
| `round`/`matchday` | parse de `league.round` | "Group Stage - 2" → 2 (**novo**) |
| `groupId` | `standings[].group` ou round | "Group A" |
| `status` | mapear `fixture.status.short` | mapa abaixo |
| `homeScore`/`awayScore` | `goals.home`/`away` | null até finalizar |

**Mapa `status.short` → `matchStatusSchema`:** `NS,TBD`→`scheduled` · `1H,HT,2H,ET,BT,P,LIVE,SUSP,INT`→`live` · `FT,AET,PEN`→`finished` · `PST`→`postponed` · `CANC,ABD,WO,AWD`→`canceled`.

**Mapa `league.round` → `stageSchema`:** `Group Stage`→`grupos` · `Round of 16`→`oitavas` · `Quarter-finals`→`quartas` · `Semi-finals`→`semifinal` · `3rd Place Final`→`terceiro` (**novo**) · `Final`→`final`.

**`/teams` → coleção `teams`:** `team.name`→`name` · `team.code`→`code` (BRA) · `team.logo`→`flagUrl` · grupo de `standings[].group`.

**Não usar da API:** `/standings` (classificação da Copa ≠ ranking do bolão) e `/predictions` (palpite de resultado da própria API ≠ palpites dos usuários). `rankings`/`statistics` são **cálculo nosso** (pontuação binária).
```
