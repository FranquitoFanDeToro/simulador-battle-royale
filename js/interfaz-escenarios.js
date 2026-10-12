'use strict';
/* =====================================================================
   ESCENARIOS: pestaña (nombre, ícono, imagen, conexiones), escenario inicial de
   cada personaje y la sección «Escenarios» de un evento (quiénes tienen que
   estar en el mismo escenario).
   ===================================================================== */

/* Campos de cada escenario en la lista (el ícono y la imagen los pone iconFieldsHTML). */
function sceneFieldsHTML(i){
  const others=P.scenes.filter(x=>x.id!==i.id&&!i.links.includes(x.id));
  const chips=i.links.map(id=>{const d=sceneDef(id);return d?`<span class="chip rc">${esc(lbl(d))}<button type="button" class="x" data-act="scene-unlink" data-id="${i.id}" data-o="${esc(id)}" aria-label="Quitar la conexión con ${esc(d.name)}">✕</button></span>`:'';}).join('');
  return `<div class="mini"><label>Conectado con</label><div class="chipsel">${chips}${others.length?`<select class="addsel mini" data-bind="scene-link" data-id="${i.id}" aria-label="Conectar con otro escenario"><option value="">＋ conectar</option>${others.map(o=>`<option value="${esc(o.id)}">${esc(lbl(o))}</option>`).join('')}</select>`:''}${i.links.length?'':'<span class="hint">sin conexiones</span>'}</div></div>
  <div class="mini"><label>Partida</label><label class="check sm"><input type="checkbox" data-bind="scene-start" data-id="${i.id}" ${P.sceneStart===i.id?'checked':''}>Todos empiezan acá</label></div>`;
}
/* Al borrar un escenario: nadie queda en él y se limpian las conexiones y las listas de los eventos. */
function sceneRemoved(id){
  P.scenes.forEach(s=>{s.links=s.links.filter(x=>x!==id);});
  if(P.sceneStart===id) P.sceneStart='';
  P.chars.forEach(c=>{if(c.scene===id)c.scene='';});
  P.events.forEach(e=>{
    (e.vars||[]).forEach(v=>{if(v.kind==='scene')v.ids=v.ids.filter(x=>x!==id);});
    allFx(e).forEach(f=>{if(f.ref===id)f.ref='';});
  });
}
/* Escenario inicial del personaje (en su ficha). */
function charSceneHTML(c){
  if(!P.scenes.length) return '';
  const start=sceneDef(P.sceneStart);
  return `<section class="card sec"><h3 class="h3">Escenario inicial</h3>
  <div><label for="c-scene">Dónde empieza en la simulación</label><select id="c-scene" data-bind="char-scene"><option value="" ${c.scene?'':'selected'}>${start?'El de la partida ('+esc(start.name||'Sin nombre')+')':'Uno al azar'}</option>${P.scenes.map(s=>`<option value="${esc(s.id)}" ${c.scene===s.id?'selected':''}>${esc(lbl(s))}</option>`).join('')}</select></div></section>`;
}

/* ---------- Simulación: escenario del evento, fichas de elementos y panel de escenarios ---------- */
function sceneBannerHTML(en){
  const L=(en.scenes||[]).map(g=>({g,d:sceneDef(g.id)})).filter(x=>x.d);
  if(!L.length) return '';
  const names=id=>{const w=(en.who||[]).find(x=>x.c.id===id);return w?w.c.name:'';};
  return `<div class="sc-row ${L.length>1?'multi':''}">${L.map(({g,d})=>{
    const src=iconImg(d),who=L.length>1?g.who.map(names).filter(Boolean).join(', '):'';
    const sub=[g.dest?'Destino':'',who].filter(Boolean).join(' · ');
    return `<div class="sc ${g.dest?'dest':''}" style="--h:${hue(d.name||'')}">${src?`<img class="sc-img" src="${esc(src)}" alt="" data-fb="1" loading="lazy">`:''}<span class="sc-in">${d.icon?`<span class="sc-ic">${esc(d.icon)}</span>`:''}<b>${esc(d.name||'Sin nombre')}</b>${sub?`<small>${esc(sub)}</small>`:''}</span></div>`;
  }).join('')}</div>`;
}
const ELEM_NOUN={item:'Objeto',skill:'Habilidad',state:'Estado'};
function elemsHTML(en){
  const L=(en.elems||[]).map(x=>({x,o:({item:P.items,skill:P.skills,state:P.states}[x.kind]||[]).find(i=>i.id===x.id)})).filter(y=>y.o);
  if(!L.length) return '';
  return `<div class="elems">${L.map(({x,o})=>{
    const src=iconImg(o);
    return `<span class="el" title="${ELEM_NOUN[x.kind]}: ${esc(o.name||'')}"><span class="eli">${src?`<img src="${esc(src)}" alt="" data-fb="1" loading="lazy">`:''}<i>${esc(o.icon||(o.name||'?').charAt(0).toUpperCase())}</i></span><span class="elt"><b>${esc(o.name||'Sin nombre')}</b><small>${ELEM_NOUN[x.kind]}</small></span></span>`;
  }).join('')}</div>`;
}
/* Panel lateral: quién está en cada escenario ahora. */
function scenesSideHTML(s){
  if(!P.scenes.length) return '';
  return `<section class="card"><h3 class="h3">Escenarios</h3><ul class="tlist">${P.scenes.map(d=>{
    const here=s.chars.filter(c=>c.scene===d.id),al=here.filter(c=>c.alive),dead=here.length-al.length;
    return `<li><b>${ico(d)}${esc(d.name||'Sin nombre')}</b><div class="stack">${al.slice(0,6).map(m=>avS(m.name,lookFor(m,''),'sm')).join('')}${al.length>6?`<span class="more">+${al.length-6}</span>`:''}</div><small>${al.length?plural(al.length,'en pie','en pie'):'Nadie en pie'}${dead?' · '+plural(dead,'caído','caídos'):''}</small></li>`;
  }).join('')}</ul></section>`;
}

