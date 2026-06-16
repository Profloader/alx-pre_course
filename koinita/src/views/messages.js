// Source file — assembled into koinita-duda.html
// Production: swap localStorage (DB.*) calls for Supabase queries.

function submitFeedback(bookId){
  const m=me(); const b=bookById(bookId);
  if(!m.shelf.includes(bookId)){ toast('Claim the book first to share feedback.'); return; }
  if(DB.threads.find(t=>t.bookId===bookId && t.readerId===m.id)){ toast('You\u2019ve already shared feedback on this book.'); render(); return; }
  const liked=(document.getElementById('fb_liked').value||'').trim();
  const improve=(document.getElementById('fb_improve').value||'').trim();
  const question=(document.getElementById('fb_question').value||'').trim();
  if(!fbRating && !liked && !improve && !question){ toast('Add a rating or a few words first.'); return; }
  // Automated moderation gate (no human queue) — block & ask to rephrase if flagged
  const mod = enforce([liked,improve,question].join('  '));
  if(!mod.ok){ return; }
  const cLiked=(moderate(liked).clean||'').trim();
  const cImprove=(moderate(improve).clean||'').trim();
  const cQuestion=(moderate(question).clean||'').trim();
  const t={ id:uid('t'), bookId, readerId:m.id, authorUserId:b.authorUserId,
    subject:'Feedback on '+b.title, rating:fbRating, liked:cLiked, improve:cImprove,
    messages:[], created:now(), updated:now() };
  if(cQuestion) t.messages.push({from:'reader', userId:m.id, text:cQuestion, at:now()});
  DB.threads.push(t); fbRating=0;
  if(b.authorUserId) notify(b.authorUserId,'feedback',m.id,'shared feedback on '+b.title,t.id);
  save(DB); toast('Shared with '+userById(b.authorUserId).name.split(' ')[0]+' \u2726'); render();
}

function viewMessages(){ // reader side
  const m=me();
  const ts = DB.threads.filter(t=>t.readerId===m.id).sort((a,b)=>b.updated-a.updated);
  return `<div class="app"><div class="wrap">
    <div class="app-head"><div><h1>Your conversations</h1><p>Feedback and questions you've shared with authors.</p></div></div>
    ${ts.length? ts.map(t=>threadBlock(t,'reader')).join('')
      : `<div class="empty"><div class="ic">💬</div><h3>No conversations yet</h3><p>Claim a book, then share feedback and one question to start a conversation with its author.</p>
        <button class="btn btn-amber" onclick="go('discover')">Browse books</button></div>`}
  </div></div>`;
}

function viewInbox(){ // author side
  const m=me();
  const ts = DB.threads.filter(t=>t.authorUserId===m.id).sort((a,b)=>b.updated-a.updated);
  const waiting = ts.filter(t=>{ const last=t.messages[t.messages.length-1]; return !last || last.from==='reader'; });
  return `<div class="app author-mode"><div class="wrap">
    <div class="app-head"><div><h1>Reader inbox</h1><p>${waiting.length} ${waiting.length===1?'reader is':'readers are'} waiting to hear back from you.</p></div></div>
    ${ts.length? ts.map(t=>threadBlock(t,'author')).join('')
      : `<div class="empty"><div class="ic">📨</div><h3>No reader feedback yet</h3><p>When readers claim your books, their ratings, feedback, and questions land here.</p></div>`}
  </div></div>`;
}

function threadBlock(t, sideRole){
  const b = bookById(t.bookId);
  const reader = userById(t.readerId);
  const author = userById(t.authorUserId);
  const last = t.messages[t.messages.length-1];
  const lastFrom = last? last.from : 'reader';
  const open = t._open;
  const otherLabel = sideRole==='author'? esc(reader?reader.name:'Reader') : esc(author?author.name:'Author');
  const stars = (t.rating!=null && t.rating>0)? '★'.repeat(t.rating)+'☆'.repeat(5-t.rating) : '';
  const summary = (stars || t.liked || t.improve)? `
    <div style="padding:14px 18px;border-bottom:1px solid var(--line-soft);background:#fff">
      ${stars?`<div style="color:var(--amber);font-size:18px;letter-spacing:3px;margin-bottom:6px">${stars}</div>`:''}
      ${t.liked?`<p style="margin:0 0 6px;font-size:14px"><b style="color:var(--spine-deep)">What worked:</b> ${esc(t.liked)}</p>`:''}
      ${t.improve?`<p style="margin:0;font-size:14px"><b style="color:var(--amber-deep)">Could be better:</b> ${esc(t.improve)}</p>`:''}
    </div>`:'';
  return `<div class="thread">
    <div class="t-head" onclick="toggleThread('${t.id}')">
      <div><b>${esc(t.subject)}</b><br><span>${esc(b?b.title:'')} · with ${otherLabel} · ${timeAgo(t.updated)}</span></div>
      <span>${open?'▲':'▼'} ${lastFrom!==sideRole?'<span class="chip dot live" style="font-size:10px">new</span>':''}</span>
    </div>
    ${open?`
    ${summary}
    ${t.messages.length?`<div class="bubbles">
      ${t.messages.map(msg=>`
        <div class="bubble ${msg.from}">
          <div class="who">${msg.from==='reader'?esc(reader?reader.name:'Reader'):esc(author?author.name:'Author')}</div>
          ${esc(msg.text)}
          <div style="font-size:11px;opacity:.5;margin-top:4px">${timeAgo(msg.at)}</div>
        </div>`).join('')}
    </div>`:`<div style="padding:14px 18px;color:var(--ink-faint);font-size:13.5px">No question asked — reply to start the conversation.</div>`}
    <div class="reply-box">
      <input id="reply_${t.id}" placeholder="${sideRole==='author'?'Reply to your reader…':'Reply…'}" onkeydown="if(event.key==='Enter')sendReply('${t.id}','${sideRole}')">
      <button class="btn ${sideRole==='author'?'btn-spine':'btn-amber'} btn-sm" onclick="sendReply('${t.id}','${sideRole}')">Send</button>
    </div>`:''}
  </div>`;
}
function toggleThread(id){ const t=DB.threads.find(x=>x.id===id); t._open=!t._open; render(); }
function sendReply(id, sideRole){
  const t=DB.threads.find(x=>x.id===id);
  const input=document.getElementById('reply_'+id);
  const txt=(input.value||'').trim(); if(!txt){ return; }
  const mod=enforce(txt);
  if(!mod.ok){ return; }
  t.messages.push({from:sideRole, userId:DB.session, text:mod.clean||txt, at:now()}); t.updated=now(); t._open=true;
  const target = sideRole==='author'? t.readerId : t.authorUserId;
  notify(target,'reply',DB.session,'replied to your conversation',t.id);
  save(DB); toast('Reply sent'); render();
}
/* Author replies stay in-app only (no email handoff, no address exposure). */
