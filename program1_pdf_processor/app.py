"""
Program 1 — BPS PDF Processor + RAG Embedder
Streamlit UI dengan 2 tab:
  Tab 1: Konversi PDF BPS → dataset JSON
  Tab 2: Embed dataset JSON → Supabase
"""

import sys
import os
import json
import tempfile
import time

import streamlit as st
import pandas as pd
import psycopg2
from datetime import datetime

sys.path.insert(0, os.path.dirname(__file__))

from processor import process_single_pdf, ProcessedFile, ProcessingLog
from embedder import init_gemini, embed_batch, validate_embedding
from supabase_client import SupabaseRAG
from config import OUTPUT_DIR, MAX_CHUNK_SIZE, CHUNK_OVERLAP

# === PAGE CONFIG ===
st.set_page_config(
    page_title="BPS Chatbot Admin",
    page_icon="📊",
    layout="wide",
    initial_sidebar_state="expanded",
)

# === GLOBAL CSS ===
st.markdown("""
<style>
@import url('https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700&display=swap');

html,body,[class*="css"]{font-family:'Inter',system-ui,sans-serif!important}

/* ─ Background ─ */
.stApp,[data-testid="stAppViewContainer"],.main{background:#F1F5F9!important}
.block-container{padding:28px 32px 48px!important;max-width:1400px!important}

/* ─ Hide chrome ─ */
#MainMenu,footer,header,[data-testid="stToolbar"],[data-testid="stDecoration"]{display:none!important}

/* ─ Sidebar — dark navy ─ */
section[data-testid="stSidebar"]{
  background:#1e3a5f!important;
  border-right:none!important;
  min-width:215px!important;max-width:215px!important;
}
section[data-testid="stSidebar"] *{color:#94A3B8!important}
[data-testid="stSidebarNavItems"]{padding:6px!important}
[data-testid="stSidebarNavItems"] li a{
  display:flex!important;align-items:center!important;gap:8px!important;
  padding:8px 12px!important;border-radius:8px!important;
  font-size:13px!important;font-weight:500!important;color:#94A3B8!important;
  text-decoration:none!important;transition:all .15s!important;
}
[data-testid="stSidebarNavItems"] li a:hover{
  background:rgba(255,255,255,.1)!important;color:#F1F5F9!important;
}
[data-testid="stSidebarNavItems"] li a[aria-current="page"]{
  background:rgba(255,255,255,.15)!important;color:#F8FAFC!important;font-weight:600!important;
}
[data-testid="stSidebarNavSeparator"]{background:rgba(255,255,255,.1)!important}
section[data-testid="stSidebar"] .stButton>button{
  background:rgba(255,255,255,.1)!important;color:#E2E8F0!important;
  border:1px solid rgba(255,255,255,.15)!important;font-size:13px!important;
}
section[data-testid="stSidebar"] .stButton>button:hover{
  background:rgba(255,255,255,.18)!important;opacity:1!important;
}
section[data-testid="stSidebar"] .stTextInput>div>div>input{
  background:rgba(255,255,255,.08)!important;border-color:rgba(255,255,255,.15)!important;
  color:#E2E8F0!important;font-size:12px!important;
}
section[data-testid="stSidebar"] .stTextInput>div>div>input::placeholder{color:#475569!important}
section[data-testid="stSidebar"] .stTextInput label{color:#94A3B8!important;font-size:11px!important}
section[data-testid="stSidebar"] label,
section[data-testid="stSidebar"] small,
section[data-testid="stSidebar"] [data-testid="stMarkdownContainer"] p{
  color:#64748B!important;font-size:12px!important;
}
[data-testid="stSidebarHeader"]{background:#1e3a5f!important;border-bottom:1px solid rgba(255,255,255,.08)!important}

/* ─ Buttons ─ */
.stButton>button{
  background:#FFFFFF!important;color:#334155!important;
  border:1px solid #CBD5E1!important;border-radius:8px!important;
  font-size:13px!important;font-weight:500!important;
  padding:7px 16px!important;letter-spacing:-.1px!important;
  transition:all .15s!important;box-shadow:none!important;
}
.stButton>button:hover{background:#F1F5F9!important;border-color:#94A3B8!important;color:#0F172A!important}
.stButton>button[kind="primary"]{
  background:#1D4ED8!important;color:#FFFFFF!important;border:none!important;
}
.stButton>button[kind="primary"]:hover{background:#1e40af!important;opacity:1!important}

/* ─ Inputs ─ */
.stTextInput>div>div>input,.stNumberInput>div>div>input{
  border:1px solid #CBD5E1!important;border-radius:8px!important;
  font-size:13px!important;padding:8px 12px!important;
  background:#FFFFFF!important;color:#0F172A!important;
  box-shadow:none!important;
}
.stTextInput>div>div>input:focus,.stNumberInput>div>div>input:focus{
  border-color:#1D4ED8!important;outline:none!important;
  box-shadow:0 0 0 3px rgba(29,78,216,.1)!important;
}
.stTextInput label,.stNumberInput label{font-size:12px!important;font-weight:500!important;color:#475569!important}

/* ─ Tabs ─ */
[data-testid="stTabs"]{border-bottom:1px solid #E2E8F0!important}
button[data-baseweb="tab"]{
  font-size:13px!important;font-weight:500!important;color:#64748B!important;
  padding:8px 0!important;margin-right:24px!important;border:none!important;
  background:transparent!important;
}
button[data-baseweb="tab"][aria-selected="true"]{
  color:#1D4ED8!important;font-weight:600!important;
  border-bottom:2px solid #1D4ED8!important;
}
[data-testid="stTabContent"]{padding-top:24px!important}

/* ─ File uploader ─ */
[data-testid="stFileUploader"]{
  border:2px dashed #93C5FD!important;border-radius:12px!important;
  background:#EFF6FF!important;padding:10px!important;
}
[data-testid="stFileUploader"]:hover{border-color:#1D4ED8!important;background:#DBEAFE!important}
[data-testid="stFileUploader"] small{color:#475569!important;font-size:12px!important}

/* ─ File uploader delete button — always visible, red trash ─ */
[data-testid="stFileUploaderDeleteBtn"],
[data-testid="stFileUploaderDeleteBtn"] button{
  opacity:1!important;visibility:visible!important;
}
[data-testid="stFileUploaderDeleteBtn"] button{
  color:transparent!important;font-size:0!important;
  width:28px!important;height:28px!important;min-height:28px!important;
  background:transparent!important;border:none!important;
  cursor:pointer!important;position:relative!important;
  padding:0!important;border-radius:6px!important;
  transition:background .15s!important;
}
[data-testid="stFileUploaderDeleteBtn"] button svg,
[data-testid="stFileUploaderDeleteBtn"] button span{
  display:none!important;
}
[data-testid="stFileUploaderDeleteBtn"] button::after{
  content:'';position:absolute;top:50%;left:50%;
  transform:translate(-50%,-50%);
  width:15px;height:15px;
  background-image:url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='none' stroke='%23ef4444' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'%3E%3Cpolyline points='3 6 5 6 21 6'/%3E%3Cpath d='M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6'/%3E%3Cline x1='10' y1='11' x2='10' y2='17'/%3E%3Cline x1='14' y1='11' x2='14' y2='17'/%3E%3Cpath d='M9 6V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2'/%3E%3C/svg%3E");
  background-size:contain;background-repeat:no-repeat;background-position:center;
}
[data-testid="stFileUploaderDeleteBtn"] button:hover{
  background:rgba(239,68,68,.1)!important;
}
[data-testid="stFileUploaderDeleteBtn"] button:hover::after{
  background-image:url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='none' stroke='%23dc2626' stroke-width='2.5' stroke-linecap='round' stroke-linejoin='round'%3E%3Cpolyline points='3 6 5 6 21 6'/%3E%3Cpath d='M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6'/%3E%3Cline x1='10' y1='11' x2='10' y2='17'/%3E%3Cline x1='14' y1='11' x2='14' y2='17'/%3E%3Cpath d='M9 6V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2'/%3E%3C/svg%3E");
}

/* ─ Checkbox ─ */
.stCheckbox label{font-size:13px!important;color:#334155!important}

/* ─ Radio ─ */
.stRadio label{font-size:13px!important;color:#334155!important}
.stRadio [data-testid="stMarkdownContainer"] p{font-size:13px!important}

/* ─ Slider ─ */
.stSlider [data-testid="stThumbValue"]{font-size:12px!important}
[data-testid="stSlider"] div[role="slider"]{background:#1D4ED8!important}
.stSlider .rc-slider-track{background:#1D4ED8!important}

/* ─ Progress bar ─ */
.stProgress>div>div>div>div{background:#1D4ED8!important;border-radius:99px!important}

/* ─ Selectbox ─ */
.stSelectbox>div>div{
  border:1px solid #CBD5E1!important;border-radius:8px!important;
  font-size:13px!important;background:#FFFFFF!important;
}

/* ─ Expander ─ */
[data-testid="stExpander"]{
  border:1px solid #E2E8F0!important;border-radius:10px!important;
  background:#FFFFFF!important;overflow:hidden!important;
  box-shadow:0 1px 3px rgba(0,0,0,.04)!important;
}
[data-testid="stExpander"] summary{
  font-size:13px!important;font-weight:500!important;color:#334155!important;
  padding:12px 16px!important;
}

/* ─ Alerts ─ */
[data-testid="stAlert"]{border-radius:8px!important;border:1px solid!important;font-size:13px!important}
[data-testid="stAlert"][data-baseweb="notification"]{box-shadow:none!important}

/* ─ Dataframe ─ */
[data-testid="stDataFrame"]{border:1px solid #E2E8F0!important;border-radius:10px!important;overflow:hidden!important}
[data-testid="stDataFrame"] th{background:#F8FAFC!important;font-size:11px!important;
  font-weight:600!important;color:#64748B!important;text-transform:uppercase!important;letter-spacing:.4px!important}
[data-testid="stDataFrame"] td{font-size:13px!important;color:#0F172A!important}

/* ─ Metric cards ─ */
[data-testid="metric-container"]{
  background:#FFFFFF!important;border:1px solid #E2E8F0!important;
  border-radius:10px!important;padding:16px 20px!important;
  box-shadow:0 1px 3px rgba(0,0,0,.05)!important;
}
[data-testid="stMetricValue"]>div{font-size:26px!important;font-weight:700!important;color:#0F172A!important}
[data-testid="stMetricLabel"] p{font-size:11px!important;color:#64748B!important;font-weight:500!important}
[data-testid="stMetricDelta"]{display:none!important}

/* ─ Divider ─ */
hr{border-color:#E2E8F0!important}

/* ─ Form ─ */
[data-testid="stForm"]{
  border:1px solid #E2E8F0!important;border-radius:10px!important;
  padding:16px!important;background:#FFFFFF!important;
  box-shadow:0 1px 3px rgba(0,0,0,.04)!important;
}

/* ─ Popover ─ */
[data-testid="stPopover"]{border-radius:10px!important}

/* ─ Download button ─ */
.stDownloadButton>button{
  background:#FFFFFF!important;color:#334155!important;
  border:1px solid #CBD5E1!important;border-radius:8px!important;
  font-size:13px!important;font-weight:500!important;
}
.stDownloadButton>button[kind="primary"]{
  background:#1D4ED8!important;color:#FFFFFF!important;border:none!important;
}
.stDownloadButton>button[kind="primary"]:hover{background:#1e40af!important;opacity:1!important}

/* ─ Info box helpers ─ */
.info-card{
  background:#EFF6FF;border:1px solid #BFDBFE;border-radius:10px;
  padding:14px 18px;font-size:13px;color:#1e40af;
}
.section-label{
  font-size:11px;font-weight:600;color:#64748B;text-transform:uppercase;
  letter-spacing:.6px;margin:0 0 10px;
}

/* ─ Sidebar branding block ─ */
section[data-testid="stSidebar"] [data-testid="stMarkdownContainer"] h1,
section[data-testid="stSidebar"] [data-testid="stMarkdownContainer"] h2,
section[data-testid="stSidebar"] [data-testid="stMarkdownContainer"] h3 {
  color:#F1F5F9!important;font-size:14px!important;font-weight:600!important;
  margin:0!important;padding:0!important;
}

/* ─ Sidebar section divider ─ */
section[data-testid="stSidebar"] hr{
  border-color:rgba(255,255,255,.1)!important;margin:10px 0!important;
}

/* ─ Sidebar input labels cleaner ─ */
section[data-testid="stSidebar"] .stTextInput label{
  font-size:11px!important;font-weight:600!important;
  color:#94A3B8!important;letter-spacing:.3px!important;
  text-transform:uppercase!important;
}

/* ─ Workflow step banner ─ */
.wf-banner{
  display:flex;align-items:center;gap:0;
  background:#FFFFFF;border:1px solid #E2E8F0;border-radius:10px;
  overflow:hidden;margin-bottom:20px;
}
.wf-step{
  flex:1;display:flex;align-items:center;gap:9px;
  padding:10px 16px;font-size:12px;font-weight:500;color:#94A3B8;
  border-right:1px solid #E2E8F0;
}
.wf-step:last-child{border-right:none;}
.wf-step.active{background:#EFF6FF;color:#1D4ED8;}
.wf-step.done{background:#F0FDF4;color:#16A34A;}
.wf-num{
  width:20px;height:20px;border-radius:50%;flex-shrink:0;
  display:flex;align-items:center;justify-Content:center;
  font-size:10px;font-weight:700;background:#E2E8F0;color:#64748B;
}
.wf-step.active .wf-num{background:#1D4ED8;color:#fff;}
.wf-step.done .wf-num{background:#16A34A;color:#fff;}
.wf-arrow{color:#CBD5E1;padding:0 4px;font-size:14px;flex-shrink:0;}
</style>
""", unsafe_allow_html=True)

