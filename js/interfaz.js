'use strict';
/* =====================================================================
   INTERFAZ: todo lo que se ve y los botones.
   - Las funciones v...() devuelven el HTML de cada pestaña.
   - ACT  = qué hace cada botón (atributo data-act).
   - BIND = qué hace cada campo (atributo data-bind).
   ===================================================================== */

const $=(s,el)=>(el||document).querySelector(s);
const norm=s=>String(s==null?'':s).normalize('NFD').replace(/[̀-ͯ]/g,'').toLowerCase();
const nm=c=>c.name||'Sin nombre';
const pad=n=>n<10?'0'+n:''+n;
const plural=(n,a,b)=>n+' '+(n===1?a:b);
function hue(s){let h=0;for(let i=0;i<s.length;i++)h=(h*31+s.charCodeAt(i))%360;return h;}

const app=$('#app'), tabsEl=$('#tabs');
const REQ=[['alive','Debe estar vivo'],['dead','Debe estar muerto'],['any','Vivo o muerto']];
const OPS={and:'Y · todas',or:'O · alguna',not:'NO · ninguna'};
const EXPL={and:'Se cumplen todas las reglas de este grupo.',or:'Se cumple al menos una de estas reglas.',not:'No se cumple ninguna de estas reglas.'};
const KIND_LBL={
  item:'tiene el objeto',space:'tiene espacio para',skill:'tiene la habilidad',gender:'es de sexo',status:'está',
  hasstat:'posee la stat',stat:'con valor de',statvs:'compara la stat',
  emotion:'siente',loyalty:'tiene lealtad',inteam:'tiene equipo',isleader:'es líder de su equipo',
  sameteam:'está en el mismo equipo que',teamsize:'tiene un equipo de tamaño',teamitem:'tiene (propio o compartido) el objeto'
};
const KL={
  emotions:{title:'Emociones',noun:'emoción',ph:'Ej: Miedo',hint:'Una emoción es un estado de ánimo que un personaje puede sentir (de a una por vez). Los eventos pueden pedirla como condición, otorgarla o quitarla. Si «dura» algunos días, se pasa sola. Si el personaje tiene una imagen con una etiqueta igual al nombre de la emoción, esa imagen se muestra mientras la siente.'},
  items:{title:'Objetos',noun:'objeto',ph:'Ej: Cuchillo',hint:'Un objeto ocupa espacio (tamaño) en el inventario de un personaje. Los eventos pueden pedirlo como condición, entregarlo o quitarlo. La categoría sirve para marcar grupos enteros de una vez.'},
  skills:{title:'Habilidades',noun:'habilidad',ph:'Ej: Sigilo',hint:'Una habilidad es algo que un personaje sabe hacer. Los eventos pueden pedirla como condición, otorgarla o quitarla.'},
  stats:{title:'Stats',noun:'stat',ph:'Ej: Fuerza',hint:'Una stat es un número que algunos personajes tienen (fuerza, agilidad, hambre…). No es universal: lo que un personaje no tiene vale 0 y los eventos no pueden cambiárselo. El valor inicial se usa al agregarla a un personaje.'}
};

let ui={
  tab:'sim',char:null,ev:null,team:null,bulk:false,selMode:false,sel:new Set(),
  q:{chars:'',items:'',skills:'',stats:'',emotions:'',events:'',roster:'',teams:'',members:''},
  pq:{items:'',skills:''},fgender:'',fstate:'',evf:'',nameSamples:[],
  simSel:null,simFilter:'all',summary:false,optsOpen:false,shuffleN:10,chaos:false,chaosLvl:5,
  dataMsg:'',importBuf:'',exportText:'',exportMsg:''
};
let S=null;   // simulación en curso (se descarta cuando cambia el proyecto)

const curChar=()=>P.chars.find(c=>c.id===ui.char);
const curEv=()=>P.events.find(e=>e.id===ui.ev);

function toast(msg){const t=$('#toast');t.textContent=msg;t.hidden=false;clearTimeout(toast.h);toast.h=setTimeout(()=>{t.hidden=true;},3600);}
function setSaveLabel(){
  $('#save').innerHTML=STORE.ok
    ?'<span class="dot"></span>Se guarda solo en este navegador'
    :'<span class="dot bad"></span>No se puede guardar acá. Exportá una copia en Datos';
}
function touch(){S=null;saveSoon();}
function structural(){touch();render();}

/* ---------- Avatares ---------- */
function avS(name,src,cls){
  const parts=(name||'?').trim().split(/\s+/);
  const ini=((parts[0]||'?')[0]+(parts[1]?parts[1][0]:'')).toUpperCase();
  return `<span class="av ${cls||''}" style="--h:${hue(name||'')}">${esc(ini)}${src?`<img src="${esc(src)}" alt="" data-fb="1" loading="lazy">`:''}</span>`;
}
const av=(c,cls)=>avS(nm(c),lookFor(c,''),cls);
const tkHTML=t=>esc(t).replace(/\{([A-Z])\}/g,'<span class="tk">$1</span>');
function previewHTML(e){
  const as={};
  e.roles.forEach((r,i)=>{as[r.n]={name:P.chars[i]?nm(P.chars[i]):r.n};});
  return e.text.trim()?fmt(e.text,as):'<span class="hint">Escribí el texto del evento.</span>';
}

/* ---------- Referencias y validación ---------- */
function walkRules(n,fn){if(n.t==='g')n.c.forEach(c=>walkRules(c,fn));else fn(n);}
function countRules(n){let k=0;walkRules(n,()=>{k++;});return k;}
const refListOf=kind=>({item:'items',space:'items',teamitem:'items',skill:'skills',hasstat:'stats',stat:'stats',statvs:'stats',emotion:'emotions'}[kind]||null);
const RULE_NEEDS_ROLE2=['statvs','sameteam'];
const RULE_NEEDS_CMP=['stat','statvs','teamsize','loyalty'];
const RULE_NEEDS_NUM=['stat','teamsize','loyalty'];
const allFx=e=>e.fx.concat(e.fxFail);
function usage(kind,id){
  const fk={items:['giveItem','removeItem','teamTake'],skills:['giveSkill','removeSkill'],stats:['stat'],emotions:['emotion']}[kind];
  const ev=P.events.filter(e=>{
    let hit=false;
    walkRules(e.cond,r=>{if(refListOf(r.kind)===kind&&r.val===id)hit=true;});
    if(kind==='stats'&&e.chance.mode==='stat'&&e.chance.stat===id)hit=true;
    return hit||allFx(e).some(f=>fk.includes(f.k)&&f.ref===id);
  }).length;
  const ch=P.chars.filter(c=>kind==='stats'?hasStat(c,id):(kind==='emotions'?c.emotion===id:c[kind].includes(id))).length;
  return {ev,ch};
}
const NOUN={items:'objeto',skills:'habilidad',stats:'stat',emotions:'emoción'};
function issues(e){
  const out=new Set(), rn=e.roles.map(r=>r.n);
  if(!e.text.trim()) out.add('El evento no tiene texto.');
  [...(e.text+' '+e.failText).matchAll(/\{([A-Z])\}/g)].forEach(m=>{if(!rn.includes(m[1]))out.add('El texto usa {'+m[1]+'}, pero ese participante no existe.');});
  walkRules(e.cond,r=>{
    if(!rn.includes(r.role)) out.add('Una regla usa el participante '+r.role+', que no existe.');
    if(RULE_NEEDS_ROLE2.includes(r.kind)&&!rn.includes(r.role2)) out.add('Una regla compara con el participante '+r.role2+', que no existe.');
    const L=refListOf(r.kind);
    if(L&&!P[L].some(i=>i.id===r.val)) out.add('Una regla apunta a un/a '+NOUN[L]+' que falta o no está elegido/a.');
  });
  allFx(e).forEach(f=>{
    if(!rn.includes(f.role)) out.add('Un efecto usa el participante '+f.role+', que no existe.');
    if(f.by&&f.by!=='none'&&!rn.includes(f.by)) out.add('Un efecto usa el participante '+f.by+', que no existe.');
    if(TEAM_FX.includes(f.k)&&!rn.includes(f.by)) out.add('Un efecto de equipo necesita un segundo participante.');
    const m=FX[f.k];
    if(m.ref&&!P[m.ref].some(i=>i.id===f.ref)) out.add('Un efecto apunta a un/a '+NOUN[m.ref]+' que falta o no está elegido/a.');
  });
  const c=e.chance;
  if(c.mode!=='always'){
    if(!e.failText.trim()) out.add('Con probabilidad hace falta el texto de «si no sale bien».');
    if((c.mode==='stat'||c.mode==='team')&&e.roles.length<2) out.add('Esa probabilidad compara a X con Y: agregá un segundo participante.');
    if(c.mode==='stat'&&!P.stats.some(s=>s.id===c.stat)) out.add('La probabilidad por stat no tiene una stat elegida.');
  }
  return [...out];
}
function allTags(){
  const s=new Set();
  P.chars.forEach(c=>c.imgs.forEach(i=>{if(i.tag.trim())s.add(i.tag.trim());}));
  return [...s].sort();
}

/* ---------- Estructura general ---------- */
function renderTabs(){
  const T=[['chars','Personajes',P.chars.length],['teams','Equipos',P.teams.length],['items','Objetos',P.items.length],['skills','Habilidades',P.skills.length],['stats','Stats',P.stats.length],['emotions','Emociones',P.emotions.length],['events','Eventos',P.events.length],['sim','Simulación',null],['data','Datos',null]];
  tabsEl.innerHTML=T.map(t=>`<button type="button" class="${ui.tab===t[0]?'on':''}" ${ui.tab===t[0]?'aria-current="page"':''} data-act="tab" data-tab="${t[0]}">${t[1]}${t[2]!=null?`<span class="n">${t[2]}</span>`:''}</button>`).join('');
}
function render(){
  renderTabs();
  const f={chars:vChars,teams:vTeams,items:()=>vTags('items'),skills:()=>vTags('skills'),stats:()=>vTags('stats'),emotions:()=>vTags('emotions'),events:vEvents,sim:vSim,data:vData}[ui.tab];
  app.innerHTML=f();
}
function countText(k){
  if(k==='chars') return charsFiltered().length+' de '+P.chars.length;
  if(k==='events') return eventsFiltered().length+' de '+P.events.length;
  if(k==='teams') return teamsFiltered().length+' de '+P.teams.length;
  return tagsFiltered(k).length+' de '+P[k].length;
}
/* Vuelve a dibujar solo la lista (así no se pierde el foco del buscador). */
function refreshList(k){
  if(k==='roster'){const r=$('#rlist');if(r&&S)r.innerHTML=rosterListHTML(S);return;}
  if(k==='members'){refreshMembers();return;}
  const el=$('#list');if(!el)return;
  const f={chars:charsListHTML,teams:teamsListHTML,items:()=>tagRowsHTML('items'),skills:()=>tagRowsHTML('skills'),stats:()=>tagRowsHTML('stats'),emotions:()=>tagRowsHTML('emotions'),events:eventsListHTML}[k];
  if(f)el.innerHTML=f();
  const c=$('#count');if(c)c.textContent=countText(k);
  const sc=$('#selcount');if(sc)sc.textContent=plural(ui.sel.size,'seleccionado','seleccionados');
}

