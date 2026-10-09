'use strict';
/* =====================================================================
   NÚCLEO: modelo de datos y motor de la simulación.
   No toca la pantalla. Todo lo que el usuario crea vive en el objeto P:

   P = {
     v: 2,
     stats:  [{id, name, def}]                       catálogo de stats
     items:  [{id, name, size, cat}]                 objetos (size = espacio que ocupan)
     skills: [{id, name, cat}]                       habilidades
     chars:  [{id, name, gender, enabled, slots,     personajes
               imgs:[{id, kind:'file'|'url'|'data', src, tag}],
               items:[ids], skills:[ids], stats:{statId: número}}]
     events: [{id, text, weight, roles:[{n, req, look}],
               cond:{...árbol de reglas...}, fx:[efectos]}]
   }
   ===================================================================== */

const uid=()=>Math.random().toString(36).slice(2,9);
const esc=s=>String(s==null?'':s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));

const GEN={f:'Femenino',m:'Masculino',o:'Otro'};
const ROLE_NAMES=['X','Y','Z','W'];
const KINDS=['item','space','skill','gender','status','hasstat','stat','statvs'];
const CMP=['>=','>','<=','<','=','!='];
const CMP_LBL={'>=':'≥','>':'>','<=':'≤','<':'<','=':'=','!=':'≠'};
const FX={
  kill:{label:'Elimina a',ref:null,prep:''},
  giveItem:{label:'Entrega el objeto',ref:'items',prep:'a'},
  removeItem:{label:'Quita el objeto',ref:'items',prep:'de'},
  giveSkill:{label:'Otorga la habilidad',ref:'skills',prep:'a'},
  removeSkill:{label:'Quita la habilidad',ref:'skills',prep:'de'},
  stat:{label:'Cambia la stat',ref:'stats',prep:'de'}
};
const DEFAULT_SLOTS=5;
let P=null;

const emptyCond=()=>({t:'g',op:'and',c:[]});
const safeUrl=s=>/^(https?:\/\/|data:image\/)/i.test(String(s||''));

