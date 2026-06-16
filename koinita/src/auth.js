// Source file — assembled into koinita-duda.html
// Production: swap localStorage (DB.*) calls for Supabase queries.

let authState = {mode:'signup', role:'reader', pendingView:null, step:'form', email:'', name:''};
function openAuth(mode='signin', role='reader'){ authState={mode, role, pendingView:authState.pendingView, step:'form', email:'', name:''}; mountAuth(); }
function openAuthThen(view){ if(me()){ go(view); return; } authState.pendingView=view; openAuth('signup'); }

function mountAuth(){
  const isUp = authState.mode==='signup';
  const r = authState.role;
  if(authState.step==='code'){ mountCodeStep(); return; }
  document.getElementById('modalMount').innerHTML = `
  <div class="overlay" onclick="if(event.target===this)closeAuth()">
    <div class="modal">
      <div class="m-head">
        <button class="x" onclick="closeAuth()">✕</button>
        <h3>${isUp?'Join Koinita':'Welcome back'}</h3>
        <p>${isUp?'Free forever, passwordless, and 18+ only.':'No password needed — we\u2019ll email you a one-time code.'}</p>
      </div>
      <div class="m-body">
        <div class="tabs">
          <button class="${isUp?'active':''}" onclick="switchAuth('signup')">Create account</button>
          <button class="${!isUp?'active':''}" onclick="switchAuth('signin')">Sign in</button>
        </div>

        <button class="g-btn" onclick="socialAuth('google')">
          <svg width="18" height="18" viewBox="0 0 48 48"><path fill="#FFC107" d="M43.6 20.5H42V20H24v8h11.3c-1.6 4.7-6.1 8-11.3 8a12 12 0 1 1 7.9-21l5.7-5.7A20 20 0 1 0 24 44a20 20 0 0 0 19.6-23.5z"/><path fill="#FF3D00" d="M6.3 14.7l6.6 4.8A12 12 0 0 1 24 12c3 0 5.8 1.1 7.9 3l5.7-5.7A20 20 0 0 0 6.3 14.7z"/><path fill="#4CAF50" d="M24 44c5.2 0 9.9-2 13.4-5.2l-6.2-5.2A12 12 0 0 1 12.7 28l-6.5 5A20 20 0 0 0 24 44z"/><path fill="#1976D2" d="M43.6 20.5H42V20H24v8h11.3a12 12 0 0 1-4.1 5.6l6.2 5.2C42.9 35.6 44 30.1 44 24c0-1.2-.1-2.4-.4-3.5z"/></svg>
          Continue with Google
        </button>
        <button class="g-btn" onclick="socialAuth('apple')">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="#000"><path d="M17.05 12.04c-.03-2.6 2.12-3.85 2.22-3.91-1.21-1.77-3.1-2.01-3.77-2.04-1.6-.16-3.13.94-3.94.94-.81 0-2.07-.92-3.4-.9-1.75.03-3.36 1.02-4.26 2.58-1.82 3.16-.47 7.84 1.3 10.41.86 1.26 1.89 2.67 3.24 2.62 1.3-.05 1.79-.84 3.36-.84 1.57 0 2.01.84 3.39.81 1.4-.02 2.29-1.28 3.15-2.55.99-1.46 1.4-2.87 1.42-2.94-.03-.01-2.73-1.05-2.76-4.16zM14.6 4.6c.72-.87 1.2-2.08 1.07-3.28-1.03.04-2.28.69-3.02 1.55-.66.77-1.24 2-1.08 3.18 1.15.09 2.32-.58 3.03-1.45z"/></svg>
          Continue with Apple
        </button>
        <div class="divider">or with a one-time email code</div>

        ${isUp?`
        <div class="role-pick">
          <div class="opt ${r==='reader'?'sel':''}" onclick="pickRole('reader')">
            <div class="ic">📚</div><b>Reader</b><span>Claim & keep free books</span></div>
          <div class="opt author ${r==='author'?'sel':''}" onclick="pickRole('author')">
            <div class="ic">✍️</div><b>Author</b><span>Meet your readers</span></div>
        </div>`:''}

        <form onsubmit="return submitAuth(event)">
          ${isUp?`<div class="field"><label>Your name</label><input id="af_name" placeholder="${r==='author'?'Pen name or real name':'How should we greet you?'}" required></div>`:''}
          <div class="field"><label>Email</label><input id="af_email" type="email" placeholder="you@email.com" required></div>
          ${isUp?`<label style="display:flex;gap:10px;align-items:flex-start;font-size:13px;color:var(--ink-soft);margin-bottom:14px;cursor:pointer">
            <input type="checkbox" id="af_age" style="margin-top:3px;width:auto"> I confirm I am 18 or older. Koinita is an adults-only community.</label>`:''}
          <div class="err hidden" id="af_err"></div>
          <button class="btn ${r==='author'&&isUp?'btn-spine':'btn-amber'} btn-block" type="submit">
            ${isUp?'Email me a sign-up code':'Email me a sign-in code'}
          </button>
        </form>
        ${!isUp?`<p style="font-size:12.5px;color:var(--ink-faint);text-align:center;margin-top:14px">Demo: reader@demo.club · mara@demo.club · admin@koinita.club — then any 6-digit code</p>`:''}
      </div>
    </div>
  </div>`;
}
function mountCodeStep(){
  document.getElementById('modalMount').innerHTML = `
  <div class="overlay" onclick="if(event.target===this)closeAuth()">
    <div class="modal">
      <div class="m-head"><button class="x" onclick="closeAuth()">✕</button>
        <h3>Check your email</h3>
        <p>We sent a 6-digit code to <b>${esc(authState.email)}</b>. No password to remember.</p></div>
      <div class="m-body">
        <div class="field"><label>One-time code</label>
          <input id="af_code" inputmode="numeric" maxlength="6" placeholder="••••••" style="letter-spacing:8px;font-size:22px;text-align:center" autofocus></div>
        <div class="err hidden" id="af_err"></div>
        <button class="btn btn-amber btn-block" onclick="verifyCode()">Verify &amp; continue</button>
        <p style="font-size:12.5px;color:var(--ink-faint);text-align:center;margin-top:12px">Demo: enter any 6 digits. <button class="linkbtn" style="background:none;border:none;color:var(--amber-deep);font-weight:600;padding:0;cursor:pointer" onclick="authState.step='form';mountAuth()">Use a different email</button></p>
      </div>
    </div>
  </div>`;
}
function switchAuth(mode){ authState.mode=mode; authState.step='form'; mountAuth(); }
function pickRole(r){ authState.role=r; mountAuth(); }
function closeAuth(){ document.getElementById('modalMount').innerHTML=''; }

