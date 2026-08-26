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
