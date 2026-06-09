# Next.js UI Patterns (App Router)

## Component Architecture

### Server vs Client Components

Default: Server Component (no 'use client')
Client: Add 'use client' at top

Rule: Keep server by default, add client only when needed

| Need | Component Type | Why |
|------|---------------|-----|
| Static content | Server | Zero JS |
| Data fetch | Server | Direct DB/API |
| Metadata/SEO | Server | SSR required |
| useState/useEffect | Client | React hooks |
| onClick/onChange | Client | Event handlers |
| Browser APIs | Client | window/document |
| Third-party with hooks | Client | Library requirement |

### Component Hierarchy
```
app/
  checkout/
    └── page.tsx (Server - data fetch)
        ├── CheckoutContent.tsx (Server - layout)
        ├── OrderSummary.tsx (Server - display)
        ├── CheckoutForm.tsx (Client - interaction)
        └── SubmitButton.tsx (Client - loading state)
```

## Data Fetching Patterns

### Server Component Fetch
```tsx
// app/checkout/page.tsx (Server Component)
async function CheckoutPage() {
  const order = await getOrder(); // Direct fetch, no useEffect
  return <CheckoutContent order={order} />;
}
```

### Client Component with Server Action
```tsx
'use client';

import { submitOrder } from './actions';

function CheckoutForm() {
  const [isPending, startTransition] = useTransition();

  return (
    <form action={(formData) => startTransition(() =>
      submitOrder(formData))}>
      <SubmitButton loading={isPending} />
    </form>
  );
}
```

### Server Actions
```tsx
// app/checkout/actions.ts
'use server';

export async function submitOrder(formData: FormData) {
  const result = await db.order.create({...});
  revalidatePath('/checkout');
  redirect('/confirmation');
}
```

## Layout Patterns

### Nested Layouts
```
app/
  ├── layout.tsx      # Root (nav, footer)
  ├── (shop)/
      └── layout.tsx    # Shop layout (sidebar)
      └── checkout/
          └── layout.tsx  # Checkout layout (progress bar)
          └── page.tsx
```

### Parallel Routes (Split Views)
```
app/
  └── @modal/
      └── (.)product/[id]/page.tsx  # Intercepted modal
  product/[id]/page.tsx             # Full page
```

## Loading & Error States

### Loading UI
```tsx
// app/checkout/loading.tsx
export default function Loading() {
  return <CheckoutSkeleton />;
}
```

### Error Boundary
```tsx
// app/checkout/error.tsx
'use client';

export default function Error({ error, reset }: {
  error: Error;
  reset: () => void
}) {
  return (
    <div>
      <p>Something went wrong</p>
      <button onClick={reset}>Try again</button>
    </div>
  );
};
```

### Suspense Boundaries
```tsx
<Suspense fallback={<ProductsSkeleton />}>
  <Products />
</Suspense>
```

## Optimization Patterns

### Image Optimization
```tsx
import Image from 'next/image';

<Image
  src={product.image}
  alt={product.name}
  width={400}
  height={300}
  placeholder="blur"
  blurDataURL={product.blurHash}
  priority={isAboveFold}
/>
```

### Font Optimization
```tsx
// app/layout.tsx
import { Inter } from 'next/font/google';

const inter = Inter({ subsets: ['latin'] });

export default function RootLayout({ children }) {
  return (
    <html className={inter.className}>
      <body>{children}</body>
    </html>
  );
}
```

### Link Prefetching
```tsx
import Link from 'next/link';

<Link href="/product/123" prefetch={true}>
  View Product
</Link>
```

## State Management

### URL State (Preferred for Server)
```tsx
// Use searchParams for filterable/shareable state
// app/products/page.tsx
export default function Products({ searchParams }: {
  searchParams: { sort?: string; filter?: string }
}) {
  const products = await getProducts(searchParams);
}
```

### Client State (When Needed)
```tsx
'use client';

// Simple: useState
const [isOpen, setIsOpen] = useState(false);

// Complex: Zustand/Jotai (not Redux)
import { useCartStore } from '@/stores/cart';
const { items, addItem } = useCartStore();
```

## Responsive Patterns

### CSS Modules + Tailwind
```tsx
// Tailwind breakpoints
<div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3">

// CSS Modules for complex
import styles from './ProductGrid.module.css';
<div className={styles.grid}>
```

### Container Queries (Modern)
```css
.card-container {
  container-type: inline-size;
}

@container (min-width: 400px) {
  .card { flex-direction: row; }
}
```

## Accessibility Patterns

### Focus Management
```tsx
'use client';

import { useEffect, useRef } from 'react';

function Modal({ isOpen }) {
  const closeRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (isOpen) closeRef.current?.focus();
  }, [isOpen]);
}
```

### ARIA for Dynamic Content
```tsx
<div
  role="status"
  aria-live="polite"
  aria-atomic="true"
>
  {cartCount} items in cart
</div>
```

## Animation Patterns

### CSS Transitions (Simple)
```tsx
<button className="transition-colors duration-200 hover:bg-blue-600">
```

### Framer Motion (Complex)
```tsx
'use client';

import { motion, AnimatePresence } from 'framer-motion';

<AnimatePresence>
  {isVisible && (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -20 }}
    />
  )}
</AnimatePresence>
```

### View Transitions (Experimental)
```tsx
'use client';

import { useRouter } from 'next/navigation';

function navigate() {
  document.startViewTransition(() => {
    router.push('/next-page');
  });
}
```

## File Structure Convention

```
app/
  (marketing)/          # Route group (no URL segment)
    ├── page.tsx        # Home
    └── about/page.tsx
  (shop)/
    └── layout.tsx      # Shared shop layout
    └── products/
        └── page.tsx
        └── [id]/page.tsx
    └── checkout/
        ├── page.tsx
        ├── loading.tsx
        ├── error.tsx
        └── actions.ts
  api/                  # API Routes (if needed)
  components/           # Shared components
  ├── ui/               # Design system
  └── features/         # Feature-specific
```

## Common Gotchas

| Issue | Solution |
|-------|----------|
| Hydration mismatch | Ensure server/client render same |
| useEffect on server | Add 'use client' directive |
| Can't use hooks in server | Split into client component |
| Stale data after mutation | Use `revalidatePath()` or `revalidateTag()` |
| Large client bundle | Keep more components server |
| Flash of unstyled | Use `next/font` for fonts |
| SEO missing | Add `metadata` export to page |
