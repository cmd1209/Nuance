begin;

lock table public.profiles, public.compositions in share row exclusive mode;

-- Preserve existing work: refuse the migration if an account already exceeds the cap.
do $$
begin
    if exists (select 1 from public.compositions group by owner_id having count(*) > 4) then
        raise exception 'An account has more than four compositions. Delete the extras before applying this migration.';
    end if;
end;
$$;

alter table public.profiles add column saved_composition_count integer not null default 0
    check (saved_composition_count between 0 and 4);

insert into public.profiles (id)
select distinct owner_id from public.compositions
on conflict (id) do nothing;

update public.profiles p set saved_composition_count = (
    select count(*) from public.compositions c where c.owner_id = p.id
);

-- Clients may edit names, but never the counter maintained by database triggers.
revoke insert, update on public.profiles from authenticated;
grant insert (id, display_name), update (id, display_name) on public.profiles to authenticated;

grant delete on public.compositions to authenticated;
create policy compositions_delete on public.compositions for delete to authenticated
    using ((select auth.uid()) = owner_id);

create function public.nuance_composition_quota() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
    if tg_op = 'UPDATE' and old.owner_id = new.owner_id then
        return new;
    end if;

    if tg_op in ('DELETE', 'UPDATE') then
        update public.profiles set saved_composition_count = greatest(saved_composition_count - 1, 0)
        where id = old.owner_id;
    end if;

    if tg_op in ('INSERT', 'UPDATE') then
        insert into public.profiles (id) values (new.owner_id) on conflict (id) do nothing;
        -- The conditional update serializes concurrent saves on the owner's row.
        -- An upsert of an existing composition does not run the INSERT trigger.
        update public.profiles set saved_composition_count = saved_composition_count + 1
        where id = new.owner_id and saved_composition_count < 4;
        if not found then
            raise exception using errcode = '23514',
                message = 'You can save up to four compositions. Delete one before saving another.';
        end if;
    end if;

    if tg_op = 'DELETE' then return old; end if;
    return new;
end;
$$;

revoke all on function public.nuance_composition_quota() from public, anon, authenticated;

create trigger compositions_quota after insert or delete or update of owner_id
    on public.compositions for each row execute function public.nuance_composition_quota();

commit;
