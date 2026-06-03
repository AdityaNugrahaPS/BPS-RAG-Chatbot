# ARCHITECTURE — BPS RAG Chatbot

Dokumentasi arsitektur sistem: komponen, alur data, dan keputusan desain.

---

## 1. Konteks Sistem

Sistem ini melayani **dua jenis pengguna**:

1. **Masyarakat umum** — bertanya statistik via WhatsApp, dapat jawaban otomatis
2. **Staf admin BPS** — upload PDF baru, kelola knowledge base, monitor chatbot via dashboard

**Domain target**: BPS Kota Pekanbaru (domain ID `1471` di BPS Web API).

---

## 2. Diagram Komponen (High-Level)

```
┌──────────────────────────────────────────────────────────────────┐
│                       PENGGUNA WHATSAPP                          │
└────────────────────────────┬─────────────────────────────────────┘
                             │ kirim pesan
                             ▼
┌──────────────────────────────────────────────────────────────────┐
│  WAHA (WhatsApp HTTP API)               Docker · :3001           │
│  - Receive incoming WhatsApp messages                            │
│  - Forward to n8n webhook                                        │
│  - Send replies back to user                                     │
└────────────────────────────┬─────────────────────────────────────┘
                             │ webhook POST
                             ▼
┌──────────────────────────────────────────────────────────────────┐
│  n8n (Workflow Engine)                  Local · :5678            │
│  ┌────────────────────────────────────────────────────────────┐  │
│  │  Main Workflow: BPS WhatsApp RAG Chatbot                  │  │
│  │                                                            │  │
│  │  WAHA Trigger → Filter → AI Agent (Gemini/Groq) → Reply   │  │
│  │                              │                             │  │
│  │           ┌──────────────────┴──────────────────┐          │  │
│  │           ▼                                      ▼         │  │
│  │  ┌────────────────────┐         ┌──────────────────────┐   │  │
│  │  │ Knowledge Base Tool│         │  BPS API Tool         │   │  │
│  │  │ (subworkflow)      │         │  (subworkflow)        │   │  │
│  │  └─────────┬──────────┘         └──────────┬───────────┘   │  │
│  └────────────┼────────────────────────────────┼──────────────┘  │
└───────────────┼────────────────────────────────┼─────────────────┘
                │                                │
                ▼                                ▼
┌──────────────────────────┐      ┌──────────────────────────────┐
│  Supabase (cloud)         │      │  BPS Web API                  │
│  - PostgreSQL + pgvector  │      │  webapi.bps.go.id/v1/api/     │
│  - Tables:                │      │  - pressrelease, statictable, │
│    · documents (768-dim)  │      │    publication                │
│    · ingested_files       │      │  - Domain Pekanbaru: 1471     │
│    · n8n_chat_histories   │      └──────────────────────────────┘
│    · user_contacts        │
└──────────────┬───────────┘
               ▲                              ▲
               │ write embeddings             │ Gemini API
               │                              │
┌──────────────┴───────────┐      ┌──────────┴──────────────────┐
│  FastAPI Backend         │      │  Google Gemini (cloud)       │
│  program1_pdf_processor/ │      │  - models/gemini-embedding-001│
│  Local · :8503           │      │  - gemini-2.0-flash           │
│                          │      └──────────────────────────────┘
│  - POST /process         │
│  - POST /chat            │              ▲
│  - DELETE /kb/file       │              │ embedding + chat
│                          │              │
└──────────────┬───────────┘              │
               │ API calls                │
               ▼                          │
┌──────────────────────────┐              │
│  React Frontend          │              │
│  frontend/               │              │
│  Local · :5000           ├──────────────┘
│                          │
│  - PDF Processor wizard  │
│  - Dashboard (metrics)   │
│  - Credentials manager   │
│  - Riwayat chat          │
└──────────────────────────┘
```

---

## 3. Alur Data — Use Case Utama

### 3.1 Pertanyaan WhatsApp → Jawaban

```
1. User WhatsApp ──> WAHA (port 3001)
2. WAHA          ──> n8n webhook POST /webhook/<uuid>
3. n8n Main Workflow:
   a. Set Fields: extract { message, sender }
   b. Filter: skip group chat & empty message
   c. Send Seen + Start Typing → WAHA (UX)
   d. Wait 1s (anti-spam Gemini quota)
   e. AI Agent invoked dengan system prompt + user message
4. AI Agent:
   a. Read chat memory (Postgres, last 10 turns, session=phone)
   b. Decide: call knowledge_base tool
5. RAG Subworkflow:
   a. Gemini Embedding API ──> vector(768)
   b. POST /rest/v1/rpc/match_documents ──> top-5 chunks
   c. Format as numbered context
6. AI Agent: generate jawaban berdasarkan context
7. Main Workflow:
   a. Stop Typing → WAHA
   b. Send Reply → WAHA ──> User WhatsApp
8. Chat memory disimpan ke n8n_chat_histories (otomatis oleh Postgres Memory node)
```

