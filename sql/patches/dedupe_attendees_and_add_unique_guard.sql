-- One-time cleanup for duplicated attendees caused by duplicate submissions.
-- Strategy:
-- 1) Group duplicates by event_id + court_id + full_name(normalized) + phone(normalized)
-- 2) Keep one "best" row in each group (checked-in first, then latest created_at)
-- 3) Move check-in rows from duplicate attendee_id -> keeper attendee_id
-- 4) Delete duplicate attendee_checkins, then duplicate attendees
-- 5) Add a unique index so DB rejects duplicate rows with same identity key

-- Preview duplicates before cleanup
select
  event_id,
  court_id,
  lower(trim(full_name)) as full_name_key,
  coalesce(regexp_replace(phone, '\D', '', 'g'), '') as phone_key,
  count(*) as duplicate_count
from public.attendees
where coalesce(regexp_replace(phone, '\D', '', 'g'), '') <> ''
group by
  event_id,
  court_id,
  lower(trim(full_name)),
  coalesce(regexp_replace(phone, '\D', '', 'g'), '')
having count(*) > 1
order by duplicate_count desc, event_id, court_id, full_name_key;

begin;

create temporary table _attendee_dedup_map on commit drop as
with normalized as (
  select
    a.*,
    lower(trim(a.full_name)) as full_name_key,
    coalesce(regexp_replace(a.phone, '\D', '', 'g'), '') as phone_key
  from public.attendees a
),
ranked as (
  select
    n.id,
    first_value(n.id) over w as keep_id,
    row_number() over w as rn
  from normalized n
  where n.phone_key <> ''
  window w as (
    partition by
      n.event_id,
      n.court_id,
      n.full_name_key,
      n.phone_key
    order by
      (n.checked_in_at is not null) desc,
      n.created_at desc,
      n.id desc
  )
)
select
  id as duplicate_id,
  keep_id
from ranked
where rn > 1 and id <> keep_id;

-- Move check-in history to keeper row when same round is not already present.
update public.attendee_checkins c
set attendee_id = m.keep_id
from _attendee_dedup_map m
where c.attendee_id = m.duplicate_id
  and not exists (
    select 1
    from public.attendee_checkins c2
    where c2.attendee_id = m.keep_id
      and c2.round = c.round
  );

-- Remove any remaining duplicate-side checkins to avoid FK conflicts on attendee delete.
delete from public.attendee_checkins c
using _attendee_dedup_map m
where c.attendee_id = m.duplicate_id;

-- Remove duplicate attendees.
delete from public.attendees a
using _attendee_dedup_map m
where a.id = m.duplicate_id;

commit;

-- DB-level safeguard against future duplicates.
-- NOTE: if this fails, duplicates still exist and must be cleaned again first.
create unique index if not exists attendees_unique_event_court_name_phone_idx
on public.attendees (
  event_id,
  court_id,
  lower(trim(full_name)),
  regexp_replace(phone, '\D', '', 'g')
)
where coalesce(regexp_replace(phone, '\D', '', 'g'), '') <> '';
