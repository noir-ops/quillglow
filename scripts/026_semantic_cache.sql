-- §27 · Semantic AI cache
--
-- The exact-hash cache in 022 only catches byte-identical prompts. Students
-- don't phrase things identically:
--   "What is photosynthesis?"
--   "explain photosynthesis"
--   "can you tell me about photosynthesis"
-- all deserve the same cached answer.
--
-- This adds an embedding-based nearest-neighbour lookup on top. Exact hash is
-- still tried first because it's free; the embedding lookup is the fallback.

create extension if not exists vector;

create table if not exists public.ai_semantic_cache (
  id bigserial primary key,
  task text not null,
  -- Normalized prompt, kept for inspection and debugging of bad cache hits.
  normalized_prompt text not null,
  embedding vector(1536) not null,
  response text not null,
  provider text not null,
  model text not null,
  input_tokens int not null default 0,
  output_tokens int not null default 0,
  hit_count int not null default 0,
  created_at timestamptz not null default now(),
  last_hit_at timestamptz,
  expires_at timestamptz not null
);

create index if not exists ai_semantic_cache_vec_idx
  on public.ai_semantic_cache using ivfflat (embedding vector_cosine_ops) with (lists = 50);
create index if not exists ai_semantic_cache_task_idx on public.ai_semantic_cache (task);
create index if not exists ai_semantic_cache_expiry_idx on public.ai_semantic_cache (expires_at);

alter table public.ai_semantic_cache enable row level security;
-- Server-side only. Never cache anything user-specific into this table — it is
-- shared across all students by design.

/**
 * Look up a semantically similar cached answer.
 *
 * The threshold is deliberately high (0.95 default). A loose threshold is worse
 * than no cache: "what is 25% of 80" and "what is 25% of 90" are highly similar
 * sentences with different correct answers. Precision matters far more than hit
 * rate here.
 */
create or replace function public.find_semantic_cache(
  p_task text,
  p_embedding vector(1536),
  p_threshold float default 0.95
)
returns table (
  id bigint,
  response text,
  provider text,
  model text,
  similarity float
)
language plpgsql security definer set search_path = public as $$
declare v_id bigint;
begin
  select c.id into v_id
  from public.ai_semantic_cache c
  where c.task = p_task
    and c.expires_at > now()
    and (1 - (c.embedding <=> p_embedding)) >= p_threshold
  order by c.embedding <=> p_embedding
  limit 1;

  if v_id is null then return; end if;

  update public.ai_semantic_cache
  set hit_count = hit_count + 1, last_hit_at = now()
  where public.ai_semantic_cache.id = v_id;

  return query
  select c.id, c.response, c.provider, c.model,
         (1 - (c.embedding <=> p_embedding))::float
  from public.ai_semantic_cache c
  where c.id = v_id;
end;
$$;

create or replace function public.store_semantic_cache(
  p_task text,
  p_normalized_prompt text,
  p_embedding vector(1536),
  p_response text,
  p_provider text,
  p_model text,
  p_input_tokens int default 0,
  p_output_tokens int default 0,
  p_ttl_seconds int default 604800
)
returns bigint
language plpgsql security definer set search_path = public as $$
declare v_id bigint;
begin
  insert into public.ai_semantic_cache (
    task, normalized_prompt, embedding, response, provider, model,
    input_tokens, output_tokens, expires_at
  ) values (
    p_task, p_normalized_prompt, p_embedding, p_response, p_provider, p_model,
    p_input_tokens, p_output_tokens, now() + make_interval(secs => p_ttl_seconds)
  )
  returning id into v_id;
  return v_id;
end;
$$;

create or replace function public.purge_expired_semantic_cache()
returns int
language plpgsql security definer set search_path = public as $$
declare v int;
begin
  delete from public.ai_semantic_cache where expires_at < now();
  get diagnostics v = row_count;
  return v;
end;
$$;

create or replace view public.ai_cache_effectiveness as
select
  task,
  count(*) as entries,
  sum(hit_count) as total_hits,
  round(avg(hit_count), 2) as avg_hits_per_entry,
  count(*) filter (where hit_count = 0) as never_hit
from public.ai_semantic_cache
group by task;
