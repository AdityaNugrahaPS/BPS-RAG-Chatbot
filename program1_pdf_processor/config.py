"""Konfigurasi Program 1 - BPS PDF Processor"""

import os

# Folder output
OUTPUT_DIR = os.path.join(os.path.dirname(__file__), "output")

# PDF extraction
MIN_TEXT_LENGTH = 50  # Minimum karakter untuk dianggap PDF digital (bukan scan)

# Chunking
MAX_CHUNK_SIZE = 1500  # Maksimum karakter per chunk
CHUNK_OVERLAP = 200    # Overlap antar chunk
MIN_CHUNK_SIZE = 150   # Minimum karakter untuk chunk valid

# Text cleaning
NOISE_PATTERNS = [
    r'https?://\S+',                          # URL
    r'www\.\S+',                              # www links
    # titik-titik daftar isi ditangani oleh remove_toc_lines
    r'_{3,}',                                 # Garis bawah berulang
    r'-{3,}',                                 # Dash berulang
    r'={3,}',                                 # Equal berulang
    r'Halaman\s+\d+',                         # Nomor halaman
    r'halaman\s+\d+',
    r'^\s*\d+\s*$',                           # Baris hanya nomor halaman
    r'BPS\s*[-–]\s*Statistics\s+Indonesia',    # Header BPS berulang
    r'Badan\s+Pusat\s+Statistik',             # Header BPS
    r'https://pekanbarukota\.bps\.go\.id',     # URL BPS Pekanbaru
]

# Heading detection patterns (untuk chunking by section)
HEADING_PATTERNS = [
    r'^BAB\s+[IVXLCDM]+',              # BAB I, BAB II, dll
    r'^Bab\s+\d+',                      # Bab 1, Bab 2, dll
    r'^\d+\.\d+[\.\s]',                # 1.1, 2.3, dll (sub-bab)
    r'^\d+\.\s+[A-Z]',                 # 1. Judul, 2. Judul
    r'^Tabel\s+\d+',                    # Tabel 1, Tabel 2
    r'^Gambar\s+\d+',                   # Gambar 1, Gambar 2
    r'^DAFTAR\s+',                      # DAFTAR ISI, DAFTAR TABEL
    r'^KATA\s+PENGANTAR',              # Kata Pengantar
    r'^PENDAHULUAN',
    r'^KESIMPULAN',
    r'^LAMPIRAN',
]

# BPS-specific topic keywords (untuk metadata extraction)
TOPIC_KEYWORDS = {
    'kependudukan': ['penduduk', 'populasi', 'demografi', 'kelahiran', 'kematian', 'migrasi', 'fertilitas'],
    'pendidikan': ['pendidikan', 'sekolah', 'murid', 'guru', 'siswa', 'mahasiswa', 'universitas', 'melek huruf'],
    'kesehatan': ['kesehatan', 'rumah sakit', 'puskesmas', 'dokter', 'penyakit', 'gizi', 'imunisasi'],
    'ekonomi': ['pdrb', 'ekonomi', 'inflasi', 'ihk', 'harga', 'produksi', 'ekspor', 'impor', 'perdagangan'],
    'ketenagakerjaan': ['tenaga kerja', 'pengangguran', 'angkatan kerja', 'upah', 'pekerja'],
    'pertanian': ['pertanian', 'padi', 'tanaman', 'lahan', 'panen', 'peternakan', 'perikanan'],
    'infrastruktur': ['jalan', 'jembatan', 'infrastruktur', 'bangunan', 'konstruksi'],
    'sosial': ['kemiskinan', 'sosial', 'kesejahteraan', 'rumah tangga', 'perumahan'],
    'pemerintahan': ['pemerintah', 'kecamatan', 'kelurahan', 'desa', 'apbd', 'pegawai'],
    'industri': ['industri', 'manufaktur', 'perusahaan', 'pabrik'],
    'transportasi': ['transportasi', 'kendaraan', 'angkutan', 'pelabuhan', 'bandara'],
    'komunikasi': ['komunikasi', 'telepon', 'internet', 'pos', 'media'],
    'pariwisata': ['pariwisata', 'wisata', 'hotel', 'penginapan', 'wisatawan'],
    'lingkungan': ['lingkungan', 'sampah', 'polusi', 'iklim', 'cuaca', 'hutan'],
    'energi': ['listrik', 'energi', 'bbm', 'gas', 'pln'],
    'statistik_umum': ['dalam angka', 'statistik daerah', 'profil', 'potensi'],
}

# Gemini model untuk table conversion
GEMINI_MODEL = "gemini-2.0-flash"
