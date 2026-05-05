import os
import json
import time
from dataclasses import dataclass, field

from pdf_extractor import extract_pdf, ExtractionResult, ExtractedTable
from text_cleaner import clean_text
from table_converter import convert_tables_batch, convert_table_simple
from metadata_extractor import extract_from_filename, extract_from_content, enrich_chunk_metadata
from chunker import chunk_text, Chunk
from config import OUTPUT_DIR, MIN_TEXT_LENGTH


@dataclass
class ProcessingLog:
    filename: str
    status: str  # "success", "scan", "error", "skipped"
    message: str
    total_pages: int = 0
    scan_pages: int = 0
    total_tables: int = 0
    tables_converted: int = 0
    total_chunks: int = 0
    total_chars: int = 0
    processing_time: float = 0.0

    def to_dict(self):
        return {
            "filename": self.filename,
            "status": self.status,
            "message": self.message,
            "total_pages": self.total_pages,
            "scan_pages": self.scan_pages,
            "total_tables": self.total_tables,
            "tables_converted": self.tables_converted,
            "total_chunks": self.total_chunks,
            "total_chars": self.total_chars,
            "processing_time": round(self.processing_time, 2),
        }


@dataclass
class ProcessedFile:
    filename: str
    metadata: dict
    chunks: list[dict]
    log: ProcessingLog

    def to_dict(self):
        return {
            "file": self.filename,
            "metadata": self.metadata,
            "total_chunks": len(self.chunks),
            "chunks": self.chunks,
        }


def process_single_pdf(
    pdf_path: str,
    gemini_api_key: str = "",
    use_ai_tables: bool = True,
    progress_callback=None,
    original_filename: str = "",
    model_id: str = None,
) -> ProcessedFile:
    start_time = time.time()
    filename = original_filename if original_filename else os.path.basename(pdf_path)

    def _progress(step, detail=""):
        if progress_callback:
            progress_callback(step, detail)

    _progress("extract", "0/0")
    def on_extract_page(cur, tot):
        _progress("extract", f"{cur}/{tot}")

    try:
        result: ExtractionResult = extract_pdf(pdf_path, filename, page_callback=on_extract_page)
    except Exception as e:
        log = ProcessingLog(filename, "error", f"Gagal extract PDF: {str(e)}")
        log.processing_time = time.time() - start_time
        return ProcessedFile(filename, {}, [], log)

    # Cek apakah PDF scan
    if result.is_scan:
        log = ProcessingLog(
            filename, "scan",
            f"PDF terdeteksi sebagai scan ({len(result.scan_pages)}/{result.total_pages} halaman scan)",
            total_pages=result.total_pages,
            scan_pages=len(result.scan_pages),
        )
        log.processing_time = time.time() - start_time
        return ProcessedFile(filename, {}, [], log)

    # Cek apakah teks cukup
    if result.total_chars < MIN_TEXT_LENGTH:
        log = ProcessingLog(
            filename, "skipped",
            f"Teks terlalu sedikit ({result.total_chars} karakter)",
            total_pages=result.total_pages,
            total_chars=result.total_chars,
        )
        log.processing_time = time.time() - start_time
        return ProcessedFile(filename, {}, [], log)

    _progress("metadata", "Mengekstrak metadata...")
    file_meta = extract_from_filename(filename)

    all_text = "\n".join(p.text for p in result.pages if p.text)
    file_meta = extract_from_content(all_text, file_meta)

    all_tables = []
    for page in result.pages:
        all_tables.extend(page.tables)

    converted_tables: dict[int, list[str]] = {}
    tables_converted_count = 0

    if all_tables:
        _progress("tables", f"Mengkonversi {len(all_tables)} tabel...")

        if use_ai_tables and gemini_api_key:
            try:
                converted_tables = convert_tables_batch(
                    all_tables, gemini_api_key,
                    progress_callback=lambda cur, tot: _progress(
                        "tables", f"Tabel {cur}/{tot}..."
                    ),
                    model_id=model_id,
                )
                tables_converted_count = sum(len(v) for v in converted_tables.values())
            except Exception as e:
                _progress("tables", f"Gemini error, fallback ke simple: {e}")
                for table in all_tables:
                    converted = convert_table_simple(table)
                    if table.page_num not in converted_tables:
                        converted_tables[table.page_num] = []
                    converted_tables[table.page_num].append(converted)
                    tables_converted_count += 1
        else:
            for table in all_tables:
                converted = convert_table_simple(table)
                if table.page_num not in converted_tables:
                    converted_tables[table.page_num] = []
                converted_tables[table.page_num].append(converted)
                tables_converted_count += 1

    _progress("clean", "Membersihkan teks...")

    page_texts = []
    page_mapping = []
    current_pos = 0

    for page in result.pages:
        if page.page_num in result.scan_pages:
            continue

        cleaned = clean_text(page.text)

        if page.page_num in converted_tables:
            for table_text in converted_tables[page.page_num]:
                cleaned += "\n\n" + table_text

        if cleaned.strip():
            page_mapping.append((current_pos, page.page_num))
            page_texts.append(cleaned)
            current_pos += len(cleaned) + 2

    full_text = "\n\n".join(page_texts)

    _progress("chunk", "Memecah teks menjadi chunks...")

    context_prefix = file_meta.get("fileName", filename)
    chunks: list[Chunk] = chunk_text(
        full_text,
        page_mapping=page_mapping,
        context_prefix=context_prefix,
    )

    _progress("output", "Menyiapkan output...")

    output_chunks = []
    for chunk in chunks:
        chunk_meta = enrich_chunk_metadata(
            chunk.content, file_meta, chunk.index, chunk.page_start
        )
        output_chunks.append({
            "index": chunk.index,
            "content": chunk.content,
            "metadata": chunk_meta,
            "char_count": chunk.char_count,
        })

    elapsed = time.time() - start_time
    log = ProcessingLog(
        filename=filename,
        status="success",
        message=f"Berhasil: {len(output_chunks)} chunks dari {result.total_pages} halaman",
        total_pages=result.total_pages,
        scan_pages=len(result.scan_pages),
        total_tables=len(all_tables),
        tables_converted=tables_converted_count,
        total_chunks=len(output_chunks),
        total_chars=sum(c["char_count"] for c in output_chunks),
        processing_time=elapsed,
    )

    return ProcessedFile(
        filename=filename,
        metadata=file_meta,
        chunks=output_chunks,
        log=log,
    )


