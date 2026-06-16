// Source file — assembled into koinita-duda.html
// Production: swap localStorage (DB.*) calls for Supabase queries.

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
function coverStyle(ci){ const c=COVERS[ci%COVERS.length]; return `background:linear-gradient(150deg,${c[0]}
