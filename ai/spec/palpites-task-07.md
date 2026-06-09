# SPEC — TASK-07: Tela Enviar/Editar Palpite + estados Bloqueado/Registrado

> PRD: `ai/prd/palpites.md` | Plano: `ai/plan/palpites.md` | Branch: `feat/integracao-api-football`
> Tipo: ui | SP: 5 | Criticidade: high | Risco técnico: medium
> TDD recomendado: no. Screen: yes — `ai/screen/palpites-task-07.md`.
> Depende de: TASK-02 (lib pura: `isPredictionLocked`), TASK-06 (hooks: `useUpsertPrediction`, `usePredictions`)

---

## 1. Objetivo

Implementar o formulário full-screen de criação/edição de palpite na rota dedicada
`/matches/[id]/predict`, com três estados possíveis:

1. **Form ativo** — palpite ainda não existe (create) ou existe mas não bloqueado (edit).
2. **Palpite Bloqueado** — `isPredictionLocked` é true; exibe placar palpitado (se houver) read-only.
3. **Palpite Registrado (sucesso)** — após `useUpsertPrediction.mutateAsync` resolver com sucesso.

A tela é full-screen, mobile-first, sem drawer/sheet — rota dedicada conforme decisão A2 do PRD.

---

## 2. Investigação: mecanismos client-side reutilizados

### 2.1 Dados da partida no client — `useMatch` / `useMatchDetail`

**`src/features/matches/hooks/useMatch.ts` (linha 28-35):**
```ts
export function useMatch(id: string): UseQueryResult<MatchWithId | null>
```
- Consome `getMatchById(id)` — `GET /api/matches/:id`.
- Query key: `matchesKeys.detail(id)` → `["matches","detail",id]`.
- `staleTime: STALE_TIME.jogoDia` (30min).
- `enabled: id.length > 0` — desabilita com id vazio.
- Retorna `null` em 404.

**`src/features/matches/hooks/useMatchDetail.ts` (linha 50-109):**
Compositor completo que orquestra `useMatch + useTeams + usePredictions`, resolve times
e deriva `predictionStatus`. Para TASK-07 é mais eficiente usar **`useMatchDetail`** porque
ele já entrega `match.homeTeam`, `match.awayTeam` (com `name` + `flagUrl`) e `match.predictionStatus`,
evitando duplicar o join com teams.

Interface de saída de `useMatchDetail`:
```ts
interface MatchDetailData {
  match: MatchDetailItem | null;  // null durante loading ou 404
  isLoading: boolean;
  isError: boolean;
  refetch: () => void;
}
```

**`MatchDetailItem`** herda de `MatchListItem` (definido em `useMatchesList.ts`) que inclui:
- `id`, `kickoffAt`, `stage`, `round`, `groupId`, `venue`, `status`, `homeScore`, `awayScore`
- `homeTeamId`, `awayTeamId`
- `homeTeam: ResolvedTeam`, `awayTeam: ResolvedTeam`
- `predictionStatus: MatchPredictionStatus` — `"enviado" | "pendente" | "bloqueado"`

**Decisão para TASK-07:** usar `useMatchDetail(id)` como compositor principal. Isso evita
replicar a lógica de join times + derivação de status que já existe.

### 2.2 Bandeiras e nomes de time — `buildTeamMap` / `resolveTeam`

**`src/features/matches/lib/matchesHelpers.ts` (linhas 53-72):**

```ts
// buildTeamMap — linha 53
export function buildTeamMap(teams: TeamWithId[]): Map<string, TeamWithId>

// resolveTeam — linha 66-72
export function resolveTeam(teamId: string, teamMap: Map<string, TeamWithId>): ResolvedTeam
// Retorna: { name: string; flagUrl: string | undefined }
// Fallback: name = teamId raw, flagUrl = undefined
```

Via `useMatchDetail`, o compositor já aplica `resolveTeam` internamente e entrega
`match.homeTeam.name`, `match.homeTeam.flagUrl`, `match.awayTeam.name`, `match.awayTeam.flagUrl`
prontos para renderização — sem necessidade de chamar `resolveTeam` diretamente na página.

### 2.3 Palpite existente — `usePredictions` da feature predictions

**`src/features/predictions/hooks/usePredictions.ts`:**
```ts
export function usePredictions(uid: string | null): UseQueryResult<Prediction[]>
// queryKey: predictionsKeys.all() → ["predictions"]
// queryFn: listPredictionsByUid(uid!)
// enabled: uid !== null
```

