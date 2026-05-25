"""
Produces:
  1. One clean Excel per list (full + deduplicated tab)
  2. One master Excel with all globally unique contacts

Global dedup rule: first list in priority order wins.
Priority: LinkedIn Leads → Educators → US Bookstores → CBS MarketWatch
          → Leads → Book Consumers 156K → Batch 7 segments
"""
import csv, re, sys, os
from collections import defaultdict
from datetime import datetime
import openpyxl
from openpyxl.styles import PatternFill, Font, Alignment, Border, Side
from openpyxl.utils import get_column_letter

# ── Shared setup (mirrors global_dedup.py) ────────────────────────────────────
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

def fix_typo(email):
    if "@" not in email: return email, None
    local, _, domain = email.rpartition("@")
    fixed = TYPO_MAP.get(domain.lower())
    if fixed and fixed != domain.lower():
        return f"{local}@{fixed}", f"{domain} → {fixed}"
    return email, None

BASE = "/home/user/alx-pre_course"
OUT  = f"{BASE}/final_lists"
os.makedirs(OUT, exist_ok=True)

# ── Source definitions ────────────────────────────────────────────────────────
# (label, filepath, format, output_filename)
SOURCES = [
    ("LinkedIn Leads",      f"{BASE}/leads_raw.csv",               "named",       "01_linkedin_leads.xlsx"),
    ("Educators",           f"{BASE}/leads2_raw.csv",              "split",       "02_educators.xlsx"),
    ("US Bookstores",       f"{BASE}/leads3_raw.csv",              "numeric_book","03_us_bookstores.xlsx"),
    ("CBS MarketWatch",     f"{BASE}/leads4_raw.csv",              "numeric_cbs", "04_cbs_marketwatch.xlsx"),
    ("Leads",               f"{BASE}/leads5_raw.csv",              "split",       "05_leads.xlsx"),
    ("Book Consumers 156K", f"{BASE}/leads6_full.csv",             "username",    "06_book_consumers_156k.xlsx"),
    ("B7 Christians US",    f"{BASE}/batch7/christian_us.csv",     "standard",    None),
    ("B7 Christians UK",    f"{BASE}/batch7/christian_uk.csv",     "standard",    None),
    ("B7 Non-Christian US", f"{BASE}/batch7/non_christian_us.csv", "standard",    None),
    ("B7 Non-Christian UK", f"{BASE}/batch7/non_christian_uk.csv", "standard",    None),
    ("B7 Non-Christian AU", f"{BASE}/batch7/non_christian_au.csv", "standard",    None),
    ("B7 Random US",        f"{BASE}/batch7/random_us.csv",        "standard",    None),
    ("B7 Random UK",        f"{BASE}/batch7/random_uk.csv",        "standard",    None),
    ("B7 Random AU",        f"{BASE}/batch7/random_au.csv",        "standard",    None),
    ("B7 Agencies",         f"{BASE}/batch7/agencies.csv",         "standard",    None),
    ("B7 Bookstores",       f"{BASE}/batch7/bookstores.csv",       "standard",    None),
]

# Batch 7 outputs as one combined segmented file
BATCH7_LABELS = {l for l,_,_,o in SOURCES if l.startswith("B7")}
BATCH7_OUT = "07_batch7_segmented.xlsx"

