/* =========================
   GameScene — mapa cuadrado, movimiento libre en cualquier ángulo
   -----------------------------------------------------------------
   El jugador tiene una posición continua (this.worldX/this.worldY) que
   se mueve a PLAYER_SPEED en la dirección exacta que marquen
   teclado/joystick, sea cual sea el ángulo. El mundo es un rectángulo
   (MAP_W x MAP_H, ver config.js) que solo se aplasta verticalmente al
   proyectarlo a pantalla (worldToScreen), así que el mapa se ve como un
   rectángulo, nunca como un rombo.

   El mapa es un único mundo que va creciendo por zonas (ver prompts/
   dragonbarbudo-concepto-mapa.md): Zona 1 = Claro del Bosque, Zona 2 =
   Camino de las Ruinas (río con puente + ruinas), ambas en este mismo
   archivo. Al añadir una Zona 3, seguir la misma regla: ampliar
   GRID_COLS/GRID_ROWS y añadir SIEMPRE al final de COIN_SPOTS/
   TREE_SPOTS/RUIN_SPOTS, nunca reordenar (el guardado referencia
   monedas por índice de array).

   Recibe datos de arranque de main.js/BootScene (ver init()):
     { mode: 'solo'|'friends', continueSave, matchId, friendName }
   - solo + continueSave: restaura posición y monedas ya recogidas.
   - friends: añade un segundo personaje (el amigo) que se mueve según
     lo que retransmite la página padre — este archivo NUNCA habla con
     Supabase directamente, todo pasa por postMessage (ver main.js).
========================= */
// Zona 1: Claro del Bosque (columnas 0-11). Zona 2: Camino de las
// Ruinas (columnas 12-19) — ver prompts/dragonbarbudo-concepto-mapa.md.
// Regla fija al ampliar el mapa: las listas SOLO crecen añadiendo al
// final, nunca reordenando ni insertando en medio — el guardado en
// solitario referencia las monedas recogidas por su índice en
// COIN_SPOTS, así que cambiar el orden invalidaría partidas guardadas.
const COIN_SPOTS = [
  [4, 1], [10, 4], [1, 6], [6, 10], [10, 10], // Zona 1
  [12, 1], [14, 10], [16, 3], [18, 7], [19, 10] // Zona 2
];
const TREE_SPOTS = [[3, 3], [7, 2], [2, 8], [8, 8], [5, 6], [9, 3]]; // Zona 1 (bosque)
const RUIN_SPOTS = [[13, 2], [13, 9], [17, 2], [17, 9], [12, 8]]; // Zona 2

// El río corta la Zona 2 de norte a sur en la columna RIVER_COL; solo
// se puede cruzar por el puente (las filas en BRIDGE_ROWS, con losa de
// camino en vez de agua). No es un obstáculo circular como los árboles
// o las ruinas: bloquea por casilla completa (ver isWaterAt).
const RIVER_COL = 15;
const BRIDGE_ROWS = [5, 6];
// Camino de tierra visible que conecta la Zona 1 con el puente.
const PATH_COL_START = 10;
const PATH_ROWS = BRIDGE_ROWS;

const REMOTE_POS_INTERVAL_MS = 90; // cada cuánto se retransmite la posición propia en partidas con amigos

class GameScene extends Phaser.Scene {
  constructor() { super('GameScene'); }

  init(data) {
    this.mode = (data && data.mode) || 'solo';
    this.continueSave = (data && data.continueSave) || null;
    this.matchId = data && data.matchId;
    this.friendName = data && data.friendName;
  }

