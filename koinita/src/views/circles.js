// Source file — assembled into koinita-duda.html
// Production: swap localStorage (DB.*) calls for Supabase queries.

function myCircles(){ const m=me(); return DB.circles.filter(c=>c.memberIds.includes(m.id)); }
function viewCircles(){
  const m=me();
  const mine=myCircles();
  const claimedBookIds = m.role==='author'? DB.books.filter(b=>b.authorUserId===m.id).map(b=>b.id) : m.shelf.slice();
  const joinable = DB.circles.filter(c=>!c.memberIds.includes(m.id) && claimedBookIds.includes(c.bookId));
  return `<div class="app ${m.role==='author'?'author-mode':''}"><div class="wrap">
    <div class="app-head"><div><h1>Reading circles</h1><p>Small, text-only groups reading the same book together — with the author dropping in.</p></div></div>
    <h2 style="font-size:20px;margin:0 0 14px">Your circles</h2>
    ${mine.length? mine.map(circleCard).join('')
      : `<div class="empty" style="padding:40px"><div class="ic">○</div><h3>You're not in a circle yet</h3><p>Join one for a book you've claimed, or start your own from any book page.</p></div>`}
    ${joinable.length?`<h2 style="font-size:20px;margin:30px 0 14px">Open to you</h2>${joinable.map(circleCard).join('')}`:''}
  </div></div>`;
}
function circleCard(c){
  const b=bookById(c.bookId); const owner=userById(c.ownerId); const m=me();
  const member=c.memberIds.includes(m.id);
  return `<div class="circle-card" onclick="go('circle','${c.id}')">
    <h3>${esc(c.name)}</h3>
    <p>${b?esc(b.title):''} · hosted by ${owner?esc(owner.name):'—'} · ${c.memberIds.length} ${c.memberIds.length===1?'member':'members'} · ${c.messages.length} ${c.messages.length===1?'note':'notes'}${member?'':' · open to you'}</p>
  </div>`;
}
function viewCircle(id){
  const c=circleById(id); const m=me();
  if(!c) return notFound();
  const b=bookById(c.bookId); const owner=userById(c.ownerId);
  const member=c.memberIds.includes(m.id);
  const isOwner=c.ownerId===m.id;
  if(!member){
    const claimed = m.role==='author'? DB.books.some(x=>x.authorUserId===m.id && x.id===c.bookId) : m.shelf.includes(c.bookId);
    return `<div class="app"><div class="wrap">
      <button class="btn btn-ghost btn-sm" style="margin-bottom:22px" onclick="go('circles')">← Circles</button>
      <div class="empty"><div class="ic">○</div><h3>${esc(c.name)}</h3>
      <p>${b?esc(b.title):''} · hosted by ${owner?esc(owner.name):'—'} · ${c.memberIds.length} members</p>
      ${claimed?`<button class="btn btn-spine" onclick="joinCircle('${c.id}')">Join this circle</button>`
        :`<p style="margin-top:10px">Claim <b>${b?esc(b.title):'the book'}</b> first to join its circle.</p>`}</div>
    </div></div>`;
  }
  // member view: discussion + invite
  const followingList = followingOf(m.id).map(userById).filter(u=>u && !c.memberIds.includes(u.id));
  return `<div class="app ${m.role==='author'?'author-mode':''}"><div class="wrap">
    <button class="btn btn-ghost btn-sm" style="margin-bottom:22px" onclick="go('circles')">← Circles</button>
    <div class="app-head"><div><h1>${esc(c.name)}</h1>
      <p>${b?`<span style="cursor:pointer;color:var(--amber-deep)" onclick="go('book','${b.id}')">${esc(b.title)}</span> · `:''}hosted by ${owner?esc(owner.name):'—'} · ${c.memberIds.length} members</p></div></div>

    <div class="panel" style="margin-top:0">
      <h3>Members</h3>
      <div style="display:flex;gap:8px;flex-wrap:wrap;margin-top:8px">
        ${c.memberIds.map(uid2=>{const u=userById(uid2);return u?`<span class="chip" style="cursor:pointer" onclick="go('member','${u.id}')">${initials(u.name)} ${esc(u.name.split(' ')[0])}${u.id===c.ownerId?' · host':''}</span>`:'';}).join('')}
      </div>
      ${followingList.length?`<div style="margin-top:14px">
        <label style="font-size:13px;font-weight:600;color:var(--ink-soft)">Add someone you follow</label>
        <div style="display:flex;gap:8px;margin-top:6px;flex-wrap:wrap">
          <select id="inviteSel" style="flex:1;min-width:180px;padding:10px 12px;border:1.5px solid var(--line);border-radius:10px;font-family:inherit">
            ${followingList.map(u=>`<option value="${u.id}">${esc(u.name)}</option>`).join('')}
          </select>
          <button class="btn btn-ghost btn-sm" onclick="addToCircle('${c.id}')">Add to circle</button>
        </div></div>`:''}
    </div>

    <div class="panel">
      <h3>Discussion</h3>
      <div style="display:flex;flex-direction:column;gap:12px;margin:14px 0">
        ${c.messages.slice().sort((a,b)=>a.at-b.at).map(msg=>{const u=userById(msg.userId);return `
          <div style="display:flex;gap:10px">
            <div class="p-av" style="width:36px;height:36px;background:${u?u.avatar:'var(--ink-faint)'};font-size:13px" onclick="go('member','${u?u.id:''}')">${u?initials(u.name):'?'}</div>
            <div><div style="font-size:13.5px"><b>${u?esc(u.name):'—'}</b> <span style="color:var(--ink-faint);font-size:12px">${timeAgo(msg.at)}</span></div>
            <div style="font-size:14.5px;white-space:pre-wrap">${esc(msg.text)}</div></div>
          </div>`;}).join('')}
      </div>
      <div class="reply-box" style="padding:12px 0 0;border-top:1px solid var(--line-soft)">
        <input id="circleMsg" placeholder="Share a thought with the circle…" onkeydown="if(event.key==='Enter')postCircle('${c.id}')">
        <button class="btn ${m.role==='author'?'btn-spine':'btn-amber'} btn-sm" onclick="postCircle('${c.id}')">Send</button>
      </div>
    </div>
  </div></div>`;
}
function joinCircle(id){ const c=circleById(id); const m=me();
  if(!c.memberIds.includes(m.id)){ c.memberIds.push(m.id); save(DB); toast('You joined the circle ○'); }
  render(); }
