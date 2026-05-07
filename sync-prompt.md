# Axitos Dashboard — Automated Weekly Sync

You are running the weekly automated sync for the Axitos dashboard.
All project context is in CLAUDE.md in this directory. Read it before proceeding.

## Your task — execute these steps in order:

### Step 1 — Score all authors
Call the Apps Script score endpoint:
  URL: https://script.google.com/macros/s/AKfycbyco-X-r5R-WpqLk1yqq43MxAZEpRaMGaUoARXEKa5KhB274A9FSNMj6gRwR4plIwOvWw/exec?action=score

The URL will redirect. Follow the redirect URL in the response automatically.

Wait for the JSON response. If `scored` is 0 or the call fails, stop and do not proceed
to Duda — the sheet was not updated and there is nothing to sync.

### Step 2 — Read all sheet data
Call the read endpoint to get the full scored data including Blog Topics, Keywords, Details etc.:
  URL: https://script.google.com/macros/s/AKfycbyco-X-r5R-WpqLk1yqq43MxAZEpRaMGaUoARXEKa5KhB274A9FSNMj6gRwR4plIwOvWw/exec?action=read

Follow the redirect. Parse the full JSON array.

### Step 3 — Push to Duda collection
Use the Duda MCP tool `update_collection_rows` on site `86c4b43a`, collection `Dashboard`.

Update every author row that was scored (skip Rufus Philip if Title is empty).

#### Critical field formatting rules:
- `ChatGPT`, `Claude`, `Gemini`, `Perplexity`, `AI Visibility` → plain_text, append "%" to the number (e.g. "42%")
- `ChatGPT Status`, `Claude Status`, `Gemini Status`, `Perplexity Status` → multi_select array (e.g. ["Citing"])
- `ChatGPT Details`, `Claude Details`, `Gemini Details`, `Perplexity Details` → text, wrap in HTML: `<p class="rteBlock">value</p>`
- `AI Chart ` (trailing space in field name) → text, wrap in HTML: `<p class="rteBlock">value</p>`
- `Citation Queries 1–5` → text, wrap in HTML: `<p class="rteBlock">value</p>`
- `Blog_Topic_1–5`, `Strategic_Why_1–5`, `Keyword_1–5`, `Suggested_Title_1–3`, `Trend_Source` → plain_text, plain string (no HTML)
- `Updates 1–4` → NEVER overwrite. Read the current value from the Duda collection first and preserve it exactly.
- `author_email`, `Name`, `Title` → preserve existing values

#### Author Duda row IDs:
- Shanna Daley → id: `672a63ec-dbbc-4c0f-8e14-d8efa2fa4f1e`
- Tyler Sansom  → id: `24eb4764-2281-4a1e-b1f6-9561a4434ea3`
- Rufus Philip  → id: `18ffb9ff-359d-4430-98ee-ccc3286c5870` (skip if no Title)

You MUST include ALL fields when calling update_collection_rows — not just the ones that changed.
To get the current Updates 1–4 values to preserve, call `get_collections` on the Dashboard collection first.

### Step 4 — Confirm
Log a short summary: how many authors scored, their AI Visibility scores, and that Duda was updated.
Do not publish the site — that requires manual action in the Duda editor.
