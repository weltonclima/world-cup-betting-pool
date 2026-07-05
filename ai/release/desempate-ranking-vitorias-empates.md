# RELEASE PLAN — Desempate por vitórias e empates no ranking

## 1. Resumo do release
Adiciona dois passos de desempate ao comparador de ranking (`compareRanking` em
`src/features/rankings/lib/rankingSort.ts`): quando os pontos empatam, ordena por
vitórias acertadas (`correct + winner`) DESC e depois por empates acertados
(`draw`) DESC, antes dos critérios existentes. Mudança em **função pura**, sem
alteração de schema, API, UI ou persistência.

Tarefas concluídas: **TASK-01** (spec → tdd → implement → test → review = approved).

## 2. Pré-requisitos de deploy
- Merge da branch `claude/resume-hdtif1` na `main`.
- Pipeline de deploy padrão do App Hosting (Cloud Run) — sem passos extras.
- Nenhuma variável de ambiente nova. Nenhuma feature flag.

## 3. Considerações de dados e migração
- **Sem migração, sem backfill.** A `position` do ranking é derivada no recálculo
  server-side (`src/server/rankings/recalc.ts`); a mudança só afeta a **ordem** em
  caso de empate de pontos.
- **Efeito diferido:** rankings já gravados em Firestore só refletem a nova ordem
  no **próximo recálculo**. Sem risco de dados corrompidos — apenas ordenação.
- Os campos `correct/winner/draw` já são persistidos/agregados hoje; nada muda no
  formato dos documentos.

## 4. Estratégia de rollout
**Release direto.** Mudança pequena, isolada, de baixo risco, coberta por testes
unitários (comparador é função pura). Não requer flag, rollout faseado nem
migração-primeiro. Deploy padrão via merge → App Hosting.

## 5. Monitoramento e validação
- Após o primeiro recálculo pós-deploy, conferir que empates de pontos exibem a
  nova ordem (mais vitórias → mais empates → critérios antigos) numa tela de
  ranking com empates reais.
- Sem novos logs/métricas necessários.

## 6. Riscos
- **Baixo:** único risco é de percepção — usuários empatados podem mudar de
  posição relativa após o próximo recálculo. Esperado e desejado (é a feature).
- Nenhum risco de compatibilidade, contrato ou perda de dados.

## 7. Considerações de rollback
- **Trivial:** reverter o commit da mudança em `rankingSort.ts` e recalcular.
  Como não há migração nem mudança de dados, o rollback é apenas de código; o
  próximo recálculo volta à ordem anterior.

## 8. Checklist de release
- [x] Typecheck OK (`tsc --noEmit`)
- [x] Lint OK (sem novos warnings)
- [x] Testes de rankings verdes (231) + suíte geral (3487/3488; 1 falha
      pré-existente e não relacionada em `notificationMeta.test.ts`)
- [x] Review = approved
- [ ] Merge `claude/resume-hdtif1` → `main`
- [ ] Deploy App Hosting (pipeline padrão)
- [ ] Conferir nova ordem em ranking com empate de pontos após recálculo

## Nota fora de escopo
Falha pré-existente `relativeTime > dias atrás` (data-dependente, usa data real
em vez do `now` injetado) — não bloqueia este release; recomendável tratar em
`/flow-bugfix` separado.
