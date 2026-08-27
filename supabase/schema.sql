-- Orchestra Manager - Supabase schema
-- Run this in the Supabase SQL editor (Dashboard -> SQL Editor -> New query).
-- The backend connects with the service_role key, which bypasses Row Level
-- Security, so no RLS policies are required for these tables/buckets.

create extension if not exists "pgcrypto";

-- News / posts
create table if not exists public.posts (
  id uuid primary key,
  created_at timestamptz not null default now(),
  title text not null default '',
  content text not null default '',
  attachments jsonb not null default '[]'::jsonb,
  source_message_id text
);

create index if not exists posts_created_at_idx on public.posts (created_at desc);

-- Existing installs: add the column if the table predates it.
alter table public.posts add column if not exists source_message_id text;

-- Dedup emails without blocking manual posts (those have a null source_message_id).
create unique index if not exists posts_source_message_id_idx
  on public.posts (source_message_id)
  where source_message_id is not null;

-- Calendar events (free-form fields stored in `data`)
create table if not exists public.events (
  id uuid primary key,
  data jsonb not null default '{}'::jsonb
);

-- Music library folder/file tree
create table if not exists public.library_items (
  id uuid primary key,
  path text not null unique,
  name text not null,
  type text not null check (type in ('folder', 'file')),
  storage_key text,
  size bigint,
  mime_type text,
  created_at timestamptz not null default now()
);

-- Existing installs: add the column if the table predates it.
alter table public.library_items add column if not exists mime_type text;

create index if not exists library_items_path_idx on public.library_items (path);

