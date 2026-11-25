import { router, Tabs } from 'expo-router';
import { Pressable } from 'react-native';
import { TabBar } from '../../TabBar';
import { useTheme } from '../../theme';
import { Icon } from '../../ui';

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
      <Tabs.Screen
        name="index"
        options={{
          title: 'Beranda',
          headerRight: () => (
            <Pressable
              onPress={() => router.push('/settings')}
              accessibilityRole="button"
              accessibilityLabel="Pengaturan"
              testID="open-settings"
              hitSlop={8}
              style={{ width: 44, height: 44, alignItems: 'center', justifyContent: 'center', marginRight: 8 }}
            >
              <Icon name="cog" size={24} color={t.text} />
            </Pressable>
          ),
        }}
      />
      <Tabs.Screen name="history" options={{ title: 'Riwayat' }} />
      <Tabs.Screen name="report" options={{ title: 'Laporan' }} />
      <Tabs.Screen name="budget" options={{ title: 'Budget' }} />
    </Tabs>
  );
}
