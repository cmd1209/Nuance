begin;

alter table public.typeface_favorites
    add column custom boolean not null default false,
    add column custom_text text check (char_length(custom_text) <= 2000);

commit;