/* ---------- Proyecto de ejemplo ---------- */
function sampleProject(){
  const R=(role,kind,val,neg,extra)=>Object.assign({t:'r',neg:!!neg,role,kind,val:val||'',op:'>=',num:1,role2:'Y'},extra||{});
  const G=(op,...c)=>({t:'g',op,c});
  const I={cu:'it_cuchillo',ar:'it_arco',bo:'it_botiquin'};
  const K={si:'sk_sigilo',pu:'sk_punteria',au:'sk_auxilios'};
  const T={fu:'st_fuerza',ag:'st_agilidad',ing:'st_ingenio'};
  const C=(name,gender,items,skills,stats)=>({id:uid(),name,gender,enabled:true,slots:4,imgs:[],items:items||[],skills:skills||[],stats:stats||{}});
  const rl=(n,req)=>({n:n,req:req||'alive',look:''});
  const E=(text,weight,roles,cond,fx)=>({
    id:uid(),text,weight,roles,cond:cond||emptyCond(),
    fx:(fx||[]).map(f=>Object.assign({k:'kill',role:'X',ref:'',by:'',mode:'add',num:1},f))
  });
  const X=rl('X'), Y=rl('Y');
  return {
    v:2,
    fallback:'{X} pasó el día sin novedades.',
    stats:[{id:T.fu,name:'Fuerza',def:5},{id:T.ag,name:'Agilidad',def:5},{id:T.ing,name:'Ingenio',def:5}],
    items:[
      {id:I.cu,name:'Cuchillo',size:1,cat:'Armas'},
      {id:I.ar,name:'Arco',size:2,cat:'Armas'},
      {id:I.bo,name:'Botiquín',size:1,cat:'Salud'}
    ],
    skills:[
      {id:K.si,name:'Sigilo',cat:'Movimiento'},
      {id:K.pu,name:'Puntería',cat:'Combate'},
      {id:K.au,name:'Primeros auxilios',cat:'Salud'}
    ],
    chars:[
      C('Valeria','f',[],[],{[T.fu]:4,[T.ag]:7}),
      C('Tomás','m',[],[K.pu],{[T.fu]:7,[T.ag]:4,[T.ing]:5}),
      C('Lucía','f',[],[K.au],{[T.ing]:8,[T.ag]:5}),
      C('Mateo','m',[I.cu],[],{[T.fu]:8}),
      C('Camila','f',[],[K.si],{[T.ag]:8,[T.ing]:6}),
      C('Joaquín','m',[I.ar],[K.pu],{[T.fu]:5,[T.ag]:6}),
      C('Sofía','f',[I.bo],[],{[T.ing]:6}),
      C('Bruno','m',[],[],{})
    ],
    events:[
      E('{X} encontró un cuchillo entre unos arbustos.',3,[X],G('and',R('X','item',I.cu,true),R('X','space',I.cu)),[{k:'giveItem',role:'X',ref:I.cu}]),
      E('{X} apuñaló a {Y} hasta la muerte.',3,[X,Y],G('and',R('X','item',I.cu)),[{k:'kill',role:'Y'}]),
      E('{X} encontró un arco abandonado.',2,[X],G('and',R('X','item',I.ar,true),R('X','space',I.ar)),[{k:'giveItem',role:'X',ref:I.ar}]),
      E('{X} le disparó una flecha a {Y} desde lejos.',3,[X,Y],G('and',R('X','item',I.ar),G('or',R('X','skill',K.pu),R('Y','skill',K.si,true))),[{k:'kill',role:'Y'}]),
      E('{X} encontró un botiquín.',2,[X],G('and',R('X','item',I.bo,true),R('X','space',I.bo)),[{k:'giveItem',role:'X',ref:I.bo}]),
      E('{X} usó el botiquín para curarse las heridas.',2,[X],G('and',R('X','item',I.bo)),[{k:'removeItem',role:'X',ref:I.bo}]),
      E('{X} curó las heridas de {Y} y se ganó su confianza.',2,[X,Y],G('and',R('X','item',I.bo),R('X','skill',K.au)),[{k:'removeItem',role:'X',ref:I.bo}]),
      E('{X} le robó el cuchillo a {Y} mientras dormía.',3,[X,Y],G('and',R('Y','item',I.cu),R('X','item',I.cu,true),R('X','skill',K.si),R('X','space',I.cu)),[{k:'removeItem',role:'Y',ref:I.cu},{k:'giveItem',role:'X',ref:I.cu}]),
      E('{X} desarmó a {Y} en un forcejeo y se quedó con su cuchillo.',3,[X,Y],G('and',R('Y','item',I.cu),R('X','item',I.cu,true),R('X','space',I.cu),R('X','statvs',T.fu,false,{op:'>',role2:'Y'})),[{k:'removeItem',role:'Y',ref:I.cu},{k:'giveItem',role:'X',ref:I.cu}]),
      E('{X} entrenó toda la mañana y ganó fuerza.',2,[X],G('and',R('X','hasstat',T.fu)),[{k:'stat',role:'X',ref:T.fu,mode:'add',num:1}]),
      E('{X} y {Y} compartieron una fogata y hablaron de su casa.',4,[X,Y]),
      E('{X} y {Y} acordaron no atacarse.',2,[X,Y]),
      E('{X} pasó el día escondido en una cueva.',3,[X]),
      E('{X} aprendió a moverse sin hacer ruido.',1,[X],G('and',R('X','skill',K.si,true)),[{k:'giveSkill',role:'X',ref:K.si}]),
      E('{X} se quedó junto al cuerpo de {Y} sin decir nada.',2,[X,rl('Y','dead')]),
      E('{X} se resbaló en un barranco y no pudo salir.',1,[X],emptyCond(),[{k:'kill',role:'X'}])
    ]
  };
}

