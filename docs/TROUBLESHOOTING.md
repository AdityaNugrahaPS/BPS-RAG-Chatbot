# TROUBLESHOOTING — BPS RAG Chatbot

Solusi untuk masalah yang sering muncul. Cari gejala paling sesuai → ikuti langkah solusinya.

---

## Cara Membaca Error

| Tempat | Cara Buka | Apa yang Terlihat |
|---|---|---|
| n8n Execution Log | http://localhost:5678 → **Executions** | Riwayat tiap percakapan, klik yg merah utk detail error |
| Terminal n8n | Jendela CMD yang jalan `n8n start` | Error real-time saat n8n berjalan |
| Terminal Backend | Jendela CMD `start.bat` (PDF Processor) | Error saat upload/proses PDF |
| Browser Console | F12 → **Console** | Error frontend |
| WAHA Dashboard | http://localhost:3001 | Status WhatsApp session |
| Docker Desktop | App Docker → **Containers** | Status container `waha`, log container |

---

## Cek Cepat (Health Check)

| # | Cek | URL | Normal | Tidak Normal |
|---|---|---|---|---|
| 1 | Dashboard | http://localhost:5000 | Halaman dashboard tampil | [#1](#1-dashboard-tidak-bisa-dibuka) |
| 2 | Backend API | http://localhost:8503/docs | Swagger UI tampil | [#1](#1-dashboard-tidak-bisa-dibuka) |
| 3 | n8n | http://localhost:5678 | Editor workflow | [#2](#2-n8n-tidak-jalan) |
| 4 | n8n Workflow Active | n8n → Workflows | Toggle biru/hijau | Klik toggle utk aktifkan |
| 5 | WAHA Dashboard | http://localhost:3001 | WAHA UI | [#3](#3-waha-container-tidak-jalan) |
| 6 | WhatsApp Session | http://localhost:3001 → Sessions | Status **WORKING** | [#4](#4-whatsapp-session-bukan-working) |
| 7 | Supabase Connection | Supabase dashboard | Bisa login | Cek internet, cek password DB |

---

## #1 Dashboard Tidak Bisa Dibuka

**Gejala:** http://localhost:5000 → "This site can't be reached" / blank

**Cek:**

```powershell
# Apakah port 5000 ada yang listen?
netstat -ano | findstr :5000
```

**Solusi:**

- **Backend & Frontend tidak jalan** → jalankan ulang `start.bat`
- **Port 5000 dipakai aplikasi lain** → kill aplikasi itu, atau ubah port di `frontend/vite.config.ts`
- **Backend port 8503 mati** → frontend tampil tapi tidak bisa fetch data. Cek terminal `PDF Processor API`:
  - Error `ModuleNotFoundError: No module named 'fastapi'` → `pip install -r program1_pdf_processor/requirements.txt`
  - Error `Address already in use` → port 8503 bentrok, kill proses lain di port itu

---

## #2 n8n Tidak Jalan

**Gejala:** http://localhost:5678 tidak bisa dibuka

**Solusi:**

```powershell
# Jalankan di terminal baru:
n8n start
```

Tunggu sampai muncul `n8n ready on port 5678`. **Jangan tutup terminal ini** selama sistem dipakai.

**Kalau `n8n` tidak dikenal:**

```powershell
npm install -g n8n
```

**Kalau install gagal karena permission:** buka PowerShell sebagai Administrator.