# === CREDENTIALS FILE ===
CREDS_FILE = os.path.join(os.path.dirname(__file__), ".credentials.json")

def load_credentials() -> dict:
    """Load saved credentials dari file lokal."""
    try:
        if os.path.exists(CREDS_FILE):
            with open(CREDS_FILE, "r") as f:
                return json.load(f)
    except Exception:
        pass
    return {}

def save_credentials(creds: dict):
    """Simpan credentials ke file lokal."""
    try:
        with open(CREDS_FILE, "w") as f:
            json.dump(creds, f)
    except Exception:
        pass

# === SESSION STATE ===
for key, default in {
    "processed_files": [],
    "logs": [],
    "dataset_json": None,
    "dataset_obj": None,
    "embed_logs": [],
    "supabase_stats": None,
}.items():
    if key not in st.session_state:
        st.session_state[key] = default


# Teks sampel BPS untuk live preview pengaturan
_SAMPLE_PREVIEW = (
    "Kota Pekanbaru secara astronomis terletak antara 101°14' hingga 101°34' Bujur Timur "
    "dan 0°25' hingga 0°45' Lintang Utara. Luas wilayah Kota Pekanbaru adalah 632,26 km², "
    "terdiri dari 12 kecamatan dan 83 kelurahan. Jumlah penduduk Kota Pekanbaru pada tahun "
    "2025 sebanyak 1.156.223 jiwa, terdiri dari 583.412 laki-laki dan 572.811 perempuan. "
    "Kecamatan Tampan memiliki jumlah penduduk terbesar yaitu 298.450 jiwa, diikuti "
    "Tenayan Raya 187.320 jiwa, Marpoyan Damai 156.780 jiwa, dan Payung Sekaki 134.200 jiwa. "
    "Kepadatan penduduk rata-rata mencapai 1.829 jiwa per km². Tingkat pertumbuhan penduduk "
    "sebesar 2,3 persen per tahun. Angka harapan hidup penduduk Kota Pekanbaru sebesar 72,4 tahun. "
    "Indeks Pembangunan Manusia (IPM) Kota Pekanbaru tahun 2025 mencapai 82,31 termasuk kategori "
    "sangat tinggi dan merupakan yang tertinggi di Provinsi Riau."
)


