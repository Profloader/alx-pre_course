# Koinita — Deployment Guide

## Architecture
- `koinita.club` → Duda (marketing site) — uses `koinita-duda.html`
- `app.koinita.club` → Cloudflare Pages (the app) — deploys from `koinita/app/`
- Backend: Supabase (DB + Auth + Storage + Edge Functions)
- Email: Resend.com
- Payments: Stripe (dormant until `MONETIZATION_ENABLED = true`)

---

## Step 1 — Supabase Setup

1. Create a new project at supabase.com
2. Go to **SQL Editor** → paste and run `koinita/supabase/schema.sql`
3. Go to **Authentication → Providers**:
   - Enable **Email** (OTP mode, not magic link)
   - Enable **Google** (needs OAuth app in Google Cloud Console)
   - Enable **Apple** (needs Apple Developer account)
4. Go to **Authentication → Email Templates** → customise with Koinita branding
5. Go to **Authentication → SMTP** → add Resend.com as custom SMTP:
   - Host: `smtp.resend.com`
   - Port: `465`
   - Username: `resend`
   - Password: your Resend API key

---

## Step 2 — Resend Setup

1. Sign up at resend.com
2. Add and verify your domain `koinita.club`
3. Create an API key → copy it
4. Set `FROM_EMAIL` to `Koinita <hello@koinita.club>`

---

## Step 3 — Wire Supabase credentials into the app

Edit `koinita/app/index.html` — find these two lines near the top of `<script>`:

```js
const SUPABASE_URL      = '%%SUPABASE_URL%%';
const SUPABASE_ANON_KEY = '%%SUPABASE_ANON_KEY%%';
```

Replace with your values from **Supabase → Project Settings → API**:
- **SUPABASE_URL**: `https://xxxxxxxxxxxx.supabase.co`
- **SUPABASE_ANON_KEY**: the `anon public` key (safe to expose in frontend)

---

## Step 4 — Deploy Edge Functions

```bash
npm install -g supabase
supabase login
supabase link --project-ref YOUR_PROJECT_REF

# Set secrets
supabase secrets set RESEND_API_KEY=re_xxxxx
supabase secrets set FROM_EMAIL="Koinita <hello@koinita.club>"
supabase secrets set STRIPE_SECRET_KEY=sk_live_xxxxx       # when ready
supabase secrets set STRIPE_PRICE_INDIE=price_xxxxx        # when ready
supabase secrets set STRIPE_PRICE_PRO=price_xxxxx          # when ready
supabase secrets set APP_URL=https://app.koinita.club

# Deploy functions
supabase functions deploy send-email
supabase functions deploy claim-founder-spot
supabase functions deploy create-checkout
```

---

## Step 5 — Cloudflare Pages

1. Go to Cloudflare Dashboard → **Pages → Create a project**
2. Connect your GitHub repo (`profloader/alx-pre_course`)
3. Settings:
   - **Root directory**: `koinita/app`
   - **Build command**: *(leave empty — it's a static site)*
   - **Output directory**: `.` (the root of `koinita/app`)
4. Deploy
5. Go to **Custom Domains** → add `app.koinita.club`
   - Add a CNAME record in your DNS: `app.koinita.club → pages.dev`

---

## Step 6 — Supabase Auth redirect URL

In Supabase → **Authentication → URL Configuration**:
- **Site URL**: `https://app.koinita.club`
- **Redirect URLs**: add `https://app.koinita.club`

---

## Step 7 — Duda linking

In your Duda header / CTA buttons, link to `https://app.koinita.club`.
The marketing site (`koinita.club`) stays on Duda.
The app (`app.koinita.club`) is on Cloudflare Pages.

---

## Step 8 — Storage Buckets (optional, for cover uploads)

In Supabase SQL Editor, uncomment and run the storage bucket section at the
bottom of `schema.sql`.

---

## Step 9 — Stripe (when monetizing)

1. Create products in Stripe: "Koinita Indie" and "Koinita Pro"
2. Copy the `price_xxx` IDs into the Supabase secrets above
3. Set up Stripe webhook → `https://YOUR_PROJECT.supabase.co/functions/v1/create-checkout`
   - Event: `checkout.session.completed`
4. In `index.html`, set `const MONETIZATION_ENABLED = true;`

---

## Environment Variables Summary

| Secret | Where | Value |
|--------|-------|-------|
| `SUPABASE_URL` | In `index.html` | From Supabase project settings |
| `SUPABASE_ANON_KEY` | In `index.html` | From Supabase project settings |
| `RESEND_API_KEY` | Supabase secrets | From resend.com |
| `FROM_EMAIL` | Supabase secrets | `Koinita <hello@koinita.club>` |
| `STRIPE_SECRET_KEY` | Supabase secrets | From Stripe (when ready) |
| `STRIPE_PRICE_INDIE` | Supabase secrets | From Stripe (when ready) |
| `STRIPE_PRICE_PRO` | Supabase secrets | From Stripe (when ready) |
| `APP_URL` | Supabase secrets | `https://app.koinita.club` |
