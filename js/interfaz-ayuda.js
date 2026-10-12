'use strict';
/* =====================================================================
   AYUDAS EN VENTANITA.
   En vez de párrafos explicativos dentro del editor, cada sección tiene un
   botón «?» que abre una ventanita con la explicación. Para sumar una ayuda:
   agregá una entrada a HELP y poné helpBtn('clave') donde quieras el botón.
   ===================================================================== */
const HELP={
  texto:{t:'Texto del evento',h:`<p>Es lo que se lee en el registro cuando el evento <b>sale bien</b>.</p>
    <p>Escribí <b>{X}</b>, <b>{Y}</b>… para nombrar a los participantes y <b>{Objeto1}</b>… para los elementos que el evento elige. Los botones de abajo los insertan por vos.</p>
    <p>Cada desenlace alternativo puede tener su propio texto (pestaña «Qué pasa»).</p>`},
  roles:{t:'Participantes',h:`<p><b>X</b> es quien actúa en su turno y siempre está vivo. Los demás se eligen al azar entre quienes cumplan las condiciones.</p>
    <p>Nadie participa dos veces en el mismo día. Podés sumar tantos participantes como personajes haya en el proyecto.</p>
    <p>En <b>imagen</b> escribís la etiqueta de la imagen que se muestra para ese participante (si no la tiene, usa la principal).</p>
    <p><b>Con todo su equipo</b> muestra en el registro a todo el equipo de ese participante.</p>`},
  vars:{t:'Elementos del evento',h:`<p>Un elemento es algo que el evento <b>elige solo</b> cuando ocurre: un objeto, una habilidad, un estado, un equipo o un escenario.</p>
    <p>Después lo nombrás en el texto (por ejemplo <b>{Objeto1}</b>) y lo usás en los efectos y en las reglas.</p>
    <p>Elegí de dónde sale (lo que tiene un participante, todo el proyecto o una lista que armás a mano) y afinalo con filtros: categorías, lo que otros participantes tienen o no tienen, el tamaño…</p>
    <p>Si no se puede elegir (por ejemplo, Y no tiene ninguno), el evento no ocurre con esos personajes.</p>`},
  escenarios:{t:'Escenarios del evento',h:`<p>Elegí dónde tienen que estar los participantes para que el evento pueda ocurrir.</p>
    <p>Podés exigir que coincidan <b>todos</b>, solo <b>algunos</b> (por ejemplo X con Z, mientras Y está en otro lado) o <b>ninguno</b>.</p>
    <p>También hay reglas y efectos de escenarios para casos más finos.</p>`},
  cond:{t:'Condiciones',h:`<p>El evento <b>solo puede ocurrir</b> si se cumplen. Sin reglas, siempre puede ocurrir.</p>
    <p>Combinás reglas con grupos: <b>Y</b> (todas), <b>O</b> (al menos una), <b>NO</b> (ninguna) y <b>Y/O</b> mezclados. En el modo mezclado, tocá la Y / O entre dos reglas para cambiarla: la Y se resuelve antes que la O, así que «A y B o C» es «(A y B) o C». Para otro orden, usá un grupo.</p>
    <p>Los grupos se pueden anidar. Una stat que el personaje no tiene vale 0.</p>`},
  bloques:{t:'Cómo se arma con bloques',h:`<p>Cada regla y cada efecto es un bloque. Para moverlo, arrastralo desde <b>⠿</b> (también con el dedo) o usá <b>▲ ▼</b>.</p>
    <p>Un grupo puede contener reglas y otros grupos. Los colores indican de qué trata cada bloque (personaje, objeto, habilidad, stat…).</p>`},
  view:{t:'Bloques o formulario',h:`<p>Son dos maneras de editar <b>lo mismo</b>. Podés cambiar cuando quieras sin perder nada.</p>
    <p><b>Bloques</b>: se arma arrastrando. <b>Formulario</b>: listas ordenadas con selectores.</p>`},
  fx:{t:'Efectos',h:`<p>Es lo que cambia cuando ese desenlace ocurre.</p>
    <p>Si un objeto no entra en los slots, el personaje no tiene la stat o no hay equipo para el efecto, <b>ese efecto no se aplica</b> y queda una nota en el registro.</p>`},
  desenlaces:{t:'Cómo termina el evento',h:`<p>Cuando el evento ocurre, el simulador <b>sortea UN desenlace</b>:</p>
    <ol><li><b>Sale bien</b>: usa el texto del evento y sus efectos.</li>
    <li><b>Desenlaces extra</b> (opcionales): cada uno con su probabilidad, su texto y sus efectos. Por ejemplo «Éxito crítico» o «Se lastima».</li>
    <li><b>No sale bien</b>: lo que no se reparta entre los anteriores. Aparece solo si queda probabilidad sin asignar.</li></ol>
    <p>Solo se aplican los efectos del desenlace que tocó. Los elementos que solo usa otro desenlace no aparecen en el registro.</p>
    <p>Si las probabilidades suman más de 100%, se reparten en proporción. Con «Siempre ocurre tal cual», el evento no puede fallar.</p>`},
  peso:{t:'Frecuencia',h:`<p>Más alta significa que el evento aparece más seguido cuando puede ocurrir.</p>`},
  fail:{t:'No sale bien',h:`<p>Es lo que pasa cuando no tocó ningún otro desenlace. Podés darle su propio texto y sus efectos (o dejarlo sin efectos).</p>`},
  token:{t:'Insertar nombres',h:`<p>Cada botón escribe el nombre entre llaves en el texto. En el registro se reemplaza por el personaje u objeto que le haya tocado al evento.</p>`}
};
function helpFor(k){
  if(HELP[k]) return HELP[k];
  if(k.startsWith('ch-')&&typeof CH_HINT!=='undefined'&&CH_HINT[k.slice(3)]) return {t:'Cómo se calcula la probabilidad',h:'<p>'+esc(CH_HINT[k.slice(3)])+'</p>'};
  return null;
}
const helpBtn=k=>`<button type="button" class="q" data-act="help" data-k="${k}" aria-label="Ayuda" title="Ayuda">?</button>`;
let helpOpener=null;
function helpClose(){
  const p=document.getElementById('pop');if(p)p.remove();
  if(helpOpener&&helpOpener.isConnected)helpOpener.focus();
  helpOpener=null;
}
Object.assign(ACT,{
  help(b){
    const d=helpFor(b.dataset.k);if(!d)return;
    helpClose();helpOpener=b;
    const p=document.createElement('div');p.id='pop';p.className='pop';
    p.innerHTML=`<div class="pop-b" role="dialog" aria-modal="true" aria-labelledby="pop-t"><div class="pop-h"><h3 id="pop-t">${esc(d.t)}</h3><button type="button" class="x" data-act="help-close" aria-label="Cerrar ayuda">✕</button></div><div class="pop-c">${d.h}</div></div>`;
    document.body.appendChild(p);
    p.querySelector('[data-act="help-close"]').focus();
  },
  'help-close'(){helpClose();},
  'ev-tab'(b){ui.evTab=b.dataset.t;render();}
});
document.addEventListener('click',e=>{
  const p=document.getElementById('pop');if(!p)return;
  if(e.target===p)helpClose();
  else{const b=e.target.closest('[data-act="help-close"]');if(b&&p.contains(b))helpClose();}
});
document.addEventListener('keydown',e=>{if(e.key==='Escape'&&document.getElementById('pop'))helpClose();});
