# 📘 PANDUAN PENYETELAN ULTRADETAIL & INSTALASI DIGITAL STORE PRO
## Metode Uploading an Existing File, Supabase SMTP (Lupa Password), Vercel & Pakasir

Halo! Dokumen ini dirancang khusus sebagai panduan langkah-demi-langkah paling lengkap dan terperinci untuk meluncurkan website **Digital Store Pro & Affiliate Portal** Anda dari nol hingga live di internet.

Semua instruksi dibuat super rinci agar mudah dipahami bahkan jika Anda baru pertama kali mendeploy aplikasi web. Silakan ikuti seluruh tahapan di bawah ini secara runtut.

---

## 📋 DAFTAR ISI
1. [Langkah 1: Persiapan Akun & Upload Source Code ke GitHub](#langkah-1-persiapan-akun--upload-source-code-ke-github)
2. [Langkah 2: Penyediaan & Konfigurasi Supabase Database](#langkah-2-penyediaan--konfigurasi-supabase-database)
3. [Langkah 3: Konfigurasi SMTP Supabase (Wajib agar Fitur Lupa Password Berjalan)](#langkah-3-konfigurasi-smtp-supabase-wajib-agar-fitur-lupa-password-berjalan)
4. [Langkah 4: Registrasi & Pembuatan API Key di Pakasir](#langkah-4-registrasi--pembuatan-api-key-di-pakasir)
5. [Langkah 5: Hosting & Deployment di Vercel](#langkah-5-hosting--deployment-di-vercel)
6. [Langkah 6: Pengaturan Akhir di Admin Panel (Selesai!)](#langkah-6-pengaturan-akhir-di-admin-panel-selesai)

---

## 🛠️ LANGKAH 1: PERSIAPAN AKUN & UPLOAD SOURCE CODE KE GITHUB

GitHub adalah platform cloud gratis untuk menyimpan file kode sumber aplikasi Anda. Vercel akan otomatis membaca file dari GitHub Anda untuk ditampilkan di internet.

### A. Cara Membuat Akun GitHub (Jika Belum Punya)
1. Buka browser Anda, silakan kunjungi website resmi [https://github.com](https://github.com).
2. Klik tombol **Sign up** kuning/hijau di pojok kanan atas.
3. Masukkan alamat email aktif Anda, lalu buat password yang kuat, serta masukkan username pilihan Anda.
4. Selesaikan teka-teki verifikasi captcha yang muncul untuk memastikan Anda adalah manusia.
5. GitHub akan mengirimkan kode OTP ke email Anda. Cek kotak masuk atau folder spam email Anda, lalu masukkan kode tersebut.
6. Pilih opsi kustomisasi minimal (misal personal, student, dsb) atau klik **Skip personalization**. Akun GitHub Anda kini telah aktif!

### B. Membuat Repository Baru
1. Pastikan Anda sudah login ke GitHub. Di pojok kanan atas, klik tombol tanda plus (**+**) dan pilih **New repository**.
2. **Repository name**: Masukkan nama yang Anda sukai, contoh: `digital-store-pro` atau `toko-digital-saya`.
3. **Description** (Opsional): Isi keterangan singkat, misalnya: `Source code Toko Digital Pro`.
4. **Public/Private**: Pilih **Private** (Sangat disarankan!). Ini untuk memastikan file download dan database kredensial Anda tidak bisa diintip atau disalin oleh publik.
5. **Initialize this repository with**: Biarkan semua pilihan ter-uncheck (jangan centang README, .gitignore, atau license).
6. Klik tombol hijau besar bertuliskan **Create repository**.

### C. Mengunggah Kode Menggunakan Metode "Uploading an Existing File"
Metode ini adalah cara termudah mengunggah seluruh isi folder project langsung melalui tampilan website (browser) tanpa perlu menginstal aplikasi tambahan di komputer Anda.

1. Setelah Anda klik *Create repository*, Anda akan dihadapkan pada halaman petunjuk setup.
2. Cari teks link kecil berbunyi **"uploading an existing file"** di baris instruksi awal, lalu klik link tersebut.
3. Browser Anda akan membuka area drag-and-drop file.
4. **Persiapan Folder Anda di Komputer**:
   - Cari folder project **Digital Store Pro** Anda.
   - **PENTING**: Jika terdapat folder bernama `node_modules` atau folder `.git` (biasanya tersembunyi), **HAPUS** atau **JANGAN IKUT SERTAKAN** saat ditarik. Folder ini berisi puluhan ribu file library yang otomatis diunduh oleh server Vercel nanti. Menguploadnya secara langsung akan membuat browser Anda macet dan error.
5. **Menarik File (Upload)**:
   - Pilih semua file dan folder di dalam folder project Anda (gunakan `Ctrl + A` di Windows atau `Cmd + A` di Mac).
   - Drag (klik tahan dan seret) semua file & folder tersebut, lalu lepaskan di atas kotak Drag-and-Drop di halaman GitHub Anda.
   - Browser akan mulai mendata dan mengunggah seluruh file. Tunggu hingga progres indikator di bagian bawah selesai (biasanya berkisar 1 - 3 menit tergantung kecepatan internet Anda).
6. **Menyimpan Perubahan (Commit)**:
   - Setelah semua file berhasil terdaftar, gulir (scroll) ke bagian bawah halaman.
   - Di kotak **Commit changes**, Anda bisa memberi judul default seperti `Initial commit: digital store files`.
   - Pastikan pilihan terpilih pada **Commit directly to the `main` branch**.
   - Klik tombol hijau bertuliskan **Commit changes**.
   - GitHub akan memproses file selama beberapa detik. Selamat! File program aplikasi Anda sudah aman terunggah di repository GitHub secara privat.

---

## 🗄️ LANGKAH 2: PENYEDIAAN & KONFIGURASI SUPABASE DATABASE

Supabase digunakan secara gratis sebagai server database PostgreSQL, sistem autentikasi pengguna, dan penyimpanan gambar/QRIS Anda.

### A. Mendaftar Akun Supabase
1. Navigasi ke [https://supabase.com](https://supabase.com) di browser Anda.
2. Klik tombol **Sign Up** atau **Start your project** di pojok kanan atas.
3. Pilih metode **Continue with GitHub** untuk mempermudah pendaftaran. Otorisasikan Supabase agar terhubung dengan akun GitHub yang Anda buat tadi.

### B. Membuat Project Database Baru
1. Pada halaman dashboard Supabase utama, klik **New Project**.
2. Pilih nama organisasi Anda (biasanya nama akun Anda sendiri).
3. Isi parameter pembuatan project:
   - **Name**: Beri nama bebas, misal `DigitalStoreDB`.
   - **Database Password**: Klik tombol **Generate a password** untuk membuat password yang sangat aman. **Catat dan simpan password ini baik-baik!** Anda membutuhkannya jika ingin mengakses database dari luar secara langsung.
   - **Region**: Pilih wilayah server terdekat dengan pembeli Anda. Untuk pembeli di Indonesia, pilih **Singapore (ap-southeast-1)** agar website merespons sangat cepat.
   - **Pricing Plan**: Pilih plan **Free** (Gratis).
4. Klik tombol **Create new project**. Supabase akan memerlukan waktu 1 s.d. 3 menit untuk menyiapkan infrastruktur database. Tunggu hingga proses tuntas.

### C. Menjalankan Skema SQL (FULL_SCHEMA.sql)
Kita perlu mengisi database baru tersebut dengan skema tabel produk, kategori, order, voucher, withdraw, trigger profil otomatis, dan lain sebagainya.

1. Di menu sidebar sebelah kiri dashboard Supabase Anda, klik ikon terminal/buku bertuliskan **SQL Editor**.
2. Klik tombol **New Query** (atau tanda **+** di tengah/atas).
3. Di dalam source code project ini, buka file bernama `/FULL_SCHEMA.sql`. Salin seluruh baris kode SQL di dalamnya dari awal sampai akhir.
4. Tempelkan (Paste) seluruh isi kode SQL tersebut ke lembar editor kosong di dashboard Supabase SQL Editor.
5. Di pojok kanan bawah area editor, klik tombol **Run** (atau tekan tombol keyboard `Ctrl + Enter`).
6. Pastikan muncul pemberitahuan berwarna hijau di bawah yang berbunyi **"Success. No rows returned."**.
7. Sekarang, semua struktur tabel, indeks performa tinggi, perizinan keamanan (RLS Policy), fungsi trigger pendaftaran otomatis, dan data bawaan pengaturan default aplikasi Anda sudah terbuat dengan sukses!

---

## ✉️ LANGKAH 3: KONFIGURASI SMTP SUPABASE (WAJIB AGAR FITUR LUPA PASSWORD BERJALAN)

Secara default, Supabase menyediakan email pengirim built-in, namun pengiriman dibatasi hanya 3 email per-jam dan seringkali masuk ke folder spam pembeli. 

Untuk mengaktifkan fitur **Lupa Password / Reset Sandaran Pengguna** agar berjalan lancar tanpa kendala batas kuota, Anda **wajib menggunakan custom SMTP** milik Anda sendiri. Di sini kita menggunakan contoh settingan termudah, yaitu **Gmail SMTP (Google App Passwords)**.

### A. Cara Membuat Google App Password (Sandi Aplikasi Gmail Anda)
Agar Supabase bisa mengirim email verifikasi lewat akun Gmail Anda dengan aman tanpa memasukkan sandi utama email Anda:
1. Masuk ke Google Account Anda di [https://myaccount.google.com](https://myaccount.google.com).
2. Di menu sidebar kiri, klik **Security** (Keamanan).
3. Di bawah bagian *"How you sign in to Google"*, pastikan Anda sudah mengaktifkan **2-Step Verification** (Verifikasi 2 Langkah). Ini adalah kewajiban sebelum Anda bisa mengakses opsi Sandi Aplikasi.
4. Klik pada menu **2-Step Verification**.
5. Scroll terus ke bagian halaman paling bawah. Anda akan menemukan pilihan bernama **App passwords** (Sandi aplikasi). Klik pilihan tersebut.
6. Masukkan nama aplikasi bebas sebagai pengingat, contoh: `Supabase Digital Store`.
7. Klik tombol **Create** (Buat).
8. Google akan menampilkan popup berisi kode sandi khusus sebanyak **16 karakter** (biasanya dipisahkan spasi). **Salin dan simpan kode ini!** (Jangan sertakan spasi saat memasukkannya nanti).

### B. Memasukkan Setelan SMTP Ke Dashboard Supabase
1. Buka kembali tab dashboard project Supabase Anda.
2. Di sidebar paling bawah kiri, klik ikon gerigi bertuliskan **Project Settings**.
3. Di menu di bawah bagian settings tersebut, klik menu **Auth** (di bawah baris "Configuration").
4. Scroll ke bawah sampai Anda menemukan panel bertuliskan **SMTP Settings**.
5. Nyalakan switch **Enable Custom SMTP** ke posisi **ON (Aktif - berwarna hijau)**.
6. Masukkan detail konfigurasi berikut:
   - **Sender Email**: Masukkan alamat Gmail Anda (Contoh: `laundryshop82@gmail.com`). Ini akan menjadi alamat pengirim email kepada pembeli.
   - **Sender Name**: Nama pengirim yang tampil di inbox penerima (Contoh: `Admin Digital Store Pro`).
   - **SMTP Host**: `smtp.gmail.com`
   - **SMTP Port**: `587`
   - **SMTP Username**: Masukkan alamat Gmail lengkap Anda kembali (Contoh: `laundryshop82@gmail.com`).
   - **SMTP Password**: Tempelkan (paste) **16 karakter Sandi Aplikasi (App Password)** yang baru saja Anda salin dari Google Account tadi (tanpa spasi).
   - **Secure connection / TLS**: Klik untuk memberikan tanda centang pada pilihan **STARTTLS** atau centang pilihan **TLS** jika kompatibel.
7. Klik tombol **Save** di pojok kanan bawah SMTP Settings.
8. **MEMATIKAN EMAIL KONFIRMASI DAFTAR (Opsional tapi Direkomendasikan)**: 
   - Di halaman pengaturan **Auth** Supabase tersebut, cari bagian **Inboxes / Email Link** atau **Providers** -> **Email**.
   - Untuk mempermudah pendaftaran user agar bisa langsung berbelanja tanpa repot mengecek email verifikasi saat pertama kali mendaftar, pastikan opsi **Confirm email** di-set menjadi **OFF** (mati). Namun, fitur "Lupa Password" akan tetap bekerja optimal saat mereka membutuhkannya.
   - Klik **Save** jika Anda melakukan perubahan di area ini.

---

## 💰 LANGKAH 4: REGISTRASI & PEMBUATAN API KEY DI PAKASIR

Pakasir adalah payment gateway Indonesia yang mendukung otomatisasi pembayaran QRIS & bank lokal tanpa modal besar.

1. Buka website resmi [https://pakasir.com](https://pakasir.com).
2. Klik **Daftar** dan isi formulir email, hp, dan info toko Anda.
3. Lakukan verifikasi nomor telepon / email sesuai petunjuk di sana.
4. Masuk ke halaman **Merchant Dashboard** Pakasir.
5. Buat sebuah **Proyek Baru** di sana untuk Digital Store Pro Anda.
6. Catat dua string nilai yang wajib digunakan yaitu:
   - **Project Slug / Project ID**: Nama unik proyek Anda di Pakasir.
   - **API Key / Secret Key**: Token rahasia Anda. Simpan di tempat yang aman.

---

## 🚀 LANGKAH 5: HOSTING & DEPLOYMENT DI VERCEL

Vercel akan mengunduh file pogram dari GitHub, memasang library, mengompilasi program React Vite Anda secara otomatis, lalu menghidupkannya 24 jam non-stop dengan alamat domain gratis.

### A. Mendaftar Akun Vercel
1. Kunjungi website [https://vercel.com](https://vercel.com).
2. Klik tombol **Sign Up**.
3. Pilih opsi pendaftaran paling atas yaitu **Continue with GitHub** agar Vercel bisa terintegrasi secara instan dengan repository proyek Anda.

### B. Mengimpor Repository GitHub Anda
1. Sesaat setelah Anda berhasil masuk ke dashboard utama Vercel, klik tombol **Add New** di pojok kanan atas lalu pilih **Project**.
2. Di halaman pencarian repository, Vercel akan menyajikan daftar proyek dari akun GitHub Anda.
3. Cari repository proyek Anda (misal: `digital-store-pro`), lalu klik tombol **Import** yang berada di samping kanan nama repository tersebut.

### C. Mengisi Environment Variables di Vercel (Langkah Krusial!)
Sebelum Anda mengklik tombol deploy, kita perlu memperkenalkan aplikasi ke database Supabase kita.

1. Cari bar menu bertuliskan **Environment Variables** (biasanya di bagian bawah konfigurasi Build and Development settings), klik untuk membukanya.
2. Silakan buka tab baru browser Anda, masuk kembali ke dashboard database Supabase Anda. Navigasi ke **Project Settings (ikon gerigi)** -> klik menu **API**.
3. Masukkan variable berikut ke kolom input Vercel:

   | No | Nama Key (Ketik di Vercel) | Nilai Value (Salin dari Supabase) | Keterangan Letak Nilai di Supabase |
   |:---|:---|:---|:---|
   | 1 | `VITE_SUPABASE_URL` | `https://xxxx.supabase.co` | Salin dari panel **Project URL** |
   | 2 | `VITE_SUPABASE_ANON_KEY` | `eyJhbGciOi...` (sangat panjang) | Salin dari public API Key berkode **`anon` (public)** |
   | 3 | `SUPABASE_SERVICE_ROLE` | `eyJhbGciOi...` (sangat panjang) | Salin dari secret API Key berkode **`service_role` (secret)** |

4. Klik tombol **Add** di sebelah kanan setiap kali Anda selesai memasukkan satu baris Key dan Value tabel di atas.
5. Pastikan semua variabel sudah terdaftar di daftar bawah dengan benar (total terdapat minimal 3 variabel krusial).
6. Klik tombol **Deploy** di bagian bawah.
7. Vercel akan memulai compiling dan building system secara otomatis. Proses ini memakan waktu kurang dari 2 menit.
8. Setelah tuntas, layar laptop/hp Anda akan menampilkan animasi kembang api ucapan selamat bertuliskan **CONGRATULATIONS!** beserta gambar cuplikan (preview) website live Anda.
9. Silakan klik gambar preview tersebut atau klik tautan URL berakhiran `.vercel.app` yang disediakan di sana. Website toko digital canggih Anda telah mengudara secara resmi!

---

## ⚙️ LANGKAH 6: PENGATURAN AKHIR DI ADMIN PANEL (SELESAI!)

Selamat! Website Anda saat ini sudah bisa dikunjungi bebas dari seluruh dunia. Sekarang mari kita amankan admin dan hubungkan otomatisasi pembayaran Pakasir di panel admin yang ramah pengguna.

### A. Mendaftarkan Akun Admin Utama Anda
Sistem Digital Store Pro ini dilengkapi pengaman pintar. Siapapun yang melakukan registrasi user pertama kali di database adalah pemilik sah (Admin):
1. Buka alamat URL website Vercel yang Anda dapatkan tadi.
2. Di navigasi menu pojok kanan atas, klik tombol **Masuk / Login**.
3. Di tab form login, pilih menu **Daftar Sekarang / Register**.
4. Masukkan nama lengkap, alamat email Anda, nomor WhatsApp aktif, dan password akun Anda.
5. Klik **Daftar**. Anda akan langsung dialihkan ke beranda status ter-login.
6. Karena Anda pendaftar urutan ke-1, skema database otomatis menetapkan role login Anda sebagai **ADMIN**. Anda sekarang memiliki kekuatan penuh mengendalikan toko!
7. Klik menu profil Anda di kanan atas, maka akan muncul tombol bertuliskan **Admin Dashboard**. Silakan diklik untuk masuk ke pusat kendali.

### B. Mengisi Kredensial Pakasir & QRIS Pembayaran di Admin Pengaturan
1. Di sidebar Admin Dashboard, masuk ke menu **Pengaturan** (Settings).
2. **Nama Toko & Deskripsi**: Sesuaikan nama toko impian Anda.
3. **Metode Pembayaran**: Centang metode yang ingin Anda tawarkan (Transfer Bank, E-Wallet, QRIS, atau Agen Otomatis Pakasir).
4. **Setup Pakasir**:
   - Cari isian input khusus **Pakasir Project Slug** dan **Pakasir API Key**.
   - Masukkan informasi Project Slug dan API Key yang sudah Anda catat dari Dashboard Pakasir di Langkah 4.
   - Klik **Simpan Pengaturan** di bawah halaman.
5. **Menyalin Link Webhook Ke Pakasir**:
   - Di halaman pengaturan Admin yang sama, Anda akan melihat baris instruksi URL Webhook otomatis yang sudah menyesuaikan dengan nama domain Vercel Anda, contoh: `https://toko-anda.vercel.app/api/webhook/pakasir`.
   - Salin (copy) link penuh URL Webhook tersebut.
   - Buka lembar setelan proyek Anda di Dashboard Pakasir, cari kolom input **Webhook URL** / **Callback URL**, lalu tempelkan link tersebut di sana dan simpan perubahan di dashboard Pakasir Anda.
   - Pembayaran QRIS / E-Money / Transfer Bank via Pakasir sekarang sudah aktif 100% secara real-time! Apabila pembeli membayar, status order otomatis berubah dari *Pending* ke *Selesai* dan file digital langsung terkirim seketika.

### C. Manajemen Kategori & Inventori Produk
Kita telah melengkapi tombol hapus di portal admin dengan **Konfirmasi Dialog Modal** yang cantik, menawan, aman, dan anti-flicker:
1. Klik menu **Kategori** di sidebar admin. Buat kategori andalan Anda (Contoh: Web Template, Source Code, Asset Desain).
2. Klik menu **Produk** di sidebar admin. Isi data produk digital gratis / premium Anda.
3. Unggah link file unduhan produk (Bisa link download file rar Google Drive, Link Repository GitHub, atau hosting file lain).
4. Apabila ingin menguji penghapusan, klik tombol bersimbol Tempat Sampah Merah di tabel produk/kategori. Layar web akan menampilkan prompt konfirmasi modern, bukan alert browser jadul, klik tombol **Ya, Hapus** untuk mengeksekusi secara aman.

---

## 🔒 TIPS KEAMANAN BERKELANJUTAN
1. **Pentingnya RLS**: Kebijakan keamanan berbasis baris database (*Row Level Security*) sudah di-enable penuh di `FULL_SCHEMA.sql` kami, sehingga aman dari bypass peretas luar.
2. **Kunci API Rahasia**: Selalu rahasiakan `SUPABASE_SERVICE_ROLE` Anda dan pastikan tidak ter-commit ke repositori GitHub publik yang bisa dilihat orang lain secara gratis.
3. **Verifikasi Keuangan**: Menu penarikan komisi (*Withrawals*) para affiliate juga sudah diproteksi ketat, admin bisa memonitor dan menyetujui mutasi saldo dengan aman di halaman Admin Panel menu Penarikan.

---
*Digital Store Pro © 2026. Dikembangkan secara andal dengan teknologi modern React, Supabase, Tailwind CSS, Vercel, dan Integrasi Gateway Pakasir.*
