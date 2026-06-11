# PRD — Grupos e Eliminatórias (PRD-03.2)

> Versão: 1.1 (decisões de formato 2026 travadas no checkpoint)
> Fonte: `docs/prd-3-2/PRD-03.2-Centro-da-Competicao.md`
> Layout fonte de verdade: `docs/prd-03-1/prd-3-2.png` (mosaico PRD03-04…PRD03-11 — classificação de grupos, resumo, chaveamento oitavas/quartas/semi/final; tema verde, cards com bandeiras)
> Dependências: PRD-03 (Jogos), PRD-03.1 (Tabela e Chaveamento)

## 1. Feature summary

Duas visualizações **somente leitura** dentro da área Jogos:

1. **Aba Grupos** — classificação oficial dos grupos (tabela `# Seleção P J V E D GP GC SG PTS`), seletor de grupo, indicação de classificados/eliminados.
2. **Aba Eliminatórias** — chaveamento oficial (fases até a final), com 3 estados por confronto: aguardando definição / definido / encerrado (com placar).

Sem edição, sem Cloud Functions, compatível com Firebase Spark. Fonte exclusiva: openfootball `2026/worldcup.json` (já é a fonte do projeto via `src/server/copaData`).

Navegação: ao acessar Jogos, três abas — `Partidas | Grupos | Eliminatórias`.

## 2. Consolidated scope

- **Backend:** Route Handlers Next.js
  - `GET /api/worldcup/groups` → `{ groups: [...] }` com standings **computados** por grupo.
  - `GET /api/worldcup/bracket` → confrontos eliminatórios agrupados por fase.
- **Modelos:** `GroupStanding` (position, team, played, wins, draws, losses, goalsFor, goalsAgainst, goalDifference, points) e `KnockoutMatch` (id, phase, homeTeam, awayTeam, homeScore?, awayScore?, status).
- **Frontend:** abas dentro de Jogos; tela Grupos (seletor de grupo, default Grupo A, tabela, legenda, classificados/eliminados); tela Eliminatórias (lista vertical por fase, estados por confronto).
- **React Query keys:** `["groups"]`, `["group", groupId]`, `["bracket"]`.
- **Cache:** grupos/eliminatórias 24h; jogos em andamento 1 min.
- **Estados UI:** Skeleton (loading), "Nenhuma informação disponível." (empty), "Erro ao carregar informações." + botão "Tentar novamente" (error).
- **Desempate (regra FIFA):** pontos → saldo de gols → gols marcados → confronto direto → fair play → sorteio.
- **Responsividade:** mobile-first 360/390/430, tablet 768, desktop 1024+.
- **Segurança:** usuários autenticados; somente leitura.
- **Performance:** carregamento ≤ 2s.

## 3. System understanding relevant to this feature

- **Dados da Copa já resolvidos:** `src/server/copaData` expõe `fetchAllMatches()` (104 jogos, grupos + mata-mata com placeholders "2A"/"W74") e `fetchAllTeams()` (derivadas dos jogos de grupo, com `groupId`, `flagUrl`, `code`). Scores openfootball: `ft/ht/et/p`. Cache tiers em `src/server/cache/tiers.ts` (grupos/seleções 24h, jogoAoVivo 1m) espelhados em `STALE_TIME` p/ React Query.
- **Formato 2026 já modelado no projeto:** `stageSchema` = `grupos | dezesseis-avos (Round of 32) | oitavas | quartas | semifinal | terceiro | final`. 48 seleções, **12 grupos A–L**. Feature `melhores-terceiros` já existe em predictions.
- **Rotas existentes sobrepostas:**
  - `GET /api/standings` — composição dos grupos (times por grupo), **sem** estatísticas computadas.
  - `GET /api/matches` — todos os jogos (inclui mata-mata) já mapeados para `MatchWithId` com `stage`, `groupId`, placares, status.
- **Área Jogos atual:** `/matches` renderiza `<MatchList>`; header tem busca + chips de fase, **não tem abas**. Título da tela oculto (`sr-only`) por decisão recente.
- **Padrões:** feature slice `src/features/<x>/{components,hooks,lib}`; services com Zod `parseWithId`; erros tipados pt-BR; Route Handlers `runtime nodejs`; reads de Copa via Route Handlers + React Query (não Firestore).
- **Firestore:** PRD permite cache opcional — **adotado** (decisão §6.8): snapshot computado de groups/bracket em coleção server-only, read-through nos Route Handlers. Verificado no repo openfootball 2026: não existe classificação pronta (`worldcup.groups.json` tem só composição name+teams) — computar é obrigatório.

## 4. Technical impact analysis

