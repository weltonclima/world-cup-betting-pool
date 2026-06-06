"use client"

import * as React from "react"
import { Checkbox as CheckboxPrimitive } from "@base-ui/react/checkbox"
import { Check } from "lucide-react"

import { cn } from "@/lib/utils"

/**
 * Checkbox acessível baseado na primitiva `@base-ui/react/checkbox`.
 *
 * O registry Shadcn (`base-nova`) não disponibilizou o componente via CLI, então
 * ele é composto manualmente seguindo o mesmo padrão de `Button`/`Input` (wrap da
 * primitiva base-ui + tokens de tema). A primitiva renderiza um `<span>` com um
 * `<input>` oculto associado, expondo `role="checkbox"` e estados ARIA nativos;
 * `checked`/`onCheckedChange` permitem controle via React Hook Form.
 */
function Checkbox({
  className,
  ...props
}: React.ComponentProps<typeof CheckboxPrimitive.Root>) {
  return (
    <CheckboxPrimitive.Root
      data-slot="checkbox"
      className={cn(
        "peer flex size-5 shrink-0 items-center justify-center rounded-md border border-input bg-transparent text-current shadow-sm outline-none transition-colors focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 disabled:cursor-not-allowed disabled:opacity-50 data-[checked]:border-primary data-[checked]:bg-primary data-[checked]:text-primary-foreground aria-invalid:border-destructive aria-invalid:ring-3 aria-invalid:ring-destructive/20",
        className
      )}
      {...props}
    >
      <CheckboxPrimitive.Indicator
        data-slot="checkbox-indicator"
        className="flex items-center justify-center text-current"
      >
        <Check size={14} aria-hidden="true" />
      </CheckboxPrimitive.Indicator>
    </CheckboxPrimitive.Root>
  )
}

export { Checkbox }