def render_pdf_settings():
    """Render pengaturan proses PDF di halaman utama. Return dict cfg."""
    use_ai = st.checkbox(
        "Gunakan AI Gemini untuk membaca tabel (lebih akurat, lebih lambat)",
        value=False,
        help="Jika dicentang, setiap tabel di PDF akan dibacakan oleh Gemini AI dan diubah jadi kalimat. Hasilnya lebih bagus tapi LEBIH LAMBAT. Untuk PDF besar (>100 hal), biarkan tidak dicentang.",
    )
    if use_ai:
        st.warning("Mode AI aktif — proses bisa lebih lama untuk PDF besar (>50 halaman).", icon="⏳")

    with st.expander("⚙️ Pengaturan Lanjutan — Ukuran Potongan Teks", expanded=False):
        col1, col2 = st.columns(2)

        with col1:
            st.markdown("**📏 Ukuran potongan teks**")
            st.caption("PDF dipotong jadi bagian kecil. Makin besar → lebih panjang tapi lambat. **Rekomendasi: 1000–2000.**")
            c_slider, c_input = st.columns([3, 1])
            with c_slider:
                max_chunk = st.slider(
                    "Ukuran potongan teks", min_value=100, max_value=5000,
                    value=MAX_CHUNK_SIZE, step=1, label_visibility="collapsed",
                )
            with c_input:
                max_chunk = st.number_input(
                    "karakter", min_value=100, max_value=5000,
                    value=max_chunk, step=1, label_visibility="collapsed",
                )
            st.caption(f"≈ **{max_chunk//5} kata** per potongan")

        with col2:
            st.markdown("**🔁 Tumpang tindih antar potongan**")
            st.caption("Berapa karakter dari potongan sebelumnya diulang di awal berikutnya. Mencegah chatbot kehilangan konteks. **Rekomendasi: 100–250.**")
            c_slider2, c_input2 = st.columns([3, 1])
            with c_slider2:
                overlap = st.slider(
                    "Tumpang tindih", min_value=0, max_value=1000,
                    value=CHUNK_OVERLAP, step=1, label_visibility="collapsed",
                )
            with c_input2:
                overlap = st.number_input(
                    "karakter", min_value=0, max_value=1000,
                    value=overlap, step=1, label_visibility="collapsed", key="overlap_input",
                )
            st.caption(f"≈ **{overlap//5} kata** yang diulang")

    with st.expander("👁️ Lihat contoh potongan (update otomatis saat angka diubah)"):
        cut = min(max_chunk, len(_SAMPLE_PREVIEW))
        chunk2_start = max(0, cut - overlap)

        # Potongan 1: bagian normal (putih) + bagian yang akan diulang (kuning)
        p1_normal = _SAMPLE_PREVIEW[:chunk2_start]
        p1_repeated = _SAMPLE_PREVIEW[chunk2_start:cut]

        # Potongan 2: bagian kuning (diulang) + bagian biru (konten baru)
        p2_repeated = p1_repeated
        p2_new = _SAMPLE_PREVIEW[cut:cut + max_chunk - overlap]

        st.markdown(
            f"<div style='background:#1e1e1e;border:1px solid #444;border-radius:6px;"
            f"padding:12px;font-family:monospace;font-size:12px;color:#ddd;"
            f"white-space:pre-wrap;word-break:break-word;line-height:1.6;margin-bottom:8px'>"
            f"<span style='color:#aaa'>── POTONGAN 1 ({cut} karakter) ──</span>\n\n"
            f"<span style='color:#ddd'>{p1_normal}</span>"
            f"<span style='background:#3a3a00;color:#ffd700' title='Bagian ini akan diulang di awal Potongan 2'>{p1_repeated}</span>"
            f"<span style='color:#f90'>{'...' if cut < len(_SAMPLE_PREVIEW) else ''}</span>"
            f"\n\n<span style='color:#888'>🟡 {len(p1_repeated)} karakter terakhir ini akan diulang di Potongan 2</span>"
            f"\n<span style='color:#aaa'>──────────────────────────────────────────</span>"
            f"</div>"
            f"<div style='background:#1e1e1e;border:1px solid #444;border-radius:6px;"
            f"padding:12px;font-family:monospace;font-size:12px;color:#ddd;"
            f"white-space:pre-wrap;word-break:break-word;line-height:1.6'>"
            f"<span style='color:#aaa'>── POTONGAN 2 ({len(p2_repeated) + len(p2_new)} karakter) ──</span>\n\n"
            f"<span style='background:#3a3a00;color:#ffd700'>{p2_repeated}</span>"
            f"<span style='color:#6cf'>{p2_new}</span>"
            f"<span style='color:#f90'>{'...' if p2_new else ''}</span>"
            f"\n\n<span style='color:#888'>🟡 Diulang dari Potongan 1 &nbsp;|&nbsp; 🔵 Konten baru</span>"
            f"\n<span style='color:#aaa'>──────────────────────────────────────────</span>"
            f"</div>",
            unsafe_allow_html=True,
        )
        st.caption(f"🟡 Kuning = {len(p1_repeated)} karakter yang sama di akhir Potongan 1 dan awal Potongan 2 &nbsp;|&nbsp; 🔵 Biru = konten baru")

    return {"use_ai": use_ai, "max_chunk": max_chunk, "overlap": overlap}


# ============================================================
# TAB 1 — PROSES PDF
# ============================================================
def _render_workflow_banner(active_step: int):
    """Banner indikator 2-step workflow: 1=Proses PDF, 2=Embed ke Supabase."""
    has_dataset = bool(st.session_state.dataset_obj)
    s1_cls = "done" if has_dataset else ("active" if active_step == 1 else "")
    s2_cls = "active" if active_step == 2 else ("done" if has_dataset and active_step > 2 else "")
    st.markdown(
        f"<div class='wf-banner'>"
        f"<div class='wf-step {s1_cls}'>"
        f"<span class='wf-num'>{'✓' if has_dataset else '1'}</span>"
        f"<span>Proses PDF</span></div>"
        f"<span class='wf-arrow'>›</span>"
        f"<div class='wf-step {s2_cls}'>"
        f"<span class='wf-num'>2</span>"
        f"<span>Embed ke Supabase</span></div>"
        f"</div>",
        unsafe_allow_html=True,
    )


