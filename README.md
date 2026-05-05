# 🤖 BPS RAG Chatbot — Asisten Statistik Kota Pekanbaru Berbasis WhatsApp

**Sistem chatbot cerdas yang menjawab pertanyaan seputar data statistik BPS Pekanbaru secara otomatis melalui WhatsApp, menggunakan teknologi AI dan basis pengetahuan dari publikasi resmi BPS.**

---

## Apa yang Bisa Dilakukan Sistem Ini?

- 💬 **Menjawab pertanyaan statistik via WhatsApp** — Pengguna cukup kirim pesan ke nomor WhatsApp bot, dan sistem akan menjawab berdasarkan data BPS yang sudah di-upload
- 📄 **Membaca & memahami publikasi BPS** — PDF seperti Pekanbaru Dalam Angka, Statistik Daerah, dan publikasi lainnya di-upload ke sistem dan dijadikan sumber jawaban
- 📊 **Mengambil data real-time dari BPS Web API** — Untuk data terkini, sistem langsung query ke API resmi BPS (webapi.bps.go.id) dengan kode domain Pekanbaru `1471`
- 🖥️ **Dashboard admin untuk pengelolaan** — Staf BPS dapat upload PDF baru, memantau status, dan mengelola basis pengetahuan melalui antarmuka web yang mudah digunakan

---

## Arsitektur Sistem

```
┌─────────────────────────────────────────────────────────────────┐
│                      PENGGUNA (WhatsApp)                        │
└──────────────────────────┬──────────────────────────────────────┘
                           │ Kirim pesan
                           ▼
┌──────────────────────────────────────────┐
│        WAHA (WhatsApp Gateway)           │
│        Docker · Port 3001                │
│  Terima pesan → kirim ke n8n via webhook │
└──────────────────────────┬───────────────┘
                           │ Webhook POST
                           ▼
┌─────────────────────────────────────────────────────┐
│              n8n (Workflow Automation)               │
│              Port 5678                               │
│                                                     │
│  ┌───────────────────────────────────────────────┐  │
│  │              Main Workflow                    │  │
│  │  Terima pesan → AI Agent (Gemini) → Balas     │  │
│  └──────────────┬──────────────┬─────────────────┘  │
│                 │              │                     │
│        ┌────────┘              └──────────┐          │
│        ▼                                 ▼           │
│  ┌──────────────────┐   ┌───────────────────────┐   │
│  │  RAG Subworkflow │   │ BPS API Subworkflow    │   │
│  │  Cari dokumen di │   │ Query webapi.bps.go.id │   │
│  │  Supabase vector │   │ data real-time         │   │
│  └──────┬───────────┘   └───────────┬───────────┘   │
└─────────┼───────────────────────────┼───────────────┘
          │                           │
          ▼                           ▼
┌──────────────────┐      ┌───────────────────────┐
│    Supabase      │      │    BPS Web API         │
│  (Cloud DB +     │      │  webapi.bps.go.id/v1/  │
│   pgvector)      │      │  Domain Pekanbaru: 1471 │
│                  │      └───────────────────────┘
│  Tabel:          │
│  - documents     │                ▲
│  - ingested_files│                │ Gemini AI
└──────────────────┘                │ (chat + embedding)
          ▲                         │
          │ embed & store           │
          │                         │
┌──────────────────────────────────────────────────────┐
│                  ADMIN DASHBOARD                      │
│         React Frontend · Port 5000                   │
│         FastAPI Backend · Port 8503                  │
│                                                      │
│  Upload PDF → Ekstrak → Chunk → Embed → Supabase     │
└──────────────────────────────────────────────────────┘

┌──────────────────────────┐
│  Metabase (Opsional)     │
│  Docker · Port 3002      │
│  Dashboard Analytics     │
└──────────────────────────┘
```

---

## Layanan & Port

| Layanan | Teknologi | Port | Cara Menjalankan | Keterangan |
|---|---|---|---|---|
| Admin Dashboard | React + Vite | **5000** | `start.bat` | Antarmuka upload PDF & kredensial |
| PDF Processor API | FastAPI + Python | **8503** | `start.bat` | Backend pemrosesan PDF |
| n8n | Node.js | **5678** | `n8n start` (manual) | Workflow otomasi & AI Agent |
| WAHA | Docker | **3001** | Docker Desktop | WhatsApp Gateway |
| Metabase | Docker | **3002** | `docker compose up -d` | Analytics (opsional) |
| Supabase | Cloud | — | Sudah berjalan di cloud | Database vektor (PostgreSQL + pgvector) |

---

## Quick Start (Untuk Instalasi yang Sudah Ada)

Jika sistem sudah pernah di-setup sebelumnya, ikuti langkah berikut setiap pagi saat akan bekerja.

