# REVIEW — TASK-03: Componentes base de UI (card, badges, estados)
> Feature: Jogos (PRD-03) · Tipo: UI · Commit: d3a9601 · Branch: `feat/integracao-api-football`
> Revisor: Staff Engineer (adversarial) · Data: 2026-06-07

---

## Veredito: **APPROVED WITH ADJUSTMENTS**

- **BLOCKER:** 0
- **WARNING:** 5
- `tsc`/diagnostics: **limpo** em todos os 8 arquivos de produção (via `mcp__ide__getDiagnostics`).
- Testes: 50 novos; matches 135/135; global 862/862 (conforme reportado, consistente com cobertura lida).
- WARNING-1 (consolidação fonte única): **resolvido corretamente** — ver AC7/AC8 abaixo.

Nenhum defeito de correção, segurança ou perda de dados encontrado. As ressalvas são de
qualidade visual/acessibilidade (modo escuro) e robustez de layout — não bloqueiam a tarefa.

---

## 1. Verificação da consolidação WARNING-1 (AC7/AC8)

**Correto e sem ciclo.**

- `matchLabels.ts` faz `import { deriveGameStatusLabel } from ".../matchesHelpers"` (import de **valor**) e constrói `GAME_STATUS_LABEL` via `MATCH_STATUS_VALUES.map(...)` (linhas 11, 44-46). Fonte única estabelecida.
- `matchesHelpers.ts` **não importa** `matchLabels.ts` (nem type, nem valor) — confirmado por leitura integral. **Sem ciclo de runtime.** ✅
- `MATCH_STATUS_VALUES` usa `as const satisfies readonly MatchStatus[]` — exhaustiveness garantida em compilação. Boa defesa.
- Observação menor: o spec §5 sugeria `import type { MatchPredictionStatus }` + a doc-string em `matchLabels.ts` (linha 7) diz "matchesHelpers usa apenas `import type` de matchLabels" — frase invertida/imprecisa (matchesHelpers não importa nada de matchLabels). É só comentário, sem impacto (ver WR-05).

---

## 2. Correção, arquitetura e escopo

- **Presentacional puro:** nenhum componente faz fetch/hook de dados. ✅ (regra 1 do spec §6)
- **Sem `any`, sem `style={{}}`:** confirmado por leitura + diagnostics. ✅ (AC10)
- **3 variantes do MatchCard** presentes e fiéis às imagens PRD03-04/05/06 (validação visual feita). ✅
- **Fallback de bandeira** com iniciais (até 3 letras) quando `flagUrl` undefined. ✅ (AC2)
- **`min-h-[44px]`** no Link do card e no botão de retry. ✅ (AC11/AC12)
- **Skeletons** com `role="status"` + `aria-busy="true"` + `aria-label`. ✅ (AC5)
- **`onRetry`** disparado no clique. ✅ (AC6)
- Escopo respeitado: `hooks/` e `index.ts` da feature não tocados.

---

## 3. WARNINGs

### WR-01 — Badges sem variante dark-mode (contraste WCAG AA no modo escuro) · Priority 1
**Arquivo:** `src/features/matches/lib/matchLabels.ts:25-29, 52-58`
**Issue:** O contrato visual (`ai/screen/jogos-task-03.md` §3.2-3.4 e §4.1) especifica
explicitamente variantes dark — ex.: `bg-green-500/20 text-green-700 dark:text-green-400`,
`dark:text-amber-400`. A implementação omite **todas** as variantes `dark:`. Com fundo
translúcido `/20` sobre `--card` quase-preto no modo escuro (MASTER.md §2.2), os tokens
`text-green-700`/`text-amber-700`/`text-blue-700`/`text-gray-600` ficam escuros sobre fundo
escuro → contraste abaixo de 4.5:1. MASTER.md §1 declara "Dark mode nativo — suporte completo".
É desvio do contrato + risco AA real no dark.
**Classificação:** WARNING (não BLOCKER) — o modo padrão é light (MASTER.md §1), onde o
contraste passa AA; degrada apenas o dark mode, não quebra a tarefa no estado default.
**Fix:** Adicionar as variantes dark já definidas no screen:
```ts
enviado: "bg-green-500/20 text-green-700 dark:text-green-400",
pendente: "bg-amber-500/20 text-amber-700 dark:text-amber-400",
bloqueado: "bg-gray-500/20 text-gray-600 dark:text-gray-300",
// GAME_STATUS_COLOR análogo: blue-700→dark:blue-400, green, gray
```

