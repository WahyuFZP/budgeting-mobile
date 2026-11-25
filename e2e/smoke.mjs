// Click-through smoke test on a real Android device or emulator, driven over adb.
// Finds elements by testID (Android resource-id), taps them, and checks what the screen shows.
// Requirements: Kas open and unlocked, Metro running, input from PC allowed
// (Xiaomi: Developer options > "USB debugging (Security settings)").
// Test data is tagged "E2E" and deleted again at the end, so the phone's real data is left as it was.
//   node e2e/smoke.mjs
import { execFileSync } from 'node:child_process';
import { join } from 'node:path';

const ADB = process.env.ADB ?? join(process.env.LOCALAPPDATA ?? '', 'Android/Sdk/platform-tools/adb.exe');
const adb = (...a) => execFileSync(ADB, a, { encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 });
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const results = [];

/** Current UI as a flat list of nodes. */
function screen() {
  // uiautomator can report "could not get idle state" while an animation is running; the dump still works on retry
  for (let i = 0; i < 3; i++) {
    try {
      adb('shell', 'uiautomator', 'dump', '/sdcard/kas-e2e.xml');
      break;
    } catch {}
  }
  const xml = adb('shell', 'cat', '/sdcard/kas-e2e.xml');
  return [...xml.matchAll(/<node ([^>]*?)\/?>/g)].map(([, a]) => {
    const attr = (k) => a.match(new RegExp(`${k}="([^"]*)"`))?.[1] ?? '';
    const [x1, y1, x2, y2] = attr('bounds').match(/\d+/g)?.map(Number) ?? [0, 0, 0, 0];
    return { id: attr('resource-id'), text: attr('text'), desc: attr('content-desc'), selected: attr('selected') === 'true', cx: (x1 + x2) >> 1, cy: (y1 + y2) >> 1 };
  });
}
const label = (n) => `${n.text} ${n.desc}`.toLowerCase();

async function waitFor(pred, what, ms = 8000) {
  const end = Date.now() + ms;
  for (;;) {
    const nodes = screen();
    const hit = nodes.find(pred);
    if (hit) return hit;
    if (Date.now() > end) throw new Error(`tidak ditemukan: ${what}`);
    await sleep(400);
  }
}
const byId = (id) => waitFor((n) => n.id === id, `#${id}`);
const byText = (t) => waitFor((n) => label(n).includes(t.toLowerCase()), `"${t}"`);
const tap = async (n) => {
  adb('shell', 'input', 'tap', String(n.cx), String(n.cy));
  await sleep(700);
};
const type = async (s) => {
  adb('shell', 'input', 'text', s.replace(/ /g, '%s'));
  await sleep(400);
};
const back = async () => {
  adb('shell', 'input', 'keyevent', 'KEYCODE_BACK');
  await sleep(800);
};
/** Close the on-screen keyboard only if it is open (Back with no keyboard would close the screen instead). */
const hideKeyboard = async () => {
  await sleep(500);
  if (/mInputShown=true/.test(adb('shell', 'dumpsys input_method | grep mInputShown'))) {
    await back();
    await sleep(700); // let the layout settle, or coordinates read now are stale by the time we tap
  }
};
const swipeUp = async () => {
  adb('shell', 'input', 'swipe', '600', '1800', '600', '700', '300');
  await sleep(800);
};
/** Tap a chip and check the app now reports it as selected. */
const select = async (id) => {
  await tap(await byId(id));
  if (!screen().find((n) => n.id === id)?.selected) throw new Error(`${id} tidak terpilih setelah diketuk`);
};

const kasOnTop = () => adb("shell", "dumpsys activity activities | grep topResumedActivity").includes("id.iseng.kas/");

/** Every step starts from Beranda, so one failure does not cascade. Back is pressed only while Kas is on screen. */
async function home() {
  for (let i = 0; i < 4; i++) {
    if (!kasOnTop()) {
      adb('shell', 'monkey', '-p', 'id.iseng.kas', '-c', 'android.intent.category.LAUNCHER', '1');
      await sleep(3000);
    }
    if (screen().some((n) => n.id === 'tab-index')) break;
    await back();
  }
  await tap(await byId('tab-index'));
}

const NAVBAR_TOP = 2300; // floating tab bar covers the screen below this y (1220x2712 screens)

/** Riwayat keeps filters set from a Laporan bar; tap every active filter chip off. */
async function clearHistoryFilters() {
  for (let i = 0; i < 5; i++) {
    const on = screen().find((n) => n.selected && n.cy < NAVBAR_TOP && !n.id.startsWith('tab-'));
    if (!on) return;
    await tap(on);
  }
}

/** Open the transaction form; a tap during the previous modal's closing animation can be swallowed, so retry once. */
async function openForm() {
  for (let i = 0; i < 2; i++) {
    await tap(await byId('fab-add'));
    try {
      return await waitFor((n) => n.id === 'amount', '#amount', 4000);
    } catch {}
  }
  throw new Error('form transaksi tidak terbuka dari tombol +');
}

/** Empty the focused text field before typing into it. */
const clearField = async () => {
  adb('shell', 'input', 'keyevent', 'KEYCODE_MOVE_END');
  adb('shell', 'input', 'keyevent', ...Array(40).fill('KEYCODE_DEL'));
  await sleep(300);
};

async function step(name, fn) {
  try {
    await home();
    await fn();
    results.push(['PASS', name]);
  } catch (e) {
    results.push(['FAIL', `${name}: ${e.message}`]); // no screenshots: the screen may show other apps' private content
  }
}