Para obter o palpite específico de uma partida, o `PredictionForm` usa `usePredictions(uid)`
e filtra pelo `matchId`: `predictions.find(p => p.matchId === matchId)`.

**Alternativa:** `useMatchDetail` já inclui `usePredictions` internamente para derivar
`predictionStatus`. Para pré-preencher o form, o componente filtra diretamente do array
retornado por `usePredictions` da feature predictions — evita query extra.

### 2.4 Hook de mutação — `useUpsertPrediction` (TASK-06)

**`src/features/predictions/hooks/useUpsertPrediction.ts`:**
```ts
export function useUpsertPrediction(uid: string): UseMutationResult<void, Error, UpsertPredictionInput>
// mutationFn: upsertPrediction({ matchId, homeScore, awayScore })
// onSuccess: invalida predictionsKeys.all() + matchesKeys.predictions(uid) + homeKeys.predictions(uid)
// onError: toast.error(error.message)  ← Sonner, pt-BR, via PredictionServiceError
```

### 2.5 `isPredictionLocked` — `src/features/predictions/lib/predictionsHelpers.ts` (linha 64-68)

```ts
export function isPredictionLocked(match: MatchWithId, now: Date): boolean
// true se now >= kickoffAt OU match.status !== "scheduled"
```

Chamado com `new Date()` no componente. O resultado governa qual estado renderizar.

### 2.6 Stepper — sem componente Shadcn dedicado; usar botões +/- customizados

O Shadcn disponível (`design-system/MASTER.md §8`) inclui `Button`, `Input`, `Form`.
Não existe `Stepper` ou `NumberInput` no Shadcn atual. A solução é um **ScoreInput customizado**
com dois `<Button>` (`-`/`+`) e um display central `<output>` ou `<span>`, acessível com
`role="group"`, `aria-label`, `aria-valuemin/max/valuenow`.

O Shadcn `Input` pode ser usado como campo numérico interno (ou renderização direta do valor)
mas a interação primária é pelos botões touch ≥44px.

### 2.7 Padrão de page existente em `(app)`

**`src/app/(app)/matches/[id]/page.tsx`:**
```tsx
export default async function MatchDetailPage({
  params,
}: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <MatchDetail id={id} />;
}
```
- Server Component. `params` é Promise (Next.js 15 — deve ser awaited).
- AuthGuard + AppShell aplicados pelo layout pai `src/app/(app)/layout.tsx`.
- Delega toda lógica de estado ao componente client.

A página `/matches/[id]/predict/page.tsx` espelha exatamente este padrão.

### 2.8 Schema de validação do formulário

**`src/schemas/predictions.ts`:**
```ts
export const predictionInputSchema = z.object({
  matchId: nonEmptyString,
  homeScore: scoreSchema,   // z.int().min(0)
  awayScore: scoreSchema,
});
```

Para o React Hook Form, usar um schema derivado **sem `matchId`** no form visível
(matchId é injetado via `matchId` prop antes do submit, não como campo editável):

```ts
export const predictionFormSchema = z.object({
  homeScore: scoreSchema,
  awayScore: scoreSchema,
});
export type PredictionFormValues = z.infer<typeof predictionFormSchema>;
```

O schema `predictionFormSchema` é definido localmente no componente ou em `src/schemas/predictions.ts`
como export adicional.

---

## 3. Escopo

### Dentro do escopo

- `src/app/(app)/matches/[id]/predict/page.tsx` — Server Component, espelha `[id]/page.tsx`.
- `src/features/predictions/components/PredictionForm.tsx` — Client Component principal.
- `src/features/predictions/components/PredictionLockedState.tsx` — estado bloqueado.
- `src/features/predictions/components/PredictionSuccess.tsx` — estado de sucesso.
- `src/features/predictions/components/ScoreInput.tsx` — stepper acessível reutilizável.
- `src/features/predictions/components/index.ts` — barrel.
- `src/schemas/predictions.ts` — adicionar `predictionFormSchema` + `PredictionFormValues`.

### Fora do escopo

- `useUpsertPrediction`, `usePredictions`, `predictionsKeys` — TASK-06 (já concluída).
- `isPredictionLocked`, `scorePrediction` — TASK-02 (já concluída).
- Security Rules — TASK-05.
- Route Handler `/api/predictions` — TASK-03.
- Lista de Palpites `/predictions` — TASK-08.
- Ajuste de CTA no detalhe do jogo — TASK-09.
- Testes automáticos — `/test` separado.

