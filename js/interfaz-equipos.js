'use strict';
/* =====================================================================
   INTERFAZ DE EQUIPOS: la pestaña Equipos (lista y ficha de cada equipo)
   y el generador de nombres. Se apoya en interfaz.js (ui, ACT, BIND…)
   y en equipos.js (genTeamName).
   ===================================================================== */

const curTeam=()=>P.teams.find(t=>t.id===ui.team);
function teamsFiltered(){
  const q=norm(ui.q.teams);
  return P.teams.filter(t=>!q||norm(t.name).includes(q));
}
function teamCard(t){
  const mem=t.members.map(id=>P.chars.find(c=>c.id===id)).filter(Boolean);
  const ld=mem.find(c=>c.id===t.leader);
  return `<button type="button" class="ccard" data-act="team-edit" data-id="${t.id}">
  <div class="stack">${mem.slice(0,5).map(c=>av(c,'sm')).join('')||'<span class="hint">Sin miembros</span>'}</div>
  <div><b>${esc(t.name||'Sin nombre')}</b><br><small>${plural(mem.length,'miembro','miembros')}${ld?' · Líder: '+esc(nm(ld)):''}${t.share?' · Inventario compartido':''}</small></div></button>`;
}
function teamsListHTML(){
  if(!P.teams.length) return '<p class="empty">Todavía no hay equipos armados de antemano. Creá uno acá, o dejá que los eventos los formen durante la partida.</p>';
  const L=teamsFiltered();
  if(!L.length) return '<p class="empty">Ningún equipo coincide con la búsqueda.</p>';
  return `<div class="grid">${L.map(teamCard).join('')}</div>`;
}

/* ---------- Generador de nombres ---------- */
const NUM_LBL={s:'singular',p:'plural'};
const GENW_LBL={m:'masculino',f:'femenino',x:'cualquiera'};
function wordList(kind,title,ph){
  const L=P.words[kind],genKeys=kind==='nouns'?['m','f']:['m','f','x'];
  const numSel=(cur,attrs)=>`<select ${attrs} aria-label="Número">${Object.keys(NUM_LBL).map(k=>`<option value="${k}" ${cur===k?'selected':''}>${NUM_LBL[k]}</option>`).join('')}</select>`;
  const genSel=(cur,attrs)=>`<select ${attrs} aria-label="Género">${genKeys.map(k=>`<option value="${k}" ${cur===k?'selected':''}>${GENW_LBL[k]}</option>`).join('')}</select>`;
  return `<div><label>${title}</label>
  ${L.map(w=>`<div class="wrow"><input type="text" value="${esc(w.text)}" data-bind="word-text" data-kind="${kind}" data-id="${w.id}" aria-label="Palabra" autocomplete="off">${numSel(w.num,`data-bind="word-num" data-kind="${kind}" data-id="${w.id}"`)}${genSel(w.gen,`data-bind="word-gen" data-kind="${kind}" data-id="${w.id}"`)}<button type="button" class="x" data-act="word-del" data-kind="${kind}" data-id="${w.id}" aria-label="Quitar palabra">✕</button></div>`).join('')}
  <div class="wrow"><input type="text" id="w-text-${kind}" placeholder="${ph}" data-enter="word-add" data-kind="${kind}" aria-label="Palabra nueva" autocomplete="off">${numSel('s',`id="w-num-${kind}"`)}${genSel('m',`id="w-gen-${kind}"`)}<button type="button" class="btn sm" data-act="word-add" data-kind="${kind}">Agregar</button></div></div>`;
}
function wordsSection(){
  return `<section class="card sec" style="margin-top:18px"><h3 class="h3">Generador de nombres</h3>
  <p class="hint">Cargá sustantivos y adjetivos y el simulador arma nombres como «Los Guardianes del Estiércol», «El Aceite Primordial», «El Primordial del Aceite» o «Toritos y Guardianes». Cada palabra lleva su número y su género. Un adjetivo solo acompaña a un sustantivo del mismo número y género; si no cambia (como «Primordial»), elegí género «cualquiera». El simulador respeta lo que marques: si cargás «Estiércol» como plural, va a decir «de los Estiércol».</p>
  ${wordList('nouns','Sustantivos','Ej: Guardianes')}
  ${wordList('adjs','Adjetivos','Ej: Rojos')}
  <div><label>Nombres preestablecidos</label>
  ${P.teamPresets.map((s,i)=>`<div class="wrow"><input type="text" value="${esc(s)}" data-bind="preset-text" data-i="${i}" aria-label="Nombre" autocomplete="off"><button type="button" class="x" data-act="preset-del" data-i="${i}" aria-label="Quitar nombre">✕</button></div>`).join('')}
  <div class="wrow"><input type="text" id="preset-new" placeholder="Ej: Alianza del Norte" data-enter="preset-add" aria-label="Nombre nuevo" autocomplete="off"><button type="button" class="btn sm" data-act="preset-add">Agregar</button></div></div>
  <div class="acts"><button type="button" class="btn" data-act="names-test">Probar el generador</button></div>
  ${ui.nameSamples.length?`<div class="chips">${ui.nameSamples.map(n=>`<span class="chip">${esc(n)}</span>`).join('')}</div>`:''}</section>`;
}

