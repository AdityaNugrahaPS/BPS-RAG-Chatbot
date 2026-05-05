"""
Smart Chunker — Memecah teks PDF menjadi chunks berdasarkan section/heading.
Tidak memotong di tengah kalimat atau paragraf.
"""

import re
from dataclasses import dataclass
from config import HEADING_PATTERNS, MAX_CHUNK_SIZE, CHUNK_OVERLAP, MIN_CHUNK_SIZE

# Pola chunk yang tidak berguna untuk RAG
USELESS_PATTERNS = [
    r'^[\s\-–\.…|/:\\]+$',                      # Hanya simbol/separator
    r'^\d+[\s\-–\.]+\d+$',                       # Hanya angka dan separator
]

# Keyword yang menandakan chunk ini adalah metadata buku, bukan data
SKIP_KEYWORDS = [
    'manuscript drafter', 'penyusun naskah', 'penyunting/editor',
    'cover designer', 'pembuat kover', 'dilarang mereproduksi',
    'it is prohibited to reproduce', 'isbn', 'issn',
    'nomor publikasi', 'publication number', 'ukuran buku', 'book size',
    'jumlah halaman', 'number of pages',
    'tim penyusun', 'compilers', 'pengarah/director',
    'penata letak', 'layouters', 'penerjemah/translators',
    'freepik.com', 'flaticon.com',
]


def _is_toc_content(text: str) -> bool:
    """
    Deteksi apakah teks adalah isi Daftar Isi (TOC).
    TOC biasanya berisi baris judul + titik-titik di akhir baris.
    """
    # Gunakan hanya baris "bermakna" (>10 char) untuk menghindari
    # false negative dari PDF yang memecah kata per baris
    meaningful = [l.strip() for l in text.split('\n') if len(l.strip()) > 10]
    if len(meaningful) < 2:
        return False

    # Pola: baris yang DIAKHIRI titik-titik (khas entry daftar isi)
    toc_end_pattern = re.compile(r'\.{3,}\s*\d*\s*$|…{2,}\s*\d*\s*$')
    dot_lines = [l for l in meaningful if toc_end_pattern.search(l)]
    dot_count = len(dot_lines)

    # Case 1: 2+ baris bermakna dengan trailing dots → pasti TOC listing
    if dot_count >= 2:
        return True

    # Case 2: 1 baris dots + sedikit baris bermakna → single TOC entry
    if dot_count == 1 and len(meaningful) <= 5:
        return True

    # Case 3: rasio dot lines tinggi di chunk panjang
    if len(meaningful) > 5 and dot_count / len(meaningful) > 0.20:
        return True

    return False


def is_useless_chunk(text: str, min_size: int = 200) -> bool:
    """
    Cek apakah chunk tidak berguna untuk RAG.
    Returns True jika chunk harus di-skip.
    """
    stripped = text.strip()

    # Terlalu pendek
    if len(stripped) < min_size:
        return True

    # Hanya simbol/separator
    for pattern in USELESS_PATTERNS:
        if re.match(pattern, stripped):
            return True

    # Hitung rasio karakter noise (–, ..., |, angka halaman)
    noise_chars = len(re.findall(r'[–\-\.]{2,}|\.{2,}|\|{2,}', stripped))
    total_chars = len(stripped)
    if total_chars > 0 and noise_chars / total_chars > 0.15:
        return True

    # Deteksi Daftar Isi (TOC) — baris berisi titik-titik panjang
    if _is_toc_content(stripped):
        return True

    # Deteksi chunk metadata buku (copyright, tim penyusun, dll)
    lower = stripped.lower()
    skip_count = sum(1 for kw in SKIP_KEYWORDS if kw in lower)
    if skip_count >= 2:
        return True

    # Chunk isi daftar isi (banyak nomor halaman berulang)
    page_numbers = re.findall(r'\b\d{1,4}\b', stripped)
    words = re.findall(r'[a-zA-Z]{3,}', stripped)
    if len(page_numbers) > 10 and len(words) < 20:
        return True

    # Chunk yang isinya hanya heading daftar isi tanpa data
    toc_heading_pattern = re.search(
        r'(daftar\s+(isi|tabel|gambar)|kata\s+pengantar|list\s+of\s+(tables|figures)|preface|foreword)',
        lower
    )
    if toc_heading_pattern and len(words) < 30:
        return True

    # Chunk tabel yang terlalu berantakan (banyak karakter acak single)
    single_chars = re.findall(r'(?<!\w)[a-zA-Z](?!\w)', stripped)
    if len(single_chars) > 15:
        return True

    return False


@dataclass
class Chunk:
    """Satu chunk teks yang siap di-embed."""
    index: int
    content: str
    page_start: int
    page_end: int
    heading: str  # Heading/section tempat chunk ini berada
    char_count: int


def detect_heading(line: str) -> bool:
    """Cek apakah sebuah baris adalah heading/judul section."""
    stripped = line.strip()
    if not stripped:
        return False

    # Cek pattern heading dari config
    for pattern in HEADING_PATTERNS:
        if re.match(pattern, stripped, re.IGNORECASE):
            return True

    # Baris pendek yang ALL CAPS kemungkinan heading
    if stripped.isupper() and 5 < len(stripped) < 80:
        return True

    return False


