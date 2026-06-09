# SPEC

## 1. Task: TASK-12 – Tela 05: Perfil do Participante

## 2. Objective

Exibir as estatísticas de **outro participante** (não o usuário logado), acessível por `/rankings/perfil/[uid]` a partir de qualquer linha do ranking (TASK-08/09): header com avatar + nome + "Participante desde", card "Posição Atual #N de M", grid Pontos/Acertos/Erros/Aproveitamento e bloco "Desempenho por Fase". Tela **somente-leitura** sobre dados já recalculados (`rankings` + `statistics`). O botão "Ver histórico de palpites" depende do **BLOQUEADOR A5** (visibilidade de palpites alheios) — ver §6 e §13.

## 3. In scope

1. Componente client `ParticipantProfile` (`src/features/rankings/components/`) montado em `src/app/(app)/rankings/perfil/[uid]/page.tsx` (substituir o stub "em construção").
2. `uid` lido do parâmetro de rota (`useParams()` no client; ou prop vinda do Server Component fino que lê `params`).
3. **Header de identidade:** avatar grande (Shadcn `Avatar` + fallback de iniciais), Nome (`entry.name` → fallback `nickname`), linha "Participante desde DD/MM/AAAA" (ver OQ origem de `createdAt` — §13).
4. **Card "Posição Atual":** `#N` + "de M participantes" (N = `entry.position`, M = `total`).
5. **Grid 2x2 de métricas:** Pontos (`entry.points`), Acertos (= `points`, binário), Erros (`entry.wrong` / `statistics.totalWrong`), Aproveitamento (`entry.accuracy`% + linha "X de Y jogos").
6. **Bloco "Desempenho por Fase":** cards por fase (Fase de Grupos / Oitavas / Quartas / Semi / Final) com acertos por fase (`statistics.correctByStage`); ver §6 sobre posição/pts por fase.
7. **Botão "Ver histórico de palpites":** renderizado conforme decisão A5 — **oculto OU desabilitado** até A5 ser resolvido (default desta task: **oculto**; ver §6/§13). NÃO implementar a navegação/destino do histórico nesta task.
8. Estados ligados aos hooks: loading (`RankingSkeleton`), error (`RankingErrorState` + retry), e **"Participante não encontrado"** → `RankingEmptyState` (quando o uid não existe no ranking/statistics).

## 4. Out of scope

- Histórico de palpites de outro usuário (tela/lista de predictions alheias) — **bloqueado por A5**; fora desta task qualquer que seja a decisão.
- Telas 01/02/03/04/06 (TASK-08/10/09/11/13).
- Recalc/serviços/hooks (prontos em TASK-03/04/05). Shell/estados/sub-nav (TASK-07).
- Edição de perfil, foto real do usuário (avatar usa fallback de iniciais — não há `photoURL` em `rankings`/`statistics`).

## 5. Main technical areas

`src/features/rankings/components/ParticipantProfile.tsx` (+ subcomponentes internos opcionais `ProfileStatCard`, `StagePerformanceCard`), `src/app/(app)/rankings/perfil/[uid]/page.tsx`, barrel `components/index.ts`.

**Hooks/serviços (prontos):**
- `useParticipantProfile(uid)` (TASK-05) → `Statistics | null` (`{ uid, totalCorrect, totalWrong?, accuracy, longestStreak, correctByStage, positionHistory[] }`).
- Para **name / position / points / wrong / accuracy / total** o serviço pronto `getUserRanking(uid)` (`src/services/rankings.ts`) já retorna `{ entry: RankingEntry, total }` para **qualquer uid** (filtra o doc `rankings/geral` pelo uid). O hook atual `useMyRanking()` está amarrado à sessão (`useAuth`), então **não serve** para outro participante. Decisão de wiring (ver §7 e §13): usar `useRanking("geral")` e localizar a entry do uid no client, **ou** criar um hook fino `useUserRanking(uid)` que chama `getUserRanking(uid)`. Esta task documenta a composição; default proposto = `useRanking("geral")` + filtro por uid (sem novo serviço).

