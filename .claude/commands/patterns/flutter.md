# Flutter UI Patterns

## Widget Architecture

### Composition Hierarchy
```
Screen (Scaffold)
└── Body (SingleChildScrollView / CustomScrollView)
    ├── Section (Container / Card)
    │   └── Content (Row / Column / Stack)
    │       └── Leaf (Text / Image / Icon)
    └── Actions (FloatingActionButton / BottomSheet)
```

### Widget Types by Purpose
| Purpose | Widget | When to Use |
|---------|--------|-------------|
| Layout | Column, Row, Stack | Arrange children |
| Scrolling | ListView.builder, CustomScrollView | Large lists |
| Sticky | SliverAppBar, SliverPersistentHeader | Scroll effects |
| Spacing | SizedBox, Padding, Spacer | Whitespace |
| Decoration | Container, DecoratedBox | Background, border |
| Interaction | GestureDetector, InkWell | Tap, swipe |
| Animation | AnimatedContainer, Hero | Implicit animation |
| Custom paint | CustomPainter | Complex graphics |

## State Management Patterns

### BLoC/Cubit Selection
```
Simple state (toggle, counter) → Cubit
Complex events (form, multi-step) → BLoC
```

### State Naming Convention
| State Type | Pattern | Example |
|------------|---------|---------|
| Initial | `{Feature}Initial` | `CheckoutInitial` |
| Loading | `{Feature}Loading` | `CheckoutLoading` |
| Success | `{Feature}Loaded` | `CheckoutLoaded` |
| Error | `{Feature}Error` | `CheckoutError` |
| Action | `{Feature}{Action}ing` | `CheckoutSubmitting` |

### BlocBuilder vs BlocListener
```dart
// BlocBuilder: rebuild UI on state change
BlocBuilder<CheckoutBloc, CheckoutState>(
  builder: (context, state) => switch (state) {
    CheckoutLoading() => CircularProgressIndicator(),
    CheckoutLoaded(:final order) => OrderView(order),
    CheckoutError(:final message) => ErrorView(message),
    _ => SizedBox.shrink(),
  },
)

// BlocListener: side effects (navigation, snackbar)
BlocListener<CheckoutBloc, CheckoutState>(
  listener: (context, state) {
    if (state is CheckoutSuccess) {
      Navigator.pushNamed(context, '/confirmation');
    }
  },
)
```

## Component Patterns

### Stateless Presentation Widget
```dart
class OrderItemTile extends StatelessWidget {
  const OrderItemTile({
    super.key,
    required this.item,
    this.onRemove,
  });

  final OrderItem item;
  final VoidCallback? onRemove;

  @override
  Widget build(BuildContext context) {
    // Pure presentation, no logic
  }
}
```

### Stateful Interactive Widget
```dart
class QuantitySelector extends StatefulWidget {
  const QuantitySelector({
    super.key,
    required this.value,
    required this.onChanged,
    this.min = 1,
    this.max = 99,
  });

  final int value;
  final ValueChanged<int> onChanged;
  final int min;
  final int max;

  @override
  State<QuantitySelector> createState() =>
    _QuantitySelectorState();
}
```

## Responsive Patterns

### Breakpoints
```dart
extension ResponsiveBreakpoints on BuildContext {
  bool get isMobile => MediaQuery.sizeOf(this).width < 600;
  bool get isTablet => MediaQuery.sizeOf(this).width >= 600 &&
    MediaQuery.sizeOf(this).width < 1200;
  bool get isDesktop => MediaQuery.sizeOf(this).width >= 1200;
}
```

### Adaptive Layout
```dart
LayoutBuilder(
  builder: (context, constraints) {
    if (constraints.maxWidth < 600) {
      return MobileLayout();
    } else if (constraints.maxWidth < 1200) {
      return TabletLayout();
    }
    return DesktopLayout();
  },
)
```

## Animation Patterns

### Implicit Animation
```dart
AnimatedContainer(
  duration: Duration(milliseconds: 200),
  curve: Curves.easeOut,
  color: isSelected ? Colors.blue : Colors.grey,
)
```

### Explicit Animation (flutter_animate)
```dart
child
  .animate()
  .fadeIn(duration: 200.ms)
  .slideX(begin: -0.1, curve: Curves.easeOut)
```

### Hero Transitions
```dart
Hero(
  tag: 'product-${item.id}',
  child: ProductImage(item.imageUrl),
)
```

## Accessibility Patterns

### Semantic Labels
```dart
Semantics(
  label: 'Remove ${item.name} from cart',
  button: true,
  child: IconButton(
    icon: Icon(Icons.delete),
    onPressed: onRemove,
  ),
)
```

### Exclude Decorative
```dart
Semantics(
  excludeSemantics: true,
  child: DecorativeImage(),
)
```

### Focus Management
```dart
FocusScope.of(context).requestFocus(myFocusNode);
```

## Platform Adaptive

### Material vs Cupertino
```dart
// Auto-adapt to platform
platform.isIOS
  ? CupertinoButton(child: Text('Confirm'), onPressed: onConfirm)
  : ElevatedButton(child: Text('Confirm'), onPressed: onConfirm)

// Or use adaptive widgets
Switch.adaptive(value: value, onChanged: onChanged)
```

## File Structure Convention

```
lib/
  features/
    checkout/
      presentation/
        screens/
          └── checkout_screen.dart
        widgets/
          ├── order_item_tile.dart
          └── summary_card.dart
      bloc/
        ├── checkout_bloc.dart
        ├── checkout_event.dart
        └── checkout_state.dart
      domain/
        ├── entities/
        └── repositories/
      data/
        ├── models/
        └── repositories/
```

## Common Gotchas

| Issue | Solution |
|-------|----------|
| Rebuild entire list | Use `ListView.builder` with keys |
| Missing `const` | Add `const` to stateless constructors |
| Infinite height in Column | Wrap ListView in `Expanded` |
| Keyboard hides input | Use `SingleChildScrollView` + `resizeToAvoidBottomInset` |
| Image flicker | Use `cacheWidth`/`cacheHeight` |
| Text overflow | Use `maxLines` + `overflow: TextOverflow.ellipsis` |
