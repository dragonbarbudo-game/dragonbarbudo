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

/* =========================
   MENÚ, GUARDADO EN SOLITARIO Y MULTIJUGADOR (v3)
   -------------------------------------------------
   uid: la página padre abre el iframe con ?uid=<id de usuario>, así el
   guardado de la partida en solitario vive en localStorage bajo el
   MISMO origen que el sitio principal (games/demo-isometrico/ se sirve
   del mismo dominio, no hace falta postMessage para esto) y ligado a
   cada cuenta, igual que el resto del progreso del sitio
   (tablehostState_<uid>).
========================= */
function getUrlParam(name) {
  return new URLSearchParams(window.location.search).get(name);
}
var ISO_UID = getUrlParam('uid') || 'guest';
function isoSaveKey() { return 'isoSave_' + ISO_UID; }

// Guarda posición + qué monedas van recogidas (por índice, ver
// coinSpots en GameScene). Solo tiene sentido en solitario — las
// partidas con amigos no se guardan (decisión explícita: "Continuar"
// solo recupera tu propia partida).
function isoSaveProgress(worldX, worldY, collectedIndexes) {
  try {
    localStorage.setItem(isoSaveKey(), JSON.stringify({ worldX, worldY, collectedIndexes, ts: Date.now() }));
  } catch (e) { /* localStorage bloqueado (privado a tope, etc.): no pasa nada, simplemente no se guarda */ }
}
function isoLoadProgress() {
  try {
    const raw = localStorage.getItem(isoSaveKey());
    return raw ? JSON.parse(raw) : null;
  } catch (e) { return null; }
}
function isoClearProgress() {
  try { localStorage.removeItem(isoSaveKey()); } catch (e) { /* nada que limpiar */ }
}

// Ajustes (silenciar sonido para cuando lo haya): un solo interruptor,
// por dispositivo, no por cuenta.
function isoIsMuted() {
  try { return localStorage.getItem('isoMuted') === '1'; } catch (e) { return false; }
}
function isoSetMuted(muted) {
  try { localStorage.setItem('isoMuted', muted ? '1' : '0'); } catch (e) { /* no pasa nada */ }
}
