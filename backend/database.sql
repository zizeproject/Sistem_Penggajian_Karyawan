-- STRADIVARIUS PostgreSQL schema/reference only.
-- This schema is not connected to the current browser-local application.
-- There is no Auth provider, server, or public data policy in this setup.
-- RLS is enabled without policies: browser users cannot read payroll.
-- Do not expose or grant anon access to these tables.

create extension if not exists pgcrypto;

create table if not exists public.users (
  id_user uuid primary key default gen_random_uuid(),
  username text not null unique check (length(trim(username)) between 3 and 80),
  role text not null default 'viewer' check (role in ('admin', 'payroll', 'viewer')),
  created_at timestamptz not null default now()
);

create table if not exists public.departemen (
  id_departemen uuid primary key default gen_random_uuid(),
  nama_departemen text not null unique check (length(trim(nama_departemen)) between 1 and 120),
  deskripsi text not null default '',
  created_at timestamptz not null default now()
);

create table if not exists public.karyawan (
  id_karyawan uuid primary key default gen_random_uuid(),
  nama text not null check (length(trim(nama)) between 1 and 160),
  email text not null unique check (email = lower(trim(email))),
  no_hp text not null default '',
  jabatan text not null check (length(trim(jabatan)) between 1 and 120),
  gaji_pokok numeric(15,2) not null check (gaji_pokok >= 0),
  id_departemen uuid not null references public.departemen (id_departemen) on update cascade on delete restrict,
  created_at timestamptz not null default now()
);

create table if not exists public.penggajian (
  id_penggajian uuid primary key default gen_random_uuid(),
  id_karyawan uuid not null references public.karyawan (id_karyawan) on update cascade on delete restrict,
  periode date not null check (extract(day from periode) = 1),
  gaji_pokok numeric(15,2) not null check (gaji_pokok >= 0),
  tunjangan numeric(15,2) not null default 0 check (tunjangan >= 0),
  potongan numeric(15,2) not null default 0 check (potongan >= 0),
  total_gaji numeric(15,2) generated always as (gaji_pokok + tunjangan - potongan) stored,
  created_at timestamptz not null default now(),
  constraint penggajian_potongan_tidak_melebihi_pendapatan check (potongan <= gaji_pokok + tunjangan),
  constraint penggajian_karyawan_periode_unik unique (id_karyawan, periode)
);

create index if not exists karyawan_departemen_idx on public.karyawan (id_departemen);
create index if not exists karyawan_nama_idx on public.karyawan (nama);
create index if not exists penggajian_periode_idx on public.penggajian (periode desc);
create index if not exists penggajian_karyawan_idx on public.penggajian (id_karyawan);

alter table public.users enable row level security;
alter table public.departemen enable row level security;
alter table public.karyawan enable row level security;
alter table public.penggajian enable row level security;

revoke all on public.users, public.departemen, public.karyawan, public.penggajian from public, anon, authenticated;
