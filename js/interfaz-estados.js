'use strict';
/* =====================================================================
   INTERFAZ DE ESTADOS ALTERADOS: la pestaña Estados (lista y ficha).
   Un estado alterado es algo que le pasa a un personaje y dura un tiempo
   (quemadura, veneno, aturdimiento…). Puede:
     - cambiar sus stats mientras dura (sumar o multiplicar),
     - impedirle actuar por su cuenta,
     - hacerle algo cada día (perder una stat, lealtad, o morir) con una probabilidad.
   Los eventos lo aplican y lo quitan con efectos, y lo piden con reglas.
   ===================================================================== */

const curState=()=>P.states.find(s=>s.id===ui.state);
function statesFiltered(){
  const q=norm(ui.q.states);
  return P.states.filter(s=>!q||norm(s.name).includes(q));
}
const DAILY_LBL={stat:'Cambia una stat',loyalty:'Cambia la lealtad',kill:'Elimina al personaje'};
function stateChips(st){
  const c=[];
  c.push(st.days>0?'Dura '+plural(st.days,'día','días'):'Hasta que un evento lo quite');
  if(st.mods.length) c.push(plural(st.mods.length,'modificador','modificadores')+' de stats');
  if(st.daily.length) c.push(plural(st.daily.length,'efecto diario','efectos diarios'));
  if(!st.canAct) c.push('Impide actuar');
  return c;
}
function stateCard(st){
  const u=usage('states',st.id);
  return `<button type="button" class="ccard" data-act="state-edit" data-id="${st.id}">
  <span class="av lg" style="--h:${hue(st.name||'')}">${esc(st.icon||(st.name||'?').slice(0,1).toUpperCase())}</span>
  <div><b>${esc(st.name||'Sin nombre')}</b><br><small>${esc(stateChips(st).join(' · '))}</small><br><small>${plural(u.ch,'personaje lo tiene','personajes lo tienen')} · ${plural(u.ev,'evento','eventos')}</small></div></button>`;
}
function statesListHTML(){
  if(!P.states.length) return '<p class="empty">Todavía no hay estados alterados. Creá el primero: por ejemplo «Quemado» o «Envenenado».</p>';
  const L=statesFiltered();
  if(!L.length) return '<p class="empty">Ningún estado coincide con la búsqueda.</p>';
  return `<div class="grid">${L.map(stateCard).join('')}</div>`;
}
function vStates(){
  if(ui.state){const s=curState();if(s)return vStateForm(s);ui.state=null;}
  return `<div class="bar"><h2 class="h2">Estados alterados</h2><div class="acts"><button type="button" class="btn pri" data-act="state-new">Nuevo estado</button></div></div>
  <p class="hint" style="margin-bottom:12px">Un estado alterado es algo que le pasa a un personaje y dura un tiempo: quemadura, veneno, aturdimiento… Puede cambiarle las stats, impedirle actuar o hacerle algo cada día (incluso matarlo). Los eventos lo aplican, lo quitan y lo piden como condición: por ejemplo, «si X está quemado, puede morir por las quemaduras». Un personaje puede tener varios a la vez.</p>
  <div class="fbar"><input type="search" placeholder="Buscar estados…" value="${esc(ui.q.states)}" data-bind="q" data-k="states" aria-label="Buscar estados"><span class="hint" id="count">${countText('states')}</span></div>
  <div id="list">${statesListHTML()}</div>`;
}

