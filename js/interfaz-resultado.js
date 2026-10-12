'use strict';
/* =====================================================================
   INTERFAZ DEL RESULTADO DE UN EVENTO.
   Cuando un evento ocurre, puede terminar de varias maneras («desenlaces»):
     - «Sale bien»: usa el texto y los efectos principales del evento;
     - desenlaces extra: cada uno con su nombre, probabilidad, texto y efectos;
     - «No sale bien»: lo que no se reparta entre los demás.
   La probabilidad de cada uno puede ser fija, depender de una stat, de los
   equipos o de la lealtad, o calcularse con bloques: se parte de un porcentaje
   base y cada paso, si se cumple su condición, lo suma, lo multiplica o lo fija.
   ===================================================================== */

const CH_HINT={
  always:'El evento ocurre siempre como está escrito.',
  fixed:'Es el mismo porcentaje siempre.',
  stat:'Gana más probabilidad quien tenga más de esa stat: 6 contra 2 da 75%. Lo que un personaje no tiene vale 0. Se compara con otro participante o con un valor fijo que elegís vos (útil si el evento tiene un solo participante).',
  team:'Cuanto más grande sea su equipo frente al otro, más probabilidad. Quien no tiene equipo cuenta como uno solo (3 contra 1 da 75%). El otro puede ser un participante o un tamaño fijo.',
  loyalty:'Con lealtad 20, X tiene 80% de probabilidad; con lealtad 90, solo 10%. Sirve para las traiciones.',
  calc:'Se parte del porcentaje base. Los pasos se evalúan de arriba hacia abajo: si se cumple su condición, suman o restan puntos, multiplican o fijan el porcentaje. El resultado queda siempre entre 0% y 100%.'
};
const STEP_OP_LBL={add:'suma',mult:'multiplica por',set:'fija en (%)'};
const STEP_KIND_LBL={
  num:'puntos fijos',
  stat:'puntos por cada punto de una stat de',
  statdiff:'puntos por cada punto de ventaja en una stat de',
  loyalty:'puntos por cada punto de lealtad de',
  teamsize:'puntos por cada integrante del equipo de',
  teamdiff:'puntos por cada integrante de ventaja del equipo de'
};
const chanceOwner=(e,oid)=>oid?((e.outs||[]).find(o=>o.id===oid)||{}).chance:e.chance;

