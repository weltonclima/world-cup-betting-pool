# DIAGNÓSTICO — Tela de ranking vazia / não mostra membros do grupo

## 1. Resumo do bug
- **Sintoma reportado:** a tela de ranking não funciona — jogadores do grupo que acertaram palpites não aparecem; a expectativa é que **todos os membros do grupo** apareçam.
- **Comportamento esperado:** ranking listando todos os participantes aprovados (mesmo com 0 ponto), com pontos/posição de quem acertou.
- **Comportamento atual:** tela renderiza o estado vazio (`RankingEmptyState`) ou um ranking desatualizado, sem os membros que pontuaram.

## 2. Causa raiz
A agregação de ranking **nunca é disparada de forma automática**. Toda a tela de ranking lê **documentos pré-computados** no Firestore (`rankings/geral`, `rankings/{fase}`, `rankings/grupo-{id}`, `rankings/pool-{id}-geral`, `statistics/{uid}`, `pool_stats/current`). Esses documentos só são escritos pelo endpoint `POST /api/rankings/recalc`.

Esse endpoint **não tem nenhum gatilho automático no projeto**:
- A Cloud Function agendada (cron diário 02:00 que recalculava o ranking) foi **removida e nunca reintroduzida** — confirmado no comentário em `functions/src/index.ts:10-13`: *"A CF de ranking ... **será reintroduzida** no PRD de ranking"*. Hoje só exporta `promoteFirstAdmin` e `syncRoleClaimOnUserUpdate`.
- Não há configuração de cron/schedule em nenhum arquivo (`apphosting.yaml`/`*.yml`/`*.json`/`*.toml`) — busca não retornou nada.
- Nenhum componente client ou tela de admin chama `/api/rankings/recalc` nem `/api/predictions/score` — as únicas referências no código são os próprios route handlers e seus testes.

Os únicos caminhos que executam o recalc são:
1. POST manual do admin em `/api/rankings/recalc` (sessão admin), **ou**
2. Cron externo enviando `x-cron-secret: RANKINGS_SECRET`, **ou**
3. Encadeamento via `chainRecalc()` dentro de `/api/predictions/score` — que **também** só roda por admin manual / cron externo (`SCORE_SECRET`) e ainda exige `RANKINGS_SECRET` configurado (`route.ts:20-21`).

**Consequência:** sem cron configurado e sem disparo manual, `rankings/geral` nunca é (re)escrito. `getGeneralRanking()` lê doc inexistente → retorna `null` → `GeneralRanking` cai em `RankingEmptyState` (`GeneralRanking.tsx:44`). Quem acertou fica invisível porque **nenhuma agregação rodou para registrar pontos/posição**. Variante igualmente compatível: o recalc rodou manualmente **uma vez** no passado; o doc existe mas está **congelado** — membros novos do grupo (adicionados via PRD-09/PRD-11) e quem pontuou depois não aparecem, pois o recalc nunca re-rodou. Em ambos os casos a causa raiz é a mesma: **não existe gatilho recorrente que re-execute a agregação**.

## 3. Código afetado
- `functions/src/index.ts:10-17` — cron de ranking removido, não reintroduzido (gap documentado).
- `src/app/api/rankings/recalc/route.ts:76-401` — única fonte de escrita dos docs de ranking; só roda sob auth admin/secret.
- `src/app/api/predictions/score/route.ts:19-34` — `chainRecalc` best-effort, condicionado a `RANKINGS_SECRET`; também sem gatilho próprio.
- `src/services/rankings.ts:33-44` — doc inexistente → `null`.
- `src/features/rankings/components/GeneralRanking.tsx:44` — `!data || entries.length === 0` → estado vazio.

## 4. Caminho de reprodução
`/rankings` → `GeneralRanking` → `useGeneralRanking()` → `getGeneralRanking()` → `getDoc(rankings/geral)` → **não existe / desatualizado** → `null` → `RankingEmptyState`. (Nada no fluxo dispara `recalc` para criar/atualizar o doc.)

## 5. Raio de impacto (blast radius)
Tudo que lê os docs de agregação fica vazio/desatualizado:
- Ranking geral (`rankings/geral`), por fase (`rankings/{scope}`), por grupo (`rankings/grupo-{id}`).
- Ranking por pool (`rankings/pool-{id}-geral`) → enriquecimento em `GET /api/group/users/approved` (`_list.ts`).
- Perfil do participante (`statistics/{uid}`) e stats do bolão (`pool_stats/current`).
- Quaisquer widgets de ranking no dashboard/home que leiam esses docs.

## 6. Nível de risco
**Alto** — funcionalidade central (ranking) inoperante de ponta a ponta em produção. Risco da correção: **baixo–médio** (introduzir gatilho + popular uma vez).

## 7. Direção da correção (sem implementar)
1. **Popular agora:** disparar o recalc uma vez (admin POST ou via secret) para criar/atualizar os docs imediatamente.
2. **Gatilho recorrente:** reintroduzir a execução automática do recalc — Cloud Function agendada (ou cron externo no App Hosting) chamando `/api/rankings/recalc` com `RANKINGS_SECRET`, e garantir `RANKINGS_SECRET`/`SCORE_SECRET` configurados em produção. Idealmente recalcular após (a) partidas finalizarem e (b) mudanças de membros do grupo.
3. **(Opcional) Ação manual de admin:** botão "recalcular ranking" para disparo sob demanda, útil como fallback operacional.

> Verificação sugerida pelo usuário (confirma a hipótese): conferir no console do Firestore se o doc `rankings/geral` existe e qual o `updatedAt`. Ausente ou antigo → confirma a causa raiz.
