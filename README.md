# VOGUEPAY - Sistem Informasi Penggajian Karyawan

Sistem informasi penggajian karyawan berbasis web yang digunakan untuk mengelola data departemen, karyawan, dan penggajian secara terstruktur. Aplikasi ini dibuat dengan pendekatan front-end statis yang terhubung ke Supabase untuk penyimpanan data.

## Fitur utama

- Manajemen data departemen
- Manajemen data karyawan
- Input dan pencatatan penggajian
- Dashboard ringkasan gaji dan data karyawan
- Validasi aturan bisnis sederhana untuk gaji dan data karyawan
- Penyimpanan data via Supabase

## Struktur folder

```text
.
├── backend/
│   ├── app.js              # Aturan validasi bisnis penggajian
│   └── database.sql        # Skema database Supabase
├── frontend/
│   ├── index.html          # Halaman utama
│   ├── dashboard.html      # Dashboard
│   ├── karyawan.html       # Data karyawan
│   ├── departemen.html     # Data departemen
│   ├── penggajian.html     # Data penggajian
│   ├── app.js              # Logika aplikasi frontend
│   ├── style.css           # Styling UI
│   ├── supabase-config.js  # Konfigurasi koneksi Supabase
│   └── *.html              # Form tambah/edit data
└── README.md
```

## Teknologi yang digunakan

- HTML
- CSS
- JavaScript
- Supabase
- SQL (schema database)

## Persiapan awal

1. Buat project baru di Supabase.
2. Jalankan isi file `backend/database.sql` di SQL Editor Supabase untuk membuat tabel dan policy.
3. Buka file `frontend/supabase-config.js` dan sesuaikan URL dan API key Supabase Anda.
4. Pastikan tabel `departemen`, `karyawan`, dan `penggajian` sudah tersedia di database.

## Menjalankan aplikasi

Karena aplikasi ini merupakan proyek frontend statis, Anda dapat menjalankannya dengan cara berikut:

### Opsi 1: Buka langsung di browser

- Buka file `frontend/index.html` pada browser.

### Opsi 2: Jalankan server lokal

```bash
cd /path/ke/folder/proyek
python -m http.server 8000
```

Lalu buka:

```text
http://localhost:8000/frontend/
```

## Catatan penting

- File `backend/app.js` berisi aturan validasi penggajian yang digunakan sebagai referensi bisnis.
- Aplikasi ini saat ini menggunakan mode akses publik ke Supabase sesuai konfigurasi proyek.
- Untuk produksi, disarankan menambahkan autentikasi dan pembatasan akses yang lebih aman.

## Kontribusi

Anda dapat menambahkan fitur baru, memperbaiki tampilan, atau menyesuaikan struktur data sesuai kebutuhan organisasi.

## Lisensi

Proyek ini dibuat untuk kebutuhan sistem informasi penggajian internal dan dapat dimodifikasi sesuai kebutuhan Anda.
