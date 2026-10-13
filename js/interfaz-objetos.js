'use strict';
/* =====================================================================
   PESTAÑA DE OBJETOS.
   - Los objetos se muestran como tarjetas, como los personajes.
   - Se organizan en SECCIONES, y cada sección tiene CARPETAS. Un objeto está en una
     sección (o en «Sin sección») y, si la sección tiene carpetas, en una de ellas.
   - Cuatro vistas: secciones y carpetas / solo secciones (sin carpetas) / solo carpetas
     (las que se llaman igual se unen aunque sean de secciones distintas) / todo junto.
   - Un objeto puede tener varias categorías.
   - Mientras un personaje lo lleve en el inventario, un objeto puede cambiar sus stats
     (suma o multiplica) y agrandar el inventario (mochilas).
   ===================================================================== */
const ITEM_VIEWS=[['full','Secciones y carpetas'],['nofolders','Solo secciones (sin carpetas)'],['nosections','Solo carpetas (unidas por nombre)'],['flat','Todo junto']];
ui.itemView=(()=>{try{const v=localStorage.getItem('br.itemView');return ITEM_VIEWS.some(x=>x[0]===v)?v:'full';}catch(e){return 'full';}})();
ui.itemFx='';ui.itemClosed={};ui.itemTarget={sec:'',fold:''};
Object.assign(HELP,{
  'obj-vista':{t:'Cómo se ven los objetos',h:`<p>Los objetos se ordenan en <b>secciones</b> y, dentro de cada sección, en <b>carpetas</b>.</p>
    <ul><li><b>Secciones y carpetas</b>: la vista completa.</li>
    <li><b>Solo secciones</b>: cada sección muestra todos sus objetos juntos, sin separarlos por carpeta.</li>
    <li><b>Solo carpetas</b>: se ignoran las secciones y las carpetas que se llaman igual se unen, aunque sean de secciones distintas.</li>
    <li><b>Todo junto</b>: una sola lista con todos los objetos.</li></ul>
    <p>Para mover un objeto arrastralo desde ⠿ (también con el dedo) en las dos primeras vistas, o elegí su sección y carpeta en la ficha.</p>`},
  'obj-pasivos':{t:'Efectos mientras se lleva',h:`<p>Mientras un personaje tenga este objeto en el inventario, puede cambiarle las <b>stats</b> («suma» agrega, o resta con un número negativo; «multiplica por» escala) y el <b>espacio del inventario</b> (una mochila suma slots).</p>
    <p>Si el personaje no tiene una stat, el objeto no se la da: sigue valiendo 0. Los valores base no se tocan: si pierde el objeto, todo vuelve a la normalidad.</p>
    <p>Si se queda sin objeto que daba espacio y lleva de más, no pierde nada, pero no podrá recibir otros hasta liberar lugar.</p>`},
  'obj-cats':{t:'Categorías',h:`<p>Un objeto puede tener <b>varias categorías</b>. Sirven para filtrar la lista, para marcar grupos enteros de una vez en la ficha de un personaje y para que los eventos elijan objetos por categoría.</p>`}
});
const curItem=()=>P.items.find(i=>i.id===ui.item);
const allItemCats=()=>[...new Set(P.items.flatMap(catList).filter(Boolean))].sort((a,b)=>a.localeCompare(b,'es'));
const statNm=id=>(P.stats.find(s=>s.id===id)||{name:'⚠ stat borrada'}).name||'Sin nombre';
const secNameI=s=>s.name.trim()||'Sin nombre';
const numTxt=n=>String(Math.round(n*100)/100);
function itemFxChips(i){
  const out=(i.mods||[]).map(m=>(m.mode==='mult'?'×'+numTxt(m.num):(m.num>=0?'+':'−')+numTxt(Math.abs(m.num)))+' '+statNm(m.stat));
  if(i.slots) out.push((i.slots>0?'+':'−')+Math.abs(i.slots)+' slots');
  return out;
}
function itemsFiltered(){
  const q=norm(ui.q.items),c=ui.cat.items||'';
  return viewOf(P.items.filter(i=>(!q||norm(i.name).includes(q)||catList(i).some(x=>norm(x).includes(q)))
    &&(!c||(c==='__none'?!catList(i).length:catList(i).includes(c)))
    &&(!ui.itemFx||i.slots||(i.mods&&i.mods.length))),'items');
}
function itemCard(i,drag){
  const fx=itemFxChips(i),cl=catList(i),u=usage('items',i.id);
  const pic=ico(i,'lg')||`<span class="av lg" style="--h:${hue(i.name||'')}">${esc((i.name||'?').slice(0,1).toUpperCase())}</span>`;
  return `<div class="cwrap" data-iid="${i.id}"><button type="button" class="ccard" data-act="item-edit" data-id="${i.id}">${pic}<div><b>${esc(i.name||'Sin nombre')}</b><br><small>Tamaño ${i.size}</small>${fx.length?`<br><small class="ifx">${esc(fx.join(' · '))}</small>`:''}${cl.length?`<br>${cl.slice(0,3).map(c=>`<span class="chip">${esc(c)}</span>`).join(' ')}${cl.length>3?` <span class="chip">+${cl.length-3}</span>`:''}`:''}<br><small>${plural(u.ch,'personaje','personajes')} · ${plural(u.ev,'evento','eventos')}</small></div></button>
  ${drag?`<span class="ctools"><button type="button" class="chd" data-idrag="1" data-id="${i.id}" aria-label="Mover ${esc(i.name||'objeto')}" title="Arrastrar para mover">⠿</button></span>`:''}</div>`;
}
const gridI=(list,zone,closed,drag)=>`<div class="grid igb" ${zone!==null?`data-iz="${zone}"`:''} ${closed?'hidden':''}>${list.map(i=>itemCard(i,drag)).join('')||(zone!==null?'<p class="dz-empty">Arrastrá objetos acá.</p>':'')}</div>`;
const foldBtn=(act,id,closed,extra)=>`<button type="button" class="x fold" data-act="${act}" data-id="${id}" ${extra||''} aria-expanded="${!closed}" aria-label="${closed?'Desplegar':'Plegar'}">${closed?'▸':'▾'}</button>`;
function folderBlock(S,F,list,drag){
  const all=P.items.filter(i=>i.sec===S.id&&i.fold===F.id),i=S.folders.indexOf(F),n=S.folders.length;
  return `<div class="fd ${F.closed?'closed':''}" data-ifold="${F.id}"><div class="fd-h">${foldBtn('ifold-fold',F.id,F.closed)}<span class="fdi" aria-hidden="true">📁</span>
  <input type="text" class="sg-name" value="${esc(F.name)}" placeholder="Nombre de la carpeta" data-bind="ifold-name" data-id="${F.id}" aria-label="Nombre de la carpeta" autocomplete="off">
  <span class="chip">${plural(all.length,'objeto','objetos')}${list.length!==all.length?` · ${list.length} mostrados`:''}</span>
  <span class="acts"><button type="button" class="btn sm" data-act="item-newin" data-sec="${S.id}" data-fold="${F.id}">＋ Objeto</button><button type="button" class="x" data-act="ifold-up" data-id="${F.id}" aria-label="Subir carpeta" ${i===0?'disabled':''}>▲</button><button type="button" class="x" data-act="ifold-down" data-id="${F.id}" aria-label="Bajar carpeta" ${i===n-1?'disabled':''}>▼</button><button type="button" class="x" data-act="ifold-del" data-id="${F.id}" data-confirm="¿Eliminar? Tocá otra vez" aria-label="Eliminar carpeta (los objetos quedan sin carpeta)">✕</button></span></div>
  ${gridI(list,S.id+'|'+F.id,F.closed,drag)}</div>`;
}
function secBlockI(S,L,filtering,drag){
  const virtual=!S,sid=virtual?'':S.id,mine=L.filter(i=>i.sec===sid);
  if(filtering&&!mine.length) return '';
  const all=P.items.filter(i=>i.sec===sid);
  const closed=virtual?!!ui.itemClosed.nosec:S.closed;
  const cnt=`${plural(all.length,'objeto','objetos')}${mine.length!==all.length?` · ${mine.length} mostrados`:''}`;
  let head;
  if(virtual) head=`${foldBtn('isec-fold','',closed)}<b class="sg-t">Sin sección</b><span class="chip">${cnt}</span>`;
  else{
    const i=P.itemSecs.indexOf(S),n=P.itemSecs.length;
    head=`${foldBtn('isec-fold',sid,closed)}<input type="text" class="sg-name" value="${esc(S.name)}" placeholder="Nombre de la sección" data-bind="isec-name" data-id="${sid}" aria-label="Nombre de la sección" autocomplete="off">
    <span class="chip">${cnt}</span><span class="acts">${ui.itemView==='full'?`<button type="button" class="btn sm" data-act="ifold-new" data-id="${sid}">＋ Carpeta</button>`:''}<button type="button" class="btn sm" data-act="item-newin" data-sec="${sid}" data-fold="">＋ Objeto</button>
    <button type="button" class="x" data-act="isec-up" data-id="${sid}" aria-label="Subir sección" ${i===0?'disabled':''}>▲</button><button type="button" class="x" data-act="isec-down" data-id="${sid}" aria-label="Bajar sección" ${i===n-1?'disabled':''}>▼</button><button type="button" class="x" data-act="isec-del" data-id="${sid}" data-confirm="¿Eliminar? Tocá otra vez" aria-label="Eliminar sección (sus objetos quedan sin sección)">✕</button></span>`;
  }
  let body;
  if(ui.itemView==='full'&&!virtual){
    const loose=mine.filter(i=>!i.fold);
    body=S.folders.map(F=>{const l=mine.filter(i=>i.fold===F.id);return(filtering&&!l.length)?'':folderBlock(S,F,l,drag);}).join('');
    if(S.folders.length){
      if(!(filtering&&!loose.length)){
        const key=sid+'|',cl=!!ui.itemClosed[key];
        body+=`<div class="fd nof ${cl?'closed':''}"><div class="fd-h">${foldBtn('inof-fold',sid,cl)}<b class="sg-t">Sin carpeta</b><span class="chip">${plural(loose.length,'objeto','objetos')}</span></div>${gridI(loose,key,cl,drag)}</div>`;
      }
    } else body+=gridI(loose,sid+'|',false,drag);
  } else body=gridI(mine,sid+'|',false,drag);
  return `<section class="sg ${closed?'closed':''}" data-isec="${sid}"><div class="sg-h">${head}</div><div class="sgb" ${closed?'hidden':''}>${body}</div></section>`;
}
function mergedFolders(L){
  const groups=new Map(),keyOf=n=>norm((n||'').trim());
  P.itemSecs.forEach(S=>S.folders.forEach(F=>{const k=keyOf(F.name);if(!groups.has(k))groups.set(k,{name:F.name.trim()||'Sin nombre',key:k,items:[],secs:new Set()});groups.get(k).secs.add(S.id);}));
  const none={name:'Sin carpeta',key:'__none',items:[],secs:new Set()};
  L.forEach(i=>{
    const S=P.itemSecs.find(x=>x.id===i.sec),F=S&&S.folders.find(f=>f.id===i.fold);
    (F?groups.get(keyOf(F.name)):none).items.push(i);
  });
  return [...groups.values()].concat([none]);
}
function itemsListHTML(){
  if(!P.items.length&&!P.itemSecs.length) return '<p class="empty">Todavía no hay objetos. Agregá el primero arriba.</p>';
  const L=itemsFiltered(),filtering=L.length!==P.items.length;
  if(!L.length) return '<p class="empty">Ningún objeto coincide con la búsqueda.</p>';
  const v=ui.itemView,drag=v==='full'||v==='nofolders';
  if(v==='flat') return gridI(L,null,false,false);
  if(v==='nosections'){
    return mergedFolders(L).filter(g=>g.items.length||(!filtering&&g.key!=='__none')).map(g=>{
      const cl=!!ui.itemClosed['m:'+g.key];
      return `<section class="sg ${cl?'closed':''}"><div class="sg-h">${foldBtn('imf-fold',esc(g.key),cl)}<span class="fdi" aria-hidden="true">${g.key==='__none'?'':'📁'}</span><b class="sg-t">${esc(g.name)}</b><span class="chip">${plural(g.items.length,'objeto','objetos')}</span>${g.secs.size>1?`<span class="chip">${g.secs.size} secciones</span>`:''}</div><div class="sgb" ${cl?'hidden':''}>${gridI(g.items,null,false,false)}</div></section>`;
    }).join('');
  }
  if(!P.itemSecs.length) return gridI(L,'|',false,drag);
  return P.itemSecs.map(S=>secBlockI(S,L,filtering,drag)).join('')+secBlockI(null,L,filtering,drag);
}
function itemToolsHTML(){
  const cats=allItemCats(),c=ui.cat.items||'';
  return `<div class="fbar"><input type="search" placeholder="Buscar…" value="${esc(ui.q.items)}" data-bind="q" data-k="items" aria-label="Buscar">${sortBarHTML('items')}
  <select data-bind="f-cat" data-k="items" aria-label="Categoría"><option value="">Todas las categorías</option><option value="__none" ${c==='__none'?'selected':''}>Sin categoría</option>${cats.map(x=>`<option value="${esc(x)}" ${c===x?'selected':''}>${esc(x)}</option>`).join('')}</select>
  <select data-bind="item-fx" aria-label="Efectos"><option value="">Con o sin efectos</option><option value="1" ${ui.itemFx?'selected':''}>Solo con efectos (stats o slots)</option></select>
  <span class="hint" id="count">${itemsFiltered().length} de ${P.items.length}</span></div>
  <div class="fbar"><div class="mini"><label>Vista</label><div class="acts"><select data-bind="item-view" aria-label="Vista">${ITEM_VIEWS.map(x=>`<option value="${x[0]}" ${ui.itemView===x[0]?'selected':''}>${x[1]}</option>`).join('')}</select>${helpBtn('obj-vista')}</div></div>
  ${P.itemSecs.length&&ui.itemView!=='flat'?`<div class="acts"><button type="button" class="btn sm" data-act="isec-fold-all">Plegar todo</button><button type="button" class="btn sm" data-act="isec-unfold-all">Desplegar todo</button></div>`:''}</div>`;
}
function vItems(){
  if(ui.item){const i=curItem();if(i)return withNav('item',vItemForm(i));ui.item=null;}
  const L=KL.items;
  return `<div class="bar"><h2 class="h2">${L.title}</h2><div class="acts"><button type="button" class="btn pri" data-act="item-newin" data-sec="" data-fold="">Nuevo objeto</button><button type="button" class="btn" data-act="isec-new">Nueva sección</button></div></div>
  <p class="hint" style="margin-bottom:12px">${L.hint}</p>
  <div class="addrow"><div class="grow mini"><label for="new-name">Agregar rápido</label><input type="text" id="new-name" placeholder="${L.ph}" data-enter="tag-add" data-kind="items" autocomplete="off"></div>
  <div class="mini"><label for="new-size">Tamaño</label><input type="number" id="new-size" min="0" value="1"></div>
  <div class="mini"><label for="new-cat">Categorías (separadas por coma)</label><input type="text" id="new-cat" list="cats-items" autocomplete="off"></div>
  <div class="mini"><label for="new-icon">Ícono</label><input type="text" id="new-icon" style="width:80px" maxlength="8" autocomplete="off"></div><button type="button" class="btn pri" data-act="tag-add" data-kind="items">Agregar</button></div>
  <datalist id="cats-items">${allItemCats().map(c=>`<option value="${esc(c)}">`).join('')}</datalist>
  ${itemToolsHTML()}<div id="list">${itemsListHTML()}</div>`;
}

