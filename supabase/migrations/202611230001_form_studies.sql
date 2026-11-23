begin;

-- Shared envelope for all Form tools; generator versions live inside each document.
create table public.form_studies (
    owner_id uuid not null references auth.users (id) on delete cascade,
    id uuid not null,
    setting text not null check (setting in (
        'sizing', 'spacing', 'grids', 'containers', 'aspect-ratios', 'density',
        'radii', 'borders', 'strokes', 'dividers', 'shape-language',
        'shadows', 'elevation', 'opacity', 'blur', 'surface-treatment',
        'motion', 'easing', 'transition-durations', 'interaction-states'
    )),
    document jsonb not null,
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now(),
    primary key (owner_id, id),
    check ((jsonb_typeof(document) = 'object'
        and document->'schemaVersion' = '1'::jsonb
        and document->>'id' = id::text
        and document->>'setting' = setting
        and jsonb_typeof(document->'name') = 'string'
        and char_length(btrim(document->>'name')) between 1 and 80
        and jsonb_typeof(document->'generatorVersion') = 'string'
        and jsonb_typeof(document->'values') = 'object'
        and jsonb_typeof(document->'resolvedTokens') = 'array') is true),
    check (octet_length(document::text) <= 32768)
);
create index form_studies_owner_updated on public.form_studies (owner_id, updated_at desc, id);
alter table public.form_studies enable row level security;
revoke all on public.form_studies from public, anon, authenticated;
grant select, insert, delete on public.form_studies to authenticated;
grant update (document) on public.form_studies to authenticated;
create policy form_studies_select on public.form_studies for select to authenticated
    using ((select auth.uid()) = owner_id);
create policy form_studies_insert on public.form_studies for insert to authenticated
    with check ((select auth.uid()) = owner_id);
create policy form_studies_update on public.form_studies for update to authenticated
    using ((select auth.uid()) = owner_id) with check ((select auth.uid()) = owner_id);
create policy form_studies_delete on public.form_studies for delete to authenticated
    using ((select auth.uid()) = owner_id);

-- A locked counter per user and tool makes simultaneous inserts honor the three-slot limit.
create table public.form_study_quotas (
    owner_id uuid not null references auth.users (id) on delete cascade,
    setting text not null,
    saved_count integer not null default 0 check (saved_count between 0 and 3),
    primary key (owner_id, setting)
);
alter table public.form_study_quotas enable row level security;
revoke all on public.form_study_quotas from public, anon, authenticated;

create function public.nuance_form_study_quota() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
    if tg_op = 'DELETE' then
        update public.form_study_quotas set saved_count = greatest(saved_count - 1, 0)
        where owner_id = old.owner_id and setting = old.setting;
        return old;
    end if;
    insert into public.form_study_quotas (owner_id, setting) values (new.owner_id, new.setting)
        on conflict (owner_id, setting) do nothing;
    update public.form_study_quotas set saved_count = saved_count + 1
        where owner_id = new.owner_id and setting = new.setting and saved_count < 3;
    if not found then
        raise exception using errcode = '23514', message = 'You can save up to three studies per Form component. Replace or delete one to make room.';
    end if;
    return new;
end;
$$;
revoke all on function public.nuance_form_study_quota() from public, anon, authenticated;
create trigger form_studies_quota after insert or delete on public.form_studies
    for each row execute function public.nuance_form_study_quota();
create trigger form_studies_updated before update on public.form_studies
    for each row execute function public.nuance_set_updated_at();

commit;
