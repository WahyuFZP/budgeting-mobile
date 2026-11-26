// Themed feedback instead of the system Alert:
//   toast(title, kind?, body?)  result of an action; slides in at the top, haptic matches the kind, hides itself
//   confirm({...})              question before something important (delete, restore); resolves true/false
// <FeedbackHost /> renders both and is mounted once in the root layout.
import * as Haptics from 'expo-haptics';
import { Modal, Pressable, Text, View } from 'react-native';
import Animated, { FadeIn, FadeInUp, FadeOut, FadeOutUp, ZoomIn } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { create } from 'zustand';
import { useTheme } from './theme';
import { Icon, type IconName } from './ui';

type Kind = 'success' | 'warn' | 'error' | 'info';
type Action = { label: string; onPress: () => void };
type Toast = { id: number; kind: Kind; title: string; body?: string; action?: Action };
type Dialog = { title: string; body?: string; confirm: string; cancel?: string; destructive?: boolean; icon?: IconName; resolve: (ok: boolean) => void };

const useFeedback = create<{ toast: Toast | null; dialog: Dialog | null }>(() => ({ toast: null, dialog: null }));
let hideTimer: ReturnType<typeof setTimeout> | undefined;

const HAPTIC: Record<Kind, () => void> = {
  success: () => Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success),
  warn: () => Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning),
  error: () => Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error),
  info: () => Haptics.selectionAsync(),
};

export function toast(title: string, kind: Kind = 'success', body?: string, action?: Action) {
  HAPTIC[kind]();
  useFeedback.setState({ toast: { id: Date.now(), kind, title, body, action } });
  clearTimeout(hideTimer);
  // errors, warnings and toasts with an action (undo) stay longer: they need reading or a decision
  hideTimer = setTimeout(() => useFeedback.setState({ toast: null }), action ? 5000 : kind === 'error' || kind === 'warn' ? 4500 : 2600);
}

export function confirm(o: Omit<Dialog, 'resolve'>): Promise<boolean> {
  if (o.destructive) Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
  return new Promise((resolve) => useFeedback.setState({ dialog: { ...o, resolve } }));
}

export function FeedbackHost() {
  const t = useTheme();
  const insets = useSafeAreaInsets();
  const { toast: tst, dialog } = useFeedback();
  const look: Record<Kind, { icon: IconName; color: string }> = {
    success: { icon: 'check-circle', color: t.income },
    warn: { icon: 'alert-circle', color: t.warn },
    error: { icon: 'close-circle', color: t.expense },
    info: { icon: 'information', color: t.mark },
  };
  const close = (ok: boolean) => {
    dialog?.resolve(ok);
    useFeedback.setState({ dialog: null });
  };

  return (
    <>
      <View pointerEvents="box-none" style={{ position: 'absolute', top: insets.top + 8, left: 16, right: 16, zIndex: 1000 }}>
        {tst && (
          <Animated.View key={tst.id} entering={FadeInUp.springify().damping(18)} exiting={FadeOutUp.duration(180)}>
            <Pressable
              onPress={() => useFeedback.setState({ toast: null })}
              accessibilityRole="alert"
              accessibilityLiveRegion="assertive"
              accessibilityLabel={tst.body ? `${tst.title}. ${tst.body}` : tst.title}
              style={{
                flexDirection: 'row',
                gap: 12,
                alignItems: 'center',
                backgroundColor: t.card,
                borderRadius: 16,
                padding: 14,
                borderLeftWidth: 4, // marks the kind together with the icon (not color alone: icon + words too)
                borderLeftColor: look[tst.kind].color,
                boxShadow: '0px 8px 20px rgba(16, 48, 32, 0.22)',
              }}
            >
              <Icon name={look[tst.kind].icon} size={26} color={look[tst.kind].color} />
              <View style={{ flex: 1 }}>
                <Text style={{ color: t.text, fontWeight: '700' }}>{tst.title}</Text>
                {tst.body ? <Text style={{ color: t.muted }}>{tst.body}</Text> : null}
              </View>
              {tst.action && (
                <Pressable
                  onPress={() => {
                    useFeedback.setState({ toast: null });
                    tst.action!.onPress();
                  }}
                  accessibilityRole="button"
                  testID="toast-action"
                  hitSlop={8}
                  style={({ pressed }) => ({ minHeight: 44, paddingHorizontal: 14, borderRadius: 12, justifyContent: 'center', backgroundColor: t.bg, opacity: pressed ? 0.6 : 1 })}
                >
                  <Text style={{ color: t.mark, fontWeight: '800' }}>{tst.action.label}</Text>
                </Pressable>
              )}
            </Pressable>
          </Animated.View>
        )}
      </View>

      <Modal visible={!!dialog} transparent statusBarTranslucent animationType="none" onRequestClose={() => close(false)}>
        {dialog && (
          <Animated.View entering={FadeIn.duration(160)} exiting={FadeOut.duration(140)} style={{ flex: 1, backgroundColor: 'rgba(10, 24, 16, 0.5)', justifyContent: 'center', padding: 28 }}>
            <Pressable style={{ position: 'absolute', inset: 0 }} onPress={() => close(false)} accessibilityLabel="Tutup" />
            <Animated.View entering={ZoomIn.springify().damping(17)} style={{ backgroundColor: t.card, borderRadius: 24, padding: 24, gap: 12, alignItems: 'center' }} accessibilityViewIsModal>
              <View style={{ width: 56, height: 56, borderRadius: 28, alignItems: 'center', justifyContent: 'center', backgroundColor: dialog.destructive ? '#FBE9E7' : t.bg }}>
                <Icon name={dialog.icon ?? (dialog.destructive ? 'delete-outline' : 'help-circle-outline')} size={30} color={dialog.destructive ? t.expense : t.mark} />
              </View>
              <Text style={{ color: t.text, fontWeight: '800', fontSize: 18, textAlign: 'center' }}>{dialog.title}</Text>
              {dialog.body ? <Text style={{ color: t.muted, textAlign: 'center', lineHeight: 20 }}>{dialog.body}</Text> : null}
              <View style={{ flexDirection: 'row', gap: 10, alignSelf: 'stretch', marginTop: 6 }}>
                <Pressable
                  onPress={() => close(false)}
                  accessibilityRole="button"
                  testID="dialog-cancel"
                  style={({ pressed }) => ({ flex: 1, minHeight: 48, borderRadius: 12, borderWidth: 1, borderColor: t.line, alignItems: 'center', justifyContent: 'center', opacity: pressed ? 0.6 : 1 })}
                >
                  <Text style={{ color: t.text, fontWeight: '700' }}>{dialog.cancel ?? 'Batal'}</Text>
                </Pressable>
                <Pressable
                  onPress={() => close(true)}
                  accessibilityRole="button"
                  testID="dialog-confirm"
                  style={({ pressed }) => ({ flex: 1, minHeight: 48, borderRadius: 12, backgroundColor: dialog.destructive ? t.expense : t.primary, alignItems: 'center', justifyContent: 'center', opacity: pressed ? 0.8 : 1 })}
                >
                  <Text style={{ color: '#FFFFFF', fontWeight: '700' }}>{dialog.confirm}</Text>
                </Pressable>
              </View>
            </Animated.View>
          </Animated.View>
        )}
      </Modal>
    </>
  );
}