---

## 4. Arquivos afetados

| Arquivo | Ação |
|---|---|
| `src/app/(app)/matches/[id]/predict/page.tsx` | **Criar** |
| `src/features/predictions/components/ScoreInput.tsx` | **Criar** |
| `src/features/predictions/components/PredictionForm.tsx` | **Criar** |
| `src/features/predictions/components/PredictionLockedState.tsx` | **Criar** |
| `src/features/predictions/components/PredictionSuccess.tsx` | **Criar** |
| `src/features/predictions/components/index.ts` | **Criar** |
| `src/schemas/predictions.ts` | **Modificar** — adicionar `predictionFormSchema` |

---

## 5. Implementação detalhada

### 5.1 `src/schemas/predictions.ts` — adicionar `predictionFormSchema`

Adicionar ao final do arquivo, após `predictionInputSchema`:

```ts
// ---------------------------------------------------------------------------
// Schema do formulário (TASK-07) — sem matchId (injetado antes do submit).
// ---------------------------------------------------------------------------
export const predictionFormSchema = z.object({
  homeScore: scoreSchema,
  awayScore: scoreSchema,
});

export type PredictionFormValues = z.infer<typeof predictionFormSchema>;
```

---

### 5.2 `src/app/(app)/matches/[id]/predict/page.tsx`

```ts
import { PredictionForm } from "@/features/predictions/components";

/**
 * Página /matches/[id]/predict — Enviar/Editar Palpite (TASK-07).
 *
 * Server Component intencional: sem diretiva "use client".
 * AuthGuard + AppShell aplicados pelo layout pai src/app/(app)/layout.tsx.
 * Toda a lógica de estado (loading/error/locked/success) está em <PredictionForm>.
 *
 * Next.js 15: params é uma Promise — deve ser awaited.
 */
export default async function PredictPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  return <PredictionForm matchId={id} />;
}
```

---

### 5.3 `src/features/predictions/components/ScoreInput.tsx`

Componente reutilizável de stepper de placar. Sem React Hook Form — recebe valor e callbacks.

```ts
"use client";

interface ScoreInputProps {
  label: string;          // ex.: "Gols Mandante" — para aria-label do grupo
  value: number;
  onChange: (value: number) => void;
  disabled?: boolean;     // true no estado Bloqueado
  min?: number;           // default 0
  max?: number;           // default 20 (razoável para Copa)
}
```

**Estrutura JSX:**
```tsx
<div
  role="group"
  aria-label={label}
  className="flex flex-col items-center gap-2"
>
  {/* Label acima */}
  <span className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
    {label}
  </span>

  {/* Controles do stepper */}
  <div className="flex items-center gap-4">
    {/* Botão decrementar */}
    <button
      type="button"
      onClick={() => onChange(Math.max(min, value - 1))}
      disabled={disabled || value <= min}
      aria-label={`Diminuir ${label}`}
      className="min-h-[44px] min-w-[44px] flex items-center justify-center rounded-lg border border-border bg-background text-2xl font-bold text-foreground
        hover:bg-muted transition-colors duration-150
        focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2
        disabled:opacity-50 disabled:cursor-not-allowed"
    >
      −
    </button>

    {/* Valor central — display semântico */}
    <output
      aria-live="polite"
      aria-label={`${label}: ${value}`}
      className="text-5xl font-bold text-foreground min-w-[3rem] text-center"
    >
      {value}
    </output>

    {/* Botão incrementar */}
    <button
      type="button"
      onClick={() => onChange(Math.min(max, value + 1))}
      disabled={disabled || value >= max}
      aria-label={`Aumentar ${label}`}
      className="min-h-[44px] min-w-[44px] flex items-center justify-center rounded-lg border border-border bg-background text-2xl font-bold text-foreground
        hover:bg-muted transition-colors duration-150
        focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2
        disabled:opacity-50 disabled:cursor-not-allowed"
    >
      +
    </button>
  </div>
</div>
```

**Decisões:**
- `role="group"` + `aria-label` agrupa os controles semanticamente para screen readers.
- `<output aria-live="polite">` anuncia mudanças de valor sem interromper o fluxo.
- `min-h-[44px] min-w-[44px]` garante WCAG 2.5.5 em ambas as dimensões.
- `type="button"` nos botões evita submit acidental quando dentro de `<form>`.
- `disabled` quando fora dos limites (min/max) e no estado bloqueado.

---

