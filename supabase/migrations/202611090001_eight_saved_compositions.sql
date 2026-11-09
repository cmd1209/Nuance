begin;

-- Raise the existing allowance without recreating profiles, records, or counters.
lock table public.profiles, public.compositions in share row exclusive mode;

alter table public.profiles
    drop constraint profiles_saved_composition_count_check,
    add constraint profiles_saved_composition_count_check
        check (saved_composition_count between 0 and 8);

create or replace function public.nuance_composition_quota() returns trigger
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
        where id = new.owner_id and saved_composition_count < 8;
        if not found then
            raise exception using errcode = '23514',
                message = 'You can save up to eight compositions. Delete one before saving another.';
        end if;
    end if;

    if tg_op = 'DELETE' then return old; end if;
    return new;
end;
$$;

-- Keep the security-definer quota function callable only by its trigger.
revoke all on function public.nuance_composition_quota() from public, anon, authenticated;

commit;
