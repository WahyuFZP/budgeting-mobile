import { useEffect, useState } from 'react';
import { ActivityIndicator, Alert } from 'react-native';
import { getAccount, lastSyncAt, signIn, signOut, syncNow, type SyncAccount } from '../db/sync';
import { Button, C, Card, Field, H, Muted, Row, Screen } from '../ui';

export default function SyncScreen() {
  const [account, setAccount] = useState<SyncAccount>(null);
  const [last, setLast] = useState<number | null>(null);
  const [url, setUrl] = useState('http://192.168.1.10:8787');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);

  const refresh = async () => {
    setAccount(await getAccount());
    setLast(await lastSyncAt());
  };
  useEffect(() => {
    refresh();
  }, []);

  const run = async (fn: () => Promise<void>) => {
    setBusy(true);
    try {
      await fn();
    } catch (e) {
      Alert.alert('Gagal', (e as Error).message);
    } finally {
      setBusy(false);
      refresh();
    }
  };

  const sync = () =>
    run(async () => {
      const r = await syncNow();
      Alert.alert('Sync selesai', `${r.sent} perubahan dikirim, ${r.received} diterima.`);
    });

  const login = (mode: 'login' | 'register') =>
    run(async () => {
      await signIn(url, email, password, mode);
      setPassword('');
      await syncNow();
    });

  const logout = () =>
    Alert.alert('Keluar dari akun sync?', 'Data di HP ini tetap ada.', [
      { text: 'Batal', style: 'cancel' },
      { text: 'Keluar', style: 'destructive', onPress: () => run(signOut) },
    ]);

  return (
    <Screen>
      <Card>
        <H>Sync (beta)</H>
        <Muted>
          Opsional. Data tetap tersimpan di HP dan aplikasi tetap jalan tanpa internet. Sync menyalin data ke server Kas milik Anda
          sendiri supaya bisa dipakai di HP lain. Data di server tidak dienkripsi end-to-end.
        </Muted>
      </Card>

      {busy && <ActivityIndicator color={C.accent} />}

      {account ? (
        <Card>
          <Muted>Masuk sebagai {account.email}</Muted>
          <Muted>Server: {account.url}</Muted>
          <Muted>Sync terakhir: {last ? new Date(last).toLocaleString('id-ID') : 'belum pernah'}</Muted>
          <Button title="Sinkronkan sekarang" onPress={sync} disabled={busy} testID="sync-now" />
          <Button kind="ghost" title="Keluar" onPress={logout} disabled={busy} testID="sync-logout" />
        </Card>
      ) : (
        <Card>
          <Field label="Alamat server" value={url} onChangeText={setUrl} autoCapitalize="none" autoCorrect={false} keyboardType="url" testID="sync-url" />
          <Field label="Email" value={email} onChangeText={setEmail} autoCapitalize="none" keyboardType="email-address" testID="sync-email" />
          <Field label="Password (min. 8)" value={password} onChangeText={setPassword} secureTextEntry autoCapitalize="none" testID="sync-password" />
          <Row>
            <Button title="Masuk" onPress={() => login('login')} disabled={busy} testID="sync-login" />
            <Button kind="ghost" title="Daftar akun baru" onPress={() => login('register')} disabled={busy} testID="sync-register" />
          </Row>
        </Card>
      )}
    </Screen>
  );
}