### 3.2 Upload PDF → Knowledge Base

```
1. Admin di browser ──> Dashboard React (5000)
2. Drag & drop PDF ──> POST /process (FastAPI 8503)
3. FastAPI:
   a. pdf_extractor.py: pdfplumber/PyMuPDF extract teks per halaman
   b. text_cleaner.py: normalisasi (whitespace, header/footer)
   c. table_converter.py: tabel → teks markdown
   d. chunker.py: split 800-1500 char dengan overlap 100-200
   e. metadata_extractor.py: detect file_name, page, topic
   f. embedder.py: Gemini embedding-001 ──> vector(768) per chunk
   g. supabase_client.py:
      - INSERT INTO documents (content, metadata, embedding)
      - INSERT INTO ingested_files (file_name, chunk_count)
4. Frontend: update UI dengan progress (extract → chunk → embed)
5. Selesai: chunks searchable lewat match_documents()
```

### 3.3 Real-time BPS Data (BPS API Tool)

```
1. User tanya tentang data terkini ──> AI Agent
2. AI Agent decide: call bps_api_tool
3. BPS API Subworkflow:
   a. Extract keyword (strip stopword, max 2 kata)
   b. GET webapi.bps.go.id/v1/api/list?model=pressrelease&domain=1471&keyword=X
   c. Kalau 0 hasil → fallback ke model=statictable
   d. Strip HTML escape dari abstract
   e. Return top-5 hasil
4. AI Agent generate jawaban
```

---

## 4. Komponen Detail

### 4.1 WAHA (WhatsApp HTTP API)

- **Image**: `devlikeapro/waha` (Docker)
- **Port**: 3001 (host) ↔ 3000 (container)
- **Auth**: `WHATSAPP_API_KEY` env (set saat `docker run`)
- **Session**: `default` (per-nomor bot)
- **Webhook**: outgoing ke n8n webhook URL

**Kenapa WAHA bukan langsung WhatsApp Business API?**
- WhatsApp Business Cloud API butuh approval Meta + biaya per pesan
- WAHA = self-host, gratis, pakai sesi WhatsApp normal (scan QR)
- Trade-off: WAHA tidak resmi → bisa di-banned WhatsApp kalau melanggar ToS (mass-messaging, spam)

### 4.2 n8n (Workflow Engine)

- **Install**: `npm install -g n8n` (Node.js)
- **Data**: `~/.n8n/` (workflow, credentials, executions)
- **Port**: 5678
- **Auth**: email/password (di-setup pertama kali)
- **API Key**: untuk integrasi eksternal (dashboard ↔ n8n)

**Kenapa n8n?**
- Visual workflow editor — non-developer bisa baca alur
- Built-in nodes untuk LangChain (AI Agent, vector store, memory)
- Bisa self-host, gratis (Community Edition)

### 4.3 Supabase (Database)

- **Hosted**: cloud (region Singapore)
- **Engine**: PostgreSQL 15 + ekstensi `pgvector`
- **Tables**:
  - `documents` — chunk teks + embedding vector(768)
  - `ingested_files` — tracking PDF yang sudah diproses
  - `n8n_chat_histories` — riwayat chat per session
  - `user_contacts` — kontak unique per nomor
- **RPC**: `match_documents(query_embedding, threshold, count, filter)` — cosine similarity search
- **Auth**: service role key (backend), anon key (frontend dengan RLS)

**Kenapa Supabase bukan PostgreSQL biasa?**
- Sudah include `pgvector` pre-configured
- REST API otomatis (PostgREST) → n8n bisa call via HTTP Request
- Auth + Storage + Realtime built-in (future-proof)
- Free tier cukup untuk 50K rows, 500MB

### 4.4 Google Gemini

- **Embedding**: `models/gemini-embedding-001` — output 768 dim
- **Chat**: `gemini-2.0-flash` — context 1M token, gratis 15 req/min

**Kenapa Gemini bukan OpenAI/Claude?**
- Gratis tier signifikan (cocok untuk traffic BPS yang rendah)
- Embedding dimension 768 sama dengan banyak open-source model (bisa swap nanti)
- Latensi rendah dari Asia Pacific

### 4.5 FastAPI Backend

- **File entry**: `program1_pdf_processor/api.py`
- **Port**: 8503
- **Endpoints utama**:
  - `POST /process` — upload PDF, jalankan pipeline ingest
  - `POST /chat` — RAG query langsung (untuk testing tanpa WhatsApp)
  - `DELETE /knowledge-base/file` — hapus file dari KB
  - `GET /credentials` — baca credentials disimpan
  - `POST /credentials` — update credentials
- **State**: stateless, semua persistent di Supabase

