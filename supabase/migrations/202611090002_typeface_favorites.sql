begin;

create table public.typeface_favorites (
    owner_id uuid not null references auth.users (id) on delete cascade,
    font_id text not null check (char_length(font_id) between 1 and 200),
    source text not null check (source ~ '^[a-z][a-z0-9-]*$' and char_length(source) <= 80),
    registry_version integer not null check (registry_version >= 1),
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now(),
    primary key (owner_id, font_id),
    check (font_id like source || ':%')
);

create index typeface_favorites_owner_updated on public.typeface_favorites (owner_id, updated_at desc, font_id);
alter table public.typeface_favorites enable row level security;
revoke all on public.typeface_favorites from public, anon, authenticated;
grant select, insert, update, delete on public.typeface_favorites to authenticated;

create policy typeface_favorites_select on public.typeface_favorites for select to authenticated
    using ((select auth.uid()) = owner_id);
create policy typeface_favorites_insert on public.typeface_favorites for insert to authenticated
    with check ((select auth.uid()) = owner_id);
create policy typeface_favorites_update on public.typeface_favorites for update to authenticated
    using ((select auth.uid()) = owner_id) with check ((select auth.uid()) = owner_id);
create policy typeface_favorites_delete on public.typeface_favorites for delete to authenticated
    using ((select auth.uid()) = owner_id);

-- Existing profile column grants exclude this new server-maintained counter.
alter table public.profiles add column saved_typeface_count integer not null default 0
    check (saved_typeface_count between 0 and 8);
revoke insert, update on public.profiles from authenticated;
grant insert (id, display_name), update (id, display_name) on public.profiles to authenticated;

create function public.nuance_typeface_quota() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
    if tg_op = 'UPDATE' and old.owner_id = new.owner_id then
        return new;
    end if;
    if tg_op in ('DELETE', 'UPDATE') then
        update public.profiles set saved_typeface_count = greatest(saved_typeface_count - 1, 0)
        where id = old.owner_id;
    end if;
    if tg_op in ('INSERT', 'UPDATE') then
        insert into public.profiles (id) values (new.owner_id) on conflict (id) do nothing;
        update public.profiles set saved_typeface_count = saved_typeface_count + 1
        where id = new.owner_id and saved_typeface_count < 8;
        if not found then
            raise exception using errcode = '23514',
                message = 'You can save up to eight typefaces. Delete one before saving another.';
        end if;
    end if;
    if tg_op = 'DELETE' then return old; end if;
    return new;
end;
$$;

revoke all on function public.nuance_typeface_quota() from public, anon, authenticated;
create trigger typeface_favorites_quota after insert or delete or update of owner_id
    on public.typeface_favorites for each row execute function public.nuance_typeface_quota();
create trigger typeface_favorites_updated before update on public.typeface_favorites
    for each row execute function public.nuance_set_updated_at();

commit;