### WR-02 — `<img>` sem dimensões intrínsecas (CLS) · Priority 3
**Arquivo:** `src/features/matches/components/MatchCard.tsx:53-59`
**Issue:** `<img>` cru sem atributos `width`/`height`. As classes `w-10 h-7` fixam o box via
CSS (mitiga parcialmente o CLS), mas sem dimensões intrínsecas o navegador ainda pode reflowar
antes do CSS aplicar, e não há `loading="lazy"`. O spec §3.5 autoriza `<img>` (não exige
`next/image`), então não é violação de contrato — apenas robustez de layout/perf.
**Fix:** Adicionar `width={40} height={28} loading="lazy"` ao `<img>`.

### WR-03 — Cores de status são palette cruas, fora dos tokens semânticos · Priority 4
**Arquivo:** `src/features/matches/lib/matchLabels.ts:25-29, 52-58`
**Issue:** `green/amber/blue/gray-500` são cores cruas do Tailwind, não tokens semânticos.
MASTER.md §14/§15 proíbe hex literais mas não cobre cores semânticas de esporte — e o próprio
MASTER.md §2.4 prevê tokens `--color-win/--color-loss/--color-draw` "a adicionar quando
necessário". O screen doc autorizou explicitamente estas utilities, então é decisão de
contrato aceitável; registrado como débito para futura tokenização (rankings/estatísticas).
**Fix (débito):** Quando §2.4 do MASTER for implementado, migrar para tokens semânticos.

### WR-04 — `userPrediction` undefined vs null não diferencia "encerrado sem palpite" · Priority 8
**Arquivo:** `src/features/matches/components/MatchCard.tsx:213`
**Issue:** A condição `userPrediction != null` trata `undefined` e `null` igualmente como
"sem palpite" → renderiza "PALPITE BLOQUEADO". Coerente com o spec, mas o JSDoc da prop
(linha 41) diz "null/undefined → sem palpite", enquanto o card encerrado sempre assume bloqueio
mesmo quando o palpite poderia simplesmente não ter sido carregado ainda. Em jogo encerrado isso
é semanticamente correto (palpites são definitivos), então é só clareza. Sem ação obrigatória.
**Fix:** Nenhum funcional; opcionalmente documentar que em `finished` ausência ⇒ não palpitou.

### WR-05 — Doc-string imprecisa em matchLabels.ts · Priority (maintainability)
**Arquivo:** `src/features/matches/lib/matchLabels.ts:7`
**Issue:** Comentário "matchesHelpers.ts usa apenas `import type` de matchLabels" está
invertido — `matchesHelpers` não importa **nada** de `matchLabels`. Risco de confundir quem
mantiver a regra anti-ciclo no futuro.
**Fix:** Reescrever para: "matchesHelpers.ts não importa matchLabels.ts — direção única
matchLabels → matchesHelpers evita o ciclo."

---

## 4. Qualidade de testes

Cobertura sólida e significativa (50 testes):
- MatchCard: 17 testes cobrindo as 3 variantes, fallback de bandeira, venue null, href,
  min-h, aria-label. Bom uso de fixtures realistas.
- Badges: rótulo + classe de cor + className passthrough.
- Skeleton: contagem por `count`, role/aria.
- EmptyState/ErrorState: defaults, custom, onRetry, min-h.

Lacunas menores (não bloqueantes):
- Nenhum teste afirma a presença das variantes `dark:` (consequência de WR-01 — o teste verde
  mascara a ausência do contrato dark). Ao corrigir WR-01, adicionar asserção `toMatch(/dark:/)`.
- T9 do MatchCard verifica ausência de placar via `queryByText("x")`, frágil se algum nome de
  time contiver "x" isolado — aceitável dado o domínio.

