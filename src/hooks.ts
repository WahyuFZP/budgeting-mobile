import { useLiveQuery } from 'drizzle-orm/expo-sqlite';
import { useMemo } from 'react';
import { formatRupiah, periodFor, reminders, spentByCategory, walletBalances } from './domain';
import { q, ruleTemplate, runRule, undoRun, type Rule } from './db/repo';
import { toast } from './feedback';

export function useSettings() {
  const { data } = useLiveQuery(q.settings());
  return useMemo(() => {
    const m: Record<string, string> = Object.fromEntries(data.map((r) => [r.key, r.value]));
    return { ...m, payday: Number(m.payday ?? 1), lastWallet: m.last_wallet, lastCat: { income: m.last_cat_income, expense: m.last_cat_expense } as Record<string, string | undefined>, lastBackup: m.last_backup ? Number(m.last_backup) : null, nickname: m.nickname ?? '', hideBalance: m.hide_balance === '1' };
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

/** Live list for the bell on Beranda (see domain reminders()). */
export function useReminders() {
  const { lastBackup } = useSettings();
  const { period } = useCurrentPeriod();
  const { wallets } = useWallets();
  const categories = useCategories();
  const deps = [period.start.getTime()];
  const { data: budgets } = useLiveQuery(q.budgets(period), deps);
  const { data: flow } = useLiveQuery(q.flowTxs(period), deps);
  const { data: latest } = useLiveQuery(q.history({}, 1));
  const { bills } = useRules();
  return useMemo(() => {
    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const spent = spentByCategory(flow, period);
    const name = new Map(categories.map((c) => [c.id, c.name]));
    return reminders({
      now,
      lastBackup,
      firstUse: Math.min(...wallets.map((w) => w.createdAt.getTime()), now.getTime()),
      budgets: budgets.map((b) => ({ name: name.get(b.categoryId) ?? 'kategori', limit: b.limitAmount, spent: spent.get(b.categoryId) ?? 0 })),
      hasAnyTx: latest.length > 0,
      hasTxToday: latest.length > 0 && latest[0].occurredAt >= today,
      bills: bills.map((b) => ({ name: b.tpl.name, amount: b.tpl.amount, due: b.rule.nextRunAt })),
    });
  }, [lastBackup, wallets, categories, budgets, flow, latest, period, bills]);
}

/** Monthly bills (soonest first) and one-tap templates, with their parsed templates. */
export function useRules() {
  const { data } = useLiveQuery(q.rules());
  return useMemo(() => {
    const all = data.map((rule) => ({ rule, tpl: ruleTemplate(rule) }));
    return { bills: all.filter((r) => r.rule.frequency === 'monthly'), templates: all.filter((r) => r.rule.frequency === 'none') };
  }, [data]);
}

/** Records a bill or template now; the toast offers undo, which also puts a bill's due date back. */
export function recordRule(rule: Rule, label: string) {
  try {
    const u = runRule(rule);
    const t = ruleTemplate(rule);
    toast(label, 'success', `${t.name}, ${formatRupiah(t.amount)}`, { label: 'Urungkan', onPress: () => (undoRun(u), toast('Dibatalkan', 'info')) });
  } catch (e) {
    // e.g. the wallet or category behind the template was deleted since
    toast('Belum bisa dicatat', 'error', `${(e as Error).message}. Ubah dulu ${ruleTemplate(rule).name}.`);
  }
}
