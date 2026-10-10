# Simulador Battle Royale

Simulador personalizable: personajes, objetos, habilidades, stats y eventos conectados por reglas lógicas (Y, O, NO). Desde la versión 3 también hay equipos, emociones y eventos con probabilidad de éxito.

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

## Novedades de la etapa 2

- **Equipos**: se pueden armar antes de la partida o nacer durante ella (efectos «Forma un equipo», «Incorpora», «Saca del equipo»). Tienen líder opcional, inventario compartido opcional y un nombre generado con tus palabras (pestaña Equipos). Si un líder se va, lo reemplaza el miembro más leal.
- **Lealtad** (0 a 100) por personaje, para traiciones y discusiones.
- **Emociones**: una por personaje, con ícono y duración en días. Su nombre sirve también como etiqueta de imagen.
- **Probabilidad de éxito** en los eventos (fija, por stat, por tamaño de equipo o por lealtad), con texto y efectos propios si no sale bien.
- Las reglas nuevas se arman igual que las anteriores: equipo, líder, mismo equipo, tamaño de equipo, lealtad, emoción.

Todavía no existen: el editor visual de bloques, los escenarios, «dividirse para buscar recursos» y los estados alterados.

## Qué hay en cada archivo

| Archivo | Para qué sirve |
| --- | --- |
| `index.html` | La página. Carga los demás archivos. |
| `css/estilos.css` | Colores, tipografías y diseño. |
| `js/nucleo.js` | Datos del proyecto y motor de la simulación. |
| `js/equipos.js` | Reglas de equipos y generador de nombres. |
| `js/almacen.js` | Guardado en el navegador, imágenes, exportar e importar. |
| `js/interfaz.js` | Pantallas y botones. |
| `js/interfaz-equipos.js` | Pantallas de equipos y vocabulario. |
| `js/inicio.js` | Arranque. |
