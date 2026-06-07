import { Calendar, Home, PenLine, Trophy, User } from "lucide-react";
import type { LucideIcon } from "lucide-react";

/** Representa um item de navegação do AppShell. */
export interface NavItem {
  label: string;
  href: string;
  icon: LucideIcon;
  ariaLabel: string;
}

/** Itens de navegação compartilhados entre BottomNav e SideNav. */
export const NAV_ITEMS: NavItem[] = [
  {
    label: "Início",
    href: "/home",
    icon: Home,
    ariaLabel: "Ir para início",
  },
  {
    label: "Jogos",
    href: "/matches",
    icon: Calendar,
    ariaLabel: "Ver jogos",
  },
  {
    label: "Palpites",
    href: "/predictions",
    icon: PenLine,
    ariaLabel: "Meus palpites",
  },
  {
    label: "Ranking",
    href: "/rankings",
    icon: Trophy,
    ariaLabel: "Ver ranking",
  },
  {
    label: "Perfil",
    href: "/profile",
    icon: User,
    ariaLabel: "Meu perfil",
  },
];