/* ---------- Normalizar (también migra proyectos de la versión 1) ---------- */
function normCond(c){
  if(!c||typeof c!=='object') return null;
  if(c.t==='g'){
    return {t:'g',op:['and','or','not'].includes(c.op)?c.op:'and',c:(Array.isArray(c.c)?c.c:[]).map(normCond).filter(Boolean)};
  }
  if(c.t==='r'){
    const n=parseFloat(c.num);
    return {
      t:'r',neg:!!c.neg,role:String(c.role||'X'),kind:KINDS.includes(c.kind)?c.kind:'item',
      val:c.val==null?'':String(c.val),op:CMP.includes(c.op)?c.op:'>=',num:isFinite(n)?n:1,role2:String(c.role2||'Y')
    };
  }
  return null;
}
function normRoles(r){
  let out=(Array.isArray(r)?r:[]).filter(x=>x&&ROLE_NAMES.includes(x.n)).slice(0,4)
    .map(x=>({n:x.n,req:['alive','dead','any'].includes(x.req)?x.req:'alive',look:String(x.look||'')}));
  if(!out.length) out=[{n:'X',req:'alive',look:''}];
  out[0].req='alive';
  return out;
}
function normalize(p){
  if(!p||typeof p!=='object') return null;
  const arr=a=>Array.isArray(a)?a:[];
  const num=(v,d)=>{v=parseFloat(v);return isFinite(v)?v:d;};
  const o={v:2,stats:[],items:[],skills:[],chars:[],events:[],fallback:'{X} pasó el día sin novedades.'};
  o.stats=arr(p.stats).filter(i=>i&&i.id).map(i=>({id:String(i.id),name:String(i.name||''),def:num(i.def,5)}));
  o.items=arr(p.items).filter(i=>i&&i.id).map(i=>({id:String(i.id),name:String(i.name||''),size:Math.max(0,Math.floor(num(i.size,1))),cat:String(i.cat||'')}));
  o.skills=arr(p.skills).filter(i=>i&&i.id).map(i=>({id:String(i.id),name:String(i.name||''),cat:String(i.cat||'')}));
  o.chars=arr(p.chars).filter(c=>c&&c.id).map(c=>{
    let imgs=arr(c.imgs).filter(i=>i&&i.id&&['file','url','data'].includes(i.kind)&&(i.kind==='file'||safeUrl(i.src)))
      .map(i=>({id:String(i.id),kind:i.kind,src:i.kind==='file'?'':String(i.src),tag:String(i.tag||'')}));
    if(!imgs.length&&typeof c.img==='string'&&c.img.indexOf('data:image/')===0) imgs=[{id:uid(),kind:'data',src:c.img,tag:''}];
    const stats={};
    if(c.stats&&typeof c.stats==='object'&&!Array.isArray(c.stats)){
      Object.keys(c.stats).forEach(k=>{const v=parseFloat(c.stats[k]);if(isFinite(v))stats[k]=v;});
    }
    return {
      id:String(c.id),name:String(c.name||''),gender:GEN[c.gender]?c.gender:'o',enabled:c.enabled!==false,
      slots:Math.max(0,Math.floor(num(c.slots,DEFAULT_SLOTS))),imgs,
      items:arr(c.items).map(String),skills:arr(c.skills).map(String),stats
    };
  });
  o.events=arr(p.events).filter(e=>e&&e.id).map(e=>{
    const cond=normCond(e.cond);
    return {
      id:String(e.id),text:String(e.text||''),
      weight:Math.min(10,Math.max(1,parseInt(e.weight,10)||3)),
      roles:normRoles(e.roles),
      cond:(cond&&cond.t==='g')?cond:emptyCond(),
      fx:arr(e.fx).filter(f=>f&&FX[f.k]).map(f=>({
        k:f.k,role:String(f.role||'X'),ref:f.ref?String(f.ref):'',by:String(f.by||''),
        mode:f.mode==='set'?'set':'add',num:num(f.num,1)
      }))
    };
  });
  if(typeof p.fallback==='string'&&p.fallback.trim()) o.fallback=p.fallback;
  return o;
}

/* ---------- Inventario y stats (sirven para personajes del proyecto y de la simulación) ---------- */
const sizeOf=id=>{const i=P.items.find(x=>x.id===id);return i?i.size:0;};
function usedSlots(ch){let n=0;ch.items.forEach(id=>{n+=sizeOf(id);});return n;}
const slotsFree=ch=>ch.slots-usedSlots(ch);
const hasStat=(ch,id)=>Object.prototype.hasOwnProperty.call(ch.stats,id);
const statVal=(ch,id)=>hasStat(ch,id)?ch.stats[id]:0;   // una stat que no se tiene vale 0
function cmp(a,op,b){
  switch(op){
    case '>=':return a>=b; case '>':return a>b; case '<=':return a<=b;
    case '<':return a<b; case '=':return a===b; case '!=':return a!==b;
  }
  return false;
}