  create() {
    this.gameEnded = false;
    this.collectedCount = 0;
    this.lastSentPos = 0;
    this.remoteJoined = false;

    this.buildGrid();
    this.buildProps();
    this.buildPlayer();
    this.buildCoins();
    this.buildHud();
    if (this.mode === 'friends') this.buildRemotePlayer();

    this.cameras.main.setBounds(0, 0, MAP_W, MAP_H * ISO_SQUISH);
    this.cameras.main.startFollow(this.player, true, 0.15, 0.15);

    this.cursors = this.input.keyboard.createCursorKeys();
    this.keys = this.input.keyboard.addKeys({ w: 'W', a: 'A', s: 'S', d: 'D' });

    if (this.mode === 'solo') {
      // Autoguardado periódico (además de al recoger moneda y al
      // salir): así si se cierra la pestaña sin querer no se pierde
      // gran cosa de posición.
      this.saveTimer = this.time.addEvent({ delay: 3000, loop: true, callback: () => this.saveNow() });
    } else {
      this.onRemotePosition = (e) => this.applyRemotePosition(e.detail);
      this.onCoinTakenRemote = (e) => this.applyRemoteCoinTaken(e.detail);
      this.onFriendLeft = () => this.handleFriendLeft();
      window.addEventListener('iso:remote_position', this.onRemotePosition);
      window.addEventListener('iso:coin_taken_remote', this.onCoinTakenRemote);
      window.addEventListener('iso:friend_left', this.onFriendLeft);
      this.events.once('shutdown', () => {
        window.removeEventListener('iso:remote_position', this.onRemotePosition);
        window.removeEventListener('iso:coin_taken_remote', this.onCoinTakenRemote);
        window.removeEventListener('iso:friend_left', this.onFriendLeft);
      });
    }

    emitToParent('dragonbarbudo:ready', {}); // no forma parte del contrato pedido, pero es inofensivo y útil para depurar
  }

  // ¿La casilla (gx,gy) es agua? Solo la franja del río, y no en las
  // filas del puente. Es una comprobación por casilla completa (no un
  // círculo como los árboles/ruinas) porque así se puede dibujar una
  // orilla recta y predecible.
  isWaterTile(gx, gy) {
    return gx === RIVER_COL && !BRIDGE_ROWS.includes(gy);
  }

  buildGrid() {
    // Suelo: una losa cuadrada por casilla. Depth fijo y bajo (0):
    // siempre por debajo de jugador/props/monedas.
    for (let gy = 0; gy < GRID_ROWS; gy++) {
      for (let gx = 0; gx < GRID_COLS; gx++) {
        const wx = gx * TILE_SIZE + TILE_SIZE / 2, wy = gy * TILE_SIZE + TILE_SIZE / 2;
        const p = worldToScreen(wx, wy);
        let key;
        if (this.isWaterTile(gx, gy)) key = 'water';
        else if (gx >= PATH_COL_START && PATH_ROWS.includes(gy)) key = 'tile_path';
        else key = (gx + gy) % 2 === 0 ? 'tile_a' : 'tile_b';
        this.add.image(p.x, p.y, key).setOrigin(0.5, 0.5).setDepth(0);
      }
    }
  }

  buildProps() {
    // Árboles y ruinas: props fijos con colisión circular (this.obstacles,
    // mirados contra PLAYER_RADIUS+radio en tryMoveAxis) y son los que
    // demuestran el depth sorting dinámico contra el jugador. El río se
    // resuelve aparte, por casilla (ver isWaterTile), no como círculo.
    const trees = TREE_SPOTS.map(([gx, gy]) => this.placeObstacle(gx, gy, 'tree', TREE_RADIUS));
    const ruins = RUIN_SPOTS.map(([gx, gy]) => this.placeObstacle(gx, gy, 'ruin', RUIN_RADIUS));
    this.obstacles = trees.concat(ruins);
  }

  placeObstacle(gx, gy, texture, radius) {
    const wx = gx * TILE_SIZE + TILE_SIZE / 2, wy = gy * TILE_SIZE + TILE_SIZE / 2;
    const p = worldToScreen(wx, wy);
    const img = this.add.image(p.x, p.y, texture).setOrigin(0.5, 0.9);
    img.setDepth(1000 + p.y);
    return { worldX: wx, worldY: wy, radius };
  }

  buildPlayer() {
    if (this.continueSave) {
      this.worldX = this.continueSave.worldX;
      this.worldY = this.continueSave.worldY;
    } else {
      this.worldX = TILE_SIZE * 1.5;
      this.worldY = TILE_SIZE * 1.5;
    }
    const p = worldToScreen(this.worldX, this.worldY);
    this.player = this.add.sprite(p.x, p.y, 'player').setOrigin(0.5, 0.9);
    this.player.setDepth(1000 + p.y);
  }

