"""
Metadata Extractor — Extract metadata otomatis dari nama file dan konten PDF BPS.
Mengambil tahun data, tahun terbit, topik, dan wilayah.
"""

import re
from config import TOPIC_KEYWORDS


def extract_from_filename(filename: str) -> dict:
    """
    Extract metadata dari nama file BPS.

    Pola umum nama file BPS:
    - "2024_Statistik Pendidikan Kota Pekanbaru 2023.pdf"
    - "Kota Pekanbaru Dalam Angka 2026.pdf"
    - "PDRB Kota Pekanbaru 2021-2025.pdf"
    - "Statistik Daerah Kota Pekanbaru 2025.pdf"
    """
    meta = {
        "fileName": filename,
        "tahun_terbit": "",
        "tahun_data": "",
        "topik": "",
        "wilayah": "Kota Pekanbaru",  # Default untuk project ini
    }

    name = filename.replace('.pdf', '').replace('.PDF', '')

    # Pola 1: "2024_Judul Buku 2023" — tahun pertama = terbit, tahun kedua = data
    match = re.match(r'^(\d{4})[_\s]+(.+?)[\s]*(\d{4})?\s*$', name)
    if match:
        meta["tahun_terbit"] = match.group(1)
        if match.group(3):
            meta["tahun_data"] = match.group(3)
        else:
            meta["tahun_data"] = match.group(1)

    # Pola 2: "Judul 2021-2025" — range tahun
    if not meta["tahun_data"]:
        range_match = re.search(r'(\d{4})\s*[-–]\s*(\d{4})', name)
        if range_match:
            meta["tahun_data"] = f"{range_match.group(1)}-{range_match.group(2)}"
            meta["tahun_terbit"] = range_match.group(2)

    # Pola 3: hanya satu tahun di nama
    if not meta["tahun_data"]:
        year_match = re.search(r'(\d{4})', name)
        if year_match:
            year = year_match.group(1)
            meta["tahun_data"] = year
            meta["tahun_terbit"] = year

    # Extract topik dari kata kunci
    meta["topik"] = detect_topic(name)

    return meta


def detect_topic(text: str) -> str:
    """Deteksi topik dari teks berdasarkan kata kunci BPS."""
    text_lower = text.lower()

    # Buku "Dalam Angka" / "Statistik Daerah" mencakup semua topik → statistik_umum
    if any(kw in text_lower for kw in ['dalam angka', 'statistik daerah', 'in figures', 'profil daerah']):
        return "statistik_umum"

    # Hitung skor setiap topik
    scores: dict[str, int] = {}
    for topic, keywords in TOPIC_KEYWORDS.items():
        score = sum(1 for kw in keywords if kw in text_lower)
        if score > 0:
            scores[topic] = score

    if not scores:
        return "umum"

    # Return topik dengan skor tertinggi
    return max(scores, key=scores.get)


def extract_from_content(text: str, existing_meta: dict) -> dict:
    """
    Perkaya metadata dari konten PDF (halaman awal).
    Melengkapi metadata yang belum ditemukan dari filename.
    """
    meta = existing_meta.copy()
    sample = text[:5000]  # Ambil 5000 karakter pertama untuk analisis

    # Deteksi topik dari konten (lebih andal dari filename untuk PDF bilingual)
    topic_from_content = detect_topic(sample.lower())
    if topic_from_content != "umum":
        meta["topik"] = topic_from_content
    elif meta.get("topik") == "umum" or not meta.get("topik"):
        meta["topik"] = topic_from_content

    # Cari tahun data dari konten jika belum ada
    if not meta.get("tahun_data"):
        # Pola umum di PDF BPS: "2026", "Tahun 2025", "Volume 22, 2026"
        patterns = [
            r'(?:tahun|data|periode|year)\s+(\d{4})',
            r'dalam\s+angka\s+(\d{4})',
            r'in\s+figures\s+(\d{4})',
            r'volume\s+\d+[,\s]+(\d{4})',
            r',\s*(\d{4})\s*$',
        ]
        for pattern in patterns:
            m = re.search(pattern, sample, re.IGNORECASE | re.MULTILINE)
            if m:
                year = m.group(1)
                if 2000 <= int(year) <= 2030:
                    meta["tahun_data"] = year
                    break

    # Cari tahun terbit jika belum ada
    if not meta.get("tahun_terbit"):
        # Cari pola bulan+tahun seperti "February 2025" atau "Februari 2025"
        month_year = re.search(
            r'(?:januari|februari|maret|april|mei|juni|juli|agustus|september|oktober|november|desember|'
            r'january|february|march|april|may|june|july|august|september|october|november|december)'
            r'\s+(\d{4})',
            sample, re.IGNORECASE
        )
        if month_year:
            meta["tahun_terbit"] = month_year.group(1)
        elif meta.get("tahun_data"):
            meta["tahun_terbit"] = meta["tahun_data"]

    # Deteksi wilayah spesifik (kecamatan)
    kecamatan_list = [
        'Tampan', 'Marpoyan Damai', 'Tenayan Raya', 'Payung Sekaki',
        'Bukit Raya', 'Sail', 'Senapelan', 'Sukajadi', 'Pekanbaru Kota',
        'Lima Puluh', 'Rumbai', 'Rumbai Barat', 'Kulim',
        'Tuah Madani', 'Binawidya',
    ]
    found_kecamatan = []
    sample_text = text[:5000]
    for kec in kecamatan_list:
        if kec.lower() in sample_text.lower():
            found_kecamatan.append(kec)

    if found_kecamatan:
        meta["kecamatan_mentioned"] = found_kecamatan

    return meta


def enrich_chunk_metadata(chunk_text: str, file_meta: dict, chunk_index: int, page_num: int) -> dict:
    """
    Buat metadata lengkap untuk satu chunk.
    Gabungkan metadata file dengan informasi spesifik chunk.
    """
    meta = {
        "fileName": file_meta.get("fileName", ""),
        "tahun_data": file_meta.get("tahun_data", ""),
        "tahun_terbit": file_meta.get("tahun_terbit", ""),
        "topik": file_meta.get("topik", ""),
        "wilayah": file_meta.get("wilayah", "Kota Pekanbaru"),
        "chunkIndex": chunk_index,
        "halaman": page_num,
        "tipe": "teks",
    }

    # Deteksi apakah chunk ini berisi data tabel
    if any(kw in chunk_text.lower() for kw in ['jumlah penduduk', 'sebanyak', 'terdiri dari', 'masing-masing']):
        meta["tipe"] = "tabel_converted"

    return meta
