// Source file — assembled into koinita-duda.html
// Production: swap localStorage (DB.*) calls for Supabase queries.

function viewAdmin(){
  const m=me(); const se=staffEditor();
  const members = DB.users.filter(u=>!u.system);
  const readers = members.filter(u=>u.role==='reader').length;
  const authors = members.filter(u=>u.role==='author').length;
  const banned = members.filter(u=>u.banned).length;
  const strikes = members.filter(u=>(u.strikes||0)>0 && !u.banned).length;
  const openAppeals = DB.appeals.filter(a=>a.status==='open').length;
  const reports = DB.reports.length;
  const stat=(n,l)=>`<div class="panel" style="text-align:center;margin:0"><div style="font-family:var(--display);font-size:30px">${n}</div><div class="sub" style="margin:0">${l}</div></div>`;
  return `<div class="app author-mode"><div class="wrap">
    <div class="app-head"><div><h1>Admin</h1><p>Reach every member through the Staff Editor channel, and keep an eye on safety.</p></div></div>

    <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(120px,1fr));gap:12px;margin-bottom:24px">
      ${stat(readers,'Readers')}${stat(authors,'Authors')}${stat(strikes,'On warning')}${stat(banned,'Suspended')}${stat(openAppeals,'Open appeals')}${stat(reports,'Safety reports')}
    </div>

    <div class="panel">
      <h3>Staff Editor channel</h3>
      <p class="sub">Every member automatically follows this account and sees its posts (unless they mute it). Use it for announcements or a personal note.</p>
      <div style="display:flex;gap:8px;flex-wrap:wrap;margin:10px 0 16px">
        <input id="seName" value="${esc(se?se.name:'Staff Editor')}" style="flex:1;min-width:180px;padding:10px 12px;border:1.5px solid var(--line);border-radius:10px;font-family:inherit">
        <button class="btn btn-ghost btn-sm" onclick="renameStaff()">Rename channel</button>
      </div>
      <textarea id="sePost" rows="3" placeholder="Write an announcement or a personal note to all members…" style="width:100%;padding:12px;border:1.5px solid var(--line);border-radius:10px;font-family:inherit;font-size:15px"></textarea>
      <div style="display:flex;justify-content:flex-end;margin-top:10px">
        <button class="btn btn-spine btn-sm" onclick="postAsStaff()">Post to all members</button>
      </div>
    </div>

    ${openAppeals?`<div class="panel"><h3>Open appeals</h3>
      ${DB.appeals.filter(a=>a.status==='open').map(a=>`<div style="border-top:1px solid var(--line-soft);padding:12px 0">
        <b>${esc(a.name)}</b> <span class="sub">· ${timeAgo(a.at)}</span>
        <p style="margin:4px 0 8px;font-size:14px">${esc(a.text||'(no message)')}</p>
        <button class="btn btn-ghost btn-sm" onclick="resolveAppeal('${a.id}','reinstate')">Reinstate</button>
        <button class="btn btn-ghost btn-sm" onclick="resolveAppeal('${a.id}','deny')">Deny</button>
      </div>`).join('')}</div>`:''}
  </div></div>`;
}
function renameStaff(){ const se=staffEditor(); const v=(document.getElementById('seName').value||'').trim(); if(!v) return;
  se.name=v; DB.settings.staffEditorName=v; save(DB); toast('Channel renamed to '+v); render(); }
function postAsStaff(){ const se=staffEditor(); const txt=(document.getElementById('sePost').value||'').trim();
  if(!txt){ toast('Write something first.'); return; }
  DB.posts.push({id:uid('p'), authorId:se.id, bookId:null, text:txt, at:now(), appreciatedBy:[], pinned:true});
  save(DB); toast('Posted to all members ✦'); render(); }
function resolveAppeal(id,action){ const a=DB.appeals.find(x=>x.id===id); if(!a) return;
  a.status=action; const u=userById(a.userId);
  if(action==='reinstate' && u){ u.banned=false; u.strikes=0; }