### 5.4 `src/features/predictions/components/PredictionForm.tsx`

Componente principal. Client Component. Orquestra todos os estados.

#### Props

```ts
export interface PredictionFormProps {
  matchId: string;
}
```

#### Estrutura de estados internos

```ts
type FormState = "form" | "success";
// "locked" não é um estado interno — é derivado de isPredictionLocked(match, now)
// e renderiza PredictionLockedState condicionalmente.
```

#### Fluxo de dados

```
useAuth() → firebaseUser → uid (string | null)
useMatchDetail(matchId) → { match, isLoading, isError, refetch }
usePredictions(uid) → { data: Prediction[] }
useUpsertPrediction(uid) → mutation

existingPrediction = predictions?.find(p => p.matchId === matchId)
locked = match ? isPredictionLocked(match, new Date()) : false
isEditMode = existingPrediction !== undefined
```

#### Pseudo-código do componente

```tsx
export function PredictionForm({ matchId }: PredictionFormProps) {
  const { firebaseUser } = useAuth();
  const uid = firebaseUser?.uid ?? null;

  // Dados da partida (inclui resolução de times + predictionStatus)
  const { match, isLoading, isError, refetch } = useMatchDetail(matchId);

  // Palpites do usuário (para pré-preenchimento em modo edit)
  const { data: predictions } = usePredictions(uid);
  const existingPrediction = predictions?.find((p) => p.matchId === matchId);

  // Mutação de upsert
  const mutation = useUpsertPrediction(uid ?? "");

  // Estado local: "form" | "success"
  const [formState, setFormState] = useState<"form" | "success">("form");

  // React Hook Form + Zod
  const form = useForm<PredictionFormValues>({
    resolver: zodResolver(predictionFormSchema),
    defaultValues: { homeScore: 0, awayScore: 0 },
  });

  // Pré-preencher quando existingPrediction carrega (modo edit)
  useEffect(() => {
    if (existingPrediction) {
      form.reset({
        homeScore: existingPrediction.homeScore,
        awayScore: existingPrediction.awayScore,
      });
    }
  }, [existingPrediction?.homeScore, existingPrediction?.awayScore, form.reset]);

  // — Loading
  if (isLoading) return <PredictionFormSkeleton />;

  // — Error
  if (isError) return <MatchLoadError onRetry={refetch} />;

  // — 404
  if (match === null) return <MatchNotFoundState />;

  // — Lock guard (derivado no render, não estado interno)
  const locked = isPredictionLocked(match, new Date());
  if (locked) {
    return (
      <PredictionLockedState
        match={match}
        prediction={existingPrediction}
      />
    );
  }

  // — Sucesso
  if (formState === "success") {
    return (
      <PredictionSuccess
        match={match}
        homeScore={form.getValues("homeScore")}
        awayScore={form.getValues("awayScore")}
      />
    );
  }

  // — Form ativo
  const isEditMode = existingPrediction !== undefined;

  const onSubmit = async (values: PredictionFormValues) => {
    if (uid === null) return;
    await mutation.mutateAsync({
      matchId,
      homeScore: values.homeScore,
      awayScore: values.awayScore,
    });
    setFormState("success");
  };

  return <PredictionFormContent ... />;
}
```

#### Estrutura JSX do form ativo

```tsx
<div className="flex flex-col gap-6 px-4 py-4 pb-20 max-w-2xl mx-auto md:pb-4">

  {/* Botão voltar */}
  <Link href={`/matches/${matchId}`} aria-label="Voltar para detalhes do jogo"
    className="inline-flex items-center gap-1 text-sm font-medium text-muted-foreground hover:text-foreground
      transition-colors duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 rounded-md">
    <ArrowLeft size={18} aria-hidden="true" />
    <span>Voltar</span>
  </Link>

  {/* Título */}
  <h1 className="text-xl font-bold text-foreground">
    {isEditMode ? "Editar Palpite" : "Enviar Palpite"}
  </h1>

  {/* Header do jogo: bandeiras, nomes, data/estádio */}
  <MatchHeader match={match} />

  {/* Formulário */}
  <Form {...form}>
    <form onSubmit={form.handleSubmit(onSubmit)} noValidate>

      {/* Steppers lado a lado */}
      <div className="flex items-start justify-around gap-8 py-4">
        {/* Stepper Mandante */}
        <FormField
          control={form.control}
          name="homeScore"
          render={({ field }) => (
            <FormItem className="flex flex-col items-center gap-0">
              <FormControl>
                <ScoreInput
                  label="Gols Mandante"
                  value={field.value}
                  onChange={field.onChange}
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        {/* Separador X */}
        <span className="text-3xl font-bold text-muted-foreground mt-8" aria-hidden="true">
          ×
        </span>

        {/* Stepper Visitante */}
        <FormField
          control={form.control}
          name="awayScore"
          render={({ field }) => (
            <FormItem className="flex flex-col items-center gap-0">
              <FormControl>
                <ScoreInput
                  label="Gols Visitante"
                  value={field.value}
                  onChange={field.onChange}
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
      </div>

      {/* Aviso de edição (só no modo edit) */}
      {isEditMode && (
        <p className="text-sm text-muted-foreground text-center">
          Alterações são permitidas até o horário oficial de início do jogo.
        </p>
      )}

      {/* Botão submit */}
      <Button
        type="submit"
        disabled={mutation.isPending}
        aria-busy={mutation.isPending}
        className="w-full min-h-[44px] mt-4"
      >
        {mutation.isPending
          ? "Salvando..."
          : isEditMode ? "Atualizar palpite" : "Salvar palpite"}
      </Button>

    </form>
  </Form>
</div>
```

