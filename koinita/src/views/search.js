// Source file — assembled into koinita-duda.html
// Production: swap localStorage (DB.*) calls for Supabase queries.

let searchQuery='';
function viewSearch(){
  const m=me();
  const q=searchQuery.trim().toLowerCase();
  let results = DB.users.filter(u=>u.id!==m.id);
  if(q) results = results.filter(u=>u.name.toLowerCase().includes(q) || (u.bio||'').toLowerCase().includes(q));
  results = results.sort((a,b)=> followersOf(b.id).length - followersOf(a.id).length).slice(0,30);
  return `<div class="app ${m.role==='author'?'author-mode':''}"><div class="wrap">
    <div class="app-head"><div><h1>Find your literary network</h1><p>Search readers and authors by name or what they love. Follow to see their notes.</p></div></div>
    <div class="search-box">
      <span style="font-size:18px">🔍</span>
      <input id="searchInput" value="${esc(searchQuery)}" placeholder="Search members by name or interest…" oninput="onSearch(this.value)" autofocus>
    </div>
    ${results.length? results.map(memberRow).join('')
      : `<div class="empty"><div class="ic">🔍</div><h3>No members found</h3><p>Try a different name or interest.</p></div>`}
  </div></div>`;
}
function onSearch(v){
  searchQuery=v;
  const m=me();
  const q=v.trim().toLowerCase();
  let results = DB.users.filter(u=>u.id!==m.id);
  if(q) results = results.filter(u=>u.name.toLowerCase().includes(q) || (u.bio||'').toLowerCase().includes(q));
  results = results.sort((a,b)=> followersOf(b.id).length - followersOf(a.id).length).slice(0,30);
  // re-render results only, keep the input focused
  const cont=document.querySelector('.app .wrap');
  if(!cont) return;
  const list=cont.querySelectorAll('.member-row, .empty');
  list.forEach(n=>n.remove());
  const html = results.length? results.map(memberRow).join('')
    : `<div class="empty"><div class="ic">🔍</div><h3>No members found</h3><p>Try a different name or interest.</p></div>`;
  cont.insertAdjacentHTML('beforeend', html);
}
function memberRow(u){
  const m=me();
  const f=isFollowing(m.id,u.id);
  return `<div class="member-row">
    <div class="m-av" style="background:${u.avatar}" onclick="go('member','${u.id}')">${initials(u.name)}</div>
    <div class="m-info">
      <b onclick="go('member','${u.id}')">${esc(u.name)}</b> ${u.role==='author'?'<span class="chip verified" style="font-size:9px;padding:2px 7px">author</span>':''}
      <p>${esc(u.bio||'')}</p>
    </div>
    <button class="follow-btn ${f?'following':''}" onclick="toggleFollow('${u.id}')">${f?'✓ Following':'+ Follow'}</button>
  </div>`;
}
