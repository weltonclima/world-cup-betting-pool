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
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";

import { useProfile, useUpdateProfile } from "../hooks";
import {
  AvatarImageError,
  fileToCompressedDataUrl,
} from "../lib/imageToDataUrl";

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
  const [uploading, setUploading] = useState(false);

  const form = useForm<EditProfileValues>({
    resolver: zodResolver(editProfileSchema),
    values: { nickname: profile?.nickname ?? "" },
  });

  if (!profile) {
    return <p className="text-sm text-muted-foreground">Carregando…</p>;
  }

  async function onAvatar(
    event: React.ChangeEvent<HTMLInputElement>,
  ): Promise<void> {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;
    setUploading(true);
    try {
      const avatarUrl = await fileToCompressedDataUrl(file);
      await updateProfile.mutateAsync({ avatarUrl });
      toast.success("Foto atualizada.");
    } catch (error) {
      toast.error(
        error instanceof AvatarImageError
          ? error.message
          : "Não foi possível atualizar a foto.",
      );
    } finally {
      setUploading(false);
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
            disabled={uploading}
            onClick={() => fileInputRef.current?.click()}
            className="absolute right-0 bottom-0 size-8 rounded-full"
          >
            <Camera size={16} aria-hidden="true" />
          </Button>
        </div>
      </div>

      <Form {...form}>
        <form
          onSubmit={form.handleSubmit(onSubmit)}
          className="flex flex-col gap-4"
          noValidate
        >
          <FormItem>
            <FormLabel>Nome</FormLabel>
            <Input value={profile.name} disabled readOnly />
          </FormItem>
          <FormItem>
            <FormLabel>E-mail</FormLabel>
            <Input value={profile.email} disabled readOnly />
          </FormItem>

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