/* ---------- Motor ---------- */
function shuffle(a){for(let i=a.length-1;i>0;i--){const j=Math.floor(Math.random()*(i+1));const t=a[i];a[i]=a[j];a[j]=t;}return a;}

function evalNode(n,as){
  if(n.t==='g'){
    if(!n.c.length) return true;
    if(n.op==='and') return n.c.every(c=>evalNode(c,as));
    if(n.op==='or') return n.c.some(c=>evalNode(c,as));
    return !n.c.some(c=>evalNode(c,as));
  }
  const ch=as[n.role];
  if(!ch) return false;
  let v=false;
  switch(n.kind){
    case 'item': v=!!n.val&&ch.items.has(n.val); break;
    case 'space': {const it=P.items.find(i=>i.id===n.val);v=!!it&&slotsFree(ch)>=it.size;break;}
    case 'skill': v=!!n.val&&ch.skills.has(n.val); break;
    case 'gender': v=ch.gender===n.val; break;
    case 'status': v=(n.val==='dead')?!ch.alive:ch.alive; break;
    case 'hasstat': v=!!n.val&&hasStat(ch,n.val); break;
    case 'stat': v=!!n.val&&cmp(statVal(ch,n.val),n.op,n.num); break;
    case 'statvs': {const c2=as[n.role2];v=!!n.val&&!!c2&&cmp(statVal(ch,n.val),n.op,statVal(c2,n.val));break;}
  }
  return n.neg?!v:v;
}

function newSim(){
  const okIds=(list,ids)=>ids.filter(id=>list.some(i=>i.id===id));
  return {
    day:0,over:false,capped:false,days:[],
    chars:P.chars.filter(c=>c.enabled).map(c=>{
      const stats={};
      Object.keys(c.stats).forEach(id=>{if(P.stats.some(s=>s.id===id))stats[id]=c.stats[id];});
      return {
        id:c.id,name:c.name||'Sin nombre',gender:c.gender,imgs:c.imgs,slots:c.slots,
        items:new Set(okIds(P.items,c.items)),skills:new Set(okIds(P.skills,c.skills)),stats,
        alive:true,kills:0,victims:[],killedBy:null,diedDay:null
      };
    })
  };
}

function pickAssignment(e,actor,sim,used,ignoreCond){
  const roles=e.roles;
  const pools=roles.slice(1).map(r=>{
    const alive=sim.chars.filter(c=>c.alive&&!used.has(c.id)&&c.id!==actor.id);
    const dead=sim.chars.filter(c=>!c.alive);
    return r.req==='dead'?dead:(r.req==='any'?alive.concat(dead):alive);
  });
  if(pools.some(p=>!p.length)) return null;
  const valid=[];
  const test=combo=>{
    const ids=new Set([actor.id]);
    for(const c of combo){ if(ids.has(c.id)) return; ids.add(c.id); }
    const as={}; as[roles[0].n]=actor;
    combo.forEach((c,i)=>{as[roles[i+1].n]=c;});
    if(ignoreCond||evalNode(e.cond,as)) valid.push(as);
  };
  const total=pools.reduce((a,p)=>a*p.length,1);
  if(total<=400){
    const rec=(i,acc)=>{ if(i===pools.length){test(acc);return;} for(const c of pools[i]) rec(i+1,acc.concat([c])); };
    rec(0,[]);
  } else {
    for(let k=0;k<80;k++) test(pools.map(p=>p[Math.floor(Math.random()*p.length)]));
  }
  return valid.length?valid[Math.floor(Math.random()*valid.length)]:null;
}
function fmt(text,as){
  return esc(text).replace(/\{([A-Z])\}/g,(m,k)=>as[k]?'<b class="nm">'+esc(as[k].name)+'</b>':m);
}
const roleLook=(e,k)=>{const r=e.roles.find(x=>x.n===k);return r?r.look:'';};

