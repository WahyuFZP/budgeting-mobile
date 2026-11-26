# Kas: arah desain

Ditranskripsikan dari jawaban pemilik produk (25 Nov 2026) dan PRD. Ubah file ini kalau arahnya berubah.

**Design Read:** aplikasi pencatat keuangan pribadi untuk karyawan muda Indonesia, bahasa visual "Hutan pagi":
latar putih bersih seperti m-banking, hijau hutan sebagai struktur, kuning matahari sebagai satu aksen, dan maskot tupai 3D
di hutan kecil. Dial **ENERGY 2 / RHYTHM 2 / MOTION 3** (motion naik karena pemilik produk meminta animasi yang terasa).

Riwayat arah: hijau/krem/emas, netral/zamrud, biru-putih, lalu (26 Nov 2026, permintaan pemilik produk) tema Nature.

## Warna (aturan 60-30-10)

| Porsi | Peran | Nilai |
| --- | --- | --- |
| 60% | Latar putih, kartu hijau kabut | `#FFFFFF` / `#F3F6F1` |
| 30% | Primer: kartu saldo (dengan hutan 3D), navbar, tombol utama | hijau hutan `#1F4D3A` |
| 10% | Aksen: tombol tambah, tab aktif, angka total saldo, matahari | kuning matahari `#F2B33D` |

Warna status (pemasukan, pengeluaran, peringatan) di luar 60-30-10 dan hanya untuk angka/status.
Warna kategori/dompet adalah data pilihan pengguna (palet alam), bukan bagian palet UI.
Semua pasangan teks dan penanda dicek WCAG AA di `src/theme.test.ts`.

## Tema

Satu tema terang, tetap putih walau HP dalam mode gelap (pilihan pemilik produk: kesan bersih seperti m-banking).

## Tipografi

Font sistem (Roboto/San Francisco): paling terbaca di HP kelas menengah dan tanpa unduhan font.
Angka uang memakai `tabular-nums` supaya digit sejajar saat dibandingkan dan saat bergulir.

## Ikon

Material Community Icons (`@expo/vector-icons`), gaya isi (filled): bentuknya tetap jelas di ukuran kecil,
punya glyph keuangan spesifik (dompet, bank, kas, makanan, transportasi). Tanpa emoji di UI.

## Grafik

Laporan menjawab satu pertanyaan: "ke mana uang periode ini pergi?". Batang horizontal per kategori, terbesar di atas,
satu warna (satu seri), nama dan nominal ditulis di samping batang. Ketuk batang membuka transaksinya di Riwayat.

## Motion dan 3D

- **Tupai di hutan kecil** (three.js/React Three Fiber, dibuat dari bentuk dasar, tanpa file model), di kartu saldo Beranda,
  layar kosong, dan onboarding. Tidak pernah menutupi menu: selalu di dalam kartunya sendiri.
  Mata mengikuti jari, berkedip, melompat saat disentuh; biji ek jatuh ke tangannya saat pemasukan dan terlepas saat pengeluaran;
  alis menunjukkan sisa budget. Pohon bergoyang pelan. Render hanya sebentar setelah ada kejadian (hemat baterai).
- Dompet sebagai **kartu bertumpuk** yang membuka dengan pegas; kartu jatah harian yang **dibalik** 3D; kartu budget yang **melebar**.
- Detail transaksi sebagai **tiket** (stub berwarna, garis sobek, rincian).
- Navbar: ikon + label, tab aktif kuning dengan garis penanda yang bergeser; tombol + bulat sedikit terangkat; navbar turun saat scroll ke bawah.
- Kartu menyusut sedikit saat ditekan; angka uang bergulir; daftar muncul berurutan.
- Semua animasi berhenti kalau "Kurangi gerakan" aktif di HP.

## Identitas

Motif: matahari kuning (tombol tambah, tab aktif, matahari di hutan) dan tupai penyimpan biji ek sebagai maskot: menabung untuk nanti.
Referensi pola (kartu bertumpuk, tiket, navbar gelap dengan tombol tengah) diambil dari Musemind sebagai pola, bukan disalin tampilannya.
