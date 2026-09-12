/* =========================
   GameScene — mapa cuadrado, movimiento libre en cualquier ángulo
   -----------------------------------------------------------------
   El jugador ya no está encajado a una cuadrícula: tiene una posición
   continua (this.worldX/this.worldY) que se mueve a PLAYER_SPEED en la
   dirección exacta que marquen teclado/joystick, sea cual sea el
   ángulo. El mundo es un cuadrado (MAP_SIZE x MAP_SIZE) y solo se
   aplasta verticalmente al proyectarlo a pantalla (worldToScreen), así
   que el mapa se ve como un rectángulo, nunca como un rombo.

   Depth sorting: igual de dinámico que antes, pero ahora basado en la
   posición continua del jugador (this.player.setDepth(1000 +
   pantalla.y) en cada frame) en vez de en pasos de cuadrícula.
========================= */
class GameScene extends Phaser.Scene {
  constructor() { super('GameScene'); }

  create() {
    this.gameEnded = false;
    this.collectedCount = 0;

    this.buildGrid();
    this.buildProps();
    this.buildPlayer();
    this.buildCoins();
    this.buildHud();

    this.cameras.main.setBounds(0, 0, MAP_SIZE, MAP_SIZE * ISO_SQUISH);
    this.cameras.main.startFollow(this.player, true, 0.15, 0.15);

    this.cursors = this.input.keyboard.createCursorKeys();
    this.keys = this.input.keyboard.addKeys({ w: 'W', a: 'A', s: 'S', d: 'D' });

    emitToParent('dragonbarbudo:ready', {}); // no forma parte del contrato pedido, pero es inofensivo y útil para depurar
  }

  buildGrid() {
    // Suelo: una losa cuadrada por casilla, en dos tonos alternos.
    // Depth fijo y bajo (0): siempre por debajo de jugador/props/monedas.
    for (let gy = 0; gy < GRID_SIZE; gy++) {
      for (let gx = 0; gx < GRID_SIZE; gx++) {
        const wx = gx * TILE_SIZE + TILE_SIZE / 2, wy = gy * TILE_SIZE + TILE_SIZE / 2;
        const p = worldToScreen(wx, wy);
        const variant = (gx + gy) % 2 === 0 ? 'a' : 'b';
        this.add.image(p.x, p.y, 'tile_' + variant).setOrigin(0.5, 0.5).setDepth(0);
      }
    }
  }

  buildProps() {
    // Árboles: props fijos con colisión circular (this.trees, mirados
    // contra PLAYER_RADIUS+TREE_RADIUS en tryMoveAxis) y son los que
    // demuestran el depth sorting dinámico contra el jugador.
    const treeSpots = [[3, 3], [7, 2], [2, 8], [8, 8], [5, 6], [9, 3]];
    this.trees = treeSpots.map(([gx, gy]) => {
      const wx = gx * TILE_SIZE + TILE_SIZE / 2, wy = gy * TILE_SIZE + TILE_SIZE / 2;
      const p = worldToScreen(wx, wy);
      const img = this.add.image(p.x, p.y, 'tree').setOrigin(0.5, 0.9);
      img.setDepth(1000 + p.y);
      return { worldX: wx, worldY: wy };
    });
  }

  buildPlayer() {
    this.worldX = TILE_SIZE * 1.5;
    this.worldY = TILE_SIZE * 1.5;
    const p = worldToScreen(this.worldX, this.worldY);
    this.player = this.add.sprite(p.x, p.y, 'player').setOrigin(0.5, 0.9);
    this.player.setDepth(1000 + p.y);
  }

  buildCoins() {
    const coinSpots = [[4, 1], [10, 4], [1, 6], [6, 10], [10, 10]];
    this.coinsTotal = coinSpots.length;
    this.coins = coinSpots.map(([gx, gy]) => {
      const wx = gx * TILE_SIZE + TILE_SIZE / 2, wy = gy * TILE_SIZE + TILE_SIZE / 2;
      const p = worldToScreen(wx, wy);
      const img = this.add.image(p.x, p.y - 8, 'coin').setOrigin(0.5, 0.7);
      img.setDepth(1000 + p.y);
      img.worldX = wx; img.worldY = wy; img.collected = false;
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

  collidesTree(x, y) {
    return this.trees.some(t => Phaser.Math.Distance.Between(x, y, t.worldX, t.worldY) < (PLAYER_RADIUS + TREE_RADIUS));
  }

  // Mueve un solo eje a la vez (llamado una vez para X y otra para Y):
  // así, si chocas contra un árbol moviéndote en diagonal, sigues
  // deslizándote por el eje libre en vez de quedarte pegado en seco.
  tryMoveAxis(dx, dy) {
    const nx = Phaser.Math.Clamp(this.worldX + dx, PLAYER_RADIUS, MAP_SIZE - PLAYER_RADIUS);
    const ny = Phaser.Math.Clamp(this.worldY + dy, PLAYER_RADIUS, MAP_SIZE - PLAYER_RADIUS);
    if (this.collidesTree(nx, ny)) return;
    this.worldX = nx; this.worldY = ny;
  }

  checkCoinPickup() {
    let changed = false;
    this.coins.forEach((c) => {
      if (c.collected) return;
      if (Phaser.Math.Distance.Between(this.worldX, this.worldY, c.worldX, c.worldY) > COIN_RADIUS) return;
      c.collected = true;
      changed = true;
      this.collectedCount++;
      this.tweens.add({ targets: c, alpha: 0, scale: 1.6, duration: 220, onComplete: () => c.destroy() });
      emitToParent('dragonbarbudo:reward', { coins: 15, achievementId: null });
    });
    if (changed) this.hudText.setText(this.hudLabel());
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

  update(time, delta) {
    if (this.gameEnded) return;
    const dt = delta / 1000;

    // Vector de teclado: normalizado para que la diagonal no vaya más
    // rápido que un eje solo (8 direcciones posibles con teclas).
    let ix = 0, iy = 0;
    if (this.cursors.left.isDown || this.keys.a.isDown) ix -= 1;
    if (this.cursors.right.isDown || this.keys.d.isDown) ix += 1;
    if (this.cursors.up.isDown || this.keys.w.isDown) iy -= 1;
    if (this.cursors.down.isDown || this.keys.s.isDown) iy += 1;
    const kbLen = Math.hypot(ix, iy);
    if (kbLen > 0) { ix /= kbLen; iy /= kbLen; }

    // El joystick táctil manda si está activo: ya viene con ángulo y
    // magnitud libres (arrastre), no limitado a 8 direcciones como el
    // teclado — así es como se consigue "cualquier ángulo" también con
    // el dedo o el ratón.
    let magnitude = kbLen > 0 ? 1 : 0;
    if (window.isoJoystick.active) {
      ix = window.isoJoystick.dx;
      iy = window.isoJoystick.dy;
      magnitude = Math.min(1, Math.hypot(ix, iy));
    }

    if (magnitude > 0.001) {
      const len = Math.hypot(ix, iy) || 1;
      const speed = PLAYER_SPEED * magnitude * dt;
      const moveX = (ix / len) * speed, moveY = (iy / len) * speed;
      this.tryMoveAxis(moveX, 0);
      this.tryMoveAxis(0, moveY);
      if (Math.abs(ix) > 0.1) this.player.setFlipX(ix < 0);

      const p = worldToScreen(this.worldX, this.worldY);
      this.player.setPosition(p.x, p.y);
      this.player.setDepth(1000 + p.y);
      this.checkCoinPickup();
    }
  }
}
