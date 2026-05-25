"""
Global cross-list deduplication across all 7 batches / 17 source files.
Finds emails that appear in more than one list and produces a full report.
"""
import csv, json, re, sys
from collections import defaultdict
from datetime import datetime
import openpyxl
from openpyxl.styles import PatternFill, Font, Alignment, Border, Side
from openpyxl.utils import get_column_letter

EMAIL_RE = re.compile(r'^[^@\s]+@[^@\s]+\.[^@\s]+$')

# ── Typo map (same as validator) ──────────────────────────────────────────────
TYPO_MAP = {
    "gmal.com":"gmail.com","gmial.com":"gmail.com","gamil.com":"gmail.com",
    "gmail.co":"gmail.com","gnail.com":"gmail.com","gmil.com":"gmail.com",
    "gmaill.com":"gmail.com","gmai.com":"gmail.com",
    "yaho.com":"yahoo.com","yahooo.com":"yahoo.com","yhoo.com":"yahoo.com",
    "hotmal.com":"hotmail.com","hotmial.com":"hotmail.com","hotmai.com":"hotmail.com",
    "outlok.com":"outlook.com","outllok.com":"outlook.com","outook.com":"outlook.com",
    "icoud.com":"icloud.com","iclod.com":"icloud.com",
}

def normalize_email(email: str) -> str:
    e = email.strip().lower()
    if "@" not in e:
        return e
    local, _, domain = e.rpartition("@")
    domain = TYPO_MAP.get(domain, domain)
    return f"{local}@{domain}"

# ── Source file definitions ───────────────────────────────────────────────────
BASE = "/home/user/alx-pre_course"

SOURCES = [
    # (label, filepath, email_col, name_col, format)
    # format: "standard"=Contact Name/Email, "named"=Name/Email, "username"=Username/Email,
    #         "numeric_book"=col11=email, "numeric_cbs"=col0=email, "split"=FirstName+LastName/Email
    ("LinkedIn Leads",       f"{BASE}/leads_raw.csv",              "Email",         "Name",         "named"),
    ("Educators",            f"{BASE}/leads2_raw.csv",             "Email",         None,           "split"),
    ("US Bookstores",        f"{BASE}/leads3_raw.csv",             None,            None,           "numeric_book"),
    ("CBS MarketWatch",      f"{BASE}/leads4_raw.csv",             None,            None,           "numeric_cbs"),
    ("Leads",                f"{BASE}/leads5_raw.csv",             "Email",         None,           "split"),
    ("Book Consumers 156K",  f"{BASE}/leads6_full.csv",            "Email",         "Username",     "username"),
    ("B7 Christians US",     f"{BASE}/batch7/christian_us.csv",    "Contact Email", "Contact Name", "standard"),
    ("B7 Christians UK",     f"{BASE}/batch7/christian_uk.csv",    "Contact Email", "Contact Name", "standard"),
    ("B7 Non-Christian US",  f"{BASE}/batch7/non_christian_us.csv","Contact Email", "Contact Name", "standard"),
    ("B7 Non-Christian UK",  f"{BASE}/batch7/non_christian_uk.csv","Contact Email", "Contact Name", "standard"),
    ("B7 Non-Christian AU",  f"{BASE}/batch7/non_christian_au.csv","Contact Email", "Contact Name", "standard"),
    ("B7 Random US",         f"{BASE}/batch7/random_us.csv",       "Contact Email", "Contact Name", "standard"),
    ("B7 Random UK",         f"{BASE}/batch7/random_uk.csv",       "Contact Email", "Contact Name", "standard"),
    ("B7 Random AU",         f"{BASE}/batch7/random_au.csv",       "Contact Email", "Contact Name", "standard"),
    ("B7 Agencies",          f"{BASE}/batch7/agencies.csv",        "Contact Email", "Contact Name", "standard"),
    ("B7 Bookstores",        f"{BASE}/batch7/bookstores.csv",      "Contact Email", "Contact Name", "standard"),
    ("B7 Master",            f"{BASE}/batch7/all_contacts_master.csv","Contact Email","Contact Name","standard"),
]

