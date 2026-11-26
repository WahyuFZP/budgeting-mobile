import { router } from 'expo-router';
import { useEffect, useState } from 'react';
import { Pressable, Switch, Text, View } from 'react-native';
import { formatRupiah } from '../domain';
import { setSetting } from '../db/repo';
import { useCategories, useSettings, useWallets } from '../hooks';
import { biometricAvailable, biometricEnabled, promptBiometric, setBiometric } from '../lock';
import { useTheme } from '../theme';
import { Button, Card, Field, H, Icon, ItemIcon, Muted, Row, Screen } from '../ui';
import { toast } from '../feedback';

export default function SettingsScreen() {
  const t = useTheme();
  const { wallets, balances } = useWallets();
  const categories = useCategories();
  const { payday, nickname } = useSettings();
  const [day, setDay] = useState(String(payday));
  const [name, setName] = useState(nickname);
  useEffect(() => setName(nickname), [nickname]);
  const [bio, setBio] = useState(false);
  const [bioOk, setBioOk] = useState(false);

  useEffect(() => setDay(String(payday)), [payday]);
  useEffect(() => {
    biometricEnabled().then(setBio);
    biometricAvailable().then(setBioOk);
  }, []);

  const savePayday = () => {
    const n = Number(day);
    if (!Number.isInteger(n) || n < 1 || n > 31) return toast('Tanggal gajian harus 1 sampai 31', 'error');
    setSetting('payday', String(n));
    toast('Tanggal gajian disimpan', 'success', `Periode budget dimulai tiap tanggal ${n}`);
  };

  const toggleBio = async (on: boolean) => {
    if (on && !(await promptBiometric())) return;
    await setBiometric(on);
    setBio(on);
  };

  const catPill = (c: (typeof categories)[number]) => (
    <Pressable
      key={c.id}
      onPress={() => router.push({ pathname: '/category', params: { id: c.id } })}
      accessibilityRole="button"
      accessibilityLabel={`Ubah kategori ${c.name}${c.hidden ? ', disembunyikan' : ''}`}
      style={({ pressed }) => ({ flexDirection: 'row', alignItems: 'center', gap: 8, minHeight: 44, paddingRight: 12, borderRadius: 22, backgroundColor: t.bg, opacity: pressed || c.hidden ? 0.6 : 1 })}
    >
      <ItemIcon icon={c.icon} color={c.color} size={32} />
      <Text style={{ color: t.text }}>
        {c.name}
        {c.hidden ? ' (disembunyikan)' : ''}
      </Text>
    </Pressable>
  );

  return (
    <Screen>
      <Card>
        <H>Profil</H>
        <Muted>Dipakai untuk sapaan di Beranda. Tersimpan hanya di HP ini.</Muted>
        <Field label="Nama panggilan" value={name} onChangeText={setName} placeholder="Nama Anda" maxLength={24} autoCapitalize="words" testID="nickname" />
        <Button kind="ghost" icon="account-check" title="Simpan nama" onPress={() => (setSetting('nickname', name.trim()), toast('Nama disimpan', 'success'))} testID="save-nickname" />
      </Card>

      <Card>
        <Row style={{ justifyContent: 'space-between' }}>
          <H>Dompet</H>
          <Button kind="ghost" icon="plus" title="Tambah" onPress={() => router.push('/wallet')} testID="add-wallet" />
        </Row>
        {wallets.map((w) => (
          <Pressable
            key={w.id}
            onPress={() => router.push({ pathname: '/wallet', params: { id: w.id } })}
            style={({ pressed }) => [{ paddingVertical: 8, opacity: pressed ? 0.6 : 1 }]}
            accessibilityRole="button"
            accessibilityLabel={`Ubah dompet ${w.name}`}
            testID={`edit-wallet-${w.id}`}
          >
            <Row style={{ gap: 12 }}>
              <ItemIcon icon={w.icon} color={w.color} size={36} />
              <Text style={{ color: w.archived ? t.muted : t.text, fontWeight: '600', flex: 1 }} numberOfLines={1}>
                {w.name}
                {w.archived ? ' (diarsipkan)' : ''}
              </Text>
              <Text style={{ color: t.text, fontVariant: ['tabular-nums'] }}>{formatRupiah(balances.get(w.id) ?? 0)}</Text>
            </Row>
          </Pressable>
        ))}
      </Card>

      <Card>
        <Row style={{ justifyContent: 'space-between' }}>
          <H>Kategori</H>
          <Button kind="ghost" icon="plus" title="Tambah" onPress={() => router.push('/category')} testID="add-category" />
        </Row>
        {(['expense', 'income'] as const).map((kind) => (
          <View key={kind} style={{ gap: 8 }}>
            <Muted>{kind === 'expense' ? 'Pengeluaran' : 'Pemasukan'}</Muted>
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>{categories.filter((c) => c.kind === kind).map(catPill)}</View>
          </View>
        ))}
      </Card>

      <Card>
        <H>Periode budget</H>
        <Field label="Tanggal gajian (1 sampai 31)" value={day} onChangeText={setDay} keyboardType="number-pad" maxLength={2} testID="payday" />
        <Button kind="ghost" icon="calendar-check" title="Simpan tanggal gajian" onPress={savePayday} testID="save-payday" />
      </Card>

      <Card>
        <H>Tagihan & template</H>
        <Muted>Tagihan bulanan diingatkan menjelang jatuh tempo. Template mencatat transaksi rutin dengan satu ketukan.</Muted>
        <Button kind="ghost" icon="calendar-sync" title="Atur tagihan & template" onPress={() => router.push('/recurring')} testID="open-recurring" />
      </Card>

      <Card>
        <H>Keamanan</H>
        {bioOk ? (
          <Row style={{ justifyContent: 'space-between', minHeight: 44 }}>
            <Row>
              <Icon name="fingerprint" color={t.text} />
              <Text style={{ color: t.text }}>Buka dengan sidik jari / wajah</Text>
            </Row>
            <Switch
              value={bio}
              onValueChange={toggleBio}
              testID="toggle-bio"
              accessibilityLabel="Buka dengan sidik jari atau wajah"
              trackColor={{ true: t.mark, false: t.line }}
              thumbColor={t.card}
            />
          </Row>
        ) : (
          <Muted>Sidik jari / wajah belum didaftarkan di pengaturan HP ini, jadi Kas hanya bisa dibuka dengan PIN.</Muted>
        )}
        <Button kind="ghost" icon="lock" title="Ubah PIN" onPress={() => router.push('/pin')} testID="change-pin" />
      </Card>

      <Card>
        <H>Data</H>
        <Muted>Data hanya ada di HP ini. Backup rutin supaya tidak hilang saat HP rusak atau hilang.</Muted>
        <Button icon="backup-restore" title="Backup & Restore" onPress={() => router.push('/backup')} testID="open-backup" />
        <Button kind="ghost" icon="cloud-sync" title="Sync ke server (beta)" onPress={() => router.push('/sync')} testID="open-sync" />
      </Card>
    </Screen>
  );
}
