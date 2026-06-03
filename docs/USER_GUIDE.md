# Panduan Penggunaan Harian — BPS RAG Chatbot

Panduan ini untuk **staf admin BPS** yang mengoperasikan sistem chatbot setiap hari.  
Tidak perlu latar belakang teknis — cukup ikuti langkah-langkahnya.

> 📋 NOTE: Jika Anda baru pertama kali setup sistem ini dari awal, baca dulu [SETUP.md](SETUP.md). Panduan ini hanya untuk operasional setelah sistem sudah terpasang.

---

## Daftar Isi

1. [Menjalankan Sistem Setiap Hari](#1-menjalankan-sistem-setiap-hari)
2. [Mematikan Sistem](#2-mematikan-sistem)
3. [Cek Status Sistem](#3-cek-status-sistem)
4. [Mengelola PDF Knowledge Base](#4-mengelola-pdf-knowledge-base)
5. [Memantau Chatbot WhatsApp](#5-memantau-chatbot-whatsapp)
6. [Mengelola Kredensial](#6-mengelola-kredensial)
7. [Mengelola Sesi WhatsApp](#7-mengelola-sesi-whatsapp)
8. [Jadwal Pembaruan Rutin](#8-jadwal-pembaruan-rutin)
9. [Yang Harus Dilakukan Jika Terjadi Masalah](#9-yang-harus-dilakukan-jika-terjadi-masalah)

---

## 1. Menjalankan Sistem Setiap Hari

Sistem ini terdiri dari beberapa layanan yang harus berjalan bersamaan. Berikut urutan yang benar setiap kali komputer dinyalakan.

### Checklist Pagi

Lakukan langkah-langkah ini setiap hari sebelum mulai bekerja:

---

#### ✅ Langkah 1 — Jalankan Docker Desktop

Docker diperlukan untuk menjalankan WAHA (WhatsApp gateway).

1. Cari ikon **Docker Desktop** di desktop atau Start Menu
2. Klik dua kali untuk membukanya
3. Tunggu hingga ikon Docker di taskbar (pojok kanan bawah) berhenti animasi — berarti Docker sudah siap
4. Jika sudah pernah setup, container WAHA biasanya langsung berjalan otomatis

> 💡 TIP: Anda bisa set Docker Desktop untuk berjalan otomatis saat Windows start. Buka Docker Desktop → Settings → General → centang **Start Docker Desktop when you sign in to your computer**.

---

#### ✅ Langkah 2 — Jalankan n8n

n8n adalah otak sistem — mengatur semua alur percakapan dan AI.

1. Buka **Command Prompt** atau **PowerShell** (cari di Start Menu, ketik `cmd`)
2. Ketik perintah berikut dan tekan Enter:

```
n8n start
```

3. Tunggu hingga muncul pesan: `n8n ready on port 5678`
4. **Jangan tutup jendela Command Prompt ini** selama sistem digunakan

> ⚠️ WARNING: Jika jendela Command Prompt ditutup, n8n akan berhenti dan chatbot tidak bisa membalas pesan WhatsApp.

> 💡 TIP: Anda bisa kecilkan (minimize) jendela Command Prompt — tidak perlu dilihat terus, cukup jangan ditutup.

---

#### ✅ Langkah 3 — Jalankan Dashboard Admin

1. Buka folder project (misalnya `C:\BPS-Chatbot`)
2. Klik dua kali file **`start.bat`**
3. Dua jendela Command Prompt akan terbuka (PDF Processor API + Frontend)
4. Browser otomatis membuka **http://localhost:5000**

Jika browser tidak terbuka otomatis, buka manual: ketik `http://localhost:5000` di address bar browser.

---

#### ✅ Langkah 4 — Verifikasi WhatsApp Terhubung

1. Buka browser, pergi ke **http://localhost:3001**
2. Klik menu **Sessions** atau lihat di halaman utama
3. Pastikan sesi bernama `default` berstatus **WORKING** (ditandai warna hijau)

Jika status bukan WORKING, lihat bagian [Mengelola Sesi WhatsApp](#7-mengelola-sesi-whatsapp).

---

### Ringkasan Urutan Startup

```
1. Buka Docker Desktop       → tunggu hingga siap
2. Jalankan: n8n start       → tunggu "ready on port 5678"
3. Klik dua kali start.bat   → browser terbuka otomatis
4. Cek http://localhost:3001 → pastikan WhatsApp WORKING
```

**Total waktu startup: sekitar 2–3 menit**

---

## 2. Mematikan Sistem

Saat selesai bekerja atau saat komputer akan dimatikan:

### Cara Mematikan yang Aman

1. **Tutup dashboard** di browser (tidak perlu langkah khusus)
2. **Tutup jendela Command Prompt n8n** — klik X atau tekan `Ctrl + C` lalu tutup
3. **Tutup jendela Command Prompt start.bat** — ada dua jendela, tutup keduanya
4. **Docker / WAHA** — boleh dibiarkan berjalan (WAHA akan otomatis restart saat komputer nyala lagi), atau matikan dari Docker Desktop

> 💡 TIP: WAHA (WhatsApp) tidak perlu dimatikan setiap hari. Biarkan berjalan di Docker — sesi WhatsApp akan tetap aktif selama Docker berjalan, bahkan setelah komputer restart.

---

## 3. Cek Status Sistem

Gunakan tabel ini untuk memverifikasi semua layanan berjalan normal:

| Layanan | URL yang Dibuka | Tampilan Normal | Masalah |
|---|---|---|---|
| Dashboard Admin | http://localhost:5000 | Halaman dashboard BPS | Halaman tidak bisa dibuka |
| n8n | http://localhost:5678 | Editor workflow n8n | "This site can't be reached" |
| WAHA | http://localhost:3001 | WAHA dashboard | Error atau tidak muncul |
| WhatsApp | http://localhost:3001 → Sessions | Status: WORKING | Status: STOPPED / QR_CODE |
| Metabase | http://localhost:3002 | Halaman login Metabase | Tidak bisa dibuka |

> 📋 NOTE: Metabase (port 3002) bersifat opsional — tidak mempengaruhi fungsi chatbot jika tidak berjalan.

---

## 4. Mengelola PDF Knowledge Base

Knowledge Base adalah kumpulan dokumen PDF BPS yang dijadikan sumber pengetahuan chatbot. Semakin lengkap dokumen yang di-upload, semakin akurat jawaban chatbot.

### 4.1 Jenis PDF yang Baik untuk Di-upload

| Jenis Dokumen | Contoh | Prioritas |
|---|---|---|
| Buku tahunan statistik | Pekanbaru Dalam Angka (terbaru) | ⭐⭐⭐ Sangat Penting |
| Statistik daerah | Statistik Daerah Kota Pekanbaru | ⭐⭐⭐ Sangat Penting |
| Hasil sensus | Hasil SP2020, SE2026 | ⭐⭐⭐ Sangat Penting |
| Survei khusus | SUSENAS, SAKERNAS | ⭐⭐ Penting |
| Publikasi tematik | Statistik Kemiskinan, Ketenagakerjaan | ⭐⭐ Penting |
| Profil kecamatan | Kecamatan Dalam Angka | ⭐ Tambahan |

### ⚠️ PDF yang Tidak Bisa Diproses dengan Baik

- **PDF scan / foto** — PDF yang isinya foto/gambar dari kertas fisik, bukan teks asli. Sistem tidak bisa membaca teks dari gambar.
- **PDF terproteksi** — PDF yang dikunci dengan password
- **PDF dalam bahasa asing** — Sistem dioptimalkan untuk bahasa Indonesia

> 💡 TIP: Cara cek apakah PDF bisa di-copy teksnya: buka PDF di browser atau Acrobat Reader, coba select teks dengan mouse dan copy. Jika bisa di-copy, PDF tersebut bisa diproses sistem. Jika tidak bisa di-select, berarti PDF scan.

---

### 4.2 Cara Upload PDF Baru

1. Buka Dashboard Admin di **http://localhost:5000**
2. Klik menu **PDF Processor** di sidebar sebelah kiri
3. Di area upload, **drag & drop** file PDF atau klik area tersebut untuk browse file
4. Pilih satu atau beberapa file PDF sekaligus
5. Klik tombol **Proses PDF**
6. Tunggu progress bar selesai — ada dua tahap:

#### Tahap Pemrosesan PDF

**Tahap 1 — Processing (Memproses)**
- Sistem membaca setiap halaman PDF
- Mengekstrak teks
- Mengkonversi tabel menjadi teks
- Memotong teks menjadi potongan-potongan kecil (chunks)
- *Durasi: 1–5 menit per file, tergantung jumlah halaman*

**Tahap 2 — Embedding (Ke Supabase)**
- Setiap potongan teks dikirim ke Google Gemini untuk diubah menjadi vektor angka
- Vektor disimpan ke database Supabase
- *Durasi: 2–10 menit, tergantung jumlah chunks dan koneksi internet*

> ⚠️ WARNING: Jangan tutup browser atau matikan komputer saat proses berjalan. Jika terputus di tengah jalan, file harus diproses ulang.

7. Setelah selesai, muncul notifikasi **"PDF berhasil diproses"** berwarna hijau
8. Chatbot sudah bisa menjawab berdasarkan dokumen tersebut

---

### 4.3 Melihat Daftar Dokumen yang Sudah Di-upload

Di halaman PDF Processor, scroll ke bawah — ada tabel yang menampilkan semua file yang sudah pernah diproses, beserta jumlah chunks dan tanggal upload.

Anda juga bisa cek langsung di Supabase:
1. Buka https://supabase.com dan login
2. Pilih project BPS chatbot
3. Klik **Table Editor** → pilih tabel `ingested_files`
4. Akan tampil daftar semua PDF yang sudah diproses

---

### 4.4 Menghapus Dokumen dari Knowledge Base

Kadang perlu menghapus dokumen lama yang datanya sudah tidak relevan (misalnya statistik tahun lama yang ingin diganti versi terbaru).

**Cara Menghapus via Supabase:**
1. Login ke https://supabase.com → buka project
2. Klik **SQL Editor**
3. Untuk menghapus satu file berdasarkan nama:
```sql
DELETE FROM documents 
WHERE metadata->>'source' = 'nama-file.pdf';

DELETE FROM ingested_files 
WHERE file_name = 'nama-file.pdf';
```

4. Untuk menghapus **semua** dokumen dan mulai dari awal:
```sql
TRUNCATE TABLE documents;
TRUNCATE TABLE ingested_files;
```

> ⚠️ WARNING: `TRUNCATE` akan menghapus **semua** data permanen. Setelah ini, semua PDF harus di-upload ulang. Lakukan hanya jika benar-benar diperlukan.

---

### 4.5 Mode Upload: Append vs Replace

Saat upload PDF, ada pilihan mode:

| Mode | Artinya | Kapan Digunakan |
|---|---|---|
| **Append** (Tambah) | Dokumen baru ditambahkan ke yang sudah ada | Untuk menambah publikasi baru |
| **Replace** (Ganti) | Hapus semua, ganti dengan dokumen baru | Saat ingin reset total knowledge base |

Untuk operasional normal, gunakan mode **Append**.

---

## 5. Memantau Chatbot WhatsApp

### 5.1 Cara Cek Apakah Chatbot Aktif

1. Kirim pesan ke nomor WhatsApp bot dari nomor lain
2. Pesan singkat seperti *"Halo"* atau *"Apa itu BPS?"*
3. Bot harus membalas dalam **5–15 detik**

Jika bot tidak membalas dalam 30 detik, ada masalah — lihat [TROUBLESHOOTING.md](TROUBLESHOOTING.md).

---

### 5.2 Melihat Log Percakapan di n8n

n8n menyimpan riwayat semua eksekusi workflow (percakapan yang masuk):

1. Buka **http://localhost:5678**
2. Klik menu **Executions** di sidebar kiri (ikon jam)
3. Akan tampil daftar semua percakapan yang pernah diproses
4. Klik salah satu execution untuk melihat detail:
   - Pesan yang masuk
   - Tool mana yang dipanggil (RAG / BPS API)
   - Jawaban yang diberikan
   - Waktu proses

#### Memahami Status Eksekusi

| Warna / Status | Artinya |
|---|---|
| 🟢 Hijau / Success | Berhasil — bot membalas dengan normal |
| 🔴 Merah / Error | Gagal — ada error yang perlu diperiksa |
| 🟡 Kuning / Warning | Selesai tapi ada peringatan |

---

### 5.3 Tanda-tanda Chatbot Bermasalah

Perhatikan jika ada tanda-tanda berikut:

- ❌ Bot tidak membalas sama sekali
- ❌ Bot membalas tapi isinya hanya `""` (kosong)
- ❌ Bot membalas dengan kalimat "Maaf, saya tidak memiliki informasi..." untuk semua pertanyaan
- ❌ Semua eksekusi di n8n berstatus merah (error)

Jika ada salah satu di atas, segera cek [TROUBLESHOOTING.md](TROUBLESHOOTING.md).

---

## 6. Mengelola Kredensial

Kredensial adalah kunci akses ke layanan eksternal (Supabase, Gemini, WAHA, n8n). Perlu diperbarui jika ada yang expired atau berubah.

### 6.1 Cara Masuk ke Halaman Kredensial

1. Buka Dashboard Admin di **http://localhost:5000**
2. Klik menu **Credentials** di sidebar kiri
3. Pilih layanan yang ingin diperbarui

### 6.2 Kapan Perlu Memperbarui Kredensial

| Kredensial | Kapan Perlu Update |
|---|---|
| **n8n API Key** | Setiap kali key expired (ada tanggal expiry) atau saat buat key baru |
| **Gemini API Key** | Jika key lama dihapus/expired di Google AI Studio |
| **Supabase** | Jika URL atau service key berubah (jarang terjadi) |
| **WAHA** | Jika API key WAHA diubah |

### 6.3 Cara Update Kredensial

1. Buka halaman Credentials → klik layanan yang ingin diupdate
2. Hapus nilai lama di form
3. Isi nilai baru
4. Klik **Simpan**
5. Sistem otomatis memperbarui konfigurasi di n8n

> ⚠️ WARNING: Jangan bagikan API key kepada orang lain. API key yang bocor bisa disalahgunakan dan menyebabkan tagihan tak terduga di Google atau layanan lainnya.

---

## 7. Mengelola Sesi WhatsApp

### 7.1 Cek Status Sesi

1. Buka **http://localhost:3001**
2. Lihat daftar sessions
3. Sesi `default` harus berstatus **WORKING**

### 7.2 Jika Status STOPPED atau ERROR

1. Klik tombol **Stop** pada sesi `default` (jika ada)
2. Tunggu 5 detik
3. Klik tombol **Start** pada sesi `default`
4. Tunggu status berubah menjadi WORKING (bisa 10–30 detik)
5. Jika langsung WORKING tanpa perlu scan QR → beres

### 7.3 Jika Harus Scan QR Ulang (SCAN_QR_CODE)

Ini terjadi jika sesi kadaluarsa atau WhatsApp di-logout dari perangkat lain.

1. Di WAHA Dashboard, klik sesi `default`
2. Klik **Show QR** atau scan dari halaman sesi
3. Buka WhatsApp di HP yang dipakai sebagai bot
4. Masuk ke **Settings → Linked Devices → Link a Device**
5. Scan QR code yang tampil di layar komputer
6. Tunggu hingga status berubah ke **WORKING**

> ⚠️ WARNING: Nomor WhatsApp yang digunakan untuk bot **tidak bisa digunakan di HP secara normal** selama terhubung ke WAHA. Gunakan nomor khusus untuk bot (bisa nomor dengan SIM card terpisah atau WhatsApp Business).

### 7.4 Jika WAHA Container Tidak Berjalan

1. Buka **Docker Desktop**
2. Klik tab **Containers**
3. Cari container bernama `waha`
4. Jika statusnya Stopped, klik ikon ▶ (Start)
5. Tunggu 10–15 detik
6. Buka http://localhost:3001 untuk konfirmasi

---

## 8. Jadwal Pembaruan Rutin

Agar chatbot selalu akurat dan up-to-date, disarankan jadwal pembaruan berikut:

### Harian
- ✅ Jalankan sistem sesuai checklist pagi
- ✅ Cek status WhatsApp (WORKING)
- ✅ Cek log n8n untuk error yang tidak biasa

### Mingguan
- 📋 Cek apakah ada publikasi BPS baru yang relevan
- 📋 Lihat riwayat pertanyaan pengguna di n8n — apakah ada pertanyaan yang tidak terjawab dengan baik?
- 📋 Cek expired date n8n API key (di n8n Settings → API)

### Bulanan
- 📊 Upload publikasi BPS terbaru (jika ada yang terbit bulan ini)
- 🔄 Review knowledge base — apakah ada dokumen lama yang perlu dihapus/diganti?
- 🔑 Cek semua API key — pastikan tidak ada yang mendekati expired

### Tahunan
- 📚 Upload edisi terbaru "X Dalam Angka" setelah terbit
- 🗃️ Pertimbangkan untuk reset knowledge base dan upload ulang semua dokumen versi terbaru

---

## 9. Yang Harus Dilakukan Jika Terjadi Masalah

### Langkah Pertama — Cek Dasar

Sebelum panik, selalu cek hal-hal dasar ini terlebih dahulu:

| Yang Dicek | Cara Cek | Solusi Cepat |
|---|---|---|
| Internet menyala? | Buka situs mana saja | Hubungi IT / cek router |
| Docker berjalan? | Lihat ikon Docker di taskbar | Buka Docker Desktop |
| n8n berjalan? | Buka http://localhost:5678 | Jalankan `n8n start` di terminal |
| Dashboard bisa dibuka? | Buka http://localhost:5000 | Jalankan start.bat |
| WhatsApp WORKING? | Buka http://localhost:3001 | Restart sesi atau scan QR |

### Langkah Kedua — Restart Berurutan

Jika cek dasar tidak menemukan masalah, coba restart semua layanan **berurutan**:

1. Tutup semua terminal dan browser
2. Di Docker Desktop, stop lalu start ulang container `waha`
3. Buka terminal baru, jalankan `n8n start`
4. Klik start.bat
5. Cek status sistem

### Langkah Ketiga — Lihat TROUBLESHOOTING.md

Jika masalah belum teratasi, buka [TROUBLESHOOTING.md](TROUBLESHOOTING.md) dan cari gejala yang sesuai.

### Langkah Keempat — Catat & Laporkan

Jika masalah masih belum bisa diselesaikan, catat informasi berikut untuk dilaporkan ke pengembang:

1. **Gejala**: Apa yang terjadi? (contoh: "Bot tidak membalas pesan apapun sejak jam 09.00")
2. **Error**: Apakah ada pesan error di terminal atau n8n? Screenshot/copy teks error-nya
3. **Langkah terakhir**: Terakhir kali sistem berjalan normal, apa yang berbeda? (misalnya: restart komputer, update Windows, dsb.)
4. **Screenshot**: Tangkap layar kondisi n8n Executions dan WAHA Dashboard

---

*Panduan ini dibuat untuk BPS Kota Pekanbaru.*  
*Untuk pertanyaan teknis, hubungi pengembang sistem.*
