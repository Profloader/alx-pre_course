// Source file — assembled into koinita-duda.html
// Production: swap localStorage (DB.*) calls for Supabase queries.

function claimShelf(id){ const m=me(); if(!m.shelf.includes(id)){ m.shelf.push(id); save(DB);} }
function markClaimed(id){ const m=me(); if(!m.shelf.includes(id)){ m.shelf.push(id); save(DB); toast('Claimed — feedback unlocked'); } render(); }
function remindMe(id){ toast('We\'ll alert you the moment it drops 🔔'); }
function viewShelf(){
  const m=me();
  const books = m.shelf.map(bookById).filter(Boolean);
  return `<div class="app"><div class="wrap">
    <div class="app-head"><div><h1>My shelf</h1><p>Books you've claimed. They're yours to keep.</p></div></div>
    ${books.length?`<div class="grid">${books.map(bookCard).join('')}</div>`
      :`<div class="empty"><div class="ic">📚</div><h3>Your shelf is waiting</h3><p>Claim a live title and it lands here, yours forever.</p>
        <button class="btn btn-amber" onclick="go('discover')">Find a free book</button></div>`}
  </div></div>`;
}
