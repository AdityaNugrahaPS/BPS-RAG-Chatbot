# Panduan Setup — BPS RAG Chatbot

Panduan ini untuk setup sistem dari nol di komputer/server baru.  
Estimasi waktu: **60–90 menit** (tergantung koneksi internet).

---

## Daftar Isi

1. [Prasyarat](#1-prasyarat)
2. [Clone / Salin Project](#2-clone--salin-project)
3. [Setup Supabase](#3-setup-supabase)
4. [Setup n8n](#4-setup-n8n)
5. [Setup WAHA (WhatsApp)](#5-setup-waha-whatsapp)
6. [Setup Frontend & Backend](#6-setup-frontend--backend)
7. [Konfigurasi Credentials di Dashboard](#7-konfigurasi-credentials-di-dashboard)
8. [Import Workflow n8n](#8-import-workflow-n8n)
9. [Upload PDF ke Knowledge Base](#9-upload-pdf-ke-knowledge-base)
10. [Setup Metabase (Opsional)](#10-setup-metabase-opsional)
11. [Menjalankan Sistem](#11-menjalankan-sistem)
12. [Troubleshooting](#12-troubleshooting)

---

## 1. Prasyarat

Install semua software berikut sebelum mulai:

### Wajib

| Software | Versi minimum | Download |
|----------|--------------|---------|
| **Node.js** | 18 LTS | https://nodejs.org |
| **Python** | 3.11+ | https://python.org |
| **n8n** | terbaru | `npm install -g n8n` |
| **Git** | terbaru | https://git-scm.com |

### Untuk WAHA (WhatsApp)
| Software | Download |
|----------|---------|
| **Docker Desktop** | https://www.docker.com/products/docker-desktop |

### Untuk Metabase (opsional, analitik)
Docker Desktop sudah cukup (sama seperti di atas).

### Akun / API Key yang diperlukan

| Layanan | Cara Daftar | Biaya |
|---------|------------|-------|
| **Supabase** | https://supabase.com — daftar gratis | Free tier cukup |
| **Google Gemini API** | https://aistudio.google.com/apikey | Free tier tersedia |
| **BPS Web API** | Hubungi BPS Pusat / webapi.bps.go.id | Gratis (perlu daftar) |

---

## 2. Clone / Salin Project

### Opsi A — dari GitHub
```bash
git clone https://github.com/AdityaNugrahaPS/BPS-RAG-Chatbot.git
cd BPS-RAG-Chatbot
```

### Opsi B — dari flashdisk / folder
Salin seluruh folder `BPS-n8n-RAG_ChatBot` ke lokasi yang diinginkan, misalnya `C:\BPS-Chatbot`.

---

## 3. Setup Supabase

### 3.1 Buat Project Supabase
1. Login ke https://supabase.com
2. Klik **New Project** → isi nama project (mis. `bps-rag-chatbot`) → pilih region **Southeast Asia (Singapore)**
3. Catat **Project URL** dan **Service Role Key** (di Settings → API)

### 3.2 Aktifkan pgvector
Di Supabase Dashboard → **Database** → **Extensions** → cari `vector` → aktifkan.

### 3.3 Buat Tabel

Buka **SQL Editor** di Supabase dan jalankan SQL berikut satu per satu:

**Tabel `documents` (vector knowledge base):**
```sql
CREATE TABLE IF NOT EXISTS documents (
  id        bigserial PRIMARY KEY,
  content   text,
  metadata  jsonb,
  embedding vector(768)
);
```

**Tabel `ingested_files` (tracking file yang sudah diproses):**
```sql
CREATE TABLE IF NOT EXISTS ingested_files (
  id          bigserial PRIMARY KEY,
  file_name   text,
  file_id     text,
  chunk_count integer,
  ingested_at timestamptz DEFAULT now()
);
```

**Fungsi `match_documents` (vector similarity search):**
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

### 3.4 Catat Credentials
Dari Settings → API:
- `Project URL` → contoh: `https://xxxxxxxx.supabase.co`
- `service_role` key (bukan `anon` key) → dimulai dengan `sb_secret_...`

---

## 4. Setup n8n

### 4.1 Install & Jalankan n8n
```bash
# Install global (sekali saja)
npm install -g n8n

# Jalankan n8n
n8n start
```

n8n akan berjalan di **http://localhost:5678**.  
Buat akun admin saat pertama kali buka.

### 4.2 Buat API Key n8n
1. Buka http://localhost:5678
2. Klik avatar (pojok kanan atas) → **Settings** → **API**
3. Klik **Create API Key** → beri nama `chatbot-admin` → **Copy** dan simpan key-nya

> API Key ini dimasukkan di Dashboard → Credentials → n8n.

### 4.3 Jalankan n8n Otomatis saat Windows Start (Opsional)
Buat file `n8n-autostart.bat`:
```bat
@echo off
n8n start
```
Lalu taruh shortcut-nya di `shell:startup` (tekan Win+R, ketik `shell:startup`).

---

## 5. Setup WAHA (WhatsApp)

WAHA adalah gateway WhatsApp yang dijalankan via Docker.

### 5.1 Jalankan WAHA
Buka terminal, jalankan:
```bash
docker run -d \
  --name waha \
  --restart always \
  -p 3001:3000 \
  -e WHATSAPP_API_KEY=mysecretkey \
  devlikeapro/waha
```

> Ganti `mysecretkey` dengan key rahasia pilihan Anda. Catat key ini.

WAHA berjalan di **http://localhost:3001**.

### 5.2 Scan QR Code WhatsApp
1. Buka http://localhost:3001/dashboard
2. Klik **Start Session** → nama session: `default`
3. Scan QR Code dengan aplikasi WhatsApp di HP (Settings → Linked Devices)
4. Status berubah menjadi **WORKING** → WhatsApp sudah terhubung

### 5.3 Set Webhook ke n8n
Di WAHA Dashboard → Session `default` → **Webhooks**:
- URL: `http://localhost:5678/webhook/whatsapp`
- Events: centang `message`

> URL webhook ini akan sesuai dengan yang ada di workflow n8n Anda.

---

## 6. Setup Frontend & Backend

### 6.1 Install dependensi Frontend
```bash
cd frontend
npm install
```

### 6.2 Install dependensi Backend (Python)
```bash
cd program1_pdf_processor
pip install -r requirements.txt
```

> Jika ada error saat install `PyMuPDF`, coba: `pip install --upgrade pip` lalu install ulang.

---

## 7. Konfigurasi Credentials di Dashboard

### 7.1 Jalankan sistem (untuk konfigurasi awal)
```bash
# Terminal 1
cd program1_pdf_processor
python api.py

# Terminal 2
cd frontend
npm run dev
```

Buka **http://localhost:5000** → pilih menu **Credentials**.

### 7.2 Isi setiap credential

**Supabase:**
- URL: `https://xxxxxxxx.supabase.co`
- Service Key: `sb_secret_...`

**AI Models:**
- Klik **Tambah Model**
- Provider: `Google Gemini`
- API Key: key dari Google AI Studio
- Model Embedding: `models/gemini-embedding-001`
- Model Chat: `models/gemini-2.0-flash`

**WAHA (WhatsApp):**
- URL: `http://localhost:3001`
- API Key: key yang Anda set saat menjalankan Docker (mis. `mysecretkey`)

**n8n:**
- URL: `http://localhost:5678`
- API Key: key yang dibuat di langkah 4.2

Klik **Simpan** di setiap halaman credential.

---

## 8. Import Workflow n8n

File workflow sudah tersedia di folder project:
- `main_workflow.json` — workflow utama (WAHA + AI Agent)
- `rag_subworkflow.json` — sub-workflow RAG Knowledge Base
- `bps_api_subworkflow.json` — sub-workflow BPS API Tool

### Cara Import
1. Buka http://localhost:5678
2. Klik **+** (New Workflow) → **...** (titik tiga) → **Import from file**
3. Import ketiga file di atas (ulangi 3x)
4. Buka setiap workflow → klik **Save** → klik **Activate** (toggle di kanan atas)

### Hubungkan Sub-workflow ke Workflow Utama
1. Buka `main_workflow.json`
2. Klik node **RAG Knowledge Base Tool** → pada field **Workflow** pilih `rag_subworkflow`
3. Klik node **BPS API Tool** → pada field **Workflow** pilih `bps_api_subworkflow`
4. **Save** workflow

---

## 9. Upload PDF ke Knowledge Base

1. Buka Dashboard → **PDF Processor**
2. Drag & drop file PDF publikasi BPS (buku statistik, laporan, dll)
3. Klik **Proses** → tunggu hingga status berubah ke **Selesai**

PDF akan otomatis:
- Diekstrak teksnya
- Dipecah menjadi chunks
- Di-embed menggunakan Gemini
- Disimpan ke Supabase

> Semakin banyak PDF yang di-upload, semakin akurat jawaban chatbot.

---

## 10. Setup Metabase (Opsional)

Metabase digunakan untuk analitik dan monitoring data Supabase.

```bash
cd metabase
docker compose up -d
```

Buka **http://localhost:3002** → daftar akun → hubungkan ke database Supabase:
- Type: `PostgreSQL`
- Host: `aws-1-ap-northeast-2.pooler.supabase.com`
- Port: `6543`
- Database: `postgres`
- Username: `postgres.xxxxxxxx` (dari Supabase → Settings → Database)
- Password: password database Supabase Anda

---

## 11. Menjalankan Sistem

### Cara Cepat (Windows)
Double-click **`start.bat`** — akan membuka Frontend dan PDF Processor API sekaligus.

### Manual

| Yang perlu dijalankan | Perintah | Keterangan |
|----------------------|---------|-----------|
| n8n | `n8n start` | Harus aktif selalu |
| WAHA | `docker start waha` | Harus aktif selalu |
| PDF Processor API | `cd program1_pdf_processor && python api.py` | Untuk dashboard |
| Frontend Dashboard | `cd frontend && npm run dev` | Untuk dashboard |
| Metabase (opsional) | `cd metabase && docker compose up -d` | Untuk analitik |

### Urutan Start yang Benar
1. n8n
2. WAHA
3. PDF Processor API
4. Frontend Dashboard

### Cek apakah sistem berjalan
| URL | Harusnya tampil |
|-----|----------------|
| http://localhost:5000 | Dashboard BPS Admin |
| http://localhost:5678 | n8n Editor |
| http://localhost:3001 | WAHA Dashboard |
| http://localhost:3002 | Metabase |

---

## 12. Troubleshooting

### WhatsApp tidak terhubung / QR Code expired
```bash
# Restart WAHA container
docker restart waha
```
Lalu scan QR ulang di http://localhost:3001/dashboard.

### Chatbot tidak membalas pesan
1. Cek n8n aktif: buka http://localhost:5678 → pastikan workflow `main_workflow` status **Active**
2. Cek WAHA terhubung: status session harus **WORKING**
3. Cek webhook: WAHA → Session `default` → Webhooks → URL harus `http://localhost:5678/webhook/...`

### PDF gagal diproses / upload error
1. Pastikan PDF Processor API berjalan (`python api.py`)
2. Cek credentials Supabase dan Gemini sudah diisi di Dashboard
3. Cek koneksi internet (Gemini & Supabase membutuhkan internet)

### Jawaban chatbot tidak akurat / tidak tahu
- Upload lebih banyak PDF yang relevan
- Pastikan PDF berisi teks (bukan scan gambar)

### Port sudah dipakai
Jika port 5000 atau 8503 sudah dipakai aplikasi lain:
- Edit `frontend/vite.config.ts` → ubah `port: 5000` ke port lain
- Edit `program1_pdf_processor/api.py` → cari `port=8503` → ubah

### n8n API Key expired
1. Buka http://localhost:5678 → Settings → API
2. Buat key baru → perbarui di Dashboard → Credentials → n8n

---

## Kontak & Support

Project ini dikembangkan untuk **BPS Kota Pekanbaru**.  
Untuk pertanyaan teknis, hubungi pengembang sistem.

Repository: https://github.com/AdityaNugrahaPS/BPS-RAG-Chatbot
