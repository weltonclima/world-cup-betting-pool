# REVIEW — TASK-02 · Mappers em `src/server` + correção de schema drift

> Commit: `b750e35` · Spec: `ai/spec/integracao-api-football-task-02.md` · Plano: `ai/plan/integracao-api-football.md` (TASK-02)
> Revisão adversarial (stance FORCE) · READ-ONLY · Idioma: pt-BR

## 1. Objetivo da revisão

Confirmar que `matchMapper`/`teamMapper` foram movidos para `src/server/mappers` usando `@/schemas` como fonte única, e que o drift foi corrigido: `terceiro` (`3rd Place Final`), `venue`, `round` numérico, `groupId`. Validar correção de negócio (status/stage/venue/round/placar×status), contratos `.strict()` e qualidade dos testes.

## 2. Evidências coletadas

- `matchMapper.ts` importa de `@/schemas` (não de `functions/shared`). `ROUND_TO_STAGE_MAP` inclui `"3rd Place Final" → "terceiro"` e `"Semi-finals" → "semifinal"`. `stageSchema` (shared.ts) inclui `"terceiro"`.
- `venue`: `mapVenue` só monta `{name,city}` quando ambos são strings não-vazias (após `trim`); senão `null`. Casa com `venueSchema.strict()` (rejeita `""`). Type `ApiVenue` permite `name`/`city` null (TBD).
- `round`: `mapRoundNumber` só extrai número quando `stage === "grupos"`; mata-mata → null (evita falso-positivo de `"Round of 16"`). Usa último `\d+`.
- `groupId`: derivado de `teamGroupMap[homeApiId]` apenas em grupos; default `{}` → degrada para null. Correto vs A1.
- placar×status: scores só quando `finished`; senão null. Validado por `matchSchema.refine`.
- `STATUS_MAP`: cobre NS/TBD/1H/HT/2H/ET/P/BT/LIVE/FT/AET/PEN/AWD/WO/PST/CANC/SUSP/INT/ABD; desconhecido → `console.warn` + `"scheduled"`.
- `teamMapper`: `flagUrl = logo || undefined` (vazio omitido; inválido → ZodError via `z.url()`); `groupId` param prevalece sobre `raw.group`.
- `npx tsc --noEmit`: exit 0. `npx vitest run src/server` (JSON): 100/100 — matchMapper (20 + mapRoundToStage 7 + status it.each 19+1) e teamMapper (7) verdes.
- Output validado por `matchSchema`/`teamSchema` em runtime (parse final no mapper). M19/M20 confirmam shape strict.

## 3. Achados

### WARNING

#### WR-01 — Score de partida `live` é sempre descartado; comportamento sem teste que o trave
**Arquivo:** `src/server/mappers/matchMapper.ts:186-188`
**Problema:** O mapper grava `homeScore`/`awayScore` apenas quando `status === "finished"`; para `live` força `null`. Porém o `matchSchema.refine` (`src/schemas/matches.ts:47-51`) *permite* placar parcial quando `live`. Resultado: placar de jogo em andamento (UX "ao vivo") nunca chega ao front via este mapper, e nenhum teste documenta/trava essa decisão (M18 só verifica live-com-gols-null; não há caso de live-com-gols-preenchidos provando que o descarte é intencional). Risco: quando a UX de "ao vivo" (PRD-03) precisar do placar parcial, a fonte estará silenciosamente zerada e o motivo não está coberto por teste — fácil de regredir/confundir numa mudança futura.
**Fix:** Decidir explicitamente: (a) se o produto não quer placar ao vivo, manter o descarte mas adicionar teste `live` com `goals {1,0}` asserindo `homeScore === null` + comentário apontando a regra de negócio; ou (b) propagar placar quando `live` (`status === "finished" || status === "live"`) e cobrir com teste. Hoje o comportamento e o schema divergem sem trava.

### Notas (informativas)

- **N-01 (doc/spec drift):** Spec §3.5/§2 menciona estender `FixtureInfo.status.long?` opcional; o `types.ts` real só tem `status: { short: string }`. Campo não é usado por ninguém → sem bug, apenas a spec descreve algo não implementado. Alinhar a spec.
- **N-02 (escopo, OK):** `MOCK_TEAM_GROUP_MAP` foi adicionado em `mock.ts` (não pedido explicitamente, mas útil e coerente com A1; exportado e ainda não consumido — alvo de T04). Não re-exportado no barrel. Aceitável.
- **N-03 (segurança — OK):** Mappers são funções puras, sem I/O, sem segredos, sem `any`. Toda entrada externa passa por `matchSchema`/`teamSchema.parse` antes de sair — validação de input adequada. `mapRoundToStage` lança erro informativo (não silencia dado desconhecido), o que é o comportamento seguro.
- **N-04 (robustez — aceitável):** `mapRoundToStage` faz match por prefixo iterando `Object.entries`. Não há colisão de prefixo entre as chaves atuais (`"Final"` não é prefixo de outra chave usada; exact-match é tentado antes). Se a API introduzir rounds novos (ex.: playoff intercontinental 2026), o mapper lança — falha visível, não silenciosa. Correto.

## 4. Verdict

**approved with adjustments**

1 WARNING (WR-01: divergência mapper×schema no placar `live`, sem teste que documente a decisão). Mapeamento de stage/status/venue/round/groupId/terceiro está correto e bem coberto; contratos `.strict()` validados em runtime; tsc limpo; 100/100 testes. Ajuste recomendado antes de a UX "ao vivo" depender desta fonte (PRD-03).
