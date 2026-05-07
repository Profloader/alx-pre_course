// ─── AXITOS BOOK CLUB — Apps Script Backend ───────────────────────────────────
// Deploy as Web App: Execute as Me | Anyone can access
// Set a daily time trigger on checkAndNotifyNewBooks() for email alerts
// ─────────────────────────────────────────────────────────────────────────────

var CONFIG = {
  SHEET_ID:           '1uvBJcTGdhKSR1p4JT5wULZcZjtpjulE9TdgpsftO8ic',
  MEMBERS_SHEET:      'Members',
  BOOK_CLUB_URL:      'https://www.axitos.ai/book-club',

  // Primary publisher — shows first. Switch to Axitos Publishing when ready.
  PRIMARY_PUBLISHER:  'Kharis Publishing',

  // Axitos books (empty publisher = skip that search for now)
  AXITOS_PUBLISHER:   'Axitos Publishing',

  MAX_PRICE:          10,    // show ebooks at or below this price (USD)
  MAX_BOOKS:          12     // total cards on the page
};

// ─── WEB APP ENDPOINT ─────────────────────────────────────────────────────────
function doGet(e) {
  var books  = buildBookList();
  var output = ContentService.createTextOutput(JSON.stringify(books));
  output.setMimeType(ContentService.MimeType.JSON);
  return output;
}

// ─── BOOK LIST BUILDER ────────────────────────────────────────────────────────
// Priority: Axitos books first → Kharis fills remaining slots
function buildBookList() {
  var axitosBooks = fetchPublisherBooks(CONFIG.AXITOS_PUBLISHER, CONFIG.MAX_PRICE);
  var needed      = CONFIG.MAX_BOOKS - axitosBooks.length;
  var primary     = needed > 0
    ? fetchPublisherBooks(CONFIG.PRIMARY_PUBLISHER, CONFIG.MAX_PRICE, needed)
    : [];
  return axitosBooks.concat(primary);
}

// ─── GOOGLE BOOKS API FETCH ───────────────────────────────────────────────────
// Google Books API is free, no key required for up to 1000 req/day.
// Apps Script runs on Google infrastructure so this call is never blocked.
function fetchPublisherBooks(publisher, maxPrice, limit) {
  if (!publisher) return [];
  limit = limit || CONFIG.MAX_BOOKS;

  try {
    var url = 'https://www.googleapis.com/books/v1/volumes?'
      + 'q='          + encodeURIComponent('inpublisher:"' + publisher + '"')
      + '&filter=ebooks'
      + '&printType=books'
      + '&langRestrict=en'
      + '&maxResults=40';

    var res = UrlFetchApp.fetch(url, { muteHttpExceptions: true });
    if (res.getResponseCode() !== 200) {
      console.error('Google Books API error:', res.getResponseCode(), res.getContentText().substring(0, 200));
      return [];
    }

    var data  = JSON.parse(res.getContentText());
    var items = data.items || [];
    var books = [];

    for (var i = 0; i < items.length && books.length < limit; i++) {
      var item = items[i];
      var info = item.volumeInfo || {};
      var sale = item.saleInfo   || {};

      var isFree    = sale.saleability === 'FREE';
      var isForSale = sale.saleability === 'FOR_SALE';
      if (!isFree && !isForSale) continue;

      var price = (isForSale && sale.listPrice) ? sale.listPrice.amount : 0;
      if (price > maxPrice) continue;

      // Require a cover image — skip books without one
      var imgs      = info.imageLinks || {};
      var thumbnail = (imgs.thumbnail || imgs.smallThumbnail || '').replace('http://', 'https://');
      if (!thumbnail) continue;

      // Build Amazon Kindle search link from ISBN (most reliable)
      var isbn = extractISBN(info.industryIdentifiers || []);
      var amazonLink = 'https://www.amazon.com/s?i=digital-text&k='
        + encodeURIComponent(isbn || info.title || '');

      books.push({
        id:            item.id,
        title:         info.title || '',
        author:        (info.authors || []).join(', '),
        cover_url:     thumbnail,
        download_link: amazonLink,
        price:         price === 0 ? 'Free' : '$' + price.toFixed(2),
        price_num:     price
      });
    }

    console.log('fetchPublisherBooks(' + publisher + '): found ' + books.length + ' books');
    return books;

  } catch (e) {
    console.error('fetchPublisherBooks(' + publisher + '):', e);
    return [];
  }
}

function extractISBN(identifiers) {
  var isbn13 = '', isbn10 = '';
  for (var i = 0; i < identifiers.length; i++) {
    if (identifiers[i].type === 'ISBN_13') isbn13 = identifiers[i].identifier;
    if (identifiers[i].type === 'ISBN_10') isbn10 = identifiers[i].identifier;
  }
  return isbn13 || isbn10;
}

// ─── EMAIL NOTIFICATION ───────────────────────────────────────────────────────
// Trigger: Apps Script → Triggers → checkAndNotifyNewBooks → Time-driven → Day
// First run seeds the cache; subsequent runs email members about new books only.
function checkAndNotifyNewBooks() {
  var props       = PropertiesService.getScriptProperties();
  var seenIdsJson = props.getProperty('seenBookIds');

  var currentBooks = buildBookList();
  var currentIds   = currentBooks.map(function (b) { return b.id; });

  if (!seenIdsJson) {
    // First run — save state, no email (avoids blasting members with all books)
    props.setProperty('seenBookIds', JSON.stringify(currentIds));
    console.log('First run: seeded ' + currentIds.length + ' book IDs. No email sent.');
    return;
  }

  var seenIds  = JSON.parse(seenIdsJson);
  var newBooks = currentBooks.filter(function (b) {
    return seenIds.indexOf(b.id) === -1;
  });

  if (newBooks.length > 0) {
    console.log('New books found: ' + newBooks.length + '. Sending emails...');
    sendMemberEmails(newBooks);
    props.setProperty('seenBookIds', JSON.stringify(currentIds));
  } else {
    console.log('No new books since last check.');
  }
}