async function deleteTagged(note) {
  // open the tagged transaction from Riwayat and delete it (two-step: button, then the confirm dialog)
  await tap(await byId('tab-history'));
  await clearHistoryFilters();
  await tap(await byId('search'));
  await clearField();
  await type(note);
  await hideKeyboard();
  const rows = screen().filter((n) => n.id.startsWith('tx-'));
  if (rows.length !== 1) throw new Error(`pencarian "${note}" harusnya 1 baris, dapat ${rows.length}`);
  await tap(rows[0]);
  await tap(await byId('delete-tx'));
  await tap(await waitFor((n) => /^hapus$/i.test(n.text), 'tombol konfirmasi Hapus'));
  await waitFor((n) => n.id === 'search', 'kembali ke Riwayat');
}

// ---------------------------------------------------------------------------------------------

if (screen().some((n) => n.id === 'lock-screen')) {
  console.error('Kas masih terkunci. Buka kunci di HP lalu jalankan lagi.');
  process.exit(2);
}
const tag = `KASE2E${Date.now().toString().slice(-5)}`;
const leftovers = process.argv.slice(2); // notes of test rows a crashed earlier run left behind

for (const note of leftovers) await step(`sisa uji sebelumnya dihapus: ${note}`, () => deleteTagged(note));

/** Budget keeps its edit mode while another tab is open; leave it so the screen starts in view mode. */
async function leaveBudgetEdit() {
  for (let i = 0; i < 3 && screen().some((n) => n.id === 'save-budget'); i++) {
    const cancel = screen().find((n) => /^batal$/i.test(n.text) && n.cy < NAVBAR_TOP);
    if (cancel) await tap(cancel);
    else await swipeUp();
  }
}

await step('navbar: setiap tab membuka layarnya', async () => {
  await tap(await byId('tab-history'));
  await byId('search');
  await tap(await byId('tab-report'));
  await byId('export-xlsx');
  await tap(await byId('tab-budget'));
  await leaveBudgetEdit();
  await byId('edit-budget');
  await tap(await byId('tab-index'));
  await byId('total-balance');
});

await step('pengeluaran: catat lewat tombol +, muncul di Beranda', async () => {
  await openForm();
  await type('12345'); // amount field is focused on open
  await hideKeyboard();
  await tap(await waitFor((n) => n.id.startsWith('cat-'), 'kategori pertama'));
  await tap(await byId('note'));
  await type(`${tag}out`);
  await hideKeyboard();
  await tap(await byId('save-tx'));
  await byId('total-balance');
  await byText('12.345');
});

await step('pemasukan: dompet yang diketuk benar-benar terpilih', async () => {
  await openForm();
  await type('50000');
  await hideKeyboard();
  await select('type-income');
  const wallets = screen().filter((n) => n.id.startsWith('wallet-'));
  if (!wallets.length) throw new Error('tidak ada chip dompet');
  const target = wallets[wallets.length - 1];
  await select(target.id);
  await tap(await waitFor((n) => n.id.startsWith('cat-default-income'), 'kategori pemasukan'));
  await tap(await byId('note'));
  await type(`${tag}in`);
  await hideKeyboard();
  await tap(await byId('save-tx'));
  await byId('total-balance');
  await byText('50.000');
});

await step('validasi: simpan tanpa nominal ditolak dengan pesan', async () => {
  await openForm();
  await hideKeyboard();
  await tap(await byId('save-tx'));
  await byText('Nominal harus lebih dari 0');
  await tap(await waitFor((n) => /^ok$/i.test(n.text), 'tombol OK'));
  await back(); // close the form
  await byId('total-balance');
});

await step('riwayat: pencarian catatan menemukan transaksi uji', async () => {
  await tap(await byId('tab-history'));
  await clearHistoryFilters();
  await tap(await byId('search'));
  await clearField();
  await type(tag);
  await hideKeyboard();
  const rows = screen().filter((n) => n.id.startsWith('tx-'));
  if (rows.length !== 2) throw new Error(`harusnya 2 baris, dapat ${rows.length}`);
});

await step('laporan: grafik berisi kategori, ketuk batang membuka riwayatnya', async () => {
  await tap(await byId('tab-report'));
  const bar = await waitFor((n) => label(n).includes('persen dari pengeluaran'), 'batang grafik');
  await tap(bar);
  await byId('search');
});

await step('ekspor Excel: membuka menu bagikan', async () => {
  await tap(await byId('tab-report'));
  await tap(await byId('export-xlsx'));
  await sleep(2500);
  const top = adb('shell', 'dumpsys', 'activity', 'activities').match(/topResumedActivity=.*? ([\w.]+)\//)?.[1];
  if (top === 'id.iseng.kas') throw new Error('menu bagikan tidak muncul');
  await back();
  await byId('export-xlsx');
});

await step('budget: form atur budget terbuka dan bisa dibatalkan', async () => {
  await tap(await byId('tab-budget'));
  await leaveBudgetEdit();
  await tap(await byId('edit-budget'));
  await waitFor((n) => n.id.startsWith('limit-'), 'isian batas kategori');
  await leaveBudgetEdit();
  await byId('edit-budget');
});

await step('pengaturan: terbuka dari roda gigi dan bisa kembali', async () => {
  await tap(await byId('tab-index'));
  await tap(await byId('open-settings'));
  await byId('add-wallet');
  await back();
  await byId('total-balance');
});

await step('bersih-bersih: transaksi uji dihapus', async () => {
  await deleteTagged(`${tag}out`);
  await deleteTagged(`${tag}in`);
  await tap(await byId('tab-index'));
});

for (const [s, m] of results) console.log(`${s}  ${m}`);
const failed = results.filter(([s]) => s === 'FAIL').length;
console.log(`\n${results.length - failed}/${results.length} lulus`);
process.exit(failed ? 1 : 0);
