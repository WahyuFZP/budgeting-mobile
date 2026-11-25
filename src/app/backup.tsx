import { useState } from 'react';
import { ActivityIndicator, Alert } from 'react-native';
import { exportBackup, readBackup } from '../db/backup';
import { resetSyncState } from '../db/sync';
import { useSettings } from '../hooks';
import { Button, C, Card, Field, H, Muted, Screen } from '../ui';

export default function BackupScreen() {
  const { lastBackup } = useSettings();
  const [pw, setPw] = useState('');
  const [busy, setBusy] = useState(false);

  const run = async (fn: () => Promise<void>) => {
    setBusy(true);
    try {
      await fn();
    } catch (e) {
      Alert.alert('Gagal', (e as Error).message);
    } finally {
      setBusy(false);
    }
  };

  const doExport = () => run(() => exportBackup(pw));

  const doImport = () =>
    run(async () => {
      const b = await readBackup(pw);
      if (!b) return;
      const c = b.counts;
      Alert.alert(
        'Ganti semua data?',
        `Backup berisi ${c.wallets} dompet, ${c.transactions} transaksi, ${c.budgets} budget. Data di HP ini akan DIGANTI seluruhnya.`,
        [
          { text: 'Batal', style: 'cancel' },
          {
            text: 'Pulihkan',
            style: 'destructive',
            onPress: () => {
              try {
                b.apply();
                resetSyncState(); // restored rows may be older than what was synced: re-send and re-fetch all, LWW decides
                Alert.alert('Data dipulihkan');
              } catch (e) {
                Alert.alert('Gagal memulihkan', (e as Error).message);
              }
            },
          },
        ],
      );
    });

  return (
    <Screen>
      <Card>
        <H>Password backup</H>
        <Muted>File backup dienkripsi (AES-256) dengan password ini. Tanpa password, file tidak bisa dibuka — termasuk oleh kami.</Muted>
        <Field value={pw} onChangeText={setPw} secureTextEntry placeholder="Minimal 6 karakter" autoCapitalize="none" testID="backup-password" />
        <Muted>Backup terakhir: {lastBackup ? new Date(lastBackup).toLocaleString('id-ID') : 'belum pernah'}</Muted>
      </Card>
      {busy ? (
        <ActivityIndicator color={C.accent} />
      ) : (
        <>
          <Button title="Ekspor backup" onPress={doExport} disabled={pw.length < 6} testID="export-backup" />
          <Button kind="ghost" title="Impor dari file…" onPress={doImport} disabled={pw.length < 6} testID="import-backup" />
        </>
      )}
    </Screen>
  );
}
