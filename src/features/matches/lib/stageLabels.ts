/**
 * Mapa `Stage` → rótulo pt-BR — fonte única (PRD-16 / TASK-04).
 *
 * Keyed pelos slugs de `stageSchema` (`@/schemas/shared`): grupos, dezesseis-avos,
 * oitavas, quartas, semifinal, terceiro, final. Tipado `Record<Stage, string>` →
 * a compilação quebra se um slug novo entrar no schema sem rótulo aqui.
 *
 * NÃO confundir com os labels de `BracketView` (keyed por outro enum
 * `roundOf32`/`roundOf16`, incompatível com os slugs de `Stage`).
 */
import type { Stage } from "@/types";

export const STAGE_LABEL: Record<Stage, string> = {
  grupos: "Fase de Grupos",
  "dezesseis-avos": "16-avos de Final",
  oitavas: "Oitavas de Final",
  quartas: "Quartas de Final",
  semifinal: "Semifinal",
  terceiro: "Disputa de 3º Lugar",
  final: "Final",
};
