# Kas: arah desain

Ditranskripsikan dari jawaban pemilik produk (25 Nov 2026) dan PRD. Ubah file ini kalau arahnya berubah.

**Design Read:** aplikasi pencatat keuangan pribadi untuk karyawan muda Indonesia, bahasa visual biru-putih yang
terasa seperti aplikasi bank (tapi dengan biru sendiri, bukan meniru bank tertentu), dial **ENERGY 2 / RHYTHM 2 / MOTION 2**,
dengan satu maskot 3D (celengan).

Riwayat arah: hijau tua/krem/emas, lalu netral/zamrud, lalu (25 Nov 2026, permintaan pemilik produk) biru-putih dengan latar putih.

## Warna (aturan 60-30-10)

| Porsi | Peran | Nilai |
| --- | --- | --- |
| 60% | Latar putih, kartu biru keabuan sangat muda | `#FFFFFF` / `#F2F5FA` |
| 30% | Primer: kartu saldo, navbar, tombol utama | biru tinta `#14386B` |
| 10% | Aksen: tombol tambah, tab aktif, angka total saldo, tubuh celengan | biru langit `#6CC3FF` |

Warna status (pemasukan, pengeluaran, peringatan) di luar 60-30-10 dan hanya untuk angka/status.
Warna kategori adalah data pilihan pengguna, bukan bagian palet UI.
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

## Motion

- Celengan 3D (dibuat dari kode, tanpa file model) di onboarding dan kartu saldo Beranda: mata mengikuti jari,
  melompat saat disentuh atau saat saldo berubah, alis menunjukkan sisa budget (aman / hampir habis / terlampaui).
  Di Beranda hanya merender beberapa detik setelah ada kejadian, supaya hemat baterai.
- Kartu saldo miring mengikuti jari (parallax), angka saldo bergulir ke nilai baru.
- Penanda tab bergeser saat jari menyentuh tab (bukan setelah layar berganti), dengan getaran halus.
- Bar budget dan grafik memanjang dengan pegas.
- Semua animasi berhenti kalau "Kurangi gerakan" aktif di HP.

## Identitas

Motif: lingkaran biru langit (tombol tambah, penanda tab aktif) dan celengan biru sebagai maskot.
