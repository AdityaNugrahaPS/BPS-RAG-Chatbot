# Panduan Troubleshooting — BPS RAG Chatbot

Panduan ini berisi solusi untuk masalah-masalah yang paling sering terjadi.  
Baca gejala yang paling sesuai dengan masalah yang Anda hadapi, lalu ikuti langkah solusinya.

---

## Cara Membaca Error

Sebelum mencari solusi, ketahui **di mana melihat pesan error**:

| Tempat | Cara Membuka | Apa yang Terlihat |
|---|---|---|
| **n8n Execution Log** | http://localhost:5678 → Executions | Riwayat setiap percakapan, klik yang merah untuk lihat detail error |
| **Terminal n8n** | Jendela Command Prompt yang menjalankan `n8n start` | Error real-time saat n8n berjalan |
| **Terminal PDF API** | Jendela Command Prompt start.bat (yang bertuliskan PDF Processor) | Error saat upload/proses PDF |
| **Browser Console** | Tekan `F12` di browser → tab **Console** | Error frontend (tampilan dashboard) |
| **WAHA Dashboard** | http://localhost:3001 | Status sesi WhatsApp |

---

## Cek Cepat Status Sistem

Sebelum masuk ke troubleshooting spesifik, gunakan tabel ini untuk diagnosis cepat:

| # | Yang Dicek | URL / Cara | Hasil Normal | Jika Tidak Normal |
|---|---|---|---|---|
| 1 | Dashboard Admin | http://localhost:5000 | Halaman BPS muncul | Lihat [Masalah #6](#masalah-6--dashboard-tidak-bisa-dibuka) |
| 2 | n8n | http://localhost:5678 | Editor workflow n8n | Jalankan `n8n start` di terminal |
| 3 | n8n Workflow Aktif | http://localhost:5678 → Workflows | Toggle biru = aktif | Klik toggle untuk aktifkan |
| 4 | WAHA | http://localhost:3001 | WAHA Dashboard | Cek Docker Desktop, start container `waha` |
| 5 | WhatsApp Status | http://localhost:3001 → Sessions | Status: **WORKING** | Lihat [Masalah #3](#masalah-3--whatsapp-terputus--status-bukan-working) |
| 6 | Internet | Buka situs mana saja | Halaman terbuka | Hubungi IT / cek koneksi |

---

## Masalah #1 — Chatbot Tidak Membalas Sama Sekali

### Gejala
Pesan WhatsApp dikirim ke nomor bot, tapi tidak ada balasan sama sekali setelah lebih dari 1 menit.

### Penyebab Umum & Solusi

**Kemungkinan A: n8n tidak berjalan**

1. Coba buka http://localhost:5678 di browser
2. Jika tidak bisa dibuka → n8n tidak berjalan
3. Buka Command Prompt baru, ketik: `n8n start`
4. Tunggu muncul `n8n ready on port 5678`
5. Kirim pesan WhatsApp lagi untuk test

**Kemungkinan B: Workflow n8n tidak aktif**

1. Buka http://localhost:5678
2. Klik **Workflows** di menu kiri
3. Cari workflow bernama `Main Workflow` (atau nama serupa)
4. Lihat toggle di sebelah kanan nama workflow — jika abu-abu/mati, klik untuk mengaktifkan (menjadi biru)
5. Ulangi untuk sub-workflow RAG dan BPS API

**Kemungkinan C: WAHA tidak terhubung ke n8n**

1. Buka http://localhost:3001
2. Klik sesi `default` → cari pengaturan **Webhooks**
3. Pastikan ada webhook dengan URL yang mengarah ke n8n (biasanya `http://localhost:5678/webhook/...`)
4. Jika kosong, tambahkan webhook:
   - Buka n8n → Workflows → buka Main Workflow
   - Lihat node pertama (Webhook) — copy URL-nya
   - Kembali ke WAHA → tambahkan URL tersebut sebagai webhook

