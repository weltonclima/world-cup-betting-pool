# React UI Patterns

## Component Architecture

### Component Types
| Type | When | Example |
|------|------|---------|
| Presentational | Display only, no state | `<ProductCard product={p} />` |
| Container | State + logic, renders presentational | `<ProductListContainer />` |
| Compound | Related components that share state | `<Tabs><Tab /><TabPanel /></Tabs>` |
| HOC | Cross-cutting concerns | `withAuth(Component)` |
| Render Props | Flexible rendering | `<Mouse render={({x,y}) => ...} />` |

### Component Hierarchy
```
App
└── Layout
    └── ProductPage (container - fetches data)
        ├── ProductHeader (presentational)
        ├── ProductGallery (stateful - local UI state)
        └── AddToCartButton (stateful - async action)
```

## Hooks Patterns

### Custom Hook for Data
```tsx
function useProduct(id: string) {
  const [product, setProduct] = useState<Product | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    let cancelled = false;

    fetchProduct(id)
      .then(data => !cancelled && setProduct(data))
      .catch(err => !cancelled && setError(err))
      .finally(() => !cancelled && setLoading(false));

    return () => { cancelled = true; };
  }, [id]);

  return { product, loading, error };
}
```

### Custom Hook for Actions
```tsx
function useAddToCart() {
  const [state, setState] = useState<'idle' | 'loading' | 'success' | 'error'>('idle');

  const addToCart = useCallback(async (productId: string, quantity: number) => {
    setState('loading');
    try {
      await cartApi.add(productId, quantity);
      setState('success');
    } catch {
      setState('error');
    }
  }, []);

  const reset = useCallback(() => setState('idle'), []);

  return { addToCart, state, reset };
}
```

### useMemo / useCallback Rules
```tsx
// useMemo: expensive computation
const sortedItems = useMemo(
  () => items.sort((a, b) => a.price - b.price),
  [items]
);

// useCallback: stable function reference for child props
const handleClick = useCallback(() => {
  doSomething(id);
}, [id]);

// DON'T: memoize primitives or simple operations
const doubled = useMemo(() => count * 2, [count]); // Unnecessary
```

## State Management Patterns

### Local State (useState)
```tsx
// Simple toggle, form input, UI state
const [isOpen, setIsOpen] = useState(false);
```

### Lifted State
```tsx
// Parent owns state, children receive via props
function Parent() {
  const [selected, setSelected] = useState<string | null>(null);
  return (
    <>
      <List items={items} selected={selected} onSelect={setSelected} />
      <Details itemId={selected} />
    </>
  );
}
```

### Context (Theme, Auth, i18n)
```tsx
// Create
const ThemeContext = createContext<Theme>('light');

// Provider
<ThemeContext.Provider value={theme}>
  {children}
</ThemeContext.Provider>

// Consume
const theme = useContext(ThemeContext);
```

### Reducer (Complex Local State)
```tsx
type State = { count: number; step: number };
type Action =
  | { type: 'increment' }
  | { type: 'decrement' }
  | { type: 'setStep'; payload: number };

function reducer(state: State, action: Action): State {
  switch (action.type) {
    case 'increment': return { ...state, count: state.count + state.step };
    case 'decrement': return { ...state, count: state.count - state.step };
    case 'setStep': return { ...state, step: action.payload };
  }
}

const [state, dispatch] = useReducer(reducer, { count: 0, step: 1 });
```

### External Store (Zustand - Recommended)
```tsx
// store.ts
import { create } from 'zustand';

interface CartStore {
  items: CartItem[];
  addItem: (item: CartItem) => void;
  removeItem: (id: string) => void;
  total: () => number;
}

export const useCartStore = create<CartStore>((set, get) => ({
  items: [],
  addItem: (item) => set((state) => ({ items: [...state.items, item] })),
  removeItem: (id) => set((state) => ({ items: state.items.filter(i => i.id !== id) })),
  total: () => get().items.reduce((sum, i) => sum + i.price, 0),
}));

// Component
const { items, addItem } = useCartStore();
```

## Composition Patterns

### Compound Components
```tsx
// Usage
<Select value={value} onChange={setValue}>
  <Select.Trigger>Choose option</Select.Trigger>
  <Select.Options>
    <Select.Option value="a">Option A</Select.Option>
    <Select.Option value="b">Option B</Select.Option>
  </Select.Options>
</Select>

// Implementation uses Context internally
const SelectContext = createContext<SelectContextValue>(null);

function Select({ children, value, onChange }) {
  return (
    <SelectContext.Provider value={{ value, onChange }}>
      {children}
    </SelectContext.Provider>
  );
}

Select.Trigger = function Trigger({ children }) { ... };
Select.Options = function Options({ children }) { ... };
Select.Option = function Option({ value, children }) { ... };
```

