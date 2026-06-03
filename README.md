# BPS RAG Chatbot — Asisten Statistik Kota Pekanbaru via WhatsApp

Sistem chatbot yang menjawab pertanyaan seputar data statistik BPS Kota Pekanbaru
secara otomatis lewat WhatsApp, menggunakan **Retrieval-Augmented Generation (RAG)**
di atas Google Gemini, n8n, WAHA, dan Supabase pgvector.

```
Pengguna → WhatsApp → WAHA → n8n → [Gemini Embedding → Supabase pgvector → Gemini LLM] → balasan
```

---

## Apa yang Dilakukan Sistem

- **Menjawab pertanyaan via WhatsApp** — pengguna kirim pesan, bot balas berdasarkan PDF BPS yang sudah di-upload
- **Mengambil data real-time** dari [BPS Web API](https://webapi.bps.go.id) (publikasi, siaran pers, tabel statis) untuk domain Pekanbaru (kode `1471`)
- **Dashboard admin** untuk staf BPS: upload PDF baru, kelola credentials, pantau riwayat chat
- **Pipeline RAG end-to-end**: PDF → ekstraksi teks → chunking → embedding 768-dim → pgvector → cosine similarity search

---

## Tech Stack

| Lapisan | Teknologi |
|---|---|
| AI Chat | Google Gemini 2.0 Flash (n8n) |
| AI Embedding | Google Gemini Embedding 001 (768 dim) |
| Workflow | n8n (self-hosted, port 5678) |
| WhatsApp Gateway | WAHA — Docker (port 3001) |
| Vector DB | Supabase PostgreSQL + pgvector (cloud) |
| Backend | FastAPI + Python 3.11 (port 8503) |
| Frontend | React 18 + Vite + Tailwind (port 5000) |
| Analytics (opsional) | Metabase — Docker (port 3002) |

---

## Struktur Repository

```
BPS-n8n-RAG_ChatBot/
├── frontend/                    # Dashboard admin (React + Vite + Tailwind)
├── program1_pdf_processor/      # Backend PDF ingestion (FastAPI)
│   ├── api.py                   # Entry point API
│   ├── processor.py             # Orkestrasi pipeline ingest
│   ├── pdf_extractor.py         # Ekstraksi teks PDF
│   ├── chunker.py               # Pemecahan teks → chunks
│   ├── embedder.py              # Embedding via Gemini
│   ├── supabase_client.py       # Koneksi Supabase
│   └── requirements.txt
├── n8n_workflows/               # Workflow n8n (versi sanitasi — boleh dibaca/edit)
│   ├── 01_main_workflow.json           # Workflow utama: WAHA → AI Agent → balas
│   ├── 02_knowledge_base_subworkflow.json   # RAG: query → embedding → pgvector
│   └── 03_bps_api_subworkflow.json     # Query BPS Web API
├── supabase/
│   ├── config.toml              # Supabase local config
│   └── snippets/                # SQL untuk schema awal & RPC match_documents
├── metabase/
│   └── docker-compose.yml       # Metabase analytics (opsional)
├── docs/                        # ★ Dokumentasi lengkap (baca ini dulu)
│   ├── SETUP.md                 # Instalasi dari nol
│   ├── N8N_GUIDE.md             # Import & konfigurasi workflow n8n
│   ├── ARCHITECTURE.md          # Diagram, alur data, peran komponen
│   ├── USER_GUIDE.md            # Operasional harian untuk admin BPS
│   └── TROUBLESHOOTING.md       # Solusi masalah umum
├── .env.example                 # Template environment variables
├── .gitignore
└── start.bat                    # Skrip Windows untuk jalankan dashboard
```

---

## Quick Start

Sistem sudah ter-setup? Jalankan harian dengan 4 langkah:

```powershell
# 1. Pastikan Docker Desktop running (container `waha` aktif)
# 2. Jalankan n8n di terminal:
n8n start

# 3. Klik dua kali start.bat (jalankan backend + frontend, buka browser)
# 4. Cek WAHA WhatsApp session WORKING di http://localhost:3001
```

Layanan yang akan tersedia:

| Service | URL | Sumber |
|---|---|---|
| Admin Dashboard | http://localhost:5000 | start.bat |
| PDF Processor API | http://localhost:8503 | start.bat |
| n8n Editor | http://localhost:5678 | `n8n start` |
| WAHA Dashboard | http://localhost:3001 | Docker `waha` |
| Metabase (opsional) | http://localhost:3002 | `docker compose up` |

**Setup baru? Lihat [docs/SETUP.md](docs/SETUP.md).**

---

## Dokumentasi

| Dokumen | Untuk Siapa | Isi |
|---|---|---|
| [docs/SETUP.md](docs/SETUP.md) | Developer baru | Setup lengkap dari nol — install dependencies, buat akun Supabase/Gemini/BPS, import workflow, upload PDF pertama |
| [docs/N8N_GUIDE.md](docs/N8N_GUIDE.md) | Developer | Cara import workflow, set credentials di n8n, struktur node, cara debug |
| [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) | Developer | Arsitektur sistem, alur data RAG, peran tiap komponen |
| [docs/USER_GUIDE.md](docs/USER_GUIDE.md) | Staf admin BPS | Operasional harian: jalankan sistem, upload PDF, pantau chatbot |
| [docs/TROUBLESHOOTING.md](docs/TROUBLESHOOTING.md) | Semua | Solusi masalah umum |

---

## Catatan untuk Programmer Baru

1. **Workflow n8n di `n8n_workflows/` sudah disanitasi** — semua API key diganti placeholder seperti `__GEMINI_API_KEY__`, `__SUPABASE_SERVICE_KEY__`, `__BPS_API_KEY__`. Lakukan find-and-replace dengan key kamu sendiri sebelum import. Lihat [docs/N8N_GUIDE.md](docs/N8N_GUIDE.md).
2. **File `.env` tidak ada di repo** — copy `.env.example` jadi `.env` lalu isi nilai. File `.credentials_all.json` di `program1_pdf_processor/` juga di-ignore — bikin sendiri saat setup.
3. **Tidak ada CI/CD** — semua dijalankan lokal di Windows. Linux/Mac perlu adaptasi `start.bat`.
4. **Supabase**: project lama akan di-handover terpisah. Kalau bikin baru, jalankan SQL di `supabase/snippets/` untuk bikin schema.

---

## Lisensi & Kontak

Pengembang awal: **Aditya Nugraha Pratama Saiya** ([@AdityaNugrahaPS](https://github.com/AdityaNugrahaPS))
Project ini dikembangkan dalam rangka KP di **BPS Kota Pekanbaru**.
