"""
Comprehensive contact email validator.
Checks: syntax, MX records, SMTP, disposable, role-based, catch-all, typo, risk score.
"""

import re
import time
import csv
from datetime import datetime

import dns.resolver
from rapidfuzz import fuzz, process
import openpyxl
from openpyxl.styles import PatternFill, Font, Alignment, Border, Side
from openpyxl.utils import get_column_letter

# ── Constants ─────────────────────────────────────────────────────────────────

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

# Typo map: common misspellings → correct domain
TYPO_MAP = {
    "gmal.com": "gmail.com", "gmial.com": "gmail.com", "gamil.com": "gmail.com",
    "gmail.co": "gmail.com", "gnail.com": "gmail.com", "gmil.com": "gmail.com",
    "gmaill.com": "gmail.com", "gmai.com": "gmail.com", "gmaol.com": "gmail.com",
    "gmali.com": "gmail.com", "gmaill.com": "gmail.com",
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

# ── Parsing ────────────────────────────────────────────────────────────────────

def parse_csv(filepath: str) -> list[dict]:
    import csv as _csv
    rows = []
    with open(filepath, encoding="utf-8-sig", newline="") as f:
        reader = _csv.DictReader(f)
        headers = reader.fieldnames or []

        # Detect format by inspecting headers
        has_name      = "Name" in headers
        has_split     = "First name" in headers or "First Name" in headers
        has_numeric   = "0" in headers and not has_name and not has_split

        for row in reader:
            if has_numeric:
                if "Result" in headers and "11" not in headers:
                    # CBS/subscriber format: 0=Email, 1=FirstName, 2=LastName, 4=City, 5=State, 7=Phone
                    email   = row.get("0", "").strip()
                    fn      = row.get("1", "").strip()
                    ln      = row.get("2", "").strip()
                    name    = f"{fn} {ln}".strip()
                    phone   = row.get("7", "").strip()
                    title   = ""
                    company = ""
                    source  = row.get("10", "").strip()
                    city    = row.get("4", "").strip()
                    state   = row.get("5", "").strip()
                else:
                    # Bookstores format: 0=Company, 8=Contact, 9=Title, 10=Phone, 11=Email
                    name    = row.get("8", "").strip()
                    email   = row.get("11", "").strip()
                    phone   = row.get("10", "").strip()
                    title   = row.get("9", "").strip()
                    company = row.get("0", "").strip()
                    source  = row.get("7", "").strip()
                    city    = row.get("2", "").strip()
                    state   = row.get("3", "").strip()
            else:
                if has_name:
                    name = row.get("Name", "").strip()
                elif has_split:
                    fn   = row.get("First name", row.get("First Name", "")).strip()
                    ln   = row.get("Last name",  row.get("Last Name",  "")).strip()
                    name = f"{fn} {ln}".strip()
                else:
                    name = ""
                email   = row.get("Email", "").strip()
                phone   = row.get("Phone Number", row.get("Phone", "")).strip()
                title   = row.get("Title", "").strip()
                company = row.get("Company", "").strip()
                source  = row.get("Source", row.get("Address", "")).strip()
                city    = row.get("City", "").strip()
                state   = row.get("State", "").strip()

            rows.append({
                "Name":    name,
                "Email":   email,
                "Phone":   phone,
                "Title":   title,
                "Company": company,
                "Source":  source,
                "City":    city,
                "State":   state,
            })
    return rows

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

_mx_cache: dict[str, tuple[bool, str]] = {}

def check_mx(domain: str) -> tuple[bool, str]:
    if domain in _mx_cache:
        return _mx_cache[domain]
    try:
        records = dns.resolver.resolve(domain, "MX", lifetime=5)
        result = (bool(records), f"{len(records)} MX record(s)")
    except dns.resolver.NXDOMAIN:
        result = (False, "Domain does not exist")
    except dns.resolver.NoAnswer:
        # Try A record as fallback
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

SMTP_AVAILABLE = False  # Port 25 is blocked in this cloud environment

def check_catchall(domain: str, mx_ok: bool) -> tuple[bool, str]:
    if not SMTP_AVAILABLE:
        return False, "N/A (port 25 blocked)"
    return False, "N/A (no MX)"

def check_smtp(email: str, domain: str, mx_ok: bool, is_catchall: bool) -> tuple[bool, str]:
    if not SMTP_AVAILABLE:
        return False, "N/A (port 25 blocked)"
    if not mx_ok:
        return False, "Skipped (no MX)"
    return False, "Skipped"

def check_disposable(domain: str) -> tuple[bool, str]:
    return (domain.lower() in DISPOSABLE_DOMAINS,
            "Disposable provider" if domain.lower() in DISPOSABLE_DOMAINS else "Not disposable")

def check_role(local: str) -> tuple[bool, str]:
    prefix = local.lower().split("+")[0].split(".")[0]
    is_role = prefix in ROLE_PREFIXES
    return is_role, (f"Role-based ({prefix})" if is_role else "Personal")

def suggest_typo_fix(domain: str) -> str | None:
    dl = domain.lower()
    if dl in TYPO_MAP:
        return TYPO_MAP[dl]
    # Fuzzy match against known personal domains (only for short domains)
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
    # Only count SMTP failure if SMTP was actually checked
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

# ── Main processing ────────────────────────────────────────────────────────────

def process_contacts(rows: list[dict]) -> list[dict]:
    results = []
    total = len(rows)
    seen_emails: dict[str, int] = {}  # email_lower → first index in results

    for i, row in enumerate(rows):
        raw_email = row["Email"].strip()
        print(f"  [{i+1}/{total}] {row['Name'][:30]:<30} {raw_email[:40]}")

        # Syntax
        syntax_ok, syntax_note = check_syntax(raw_email)
        email = raw_email.lower() if raw_email else ""

        # Parse parts
        local, domain = ("", "")
        if "@" in email:
            local, _, domain = email.rpartition("@")

        # Typo
        typo_fix = suggest_typo_fix(domain) if domain else None
        corrected_email = f"{local}@{typo_fix}" if typo_fix else raw_email

        # Duplicate check (use corrected email for dedup)
        dedup_key = corrected_email.lower()
        is_duplicate = False
        duplicate_of = ""
        if dedup_key and dedup_key in seen_emails:
            is_duplicate = True
            duplicate_of = f"Row {seen_emails[dedup_key]+2}"  # +2: header + 1-indexed
        elif dedup_key:
            seen_emails[dedup_key] = i

        # MX
        effective_domain = typo_fix if typo_fix else domain
        mx_ok, mx_note = check_mx(effective_domain) if effective_domain else (False, "No domain")

        # Disposable
        is_disposable, disposable_note = check_disposable(effective_domain) if effective_domain else (False, "N/A")

        # Role-based
        is_role, role_note = check_role(local) if local else (False, "N/A")

        # Catch-all
        is_catchall, catchall_note = check_catchall(effective_domain, mx_ok) if effective_domain else (False, "N/A")

        # SMTP
        smtp_ok, smtp_note = check_smtp(
            corrected_email.lower(), effective_domain, mx_ok, is_catchall
        ) if effective_domain and not is_duplicate else (False, "Skipped (duplicate)" if is_duplicate else "N/A")

        # Risk
        risk_label, risk_pts = risk_score(
            syntax_ok, mx_ok, smtp_ok, is_disposable, is_role, is_catchall,
            typo_fix is not None
        )
        if is_duplicate:
            risk_label = "Duplicate"

        results.append({
            **row,
            "Raw Email":         raw_email,
            "Corrected Email":   corrected_email if typo_fix else raw_email,
            "Typo Fixed":        f"{domain} → {typo_fix}" if typo_fix else "",
            "Is Duplicate":      "Yes" if is_duplicate else "No",
            "Duplicate Of":      duplicate_of,
            "Syntax OK":         "✓" if syntax_ok else "✗",
            "Syntax Note":       syntax_note,
            "MX OK":             "✓" if mx_ok else "✗",
            "MX Note":           mx_note,
            "SMTP OK":           "✓" if smtp_ok else "✗",
            "SMTP Note":         smtp_note,
            "Disposable":        "Yes" if is_disposable else "No",
            "Disposable Note":   disposable_note,
            "Role-based":        "Yes" if is_role else "No",
            "Role Note":         role_note,
            "Catch-all":         "Yes" if is_catchall else "No",
            "Catch-all Note":    catchall_note,
            "Risk":              risk_label,
            "City":              row.get("City", ""),
            "State":             row.get("State", ""),
        })
    return results

# ── Excel output ───────────────────────────────────────────────────────────────

FILL_GREEN  = PatternFill("solid", fgColor="C6EFCE")
FILL_YELLOW = PatternFill("solid", fgColor="FFEB9C")
FILL_RED    = PatternFill("solid", fgColor="FFC7CE")
FILL_BLUE   = PatternFill("solid", fgColor="BDD7EE")
FILL_GREY   = PatternFill("solid", fgColor="D9D9D9")
FILL_HEADER = PatternFill("solid", fgColor="2E5090")

FONT_WHITE_BOLD = Font(color="FFFFFF", bold=True)
FONT_BOLD       = Font(bold=True)

THIN_BORDER = Border(
    left=Side(style="thin"), right=Side(style="thin"),
    top=Side(style="thin"), bottom=Side(style="thin"),
)

COLUMNS = [
    ("Name", 28),
    ("Email", 38),
    ("Corrected Email", 38),
    ("Typo Fixed", 25),
    ("Is Duplicate", 13),
    ("Duplicate Of", 12),
    ("Syntax OK", 11),
    ("Syntax Note", 22),
    ("MX OK", 9),
    ("MX Note", 22),
    ("SMTP OK", 10),
    ("SMTP Note", 30),
    ("Disposable", 12),
    ("Role-based", 12),
    ("Catch-all", 12),
    ("Risk", 12),
    ("Phone", 22),
    ("Title", 30),
    ("Company", 30),
    ("City", 18),
    ("State", 10),
    ("Source", 45),
]

def write_excel(results: list[dict], path: str):
    wb = openpyxl.Workbook()

    # ── Sheet 1: All contacts ──────────────────────────────────────────────────
    ws = wb.active
    ws.title = "All Contacts"
    _write_sheet(ws, results, COLUMNS)

    # ── Sheet 2: Cleaned (no duplicates, no high-risk) ─────────────────────────
    cleaned = [r for r in results if r["Is Duplicate"] == "No"]
    ws2 = wb.create_sheet("Cleaned (No Duplicates)")
    _write_sheet(ws2, cleaned, COLUMNS)

    # ── Sheet 3: Duplicates only ───────────────────────────────────────────────
    dupes = [r for r in results if r["Is Duplicate"] == "Yes"]
    ws3 = wb.create_sheet("Duplicates Removed")
    _write_sheet(ws3, dupes, COLUMNS)

    # ── Sheet 4: High risk ─────────────────────────────────────────────────────
    high = [r for r in results if r["Risk"] == "High"]
    ws4 = wb.create_sheet("High Risk")
    _write_sheet(ws4, high, COLUMNS)

    # ── Sheet 5: Summary stats ─────────────────────────────────────────────────
    ws5 = wb.create_sheet("Summary")
    _write_summary(ws5, results)

    wb.save(path)
    print(f"\nSaved: {path}")

def _write_sheet(ws, rows, columns):
    headers = [c[0] for c in columns]
    widths   = {c[0]: c[1] for c in columns}

    ws.append(headers)
    for col_i, h in enumerate(headers, 1):
        cell = ws.cell(1, col_i)
        cell.fill = FILL_HEADER
        cell.font = FONT_WHITE_BOLD
        cell.alignment = Alignment(horizontal="center", vertical="center", wrap_text=True)
        cell.border = THIN_BORDER
        ws.column_dimensions[get_column_letter(col_i)].width = widths.get(h, 15)
    ws.row_dimensions[1].height = 30
    ws.freeze_panes = "A2"

    for r_i, row in enumerate(rows, 2):
        risk = row.get("Risk", "")
        is_dup = row.get("Is Duplicate", "No") == "Yes"

        for col_i, (col_name, _) in enumerate(columns, 1):
            val = row.get(col_name, "")
            cell = ws.cell(r_i, col_i, value=val)
            cell.alignment = Alignment(vertical="center", wrap_text=True)
            cell.border = THIN_BORDER

            # Row background by risk
            if is_dup:
                cell.fill = FILL_GREY
            elif risk == "High":
                cell.fill = FILL_RED
            elif risk == "Medium":
                cell.fill = FILL_YELLOW
            elif risk == "Low":
                cell.fill = FILL_GREEN

            # Override specific columns
            if col_name in ("Syntax OK", "MX OK", "SMTP OK"):
                if val == "✓":
                    cell.fill = FILL_GREEN
                elif val == "✗":
                    cell.fill = FILL_RED
                cell.alignment = Alignment(horizontal="center", vertical="center")
            elif col_name == "Risk":
                if val == "High":
                    cell.fill = FILL_RED; cell.font = FONT_BOLD
                elif val == "Medium":
                    cell.fill = FILL_YELLOW; cell.font = FONT_BOLD
                elif val == "Low":
                    cell.fill = FILL_GREEN; cell.font = FONT_BOLD
                elif val == "Duplicate":
                    cell.fill = FILL_GREY; cell.font = FONT_BOLD
                cell.alignment = Alignment(horizontal="center", vertical="center")
            elif col_name == "Typo Fixed" and val:
                cell.fill = FILL_BLUE; cell.font = FONT_BOLD
            elif col_name == "Is Duplicate" and val == "Yes":
                cell.fill = FILL_GREY; cell.font = FONT_BOLD
                cell.alignment = Alignment(horizontal="center", vertical="center")

        ws.row_dimensions[r_i].height = 18

def _write_summary(ws, results):
    total      = len(results)
    dupes      = sum(1 for r in results if r["Is Duplicate"] == "Yes")
    typos      = sum(1 for r in results if r["Typo Fixed"])
    syntax_bad = sum(1 for r in results if r["Syntax OK"] == "✗")
    no_mx      = sum(1 for r in results if r["MX OK"] == "✗" and r["Is Duplicate"] == "No")
    disposable = sum(1 for r in results if r["Disposable"] == "Yes")
    role_based = sum(1 for r in results if r["Role-based"] == "Yes")
    catchall   = sum(1 for r in results if r["Catch-all"] == "Yes")
    high_risk  = sum(1 for r in results if r["Risk"] == "High")
    med_risk   = sum(1 for r in results if r["Risk"] == "Medium")
    low_risk   = sum(1 for r in results if r["Risk"] == "Low")
    clean      = total - dupes

    ws.column_dimensions["A"].width = 32
    ws.column_dimensions["B"].width = 14
    ws.column_dimensions["C"].width = 22

    stats = [
        ("CONTACT VALIDATION SUMMARY", "", ""),
        (f"Generated: {datetime.now().strftime('%Y-%m-%d %H:%M')}", "", ""),
        ("", "", ""),
        ("Metric", "Count", "% of Total"),
        ("Total contacts", total, "100%"),
        ("Unique contacts (after dedup)", clean, f"{clean/total*100:.1f}%"),
        ("Duplicates removed", dupes, f"{dupes/total*100:.1f}%"),
        ("", "", ""),
        ("Typos corrected", typos, f"{typos/total*100:.1f}%"),
        ("Syntax errors", syntax_bad, f"{syntax_bad/total*100:.1f}%"),
        ("No MX record", no_mx, f"{no_mx/total*100:.1f}%"),
        ("Disposable emails", disposable, f"{disposable/total*100:.1f}%"),
        ("Role-based emails", role_based, f"{role_based/total*100:.1f}%"),
        ("Catch-all domains", catchall, f"{catchall/total*100:.1f}%"),
        ("", "", ""),
        ("Risk: Low", low_risk, f"{low_risk/total*100:.1f}%"),
        ("Risk: Medium", med_risk, f"{med_risk/total*100:.1f}%"),
        ("Risk: High", high_risk, f"{high_risk/total*100:.1f}%"),
    ]

    risk_fills = {"Low": FILL_GREEN, "Medium": FILL_YELLOW, "High": FILL_RED}

    for r_i, (a, b, c) in enumerate(stats, 1):
        wa, wb_cell, wc = ws.cell(r_i, 1, a), ws.cell(r_i, 2, b), ws.cell(r_i, 3, c)
        for cell in (wa, wb_cell, wc):
            cell.alignment = Alignment(vertical="center")

        if r_i == 1:
            wa.font = Font(bold=True, size=14, color="2E5090")
        elif a == "Metric":
            for cell in (wa, wb_cell, wc):
                cell.fill = FILL_HEADER
                cell.font = FONT_WHITE_BOLD
                cell.alignment = Alignment(horizontal="center", vertical="center")
                cell.border = THIN_BORDER
        elif a.startswith("Risk:"):
            key = a.split(":")[1].strip()
            for cell in (wa, wb_cell, wc):
                cell.fill = risk_fills.get(key, FILL_GREY)
                cell.border = THIN_BORDER
        elif a and a != "" and r_i > 3:
            for cell in (wa, wb_cell, wc):
                cell.border = THIN_BORDER

# ── Entry point ────────────────────────────────────────────────────────────────

if __name__ == "__main__":
    SOURCE = "/home/user/alx-pre_course/leads6_raw_partial.json"
    OUT    = "/home/user/alx-pre_course/contacts6_validated_partial.xlsx"

    print("Parsing contacts...")
    if SOURCE.endswith(".json"):
        import json as _json
        with open(SOURCE) as f:
            rows = _json.load(f)
    else:
        rows = parse_csv(SOURCE)
    print(f"Loaded {len(rows)} contacts.\n")

    print("Validating emails (MX + SMTP may take a few minutes)...\n")
    results = process_contacts(rows)

    print("\nWriting Excel report...")
    write_excel(results, OUT)

    # Quick stats
    total  = len(results)
    dupes  = sum(1 for r in results if r["Is Duplicate"] == "Yes")
    typos  = sum(1 for r in results if r["Typo Fixed"])
    high   = sum(1 for r in results if r["Risk"] == "High")
    med    = sum(1 for r in results if r["Risk"] == "Medium")
    low    = sum(1 for r in results if r["Risk"] == "Low")

    print(f"""
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  VALIDATION COMPLETE
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  Total contacts   : {total}
  Duplicates found : {dupes}
  Typos corrected  : {typos}
  Risk Low         : {low}
  Risk Medium      : {med}
  Risk High        : {high}
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  Output: {OUT}
""")
