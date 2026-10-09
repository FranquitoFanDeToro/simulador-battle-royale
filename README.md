# Simulador Battle Royale

Simulador personalizable: personajes, objetos, habilidades, stats y eventos conectados por reglas lógicas (Y, O, NO).

## Probarlo en tu computadora

Hacé doble clic en `index.html`. No hace falta instalar nada.

## Subirlo a GitHub Pages

1. En github.com tocá **New repository**, ponele un nombre (por ejemplo `battle-royale`), dejalo **Public** y tocá **Create repository**.
2. En la página del repositorio vacío tocá el enlace **uploading an existing file**. Arrastrá **todo el contenido** de esta carpeta (`index.html`, la carpeta `css` y la carpeta `js`) y tocá **Commit changes**. Si tu navegador no deja arrastrar carpetas, subí primero `index.html` y después repetí con cada carpeta usando **Add file → Upload files**.
3. Andá a **Settings → Pages**. En **Source** elegí **Deploy from a branch**, en **Branch** elegí `main` y `/ (root)`, y tocá **Save**.
4. Esperá uno o dos minutos. La dirección queda así: `https://TU-USUARIO.github.io/NOMBRE-DEL-REPO/`.

## Cosas para saber

- **Los datos no viven en GitHub.** Cada persona que abre la página guarda su proyecto en su propio navegador. Para pasarle tu proyecto a alguien, o para tener una copia, usá la pestaña **Datos → Exportar archivo** (incluye las imágenes subidas) y la otra persona lo carga con **Importar**.
- Si venís de la versión anterior de la página, exportá el proyecto allá y cargalo acá: se convierte solo al formato nuevo.
- Las imágenes por URL tienen que ser enlaces directos a la imagen (`https://…`). Si el sitio de origen borra la imagen, deja de verse.
- Los GIF subidos como archivo pueden pesar hasta 8 MB cada uno.

## Qué hay en cada archivo

| Archivo | Para qué sirve |
| --- | --- |
| `index.html` | La página. Carga los demás archivos. |
| `css/estilos.css` | Colores, tipografías y diseño. |
| `js/nucleo.js` | Datos del proyecto y motor de la simulación. |
| `js/almacen.js` | Guardado en el navegador, imágenes, exportar e importar. |
| `js/interfaz.js` | Pantallas y botones. |
| `js/inicio.js` | Arranque. |