**Decisões:**
- `noValidate` no `<form>` — RHF + Zod controlam a validação; evita UX nativa do browser.
- `FormField` + `FormControl` + `FormMessage` seguem o padrão Shadcn Form.
- `mutation.isPending` desabilita o botão durante o submit (feedback visual).
- `aria-busy` comunica o estado de loading ao screen reader.
- `form.getValues()` no `onSuccess` (para `PredictionSuccess`) — captura os valores atuais do form antes de mudar de estado.

---

### 5.5 `src/features/predictions/components/MatchHeader.tsx` (subcomponente interno)

Header reutilizável no form, estado bloqueado e sucesso.

```ts
interface MatchHeaderProps {
  match: MatchDetailItem;
}
```

```tsx
function MatchHeader({ match }: MatchHeaderProps) {
  const kickoffDate = new Date(match.kickoffAt);
  const dateStr = format(kickoffDate, "dd/MM/yyyy", { locale: ptBR });
  const timeStr = format(kickoffDate, "HH:mm");

  return (
    <div className="rounded-xl border border-border bg-card shadow-sm p-4 flex flex-col gap-3">

      {/* Times */}
      <div className="flex items-center justify-around gap-4">
        {/* Mandante */}
        <div className="flex flex-col items-center gap-2 flex-1">
          <TeamFlag team={match.homeTeam} />
          <span className="text-sm font-medium text-foreground text-center">{match.homeTeam.name}</span>
        </div>

        <span className="text-xl font-bold text-muted-foreground" aria-label="versus">×</span>

        {/* Visitante */}
        <div className="flex flex-col items-center gap-2 flex-1">
          <TeamFlag team={match.awayTeam} />
          <span className="text-sm font-medium text-foreground text-center">{match.awayTeam.name}</span>
        </div>
      </div>

      {/* Detalhes */}
      <div className="flex flex-col gap-1 text-xs text-muted-foreground">
        <span className="flex items-center gap-1">
          <Calendar size={12} aria-hidden="true" />
          {dateStr} - {timeStr}
        </span>
        {match.venue && (
          <span className="flex items-center gap-1">
            <MapPin size={12} aria-hidden="true" />
            {match.venue.name}, {match.venue.city}
          </span>
        )}
      </div>
    </div>
  );
}
```

`TeamFlag` reutiliza o mesmo padrão de `MatchDetail.tsx` (img com fallback de iniciais).

---

### 5.6 `src/features/predictions/components/PredictionLockedState.tsx`

Estado quando `isPredictionLocked` é true. Ref: `PRD04-05`.

```ts
export interface PredictionLockedStateProps {
  match: MatchDetailItem;
  prediction?: Prediction;  // undefined se não palpitou antes do lock
}
```

