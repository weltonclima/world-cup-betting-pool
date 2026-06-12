"use client";

import { useMemo, useState, type JSX } from "react";
import {
  CalendarDays,
  ChevronRight,
  Copy,
  Check,
  LineChart,
  LoaderCircle,
  Share2,
  Users,
} from "lucide-react";

import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsList, TabsTab, TabsPanel } from "@/components/ui/tabs";
import {
  useGroupInvites,
  useCreateInvite,
  useGroupSettings,
} from "@/features/groupAdmin/hooks";
import type { Invite } from "@/types/invites";

import { GroupAdminSubHeader } from "./GroupAdminSubHeader";
import { ErrorState, EmptyState, ListSkeleton } from "./GroupPendingUsers";
import { formatDatePtBr } from "./statusBadge";

const DEFAULT_VALIDITY_DAYS = 30;
const DEFAULT_MAX_USES = 100;

/** Monta a URL pública do convite a partir do código (origin do browser). */
function inviteUrl(code: string): string {
  const origin =
    typeof window !== "undefined" ? window.location.origin : "";
  return `${origin}/invite/${code}`;
}

/** Dias restantes (inteiro, mín. 0) até `expiresAt`. */
function validityDays(invite: Invite): number {
  const ms = new Date(invite.expiresAt).getTime() - Date.now();
  return Math.max(0, Math.ceil(ms / 86_400_000));
}

/**
 * Convites do Grupo (PRD10-06). Abas Link/Código, link somente-leitura + copiar,
 * Compartilhar (Web Share API com fallback), card "Configurações do convite"
 * (Validade/Limite/Usos atuais) e "Gerar novo link" (expira o anterior — A3).
 * Geração desabilitada quando `allowInvites === false` (PRD10-05).
 */
export function GroupInvites(): JSX.Element {
  const { data, isLoading, isError, refetch } = useGroupInvites();
  const settings = useGroupSettings();
  const allowInvites = settings.data
    ? settings.data.allowInvites !== false
    : true;

  // Convite "principal" exibido = o ativo mais recente.
  const primary = useMemo<Invite | undefined>(() => {
    if (!data || data.length === 0) return undefined;
    return [...data].sort(
      (a, b) =>
        new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
    )[0];
  }, [data]);

  return (
    <div className="flex flex-col gap-5">
      <GroupAdminSubHeader title="Convites" />

      {isError && !isLoading ? (
        <ErrorState onRetry={() => void refetch()} />
      ) : isLoading || !data ? (
        <ListSkeleton />
      ) : (
        <Tabs defaultValue="link">
          <TabsList className="w-full">
            <TabsTab value="link">Link de convite</TabsTab>
            <TabsTab value="code">Código de convite</TabsTab>
          </TabsList>

          <TabsPanel value="link" className="flex flex-col gap-5 pt-2">
            <InviteValue
              title="Link de convite"
              description="Compartilhe o link abaixo para convidar novos participantes."
              value={primary ? inviteUrl(primary.code) : ""}
              shareLabel="Compartilhar link"
              empty={!primary}
            />
          </TabsPanel>

          <TabsPanel value="code" className="flex flex-col gap-5 pt-2">
            <InviteValue
              title="Código de convite"
              description="Compartilhe o código abaixo para convidar novos participantes."
              value={primary ? primary.code : ""}
              shareLabel="Compartilhar código"
              empty={!primary}
            />
          </TabsPanel>

          <InviteSettingsCard invite={primary} />
          <GenerateLink allowInvites={allowInvites} />
          <ActiveInvitesList invites={data} />
        </Tabs>
      )}
    </div>
  );
}

function InviteValue({
  title,
  description,
  value,
  shareLabel,
  empty,
}: {
  title: string;
  description: string;
  value: string;
  shareLabel: string;
  empty: boolean;
}): JSX.Element {
  const [copied, setCopied] = useState(false);

  async function onCopy(): Promise<void> {
    try {
      await navigator.clipboard.writeText(value);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2000);
    } catch {
      // clipboard indisponível — silencioso (o valor está visível para cópia manual).
    }
  }

  async function onShare(): Promise<void> {
    if (typeof navigator !== "undefined" && "share" in navigator) {
      try {
        await navigator.share({ text: value });
        return;
      } catch {
        // cancelado/indisponível — cai no copiar.
      }
    }
    await onCopy();
  }

  return (
    <section className="flex flex-col gap-3">
      <div className="flex flex-col gap-1">
        <h3 className="text-sm font-semibold text-foreground">{title}</h3>
        <p className="text-sm text-muted-foreground">{description}</p>
      </div>

      {empty ? (
        <EmptyState message="Nenhum convite ativo. Gere um novo link abaixo." />
      ) : (
        <>
          <div className="flex items-center gap-2 rounded-xl border border-border p-1 pl-3">
            <span className="min-w-0 flex-1 truncate text-sm text-foreground">
              {value}
            </span>
            <Button
              type="button"
              variant="ghost"
              size="icon"
              aria-label="Copiar"
              onClick={() => void onCopy()}
              className="size-11 shrink-0"
            >
              {copied ? (
                <Check size={18} className="text-emerald-600" aria-hidden="true" />
              ) : (
                <Copy size={18} aria-hidden="true" />
              )}
            </Button>
          </div>
          <Button
            type="button"
            onClick={() => void onShare()}
            className="h-11 w-full gap-2"
          >
            <Share2 size={18} aria-hidden="true" />
            {shareLabel}
          </Button>
        </>
      )}
    </section>
  );
}

