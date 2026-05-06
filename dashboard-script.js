// ============================================================
// AXITOS DASHBOARD — AI Scoring, Insights & Sheet Sync
// v3 — scores stored as numbers in sheet, % only written to Duda
// ============================================================

var SHEET_ID   = '1VGMveP1ydBZfSg1XrHnpN7Y9tQ9hT9X92AoOJlpUges';
var SHEET_NAME = 'Dashboard';
var PPLX_KEY   = 'YOUR_PERPLEXITY_API_KEY'; // Set this in Apps Script — do not commit the real key

var HEADERS = [
  'page_item_url', 'Name', 'Title', 'author_email',
  'ChatGPT', 'Claude', 'Gemini', 'Perplexity', 'AI Visibility',
  'ChatGPT Status', 'Claude Status', 'Gemini Status', 'Perplexity Status',
  'ChatGPT Details', 'Claude Details', 'Gemini Details', 'Perplexity Details',
  'AI Chart',
  'Citation Queries 1', 'Citation Queries 2', 'Citation Queries 3',
  'Citation Queries 4', 'Citation Queries 5',
  'Blog_Topic_1', 'Strategic_Why_1',
  'Blog_Topic_2', 'Strategic_Why_2',
  'Blog_Topic_3', 'Strategic_Why_3',
  'Blog_Topic_4', 'Strategic_Why_4',
  'Blog_Topic_5', 'Strategic_Why_5',
  'Keyword_1', 'Keyword_2', 'Keyword_3', 'Keyword_4', 'Keyword_5',
  'Suggested_Title_1', 'Suggested_Title_2', 'Suggested_Title_3',
  'Trend_Source',
  'Updates 1', 'Updates 2', 'Updates 3', 'Updates 4',
  'Genre/Topic', 'ASIN', 'Last Scored', 'Last Synced'
];

// Scores are stored as plain numbers in the sheet (e.g. 12, not "12%")
// "%" is only appended when writing to Duda via MCP sync

// Status thresholds: Citing >10, Learning 1-10, Pending 0
function getStatus(score) {
  score = parseFloat(score) || 0;
  if (score > 10) return 'Citing';
  if (score >= 1)  return 'Learning';
  return 'Pending';
}

// Calculate week-over-week % change (both values are plain numbers)
function calcChange(newScore, oldScore) {
  oldScore = parseFloat(oldScore) || 0;
  newScore = parseFloat(newScore) || 0;
  if (oldScore === 0) {
    return newScore > 0 ? 'First score — no previous data' : '+0% change from previous week';
  }
  var pct = Math.round(((newScore - oldScore) / oldScore) * 100);
  if (pct > 0)  return '+' + pct + '% increase than previous week';
  if (pct < 0)  return Math.abs(pct) + '% decrease than previous week';
  return '+0% increase than previous week';
}

// ── Router ──────────────────────────────────────────────────
function doGet(e) {
  var action = (e.parameter && e.parameter.action) ? e.parameter.action : '';
  try {
    if (action === 'setup')   { setupSheet();   return respond('Sheet ready'); }
    if (action === 'repair')  { repairSheet();  return respond('Sheet repaired'); }
    if (action === 'score')   { return scoreAll(); }
    if (action === 'read')    { return readAll(); }
    if (action === 'upsert')  { upsertFromParams(e.parameter); return respond('OK'); }
  } catch (err) {
    return respond('Error: ' + err.message);
  }
  return respond('OK');
}

function respond(msg) {
  return ContentService.createTextOutput(
    typeof msg === 'string' ? msg : JSON.stringify(msg)
  ).setMimeType(ContentService.MimeType.TEXT);
}

// ── Sheet Setup (clears all data — only for fresh start) ────
function setupSheet() {
  var ss    = SpreadsheetApp.openById(SHEET_ID);
  var sheet = ss.getSheetByName(SHEET_NAME) || ss.insertSheet(SHEET_NAME);
  sheet.clearContents();
  sheet.appendRow(HEADERS);
  var hdr = sheet.getRange(1, 1, 1, HEADERS.length);
  hdr.setBackground('#fb8a55');
  hdr.setFontColor('#ffffff');
  hdr.setFontWeight('bold');
  sheet.setFrozenRows(1);
  formatScoreColumns(sheet);
}