def tab_process_pdf(cfg):
    _render_workflow_banner(active_step=1)
    st.markdown(
        "<p style='font-size:16px;font-weight:700;color:#0F172A;margin:0 0 4px'>Upload PDF BPS</p>"
        "<p style='font-size:13px;color:#64748B;margin:0 0 20px'>Konversi PDF publikasi BPS menjadi dataset JSON siap embed ke chatbot</p>",
        unsafe_allow_html=True,
    )

    # === Upload dulu (primary action) ===
    uploaded_files = st.file_uploader(
        "Pilih satu atau beberapa file PDF",
        type=["pdf"],
        accept_multiple_files=True,
        help="Upload file PDF publikasi BPS Kota Pekanbaru (Dalam Angka, Statistik Daerah, dll)",
    )

    if uploaded_files:
        st.success(f"✅ {len(uploaded_files)} file siap diproses")
        with st.expander(f"Lihat daftar file ({len(uploaded_files)})"):
            for i, f in enumerate(uploaded_files):
                size_mb = len(f.getvalue()) / (1024 * 1024)
                st.text(f"  {i+1}. {f.name}  ({size_mb:.1f} MB)")

    # === Pengaturan proses (secondary — collapsed by default) ===
    pdf_cfg = render_pdf_settings()
    cfg = {**cfg, **pdf_cfg}

    st.divider()

    # === Buttons ===
    col1, col2 = st.columns([3, 1])
    with col1:
        start_btn = st.button("🚀 Mulai Proses", type="primary", use_container_width=True, disabled=not uploaded_files)
    with col2:
        if st.button("Reset", use_container_width=True):
            st.session_state.processed_files = []
            st.session_state.logs = []
            st.session_state.dataset_json = None
            st.session_state.dataset_obj = None
            st.rerun()

    # === Processing ===
    if start_btn and uploaded_files:
        if cfg["use_ai"] and not cfg["gemini_key"]:
            st.error("Masukkan Gemini API Key di sidebar, atau matikan AI konversi tabel.")
            return

        all_processed = []
        all_logs = []

        # Step weights untuk progress bar (total = 1.0 per file)
        STEP_WEIGHTS = {
            "extract":  0.20,
            "metadata": 0.05,
            "tables":   0.40,
            "clean":    0.10,
            "chunk":    0.15,
            "output":   0.10,
        }

        total_files = len(uploaded_files)

        # UI elements
        st.markdown("---")
        file_label   = st.empty()
        overall_text = st.empty()
        step_bar     = st.progress(0.0)
        pct_text     = st.empty()

        for i, uploaded_file in enumerate(uploaded_files):
            filename = uploaded_file.name
            file_label.markdown(f"**📄 Memproses {i+1}/{total_files}:** `{filename}`")
            overall_text.caption(f"Overall: {i}/{total_files} file selesai")

            step_bar.progress(0.0)
            pct_text.markdown("**0%**")

            # Track progress per step
            step_progress = [0.0]  # mutable untuk closure

            STEP_LABELS = {
                "extract":  "Mengekstrak teks",
                "metadata": "Membaca metadata",
                "tables":   "Mengkonversi tabel",
                "clean":    "Membersihkan teks",
                "chunk":    "Memecah chunks",
                "output":   "Menyiapkan output",
            }

            def on_progress(step, detail="", _step_progress=step_progress):
                if step == "extract" and "/" in detail:
                    # Per-halaman update: detail = "cur/tot"
                    try:
                        cur, tot = map(int, detail.split("/"))
                        if tot > 0:
                            val = (cur / tot) * STEP_WEIGHTS["extract"]
                            _step_progress[0] = val
                            pct = int(val * 100)
                            step_bar.progress(val)
                            pct_text.markdown(f"**{pct}%** — Mengekstrak teks ({cur}/{tot} halaman)")
                            return
                    except Exception:
                        pass

                weight = STEP_WEIGHTS.get(step, 0.1)
                _step_progress[0] = min(_step_progress[0] + weight, 1.0)
                pct = int(_step_progress[0] * 100)
                step_bar.progress(_step_progress[0])
                label = STEP_LABELS.get(step, step)
                pct_text.markdown(f"**{pct}%** — {label}{'  ' + detail if detail else ''}")

            with tempfile.NamedTemporaryFile(suffix=".pdf", delete=False) as tmp:
                tmp.write(uploaded_file.getvalue())
                tmp_path = tmp.name

            try:
                import config
                orig_max, orig_overlap = config.MAX_CHUNK_SIZE, config.CHUNK_OVERLAP
                config.MAX_CHUNK_SIZE = cfg["max_chunk"]
                config.CHUNK_OVERLAP = cfg["overlap"]

                result = process_single_pdf(
                    tmp_path,
                    gemini_api_key=cfg["gemini_key"],
                    use_ai_tables=cfg["use_ai"],
                    progress_callback=on_progress,
                    original_filename=filename,
                )

                config.MAX_CHUNK_SIZE, config.CHUNK_OVERLAP = orig_max, orig_overlap
                all_processed.append(result)
                all_logs.append(result.log)
                step_bar.progress(1.0)
                pct_text.markdown(f"**100%** — Selesai ✅")
            except Exception as e:
                all_logs.append(ProcessingLog(filename, "error", f"Error: {str(e)}"))
                pct_text.markdown(f"❌ Error: {str(e)[:80]}")
            finally:
                os.unlink(tmp_path)

            overall_text.caption(f"Overall: {i+1}/{total_files} file selesai")

        # Bersihkan UI loading
        file_label.empty()
        overall_text.empty()
        step_bar.empty()
        pct_text.empty()

        st.session_state.processed_files = all_processed
        st.session_state.logs = all_logs

        successful = [f for f in all_processed if f.chunks]
        if successful:
            dataset = {
                "generated_at": time.strftime("%Y-%m-%d %H:%M:%S"),
                "total_files": len(successful),
                "total_chunks": sum(len(f.chunks) for f in successful),
                "files": [f.to_dict() for f in successful],
            }
            st.session_state.dataset_json = json.dumps(dataset, ensure_ascii=False, indent=2)
            st.session_state.dataset_obj = dataset

        ok = sum(1 for l in all_logs if l.status == "success")
        chunks = sum(l.total_chunks for l in all_logs)
        st.success(f"✅ Selesai! {ok}/{total_files} file berhasil — {chunks} chunks siap di-embed.")
        st.rerun()

    # === Results ===
    _render_pdf_results()


