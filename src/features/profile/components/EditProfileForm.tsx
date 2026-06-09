"use client";

import { useRef, useState, type JSX } from "react";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Camera } from "lucide-react";
import { toast } from "sonner";

import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";

import { useProfile, useUpdateProfile } from "../hooks";
import { AvatarImageError, validateImageInput } from "../lib/imageToDataUrl";
import { AvatarCropModal } from "./AvatarCropModal";

const editProfileSchema = z.object({
  nickname: z.string().trim().min(1, { message: "Informe seu apelido." }),
});
type EditProfileValues = z.infer<typeof editProfileSchema>;

function initials(name: string): string {
  return name
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((p) => p[0]?.toUpperCase() ?? "")
    .join("");
}

/** Editar Perfil (PRD06-05 → "Editar Perfil"): apelido + avatar (D-A3). */
export function EditProfileForm(): JSX.Element {
  const router = useRouter();
  const { profile } = useProfile();
  const updateProfile = useUpdateProfile();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [pendingFile, setPendingFile] = useState<File | null>(null);
  const [cropOpen, setCropOpen] = useState(false);

  const form = useForm<EditProfileValues>({
    resolver: zodResolver(editProfileSchema),
    values: { nickname: profile?.nickname ?? "" },
  });

  if (!profile) {
    return <p className="text-sm text-muted-foreground">Carregando…</p>;
  }

  // Seleção do arquivo: valida e abre o modal de recorte (o recorte+compressão
  // ocorrem dentro do modal). O input é disparado por clique direto no botão
  // (gesto do usuário) para compatibilidade com iOS Safari.
  function onAvatar(event: React.ChangeEvent<HTMLInputElement>): void {
    const file = event.target.files?.[0];
    event.target.value = ""; // permite reselecionar o mesmo arquivo
    if (!file) return;
    try {
      validateImageInput(file);
    } catch (error) {
      toast.error(
        error instanceof AvatarImageError
          ? error.message
          : "Não foi possível usar essa imagem.",
      );
      return;
    }
    setPendingFile(file);
    setCropOpen(true);
  }

  function closeCrop(): void {
    setCropOpen(false);
    setPendingFile(null);
  }

  async function onCropConfirm(avatarUrl: string): Promise<void> {
    try {
      await updateProfile.mutateAsync({ avatarUrl });
      toast.success("Foto atualizada.");
    } catch {
      toast.error("Não foi possível atualizar a foto.");
    } finally {
      closeCrop();
    }
  }

  async function onSubmit(values: EditProfileValues): Promise<void> {
    try {
      await updateProfile.mutateAsync({ nickname: values.nickname });
      toast.success("Perfil atualizado.");
      router.back();
    } catch {
      toast.error("Não foi possível salvar. Tente novamente.");
    }
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col items-center gap-3">
        <div className="relative">
          <Avatar className="size-24">
            {profile.avatarUrl ? (
              <AvatarImage src={profile.avatarUrl} alt={`Foto de ${profile.name}`} />
            ) : null}
            <AvatarFallback className="text-2xl">
              {initials(profile.name)}
            </AvatarFallback>
          </Avatar>
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            className="hidden"
            onChange={onAvatar}
          />
          <Button
            type="button"
            size="icon"
            aria-label="Alterar foto de perfil"
            disabled={cropOpen || updateProfile.isPending}
            onClick={() => fileInputRef.current?.click()}
            className="absolute right-0 bottom-0 size-8 rounded-full"
          >
            <Camera size={16} aria-hidden="true" />
          </Button>
        </div>
      </div>

      <AvatarCropModal
        open={cropOpen}
        file={pendingFile}
        onConfirm={onCropConfirm}
        onCancel={closeCrop}
      />

      <Form {...form}>
        <form
          onSubmit={form.handleSubmit(onSubmit)}
          className="flex flex-col gap-4"
          noValidate
        >
          {/* Campos estáticos (somente leitura): Label simples, fora de
              FormField — FormLabel exige contexto de FormField e lançaria. */}
          <div className="grid gap-2">
            <Label>Nome</Label>
            <Input value={profile.name} disabled readOnly />
          </div>
          <div className="grid gap-2">
            <Label>E-mail</Label>
            <Input value={profile.email} disabled readOnly />
          </div>

          <FormField
            control={form.control}
            name="nickname"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Apelido</FormLabel>
                <FormControl>
                  <Input placeholder="Seu apelido" {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          <Button
            type="submit"
            className="h-12 w-full"
            disabled={form.formState.isSubmitting}
          >
            Salvar Alterações
          </Button>
        </form>
      </Form>
    </div>
  );
}
