/**
 * Book Club Social Proof Popup Widget
 *
 * Reads the latest signup from a published Google Sheet CSV and shows
 * a "Jane just joined!" or "Jane has joined!" notification to
 * non-authenticated visitors on the home page and Book Club landing page.
 *
 * Setup:
 *   1. Publish your Google Sheet: File → Share → Publish to web → CSV
 *   2. Replace SHEET_CSV_URL with the published CSV link
 *   3. Paste this script into the custom body code of the home page
 *      AND the First Edition Book Club landing page only
 */

(function () {
  // ─── CONFIG ──────────────────────────────────────────────────────────────
  var SHEET_CSV_URL = "https://docs.google.com/spreadsheets/d/e/2PACX-1vSlMvi9MKODUmniC_9UjQliUOmjcqGIwUXjNcX0xUL1sA-gOHZW3TNvYxQTzQ_H4WLJHeWSZvU8Nm4P/pub?gid=0&single=true&output=csv";
  var SIGNUP_PAGE_URL = "https://www.axitos.ai/first-edition-book-club";

  // Pages where the popup is allowed to appear (pathname matching)
  var ALLOWED_PATHS = [
    "/",                          // home page
    "/first-edition-book-club",   // Book Club landing page
  ];

  // Column indices in your sheet (0-based). Adjust to match your columns.
  var COL_NAME      = 0;  // e.g. "First Name" column
  var COL_TIMESTAMP = 1;  // e.g. "Timestamp" column

  // How many milliseconds after page load before the popup appears
  var SHOW_DELAY_MS = 4000;

  // How many milliseconds the popup stays visible before auto-dismissing
  var AUTO_HIDE_MS = 8000;

  // Signups within this many hours use "just joined"; older ones use "has joined"
  var JUST_JOINED_HOURS = 2;

  // Only show the popup if the latest signup happened within this many hours
  var MAX_AGE_HOURS = 72;
  // ─────────────────────────────────────────────────────────────────────────

  function isAllowedPage() {
    var path = window.location.pathname.replace(/\/$/, "") || "/";
    for (var i = 0; i < ALLOWED_PATHS.length; i++) {
      var allowed = ALLOWED_PATHS[i].replace(/\/$/, "") || "/";
      if (path === allowed) return true;
    }
    return false;
  }

  function isMemberLoggedIn() {
    for (var i = 0; i < localStorage.length; i++) {
      var key = localStorage.key(i);
      if (key && key.startsWith("firebase:authUser")) return true;
    }
    return false;
  }

  function parseCSV(text) {
    var lines = text.trim().split("\n");
    if (lines.length < 2) return null;
    var rows = [];
    for (var i = 1; i < lines.length; i++) {
      var cols = lines[i].split(",").map(function (c) {
        return c.replace(/^"|"$/g, "").trim();
      });
      if (cols[COL_NAME]) rows.push(cols);
    }
    return rows.length ? rows[rows.length - 1] : null;
  }

  function getJoinedPhrase(timestampStr) {
    if (!timestampStr) return "just joined"; // no timestamp → default to "just joined"
    var ts = new Date(timestampStr).getTime();
    if (isNaN(ts)) return "just joined";
    var ageMs = Date.now() - ts;
    if (ageMs > MAX_AGE_HOURS * 3600 * 1000) return null;  // too old, don't show
    if (ageMs <= JUST_JOINED_HOURS * 3600 * 1000) return "just joined";
    return "has joined";
  }

  function createPopup(name, phrase) {
    var popup = document.createElement("div");
    popup.id = "axitos-bc-popup";
    popup.style.cssText = [
      "position:fixed",
      "bottom:24px",
      "left:24px",
      "z-index:99999",
      "background:#fff",
      "border-left:4px solid #5c3d99",
      "border-radius:8px",
      "box-shadow:0 4px 20px rgba(0,0,0,0.15)",
      "padding:14px 18px",
      "max-width:280px",
      "font-family:sans-serif",
      "font-size:14px",
      "color:#222",
      "display:flex",
      "align-items:flex-start",
      "gap:10px",
      "cursor:pointer",
      "transition:opacity 0.4s ease,transform 0.4s ease",
      "opacity:0",
      "transform:translateY(12px)",
    ].join(";");

    var icon = document.createElement("div");
    icon.textContent = "📚";
    icon.style.cssText = "font-size:22px;flex-shrink:0;margin-top:2px";

    var body = document.createElement("div");

    var msg = document.createElement("div");
    msg.style.cssText = "font-weight:600;margin-bottom:4px";
    msg.textContent = (name || "Someone") + " " + phrase + " the Book Club!";

    var cta = document.createElement("a");
    cta.href = SIGNUP_PAGE_URL;
    cta.textContent = "Join them →";
    cta.style.cssText = "color:#5c3d99;font-size:13px;text-decoration:none";

    var close = document.createElement("button");
    close.textContent = "×";
    close.style.cssText = [
      "position:absolute",
      "top:6px",
      "right:8px",
      "background:none",
      "border:none",
      "font-size:16px",
      "color:#999",
      "cursor:pointer",
      "line-height:1",
    ].join(";");
    close.setAttribute("aria-label", "Close");
    close.addEventListener("click", function (e) {
      e.stopPropagation();
      hidePopup(popup);
    });

    body.appendChild(msg);
    body.appendChild(cta);
    popup.appendChild(icon);
    popup.appendChild(body);
    popup.appendChild(close);
    popup.style.position = "fixed";

    popup.addEventListener("click", function () {
      window.location.href = SIGNUP_PAGE_URL;
    });

    return popup;
  }

  function showPopup(popup) {
    document.documentElement.appendChild(popup);
    requestAnimationFrame(function () {
      requestAnimationFrame(function () {
        popup.style.opacity = "1";
        popup.style.transform = "translateY(0)";
      });
    });
    setTimeout(function () {
      hidePopup(popup);
    }, AUTO_HIDE_MS);
  }

  function hidePopup(popup) {
    popup.style.opacity = "0";
    popup.style.transform = "translateY(12px)";
    setTimeout(function () {
      if (popup.parentNode) popup.parentNode.removeChild(popup);
    }, 400);
  }

  function init() {
    if (!isAllowedPage()) return;        // only run on home + book club pages
    if (isMemberLoggedIn()) return;      // skip for signed-in members
    if (!SHEET_CSV_URL || SHEET_CSV_URL.includes("YOUR_PUBLISHED")) return;

    fetch(SHEET_CSV_URL)
      .then(function (res) {
        if (!res.ok) throw new Error("CSV fetch failed: " + res.status);
        return res.text();
      })
      .then(function (text) {
        var row = parseCSV(text);
        if (!row) return;

        var name   = row[COL_NAME];
        var phrase = getJoinedPhrase(row[COL_TIMESTAMP]);
        if (!phrase) return; // signup is too old

        var popup = createPopup(name, phrase);
        setTimeout(function () {
          showPopup(popup);
        }, SHOW_DELAY_MS);
      })
      .catch(function (err) {
        console.warn("[BookClubPopup]", err);
      });
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})();
