"use client";

import Link from "next/link";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { LoaderCircle } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { PasswordInput } from "@/components/auth/PasswordInput";
import { loginFormSchema, type LoginFormValues } from "@/features/auth/schemas";
import { mapAuthError } from "@/features/auth/errors";
import { signIn } from "@/services/auth";

/**
 * Formulário de login (PRD-01, TASK-07).
 *
 * React Hook Form + Zod (`loginFormSchema`) via Shadcn `Form`. Submete para a
 * camada de serviço (`signIn`) e, em caso de erro, exibe `toast.error` com a
 * mensagem traduzida (`mapAuthError`) — sem revelar existência de conta (R6).
 *
 * Não navega manualmente no sucesso: o `AuthLayout` redireciona aprovados →
 * /home assim que o estado de auth muda.
 */
export function LoginForm() {
  const form = useForm<LoginFormValues>({
    resolver: zodResolver(loginFormSchema),
    defaultValues: {
      email: "",
      password: "",
    },
  });

  const { isSubmitting } = form.formState;

  async function onSubmit(values: LoginFormValues) {
    try {
      await signIn(values.email, values.password);
      // Sucesso: o AuthLayout cuida do redirecionamento (não navegar aqui).
    } catch (error) {
      // Narrowing seguro do código do FirebaseError (sem `any`).
      const code = (error as { code?: string }).code ?? "";
      toast.error(mapAuthError(code));
    }
  }

  return (
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
              <FormControl
                render={
                  <Input
                    type="email"
                    autoComplete="email"
                    placeholder="seu@email.com"
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
          name="password"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Senha</FormLabel>
              <FormControl
                render={
                  <PasswordInput
                    autoComplete="current-password"
                    placeholder="Sua senha"
                    {...field}
                  />
                }
              />
              <FormMessage />
              <div className="flex justify-end">
                {/* Recuperação de senha (PRD-01.1) — rota dedicada. */}
                <Link
                  href="/esqueci-senha"
                  className="text-sm font-medium text-primary hover:underline"
                >
                  Esqueci minha senha
                </Link>
              </div>
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
          {isSubmitting ? "Entrando..." : "Entrar"}
        </Button>
      </form>
    </Form>
  );
}
