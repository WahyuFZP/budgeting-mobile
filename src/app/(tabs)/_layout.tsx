import { Tabs } from 'expo-router';
import { Text } from 'react-native';
import { C } from '../../ui';

const icon = (e: string) => () => <Text style={{ fontSize: 20 }}>{e}</Text>;

export default function TabsLayout() {
  return (
    <Tabs screenOptions={{ tabBarActiveTintColor: C.accent, headerShadowVisible: false, headerStyle: { backgroundColor: C.bg }, sceneStyle: { backgroundColor: C.bg } }}>
      <Tabs.Screen name="index" options={{ title: 'Beranda', tabBarIcon: icon('🏠'), tabBarButtonTestID: 'tab-home' }} />
      <Tabs.Screen name="history" options={{ title: 'Riwayat', tabBarIcon: icon('🧾'), tabBarButtonTestID: 'tab-history' }} />
      <Tabs.Screen name="budget" options={{ title: 'Budget', tabBarIcon: icon('🎯'), tabBarButtonTestID: 'tab-budget' }} />
      <Tabs.Screen name="settings" options={{ title: 'Lainnya', tabBarIcon: icon('⚙️'), tabBarButtonTestID: 'tab-settings' }} />
    </Tabs>
  );
}