/* ======================= PERSONAJES ======================= */
function charsFiltered(){
  const q=norm(ui.q.chars);
  return P.chars.filter(c=>(!q||norm(c.name).includes(q))&&(!ui.fgender||c.gender===ui.fgender)&&(!ui.fstate||(ui.fstate==='on'?c.enabled:!c.enabled)));
}
function charCard(c){
  const bits=[GEN[c.gender]];
  if(c.items.length)bits.push(plural(c.items.length,'objeto','objetos'));
  if(c.skills.length)bits.push(plural(c.skills.length,'habilidad','habilidades'));
  const on=ui.sel.has(c.id);
  return `<button type="button" class="ccard ${c.enabled?'':'off'} ${ui.selMode&&on?'sel':''}" data-act="${ui.selMode?'char-pick':'char-edit'}" data-id="${c.id}">${av(c,'lg')}<div><b>${esc(nm(c))}</b><br><small>${esc(bits.join(' · '))}</small>${c.enabled?'':'<br><span class="chip">Deshabilitado</span>'}</div>${ui.selMode?`<span class="tick">${on?'✓':''}</span>`:''}</button>`;
}
function charsListHTML(){
  if(!P.chars.length) return '<p class="empty">Todavía no hay personajes. Creá el primero o pegá una lista de nombres.</p>';
  const L=charsFiltered();
  if(!L.length) return '<p class="empty">Ningún personaje coincide con el filtro.</p>';
  return `<div class="grid">${L.map(charCard).join('')}</div>`;
}
function optList(list,emptyLabel){
  return (emptyLabel?`<option value="">${emptyLabel}</option>`:'')+list.map(i=>`<option value="${i.id}">${esc(i.name||'Sin nombre')}</option>`).join('');
}
function selBar(){
  if(!ui.selMode) return '';
  return `<div class="card selbar"><div class="acts"><b id="selcount">${plural(ui.sel.size,'seleccionado','seleccionados')}</b>
  <button type="button" class="btn sm" data-act="sel-all">Todos los mostrados</button><button type="button" class="btn sm" data-act="sel-none">Ninguno</button></div>
  <div class="acts"><button type="button" class="btn sm" data-act="sel-enable">Habilitar</button><button type="button" class="btn sm" data-act="sel-disable">Deshabilitar</button></div>
  <div class="acts"><select id="sel-item" aria-label="Objeto">${optList(P.items,'Objeto…')}</select><button type="button" class="btn sm" data-act="sel-giveitem">Dar objeto</button></div>
  <div class="acts"><select id="sel-skill" aria-label="Habilidad">${optList(P.skills,'Habilidad…')}</select><button type="button" class="btn sm" data-act="sel-giveskill">Dar habilidad</button></div>
  <div class="acts"><select id="sel-stat" aria-label="Stat">${optList(P.stats,'Stat…')}</select><input type="number" id="sel-statv" value="5" step="any" aria-label="Valor"><button type="button" class="btn sm" data-act="sel-setstat">Poner stat</button></div>
  <div class="acts"><input type="number" id="sel-slots" value="${DEFAULT_SLOTS}" min="0" aria-label="Slots"><button type="button" class="btn sm" data-act="sel-setslots">Poner slots</button></div>
  <div class="acts"><button type="button" class="btn sm dng" data-act="sel-del" data-confirm="¿Eliminar? Tocá otra vez">Eliminar seleccionados</button></div></div>`;
}
function vChars(){
  if(ui.char){const c=curChar();if(c)return vCharForm(c);ui.char=null;}
  return `<div class="bar"><h2 class="h2">Personajes</h2><div class="acts">
  <button type="button" class="btn pri" data-act="char-new">Nuevo personaje</button>
  <button type="button" class="btn" data-act="bulk-toggle">Agregar varios</button>
  <button type="button" class="btn ${ui.selMode?'on':''}" data-act="sel-toggle">Selección múltiple</button></div></div>
  ${ui.bulk?'<div class="card bulk"><div><label for="bulk-text">Un nombre por línea</label><textarea id="bulk-text" rows="5" placeholder="Ana\nLuis\nCarla"></textarea></div><div class="acts"><button type="button" class="btn pri" data-act="bulk-add">Crear personajes</button></div></div>':''}
  <div class="fbar"><input type="search" placeholder="Buscar por nombre…" value="${esc(ui.q.chars)}" data-bind="q" data-k="chars" aria-label="Buscar personajes">
  <select data-bind="f-gender" aria-label="Sexo"><option value="">Todos los sexos</option>${Object.keys(GEN).map(k=>`<option value="${k}" ${ui.fgender===k?'selected':''}>${GEN[k]}</option>`).join('')}</select>
  <select data-bind="f-state" aria-label="Estado"><option value="">Habilitados y no</option><option value="on" ${ui.fstate==='on'?'selected':''}>Habilitados</option><option value="off" ${ui.fstate==='off'?'selected':''}>Deshabilitados</option></select>
  <span class="hint" id="count">${countText('chars')}</span></div>
  ${selBar()}<div id="list">${charsListHTML()}</div>`;
}

function meterText(c){const u=usedSlots(c);return u+' de '+c.slots+' slots ocupados'+(u>c.slots?'. Se pasa del límite: quitá objetos':'');}
function pickFilter(kind){const q=norm(ui.pq[kind]);return P[kind].filter(i=>!q||norm(i.name).includes(q)||norm(i.cat).includes(q));}
function pickListHTML(c,kind){
  if(!P[kind].length) return `<p class="hint">Todavía no hay ${kind==='items'?'objetos':'habilidades'}. Creálos en su pestaña.</p>`;
  const list=pickFilter(kind);
  if(!list.length) return '<p class="hint">Nada coincide con la búsqueda.</p>';
  const groups={};
  list.forEach(i=>{const k=i.cat||'';(groups[k]=groups[k]||[]).push(i);});
  const keys=Object.keys(groups).sort(),free=slotsFree(c),showHead=keys.length>1||keys[0]!=='';
  return keys.map(cat=>`<div class="pkg">${showHead?`<div class="pkh"><span>${esc(cat||'Sin categoría')}</span><button type="button" class="link" data-act="pick-cat" data-kind="${kind}" data-cat="${esc(cat)}">marcar todo</button></div>`:''}<div class="pick">${groups[cat].map(i=>{
    const has=c[kind].includes(i.id),noRoom=kind==='items'&&!has&&i.size>free;
    return `<label class="${noRoom?'dis':''}" ${noRoom?'title="No hay espacio"':''}><input type="checkbox" data-bind="char-toggle" data-kind="${kind}" data-id="${i.id}" ${has?'checked':''} ${noRoom?'disabled':''}>${esc(i.name||'Sin nombre')}${kind==='items'?` <small>${i.size}</small>`:''}</label>`;
  }).join('')}</div></div>`).join('');
}
function pickerHTML(c,kind){
  return `<div class="picker"><div class="acts"><input type="search" placeholder="Buscar ${kind==='items'?'objetos':'habilidades'}…" value="${esc(ui.pq[kind])}" data-bind="pq" data-kind="${kind}" aria-label="Buscar">
  <button type="button" class="btn sm" data-act="pick-all" data-kind="${kind}">Marcar los mostrados</button><button type="button" class="btn sm" data-act="pick-none" data-kind="${kind}">Desmarcar los mostrados</button></div>
  <div id="pk-${kind}">${pickListHTML(c,kind)}</div></div>`;
}
function refreshPicker(kind){
  const c=curChar(),el=$('#pk-'+kind);
  if(c&&el)el.innerHTML=pickListHTML(c,kind);
  const m=$('#slot-meter');
  if(c&&m){m.textContent=meterText(c);m.classList.toggle('bad',usedSlots(c)>c.slots);}
}
function statsSection(c){
  const have=Object.keys(c.stats).filter(id=>P.stats.some(s=>s.id===id));
  const missing=P.stats.filter(s=>!hasStat(c,s.id));
  return `<section class="card sec"><h3 class="h3">Stats</h3>
  ${!P.stats.length?'<p class="hint">Todavía no hay stats. Creálas en la pestaña Stats.</p>':''}
  ${have.length?have.map(id=>`<div class="strow"><span>${esc(nameOf(P.stats,id))}</span><input type="number" step="any" value="${c.stats[id]}" data-bind="char-stat" data-id="${id}" aria-label="Valor de ${esc(nameOf(P.stats,id))}"><button type="button" class="x" data-act="char-stat-del" data-id="${id}" aria-label="Quitar stat">✕</button></div>`).join(''):(P.stats.length?'<p class="hint">Este personaje no tiene ninguna stat. Para él todas valen 0 y los eventos no pueden cambiárselas.</p>':'')}
  ${missing.length?`<div class="acts"><select id="stat-add-sel" aria-label="Stat a agregar">${optList(missing)}</select><button type="button" class="btn sm" data-act="stat-add">Agregar</button><button type="button" class="btn sm" data-act="stat-addall">Agregar todas las que faltan</button></div>`:''}</section>`;
}
function imagesSection(c){
  return `<section class="card sec"><h3 class="h3">Imágenes</h3>
  <p class="hint">La primera es la principal. Con una etiqueta (por ejemplo «herido») un evento puede mostrar esa imagen en lugar de la principal. Se aceptan GIF animados.</p>
  ${c.imgs.length?`<div class="imgs">${c.imgs.map((im,i)=>{const s=imgSrc(im);return `<div class="imgc"><span class="imgbox">${s?`<img src="${esc(s)}" alt="" data-fb="1">`:''}<span>sin vista</span></span><input type="text" value="${esc(im.tag)}" placeholder="etiqueta" data-bind="img-tag" data-i="${i}" aria-label="Etiqueta"><div class="acts">${i?`<button type="button" class="btn sm" data-act="img-main" data-i="${i}">Hacer principal</button>`:'<span class="chip">Principal</span>'}<button type="button" class="x" data-act="img-del" data-i="${i}" aria-label="Quitar imagen">✕</button></div></div>`;}).join('')}</div>`:'<p class="hint">Sin imágenes: se muestran las iniciales.</p>'}
  <div><label for="img-file">Subir archivos</label><input type="file" id="img-file" accept="image/*" multiple data-bind="img-file"></div>
  <div><label for="img-url">O agregar por URL</label><div class="urlrow"><input type="text" id="img-url" placeholder="https://…" data-enter="img-url" autocomplete="off"><button type="button" class="btn" data-act="img-url">Agregar URL</button></div></div></section>`;
}
function vCharForm(c){
  const others=P.chars.filter(x=>x.id!==c.id);
  return `<div class="bar"><button type="button" class="btn" data-act="char-back">← Personajes</button><button type="button" class="btn dng" data-act="char-del" data-confirm="¿Eliminar? Tocá otra vez">Eliminar personaje</button></div>
  <section class="card sec"><h3 class="h3">Ficha</h3>
  <div class="two">${av(c,'lg')}<div style="flex:1 1 200px"><label for="c-name">Nombre</label><input type="text" id="c-name" value="${esc(c.name)}" data-bind="char-name" autocomplete="off"></div></div>
  <div class="two"><div><label for="c-gender">Sexo</label><select id="c-gender" data-bind="char-gender">${Object.keys(GEN).map(k=>`<option value="${k}" ${c.gender===k?'selected':''}>${GEN[k]}</option>`).join('')}</select></div>
  <label class="pick" style="display:inline-flex;margin:0"><span style="display:inline-flex;gap:6px;align-items:center;text-transform:none;letter-spacing:0;font:500 14px var(--font-body);color:var(--ink);background:var(--surface-2);border-radius:6px;padding:6px 10px"><input type="checkbox" data-bind="char-enabled" ${c.enabled?'checked':''}>Participa en la simulación</span></label></div>
  <div class="two"><div><label for="c-loy">Lealtad (0 a 100)</label><input type="number" id="c-loy" min="0" max="100" value="${c.loy}" data-bind="char-loy"></div>
  <div><label for="c-emotion">Emoción inicial</label><select id="c-emotion" data-bind="char-emotion"><option value="">Ninguna</option>${P.emotions.map(m=>`<option value="${m.id}" ${c.emotion===m.id?'selected':''}>${esc((m.icon?m.icon+' ':'')+(m.name||'Sin nombre'))}</option>`).join('')}</select></div></div>
  <p class="hint">La lealtad pesa en las traiciones: con poca lealtad, un personaje es más propenso a abandonar o traicionar a su equipo (si los eventos lo usan). El equipo se arma en la pestaña Equipos.</p></section>
  ${imagesSection(c)}
  <section class="card sec"><h3 class="h3">Inventario</h3>
  <div class="two"><div><label for="c-slots">Slots</label><input type="number" id="c-slots" min="0" max="99" value="${c.slots}" data-bind="char-slots"></div><span class="meter ${usedSlots(c)>c.slots?'bad':''}" id="slot-meter">${meterText(c)}</span></div>
  <p class="hint">El número junto a cada objeto es el espacio que ocupa.</p>
  ${pickerHTML(c,'items')}</section>
  <section class="card sec"><h3 class="h3">Habilidades</h3>${pickerHTML(c,'skills')}</section>
  ${statsSection(c)}
  ${others.length?`<section class="card sec"><h3 class="h3">Copiar de otro personaje</h3><div class="acts"><select id="copy-src" aria-label="Personaje">${optList(others)}</select><button type="button" class="btn sm" data-act="copy-from">Copiar objetos, habilidades y stats</button></div><p class="hint">Reemplaza lo que tiene este personaje. Los objetos que no entren en sus slots se omiten.</p></section>`:''}`;
}