**Kalau n8n start tapi error startup:**
- Cek folder `~/.n8n/` (`C:\Users\[user]\.n8n\`) — corrupt? Rename folder lalu start ulang (akan buat folder baru kosong; data hilang tapi sistem jalan)
- Cek port 5678 tidak dipakai aplikasi lain: `netstat -ano | findstr :5678`

---

## #3 WAHA Container Tidak Jalan

**Gejala:** http://localhost:3001 tidak bisa dibuka

**Cek di Docker Desktop:**

1. Buka Docker Desktop
2. Tab **Containers**
3. Cari container `waha`

**Jika status `Stopped`:**

```powershell
docker start waha
```

**Jika container `waha` tidak ada:**

```powershell
docker run -d --name waha --restart always -p 3001:3000 -e WHATSAPP_API_KEY=mysecretkey devlikeapro/waha
```

**Jika Docker Desktop tidak jalan:**
- Buka Docker Desktop dari Start Menu
- Tunggu ikon di taskbar berhenti animasi (~30 detik)
- Kalau Docker Desktop error startup: restart Windows

**Cek log WAHA:**
```powershell
docker logs waha --tail 50
```

---

## #4 WhatsApp Session Bukan WORKING

**Gejala:** http://localhost:3001 → session `default` status `STOPPED` / `SCAN_QR_CODE` / `FAILED`

### 4.1 Kalau status `STOPPED`

1. Klik **Start** pada session `default`
2. Tunggu 10–30 detik
3. Status harus berubah ke **WORKING** otomatis (kalau sesi sebelumnya valid)

### 4.2 Kalau status `SCAN_QR_CODE`

Sesi expired (biasanya setelah lama tidak aktif atau WhatsApp di-logout dari device lain).

1. Klik session → tab **QR Code**
2. Di HP bot: **WhatsApp → Settings → Linked Devices → Link a device**
3. Scan QR
4. Tunggu status berubah ke **WORKING**

### 4.3 Kalau status `FAILED`

```powershell
# Stop & restart container:
docker restart waha
```

Lalu scan QR ulang.

**Catatan:** Kalau sering `FAILED`, mungkin nomor bot di-banned WhatsApp (terdeteksi sebagai bot/spam). Pakai nomor lain, dan kurangi volume balasan.

---

## #5 Bot Tidak Balas Pesan

**Gejala:** kirim WA ke nomor bot, tidak ada balasan setelah > 1 menit

**Step-by-step diagnosis:**

### 5.1 Cek WhatsApp Session

http://localhost:3001 → session `default` harus **WORKING**. Kalau tidak, lihat [#4](#4-whatsapp-session-bukan-working).

### 5.2 Cek Webhook Dipanggil WAHA

http://localhost:3001 → klik session `default` → **Webhooks** tab

- Webhook URL ada? Pointing ke `http://localhost:5678/webhook/<uuid>`?
- Event `message` di-enable?

Kalau kosong/salah → set webhook URL dari n8n (lihat [SETUP.md §9.5](SETUP.md#9-import-workflow-n8n)).

### 5.3 Cek n8n Receive Webhook

http://localhost:5678 → **Executions**

- Ada execution baru tiap kali kirim WA? Kalau tidak → webhook tidak sampai ke n8n
  - Cek workflow main **Active** (toggle hijau)
  - Cek webhook URL di WAHA sama dengan di node `WAHA Trigger`
- Ada execution tapi merah (error)? → klik untuk lihat node mana yang gagal

### 5.4 Cek Error Per Node

Di execution merah, klik node yang gagal:

| Node Error | Penyebab | Fix |
|---|---|---|
| **Postgres Chat Memory** | Koneksi DB gagal | Cek credential Postgres di n8n, password Supabase benar |
| **AI Agent** | LLM provider error | Cek API key Gemini/Groq, cek quota |
| **Send Reply / Stop Typing** | WAHA API error | Cek credential WAHA, session masih WORKING? |
| **RAG Knowledge Base** | Subworkflow gagal | Buka subworkflow, test step by step |
| **Supabase Vector Search** | Supabase down / RPC tidak ada | Cek Supabase dashboard, cek `match_documents` exist |

### 5.5 Restart Berurutan

Kalau diagnosis di atas tidak ketemu:

1. Tutup semua terminal n8n
2. Docker Desktop → restart container `waha`
3. Buka terminal baru → `n8n start`
4. Klik `start.bat`
5. Tes kirim WA

---

## #6 Bot Balas Tapi "Maaf, Data Tidak Tersedia" Untuk Semua Pertanyaan

**Gejala:** Bot sehat, tapi semua pertanyaan dibalas dengan template fallback

**Cek:**

### 6.1 Tabel documents Kosong?

Buka Supabase → **Table Editor** → `documents`:
- 0 rows → belum ada PDF yang di-ingest. Upload PDF dulu di dashboard.
- Ada rows tapi tidak relevan → ingest PDF yang sesuai topik pertanyaan.

### 6.2 Embedding Mismatch?

Vector di `documents` harus 768 dim. Cek:

```sql
SELECT id, array_length(embedding::float[], 1) AS dim FROM documents LIMIT 5;
```

Kalau bukan 768 → re-ingest PDF dengan model yang benar (`gemini-embedding-001` dengan `outputDimensionality: 768`).

### 6.3 RPC match_documents Salah Signature?

```sql
\df match_documents
```

Argumen harus: `(vector(768), float, int, jsonb)`. Kalau beda → re-create dengan SQL di [SETUP.md §3.3](SETUP.md#3-setup-supabase-vector-database).

### 6.4 Threshold Terlalu Tinggi?

Default threshold 0.5. Coba turunkan ke 0.3 untuk test:

```sql
SELECT * FROM match_documents(
  '[0.1, 0.2, ...]'::vector(768),  -- dummy embedding
  0.3,
  5,
  '{}'::jsonb
);
```

Kalau ada hasil dengan threshold 0.3 tapi tidak ada di 0.5 → ubah parameter `match_threshold` di subworkflow.

---

## #7 Upload PDF Gagal

**Gejala:** drag PDF, klik Proses, tapi error / stuck di progress

### 7.1 Cek Terminal Backend

Terminal `PDF Processor API` akan tampil error stack trace.

| Error | Fix |
|---|---|
| `pdfplumber error: cannot extract text` | PDF scan/foto → tidak bisa diproses |
| `Gemini API 429 RESOURCE_EXHAUSTED` | Quota habis → tunggu reset (per menit) atau upgrade |
| `Supabase connection refused` | Cek internet, cek Supabase URL/key |
| `httpx.ReadTimeout` | Embedding API lambat → split PDF jadi lebih kecil |
| `Memory error` | PDF terlalu besar (>500 halaman) → split dulu |

### 7.2 PDF Scan Tidak Bisa

Sistem hanya support PDF digital (teks asli dari Word/Excel). PDF hasil scan/foto = tidak bisa.

**Cara cek PDF scan vs digital:**
- Buka PDF di Acrobat / browser
- Select teks dengan mouse → kalau bisa di-copy = digital
- Kalau tidak bisa di-select = scan

Untuk PDF scan, perlu OCR dulu (Adobe Acrobat → Tools → Scan & OCR). Future improvement: integrate Tesseract.

### 7.3 Upload Stuck di 100% Embed

Embedding selesai tapi belum commit ke Supabase. Cek terminal backend:
- `httpx.ReadTimeout` → koneksi ke Supabase timeout. Retry.
- `IntegrityError unique violation` → file sudah pernah di-ingest. Pilih mode **Replace** atau hapus dulu di Supabase.

---

## #8 n8n API Key Expired

**Gejala:** Dashboard menampilkan `401 Unauthorized` saat call n8n API

**Solusi:**

1. http://localhost:5678 → klik avatar → **Settings → API**
2. **Create an API key** baru — beri nama, set expiry (atau kosong = no expiry)
3. **Copy key**
4. Dashboard → **Credentials → n8n** → update API Key field → **Save**

> **Tip:** Set reminder kalender 1 minggu sebelum expiry untuk rotate key.

---

## #9 Frontend Tidak Bisa Connect Supabase

**Gejala:** Dashboard tampil tapi tidak ada data (chunks, files, dll = 0)

**Cek:**

1. Browser → F12 → **Network** tab
2. Filter `supabase` → cek request mana yang gagal
3. Response 401 → anon key salah
4. Response 404 → URL Supabase salah / project deleted

**Fix:**

1. Buka `frontend/.env`
2. Update:
   ```
   VITE_SUPABASE_URL=https://[your-project].supabase.co
   VITE_SUPABASE_KEY=sb_publishable_xxxxx  # anon key, BUKAN service key
   ```
3. Restart frontend: tutup terminal frontend → jalankan ulang `start.bat`

---

## #10 BPS API 403 Forbidden

**Gejala:** Subworkflow BPS API → node HTTP Request response `403`

**Penyebab:** Header `User-Agent` kosong → di-block WAF Perimeter BPS.

**Fix:** Di node HTTP Request, **Headers → Add**:
- Name: `User-Agent`
- Value: `Mozilla/5.0 (Windows NT 10.0; Win64; x64)`

Save & re-test.

---

## #11 Docker Container Restart Loop

**Gejala:** `docker ps` menunjukkan WAHA `Restarting (1)` terus

**Cek log:**
```powershell
docker logs waha --tail 100
```

**Common causes:**

- Port 3000 di container conflict → restart Docker Desktop
- Image rusak → re-pull:
  ```powershell
  docker stop waha
  docker rm waha
  docker pull devlikeapro/waha
  # lalu re-run docker run command
  ```
- Out of memory → Docker Desktop → Settings → Resources → bump RAM ke 4 GB+

---

## #12 Reset Total (Last Resort)

Kalau sistem benar-benar rusak dan tidak bisa di-fix:

### 12.1 Reset n8n Data

```powershell
# BACKUP DULU
Compress-Archive -Path "$env:USERPROFILE\.n8n" -DestinationPath "n8n-backup.zip"

# RESET
Remove-Item -Recurse -Force "$env:USERPROFILE\.n8n"
n8n start  # akan buat folder kosong baru
```

Lalu re-setup dari [SETUP.md §7](SETUP.md#7-setup-n8n).

### 12.2 Reset WAHA

```powershell
docker stop waha
docker rm waha
# Re-run docker run command
# Scan QR ulang
```

### 12.3 Reset Knowledge Base

```sql
-- HATI-HATI: ini hapus SEMUA dokumen!
TRUNCATE TABLE documents;
TRUNCATE TABLE ingested_files;
```

Lalu re-upload PDF dari dashboard.

### 12.4 Reset Frontend Build

```powershell
cd frontend
Remove-Item -Recurse -Force node_modules, dist
npm install
```

---

## Masih Tidak Teratasi?

Kumpulkan info berikut sebelum lapor:

1. **Gejala**: apa yang terjadi, kapan mulai
2. **Screenshot** error di n8n / terminal / browser console
3. **Log**:
   ```powershell
   docker logs waha --tail 200 > waha.log
   ```
4. **Status semua service** (URL #1–#7 di [Cek Cepat](#cek-cepat-health-check))
5. **Versi**:
   ```powershell
   node --version
   python --version
   n8n --version
   docker --version
   ```

Buka issue di repo GitHub atau hubungi developer.
