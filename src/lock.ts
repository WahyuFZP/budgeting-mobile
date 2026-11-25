// App lock: 6-digit PIN (salted SHA-256 in SecureStore) + optional biometrics. UI state via Zustand.
import { CryptoDigestAlgorithm, digestStringAsync, randomUUID } from 'expo-crypto';
import * as LocalAuthentication from 'expo-local-authentication';
import * as SecureStore from 'expo-secure-store';
import { create } from 'zustand';

type LockState = { onboarded: boolean; locked: boolean; set: (s: Partial<LockState>) => void };
export const useLock = create<LockState>((set) => ({ onboarded: false, locked: true, set }));

const hash = (salt: string, pin: string) => digestStringAsync(CryptoDigestAlgorithm.SHA256, `${salt}:${pin}`);

export const hasPin = async () => !!(await SecureStore.getItemAsync('pin_hash'));

export async function setPin(pin: string) {
  if (!/^\d{6}$/.test(pin)) throw new Error('PIN harus 6 digit');
  const salt = randomUUID();
  await SecureStore.setItemAsync('pin_salt', salt);
  await SecureStore.setItemAsync('pin_hash', await hash(salt, pin));
}

export async function checkPin(pin: string) {
  const [salt, stored] = await Promise.all([SecureStore.getItemAsync('pin_salt'), SecureStore.getItemAsync('pin_hash')]);
  return !!salt && !!stored && (await hash(salt, pin)) === stored;
}

export const biometricEnabled = async () => (await SecureStore.getItemAsync('bio')) === '1';
export const setBiometric = (on: boolean) => SecureStore.setItemAsync('bio', on ? '1' : '0');

export async function biometricAvailable() {
  return (await LocalAuthentication.hasHardwareAsync()) && (await LocalAuthentication.isEnrolledAsync());
}

export async function promptBiometric() {
  const r = await LocalAuthentication.authenticateAsync({ promptMessage: 'Buka Kas', cancelLabel: 'Pakai PIN', disableDeviceFallback: true });
  return r.success;
}
