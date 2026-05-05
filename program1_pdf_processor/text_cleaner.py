"""
Text Cleaner — Bersihkan noise dari teks PDF BPS.
Menghapus URL, header/footer berulang, nomor halaman, daftar isi, dll.
"""

import re
from config import NOISE_PATTERNS


def remove_noise(text: str) -> str:
    """Hapus pola-pola noise yang umum di PDF BPS."""
    for pattern in NOISE_PATTERNS:
        text = re.sub(pattern, '', text, flags=re.MULTILINE)
    return text


def remove_toc_lines(text: str) -> str:
    """Hapus baris daftar isi (pola: judul .... nomor halaman)."""
    lines = text.split('\n')
    cleaned = []
    for line in lines:
        stripped = line.strip()
        # Pola daftar isi: ada dots berulang atau banyak spasi diikuti angka
        if re.match(r'^.{5,}\s*\.{4,}\s*\d+\s*$', stripped):
            continue
        # Pola: teks lalu spasi banyak lalu angka
        if re.match(r'^.{5,}\s{5,}\d+\s*$', stripped):
            continue
        cleaned.append(line)
    return '\n'.join(cleaned)


def remove_repeated_headers(text: str) -> str:
    """Deteksi dan hapus header/footer yang muncul berulang di banyak halaman."""
    lines = text.split('\n')
    if len(lines) < 20:
        return text

    # Hitung frekuensi setiap baris (setelah strip)
    line_counts: dict[str, int] = {}
    for line in lines:
        stripped = line.strip()
        if len(stripped) > 5 and len(stripped) < 100:
            line_counts[stripped] = line_counts.get(stripped, 0) + 1

    # Baris yang muncul > 3x kemungkinan header/footer
    repeated = {line for line, count in line_counts.items() if count > 3}

    if not repeated:
        return text

    cleaned = []
    for line in lines:
        if line.strip() not in repeated:
            cleaned.append(line)
    return '\n'.join(cleaned)


def normalize_whitespace(text: str) -> str:
    """Normalisasi whitespace: hapus baris kosong berlebihan, trim spasi."""
    # Ganti multiple newlines dengan max 2
    text = re.sub(r'\n{3,}', '\n\n', text)
    # Ganti multiple spaces dengan satu
    text = re.sub(r'[^\S\n]{2,}', ' ', text)
    # Trim setiap baris
    lines = [line.strip() for line in text.split('\n')]
    return '\n'.join(lines)


def remove_page_artifacts(text: str) -> str:
    """Hapus artefak halaman seperti nomor halaman tunggal dan garis pemisah."""
    lines = text.split('\n')
    cleaned = []
    for line in lines:
        stripped = line.strip()
        # Skip baris yang hanya angka (nomor halaman)
        if re.match(r'^\d{1,4}$', stripped):
            continue
        # Skip baris yang hanya simbol pemisah
        if re.match(r'^[-_=~*]{3,}$', stripped):
            continue
        # Skip baris copyright/source berulang
        if 'sumber:' in stripped.lower() and len(stripped) < 60:
            continue
        cleaned.append(line)
    return '\n'.join(cleaned)


def remove_watermark_chars(text: str) -> str:
    """
    Hapus karakter watermark/hidden text yang tersisip di tengah konten tabel.
    Pola: karakter huruf tunggal yang muncul di antara angka atau separator tabel.
    Contoh: "125.43d\n2i" → "125.432"
    """
    lines = text.split('\n')
    cleaned_lines = []
    for line in lines:
        stripped = line.strip()
        # Jika baris hanya 1 huruf (watermark sisa), skip
        if re.match(r'^[a-zA-Z]$', stripped):
            continue
        # Hapus huruf tunggal yang tersisip di antara angka/simbol tabel
        # Pola: digit/separator lalu huruf tunggal lalu newline/digit
        line = re.sub(r'(\d)([a-zA-Z])(\n)', r'\1\3', line)
        line = re.sub(r'(\|)\s*([a-zA-Z])\s*(\n)', r'\1\3', line)
        cleaned_lines.append(line)
    return '\n'.join(cleaned_lines)


def clean_text(text: str) -> str:
    """
    Pipeline utama text cleaning untuk satu blok teks.
    Urutan cleaning penting — jangan diubah tanpa testing.
    """
    text = remove_toc_lines(text)
    text = remove_noise(text)
    text = remove_watermark_chars(text)
    text = remove_repeated_headers(text)
    text = remove_page_artifacts(text)
    text = normalize_whitespace(text)
    return text.strip()


def clean_page_texts(pages_text: list[str]) -> list[str]:
    """Bersihkan teks dari banyak halaman sekaligus."""
    return [clean_text(t) for t in pages_text]
