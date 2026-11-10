begin;

-- Existing favorites retain their original Normal weight and quote presentation.
alter table public.typeface_favorites
    add column font_weight integer not null default 400
        check (font_weight in (100, 200, 300, 400, 500, 600, 700, 800, 900)),
    add column alphabet boolean not null default false;

commit;
