"use client";

import type { JSX, ReactNode } from "react";
import { useRouter } from "next/navigation";
import { AlertCircle, ChevronLeft, Search } from "lucide-react";

import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

/** Cabeçalho das telas do Super Admin (PRD-11): voltar + título à esquerda. */
export function SuperAdminSubHeader({
  title,
  subtitle,
}: {
  title: string;
  subtitle?: string;
}): JSX.Element {
  const router = useRouter();
  return (
    <header className="flex items-center gap-1">
      <Button
        type="button"
        variant="ghost"
        size="icon"
        aria-label="Voltar"
        onClick={() => router.back()}
        className="size-11 shrink-0"
      >
        <ChevronLeft size={22} aria-hidden="true" />
      </Button>
      <div className="flex min-w-0 flex-col">
        <h1 className="truncate text-lg font-semibold text-foreground">{title}</h1>
        {subtitle ? (
          <p className="truncate text-sm text-muted-foreground">{subtitle}</p>
        ) : null}
      </div>
    </header>
  );
}

/** Campo de busca com ícone (mobile-first, alvo ≥44px). */
export function SearchInput({
  value,
  onChange,
  placeholder = "Buscar",
}: {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
}): JSX.Element {
  return (
    <div className="relative">
      <Search
        size={18}
        aria-hidden="true"
        className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground"
      />
      <Input
        type="search"
        inputMode="search"
        aria-label={placeholder}
        placeholder={placeholder}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="h-11 pl-10"
      />
    </div>
  );
}

/** Estado de erro padrão (role=alert + "Tentar novamente"). */
export function ErrorState({ onRetry }: { onRetry: () => void }): JSX.Element {
  return (
    <div
      role="alert"
      aria-live="polite"
      className="flex flex-col items-center gap-3 rounded-xl border border-border p-6 text-center"
    >
      <AlertCircle size={28} className="text-destructive" aria-hidden="true" />
      <p className="text-sm text-muted-foreground">
        Erro ao carregar informações.
      </p>
      <Button
        type="button"
        variant="outline"
        size="sm"
        onClick={onRetry}
        className="min-h-[44px]"
      >
        Tentar novamente
      </Button>
    </div>
  );
}

/** Estado vazio padrão. */
export function EmptyState({
  message = "Nenhum registro encontrado.",
}: {
  message?: string;
}): JSX.Element {
  return (
    <div className="flex flex-col items-center gap-2 rounded-xl border border-border p-8 text-center">
      <p className="text-sm text-muted-foreground">{message}</p>
    </div>
  );
}

/** Skeleton de lista (role=status + aria-busy). */
export function ListSkeleton({ rows = 4 }: { rows?: number }): JSX.Element {
  return (
    <div
      role="status"
      aria-busy="true"
      aria-label="Carregando"
      className="flex flex-col rounded-xl border border-border"
    >
      {Array.from({ length: rows }).map((_, i) => (
        <div
          key={i}
          aria-hidden="true"
          className="flex items-center gap-3 border-b border-border px-4 py-3 last:border-b-0"
        >
          <div className="size-10 shrink-0 rounded-full bg-muted animate-pulse motion-reduce:animate-none" />
          <div className="flex min-w-0 flex-1 flex-col gap-2">
            <div className="h-3 w-1/3 rounded bg-muted animate-pulse motion-reduce:animate-none" />
            <div className="h-2 w-1/2 rounded bg-muted animate-pulse motion-reduce:animate-none" />
          </div>
        </div>
      ))}
    </div>
  );
}

/** Wrapper de lista que resolve loading → error → empty → conteúdo. */
export function ListState<T>({
  isLoading,
  isError,
  data,
  onRetry,
  emptyMessage,
  skeletonRows,
  children,
}: {
  isLoading: boolean;
  isError: boolean;
  data: T[] | undefined;
  onRetry: () => void;
  emptyMessage?: string;
  skeletonRows?: number;
  children: (data: T[]) => ReactNode;
}): JSX.Element {
  if (isError && !isLoading) return <ErrorState onRetry={onRetry} />;
  if (isLoading || !data) return <ListSkeleton {...(skeletonRows ? { rows: skeletonRows } : {})} />;
  if (data.length === 0) {
    return <EmptyState {...(emptyMessage ? { message: emptyMessage } : {})} />;
  }
  return <>{children(data)}</>;
}

/** Formata ISO em data pt-BR (dd/MM/yyyy). */
export function formatDatePtBr(iso: string | null | undefined): string {
  if (!iso) return "—";
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "—";
  return new Intl.DateTimeFormat("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  }).format(date);
}

/** Formata ISO em "dd/MM/yyyy às HH:mm". */
export function formatDateTimePtBr(iso: string | null | undefined): string {
  if (!iso) return "—";
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "—";
  const d = new Intl.DateTimeFormat("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  }).format(date);
  const t = new Intl.DateTimeFormat("pt-BR", {
    hour: "2-digit",
    minute: "2-digit",
  }).format(date);
  return `${d} às ${t}`;
}

/**
 * Avatar de um grupo/pool: foto (photoBase64) se houver, senão iniciais do nome.
 * Mantém alvo visual de 40px (size-10) consistente com a lista admin.
 */
export function GroupAvatar({
  name,
  photoBase64,
  avatarUrl,
  className,
}: {
  name: string;
  photoBase64?: string | null | undefined;
  avatarUrl?: string | null | undefined;
  className?: string;
}): JSX.Element {
  const src = photoBase64 ?? avatarUrl ?? null;
  return (
    <Avatar className={cn("size-10", className)}>
      {src ? <AvatarImage src={src} alt="" /> : null}
      <AvatarFallback className="bg-primary/10 text-sm font-semibold text-primary">
        {getInitials(name)}
      </AvatarFallback>
    </Avatar>
  );
}

/** Iniciais de um nome (até 2 letras) para avatar fallback. */
export function getInitials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "?";
  const first = parts[0]?.[0] ?? "";
  const last = parts.length > 1 ? (parts[parts.length - 1]?.[0] ?? "") : "";
  return (first + last).toUpperCase() || "?";
}
