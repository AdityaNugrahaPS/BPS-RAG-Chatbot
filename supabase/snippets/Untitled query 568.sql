-- Enable pgvector extension
create extension if not exists vector;

-- Tabel utama: menyimpan chunks PDF + embedding
create table if not exists documents (
  id        bigserial primary key,
  content   text        not null,
  metadata  jsonb       default '{}',
  embedding vector(768)
);

-- Index untuk pencarian vector (cosine similarity)
create index if not exists documents_embedding_idx
  on documents
  using ivfflat (embedding vector_cosine_ops)
  with (lists = 100);

-- Tabel log: file yang sudah di-ingest
create table if not exists ingested_files (
  id          bigserial primary key,
  file_name   text        not null,
  file_id     text        default '',
  chunk_count int         default 0,
  ingested_at timestamptz default now()
);

-- Fungsi RPC untuk similarity search (dipakai n8n retriever)
create or replace function match_documents (
  query_embedding vector(768),
  match_count     int     default 5,
  filter          jsonb   default '{}'
)
returns table (
  id         bigint,
  content    text,
  metadata   jsonb,
  similarity float
)
language plpgsql
as $$
begin
  return query
  select
    d.id,
    d.content,
    d.metadata,
    1 - (d.embedding <=> query_embedding) as similarity
  from documents d
  where d.metadata @> filter
  order by d.embedding <=> query_embedding
  limit match_count;
end;
$$;
