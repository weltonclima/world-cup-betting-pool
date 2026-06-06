"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { LoaderCircle, Mail, MailCheck } from "lucide-react";
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
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import {
  forgotPasswordSchema,
  type ForgotPasswordValues,
} from "@/features/auth/schemas";
import { mapAuthError } from "@/features/auth/errors";
import { sendPasswordReset } from "@/services/auth";

/**
 * Formulário de solicitação de redefinição de senha (PRD-01.1, TASK-03).
 *
 * Rota única `(auth)/esqueci-senha` com dois estados locais:
 * - `form` (tela 02): campo e-mail + "Enviar link" + "Voltar para o login".
 * - `enviado` (tela 03): confirmação com o e-mail digitado + "Voltar para o login".
 *
 * Anti-enumeração (R3): `sendPasswordReset` engole `auth/user-not-found` na
 * camada de serviço, então qualquer e-mail válido leva à tela de confirmação —
 * sem revelar se a conta existe.
 */
export function ForgotPasswordForm() {
  const [state, setState] = useState<"form" | "enviado">("form");
  const [sentEmail, setSentEmail] = useState("");
  const confirmationHeadingRef = useRef<HTMLHeadingElement>(null);

  const form = useForm<ForgotPasswordValues>({
    resolver: zodResolver(forgotPasswordSchema),
    defaultValues: { email: "" },
  });

  const { isSubmitting } = form.formState;

  // Move o foco para o título da confirmação ao entrar no estado `enviado`.
  useEffect(() => {
    if (state === "enviado") {
      confirmationHeadingRef.current?.focus();
    }
  }, [state]);

  async function onSubmit(values: ForgotPasswordValues) {
    try {
      await sendPasswordReset(values.email);
      setSentEmail(values.email);
      setState("enviado");
    } catch (error) {
      const code = (error as { code?: string }).code ?? "";
      toast.error(mapAuthError(code));
    }
  }

  const backToLoginLink = (
    <Link
      href="/login"
      className={cn(buttonVariants({ variant: "outline" }), "h-11 w-full")}
    >
      Voltar para o login
    </Link>
  );

  if (state === "enviado") {
    return (
      <div className="flex flex-col items-center gap-5 text-center">
        <div role="status" aria-live="polite" className="flex flex-col items-center gap-4">
          <span className="flex size-20 items-center justify-center rounded-full bg-primary/10">
            <MailCheck size={40} className="text-primary" aria-hidden="true" />
          </span>
          <div className="flex flex-col gap-2">
            <h1
              ref={confirmationHeadingRef}
              tabIndex={-1}
              className="text-2xl font-bold text-foreground outline-none"
            >
              Email enviado!
            </h1>
            <p className="text-sm text-muted-foreground">
              Enviamos um link para redefinir sua senha para:
            </p>
            <p className="font-semibold break-all text-primary">{sentEmail}</p>
            <p className="text-sm text-muted-foreground">
              Verifique sua caixa de entrada e também a pasta de spam.
            </p>
          </div>
        </div>
        {backToLoginLink}
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-1 text-center">
        <h1 className="text-2xl font-bold text-foreground">Recuperar senha</h1>
        <p className="text-sm text-muted-foreground">
          Informe o e-mail da sua conta que enviaremos um link para redefinir
          sua senha.
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
            name="email"
            render={({ field }) => (
              <FormItem>
                <FormLabel>E-mail</FormLabel>
                <div className="relative">
                  <Mail
                    size={18}
                    aria-hidden="true"
                    className="absolute top-1/2 left-3 -translate-y-1/2 text-muted-foreground"
                  />
                  <FormControl
                    render={
                      <Input
                        type="email"
                        autoComplete="email"
                        inputMode="email"
                        placeholder="seu@email.com"
                        className="pl-9"
                        {...field}
                      />
                    }
                  />
                </div>
                <FormMessage />
              </FormItem>
            )}
          />

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
            {isSubmitting ? "Enviando..." : "Enviar link"}
          </Button>

          {backToLoginLink}
        </form>
      </Form>
    </div>
  );
}
