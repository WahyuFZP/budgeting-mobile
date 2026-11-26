import { router } from 'expo-router';
import { useState } from 'react';
import { View } from 'react-native';
import { checkPin, setPin } from '../lock';
import { useTheme } from '../theme';
import { PinPad } from '../ui';
import { toast } from '../feedback';

export default function ChangePin() {
  const t = useTheme();
  const [step, setStep] = useState<'old' | 'new' | 'confirm'>('old');
  const [next, setNext] = useState('');
  const [error, setError] = useState<string>();

  const onComplete = async (p: string) => {
    if (step === 'old') {
      if (!(await checkPin(p))) return setError('PIN lama salah');
      setError(undefined);
      return setStep('new');
    }
    if (step === 'new') {
      setNext(p);
      return setStep('confirm');
    }
    if (p !== next) {
      setError('PIN tidak sama, ulangi');
      return setStep('new');
    }
    await setPin(p);
    toast('PIN diubah', 'success', 'Pakai PIN baru saat membuka Kas.');
    router.back();
  };

  return (
    <View style={{ flex: 1, justifyContent: 'center', backgroundColor: t.bg }}>
      <PinPad key={step} title={step === 'old' ? 'PIN lama' : step === 'new' ? 'PIN baru' : 'Ulangi PIN baru'} error={error} onComplete={onComplete} />
    </View>
  );
}
