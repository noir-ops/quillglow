-- Phase 2 · RAG knowledge base
--
-- Design constraints that drove this schema:
--
-- 1. EMBEDDING SPACES ARE NOT INTERCHANGEABLE. A vector from OpenAI's
--    text-embedding-3-small cannot be compared to one from gemini-embedding-001.
--    The chat provider can be switched freely in the admin panel; the EMBEDDING
--    provider cannot, without re-indexing everything. So every chunk records the
--    model that produced it, and retrieval filters on the active model. Switching
--    degrades to "no results" rather than silently returning garbage matches.
--
-- 2. DIMENSION IS FIXED AT 1536. OpenAI text-embedding-3-small is natively 1536.
--    gemini-embedding-001 defaults to 3072 but supports Matryoshka truncation to
--    1536 with no measurable quality loss. Standardising on 1536 keeps one column
--    and one index. (Truncated Gemini vectors need manual L2 normalisation —
--    handled in lib/ai/rag/embeddings.ts.)
--
-- 3. TENANT ISOLATION IS ENFORCED IN THE DATABASE, NOT APPLICATION CODE. Without
--    namespace + owner scoping in RLS, one student's uploaded notes surface in
--    another student's retrieval.

create extension if not exists vector;

-- ── Sources ─────────────────────────────────────────────────────────────────
create table if not exists public.knowledge_sources (
  id uuid primary key default gen_random_uuid(),
  namespace text not null,
    -- syllabus_waec | syllabus_jamb | syllabus_sat | syllabus_igcse | syllabus_act
    -- scholarships | marketplace | user_upload
  owner_id uuid references auth.users(id) on delete cascade,  -- null = global/shared
  title text not null,
  source_type text not null default 'text',   -- text | pdf | url | syllabus | dataset
  uri text,
  checksum text,                              -- skip re-embedding unchanged content
  concept_id uuid references public.learning_concepts(id) on delete set null,
  status text not null default 'pending',     -- pending | indexing | indexed | failed
  error text,
  chunk_count int not null default 0,
  metadata jsonb not null default '{}',
  created_at timestamptz not null default now(),
  indexed_at timestamptz
);

create index if not exists knowledge_sources_ns_owner_idx
  on public.knowledge_sources (namespace, owner_id);
create index if not exists knowledge_sources_status_idx
  on public.knowledge_sources (status) where status in ('pending', 'indexing');
create unique index if not exists knowledge_sources_checksum_idx
  on public.knowledge_sources (namespace, coalesce(owner_id, '00000000-0000-0000-0000-000000000000'::uuid), checksum)
  where checksum is not null;

alter table public.knowledge_sources enable row level security;

drop policy if exists "read global or own sources" on public.knowledge_sources;
create policy "read global or own sources"
  on public.knowledge_sources for select to authenticated
  using (owner_id is null or owner_id = auth.uid());

-- ── Chunks ──────────────────────────────────────────────────────────────────
create table if not exists public.knowledge_chunks (
  id bigserial primary key,
  source_id uuid not null references public.knowledge_sources(id) on delete cascade,
  namespace text not null,
  owner_id uuid,                              -- denormalised from source, for RLS + index
  concept_id uuid references public.learning_concepts(id) on delete set null,
  chunk_index int not null default 0,
  content text not null,
  token_count int,
  embedding vector(1536),
  -- Provenance. Retrieval filters on this so vectors from different models are
  -- never compared against each other.
  embedding_model text not null default 'text-embedding-3-small',
  metadata jsonb not null default '{}',
  created_at timestamptz not null default now()
);

-- Approximate-nearest-neighbour index. `lists` should be roughly rows/1000;
-- rebuild it after bulk-loading a large corpus.
create index if not exists knowledge_chunks_embedding_idx
  on public.knowledge_chunks using ivfflat (embedding vector_cosine_ops)
  with (lists = 100);

