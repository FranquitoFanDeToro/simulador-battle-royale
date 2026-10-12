'use strict';
/* =====================================================================
   NÚCLEO: modelo de datos y motor de la simulación.
   No toca la pantalla. Todo lo que el usuario crea vive en el objeto P:

   P = {
     v: 6,
     stats:    [{id, name, def, min, max}]           catálogo de stats (min/max: límite propio; null = sin límite)
     items:    [{id, name, size, cat, icon, img}]    objetos (size = espacio; icon = emoji; img = imagen opcional)
     skills:   [{id, name, cat, icon, img, cd:{mode:'none'|'days'|'once', days}}]          habilidades
     emotions: [{id, name, icon, days}]              emociones (days: se pasa sola; 0 = no)
     states:   [{id, name, icon, cat, days, canAct, text,  estados alterados (quemadura, veneno…)
                 mods:[{stat, mode:'add'|'mult', num}],     cambian stats mientras dura
                 daily:[{k:'stat'|'loyalty'|'kill', ref, mode, num, pct}]}]  efectos de cada día
     chars:    [{id, name, gender, enabled, slots,   personajes
                 imgs:[{id, kind:'file'|'url'|'data', src, tag}],
                 items:[ids], skills:[ids], stats:{statId: número},
                 loy: 0-100, emotion: id|'', states:[ids]}]
     teams:    [{id, name, leader, members:[ids], share}]   equipos que existen desde el día 1
     words:    {nouns:[{id,text,num,gen}], adjs:[...]}      vocabulario del generador de nombres
     teamPresets: [texto]                            nombres de equipo preestablecidos
     events:   [{id, text, weight, roles:[{n, req, look, squad}],     participantes: X, Y, Z, W, A, B… (sin límite)
                 cond:{...árbol de reglas...}, fx:[efectos],
                 chance:{mode, pct, stat, steps:[…]}, failText, fxFail:[efectos],   desenlace «sale bien» / «no sale bien»
                 outs:[{id, name, text, fx, chance}],                    desenlaces extra, cada uno con su probabilidad
                 vars:[{n:'Objeto1', kind:'item'|'skill'|'state'|'team',   elementos que el evento elige solo:
                        src:'of'|'any'|'list', role, has:[roles], lacks:[roles],
                        cats:[categorías], ids:[elegidos a mano], excl, size, leader}]}]
   }
   Condiciones: una regla puede aplicarse a varios participantes (role + more, q='all'|'any') y un grupo
   puede ser «mix»: sus hijos se unen con Y u O (child.j) y la Y se resuelve antes que la O.
   Efectos: casi todos pueden afectar a varios participantes a la vez (role + more).
   ===================================================================== */

const uid=()=>Math.random().toString(36).slice(2,9);
const esc=s=>String(s==null?'':s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));

const GEN={f:'Femenino',m:'Masculino',o:'Otro'};
/* Los participantes de un evento se llaman X, Y, Z, W, A, B… (26 nombres); pasado ese punto siguen X1, Y1… */
const ROLE_ORDER='XYZWABCDEFGHIJKLMNOPQRSTUV';
const roleName=i=>i<26?ROLE_ORDER[i]:ROLE_ORDER[i%26]+Math.floor(i/26);
const ROLE_RE=/^[A-Z][0-9]*$/;
const MAX_ROLES=500;
function nextRoleName(roles){
  const used=new Set(roles.map(r=>r.n));
  for(let i=0;i<MAX_ROLES;i++) if(!used.has(roleName(i))) return roleName(i);
  return roleName(roles.length);
}
const KINDS=['item','space','skill','skillready','gender','status','hasstat','stat','statvs','emotion','loyalty','inteam','isleader','sameteam','teamsize','teamitem','slotsize','scene','samescene','linkedscene','scenecount','sceneexit','linkedto','inteamof','is','state','anystate'];
const NOVAL=['inteam','isleader','sameteam','teamsize','loyalty','anystate','slotsize','samescene','linkedscene','scenecount','sceneexit'];   // reglas que no eligen un valor de una lista
const CMP=['>=','>','<=','<','=','!='];
const CMP_LBL={'>=':'≥','>':'>','<=':'≤','<':'<','=':'=','!=':'≠'};
const FX={
  kill:{label:'Elimina a',ref:null,prep:''},
  giveItem:{label:'Entrega el objeto',ref:'items',prep:'a'},
  removeItem:{label:'Quita el objeto',ref:'items',prep:'de'},
  giveSkill:{label:'Otorga la habilidad',ref:'skills',prep:'a'},
  removeSkill:{label:'Quita la habilidad',ref:'skills',prep:'de'},
  useSkill:{label:'Marca como usada la habilidad',ref:'skills',prep:'de'},
  stat:{label:'Cambia la stat',ref:'stats',prep:'de'},
  slots:{label:'Cambia el espacio del inventario',ref:null,prep:'de'},
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
  clearStates:{label:'Quita todos los estados',ref:null,prep:'de'},
  moveItem:{label:'Pasa un objeto',ref:'items',prep:''},
  swapItems:{label:'Intercambia objetos',ref:'items',prep:''},
  moveScene:{label:'Lleva al escenario',ref:'scenes',prep:'a'},
  moveSceneRandom:{label:'Lleva a un escenario al azar',ref:null,prep:''},
  moveSceneLinked:{label:'Lleva a un escenario conectado',ref:null,prep:''},
  moveSceneWith:{label:'Lleva al escenario de otro participante',ref:null,prep:''},
  joinTeam:{label:'Incorpora al equipo',ref:'@team',prep:'a'},
  killTeam:{label:'Elimina a todo un equipo',ref:'@team',prep:''},
  teamFight:{label:'Dos equipos pelean hasta la muerte',ref:'@team',prep:''}
};
/* Elementos de un evento: cosas que el evento elige solo al ocurrir y a las que puede referirse
   en el texto ({Objeto1}) y en los efectos. */
