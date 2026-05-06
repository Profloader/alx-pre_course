/**
 * Book Club Social Proof Popup Widget
 *
 * Reads the latest signup from a published Google Sheet CSV and shows
 * a "Jane just joined!" notification to non-authenticated visitors.
 *
 * Setup:
 *   1. Publish your Google Sheet: File → Share → Publish to web → CSV
 *   2. Replace SHEET_CSV_URL with the published CSV link
 *   3. Paste this script into your Duda site's custom body code
 */

(function () {
  // ─── CONFIG ──────────────────────────────────────────────────────────────
  var SHEET_CSV_URL = "YOUR_PUBLISHED_GOOGLE_SHEET_CSV_URL_HERE";
  var SIGNUP_PAGE_URL = "https://www.axitos.ai/signin";

  // Column indices in your sheet (0-based). Adjust to match your columns.
  var COL_NAME = 0;       // e.g. "First Name" column
  var COL_TIMESTAMP = 1;  // e.g. "Timestamp" column

  // How many seconds after page load before the popup appears
  var SHOW_DELAY_MS = 4000;

  // How many seconds the popup stays visible before auto-dismissing
  var AUTO_HIDE_MS = 8000;

  // Only show the popup if the latest signup happened within this many hours
  var MAX_AGE_HOURS = 72;
  // ─────────────────────────────────────────────────────────────────────────

  function isMemberLoggedIn() {
    // Firebase stores auth state in localStorage as 'firebase:authUser:<apiKey>:<appName>'
    for (var i = 0; i < localStorage.length; i++) {
      var key = localStorage.key(i);
      if (key && key.startsWith("firebase:authUser")) {
        return true;
      }
    }
    return false;
  }

  function parseCSV(text) {
    var lines = text.trim().split("\n");
    if (lines.length < 2) return null; // only header, no data rows

    var rows = [];
    for (var i = 1; i < lines.length; i++) {
      var cols = lines[i].split(",").map(function (c) {
        return c.replace(/^"|"$/g, "").trim();
      });
      if (cols[COL_NAME]) rows.push(cols);
    }
    return rows.length ? rows[rows.length - 1] : null; // return most recent row
  }

  function isRecent(timestampStr) {
    if (!timestampStr) return true; // no timestamp column → always show
    var ts = new Date(timestampStr).getTime();
    if (isNaN(ts)) return true;
    return Date.now() - ts < MAX_AGE_HOURS * 3600 * 1000;
  }

  function createPopup(name) {
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
    msg.textContent = (name || "Someone") + " just joined the Book Club!";

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
    popup.style.position = "fixed"; // ensure position:absolute from close btn works

    popup.addEventListener("click", function () {
      window.location.href = SIGNUP_PAGE_URL;
    });

    return popup;
  }

  function showPopup(popup) {
    document.body.appendChild(popup);
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
    if (isMemberLoggedIn()) return; // skip for signed-in members
    if (!SHEET_CSV_URL || SHEET_CSV_URL.includes("YOUR_PUBLISHED")) return; // not configured

    fetch(SHEET_CSV_URL)
      .then(function (res) {
        if (!res.ok) throw new Error("CSV fetch failed: " + res.status);
        return res.text();
      })
      .then(function (text) {
        var row = parseCSV(text);
        if (!row) return;

        var name = row[COL_NAME];
        var timestamp = row[COL_TIMESTAMP];

        if (!isRecent(timestamp)) return;

        var popup = createPopup(name);
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
