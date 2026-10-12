-- VOGUEPAY public Supabase schema.
-- Run in the Supabase SQL Editor. All payroll and employee data is public
-- and can be read, inserted, updated, or deleted without signing in.

drop view if exists public.karyawan_direktori;
drop trigger if exists on_auth_user_created on auth.users;

do $$
declare
  policy_row record;
begin
  for policy_row in
    select schemaname, tablename, policyname
    from pg_policies
    where schemaname = 'public'
      and tablename in ('users', 'departemen', 'karyawan', 'penggajian')
  loop
    execute format('drop policy %I on %I.%I', policy_row.policyname, policy_row.schemaname, policy_row.tablename);
  end loop;
end;
$$;

drop function if exists public.handle_new_auth_user();
drop function if exists public.current_app_role();
drop function if exists public.delete_employee_with_payroll(uuid);

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

drop policy if exists departemen_public_access on public.departemen;
create policy departemen_public_access on public.departemen
  for all to anon, authenticated
  using (true) with check (true);

drop policy if exists karyawan_public_access on public.karyawan;
create policy karyawan_public_access on public.karyawan
  for all to anon, authenticated
  using (true) with check (true);

drop policy if exists penggajian_public_access on public.penggajian;
create policy penggajian_public_access on public.penggajian
  for all to anon, authenticated
  using (true) with check (true);

revoke all on public.users from public, anon, authenticated;
revoke all on public.departemen, public.karyawan, public.penggajian from public, anon, authenticated;
grant usage on schema public to anon, authenticated;
grant select, insert, update, delete on public.departemen, public.karyawan, public.penggajian to anon, authenticated;
