"""
PDF Extractor — Extract teks dan tabel dari PDF BPS
Menggunakan PyMuPDF untuk teks dan pdfplumber untuk tabel.
"""

import fitz  # PyMuPDF
import pdfplumber
from dataclasses import dataclass, field


@dataclass
class ExtractedTable:
    """Satu tabel yang diekstrak dari PDF."""
    page_num: int
    title: str  # Judul tabel (baris sebelum tabel)
    headers: list[str]
    rows: list[list[str]]
    raw_text: str  # Representasi teks mentah dari tabel

    def to_dict(self):
        return {
            "page_num": self.page_num,
            "title": self.title,
            "headers": self.headers,
            "rows": self.rows,
            "raw_text": self.raw_text,
        }


@dataclass
class ExtractedPage:
    """Hasil ekstraksi satu halaman PDF."""
    page_num: int
    text: str
    tables: list[ExtractedTable] = field(default_factory=list)


@dataclass
class ExtractionResult:
    """Hasil keseluruhan ekstraksi PDF."""
    filename: str
    total_pages: int
    pages: list[ExtractedPage]
    is_scan: bool
    scan_pages: list[int]  # Halaman yang terdeteksi sebagai scan
    total_chars: int
    total_tables: int


def _detect_table_title(page_text: str, table_top_y: float, page_height: float) -> str:
    """Cari judul tabel dari teks di atas posisi tabel."""
    lines = page_text.split('\n')
    # Cari baris terakhir sebelum tabel yang mengandung kata kunci
    for line in reversed(lines):
        line_stripped = line.strip()
        if not line_stripped:
            continue
        # Cek apakah baris ini adalah judul tabel
        lower = line_stripped.lower()
        if any(kw in lower for kw in ['tabel', 'table', 'gambar', 'grafik', 'figure']):
            return line_stripped
        # Baris pendek sebelum tabel biasanya judul
        if len(line_stripped) < 150 and len(line_stripped) > 10:
            return line_stripped
        break
    return ""


def _table_to_raw_text(headers: list[str], rows: list[list[str]]) -> str:
    """Konversi tabel ke representasi teks sederhana."""
    lines = []
    if headers:
        lines.append(" | ".join(str(h) for h in headers))
        lines.append("-" * 40)
    for row in rows:
        lines.append(" | ".join(str(cell) if cell else "" for cell in row))
    return "\n".join(lines)


def extract_text_pymupdf(pdf_path: str) -> list[ExtractedPage]:
    """Extract teks dari setiap halaman menggunakan PyMuPDF (cepat)."""
    pages = []
    doc = fitz.open(pdf_path)
    for page_num in range(len(doc)):
        page = doc[page_num]
        text = page.get_text("text")
        pages.append(ExtractedPage(
            page_num=page_num + 1,
            text=text.strip(),
            tables=[]
        ))
    doc.close()
    return pages


def extract_tables_pdfplumber(pdf_path: str, page_callback=None) -> dict[int, list[ExtractedTable]]:
    """Extract tabel dari setiap halaman menggunakan pdfplumber."""
    tables_by_page: dict[int, list[ExtractedTable]] = {}

    with pdfplumber.open(pdf_path) as pdf:
        total_pages = len(pdf.pages)
        for page_num, page in enumerate(pdf.pages, start=1):
            page_tables = page.extract_tables()
            if not page_tables:
                continue

            page_text = page.extract_text() or ""
            extracted = []

            for table_data in page_tables:
                if not table_data or len(table_data) < 2:
                    continue

                # Baris pertama biasanya header
                raw_headers = table_data[0]
                headers = [str(h).strip() if h else "" for h in raw_headers]

                # Baris sisanya adalah data
                rows = []
                for row in table_data[1:]:
                    cleaned_row = [str(cell).strip() if cell else "" for cell in row]
                    # Skip baris yang semuanya kosong
                    if any(cell for cell in cleaned_row):
                        rows.append(cleaned_row)

                if not rows:
                    continue

                # Cari judul tabel
                title = _detect_table_title(page_text, 0, page.height)
                raw_text = _table_to_raw_text(headers, rows)

                extracted.append(ExtractedTable(
                    page_num=page_num,
                    title=title,
                    headers=headers,
                    rows=rows,
                    raw_text=raw_text,
                ))

            if extracted:
                tables_by_page[page_num] = extracted

            if page_callback:
                page_callback(page_num, total_pages)

    return tables_by_page


def detect_scan_pages(pages: list[ExtractedPage], min_chars: int = 50) -> list[int]:
    """Deteksi halaman yang kemungkinan scan (teks sangat sedikit)."""
    scan_pages = []
    for page in pages:
        # Halaman dengan teks < min_chars dianggap scan
        # Kecuali halaman kosong yang memang sengaja (separator)
        text = page.text.strip()
        if len(text) < min_chars and len(text) > 0:
            scan_pages.append(page.page_num)
        elif len(text) == 0:
            # Halaman benar-benar kosong — bisa separator atau scan
            scan_pages.append(page.page_num)
    return scan_pages


def extract_pdf(pdf_path: str, filename: str = "", page_callback=None) -> ExtractionResult:
    """
    Pipeline utama: extract teks + tabel dari satu file PDF.

    Returns ExtractionResult dengan semua data yang dibutuhkan.
    """
    if not filename:
        import os
        filename = os.path.basename(pdf_path)

    # Step 1: Extract teks dengan PyMuPDF
    pages = extract_text_pymupdf(pdf_path)

    # Step 2: Extract tabel dengan pdfplumber
    tables_by_page = extract_tables_pdfplumber(pdf_path, page_callback=page_callback)

    # Step 3: Gabungkan tabel ke halaman yang sesuai
    total_tables = 0
    for page in pages:
        if page.page_num in tables_by_page:
            page.tables = tables_by_page[page.page_num]
            total_tables += len(page.tables)

    # Step 4: Deteksi halaman scan
    scan_pages = detect_scan_pages(pages)

    # Hitung total karakter (hanya halaman non-scan)
    total_chars = sum(len(p.text) for p in pages if p.page_num not in scan_pages)

    # PDF dianggap scan jika > 70% halaman adalah scan
    is_scan = len(scan_pages) > (len(pages) * 0.7) if pages else True

    return ExtractionResult(
        filename=filename,
        total_pages=len(pages),
        pages=pages,
        is_scan=is_scan,
        scan_pages=scan_pages,
        total_chars=total_chars,
        total_tables=total_tables,
    )
