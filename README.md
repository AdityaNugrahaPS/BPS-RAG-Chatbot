# BPS RAG Chatbot — Kota Pekanbaru

Sistem chatbot WhatsApp berbasis AI untuk BPS Kota Pekanbaru. Menjawab pertanyaan statistik menggunakan dokumen PDF BPS (RAG) dan data real-time via BPS Web API.

---

## Arsitektur Singkat

```
WhatsApp User
     │
     ▼
  WAHA (port 3001)          ← WhatsApp gateway
     │
     ▼
  n8n (port 5678)           ← Orkestrasi AI Agent
     ├── Gemini Chat Model  ← LLM (Google)
     ├── RAG Knowledge Base ← Cari di Supabase (vector search)
     └── BPS API Tool       ← Data real-time BPS

Admin Dashboard (port 5000) ← Upload PDF, kelola credentials
  └── PDF Processor API (port 8503)
```

---

## Layanan & Port

| Layanan             | Port  | Keterangan                        |
|---------------------|-------|-----------------------------------|
| Admin Dashboard     | 5000  | Frontend React (npm run dev)      |
| PDF Processor API   | 8503  | Backend FastAPI (python api.py)   |
| n8n                 | 5678  | Workflow automation               |
| WAHA                | 3001  | WhatsApp API                      |
| Metabase            | 3002  | Analitik (Docker)                 |

---

## Quick Start

> Lihat **[SETUP.md](SETUP.md)** untuk panduan lengkap instalasi dari awal.

Jika sudah pernah di-setup, cukup jalankan:

```bat
start.bat
```

Atau manual:
```bash
# Terminal 1 — Backend
cd program1_pdf_processor
python api.py

# Terminal 2 — Frontend
cd frontend
npm run dev
```

Lalu buka: **http://localhost:5000**

---

## Struktur Folder

```
BPS-n8n-RAG_ChatBot/
├── frontend/               # Dashboard admin (React + Vite)
├── program1_pdf_processor/ # PDF ingestion API (FastAPI + Python)
├── bps_crawler/            # Crawler data BPS (opsional)
├── metabase/               # Docker Compose untuk Metabase
├── supabase/               # SQL schema & snippets
├── main_workflow.json      # Backup n8n workflow utama (WAHA)
├── rag_subworkflow.json    # Backup n8n sub-workflow RAG
├── bps_api_subworkflow.json# Backup n8n sub-workflow BPS API
├── start.bat               # Jalankan semua sekaligus (Windows)
└── SETUP.md                # Panduan setup lengkap
```

---

## Teknologi

- **AI**: Google Gemini (chat + embedding)
- **Vector DB**: Supabase pgvector
- **Workflow**: n8n
- **WhatsApp**: WAHA
- **Frontend**: React 18 + TypeScript + Tailwind CSS
- **Backend**: Python FastAPI
- **Analitik**: Metabase
