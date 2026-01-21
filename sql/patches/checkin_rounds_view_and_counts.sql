-- View: public.v_attendees_checkin_rounds
-- Includes required attendee columns + per-round timestamps.
create or replace view public.v_attendees_checkin_rounds as
select
  a.id,
  a.event_id,
  a.court_id,
  a.name_prefix,
  a.full_name,
  a.phone,
  a.organization,
  a.job_position,
  a.province,
  a.region,
  a.qr_image_url,
  a.slip_url,
  a.checked_in_at,
  a.ticket_token,
  a.food_type,
  a.hotel_name,
  a.coordinator_prefix_other,
  a.coordinator_name,
  a.coordinator_phone,
  a.travel_mode,
  a.travel_other,
  a.created_at,
  c.checkin_round1_at,
  c.checkin_round2_at,
  c.checkin_round3_at
from public.attendees a
left join (
  select
    attendee_id,
    min(checked_in_at) filter (where round = 1) as checkin_round1_at,
    min(checked_in_at) filter (where round = 2) as checkin_round2_at,
    min(checked_in_at) filter (where round = 3) as checkin_round3_at
  from public.attendee_checkins
  group by attendee_id
) c on c.attendee_id = a.id;

-- Function: public.attendee_summary_counts
-- Single-query aggregated counts for admin summary.
create or replace function public.attendee_summary_counts(
  p_event_id uuid,
  p_keyword text,
  p_status text,
  p_region integer,
  p_province text,
  p_organization text,
  p_court_id uuid
)
returns table (
  total bigint,
  round1 bigint,
  round2 bigint,
  round3 bigint,
  slip bigint
)
language sql
stable
as $$
  select
    count(*)::bigint as total,
    count(*) filter (where checkin_round1_at is not null)::bigint as round1,
    count(*) filter (where checkin_round2_at is not null)::bigint as round2,
    count(*) filter (where checkin_round3_at is not null)::bigint as round3,
    count(*) filter (where slip_url is not null)::bigint as slip
  from public.v_attendees_checkin_rounds v
  where (p_event_id is null or v.event_id = p_event_id)
    and (p_court_id is null or v.court_id = p_court_id)
    and (p_region is null or v.region = p_region)
    and (p_province is null or v.province = p_province)
    and (p_organization is null or v.organization = p_organization)
    and (
      p_keyword is null or p_keyword = '' or
      v.full_name ilike '%' || p_keyword || '%' or
      v.organization ilike '%' || p_keyword || '%' or
      v.job_position ilike '%' || p_keyword || '%' or
      v.province ilike '%' || p_keyword || '%' or
      v.ticket_token ilike '%' || p_keyword || '%' or
      v.coordinator_name ilike '%' || p_keyword || '%' or
      v.coordinator_phone ilike '%' || p_keyword || '%'
    )
    and (
      p_status is null or p_status = 'all' or
      (p_status = 'checked' and v.checked_in_at is not null) or
      (p_status = 'unchecked' and v.checked_in_at is null)
    );
$$;

-- Recommended indexes (apply if not already present):
-- create index if not exists attendees_event_id_idx on public.attendees (event_id);
-- create index if not exists attendees_ticket_token_idx on public.attendees (ticket_token);
-- create index if not exists attendees_court_id_idx on public.attendees (court_id);
-- create index if not exists attendee_checkins_attendee_round_idx on public.attendee_checkins (attendee_id, round);
