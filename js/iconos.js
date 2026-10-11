'use strict';
/* Íconos de la interfaz: dibujos simples de trazo (heredan el color del texto).
   Si hay una imagen propia en IMAGENES (js/imagenes.js), se usa esa en su lugar. */
const ICONOS={
  chars:'<circle cx="12" cy="8" r="4"/><path d="M4 21c0-4.4 3.6-7 8-7s8 2.6 8 7"/>',
  teams:'<circle cx="9" cy="8" r="3.5"/><circle cx="17" cy="9" r="2.8"/><path d="M2.5 20c0-3.8 2.9-6 6.5-6s6.5 2.2 6.5 6M16 14.3c3.2.2 5.5 2 5.5 5.2"/>',
  items:'<path d="M4 8l8-4 8 4v9l-8 4-8-4z"/><path d="M4 8l8 4 8-4M12 12v9"/>',
  skills:'<path d="M13 2L5 14h6l-1 8 8-12h-6z"/>',
  stats:'<path d="M5 20V10M12 20V4M19 20v-7"/>',
  emotions:'<circle cx="12" cy="12" r="9"/><path d="M8 14.5c1 1.5 2.4 2.2 4 2.2s3-.7 4-2.2M9 9.5h.01M15 9.5h.01"/>',
  states:'<path d="M12 3c3 4 6 6 6 10a6 6 0 0 1-12 0c0-4 3-6 6-10z"/>',
  events:'<rect x="5" y="3" width="14" height="18" rx="2"/><path d="M9 8h6M9 12h6M9 16h4"/>',
  sim:'<circle cx="12" cy="12" r="9"/><path d="M10 8.5l6 3.5-6 3.5z"/>',
  scenes:'<path d="M3 19l5.5-9 4 6 3-4L21 19z"/><circle cx="17" cy="6.5" r="2"/>',
  data:'<ellipse cx="12" cy="6" rx="7" ry="3"/><path d="M5 6v12c0 1.7 3.1 3 7 3s7-1.3 7-3V6M5 12c0 1.7 3.1 3 7 3s7-1.3 7-3"/>',
  cooldown:'<path d="M6 3h12M6 21h12M7 3v3l5 6-5 6v3M17 3v3l-5 6 5 6v3"/>',
  dead:'<path d="M12 3a7 7 0 0 0-7 7c0 2.4 1.2 4 3 5v3h8v-3c1.8-1 3-2.6 3-5a7 7 0 0 0-7-7z"/><path d="M9.5 10.5h.01M14.5 10.5h.01M10 21v-3M14 21v-3"/>',
  logo:'<circle cx="12" cy="12" r="9"/><path d="M12 6v12M6 12h12"/>'
};
/* Devuelve el ícono listo para pegar en el HTML. */
function icon(name,cls){
  const own=(typeof IMAGENES!=='undefined'&&IMAGENES[name])||'';
  if(own) return `<img class="uic ${cls||''}" src="${esc(own)}" alt="" data-fb="1">`;
  const d=ICONOS[name];
  return d?`<svg class="uic ${cls||''}" viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${d}</svg>`:'';
}
