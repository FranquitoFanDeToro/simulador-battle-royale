'use strict';
/* =====================================================================
   EDITOR DE BLOQUES
   Es otra forma de ver y editar lo mismo que el formulario de eventos:
   las condiciones (reglas y grupos) y los efectos son los mismos datos,
   así que se puede cambiar de vista cuando quieras sin perder nada.

   Qué se puede hacer:
     - agregar bloques desde el selector «＋ Agregar bloque…»;
     - arrastrar un bloque con ⠿ (mouse o dedo) a otro lugar o a otro grupo;
     - ▲ ▼ para subir y bajar, ⧉ para duplicar, ✕ para quitar.
   Los colores indican de qué trata cada bloque.
   ===================================================================== */

ui.evView=(()=>{try{return localStorage.getItem('br.evView')==='form'?'form':'blocks';}catch(e){return 'blocks';}})();

/* ---------- Categorías (color) ---------- */
const RULE_CAT={
  gender:'char',status:'char',is:'char',
  state:'state',anystate:'state',
  item:'item',space:'item',teamitem:'item',
  skill:'skill',
  hasstat:'stat',stat:'stat',statvs:'stat',
  emotion:'emo',
  loyalty:'team',inteam:'team',isleader:'team',sameteam:'team',teamsize:'team'
};
const FX_CAT={
  kill:'kill',
  giveItem:'item',removeItem:'item',teamTake:'item',
  giveSkill:'skill',removeSkill:'skill',
  stat:'stat',
  emotion:'emo',emotionClear:'emo',
  loyalty:'team',teamForm:'team',teamJoin:'team',teamLeave:'team',teamShare:'team',
  addState:'state',removeState:'state',clearStates:'state'
};
const CAT_LBL={char:'Personaje',item:'Objetos',skill:'Habilidades',stat:'Stats',emo:'Emociones',state:'Estados alterados',team:'Equipos y lealtad',kill:'Eliminar'};
const CAT_ORDER=['char','item','skill','stat','emo','state','team'];