def process_batch(
    pdf_paths: list[str],
    gemini_api_key: str = "",
    use_ai_tables: bool = True,
    progress_callback=None,
) -> tuple[list[ProcessedFile], list[ProcessingLog]]:
    results = []
    logs = []

    for i, pdf_path in enumerate(pdf_paths):
        filename = os.path.basename(pdf_path)

        def file_progress(step, detail=""):
            if progress_callback:
                progress_callback(i, len(pdf_paths), filename, step, detail)

        processed = process_single_pdf(
            pdf_path, gemini_api_key, use_ai_tables,
            progress_callback=file_progress,
        )
        results.append(processed)
        logs.append(processed.log)

    return results, logs


def save_dataset(
    processed_files: list[ProcessedFile],
    output_path: str = "",
) -> str:
    if not output_path:
        os.makedirs(OUTPUT_DIR, exist_ok=True)
        timestamp = time.strftime("%Y%m%d_%H%M%S")
        output_path = os.path.join(OUTPUT_DIR, f"dataset_{timestamp}.json")

    dataset = {
        "generated_at": time.strftime("%Y-%m-%d %H:%M:%S"),
        "total_files": len(processed_files),
        "total_chunks": sum(len(f.chunks) for f in processed_files),
        "files": [f.to_dict() for f in processed_files if f.chunks],
    }

    with open(output_path, 'w', encoding='utf-8') as f:
        json.dump(dataset, f, ensure_ascii=False, indent=2)

    return output_path


def save_logs(logs: list[ProcessingLog], output_path: str = "") -> str:
    """Simpan log pemrosesan ke file JSON."""
    if not output_path:
        os.makedirs(OUTPUT_DIR, exist_ok=True)
        timestamp = time.strftime("%Y%m%d_%H%M%S")
        output_path = os.path.join(OUTPUT_DIR, f"log_{timestamp}.json")

    log_data = {
        "generated_at": time.strftime("%Y-%m-%d %H:%M:%S"),
        "summary": {
            "total": len(logs),
            "success": sum(1 for l in logs if l.status == "success"),
            "scan": sum(1 for l in logs if l.status == "scan"),
            "error": sum(1 for l in logs if l.status == "error"),
            "skipped": sum(1 for l in logs if l.status == "skipped"),
        },
        "files": [l.to_dict() for l in logs],
    }

    with open(output_path, 'w', encoding='utf-8') as f:
        json.dump(log_data, f, ensure_ascii=False, indent=2)

    return output_path