/* ---------- Ficha de un objeto ---------- */
function imRow(m,i){
  const o=(v,t)=>`<option value="${v}" ${m.mode===v?'selected':''}>${t}</option>`;
  const stats=P.stats.map(s=>`<option value="${s.id}" ${m.stat===s.id?'selected':''}>${esc(s.name||'Sin nombre')}</option>`).join('')+(P.stats.some(s=>s.id===m.stat)?'':`<option value="${esc(m.stat)}" selected>⚠ ya no existe</option>`);
  return `<div class="wrow"><select data-bind="im-stat" data-i="${i}" aria-label="Stat">${stats}</select><select data-bind="im-mode" data-i="${i}" aria-label="Modo">${o('add','suma')}${o('mult','multiplica por')}</select><input type="number" step="any" value="${m.num}" data-bind="im-num" data-i="${i}" aria-label="Número"><button type="button" class="x" data-act="im-del" data-i="${i}" aria-label="Quitar cambio">✕</button></div>`;
}
function vItemForm(i){
  const u=usage('items',i.id),S=P.itemSecs.find(x=>x.id===i.sec);
  const warn=(i.mods||[]).some(m=>!P.stats.some(s=>s.id===m.stat))?['Hay un cambio de stat sin stat elegida (o con una que ya no existe).']:[];
  return `<div class="bar"><button type="button" class="btn" data-act="item-back">← Objetos</button><button type="button" class="btn dng" data-act="item-del" data-confirm="¿Eliminar? Tocá otra vez">Eliminar objeto</button></div>
  ${warn.length?`<div class="note warn"><b>Para revisar</b><ul>${warn.map(x=>`<li>${esc(x)}</li>`).join('')}</ul></div>`:''}
  <section class="card sec"><h3 class="h3">Ficha</h3>
  <div class="two"><div style="flex:2 1 200px"><label for="i-name">Nombre</label><input type="text" id="i-name" value="${esc(i.name)}" data-bind="tag-name" data-kind="items" data-id="${i.id}" autocomplete="off"></div>
  <div><label for="i-size">Tamaño (slots que ocupa)</label><input type="number" id="i-size" min="0" value="${i.size}" data-bind="tag-size" data-id="${i.id}" style="max-width:120px"></div></div>
  <div class="tfields">${iconFieldsHTML('items',i)}</div></section>
  <section class="card sec"><div class="sh"><h3 class="h3">Dónde está</h3></div>
  <div class="two"><div><label for="i-sec">Sección</label><select id="i-sec" data-bind="item-sec"><option value="">Sin sección</option>${P.itemSecs.map(x=>`<option value="${x.id}" ${i.sec===x.id?'selected':''}>${esc(secNameI(x))}</option>`).join('')}</select></div>
  <div><label for="i-fold">Carpeta</label><select id="i-fold" data-bind="item-folder" ${S&&S.folders.length?'':'disabled'}><option value="">Sin carpeta</option>${S?S.folders.map(f=>`<option value="${f.id}" ${i.fold===f.id?'selected':''}>${esc(f.name.trim()||'Sin nombre')}</option>`).join(''):''}</select></div></div></section>
  <section class="card sec"><div class="sh"><h3 class="h3">Categorías</h3>${helpBtn('obj-cats')}</div>
  <div class="chips">${catList(i).map(c=>`<span class="chip rc">${esc(c)}<button type="button" class="x" data-act="item-cat-del" data-c="${esc(c)}" aria-label="Quitar ${esc(c)}">✕</button></span>`).join('')||'<span class="hint">Sin categorías.</span>'}</div>
  <div class="acts"><input type="text" id="i-cat-new" list="cats-items" placeholder="Nueva categoría (podés poner varias separadas por coma)" data-enter="item-cat-add" autocomplete="off" style="flex:1 1 220px"><button type="button" class="btn sm" data-act="item-cat-add">Agregar</button></div>
  <datalist id="cats-items">${allItemCats().map(c=>`<option value="${esc(c)}">`).join('')}</datalist></section>
  <section class="card sec"><div class="sh"><h3 class="h3">Mientras se lleve en el inventario</h3>${helpBtn('obj-pasivos')}</div>
  <div class="two"><div><label for="i-slots">Espacio del inventario que suma (slots, negativo resta)</label><input type="number" id="i-slots" step="1" value="${i.slots||0}" data-bind="item-slots" style="max-width:140px"></div></div>
  <label>Cambios en las stats</label>
  ${(i.mods||[]).map(imRow).join('')}
  ${P.stats.length?'':'<p class="hint">Todavía no hay stats. Creálas en la pestaña Stats.</p>'}
  <div><button type="button" class="btn sm" data-act="im-add" ${P.stats.length?'':'disabled'}>Agregar cambio de stat</button></div></section>
  <section class="card sec"><h3 class="h3">Dónde se usa</h3><div class="chips"><span class="chip">${plural(u.ch,'personaje lo tiene al empezar','personajes lo tienen al empezar')}</span><span class="chip">${plural(u.ev,'evento','eventos')}</span></div></section>`;
}

