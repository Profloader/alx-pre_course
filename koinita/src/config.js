// Source file — assembled into koinita-duda.html
// Production: swap localStorage (DB.*) calls for Supabase queries.

const KEY = 'koinita_v5';
const COVERS = [
  ['#2E5E4E','#1F4438'],['#D9541F','#A83B0F'],['#3A3D8C','#26285C'],
  ['#8C2F4A','#5E1E31'],['#1F6F7A','#114049'],['#7A5A2E','#4E3A1C'],
  ['#5B3A8C','#3A2459'],['#2B6B45','#194229'],['#B5862F','#7A5A1C']
];
const AVS = ['#D9541F','#2E5E4E','#3A3D8C','#8C2F4A','#1F6F7A','#7A5A2E','#5B3A8C','#B5862F'];
const GENRES = ['Literary Fiction','Mystery','Sci-Fi','Romance','Non-Fiction','Self-Growth','Fantasy','Thriller','History'];

/* ====================================================================
   MONETIZATION HOOKS  (built now, dormant at launch)
   --------------------------------------------------------------------
   MODEL (NetGalley-style): readers are ALWAYS free, with no gate, ever.
   Money comes from the author side only. Every gate below already exists
   in the code; at launch MONETIZATION_ENABLED is false, so every author
   gets full access. Flipping it to true enforces the tiers — a config
   change, not a rebuild.

   PRODUCTION BILLING: Supabase doesn't bill on its own. Enable the Stripe
   wrapper in the Supabase dashboard, create one Edge Function that opens a
   Stripe Checkout Session, and let a Stripe webhook write the resulting
   plan back to the author's `author_plan` column. The helpers below
   (planOf / gatesActive / canAddBook / hasFeature) are the single place
   that reads `author_plan` — point them at the synced column and the whole
   app gates correctly.
   ==================================================================== */
const MONETIZATION_ENABLED = false;     // ← launch = false. Set true to switch tiers on.
let   monetizationPreview   = false;     // dev-only runtime preview; never affects real members.

const PLANS = {
  starter: { id:'starter', name:'Starter',      price:0,  period:'',    accent:'var(--ink-soft)',
    tagline:'Get your first book in front of real readers.',
    maxListings:1,  analytics:false, featured:false, readerTeam:25,   prioritySupport:false },
  indie:   { id:'indie',   name:'Indie Author',  price:19, period:'/mo', accent:'var(--amber)',
    tagline:'For working authors building a readership.',
    maxListings:5,  analytics:true,  featured:false, readerTeam:150,  prioritySupport:false },
  pro:     { id:'pro',     name:'Author Pro',    price:49, period:'/mo', accent:'var(--spine)',
    tagline:'Maximum reach, data, and featured placement.',
    maxListings:25, analytics:true,  featured:true,  readerTeam:1000, prioritySupport:true }
};
const INHOUSE_PLAN = { id:'inhouse', name:'Axitos (In-House)', price:0, period:'', accent:'var(--gold)',
  tagline:'Published by Axitos — full access, always free.',
  maxListings:Infinity, analytics:true, featured:true, readerTeam:Infinity, prioritySupport:true };

function gatesActive(u){ return (MONETIZATION_ENABLED || monetizationPreview) && u && u.role==='author' && !u.inhouse; }
function planOf(u){ if(!u||u.role!=='author') return null; if(u.inhouse) return INHOUSE_PLAN; return PLANS[u.plan||'starter']; }
function listingLimit(u){ return gatesActive(u)? planOf(u).maxListings : Infinity; }
function listingsUsed(u){ return DB.books.filter(b=>b.authorUserId===u.id).length; }
function canAddBook(u){ return listingsUsed(u) < listingLimit(u); }
function hasFeature(u,key){ if(!gatesActive(u)) return true; return !!planOf(u)[key]; }
