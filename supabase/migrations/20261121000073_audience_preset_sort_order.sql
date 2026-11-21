-- Explicit order for Audience Interactor presets.
-- The admin list, and any run that walks presets, uses sort_order.
-- Backfill matches the previous list (newest update first) and then stays put.

alter table public.audience_presets
  add column if not exists sort_order integer not null default 0 check (sort_order >= 0);

do $$
begin
  if not exists (select 1 from public.audience_presets where sort_order <> 0) then
    with ranked as (
      select
        id,
        (row_number() over (
          partition by venue_id
          order by updated_at desc, created_at desc, id
        ) - 1) as ord
      from public.audience_presets
    )
    update public.audience_presets as preset
    set sort_order = ranked.ord
    from ranked
    where preset.id = ranked.id;
  end if;
end
$$;

create index if not exists audience_presets_venue_sort_idx
  on public.audience_presets (venue_id, sort_order, created_at);

comment on column public.audience_presets.sort_order is
  'Operator-chosen position. Lower numbers appear first. Saving a preset does not change this.';
