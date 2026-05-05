"""
BPS Kota Pekanbaru Crawler v2
Uses cloudscraper to bypass Cloudflare
"""

import csv
import hashlib
import json
import os
import re
import time
from datetime import datetime
from pathlib import Path

import cloudscraper
from bs4 import BeautifulSoup
from openpyxl import Workbook

# ============================================================
# CONFIG
# ============================================================
BASE_URL = "https://pekanbarukota.bps.go.id"
OUTPUT_DIR = Path("output")
PDF_DIR = OUTPUT_DIR / "pdfs"
OUTPUT_DIR.mkdir(exist_ok=True)
PDF_DIR.mkdir(exist_ok=True)

scraper = cloudscraper.create_scraper(
    browser={"browser": "chrome", "platform": "windows", "desktop": True}
)

seen_hashes = set()
all_data = []


def log(msg):
    print(msg, flush=True)


def content_hash(text):
    return hashlib.md5(text.strip().lower().encode()).hexdigest()


def clean_text(text):
    if not text:
        return ""
    text = re.sub(r"\s+", " ", text)
    text = text.strip()
    return text


def chunk_text(text, max_words=500):
    words = text.split()
    if len(words) <= max_words:
        return [text]

    chunks = []
    current = []
    for word in words:
        current.append(word)
        if len(current) >= max_words:
            chunk_str = " ".join(current)
            last_period = chunk_str.rfind(".")
            if last_period > len(chunk_str) * 0.5:
                chunks.append(chunk_str[: last_period + 1].strip())
                remaining = chunk_str[last_period + 1 :].strip()
                current = remaining.split() if remaining else []
            else:
                chunks.append(chunk_str)
                current = []
    if current:
        remainder = " ".join(current)
        if len(current) < 50 and chunks:
            chunks[-1] += " " + remainder
        else:
            chunks.append(remainder)
    return chunks


def add_record(title, content, source_url, date="", category=""):
    h = content_hash(content)
    if h in seen_hashes or len(content.strip()) < 30:
        return False
    seen_hashes.add(h)
    all_data.append({
        "title": clean_text(title),
        "content": clean_text(content),
        "source_url": source_url,
        "date": date,
        "category": category,
    })
    return True


def fetch(url, retries=3):
    for attempt in range(retries):
        try:
            r = scraper.get(url, timeout=30)
            if r.status_code == 200 and "Just a moment" not in r.text[:500]:
                return r
            time.sleep(2)
        except Exception as e:
            log(f"  Retry {attempt+1}/{retries} for {url}: {e}")
            time.sleep(3)
    return None


# ============================================================
# 1. CRAWL MAIN PAGE
# ============================================================
def crawl_main_page():
    log("\n[1/3] Crawling main page...")
    r = fetch(f"{BASE_URL}/id")
    if not r:
        log("  FAILED to fetch main page")
        return

    soup = BeautifulSoup(r.text, "lxml")
    for tag in soup(["script", "style", "noscript", "iframe"]):
        tag.decompose()

    blocks = []
    for tag in soup.find_all(["h1", "h2", "h3", "h4", "p", "li", "span"]):
        text = tag.get_text(strip=True)
        if len(text) > 30 and "cookie" not in text.lower() and "Hak Cipta" not in text:
            blocks.append(text)

    unique = list(dict.fromkeys(blocks))

    # Add as one record about general info
    if unique:
        combined = "\n\n".join(unique)
        add_record(
            title="Informasi Umum BPS Kota Pekanbaru",
            content=combined,
            source_url=f"{BASE_URL}/id",
            date=datetime.now().strftime("%Y-%m-%d"),
            category="Informasi Umum",
        )
    log(f"  Done. Extracted {len(unique)} text blocks")