def _split_at_headings(text: str) -> list[dict]:
    """
    Pecah teks menjadi section berdasarkan heading.
    Return list of {"heading": str, "content": str}
    """
    lines = text.split('\n')
    sections = []
    current_heading = ""
    current_lines = []

    for line in lines:
        if detect_heading(line):
            # Simpan section sebelumnya
            if current_lines:
                content = '\n'.join(current_lines).strip()
                if content:
                    sections.append({
                        "heading": current_heading,
                        "content": content,
                    })
            current_heading = line.strip()
            current_lines = []
        else:
            current_lines.append(line)

    # Simpan section terakhir
    if current_lines:
        content = '\n'.join(current_lines).strip()
        if content:
            sections.append({
                "heading": current_heading,
                "content": content,
            })

    return sections


def _split_long_section(text: str, max_size: int, overlap: int) -> list[str]:
    """
    Pecah section yang terlalu panjang menjadi chunks yang lebih kecil.
    Prioritas potong: paragraf > kalimat > karakter.
    """
    if len(text) <= max_size:
        return [text]

    chunks = []

    # Coba pecah per paragraf dulu
    paragraphs = re.split(r'\n\s*\n', text)

    current_chunk = ""
    for para in paragraphs:
        para = para.strip()
        if not para:
            continue

        # Jika paragraf ini saja sudah terlalu panjang, pecah per kalimat
        if len(para) > max_size:
            if current_chunk:
                chunks.append(current_chunk.strip())
                current_chunk = ""
            sentence_chunks = _split_by_sentences(para, max_size, overlap)
            chunks.extend(sentence_chunks)
            continue

        # Cek apakah masih muat di chunk sekarang
        if len(current_chunk) + len(para) + 2 <= max_size:
            current_chunk += ("\n\n" if current_chunk else "") + para
        else:
            if current_chunk:
                chunks.append(current_chunk.strip())
            # Ambil overlap dari chunk sebelumnya
            if chunks and overlap > 0:
                prev = chunks[-1]
                overlap_text = prev[-overlap:] if len(prev) > overlap else prev
                # Potong di batas kalimat
                dot_pos = overlap_text.find('. ')
                if dot_pos > 0:
                    overlap_text = overlap_text[dot_pos + 2:]
                current_chunk = overlap_text + "\n\n" + para
            else:
                current_chunk = para

    if current_chunk.strip():
        chunks.append(current_chunk.strip())

    return chunks


def _split_by_sentences(text: str, max_size: int, overlap: int) -> list[str]:
    """Pecah teks per kalimat jika paragraf terlalu panjang."""
    # Split di titik yang diikuti spasi dan huruf besar
    sentences = re.split(r'(?<=[.!?])\s+', text)

    chunks = []
    current = ""

    for sentence in sentences:
        if len(current) + len(sentence) + 1 <= max_size:
            current += (" " if current else "") + sentence
        else:
            if current:
                chunks.append(current.strip())
            current = sentence

    if current.strip():
        chunks.append(current.strip())

    return chunks


def chunk_text(
    full_text: str,
    page_mapping: list[tuple[int, int]] | None = None,
    max_size: int = MAX_CHUNK_SIZE,
    overlap: int = CHUNK_OVERLAP,
    min_size: int = MIN_CHUNK_SIZE,
    context_prefix: str = "",
) -> list[Chunk]:
    """
    Pipeline utama chunking.

    Args:
        full_text: Teks lengkap yang sudah dibersihkan
        page_mapping: Optional mapping (start_char, page_num) untuk tracking halaman
        max_size: Ukuran maksimum chunk
        overlap: Jumlah karakter overlap
        min_size: Ukuran minimum chunk (di bawah ini di-skip)
        context_prefix: Prefix konteks untuk setiap chunk (misal nama file)

    Returns:
        List of Chunk objects
    """
    # Step 1: Pecah berdasarkan heading
    sections = _split_at_headings(full_text)

    if not sections:
        # Jika tidak ada heading terdeteksi, treat semua sebagai satu section
        sections = [{"heading": "", "content": full_text}]

    # Step 2: Pecah section yang terlalu panjang
    raw_chunks = []
    for section in sections:
        heading = section["heading"]
        content = section["content"]

        sub_chunks = _split_long_section(content, max_size - len(context_prefix) - 50, overlap)

        for sub in sub_chunks:
            if len(sub.strip()) >= min_size:
                raw_chunks.append({
                    "heading": heading,
                    "content": sub.strip(),
                })

    # Step 3: Tambah context prefix dan buat Chunk objects
    chunks = []
    chunk_index = 0
    for raw in raw_chunks:
        content = raw["content"]

        # Tambah heading sebagai konteks di awal chunk
        if raw["heading"]:
            content = f"[{raw['heading']}]\n{content}"

        # Tambah prefix file/sumber
        if context_prefix:
            content = f"[Sumber: {context_prefix}]\n{content}"

        # Filter chunk tidak berguna SETELAH tambah prefix
        if is_useless_chunk(content, min_size=min_size):
            continue

        # Estimasi halaman
        page_start = 1
        page_end = 1
        if page_mapping:
            chunk_pos = full_text.find(raw["content"][:100])
            for start_char, page_num in page_mapping:
                if chunk_pos >= start_char:
                    page_start = page_num
                    page_end = page_num

        chunks.append(Chunk(
            index=chunk_index,
            content=content,
            page_start=page_start,
            page_end=page_end,
            heading=raw["heading"],
            char_count=len(content),
        ))
        chunk_index += 1

    return chunks
