# El Caballero Errante — Demo Isométrica

Primer juego del portal de Dragonbarbudo construido con la plantilla
"juego autocontenido en `/games/<nombre>/`": todo su HTML/CSS/JS vive en
esta carpeta, no depende de nada del sitio principal, y se comunica con
él (cuando lo hay) solo por `postMessage`. Sirve de plantilla base para
los juegos futuros del portal.

## Stack técnico

- **Phaser 3.70.0 vía CDN** (`https://cdn.jsdelivr.net/npm/phaser@3.70.0/dist/phaser.min.js`),
  sin npm ni bundler: así `index.html` se abre directamente (doble clic,
  o cualquier servidor estático) sin paso de compilación, y se despliega
  en Cloudflare Pages copiando la carpeta tal cual.
- Sin backend propio: 100% estático, sin variables de entorno.
- Scripts clásicos (`<script src="...">`), sin módulos ES ni `import`:
  las clases `BootScene`/`GameScene` y las constantes de `config.js`
  quedan colgadas del `window`, por eso el orden de carga en
  `index.html` importa (`config.js` → `BootScene.js` → `GameScene.js` →
  `main.js`).

## Cómo ejecutarlo en local

Abrir `index.html` directamente en el navegador ya funciona (no hace
falta servidor). Si prefieres servirlo (por ejemplo para probar el
`postMessage` embebido en un iframe real), cualquier servidor estático
sirve, p. ej. desde la raíz del repo:

```bash
powershell -File "ClaudeCode\serve.ps1" -Port 5510
```

y abrir `http://localhost:5510/games/demo-isometrico/`.

## Qué hace la demo

- Mapa isométrico de 12x12 casillas (`GRID_SIZE` en `src/config.js`),
  proyección 2:1 (`gridToScreen()`).
- Personaje controlable con flechas o WASD, movimiento en cuadrícula
  (un paso por pulsación; mantener la tecla sigue andando).
- **Depth sorting dinámico**: la profundidad del jugador se recalcula en
  cada frame de su propio movimiento según su Y real en pantalla
  (`this.player.setDepth(1000 + this.player.y)`), así se dibuja delante
  o detrás de los árboles según por dónde pasa exactamente.
- 6 árboles como props que bloquean el paso y sirven para demostrar el
  depth sorting; 5 monedas recolectables con animación de flotación.
- Al recoger cada moneda se emite `dragonbarbudo:reward`; al recogerlas
  todas se emite `dragonbarbudo:game_over` y se muestra un cartel de
  "¡Completado!" en pantalla.
- Cruceta táctil en pantalla (esquina inferior izquierda) además de
  teclado — pensado para tablet/móvil, no solo PC.

## Controles

| Acción    | Teclado       | Táctil            |
|-----------|---------------|-------------------|
| Moverse   | Flechas / WASD | Cruceta en pantalla |

## Contrato `postMessage` con la página padre

Todos los mensajes van a `window.parent` con `postMessage(data, '*')`
(`emitToParent()` en `src/config.js`). Si no hay padre real (se abrió
`index.html` suelto), el mensaje se manda a la propia ventana sin
efecto — el juego funciona igual.

```js
// Al recoger una moneda (una vez por moneda, 5 veces en total)
{ type: 'dragonbarbudo:reward', payload: { coins: 15, achievementId: null } }

// Al recoger la última moneda (fin de la partida)
{ type: 'dragonbarbudo:game_over', payload: { score: 75 } } // score = monedas recogidas × 15
```

También emite `dragonbarbudo:ready` (sin payload) en cuanto arranca
`GameScene`. No forma parte del contrato pedido originalmente — es
opcional, solo para que la página padre sepa que el juego ya cargó si
alguna vez le interesa saberlo; puede ignorarse sin problema.

## Requisitos de assets (cuando haya arte final)

Ahora mismo **no hay imágenes**: `BootScene.buildPlaceholderTextures()`
dibuja a mano con `Phaser.Graphics` todo lo que se ve (losas, jugador,
monedas, árboles) — formas planas de colores con contorno, sin depender
de ningún archivo. Para sustituirlo por arte real:

1. Añade los ficheros a `assets/tiles/` (losas del suelo) y
   `assets/sprites/` (personaje, monedas, árboles/props).
2. En `BootScene.preload()`, añade `this.load.image('tile_a',
   'assets/tiles/xxx.png')` (o `this.load.spritesheet(...)` si el
   personaje necesita animación) usando las **mismas claves** que ya
   consume `GameScene` (`tile_a`, `tile_b`, `player`, `coin`, `tree`) —
   así no hace falta tocar `GameScene.js` para nada.
3. Borra la llamada a `buildPlaceholderTextures()` en
   `BootScene.create()` (o déjala como *fallback* si prefieres detectar
   si la imagen cargó).
4. Ajusta `ISO_TILE_W`/`ISO_TILE_H` en `src/config.js` si el tamaño real
   de tus losas no es 128x64.

## Estructura de carpetas

```
games/demo-isometrico/
  index.html          — shell HTML + cruceta táctil + carga de scripts
  README.md           — este archivo
  src/
    config.js         — constantes compartidas + gridToScreen() + emitToParent()
    main.js            — arranque de Phaser.Game + controles táctiles
    scenes/
      BootScene.js     — genera (o cargará) las texturas
      GameScene.js     — grid, jugador, props, monedas, depth sorting
  assets/
    tiles/             — vacío por ahora (ver "Requisitos de assets")
    sprites/           — vacío por ahora
```
