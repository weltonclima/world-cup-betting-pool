# SPEC

## 1. Task: TASK-15 – Tela Resumo Final + Confirmar e Enviar (PRD03-12 + PRD03-15)

## 2. Objective
Tela final do wizard de palpites em massa: revisão dos finalistas previstos (campeão / vice / 3º / 4º) derivados da chave do usuário + contagem de jogos preenchidos (X/104), com CTA "Confirmar e Enviar" que faz flush de **todos** os palpites pendentes (rascunho local + matches sem prediction salva) via `useUpsertPredictionsBatch`. Exibe o estado "Enviado" (PRD03-15) quando todos os 104 palpites estão persistidos. Sem flag de submissão nova (A5): "enviado" é derivado da existência das predictions no servidor.

## 3. In scope
- Rota `(app)/predictions/resumo/page.tsx` (client) — data-fetching + derivação + wiring do batch.
- Componente apresentacional `FinalSummary.tsx` (+ barrel).
- Derivação de campeão (vencedor da final), vice (perdedor da final), 3º (vencedor do terceiro), 4º (perdedor do terceiro) a partir das predictions/draft sobre os fixtures de `final` e `terceiro`, usando `deriveWinner` (TASK-02) e `resolveTeam` para nome/bandeira.
- Contagem global preenchidos/104 via `computeProgress`.
- CTA "Confirmar e Enviar": agrega rascunho local pendente + (opcional) predictions já salvas que ainda não têm contraparte; envia via batch; feedback agregado Sonner (`buildSaveFeedback`).
- Estado "Enviado" (PRD03-15): trophy + confete textual + "Palpites enviados!" + contagem + ProgressBar 104/104 + CTA secundário "Voltar ao Hub".
- Estados loading / error / parcial (nem tudo persistido).

## 4. Out of scope
- Nova coleção/flag de submissão (A5 — derivado).
- Cálculo de pontuação/ranking (PRD-02/04).
- Edição de placar nesta tela (read-only summary; edição é nas telas de fase).
- Lógica de bracket nova (reusa `bracket.ts`/`standings.ts`).

## 5. Main technical areas
- `src/app/(app)/predictions/resumo/page.tsx`
- `src/features/predictions/components/FinalSummary.tsx` (+ `index.ts`)
- `src/features/predictions/components/__tests__/FinalSummary.test.tsx`
- Reuso: `useMatches`, `useTeams`, `usePredictions`, `usePredictionDraft`, `useUpsertPredictionsBatch`, `buildTeamMap`/`resolveTeam`, `deriveWinner`, `computeProgress`, `buildSaveFeedback`, `ProgressBar`.

## 6. Business rules and behavior
- **Finalistas:** a partir do fixture `stage === "final"` (deve haver 1), deriva winner=campeão / loser=vice via `deriveWinner(home,away,homeScore,awayScore)` usando o placar atual (draft tem prioridade sobre salvo). Do fixture `stage === "terceiro"`: winner=3º / loser=4º. Se o placar é empate (`isDraw`) ou ausente → o slot fica indefinido ("A definir"), e o título do time é o placeholder humanizado quando ainda placeholder, ou "—" quando sem palpite.
- **Resolução de nome:** o `winnerId`/`loserId` derivado é um teamId; `resolveTeam` retorna nome+flag. Se o id ainda é placeholder (chave não resolvida), exibe `humanizePlaceholder`.
- **Contagem:** `computeProgress(predictions, matches).global` → {filled,total}. "Enviado" = total>0 && filled===total.
- **Confirmar e Enviar (A5):** monta payload de pendentes = matches cujo id tem draft local **e** não está bloqueado por kickoff (reusa `isPredictionLocked`), normalizando para `UpsertPredictionInput`. Se não há pendente local mas há salvos, o botão fica desabilitado com texto "Tudo enviado". Após sucesso, limpa o draft (`clearDraft`) dos itens salvos e invalida queries (hook já invalida); feedback via `buildSaveFeedback`.
- **Estado enviado:** quando filled===total, renderiza o painel "Palpites enviados!" (PRD03-15) em vez do resumo de finalistas + CTA de envio.