/* ======================= OBJETOS / HABILIDADES / STATS ======================= */
function tagsFiltered(kind){
  const q=norm(ui.q[kind]);
  return P[kind].filter(i=>!q||norm(i.name).includes(q)||norm(i.cat).includes(q));
}
function tagFieldsHTML(kind,i){
  const cat=`<div class="mini"><label>Categoría</label><input type="text" list="cats-${kind}" value="${esc(i.cat)}" data-bind="tag-cat" data-kind="${kind}" data-id="${i.id}" autocomplete="off"></div>`;
  if(kind==='items') return `<div class="mini"><label>Tamaño</label><input type="number" min="0" value="${i.size}" data-bind="tag-size" data-id="${i.id}"></div>`+cat;
  if(kind==='stats') return `<div class="mini"><label>Valor inicial</label><input type="number" step="any" value="${i.def}" data-bind="tag-def" data-id="${i.id}"></div>`;
  if(kind==='emotions') return `<div class="mini"><label>Ícono</label><input type="text" style="width:80px" maxlength="8" value="${esc(i.icon)}" data-bind="tag-icon" data-id="${i.id}" autocomplete="off"></div><div class="mini"><label>Dura (días, 0 = no se pasa)</label><input type="number" min="0" value="${i.days}" data-bind="tag-days" data-id="${i.id}"></div>`;
  return cat;
}
function tagRowsHTML(kind){
  if(!P[kind].length) return '<p class="empty">Todavía no hay nada acá. Agregá el primero arriba.</p>';
  const L=tagsFiltered(kind);
  if(!L.length) return '<p class="empty">Nada coincide con la búsqueda.</p>';
  return '<div class="card">'+L.map(i=>{
    const u=usage(kind,i.id);
    return `<div class="trow"><input type="text" value="${esc(i.name)}" data-bind="tag-name" data-kind="${kind}" data-id="${i.id}" aria-label="Nombre" autocomplete="off">
    <button type="button" class="x" data-act="tag-del" data-kind="${kind}" data-id="${i.id}" data-confirm="¿Eliminar? Tocá otra vez" aria-label="Eliminar">✕</button>
    <div class="tfields">${tagFieldsHTML(kind,i)}</div>
    <div class="chips"><span class="chip">${plural(u.ch,'personaje','personajes')}</span><span class="chip">${plural(u.ev,'evento','eventos')}</span></div></div>`;
  }).join('')+'</div>';
}
function vTags(kind){
  const L=KL[kind];
  const cats=(kind==='items'||kind==='skills')?[...new Set(P[kind].map(i=>i.cat).filter(Boolean))].sort():[];
  const extra=kind==='items'
    ?`<div class="mini"><label for="new-size">Tamaño</label><input type="number" id="new-size" min="0" value="1"></div><div class="mini"><label for="new-cat">Categoría</label><input type="text" id="new-cat" list="cats-items" autocomplete="off"></div>`
    :kind==='skills'
    ?`<div class="mini"><label for="new-cat">Categoría</label><input type="text" id="new-cat" list="cats-skills" autocomplete="off"></div>`
    :kind==='emotions'
    ?`<div class="mini"><label for="new-icon">Ícono</label><input type="text" id="new-icon" style="width:80px" maxlength="8" autocomplete="off"></div><div class="mini"><label for="new-days">Dura (días)</label><input type="number" id="new-days" min="0" value="0"></div>`
    :`<div class="mini"><label for="new-def">Valor inicial</label><input type="number" id="new-def" value="5" step="any"></div>`;
  return `<div class="bar"><h2 class="h2">${L.title}</h2></div><p class="hint" style="margin-bottom:12px">${L.hint}</p>
  <div class="addrow"><div class="grow mini"><label for="new-name">Nombre</label><input type="text" id="new-name" placeholder="${L.ph}" data-enter="tag-add" data-kind="${kind}" autocomplete="off"></div>${extra}<button type="button" class="btn pri" data-act="tag-add" data-kind="${kind}">Agregar</button></div>
  <datalist id="cats-${kind}">${cats.map(c=>`<option value="${esc(c)}">`).join('')}</datalist>
  <div class="fbar"><input type="search" placeholder="Buscar…" value="${esc(ui.q[kind])}" data-bind="q" data-k="${kind}" aria-label="Buscar"><span class="hint" id="count">${countText(kind)}</span></div>
  <div id="list">${tagRowsHTML(kind)}</div>`;
}

