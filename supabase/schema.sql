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
  attachments jsonb not null default '[]'::jsonb
);

create index if not exists posts_created_at_idx on public.posts (created_at desc);

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
  created_at timestamptz not null default now()
);

create index if not exists library_items_path_idx on public.library_items (path);

-- Private storage buckets for the actual file bytes
insert into storage.buckets (id, name, public)
values ('library', 'library', false)
on conflict (id) do nothing;

insert into storage.buckets (id, name, public)
values ('posts', 'posts', false)
on conflict (id) do nothing;