// ── Sheet Repair (adds missing columns, fixes score format — preserves data) ──
function repairSheet() {
  var ss      = SpreadsheetApp.openById(SHEET_ID);
  var sheet   = ss.getSheetByName(SHEET_NAME);
  if (!sheet) { setupSheet(); return; }
  var existing = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0];

  // Add any HEADERS columns that are missing
  HEADERS.forEach(function(h) {
    if (existing.indexOf(h) === -1) {
      var col = sheet.getLastColumn() + 1;
      sheet.getRange(1, col).setValue(h);
      existing.push(h);
    }
  });

  // Re-order columns to match HEADERS order
  // (simpler: just ensure all exist — ordering can be done manually in sheet)

  // Fix score columns: if stored as decimals (e.g. 0.12), convert to integers (12)
  var data    = sheet.getDataRange().getValues();
  var headers = data[0];
  var scoreCols = ['ChatGPT', 'Claude', 'Gemini', 'Perplexity', 'AI Visibility'];
  scoreCols.forEach(function(col) {
    var idx = headers.indexOf(col);
    if (idx === -1) return;
    for (var r = 1; r < data.length; r++) {
      var val = data[r][idx];
      if (val === '' || val === null) continue;
      var num = parseFloat(val);
      // If stored as decimal percentage (e.g. 0.12 instead of 12), multiply by 100
      if (num > 0 && num < 1) {
        sheet.getRange(r + 1, idx + 1).setValue(Math.round(num * 100));
      }
    }
  });

  formatScoreColumns(sheet);
  Logger.log('repairSheet complete');
}

// Force score columns to plain text format so Sheets doesn't auto-convert numbers
function formatScoreColumns(sheet) {
  var headers  = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0];
  var scoreCols = ['ChatGPT', 'Claude', 'Gemini', 'Perplexity', 'AI Visibility'];
  var lastRow  = Math.max(sheet.getLastRow(), 2);
  scoreCols.forEach(function(col) {
    var idx = headers.indexOf(col);
    if (idx === -1) return;
    sheet.getRange(2, idx + 1, lastRow - 1, 1).setNumberFormat('0');
  });
}

