// ─── AXITOS BOOK CLUB — Apps Script Backend ───────────────────────────────────
// Deploy as Web App: Execute as Me | Anyone can access
// Set a daily time trigger on checkAndNotifyNewBooks() for email alerts
// ─────────────────────────────────────────────────────────────────────────────

var CONFIG = {
  SHEET_ID:           '1uvBJcTGdhKSR1p4JT5wULZcZjtpjulE9TdgpsftO8ic',
  MEMBERS_SHEET:      'Members',
  BOOK_CLUB_URL:      'https://www.axitos.ai/book-club',

  // Fallback only — get free key at console.cloud.google.com → Enable "Books API" → Credentials → API key
  GOOGLE_BOOKS_API_KEY: '',

  // Primary publisher — shows first. Switch to Axitos Publishing when ready.
  PRIMARY_PUBLISHER:  'Kharis Publishing',

  // Axitos books (empty publisher = skip for now)
  AXITOS_PUBLISHER:   'Axitos Publishing',

  // 0.99 = Kharis test threshold. Change to 0 once Axitos publishes free books.
  MAX_PRICE:          0.99,
  MAX_BOOKS:          12    // total cards on the page
};

// ─── WEB APP ENDPOINT ─────────────────────────────────────────────────────────
function doGet(e) {
  var cache  = CacheService.getScriptCache();
  var cached = cache.get('bookList');

  if (cached && cached !== '[]') {
    var out = ContentService.createTextOutput(cached);
    out.setMimeType(ContentService.MimeType.JSON);
    return out;
  }

  var books = buildBookList();
  var json  = JSON.stringify(books);

  // Only cache a non-empty result so a bad cold-start never blocks for 6 hours
  if (books.length > 0) {
    cache.put('bookList', json, 21600); // 6 hours
  }

  var out = ContentService.createTextOutput(json);
  out.setMimeType(ContentService.MimeType.JSON);
  return out;
}

// Run this once in the Apps Script editor any time you want to force a fresh fetch
function clearCache() {
  CacheService.getScriptCache().remove('bookList');
  console.log('Cache cleared — next doGet will re-scrape Amazon.');
}

// ─── BOOK LIST BUILDER ────────────────────────────────────────────────────────
function buildBookList() {
  var axitosBooks = fetchAmazonBooks(CONFIG.AXITOS_PUBLISHER, CONFIG.MAX_PRICE);
  var needed      = CONFIG.MAX_BOOKS - axitosBooks.length;
  var primary     = needed > 0
    ? fetchAmazonBooks(CONFIG.PRIMARY_PUBLISHER, CONFIG.MAX_PRICE, needed)
    : [];
  return axitosBooks.concat(primary);
}

// ─── PRIMARY: AMAZON KINDLE SEARCH SCRAPING ───────────────────────────────────
function fetchAmazonBooks(publisher, maxPrice, limit) {
  if (!publisher) return [];
  limit = limit || CONFIG.MAX_BOOKS;

  var maxCents = Math.round(maxPrice * 100);
  var url = 'https://www.amazon.com/s'
    + '?k='  + encodeURIComponent('"' + publisher + '"')
    + '&i=digital-text'                                    // Kindle store
    + '&s=date-desc-rank'                                  // newest first
    + '&rh=' + encodeURIComponent('p_36:0-' + maxCents);  // price 0 – maxPrice

  try {
    var res = UrlFetchApp.fetch(url, {
      headers: {
        'User-Agent':      'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36',
        'Accept':          'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        'Accept-Language': 'en-US,en;q=0.9',
        'Sec-Fetch-Dest':  'document',
        'Sec-Fetch-Mode':  'navigate',
        'Sec-Fetch-Site':  'none'
      },
      muteHttpExceptions: true
    });

    var code = res.getResponseCode();
    if (code !== 200) {
      console.warn('Amazon ' + code + ' for "' + publisher + '" — trying Google Books');
      return fetchGoogleBooks(publisher, maxPrice, limit);
    }

    var html = res.getContentText();

    // Detect CAPTCHA / bot wall
    if (/captcha|robot check|ap-captcha/i.test(html)) {
      console.warn('Amazon CAPTCHA for "' + publisher + '" — trying Google Books');
      return fetchGoogleBooks(publisher, maxPrice, limit);
    }

    var books = parseAmazonResults(html, maxPrice, limit);
    console.log('Amazon("' + publisher + '"): ' + books.length + ' books');

    if (books.length === 0) {
      console.warn('Amazon returned 0 results for "' + publisher + '" — trying Google Books');
      return fetchGoogleBooks(publisher, maxPrice, limit);
    }

    return books;

  } catch (e) {
    console.error('Amazon exception for "' + publisher + '":', e);
    return fetchGoogleBooks(publisher, maxPrice, limit);
  }
}

