# SPEC

## 1. Task id and title
- Task: TASK-07
- Title: Foto real nos demais avatares de ranking

## 2. Objective
Estender a foto real (`avatarUrl`, propagado na TASK-05 até `RankingEntry`)
aos avatares de ranking fora do pódio, que hoje só mostram iniciais. Usar
`AvatarImage src={entry.avatarUrl}` com `AvatarFallback` de iniciais como
degradação nativa (base-ui) quando `src` ausente/quebrado. D4 ("foto na lista
inteira").

## 3. In scope
Trocar `Avatar` só-iniciais por `AvatarImage` + `AvatarFallback` nas três
superfícies que recebem `RankingEntry` com `avatarUrl`:

1. `GeneralRanking.tsx` → `RankingRow` (linha da lista #4+): adicionar
   `<AvatarImage src={entry.avatarUrl} alt="" />` antes do `AvatarFallback`.
2. `PhaseRanking.tsx` → `RankingRow` local (aba "Por Grupo"): importar
   `AvatarImage` e adicionar `<AvatarImage src={entry.avatarUrl} alt="" />`.
3. `ParticipantProfile.tsx` → `ProfileIdentity` (avatar do header de perfil):
   importar `AvatarImage` e adicionar `<AvatarImage src={entry.avatarUrl} alt="" />`
   no `Avatar` existente (mantendo `role="img" aria-label={displayName}`).

## 4. Out of scope
- `MyRanking.tsx`: **não tem avatar** (hero com posição + cards de métrica). Sem
  mudança — registrar explicitamente que não há superfície de avatar aqui.
- `PhaseRanking` aba "Por Fase" (`StageRankingCard`): mostra só ícone de fase +
  métricas, sem avatar de participante. Sem mudança.
- Pódio (`RankingPodium`) — já tratado na TASK-06.
- `src/components/ui/avatar.tsx` — **não editar** (só consumo).
- Schema, recalc, `toEntry`, propagação de `avatarUrl` — fechados na TASK-05.
- Nenhuma mudança de layout/tamanho/cor dos avatares; apenas a fonte da imagem.

## 5. Main technical areas involved
- `src/features/rankings/components/GeneralRanking.tsx` (RankingRow)
- `src/features/rankings/components/PhaseRanking.tsx` (RankingRow local + import)
- `src/features/rankings/components/ParticipantProfile.tsx` (ProfileIdentity + import)
- Testes de componente correspondentes em `__tests__/`.

## 6. Business rules and behavior
- `avatarUrl` é opcional na entry (pode vir `undefined` por ausência de foto ou
  corte de orçamento na TASK-05). `AvatarImage src={undefined}` → base-ui
  mantém o estado de fallback → iniciais. Comportamento atual preservado quando
  não há foto.
- Foto quebrada (`src` inválido) → base-ui cai no fallback nativo (`onError`).
- Iniciais continuam derivadas de `name ?? nickname` (helpers `initials`
  existentes em cada arquivo — não unificar; fora de escopo).
- `alt=""` no `AvatarImage`: o card/linha já expõe nome via texto visível
  (GeneralRanking/PhaseRanking) ou via `aria-label` no `Avatar`
  (ParticipantProfile) → evitar redundância de leitura por SR.

## 7. Contracts and interfaces
- Consome `RankingEntry.avatarUrl?: string` (já no schema desde TASK-05). Sem
  novo contrato, endpoint ou tipo.
- `AvatarImage` / `AvatarFallback` de `@/components/ui/avatar` (base-ui),
  mesmos componentes usados no pódio.

## 8. Data and persistence impact
Nenhum. Task puramente de apresentação; não toca persistência, recalc nem API.

## 9. Required tests
Sem TDD (apresentação). Testes de componente leves (após implementação):
- `PhaseRanking` aba "Por Grupo": linha aceita entry com `avatarUrl` sem
  quebrar; fallback de iniciais quando sem foto.
- `ParticipantProfile`: aceita `entry.avatarUrl` sem quebrar; iniciais como
  fallback; `aria-label` do avatar preservado.
- `GeneralRanking` RankingRow (lista #4+): aceita `avatarUrl` sem quebrar;
  fallback de iniciais.
- Nota jsdom: o `<img>` do base-ui só monta no evento `load` do browser; jsdom
  não dispara → testar lógica testável (fallback/aria/render), não o `<img>`.
  Render real da foto coberta no `/ui-review`.

## 10. Acceptance criteria
- [ ] As três superfícies renderizam `AvatarImage src={entry.avatarUrl}` +
  `AvatarFallback` de iniciais.
- [ ] Sem foto/`avatarUrl` undefined → iniciais (comportamento atual intacto).
- [ ] `MyRanking` e a aba "Por Fase" permanecem sem alteração (sem avatar).
- [ ] `components/ui/avatar.tsx` não editado.
- [ ] `vitest run` verde; `tsc` sem novos erros em `src/`; sem nova dependência.

## 11. Constraints
- Mudança mínima: só a fonte da imagem do avatar, sem refator de layout.
- Preservar a11y existente (aria-labels, ordem de leitura).
- Não unificar os helpers `initials` duplicados (fora de escopo desta task).
- Mobile-first; sem alterar tamanhos/tokens.

## 12. Execution cost profile
- tdd: n/a (apresentação)
- implement: sonnet/high
- test: sonnet/medium
- review: sonnet/high

## 13. Frontend indicator
- is_frontend: true
- reason: altera componentes de UI (RankingRow, ProfileIdentity) — render de
  avatar com foto real.

## 14. Open questions
Nenhuma. `MyRanking` confirmado sem avatar (escopo da PRD citava o arquivo, mas
inspeção mostra que a tela não tem superfície de avatar — registrado em §4).