### Langkah 1 — Jalankan Dashboard Admin

Klik dua kali file **`start.bat`** di folder proyek.

Browser akan otomatis membuka `http://localhost:5000`.

> 📋 NOTE: `start.bat` menjalankan dua hal sekaligus: **PDF Processor API** (port 8503) dan **Frontend Dashboard** (port 5000).

### Langkah 2 — Jalankan n8n

Buka terminal baru (Command Prompt / PowerShell), lalu ketik:

```
n8n start
```

Tunggu hingga muncul tulisan `n8n ready on port 5678`, lalu buka `http://localhost:5678` untuk memastikan berjalan.

> ⚠️ WARNING: n8n **tidak** dijalankan oleh `start.bat`. Harus dijalankan manual setiap kali komputer restart.

### Langkah 3 — Pastikan Docker & WAHA Berjalan

Buka **Docker Desktop**. Pastikan container bernama `waha` berstatus **Running** (indikator hijau).

Jika belum running, klik tombol ▶ di sebelah container `waha`.

### Langkah 4 — Cek Status WhatsApp

Buka `http://localhost:3001` → pastikan sesi `default` berstatus **WORKING**.

Jika status **STOPPED** atau **SCAN_QR_CODE**, ikuti panduan di [PANDUAN_PENGGUNAAN.md](PANDUAN_PENGGUNAAN.md#whatsapp-session-management).

> ✅ Sistem siap digunakan jika semua layanan berjalan dan WhatsApp berstatus WORKING.

---

## Dokumentasi Lengkap

| Dokumen | Untuk Siapa | Isi |
|---|---|---|
| [SETUP.md](SETUP.md) | Teknisi / Developer | Panduan instalasi lengkap dari awal (fresh install), langkah demi langkah |
| [PANDUAN_PENGGUNAAN.md](PANDUAN_PENGGUNAAN.md) | Staf Admin BPS | Operasional harian: upload PDF, kelola knowledge base, pantau chatbot |
| [TROUBLESHOOTING.md](TROUBLESHOOTING.md) | Semua Pengguna | Solusi masalah umum yang mungkin terjadi |

---

## Struktur Folder Proyek

```
BPS-n8n-RAG_ChatBot/
│
├── frontend/                  # Dashboard admin (React + Vite + Tailwind)
├── program1_pdf_processor/    # PDF ingestion API (FastAPI + Python)
│   ├── api.py                 # Entry point API (port 8503)
│   ├── processor.py           # Ekstraksi & chunking PDF
│   ├── embedder.py            # Embedding via Gemini
│   ├── supabase_client.py     # Koneksi ke Supabase
│   └── requirements.txt       # Dependensi Python
│
├── bps_crawler/               # Crawler data BPS (referensi)
├── metabase/                  # Docker Compose untuk Metabase analytics
├── supabase/                  # SQL schema & snippets
│   └── snippets/              # SQL untuk buat tabel & fungsi
│
├── main_workflow.json          # Workflow n8n utama (WhatsApp + AI Agent)
├── rag_subworkflow.json        # Sub-workflow RAG Knowledge Base
├── bps_api_subworkflow.json    # Sub-workflow BPS Web API real-time
│
├── start.bat                   # Jalankan dashboard sekaligus (Windows)
├── README.md                   # File ini
├── SETUP.md                    # Panduan setup lengkap
├── PANDUAN_PENGGUNAAN.md       # Panduan operasional harian
└── TROUBLESHOOTING.md          # Panduan troubleshooting
```

---

## Tech Stack

| Komponen | Teknologi | Detail |
|---|---|---|
| AI Chat Model | Google Gemini 2.0 Flash | Model LLM untuk menjawab pertanyaan |
| AI Embedding Model | Google Gemini Embedding 001 | Mengubah teks menjadi vektor 768 dimensi |
| Workflow Automation | n8n | Orkestrasi alur kerja chatbot |
| WhatsApp Gateway | WAHA (WhatsApp HTTP API) | Menerima & mengirim pesan WhatsApp |
| Vector Database | Supabase PostgreSQL + pgvector | Menyimpan & mencari dokumen berdasarkan makna |
| PDF Processing | pdfplumber, PyMuPDF, FastAPI | Ekstraksi teks dari PDF |
| Admin Frontend | React 18, Vite, Tailwind CSS | Dashboard antarmuka admin |
| Analytics | Metabase | Dashboard monitoring data |
| Containerization | Docker | Menjalankan WAHA dan Metabase |

---

## Repository

GitHub: [https://github.com/AdityaNugrahaPS/BPS-RAG-Chatbot](https://github.com/AdityaNugrahaPS/BPS-RAG-Chatbot)