---

## UI/UX Review

### Violações por prioridade
| Priority | Área | Violações |
|---|---|---|
| 1 — Acessibilidade | Contraste dark-mode dos badges (WR-01) | 1 |
| 2 — Touch & Interação | — (min-h-44 ok, press feedback via hover/focus) | 0 |
| 3 — Performance | `<img>` sem dimensões/lazy (WR-02) | 1 |
| 4 — Estilo | Palette cruas vs tokens (WR-03) | 1 |
| 5 — Layout/Responsivo | — (mobile-first, max-w truncate ok) | 0 |
| 6 — Tipografia/Cor | — (escala MASTER respeitada) | 0 |
| 7 — Animação | — (`motion-reduce:animate-none` presente) | 0 |
| 8 — Forms/Feedback | userPrediction null/undefined (WR-04) | 1 |
| 9 — Navegação | — (Link wrapping, focus-visible ring ok) | 0 |
| 10 — Charts | n/a | 0 |

- **BLOCKER count (UI):** 0 (WR-01 rebaixado: light é o default e passa AA; degrada só dark)
- **WARNING count (UI):** 4 (WR-01..WR-04) + 1 manutenção (WR-05)

### Pillar Scores
| Pillar | Score | Key Finding |
|---|---|---|
| 1. Copywriting | 4/4 | Rótulos pt-BR corretos; empty/error states com cópia clara e CTA |
| 2. Visuals | 4/4 | Hierarquia fiel às imagens; ícones com `aria-hidden`; fallback de bandeira |
| 3. Color | 2/4 | Variantes dark omitidas (WR-01); palette cruas (WR-03) |
| 4. Typography | 4/4 | Escala MASTER respeitada (text-2xl/3xl scores, text-xs metadados) |
| 5. Spacing | 4/4 | `p-4`, `gap`, `pt-3/mt-3` aderentes à escala 4px |
| 6. Experience Design | 4/4 | Loading/empty/error/skeleton + reduced-motion + focus ring |

**Overall: 22/24**

### Top 3 priority fixes
1. **WR-01 (Priority 1):** Adicionar variantes `dark:` aos mapas de cor em `matchLabels.ts`
   (contrato do screen já as define) — restaura WCAG AA no modo escuro nativo.
2. **WR-02 (Priority 3):** Declarar `width/height` + `loading="lazy"` no `<img>` da bandeira
   para eliminar CLS e habilitar lazy-load.
3. **WR-05 (manutenção):** Corrigir a doc-string invertida sobre a direção de import
   anti-ciclo em `matchLabels.ts:7`.

### Critical Violations (Priority 1-2)
- WR-01 — contraste dark-mode dos badges (rebaixado a WARNING; light default passa AA).

### Recommendations (Priority 3-10)
- WR-02, WR-03, WR-04 conforme detalhado acima.

---

## 5. Critérios de aceite — conferência

| AC | Status | Nota |
|---|---|---|
| AC1 (3 variantes sem erro TS) | ✅ | diagnostics limpo |
| AC2 (fallback iniciais) | ✅ | TeamFlag |
| AC3 (MatchStatusBadge usa labels/color) | ✅ | |
| AC4 (GameStatusBadge usa labels/color) | ✅ | |
| AC5 (skeleton role/aria-busy) | ✅ | |
| AC6 (onRetry) | ✅ | |
| AC7 (GAME_STATUS_LABEL derivado) | ✅ | sem duplicação |
| AC8 (TASK-01 tests verdes) | ✅ | reportado 862/862 |
| AC9 (tsc limpo) | ✅ | |
| AC10 (sem any/style inline) | ✅ | |
| AC11 (navegável por teclado) | ✅ | Link + focus-visible ring |
| AC12 (min-h-44) | ✅ | card + retry |

Desvio de contrato encontrado fora dos ACs: variantes `dark:` do screen doc não implementadas (WR-01).

---

_Reviewed: 2026-06-07 · Reviewer: Claude (skill /review, adversarial) · Depth: standard+UI_
