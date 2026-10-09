# Joe Builds — Emma Funnel Measurement V1

## Outcome

Create one measurable funnel:

**widget seen → Emma opened → conversation started → contact captured → handoff delivered**

This does **not** create a second lead system.

- GA4/dataLayer records anonymous behaviour.
- `site_events` records the same anonymous browser stages in Supabase.
- Existing `phone_calls` remains the completed ElevenLabs conversation record.
- Existing `funnel_events` remains the source for contact capture and delivery/handoff.
- `v_emma_funnel_daily` joins the counts into one daily funnel.

No name, email address, phone number or chat text is sent to GA4 or `site_events`.

## Event definitions

| Stage | Event / source | Count means |
|---|---|---|
| Widget seen | `emma_widget_impression` | ElevenLabs widget was ≥25% visible for 500ms |
| Opened | `emma_open` | first widget/Emma CTA interaction in the browser session |
| Conversation started | `emma_conversation_start` | official `elevenlabs-convai:call` lifecycle event fired |
| Conversation completed | `phone_calls` | completed website text/voice record received from ElevenLabs |
| Contact captured | `funnel_events` | existing agent message row contains a stated contact field |
| Handoff delivered | `funnel_events.delivery_status` | existing intake machinery records delivery/action receipt |

## Files

- `ops/emma-funnel-tracking-v1.js` — browser measurement + GA4/dataLayer + anonymous visitor ID.
- `ops/supabase/emma-funnel-v1.sql` — site_events table + reporting views.
- `ops/supabase/functions/site-event/index.ts` — public anonymous-event receiver.

## Release order

1. Apply `emma-funnel-v1.sql` to project `jsqyfiwkbuvuajwzbjhd`.
2. Deploy Edge Function `site-event` with JWT verification disabled; the function itself restricts browser Origin and event names.
3. QA the endpoint with one controlled event and confirm one row in `site_events`.
4. Add this single line to the live Squarespace footer code injection **after Joe approves the exact release**:

```html
<script src="https://cdn.jsdelivr.net/gh/joebuilds80/joebuilds-portal-scripts@main/ops/emma-funnel-tracking-v1.js" defer></script>
```

5. Run a clean incognito test using `?jb_test=1` so QA events are stored but excluded from business funnel counts:
   - page load with widget visible → one `emma_widget_impression`
   - open Emma → one `emma_open`
   - begin a chat → one `emma_conversation_start`
   - leave contact through the currently commissioned handoff path → existing intake row
   - confirm `v_emma_funnel_daily` advances through the correct stages.
6. Read GA4 realtime/debug view and verify the first three event names.
7. After 24 hours, compare GA4 counts against `site_events`. Browser blockers may make GA4 lower; Supabase is the operational count for the funnel.

## GA4 key-event recommendation

Do **not** mark widget impression as a key event.

Recommended:
- `emma_conversation_start` — secondary key event.
- Contact capture / handoff stay server-confirmed in Supabase. Do not synthesize them from browser clicks.

## Join / identity rule

The browser creates a random `jb_visitor_id_v1` in localStorage and supplies it to ElevenLabs as `userId` at conversation start. It is an anonymous browser identifier, not proof of identity.

The Supabase view extracts ElevenLabs `user_id` from the existing post-call raw payload when present. This creates a future-safe anonymous join without storing contact details in GA4.

## Test exclusion

Joe/Mac tests must continue to be explicitly marked by the existing intake test rules. The new browser events do not create enquiries and therefore cannot inflate the lead count.

## Rollback

- Remove the one script tag from Squarespace.
- Delete/disable the `site-event` Edge Function.
- Drop `v_emma_funnel_7d`, `v_emma_funnel_daily`, `v_emma_conversations`, then `site_events`.
- Existing `phone_calls`, `funnel_events`, classifications, routes and delivery records remain untouched.