// ─── EMAIL SENDER ─────────────────────────────────────────────────────────────
function sendMemberEmails(newBooks) {
  var ss    = SpreadsheetApp.openById(CONFIG.SHEET_ID);
  var sheet = ss.getSheetByName(CONFIG.MEMBERS_SHEET);
  if (!sheet) { console.error('Members sheet not found'); return; }

  var data = sheet.getDataRange().getValues();

  for (var i = 1; i < data.length; i++) {
    var email = (data[i][0] || '').toString().trim();
    var name  = (data[i][1] || 'Book Club Member').toString().trim();
    if (!email || email.indexOf('@') === -1) continue;

    try {
      GmailApp.sendEmail(
        email,
        '📚 New eBooks just added to Axitos Book Club!',
        buildPlainEmail(name, newBooks),
        { htmlBody: buildHTMLEmail(name, newBooks) }
      );
      Utilities.sleep(300); // stay under Gmail quota
    } catch (e) {
      console.error('Email failed for ' + email + ':', e);
    }
  }
}

function buildPlainEmail(name, books) {
  var list = books.map(function (b) {
    return '• ' + b.title + ' by ' + b.author
      + ' (' + b.price + ')\n  ' + b.download_link;
  }).join('\n\n');
  return 'Hi ' + name + ',\n\n'
    + 'New eBooks have just been added to the Axitos Book Club:\n\n'
    + list + '\n\n'
    + 'Browse them here: ' + CONFIG.BOOK_CLUB_URL + '\n\n'
    + 'Happy reading,\nThe Axitos Team';
}

function buildHTMLEmail(name, books) {
  var cards = books.map(function (b) {
    var isFree = b.price_num === 0;
    return (
      '<table cellpadding="0" cellspacing="0" width="100%" style="margin-bottom:20px;padding-bottom:20px;border-bottom:1px solid #f0f0f0">'
      + '<tr>'
      +   '<td width="76" valign="top">'
      +     '<img src="' + b.cover_url + '" width="68" style="border-radius:6px;display:block;box-shadow:0 2px 8px rgba(0,0,0,0.12)">'
      +   '</td>'
      +   '<td valign="top" style="padding-left:16px">'
      +     '<div style="font-size:15px;font-weight:700;color:#1a1a1a;line-height:1.3">' + b.title + '</div>'
      +     '<div style="font-size:13px;color:#888;margin:4px 0 6px">' + b.author + '</div>'
      +     '<span style="background:' + (isFree ? '#22c55e' : '#5c3d99') + ';color:#fff;font-size:11px;font-weight:700;padding:3px 8px;border-radius:4px;display:inline-block;margin-bottom:10px">'
      +       (isFree ? 'FREE' : b.price)
      +     '</span><br>'
      +     '<a href="' + b.download_link + '" style="background:#5c3d99;color:#fff;padding:7px 16px;border-radius:6px;text-decoration:none;font-size:13px;font-weight:600;display:inline-block;margin-top:6px">Find on Amazon →</a>'
      +   '</td>'
      + '</tr>'
      + '</table>'
    );
  }).join('');

  return '<!DOCTYPE html><html><body style="margin:0;padding:0;background:#f5f3ff;font-family:sans-serif">'
    + '<table width="100%" cellpadding="0" cellspacing="0" bgcolor="#f5f3ff"><tr><td align="center" style="padding:32px 16px">'
    + '<table width="560" cellpadding="0" cellspacing="0" bgcolor="#ffffff" style="border-radius:14px;overflow:hidden;max-width:100%;box-shadow:0 4px 24px rgba(92,61,153,0.1)">'
    + '<tr><td bgcolor="#5c3d99" style="padding:30px 32px;text-align:center">'
    +   '<div style="font-size:36px">📚</div>'
    +   '<div style="color:#fff;font-size:22px;font-weight:700;margin-top:8px">Axitos Book Club</div>'
    +   '<div style="color:rgba(255,255,255,0.75);font-size:14px;margin-top:6px">New eBooks just added!</div>'
    + '</td></tr>'
    + '<tr><td style="padding:30px 32px">'
    +   '<p style="margin:0 0 6px;font-size:16px;color:#333">Hi ' + name + ',</p>'
    +   '<p style="margin:0 0 24px;font-size:14px;color:#666">These eBooks were just added to your Book Club:</p>'
    +   cards
    +   '<div style="text-align:center;margin-top:28px">'
    +     '<a href="' + CONFIG.BOOK_CLUB_URL + '" style="background:#5c3d99;color:#fff;padding:14px 36px;border-radius:8px;text-decoration:none;font-size:15px;font-weight:700;display:inline-block">Browse All Books</a>'
    +   '</div>'
    + '</td></tr>'
    + '<tr><td style="padding:20px 32px;text-align:center;border-top:1px solid #f0f0f0">'
    +   '<span style="font-size:12px;color:#bbb">You\'re receiving this because you joined the Axitos Book Club.<br>© Axitos AI</span>'
    + '</td></tr>'
    + '</table></td></tr></table></body></html>';
}
