# Panduan Setup Lengkap — BPS RAG Chatbot

Panduan ini menjelaskan cara instalasi sistem dari **nol** di komputer baru.
Estimasi waktu: **90–120 menit** (tergantung koneksi internet dan pengalaman teknis).

> 📋 NOTE: Panduan ini ditujukan untuk teknisi atau staf IT yang akan melakukan setup pertama kali. Untuk operasional sehari-hari setelah setup selesai, lihat [PANDUAN_PENGGUNAAN.md](PANDUAN_PENGGUNAAN.md).

---

## Daftar Isi

1. [Gambaran Besar Sistem](#1-gambaran-besar-sistem)
2. [Cek Kebutuhan Software](#2-cek-kebutuhan-software)
3. [Clone / Salin Project](#3-clone--salin-project)
4. [Setup Supabase](#4-setup-supabase)
5. [Setup Google Gemini API](#5-setup-google-gemini-api)
6. [Setup BPS Web API](#6-setup-bps-web-api)
7. [Setup n8n](#7-setup-n8n)
8. [Setup WAHA (WhatsApp)](#8-setup-waha-whatsapp)
9. [Install Dependensi Frontend & Backend](#9-install-dependensi-frontend--backend)
10. [Jalankan Sistem & Konfigurasi Kredensial](#10-jalankan-sistem--konfigurasi-kredensial)
11. [Import Workflow n8n](#11-import-workflow-n8n)
12. [Upload PDF Pertama](#12-upload-pdf-pertama)
13. [Verifikasi Sistem Berjalan](#13-verifikasi-sistem-berjalan)
14. [Setup Metabase (Opsional)](#14-setup-metabase-opsional)

---

## 1. Gambaran Besar Sistem

Sebelum mulai, penting untuk memahami apa yang akan kita bangun dan mengapa setiap komponen diperlukan.

### Diagram Ketergantungan (Dependency)

```
Supabase (cloud)   ←── harus ada dulu, untuk menyimpan dokumen
     │
     ▼
Gemini API Key     ←── harus ada dulu, untuk embedding & chat AI
     │
     ▼
n8n (workflow)     ←── harus jalan sebelum WAHA bisa kirim pesan ke sini
     │
     ▼
WAHA (WhatsApp)    ←── butuh URL webhook n8n untuk konfigurasi
     │
     ▼
Dashboard Admin    ←── untuk upload PDF, konfigurasikan semua kredensial
     │
     ▼
PDF di-upload      ←── baru chatbot bisa menjawab berdasarkan dokumen
```

### Komponen yang Perlu Dibuat/Disiapkan

| Komponen | Di Mana | Perlu Akun Baru? |
|---|---|---|
| Supabase | Cloud (supabase.com) | Ya — daftar gratis |
| Google Gemini API | Cloud (aistudio.google.com) | Ya — pakai akun Google |
| BPS Web API | Cloud (webapi.bps.go.id) | Ya — daftar gratis |
| n8n | Komputer lokal | Tidak perlu akun cloud |
| WAHA | Komputer lokal (Docker) | Tidak perlu akun cloud |
| Dashboard Admin | Komputer lokal | Tidak perlu akun cloud |

---

## 2. Cek Kebutuhan Software

Sebelum mulai, pastikan semua software berikut sudah terinstall di komputer.

### Software Wajib

| Software | Versi Minimum | Cek Versi | Link Download |
|---|---|---|---|
| **Node.js** | 18 LTS (disarankan 20 LTS) | `node --version` | https://nodejs.org |
| **Python** | 3.11 atau lebih baru | `python --version` | https://python.org |
| **n8n** | terbaru | `n8n --version` | Install via npm |
| **Git** | terbaru | `git --version` | https://git-scm.com |
| **Docker Desktop** | terbaru | `docker --version` | https://docker.com/products/docker-desktop |

### Cara Cek

Buka Command Prompt (tekan `Win + R`, ketik `cmd`, tekan Enter), lalu jalankan perintah berikut satu per satu:

```
node --version
python --version
git --version
docker --version
n8n --version
```

Jika muncul nomor versi (contoh: `v20.11.0`), artinya software sudah terinstall. Jika muncul error `tidak dikenal` atau `not recognized`, software belum terinstall dan perlu didownload dari link di atas.

### Install n8n (jika belum ada)

Setelah Node.js terinstall, buka Command Prompt dan jalankan:

```
npm install -g n8n
```

Proses ini memerlukan koneksi internet dan mungkin membutuhkan waktu 5–10 menit.

> ⚠️ WARNING: Jika instalasi n8n gagal karena masalah permission, coba jalankan Command Prompt sebagai **Administrator** (klik kanan → Run as administrator).

---

## 3. Clone / Salin Project

### Opsi A — Dari GitHub (Jika Ada Koneksi Internet)

Buka Command Prompt, navigasi ke folder tempat Anda ingin menyimpan project, lalu jalankan:

```bash
git clone https://github.com/AdityaNugrahaPS/BPS-RAG-Chatbot.git
cd BPS-RAG-Chatbot
```

### Opsi B — Dari Flashdisk / Folder Lain

Salin seluruh folder `BPS-n8n-RAG_ChatBot` ke lokasi yang mudah diakses, contohnya `C:\BPS-Chatbot`. Hindari meletakkan di folder dengan spasi di nama path jika memungkinkan.

### Penjelasan Isi Folder

Setelah project tersalin, inilah yang ada di dalamnya:

| Folder / File | Fungsi |
|---|---|
| `frontend/` | Antarmuka web admin (React) untuk upload PDF dan kelola kredensial |
| `program1_pdf_processor/` | Engine pemrosesan PDF: ekstraksi teks, chunking, embedding |
| `metabase/` | File konfigurasi Docker untuk Metabase analytics |
| `supabase/` | SQL schema dan script untuk membuat tabel di Supabase |
| `main_workflow.json` | Workflow n8n utama — menghubungkan WhatsApp dengan AI Agent |
| `rag_subworkflow.json` | Sub-workflow pencarian dokumen di vector database |
| `bps_api_subworkflow.json` | Sub-workflow pengambilan data real-time dari BPS Web API |
| `start.bat` | Script Windows untuk menjalankan dashboard dengan satu klik |

---

## 4. Setup Supabase

Supabase adalah database cloud yang menyimpan seluruh dokumen BPS yang sudah diproses, dalam bentuk vektor (angka-angka yang merepresentasikan makna teks). Ini yang memungkinkan chatbot "mencari" jawaban dari dokumen.

### Langkah 4.1 — Buat Akun Supabase

1. Buka browser dan pergi ke **https://supabase.com**
2. Klik tombol **Start your project** atau **Sign Up**
3. Daftar menggunakan akun GitHub atau email
4. Verifikasi email jika diminta

### Langkah 4.2 — Buat Project Baru

1. Setelah login, klik tombol **New Project** (tombol hijau di dashboard)
2. Pilih organisasi Anda (atau buat organisasi baru jika diminta)
3. Isi formulir:
   - **Name**: `bps-rag-chatbot` (atau nama lain yang mudah diingat)
   - **Database Password**: buat password yang kuat. **Simpan password ini di tempat aman** — tidak bisa dilihat lagi setelah ini!
   - **Region**: pilih **Southeast Asia (Singapore)** — ini paling dekat dengan Indonesia, sehingga lebih cepat
4. Klik **Create new project**
5. Tunggu 1–2 menit hingga project selesai dibuat (ada animasi loading)

> ⚠️ WARNING: Catat password database di tempat yang aman sekarang juga. Password ini dibutuhkan jika Anda menghubungkan Metabase ke Supabase nantinya.

### Langkah 4.3 — Aktifkan Ekstensi pgvector

pgvector adalah ekstensi yang memungkinkan Supabase menyimpan dan mencari data vektor (diperlukan untuk RAG).

1. Di dashboard Supabase project Anda, klik **Database** di menu sebelah kiri
2. Klik **Extensions** di submenu yang muncul
3. Di kolom pencarian, ketik `vector`
4. Temukan ekstensi bernama **vector** (oleh `pgroonga` atau `pgvector`)
5. Klik toggle untuk mengaktifkannya — berubah menjadi biru/hijau berarti aktif

> 💡 TIP: Jika tidak menemukan ekstensi ini, coba refresh halaman. Ekstensi ini sudah tersedia secara default di semua project Supabase baru.

### Langkah 4.4 — Buat Tabel Database

Sekarang kita perlu membuat struktur tabel tempat dokumen BPS akan disimpan.

1. Di menu sebelah kiri, klik **SQL Editor**
2. Klik **New query** (atau langsung di area editor yang muncul)
3. **Copy dan paste SQL berikut**, lalu klik **Run** (tombol hijau di kanan atas, atau tekan `Ctrl + Enter`):

**SQL 1 — Buat tabel `documents` (tempat menyimpan isi dokumen + vektor):**

```sql
CREATE TABLE IF NOT EXISTS documents (
  id        bigserial PRIMARY KEY,
  content   text,
  metadata  jsonb,
  embedding vector(768)
);
```

Penjelasan kolom:
- `id` — nomor unik setiap chunk dokumen
- `content` — potongan teks dari PDF
- `metadata` — informasi tambahan (nama file, nomor halaman, topik, dll)
- `embedding` — representasi vektor 768 dimensi dari teks (diisi otomatis saat PDF diproses)

**SQL 2 — Buat tabel `ingested_files` (tracking file yang sudah diproses):**

```sql
CREATE TABLE IF NOT EXISTS ingested_files (
  id          bigserial PRIMARY KEY,
  file_name   text,
  file_id     text,
  chunk_count integer,
  ingested_at timestamptz DEFAULT now()
);
```

Penjelasan kolom:
- `file_name` — nama file PDF yang sudah diproses
- `file_id` — ID unik file
- `chunk_count` — berapa banyak potongan teks yang dihasilkan dari PDF ini
- `ingested_at` — kapan file ini diproses

**SQL 3 — Buat fungsi `match_documents` (pencarian berdasarkan kemiripan makna):**

```sql
CREATE OR REPLACE FUNCTION match_documents (
  query_embedding vector(768),
  match_threshold float DEFAULT 0.5,
  match_count     int   DEFAULT 5
)
RETURNS TABLE (
  id         bigint,
  content    text,
  metadata   jsonb,
  similarity float
)
LANGUAGE sql STABLE
AS $$
  SELECT
    documents.id,
    documents.content,
    documents.metadata,
    1 - (documents.embedding <=> query_embedding) AS similarity
  FROM documents
  WHERE 1 - (documents.embedding <=> query_embedding) > match_threshold
  ORDER BY documents.embedding <=> query_embedding
  LIMIT match_count;
$$;
```

Fungsi ini adalah jantung sistem RAG. Ketika pengguna mengirim pertanyaan, pertanyaan tersebut diubah menjadi vektor, lalu fungsi ini mencari dokumen-dokumen yang paling "mirip maknanya" dengan pertanyaan tersebut.

Jalankan **ketiga SQL di atas satu per satu**, masing-masing klik Run setelah paste.

> ✅ SUCCESS: Jika berhasil, muncul pesan `Success. No rows returned` (untuk CREATE TABLE) atau `Success. No rows returned` (untuk CREATE FUNCTION).

### Langkah 4.5 — Ambil Kredensial Supabase

Inilah informasi yang akan dimasukkan ke dashboard chatbot nanti.

1. Di menu sebelah kiri, klik **Settings** (ikon gerigi di bagian bawah)
2. Klik **API** di submenu
3. Catat dua hal berikut:

| Yang Dicatat | Di Mana Letaknya | Contoh |
|---|---|---|
| **Project URL** | Bagian atas halaman, label "Project URL" | `https://abcdefgh.supabase.co` |
| **service_role key** | Bagian "Project API keys" → baris `service_role` → klik "Reveal" | `eyJhbGciOiJIUzI1NiIs...` (panjang) |

> ⚠️ WARNING: Gunakan kunci `service_role`, **bukan** `anon` (anonymous). Kunci `service_role` memiliki akses penuh ke database dan diperlukan untuk menulis data. **Jangan bagikan kunci ini kepada siapapun.**

> 💡 TIP: Tes koneksi mudah — setelah setup selesai, cek tabel `documents` di Supabase via menu **Table Editor**. Jika bisa dibuka, koneksi berhasil.

---

## 5. Setup Google Gemini API

Gemini adalah model AI dari Google yang digunakan untuk dua hal:
1. **Embedding** — mengubah teks PDF menjadi vektor angka saat proses upload
2. **Chat** — menjawab pertanyaan pengguna WhatsApp

### Langkah 5.1 — Dapatkan API Key

1. Buka browser dan pergi ke **https://aistudio.google.com/apikey**
2. Login dengan akun Google (bisa akun Gmail biasa)
3. Klik **Create API key**
4. Pilih project Google Cloud (atau buat project baru jika diminta)
5. Kunci API akan muncul — **copy dan simpan di tempat aman**

> ⚠️ WARNING: API Key Gemini terlihat seperti `AIzaSyAbc123...`. Jangan pernah membagikan kunci ini ke publik.

### Langkah 5.2 — Tentukan Berapa API Key yang Dibutuhkan

Sistem ini menggunakan Gemini untuk dua keperluan berbeda:

| Keperluan | Model | Digunakan Oleh |
|---|---|---|
| Embedding (saat upload PDF) | `models/gemini-embedding-001` | Dashboard Admin (program1_pdf_processor) |
| Chat (menjawab pertanyaan) | `gemini-2.0-flash` | n8n workflow |

> 💡 TIP: Anda bisa menggunakan **satu API key yang sama** untuk keduanya — lebih mudah. Namun jika ingin memisahkan quota, bisa buat dua API key berbeda.

### Catatan Batas Gratis (Free Tier)

| Model | Batas Gratis Per Menit | Yang Terjadi Jika Melebihi |
|---|---|---|
| Gemini 2.0 Flash | 15 request per menit | Error `429 RESOURCE_EXHAUSTED` — chatbot tidak akan menjawab sementara |
| Gemini Embedding 001 | 1500 request per menit | Upload PDF lambat atau error |

> 📋 NOTE: Untuk penggunaan internal BPS dengan traffic rendah, batas gratis ini biasanya lebih dari cukup. Jika chatbot mulai ramai digunakan, pertimbangkan upgrade ke API berbayar (pay-as-you-go).

---

## 6. Setup BPS Web API

BPS Web API memungkinkan chatbot mengambil data statistik terkini langsung dari server BPS, bukan hanya dari PDF yang di-upload.

### Langkah 6.1 — Daftar Akun

1. Buka **https://webapi.bps.go.id**
2. Klik **Register** atau **Daftar**
3. Isi formulir pendaftaran dengan data diri
4. Verifikasi email
5. Login dan cari menu **API Key** atau **My Profile** — di sana akan ada API key Anda

### Langkah 6.2 — Informasi Penting

| Informasi | Nilai |
|---|---|
| Base URL | `https://webapi.bps.go.id/v1/api/` |
| Kode Domain Pekanbaru | `1471` |

### Langkah 6.3 — Tes API di Browser

Untuk memastikan API key berfungsi, buka URL berikut di browser (ganti `YOUR_KEY` dengan API key Anda):

```
https://webapi.bps.go.id/v1/api/list/model/subject/domain/1471/key/YOUR_KEY/
```

Jika muncul data JSON berisi daftar subjek statistik Pekanbaru, API key Anda berfungsi dengan baik.

---

## 7. Setup n8n

n8n adalah mesin workflow yang mengatur seluruh alur chatbot: menerima pesan WhatsApp, memrosesnya dengan AI, mencari dokumen relevan, dan mengirim balasan.

### Langkah 7.1 — Install n8n

Jika belum terinstall (lihat Langkah 2):

```
npm install -g n8n
```

### Langkah 7.2 — Jalankan n8n untuk Pertama Kali

Buka Command Prompt baru dan jalankan:

```
n8n start
```

Tunggu hingga muncul pesan seperti:
```
n8n ready on port 5678
```

Buka browser dan pergi ke **http://localhost:5678**.

### Langkah 7.3 — Buat Akun Admin n8n

Karena ini pertama kali buka, n8n akan menampilkan halaman setup:

1. Isi **Email** dengan email Anda
2. Isi **First Name** dan **Last Name**
3. Isi **Password** — catat password ini
4. Klik **Next** atau **Get started**
5. Ikuti wizard setup hingga masuk ke halaman utama n8n

> 📋 NOTE: Data n8n (workflow, kredensial, dll) tersimpan di folder `C:\Users\[NamaUser]\.n8n\`. **Backup folder ini secara berkala** agar workflow tidak hilang jika ada masalah.

### Langkah 7.4 — Buat API Key n8n

API key ini diperlukan agar dashboard admin bisa berkomunikasi dengan n8n.

1. Di n8n, klik **avatar / foto profil** di pojok kanan atas
2. Klik **Settings**
3. Di menu sebelah kiri, klik **API**
4. Klik tombol **Create an API key**
5. Beri nama key ini, contoh: `bps-dashboard`
6. Klik **Create** — **Copy key yang muncul sekarang juga** karena tidak bisa dilihat lagi setelah ditutup

> ⚠️ WARNING: API key n8n bisa memiliki tanggal kedaluwarsa. Jika Anda mengatur expiry, catat tanggalnya. Jika key expired, chatbot tidak akan bisa berkomunikasi dengan n8n dari dashboard — buat key baru dan update di halaman Credentials dashboard.

### Langkah 7.5 — (Opsional) Jalankan n8n Otomatis saat Windows Menyala

Agar tidak perlu menjalankan `n8n start` manual setiap kali komputer restart:

1. Buat file teks baru bernama `n8n-autostart.bat` di folder manapun
2. Isi dengan:
   ```bat
   @echo off
   n8n start
   ```
3. Tekan `Win + R`, ketik `shell:startup`, tekan Enter
4. Salin file `n8n-autostart.bat` ke folder yang terbuka
5. Sekarang n8n akan otomatis berjalan saat Windows menyala

---

## 8. Setup WAHA (WhatsApp)

WAHA (WhatsApp HTTP API) adalah gateway yang menghubungkan WhatsApp dengan sistem chatbot. WAHA dijalankan menggunakan Docker.

### Apa Itu Docker?

Docker adalah software yang menjalankan aplikasi di dalam "container" — seperti kotak terisolasi yang berisi semua yang dibutuhkan aplikasi agar bisa berjalan. Anda tidak perlu menginstall WAHA secara langsung — cukup jalankan containernya.

### Langkah 8.1 — Install dan Aktifkan Docker Desktop

1. Download Docker Desktop dari **https://www.docker.com/products/docker-desktop**
2. Install dengan mengikuti wizard instalasi
3. Restart komputer jika diminta
4. Setelah restart, buka Docker Desktop dari Start Menu
5. Di Settings Docker Desktop → **General** → centang **Start Docker Desktop when you log in** agar Docker otomatis berjalan

### Langkah 8.2 — Jalankan WAHA Container

Buka Command Prompt dan jalankan perintah berikut (ketik sebagai satu baris, atau copy-paste seluruhnya):

```
docker run -d --name waha --restart always -p 3001:3000 -e WHATSAPP_API_KEY=mysecretkey devlikeapro/waha
```

Penjelasan setiap bagian perintah:

| Bagian | Artinya |
|---|---|
| `docker run` | Jalankan container baru |
| `-d` | Jalankan di background (tidak perlu window terbuka terus) |
| `--name waha` | Beri nama container ini "waha" |
| `--restart always` | Otomatis restart jika komputer restart atau WAHA crash |
| `-p 3001:3000` | Port 3001 di komputer Anda → port 3000 di dalam container |
| `-e WHATSAPP_API_KEY=mysecretkey` | Kunci rahasia untuk mengamankan WAHA — **ganti `mysecretkey` dengan kata rahasia pilihan Anda** |
| `devlikeapro/waha` | Image Docker WAHA yang akan didownload dari internet |

> 💡 TIP: Ganti `mysecretkey` dengan sesuatu yang lebih kuat, misalnya `bps-pekanbaru-2025`. Catat kata ini — akan dimasukkan ke Credentials dashboard nanti.

Tunggu hingga download selesai (bisa 5–10 menit pertama kali karena perlu download image). Setelah itu buka **http://localhost:3001** untuk memastikan WAHA berjalan.

### Langkah 8.3 — Scan QR Code WhatsApp

> ⚠️ WARNING: Nomor WhatsApp yang digunakan untuk scan akan menjadi **nomor bot**. Nomor itu tidak bisa digunakan di HP secara normal selama terhubung ke WAHA. Gunakan nomor khusus untuk bot (bisa beli SIM card baru atau gunakan nomor yang sudah tidak aktif dipakai).

1. Buka **http://localhost:3001** di browser
2. Klik **Sessions** di menu
3. Klik **Start** pada sesi bernama `default` (atau buat sesi baru dengan nama `default`)
4. Pilih tab **QR Code** — akan muncul QR code
5. Di HP dengan nomor yang akan menjadi bot:
   - Buka aplikasi **WhatsApp**
   - Pergi ke **Settings** (Pengaturan) → **Linked Devices** (Perangkat Tertaut)
   - Klik **Link a device** (Tautkan perangkat)
   - Scan QR code yang muncul di browser
6. Tunggu hingga status berubah menjadi **WORKING** (biasanya 10–30 detik)

> ✅ SUCCESS: Status **WORKING** berarti WhatsApp sudah terhubung. Bot sudah bisa menerima pesan.

### Langkah 8.4 — Set Webhook ke n8n

Webhook adalah URL yang akan dipanggil WAHA setiap kali ada pesan masuk WhatsApp. URL ini mengarah ke n8n agar pesan bisa diproses.

1. Di WAHA dashboard (http://localhost:3001)
2. Pergi ke Sessions → klik sesi `default`
3. Cari bagian **Webhooks** atau **Settings**
4. Set webhook URL:
   - URL: `http://localhost:5678/webhook/whatsapp`
   - (URL pastinya akan sesuai dengan yang ada di workflow n8n — cek di node webhook workflow utama setelah import)
5. Centang event **message** (atau `messages.upsert`)
6. Simpan

> 📋 NOTE: URL webhook yang tepat dapat dilihat setelah Anda mengimport `main_workflow.json` ke n8n. Cari node **Webhook** di workflow tersebut dan copy URL-nya, lalu paste ke konfigurasi WAHA ini.

---

## 9. Install Dependensi Frontend & Backend

### Langkah 9.1 — Install Dependensi Frontend (React)

Buka Command Prompt, navigasi ke folder frontend, lalu install:

```
cd C:\[path-ke-project]\frontend
npm install
```

Proses ini memerlukan internet dan mungkin membutuhkan 3–5 menit.

> ✅ SUCCESS: Muncul pesan `added XXX packages` tanpa error merah berarti berhasil.

### Langkah 9.2 — Install Dependensi Backend (Python)

Buka Command Prompt baru, navigasi ke folder backend:

```
cd C:\[path-ke-project]\program1_pdf_processor
pip install -r requirements.txt
```

Daftar library yang akan diinstall (dari `requirements.txt`):

| Library | Fungsi |
|---|---|
| `fastapi` | Framework API backend |
| `uvicorn` | Server untuk menjalankan FastAPI |
| `pdfplumber` | Membaca dan mengekstrak teks dari PDF |
| `PyMuPDF` | Library PDF tambahan (lebih kuat untuk tabel dan gambar) |
| `google-generativeai` | SDK untuk menggunakan Gemini AI |
| `supabase` | SDK untuk koneksi ke Supabase |
| `streamlit` | (Library tambahan, tidak digunakan aktif) |
| `pandas` | Pemrosesan data tabular |
| `httpx` | HTTP client untuk pemanggilan API |

### Masalah Umum Saat Install

**Error: `PyMuPDF` gagal install**

```
pip install --upgrade pip
pip install PyMuPDF
```

**Error: `pip` tidak dikenal**

Coba gunakan `pip3`:
```
pip3 install -r requirements.txt
```

Atau jalankan dengan Python secara eksplisit:
```
python -m pip install -r requirements.txt
```

**Error: Access Denied / Permission Error**

Jalankan Command Prompt sebagai Administrator (klik kanan → Run as Administrator).

---

## 10. Jalankan Sistem & Konfigurasi Kredensial

### Langkah 10.1 — Jalankan Sistem

Klik dua kali file **`start.bat`** di folder proyek. File ini akan:
1. Menjalankan **PDF Processor API** di background (port 8503)
2. Menjalankan **Frontend Dashboard** di background (port 5000)
3. Membuka browser ke `http://localhost:5000` secara otomatis

Tunggu 5–10 detik hingga browser terbuka dan dashboard tampil.

> 📋 NOTE: Dua jendela Command Prompt kecil (terminimize) akan muncul di taskbar — itu adalah proses API dan Frontend yang berjalan. Jangan ditutup!

### Langkah 10.2 — Konfigurasi Kredensial di Dashboard

Buka **http://localhost:5000** → klik menu **Credentials** (Kredensial).

Anda akan melihat beberapa bagian yang perlu diisi. Isi semuanya dengan informasi yang sudah Anda kumpulkan di langkah-langkah sebelumnya:

---

**Bagian 1: Supabase**

*Digunakan untuk: menyimpan dan mengambil dokumen dari vector database*

| Field | Nilai |
|---|---|
| Supabase URL | `https://[project-id].supabase.co` (dari langkah 4.5) |
| Service Role Key | `eyJ...` (dari langkah 4.5, kunci panjang yang dimulai `service_role`) |

---

**Bagian 2: AI Models (Gemini)**

*Digunakan untuk: embedding PDF saat upload dan menjawab pertanyaan*

| Field | Nilai |
|---|---|
| Provider | Google Gemini |
| API Key | API key dari Google AI Studio (langkah 5.1) |
| Model Embedding | `models/gemini-embedding-001` |
| Model Chat | `gemini-2.0-flash` |

---

**Bagian 3: WAHA (WhatsApp)**

*Digunakan untuk: mengirim pesan balasan ke pengguna WhatsApp*

| Field | Nilai |
|---|---|
| WAHA URL | `http://localhost:3001` |
| API Key | Kata kunci rahasia yang Anda set saat menjalankan Docker WAHA (mis. `mysecretkey`) |

---

**Bagian 4: n8n**

*Digunakan untuk: memantau dan mengatur workflow dari dashboard*

| Field | Nilai |
|---|---|
| n8n URL | `http://localhost:5678` |
| API Key | API key yang dibuat di langkah 7.4 |

---

Klik **Simpan** setelah mengisi setiap bagian.

> 💡 TIP: Kredensial disimpan di file `.credentials_all.json` di dalam folder `program1_pdf_processor`. File ini berisi informasi sensitif — **jangan upload ke GitHub atau bagikan kepada orang lain**.

---

## 11. Import Workflow n8n

### Langkah 11.1 — Import Tiga File Workflow

Di folder project, terdapat 3 file JSON yang berisi workflow siap pakai:
- `main_workflow.json` — Workflow utama yang menerima pesan WhatsApp dan mengatur AI Agent
- `rag_subworkflow.json` — Sub-workflow untuk mencari dokumen relevan di Supabase
- `bps_api_subworkflow.json` — Sub-workflow untuk query data real-time ke BPS Web API

Cara import setiap file:
1. Buka **http://localhost:5678**
2. Klik tombol **+** (New Workflow) di sidebar kiri, atau dari menu utama
3. Setelah workflow baru terbuka, klik tombol **...** (tiga titik) di pojok kanan atas
4. Pilih **Import from file**
5. Pilih salah satu file JSON (mulai dari `main_workflow.json`)
6. Ulangi proses ini untuk `rag_subworkflow.json` dan `bps_api_subworkflow.json`

### Langkah 11.2 — Konfigurasi Kredensial di n8n

Setelah import, setiap workflow mungkin menampilkan pesan error kuning/merah pada beberapa node karena kredensial belum dikonfigurasi. Ini normal.

Untuk setiap workflow, buka satu per satu dan konfigurasi node yang menampilkan tanda peringatan:

- **Node Gemini / Google AI**: masukkan API key Gemini
- **Node Supabase**: masukkan URL dan kunci Supabase
- **Node HTTP Request (BPS API)**: masukkan API key BPS Web API

### Langkah 11.3 — Hubungkan Sub-workflow ke Workflow Utama

1. Buka `main_workflow` di n8n
2. Cari node yang memanggil sub-workflow RAG (biasanya diberi nama "RAG Knowledge Base" atau serupa)
3. Klik node tersebut → di pengaturan, pilih workflow `rag_subworkflow` dari dropdown
4. Lakukan hal yang sama untuk node yang memanggil `bps_api_subworkflow`
5. Klik **Save** (tombol floppy disk atau Ctrl+S)

### Langkah 11.4 — Aktifkan Semua Workflow

Untuk setiap workflow (main, rag, bps_api):
1. Buka workflow di n8n
2. Klik toggle **Active** di pojok kanan atas — berubah menjadi hijau berarti aktif
3. Simpan

> ⚠️ WARNING: Workflow yang tidak diaktifkan tidak akan merespons pesan masuk. Pastikan **ketiga workflow** berstatus Active (hijau).

### Langkah 11.5 — Catat URL Webhook dan Update WAHA

1. Buka `main_workflow` di n8n
2. Klik node **Webhook** (biasanya ada di awal alur)
3. Salin **Webhook URL** yang tertera (contoh: `http://localhost:5678/webhook/abc123xyz`)
4. Kembali ke WAHA dashboard → update webhook URL sesi `default` dengan URL ini

---

## 12. Upload PDF Pertama

### PDF yang Baik untuk Di-upload

| Jenis Publikasi | Cocok untuk Upload? | Catatan |
|---|---|---|
| Pekanbaru Dalam Angka | ✅ Sangat cocok | Berisi statistik komprehensif |
| Statistik Daerah Pekanbaru | ✅ Sangat cocok | Analisis statistik lokal |
| Laporan Hasil Sensus | ✅ Cocok | Data kependudukan |
| Buku Statistik Tematik | ✅ Cocok | Pertanian, Industri, dll |
| PDF hasil scan (foto) | ❌ Tidak cocok | Teks tidak bisa diekstrak otomatis |
| PDF lebih dari 100 MB | ⚠️ Hati-hati | Proses lama, bisa timeout |

> 📋 NOTE: PDF yang dimaksud adalah **PDF digital** — dibuat langsung dari Word/Excel atau diterbitkan dalam format digital. PDF hasil foto/scan tidak mengandung teks yang bisa dibaca oleh komputer.

### Langkah Upload

1. Buka **http://localhost:5000** → pilih menu **PDF Processor** atau **Upload**
2. Klik area upload atau drag & drop file PDF ke area tersebut
3. Pilih mode:
   - **Append** — tambahkan ke knowledge base yang sudah ada (biasanya digunakan)
   - **Replace** — hapus semua data yang ada dan ganti dengan file ini (gunakan dengan hati-hati)
4. Klik tombol **Proses** atau **Upload**
5. Pantau progress bar yang menampilkan tiga tahap:
   - **Ekstrak** (0–40%) — membaca teks dari PDF halaman per halaman
   - **Chunk** (40–70%) — memecah teks menjadi potongan-potongan yang optimal
   - **Embed** (70–100%) — mengubah setiap potongan menjadi vektor dan menyimpan ke Supabase
6. Tunggu hingga muncul status **Selesai** atau **Success**

### Apa yang Terjadi Selama Pemrosesan?

```
File PDF masuk
      │
      ▼
[Ekstrak] Baca setiap halaman → ambil teks
      │ (menggunakan pdfplumber + PyMuPDF)
      ▼
[Chunk] Pecah teks menjadi potongan ~800-1500 karakter
      │ dengan overlap 100-200 karakter antar chunk
      ▼
[Embed] Setiap chunk diubah menjadi 768 angka (vektor)
      │ menggunakan Gemini Embedding 001
      ▼
[Simpan] Vektor + teks + metadata disimpan ke Supabase
      │
      ▼
Selesai! Chatbot bisa menjawab berdasarkan PDF ini
```

### Verifikasi Upload Berhasil

Setelah upload selesai, cek di Supabase:
1. Buka dashboard Supabase → **Table Editor** → pilih tabel `documents`
2. Seharusnya ada baris-baris baru yang berisi potongan teks dari PDF yang Anda upload
3. Tabel `ingested_files` juga harus menampilkan entri baru dengan nama file PDF

---

## 13. Verifikasi Sistem Berjalan

### Cek Semua Layanan

| URL | Yang Harus Terlihat |
|---|---|
| http://localhost:5000 | Dashboard BPS Admin — halaman utama |
| http://localhost:8503/docs | FastAPI docs — daftar endpoint API |
| http://localhost:5678 | n8n editor — daftar workflow |
| http://localhost:3001 | WAHA dashboard — status sesi WhatsApp |

### Test Kirim Pesan

1. Pastikan semua layanan berjalan
2. Dari HP lain (bukan HP yang terdaftar sebagai bot), kirim pesan WhatsApp ke nomor bot
3. Contoh pesan: *"Berapa jumlah penduduk Kota Pekanbaru?"*
4. Tunggu 5–15 detik
5. Bot seharusnya membalas dengan informasi dari PDF yang sudah di-upload

### Respons yang Diharapkan

```
Pengguna: "Berapa jumlah penduduk Kota Pekanbaru tahun 2023?"

Bot: "Berdasarkan data BPS Kota Pekanbaru, jumlah penduduk 
Kota Pekanbaru pada tahun 2023 adalah sebesar 1.117.359 jiwa,
terdiri dari ... [informasi dari dokumen PDF]"
```

> 💡 TIP: Jika bot tidak menjawab dalam 30 detik, cek n8n di `http://localhost:5678` → **Executions** untuk melihat apakah ada error di workflow. Juga cek TROUBLESHOOTING.md untuk panduan lebih lanjut.

---

## 14. Setup Metabase (Opsional)

Metabase adalah dashboard analytics untuk memantau data yang ada di Supabase, seperti melihat berapa banyak dokumen yang tersimpan, topik apa yang paling banyak ada, dsb.

### Langkah 14.1 — Jalankan Metabase

Buka Command Prompt, navigasi ke folder metabase, lalu jalankan:

```
cd C:\[path-ke-project]\metabase
docker compose up -d
```

Tunggu 2–3 menit (pertama kali akan download image). Lalu buka **http://localhost:3002**.

### Langkah 14.2 — Setup Awal Metabase

1. Klik **Let's get started**
2. Isi bahasa, nama, email, dan password untuk akun Metabase
3. Pilih **Add your data** → pilih **PostgreSQL**
4. Isi koneksi database Supabase:

| Field | Nilai |
|---|---|
| Display name | `Supabase BPS` |
| Host | `aws-0-ap-southeast-1.pooler.supabase.com` (cek di Supabase → Settings → Database → Connection pooling) |
| Port | `6543` |
| Database name | `postgres` |
| Username | `postgres.[project-id]` (cek di Supabase → Settings → Database) |
| Password | Password database yang dibuat saat membuat project Supabase |

5. Klik **Test connection** — harus muncul ✅ Berhasil
6. Klik **Next** dan selesaikan wizard

### Contoh Query Berguna di Metabase

Setelah terhubung, buat **Question** baru dengan query SQL berikut untuk dashboard monitoring:

```sql
-- Total dokumen tersimpan
SELECT COUNT(*) as total_chunks FROM documents;

-- File yang sudah diingest
SELECT file_name, chunk_count, ingested_at FROM ingested_files ORDER BY ingested_at DESC;

-- Distribusi topik dokumen
SELECT metadata->>'topic' as topik, COUNT(*) as jumlah 
FROM documents 
WHERE metadata->>'topic' IS NOT NULL
GROUP BY topik ORDER BY jumlah DESC;
```
