'use strict';
/* =====================================================================
   INTERFAZ DE ELEMENTOS DEL EVENTO.
   Un elemento es algo que el evento elige solo cuando ocurre: un objeto o una
   habilidad de alguien, un estado alterado, un equipo. Se nombra en el texto
   ({Objeto1}) y se usa en los efectos. Ejemplos:
     «{X} intercambió {Objeto1} por {Objeto2} de {Y}»
     «{X} copió la habilidad {Habilidad1} de {Y}»
     «{Equipo1} y {Equipo2} pelearon hasta la muerte»
   Se apoya en interfaz.js (ui, ACT, BIND…) y en nucleo.js (VAR_KINDS, resolveVars).
   ===================================================================== */

const VAR_NOUN={item:'un objeto',skill:'una habilidad',state:'un estado',team:'un equipo'};
function varRow(e,v,i){
  const sel=(bind,label,body)=>`<select data-bind="${bind}" data-i="${i}" aria-label="${label}">${body}</select>`;
  const o=(val,cur,txt)=>`<option value="${esc(val)}" ${val===cur?'selected':''}>${esc(txt)}</option>`;
  const names=e.roles.map(r=>r.n);
  const roleOpts2=(cur,none,fmtTxt)=>(none?o('',cur,none):'')+names.map(n=>o(n,cur,fmtTxt(n))).join('')+(cur&&!names.includes(cur)?o(cur,cur,'⚠ '+cur):'');
  const W=t=>`<span class="w">${t}</span>`;
  let h=`<span class="rl vl">{${esc(v.n)}}</span>`;
  if(v.kind==='team'){
    h+=sel('var-src','Cómo se elige',o('of',v.src,'el equipo de')+o('any',v.src,'un equipo cualquiera'));
    if(v.src==='of') h+=sel('var-role','Participante',roleOpts2(v.role,'',n=>n));
  } else {
    h+=sel('var-src','Cómo se elige',o('of',v.src,VAR_NOUN[v.kind]+' que tiene')+o('any',v.src,VAR_NOUN[v.kind]+' cualquiera del proyecto'));
    if(v.src==='of') h+=sel('var-role','Participante',roleOpts2(v.role,'',n=>n));
    h+=sel('var-lacks','Restricción',roleOpts2(v.lacks,'sin otra restricción',n=>'que '+n+' no tenga'));
    if(v.src==='any'&&(v.kind==='item'||v.kind==='skill')) h+=`<input type="text" list="cats-${v.kind}s" value="${esc(v.cat)}" placeholder="categoría (opcional)" data-bind="var-cat" data-i="${i}" aria-label="Categoría" autocomplete="off">`;
  }
  return `<div class="wrow vrow">${h}<button type="button" class="x" data-act="var-del" data-i="${i}" aria-label="Quitar elemento">✕</button></div>`;
}
function varsSection(e){
  const vars=e.vars||[];
  const dl=['items','skills'].map(k=>`<datalist id="cats-${k}">${[...new Set(P[k].map(i=>i.cat).filter(Boolean))].sort().map(c=>`<option value="${esc(c)}">`).join('')}</datalist>`).join('');
  return `<section class="card sec"><h3 class="h3">Elementos del evento</h3>
  <p class="hint">Un elemento es algo que el evento elige solo cuando ocurre: un objeto o una habilidad de alguien, un estado, un equipo. Después lo nombrás en el texto (por ejemplo {Objeto1}) y lo usás en los efectos. Ejemplo: «{X} copió la habilidad {Habilidad1} de {Y}», con Habilidad1 = una habilidad que tiene Y y X no. Si no se puede elegir (por ejemplo, Y no tiene ninguna), el evento no ocurre con esos personajes.</p>
  ${dl}${vars.map((v,i)=>varRow(e,v,i)).join('')}
  ${vars.length<MAX_VARS?`<div><select class="addsel" data-bind="var-add" aria-label="Agregar elemento"><option value="">＋ Agregar elemento…</option>${Object.keys(VAR_KINDS).map(k=>`<option value="${k}">${VAR_KINDS[k].lbl}</option>`).join('')}</select></div>`:'<p class="hint">Llegaste al máximo de elementos por evento.</p>'}</section>`;
}

Object.assign(ACT,{
  'var-del'(b){
    const e=curEv();if(!e)return;
    const i=+b.dataset.i,v=e.vars[i];if(!v)return;
    e.vars.splice(i,1);
    /* los efectos que usaban este elemento quedan sin elegir (el aviso «Para revisar» lo marca) */
    [e.fx,e.fxFail].forEach(L=>L.forEach(f=>{if(f.ref==='@'+v.n)f.ref='';if(f.ref2==='@'+v.n)f.ref2='';}));
    structural();
  }
});
const curVar=t=>{const e=curEv();return e&&e.vars?e.vars[+t.dataset.i]:null;};
Object.assign(BIND,{
  'var-add'(t){
    const e=curEv(),k=t.value;
    if(!e||!VAR_KINDS[k]||e.vars.length>=MAX_VARS)return;
    e.vars.push({n:nextVarName(e.vars,k),kind:k,src:'of',role:'X',lacks:'',cat:''});
    structural();
  },
  'var-src'(t){const v=curVar(t);if(v){v.src=t.value==='any'?'any':'of';structural();}},
  'var-role'(t){const v=curVar(t);if(v){v.role=t.value;touch();}},
  'var-lacks'(t){const v=curVar(t);if(v){v.lacks=t.value;touch();}},
  'var-cat'(t){const v=curVar(t);if(v){v.cat=t.value.trim();touch();}}
});
