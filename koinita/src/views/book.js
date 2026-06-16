// Source file — assembled into koinita-duda.html
// Production: swap localStorage (DB.*) calls for Supabase queries.

function viewBook(id){
  const b = bookById(id); const m=me();
  if(!b) return notFound();
  const fs = freeState(b);
  const author = b.authorUserId ? userById(b.authorUserId) : null;
  const onShelf = m && m.shelf.includes(b.id);
  const isMyBook = m && m.role==='author' && b.authorUserId===m.id;

  // author block: claimed vs unclaimed
  let authorBlock;
  if(author){
    authorBlock = `<div class="author-card" onclick="go('author','${author.id}')">
        <div class="av" style="background:${author.avatar}">${initials(author.name)}</div>
        <div><b>${esc(author.name)} <span class="chip verified" style="font-size:10px">✓ Verified author</span></b>
        <span>${DB.books.filter(x=>x.authorUserId===author.id).length} books in the club · tap to view profile</span></div>
      </div>`;
  } else {
    const canClaim = m && m.role==='author';
    authorBlock = `<div class="author-card" style="background:var(--paper-2);border-color:var(--line)">
        <div class="av" style="background:var(--ink-faint)">?</div>
        <div style="flex:1"><b>Author not connected yet</b>
        <span style="color:var(--ink-soft)">This book isn't linked to its author's profile.</span></div>
        ${canClaim?`<button class="btn btn-spine btn-sm" onclick="claimBook('${b.id}')">This is my book</button>`:''}
      </div>`;
  }

  // reader action panel
  let claimPanel='';
  if(m && m.role==='reader'){
    const claimedChip = onShelf?`<span class="chip dot live">Claimed · on your shelf</span>`:'';
    const haveItBtn = onShelf?'':`<button class="btn btn-ghost btn-sm" onclick="markClaimed('${b.id}')">I already have it</button>`;
    if(fs.state==='live'){
      claimPanel = `<a class="btn btn-amber" href="${b.amazonUrl}" target="_blank" rel="noopener" onclick="claimShelf('${b.id}')">Get it free on Kindle →</a>
        ${claimedChip||haveItBtn}`;
    } else if(fs.state==='soon'){
      claimPanel = `<button class="btn btn-ghost" onclick="remindMe('${b.id}')">🔔 Remind me when it drops</button>
        ${claimedChip||haveItBtn}`;
    } else {
      claimPanel = `<button class="btn btn-ghost" disabled>Free window closed</button>
        <a class="btn btn-ghost btn-sm" href="${b.amazonUrl}" target="_blank" rel="noopener">View on Amazon</a>
        ${claimedChip||haveItBtn}`;
    }
  } else if(m && m.role==='author'){
    claimPanel = `<a class="btn btn-ghost" href="${b.amazonUrl}" target="_blank" rel="noopener">View on Amazon</a>
      ${isMyBook?`<button class="btn btn-ghost btn-sm" onclick="openEditFree('${b.id}')">Edit free window</button>`:''}`;
  } else {
    claimPanel = `<button class="btn btn-amber" onclick="openAuth('signup')">Join free to claim →</button>`;
  }

  return `<div class="app"><div class="wrap">
    <button class="btn btn-ghost btn-sm" style="margin-bottom:22px" onclick="history.length>1?history.back():go('discover')">← Back</button>
    <div class="detail">
      <div class="cover" style="${coverStyle(b.cover)}">
        ${fs.state==='live'?`<div class="badge">FREE NOW</div>`:''}
        <div class="k">Koinita · First edition</div>
        <div><div class="ct" style="font-size:26px">${esc(b.title)}</div></div>
      </div>
      <div>
        <span class="chip genre">${esc(b.genre)}</span>
        <span class="chip ${fs.state==='live'?'live dot':''}">${fs.txt}</span>
        <h1>${esc(b.title)}</h1>
        <p style="color:var(--ink-soft);font-size:15px;margin:0">by ${esc(b.authorName||'Unclaimed author')}</p>
        <p class="blurb">${esc(b.blurb)}</p>
        <div class="actions">${claimPanel}</div>

        ${authorBlock}

        ${m ? circlePanel(b) : ''}
        ${m && m.role==='reader' ? feedbackPanel(b, author, onShelf) : ''}
        ${m ? reviewDisclaimer('member') : ''}
      </div>
    </div>
  </div></div>`;
}

