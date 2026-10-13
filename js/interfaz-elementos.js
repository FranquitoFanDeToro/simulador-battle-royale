'use strict';
/* =====================================================================
   INTERFAZ DE ELEMENTOS DEL EVENTO.
   Un elemento es algo que el evento elige solo cuando ocurre: un objeto o una
   habilidad, un estado alterado, un equipo. Se nombra en el texto ({Objeto1})
   y se usa en los efectos. Ejemplos:
     «{X} intercambió {Objeto1} por {Objeto2} de {Y}»
     «{X} copió la habilidad {Habilidad1} de {Y}»
     «{Equipo1} y {Equipo2} pelearon hasta la muerte»
   De dónde sale: lo que tiene un participante, todo el proyecto o una lista
   elegida a mano; y después se filtra (categorías, qué tiene o no tiene cada
   participante, tamaño…). No hay límite de elementos por evento.
   ===================================================================== */

const VAR_NOUN={item:'un objeto',skill:'una habilidad',state:'un estado',team:'un equipo',scene:'un escenario'};
const VAR_PLURAL={item:'objetos',skill:'habilidades',state:'estados',team:'equipos',scene:'escenarios'};
const VAR_LIST={item:'items',skill:'skills',state:'states',scene:'scenes'};
const catsOf=kind=>VAR_LIST[kind]?[...new Set(P[VAR_LIST[kind]].flatMap(catList).filter(Boolean))].sort():[];
/* Elementos que se pueden elegir a mano: los del proyecto (los equipos, solo los armados de antemano). */
const varChoices=kind=>kind==='team'?P.teams.map(t=>({id:t.id,label:t.name||'Sin nombre'})):P[VAR_LIST[kind]].map(i=>({id:i.id,label:lbl(i)}));

/* Fichas con ✕ y un selector para sumar otra: sirve para categorías, elementos elegidos y participantes. */
function varChips(i,f,chips,options,label){
  const free=options.filter(o=>!chips.some(c=>c.id===o.id));
  return `<div class="chipsel">${chips.map(c=>`<span class="chip rc">${esc(c.label)}<button type="button" class="x" data-act="var-chip-del" data-i="${i}" data-f="${f}" data-v="${esc(c.id)}" aria-label="Quitar ${esc(c.label)}">✕</button></span>`).join('')}${free.length?`<select class="addsel mini" data-bind="var-chip-add" data-i="${i}" data-f="${f}" aria-label="${esc(label)}"><option value="">＋ ${esc(label)}</option>${free.map(o=>`<option value="${esc(o.id)}">${esc(o.label)}</option>`).join('')}</select>`:''}</div>`;
}
function varRow(e,v,i){
  const o=(val,cur,txt)=>`<option value="${esc(val)}" ${val===cur?'selected':''}>${esc(txt)}</option>`;
  const sel=(bind,label,body)=>`<select data-bind="${bind}" data-i="${i}" aria-label="${label}">${body}</select>`;
  const names=e.roles.map(r=>r.n);
  const roleOpts2=cur=>names.map(n=>o(n,cur,n)).join('')+(cur&&!names.includes(cur)?o(cur,cur,'⚠ '+cur):'');
  const roleChoices=names.map(n=>({id:n,label:n}));
  const roleChips=ids=>ids.map(n=>({id:n,label:n}));
  const field=(label,body)=>`<div class="vf"><span class="vl">${label}</span>${body}</div>`;
  const isTeam=v.kind==='team',isScene=v.kind==='scene';
  let h=`<span class="rl vl">{${esc(v.n)}}</span><span class="hint">${VAR_NOUN[v.kind]}</span><button type="button" class="x" data-act="var-del" data-i="${i}" aria-label="Quitar elemento">✕</button>`;
  let f='';
  /* de dónde sale */
  const srcOpts=isScene
    ?o('of',v.src,'el escenario donde está un participante')+o('near',v.src,'un escenario conectado con el de un participante')+o('any',v.src,'cualquiera del proyecto')+o('list',v.src,'de una lista elegida a mano')
    :isTeam
    ?o('of',v.src,'el equipo de un participante')+o('any',v.src,'cualquier equipo de la partida')+o('list',v.src,'equipos elegidos a mano (los armados de antemano)')
    :o('of',v.src,'uno de los que tiene un participante')+o('any',v.src,'cualquiera del proyecto')+o('list',v.src,'de una lista elegida a mano');
  f+=field('Se elige',sel('var-src','Cómo se elige',srcOpts)+((v.src==='of'||v.src==='near')?sel('var-role','Participante',roleOpts2(v.role)):''));
  if(v.src==='list'){
    const ch=varChoices(v.kind),chips=v.ids.map(id=>({id,label:(ch.find(c=>c.id===id)||{label:'⚠ ya no existe'}).label}));
    f+=field(v.excl?'Todos menos…':'Lista',varChips(i,'ids',chips,ch,'agregar')+`<label class="check sm"><input type="checkbox" data-bind="var-excl" data-i="${i}" ${v.excl?'checked':''}>Todos menos los elegidos</label>`);
  }
  /* filtros */
  if(!isTeam&&!isScene){
    const cats=catsOf(v.kind);
    if(cats.length||v.cats.length) f+=field('Categorías',varChips(i,'cats',v.cats.map(c=>({id:c,label:c||'(sin categoría)'})),cats.filter(c=>c).map(c=>({id:c,label:c})).concat([{id:'',label:'(sin categoría)'}]),'agregar categoría')+(v.cats.length?'':'<span class="hint">todas</span>'));
  }
  f+=field(isScene?'Que sea el escenario de':(isTeam?'Que incluya a':'Que también tenga'),varChips(i,'has',roleChips(v.has),roleChoices.filter(r=>!(v.src==='of'&&r.id===v.role)),'agregar participante'));
  f+=field(isScene?'Que no sea el escenario de':(isTeam?'Que no incluya a':'Que no tenga'),varChips(i,'lacks',roleChips(v.lacks),roleChoices,'agregar participante'));
  if(v.kind==='item'||isTeam||isScene){
    const sz=v.size,lab=isScene?'Personajes vivos presentes':(isTeam?'Integrantes vivos':'Tamaño del objeto');
    f+=field(lab,sel('var-size-op',lab,o('',sz?sz.op:'','sin filtro')+CMP.map(c=>o(c,sz?sz.op:'',CMP_LBL[c])).join(''))+(sz?`<input type="number" step="any" min="0" value="${sz.num}" data-bind="var-size-num" data-i="${i}" aria-label="${lab}: número">`:''));
  }
  if(isTeam) f+=field('Liderazgo',sel('var-leader','Liderazgo',o('',v.leader,'con o sin líder')+o('yes',v.leader,'solo con líder')+o('no',v.leader,'solo sin líder')));
  return `<div class="velem"><div class="vh">${h}</div><div class="vgrid">${f}</div></div>`;
}
function varsSection(e){
  const vars=e.vars||[];
  return `<section class="card sec"><div class="sh"><h3 class="h3">Elementos del evento</h3>${helpBtn('vars')}</div>
  ${vars.map((v,i)=>varRow(e,v,i)).join('')}
  <div><select class="addsel" data-bind="var-add" aria-label="Agregar elemento"><option value="">＋ Agregar elemento…</option>${Object.keys(VAR_KINDS).map(k=>`<option value="${k}">${VAR_KINDS[k].lbl}</option>`).join('')}</select></div></section>`;
}

