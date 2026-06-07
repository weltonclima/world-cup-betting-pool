# SPEC

## 1. Task: TASK-16 – Casca do wizard, modo "Completar Copa" e navegação

## 2. Objective
Amarrar o fluxo contínuo de palpites em massa numa casca de wizard URL-driven sobre as rotas já construídas, com modo "⚡ Completar Copa" (encadeia Grupo A→…→L → eliminatórias → resumo), navegação Anterior/Próximo + indicador de etapa, e persistência da etapa/modo atual em localStorage. Garantir que o item de navegação "Palpites" aponta para o Hub (`/predictions`) mantendo `/matches/[id]/predict` como fallback (A8) e que o desbloqueio de fases (A6) é coerente.

## 3. In scope
- `predictionsWizardSteps.ts` — definição pura da sequência canônica de etapas (URL → ordem) + helpers puros (`resolveWizardStep`, `nextStep`, `prevStep`, `stepIndexOf`).
- `usePredictionsWizard.ts` — hook client: lê pathname/searchParams, ativa/persiste o modo "Completar Copa" (localStorage por usuário), expõe etapa atual, prev/next hrefs, progresso (índice/total).
- `PredictionsWizard.tsx` — barra de navegação do wizard (footer): indicador "Etapa X de Y", botões Anterior/Próximo (next/link), badge "Completar Copa" quando o modo está ativo; oculta-se quando o modo não está ativo (navegação livre via Hub).
- `(app)/predictions/layout.tsx` — novo layout que monta o `PredictionsWizard` em todas as rotas `/predictions/*` (aplica também `.palpites-theme` no wrapper).
- Hub: CTA "Completar Copa" ativa o modo (query `?wizard=1`) ao iniciar o fluxo.
- Barrel `components/index.ts` para os novos componentes/tipos.

## 4. Out of scope
- Reescrever as telas existentes (Hub, grupos, chave, resumo) — só montagem da casca.
- Remover `/matches/[id]/predict` (A8 — mantido).
- Mudar a regra A6 (já implementada em buildHubPhases/isBlocked) — apenas garantir coerência.
- Nova máquina de estado server-side.

## 5. Main technical areas
- `src/features/predictions/lib/predictionsWizardSteps.ts` (+ __tests__)
- `src/features/predictions/hooks/usePredictionsWizard.ts`
- `src/features/predictions/components/PredictionsWizard.tsx` (+ __tests__, barrel)
- `src/app/(app)/predictions/layout.tsx`
- `src/components/layout/nav-items.ts` (verificação — já aponta para /predictions)

## 6. Business rules and behavior
- **Sequência canônica (URL-driven):** Hub `/predictions` → Grupos `/predictions/grupos` → (grupos A–L preenchidos via `/predictions/grupos/[groupId]`) → Resumo Grupos `/predictions/resumo-grupos` → Melhores Terceiros `/predictions/melhores-terceiros` → Chave 16 avos → oitavas → quartas → semifinal → final (`/predictions/chave/[stage]`) → Resumo Final `/predictions/resumo`. As 12 telas de grupo individuais são uma sub-etapa de "Grupos"; o wizard trata `/predictions/grupos` e `/predictions/grupos/*` como a mesma etapa "Grupos".
- **resolveWizardStep(pathname):** mapeia um pathname para o índice de etapa (ou null se fora do wizard). `/predictions/grupos/A` → etapa Grupos. `/predictions/chave/oitavas` → etapa Oitavas.
- **next/prev:** retornam o href da etapa seguinte/anterior na sequência; undefined nos extremos (sem Próximo na última, sem Anterior na primeira).
- **Modo "Completar Copa":** ativado quando o Hub navega com `?wizard=1`; persistido em localStorage (`palpites-wizard-{uid}` = "1"). Enquanto ativo, a barra do wizard aparece nas rotas do wizard. Desativável (botão "Sair do modo guiado") → remove a flag.
- **A6 coerência:** o "Próximo" segue a sequência canônica; o bloqueio efetivo de fase continua sendo responsabilidade das telas (PhaseCard bloqueado no Hub; isBlocked na chave). O wizard não força avanço para fase bloqueada além do que as telas já permitem (o Próximo aponta para a próxima etapa; a tela de destino aplica o bloqueio A6 se a anterior não estiver completa).
- **Nav (A8):** `NAV_ITEMS` "Palpites" → `/predictions` (já vigente). `/matches/[id]/predict` permanece como fallback de edição pontual; deep-links não quebram.

