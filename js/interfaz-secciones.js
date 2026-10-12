'use strict';
/* =====================================================================
   SECCIONES DE PERSONAJES.
   El usuario crea secciones para ordenar la lista de personajes. Cada
   personaje está en una sola sección (o en «Sin sección»). Las secciones se
   pueden plegar, mover, renombrar y deshabilitar enteras con un checkbox:
   un personaje participa solo si él y su sección están habilitados, así que
   volver a habilitar la sección respeta lo que cada personaje tenía.
   Se arrastra desde el asa ⠿ (también con el dedo). El orden de los
   personajes dentro de la sección es el de la lista general P.chars.
   ===================================================================== */
ui.noSecClosed=false;
const secById=id=>P.sections.find(s=>s.id===id)||null;
const secOptsHTML=cur=>`<option value="">Sin sección</option>`+P.sections.map(s=>`<option value="${s.id}" ${cur===s.id?'selected':''}>${esc(s.name.trim()||'Sin nombre')}</option>`).join('');
const secName=s=>s.name.trim()||'Sin nombre';
function secToolsHTML(){
  if(!P.sections.length) return '';
  return `<div class="acts sgtools"><button type="button" class="btn sm" data-act="sec-fold-all">Plegar todas</button><button type="button" class="btn sm" data-act="sec-unfold-all">Desplegar todas</button></div>`;
}
function secBlock(sec,list){
  const id=sec?sec.id:'',virtual=!sec;
  const closed=virtual?ui.noSecClosed:sec.closed,on=virtual?true:sec.enabled;
  const all=P.chars.filter(c=>c.sec===id),nOn=all.filter(charOn).length;
  const cnt=`${plural(all.length,'personaje','personajes')}${all.length&&nOn!==all.length?` · ${nOn} participan`:''}${list.length!==all.length?` · ${list.length} mostrados`:''}`;
  const fold=`<button type="button" class="x fold" data-act="sec-fold" data-id="${id}" aria-expanded="${!closed}" aria-label="${closed?'Desplegar':'Plegar'} sección">${closed?'▸':'▾'}</button>`;
  let head;
  if(virtual) head=`${fold}<b class="sg-t">Sin sección</b><span class="chip">${cnt}</span>`;
  else{
    const i=P.sections.indexOf(sec),n=P.sections.length;
    head=`${fold}<input type="checkbox" class="sg-on" data-bind="sec-on" data-id="${id}" ${on?'checked':''} aria-label="Sección habilitada: ${esc(secName(sec))}" title="Habilitar o deshabilitar toda la sección">
    <input type="text" class="sg-name" value="${esc(sec.name)}" placeholder="Nombre de la sección" data-bind="sec-name" data-id="${id}" aria-label="Nombre de la sección" autocomplete="off">
    <span class="chip">${cnt}</span>${on?'':'<span class="chip warn">Deshabilitada</span>'}
    <span class="acts">${ui.selMode?`<button type="button" class="btn sm" data-act="sec-select" data-id="${id}">Seleccionar</button>`:''}<button type="button" class="btn sm" data-act="sec-newchar" data-id="${id}" title="Nuevo personaje en esta sección">＋ Personaje</button>
    <button type="button" class="x" data-act="sec-up" data-id="${id}" aria-label="Subir sección" ${i===0?'disabled':''}>▲</button><button type="button" class="x" data-act="sec-down" data-id="${id}" aria-label="Bajar sección" ${i===n-1?'disabled':''}>▼</button>
    <button type="button" class="x" data-act="sec-del" data-id="${id}" data-confirm="¿Eliminar? Tocá otra vez" aria-label="Eliminar sección (los personajes quedan sin sección)">✕</button><button type="button" class="sgd" data-drag="sec" data-id="${id}" aria-label="Mover sección" title="Arrastrar para mover">⠿</button></span>`;
  }
  return `<section class="sg ${closed?'closed':''} ${on?'':'off'}" data-sec="${id}" ${virtual?'data-virtual="1"':''}><div class="sg-h">${head}</div>
  <div class="grid sgb" data-secz="${id}" ${closed?'hidden':''}>${list.map(charCard).join('')||'<p class="dz-empty">Arrastrá personajes acá.</p>'}</div></section>`;
}
function secListHTML(L){
  if(!P.sections.length) return `<div class="grid" data-secz="">${L.map(charCard).join('')}</div>`;
  const filtering=L.length!==P.chars.length;
  const blocks=P.sections.concat([null]).map(s=>{
    const list=L.filter(c=>c.sec===(s?s.id:''));
    if(filtering&&!list.length) return '';
    if(!s&&!list.length&&!P.chars.some(c=>!c.sec)&&P.sections.length) return secBlock(null,list);
    return secBlock(s,list);
  });
  return blocks.join('');
}
const keepFocus=(sel)=>{const el=document.querySelector(sel);if(el)el.focus();};
const secAfter=()=>{refreshList('chars');};
Object.assign(ACT,{
  'sec-new'(){
    const s={id:uid(),name:'Sección '+(P.sections.length+1),closed:false,enabled:true};
    P.sections.push(s);structural();
    const f=document.querySelector(`.sg-name[data-id="${s.id}"]`);if(f){f.focus();f.select();}
  },
  'sec-fold'(b){
    const s=secById(b.dataset.id);
    if(s)s.closed=!s.closed;else ui.noSecClosed=!ui.noSecClosed;
    touch();secAfter();
  },
  'sec-fold-all'(){P.sections.forEach(s=>{s.closed=true;});ui.noSecClosed=true;touch();secAfter();},
  'sec-unfold-all'(){P.sections.forEach(s=>{s.closed=false;});ui.noSecClosed=false;touch();secAfter();},
  'sec-up'(b){moveSec(b.dataset.id,-1);},
  'sec-down'(b){moveSec(b.dataset.id,1);},
  'sec-del'(b){
    const id=b.dataset.id;
    P.chars.forEach(c=>{if(c.sec===id)c.sec='';});
    P.sections=P.sections.filter(s=>s.id!==id);
    structural();toast('Sección eliminada: sus personajes quedaron sin sección');
  },
  'sec-newchar'(b){
    const c=blankChar('');c.sec=b.dataset.id;
    P.chars.push(c);ui.char=c.id;structural();window.scrollTo(0,0);
    const f=$('#c-name');if(f)f.focus();
  },
  'sec-select'(b){charsFiltered().filter(c=>c.sec===b.dataset.id).forEach(c=>ui.sel.add(c.id));refreshList('chars');},
  'sel-move'(){
    const v=$('#sel-sec').value,L=selChars();
    if(!L.length){toast('No hay personajes seleccionados');return;}
    L.forEach(c=>{c.sec=v;});structural();
  }
});
Object.assign(BIND,{
  'sec-name'(t){
    const s=secById(t.dataset.id);if(!s)return;
    s.name=t.value;touch();
    document.querySelectorAll(`#sel-sec option[value="${s.id}"],#c-sec option[value="${s.id}"]`).forEach(o=>{o.textContent=secName(s);});
  },
  'sec-on'(t){
    const s=secById(t.dataset.id);if(!s)return;
    s.enabled=t.checked;touch();secAfter();
    keepFocus(`.sg-on[data-id="${s.id}"]`);
  },
  'char-on'(t){
    const c=P.chars.find(x=>x.id===t.dataset.id);if(!c)return;
    c.enabled=t.checked;touch();secAfter();
    keepFocus(`.ctog[data-id="${c.id}"]`);
  }
});
function moveSec(id,d){
  const i=P.sections.findIndex(s=>s.id===id),j=i+d;
  if(i<0||j<0||j>=P.sections.length)return;
  P.sections.splice(j,0,P.sections.splice(i,1)[0]);
  structural();
  const b=document.querySelector(`[data-act="${d<0?'sec-up':'sec-down'}"][data-id="${id}"]`);if(b&&!b.disabled)b.focus();
}