function parseAmazonResults(html, maxPrice, limit) {
  var books = [];
  var seen  = {};

  // Locate each product card by its data-asin attribute
  var re = /data-asin="([A-Z0-9]{10})"/g;
  var positions = [];
  var m;
  while ((m = re.exec(html)) !== null) {
    positions.push({ asin: m[1], idx: m.index });
  }

  for (var i = 0; i < positions.length && books.length < limit; i++) {
    var asin = positions[i].asin;
    if (!asin || seen[asin]) continue;
    seen[asin] = true;

    // Slice ~6 KB around this card (enough for one result, not too much)
    var start = positions[i].idx;
    var end   = positions[i + 1] ? positions[i + 1].idx : start + 6000;
    var block = html.substring(start, Math.min(end, start + 6000));

    // Skip sponsored / ad placements
    if (/AdHolder|s-sponsored-label|sponsoredUx/i.test(block)) continue;

    // Title ── the main clickable link text
    var titleM = block.match(/class="[^"]*a-text-normal[^"]*">([^<]{3,150})</);
    if (!titleM) continue;
    var title = titleM[1].trim();

    // Cover image ── strip Amazon size tokens (e.g. ._AC_SY160_) for full resolution
    var imgM = block.match(/class="[^"]*s-image[^"]*"\s[^>]*src="([^"]+)"/);
    if (!imgM) imgM = block.match(/src="([^"]+)"\s[^>]*class="[^"]*s-image[^"]*"/);
    var coverUrl = imgM
      ? imgM[1].replace(/\._[A-Z0-9,_]+_(?=\.[a-z]+)/i, '')
      : 'https://images-na.ssl-images-amazon.com/images/P/' + asin + '.01.LZZZZZZZ.jpg';

    // Author ── secondary-color text near the title row
    var authorM = block.match(/class="[^"]*a-size-base[^"]*a-color-secondary[^"]*">([^<]{2,80})</);
    var author = authorM ? authorM[1].trim().replace(/^by\s+/i, '') : '';

    // Price ── aria-hidden price span carries the display value
    var priceNum = 0;
    var priceStr = 'Free';
    var priceM   = block.match(/aria-hidden="true"[^>]*>([\$£€][\d,.]+)</);
    if (priceM) {
      priceNum = parseFloat(priceM[1].replace(/[^\d.]/g, '')) || 0;
      if (priceNum > maxPrice) continue;
      priceStr = priceNum === 0 ? 'Free' : '$' + priceNum.toFixed(2);
    }

    books.push({
      id:            asin,
      title:         title,
      author:        author,
      cover_url:     coverUrl,
      download_link: 'https://www.amazon.com/dp/' + asin,  // direct product page
      price:         priceStr,
      price_num:     priceNum
    });
  }

  return books;
}

// ─── FALLBACK: GOOGLE BOOKS API ───────────────────────────────────────────────
function fetchGoogleBooks(publisher, maxPrice, limit) {
  if (!publisher) return [];
  limit = limit || CONFIG.MAX_BOOKS;

  try {
    var url = 'https://www.googleapis.com/books/v1/volumes?'
      + 'q='          + encodeURIComponent('inpublisher:"' + publisher + '"')
      + '&filter=ebooks'
      + '&printType=books'
      + '&langRestrict=en'
      + '&maxResults=40'
      + (CONFIG.GOOGLE_BOOKS_API_KEY ? '&key=' + CONFIG.GOOGLE_BOOKS_API_KEY : '');

    var res = UrlFetchApp.fetch(url, { muteHttpExceptions: true });
    if (res.getResponseCode() !== 200) {
      console.error('Google Books API error:', res.getResponseCode());
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

      var imgs      = info.imageLinks || {};
      var thumbnail = (imgs.thumbnail || imgs.smallThumbnail || '').replace('http://', 'https://');
      if (!thumbnail) continue;

      var isbn = extractISBN(info.industryIdentifiers || []);
      books.push({
        id:            item.id,
        title:         info.title || '',
        author:        (info.authors || []).join(', '),
        cover_url:     thumbnail,
        download_link: 'https://www.amazon.com/s?i=digital-text&k=' + encodeURIComponent(isbn || info.title || ''),
        price:         price === 0 ? 'Free' : '$' + price.toFixed(2),
        price_num:     price
      });
    }

    console.log('Google Books("' + publisher + '"): ' + books.length + ' books');
    return books;

  } catch (e) {
    console.error('Google Books exception for "' + publisher + '":', e);
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
function checkAndNotifyNewBooks() {
  var props       = PropertiesService.getScriptProperties();
  var seenIdsJson = props.getProperty('seenBookIds');

  var currentBooks = buildBookList();
  var currentIds   = currentBooks.map(function (b) { return b.id; });

  if (!seenIdsJson) {
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
      Utilities.sleep(300);
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
      +     '<a href="' + b.download_link + '" style="background:#5c3d99;color:#fff;padding:7px 16px;border-radius:6px;text-decoration:none;font-size:13px;font-weight:600;display:inline-block;margin-top:6px">View on Amazon →</a>'
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