**Kemungkinan D: WhatsApp sesi tidak aktif**

1. Buka http://localhost:3001
2. Cek status sesi `default`
3. Jika bukan WORKING → lihat [Masalah #3](#masalah-3--whatsapp-terputus--status-bukan-working)

**Kemungkinan E: Docker tidak berjalan**

1. Lihat ikon Docker di taskbar — jika tidak ada, Docker belum dibuka
2. Buka Docker Desktop dari Start Menu
3. Tunggu Docker siap, lalu cek container `waha` — pastikan running

---

## Masalah #2 — Chatbot Membalas Tapi Jawabannya Tidak Relevan / "Tidak Tahu"

### Gejala
Bot membalas pesan, tapi selalu menjawab:
- *"Maaf, saya tidak memiliki informasi tentang itu"*
- *"Saya tidak dapat menemukan data yang Anda minta"*
- Jawaban sangat umum, tidak spesifik ke BPS Pekanbaru

### Penyebab & Solusi

**Kemungkinan A: Belum ada PDF yang di-upload ke knowledge base**

1. Buka Dashboard Admin → PDF Processor
2. Cek apakah ada daftar file yang sudah diproses
3. Jika kosong → upload PDF BPS yang relevan (lihat [PANDUAN_PENGGUNAAN.md #4](PANDUAN_PENGGUNAAN.md))
4. Setelah upload selesai, coba tanya lagi

**Kemungkinan B: Pertanyaan tidak cocok dengan isi dokumen**

Chatbot hanya bisa menjawab berdasarkan dokumen yang ada. Jika pertanyaan tentang topik yang belum ada dokumennya, bot tidak bisa menjawab.

Solusi: Upload dokumen yang relevan dengan topik pertanyaan tersebut.

**Kemungkinan C: RAG sub-workflow tidak berjalan**

1. Buka http://localhost:5678 → Workflows
2. Pastikan workflow RAG Knowledge Base aktif (toggle biru)
3. Kirim pertanyaan lagi
4. Buka Executions → lihat execution terakhir → apakah RAG sub-workflow dipanggil?

**Kemungkinan D: Threshold similarity terlalu tinggi**

Ini masalah teknis — jika dokumen ada tapi bot tetap tidak tahu, mungkin threshold pencarian terlalu ketat. Hubungi pengembang untuk menyesuaikan nilai `match_threshold` di RAG sub-workflow.

---

## Masalah #3 — WhatsApp Terputus / Status Bukan WORKING

### Gejala
Di WAHA Dashboard, status sesi `default` menampilkan:
- `STOPPED`
- `SCAN_QR_CODE`
- `FAILED`
- `PAIRING`

### Solusi Berdasarkan Status

**Status: STOPPED**

1. Buka http://localhost:3001
2. Temukan sesi `default`
3. Klik tombol **Start** (ikon ▶)
4. Tunggu 10–30 detik — status harus berubah ke WORKING
5. Jika berubah ke SCAN_QR_CODE → lanjut ke langkah berikut

**Status: SCAN_QR_CODE**

Session kadaluarsa atau WhatsApp di-logout dari perangkat lain. Perlu scan QR ulang.

1. Di WAHA Dashboard, klik sesi `default`
2. Akan muncul QR code
3. Buka WhatsApp di HP yang dipakai sebagai bot
4. Masuk ke **Settings** (Pengaturan) → **Linked Devices** (Perangkat Tertaut)
5. Klik **Link a Device** (Tautkan Perangkat)
6. Arahkan kamera HP ke QR code di layar komputer
7. Tunggu hingga status berubah ke **WORKING** (biasanya 5–15 detik setelah scan)

> ⚠️ WARNING: QR code hanya valid selama **60 detik**. Jika kadaluarsa, refresh halaman WAHA untuk mendapatkan QR code baru.

**Status: FAILED**

1. Klik **Stop** pada sesi
2. Tunggu 10 detik
3. Klik **Delete** sesi (jika ada tombolnya)
4. Buat sesi baru dengan nama `default`
5. Klik **Start** → scan QR code

**WAHA tidak bisa dibuka sama sekali (http://localhost:3001 error)**

1. Buka **Docker Desktop**
2. Klik tab **Containers**
3. Cari container `waha`
4. Jika Stopped → klik ▶ untuk start
5. Jika tidak ada container `waha` sama sekali → perlu setup ulang WAHA (lihat SETUP.md bagian 6)

---

## Masalah #4 — PDF Gagal Diproses / Error Saat Upload

### Gejala
- Progress bar berhenti di tengah jalan
- Muncul pesan error merah
- Status berubah ke "Gagal" atau "Error"

### Solusi

**Langkah 1 — Cek apakah PDF Processor API berjalan**

1. Buka http://localhost:5000 di browser
2. Buka http://localhost:8503 di tab baru — jika muncul `{"message":"BPS PDF Processor API"}`, API berjalan
3. Jika tidak bisa diakses → API tidak jalan
4. Jalankan ulang: buka Command Prompt, masuk ke folder `program1_pdf_processor`, jalankan `python api.py`

**Langkah 2 — Cek apakah kredensial sudah diisi**

1. Buka Dashboard → Credentials
2. Pastikan **Supabase** (URL + Service Key) sudah diisi
3. Pastikan **AI Models** (Gemini API Key) sudah diisi
4. Jika belum → isi dan simpan, lalu coba upload ulang

**Langkah 3 — Cek jenis PDF**

1. Coba buka PDF tersebut di browser atau Adobe Reader
2. Coba select teks di dalamnya dengan mouse dan copy (`Ctrl+C`)
3. Jika tidak bisa di-select → PDF ini adalah scan/gambar, tidak bisa diproses
4. Solusi: gunakan PDF yang isinya teks digital, bukan hasil scan

**Langkah 4 — Cek koneksi internet**

Proses embedding membutuhkan koneksi ke server Google (Gemini). Pastikan internet terhubung selama proses berlangsung.

**Langkah 5 — Cek ukuran file**

File PDF yang sangat besar (>100MB, >500 halaman) mungkin membutuhkan waktu sangat lama. Coba dengan file yang lebih kecil dulu untuk test.

---

## Masalah #5 — PDF Berhasil Diproses Tapi Chatbot Tetap Tidak Tahu Isinya

### Gejala
Upload PDF berhasil (status hijau, ada di daftar), tapi saat ditanya tentang isi PDF tersebut, bot tetap menjawab tidak tahu.

### Solusi

**Langkah 1 — Verifikasi data masuk ke Supabase**

1. Login ke https://supabase.com → buka project
2. Klik **Table Editor** → pilih tabel `documents`
3. Apakah ada baris data? Jika tabel kosong → embedding gagal tersimpan meski tidak ada error
4. Cek juga tabel `ingested_files` — apakah nama file ada di sana?

**Langkah 2 — Coba pertanyaan yang lebih spesifik**

Chatbot bekerja lebih baik dengan pertanyaan spesifik. Contoh:
- ❌ "Ceritakan tentang Pekanbaru" (terlalu umum)
- ✅ "Berapa jumlah penduduk Kota Pekanbaru tahun 2023?" (spesifik)
- ✅ "Apa tingkat pengangguran di Pekanbaru menurut data BPS?" (spesifik)

**Langkah 3 — Periksa log RAG di n8n**

1. Buka http://localhost:5678 → Executions
2. Klik execution terbaru (setelah mengirim pertanyaan test)
3. Lihat apakah RAG Knowledge Base tool dipanggil
4. Jika tidak dipanggil → masalah di AI Agent, hubungi pengembang
5. Jika dipanggil tapi hasilnya kosong → data belum masuk ke Supabase dengan benar

**Langkah 4 — Upload ulang PDF**

1. Hapus data lama dari Supabase (lihat panduan hapus dokumen)
2. Upload PDF tersebut lagi dari awal
3. Pastikan proses embedding selesai 100%

---

## Masalah #6 — Dashboard Tidak Bisa Dibuka

### Gejala
Membuka http://localhost:5000 menampilkan error `ERR_CONNECTION_REFUSED` atau halaman kosong.

### Solusi

**Kemungkinan A: start.bat belum dijalankan**

1. Buka folder project
2. Klik dua kali `start.bat`
3. Tunggu 5–10 detik
4. Buka http://localhost:5000 lagi

**Kemungkinan B: Port 5000 sudah dipakai aplikasi lain**

1. Buka Command Prompt sebagai Administrator
2. Ketik: `netstat -ano | findstr :5000`
3. Jika ada proses yang menggunakan port 5000, catat PID-nya
4. Ketik: `taskkill /PID [nomor PID] /F`
5. Coba jalankan start.bat lagi

**Kemungkinan C: Node.js tidak terinstall**

1. Buka Command Prompt, ketik: `node --version`
2. Jika error → install Node.js dari https://nodejs.org (pilih LTS)

**Kemungkinan D: Dependensi belum diinstall**

1. Buka Command Prompt
2. Masuk ke folder frontend: `cd C:\BPS-Chatbot\frontend`
3. Jalankan: `npm install`
4. Tunggu selesai, lalu coba start.bat lagi

---

## Masalah #7 — Kredensial Hilang / Kosong Setelah Restart

### Gejala
Setelah komputer restart atau browser di-refresh, halaman Credentials menampilkan semua field kosong, padahal sudah pernah diisi.

### Penyebab
Kredensial disimpan di file `.credentials_all.json` di folder `program1_pdf_processor/`. Jika dashboard menampilkan kosong, kemungkinan:
- API backend (port 8503) tidak berjalan saat halaman dibuka
- File kredensial terhapus atau korup

### Solusi

**Langkah 1 — Pastikan API backend berjalan**

1. Buka http://localhost:8503 di browser
2. Jika muncul `{"message":"..."}` → API berjalan, refresh halaman dashboard
3. Jika tidak bisa diakses → jalankan `python api.py` di folder `program1_pdf_processor`

**Langkah 2 — Cek file kredensial**

1. Buka folder `program1_pdf_processor`
2. Cari file `.credentials_all.json` — pastikan ada dan ukurannya lebih dari 0 byte
3. Jika file ada tapi dashboard tetap kosong, kemungkinan API belum sempat load — tunggu 3 detik lalu refresh browser

**Langkah 3 — Isi ulang jika perlu**

Jika file terhapus, Anda perlu isi ulang semua kredensial dari Dashboard → Credentials. Data kredensial tidak ada backup otomatis, jadi pastikan Anda menyimpan semua API key di tempat yang aman (misalnya file Excel terproteksi).

---

## Masalah #8 — n8n API Key Expired

### Gejala
- Dashboard menampilkan pesan error saat menyimpan kredensial n8n
- Sinkronisasi ke n8n gagal
- Di terminal PDF API, muncul error `401 Unauthorized` atau `403 Forbidden` terkait n8n

### Solusi

**Langkah 1 — Buat API Key baru di n8n**

1. Buka http://localhost:5678
2. Klik foto profil / avatar di pojok kanan atas
3. Pilih **Settings**
4. Klik **API** di menu kiri
5. Klik **Create API Key**
6. Beri nama (misalnya `chatbot-admin-2026`)
7. Set tanggal kadaluarsa (disarankan 1 tahun ke depan)
8. Klik **Create** → **Copy** API key yang muncul

> ⚠️ WARNING: API key hanya tampil sekali! Segera copy dan simpan di tempat aman sebelum menutup dialog.

**Langkah 2 — Update di Dashboard**

1. Buka http://localhost:5000 → Credentials → n8n
2. Hapus API key lama
3. Paste API key baru
4. Klik **Simpan**

---

## Masalah #9 — Gemini API Error (Quota / Invalid Key)

### Gejala
- Proses embedding PDF gagal dengan error yang menyebut "quota" atau "API key"
- Chatbot tidak membalas, dan di log n8n ada error Gemini
- Error: `RESOURCE_EXHAUSTED`, `INVALID_ARGUMENT`, atau `API_KEY_INVALID`

### Solusi

**Error: `API_KEY_INVALID`**

API key Gemini salah atau sudah dihapus.
1. Buka https://aistudio.google.com/apikey
2. Cek apakah API key masih ada dan aktif
3. Jika sudah dihapus → buat key baru → update di Dashboard Credentials

**Error: `RESOURCE_EXHAUSTED` (Quota Exceeded)**

Batas gratis Gemini sudah tercapai untuk hari ini.
1. Tunggu hingga besok — quota reset otomatis setiap 24 jam
2. Atau upgrade ke paket berbayar di Google AI Studio
3. Sebagai solusi sementara: tidak bisa melakukan embedding PDF baru hari ini, tapi chatbot yang sudah ada tetap bisa menjawab berdasarkan dokumen yang sudah di-embed sebelumnya

> 📋 NOTE: Batas gratis Gemini saat ini (2025): sekitar 1.500 request/hari untuk embedding dan 1.000 request/hari untuk chat. Untuk operasional normal BPS, batas ini biasanya cukup.

---

## Masalah #10 — Supabase Connection Error

### Gejala
- Upload PDF gagal dengan error yang menyebut "Supabase", "connection", atau "database"
- Error: `invalid API key`, `JWT expired`, `connection refused`

### Solusi

**Langkah 1 — Verifikasi kredensial Supabase**

1. Login ke https://supabase.com → buka project
2. Klik **Settings** → **API**
3. Copy **Project URL** (format: `https://xxxxxxxx.supabase.co`)
4. Copy **service_role** key (bukan `anon` key!)
5. Update di Dashboard → Credentials → Supabase

**Langkah 2 — Cek apakah project Supabase masih aktif**

1. Login ke supabase.com
2. Buka project — apakah ada pesan "Project is paused"?
3. Jika ter-pause (free tier bisa otomatis pause jika tidak aktif 7 hari) → klik **Restore project**
4. Tunggu 1–2 menit hingga project aktif kembali

**Langkah 3 — Cek tabel database**

1. Di Supabase → **Table Editor**
2. Pastikan tabel `documents` dan `ingested_files` ada
3. Jika tidak ada → perlu dibuat ulang (lihat SETUP.md bagian 4.4)

---

## Masalah #11 — Jawaban Chatbot Kosong `"output": ""`

### Gejala
Chatbot membalas pesan WhatsApp, tapi balasannya kosong atau berisi karakter aneh.

### Penyebab & Solusi

**Kemungkinan A: Model Gemini tidak kompatibel**

1. Buka n8n → Main Workflow → klik node **AI Agent**
2. Cek model yang digunakan di **Chat Model** — harus `Gemini 2.0 Flash` atau `Gemini 1.5 Flash`
3. Jika menggunakan model selain Gemini (Ollama, Groq, dll) → ganti ke Gemini

**Kemungkinan B: Prompt sistem bermasalah**

1. Di n8n Main Workflow → klik node **AI Agent**
2. Cek bagian **System Message** — pastikan ada instruksi yang jelas
3. Jika kosong → tambahkan prompt: *"Kamu adalah asisten statistik BPS Kota Pekanbaru..."*

**Kemungkinan C: Tool calling tidak berjalan**

1. Di n8n → Executions → buka execution yang bermasalah
2. Cek apakah AI Agent memanggil tool RAG atau BPS API
3. Jika tidak ada tool yang dipanggil → hubungi pengembang untuk memperbaiki konfigurasi tools

---

## Masalah #12 — Docker Tidak Bisa Dijalankan

### Gejala
- Docker Desktop tidak mau dibuka
- Muncul error saat membuka Docker Desktop
- Perintah `docker --version` tidak dikenali

### Solusi

**Docker Desktop tidak bisa dibuka (WSL Error)**

1. Buka PowerShell sebagai Administrator
2. Ketik: `wsl --update`
3. Tunggu selesai, lalu restart komputer
4. Buka Docker Desktop lagi

**Docker Desktop tidak terinstall**

1. Download dari https://www.docker.com/products/docker-desktop
2. Install dengan setting default
3. Restart komputer setelah install
4. Buka Docker Desktop dan tunggu hingga siap

**Container WAHA hilang (tidak ada di Docker Desktop)**

Ini terjadi jika Docker Desktop di-reset atau reinstall. Perlu menjalankan ulang container:

1. Buka Command Prompt
2. Jalankan perintah berikut:
```
docker run -d --name waha --restart always -p 3001:3000 -e WHATSAPP_API_KEY=mysecretkey devlikeapro/waha
```
3. Ganti `mysecretkey` dengan API key yang sama seperti yang diisi di Dashboard Credentials → WAHA
4. Tunggu container berjalan, lalu scan QR code WhatsApp lagi

---

## Masalah #13 — `npm install` atau `pip install` Gagal

### Gejala
Saat menjalankan `npm install` di folder `frontend/` atau `pip install -r requirements.txt` di `program1_pdf_processor/`, muncul error.

### Solusi

**Error `npm install`: `EACCES: permission denied`**

1. Tutup Command Prompt
2. Buka Command Prompt baru sebagai **Administrator** (klik kanan → Run as administrator)
3. Coba `npm install` lagi

**Error `npm install`: `ENOENT: no such file or directory`**

1. Pastikan Anda berada di folder `frontend/`
2. Ketik: `cd C:\BPS-Chatbot\frontend` (sesuaikan path)
3. Coba lagi

**Error `pip install`: `Microsoft Visual C++ required`**

1. Download dan install **Microsoft C++ Build Tools** dari:
   https://visualstudio.microsoft.com/visual-cpp-build-tools/
2. Centang **Desktop development with C++** saat install
3. Restart komputer
4. Coba `pip install` lagi

**Error `pip install`: SSL Certificate Error**

1. Coba dengan flag tambahan:
```
pip install -r requirements.txt --trusted-host pypi.org --trusted-host files.pythonhosted.org
```

**Error `pip install`: `PyMuPDF` gagal install**

1. Coba upgrade pip dulu:
```
pip install --upgrade pip
```
2. Lalu install ulang:
```
pip install PyMuPDF
```

---

## Masalah Tidak Ada di Daftar Ini?

Jika masalah yang Anda hadapi tidak tercantum di atas, lakukan langkah berikut:

### 1. Kumpulkan Informasi

Sebelum menghubungi pengembang, kumpulkan informasi ini:

- **Screenshot** kondisi n8n (Executions page) — tunjukkan execution yang error, klik dan screenshot detail error-nya
- **Screenshot** WAHA Dashboard — tunjukkan status sesi
- **Isi error message** — copy teks error dari terminal, jangan hanya screenshot (supaya bisa di-search)
- **Kapan mulai terjadi** — apakah setelah restart komputer? Setelah update Windows? Setelah mengubah sesuatu?
- **Langkah yang sudah dicoba** — agar tidak disuruh mengulang langkah yang sama

### 2. Cek Log Terminal

Di jendela Command Prompt yang menjalankan n8n atau PDF Processor API, scroll ke atas untuk melihat pesan error terbaru. Copy teks tersebut.

### 3. Hubungi Pengembang

Sertakan semua informasi di atas saat melaporkan masalah.

---

*Panduan ini dibuat untuk BPS Kota Pekanbaru.*  
*Repository: https://github.com/AdityaNugrahaPS/BPS-RAG-Chatbot*
