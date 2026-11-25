import { router, Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, AppState, StyleSheet, Text, View } from 'react-native';
import { initDb } from '../db/client';
import { seedIfEmpty } from '../db/repo';
import { biometricEnabled, checkPin, hasPin, promptBiometric, useLock } from '../lock';
import { Button, C, PinPad } from '../ui';

const RELOCK_AFTER_MS = 60_000; // short trips to the share sheet / file picker don't re-lock

export default function RootLayout() {
  const [state, setState] = useState<'loading' | 'ready' | Error>('loading');
  const { onboarded, locked, set } = useLock();
  const bgAt = useRef(0);

  useEffect(() => {
    (async () => {
      await initDb();
      seedIfEmpty();
      const pin = await hasPin();
      set({ onboarded: pin, locked: pin });
      setState('ready');
    })().catch((e) => setState(e instanceof Error ? e : new Error(String(e))));
  }, [set]);

  useEffect(() => {
    const sub = AppState.addEventListener('change', (s) => {
      if (s === 'background') bgAt.current = Date.now();
      if (s === 'active' && bgAt.current && Date.now() - bgAt.current > RELOCK_AFTER_MS && useLock.getState().onboarded) {
        if (router.canDismiss()) router.dismissAll(); // native modals would otherwise sit above the lock overlay
        set({ locked: true });
      }
    });
    return () => sub.remove();
  }, [set]);

  if (state === 'loading') return <ActivityIndicator style={{ flex: 1 }} color={C.accent} />;
  if (state instanceof Error)
    return (
      <View style={{ flex: 1, justifyContent: 'center', padding: 24 }}>
        <Text style={{ color: C.danger }}>Gagal membuka database: {state.message}</Text>
      </View>
    );

  return (
    <>
      <StatusBar style="dark" />
      <Stack screenOptions={{ headerShadowVisible: false, headerStyle: { backgroundColor: C.bg }, contentStyle: { backgroundColor: C.bg } }}>
        <Stack.Protected guard={onboarded}>
          <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
          <Stack.Screen name="tx" options={{ presentation: 'modal', title: 'Transaksi' }} />
          <Stack.Screen name="wallet" options={{ presentation: 'modal', title: 'Dompet' }} />
          <Stack.Screen name="category" options={{ presentation: 'modal', title: 'Kategori' }} />
          <Stack.Screen name="pin" options={{ presentation: 'modal', title: 'Ubah PIN' }} />
          <Stack.Screen name="backup" options={{ title: 'Backup & Restore' }} />
          <Stack.Screen name="sync" options={{ title: 'Sync' }} />
        </Stack.Protected>
        <Stack.Protected guard={!onboarded}>
          <Stack.Screen name="onboarding" options={{ headerShown: false }} />
        </Stack.Protected>
      </Stack>
      {onboarded && locked && <LockScreen onUnlock={() => set({ locked: false })} />}
    </>
  );
}

function LockScreen({ onUnlock }: { onUnlock: () => void }) {
  const [error, setError] = useState<string>();
  const [fails, setFails] = useState(0);
  const [waitUntil, setWaitUntil] = useState(0);
  const [bio, setBio] = useState(false);

  const tryBio = async () => {
    if (await promptBiometric()) onUnlock();
  };
  useEffect(() => {
    biometricEnabled().then((on) => {
      setBio(on);
      if (on) tryBio();
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const submit = async (pin: string) => {
    if (Date.now() < waitUntil) return setError('Terlalu banyak percobaan, tunggu 30 detik');
    if (await checkPin(pin)) return onUnlock();
    const n = fails + 1;
    setFails(n);
    if (n % 5 === 0) setWaitUntil(Date.now() + 30_000);
    setError(n % 5 === 0 ? 'Terlalu banyak percobaan, tunggu 30 detik' : 'PIN salah');
  };

  return (
    <View style={[StyleSheet.absoluteFill, { backgroundColor: C.bg, justifyContent: 'center', alignItems: 'center', gap: 24 }]} testID="lock-screen">
      <PinPad title="Masukkan PIN" error={error} onComplete={submit} />
      {bio && <Button kind="ghost" title="Pakai biometrik" onPress={tryBio} testID="lock-bio" />}
    </View>
  );
}
