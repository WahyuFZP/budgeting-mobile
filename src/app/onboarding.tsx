import { lazy, Suspense, useEffect, useState } from 'react';
import { Alert, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { formatRupiah, parseRupiah } from '../domain';
import { saveWallet, setSetting } from '../db/repo';
import { biometricAvailable, hasPin, setBiometric, setPin, useLock } from '../lock';
import { PALETTE, useTheme } from '../theme';
import { Button, Card, Field, H, Icon, Muted, PiggyBoundary, PiggyFallback, PinPad, Row, Screen, type IconName } from '../ui';

const Piggy3D = lazy(() => import('../Piggy3D'));

const INTRO: [IconName, string, string][] = [
  ['shield-lock', 'Data tetap di HP ini', 'Tersimpan terenkripsi. Tanpa akun, tanpa server, jalan tanpa internet.'],
  ['plus-circle', 'Catat dalam 3 ketukan', 'Tombol +, ketik nominal, pilih kategori.'],
  ['chart-donut', 'Sisa budget sampai gajian', 'Lihat sisa uang per kategori kapan saja.'],
];

export default function Onboarding() {
  const t = useTheme();
  const [step, setStep] = useState<'intro' | 'pin' | 'confirm' | 'bio' | 'payday' | 'wallet'>('intro');
  // PIN already set (onboarding was interrupted before the wallet step): resume there instead of redoing the PIN
  useEffect(() => {
    hasPin().then((p) => p && setStep('payday'));
  }, []);
  const [pin, setPinValue] = useState('');
  const [pinError, setPinError] = useState<string>();
  const [payday, setPayday] = useState('1');
  const [name, setName] = useState('Tunai');
  const [balance, setBalance] = useState('');
  const done = useLock((st) => st.set);

  const afterPin = async () => setStep((await biometricAvailable()) ? 'bio' : 'payday');

  const finish = () => {
    const day = Number(payday);
    if (!Number.isInteger(day) || day < 1 || day > 31) return Alert.alert('Tanggal gajian harus antara 1 dan 31');
    try {
      saveWallet({ name, type: 'cash', initialBalance: parseRupiah(balance) ?? 0, color: PALETTE[0] });
      setSetting('payday', String(day));
      done({ onboarded: true, locked: false });
    } catch (e) {
      Alert.alert('Belum bisa disimpan', (e as Error).message);
    }
  };

  if (step === 'pin' || step === 'confirm')
    return (
      <SafeAreaView style={{ flex: 1, justifyContent: 'center', backgroundColor: t.bg }}>
        <PinPad
          key={step}
          title={step === 'pin' ? 'Buat PIN 6 digit' : 'Ulangi PIN'}
          error={pinError}
          onComplete={async (p) => {
            if (step === 'pin') {
              setPinValue(p);
              setPinError(undefined);
              return setStep('confirm');
            }
            if (p !== pin) {
              setPinError('PIN tidak sama, ulangi dari awal');
              return setStep('pin');
            }
            await setPin(p);
            afterPin();
          }}
        />
        <Text style={{ color: t.muted, textAlign: 'center', padding: 24 }}>
          Tanpa cloud, lupa PIN berarti data harus dihapus (install ulang). Aktifkan sidik jari dan rutin backup.
        </Text>
      </SafeAreaView>
    );

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: t.bg }}>
      <Screen>
        {step === 'intro' && (
          <>
            <View style={{ alignItems: 'center' }}>
              <PiggyBoundary>
                <Suspense fallback={<PiggyFallback />}>
                  <Piggy3D alwaysLive />
                </Suspense>
              </PiggyBoundary>
            </View>
            <Text style={{ color: t.text, fontSize: 40, fontWeight: '800' }}>Kas</Text>
            <Text style={{ color: t.muted, fontSize: 17 }}>Catat uang keluar-masuk, tahu sisa budget sampai gajian berikutnya.</Text>
            <View style={{ gap: 16, marginVertical: 12 }}>
              {INTRO.map(([icon, title, body]) => (
                <Row key={title} style={{ gap: 14, alignItems: 'flex-start' }}>
                  <Icon name={icon} size={28} color={t.income} />
                  <View style={{ flex: 1, gap: 2 }}>
                    <Text style={{ color: t.text, fontWeight: '700', fontSize: 16 }}>{title}</Text>
                    <Muted>{body}</Muted>
                  </View>
                </Row>
              ))}
            </View>
            <Button title="Buat PIN dan mulai" icon="lock" onPress={() => setStep('pin')} testID="onb-start" />
          </>
        )}
        {step === 'bio' && (
          <Card>
            <H>Buka dengan sidik jari / wajah?</H>
            <Muted>Lebih cepat dari mengetik PIN. PIN tetap bisa dipakai kapan saja.</Muted>
            <Button title="Aktifkan" icon="fingerprint" onPress={() => setBiometric(true).then(() => setStep('payday'))} testID="onb-bio-on" />
            <Button kind="ghost" title="Nanti saja" onPress={() => setStep('payday')} testID="onb-bio-skip" />
          </Card>
        )}
        {step === 'payday' && (
          <Card>
            <H>Tanggal gajian</H>
            <Muted>Periode budget dimulai di tanggal ini setiap bulan.</Muted>
            <Field label="Tanggal (1 sampai 31)" value={payday} onChangeText={setPayday} keyboardType="number-pad" maxLength={2} testID="onb-payday" />
            <Button title="Lanjut" onPress={() => setStep('wallet')} testID="onb-payday-next" />
          </Card>
        )}
        {step === 'wallet' && (
          <Card>
            <H>Dompet pertama</H>
            <Muted>Uang tunai yang Anda pegang sekarang. Rekening dan e-wallet bisa ditambah nanti.</Muted>
            <Field label="Nama" value={name} onChangeText={setName} testID="onb-wallet-name" />
            <Field label="Saldo awal" value={balance ? formatRupiah(parseRupiah(balance) ?? 0) : ''} onChangeText={setBalance} keyboardType="number-pad" placeholder="0" testID="onb-wallet-balance" />
            <Button title="Selesai, buka Kas" icon="check" onPress={finish} testID="onb-finish" />
          </Card>
        )}
      </Screen>
    </SafeAreaView>
  );
}
