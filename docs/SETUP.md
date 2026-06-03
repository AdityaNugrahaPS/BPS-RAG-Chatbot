# SETUP — Instalasi BPS RAG Chatbot dari Nol

Panduan ini untuk **developer/teknisi** yang akan setup sistem di komputer baru.
Estimasi waktu: **90–120 menit** (tergantung koneksi internet).

> Untuk operasional sehari-hari setelah setup selesai, lihat [USER_GUIDE.md](USER_GUIDE.md).

---

## Daftar Isi

1. [Prasyarat](#1-prasyarat)
2. [Clone Repository](#2-clone-repository)
3. [Setup Supabase (Vector Database)](#3-setup-supabase-vector-database)
4. [Setup Google Gemini API](#4-setup-google-gemini-api)
5. [Setup BPS Web API](#5-setup-bps-web-api)
6. [Install Dependencies (Backend + Frontend)](#6-install-dependencies)
7. [Setup n8n](#7-setup-n8n)
8. [Setup WAHA (WhatsApp Gateway)](#8-setup-waha-whatsapp-gateway)
9. [Import Workflow n8n](#9-import-workflow-n8n)
10. [Konfigurasi Credentials di Dashboard](#10-konfigurasi-credentials-di-dashboard)
11. [Upload PDF Pertama](#11-upload-pdf-pertama)
12. [Verifikasi End-to-End](#12-verifikasi-end-to-end)
13. [Setup Metabase (Opsional)](#13-setup-metabase-opsional)

---

## 1. Prasyarat

Software yang harus terinstall sebelum mulai:

| Software | Versi Minimum | Cek Versi | Link |
|---|---|---|---|
| Node.js | 18 LTS (rekomendasi 20 LTS) | `node --version` | https://nodejs.org |
| Python | 3.11+ | `python --version` | https://python.org |
| Git | terbaru | `git --version` | https://git-scm.com |
| Docker Desktop | terbaru | `docker --version` | https://docker.com/products/docker-desktop |
| n8n (npm global) | terbaru | `n8n --version` | `npm install -g n8n` |

Install n8n (kalau belum):

```powershell
npm install -g n8n
```

> Kalau muncul error permission, buka PowerShell sebagai Administrator.

---

## 2. Clone Repository

```powershell
git clone https://github.com/AdityaNugrahaPS/BPS-RAG-Chatbot.git
cd BPS-RAG-Chatbot
```

---

## 3. Setup Supabase (Vector Database)

Supabase = database cloud + pgvector untuk menyimpan embedding dokumen BPS.

### 3.1 Buat Project Supabase

1. Daftar di **https://supabase.com**
2. Klik **New Project**
   - **Name**: `bps-rag-chatbot`
   - **Database Password**: buat password kuat → **catat baik-baik**, tidak bisa dilihat lagi
   - **Region**: `Southeast Asia (Singapore)`
3. Tunggu 1–2 menit hingga project siap

### 3.2 Aktifkan Ekstensi pgvector

1. Di dashboard Supabase project, masuk **Database → Extensions**
2. Cari `vector` → klik toggle untuk enable

### 3.3 Jalankan SQL Schema

Buka **SQL Editor** di Supabase dashboard, run satu per satu:

**SQL 1 — Tabel `documents`** (penyimpan chunk + embedding):

```sql
CREATE TABLE IF NOT EXISTS documents (
  id        bigserial PRIMARY KEY,
  content   text,
  metadata  jsonb,
  embedding vector(768)
);
```

**SQL 2 — Tabel `ingested_files`** (tracking file yang sudah di-ingest):

```sql
CREATE TABLE IF NOT EXISTS ingested_files (
  id          bigserial PRIMARY KEY,
  file_name   text,
  file_id     text,
  chunk_count integer,
  ingested_at timestamptz DEFAULT now()
);
```

**SQL 3 — RPC `match_documents`** (cosine similarity search):

```sql
CREATE OR REPLACE FUNCTION match_documents (
  query_embedding vector(768),
  match_threshold float DEFAULT 0.5,
  match_count     int   DEFAULT 5,
  filter          jsonb DEFAULT '{}'::jsonb
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
  WHERE documents.metadata @> filter
    AND 1 - (documents.embedding <=> query_embedding) > match_threshold
  ORDER BY documents.embedding <=> query_embedding
  LIMIT match_count;
$$;
```

**SQL 4 — Tabel `n8n_chat_histories`** (riwayat percakapan WhatsApp):

```sql
CREATE TABLE IF NOT EXISTS n8n_chat_histories (
  id      bigserial PRIMARY KEY,
  session_id text,
  message    jsonb
);
```

### 3.4 Ambil Credentials Supabase

Masuk **Settings → API**:

| Field | Letak | Gunanya |
|---|---|---|
| Project URL | `Project URL` | URL koneksi |
| `service_role` key | `Project API keys → service_role → Reveal` | Backend & n8n (full access) |
| `anon` key | `Project API keys → anon` | Frontend (read-only with RLS) |

**Penting:** gunakan `service_role` di backend & n8n; `anon` hanya di frontend.

---

## 4. Setup Google Gemini API

1. Buka **https://aistudio.google.com/apikey**
2. Login dengan akun Google
3. Klik **Create API key**
4. Simpan API key

> 1 API key bisa dipakai untuk embedding (`gemini-embedding-001`) dan chat (`gemini-2.0-flash`).

**Free tier limit:** 15 req/menit untuk chat, 1500 req/menit untuk embedding. Cukup untuk pemakaian internal BPS.

---

## 5. Setup BPS Web API

1. Daftar di **https://webapi.bps.go.id**
2. Setelah verifikasi email, ambil API key dari menu profile
3. Kode domain Pekanbaru: `1471`

**Test API key di browser** (ganti `YOUR_KEY`):
```
https://webapi.bps.go.id/v1/api/list/model/subject/domain/1471/key/YOUR_KEY/
```

> **Catatan:** request ke BPS Web API butuh header `User-Agent` (selain key di URL). Tanpa UA, akan diblokir WAF.

---

## 6. Install Dependencies

### 6.1 Backend (Python)

```powershell
cd program1_pdf_processor
pip install -r requirements.txt
cd ..
```

Library yang diinstall:
- `fastapi`, `uvicorn` — backend API
- `pdfplumber`, `PyMuPDF` — ekstraksi teks PDF
- `google-generativeai` — Gemini SDK
- `supabase` — Supabase SDK
- `pandas`, `httpx`

**Kalau PyMuPDF gagal install:**
```powershell
pip install --upgrade pip
pip install PyMuPDF
```

### 6.2 Frontend (React + Vite)

```powershell
cd frontend
npm install
cd ..
```

### 6.3 Copy .env.example

```powershell
copy .env.example .env
```

Lalu edit `.env` dengan nilai Supabase kamu (untuk frontend).

---

## 7. Setup n8n

### 7.1 Jalankan Pertama Kali

```powershell
n8n start
```

Tunggu sampai muncul `n8n ready on port 5678`. Buka **http://localhost:5678**.

### 7.2 Buat Akun Admin n8n

Ikuti wizard signup di browser (email + password). Catat password.

### 7.3 Buat API Key n8n

1. Klik avatar → **Settings → API**
2. Klik **Create an API key** → beri nama `bps-dashboard`
3. **Copy key sekarang** — tidak bisa dilihat lagi setelah ditutup

API key ini akan dipakai oleh dashboard admin untuk komunikasi ke n8n.

### 7.4 Setup n8n Credentials

Sebelum import workflow, buat credentials di n8n (Settings → Credentials → New):

| Credential | Tipe | Isi |
|---|---|---|
| **Gemini API** | (Custom HTTP header) | Tidak perlu — Gemini di-call via HTTP Request node dengan key di URL |
| **WAHA account** | `WAHA API` (dari node `@devlikeapro/n8n-nodes-waha`) | URL: `http://localhost:3001`, API Key: kunci WAHA |
| **Postgres** | `Postgres` | Host: pooler Supabase, Port: 6543, User: `postgres.[project-ref]`, DB: `postgres`, Password: DB password Supabase |
| **Groq** (opsional) | `Groq API` | Kalau pakai Groq sebagai LLM alternatif |

> Detail lengkap di [N8N_GUIDE.md](N8N_GUIDE.md).

---

## 8. Setup WAHA (WhatsApp Gateway)

### 8.1 Jalankan WAHA Container

Pastikan Docker Desktop sudah running, lalu:

```powershell
docker run -d --name waha --restart always -p 3001:3000 -e WHATSAPP_API_KEY=mysecretkey devlikeapro/waha
```

**Penjelasan flag:**

| Flag | Arti |
|---|---|
| `-d` | Detached (background) |
| `--name waha` | Nama container |
| `--restart always` | Auto-restart kalau crash/komputer restart |
| `-p 3001:3000` | Port 3001 host ↔ 3000 container |
| `-e WHATSAPP_API_KEY=mysecretkey` | API key — **ganti `mysecretkey` dengan kata rahasia kamu** |

### 8.2 Scan QR WhatsApp

1. Buka **http://localhost:3001**
2. **Sessions → default → Start**
3. Tab **QR Code** → scan dari WhatsApp di HP:
   - WhatsApp → **Settings → Linked Devices → Link a device**
4. Tunggu status berubah ke **WORKING**

> **Penting:** Nomor HP yang di-scan akan jadi nomor bot. Selama terhubung ke WAHA, WhatsApp di HP itu tidak bisa dipakai normal. Pakai nomor khusus (SIM card terpisah / WhatsApp Business).

### 8.3 Set Webhook (Akan Dilakukan Setelah Import Workflow)

Webhook URL ke n8n di-set di **langkah 9.5** setelah import workflow.

---

## 9. Import Workflow n8n

Ada 3 workflow yang harus di-import dari folder `n8n_workflows/`:

| File | Workflow | Peran |
|---|---|---|
| `01_main_workflow.json` | BPS WhatsApp RAG Chatbot | Main: terima WhatsApp, panggil AI Agent, balas |
| `02_knowledge_base_subworkflow.json` | BPS Knowledge Base Tool | Sub: embed query → pgvector search → format hasil |
| `03_bps_api_subworkflow.json` | BPS API Tool | Sub: query BPS Web API real-time |

### 9.1 Replace Placeholder Credentials

**SEBELUM** import, buka tiap file JSON dan ganti placeholder ini dengan nilai milikmu:

| Placeholder | Ganti dengan |
|---|---|
| `__GEMINI_API_KEY__` | API key Gemini kamu (langkah 4) |
| `__SUPABASE_PROJECT__.supabase.co` | URL Supabase tanpa `https://` (cuma `xxx.supabase.co`) |
| `__SUPABASE_SERVICE_KEY__` | `service_role` key Supabase |
| `__SUPABASE_ANON_KEY__` | `anon` key Supabase |
| `__BPS_API_KEY__` | API key BPS Web (langkah 5) |

Find-and-replace di editor (VS Code / Notepad++) cepat — pilih semua file di folder `n8n_workflows/`, Ctrl+H, replace per placeholder.

### 9.2 Import via n8n UI

1. Di **http://localhost:5678**, klik **+ Add Workflow**
2. Klik menu **⋮** (titik tiga) di kanan atas → **Import from file**
3. Pilih file JSON yang sudah di-edit
4. Ulangi untuk ketiga file

### 9.3 Bind Workflow IDs Antar Subworkflow

Workflow utama memanggil subworkflow lewat **workflow ID** internal. Setelah import, ID-nya berbeda dari yang asli. Cara fix:

1. Buka workflow **BPS WhatsApp RAG Chatbot** (main)
2. Klik node **RAG Knowledge Base** (tipe `toolWorkflow`)
3. Di field **Workflow** → ganti dari `H6CBpeCionMIdqsv` (ID lama) ke ID workflow `BPS Knowledge Base Tool` yang baru di-import
4. Sama untuk node **BPS API Tool** kalau ada — point ke workflow `BPS API Tool`

### 9.4 Bind n8n Credentials ke Node

Setiap node yang butuh credentials akan tampil ⚠️ kuning. Klik node, pilih credentials yang sudah dibuat di langkah 7.4.

Node yang butuh credentials:
- **Postgres Chat Memory** → Postgres credential
- **Send Reply, Stop Typing, Start Typing, Send Seen** → WAHA credential
- **WAHA Trigger** → WAHA credential
- **Groq Chat Model** → Groq (kalau dipakai)

### 9.5 Aktifkan & Salin Webhook URL

1. Toggle **Active** di pojok kanan atas untuk **ketiga workflow** → semua harus hijau
2. Di workflow utama, klik node **WAHA Trigger** → copy **Webhook URL** (mirip `http://localhost:5678/webhook/c018fd02-cfe4-...`)
3. Kembali ke WAHA: **http://localhost:3001 → Sessions → default → Webhooks**
4. Tambah webhook dengan URL itu, event: `message`

---

## 10. Konfigurasi Credentials di Dashboard

Jalankan dashboard:

```powershell
.\start.bat
```

Browser otomatis buka **http://localhost:5000**. Masuk ke menu **Credentials** dan isi:

| Bagian | Field | Nilai |
|---|---|---|
| Supabase | URL | `https://xxx.supabase.co` |
| | Service Role Key | `eyJ...` (panjang) |
| AI Models | Provider | Google Gemini |
| | API Key | (dari langkah 4) |
| | Embedding Model | `models/gemini-embedding-001` |
| | Chat Model | `gemini-2.0-flash` |
| WAHA | URL | `http://localhost:3001` |
| | API Key | (yang di-set di Docker run, mis. `mysecretkey`) |
| n8n | URL | `http://localhost:5678` |
| | API Key | (dari langkah 7.3) |

Credentials disimpan di `program1_pdf_processor/.credentials_all.json` (gitignored).

---

## 11. Upload PDF Pertama

1. Dashboard → menu **PDF Processor**
2. Drag & drop PDF BPS (rekomendasi: *Pekanbaru Dalam Angka 2024*)
3. Pilih mode: **Append** (tambah) atau **Replace** (reset)
4. Klik **Proses**
5. Tunggu 3 tahap progress: **Extract → Chunk → Embed**

Cek di Supabase Table Editor → tabel `documents` harus terisi.

---

## 12. Verifikasi End-to-End

| Cek | URL / Cara | Expected |
|---|---|---|
| Dashboard | http://localhost:5000 | Halaman dashboard tampil |
| Backend | http://localhost:8503/docs | FastAPI Swagger UI |
| n8n | http://localhost:5678 | Workflow editor — 3 workflow Active (hijau) |
| WAHA | http://localhost:3001 | Session `default` status **WORKING** |
| Tabel Supabase | Supabase Table Editor → `documents` | Ada row hasil ingest PDF |

**Test kirim pesan:** dari HP lain (bukan HP bot), kirim WhatsApp ke nomor bot:
> *"Berapa jumlah penduduk Kota Pekanbaru?"*

Bot harus balas dalam 5–15 detik dengan jawaban dari PDF yang di-upload.

Kalau tidak balas → cek **n8n → Executions** untuk lihat error per node, atau buka [TROUBLESHOOTING.md](TROUBLESHOOTING.md).

---

## 13. Setup Metabase (Opsional)

Metabase = dashboard analytics untuk visualisasi data Supabase.

```powershell
cd metabase
docker compose up -d
```

Buka **http://localhost:3002** → setup wizard → connect ke Supabase (PostgreSQL):

| Field | Nilai |
|---|---|
| Host | `aws-0-ap-southeast-1.pooler.supabase.com` (cek di Supabase → Settings → Database → Connection pooling) |
| Port | `6543` |
| Database | `postgres` |
| Username | `postgres.[project-ref]` |
| Password | DB password (dari langkah 3.1) |

---

## Selesai

Sistem siap. Untuk operasional harian (jalankan/matikan/upload PDF rutin), lihat [USER_GUIDE.md](USER_GUIDE.md). Untuk masalah n8n spesifik, [N8N_GUIDE.md](N8N_GUIDE.md). Untuk error, [TROUBLESHOOTING.md](TROUBLESHOOTING.md).
