/**
 * Axitos Publishing House — Homepage Query Form backend
 * ----------------------------------------------------------------------------
 * Receives submissions from the homepage query form and appends a row to the
 * existing "Query Submission" Google Sheet, alongside the rows written by the
 * Duda native form on the other page.
 *
 * Endpoints:
 *   - doGet : used by the website via JSONP (so the browser can READ the
 *             result and only show success when the row was actually written).
 *             Also serves a plain health-check message when hit directly.
 *   - doPost: same logic, for server-to-server / form-encoded posts.
 *
 * Security / robustness:
 *   - Server-side validation (required fields, email format, consent) so the
 *     endpoint is safe even though client-side JS can be bypassed.
 *   - Honeypot ("company") — silently drops bot submissions.
 *   - Formula-injection (CSV/Sheets injection) sanitization on every cell.
 *   - Length caps to prevent oversized/abusive payloads.
 *   - LockService to avoid row races between concurrent submits.
 *
 * Behavior (per agreed setup):
 *   - Stamps "Submission Date" (UTC); "Form Title" = "Homepage Query".
 *   - Leaves "Phone Number" blank; maps human-authored confirmation -> OPT-IN.
 *   - Maps the publishing track to your existing plan wording.
 *   - Auto-creates these columns to the RIGHT if missing (Duda's columns are
 *     never touched): Working Title, Genre, Word Count, Author Platform.
 *
 * ============================================================================
 * SETUP / UPDATE
 * ============================================================================
 * First time:
 *   1. Open "Query Submission" → Extensions → Apps Script.
 *   2. Paste this file, Save.
 *   3. Deploy → New deployment → Web app
 *        Execute as: Me   |   Who has access: Anyone   → Deploy → authorize.
 *      Copy the /exec URL into axitos-homepage.html (QUERY_ENDPOINT).
 * If you are UPDATING an already-deployed script (e.g. this version):
 *   - Paste the new code, Save, then Deploy → Manage deployments →
 *     edit (pencil) → Version: "New version" → Deploy. The /exec URL stays
 *     the same, so no website change is needed.
 *
 * Fallback spreadsheet ID (only if you make this script standalone):
 *   1BkGV4uAEFRJAqq0yIGsrzP8ROVNI9hnGLI3-mG4Qe9o
 * ============================================================================
 */

// Maps the form's <select> values to your existing "Select Your Publishing Plan" wording.
var PLAN_MAP = {
  'traditional': 'Free traditional model with author copies at 50% discount',
  'partnership': 'Executive Premium Plan with One-time Investment',
  'unsure': 'Not sure — please guide me'
};

// Columns to create (to the right) if they don't already exist.
var NEW_COLUMNS = ['Working Title', 'Genre', 'Word Count', 'Author Platform'];

// Maximum accepted length per field (characters). Longer values are truncated.
var MAX_LEN = {
  firstName: 100, lastName: 100, email: 150, bookTitle: 200,
  genre: 100, wordCount: 50, synopsis: 5000, platform: 1000
};

function doGet(e) {
  var p = (e && e.parameter) ? e.parameter : {};
  // Treat as a submission only when a JSONP callback + some real data is present.
  if (p.callback && (p.email || p.firstName)) {
    var result = safeHandle_(p);
    return ContentService
      .createTextOutput(p.callback + '(' + JSON.stringify(result) + ');')
      .setMimeType(ContentService.MimeType.JAVASCRIPT);
  }
  return ContentService.createTextOutput('Axitos homepage query endpoint is live.');
}

function doPost(e) {
  var p = (e && e.parameter) ? e.parameter : {};
  return json_(safeHandle_(p));
}

// --- core ------------------------------------------------------------------

function safeHandle_(p) {
  var lock = LockService.getScriptLock();
  try {
    lock.tryLock(30000);
    return handle_(p);
  } catch (err) {
    return { ok: false, error: 'Server error.' };
  } finally {
    try { lock.releaseLock(); } catch (e) {}
  }
}