function applyFx(e,as,actor,sim,entry){
  for(const f of e.fx){
    const t=as[f.role]; if(!t) continue;
    if(f.k==='kill'){
      if(!t.alive) continue;
      let by=null;
      if(f.by==='none') by=null;
      else if(f.by&&as[f.by]) by=as[f.by];
      else if(!f.by&&t.id!==actor.id) by=actor;
      if(by&&by.id===t.id) by=null;
      t.alive=false; t.diedDay=sim.day; t.killedBy=by;
      if(by){by.kills++;by.victims.push(t.name);}
      entry.deaths.push(t);
    } else if(f.k==='giveItem'&&f.ref){
      if(t.items.has(f.ref)) continue;
      if(slotsFree(t)<sizeOf(f.ref)){entry.notes.push(t.name+' no tenía espacio para '+nameOf(P.items,f.ref)+'.');continue;}
      t.items.add(f.ref);
    } else if(f.k==='removeItem'&&f.ref) t.items.delete(f.ref);
    else if(f.k==='giveSkill'&&f.ref) t.skills.add(f.ref);
    else if(f.k==='removeSkill'&&f.ref) t.skills.delete(f.ref);
    else if(f.k==='stat'&&f.ref){
      if(!hasStat(t,f.ref)){entry.notes.push(t.name+' no tiene la stat '+nameOf(P.stats,f.ref)+', no cambia.');continue;}
      t.stats[f.ref]=f.mode==='set'?f.num:t.stats[f.ref]+f.num;
    }
  }
}

/* Modo caos: reordena stats, inventarios y habilidades de los vivos. */
function chaosShake(sim,level){
  const p=Math.min(1,level/10); let n=0;
  const max={};
  P.stats.forEach(s=>{let m=10;sim.chars.forEach(c=>{if(hasStat(c,s.id))m=Math.max(m,c.stats[s.id]);});max[s.id]=m;});
  sim.chars.filter(c=>c.alive).forEach(c=>{
    if(Math.random()>=p) return;
    n++;
    Object.keys(c.stats).forEach(id=>{c.stats[id]=Math.floor(Math.random()*(max[id]+1));});
    c.items=new Set();
    shuffle(P.items.slice()).forEach(it=>{if(Math.random()<0.5&&slotsFree(c)>=it.size)c.items.add(it.id);});
    c.skills=new Set(P.skills.filter(()=>Math.random()<0.4).map(s=>s.id));
  });
  return n;
}

function playDay(sim,opts){
  if(sim.over) return;
  opts=opts||{};
  sim.day++;
  const used=new Set(), entries=[];
  let chaos=null;
  if(opts.chaos>0) chaos={shaken:chaosShake(sim,opts.chaos),wild:0};
  const wild=opts.chaos>0?Math.min(0.7,opts.chaos*0.07):0;
  const order=shuffle(sim.chars.filter(c=>c.alive));
  for(const actor of order){
    if(!actor.alive||used.has(actor.id)) continue;
    const ignore=wild>0&&Math.random()<wild;
    const cands=[];
    for(const e of P.events){
      if(!e.text.trim()) continue;
      const as=pickAssignment(e,actor,sim,used,ignore);
      if(as) cands.push({e,as,w:Math.max(1,e.weight|0)});
    }
    if(!cands.length){
      used.add(actor.id);
      entries.push({html:fmt(P.fallback,{X:actor}),who:[{c:actor,src:lookSrc(actor,'')}],deaths:[],notes:[]});
      continue;
    }
    let r=Math.random()*cands.reduce((a,c)=>a+c.w,0), pick=cands[cands.length-1];
    for(const c of cands){ r-=c.w; if(r<0){pick=c;break;} }
    const {e,as}=pick;
    if(ignore&&chaos) chaos.wild++;
    Object.keys(as).forEach(k=>used.add(as[k].id));
    const entry={html:fmt(e.text,as),who:Object.keys(as).map(k=>({c:as[k],src:lookSrc(as[k],roleLook(e,k))})),deaths:[],notes:[]};
    applyFx(e,as,actor,sim,entry);
    entries.push(entry);
  }
  const alive=sim.chars.filter(c=>c.alive).length;
  sim.days.push({n:sim.day,entries,alive,chaos});
  if(alive<=1) sim.over=true;
}

const nameOf=(arr,id)=>{const x=arr.find(i=>i.id===id);return x?(x.name||'Sin nombre'):'';};
