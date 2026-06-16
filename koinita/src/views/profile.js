// Source file — assembled into koinita-duda.html
// Production: swap localStorage (DB.*) calls for Supabase queries.

function viewMemberProfile(id){
  const u = userById(id); const m=me();
  if(!u) return notFound();
  const isMe = m && m.id===u.id;
  const isAuthor = u.role==='author';
  const books = DB.books.filter(b=>b.authorUserId===u.id);
  const posts = DB.posts.filter(p=>p.authorId===u.id).sort((a,b)=>b.at-a.at);
  const followers = followersOf(u.id).length;
  const following = followingOf(u.id).length;
  const following_me = m && isFollowing(m.id, u.id);
  const verified = isAuthor? `<span class="chip verified">✓ Verified author</span>` : `<span class="chip">📚 Reader</span>`;
  const followBtn = (!m || isMe)? '' :
    `<button class="follow-btn ${following_me?'following':''}" onclick="toggleFollow('${u.id}')">${following_me?'✓ Following':'+ Follow'}</button>`;
  return `<div class="app ${isAuthor?'author-mode':''}"><div class="wrap">
    <button class="btn btn-ghost btn-sm" style="margin-bottom:22px" onclick="history.length>1?history.back():go('feed')">← Back</button>
    <div class="profile-head">
      <div class="big-av" style="background:${u.avatar}">${initials(u.name)}</div>
      <div style="flex:1">
        <h1>${esc(u.name)} ${verified}${isAuthor&&u.inhouse?'<span class="chip" style="background:var(--gold);color:#fff">✦ Axitos</span>':''}</h1>
        <div class="counts">
          <span><b>${followers}</b> followers</span>
          <span><b>${following}</b> following</span>
          ${isAuthor?`<span><b>${books.length}</b> ${books.length===1?'book':'books'}</span>`:''}
        </div>
      </div>
      ${isMe?`<button class="btn btn-ghost btn-sm" onclick="go('profile')">Edit profile</button>`:followBtn}
    </div>
    <p class="blurb" style="max-width:62ch">${esc(u.bio)}</p>

    ${isAuthor && books.length?`
      <h2 style="font-size:22px;margin:30px 0 18px">Books by ${esc(u.name.split(' ')[0])}</h2>
      <div class="grid">${books.map(bookCard).join('')}</div>`:''}

    <h2 style="font-size:22px;margin:34px 0 18px">${isMe?'Your':esc(u.name.split(' ')[0])+'\u2019s'} notes ${isAuthor?'from behind the page':''}</h2>
    ${isMe?composeBox(''):''}
    ${posts.length? posts.map(postCard).join('')
      : `<div class="empty" style="padding:40px"><div class="ic">✍️</div><h3>No notes yet</h3><p>${isMe?'Share a short note about a book you\u2019re reading or writing.':'Nothing posted yet.'}</p></div>`}
  </div></div>`;
}
