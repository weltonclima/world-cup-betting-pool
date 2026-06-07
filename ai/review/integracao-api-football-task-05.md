# REVIEW (adversarial) — TASK-05 · Serviços client consumindo /api

> Commit: `bff2449` · Spec: `ai/spec/integracao-api-football-task-05.md`
> Reviewer: Staff Engineer (skill /review) · Stance: FORCE · Read-only

## Verdict: **approved with adjustments** (0 BLOCKER · 2 WARNING)

`tsc --noEmit` exit 0. Suíte `src/services` verde. Reescrita de `matches.ts`/`teams.ts` para `fetch('/api/*')` + validação Zod conforme spec. O ponto crítico da spec (split-parse preservando o `.refine` do `matchSchema`) está implementado corretamente. Achados são robustez de ordenação e tratamento de corpo.

## Escopo / Arquitetura
- Assinaturas mantidas (`listMatches`, `getMatchById`, `getNextScheduledMatch`, `getRecentFinishedMatches`, `listAllTeams`) — Home não muda (§2). `predictions/users/rankings` intocados. **OK**.
- Base relativa `"/api"`; limitação server-side documentada (§6). **OK** (consumidores são `"use client"`).

## Correção

### Split-parse (preserva refine) — VERIFICADO CORRETO
- `parseMatchWithId` (`matches.ts:49-55`): valida `id` com `idSchema.parse(input)` (garante objeto antes do spread), separa `id`, valida o restante com `matchSchema.parse(rest)`. O `matchSchema` (com `.refine` placar×status, `matches.ts` schema:37) roda intacto. Confirmei o motivo declarado na spec §4: interseção/`.and()` em Zod 4 não reaplica o refine do lado esquerdo — a abordagem em duas etapas evita o buraco (uma partida `finished` com placares `null` é corretamente rejeitada). **Correto e bem justificado.**
- `parseTeamWithId` (`teams.ts:39-44`): mesma técnica, consistente.

### 404 → null — VERIFICADO
- `getMatchById` (`matches.ts:108`): `if (res.status === 404) return null;` **antes** de checar `!res.ok`. Correto (§5).

### Derivação next/recent — VERIFICADO (com ressalva WR-01)
- `getNextScheduledMatch`: filtra `scheduled`, ordena `kickoffAt` asc, `[0] ?? null`. `getRecentFinishedMatches`: filtra `finished`, ordena desc, `slice(0,5)`. Lógica bate com §3.

## Achados

### WR-01 (WARNING) — Ordenação por `localeCompare` só é cronológica sob offset uniforme
**Arquivo:** `src/services/matches.ts:127` e `:143` (e docstring §3 da spec)
**Issue:** a spec e os comentários afirmam que `kickoffAt.localeCompare` ordena cronologicamente "porque é ISO 8601 UTC". Isso só vale se TODOS os timestamps tiverem o MESMO offset. O schema foi ampliado (FIX kickoffAt) para aceitar offsets numéricos (`+00:00`, `-03:00`), e o `matchMapper` repassa `raw.fixture.date` sem normalizar para `Z`. Hoje a API-Football retorna tudo em `+00:00` (verifiquei o mock — todas `+00:00`), então funciona. Mas é uma fragilidade latente: se algum fixture vier com offset diferente, a ordenação lexicográfica fica errada (`...T12:00:00+00:00` ordenaria depois de `...T10:00:00-03:00`, que é na verdade 13:00 UTC — mais tarde). "Próximo jogo" e "últimos resultados" da Home poderiam exibir a ordem errada.
**Fix:** ordenar por instante real, não por string: `new Date(a.kickoffAt).getTime() - new Date(b.kickoffAt).getTime()` (ou normalizar `kickoffAt` para UTC `Z` no `matchMapper` antes do parse). Robustez contra a ampliação introduzida pelo FIX kickoffAt.

### WR-02 (WARNING) — `buildHttpError` consome o corpo da resposta sem clonar (irrelevante hoje, mas frágil) + duplicação entre serviços
**Arquivo:** `src/services/matches.ts:61-81` e `src/services/teams.ts:49-69`
**Issue:** (a) `buildHttpError` é copiado byte-a-byte nos dois arquivos — duplicação que deveria viver em um helper compartilhado (`src/services/_lib` ou `src/lib`). (b) Lê `res.json()` dentro de try/catch para extrair `{ error }`; ok para o uso atual (a resposta não é reaproveitada depois), mas a captura silenciosa engole qualquer erro inclusive de parse legítimo — só status sobra. Aceitável, mas a duplicação é o ponto principal.
**Fix:** extrair `buildHttpError` (e `idSchema`) para um módulo compartilhado de serviços; reduz drift entre matches e teams.

## Testes
- Cobertura forte (§7): `listMatches` sucesso/vazio/erro-HTTP/erro-sem-corpo/status inválido (ZodError)/sem id (ZodError); `getMatchById` sucesso/404→null/erro/contrato; next/recent filtro+ordem+propagação; `listAllTeams` análogo. `fetch` global mockado. Bom.
- **Gap:** nenhum teste exercita ordenação com offsets mistos (WR-01) — coerente com o fato de o bug ser latente. Recomendo adicionar um caso com offsets diferentes se WR-01 for endereçado.

## Risco
Baixo hoje (API uniformemente UTC). WR-01 vira correção real assim que dados com offset variável aparecerem — endereçar junto com a normalização de data sugerida no FIX kickoffAt.

---
_Reviewer: Claude (skill /review) — adversarial · read-only_
