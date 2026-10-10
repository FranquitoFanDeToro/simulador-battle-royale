'use strict';
/* =====================================================================
   NÚCLEO: modelo de datos y motor de la simulación.
   No toca la pantalla. Todo lo que el usuario crea vive en el objeto P:

   P = {
     v: 4,
     stats:    [{id, name, def}]                     catálogo de stats
     items:    [{id, name, size, cat}]               objetos (size = espacio que ocupan)
     skills:   [{id, name, cat}]                     habilidades
     emotions: [{id, name, icon, days}]              emociones (days: se pasa sola; 0 = no)
     states:   [{id, name, icon, days, canAct, text,  estados alterados (quemadura, veneno…)
                 mods:[{stat, mode:'add'|'mult', num}],     cambian stats mientras dura
                 daily:[{k:'stat'|'loyalty'|'kill', ref, mode, num, pct}]}]  efectos de cada día
     chars:    [{id, name, gender, enabled, slots,   personajes
                 imgs:[{id, kind:'file'|'url'|'data', src, tag}],
                 items:[ids], skills:[ids], stats:{statId: número},
                 loy: 0-100, emotion: id|'', states:[ids]}]
     teams:    [{id, name, leader, members:[ids], share}]   equipos que existen desde el día 1
     words:    {nouns:[{id,text,num,gen}], adjs:[...]}      vocabulario del generador de nombres
     teamPresets: [texto]                            nombres de equipo preestablecidos
     events:   [{id, text, weight, roles:[{n, req, look}],
                 cond:{...árbol de reglas...}, fx:[efectos],
                 chance:{mode, pct, stat}, failText, fxFail:[efectos]}]
   }
   ===================================================================== */

const uid=()=>Math.random().toString(36).slice(2,9);
const esc=s=>String(s==null?'':s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));

const GEN={f:'Femenino',m:'Masculino',o:'Otro'};
const ROLE_NAMES=['X','Y','Z','W'];
const KINDS=['item','space','skill','gender','status','hasstat','stat','statvs','emotion','loyalty','inteam','isleader','sameteam','teamsize','teamitem','is','state','anystate'];
const NOVAL=['inteam','isleader','sameteam','teamsize','loyalty','anystate'];   // reglas que no eligen un valor de una lista
const CMP=['>=','>','<=','<','=','!='];
const CMP_LBL={'>=':'≥','>':'>','<=':'≤','<':'<','=':'=','!=':'≠'};
const FX={
  kill:{label:'Elimina a',ref:null,prep:''},
  giveItem:{label:'Entrega el objeto',ref:'items',prep:'a'},
  removeItem:{label:'Quita el objeto',ref:'items',prep:'de'},
  giveSkill:{label:'Otorga la habilidad',ref:'skills',prep:'a'},
  removeSkill:{label:'Quita la habilidad',ref:'skills',prep:'de'},
  stat:{label:'Cambia la stat',ref:'stats',prep:'de'},
  emotion:{label:'Cambia la emoción a',ref:'emotions',prep:'de'},
  emotionClear:{label:'Quita la emoción',ref:null,prep:'de'},
  loyalty:{label:'Cambia la lealtad',ref:null,prep:'de'},
  teamForm:{label:'Forma un equipo',ref:null,prep:''},
  teamJoin:{label:'Incorpora a un equipo',ref:null,prep:''},
  teamLeave:{label:'Saca del equipo a',ref:null,prep:''},
  teamShare:{label:'Inventario compartido',ref:null,prep:''},
  teamTake:{label:'Toma del equipo el objeto',ref:'items',prep:'para'},
  addState:{label:'Aplica el estado',ref:'states',prep:'a'},
  removeState:{label:'Quita el estado',ref:'states',prep:'de'},
  clearStates:{label:'Quita todos los estados',ref:null,prep:'de'}
};
const TEAM_FX=['teamForm','teamJoin'];     // efectos que necesitan un segundo participante (campo «by»)
const CHANCE_MODES=['always','fixed','stat','team','loyalty'];
const CHANCE_LBL={
  always:'Siempre ocurre tal cual',
  fixed:'Probabilidad fija',
  stat:'Según una stat de X contra Y',
  team:'Según el tamaño del equipo de X contra el de Y',
  loyalty:'Según la lealtad de X (menos lealtad, más probabilidad)'
};
const DEFAULT_SLOTS=5;
let P=null;
let CURSIM=null;   // simulación en curso: las reglas de equipo la consultan

const emptyCond=()=>({t:'g',op:'and',c:[]});
const safeUrl=s=>/^(https?:\/\/|data:image\/)/i.test(String(s||''));