/* ======================= EVENTOS ======================= */
function eventsFiltered(){
  const q=norm(ui.q.events);
  return P.events.filter(e=>(!q||norm(e.text).includes(q))&&(!ui.evf||(ui.evf==='kill'?allFx(e).some(f=>f.k==='kill'):issues(e).length>0)));
}
function evCard(e){
  const iss=issues(e),kills=allFx(e).some(f=>f.k==='kill'),n=countRules(e.cond);
  return `<article class="card ev"><button type="button" class="evmain" data-act="ev-edit" data-id="${e.id}"><span class="evtext">${e.text.trim()?tkHTML(e.text):'<i>(sin texto)</i>'}</span><span class="chips"><span class="chip">${plural(e.roles.length,'participante','participantes')}</span><span class="chip">${plural(n,'regla','reglas')}</span><span class="chip">Frecuencia ${e.weight}</span>${e.chance.mode!=='always'?'<span class="chip">Con probabilidad</span>':''}${kills?'<span class="chip bad">Elimina</span>':''}${iss.length?'<span class="chip warn">Revisar</span>':''}</span></button><button type="button" class="btn sm" data-act="ev-dup" data-id="${e.id}">Duplicar</button></article>`;
}
function eventsListHTML(){
  if(!P.events.length) return '<p class="empty">Todavía no hay eventos. Un evento es algo que le puede pasar a uno o más personajes en un día.</p>';
  const L=eventsFiltered();
  if(!L.length) return '<p class="empty">Ningún evento coincide con el filtro.</p>';
  return `<div class="evs">${L.map(evCard).join('')}</div>`;
}
function roleOpts(e,cur){
  const names=e.roles.map(r=>r.n);
  let h=names.map(n=>`<option value="${n}" ${n===cur?'selected':''}>${n}</option>`).join('');
  if(cur&&!names.includes(cur)) h=`<option value="${esc(cur)}" selected>⚠ ${esc(cur)}</option>`+h;
  return h;
}
function valOpts(kind,cur){
  const L=refListOf(kind);
  let opts;
  if(L) opts=P[L].map(i=>[i.id,i.name||'Sin nombre']);
  else if(kind==='gender') opts=Object.keys(GEN).map(k=>[k,GEN[k]]);
  else opts=[['alive','vivo'],['dead','muerto']];
  let h=L?`<option value="" ${!cur?'selected':''}>Elegir…</option>`:'';
  h+=opts.map(o=>`<option value="${esc(o[0])}" ${o[0]===cur?'selected':''}>${esc(o[1])}</option>`).join('');
  if(cur&&!opts.some(o=>o[0]===cur)) h=`<option value="${esc(cur)}" selected>⚠ ya no existe</option>`+h;
  return h;
}
function ruleControls(e,n,path){
  let extra='';
  if(RULE_NEEDS_CMP.includes(n.kind)) extra+=`<select data-bind="rule-op" data-path="${path}" aria-label="Comparación">${CMP.map(o=>`<option value="${o}" ${n.op===o?'selected':''}>${CMP_LBL[o]}</option>`).join('')}</select>`;
  if(RULE_NEEDS_NUM.includes(n.kind)) extra+=`<input type="number" step="any" value="${n.num}" data-bind="rule-num" data-path="${path}" aria-label="Número">`;
  if(RULE_NEEDS_ROLE2.includes(n.kind)) extra+=`<select data-bind="rule-role2" data-path="${path}" aria-label="Comparar con">${roleOpts(e,n.role2)}</select>`;
  const val=NOVAL.includes(n.kind)?'':`<select data-bind="rule-val" data-path="${path}" aria-label="Valor">${valOpts(n.kind,n.val)}</select>`;
  return `<button type="button" class="neg ${n.neg?'on':''}" data-act="rule-neg" data-path="${path}" aria-pressed="${n.neg}" title="Invertir esta regla">NO</button>
  <select data-bind="rule-role" data-path="${path}" aria-label="Participante">${roleOpts(e,n.role)}</select>
  <select data-bind="rule-kind" data-path="${path}" aria-label="Tipo de regla">${KINDS.map(k=>`<option value="${k}" ${n.kind===k?'selected':''}>${KIND_LBL[k]}</option>`).join('')}</select>
  ${val}${extra}`;
}
function ruleRow(e,n,path){
  return `<div class="rule">${ruleControls(e,n,path)}<button type="button" class="x" data-act="node-del" data-path="${path}" aria-label="Quitar regla">✕</button></div>`;
}
function condHTML(e,n,path,depth){
  if(n.t!=='g') return ruleRow(e,n,path);
  return `<div class="grp"><div class="grp-h"><div class="seg" role="group" aria-label="Tipo de grupo">${['and','or','not'].map(op=>`<button type="button" class="${n.op===op?'on':''}" data-act="g-op" data-path="${path}" data-op="${op}">${OPS[op]}</button>`).join('')}</div>${depth>0?`<button type="button" class="x" data-act="node-del" data-path="${path}" aria-label="Quitar grupo">✕</button>`:''}</div>
  <p class="hint">${EXPL[n.op]}${n.c.length?'':' Sin reglas, siempre se cumple.'}</p>
  ${n.c.length?`<div class="grp-b">${n.c.map((ch,i)=>condHTML(e,ch,path?path+'.'+i:String(i),depth+1)).join('')}</div>`:''}
  <div class="acts"><button type="button" class="btn sm" data-act="add-rule" data-path="${path}">Agregar regla</button><button type="button" class="btn sm" data-act="add-group" data-path="${path}">Agregar grupo</button></div></div>`;
}
/* Un efecto. L dice en qué lista vive: 'fx' (ocurre) o 'fxFail' (no sale bien). */
function fxControls(e,f,i,L){
  const m=FX[f.k],da=`data-i="${i}" data-list="${L}"`;
  const sel=(bind,label,body)=>`<select data-bind="${bind}" ${da} aria-label="${label}">${body}</select>`;
  const roleSel=(bind,cur,label)=>sel(bind,label,roleOpts(e,cur));
  const opt=(v,cur,txt)=>`<option value="${v}" ${String(cur)===String(v)?'selected':''}>${txt}</option>`;
  let h=sel('fx-k','Efecto',Object.keys(FX).map(k=>opt(k,f.k,FX[k].label)).join(''));
  if(m.ref){
    const list=P[m.ref];
    h+=sel('fx-ref','Elemento',`<option value="" ${!f.ref?'selected':''}>Elegir…</option>${list.map(x=>opt(x.id,f.ref,esc(x.name||'Sin nombre'))).join('')}${f.ref&&!list.some(x=>x.id===f.ref)?`<option value="${esc(f.ref)}" selected>⚠ ya no existe</option>`:''}`);
  }
  const W=t=>`<span class="w">${t}</span>`;
  if(f.k==='kill'){
    h+=roleSel('fx-role',f.role,'Participante')+W('por')+sel('fx-by','Autor de la baja',opt('',f.by,'autor automático')+opt('none',f.by,'nadie')+e.roles.map(r=>opt(r.n,f.by,r.n)).join(''));
  } else if(f.k==='stat'||f.k==='loyalty'){
    h+=W('de')+roleSel('fx-role',f.role,'Participante')+sel('fx-mode','Modo',opt('add',f.mode,'suma')+opt('set',f.mode,'fija en'))+`<input type="number" step="any" value="${f.num}" data-bind="fx-num" ${da} aria-label="Número">`;
  } else if(f.k==='teamForm'){
    h+=roleSel('fx-role',f.role,'Participante')+W('con')+roleSel('fx-by',f.by,'Segundo participante')+W('nombre')
      +sel('fx-nm','Nombre del equipo',opt('any',f.nm,'preestablecido o generado')+opt('gen',f.nm,'generado')+opt('preset',f.nm,'preestablecido'))
      +sel('fx-num','Liderazgo',opt(1,f.num>0?1:0,'lidera el primero')+opt(0,f.num>0?1:0,'sin líder'));
  } else if(f.k==='teamJoin'){
    h+=roleSel('fx-role',f.role,'Participante')+W('al equipo de')+roleSel('fx-by',f.by,'Participante del equipo');
  } else if(f.k==='teamShare'){
    h+=W('del equipo de')+roleSel('fx-role',f.role,'Participante')+sel('fx-num','Compartir',opt(1,f.num>0?1:0,'activado')+opt(0,f.num>0?1:0,'desactivado'));
  } else {
    h+=W(m.prep)+roleSel('fx-role',f.role,'Participante');
  }
  return h;
}
function fxHTML(e,f,i,L){
  return `<div class="fx">${fxControls(e,f,i,L)}<button type="button" class="x" data-act="fx-del" data-i="${i}" data-list="${L}" aria-label="Quitar efecto">✕</button></div>`;
}
function fxList(e,L){return e[L==='fxFail'?'fxFail':'fx'];}
function newFx(e){return {k:'kill',role:e.roles.length>1?'Y':'X',ref:'',by:'',mode:'add',num:1,nm:'any'};}
function setFxKind(e,f,k){
  f.k=k;f.ref='';f.by='';
  if(TEAM_FX.includes(k)) f.by=(e.roles.map(r=>r.n).find(n=>n!==f.role))||'';   // el segundo participante
  if(k==='teamForm'||k==='teamShare') f.num=1;
}
function setRuleKind(e,r,kind){
  r.kind=kind;r.val=defaultVal(kind);r.op='>=';r.num=1;
  r.role2=e.roles.map(x=>x.n).find(n=>n!==r.role)||'Y';
}
function newRule(e){return {t:'r',neg:false,role:'X',kind:'item',val:defaultVal('item'),op:'>=',num:1,role2:e.roles[1]?e.roles[1].n:'X'};}
function vEvents(){
  if(ui.ev){const e=curEv();if(e)return vEventForm(e);ui.ev=null;}
  return `<div class="bar"><h2 class="h2">Eventos</h2><div class="acts"><button type="button" class="btn pri" data-act="ev-new">Nuevo evento</button></div></div>
  <div class="fbar"><input type="search" placeholder="Buscar en el texto…" value="${esc(ui.q.events)}" data-bind="q" data-k="events" aria-label="Buscar eventos">
  <select data-bind="ev-filter" aria-label="Filtrar"><option value="">Todos</option><option value="kill" ${ui.evf==='kill'?'selected':''}>Los que eliminan</option><option value="issues" ${ui.evf==='issues'?'selected':''}>Para revisar</option></select>
  <span class="hint" id="count">${countText('events')}</span></div>
  <div id="list">${eventsListHTML()}</div>`;
}
function chanceSection(e,blocks){
  const c=e.chance,m=c.mode;
  const hints={
    always:'El evento ocurre siempre como está escrito.',
    fixed:'Es el mismo porcentaje siempre.',
    stat:'Gana más probabilidad quien tenga más de esa stat: X con 6 e Y con 2 da 75%. Lo que un personaje no tiene vale 0.',
    team:'Cuanto más grande sea el equipo de X frente al de Y, más probabilidad. Quien no tiene equipo cuenta como uno solo (3 contra 1 da 75%).',
    loyalty:'Con lealtad 20, X tiene 80% de probabilidad; con lealtad 90, solo 10%. Sirve para las traiciones.'
  };
  let h=`<section class="card sec"><h3 class="h3">Resultado</h3><p class="hint">Podés hacer que el evento tenga una probabilidad de «salir bien». Si no sale bien, pasa otra cosa (con su propio texto y efectos). El registro muestra la probabilidad usada.</p>
  <div class="two"><div><label for="ch-mode">Probabilidad</label><select id="ch-mode" data-bind="ch-mode">${CHANCE_MODES.map(k=>`<option value="${k}" ${m===k?'selected':''}>${CHANCE_LBL[k]}</option>`).join('')}</select></div>`;
  if(m==='fixed') h+=`<div><label for="ch-pct">Probabilidad (%)</label><input type="number" id="ch-pct" min="0" max="100" value="${c.pct}" data-bind="ch-pct"></div>`;
  if(m==='stat') h+=`<div><label for="ch-stat">Stat</label><select id="ch-stat" data-bind="ch-stat"><option value="">Elegir…</option>${P.stats.map(s=>`<option value="${s.id}" ${c.stat===s.id?'selected':''}>${esc(s.name||'Sin nombre')}</option>`).join('')}${c.stat&&!P.stats.some(s=>s.id===c.stat)?`<option value="${esc(c.stat)}" selected>⚠ ya no existe</option>`:''}</select></div>`;
  h+=`</div><p class="hint">${hints[m]}</p>`;
  if(m!=='always'){
    h+=`<div><label for="ev-fail">Texto si no sale bien</label><textarea id="ev-fail" rows="2" data-bind="ev-fail">${esc(e.failText)}</textarea></div>
    <p class="hint">Efectos si no sale bien</p>
    ${blocks?fxZoneHTML(e,'fxFail'):`${e.fxFail.length?e.fxFail.map((f,i)=>fxHTML(e,f,i,'fxFail')).join(''):'<p class="hint">Sin efectos: solo se cuenta lo que pasó.</p>'}
    <div><button type="button" class="btn sm" data-act="fx-add" data-list="fxFail">Agregar efecto</button></div>`}`;
  }
  return h+'</section>';
}
function vEventForm(e){
  const iss=issues(e);
  return `<div class="bar"><button type="button" class="btn" data-act="ev-back">← Eventos</button><button type="button" class="btn dng" data-act="ev-del" data-confirm="¿Eliminar? Tocá otra vez">Eliminar evento</button></div>
  ${iss.length?`<div class="note warn"><b>Para revisar</b><ul>${iss.map(i=>`<li>${esc(i)}</li>`).join('')}</ul></div>`:''}
  ${viewToggleHTML()}
  <section class="card sec"><h3 class="h3">Qué pasa</h3><div><label for="ev-text">Texto del evento</label><textarea id="ev-text" rows="3" data-bind="ev-text">${esc(e.text)}</textarea></div>
  <div class="acts">${e.roles.map(r=>`<button type="button" class="btn sm" data-act="token" data-t="${r.n}">Insertar {${r.n}}</button>`).join('')}</div>
  <p class="prev" id="ev-prev">${previewHTML(e)}</p></section>
  <section class="card sec"><h3 class="h3">Participantes</h3><p class="hint">X es quien actúa en su turno y siempre está vivo. Los demás se eligen al azar entre quienes cumplan las condiciones. Nadie participa dos veces en el mismo día. En «imagen» podés escribir la etiqueta de la imagen que se muestra para ese participante (si no la tiene, usa la principal).</p>
  <datalist id="tags">${allTags().map(t=>`<option value="${esc(t)}">`).join('')}</datalist>
  ${e.roles.map((r,i)=>`<div class="rrow"><span class="rl">${r.n}</span>${i===0?'<span class="hint">Actúa · vivo</span>':`<select data-bind="role-req" data-i="${i}" aria-label="Estado de ${r.n}">${REQ.map(q=>`<option value="${q[0]}" ${r.req===q[0]?'selected':''}>${q[1]}</option>`).join('')}</select>`}<input type="text" list="tags" value="${esc(r.look)}" placeholder="imagen: principal" data-bind="role-look" data-i="${i}" aria-label="Etiqueta de imagen de ${r.n}" autocomplete="off">${(i===e.roles.length-1&&i>0)?`<button type="button" class="x" data-act="role-del" aria-label="Quitar ${r.n}">✕</button>`:''}</div>`).join('')}
  ${e.roles.length<4?'<div><button type="button" class="btn sm" data-act="role-add">Agregar participante</button></div>':''}</section>
  ${ui.evView==='blocks'?programHTML(e):`  <section class="card sec"><h3 class="h3">Condiciones</h3><p class="hint">El evento solo puede ocurrir si se cumplen. Combiná reglas con grupos Y, O y NO, y anidá grupos dentro de grupos. Una stat que el personaje no tiene vale 0.</p>${condHTML(e,e.cond,'',0)}</section>
  <section class="card sec"><h3 class="h3">Efectos</h3><p class="hint">Lo que cambia cuando ocurre. Si un objeto no entra en los slots, el personaje no tiene la stat o no hay equipo para el efecto, ese efecto no se aplica y queda una nota en el registro.</p>
  ${e.fx.length?e.fx.map((f,i)=>fxHTML(e,f,i,'fx')).join(''):'<p class="hint">Sin efectos: el evento es solo una escena.</p>'}
  <div><button type="button" class="btn sm" data-act="fx-add" data-list="fx">Agregar efecto</button></div></section>
  ${chanceSection(e)}`}
  <section class="card sec"><h3 class="h3">Frecuencia</h3><div><input type="range" id="ev-weight" min="1" max="10" value="${e.weight}" data-bind="ev-weight" aria-label="Frecuencia"> <output id="ev-w" class="chip">${e.weight}</output></div><p class="hint">Más alta significa que aparece más seguido cuando puede ocurrir.</p></section>
  <div class="acts"><button type="button" class="btn pri" data-act="ev-back">Listo</button></div>`;
}