const VAR_KINDS={item:{pre:'Objeto',lbl:'Objeto'},skill:{pre:'Habilidad',lbl:'Habilidad'},state:{pre:'Estado',lbl:'Estado alterado'},team:{pre:'Equipo',lbl:'Equipo'},scene:{pre:'Escenario',lbl:'Escenario'}};
const VAR_NAME_RE=/^[A-Za-zÁÉÍÓÚÑáéíóúñ]{2,}\d+$/;
const TOKEN_RE=/\{([A-Z]\d*|[A-Za-zÁÉÍÓÚÑáéíóúñ]{2,}\d+)\}/g;
const VAR_SRC=['of','any','list','near'];   // near: solo escenarios (uno conectado con el de un participante)
function nextVarName(list,kind){
  const pre=VAR_KINDS[kind].pre;let k=1;
  while(list.some(v=>v.n===pre+k)) k++;
  return pre+k;
}
const TEAM_FX=['teamForm','teamJoin','moveItem','swapItems','moveSceneWith'];     // efectos que necesitan un segundo participante (campo «by»)
const CHANCE_MODES=['always','fixed','stat','team','loyalty','calc'];
/* Efectos que se pueden aplicar a todo un equipo (campo «tgt»: 'team' = el equipo del participante, '@Equipo1' = un equipo del evento). */
const GROUP_FX=['kill','giveItem','removeItem','giveSkill','removeSkill','useSkill','stat','slots','emotion','emotionClear','loyalty','addState','removeState','clearStates'];
const MULTI_FX=['kill','giveItem','removeItem','giveSkill','removeSkill','useSkill','stat','slots','emotion','emotionClear','loyalty','teamJoin','teamLeave','teamShare','teamTake','joinTeam','moveScene','moveSceneRandom','moveSceneLinked','moveSceneWith','addState','removeState','clearStates'];   // efectos que pueden afectar a varios participantes
const CHANCE_LBL={
  always:'Siempre ocurre tal cual',
  fixed:'Probabilidad fija',
  stat:'Según una stat de X contra Y',
  team:'Según el tamaño del equipo de X contra el de Y',
  loyalty:'Según la lealtad de X (menos lealtad, más probabilidad)',
  calc:'Calculada con bloques (se evalúan varias cosas)'
};
const STEP_OPS=['add','mult','set'];
const STEP_KINDS=['num','stat','statdiff','loyalty','teamsize','teamdiff'];
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
  const FXD=f=>Object.assign({k:'kill',role:'X',ref:'',ref2:'',by:'',mode:'add',num:1,nm:'any'},f);
  const E=(text,weight,roles,cond,fx,extra)=>Object.assign({
    id:uid(),text,weight,roles,cond:cond||emptyCond(),fx:(fx||[]).map(FXD),
    chance:{mode:'always',pct:50,stat:''},failText:'',fxFail:[],vars:[]
  },extra||{},{fxFail:((extra&&extra.fxFail)||[]).map(FXD)});
  const X=rl('X'), Y=rl('Y');
  const NM=()=>R('X','sameteam','',true,{role2:'Y'});      // «X no es del mismo equipo que Y»
  const MATES=()=>R('X','sameteam','',false,{role2:'Y'});  // «X es del mismo equipo que Y»
  const proj={
    v:7,
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
    scenes:[
      {id:'sc_claro',name:'Claro central',icon:'🏕️',img:null,links:['sc_bosque','sc_playa']},
      {id:'sc_bosque',name:'Bosque espeso',icon:'🌲',img:null,links:['sc_claro','sc_cueva','sc_montana']},
      {id:'sc_playa',name:'Playa',icon:'🏖️',img:null,links:['sc_claro','sc_cueva']},
      {id:'sc_cueva',name:'Cueva húmeda',icon:'🕳️',img:null,links:['sc_bosque','sc_playa']},
      {id:'sc_montana',name:'Montaña',icon:'⛰️',img:null,links:['sc_bosque']}
    ],
    sceneStart:'sc_claro',
    stats:[{id:T.fu,name:'Fuerza',def:5,min:0,max:10},{id:T.ag,name:'Agilidad',def:5,min:0,max:10},{id:T.ing,name:'Ingenio',def:5,min:0,max:10}],
    items:[
      {id:I.cu,name:'Cuchillo',size:1,cat:'Armas',icon:'🔪',img:null},
      {id:I.ar,name:'Arco',size:2,cat:'Armas',icon:'🏹',img:null},
      {id:I.bo,name:'Botiquín',size:1,cat:'Salud',icon:'🩹',img:null}
    ],
    skills:[
      {id:K.si,name:'Sigilo',cat:'Movimiento',icon:'🥷',img:null},
      {id:K.pu,name:'Puntería',cat:'Combate',icon:'🎯',img:null},
      {id:K.au,name:'Primeros auxilios',cat:'Salud',icon:'⛑️',img:null,cd:{mode:'days',days:3}}
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
      E('{X} curó las heridas de {Y} y se ganó su confianza.',2,[X,Y],G('and',R('X','item',I.bo),R('X','skillready',K.au)),[{k:'removeItem',role:'X',ref:I.bo}]),
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
  /* eventos con elementos: el evento elige solo qué objeto, habilidad, estado o equipo es {Objeto1}, {Equipo1}… */
  const V=(n,kind,src,role,lacks)=>({n,kind,src,role:role||'X',lacks:lacks||'',cat:''});
  proj.events.push(
    E('{X} intercambió {Objeto1} por {Objeto2} de {Y}.',2,[X,Y],emptyCond(),
      [{k:'swapItems',role:'X',by:'Y',ref:'@Objeto1',ref2:'@Objeto2'}],
      {vars:[V('Objeto1','item','of','X','Y'),V('Objeto2','item','of','Y','X')]}),
    E('{X} le regaló {Objeto1} a {Y}.',2,[X,Y],G('and',MATES()),
      [{k:'moveItem',role:'X',by:'Y',ref:'@Objeto1'},{k:'loyalty',role:'Y',mode:'add',num:8}],
      {vars:[V('Objeto1','item','of','X','Y')]}),
    E('{X} copió la habilidad {Habilidad1} de {Y}.',2,[X,Y],emptyCond(),
      [{k:'giveSkill',role:'X',ref:'@Habilidad1'}],
      {vars:[V('Habilidad1','skill','of','Y','X')]}),
    E('{X} bebió una sopa extraña y quedó con el estado {Estado1}.',1,[X],emptyCond(),
      [{k:'addState',role:'X',ref:'@Estado1'}],
      {vars:[V('Estado1','state','any')]}),
    E('{Equipo1} y {Equipo2} pelearon hasta la muerte.',1,[X],G('and',R('X','inteam')),
      [{k:'teamFight',role:'X',ref:'@Equipo1',ref2:'@Equipo2'}],
      {vars:[V('Equipo1','team','of','X'),V('Equipo2','team','any')]})
  );
  /* mochilas: el efecto «cambia el espacio del inventario» */
  proj.events.push(E('{X} encontró una mochila resistente y ahora puede cargar más cosas.',2,[X],G('and',R('X','slotsize','',false,{op:'<=',num:5})),[{k:'slots',role:'X',mode:'add',num:3}]));
  /* participantes sin límite, Y/O mezclados, probabilidad con varios factores y más de dos desenlaces */
  const Z=rl('Z');
  proj.events.push(
    E('{X}, {Y} y {Z} sellaron un pacto y formaron un equipo.',2,[X,Y,Z],G('and',R('X','inteam','',true,{more:['Y','Z']})),
      [{k:'teamForm',role:'X',by:'Y',more:['Z'],nm:'any',num:1}]),
    E('{X} cruzó el río sin que nadie lo viera.',2,[X],
      {t:'g',op:'mix',c:[R('X','skill',K.si),R('X','stat',T.ag,false,{op:'>=',num:7,j:'or'}),R('X','state',A.at,true,{j:'and'})]}),
    E('{X} y todo su equipo hicieron guardia durante la noche.',2,[Object.assign(rl('X'),{squad:true})],G('and',R('X','inteam'))),
    E('{X} encontró {Objeto1} entre los restos de un campamento.',2,[X],emptyCond(),
      [{k:'giveItem',role:'X',ref:'@Objeto1'}],
      {vars:[{n:'Objeto1',kind:'item',src:'any',role:'X',lacks:['X'],cats:['Armas']}]}),
    E('{X} cazó una presa pequeña.',2,[X],G('and',R('X','item',I.ar)),[{k:'emotion',role:'X',ref:M.ca}],{
      chance:{mode:'calc',pct:35,stat:'',steps:[
        {id:'st1',cond:G('and',R('X','skill',K.pu)),op:'add',kind:'num',num:25,stat:'',role:'X',role2:'Y'},
        {id:'st2',cond:G('and'),op:'add',kind:'stat',num:3,stat:T.ag,role:'X',role2:'Y'},
        {id:'st3',cond:G('and',R('X','anystate')),op:'mult',kind:'num',num:0.5,stat:'',role:'X',role2:'Y'}
      ]},
      failText:'{X} volvió de la cacería con las manos vacías.',fxFail:[{k:'emotion',role:'X',ref:M.tr}],
      outs:[{id:'out1',name:'Gran cacería',text:'{X} cazó un ciervo enorme y todos hablarán de eso.',
        chance:{mode:'fixed',pct:12,stat:'',steps:[]},fx:[{k:'loyalty',role:'X',mode:'add',num:5},{k:'emotion',role:'X',ref:M.ca}]}]
    })
  );
  /* escenarios: moverse, encontrarse y actuar a distancia */
  proj.events.push(
    E('{X} se internó en {Escenario1}.',4,[X],G('and',R('X','sceneexit')),
      [{k:'moveScene',role:'X',ref:'@Escenario1',num:0}],
      {vars:[{n:'Escenario1',kind:'scene',src:'near',role:'X'}]}),
    E('{X} y {Y} acordaron encontrarse en {Escenario1}.',3,[X,Y],G('and',R('X','samescene','',true,{role2:'Y'})),
      [{k:'moveScene',role:'X',more:['Y'],ref:'@Escenario1',num:0}],
      {vars:[{n:'Escenario1',kind:'scene',src:'any',role:'X'}]}),
    E('{X} le disparó a {Y} con el arco desde otro escenario.',2,[X,Y],G('and',R('X','item',I.ar),R('X','linkedscene','',false,{role2:'Y'}),NM()),[{k:'kill',role:'Y'}]),
    E('{X} se separó de su equipo y se fue a un escenario conectado.',2,[X],G('and',R('X','inteam'),R('X','sceneexit')),[{k:'moveSceneLinked',role:'X',num:0}]),
    E('{X} y todo su equipo se mudaron a otro escenario.',1,[Object.assign(rl('X'),{squad:true})],G('and',R('X','inteam'),R('X','sceneexit')),[{k:'moveSceneLinked',role:'X',num:1}])
  );
  /* los eventos con varios participantes ocurren solo si están en el mismo escenario (salvo los pensados para ser a distancia) */
  proj.events.forEach(e=>{if(e.roles.length>=2&&!/acordaron encontrarse|desde otro escenario/.test(e.text))e.sameScene={all:true,groups:[]};});
  proj.teams=[{id:'tm_lobos',name:'Los Lobos',leader:mateo.id,members:[mateo.id,joaquin.id],share:false}];
  return normalize(proj);
}

/* ---------- Normalizar (también migra proyectos de la versión 1) ---------- */
const roleList=(l,not)=>[...new Set((Array.isArray(l)?l:(l?[l]:[])).map(String).filter(r=>ROLE_RE.test(r)&&r!==not))];   // acepta un solo nombre (formato viejo) o una lista
function normCond(c){
  if(!c||typeof c!=='object') return null;
  const j=c.j==='or'?'or':'and';          // cómo se une a la regla o grupo anterior (solo en grupos «mix»)
  if(c.t==='g'){
    return {t:'g',op:['and','or','not','mix'].includes(c.op)?c.op:'and',j,c:(Array.isArray(c.c)?c.c:[]).map(normCond).filter(Boolean)};
  }
  if(c.t==='r'){
    const n=parseFloat(c.num),role=String(c.role||'X');
    return {
      t:'r',neg:!!c.neg,role,more:roleList(c.more,role),q:c.q==='any'?'any':'all',j,kind:KINDS.includes(c.kind)?c.kind:'item',
      val:c.val==null?'':String(c.val),op:CMP.includes(c.op)?c.op:'>=',num:isFinite(n)?n:1,role2:String(c.role2||'Y')
    };
  }
  return null;
}
function normRoles(r){
  const seen=new Set();
  let out=(Array.isArray(r)?r:[]).filter(x=>x&&ROLE_RE.test(String(x.n))&&!seen.has(x.n)&&seen.add(x.n)).slice(0,MAX_ROLES)
    .map(x=>({n:x.n,req:['alive','dead','any'].includes(x.req)?x.req:'alive',look:String(x.look||''),squad:!!x.squad}));
  if(!out.length) out=[{n:'X',req:'alive',look:'',squad:false}];
  out[0].req='alive';
  return out;
}
/* Qué participantes de un evento tienen que estar en el mismo escenario: todos, o grupos elegidos (cada grupo comparte escenario). */
function normSameScene(v,roles){
  const names=roles.map(r=>r.n);
  const out={all:false,groups:[]};
  if(!v||typeof v!=='object') return out;
  out.all=!!v.all;
  (Array.isArray(v.groups)?v.groups:[]).forEach(g=>{
    const l=[...new Set((Array.isArray(g)?g:[]).map(String))].filter(r=>names.includes(r));
    if(l.length>=2) out.groups.push(l);
  });
  return out;
}
function normalize(p){
  if(!p||typeof p!=='object') return null;
  const arr=a=>Array.isArray(a)?a:[];
  const num=(v,d)=>{v=parseFloat(v);return isFinite(v)?v:d;};
  const normFx=l=>arr(l).filter(f=>f&&FX[f.k]).map(f=>({
    k:f.k,role:String(f.role||'X'),more:roleList(f.more,String(f.role||'X')),ref:f.ref?String(f.ref):'',ref2:f.ref2?String(f.ref2):'',by:String(f.by||''),
    mode:f.mode==='set'?'set':'add',num:num(f.num,1),nm:['gen','preset','any'].includes(f.nm)?f.nm:'any',
    tgt:(GROUP_FX.includes(f.k)&&(f.tgt==='team'||/^@/.test(String(f.tgt||''))))?String(f.tgt):''
  }));
  const strList=x=>[...new Set((Array.isArray(x)?x:(x?[x]:[])).map(String).filter(Boolean))];
  const normVars=l=>{
    const out=[];
    arr(l).forEach(v=>{
      if(!v||!VAR_KINDS[v.kind]) return;
      let n=String(v.n||'');
      if(!VAR_NAME_RE.test(n)||out.some(x=>x.n===n)) n=nextVarName(out,v.kind);
      const sz=(v.size&&typeof v.size==='object'&&CMP.includes(v.size.op)&&isFinite(parseFloat(v.size.num)))?{op:v.size.op,num:parseFloat(v.size.num)}:null;
      out.push({n,kind:v.kind,src:(VAR_SRC.includes(v.src)&&(v.src!=='near'||v.kind==='scene'))?v.src:'of',role:ROLE_RE.test(String(v.role))?String(v.role):'X',
        has:roleList(v.has),lacks:roleList(v.lacks),                                    // «que X tenga», «que Y no tenga» (acepta el formato viejo: un solo participante)
        cats:strList(v.cats!==undefined?v.cats:v.cat),ids:strList(v.ids),excl:!!v.excl,
        size:(sz&&(v.kind==='item'||v.kind==='team'||v.kind==='scene'))?sz:null,leader:(v.kind==='team'&&['yes','no'].includes(v.leader))?v.leader:''});
    });
    return out;
  };
  const normStep=s=>{
    const cond=normCond(s&&s.cond),op=STEP_OPS.includes(s&&s.op)?s.op:'add';
    return {
      id:String((s&&s.id)||'').replace(/[^A-Za-z0-9]/g,'')||uid(),cond:(cond&&cond.t==='g')?cond:emptyCond(),op,
      kind:(op==='add'&&STEP_KINDS.includes(s&&s.kind))?s.kind:'num',num:num(s&&s.num,op==='mult'?1:10),
      stat:String((s&&s.stat)||''),role:ROLE_RE.test(String(s&&s.role))?String(s.role):'X',role2:ROLE_RE.test(String(s&&s.role2))?String(s.role2):'Y',
      vs:(s&&s.vs==='fixed')?'fixed':'role',val:Math.max(0,num(s&&s.val,5))   // «contra»: otro participante o un valor fijo
    };
  };
  const normChance=(ch,extra)=>{
    ch=(ch&&typeof ch==='object')?ch:{};
    const modes=extra?CHANCE_MODES.filter(m=>m!=='always'):CHANCE_MODES;
    return {
      mode:modes.includes(ch.mode)?ch.mode:(extra?'fixed':'always'),
      pct:Math.min(100,Math.max(0,num(ch.pct,50))),stat:String(ch.stat||''),
      a:ROLE_RE.test(String(ch.a))?String(ch.a):'X',b:ROLE_RE.test(String(ch.b))?String(ch.b):'Y',   // quién se compara (a) y contra quién (b)
      vs:ch.vs==='fixed'?'fixed':'role',val:Math.max(0,num(ch.val,5)),                           // o contra un valor fijo
      steps:arr(ch.steps).filter(x=>x&&typeof x==='object').map(normStep)
    };
  };
  const o={v:7,stats:[],items:[],skills:[],emotions:[],states:[],scenes:[],sceneStart:'',chars:[],teams:[],words:{nouns:[],adjs:[]},teamPresets:[],events:[],fallback:'{X} pasó el día sin novedades.'};
  const lim=v=>(v===null||v===undefined||v===''||!isFinite(parseFloat(v)))?null:parseFloat(v);
  const normImg=m=>(m&&m.id&&['file','url','data'].includes(m.kind)&&(m.kind==='file'||safeUrl(m.src)))?{id:String(m.id),kind:m.kind,src:m.kind==='file'?'':String(m.src),tag:''}:null;
  o.stats=arr(p.stats).filter(i=>i&&i.id).map(i=>{
    let mn=lim(i.min),mx=lim(i.max);
    if(mn!=null&&mx!=null&&mn>mx){const t=mn;mn=mx;mx=t;}
    let d=num(i.def,5);if(mn!=null&&d<mn)d=mn;if(mx!=null&&d>mx)d=mx;
    return {id:String(i.id),name:String(i.name||''),def:d,min:mn,max:mx};
  });
  o.items=arr(p.items).filter(i=>i&&i.id).map(i=>({id:String(i.id),name:String(i.name||''),size:Math.max(0,Math.floor(num(i.size,1))),cat:String(i.cat||''),icon:String(i.icon||'').slice(0,8),img:normImg(i.img)}));
  o.skills=arr(p.skills).filter(i=>i&&i.id).map(i=>({id:String(i.id),name:String(i.name||''),cat:String(i.cat||''),icon:String(i.icon||'').slice(0,8),img:normImg(i.img),cd:normCd(i.cd)}));
  o.emotions=arr(p.emotions).filter(i=>i&&i.id).map(i=>({id:String(i.id),name:String(i.name||''),icon:String(i.icon||'').slice(0,8),days:Math.max(0,Math.floor(num(i.days,0)))}));
  o.states=arr(p.states).filter(i=>i&&i.id).map(i=>({
    id:String(i.id),name:String(i.name||''),icon:String(i.icon||'').slice(0,8),cat:String(i.cat||''),days:Math.max(0,Math.floor(num(i.days,0))),
    canAct:i.canAct!==false,text:String(i.text||''),
    mods:arr(i.mods).filter(m=>m&&m.stat).map(m=>({stat:String(m.stat),mode:m.mode==='mult'?'mult':'add',num:num(m.num,m.mode==='mult'?1:0)})),
    daily:arr(i.daily).filter(d=>d&&['stat','loyalty','kill'].includes(d.k)).map(d=>({
      k:d.k,ref:d.ref?String(d.ref):'',mode:d.mode==='set'?'set':'add',num:num(d.num,d.k==='kill'?1:-1),pct:Math.min(100,Math.max(0,num(d.pct,100)))
    }))
  }));
  /* escenarios: lugares con nombre e imagen; cada uno puede estar conectado con otros (las conexiones van en los dos sentidos) */
  const sceneIds=new Set();
  o.scenes=arr(p.scenes).filter(i=>i&&i.id&&!sceneIds.has(String(i.id))&&sceneIds.add(String(i.id))).map(i=>({id:String(i.id),name:String(i.name||''),icon:String(i.icon||'').slice(0,8),img:normImg(i.img),links:[...new Set(arr(i.links).map(String))]}));
  o.scenes.forEach(a=>{a.links=a.links.filter(id=>id!==a.id&&sceneIds.has(id));});
  o.scenes.forEach(a=>a.links.forEach(id=>{const b=o.scenes.find(x=>x.id===id);if(b&&!b.links.includes(a.id))b.links.push(a.id);}));
  o.sceneStart=sceneIds.has(String(p.sceneStart||''))?String(p.sceneStart):'';
  o.chars=arr(p.chars).filter(c=>c&&c.id).map(c=>{
    let imgs=arr(c.imgs).filter(i=>i&&i.id&&['file','url','data'].includes(i.kind)&&(i.kind==='file'||safeUrl(i.src)))
      .map(i=>({id:String(i.id),kind:i.kind,src:i.kind==='file'?'':String(i.src),tag:String(i.tag||'')}));
    if(!imgs.length&&typeof c.img==='string'&&c.img.indexOf('data:image/')===0) imgs=[{id:uid(),kind:'data',src:c.img,tag:''}];
    const stats={};
    if(c.stats&&typeof c.stats==='object'&&!Array.isArray(c.stats)){
      Object.keys(c.stats).forEach(k=>{
        let v=parseFloat(c.stats[k]);
        if(!isFinite(v)) return;
        const sd=o.stats.find(x=>x.id===k);
        if(sd){if(sd.min!=null&&v<sd.min)v=sd.min;if(sd.max!=null&&v>sd.max)v=sd.max;}
        stats[k]=v;
      });
    }
    return {
      id:String(c.id),name:String(c.name||''),gender:GEN[c.gender]?c.gender:'o',enabled:c.enabled!==false,
      slots:Math.max(0,Math.floor(num(c.slots,DEFAULT_SLOTS))),imgs,
      items:arr(c.items).map(String),skills:arr(c.skills).map(String),stats,
      loy:Math.min(100,Math.max(0,num(c.loy,50))),
      emotion:o.emotions.some(m=>m.id===String(c.emotion||''))?String(c.emotion):'',
      states:[...new Set(arr(c.states).map(String))].filter(id=>o.states.some(s=>s.id===id)),
      scene:sceneIds.has(String(c.scene||''))?String(c.scene):''
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
    const seenOut=new Set();
    const roles=normRoles(e.roles);
    const ev={
      id:String(e.id),text:String(e.text||''),
      weight:Math.min(10,Math.max(1,parseInt(e.weight,10)||3)),
      roles,
      cond:(cond&&cond.t==='g')?cond:emptyCond(),
      fx:normFx(e.fx),
      chance:normChance(e.chance,false),
      failText:String(e.failText||''),
      fxFail:normFx(e.fxFail),
      outs:arr(e.outs).filter(x=>x&&typeof x==='object').map(x=>{
        let id=String(x.id||uid());if(seenOut.has(id)) id=uid();seenOut.add(id);
        return {id,name:String(x.name||'').slice(0,60),text:String(x.text||''),fx:normFx(x.fx),chance:normChance(x.chance,true)};
      }),
      vars:normVars(e.vars),
      sameScene:normSameScene(e.sameScene,roles)
    };
    /* los pasos de probabilidad se identifican por su id: no puede repetirse dentro de un evento */
    const seenSt=new Set();
    [ev.chance].concat(ev.outs.map(x=>x.chance)).forEach(c=>c.steps.forEach(st=>{if(seenSt.has(st.id))st.id=uid();seenSt.add(st.id);}));
    return ev;
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
  if(!hit) return base;
  const s=statDef(id),lo=s&&s.min!=null?s.min:0,v=(base+add)*mul;
  return Math.min(s&&s.max!=null?s.max:Infinity,Math.max(lo,v));
}
const statVal=(ch,id)=>hasStat(ch,id)?effStat(ch,id):0;   // una stat que no se tiene vale 0
const stateDef=id=>P.states.find(s=>s.id===id)||null;
/* Límites propios de cada stat (null = sin límite). */
const statDef=id=>P.stats.find(s=>s.id===id)||null;
function clampStat(id,v){
  const s=statDef(id);
  if(s){if(s.min!=null&&v<s.min)v=s.min;if(s.max!=null&&v>s.max)v=s.max;}
  return v;
}
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

/* Condiciones. ev3 evalúa con lógica de tres valores: true, false o undefined («todavía no se sabe»,
   porque falta asignar algún participante). Así la búsqueda de participantes puede descartar combinaciones
   a medio armar sin probarlas todas. Con `final` (todos asignados) lo que falta cuenta como falso. */
const and3=(a,b)=>(a===false||b===false)?false:((a===true&&b===true)?true:undefined);
const or3=(a,b)=>(a===true||b===true)?true:((a===false&&b===false)?false:undefined);
const allOf3=v=>v.reduce(and3,true);
const anyOf3=v=>v.reduce(or3,false);
/* Escenarios */
const sceneDef=id=>(id&&P.scenes.find(s=>s.id===id))||null;
const sceneName=id=>{const d=sceneDef(id);return d?(d.name||'Sin nombre'):'';};
const scenesLinked=(a,b)=>{const d=sceneDef(a);return !!d&&!!b&&d.links.includes(b);};
const sceneAlive=(sim,id)=>sim.chars.filter(c=>c.alive&&c.scene===id).length;
/* Restricción «mismo escenario» de un evento, armada como reglas extra para que la búsqueda de participantes la use. */
const _sceneCond=new WeakMap();
function condFor(e){
  const ss=e.sameScene;
  if(!ss||(!ss.all&&!ss.groups.length)) return e.cond;
  const names=e.roles.map(r=>r.n),groups=ss.all?[names]:ss.groups;
  const key=JSON.stringify(groups);
  const h=_sceneCond.get(e);
  if(h&&h.key===key&&h.cond===e.cond) return h.res;
  const rules=[];
  groups.forEach(g=>{const ok=g.filter(r=>names.includes(r));for(let i=1;i<ok.length;i++)rules.push({t:'r',neg:false,role:ok[0],more:[],q:'all',j:'and',kind:'samescene',val:'',op:'>=',num:1,role2:ok[i]});});
  const res={t:'g',op:'and',j:'and',c:[e.cond].concat(rules)};
  _sceneCond.set(e,{key,cond:e.cond,res});
  return res;
}
/* Tiempo muerto de una habilidad: sin (se puede repetir todos los días), cada N días o una sola vez. */
const CD_MODES=['none','days','once'];
function normCd(c){
  const mode=c&&CD_MODES.includes(c.mode)?c.mode:'none';
  return {mode,days:(d=>Math.max(1,Math.min(999,isFinite(d)?Math.floor(d):3)))(parseFloat(c&&c.days))};
}
function skillReady(ch,id){
  const s=P.skills.find(x=>x.id===id),cd=s&&s.cd;
  if(!cd||cd.mode==='none') return true;
  const last=ch.skillUse?ch.skillUse[id]:null;
  if(last==null) return true;
  if(cd.mode==='once') return false;
  return (CURSIM?CURSIM.day:0)-last>=cd.days;
}
/* Días que faltan para que la habilidad vuelva a estar lista (0 = lista; -1 = ya no se puede usar más). */
function skillWait(ch,id,day){
  const s=P.skills.find(x=>x.id===id),cd=s&&s.cd;
  if(!cd||cd.mode==='none'||!ch.skillUse||ch.skillUse[id]==null) return 0;
  if(cd.mode==='once') return -1;
  return Math.max(0,cd.days-(day-ch.skillUse[id]));
}
function markSkill(ch,id,day){if(ch&&id){(ch.skillUse=ch.skillUse||{})[id]=day;}}
/* Las reglas «habilidad lista» de un evento gastan la habilidad cuando el evento ocurre. */
function markSkillRules(e,as,sim){
  const walk=(n,neg)=>{
    if(n.t==='g'){n.c.forEach(c=>walk(c,neg||n.op==='not'));return;}
    if(n.kind!=='skillready'||n.neg||neg||!n.val) return;
    const id=n.val.charAt(0)==='@'?((as.vs&&as.vs[n.val.slice(1)])||{}).id:n.val;
    [n.role].concat(n.more||[]).forEach(r=>markSkill(as[r],id,sim.day));
  };
  walk(e.cond,false);
}
function ruleOne(n,ch,as){
  /* el valor puede ser un elemento del evento («@Objeto1»): se cambia por lo que se eligió */
  if(n.val&&n.val.charAt(0)==='@'){const v=as.vs&&as.vs[n.val.slice(1)];n=Object.assign({},n,{val:v?v.id:''});}
  switch(n.kind){
    case 'item': return !!n.val&&ch.items.has(n.val);
    case 'space': {const it=P.items.find(i=>i.id===n.val);return !!it&&slotsFree(ch)>=it.size;}
    case 'skill': return !!n.val&&ch.skills.has(n.val);
    case 'slotsize': return cmp(ch.slots,n.op,n.num);
    case 'scene': return !!n.val&&ch.scene===n.val;
    case 'samescene': {const c2=as[n.role2];return !!c2&&ch.scene===c2.scene;}
    case 'linkedscene': {const c2=as[n.role2];return !!c2&&scenesLinked(ch.scene,c2.scene);}
    case 'scenecount': return cmp(CURSIM?sceneAlive(CURSIM,ch.scene):0,n.op,n.num);
    case 'linkedto': return !!n.val&&scenesLinked(ch.scene,n.val);
    case 'inteamof': return !!n.val&&ch.team===n.val;
    case 'sceneexit': {const d=sceneDef(ch.scene);return !!d&&d.links.length>0;}
    case 'skillready': return !!n.val&&ch.skills.has(n.val)&&skillReady(ch,n.val);
    case 'gender': return ch.gender===n.val;
    case 'status': return (n.val==='dead')?!ch.alive:ch.alive;
    case 'hasstat': return !!n.val&&hasStat(ch,n.val);
    case 'stat': return !!n.val&&cmp(statVal(ch,n.val),n.op,n.num);
    case 'statvs': {const c2=as[n.role2];return !!n.val&&!!c2&&cmp(statVal(ch,n.val),n.op,statVal(c2,n.val));}
    case 'emotion': return !!n.val&&ch.emotion===n.val;
    case 'loyalty': return cmp(ch.loy,n.op,n.num);
    case 'inteam': return !!teamOf(ch);
    case 'isleader': {const t=teamOf(ch);return !!t&&t.leader===ch.id;}
    case 'sameteam': {const c2=as[n.role2];return !!c2&&!!ch.team&&ch.team===c2.team;}
    case 'teamsize': {const t=teamOf(ch);return cmp(t?t.members.length:0,n.op,n.num);}
    case 'teamitem': return !!n.val&&hasItemOrShared(ch,n.val);
    case 'is': return !!n.val&&ch.id===n.val;
    case 'state': return hasState(ch,n.val);
    case 'anystate': return (ch.states||[]).length>0;
  }
  return false;
}
function ev3(n,as,final){
  if(n.t==='g'){
    const c=n.c;
    if(!c.length) return true;
    if(n.op==='mix'){
      /* los hijos se unen con Y u O; la Y se resuelve antes que la O: «A y B o C» es «(A y B) o C» */
      let res=false,cur;
      c.forEach((ch,i)=>{
        const v=ev3(ch,as,final);
        if(i===0) cur=v;
        else if(ch.j==='or'){res=or3(res,cur);cur=v;}
        else cur=and3(cur,v);
      });
      return or3(res,cur);
    }
    const v=c.map(ch=>ev3(ch,as,final));
    if(n.op==='and') return allOf3(v);
    if(n.op==='or') return anyOf3(v);
    const any=anyOf3(v);   // not: ninguna se cumple
    return any===undefined?undefined:!any;
  }
  /* un elemento del evento que todavía no se eligió: «no se sabe» (o falso si ya no hay nada más que elegir) */
  if(n.val&&n.val.charAt(0)==='@'&&!(as.vs&&as.vs[n.val.slice(1)])) return (final&&!as.$pend)?false:undefined;
  const roles=[n.role].concat(n.more||[]);
  const needs2=n.kind==='statvs'||n.kind==='sameteam'||n.kind==='samescene'||n.kind==='linkedscene';
  const v=roles.map(r=>{
    const ch=as[r];
    if(!ch) return final?false:undefined;
    if(needs2&&!as[n.role2]&&!final) return undefined;
    const b=ruleOne(n,ch,as);
    return n.neg?!b:b;
  });
  return n.q==='any'?anyOf3(v):allOf3(v);
}
const evalNode=(n,as)=>ev3(n,as,true)===true;

function newSim(){
  const okIds=(list,ids)=>ids.filter(id=>list.some(i=>i.id===id));
  const sim={
    day:0,over:false,capped:false,days:[],teams:[],teamSeq:0,
    chars:P.chars.filter(c=>c.enabled).map(c=>{
      const stats={};
      Object.keys(c.stats).forEach(id=>{if(P.stats.some(s=>s.id===id))stats[id]=c.stats[id];});
      return {
        id:c.id,name:c.name||'Sin nombre',gender:c.gender,imgs:c.imgs,slots:c.slots,
        items:new Set(okIds(P.items,c.items)),skills:new Set(okIds(P.skills,c.skills)),skillUse:{},stats,
        loy:c.loy,emotion:c.emotion,emoDay:0,team:null,scene:'',
        states:okIds(P.states,c.states||[]).map(id=>({id,day:0})),
        alive:true,kills:0,victims:[],killedBy:null,diedDay:null
      };
    })
  };
  /* escenario inicial: el propio del personaje, o el de partida del proyecto, o uno al azar */
  sim.chars.forEach(c=>{
    const own=(P.chars.find(x=>x.id===c.id)||{}).scene;
    c.scene=own&&sceneDef(own)?own:(sceneDef(P.sceneStart)?P.sceneStart:(P.scenes.length?P.scenes[Math.floor(Math.random()*P.scenes.length)].id:''));
  });
  /* equipos armados de antemano: solo cuentan los miembros que participan */
  P.teams.forEach(t=>{
    const ids=t.members.filter(id=>sim.chars.some(c=>c.id===id));
    if(!ids.length) return;
    sim.teams.push({id:t.id,name:t.name||teamFallbackName(sim),leader:ids.includes(t.leader)?t.leader:'',members:ids.slice(),share:!!t.share});
    ids.forEach(id=>{sim.chars.find(c=>c.id===id).team=t.id;});
  });
  return sim;
}

const nameLbl=(o)=>(o.icon?o.icon+' ':'')+(o.name||'Sin nombre');
function varLabel(kind,id,sim){
  if(kind==='team'){const t=sim&&sim.teams.find(x=>x.id===id);return t?t.name:'';}
  if(kind==='scene'){const d=sceneDef(id);return d?nameLbl(d):'';}
  const L={item:P.items,skill:P.skills,state:P.states}[kind],o=L&&L.find(x=>x.id===id);
  return o?nameLbl(o):'';
}
/* Todos los elementos que cumplen lo que pide el evento para {Nombre}: de dónde salen (lo que tiene un
   participante, todo el proyecto o una lista elegida a mano) y qué filtros tienen que pasar. */
function varPool(v,as,sim){
  const holder=as[v.role];
  if(v.kind==='team'){
    const alive=t=>teamMatesIn(sim,t).filter(c=>c.alive);
    let pool;
    if(v.src==='of'){const t=holder?teamOfIn(sim,holder):null;pool=t?[t]:[];}
    else if(v.src==='list') pool=sim.teams.filter(t=>v.excl?!v.ids.includes(t.id):v.ids.includes(t.id));
    else pool=sim.teams.slice();
    pool=pool.filter(t=>alive(t).length);
    (v.has||[]).forEach(r=>{const c=as[r];pool=pool.filter(t=>!!c&&t.members.includes(c.id));});
    (v.lacks||[]).forEach(r=>{const c=as[r];if(c)pool=pool.filter(t=>!t.members.includes(c.id));});
    if(v.size) pool=pool.filter(t=>cmp(alive(t).length,v.size.op,v.size.num));
    if(v.leader) pool=pool.filter(t=>v.leader==='yes'?!!t.leader:!t.leader);
    return pool.map(t=>t.id);
  }
  if(v.kind==='scene'){
    let pool;
    if(v.src==='of'||v.src==='near'){
      if(!holder) return null;
      const d=sceneDef(holder.scene);
      pool=v.src==='of'?(d?[d.id]:[]):(d?d.links.slice():[]);
    } else if(v.src==='list') pool=P.scenes.filter(x=>v.excl?!v.ids.includes(x.id):v.ids.includes(x.id)).map(x=>x.id);
    else pool=P.scenes.map(x=>x.id);
    (v.has||[]).forEach(r=>{const c=as[r];pool=pool.filter(id=>!!c&&c.scene===id);});
    (v.lacks||[]).forEach(r=>{const c=as[r];if(c)pool=pool.filter(id=>c.scene!==id);});
    if(v.size) pool=pool.filter(id=>cmp(sceneAlive(sim,id),v.size.op,v.size.num));
    return pool;
  }
  const L={item:P.items,skill:P.skills,state:P.states}[v.kind];
  let ids;
  if(v.src==='of'){
    if(!holder) return null;
    ids=v.kind==='item'?[...holder.items]:(v.kind==='skill'?[...holder.skills]:holder.states.map(x=>x.id));
  } else if(v.src==='list') ids=L.filter(i=>v.excl?!v.ids.includes(i.id):v.ids.includes(i.id)).map(i=>i.id);
  else ids=L.map(i=>i.id);
  const has=(c,id)=>v.kind==='item'?c.items.has(id):(v.kind==='skill'?c.skills.has(id):hasState(c,id));
  if(v.cats&&v.cats.length) ids=ids.filter(id=>{const o=L.find(i=>i.id===id);return !!o&&v.cats.includes(o.cat||'');});
  (v.has||[]).forEach(r=>{const c=as[r];ids=ids.filter(id=>!!c&&has(c,id));});
  (v.lacks||[]).forEach(r=>{const c=as[r];if(c)ids=ids.filter(id=>!has(c,id)&&(v.kind!=='item'||slotsFree(c)>=sizeOf(id)));});
  if(v.size&&v.kind==='item') ids=ids.filter(id=>cmp(sizeOf(id),v.size.op,v.size.num));
  return ids;
}
/* Elige al azar los elementos del evento para una asignación de personajes.
   Si hay condiciones que dependen de los elementos («X tiene espacio para {Objeto1}»), prueba combinaciones hasta
   que se cumplan. Devuelve {nombre:{kind,id,label}} o null si no se puede (el evento no puede ocurrir así). */
function resolveVars(e,as,sim,cond){
  const vars=e.vars||[],vs={};
  const chosen={item:new Set(),skill:new Set(),state:new Set(),team:new Set(),scene:new Set()};
  const ctx=Object.assign({},as);
  Object.defineProperty(ctx,'vs',{value:vs,enumerable:false,writable:true});
  Object.defineProperty(ctx,'$pend',{value:true,enumerable:false});
  let budget=800;
  const rec=i=>{
    if(i===vars.length) return !cond||ev3(cond,ctx,true)===true;
    const v=vars[i];
    let pool=varPool(v,as,sim);
    if(!pool) return false;
    pool=shuffle(pool.filter(id=>!chosen[v.kind].has(id)&&varLabel(v.kind,id,sim)));
    for(const id of pool){
      if(budget--<=0) return false;
      chosen[v.kind].add(id);vs[v.n]={kind:v.kind,id,label:varLabel(v.kind,id,sim)};
      if((!cond||ev3(cond,ctx,true)!==false)&&rec(i+1)) return true;
      chosen[v.kind].delete(id);delete vs[v.n];
    }
    return false;
  };
  return rec(0)?vs:null;
}
/* Elige quiénes participan en el evento (X ya es el actor). Prueba combinaciones en orden al azar y descarta
   las que ya no pueden cumplirse apenas se sabe, así sirve aunque el evento tenga muchísimos participantes. */
function pickAssignment(e,actor,sim,used,ignoreCond){
  const roles=e.roles;
  const pools=roles.slice(1).map(r=>{
    const alive=sim.chars.filter(c=>c.alive&&!used.has(c.id)&&c.id!==actor.id);
    const dead=sim.chars.filter(c=>!c.alive);
    return r.req==='dead'?dead:(r.req==='any'?alive.concat(dead):alive);
  });
  if(pools.some(p=>!p.length)) return null;
  const as={}; as[roles[0].n]=actor;
  const cond=condFor(e);
  if(!ignoreCond&&ev3(cond,as,false)===false) return null;
  const taken=new Set([actor.id]);
  let budget=4000,found=null;
  const rec=i=>{
    if(found||budget<=0) return;
    if(i===pools.length){
      const snap=Object.assign({},as);
      if(!ignoreCond){   // los participantes ya están todos; solo pueden faltar los elementos del evento
        const c0=Object.assign({},as);
        Object.defineProperty(c0,'vs',{value:{},enumerable:false});Object.defineProperty(c0,'$pend',{value:true,enumerable:false});
        if(ev3(cond,c0,true)===false) return;
      }
      const vs=resolveVars(e,snap,sim,ignoreCond?null:cond);              // los elementos del evento (objetos, equipos…) también tienen que existir
      if(!vs) return;
      Object.defineProperty(snap,'vs',{value:vs,enumerable:false,writable:true});
      found=snap;
      return;
    }
    const rn=roles[i+1].n;
    for(const c of shuffle(pools[i].filter(x=>!taken.has(x.id)))){
      if(found||budget<=0) return;
      budget--;
      as[rn]=c;taken.add(c.id);
      if(ignoreCond||ev3(cond,as,false)!==false) rec(i+1);
      taken.delete(c.id);delete as[rn];
    }
  };
  rec(0);
  return found;
}
function fmt(text,as){
  return esc(text).replace(TOKEN_RE,(m,k)=>{
    if(ROLE_RE.test(k)) return as[k]?'<b class="nm">'+esc(as[k].name)+'</b>':m;
    const v=as.vs&&as.vs[k];
    return v?'<b class="nm">'+esc(v.label)+'</b>':m;
  });
}
const roleLook=(e,k)=>{const r=e.roles.find(x=>x.n===k);return r?r.look:'';};
/* Quiénes se muestran en el registro, separados por equipo. Cuando el evento habla de un equipo (un elemento
   {Equipo1}, o un participante marcado «con todo su equipo») salen todos sus integrantes; el resto, aparte. */
function buildGroups(e,as,sim){
  const clusters=[],inCl=new Set(),look={};
  e.roles.forEach(r=>{if(as[r.n])look[as[r.n].id]=r.look;});
  const mem=c=>({c,src:lookFor(c,look[c.id]||'')});
  const addTeam=t=>{
    if(!t||clusters.some(g=>g.tid===t.id)) return;
    const ms=teamMatesIn(sim,t);
    clusters.push({tid:t.id,team:t.name,members:ms.map(mem)});
    ms.forEach(c=>inCl.add(c.id));
  };
  const vs=as.vs||{};
  Object.keys(vs).forEach(n=>{if(vs[n].kind==='team')addTeam(sim.teams.find(t=>t.id===vs[n].id));});
  e.roles.forEach(r=>{if(r.squad&&as[r.n])addTeam(teamOfIn(sim,as[r.n]));});
  const solo=[];
  e.roles.forEach(r=>{const c=as[r.n];if(c&&!inCl.has(c.id)){solo.push(mem(c));inCl.add(c.id);}});
  if(solo.length) clusters.push({tid:'',team:'',members:solo});
  return clusters;
}
/* Si el evento formó equipos, sus integrantes pasan a mostrarse juntos. */
function finishGroups(entry,sim){
  (entry.formed||[]).forEach(id=>{
    const t=sim.teams.find(x=>x.id===id);if(!t) return;
    const ms=teamMatesIn(sim,t);
    entry.groups.forEach(g=>{g.members=g.members.filter(m=>!t.members.includes(m.c.id));});
    entry.groups=entry.groups.filter(g=>g.members.length);
    entry.groups.unshift({tid:t.id,team:t.name,members:ms.map(c=>({c,src:lookFor(c,'')}))});
  });
}

/* Aplica una lista de efectos (los de «ocurre» o los de «no sale bien»). */
function applyFx(list,as,actor,sim,entry){
  const vsx=as.vs||{},rr=r=>(r&&r.charAt(0)==='@')?((vsx[r.slice(1)]||{}).id||''):r;
  for(const f0 of list){
    /* las referencias a elementos del evento («@Objeto1») se cambian por lo que se eligió */
    const f=((f0.ref&&f0.ref.charAt(0)==='@')||(f0.ref2&&f0.ref2.charAt(0)==='@'))?Object.assign({},f0,{ref:rr(f0.ref),ref2:rr(f0.ref2)}):f0;
    if(f.tgt&&GROUP_FX.includes(f.k)){
      /* a todo un equipo: el mismo efecto para cada integrante vivo */
      const teams=[];
      if(f.tgt==='team'){[f.role].concat(f.more||[]).forEach(r=>{const c=as[r],tm=c?teamOfIn(sim,c):null;if(tm&&!teams.includes(tm))teams.push(tm);});}
      else{const tm=sim.teams.find(x=>x.id===rr(f.tgt));if(tm)teams.push(tm);}
      const ms=[];teams.forEach(tm=>teamMatesIn(sim,tm).forEach(c=>{if(c.alive&&!ms.includes(c))ms.push(c);}));
      if(ms.length){
        ms.forEach((c,i)=>{
          const a2=Object.assign({},as,{['$g'+i]:c});
          Object.defineProperty(a2,'vs',{value:as.vs||{},enumerable:false});
          applyFx([Object.assign({},f,{tgt:'',role:'$g'+i,more:[]})],a2,actor,sim,entry);
        });
        continue;
      }
      if(f.tgt!=='team'){entry.notes.push('No había un equipo al que aplicar el efecto.');continue;}
      /* sin equipo: se aplica solo al participante */
    }
    if(f.more&&f.more.length&&MULTI_FX.includes(f.k)){
      /* el mismo efecto para cada participante de la lista */
      [f.role].concat(f.more).forEach(r=>applyFx([Object.assign({},f,{role:r,more:[]})],as,actor,sim,entry));
      continue;
    }
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
    } else if(f.k==='slots'){
      const want=Math.max(0,Math.floor(f.mode==='set'?f.num:t.slots+f.num));
      t.slots=want;
      if(usedSlots(t)>want) entry.notes.push(t.name+' lleva más de lo que le cabe ('+usedSlots(t)+'/'+want+').');
    } else if(f.k==='loyalty'){
      t.loy=Math.min(100,Math.max(0,f.mode==='set'?f.num:t.loy+f.num));
    } else if(f.k==='teamForm'){
      const ms=[...new Set([t,as[f.by]].concat((f.more||[]).map(r=>as[r])).filter(Boolean))];
      if(ms.length<2) continue;
      const had=ms.find(c=>c.team);
      if(had){entry.notes.push('No se formó el equipo: '+had.name+' ya tenía uno.');continue;}
      const nt=formTeamN(sim,ms,f.nm,f.num>0);
      (entry.formed=entry.formed||[]).push(nt.id);
      entry.notes.push('Se formó el equipo «'+nt.name+'» con '+ms.map(c=>c.name).join(', ')+(nt.leader?'; '+t.name+' es el líder.':'.'));
    } else if(f.k==='teamJoin'){
      const o=as[f.by],team=o?teamOf(o):null;
      if(!o||!team||t.team){entry.notes.push('No se pudo incorporar a '+t.name+(t.team?': ya tiene equipo.':': no hay equipo al que unirse.'));continue;}
      joinTeam(sim,t,team);
      entry.notes.push(t.name+' se unió al equipo «'+team.name+'».');
    } else if(f.k==='joinTeam'){
      const team=sim.teams.find(x=>x.id===f.ref);
      if(!team||t.team){entry.notes.push('No se pudo incorporar a '+t.name+(t.team?': ya tiene equipo.':': no hay equipo elegido.'));continue;}
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
    } else if(f.k==='moveScene'||f.k==='moveSceneRandom'||f.k==='moveSceneLinked'||f.k==='moveSceneWith'){
      const pickOne=l=>l.length?l[Math.floor(Math.random()*l.length)]:'';
      let dest='',why='';
      if(f.k==='moveScene'){dest=sceneDef(f.ref)?f.ref:'';why='no hay un escenario elegido';}
      else if(f.k==='moveSceneWith'){const o=as[f.by];dest=o&&sceneDef(o.scene)?o.scene:'';why='el otro participante no está en ningún escenario';}
      else if(f.k==='moveSceneRandom'){dest=pickOne(P.scenes.filter(x=>x.id!==t.scene).map(x=>x.id));why='no hay otro escenario';}
      else{const d=sceneDef(t.scene);dest=pickOne(d?d.links:[]);why='su escenario no tiene conexiones';}
      if(!dest){entry.notes.push(t.name+' no pudo cambiar de escenario: '+why+'.');continue;}
      const movers=[t];
      if(f.num>0){const tm=teamOfIn(sim,t);if(tm)teamMatesIn(sim,tm).forEach(c=>{if(c!==t&&c.alive)movers.push(c);});}
      const moved=movers.filter(c=>c.scene!==dest);
      if(!moved.length) continue;
      moved.forEach(c=>{(entry.moved=entry.moved||[]).push({c,from:c.scene,to:dest});c.scene=dest;});
      entry.notes.push(moved.map(c=>c.name).join(', ')+(moved.length>1?' fueron':' fue')+' a «'+sceneName(dest)+'».');
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
    } else if(f.k==='moveItem'){
      const to=as[f.by],nm=nameOf(P.items,f.ref);
      if(!to||to===t||!f.ref) continue;
      if(!t.items.has(f.ref)){entry.notes.push(t.name+' no tiene '+nm+' para pasar.');continue;}
      if(to.items.has(f.ref)){entry.notes.push(to.name+' ya tenía '+nm+'.');continue;}
      if(slotsFree(to)<sizeOf(f.ref)){entry.notes.push(to.name+' no tenía espacio para '+nm+'.');continue;}
      t.items.delete(f.ref);to.items.add(f.ref);
      entry.notes.push(t.name+' le pasó '+nm+' a '+to.name+'.');
    } else if(f.k==='swapItems'){
      const o=as[f.by],A=f.ref,B=f.ref2;
      if(!o||o===t||!A||!B) continue;
      const na=nameOf(P.items,A),nb=nameOf(P.items,B);
      if(A===B||!t.items.has(A)||!o.items.has(B)||t.items.has(B)||o.items.has(A)){entry.notes.push('No se pudo el intercambio de '+na+' por '+nb+'.');continue;}
      if(slotsFree(t)+sizeOf(A)<sizeOf(B)||slotsFree(o)+sizeOf(B)<sizeOf(A)){entry.notes.push('No se pudo el intercambio de '+na+' por '+nb+': falta espacio.');continue;}
      t.items.delete(A);o.items.delete(B);t.items.add(B);o.items.add(A);
      entry.notes.push(t.name+' y '+o.name+' intercambiaron '+na+' por '+nb+'.');
    } else if(f.k==='killTeam'){
      const team=sim.teams.find(x=>x.id===f.ref);
      if(!team){entry.notes.push('No había un equipo para eliminar.');continue;}
      const by=team.members.includes(actor.id)?'none':'X';
      entry.notes.push('Todo el equipo «'+team.name+'» quedó fuera.');
      teamMatesIn(sim,team).filter(c=>c.alive).forEach(m=>applyFx([{k:'kill',role:'L',by:by}],{L:m,X:actor},actor,sim,entry));
    } else if(f.k==='teamFight'){
      const A=sim.teams.find(x=>x.id===f.ref),B=sim.teams.find(x=>x.id===f.ref2);
      if(!A||!B||A===B){entry.notes.push('No hubo pelea de equipos: falta uno de los dos.');continue;}
      entry.notes.push('«'+A.name+'» y «'+B.name+'» pelean hasta la muerte.');
      const power=c=>1+Object.keys(c.stats).reduce((a,id)=>a+Math.max(0,statVal(c,id)),0);
      for(let g=0;g<500;g++){
        const ta=sim.teams.find(x=>x.id===A.id),tb=sim.teams.find(x=>x.id===B.id);
        if(!ta||!tb) break;
        const ma=teamMatesIn(sim,ta).filter(c=>c.alive),mb=teamMatesIn(sim,tb).filter(c=>c.alive);
        if(!ma.length||!mb.length) break;
        const a=ma[Math.floor(Math.random()*ma.length)],b=mb[Math.floor(Math.random()*mb.length)];
        const winA=Math.random()<power(a)/(power(a)+power(b)),w=winA?a:b,l=winA?b:a;
        applyFx([{k:'kill',role:'L',by:'W'}],{L:l,W:w},actor,sim,entry);
        entry.notes.push(w.name+' venció a '+l.name+'.');
      }
    } else if(f.k==='giveItem'&&f.ref){
      if(t.items.has(f.ref)) continue;
      if(slotsFree(t)<sizeOf(f.ref)){entry.notes.push(t.name+' no tenía espacio para '+nameOf(P.items,f.ref)+'.');continue;}
      t.items.add(f.ref);
    } else if(f.k==='removeItem'&&f.ref) t.items.delete(f.ref);
    else if(f.k==='giveSkill'&&f.ref) t.skills.add(f.ref);
    else if(f.k==='removeSkill'&&f.ref) t.skills.delete(f.ref);
    else if(f.k==='useSkill'&&f.ref){markSkill(t,f.ref,sim.day);}
    else if(f.k==='stat'&&f.ref){
      if(!hasStat(t,f.ref)){entry.notes.push(t.name+' no tiene la stat '+nameOf(P.stats,f.ref)+', no cambia.');continue;}
      const want=f.mode==='set'?f.num:t.stats[f.ref]+f.num,got=clampStat(f.ref,want);
      t.stats[f.ref]=got;
      if(got!==want) entry.notes.push(nameOf(P.stats,f.ref)+' de '+t.name+' llegó '+(want>got?'al máximo':'al mínimo')+' ('+round2(got)+').');
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
    Object.keys(c.stats).forEach(id=>{
      const sd=statDef(id),lo=sd&&sd.min!=null?Math.ceil(sd.min):0,hi=sd&&sd.max!=null?Math.floor(sd.max):max[id];
      c.stats[id]=hi>=lo?lo+Math.floor(Math.random()*(hi-lo+1)):lo;
    });
    c.items=new Set();
    shuffle(P.items.slice()).forEach(it=>{if(Math.random()<0.5&&slotsFree(c)>=it.size)c.items.add(it.id);});
    c.skills=new Set(P.skills.filter(()=>Math.random()<0.4).map(s=>s.id));
    c.skillUse={};
    if(P.scenes.length) c.scene=P.scenes[Math.floor(Math.random()*P.scenes.length)].id;
    c.loy=Math.floor(Math.random()*101);
    c.states=P.states.filter(()=>Math.random()<0.2).map(x=>({id:x.id,day:sim.day}));
    if(P.emotions.length&&Math.random()<0.6){c.emotion=P.emotions[Math.floor(Math.random()*P.emotions.length)].id;c.emoDay=sim.day;}
  });
  return n;
}

/* Probabilidad (0 a 1) según un modo de probabilidad (el de «sale bien» o el de un desenlace extra). */
function chanceOf(c,e,as){
  if(!c||c.mode==='always') return 1;
  const A=as[c.a]||as[e.roles[0].n];
  /* «contra»: otro participante (por defecto el segundo) o un valor fijo que elige el usuario */
  const fixed=c.vs==='fixed',val=Math.max(0,isFinite(parseFloat(c.val))?parseFloat(c.val):5);
  const B=fixed?null:(as[c.b]||(e.roles[1]?as[e.roles[1].n]:null));
  switch(c.mode){
    case 'fixed': return Math.min(1,Math.max(0,c.pct/100));
    case 'stat': {
      if((!B&&!fixed)||!c.stat) return 0.5;
      const a=Math.max(0,statVal(A,c.stat)),b=fixed?val:Math.max(0,statVal(B,c.stat));
      return a+b>0?a/(a+b):0.5;
    }
    case 'team': {
      if(!B&&!fixed) return 0.5;
      const a=Math.max(1,teamSizeOf(A)),b=fixed?Math.max(1,val):Math.max(1,teamSizeOf(B));   // sin equipo cuenta como uno solo
      return a/(a+b);
    }
    case 'loyalty': return Math.min(1,Math.max(0,1-A.loy/100));
    case 'calc': {
      /* Se parte de un porcentaje base y cada paso, si se cumple su condición, lo suma, lo multiplica o lo fija. */
      let p=Math.min(100,Math.max(0,c.pct));
      (c.steps||[]).forEach(st=>{
        if(!evalNode(st.cond,as)) return;
        const r1=as[st.role],r2=as[st.role2];
        let v=st.num;
        if(st.op==='add'){
          if(st.kind==='stat') v=st.num*(r1&&st.stat?statVal(r1,st.stat):0);
          else if(st.kind==='statdiff') v=st.num*((r1&&st.stat?statVal(r1,st.stat):0)-(st.vs==='fixed'?st.val:(r2&&st.stat?statVal(r2,st.stat):0)));
          else if(st.kind==='loyalty') v=st.num*(r1?r1.loy:0);
          else if(st.kind==='teamsize') v=st.num*(r1?teamSizeOf(r1):0);
          else if(st.kind==='teamdiff') v=st.num*((r1?teamSizeOf(r1):0)-(st.vs==='fixed'?st.val:(r2?teamSizeOf(r2):0)));
          p+=v;
        } else if(st.op==='mult') p*=v;
        else p=v;
        p=Math.min(100,Math.max(0,p));
      });
      return p/100;
    }
  }
  return 1;
}
const successChance=(e,as)=>chanceOf(e.chance,e,as);
/* Qué desenlace le toca al evento: «sale bien», alguno extra, o «no sale bien» con lo que sobre.
   Si las probabilidades suman más de 100%, se reparten en proporción. */
function pickOutcome(e,as){
  const ps=[chanceOf(e.chance,e,as)].concat((e.outs||[]).map(o=>chanceOf(o.chance,e,as)));
  const tot=ps.reduce((a,b)=>a+b,0),rest=Math.max(0,1-tot),sum=Math.max(1,tot);
  let r=Math.random()*sum,i=0;
  for(;i<ps.length;i++){r-=ps[i];if(r<0)break;}
  if(i>=ps.length&&rest<=0) i=ps.length-1;
  const w=i<ps.length?ps[i]:rest;
  return {idx:i,main:i===0,fail:i>=ps.length,out:(i>0&&i<ps.length)?e.outs[i-1]:null,pct:Math.round(w/sum*100)};
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
          const b=c.stats[d.ref];c.stats[d.ref]=clampStat(d.ref,d.mode==='set'?d.num:b+d.num);
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

/* Dónde ocurre un evento: los escenarios de sus participantes (antes de los efectos) y los elegidos como {Escenario1}. */
/* Qué elementos del evento ({Objeto1}…) intervienen en el desenlace que ocurrió: los que nombra su texto, los que usan sus efectos
   y los que piden las condiciones. Un elemento pensado para otro desenlace no cuenta. */
function usedVars(e,text,fxList){
  const used=new Set();
  [...String(text||'').matchAll(TOKEN_RE)].forEach(m=>{if(!ROLE_RE.test(m[1]))used.add(m[1]);});
  const at=r=>{if(r&&r.charAt(0)==='@')used.add(r.slice(1));};
  (fxList||[]).forEach(f=>{at(f.ref);at(f.ref2);at(f.tgt);});
  const walk=(n,neg)=>{
    if(n.t==='g'){n.c.forEach(c=>walk(c,neg||n.op==='not'));return;}
    if(!n.neg&&!neg) at(n.val);
  };
  walk(e.cond,false);
  return used;
}
function eventScenes(e,as,used){
  const out=[],at=id=>{let g=out.find(x=>x.id===id);if(!g){g={id,who:[]};out.push(g);}return g;};
  if(!P.scenes.length) return out;
  e.roles.forEach(r=>{const c=as[r.n];if(c&&sceneDef(c.scene))at(c.scene).who.push(c.id);});
  const vs=as.vs||{};
  Object.keys(vs).forEach(n=>{if(vs[n].kind==='scene'&&(!used||used.has(n))&&!out.some(g=>g.id===vs[n].id))at(vs[n].id).dest=true;});
  return out;
}
/* Objetos, habilidades y estados que aparecen en un evento: los elegidos como elementos, los de los efectos y los de las condiciones. */
function eventElems(e,as,fxList,used){
  const out=[],add=(kind,id)=>{
    const L={item:P.items,skill:P.skills,state:P.states}[kind];
    if(id&&L&&L.some(x=>x.id===id)&&!out.some(x=>x.kind===kind&&x.id===id)) out.push({kind,id});
  };
  const vs=as.vs||{};
  Object.keys(vs).forEach(n=>{if(!used||used.has(n))add(vs[n].kind,vs[n].id);});
  const rr=r=>(r&&r.charAt(0)==='@')?((vs[r.slice(1)]||{}).id||''):r;
  const FK={giveItem:'item',removeItem:'item',teamTake:'item',moveItem:'item',swapItems:'item',giveSkill:'skill',removeSkill:'skill',useSkill:'skill',addState:'state',removeState:'state'};
  (fxList||[]).forEach(f=>{const k=FK[f.k];if(k){add(k,rr(f.ref));if(f.k==='swapItems')add(k,rr(f.ref2));}});
  const RK={item:'item',teamitem:'item',skill:'skill',skillready:'skill',state:'state'};
  const walk=(n,neg)=>{
    if(n.t==='g'){n.c.forEach(c=>walk(c,neg||n.op==='not'));return;}
    if(RK[n.kind]&&!n.neg&&!neg) add(RK[n.kind],rr(n.val));
  };
  walk(e.cond,false);
  return out;
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
    /* ¿qué desenlace le toca? (si el evento no tiene probabilidad, siempre sale como está escrito) */
    const oc=pickOutcome(e,as);
    const text=oc.out?(oc.out.text.trim()||e.text):((oc.fail&&e.failText.trim())?e.failText:e.text);
    const groups=buildGroups(e,as,sim);
    const usedFx=oc.out?oc.out.fx:(oc.fail?e.fxFail:e.fx),usedNow=usedVars(e,text,usedFx);
    const entry={
      html:fmt(text,as),
      who:Object.keys(as).map(k=>({c:as[k],src:lookFor(as[k],roleLook(e,k))})),
      groups,deaths:[],notes:[],
      chance:(!(e.outs&&e.outs.length)&&e.chance&&e.chance.mode!=='always')?Math.round(successChance(e,as)*100):null,
      outcome:(e.outs&&e.outs.length)?{name:oc.out?(oc.out.name.trim()||'Desenlace extra'):(oc.fail?'No sale bien':'Sale bien'),pct:oc.pct}:null,
      scenes:eventScenes(e,as,usedNow),
      elems:eventElems(e,as,usedFx,usedNow)
    };
    markSkillRules(e,as,sim);
    applyFx(oc.out?oc.out.fx:(oc.fail?e.fxFail:e.fx),as,actor,sim,entry);
    finishGroups(entry,sim);
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