/* ---------- Dibujo ---------- */
function blkPickerHTML(attrs){
  const rules=CAT_ORDER.map(c=>{
    const ks=KINDS.filter(k=>RULE_CAT[k]===c);
    return ks.length?`<optgroup label="Regla · ${CAT_LBL[c]}">${ks.map(k=>`<option value="r:${k}">${esc(KIND_LBL[k])}</option>`).join('')}</optgroup>`:'';
  }).join('');
  const groups=`<optgroup label="Grupo">${['and','or','not'].map(o=>`<option value="g:${o}">Grupo ${esc(OPS[o])}</option>`).join('')}</optgroup>`;
  return `<select class="addsel" data-bind="blk-add" ${attrs} aria-label="Agregar bloque"><option value="">＋ Agregar bloque…</option>${rules}${groups}</select>`;
}
function fxPickerHTML(L){
  const cats=['kill',...CAT_ORDER];
  const body=cats.map(c=>{
    const ks=Object.keys(FX).filter(k=>FX_CAT[k]===c);
    return ks.length?`<optgroup label="Efecto · ${CAT_LBL[c]}">${ks.map(k=>`<option value="f:${k}">${esc(FX[k].label)}</option>`).join('')}</optgroup>`:'';
  }).join('');
  return `<select class="addsel" data-bind="blk-add" data-zone="f" data-list="${L}" aria-label="Agregar efecto"><option value="">＋ Agregar efecto…</option>${body}</select>`;
}
const HDL='<button type="button" class="hdl" aria-label="Arrastrar para mover" title="Arrastrar para mover">⠿</button>';
function condActs(path){
  const a=`data-kind="c" data-path="${path}"`;
  return `<button type="button" class="x" data-act="blk-up" ${a} aria-label="Subir" title="Subir">▲</button><button type="button" class="x" data-act="blk-down" ${a} aria-label="Bajar" title="Bajar">▼</button><button type="button" class="x" data-act="blk-dup" ${a} aria-label="Duplicar" title="Duplicar">⧉</button><button type="button" class="x" data-act="node-del" data-path="${path}" aria-label="Quitar" title="Quitar">✕</button>`;
}
function fxActs(L,i){
  const a=`data-kind="f" data-list="${L}" data-i="${i}"`;
  return `<button type="button" class="x" data-act="blk-up" ${a} aria-label="Subir" title="Subir">▲</button><button type="button" class="x" data-act="blk-down" ${a} aria-label="Bajar" title="Bajar">▼</button><button type="button" class="x" data-act="blk-dup" ${a} aria-label="Duplicar" title="Duplicar">⧉</button><button type="button" class="x" data-act="fx-del" data-list="${L}" data-i="${i}" aria-label="Quitar" title="Quitar">✕</button>`;
}
function blkNode(e,n,path,depth){
  if(n.t==='g'){
    const root=depth===0;
    const kids=n.c.length?n.c.map((ch,i)=>blkNode(e,ch,path?path+'.'+i:String(i),depth+1)).join(''):`<p class="dz-empty">Sin reglas: siempre se cumple. Agregá un bloque o arrastrá uno acá.</p>`;
    return `<div class="blk grp-blk ${root?'root':''}" data-kind="c" data-path="${path}" data-g="${n.op}">
      <div class="bh">${root?'':HDL}<div class="seg" role="group" aria-label="Tipo de grupo">${['and','or','not'].map(op=>`<button type="button" class="${n.op===op?'on':''}" data-act="g-op" data-path="${path}" data-op="${op}">${OPS[op]}</button>`).join('')}</div>${blkPickerHTML(`data-zone="c" data-path="${path}"`)}${root?'':`<span class="ba">${condActs(path)}</span>`}</div>
      <p class="hint">${EXPL[n.op]}</p>
      <div class="dz" data-zone="c" data-path="${path}">${kids}</div></div>`;
  }
  return `<div class="blk k-${RULE_CAT[n.kind]||'char'}" data-kind="c" data-path="${path}">${HDL}<div class="bc">${ruleControls(e,n,path)}</div><div class="ba">${condActs(path)}</div></div>`;
}
function fxZoneHTML(e,L){
  const list=fxList(e,L);
  const kids=list.length?list.map((f,i)=>`<div class="blk k-${FX_CAT[f.k]||'char'}" data-kind="f" data-list="${L}" data-i="${i}">${HDL}<div class="bc">${fxControls(e,f,i,L)}</div><div class="ba">${fxActs(L,i)}</div></div>`).join(''):`<p class="dz-empty">${L==='fx'?'Sin efectos: el evento es solo una escena. Agregá uno o arrastrá uno acá.':'Sin efectos: solo se cuenta lo que pasó.'}</p>`;
  return `<div class="dz" data-zone="f" data-list="${L}">${kids}</div><div class="acts">${fxPickerHTML(L)}</div>`;
}
function viewToggleHTML(){
  const b=ui.evView==='blocks';
  return `<div class="vtog"><div class="seg" role="group" aria-label="Vista del editor"><button type="button" class="${b?'on':''}" data-act="ev-view" data-v="blocks">Bloques</button><button type="button" class="${b?'':'on'}" data-act="ev-view" data-v="form">Formulario</button></div><span class="hint">Las dos vistas editan lo mismo.</span></div>`;
}
function programHTML(e){
  const legend=['char','item','skill','stat','emo','state','team','kill'].map(c=>`<span class="lg k-${c}">${CAT_LBL[c]}</span>`).join('');
  return `<section class="card sec prog"><h3 class="h3">Programa del evento</h3>
  <p class="hint">Armalo con bloques. El evento solo puede ocurrir si se cumplen las condiciones, y entonces pasan los efectos. Para mover un bloque, arrastralo desde ⠿ (también con el dedo) o usá ▲ ▼. Un grupo puede contener reglas y otros grupos. Una stat que el personaje no tiene vale 0.</p>
  <div class="legend">${legend}</div>
  <div class="pk"><b>SI</b> se cumple</div>
  ${blkNode(e,e.cond,'',0)}
  <div class="pk"><b>ENTONCES</b> pasa</div>
  ${fxZoneHTML(e,'fx')}
  <p class="hint">Si un objeto no entra en los slots, el personaje no tiene la stat o no hay equipo para el efecto, ese efecto no se aplica y queda una nota en el registro.</p></section>
  ${chanceSection(e,true)}`;
}

