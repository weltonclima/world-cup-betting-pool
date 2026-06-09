# React Native UI Patterns

## Component Architecture

### Component Types
| Type | When | Platform |
|------|------|----------|
| Cross-platform | Same on iOS/Android | Default |
| Platform-specific | Different per OS | `.ios.tsx` / `.android.tsx` |
| Native module | Bridge to native code | When RN doesn't support |

### Component Hierarchy
```
App
└── NavigationContainer
    └── Stack.Navigator
        └── CheckoutScreen
            ├── ScrollView
            │   ├── OrderItemList (FlatList)
            │   └── SummaryCard
            └── SafeAreaView
                └── ConfirmButton (sticky bottom)
```

## Navigation Patterns

### Stack Navigation
```tsx
import { createNativeStackNavigator } from '@react-navigation/native-stack';

const Stack = createNativeStackNavigator<RootStackParamList>();

function AppNavigator() {
  return (
    <Stack.Navigator>
      <Stack.Screen name="Home" component={HomeScreen} />
      <Stack.Screen name="Product" component={ProductScreen} />
      <Stack.Screen
        name="Checkout"
        component={CheckoutScreen}
        options={{ presentation: 'modal' }}
      />
    </Stack.Navigator>
  );
}
```

### Tab Navigation
```tsx
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';

const Tab = createBottomTabNavigator();

function TabNavigator() {
  return (
    <Tab.Navigator>
      <Tab.Screen
        name="Home"
        component={HomeStack}
        options={{
          tabBarIcon: ({ color }) => <HomeIcon color={color} />
        }}
      />
      <Tab.Screen name="Cart" component={CartStack} />
      <Tab.Screen name="Profile" component={ProfileStack} />
    </Tab.Navigator>
  );
}
```

### Type-safe Navigation
```tsx
// types.ts
type RootStackParamList = {
  Home: undefined;
  Product: { productId: string };
  Checkout: { orderId: string };
};

// Usage
const navigation =
  useNavigation<NativeStackNavigationProp<RootStackParamList>>();
navigation.navigate('Product', { productId: '123' });

// Receiving params
const route = useRoute<RouteProp<RootStackParamList, 'Product'>>();
const { productId } = route.params;
```

## List Patterns

### FlatList (Most Common)
```tsx
<FlatList
  data={items}
  keyExtractor={(item) => item.id}
  renderItem={({ item }) => <OrderItemCard item={item} />}
  ItemSeparatorComponent={() => <View style={styles.separator} />}
  ListEmptyComponent={<EmptyState />}
  ListHeaderComponent={<ListHeader />}
  ListFooterComponent={<ListFooter />}
  onEndReached={loadMore}
  onEndReachedThreshold={0.5}
  refreshControl={
    <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
  }
/>
```

### SectionList (Grouped)
```tsx
<SectionList
  sections={[
    { title: 'Today', data: todayOrders },
    { title: 'Yesterday', data: yesterdayOrders },
  ]}
  keyExtractor={(item) => item.id}
  renderItem={({ item }) => <OrderCard order={item} />}
  renderSectionHeader={({ section }) => (
    <Text style={styles.sectionHeader}>{section.title}</Text>
  )}
/>
```

### FlashList (Performance)
```tsx
import { FlashList } from '@shopify/flash-list';

<FlashList
  data={items}
  renderItem={({ item }) => <ProductCard product={item} />}
  estimatedItemSize={100}
  keyExtractor={(item) => item.id}
/>
```

## Layout Patterns

### Safe Area
```tsx
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';

// Wrapper
<SafeAreaView style={styles.container} edges={['top', 'bottom']}>
  {children}
</SafeAreaView>

// Hook for custom
const insets = useSafeAreaInsets();
<View style={{ paddingBottom: insets.bottom + 16 }}>
```

### Keyboard Avoiding
```tsx
import { KeyboardAvoidingView, Platform } from 'react-native';

<KeyboardAvoidingView
  behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
  keyboardVerticalOffset={headerHeight}
>
  <ScrollView>
    <TextInput />
  </ScrollView>
</KeyboardAvoidingView>
```

### Sticky Footer
```tsx
<View style={styles.container}>
  <ScrollView style={styles.content}>
    {/* Scrollable content */}
  </ScrollView>
  <View style={styles.footer}>
    <Button title="Confirm" onPress={onConfirm} />
  </View>
</View>

const styles = StyleSheet.create({
  container: { flex: 1 },
  content: { flex: 1 },
  footer: {
    padding: 16,
    borderTopWidth: 1,
    borderTopColor: '#E5E5E5',
  },
});
```

## State Management Patterns

### Local State
```tsx
const [quantity, setQuantity] = useState(1);
```

### Context (App-wide)
```tsx
const AuthContext = createContext<AuthContextValue>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);

  return (
    <AuthContext.Provider value={{ user, setUser }}>
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => useContext(AuthContext);
```

### Zustand (Recommended)
```tsx
import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import AsyncStorage from '@react-native-async-storage/async-storage';

interface CartStore {
  items: CartItem[];
  addItem: (item: CartItem) => void;
}

export const useCartStore = create<CartStore>()(
  persist(
    (set) => ({
      items: [],
      addItem: (item) => set((state) => ({
        items: [...state.items, item]
      })),
    }),
    {
      name: 'cart-storage',
      storage: createJSONStorage(() => AsyncStorage),
    }
  )
);
```