  // El "amigo" en partidas con amigos: mismo sprite, teñido de otro
  // color para distinguirlo, y con una etiqueta con su nombre encima.
  // Se coloca donde estabas tú al empezar hasta que llegue su primera
  // posición real (ver applyRemotePosition).
  buildRemotePlayer() {
    const p = worldToScreen(this.worldX, this.worldY);
    this.remotePlayer = this.add.sprite(p.x, p.y, 'player').setOrigin(0.5, 0.9).setTint(0xe0524a);
    this.remotePlayer.setDepth(1000 + p.y);
    this.remoteLabel = this.add.text(p.x, p.y - 70, this.friendName || 'Amigo', {
      fontFamily: 'sans-serif', fontSize: '13px', color: '#ffb3ad', stroke: '#000000', strokeThickness: 3
    }).setOrigin(0.5);
  }

  buildCoins() {
    const already = this.continueSave ? this.continueSave.collectedIndexes || [] : [];
    this.coinsTotal = COIN_SPOTS.length;
    this.coins = COIN_SPOTS.map(([gx, gy], index) => {
      const wx = gx * TILE_SIZE + TILE_SIZE / 2, wy = gy * TILE_SIZE + TILE_SIZE / 2;
      const p = worldToScreen(wx, wy);
      const img = this.add.image(p.x, p.y - 8, 'coin').setOrigin(0.5, 0.7);
      img.setDepth(1000 + p.y);
      img.worldX = wx; img.worldY = wy; img.index = index;
      img.collected = already.includes(index);
      if (img.collected) {
        img.destroy();
        this.collectedCount++;
        return img; // ya destruido: collected sigue en true, checkCoinPickup lo ignora (busca .active más abajo)
      }
      this.tweens.add({ targets: img, y: img.y - 6, duration: 650, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' });
      return img;
    });
  }

  buildHud() {
    this.hudText = this.add.text(14, 12, this.hudLabel(), {
      fontFamily: 'sans-serif', fontSize: '18px', color: '#ffffff', stroke: '#000000', strokeThickness: 4
    }).setScrollFactor(0).setDepth(999999);

    // Botón para volver al menú del juego sin salir del sitio principal.
    const menuBtn = this.add.text(this.scale.width - 14, 12, '☰ Menú', {
      fontFamily: 'sans-serif', fontSize: '16px', color: '#ffffff', stroke: '#000000', strokeThickness: 4
    }).setOrigin(1, 0).setScrollFactor(0).setDepth(999999).setInteractive({ useHandCursor: true });
    menuBtn.on('pointerdown', () => { this.saveNow(); isoBackToMenu(); });

    if (this.mode === 'friends') {
      this.friendStatusText = this.add.text(14, 40, '🟡 esperando a ' + (this.friendName || 'tu amigo') + '…', {
        fontFamily: 'sans-serif', fontSize: '13px', color: '#ffe066', stroke: '#000000', strokeThickness: 3
      }).setScrollFactor(0).setDepth(999999);
    }
  }

  hudLabel() {
    return '🪙 ' + this.collectedCount + ' / ' + this.coinsTotal;
  }

  collidesObstacle(x, y) {
    return this.obstacles.some(o => Phaser.Math.Distance.Between(x, y, o.worldX, o.worldY) < (PLAYER_RADIUS + o.radius));
  }

  // El río bloquea por casilla completa: se mira en qué casilla caería
  // el centro del jugador, no un círculo — así la orilla queda recta.
  blockedByWater(x, y) {
    const gx = Math.floor(x / TILE_SIZE), gy = Math.floor(y / TILE_SIZE);
    return this.isWaterTile(gx, gy);
  }

  // Mueve un solo eje a la vez (llamado una vez para X y otra para Y):
  // así, si chocas contra un árbol/ruina moviéndote en diagonal, sigues
  // deslizándote por el eje libre en vez de quedarte pegado en seco.
  tryMoveAxis(dx, dy) {
    const nx = Phaser.Math.Clamp(this.worldX + dx, PLAYER_RADIUS, MAP_W - PLAYER_RADIUS);
    const ny = Phaser.Math.Clamp(this.worldY + dy, PLAYER_RADIUS, MAP_H - PLAYER_RADIUS);
    if (this.collidesObstacle(nx, ny) || this.blockedByWater(nx, ny)) return;
    this.worldX = nx; this.worldY = ny;
  }

  checkCoinPickup() {
    let changed = false;
    this.coins.forEach((c) => {
      if (c.collected || !c.active) return;
      if (Phaser.Math.Distance.Between(this.worldX, this.worldY, c.worldX, c.worldY) > COIN_RADIUS) return;
      c.collected = true;
      changed = true;
      this.collectedCount++;
      this.tweens.add({ targets: c, alpha: 0, scale: 1.6, duration: 220, onComplete: () => c.destroy() });
      // La recompensa real (monedas del perfil) solo se da a quien la
      // toca físicamente; si hay un amigo, se le avisa para que la
      // moneda desaparezca también en su pantalla, pero sin recompensa
      // duplicada (ver applyRemoteCoinTaken).
      emitToParent('dragonbarbudo:reward', { coins: 15, achievementId: null });
      if (this.mode === 'friends') emitToParent('dragonbarbudo:coin_taken', { index: c.index });
    });
    if (changed) { this.hudText.setText(this.hudLabel()); this.saveNow(); }
    if (this.collectedCount >= this.coinsTotal) this.finishGame();
  }

  // Aviso del amigo: él ha recogido esta moneda, la quitamos también
  // aquí (sin recompensa ni retransmitirla de vuelta) y sumamos al
  // contador compartido.
  applyRemoteCoinTaken(payload) {
    const c = this.coins[payload && payload.index];
    if (!c || c.collected || !c.active) return;
    c.collected = true;
    this.collectedCount++;
    this.tweens.add({ targets: c, alpha: 0, scale: 1.6, duration: 220, onComplete: () => c.destroy() });
    this.hudText.setText(this.hudLabel());
    if (this.collectedCount >= this.coinsTotal) this.finishGame();
  }

  applyRemotePosition(payload) {
    if (!this.remotePlayer || typeof payload.x !== 'number' || typeof payload.y !== 'number') return;
    if (!this.remoteJoined) {
      this.remoteJoined = true;
      if (this.friendStatusText) this.friendStatusText.setText('🟢 ' + (this.friendName || 'tu amigo') + ' está en la partida');
    }
    const p = worldToScreen(payload.x, payload.y);
    // Interpolado simple (sin física ni predicción): con un mensaje
    // cada ~90ms ya se ve razonablemente fluido para una demo.
    this.tweens.add({ targets: this.remotePlayer, x: p.x, y: p.y, duration: REMOTE_POS_INTERVAL_MS, ease: 'Linear' });
    this.remotePlayer.setDepth(1000 + p.y);
    this.remoteLabel.setPosition(p.x, p.y - 70);
    const lastX = this.remotePlayer.__lastX;
    if (typeof lastX === 'number') {
      if (payload.x < lastX - 0.5) this.remotePlayer.setFlipX(true);
      else if (payload.x > lastX + 0.5) this.remotePlayer.setFlipX(false);
    }
    this.remotePlayer.__lastX = payload.x;
  }

  handleFriendLeft() {
    if (this.friendStatusText) this.friendStatusText.setText('🔴 ' + (this.friendName || 'tu amigo') + ' ha salido de la partida');
    if (this.remoteLabel) this.remoteLabel.setText((this.friendName || 'Amigo') + ' (desconectado)');
  }

  saveNow() {
    if (this.mode !== 'solo' || this.gameEnded) return;
    const collectedIndexes = this.coins.filter(c => c.collected).map(c => c.index);
    isoSaveProgress(this.worldX, this.worldY, collectedIndexes);
  }

  finishGame() {
    this.gameEnded = true;
    if (this.saveTimer) this.saveTimer.remove();
    if (this.mode === 'solo') isoClearProgress(); // partida completa: ya no hay nada que "continuar"

    const score = this.collectedCount * 15;
    const label = this.mode === 'friends' ? '🏆 ¡Completado en equipo!\nPuntuación: ' + score : '🏆 ¡Completado!\nPuntuación: ' + score;
    const banner = this.add.text(this.player.x, this.player.y - 90, label, {
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

    if (this.mode === 'friends' && time - this.lastSentPos > REMOTE_POS_INTERVAL_MS) {
      this.lastSentPos = time;
      emitToParent('dragonbarbudo:position', { x: this.worldX, y: this.worldY });
    }
  }
}
