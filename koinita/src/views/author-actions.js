// Source file — assembled into koinita-duda.html
// Production: swap localStorage (DB.*) calls for Supabase queries.

function claimBook(id){ const m=me(); const b=bookById(id);
  if(!canAddBook(m)){ openUpgradePrompt(); return; }
  b.authorUserId=m.id; b.authorName=m.name; save(DB); toast('Connected to your profile ✓'); render(); }

function openUpgradePrompt(){
  const m=me(); const p=planOf(m);
  document.getElementById('modalMount').innerHTML=`
  <div class="overlay" onclick="if(event.target===this)closeAuth()">
    <div class="modal"><div class="m-head"><button class="x" onclick="closeAuth()">✕</button>
      <h3>You've reached your ${p.name} limit</h3>
      <p>Your plan includes ${p.maxListings} active ${p.maxListings===1?'listing':'listings'}. Upgrade to list more books and reach more readers.</p></div>
      <div class="m-body"><button class="btn btn-spine btn-block" onclick="closeAuth();go('plans')">See plans</button></div>
    </div></div>`;
}

function openAddBook(){
  const m=me();
  if(!canAddBook(m)){ openUpgradePrompt(); return; }
  document.getElementById('modalMount').innerHTML=`
  <div class="overlay" onclick="if(event.target===this)closeAuth()">
    <div class="modal">
      <div class="m-head"><button class="x" onclick="closeAuth()">✕</button>
        <h3>Add a book</h3><p>It will be bound to your author profile and appear on the shelf.</p></div>
      <div class="m-body">
        <div class="field"><label>Title</label><input id="nb_title" placeholder="Your book's title" required></div>
        <div class="field"><label>Genre</label><select id="nb_genre">${GENRES.map(g=>`<option>${g}</option>`).join('')}</select></div>
        <div class="field"><label>Description</label><textarea id="nb_blurb" placeholder="A few honest sentences about the book."></textarea></div>
        <div class="field"><label>Amazon ASIN <span style="font-weight:400;color:var(--ink-faint)">(the 10-character code in the Kindle URL)</span></label><input id="nb_asin" placeholder="B0XXXXXXXX"></div>
        <div class="form-grid">
          <div class="field"><label>Free window starts</label><input id="nb_start" type="date"></div>
          <div class="field"><label>Free window ends</label><input id="nb_end" type="date"></div>
        </div>
        <p style="font-size:12.5px;color:var(--ink-faint);margin:-4px 0 14px">Amazon KDP Select allows up to 5 free days per 90-day term. Set a window inside that.</p>
        <button class="btn btn-spine btn-block" onclick="saveNewBook()">Add to the shelf</button>
      </div>
    </div>
  </div>`;
}
function saveNewBook(){
  const m=me();
  if(!canAddBook(m)){ closeAuth(); openUpgradePrompt(); return; }
  const title=(document.getElementById('nb_title').value||'').trim();
  if(!title){ toast('Give your book a title.'); return; }
  const asin=(document.getElementById('nb_asin').value||'').trim()||'B0EXAMPLE0';
  const s=document.getElementById('nb_start').value, e=document.getElementById('nb_end').value;
  const freeStart = s? new Date(s).getTime() : now();
  const freeEnd = e? new Date(e).getTime()+86399000 : now()+86400000*4;
  DB.books.push({id:uid('b'),title,authorName:m.name,authorUserId:m.id,
    genre:document.getElementById('nb_genre').value,
    blurb:(document.getElementById('nb_blurb').value||'').trim()||'A new release from '+m.name+'.',
    cover:Math.floor(Math.random()*COVERS.length), featured:false,
    freeStart,freeEnd,asin,amazonUrl:'https://www.amazon.com/dp/'+asin,added:now()});
  save(DB); closeAuth(); toast('Book added to the shelf ✓'); go('mybooks');
}
function viewMyBooks(){
  const m=me();
  const mine=DB.books.filter(b=>b.authorUserId===m.id);
  const canFeature = hasFeature(m,'featured');
  return `<div class="app author-mode"><div class="wrap">
    <div class="app-head"><div><h1>My books</h1><p>Every title here is bound to your author page.</p></div>
      <button class="btn btn-spine btn-sm" onclick="openAddBook()">+ Add a book</button></div>
    ${mine.length?`
      <div class="grid" style="margin-bottom:30px">${mine.map(bookCard).join('')}</div>
      <h2 style="font-size:20px;margin:0 0 14px">Manage your drops</h2>
      <div class="panel" style="padding:4px 0">
        ${mine.map((b,i)=>`<div style="display:flex;align-items:center;gap:12px;padding:13px 20px;${i<mine.length-1?'border-bottom:1px solid var(--line-soft);':''}flex-wrap:wrap">
          <b style="flex:1;min-width:150px;font-family:var(--display);font-size:16px">${esc(b.title)}</b>
          ${b.featured?'<span class="chip" style="background:var(--spine);color:#fff">✦ Featured</span>':''}
          <button class="btn btn-ghost btn-sm" onclick="openEditFree('${b.id}')">Free window</button>
          <button class="btn ${b.featured?'btn-ghost':'btn-spine'} btn-sm" onclick="toggleFeatured('${b.id}')">${b.featured?'Unfeature':(canFeature?'Feature drop':'🔒 Feature')}</button>
        </div>`).join('')}
      </div>`
      :`<div class="empty"><div class="ic">✍️</div><h3>No books yet</h3><p>Add your first title to start meeting readers.</p>
        <button class="btn btn-spine" onclick="openAddBook()">+ Add a book</button></div>`}
  </div></div>`;
}
function toggleFeatured(id){
  const m=me(); const b=bookById(id);
  if(!hasFeature(m,'featured')){ toast('Featured placement is an Author Pro feature.'); go('plans'); return; }
  b.featured=!b.featured; save(DB); toast(b.featured?'Featured ✦':'Removed from featured'); render();
}
function openEditFree(id){
  const b=bookById(id);
  document.getElementById('modalMount').innerHTML=`
  <div class="overlay" onclick="if(event.target===this)closeAuth()">
    <div class="modal"><div class="m-head"><button class="x" onclick="closeAuth()">✕</button>
      <h3>Free window</h3><p>${esc(b.title)}</p></div>
      <div class="m-body">
        <div class="form-grid">
          <div class="field"><label>Starts</label><input id="ef_start" type="date" value="${new Date(b.freeStart).toISOString().slice(0,10)}"></div>
          <div class="field"><label>Ends</label><input id="ef_end" type="date" value="${new Date(b.freeEnd).toISOString().slice(0,10)}"></div>
        </div>
        <button class="btn btn-spine btn-block" onclick="saveFree('${id}')">Save window</button>
      </div></div></div>`;
}
function saveFree(id){ const b=bookById(id);
  b.freeStart=new Date(document.getElementById('ef_start').value).getTime();
  b.freeEnd=new Date(document.getElementById('ef_end').value).getTime()+86399000;
  save(DB); closeAuth(); toast('Free window updated'); render(); }
