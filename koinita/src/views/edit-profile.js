// Source file — assembled into koinita-duda.html
// Production: swap localStorage (DB.*) calls for Supabase queries.

function viewProfile(){
  const m=me();
  return `<div class="app ${m.role==='author'?'author-mode':''}"><div class="wrap">
    <div class="app-head"><div><h1>My profile</h1><p>How you appear in the club.</p></div></div>
    <div class="panel" style="max-width:560px;margin-top:0">
      <div class="profile-head" style="margin-bottom:18px">
        <div class="big-av" style="background:${m.avatar}">${initials(m.name)}</div>
        <div><b style="font-size:18px">${esc(m.name)}</b><br>
        <span class="chip ${m.role==='author'?'verified':''}">${m.role==='author'?'✍️ Author':'📚 Reader'}</span></div>
      </div>
      <div class="field"><label>Display name</label><input id="pf_name" value="${esc(m.name)}"></div>
      <div class="field"><label>Email</label><input id="pf_email" value="${esc(m.email)}"></div>
      <div class="field"><label>${m.role==='author'?'Author bio (readers see this)':'About you'}</label>
        <textarea id="pf_bio">${esc(m.bio)}</textarea></div>
      <div class="field"><label>Avatar colour</label>
        <div style="display:flex;gap:8px;flex-wrap:wrap">${AVS.map(c=>`<button onclick="setAvatar('${c}')" style="width:34px;height:34px;border-radius:50%;background:${c};border:${m.avatar===c?'3px solid var(--ink)':'2px solid #fff'};box-shadow:var(--shadow)"></button>`).join('')}</div></div>
      <button class="btn ${m.role==='author'?'btn-spine':'btn-amber'}" onclick="saveProfile()">Save changes</button>
    </div>
  </div></div>`;
}
function setAvatar(c){ me().avatar=c; save(DB); render(); }
function saveProfile(){ const m=me();
  m.name=(document.getElementById('pf_name').value||'').trim()||m.name;
  m.email=(document.getElementById('pf_email').value||'').trim()||m.email;
  m.bio=(document.getElementById('pf_bio').value||'').trim();
  // keep authored books' display name in sync
  DB.books.filter(b=>b.authorUserId===m.id).forEach(b=>b.authorName=m.name);
  save(DB); toast('Profile saved ✓'); render(); }

function notFound(){ return `<div class="app"><div class="wrap"><div class="empty"><div class="ic">🔍</div><h3>Not found</h3><p>That page doesn't exist.</p><button class="btn btn-amber" onclick="go('home')">Back home</button></div></div></div>`; }