def _render_pdf_results():
    logs = st.session_state.logs
    processed = st.session_state.processed_files
    if not logs:
        return

    st.divider()
    st.subheader("📋 Hasil Pemrosesan")

    # Metrics
    col1, col2, col3, col4, col5 = st.columns(5)
    success = sum(1 for l in logs if l.status == "success")
    scan = sum(1 for l in logs if l.status == "scan")
    total_chunks = sum(l.total_chunks for l in logs)
    total_tables = sum(l.tables_converted for l in logs)

    col1.metric("Total File", len(logs))
    col2.metric("Berhasil", success)
    col3.metric("PDF Scan", scan)
    col4.metric("Total Chunks", total_chunks)
    col5.metric("Tabel Dikonversi", total_tables)

    # Log table
    log_data = []
    for log in logs:
        icon = {"success": "✅", "scan": "⚠️", "error": "❌", "skipped": "⏭️"}.get(log.status, "❓")
        log_data.append({
            "Status": f"{icon} {log.status.upper()}",
            "File": log.filename,
            "Halaman": log.total_pages,
            "Scan": log.scan_pages,
            "Tabel": log.total_tables,
            "Chunks": log.total_chunks,
            "Waktu": f"{log.processing_time:.1f}s",
            "Pesan": log.message,
        })
    st.dataframe(pd.DataFrame(log_data), use_container_width=True, hide_index=True)

    # Preview chunks
    successful = [f for f in processed if f.chunks]
    if successful:
        st.divider()
        st.subheader("🔍 Preview Chunks")

        selected_file = st.selectbox("Pilih file:", [f.filename for f in successful])
        selected = next(f for f in successful if f.filename == selected_file)

        with st.expander("📋 Metadata File", expanded=True):
            st.json(selected.metadata)

        st.write(f"**Total chunks:** {len(selected.chunks)}")
        chunk_idx = st.slider("Chunk ke-", 0, max(len(selected.chunks) - 1, 0), 0, key="chunk_slider")
        chunk = selected.chunks[chunk_idx]

        c1, c2 = st.columns([3, 1])
        with c1:
            st.text_area(f"Chunk #{chunk['index']} ({chunk['char_count']} chars)", chunk["content"], height=300, disabled=True)
        with c2:
            st.markdown("**Metadata:**")
            st.json(chunk["metadata"])

    # Download
    if st.session_state.dataset_json:
        st.divider()
        st.subheader("💾 Download")
        c1, c2 = st.columns(2)
        with c1:
            st.download_button(
                "📥 Download dataset.json", st.session_state.dataset_json,
                f"dataset_bps_{time.strftime('%Y%m%d_%H%M%S')}.json",
                "application/json", type="primary", use_container_width=True,
            )
        with c2:
            log_json = json.dumps({"files": [l.to_dict() for l in logs]}, ensure_ascii=False, indent=2)
            st.download_button(
                "📥 Download log.json", log_json,
                f"log_bps_{time.strftime('%Y%m%d_%H%M%S')}.json",
                "application/json", use_container_width=True,
            )
        size_kb = len(st.session_state.dataset_json.encode('utf-8')) / 1024
        st.caption(f"Ukuran: {size_kb:.1f} KB | {total_chunks} chunks dari {success} file")


# ============================================================
# TAB 2 — EMBED KE SUPABASE
# ============================================================
def tab_embed_supabase(cfg):
    _render_workflow_banner(active_step=2)
    st.markdown(
        "<p style='font-size:16px;font-weight:700;color:#0F172A;margin:0 0 4px'>Embed Dataset ke Supabase</p>"
        "<p style='font-size:13px;color:#64748B;margin:0 0 20px'>Upload dataset JSON hasil Tab 1 dan simpan embedding-nya ke vector database</p>",
        unsafe_allow_html=True,
    )

    # === Supabase Status ===
    if cfg["supabase_url"] and cfg["supabase_key"]:
        col_r, col_s = st.columns([1, 4])
        with col_r:
            if st.button("↻ Refresh", use_container_width=True):
                try:
                    db = SupabaseRAG(cfg["supabase_url"], cfg["supabase_key"])
                    st.session_state.supabase_stats = db.get_stats()
                except Exception as e:
                    st.error(f"Gagal konek: {e}")

        stats = st.session_state.supabase_stats
        if stats:
            c1, c2 = st.columns(2)
            c1.metric("Chunks di Supabase", stats["total_chunks"])
            c2.metric("File Ter-embed", stats["total_files"])
            if stats["files"]:
                with st.expander(f"File sudah ada ({len(stats['files'])})"):
                    for i, f in enumerate(stats["files"]):
                        st.text(f"  {i+1}. {f}")
            st.divider()
    else:
        st.markdown(
            "<div class='info-card'>⚠️ Masukkan Supabase URL dan Service Key di sidebar kiri untuk melanjutkan.</div>",
            unsafe_allow_html=True,
        )
        return

    # === Sumber dataset ===
    st.markdown("<p class='section-label'>Sumber Dataset</p>", unsafe_allow_html=True)
    source = st.radio("Ambil dari:", ["Hasil Tab 1 (sesi ini)", "Upload file JSON"], label_visibility="collapsed")

    dataset = None

    if source == "Hasil Tab 1 (sesi ini)":
        if st.session_state.dataset_obj:
            dataset = st.session_state.dataset_obj
            st.success(f"✅ Dataset dari sesi: {dataset['total_files']} file, {dataset['total_chunks']} chunks")
        else:
            st.markdown(
                "<div style='background:#FFF7ED;border:1px solid #FED7AA;border-radius:10px;"
                "padding:14px 18px;font-size:13px;color:#92400E'>"
                "⚠️ <strong>Belum ada dataset di sesi ini.</strong><br>"
                "<span style='font-size:12px;color:#B45309'>Buka tab <strong>📄 Proses PDF</strong> "
                "dan proses file PDF terlebih dulu, atau pilih "
                "<em>Upload file JSON</em> di bawah.</span></div>",
                unsafe_allow_html=True,
            )
            return
    else:
        uploaded = st.file_uploader("Upload dataset.json", type=["json"])
        if uploaded:
            try:
                dataset = json.loads(uploaded.read().decode("utf-8"))
                if "files" not in dataset or "total_chunks" not in dataset:
                    st.error("Format JSON tidak valid.")
                    return
                st.success(f"✅ Dataset: {dataset['total_files']} file, {dataset['total_chunks']} chunks")
            except Exception as e:
                st.error(f"Error baca JSON: {e}")
                return

    if not dataset:
        return

    # Preview
    file_summary = []
    for f in dataset["files"]:
        meta = f.get("metadata", {})
        file_summary.append({
            "File": f["file"],
            "Tahun": meta.get("tahun_data", "-"),
            "Topik": meta.get("topik", "-"),
            "Chunks": f["total_chunks"],
        })
    st.dataframe(pd.DataFrame(file_summary), use_container_width=True, hide_index=True)

    st.divider()

    # === Embed settings ===
    embed_mode = st.radio(
        "Mode:", ["append (skip file yang sudah ada)", "replace (hapus lama, embed ulang)"],
        horizontal=True,
    )
    mode = "append" if "append" in embed_mode else "replace"

    # === Embed button ===
    total_chunks = sum(len(f["chunks"]) for f in dataset["files"])
    st.info(f"Total {total_chunks} chunks akan di-embed")

    if not st.button("⚡ Mulai Embed ke Supabase", type="primary", use_container_width=True):
        return

    if not cfg["gemini_key"]:
        st.error("Masukkan Gemini API Key di sidebar!")
        return

    # === Process ===
    try:
        init_gemini(cfg["gemini_key"])
        db = SupabaseRAG(cfg["supabase_url"], cfg["supabase_key"])
    except Exception as e:
        st.error(f"Gagal init: {e}")
        return

    existing_files = db.get_existing_files()
    progress_bar = st.progress(0)
    status_text = st.empty()
    logs = []
    total_files = len(dataset["files"])

    for file_idx, file_data in enumerate(dataset["files"]):
        filename = file_data["file"]
        chunks = file_data["chunks"]

        if not chunks:
            logs.append({"file": filename, "status": "skip", "message": "Tidak ada chunks", "chunks": 0})
            continue

        if mode == "append" and filename in existing_files:
            logs.append({"file": filename, "status": "skip", "message": "Sudah ada", "chunks": 0})
            progress_bar.progress((file_idx + 1) / total_files)
            continue

        if mode == "replace" and filename in existing_files:
            status_text.text(f"🗑️ Hapus lama: {filename}...")
            db.delete_file_documents(filename)

        status_text.text(f"🧠 Embedding {file_idx+1}/{total_files}: {filename} ({len(chunks)} chunks)...")

        try:
            texts = [c["content"] for c in chunks]
            embeddings = embed_batch(
                texts,
                progress_callback=lambda cur, tot: progress_bar.progress(
                    (file_idx + cur / tot) / total_files
                ),
            )

            if embeddings and not validate_embedding(embeddings[0]):
                raise Exception(f"Dimensi salah: {len(embeddings[0])} (expected 768)")

            status_text.text(f"💾 Simpan: {filename}...")
            inserted = db.insert_documents(chunks, embeddings)

            file_id = file_data.get("metadata", {}).get("fileId", "")
            db.mark_file_ingested(filename, file_id, inserted)

            logs.append({"file": filename, "status": "success", "message": f"{inserted} chunks", "chunks": inserted})
        except Exception as e:
            logs.append({"file": filename, "status": "error", "message": str(e), "chunks": 0})

        progress_bar.progress((file_idx + 1) / total_files)

    progress_bar.empty()
    status_text.empty()

    # Summary
    ok = sum(1 for l in logs if l["status"] == "success")
    err = sum(1 for l in logs if l["status"] == "error")
    embedded = sum(l["chunks"] for l in logs)
    st.success(f"✅ Selesai! {ok} file berhasil, {err} error. Total {embedded} chunks ke Supabase.")

    # Log table
    log_data = []
    for l in logs:
        icon = {"success": "✅", "error": "❌", "skip": "⏭️"}.get(l["status"], "❓")
        log_data.append({"Status": f"{icon} {l['status'].upper()}", "File": l["file"], "Pesan": l["message"]})
    st.dataframe(pd.DataFrame(log_data), use_container_width=True, hide_index=True)

    # Refresh stats
    try:
        st.session_state.supabase_stats = db.get_stats()
    except Exception:
        pass



