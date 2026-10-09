'use strict';
/* =====================================================================
   INICIO: abre el guardado, carga el proyecto y dibuja la página.
   ===================================================================== */
(async function(){
  STORE.ok=await storeInit();
  await loadBlobs();
  P=(await loadSavedProject())||sampleProject();
  setSaveLabel();
  render();
  saveSoon();
  gcBlobs();
})();