function handle_(p) {
  p = p || {};

  // Honeypot: bots fill this; humans can't see it. Pretend success, write nothing.
  if (trim_(p.company) !== '') return { ok: true };

  // --- server-side validation (client JS can be bypassed) ---
  var firstName = trim_(p.firstName);
  var lastName  = trim_(p.lastName);
  var email     = trim_(p.email);
  var bookTitle = trim_(p.bookTitle);
  var genre     = trim_(p.genre);
  var model     = trim_(p.model);
  var synopsis  = trim_(p.synopsis);

  if (!firstName || !lastName || !email || !bookTitle || !genre || !model || !synopsis) {
    return { ok: false, error: 'Please complete all required fields.' };
  }
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return { ok: false, error: 'Please enter a valid email address.' };
  }
  if (String(p.humanAuthored).toLowerCase() !== 'true') {
    return { ok: false, error: 'Human-authored confirmation is required.' };
  }

  // --- normalize values ---
  var optIn = 'true';
  var plan  = PLAN_MAP[model.toLowerCase()] || model;
  var now   = Utilities.formatDate(new Date(), 'UTC', 'yyyy-MM-dd HH:mm:ss') + ' UTC';

  var values = {};
  values['submission date'] = now;
  values['form title'] = 'Homepage Query';
  values['first name'] = cap_(firstName, MAX_LEN.firstName);
  values['last name']  = cap_(lastName, MAX_LEN.lastName);
  values['email']      = cap_(email, MAX_LEN.email);
  // 'phone number' intentionally left blank.
  values['book synopsis'] = cap_(synopsis, MAX_LEN.synopsis);
  values['select your publishing plan'] = plan;
  values['working title']  = cap_(bookTitle, MAX_LEN.bookTitle);
  values['genre']          = cap_(genre, MAX_LEN.genre);
  values['word count']     = cap_(trim_(p.wordCount), MAX_LEN.wordCount);
  values['author platform'] = cap_(trim_(p.platform), MAX_LEN.platform);
  // 'OPT-IN' handled specially below (its header is very long).

  // --- write ---
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sheet = findDataSheet_(ss);
  var lastCol = Math.max(1, sheet.getLastColumn());
  var headers = sheet.getRange(1, 1, 1, lastCol).getValues()[0];
  headers = ensureHeaders_(sheet, headers, NEW_COLUMNS);

  var row = [];
  for (var i = 0; i < headers.length; i++) {
    var h = norm_(headers[i]);
    if (h.indexOf('opt-in') === 0) { row.push(sanitize_(optIn)); continue; }
    row.push(values.hasOwnProperty(h) ? sanitize_(values[h]) : '');
  }
  sheet.appendRow(row);

  return { ok: true };
}

// --- helpers ---------------------------------------------------------------

function trim_(s) { return String(s == null ? '' : s).trim(); }
function cap_(s, n) { s = String(s == null ? '' : s); return s.length > n ? s.substring(0, n) : s; }
function norm_(s) { return String(s == null ? '' : s).toLowerCase().replace(/\s+/g, ' ').trim(); }

/**
 * Neutralizes spreadsheet formula injection: a value a user starts with
 * = + - @ (or a leading tab / CR) can execute as a formula when the sheet is
 * opened or exported. Prefixing a single quote forces it to be treated as text.
 */
function sanitize_(v) {
  var s = String(v == null ? '' : v);
  if (s.length && /^[=+\-@\t\r]/.test(s)) return "'" + s;
  return s;
}

// Finds the tab holding submissions (header row has "Submission Date" /
// "Form Title"); falls back to the first sheet.
function findDataSheet_(ss) {
  var sheets = ss.getSheets();
  for (var i = 0; i < sheets.length; i++) {
    var lc = sheets[i].getLastColumn();
    if (lc < 1) continue;
    var hdr = sheets[i].getRange(1, 1, 1, lc).getValues()[0].map(norm_);
    if (hdr.indexOf('submission date') !== -1 || hdr.indexOf('form title') !== -1) {
      return sheets[i];
    }
  }
  return sheets[0];
}

// Appends any missing headers to the end of row 1; returns the updated headers.
function ensureHeaders_(sheet, headers, needed) {
  var existing = headers.map(norm_);
  var added = false;
  for (var i = 0; i < needed.length; i++) {
    if (existing.indexOf(norm_(needed[i])) === -1) {
      headers.push(needed[i]);
      existing.push(norm_(needed[i]));
      added = true;
    }
  }
  if (added) {
    sheet.getRange(1, 1, 1, headers.length).setValues([headers]);
  }
  return headers;
}

function json_(obj) {
  return ContentService
    .createTextOutput(JSON.stringify(obj))
    .setMimeType(ContentService.MimeType.JSON);
}
