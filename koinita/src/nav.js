// Source file — assembled into koinita-duda.html
// Production: swap localStorage (DB.*) calls for Supabase queries.

function renderNav(){
  const nav = document.getElementById('navlinks');
  const m = me();
  const a = (v)=> route.view===v ? 'active':'';
  if(!m){
    nav.innerHTML = `
      <a class="${a('home')}" onclick="go('home')">Home</a>
      <a class="${a('discover')}" onclick="openAuthThen('discover')">Browse books</a>
      <a onclick="openAuth('signin')">Sign in</a>
      <a class="btn btn-amber btn-sm" onclick="openAuth('signup')">Join free</a>`;
    return;
  }
  if(m.role==='author'){
    nav.innerHTML = `
      <a class="${a('home')}" onclick="go('home')">Studio</a>
      <a class="${a('feed')}" onclick="go('feed')">Feed</a>
      <a class="${a('mybooks')}" onclick="go('mybooks')">My books</a>
      <a class="${a('inbox')}" onclick="go('inbox')">Inbox</a>
      ${iconNav(m)}`;
  } else {
    nav.innerHTML = `
      <a class="${a('home')}" onclick="go('home')">My club</a>
      <a class="${a('discover')}" onclick="go('discover')">Discover</a>
      <a class="${a('feed')}" onclick="go('feed')">Feed</a>
      <a class="${a('shelf')}" onclick="go('shelf')">My shelf</a>
      ${iconNav(m)}`;
  }
}
function iconNav(m){
  const c = unreadCount();
  return `
    <button class="iconbtn" title="Find readers & authors" onclick="go('search')">🔍</button>
    <button class="iconbtn" title="Notifications" onclick="go('notifications')">🔔${c?`<span class="count">${c>9?'9+':c}</span>`:''}</button>
    ${avatarBtn(m)}`;
}
function avatarBtn(m){ return `<div class="avatar" style="background:${m.avatar}" onclick="toggleMenu(event)">${initials(m.name)}</div>`; }
function unreadBadge(){ return ''; }

function toggleMenu(e){
  e.stopPropagation();
  const m = me();
  let dd = document.getElementById('userdd');
  if(dd){ dd.remove(); return; }
  dd = document.createElement('div'); dd.className='dropdown'; dd.id='userdd';
  dd.innerHTML = `
    <div class="who"><b>${esc(m.name)}</b><span>${esc(m.email)} · ${m.role}${m.role==='author'&&m.inhouse?' · Axitos':''}</span></div>
    <button onclick="go('member','${m.id}');closeMenu()">👤 My profile &amp; posts</button>
    <button onclick="go('circles');closeMenu()">○ Reading circles</button>
    ${m.role==='reader'?`<button onclick="go('messages');closeMenu()">💬 My conversations</button>`:''}
    ${m.role==='author'?`<button onclick="go('plans');closeMenu()">💳 Plans &amp; billing</button>`:''}
    ${m.admin?`<button onclick="go('admin');closeMenu()">🛠 Admin dashboard</button>`:''}
    <button onclick="toggleMuteStaff();closeMenu()">${m.mutedStaff?'🔔 Unmute '+esc(DB.settings.staffEditorName):'🔕 Mute '+esc(DB.settings.staffEditorName)}</button>
    <button onclick="go('profile');closeMenu()">⚙ Edit profile</button>
    <button onclick="signOut()">↩ Sign out</button>`;
  document.body.appendChild(dd);
  setTimeout(()=>document.addEventListener('click', closeMenuOnce),0);
}
function closeMenu(){ const dd=document.getElementById('userdd'); if(dd) dd.remove(); }
function closeMenuOnce(){ closeMenu(); document.removeEventListener('click', closeMenuOnce); }
