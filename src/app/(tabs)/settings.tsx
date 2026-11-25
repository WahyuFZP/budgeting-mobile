import { router } from 'expo-router';
import { useEffect, useState } from 'react';
import { Alert, Pressable, Switch, Text } from 'react-native';
import { formatRupiah } from '../../domain';
import { setSetting } from '../../db/repo';
import { useCategories, useSettings, useWallets } from '../../hooks';
import { biometricAvailable, biometricEnabled, promptBiometric, setBiometric } from '../../lock';
import { Button, C, Card, Field, H, Muted, Row, Screen } from '../../ui';

export default function Settings() {
  const { wallets, balances } = useWallets();
  const categories = useCategories();
  const { payday } = useSettings();
  const [day, setDay] = useState(String(payday));
  const [bio, setBio] = useState(false);
  const [bioOk, setBioOk] = useState(false);

  useEffect(() => setDay(String(payday)), [payday]);
  useEffect(() => {
    biometricEnabled().then(setBio);
    biometricAvailable().then(setBioOk);
  }, []);

  const savePayday = () => {
    const n = Number(day);
    if (!Number.isInteger(n) || n < 1 || n > 31) return Alert.alert('Tanggal gajian harus 1–31');
    setSetting('payday', String(n));
    Alert.alert('Tersimpan', 'Periode budget baru dimulai tiap tanggal ' + n);
  };

  const toggleBio = async (on: boolean) => {
    if (on && !(await promptBiometric())) return;
    await setBiometric(on);
    setBio(on);
  };

  return (
    <Screen>
      <Card>
        <Row style={{ justifyContent: 'space-between' }}>
          <H>Dompet</H>
          <Button kind="ghost" title="+ Tambah" onPress={() => router.push('/wallet')} testID="add-wallet" />
        </Row>
        {wallets.map((w) => (
          <Pressable key={w.id} onPress={() => router.push({ pathname: '/wallet', params: { id: w.id } })} style={{ paddingVertical: 8 }} testID={`edit-wallet-${w.id}`}>
            <Row style={{ justifyContent: 'space-between' }}>
              <Text style={{ color: w.archived ? C.muted : C.text, fontWeight: '600' }}>
                {w.icon} {w.name}
                {w.archived ? ' (diarsipkan)' : ''}
              </Text>
              <Text style={{ color: C.text }}>{formatRupiah(balances.get(w.id) ?? 0)}</Text>
            </Row>
          </Pressable>
        ))}
      </Card>

      <Card>
        <Row style={{ justifyContent: 'space-between' }}>
          <H>Kategori</H>
          <Button kind="ghost" title="+ Tambah" onPress={() => router.push('/category')} testID="add-category" />
        </Row>
        {(['expense', 'income'] as const).map((kind) => (
          <Text key={kind} style={{ lineHeight: 34 }}>
            <Text style={{ color: C.muted }}>{kind === 'expense' ? 'Pengeluaran: ' : 'Pemasukan: '}</Text>
            {categories
              .filter((c) => c.kind === kind)
              .map((c) => (
                <Text key={c.id} onPress={() => router.push({ pathname: '/category', params: { id: c.id } })} style={{ color: c.hidden ? C.muted : C.text }}>
                  {c.icon} {c.name}
                  {c.hidden ? ' (disembunyikan)' : ''}
                  {'   '}
                </Text>
              ))}
          </Text>
        ))}
      </Card>

      <Card>
        <H>Periode budget</H>
        <Field label="Tanggal gajian (1–31)" value={day} onChangeText={setDay} keyboardType="number-pad" maxLength={2} testID="payday" />
        <Button kind="ghost" title="Simpan tanggal gajian" onPress={savePayday} testID="save-payday" />
      </Card>

      <Card>
        <H>Keamanan</H>
        {bioOk ? (
          <Row style={{ justifyContent: 'space-between' }}>
            <Text style={{ color: C.text }}>Buka dengan biometrik</Text>
            <Switch value={bio} onValueChange={toggleBio} testID="toggle-bio" />
          </Row>
        ) : (
          <Muted>Biometrik tidak tersedia atau belum didaftarkan di HP ini.</Muted>
        )}
        <Button kind="ghost" title="Ubah PIN" onPress={() => router.push('/pin')} testID="change-pin" />
      </Card>

      <Card>
        <H>Data</H>
        <Muted>Tanpa cloud: backup rutin agar data tidak hilang saat HP rusak/hilang.</Muted>
        <Button title="Backup & Restore" onPress={() => router.push('/backup')} testID="open-backup" />
        <Button kind="ghost" title="Sync ke server (beta)" onPress={() => router.push('/sync')} testID="open-sync" />
      </Card>
    </Screen>
  );
}