# ============================================================
# 2. CRAWL STATISTICS TABLES
# ============================================================
def crawl_statistics():
    log("\n[2/3] Crawling statistics tables...")

    # Known BPS subject codes for Pekanbaru
    subjects = [
        519, 520, 521, 522, 523, 524, 525, 526, 527, 528, 529,
        530, 531, 532, 533, 534, 535, 536, 537, 538, 539, 540, 541, 542,
        12, 23, 26, 40, 151, 152, 153, 154, 155, 156, 157, 158, 159, 160,
    ]

    table_links = set()

    # Collect links from subject pages
    for subj in subjects:
        url = f"{BASE_URL}/id/statistics-table?subject={subj}"
        r = fetch(url)
        if not r:
            continue

        soup = BeautifulSoup(r.text, "lxml")
        for a in soup.find_all("a", href=True):
            href = a["href"]
            if "/statistics-table/" in href and href.endswith(".html"):
                full = href if href.startswith("http") else f"{BASE_URL}{href}"
                table_links.add(full)

        time.sleep(0.5)

    # Also try paginated listing
    for page_num in range(1, 30):
        url = f"{BASE_URL}/id/statistics-table?page={page_num}"
        r = fetch(url)
        if not r:
            break

        soup = BeautifulSoup(r.text, "lxml")
        found_new = False
        for a in soup.find_all("a", href=True):
            href = a["href"]
            if "/statistics-table/" in href and href.endswith(".html"):
                full = href if href.startswith("http") else f"{BASE_URL}{href}"
                if full not in table_links:
                    table_links.add(full)
                    found_new = True

        if not found_new:
            break
        time.sleep(0.5)

    log(f"  Found {len(table_links)} table links. Crawling details...")

    # Crawl each table
    for i, turl in enumerate(sorted(table_links)):
        try:
            r = fetch(turl)
            if not r:
                continue

            soup = BeautifulSoup(r.text, "lxml")
            for tag in soup(["script", "style", "noscript"]):
                tag.decompose()

            # Title
            title = ""
            for h in soup.find_all(["h1", "h2", "h3"]):
                t = h.get_text(strip=True)
                if len(t) > 10 and "Badan Pusat" not in t:
                    title = t
                    break
            if not title:
                title = soup.title.get_text(strip=True) if soup.title else f"Tabel {i+1}"

            # Table data
            table_rows = []
            for table in soup.find_all("table"):
                for row in table.find_all("tr"):
                    cells = [c.get_text(strip=True) for c in row.find_all(["th", "td"])]
                    row_text = " | ".join(cells)
                    if row_text.strip() and len(row_text) > 5:
                        table_rows.append(row_text)

            # Description
            desc_parts = []
            for p in soup.find_all("p"):
                text = p.get_text(strip=True)
                if len(text) > 30 and "cookie" not in text.lower():
                    desc_parts.append(text)

            content = f"Tabel Statistik: {title}\n\n"
            if table_rows:
                content += "\n".join(table_rows)
            if desc_parts:
                content += "\n\n" + "\n".join(desc_parts[:5])

            if len(content) > 60:
                add_record(title=title, content=content, source_url=turl, category="Tabel Statistik")

            if (i + 1) % 20 == 0:
                log(f"    {i+1}/{len(table_links)} tables processed")

            time.sleep(0.3)

        except Exception as e:
            log(f"    Error: {turl}: {e}")

    log(f"  Done. Total records so far: {len(all_data)}")


