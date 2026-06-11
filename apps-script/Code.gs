/**
 * Axitos Publishing House — Homepage Query Form backend
 * ----------------------------------------------------------------------------
 * Receives POSTs from the homepage query form and appends a row to the
 * existing "Query Submission" Google Sheet, alongside the rows written by the
 * Duda native form on the other page.
 *
 * Behavior (per agreed setup):
 *   - Maps fields to the sheet BY HEADER NAME (resilient to column reordering).
 *   - Stamps "Submission Date" (UTC) and sets "Form Title" = "Homepage Query"
 *     so homepage submissions are filterable from the other page's rows.
 *   - Leaves "Phone Number" blank (homepage form has no phone field).
 *   - Maps the form's human-authored confirmation into the "OPT-IN" column.
 *   - Maps the publishing track to your existing plan wording.
 *   - Auto-creates these columns to the RIGHT if missing (Duda's columns are
 *     never touched): Working Title, Genre, Word Count, Author Platform.
 *
 * ============================================================================
 * SETUP (one time)
 * ============================================================================
 * 1. Open the "Query Submission" sheet in Google Sheets.
 * 2. Extensions → Apps Script. Delete any default code, paste THIS file, Save.
 * 3. Deploy → New deployment → type "Web app".
 *      - Description: Axitos homepage query
 *      - Execute as: Me (your account)
 *      - Who has access: Anyone
 *    Click Deploy, authorize when prompted, and COPY the Web app URL
 *    (it looks like https://script.google.com/macros/s/AKfy.../exec).
 * 4. Paste that URL into axitos-homepage.html as the value of QUERY_ENDPOINT
 *    (in the <script> near the form-validation section).
 * 5. Test by submitting the form — a new row should appear in the sheet.
 *
 * Note: this script is "bound" to the active spreadsheet, so it needs no IDs.
 * Fallback spreadsheet ID (if you ever make it standalone):
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

function doPost(e) {
  var lock = LockService.getScriptLock();
  lock.tryLock(30000);
  try {
    var ss = SpreadsheetApp.getActiveSpreadsheet();
    var sheet = findDataSheet_(ss);

    var lastCol = Math.max(1, sheet.getLastColumn());
    var headers = sheet.getRange(1, 1, 1, lastCol).getValues()[0];
    headers = ensureHeaders_(sheet, headers, NEW_COLUMNS);

    var p = (e && e.parameter) ? e.parameter : {};
    var optIn = String(p.humanAuthored).toLowerCase() === 'true' ? 'true' : 'false';
    var plan = PLAN_MAP[String(p.model || '').toLowerCase()] || p.model || '';
    var now = Utilities.formatDate(new Date(), 'UTC', 'yyyy-MM-dd HH:mm:ss') + ' UTC';

    // Values keyed by normalized header name.
    var values = {};
    values['submission date'] = now;
    values['form title'] = 'Homepage Query';
    values['first name'] = p.firstName || '';
    values['last name'] = p.lastName || '';
    values['email'] = p.email || '';
    // 'phone number' intentionally left blank.
    values['book synopsis'] = p.synopsis || '';
    values['select your publishing plan'] = plan;
    values['working title'] = p.bookTitle || '';
    values['genre'] = p.genre || '';
    values['word count'] = p.wordCount || '';
    values['author platform'] = p.platform || '';
    // 'OPT-IN' handled specially below (its header is very long).

    var row = [];
    for (var i = 0; i < headers.length; i++) {
      var h = norm_(headers[i]);
      if (h.indexOf('opt-in') === 0) { row.push(optIn); continue; }
      row.push(values.hasOwnProperty(h) ? values[h] : '');
    }

    sheet.appendRow(row);
    return json_({ ok: true });
  } catch (err) {
    return json_({ ok: false, error: String(err) });
  } finally {
    lock.releaseLock();
  }
}

// Simple health check when visiting the URL in a browser.
function doGet() {
  return ContentService.createTextOutput('Axitos homepage query endpoint is live.');
}

// --- helpers ---------------------------------------------------------------

function norm_(s) {
  return String(s == null ? '' : s).toLowerCase().replace(/\s+/g, ' ').trim();
}

// Finds the tab that holds the submissions (the one whose header row contains
// "Submission Date" / "Form Title"); falls back to the first sheet.
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
