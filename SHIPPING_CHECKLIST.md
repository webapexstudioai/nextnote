# NextNote Shipping Checklist

Manual steps to flip NextNote from dev to production. Work through in order.

## 1. Stripe — Test → Live Mode

Platform billing only (agencies pay NextNote for subscription + credits). No Stripe Connect.

### Env vars (production)
```
STRIPE_SECRET_KEY=sk_live_...
NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=pk_live_...
STRIPE_WEBHOOK_SECRET=whsec_...
```

### Stripe dashboard configuration
1. Toggle dashboard to **Live mode** (top-right)
2. **Developers → Webhooks → Add endpoint**
   - URL: `https://YOUR_DOMAIN/api/stripe/webhook`
   - Events: `checkout.session.completed`, `customer.subscription.updated`, `customer.subscription.deleted`
   - Copy signing secret → `STRIPE_WEBHOOK_SECRET`

### Verify
- [ ] Complete a real subscription checkout end-to-end
- [ ] Check webhook delivery log shows 200 OK
- [ ] Purchase a credit pack, confirm balance increments in Supabase `credit_balances`

---

## 2. Google Calendar — End-to-End Test

Run these in order against a staging/prod environment with a real Google account.

### Setup
- [ ] OAuth consent screen is published (not test mode) in Google Cloud Console
- [ ] Production OAuth client has the prod redirect URI added
- [ ] `GOOGLE_CLIENT_ID` / `GOOGLE_CLIENT_SECRET` env vars set to prod credentials

### Test flow
1. [ ] Sign in → Settings → Connect Google Calendar → grant consent
2. [ ] Open a prospect → book an appointment with a real prospect email → confirm:
   - Google Meet link appears in the detail panel
   - Event shows up in your Google Calendar
   - Prospect receives the invite email
3. [ ] Reschedule the appointment → confirm the calendar event time updates (not duplicated)
4. [ ] Cancel the appointment → confirm the calendar event is **deleted** from Google Calendar (was just fixed)
5. [ ] Wait 1 hour or force token refresh → book another appointment → confirm it still works (validates the auto-refresh path)

---

## 3. Database Migration

Run this once against production Supabase (SQL editor or CLI):

```sql
-- Appearance customization (if not already applied)
ALTER TABLE user_settings
  ADD COLUMN IF NOT EXISTS accent_color TEXT,
  ADD COLUMN IF NOT EXISTS background_intensity TEXT;

-- Optional: persist Google Maps link across devices
-- (currently stored in ProspectsContext localStorage only)
ALTER TABLE prospects
  ADD COLUMN IF NOT EXISTS maps_url TEXT,
  ADD COLUMN IF NOT EXISTS address TEXT,
  ADD COLUMN IF NOT EXISTS website TEXT,
  ADD COLUMN IF NOT EXISTS contact_name TEXT;
```

Verify:
- [ ] `SELECT column_name FROM information_schema.columns WHERE table_name = 'user_settings';` shows `accent_color` + `background_intensity`
- [ ] Appearance settings save and reload across sessions

---

## 4. Final smoke test (prod)

- [ ] Fresh signup → onboarding tour runs
- [ ] Import an XLSX → AI mapping detects columns correctly
- [ ] Pick a prospect → edit contact fields → refresh → changes persist
- [ ] Move a prospect through full pipeline New → Closed → confetti fires
- [ ] AI Insights loads with narrative + KPIs
- [ ] Search bar filters kanban correctly
