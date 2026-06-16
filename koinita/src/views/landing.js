// Source file — assembled into koinita-duda.html
// Production: swap localStorage (DB.*) calls for Supabase queries.

function viewLanding(){
  return `
  <section class="hero">
    <svg class="hero-deco" viewBox="0 0 400 340" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
      <defs>
        <linearGradient id="g1" x1="0" x2="1" y1="0" y2="1"><stop offset="0" stop-color="#2E5E4E"/><stop offset="1" stop-color="#1F4438"/></linearGradient>
        <linearGradient id="g2" x1="0" x2="1" y1="0" y2="1"><stop offset="0" stop-color="#D9541F"/><stop offset="1" stop-color="#A83B0F"/></linearGradient>
        <linearGradient id="g3" x1="0" x2="1" y1="0" y2="1"><stop offset="0" stop-color="#3A3D8C"/><stop offset="1" stop-color="#26285C"/></linearGradient>
      </defs>
      <rect x="36" y="70" width="120" height="170" rx="8" fill="url(#g3)" transform="rotate(-7 96 155)"/>
      <rect x="150" y="40" width="130" height="190" rx="8" fill="url(#g1)"/>
      <rect x="262" y="78" width="118" height="168" rx="8" fill="url(#g2)" transform="rotate(6 321 162)"/>
      <circle cx="215" cy="270" r="7" fill="#D9541F"/>
      <path d="M150 250 C 190 300, 240 300, 280 252" stroke="#241F19" stroke-width="2" stroke-dasharray="3 6" fill="none" opacity=".5"/>
      <text x="170" y="135" font-family="Fraunces" font-size="15" fill="#fff" opacity=".95">first</text>
      <text x="170" y="158" font-family="Fraunces" font-size="15" fill="#fff" opacity=".95">edition</text>
    </svg>
    <div class="wrap">
      <p class="eyebrow">Free membership · Full books · Real authors</p>
      <h1>Your next great read is <em>free</em> — and the author is listening.</h1>
      <p class="lede">Koinita is a free book club, not a deal-alert list. Members claim and keep full-length, first-edition new releases, read them on Kindle, Apple or Android, and talk directly with the authors who wrote them.</p>
      <div class="hero-cta">
        <button class="btn btn-amber" onclick="openAuth('signup')">Join the club — it's free →</button>
        <button class="btn btn-ghost" onclick="openAuthThen('discover')">Browse the shelf</button>
      </div>
      <p class="hero-note">✦ No credit card. No catch. Books are yours to keep.</p>
    </div>
  </section>

  <section class="strip">
    <div class="wrap">
      <div class="stat"><b>100%</b><span>Full-length books, never samples</span></div>
      <div class="stat"><b>$0.00</b><span>To join and to read</span></div>
      <div class="stat"><b>1-tap</b><span>Ask the author a question</span></div>
      <div class="stat"><b>9</b><span>Genres and growing</span></div>
    </div>
  </section>

  <section class="section">
    <div class="wrap">
      <div class="section-head">
        <p class="eyebrow">How it works</p>
        <h2>Three steps to a free book you keep for good.</h2>
        <p>Built around scheduled drops with live countdowns, so there is always something to claim — and always a reason to come back.</p>
      </div>
      <div class="steps">
        <div class="step"><div class="n">STEP 01</div><h3>Browse the members' shelf</h3><p>New titles across every genre, each with a live "free window" countdown so you never miss a drop.</p></div>
        <div class="step"><div class="n">STEP 02</div><h3>Claim it free on Kindle</h3><p>One tap takes you to the Amazon listing at $0.00. Add it to your library and read it on any Kindle-compatible device, including Apple.</p></div>
        <div class="step"><div class="n">STEP 03</div><h3>Tell the author</h3><p>Rate it, share what worked, and ask one question. The author reads it and replies — right here in the club.</p></div>
      </div>
    </div>
  </section>

  <section class="section" style="padding-top:0">
    <div class="wrap">
      <div class="section-head">
        <p class="eyebrow" style="color:var(--spine-deep)">Why it's different</p>
        <h2>A club, in fellowship with its authors.</h2>
      </div>
      <div class="features">
        <div class="feat green"><div class="ic">🔗</div><div><h3>Every book is bound to its author</h3><p>Tap any title to meet the person who wrote it. Their books become their identity here — and you can connect with them directly.</p></div></div>
        <div class="feat"><div class="ic">💬</div><div><h3>Structured feedback, one real question</h3><p>Not reviews-for-strangers. Rate the book, tell the author what landed, and ask one question they actually answer — all in-app.</p></div></div>
        <div class="feat green"><div class="ic">✍️</div><div><h3>Authors get their first true readers</h3><p>Writers join to meet the first wave of people reading their work, and to hear what landed and what didn't.</p></div></div>
        <div class="feat"><div class="ic">⚡</div><div><h3>First to know, first to read</h3><p>Early access to titles before they're widely known — the quiet thrill of finding a standout first.</p></div></div>
        <div class="feat green"><div class="ic">○</div><div><h3>A quiet literary network</h3><p>Follow authors and readers, read short notes from behind the page, and join small reading circles around a book. Text only, calm, and human.</p></div></div>
      </div>
    </div>
  </section>

  <section class="section compare">
    <div class="wrap">
      <div class="section-head"><p class="eyebrow">Koinita vs. the deal lists</p><h2>Free books are everywhere. A relationship with the author isn't.</h2></div>
      <table class="cmp">
        <tr><th>What you get</th><th>Typical deal-alert list</th><th>Koinita</th></tr>
        <tr><td>Full-length books to keep</td><td>Sometimes — often samples or limited deals</td><td class="koin">Always, full-length, yours forever</td></tr>
        <tr><td>Talk to the author</td><td>No</td><td class="koin">Yes — in-app, answered</td></tr>
        <tr><td>Author profiles & books linked</td><td>No</td><td class="koin">Built in</td></tr>
        <tr><td>Cost to join</td><td>Free</td><td class="koin">Free</td></tr>
      </table>
    </div>
  </section>

  <section class="section">
    <div class="wrap">
      <div class="quote">
        <p>"A reader lives a thousand lives before he dies. The one who never reads lives only one."</p>
        <cite>— George R.R. Martin</cite>
      </div>
    </div>
  </section>

  <section class="section" style="padding-top:0">
    <div class="wrap">
      <div class="cta-band">
        <h2>Start your first free read.</h2>
        <p>Create your free Koinita account and meet your next favourite book — and the author behind it.</p>
        <div style="display:flex;gap:12px;justify-content:center;flex-wrap:wrap">
          <button class="btn btn-amber" onclick="openAuth('signup','reader')">Join as a reader</button>
          <button class="btn btn-spine" onclick="openAuth('signup','author')">Join as an author</button>
        </div>
      </div>
    </div>
  </section>

  <footer><div class="wrap" style="flex-direction:column;align-items:flex-start;gap:8px">
    <div style="display:flex;justify-content:space-between;width:100%;gap:20px;flex-wrap:wrap;align-items:center">
      <a class="brand" style="font-size:18px" onclick="go('home')">Koinita<span class="dot"></span></a>
      <div>A reader club by Axitos Publishing House · © 2026 Axitos LLC</div>
    </div>
    <div style="font-size:12px;color:var(--ink-faint)">Koinita is an adults-only community (18+). Be kind; no adult content, harassment, spam, or solicitation. Posts are automatically moderated under our Community Guidelines.</div>
    ${reviewDisclaimer('footer')}
  </div></footer>`;
}
