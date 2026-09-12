/* =========================
   CONFIGURACIÓN COMPARTIDA — demo-isometrico
   -------------------------------------------
   Constantes y helpers que usan tanto BootScene como GameScene. Va en su
   propio archivo (no estaba en el árbol de carpetas original del
   documento) para no duplicar números mágicos entre escenas; se carga
   antes que ellas en index.html. Todo aquí son `var` a propósito (no
   `const`/`let`): sin bundler ni módulos, así quedan colgadas de
   `window` y cualquier otro script del juego puede leerlas.
========================= */

// Tamaño de una losa isométrica en pantalla (proporción 2:1, la habitual
// en este tipo de proyección).
var ISO_TILE_W = 128;
var ISO_TILE_H = 64;

// Mapa cuadrado de GRID_SIZE x GRID_SIZE casillas (el encargo pide 10x10
// como mínimo).
var GRID_SIZE = 12;

// Duración del tween de cada paso del jugador (cuadrícula, un paso por
// pulsación — igual de sensación que El Caballero Errante anterior).
var ISO_MOVE_MS = 160;

// Proyección de una casilla de cuadrícula (gx, gy) a coordenadas de
// pantalla (centro de su rombo). Es la única fórmula que hace falta
// para todo el posicionamiento isométrico del juego.
function gridToScreen(gx, gy) {
  return {
    x: (gx - gy) * (ISO_TILE_W / 2),
    y: (gx + gy) * (ISO_TILE_H / 2)
  };
}

// Estado de los controles táctiles (cruceta en pantalla, ver index.html
// y main.js): un objeto global sencillo que GameScene lee en su
// update(), igual que el teclado.
window.isoTouch = { up: false, down: false, left: false, right: false };

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