# ============================================================
# DATABASE HELPERS
# ============================================================
_DB = dict(
    host="aws-1-ap-northeast-2.pooler.supabase.com",
    port=6543, dbname="postgres",
    user="postgres.xxbdnrknroujyjfrvykd",
    password="RagChatbot123!", sslmode="require",
    connect_timeout=10,
)


@st.cache_resource(ttl=30)
def _db_conn():
    return psycopg2.connect(**_DB)


def _db_query(sql: str) -> pd.DataFrame:
    try:
        return pd.read_sql_query(sql, _db_conn())
    except Exception:
        _db_conn.clear()
        try:
            return pd.read_sql_query(sql, _db_conn())
        except Exception as e:
            st.error(f"DB Error: {e}")
            return pd.DataFrame()


def _db_exec(sql: str, params=None) -> bool:
    try:
        conn = _db_conn()
        cur = conn.cursor()
        cur.execute(sql, params)
        conn.commit()
        cur.close()
        return True
    except Exception as e:
        st.error(f"DB Error: {e}")
        try:
            conn.rollback()
        except Exception:
            pass
        _db_conn.clear()
        return False


# ============================================================
# DASHBOARD CHARTS — native Streamlit + Plotly (no CDN)
# ============================================================
def _render_dashboard_charts(metrics: dict, df_bd, df_dist, df_kata):
    """Render KPI cards and charts sepenuhnya dengan Streamlit native."""

    def fmt(v):
        if v is None: return "—"
        try:
            f = float(v)
            return f"{int(f):,}" if f % 1 == 0 else f"{f:,.1f}"
        except Exception:
            return str(v)

    # ── KPI Cards ──
    st.markdown("<p class='section-label'>Ringkasan</p>", unsafe_allow_html=True)
    c1, c2, c3, c4, c5 = st.columns(5)
    c1.metric("💬 Total Pesan",     fmt(metrics.get("total_pesan")))
    c2.metric("👤 Pesan User",      fmt(metrics.get("total_human")))
    c3.metric("🤖 Respon AI",       fmt(metrics.get("total_ai")))
    c4.metric("🙋 User Unik",       fmt(metrics.get("user_unik")))
    c5.metric("📈 Rata-rata/User",  fmt(metrics.get("rata_rata")))

    st.markdown("<div style='height:4px'></div>", unsafe_allow_html=True)
    st.markdown("<p class='section-label'>Analitik</p>", unsafe_allow_html=True)

    try:
        import plotly.express as px

        col_pie, col_bar = st.columns(2)

        with col_pie:
            st.markdown(
                "<p style='font-size:13px;font-weight:600;color:#0F172A;margin-bottom:8px'>Breakdown Tipe Pesan</p>",
                unsafe_allow_html=True,
            )
            if not df_bd.empty:
                fig = px.pie(
                    df_bd, names="tipe", values="jumlah", hole=0.42,
                    color_discrete_sequence=["#1D4ED8", "#059669", "#D97706"],
                )
                fig.update_traces(textfont_size=11, textposition="inside",
                                  insidetextorientation="radial")
                fig.update_layout(
                    height=250, margin=dict(t=10, b=30, l=0, r=0),
                    font_family="Inter", paper_bgcolor="rgba(0,0,0,0)",
                    legend=dict(orientation="h", yanchor="top", y=-0.08,
                                font=dict(size=11)),
                    showlegend=True,
                )
                st.plotly_chart(fig, use_container_width=True, config={"displayModeBar": False})
            else:
                st.info("Belum ada data pesan.")

        with col_bar:
            st.markdown(
                "<p style='font-size:13px;font-weight:600;color:#0F172A;margin-bottom:8px'>Distribusi Panjang Pesan</p>",
                unsafe_allow_html=True,
            )
            if not df_dist.empty:
                fig2 = px.bar(
                    df_dist, x="panjang", y="jumlah", text="jumlah",
                    color_discrete_sequence=["#1D4ED8"],
                )
                fig2.update_traces(textposition="outside", textfont_size=10,
                                   marker_line_width=0)
                fig2.update_layout(
                    height=250, margin=dict(t=10, b=10, l=0, r=0),
                    font_family="Inter", showlegend=False,
                    paper_bgcolor="rgba(0,0,0,0)", plot_bgcolor="rgba(0,0,0,0)",
                    xaxis=dict(title="Panjang Karakter", showgrid=False,
                               tickfont=dict(size=11)),
                    yaxis=dict(title="", showgrid=True, gridcolor="#F1F5F9",
                               tickfont=dict(size=11)),
                )
                st.plotly_chart(fig2, use_container_width=True, config={"displayModeBar": False})
            else:
                st.info("Belum ada data pesan.")

        st.markdown(
            "<p class='section-label' style='margin-top:8px'>Top 20 Kata Populer</p>",
            unsafe_allow_html=True,
        )
        if not df_kata.empty:
            fig3 = px.bar(
                df_kata, x="frekuensi", y="kata", orientation="h",
                text="frekuensi", color_discrete_sequence=["#2563EB"],
            )
            fig3.update_traces(textposition="outside", textfont_size=10,
                               marker_line_width=0)
            fig3.update_layout(
                height=480, margin=dict(t=0, b=10, l=10, r=50),
                font_family="Inter", showlegend=False,
                paper_bgcolor="rgba(0,0,0,0)", plot_bgcolor="rgba(0,0,0,0)",
                xaxis=dict(title="Frekuensi", showgrid=True, gridcolor="#F1F5F9",
                           tickfont=dict(size=11)),
                yaxis=dict(title="", autorange="reversed", showgrid=False,
                           tickfont=dict(size=11)),
            )
            st.plotly_chart(fig3, use_container_width=True, config={"displayModeBar": False})
        else:
            st.info("Belum ada data kata dari user.")

    except ImportError:
        # Fallback: tabel sederhana jika plotly tidak tersedia
        col_l, col_r = st.columns(2)
        with col_l:
            st.markdown("**Breakdown Tipe Pesan**")
            if not df_bd.empty:
                st.dataframe(df_bd.rename(columns={"tipe": "Tipe", "jumlah": "Jumlah"}),
                             use_container_width=True, hide_index=True)
            else:
                st.info("Belum ada data.")
        with col_r:
            st.markdown("**Distribusi Panjang Pesan**")
            if not df_dist.empty:
                st.bar_chart(df_dist.set_index("panjang")["jumlah"])
            else:
                st.info("Belum ada data.")
        st.markdown("<p class='section-label'>Top 20 Kata Populer</p>", unsafe_allow_html=True)
        if not df_kata.empty:
            st.bar_chart(df_kata.set_index("kata")["frekuensi"])
        else:
            st.info("Belum ada data kata.")



