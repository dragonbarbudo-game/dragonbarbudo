/* =========================
   GameScene — mapa isométrico, movimiento, depth sorting y recolectables
   -----------------------------------------------------------------
   Movimiento en cuadrícula (un paso por pulsación, como en El Caballero
   Errante anterior) pero proyectado en isométrico: las 4 direcciones se
   mueven sobre los dos ejes de la cuadrícula (gridToScreen se encarga de
   que eso se vea diagonal en pantalla, que es el aspecto esperado en
   isométrico).
========================= */
class GameScene extends Phaser.Scene {
  constructor() { super('GameScene'); }

  create() {
    this.moving = false;
    this.gameEnded = false;
    this.collectedCount = 0;

    this.buildGrid();
    this.buildProps();
    this.buildPlayer();
    this.buildCoins();
    this.buildHud();

    this.cameras.main.startFollow(this.player, true, 0.15, 0.15);

    this.cursors = this.input.keyboard.createCursorKeys();
    this.keys = this.input.keyboard.addKeys({ w: 'W', a: 'A', s: 'S', d: 'D' });

    if (typeof bindTouchControls === 'function') bindTouchControls();

    emitToParent('dragonbarbudo:ready', {}); // no forma parte del contrato pedido, pero es inofensivo y útil para depurar
  }

  buildGrid() {
    // Suelo: una losa por casilla, en dos tonos alternos. Depth fijo y
    // bajo (0): siempre por debajo de jugador/props/monedas.
    for (let gy = 0; gy < GRID_SIZE; gy++) {
      for (let gx = 0; gx < GRID_SIZE; gx++) {
        const p = gridToScreen(gx, gy);
        const variant = (gx + gy) % 2 === 0 ? 'a' : 'b';
        this.add.image(p.x, p.y, 'tile_' + variant).setOrigin(0.5, 0.5).setDepth(0);
      }
    }
  }

  buildProps() {
    // Rejilla de colisión (solo los árboles bloquean; el borde del mapa
    // se comprueba aparte en tryMove). También son los props que
    // demuestran el depth sorting dinámico: su profundidad se fija una
    // vez (no se mueven), y el jugador se resuelve contra ellos en cada
    // frame según su propia Y en pantalla.
    this.blocked = [];
    for (let y = 0; y < GRID_SIZE; y++) this.blocked.push(new Array(GRID_SIZE).fill(false));

    const treeSpots = [[3, 3], [7, 2], [2, 8], [8, 8], [5, 6], [9, 3]];
    treeSpots.forEach(([gx, gy]) => {
      const p = gridToScreen(gx, gy);
      // Origen cerca de la base del tronco/sombra: es el punto que debe
      // coincidir con el centro de la losa que ocupa.
      const img = this.add.image(p.x, p.y, 'tree').setOrigin(0.5, 0.9);
      img.setDepth(1000 + p.y);
      this.blocked[gy][gx] = true;
    });
  }

  buildPlayer() {
    this.gridX = 1;
    this.gridY = 1;
    const p = gridToScreen(this.gridX, this.gridY);
    this.player = this.add.sprite(p.x, p.y, 'player').setOrigin(0.5, 0.9);
    this.player.setDepth(1000 + p.y);
  }

  buildCoins() {
    const coinSpots = [[4, 1], [10, 4], [1, 6], [6, 10], [10, 10]];
    this.coinsTotal = coinSpots.length;
    this.coins = coinSpots.map(([gx, gy]) => {
      const p = gridToScreen(gx, gy);
      const img = this.add.image(p.x, p.y - 8, 'coin').setOrigin(0.5, 0.7);
      img.setDepth(1000 + p.y);
      img.gridX = gx;
      img.gridY = gy;
      img.collected = false;
      // Animación simple de "flotar" para que se note que son
      // recolectables y no decoración del suelo.
      this.tweens.add({ targets: img, y: img.y - 6, duration: 650, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' });
      return img;
    });
  }

  buildHud() {
    this.hudText = this.add.text(14, 12, this.hudLabel(), {
      fontFamily: 'sans-serif', fontSize: '18px', color: '#ffffff', stroke: '#000000', strokeThickness: 4
    }).setScrollFactor(0).setDepth(999999);
  }

  hudLabel() {
    return '🪙 ' + this.collectedCount + ' / ' + this.coinsTotal;
  }

  isBlocked(gx, gy) {
    if (gx < 0 || gy < 0 || gx >= GRID_SIZE || gy >= GRID_SIZE) return true;
    return this.blocked[gy][gx];
  }

  tryMove(dx, dy) {
    if (this.moving || this.gameEnded) return;
    const nx = this.gridX + dx, ny = this.gridY + dy;
    if (this.isBlocked(nx, ny)) return;

    this.gridX = nx; this.gridY = ny;
    this.moving = true;
    const p = gridToScreen(nx, ny);
    this.tweens.add({
      targets: this.player, x: p.x, y: p.y, duration: ISO_MOVE_MS,
      // Depth sorting dinámico: en cada frame del propio movimiento se
      // recalcula según la Y real en pantalla, así el jugador se cruza
      // por delante o por detrás de los árboles en el punto exacto que
      // toca, no solo al llegar a la casilla destino.
      onUpdate: () => this.player.setDepth(1000 + this.player.y),
      onComplete: () => { this.moving = false; this.checkCoinPickup(); }
    });
  }

  checkCoinPickup() {
    const coin = this.coins.find(c => !c.collected && c.gridX === this.gridX && c.gridY === this.gridY);
    if (!coin) return;
    coin.collected = true;
    this.collectedCount++;
    this.hudText.setText(this.hudLabel());
    this.tweens.add({ targets: coin, alpha: 0, scale: 1.6, duration: 220, onComplete: () => coin.destroy() });

    emitToParent('dragonbarbudo:reward', { coins: 15, achievementId: null });

    if (this.collectedCount >= this.coinsTotal) this.finishGame();
  }

  finishGame() {
    this.gameEnded = true;
    const score = this.collectedCount * 15;
    const banner = this.add.text(this.player.x, this.player.y - 90, '🏆 ¡Completado!\nPuntuación: ' + score, {
      fontFamily: 'sans-serif', fontSize: '22px', color: '#ffe066', stroke: '#000000', strokeThickness: 5, align: 'center'
    }).setOrigin(0.5).setDepth(9999999);
    this.tweens.add({ targets: banner, y: banner.y - 20, duration: 900, ease: 'Sine.easeOut' });

    emitToParent('dragonbarbudo:game_over', { score });
  }

  update() {
    if (this.gameEnded) return;

    const up = this.cursors.up.isDown || this.keys.w.isDown || window.isoTouch.up;
    const down = this.cursors.down.isDown || this.keys.s.isDown || window.isoTouch.down;
    const left = this.cursors.left.isDown || this.keys.a.isDown || window.isoTouch.left;
    const right = this.cursors.right.isDown || this.keys.d.isDown || window.isoTouch.right;

    // Solo una dirección por paso, igual que en El Caballero Errante:
    // mantener pulsado sigue andando solo porque update() reintenta
    // tryMove() en cada frame libre (tryMove no hace nada si ya se está
    // moviendo).
    if (up) this.tryMove(0, -1);
    else if (down) this.tryMove(0, 1);
    else if (left) this.tryMove(-1, 0);
    else if (right) this.tryMove(1, 0);
  }
}
