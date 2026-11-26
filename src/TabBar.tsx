// Floating tab bar: forest-green pill (30% primary). Every tab shows icon + label (stable layout, readable at a glance);
// the active one turns sun-yellow (10% accent) and a short indicator slides above it. The raised "+" in the middle
// keeps a transaction one tap away from every tab; its white ring separates it from the bar like a coin on a table.
import * as Haptics from 'expo-haptics';
import { router } from 'expo-router';
import type { BottomTabBarProps } from 'expo-router/build/layouts/Tabs';
import { useEffect, useRef, useState } from 'react';
import { Pressable, Text, View } from 'react-native';
import Animated, { useAnimatedStyle, useSharedValue, withSequence, withSpring, withTiming } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from './theme';
import { Icon, navHidden, type IconName } from './ui';

const ICONS: Record<string, IconName> = { index: 'home-variant', history: 'format-list-bulleted', report: 'chart-bar', budget: 'chart-donut' };
const BAR = 68;
const IND = 22; // indicator width
const FAB = 58;
const SPRING = { damping: 20, stiffness: 320, mass: 0.6 }; // snappy: settles in ~250 ms

export function TabBar({ state, descriptors, emitter, navigateToTab }: BottomTabBarProps) {
  const t = useTheme();
  const insets = useSafeAreaInsets();
  const [width, setWidth] = useState(0);
  const slots = state.routes.length + 1; // + the add button in the middle
  const mid = Math.floor(state.routes.length / 2);
  const slotOf = (i: number) => (i >= mid ? i + 1 : i);
  const slotW = width / slots;
  const xOf = (i: number) => slotOf(i) * slotW + (slotW - IND) / 2;

  // The indicator moves on touch, not after the next screen has rendered: that wait felt laggy.
  const [active, setActive] = useState(state.index);
  const pos = useSharedValue(0);
  const stretch = useSharedValue(1); // stretches while it travels, then settles
  const placed = useRef(false);
  useEffect(() => {
    if (!width) return;
    setActive(state.index);
    pos.value = placed.current ? withSpring(xOf(state.index), SPRING) : xOf(state.index); // first layout: no slide-in
    placed.current = true;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state.index, width]);
  const indicator = useAnimatedStyle(() => ({ transform: [{ translateX: pos.value }, { scaleX: stretch.value }] }));
  // slide off-screen (bar + gap + safe area + raised fab) while the user scrolls down
  const hideBy = BAR + 12 + insets.bottom + 24;
  const slide = useAnimatedStyle(() => ({ transform: [{ translateY: withTiming(navHidden.value * hideBy, { duration: 220 }) }] }));
  useEffect(() => {
    navHidden.value = 0; // a new tab starts with the bar visible
  }, [state.index]);

  const tab = (route: (typeof state.routes)[number], i: number) => {
    const focused = active === i;
    const label = descriptors[route.key].options.title ?? route.name;
    const color = focused ? t.accent : t.onPrimaryMuted;
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
          stretch.value = withSequence(withTiming(1.8, { duration: 90 }), withSpring(1, { damping: 12, stiffness: 220 }));
          navigateToTab(route.key);
        }}
        style={({ pressed }) => ({ flex: 1, alignItems: 'center', justifyContent: 'center', height: BAR, gap: 3, opacity: pressed ? 0.7 : 1 })}
      >
        <Icon name={ICONS[route.name] ?? 'circle'} size={23} color={color} />
        <Text style={{ color, fontSize: 11, fontWeight: focused ? '700' : '500' }} numberOfLines={1}>
          {label}
        </Text>
      </Pressable>
    );
  };

  return (
    <>
    {/* content scrolling under the bar fades into the page instead of colliding with it; touches pass through */}
    <Animated.View
      pointerEvents="none"
      style={[{ position: 'absolute', left: 0, right: 0, bottom: 0, height: insets.bottom + 12 + BAR + 36, backgroundImage: `linear-gradient(to bottom, ${t.bg}00 0%, ${t.bg}E6 55%, ${t.bg} 100%)` }, slide]}
    />
    <Animated.View
      onLayout={(e) => setWidth(e.nativeEvent.layout.width)}
      style={[
        {
          position: 'absolute',
          left: 16,
          right: 16,
          bottom: insets.bottom + 12,
          height: BAR,
          borderRadius: BAR / 2,
          backgroundColor: t.primary,
          flexDirection: 'row',
          alignItems: 'center',
          // the bar floats over scrolling content: a soft, slightly green-tinted shadow lifts it off the page
          boxShadow: '0px 10px 24px rgba(16, 48, 32, 0.28), 0px 2px 6px rgba(16, 48, 32, 0.18)',
        },
        slide,
      ]}
    >
      {width > 0 && <Animated.View style={[{ position: 'absolute', left: 0, top: 6, width: IND, height: 4, borderRadius: 2, backgroundColor: t.accent }, indicator]} />}
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
            width: FAB,
            height: FAB,
            borderRadius: FAB / 2,
            marginTop: -22, // raised: centered horizontally, its top half sits above the bar
            backgroundColor: t.accent,
            borderWidth: 4,
            borderColor: t.bg,
            alignItems: 'center',
            justifyContent: 'center',
            transform: [{ scale: pressed ? 0.93 : 1 }],
            boxShadow: '0px 6px 14px rgba(16, 48, 32, 0.3)',
          })}
        >
          <Icon name="plus" size={30} color={t.onAccent} />
        </Pressable>
      </View>
      {state.routes.slice(mid).map((r, i) => tab(r, i + mid))}
    </Animated.View>
    </>
  );
}
