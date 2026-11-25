import { router, Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, AppState, StyleSheet, Text, View } from 'react-native';
import { initDb } from '../db/client';
import { hasWallet, seedIfEmpty } from '../db/repo';
import '../devtools';
import { biometricEnabled, checkPin, hasPin, promptBiometric, useLock } from '../lock';
import { useTheme } from '../theme';
import { Button, PinPad } from '../ui';

const RELOCK_AFTER_MS = 60_000; // short trips to the share sheet / file picker don't re-lock

export default function RootLayout() {
  const [state, setState] = useState<'loading' | 'ready' | Error>('loading');
  const { onboarded, locked, set } = useLock();
  const bgAt = useRef(0);
  const t = useTheme();

  useEffect(() => {
    (async () => {
      await initDb();
      seedIfEmpty();
      const pin = await hasPin();
      // Onboarding counts as done only with a PIN AND a wallet: an app closed between the two steps
      // used to land on a home screen with no wallet to pick (bug report, 25 Nov).
      const done = pin && hasWallet();
      set({ onboarded: done, locked: done });
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

  if (state === 'loading')
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', gap: 12, backgroundColor: t.bg }}>
        <ActivityIndicator color={t.primary} size="large" />
        <Text style={{ color: t.muted }}>Membuka data terenkripsi</Text>
      </View>
    );
  if (state instanceof Error)
    return (
      <View style={{ flex: 1, justifyContent: 'center', padding: 24, gap: 8, backgroundColor: t.bg }}>
        <Text style={{ color: t.text, fontSize: 18, fontWeight: '700' }}>Database tidak bisa dibuka</Text>
        <Text style={{ color: t.expense }}>{state.message}</Text>
        <Text style={{ color: t.muted }}>Data Anda tidak dihapus. Tutup lalu buka lagi aplikasinya; kalau tetap gagal, pulihkan dari file backup.</Text>
      </View>
    );

  return (
    <>
      <StatusBar style="dark" />
      <Stack
        screenOptions={{
          headerShadowVisible: false,
          headerStyle: { backgroundColor: t.bg },
          headerTintColor: t.text,
          headerTitleStyle: { fontWeight: '700' },
          contentStyle: { backgroundColor: t.bg },
        }}
      >
        <Stack.Protected guard={onboarded}>
          <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
          <Stack.Screen name="tx" options={{ presentation: 'modal', title: 'Transaksi' }} />
          <Stack.Screen name="wallet" options={{ presentation: 'modal', title: 'Dompet' }} />
          <Stack.Screen name="category" options={{ presentation: 'modal', title: 'Kategori' }} />
          <Stack.Screen name="pin" options={{ presentation: 'modal', title: 'Ubah PIN' }} />
          <Stack.Screen name="backup" options={{ title: 'Backup & Restore' }} />
          <Stack.Screen name="sync" options={{ title: 'Sync' }} />
          <Stack.Screen name="settings" options={{ title: 'Pengaturan' }} />
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
  const t = useTheme();
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
    <View style={[StyleSheet.absoluteFill, { backgroundColor: t.bg, justifyContent: 'center', alignItems: 'center', gap: 24 }]} testID="lock-screen">
      <PinPad title="Masukkan PIN" error={error} onComplete={submit} />
      {bio && <Button kind="ghost" icon="fingerprint" title="Buka dengan sidik jari / wajah" onPress={tryBio} testID="lock-bio" />}
    </View>
  );
}