### Render Props
```tsx
// Flexible rendering control
<DataFetcher url="/api/products">
  {({ data, loading, error }) => {
    if (loading) return <Skeleton />;
    if (error) return <Error message={error} />;
    return <ProductList products={data} />;
  }}
</DataFetcher>
```

### Slots Pattern
```tsx
interface CardProps {
  header?: ReactNode;
  children: ReactNode;
  footer?: ReactNode;
}

function Card({ header, children, footer }: CardProps) {
  return (
    <div className="card">
      {header && <div className="card-header">{header}</div>}
      <div className="card-body">{children}</div>
      {footer && <div className="card-footer">{footer}</div>}
    </div>
  );
}
```

## Form Patterns

### Controlled Input
```tsx
const [email, setEmail] = useState('');

<input
  type="email"
  value={email}
  onChange={(e) => setEmail(e.target.value)}
/>
```

### Form Library (React Hook Form)
```tsx
import { useForm } from 'react-hook-form';

function CheckoutForm() {
  const { register, handleSubmit, formState: { errors } } =
    useForm<FormData>();

  const onSubmit = (data: FormData) => {
    // Handle submission
  };

  return (
    <form onSubmit={handleSubmit(onSubmit)}>
      <input {...register('email', { required: true })} />
      {errors.email && <span>Email required</span>}
      <button type="submit">Submit</button>
    </form>
  );
}
```

## Performance Patterns

### Prevent Unnecessary Renders
```tsx
// Memoize component
const ProductCard = memo(function ProductCard({ product }: Props) {
  return <div>{product.name}</div>;
});

// Memoize expensive child
const ExpensiveChart = memo(Chart);
<ExpensiveChart data={data} />
```

### Virtualized Lists
```tsx
import { useVirtualizer } from '@tanstack/react-virtual';

function VirtualList({ items }) {
  const parentRef = useRef<HTMLDivElement>(null);

  const virtualizer = useVirtualizer({
    count: items.length,
    getScrollElement: () => parentRef.current,
    estimateSize: () => 50,
  });

  return (
    <div ref={parentRef} style={{ height: 400, overflow: 'auto' }}>
      <div style={{ height: virtualizer.getTotalSize() }}>
        {virtualizer.getVirtualItems().map((virtualItem) => (
          <div key={virtualItem.key} style={{
            position: 'absolute',
            top: virtualItem.start,
            height: virtualItem.size,
          }}>
            {items[virtualItem.index].name}
          </div>
        ))}
      </div>
    </div>
  );
}
```

### Code Splitting
```tsx
const HeavyComponent = lazy(() => import('./HeavyComponent'));

<Suspense fallback={<Skeleton />}>
  <HeavyComponent />
</Suspense>
```

## Accessibility Patterns

### Focus Management
```tsx
const inputRef = useRef<HTMLInputElement>(null);

useEffect(() => {
  if (isOpen) inputRef.current?.focus();
}, [isOpen]);
```

### Keyboard Navigation
```tsx
function handleKeyDown(e: KeyboardEvent) {
  switch (e.key) {
    case 'ArrowDown':
      e.preventDefault();
      setFocusedIndex(i => Math.min(i + 1, items.length - 1));
      break;
    case 'ArrowUp':
      e.preventDefault();
      setFocusedIndex(i => Math.max(i - 1, 0));
      break;
    case 'Enter':
      selectItem(focusedIndex);
      break;
  }
}
```

### ARIA Attributes
```tsx
<button
  aria-expanded={isOpen}
  aria-controls="dropdown-menu"
  aria-haspopup="listbox"
>
  {selectedOption}
</button>
<ul id="dropdown-menu" role="listbox" aria-label="Options">
  {options.map(opt => (
    <li key={opt.id} role="option" aria-selected={opt.id === selected}>
      {opt.label}
    </li>
  ))}
</ul>
```

## File Structure Convention

```
src/
├── components/
│   ├── ui/                    # Design system primitives
│   │   ├── Button/
│   │   │   ├── Button.tsx
│   │   │   ├── Button.test.tsx
│   │   │   └── index.ts
│   │   └── Input/
│   └── features/              # Feature-specific
│       └── checkout/
│           ├── CheckoutForm.tsx
│           └── OrderSummary.tsx
├── hooks/
│   ├── useProduct.ts
│   └── useCart.ts
├── stores/                    # Global state
│   └── cart.ts
├── pages/                     # Page components (if not using framework)
└── utils/                     # Pure functions
```

## Common Gotchas

| Issue | Solution |
|-------|----------|
| Stale closure | Add dependency to useEffect/useCallback |
| Infinite loop | Check useEffect dependencies |
| Memory leak | Cleanup in useEffect return |
| Props drilling | Use Context or Zustand |
| Slow list | Use virtualization |
| Flash of loading | Add Suspense with fallback |
| Hydration error | Ensure SSR/CSR render same |
