'use strict';
/* =====================================================================
   EQUIPOS: lo que hace falta para que existan y cambien durante la
   simulación, más el generador de nombres. No toca la pantalla.

   En la simulación (sim):
     sim.teams = [{id, name, leader, members:[ids de personajes], share}]
     cada personaje tiene  ch.team = id del equipo (o null)
   Reglas de la casa:
     - un personaje está en un solo equipo;
     - quien es eliminado sale del equipo;
     - si el líder se va, lo reemplaza el miembro más leal (solo si había líder);
     - un equipo sin miembros se disuelve.
   ===================================================================== */

/* ---------- Consultas (usan la simulación en curso, CURSIM) ---------- */
const teamOfIn=(sim,ch)=>(sim&&ch&&ch.team)?(sim.teams.find(t=>t.id===ch.team)||null):null;
const teamOf=ch=>teamOfIn(CURSIM,ch);
const teamMatesIn=(sim,t)=>sim.chars.filter(c=>t.members.includes(c.id));
const teamMates=t=>teamMatesIn(CURSIM,t);
const teamSizeOf=ch=>{const t=teamOf(ch);return t?t.members.length:0;};
/* Tiene el objeto, o lo tiene alguien de su equipo y el equipo comparte el inventario. */
function hasItemOrShared(ch,id){
  if(ch.items.has(id)) return true;
  const t=teamOf(ch);
  return !!t&&t.share&&teamMates(t).some(m=>m!==ch&&m.items.has(id));
}

/* ---------- Cambios ---------- */
function removeFromTeam(sim,ch){
  const t=sim.teams.find(x=>x.id===ch.team);
  ch.team=null;
  if(!t) return null;
  t.members=t.members.filter(id=>id!==ch.id);
  if(t.leader===ch.id){
    const left=teamMatesIn(sim,t).filter(c=>c.alive).sort((a,b)=>b.loy-a.loy);
    t.leader=left.length?left[0].id:'';
  }
  const gone=t.members.length===0;
  if(gone) sim.teams=sim.teams.filter(x=>x!==t);
  return {team:t,gone};
}
function joinTeam(sim,ch,t){
  t.members.push(ch.id);
  ch.team=t.id;
}
function formTeam(sim,a,b,nameMode,aLeads){
  const t={id:uid(),name:nameForNewTeam(sim,nameMode),leader:aLeads?a.id:'',members:[a.id,b.id],share:false};
  sim.teams.push(t);
  a.team=t.id;b.team=t.id;
  return t;
}

/* ---------- Nombres ---------- */
const ART={sm:'el',sf:'la',pm:'los',pf:'las'};
const DEL={sm:'del',sf:'de la',pm:'de los',pf:'de las'};
/* Clave de número y género para elegir artículo. El género «cualquiera» (x) se trata como masculino. */
const wkey=w=>(w.num==='p'?'p':'s')+(w.gen==='f'?'f':'m');
const capw=s=>s.charAt(0).toUpperCase()+s.slice(1);
const pickOne=a=>a[Math.floor(Math.random()*a.length)];
/* Un adjetivo acompaña a un sustantivo si coinciden en número y en género (o alguno es «cualquiera»). */
const wfits=(a,n)=>a.num===n.num&&(a.gen==='x'||n.gen==='x'||a.gen===n.gen);

/* Arma un nombre con el vocabulario del proyecto. Patrones posibles:
     «Los Guardianes del Estiércol»  (sustantivo de sustantivo)
     «El Aceite Primordial»          (sustantivo y adjetivo que concuerda)
     «El Primordial del Aceite»      (adjetivo de sustantivo)
     «Toritos y Guardianes»          (dos sustantivos)
   Devuelve null si el vocabulario no alcanza para ningún patrón. */
function genTeamName(avoid){
  avoid=avoid||new Set();
  const N=P.words.nouns.filter(w=>w.text.trim()),A=P.words.adjs.filter(w=>w.text.trim());
  const pairs=[];
  N.forEach(n=>A.forEach(a=>{if(wfits(a,n))pairs.push([n,a]);}));
  const pats=[];
  if(N.length>=2){pats.push('de','y');}
  if(pairs.length) pats.push('adj');
  if(N.length&&A.length) pats.push('sust');
  if(!pats.length) return null;
  let s='';
  for(let i=0;i<40;i++){
    const p=pickOne(pats);
    if(p==='de'||p==='y'){
      const a=pickOne(N),b=pickOne(N.filter(x=>x!==a));
      s=p==='de'
        ?capw(ART[wkey(a)])+' '+capw(a.text)+' '+DEL[wkey(b)]+' '+capw(b.text)
        :capw(a.text)+' y '+capw(b.text);
    } else if(p==='adj'){
      const [n,a]=pickOne(pairs);
      s=capw(ART[wkey(n)])+' '+capw(n.text)+' '+capw(a.text);
    } else {
      const a=pickOne(A),n=pickOne(N);
      s=capw(ART[wkey(a)])+' '+capw(a.text)+' '+DEL[wkey(n)]+' '+capw(n.text);
    }
    if(!avoid.has(s.toLowerCase())) return s;
  }
  return s;
}

function teamFallbackName(sim){
  const used=new Set(sim.teams.map(t=>t.name.toLowerCase()));
  let name;
  do{sim.teamSeq++;name='Equipo '+sim.teamSeq;}while(used.has(name.toLowerCase()));
  return name;
}
/* Nombre para un equipo que nace durante la partida. mode: 'gen' | 'preset' | 'any'. */
function nameForNewTeam(sim,mode){
  const used=new Set(sim.teams.map(t=>t.name.toLowerCase()));
  const presets=P.teamPresets.filter(s=>s.trim()&&!used.has(s.toLowerCase()));
  const gen=()=>genTeamName(used);
  let name=null;
  if(mode==='preset') name=presets.length?pickOne(presets):gen();
  else if(mode==='gen') name=gen()||(presets.length?pickOne(presets):null);
  else{
    const opts=[];
    if(presets.length) opts.push('p');
    if(P.words.nouns.some(w=>w.text.trim())) opts.push('g');
    const o=opts.length?pickOne(opts):'';
    name=o==='p'?pickOne(presets):(o==='g'?gen():null);
  }
  if(!name) return teamFallbackName(sim);
  if(used.has(name.toLowerCase())){
    let k=2;
    while(used.has((name+' '+k).toLowerCase())) k++;
    name=name+' '+k;
  }
  return name;
}
