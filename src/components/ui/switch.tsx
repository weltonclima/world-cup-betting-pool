"use client"

import * as React from "react"
import { Switch as SwitchPrimitive } from "@base-ui/react/switch"

import { cn } from "@/lib/utils"

/**
 * Switch On/Off acessível baseado na primitiva `@base-ui/react/switch`.
 *
 * Mesmo padrão de `Checkbox` (o registry Shadcn `base-nova` não traz o
 * componente via CLI): wrap da primitiva base-ui + tokens de tema. A primitiva
 * expõe `role="switch"` e estados ARIA nativos; `checked`/`onCheckedChange`
 * permitem controle via React Hook Form (PRD-08, Preferências).
 */
function Switch({
  className,
  ...props
}: React.ComponentProps<typeof SwitchPrimitive.Root>) {
  return (
    <SwitchPrimitive.Root
      data-slot="switch"
      className={cn(
        "peer inline-flex h-6 w-11 shrink-0 cursor-pointer items-center rounded-full border-2 border-transparent shadow-sm outline-none transition-colors focus-visible:ring-3 focus-visible:ring-ring/50 disabled:cursor-not-allowed disabled:opacity-50 data-[checked]:bg-primary data-[unchecked]:bg-input",
        className
      )}
      {...props}
    >
      <SwitchPrimitive.Thumb
        data-slot="switch-thumb"
        className="pointer-events-none block size-5 rounded-full bg-background shadow-lg ring-0 transition-transform data-[checked]:translate-x-5 data-[unchecked]:translate-x-0"
      />
    </SwitchPrimitive.Root>
  )
}

export { Switch }
