"""
Segment Validator — validates all segment CSVs, deduplicates within/across segments,
compares against master CSV, outputs multi-sheet Excel with colour coding.
"""

import re
import csv
import sys
from datetime import datetime
from collections import defaultdict

import dns.resolver
from rapidfuzz import fuzz, process
import openpyxl
from openpyxl.styles import PatternFill, Font, Alignment, Border, Side
from openpyxl.utils import get_column_letter

# ── Constants (copied from email_validator.py) ────────────────────────────────

KNOWN_DOMAINS = [
    "gmail.com", "yahoo.com", "hotmail.com", "outlook.com", "icloud.com",
    "aol.com", "protonmail.com", "mail.com", "zoho.com", "yandex.com",
    "live.com", "msn.com", "me.com", "mac.com", "googlemail.com",
    "yahoo.co.uk", "yahoo.fr", "yahoo.de", "yahoo.it", "yahoo.es",
    "hotmail.co.uk", "hotmail.fr", "hotmail.de", "hotmail.it",
    "outlook.fr", "outlook.de", "outlook.co.uk",
    "comcast.net", "verizon.net", "att.net", "sbcglobal.net",
    "bellsouth.net", "cox.net", "charter.net", "earthlink.net",
]

DISPOSABLE_DOMAINS = {
    "mailinator.com", "guerrillamail.com", "tempmail.com", "10minutemail.com",
    "throwaway.email", "yopmail.com", "trashmail.com", "fakeinbox.com",
    "sharklasers.com", "guerrillamailblock.com", "grr.la", "guerrillamail.info",
    "guerrillamail.biz", "guerrillamail.de", "guerrillamail.net",
    "guerrillamail.org", "spam4.me", "dispostable.com", "spamgourmet.com",
    "mailnull.com", "spamhereplease.com", "mailnesia.com", "discard.email",
    "maildrop.cc", "spamfree24.org", "trashmail.me", "trashmail.net",
    "trashmail.at", "trashmail.io", "tempinbox.com", "mailexpire.com",
    "filzmail.com", "throwam.com", "spamgourmet.net", "spamgourmet.org",
    "spamevader.com", "mytemp.email", "tempmail.net", "getairmail.com",
    "mailsac.com", "spamex.com", "jetable.fr.nf", "nospam.ze.tc",
    "nomail.xl.cx", "mega.zik.dj", "speed.1s.fr", "courriel.fr.nf",
    "moncourrier.fr.nf", "monemail.fr.nf", "monmail.fr.nf",
}

ROLE_PREFIXES = {
    "admin", "administrator", "support", "info", "contact", "help",
    "sales", "marketing", "noreply", "no-reply", "donotreply",
    "billing", "accounts", "legal", "privacy", "security",
    "webmaster", "postmaster", "abuse", "hr", "careers", "jobs",
    "team", "office", "hello", "hi", "mail", "email", "enquiries",
    "enquiry", "inquiry", "inquiries", "service", "services",
    "newsletter", "news", "media", "pr", "press", "feedback",
    "general", "operations", "finance", "accounting",
}

TYPO_MAP = {
    "gmal.com": "gmail.com", "gmial.com": "gmail.com", "gamil.com": "gmail.com",
    "gmail.co": "gmail.com", "gnail.com": "gmail.com", "gmil.com": "gmail.com",
    "gmaill.com": "gmail.com", "gmai.com": "gmail.com", "gmaol.com": "gmail.com",
    "gmali.com": "gmail.com",
    "yaho.com": "yahoo.com", "yahooo.com": "yahoo.com", "yhoo.com": "yahoo.com",
    "yahoo.co": "yahoo.com", "yaoo.com": "yahoo.com", "yhaoo.com": "yahoo.com",
    "hotmal.com": "hotmail.com", "hotmial.com": "hotmail.com", "hotmai.com": "hotmail.com",
    "hotmail.co": "hotmail.com", "hotmaill.com": "hotmail.com",
    "outlok.com": "outlook.com", "outllok.com": "outlook.com", "outook.com": "outlook.com",
    "outlokk.com": "outlook.com", "otulook.com": "outlook.com",
    "icoud.com": "icloud.com", "iclod.com": "icloud.com", "iclould.com": "icloud.com",
    "aoll.com": "aol.com", "aol.co": "aol.com",
    "protonmal.com": "protonmail.com", "protonmial.com": "protonmail.com",
    "liive.com": "live.com", "liev.com": "live.com",
    "msnn.com": "msn.com",
}

SMTP_AVAILABLE = False

# ── Shared MX cache (across all segments) ─────────────────────────────────────
_mx_cache: dict[str, tuple[bool, str]] = {}

# ── Validators ─────────────────────────────────────────────────────────────────

RFC_RE = re.compile(
    r"^[a-zA-Z0-9.!#$%&'*+/=?^_`{|}~-]+"
    r"@[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?"
    r"(?:\.[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?)*"
    r"\.[a-zA-Z]{2,}$"
)