/* ---------- Proyecto de ejemplo ---------- */
function sampleProject(){
  const R=(role,kind,val,neg,extra)=>Object.assign({t:'r',neg:!!neg,role,kind,val:val||'',op:'>=',num:1,role2:'Y'},extra||{});
  const G=(op,...c)=>({t:'g',op,c});
  const I={cu:'it_cuchillo',ar:'it_arco',bo:'it_botiquin'};
  const K={si:'sk_sigilo',pu:'sk_punteria',au:'sk_auxilios'};
  const T={fu:'st_fuerza',ag:'st_agilidad',ing:'st_ingenio'};
  const M={mi:'em_miedo',fu:'em_furia',ca:'em_calma',tr:'em_tristeza'};
  const A={qu:'sa_quemado',ve:'sa_veneno',at:'sa_aturdido'};   // estados alterados
  const C=(name,gender,items,skills,stats,loy)=>({id:uid(),name,gender,enabled:true,slots:4,imgs:[],items:items||[],skills:skills||[],stats:stats||{},loy:loy==null?50:loy,emotion:'',states:[]});
  const rl=(n,req)=>({n:n,req:req||'alive',look:''});
  const FXD=f=>Object.assign({k:'kill',role:'X',ref:'',by:'',mode:'add',num:1,nm:'any'},f);
  const E=(text,weight,roles,cond,fx,extra)=>Object.assign({
    id:uid(),text,weight,roles,cond:cond||emptyCond(),fx:(fx||[]).map(FXD),
    chance:{mode:'always',pct:50,stat:''},failText:'',fxFail:[]
  },extra||{},{fxFail:((extra&&extra.fxFail)||[]).map(FXD)});
  const X=rl('X'), Y=rl('Y');
  const NM=()=>R('X','sameteam','',true,{role2:'Y'});      // «X no es del mismo equipo que Y»
  const MATES=()=>R('X','sameteam','',false,{role2:'Y'});  // «X es del mismo equipo que Y»
  const proj={
    v:4,
    fallback:'{X} pasó el día sin novedades.',
    emotions:[
      {id:M.mi,name:'Miedo',icon:'😨',days:2},
      {id:M.fu,name:'Furia',icon:'😡',days:2},
      {id:M.ca,name:'Calma',icon:'🙂',days:0},
      {id:M.tr,name:'Tristeza',icon:'😢',days:3}
    ],
    states:[
      {id:A.qu,name:'Quemado',icon:'🔥',days:3,canAct:true,text:'{X} sufre por las quemaduras.',
        mods:[{stat:T.ag,mode:'add',num:-2}],daily:[{k:'stat',ref:T.fu,mode:'add',num:-1,pct:60}]},
      {id:A.ve,name:'Envenenado',icon:'☠️',days:4,canAct:true,text:'{X} se retuerce por el veneno.',
        mods:[{stat:T.fu,mode:'mult',num:0.5}],daily:[{k:'kill',ref:'',mode:'add',num:1,pct:12}]},
      {id:A.at,name:'Aturdido',icon:'💫',days:1,canAct:false,text:'',
        mods:[{stat:T.ag,mode:'mult',num:0.5}],daily:[]}
    ],
    words:{
      nouns:[
        {id:'wn1',text:'Guardianes',num:'p',gen:'m'},{id:'wn2',text:'Lobos',num:'p',gen:'m'},
        {id:'wn3',text:'Sombras',num:'p',gen:'f'},{id:'wn4',text:'Cuervos',num:'p',gen:'m'},
        {id:'wn5',text:'Llama',num:'s',gen:'f'},{id:'wn6',text:'Torre',num:'s',gen:'f'},
        {id:'wn7',text:'Aceite',num:'s',gen:'m'}
      ],
      adjs:[
        {id:'wa1',text:'Rojos',num:'p',gen:'m'},{id:'wa2',text:'Silenciosas',num:'p',gen:'f'},
        {id:'wa3',text:'Primordial',num:'s',gen:'x'},{id:'wa4',text:'Negra',num:'s',gen:'f'},
        {id:'wa5',text:'Valientes',num:'p',gen:'x'}
      ]
    },
    teamPresets:['Alianza del Norte','Los Supervivientes'],
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
      C('Joaquín','m',[I.ar],[K.pu],{[T.fu]:5,[T.ag]:6},30),
      C('Sofía','f',[I.bo],[],{[T.ing]:6}),
      C('Bruno','m',[],[],{},35)
    ],
    events:[
      E('{X} encontró un cuchillo entre unos arbustos.',3,[X],G('and',R('X','item',I.cu,true),R('X','space',I.cu)),[{k:'giveItem',role:'X',ref:I.cu}]),
      E('{X} apuñaló a {Y} hasta la muerte.',3,[X,Y],G('and',R('X','item',I.cu),NM()),[{k:'kill',role:'Y'}]),
      E('{X} encontró un arco abandonado.',2,[X],G('and',R('X','item',I.ar,true),R('X','space',I.ar)),[{k:'giveItem',role:'X',ref:I.ar}]),
      E('{X} le disparó una flecha a {Y} desde lejos.',3,[X,Y],G('and',R('X','item',I.ar),NM(),G('or',R('X','skill',K.pu),R('Y','skill',K.si,true))),[{k:'kill',role:'Y'}]),
      E('{X} encontró un botiquín.',2,[X],G('and',R('X','item',I.bo,true),R('X','space',I.bo)),[{k:'giveItem',role:'X',ref:I.bo}]),
      E('{X} usó el botiquín para curarse las heridas.',2,[X],G('and',R('X','item',I.bo)),[{k:'removeItem',role:'X',ref:I.bo}]),
      E('{X} curó las heridas de {Y} y se ganó su confianza.',2,[X,Y],G('and',R('X','item',I.bo),R('X','skill',K.au)),[{k:'removeItem',role:'X',ref:I.bo}]),
      E('{X} le robó el cuchillo a {Y} mientras dormía.',3,[X,Y],G('and',R('Y','item',I.cu),R('X','item',I.cu,true),R('X','skill',K.si),R('X','space',I.cu),NM()),[{k:'removeItem',role:'Y',ref:I.cu},{k:'giveItem',role:'X',ref:I.cu}]),
      E('{X} desarmó a {Y} en un forcejeo y se quedó con su cuchillo.',3,[X,Y],G('and',R('Y','item',I.cu),R('X','item',I.cu,true),R('X','space',I.cu),R('X','statvs',T.fu,false,{op:'>',role2:'Y'}),NM()),[{k:'removeItem',role:'Y',ref:I.cu},{k:'giveItem',role:'X',ref:I.cu}]),
      E('{X} entrenó toda la mañana y ganó fuerza.',2,[X],G('and',R('X','hasstat',T.fu)),[{k:'stat',role:'X',ref:T.fu,mode:'add',num:1}]),
      E('{X} y {Y} compartieron una fogata y hablaron de su casa.',4,[X,Y]),
      E('{X} y {Y} acordaron no atacarse.',2,[X,Y]),
      E('{X} pasó el día escondido en una cueva.',3,[X]),
      E('{X} aprendió a moverse sin hacer ruido.',1,[X],G('and',R('X','skill',K.si,true)),[{k:'giveSkill',role:'X',ref:K.si}]),
      E('{X} se quedó junto al cuerpo de {Y} sin decir nada.',2,[X,rl('Y','dead')]),
      E('{X} se resbaló en un barranco y no pudo salir.',1,[X],emptyCond(),[{k:'kill',role:'X'}]),
      /* ---- equipos, lealtad y emociones ---- */
      E('{X} le propuso una alianza a {Y} y formaron un equipo.',2,[X,Y],G('and',R('X','inteam','',true),R('Y','inteam','',true)),[{k:'teamForm',role:'X',by:'Y',nm:'any',num:1}]),
      E('{X} invitó a {Y} a unirse a su equipo.',2,[X,Y],G('and',R('X','inteam'),R('Y','inteam','',true)),[{k:'teamJoin',role:'Y',by:'X'}]),
      E('{X} compartió su comida con {Y} y su lealtad creció.',2,[X,Y],G('and',MATES()),[{k:'loyalty',role:'Y',mode:'add',num:10},{k:'emotion',role:'Y',ref:M.ca}]),
      E('{X} discutió con {Y} por cómo repartir las provisiones.',2,[X,Y],G('and',MATES()),[{k:'loyalty',role:'X',mode:'add',num:-12},{k:'emotion',role:'X',ref:M.fu}]),
      E('{X} propuso poner todas las cosas del equipo en común.',1,[X],G('and',R('X','isleader')),[{k:'teamShare',role:'X',num:1}]),
      E('{X} tomó el cuchillo que guardaba el equipo.',2,[X],G('and',R('X','teamitem',I.cu),R('X','item',I.cu,true),R('X','space',I.cu)),[{k:'teamTake',role:'X',ref:I.cu}]),
      E('{X} traicionó a {Y} y lo dejó sin vida.',2,[X,Y],G('and',MATES(),R('X','loyalty','',false,{op:'<=',num:40})),[{k:'kill',role:'Y'},{k:'teamLeave',role:'X'}],
        {chance:{mode:'loyalty',pct:50,stat:''},failText:'{X} pensó en traicionar a {Y}, pero no se atrevió.',fxFail:[{k:'loyalty',role:'X',mode:'add',num:5}]}),
      E('{X} abandonó el equipo, harto de las discusiones.',1,[X],G('and',R('X','inteam'),R('X','loyalty','',false,{op:'<=',num:30})),[{k:'teamLeave',role:'X'},{k:'emotion',role:'X',ref:M.fu}]),
      E('{X} y su equipo emboscaron a {Y} en el bosque.',2,[X,Y],G('and',R('X','inteam'),NM()),[{k:'kill',role:'Y'}],
        {chance:{mode:'team',pct:50,stat:''},failText:'{Y} esquivó la emboscada de {X} y escapó.',fxFail:[{k:'emotion',role:'X',ref:M.mi}]}),
      E('{X} se asustó al oír pasos cerca.',2,[X],emptyCond(),[{k:'emotion',role:'X',ref:M.mi}]),
      E('{X} se sintió muy triste frente al cuerpo de {Y}.',2,[X,rl('Y','dead')],emptyCond(),[{k:'emotion',role:'X',ref:M.tr}]),
      /* ---- estados alterados ---- */
      E('{X} dejó una fogata mal apagada y se quemó al pisarla.',2,[X],G('and',R('X','state',A.qu,true)),[{k:'addState',role:'X',ref:A.qu}]),
      E('{X} se arrojó al río para apagar las llamas.',3,[X],G('and',R('X','state',A.qu)),[{k:'removeState',role:'X',ref:A.qu}]),
      E('{X} no resistió las quemaduras y murió.',3,[X],G('and',R('X','state',A.qu),R('X','hasstat',T.fu),R('X','stat',T.fu,false,{op:'<=',num:3})),[{k:'kill',role:'X',by:'none'}],
        {chance:{mode:'fixed',pct:60,stat:''},failText:'{X} aguantó las quemaduras un día más.'}),
      E('{X} untó su cuchillo con veneno y le hizo un corte a {Y}.',2,[X,Y],G('and',R('X','item',I.cu),NM(),R('Y','state',A.ve,true)),[{k:'addState',role:'Y',ref:A.ve}]),
      E('{X} usó el botiquín para curarse todo lo que lo aquejaba.',3,[X],G('and',R('X','item',I.bo),R('X','anystate')),[{k:'removeItem',role:'X',ref:I.bo},{k:'clearStates',role:'X'}]),
      E('{X} se golpeó la cabeza con una rama baja y quedó aturdido.',2,[X],G('and',R('X','state',A.at,true)),[{k:'addState',role:'X',ref:A.at}])
    ]
  };
  /* un equipo ya armado desde el día 1: Mateo (líder) y Joaquín */
  const mateo=proj.chars.find(c=>c.name==='Mateo'),joaquin=proj.chars.find(c=>c.name==='Joaquín');
  /* un evento solo para un personaje: la regla «es el personaje» */
  const vale=proj.chars.find(c=>c.name==='Valeria');
  proj.events.push(E('{X} sintió que alguien la observaba entre los árboles.',3,[X],G('and',R('X','is',vale.id)),[{k:'emotion',role:'X',ref:M.mi}]));
  proj.teams=[{id:'tm_lobos',name:'Los Lobos',leader:mateo.id,members:[mateo.id,joaquin.id],share:false}];
  return proj;
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
  const normFx=l=>arr(l).filter(f=>f&&FX[f.k]).map(f=>({
    k:f.k,role:String(f.role||'X'),ref:f.ref?String(f.ref):'',by:String(f.by||''),
    mode:f.mode==='set'?'set':'add',num:num(f.num,1),nm:['gen','preset','any'].includes(f.nm)?f.nm:'any'
  }));
  const o={v:4,stats:[],items:[],skills:[],emotions:[],states:[],chars:[],teams:[],words:{nouns:[],adjs:[]},teamPresets:[],events:[],fallback:'{X} pasó el día sin novedades.'};
  o.stats=arr(p.stats).filter(i=>i&&i.id).map(i=>({id:String(i.id),name:String(i.name||''),def:num(i.def,5)}));
  o.items=arr(p.items).filter(i=>i&&i.id).map(i=>({id:String(i.id),name:String(i.name||''),size:Math.max(0,Math.floor(num(i.size,1))),cat:String(i.cat||'')}));
  o.skills=arr(p.skills).filter(i=>i&&i.id).map(i=>({id:String(i.id),name:String(i.name||''),cat:String(i.cat||'')}));
  o.emotions=arr(p.emotions).filter(i=>i&&i.id).map(i=>({id:String(i.id),name:String(i.name||''),icon:String(i.icon||'').slice(0,8),days:Math.max(0,Math.floor(num(i.days,0)))}));
  o.states=arr(p.states).filter(i=>i&&i.id).map(i=>({
    id:String(i.id),name:String(i.name||''),icon:String(i.icon||'').slice(0,8),days:Math.max(0,Math.floor(num(i.days,0))),
    canAct:i.canAct!==false,text:String(i.text||''),
    mods:arr(i.mods).filter(m=>m&&m.stat).map(m=>({stat:String(m.stat),mode:m.mode==='mult'?'mult':'add',num:num(m.num,m.mode==='mult'?1:0)})),
    daily:arr(i.daily).filter(d=>d&&['stat','loyalty','kill'].includes(d.k)).map(d=>({
      k:d.k,ref:d.ref?String(d.ref):'',mode:d.mode==='set'?'set':'add',num:num(d.num,d.k==='kill'?1:-1),pct:Math.min(100,Math.max(0,num(d.pct,100)))
    }))
  }));
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
      items:arr(c.items).map(String),skills:arr(c.skills).map(String),stats,
      loy:Math.min(100,Math.max(0,num(c.loy,50))),
      emotion:o.emotions.some(m=>m.id===String(c.emotion||''))?String(c.emotion):'',
      states:[...new Set(arr(c.states).map(String))].filter(id=>o.states.some(s=>s.id===id))
    };
  });
  /* equipos: cada personaje en un solo equipo, y el líder tiene que ser miembro */
  const taken=new Set();
  o.teams=arr(p.teams).filter(t=>t&&t.id).map(t=>{
    const members=arr(t.members).map(String).filter(id=>o.chars.some(c=>c.id===id)&&!taken.has(id)&&taken.add(id));
    return {id:String(t.id),name:String(t.name||''),leader:members.includes(String(t.leader||''))?String(t.leader):'',members,share:!!t.share};
  });
  const normWords=l=>arr(l).filter(w=>w&&w.id&&String(w.text||'').trim()).map(w=>({
    id:String(w.id),text:String(w.text).trim(),num:w.num==='p'?'p':'s',gen:w.gen==='f'?'f':(w.gen==='x'?'x':'m')
  }));
  o.words={nouns:normWords(p.words&&p.words.nouns),adjs:normWords(p.words&&p.words.adjs)};
  o.teamPresets=arr(p.teamPresets).map(s=>String(s).trim()).filter(Boolean);
  o.events=arr(p.events).filter(e=>e&&e.id).map(e=>{
    const cond=normCond(e.cond);
    const ch=(e.chance&&typeof e.chance==='object')?e.chance:{};
    return {
      id:String(e.id),text:String(e.text||''),
      weight:Math.min(10,Math.max(1,parseInt(e.weight,10)||3)),
      roles:normRoles(e.roles),
      cond:(cond&&cond.t==='g')?cond:emptyCond(),
      fx:normFx(e.fx),
      chance:{
        mode:CHANCE_MODES.includes(ch.mode)?ch.mode:'always',
        pct:Math.min(100,Math.max(0,num(ch.pct,50))),stat:String(ch.stat||'')
      },
      failText:String(e.failText||''),
      fxFail:normFx(e.fxFail)
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
/* Valor efectivo de una stat: la base más lo que suman o multiplican los estados alterados que tenga.
   Una stat que el personaje no tiene vale 0 y ningún estado se la da. */
function effStat(ch,id){
  const base=ch.stats[id];
  if(!ch.states||!ch.states.length) return base;
  let add=0,mul=1,hit=false;
  ch.states.forEach(x=>{
    const def=stateDef(typeof x==='string'?x:x.id);
    if(def) def.mods.forEach(m=>{if(m.stat===id){hit=true;if(m.mode==='mult')mul*=m.num;else add+=m.num;}});
  });
  return hit?Math.max(0,(base+add)*mul):base;
}
const statVal=(ch,id)=>hasStat(ch,id)?effStat(ch,id):0;   // una stat que no se tiene vale 0
const stateDef=id=>P.states.find(s=>s.id===id)||null;
const stateName=id=>{const s=stateDef(id);return s?(s.name||'Sin nombre'):'';};
const hasState=(ch,id)=>!!id&&(ch.states||[]).some(x=>(typeof x==='string'?x:x.id)===id);
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
    case 'emotion': v=!!n.val&&ch.emotion===n.val; break;
    case 'loyalty': v=cmp(ch.loy,n.op,n.num); break;
    case 'inteam': v=!!teamOf(ch); break;
    case 'isleader': {const t=teamOf(ch);v=!!t&&t.leader===ch.id;break;}
    case 'sameteam': {const c2=as[n.role2];v=!!c2&&!!ch.team&&ch.team===c2.team;break;}
    case 'teamsize': {const t=teamOf(ch);v=cmp(t?t.members.length:0,n.op,n.num);break;}
    case 'teamitem': v=!!n.val&&hasItemOrShared(ch,n.val); break;
    case 'is': v=!!n.val&&ch.id===n.val; break;
    case 'state': v=hasState(ch,n.val); break;
    case 'anystate': v=(ch.states||[]).length>0; break;
  }
  return n.neg?!v:v;
}

function newSim(){
  const okIds=(list,ids)=>ids.filter(id=>list.some(i=>i.id===id));
  const sim={
    day:0,over:false,capped:false,days:[],teams:[],teamSeq:0,
    chars:P.chars.filter(c=>c.enabled).map(c=>{
      const stats={};
      Object.keys(c.stats).forEach(id=>{if(P.stats.some(s=>s.id===id))stats[id]=c.stats[id];});
      return {
        id:c.id,name:c.name||'Sin nombre',gender:c.gender,imgs:c.imgs,slots:c.slots,
        items:new Set(okIds(P.items,c.items)),skills:new Set(okIds(P.skills,c.skills)),stats,
        loy:c.loy,emotion:c.emotion,emoDay:0,team:null,
        states:okIds(P.states,c.states||[]).map(id=>({id,day:0})),
        alive:true,kills:0,victims:[],killedBy:null,diedDay:null
      };
    })
  };
  /* equipos armados de antemano: solo cuentan los miembros que participan */
  P.teams.forEach(t=>{
    const ids=t.members.filter(id=>sim.chars.some(c=>c.id===id));
    if(!ids.length) return;
    sim.teams.push({id:t.id,name:t.name||teamFallbackName(sim),leader:ids.includes(t.leader)?t.leader:'',members:ids.slice(),share:!!t.share});
    ids.forEach(id=>{sim.chars.find(c=>c.id===id).team=t.id;});
  });
  return sim;
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

/* Aplica una lista de efectos (los de «ocurre» o los de «no sale bien»). */
function applyFx(list,as,actor,sim,entry){
  for(const f of list){
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
      t.states=[];                              // los caídos pierden sus estados
      const lt=removeFromTeam(sim,t);          // los caídos dejan su equipo
      if(lt&&lt.gone) entry.notes.push('El equipo «'+lt.team.name+'» se disolvió.');
    } else if(f.k==='emotion'){
      if(f.ref&&P.emotions.some(m=>m.id===f.ref)){t.emotion=f.ref;t.emoDay=sim.day;}
    } else if(f.k==='emotionClear'){
      t.emotion='';
    } else if(f.k==='loyalty'){
      t.loy=Math.min(100,Math.max(0,f.mode==='set'?f.num:t.loy+f.num));
    } else if(f.k==='teamForm'){
      const o=as[f.by];
      if(!o||o.id===t.id) continue;
      if(t.team||o.team){entry.notes.push('No se formó el equipo: '+(t.team?t.name:o.name)+' ya tenía uno.');continue;}
      const nt=formTeam(sim,t,o,f.nm,f.num>0);
      entry.notes.push('Se formó el equipo «'+nt.name+'»'+(nt.leader?' con '+t.name+' como líder.':'.'));
    } else if(f.k==='teamJoin'){
      const o=as[f.by],team=o?teamOf(o):null;
      if(!o||!team||t.team){entry.notes.push('No se pudo incorporar a '+t.name+(t.team?': ya tiene equipo.':': no hay equipo al que unirse.'));continue;}
      joinTeam(sim,t,team);
      entry.notes.push(t.name+' se unió al equipo «'+team.name+'».');
    } else if(f.k==='teamLeave'){
      const r=removeFromTeam(sim,t);
      if(r) entry.notes.push(t.name+' dejó el equipo «'+r.team.name+'»'+(r.gone?', que se disolvió.':'.'));
    } else if(f.k==='teamShare'){
      const team=teamOf(t);
      if(!team){entry.notes.push(t.name+' no tiene equipo: no hay inventario que compartir.');continue;}
      team.share=f.num>0;
      entry.notes.push(team.share?'El equipo «'+team.name+'» comparte su inventario.':'El equipo «'+team.name+'» dejó de compartir su inventario.');
    } else if(f.k==='teamTake'&&f.ref){
      const team=teamOf(t);
      const giver=team&&team.share?teamMates(team).find(m=>m.id!==t.id&&m.items.has(f.ref)):null;
      if(!giver){entry.notes.push('El equipo no tenía el objeto '+nameOf(P.items,f.ref)+' para compartir.');continue;}
      if(t.items.has(f.ref)) continue;
      if(slotsFree(t)<sizeOf(f.ref)){entry.notes.push(t.name+' no tenía espacio para '+nameOf(P.items,f.ref)+'.');continue;}
      giver.items.delete(f.ref);t.items.add(f.ref);
      entry.notes.push(t.name+' tomó '+nameOf(P.items,f.ref)+' de '+giver.name+'.');
    } else if(f.k==='addState'){
      if(!t.alive||!f.ref||!stateDef(f.ref)) continue;
      const ex=t.states.find(x=>x.id===f.ref);
      if(ex){ex.day=sim.day;entry.notes.push(t.name+' ya estaba «'+stateName(f.ref)+'»: el estado se renueva.');}
      else{t.states.push({id:f.ref,day:sim.day});entry.notes.push(t.name+' quedó «'+stateName(f.ref)+'».');}
    } else if(f.k==='removeState'){
      const i=t.states.findIndex(x=>x.id===f.ref);
      if(i>=0){t.states.splice(i,1);entry.notes.push(t.name+' ya no está «'+stateName(f.ref)+'».');}
    } else if(f.k==='clearStates'){
      if(t.states.length){entry.notes.push(t.name+' se libró de '+t.states.map(x=>'«'+stateName(x.id)+'»').join(', ')+'.');t.states=[];}
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
    c.loy=Math.floor(Math.random()*101);
    c.states=P.states.filter(()=>Math.random()<0.2).map(x=>({id:x.id,day:sim.day}));
    if(P.emotions.length&&Math.random()<0.6){c.emotion=P.emotions[Math.floor(Math.random()*P.emotions.length)].id;c.emoDay=sim.day;}
  });
  return n;
}

/* Probabilidad (0 a 1) de que el evento «salga bien» según su modo. */
function successChance(e,as){
  const c=e.chance;
  if(!c||c.mode==='always') return 1;
  const A=as[e.roles[0].n],B=e.roles[1]?as[e.roles[1].n]:null;
  switch(c.mode){
    case 'fixed': return Math.min(1,Math.max(0,c.pct/100));
    case 'stat': {
      if(!B||!c.stat) return 0.5;
      const a=Math.max(0,statVal(A,c.stat)),b=Math.max(0,statVal(B,c.stat));
      return a+b>0?a/(a+b):0.5;
    }
    case 'team': {
      if(!B) return 0.5;
      const a=Math.max(1,teamSizeOf(A)),b=Math.max(1,teamSizeOf(B));   // sin equipo cuenta como uno solo
      return a/(a+b);
    }
    case 'loyalty': return Math.min(1,Math.max(0,1-A.loy/100));
  }
  return 1;
}

/* Estados alterados al empezar un día: los que ya cumplieron su duración se van y los demás
   hacen sus efectos diarios (con su probabilidad). Un estado de N días actúa los N días siguientes
   a aquel en que se aplicó. Cada vez que algo pasa queda una línea en el registro. */
const round2=x=>Math.round(x*100)/100;
function tickStates(sim,entries){
  const mk=c=>({html:'',who:[{c,src:lookFor(c,'')}],deaths:[],notes:[],chance:null});
  sim.chars.filter(c=>c.alive).forEach(c=>{
    c.states.slice().forEach(st=>{
      if(!c.alive||!c.states.includes(st)) return;
      const def=stateDef(st.id);
      if(!def){c.states=c.states.filter(x=>x!==st);return;}
      if(def.days>0&&sim.day-st.day>def.days){
        c.states=c.states.filter(x=>x!==st);
        const en=mk(c);en.html=fmt('{X} se recuperó de «'+def.name+'».',{X:c});entries.push(en);
        return;
      }
      if(sim.day<=st.day||!def.daily.length) return;
      const en=mk(c);let did=false,died=false;
      for(const d of def.daily){
        if(!c.alive) break;
        if(d.pct<100&&Math.random()*100>=d.pct) continue;
        if(d.k==='kill'){applyFx([{k:'kill',role:'X',by:'none'}],{X:c},c,sim,en);did=died=true;}
        else if(d.k==='stat'){
          if(!d.ref||!hasStat(c,d.ref)) continue;
          const b=c.stats[d.ref];c.stats[d.ref]=d.mode==='set'?d.num:b+d.num;
          en.notes.push(nameOf(P.stats,d.ref)+': '+round2(b)+' → '+round2(c.stats[d.ref])+'.');did=true;
        } else if(d.k==='loyalty'){
          const b=c.loy;c.loy=Math.min(100,Math.max(0,d.mode==='set'?d.num:b+d.num));
          en.notes.push('Lealtad: '+round2(b)+' → '+round2(c.loy)+'.');did=true;
        }
      }
      if(did){
        en.html=fmt(died?'{X} murió por «'+def.name+'».':(def.text.trim()||'{X} sufre por «'+def.name+'».'),{X:c});
        entries.push(en);
      }
    });
  });
}

function playDay(sim,opts){
  if(sim.over) return;
  opts=opts||{};
  CURSIM=sim;
  sim.day++;
  /* las emociones con duración se pasan solas */
  sim.chars.forEach(c=>{
    if(!c.alive||!c.emotion) return;
    const d=emoDays(c.emotion);
    if(d>0&&sim.day-c.emoDay>=d) c.emotion='';
  });
  const used=new Set(), entries=[];
  tickStates(sim,entries);
  let chaos=null;
  if(opts.chaos>0) chaos={shaken:chaosShake(sim,opts.chaos),wild:0};
  const wild=opts.chaos>0?Math.min(0.7,opts.chaos*0.07):0;
  const order=shuffle(sim.chars.filter(c=>c.alive));
  for(const actor of order){
    if(!actor.alive||used.has(actor.id)) continue;
    /* un estado puede impedir que el personaje haga algo por su cuenta (sigue pudiendo ser blanco de otros) */
    const blocker=actor.states.map(x=>stateDef(x.id)).find(d=>d&&d.canAct===false);
    if(blocker){
      entries.push({html:fmt('{X} no pudo actuar: está «'+blocker.name+'».',{X:actor}),who:[{c:actor,src:lookFor(actor,'')}],deaths:[],notes:[],chance:null});
      continue;
    }
    const ignore=wild>0&&Math.random()<wild;
    const cands=[];
    for(const e of P.events){
      if(!e.text.trim()) continue;
      const as=pickAssignment(e,actor,sim,used,ignore);
      if(as) cands.push({e,as,w:Math.max(1,e.weight|0)});
    }
    if(!cands.length){
      used.add(actor.id);
      entries.push({html:fmt(P.fallback,{X:actor}),who:[{c:actor,src:lookFor(actor,'')}],deaths:[],notes:[],chance:null});
      continue;
    }
    let r=Math.random()*cands.reduce((a,c)=>a+c.w,0), pick=cands[cands.length-1];
    for(const c of cands){ r-=c.w; if(r<0){pick=c;break;} }
    const {e,as}=pick;
    if(ignore&&chaos) chaos.wild++;
    Object.keys(as).forEach(k=>used.add(as[k].id));
    /* ¿sale bien o mal? (si el evento no tiene probabilidad, siempre sale como está escrito) */
    const p=successChance(e,as);
    const ok=p>=1||Math.random()<p;
    const text=(!ok&&e.failText.trim())?e.failText:e.text;
    const entry={
      html:fmt(text,as),
      who:Object.keys(as).map(k=>({c:as[k],src:lookFor(as[k],roleLook(e,k))})),
      deaths:[],notes:[],chance:(e.chance&&e.chance.mode!=='always')?Math.round(p*100):null
    };
    applyFx(ok?e.fx:e.fxFail,as,actor,sim,entry);
    entries.push(entry);
  }
  const alive=sim.chars.filter(c=>c.alive).length;
  sim.days.push({n:sim.day,entries,alive,chaos});
  if(alive<=1) sim.over=true;
}

const nameOf=(arr,id)=>{const x=arr.find(i=>i.id===id);return x?(x.name||'Sin nombre'):'';};

/* Emociones: duración y nombre (el nombre sirve de etiqueta para elegir la imagen). */
const emoDays=id=>{const m=P.emotions.find(x=>x.id===id);return m?m.days:0;};
const emoName=ch=>ch.emotion?nameOf(P.emotions,ch.emotion):'';
/* Imagen de un personaje en la simulación: la del evento; si no hay, la de su emoción; si no, la principal. */
const lookFor=(ch,tag)=>lookSrc(ch,(tag||'').trim()?tag:emoName(ch));
