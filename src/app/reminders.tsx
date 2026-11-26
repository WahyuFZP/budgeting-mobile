import { router } from 'expo-router';
import { Text, View } from 'react-native';
import Animated, { FadeInDown } from 'react-native-reanimated';
import type { Reminder } from '../domain';
import { useReminders } from '../hooks';
import { useTheme } from '../theme';
import { Card, EmptyState, Icon, PressScale, Row, Screen, type IconName } from '../ui';

const ICON: Record<Reminder['icon'], IconName> = { backup: 'backup-restore', 'budget-warn': 'alert-circle-outline', 'budget-over': 'alert-octagon', today: 'pencil-plus' };

export default function RemindersScreen() {
  const t = useTheme();
  const list = useReminders();
  const tone = (r: Reminder) => (r.icon === 'budget-over' ? t.expense : r.icon === 'budget-warn' || r.icon === 'backup' ? t.warn : t.mark);

  return (
    <Screen>
      {list.length === 0 && <EmptyState text="Tidak ada pengingat. Budget aman, backup masih baru, dan hari ini sudah tercatat." />}
      {list.map((r, i) => (
        <Animated.View key={r.id} entering={FadeInDown.delay(i * 50).duration(220)}>
          <PressScale
            onPress={() => router.navigate(r.href)}
            accessibilityRole="button"
            accessibilityLabel={`${r.title}. ${r.body}`}
            testID={`reminder-${r.id}`}
          >
            <Card style={{ flexDirection: 'row', gap: 12, alignItems: 'flex-start' }}>
              <Icon name={ICON[r.icon]} size={26} color={tone(r)} />
              <View style={{ flex: 1, gap: 2 }}>
                <Text style={{ color: t.text, fontWeight: '700' }}>{r.title}</Text>
                <Text style={{ color: t.muted }}>{r.body}</Text>
              </View>
              <Row>
                <Icon name="chevron-right" size={22} color={t.muted} />
              </Row>
            </Card>
          </PressScale>
        </Animated.View>
      ))}
    </Screen>
  );
}
