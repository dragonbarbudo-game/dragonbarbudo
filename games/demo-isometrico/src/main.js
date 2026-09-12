/* =========================
   main.js — menú, arranque del juego, joystick y puente con el padre
   -------------------------------------------------------------------
   Phaser.Game NO se crea hasta que se elige una opción de jugar (Nueva
   partida / Continuar): antes de eso solo hay un menú en HTML/CSS
   normal, más barato y más simple de maquetar que dibujarlo con Phaser.

   "Con amigos" necesita datos que este juego no tiene (tu lista de
   amigos, Supabase): en vez de eso le PIDE a la página padre que
   enseñe su propio selector de amigos (dragonbarbudo:request_friends),
   y espera a que el padre le diga que ya puede empezar
   (dragonbarbudo:start_multiplayer) o que se canceló
   (dragonbarbudo:friends_cancelled). Mientras dura la partida en
   compañía, este archivo hace de puente: reenvía la posición propia al
   padre (que la retransmite por Supabase Realtime) y aplica las
   posiciones/recogidas de moneda que llegan del amigo. Si se abre este
   index.html suelto (sin padre), "Con amigos" simplemente nunca recibe
   respuesta — se puede cancelar y jugar solo sin problema.
========================= */
let currentGame = null; // instancia de Phaser.Game activa; null si estamos en el menú

function isoShowOnly(id) {
  document.querySelectorAll('.iso-overlay').forEach(el => { el.hidden = (el.id !== id); });
}

function isoShowMainMenu() {
  document.getElementById('isoBtnContinue').disabled = !isoLoadProgress();
  isoShowOnly('isoMenuMain');
}
function isoShowNewGameChoices() { isoShowOnly('isoMenuNewGame'); }
function isoShowSettings() {
  document.getElementById('isoMuteSwitch').classList.toggle('on', isoIsMuted());
  isoShowOnly('isoMenuSettings');
}
function isoToggleMute() {
  const next = !isoIsMuted();
  isoSetMuted(next);
  document.getElementById('isoMuteSwitch').classList.toggle('on', next);
}

function isoHideAllMenus() {
  document.querySelectorAll('.iso-overlay').forEach(el => { el.hidden = true; });
}

/* ---- Empezar a jugar (solo) ---- */
function isoStartSolo(continueSaved) {
  isoHideAllMenus();
  document.getElementById('isoJoystick').style.display = 'block';
  isoLaunch({ mode: 'solo', continueSave: continueSaved ? isoLoadProgress() : null });
}
function isoContinueSolo() { isoStartSolo(true); }

/* ---- Con amigos: pide a la página padre que muestre su selector ---- */
function isoShowFriendPicker() {
  isoShowOnly('isoMenuFriends');
  document.getElementById('isoFriendList').innerHTML = '<p class="iso-empty">Cargando…</p>';
  emitToParent('dragonbarbudo:request_friends', {});
}
function isoCancelWaiting() {
  emitToParent('dragonbarbudo:cancel_multiplayer', {});
  isoShowNewGameChoices();
}

/* ---- Arranca Phaser (una sola vez; si ya había una partida corriendo,
   se destruye primero — pasa al reiniciar desde el propio juego, ver
   isoBackToMenu). ---- */
function isoLaunch(startData) {
  window.isoMapOpen = false;
  if (currentGame) { currentGame.destroy(true); currentGame = null; }
  currentGame = new Phaser.Game({
    type: Phaser.AUTO,
    parent: 'game-root',
    width: window.innerWidth,
    height: window.innerHeight,
    backgroundColor: '#1a1f2b',
    scale: { mode: Phaser.Scale.RESIZE, autoCenter: Phaser.Scale.CENTER_BOTH },
    scene: [BootScene, GameScene, TavernScene]
  });
  currentGame.scene.start('BootScene', startData);
}

/* Llamado desde GameScene cuando el jugador pulsa "Volver al menú"
   dentro de la partida: para el juego y se vuelve al menú principal. */
function isoBackToMenu() {
  if (currentGame) { currentGame.destroy(true); currentGame = null; }
  document.getElementById('isoJoystick').style.display = 'none';
  emitToParent('dragonbarbudo:leave_multiplayer', {});
  isoShowMainMenu();
}

/* Botón "Salir" del menú principal: el juego no puede cerrarse a sí
   mismo (vive en un <iframe>) — se lo pide a la página padre, que
   corta el iframe y vuelve al Lobby (ver leavePlatformerGame en el
   sitio principal). En modo standalone (sin padre) no hay nada que
   hacer, así que no pasa nada visible. */
function isoExitGame() {
  if (currentGame) { currentGame.destroy(true); currentGame = null; }
  emitToParent('dragonbarbudo:exit_game', {});
}