/* ---------- Arrastrar personajes y secciones ---------- */
/* Mueve un personaje a la sección `sec`: antes o después de `ref`, o al final de la sección. */
function moveChar(id,sec,ref,before){
  const i=P.chars.findIndex(c=>c.id===id);if(i<0)return false;
  const c=P.chars.splice(i,1)[0];c.sec=sec;
  let j=-1;
  if(ref){j=P.chars.findIndex(x=>x.id===ref);if(j>=0&&!before)j++;}
  if(j<0){let last=-1;P.chars.forEach((x,k)=>{if(x.sec===sec)last=k;});j=last>=0?last+1:P.chars.length;}
  P.chars.splice(j,0,c);
  return true;
}
function moveSecTo(id,ref,before){
  const i=P.sections.findIndex(s=>s.id===id);if(i<0)return false;
  const s=P.sections.splice(i,1)[0];
  let j=ref?P.sections.findIndex(x=>x.id===ref):-1;
  if(j<0)j=P.sections.length;else if(!before)j++;
  P.sections.splice(j,0,s);
  return true;
}
let cd=null;
const dragFree=()=>!(ui.sort.chars||ui.letter.chars);   // con orden A→Z o letra, solo se cambia de sección
function charSpot(x,y){
  const el=document.elementFromPoint(x,y);if(!el)return null;
  const sg=el.closest('.sg');
  const z=el.closest('[data-secz]')||(sg?sg.querySelector('[data-secz]'):null);
  if(!z)return null;
  const sec=z.dataset.secz;
  if(z.hidden) return {sec,ref:null,hl:sg.querySelector('.sg-h')};
  const cards=[...z.querySelectorAll('.cwrap')].filter(c=>c.dataset.cid!==cd.id);
  if(!cards.length||!dragFree()) return {sec,ref:null,hl:z};
  let best=null,bd=1e9;
  cards.forEach(c=>{
    const r=c.getBoundingClientRect();
    const dx=Math.max(r.left-x,0,x-r.right),dy=Math.max(r.top-y,0,y-r.bottom),d=Math.hypot(dx,dy);
    if(d<bd){bd=d;best={c,r};}
  });
  const r=best.r,before=y<r.top?true:y>r.bottom?false:x<r.left+r.width/2;
  return {sec,ref:best.c.dataset.cid,before,line:{left:before?r.left-5:r.right+2,top:r.top,height:r.height,vertical:true}};
}
function secSpot(x,y){
  const el=document.elementFromPoint(x,y);if(!el)return null;
  const sg=el.closest('.sg');if(!sg)return null;
  if(sg.dataset.virtual||sg.dataset.sec===cd.id){
    if(sg.dataset.sec===cd.id)return null;
    const last=[...document.querySelectorAll('#list .sg:not([data-virtual])')].filter(s=>s.dataset.sec!==cd.id).pop();
    if(!last)return null;
    const r=last.getBoundingClientRect();
    return {ref:last.dataset.sec,before:false,line:{left:r.left,top:r.bottom+3,width:r.width}};
  }
  const r=sg.getBoundingClientRect(),before=y<r.top+Math.min(r.height/2,60);
  return {ref:sg.dataset.sec,before,line:{left:r.left,top:before?r.top-3:r.bottom+3,width:r.width}};
}
function cdMark(){
  if(!cd||!cd.active)return;
  document.querySelectorAll('.dz-on,.sg-hl').forEach(z=>z.classList.remove('dz-on','sg-hl'));
  const s=cd.kind==='char'?charSpot(cd.x,cd.y):secSpot(cd.x,cd.y);
  cd.spot=s;
  if(!s){cd.line.hidden=true;return;}
  if(s.hl){s.hl.classList.add(s.hl.classList.contains('sg-h')?'sg-hl':'dz-on');cd.line.hidden=true;return;}
  cd.line.hidden=false;
  const l=s.line,st=cd.line.style;
  st.left=l.left+'px';st.top=l.top+'px';
  if(l.vertical){st.width='4px';st.height=l.height+'px';st.marginTop='0';}
  else{st.width=l.width+'px';st.height='4px';st.marginTop='-2px';}
}
function cdEnd(){
  if(!cd)return;
  clearInterval(cd.scroll);
  if(cd.ghost)cd.ghost.remove();
  if(cd.line)cd.line.remove();
  document.querySelectorAll('.dz-on,.sg-hl').forEach(z=>z.classList.remove('dz-on','sg-hl'));
  document.querySelectorAll('.cdragging').forEach(z=>z.classList.remove('cdragging'));
  document.body.classList.remove('dragging-now');
  cd=null;
}
document.addEventListener('pointerdown',ev=>{
  const h=ev.target.closest&&ev.target.closest('[data-drag]');
  if(!h||ev.button>0)return;
  ev.preventDefault();
  try{h.setPointerCapture(ev.pointerId);}catch(e){}
  cd={kind:h.dataset.drag,id:h.dataset.id,sx:ev.clientX,sy:ev.clientY,x:ev.clientX,y:ev.clientY,active:false,pid:ev.pointerId,spot:null,h};
});
document.addEventListener('pointermove',ev=>{
  if(!cd||ev.pointerId!==cd.pid)return;
  cd.x=ev.clientX;cd.y=ev.clientY;
  if(!cd.active){
    if(Math.hypot(cd.x-cd.sx,cd.y-cd.sy)<6)return;
    cd.active=true;
    const g=document.createElement('div');g.className='ghost';
    const c=cd.kind==='char'?P.chars.find(x=>x.id===cd.id):secById(cd.id);
    g.textContent=c?(cd.kind==='char'?nm(c):secName(c)):'…';
    document.body.appendChild(g);cd.ghost=g;
    const l=document.createElement('div');l.className='drop-line';l.hidden=true;document.body.appendChild(l);cd.line=l;
    const box=cd.h.closest(cd.kind==='char'?'.cwrap':'.sg');if(box)box.classList.add('cdragging');
    document.body.classList.add('dragging-now');
    cd.scroll=setInterval(()=>{
      if(!cd)return;
      const m=70;
      if(cd.y<m)window.scrollBy(0,-Math.ceil((m-cd.y)/4));
      else if(cd.y>innerHeight-m)window.scrollBy(0,Math.ceil((cd.y-(innerHeight-m))/4));
      cdMark();
    },40);
  }
  cd.ghost.style.left=(cd.x+12)+'px';cd.ghost.style.top=(cd.y+12)+'px';
  cdMark();
});
function cdFinish(ev,cancel){
  if(!cd||(ev&&ev.pointerId!==cd.pid))return;
  const d=cd,s=d.spot;
  cdEnd();
  if(cancel||!d.active||!s)return;
  const ok=d.kind==='char'?moveChar(d.id,s.sec,s.ref,s.before):moveSecTo(d.id,s.ref,s.before);
  if(ok)structural();
}
document.addEventListener('pointerup',ev=>cdFinish(ev,false));
document.addEventListener('pointercancel',ev=>cdFinish(ev,true));
document.addEventListener('keydown',ev=>{if(ev.key==='Escape'&&cd)cdFinish(null,true);});
