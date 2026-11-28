# tuweeb — cómo trabajar en este repo

El dueño del proyecto (Argentina, español rioplatense con voseo) NO es técnico y no sabe qué optimizaciones existen.
Hablarle en simple, sin jerga. No esperar a que pida los detalles: anticiparlos.

## Regla principal: probar como un cliente, no solo la pieza
Antes de decir "listo", recorrer el flujo completo como lo haría quien usa el sitio, desde el celular:
- Sitio 3D → botón Reservar → elegir día/horario → datos → confirmación → volver al sitio.
- Panel del dueño: instalar como app, entrar, ver agenda, cargar reserva, volver.
- Buscar proactivamente: recargas innecesarias, esperas sin aviso, cosas que se tapan entre sí, botones que no se ven sobre cualquier fondo, textos apretados, pantallas vacías o sin explicación, cosas que se pierden al volver atrás.
- Pensar en peso y velocidad en celular (el sitio 3D es lo más pesado: no recargarlo, no duplicar trabajo).
- Cada vez que se arregla algo, preguntarse "¿qué otro lugar tiene el mismo problema?" y arreglarlo también.
- Informar lo encontrado y corregido en una o dos frases, sin pedir permiso para lo que es claramente una mejora.

## Cómo ver el sitio 3D real en el sandbox
El sandbox no llega a esm.sh/unpkg. Se puede renderizar igual: instalar con npm three@0.160.0, @react-three/fiber@8.17.10, @react-three/drei@9.114.3, @react-three/postprocessing@2.16.3, postprocessing@6.36.4, zustand@4.5.5, react@18.3.1, react-dom@18.3.1, lenis@1.1.18, @babel/standalone@7.25.6; empaquetarlos con esbuild como módulos ESM (react/react-dom son CJS: exponerlos por globalThis para los require internos) y servirlos con Playwright `page.route` en lugar de las URLs del importmap. Chromium con `--use-gl=angle --use-angle=swiftshader`. Es lento (1–5 min por carga): sacar varias tomas por carga cambiando el scroll, no abrir un navegador por toma. El editor también corre así y su botón "Exportar index.html" se puede disparar con Playwright y capturar la descarga.

## Estructura
- `editor/editor.html`: editor madre. Los cambios al visor/exportación van acá Y en `proyectos/<cliente>/editor.html`.
- `proyectos/<cliente>/`: sitio de cada cliente (index.html exportado, editor.html con el proyecto embebido, `reservar/`, `panel/`).
- `reservas/`: backend Apps Script (`backend/Codigo.gs`), plantillas de panel y reservas, `herramientas/armar_cliente.py`, README con decisiones.
- `biblioteca/`: piezas 3D reutilizables.
- Después de tocar plantillas de reservas: regenerar con armar_cliente.py, correr `node reservas/backend/test/e2e/panel.test.js` y `reservar.test.js`.
- Después de tocar el visor: re-exportar index.html desde el editor (ver arriba) y publicar. Todo se publica con GitHub Pages desde `main`.
- Commits terminan con los trailers de atribución indicados por la sesión.

## Estilo
Reservas y panel: oscuro con vidrio translúcido, paleta tuweeb (violeta + naranja #e8693a), Montserrat, logo de tuweeb por defecto. Botones flotantes del sitio: vidrio oscuro sin borde, barra única centrada.

## Pensar como especialista antes de tocar
Ante cualquier problema (lentitud, peso, algo que se ve mal), primero preguntarme qué haría un especialista en 3D y en webs de este tipo, y hacer eso directamente, sin medir ni parchar de a poco hasta que me lo pidan. Medir solo para confirmar el resultado, no para encontrar el camino.
Lo que un especialista haría siempre acá:
- Preparar de antemano lo pesado (piezas 3D ya armadas, modelos comprimidos) y no construirlo al abrir el sitio.
- Empezar a bajar lo pesado desde el primer segundo, en paralelo con el código.
- Que el cargador muestre progreso real (nunca un contador clavado en 000).
- Mirar los números en el celular y en la PC, en visita nueva (incógnito) y en visita repetida.

## Regla: toda mejora va a la plantilla, no solo al cliente
Nunca arreglar o mejorar algo en la web de un cliente (ej. Planeta Niños) sin llevarlo también a lo que se usa para armar las próximas: la demo (`demo-repo`), la plantilla de reservas/panel (`reservas/plantillas`, que usa `armar_cliente.py`), el editor madre (`editor/editor.html`) y la fábrica si corresponde. Si no, hay que rehacer lo mismo en cada web nueva.
- Al terminar una mejora: preguntarse "¿dónde más vive este código?" y aplicarla ahí en el mismo trabajo (con la misma verificación).
- Excepción: Quokka (`quokka/`) no se toca salvo que Ronaldo lo pida.
- Webs con marca propia ya definida (colores originales, no los de la ficha): se agrega `<script>window.TUWEEB_PROPIO=true</script>` antes de `tema.js` y la web no se repinta con la paleta de la demo (tema.js v49+).
- Lo que es solo estilo de un cliente (su fondo de invitación, su video, sus colores) queda en el cliente; todo lo demás (errores, textos, orden, guardado, botones, iconos) va a la plantilla.

## Regla: nada en modo prueba sobre el admin, las demos ni las webs de clientes
Está prohibido publicar o desplegar experimentos, pruebas o ideas a medio terminar en el admin, en las demos (`demo-repo`, la fábrica, `demo.tuweeb.com`) ni en las webs de clientes (lo que ve un cliente o un salón). Lo que se publica ahí tiene que estar probado y ser algo que Ronaldo ya pidió dejar funcionando.
- Probar siempre aparte: en local, con una copia o en una rama que no se publica. Nunca en `main` ni en el sistema (Apps Script) que usan las demos y los clientes.
- Si una idea necesita verse en vivo, se pide permiso antes de publicarla y se deja apagada por defecto.
- Si algo de prueba llegó a publicarse, sacarlo enseguida y avisarle a Ronaldo.
