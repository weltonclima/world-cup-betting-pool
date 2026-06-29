"use client";

import { useEffect, useRef, useState, type JSX } from "react";
import { Camera, LoaderCircle } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
  AvatarImageError,
  fileToCompressedDataUrl,
} from "@/features/profile/lib/imageToDataUrl";
import { MAX_POOL_PHOTO_BASE64_LENGTH } from "@/schemas/pools";
import { useGroupSettings, useUpdateGroupSettings } from "@/features/groupAdmin/hooks";
import type { Pool } from "@/types/pools";

import { GroupAdminSubHeader } from "./GroupAdminSubHeader";
import { ErrorState } from "./GroupPendingUsers";

const MAX_DESCRIPTION = 160;
// Teto de bytes da foto: ~3/4 do limite de chars base64 (margem segura).
const PHOTO_MAX_BYTES = Math.floor((MAX_POOL_PHOTO_BASE64_LENGTH * 3) / 4) - 1024;

/**
 * Configurações do Grupo (PRD10-05). Edita Nome*, Descrição (contador NN/160),
 * Foto (compressão client, D-A2), Limite de participantes (vazio = sem limite) e
 * Permitir convites (toggle). "Salvar alterações" só envia os campos alterados.
 */
export function GroupSettingsForm(): JSX.Element {
  const { data, isLoading, isError, refetch } = useGroupSettings();

  return (
    <div className="flex flex-col gap-5">
      <GroupAdminSubHeader title="Configurações do Grupo" />
      {isError && !isLoading ? (
        <ErrorState onRetry={() => void refetch()} />
      ) : isLoading || !data ? (
        <FormSkeleton />
      ) : (
        <SettingsFields pool={data} />
      )}
    </div>
  );
}

