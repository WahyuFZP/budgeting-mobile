import { router, Tabs } from 'expo-router';
import { Pressable, Text, View } from 'react-native';
import { useReminders, useSettings } from '../../hooks';
import { TabBar } from '../../TabBar';
import { useTheme } from '../../theme';
import { Icon, type IconName } from '../../ui';

function HeaderButton({ icon, label, onPress, testID, badge = 0 }: { icon: IconName; label: string; onPress: () => void; testID: string; badge?: number }) {
  const t = useTheme();
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={badge ? `${label}, ${badge} baru` : label}
      testID={testID}
      hitSlop={6}
      style={({ pressed }) => ({ width: 44, height: 44, alignItems: 'center', justifyContent: 'center', opacity: pressed ? 0.6 : 1 })}
    >
      <Icon name={icon} size={24} color={t.text} />
      {badge > 0 && (
        // the count makes the dot mean something: how many things need attention
        <View style={{ position: 'absolute', top: 6, right: 6, minWidth: 16, height: 16, borderRadius: 8, paddingHorizontal: 3, backgroundColor: t.expense, alignItems: 'center', justifyContent: 'center' }}>
          <Text style={{ color: '#FFFFFF', fontSize: 10, fontWeight: '700' }}>{badge > 9 ? '9+' : badge}</Text>
        </View>
      )}
    </Pressable>
  );
}

const greeting = (h: number) => (h < 11 ? 'Selamat pagi' : h < 15 ? 'Selamat siang' : h < 18 ? 'Selamat sore' : 'Selamat malam');

/** Profile at the top left: the nickname's initial in a circle (no account, so no photo), and a greeting.
 *  Tapping it opens Pengaturan, where the nickname is set. */
function Greeting() {
  const t = useTheme();
  const { nickname } = useSettings();
  return (
    <Pressable
      onPress={() => router.push('/settings')}
      accessibilityRole="button"
      accessibilityLabel={nickname ? `Profil ${nickname}, buka pengaturan` : 'Profil, atur nama panggilan'}
      testID="open-profile"
      style={({ pressed }) => ({ flexDirection: 'row', alignItems: 'center', gap: 10, opacity: pressed ? 0.7 : 1 })}
    >
      <View style={{ width: 42, height: 42, borderRadius: 21, backgroundColor: t.primary, alignItems: 'center', justifyContent: 'center', borderWidth: 2, borderColor: t.accent }}>
        {nickname ? (
          <Text style={{ color: t.onPrimary, fontWeight: '800', fontSize: 18 }}>{(nickname.trim()[0] ?? '').toUpperCase()}</Text>
        ) : (
          <Icon name="account" size={24} color={t.onPrimary} />
        )}
      </View>
      <View>
        <Text style={{ color: t.muted, fontSize: 13 }}>{greeting(new Date().getHours())}</Text>
        <Text style={{ color: t.text, fontWeight: '800', fontSize: 18 }} numberOfLines={1}>
          {nickname || 'Atur nama panggilan'}
        </Text>
      </View>
    </Pressable>
  );
}

function HomeActions() {
  const count = useReminders().length;
  return (
    <View style={{ flexDirection: 'row', marginRight: 8 }}>
      <HeaderButton icon={count ? 'bell-ring' : 'bell-outline'} label="Pengingat" badge={count} onPress={() => router.push('/reminders')} testID="open-reminders" />
      <HeaderButton icon="cog" label="Pengaturan" onPress={() => router.push('/settings')} testID="open-settings" />
    </View>
  );
}

export default function TabsLayout() {
  const t = useTheme();
  return (
    <Tabs
      tabBar={(p) => <TabBar {...p} />}
      screenOptions={{
        headerShadowVisible: false,
        headerStyle: { backgroundColor: t.bg },
        headerTintColor: t.text,
        headerTitleStyle: { fontWeight: '700' },
        sceneStyle: { backgroundColor: t.bg },
      }}
    >
      <Tabs.Screen name="index" options={{ title: 'Beranda', headerTitle: () => <Greeting />, headerTitleAlign: 'left', headerRight: () => <HomeActions /> }} />
      <Tabs.Screen name="history" options={{ title: 'Riwayat' }} />
      <Tabs.Screen name="report" options={{ title: 'Laporan' }} />
      <Tabs.Screen name="budget" options={{ title: 'Budget' }} />
    </Tabs>
  );
}
