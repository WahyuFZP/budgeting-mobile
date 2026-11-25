# Kas server — sync API + PostgreSQL (tanpa Supabase)

Aplikasi HP tetap 100% offline dengan SQLite. Server ini **opsional**: dipakai hanya kalau pengguna
masuk ke akun di menu *Lainnya → Sync ke server (beta)*, untuk menyalin data antar HP. Tanpa enkripsi end-to-end.

## Isi

| File | Fungsi |
| --- | --- |
| `src/index.ts` | HTTP API: `POST /register`, `POST /login`, `POST /sync`, `GET /health` |
| `src/sync.ts` | Logika sync: push (last-write-wins di `updated_at`) lalu pull (`seq > cursor`) |
| `test/api.test.ts` | Test integrasi ke Postgres |
| `src/schema.ts` | Schema Drizzle untuk Postgres, cerminan `../src/db/schema.ts` + kolom `user_id` |
| `drizzle/0000_init.sql` | SQL `CREATE TABLE` hasil generate (bisa dibaca langsung) |
| `docker-compose.yml` | Postgres 17 untuk development di PC |
| `drizzle.config.ts` | Koneksi DB: `DATABASE_URL`, default `postgres://kas:kas@localhost:5432/kas` |

## Menjalankan di PC

Butuh Docker Desktop yang sedang jalan.

```powershell
cd server
npm install
npm run db:up        # nyalakan Postgres (docker compose, nama "kas")
npm run db:migrate   # buat tabel
npm test             # test integrasi (opsional)
npm start            # API di http://0.0.0.0:8787
```

Di HP: *Lainnya → Sync ke server (beta)* → alamat server `http://<IP-PC>:8787` (lihat IP dengan `ipconfig`,
bagian "IPv4 Address" Wi-Fi). HP dan PC harus satu Wi-Fi, dan izinkan Node.js di Windows Firewall saat diminta.

Melihat isi database: `docker compose exec db psql -U kas -c "\dt"`

## Cara kerja sync

1. HP mengirim semua baris yang `updated_at`-nya lebih baru dari sync terakhir (termasuk yang dihapus/soft delete).
2. Server menyimpan per baris: kalau sudah ada, hanya diganti jika `updated_at` kiriman lebih baru (last write wins).
   Setiap baris yang berubah dapat nomor urut `seq` baru.
3. Server mengembalikan semua baris milik pengguna dengan `seq > cursor` HP; HP menyimpannya dengan aturan yang sama.
4. Data tidak valid (nominal 0, transfer ke dompet sama, dompet milik orang lain) ditolak utuh: tidak ada yang tersimpan setengah.

Tidak disinkronkan: tabel `settings` (tanggal gajian, dompet terakhir, waktu backup tetap per HP).

## Mengubah schema

1. Ubah `src/schema.ts` (dan pasangannya di `../src/db/schema.ts` kalau kolomnya juga ada di HP).
2. `npm run db:generate` → file SQL baru di `drizzle/`.
3. `npm run db:migrate`.

## Keputusan desain

- **Primary key `(user_id, id)`**: kategori bawaan di HP memakai id tetap (`default-expense-food`) yang sama di semua HP, jadi `id` saja tidak unik antar pengguna.
- **Foreign key komposit** `(user_id, wallet_id)` dll.: transaksi tidak bisa menunjuk dompet milik pengguna lain.
- **`bigint`** untuk Rupiah, **`timestamptz`** untuk waktu, dan aturan bisnis (nominal > 0, bentuk transfer) dijaga juga lewat `CHECK`.

## Belum dibuat / batasan

- **HTTPS** untuk dipakai di internet. APK rilis Android menolak `http://`, jadi server online perlu domain + HTTPS (misalnya di VPS dengan Caddy).
  `http://` ke IP lokal hanya untuk Expo Go / development build.
- Sync otomatis (sekarang lewat tombol), lupa password, hapus akun, logout dari semua HP.
- Paging untuk data sangat besar; push satu baris per query.
- HP kedua yang baru di-onboarding membuat dompet "Cash" sendiri, jadi setelah sync ada dua dompet (bisa diarsipkan).
- Enkripsi end-to-end (dipilih: belum dulu).
