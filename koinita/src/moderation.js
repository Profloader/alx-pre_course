// Source file — assembled into koinita-duda.html
// Production: swap localStorage (DB.*) calls for Supabase queries.

function classify(text){
  const t=(text||''); const l=t.toLowerCase();
  const tierA=['child porn','cp ','underage','minor sex','rape','kill you','bomb','school shoot','sextort'];
  if(tierA.some(w=>l.includes(w))) return {tier:'A', reason:'This violates our zero-tolerance safety policy. Your account has been suspended and the content preserved for reporting.'};
  const tierB=['viagra','crypto airdrop','free money','click here to win','make money fast','sex chat','xxx','onlyfans','nudes','buy now cheap'];
  if(tierB.some(w=>l.includes(w))) return {tier:'B', reason:'That looks like adult, spam, or solicitation content, which isn\u2019t allowed here.'};
  const letters=t.replace(/[^A-Za-z]/g,'');
  if(letters.length>20 && (t.replace(/[^A-Z]/g,'').length/letters.length)>0.85) return {tier:'B', reason:'Please don\u2019t post in all caps.'};
  return {tier:'ok'};
}
// returns {ok, clean} or {ok:false} after applying enforcement + UI feedback
function enforce(text){
  const m=me();
  const c=classify(text);
  if(c.tier==='ok'){
    const clean=(text||'').replace(/\bhttps?:\/\/\S+|\bwww\.\S+|\b[\w-]+\.(com|net|org|io|co|ru|xyz|link|info|biz)\b\S*/gi,'[link removed]');
    return {ok:true, clean};
  }
  if(c.tier==='A'){
    m.banned=true; m.banReason='Tier A safety violation'; m.strikes=(m.strikes||0)+1;
    DB.reports.push({id:uid('r'), userId:m.id, tier:'A', text:'[preserved]', at:now(), status:'reported_ncmec'});
    save(DB); toast(c.reason); render(); return {ok:false};
  }
  // Tier B: warn first, ban on second
  m.strikes=(m.strikes||0)+1;
  if(m.strikes>=2){ m.banned=true; m.banReason='Repeat Tier B violation'; save(DB); toast('Removed. Second violation — your account is suspended.'); render(); return {ok:false}; }
  save(DB); toast('Removed and warning issued: '+c.reason+' One more and your account is suspended.'); render(); return {ok:false};
}