```tsx
export function PredictionLockedState({ match, prediction }: PredictionLockedStateProps) {
  const kickoffDate = new Date(match.kickoffAt);
  const dateStr = format(kickoffDate, "dd/MM/yyyy", { locale: ptBR });
  const timeStr = format(kickoffDate, "HH:mm");

  return (
    <div className="flex flex-col gap-6 px-4 py-4 pb-20 max-w-2xl mx-auto md:pb-4">

      {/* Botão voltar */}
      <Link href={`/matches/${match.id}`} aria-label="Voltar para detalhes do jogo"
        className="inline-flex items-center gap-1 text-sm font-medium text-muted-foreground hover:text-foreground transition-colors duration-150 ...">
        <ArrowLeft size={18} aria-hidden="true" />
        <span>Voltar</span>
      </Link>

      {/* Ícone + título */}
      <div className="flex flex-col items-center gap-3 py-6 text-center">
        <div className="rounded-full bg-muted p-4">
          <Lock size={32} aria-hidden="true" className="text-muted-foreground" />
        </div>
        <h1 className="text-xl font-bold text-foreground">Palpite bloqueado</h1>
        <p className="text-sm text-muted-foreground">
          O prazo para este jogo foi encerrado.
          {!prediction && " Não foi possível criar ou alterar seu palpite."}
        </p>
      </div>

      {/* Header do jogo */}
      <MatchHeader match={match} />

      {/* Palpite registrado (se houver) */}
      {prediction && (
        <div className="rounded-xl border border-border bg-card shadow-sm p-4 flex flex-col gap-2">
          <span className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
            Seu palpite
          </span>
          <div className="flex items-center justify-around gap-4">
            <div className="flex flex-col items-center gap-1">
              <span className="text-xs text-muted-foreground">{match.homeTeam.name}</span>
              <span className="text-4xl font-bold text-foreground">{prediction.homeScore}</span>
            </div>
            <span className="text-xl font-bold text-muted-foreground" aria-label="por">×</span>
            <div className="flex flex-col items-center gap-1">
              <span className="text-xs text-muted-foreground">{match.awayTeam.name}</span>
              <span className="text-4xl font-bold text-foreground">{prediction.awayScore}</span>
            </div>
          </div>
          <p className="text-xs text-muted-foreground text-center">
            Jogo: {dateStr} às {timeStr}
          </p>
        </div>
      )}

      {/* CTA — voltar para jogos */}
      <Link href="/matches"
        className="inline-flex items-center justify-center gap-2 w-full min-h-[44px] rounded-lg border border-border bg-background hover:bg-muted
          text-sm font-medium text-foreground transition-colors duration-150
          focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2">
        <ArrowLeft size={16} aria-hidden="true" />
        Voltar para Jogos
      </Link>

    </div>
  );
}
```

**Decisões:**
- Ícone `Lock` (Lucide) — semântica visual de bloqueio.
- `prediction` é opcional — se o usuário não palpitou antes do lock, exibe só a mensagem.
- Sem campos editáveis — nenhum form, nenhum stepper.
- Data/hora do jogo exibida para contexto (PRD04-05).

---

### 5.7 `src/features/predictions/components/PredictionSuccess.tsx`

Estado de confirmação. Ref: `PRD04-06`. Usa `aria-live="polite"` para anunciar ao screen reader.

```ts
export interface PredictionSuccessProps {
  match: MatchDetailItem;
  homeScore: number;
  awayScore: number;
}
```

```tsx
export function PredictionSuccess({ match, homeScore, awayScore }: PredictionSuccessProps) {
  return (
    <div
      role="status"
      aria-live="polite"
      aria-label="Palpite salvo com sucesso"
      className="flex flex-col gap-6 px-4 py-4 pb-20 max-w-2xl mx-auto md:pb-4"
    >

      {/* Ícone + título */}
      <div className="flex flex-col items-center gap-3 py-8 text-center">
        <div className="rounded-full bg-green-500/10 p-4">
          <CheckCircle2
            size={48}
            aria-hidden="true"
            className="text-green-600 dark:text-green-400"
          />
        </div>
        <h1 className="text-xl font-bold text-foreground">Palpite registrado!</h1>
        <p className="text-sm text-muted-foreground">
          Seu palpite foi salvo com sucesso.
        </p>
      </div>

      {/* Header do jogo */}
      <MatchHeader match={match} />

      {/* Palpite registrado */}
      <div className="rounded-xl border border-border bg-card shadow-sm p-4 flex flex-col gap-2">
        <span className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
          Seu palpite
        </span>
        <div className="flex items-center justify-around gap-4">
          <div className="flex flex-col items-center gap-1">
            <span className="text-xs text-muted-foreground">{match.homeTeam.name}</span>
            <span className="text-4xl font-bold text-foreground">{homeScore}</span>
          </div>
          <span className="text-xl font-bold text-muted-foreground" aria-label="por">×</span>
          <div className="flex flex-col items-center gap-1">
            <span className="text-xs text-muted-foreground">{match.awayTeam.name}</span>
            <span className="text-4xl font-bold text-foreground">{awayScore}</span>
          </div>
        </div>
      </div>

      {/* CTA — Voltar para Jogos */}
      <Link
        href="/matches"
        className="inline-flex items-center justify-center gap-2 w-full min-h-[44px] rounded-lg bg-primary text-primary-foreground
          hover:bg-primary/90 transition-colors duration-150
          text-sm font-medium
          focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
      >
        Voltar para Jogos
      </Link>

    </div>
  );
}
```

