"""
Embedder — Generate embedding vectors menggunakan Gemini API.
Model: gemini-embedding-001 dengan outputDimensionality=768 (cocok dengan n8n retriever).
"""

import time
import google.generativeai as genai

EMBEDDING_MODEL = "models/gemini-embedding-001"
OUTPUT_DIM = 768
EMBED_BATCH_SIZE = 10
RETRY_DELAY = 2
MAX_RETRIES = 3


def init_gemini(api_key: str):
    """Inisialisasi Gemini API."""
    genai.configure(api_key=api_key)


def embed_single(text: str) -> list[float]:
    """Embed satu teks, return vector 768 dimensi."""
    result = genai.embed_content(
        model=EMBEDDING_MODEL,
        content=text,
        task_type="retrieval_document",
        output_dimensionality=OUTPUT_DIM,
    )
    return result['embedding']


def embed_batch(
    texts: list[str],
    batch_size: int = EMBED_BATCH_SIZE,
    progress_callback=None,
    model_id: str = None,
) -> list[list[float]]:
    """
    Embed batch teks dengan retry logic.

    Args:
        texts: List teks yang akan di-embed
        batch_size: Jumlah teks per batch
        progress_callback: Callback(current, total)
        model_id: Embedding model ID (default: EMBEDDING_MODEL)

    Returns:
        List of embedding vectors
    """
    use_model = model_id or EMBEDDING_MODEL
    all_embeddings = []
    total = len(texts)

    for i in range(0, total, batch_size):
        batch = texts[i:i + batch_size]
        retries = 0

        while retries < MAX_RETRIES:
            try:
                batch_embeddings = []
                for text in batch:
                    result = genai.embed_content(
                        model=use_model,
                        content=text,
                        task_type="retrieval_document",
                        output_dimensionality=OUTPUT_DIM,
                    )
                    batch_embeddings.append(result['embedding'])
                    time.sleep(0.1)

                all_embeddings.extend(batch_embeddings)
                break

            except Exception as e:
                retries += 1
                if retries >= MAX_RETRIES:
                    raise Exception(f"Gagal embed batch setelah {MAX_RETRIES} retry: {e}")
                time.sleep(RETRY_DELAY * retries)

        if progress_callback:
            done = min(i + batch_size, total)
            progress_callback(done, total)

    return all_embeddings


def validate_embedding(embedding: list[float], expected_dim: int = OUTPUT_DIM) -> bool:
    """Validasi dimensi embedding."""
    return len(embedding) == expected_dim