/* ---------- Acciones ---------- */
const blankItem=(sec,fold)=>({id:uid(),name:'',size:1,cats:[],icon:'',img:null,slots:0,mods:[],sec:sec||'',fold:fold||''});
const secI=id=>P.itemSecs.find(s=>s.id===id)||null;
const foldI=id=>{for(const s of P.itemSecs){const f=s.folders.find(x=>x.id===id);if(f)return {s,f};}return null;};
const itemsAfter=()=>{refreshList('items');};
function moveIn(arr,id,d){const i=arr.findIndex(x=>x.id===id),j=i+d;if(i<0||j<0||j>=arr.length)return false;arr.splice(j,0,arr.splice(i,1)[0]);return true;}
Object.assign(ACT,{
  'item-newin'(b){
    const i=blankItem(b.dataset.sec,b.dataset.fold);
    P.items.push(i);ui.item=i.id;structural();window.scrollTo(0,0);
    const f=$('#i-name');if(f)f.focus();
  },
  'item-edit'(b){ui.item=b.dataset.id;render();window.scrollTo(0,0);},
  'item-back'(){
    const i=curItem();
    if(i&&!i.name.trim()){i.name='Objeto '+(P.items.indexOf(i)+1);touch();}
    ui.item=null;render();
  },
  'item-del'(){
    const id=ui.item,i=curItem();
    if(i&&i.img)removeImageData(i.img);
    P.items=P.items.filter(x=>x.id!==id);
    P.chars.forEach(c=>{c.items=c.items.filter(x=>x!==id);});
    ui.item=null;structural();toast('Objeto eliminado');
  },
  'isec-new'(){
    const s={id:uid(),name:'Sección '+(P.itemSecs.length+1),closed:false,folders:[]};
    P.itemSecs.push(s);structural();
    const f=document.querySelector(`.sg-name[data-id="${s.id}"]`);if(f){f.focus();f.select();}
  },
  'ifold-new'(b){
    const s=secI(b.dataset.id);if(!s)return;
    const f={id:uid(),name:'Carpeta '+(s.folders.length+1),closed:false};
    s.folders.push(f);structural();
    const el=document.querySelector(`.sg-name[data-id="${f.id}"]`);if(el){el.focus();el.select();}
  },
  'isec-fold'(b){const s=secI(b.dataset.id);if(s)s.closed=!s.closed;else ui.itemClosed.nosec=!ui.itemClosed.nosec;touch();itemsAfter();},
  'ifold-fold'(b){const r=foldI(b.dataset.id);if(r){r.f.closed=!r.f.closed;touch();itemsAfter();}},
  'inof-fold'(b){const k=b.dataset.id+'|';ui.itemClosed[k]=!ui.itemClosed[k];itemsAfter();},
  'imf-fold'(b){const k='m:'+b.dataset.id;ui.itemClosed[k]=!ui.itemClosed[k];itemsAfter();},
  'isec-fold-all'(){P.itemSecs.forEach(s=>{s.closed=true;s.folders.forEach(f=>{f.closed=true;});});ui.itemClosed.nosec=true;touch();itemsAfter();},
  'isec-unfold-all'(){P.itemSecs.forEach(s=>{s.closed=false;s.folders.forEach(f=>{f.closed=false;});});ui.itemClosed={};touch();itemsAfter();},
  'isec-up'(b){if(moveIn(P.itemSecs,b.dataset.id,-1))structural();},
  'isec-down'(b){if(moveIn(P.itemSecs,b.dataset.id,1))structural();},
  'ifold-up'(b){const r=foldI(b.dataset.id);if(r&&moveIn(r.s.folders,b.dataset.id,-1))structural();},
  'ifold-down'(b){const r=foldI(b.dataset.id);if(r&&moveIn(r.s.folders,b.dataset.id,1))structural();},
  'isec-del'(b){
    const id=b.dataset.id;
    P.items.forEach(i=>{if(i.sec===id){i.sec='';i.fold='';}});
    P.itemSecs=P.itemSecs.filter(s=>s.id!==id);
    structural();toast('Sección eliminada: sus objetos quedaron sin sección');
  },
  'ifold-del'(b){
    const id=b.dataset.id;
    P.items.forEach(i=>{if(i.fold===id)i.fold='';});
    P.itemSecs.forEach(s=>{s.folders=s.folders.filter(f=>f.id!==id);});
    structural();toast('Carpeta eliminada: sus objetos quedaron sin carpeta');
  },
  'item-cat-add'(){
    const i=curItem(),f=$('#i-cat-new');if(!i||!f)return;
    const add=f.value.split(',').map(x=>x.trim()).filter(Boolean);
    if(!add.length)return;
    i.cats=[...new Set(catList(i).concat(add))];structural();
    const n=$('#i-cat-new');if(n)n.focus();
  },
  'item-cat-del'(b){const i=curItem();if(i){i.cats=catList(i).filter(c=>c!==b.dataset.c);structural();}},
  'im-add'(){const i=curItem();if(i&&P.stats.length){i.mods.push({stat:P.stats[0].id,mode:'add',num:1});structural();}},
  'im-del'(b){const i=curItem();if(i){i.mods.splice(+b.dataset.i,1);structural();}}
});
Object.assign(BIND,{
  'item-view'(t){ui.itemView=t.value;try{localStorage.setItem('br.itemView',ui.itemView);}catch(e){}render();},
  'item-fx'(t){ui.itemFx=t.value;refreshList('items');},
  'isec-name'(t){const s=secI(t.dataset.id);if(s){s.name=t.value;touch();}},
  'ifold-name'(t){const r=foldI(t.dataset.id);if(r){r.f.name=t.value;touch();}},
  'item-sec'(t){const i=curItem();if(i){i.sec=t.value;i.fold='';structural();}},
  'item-folder'(t){const i=curItem();if(i){i.fold=t.value;touch();}},
  'item-slots'(t){const i=curItem(),v=parseInt(t.value,10);if(i){i.slots=isNaN(v)?0:v;touch();}},
  'im-stat'(t){const i=curItem(),m=i&&i.mods[+t.dataset.i];if(m){m.stat=t.value;structural();}},
  'im-mode'(t){const i=curItem(),m=i&&i.mods[+t.dataset.i];if(m){m.mode=t.value==='mult'?'mult':'add';m.num=m.mode==='mult'?1:1;structural();}},
  'im-num'(t){const i=curItem(),m=i&&i.mods[+t.dataset.i],v=parseFloat(t.value);if(m&&isFinite(v)){m.num=v;touch();}}
});

