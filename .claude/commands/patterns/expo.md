# Expo UI Patterns

Expo *is* React Native — `patterns/react-native.md` still applies for
core component, list, layout, state, animation, and accessibility
patterns. This file adds the **Expo-specific** layer: Expo Router,
NativeWind, Expo Modules, EAS, and the Expo SDK. Prefer the Expo
primitive over the bare-RN one when both exist.

## Skill & MCP references (use these, don't reinvent)

| Need | Use |
|------|-----|
| Build native UI / Expo Router | `expo:building-native-ui` |
| Data fetching (fetch/React Query/loaders) | `expo:native-data-fetching` |
| Tailwind / NativeWind styling | `expo:expo-tailwind-setup` |
| Native module (Swift/Kotlin) | `expo:expo-module` |
| `@expo/ui` SwiftUI / Compose views | `expo:expo-ui-swift-ui`, `expo:expo-ui-jetpack-compose` |
| Dev client | `expo:expo-dev-client` |
| Store/web deployment | `expo:expo-deployment` |
| EAS CI/CD workflows | `expo:expo-cicd-workflows` |
| API routes (server) | `expo:expo-api-routes` |
| SDK upgrade | `expo:upgrading-expo` |
| Update health / rollout | `expo:eas-update-insights` |
| Startup/perf metrics | `expo:expo-observe` |
| Builds / submit / workflows | Expo MCP: `build_*`, `workflow_*`, `build_submit` |
| TestFlight crashes / feedback | Expo MCP: `testflight_crashes`, `testflight_feedback` |
| Current Expo docs | Expo MCP: `read_documentation` (or context7) |

## Navigation — Expo Router (file-based)

Prefer **Expo Router** over hand-wired React Navigation. Routes are
files under `app/`; layouts are `_layout.tsx`.

### Route tree
```
app/
  _layout.tsx          # root stack
  (tabs)/
    _layout.tsx        # tab bar
    index.tsx          # /            (Home)
    cart.tsx           # /cart
  product/[id].tsx     # /product/:id (dynamic)
  +not-found.tsx       # 404
```

### Root layout
```tsx
// app/_layout.tsx
import { Stack } from 'expo-router';

export default function RootLayout() {
  return (
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Screen name="(tabs)" />
      <Stack.Screen name="product/[id]" options={{ presentation: 'modal' }} />
    </Stack>
  );
}
```

### Tabs layout
```tsx
// app/(tabs)/_layout.tsx
import { Tabs } from 'expo-router';

export default function TabsLayout() {
  return (
    <Tabs screenOptions={{ tabBarActiveTintColor: '#2563eb' }}>
      <Tabs.Screen
        name="index"
        options={{ title: 'Home', tabBarIcon: ({ color }) => <HomeIcon color={color} /> }}
      />
      <Tabs.Screen name="cart" options={{ title: 'Cart' }} />
    </Tabs>
  );
}
```

### Typed navigation + params
```tsx
import { Link, router, useLocalSearchParams } from 'expo-router';

// Declarative
<Link href={{ pathname: '/product/[id]', params: { id: '123' } }}>Open</Link>

// Imperative
router.push({ pathname: '/product/[id]', params: { id: '123' } });

// Receiving params (typed routes: enable in app.json experiments.typedRoutes)
const { id } = useLocalSearchParams<{ id: string }>();
```

### Native tabs (SDK 54+)
For a truly native tab bar, prefer `expo-router/native-tabs` — see
`expo:building-native-ui`.

## Data fetching — route loaders

Prefer route loaders where the project uses them; otherwise React
Query (see `patterns/react-native.md` for the Query patterns).

```tsx
// app/product/[id].tsx
import { useLoaderData } from 'expo-router';

export async function loader({ params }: { params: { id: string } }) {
  const res = await fetch(`${process.env.EXPO_PUBLIC_API_URL}/products/${params.id}`);
  if (!res.ok) throw new Error('Failed to load product');
  return res.json();
}

export default function ProductScreen() {
  const product = useLoaderData<typeof loader>();
  return <ProductView product={product} />;
}
```

## Styling — NativeWind (Tailwind)

When the project uses NativeWind (see `expo:expo-tailwind-setup`),
prefer `className` over `StyleSheet`.

