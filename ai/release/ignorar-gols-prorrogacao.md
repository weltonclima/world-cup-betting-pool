# RELEASE PLAN — Ignorar gols de prorrogação nas eliminatórias (config por grupo)

## 1. Resumo do release
Nova configuração por grupo (`ignoreOvertimeGoals`) que, quando ligada, faz a
**pontuação dos palpites nas fases eliminatórias** desconsiderar os gols da
**prorrogação** — comparando o palpite contra o **placar do tempo normal (90min)**,
reconstruído automaticamente dos dados gol-a-gol da ESPN. Efeito no **ranking do
pool** e nas **telas** (home, lista de palpites, perfil), coerente entre si.

Tarefas concluídas:
- **TASK-01** — placar regulamentar (90min) via ESPN (`details`) + correção do
  `STATUS_FINAL_AET` + bump `CACHE_VERSION` v3→v4.
- **TASK-02** — flag `ignoreOvertimeGoals` nas Configurações do Grupo.
- **TASK-03** — pontuação por 90min nos docs de ranking do pool (2 recalcs); PATCH
  de settings dispara recalc ao mudar a flag.
- **TASK-04** — exposição da flag em `/api/rankings/pool` + telas refletem o 90min.

## 2. Pré-requisitos de deploy
- Merge da branch `claude/resume-hdtif1` na `main`.
- Deploy padrão Firebase App Hosting (Cloud Run) — sem passos extras.
- **Nenhuma** variável de ambiente nova. **Nenhuma** feature flag global (a flag é
  por pool, default OFF).

## 3. Considerações de dados e migração
- **Sem migração, sem backfill.** Todos os campos novos são **aditivos/opcionais**:
  - Match: `homeScoreRegulation`/`awayScoreRegulation` (preenchidos pelo mapper ESPN
    só em mata-mata com prorrogação/pênaltis).
  - Pool: `ignoreOvertimeGoals` (default OFF na leitura).
  - Payload `/api/rankings/pool`: `ignoreOvertimeGoals` opcional.
- **Bump `CACHE_VERSION` v3→v4** (TASK-01): força recompute único dos snapshots
  `worldcup_cache` (bracket/groups) stale — automático, sem ação manual.
- **Efeito diferido/retroativo:** ligar a flag num pool dispara `recalcRankings`
  best-effort (TASK-03) que reescreve todos os docs de ranking do pool
  coerentemente. Os docs GLOBAIS (`rankings/geral`, `rankings/{scope}`) e o
  `statistics/{uid}`/`pool_stats` **permanecem no placar final** por design
  (agregados globais não comportam flag por pool).
- Docs/pools antigos sem os campos continuam válidos (parse OK).

## 4. Estratégia de rollout
**Release direto.** A feature nasce **desligada** (flag por pool default OFF) →
zero impacto até um group_admin ligar. Sem necessidade de flag global, rollout
faseado ou migração-primeiro. Deploy padrão via merge → App Hosting.

Adoção controlada pelo próprio group_admin: ligar a config quando quiser, por pool.

## 5. Monitoramento e validação
- Após deploy, confirmar que `/api/matches` e `/api/rankings/pool` respondem com os
  campos novos (aditivos).
- Num pool de teste: ligar a flag → verificar que o ranking do pool e os badges das
  telas passam a considerar o 90min em jogos de mata-mata que foram à prorrogação;
  desligar → volta ao placar final no próximo recálculo.
- Observar logs `[recalc]`/`[recalc-pool]` (warnings tolerantes de leitura de flag
  não devem derrubar o recalc).
- Sem novas métricas obrigatórias.

## 6. Riscos
- **Baixo — reconstrução do placar de 90min (TASK-01):** depende do array `details`
  da ESPN e da classificação de tempo por `displayValue`/`clock`. Mitigado por
  fallback conservador (sem base confiável → placar final) e testes com dados reais
  2026. Validar contra um jogo real com acréscimo longo no 2º tempo assim que
  disponível.
- **Baixo — consistência global vs pool:** por design, ranking global e
  estatísticas/perfil-stats persistidos ficam no placar final; só o escopo do pool
  muda. Comportamento documentado; pode gerar dúvida de usuário avançado.
- **Cosmético (follow-up):** "últimos resultados" na home exibe o placar final mas
  pontua pelo 90min — sem indicador visual de "placar considerado: 90min". Não
  bloqueia; recomendável adicionar o rótulo numa iteração de UI.
- **Custo:** recalc global passa a ler a coleção `pools` sempre (custo fixo baixo);
  re-agrega membros de pools flagged (≤2× agregação desses membros). Aceitável.

## 7. Considerações de rollback
- **Simples:** reverter os commits da feature. Como tudo é aditivo/opcional e sem
  migração, o rollback é só de código; o próximo recálculo volta ao placar final.
- Rollback parcial via produto: um group_admin pode **desligar** a flag a qualquer
  momento (dispara recalc que restaura o placar final no pool). O bump de
  `CACHE_VERSION` não precisa reverter (é monotônico e inócuo).

## 8. Checklist de release
- [x] Typecheck OK (`tsc --noEmit`)
- [x] Lint OK (sem novos warnings)
- [x] Suíte completa: **3556/3556** testes passando
- [x] Reviews das 4 tarefas = approved (TASK-01 e TASK-03 com pass adversarial opus)
- [ ] Merge `claude/resume-hdtif1` → `main`
- [ ] Deploy App Hosting (pipeline padrão)
- [ ] Smoke test: `/api/matches` e `/api/rankings/pool` retornam campos novos
- [ ] Pool de teste: ligar a flag → conferir ranking + badges pelo 90min; desligar → volta ao final

## Follow-ups (não bloqueiam)
- Indicador visual "placar considerado: 90min" nas telas (cosmético).
- Validar a reconstrução do 90min contra um jogo real com acréscimo longo no 2º tempo.
- (Escopo maior, se desejado) refletir o 90min também em `statistics/{uid}` /
  perfil-stats — hoje limitado ao escopo por-pool por serem agregados globais.