def check_syntax(email: str) -> tuple[bool, str]:
    if not email or email.strip() == "":
        return False, "Empty"
    email = email.strip()
    if RFC_RE.match(email):
        return True, "Valid"
    if "@" not in email:
        return False, "Missing @"
    local, _, domain = email.rpartition("@")
    if not local:
        return False, "Empty local part"
    if not domain or "." not in domain:
        return False, "Invalid domain"
    return False, "RFC format error"

def check_mx(domain: str) -> tuple[bool, str]:
    if domain in _mx_cache:
        return _mx_cache[domain]
    try:
        records = dns.resolver.resolve(domain, "MX", lifetime=5)
        result = (bool(records), f"{len(records)} MX record(s)")
    except dns.resolver.NXDOMAIN:
        result = (False, "Domain does not exist")
    except dns.resolver.NoAnswer:
        try:
            dns.resolver.resolve(domain, "A", lifetime=5)
            result = (True, "No MX but A record exists")
        except Exception:
            result = (False, "No MX or A record")
    except dns.exception.Timeout:
        result = (False, "DNS timeout")
    except Exception as e:
        result = (False, f"DNS error: {type(e).__name__}")
    _mx_cache[domain] = result
    return result

def check_disposable(domain: str) -> tuple[bool, str]:
    return (domain.lower() in DISPOSABLE_DOMAINS,
            "Disposable provider" if domain.lower() in DISPOSABLE_DOMAINS else "Not disposable")

def check_role(local: str) -> tuple[bool, str]:
    prefix = local.lower().split("+")[0].split(".")[0]
    is_role = prefix in ROLE_PREFIXES
    return is_role, (f"Role-based ({prefix})" if is_role else "Personal")

def check_catchall(domain: str, mx_ok: bool) -> tuple[bool, str]:
    if not SMTP_AVAILABLE:
        return False, "N/A (port 25 blocked)"
    return False, "N/A (no MX)"

def suggest_typo_fix(domain: str) -> str | None:
    dl = domain.lower()
    if dl in TYPO_MAP:
        return TYPO_MAP[dl]
    if len(dl) < 20:
        match, score, _ = process.extractOne(dl, KNOWN_DOMAINS, scorer=fuzz.ratio)
        if score >= 80 and match != dl:
            return match
    return None

def risk_score(syntax_ok, mx_ok, smtp_ok, is_disposable, is_role, is_catchall, typo_fix) -> tuple[str, int]:
    score = 0
    if not syntax_ok:
        score += 40
    if not mx_ok:
        score += 30
    if is_disposable:
        score += 20
    if typo_fix:
        score += 15
    if is_role:
        score += 5
    if is_catchall:
        score += 5
    if SMTP_AVAILABLE and not smtp_ok and mx_ok and not is_catchall:
        score += 10
    if score == 0:
        return "Low", score
    elif score <= 20:
        return "Low", score
    elif score <= 40:
        return "Medium", score
    else:
        return "High", score

# ── CSV Parsing ────────────────────────────────────────────────────────────────

def parse_segment_csv(filepath: str, segment_label: str, has_phone: bool = True) -> list[dict]:
    """Parse a segment CSV with 'Contact X' column naming."""
    rows = []
    with open(filepath, encoding="utf-8-sig", newline="") as f:
        reader = csv.DictReader(f)
        for raw_row in reader:
            try:
                # Normalize column names
                name    = (raw_row.get("Contact Name", "") or "").strip()
                email   = (raw_row.get("Contact Email", "") or "").strip()
                phone   = (raw_row.get("Contact Phone", "") or "").strip() if has_phone else ""
                title   = (raw_row.get("Contact Title", "") or "").strip()
                company = (raw_row.get("Contact Company", "") or "").strip()
                source  = (raw_row.get("Contact Source", "") or "").strip()
                if not email:
                    continue
                rows.append({
                    "Name":    name,
                    "Email":   email,
                    "Phone":   phone,
                    "Title":   title,
                    "Company": company,
                    "Source":  source,
                    "Segment": segment_label,
                })
            except Exception as ex:
                print(f"  [WARNING] Skipped malformed row in {filepath}: {ex}")
    return rows

# ── Validation ─────────────────────────────────────────────────────────────────

