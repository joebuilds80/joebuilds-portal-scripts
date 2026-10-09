-- Joe Builds — Emma funnel measurement V1
-- Additive. Does not alter the existing intake classification logic.
-- Browser behaviour belongs in site_events; leads remain in funnel_events / phone_calls.

create table if not exists public.site_events (
  id uuid primary key default gen_random_uuid(),
  occurred_at timestamptz not null default now(),
  received_at timestamptz not null default now(),
  schema_version text not null default 'emma-funnel-v1',
  event_name text not null check (event_name in (
    'emma_widget_impression',
    'emma_open',
    'emma_conversation_start'
  )),
  visitor_id text not null,
  session_id text not null,
  page_path text,
  landing_page text,
  referrer text,
  utm_source text,
  utm_medium text,
  utm_campaign text,
  utm_content text,
  utm_term text,
  click_id_present boolean not null default false,
  mode text,
  stage text,
  origin text not null default 'website',
  event_dedupe_key text not null unique,
  is_test boolean not null default false,
  metadata jsonb not null default '{}'::jsonb
);

create index if not exists site_events_occurred_at_idx on public.site_events (occurred_at desc);
create index if not exists site_events_name_day_idx on public.site_events (event_name, occurred_at desc);
create index if not exists site_events_visitor_idx on public.site_events (visitor_id, occurred_at desc);
create index if not exists site_events_session_idx on public.site_events (session_id, occurred_at desc);

alter table public.site_events enable row level security;
revoke all on public.site_events from anon, authenticated;

-- Completed ElevenLabs website conversations already live in phone_calls.
-- user_id is extracted from the stored provider payload when present.
create or replace view public.v_emma_conversations as
select
  p.conversation_id,
  p.channel,
  p.received_at,
  p.started_at,
  p.duration_secs,
  p.test_status,
  p.is_test,
  p.delivery_status,
  p.delivered_at,
  p.owner_ack_at,
  coalesce(
    p.raw->'data'->>'user_id',
    p.raw->'data'->'conversation_initiation_client_data'->>'user_id',
    p.raw->>'user_id'
  ) as visitor_id,
  p.summary
from public.phone_calls p
where p.channel in ('website_text','website_voice');

alter view public.v_emma_conversations set (security_invoker = true);
revoke all on public.v_emma_conversations from anon, authenticated;

-- Full daily funnel. Early stages are anonymous browser events.
-- Contact and handoff stages come only from the existing confirmed intake records.
create or replace view public.v_emma_funnel_daily as
with site as (
  select
    (occurred_at at time zone 'Australia/Sydney')::date as day_syd,
    count(distinct session_id) filter (where event_name = 'emma_widget_impression' and not is_test) as widget_seen,
    count(distinct session_id) filter (where event_name = 'emma_open' and not is_test) as opened,
    count(distinct session_id) filter (where event_name = 'emma_conversation_start' and not is_test) as conversations_started
  from public.site_events
  group by 1
),
contact as (
  select
    (coalesce(occurred_at, received_at) at time zone 'Australia/Sydney')::date as day_syd,
    count(distinct coalesce(conversation_id, source || ':' || external_id)) filter (
      where coalesce(is_test,false) = false
        and coalesce(channel,'') in ('website_text','website_voice')
        and (
          nullif(trim(coalesce(contact_phone,'')), '') is not null
          or nullif(trim(coalesce(contact_email,'')), '') is not null
          or nullif(trim(coalesce(contact_name,'')), '') is not null
        )
    ) as contacts_captured,
    count(distinct coalesce(conversation_id, source || ':' || external_id)) filter (
      where coalesce(is_test,false) = false
        and coalesce(channel,'') in ('website_text','website_voice')
        and delivery_status in (
          'delivered_to_destination',
          'acknowledged_by_owner',
          'action_attempted',
          'action_completed',
          'closed'
        )
    ) as handoffs_delivered
  from public.funnel_events
  where source = 'agent'
  group by 1
),
completed as (
  select
    (received_at at time zone 'Australia/Sydney')::date as day_syd,
    count(distinct conversation_id) filter (
      where coalesce(is_test,false) = false
        and coalesce(test_status,'unknown') <> 'confirmed_test'
    ) as conversations_completed
  from public.phone_calls
  where channel in ('website_text','website_voice')
  group by 1
),
days as (
  select day_syd from site
  union
  select day_syd from contact
  union
  select day_syd from completed
)
select
  d.day_syd,
  coalesce(s.widget_seen,0) as widget_seen,
  coalesce(s.opened,0) as opened,
  coalesce(s.conversations_started,0) as conversations_started,
  coalesce(cmp.conversations_completed,0) as conversations_completed,
  coalesce(c.contacts_captured,0) as contacts_captured,
  coalesce(c.handoffs_delivered,0) as handoffs_delivered,
  case when coalesce(s.widget_seen,0) > 0
    then round(100.0 * coalesce(s.opened,0) / s.widget_seen, 1) end as seen_to_open_pct,
  case when coalesce(s.opened,0) > 0
    then round(100.0 * coalesce(s.conversations_started,0) / s.opened, 1) end as open_to_start_pct,
  case when coalesce(s.conversations_started,0) > 0
    then round(100.0 * coalesce(c.contacts_captured,0) / s.conversations_started, 1) end as start_to_contact_pct,
  case when coalesce(c.contacts_captured,0) > 0
    then round(100.0 * coalesce(c.handoffs_delivered,0) / c.contacts_captured, 1) end as contact_to_handoff_pct
from days d
left join site s using (day_syd)
left join contact c using (day_syd)
left join completed cmp using (day_syd)
order by d.day_syd desc;

alter view public.v_emma_funnel_daily set (security_invoker = true);
revoke all on public.v_emma_funnel_daily from anon, authenticated;

-- Rolling seven-day summary for cockpit / daily brief use.
create or replace view public.v_emma_funnel_7d as
select
  min(day_syd) as from_day,
  max(day_syd) as to_day,
  sum(widget_seen)::bigint as widget_seen,
  sum(opened)::bigint as opened,
  sum(conversations_started)::bigint as conversations_started,
  sum(conversations_completed)::bigint as conversations_completed,
  sum(contacts_captured)::bigint as contacts_captured,
  sum(handoffs_delivered)::bigint as handoffs_delivered
from public.v_emma_funnel_daily
where day_syd >= (now() at time zone 'Australia/Sydney')::date - 6;

alter view public.v_emma_funnel_7d set (security_invoker = true);
revoke all on public.v_emma_funnel_7d from anon, authenticated;