# UI-SPEC

## 1. Screen/Component Identity
- Name: `RankingRow` (em `GeneralRanking.tsx` e `PhaseRanking.tsx`) +
  `ProfileIdentity` (em `ParticipantProfile.tsx`)
- Type: Component (avatares de ranking fora do pódio)
- Tech: Next.js 15.5 (App Router) + React 19 + Tailwind v4 + `@base-ui/react` (Avatar)
- Complexity: Minimal (troca da fonte da imagem do avatar; sem mudança de layout)

> Reusa as decisões de avatar já fixadas no ui-spec do pódio
> (`ranking-pontuacao-ponderada-task-06.md`): mesmo `Avatar`/`AvatarImage`/
> `AvatarFallback` base-ui, mesmo fallback de iniciais, mesma estratégia
> `alt=""` + identidade exposta por texto/aria. ui-ux-pro-max **não** reinvocado.

## 2. Visual Structure (ASCII)

Linha da lista (GeneralRanking #4+ e PhaseRanking "Por Grupo") — inalterada,
só o avatar passa a poder exibir foto:

```
RankingRow
┌──────────────────────────────────────────────┐
│  #4   ◯foto   Nome do Participante   12 pts 60%│
│       (ou iniciais no fallback)                │
└──────────────────────────────────────────────┘
```

Header de perfil (ParticipantProfile) — avatar maior (h-20 w-20), inalterado
exceto a foto:

```
ProfileIdentity
┌──────────────────────────┐
│         ◯ foto           │  ← AvatarImage src=entry.avatarUrl
│      (ou iniciais)       │
│      Nome Completo       │
│      @nickname           │
└──────────────────────────┘
```

## 3. Component Breakdown
| Component | Type | Props | States | Notes |
|-----------|------|-------|--------|-------|
| `Avatar` (RankingRow) | base-ui | `className` h-10 w-10 | img / fallback | tamanho inalterado |
| `AvatarImage` | base-ui | `src=entry.avatarUrl`, `alt=""` | img / oculto | novo; some no fallback |
| `AvatarFallback` | base-ui | `initials(entry)` | iniciais | já existente |
| `Avatar` (ProfileIdentity) | base-ui | `className` h-20 w-20, `role="img" aria-label={displayName}` | img / fallback | tamanho/aria inalterados |

## 4. Interaction States
| Element | Default | Error | Notes |
|---------|---------|-------|-------|
| AvatarImage | foto (`src` válido) | `onError` → `AvatarFallback` (nativo base-ui) | sem hover/focus próprios (a linha/card é o alvo) |
| AvatarFallback | iniciais | — | quando `src` undefined/quebrado |

Estados de hover/active/focus permanecem nos elementos pai (Link da linha) —
inalterados por esta task.

## 5. Data Binding
| Field | Source | Transform | Update Trigger |
|-------|--------|-----------|----------------|
| foto | `entry.avatarUrl` | direto p/ `AvatarImage src` (pode ser `undefined`) | render |
| iniciais | `entry.name`/`nickname` ou `displayName` | `initials(...)` (helper existente por arquivo) | render (fallback) |

## 6. Responsive Behavior
Sem mudança. Tamanhos de avatar fixos por superfície (h-10/h-20), já responsivos
no layout pai. Foto cobre via `object-cover` (definido em `avatar.tsx`).

## 7. Accessibility Requirements
- [ ] `AvatarImage alt=""`: identidade já lida por texto visível (RankingRow) ou
      `aria-label` no `Avatar` (ProfileIdentity) → evita redundância p/ SR.
- [ ] Foto quebrada não deixa "imagem sem alt" exposta: base-ui troca para
      fallback de iniciais.
- [ ] Contraste e alvo de toque: inalterados (sem mudança de layout/cor).

## 8. Edge Cases
| Case | Condition | Behavior |
|------|-----------|----------|
| Sem foto | `avatarUrl` undefined (ausente ou cortado pelo orçamento TASK-05) | iniciais; layout intacto |
| Foto quebrada | `src` inválido | fallback nativo (`onError`) |
| MyRanking | tela sem avatar | nenhuma mudança |
| Aba "Por Fase" | card de fase sem avatar | nenhuma mudança |

## 9. Tech-Specific Implementation Notes (Next.js — house rules)
- `"use client"` mantido (componentes já client).
- Avatar via `@base-ui/react` já exportado em `src/components/ui/avatar.tsx` —
  **não** editar o componente base; só consumir `AvatarImage`.
- Importar `AvatarImage` onde faltar (`PhaseRanking.tsx`, `ParticipantProfile.tsx`);
  `GeneralRanking.tsx` já importa.
- Sem nova dependência, sem novo token de tema.

## 10. Files to Create/Modify
```
src/features/rankings/components/
├── GeneralRanking.tsx        (MOD: AvatarImage no RankingRow)
├── PhaseRanking.tsx          (MOD: import + AvatarImage no RankingRow local)
├── ParticipantProfile.tsx    (MOD: import + AvatarImage no ProfileIdentity)
└── __tests__/                (MOD: render aceita avatarUrl; fallback de iniciais)
```
- Sem editar `components/ui/avatar.tsx`.

## 11. Acceptance Criteria (UI)
- [ ] Foto real renderiza quando `avatarUrl` presente nas 3 superfícies;
      iniciais como fallback.
- [ ] Layout/tamanho/cor dos avatares inalterados.
- [ ] `MyRanking` e aba "Por Fase" sem alteração.
- [ ] `vitest run` verde; sem nova dependência.