## 7. Contracts and interfaces
```ts
export interface FinalistSlot {
  /** Rótulo do papel: "Campeão" | "Vice-Campeão" | "3º Lugar" | "4º Lugar". */
  role: string;
  /** Nome do time resolvido, placeholder humanizado, ou null (sem definição). */
  teamName: string | null;
  flagUrl: string | undefined;
}
export interface FinalSummaryProps {
  finalists: FinalistSlot[];      // [campeão, vice, 3º, 4º]
  filled: number;
  total: number;
  isComplete: boolean;            // filled===total && total>0 → estado Enviado
  hasPending: boolean;            // há draft local enviável
  hubHref: string;
  isLoading: boolean;
  isError: boolean;
  isSaving: boolean;
  onConfirm: () => void;
  onRetry: () => void;
}
```
- Reusa `BatchUpsertResult`, `UpsertPredictionInput` de `@/services/predictions`.

## 8. Data and persistence impact
- Leitura: matches (Route Handler), predictions (client SDK via `usePredictions`), draft (localStorage).
- Escrita: `POST /api/predictions/batch` (Admin SDK). Nenhuma coleção nova. Nenhuma flag de submissão.

## 9. Required tests (scoped — vitest jsdom)
- Derivação de finalistas: helper puro `deriveFinalists(matches, scoresByMatchId, teamMap)` (exportado de FinalSummary) → campeão/vice/3º/4º corretos; empate → null; placeholder → humanizado.
- Render do resumo (4 cards com papéis corretos) e da contagem.
- CTA "Confirmar e Enviar" chama `onConfirm` (e que a page monta o payload de pendentes — testar via helper de payload se extraído, senão cobrir no componente o disabled quando `!hasPending`).
- Estado "Enviado" (isComplete) renderiza painel de envio e não o CTA de confirmação.
- Loading / error states.

## 10. Acceptance criteria
- Resumo mostra campeão/vice/3º/4º derivados do placar da chave do usuário.
- Contagem X/104 correta; estado Enviado aparece a 104/104.
- "Confirmar e Enviar" dispara batch com pendentes; feedback agregado Sonner; sem flag nova.
- tsc + eslint limpos nos arquivos alterados; testes scoped GREEN (via vitest JSON).

## 11. UI/Screen requirement
- Requires screen: yes · Platform: web · Screens: PRD03-12 (Resumo Final), PRD03-15 (Enviado).
- Product type: sports betting pool / bracket challenge (mobile-first).
- Recommended style: esportivo limpo (MASTER) + `.palpites-theme` (shell verde).
- Applicable UX domains: style, ux, typography.
### Accessibility requirements
- Contraste ≥ AA (tokens MASTER + verde escopado validado).
- Cards de finalista com `aria-label` ("Campeão: Brasil"); flags `aria-hidden`.
- CTA ≥ 44px; foco visível `ring-2 ring-ring ring-offset-2`.
- Estado Enviado: `role="status"`; trophy `aria-hidden`.
- ProgressBar `role="progressbar"` (componente reusado).
### Interaction requirements
- Press feedback nativo do Button; loading do envio via `isSaving` (botão desabilitado + texto "Enviando…").
- Erro de envio → Sonner; erro de carga → bloco de retry.
### UI states required
- loading (skeleton), error (retry), populated (resumo + CTA), pending-empty (CTA desabilitado "Tudo enviado"), enviado (PRD03-15), saving.

## 12. Constraints
- TS strict, sem `any`; Tailwind tokens only (sem hex; geométrico inline só na ProgressBar já existente); Lucide named imports; `next/link` + `useRouter`.
- Não tocar arquivos fora de: nova rota, novo componente, barrel.
- Componente apresentacional puro; derivação/fetch no page.

## 13. Open questions
- Nenhuma bloqueante. "Pendentes" assume draft local como fonte de não-enviados (A4); predictions já salvas não são reenviadas.
