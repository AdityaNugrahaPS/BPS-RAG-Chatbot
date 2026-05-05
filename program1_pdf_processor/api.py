import os
import uuid
import json
import asyncio
import shutil
from pathlib import Path
from typing import Optional, Any
from concurrent.futures import ThreadPoolExecutor

from fastapi import FastAPI, UploadFile, File, HTTPException, BackgroundTasks
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse, Response
from pydantic import BaseModel

from processor import process_single_pdf, ProcessedFile
from embedder import init_gemini, embed_batch
from supabase_client import SupabaseRAG
from config import OUTPUT_DIR

app = FastAPI(title="BPS PDF Processor API", version="1.0.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173", "http://localhost:5174", "http://localhost:3000"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

JOBS: dict[str, dict] = {}
UPLOAD_DIR = Path("uploads_temp")
UPLOAD_DIR.mkdir(exist_ok=True)
executor = ThreadPoolExecutor(max_workers=2)



class ProcessRequest(BaseModel):
    job_id: str
    gemini_key: str
    chunk_size: int = 800
    chunk_overlap: int = 100
    use_ai_clean: bool = True
    model_id: Optional[str] = None       # Chat/table model — None = default dari config

class EmbedRequest(BaseModel):
    job_id: str
    gemini_key: str
    supabase_url: str
    supabase_key: str
    mode: str = "append"                 # "append" | "replace"
    embed_model_id: Optional[str] = None # Embedding model — None = gemini-embedding-001



def _job(job_id: str) -> dict:
    if job_id not in JOBS:
        raise HTTPException(status_code=404, detail=f"Job {job_id} tidak ditemukan")
    return JOBS[job_id]


def _run_process(job_id: str, gemini_key: str, chunk_size: int,
                 chunk_overlap: int, use_ai_clean: bool, model_id: str = None):
    job = JOBS[job_id]
    files = job["files"]
    results = []
    errors  = []
    n_files = len(files)

    for i, f in enumerate(files):
        file_base = round((i / n_files) * 100)
        file_top  = round(((i + 1) / n_files) * 100)

        # Tahapan dalam satu file → dibagi ke range [file_base, file_top]
        # extract=0-70%, tables=70-85%, clean+chunk=85-100%
        total_pages = [0]

        def make_progress(fb, ft):
            def on_progress(step, detail=""):
                if step == "extract":
                    try:
                        cur, tot = map(int, detail.split("/"))
                        if tot > 0:
                            total_pages[0] = tot
                            pct = fb + round((cur / tot) * (ft - fb) * 0.70)
                            job["process_progress"] = pct
                            job["process_step"] = f"Membaca halaman {cur}/{tot}…"
                    except Exception:
                        pass
                elif step == "tables":
                    job["process_step"] = f"Konversi tabel: {detail}"
                    try:
                        cur, tot = int(detail.split("/")[0].split()[-1]), int(detail.split("/")[1].split()[0])
                        pct = fb + round(0.70 * (ft - fb) + (cur / tot) * (ft - fb) * 0.15)
                        job["process_progress"] = pct
                    except Exception:
                        job["process_progress"] = fb + round(0.70 * (ft - fb))
                elif step == "chunk":
                    job["process_step"] = "Memotong teks menjadi chunks…"
                    job["process_progress"] = fb + round(0.85 * (ft - fb))
                elif step == "output":
                    job["process_step"] = "Menyiapkan output…"
                    job["process_progress"] = fb + round(0.95 * (ft - fb))
            return on_progress

        job["process_step"] = f"Memproses {f['name']}…"
        job["process_progress"] = file_base

        try:
            pf: ProcessedFile = process_single_pdf(
                pdf_path=f["path"],
                gemini_api_key=gemini_key if use_ai_clean else "",
                use_ai_tables=use_ai_clean,
                original_filename=f["name"],
                model_id=model_id,
                progress_callback=make_progress(file_base, file_top),
            )
            results.append({
                "filename":    pf.log.filename,
                "status":      pf.log.status,
                "chunks":      pf.log.total_chunks,
                "pages":       pf.log.total_pages,
                "time":        pf.log.processing_time,
                "chunks_data": pf.chunks,
            })
        except Exception as e:
            errors.append({"filename": f["name"], "error": str(e)})

    job["process_progress"] = 100
    job["process_step"]     = "Selesai"
    job["process_results"]  = results
    job["process_errors"]   = errors
    job["status"]           = "processed"


def _run_embed(job_id: str, gemini_key: str, supabase_url: str,
               supabase_key: str, mode: str, embed_model_id: str = None):
    job  = JOBS[job_id]
    results = job.get("process_results", [])

    try:
        init_gemini(gemini_key)
        db = SupabaseRAG(supabase_url, supabase_key)
    except Exception as e:
        job["embed_error"] = f"Init gagal: {e}"
        job["status"] = "embed_error"
        return

    total_chunks = sum(len(r.get("chunks_data", [])) for r in results)
    done = 0

    for r in results:
        chunks_data = r.get("chunks_data", [])
        if not chunks_data:
            continue

        filename = r["filename"]
        job["embed_step"] = f"Embed {filename}…"

        # replace mode: hapus dulu
        if mode == "replace":
            try:
                db.delete_file_documents(filename)
            except Exception:
                pass

        # embed
        texts = [c["content"] for c in chunks_data]
        try:
            def progress(n, t):
                nonlocal done
                done += 1
                job["embed_progress"] = round((done / total_chunks) * 100)

            embeddings = embed_batch(texts, progress_callback=progress, model_id=embed_model_id)
            inserted   = db.insert_documents(
                chunks=[{"content": c["content"], "metadata": c["metadata"]} for c in chunks_data],
                embeddings=embeddings,
            )
            r["embedded"] = inserted
            db.mark_file_ingested(filename, chunk_count=len(chunks_data))
        except Exception as e:
            r["embed_error"] = str(e)

    job["embed_progress"] = 100
    job["embed_step"]     = "Selesai"
    job["status"]         = "done"


@app.get("/health")
def health():
    return {"status": "ok"}


@app.get("/credentials")
def get_credentials():
    cred_path = Path(__file__).parent / ".credentials.json"
    if not cred_path.exists():
        return {"gemini_key": "", "supabase_url": "", "supabase_key": ""}
    try:
        data = json.loads(cred_path.read_text())
        return {
            "gemini_key":   data.get("gemini_key", ""),
            "supabase_url": data.get("supabase_url", ""),
            "supabase_key": data.get("supabase_key", ""),
        }
    except Exception:
        return {"gemini_key": "", "supabase_url": "", "supabase_key": ""}


ALL_CREDS_FILE = Path(__file__).parent / ".credentials_all.json"

class CredSaveRequest(BaseModel):
    id: str
    data: Any   # bisa dict (credential biasa) atau list (ai_models)

@app.get("/credentials/all")
def get_all_credentials():
    if not ALL_CREDS_FILE.exists():
        return {}
    try:
        return json.loads(ALL_CREDS_FILE.read_text(encoding="utf-8"))
    except Exception:
        return {}

@app.post("/credentials/save")
async def save_credential(req: CredSaveRequest, background_tasks: BackgroundTasks):
    try:
        existing = {}
        if ALL_CREDS_FILE.exists():
            existing = json.loads(ALL_CREDS_FILE.read_text(encoding="utf-8"))
        existing[req.id] = req.data
        ALL_CREDS_FILE.write_text(json.dumps(existing, indent=2, ensure_ascii=False), encoding="utf-8")
        # Sync ke n8n di background (tidak block response)
        if req.id in ("supabase", "ai_models"):
            background_tasks.add_task(_sync_credential_to_n8n, req.id, req.data, existing)
        return {"ok": True}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


async def _sync_credential_to_n8n(cred_id: str, data: Any, all_creds: dict):
    import httpx

    n8n     = all_creds.get("n8n", {})
    n8n_url = n8n.get("url", "").rstrip("/")
    n8n_key = n8n.get("api_key", "")
    if not n8n_url or not n8n_key:
        return  # n8n belum dikonfigurasi, skip

    hdrs = {"X-N8N-API-KEY": n8n_key, "Content-Type": "application/json"}

    async def fetch_workflow(wf_id: str):
        async with httpx.AsyncClient(timeout=10) as c:
            r = await c.get(f"{n8n_url}/api/v1/workflows/{wf_id}", headers=hdrs)
            return r.json() if r.status_code == 200 else None

    async def push_workflow(wf_id: str, wf: dict):
        payload = {k: wf[k] for k in ("name", "nodes", "connections", "settings", "staticData") if k in wf}
        async with httpx.AsyncClient(timeout=10) as c:
            await c.put(f"{n8n_url}/api/v1/workflows/{wf_id}", headers=hdrs, json=payload)

    n8n_creds = all_creds.get("n8n", {})
    wf_rag    = n8n_creds.get("workflow_rag", "")

    try:
        if cred_id == "supabase":
            if not wf_rag:
                return
            wf = await fetch_workflow(wf_rag)
            if not wf:
                return
            sb_url = (data.get("url", "") if isinstance(data, dict) else "").rstrip("/")
            sb_key = data.get("service_key", "") if isinstance(data, dict) else ""
            for node in wf.get("nodes", []):
                if node.get("id") == "rag-search":
                    node["parameters"]["url"] = f"{sb_url}/rest/v1/rpc/match_documents"
                    for h in node["parameters"].get("headerParameters", {}).get("parameters", []):
                        if h["name"] == "apikey":
                            h["value"] = sb_key
                        elif h["name"] == "Authorization":
                            h["value"] = f"Bearer {sb_key}"
            await push_workflow(wf_rag, wf)

        elif cred_id == "ai_models":
            if not wf_rag:
                return
            wf = await fetch_workflow(wf_rag)
            if not wf:
                return
            models = data if isinstance(data, list) else []
            if not models:
                return
            gemini_key   = models[0].get("api_key", "")
            gemini_model = models[0].get("model", "gemini-embedding-001")
            for node in wf.get("nodes", []):
                if node.get("id") == "rag-embed":
                    p = node["parameters"]
                    p["url"] = f"=https://generativelanguage.googleapis.com/v1beta/models/{gemini_model}:embedContent?key={gemini_key}"
            await push_workflow(wf_rag, wf)

    except Exception:
        pass  # Sync gagal tidak boleh crash — silent fail

@app.post("/credentials/test")
async def test_credential(req: CredSaveRequest):
    import httpx
    cid  = req.id
    data = req.data

    try:
        if cid == "supabase":
            url = data.get("url", "").rstrip("/")
            key = data.get("service_key", "")
            if not url or not key:
                return {"ok": False, "message": "URL dan Service Key wajib diisi"}
            async with httpx.AsyncClient(timeout=8) as client:
                r = await client.get(
                    f"{url}/rest/v1/",
                    headers={"apikey": key, "Authorization": f"Bearer {key}"},
                )
            if r.status_code < 400:
                return {"ok": True,  "message": f"Supabase terhubung ✓ (status {r.status_code})"}
            return {"ok": False, "message": f"Supabase error: {r.status_code}"}

        elif cid in ("gemini_embed", "gemini_chat"):
            key   = data.get("api_key", "")
            model = data.get("model", "models/gemini-embedding-001") if cid == "gemini_embed" else data.get("model", "models/gemini-1.5-flash")
            if not key:
                return {"ok": False, "message": "API Key wajib diisi"}
            endpoint = f"https://generativelanguage.googleapis.com/v1beta/{model}:{'embedContent' if cid == 'gemini_embed' else 'generateContent'}?key={key}"
            body = (
                {"content": {"parts": [{"text": "test"}]}, "outputDimensionality": 8}
                if cid == "gemini_embed"
                else {"contents": [{"parts": [{"text": "Hi"}]}]}
            )
            async with httpx.AsyncClient(timeout=10) as client:
                r = await client.post(endpoint, json=body)
            if r.status_code == 200:
                return {"ok": True,  "message": f"Gemini API valid ✓ (model: {model})"}
            err = r.json().get("error", {}).get("message", r.text[:120])
            return {"ok": False, "message": f"Gemini error: {err}"}

        elif cid == "waha":
            url = data.get("url", "").rstrip("/")
            key = data.get("api_key", "")
            if not url:
                return {"ok": False, "message": "URL wajib diisi"}
            async with httpx.AsyncClient(timeout=6) as client:
                r = await client.get(f"{url}/api/version", headers={"X-Api-Key": key})
            if r.status_code == 200:
                ver = r.json().get("version", "?")
                return {"ok": True, "message": f"WAHA terhubung ✓ (v{ver})"}
            return {"ok": False, "message": f"WAHA error: {r.status_code}"}

        elif cid == "n8n":
            url = data.get("url", "").rstrip("/")
            key = data.get("api_key", "")
            if not url:
                return {"ok": False, "message": "URL wajib diisi"}
            async with httpx.AsyncClient(timeout=6) as client:
                r = await client.get(f"{url}/api/v1/workflows?limit=1", headers={"X-N8N-API-KEY": key})
            if r.status_code == 200:
                return {"ok": True, "message": "n8n terhubung ✓"}
            return {"ok": False, "message": f"n8n error: {r.status_code}"}

        elif cid == "bps_api":
            base = data.get("base_url", "https://webapi.bps.go.id/v1/api/").rstrip("/")
            key  = data.get("api_key", "")
            if not key:
                return {"ok": False, "message": "API Key wajib diisi"}
            async with httpx.AsyncClient(timeout=8) as client:
                r = await client.get(f"{base}/list/model/domain/domain/0000/key/{key}/")
            if r.status_code == 200:
                return {"ok": True, "message": "BPS API valid ✓"}
            return {"ok": False, "message": f"BPS API error: {r.status_code}"}

        else:
            return {"ok": None, "message": "Test belum tersedia untuk credential ini"}

    except Exception as e:
        return {"ok": False, "message": f"Error: {str(e)}"}


@app.post("/upload")
async def upload_files(files: list[UploadFile] = File(...)):
    job_id  = str(uuid.uuid4())[:8]
    job_dir = UPLOAD_DIR / job_id
    job_dir.mkdir(parents=True, exist_ok=True)

    saved = []
    for uf in files:
        if not uf.filename.lower().endswith(".pdf"):
            continue
        dest = job_dir / uf.filename
        with open(dest, "wb") as fp:
            shutil.copyfileobj(uf.file, fp)
        saved.append({"name": uf.filename, "path": str(dest), "size": dest.stat().st_size})

    if not saved:
        raise HTTPException(status_code=400, detail="Tidak ada file PDF yang valid")

    JOBS[job_id] = {
        "job_id":           job_id,
        "status":           "uploaded",
        "files":            saved,
        "process_progress": 0,
        "process_step":     "",
        "process_results":  [],
        "process_errors":   [],
        "embed_progress":   0,
        "embed_step":       "",
    }

    return {"job_id": job_id, "files": [s["name"] for s in saved], "count": len(saved)}


@app.post("/process")
async def process_pdfs(req: ProcessRequest, background_tasks: BackgroundTasks):
    job = _job(req.job_id)
    if job["status"] not in ("uploaded", "processed"):
        raise HTTPException(status_code=400, detail=f"Status tidak valid: {job['status']}")

    job["status"]           = "processing"
    job["process_progress"] = 0
    job["process_step"]     = "Memulai…"

    background_tasks.add_task(
        _run_process,
        req.job_id, req.gemini_key,
        req.chunk_size, req.chunk_overlap, req.use_ai_clean, req.model_id,
    )
    return {"job_id": req.job_id, "status": "processing"}


@app.post("/embed")
async def embed_to_supabase(req: EmbedRequest, background_tasks: BackgroundTasks):
    job = _job(req.job_id)
    if job["status"] != "processed":
        raise HTTPException(status_code=400, detail="Proses PDF dulu sebelum embed")

    job["status"]         = "embedding"
    job["embed_progress"] = 0
    job["embed_step"]     = "Memulai…"

    background_tasks.add_task(
        _run_embed,
        req.job_id, req.gemini_key,
        req.supabase_url, req.supabase_key, req.mode, req.embed_model_id,
    )
    return {"job_id": req.job_id, "status": "embedding"}


@app.get("/status/{job_id}")
def get_status(job_id: str):
    job = _job(job_id)
    return {
        "job_id":           job["job_id"],
        "status":           job["status"],
        "files":            [f["name"] for f in job["files"]],
        "process_progress": job["process_progress"],
        "process_step":     job["process_step"],
        "process_results":  [
            {k: v for k, v in r.items() if k != "chunks_data"}
            for r in job["process_results"]
        ],
        "process_errors":   job["process_errors"],
        "embed_progress":   job["embed_progress"],
        "embed_step":       job["embed_step"],
    }


@app.get("/download-chunks/{job_id}")
def download_chunks(job_id: str):
    job = _job(job_id)
    if job["status"] not in ("processed", "embedding", "done", "embed_error"):
        raise HTTPException(status_code=400, detail="Proses PDF dulu sebelum download")

    results = job.get("process_results", [])
    if not results:
        raise HTTPException(status_code=404, detail="Tidak ada hasil proses")

    first_name = results[0].get("filename", "chunks")
    stem = Path(first_name).stem
    output_name = f"{stem}.json"

    payload = {
        "source_files": [r["filename"] for r in results],
        "chunk_size":   job.get("chunk_size"),
        "overlap":      job.get("chunk_overlap"),
        "files": [
            {
                "filename": r["filename"],
                "chunks":   r.get("chunks_data", []),
                "pages":    r.get("pages"),
            }
            for r in results
        ],
    }

    content = json.dumps(payload, ensure_ascii=False, indent=2)
    return Response(
        content=content.encode("utf-8"),
        media_type="application/json",
        headers={"Content-Disposition": f'attachment; filename="{output_name}"'},
    )


@app.post("/upload-json")
async def upload_json(file: UploadFile = File(...)):
    if not file.filename.lower().endswith(".json"):
        raise HTTPException(status_code=400, detail="Harus file .json")

    raw = await file.read()
    try:
        data = json.loads(raw.decode("utf-8"))
    except Exception:
        raise HTTPException(status_code=400, detail="JSON tidak valid")

    files_data = data.get("files")
    if not files_data or not isinstance(files_data, list):
        raise HTTPException(status_code=400, detail="Format JSON tidak dikenal — pastikan dari hasil Download Chunks")

    job_id = str(uuid.uuid4())[:8]
    results = []
    for f in files_data:
        chunks_data = f.get("chunks", [])
        results.append({
            "filename":   f.get("filename", file.filename),
            "status":     "success",
            "chunks":     len(chunks_data),
            "pages":      f.get("pages", 0),
            "time":       0,
            "chunks_data": chunks_data,
        })

    JOBS[job_id] = {
        "job_id":           job_id,
        "status":           "processed",
        "files":            [{"name": f["filename"], "path": "", "size": 0} for f in results],
        "chunk_size":       data.get("chunk_size"),
        "chunk_overlap":    data.get("overlap"),
        "process_progress": 100,
        "process_step":     "Dimuat dari JSON",
        "process_results":  results,
        "process_errors":   [],
        "embed_progress":   0,
        "embed_step":       "",
    }

    return {
        "job_id": job_id,
        "files":  [r["filename"] for r in results],
        "chunks": sum(r["chunks"] for r in results),
        "count":  len(results),
    }


@app.delete("/job/{job_id}")
def delete_job(job_id: str):
    _job(job_id)
    job_dir = UPLOAD_DIR / job_id
    if job_dir.exists():
        shutil.rmtree(job_dir)
    del JOBS[job_id]
    return {"deleted": job_id}


if __name__ == "__main__":
    import uvicorn
    uvicorn.run("api:app", host="0.0.0.0", port=8503, reload=False)
