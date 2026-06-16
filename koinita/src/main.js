// Source file — assembled into koinita-duda.html
// Production: swap localStorage (DB.*) calls for Supabase queries.

DB = load();
render();
// refresh countdowns every minute
setInterval(()=>{ if(['home','discover','shelf','mybooks'].includes(route.view)) render(); }, 60000);
