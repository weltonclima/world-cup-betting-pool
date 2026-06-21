---
phase: web-push-pwa-task-06
reviewed: 2026-06-20T00:00:00Z
depth: deep
files_reviewed: 6
files_reviewed_list:
  - src/features/push/platform.ts
  - src/features/push/registration.ts
  - src/features/push/hooks/useInstallPrompt.ts
  - src/features/push/components/IosInstallGuide.tsx
  - src/features/push/components/InstallPrompt.tsx
  - src/app/(app)/layout.tsx
findings:
  critical: 0
  warning: 4
  info: 4
  total: 8
status: issues_found
---

# web-push-pwa TASK-06: Code Review Report

**Reviewed:** 2026-06-20
**Depth:** deep
**Files Reviewed:** 6
**Status:** issues_found

## Summary

The PWA install UX is solid on the highest-risk axes: SSR/hydration safety is
correct (all platform reads deferred to `useEffect`, initial render is `null`
on both server and first client paint, so no hydration mismatch), the iOS
notification-permission gate is intact (`InstallPrompt`/`IosInstallGuide`
never call `requestPushToken`/`Notification.requestPermission`; the gate lives
only in `registration.canRequestPush`), and best-effort discipline holds
(localStorage and the prompt are wrapped in try/catch; nothing thrown here can
break navigation).

No blockers found. The defects are correctness/robustness gaps: the
`appinstalled` event does not hide the iOS variant of the banner, the
`isStandalone` SSR guard checks the wrong global, `setBusy(false)` can fire
after unmount, and a couple of UX/consistency issues. None are security or
data-loss risks.

## Warnings

### WR-01: `appinstalled` does not hide the iOS banner

**File:** `src/features/push/hooks/useInstallPrompt.ts:73-77`, `src/features/push/components/InstallPrompt.tsx:42`
**Issue:** The `appinstalled` handler only resets `canInstallAndroid`:
```ts
const onInstalled = (): void => {
  promptEventRef.current = null;
  setCanInstallAndroid(false);
};
```
But on iOS the banner is gated by `showIos = isIos` (InstallPrompt.tsx:42),
which is derived from `isIos()` and never reacts to install. After an install
the banner stays visible for the rest of the session until a full reload makes
`isStandalone()` true. On Android this is fine (CTA hidden); on iOS the banner
lingers. Functionally low-impact (iOS install opens a separate standalone
context so the source tab rarely sees post-install state), but it is a real
state-tracking gap and contradicts the comment "Instalou (por qualquer
caminho): esconde o CTA".
**Fix:** Track an `installed` flag and gate both variants on it:
```ts
const [installed, setInstalled] = useState(false);
const onInstalled = (): void => {
  promptEventRef.current = null;
  setCanInstallAndroid(false);
  setInstalled(true);
};
// expose `installed`; in InstallPrompt: if (isStandalone || dismissed || installed) return null;
```

### WR-02: `isStandalone` reads `navigator` but guards only `window`

**File:** `src/features/push/platform.ts:23-31`
**Issue:** The SSR guard returns early on `typeof window === "undefined"`, then
dereferences `navigator` on line 26:
```ts
export function isStandalone(): boolean {
  if (typeof window === "undefined") return false;
  const iosStandalone =
    (navigator as Navigator & { standalone?: boolean }).standalone === true;
  ...
```
`isIos()` (line 11) correctly guards on `navigator`, so the two helpers use
inconsistent guards. In a normal browser `navigator` always coexists with
`window`, so this won't throw in practice — but the asymmetry is a latent
hazard in any non-standard runtime (some SSR/edge/worker shims define `window`
without `navigator`). Since the whole module is "best-effort, guard-SSR" by its
own docstring, the guard should match the global it actually touches.
**Fix:** Guard on `navigator` as well:
```ts
if (typeof window === "undefined" || typeof navigator === "undefined") return false;
```

### WR-03: `setBusy(false)` can run after unmount