-- Music catalog: the composition (what is performed)
create table if not exists public.catalog_works (
  id uuid primary key,
  composer text not null default '',
  title text not null default '',
  subtitle text,
  catalog_number text,
  arranger text,
  genre text,
  instrumentation text,
  duration_minutes integer,
  movements text,
  keywords text,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Music catalog: the physical set on the shelf (what is owned)
create table if not exists public.catalog_holdings (
  id uuid primary key,
  work_id uuid not null references public.catalog_works (id) on delete cascade,
  accession_no text,
  material_type text not null default 'owned'
    check (material_type in ('owned', 'rental', 'borrowed', 'manuscript')),
  publisher text,
  edition text,
  location_cabinet text,
  location_shelf text,
  location_slot text,
  parts_summary text,
  score_count integer,
  condition text,
  acquired_on date,
  rental_due_on date,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists catalog_works_composer_idx on public.catalog_works (lower(composer));
create index if not exists catalog_works_title_idx on public.catalog_works (lower(title));
create index if not exists catalog_holdings_work_id_idx on public.catalog_holdings (work_id);
create index if not exists catalog_works_composer_title_idx on public.catalog_works (composer, title);
create index if not exists catalog_works_instrumentation_idx on public.catalog_works (instrumentation);
create index if not exists catalog_works_duration_idx on public.catalog_works (duration_minutes);

-- Fast librarian search: one denormalized document per work, including holdings.
create extension if not exists pg_trgm;

alter table public.catalog_works
  add column if not exists search_text text not null default '';
alter table public.catalog_works
  add column if not exists holding_count integer not null default 0;
alter table public.catalog_works
  add column if not exists location_sort text not null default '';

do $$
begin
  if not exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'catalog_works'
      and column_name = 'work_key'
  ) then
    alter table public.catalog_works
      add column work_key text generated always as (
        lower(btrim(regexp_replace(composer, '\s+', ' ', 'g')))
        || '|'
        || lower(btrim(regexp_replace(title, '\s+', ' ', 'g')))
      ) stored;
  end if;
end $$;

create index if not exists catalog_works_work_key_idx on public.catalog_works (work_key);
create index if not exists catalog_works_search_trgm_idx
  on public.catalog_works using gin (search_text gin_trgm_ops);
create index if not exists catalog_works_holding_count_idx on public.catalog_works (holding_count);
create index if not exists catalog_works_location_sort_idx on public.catalog_works (location_sort);

create or replace function public.catalog_holding_label(h public.catalog_holdings)
returns text
language sql
stable
as $$
  select concat_ws(
    ' - ',
    nullif(btrim(coalesce(h.accession_no, '')), ''),
    nullif(
      concat_ws(
        ' / ',
        nullif(btrim(coalesce(h.location_cabinet, '')), ''),
        nullif(btrim(coalesce(h.location_shelf, '')), ''),
        nullif(btrim(coalesce(h.location_slot, '')), '')
      ),
      ''
    )
  );
$$;

create or replace function public.refresh_catalog_work_cache(p_work_id uuid)
returns void
language plpgsql
as $$
declare
  v_count integer;
  v_location text;
  v_holding_search text;
  v_search text;
begin
  select
    count(*)::integer,
    string_agg(public.catalog_holding_label(h), '; ' order by h.accession_no, h.id),
    string_agg(
      concat_ws(
        ' ',
        h.accession_no,
        h.material_type,
        h.publisher,
        h.edition,
        h.location_cabinet,
        h.location_shelf,
        h.location_slot,
        h.parts_summary,
        h.condition,
        h.notes
      ),
      ' '
    )
  into v_count, v_location, v_holding_search
  from public.catalog_holdings h
  where h.work_id = p_work_id;

  select lower(concat_ws(
    ' ',
    w.composer,
    w.title,
    w.subtitle,
    w.catalog_number,
    w.arranger,
    w.genre,
    w.instrumentation,
    w.movements,
    w.keywords,
    w.notes,
    v_holding_search
  ))
  into v_search
  from public.catalog_works w
  where w.id = p_work_id;

  if not found then
    return;
  end if;

  update public.catalog_works
  set
    holding_count = coalesce(v_count, 0),
    location_sort = coalesce(v_location, ''),
    search_text = coalesce(v_search, '')
  where id = p_work_id;
end;
$$;

create or replace function public.catalog_works_cache_trigger()
returns trigger
language plpgsql
as $$
begin
  perform public.refresh_catalog_work_cache(new.id);
  return new;
end;
$$;

create or replace function public.catalog_holdings_cache_trigger()
returns trigger
language plpgsql
as $$
begin
  if tg_op = 'DELETE' then
    perform public.refresh_catalog_work_cache(old.work_id);
    return old;
  end if;

  perform public.refresh_catalog_work_cache(new.work_id);
  if tg_op = 'UPDATE' and new.work_id is distinct from old.work_id then
    perform public.refresh_catalog_work_cache(old.work_id);
  end if;
  return new;
end;
$$;

drop trigger if exists catalog_works_cache_trigger on public.catalog_works;
create trigger catalog_works_cache_trigger
after insert or update of
  composer,
  title,
  subtitle,
  catalog_number,
  arranger,
  genre,
  instrumentation,
  movements,
  keywords,
  notes
on public.catalog_works
for each row
execute function public.catalog_works_cache_trigger();

drop trigger if exists catalog_holdings_cache_trigger on public.catalog_holdings;
create trigger catalog_holdings_cache_trigger
after insert or update or delete on public.catalog_holdings
for each row
execute function public.catalog_holdings_cache_trigger();

-- One-time fill for rows that predate the cache columns.
update public.catalog_works w
set
  holding_count = coalesce(s.cnt, 0),
  location_sort = coalesce(s.loc, ''),
  search_text = lower(concat_ws(
    ' ',
    w.composer,
    w.title,
    w.subtitle,
    w.catalog_number,
    w.arranger,
    w.genre,
    w.instrumentation,
    w.movements,
    w.keywords,
    w.notes,
    s.search_extra
  ))
from (
  select
    w2.id,
    h.cnt,
    h.loc,
    h.search_extra
  from public.catalog_works w2
  left join (
    select
      work_id,
      count(*)::integer as cnt,
      string_agg(public.catalog_holding_label(catalog_holdings), '; ' order by accession_no, id) as loc,
      string_agg(
        concat_ws(
          ' ',
          accession_no,
          material_type,
          publisher,
          edition,
          location_cabinet,
          location_shelf,
          location_slot,
          parts_summary,
          condition,
          notes
        ),
        ' '
      ) as search_extra
    from public.catalog_holdings
    group by work_id
  ) h on h.work_id = w2.id
) s
where w.id = s.id
  and (
    w.search_text = ''
    or w.holding_count is distinct from coalesce(s.cnt, 0)
    or w.location_sort is distinct from coalesce(s.loc, '')
  );

-- Accession numbers identify a physical set, but not every set has one.
create unique index if not exists catalog_holdings_accession_no_idx
  on public.catalog_holdings (accession_no)
  where accession_no is not null;

-- Private storage buckets for the actual file bytes
insert into storage.buckets (id, name, public)
values ('library', 'library', false)
on conflict (id) do nothing;

insert into storage.buckets (id, name, public)
values ('posts', 'posts', false)
on conflict (id) do nothing;