/* ---------- Cambios sobre los datos ---------- */
const hasNode=(g,x)=>g===x||(g.t==='g'&&g.c.some(ch=>hasNode(ch,x)));
/* Mueve un nodo de condiciones al grupo `toPath`, en la posición `idx` (contada antes de sacarlo). */
function moveCond(fromPath,toPath,idx){
  const e=curEv();if(!e||!fromPath)return false;
  const q=parentOf(e.cond,fromPath),node=q.parent.c[q.idx],tgt=nodeAt(e.cond,toPath);
  if(!node||!tgt||tgt.t!=='g')return false;
  if(node.t==='g'&&hasNode(node,tgt))return false;
  q.parent.c.splice(q.idx,1);
  let ti=idx;if(q.parent===tgt&&q.idx<idx)ti--;
  ti=Math.max(0,Math.min(tgt.c.length,ti));
  tgt.c.splice(ti,0,node);
  return true;
}
function moveFx(fromList,fi,toList,idx){
  const e=curEv();if(!e)return false;
  const src=fxList(e,fromList),dst=fxList(e,toList);
  if(!src[fi])return false;
  const f=src.splice(fi,1)[0];
  let ti=idx;if(src===dst&&fi<idx)ti--;
  ti=Math.max(0,Math.min(dst.length,ti));
  dst.splice(ti,0,f);
  return true;
}
const clone=o=>JSON.parse(JSON.stringify(o));
const dirOf=b=>b.dataset.act==='blk-up'?-1:1;

Object.assign(ACT,{
  'ev-view'(b){
    ui.evView=b.dataset.v==='form'?'form':'blocks';
    try{localStorage.setItem('br.evView',ui.evView);}catch(e){}
    render();
  },
  'blk-up'(b){blkStep(b);},
  'blk-down'(b){blkStep(b);},
  'blk-dup'(b){
    const e=curEv();if(!e)return;
    if(b.dataset.kind==='c'){const q=parentOf(e.cond,b.dataset.path);q.parent.c.splice(q.idx+1,0,clone(q.parent.c[q.idx]));}
    else{const l=fxList(e,b.dataset.list),i=+b.dataset.i;l.splice(i+1,0,clone(l[i]));}
    structural();
  }
});
function blkStep(b){
  const e=curEv();if(!e)return;
  const d=dirOf(b);
  if(b.dataset.kind==='c'){
    const p=b.dataset.path,q=parentOf(e.cond,p),zp=p.split('.').slice(0,-1).join('.');
    if(d<0?q.idx>0:q.idx<q.parent.c.length-1){moveCond(p,zp,d<0?q.idx-1:q.idx+2);structural();}
  } else {
    const L=b.dataset.list,i=+b.dataset.i,n=fxList(e,L).length;
    if(d<0?i>0:i<n-1){moveFx(L,i,L,d<0?i-1:i+2);structural();}
  }
}
Object.assign(BIND,{
  'blk-add'(t){
    const e=curEv(),v=t.value;if(!e||!v)return;
    const [k,x]=v.split(':');
    if(t.dataset.zone==='c'){
      const g=nodeAt(e.cond,t.dataset.path);if(!g||g.t!=='g')return;
      if(k==='r'){const r=newRule(e);setRuleKind(e,r,x);g.c.push(r);}
      else if(k==='g'){g.c.push({t:'g',op:x,c:[]});}
    } else {
      const f=newFx(e);setFxKind(e,f,x);fxList(e,t.dataset.list).push(f);
    }
    structural();
  }
});

