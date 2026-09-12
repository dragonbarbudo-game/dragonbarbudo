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
// El mapa es un único mundo que va creciendo (ver prompts/dragonbarbudo-
// concepto-mapa.md): GRID_COLS/GRID_ROWS por separado (no un GRID_SIZE
// cuadrado) porque las zonas nuevas se añaden hacia un lado, no en las
// cuatro direcciones a la vez. Zona 1 (Claro del Bosque) eran las
// primeras 12 columnas; Zona 2 (Camino de las Ruinas) añade 8 más.
var GRID_COLS = 20;
var GRID_ROWS = 12;
var MAP_W = TILE_SIZE * GRID_COLS;  // mundo rectangular de MAP_W x MAP_H píxeles
var MAP_H = TILE_SIZE * GRID_ROWS;  // (rectangular, nunca en rombo — ver worldToScreen)
var ISO_SQUISH = 0.86;              // aplastado vertical al proyectar a pantalla (look 2.5D)

var PLAYER_SPEED = 240;             // píxeles de mundo por segundo, en cualquier ángulo
var PLAYER_RADIUS = 16;
var TREE_RADIUS = 24;
var RUIN_RADIUS = 28;
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

// ¿El dispositivo se maneja principalmente por tacto? (hover:none +
// pointer:coarse = no hay ratón/trackpad como entrada principal, solo
// dedo). Es justo lo que distingue tablet/móvil de un PC con pantalla
// táctil pero ratón de verdad — un táctil "de sobra" en PC no cuenta.
// Se usa para no mostrar el joystick en pantalla si de todas formas
// nadie va a usarlo con el dedo (ver isoUpdateJoystickVisibility en
// main.js).
function isoIsTouchDevice() {
  try { return window.matchMedia('(hover: none) and (pointer: coarse)').matches; } catch (e) { return false; }
}

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

// El Mapa del Reino no está disponible desde el principio: hay que
// encontrarlo (un mapa viejo escondido en La Taberna del Cuervo, ver
// TavernScene.buildMapItem) antes de que el botón "🗺️ Mapa" aparezca.
// Ligado a la partida en solitario, igual que el resto del progreso —
// "Nueva partida" lo reinicia (ver isoStartSolo en main.js).
function isoHasMapKey() { return 'isoHasMap_' + ISO_UID; }
function isoHasMap() {
  try { return localStorage.getItem(isoHasMapKey()) === '1'; } catch (e) { return false; }
}
function isoSetHasMap(has) {
  try { localStorage.setItem(isoHasMapKey(), has ? '1' : '0'); } catch (e) { /* no pasa nada */ }
}

/* =========================
   MAPA DEL REINO (pantalla navegable, ver prompts/dragonbarbudo-
   concepto-mapa.md) — se revela según se explora, como en Hollow Knight.
   -------------------------------------------------------------------
   Cada zona tiene una forma orgánica fija (cx/cy/rx/ry/seed, en el
   espacio propio del mapa — nada que ver con las coordenadas del
   mundo jugable) y, SOLO si ya existe de verdad en el juego, un
   `region` que dice qué rango de worldX en GameScene cae dentro de
   ella. Las zonas sin `region` todavía no se pueden pisar — salen
   siempre bloqueadas (silueta gris, sin nombre) hasta que se
   construyan y se les añada su region aquí.
========================= */
var WORLD_ZONES = [
  { id: 'bosque', name: 'Claro del Bosque', cx: 480, cy: 680, rx: 125, ry: 85, color: '#6fae63', seed: 55, region: { min: 0, max: 800 } },
  { id: 'taberna', name: 'La Taberna del Cuervo', cx: 300, cy: 800, rx: 100, ry: 68, color: '#c98a3a', seed: 66, interior: true },
  { id: 'ruinas', name: 'Camino de las Ruinas', cx: 470, cy: 460, rx: 125, ry: 85, color: '#9a8a5a', seed: 44, region: { min: 800, max: 1600 } },
  { id: 'cuenca', name: 'Cuenca Antigua', cx: 570, cy: 880, rx: 145, ry: 78, color: '#7d7364', seed: 77 },
  { id: 'pantano', name: 'Pantano Putrefacto', cx: 230, cy: 550, rx: 130, ry: 92, color: '#6f8a4f', seed: 33 },
  { id: 'canon', name: 'Cañón de la Niebla', cx: 110, cy: 320, rx: 115, ry: 85, color: '#7fa876', seed: 22 },
  { id: 'cumbres', name: 'Cumbres Heladas', cx: 160, cy: 110, rx: 115, ry: 78, color: '#8fb3c9', seed: 11 },
  { id: 'aldea', name: 'Aldea de los Viajeros', cx: 760, cy: 470, rx: 130, ry: 92, color: '#c9a23a', seed: 111 },
  { id: 'torre', name: 'Torre del Reloj', cx: 730, cy: 200, rx: 115, ry: 85, color: '#8b7fc9', seed: 88 },
  { id: 'cripta', name: 'Cripta Real', cx: 930, cy: 100, rx: 125, ry: 78, color: '#9c6fa8', seed: 99 },
  { id: 'cementerio', name: 'Cementerio Olvidado', cx: 1010, cy: 370, rx: 125, ry: 85, color: '#5a6b7a', seed: 122 },
  { id: 'catacumbas', name: 'Catacumbas', cx: 1050, cy: 610, rx: 115, ry: 85, color: '#4f4a5a', seed: 133 },
  { id: 'limite', name: 'Límite del Reino', cx: 1150, cy: 220, rx: 108, ry: 78, color: '#a85a5a', seed: 144 },
  { id: 'castillo', name: 'Castillo del Horizonte', cx: 890, cy: 820, rx: 145, ry: 85, color: '#5a5a8b', seed: 155 }
];
var WORLD_PATHS = [
  ['bosque', 'ruinas'], ['bosque', 'taberna'], ['bosque', 'cuenca'],
  ['ruinas', 'pantano'], ['pantano', 'canon'], ['canon', 'cumbres'],
  ['ruinas', 'aldea'], ['aldea', 'torre'], ['torre', 'cripta'],
  ['aldea', 'cementerio'], ['cementerio', 'catacumbas'], ['cementerio', 'limite'],
  ['catacumbas', 'castillo']
];

function isoVisitedKey() { return 'isoVisited_' + ISO_UID; }
function isoGetVisitedZones() {
  try {
    const raw = localStorage.getItem(isoVisitedKey());
    return raw ? JSON.parse(raw) : ['bosque']; // el Claro del Bosque siempre empieza revelado
  } catch (e) { return ['bosque']; }
}
function isoMarkZoneVisited(zoneId) {
  const visited = isoGetVisitedZones();
  if (visited.includes(zoneId)) return;
  visited.push(zoneId);
  try { localStorage.setItem(isoVisitedKey(), JSON.stringify(visited)); } catch (e) { /* no pasa nada */ }
}
// Zona exterior a la que pertenece un worldX dado (para ir marcando
// zonas como visitadas al andar, ver GameScene.updateZoneTracking).
function isoZoneAtWorldX(worldX) {
  const z = WORLD_ZONES.find(z => z.region && worldX >= z.region.min && worldX < z.region.max);
  return z ? z.id : null;
}
