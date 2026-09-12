/* =========================
   main.js — arranque del juego + joystick táctil
   -----------------------------------------------
   El joystick permite cualquier ángulo (arrastre libre), no solo 4/8
   direcciones — sustituye a la cruceta de botones de la versión
   anterior. Funciona igual con dedo (touch) que con ratón (pointer
   events cubre ambos).
========================= */
function bindJoystick() {
  const base = document.getElementById('isoJoystick');
  const thumb = document.getElementById('isoJoystickThumb');
  if (!base || !thumb) return;

  const MAX_DIST = 46; // radio máximo que se puede arrastrar el "thumb", en px
  let activePointerId = null;

  function setThumb(x, y) {
    thumb.style.transform = `translate(${x}px, ${y}px)`;
  }

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

// Colgado de window a propósito (no solo por depurar): la página padre
// podría necesitar referenciarlo en el futuro sin tener que tocar este
// archivo otra vez.
window.isoGame = new Phaser.Game({
  type: Phaser.AUTO,
  parent: 'game-root',
  width: window.innerWidth,
  height: window.innerHeight,
  backgroundColor: '#1a1f2b',
  scale: { mode: Phaser.Scale.RESIZE, autoCenter: Phaser.Scale.CENTER_BOTH },
  scene: [BootScene, GameScene]
});