/* ---------- Arrastrar objetos entre secciones y carpetas ---------- */
function moveItemTo(id,sec,fold,ref,before){
  const k=P.items.findIndex(i=>i.id===id);if(k<0)return false;
  const it=P.items.splice(k,1)[0];it.sec=sec;it.fold=fold;
  let j=-1;
  if(ref){j=P.items.findIndex(x=>x.id===ref);if(j>=0&&!before)j++;}
  if(j<0){let last=-1;P.items.forEach((x,n)=>{if(x.sec===sec&&x.fold===fold)last=n;});j=last>=0?last+1:P.items.length;}
  P.items.splice(j,0,it);
  return true;
}
let idg=null;
const visibleZ=z=>!z.hidden&&z.getClientRects().length>0;
function itemSpot(x,y){
  const el=document.elementFromPoint(x,y);if(!el)return null;
  let z=el.closest('[data-iz]');
  if(!z){
    const fd=el.closest('.fd'),sg=el.closest('.sg');
    if(fd)z=fd.querySelector('[data-iz]');
    else if(sg&&sg.dataset.isec!==undefined)z=sg.querySelector(`[data-iz="${sg.dataset.isec}|"]`)||sg.querySelector('[data-iz]');
  }
  if(!z)return null;
  const parts=z.dataset.iz.split('|'),sec=parts[0],fold=parts[1]||'';
  if(!visibleZ(z)){
    const box=z.closest('.fd')||z.closest('.sg'),hl=box&&box.querySelector('.fd-h,.sg-h');
    return hl?{sec,fold,ref:null,hl}:null;
  }
  const cards=[...z.querySelectorAll('.cwrap')].filter(c=>c.dataset.iid!==idg.id);
  if(!cards.length||ui.sort.items||ui.letter.items) return {sec,fold,ref:null,hl:z};
  let best=null,bd=1e9;
  cards.forEach(c=>{
    const r=c.getBoundingClientRect(),dx=Math.max(r.left-x,0,x-r.right),dy=Math.max(r.top-y,0,y-r.bottom),d=Math.hypot(dx,dy);
    if(d<bd){bd=d;best={c,r};}
  });
  const r=best.r,before=y<r.top?true:y>r.bottom?false:x<r.left+r.width/2;
  return {sec,fold,ref:best.c.dataset.iid,before,line:{left:before?r.left-5:r.right+2,top:r.top,height:r.height}};
}
function idgMark(){
  if(!idg||!idg.active)return;
  document.querySelectorAll('.dz-on,.sg-hl').forEach(z=>z.classList.remove('dz-on','sg-hl'));
  const s=itemSpot(idg.x,idg.y);idg.spot=s;
  if(!s){idg.line.hidden=true;return;}
  if(s.hl){s.hl.classList.add(s.hl.classList.contains('sg-h')||s.hl.classList.contains('fd-h')?'sg-hl':'dz-on');idg.line.hidden=true;return;}
  idg.line.hidden=false;
  const l=s.line,st=idg.line.style;
  st.left=l.left+'px';st.top=l.top+'px';st.width='4px';st.height=l.height+'px';st.marginTop='0';
}
function idgEnd(){
  if(!idg)return;
  clearInterval(idg.scroll);
  if(idg.ghost)idg.ghost.remove();
  if(idg.line)idg.line.remove();
  document.querySelectorAll('.dz-on,.sg-hl').forEach(z=>z.classList.remove('dz-on','sg-hl'));
  document.querySelectorAll('.cdragging').forEach(z=>z.classList.remove('cdragging'));
  document.body.classList.remove('dragging-now');
  idg=null;
}
document.addEventListener('pointerdown',ev=>{
  const h=ev.target.closest&&ev.target.closest('[data-idrag]');
  if(!h||ev.button>0)return;
  ev.preventDefault();
  try{h.setPointerCapture(ev.pointerId);}catch(e){}
  idg={id:h.dataset.id,sx:ev.clientX,sy:ev.clientY,x:ev.clientX,y:ev.clientY,active:false,pid:ev.pointerId,spot:null,h};
});
document.addEventListener('pointermove',ev=>{
  if(!idg||ev.pointerId!==idg.pid)return;
  idg.x=ev.clientX;idg.y=ev.clientY;
  if(!idg.active){
    if(Math.hypot(idg.x-idg.sx,idg.y-idg.sy)<6)return;
    idg.active=true;
    const it=P.items.find(x=>x.id===idg.id);
    const g=document.createElement('div');g.className='ghost';g.textContent=it?(it.name||'Objeto'):'…';
    document.body.appendChild(g);idg.ghost=g;
    const l=document.createElement('div');l.className='drop-line';l.hidden=true;document.body.appendChild(l);idg.line=l;
    const box=idg.h.closest('.cwrap');if(box)box.classList.add('cdragging');
    document.body.classList.add('dragging-now');
    idg.scroll=setInterval(()=>{
      if(!idg)return;
      const m=70;
      if(idg.y<m)window.scrollBy(0,-Math.ceil((m-idg.y)/4));
      else if(idg.y>innerHeight-m)window.scrollBy(0,Math.ceil((idg.y-(innerHeight-m))/4));
      idgMark();
    },40);
  }
  idg.ghost.style.left=(idg.x+12)+'px';idg.ghost.style.top=(idg.y+12)+'px';
  idgMark();
});
function idgFinish(ev,cancel){
  if(!idg||(ev&&ev.pointerId!==idg.pid))return;
  const d=idg,s=d.spot;
  idgEnd();
  if(cancel||!d.active||!s)return;
  if(moveItemTo(d.id,s.sec,s.fold,s.ref,s.before))structural();
}
document.addEventListener('pointerup',ev=>idgFinish(ev,false));
document.addEventListener('pointercancel',ev=>idgFinish(ev,true));
document.addEventListener('keydown',ev=>{if(ev.key==='Escape'&&idg)idgFinish(null,true);});