Object.assign(ACT,{
  'var-del'(b){
    const e=curEv();if(!e)return;
    const i=+b.dataset.i,v=e.vars[i];if(!v)return;
    e.vars.splice(i,1);
    /* los efectos que usaban este elemento quedan sin elegir (el aviso «Para revisar» lo marca) */
    allFx(e).forEach(f=>{if(f.ref==='@'+v.n)f.ref='';if(f.ref2==='@'+v.n)f.ref2='';if(f.tgt==='@'+v.n)f.tgt='';});
    const clean=root=>walkRules(root,r=>{if(r.val==='@'+v.n)r.val='';});
    clean(e.cond);allChances(e).forEach(c=>(c.steps||[]).forEach(st=>clean(st.cond)));
    structural();
  },
  'var-chip-del'(b){
    const v=curVar(b);if(!v)return;
    const f=b.dataset.f;if(!['ids','cats','has','lacks'].includes(f))return;
    v[f]=v[f].filter(x=>x!==b.dataset.v);structural();
  }
});
const curVar=t=>{const e=curEv();return e&&e.vars?e.vars[+t.dataset.i]:null;};
Object.assign(BIND,{
  'var-add'(t){
    const e=curEv(),k=t.value;
    if(!e||!VAR_KINDS[k])return;
    e.vars.push({n:nextVarName(e.vars,k),kind:k,src:'of',role:'X',has:[],lacks:[],cats:[],ids:[],excl:false,size:null,leader:''});
    structural();
  },
  'var-src'(t){const v=curVar(t);if(v){v.src=VAR_SRC.includes(t.value)?t.value:'of';structural();}},
  'var-role'(t){const v=curVar(t);if(v){v.role=t.value;structural();}},
  'var-chip-add'(t){
    const v=curVar(t),f=t.dataset.f;
    if(!v||!['ids','cats','has','lacks'].includes(f))return;
    /* la categoría «(sin categoría)» es el texto vacío: por eso se acepta aunque el valor sea '' */
    if(t.selectedIndex<=0)return;
    if(!v[f].includes(t.value))v[f]=v[f].concat(t.value);
    structural();
  },
  'var-excl'(t){const v=curVar(t);if(v){v.excl=t.checked;structural();}},
  'var-size-op'(t){const v=curVar(t);if(!v)return;v.size=t.value?{op:t.value,num:v.size?v.size.num:1}:null;structural();},
  'var-size-num'(t){const v=curVar(t),n=parseFloat(t.value);if(v&&v.size&&isFinite(n)){v.size.num=n;touch();}},
  'var-leader'(t){const v=curVar(t);if(v){v.leader=['yes','no'].includes(t.value)?t.value:'';touch();}}
});
