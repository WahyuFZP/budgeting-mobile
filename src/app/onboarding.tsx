import { useEffect, useRef, useState } from 'react';
import { Pressable, Text, View, useWindowDimensions } from 'react-native';
import Animated, { interpolate, useAnimatedScrollHandler, useAnimatedStyle, useSharedValue, type SharedValue } from 'react-native-reanimated';
import { SafeAreaView } from 'react-native-safe-area-context';
import { formatRupiah, parseRupiah } from '../domain';
import { saveWallet, setSetting } from '../db/repo';
import { biometricAvailable, hasPin, setBiometric, setPin, useLock } from '../lock';
import { PALETTE, useTheme } from '../theme';
import { Button, Card, Field, H, Icon, Muted, Forest, PinPad, Row, Screen, type IconName } from '../ui';
import { toast } from '../feedback';


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
    if (!Number.isInteger(day) || day < 1 || day > 31) return toast('Tanggal gajian harus antara 1 dan 31', 'error');
    try {
      saveWallet({ name, type: 'cash', initialBalance: parseRupiah(balance) ?? 0, color: PALETTE[0] });
      setSetting('payday', String(day));
      done({ onboarded: true, locked: false });
    } catch (e) {
      toast('Belum bisa disimpan', 'error', (e as Error).message);
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
        {step === 'intro' && <Intro onDone={() => setStep('pin')} />}
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

/** Page dot that widens as its slide scrolls into view. */
function Dot({ i, x, w }: { i: number; x: SharedValue<number>; w: number }) {
  const t = useTheme();
  const style = useAnimatedStyle(() => {
    const d = [(i - 1) * w, i * w, (i + 1) * w];
    return { width: interpolate(x.value, d, [8, 24, 8], 'clamp'), opacity: interpolate(x.value, d, [0.35, 1, 0.35], 'clamp') };
  });
  return <Animated.View style={[{ height: 8, borderRadius: 4, backgroundColor: t.primary }, style]} />;
}

/** Welcome: the squirrel's forest stays put while three short slides explain Kas underneath. */
function Intro({ onDone }: { onDone: () => void }) {
  const t = useTheme();
  const { width } = useWindowDimensions();
  const w = width - 32; // Screen padding
  const x = useSharedValue(0);
  const [page, setPage] = useState(0);
  const pager = useRef<Animated.ScrollView>(null);
  const onScroll = useAnimatedScrollHandler((e) => {
    x.value = e.contentOffset.x;
  });
  const last = page === INTRO.length - 1;
  const next = () => (last ? onDone() : pager.current?.scrollTo({ x: (page + 1) * w, animated: true }));

  return (
    <>
      <Row style={{ justifyContent: 'space-between' }}>
        <Text style={{ color: t.text, fontSize: 28, fontWeight: '800' }}>Kas</Text>
        {!last && (
          <Pressable onPress={onDone} accessibilityRole="button" hitSlop={10} testID="onb-skip" style={{ minHeight: 44, justifyContent: 'center' }}>
            <Text style={{ color: t.mark, fontWeight: '600' }}>Lewati</Text>
          </Pressable>
        )}
      </Row>
      <View style={{ alignItems: 'center' }}>
        <Forest width={Math.min(320, w)} height={230} alwaysLive />
      </View>
      <Animated.ScrollView
        ref={pager}
        horizontal
        pagingEnabled
        showsHorizontalScrollIndicator={false}
        onScroll={onScroll}
        scrollEventThrottle={16}
        onMomentumScrollEnd={(e) => setPage(Math.round(e.nativeEvent.contentOffset.x / w))}
        style={{ width: w }}
      >
        {INTRO.map(([icon, title, body]) => (
          <View key={title} style={{ width: w, gap: 8, paddingRight: 8 }} accessible accessibilityLabel={`${title}. ${body}`}>
            <Icon name={icon} size={32} color={t.income} />
            <Text style={{ color: t.text, fontWeight: '800', fontSize: 22 }}>{title}</Text>
            <Text style={{ color: t.muted, fontSize: 16 }}>{body}</Text>
          </View>
        ))}
      </Animated.ScrollView>
      <Row style={{ gap: 6, justifyContent: 'center', marginVertical: 8 }}>
        {INTRO.map((_, i) => (
          <Dot key={i} i={i} x={x} w={w} />
        ))}
      </Row>
      <Button title={last ? 'Buat PIN dan mulai' : 'Lanjut'} icon={last ? 'lock' : undefined} onPress={next} testID={last ? 'onb-start' : 'onb-next'} />
    </>
  );
}