def validate_contact(row: dict, n: int, total: int) -> dict:
    """Run all validation checks on a single contact row. Returns enriched dict."""
    raw_email = row.get("Email", "").strip()
    name      = row.get("Name", "")
    segment   = row.get("Segment", "")

    print(f"  [{n}/{total}] [{segment}] {name[:25]:<25} — {raw_email[:40]}")
    sys.stdout.flush()

    # Syntax
    syntax_ok, syntax_note = check_syntax(raw_email)
    email_lc = raw_email.lower() if raw_email else ""

    # Parse local/domain
    local, domain = "", ""
    if "@" in email_lc:
        local, _, domain = email_lc.rpartition("@")

    # Typo
    typo_fix = suggest_typo_fix(domain) if domain else None
    corrected_email = f"{local}@{typo_fix}" if typo_fix else raw_email

    # MX (shared cache)
    effective_domain = typo_fix if typo_fix else domain
    mx_ok, mx_note   = check_mx(effective_domain) if effective_domain else (False, "No domain")

    # Disposable
    is_disposable, _ = check_disposable(effective_domain) if effective_domain else (False, "N/A")

    # Role-based
    is_role, _ = check_role(local) if local else (False, "N/A")

    # Catch-all
    is_catchall, _ = check_catchall(effective_domain, mx_ok) if effective_domain else (False, "N/A")

    # Risk
    risk_label, _ = risk_score(
        syntax_ok, mx_ok, False, is_disposable, is_role, is_catchall,
        typo_fix is not None
    )

    return {
        **row,
        "Raw Email":       raw_email,
        "Corrected Email": corrected_email if typo_fix else raw_email,
        "Typo Fixed":      f"{domain} -> {typo_fix}" if typo_fix else "",
        # Dedup fields filled in later
        "Is Duplicate":    "No",
        "Duplicate Type":  "No",
        "Duplicate Of":    "",
        "Syntax OK":       "Yes" if syntax_ok else "No",
        "Syntax Note":     syntax_note,
        "MX OK":           "Yes" if mx_ok else "No",
        "MX Note":         mx_note,
        "Disposable":      "Yes" if is_disposable else "No",
        "Role-based":      "Yes" if is_role else "No",
        "Catch-all":       "N/A",
        "Risk":            risk_label,
    }

# ── Deduplication ──────────────────────────────────────────────────────────────

def dedup_within_segment(validated_rows: list[dict]) -> list[dict]:
    """Mark duplicate emails within the same segment."""
    seen: dict[str, int] = {}  # corrected_email_lower -> row index
    for i, row in enumerate(validated_rows):
        key = row["Corrected Email"].lower().strip()
        if not key:
            continue
        if key in seen:
            validated_rows[i]["Is Duplicate"]   = "Yes"
            validated_rows[i]["Duplicate Type"] = "Within-Segment"
            validated_rows[i]["Duplicate Of"]   = f"Row {seen[key]+2}"
        else:
            seen[key] = i
    return validated_rows

def dedup_cross_segment(all_rows: list[dict], global_seen: dict[str, tuple[str, int]]) -> list[dict]:
    """
    Mark cross-segment duplicates.
    global_seen: email_lower -> (segment_label, index_in_global_list)
    Modifies rows in-place. Returns updated global_seen.
    """
    for i, row in enumerate(all_rows):
        if row["Is Duplicate"] == "Yes":
            # Already a within-segment dup; skip for cross-segment tracking
            continue
        key = row["Corrected Email"].lower().strip()
        if not key:
            continue
        if key in global_seen:
            orig_seg, orig_idx = global_seen[key]
            row["Is Duplicate"]   = "Yes"
            row["Duplicate Type"] = "Cross-Segment"
            row["Duplicate Of"]   = f"{orig_seg} row {orig_idx+2}"
            if row["Risk"] not in ("High", "Medium"):
                row["Risk"] = "Duplicate"
        else:
            global_seen[key] = (row["Segment"], i)
    return all_rows

# ── Excel Styles ───────────────────────────────────────────────────────────────

FILL_GREEN     = PatternFill("solid", fgColor="C6EFCE")
FILL_YELLOW    = PatternFill("solid", fgColor="FFEB9C")
FILL_RED       = PatternFill("solid", fgColor="FFC7CE")
FILL_BLUE      = PatternFill("solid", fgColor="BDD7EE")
FILL_GREY      = PatternFill("solid", fgColor="D9D9D9")
FILL_DARK_GREY = PatternFill("solid", fgColor="BFBFBF")
FILL_HEADER    = PatternFill("solid", fgColor="2E5090")
FILL_NOTE      = PatternFill("solid", fgColor="FFF2CC")

FONT_WHITE_BOLD = Font(color="FFFFFF", bold=True)
FONT_BOLD       = Font(bold=True)
FONT_ITALIC     = Font(italic=True, color="595959")

THIN_BORDER = Border(
    left=Side(style="thin"), right=Side(style="thin"),
    top=Side(style="thin"), bottom=Side(style="thin"),
)

# Column definitions: (header_label, width)
SEGMENT_COLUMNS = [
    ("Name",           28),
    ("Email",          38),
    ("Corrected Email",38),
    ("Typo Fixed",     22),
    ("Segment",        18),
    ("Is Duplicate",   13),
    ("Duplicate Type", 18),
    ("Duplicate Of",   20),
    ("Syntax OK",      11),
    ("Syntax Note",    22),
    ("MX OK",           9),
    ("MX Note",        22),
    ("Disposable",     12),
    ("Role-based",     12),
    ("Risk",           12),
    ("Phone",          22),
    ("Title",          30),
    ("Company",        30),
    ("Source",         45),
]