const sSel=(bind,i,label,body)=>`<select data-bind="${bind}" data-i="${i}" aria-label="${label}">${body}</select>`;
const sOpt=(v,cur,txt)=>`<option value="${esc(v)}" ${String(cur)===String(v)?'selected':''}>${esc(txt)}</option>`;
function statOpts(cur){
  let h=`<option value="" ${!cur?'selected':''}>Elegir stat…</option>`+P.stats.map(s=>sOpt(s.id,cur,s.name||'Sin nombre')).join('');
  if(cur&&!P.stats.some(s=>s.id===cur)) h=`<option value="${esc(cur)}" selected>⚠ ya no existe</option>`+h;
  return h;
}
function modRow(m,i){
  return `<div class="wrow">${sSel('sm-stat',i,'Stat',statOpts(m.stat))}${sSel('sm-mode',i,'Modo',sOpt('add',m.mode,'suma')+sOpt('mult',m.mode,'multiplica por'))}<input type="number" step="any" value="${m.num}" data-bind="sm-num" data-i="${i}" aria-label="Número"><button type="button" class="x" data-act="sm-del" data-i="${i}" aria-label="Quitar modificador">✕</button></div>`;
}
function dailyRow(d,i){
  let h=sSel('sd-k',i,'Qué hace',Object.keys(DAILY_LBL).map(k=>sOpt(k,d.k,DAILY_LBL[k])).join(''));
  if(d.k==='stat') h+=sSel('sd-ref',i,'Stat',statOpts(d.ref));
  if(d.k!=='kill') h+=sSel('sd-mode',i,'Modo',sOpt('add',d.mode,'suma')+sOpt('set',d.mode,'fija en'))+`<input type="number" step="any" value="${d.num}" data-bind="sd-num" data-i="${i}" aria-label="Número">`;
  h+=`<span class="w hint">con</span><input type="number" min="0" max="100" value="${d.pct}" data-bind="sd-pct" data-i="${i}" aria-label="Probabilidad por día en porcentaje" style="max-width:84px"><span class="w hint">% por día</span>`;
  return `<div class="wrow">${h}<button type="button" class="x" data-act="sd-del" data-i="${i}" aria-label="Quitar efecto diario">✕</button></div>`;
}
function stateWarnings(st){
  const w=[];
  if(!st.canAct&&st.days===0) w.push('Este estado impide actuar y no se acaba solo: el personaje no volverá a actuar por su cuenta. Solo otro personaje, en un evento donde él sea «Y», podría quitárselo.');
  if(st.mods.some(m=>!P.stats.some(s=>s.id===m.stat))||st.daily.some(d=>d.k==='stat'&&!P.stats.some(s=>s.id===d.ref))) w.push('Hay un modificador o un efecto diario sin stat elegida (o con una stat que ya no existe). No hace nada hasta que lo arregles.');
  return w;
}
function vStateForm(st){
  const u=usage('states',st.id),warn=stateWarnings(st);
  return `<div class="bar"><button type="button" class="btn" data-act="state-back">← Estados</button><button type="button" class="btn dng" data-act="state-del" data-confirm="¿Eliminar? Tocá otra vez">Eliminar estado</button></div>
  ${warn.length?`<div class="note warn"><b>Para revisar</b><ul>${warn.map(x=>`<li>${esc(x)}</li>`).join('')}</ul></div>`:''}
  <section class="card sec"><h3 class="h3">Ficha</h3>
  <div class="two"><div style="flex:2 1 200px"><label for="s-name">Nombre</label><input type="text" id="s-name" value="${esc(st.name)}" data-bind="state-name" autocomplete="off"></div>
  <div><label for="s-icon">Ícono</label><input type="text" id="s-icon" maxlength="8" value="${esc(st.icon)}" data-bind="state-icon" autocomplete="off" style="max-width:90px"></div>
  <div><label for="s-days">Dura (días, 0 = no se acaba solo)</label><input type="number" id="s-days" min="0" value="${st.days}" data-bind="state-days"></div></div>
  <p class="hint">Un estado de N días actúa durante los N días siguientes a aquel en que se aplicó y después se va solo. Con 0 dura hasta que un evento lo quite.</p>
  <label class="pick" style="display:inline-flex;margin:0"><span style="display:inline-flex;gap:6px;align-items:center;text-transform:none;letter-spacing:0;font:500 14px var(--font-body);color:var(--ink);background:var(--surface-2);border-radius:6px;padding:6px 10px"><input type="checkbox" data-bind="state-canact" ${st.canAct?'checked':''}>Puede actuar con normalidad</span></label>
  <p class="hint">Si lo desmarcás, mientras tenga este estado el personaje no puede protagonizar eventos por su cuenta (sigue pudiendo ser blanco de los demás). Sirve para parálisis, sueño o aturdimiento.</p>
  <div><label for="s-text">Texto del registro (cuando le hace algo cada día)</label><input type="text" id="s-text" value="${esc(st.text)}" placeholder="{X} sufre por «${esc(st.name||'…')}»." data-bind="state-text" autocomplete="off"></div></section>
  <section class="card sec"><h3 class="h3">Cambios en las stats</h3>
  <p class="hint">Mientras dure, las stats del personaje valen distinto en las reglas y en las probabilidades: «suma» agrega (o resta con un número negativo) y «multiplica por» escala. Las stats que el personaje no tiene siguen valiendo 0. Los valores base no se tocan: al terminar el estado, todo vuelve a la normalidad.</p>
  ${st.mods.map(modRow).join('')}
  ${P.stats.length?'':'<p class="hint">Todavía no hay stats. Creálas en la pestaña Stats.</p>'}
  <div><button type="button" class="btn sm" data-act="sm-add" ${P.stats.length?'':'disabled'}>Agregar cambio de stat</button></div></section>
  <section class="card sec"><h3 class="h3">Efectos de cada día</h3>
  <p class="hint">Lo que le pasa al personaje cada día que tiene este estado, con su probabilidad. Por ejemplo, la quemadura le resta 1 de Fuerza con 60% de probabilidad por día, o el veneno lo elimina con 12%. Para algo más elaborado (que muera solo si ya está muy débil), mejor usá un evento con la regla «tiene el estado».</p>
  ${st.daily.map(dailyRow).join('')}
  <div><button type="button" class="btn sm" data-act="sd-add">Agregar efecto diario</button></div></section>
  <section class="card sec"><h3 class="h3">Dónde se usa</h3><div class="chips"><span class="chip">${plural(u.ch,'personaje lo tiene al empezar','personajes lo tienen al empezar')}</span><span class="chip">${plural(u.ev,'evento','eventos')}</span></div></section>`;
}

