# Koinita — Session Handoff (continue here)

> Read this top to bottom before doing anything. It captures the full state of work
> done across the prior session. Code is in git; backend changes are already LIVE in
> Supabase. Don't re-derive — verify and continue.

## What Koinita is
A free book-club web app (https://koinita.club). Readers claim free, full-length books
(free on Amazon/Kindle, or ePub read on-site), talk to authors, follow people, post to a
feed, join reading circles. Goodreads-style shelf to bring people back. Founding-member
growth mechanic + invite-to-climb system.

## Architecture
- **Frontend:** ONE static file `app/index.html` (vanilla JS, no build step, ~2800 lines).
- **Backend:** Supabase project ref `vcgkxskejkgpldfvqnil` ("Koinita Book Club", us-west-1).
  Tables: profiles, books, posts, comments, follows, shelf, circles, circle_members,
  notifications, threads, thread_messages, settings, push_subscriptions. RLS on all.
  Edge functions: `send-email`, `claim-founder-spot`, `create-checkout`.
- **Email:** Resend via the `send-email` edge function (secrets RESEND_API_KEY, FROM_EMAIL
  = hello@koinita.club). Deliverability confirmed working.
- **Auth:** Supabase Auth — passwordless email OTP + Google OAuth.

## Repos & deploy (IMPORTANT)
- **koinita/koinita** — the repo Cloudflare Pages deploys to (koinita.club). Deploy target =
  `app/index.html`. This is what must be updated to ship frontend changes.
- **profloader/alx-pre_course** — mirror. Working copy lives in the `koinita/` subdir
  (`koinita/app/index.html`); dev branch `claude/book-club-landing-page-YPOdr`. Not deployed.
- **Hard-won lesson (don't repeat the token saga):** in the web environment, ALL GitHub
  access goes through the Claude GitHub App and IGNORES any PAT you paste (a deliberately
  fake token authenticates as `Profloader`). So pushing to koinita/koinita ONLY works if
  that repo is added to the session (now done). Do NOT chase tokens.

## Access the new session needs
- **Supabase Personal Access Token** — ask the user to paste it. Use it against the
  Management API SQL endpoint for all backend work:
  `POST https://api.supabase.com/v1/projects/vcgkxskejkgpldfvqnil/database/query`
  body `{"query":"..."}`, header `Authorization: Bearer <PAT>`, **`User-Agent: curl/8.5.0`**
  (Cloudflare blocks Python's default UA), CA bundle `/root/.ccr/ca-bundle.crt`.
  - Service-role key (for invoking edge functions / admin REST): GET
    `/v1/projects/{ref}/api-keys?reveal=true`.
  - Project base for REST/auth/functions: `https://vcgkxskejkgpldfvqnil.supabase.co`.
- **Network access must be "Full"** in the environment (to reach *.supabase.com / *.supabase.co).

## Admins (DO NOT CHANGE)
Only `koinitabookclub@gmail.com` and `admin@koinita.club` are admins. Everyone else is a
reader or author. (I briefly set the owner account admin, then reverted it per the user.)

## Founders
7 real members backfilled as Founders №1–7. Trigger `trg_assign_founder` (BEFORE INSERT on
profiles) auto-numbers every new non-admin signup. `settings.founding_cap` = 25000,
`founder_count` = 7. The owner (pastordayoprof6086@gmail.com) is Founder №2, role reader.

## DONE — Frontend (all in profloader mirror `koinita/app/index.html`, latest commit)
1. Book cards: full cover (`contain`) + title/author moved below + "View book" hover cue.
2. Founding "membership closed" message only shows when spots are actually exhausted.
3. Invite: removed demo "simulate" button; "Koinita is better together" copy; Invite CTAs on
   Discover & Feed headers; invite code persisted in localStorage to survive OAuth redirect.
4. Follow (#7): fixed no-render-on-first-follow bug; write failures now toast.
5. Feed posting (#8): failures now visible; success only after real insert.
6. Attribution (#12): `bookByline()` → "by <author> · Listed by Koinita" for admin-listed.
7. Claim-to-shelf (#3): now PERSISTS (claimShelf called sbClaimBook); explicit
   "＋ Add to my shelf" / "✓ On your shelf" toggle; `removeShelf()` + `sbUnclaim()`.
8. ePub reader (#10 Phase 1): admin Upload/Replace/Remove on book page; epub.js reader via
   short-lived signed URL; per-reader watermark; disabled select/copy/contextmenu/print;
   "Read on Koinita" / "Add to shelf to read".
9. **coverStyle crash fix:** it threw on http cover URLs (NaN index), which aborted the book
   DETAIL render → symptom was "View book just scrolls to top". Detail now uses bookCoverStyle.
10. **mapNotif fix:** was emitting {to,from,ref}; rest of app expects {userId,fromId,refId,text}.
    In-system notifications + bell badge now work. Added `notifText(type)`.
11. `referred_by` written on profile creation (sbCreateProfile).

## DONE — Backend (LIVE in Supabase now)
- Founder: `assign_founder_on_signup()` + `trg_assign_founder`; backfilled 7; buggy
  `claim_founder_spot()` RPC neutralized (was incrementing counter but never setting the
  profile's founder/founder_no).
- Invites: `profiles.referred_by` column; `credit_referrer_on_signup()` + `trg_credit_referrer`
  (AFTER INSERT) credits referrer's invites/charter + notifies; old `credit_referrer` RPC
  neutralized to avoid double-count.
- Shelf: added DELETE policy "Users can remove from shelf".
- ePub: private bucket `epubs`; `books.has_epub` column; storage policies "epub admin manage"
  (admins write) and "epub shelf read" (read only if the book is on your shelf). Verified
  end-to-end (admin upload 200; on-shelf sign 200; off-shelf sign 400).
- Books data: corrected author_name for 4 Koinita-listed titles — Gone by Dawn→H.K. Christie,
  The Girl Who Lied→Shannon Hollinger, The Girls in the Snow→Stacy Green, The Keeper of the
  Irish Secret→Susanne O'Leary (author_user_id still the Koinita account → "Listed by Koinita").
- **Email system:**
  - `send-email` edge function redeployed (v8) with reader/author-tailored `welcome` template
    (keys: name, role, founder, founderNo) + cleaned unicode + `weekly_digest` (key: body).
  - Welcome on signup: `notify_welcome()` + `trg_welcome_email` (AFTER INSERT on profiles)
    → pg_net POST to send-email. Service-role key stored in Vault as `service_role_key`.
  - Weekly digest: `send_weekly_digest()` composes per-user body (new books this week / books
    on shelf / free offers ending ≤3 days), respects `profiles.notif_email`, skips test
    emails; scheduled via pg_cron job `koinita-weekly-digest` = `0 14 * * 1` (Mon 14:00 UTC).
  - `pg_net` (0.20.3) and `pg_cron` (1.6.4) enabled.

## PENDING / TODO (start here)
1. **DEPLOY the latest frontend to koinita/koinita.** koinita/koinita `app/index.html`
   currently holds an EARLIER version (manually synced by the user before the crash fix).
   The latest (items #7, #9, #10 reader, #11, etc.) is in profloader mirror
   `koinita/app/index.html`. → copy it into koinita/koinita `app/index.html` and push to main.
   You CAN push directly now (koinita added to session). Confirm with `git`/MCP.
2. After deploy, re-test: book cover → detail opens; "Add to my shelf" persists on reload;
   follow flips instantly; notifications appear.
3. Confirm email wording with the user (4 test emails were sent to pastordayoprof6086@gmail.com:
   generic welcome, reader welcome, author welcome, sample weekly digest).
4. #2 (deferred by user): OAuth shows `vcgkxskejkgpldfvqnil.supabase.co` on mobile. Real fix =
   Supabase Custom Domain add-on (e.g. auth.koinita.club) + Google OAuth consent branding.
5. #13: author payment tiers are built but `MONETIZATION_ENABLED=false` (free at launch);
   needs STRIPE_SECRET_KEY + price IDs in `create-checkout` when monetizing.
6. ePub Phase 2 (server-side watermarked rendering) only if a publisher demands it.

## Sanity checks to run first in the new session
- `git remote -v` in the koinita/koinita clone; confirm you can push (try a trivial commit or
  use the GitHub MCP create_or_update_file).
- Recreate the Supabase SQL helper (curl UA + CA bundle) and run e.g.
  `select founder_count from settings;` and `select email,admin from profiles where admin;`.
