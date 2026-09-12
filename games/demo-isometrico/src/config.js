/* =========================
   CONFIGURACIÓN COMPARTIDA — demo-isometrico
   -------------------------------------------
   Constantes y helpers que usan tanto BootScene como GameScene. Todo
   son `var` a propósito (no `const`/`let`): sin bundler ni módulos, así
   quedan colgadas de `window` y cualquier script del juego puede leerlas.

   MOVIMIENTO LIBRE + MAPA CUADRADO (v2): el usuario pidió poder moverse
   en cualquier ángulo (no solo 4 direcciones en cuadrícula) y que el
   mapa se vea cuadrado/rectangular, no en rombo. Así que el mundo es un
   plano 2D normal (worldX, worldY en píxeles, con movimiento continuo)
   y solo se "aplasta" verticalmente al proyectarlo a pantalla
   (ISO_SQUISH) para conservar algo de sensación 2.5D — ese aplastado es
   uniforme, así que el mapa sigue siendo un rectángulo perfecto, nunca
   un rombo (un rombo solo aparece si además rotas los ejes 45°, que es
   lo que hacía la versión isométrica "de verdad" anterior).
========================= */

var TILE_SIZE = 80;                 // lado de cada losa del suelo, en el plano del mundo
var GRID_SIZE = 12;                 // mapa de GRID_SIZE x GRID_SIZE losas (>=10x10 pedido)
var MAP_SIZE = TILE_SIZE * GRID_SIZE; // mundo cuadrado de MAP_SIZE x MAP_SIZE píxeles
var ISO_SQUISH = 0.86;              // aplastado vertical al proyectar a pantalla (look 2.5D)

var PLAYER_SPEED = 240;             // píxeles de mundo por segundo, en cualquier ángulo
var PLAYER_RADIUS = 16;
var TREE_RADIUS = 24;
var COIN_RADIUS = 26;

// Proyección: el mundo es un plano normal, solo se aplasta la Y al
// dibujar. Es la única fórmula que hace falta para todo el
// posicionamiento en pantalla (suelo, jugador, árboles, monedas).
function worldToScreen(wx, wy) {
  return { x: wx, y: wy * ISO_SQUISH };
}

// Estado del joystick táctil (ver index.html/main.js): dx/dy en
// [-1, 1], GameScene los lee en su update() igual que el teclado. Un
// joystick por arrastre permite cualquier ángulo, no solo 4/8
// direcciones — el teclado sigue limitado a como muerdan las teclas,
// pero al menos ya no obliga a girar antes de andar ni fuerza los 4 ejes.
window.isoJoystick = { active: false, dx: 0, dy: 0 };

// Contrato de comunicación con la página padre (ver README.md). Sigue
// funcionando en modo standalone: si no hay padre real, postMessage
// simplemente se manda a la propia ventana y no lo escucha nadie.
function emitToParent(type, payload) {
  try {
    window.parent.postMessage({ type, payload }, '*');
  } catch (e) {
    // Contextos muy restrictivos (raro, pero posible): no rompe el juego.
  }
}
