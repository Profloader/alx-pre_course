# Axitos.ai — Project Reference

## Overview
Axitos is a publishing platform (axitos.ai) built on Duda (site `86c4b43a`). It uses Firebase Authentication instead of Duda's membership app. The dashboard automates AI visibility scoring for authors using the Perplexity API, syncing results to a Google Sheet and the Duda Dashboard collection.

---

## Duda Site

- **Site name:** `86c4b43a`
- **MCP access:** via Duda MCP (no REST API credentials yet — all Duda reads/writes use MCP tools)
- **Publish limitation:** Collection changes require a manual republish in the Duda editor. Auto-publish would need Duda REST API credentials + POST `/api/sites/multiscreen/publish/86c4b43a`

---

## Dashboard Collection

**Collection name:** `Dashboard`

### Fields (exact names matter — note trailing space on AI Chart)
| Field | Type | Notes |
|---|---|---|
| Name | plain_text | |
| Title | plain_text | Book title |
| author_email | email | |
| ChatGPT | plain_text | Score 0–100 |
| Claude | plain_text | Score 0–100 |
| Gemini | plain_text | Score 0–100 |
| Perplexity | plain_text | Score 0–100 |
| AI Visibility | number | Average of 4 scores |
| ChatGPT Status | multi_select | Citing / Learning / Pending |
| Claude Status | multi_select | Citing / Learning / Pending |
| Gemini Status | multi_select | Citing / Learning / Pending |
| Perplexity Status | multi_select | Citing / Learning / Pending |
| AI Chart  | text | Trailing space in name. HTML format. Rolling 10-week comma-separated scores |
| Citation Queries 1–5 | text | HTML format. Top 5 queries that surface the book in AI |
| Updates 1–4 | text | MANUAL ONLY — never overwritten by automation |

### Status thresholds
- **Citing** = score > 10
- **Learning** = score 1–10
- **Pending** = score = 0

### Authors
| Name | Duda Row ID | Slug | Email | Book Title |
|---|---|---|---|---|
| Shanna Daley | `672a63ec-dbbc-4c0f-8e14-d8efa2fa4f1e` | `shanna-daley` | pastordayoprof6086@gmail.com | The Wholeness of a Life Redeemed |
| Tyler Sansom | `24eb4764-2281-4a1e-b1f6-9561a4434ea3` | `tyler-sansom` | rufus.nadhost@gmail.com | Against the Current |
| Rufus Philip | `18ffb9ff-359d-4430-98ee-ccc3286c5870` | `rufus-philip` | rufus@kharispublishing.com | *(no title yet — not scored until added)* |

---

## Google Sheet

- **Sheet ID:** `1VGMveP1ydBZfSg1XrHnpN7Y9tQ9hT9X92AoOJlpUges`
- **Tab name:** `Dashboard` (tab 2 — the first tab is the default Sheet1)
- **Columns match HEADERS array in Apps Script exactly**

---

## Apps Script — Dashboard Scoring & Sync

- **Web App URL:** `https://script.google.com/macros/s/AKfycbyco-X-r5R-WpqLk1yqq43MxAZEpRaMGaUoARXEKa5KhB274A9FSNMj6gRwR4plIwOvWw/exec`
- **Perplexity API Key:** stored in Apps Script only — do not commit here
- **Trigger:** Friday 6am weekly (set via `setupWeeklyTrigger` — already configured)

### Endpoints (GET requests)
| Action | URL param | What it does |
|---|---|---|
| Setup sheet | `?action=setup` | Creates Dashboard tab with header row. **Clears all data — only run on fresh setup** |
| Score all | `?action=score` | Calls Perplexity for every author with a name + title. Updates sheet rows. |
| Read all | `?action=read` | Returns all sheet rows as JSON |
| Upsert row | `?action=upsert&page_item_url=<slug>&<fields>` | Inserts new row if slug not found; updates existing row if found. Only writes non-empty params. |

### How scoring works
1. Apps Script reads all rows from the sheet
2. For each author with a name and title, calls Perplexity API (`sonar` model)
3. Perplexity returns scores for all 4 platforms + 5 citation queries in one call
4. AI Visibility = average of 4 scores (rounded)
5. AI Chart = last 10 weekly scores, comma-separated, appended each run
6. Updates sheet row with scores, statuses, queries, Last Scored timestamp
7. **Does NOT write to Duda automatically** — Duda sync is a separate manual step (or future automation once API credentials available)

### Sync workflow (manual, done in Claude sessions via MCP)
1. Run `?action=score` to update the sheet with fresh Perplexity scores
2. Use Duda MCP `update_collection_rows` to push scores to the Dashboard collection
3. Manually republish the site in Duda editor

### Adding a new author
1. Add them to the Duda Dashboard collection via MCP (`create_collection_rows`)
2. Upsert their basic info to the sheet: `?action=upsert&page_item_url=<slug>&Name=...&Title=...&author_email=...`
3. They'll be scored automatically on the next Friday trigger (or manually via `?action=score`)

---

## Firebase Authentication

- **Project:** `duda-signin`
- **API Key:** `AIzaSyCfv3Q084uxDRHfCvDN0xOwr-mf_k-egrA`
- **Auth Domain:** `duda-signin.firebaseapp.com`
- **App ID:** `1:291509505205:web:1c36e840f9397f4fa0c2fc`
- SDK version: compat v9.23.0

### Sign-in contact sheet
- **Apps Script URL:** `https://script.google.com/macros/s/AKfycbwQa8KeQmmlxyefE9KnfLY7Be-1xZLn01JV9u80sE7X1vuWpwb_Yj8rZfO1BdzJ2qOD/exec`
- Saves new registrant contacts (name, email, type, date) via GET request with URL params
- Uses `doGet(e)` — not doPost

---

## Phases Completed
- [x] Firebase Authentication replacing Duda membership app
- [x] Sign-in page with Google OAuth + email/password
- [x] New registrant contacts saved to Google Sheet
- [x] Dashboard collection fields set up (including Citation Queries 4 & 5)
- [x] Perplexity-only scoring (Gemini removed — quota blocked on all keys)
- [x] Apps Script web app deployed with score/read/upsert/setup actions
- [x] Friday 6am weekly trigger configured
- [x] Initial scores synced to sheet and Duda collection

## Next Phase
- [ ] KDP integration (to be added to the same Apps Script project — no separate routine)
- [ ] Duda REST API credentials (enables auto-publish after collection updates)
- [ ] Full end-to-end automation (score → sheet → Duda → publish) without manual steps