/* ---------- Pestaña y ficha ---------- */
function vTeams(){
  if(ui.team){const t=curTeam();if(t)return vTeamForm(t);ui.team=null;}
  return `<div class="bar"><h2 class="h2">Equipos</h2><div class="acts"><button type="button" class="btn pri" data-act="team-new">Nuevo equipo</button></div></div>
  <p class="hint" style="margin-bottom:12px">Estos equipos existen desde el primer día. Los eventos pueden formar otros durante la partida (con nombres preestablecidos o generados con las palabras de más abajo), sumar o sacar miembros, y hacer que se traicionen según su lealtad.</p>
  <div class="fbar"><input type="search" placeholder="Buscar equipos…" value="${esc(ui.q.teams)}" data-bind="q" data-k="teams" aria-label="Buscar equipos"><span class="hint" id="count">${countText('teams')}</span></div>
  <div id="list">${teamsListHTML()}</div>
  ${wordsSection()}`;
}
function leaderOpts(t){
  const mem=t.members.map(id=>P.chars.find(c=>c.id===id)).filter(Boolean);
  return `<option value="">Sin líder</option>`+mem.map(c=>`<option value="${c.id}" ${t.leader===c.id?'selected':''}>${esc(nm(c))}</option>`).join('');
}
function membersListHTML(t){
  const q=norm(ui.q.members);
  const L=P.chars.filter(c=>!q||norm(c.name).includes(q));
  if(!P.chars.length) return '<p class="hint">Todavía no hay personajes. Creálos en la pestaña Personajes.</p>';
  if(!L.length) return '<p class="hint">Ningún personaje coincide con la búsqueda.</p>';
  return `<div class="pick">${L.map(c=>{
    const other=P.teams.find(o=>o!==t&&o.members.includes(c.id));
    return `<label><input type="checkbox" data-bind="team-member" data-id="${c.id}" ${t.members.includes(c.id)?'checked':''}>${esc(nm(c))}${other?` <small>en «${esc(other.name||'Sin nombre')}»</small>`:''}${c.enabled?'':' <small>deshabilitado</small>'}</label>`;
  }).join('')}</div>`;
}
function refreshMembers(){
  const t=curTeam();if(!t)return;
  const l=$('#tm-list');if(l)l.innerHTML=membersListHTML(t);
  const s=$('#t-leader');if(s)s.innerHTML=leaderOpts(t);
  const m=$('#tm-count');if(m)m.textContent=plural(t.members.length,'miembro','miembros');
}
function vTeamForm(t){
  return `<div class="bar"><button type="button" class="btn" data-act="team-back">← Equipos</button><button type="button" class="btn dng" data-act="team-del" data-confirm="¿Eliminar? Tocá otra vez">Eliminar equipo</button></div>
  <section class="card sec"><h3 class="h3">Ficha</h3>
  <div><label for="t-name">Nombre</label><div class="urlrow"><input type="text" id="t-name" value="${esc(t.name)}" data-bind="team-name" autocomplete="off"><button type="button" class="btn" data-act="team-gen">Generar nombre</button></div></div>
  <div class="two"><div><label for="t-leader">Líder</label><select id="t-leader" data-bind="team-leader">${leaderOpts(t)}</select></div>
  <label class="pick" style="display:inline-flex;margin:0"><span style="display:inline-flex;gap:6px;align-items:center;text-transform:none;letter-spacing:0;font:500 14px var(--font-body);color:var(--ink);background:var(--surface-2);border-radius:6px;padding:6px 10px"><input type="checkbox" data-bind="team-share" ${t.share?'checked':''}>Comparten el inventario</span></label></div>
  <p class="hint">El líder es opcional y tiene que ser miembro. Si lo elimina un evento o se va, lo reemplaza el miembro más leal. Con el inventario compartido, las reglas «tiene (propio o compartido) el objeto» cuentan lo que tiene todo el equipo.</p></section>
  <section class="card sec"><h3 class="h3">Miembros</h3>
  <div class="acts"><input type="search" placeholder="Buscar personajes…" value="${esc(ui.q.members)}" data-bind="q" data-k="members" aria-label="Buscar personajes"><span class="meter" id="tm-count">${plural(t.members.length,'miembro','miembros')}</span></div>
  <p class="hint">Un personaje está en un solo equipo: si lo marcás acá, sale del otro.</p>
  <div id="tm-list">${membersListHTML(t)}</div></section>`;
}