/* ---------- seed demo data ---------- */
function seed(){
  const d = blankDB();
  const staff = {id:uid('u'), name:'Staff Editor', email:'editor@koinita.club', role:'author', system:true, admin:true,
    inhouse:true, plan:'inhouse', avatar:AVS[5], bio:'Notes and announcements from the Koinita team. Every member sees these by default — you can mute them anytime.', joined:now()-1000*60*60*24*60, shelf:[], strikes:0, banned:false, age18:true};
  const admin = {id:uid('u'), name:'Owner (Admin)', email:'admin@koinita.club', role:'author', admin:true,
    inhouse:true, plan:'inhouse', avatar:AVS[7], bio:'Koinita owner account.', joined:now()-1000*60*60*24*60, shelf:[], strikes:0, banned:false, age18:true};
  const author1 = {id:uid('u'),name:'Mara Ellison',email:'mara@demo.club',role:'author', inhouse:true, plan:'inhouse',
    avatar:AVS[1], bio:'I write quiet literary fiction about ordinary people at turning points. Koinita is where I meet my first readers and listen.', joined:now()-1000*60*60*24*40, shelf:[], strikes:0, banned:false, age18:true};
  const author2 = {id:uid('u'),name:'Daniel Okafor',email:'daniel@demo.club',role:'author', inhouse:false, plan:'indie',
    avatar:AVS[4], bio:'Speculative fiction and near-future thrillers. I read every note my readers send and I answer all of them.', joined:now()-1000*60*60*24*30, shelf:[], strikes:0, banned:false, age18:true};
  const reader1 = {id:uid('u'),name:'Reader Demo',email:'reader@demo.club',role:'reader',
    avatar:AVS[2], bio:'Avid reader. Happiest finding a great book before everyone else does.', joined:now()-1000*60*60*24*10, shelf:[], strikes:0, banned:false, age18:true};
  d.users.push(staff,admin,author1,author2,reader1);
  d.staffEditorId = staff.id;

  const t = now();
  const day = 1000*60*60*24;
  const mk = (title,authorName,authorId,genre,blurb,ci,freeStart,freeEnd,asin)=>({
    id:uid('b'),title,authorName,authorUserId:authorId,genre,blurb,cover:ci,
    freeStart,freeEnd,asin, amazonUrl:'https://www.amazon.com/dp/'+asin, added:t});

  d.books.push(
    mk('The Last Light Keeper','Mara Ellison',author1.id,'Literary Fiction',
      'On a fog-bound island, the keeper of a decommissioned lighthouse meets the woman who once lived in the cottage below. A first-edition release about memory, tides, and what we choose to keep lit.',
      0, t-day, t+day*3, 'B0EXAMPLE1'),
    mk('Signal Garden','Daniel Okafor',author2.id,'Sci-Fi',
      'In 2049 a botanist discovers her greenhouse is quietly transmitting. A taut near-future story about listening, consent, and the things we grow without meaning to.',
      2, t-day*2, t+day, 'B0EXAMPLE2'),
    mk('Salt & Ledger','Mara Ellison',author1.id,'Historical',
      'A bookkeeper in a failing coastal town balances the accounts of a community that no longer balances. Honest, warm, unsentimental.',
      5, t+day*2, t+day*7, 'B0EXAMPLE3'),
    mk('The Quiet Algorithm',null,null,'Non-Fiction',
      'A plain-language field guide to making good decisions when the data is loud and the stakes are real. Author profile unclaimed — connect this book to its author.',
      3, t-day, t+day*2, 'B0EXAMPLE4'),
    mk('Hollowmere','Daniel Okafor',author2.id,'Fantasy',
      'A drowned city resurfaces once a generation, and this year it is early. Atmospheric, propulsive fantasy with a beating human heart.',
      6, t-day*4, t-day, 'B0EXAMPLE5'),
    mk('Small Repairs','Mara Ellison',author1.id,'Self-Growth',
      'Short essays on fixing the small things — a hinge, a habit, a half-said apology — and how they add up to a life.',
      7, t+day*4, t+day*9, 'B0EXAMPLE6')
  );

  // one demo thread so the inbox isn't empty
  d.threads.push({
    id:uid('t'), bookId:d.books[0].id, readerId:reader1.id, authorUserId:author1.id,
    subject:'Feedback on The Last Light Keeper',
    rating:5, liked:'The final chapter completely undid me — the restraint in the prose made it hit harder.',
    improve:'The middle stretch on the island felt a touch slow, but it paid off.',
    messages:[{from:'reader',userId:reader1.id,text:'Was the lighthouse meant to be literal or a memory? No spoilers needed — just curious how you think about it.',at:t-day*1.5}],
    created:t-day*1.5, updated:t-day*1.5
  });

  // ---- literary network seed ----
  d.follows.push(
    {followerId:reader1.id, followeeId:author1.id, at:t-day*8},
    {followerId:reader1.id, followeeId:author2.id, at:t-day*6},
    {followerId:author2.id, followeeId:author1.id, at:t-day*5},
    // every member auto-follows the Staff Editor (system account)
    {followerId:reader1.id, followeeId:staff.id, at:t-day*10, staff:true},
    {followerId:author1.id, followeeId:staff.id, at:t-day*10, staff:true},
    {followerId:author2.id, followeeId:staff.id, at:t-day*10, staff:true}
  );
  d.posts.push(
    {id:uid('p'), authorId:staff.id, bookId:null, text:'Welcome to Koinita. We are a small, quiet club for readers and the authors who write for them. Free books, honest feedback, real conversation — no noise, no ads, no AI slop. We will use this space, sparingly, for the occasional note. You can mute it anytime.', at:t-day*9, appreciatedBy:[reader1.id], pinned:true},
    {id:uid('p'), authorId:author1.id, bookId:d.books[0].id, text:'A note from behind the page: I wrote the keeper during a winter I spent near a real decommissioned lighthouse. What it means to me is that we keep tending things long after their official use is gone. That is most of love, I think.', at:t-day*2, appreciatedBy:[reader1.id]},
    {id:uid('p'), authorId:author2.id, bookId:d.books[1].id, text:'Signal Garden started as a question: what would it mean to be listened to completely, without consent? I kept the prose spare on purpose. Curious what my first readers make of the ending.', at:t-day*1, appreciatedBy:[]},
    {id:uid('p'), authorId:author1.id, bookId:null, text:'Reading is the one technology that still requires your whole attention. That is why this club is small and quiet on purpose.', at:t-day*0.5, appreciatedBy:[]}
  );
  const circle = {id:uid('c'), bookId:d.books[0].id, ownerId:author1.id, name:'The Last Light Keeper — first readers',
    memberIds:[author1.id, reader1.id], at:t-day*3,
    messages:[{userId:author1.id, text:'Welcome in. This is a small circle for the first people reading the book. Ask me anything as you go.', at:t-day*3}]};
  d.circles.push(circle);
  d.notifications.push(
    {id:uid('n'), userId:author1.id, type:'follow', fromId:reader1.id, refId:author1.id, text:'started following you', at:t-day*8, read:false},
    {id:uid('n'), userId:reader1.id, type:'circle_add', fromId:author1.id, refId:circle.id, text:'added you to a reading circle', at:t-day*3, read:false}
  );

  d.seeded = true;
  return d;
}

