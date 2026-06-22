# Koinita — Deployment Guide

## Architecture

```
koinita.club  →  Cloudflare Pages  (the app + landing page in one SPA)
Backend:          Supabase          (DB, Auth, Edge Functions)
Email:            Resend            (transactional email)
Payments:         Stripe            (dormant until MONETIZATION_ENABLED = true)
```

No subdomains. No Duda. `koinita.club` is the only URL.
The app's logged-out home view is the landing/marketing page.

---

## Step 1 — Supabase Setup

1. Create a new project at supabase.com
2. Go to **SQL Editor** → paste and run `koinita/supabase/schema.sql`
3. Go to **Authentication → Providers**:
   - Enable **Email** (with password, confirmations off for now)
   - Enable **Google** (needs OAuth app in Google Cloud Console)
4. Go to **Authentication → URL Configuration**:
   - **Site URL**: `https://koinita.club`
   - **Redirect URLs**: `https://koinita.club`, `https://www.koinita.club`
5. Set admin flag: in SQL Editor run:
   ```sql
   UPDATE profiles SET admin = true WHERE email = 'admin@koinita.club';
   ```

---

## Step 2 — Resend Setup

1. Sign up at resend.com
2. Add and verify domain `koinita.club` (add DNS records in Cloudflare)
3. Create an API key → save it
4. Set `FROM_EMAIL` to `Koinita <hello@koinita.club>`

---

## Step 3 — Wire Supabase credentials into the app

In `koinita/app/index.html` near the top of `<script>`:

```js
const SUPABASE_URL      = 'https://xxxxxxxxxxxx.supabase.co';
const SUPABASE_ANON_KEY = 'eyJ...';
```

Get values from **Supabase → Project Settings → API**.

---

## Step 4 — Deploy Edge Functions

```bash
npm install -g supabase
supabase login
supabase link --project-ref YOUR_PROJECT_REF

# Set secrets
supabase secrets set RESEND_API_KEY=re_xxxxx
supabase secrets set FROM_EMAIL="Koinita <hello@koinita.club>"
supabase secrets set APP_URL=https://koinita.club
supabase secrets set STRIPE_SECRET_KEY=sk_live_xxxxx       # when ready
supabase secrets set STRIPE_PRICE_INDIE=price_xxxxx        # when ready
supabase secrets set STRIPE_PRICE_PRO=price_xxxxx          # when ready

# Deploy functions
supabase functions deploy send-email
supabase functions deploy claim-founder-spot
supabase functions deploy create-checkout
```

---

## Step 5 — Cloudflare Pages + Custom Domain

1. Go to Cloudflare Dashboard → **Pages → Create a project**
2. Connect GitHub repo (`koinita/koinita`) — or use direct upload
3. Settings:
   - **Root directory**: `app`
   - **Build command**: *(leave empty — static site)*
   - **Output directory**: `.`
4. Deploy
5. **Add `koinita.club` to Cloudflare** (free account):
   - Cloudflare → Add a site → enter `koinita.club`
   - Cloudflare gives you two nameservers
6. **In Squarespace Domains → `koinita.club` → DNS Settings**:
   - Change nameservers to the two Cloudflare nameservers
   - Propagation: 1–24 hours
7. In Cloudflare Pages → **Custom Domains** → add `koinita.club`
   - Cloudflare auto-configures DNS since it controls the zone
8. Add a redirect: `www.koinita.club` → `koinita.club` (Cloudflare → Rules → Redirects)

---

## Step 6 — Stripe (when monetizing)

1. Create products in Stripe: "Koinita Indie" and "Koinita Pro"
2. Copy `price_xxx` IDs into Supabase secrets above
3. Set up Stripe webhook → `https://YOUR_PROJECT.supabase.co/functions/v1/create-checkout`
   - Event: `checkout.session.completed`
4. In `index.html`, set `const MONETIZATION_ENABLED = true;`

---

## Environment Variables Summary

| Secret | Where | Value |
|--------|-------|-------|
| `SUPABASE_URL` | `index.html` | From Supabase project settings |
| `SUPABASE_ANON_KEY` | `index.html` | From Supabase project settings |
| `RESEND_API_KEY` | Supabase secrets | From resend.com |
| `FROM_EMAIL` | Supabase secrets | `Koinita <hello@koinita.club>` |
| `APP_URL` | Supabase secrets | `https://koinita.club` |
| `STRIPE_SECRET_KEY` | Supabase secrets | From Stripe (when ready) |
| `STRIPE_PRICE_INDIE` | Supabase secrets | From Stripe (when ready) |
| `STRIPE_PRICE_PRO` | Supabase secrets | From Stripe (when ready) |
