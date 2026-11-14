# PANDUAN MEMASANG APLIKASI DI GOOGLE APPS SCRIPT (ANTI DELAY)

Aplikasi ini dibuat khusus untuk berjalan langsung di dalam Google Sheets menggunakan Google Apps Script (Web App).
Semua data barang dan riwayat transaksi otomatis tersimpan di Google Spreadsheet Anda tanpa delay.

Link Spreadsheet Anda:
https://docs.google.com/spreadsheets/d/1PgGct5t7i6j71T1eQnIZoJ73cM_87akpLihe8PMS-Sg/edit

---

## Langkah-Langkah Pemasangan (Tinggal Salin & Tempel):

### Langkah 1: Buka Editor Apps Script di Google Sheets Anda
1. Buka Google Spreadsheet Anda melalui browser:
   `https://docs.google.com/spreadsheets/d/1PgGct5t7i6j71T1eQnIZoJ73cM_87akpLihe8PMS-Sg/edit`
2. Di menu atas, klik **Ekstensi** (Extensions) -> pilih **Apps Script**.
3. Sebuah tab baru editor kode Google Apps Script akan terbuka.

---

### Langkah 2: Tempel Kode `Code.gs`
1. Di editor Apps Script, pada panel sebelah kiri terdapat file bernama `Code.gs`.
2. Klik file `Code.gs`.
3. Hapus seluruh isi default yang ada di dalam file tersebut (`myFunction()`).
4. Buka file `gas/Code.gs` yang telah disediakan, salin seluruh kodenya, lalu tempel (paste) ke dalam `Code.gs`.
5. Tekan tombol **Simpan** (ikon disket 💾 atau `Ctrl + S`).

---

### Langkah 3: Buat File `Index.html`
1. Di panel kiri Apps Script, klik tombol **+** (Tambah file) di samping tulisan "Files".
2. Pilih opsi **HTML**.
3. Beri nama file: `Index` (huruf I besar atau kecil tidak masalah, otomatis menjadi `Index.html`).
4. Hapus seluruh teks bawaan yang ada di file baru tersebut.
5. Buka file `gas/Index.html` yang telah disediakan, salin seluruh kodenya, lalu tempel (paste) ke dalam `Index.html`.
6. Tekan tombol **Simpan** (ikon disket 💾 atau `Ctrl + S`).

---

### Langkah 4: Publikasikan Sebagai Web App (Aplikasi Web)
1. Di pojok kanan atas editor Apps Script, klik tombol biru **Terapkan** (Deploy) -> pilih **Penerapan baru** (New deployment).
2. Di jendela popup:
   - Klik ikon gerigi (Pilih jenis) -> pilih **Aplikasi Web** (Web app).
   - **Deskripsi**: `Gudang Repack Web App`
   - **Jalankan sebagai** (Execute as): `Saya (akun Google Anda)` (Me)
   - **Yang memiliki akses** (Who has access): `Siapa saja` (Anyone) atau `Siapa saja yang memiliki Akun Google`
3. Klik tombol **Terapkan** (Deploy).
4. Jika Google meminta izin otorisasi (*Authorization required*):
   - Klik **Tinjau Izin** (Review Permissions).
   - Pilih akun Google Anda.
   - Klik **Lanjutan** (Advanced) di kiri bawah -> klik **Buka (tidak aman)** / *Go to project (unsafe)*.
   - Klik **Izinkan** (Allow).
5. Salin tautan **URL Aplikasi Web** yang muncul (misalnya: `https://script.google.com/macros/s/.../exec`).
6. Buka tautan tersebut di browser atau simpan sebagai bookmark di komputer / HP Anda!

---

## Keunggulan Versi Ini (Anti-Delay & Sesuai Permintaan):
1. **Otomatis Nomor Dokumen**: Dimulai dari `RPK-2026-000001` dan otomatis bertambah saat input baru atau simpan transaksi.
2. **Pilihan Keterangan Dropdown**:
   - Input Keluar: `Untuk Toko`, `Repack Ulang`, `Kiriman Custumer`, `isi sendiri`
   - Input Masuk: `Repack KSB`, `Repack PKL`, `Repack Ulang`, `isi sendiri`
   - Memilih *isi sendiri* otomatis membuka kolom ketik teks kustom.
3. **Kolom Tanggal Bersih**: Hanya label teks `Tanggal` tanpa tulisan `(dd-mm-yyyy)`.
4. **Riwayat Stok Sesuai Urutan**: Tanggal - No Document - Keterangan - Masuk (Hijau) - Keluar (Merah) - Stok Sebelum - Stok Saat Ini.
5. **Anti-Delay (Zero Latency)**: Data awal disuntikkan langsung saat halaman dibuka dan proses simpan menggunakan background batch async ke Google Spreadsheet, sehingga formulir tidak akan membeku atau lambat saat digunakan.
