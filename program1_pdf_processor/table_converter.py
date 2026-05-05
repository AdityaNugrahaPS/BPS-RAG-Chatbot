"""
Table Converter — Konversi tabel ke kalimat natural menggunakan Gemini AI.
Tabel yang diekstrak pdfplumber dikirim ke Gemini untuk dijadikan paragraf.
"""

import time
import google.generativeai as genai
from pdf_extractor import ExtractedTable
from config import GEMINI_MODEL


def _build_table_text(table: ExtractedTable) -> str:
    """Format tabel menjadi teks yang readable untuk prompt Gemini."""
    lines = []
    if table.title:
        lines.append(f"Judul: {table.title}")
    if table.headers:
        lines.append("Kolom: " + " | ".join(table.headers))
    lines.append("Data:")
    for row in table.rows[:30]:  # Batasi 30 baris agar tidak terlalu panjang
        lines.append("  " + " | ".join(row))
    if len(table.rows) > 30:
        lines.append(f"  ... ({len(table.rows) - 30} baris lagi)")
    return "\n".join(lines)


def is_useless_table(table: ExtractedTable) -> bool:
    """
    Cek apakah tabel tidak layak dikirim ke Gemini AI.
    Skip tabel yang: terlalu kecil, kosong, atau tidak informatif.
    """
    # Tabel tanpa data sama sekali
    if not table.rows:
        return True

    # Hitung total sel yang tidak kosong
    non_empty_cells = sum(
        1 for row in table.rows
        for cell in row
        if cell and str(cell).strip()
    )

    # Tabel dengan < 4 sel berisi = tidak informatif
    if non_empty_cells < 4:
        return True

    # Tabel dengan hanya 1 baris (bukan header) = biasanya label/caption
    if len(table.rows) < 2:
        return True

    # Tabel dengan hanya 1 kolom = biasanya bukan tabel data
    max_cols = max(len(row) for row in table.rows)
    if max_cols < 2:
        return True

    # Hitung kolom yang berisi hanya angka (tabel statistik valid)
    total_cells = sum(len(row) for row in table.rows)
    if total_cells == 0:
        return True

    return False


CONVERSION_PROMPT = """Kamu adalah ahli statistik BPS Indonesia.

Konversi tabel berikut menjadi paragraf kalimat natural dalam Bahasa Indonesia yang informatif dan mudah dipahami.

ATURAN:
1. Sebutkan semua angka dan fakta penting dari tabel
2. Gunakan kalimat lengkap, bukan format tabel
3. Sebutkan konteks: wilayah, tahun, satuan jika ada
4. Jika ada data per kecamatan/wilayah, sebutkan masing-masing
5. Tulis dalam 1-3 paragraf saja, padat dan informatif
6. Jangan tambahkan analisis atau opini — hanya sajikan fakta dari tabel
7. Jangan gunakan format markdown, bullet, atau tabel — hanya paragraf biasa

TABEL:
{table_text}

PARAGRAF:"""


def convert_table_to_text(table: ExtractedTable, model: genai.GenerativeModel) -> str:
    """Konversi satu tabel ke kalimat natural menggunakan Gemini."""
    table_text = _build_table_text(table)

    prompt = CONVERSION_PROMPT.format(table_text=table_text)

    try:
        response = model.generate_content(
            prompt,
            generation_config=genai.types.GenerationConfig(
                temperature=0.1,  # Low temperature — factual, tidak kreatif
                max_output_tokens=1000,
            )
        )
        return response.text.strip()
    except Exception as e:
        # Fallback: return raw text jika Gemini gagal
        return f"[Tabel: {table.title}]\n{table.raw_text}"


def convert_tables_batch(
    tables: list[ExtractedTable],
    api_key: str,
    progress_callback=None,
    model_id: str = None,
) -> dict[int, list[str]]:
    """
    Konversi batch tabel ke kalimat natural.

    Args:
        tables: List tabel dari semua halaman
        api_key: Gemini API key
        progress_callback: Optional callback(current, total) untuk progress bar
        model_id: Model ID yang dipakai (default: GEMINI_MODEL dari config)

    Returns:
        Dict[page_num, list[converted_text]] — teks hasil konversi per halaman
    """
    if not tables:
        return {}

    genai.configure(api_key=api_key)
    model = genai.GenerativeModel(model_id or GEMINI_MODEL)

    results: dict[int, list[str]] = {}
    total = len(tables)

    for i, table in enumerate(tables):
        converted = convert_table_to_text(table, model)

        if table.page_num not in results:
            results[table.page_num] = []
        results[table.page_num].append(converted)

        if progress_callback:
            progress_callback(i + 1, total)

    return results


def convert_table_simple(table: ExtractedTable) -> str:
    """
    Konversi tabel ke teks tanpa AI (fallback sederhana).
    Digunakan jika Gemini API tidak tersedia.
    """
    lines = []
    if table.title:
        lines.append(table.title)

    headers = table.headers
    for row in table.rows:
        parts = []
        for j, cell in enumerate(row):
            if cell and j < len(headers) and headers[j]:
                parts.append(f"{headers[j]}: {cell}")
            elif cell:
                parts.append(cell)
        if parts:
            lines.append(". ".join(parts) + ".")

    return "\n".join(lines)