function SettingsFields({ pool }: { pool: Pool }): JSX.Element {
  const update = useUpdateGroupSettings();
  const fileRef = useRef<HTMLInputElement>(null);

  const [name, setName] = useState(pool.name);
  const [description, setDescription] = useState(pool.description ?? "");
  const [photo, setPhoto] = useState<string | undefined>(pool.photoBase64);
  const [maxParticipants, setMaxParticipants] = useState(
    pool.maxParticipants !== undefined ? String(pool.maxParticipants) : "",
  );
  const [allowInvites, setAllowInvites] = useState(pool.allowInvites !== false);
  const [splitPhaseRanking, setSplitPhaseRanking] = useState(pool.splitPhaseRanking === true);

  const [photoError, setPhotoError] = useState<string | null>(null);
  const [photoBusy, setPhotoBusy] = useState(false);
  const [saved, setSaved] = useState(false);

  // Reseta o estado se o pool subjacente mudar (refetch/invalidate).
  useEffect(() => {
    setName(pool.name);
    setDescription(pool.description ?? "");
    setPhoto(pool.photoBase64);
    setMaxParticipants(
      pool.maxParticipants !== undefined ? String(pool.maxParticipants) : "",
    );
    setAllowInvites(pool.allowInvites !== false);
    setSplitPhaseRanking(pool.splitPhaseRanking === true);
  }, [pool]);

  async function onPickPhoto(file: File | undefined): Promise<void> {
    if (!file) return;
    setPhotoError(null);
    setPhotoBusy(true);
    try {
      const dataUrl = await fileToCompressedDataUrl(file, PHOTO_MAX_BYTES);
      setPhoto(dataUrl);
      setSaved(false);
    } catch (error) {
      setPhotoError(
        error instanceof AvatarImageError
          ? error.message
          : "Não foi possível processar a imagem.",
      );
    } finally {
      setPhotoBusy(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  }

  const trimmedName = name.trim();
  const nameInvalid = trimmedName.length === 0;
  const maxNum = maxParticipants.trim() === "" ? null : Number(maxParticipants);
  const maxInvalid =
    maxNum !== null && (!Number.isInteger(maxNum) || maxNum < 1);

  function onSubmit(e: React.FormEvent): void {
    e.preventDefault();
    if (nameInvalid || maxInvalid) return;

    // Envia apenas os campos efetivamente alterados (PATCH parcial).
    const patch: Parameters<typeof update.mutate>[0] = {};
    if (trimmedName !== pool.name) patch.name = trimmedName;
    if (description.trim() !== (pool.description ?? "")) {
      patch.description = description.trim();
    }
    if (photo !== pool.photoBase64 && photo !== undefined) {
      patch.photoBase64 = photo;
    }
    const currentMax = pool.maxParticipants ?? null;
    if (maxNum !== currentMax) patch.maxParticipants = maxNum;
    if (allowInvites !== (pool.allowInvites !== false)) {
      patch.allowInvites = allowInvites;
    }
    if (splitPhaseRanking !== (pool.splitPhaseRanking === true)) {
      patch.splitPhaseRanking = splitPhaseRanking;
    }

    if (Object.keys(patch).length === 0) {
      setSaved(true);
      return;
    }

    update.mutate(patch, { onSuccess: () => setSaved(true) });
  }

  const dirty =
    trimmedName !== pool.name ||
    description.trim() !== (pool.description ?? "") ||
    (photo !== pool.photoBase64 && photo !== undefined) ||
    maxNum !== (pool.maxParticipants ?? null) ||
    allowInvites !== (pool.allowInvites !== false) ||
    splitPhaseRanking !== (pool.splitPhaseRanking === true);

  return (
    <form onSubmit={onSubmit} className="flex flex-col gap-5">
      {/* Foto (PRD10-05): rótulo + avatar + botão visível + dica de formato. */}
      <div className="flex flex-col gap-1.5">
        <Label>Foto do Grupo</Label>
        <div className="flex items-center gap-4">
          <Avatar className="size-20">
            {photo ? <AvatarImage src={photo} alt="" /> : null}
            <AvatarFallback className="bg-muted text-muted-foreground">
              <Camera size={24} aria-hidden="true" />
            </AvatarFallback>
          </Avatar>
          <div className="flex flex-col gap-1">
            <Button
              type="button"
              variant="outline"
              onClick={() => fileRef.current?.click()}
              disabled={photoBusy || update.isPending}
              className="min-h-[44px]"
            >
              {photoBusy ? (
                <LoaderCircle
                  size={16}
                  className="animate-spin motion-reduce:animate-none"
                  aria-hidden="true"
                />
              ) : (
                <Camera size={16} aria-hidden="true" />
              )}
              Alterar foto
            </Button>
            <p className="text-xs text-muted-foreground">PNG, JPG até 2MB</p>
          </div>
        </div>
        <input
          ref={fileRef}
          type="file"
          accept="image/*"
          className="sr-only"
          onChange={(e) => void onPickPhoto(e.target.files?.[0])}
        />
        {photoError ? (
          <p role="alert" className="text-xs text-destructive">
            {photoError}
          </p>
        ) : null}
      </div>

      {/* Nome */}
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="group-name">Nome *</Label>
        <Input
          id="group-name"
          value={name}
          onChange={(e) => {
            setName(e.target.value);
            setSaved(false);
          }}
          required
          aria-invalid={nameInvalid}
          className="h-11"
        />
        {nameInvalid ? (
          <p className="text-xs text-destructive">Informe o nome do grupo.</p>
        ) : null}
      </div>

      {/* Descrição */}
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="group-description">Descrição</Label>
        <textarea
          id="group-description"
          value={description}
          maxLength={MAX_DESCRIPTION}
          onChange={(e) => {
            setDescription(e.target.value);
            setSaved(false);
          }}
          rows={3}
          className="w-full resize-none rounded-lg border border-input bg-transparent px-3 py-2 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
        />
        <p className="text-right text-xs text-muted-foreground">
          {description.length}/{MAX_DESCRIPTION}
        </p>
      </div>

      {/* Limite de participantes */}
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="group-max">Limite de participantes</Label>
        <Input
          id="group-max"
          type="number"
          inputMode="numeric"
          min={1}
          value={maxParticipants}
          onChange={(e) => {
            setMaxParticipants(e.target.value);
            setSaved(false);
          }}
          placeholder="Sem limite"
          aria-invalid={maxInvalid}
          className="h-11"
        />
        {maxInvalid ? (
          <p className="text-xs text-destructive">
            Informe um número inteiro maior ou igual a 1, ou deixe em branco.
          </p>
        ) : (
          <p className="text-xs text-muted-foreground">
            Deixe em branco para não limitar.
          </p>
        )}
      </div>

      {/* Permitir convites */}
      <div className="flex items-center justify-between gap-4 rounded-xl border border-border p-4">
        <div className="min-w-0">
          <Label htmlFor="group-allow-invites" className="font-medium">
            Permitir convites
          </Label>
          <p className="text-xs text-muted-foreground">
            Habilita a geração de links e códigos de convite.
          </p>
        </div>
        <Switch
          id="group-allow-invites"
          checked={allowInvites}
          onCheckedChange={(v) => {
            setAllowInvites(v);
            setSaved(false);
          }}
        />
      </div>

      {/* Dividir ranking por fase */}
      <div className="flex items-center justify-between gap-4 rounded-xl border border-border p-4">
        <div className="min-w-0">
          <Label htmlFor="group-split-phase-ranking" className="font-medium">
            Dividir ranking por fase
          </Label>
          <p className="text-xs text-muted-foreground">
            Exibe rankings separados para a fase de grupos e eliminatórias.
          </p>
        </div>
        <Switch
          id="group-split-phase-ranking"
          checked={splitPhaseRanking}
          disabled={update.isPending}
          onCheckedChange={(v) => {
            setSplitPhaseRanking(v);
            setSaved(false);
          }}
        />
      </div>

      {update.isError ? (
        <p role="alert" className="text-sm text-destructive">
          {update.error.message}
        </p>
      ) : null}
      {saved && !dirty ? (
        <p role="status" className="text-sm text-emerald-600">
          Alterações salvas.
        </p>
      ) : null}

      <Button
        type="submit"
        disabled={nameInvalid || maxInvalid || update.isPending || photoBusy}
        aria-busy={update.isPending}
        className="h-11 w-full"
      >
        {update.isPending ? (
          <LoaderCircle
            size={16}
            className="animate-spin motion-reduce:animate-none"
            aria-hidden="true"
          />
        ) : null}
        Salvar alterações
      </Button>
    </form>
  );
}

function FormSkeleton(): JSX.Element {
  return (
    <div aria-hidden="true" className="flex flex-col gap-5">
      <div className="mx-auto size-20 rounded-full bg-muted animate-pulse motion-reduce:animate-none" />
      {[0, 1, 2].map((i) => (
        <div key={i} className="flex flex-col gap-2">
          <div className="h-4 w-24 rounded bg-muted animate-pulse motion-reduce:animate-none" />
          <div className="h-11 rounded-lg bg-muted animate-pulse motion-reduce:animate-none" />
        </div>
      ))}
    </div>
  );
}