def load_source(label, filepath, email_col, name_col, fmt) -> list[dict]:
    rows = []
    with open(filepath, encoding="utf-8-sig", newline="") as f:
        reader = csv.DictReader(f)
        for raw in reader:
            try:
                if fmt == "standard":
                    name  = (raw.get("Contact Name","") or "").strip()
                    email = (raw.get("Contact Email","") or "").strip()
                    phone = (raw.get("Contact Phone","") or "").strip()
                    # Fix LinkedIn-shifted rows
                    if email and not EMAIL_RE.match(email):
                        phone2 = (raw.get("Contact Phone","") or "").strip()
                        if EMAIL_RE.match(phone2):
                            name  = f"{name} {email}".strip()
                            email = phone2
                            phone = ""
                    if name in ("Contact Name","First Name"):
                        continue
                elif fmt == "named":
                    name  = (raw.get("Name","") or "").strip()
                    email = (raw.get("Email","") or "").strip()
                    phone = (raw.get("Phone Number", raw.get("Phone","")) or "").strip()
                elif fmt == "split":
                    fn    = (raw.get("First name", raw.get("First Name","")) or "").strip()
                    ln    = (raw.get("Last name",  raw.get("Last Name",""))  or "").strip()
                    name  = f"{fn} {ln}".strip()
                    email = (raw.get("Email","") or "").strip()
                    phone = ""
                elif fmt == "username":
                    name  = (raw.get("Username","") or "").strip()
                    email = (raw.get("Email","") or "").strip()
                    phone = ""
                elif fmt == "numeric_book":
                    name  = (raw.get("8","") or "").strip()
                    email = (raw.get("11","") or "").strip()
                    phone = (raw.get("10","") or "").strip()
                elif fmt == "numeric_cbs":
                    fn    = (raw.get("1","") or "").strip()
                    ln    = (raw.get("2","") or "").strip()
                    name  = f"{fn} {ln}".strip()
                    email = (raw.get("0","") or "").strip()
                    phone = (raw.get("7","") or "").strip()
                else:
                    continue

                if not email or not EMAIL_RE.match(email):
                    continue
                rows.append({"name": name, "email": email,
                             "phone": phone, "source": label,
                             "norm_email": normalize_email(email)})
            except Exception:
                pass
    return rows

# ── Load all sources ──────────────────────────────────────────────────────────
print("Loading all sources...")
all_rows: list[dict] = []
source_counts: dict[str, int] = {}
for label, fp, ec, nc, fmt in SOURCES:
    rows = load_source(label, fp, ec, nc, fmt)
    source_counts[label] = len(rows)
    all_rows.extend(rows)
    print(f"  {label:<25s}: {len(rows):>7,} rows")

print(f"\nTotal rows loaded: {len(all_rows):,}")

# ── Build email → list of sources ────────────────────────────────────────────
print("\nBuilding cross-list duplicate index...")
email_to_sources: dict[str, list[dict]] = defaultdict(list)
for row in all_rows:
    email_to_sources[row["norm_email"]].append(row)

# Find cross-list duplicates (same email in 2+ different top-level lists)
# Group B7 sub-lists under "Batch 7" for top-level comparison
def top_level(src: str) -> str:
    if src.startswith("B7 "):
        return "Batch 7 (Segmented)"
    return src

cross_list_dupes: dict[str, list[dict]] = {}
for norm_email, occurrences in email_to_sources.items():
    top_levels = set(top_level(o["source"]) for o in occurrences)
    if len(top_levels) > 1:
        cross_list_dupes[norm_email] = occurrences

print(f"Emails appearing in 2+ top-level lists: {len(cross_list_dupes):,}")

# ── Build overlap matrix ──────────────────────────────────────────────────────
TOP_LEVEL_LISTS = [
    "LinkedIn Leads", "Educators", "US Bookstores", "CBS MarketWatch",
    "Leads", "Book Consumers 156K", "Batch 7 (Segmented)"
]

overlap: dict[tuple, int] = defaultdict(int)
for norm_email, occs in cross_list_dupes.items():
    tops = sorted(set(top_level(o["source"]) for o in occs))
    for i in range(len(tops)):
        for j in range(i+1, len(tops)):
            overlap[(tops[i], tops[j])] += 1

# ── Per-source unique vs duplicate ───────────────────────────────────────────
# Mark first occurrence globally as "keep", rest as cross-list dupes
seen_global: set[str] = set()
unique_global = 0
cross_dupe_global = 0
per_source_stats: dict[str, dict] = {label: {"total": c, "cross_dupes": 0, "unique": 0}
                                      for label, c in source_counts.items()}