function socialAuth(provider){
  // Demo only — production uses Supabase OAuth (Google / Apple), passwordless by design.
  const label = provider==='apple'?'Apple':'Google';
  if(authState.mode==='signin'){
    const u = DB.users.find(x=>x.role==='reader' && !x.system);
    if(u.banned){ DB.session=u.id; save(DB); closeAuth(); render(); return; }
    DB.session=u.id; save(DB); closeAuth(); toast('Signed in with '+label+' (demo)'); afterAuth(); return;
  }
  finishSignup(label+' Member', 'member'+Math.floor(Math.random()*9000)+'@'+(provider==='apple'?'icloud.com':'gmail.com'), authState.role);
}
function submitAuth(e){
  e.preventDefault();
  const err = document.getElementById('af_err');
  const email = document.getElementById('af_email').value.trim().toLowerCase();
  if(authState.mode==='signup'){
    if(!document.getElementById('af_age').checked){ err.textContent='You must confirm you are 18 or older to join.'; err.classList.remove('hidden'); return false; }
    if(DB.users.find(x=>x.email===email)){ err.textContent='That email is already in the club. Try signing in.'; err.classList.remove('hidden'); return false; }
    authState.name = document.getElementById('af_name').value.trim();
  } else {
    if(!DB.users.find(x=>x.email===email)){ err.textContent='No account for that email. Try the demo logins, or create an account.'; err.classList.remove('hidden'); return false; }
  }
  authState.email = email; authState.step='code'; mountAuth();
  return false;
}
function verifyCode(){
  const err=document.getElementById('af_err');
  const code=(document.getElementById('af_code').value||'').trim();
  if(!/^\d{6}$/.test(code)){ err.textContent='Enter the 6-digit code (any 6 digits in this demo).'; err.classList.remove('hidden'); return; }
  if(authState.mode==='signin'){
    const u=DB.users.find(x=>x.email===authState.email);
    DB.session=u.id; save(DB); closeAuth();
    if(u.banned){ render(); return; }
    toast('Welcome back, '+u.name.split(' ')[0]); afterAuth(); return;
  }
  finishSignup(authState.name, authState.email, authState.role);
}
function finishSignup(name,email,role){
  const u = {id:uid('u'),name,email,role,avatar:AVS[Math.floor(Math.random()*AVS.length)],
    bio: role==='author'?'New Koinita author. Say hello to your first readers.':'New member of the club.',
    joined:now(), shelf:[], inhouse:false, plan:'starter', strikes:0, banned:false, age18:true, mutedStaff:false};
  DB.users.push(u); DB.session=u.id;
  // auto-follow the Staff Editor so the owner can reach every new member
  const se=staffEditor(); if(se) DB.follows.push({followerId:u.id, followeeId:se.id, at:now(), staff:true});
  save(DB); closeAuth();
  toast('Welcome to Koinita, '+name.split(' ')[0]+'!'); afterAuth();
}
function afterAuth(){ const pv=authState.pendingView; authState.pendingView=null; go(pv||'home'); }
function signOut(){ closeMenu(); DB.session=null; save(DB); toast('Signed out'); go('home'); }