# ── Parser ────────────────────────────────────────────────────────────────────
def parse(filepath, fmt, label):
    rows = []
    with open(filepath, encoding="utf-8-sig", newline="") as f:
        reader = csv.DictReader(f)
        for raw in reader:
            try:
                if fmt == "standard":
                    name  = (raw.get("Contact Name","") or "").strip()
                    email = (raw.get("Contact Email","") or "").strip()
                    phone = (raw.get("Contact Phone","") or "").strip()
                    title = (raw.get("Contact Title","") or "").strip()
                    company=(raw.get("Contact Company","") or "").strip()
                    source=(raw.get("Contact Source","") or "").strip()
                    if name in ("Contact Name","First Name"): continue
                    if email and not EMAIL_RE.match(email) and EMAIL_RE.match(phone):
                        name = f"{name} {email}".strip(); email = phone; phone = ""
                elif fmt == "named":
                    name  = (raw.get("Name","") or "").strip()
                    email = (raw.get("Email","") or "").strip()
                    phone = (raw.get("Phone Number",raw.get("Phone","")) or "").strip()
                    title = (raw.get("Title","") or "").strip()
                    company=(raw.get("Company","") or "").strip()
                    source=(raw.get("Source","") or "").strip()
                elif fmt == "split":
                    fn   = (raw.get("First name",raw.get("First Name","")) or "").strip()
                    ln   = (raw.get("Last name", raw.get("Last Name",""))  or "").strip()
                    name = f"{fn} {ln}".strip()
                    email = (raw.get("Email","") or "").strip()
                    phone = title = company = source = ""
                elif fmt == "username":
                    name  = (raw.get("Username","") or "").strip()
                    email = (raw.get("Email","") or "").strip()
                    phone = title = company = source = ""
                elif fmt == "numeric_book":
                    name    = (raw.get("8","") or "").strip()
                    email   = (raw.get("11","") or "").strip()
                    phone   = (raw.get("10","") or "").strip()
                    title   = (raw.get("9","") or "").strip()
                    company = (raw.get("0","") or "").strip()
                    source  = (raw.get("7","") or "").strip()
                elif fmt == "numeric_cbs":
                    fn   = (raw.get("1","") or "").strip()
                    ln   = (raw.get("2","") or "").strip()
                    name = f"{fn} {ln}".strip()
                    email = (raw.get("0","") or "").strip()
                    phone = (raw.get("7","") or "").strip()
                    title = company = source = ""
                else:
                    continue

                if not email or not EMAIL_RE.match(email): continue
                corrected, typo = fix_typo(email)
                rows.append({
                    "Name": name, "Email": email,
                    "Corrected Email": corrected,
                    "Typo Fixed": typo or "",
                    "Phone": phone, "Title": title,
                    "Company": company, "Source": source,
                    "Segment": label,
                    "norm": normalize(email),
                })
            except Exception: pass
    return rows

# ── Load all, build global dedup map ─────────────────────────────────────────
print("Loading all sources...")
all_by_label = {}
for label, fp, fmt, _ in SOURCES:
    rows = parse(fp, fmt, label)
    all_by_label[label] = rows
    print(f"  {label:<25s}: {len(rows):>7,}")

# Global dedup: first list in order wins
global_seen = {}   # norm_email → label that owns it
for label, fp, fmt, _ in SOURCES:
    for row in all_by_label[label]:
        ne = row["norm"]
        if ne not in global_seen:
            global_seen[ne] = label

total_unique = len(global_seen)
print(f"\nGlobally unique emails: {total_unique:,}")

# ── Styling helpers ───────────────────────────────────────────────────────────
FH = PatternFill("solid", fgColor="2E5090")
FG = PatternFill("solid", fgColor="C6EFCE")
FY = PatternFill("solid", fgColor="FFEB9C")
FR = PatternFill("solid", fgColor="FFC7CE")
FB = PatternFill("solid", fgColor="BDD7EE")
FGR= PatternFill("solid", fgColor="D9D9D9")
WB = Font(bold=True, color="FFFFFF")
BLD= Font(bold=True)
THIN = Border(left=Side(style="thin"),right=Side(style="thin"),
              top=Side(style="thin"),bottom=Side(style="thin"))
CTR = Alignment(horizontal="center",vertical="center")
WRP = Alignment(vertical="center", wrap_text=True)

COLS = [
    ("Name",30), ("Email",38), ("Corrected Email",38), ("Typo Fixed",25),
    ("Global Status",32), ("Phone",22), ("Title",30), ("Company",30), ("Source",40),
]
COLS_MASTER = [
    ("Name",30), ("Email",38), ("Corrected Email",38), ("Typo Fixed",25),
    ("Source List",28), ("Phone",22), ("Title",30), ("Company",30), ("Source",40),
]

def write_header(ws, cols):
    ws.append([c for c,_ in cols])
    for i,(c,w) in enumerate(cols,1):
        cell = ws.cell(1,i)
        cell.fill = FH; cell.font = WB; cell.alignment = CTR; cell.border = THIN
        ws.column_dimensions[get_column_letter(i)].width = w
    ws.row_dimensions[1].height = 28
    ws.freeze_panes = "A2"

def write_row(ws, r, values, fill=None):
    for c, v in enumerate(values, 1):
        cell = ws.cell(r, c, v)
        cell.alignment = WRP; cell.border = THIN
        if fill: cell.fill = fill
        if c == 4 and v:   # Typo Fixed column
            cell.fill = FB; cell.font = BLD
        if c == 5 and fill: # Global Status
            cell.font = BLD

def decide_fill(row, is_dupe):
    if is_dupe: return FGR
    if row.get("Typo Fixed"): return FG
    return None

# ── Write individual list files (1–6) ────────────────────────────────────────
standalone = [(l,fp,fmt,out) for l,fp,fmt,out in SOURCES if out and not l.startswith("B7")]

