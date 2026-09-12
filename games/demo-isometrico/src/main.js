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
  if (currentGame) { currentGame.destroy(true); currentGame = null; }
  currentGame = new Phaser.Game({
    type: Phaser.AUTO,
    parent: 'game-root',
    width: window.innerWidth,
    height: window.innerHeight,
    backgroundColor: '#1a1f2b',
    scale: { mode: Phaser.Scale.RESIZE, autoCenter: Phaser.Scale.CENTER_BOTH },
    scene: [BootScene, GameScene]
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
