"""
BPS Kota Pekanbaru - Complete Web Crawler
Crawls: Main page, Statistics Tables, Press Releases
Outputs: TXT, CSV, XLSX
"""

import asyncio
import csv
import json
import os
import re
import time
import hashlib
from datetime import datetime
from pathlib import Path

from playwright.async_api import async_playwright
from bs4 import BeautifulSoup
from openpyxl import Workbook

# ============================================================
# CONFIG
# ============================================================
BASE_URL = "https://pekanbarukota.bps.go.id/id"
OUTPUT_DIR = Path("output")
PDF_DIR = OUTPUT_DIR / "pdfs"
OUTPUT_DIR.mkdir(exist_ok=True)
PDF_DIR.mkdir(exist_ok=True)

HEADERS = {
    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
}

# Track seen content for deduplication
seen_hashes = set()
all_data = []  # Main collection


def content_hash(text):
    """Generate hash for dedup."""
    return hashlib.md5(text.strip().lower().encode()).hexdigest()


def chunk_text(text, min_words=100, max_words=500):
    """Split text into chunks of 300-500 words."""
    words = text.split()
    if len(words) <= max_words:
        return [text] if len(words) >= min_words else [text]

    chunks = []
    current = []
    for word in words:
        current.append(word)
        if len(current) >= max_words:
            # Try to break at sentence boundary
            chunk_text_str = " ".join(current)
            last_period = chunk_text_str.rfind(".")
            if last_period > len(chunk_text_str) * 0.6:
                chunks.append(chunk_text_str[: last_period + 1].strip())
                remaining = chunk_text_str[last_period + 1 :].strip()
                current = remaining.split() if remaining else []
            else:
                chunks.append(chunk_text_str)
                current = []

    if current:
        remainder = " ".join(current)
        if len(current) < min_words and chunks:
            chunks[-1] += " " + remainder
        else:
            chunks.append(remainder)

    return chunks


def clean_text(text):
    """Clean and normalize text."""
    if not text:
        return ""
    text = re.sub(r"\s+", " ", text)
    text = re.sub(r"\n\s*\n", "\n", text)
    text = text.strip()
    return text


def add_record(title, content, source_url, date="", category=""):
    """Add a record with deduplication."""
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


# ============================================================
# CRAWLERS
# ============================================================

async def crawl_main_page(page):
    """Crawl the main BPS page for general info."""
    print("\n📄 Crawling main page...")

    await page.goto(BASE_URL, wait_until="networkidle", timeout=60000)
    await page.wait_for_timeout(3000)

    html = await page.content()
    soup = BeautifulSoup(html, "lxml")

    # Remove scripts and styles
    for tag in soup(["script", "style", "noscript", "iframe"]):
        tag.decompose()

    # Extract featured statistics / key info
    # Look for any substantial content blocks
    content_blocks = []

    for tag in soup.find_all(["h1", "h2", "h3", "h4", "p", "div", "span", "li"]):
        text = tag.get_text(strip=True)
        if len(text) > 40 and "cookie" not in text.lower() and "©" not in text:
            content_blocks.append(text)

    # Deduplicate and add
    unique_blocks = list(dict.fromkeys(content_blocks))
    combined = "\n\n".join(unique_blocks)

    if combined:
        add_record(
            title="Informasi Umum BPS Kota Pekanbaru",
            content=combined,
            source_url=BASE_URL,
            date=datetime.now().strftime("%Y-%m-%d"),
            category="Informasi Umum",
        )

    print(f"  ✅ Extracted {len(unique_blocks)} content blocks from main page")


