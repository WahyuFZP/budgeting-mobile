// Floating tab bar: ink-blue pill (30% primary) with a sky-blue circle (10% accent) marking the active tab,
// and a sky-blue "+" centered in the middle slot so a transaction is one tap away from every tab.
import * as Haptics from 'expo-haptics';
import { router } from 'expo-router';
import type { BottomTabBarProps } from 'expo-router/build/layouts/Tabs';
import { useEffect, useRef, useState } from 'react';
import { Pressable, View } from 'react-native';
import Animated, { useAnimatedStyle, useSharedValue, withSequence, withSpring, withTiming } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from './theme';
import { Icon, navHidden, type IconName } from './ui';

const ICONS: Record<string, IconName> = { index: 'home-variant', history: 'format-list-bulleted', report: 'chart-bar', budget: 'chart-donut' };
const DOT = 44;
const SPRING = { damping: 20, stiffness: 320, mass: 0.6 }; // snappy: settles in ~250 ms

export function TabBar({ state, descriptors, emitter, navigateToTab }: BottomTabBarProps) {
  const t = useTheme();
  const insets = useSafeAreaInsets();
  const [width, setWidth] = useState(0);
  const slots = state.routes.length + 1; // + the add button in the middle
  const mid = Math.floor(state.routes.length / 2);
  const slotOf = (i: number) => (i >= mid ? i + 1 : i);
  const slotW = width / slots;
  const xOf = (i: number) => slotOf(i) * slotW + (slotW - DOT) / 2;

  // The indicator moves on touch, not after the next screen has rendered: that wait is what felt laggy.
  const [active, setActive] = useState(state.index);
  const pos = useSharedValue(0);
  const stretch = useSharedValue(1); // the indicator stretches while it travels, like a droplet, then settles round
  const placed = useRef(false);
  useEffect(() => {
    if (!width) return;
    setActive(state.index);
    pos.value = placed.current ? withSpring(xOf(state.index), SPRING) : xOf(state.index); // first layout: no slide-in
    placed.current = true;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state.index, width]);
  const dot = useAnimatedStyle(() => ({ transform: [{ translateX: pos.value }, { scaleX: stretch.value }] }));
  // slide off-screen (bar height + gap + safe area) while the user scrolls down
  const hideBy = 64 + 12 + insets.bottom + 16;
  const slide = useAnimatedStyle(() => ({ transform: [{ translateY: withTiming(navHidden.value * hideBy, { duration: 220 }) }] }));
  useEffect(() => {
    navHidden.value = 0; // a new tab starts with the bar visible
  }, [state.index]);

  const tab = (route: (typeof state.routes)[number], i: number) => {
    const focused = active === i;
    const label = descriptors[route.key].options.title ?? route.name;
    return (
      <Pressable
        key={route.key}
        testID={`tab-${route.name}`}
        accessibilityRole="tab"
        accessibilityLabel={label}
        accessibilityState={{ selected: focused }}
        onPress={() => {
          const e = emitter.emit({ type: 'tabPress', target: route.key, canPreventDefault: true });
          if (focused || e.defaultPrevented) return;
          Haptics.selectionAsync();
          setActive(i);
          pos.value = withSpring(xOf(i), SPRING);
          stretch.value = withSequence(withTiming(1.45, { duration: 90 }), withSpring(1, { damping: 12, stiffness: 220 }));
          navigateToTab(route.key);
        }}
        style={({ pressed }) => ({ flex: 1, alignItems: 'center', justifyContent: 'center', height: 64, transform: [{ scale: pressed ? 0.9 : 1 }] })}
      >
        {/* icon only, always centered: a label that appears/disappears made the icon jump on every switch */}
        <Icon name={ICONS[route.name] ?? 'circle'} size={24} color={focused ? t.onAccent : t.onPrimaryMuted} />
      </Pressable>
    );
  };

  return (
    <Animated.View
      onLayout={(e) => setWidth(e.nativeEvent.layout.width)}
      style={[{
        position: 'absolute',
        left: 16,
        right: 16,
        bottom: insets.bottom + 12,
        height: 64,
        borderRadius: 32,
        backgroundColor: t.primary,
        flexDirection: 'row',
        alignItems: 'center',
        // elevation: the bar floats over scrolling content and needs to read as a separate layer
        elevation: 8,
        shadowColor: '#000',
        shadowOpacity: 0.18,
        shadowRadius: 12,
        shadowOffset: { width: 0, height: 4 },
      }, slide]}
    >
      {width > 0 && (
        <Animated.View style={[{ position: 'absolute', left: 0, top: (64 - DOT) / 2, width: DOT, height: DOT, borderRadius: DOT / 2, backgroundColor: t.accent }, dot]} />
      )}
      {state.routes.slice(0, mid).map((r, i) => tab(r, i))}
      <View style={{ flex: 1, alignItems: 'center' }}>
        <Pressable
          testID="fab-add"
          accessibilityRole="button"
          accessibilityLabel="Catat transaksi"
          onPress={() => {
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
            router.push('/tx');
          }}
          style={({ pressed }) => ({
            width: 52,
            height: 52,
            borderRadius: 26, // sits centered in the 64px bar, same axis as the tab icons
            backgroundColor: t.accent,
            alignItems: 'center',
            justifyContent: 'center',
            transform: [{ scale: pressed ? 0.94 : 1 }],
          })}
        >
          <Icon name="plus" size={30} color={t.onAccent} />
        </Pressable>
      </View>
      {state.routes.slice(mid).map((r, i) => tab(r, i + mid))}
    </Animated.View>
  );
}
