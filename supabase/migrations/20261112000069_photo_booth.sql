-- Guest photo booth stills.
-- Photos are guest images. The bucket is private. Rows are readable only with the
-- service role. Guests get an unguessable link; the database stores a SHA-256 hash.
-- There is intentionally no anon or staff select policy and no public listing.

create table public.photo_booth_captures (
  id uuid primary key default gen_random_uuid(),
  venue_id uuid not null references public.venues (id) on delete cascade,
  storage_path text not null,
  token_hash text not null unique,
  byte_size integer not null check (byte_size > 0 and byte_size <= 1800000),
  content_type text not null default 'image/jpeg' check (content_type = 'image/jpeg'),
  event_label text check (event_label is null or char_length(event_label) <= 60),
  created_at timestamptz not null default now(),
  expires_at timestamptz not null,
  purged_at timestamptz,
  check (expires_at > created_at)
);

comment on table public.photo_booth_captures is
  'Guest photo booth stills. Unlisted, looked up by token hash, deleted after expires_at.';

create index photo_booth_captures_due_purge_idx
  on public.photo_booth_captures (expires_at)
  where purged_at is null;

create table public.photo_booth_rate_hits (
  id bigint generated always as identity primary key,
  bucket_key text not null,
  created_at timestamptz not null default now()
);

create index photo_booth_rate_hits_bucket_idx
  on public.photo_booth_rate_hits (bucket_key, created_at);

alter table public.photo_booth_captures enable row level security;
alter table public.photo_booth_rate_hits enable row level security;

revoke all on table public.photo_booth_captures from public, anon, authenticated;
revoke all on table public.photo_booth_rate_hits from public, anon, authenticated;

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('photo-booth', 'photo-booth', false, 1800000, array['image/jpeg']::text[])
on conflict (id) do update
set public = excluded.public,
    file_size_limit = excluded.file_size_limit,
    allowed_mime_types = excluded.allowed_mime_types;

notify pgrst, 'reload schema';
