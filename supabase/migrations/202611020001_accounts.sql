begin;

create table public.profiles (
    id uuid primary key references auth.users (id) on delete cascade,
    display_name text not null default '' check (char_length(display_name) <= 80),
    updated_at timestamptz not null default now()
);

create table public.compositions (
    owner_id uuid not null references auth.users (id) on delete cascade,
    id uuid not null,
    document jsonb not null,
    updated_at timestamptz not null default now(),
    primary key (owner_id, id),
    check (jsonb_typeof(document) = 'object'),
    check (document ->> 'id' is not null and document ->> 'id' = id::text),
    check (document ->> 'schemaVersion' is not null and document ->> 'schemaVersion' = '1'),
    check (octet_length(document::text) <= 100000)
);

create index compositions_owner_updated on public.compositions (owner_id, updated_at desc, id);

alter table public.profiles enable row level security;
alter table public.compositions enable row level security;

revoke all on public.profiles, public.compositions from public, anon, authenticated;
grant select, insert, update on public.profiles, public.compositions to authenticated;

create policy profiles_select on public.profiles for select to authenticated using ((select auth.uid()) = id);
create policy profiles_insert on public.profiles for insert to authenticated with check ((select auth.uid()) = id);
create policy profiles_update on public.profiles for update to authenticated using ((select auth.uid()) = id) with check ((select auth.uid()) = id);

create policy compositions_select on public.compositions for select to authenticated using ((select auth.uid()) = owner_id);
create policy compositions_insert on public.compositions for insert to authenticated with check ((select auth.uid()) = owner_id);
create policy compositions_update on public.compositions for update to authenticated using ((select auth.uid()) = owner_id) with check ((select auth.uid()) = owner_id);

create function public.nuance_set_updated_at() returns trigger
language plpgsql set search_path = '' as $$
begin
    new.updated_at = pg_catalog.now();
    return new;
end;
$$;

create trigger profiles_updated before update on public.profiles for each row execute function public.nuance_set_updated_at();
create trigger compositions_updated before update on public.compositions for each row execute function public.nuance_set_updated_at();

commit;
