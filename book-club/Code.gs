// ─── AXITOS FREE BOOK CLUB — Apps Script Backend ─────────────────────────────
// Paste this entire file into: script.google.com → New Project
// Then: Deploy → New deployment → Web app → Execute as Me → Anyone can access
// ─────────────────────────────────────────────────────────────────────────────

var CONFIG = {
  SHEET_ID:      'YOUR_GOOGLE_SHEET_ID_HERE',   // From your Sheet URL
  BOOKS_SHEET:   'Books',
  MEMBERS_SHEET: 'Members',
  MAX_BOOKS:     12,                            // Total cards shown on page
  BOOK_CLUB_URL: 'https://www.axitos.ai/book-club',

  // Amazon Kindle Top 100 Free RSS feeds — all $0.00 Kindle ebooks.
  // Add or remove category IDs to match Axitos's audience.
  // Current selection: overall free list + fiction + business
  AMAZON_RSS_FEEDS: [
    'https://www.amazon.com/gp/rss/bestsellers/digital-text/2245476011/', // All Free Kindle
    'https://www.amazon.com/gp/rss/bestsellers/digital-text/158591011/',  // Fiction
    'https://www.amazon.com/gp/rss/bestsellers/digital-text/2577013011/'  // Business
  ]
};

// ─── WEB APP ENDPOINT ─────────────────────────────────────────────────────────
// Duda page widget fetches this URL to get the book list as JSON
function doGet(e) {
  var books = buildBookList();
  var output = ContentService.createTextOutput(JSON.stringify(books));
  output.setMimeType(ContentService.MimeType.JSON);
  return output;
}

// ─── BOOK LIST BUILDER ────────────────────────────────────────────────────────
function buildBookList() {
  var axitosBooks  = getAxitosBooks();
  var needed       = Math.max(0, CONFIG.MAX_BOOKS - axitosBooks.length);
  var amazonBooks  = needed > 0 ? fetchAmazonFreeBooks(needed) : [];
  return axitosBooks.concat(amazonBooks);
}

// ─── AXITOS BOOKS (from Google Sheet) ────────────────────────────────────────
function getAxitosBooks() {
  try {
    var ss    = SpreadsheetApp.openById(CONFIG.SHEET_ID);
    var sheet = ss.getSheetByName(CONFIG.BOOKS_SHEET);
    if (!sheet) return [];

    var data = sheet.getDataRange().getValues();
    if (data.length < 2) return [];

    var h         = data[0].map(function(v){ return v.toString().trim(); });
    var titleIdx  = h.indexOf('Title');
    var authorIdx = h.indexOf('Author');
    var coverIdx  = h.indexOf('Cover URL');
    var linkIdx   = h.indexOf('Amazon Link');
    var priceIdx  = h.indexOf('Price');

    var books = [];
    for (var i = 1; i < data.length; i++) {
      var row   = data[i];
      var price = parseFloat(row[priceIdx]);
      if (isNaN(price) || price !== 0) continue;

      books.push({
        id:            'axitos-' + i,
        title:         row[titleIdx]  || '',
        author:        row[authorIdx] || '',
        cover_url:     row[coverIdx]  || '',
        download_link: row[linkIdx]   || '',
        price:         '$0.00',
        source:        'axitos'
      });
    }
    return books;
  } catch (e) {
    console.error('getAxitosBooks:', e);
    return [];
  }
}

// ─── AMAZON TOP 100 FREE KINDLE RSS ──────────────────────────────────────────
// Amazon publishes public RSS feeds for their bestseller lists.
// Each book URL contains the ASIN, which lets us build the cover image URL
// directly from Amazon's CDN — no API key required.
function fetchAmazonFreeBooks(limit) {
  var seen     = {};   // deduplicate by ASIN across multiple feeds
  var allBooks = [];

  for (var f = 0; f < CONFIG.AMAZON_RSS_FEEDS.length; f++) {
    if (allBooks.length >= limit) break;

    try {
      var res = UrlFetchApp.fetch(CONFIG.AMAZON_RSS_FEEDS[f], {
        muteHttpExceptions: true,
        headers: {
          'User-Agent': 'Mozilla/5.0 (compatible; Googlebot/2.1)'
        }
      });
      if (res.getResponseCode() !== 200) continue;

      var xml   = res.getContentText();
      var items = xml.match(/<item>[\s\S]*?<\/item>/g) || [];

      for (var i = 0; i < items.length; i++) {
        if (allBooks.length >= limit) break;

        var item  = items[i];
        var link  = rssField(item, 'link') || rssField(item, 'guid');
        var asin  = extractAsin(link);
        if (!asin || seen[asin]) continue;
        seen[asin] = true;

        var rawTitle = rssField(item, 'title');
        var title    = cleanTitle(rawTitle);
        if (!title) continue;

        var desc    = rssField(item, 'description');
        var author  = extractAuthor(desc);

        // Amazon CDN serves cover images at a predictable URL from the ASIN
        var coverUrl = 'https://images-na.ssl-images-amazon.com/images/P/' + asin + '.01.L.jpg';

        allBooks.push({
          id:            'amz-' + asin,
          title:         title,
          author:        author,
          cover_url:     coverUrl,
          download_link: 'https://www.amazon.com/dp/' + asin,
          price:         '$0.00',
          source:        'amazon'
        });
      }
    } catch (e) {
      console.error('fetchAmazonFreeBooks feed=' + CONFIG.AMAZON_RSS_FEEDS[f] + ':', e);
    }
  }

  return allBooks;
}