# ============================================================
# 3. CRAWL PRESS RELEASES
# ============================================================
def crawl_press_releases():
    log("\n[3/3] Crawling press releases...")

    pr_links = set()

    # Paginate through press release listing
    for page_num in range(1, 50):
        url = f"{BASE_URL}/id/pressrelease?page={page_num}"
        r = fetch(url)
        if not r:
            break

        soup = BeautifulSoup(r.text, "lxml")
        found_new = False

        for a in soup.find_all("a", href=True):
            href = a["href"]
            if "/pressrelease/" in href and href.endswith(".html"):
                full = href if href.startswith("http") else f"{BASE_URL}{href}"
                if full not in pr_links:
                    pr_links.add(full)
                    found_new = True

        if not found_new:
            break

        log(f"  Page {page_num}: total links = {len(pr_links)}")
        time.sleep(0.5)

    log(f"  Found {len(pr_links)} press release links. Crawling details...")

    # Crawl each press release
    for i, pr_url in enumerate(sorted(pr_links)):
        try:
            r = fetch(pr_url)
            if not r:
                continue

            soup = BeautifulSoup(r.text, "lxml")
            for tag in soup(["script", "style", "noscript"]):
                tag.decompose()

            # Title
            title = ""
            for h in soup.find_all(["h1", "h2", "h3"]):
                t = h.get_text(strip=True)
                if len(t) > 10:
                    title = t
                    break
            if not title:
                title = soup.title.get_text(strip=True) if soup.title else ""

            # Date from URL
            date_match = re.search(r"/(\d{4})/(\d{2})/(\d{2})/", pr_url)
            date = f"{date_match.group(1)}-{date_match.group(2)}-{date_match.group(3)}" if date_match else ""

            # Content
            content_parts = []
            for tag in soup.find_all(["p", "li"]):
                text = tag.get_text(strip=True)
                if len(text) > 20:
                    content_parts.append(text)

            content = "\n\n".join(dict.fromkeys(content_parts))

            if content and title:
                add_record(
                    title=title, content=content, source_url=pr_url,
                    date=date, category="Berita Resmi Statistik",
                )

            # Download PDFs
            for a in soup.find_all("a", href=True):
                href = a["href"]
                link_text = a.get_text(strip=True).lower()
                if href.endswith(".pdf") or "download" in link_text:
                    pdf_url = href if href.startswith("http") else f"{BASE_URL}{href}"
                    try:
                        pdf_r = scraper.get(pdf_url, timeout=30)
                        if pdf_r.status_code == 200 and len(pdf_r.content) > 1000:
                            fname = pdf_url.split("/")[-1]
                            if not fname.endswith(".pdf"):
                                fname = f"brs_{i+1}.pdf"
                            with open(PDF_DIR / fname, "wb") as f:
                                f.write(pdf_r.content)
                            log(f"    Downloaded: {fname}")
                    except:
                        pass

            if (i + 1) % 20 == 0:
                log(f"    {i+1}/{len(pr_links)} press releases processed")

            time.sleep(0.3)

        except Exception as e:
            log(f"    Error: {pr_url}: {e}")

    log(f"  Done. Total records: {len(all_data)}")


# ============================================================
# OUTPUT
# ============================================================
def generate_outputs():
    log(f"\n[OUTPUT] Generating files ({len(all_data)} records)...")

    chunked = []
    cid = 1
    for rec in all_data:
        for chunk in chunk_text(rec["content"]):
            chunked.append({
                "id": cid,
                "title": rec["title"],
                "content": chunk,
                "source_url": rec["source_url"],
                "date": rec["date"],
                "category": rec["category"],
            })
            cid += 1

    log(f"  Total chunks: {len(chunked)}")

    # TXT
    with open(OUTPUT_DIR / "bps_pekanbaru.txt", "w", encoding="utf-8") as f:
        for item in chunked:
            f.write(f"--- CHUNK {item['id']} ---\n")
            f.write(f"Title: {item['title']}\n")
            f.write(f"Category: {item['category']}\n")
            f.write(f"Date: {item['date']}\n")
            f.write(f"Source: {item['source_url']}\n")
            f.write(f"\n{item['content']}\n\n{'='*60}\n\n")

    # CSV
    with open(OUTPUT_DIR / "bps_pekanbaru.csv", "w", encoding="utf-8", newline="") as f:
        w = csv.DictWriter(f, fieldnames=["id", "title", "content", "source_url", "date", "category"])
        w.writeheader()
        w.writerows(chunked)

    # XLSX
    wb = Workbook()
    ws = wb.active
    ws.title = "BPS Pekanbaru"
    ws.append(["id", "title", "content", "source_url", "date", "category"])
    for item in chunked:
        ws.append([item["id"], item["title"], item["content"], item["source_url"], item["date"], item["category"]])
    wb.save(OUTPUT_DIR / "bps_pekanbaru.xlsx")

    log(f"  Files saved to {OUTPUT_DIR.absolute()}")
    return chunked


# ============================================================
# MAIN
# ============================================================
if __name__ == "__main__":
    log(f"BPS Kota Pekanbaru Crawler v2")
    log(f"Start: {datetime.now()}")

    crawl_main_page()
    crawl_statistics()
    crawl_press_releases()

    data = generate_outputs()

    log(f"\nComplete!")
    log(f"  Records: {len(all_data)}")
    log(f"  Chunks: {len(data)}")
    log(f"  PDFs: {len(list(PDF_DIR.glob('*.pdf')))}")
    log(f"End: {datetime.now()}")