MASTER_COMP_COLUMNS = [
    ("Status",         20),
    ("Name",           28),
    ("Email",          38),
    ("Segment",        18),
    ("Company",        30),
    ("Title",          30),
    ("Source",         45),
]

# ── Sheet Writers ──────────────────────────────────────────────────────────────

def _write_sheet_header(ws, columns):
    """Write header row with dark blue fill."""
    headers = [c[0] for c in columns]
    widths  = {c[0]: c[1] for c in columns}
    ws.append(headers)
    for col_i, h in enumerate(headers, 1):
        cell = ws.cell(1, col_i)
        cell.fill      = FILL_HEADER
        cell.font      = FONT_WHITE_BOLD
        cell.alignment = Alignment(horizontal="center", vertical="center", wrap_text=True)
        cell.border    = THIN_BORDER
        ws.column_dimensions[get_column_letter(col_i)].width = widths.get(h, 15)
    ws.row_dimensions[1].height = 30
    ws.freeze_panes = "A2"

def _row_fill(row: dict) -> PatternFill:
    """Determine base fill colour for a data row."""
    if row.get("Is Duplicate") == "Yes":
        return FILL_GREY
    risk = row.get("Risk", "Low")
    if risk == "High":
        return FILL_RED
    if risk == "Medium":
        return FILL_YELLOW
    return FILL_GREEN

def _write_data_rows(ws, rows: list[dict], columns, start_row: int = 2):
    for r_i, row in enumerate(rows, start_row):
        base_fill = _row_fill(row)
        for col_i, (col_name, _) in enumerate(columns, 1):
            val = row.get(col_name, "")
            cell = ws.cell(r_i, col_i, value=val)
            cell.alignment = Alignment(vertical="center", wrap_text=False)
            cell.border    = THIN_BORDER
            cell.fill      = base_fill

            # Column-specific overrides
            if col_name == "Typo Fixed" and val:
                cell.fill = FILL_BLUE
                cell.font = FONT_BOLD
            elif col_name == "Risk":
                risk_map = {
                    "High":      (FILL_RED,    FONT_BOLD),
                    "Medium":    (FILL_YELLOW, FONT_BOLD),
                    "Low":       (FILL_GREEN,  FONT_BOLD),
                    "Duplicate": (FILL_GREY,   FONT_BOLD),
                }
                if val in risk_map:
                    cell.fill, cell.font = risk_map[val]
                cell.alignment = Alignment(horizontal="center", vertical="center")
            elif col_name in ("Syntax OK", "MX OK"):
                if val == "Yes":
                    cell.fill = FILL_GREEN
                elif val == "No":
                    cell.fill = FILL_RED
                cell.alignment = Alignment(horizontal="center", vertical="center")
            elif col_name == "Is Duplicate" and val == "Yes":
                cell.fill = FILL_GREY
                cell.font = FONT_BOLD
                cell.alignment = Alignment(horizontal="center", vertical="center")
            elif col_name == "Duplicate Type" and val != "No":
                cell.fill = FILL_GREY
                cell.alignment = Alignment(horizontal="center", vertical="center")

        ws.row_dimensions[r_i].height = 18

def write_segment_sheet(ws, rows: list[dict], columns=None):
    """Write a full validated segment sheet."""
    if columns is None:
        columns = SEGMENT_COLUMNS
    _write_sheet_header(ws, columns)
    _write_data_rows(ws, rows, columns)

def write_empty_sheet(ws, note: str):
    """Write an empty sheet with a note."""
    ws.column_dimensions["A"].width = 60
    cell = ws.cell(1, 1, value=note)
    cell.fill      = FILL_NOTE
    cell.font      = Font(italic=True, bold=True, color="7B5E00")
    cell.alignment = Alignment(horizontal="center", vertical="center", wrap_text=True)
    ws.row_dimensions[1].height = 40