Object.assign(ACT,{
  'state-new'(){
    const st={id:uid(),name:'',icon:'',days:3,canAct:true,text:'',mods:[],daily:[]};
    P.states.push(st);ui.state=st.id;structural();window.scrollTo(0,0);
    const f=$('#s-name');if(f)f.focus();
  },
  'state-edit'(b){ui.state=b.dataset.id;render();window.scrollTo(0,0);},
  'state-back'(){
    const st=curState();
    if(st&&!st.name.trim()){st.name='Estado '+(P.states.indexOf(st)+1);touch();}
    ui.state=null;render();
  },
  'state-del'(){
    const id=ui.state,u=usage('states',id);
    P.states=P.states.filter(s=>s.id!==id);
    P.chars.forEach(c=>{c.states=c.states.filter(x=>x!==id);});
    ui.state=null;structural();
    toast(u.ev?('Eliminado. '+plural(u.ev,'evento quedó','eventos quedaron')+' con una referencia rota.'):'Estado eliminado');
  },
  'sm-add'(){const st=curState();if(!st||!P.stats.length)return;st.mods.push({stat:P.stats[0].id,mode:'add',num:-1});structural();},
  'sm-del'(b){const st=curState();if(st){st.mods.splice(+b.dataset.i,1);structural();}},
  'sd-add'(){const st=curState();if(!st)return;st.daily.push({k:'stat',ref:P.stats[0]?P.stats[0].id:'',mode:'add',num:-1,pct:100});structural();}
  ,
  'sd-del'(b){const st=curState();if(st){st.daily.splice(+b.dataset.i,1);structural();}}
});
const numOr=(t,d)=>{const v=parseFloat(t.value);return isFinite(v)?v:d;};
Object.assign(BIND,{
  'state-name'(t){const st=curState();if(st){st.name=t.value;touch();}},
  'state-icon'(t){const st=curState();if(st){st.icon=t.value.trim();touch();}},
  'state-days'(t){const st=curState();const v=parseInt(t.value,10);if(st&&!isNaN(v)){st.days=Math.max(0,v);touch();}},
  'state-canact'(t){const st=curState();if(st){st.canAct=t.checked;structural();}},
  'state-text'(t){const st=curState();if(st){st.text=t.value;touch();}},
  'sm-stat'(t){const st=curState();if(st&&st.mods[+t.dataset.i]){st.mods[+t.dataset.i].stat=t.value;structural();}},
  'sm-mode'(t){const st=curState(),m=st&&st.mods[+t.dataset.i];if(m){m.mode=t.value==='mult'?'mult':'add';m.num=m.mode==='mult'?1:-1;structural();}},
  'sm-num'(t){const st=curState(),m=st&&st.mods[+t.dataset.i];if(m){m.num=numOr(t,m.num);touch();}},
  'sd-k'(t){const st=curState(),d=st&&st.daily[+t.dataset.i];if(d){d.k=t.value;if(d.k==='kill'){d.num=1;d.mode='add';}else if(d.num>=1&&d.k!=='stat'&&d.k!=='loyalty')d.num=-1;structural();}},
  'sd-ref'(t){const st=curState(),d=st&&st.daily[+t.dataset.i];if(d){d.ref=t.value;structural();}},
  'sd-mode'(t){const st=curState(),d=st&&st.daily[+t.dataset.i];if(d){d.mode=t.value==='set'?'set':'add';touch();}},
  'sd-num'(t){const st=curState(),d=st&&st.daily[+t.dataset.i];if(d){d.num=numOr(t,d.num);touch();}},
  'sd-pct'(t){const st=curState(),d=st&&st.daily[+t.dataset.i];if(d){d.pct=Math.min(100,Math.max(0,numOr(t,100)));touch();}}
});