/* Reading-circle entry point on a book page */
function circlePanel(b){
  const m=me();
  const c=DB.circles.find(x=>x.bookId===b.id);
  const claimed = m.role==='author'? (b.authorUserId===m.id) : m.shelf.includes(b.id);
  if(c){
    const member=c.memberIds.includes(m.id);
    return `<div class="panel"><h3>○ Reading circle</h3>
      <p class="sub">${esc(c.name)} · ${c.memberIds.length} ${c.memberIds.length===1?'member':'members'}</p>
      ${member?`<button class="btn btn-spine btn-sm" onclick="go('circle','${c.id}')">Open circle</button>`
        : claimed?`<button class="btn btn-spine btn-sm" onclick="joinCircle('${c.id}')">Join the circle</button>`
        :`<p style="font-size:13px;color:var(--ink-faint);margin:0">Claim this book to join its reading circle.</p>`}</div>`;
  }
  if(claimed){
    return `<div class="panel"><h3>○ Reading circle</h3>
      <p class="sub">No circle yet for this book. Start a small, text-only group to read it together.</p>
      <button class="btn btn-spine btn-sm" onclick="startCircle('${b.id}')">Start a reading circle</button></div>`;
  }
  return '';
}

/* Structured feedback + one question, gated by the claimed-book rule.
   Readers who haven't claimed the book cannot open a thread — this is the
   keystone anti-spam control (no claim, no contact). One thread per reader-book. */
let fbRating = 0;
function setRating(n){ fbRating=n;
  for(let i=1;i<=5;i++){ const el=document.getElementById('star'+i); if(el) el.textContent = i<=n?'★':'☆'; } }

function feedbackPanel(b, author, onShelf){
  const m=me();
  if(!author){
    return `<div class="panel"><h3>Share feedback with the author</h3>
      <p class="sub">Once this book is connected to its author, claimed readers can leave feedback and one question here.</p></div>`;
  }
  const first = esc(author.name.split(' ')[0]);
  // Gate: must have claimed the book
  if(!onShelf){
    return `<div class="panel" style="border-style:dashed">
      <h3>🔒 Claim this book to share feedback</h3>
      <p class="sub">Feedback comes only from real readers who have the book. Claim it above (or mark "I already have it") to send ${first} your thoughts and one question.</p>
    </div>`;
  }
  // One thread per reader-book — if it exists, show it
  const existing = DB.threads.find(t=>t.bookId===b.id && t.readerId===m.id && t.authorUserId===author.id);
  if(existing){
    return `<div class="panel"><h3>Your feedback & conversation with ${first}</h3>
      <p class="sub">You've shared feedback on this book. Continue the conversation below.</p>
      ${threadBlock(existing,'reader')}</div>`;
  }
  // New structured feedback form
  fbRating = 0;
  return `<div class="panel">
    <h3>Share feedback with ${first}</h3>
    <p class="sub">Rate the book, tell ${first} what landed, and ask one question. ${first} replies in-app. We screen every note automatically before it's delivered.</p>
    <div class="field"><label>Your rating</label>
      <div id="stars" style="font-size:28px;color:var(--amber);cursor:pointer;letter-spacing:6px" role="radiogroup" aria-label="Rating">
        ${[1,2,3,4,5].map(i=>`<span id="star${i}" onclick="setRating(${i})" tabindex="0" role="radio" aria-label="${i} star">☆</span>`).join('')}
      </div></div>
    <div class="field"><label>What worked for you?</label><textarea id="fb_liked" placeholder="The part that landed, a moment you loved…"></textarea></div>
    <div class="field"><label>What could be better? <span style="font-weight:400;color:var(--ink-faint)">(optional, kept honest)</span></label><textarea id="fb_improve" placeholder="Honest, constructive — the author wants the real thing."></textarea></div>
    <div class="field"><label>One question for ${first} <span style="font-weight:400;color:var(--ink-faint)">(optional)</span></label><input id="fb_question" placeholder="One thing you'd love to ask the author"></div>
    <button class="btn btn-spine" onclick="submitFeedback('${b.id}')">Send feedback to ${first} →</button>
  </div>`;
}

/* Automated moderation gate (prototype heuristic).
   PRODUCTION: replace with a server-side call to the OpenAI Moderation
   endpoint (free) before insert; flagged → block with a rephrase prompt.
   Links are stripped because they're the main spam payload. */
function moderate(text){
  const t = text||'';
  const stripped = t.replace(/\bhttps?:\/\/\S+|\bwww\.\S+|\b[\w-]+\.(com|net|org|io|co|ru|xyz|link|info|biz)\b\S*/gi,'[link removed]');
  const linkRemoved = stripped!==t;
  const lower = t.toLowerCase();
  const banned = ['viagra','crypto airdrop','free money','click here to win','make money fast','kill yourself','sex chat'];
  if(banned.some(w=>lower.includes(w))) return {ok:false, reason:'That note looks like it may breach our community guidelines. Please rephrase and try again.'};
  const letters = t.replace(/[^A-Za-z]/g,'');
  if(letters.length>20 && (t.replace(/[^A-Z]/g,'').length/letters.length)>0.8) return {ok:false, reason:'Please don\u2019t write in all caps — try again in normal case.'};
  return {ok:true, clean:stripped, linkRemoved};
}
