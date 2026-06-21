"use client";

import type { JSX } from "react";
import { Check, Plus, Share } from "lucide-react";

import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
  SheetClose,
} from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";

interface IosInstallGuideProps {
  /** Controla a abertura do bottom sheet. */
  open: boolean;
  /** Notifica mudança de estado (fechar via Esc/scrim/swipe/botão). */
  onOpenChange: (open: boolean) => void;
}

const STEPS: { icon: typeof Share; label: string }[] = [
  { icon: Share, label: "Toque no botão Compartilhar na barra do Safari." },
  { icon: Plus, label: 'Escolha "Adicionar à Tela de Início".' },
  { icon: Check, label: 'Toque em "Adicionar" para concluir.' },
];

/**
 * Tutorial visual de instalação no iOS (web-push-pwa TASK-06). iOS/Safari não
 * expõe `beforeinstallprompt`, então a instalação é manual — este sheet mostra
 * os 3 passos. Não dispara nenhum prompt de permissão (gate iOS de TASK-02).
 * Bottom sheet (mobile-native) usando o primitivo `Sheet` do projeto.
 */
export function IosInstallGuide({
  open,
  onOpenChange,
}: IosInstallGuideProps): JSX.Element {
  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="bottom" className="gap-0 pb-[env(safe-area-inset-bottom)]">
        <SheetHeader>
          <SheetTitle>Adicionar à Tela de Início</SheetTitle>
          <SheetDescription>Em 3 passos no Safari</SheetDescription>
        </SheetHeader>

        <ol className="flex flex-col gap-3 px-4">
          {STEPS.map((step, index) => {
            const Icon = step.icon;
            return (
              <li key={index} className="flex items-center gap-3">
                <span className="flex size-9 shrink-0 items-center justify-center rounded-full bg-primary/10 text-sm font-medium text-primary">
                  {index + 1}
                </span>
                <Icon
                  size={18}
                  aria-hidden="true"
                  className="shrink-0 text-muted-foreground"
                />
                <span className="text-sm text-foreground">{step.label}</span>
              </li>
            );
          })}
        </ol>

        <SheetFooter>
          <SheetClose render={<Button variant="outline" className="w-full" />}>
            Entendi
          </SheetClose>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  );
}