async def crawl_statistics_tables(page):
    """Crawl statistics tables - all subjects."""
    print("\n📊 Crawling statistics tables...")

    # First get list of all subjects
    url = f"{BASE_URL}/statistics-table"
    await page.goto(url, wait_until="networkidle", timeout=60000)
    await page.wait_for_timeout(3000)

    html = await page.content()
    soup = BeautifulSoup(html, "lxml")

    # Find all subject links
    subject_links = []
    for a in soup.find_all("a", href=True):
        href = a["href"]
        text = a.get_text(strip=True)
        if "subject=" in href and text:
            subject_links.append((text, href))

    print(f"  Found {len(subject_links)} subject categories")

    # Also try direct statistics table listing
    table_links = set()
    for a in soup.find_all("a", href=True):
        href = a["href"]
        if "/statistics-table/" in href and href != url:
            full_url = href if href.startswith("http") else f"https://pekanbarukota.bps.go.id{href}"
            table_links.add(full_url)

    # Crawl the main listing with pagination
    page_num = 1
    max_pages = 20

    while page_num <= max_pages:
        list_url = f"{BASE_URL}/statistics-table?page={page_num}"
        print(f"  📃 Page {page_num}: {list_url}")

        await page.goto(list_url, wait_until="networkidle", timeout=60000)
        await page.wait_for_timeout(2000)

        html = await page.content()
        soup = BeautifulSoup(html, "lxml")

        # Find table links
        new_links = set()
        for a in soup.find_all("a", href=True):
            href = a["href"]
            if "/statistics-table/" in href and "/statistics-table?" not in href:
                full_url = href if href.startswith("http") else f"https://pekanbarukota.bps.go.id{href}"
                if full_url not in table_links:
                    new_links.add(full_url)
                    table_links.add(full_url)

        if not new_links:
            print(f"  No new links on page {page_num}, stopping.")
            break

        print(f"    Found {len(new_links)} new table links (total: {len(table_links)})")
        page_num += 1
        await page.wait_for_timeout(1000)

    # Crawl individual statistics tables
    print(f"\n  📊 Crawling {len(table_links)} individual statistics tables...")

    for i, table_url in enumerate(sorted(table_links)):
        try:
            await page.goto(table_url, wait_until="networkidle", timeout=30000)
            await page.wait_for_timeout(2000)

            html = await page.content()
            soup = BeautifulSoup(html, "lxml")

            # Remove scripts/styles
            for tag in soup(["script", "style", "noscript"]):
                tag.decompose()

            # Extract title
            title = ""
            for h in soup.find_all(["h1", "h2", "h3"]):
                t = h.get_text(strip=True)
                if len(t) > 10 and "BPS" not in t and "Badan" not in t:
                    title = t
                    break

            if not title:
                title_tag = soup.find("title")
                title = title_tag.get_text(strip=True) if title_tag else f"Tabel Statistik {i+1}"

            # Extract table data
            tables = soup.find_all("table")
            table_text_parts = []

            for table in tables:
                rows = table.find_all("tr")
                for row in rows:
                    cells = row.find_all(["th", "td"])
                    row_text = " | ".join(c.get_text(strip=True) for c in cells)
                    if row_text.strip():
                        table_text_parts.append(row_text)

            # Also extract any descriptive text
            desc_parts = []
            for p in soup.find_all(["p", "div"]):
                text = p.get_text(strip=True)
                if len(text) > 40 and "cookie" not in text.lower():
                    desc_parts.append(text)

            content = ""
            if table_text_parts:
                content = f"Tabel: {title}\n\n" + "\n".join(table_text_parts)
            if desc_parts:
                content += "\n\n" + "\n".join(desc_parts[:5])

            if content:
                add_record(
                    title=title,
                    content=content,
                    source_url=table_url,
                    date="",
                    category="Tabel Statistik",
                )

            if (i + 1) % 10 == 0:
                print(f"    Processed {i+1}/{len(table_links)} tables")

            await page.wait_for_timeout(500)

        except Exception as e:
            print(f"    ⚠️ Error on {table_url}: {e}")
            continue

    print(f"  ✅ Finished statistics tables. Total records: {len(all_data)}")


async def crawl_press_releases(page):
    """Crawl press releases with pagination."""
    print("\n📰 Crawling press releases...")

    pr_links = set()
    page_num = 1
    max_pages = 30

    while page_num <= max_pages:
        url = f"{BASE_URL}/pressrelease?page={page_num}"
        print(f"  📃 Page {page_num}: {url}")

        try:
            await page.goto(url, wait_until="networkidle", timeout=60000)
            await page.wait_for_timeout(3000)

            html = await page.content()
            soup = BeautifulSoup(html, "lxml")

            # Find press release links
            new_links = set()
            for a in soup.find_all("a", href=True):
                href = a["href"]
                if "/pressrelease/" in href and href.endswith(".html"):
                    full_url = href if href.startswith("http") else f"https://pekanbarukota.bps.go.id{href}"
                    if full_url not in pr_links:
                        new_links.add(full_url)
                        pr_links.add(full_url)

            if not new_links:
                print(f"  No new links on page {page_num}, stopping.")
                break

            print(f"    Found {len(new_links)} new press release links (total: {len(pr_links)})")
            page_num += 1
            await page.wait_for_timeout(1000)

        except Exception as e:
            print(f"    ⚠️ Error on page {page_num}: {e}")
            break

    # Crawl individual press releases
    print(f"\n  📰 Crawling {len(pr_links)} individual press releases...")

    for i, pr_url in enumerate(sorted(pr_links)):
        try:
            await page.goto(pr_url, wait_until="networkidle", timeout=30000)
            await page.wait_for_timeout(2000)

            html = await page.content()
            soup = BeautifulSoup(html, "lxml")

            for tag in soup(["script", "style", "noscript"]):
                tag.decompose()

            # Extract title
            title = ""
            for h in soup.find_all(["h1", "h2", "h3"]):
                t = h.get_text(strip=True)
                if len(t) > 10:
                    title = t
                    break

            if not title:
                title_tag = soup.find("title")
                title = title_tag.get_text(strip=True) if title_tag else ""

            # Extract date from URL or content
            date_match = re.search(r"/(\d{4})/(\d{2})/(\d{2})/", pr_url)
            date = f"{date_match.group(1)}-{date_match.group(2)}-{date_match.group(3)}" if date_match else ""

            # Extract content
            content_parts = []
            for tag in soup.find_all(["p", "li", "td", "th"]):
                text = tag.get_text(strip=True)
                if len(text) > 20:
                    content_parts.append(text)

            content = "\n\n".join(dict.fromkeys(content_parts))  # dedup preserving order

            if content and title:
                add_record(
                    title=title,
                    content=content,
                    source_url=pr_url,
                    date=date,
                    category="Berita Resmi Statistik",
                )

            # Check for PDF download links
            for a in soup.find_all("a", href=True):
                href = a["href"]
                if href.endswith(".pdf") or "download" in href.lower():
                    pdf_url = href if href.startswith("http") else f"https://pekanbarukota.bps.go.id{href}"
                    pdf_name = pdf_url.split("/")[-1]
                    if not pdf_name.endswith(".pdf"):
                        pdf_name = f"brs_{i+1}.pdf"

                    try:
                        import cloudscraper
                        scraper = cloudscraper.create_scraper()
                        pdf_r = scraper.get(pdf_url, timeout=30)
                        if pdf_r.status_code == 200 and len(pdf_r.content) > 1000:
                            pdf_path = PDF_DIR / pdf_name
                            with open(pdf_path, "wb") as f:
                                f.write(pdf_r.content)
                            print(f"    📥 Downloaded PDF: {pdf_name}")
                    except:
                        pass

            if (i + 1) % 10 == 0:
                print(f"    Processed {i+1}/{len(pr_links)} press releases")

            await page.wait_for_timeout(500)

        except Exception as e:
            print(f"    ⚠️ Error on {pr_url}: {e}")
            continue

    print(f"  ✅ Finished press releases. Total records: {len(all_data)}")