for norm_email, occs in email_to_sources.items():
    sources_seen = []
    for o in occs:
        src = o["source"]
        if norm_email not in seen_global:
            seen_global.add(norm_email)
            per_source_stats[src]["unique"] += 1
            unique_global += 1
        else:
            per_source_stats[src]["cross_dupes"] += 1
            cross_dupe_global += 1

# ── Excel output ──────────────────────────────────────────────────────────────
FILL_HEADER = PatternFill("solid", fgColor="2E5090")
FILL_RED    = PatternFill("solid", fgColor="FFC7CE")
FILL_YELLOW = PatternFill("solid", fgColor="FFEB9C")
FILL_GREEN  = PatternFill("solid", fgColor="C6EFCE")
FILL_BLUE   = PatternFill("solid", fgColor="BDD7EE")
FILL_GREY   = PatternFill("solid", fgColor="D9D9D9")
FW = Font(bold=True, color="FFFFFF")
FB = Font(bold=True)
THIN = Border(left=Side(style="thin"),right=Side(style="thin"),
              top=Side(style="thin"),bottom=Side(style="thin"))

def hdr(ws, cols, widths):
    ws.append(cols)
    for i, (c, w) in enumerate(zip(cols, widths), 1):
        cell = ws.cell(1, i)
        cell.fill = FILL_HEADER; cell.font = FW
        cell.alignment = Alignment(horizontal="center", vertical="center", wrap_text=True)
        cell.border = THIN
        ws.column_dimensions[get_column_letter(i)].width = w
    ws.row_dimensions[1].height = 28
    ws.freeze_panes = "A2"

def dcell(ws, r, c, v, fill=None):
    cell = ws.cell(r, c, v)
    cell.alignment = Alignment(vertical="center", wrap_text=True)
    cell.border = THIN
    if fill:
        cell.fill = fill
    return cell

OUT = f"{BASE}/global_cross_list_dedup.xlsx"
wb = openpyxl.Workbook()

# ── Sheet 1: Summary ──────────────────────────────────────────────────────────
ws1 = wb.active
ws1.title = "Summary"
ws1.column_dimensions["A"].width = 30
ws1.column_dimensions["B"].width = 14
ws1.column_dimensions["C"].width = 14
ws1.column_dimensions["D"].width = 14

ws1.cell(1,1,"GLOBAL CROSS-LIST DEDUPLICATION REPORT").font = Font(bold=True, size=14, color="2E5090")
ws1.cell(2,1,f"Generated: {datetime.now().strftime('%Y-%m-%d %H:%M')}").font = Font(italic=True)
ws1.cell(3,1,f"Sources analysed: {len(SOURCES)}")
ws1.cell(4,1,"")

# Header row
for c, (v, w) in enumerate(zip(["List / Source","Total Contacts","Cross-List Dupes","Unique (globally)"],[30,16,18,18]),1):
    cell = ws1.cell(5, c, v)
    cell.fill = FILL_HEADER; cell.font = FW
    cell.alignment = Alignment(horizontal="center",vertical="center")
    cell.border = THIN
    ws1.column_dimensions[get_column_letter(c)].width = w

row = 6
for label, _, _, _, _ in SOURCES:
    s = per_source_stats[label]
    dcell(ws1, row, 1, label)
    dcell(ws1, row, 2, s["total"])
    cd = s["cross_dupes"]
    pct = cd / s["total"] * 100 if s["total"] else 0
    fill = FILL_RED if pct > 20 else FILL_YELLOW if pct > 5 else FILL_GREEN
    dcell(ws1, row, 3, f"{cd:,} ({pct:.1f}%)", fill)
    dcell(ws1, row, 4, s["unique"])
    row += 1

# Totals
row += 1
dcell(ws1, row, 1, "TOTAL", FILL_GREY).font = FB
dcell(ws1, row, 2, f"{len(all_rows):,}", FILL_GREY).font = FB
dcell(ws1, row, 3, f"{cross_dupe_global:,}", FILL_GREY).font = FB
dcell(ws1, row, 4, f"{unique_global:,}", FILL_GREY).font = FB