/* Sección del evento: qué participantes tienen que estar en el mismo escenario. */
function ssMode(e){const s=e.sameScene||{all:false,groups:[]};return s.all?'all':(s.groups.length?'groups':'free');}
function sceneSection(e){
  const ss=e.sameScene=e.sameScene||{all:false,groups:[]};
  const names=e.roles.map(r=>r.n),mode=ssMode(e),o=(v,t)=>`<option value="${v}" ${mode===v?'selected':''}>${t}</option>`;
  let body='';
  if(mode==='groups'){
    body=ss.groups.map((g,gi)=>{
      const free=names.filter(n=>!g.includes(n));
      return `<div class="rrow"><span class="rl">Grupo ${gi+1}</span>${g.map(r=>`<span class="chip rc">${esc(r)}<button type="button" class="x" data-act="ss-chip-del" data-g="${gi}" data-r="${esc(r)}" aria-label="Quitar ${esc(r)}">✕</button></span>`).join('')}${free.length?`<select class="addsel mini" data-bind="ss-chip-add" data-g="${gi}" aria-label="Sumar un participante al grupo"><option value="">＋ participante</option>${free.map(n=>`<option value="${esc(n)}">${esc(n)}</option>`).join('')}</select>`:''}<button type="button" class="x" data-act="ss-group-del" data-g="${gi}" aria-label="Quitar el grupo">✕</button></div>`;
    }).join('')+`<div><button type="button" class="btn sm" data-act="ss-group-add">Agregar otro grupo</button></div>`;
  }
  const hint=mode==='free'?'Cada participante puede estar en cualquier escenario.':mode==='all'?'El evento solo ocurre si todos los participantes están en el mismo escenario.':'Dentro de cada grupo todos tienen que estar en el mismo escenario; los grupos (y los participantes que no están en ninguno) pueden estar en escenarios distintos.';
  return `<section class="card sec"><div class="sh"><h3 class="h3">Escenarios</h3>${helpBtn('escenarios')}</div>
  ${P.scenes.length?'':'<div class="note warn"><b>Todavía no hay escenarios</b><p class="hint">Creálos en la pestaña Escenarios para que esto tenga efecto.</p></div>'}
  <div><label for="ss-mode">Quiénes comparten escenario</label><select id="ss-mode" data-bind="ss-mode" ${names.length<2?'disabled':''}>${o('free','Nadie en particular (sin restricción)')}${o('all','Todos los participantes')}${o('groups','Solo algunos (grupos)')}</select></div>
  <p class="hint">${esc(names.length<2?'Con un solo participante no hay nada que compartir. Agregá otro arriba.':hint)}</p>${body}</section>`;
}
const curSS=()=>{const e=curEv();if(!e)return null;e.sameScene=e.sameScene||{all:false,groups:[]};return e.sameScene;};
Object.assign(ACT,{
  'scene-unlink'(b){
    const a=sceneDef(b.dataset.id),o=sceneDef(b.dataset.o);
    if(a)a.links=a.links.filter(x=>x!==b.dataset.o);
    if(o)o.links=o.links.filter(x=>x!==b.dataset.id);
    structural();
  },
  'ss-chip-del'(b){const ss=curSS();if(!ss)return;const g=ss.groups[+b.dataset.g];if(!g)return;ss.groups[+b.dataset.g]=g.filter(r=>r!==b.dataset.r);structural();},
  'ss-group-del'(b){const ss=curSS();if(!ss)return;ss.groups.splice(+b.dataset.g,1);structural();},
  'ss-group-add'(){
    const e=curEv(),ss=curSS();if(!ss)return;
    const used=new Set([].concat(...ss.groups)),free=e.roles.map(r=>r.n).filter(n=>!used.has(n));
    ss.groups.push(free.length>=2?free.slice(0,2):e.roles.slice(0,2).map(r=>r.n));structural();
  }
});
Object.assign(BIND,{
  'scene-link'(t){
    const a=sceneDef(t.dataset.id),o=sceneDef(t.value);if(!a||!o||a===o)return;
    if(!a.links.includes(o.id))a.links.push(o.id);
    if(!o.links.includes(a.id))o.links.push(a.id);
    structural();
  },
  'scene-start'(t){P.sceneStart=t.checked?t.dataset.id:'';structural();},
  'char-scene'(t){const c=curChar();if(c){c.scene=sceneDef(t.value)?t.value:'';touch();}},
  'ss-mode'(t){
    const e=curEv(),ss=curSS();if(!e||!ss)return;
    if(t.value==='free'){ss.all=false;ss.groups=[];}
    else if(t.value==='all'){ss.all=true;ss.groups=[];}
    else{ss.all=false;if(!ss.groups.length)ss.groups=[e.roles.slice(0,2).map(r=>r.n)];}
    structural();
  },
  'ss-chip-add'(t){const ss=curSS();if(!ss||!t.value)return;const g=ss.groups[+t.dataset.g];if(g&&!g.includes(t.value))g.push(t.value);structural();}
});