Reusa: Shadcn `avatar`/`badge`/`button`, Lucide (named), `date-fns` (formatação "Participante desde"), estados TASK-07, tema `.ranking-theme` (já no `layout.tsx` de `/rankings`).

## 6. Business rules and behavior

- **Binário (pontos === acertos):** "Pontos" e "Acertos" mostram **o mesmo número** (`entry.points`). A imagem (Tela 05) exibe os dois rótulos lado a lado (Pontos 82 / Acertos 11... — valores ilustrativos do mock 3/1/0, NÃO seguir). Sob binário, **Pontos e Acertos coincidem**: manter ambos os rótulos (fidelidade ao layout da imagem) exibindo o mesmo valor, OU consolidar — `/screen` decide; default = exibir ambos com o mesmo número, sem inventar métrica de "vencedor". NÃO duplicar como se fossem distintos numericamente.
- **Composição dos dados:**
  - **name / position / points / wrong / accuracy / total** ← entry do ranking geral do uid (`getUserRanking(uid)` ou `useRanking("geral")` + filtro). `name` pode ser `undefined` (doc antigo) → fallback `nickname`.
  - **correctByStage / longestStreak / totalWrong** ← `useParticipantProfile(uid)` (`statistics/{uid}`).
  - `Statistics` **não** contém `name` nem `position` (só `uid`) — daí a necessidade da composição acima. Documentado como decisão (não é bug).
