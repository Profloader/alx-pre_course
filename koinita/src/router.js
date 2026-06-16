// Source file — assembled into koinita-duda.html
// Production: swap localStorage (DB.*) calls for Supabase queries.

let route = {view:'home', param:null};
function go(view,param){ route={view,param:param||null}; document.getElementById('navlinks').classList.remove('open');
  window.scrollTo(0,0); render(); }

function render(){
  renderNav();
  const root = document.getElementById('root');
  const m = me();
  // a suspended member only ever sees the appeal screen
  if(m && m.banned && route.view!=='appeal'){ root.innerHTML = viewAppeal(); return; }
  let html='';
  switch(route.view){
    case 'home': html = m ? viewDashboard() : viewLanding(); break;
    case 'discover': html = viewDiscover(); break;
    case 'book': html = viewBook(route.param); break;
    case 'author': html = viewMemberProfile(route.param); break;
    case 'member': html = viewMemberProfile(route.param); break;
    case 'feed': html = viewFeed(); break;
    case 'search': html = viewSearch(); break;
    case 'notifications': html = viewNotifications(); break;
    case 'circles': html = viewCircles(); break;
    case 'circle': html = viewCircle(route.param); break;
    case 'shelf': html = viewShelf(); break;
    case 'messages': html = viewMessages(); break;
    case 'inbox': html = viewInbox(); break;
    case 'mybooks': html = viewMyBooks(); break;
    case 'plans': html = viewPlans(); break;
    case 'admin': html = isAdmin()? viewAdmin() : viewLanding(); break;
    case 'appeal': html = viewAppeal(); break;
    case 'profile': html = viewProfile(); break;
    default: html = viewLanding();
  }
  root.innerHTML = html;
}