## 7. Contracts and interfaces
```ts
export interface WizardStep {
  /** Slug estável da etapa. */
  key: string;
  /** Rótulo pt-BR curto ("Grupos", "16 avos", "Resumo"). */
  label: string;
  /** Href de destino da etapa. */
  href: string;
  /** Prefixos de pathname que pertencem a esta etapa (match por startsWith). */
  match: string[];
}
export const WIZARD_STEPS: readonly WizardStep[];
export function resolveWizardStep(pathname: string): number | null;
export function nextStepHref(pathname: string): string | undefined;
export function prevStepHref(pathname: string): string | undefined;

export interface PredictionsWizardProps {
  stepIndex: number | null;   // null = fora do wizard → não renderiza barra
  totalSteps: number;
  stepLabel: string;
  prevHref?: string;
  nextHref?: string;
  active: boolean;            // modo Completar Copa ativo
  onExit: () => void;
}
```

## 8. Data and persistence impact
- localStorage apenas (`palpites-wizard-{uid}`). Nenhuma escrita no Firestore. Sem nova coleção.

## 9. Required tests (scoped — vitest)
- `predictionsWizardSteps`: resolveWizardStep para pathnames representativos (hub, grupos, grupos/[id], resumo-grupos, terceiros, chave/[stage], resumo, fora do wizard→null); next/prev nas bordas e no meio.
- `PredictionsWizard` (jsdom): não renderiza quando `stepIndex===null` ou `!active`; renderiza "Etapa X de Y"; Anterior/Próximo como links com hrefs corretos; ausência de Anterior na primeira e de Próximo na última; botão "Sair" chama onExit.
- Nav: `NAV_ITEMS` "Palpites".href === "/predictions" (regressão A8).

## 10. Acceptance criteria
- "Completar Copa" no Hub inicia o modo guiado; a barra aparece e encadeia as etapas; Próximo/Anterior corretos; etapa persiste em reload.
- "Palpites" abre o Hub; `/matches/[id]/predict` continua acessível.
- A6 coerente (sem avanço a fase bloqueada além do que as telas permitem).
- tsc + eslint limpos nos arquivos alterados; testes scoped GREEN (vitest JSON).

## 11. UI/Screen requirement
- Requires screen: yes · Platform: web · Screens: barra do wizard (overlay/footer) nas rotas `/predictions/*`.
- Product type: sports betting pool / bracket challenge (mobile-first).
- Recommended style: esportivo limpo + `.palpites-theme`.
- Applicable UX domains: ux, style, navigation.
### Accessibility requirements
- `nav` com `aria-label="Navegação do fluxo de palpites"`; botões ≥ 44px; foco visível.
- Indicador de etapa anunciado (`aria-live="polite"` no contador) e textual (não só visual).
- Links com rótulo claro ("Etapa anterior", "Próxima etapa").
### Interaction requirements
- Press feedback nativo; sem layout shift no foco (ring com offset).
- Barra fixa acima do BottomNav (z-index < toast) sem sobrepor conteúdo (padding-bottom já existe nas páginas).
### UI states required
- oculto (fora do wizard / modo inativo), ativo (barra com prev/next/indicador), primeira etapa (sem Anterior), última etapa (sem Próximo).

## 12. Constraints
- TS strict, sem `any`; Tailwind tokens only; Lucide named imports; `next/link` + `useRouter`/`usePathname`/`useSearchParams`.
- Não tocar arquivos fora de: novos arquivos (steps lib, hook, componente, layout), barrel, nav-items (verificação), Hub (ativar modo). Nada de tocar telas de grupo/chave/resumo.

## 13. Open questions
- Nenhuma bloqueante. O wizard é URL-driven (sem estado server); a sub-navegação entre grupos A–L individuais permanece responsabilidade da tela de seleção de grupo (a etapa "Grupos" do wizard avança para o Resumo de Grupos quando o usuário escolhe Próximo).