# ============================================================
# PAGE HEADER helper
# ============================================================
def _page_header(title: str, subtitle: str = ""):
    st.markdown(
        f"<div style='padding:0 0 16px;border-bottom:1px solid #E2E8F0;margin-bottom:20px'>"
        f"<h1 style='font-size:20px;font-weight:700;color:#0F172A;letter-spacing:-.4px;margin:0 0 2px'>{title}</h1>"
        f"<p style='font-size:12px;color:#64748B;margin:0'>{subtitle}</p>"
        f"</div>",
        unsafe_allow_html=True,
    )


# ============================================================
# PAGE 1 — PDF & EMBED
# ============================================================
def page_pdf_embed():
    with st.sidebar:
        st.markdown(
            """<div style="padding:18px 12px 14px;border-bottom:1px solid rgba(255,255,255,.08);margin-bottom:16px">
  <p style="font-size:15px;font-weight:700;color:#F1F5F9;margin:0 0 2px;letter-spacing:-.3px">BPS Pekanbaru</p>
  <p style="font-size:11px;color:#475569;margin:0">Chatbot Admin Panel</p>
</div>""",
            unsafe_allow_html=True,
        )
        st.markdown(
            "<p style='font-size:10px;font-weight:600;color:#475569;text-transform:uppercase;"
            "letter-spacing:.7px;margin:0 0 10px;padding:0 4px'>🔑 API Credentials</p>",
            unsafe_allow_html=True,
        )
        saved        = load_credentials()
        gemini_key   = st.text_input("Gemini API Key",  type="password", value=saved.get("gemini_key", ""),   placeholder="AIzaSy...")
        st.markdown("<div style='height:2px'></div>", unsafe_allow_html=True)
        st.markdown(
            "<p style='font-size:10px;font-weight:600;color:#475569;text-transform:uppercase;"
            "letter-spacing:.7px;margin:10px 0 8px;padding:0 4px'>🗄️ Supabase Database</p>",
            unsafe_allow_html=True,
        )
        supabase_url = st.text_input("Supabase URL",    value=saved.get("supabase_url", ""),                  placeholder="https://xxx.supabase.co")
        supabase_key = st.text_input("Supabase Key",    type="password", value=saved.get("supabase_key", ""), placeholder="eyJh...")

        # Credential completeness indicator
        n_set = sum([bool(gemini_key), bool(supabase_url), bool(supabase_key)])
        if n_set == 3:
            st.markdown(
                "<div style='margin-top:10px;padding:7px 11px;border-radius:7px;"
                "background:rgba(34,197,94,.12);border:1px solid rgba(34,197,94,.25)'>"
                "<span style='font-size:11px;font-weight:600;color:#16a34a'>✓ Semua credentials siap</span>"
                "</div>",
                unsafe_allow_html=True,
            )
        elif n_set > 0:
            missing = []
            if not gemini_key:   missing.append("Gemini Key")
            if not supabase_url: missing.append("Supabase URL")
            if not supabase_key: missing.append("Supabase Key")
            st.markdown(
                f"<div style='margin-top:10px;padding:7px 11px;border-radius:7px;"
                f"background:rgba(245,158,11,.1);border:1px solid rgba(245,158,11,.25)'>"
                f"<span style='font-size:11px;font-weight:600;color:#b45309'>⚠ {n_set}/3 terisi</span>"
                f"<br><span style='font-size:10px;color:#92400e'>Perlu: {', '.join(missing)}</span>"
                f"</div>",
                unsafe_allow_html=True,
            )

        current = {"gemini_key": gemini_key, "supabase_url": supabase_url, "supabase_key": supabase_key}
        if current != {k: saved.get(k, "") for k in current}:
            save_credentials(current)

    cfg = {"gemini_key": gemini_key, "supabase_url": supabase_url, "supabase_key": supabase_key}
    _page_header("PDF & Embed", "Konversi PDF BPS → JSON → Embed ke Supabase untuk RAG Chatbot")

    tab1, tab2 = st.tabs(["📄 Proses PDF", "🧠 Embed ke Supabase"])
    with tab1:
        tab_process_pdf(cfg)
    with tab2:
        tab_embed_supabase(cfg)