// ── Score All Authors ────────────────────────────────────────
function scoreAll() {
  var ss      = SpreadsheetApp.openById(SHEET_ID);
  var sheet   = ss.getSheetByName(SHEET_NAME);
  if (!sheet) { setupSheet(); sheet = ss.getSheetByName(SHEET_NAME); }
  var data    = sheet.getDataRange().getValues();
  var headers = data[0];
  var results = [];

  for (var i = 1; i < data.length; i++) {
    var row   = rowToObj(headers, data[i]);
    var name  = String(row['Name']  || '').trim();
    var title = String(row['Title'] || '').trim();
    var slug  = String(row['page_item_url'] || '').trim();
    if (!name || !title) {
      Logger.log('Skipping row ' + i + ' — missing name or title');
      continue;
    }

    // Capture previous scores (plain numbers) for Details calculation
    var oldChatGPT    = parseFloat(row['ChatGPT'])    || 0;
    var oldClaude     = parseFloat(row['Claude'])     || 0;
    var oldGemini     = parseFloat(row['Gemini'])     || 0;
    var oldPerplexity = parseFloat(row['Perplexity']) || 0;

    // If old values look like decimals (<1), they're leftover % format — fix them
    if (oldChatGPT    > 0 && oldChatGPT    < 1) oldChatGPT    = Math.round(oldChatGPT    * 100);
    if (oldClaude     > 0 && oldClaude     < 1) oldClaude     = Math.round(oldClaude     * 100);
    if (oldGemini     > 0 && oldGemini     < 1) oldGemini     = Math.round(oldGemini     * 100);
    if (oldPerplexity > 0 && oldPerplexity < 1) oldPerplexity = Math.round(oldPerplexity * 100);

    Logger.log('Scoring: ' + name + ' (prev: ChatGPT=' + oldChatGPT + ', Perplexity=' + oldPerplexity + ')');
    var scored = callPerplexity(name, title);
    Utilities.sleep(2000);
    if (!scored) { Logger.log('Perplexity returned null for ' + name); continue; }

    var chatgpt    = scored.chatgpt    || 0;
    var claude     = scored.claude     || 0;
    var gemini     = scored.gemini     || 0;
    var perplexity = scored.perplexity || 0;
    var aiVis      = Math.round((chatgpt + claude + gemini + perplexity) / 4);

    // Rolling 10-week AI Chart (plain numbers)
    var existing = String(row['AI Chart'] || '').replace(/<[^>]+>/g, '').trim();
    var chartArr = existing ? existing.split(',').map(function(v) { return v.trim(); }) : [];
    chartArr.push(String(aiVis));
    if (chartArr.length > 10) chartArr = chartArr.slice(chartArr.length - 10);

    // Week-over-week Details
    var chatgptDetail    = calcChange(chatgpt,    oldChatGPT);
    var claudeDetail     = calcChange(claude,     oldClaude);
    var geminiDetail     = calcChange(gemini,     oldGemini);
    var perplexityDetail = calcChange(perplexity, oldPerplexity);

    // Content strategy
    var topics   = scored.blog_topics      || [];
    var keywords = scored.keywords         || [];
    var titles   = scored.suggested_titles || [];
    var queries  = scored.queries          || [];

    var update = {
      'page_item_url':      slug,
      'ChatGPT':            chatgpt,
      'Claude':             claude,
      'Gemini':             gemini,
      'Perplexity':         perplexity,
      'AI Visibility':      aiVis,
      'ChatGPT Status':     getStatus(chatgpt),
      'Claude Status':      getStatus(claude),
      'Gemini Status':      getStatus(gemini),
      'Perplexity Status':  getStatus(perplexity),
      'ChatGPT Details':    chatgptDetail,
      'Claude Details':     claudeDetail,
      'Gemini Details':     geminiDetail,
      'Perplexity Details': perplexityDetail,
      'AI Chart':           chartArr.join(','),
      'Citation Queries 1': queries[0] || '',
      'Citation Queries 2': queries[1] || '',
      'Citation Queries 3': queries[2] || '',
      'Citation Queries 4': queries[3] || '',
      'Citation Queries 5': queries[4] || '',
      'Blog_Topic_1':    topics[0] ? topics[0].topic : '',
      'Strategic_Why_1': topics[0] ? topics[0].why   : '',
      'Blog_Topic_2':    topics[1] ? topics[1].topic : '',
      'Strategic_Why_2': topics[1] ? topics[1].why   : '',
      'Blog_Topic_3':    topics[2] ? topics[2].topic : '',
      'Strategic_Why_3': topics[2] ? topics[2].why   : '',
      'Blog_Topic_4':    topics[3] ? topics[3].topic : '',
      'Strategic_Why_4': topics[3] ? topics[3].why   : '',
      'Blog_Topic_5':    topics[4] ? topics[4].topic : '',
      'Strategic_Why_5': topics[4] ? topics[4].why   : '',
      'Keyword_1':         keywords[0] || '',
      'Keyword_2':         keywords[1] || '',
      'Keyword_3':         keywords[2] || '',
      'Keyword_4':         keywords[3] || '',
      'Keyword_5':         keywords[4] || '',
      'Suggested_Title_1': titles[0] || '',
      'Suggested_Title_2': titles[1] || '',
      'Suggested_Title_3': titles[2] || '',
      'Trend_Source':      scored.trend_source || '',
      'Last Scored':       new Date().toISOString()
    };

    updateSheetRow(sheet, headers, slug, update);
    Logger.log('Done: ' + name + ' — AI Visibility: ' + aiVis + '%');
    results.push({
      slug: slug, name: name,
      aiVisibility: aiVis + '%',
      chatgpt: chatgpt + '%', claude: claude + '%',
      gemini: gemini + '%', perplexity: perplexity + '%'
    });
  }

  Logger.log('Scoring complete. Total scored: ' + results.length);
  return ContentService.createTextOutput(JSON.stringify({
    success: true, scored: results.length, results: results,
    timestamp: new Date().toISOString()
  })).setMimeType(ContentService.MimeType.JSON);
}