- **Novos Route Handlers** `src/app/api/worldcup/{groups,bracket}/route.ts` consumindo `copaData` (sem nova integração externa). Reuso de `copaDataErrorResponse`.
- **Novo cálculo de domínio:** standings por grupo derivados dos resultados dos jogos de grupo (V/E/D/GP/GC/SG/PTS + ordenação por critério de desempate). Hoje não existe em lugar nenhum — lógica pura, testável.
- **Bracket:** derivar confrontos eliminatórios de `fetchAllMatches()` filtrando por `stage ≠ grupos`, mapeando placeholders → estado "aguardando definição".
- **Novos schemas/types:** `GroupStanding`, `KnockoutMatch` (+ respostas das rotas) em `src/schemas` / `src/types`.
- **Frontend:** nova feature slice (ex.: `src/features/worldcup` ou extensão de `matches`); novas rotas/abas em `/matches` — mudança no layout da área Jogos (abas Partidas/Grupos/Eliminatórias). Página atual `/matches` passa a ser a aba "Partidas".
- **Sem impacto** em Firestore Rules, auth flows, predictions ou rankings. Sem novos secrets/env.
- **Contrato `/api/standings`:** sobreposição parcial — consumidores atuais (predictions grupos) continuam; nova rota não substitui sem migração.

## 5. Risks

- **Desempate FIFA incompleto nos dados:** confronto direto é computável dos jogos; **fair play (cartões) e sorteio NÃO existem** no openfootball. Empate total → ordem indeterminística. Mitigação: aplicar critérios 1–4 e fallback estável (alfabético) documentado.
- **Dados 2026 incompletos até o torneio:** scores ausentes (`score?`), placeholders no mata-mata, possíveis mudanças de shape no JSON da comunidade openfootball. UI precisa degradar bem (tabela zerada, "Aguardando definição").
- **Classificação ao vivo:** cache 24h vs "jogos em andamento 1 min" — risco de tabela defasada durante rodadas. Precisa de tier dinâmico ou aceitar defasagem.
- **Refactor do header de Jogos:** introduzir abas mexe em tela testada (TASK-04/05 do PRD-03) — risco de regressão em filtros/busca.
- **Bracket placeholder mapping:** "2A"/"1E"/"W74" → exibir rótulo amigável exige tradução de placeholders; erro aqui mostra códigos crus ao usuário.

## 6. Decisions locked (checkpoint /flow 2026-06-10)

1. **Formato 2026 real** (decisão do usuário): **12 grupos A–L**, 48 seleções. Exemplos 8-grupos do PRD são ilustrativos.
2. **Bracket completo 2026:** `roundOf32` (Dezesseis-avos, jogos 73–88) → `roundOf16` → `quarterFinals` → `semiFinals` → `thirdPlace` → `final`. Response shape do PRD estendida com `roundOf32` e `thirdPlace`.
3. **Classificados:** 1º e 2º = "Classificado". **3º = "Possível classificado"** (8 melhores terceiros avançam — regra 2026; consistente com feature melhores-terceiros existente). 4º = "Eliminado". Status definitivo do 3º só após fim da fase de grupos — exibir badge neutro até lá.
4. **Desempate:** critérios FIFA 1–4 computáveis (pontos, SG, GP, confronto direto); fair play e sorteio **não computáveis** → fallback determinístico alfabético, documentado no código.
5. **`/api/standings` permanece intocado**; `/api/worldcup/groups` coexiste (deprecação fora de escopo).
6. **Abas = rotas URL** (`/matches` = Partidas, `/matches/grupos`, `/matches/eliminatorias`) com layout compartilhado (segmented control). Deep-link habilitado.
7. **Auth:** seguir posture existente das rotas de Copa (sem verificação de sessão no handler — dados públicos de torneio; área `(app)` já é guardada no client). Consistência > endurecimento.
8. **Cache em Firestore (decisão do usuário, checkpoint TASK-02):** resultado computado (groups e bracket) persistido em Firestore p/ não reprocessar e p/ resiliência a indisponibilidade do openfootball/GitHub. Padrão read-through no Route Handler: snapshot fresco → retorna; stale/ausente → fetch openfootball + computa + grava snapshot (best-effort) → retorna; openfootball fora + snapshot existe → retorna snapshot stale. TTL 24h padrão; 60s durante janela com jogo de grupo ao vivo. Coleção server-only (Admin SDK; Rules `allow read, write: if false`). Compatível com Spark (writes só em cache miss).
9. **Header:** layout image manda — segue padrão atual da área Jogos (título sr-only + tabs visíveis).

## 6.1 Remaining gaps (aceitos)

- Shape do JSON openfootball 2026 pode mudar (repo comunitário) — client já tem erros tipados.
- Fair play/sorteio indeterminável (ver decisão 4).

## 7. Recommended implementation concerns

- Standings = **função pura** (`computeGroupStandings(matches)`) com testes de desempate exaustivos; rotas só orquestram.
- Reusar `copaData` + `cache/tiers.ts`; nenhum fetch novo, nenhum Firestore.
- Seguir convenção de slice existente; abas como rotas filhas de `/matches` (layout compartilhado com segmented control).
- Schemas Zod primeiro (contrato), types derivados — padrão do projeto.
- Placeholders do bracket: mapear via `teamRegistry` quando real; rótulo pt-BR ("Aguardando definição", "Vencedor Jogo 74") quando não.
- Manter `/api/standings` intocado nesta feature.
- Layout: seguir `prd-3-2.png` (cards verdes, bandeiras, segmented tabs) sobre os exemplos textuais do PRD quando divergirem.