/* ---------- Acciones y campos ---------- */
const lowerNames=()=>new Set(P.teams.map(t=>(t.name||'').toLowerCase()));
Object.assign(ACT,{
  'team-new'(){
    const t={id:uid(),name:genTeamName(lowerNames())||'Equipo '+(P.teams.length+1),leader:'',members:[],share:false};
    P.teams.push(t);ui.team=t.id;ui.q.members='';structural();window.scrollTo(0,0);
  },
  'team-edit'(b){ui.team=b.dataset.id;ui.q.members='';render();window.scrollTo(0,0);},
  'team-back'(){
    const t=curTeam();
    if(t&&!t.name.trim()){t.name='Equipo '+(P.teams.indexOf(t)+1);touch();}
    ui.team=null;render();
  },
  'team-del'(){P.teams=P.teams.filter(t=>t.id!==ui.team);ui.team=null;structural();toast('Equipo eliminado');},
  'team-gen'(){
    const t=curTeam();if(!t)return;
    const others=new Set(P.teams.filter(o=>o!==t).map(o=>(o.name||'').toLowerCase()));
    const n=genTeamName(others);
    if(!n){toast('Cargá sustantivos (y adjetivos) en el generador para poder armar nombres.');return;}
    t.name=n;const f=$('#t-name');if(f)f.value=n;touch();
  },
  'word-add'(b){
    const kind=b.dataset.kind,inp=$('#w-text-'+kind),text=inp.value.trim();
    if(!text)return;
    P.words[kind].push({id:uid(),text,num:$('#w-num-'+kind).value==='p'?'p':'s',gen:$('#w-gen-'+kind).value});
    structural();const f=$('#w-text-'+kind);if(f)f.focus();
  },
  'word-del'(b){P.words[b.dataset.kind]=P.words[b.dataset.kind].filter(w=>w.id!==b.dataset.id);structural();},
  'preset-add'(){
    const inp=$('#preset-new'),text=inp.value.trim();if(!text)return;
    P.teamPresets.push(text);structural();const f=$('#preset-new');if(f)f.focus();
  },
  'preset-del'(b){P.teamPresets.splice(+b.dataset.i,1);structural();},
  'names-test'(){
    const seen=new Set(),out=[];
    for(let i=0;i<30&&out.length<8;i++){
      const n=genTeamName(seen);
      if(!n)break;
      if(!seen.has(n.toLowerCase())){seen.add(n.toLowerCase());out.push(n);}
    }
    if(!out.length){toast('Cargá al menos dos sustantivos, o un sustantivo y un adjetivo, para probar.');return;}
    ui.nameSamples=out;render();
  }
});
Object.assign(BIND,{
  'team-name'(t){const x=curTeam();if(x){x.name=t.value;touch();}},
  'team-leader'(t){const x=curTeam();if(x){x.leader=t.value;touch();}},
  'team-share'(t){const x=curTeam();if(x){x.share=t.checked;touch();}},
  'team-member'(t){
    const team=curTeam(),id=t.dataset.id;if(!team)return;
    if(t.checked){
      let from='';
      P.teams.forEach(o=>{
        if(o!==team&&o.members.includes(id)){o.members=o.members.filter(x=>x!==id);if(o.leader===id)o.leader='';from=o.name||'Sin nombre';}
      });
      if(!team.members.includes(id))team.members.push(id);
      if(from){const c=P.chars.find(x=>x.id===id);toast((c?nm(c):'El personaje')+' pasó de «'+from+'» a este equipo.');}
    } else {
      team.members=team.members.filter(x=>x!==id);
      if(team.leader===id)team.leader='';
    }
    touch();refreshMembers();
  },
  'word-text'(t){const w=P.words[t.dataset.kind].find(x=>x.id===t.dataset.id);if(w){w.text=t.value;touch();}},
  'word-num'(t){const w=P.words[t.dataset.kind].find(x=>x.id===t.dataset.id);if(w){w.num=t.value==='p'?'p':'s';touch();}},
  'word-gen'(t){const w=P.words[t.dataset.kind].find(x=>x.id===t.dataset.id);if(w){w.gen=t.value;touch();}},
  'preset-text'(t){if(P.teamPresets[+t.dataset.i]!==undefined){P.teamPresets[+t.dataset.i]=t.value;touch();}}
});