// Pull a field value from an RSS <item> string, handling CDATA wrappers
function rssField(item, tag) {
  var cdataMatch = item.match(new RegExp('<' + tag + '[^>]*><!\\[CDATA\\[([\\s\\S]*?)\\]\\]><\\/' + tag + '>'));
  if (cdataMatch) return cdataMatch[1].trim();
  var plainMatch = item.match(new RegExp('<' + tag + '[^>]*>([\\s\\S]*?)<\\/' + tag + '>'));
  return plainMatch ? plainMatch[1].trim() : '';
}

// Extract the 10-character ASIN from an Amazon product URL
function extractAsin(url) {
  var m = (url || '').match(/\/(?:dp|gp\/product|ASIN)\/([A-Z0-9]{10})/i);
  return m ? m[1].toUpperCase() : null;
}

// Remove Amazon-appended suffixes like "(Kindle Edition)" from titles
function cleanTitle(raw) {
  return (raw || '')
    .replace(/\s*\(Kindle Edition\)/gi, '')
    .replace(/\s*\[Kindle Edition\]/gi, '')
    .replace(/&amp;/g, '&')
    .trim();
}

// Amazon RSS descriptions contain "by AuthorName" — extract it
function extractAuthor(desc) {
  var m = (desc || '').match(/by\s+([A-Z][^<\n,]{2,40})/i);
  return m ? m[1].trim() : '';
}

// ─── EMAIL NOTIFICATION ───────────────────────────────────────────────────────
// Set up a time-based trigger for this function:
// Apps Script → Triggers → Add trigger → checkAndNotifyNewBooks
// → Time-driven → Day timer → (pick a time, e.g. 9am)
function checkAndNotifyNewBooks() {
  try {
    var ss    = SpreadsheetApp.openById(CONFIG.SHEET_ID);
    var sheet = ss.getSheetByName(CONFIG.BOOKS_SHEET);
    if (!sheet) return;

    var data = sheet.getDataRange().getValues();
    if (data.length < 2) return;

    var h           = data[0].map(function(v){ return v.toString().trim(); });
    var priceIdx    = h.indexOf('Price');
    var notifiedIdx = h.indexOf('Email Sent');
    var titleIdx    = h.indexOf('Title');
    var authorIdx   = h.indexOf('Author');
    var linkIdx     = h.indexOf('Amazon Link');
    var coverIdx    = h.indexOf('Cover URL');

    var newBooks = [];
    for (var i = 1; i < data.length; i++) {
      var row      = data[i];
      var price    = parseFloat(row[priceIdx]);
      var notified = row[notifiedIdx];
      if (price === 0 && !notified) {
        newBooks.push({
          title:         row[titleIdx]  || 'Untitled',
          author:        row[authorIdx] || '',
          download_link: row[linkIdx]   || CONFIG.BOOK_CLUB_URL,
          cover_url:     row[coverIdx]  || '',
          rowIndex:      i + 1
        });
      }
    }

    if (newBooks.length === 0) return;

    sendMemberEmails(newBooks);

    // Mark each book as notified so we don't email again
    for (var j = 0; j < newBooks.length; j++) {
      sheet.getRange(newBooks[j].rowIndex, notifiedIdx + 1).setValue(new Date());
    }
  } catch (e) {
    console.error('checkAndNotifyNewBooks:', e);
  }
}