/* =========================
   Puente con la página padre
========================= */
window.addEventListener('message', (event) => {
  const data = event.data;
  if (!data || typeof data !== 'object' || typeof data.type !== 'string') return;

  if (data.type === 'dragonbarbudo:friends_list') {
    isoRenderFriendList(data.payload && data.payload.friends || []);
  } else if (data.type === 'dragonbarbudo:friends_cancelled') {
    isoShowNewGameChoices();
  } else if (data.type === 'dragonbarbudo:invite_sent') {
    document.getElementById('isoWaitingText').textContent =
      'Esperando a que ' + (data.payload && data.payload.friendName || 'tu amigo') + ' acepte la invitación.';
    isoShowOnly('isoMenuWaiting');
  } else if (data.type === 'dragonbarbudo:start_multiplayer') {
    isoHideAllMenus();
    document.getElementById('isoJoystick').style.display = 'block';
    isoLaunch({ mode: 'friends', matchId: data.payload.matchId, friendName: data.payload.friendName });
  } else if (data.type === 'dragonbarbudo:remote_position') {
    window.dispatchEvent(new CustomEvent('iso:remote_position', { detail: data.payload }));
  } else if (data.type === 'dragonbarbudo:coin_taken_remote') {
    window.dispatchEvent(new CustomEvent('iso:coin_taken_remote', { detail: data.payload }));
  } else if (data.type === 'dragonbarbudo:friend_left') {
    window.dispatchEvent(new CustomEvent('iso:friend_left'));
  }
});

function isoRenderFriendList(friends) {
  const el = document.getElementById('isoFriendList');
  if (!friends.length) {
    el.innerHTML = '<p class="iso-empty">Todavía no tienes amigos añadidos.</p>';
    return;
  }
  el.innerHTML = friends.map(f => `
    <div class="iso-friend-row">
      <span>${f.avatar || '🧙'} ${f.username}</span>
      <button onclick="isoInviteFriend('${f.id}', '${f.username.replace(/'/g, "\\'")}')">Invitar</button>
    </div>
  `).join('');
}
function isoInviteFriend(friendId, friendName) {
  emitToParent('dragonbarbudo:invite_friend', { friendId, friendName });
}

/* =========================
   MAPA DEL REINO — pantalla navegable, se revela según se explora
   -------------------------------------------------------------
   Puro HTML/SVG sobre el juego (igual que los menús): se abre con el
   botón "🗺️ Mapa" durante la partida (ver GameScene/TavernScene) y
   pausa el movimiento mientras está abierto (window.isoMapOpen, que las
   escenas comprueban al principio de su update()). Las zonas y los
   caminos entre ellas viven en WORLD_ZONES/WORLD_PATHS (config.js); qué
   está descubierto, en isoGetVisitedZones().
========================= */
window.isoMapOpen = false;

function isoShowMap() {
  window.isoMapOpen = true;
  renderWorldMap();
  document.getElementById('isoMapOverlay').hidden = false;
}
function isoCloseMap() {
  window.isoMapOpen = false;
  document.getElementById('isoMapOverlay').hidden = true;
}

// Contorno orgánico ("blob"): puntos alrededor de un centro con un
// poco de ruido determinista (mismo seed → misma forma siempre), unidos
// con curvas suaves por sus puntos medios para evitar esquinas duras.
function isoBlobPath(cx, cy, rx, ry, seed, points) {
  points = points || 10;
  let s = seed;
  const rand = () => { s = (s * 9301 + 49297) % 233280; return s / 233280; };
  const pts = [];
  for (let i = 0; i < points; i++) {
    const angle = (i / points) * Math.PI * 2;
    const jitter = 0.78 + rand() * 0.44;
    pts.push([cx + Math.cos(angle) * rx * jitter, cy + Math.sin(angle) * ry * jitter]);
  }
  let d = `M ${(pts[0][0] + pts[pts.length - 1][0]) / 2} ${(pts[0][1] + pts[pts.length - 1][1]) / 2} `;
  for (let i = 0; i < pts.length; i++) {
    const p = pts[i], n = pts[(i + 1) % pts.length];
    const mid = [(p[0] + n[0]) / 2, (p[1] + n[1]) / 2];
    d += `Q ${p[0]} ${p[1]} ${mid[0]} ${mid[1]} `;
  }
  return d + 'Z';
}