/* ---------- Arrastrar ---------- */
let drag=null;
function validZone(z,blk){
  if(!z||z.dataset.zone!==blk.dataset.kind)return false;
  if(blk.dataset.kind==='c'){
    const p=blk.dataset.path,zp=z.dataset.path;
    if(zp===p||zp.startsWith(p+'.'))return false;
  }
  return true;
}
function dropSpot(x,y,blk){
  let el=document.elementFromPoint(x,y);
  let z=el?el.closest('.dz'):null;
  while(z&&!validZone(z,blk)) z=z.parentElement?z.parentElement.closest('.dz'):null;
  if(!z)return null;
  const kids=[...z.children].filter(c=>c.classList.contains('blk'));
  let idx=kids.length,line;
  for(let i=0;i<kids.length;i++){
    const r=kids[i].getBoundingClientRect();
    if(y<r.top+r.height/2){idx=i;line=r.top-3;break;}
  }
  if(line===undefined){
    if(kids.length){const r=kids[kids.length-1].getBoundingClientRect();line=r.bottom+1;}
    else{const r=z.getBoundingClientRect();line=r.top+r.height/2;}
  }
  const zr=z.getBoundingClientRect();
  return {zone:z,idx,line,left:zr.left,width:zr.width};
}
function endDrag(){
  if(!drag)return;
  clearInterval(drag.scroll);
  if(drag.ghost)drag.ghost.remove();
  if(drag.line)drag.line.remove();
  document.querySelectorAll('.dz-on').forEach(z=>z.classList.remove('dz-on'));
  document.querySelectorAll('.blk.dragging').forEach(b=>b.classList.remove('dragging'));
  document.body.classList.remove('dragging-now');
  drag=null;
}
document.addEventListener('pointerdown',ev=>{
  const h=ev.target.closest&&ev.target.closest('.hdl');
  if(!h||ev.button>0)return;
  const blk=h.closest('.blk');if(!blk)return;
  ev.preventDefault();
  try{h.setPointerCapture(ev.pointerId);}catch(e){}
  drag={blk,sx:ev.clientX,sy:ev.clientY,x:ev.clientX,y:ev.clientY,active:false,id:ev.pointerId,spot:null};
});
document.addEventListener('pointermove',ev=>{
  if(!drag||ev.pointerId!==drag.id)return;
  drag.x=ev.clientX;drag.y=ev.clientY;
  if(!drag.active){
    if(Math.hypot(drag.x-drag.sx,drag.y-drag.sy)<6)return;
    drag.active=true;
    const g=document.createElement('div');g.className='ghost';
    g.textContent=drag.blk.dataset.g?'Grupo '+OPS[drag.blk.dataset.g]:drag.blk.innerText.replace(/\s+/g,' ').replace(/[⠿▲▼⧉✕]/g,'').trim().slice(0,60);
    document.body.appendChild(g);drag.ghost=g;
    const l=document.createElement('div');l.className='drop-line';l.hidden=true;document.body.appendChild(l);drag.line=l;
    drag.blk.classList.add('dragging');document.body.classList.add('dragging-now');
    drag.scroll=setInterval(()=>{
      if(!drag)return;
      const m=70;
      if(drag.y<m)window.scrollBy(0,-Math.ceil((m-drag.y)/4));
      else if(drag.y>innerHeight-m)window.scrollBy(0,Math.ceil((drag.y-(innerHeight-m))/4));
      markSpot();
    },40);
  }
  drag.ghost.style.left=(drag.x+12)+'px';drag.ghost.style.top=(drag.y+12)+'px';
  markSpot();
});
function markSpot(){
  if(!drag||!drag.active)return;
  document.querySelectorAll('.dz-on').forEach(z=>z.classList.remove('dz-on'));
  const s=dropSpot(drag.x,drag.y,drag.blk);
  drag.spot=s;
  if(!s){drag.line.hidden=true;return;}
  s.zone.classList.add('dz-on');
  drag.line.hidden=false;
  drag.line.style.top=s.line+'px';drag.line.style.left=s.left+'px';drag.line.style.width=s.width+'px';
}
function finishDrag(ev,cancel){
  if(!drag||(ev&&ev.pointerId!==drag.id))return;
  const d=drag,spot=d.spot;
  endDrag();
  if(cancel||!d.active||!spot)return;
  const b=d.blk;
  let ok=false;
  if(b.dataset.kind==='c')ok=moveCond(b.dataset.path,spot.zone.dataset.path,spot.idx);
  else ok=moveFx(b.dataset.list,+b.dataset.i,spot.zone.dataset.list,spot.idx);
  if(ok)structural();
}
document.addEventListener('pointerup',ev=>finishDrag(ev,false));
document.addEventListener('pointercancel',ev=>finishDrag(ev,true));
document.addEventListener('keydown',ev=>{if(ev.key==='Escape'&&drag)finishDrag(null,true);});
