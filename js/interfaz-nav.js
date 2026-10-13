'use strict';
/* =====================================================================
   NAVEGAR ENTRE ELEMENTOS. Al abrir un personaje, un equipo, un estado o un
   evento aparecen dos botones (anterior / siguiente) para pasar al de al lado
   sin volver a la lista. Respetan el orden y los filtros de la lista.
   ===================================================================== */
const NAV={
  char:{list:()=>charsFiltered(),all:()=>P.chars,key:'char',noun:'personaje'},
  team:{list:()=>teamsFiltered(),all:()=>P.teams,key:'team',noun:'equipo'},
  state:{list:()=>statesFiltered(),all:()=>P.states,key:'state',noun:'estado'},
  item:{list:()=>itemsFiltered(),all:()=>P.items,key:'item',noun:'objeto'},
  ev:{list:()=>eventsFiltered(),all:()=>P.events,key:'ev',noun:'evento'}
};
function navHTML(kind){
  const n=NAV[kind];if(!n) return '';
  let L=n.list();
  if(!L.some(x=>x.id===ui[n.key])) L=n.all();
  const i=L.findIndex(x=>x.id===ui[n.key]);
  if(i<0||L.length<2) return '';
  const prev=L[(i-1+L.length)%L.length],next=L[(i+1)%L.length];
  return `<nav class="pn" aria-label="Moverse entre ${n.noun}s"><button type="button" class="btn" data-act="nav-go" data-kind="${kind}" data-id="${esc(prev.id)}" aria-label="${n.noun} anterior">‹ Anterior</button><span class="hint">${i+1} de ${L.length}</span><button type="button" class="btn" data-act="nav-go" data-kind="${kind}" data-id="${esc(next.id)}" aria-label="${n.noun} siguiente">Siguiente ›</button></nav>`;
}
/* Pone la botonera arriba (debajo de la barra de título) y abajo del formulario. */
function withNav(kind,html){
  const nav=navHTML(kind);
  if(!nav) return html;
  const k=html.indexOf('</div>');
  return k<0?html:html.slice(0,k+6)+nav+html.slice(k+6)+nav;
}
Object.assign(ACT,{
  'nav-go'(b){
    const n=NAV[b.dataset.kind];if(!n) return;
    /* igual que «volver»: un nombre vacío se rellena para no perder el elemento */
    const cur=n.all().find(x=>x.id===ui[n.key]);
    if(cur&&'name' in cur&&!String(cur.name).trim()){cur.name=n.noun+' '+(n.all().indexOf(cur)+1);touch();}
    ui[n.key]=b.dataset.id;
    if(n.key==='team') ui.q.members='';
    render();window.scrollTo(0,0);
  }
});