for label, fp, fmt, outfile in standalone:
    print(f"\nWriting: {label} → {outfile}")
    rows = all_by_label[label]
    wb = openpyxl.Workbook()

    # Sheet 1: All contacts with global status
    ws1 = wb.active
    ws1.title = "All Contacts"
    write_header(ws1, COLS)
    seen_within = set()
    for ri, row in enumerate(rows, 2):
        ne = row["norm"]
        owner = global_seen.get(ne, label)
        within_dup = ne in seen_within
        if not within_dup: seen_within.add(ne)
        is_dupe = (owner != label) or within_dup
        if owner != label:
            status = f"Duplicate — also in: {owner}"
        elif within_dup:
            status = "Duplicate — within this list"
        else:
            status = "Unique"
        fill = FGR if is_dupe else (FB if row["Typo Fixed"] else FG)
        write_row(ws1, ri, [
            row["Name"], row["Email"], row["Corrected Email"], row["Typo Fixed"],
            status, row["Phone"], row["Title"], row["Company"], row["Source"],
        ], fill)
        ws1.row_dimensions[ri].height = 16

    # Sheet 2: Clean (globally unique only)
    ws2 = wb.create_sheet("Clean (Globally Unique)")
    write_header(ws2, COLS)
    ri = 2
    seen_clean = set()
    for row in rows:
        ne = row["norm"]
        if global_seen.get(ne) != label: continue
        if ne in seen_clean: continue
        seen_clean.add(ne)
        fill = FB if row["Typo Fixed"] else FG
        write_row(ws2, ri, [
            row["Name"], row["Email"], row["Corrected Email"], row["Typo Fixed"],
            "Unique", row["Phone"], row["Title"], row["Company"], row["Source"],
        ], fill)
        ws2.row_dimensions[ri].height = 16
        ri += 1

    # Sheet 3: Summary
    ws3 = wb.create_sheet("Summary")
    ws3.column_dimensions["A"].width = 32
    ws3.column_dimensions["B"].width = 14
    total = len(rows)
    within_dupes = sum(1 for r in rows if
        list(r["norm"] for r in rows).count(r["norm"]) > 1)
    cross_dupes = sum(1 for r in rows if global_seen.get(r["norm"]) != label)
    clean_count = ri - 2
    typos = sum(1 for r in rows if r["Typo Fixed"])
    summary = [
        ("List", label),
        ("Total contacts", total),
        ("Cross-list duplicates (owned by another list)", cross_dupes),
        ("Within-list duplicates", sum(1 for r in rows if rows.count(r) > 0) - len(set(r["norm"] for r in rows))),
        ("Typos corrected", typos),
        ("Clean unique contacts (this list)", clean_count),
        ("", ""),
        ("Generated", datetime.now().strftime("%Y-%m-%d %H:%M")),
    ]
    for r_i, (k, v) in enumerate(summary, 1):
        ws3.cell(r_i, 1, k).font = BLD if k else Font()
        ws3.cell(r_i, 2, v)

    wb.save(f"{OUT}/{outfile}")
    print(f"  Total: {total:,}  |  Unique: {clean_count:,}  |  Cross-dupes: {cross_dupes:,}  |  Typos: {typos}")

# ── Write Batch 7 file (all segments combined) ───────────────────────────────
print(f"\nWriting: Batch 7 → {BATCH7_OUT}")
b7_labels_ordered = [l for l,_,_,_ in SOURCES if l.startswith("B7") and not "Master" in l]
b7_segment_names = {
    "B7 Christians US":"Christians US","B7 Christians UK":"Christians UK",
    "B7 Non-Christian US":"Non-Christian US","B7 Non-Christian UK":"Non-Christian UK",
    "B7 Non-Christian AU":"Non-Christian AU","B7 Random US":"Random US",
    "B7 Random UK":"Random UK","B7 Random AU":"Random AU",
    "B7 Agencies":"Agencies","B7 Bookstores":"Bookstores",
}

B7_COLS = [
    ("Name",30), ("Email",38), ("Corrected Email",38), ("Typo Fixed",25),
    ("Segment",22), ("Global Status",32), ("Phone",22), ("Title",30),
    ("Company",30), ("Source",40),
]

wb7 = openpyxl.Workbook()
wb7.active.title = "All B7 Contacts"
ws_all = wb7.active
write_header(ws_all, B7_COLS)
ri_all = 2

