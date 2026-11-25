import { useLiveQuery } from 'drizzle-orm/expo-sqlite';
import { useMemo } from 'react';
import { periodFor, walletBalances } from './domain';
import { q } from './db/repo';

export function useSettings() {
  const { data } = useLiveQuery(q.settings());
  return useMemo(() => {
    const m: Record<string, string> = Object.fromEntries(data.map((r) => [r.key, r.value]));
    return { ...m, payday: Number(m.payday ?? 1), lastWallet: m.last_wallet, lastBackup: m.last_backup ? Number(m.last_backup) : null };
  }, [data]);
}

export function useWallets() {
  const { data: wallets } = useLiveQuery(q.wallets());
  const { data: txs } = useLiveQuery(q.balanceTxs());
  const balances = useMemo(() => walletBalances(wallets, txs), [wallets, txs]);
  const active = wallets.filter((w) => !w.archived);
  const total = active.reduce((s, w) => s + (balances.get(w.id) ?? 0), 0);
  return { wallets, active, balances, total };
}

export const useCategories = () => useLiveQuery(q.categories()).data;

export function useCurrentPeriod() {
  const { payday } = useSettings();
  return { payday, period: periodFor(new Date(), payday) };
}

export const fmtDate = (d: Date) => d.toLocaleDateString('id-ID', { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' });
export const fmtPeriod = (p: { start: Date; end: Date }) =>
  `${p.start.toLocaleDateString('id-ID', { day: 'numeric', month: 'short' })} – ${new Date(p.end.getTime() - 1).toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' })}`;
