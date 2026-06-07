# REVIEW (adversarial) — FIX · isoDateTime aceita offset numérico (kickoffAt)

> Commit: `95a2444` · Sem spec (avaliado contra o problema descrito no commit e no DRIFT da spec TASK-04 §8)
> Reviewer: Staff Engineer (skill /review) · Stance: FORCE · Read-only

## Verdict: **approved with adjustments** (0 BLOCKER · 1 WARNING)

`tsc --noEmit` exit 0. O fix resolve o drift real descrito na TASK-04 §8: `MOCK_FIXTURES`/dados reais da API-Football trazem `fixture.date` com offset numérico (`+00:00`), e `z.iso.datetime()` (sem `offset`) rejeitava → `/api/matches` quebraria com ZodError→500. Trocar para `z.iso.datetime({ offset: true })` é a correção mínima e correta.

## Verificação do "widening não afrouxou demais"
Testei empiricamente o predicado (Zod 4.4.3) — pergunta central do review:

| Entrada | Aceita? | Esperado |
|---|---|---|
| `2026-06-05T12:00:00Z` | sim | sim |
| `2026-06-05T12:00:00+00:00` | sim | sim (motivo do fix) |
| `2026-06-11T15:00:00-03:00` | sim | sim |
| `2026-06-05T12:00:00` (sem timezone) | **não** | **não** ← preocupação do prompt |
| `2026-06-05` (só data) | **não** | **não** |
| `2026-06-05T12:00:00.123Z` (ms) | sim | ok |
| `2026-06-05T12:00:00+0000` (offset sem `:`) | **não** | (ver WR-01) |

**Conclusão:** o widening NÃO afrouxou demais. `{ offset: true }` continua exigindo timezone — data sem timezone e data-only seguem rejeitadas. A invariante "kickoffAt sempre tem fuso" é preservada. O risco levantado no prompt (aceitar data sem timezone) NÃO ocorre. Teste de regressão adicionado (`shared.test.ts:+92`) cobre `+00:00`, `-03:00` e o negativo `"não-é-data"`.

## Achados

### WR-01 (WARNING) — Offset sem dois-pontos (`+0000`) é rejeitado; e ampliação cria dívida de ordenação a jusante
**Arquivo:** `src/schemas/shared.ts:44`
**Issue:** dois pontos:
1. `z.iso.datetime({ offset: true })` aceita `+00:00` mas **rejeita** `+0000` (forma compacta ISO 8601 válida). A API-Football padrão usa `+00:00`, então não quebra hoje, mas se algum provider/fixture usar a forma compacta o parse falha (500). Não é blocker (formato real é `+00:00`), mas vale registrar o limite.
2. Consequência mais relevante: ao permitir offsets numéricos variáveis SEM normalizar para `Z`, o fix abre espaço para `kickoffAt` com offsets heterogêneos. A camada de serviço (TASK-05 `matches.ts:127/143`) ordena `kickoffAt` por `localeCompare`, que só é cronologicamente correto sob offset uniforme. Hoje a API entrega tudo em `+00:00` (verifiquei o mock), então é latente — mas o fix amplia a superfície sem fechar a ordenação.
**Fix (recomendado):** normalizar a data para UTC `Z` no `matchMapper` antes do `matchSchema.parse` (ex.: `new Date(raw.fixture.date).toISOString()`). Isso (a) mantém o schema podendo aceitar offset na entrada como rede de segurança, e (b) garante `kickoffAt` canônico em `Z`, tornando a ordenação lexicográfica da TASK-05 correta por construção. Alternativa: corrigir a ordenação na TASK-05 para comparar instantes (`Date.getTime`). Qualquer uma fecha o buraco; normalizar no mapper é a mais robusta.

## Escopo
Fix cirúrgico e bem escopado (2 arquivos, schema + teste). Não tocou nada além do necessário. A mensagem de commit referencia corretamente a origem do achado (TASK-04). Bom.

## Risco
Baixo. O fix em si é seguro e correto. O WARNING é sobre a dívida de ordenação que a ampliação torna possível — encadeada com WR-01 da review da TASK-05; recomendo resolver as duas com a normalização no mapper.

---
_Reviewer: Claude (skill /review) — adversarial · read-only_
