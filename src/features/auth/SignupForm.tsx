"use client";

import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { toast } from "sonner";
import { AtSign, Lock, Mail, User } from "lucide-react";

import { signupFormSchema, type SignupFormValues } from "@/features/auth/schemas";
import { mapAuthError } from "@/features/auth/errors";
import { signUp } from "@/services/auth";
import { PasswordInput } from "@/components/auth/PasswordInput";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";

/**
 * Formulário de cadastro (PRD-01, TASK-08).
 *
 * React Hook Form + `zodResolver(signupFormSchema)` (TASK-01) com `mode: "onChange"`
 * para habilitar o CTA apenas quando o formulário é válido. Ao submeter, delega ao
 * serviço `signUp` (TASK-06) apenas os campos persistidos — `confirmPassword` é
 * validação exclusiva do frontend e não vai ao Firebase.
 *
 * Não navega no sucesso: o usuário recém-criado nasce `pending` e os guards
 * (AuthLayout) cuidam do redirecionamento para `/pending`.
 */
export function SignupForm() {
  const form = useForm<SignupFormValues>({
    resolver: zodResolver(signupFormSchema),
    mode: "onChange",
    defaultValues: {
      name: "",
      nickname: "",
      email: "",
      password: "",
      confirmPassword: "",
    },
  });

  const { isValid, isSubmitting } = form.formState;

  async function onSubmit(values: SignupFormValues) {
    try {
      await signUp({
        name: values.name,
        nickname: values.nickname,
        email: values.email,
        password: values.password,
      });
      toast.success("Conta criada! Aguarde a aprovação do administrador.");
    } catch (error) {
      toast.error(mapAuthError((error as { code?: string }).code ?? ""));
    }
  }

  return (
    <Form {...form}>
      <form
        onSubmit={form.handleSubmit(onSubmit)}
        noValidate
        className="flex flex-col gap-4"
      >
        <FormField
          control={form.control}
          name="name"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Nome completo</FormLabel>
              <FormControl
                render={
                  <div className="relative">
                    <User
                      size={18}
                      aria-hidden="true"
                      className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground"
                    />
                    <Input
                      type="text"
                      autoComplete="name"
                      placeholder="Digite seu nome completo"
                      aria-required="true"
                      className="pl-9"
                      {...field}
                    />
                  </div>
                }
              />
              <FormMessage />
            </FormItem>
          )}
        />

        <FormField
          control={form.control}
          name="nickname"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Apelido</FormLabel>
              <FormControl
                render={
                  <div className="relative">
                    <AtSign
                      size={18}
                      aria-hidden="true"
                      className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground"
                    />
                    <Input
                      type="text"
                      autoComplete="nickname"
                      placeholder="Digite seu apelido"
                      aria-required="true"
                      className="pl-9"
                      {...field}
                    />
                  </div>
                }
              />
              <FormMessage />
            </FormItem>
          )}
        />

        <FormField
          control={form.control}
          name="email"
          render={({ field }) => (
            <FormItem>
              <FormLabel>E-mail</FormLabel>
              <FormControl
                render={
                  <div className="relative">
                    <Mail
                      size={18}
                      aria-hidden="true"
                      className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground"
                    />
                    <Input
                      type="email"
                      autoComplete="email"
                      placeholder="Digite seu melhor email"
                      aria-required="true"
                      className="pl-9"
                      {...field}
                    />
                  </div>
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
                    autoComplete="new-password"
                    placeholder="Digite sua senha"
                    aria-required="true"
                    leftIcon={<Lock size={18} aria-hidden="true" />}
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
              <FormLabel>Confirmar senha</FormLabel>
              <FormControl
                render={
                  <PasswordInput
                    autoComplete="new-password"
                    placeholder="Confirme sua senha"
                    aria-required="true"
                    leftIcon={<Lock size={18} aria-hidden="true" />}
                    {...field}
                  />
                }
              />
              <FormMessage />
            </FormItem>
          )}
        />

        <Button
          type="submit"
          variant="default"
          disabled={!isValid || isSubmitting}
          className="h-11 w-full"
        >
          {isSubmitting ? "Criando conta..." : "Criar conta"}
        </Button>
      </form>
    </Form>
  );
}
