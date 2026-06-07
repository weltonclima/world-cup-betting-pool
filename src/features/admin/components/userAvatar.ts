import { format, isValid, parseISO } from "date-fns";

/**
 * Utils puras do item de usuário (iniciais, cor de avatar, data).
 *
 * Nota de design (desvio do spec): o tema do projeto é monocromático-verde
 * (sem paleta colorida; os tokens `chart-*` são escala de cinza). Para honrar a
 * variação por usuário do mock SEM introduzir cor fora do tema, a cor do avatar
 * usa pares semânticos (`primary`/`secondary`/`accent`) — cada um já tem um
 * `-foreground` casado, garantindo contraste AA em qualquer tema ativo.
 */
export type AvatarVariant = "c1" | "c2" | "c3";

/** Classe por variante — pares semânticos com foreground casado (AA garantido). */
export const AVATAR_CLASSES: Record<AvatarVariant, string> = {
  c1: "bg-primary text-primary-foreground",
  c2: "bg-secondary text-secondary-foreground",
  c3: "bg-accent text-accent-foreground",
};

const AVATAR_VARIANTS: readonly AvatarVariant[] = ["c1", "c2", "c3"];

/** Iniciais: 1ª da 1ª palavra + 1ª da última (1 palavra → 2 letras). */
export function getInitials(name: string): string {
  const words = name.trim().split(/\s+/).filter(Boolean);
  if (words.length === 0) return "?";
  if (words.length === 1) {
    return (words[0] ?? "").slice(0, 2).toUpperCase() || "?";
  }
  const first = words[0]?.[0] ?? "";
  const last = words[words.length - 1]?.[0] ?? "";
  return (first + last).toUpperCase();
}

/** Variante de cor determinística e estável por uid (hash simples → índice). */
export function getAvatarVariant(uid: string): AvatarVariant {
  let hash = 0;
  for (let i = 0; i < uid.length; i++) {
    hash = (hash + uid.charCodeAt(i)) % AVATAR_VARIANTS.length;
  }
  return AVATAR_VARIANTS[hash] ?? "c1";
}

/** Formata `createdAt` ISO → `dd/MM/yyyy HH:mm` (fuso local). Inválido → null. */
export function formatUserCreatedAt(iso: string | undefined): string | null {
  if (!iso) return null;
  const date = parseISO(iso);
  if (!isValid(date)) return null;
  return format(date, "dd/MM/yyyy HH:mm");
}
