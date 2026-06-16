// Source file — assembled into koinita-duda.html
// Production: swap localStorage (DB.*) calls for Supabase queries.

function viewNotifications(){
  const m=me();
  const ns = DB.notifications.filter(n=>n.userId===m.id).sort((a,b)=>b.at-a.at);
  return `<div class="app ${m.role==='author'?'author-mode':''}"><div class="wrap">
    <div class="app-head"><div><h1>Notifications</h1><p>Follows, circle invites, and replies. In production these also arrive as an optional email digest.</p></div>
      ${ns.some(n=>!n.read)?`<button class="btn btn-ghost btn-sm" onclick="markAllRead()">Mark all read</button>`:''}</div>
    ${ns.length? ns.map(notifRow).join('')
      : `<div class="empty"><div class="ic">🔔</div><h3>Nothing yet</h3><p>When someone follows you, invites you to a circle, or replies, it shows up here.</p></div>`}
  </div></div>`;
}
function notifRow(n){
  const from=userById(n.fromId);
  return `<div class="notif ${n.read?'':'unread'}" onclick="openNotif('${n.id}')">
    <div class="n-av" style="background:${from?from.avatar:'var(--ink-faint)'}">${from?initials(from.name):'?'}</div>
    <div class="n-txt"><b>${from?esc(from.name):'Someone'}</b> ${esc(n.text)}</div>
    <div class="n-time">${timeAgo(n.at)}</div>
  </div>`;
}
function openNotif(id){
  const n=DB.notifications.find(x=>x.id===id); if(!n) return;
  n.read=true; save(DB);
  if(n.type==='follow' || n.type==='appreciate') go('member', n.fromId);
  else if(n.type==='circle_add' || n.type==='circle_invite') go('circle', n.refId);
  else if(n.type==='feedback' || n.type==='reply') go(me().role==='author'?'inbox':'messages');
  else render();
}
function markAllRead(){ const m=me(); DB.notifications.forEach(n=>{ if(n.userId===m.id) n.read=true; }); save(DB); render(); }