function stepHTML(e,c,st,k,oid,blocks){
  const sa=`data-sid="${st.id}" data-o="${oid}"`;
  const opt=(v,cur,txt)=>`<option value="${v}" ${String(cur)===String(v)?'selected':''}>${esc(txt)}</option>`;
  const sel=(bind,label,body)=>`<select data-bind="${bind}" ${sa} aria-label="${label}">${body}</select>`;
  const W=t=>`<span class="w">${t}</span>`;
  const cond=blocks?blkNode(e,st.cond,st.id+':',0):condHTML(e,st.cond,st.id+':',0);
  let v=sel('st-op','Qué hace',Object.keys(STEP_OP_LBL).map(o=>opt(o,st.op,STEP_OP_LBL[o])).join(''));
  if(st.op==='add') v+=`<input type="number" step="any" value="${st.num}" data-bind="st-num" ${sa} aria-label="Número">`+sel('st-kind','De dónde sale el valor',STEP_KINDS.map(o=>opt(o,st.kind,STEP_KIND_LBL[o])).join(''));
  else v+=`<input type="number" step="any" value="${st.num}" data-bind="st-num" ${sa} aria-label="Número">`;
  if(st.op==='add'&&['stat','statdiff'].includes(st.kind)) v+=sel('st-stat','Stat',`<option value="" ${!st.stat?'selected':''}>Elegir stat…</option>`+P.stats.map(s=>opt(s.id,st.stat,s.name||'Sin nombre')).join(''));
  if(st.op==='add'&&st.kind!=='num') v+=sel('st-role','Participante',roleOpts(e,st.role));
  if(st.op==='add'&&['statdiff','teamdiff'].includes(st.kind)){
    v+=W('sobre')+sel('st-vs','Contra quién se compara',opt('role',st.vs,'otro participante')+opt('fixed',st.vs,'un valor fijo'));
    v+=st.vs==='fixed'?`<input type="number" step="any" min="0" value="${st.val}" data-bind="st-val" ${sa} aria-label="Valor fijo">`:sel('st-role2','Participante con el que se compara',roleOpts(e,st.role2));
  }
  const n=(c.steps||[]).length;
  const acts=`<button type="button" class="x" data-act="st-up" ${sa} aria-label="Subir paso" ${k===0?'disabled':''}>▲</button><button type="button" class="x" data-act="st-down" ${sa} aria-label="Bajar paso" ${k===n-1?'disabled':''}>▼</button><button type="button" class="x" data-act="st-del" ${sa} aria-label="Quitar paso">✕</button>`;
  return `<div class="step"><div class="step-h"><b>Paso ${k+1}</b><span class="hint">si se cumple…</span><span class="acts">${acts}</span></div>${cond}<div class="fx"><span class="w">entonces</span>${v}</div></div>`;
}
function probHTML(e,c,oid,blocks){
  const oa=`data-o="${oid}"`,m=c.mode;
  const modes=oid?CHANCE_MODES.filter(x=>x!=='always'):CHANCE_MODES;
  let h=`<div class="two"><div><label>Probabilidad ${helpBtn('ch-'+m)}</label><select ${oid?'':'id="ch-mode" '}data-bind="ch-mode" ${oa} aria-label="Cómo se calcula la probabilidad">${modes.map(k=>`<option value="${k}" ${m===k?'selected':''}>${CHANCE_LBL[k]}</option>`).join('')}</select></div>`;
  if(m==='fixed') h+=`<div><label>Probabilidad (%)</label><input type="number" ${oid?'':'id="ch-pct" '}min="0" max="100" value="${c.pct}" data-bind="ch-pct" ${oa} aria-label="Porcentaje"></div>`;
  if(m==='calc') h+=`<div><label>Porcentaje base</label><input type="number" min="0" max="100" value="${c.pct}" data-bind="ch-pct" ${oa} aria-label="Porcentaje base"></div>`;
  if(m==='stat') h+=`<div><label>Stat</label><select ${oid?'':'id="ch-stat" '}data-bind="ch-stat" ${oa} aria-label="Stat"><option value="">Elegir…</option>${P.stats.map(s=>`<option value="${s.id}" ${c.stat===s.id?'selected':''}>${esc(s.name||'Sin nombre')}</option>`).join('')}${c.stat&&!P.stats.some(s=>s.id===c.stat)?`<option value="${esc(c.stat)}" selected>⚠ ya no existe</option>`:''}</select></div>`;
  if(m==='stat'||m==='team'||m==='loyalty'){
    const pa=(bind,label,cur)=>`<select data-bind="${bind}" ${oa} aria-label="${label}">${roleOpts(e,cur)}</select>`;
    h+=`<div><label>De quién</label>${pa('ch-a','Participante evaluado',c.a||'X')}</div>`;
    if(m!=='loyalty'){
      h+=`<div><label>Contra</label><select data-bind="ch-vs" ${oa} aria-label="Contra quién se compara"><option value="role" ${c.vs==='fixed'?'':'selected'}>otro participante</option><option value="fixed" ${c.vs==='fixed'?'selected':''}>un valor fijo</option></select></div>`;
      h+=c.vs==='fixed'
        ?`<div><label>${m==='stat'?'Valor de la stat':'Integrantes del equipo'}</label><input type="number" step="any" min="0" value="${c.val==null?5:c.val}" data-bind="ch-val" ${oa} aria-label="Valor fijo"></div>`
        :`<div><label>Otro participante</label>${pa('ch-b','Participante contra el que se compara',c.b||(e.roles[1]?e.roles[1].n:'Y'))}</div>`;
    }
  }
  h+=`</div>`;
  if(m==='calc'){
    h+=`<div class="steps">${(c.steps||[]).map((st,k)=>stepHTML(e,c,st,k,oid,blocks)).join('')||'<p class="hint">Todavía no hay pasos: la probabilidad es el porcentaje base. Agregá uno para que cambie según lo que pase.</p>'}</div>
    <div><button type="button" class="btn sm" data-act="st-add" ${oa}>Agregar paso</button></div>`;
  }
  return h;
}
/* Resumen de porcentajes (solo si no dependen de quién participe). */
function outcomeSummary(e){
  const cs=allChances(e);
  if(cs.some(c=>!['always','fixed'].includes(c.mode))) return 'Los porcentajes cambian según quiénes participen: el registro de la simulación muestra el que le tocó a cada evento.';
  const ps=cs.map(c=>c.mode==='always'?1:c.pct/100);
  const tot=ps.reduce((a,b)=>a+b,0),rest=Math.max(0,1-tot),sum=Math.max(1,tot);
  const items=[['Sale bien',ps[0]]].concat((e.outs||[]).map((o,i)=>[o.name.trim()||('Desenlace '+(i+3)),ps[i+1]])).concat([['No sale bien',rest]]);
  return items.map(it=>`${it[0]} ${Math.round(it[1]/sum*100)}%`).join(' · ')+(tot>1?'. Como suman más de 100%, se reparten en proporción.':'');
}
/* Etiqueta corta de una probabilidad, para el encabezado de cada desenlace. */
const chLbl=c=>c.mode==='always'?'siempre':c.mode==='fixed'?c.pct+'%':'variable';
ui.outShut=ui.outShut||{};
const fxCount=n=>n?plural(n,'efecto','efectos'):'sin efectos';
/* Barra con el reparto de probabilidades (solo si no dependen de quiénes participen). */
function distBarHTML(e){
  const cs=allChances(e);
  if(cs.some(c=>!['always','fixed'].includes(c.mode))) return '<p class="hint dist-n">Los porcentajes cambian según quiénes participen: el registro de la simulación muestra el que le tocó a cada evento.</p>';
  const ps=cs.map(c=>c.mode==='always'?1:c.pct/100);
  const tot=ps.reduce((a,b)=>a+b,0),rest=Math.max(0,1-tot),sum=Math.max(1,tot);
  const items=[['Sale bien',ps[0],'main']].concat((e.outs||[]).map((o,i)=>[o.name.trim()||('Desenlace '+(i+2)),ps[i+1],'x'+(i%4)])).concat([['No sale bien',rest,'fail']]).filter(x=>x[1]>0);
  return `<div class="dist" role="img" aria-label="Reparto: ${esc(items.map(x=>x[0]+' '+Math.round(x[1]/sum*100)+'%').join(', '))}">${items.map(x=>`<span class="seg-${x[2]}" style="flex:${x[1]/sum}" title="${esc(x[0])}">${Math.round(x[1]/sum*100)>=12?esc(x[0])+' '+Math.round(x[1]/sum*100)+'%':''}</span>`).join('')}</div>
  <ul class="dist-l">${items.map(x=>`<li><i class="sw seg-${x[2]}"></i>${esc(x[0])} <b>${Math.round(x[1]/sum*100)}%</b></li>`).join('')}</ul>${tot>1?'<p class="hint dist-n">Como suman más de 100%, se reparten en proporción.</p>':''}`;
}
/* Una «tarjeta» de desenlace: encabezado que se pliega + probabilidad + texto + efectos. */
function outcomeBox(e,o){
  const blocks=ui.evView==='blocks';
  const kind=o==='main'?'main':o==='fail'?'fail':'x',id=kind==='x'?o.id:kind;
  const shut=!!ui.outShut[id];
  const c=kind==='main'?e.chance:kind==='x'?o.chance:null;
  const L=kind==='main'?'fx':kind==='fail'?'fxFail':'out:'+o.id;
  const list=fxList(e,L),oa=kind==='x'?`data-o="${o.id}"`:'';
  const outs=e.outs||[],k=kind==='x'?outs.indexOf(o):-1;
  const title=kind==='main'?'<b class="ot">✔ Sale bien</b>':kind==='fail'?'<b class="ot">✘ No sale bien</b>':`<input type="text" value="${esc(o.name)}" placeholder="Nombre del desenlace (ej: Éxito crítico)" data-bind="out-name" ${oa} aria-label="Nombre del desenlace" autocomplete="off">`;
  const acts=kind==='x'?`<span class="acts"><button type="button" class="x" data-act="out-up" ${oa} aria-label="Subir" ${k===0?'disabled':''}>▲</button><button type="button" class="x" data-act="out-down" ${oa} aria-label="Bajar" ${k===outs.length-1?'disabled':''}>▼</button><button type="button" class="x" data-act="out-del" ${oa} aria-label="Quitar desenlace">✕</button></span>`:'';
  const badge=kind==='fail'?'<span class="chip">el resto</span>':`<span class="chip">${chLbl(c)}</span>`;
  const fold=`<button type="button" class="x fold" data-act="out-fold" data-id="${id}" aria-expanded="${!shut}" aria-label="${shut?'Mostrar':'Ocultar'} detalles">${shut?'▸':'▾'}</button>`;
  let h=`<div class="outc ${kind==='main'?'main':kind==='fail'?'fail':''}"><div class="outc-h">${fold}${title}${badge}<span class="hint">${fxCount(list.length)}</span>${acts}</div>`;
  if(!shut){
    h+=`<div class="outc-b">`;
    if(c) h+=probHTML(e,c,kind==='x'?o.id:'',blocks);
    if(kind==='main') h+=`<p class="hint">Usa el texto del evento (arriba).</p>`;
    else{
      const tid=kind==='fail'?'ev-fail':'out-text-'+o.id,txt=kind==='fail'?e.failText:o.text;
      h+=`<div><label for="${tid}">Texto${kind==='fail'?' si no sale bien':' de este desenlace'}</label><textarea id="${tid}" rows="2" data-bind="${kind==='fail'?'ev-fail':'out-text'}" ${oa} aria-label="Texto del desenlace">${esc(txt)}</textarea></div>
      ${tokenButtonsHTML(e,tid)}<p class="prev" id="${tid}-prev">${previewHTML(e,txt)}</p>`;
    }
    h+=`<div class="sh sub"><b>Efectos</b>${helpBtn('fx')}</div>
    ${blocks?fxZoneHTML(e,L):`${list.length?list.map((f,i)=>fxHTML(e,f,i,L)).join(''):'<p class="hint">Sin efectos.</p>'}<div><button type="button" class="btn sm" data-act="fx-add" data-list="${L}">Agregar efecto</button></div>`}</div>`;
  }
  return h+'</div>';
}
function resultSection(e,blocks){
  const outs=e.outs||[],c=e.chance;
  const simple=c.mode==='always'&&!outs.length;
  const showFail=!simple;
  let h=`<section class="card sec"><div class="sh"><h3 class="h3">Cómo termina</h3>${helpBtn('desenlaces')}</div>`;
  if(!simple) h+=distBarHTML(e);
  h+=outcomeBox(e,'main');
  h+=outs.map(o=>outcomeBox(e,o)).join('');
  h+=`<div class="acts"><button type="button" class="btn sm" data-act="out-add">＋ Agregar otro desenlace</button></div>`;
  if(showFail) h+=outcomeBox(e,'fail');
  return h+'</section>';
}