```tsx
import { View, Text, Pressable } from 'react-native';

export function PriceTag({ price, onBuy }: { price: number; onBuy: () => void }) {
  return (
    <View className="flex-row items-center justify-between rounded-2xl bg-white p-4 shadow">
      <Text className="text-lg font-semibold text-zinc-900 dark:text-zinc-50">
        ${price.toFixed(2)}
      </Text>
      <Pressable onPress={onBuy} className="rounded-xl bg-blue-600 px-4 py-2 active:opacity-80">
        <Text className="font-medium text-white">Buy</Text>
      </Pressable>
    </View>
  );
}
```
Dark mode via the `dark:` prefix; drive it with `useColorScheme()`.
If NativeWind is not set up, fall back to RN `StyleSheet`.

## Images & assets

Prefer `expo-image` over RN `Image` / FastImage (built-in caching,
blurhash placeholders).

```tsx
import { Image } from 'expo-image';

<Image
  source={{ uri: product.imageUrl }}
  placeholder={{ blurhash: product.blurhash }}
  contentFit="cover"
  transition={200}
  style={{ width: '100%', aspectRatio: 1 }}
/>
```

## Native capability — Expo Modules API

Reach for a config plugin or an Expo module **before** ejecting to
bare native. Keep native code behind the Modules API (Swift/Kotlin),
never raw bridges. See `expo:expo-module`.

```ts
// modules/haptics/index.ts — TS surface over a native module
import HapticsModule from './src/HapticsModule';
export function tap() { return HapticsModule.impact('light'); }
```

For embedding SwiftUI / Jetpack Compose views directly, use
`@expo/ui` (`expo:expo-ui-swift-ui`, `expo:expo-ui-jetpack-compose`).

## Config & environment

`app.config.ts` (dynamic) is preferred over static `app.json` when
values depend on env. Public runtime values use the `EXPO_PUBLIC_`
prefix; secrets never ship in the bundle.

```ts
// app.config.ts
import { ExpoConfig } from 'expo/config';

export default (): ExpoConfig => ({
  name: 'Acme',
  slug: 'acme',
  scheme: 'acme',                  // deep links
  plugins: ['expo-router', 'expo-secure-store'],
  experiments: { typedRoutes: true },
  extra: { apiUrl: process.env.API_URL },
});
```
```tsx
// Read public env at runtime
const api = process.env.EXPO_PUBLIC_API_URL;
// Read app config extra
import Constants from 'expo-constants';
const apiUrl = Constants.expoConfig?.extra?.apiUrl;
```
Store secrets on-device with `expo-secure-store`, not AsyncStorage.

## Build, update & release (EAS)

```bash
# Builds (or use Expo MCP build_run / build_list / build_logs)
eas build --platform ios --profile preview
eas build --platform android --profile production

# OTA: JS-only changes ship via EAS Update; native changes need a build
eas update --branch production --message "fix checkout copy"

# Store submission (or MCP build_submit)
eas submit --platform ios --latest
```

Rules:
- **JS-only** change → EAS Update (OTA). **Native** change (new dep
  with native code, config plugin, SDK bump) → new build.
- Gate every rollout on health: `expo:eas-update-insights`
  (crash rate, embedded-vs-OTA split, adoption).
- CI lives in `.eas/workflows/` — validate via MCP `workflow_validate`,
  author per `expo:expo-cicd-workflows`.

## File structure convention

```
app/                      # Expo Router routes (the navigation tree)
  _layout.tsx
  (tabs)/
  product/[id].tsx
src/
  components/
    ui/                   # design system (Button, Input, Card)
    features/             # feature-specific UI
  hooks/
  stores/                 # zustand
  services/               # api clients
  lib/                    # utils, env access
modules/                  # local Expo native modules
assets/                   # images, fonts
app.config.ts
eas.json                  # build/submit profiles
.eas/workflows/           # CI
```

## Common Gotchas

| Issue | Solution |
|-------|----------|
| OTA update didn't apply native change | Native changes require a new build, not `eas update` |
| `process.env` value is `undefined` at runtime | Prefix with `EXPO_PUBLIC_`, or read from `Constants.expoConfig.extra` |
| Deep links don't open the app | Set `scheme` in app config; check the `+not-found` route |
| Secrets shipped in bundle | Never use `EXPO_PUBLIC_` for secrets; use `expo-secure-store` |
| Added a native dep, app crashes in Expo Go | Build a dev client (`expo:expo-dev-client`); Expo Go can't load custom native code |
| Images flicker / no cache | Use `expo-image` (built-in cache + blurhash) |
| Typed routes not type-checking | Enable `experiments.typedRoutes`; rerun the dev server |
| SDK upgrade breaks deps | Use `expo install` / `expo:upgrading-expo`, never manual version bumps |
| Slow cold start | Profile with `expo:expo-observe` (TTI/TTR) before optimizing |
| Manual Xcode/Gradle build drift | Build via EAS; keep `app.config` + plugins as the source of truth |