/* ======================= SIMULACIÓN ======================= */
function ensureSim(){if(!S)S=newSim();return S;}
const emoOf=c=>c.emotion?(P.emotions.find(m=>m.id===c.emotion)||null):null;
const emoTag=c=>{const m=emoOf(c);return m?` <span class="emo" title="${esc(m.name)}">${esc(m.icon||m.name)}</span>`:'';};
function rosterListHTML(s){
  const q=norm(ui.q.roster);
  const L=s.chars.filter(c=>(!q||norm(c.name).includes(q))&&(ui.simFilter==='all'||(ui.simFilter==='alive'?c.alive:!c.alive)));
  if(!L.length) return '<p class="hint">Sin resultados.</p>';
  return '<ul>'+L.map(c=>{
    const t=teamOfIn(s,c);
    return `<li><button type="button" class="ro ${c.alive?'':'out'} ${ui.simSel===c.id?'on':''}" data-act="sim-sel" data-id="${c.id}">${av(c)}<div><b>${esc(c.name)}${emoTag(c)}</b><small>${c.kills?plural(c.kills,'baja','bajas')+' · ':''}${usedSlots(c)}/${c.slots} slots${t?' · '+esc(t.name):''}</small></div><span class="st">${c.alive?'VIVO':'BAJA'}</span></button></li>`;
  }).join('')+'</ul>';
}
function teamsSideHTML(s){
  if(!s.teams.length) return '';
  return `<section class="card"><h3 class="h3">Equipos</h3><ul class="tlist">${s.teams.map(t=>{
    const mem=teamMatesIn(s,t),ld=mem.find(m=>m.id===t.leader);
    return `<li><b>${esc(t.name)}</b><div class="stack">${mem.slice(0,6).map(m=>avS(m.name,lookFor(m,''),'sm')).join('')}</div><small>${plural(mem.length,'miembro','miembros')}${ld?' · Líder: '+esc(ld.name):' · Sin líder'}${t.share?' · Inventario compartido':''}</small></li>`;
  }).join('')}</ul></section>`;
}
function simDetail(s){
  const c=s.chars.find(x=>x.id===ui.simSel);
  if(!c) return '';
  const items=[...c.items].map(id=>nameOf(P.items,id)).filter(Boolean);
  const skills=[...c.skills].map(id=>nameOf(P.skills,id)).filter(Boolean);
  const stats=Object.keys(c.stats).map(id=>({n:nameOf(P.stats,id),v:c.stats[id]})).filter(x=>x.n);
  const t=teamOfIn(s,c),em=emoOf(c);
  return `<section class="card detail"><div class="dhead">${av(c,'lg')}<div><h3 class="h3">${esc(c.name)}</h3><span class="st ${c.alive?'':'out'}">${c.alive?'VIVO':'BAJA'}</span> <span class="hint">${GEN[c.gender]}</span></div><button type="button" class="x" data-act="sim-sel" data-id="" aria-label="Cerrar">✕</button></div>
  <dl><div><dt>Equipo</dt><dd>${t?esc(t.name)+(t.leader===c.id?' (líder)':''):'<span class="hint">Sin equipo</span>'}</dd></div>
  <div><dt>Ánimo</dt><dd>Lealtad <b>${Math.round(c.loy)}</b> · ${em?esc((em.icon?em.icon+' ':'')+em.name):'<span class="hint">sin emoción</span>'}</dd></div>
  <div><dt>Stats</dt><dd>${stats.length?stats.map(x=>`${esc(x.n)} <b>${x.v}</b>`).join(' · '):'<span class="hint">Ninguna</span>'}</dd></div>
  <div><dt>Inventario (${usedSlots(c)}/${c.slots})</dt><dd>${items.length?esc(items.join(', ')):'<span class="hint">Vacío</span>'}</dd></div>
  <div><dt>Habilidades</dt><dd>${skills.length?esc(skills.join(', ')):'<span class="hint">Ninguna</span>'}</dd></div>
  <div><dt>Bajas</dt><dd>${c.kills?esc(c.victims.join(', ')):'<span class="hint">Ninguna</span>'}</dd></div>
  ${c.alive?'':`<div><dt>Eliminado</dt><dd>Día ${c.diedDay} · por ${c.killedBy?esc(c.killedBy.name):'nadie en particular'}</dd></div>`}</dl></section>`;
}
function summaryHTML(s){
  const rows=s.chars.slice().sort((a,b)=>(b.alive-a.alive)||(b.kills-a.kills)||a.name.localeCompare(b.name));
  return `<section class="card" style="margin-bottom:16px"><h3 class="h3">Resumen</h3><div class="tablewrap"><table><thead><tr><th>Personaje</th><th>Estado</th><th>Bajas</th><th>Eliminado por</th><th>Día</th></tr></thead><tbody>${rows.map(c=>`<tr><td>${avS(c.name,lookSrc(c,''),'sm')}${esc(c.name)}</td><td><span class="st ${c.alive?'':'out'}">${c.alive?'VIVO':'BAJA'}</span></td><td>${c.kills}${c.victims.length?` <span class="hint">(${esc(c.victims.join(', '))})</span>`:''}</td><td>${c.alive?'—':(c.killedBy?esc(c.killedBy.name):'Sin culpable')}</td><td>${c.diedDay||'—'}</td></tr>`).join('')}</tbody></table></div></section>`;
}
function optsHTML(en,dis){
  return `<details class="card opts" id="opts" ${ui.optsOpen?'open':''}><summary>Participantes y modo caos</summary><div class="inner">
  <div><p>Participan <b>${en}</b> de ${P.chars.length} personajes${dis?` (${dis} deshabilitados)`:''}.</p><p class="hint">Si hay demasiados, sacá algunos al azar para que la partida sea más corta. Queda guardado en la ficha de cada personaje.</p></div>
  <div class="row"><label for="shuffle-n" style="margin:0">Cantidad</label><input type="number" id="shuffle-n" min="0" value="${ui.shuffleN}" data-bind="shuffle-n"><button type="button" class="btn sm" data-act="shuffle-off">Deshabilitar al azar</button><button type="button" class="btn sm" data-act="shuffle-keep">Dejar solo esa cantidad</button><button type="button" class="btn sm" data-act="enable-all">Habilitar todos</button></div>
  <div class="row"><label class="check"><input type="checkbox" data-bind="chaos-on" ${ui.chaos?'checked':''}>Modo caos</label><input type="range" min="1" max="10" value="${ui.chaosLvl}" data-bind="chaos-lvl" aria-label="Intensidad del caos"><output id="chaos-out" class="chip">${ui.chaosLvl}</output></div>
  <p class="hint">Cada día reordena al azar stats, objetos, habilidades, lealtad y emociones de los vivos, y algunos personajes viven eventos sin cumplir sus condiciones. Más intensidad, más locura.</p></div></details>`;
}
function vSim(){
  const en=P.chars.filter(c=>c.enabled).length,dis=P.chars.length-en;
  if(en<2) return `<div class="note warn"><b>Hacen falta al menos 2 personajes habilitados.</b> Hay ${en} de ${P.chars.length}. Creá o habilitá personajes en la pestaña Personajes.</div>`+optsHTML(en,dis);
  const s=ensureSim(),alive=s.chars.filter(c=>c.alive);
  const noKill=!P.events.some(e=>allFx(e).some(f=>f.k==='kill'));
  let h='';
  if(noKill) h+='<div class="note warn"><b>Ningún evento elimina personajes.</b> La partida no va a terminar sola. Agregá un efecto «Elimina a» en algún evento.</div>';
  h+=`<section class="card ctl"><div class="dayno"><span class="lbl">Día</span><b>${pad(s.day)}</b></div><div class="cnt"><b>${alive.length}</b>en pie de ${s.chars.length}</div><div class="acts"><button type="button" class="btn pri" data-act="sim-next" ${s.over?'disabled':''}>Siguiente día</button><button type="button" class="btn" data-act="sim-all" ${s.over?'disabled':''}>Hasta el final</button><button type="button" class="btn ${ui.summary?'on':''}" data-act="sim-summary">Resumen</button><button type="button" class="btn" data-act="sim-reset">Reiniciar</button></div></section>`;
  h+=optsHTML(en,dis);
  if(s.over){
    const w=alive[0];
    h+=`<section class="win">${w?av(w,'lg')+`<div><div class="t">Ganó ${esc(w.name)}</div><div class="hint">${plural(w.kills,'baja','bajas')} · sobrevivió ${plural(s.day,'día','días')}</div></div>`:`<div><div class="t">Sin sobrevivientes</div><div class="hint">Todos quedaron fuera el día ${s.day}.</div></div>`}</section>`;
  }
  if(s.capped) h+='<div class="note warn"><b>Se frenó en el día 200.</b> Revisá que haya eventos que eliminen personajes.</div>';
  if(s.over||ui.summary) h+=summaryHTML(s);
  h+=`<div class="simgrid"><aside class="side">${simDetail(s)}${teamsSideHTML(s)}<section class="card roster"><h3 class="h3">Elenco</h3><div class="fbar"><input type="search" placeholder="Buscar…" value="${esc(ui.q.roster)}" data-bind="q" data-k="roster" aria-label="Buscar en el elenco"><select data-bind="sim-filter" aria-label="Mostrar"><option value="all">Todos</option><option value="alive" ${ui.simFilter==='alive'?'selected':''}>Vivos</option><option value="dead" ${ui.simFilter==='dead'?'selected':''}>Bajas</option></select></div><div id="rlist">${rosterListHTML(s)}</div></section></aside>
  <section class="log" aria-label="Registro de días">${s.days.length?s.days.slice().reverse().map(d=>`<article class="day"><div class="day-h"><h3>Día ${pad(d.n)}</h3><span>${plural(d.alive,'persona en pie','personas en pie')}</span></div>${d.chaos?`<div class="chaosnote">Caos: ${plural(d.chaos.shaken,'personaje reordenado','personajes reordenados')} · ${plural(d.chaos.wild,'evento sin condiciones','eventos sin condiciones')}</div>`:''}${d.entries.map(en=>`<div class="en ${en.deaths.length?'dead':''}"><div class="stack">${en.who.slice(0,3).map(w=>avS(w.c.name,w.src,'sm')).join('')}</div><p>${en.html}${en.deaths.map(c=>`<span class="baja">BAJA · ${esc(c.name)}</span>`).join('')}${en.chance!=null?`<span class="nt">Probabilidad de éxito: ${en.chance}%</span>`:''}${en.notes.map(n=>`<span class="nt">${esc(n)}</span>`).join('')}</p></div>`).join('')}</article>`).join(''):'<div class="card"><h3 class="h3">Listos para empezar</h3><p class="hint">Todo el elenco está vivo. Cada día, cada personaje vivo vive un evento que cumpla sus condiciones. Tocá «Siguiente día» para empezar.</p></div>'}</section></div>`;
  return h;
}

