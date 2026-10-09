'use strict';
/* =====================================================================
   ALMACÉN: guardado en el navegador (IndexedDB), imágenes, exportar e
   importar. IndexedDB tiene mucho más espacio que localStorage, por eso
   sirve para fotos y GIFs.

   - Tabla "project": el proyecto completo (P) bajo la clave "main".
   - Tabla "blobs":   los archivos de imagen subidos, por id.
   Las imágenes por URL no se descargan: solo se guarda el enlace.
   ===================================================================== */

const STORE={ok:false,db:null};
const BLOBURL={};                       // id de imagen -> URL temporal para mostrarla
const MAX_GIF=8*1024*1024;              // los GIF se guardan tal cual (para no perder la animación)

function storeInit(){
  return new Promise(res=>{
    if(!window.indexedDB){res(false);return;}
    let r;
    try{r=indexedDB.open('simulador-battle-royale',1);}catch(e){res(false);return;}
    r.onupgradeneeded=()=>{const d=r.result;d.createObjectStore('project');d.createObjectStore('blobs');};
    r.onsuccess=()=>{STORE.db=r.result;res(true);};
    r.onerror=()=>res(false);
    r.onblocked=()=>res(false);
  });
}
function dbTx(store,mode,fn){
  return new Promise((res,rej)=>{
    try{
      const tx=STORE.db.transaction(store,mode);
      const rq=fn(tx.objectStore(store));
      tx.oncomplete=()=>res(rq?rq.result:undefined);
      tx.onerror=()=>rej(tx.error);
      tx.onabort=()=>rej(tx.error);
    }catch(e){rej(e);}
  });
}
const dbGet=(s,k)=>dbTx(s,'readonly',st=>st.get(k));
const dbPut=(s,k,v)=>dbTx(s,'readwrite',st=>st.put(v,k));
const dbDel=(s,k)=>dbTx(s,'readwrite',st=>st.delete(k));
const dbKeys=s=>dbTx(s,'readonly',st=>st.getAllKeys());

/* ---------- Guardar el proyecto ---------- */
let _saveTimer=0;
function saveSoon(){clearTimeout(_saveTimer);_saveTimer=setTimeout(saveNow,300);}
async function saveNow(){
  if(!STORE.ok){setSaveLabel();return;}
  try{await dbPut('project','main',JSON.parse(JSON.stringify(P)));}
  catch(e){STORE.ok=false;}
  setSaveLabel();
}
async function loadSavedProject(){
  if(!STORE.ok) return null;
  try{return normalize(await dbGet('project','main'));}catch(e){return null;}
}

/* ---------- Imágenes ---------- */
async function loadBlobs(){
  if(!STORE.ok) return;
  try{
    const keys=await dbKeys('blobs');
    for(const k of keys){const b=await dbGet('blobs',k);if(b)BLOBURL[k]=URL.createObjectURL(b);}
  }catch(e){}
}
async function gcBlobs(){
  if(!STORE.ok) return;
  try{
    const used=new Set();
    P.chars.forEach(c=>c.imgs.forEach(i=>{if(i.kind==='file')used.add(i.id);}));
    for(const k of await dbKeys('blobs')){
      if(!used.has(k)){await dbDel('blobs',k);if(BLOBURL[k]){URL.revokeObjectURL(BLOBURL[k]);delete BLOBURL[k];}}
    }
  }catch(e){}
}
function imgSrc(im){return im.kind==='file'?(BLOBURL[im.id]||''):im.src;}
/* Imagen de un personaje. Con etiqueta busca una que la tenga; si no hay, usa la principal (la primera). */
function lookSrc(c,tag){
  const list=c.imgs||[];
  if(!list.length) return '';
  const t=(tag||'').trim().toLowerCase();
  const pool=t?list.filter(i=>(i.tag||'').trim().toLowerCase()===t):[];
  const pick=pool.length?pool[Math.floor(Math.random()*pool.length)]:list[0];
  return imgSrc(pick);
}
function loadImage(url){
  return new Promise((res,rej)=>{const im=new Image();im.onload=()=>res(im);im.onerror=()=>rej(new Error('imagen'));im.src=url;});
}
async function fileToBlob(file){
  const t=file.type;
  if(t==='image/gif'||t==='image/svg+xml'){
    if(file.size>MAX_GIF) throw new Error('grande');
    return file;
  }
  if(!/^image\//.test(t)) throw new Error('tipo');
  const u=URL.createObjectURL(file);
  try{
    const im=await loadImage(u);
    const M=512,k=Math.min(1,M/Math.max(im.naturalWidth,im.naturalHeight));
    const w=Math.max(1,Math.round(im.naturalWidth*k)),h=Math.max(1,Math.round(im.naturalHeight*k));
    const cv=document.createElement('canvas');cv.width=w;cv.height=h;
    cv.getContext('2d').drawImage(im,0,0,w,h);
    const type=t==='image/png'?'image/png':'image/jpeg';
    return await new Promise((res,rej)=>cv.toBlob(b=>b?res(b):rej(new Error('blob')),type,0.86));
  }finally{URL.revokeObjectURL(u);}
}
async function addFileImage(file){
  const blob=await fileToBlob(file);
  const id=uid()+uid();
  if(STORE.ok) await dbPut('blobs',id,blob);
  BLOBURL[id]=URL.createObjectURL(blob);
  return {id,kind:'file',src:'',tag:''};
}
function removeImageData(im){
  if(im.kind!=='file') return;
  if(STORE.ok) dbDel('blobs',im.id).catch(()=>{});
  if(BLOBURL[im.id]){URL.revokeObjectURL(BLOBURL[im.id]);delete BLOBURL[im.id];}
}

/* ---------- Exportar e importar ---------- */
function blobToDataURL(b){
  return new Promise((res,rej)=>{const r=new FileReader();r.onload=()=>res(r.result);r.onerror=()=>rej(r.error);r.readAsDataURL(b);});
}
async function buildExport(){
  const o=JSON.parse(JSON.stringify(P));
  o._blobs={};
  for(const c of o.chars){
    for(const im of c.imgs){
      if(im.kind==='file'&&BLOBURL[im.id]){
        const b=await (await fetch(BLOBURL[im.id])).blob();
        o._blobs[im.id]=await blobToDataURL(b);
      }
    }
  }
  return JSON.stringify(o);
}
/* Devuelve un proyecto listo para usar (ya con sus imágenes guardadas) o lanza un error. */
async function importProjectText(text){
  const obj=JSON.parse(text);
  const p=normalize(obj);
  if(!p||!(p.chars.length||p.events.length||p.items.length||p.skills.length||p.stats.length)) throw new Error('vacío');
  const bl=(obj&&obj._blobs&&typeof obj._blobs==='object')?obj._blobs:{};
  for(const c of p.chars){
    for(const im of c.imgs){
      if(im.kind!=='file') continue;
      const du=bl[im.id];
      if(typeof du==='string'&&du.indexOf('data:')===0){
        const b=await (await fetch(du)).blob();
        if(STORE.ok) await dbPut('blobs',im.id,b);
        BLOBURL[im.id]=URL.createObjectURL(b);
      }
    }
    c.imgs=c.imgs.filter(im=>im.kind!=='file'||BLOBURL[im.id]);
  }
  return p;
}
