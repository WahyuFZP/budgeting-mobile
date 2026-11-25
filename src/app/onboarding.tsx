import { useState } from 'react';
import { Alert, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { parseRupiah } from '../domain';
import { saveWallet, setSetting } from '../db/repo';
import { biometricAvailable, setBiometric, setPin, useLock } from '../lock';
import { Button, C, Card, Field, H, Muted, PinPad, Screen, s } from '../ui';

// shortcut: static emoji instead of the 3D wallet/coin scene (React Three Fiber deferred to the next phase)
const INTRO = [
  ['🔒', '100% offline', 'Data tersimpan terenkripsi di HP ini. Tanpa akun, tanpa server.'],
  ['⚡', 'Catat dalam 3 ketukan', 'Tombol +, ketik nominal, pilih kategori, simpan.'],
  ['📊', 'Sisa budget real-time', 'Tahu sisa uang per kategori sampai gajian berikutnya.'],
];

export default function Onboarding() {
  const [step, setStep] = useState<'intro' | 'pin' | 'confirm' | 'bio' | 'payday' | 'wallet'>('intro');
  const [pin, setPinValue] = useState('');
  const [pinError, setPinError] = useState<string>();
  const [payday, setPayday] = useState('1');
  const [name, setName] = useState('Cash');
  const [balance, setBalance] = useState('');
  const done = useLock((st) => st.set);

  const afterPin = async () => setStep((await biometricAvailable()) ? 'bio' : 'payday');

  const finish = () => {
    const day = Number(payday);
    if (!Number.isInteger(day) || day < 1 || day > 31) return Alert.alert('Tanggal gajian harus 1–31');
    try {
      saveWallet({ name, type: 'cash', initialBalance: parseRupiah(balance) ?? 0, color: '#0B7A5C' });
      setSetting('payday', String(day));
      done({ onboarded: true, locked: false });
    } catch (e) {
      Alert.alert((e as Error).message);
    }
  };

  if (step === 'pin' || step === 'confirm')
    return (
      <SafeAreaView style={{ flex: 1, justifyContent: 'center', backgroundColor: C.bg }}>
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
        <Text style={[s.muted, { textAlign: 'center', padding: 24 }]}>
          Tanpa cloud, lupa PIN berarti data harus dihapus (install ulang). Aktifkan biometrik dan rutin backup.
        </Text>
      </SafeAreaView>
    );

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: C.bg }}>
      <Screen>
        {step === 'intro' && (
          <>
            <Text style={[s.big, { marginTop: 24 }]}>Kas</Text>
            {INTRO.map(([icon, title, body]) => (
              <Card key={title}>
                <Text style={{ fontSize: 32 }}>{icon}</Text>
                <H>{title}</H>
                <Muted>{body}</Muted>
              </Card>
            ))}
            <Button title="Mulai" onPress={() => setStep('pin')} testID="onb-start" />
          </>
        )}
        {step === 'bio' && (
          <Card>
            <H>Pakai sidik jari / Face ID?</H>
            <Muted>Buka aplikasi lebih cepat. PIN tetap bisa dipakai.</Muted>
            <Button title="Aktifkan" onPress={() => setBiometric(true).then(() => setStep('payday'))} testID="onb-bio-on" />
            <Button kind="ghost" title="Lewati" onPress={() => setStep('payday')} testID="onb-bio-skip" />
          </Card>
        )}
        {step === 'payday' && (
          <Card>
            <H>Tanggal gajian</H>
            <Muted>Periode budget dimulai di tanggal ini setiap bulan.</Muted>
            <Field value={payday} onChangeText={setPayday} keyboardType="number-pad" maxLength={2} testID="onb-payday" />
            <Button title="Lanjut" onPress={() => setStep('wallet')} testID="onb-payday-next" />
          </Card>
        )}
        {step === 'wallet' && (
          <Card>
            <H>Dompet pertama</H>
            <Field label="Nama" value={name} onChangeText={setName} testID="onb-wallet-name" />
            <Field label="Saldo awal (Rp)" value={balance} onChangeText={setBalance} keyboardType="number-pad" placeholder="0" testID="onb-wallet-balance" />
            <View style={{ height: 4 }} />
            <Button title="Selesai" onPress={finish} testID="onb-finish" />
          </Card>
        )}
      </Screen>
    </SafeAreaView>
  );
}
