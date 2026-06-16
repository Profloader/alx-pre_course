// Source file — assembled into koinita-duda.html
// Production: swap localStorage (DB.*) calls for Supabase queries.

function viewFeed(){
  const m=me();
  const se=staffEditor();
  const following = followingOf(m.id);
  const visible = [m.id, ...following];
  let posts = DB.posts.filter(p=>visible.includes(p.authorId)).sort((a,b)=>b.at-a.at);
  if(m.mutedStaff && se) posts = posts.filter(p=>p.authorId!==se.id);
  m.lastFeedSeen = now(); save(DB);
  return `<div class="app ${m.role==='author'?'author-mode':''}"><div class="wrap">
    <div class="app-head"><div><h1>Your feed</h1><p>Notes from the authors and readers you follow. Quiet, chronological, text only.</p></div>
      <button class="btn btn-ghost btn-sm" onclick="go('search')">🔍 Find people</button></div>
    ${m.mutedStaff && se?`<div class="panel" style="display:flex;justify-content:space-between;align-items:center;gap:10px;flex-wrap:wrap;margin-top:0"><span class="sub" style="margin:0">${esc(se.name)} updates are muted.</span><button class="btn btn-ghost btn-sm" onclick="toggleMuteStaff()">Turn back on</button></div>`:''}
    ${composeBox('')}
    ${posts.length? posts.map(postCard).join('')
      : `<div class="empty"><div class="ic">📨</div><h3>Your feed is quiet</h3><p>Follow a few authors and readers, and their notes will appear here. Start by sharing one of your own.</p>
         <button class="btn btn-amber" onclick="go('search')">Find people to follow</button></div>`}
  </div></div>`;
}

function composeBox(preBookId){
  const m=me(); if(!m) return '';
  const claimedBooks = m.role==='author'
    ? DB.books.filter(b=>b.authorUserId===m.id)
    : m.shelf.map(bookById).filter(Boolean);
  const opts = ['<option value="">About a book… (optional)</option>']
    .concat(claimedBooks.map(b=>`<option value="${b.id}" ${b.id===preBookId?'selected':''}>${esc(b.title)}</option>`)).join('');
  return `<div class="compose">
    <textarea id="postText" maxlength="1000" placeholder="${m.role==='author'?'Share a note from behind the page — what a book means to you…':'Share a short note about a book you\u2019re reading…'}"></textarea>
    <div class="c-foot">
      <select id="postBook">${opts}</select>
      <div style="display:flex;align-items:center;gap:10px">
        <span style="font-size:12px;color:var(--ink-faint)">Text only · 1000 max</span>
        <button class="btn ${m.role==='author'?'btn-spine':'btn-amber'} btn-sm" onclick="createPost()">Post</button>
      </div>
    </div>
  </div>`;
}
function createPost(){
  const m=me();
  const text=(document.getElementById('postText').value||'').trim();
  const bookId=document.getElementById('postBook').value||null;
  if(!text){ toast('Write a note first.'); return; }
  const mod=enforce(text);
  if(!mod.ok){ return; }
  DB.posts.push({id:uid('p'), authorId:m.id, bookId, text:mod.clean||text, at:now(), appreciatedBy:[]});
  save(DB); toast('Posted to your followers ✦'); render();
}
function appreciate(pid){
  const m=me(); const p=DB.posts.find(x=>x.id===pid); if(!p) return;
  p.appreciatedBy = p.appreciatedBy||[];
  const i=p.appreciatedBy.indexOf(m.id);
  if(i>=0) p.appreciatedBy.splice(i,1);
  else { p.appreciatedBy.push(m.id); if(p.authorId!==m.id) notify(p.authorId,'appreciate',m.id,'appreciated your note',p.id); }
  save(DB); render();
}
function postCard(p){
  const m=me(); const a=userById(p.authorId); if(!a) return '';
  const b=p.bookId?bookById(p.bookId):null;
  const liked = m && (p.appreciatedBy||[]).includes(m.id);
  const n=(p.appreciatedBy||[]).length;
  const isStaff = a.system;
  const badge = isStaff
    ? ` <span class="chip" style="font-size:9px;padding:2px 7px;background:var(--gold);color:#fff">official</span>`
    : (a.role==='author'?' <span class="chip verified" style="font-size:9px;padding:2px 7px">author</span>':'');
  return `<div class="post"${isStaff?' style="border-color:var(--gold);background:#fffdf7"':''}>
    <div class="p-head">
      <div class="p-av" style="background:${a.avatar}" onclick="go('member','${a.id}')">${initials(a.name)}</div>
      <div style="flex:1"><div class="p-name" onclick="go('member','${a.id}')">${esc(a.name)}${badge}</div>
        <div class="p-meta">${p.pinned&&isStaff?'📌 ':''}${timeAgo(p.at)}${b?` · on <span style="color:var(--amber-deep);cursor:pointer" onclick="go('book','${b.id}')">${esc(b.title)}</span>`:''}</div></div>
      ${isStaff?`<button class="iconbtn" title="Mute these updates" style="width:32px;height:32px;font-size:13px" onclick="toggleMuteStaff()">${m&&m.mutedStaff?'🔔':'🔕'}</button>`:''}
    </div>
    <div class="p-body">${esc(p.text)}</div>
    <div class="p-foot">
      <button class="${liked?'on':''}" onclick="appreciate('${p.id}')">♥ ${n||''} ${n===1?'appreciation':n>1?'appreciations':'Appreciate'}</button>
      ${b?`<button onclick="go('book','${b.id}')">📖 View book</button>`:''}
    </div>
  </div>`;
}
