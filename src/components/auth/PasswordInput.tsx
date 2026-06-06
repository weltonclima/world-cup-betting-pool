"use client";

import * as React from "react";
import { Eye, EyeOff } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

/**
 * Campo de senha com botão para alternar a visibilidade do texto.
 *
 * Composição sobre o `Input` do Shadcn (que não traz o toggle nativamente).
 * Encaminha `ref` e todas as props nativas, funcionando com `react-hook-form`
 * `register` e com `Form`/`FormControl` do Shadcn.
 *
 * `leftIcon` (opcional): ícone decorativo posicionado à esquerda do campo;
 * quando presente, o input ganha `pl-9` para não sobrepor o texto.
 */
interface PasswordInputProps extends React.ComponentPropsWithoutRef<"input"> {
  leftIcon?: React.ReactNode;
}

const PasswordInput = React.forwardRef<HTMLInputElement, PasswordInputProps>(
  ({ className, leftIcon, ...props }, ref) => {
    const [visible, setVisible] = React.useState(false);

    return (
      <div className="relative">
        {leftIcon ? (
          <span
            aria-hidden="true"
            className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground"
          >
            {leftIcon}
          </span>
        ) : null}
        <Input
          ref={ref}
          type={visible ? "text" : "password"}
          className={cn("pr-12", leftIcon && "pl-9", className)}
          {...props}
        />
        <Button
          type="button"
          variant="ghost"
          size="icon"
          aria-label={visible ? "Ocultar senha" : "Mostrar senha"}
          aria-pressed={visible}
          onClick={() => setVisible((current) => !current)}
          className="absolute top-1/2 right-1 h-11 w-11 -translate-y-1/2"
        >
          {visible ? (
            <EyeOff size={20} aria-hidden="true" />
          ) : (
            <Eye size={20} aria-hidden="true" />
          )}
        </Button>
      </div>
    );
  },
);

PasswordInput.displayName = "PasswordInput";

export { PasswordInput };
