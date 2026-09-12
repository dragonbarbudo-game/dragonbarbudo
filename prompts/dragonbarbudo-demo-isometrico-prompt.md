# Dragonbarbudo — Demo de Juego Isométrico (Phaser 3)
### Prompt técnico para Claude Code

> Pega este documento completo como primer mensaje a Claude Code para que construya el proyecto.

---

## Contexto

Dragonbarbudo es una web de juegos de mesa / sala social (lobby, amigos, avatares, logros), desplegada como sitio estático en **Cloudflare Pages** (dominio `dragonbarbudo.net`), con backend en **Supabase** (auth, perfiles, amistades, chat).

El objetivo de esta tarea es construir el **primer módulo de una "sala de juegos"** tipo portal (estilo Miniclip / Kongregate / los antiguos portales de Flash), donde cada juego es un paquete autocontenido que se carga en un `<iframe>` dentro de la web principal.

Este documento pide un **demo mínimo pero jugable** de un juego isométrico 2.5D con Phaser 3, que sirva como **plantilla base** para todos los juegos futuros del portal.

## Objetivo de esta tarea

Construir un juego isométrico mínimo y completamente jugable con:

- Un mapa isométrico (grid tipo rombo) de al menos 10x10 casillas.
- Un personaje controlable con teclado (flechas o WASD) que se mueve sobre el grid.
- **Depth sorting** correcto: el personaje se dibuja delante o detrás de otros sprites según su posición Y (para que la perspectiva isométrica no se rompa).
- Al menos un objeto recolectable en el mapa (ej. una moneda) que, al tocarlo, dispara el evento de "recompensa".
- Preparado para comunicarse con la página padre vía `postMessage` (ver contrato abajo), pero debe funcionar también **standalone** (abierto directamente en el navegador), para poder probarlo sin la web principal.

## Stack técnico obligatorio

- **Phaser 3** (última versión estable), vía CDN o npm — decide cuál te resulte más simple, pero documenta la elección en el README.
- **Sin backend propio**: el juego es 100% estático (HTML/JS/CSS/assets), pensado para servirse desde Cloudflare Pages sin funciones ni servidor.
- Preferible que funcione abriendo `index.html` directamente o con un servidor estático simple. Un bundler ligero (Vite) es aceptable si documentas cómo se compila a estático.

## Estructura de carpetas esperada

```
/games/
  /demo-isometrico/
    index.html
    README.md
    /src/
      main.js
      scenes/
        BootScene.js
        GameScene.js
    /assets/
      /tiles/
      /sprites/
```

Esta es la estructura que seguirán **todos los juegos futuros del portal**: cada uno en su propia carpeta bajo `/games/`, totalmente autocontenido, sin tocar código de otros juegos ni del shell principal de Dragonbarbudo.

## Contrato de comunicación con la página padre (postMessage)

El juego debe emitir eventos a `window.parent` en los siguientes momentos, aunque no haya nadie escuchando (para que siga funcionando en modo standalone):

```js
// Al conseguir una recompensa
window.parent.postMessage({
  type: 'dragonbarbudo:reward',
  payload: { coins: 15, achievementId: null }
}, '*');

// Al terminar la partida
window.parent.postMessage({
  type: 'dragonbarbudo:game_over',
  payload: { score: 120 }
}, '*');
```

Documenta en el README del juego qué eventos emite y en qué momento exacto se disparan.

## Requisitos de despliegue

- Todo el contenido debe poder copiarse tal cual a `/games/demo-isometrico/` dentro del repo de Dragonbarbudo y funcionar sirviéndose como archivos estáticos desde Cloudflare Pages, sin variables de entorno ni configuración de servidor.
- Rutas relativas para todos los assets (nada de rutas absolutas que rompan si el juego se monta bajo un subpath).

## Notas de estilo visual

- Estética **isométrica / 2.5D** (no 3D real con motores como Three.js) — sprites 2D pintados en perspectiva isométrica, para mantener el rendimiento y la simplicidad de desarrollo.
- Si no hay assets finales todavía, usa placeholders simples (formas geométricas de colores). Lo importante en esta fase es la mecánica, no el arte final.

## Tareas ordenadas

1. Confirma la estructura de carpetas antes de generar código.
2. Crea el proyecto base con Phaser 3 y el `index.html`.
3. Implementa `BootScene`: carga de assets (tiles isométricos, spritesheet del personaje).
4. Implementa `GameScene`: renderizado del grid isométrico, cámara y controles del personaje.
5. Implementa el depth sorting dinámico según la posición Y del personaje y los objetos.
6. Añade un objeto recolectable con animación simple y su evento de recompensa.
7. Añade el emisor de eventos `postMessage` descrito arriba.
8. Escribe el `README.md` del juego: cómo se ejecuta en local, qué eventos emite, requisitos de assets.
9. Verifica que todo funcione abriendo `index.html` en local sin errores de consola.

Antes de escribir código, confirma conmigo los archivos que vas a crear o modificar.

---

## Siguiente tarea (después de completar el demo)

Cuando el demo isométrico esté terminado y funcionando, la siguiente tarea es definir el **concepto del mapa** del juego, antes de construir ningún mapa final. No lo des por decidido tú solo: propón opciones y confírmalas con el usuario. Puntos a resolver:

- **Tema y ambientación**: qué tipo de mundo es, qué transmite visualmente (esto todavía no está decidido).
- **Escala**: ¿un único mapa grande, o varios mapas/niveles conectados que el jugador va desbloqueando y "pasando" a medida que avanza?
- **Zonas y puntos de interés**: dónde van los recolectables, obstáculos, puntos de guardado dentro del mapa.
- **Relación con el guardado en la nube** (tabla `game_saves`): qué datos del mapa hay que persistir para poder "continuar" — nivel/mapa actual, posición del jugador, elementos ya recolectados, mapas ya desbloqueados.

El resultado de esta tarea debe ser un mini-documento de concepto (aunque sea breve) antes de tocar código del mapa final.
