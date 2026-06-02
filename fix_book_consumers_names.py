"""
Regenerates 06_book_consumers_156k.xlsx with intelligent first-name extraction
from usernames.

Pattern handling:
  nicholas.c.devito  → first segment before dot   → Nicholas
  taylor.hilliard    → first segment before dot   → Taylor
  mi.zeena           → first segment before dot   → Mi
  fergs_plumbing     → first segment before _     → Fergs
  poonam-saini       → first segment before -     → Poonam
  jadegarciamakeup   → longest known-name prefix  → Jade
  lucaslokesh        → longest known-name prefix  → Lucas
  jmatz              → no match → whole username  → Jmatz (fallback)
"""
import csv, re, os
import openpyxl
from openpyxl.styles import PatternFill, Font, Alignment, Border, Side
from openpyxl.utils import get_column_letter
from names_dataset import NameDataset

EMAIL_RE = re.compile(r'^[^@\s]+@[^@\s]+\.[^@\s]+$')
TYPO_MAP = {
    "gmal.com":"gmail.com","gmial.com":"gmail.com","gamil.com":"gmail.com",
    "gmail.co":"gmail.com","gnail.com":"gmail.com","gmil.com":"gmail.com",
    "gmaill.com":"gmail.com","gmai.com":"gmail.com",
    "yaho.com":"yahoo.com","yahooo.com":"yahoo.com","yhoo.com":"yahoo.com",
    "hotmal.com":"hotmail.com","hotmial.com":"hotmail.com","hotmai.com":"hotmail.com",
    "outlok.com":"outlook.com","outllok.com":"outlook.com","outook.com":"outlook.com",
    "icoud.com":"icloud.com","iclod.com":"icloud.com",
}

def normalize(email):
    e = email.strip().lower()
    if "@" not in e: return e
    local, _, domain = e.rpartition("@")
    return f"{local}@{TYPO_MAP.get(domain, domain)}"

def fix_email(email):
    if "@" not in email: return email
    local, _, domain = email.rpartition("@")
    return f"{local}@{TYPO_MAP.get(domain.lower(), domain.lower())}"

BASE = "/home/user/alx-pre_course"
OUT  = f"{BASE}/final_lists"

# ── Build name lookup sets ────────────────────────────────────────────────────
print("Loading name dictionary...")
nd = NameDataset()
_ENGLISH = {"US","GB","CA","AU"}
ALL_NAMES   = {k.lower() for k in nd.first_names if " " not in k}
ALL_NAMES_4 = {k for k in ALL_NAMES if len(k) >= 4}
# High-confidence: top-6000 rank in any English-speaking country
HC_NAMES = set()
for _name, _data in nd.first_names.items():
    if " " in _name: continue
    if any(_data.get("rank",{}).get(cc,99999) <= 6000 for cc in _ENGLISH):
        HC_NAMES.add(_name.lower())
print(f"  {len(ALL_NAMES):,} total names  |  {len(HC_NAMES):,} high-confidence English names")

SOCIAL = {"iam","real","xo","thereal","official","im","its","xoxo","hey","hi","yo"}
VOWELS = set("aeiou")

def _skip_cc(s):
    """Skip 1-2 leading consonants (initials like 'ln', 'cp')."""
    i = 0
    while i < len(s) and s[i] not in VOWELS: i += 1
    return s[i:] if 1 <= i <= 2 else s

def _is_social_prefix(s):
    return any(sw.startswith(s) and sw != s for sw in SOCIAL)

def _find(s, name_set):
    """Longest name_set prefix at start of s; skip social words/prefixes."""
    best = None
    for n in range(3, min(len(s)+1, 13)):
        cand = s[:n]
        if cand in name_set and cand not in SOCIAL and not _is_social_prefix(cand):
            best = cand
    return best

def extract_firstname(username: str) -> str:
    u = username.strip()
    if not u: return ""
    ul = u.lower()

    # Step 1: separator → first segment
    for sep in [".", "_", "-"]:
        if sep in ul:
            seg = ul.split(sep)[0].strip()
            return seg.capitalize() if seg else u.capitalize()

    base = ul.rstrip("0123456789._-+@")

    # Step 2: pos-0, both HC and full dict — return immediately if ≥ 4 chars
    m_hc  = _find(base, HC_NAMES)
    m_all = _find(base, ALL_NAMES_4)
    m0 = max((m_hc, m_all), key=lambda x: len(x) if x else 0)
    if m0 and len(m0) >= 4: return m0.capitalize()
    best3 = m0  # save any 3-char match

    # Step 3: narrow window pos 1-2 (HC only) — catches names after short prefixes
    for start in [1, 2]:
        if start >= len(base) - 2: break
        m2 = _find(base[start:], HC_NAMES)
        if m2 and len(m2) >= 4: return m2.capitalize()
        if m2 and (best3 is None or len(m2) > len(best3)):
            best3 = m2

    # Step 4: social prefix strip → HC pos-0
    for sp in sorted(SOCIAL, key=len, reverse=True):
        if base.startswith(sp) and len(base) > len(sp) + 2:
            m3 = _find(base[len(sp):], HC_NAMES)
            if m3: return m3.capitalize()
            break

    # Step 5: skip consonant cluster (max 2) → HC then full dict
    cand = _skip_cc(base)
    if cand != base:
        m4 = _find(cand, HC_NAMES)
        if m4: return m4.capitalize()
        m4b = _find(cand, ALL_NAMES_4)
        if m4b: return m4b.capitalize()

    # Step 6: 3-char HC match as last resort
    if best3: return best3.capitalize()

    # Step 7: fallback — whole stripped base
    return base.capitalize()