# ── Sheet 2: Overlap Matrix ───────────────────────────────────────────────────
ws2 = wb.create_sheet("Overlap Matrix")
ws2.cell(1, 1, "Cross-list email overlap (how many emails are shared between each pair of lists)").font = Font(bold=True, color="2E5090")
short = {
    "LinkedIn Leads":"LinkedIn", "Educators":"Educators", "US Bookstores":"Bookstores(US)",
    "CBS MarketWatch":"CBS/MW", "Leads":"Leads", "Book Consumers 156K":"BookCons156K",
    "Batch 7 (Segmented)":"Batch7"
}
labels_short = [short.get(l, l) for l in TOP_LEVEL_LISTS]

for c, l in enumerate([""] + labels_short, 1):
    cell = ws2.cell(3, c, l)
    cell.fill = FILL_HEADER; cell.font = FW
    cell.alignment = Alignment(horizontal="center", vertical="center", wrap_text=True)
    cell.border = THIN
    ws2.column_dimensions[get_column_letter(c)].width = 16
ws2.row_dimensions[3].height = 40

for r, la in enumerate(TOP_LEVEL_LISTS, 4):
    ws2.cell(r, 1, short.get(la, la)).fill = FILL_HEADER
    ws2.cell(r, 1).font = FW
    ws2.cell(r, 1).border = THIN
    ws2.row_dimensions[r].height = 18
    for c, lb in enumerate(TOP_LEVEL_LISTS, 2):
        if la == lb:
            cell = ws2.cell(r, c, "—")
            cell.fill = FILL_GREY
        else:
            key = tuple(sorted([la, lb]))
            val = overlap.get(key, 0)
            cell = ws2.cell(r, c, val if val else "")
            if val > 1000:
                cell.fill = FILL_RED; cell.font = FB
            elif val > 100:
                cell.fill = FILL_YELLOW; cell.font = FB
            elif val > 0:
                cell.fill = FILL_BLUE
        cell.alignment = Alignment(horizontal="center", vertical="center")
        cell.border = THIN

# ── Sheet 3: Cross-list duplicate records ─────────────────────────────────────
ws3 = wb.create_sheet("Cross-List Duplicates")
cols3 = ["Email","Name","Source List","Occurrence #","Norm Email"]
widths3 = [38, 30, 28, 14, 38]
hdr(ws3, cols3, widths3)
row = 2
for norm_email, occs in sorted(cross_list_dupes.items(), key=lambda x: -len(x[1])):
    top_set = sorted(set(top_level(o["source"]) for o in occs))
    for occ_i, o in enumerate(occs, 1):
        fill = FILL_RED if len(top_set) > 2 else FILL_YELLOW
        dcell(ws3, row, 1, o["email"], fill)
        dcell(ws3, row, 2, o["name"], fill)
        dcell(ws3, row, 3, o["source"], fill)
        dcell(ws3, row, 4, occ_i, fill)
        dcell(ws3, row, 5, norm_email, fill)
        row += 1
    ws3.row_dimensions[row-1].height = 16

# ── Sheet 4: Global clean unique list ────────────────────────────────────────
ws4 = wb.create_sheet("Global Unique Contacts")
cols4 = ["Email","Name","Phone","Primary Source","Norm Email"]
widths4 = [38, 30, 20, 28, 38]
hdr(ws4, cols4, widths4)
seen_write: set[str] = set()
row = 2
for label, _, _, _, _ in SOURCES:
    for o in all_rows:
        if o["source"] != label:
            continue
        ne = o["norm_email"]
        if ne in seen_write:
            continue
        seen_write.add(ne)
        dcell(ws4, row, 1, o["email"])
        dcell(ws4, row, 2, o["name"])
        dcell(ws4, row, 3, o["phone"])
        dcell(ws4, row, 4, o["source"])
        dcell(ws4, row, 5, ne)
        row += 1

wb.save(OUT)
print(f"\nSaved: {OUT}")
print(f"\n{'='*60}")
print(f"  GLOBAL DEDUP SUMMARY")
print(f"{'='*60}")
print(f"  Total records across all lists : {len(all_rows):>8,}")
print(f"  Globally unique emails         : {unique_global:>8,}")
print(f"  Cross-list duplicates          : {cross_dupe_global:>8,}")
print(f"  Emails in 2+ top-level lists   : {len(cross_list_dupes):>8,}")
print(f"\n  Top overlaps between lists:")
top_overlaps = sorted(overlap.items(), key=lambda x: -x[1])[:10]
for (a,b), cnt in top_overlaps:
    print(f"    {short.get(a,a):<18s} ↔ {short.get(b,b):<18s} : {cnt:>6,}")
print(f"{'='*60}")
