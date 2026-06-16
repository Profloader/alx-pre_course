// Source file — assembled into koinita-duda.html
// Production: swap localStorage (DB.*) calls for Supabase queries.

let discoverFilter = 'all';
function viewDiscover(){
  const m=me();
  let books = discoverFilter==='all'? DB.books.slice() : DB.books.filter(b=>b.genre===discoverFilter);
  // Featured drops (a paid-tier placement) surface first.
  books.sort((a,b)=> (b.featured?1:0)-(a.featured?1:0) || b.added-a.added );
  const genresInUse = ['all', ...Array.from(new Set(DB.books.map(b=>b.genre)))];
  return `<div class="app ${m&&m.role==='author'?'author-mode':''}"><div class="wrap">
    <div class="app-head"><div><h1>Discover</h1><p>Full-length books to claim and keep. Tap any cover to meet the author.</p></div></div>
    <div class="subnav">
      ${genresInUse.map(g=>`<button class="${discoverFilter===g?'active':''}" onclick="setFilter('${g}')">${g==='all'?'All genres':g}</button>`).join('')}
    </div>
    ${books.length?`<div class="grid">${books.map(bookCard).join('')}</div>`
      :`<div class="empty"><div class="ic">📭</div><h3>Nothing here yet</h3><p>No titles in this genre right now.</p></div>`}
  </div></div>`;
}
function setFilter(g){ discoverFilter=g; render(); }

function bookCard(b){
  const fs = freeState(b);
  const badge = b.featured?`<div class="badge" style="background:var(--spine);color:#fff">✦ FEATURED</div>`
              : fs.state==='live'?`<div class="badge">FREE NOW</div>`:'';
  return `<div class="book" onclick="go('book','${b.id}')">
    <div class="cover" style="${coverStyle(b.cover)}">
      ${badge}
      <div class="k">Koinita · First edition</div>
      <div><div class="ct">${esc(b.title)}</div><div class="ca">by ${esc(b.authorName||'Unclaimed author')}</div></div>
    </div>
    <div class="meta">
      <span class="chip genre">${esc(b.genre)}</span>
      <div class="row">
        <span class="countdown ${fs.state==='closed'?'closed':''}">${fs.txt}</span>
      </div>
    </div>
  </div>`;
}