**File:** `src/features/push/components/InstallPrompt.tsx:46-55`
**Issue:** `handleAndroidInstall` awaits `promptInstall()` (which awaits the
user's native choice — arbitrarily long) and then calls `setBusy(false)` in a
`finally`. The native prompt also fires `appinstalled`, which sets
`canInstallAndroid=false`; on the next render `showAndroid` becomes false and
the component returns `null` (unmounts) before the awaited promise resolves.
The trailing `setBusy(false)` then runs on an unmounted component. React no
longer throws on this, but it is a state-update-after-unmount that some test
setups and strict configs flag, and indicates the lifecycle wasn't reasoned
through.
**Fix:** Guard with a mounted ref, or rely on the hook clearing the CTA and
drop the local `busy` reset on the unmount path:
```ts
const mounted = useRef(true);
useEffect(() => () => { mounted.current = false; }, []);
// ...
} finally {
  if (mounted.current) setBusy(false);
}
```

### WR-04: Dismissal persists forever with no expiry

**File:** `src/features/push/hooks/useInstallPrompt.ts:40,104-113`
**Issue:** `dismiss()` writes `"1"` permanently and `readDismissed()` treats any
`"1"` as a hard, eternal opt-out. A single accidental tap on the X button
suppresses the install affordance for that browser forever, which is a
self-inflicted loss of the feature's reach. PWA install banners conventionally
re-surface after a cooldown (e.g. store a timestamp and re-show after N days).
**Fix:** Persist a timestamp instead of a flag and compare against a TTL on
read:
```ts
function readDismissed(): boolean {
  try {
    const ts = Number(window.localStorage.getItem(INSTALL_DISMISSED_KEY));
    return Number.isFinite(ts) && Date.now() - ts < 30 * 24 * 60 * 60 * 1000;
  } catch { return false; }
}
// dismiss(): localStorage.setItem(KEY, String(Date.now()))
```
If a permanent dismissal is the intended product decision, document it
explicitly — currently the eternal lifetime is implicit.

## Info

### IN-01: `<ol>` list items keyed by array index

**File:** `src/features/push/components/IosInstallGuide.tsx:52`
**Issue:** `key={index}` on the steps list. The `STEPS` array is a static
module-level constant that is never reordered or filtered, so this is harmless
today, but index keys are an anti-pattern flagged by most lint configs.
**Fix:** Key by a stable field, e.g. `key={step.label}`.

### IN-02: iOS guide hard-codes Safari, shown for all iOS browsers

**File:** `src/features/push/components/IosInstallGuide.tsx:25,45`, `src/features/push/platform.ts:10-20`
**Issue:** `isIos()` is true for any iOS browser (Chrome/Firefox/Edge on iOS are
all WebKit and match the UA test), but the tutorial copy assumes Safari ("barra
do Safari", "Em 3 passos no Safari"). On iOS, only Safari can add to the home
screen, so a user in iOS Chrome gets instructions they cannot follow.
**Fix:** Either detect Safari specifically before showing the actionable
tutorial, or soften the copy to instruct the user to open the page in Safari
first.

### IN-03: `aria-label="Instalar aplicativo"` region wraps a dismiss control with a generic label

**File:** `src/features/push/components/InstallPrompt.tsx:60-61,102-110`
**Issue:** Minor accessibility nuance — the dismiss button's `aria-label` is
just "Dispensar" with no association to what is being dismissed. Within the
labeled region it is acceptable, but "Dispensar instalação" would be clearer
for screen-reader users navigating by control.
**Fix:** `aria-label="Dispensar instalação do aplicativo"`.

### IN-04: `BeforeInstallPromptEvent.prompt` typed as `Promise<void>`

**File:** `src/features/push/hooks/useInstallPrompt.ts:15`
**Issue:** Per the spec, `prompt()` resolves to a value
(`{ outcome, platform }`) in current Chromium and the local type declares
`Promise<void>`. The code only awaits it for sequencing and reads `outcome`
from `userChoice` instead, so behavior is correct — but the type understates
the real API.
**Fix:** Optional: `prompt: () => Promise<{ outcome: "accepted" | "dismissed" }>`
or leave a comment that only `userChoice` is consumed.

---

_Reviewed: 2026-06-20_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: deep_