// ── Perplexity API Call ──────────────────────────────────────
function callPerplexity(author, title) {
  var prompt =
    'You are an AI visibility and content strategy expert. Analyse the book "' + title + '" by ' + author + '.\n\n' +
    'Return ONLY a single raw JSON object — no markdown, no explanation, no extra text.\n\n' +
    '1. AI VISIBILITY SCORES (0–100): How likely is each AI to currently recommend or cite this specific book?\n' +
    '   chatgpt, claude, gemini, perplexity (integers)\n\n' +
    '2. CITATION QUERIES: Top 5 natural-language queries a user would type into an AI that would surface this book.\n' +
    '   queries: ["q1","q2","q3","q4","q5"]\n\n' +
    '3. BLOG TOPICS: 5 weekly blog ideas. Each must be:\n' +
    '   - SEO, AEO and GEO optimised\n' +
    '   - Based on what people actively search in this niche right now\n' +
    '   - Designed to position the author as a leading authority in their field\n' +
    '   - Directly tied to the book subject and author niche — nothing generic\n' +
    '   Each topic must include a "why" — the specific search intent and strategic reason it benefits this author.\n' +
    '   blog_topics: [{"topic":"...","why":"..."},{"topic":"...","why":"..."},{"topic":"...","why":"..."},{"topic":"...","why":"..."},{"topic":"...","why":"..."}]\n\n' +
    '4. KEYWORDS: 5 high-intent, high-volume keywords related to this author\'s book, niche, and suggested blog topics.\n' +
    '   keywords: ["kw1","kw2","kw3","kw4","kw5"]\n\n' +
    '5. SUGGESTED BOOK TITLES: 3 title ideas for the author\'s next book.\n' +
    '   Each must be within the author\'s exact niche, have strong search volume and market intent.\n' +
    '   suggested_titles: ["title1","title2","title3"]\n\n' +
    '6. TREND SOURCE: One short sentence describing the key trend or insight behind this week\'s topics and keywords.\n' +
    '   trend_source: "..."\n\n' +
    'Exact JSON format to return (no other text):\n' +
    '{"chatgpt":0,"claude":0,"gemini":0,"perplexity":0,' +
    '"queries":["","","","",""],' +
    '"blog_topics":[{"topic":"","why":""},{"topic":"","why":""},{"topic":"","why":""},{"topic":"","why":""},{"topic":"","why":""}],' +
    '"keywords":["","","","",""],' +
    '"suggested_titles":["","",""],' +
    '"trend_source":""}';

  var url     = 'https://api.perplexity.ai/chat/completions';
  var payload = {
    model: 'sonar',
    messages: [{ role: 'user', content: prompt }],
    temperature: 0.3,
    max_tokens: 1500
  };
  var opts = {
    method: 'post',
    contentType: 'application/json',
    headers: { 'Authorization': 'Bearer ' + PPLX_KEY },
    payload: JSON.stringify(payload),
    muteHttpExceptions: true
  };
  try {
    var res  = UrlFetchApp.fetch(url, opts);
    var raw  = res.getContentText();
    Logger.log('Perplexity raw (' + author + '): ' + raw.substring(0, 600));
    var json = JSON.parse(raw);
    if (!json.choices || !json.choices[0]) return null;
    var text = json.choices[0].message.content.trim()
                   .replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
    Logger.log('Perplexity parsed (' + author + '): ' + text.substring(0, 400));
    return JSON.parse(text);
  } catch (e) {
    Logger.log('Perplexity error (' + author + '): ' + e.message);
    return null;
  }
}

// ── Sheet Helpers ────────────────────────────────────────────
function updateSheetRow(sheet, headers, slug, data) {
  var all     = sheet.getDataRange().getValues();
  var slugIdx = headers.indexOf('page_item_url');
  for (var i = 1; i < all.length; i++) {
    if (String(all[i][slugIdx]).trim() === slug) {
      Object.keys(data).forEach(function(key) {
        var col = headers.indexOf(key);
        if (col !== -1) sheet.getRange(i + 1, col + 1).setValue(data[key]);
      });
      return;
    }
  }
}

function upsertFromParams(params) {
  var ss      = SpreadsheetApp.openById(SHEET_ID);
  var sheet   = ss.getSheetByName(SHEET_NAME);
  if (!sheet) { setupSheet(); sheet = ss.getSheetByName(SHEET_NAME); }
  var data    = sheet.getDataRange().getValues();
  var headers = data[0];
  var slugIdx = headers.indexOf('page_item_url');
  var slug    = params['page_item_url'];
  for (var i = 1; i < data.length; i++) {
    if (String(data[i][slugIdx]).trim() === slug) {
      headers.forEach(function(h, j) {
        if (params[h] !== undefined && params[h] !== '')
          sheet.getRange(i + 1, j + 1).setValue(params[h]);
      });
      sheet.getRange(i + 1, headers.indexOf('Last Synced') + 1).setValue(new Date().toISOString());
      return;
    }
  }
  var newRow = headers.map(function(h) { return params[h] || ''; });
  newRow[headers.indexOf('Last Synced')] = new Date().toISOString();
  sheet.appendRow(newRow);
}

function readAll() {
  var ss      = SpreadsheetApp.openById(SHEET_ID);
  var sheet   = ss.getSheetByName(SHEET_NAME);
  var data    = sheet.getDataRange().getValues();
  var headers = data[0];
  var rows    = [];
  for (var i = 1; i < data.length; i++) rows.push(rowToObj(headers, data[i]));
  return ContentService.createTextOutput(JSON.stringify(rows)).setMimeType(ContentService.MimeType.JSON);
}

function rowToObj(headers, row) {
  var obj = {};
  headers.forEach(function(h, j) { obj[h] = row[j]; });
  return obj;
}

// ── Trigger Setup (run once manually) ───────────────────────
function setupWeeklyTrigger() {
  ScriptApp.getProjectTriggers().forEach(function(t) { ScriptApp.deleteTrigger(t); });
  ScriptApp.newTrigger('scoreAll')
    .timeBased().onWeekDay(ScriptApp.WeekDay.FRIDAY).atHour(6).create();
}
