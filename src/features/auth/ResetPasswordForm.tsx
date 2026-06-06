"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { AlertCircle, Check, LoaderCircle } from "lucide-react";
import { toast } from "sonner";

import { Button, buttonVariants } from "@/components/ui/button";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { PasswordInput } from "@/components/auth/PasswordInput";
import { PasswordChecklist } from "@/features/auth/PasswordChecklist";
import { cn } from "@/lib/utils";
import {
  resetPasswordSchema,
  type ResetPasswordValues,
} from "@/features/auth/schemas";
import { mapAuthError } from "@/features/auth/errors";
import { confirmReset, verifyResetCode } from "@/services/auth";

type ResetState = "verificando" | "valido" | "sucesso" | "invalido";

/**
 * Formulário de redefinição de senha (PRD-01.1, TASK-04).
 *
 * Lê `oobCode`/`mode` da query string (entregues pelo link do e-mail) e opera
 * uma máquina de 4 estados:
 *  - `verificando`: valida o `oobCode` via `verifyResetCode` no mount;
 *  - `valido`: tela 04 (form de nova senha + checklist ao vivo);
 *  - `sucesso`: tela 05 (confirmação + ir para o login);
 *  - `invalido`: link ausente/expirado/usado (CTA para solicitar novo).
 *
 * Deve ser renderizado dentro de um `<Suspense>` (usa `useSearchParams`).
 */
export function ResetPasswordForm() {
  const params = useSearchParams();
  const oobCode = params.get("oobCode");
  const mode = params.get("mode");

  const [state, setState] = useState<ResetState>("verificando");
  const headingRef = useRef<HTMLHeadingElement>(null);

  const form = useForm<ResetPasswordValues>({
    resolver: zodResolver(resetPasswordSchema),
    mode: "onChange",
    defaultValues: { password: "", confirmPassword: "" },
  });

  const { isSubmitting } = form.formState;
  const password = form.watch("password");

  // Valida o oobCode no mount. Guard contra setState após unmount.
  useEffect(() => {
    let active = true;

    if (!oobCode || (mode !== null && mode !== "resetPassword")) {
      setState("invalido");
      return;
    }

    verifyResetCode(oobCode)
      .then(() => {
        if (active) setState("valido");
      })
      .catch(() => {
        if (active) setState("invalido");
      });

    return () => {
      active = false;
    };
  }, [oobCode, mode]);

  // Gerencia o foco a cada transição de estado.
  useEffect(() => {
    if (state === "valido") form.setFocus("password");
    if (state === "sucesso" || state === "invalido") headingRef.current?.focus();
  }, [state, form]);

  async function onSubmit(values: ResetPasswordValues) {
    if (!oobCode) {
      setState("invalido");
      return;
    }
    try {
      await confirmReset(oobCode, values.password);
      setState("sucesso");
    } catch (error) {
      const code = (error as { code?: string }).code ?? "";
      toast.error(mapAuthError(code));
    }
  }

  if (state === "verificando") {
    return (
      <div className="flex flex-col items-center gap-4 py-10">
        <LoaderCircle
          size={32}
          aria-hidden="true"
          className="animate-spin text-primary motion-reduce:animate-none"
        />
        <p role="status" aria-live="polite" className="text-sm text-muted-foreground">
          Validando o link de redefinição…
        </p>
      </div>
    );
  }

  if (state === "invalido") {
    return (
      <div className="flex flex-col items-center gap-6 py-6 text-center">
        <div className="flex size-16 items-center justify-center rounded-full bg-destructive/10">
          <AlertCircle size={32} className="text-destructive" aria-hidden="true" />
        </div>
        <div role="alert" aria-live="assertive" className="flex flex-col gap-2">
          <h2
            ref={headingRef}
            tabIndex={-1}
            className="text-xl font-semibold text-foreground outline-none"
          >
            Link inválido ou expirado
          </h2>
          <p className="text-sm text-muted-foreground">
            Este link de redefinição não é mais válido. Solicite um novo para
            continuar.
          </p>
        </div>
        <Link
          href="/esqueci-senha"
          className={cn(buttonVariants({ variant: "default" }), "h-11 w-full")}
        >
          Solicitar novo link
        </Link>
      </div>
    );
  }

  if (state === "sucesso") {
    return (
      <div className="flex flex-col items-center gap-6 py-6 text-center">
        <div className="flex size-16 items-center justify-center rounded-full bg-primary">
          <Check size={32} className="text-primary-foreground" aria-hidden="true" />
        </div>
        <div role="status" aria-live="polite" className="flex flex-col gap-2">
          <h2
            ref={headingRef}
            tabIndex={-1}
            className="text-xl font-semibold text-foreground outline-none"
          >
            Senha alterada com sucesso!
          </h2>
          <p className="text-sm text-muted-foreground">
            Sua senha foi redefinida. Agora você pode acessar sua conta com a
            nova senha.
          </p>
        </div>
        <Link
          href="/login"
          className={cn(buttonVariants({ variant: "default" }), "h-11 w-full")}
        >
          Ir para o login
        </Link>
      </div>
    );
  }

  // state === "valido" — tela 04
  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-1">
        <h2 className="text-xl font-semibold text-foreground">
          Definir nova senha
        </h2>
        <p className="text-sm text-muted-foreground">
          Crie uma nova senha para sua conta.
        </p>
      </div>

      <Form {...form}>
        <form
          onSubmit={form.handleSubmit(onSubmit)}
          className="flex flex-col gap-4"
          noValidate
        >
          <FormField
            control={form.control}
            name="password"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Nova senha</FormLabel>
                <FormControl
                  render={
                    <PasswordInput
                      autoComplete="new-password"
                      placeholder="••••••••"
                      {...field}
                    />
                  }
                />
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="confirmPassword"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Confirmar nova senha</FormLabel>
                <FormControl
                  render={
                    <PasswordInput
                      autoComplete="new-password"
                      placeholder="••••••••"
                      {...field}
                    />
                  }
                />
                <FormMessage />
              </FormItem>
            )}
          />

          <PasswordChecklist value={password} />

          <Button
            type="submit"
            variant="default"
            className="h-11 w-full"
            disabled={isSubmitting}
            aria-busy={isSubmitting}
          >
            {isSubmitting ? (
              <LoaderCircle
                size={16}
                aria-hidden="true"
                className="animate-spin motion-reduce:animate-none"
              />
            ) : null}
            {isSubmitting ? "Redefinindo..." : "Redefinir senha"}
          </Button>
        </form>
      </Form>
    </div>
  );
}