**Decisões:**
- `role="status" aria-live="polite"` no container — garante que o screen reader anuncie
  a transição para este estado sem comportamento agressivo (`assertive`).
- `CheckCircle2` (Lucide) + verde semântico (`text-green-600 dark:text-green-400`) —
  sinal universal de sucesso; verde não é um token do design system (MASTER §2.4 lista como
  token futuro `--color-win`). Usar `text-green-600` que já existe no Tailwind e tem contraste
  adequado sobre fundo claro.
- Botão "Voltar para Jogos" usa `bg-primary` (CTA primário) conforme design system.
- **Não há pontuação "3/1/0"** — decisão A6 do PRD.

---

### 5.8 `src/features/predictions/components/index.ts`

```ts
export { PredictionForm } from "./PredictionForm";
export { PredictionLockedState } from "./PredictionLockedState";
export { PredictionSuccess } from "./PredictionSuccess";
export { ScoreInput } from "./ScoreInput";
```

`MatchHeader` é subcomponente interno de `PredictionForm.tsx` — não exportado pelo barrel.

---

## 6. Contrato de imports

### `PredictionForm.tsx`
```ts
"use client";
import { useState, useEffect } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import Link from "next/link";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { ArrowLeft, Calendar, MapPin } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Form, FormControl, FormField, FormItem, FormMessage } from "@/components/ui/form";
import { useAuth } from "@/hooks/useAuth";
import { useMatchDetail } from "@/features/matches/hooks/useMatchDetail";
import { isPredictionLocked } from "@/features/predictions/lib";
import { usePredictions, useUpsertPrediction } from "@/features/predictions/hooks";
import { predictionFormSchema, type PredictionFormValues } from "@/schemas/predictions";
import type { MatchDetailItem } from "@/features/matches/hooks/useMatchDetail";
import { PredictionLockedState } from "./PredictionLockedState";
import { PredictionSuccess } from "./PredictionSuccess";
import { ScoreInput } from "./ScoreInput";
```

### `PredictionLockedState.tsx` / `PredictionSuccess.tsx`
```ts
"use client";
import Link from "next/link";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { ArrowLeft, Lock, CheckCircle2 } from "lucide-react";
import type { MatchDetailItem } from "@/features/matches/hooks/useMatchDetail";
import type { Prediction } from "@/types";
```

**Proibições:**
- Sem `import ... from "@/firebase/admin"` — arquivos client.
- Sem estilos inline `style={{}}`.
- Sem valores hexadecimais — apenas tokens Tailwind.
- Sem `any`.

---

## 7. Estados e transições

```
Rota /matches/[id]/predict carrega
  └── isLoading → <PredictionFormSkeleton />
  └── isError   → <MatchLoadError onRetry />
  └── match === null → <MatchNotFoundState />  (404)
  └── isPredictionLocked(match, now) === true → <PredictionLockedState match prediction? />
  └── formState === "form" → <PredictionFormContent />  (create | edit)
        └── submit com sucesso → setFormState("success") → <PredictionSuccess />
        └── submit com erro → toast.error via useUpsertPrediction.onError (automático)
  └── formState === "success" → <PredictionSuccess />
```

**Re-avaliação de lock durante a sessão:**
O lock é derivado de `isPredictionLocked(match, new Date())` no render. Se o usuário
mantiver a página aberta até o kickoff, o próximo re-render (ex.: foco de volta à aba)
detectará o lock. Não há polling ativo — aceitável dado o contexto (< 100 usuários).

---

## 8. Acessibilidade — checklist obrigatório (nível crítico)

