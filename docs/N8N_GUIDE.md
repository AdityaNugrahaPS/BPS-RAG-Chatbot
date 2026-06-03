# N8N GUIDE — Workflow BPS RAG Chatbot

Panduan teknis untuk programmer yang akan **import, mengembangkan, atau debug** workflow n8n di project ini.

> Setup n8n dari nol (install, akun admin, API key) ada di [SETUP.md §7](SETUP.md#7-setup-n8n).

---

## Daftar Isi

1. [Overview 3 Workflow](#1-overview-3-workflow)
2. [File Workflow di Repo](#2-file-workflow-di-repo)
3. [Cara Import & Sanitasi](#3-cara-import--sanitasi)
4. [Struktur Node Main Workflow](#4-struktur-node-main-workflow)
5. [Struktur Node Knowledge Base Subworkflow](#5-struktur-node-knowledge-base-subworkflow)
6. [Struktur Node BPS API Subworkflow](#6-struktur-node-bps-api-subworkflow)
7. [Credentials yang Harus Di-Set](#7-credentials-yang-harus-di-set)
8. [Cara Debug](#8-cara-debug)
9. [Mengubah System Prompt AI Agent](#9-mengubah-system-prompt-ai-agent)
10. [Backup & Restore Workflow](#10-backup--restore-workflow)

---

## 1. Overview 3 Workflow

```
┌─────────────────────────────────────────────────────────┐
│  Main Workflow — BPS WhatsApp RAG Chatbot              │
│  ─────────────────────────────────────────────────────  │
│  WAHA Trigger → Set Fields → Filter → Send Seen →      │
│  Start Typing → Wait → AI Agent → Stop Typing →        │
│  Send Reply                                             │
│                          │                              │
│                          │ AI Agent calls tool ↓        │
│                          ├──→ RAG Knowledge Base ──┐    │
│                          └──→ BPS API Tool ─────┐  │    │
└─────────────────────────────────────────────────┼──┼────┘
                                                  │  │
                  ┌───────────────────────────────┘  │
                  ▼                                  ▼
┌─────────────────────────────┐    ┌────────────────────────────┐
│ Subworkflow: Knowledge Base │    │ Subworkflow: BPS API       │
│ ─────────────────────────── │    │ ────────────────────────── │
│ Trigger → Embed Query →     │    │ Trigger → Extract Keyword→ │
│ Prepare Query →             │    │ HTTP GET webapi.bps.go.id→ │
│ Supabase Vector Search →    │    │ Format Response            │
│ Format Response             │    │                            │
└─────────────────────────────┘    └────────────────────────────┘
```

**Kenapa dipisah jadi 3 workflow?**
- Main = orchestrator + chat memory + send to user
- Subworkflow = tool yang dipanggil AI Agent. Tiap tool harus standalone workflow di n8n agar bisa di-register ke Agent lewat `toolWorkflow` node

---

## 2. File Workflow di Repo

Semua di folder [`n8n_workflows/`](../n8n_workflows/):

| File | Workflow Name (di n8n) | Workflow ID (asli) |
|---|---|---|
| `01_main_workflow.json` | BPS WhatsApp RAG Chatbot | `0Ry8fETqKXE6pnyc` |
| `02_knowledge_base_subworkflow.json` | BPS Knowledge Base Tool | `H6CBpeCionMIdqsv` |
| `03_bps_api_subworkflow.json` | BPS API Tool | `8jAnJCCb31i1e6zg` |

**Yang sudah disanitasi (placeholder, harus diganti sebelum import):**

| Placeholder | Ganti dengan |
|---|---|
| `__GEMINI_API_KEY__` | API key Gemini |
| `__SUPABASE_PROJECT__.supabase.co` | URL Supabase (cuma host) |
| `__SUPABASE_SERVICE_KEY__` | `service_role` key Supabase |
| `__SUPABASE_ANON_KEY__` | `anon` key (untuk endpoint `user_contacts`) |
| `__BPS_API_KEY__` | API key BPS Web |

**Yang TIDAK disanitasi (internal n8n IDs — tidak sensitif, biarkan):**
- `id` workflow & node (mis. `7fca80a8-4725-...`)
- `credential.id` di node (akan di-rebind manual ke credential baru setelah import)
- `versionId`, `webhookId`, dll

---

## 3. Cara Import & Sanitasi

### Step 1 — Find-and-Replace Placeholders

Buka folder `n8n_workflows/` di VS Code (atau editor lain), pakai global find-and-replace:

```
Ctrl+Shift+F
→ Find:    __GEMINI_API_KEY__
→ Replace: AIzaSyXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX
→ Replace All
```

Ulangi untuk 4 placeholder lainnya.

> **Tip:** simpan dulu file ke folder backup sebelum replace, jadi kalau ada error bisa balik ke versi sanitasi.

### Step 2 — Import Satu per Satu

Urutan import:

1. **Import subworkflow dulu** (`02_knowledge_base_subworkflow.json`, `03_bps_api_subworkflow.json`)
   - Karena main workflow akan refer ke ID-nya
2. **Catat workflow ID baru** masing-masing subworkflow (lihat di URL n8n: `/workflow/[ID-baru]`)
3. **Edit `01_main_workflow.json`** — replace workflow ID lama dengan ID baru:
   - Cari `"value":"H6CBpeCionMIdqsv"` → ganti dengan ID Knowledge Base baru
   - Cari `"value":"8jAnJCCb31i1e6zg"` → ganti dengan ID BPS API baru (kalau ada di workflow ini)
4. **Import main workflow**

### Step 3 — Bind Credentials per Node

Setiap node yang punya field `credentials` akan tampil ⚠️ kuning setelah import (karena `credential.id` yang lama tidak ada di n8n baru). Klik node → pilih credential yang sudah dibuat (lihat §7).

### Step 4 — Aktifkan Semua Workflow

Toggle **Active** di kanan atas tiap workflow.

> Subworkflow tidak perlu Active untuk dipanggil sebagai tool — tapi kalau ada trigger `Execute Workflow Trigger`, harus Active. Aktifkan semua untuk amannya.

---

## 4. Struktur Node Main Workflow

File: [`n8n_workflows/01_main_workflow.json`](../n8n_workflows/01_main_workflow.json)

Urutan eksekusi:

| # | Node | Tipe | Tugas |
|---|---|---|---|
| 1 | **WAHA Trigger** | `@devlikeapro/n8n-nodes-waha.wahaTrigger` | Terima webhook dari WAHA tiap ada pesan masuk |
| 2 | **Set Fields** | `n8n-nodes-base.set` | Extract `message`, `sender` dari payload WAHA |
| 3 | **Upsert User Contact** (paralel) | `httpRequest` | Catat kontak user ke Supabase `user_contacts` |
| 4 | **Filter Private Messages** | `n8n-nodes-base.if` | Skip pesan grup (`@g.us`) & pesan kosong |
| 5 | **Send Seen** | `WAHA` | Mark read di WhatsApp |
| 6 | **Start Typing** | `WAHA` | Animasi "typing…" |
| 7 | **Wait** | `n8n-nodes-base.wait` | Tunggu 1 detik (anti-spam Gemini) |
| 8 | **AI Agent** | `@n8n/n8n-nodes-langchain.agent` | LLM agent — panggil tools, generate jawaban |
| 9 | **Stop Typing** | `WAHA` | Hentikan animasi typing |
| 10 | **Send Reply** | `WAHA` | Kirim jawaban ke user |

**Komponen pendukung AI Agent:**
- **Postgres Chat Memory** (ai_memory) — context window 10 turn, session = `from` phone number
- **Groq Chat Model** (ai_languageModel) — LLM provider (Groq Llama 3.3 70B). **Bisa diganti ke Gemini node**
- **RAG Knowledge Base** (ai_tool) — `toolWorkflow` yang call subworkflow #2
- **BPS API Tool** (ai_tool) — `toolWorkflow` yang call subworkflow #3

**Error handling:**
- **If AI Error** → kalau AI Agent error, route ke **Send Fallback Reply** (pesan "maaf, terjadi kesalahan…")

---

## 5. Struktur Node Knowledge Base Subworkflow

File: [`n8n_workflows/02_knowledge_base_subworkflow.json`](../n8n_workflows/02_knowledge_base_subworkflow.json)

| # | Node | Tipe | Tugas |
|---|---|---|---|
| 1 | **Execute Workflow Trigger** | Trigger | Terima input `{ query: "..." }` dari AI Agent |
| 2 | **Gemini Embed Query** | `httpRequest` | POST ke `generativelanguage.googleapis.com/.../gemini-embedding-001:embedContent` → vector(768) |
| 3 | **Prepare Supabase Query** | `code` | Wrap embedding jadi payload `{ query_embedding, match_count, filter }` |
| 4 | **Supabase Vector Search** | `httpRequest` | POST ke `supabase.co/rest/v1/rpc/match_documents` |
| 5 | **Format RAG Response** | `code` | Format hasil → string ber-numbered `[1] file.pdf\ncontent...\n---\n[2] ...` |

**Output ke AI Agent:** `{ response: "<formatted context>" }`. AI Agent kemudian generate jawaban berbasis context ini.

---

## 6. Struktur Node BPS API Subworkflow

File: [`n8n_workflows/03_bps_api_subworkflow.json`](../n8n_workflows/03_bps_api_subworkflow.json)

| # | Node | Tipe | Tugas |
|---|---|---|---|
| 1 | **Execute Workflow Trigger** | Trigger | Input `{ keyword: "..." }` dari AI Agent |
| 2 | **Extract Keyword** | `code` | Strip stopword (kota, pekanbaru, tahun, …), ambil 2 kata > 3 char |
| 3 | **HTTP GET pressrelease** | `httpRequest` | `webapi.bps.go.id/v1/api/list?model=pressrelease&domain=1471&keyword=X` |
| 4 | **(fallback) statictable** | `httpRequest` | Kalau pressrelease 0 hasil → fallback ke statictable |
| 5 | **Format BPS Response** | `code` | Strip HTML escape (`&lt;p&gt;`, `&nbsp;`), return ringkasan |

**Endpoint BPS Web API:**
- `?model=pressrelease&domain=1471` — siaran pers (paling update, 942 items)
- `?model=statictable&domain=1471` — tabel statis (121 tables)
- `?model=publication&domain=1471` — publikasi PDF (394 items)
- `?model=data&domain=1471` — **TIDAK BERFUNGSI** untuk domain Pekanbaru (return null)

**WAJIB:** kirim header `User-Agent: Mozilla/5.0` — kalau tidak, BPS WAF (Perimeter) akan block.

---

## 7. Credentials yang Harus Di-Set

Buat di **n8n → Settings → Credentials → New**:

### 7.1 Postgres (untuk Chat Memory)

| Field | Nilai |
|---|---|
| Host | `aws-1-ap-northeast-2.pooler.supabase.com` (cek di Supabase → Settings → Database → Connection pooling) |
| Port | `6543` |
| Database | `postgres` |
| User | `postgres.[project-ref]` |
| Password | DB password Supabase |
| SSL | `require` |

> **Catat:** chat memory pakai `n8n_chat_histories` table — pastikan tabel ini sudah di-create (lihat SETUP.md §3.3).

### 7.2 WAHA API

| Field | Nilai |
|---|---|
| URL | `http://localhost:3001` |
| API Key | Kunci yang di-set saat `docker run -e WHATSAPP_API_KEY=...` |

> Kalau pakai header `X-Api-Key`, set di "Custom" → header `X-Api-Key: <key>`.

### 7.3 Groq API (opsional)

Hanya kalau pakai Groq sebagai LLM (alternatif Gemini, lebih cepat & gratis):

| Field | Nilai |
|---|---|
| API Key | Key dari https://console.groq.com |

Model rekomendasi: `llama-3.3-70b-versatile`.

### 7.4 Gemini (tidak butuh n8n credential)

Gemini di-call via **HTTP Request node** dengan key di URL query parameter, jadi tidak butuh credential khusus di n8n. Ganti `__GEMINI_API_KEY__` di JSON saat sanitasi (§3).

---

## 8. Cara Debug

### 8.1 Lihat Execution Log

**n8n → Executions** (sidebar kiri, ikon jam):
- Merah = error
- Hijau = sukses
- Klik execution → lihat data input/output tiap node

### 8.2 Manual Trigger Test

Untuk test subworkflow tanpa kirim WhatsApp:

1. Buka subworkflow (mis. Knowledge Base)
2. Klik tombol **Execute Workflow** (atau trigger node `Execute Workflow Trigger` → klik "Test step")
3. Provide input manual:
   ```json
   { "query": "berapa penduduk pekanbaru tahun 2023" }
   ```

### 8.3 Re-run Single Node

Klik kanan node → **Execute Node** → lihat output di panel kanan. Berguna untuk test perubahan kode JS / parameter.

### 8.4 Common Errors

| Error | Penyebab | Fix |
|---|---|---|
| `Embedding gagal` | Gemini API key salah / quota habis | Cek API key, cek quota di Google AI Studio |
| `null` response dari Supabase | RPC `match_documents` tidak ada / signature salah | Re-run SQL dari SETUP.md §3.3 |
| `403` dari BPS API | Header `User-Agent` kosong | Tambah header di HTTP Request node |
| AI Agent loop / tidak panggil tool | System prompt tidak tegas | Update system prompt — lihat §9 |
| `Send Reply` 401 | WAHA API key salah | Cek credential WAHA |

---

## 9. Mengubah System Prompt AI Agent

System prompt menentukan perilaku bot. Lokasi:

**Main workflow → node `AI Agent` → parameter `systemMessage`**

System prompt saat ini (per April 2026):

```
Kamu adalah asisten BPS Kota Pekanbaru yang ramah, sopan, dan helpful 😊

ATURAN WAJIB — HARUS DIIKUTI TANPA PENGECUALIAN:
1. SELALU panggil tool knowledge_base SEBELUM menjawab apapun
2. Jawab HANYA berdasarkan informasi dari knowledge_base
3. DILARANG menambahkan pengetahuan umum / asumsi
4. Kalau tidak ada data → "Maaf, data tersebut belum tersedia..."
5. JANGAN mengarang angka/tahun/fakta
6. Jawab singkat 3-4 kalimat/poin
7. Gunakan emoji ramah
8. Format: bullet "- ", bold "*kata*"
9. Jangan tambahkan URL/link eksternal
```

**Tips ubah prompt:**
- **Tegas dengan capital letters** untuk aturan kritis (`WAJIB`, `DILARANG`)
- **Numbered list** lebih reliable daripada paragraf
- **Format WhatsApp**: `*bold*`, `_italic_`, `- bullet` (bukan markdown `**bold**`)
- **Test dengan pertanyaan edge case** sebelum deploy — pertanyaan di luar domain, pertanyaan ambigu, dll

---

## 10. Backup & Restore Workflow

### 10.1 Export Workflow

Di n8n: workflow → klik **⋮ → Download** → save JSON.

### 10.2 Backup Otomatis Folder n8n

n8n simpan semua data di `~/.n8n/` (Windows: `C:\Users\[user]\.n8n\`). Backup folder ini berkala:

```powershell
Compress-Archive -Path "$env:USERPROFILE\.n8n" -DestinationPath "n8n-backup-$(Get-Date -Format yyyy-MM-dd).zip"
```

### 10.3 Restore Workflow

1. Stop n8n (`Ctrl+C` di terminal)
2. Replace folder `~/.n8n/` dengan backup
3. Start n8n lagi

**Atau** import via UI (kalau hanya ingin restore 1 workflow).

### 10.4 Re-sanitasi Workflow Sebelum Commit

Kalau kamu edit workflow di n8n UI lalu mau commit ke repo, **harus sanitasi ulang**. Caranya:

1. Export workflow dari n8n → save di folder kerja
2. Pakai `sed` (PowerShell harus pakai `-replace`):

```powershell
$content = Get-Content workflow.json -Raw
$content -replace 'AIzaSy[A-Za-z0-9_-]{33}', '__GEMINI_API_KEY__' `
         -replace 'sb_secret_[A-Za-z0-9_-]+', '__SUPABASE_SERVICE_KEY__' `
         -replace 'sb_publishable_[A-Za-z0-9_-]+', '__SUPABASE_ANON_KEY__' `
         -replace '[a-z0-9]{20}\.supabase\.co', '__SUPABASE_PROJECT__.supabase.co' `
         -replace '<bps-api-key-32-hex-chars>', '__BPS_API_KEY__' |
  Set-Content n8n_workflows/01_main_workflow.json
```

3. Verifikasi tidak ada secret yang tertinggal:

```powershell
Select-String -Path n8n_workflows/*.json -Pattern 'AIzaSy|sb_secret_|sb_publishable_|webapi\.bps.*key='
# Harus kosong (no matches)
```

4. Commit.

> **JANGAN PERNAH** commit workflow asli yang masih ada API key. Sekali ke-push, key harus dianggap bocor — rotate di provider (Google AI Studio, Supabase, BPS).