for b7_label in b7_labels_ordered:
    seg_name = b7_segment_names.get(b7_label, b7_label)
    ws = wb7.create_sheet(seg_name)
    write_header(ws, B7_COLS)
    ri = 2
    seen_seg = set()
    for row in all_by_label.get(b7_label, []):
        ne = row["norm"]
        owner = global_seen.get(ne, b7_label)
        within_dup = ne in seen_seg
        if not within_dup: seen_seg.add(ne)
        is_cross = owner not in BATCH7_LABELS
        if is_cross:
            status = f"Duplicate — also in: {owner}"
        elif within_dup:
            status = "Duplicate — within segment"
        elif owner != b7_label:
            status = f"Duplicate — also in B7: {b7_segment_names.get(owner, owner)}"
        else:
            status = "Unique"
        fill = FGR if (is_cross or within_dup) else (FB if row["Typo Fixed"] else FG)
        vals = [row["Name"], row["Email"], row["Corrected Email"], row["Typo Fixed"],
                seg_name, status, row["Phone"], row["Title"], row["Company"], row["Source"]]
        write_row(ws, ri, vals, fill)
        ws.row_dimensions[ri].height = 16
        ri += 1
        # Also write to all-B7 sheet
        write_row(ws_all, ri_all, vals, fill)
        ws_all.row_dimensions[ri_all].height = 16
        ri_all += 1

wb7.save(f"{OUT}/{BATCH7_OUT}")
print(f"  B7 total rows written: {ri_all - 2:,}")

# ── Write Master: all globally unique contacts ─────────────────────────────
print(f"\nWriting: Master (all globally unique)...")
wbm = openpyxl.Workbook()
wsm = wbm.active
wsm.title = "All Contacts (Global)"
write_header(wsm, COLS_MASTER)

ri = 2
master_seen: set[str] = set()
for label, fp, fmt, _ in SOURCES:
    if "Master" in label: continue   # skip the B7 master (it's a superset)
    for row in all_by_label[label]:
        ne = row["norm"]
        if ne in master_seen: continue
        if global_seen.get(ne) != label: continue
        master_seen.add(ne)
        fill = FB if row["Typo Fixed"] else FG
        write_row(wsm, ri, [
            row["Name"], row["Corrected Email"], row["Corrected Email"],
            row["Typo Fixed"], label,
            row["Phone"], row["Title"], row["Company"], row["Source"],
        ], fill)
        wsm.row_dimensions[ri].height = 16
        ri += 1

master_total = ri - 2
print(f"  Master total unique contacts: {master_total:,}")

# Summary sheet in master
wsm2 = wbm.create_sheet("By Source")
wsm2.column_dimensions["A"].width = 28
wsm2.column_dimensions["B"].width = 16
wsm2.cell(1,1,"Source List").fill = FH; wsm2.cell(1,1).font = WB; wsm2.cell(1,1).border = THIN
wsm2.cell(1,2,"Unique Contacts").fill = FH; wsm2.cell(1,2).font = WB; wsm2.cell(1,2).border = THIN
source_counts = defaultdict(int)
for row in [wsm.cell(r,1).value for r in range(2, ri)]:
    pass
# recount properly
sc = defaultdict(int)
for ne, lbl in global_seen.items():
    if lbl != "B7 Master":
        sc[lbl] += 1
for ri2, (lbl, cnt) in enumerate(sorted(sc.items(), key=lambda x: -x[1]), 2):
    wsm2.cell(ri2,1,lbl).border = THIN
    wsm2.cell(ri2,2,cnt).border = THIN
    wsm2.row_dimensions[ri2].height = 16

total_ri = len(sc) + 2
wsm2.cell(total_ri,1,"TOTAL").font = BLD; wsm2.cell(total_ri,1).fill = FGR; wsm2.cell(total_ri,1).border = THIN
wsm2.cell(total_ri,2,sum(sc.values())).font = BLD; wsm2.cell(total_ri,2).fill = FGR; wsm2.cell(total_ri,2).border = THIN

wbm.save(f"{OUT}/00_MASTER_all_unique_contacts.xlsx")

print(f"""
{'='*60}
  EXPORT COMPLETE
{'='*60}
  Output folder: {OUT}/

  Files created:
    00_MASTER_all_unique_contacts.xlsx  ({master_total:,} unique contacts)
    01_linkedin_leads.xlsx
    02_educators.xlsx
    03_us_bookstores.xlsx
    04_cbs_marketwatch.xlsx
    05_leads.xlsx
    06_book_consumers_156k.xlsx
    07_batch7_segmented.xlsx
{'='*60}
""")