/* ---------- Acciones ---------- */
const stepOwner=t=>{const e=curEv();return e?{e,c:chanceOwner(e,t.dataset.o||'')}:{e:null,c:null};};
Object.assign(ACT,{
  'st-add'(b){
    const {c}=stepOwner(b);if(!c)return;
    c.steps=c.steps||[];
    c.steps.push({id:uid(),cond:emptyCond(),op:'add',kind:'num',num:10,stat:'',role:'X',role2:'Y',vs:'role',val:5});
    structural();
  },
  'st-del'(b){const {c}=stepOwner(b);if(!c)return;c.steps=c.steps.filter(x=>x.id!==b.dataset.sid);structural();},
  'st-up'(b){stepMove(b,-1);},
  'st-down'(b){stepMove(b,1);},
  'out-add'(){
    const e=curEv();if(!e)return;
    e.outs=e.outs||[];
    e.outs.push({id:uid(),name:'',text:'',fx:[],chance:{mode:'fixed',pct:10,stat:'',steps:[]}});
    if(e.chance.mode==='always') e.chance.mode='fixed';   // con «siempre» no quedaría lugar para los demás desenlaces
    structural();
  },
  'out-del'(b){const e=curEv();if(!e)return;e.outs=e.outs.filter(o=>o.id!==b.dataset.o);structural();},
  'out-fold'(b){ui.outShut[b.dataset.id]=!ui.outShut[b.dataset.id];render();},
  'out-up'(b){outMove(b,-1);},
  'out-down'(b){outMove(b,1);}
});
function stepMove(b,d){
  const {c}=stepOwner(b);if(!c)return;
  const i=c.steps.findIndex(x=>x.id===b.dataset.sid),j=i+d;
  if(i<0||j<0||j>=c.steps.length)return;
  c.steps.splice(j,0,c.steps.splice(i,1)[0]);structural();
}
function outMove(b,d){
  const e=curEv();if(!e)return;
  const i=e.outs.findIndex(x=>x.id===b.dataset.o),j=i+d;
  if(i<0||j<0||j>=e.outs.length)return;
  e.outs.splice(j,0,e.outs.splice(i,1)[0]);structural();
}
const curStep=t=>{const e=curEv();return e?stepById(e,t.dataset.sid):null;};
Object.assign(BIND,{
  'ch-mode'(t){const {e,c}=stepOwner(t);if(c){c.mode=CHANCE_MODES.includes(t.value)?t.value:'always';if((c.mode==='stat'||c.mode==='team')&&e.roles.length<2)c.vs='fixed';structural();}},
  'ch-pct'(t){const {c}=stepOwner(t),v=parseFloat(t.value);if(c&&isFinite(v)){c.pct=Math.min(100,Math.max(0,v));touch();}},
  'ch-stat'(t){const {c}=stepOwner(t);if(c){c.stat=t.value;structural();}},
  'ch-a'(t){const {c}=stepOwner(t);if(c){c.a=t.value;structural();}},
  'ch-b'(t){const {c}=stepOwner(t);if(c){c.b=t.value;structural();}},
  'ch-vs'(t){const {c}=stepOwner(t);if(c){c.vs=t.value==='fixed'?'fixed':'role';structural();}},
  'ch-val'(t){const {c}=stepOwner(t),v=parseFloat(t.value);if(c&&isFinite(v)){c.val=Math.max(0,v);touch();}},
  'st-vs'(t){const st=curStep(t);if(st){st.vs=t.value==='fixed'?'fixed':'role';structural();}},
  'st-val'(t){const st=curStep(t),v=parseFloat(t.value);if(st&&isFinite(v)){st.val=Math.max(0,v);touch();}},
  'out-name'(t){const e=curEv(),o=e&&(e.outs||[]).find(x=>x.id===t.dataset.o);if(o){o.name=t.value;touch();}},
  'out-text'(t){const e=curEv(),o=e&&(e.outs||[]).find(x=>x.id===t.dataset.o);if(o){setEvText(e,'out-text-'+o.id,t.value);touch();}},
  'st-op'(t){const st=curStep(t);if(st){st.op=STEP_OPS.includes(t.value)?t.value:'add';if(st.op!=='add')st.kind='num';if(st.op==='mult'&&st.num===10)st.num=1;structural();}},
  'st-kind'(t){const st=curStep(t);if(st){st.kind=STEP_KINDS.includes(t.value)?t.value:'num';structural();}},
  'st-num'(t){const st=curStep(t),v=parseFloat(t.value);if(st&&isFinite(v)){st.num=v;touch();}},
  'st-stat'(t){const st=curStep(t);if(st){st.stat=t.value;touch();}},
  'st-role'(t){const st=curStep(t);if(st){st.role=t.value;touch();}},
  'st-role2'(t){const st=curStep(t);if(st){st.role2=t.value;touch();}}
});
