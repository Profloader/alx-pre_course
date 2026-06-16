// Source file — assembled into koinita-duda.html
// Production: swap localStorage (DB.*) calls for Supabase queries.

function viewDashboard(){
  const m=me();
  return m.role==='author'? viewAuthorStudio() : viewReaderHome();
}

function viewReaderHome(){
  const m=me();
  const live = DB.books.filter(b=>freeState(b).state==='live');
  const soon = DB.books.filter(b=>freeState(b).state==='soon');
  const shelfCount = m.shelf.length;
  return `<div class="app"><div class="wrap">
    <div class="app-head">
      <div><h1>Welcome back, ${esc(m.name.split(' ')[0])}.</h1>
      <p>Your next free read is waiting. ${live.length} ${live.length===1?'title is':'titles are'} live right now.</p></div>
      <button class="btn btn-ghost btn-sm" onclick="go('shelf')">My shelf · ${shelfCount}</button>
    </div>

    <div class="subnav">
      <button class="active">Live now</button>
      <button onclick="go('discover')">Browse all</button>
      <button onclick="go('messages')">My conversations</button>
    </div>

    ${live.length? `<div class="grid">${live.map(bookCard).join('')}</div>`
      : `<div class="empty"><div class="ic">🌙</div><h3>No live drops this moment</h3><p>New titles drop on a schedule. Here's what's coming up next.</p></div>`}

    ${soon.length?`<h2 style="font-size:22px;margin:40px 0 18px">Coming soon</h2>
      <div class="grid">${soon.map(bookCard).join('')}</div>`:''}
  </div></div>`;
}

function viewAuthorStudio(){
  const m=me();
  const mine = DB.books.filter(b=>b.authorUserId===m.id);
  const threads = DB.threads.filter(t=>t.authorUserId===m.id);
  const open = threads.filter(t=>{ const last=t.messages[t.messages.length-1]; return !last || last.from==='reader'; }).length;
  const plan = planOf(m);
  const limit = listingLimit(m);
  const usage = limit===Infinity? `${mine.length} listings` : `${mine.length} of ${limit} listings`;
  const ratings = threads.filter(t=>t.rating>0).map(t=>t.rating);
  const avg = ratings.length? (ratings.reduce((a,b)=>a+b,0)/ratings.length).toFixed(1) : '—';
  const claims = DB.users.filter(u=>u.role==='reader' && u.shelf.some(id=>mine.find(b=>b.id===id))).length;

  // Analytics card is a paid feature; shown when gates are off OR the plan includes it.
  const analyticsCard = hasFeature(m,'analytics') ? `
      <div class="feat"><div class="ic">📈</div><div><h3>Your numbers</h3>
        <p>${claims} ${claims===1?'reader has':'readers have'} claimed your books · ${threads.length} feedback ${threads.length===1?'thread':'threads'} · ${avg}★ average rating.</p></div></div>`
    : `<div class="feat" style="opacity:.7"><div class="ic">🔒</div><div><h3>Analytics — Indie & Pro</h3>
        <p>See claims, feedback volume, and ratings over time. <button class="linkbtn" style="padding:0;color:var(--amber-deep);font-weight:600;text-decoration:underline;background:none;border:none;cursor:pointer" onclick="go('plans')">Upgrade to unlock →</button></p></div></div>`;

  return `<div class="app author-mode"><div class="wrap">
    <div class="app-head">
      <div><h1>${esc(m.name.split(' ')[0])}'s studio</h1>
      <p>Meet your readers and keep your shelf alive.</p></div>
      <button class="btn btn-spine btn-sm" onclick="openAddBook()">+ Add a book</button>
    </div>

    <div class="panel" style="margin-top:0;display:flex;justify-content:space-between;align-items:center;gap:14px;flex-wrap:wrap;padding:16px 20px">
      <div style="display:flex;align-items:center;gap:12px">
        <span class="chip" style="background:${plan.accent};color:#fff">${m.inhouse?'✦ ':''}${plan.name} plan</span>
        <span style="color:var(--ink-soft);font-size:14px">${usage}${m.inhouse?' · in-house, full access':''}</span>
      </div>
      ${m.inhouse?'' : `<button class="btn btn-ghost btn-sm" onclick="go('plans')">${gatesActive(m)?'Upgrade plan':'View plans'}</button>`}
    </div>

    <div class="subnav">
      <button class="active">Overview</button>
      <button onclick="go('mybooks')">My books · ${mine.length}</button>
      <button onclick="go('inbox')">Reader inbox · ${open} waiting</button>
      <button onclick="go('author','${m.id}')">Public page</button>
    </div>

    <div class="features" style="margin-bottom:28px">
      <div class="feat green"><div class="ic">📖</div><div><h3>${mine.length} ${mine.length===1?'book':'books'} on your shelf</h3><p>Each one is bound to your author page so readers can find and follow your work.</p></div></div>
      <div class="feat"><div class="ic">💬</div><div><h3>${open} ${open===1?'reader is':'readers are'} waiting</h3><p>Ratings, feedback, and questions from people reading you now. Reply in-app.</p></div></div>
      ${analyticsCard}
    </div>

    <h2 style="font-size:22px;margin:8px 0 18px">Your books</h2>
    ${mine.length? `<div class="grid">${mine.map(bookCard).join('')}</div>`
      : `<div class="empty"><div class="ic">✍️</div><h3>No books yet</h3><p>Add your first title, or claim one already in the club, to start meeting readers.</p>
         <button class="btn btn-spine" onclick="openAddBook()">+ Add a book</button></div>`}
  </div></div>`;
}