// ─── EMAIL SENDER ─────────────────────────────────────────────────────────────
function sendMemberEmails(newBooks) {
  var ss    = SpreadsheetApp.openById(CONFIG.SHEET_ID);
  var sheet = ss.getSheetByName(CONFIG.MEMBERS_SHEET);
  if (!sheet) return;

  var data = sheet.getDataRange().getValues();

  for (var i = 1; i < data.length; i++) {
    var email = (data[i][0] || '').toString().trim();
    var name  = (data[i][1] || 'Book Club Member').toString().trim();
    if (!email || email.indexOf('@') === -1) continue;

    try {
      GmailApp.sendEmail(
        email,
        '📚 New Free eBooks on Axitos Book Club!',
        buildPlainEmail(name, newBooks),
        { htmlBody: buildHTMLEmail(name, newBooks) }
      );
      Utilities.sleep(300); // stay well under Gmail's 100/day quota
    } catch (e) {
      console.error('Email failed for ' + email + ':', e);
    }
  }
}

function buildPlainEmail(name, books) {
  var list = books.map(function(b){
    return '• ' + b.title + ' by ' + b.author + '\n  ' + b.download_link;
  }).join('\n\n');
  return (
    'Hi ' + name + ',\n\n' +
    'New free eBooks just dropped on the Axitos Free Book Club!\n\n' +
    list + '\n\n' +
    'Browse all free books: ' + CONFIG.BOOK_CLUB_URL + '\n\n' +
    'Happy reading,\nThe Axitos Team'
  );
}

function buildHTMLEmail(name, books) {
  var cards = books.map(function(b) {
    return (
      '<table cellpadding="0" cellspacing="0" width="100%" style="margin-bottom:20px;padding-bottom:20px;border-bottom:1px solid #f0f0f0">' +
        '<tr>' +
          '<td width="76" valign="top">' +
            '<img src="' + b.cover_url + '" width="68" style="border-radius:6px;display:block;box-shadow:0 2px 8px rgba(0,0,0,0.12)">' +
          '</td>' +
          '<td valign="top" style="padding-left:16px">' +
            '<div style="font-size:15px;font-weight:700;color:#1a1a1a;line-height:1.3">' + b.title + '</div>' +
            '<div style="font-size:13px;color:#888;margin:4px 0 10px">' + b.author + '</div>' +
            '<span style="background:#f0ebff;color:#5c3d99;font-size:11px;font-weight:700;padding:3px 8px;border-radius:4px;margin-bottom:10px;display:inline-block">FREE ebook</span><br>' +
            '<a href="' + b.download_link + '" style="background:#5c3d99;color:#fff;padding:7px 16px;border-radius:6px;text-decoration:none;font-size:13px;font-weight:600;display:inline-block;margin-top:8px">Get Free Book →</a>' +
          '</td>' +
        '</tr>' +
      '</table>'
    );
  }).join('');

  return (
    '<!DOCTYPE html><html><body style="margin:0;padding:0;background:#f5f3ff;font-family:sans-serif">' +
    '<table width="100%" cellpadding="0" cellspacing="0" bgcolor="#f5f3ff"><tr><td align="center" style="padding:32px 16px">' +
    '<table width="560" cellpadding="0" cellspacing="0" bgcolor="#ffffff" style="border-radius:14px;overflow:hidden;max-width:100%;box-shadow:0 4px 24px rgba(92,61,153,0.1)">' +

    // Header
    '<tr><td bgcolor="#5c3d99" style="padding:30px 32px;text-align:center">' +
      '<div style="font-size:36px">📚</div>' +
      '<div style="color:#fff;font-size:22px;font-weight:700;margin-top:8px">Axitos Free Book Club</div>' +
      '<div style="color:rgba(255,255,255,0.75);font-size:14px;margin-top:6px">New free eBooks just dropped!</div>' +
    '</td></tr>' +

    // Body
    '<tr><td style="padding:30px 32px">' +
      '<p style="margin:0 0 6px;font-size:16px;color:#333">Hi ' + name + ',</p>' +
      '<p style="margin:0 0 24px;font-size:14px;color:#666">These eBooks are now available for free — grab them while they last:</p>' +
      cards +
      '<div style="text-align:center;margin-top:28px">' +
        '<a href="' + CONFIG.BOOK_CLUB_URL + '" style="background:#5c3d99;color:#fff;padding:14px 36px;border-radius:8px;text-decoration:none;font-size:15px;font-weight:700;display:inline-block">Browse All Free Books</a>' +
      '</div>' +
    '</td></tr>' +

    // Footer
    '<tr><td style="padding:20px 32px;text-align:center;border-top:1px solid #f0f0f0">' +
      '<span style="font-size:12px;color:#bbb">You\'re receiving this because you joined the Axitos Book Club.<br>© Axitos AI · <a href="' + CONFIG.BOOK_CLUB_URL + '" style="color:#bbb">Visit site</a></span>' +
    '</td></tr>' +

    '</table></td></tr></table></body></html>'
  );
}
