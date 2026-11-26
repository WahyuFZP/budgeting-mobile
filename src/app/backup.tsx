import { useState } from 'react';
import { ActivityIndicator } from 'react-native';
import { exportBackup, readBackup } from '../db/backup';
import { resetSyncState } from '../db/sync';
import { useSettings } from '../hooks';
import { useTheme } from '../theme';
import { confirm, toast } from '../feedback';
import { Button, Card, Field, H, Muted, Screen } from '../ui';

export default function BackupScreen() {
  const t = useTheme();
  const { lastBackup } = useSettings();
  const [pw, setPw] = useState('');
  const [busy, setBusy] = useState(false);

  const run = async (fn: () => Promise<void>) => {
    setBusy(true);
    try {
      await fn();
    } catch (e) {
      toast('Gagal', 'error', (e as Error).message);
    } finally {
      setBusy(false);
    }
  };

  const doExport = () => run(async () => (await exportBackup(pw), toast('Backup dibuat', 'success', 'Simpan file .kasbak di tempat yang aman.')));

  const doImport = () =>
    run(async () => {
      const b = await readBackup(pw);
      if (!b) return;
      const c = b.counts;
      const ok = await confirm({
        title: 'Ganti semua data?',
        body: `Backup berisi ${c.wallets} dompet, ${c.transactions} transaksi, ${c.budgets} budget. Data di HP ini akan DIGANTI seluruhnya.`,
        confirm: 'Pulihkan',
        destructive: true,
        icon: 'backup-restore',
      });
      if (!ok) return;
      b.apply(); // errors land in run()'s catch as an error toast
      resetSyncState(); // restored rows may be older than what was synced: re-send and re-fetch all, LWW decides
      toast('Data dipulihkan', 'success', `${c.transactions} transaksi dari backup`);
    });

  return (
    <Screen>
      <Card>
        <H>Password backup</H>
        <Muted>File backup dienkripsi (AES-256) dengan password ini. Tanpa password ini, file tidak bisa dibuka oleh siapa pun, termasuk Anda sendiri. Simpan baik-baik.</Muted>
        <Field value={pw} onChangeText={setPw} secureTextEntry placeholder="Minimal 6 karakter" autoCapitalize="none" testID="backup-password" />
        <Muted>Backup terakhir: {lastBackup ? new Date(lastBackup).toLocaleString('id-ID') : 'belum pernah'}</Muted>
      </Card>
      {busy ? (
        <ActivityIndicator color={t.primary} accessibilityLabel="Memproses backup" />
      ) : (
        <>
          <Button icon="backup-restore" title="Ekspor backup" onPress={doExport} disabled={pw.length < 6} testID="export-backup" />
          <Button kind="ghost" icon="file-import" title="Impor dari file" onPress={doImport} disabled={pw.length < 6} testID="import-backup" />
        </>
      )}
    </Screen>
  );
}