# ============================================================
# PAGE 2 — DASHBOARD ADMIN
# ============================================================
def page_dashboard():
    with st.sidebar:
        st.markdown(
            """<div style="padding:18px 12px 14px;border-bottom:1px solid rgba(255,255,255,.08);margin-bottom:16px">
  <p style="font-size:15px;font-weight:700;color:#F1F5F9;margin:0 0 2px;letter-spacing:-.3px">BPS Pekanbaru</p>
  <p style="font-size:11px;color:#475569;margin:0">Chatbot Admin Panel</p>
</div>""",
            unsafe_allow_html=True,
        )
        st.markdown(
            "<p style='font-size:10px;font-weight:600;color:#475569;text-transform:uppercase;"
            "letter-spacing:.7px;margin:0 0 10px;padding:0 4px'>📊 Analytics</p>",
            unsafe_allow_html=True,
        )
        if st.button("↻ Refresh Data", use_container_width=True, key="sb_ref"):
            _db_conn.clear()
            st.rerun()
        st.markdown(
            f"<p style='font-size:10px;color:#475569;margin-top:8px;padding:0 2px'>"
            f"Terakhir update: {datetime.now().strftime('%H:%M:%S')}</p>",
            unsafe_allow_html=True,
        )

    _page_header("Dashboard Admin", "Real-time analytics dari Supabase PostgreSQL")

    # ── Fetch ──
    def q1(sql):
        df = _db_query(sql)
        return None if df.empty or df.iloc[0, 0] is None else df.iloc[0, 0]

    metrics = dict(
        total_pesan=q1("SELECT COUNT(*) FROM n8n_chat_histories"),
        total_human=q1("SELECT COUNT(*) FROM n8n_chat_histories WHERE message->>'type'='human'"),
        total_ai   =q1("SELECT COUNT(*) FROM n8n_chat_histories WHERE message->>'type'='ai'"),
        user_unik  =q1("SELECT COUNT(DISTINCT session_id) FROM n8n_chat_histories"),
        rata_rata  =q1("""SELECT ROUND(AVG(c)::numeric,1) FROM
                         (SELECT session_id,COUNT(*) c FROM n8n_chat_histories
                          WHERE message->>'type'='human' GROUP BY session_id) s"""),
    )
    df_bd   = _db_query("""SELECT CASE message->>'type'
                           WHEN 'human' THEN 'User' WHEN 'ai' THEN 'AI Bot' ELSE 'Lainnya' END AS tipe,
                           COUNT(*) AS jumlah FROM n8n_chat_histories GROUP BY 1 ORDER BY 2 DESC""")
    df_dist = _db_query("""SELECT CASE
                           WHEN LENGTH(message->>'content')<20  THEN '1-19'
                           WHEN LENGTH(message->>'content')<50  THEN '20-49'
                           WHEN LENGTH(message->>'content')<100 THEN '50-99'
                           WHEN LENGTH(message->>'content')<200 THEN '100-199'
                           ELSE '200+' END AS panjang, COUNT(*) AS jumlah
                           FROM n8n_chat_histories WHERE message->>'type'='human'
                           GROUP BY 1 ORDER BY MIN(LENGTH(message->>'content'))""")
    df_kata = _db_query("""WITH w AS (
                           SELECT LOWER(UNNEST(STRING_TO_ARRAY(
                             REGEXP_REPLACE(message->>'content','[^a-zA-Z0-9 ]',' ','g'),' '))) AS wd
                           FROM n8n_chat_histories WHERE message->>'type'='human')
                           SELECT wd AS kata, COUNT(*) AS frekuensi FROM w WHERE LENGTH(wd)>3
                           AND wd NOT IN ('yang','untuk','dengan','dari','atau','pada','adalah',
                             'bisa','saya','kamu','tidak','akan','sudah','juga','anda','mohon',
                             'maaf','bantu','lagi','ada','apa','ini','itu','mau','dan','berapa',
                             'bagaimana','tentang','data','informasi')
                           GROUP BY wd ORDER BY frekuensi DESC LIMIT 20""")

    _render_dashboard_charts(metrics, df_bd, df_dist, df_kata)

    st.divider()

    # ── CRUD ──
    crud1, crud2 = st.tabs(["👥 Manajemen User", "💬 Riwayat Chat"])

    with crud1:
        left, right = st.columns([3, 2], gap="large")
        with left:
            st.markdown("**Semua User Aktif**")
            df_u = _db_query("""
                SELECT ch.session_id,
                       COALESCE(uc.display_name, ch.session_id)  AS nama,
                       COALESCE(uc.phone_number, '-')             AS no_hp,
                       COUNT(*)                                    AS pesan,
                       TO_CHAR(uc.first_seen,'DD Mon YYYY')       AS pertama,
                       TO_CHAR(uc.last_seen, 'DD Mon YYYY')       AS terakhir
                FROM n8n_chat_histories ch
                LEFT JOIN user_contacts uc ON ch.session_id=uc.session_id
                GROUP BY ch.session_id, uc.display_name, uc.phone_number,
                         uc.first_seen, uc.last_seen
                ORDER BY COUNT(*) DESC""")
            if not df_u.empty:
                st.dataframe(df_u.drop(columns=["session_id"]),
                             use_container_width=True, hide_index=True)
            else:
                st.info("Belum ada user.")

        with right:
            with st.form("fu_add"):
                st.markdown("**Tambah / Edit Kontak**")
                sid  = st.text_input("Session ID *")
                nama = st.text_input("Nama Tampilan")
                hp   = st.text_input("No. HP")
                if st.form_submit_button("💾 Simpan", use_container_width=True, type="primary"):
                    if not sid:
                        st.error("Session ID wajib.")
                    elif _db_exec("""INSERT INTO user_contacts
                            (session_id,display_name,phone_number,first_seen,last_seen,message_count)
                            VALUES(%s,%s,%s,NOW(),NOW(),0)
                            ON CONFLICT(session_id) DO UPDATE
                            SET display_name=EXCLUDED.display_name,
                                phone_number=EXCLUDED.phone_number,last_seen=NOW()""",
                            (sid, nama or None, hp or None)):
                        st.success("Disimpan.")
                        _db_conn.clear()
                        st.rerun()

            with st.form("fu_del"):
                st.markdown("**Hapus User**")
                del_sid  = st.text_input("Session ID")
                del_chat = st.checkbox("Hapus semua chat user ini juga")
                if st.form_submit_button("🗑️ Hapus", use_container_width=True):
                    if not del_sid:
                        st.error("Masukkan Session ID.")
                    else:
                        if del_chat:
                            _db_exec("DELETE FROM n8n_chat_histories WHERE session_id=%s", (del_sid,))
                        if _db_exec("DELETE FROM user_contacts WHERE session_id=%s", (del_sid,)):
                            st.success("Dihapus.")
                            _db_conn.clear()
                            st.rerun()

    with crud2:
        fc, fd = st.columns([2, 1], gap="large")
        with fc:
            filter_s = st.text_input("Filter Session ID (kosong = semua)", key="cf")
        with fd:
            st.markdown("<div style='height:26px'></div>", unsafe_allow_html=True)
            with st.popover("🗑️ Hapus Chat", use_container_width=True):
                if filter_s and st.button("Hapus semua chat user ini", key="dc1", use_container_width=True):
                    if _db_exec("DELETE FROM n8n_chat_histories WHERE session_id=%s", (filter_s,)):
                        st.success("Dihapus.")
                        _db_conn.clear()
                        st.rerun()
                if st.button("⚠️  Reset SEMUA chat", key="dc2", use_container_width=True, type="primary"):
                    if _db_exec("DELETE FROM n8n_chat_histories"):
                        st.success("Semua chat dihapus.")
                        _db_conn.clear()
                        st.rerun()

        sql_c = (
            f"""SELECT h.id, h.session_id,
                CASE h.message->>'type' WHEN 'human' THEN '👤 User' WHEN 'ai' THEN '🤖 Bot'
                ELSE h.message->>'type' END AS tipe,
                LEFT(h.message->>'content', 300) AS pesan
                FROM n8n_chat_histories h WHERE h.session_id='{filter_s}'
                ORDER BY h.id DESC LIMIT 100"""
            if filter_s else
            """SELECT h.id,
                COALESCE(uc.display_name, h.session_id) AS "user",
                CASE h.message->>'type' WHEN 'human' THEN '👤 User' WHEN 'ai' THEN '🤖 Bot'
                ELSE h.message->>'type' END AS tipe,
                LEFT(h.message->>'content', 200) AS pesan
                FROM n8n_chat_histories h
                LEFT JOIN user_contacts uc ON h.session_id=uc.session_id
                ORDER BY h.id DESC LIMIT 100"""
        )
        df_c = _db_query(sql_c)
        if not df_c.empty:
            st.dataframe(df_c, use_container_width=True, hide_index=True,
                column_config={
                    "id":    st.column_config.NumberColumn("ID", width="small"),
                    "tipe":  st.column_config.TextColumn("Tipe", width="small"),
                    "pesan": st.column_config.TextColumn("Pesan", width="large"),
                })
            with st.form("fc_del"):
                del_id = st.number_input("Hapus pesan ID:", min_value=1, step=1)
                if st.form_submit_button("🗑️ Hapus Pesan"):
                    if _db_exec("DELETE FROM n8n_chat_histories WHERE id=%s", (int(del_id),)):
                        st.success(f"Pesan #{del_id} dihapus.")
                        _db_conn.clear()
                        st.rerun()
        else:
            st.info("Tidak ada data.")


# ============================================================
# MAIN
# ============================================================
def main():
    pg = st.navigation([
        st.Page(page_pdf_embed, title="PDF & Embed",     icon="📄", default=True),
        st.Page(page_dashboard, title="Dashboard Admin", icon="📊"),
    ])
    pg.run()


if __name__ == "__main__":
    main()