**Kenapa FastAPI bukan Express/Flask?**
- Async-native (penting untuk PDF processing yang lama)
- Auto-generate OpenAPI/Swagger docs di `/docs`
- Type hints Python = lebih sedikit bug

### 4.6 React Frontend (Dashboard Admin)

- **Folder**: `frontend/`
- **Stack**: React 18 + Vite + TypeScript + Tailwind + Recharts
- **Port**: 5000
- **Pages**:
  - `Dashboard.tsx` — metrik (total dokumen, chunks, files, sessions) + charts
  - `PDFProcessor.tsx` — 4-step wizard upload PDF
  - `Credentials.tsx`, `CredentialDetail.tsx` — manage API keys
- **State**: localStorage untuk wizard progress, Supabase realtime untuk metrics

### 4.7 Metabase (Opsional)

- **Docker**: `metabase/docker-compose.yml`
- **Port**: 3002
- **Database**: connect ke Supabase Postgres pooler (port 6543)
- **Tujuan**: dashboard analytics untuk BI users — distribusi topik, frekuensi pertanyaan, dll

---

## 5. Keputusan Desain Penting

### 5.1 Kenapa Sub-Workflow, Bukan Inline Node?

AI Agent di n8n hanya bisa pakai **tool** dalam bentuk:
- `Code Tool` (JS inline) — terbatas, tidak bisa HTTP request panjang
- `Workflow Tool` — bisa call subworkflow (lebih fleksibel, reusable)

Knowledge Base & BPS API butuh chain HTTP request + transform, jadi dipisah sebagai subworkflow.

### 5.2 Kenapa 768-dim Embedding?

- `gemini-embedding-001` default output 768 dim (dengan `outputDimensionality: 768`)
- Cocok dengan `pgvector vector(768)` di Supabase
- Trade-off lebih kecil dari 3072 dim (default Gemini) → query lebih cepat, akurasi sedikit turun (tapi cukup untuk domain BPS)

### 5.3 Kenapa Chat Memory di Postgres?

n8n punya in-memory chat memory (Buffer Window), tapi:
- Hilang kalau n8n restart
- Tidak survive lintas workflow execution

Postgres Chat Memory (LangChain):
- Persistent
- Session key = nomor WhatsApp → context tetap per-user
- Bisa di-query oleh dashboard untuk fitur "Riwayat Chat"

### 5.4 Kenapa Tidak Pakai LangChain Vector Store Node Langsung?

n8n punya built-in Supabase Vector Store node, tapi:
- Lock-in ke schema tertentu
- Susah custom-tune filtering (mis. filter by metadata)
- Custom HTTP Request → POST `/rpc/match_documents` lebih fleksibel

### 5.5 Kenapa Ada Filter Pesan Grup?

Bot di-deploy di nomor WhatsApp pribadi → bisa masuk ke grup. Tanpa filter, bot bisa spam grup. Filter: `sender NOT contains '@g.us'`.

---

## 6. Skalabilitas & Limit

| Komponen | Free Tier Limit | Trigger Upgrade |
|---|---|---|
| Supabase | 500 MB DB, 50K rows | > 100K chunks (≈ 1000 PDF) |
| Gemini Chat | 15 req/min | > 1 pertanyaan / 4 detik |
| Gemini Embed | 1500 req/min | Saat ingest banyak PDF bersamaan |
| WAHA Docker | Unlimited (self-host) | RAM > 4 GB untuk 100+ session |
| BPS API | 100 req/menit (per FAQ resmi) | Jarang tercapai |
| n8n | Unlimited (self-host) | Saat butuh >1 instance (HA) |

---

## 7. Security Notes

- **Service role key Supabase = root access**. Hanya pakai di backend/n8n, tidak boleh di frontend
- **WAHA tanpa HTTPS** = aman selama localhost. Kalau di-expose ke publik → wajib reverse proxy + TLS
- **n8n executions** simpan input/output webhook → bisa berisi nomor WhatsApp pengguna. Set retention rendah di production (Settings → Data → Execution data)
- **API keys di workflow JSON** = harus disanitasi sebelum commit ke git public. Lihat [N8N_GUIDE.md §10.4](N8N_GUIDE.md)

---

## 8. Future Improvements

- [ ] Authentication & multi-user di dashboard (saat ini single-admin)
- [ ] Re-ranker setelah vector search (mis. Cohere rerank) untuk akurasi RAG lebih tinggi
- [ ] Streaming response — jawaban Gemini di-stream ke WhatsApp chunk per chunk
- [ ] Auto-deduplication chunks saat re-upload PDF yang sama
- [ ] Deployment ke VPS (saat ini lokal): n8n + WAHA + dashboard pakai Docker Compose, nginx reverse proxy
- [ ] OCR untuk PDF scan (saat ini hanya PDF digital yang bisa di-process)
