/**
 * Sequência canônica de etapas do wizard de palpites em massa (TASK-16).
 *
 * Lib pura (sem React) — define a ordem URL-driven do fluxo "Completar Copa" e
 * helpers para resolver a etapa atual a partir do pathname e calcular o destino
 * de Anterior/Próximo. Consumida por usePredictionsWizard / PredictionsWizard.
 *
 * A etapa "Grupos" agrega `/predictions/groups` e `/predictions/groups/[groupId]`
 * (a sub-navegação dos 12 grupos é da tela de seleção; o Próximo do wizard leva
 * ao Resumo de Grupos).
 */

/** Uma etapa do wizard. */
export interface WizardStep {
  /** Slug estável da etapa (chave de React/teste). */
  key: string;
  /** Rótulo pt-BR curto exibido no indicador. */
  label: string;
  /** Href de destino ao navegar para esta etapa. */
  href: string;
  /**
   * Prefixos de pathname que pertencem a esta etapa (match por startsWith).
   * Ordenados do mais específico para o menos específico não é necessário —
   * resolveWizardStep escolhe o match mais longo.
   */
  match: string[];
}

/**
 * Ordem canônica do fluxo. A primeira etapa é o Hub; a última é o Resumo Final.
 * As fases eliminatórias seguem a ordem FIFA (16 avos → final), com o 3º lugar
 * renderizado junto da final (rota `/predictions/knockout/final`).
 */
export const WIZARD_STEPS: readonly WizardStep[] = [
  {
    key: "hub",
    label: "Início",
    href: "/predictions",
    match: ["/predictions"],
  },
  {
    key: "grupos",
    label: "Grupos",
    href: "/predictions/groups",
    match: ["/predictions/groups"],
  },
  {
    key: "resumo-grupos",
    label: "Resumo dos grupos",
    href: "/predictions/groups-summary",
    match: ["/predictions/groups-summary"],
  },
  {
    key: "melhores-terceiros",
    label: "Melhores terceiros",
    href: "/predictions/best-thirds",
    match: ["/predictions/best-thirds"],
  },
  {
    key: "dezesseis-avos",
    label: "16 avos",
    href: "/predictions/knockout/dezesseis-avos",
    match: ["/predictions/knockout/dezesseis-avos"],
  },
  {
    key: "oitavas",
    label: "Oitavas",
    href: "/predictions/knockout/oitavas",
    match: ["/predictions/knockout/oitavas"],
  },
  {
    key: "quartas",
    label: "Quartas",
    href: "/predictions/knockout/quartas",
    match: ["/predictions/knockout/quartas"],
  },
  {
    key: "semifinal",
    label: "Semifinais",
    href: "/predictions/knockout/semifinal",
    match: ["/predictions/knockout/semifinal"],
  },
  {
    key: "final",
    label: "Final e 3º lugar",
    href: "/predictions/knockout/final",
    match: ["/predictions/knockout/final"],
  },
  {
    key: "resumo",
    label: "Resumo final",
    href: "/predictions/summary",
    match: ["/predictions/summary"],
  },
];

/** Total de etapas do wizard. */
export const WIZARD_TOTAL_STEPS = WIZARD_STEPS.length;

/** Remove a query string/hash de um pathname para comparação estável. */
function normalizePathname(pathname: string): string {
  const noHash = pathname.split("#")[0] ?? "";
  const noQuery = noHash.split("?")[0] ?? "";
  // Remove trailing slash (exceto raiz) para casar startsWith de forma estável.
  if (noQuery.length > 1 && noQuery.endsWith("/")) {
    return noQuery.slice(0, -1);
  }
  return noQuery;
}

/**
 * Resolve o índice (0-based) da etapa do wizard correspondente ao pathname.
 *
 * Escolhe o match mais específico: entre todas as etapas cujo `match` é prefixo
 * do pathname, retorna a de prefixo mais longo (ex.: `/predictions/groups/A`
 * casa "grupos" e não "hub", pois "/predictions/groups" é mais longo que
 * "/predictions").
 *
 * @param pathname - Pathname atual (com ou sem query/hash).
 * @returns Índice da etapa (0-based), ou null se o pathname não pertence ao wizard.
 */
export function resolveWizardStep(pathname: string): number | null {
  const path = normalizePathname(pathname);
  let bestIndex: number | null = null;
  let bestLen = -1;

  WIZARD_STEPS.forEach((step, index) => {
    for (const prefix of step.match) {
      const matches = path === prefix || path.startsWith(`${prefix}/`);
      if (matches && prefix.length > bestLen) {
        bestLen = prefix.length;
        bestIndex = index;
      }
    }
  });

  return bestIndex;
}

/**
 * Href da próxima etapa na sequência, ou undefined se já estiver na última
 * (ou fora do wizard).
 */
export function nextStepHref(pathname: string): string | undefined {
  const index = resolveWizardStep(pathname);
  if (index === null) return undefined;
  return WIZARD_STEPS[index + 1]?.href;
}

/**
 * Href da etapa anterior na sequência, ou undefined se já estiver na primeira
 * (ou fora do wizard).
 */
export function prevStepHref(pathname: string): string | undefined {
  const index = resolveWizardStep(pathname);
  if (index === null || index === 0) return undefined;
  return WIZARD_STEPS[index - 1]?.href;
}

/** Rótulo curto da etapa atual, ou null se fora do wizard. */
export function stepLabel(pathname: string): string | null {
  const index = resolveWizardStep(pathname);
  if (index === null) return null;
  return WIZARD_STEPS[index]?.label ?? null;
}