def write_master_comparison(ws, in_master_only: list[dict], in_segments_only: list[dict]):
    """Write master comparison sheet with two sections."""
    columns = MASTER_COMP_COLUMNS
    _write_sheet_header(ws, columns)

    # Section header: In Master Only
    row_offset = 2
    if in_master_only:
        section_cell = ws.cell(row_offset, 1, value=f"--- IN MASTER ONLY ({len(in_master_only)} contacts) ---")
        section_cell.fill      = PatternFill("solid", fgColor="D9E1F2")
        section_cell.font      = Font(bold=True, color="1F3864")
        section_cell.alignment = Alignment(horizontal="center", vertical="center")
        ws.merge_cells(start_row=row_offset, start_column=1,
                       end_row=row_offset, end_column=len(columns))
        ws.row_dimensions[row_offset].height = 22
        row_offset += 1
        _write_data_rows(ws, in_master_only, columns, start_row=row_offset)
        row_offset += len(in_master_only)

    # Gap row
    row_offset += 1

    # Section header: In Segments Only
    if in_segments_only:
        section_cell2 = ws.cell(row_offset, 1, value=f"--- IN SEGMENTS ONLY ({len(in_segments_only)} contacts) ---")
        section_cell2.fill      = PatternFill("solid", fgColor="E2EFDA")
        section_cell2.font      = Font(bold=True, color="1E4620")
        section_cell2.alignment = Alignment(horizontal="center", vertical="center")
        ws.merge_cells(start_row=row_offset, start_column=1,
                       end_row=row_offset, end_column=len(columns))
        ws.row_dimensions[row_offset].height = 22
        row_offset += 1
        _write_data_rows(ws, in_segments_only, columns, start_row=row_offset)

def write_summary_sheet(ws, segment_stats: list[dict], global_stats: dict):
    """Write the summary sheet."""
    ws.column_dimensions["A"].width = 35
    ws.column_dimensions["B"].width = 16
    ws.column_dimensions["C"].width = 16
    ws.column_dimensions["D"].width = 16
    ws.column_dimensions["E"].width = 16
    ws.column_dimensions["F"].width = 16
    ws.column_dimensions["G"].width = 16

    # Title
    title_cell = ws.cell(1, 1, value="SEGMENT VALIDATION SUMMARY")
    title_cell.font      = Font(bold=True, size=14, color="2E5090")
    title_cell.alignment = Alignment(horizontal="left", vertical="center")
    ws.row_dimensions[1].height = 28

    gen_cell = ws.cell(2, 1, value=f"Generated: {datetime.now().strftime('%Y-%m-%d %H:%M')}")
    gen_cell.font = Font(italic=True, color="595959")

    # Per-segment table header at row 4
    header_row = 4
    seg_headers = ["Segment", "Total", "Within-Seg Dupes", "Cross-Seg Dupes",
                   "Typos Fixed", "Medium Risk", "High Risk", "Unique (no dup)"]
    for col_i, h in enumerate(seg_headers, 1):
        cell = ws.cell(header_row, col_i, h)
        cell.fill      = FILL_HEADER
        cell.font      = FONT_WHITE_BOLD
        cell.alignment = Alignment(horizontal="center", vertical="center", wrap_text=True)
        cell.border    = THIN_BORDER
        ws.column_dimensions[get_column_letter(col_i)].width = [35,10,18,18,14,14,12,18][col_i-1]
    ws.row_dimensions[header_row].height = 30

    # Per-segment rows
    row_i = header_row + 1
    for stat in segment_stats:
        vals = [
            stat["segment"],
            stat["total"],
            stat["within_dupes"],
            stat["cross_dupes"],
            stat["typos"],
            stat["medium"],
            stat["high"],
            stat["unique"],
        ]
        for col_i, val in enumerate(vals, 1):
            cell = ws.cell(row_i, col_i, val)
            cell.border    = THIN_BORDER
            cell.alignment = Alignment(horizontal="center" if col_i > 1 else "left",
                                       vertical="center")
            if col_i == 1:
                cell.font = Font(bold=True)
        ws.row_dimensions[row_i].height = 18
        row_i += 1

    # Totals row
    totals_vals = [
        "TOTAL",
        sum(s["total"]        for s in segment_stats),
        sum(s["within_dupes"] for s in segment_stats),
        sum(s["cross_dupes"]  for s in segment_stats),
        sum(s["typos"]        for s in segment_stats),
        sum(s["medium"]       for s in segment_stats),
        sum(s["high"]         for s in segment_stats),
        sum(s["unique"]       for s in segment_stats),
    ]
    for col_i, val in enumerate(totals_vals, 1):
        cell = ws.cell(row_i, col_i, val)
        cell.fill      = PatternFill("solid", fgColor="D9E1F2")
        cell.font      = FONT_BOLD
        cell.border    = THIN_BORDER
        cell.alignment = Alignment(horizontal="center" if col_i > 1 else "left",
                                   vertical="center")
    ws.row_dimensions[row_i].height = 22
    row_i += 2

    # Global summary
    global_header = ws.cell(row_i, 1, "GLOBAL SUMMARY")
    global_header.font = Font(bold=True, size=12, color="2E5090")
    row_i += 1

    global_stats_rows = [
        ("Total contacts (all segments)",  global_stats["total"]),
        ("Unique contacts (deduped)",       global_stats["unique"]),
        ("Within-segment duplicates",       global_stats["within_dupes"]),
        ("Cross-segment duplicates",        global_stats["cross_dupes"]),
        ("Typos corrected",                 global_stats["typos"]),
        ("Medium risk",                     global_stats["medium"]),
        ("High risk",                       global_stats["high"]),
        ("In Master Only",                  global_stats["master_only"]),
        ("In Segments Only",                global_stats["segments_only"]),
        ("Matched (in both)",               global_stats["matched"]),
    ]
    fill_map = {"Medium risk": FILL_YELLOW, "High risk": FILL_RED,
                "Unique contacts (deduped)": FILL_GREEN}
    for label, count in global_stats_rows:
        cell_a = ws.cell(row_i, 1, label)
        cell_b = ws.cell(row_i, 2, count)
        fill   = fill_map.get(label, None)
        for cell in (cell_a, cell_b):
            cell.border    = THIN_BORDER
            cell.alignment = Alignment(vertical="center")
            if fill:
                cell.fill = fill
        cell_b.alignment = Alignment(horizontal="center", vertical="center")
        ws.row_dimensions[row_i].height = 18
        row_i += 1

    # Missing segments note
    row_i += 1
    ws.cell(row_i, 1, "MISSING SOURCE SHEETS:").font = Font(bold=True, color="CC0000")
    row_i += 1
    for missing in ["Christians AU (no data provided)", "Random AU (no data provided)"]:
        cell = ws.cell(row_i, 1, f"  - {missing}")
        cell.font = Font(italic=True, color="CC0000")
        ws.row_dimensions[row_i].height = 18
        row_i += 1

