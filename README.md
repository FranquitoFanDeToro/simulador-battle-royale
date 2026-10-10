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

## Novedades de la etapa 3: editor de bloques

Al abrir un evento, la pantalla muestra por defecto el **Programa del evento**: SI (condiciones) → ENTONCES (efectos), armado con bloques de colores.

- Agregá bloques con **＋ Agregar bloque…** (reglas o grupos Y / O / NO) y **＋ Agregar efecto…**.
- Arrastralos desde **⠿** (con mouse o con el dedo) a otro lugar, a otro grupo o, para los efectos, entre «ocurre» y «no sale bien». Alternativa sin arrastrar: **▲ ▼**. También hay **⧉** duplicar y **✕** quitar.
- Los grupos se pueden anidar sin límite; un grupo no se puede meter dentro de sí mismo.
- El botón **Bloques / Formulario** cambia de vista: las dos editan los mismos datos y no se pierde nada. Se recuerda tu elección.

## Novedades de la etapa 4: estados alterados y regla «Es»

- **Estados alterados** (pestaña Estados): quemadura, veneno, aturdimiento, lo que quieras. Cada uno puede
  - **cambiar stats** mientras dura (suma o multiplica; las stats que el personaje no tiene siguen en 0),
  - **impedir actuar** al personaje por su cuenta (sigue pudiendo ser blanco de otros),
  - **hacer algo cada día** con una probabilidad: restar una stat, cambiar la lealtad o eliminarlo,
  - **durar N días** (los N siguientes a aquel en que se aplicó) o hasta que un evento lo quite.
  Un personaje puede tener varios a la vez, y puede empezar con alguno (ficha del personaje).
- **Bloques nuevos**: reglas «tiene el estado» y «tiene algún estado alterado»; efectos «Aplica el estado», «Quita el estado» y «Quita todos los estados». Así se arma, por ejemplo, «si X está quemado y le queda poca Fuerza, puede morir por las quemaduras».
- **Regla «es el personaje»**: «Si X es Valeria, entonces…». Sirve para eventos de un personaje en particular.
- En la simulación se ven los estados en el elenco y en la ficha, junto con las stats ya modificadas («Fuerza 3 (base 4)»). El modo caos también reparte estados al azar.

Todavía no existen: los escenarios y «dividirse para buscar recursos».

## Qué hay en cada archivo

| Archivo | Para qué sirve |
| --- | --- |
| `index.html` | La página. Carga los demás archivos. |
| `css/estilos.css` | Colores, tipografías y diseño. |
| `js/nucleo.js` | Datos del proyecto y motor de la simulación. |
| `js/equipos.js` | Reglas de equipos y generador de nombres. |
| `js/almacen.js` | Guardado en el navegador, imágenes, exportar e importar. |
| `js/interfaz.js` | Pantallas y botones. |
| `js/bloques.js` | Editor visual de bloques (arrastrar, anidar, colores). |
| `js/interfaz-estados.js` | Pantallas de estados alterados. |
| `js/interfaz-equipos.js` | Pantallas de equipos y vocabulario. |
| `js/inicio.js` | Arranque. |