### React Query (Server State)
```tsx
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';

function useProduct(id: string) {
  return useQuery({
    queryKey: ['product', id],
    queryFn: () => fetchProduct(id),
  });
}

function useAddToCart() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: addToCart,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['cart'] });
    },
  });
}
```

## Animation Patterns

### Animated API (Simple)
```tsx
const fadeAnim = useRef(new Animated.Value(0)).current;

useEffect(() => {
  Animated.timing(fadeAnim, {
    toValue: 1,
    duration: 300,
    useNativeDriver: true,
  }).start();
}, []);

<Animated.View style={{ opacity: fadeAnim }}>
  {children}
</Animated.View>
```

### Reanimated (Complex/Gesture)
```tsx
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withSpring
} from 'react-native-reanimated';

function AnimatedCard() {
  const scale = useSharedValue(1);

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
  }));

  const onPressIn = () => {
    scale.value = withSpring(0.95);
  };

  const onPressOut = () => {
    scale.value = withSpring(1);
  };

  return (
    <Pressable onPressIn={onPressIn} onPressOut={onPressOut}>
      <Animated.View style={animatedStyle}>
        {children}
      </Animated.View>
    </Pressable>
  );
}
```

### Gesture Handler
```tsx
import { Gesture, GestureDetector } from 'react-native-gesture-handler';

function SwipeableCard() {
  const translateX = useSharedValue(0);

  const panGesture = Gesture.Pan()
    .onUpdate((e) => {
      translateX.value = e.translationX;
    })
    .onEnd(() => {
      if (translateX.value < -100) {
        // Swipe left action
      }
      translateX.value = withSpring(0);
    });

  return (
    <GestureDetector gesture={panGesture}>
      <Animated.View style={useAnimatedStyle(() => ({
        transform: [{ translateX: translateX.value }],
      }))}>
        {children}
      </Animated.View>
    </GestureDetector>
  );
}
```

## Platform-Specific Patterns

### Platform Select
```tsx
import { Platform } from 'react-native';

const styles = StyleSheet.create({
  shadow: Platform.select({
    ios: {
      shadowColor: '#000000',
      shadowOffset: { width: 0, height: 2 },
      shadowOpacity: 0.1,
      shadowRadius: 4,
    },
    android: {
      elevation: 4,
    },
  }),
});
```

### Platform-Specific Files
```
components/
├── Button.tsx        # Shared logic
├── Button.ios.tsx    # iOS-specific
└── Button.android.tsx # Android-specific
```

### Platform Components
```tsx
// iOS-specific behavior
{Platform.OS === 'ios' && (
  <BlurView intensity={50}>
    {children}
  </BlurView>
)}
```

## Accessibility Patterns

### Accessible Props
```tsx
<TouchableOpacity
  accessible={true}
  accessibilityLabel="Add to cart"
  accessibilityHint="Adds this product to your shopping cart"
  accessibilityRole="button"
  accessibilityState={{ disabled: isLoading }}
>
  <Text>Add to Cart</Text>
</TouchableOpacity>
```

### Screen Reader Announcements
```tsx
import { AccessibilityInfo } from 'react-native';

AccessibilityInfo.announceForAccessibility('Item added to cart');
```

### Focus Management
```tsx
const buttonRef = useRef<TouchableOpacity>(null);

useEffect(() => {
  if (isOpen) {
    buttonRef.current?.focus();
  }
}, [isOpen]);
```

## Performance Patterns

### Memoization
```tsx
const MemoizedCard = memo(ProductCard);

const renderItem = useCallback(({ item }) => (
  <MemoizedCard product={item} onPress={handlePress} />
), [handlePress]);
```

### Image Optimization
```tsx
import FastImage from 'react-native-fast-image';

<FastImage
  source={{ uri: imageUrl, priority: FastImage.priority.normal }}
  style={styles.image}
  resizeMode={FastImage.resizeMode.cover}
/>
```

### Hermes Engine
```json
// android/app/build.gradle
project.ext.react = [
  enableHermes: true
]
```

## File Structure Convention

```
src/
├── screens/
│   ├── HomeScreen.tsx
│   ├── ProductScreen.tsx
│   └── CheckoutScreen.tsx
├── components/
│   ├── ui/                    # Design system
│   │   ├── Button.tsx
│   │   ├── Input.tsx
│   │   └── Card.tsx
│   └── features/              # Feature-specific
│       └── checkout/
│           ├── OrderItemCard.tsx
│           └── SummaryCard.tsx
├── navigation/
│   ├── AppNavigator.tsx
│   ├── AuthNavigator.tsx
│   └── types.ts
├── hooks/
│   └── useProduct.ts
├── stores/
│   └── cart.ts
├── services/
│   └── api.ts
└── utils/
    └── format.ts
```

## Common Gotchas

| Issue | Solution |
|-------|----------|
| Flatlist re-renders all | Use `keyExtractor` + `memo` |
| Keyboard covers input | Use `KeyboardAvoidingView` |
| Notch/status bar overlap | Use `SafeAreaView` |
| Slow navigation | Use `@react-navigation/native-stack` |
| Image flicker | Use `FastImage` |
| Android back button | Handle in `useEffect` with `BackHandler` |
| Touch feedback missing | Use `Pressable` with `android_ripple` |
| Shadow not showing (Android) | Use `elevation` instead of shadows |