/* ---------- helpers ---------- */
function toast(msg){ const el=document.getElementById('toast'); el.textContent=msg; el.classList.add('show');
  clearTimeout(el._t); el._t=setTimeout(()=>el.classList.remove('show'),2600); }
function esc(s){ return (s||'').replace(/[&<>"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c])); }
function initials(name){ return (name||'?').trim().split(/\s+/).slice(0,2).map(w=>w[0]).join('').toUpperCase(); }
function timeAgo(ts){ const s=(now()-ts)/1000; if(s<60)return'just now'; const m=s/60; if(m<60)return Math.floor(m)+'m ago';
  const h=m/60; if(h<24)return Math.floor(h)+'h ago'; const d=h/24; if(d<30)return Math.floor(d)+'d ago'; return Math.floor(d/30)+'mo ago'; }
function freeState(b){ const t=now();
  if(t<b.freeStart) return {state:'soon', txt:'Drops '+new Date(b.freeStart).toLocaleDateString(undefined,{month:'short',day:'numeric'})};
  if(t<=b.freeEnd){ const left=b.freeEnd-t; const days=Math.floor(left/86400000); const hrs=Math.floor((left%86400000)/3600000);
    return {state:'live', txt: days>0 ? `Free · ${days}d ${hrs}h left` : `Free · ${hrs}h left`}; }
  return {state:'closed', txt:'Window closed'};
}
function coverStyle(ci){ const c=COVERS[ci%COVERS.length]; return `background:linear-gradient(150deg,${c[0]},${c[1]})`; }

/* Amazon review-policy disclaimers. The free book buys honest in-app feedback
   to the author and community membership — never a retail review. Koinita never
   requests, requires, rewards, or influences reviews on any retailer. */
function reviewDisclaimer(variant){
  if(variant==='footer'){
    return `<p style="font-size:12px;color:var(--ink-faint);line-height:1.6;max-width:90ch;margin:14px 0 0">
      Koinita offers full, free books to support honest author feedback and a reading community. Membership and free books are never conditioned on writing a review — positive or otherwise — on Amazon or any other retailer, and Koinita does not request, require, reward, or attempt to influence such reviews. Any review a member chooses to post elsewhere is entirely their own independent and honest decision. Koinita is not affiliated with or endorsed by Amazon.</p>`;
  }
