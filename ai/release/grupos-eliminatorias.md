# RELEASE — Grupos e Eliminatórias (PRD-03.2)

> PRD: `ai/prd/grupos-eliminatorias.md` (v1.1) · Plan: `ai/plan/grupos-eliminatorias.md` (8 tasks)
> Branch: `feat/grupos-eliminatorias`

## 1. Escopo entregue

Duas visualizações somente-leitura na área Jogos, formato Copa 2026 (12 grupos A–L, 48 seleções, Round of 32):

- **Aba Grupos** (`/matches/grupos`): seletor A–L, tabela `# Seleção J V E D GP GC SG PTS`, barra de qualificação por linha (Classificado/Possível/Eliminado/indefinido), legenda, 3 estados.
- **Aba Eliminatórias** (`/matches/eliminatorias`): 6 fases empilhadas (Dezesseis-avos → Final), cards de confronto em 3 estados (aguardando/definido/encerrado), placeholders pt-BR.
- **Abas** na área Jogos (Partidas/Grupos/Eliminatórias) com rotas/deep-link.
- **Backend:** `GET /api/worldcup/groups` e `/api/worldcup/bracket` com cache Firestore read-through.

## 2. Commits (9, TASK-01..08)

```
9053b67 TASK-08 tela Eliminatórias
86d9107 TASK-07 tela Grupos
663a480 TASK-06 abas área Jogos
2cc4359 TASK-05 service + hooks React Query
412bff9 TASK-04 fix (valida snapshot/payload)
372ab5b TASK-04 rotas groups/bracket cache Firestore
41bdbc8 TASK-03 derivação chaveamento
5a9a582 TASK-02 classificação grupos (desempate FIFA)
67213ed TASK-01 schemas e types
```

## 3. Validação

- **Testes:** suíte integral **2134/2134** verde (worldcup: 99). 0 regressão.
- **tsc:** limpo (zero `any`). **eslint:** 0 erros (warnings `<img>` aceitos, consistentes com `MatchCard`).
- **Build:** `next build` OK. Rotas `/matches/grupos` e `/matches/eliminatorias` estáticas (shell), dados via React Query; APIs `force-dynamic`.
- **Reviews:** spec + qualidade + ui-review (6 pilares) PASS em todas as tasks de UI.

## 4. Pré-requisitos de produção

- **Firestore:** nova coleção server-only `worldcup_cache` (≤2 docs). `firestore.rules` já tem bloco `allow read, write: if false` (TASK-04) — **fazer deploy das rules** antes/junto.
- **Sem novos secrets/env.** Sem migration. Sem Cloud Functions (Spark-safe; writes só em cache miss).
- **Admin SDK** já configurado (reuso `getAdminFirestore`).
- **Deploy:** Firebase App Hosting (SSR Cloud Run) — fluxo existente.

## 5. Rollout sugerido

1. Deploy `firestore.rules` (bloco worldcup_cache).
2. Deploy App Hosting (build já validado).
3. Smoke pós-deploy: abrir `/matches/grupos` (tabela zerada esperada pré-torneio, badges "indefinido") e `/matches/eliminatorias` (cards "Aguardando definição"). Confirmar 1ª chamada popula `worldcup_cache`.
4. Sem feature flag — feature é aditiva (não altera `/matches`, `/api/standings`, predictions).

## 6. Riscos / observações

- **Estado pré-torneio é o estado de produção no lançamento:** standings zerados + bracket 100% placeholder. UI degrada corretamente (verificado nos testes/fixtures).
- **Melhores terceiros NÃO são ranqueados pelo app:** 3º de cada grupo recebe badge "Possível classificado"; a resolução de *quais* 8 avançam vem da fonte openfootball (placeholder `3A/B/C/D/F` → nome real). Decisão travada PRD §6.3. Não é bug — é escopo.
- **Desempate FIFA:** critérios 1–4 computáveis; fair play/sorteio indisponíveis no openfootball → fallback alfabético determinístico (documentado).
- **Cache dinâmico:** TTL 60s só quando há jogo de grupo ao vivo; mapper openfootball atual não emite `live` → na prática TTL 24h hoje (forward-compat).
- **Branch carrega commits de passkey** (abaixo de `80db1b0`) ainda não mergeados em `main`. Confirmar estratégia de merge (rebase/merge) para não arrastar trabalho não relacionado, ou garantir que a feature passkey também está pronta.

## 7. Não incluído (escopo futuro)

- Ranking real dos 8 melhores terceiros (extensão de `computeGroupStandings`).
- Indicação et/pênaltis no placar do mata-mata (mapper só expõe `ft`).
- Deprecação de `/api/standings` (coexiste; fora de escopo).
