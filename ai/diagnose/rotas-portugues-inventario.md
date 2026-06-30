# Inventário — Português em rotas e código

> Modo: **inventário apenas** (nenhuma alteração feita). Levantamento para decisão futura.
> Bug reportado: `http://localhost:3000/predictions/knockout/dezesseis-avos` está em português.

## TL;DR

O português nas **rotas** não é um bug isolado de URL. Os slugs (`grupos`,
`dezesseis-avos`, `oitavas`, `quartas`, `semifinal`, `terceiro`, `final`,
`eliminatorias`) são o **modelo de domínio canônico** (`Stage` / `rankingScope`),
definido em `src/schemas/shared.ts`. Eles vazam para 3 URLs e estão **gravados no
Firestore** (`match.stage`, IDs de documentos de ranking). Trocar para inglês =
**migração com quebra de dados**, não fix mínimo.

Quase todas as outras rotas já estão em inglês (`/admin`, `/profile`, `/rankings`,
`/groups`, `/notifications`, `/matches`, `/predictions`, `/login`, `/signup`...).
Rótulos pt-BR na UI são **intencionais** (app brasileiro) — não entram aqui.

---

## A. Rotas com português (URLs visíveis ao usuário)

| URL | Origem | Tipo |
|---|---|---|
| `/matches/grupos` | `src/app/(app)/matches/grupos/page.tsx` | pasta estática |
| `/matches/eliminatorias` | `src/app/(app)/matches/eliminatorias/page.tsx` | pasta estática |
| `/predictions/knockout/dezesseis-avos` | `[stage]/page.tsx` (valor do param) | param dinâmico |
| `/predictions/knockout/oitavas` | idem | param dinâmico |
| `/predictions/knockout/quartas` | idem | param dinâmico |
| `/predictions/knockout/semifinal` | idem | param dinâmico |
| `/predictions/knockout/terceiro` | idem | param dinâmico |
| `/predictions/knockout/final` | idem | param dinâmico |

> ⚠️ **Inconsistência já existente:** `/predictions/groups` (inglês) para a fase
> `grupos`, mas `/predictions/knockout/<pt>` para o mata-mata. O nível de pasta de
> predictions já foi parcialmente migrado para inglês; os valores de `[stage]`
> ficaram em pt porque são iguais ao enum `Stage`.

> Também em pt no nível de rota de API: `scope` em
> `src/app/api/rankings/[scope]/` e `src/app/api/rankings/pool/[scope]/`
> (valores `grupos|oitavas|...|eliminatorias`).

---

## B. Fonte dos slugs (modelo de domínio)

- `src/schemas/shared.ts:43` — `stageSchema`:
  `grupos, dezesseis-avos, oitavas, quartas, semifinal, terceiro, final`
- `src/schemas/shared.ts:59` — `rankingScopeSchema`: acima + `eliminatorias`
- `src/schemas/shared.ts:4` — comentário **enganoso**: diz *"Valores em slug inglês
  minúsculo"*, mas os valores estão em português. (Menor correção isolada possível,
  se nada mais mudar.)

---

## C. Código que produz/consome os slugs (identificadores, não rótulos)

| Área | Arquivo | Papel |
|---|---|---|
| Mappers de API | `src/server/copaData/mapper.ts`, `espnMapper.ts` | **gravam** o slug pt em `match.stage` |
| Rankings | `src/server/rankings/recalc.ts` | `ELIMINATION_STAGES`, `RANKING_STAGE_SCOPES`, doc `eliminatorias` |
| Bracket | `src/server/worldcup/bracket.ts:46` | mapa slug pt → `roundOf32/roundOf16/...` |
| Config de rota | `src/app/(app)/predictions/knockout/[stage]/page.tsx:59-112` | `KnockoutSlug`, `KNOCKOUT_CONFIG`, `STAGE_LABEL` |
| Hrefs fixos | `src/app/(app)/predictions/page.tsx:45-50`, `best-thirds/page.tsx:35` | links para `/knockout/<pt>` |
| Tabs | `src/features/worldcup/components/CompetitionTabs.tsx:24-25` | href `/matches/grupos`, `/matches/eliminatorias` |
| Labels de fase | `src/features/matches/lib/stageLabels.ts` | `Record<Stage,string>` keyed por slug pt |

---

## D. Persistência (dados gravados — núcleo do risco de migração)

- `match.stage` no Firestore = slug pt (escrito pelos mappers).
- IDs de documentos de ranking: `rankings/eliminatorias`,
  `pool-{poolId}-eliminatorias`, scopes por fase (`grupos`, `oitavas`...).
- Escopo de predictions/statistics derivado dos mesmos slugs.

Renomear slugs pt→en sem migração deixaria os dados existentes órfãos e quebraria
os agregados de ranking por doc ID.

---

## E. NÃO é bug (intencional — fora de escopo)

- **Rótulos pt-BR na UI** (`stageLabels.ts`, títulos como "Oitavas de Final",
  "16 avos de final") — app brasileiro; correto exibir em português.
- A maior parte dos ~200 arquivos do grep inicial são rótulos, comentários, testes
  e PRDs em pt — não são identificadores de rota nem chaves de storage.

---

## Opções de remediação (para decisão futura)

| Opção | Escopo | Risco | Toca Firestore? |
|---|---|---|---|
| 1. Aliases de URL en→pt | só roteamento (ex.: `/knockout/round-of-32` → slug pt interno) | baixo | não |
| 2. Renomear enum + migrar dados | `stageSchema` pt→en + backfill `match.stage` + doc IDs de ranking + ~ dezenas de sites | **alto** | sim (migração com quebra) |
| 3. Fechar como não-bug | corrigir só o comentário enganoso em `shared.ts:4` | mínimo | não |

> Recomendação de processo: Opção 2 **não** cabe em `/flow-bugfix`. Use
> `/flow-migration` (assess → migrate → validate) com estratégia de
> dupla-compatibilidade (aceitar slug antigo + novo, ou backfill).
