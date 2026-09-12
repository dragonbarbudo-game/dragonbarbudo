/* =========================
   main.js — arranque del juego + controles táctiles
   -------------------------------------------------
   Enlaza la cruceta en pantalla (ver index.html) una sola vez —no hace
   falta re-enlazarla al reiniciar la partida, porque "reiniciar" aquí
   significa recargar el iframe entero (lo hace el sitio principal), así
   que este script vuelve a ejecutarse desde cero cada vez de todas
   formas— y arranca Phaser con las dos escenas.
========================= */
function bindTouchControls() {
  const bind = (id, prop) => {
    const btn = document.getElementById(id);
    if (!btn) return;
    const on = (e) => { e.preventDefault(); window.isoTouch[prop] = true; };
    const off = (e) => { e.preventDefault(); window.isoTouch[prop] = false; };
    btn.addEventListener('pointerdown', on);
    btn.addEventListener('pointerup', off);
    btn.addEventListener('pointerleave', off);
    btn.addEventListener('pointercancel', off);
  };
  bind('isoBtnUp', 'up');
  bind('isoBtnDown', 'down');
  bind('isoBtnLeft', 'left');
  bind('isoBtnRight', 'right');
}

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