function InviteSettingsCard({ invite }: { invite: Invite | undefined }): JSX.Element {
  return (
    <section className="flex flex-col gap-3">
      <h3 className="text-sm font-semibold text-foreground">
        Configurações do convite
      </h3>
      <dl className="flex flex-col rounded-xl border border-border">
        <SettingRow
          icon={<CalendarDays size={18} aria-hidden="true" />}
          label="Validade"
          value={invite ? `${validityDays(invite)} dias` : "—"}
        />
        <SettingRow
          icon={<Users size={18} aria-hidden="true" />}
          label="Limite de usos"
          value={invite ? String(invite.maxUses) : "—"}
        />
        <SettingRow
          icon={<LineChart size={18} aria-hidden="true" />}
          label="Usos atuais"
          value={invite ? String(invite.usedCount) : "—"}
        />
      </dl>
    </section>
  );
}

function SettingRow({
  icon,
  label,
  value,
}: {
  icon: JSX.Element;
  label: string;
  value: string;
}): JSX.Element {
  return (
    <div className="flex items-center gap-3 border-b border-border px-4 py-3 last:border-b-0">
      <span className="text-muted-foreground">{icon}</span>
      <dt className="flex-1 text-sm text-foreground">{label}</dt>
      <dd className="text-sm font-medium text-foreground tabular-nums">{value}</dd>
    </div>
  );
}

function GenerateLink({ allowInvites }: { allowInvites: boolean }): JSX.Element {
  const create = useCreateInvite();
  const [open, setOpen] = useState(false);
  const [validity, setValidity] = useState(String(DEFAULT_VALIDITY_DAYS));
  const [maxUses, setMaxUses] = useState(String(DEFAULT_MAX_USES));

  const validityNum = Number(validity);
  const maxUsesNum = Number(maxUses);
  const invalid =
    !Number.isInteger(validityNum) ||
    validityNum < 1 ||
    validityNum > 365 ||
    !Number.isInteger(maxUsesNum) ||
    maxUsesNum < 1;

  function onGenerate(): void {
    if (invalid) return;
    create.mutate(
      { validityDays: validityNum, maxUses: maxUsesNum },
      { onSuccess: () => setOpen(false) },
    );
  }

  if (!allowInvites) {
    return (
      <p className="rounded-xl border border-dashed border-border p-4 text-center text-sm text-muted-foreground">
        Convites estão desativados nas configurações do grupo.
      </p>
    );
  }

  if (!open) {
    return (
      <Button
        type="button"
        variant="outline"
        onClick={() => setOpen(true)}
        className="h-11 w-full"
      >
        Gerar novo link
      </Button>
    );
  }

  return (
    <div className="flex flex-col gap-3 rounded-xl border border-border p-4">
      <p className="text-sm font-medium text-foreground">Novo link de convite</p>
      <div className="flex gap-3">
        <div className="flex flex-1 flex-col gap-1.5">
          <Label htmlFor="invite-validity">Validade (dias)</Label>
          <Input
            id="invite-validity"
            type="number"
            inputMode="numeric"
            min={1}
            max={365}
            value={validity}
            onChange={(e) => setValidity(e.target.value)}
            className="h-11"
          />
        </div>
        <div className="flex flex-1 flex-col gap-1.5">
          <Label htmlFor="invite-max-uses">Limite de usos</Label>
          <Input
            id="invite-max-uses"
            type="number"
            inputMode="numeric"
            min={1}
            value={maxUses}
            onChange={(e) => setMaxUses(e.target.value)}
            className="h-11"
          />
        </div>
      </div>
      {invalid ? (
        <p className="text-xs text-destructive">
          Validade entre 1 e 365 dias; limite de usos ≥ 1.
        </p>
      ) : null}
      <p className="text-xs text-muted-foreground">
        O link anterior será desativado ao gerar um novo.
      </p>
      {create.isError ? (
        <p role="alert" className="text-sm text-destructive">
          {create.error.message}
        </p>
      ) : null}
      <div className="flex gap-2">
        <Button
          type="button"
          variant="outline"
          onClick={() => setOpen(false)}
          disabled={create.isPending}
          className="h-11 flex-1"
        >
          Cancelar
        </Button>
        <Button
          type="button"
          onClick={onGenerate}
          disabled={invalid || create.isPending}
          aria-busy={create.isPending}
          className="h-11 flex-1"
        >
          {create.isPending ? (
            <LoaderCircle
              size={16}
              className="animate-spin motion-reduce:animate-none"
              aria-hidden="true"
            />
          ) : null}
          Gerar
        </Button>
      </div>
    </div>
  );
}

function ActiveInvitesList({ invites }: { invites: Invite[] }): JSX.Element {
  if (invites.length === 0) return <></>;
  return (
    <section className="flex flex-col gap-3">
      <h3 className="text-sm font-semibold text-foreground">Convites ativos</h3>
      <ul className="flex flex-col rounded-xl border border-border">
        {invites.map((invite) => (
          <li
            key={invite.id}
            className="flex items-center gap-3 border-b border-border px-4 py-3 last:border-b-0"
          >
            <Avatar>
              <AvatarFallback className="bg-muted text-muted-foreground">
                {(invite.label ?? "L").charAt(0).toUpperCase()}
              </AvatarFallback>
            </Avatar>
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-medium text-foreground">
                {invite.label ?? "Link de convite"}
              </p>
              <p className="text-xs text-muted-foreground">
                Criado em {formatDatePtBr(invite.createdAt)}
              </p>
              <p className="text-xs text-muted-foreground">
                {invite.usedCount}/{invite.maxUses} usos
              </p>
            </div>
            <ChevronRight
              size={18}
              className="shrink-0 text-muted-foreground"
              aria-hidden="true"
            />
          </li>
        ))}
      </ul>
    </section>
  );
}