# ============================================================
# OUTPUT GENERATORS
# ============================================================

def generate_outputs():
    """Generate TXT, CSV, XLSX files."""
    print(f"\n📁 Generating output files ({len(all_data)} records)...")

    # Chunk all content
    chunked_data = []
    chunk_id = 1

    for record in all_data:
        chunks = chunk_text(record["content"], min_words=50, max_words=500)
        for chunk in chunks:
            chunked_data.append({
                "id": chunk_id,
                "title": record["title"],
                "content": chunk,
                "source_url": record["source_url"],
                "date": record["date"],
                "category": record["category"],
            })
            chunk_id += 1

    print(f"  Total chunks: {len(chunked_data)}")

    # 1. TXT
    txt_path = OUTPUT_DIR / "bps_pekanbaru.txt"
    with open(txt_path, "w", encoding="utf-8") as f:
        for item in chunked_data:
            f.write(f"--- CHUNK {item['id']} ---\n")
            f.write(f"Title: {item['title']}\n")
            f.write(f"Category: {item['category']}\n")
            f.write(f"Date: {item['date']}\n")
            f.write(f"Source: {item['source_url']}\n")
            f.write(f"\n{item['content']}\n")
            f.write(f"\n{'='*60}\n\n")
    print(f"  ✅ TXT: {txt_path}")

    # 2. CSV
    csv_path = OUTPUT_DIR / "bps_pekanbaru.csv"
    with open(csv_path, "w", encoding="utf-8", newline="") as f:
        writer = csv.DictWriter(f, fieldnames=["id", "title", "content", "source_url", "date", "category"])
        writer.writeheader()
        writer.writerows(chunked_data)
    print(f"  ✅ CSV: {csv_path}")

    # 3. XLSX
    xlsx_path = OUTPUT_DIR / "bps_pekanbaru.xlsx"
    wb = Workbook()
    ws = wb.active
    ws.title = "BPS Pekanbaru Data"

    headers = ["id", "title", "content", "source_url", "date", "category"]
    ws.append(headers)

    for item in chunked_data:
        ws.append([item[h] for h in headers])

    wb.save(xlsx_path)
    print(f"  ✅ XLSX: {xlsx_path}")

    return chunked_data


# ============================================================
# MAIN
# ============================================================

async def main():
    print("🚀 BPS Kota Pekanbaru Crawler")
    print(f"   Start time: {datetime.now()}")
    print(f"   Output dir: {OUTPUT_DIR.absolute()}")

    async with async_playwright() as p:
        browser = await p.chromium.launch(headless=True)
        context = await browser.new_context(
            user_agent="Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
            viewport={"width": 1920, "height": 1080},
            locale="id-ID",
        )
        page = await context.new_page()

        try:
            # 1. Main page
            await crawl_main_page(page)

            # 2. Statistics tables
            await crawl_statistics_tables(page)

            # 3. Press releases
            await crawl_press_releases(page)

        except Exception as e:
            print(f"\n❌ Critical error: {e}")
            import traceback
            traceback.print_exc()

        finally:
            await browser.close()

    # Generate output files
    chunked_data = generate_outputs()

    print(f"\n🎉 Crawling complete!")
    print(f"   Total records: {len(all_data)}")
    print(f"   Total chunks: {len(chunked_data)}")
    print(f"   PDFs downloaded: {len(list(PDF_DIR.glob('*.pdf')))}")
    print(f"   End time: {datetime.now()}")


if __name__ == "__main__":
    asyncio.run(main())
