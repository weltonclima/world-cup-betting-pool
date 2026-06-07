import Image from "next/image";

import { cn } from "@/lib/utils";

interface AuthLogoProps {
  /** `login` → logo landscape (troféu dourado); `cadastro` → logo vertical (verde). */
  variant: "login" | "cadastro";
  className?: string;
}

interface LogoSpec {
  src: string;
  /** Dimensões intrínsecas do PNG (para o aspect-ratio do next/image). */
  width: number;
  height: number;
  /** Largura de exibição (Tailwind). Altura segue por `h-auto`. */
  widthClass: string;
}

const LOGO: Record<AuthLogoProps["variant"], LogoSpec> = {
  login: { src: "/logo-login.png", width: 560, height: 373, widthClass: "w-56" },
  cadastro: { src: "/logo-cadastro.png", width: 560, height: 373, widthClass: "w-56" },
};

/**
 * Logotipo das telas de autenticação (Login/Cadastro).
 *
 * Imagem informativa (nome do produto), portanto recebe `alt` textual.
 * Above-the-fold → `priority`. Dimensões intrínsecas por variante para evitar
 * distorção/letterbox (login é landscape, cadastro é vertical).
 */
export function AuthLogo({ variant, className }: AuthLogoProps) {
  const spec = LOGO[variant];

  return (
    <Image
      src={spec.src}
      alt="Bolão dos Parças"
      width={spec.width}
      height={spec.height}
      priority
      className={cn("mx-auto h-auto object-contain", spec.widthClass, className)}
    />
  );
}