function addToCircle(id){ const c=circleById(id); const sel=document.getElementById('inviteSel'); if(!sel) return;
  const uid2=sel.value; if(!uid2) return;
  if(!c.memberIds.includes(uid2)){ c.memberIds.push(uid2); notify(uid2,'circle_add',me().id,'added you to a reading circle',c.id); save(DB); toast('Added to the circle'); render(); } }
function postCircle(id){ const c=circleById(id); const inp=document.getElementById('circleMsg');
  const txt=(inp.value||'').trim(); if(!txt) return;
  const mod=enforce(txt); if(!mod.ok){ return; }
  c.messages.push({userId:me().id, text:mod.clean||txt, at:now()}); save(DB); render(); }
function startCircle(bookId){
  const m=me(); const b=bookById(bookId);
  const existing=DB.circles.find(c=>c.bookId===bookId);
  if(existing){ if(!existing.memberIds.includes(m.id)) existing.memberIds.push(m.id); save(DB); go('circle',existing.id); return; }
  const c={id:uid('c'), bookId, ownerId:m.id, name:b.title+' — reading circle', memberIds:[m.id], at:now(),
    messages:[{userId:m.id, text:'Starting a small circle for readers of '+b.title+'. Welcome in.', at:now()}]};
  DB.circles.push(c); save(DB); toast('Circle created ○'); go('circle',c.id);
}
