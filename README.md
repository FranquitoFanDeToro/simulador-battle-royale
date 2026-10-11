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

## Novedades de la etapa 5: elementos de evento y mejoras
- **Elementos del evento**: un evento puede elegir solo objetos, habilidades, estados alterados y equipos, y nombrarlos en el texto (`{Objeto1}`, `{Habilidad1}`, `{Estado1}`, `{Equipo1}`). Se definen en la sección «Elementos del evento» (de un participante, o cualquiera del proyecto; con la restricción «que Y no tenga»). Si no se puede elegir, el evento no ocurre.
- **Efectos nuevos**: pasar un objeto de uno a otro, intercambiar objetos, eliminar a un equipo entero, y que dos equipos peleen hasta la muerte. Los eventos de ejemplo incluyen cinco casos (intercambio, regalo, copiar habilidad, sopa extraña, pelea de equipos).
- **Límites por stat** (mínimo y máximo para cada una), **emoji o imagen como ícono** de objetos y habilidades, **orden y filtros** (A→Z, letra inicial, por stats, objetos, habilidades, estados, equipos) y la imagen de la ficha del personaje ya no se estira.
- Los proyectos viejos se actualizan solos al cargarlos (versión 5).

## Novedades de la etapa 6: eventos más potentes
- **Elementos del evento con filtros**: además de «lo que tiene un participante» o «cualquiera del proyecto», ahora se pueden elegir **a mano** (una lista, o «todos menos…»), **por categorías** (también los estados tienen categoría), por lo que otros participantes **tienen o no tienen**, por el **tamaño** del objeto o de los integrantes de un equipo, y por si el equipo tiene líder. No hay límite de elementos.
- **Participantes sin límite**: hasta tantos como personajes haya (X, Y, Z, W, A, B… y después X1, Y1…). Una regla puede aplicarse a **varios participantes** («todos» o «alguno» de ellos) y casi todos los efectos pueden afectar a varios a la vez. «Formar un equipo» y «Incorporar a un equipo» aceptan más de dos.
- **Y/O combinados**: un grupo puede ser «Y/O · mezcla»; entre cada regla aparece una Y o una O que se cambia tocándola. La Y se resuelve antes que la O: «A y B o C» es «(A y B) o C». Para otro orden, se usa un grupo dentro de otro.
- **Equipos en el registro**: cuando un evento habla de un equipo (un elemento «Equipo») o un participante tiene marcado «con todo su equipo», salen todos sus integrantes en un recuadro con el nombre del equipo, aparte de los demás.
- **Resultado con varios desenlaces**: «Sale bien», cualquier cantidad de desenlaces extra (con nombre, probabilidad, texto y efectos propios) y «No sale bien», que se lleva lo que sobre. Si las probabilidades suman más de 100%, se reparten en proporción.
- **Probabilidad calculada con bloques**: se parte de un porcentaje base y cada paso (con su propia condición, también armada con bloques) suma, multiplica o fija el porcentaje; el valor puede salir de una stat, la diferencia de stats entre dos participantes, la lealtad o el tamaño de los equipos.
- Los proyectos de versiones anteriores se actualizan solos al abrirlos (versión 6).

## Novedades de la etapa 7: cooldown, navegación e íconos

- **Tiempo muerto de habilidades**: en la pestaña Habilidades elegís, para cada una, «sin espera» (se puede repetir), «cada N días» o «una sola vez». Se aplica con la regla **«puede usar la habilidad»** (la gasta cuando el evento ocurre) y el efecto **«Marca como usada la habilidad»** para gastarla a mano. En la ficha de la simulación se ve cuándo vuelve a estar lista. El modo caos la reinicia.
- **Anterior / siguiente** al abrir un personaje, equipo, estado o evento (respeta el orden y filtros de la lista).
- **Botones {X}, {Y}…** también en el texto de cada desenlace y en «no sale bien», con vista previa.
- **Íconos**: las pestañas tienen íconos propios. Para usar tus imágenes, ponelas en `img/` y escribí su ruta en `js/imagenes.js`.

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
| `js/interfaz-elementos.js` | Sección «Elementos del evento» (de dónde salen y filtros). |
| `js/interfaz-resultado.js` | Sección «Resultado»: probabilidad por bloques y desenlaces. |
| `js/interfaz-equipos.js` | Pantallas de equipos y vocabulario. |
| `js/interfaz-nav.js` | Botones anterior / siguiente. |
| `js/iconos.js` | Íconos de la interfaz. |
| `js/imagenes.js` | Tus imágenes para reemplazar los íconos (opcional). |
| `img/` | Carpeta para esas imágenes. |
| `js/inicio.js` | Arranque. |