| Requisito | Implementação |
|---|---|
| Steppers touch ≥ 44×44px | `min-h-[44px] min-w-[44px]` em cada botão −/+ |
| Grupo de stepper | `role="group" aria-label="Gols Mandante"` |
| Anúncio de valor | `<output aria-live="polite">` |
| Botões com label | `aria-label="Diminuir Gols Mandante"`, `aria-label="Aumentar Gols Mandante"` |
| Estado desabilitado | `disabled` + `aria-disabled="true"` nos botões no lock |
| Confirmação de sucesso | `role="status" aria-live="polite"` no container de `PredictionSuccess` |
| Focus ring | `focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2` |
| `aria-busy` no submit | `aria-busy={mutation.isPending}` no botão |
| Ícones decorativos | `aria-hidden="true"` em todos os ícones Lucide |
| Links com label | `aria-label="Voltar para detalhes do jogo"` no link de volta |
| Hierarquia de heading | `<h1>` único por estado — "Enviar Palpite" / "Editar Palpite" / "Palpite bloqueado" / "Palpite registrado!" |
| Reduced motion | `motion-reduce:animate-none` em transições |

---

## 9. Critérios de aceitação

- [ ] Rota `/matches/[id]/predict` existe e renderiza sem erro de compilação TypeScript.
- [ ] State loading mostra skeleton; state error mostra botão "Tentar novamente".
- [ ] State 404 (match === null) mostra "Jogo não encontrado" com link de volta.
- [ ] `isPredictionLocked(match, new Date()) === true` renderiza `PredictionLockedState`.
- [ ] `PredictionLockedState` exibe "O prazo para este jogo foi encerrado.".
- [ ] `PredictionLockedState` exibe o palpite (homeScore × awayScore) se existir.
- [ ] `PredictionLockedState` exibe data/hora do jogo.
- [ ] Form ativo em modo create: título "Enviar Palpite", botão "Salvar palpite".
- [ ] Form ativo em modo edit: título "Editar Palpite", botão "Atualizar palpite", steppers pré-preenchidos.
- [ ] Pré-preenchimento funciona: `useEffect` com `form.reset` ao carregar `existingPrediction`.
- [ ] Steppers incrementam/decrementam corretamente; não vão abaixo de 0.
- [ ] Botões −/+ têm `min-h-[44px] min-w-[44px]` (touch 44px).
- [ ] Submit chama `mutation.mutateAsync({ matchId, homeScore, awayScore })`.
- [ ] Submit com sucesso → renderiza `PredictionSuccess`.
- [ ] Submit com erro → toast.error exibido (via `useUpsertPrediction.onError`).
- [ ] `PredictionSuccess` exibe "Seu palpite foi salvo com sucesso.".
- [ ] `PredictionSuccess` exibe o placar: `{homeTeam.name} X x Y {awayTeam.name}`.
- [ ] `PredictionSuccess` tem `role="status" aria-live="polite"`.
- [ ] `PredictionSuccess` tem botão "Voltar para Jogos" → `/matches`.
- [ ] **Nenhuma** menção a "3/1/0" ou pontuação parcial nas telas.
- [ ] Sem `any` introduzido.
- [ ] `rtk tsc` sem erros após implementação.
- [ ] Sem `style={{}}` — apenas Tailwind.
- [ ] Sem valores hexadecimais em classes.

---

## 10. Estrutura de arquivos resultante

```
src/
├── app/
│   └── (app)/
│       └── matches/
│           └── [id]/
│               └── predict/
│                   └── page.tsx              # CRIAR — Server Component
├── schemas/
│   └── predictions.ts                        # MODIFICAR — adicionar predictionFormSchema
└── features/
    └── predictions/
        ├── index.ts                          # não toca (re-exporta ./lib)
        ├── lib/                              # não toca (TASK-02)
        ├── hooks/                            # não toca (TASK-06)
        └── components/
            ├── index.ts                      # CRIAR — barrel
            ├── ScoreInput.tsx                # CRIAR — stepper acessível
            ├── PredictionForm.tsx            # CRIAR — componente principal
            ├── PredictionLockedState.tsx     # CRIAR — estado bloqueado
            └── PredictionSuccess.tsx         # CRIAR — estado de sucesso
```

---

## 11. O que esta tarefa NÃO faz

- Não modifica `useUpsertPrediction`, `usePredictions` — TASK-06.
- Não modifica o detalhe do jogo (CTA wiring) — TASK-09.
- Não cria a lista de palpites `/predictions` — TASK-08.
- Não cria testes automáticos — `/test` separado.
- Não cria nem modifica Security Rules — TASK-05.
- Não altera `MatchDetailActions.tsx` para linkar ao predict — TASK-09.
- Não exibe pontuação "3/1/0" — removido por decisão A6 do PRD.