create index if not exists knowledge_chunks_ns_owner_idx
  on public.knowledge_chunks (namespace, owner_id);
create index if not exists knowledge_chunks_source_idx
  on public.knowledge_chunks (source_id);
create index if not exists knowledge_chunks_concept_idx
  on public.knowledge_chunks (concept_id);
create index if not exists knowledge_chunks_model_idx
  on public.knowledge_chunks (embedding_model);

-- Lexical half of hybrid search.
create index if not exists knowledge_chunks_fts_idx
  on public.knowledge_chunks using gin (to_tsvector('english', content));

alter table public.knowledge_chunks enable row level security;

drop policy if exists "read global or own chunks" on public.knowledge_chunks;
create policy "read global or own chunks"
  on public.knowledge_chunks for select to authenticated
  using (owner_id is null or owner_id = auth.uid());

-- ── Hybrid retrieval ────────────────────────────────────────────────────────
-- Vector similarity fused with lexical relevance via Reciprocal Rank Fusion.
-- Pure vector search misses exact terms (formula names, statute numbers); pure
-- keyword search misses paraphrase. RRF needs no score normalisation between
-- the two, which is what makes it robust across different corpora.
create or replace function public.search_knowledge(
  p_query_embedding vector(1536),
  p_query_text      text,
  p_namespaces      text[],
  p_user_id         uuid default null,
  p_embedding_model text default 'text-embedding-3-small',
  p_match_count     int  default 8,
  p_concept_id      uuid default null
)
returns table (
  id bigint,
  source_id uuid,
  namespace text,
  content text,
  concept_id uuid,
  metadata jsonb,
  similarity float,
  score float
)
language sql
stable
security definer
set search_path = public
as $$
with scoped as (
  select c.*
  from public.knowledge_chunks c
  where c.namespace = any(p_namespaces)
    and c.embedding_model = p_embedding_model
    -- Global content, or content this user owns. Never another user's.
    and (c.owner_id is null or c.owner_id = p_user_id)
    and (p_concept_id is null or c.concept_id = p_concept_id)
),
vector_hits as (
  select s.id,
         row_number() over (order by s.embedding <=> p_query_embedding) as rank,
         1 - (s.embedding <=> p_query_embedding) as similarity
  from scoped s
  where s.embedding is not null
  order by s.embedding <=> p_query_embedding
  limit p_match_count * 4
),
lexical_hits as (
  select s.id,
         row_number() over (
           order by ts_rank(to_tsvector('english', s.content),
                            plainto_tsquery('english', p_query_text)) desc
         ) as rank
  from scoped s
  where p_query_text is not null
    and to_tsvector('english', s.content) @@ plainto_tsquery('english', p_query_text)
  limit p_match_count * 4
),
fused as (
  select coalesce(v.id, l.id) as id,
         coalesce(1.0 / (60 + v.rank), 0) + coalesce(1.0 / (60 + l.rank), 0) as score,
         coalesce(v.similarity, 0) as similarity
  from vector_hits v
  full outer join lexical_hits l on l.id = v.id
)
select c.id, c.source_id, c.namespace, c.content, c.concept_id, c.metadata,
       f.similarity::float, f.score::float
from fused f
join public.knowledge_chunks c on c.id = f.id
order by f.score desc
limit p_match_count;
$$;

grant execute on function public.search_knowledge(vector, text, text[], uuid, text, int, uuid) to authenticated;

-- ── Index health ────────────────────────────────────────────────────────────
-- Shows whether the corpus matches the active embedding model. If the admin
-- switches embedding provider, this is how you see what needs re-indexing.
create or replace view public.knowledge_index_status as
select
  namespace,
  embedding_model,
  count(*) as chunk_count,
  count(*) filter (where embedding is null) as unembedded,
  count(distinct source_id) as source_count,
  max(created_at) as last_indexed
from public.knowledge_chunks
group by namespace, embedding_model;
