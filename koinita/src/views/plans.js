// Source file — assembled into koinita-duda.html
// Production: swap localStorage (DB.*) calls for Supabase queries.

function viewPlans(){
  const m=me();
  const isAuthor = m && m.role==='author';
  const current = isAuthor? planOf(m).id : null;
  const launch = !(MONETIZATION_ENABLED||monetizationPreview);
  const card = (p, highlight)=>`
    <div class="step" style="border-color:${highlight?p.accent:'var(--line)'};border-width:${highlight?'2px':'1px'};position:relative">
      ${current===p.id?`<span class="chip" style="position:absolute;top:-11px;right:16px;background:${p.accent};color:#fff">Your plan</span>`:''}
      <div class="n" style="color:${p.accent}">${p.name.toUpperCase()}</div>
      <div style="font-family:var(--display);font-size:34px;margin:8px 0 2px">${p.price===0?'Free':'$'+p.price}<span style="font-size:14px;color:var(--ink-faint);font-family:var(--body)">${p.period}</span></div>
      <p style="color:var(--ink-soft);font-size:14px;margin:0 0 16px">${p.tagline}</p>
      <ul style="list-style:none;padding:0;margin:0 0 18px;font-size:14px;color:var(--ink-soft);display:flex;flex-direction:column;gap:9px">
        <li>📚 ${p.maxListings===Infinity?'Unlimited':p.maxListings} active ${p.maxListings===1?'listing':'listings'}</li>
        <li>${p.analytics?'📈 Reader analytics':'<span style="opacity:.5">No analytics</span>'}</li>
        <li>${p.featured?'✦ Featured placement':'<span style="opacity:.5">Standard placement</span>'}</li>
        <li>👥 Up to ${p.readerTeam===Infinity?'unlimited':p.readerTeam} reader team</li>
        <li>${p.prioritySupport?'⚡ Priority support':'<span style="opacity:.5">Standard support</span>'}</li>
      </ul>
      ${isAuthor && !m.inhouse ? (current===p.id
          ? '<button class="btn btn-ghost btn-block" disabled>Current plan</button>'
          : `<button class="btn ${highlight?'btn-spine':'btn-ghost'} btn-block" onclick="startCheckout('${p.id}')">${p.price===0?'Switch to Free':'Choose '+p.name}</button>`)
        : (isAuthor?'':'<button class="btn btn-amber btn-block" onclick="openAuth(\'signup\',\'author\')">Join as an author</button>')}
    </div>`;
  return `<div class="app author-mode"><div class="wrap">
    <div class="app-head"><div><h1>Plans &amp; billing</h1><p>Readers are always free. These plans are for authors — and they're how Koinita sustains itself.</p></div></div>

    ${launch?`<div class="panel" style="background:var(--spine-wash);border-color:#CFE0D8;margin-top:0">
      <h3 style="color:var(--spine-deep)">✦ Launch mode — everything below is free right now</h3>
      <p class="sub" style="margin:0">Every author feature is unlocked while Koinita grows. These tiers switch on later, and you will never lose access you already have.${m&&m.inhouse?' As an Axitos in-house author, your access stays free, always.':''}</p>
    </div>`:''}

    <div class="steps" style="margin-top:22px">
      ${card(PLANS.starter,false)}
      ${card(PLANS.indie,true)}
      ${card(PLANS.pro,false)}
    </div>

    ${m&&m.inhouse?`<div class="panel"><h3>✦ ${INHOUSE_PLAN.name}</h3><p class="sub" style="margin:0">${INHOUSE_PLAN.tagline} Books published through Axitos get full access at no cost.</p></div>`:''}

    <div class="panel">
      <h3>How billing will work</h3>
      <p class="sub" style="margin:0">Payments run through Stripe. Choosing a paid plan opens Stripe Checkout; a webhook records your plan and unlocks features instantly. Change or cancel anytime from the billing portal. <b>Readers never pay.</b></p>
    </div>

    <!-- DEV PREVIEW: experience tier gating without changing the live launch setting. Remove before production. -->
    <div class="panel" style="border-style:dashed;background:var(--paper-2)">
      <h3 style="font-size:15px">🛠 Preview tier gating (dev only)</h3>
      <p class="sub">Turn this on to see exactly what authors experience once paid tiers go live. It only affects your screen, never real members. Currently <b>${monetizationPreview?'ON':'OFF'}</b>.</p>
      <button class="btn btn-ghost btn-sm" onclick="togglePreview()">${monetizationPreview?'Turn preview OFF':'Turn preview ON'}</button>
    </div>
  </div></div>`;
}

function startCheckout(planId){
  /* PRODUCTION — replace the demo below with a real Stripe Checkout call:
       const res = await fetch('/functions/v1/create-checkout-session', {
         method:'POST',
         headers:{ Authorization:'Bearer '+session.access_token },
         body: JSON.stringify({ plan: planId })
       });
       const { url } = await res.json();
       window.location = url;            // Stripe-hosted Checkout
     A Stripe webhook then writes the new plan to the author_plan column in
     Supabase on payment success, and the gate helpers pick it up automatically. */
  const m=me(); if(!m || m.role!=='author' || m.inhouse) return;
  if(!(MONETIZATION_ENABLED||monetizationPreview)){ toast('Launch mode: every feature is already free.'); return; }
  m.plan=planId; save(DB);
  toast('Now on '+PLANS[planId].name+' — Stripe Checkout runs here in production'); render();
}
function togglePreview(){ monetizationPreview=!monetizationPreview; toast(monetizationPreview?'Tier gating preview ON':'Preview OFF'); render(); }