# ── Main ───────────────────────────────────────────────────────────────────────

BASE_DIR = "/home/user/alx-pre_course/batch7"
OUT_PATH = f"{BASE_DIR}/contacts_segmented_validated.xlsx"

# Segment file definitions: (filename, sheet_label, has_phone)
SEGMENT_FILES = [
    ("christian_us.csv",     "Christians US",    True),
    ("christian_uk.csv",     "Christians UK",    True),
    ("non_christian_us.csv", "Non-Christian US", True),
    ("non_christian_uk.csv", "Non-Christian UK", True),
    ("non_christian_au.csv", "Non-Christian AU", True),
    ("random_uk.csv",        "Random UK",        True),
    ("random_us.csv",        "Random US",        True),
    ("agencies.csv",         "Agencies",         True),
    ("bookstores.csv",       "Bookstores",       False),
]

def compute_segment_stats(rows: list[dict], segment_label: str) -> dict:
    return {
        "segment":      segment_label,
        "total":        len(rows),
        "within_dupes": sum(1 for r in rows if r["Duplicate Type"] == "Within-Segment"),
        "cross_dupes":  sum(1 for r in rows if r["Duplicate Type"] == "Cross-Segment"),
        "typos":        sum(1 for r in rows if r["Typo Fixed"]),
        "medium":       sum(1 for r in rows if r["Risk"] == "Medium"),
        "high":         sum(1 for r in rows if r["Risk"] == "High"),
        "unique":       sum(1 for r in rows if r["Is Duplicate"] == "No"),
    }