/* ======================= DATOS ======================= */
function vData(){
  return `<div class="bar"><h2 class="h2">Datos</h2></div>
  <section class="card sec"><h3 class="h3">Copia de seguridad</h3><p class="hint">${STORE.ok?'Tu proyecto se guarda solo en este navegador (en este dispositivo y esta dirección).':'Este navegador no deja guardar el proyecto: lo que hagas se pierde al cerrar la página.'} Si borrás los datos del navegador se pierde, así que exportá una copia de vez en cuando. El archivo incluye las imágenes subidas.</p>
  <div class="acts"><button type="button" class="btn pri" data-act="data-export">Exportar archivo</button><button type="button" class="btn" data-act="data-copy">Copiar como texto</button></div>
  ${ui.exportText?`<p class="hint">${esc(ui.exportMsg)}</p><textarea id="exp-text" class="exp" rows="5" readonly aria-label="Texto del proyecto">${esc(ui.exportText)}</textarea>`:''}</section>
  <section class="card sec"><h3 class="h3">Importar</h3><div><label for="imp-file">Archivo exportado</label><input type="file" id="imp-file" accept=".json,application/json" data-bind="imp-file"></div>
  <div><label for="imp-text">O pegá el texto</label><textarea id="imp-text" class="exp" rows="4"></textarea></div>
  ${ui.dataMsg?`<p class="hint">${esc(ui.dataMsg)}</p>`:''}
  <div class="acts"><button type="button" class="btn dng" data-act="data-import" data-confirm="Reemplaza todo. Tocá otra vez">Importar</button></div></section>
  <section class="card sec"><h3 class="h3">Proyecto</h3><div class="acts"><button type="button" class="btn dng" data-act="data-blank" data-confirm="¿Borrar todo? Tocá otra vez">Empezar de cero</button><button type="button" class="btn" data-act="data-sample" data-confirm="Reemplaza todo. Tocá otra vez">Cargar el ejemplo</button></div></section>`;
}
function showExportText(json,msg){
  ui.exportText=json;ui.exportMsg=msg;render();
  setTimeout(()=>{const t=$('#exp-text');if(t)t.select();},0);
}
async function exportFile(){
  let json;
  try{json=await buildExport();}catch(e){toast('No se pudo preparar la copia');return;}
  try{
    const b=new Blob([json],{type:'application/json'});
    const u=URL.createObjectURL(b),a=document.createElement('a');
    a.href=u;a.download='simulador-battle-royale.json';
    document.body.appendChild(a);a.click();a.remove();
    setTimeout(()=>URL.revokeObjectURL(u),3000);
    toast('Archivo exportado');
  }catch(e){showExportText(json,'No se pudo descargar. Copiá el texto y guardalo en un archivo .json.');}
}
async function copyProject(){
  let json;
  try{json=await buildExport();}catch(e){toast('No se pudo preparar la copia');return;}
  try{await navigator.clipboard.writeText(json);toast('Proyecto copiado');}
  catch(e){showExportText(json,'No se pudo copiar solo. Seleccioná el texto y copialo.');}
}
function replaceProject(p){
  P=p;S=null;ui.char=ui.ev=ui.simSel=ui.team=null;ui.nameSamples=[];ui.sel.clear();ui.exportText='';ui.dataMsg='';ui.importBuf='';
  saveNow().then(gcBlobs);render();
}

/* ======================= ÁRBOL DE CONDICIONES ======================= */
function nodeAt(root,path){let n=root;if(!path)return n;path.split('.').forEach(i=>{n=n.c[+i];});return n;}
function parentOf(root,path){const p=path.split('.');const idx=+p.pop();return {parent:nodeAt(root,p.join('.')),idx};}
function defaultVal(kind){
  const L=refListOf(kind);
  if(L) return P[L][0]?P[L][0].id:'';
  if(NOVAL.includes(kind)) return '';
  return kind==='gender'?'f':'alive';
}

/* ======================= ACCIONES (botones) ======================= */
const blankChar=name=>({id:uid(),name,gender:'o',enabled:true,slots:DEFAULT_SLOTS,imgs:[],items:[],skills:[],stats:{},loy:50,emotion:''});
const selChars=()=>P.chars.filter(c=>ui.sel.has(c.id));
function pickBulk(kind,on,cat){
  const c=curChar();if(!c)return;
  let skipped=0;
  pickFilter(kind).filter(i=>cat==null||(i.cat||'')===cat).forEach(i=>{
    const idx=c[kind].indexOf(i.id);
    if(on){
      if(idx<0){
        if(kind==='items'&&i.size>slotsFree(c)){skipped++;return;}
        c[kind].push(i.id);
      }
    } else if(idx>=0) c[kind].splice(idx,1);
  });
  touch();refreshPicker(kind);
  if(skipped)toast(plural(skipped,'objeto no entró','objetos no entraron')+' por falta de espacio.');
}
function tagAdd(kind){
  const name=$('#new-name').value.trim();if(!name)return;
  const o={id:uid(),name};
  if(kind==='items'){const v=parseInt($('#new-size').value,10);o.size=isNaN(v)?1:Math.max(0,v);o.cat=$('#new-cat').value.trim();}
  else if(kind==='skills'){o.cat=$('#new-cat').value.trim();}
  else if(kind==='emotions'){const v=parseInt($('#new-days').value,10);o.icon=$('#new-icon').value.trim();o.days=isNaN(v)?0:Math.max(0,v);}
  else{const v=parseFloat($('#new-def').value);o.def=isFinite(v)?v:5;}
  P[kind].push(o);structural();
  const f=$('#new-name');if(f)f.focus();
}