function renderWorldMap() {
  const visited = isoGetVisitedZones();
  const NS = 'http://www.w3.org/2000/svg';
  const svgEl = (tag, attrs) => {
    const e = document.createElementNS(NS, tag);
    for (const k in attrs) e.setAttribute(k, attrs[k]);
    return e;
  };

  const svg = svgEl('svg', { viewBox: '0 0 1240 1000' });
  const byId = {};
  WORLD_ZONES.forEach(z => { byId[z.id] = z; });

  // Caminos: solo se insinúan si al menos un extremo ya se ha visitado
  // (has encontrado la salida, aunque no sepas a dónde lleva todavía);
  // si además el destino está visitado, el camino se ve "completo".
  WORLD_PATHS.forEach(([a, b]) => {
    const za = byId[a], zb = byId[b];
    const aVisited = visited.includes(a), bVisited = visited.includes(b);
    if (!aVisited && !bVisited) return;
    const mx = (za.cx + zb.cx) / 2, my = (za.cy + zb.cy) / 2;
    svg.appendChild(svgEl('path', {
      d: `M ${za.cx} ${za.cy} Q ${mx} ${my} ${zb.cx} ${zb.cy}`,
      fill: 'none', stroke: (aVisited && bVisited) ? '#c9b98a' : '#4a483f',
      'stroke-width': 4, 'stroke-opacity': 0.7, 'stroke-dasharray': '3 9', 'stroke-linecap': 'round'
    }));
  });

  WORLD_ZONES.forEach(z => {
    const isVisited = visited.includes(z.id);
    svg.appendChild(svgEl('path', {
      d: isoBlobPath(z.cx, z.cy, z.rx, z.ry, z.seed),
      fill: '#171320', 'fill-opacity': isVisited ? 0.96 : 0.88,
      stroke: isVisited ? z.color : '#3a3a42', 'stroke-width': 2.5, 'stroke-opacity': isVisited ? 0.85 : 0.5
    }));
  });

  WORLD_ZONES.forEach(z => {
    const isVisited = visited.includes(z.id);
    const plateW = Math.min(z.rx * 1.5, 170);
    svg.appendChild(svgEl('rect', {
      x: z.cx - plateW / 2, y: z.cy - 18, width: plateW, height: 36, rx: 6,
      fill: '#0d0a12', 'fill-opacity': isVisited ? 0.55 : 0.35,
      stroke: isVisited ? z.color : '#3a3a42', 'stroke-width': 1, 'stroke-opacity': 0.6
    }));
    const t = svgEl('text', {
      x: z.cx, y: z.cy + 6, 'text-anchor': 'middle', 'font-size': 15,
      'font-family': "'Cinzel', Georgia, serif", fill: isVisited ? '#ece3d0' : '#6a6a70',
      style: 'letter-spacing:1px'
    });
    t.textContent = isVisited ? z.name : '???';
    svg.appendChild(t);
  });

  const host = document.getElementById('isoMapSvgHost');
  host.innerHTML = '';
  host.appendChild(svg);
}

/* =========================
   Joystick táctil (arrastre libre: cualquier ángulo, con dedo o ratón)
========================= */
function bindJoystick() {
  const base = document.getElementById('isoJoystick');
  const thumb = document.getElementById('isoJoystickThumb');
  if (!base || !thumb) return;

  const MAX_DIST = 46;
  let activePointerId = null;

  function setThumb(x, y) { thumb.style.transform = `translate(${x}px, ${y}px)`; }
  function reset() {
    window.isoJoystick.active = false;
    window.isoJoystick.dx = 0;
    window.isoJoystick.dy = 0;
    setThumb(0, 0);
    activePointerId = null;
  }
  function updateFromEvent(e) {
    const rect = base.getBoundingClientRect();
    const cx = rect.left + rect.width / 2, cy = rect.top + rect.height / 2;
    const dx = e.clientX - cx, dy = e.clientY - cy;
    const dist = Math.hypot(dx, dy);
    const clamped = Math.min(dist, MAX_DIST);
    const angle = Math.atan2(dy, dx);
    const tx = Math.cos(angle) * clamped, ty = Math.sin(angle) * clamped;
    setThumb(tx, ty);
    window.isoJoystick.active = true;
    window.isoJoystick.dx = tx / MAX_DIST;
    window.isoJoystick.dy = ty / MAX_DIST;
  }

  base.addEventListener('pointerdown', (e) => {
    e.preventDefault();
    activePointerId = e.pointerId;
    base.setPointerCapture(e.pointerId);
    updateFromEvent(e);
  });
  base.addEventListener('pointermove', (e) => {
    if (e.pointerId !== activePointerId) return;
    e.preventDefault();
    updateFromEvent(e);
  });
  base.addEventListener('pointerup', (e) => { if (e.pointerId === activePointerId) reset(); });
  base.addEventListener('pointercancel', () => { reset(); });
}

bindJoystick();
isoShowMainMenu();
// Avisa a la página padre de que el menú ya está listo para recibir un
// dragonbarbudo:start_multiplayer (si venimos de aceptar una invitación,
// el padre puede estar esperando justo esta señal — ver isoJoinMatch en
// el sitio principal).
emitToParent('dragonbarbudo:menu_ready', {});