def main():
    print("=" * 70)
    print("  SEGMENT VALIDATOR — starting")
    print("=" * 70)

    # ── Step 1: Parse all CSVs ─────────────────────────────────────────────────
    print("\n[STEP 1] Parsing segment CSVs...")
    raw_by_segment: dict[str, list[dict]] = {}
    for filename, label, has_phone in SEGMENT_FILES:
        path = f"{BASE_DIR}/{filename}"
        rows = parse_segment_csv(path, label, has_phone)
        raw_by_segment[label] = rows
        print(f"  Loaded {len(rows):>5} rows  <- {filename}")

    # ── Step 2: Validate every contact ────────────────────────────────────────
    print("\n[STEP 2] Validating contacts (MX lookup with shared cache)...")
    validated_by_segment: dict[str, list[dict]] = {}
    for label, rows in raw_by_segment.items():
        print(f"\n  === {label} ({len(rows)} contacts) ===")
        validated = []
        total = len(rows)
        for n, row in enumerate(rows, 1):
            try:
                result = validate_contact(row, n, total)
                validated.append(result)
            except Exception as ex:
                print(f"  [ERROR] Row {n} in {label}: {ex}")
        validated_by_segment[label] = validated

    # ── Step 3: Deduplication ──────────────────────────────────────────────────
    print("\n[STEP 3] Deduplicating...")

    # Within-segment dedup
    for label, rows in validated_by_segment.items():
        dedup_within_segment(rows)
        within_dupes = sum(1 for r in rows if r["Duplicate Type"] == "Within-Segment")
        print(f"  {label}: {within_dupes} within-segment duplicates")

    # Cross-segment dedup — process in a defined order
    # Build ordered flat list for cross-segment dedup
    cross_order = [
        "Christians US", "Christians UK",
        "Non-Christian US", "Non-Christian UK", "Non-Christian AU",
        "Random US", "Random UK",
        "Agencies", "Bookstores",
    ]
    global_seen: dict[str, tuple[str, int]] = {}
    for label in cross_order:
        rows = validated_by_segment.get(label, [])
        dedup_cross_segment(rows, global_seen)
        cross_dupes = sum(1 for r in rows if r["Duplicate Type"] == "Cross-Segment")
        print(f"  {label}: {cross_dupes} cross-segment duplicates")

    # ── Build combined group sheets ────────────────────────────────────────────
    all_christians = (
        validated_by_segment.get("Christians US", []) +
        validated_by_segment.get("Christians UK", [])
    )
    all_non_christian = (
        validated_by_segment.get("Non-Christian US", []) +
        validated_by_segment.get("Non-Christian UK", []) +
        validated_by_segment.get("Non-Christian AU", [])
    )
    all_random = (
        validated_by_segment.get("Random US", []) +
        validated_by_segment.get("Random UK", [])
    )

    # All contacts combined
    all_contacts: list[dict] = []
    for label in cross_order:
        all_contacts.extend(validated_by_segment.get(label, []))

    # ── Step 4: Master comparison ──────────────────────────────────────────────
    print("\n[STEP 4] Parsing master CSV and comparing...")
    master_rows = parse_segment_csv(
        f"{BASE_DIR}/all_contacts_master.csv", "Master", has_phone=True
    )
    print(f"  Loaded {len(master_rows)} master contacts")

    # Build sets of corrected emails
    def get_corrected(row: dict) -> str:
        raw = row.get("Email", "").strip().lower()
        if "@" not in raw:
            return raw
        local, _, domain = raw.rpartition("@")
        typo = suggest_typo_fix(domain)
        return f"{local}@{typo}" if typo else raw

    segment_emails: dict[str, dict] = {}  # corrected_email -> first segment row
    for row in all_contacts:
        key = row.get("Corrected Email", row.get("Email", "")).lower().strip()
        if key and key not in segment_emails:
            segment_emails[key] = row

    master_emails: dict[str, dict] = {}
    for row in master_rows:
        key = get_corrected(row)
        if key and key not in master_emails:
            master_emails[key] = row

    in_master_only_keys  = set(master_emails.keys()) - set(segment_emails.keys())
    in_segments_only_keys = set(segment_emails.keys()) - set(master_emails.keys())
    matched_count = len(set(master_emails.keys()) & set(segment_emails.keys()))

    in_master_only_rows = []
    for key in sorted(in_master_only_keys):
        r = master_emails[key]
        in_master_only_rows.append({
            "Status":  "In Master Only",
            "Name":    r.get("Name", ""),
            "Email":   r.get("Email", ""),
            "Segment": "Master",
            "Company": r.get("Company", ""),
            "Title":   r.get("Title", ""),
            "Source":  r.get("Source", ""),
        })

    in_segments_only_rows = []
    for key in sorted(in_segments_only_keys):
        r = segment_emails[key]
        in_segments_only_rows.append({
            "Status":  "In Segments Only",
            "Name":    r.get("Name", ""),
            "Email":   r.get("Email", ""),
            "Segment": r.get("Segment", ""),
            "Company": r.get("Company", ""),
            "Title":   r.get("Title", ""),
            "Source":  r.get("Source", ""),
        })

    print(f"  In Master Only:   {len(in_master_only_rows)}")
    print(f"  In Segments Only: {len(in_segments_only_rows)}")
    print(f"  Matched:          {matched_count}")

    # ── Step 5: Build statistics ───────────────────────────────────────────────
    segment_stats_list = []
    for label in cross_order:
        rows = validated_by_segment.get(label, [])
        if rows:
            segment_stats_list.append(compute_segment_stats(rows, label))

    global_stats = {
        "total":         len(all_contacts),
        "unique":        sum(1 for r in all_contacts if r["Is Duplicate"] == "No"),
        "within_dupes":  sum(1 for r in all_contacts if r["Duplicate Type"] == "Within-Segment"),
        "cross_dupes":   sum(1 for r in all_contacts if r["Duplicate Type"] == "Cross-Segment"),
        "typos":         sum(1 for r in all_contacts if r["Typo Fixed"]),
        "medium":        sum(1 for r in all_contacts if r["Risk"] == "Medium"),
        "high":          sum(1 for r in all_contacts if r["Risk"] == "High"),
        "master_only":   len(in_master_only_rows),
        "segments_only": len(in_segments_only_rows),
        "matched":       matched_count,
    }

    # ── Step 5: Write Excel ────────────────────────────────────────────────────
    print("\n[STEP 5] Writing Excel output...")
    wb = openpyxl.Workbook()

    def make_sheet(title: str, remove_default=False) -> openpyxl.worksheet.worksheet.Worksheet:
        if remove_default and "Sheet" in wb.sheetnames:
            ws = wb.active
            ws.title = title
            return ws
        return wb.create_sheet(title)

    # 1. Christians US
    print("  Writing: Christians US")
    ws1 = make_sheet("Christians US", remove_default=True)
    write_segment_sheet(ws1, validated_by_segment.get("Christians US", []))

    # 2. Christians UK
    print("  Writing: Christians UK")
    ws2 = make_sheet("Christians UK")
    write_segment_sheet(ws2, validated_by_segment.get("Christians UK", []))

    # 3. Christians AU (empty)
    print("  Writing: Christians AU (empty)")
    ws3 = make_sheet("Christians AU")
    write_empty_sheet(ws3, "No data provided — missing from source sheets")

    # 4. All Christians
    print("  Writing: All Christians")
    ws4 = make_sheet("All Christians")
    write_segment_sheet(ws4, all_christians)

    # 5. Non-Christian US
    print("  Writing: Non-Christian US")
    ws5 = make_sheet("Non-Christian US")
    write_segment_sheet(ws5, validated_by_segment.get("Non-Christian US", []))

    # 6. Non-Christian UK
    print("  Writing: Non-Christian UK")
    ws6 = make_sheet("Non-Christian UK")
    write_segment_sheet(ws6, validated_by_segment.get("Non-Christian UK", []))

    # 7. Non-Christian AU
    print("  Writing: Non-Christian AU")
    ws7 = make_sheet("Non-Christian AU")
    write_segment_sheet(ws7, validated_by_segment.get("Non-Christian AU", []))

    # 8. All Non-Christian
    print("  Writing: All Non-Christian")
    ws8 = make_sheet("All Non-Christian")
    write_segment_sheet(ws8, all_non_christian)

    # 9. Random US
    print("  Writing: Random US")
    ws9 = make_sheet("Random US")
    write_segment_sheet(ws9, validated_by_segment.get("Random US", []))

    # 10. Random UK
    print("  Writing: Random UK")
    ws10 = make_sheet("Random UK")
    write_segment_sheet(ws10, validated_by_segment.get("Random UK", []))

    # 11. Random AU (empty)
    print("  Writing: Random AU (empty)")
    ws11 = make_sheet("Random AU")
    write_empty_sheet(ws11, "No data provided — missing from source sheets")

    # 12. All Random
    print("  Writing: All Random")
    ws12 = make_sheet("All Random")
    write_segment_sheet(ws12, all_random)

    # 13. Agencies
    print("  Writing: Agencies")
    ws13 = make_sheet("Agencies")
    write_segment_sheet(ws13, validated_by_segment.get("Agencies", []))

    # 14. Bookstores
    print("  Writing: Bookstores")
    ws14 = make_sheet("Bookstores")
    write_segment_sheet(ws14, validated_by_segment.get("Bookstores", []))

    # 15. All Contacts
    print("  Writing: All Contacts")
    ws15 = make_sheet("All Contacts")
    write_segment_sheet(ws15, all_contacts)

    # 16. Master Comparison
    print("  Writing: Master Comparison")
    ws16 = make_sheet("Master Comparison")
    write_master_comparison(ws16, in_master_only_rows, in_segments_only_rows)

    # 17. Summary
    print("  Writing: Summary")
    ws17 = make_sheet("Summary")
    write_summary_sheet(ws17, segment_stats_list, global_stats)

    print(f"\n  Saving to: {OUT_PATH}")
    wb.save(OUT_PATH)
    print(f"  Saved successfully.")

    # ── Final stdout summary ───────────────────────────────────────────────────
    print(f"""
{'='*70}
  VALIDATION COMPLETE
{'='*70}
  Total contacts (all segments) : {global_stats['total']:>7}
  Unique contacts (deduped)     : {global_stats['unique']:>7}
  Within-segment duplicates     : {global_stats['within_dupes']:>7}
  Cross-segment duplicates      : {global_stats['cross_dupes']:>7}
  Typos corrected               : {global_stats['typos']:>7}
  Medium risk                   : {global_stats['medium']:>7}
  High risk                     : {global_stats['high']:>7}
  ---
  In Master Only                : {global_stats['master_only']:>7}
  In Segments Only              : {global_stats['segments_only']:>7}
  Matched (both)                : {global_stats['matched']:>7}
  ---
  Missing source sheets:
    - Christians AU  (no data provided)
    - Random AU      (no data provided)
{'='*70}

  Per-segment breakdown:
  {'Segment':<22} {'Total':>7}  {'W-Dup':>6}  {'X-Dup':>6}  {'Typos':>6}  {'Med':>6}  {'High':>6}  {'Unique':>7}""")

    for s in segment_stats_list:
        print(f"  {s['segment']:<22} {s['total']:>7}  {s['within_dupes']:>6}  "
              f"{s['cross_dupes']:>6}  {s['typos']:>6}  {s['medium']:>6}  "
              f"{s['high']:>6}  {s['unique']:>7}")

    print(f"\n  Output: {OUT_PATH}")
    print('='*70)

if __name__ == "__main__":
    main()