const ACT={
  tab(b){
    const k=b.dataset.tab;
    if(ui.tab===k){ui.char=null;ui.ev=null;ui.team=null;}
    ui.tab=k;render();
  },
  /* personajes */
  'char-new'(){
    const c=blankChar('');
    P.chars.push(c);ui.char=c.id;structural();window.scrollTo(0,0);
    const f=$('#c-name');if(f)f.focus();
  },
  'char-edit'(b){ui.char=b.dataset.id;render();window.scrollTo(0,0);},
  'char-pick'(b){
    const id=b.dataset.id;
    if(ui.sel.has(id))ui.sel.delete(id);else ui.sel.add(id);
    refreshList('chars');
  },
  'char-back'(){
    const c=curChar();
    if(c&&!c.name.trim()){c.name='Personaje '+(P.chars.indexOf(c)+1);touch();}
    ui.char=null;render();
  },
  'char-del'(){
    const c=curChar();
    if(c)c.imgs.forEach(removeImageData);
    P.chars=P.chars.filter(x=>x.id!==ui.char);ui.char=null;structural();toast('Personaje eliminado');
  },
  'bulk-toggle'(){ui.bulk=!ui.bulk;render();const t=$('#bulk-text');if(t)t.focus();},
  'bulk-add'(){
    const names=$('#bulk-text').value.split('\n').map(s=>s.trim()).filter(Boolean).slice(0,300);
    if(!names.length)return;
    names.forEach(n=>P.chars.push(blankChar(n)));
    ui.bulk=false;structural();toast(plural(names.length,'personaje creado','personajes creados'));
  },
  'img-url'(){
    const c=curChar(),inp=$('#img-url'),u=inp.value.trim();if(!c||!u)return;
    if(!/^https?:\/\//i.test(u)){toast('La URL tiene que empezar con http:// o https://');return;}
    c.imgs.push({id:uid(),kind:'url',src:u,tag:''});structural();
  },
  'img-main'(b){const c=curChar();const i=+b.dataset.i;if(!c||!c.imgs[i])return;c.imgs.unshift(c.imgs.splice(i,1)[0]);structural();},
  'img-del'(b){const c=curChar();const i=+b.dataset.i;if(!c||!c.imgs[i])return;removeImageData(c.imgs[i]);c.imgs.splice(i,1);structural();},
  'pick-all'(b){pickBulk(b.dataset.kind,true,null);},
  'pick-none'(b){pickBulk(b.dataset.kind,false,null);},
  'pick-cat'(b){pickBulk(b.dataset.kind,true,b.dataset.cat);},
  'stat-add'(){
    const c=curChar(),id=$('#stat-add-sel')&&$('#stat-add-sel').value,s=P.stats.find(x=>x.id===id);
    if(!c||!s)return;c.stats[id]=s.def;structural();
  },
  'stat-addall'(){const c=curChar();if(!c)return;P.stats.forEach(s=>{if(!hasStat(c,s.id))c.stats[s.id]=s.def;});structural();},
  'char-stat-del'(b){const c=curChar();if(!c)return;delete c.stats[b.dataset.id];structural();},
  'copy-from'(){
    const c=curChar(),src=P.chars.find(x=>x.id===$('#copy-src').value);if(!c||!src)return;
    c.items=[];let skipped=0;
    src.items.forEach(id=>{if(slotsFree(c)>=sizeOf(id))c.items.push(id);else skipped++;});
    c.skills=src.skills.slice();c.stats=Object.assign({},src.stats);
    structural();toast(skipped?plural(skipped,'objeto no entró','objetos no entraron')+' por falta de espacio.':'Copiado');
  },
  /* selección múltiple */
  'sel-toggle'(){ui.selMode=!ui.selMode;if(!ui.selMode)ui.sel.clear();render();},
  'sel-all'(){charsFiltered().forEach(c=>ui.sel.add(c.id));refreshList('chars');},
  'sel-none'(){ui.sel.clear();refreshList('chars');},
  'sel-enable'(){selChars().forEach(c=>{c.enabled=true;});structural();},
  'sel-disable'(){selChars().forEach(c=>{c.enabled=false;});structural();},
  'sel-giveitem'(){
    const id=$('#sel-item').value;if(!id)return;
    let ok=0,skip=0;
    selChars().forEach(c=>{if(c.items.includes(id))return;if(slotsFree(c)>=sizeOf(id)){c.items.push(id);ok++;}else skip++;});
    structural();toast(plural(ok,'personaje recibió','personajes recibieron')+' el objeto'+(skip?'. '+plural(skip,'no tenía','no tenían')+' espacio.':'.'));
  },
  'sel-giveskill'(){
    const id=$('#sel-skill').value;if(!id)return;
    selChars().forEach(c=>{if(!c.skills.includes(id))c.skills.push(id);});structural();toast('Habilidad entregada');
  },
  'sel-setstat'(){
    const id=$('#sel-stat').value,v=parseFloat($('#sel-statv').value);if(!id||!isFinite(v))return;
    selChars().forEach(c=>{c.stats[id]=v;});structural();toast('Stat actualizada');
  },
  'sel-setslots'(){
    const v=parseInt($('#sel-slots').value,10);if(isNaN(v)||v<0)return;
    selChars().forEach(c=>{c.slots=v;});structural();toast('Slots actualizados');
  },
  'sel-del'(){
    const n=ui.sel.size;
    selChars().forEach(c=>c.imgs.forEach(removeImageData));
    P.chars=P.chars.filter(c=>!ui.sel.has(c.id));ui.sel.clear();structural();toast(plural(n,'personaje eliminado','personajes eliminados'));
  },
  /* catálogos */
  'tag-add'(b){tagAdd(b.dataset.kind);},
  'tag-del'(b){
    const kind=b.dataset.kind,id=b.dataset.id,u=usage(kind,id);
    P[kind]=P[kind].filter(i=>i.id!==id);
    P.chars.forEach(c=>{
      if(kind==='stats')delete c.stats[id];
      else if(kind==='emotions'){if(c.emotion===id)c.emotion='';}
      else c[kind]=c[kind].filter(x=>x!==id);
    });
    structural();
    toast(u.ev?('Eliminado. '+plural(u.ev,'evento quedó','eventos quedaron')+' con una referencia rota.'):'Eliminado');
  },
  /* eventos */
  'ev-new'(){
    const e={id:uid(),text:'',weight:3,roles:[{n:'X',req:'alive',look:''}],cond:emptyCond(),fx:[],chance:{mode:'always',pct:50,stat:''},failText:'',fxFail:[]};
    P.events.push(e);ui.ev=e.id;structural();window.scrollTo(0,0);
    const f=$('#ev-text');if(f)f.focus();
  },
  'ev-edit'(b){ui.ev=b.dataset.id;render();window.scrollTo(0,0);},
  'ev-back'(){ui.ev=null;render();},
  'ev-dup'(b){
    const src=P.events.find(e=>e.id===b.dataset.id);if(!src)return;
    const c=JSON.parse(JSON.stringify(src));c.id=uid();
    P.events.splice(P.events.indexOf(src)+1,0,c);structural();toast('Evento duplicado');
  },
  'ev-del'(){P.events=P.events.filter(e=>e.id!==ui.ev);ui.ev=null;structural();toast('Evento eliminado');},
  token(b){
    const e=curEv(),t=$('#ev-text');if(!e||!t)return;
    const tok='{'+b.dataset.t+'}',a=t.selectionStart,z=t.selectionEnd;
    t.value=t.value.slice(0,a)+tok+t.value.slice(z);
    t.focus();t.selectionStart=t.selectionEnd=a+tok.length;
    e.text=t.value;$('#ev-prev').innerHTML=previewHTML(e);touch();
  },
  'role-add'(){const e=curEv();if(!e||e.roles.length>=4)return;e.roles.push({n:ROLE_NAMES[e.roles.length],req:'alive',look:''});structural();},
  'role-del'(){const e=curEv();if(!e||e.roles.length<2)return;e.roles.pop();structural();},
  'g-op'(b){const e=curEv();nodeAt(e.cond,b.dataset.path).op=b.dataset.op;structural();},
  'add-rule'(b){
    const e=curEv(),g=nodeAt(e.cond,b.dataset.path);
    g.c.push(newRule(e));structural();
  },
  'add-group'(b){const e=curEv(),g=nodeAt(e.cond,b.dataset.path);g.c.push({t:'g',op:'or',c:[]});structural();},
  'node-del'(b){const e=curEv(),q=parentOf(e.cond,b.dataset.path);q.parent.c.splice(q.idx,1);structural();},
  'rule-neg'(b){const e=curEv(),r=nodeAt(e.cond,b.dataset.path);r.neg=!r.neg;structural();},
  'fx-add'(b){const e=curEv();fxList(e,b.dataset.list).push(newFx(e));structural();},
  'fx-del'(b){const e=curEv();fxList(e,b.dataset.list).splice(+b.dataset.i,1);structural();},
  /* simulación */
  'sim-next'(){ensureSim();playDay(S,{chaos:ui.chaos?ui.chaosLvl:0});render();},
  'sim-all'(){
    ensureSim();
    while(!S.over&&S.day<200)playDay(S,{chaos:ui.chaos?ui.chaosLvl:0});
    if(!S.over)S.capped=true;
    render();
  },
  'sim-reset'(){S=newSim();ui.simSel=null;render();},
  'sim-summary'(){ui.summary=!ui.summary;render();},
  'sim-sel'(b){const id=b.dataset.id;ui.simSel=(!id||ui.simSel===id)?null:id;render();},
  'shuffle-off'(){
    const n=Math.max(0,parseInt(ui.shuffleN,10)||0);
    shuffle(P.chars.filter(c=>c.enabled)).slice(0,n).forEach(c=>{c.enabled=false;});
    ui.optsOpen=true;structural();
  },
  'shuffle-keep'(){
    const n=Math.max(1,parseInt(ui.shuffleN,10)||1);
    shuffle(P.chars.filter(c=>c.enabled)).slice(n).forEach(c=>{c.enabled=false;});
    ui.optsOpen=true;structural();
  },
  'enable-all'(){P.chars.forEach(c=>{c.enabled=true;});ui.optsOpen=true;structural();},
  /* datos */
  'data-export'(){exportFile();},
  'data-copy'(){copyProject();},
  async 'data-import'(){
    const txt=($('#imp-text').value.trim())||ui.importBuf;
    if(!txt){ui.dataMsg='Elegí un archivo o pegá el texto primero.';render();return;}
    try{
      const p=await importProjectText(txt);
      replaceProject(p);ui.tab='chars';render();toast('Proyecto importado');
    }catch(e){ui.dataMsg='No se pudo leer ese contenido. Tiene que venir de «Exportar» en este simulador.';render();}
  },
  'data-blank'(){replaceProject(normalize({v:3}));ui.tab='chars';render();toast('Proyecto vacío');},
  'data-sample'(){replaceProject(sampleProject());toast('Ejemplo cargado');}
};

/* ======================= CAMPOS ======================= */
const BIND={
  q(t){ui.q[t.dataset.k]=t.value;refreshList(t.dataset.k);},
  pq(t){ui.pq[t.dataset.kind]=t.value;refreshPicker(t.dataset.kind);},
  'f-gender'(t){ui.fgender=t.value;refreshList('chars');},
  'f-state'(t){ui.fstate=t.value;refreshList('chars');},
  'ev-filter'(t){ui.evf=t.value;refreshList('events');},
  'sim-filter'(t){ui.simFilter=t.value;refreshList('roster');},
  'char-name'(t){const c=curChar();if(c){c.name=t.value;touch();}},
  'char-gender'(t){const c=curChar();if(c){c.gender=t.value;touch();}},
  'char-enabled'(t){const c=curChar();if(c){c.enabled=t.checked;touch();}},
  'char-slots'(t){
    const c=curChar();if(!c)return;
    const v=parseInt(t.value,10);c.slots=isNaN(v)?0:Math.max(0,v);touch();refreshPicker('items');
  },
  'char-toggle'(t){
    const c=curChar();if(!c)return;
    const kind=t.dataset.kind,id=t.dataset.id,arr=c[kind],i=arr.indexOf(id);
    if(t.checked&&i<0){
      if(kind==='items'&&sizeOf(id)>slotsFree(c)){t.checked=false;toast('No hay espacio para ese objeto.');return;}
      arr.push(id);
    }
    if(!t.checked&&i>=0)arr.splice(i,1);
    touch();refreshPicker(kind);
  },
  'char-stat'(t){const c=curChar();const v=parseFloat(t.value);if(c&&isFinite(v)){c.stats[t.dataset.id]=v;touch();}},
  'img-tag'(t){const c=curChar();if(c&&c.imgs[+t.dataset.i]){c.imgs[+t.dataset.i].tag=t.value;touch();}},
  async 'img-file'(t){
    const c=curChar(),files=[...(t.files||[])];if(!c||!files.length)return;
    let fail=0;
    for(const f of files){try{c.imgs.push(await addFileImage(f));}catch(e){fail++;}}
    t.value='';structural();
    if(fail)toast(plural(fail,'archivo no se pudo usar','archivos no se pudieron usar')+' (tiene que ser una imagen; los GIF hasta 8 MB).');
  },
  'tag-name'(t){const x=P[t.dataset.kind].find(i=>i.id===t.dataset.id);if(x){x.name=t.value;touch();}},
  'tag-size'(t){const x=P.items.find(i=>i.id===t.dataset.id);const v=parseInt(t.value,10);if(x&&!isNaN(v)){x.size=Math.max(0,v);touch();}},
  'tag-def'(t){const x=P.stats.find(i=>i.id===t.dataset.id);const v=parseFloat(t.value);if(x&&isFinite(v)){x.def=v;touch();}},
  'tag-cat'(t){const x=P[t.dataset.kind].find(i=>i.id===t.dataset.id);if(x){x.cat=t.value.trim();touch();}},
  'ev-text'(t){const e=curEv();if(e){e.text=t.value;$('#ev-prev').innerHTML=previewHTML(e);touch();}},
  'ev-weight'(t){const e=curEv();if(e){e.weight=+t.value;$('#ev-w').textContent=t.value;touch();}},
  'role-req'(t){const e=curEv();if(e){e.roles[+t.dataset.i].req=t.value;touch();}},
  'role-look'(t){const e=curEv();if(e){e.roles[+t.dataset.i].look=t.value;touch();}},
  'rule-role'(t){const e=curEv();nodeAt(e.cond,t.dataset.path).role=t.value;structural();},
  'rule-kind'(t){const e=curEv();setRuleKind(e,nodeAt(e.cond,t.dataset.path),t.value);structural();},
  'rule-val'(t){const e=curEv();nodeAt(e.cond,t.dataset.path).val=t.value;structural();},
  'rule-op'(t){const e=curEv();nodeAt(e.cond,t.dataset.path).op=t.value;structural();},
  'rule-num'(t){const e=curEv();const v=parseFloat(t.value);if(isFinite(v)){nodeAt(e.cond,t.dataset.path).num=v;touch();}},
  'rule-role2'(t){const e=curEv();nodeAt(e.cond,t.dataset.path).role2=t.value;structural();},
  'fx-k'(t){const e=curEv();setFxKind(e,fxList(e,t.dataset.list)[+t.dataset.i],t.value);structural();},
  'fx-ref'(t){const e=curEv();fxList(e,t.dataset.list)[+t.dataset.i].ref=t.value;structural();},
  'fx-role'(t){const e=curEv();fxList(e,t.dataset.list)[+t.dataset.i].role=t.value;structural();},
  'fx-by'(t){const e=curEv();fxList(e,t.dataset.list)[+t.dataset.i].by=t.value;structural();},
  'fx-mode'(t){const e=curEv();fxList(e,t.dataset.list)[+t.dataset.i].mode=t.value;touch();},
  'fx-nm'(t){const e=curEv();fxList(e,t.dataset.list)[+t.dataset.i].nm=t.value;touch();},
  'fx-num'(t){const e=curEv();const v=parseFloat(t.value);if(isFinite(v)){fxList(e,t.dataset.list)[+t.dataset.i].num=v;touch();}},
  'ch-mode'(t){const e=curEv();e.chance.mode=t.value;structural();},
  'ch-pct'(t){const e=curEv();const v=parseFloat(t.value);if(isFinite(v)){e.chance.pct=Math.min(100,Math.max(0,v));touch();}},
  'ch-stat'(t){const e=curEv();e.chance.stat=t.value;structural();},
  'ev-fail'(t){const e=curEv();if(e){e.failText=t.value;touch();}},
  'char-loy'(t){const c=curChar();const v=parseFloat(t.value);if(c&&isFinite(v)){c.loy=Math.min(100,Math.max(0,v));touch();}},
  'char-emotion'(t){const c=curChar();if(c){c.emotion=t.value;touch();}},
  'tag-icon'(t){const x=P.emotions.find(i=>i.id===t.dataset.id);if(x){x.icon=t.value.trim();touch();}},
  'tag-days'(t){const x=P.emotions.find(i=>i.id===t.dataset.id);const v=parseInt(t.value,10);if(x&&!isNaN(v)){x.days=Math.max(0,v);touch();}},
  'shuffle-n'(t){ui.shuffleN=t.value;},
  'chaos-on'(t){ui.chaos=t.checked;},
  'chaos-lvl'(t){ui.chaosLvl=+t.value;const o=$('#chaos-out');if(o)o.textContent=t.value;},
  'imp-file'(t){
    const f=t.files&&t.files[0];if(!f)return;
    const fr=new FileReader();
    fr.onload=()=>{ui.importBuf=String(fr.result);ui.dataMsg='Archivo cargado: '+f.name+'. Tocá Importar para reemplazar el proyecto actual.';render();};
    fr.onerror=()=>{ui.dataMsg='No se pudo leer el archivo.';render();};
    fr.readAsText(f);
  }
};

/* ---------- Eventos del navegador (un solo oyente para toda la página) ---------- */
function arm(b){
  b.dataset.armed='1';b.dataset.label=b.textContent;
  b.textContent=b.dataset.confirm;b.classList.add('armed');
  setTimeout(()=>{if(b.isConnected&&b.dataset.armed==='1'){b.dataset.armed='';b.textContent=b.dataset.label;b.classList.remove('armed');}},3500);
}
document.addEventListener('click',e=>{
  const b=e.target.closest('[data-act]');
  if(!b||(!app.contains(b)&&!tabsEl.contains(b)))return;
  if(b.hasAttribute('data-confirm')&&b.dataset.armed!=='1'){arm(b);return;}
  const f=ACT[b.dataset.act];if(f)f(b);
});
function onField(e){
  const t=e.target;
  if(!t.dataset||!t.dataset.bind)return;
  const choice=t.tagName==='SELECT'||t.type==='checkbox'||t.type==='file';
  if((e.type==='change')!==choice)return;
  const f=BIND[t.dataset.bind];if(f)f(t);
}
document.addEventListener('input',onField);
document.addEventListener('change',onField);
document.addEventListener('keydown',e=>{
  const t=e.target;
  if(e.key==='Enter'&&t.dataset&&t.dataset.enter){
    e.preventDefault();
    const sel=t.dataset.kind?`button[data-act="${t.dataset.enter}"][data-kind="${t.dataset.kind}"]`:`button[data-act="${t.dataset.enter}"]`;
    const b=app.querySelector(sel);if(b)b.click();
  }
});
document.addEventListener('toggle',e=>{if(e.target&&e.target.id==='opts')ui.optsOpen=e.target.open;},true);
/* Si una imagen no carga (URL rota), se saca y quedan las iniciales. */
document.addEventListener('error',e=>{const t=e.target;if(t&&t.tagName==='IMG'&&t.dataset.fb)t.remove();},true);