# ── Load previously established global_seen (same priority order) ─────────────
# We need to know which emails in this file are globally unique.
# Re-parse all lists to rebuild global_seen.
SOURCES = [
    ("LinkedIn Leads",      f"{BASE}/leads_raw.csv",               "named"),
    ("Educators",           f"{BASE}/leads2_raw.csv",              "split"),
    ("US Bookstores",       f"{BASE}/leads3_raw.csv",              "numeric_book"),
    ("CBS MarketWatch",     f"{BASE}/leads4_raw.csv",              "numeric_cbs"),
    ("Leads",               f"{BASE}/leads5_raw.csv",              "split"),
    ("Book Consumers 156K", f"{BASE}/leads6_full.csv",             "username"),
]

def parse_email_only(filepath, fmt):
    norms = []
    with open(filepath, encoding="utf-8-sig", newline="") as f:
        for raw in csv.DictReader(f):
            try:
                if fmt == "named":      e = raw.get("Email","") or ""
                elif fmt == "split":    e = raw.get("Email","") or ""
                elif fmt == "numeric_book": e = raw.get("11","") or ""
                elif fmt == "numeric_cbs":  e = raw.get("0","") or ""
                elif fmt == "username": e = raw.get("Email","") or ""
                else: continue
                e = e.strip()
                if EMAIL_RE.match(e): norms.append(normalize(fix_email(e)))
            except Exception: pass
    return norms

print("Building global dedup map...")
global_seen = {}
for label, fp, fmt in SOURCES:
    for ne in parse_email_only(fp, fmt):
        if ne not in global_seen:
            global_seen[ne] = label
print(f"  {len(global_seen):,} unique emails indexed")

# ── Parse Book Consumers with smart name extraction ───────────────────────────
print("Parsing Book Consumers 156K with smart name extraction...")
rows = []
with open(f"{BASE}/leads6_full.csv", encoding="utf-8-sig", newline="") as f:
    for raw in csv.DictReader(f):
        try:
            username = (raw.get("Username","") or "").strip()
            email    = (raw.get("Email","") or "").strip()
            if not email or not EMAIL_RE.match(email): continue
            email = fix_email(email)
            rows.append({
                "email":            email,
                "first_name":       extract_firstname(username),
                "last_name":        "",
                "company_name":     "",
                "phone_number":     "",
                "website":          "",
                "linkedin_profile": "",
                "location":        "",
                "norm":             normalize(email),
            })
        except Exception: pass

print(f"  {len(rows):,} rows parsed")

# Keep only globally unique contacts owned by this list
seen = set()
unique_rows = []
for row in rows:
    ne = row["norm"]
    if global_seen.get(ne) != "Book Consumers 156K": continue
    if ne in seen: continue
    seen.add(ne)
    unique_rows.append(row)

print(f"  {len(unique_rows):,} globally unique contacts")

# Quick sample of name extraction results
import random
sample = random.sample(unique_rows, min(20, len(unique_rows)))
print("\n  Sample name extractions:")
for r in sample:
    print(f"    {r['first_name']:<20s}  ← email: {r['email'][:40]}")

# ── Write Excel ────────────────────────────────────────────────────────────────
TEMPLATE_COLS = [
    "email", "first_name", "last_name", "company_name",
    "phone_number", "website", "linkedin_profile", "location",
]
COL_WIDTHS = {
    "email":36, "first_name":20, "last_name":20, "company_name":28,
    "phone_number":18, "website":30, "linkedin_profile":36, "location":24,
}

FH   = PatternFill("solid", fgColor="2E5090")
FALT = PatternFill("solid", fgColor="EEF3FB")
WB   = Font(bold=True, color="FFFFFF")
THIN = Border(left=Side(style="thin"), right=Side(style="thin"),
              top=Side(style="thin"),  bottom=Side(style="thin"))
CTR  = Alignment(horizontal="center", vertical="center")
WRP  = Alignment(vertical="center", wrap_text=False)

print("\nWriting 06_book_consumers_156k.xlsx ...")
wb = openpyxl.Workbook()
ws = wb.active
ws.title = "Contacts"

for i, col in enumerate(TEMPLATE_COLS, 1):
    cell = ws.cell(1, i, col)
    cell.fill = FH; cell.font = WB; cell.alignment = CTR; cell.border = THIN
    ws.column_dimensions[get_column_letter(i)].width = COL_WIDTHS.get(col, 20)
ws.row_dimensions[1].height = 26
ws.freeze_panes = "A2"

for ri, row in enumerate(unique_rows, 2):
    for ci, col in enumerate(TEMPLATE_COLS, 1):
        cell = ws.cell(ri, ci, row.get(col, ""))
        cell.alignment = WRP; cell.border = THIN
        if ri % 2 == 0:
            cell.fill = FALT
    ws.row_dimensions[ri].height = 15

wb.save(f"{OUT}/06_book_consumers_156k.xlsx")
print(f"  Saved: {OUT}/06_book_consumers_156k.xlsx")
print(f"\nDone — {len(unique_rows):,} contacts written.")
