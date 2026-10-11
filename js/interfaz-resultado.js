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
  stat:'Gana más probabilidad quien tenga más de esa stat: X con 6 e Y con 2 da 75%. Lo que un personaje no tiene vale 0.',
  team:'Cuanto más grande sea el equipo de X frente al de Y, más probabilidad. Quien no tiene equipo cuenta como uno solo (3 contra 1 da 75%).',
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
  if(st.op==='add'&&['statdiff','teamdiff'].includes(st.kind)) v+=W('sobre')+sel('st-role2','Participante con el que se compara',roleOpts(e,st.role2));
  const n=(c.steps||[]).length;
  const acts=`<button type="button" class="x" data-act="st-up" ${sa} aria-label="Subir paso" ${k===0?'disabled':''}>▲</button><button type="button" class="x" data-act="st-down" ${sa} aria-label="Bajar paso" ${k===n-1?'disabled':''}>▼</button><button type="button" class="x" data-act="st-del" ${sa} aria-label="Quitar paso">✕</button>`;
  return `<div class="step"><div class="step-h"><b>Paso ${k+1}</b><span class="hint">si se cumple…</span><span class="acts">${acts}</span></div>${cond}<div class="fx"><span class="w">entonces</span>${v}</div></div>`;
}
function probHTML(e,c,oid,blocks){
  const oa=`data-o="${oid}"`,m=c.mode;
  const modes=oid?CHANCE_MODES.filter(x=>x!=='always'):CHANCE_MODES;
  let h=`<div class="two"><div><label>Probabilidad</label><select ${oid?'':'id="ch-mode" '}data-bind="ch-mode" ${oa} aria-label="Cómo se calcula la probabilidad">${modes.map(k=>`<option value="${k}" ${m===k?'selected':''}>${CHANCE_LBL[k]}</option>`).join('')}</select></div>`;
  if(m==='fixed') h+=`<div><label>Probabilidad (%)</label><input type="number" ${oid?'':'id="ch-pct" '}min="0" max="100" value="${c.pct}" data-bind="ch-pct" ${oa} aria-label="Porcentaje"></div>`;
  if(m==='calc') h+=`<div><label>Porcentaje base</label><input type="number" min="0" max="100" value="${c.pct}" data-bind="ch-pct" ${oa} aria-label="Porcentaje base"></div>`;
  if(m==='stat') h+=`<div><label>Stat</label><select ${oid?'':'id="ch-stat" '}data-bind="ch-stat" ${oa} aria-label="Stat"><option value="">Elegir…</option>${P.stats.map(s=>`<option value="${s.id}" ${c.stat===s.id?'selected':''}>${esc(s.name||'Sin nombre')}</option>`).join('')}${c.stat&&!P.stats.some(s=>s.id===c.stat)?`<option value="${esc(c.stat)}" selected>⚠ ya no existe</option>`:''}</select></div>`;
  h+=`</div><p class="hint">${CH_HINT[m]}</p>`;
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
function outcomeCard(e,o,k,blocks){
  const n=(e.outs||[]).length,oa=`data-o="${o.id}"`,L='out:'+o.id;
  const acts=`<button type="button" class="x" data-act="out-up" ${oa} aria-label="Subir" ${k===0?'disabled':''}>▲</button><button type="button" class="x" data-act="out-down" ${oa} aria-label="Bajar" ${k===n-1?'disabled':''}>▼</button><button type="button" class="x" data-act="out-del" ${oa} aria-label="Quitar desenlace">✕</button>`;
  return `<div class="outc"><div class="outc-h"><input type="text" value="${esc(o.name)}" placeholder="Nombre del desenlace (ej: Éxito crítico)" data-bind="out-name" ${oa} aria-label="Nombre del desenlace" autocomplete="off"><span class="acts">${acts}</span></div>
  ${probHTML(e,o.chance,o.id,blocks)}
  <div><label for="out-text-${o.id}">Texto de este desenlace</label><textarea id="out-text-${o.id}" rows="2" data-bind="out-text" ${oa} aria-label="Texto del desenlace">${esc(o.text)}</textarea></div>
  ${tokenButtonsHTML(e,'out-text-'+o.id)}<p class="prev" id="out-text-${o.id}-prev">${previewHTML(e,o.text)}</p>
  <p class="hint">Efectos de este desenlace</p>
  ${blocks?fxZoneHTML(e,L):`${o.fx.length?o.fx.map((f,i)=>fxHTML(e,f,i,L)).join(''):'<p class="hint">Sin efectos: solo se cuenta lo que pasó.</p>'}<div><button type="button" class="btn sm" data-act="fx-add" data-list="${L}">Agregar efecto</button></div>`}</div>`;
}
function resultSection(e,blocks){
  const outs=e.outs||[],c=e.chance;
  const showFail=c.mode!=='always'||outs.length>0;
  let h=`<section class="card sec"><h3 class="h3">Resultado</h3><p class="hint">Un evento puede terminar de distintas maneras. «Sale bien» usa el texto y los efectos de arriba. Podés agregar más desenlaces, cada uno con su probabilidad, su texto y sus efectos. Lo que no se reparta entre ellos va a «No sale bien». El registro muestra qué le tocó a cada evento.</p>
  <div class="outc main"><div class="outc-h"><b>Sale bien</b></div>${probHTML(e,c,'',blocks)}</div>`;
  h+=outs.map((o,k)=>outcomeCard(e,o,k,blocks)).join('');
  h+=`<div><button type="button" class="btn sm" data-act="out-add">Agregar otro desenlace</button></div>`;
  if(showFail) h+=`<div class="outc fail"><div class="outc-h"><b>No sale bien</b><span class="hint">el resto</span></div>
    <div><label for="ev-fail">Texto si no sale bien</label><textarea id="ev-fail" rows="2" data-bind="ev-fail">${esc(e.failText)}</textarea></div>
    ${tokenButtonsHTML(e,'ev-fail')}<p class="prev" id="ev-fail-prev">${previewHTML(e,e.failText)}</p>
    <p class="hint">Efectos si no sale bien</p>
    ${blocks?fxZoneHTML(e,'fxFail'):`${e.fxFail.length?e.fxFail.map((f,i)=>fxHTML(e,f,i,'fxFail')).join(''):'<p class="hint">Sin efectos: solo se cuenta lo que pasó.</p>'}
    <div><button type="button" class="btn sm" data-act="fx-add" data-list="fxFail">Agregar efecto</button></div>`}</div>
  <p class="hint"><b>Reparto:</b> ${esc(outcomeSummary(e))}</p>`;
  return h+'</section>';
}

/* ---------- Acciones ---------- */
const stepOwner=t=>{const e=curEv();return e?{e,c:chanceOwner(e,t.dataset.o||'')}:{e:null,c:null};};
Object.assign(ACT,{
  'st-add'(b){
    const {c}=stepOwner(b);if(!c)return;
    c.steps=c.steps||[];
    c.steps.push({id:uid(),cond:emptyCond(),op:'add',kind:'num',num:10,stat:'',role:'X',role2:'Y'});
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
  'ch-mode'(t){const {c}=stepOwner(t);if(c){c.mode=CHANCE_MODES.includes(t.value)?t.value:'always';structural();}},
  'ch-pct'(t){const {c}=stepOwner(t),v=parseFloat(t.value);if(c&&isFinite(v)){c.pct=Math.min(100,Math.max(0,v));touch();}},
  'ch-stat'(t){const {c}=stepOwner(t);if(c){c.stat=t.value;structural();}},
  'out-name'(t){const e=curEv(),o=e&&(e.outs||[]).find(x=>x.id===t.dataset.o);if(o){o.name=t.value;touch();}},
  'out-text'(t){const e=curEv(),o=e&&(e.outs||[]).find(x=>x.id===t.dataset.o);if(o){setEvText(e,'out-text-'+o.id,t.value);touch();}},
  'st-op'(t){const st=curStep(t);if(st){st.op=STEP_OPS.includes(t.value)?t.value:'add';if(st.op!=='add')st.kind='num';if(st.op==='mult'&&st.num===10)st.num=1;structural();}},
  'st-kind'(t){const st=curStep(t);if(st){st.kind=STEP_KINDS.includes(t.value)?t.value:'num';structural();}},
  'st-num'(t){const st=curStep(t),v=parseFloat(t.value);if(st&&isFinite(v)){st.num=v;touch();}},
  'st-stat'(t){const st=curStep(t);if(st){st.stat=t.value;touch();}},
  'st-role'(t){const st=curStep(t);if(st){st.role=t.value;touch();}},
  'st-role2'(t){const st=curStep(t);if(st){st.role2=t.value;touch();}}
});