- **Posição Atual:** `#${entry.position}` + "de ${total} participantes" (`total` = nº de entries do ranking geral). Alternativa: última posição de `statistics.positionHistory` (scope `geral`) — porém sem `total`; preferir a entry do ranking (tem ambos). Registrado como OQ secundária.
- **Aproveitamento "X de Y jogos":** `entry.accuracy`% como número grande; "X de Y" onde X = acertos (`points`) e Y = denominador de partidas finalizadas elegíveis (A2). Y não está em `RankingEntry` nem em `Statistics` de forma explícita → derivar de `points`/`accuracy` (Y = round(points / (accuracy/100))) é frágil; **OQ**: origem do denominador "Y jogos" (ver §13). Default: exibir "X de Y" só se Y disponível com segurança; senão exibir apenas o `%`.
- **Erros:** `entry.wrong` (preferência) ou `statistics.totalWrong`; se ambos ausentes → "—".
- **Desempenho por Fase:** a imagem mostra por fase **posição + pontos** ("Fase de Grupos #3 24 pts"). PORÉM `statistics.correctByStage` só tem **acertos por fase** (não posição nem pts-por-fase distintos). Sob binário, **pts por fase = acertos por fase** = `correctByStage[stage]`. A **posição por fase** (#3) exigiria ler `rankings/{fase}` e achar o uid (5 leituras extras) — **fora do escopo desta task** salvo decisão. Default: cards de fase exibem o nome da fase + **pts/acertos** (`correctByStage`), e a posição por fase fica como OQ (omitir "#N por fase" ou buscar via `useRanking(stage)` — `/screen` decide). Fase sem dados → "0 pts" ou "—".
- **Ordem das fases:** Fase de Grupos → Oitavas → Quartas → Semifinal → Final (subconjunto de `rankingScopeSchema` sem "geral"). `correctByStage` usa chaves de `stageSchema` (inclui `dezesseis-avos`/`terceiro`) — mapear só as 5 fases de ranking exibidas; ignorar `dezesseis-avos`/`terceiro` na UI (alinhado a `rankingScopeSchema`).
- **Botão "Ver histórico de palpites" (BLOQUEADOR A5):** A visibilidade de palpites de OUTROS participantes **ainda não foi decidida** (PRD §6 A5 / PLAN R2). Esta task **NÃO** assume que o botão abre algo. Comportamento desta task:
  - Default: botão **OCULTO** (não renderizado) até A5 ser resolvido.
  - Alternativa aceitável: renderizar **desabilitado** (`disabled`, `aria-disabled`, tooltip/texto "Em breve") — `/screen` decide entre oculto vs desabilitado.
  - Em NENHUM caso implementar navegação/destino. Marcar com comentário de código apontando A5.
- **uid inexistente / sem dados:** se `getUserRanking(uid)` retorna `null` (uid não está no ranking) E/OU `statistics/{uid}` não existe → estado **"Participante não encontrado"** (`RankingEmptyState` com mensagem apropriada). Não quebrar a tela.
- **uid === usuário logado:** acessar o próprio perfil por essa rota é permitido (a tela é genérica). Não há tratamento especial obrigatório (poderia futuramente redirecionar para "Meu Ranking" — fora de escopo).

## 7. Contracts and interfaces

```tsx
// page.tsx (Server Component fino) — repassa o uid de params ao client:
export default function ParticipantProfilePage({
  params,
}: { params: Promise<{ uid: string }> }): JSX.Element; // Next 15: params é Promise
// ou: componente client lê via useParams<{ uid: string }>()

// ParticipantProfile.tsx
interface ParticipantProfileProps { uid: string; }
export function ParticipantProfile({ uid }: ParticipantProfileProps): JSX.Element;

// Subcomponentes internos (não exportar obrigatoriamente):
// ProfileStatCard({ label: string; value: string; sublabel?: string })
// StagePerformanceCard({ stageLabel: string; points: number | null })
```

Tipos consumidos (TASK-01): `RankingEntry` (`{ uid, nickname, name?, position, points, wrong?, accuracy? }`), `Statistics` (`{ uid, totalCorrect, totalWrong?, accuracy, longestStreak, correctByStage, positionHistory[] }`).

Hooks: `useParticipantProfile(uid)` → `UseQueryResult<Statistics | null>`; ranking via `useRanking("geral")` → `UseQueryResult<Ranking | null>` (achar entry do uid + `total = entries.length`) **ou** novo `useUserRanking(uid)` fino sobre `getUserRanking(uid)` (decisão no /implement; documentar a escolhida).

## 8. Data and persistence impact

Nenhum. Apenas leitura via hooks (Client SDK, somente-leitura — garantido por TASK-14 rules). Sem escrita. **Nota:** "Participante desde" exige `createdAt` do usuário, que **não** está em `rankings`/`statistics` (só lemos essas coleções no client). Ler `users/{uid}` no client contradiz o padrão (lemos rankings/statistics) e depende das rules de `users`. → ver OQ §13 (omitir, ou desnormalizar `createdAt` no recalc — TASK-03).

## 9. Required tests

Recommended TDD: **no**. Teste leve (recomendado, não bloqueante): render com `QueryClientProvider` mockando `useParticipantProfile` + ranking → verifica que nome/posição/pontos aparecem; que o botão "Ver histórico" **não** é renderizado (ou está desabilitado) — guarda do bloqueador A5; que uid inexistente cai no estado "não encontrado". Padrão jsdom (`// @vitest-environment jsdom`). Não testar markup frágil. Lógica de ordenação/aproveitamento já testada em helpers (TASK-02).

## 10. Acceptance criteria

- [ ] `/rankings/perfil/[uid]` mostra avatar + nome + "Participante desde" (ou omite a data conforme OQ resolvida), card "Posição Atual #N de M", grid Pontos/Acertos/Erros/Aproveitamento e "Desempenho por Fase".
- [ ] Dados compostos de `rankings/geral` (entry do uid) + `statistics/{uid}`; `name` com fallback para `nickname`.
- [ ] Sob binário, Pontos e Acertos exibem o mesmo número (sem métrica de "vencedor").
- [ ] **Botão "Ver histórico de palpites" OCULTO ou DESABILITADO** (sem navegação) — guarda explícita do bloqueador A5, com comentário de código referenciando A5.
- [ ] Estados: loading (skeleton), error (+ retry), e **"Participante não encontrado"** (uid inexistente/sem statistics).
- [ ] Acessibilidade enhanced: avatar com `alt`/fallback textual; contraste AA; foco visível; alvos ≥44px; ícones Lucide `aria-hidden`.
- [ ] tsc strict, sem `any`, sem hex/inline; Lucide named; tema `.ranking-theme` herdado; suite verde. `/screen` (ai/screen/ranking-task-12.md) consumido.

## 11. UI/Screen requirement

- Requires screen: **yes** — `/screen` antes do `/implement` (ai/screen/ranking-task-12.md).
- Platform: web (mobile-first, responsivo)
- Screens involved: Tela 05 Perfil do Participante (`docs/prd-05/PRD05-05-Perfil-Participante.png` — fonte de verdade)
- Product type: leaderboard/stats dashboard (consumer, mobile-first)
- Recommended style: tema verde escopo (`.ranking-theme`), cards Shadcn brancos, números grandes `tabular-nums` em `text-primary`, avatar circular grande, header centralizado.
- Applicable UX domains: style, layout, ux

### Accessibility requirements
- `Avatar` com `alt` (nome do participante) e fallback de iniciais textual. Contraste dos números verdes sobre branco ≥ AA (verde `.ranking-theme` ~0.46 validado). Foco visível (`ring-2 ring-ring`) no botão/links; ordem de tab = visual. Ícones Lucide `aria-hidden`. Cards de métrica legíveis por screen reader (label + valor associados). Alvos ≥44px. Suporte a text scaling (sem truncar números).

### Interaction requirements
- Tela majoritariamente estática (leitura). Botão "Ver histórico" (quando exibido) com feedback de press 80–150ms; ≥8px entre alvos; ≥44px. Loading via skeleton (>300ms); erro com retry.

### UI states required
- loading (`RankingSkeleton`), error (`RankingErrorState` + retry), **not-found** (`RankingEmptyState` "Participante não encontrado"), populated (perfil completo), botão histórico (oculto/desabilitado — A5).

## 12. Constraints

- Sem `any`; TS strict; Tailwind tokens (sem hex/inline); Lucide named; `next/link` se houver navegação interna.
- Reusar Shadcn `avatar`/`badge`/`button`, estados TASK-07, hooks TASK-05, tema `.ranking-theme` (já aplicado no `layout.tsx` de `/rankings`).
- `"use client"` no componente (usa hooks/`useParams`).
- Mobile-first; respeitar `pb-20` do layout (não esconder atrás do Bottom Tab Bar).
- NÃO implementar histórico de palpites alheios (A5). NÃO ler API-Football direto.

## 13. Open questions (resolver no /screen ou via decisão de produto)

- **OQ1 — BLOQUEADOR A5 (produto + rules):** visibilidade de palpites de OUTROS participantes não decidida. Decide se o botão "Ver histórico de palpites" fica **oculto** (default) ou **desabilitado**, e — se A5 for aprovado — o destino/rules de leitura. Requer decisão de produto + Firestore Rules **antes** de o botão funcionar. Até lá, sem navegação.
- **OQ2 — Origem de "Participante desde {createdAt}":** `createdAt` do usuário não está em `rankings`/`statistics`. Opções: (a) omitir a linha; (b) desnormalizar `createdAt`/`name` em `rankings.entries` ou `statistics` no recalc (TASK-03); (c) ler `users/{uid}` no client (contraria o padrão). Default proposto: **omitir** até desnormalização — `/screen` confirma.
- **OQ3 — Origem de name/position/total:** confirmar wiring — `useRanking("geral")` + filtro por uid (default, sem novo serviço) vs novo hook `useUserRanking(uid)` sobre `getUserRanking(uid)` (serviço já existe e aceita qualquer uid). Não duplicar lógica.
- **OQ4 — "Desempenho por Fase": posição por fase (#N):** a imagem mostra "#3 24 pts" por fase, mas `statistics.correctByStage` só tem acertos (= pts binário) por fase, não a posição. Exibir só pts/acertos (default) ou buscar posição via `rankings/{fase}` (5 leituras extras)? `/screen` decide; default = só pts por fase.
- **OQ5 — Denominador "X de Y jogos" no Aproveitamento:** Y (partidas finalizadas elegíveis, A2) não está exposto em `RankingEntry`/`Statistics`. Derivar de points/accuracy é frágil. Exibir só o `%` (default) ou desnormalizar Y no recalc? `/screen`/TASK-03 decidem.
- **OQ6 — Pontos vs Acertos no grid:** sob binário são o mesmo número. Manter ambos rótulos (fidelidade à imagem) ou consolidar para evitar redundância? Default: manter ambos exibindo o mesmo valor; `/screen` confirma.
