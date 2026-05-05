"""
Supabase Client — Operasi CRUD ke Supabase untuk documents dan ingested_files.
"""

import json
import time
from supabase import create_client, Client
SUPABASE_TABLE = "documents"
INGESTED_TABLE = "ingested_files"
INSERT_BATCH_SIZE = 50
RETRY_DELAY = 2
MAX_RETRIES = 3


class SupabaseRAG:
    """Client untuk operasi RAG di Supabase."""

    def __init__(self, url: str, key: str):
        self.client: Client = create_client(url, key)

    def get_existing_files(self) -> list[str]:
        """Ambil daftar file yang sudah di-ingest."""
        try:
            result = self.client.table(INGESTED_TABLE).select("file_name").execute()
            return [row["file_name"] for row in result.data]
        except Exception:
            return []

    def get_document_count(self) -> int:
        """Hitung total dokumen di tabel."""
        try:
            result = self.client.table(SUPABASE_TABLE).select("id", count="exact").execute()
            return result.count or 0
        except Exception:
            return 0

    def get_documents_by_file(self, filename: str) -> int:
        """Hitung jumlah chunks untuk file tertentu."""
        try:
            result = self.client.table(SUPABASE_TABLE).select(
                "id", count="exact"
            ).contains("metadata", {"fileName": filename}).execute()
            return result.count or 0
        except Exception:
            return 0

    def insert_documents(
        self,
        chunks: list[dict],
        embeddings: list[list[float]],
        progress_callback=None,
    ) -> int:
        """
        Insert chunks + embeddings ke Supabase.

        Args:
            chunks: List of {"content": str, "metadata": dict}
            embeddings: List of embedding vectors
            progress_callback: Callback(inserted, total)

        Returns:
            Jumlah rows yang berhasil di-insert
        """
        total = len(chunks)
        inserted = 0

        for i in range(0, total, INSERT_BATCH_SIZE):
            batch_chunks = chunks[i:i + INSERT_BATCH_SIZE]
            batch_embeddings = embeddings[i:i + INSERT_BATCH_SIZE]

            rows = []
            for chunk, embedding in zip(batch_chunks, batch_embeddings):
                rows.append({
                    "content": chunk["content"],
                    "metadata": chunk["metadata"],
                    "embedding": embedding,
                })

            # Insert with retry
            retries = 0
            while retries < MAX_RETRIES:
                try:
                    self.client.table(SUPABASE_TABLE).insert(rows).execute()
                    inserted += len(rows)
                    break
                except Exception as e:
                    retries += 1
                    if retries >= MAX_RETRIES:
                        raise Exception(f"Gagal insert batch setelah {MAX_RETRIES} retry: {e}")
                    time.sleep(RETRY_DELAY * retries)

            if progress_callback:
                progress_callback(inserted, total)

        return inserted

    def mark_file_ingested(self, filename: str, file_id: str = "", chunk_count: int = 0):
        """Tandai file sebagai sudah di-ingest."""
        try:
            self.client.table(INGESTED_TABLE).insert({
                "file_name": filename,
                "file_id": file_id,
                "chunk_count": chunk_count,
                "ingested_at": time.strftime("%Y-%m-%dT%H:%M:%SZ"),
            }).execute()
        except Exception:
            pass  # Jangan gagalkan keseluruhan proses karena log

    def delete_file_documents(self, filename: str) -> int:
        """Hapus semua chunks untuk file tertentu (untuk re-embed)."""
        try:
            result = self.client.table(SUPABASE_TABLE).delete().contains(
                "metadata", {"fileName": filename}
            ).execute()
            # Hapus juga dari ingested_files
            self.client.table(INGESTED_TABLE).delete().eq(
                "file_name", filename
            ).execute()
            return len(result.data) if result.data else 0
        except Exception:
            return 0

    def get_stats(self) -> dict:
        """Ambil statistik keseluruhan."""
        try:
            doc_count = self.get_document_count()
            files = self.get_existing_files()
            return {
                "total_chunks": doc_count,
                "total_files": len(files),
                "files": files,
            }
        except Exception:
            return {"total_chunks": 0, "total_files": 0, "files": []}
